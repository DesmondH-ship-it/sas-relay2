// SAS (DAILYCALI Self-Assessment) scoring, routing, chart values and result emails.
// Pure functions only: no network, no storage. Source of truth: spaces/dailycali/sas/sas-logic-and-copy.md (sections 1, 3, 5, 10).

export const KEYS = {
  gender: 'question_0o44G0',
  joint: 'question_zWVVg8',
  push: 'question_5ENNrP',
  vertical: 'question_dQ77gy',
  pull: 'question_YV22e6',
  goal: 'question_D0LLbj',
  goalFocus: 'question_lVppgp',
  target: 'question_R8OO2p',
  obstacle: 'question_olJJgX',
  knowledge: 'question_GYMMk2',
  name: 'question_O8RRrp',
  email: 'question_VorrdE',
  healthConsent: 'question_P8oogd',
  marketingConsent: 'question_E8ppgq',
};

export const TARGET_OPTIONS = ['Strict pull-up', 'Wall or freestanding handstand', 'Muscle-up', 'Front or back lever', 'Planche'];

// Option positions follow the order of the options in the Tally form. Check after the form is built (test 1.12).
const POINTS = {
  joint: [0, 0, -1],      // healthy / occasional tightness / surgery or current pain
  push: [0, 1, 2, 3],
  vertical: [0, 1, 2, 3],
  pull: [0, 1, 2],
  goalFocus: [0, 1, 1],   // Q7a
  knowledge: [0, 1, 2, 3],
};
const GOAL_STRENGTH_INDEX = 1; // Q7 option 2 "Build strength and break through skills"

// Returns the score result for one set of normalised answers.
// answers: { gender, jointIdx, pushIdx, verticalIdx, pullIdx, goalIdxs:[], goalFocusIdx, knowledgeIdx }
export function scoreAnswers(a) {
  const joint = a.jointIdx === 2;
  const pPush = POINTS.push[a.pushIdx];
  const pVert = POINTS.vertical[a.verticalIdx];
  const pPull = POINTS.pull[a.pullIdx];
  const pGoal = a.goalIdxs.includes(GOAL_STRENGTH_INDEX) ? 1 : 0; // Q7: highest value picked, so one point for strength
  const pFocus = POINTS.goalFocus[a.goalFocusIdx] ?? 0;
  const pKnow = POINTS.knowledge[a.knowledgeIdx] ?? 0;
  const jointPts = POINTS.joint[a.jointIdx] ?? 0;
  const raw = jointPts + pPush + pVert + pPull + pGoal + pFocus;
  let score = Math.max(0, raw);            // floor at 0
  if (joint) score = Math.min(score, 5);  // cap at 5 when the joint answer applies
  const group = groupFor(score, a.gender);
  const chart = {
    push: Math.round((pPush / 3) * 10),
    vertical: Math.round((pVert / 3) * 10),
    pull: Math.round((pPull / 2) * 10),
    goal: Math.round(((pGoal + pFocus) / 2) * 10),
    knowledge: Math.round((pKnow / 3) * 10),
  };
  return { rawTotal: raw, score, joint, capApplied: joint && raw > 5, group, chart, strengthChosen: a.goalIdxs.includes(GOAL_STRENGTH_INDEX) };
}

export function groupFor(score, gender) {
  if (score === 5) return 'Dual';
  if (score === 6) return 'C';
  if (score >= 7) return 'D';
  return gender === 'Female' ? 'A' : 'B';   // 0 to 4: A for female, B for other and prefer not to say
}

export const GROUP_NAME = {
  A: 'Women Basics',
  B: 'Basics & Conditioning',
  Dual: 'Movement foundation + Basics conditioning',
  C: 'DAILYCALI Movement (technical transition)',
  D: 'DAILYCALI Movement',
};

// Landing page for each group. Dual and C share Page C; utm_content tells the page which hero to show.
export const PAGE = {
  A: { slug: '/sas-women-basics', utm_content: 'a' },
  B: { slug: '/sas-basics', utm_content: 'b' },
  Dual: { slug: '/sas-basics-movement', utm_content: 'dual' },
  C: { slug: '/sas-basics-movement', utm_content: 'c' },
  D: { slug: '/sas-movement', utm_content: 'd' },
};

// PDF links, from spaces/dailycali/sas/final-pdf-links.md (Group A, Group B, Dual and C share the Page C PDF, Group D).
export const PDF = {
  A: 'https://yatlong1210.wixel.com/0eae062a-89b9-415d-a6ce-c2f9348b614a',
  B: 'https://yatlong1210.wixel.com/2a4f1af3-581e-4665-a3a0-c5a6fde877b3',
  Dual: 'https://yatlong1210.wixel.com/bead6bc8-4a3f-4763-906c-e5ebaa6f6dce',
  C: 'https://yatlong1210.wixel.com/bead6bc8-4a3f-4763-906c-e5ebaa6f6dce',
  D: 'https://yatlong1210.wixel.com/762a979f-0965-41b1-b2b0-6cab3d4ac002',
};

