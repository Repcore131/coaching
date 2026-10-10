// La fin d'essai : J-3, J-1, J0 à 18 h 30, avec les vrais chiffres de l'essai.
//   node cloudflare/test/finessai.test.mjs
import assert from 'node:assert/strict';
import { creerBase } from '../src/base.js';
import { creerFinEssai, palierFinEssai, texteFinEssai } from '../src/finessai.js';
import { travaux } from '../src/planif.js';
import { fausseBase } from './fausse-base.mjs';
import { fauxBrevo } from './faux-brevo.mjs';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const J = 864e5;
// Vendredi 10 octobre 2026, 18 h 30 à Paris.
const T0 = Date.parse('2026-10-10T16:30:00Z');
const finDans = (n) => Date.parse('2026-10-10T22:00:00Z') + (n - 1) * J + 3 * 3600e3; // le jour n, vers 3 h du matin à Paris

function monde(initial, o) {
  const opt = o || {};
  const F = fausseBase(initial);
  const B = fauxBrevo({});
  const sio = B.appels;
  const fetchImpl = async (url, init) => {
    const u = String(url);
    if (B.gere(u)) return B.fetch(url, init);
    return F.fetchImpl(url, init);
  };
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl });
  const pushs = [];
  const M = { planifies: {}, envoyerPush: async (uid, m, oo) => { pushs.push({ uid, m, oo }); return { envoye: opt.sansTel ? 0 : 1, raison: opt.sansTel ? 'aucun_abonnement' : null }; } };
  const FE = creerFinEssai({ db, M, env: opt.env || {}, fetchImpl, maintenant: () => T0 });
  M.finEssai = FE;
  return { F, FE, M, pushs, sio, B };
}
const act = (fin, essai, plus) => Object.assign({ v: 1, inscrit: '2026-09-12', sem: '2026-09-07', src: 'direct', jour: '2026-10-10',
  j30: '0'.repeat(30), finEssai: fin, payant: false }, essai ? { essai } : {}, plus || {});

await test('PURE palierFinEssai : jours de calendrier à Paris (3, 1, 0), rien entre', async () => {
  assert.equal(palierFinEssai(finDans(3), T0), 'j3');
  assert.equal(palierFinEssai(finDans(2), T0), null);
  assert.equal(palierFinEssai(finDans(1), T0), 'j1');
  assert.equal(palierFinEssai(Date.parse('2026-10-10T21:30:00Z'), T0), 'j0');   // 23 h 30 à Paris, le jour même
  assert.equal(palierFinEssai(finDans(4), T0), null);
  assert.equal(palierFinEssai(0, T0), null);
});

await test('PURE texteFinEssai : les vrais chiffres avec séances, aucun chiffre sans', async () => {
  const a = texteFinEssai({ palier: 'j3', prenom: 'Léa', essai: { s: 12, r: 3, t: 8400, w: 4 } });
  assert.equal(a.title, '12 séances, 3 records : on continue ?');
  assert.match(a.body, /^Léa, ton essai se termine dans 3 jours\./);
  assert.equal(texteFinEssai({ palier: 'j1', essai: { s: 1, r: 0 } }).title, '1 séance : on continue ?');
  const v = texteFinEssai({ palier: 'j3', essai: { s: 0, r: 0 } });
  assert.equal(v.title, 'Ton essai se termine dans 3 jours');
  assert.doesNotMatch(v.title + v.body, /\d+ séance|record/);
  assert.match(texteFinEssai({ palier: 'j0' }).title, /aujourd’hui/);
  const inc = texteFinEssai({ palier: 'j3', prenom: 'Léa' });   // résumé pas encore publié
  assert.doesNotMatch(inc.title + inc.body, /séance|record/);
  assert.match(inc.body, /^Léa, ton programme/);
});

await test('essai AVEC séances, J-3 : notification « 12 séances, 3 records », une seule fois', async () => {
  const w = monde({ activite: { 'lea@t,fr': act(finDans(3), { s: 12, r: 3, t: 8400, w: 4 }) }, users: { 'lea@t,fr': { role: 'athlete', status: 'FREE', fname: 'Léa' } } });
  const b = await w.FE.quotidien(T0);
  assert.deepEqual(b['lea@t,fr'], { palier: 'j3', push: 'oui', mail: 'sans_accord' });
  assert.equal(w.pushs.length, 1);
  assert.equal(w.pushs[0].m.title, '12 séances, 3 records : on continue ?');
  assert.equal(w.pushs[0].m.type, 'acces');
  assert.ok(!w.pushs[0].oo || !w.pushs[0].oo.urgent);          // préférences et plafond respectés
  assert.equal(w.F.lire('worker/fin_essai/lea@t,fr/j3'), finDans(3));
  await w.FE.quotidien(T0);
  assert.equal(w.pushs.length, 1);
});

