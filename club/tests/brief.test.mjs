// Brief du matin : heure de Paris, préférence digest, même total que la page Opportunités.
//   TZ=Europe/Paris node club/tests/brief.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerAppli } from '../outils/fitpulse-rapport.mjs';
import { quandBrief, passageBrief, destinataires, briefPour, emailBrief, pushBrief } from '../outils/fitpulse-brief.mjs';

const demo = () => { const run = chargerAppli('demo'); return JSON.parse(run('JSON.stringify(S)')); };

test('7 h 30 heure de Paris, été comme hiver, du lundi au samedi', () => {
  assert.equal(quandBrief(new Date('2026-10-24T05:30:00Z')).action, 'envoyer'); // samedi, heure d'été (UTC+2)
  assert.equal(quandBrief(new Date('2026-10-26T06:30:00Z')).action, 'envoyer'); // lundi, heure d'hiver (UTC+1)
  assert.equal(quandBrief(new Date('2026-10-26T05:30:00Z')).action, 'non');     // lundi 6 h 30 à Paris
  assert.equal(quandBrief(new Date('2026-10-26T06:28:00Z')).action, 'attendre');
  assert.equal(quandBrief(new Date('2026-10-25T06:30:00Z')).action, 'non');     // dimanche
});

test('digest=false : rien n’est envoyé', async () => {
  const S = demo(); const club = 'centre';
  for (const u of Object.values(S.users)) if (u.role === 'manager') { S.prefs = S.prefs || {}; S.prefs[u.id] = { ...(S.prefs[u.id] || {}), digest: false }; }
  assert.equal(destinataires(S, club).length, 0);
  const envois = []; const api = async () => ({ ok: true, json: async () => ({}) });
  await passageBrief(api, 'tk', S, async (d, m) => envois.push(d), { force: true, log: null, push: false });
  assert.equal(envois.length, 0);
});

test('chaque manager avec digest reçoit l’e-mail ; le total est celui de la page', async () => {
  const S = demo(); const envois = []; const api = async () => ({ ok: true, json: async () => ({}) });
  const dest = destinataires(S, 'centre'); assert.ok(dest.length >= 1);
  await passageBrief(api, 'tk', S, async (d, m) => envois.push([d, m]), { force: true, log: null, push: false });
  assert.ok(envois.length >= 1);
  const run = chargerAppli(S); const D = briefPour(S, 'centre', run);
  run(`ME = Object.values(S.users).find(u => u.role === 'manager' && (u.clubs || []).includes('centre')); CLUB = S.clubs.centre; UI.oppScope = 'all';`);
  const page = run(`PAGES.opportunites.render()`);
  const totalPage = page.match(/data-brief-total>([^<]+)</)[1];
  assert.equal(totalPage, run(`fmtE(${D.total})`));
  assert.equal(D.total, D.top.reduce((s, o) => s + o.euros, 0));
  assert.ok(envois[0][1].html.includes(new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(D.total) + ' €'));
});

test('e-mail et notification : ni tiret cadratin ni emoji ; aucun nom dans la notification', () => {
  const S = demo(); const D = briefPour(S, 'centre'); const m = emailBrief(D); const p = pushBrief(D);
  for (const t of [m.objet, m.texte, m.html, p.title, p.body]) { assert.doesNotMatch(t, /—/); assert.doesNotMatch(t, /\p{Extended_Pictographic}/u); }
  for (const o of D.top) if (o.client) assert.ok(!p.body.includes(o.client));
  assert.equal(D.top.length, 5);
});