export const WHATSAPP = 'https://wa.me/85246119088';

export function roadmapLink(group, submissionId) {
  const p = PAGE[group];
  const q = new URLSearchParams({
    utm_source: 'sas_email',
    utm_medium: 'email',
    utm_campaign: 'sas_result',
    utm_content: p.utm_content,
    utm_term: submissionId || '',
  });
  return `https://www.dailycalihk.com${p.slug}?${q.toString()}`;
}

// QuickChart pentagon. Axis order clockwise from the top: Push, Vertical push, Pull, Goal drive, Knowledge.
export function chartUrl(chart) {
  const cfg = {
    type: 'radar',
    data: {
      labels: ['Push', 'Vertical push', 'Pull', 'Goal drive', 'Knowledge'],
      datasets: [{
        label: 'Your profile',
        data: [chart.push, chart.vertical, chart.pull, chart.goal, chart.knowledge],
        backgroundColor: 'rgba(153,121,94,0.35)',
        borderColor: '#99795E',
      }],
    },
    options: { scale: { ticks: { min: 0, max: 10, stepSize: 2 } } },
  };
  return `https://quickchart.io/chart?w=600&h=450&c=${encodeURIComponent(JSON.stringify(cfg))}`;
}

export function chartAlt(c) {
  return `Your five-axis profile: Push ${c.push} of 10, Vertical push ${c.vertical} of 10, Pull ${c.pull} of 10, Goal drive ${c.goal} of 10, Knowledge ${c.knowledge} of 10.`;
}

export function chartFallback(c) {
  return `Your profile: Push ${c.push}, Vertical push ${c.vertical}, Pull ${c.pull}, Goal drive ${c.goal}, Knowledge ${c.knowledge} (each out of 10).`;
}

export const CAPTION = {
  A: 'Your chart sits close to the center: a fresh start, with the most room to grow.',
  B: 'Your chart sits close to the center today, and Basics is where every axis learns to grow.',
  Dual: 'Some of your axes reach out while others stay near the center, which is exactly why trying both Movement and Basics fits you.',
  C: 'Your strength axes stretch well beyond the center: your base is ready for the Movement class.',
  D: 'Your chart spreads wide across every axis: a solid base, ready for advanced skills.',
};

export const SUBJECT = {
  A: 'Your result: Women Basics is where you start',
  B: 'Your result: Basics is the right place to start',
  Dual: 'Your result: there is no rush, let us pick your classes together',
  C: 'Your result: you are ready for Movement',
  D: 'Your result: Movement is your next step',
};

export const PREHEADER = {
  A: 'A safe room, a patient coach and your class times.',
  B: 'Healthy joints, a strong base and your class times.',
  Dual: 'Message Desmond with your result, and he will help you choose.',
  C: 'Pick the focus that interests you most, or ask Desmond for help.',
  D: 'Three classes for your next skill, with class times.',
};

const JOINT_CARE = 'You told us about past joint surgery or current pain. Please tell your coach before your first class, so the movements can be adapted for you from the start.';

// Body paragraphs per group, from logic file section 5 (English). Merge values: first name, target, joint care, links.
const BODY = {
  A: [
    'Thank you for taking the two-minute assessment. Your result points to Women Basics. You do not need to be strong to start. You need a safe room and a patient coach, and that is what you get in a small group of 5 to 7 with Alina.',
    'Women Basics covers the four core pillars, with a focus on hips, legs and core. Each session is 1.5 hours.',
  ],
  B: [
    'Thank you for taking the two-minute assessment. Your result points to Basics & Conditioning. Starting from zero is completely fine here. In a small group of 5 to 7 with Benjamin, you build a healthy, strong base, with joint health and injury prevention first.',
    'Basics covers Pull, Push, Core and Lower Body Mobility in 1.5 hours. Form comes first, every time.',
  ],
  Dual: [
    'Thank you for taking the two-minute assessment. You already have a real fitness base. What is still missing is a steady way of moving: the strength is there, but the positions are not yet repeatable every time.',
    'Both paths work, and both sides will benefit. Our suggestion is Movement (Arm Balance) plus one Basics class for conditioning. There is no rush to decide.',
    'The best start is a conversation. Message us on WhatsApp with your result. Desmond, our founder, will personally help you choose the classes and times that fit your week. Arm Balance suits people who can manage about 5 dips, so tell Desmond where your dips are.',
  ],
  C: [
    'Thank you for taking the two-minute assessment. You are ready for our Movement class. Your strength is ready to become control. The next step is technique: strict, repeatable movement, such as strict pull-ups and L-sit progressions.',
    'Choose the focus that interests you most: Pull Focus, Arm Balance, Rings or Lower Body. Keep one Basics class going for conditioning. Not sure which to pick? Message us on WhatsApp, and Desmond will help you choose.',
  ],
  D: [
    'Thank you for taking the two-minute assessment. Your result points to our Movement classes. You have a solid strength base, and the next step connects it to advanced skills, with a clear milestone path and a pace set by your progress.',
    'Choose the class that matches your goal: Pull Focus for muscle-ups and levers, Arm Balance for muscle-ups and handstands, or Rings for planche and iron cross work.',
  ],
};

