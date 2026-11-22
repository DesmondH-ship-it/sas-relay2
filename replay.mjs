// One-time replay: push a stored past submission through this relay, signed with the local SIGNING_SECRET.
// Use after switch-on for submissions that happened before the webhook existed (for example replay-darlena.json).
// Usage: SIGNING_SECRET=<secret> [RELAY_URL=<url>] node replay.mjs replay-darlena.json
import fs from 'node:fs';
import crypto from 'node:crypto';

const file = process.argv[2];
const secret = process.env.SIGNING_SECRET;
const url = process.env.RELAY_URL || 'http://localhost:' + (process.env.PORT || '8080') + '/webhook';
if (!file || !secret) {
  console.error('Usage: SIGNING_SECRET=<secret> [RELAY_URL=<url>] node replay.mjs <payload.json>');
  process.exit(1);
}
const raw = JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8')));
const sig = crypto.createHmac('sha256', secret).update(raw).digest('base64');
const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'tally-signature': sig }, body: raw });
console.log('status', r.status);
console.log(await r.text());
