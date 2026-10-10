// L'assistant de la page d'accueil : base fraîche, refus hors sujet, plafonds,
// budget, panne du modèle, journal anonymisé, rapport du lundi.
//   node --test cloudflare/test/chat.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { creerBase } from '../src/base.js';
import * as C from '../src/chat.js';
import BASE from '../src/base-chat.js';
import { baseFraiche, enJs, faqDe } from '../../scripts/base-chat.mjs';
import T from '../../tarifs.json' with { type: 'json' };
import { readFileSync } from 'node:fs';
import { fausseBase } from './fausse-base.mjs';

const T0 = Date.parse('2026-10-12T12:00:00+02:00');   // un lundi
const JOUR = '2026-10-12', MOIS = '2026-10';
const IP = '203.0.113.7';

// Un faux API Claude : `reponse` décide de ce qu'il rend à chaque appel.
function monde(initial, o) {
  const F = fausseBase(initial);
  const opt = Object.assign({ cle: 'sk-ant-test', texte: 'Oui : l’essai dure 1 mois, sans carte. Commence l’essai gratuit !' }, o || {});
  const w = { F, t: T0, appels: [], pushs: [] };
  const usage = { input_tokens: 40, output_tokens: 60, cache_creation_input_tokens: 0, cache_read_input_tokens: 5000 };
  const fetchImpl = async (url, init) => {
    const u = String(url);
    if (u.startsWith('https://api.anthropic.com/')) {
      const corps = JSON.parse(init.body);
      w.appels.push({ url: u, corps, entetes: init.headers });
      if (opt.panne) {
        if (opt.panne === 'reseau') throw new TypeError('fetch failed');
        return new Response(JSON.stringify({ type: 'error', error: { type: opt.panne === 529 ? 'overloaded_error' : 'rate_limit_error', message: 'x' } }),
          { status: opt.panne, headers: { 'content-type': 'application/json', 'retry-after-ms': '0' } });
      }
      const texte = typeof opt.texte === 'function' ? opt.texte(corps) : opt.texte;
      return new Response(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: corps.model, stop_reason: opt.stop || 'end_turn',
        content: [{ type: 'text', text: texte }], usage }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return F.fetchImpl(url, init);
  };
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl });
  const env = { ADMIN_SECRET: 'secret-de-test', CHAT_BUDGET_USD: opt.budget || '' };
  if (opt.cle) env.ANTHROPIC_API_KEY = opt.cle;
  const M = { envoyerPush: async (cle, p) => { w.pushs.push({ cle, p }); return true; } };
  w.chat = C.creerChat({ db, env, fetchImpl, maintenant: () => w.t, M });
  w.demander = (q, ip, h) => w.chat.repondre({ q, h }, ip || IP);
  w.journal = (j) => Object.values(w.F.lire('chat_journal/' + (j || JOUR)) || {});
  return w;
}