const CLASS_TIMES = {
  A: 'See your roadmap and the Tuesday, Wednesday and Saturday class times below.',
  B: 'See your roadmap and the weekly class times below.',
  Dual: 'See your roadmap and the class times below.',
  C: 'See your roadmap and the class times below.',
  D: 'See your roadmap and the class times below.',
};

export const FONT = "Inter, 'Helvetica Neue', Arial, Helvetica, sans-serif";

export function firstNameOf(name) {
  const n = (name || '').trim().split(/\s+/)[0];
  return n || 'there';
}

export function targetLine(target) {
  return `You told us the movement you most want to unlock: ${target}. Your coach keeps it in view, and your plan builds toward it step by step.`;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Builds subject, preheader and HTML for one result email. No square-bracket text, no unfilled merge tokens.
export function renderEmail({ group, firstName, submissionId, chart, target, joint }) {
  const link = roadmapLink(group, submissionId);
  const pdf = PDF[group];
  const paras = [`Hi ${esc(firstName)},`, ...BODY[group]];
  if (target) paras.push(targetLine(target));
  if (joint && group !== 'C' && group !== 'D') paras.push(JOINT_CARE);
  const bodyHtml = paras.map((p) => `<p style="font-family:${FONT};margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#4C3D34;">${esc(p)}</p>`).join('\n');
  const btn = (href, label, fill) => `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 14px auto;"><tr><td align="center" style="background:${fill};border-radius:4px;"><a href="${href}" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:14px;font-weight:bold;letter-spacing:1px;color:#FFFFFF;text-decoration:none;">${label}</a></td></tr></table>`;
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap"><title>${esc(SUBJECT[group])}</title></head>
<body style="margin:0;padding:0;background:#E5E2DF;font-family:${FONT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(PREHEADER[group])}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#E5E2DF;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:100%;background:#FFFFFF;">
<tr><td style="padding:32px 32px 8px 32px;" align="center">
  <p style="font-family:${FONT};margin:0 0 8px 0;font-family:${FONT};font-size:12px;letter-spacing:2px;color:#99795E;">YOUR SAS PROFILE</p>
  <h2 style="margin:0 0 16px 0;font-family:${FONT};font-size:22px;color:#4C3D34;">Your SAS profile</h2>
  <img src="${chartUrl(chart)}" width="600" height="450" style="display:block;width:100%;max-width:600px;height:auto;margin:0 auto;border:0;" alt="${esc(chartAlt(chart))}">
  <p style="font-family:${FONT};margin:12px 0 4px 0;font-size:14px;line-height:1.5;color:#4C3D34;text-align:center;">${esc(CAPTION[group])}</p>
  <p style="font-family:${FONT};margin:0 0 24px 0;font-size:13px;line-height:1.5;color:#99795E;text-align:center;">${esc(chartFallback(chart))}</p>
</td></tr>
<tr><td style="padding:8px 32px 0 32px;">
${bodyHtml}
</td></tr>
<tr><td style="padding:8px 32px 0 32px;" align="center">
<p style="font-family:${FONT};margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#4C3D34;text-align:center;">${esc(CLASS_TIMES[group])}</p>
${btn(link, 'VIEW MY ROADMAP', '#99795E')}
${btn(pdf, 'DOWNLOAD YOUR PDF REPORT', '#4C3D34')}
</td></tr>
<tr><td style="padding:8px 32px 32px 32px;">
<p style="font-family:${FONT};margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#4C3D34;">Ready to try it? One class is HK$400, with no package to buy.</p>
<p style="font-family:${FONT};margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#4C3D34;">Questions? Reply to this email, or <a href="${WHATSAPP}" style="color:#99795E;">message us on WhatsApp</a>.</p>
<p style="font-family:${FONT};margin:24px 0 0 0;font-size:16px;line-height:1.6;color:#4C3D34;">Desmond and the DAILYCALI coaches</p>
</td></tr>
</table></td></tr></table>
</body></html>`;
  return { subject: SUBJECT[group], preheader: PREHEADER[group], html };
}
