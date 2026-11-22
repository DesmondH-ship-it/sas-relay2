import assert from 'node:assert/strict';
import fs from 'node:fs';
import { handleTallyWebhook, readSubmission, verifyTallySignature, idempotencyKey } from './relay.mjs';
import { scoreAnswers, renderEmail, roadmapLink, PDF } from './sas.mjs';
import { CASES, samplePayload, signed } from './samples.mjs';

const SECRET = 'test-only-signing-secret';
let passed = 0;
const ok = (name) => { passed++; console.log('PASS', name); };

function fakeWix({ existing = null, failSend = false } = {}) {
  const calls = [];
  return {
    calls,
    findContactByEmail: async (email) => { calls.push(['find', email]); return existing; },
    createContact: async (info) => { calls.push(['create', info]); return { _id: 'new-id' }; },
    updateContact: async (id, info) => { calls.push(['update', id, info]); return { _id: id }; },
    sendTransactionalEmail: async (p) => { calls.push(['send', p]); if (failSend) throw new Error('boom'); return {}; },
  };
}
const logs = [];
const log = (event, data) => logs.push({ event, ...data });
const labelFor = (g) => `sas-group-${g}`;
const sendFrom = { name: 'DAILYCALI', email: 'noreply-placeholder@example.com' };

// 1. signature
{
  const { raw, sig } = signed(samplePayload(CASES[0].a), SECRET);
  assert.equal(verifyTallySignature(raw, sig, SECRET), true);
  assert.equal(verifyTallySignature(raw, sig, 'other'), false);
  assert.equal(verifyTallySignature(raw + ' ', sig, SECRET), false);
  ok('signature: valid passes, wrong secret or edited body fails');
}

// 2. scoring and routing for every case
for (const c of CASES) {
  if (c.expect.reject) continue;
  const sub = readSubmission(samplePayload(c.a));
  const r = scoreAnswers(sub.answers);
  assert.equal(r.group, c.expect.group, `${c.id} group`);
  assert.equal(r.score, c.expect.score, `${c.id} score`);
  assert.equal(r.joint, c.expect.joint, `${c.id} joint`);
  if (c.expect.capApplied !== undefined) assert.equal(r.capApplied, c.expect.capApplied, `${c.id} cap`);
  assert.deepEqual(r.chart, c.expect.chart, `${c.id} chart`);
  ok(`${c.id}: group ${r.group}, score ${r.score}, chart ${JSON.stringify(r.chart)}`);
}

// 3. full flow with relay ON and pages live: send, contact, labels, idempotency key
for (const c of CASES) {
  if (c.expect.reject) continue;
  logs.length = 0;
  const wix = fakeWix();
  const { raw, sig } = signed(samplePayload(c.a), SECRET);
  const res = await handleTallyWebhook({ rawBody: raw, signature: sig, deps: { signingSecret: SECRET, wix, log, relayEnabled: true, pagesLive: true, labelFor, sendFrom, seenEvents: new Set() } });
  assert.equal(res.status, 200, `${c.id} status`);
  assert.equal(res.group, c.expect.group, `${c.id} group in response`);
  const send = wix.calls.find((x) => x[0] === 'send')[1];
  assert.equal(send.idempotencyKey, idempotencyKey(c.a.eventId));
  assert.match(send.html, new RegExp(`utm_content=${c.expect.group === 'Dual' ? 'dual' : c.expect.group === 'C' ? 'c' : c.expect.group.toLowerCase()}`));
  assert.ok(send.html.includes(PDF[c.expect.group]), `${c.id} pdf link`);
  assert.ok(!/\[|\]/.test(send.html), `${c.id} no square brackets in email`);
  assert.ok(!/\{[a-z ]+\}/i.test(send.html), `${c.id} no unfilled merge tokens`);
  assert.ok(send.html.includes('Your SAS profile'), `${c.id} report heading`);
  assert.ok(!send.html.includes('—') && !send.html.includes('–'), `${c.id} no long dashes`);
  const jointText = 'past joint surgery';
  assert.equal(send.html.includes(jointText), !!c.expect.joint && c.expect.group !== 'C' && c.expect.group !== 'D', `${c.id} joint line rule`);
  if (c.expect.noTarget) assert.ok(!send.html.includes('You told us the movement'), `${c.id} no target line`);
  if (!c.expect.noTarget && c.a.target != null && c.expect.group !== undefined) assert.ok(send.html.includes('You told us the movement'), `${c.id} target line`);
  // privacy: logs carry no health text and no contact details
  const logText = JSON.stringify(logs);
  assert.ok(!/surgery|pain|tightness|Healthy/i.test(logText), `${c.id} logs free of health answers`);
  assert.ok(!logText.includes(c.a.email), `${c.id} logs free of email`);
  const contactCall = wix.calls.find((x) => x[0] === 'create');
  assert.ok(contactCall, `${c.id} contact created`);
  assert.deepEqual(contactCall[1].labelKeys, [labelFor(c.expect.group), labelFor('all')]);
  ok(`${c.id}: sent ${c.expect.group} email, contact labelled, logs clean`);
}

