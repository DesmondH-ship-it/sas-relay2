// Sample Tally FORM_RESPONSE payloads for the test run. Option ids are synthetic; keys match sas.mjs KEYS.
import crypto from 'node:crypto';
import { KEYS, TARGET_OPTIONS } from './sas.mjs';

const OPTIONS = {
  gender: ['Female', 'Male', 'Prefer not to say'],
  joint: ['Healthy', 'Occasional tightness', 'Surgery or current pain'],
  push: ['Under 5 push-ups or plank under 30 s', '5 to 12 push-ups, plank 30 to 60 s', '13 to 19 push-ups, stable core', '20 or more push-ups'],
  vertical: ['Not yet, or no full control', 'Assisted 3+ or unassisted 1 to 2', 'Unassisted 3 to 7, full range', 'Unassisted 8 or more, full range'],
  pull: ['Not yet, practising negatives', 'Strict 1 to 4', 'Strict 5 or more'],
  goal: ['Long-term health, posture and joint mobility', 'Build strength and break through skills'],
  goalFocus: ['Full-body mobility and joint range', 'Upper or lower body base strength', 'Full-body coordination and advanced control'],
  target: TARGET_OPTIONS,
  obstacle: ['Systematic technique', 'Steady training time', 'Focus and real-time correction', 'Confidence and a safe start'],
  knowledge: ['Completely new', 'Starting out', 'Regular', 'Experienced'],
};

function fieldFor(key, optKey, idxOrIdxs, label) {
  const opts = OPTIONS[optKey].map((text, i) => ({ id: `${optKey}-${i}`, text }));
  if (Array.isArray(idxOrIdxs)) {
    return { key, label, type: 'CHECKBOXES', options: opts, value: idxOrIdxs.map((i) => opts[i].id) };
  }
  return { key, label, type: 'MULTIPLE_CHOICE', options: opts, value: idxOrIdxs == null ? [] : [opts[idxOrIdxs].id] };
}

// a: { gender, joint, push, vertical, pull, goal:[], goalFocus, target (index or null), knowledge, name, email, consent, eventId }
export function samplePayload(a, { tallyScore = null } = {}) {
  const submissionId = a.submissionId || `sub-${a.eventId}`;
  const fields = [
    fieldFor(KEYS.gender, 'gender', a.gender),
    fieldFor(KEYS.joint, 'joint', a.joint),
    fieldFor(KEYS.push, 'push', a.push),
    fieldFor(KEYS.vertical, 'vertical', a.vertical),
    fieldFor(KEYS.pull, 'pull', a.pull),
    fieldFor(KEYS.goal, 'goal', a.goal),
    fieldFor(KEYS.goalFocus, 'goalFocus', a.goalFocus),
  ];
  if (a.goal.includes(1)) {
    // Q7b is only shown after the strength option. Included here when the person answered it.
    if (a.target != null) fields.push(fieldFor(KEYS.target, 'target', a.target));
  }
  fields.push(fieldFor(KEYS.obstacle, 'obstacle', a.obstacle ?? 0));
  fields.push(fieldFor(KEYS.knowledge, 'knowledge', a.knowledge));
  fields.push({ key: KEYS.name, label: 'Name', type: 'INPUT_TEXT', value: a.name });
  fields.push({ key: KEYS.email, label: 'Email', type: 'INPUT_EMAIL', value: a.email });
  const consentOpt = [{ id: 'consent-health', text: 'Health consent' }];
  fields.push({ key: KEYS.healthConsent, label: 'Health consent', type: 'CHECKBOXES', options: consentOpt, value: a.consent === false ? [] : ['consent-health'] });
  fields.push({ key: KEYS.marketingConsent, label: 'Marketing consent', type: 'CHECKBOXES', options: [{ id: 'consent-mkt', text: 'Marketing' }], value: a.marketing ? ['consent-mkt'] : [] });
  fields.push({ key: 'question_XOjj9d', label: null, type: 'CALCULATED_FIELDS', value: tallyScore == null ? null : { score: tallyScore } });
  return { eventId: a.eventId, eventType: 'FORM_RESPONSE', createdAt: '2026-11-20T09:00:00.000Z', data: { submissionId, formId: '4a7YVA', fields } };
}

