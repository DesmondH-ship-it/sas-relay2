import fs from 'node:fs';
import { readSubmission } from './relay.mjs';
import { scoreAnswers, renderEmail } from './sas.mjs';
import { CASES, samplePayload } from './samples.mjs';
const pick = { A: 'T-G', B: 'T-H', Dual: 'T-E', C: 'T-M', D: 'T-D' };
const out = [];
for (const [group, id] of Object.entries(pick)) {
  const c = CASES.find((x) => x.id === id);
  const sub = readSubmission(samplePayload(c.a));
  const r = scoreAnswers(sub.answers);
  const e = renderEmail({ group: r.group, firstName: 'Mei', submissionId: 'SAMPLE-' + group, chart: r.chart, target: sub.target, joint: r.joint });
  fs.writeFileSync(`out/email-${group}.html`, e.html);
  out.push({ group, sample: id, score: r.score, subject: e.subject, chart: r.chart, target: sub.target, joint: r.joint });
}
fs.writeFileSync('out/manifest.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
