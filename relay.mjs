// Tally to Wix relay for the SAS form (4a7YVA).
import crypto from 'node:crypto';
import { KEYS, scoreAnswers, renderEmail, firstNameOf, TARGET_OPTIONS, groupFor } from './sas.mjs';

export function verifyTallySignature(rawBody, signatureHeader, signingSecret) {
  if (!signingSecret || !signatureHeader) return false;
  const expected = crypto.createHmac('sha256', signingSecret).update(rawBody).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signatureHeader));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Stable GUID from the Tally eventId, used as the Wix idempotency key.
export function idempotencyKey(eventId) {
  const h = crypto.createHash('sha256').update(`sas-relay:${eventId}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// Reads one Tally field's chosen option position (0-based) from the form order.
function choiceIndex(fields, key) {
  const f = fields.find((x) => x.key === key);
  if (!f || f.value == null || (Array.isArray(f.value) && f.value.length === 0)) return null;
  const id = Array.isArray(f.value) ? f.value[0] : f.value;
  const idx = (f.options || []).findIndex((o) => o.id === id);
  return idx >= 0 ? idx : null;
}
function checkedIndexes(fields, key) {
  const f = fields.find((x) => x.key === key);
  if (!f || !Array.isArray(f.value)) return [];
  return (f.options || []).map((o, i) => (f.value.includes(o.id) ? i : -1)).filter((i) => i >= 0);
}
function textValue(fields, key) {
  const f = fields.find((x) => x.key === key);
  return f && typeof f.value === 'string' ? f.value.trim() : '';
}

// Turns a Tally FORM_RESPONSE payload into normalised answers. Throws when a required answer is missing.
export function readSubmission(payload) {
  const d = payload.data;
  const fields = d.fields || [];
  const genderIdx = choiceIndex(fields, KEYS.gender);
  const gender = ['Female', 'Male', 'Prefer not to say'][genderIdx];
  const answers = {
    gender,
    jointIdx: choiceIndex(fields, KEYS.joint),
    pushIdx: choiceIndex(fields, KEYS.push),
    verticalIdx: choiceIndex(fields, KEYS.vertical),
    pullIdx: choiceIndex(fields, KEYS.pull),
    goalIdxs: checkedIndexes(fields, KEYS.goal),
    goalFocusIdx: choiceIndex(fields, KEYS.goalFocus),
    knowledgeIdx: choiceIndex(fields, KEYS.knowledge),
  };
  const targetIdx = choiceIndex(fields, KEYS.target);
  const healthConsent = checkedIndexes(fields, KEYS.healthConsent).length > 0;
  const marketingConsent = checkedIndexes(fields, KEYS.marketingConsent).length > 0;
  const name = textValue(fields, KEYS.name);
  const email = textValue(fields, KEYS.email);
  for (const k of ['gender', 'jointIdx', 'pushIdx', 'verticalIdx', 'pullIdx', 'goalFocusIdx', 'knowledgeIdx']) {
    if (answers[k] == null) throw new Error(`missing answer: ${k}`);
  }
  const calcField = fields.find((f) => f.type === 'CALCULATED_FIELDS');
  const calcValue = calcField ? calcField.value : null;
  const tallyScore = calcValue && typeof calcValue === 'object' ? calcValue.score ?? null : calcValue ?? null;
  return {
    eventId: payload.eventId,
    submissionId: d.submissionId,
    answers,
    target: targetIdx == null ? null : TARGET_OPTIONS[targetIdx] ?? null,
    healthConsent,
    marketingConsent,
    name,
    email,
    tallyScore,
  };
}

// Wix client.
export function wixClient({ accessToken, siteId, siteFetch = fetch, base = 'https://www.wixapis.com' }) {
  const call = async (method, path, body) => {
    const headers = {
      Authorization: accessToken,
      'Content-Type': 'application/json',
    };
    if (siteId) headers['wix-site-id'] = siteId;

    const r = await siteFetch(`${base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      throw new Error(`wix ${method} ${path} failed: ${r.status} ${errText}`);
    }
    return r.json();
  };
  return {
    findContactByEmail: async (email) => {
      const res = await call('POST', '/contacts/v4/contacts/query', { query: { filter: { 'info.emails.email': email } } });
      return (res.contacts || [])[0] || null;
    },
    createContact: (info) => call('POST', '/contacts/v4/contacts', { info }),
    updateContact: (id, info, revision) => call('PATCH', `/contacts/v4/contacts/${id}`, { info, revision }),
    labelIdFor: async (key) => key,
    sendTransactionalEmail: ({ contactId, subject, html, senderName, senderEmailAddress, idempotencyKey }) =>
      call('POST', '/email-transmissions/v1/email-transmissions/send', {
        emailTransmission: {
          emailSubject: subject,
          emailHtmlContent: html,
          senderName,
          senderEmailAddress,
          replyTo: { emailAddress: senderEmailAddress },
          toRecipients: [{ contactId }],
          type: 'TRANSACTIONAL',
        },
        idempotencyKey,
      }),
    createLabel: (displayName) => call('POST', '/contacts/v4/labels', { displayName }),
  };
}