await test('essai SANS séance, J-1 : le message sans chiffre', async () => {
  const w = monde({ activite: { 'zoe@t,fr': act(finDans(1), { s: 0, r: 0, t: 0, w: 0 }) }, users: { 'zoe@t,fr': { role: 'athlete', status: 'FREE' } } });
  await w.FE.quotidien(T0);
  assert.equal(w.pushs.length, 1);
  assert.equal(w.pushs[0].m.title, 'Ton essai se termine demain');
});

await test('DÉJÀ PAYANT : ni notification ni e-mail (activite.payant ou statut abonné)', async () => {
  const w = monde({
    activite: { 'pay@t,fr': act(finDans(3), { s: 5, r: 1 }, { payant: true }), 'abo@t,fr': act(finDans(3), { s: 5, r: 1 }) },
    users: { 'pay@t,fr': { role: 'athlete', status: 'FREE' }, 'abo@t,fr': { role: 'athlete', status: 'AUTONOMIE_PREMIUM', consentements: { email: { accepte: true, le: 1 } } } },
  }, { env: { BREVO_API_KEY: 'k', BREVO_MODELE_FIN_ESSAI: '12' } });
  const b = await w.FE.quotidien(T0);
  assert.equal(b['pay@t,fr'], 'payant'); assert.equal(b['abo@t,fr'], 'payant');
  assert.equal(w.pushs.length, 0); assert.equal(w.sio.length, 0);
});

await test('J-3 avec accord e-mail : e-mail de fin d’essai (modèle 12, lien de désinscription) ; sans accord ou désinscrit, rien', async () => {
  const env = { BREVO_API_KEY: 'k', BREVO_MODELE_FIN_ESSAI: '12', ADMIN_SECRET: 'sel' };
  const w = monde({ activite: { 'oui@t,fr': act(finDans(3), { s: 2, r: 0 }), 'non@t,fr': act(finDans(3), { s: 2, r: 0 }) },
    users: { 'oui@t,fr': { role: 'athlete', status: 'FREE', email: 'oui@t.fr', consentements: { email: { accepte: true, le: 1 } } }, 'non@t,fr': { role: 'athlete', status: 'FREE' } } }, { env });
  const b = await w.FE.quotidien(T0);
  assert.equal(b['oui@t,fr'].mail, 'envoye');
  assert.equal(b['non@t,fr'].mail, 'sans_accord');
  assert.deepEqual(w.sio, ['POST /smtp/email']);
  assert.equal(w.B.envois[0].templateId, 12);
  assert.match(w.B.envois[0].params.DESINSCRIPTION, /^https:\/\/repcore-serveur\.repcore\.workers\.dev\/desinscription\?e=oui%40t\.fr&s=[A-Za-z0-9_-]{24}$/);
});

await test('sans appareil abonné : rien ne part, le palier est quand même noté (pas de doublon le lendemain)', async () => {
  const w = monde({ activite: { 'x@t,fr': act(finDans(3), { s: 3, r: 0 }) }, users: { 'x@t,fr': { role: 'athlete', status: 'FREE' } } }, { sansTel: true });
  const b = await w.FE.quotidien(T0);
  assert.equal(b['x@t,fr'].push, 'aucun_abonnement');
  assert.equal(w.F.lire('worker/fin_essai/x@t,fr/j3'), finDans(3));
});

await test('les essais hors fenêtre ne sont pas lus ; planif : 18 h 30, heure de Paris', async () => {
  const w = monde({ activite: { 'loin@t,fr': act(finDans(10), { s: 1 }), 'fini@t,fr': act(T0 - 5 * J, { s: 1 }) } });
  assert.deepEqual(await w.FE.quotidien(T0), {});
  const job = travaux(w.M).find((x) => x.nom === 'fin_essai');
  assert.ok(job && job.quand({ heure: 18, minute: 30 }) && !job.quand({ heure: 18, minute: 29 }) && !job.quand({ heure: 21, minute: 0 }));
});

console.log('\n' + ok + ' tests verts (fin d’essai).');