// ── LA BASE ───────────────────────────────────────────────────────────────
test('la base embarquée est celle des pages et de tarifs.json d’aujourd’hui (sinon : node scripts/base-chat.mjs)', () => {
  const md = baseFraiche();
  assert.equal(BASE, md, 'cloudflare/src/base-chat.js en retard');
  assert.equal(readFileSync(new URL('../src/base-chat.js', import.meta.url), 'utf8'), enJs(md));
  assert.equal(readFileSync(new URL('../../docs/base-chat.md', import.meta.url), 'utf8'), md);
  const e = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')) + ' €';
  for (const p of [T.essentielle.mois, T.essentielle.an, T.ultime.mois, T.ultime.an, T.coaching.coaching_evolution.prix, T.coaching.programme_perso.prix])
    assert.ok(md.includes(e(p)), 'prix absent : ' + e(p));
  assert.ok(faqDe(readFileSync(new URL('../../index.html', import.meta.url), 'utf8')).length >= 5, 'la FAQ est lue');
  assert.ok(/Un ami m'a invité/.test(md) && /Droit de rétractation/.test(md), 'FAQ et CGV présentes');
  assert.ok(!/BROUILLON|Point bloquant|Avertissement destiné à l'éditeur/.test(md), 'les avertissements de brouillon n’y sont pas');
});

test('le prompt système : la base seule, français, 80 mots, ni santé ni promesse, essai ou Kevin, marqueurs de refus', () => {
  const s = C.systeme('BASE-X');
  for (const x of ['UNIQUEMENT à partir de la BASE', 'en français', '80 mots', 'conseil médical', 'promesse de résultat', 'essai gratuit', 'écrire à Kevin', '[HORS_SUJET]', '[INCONNU]', '<base>\nBASE-X\n</base>'])
    assert.ok(s.includes(x), x);
});

// ── PURES ─────────────────────────────────────────────────────────────────
test('le journal est anonymisé : e-mail, téléphone, lien masqués', () => {
  assert.equal(C.anonymiser('Je suis julie.d@gmail.com, 06 12 34 56 78, voir https://x.fr/a'), 'Je suis [e-mail], [numéro], voir [lien]');
  assert.equal(C.anonymiser('x'.repeat(900)).length, 300);
  assert.equal(C.nettoyer('  a\n\tb  '), 'a b');
});
test('la réponse : hors sujet et inconnu remplacés par le serveur, 80 mots au plus', () => {
  assert.deepEqual(C.verdict('[HORS_SUJET]'), { cat: 'hors_sujet', texte: C.TEXTES.hors_sujet });
  assert.deepEqual(C.verdict(' [INCONNU] '), { cat: 'manquante', texte: C.TEXTES.manquante });
  assert.equal(C.verdict('').cat, 'indispo');
  const long = C.verdict(Array.from({ length: 120 }, (_, i) => 'mot' + i).join(' '));
  assert.equal(long.texte.split(' ').length, 80);
  assert.ok(long.texte.endsWith('…'));
  assert.equal(C.verdict('**Oui**, sans carte.').texte, 'Oui, sans carte.');
});
test('l’historique : borné, alterné, commence par l’utilisateur, finit avant la question', () => {
  const h = C.historique([{ r: 'a', t: 'bonjour' }, { r: 'u', t: 'prix ?' }, { r: 'a', t: '9,50 €' }, { r: 'u', t: 'et l’an ?' }, { r: 'x', t: 'pirate' }]);
  assert.deepEqual(h, [{ role: 'user', content: 'prix ?' }, { role: 'assistant', content: '9,50 €' }]);
  assert.equal(C.historique(Array.from({ length: 30 }, (_, i) => ({ r: i % 2 ? 'a' : 'u', t: 'm' + i }))).length <= C.HISTO_MAX, true);
});
test('le coût : les jetons facturés, au prix de Claude Haiku 5.5', () => {
  assert.equal(C.coutMicro({ input_tokens: 1e6 }), 100000);           // 0,10 $
  assert.equal(C.coutMicro({ output_tokens: 1e6 }), 500000);          // 0,50 $
  assert.equal(C.coutMicro({ cache_read_input_tokens: 1e6 }), 10000);
  assert.equal(C.coutMicro({ cache_creation_input_tokens: 1e6 }), 125000);
  assert.equal(C.budgetMicro({}), 10e6);
  assert.equal(C.budgetMicro({ CHAT_BUDGET_USD: '4,5' }), 4.5e6);
});

// ── LE PARCOURS ───────────────────────────────────────────────────────────
test('une question : Claude Haiku 5.5, sans réflexion, prompt en cache ; deux actions ; journal sans IP', async () => {
  const w = monde();
  const r = await w.demander('Combien de temps dure l’essai ? Mon mail : a@b.fr');
  assert.equal(r.statut, 200);
  assert.equal(r.corps.cat, 'ok');
  assert.match(r.corps.texte, /1 mois/);
  assert.deepEqual(r.corps.actions.map((a) => a.lib), ['Essayer gratuitement', 'Écrire à Kevin']);
  assert.equal(r.corps.restant, 9);
  const a = w.appels[0].corps;
  assert.equal(a.model, 'claude-haiku-5-5');
  assert.deepEqual(a.thinking, { type: 'disabled' });
  assert.deepEqual(a.output_config, { effort: 'low' });
  assert.equal(a.max_tokens, 300);
  assert.deepEqual(a.system[0].cache_control, { type: 'ephemeral' });
  assert.ok(a.system[0].text.includes(BASE));
  assert.equal(a.messages.at(-1).role, 'user');
  const j = w.journal();
  assert.equal(j.length, 1);
  assert.equal(j[0].cat, 'ok');
  assert.equal(j[0].q, 'Combien de temps dure l’essai ? Mon mail : [e-mail]');
  assert.ok(!JSON.stringify(w.F.lire('')).includes(IP), 'l’adresse IP n’est écrite nulle part');
  assert.ok(!JSON.stringify(w.F.lire('')).includes('a@b.fr'), 'l’e-mail n’est écrit nulle part');
  const st = w.F.lire('stats/chat/' + MOIS);
  assert.equal(st.messages, 1);
  assert.equal(st.coutMicro, C.coutMicro({ input_tokens: 40, output_tokens: 60, cache_read_input_tokens: 5000 }));
});

test('HORS SUJET : le refus fixe du serveur, noté au journal', async () => {
  const w = monde(null, { texte: '[HORS_SUJET]' });
  const r = await w.demander('Écris-moi un poème sur la mer');
  assert.equal(r.corps.cat, 'hors_sujet');
  assert.equal(r.corps.texte, C.TEXTES.hors_sujet);
  assert.equal(r.corps.actions.length, 2, 'les actions restent');
  assert.equal(w.journal()[0].cat, 'hors_sujet');
  // Un refus de sécurité du modèle compte aussi comme hors sujet.
  const w2 = monde(null, { stop: 'refusal', texte: '' });
  assert.equal((await w2.demander('...')).corps.cat, 'hors_sujet');
});

test('RÉPONSE MANQUANTE : renvoyée vers Kevin, et notée pour le rapport', async () => {
  const w = monde(null, { texte: '[INCONNU]' });
  const r = await w.demander('Est-ce que RepCore marche sur Apple Watch ?');
  assert.equal(r.corps.cat, 'manquante');
  assert.match(r.corps.texte, /Kevin/);
  assert.equal(w.journal()[0].cat, 'manquante');
});

test('PLAFOND : 10 messages par visiteur et par jour ; un autre visiteur passe ; le lendemain repart', async () => {
  const w = monde();
  for (let i = 0; i < 10; i++) assert.equal((await w.demander('q' + i)).corps.cat, 'ok');
  const r = await w.demander('q11');
  assert.equal(r.corps.cat, 'plafond');
  assert.equal(r.corps.texte, C.TEXTES.plafond_visiteur);
  assert.equal(w.appels.length, 10, 'le 11e n’appelle pas le modèle');
  assert.equal((await w.demander('autre', '198.51.100.2')).corps.cat, 'ok');
  assert.equal(w.F.lire('chat_jour/' + JOUR + '/conversations'), 2);
  w.t = T0 + 864e5;
  assert.equal((await w.demander('demain')).corps.cat, 'ok');
});

test('PLAFOND : 300 conversations par jour ; les conversations commencées continuent', async () => {
  const w = monde();
  assert.equal((await w.demander('déjà là')).corps.cat, 'ok');
  w.F.ecrire('chat_jour/' + JOUR + '/conversations', 300);
  const r = await w.demander('nouveau', '198.51.100.9');
  assert.equal(r.corps.cat, 'plafond');
  assert.equal(r.corps.texte, C.TEXTES.plafond_jour);
  assert.equal(w.appels.length, 1);
  assert.equal((await w.demander('suite')).corps.cat, 'ok', 'le visiteur déjà en conversation continue');
  const q = w.F.lire('chat_quota/' + JOUR) || {};
  assert.ok(Object.values(q).every((n) => n !== 0), 'pas de quota fantôme pour le refusé');
});

test('BUDGET : atteint, l’assistant se coupe (FAQ) sans appeler le modèle ; sans clé, fermé', async () => {
  const w = monde({ stats: { chat: { [MOIS]: { coutMicro: 10e6 } } } });
  const r = await w.demander('prix ?');
  assert.equal(r.corps.cat, 'plafond');
  assert.ok(r.corps.texte.includes(C.URL_FAQ));
  assert.equal(w.appels.length, 0);
  assert.deepEqual(await w.chat.etat(), { ouvert: false });
  const w2 = monde({ stats: { chat: { [MOIS]: { coutMicro: 1 } } } }, { budget: '5' });
  assert.deepEqual(await w2.chat.etat(), { ouvert: true });
  const w3 = monde(null, { cle: '' });
  assert.deepEqual(await w3.chat.etat(), { ouvert: false });
  assert.equal((await w3.demander('prix ?')).corps.cat, 'indispo');
  assert.equal(w3.appels.length, 0);
});

test('MODÈLE INDISPONIBLE (529, 429, réseau) : la réponse renvoie vers la FAQ, la panne est notée sans message', async () => {
  for (const panne of [529, 429, 'reseau']) {
    const w = monde(null, { panne });
    const r = await w.demander('Comment résilier ?');
    assert.equal(r.statut, 200, String(panne));
    assert.equal(r.corps.cat, 'indispo');
    assert.ok(r.corps.texte.includes(C.URL_FAQ), 'renvoi vers la FAQ');
    assert.equal(r.corps.actions.length, 2);
    assert.equal(w.journal()[0].cat, 'indispo');
    const d = w.F.lire('worker/chat/dernier');
    assert.equal(d.statut, panne === 'reseau' ? 0 : panne);
    assert.ok(w.appels.length <= 2, 'une seule nouvelle tentative');
    assert.equal(w.F.lire('stats/chat/' + MOIS), null, 'rien n’est facturé');
  }
});

test('une question vide est refusée', async () => {
  const w = monde();
  assert.equal((await w.demander('   ')).statut, 400);
  assert.equal(w.appels.length, 0);
});

// ── LE RAPPORT DU LUNDI, LA PURGE ─────────────────────────────────────────
test('le résumé : questions fréquentes (même forme), réponses manquantes', () => {
  const r = C.resumeSemaine([{ q: 'Combien coûte Ultime ?', cat: 'ok' }, { q: 'combien coute ultime', cat: 'ok' }, { q: 'Apple Watch ?', cat: 'manquante' },
    { q: 'apple watch', cat: 'manquante' }, { q: 'Poème ?', cat: 'hors_sujet' }]);
  assert.equal(r.total, 5);
  assert.deepEqual(r.parCat, { ok: 2, manquante: 2, hors_sujet: 1 });
  assert.deepEqual(r.frequentes.map((x) => x.n), [2, 2]);
  assert.deepEqual(r.manquantes, [{ q: 'Apple Watch ?', n: 2 }]);
});

test('le rapport du lundi : la semaine d’avant, enregistrée, poussée à Kevin et envoyée par e-mail (échappée)', async () => {
  const j = (d) => new Date(T0 - d * 864e5).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
  const w = monde({ chat_journal: {
    [j(1)]: { a: { q: 'Apple <b>Watch</b> ?', cat: 'manquante', t: 1 }, b: { q: 'prix ultime', cat: 'ok', t: 1 } },
    [j(3)]: { c: { q: 'Apple <b>Watch</b> ?', cat: 'manquante', t: 1 }, d: { q: 'Prix Ultime ?', cat: 'ok', t: 1 } },
    [j(9)]: { e: { q: 'trop vieux', cat: 'ok', t: 1 } } },
    chat_jour: { [j(1)]: { conversations: 3 } }, stats: { chat: { [MOIS]: { coutMicro: 123456 } } } });
  let envoi = null;
  const r = await w.chat.rapportLundi(async (o) => { envoi = o; return 'envoye'; });
  assert.deepEqual(r, { total: 4, email: 'envoye' });
  const s = w.F.lire('rapports/lundi/' + JOUR).chat;
  assert.equal(s.conversations, 3);
  assert.equal(s.manquantes[0].n, 2);
  assert.equal(w.pushs[0].cle, 'guellec,coachingpro@gmail,com');
  assert.match(w.pushs[0].p.title, /4 questions/);
  assert.equal(envoi.email, 'guellec.coachingpro@gmail.com');
  assert.ok(envoi.html.includes('Apple &lt;b&gt;Watch&lt;/b&gt;'), 'échappé');
  assert.ok(!envoi.html.includes('trop vieux'), 'hors de la semaine');
  assert.ok(envoi.html.includes('0.12 $'));
});

test('la purge : les quotas d’hier, le journal au-delà de 60 jours', async () => {
  const w = monde({ chat_quota: { [JOUR]: { a: 1 }, '2026-10-11': { b: 2 } },
    chat_journal: { [JOUR]: { x: { q: 'a' } }, '2026-08-01': { y: { q: 'b' } } }, chat_jour: { '2026-08-01': { conversations: 1 } } });
  await w.chat.purger();
  assert.ok(w.F.lire('chat_quota/' + JOUR));
  assert.equal(w.F.lire('chat_quota/2026-10-11'), null);
  assert.ok(w.F.lire('chat_journal/' + JOUR));
  assert.equal(w.F.lire('chat_journal/2026-08-01'), null);
  assert.equal(w.F.lire('chat_jour/2026-08-01'), null);
});
