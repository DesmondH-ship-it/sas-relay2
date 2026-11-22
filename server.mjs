// SAS relay server. Receives Tally webhook deliveries for form 4a7YVA and sends the result email through Wix.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleTallyWebhook, wixClient } from './relay.mjs';
import crypto from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const env = (name, def = '') => process.env[name] ?? def;
const PORT = Number(env('PORT', '8080'));
const SIGNING_SECRET = env('SIGNING_SECRET');
const WIX_ACCESS_TOKEN = env('WIX_ACCESS_TOKEN');
const WIX_SITE_ID = env('WIX_SITE_ID');
const RELAY_ENABLED = env('RELAY_ENABLED') === 'true';
const SENDER_EMAIL = env('SENDER_EMAIL', 'DesmondH@dailycalihk.com');
const SENDER_NAME = env('SENDER_NAME', 'DAILYCALI');
const LABELS = { A: env('LABEL_A'), B: env('LABEL_B'), Dual: env('LABEL_DUAL'), C: env('LABEL_C'), D: env('LABEL_D'), all: env('LABEL_ALL') };
const LOG_FILE = path.join(here, 'relay-log.jsonl');
const DONE_FILE = path.join(here, 'done.json');

// The relay holds every result until all four SAS pages answer 200 on the live site. Cached 10 minutes.
const PAGES = ['/sas-women-basics', '/sas-basics', '/sas-basics-movement', '/sas-movement'];
let pagesLiveCache = { at: 0, value: false };
async function pagesLive() {
  if (env('PAGES_LIVE') === 'force') return true;
  if (Date.now() - pagesLiveCache.at < 10 * 60 * 1000) return pagesLiveCache.value;
  const checks = await Promise.allSettled(PAGES.map((slug) =>
    fetch('https://www.dailycalihk.com' + slug, { redirect: 'follow' }).then((r) => r.status).catch(() => 0)));
  const value = checks.every((c) => c.status === 'fulfilled' && c.value === 200);
  pagesLiveCache = { at: Date.now(), value };
  return value;
}

// Persistent event store, so a restart does not resend.
let seenEvents;
try { seenEvents = new Set(JSON.parse(fs.readFileSync(DONE_FILE, 'utf8'))); } catch { seenEvents = new Set(); }
const saveSeen = () => { try { fs.writeFileSync(DONE_FILE, JSON.stringify([...seenEvents])); } catch {} };

const log = (event, data) => {
  const line = JSON.stringify({ t: new Date().toISOString(), event, ...data });
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
  console.log(line);
};

const server = http.createServer(async (req, res) => {
  const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.method === 'GET' && (req.url === '/healthz' || req.url === '/')) {
    return send(200, { ok: true, relayEnabled: RELAY_ENABLED, signingSecretSet: !!SIGNING_SECRET, wixTokenSet: !!WIX_ACCESS_TOKEN, wixSiteIdSet: !!WIX_SITE_ID, labelsSet: !!(LABELS.A && LABELS.B && LABELS.Dual && LABELS.C && LABELS.D) });
  }
  if (req.method === 'POST' && req.url === '/webhook') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const rawBody = Buffer.concat(chunks).toString('utf8');
    const wix = wixClient({ accessToken: WIX_ACCESS_TOKEN, siteId: WIX_SITE_ID });
    let result;
    try {
      result = await handleTallyWebhook({
        rawBody,
        signature: req.headers['tally-signature'],
        deps: {
          signingSecret: SIGNING_SECRET,
          wix,
          log,
          relayEnabled: RELAY_ENABLED,
          seenEvents,
          labelFor: (g) => LABELS[g],
          sendFrom: { senderName: SENDER_NAME, senderEmailAddress: SENDER_EMAIL },
          pagesLive: await pagesLive(),
        },
      });
    } catch (e) {
      log('error', { reason: 'unexpected' });
      return send(500, { status: 500 });
    }
    saveSeen();
    return send(result.status, { status: result.status, note: result.note ?? null, group: result.group ?? null });
  }
  if (req.method === 'GET' && req.url.startsWith('/replay')) {
    const REPLAY_KEY = env('REPLAY_KEY');
    const given = new URL(req.url, 'http://localhost').searchParams.get('key') || '';
    if (!REPLAY_KEY || given !== REPLAY_KEY) { log('replay-reject', { reason: 'key' }); return send(403, { status: 403 }); }
    const file = path.join(here, 'replay-darlena.json');
    if (!fs.existsSync(file)) return send(404, { status: 404 });
    const rawBody = fs.readFileSync(file, 'utf8');
    const sig = crypto.createHmac('sha256', SIGNING_SECRET).update(rawBody).digest('base64');
    const wix = wixClient({ accessToken: WIX_ACCESS_TOKEN, siteId: WIX_SITE_ID });
    let result;
    try {
      result = await handleTallyWebhook({
        rawBody,
        signature: sig,
        deps: {
          signingSecret: SIGNING_SECRET,
          wix,
          log,
          relayEnabled: RELAY_ENABLED,
          seenEvents,
          labelFor: (g) => LABELS[g],
          sendFrom: { senderName: SENDER_NAME, senderEmailAddress: SENDER_EMAIL },
          pagesLive: await pagesLive(),
        },
      });
    } catch (e) {
      log('error', { reason: 'unexpected' });
      return send(500, { status: 500 });
    }
    saveSeen();
    return send(result.status, { status: result.status, note: result.note ?? null, group: result.group ?? null });
  }
  return send(404, { status: 404 });
});

server.listen(PORT, () => log('started', { port: PORT, relayEnabled: RELAY_ENABLED }));