export function signed(payload, secret) {
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', secret).update(raw).digest('base64');
  return { raw, sig };
}

const base = { gender: 1, joint: 0, push: 0, vertical: 0, pull: 0, goal: [0], goalFocus: 0, knowledge: 0, obstacle: 0, marketing: false, consent: true };

// Test cases. expect: group, score, and extra checks used by test.mjs.
export const CASES = [
  { id: 'T-A', name: 'Ada Wong', email: 'ada.test@example.com', a: { ...base, gender: 0, eventId: 'evt-A', name: 'Ada Wong', email: 'ada.test@example.com' }, expect: { group: 'A', score: 0, joint: false, chart: { push: 0, vertical: 0, pull: 0, goal: 0, knowledge: 0 } } },
  { id: 'T-B', a: { ...base, gender: 1, push: 2, vertical: 1, pull: 0, goal: [1], goalFocus: 1, knowledge: 2, target: 0, eventId: 'evt-B', name: 'Ben Chan', email: 'ben.test@example.com' }, expect: { group: 'Dual', score: 5, joint: false, chart: { push: 7, vertical: 3, pull: 0, goal: 10, knowledge: 7 } } },
  { id: 'T-C', a: { ...base, gender: 0, push: 2, vertical: 2, pull: 1, goal: [1], goalFocus: 0, knowledge: 1, target: 1, eventId: 'evt-C', name: 'Cici Lau', email: 'cici.test@example.com' }, expect: { group: 'C', score: 6, joint: false, chart: { push: 7, vertical: 7, pull: 5, goal: 5, knowledge: 3 } } },
  { id: 'T-D', a: { ...base, gender: 2, push: 3, vertical: 3, pull: 2, goal: [1], goalFocus: 2, knowledge: 3, target: 4, eventId: 'evt-D', name: 'Dan Ho', email: 'dan.test@example.com' }, expect: { group: 'D', score: 10, joint: false, chart: { push: 10, vertical: 10, pull: 10, goal: 10, knowledge: 10 } } },
  { id: 'T-E', a: { ...base, gender: 1, joint: 2, push: 2, vertical: 3, pull: 2, goal: [1], goalFocus: 1, knowledge: 0, target: 2, eventId: 'evt-E', name: 'Eric Yip', email: 'eric.test@example.com' }, expect: { group: 'Dual', score: 5, joint: true, capApplied: true, chart: { push: 7, vertical: 10, pull: 10, goal: 10, knowledge: 0 } } },
  { id: 'T-F', a: { ...base, gender: 0, joint: 2, eventId: 'evt-F', name: 'Fay Ng', email: 'fay.test@example.com' }, expect: { group: 'A', score: 0, joint: true, chart: { push: 0, vertical: 0, pull: 0, goal: 0, knowledge: 0 } } },
  { id: 'T-G', a: { ...base, gender: 0, joint: 2, push: 3, vertical: 2, pull: 0, goal: [0], goalFocus: 0, knowledge: 1, eventId: 'evt-G', name: 'Gigi Lo', email: 'gigi.test@example.com' }, expect: { group: 'A', score: 4, joint: true, capApplied: false, chart: { push: 10, vertical: 7, pull: 0, goal: 0, knowledge: 3 } } },
  { id: 'T-H', a: { ...base, gender: 1, goal: [0, 1], goalFocus: 1, target: 4, knowledge: 1, eventId: 'evt-H', name: 'Henry Tse', email: 'henry.test@example.com' }, expect: { group: 'B', score: 2, joint: false, chart: { push: 0, vertical: 0, pull: 0, goal: 10, knowledge: 3 } } },
  { id: 'T-M', a: { ...base, gender: 0, push: 2, vertical: 2, pull: 1, goal: [1], goalFocus: 0, knowledge: 1, target: null, eventId: 'evt-M', name: 'Mona Li', email: 'mona.test@example.com' }, expect: { group: 'C', score: 6, joint: false, noTarget: true, chart: { push: 7, vertical: 7, pull: 5, goal: 5, knowledge: 3 } } },
  { id: 'T-I', a: { ...base, gender: 1, consent: false, eventId: 'evt-I', name: 'Ivan Kwok', email: 'ivan.test@example.com' }, expect: { reject: 400 } },
];