// 4. OFF by default: nothing sent or created
{
  const c = CASES[1];
  const wix = fakeWix();
  const { raw, sig } = signed(samplePayload(c.a), SECRET);
  const res = await handleTallyWebhook({ rawBody: raw, signature: sig, deps: { signingSecret: SECRET, wix, log, labelFor, sendFrom, seenEvents: new Set() } });
  assert.equal(res.note, 'held');
  assert.equal(wix.calls.length, 0);
  ok('switch OFF (default): acknowledged, nothing sent, no contact, no Wix call');
}

// 5. pages not live: held
{
  const c = CASES[2];
  const wix = fakeWix();
  const { raw, sig } = signed(samplePayload(c.a), SECRET);
  const res = await handleTallyWebhook({ rawBody: raw, signature: sig, deps: { signingSecret: SECRET, wix, log, relayEnabled: true, pagesLive: false, labelFor, sendFrom, seenEvents: new Set() } });
  assert.equal(res.note, 'held');
  assert.equal(wix.calls.length, 0);
  ok('pages not live: held, nothing sent');
}

// 6. bad signature: 401, no Wix call
{
  const c = CASES[0];
  const wix = fakeWix();
  const { raw } = signed(samplePayload(c.a), SECRET);
  const res = await handleTallyWebhook({ rawBody: raw, signature: 'bad', deps: { signingSecret: SECRET, wix, log, relayEnabled: true, pagesLive: true, labelFor, sendFrom, seenEvents: new Set() } });
  assert.equal(res.status, 401);
  assert.equal(wix.calls.length, 0);
  ok('bad signature: 401, nothing touched');
}

// 7. no consent: 400, nothing sent
{
  const c = CASES.find((x) => x.id === 'T-I');
  const wix = fakeWix();
  const { raw, sig } = signed(samplePayload(c.a), SECRET);
  const res = await handleTallyWebhook({ rawBody: raw, signature: sig, deps: { signingSecret: SECRET, wix, log, relayEnabled: true, pagesLive: true, labelFor, sendFrom, seenEvents: new Set() } });
  assert.equal(res.status, 400);
  assert.equal(wix.calls.length, 0);
  ok('health consent not ticked: 400, nothing sent');
}

// 8. duplicate eventId: second delivery does no work
{
  const c = CASES[0];
  const wix = fakeWix();
  const seen = new Set();
  const { raw, sig } = signed(samplePayload(c.a), SECRET);
  const deps = { signingSecret: SECRET, wix, log, relayEnabled: true, pagesLive: true, labelFor, sendFrom, seenEvents: seen };
  await handleTallyWebhook({ rawBody: raw, signature: sig, deps });
  const before = wix.calls.length;
  const res = await handleTallyWebhook({ rawBody: raw, signature: sig, deps });
  assert.equal(res.note, 'duplicate');
  assert.equal(wix.calls.length, before);
  ok('duplicate eventId: 200, no second send');
}

// 9. Wix failure: 500 so Tally retries, and the event is not marked seen
{
  const c = CASES[0];
  const wix = fakeWix({ failSend: true });
  const seen = new Set();
  const { raw, sig } = signed(samplePayload(c.a), SECRET);
  const res = await handleTallyWebhook({ rawBody: raw, signature: sig, deps: { signingSecret: SECRET, wix, log, relayEnabled: true, pagesLive: true, labelFor, sendFrom, seenEvents: seen } });
  assert.equal(res.status, 500);
  assert.equal(seen.size, 0);
  ok('Wix failure: 500, event not marked done, Tally can retry');
}

// 10. existing contact is updated, not duplicated
{
  const c = CASES[1];
  const wix = fakeWix({ existing: { _id: 'c-1', revision: 3 } });
  const { raw, sig } = signed(samplePayload(c.a), SECRET);
  await handleTallyWebhook({ rawBody: raw, signature: sig, deps: { signingSecret: SECRET, wix, log, relayEnabled: true, pagesLive: true, labelFor, sendFrom, seenEvents: new Set() } });
  assert.ok(wix.calls.find((x) => x[0] === 'update'));
  assert.ok(!wix.calls.find((x) => x[0] === 'create'));
  ok('existing contact: updated in place, no duplicate contact');
}

// 11. roadmap link tags
{
  const l = roadmapLink('Dual', 'SUB123');
  assert.ok(l.includes('/sas-basics-movement?'));
  assert.ok(l.includes('utm_content=dual') && l.includes('utm_term=SUB123') && l.includes('utm_medium=email'));
  ok('roadmap link: page slug, utm_content and submission id present');
}


// 12. replay payload for the real 14:33 HK submission matches Tally's stored score and group
{
  const payload = JSON.parse(fs.readFileSync('replay-darlena.json', 'utf8'));
  const sub = readSubmission(payload);
  const r = scoreAnswers(sub.answers);
  assert.equal(sub.tallyScore, 2, 'darlena tally score read from calculated object');
  assert.equal(r.group, 'A', 'darlena group');
  assert.equal(r.score, 2, 'darlena score');
  assert.deepEqual(r.chart, { push: 0, vertical: 0, pull: 0, goal: 10, knowledge: 0 }, 'darlena chart');
  assert.equal(sub.healthConsent, true, 'darlena consent');
  assert.equal(sub.target, 'Strict pull-up', 'darlena target');
  ok('replay-darlena: group A, score 2, tally score 2 read from calculated object');
}

console.log(`\n${passed} checks passed`);