// Handles one Tally webhook delivery.
export async function handleTallyWebhook({ rawBody, signature, deps }) {
  const { signingSecret, wix, log, relayEnabled = false, seenEvents = new Set(), pagesLive = false } = deps;
  if (!verifyTallySignature(rawBody, signature, signingSecret)) {
    log('reject', { reason: 'signature' });
    return { status: 401 };
  }
  const payload = JSON.parse(rawBody);
  if (seenEvents.has(payload.eventId)) {
    log('duplicate', { eventId: payload.eventId });
    return { status: 200, note: 'duplicate' };
  }
  let sub;
  try {
    sub = readSubmission(payload);
  } catch (e) {
    log('reject', { reason: 'incomplete' });
    return { status: 400 };
  }
  if (!sub.healthConsent) {
    log('reject', { reason: 'no-consent' });
    return { status: 400 };
  }
  const result = scoreAnswers(sub.answers);
  if (sub.tallyScore != null && Number(sub.tallyScore) !== result.score) {
    log('mismatch', { eventId: sub.eventId, tallyScore: sub.tallyScore, relayScore: result.score });
  }
  if (!relayEnabled) {
    log('held', { eventId: sub.eventId, group: result.group, reason: 'relay-off' });
    return { status: 200, note: 'held' };
  }
  if (!pagesLive) {
    log('held', { eventId: sub.eventId, group: result.group, reason: 'pages-not-live' });
    return { status: 200, note: 'held' };
  }
  try {
    const labels = [...new Set([deps.labelFor(result.group), deps.labelFor('all')].filter(Boolean))];
    const info = {
      name: { first: sub.name.split(/\s+/)[0] || '', last: sub.name.split(/\s+/).slice(1).join(' ') },
      emails: { items: [{ email: sub.email, primary: true }] },
      labelKeys: labels,
    };
    let contactId;
    const existing = await wix.findContactByEmail(sub.email);
    if (existing) {
      await wix.updateContact(existing._id, info, existing.revision);
      contactId = existing._id;
    } else {
      const created = await wix.createContact(info);
      contactId = created?.contact?._id || created?._id || deps.lastCreatedContactId;
    }
    const email = renderEmail({
      group: result.group,
      firstName: firstNameOf(sub.name),
      submissionId: sub.submissionId,
      chart: result.chart,
      target: sub.answers.strengthChosen === false ? null : sub.target,
      joint: result.joint,
    });
    await wix.sendTransactionalEmail({
      contactId,
      subject: email.subject,
      html: email.html,
      senderName: deps.sendFrom?.senderName ?? 'DAILYCALI',
      senderEmailAddress: deps.sendFrom?.senderEmailAddress ?? deps.sendFrom,
      idempotencyKey: idempotencyKey(sub.eventId),
    });
    seenEvents.add(payload.eventId);
    log('sent', { eventId: sub.eventId, group: result.group, score: result.score });
    return { status: 200, group: result.group };
  } catch (e) {
    log('retry', { eventId: sub.eventId, reason: 'wix', error: e.message });
    return { status: 500 };
  }
}
