// Les alternatives à la résiliation : pause d'un mois, reprise, Essentielle,
// motif compté, reconquête à J+30. Base en mémoire, faux PayPal.
//   node cloudflare/test/alternatives.test.mjs
import assert from 'node:assert/strict';
import { creerBase } from '../src/base.js';
import { creerMetier } from '../src/metier.js';
import { creerPaypal, recevoirWebhook } from '../src/paypal.js';
import { alternativesResiliation, motifCle, planEssentielleDe, remiseAnnuelle, messageReconquete, reconqueteDue,
  MOTIFS_RESILIATION, PLAN_ESSENTIELLE_MENSUEL } from '../src/alternatives.js';
import { travaux } from '../src/planif.js';
import { fausseBase } from './fausse-base.mjs';
import { fauxBrevo } from './faux-brevo.mjs';
import TARIFS from '../../tarifs.json' with { type: 'json' };
import { readFileSync } from 'node:fs';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const J = 864e5;
const T0 = Date.parse('2026-10-11T10:00:00+02:00');
const ULT_M = 'P-2W777608239063532NK2LZXA';
const CLE = 'lea@t,fr', ABO = 'I-MEN12345678';

function monde(initial, o) {
  const F = fausseBase(initial);
  const opt = o || {};
  const w = { F, t: T0, abos: opt.abonnements || {}, appels: [], pushs: [], refus: opt.refus || {}, B: fauxBrevo({ listes: [{ id: 31, name: 'Reconquête' }, { id: 42, name: 'Renouvellement' }] }) };
  w.sio = w.B.appels;
  const fetchImpl = async (url, init) => {
    const u = String(url);
    if (u.endsWith('/v1/oauth2/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'tok', expires_in: 32400 }) };
    if (u.endsWith('/v1/notifications/verify-webhook-signature')) return { ok: true, status: 200, json: async () => ({ verification_status: 'SUCCESS' }) };
    const ecr = u.match(/\/v1\/billing\/subscriptions\/(I-[A-Z0-9]+)\/(suspend|activate|revise)$/);
    if (ecr) {
      const [, id, quoi] = ecr;
      w.appels.push(quoi + ' ' + id);
      if (w.refus[quoi]) return { ok: false, status: w.refus[quoi], json: async () => ({}) };
      const s = w.abos[id];
      if (quoi === 'suspend') s.status = 'SUSPENDED';
      if (quoi === 'activate') s.status = 'ACTIVE';
      if (quoi === 'revise') return { ok: true, status: 200, json: async () => ({ plan_id: JSON.parse(init.body).plan_id, links: [{ rel: 'approve', href: 'https://www.paypal.com/webapps/billing/subscriptions/update?ba_token=X' }] }) };
      return { ok: true, status: 204, json: async () => null };
    }
    const m = u.match(/\/v1\/billing\/subscriptions\/(I-[A-Z0-9]+)$/);
    if (m) { const s = w.abos[m[1]]; return s ? { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(s)) } : { ok: false, status: 404, json: async () => ({}) }; }
    if (w.B.gere(u)) return w.B.fetch(url, init);
    return F.fetchImpl(url, init);
  };
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl });
  const M = creerMetier({ db, fetchImpl, maintenant: () => w.t });
  M.envoyerPush = async (uid, message, oo) => { w.pushs.push({ uid, message, oo }); return opt.plafond ? { envoye: 0, raison: 'plafond' } : { envoye: 1 }; };
  const env = Object.assign({ PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'sec', PAYPAL_WEBHOOK_ID: 'wh' }, opt.env || {});
  w.ctx = { db, M, env, fetchImpl, maintenant: () => w.t };
  w.PP = creerPaypal(w.ctx);
  M.paypal = w.PP;
  w.M = M;
  w.appel = (data, email) => w.PP.appelAbonnement({ auth: { email: email || 'lea@t.fr' }, data });
  w.webhook = async (e) => (await recevoirWebhook(new Request('https://s.t/paypal', { method: 'POST', body: JSON.stringify(e) }), w.ctx)).text();
  return w;
}
const sub = (plan, plus) => Object.assign({ id: ABO, status: 'ACTIVE', plan_id: plan, custom_id: CLE,
  billing_info: { next_billing_time: new Date(T0 + 12 * J).toISOString(), last_payment: { time: new Date(T0 - 18 * J).toISOString() } } }, plus || {});
const lea = (a, plus) => ({ [CLE]: Object.assign({ role: 'athlete', status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active', paypalSubscriptionId: ABO,
  fname: 'Léa', email: 'lea@t.fr', abonnement: Object.assign({ palier: 'mensuel', formule: 'ultime' }, a || {}) }, plus || {}) });

await test('PURE alternativesResiliation : pause pour un mensuel, Essentielle pour un Ultime ; rien sous engagement, après résiliation ou en pause', async () => {
  const u = (a, plus) => Object.assign({ role: 'athlete', paypalSubscriptionId: ABO, abonnement: Object.assign({ palier: 'mensuel', formule: 'ultime' }, a) }, plus);
  assert.deepEqual(alternativesResiliation(u({}), T0), { pause: true, essentielle: true });
  assert.deepEqual(alternativesResiliation(u({ formule: 'essentielle' }), T0), { pause: true, essentielle: false });
  assert.deepEqual(alternativesResiliation(u({ palier: 'annuel' }), T0), { pause: false, essentielle: true });
  assert.deepEqual(alternativesResiliation(u({ engagementJusqu: T0 + J }), T0), { pause: false, essentielle: false });
  assert.deepEqual(alternativesResiliation(u({ engagementJusqu: T0 - J }), T0), { pause: true, essentielle: true });     // terme échu
  assert.deepEqual(alternativesResiliation(u({ resiliationDemandee: { ts: 1, motif: '' } }), T0), { pause: false, essentielle: false });
  assert.deepEqual(alternativesResiliation(u({ pause: { reprise: T0 + J } }), T0), { pause: false, essentielle: false });
  assert.deepEqual(alternativesResiliation(u({}, { role: 'coach' }), T0), { pause: false, essentielle: false });
  assert.deepEqual(alternativesResiliation(u({}, { paypalSubscriptionId: '' }), T0), { pause: false, essentielle: false });
});

await test('PURE motifs, plans, remise, message : le menu de l’app, rien d’inventé', async () => {
  // Le menu du worker EST celui de l'app (RESIL_MOTIFS, rc-core).
  const src = readFileSync(new URL('../../app/' + readFileSync(new URL('../../app/index.html', import.meta.url), 'utf8').match(/rc-core\.\d+\.js/)[0], import.meta.url), 'utf8');
  const menu = src.match(/const RESIL_MOTIFS=Object\.freeze\(\[([^\]]+)\]\)/)[1].split(/',\s*'/).map((x) => x.replace(/^\s*'|'\s*$/g, '').replace(/\\'/g, '\''));
  assert.deepEqual(MOTIFS_RESILIATION.map((x) => x.lib), menu);
  assert.equal(motifCle('Trop cher'), 'trop_cher');
  assert.equal(motifCle(''), 'sans_reponse');
  assert.equal(motifCle('Trop cher : je paie déjà une salle'), 'autre');   // le texte libre n'est jamais une clé
  assert.equal(planEssentielleDe(ULT_M), PLAN_ESSENTIELLE_MENSUEL);
  assert.equal(planEssentielleDe('P-2NY44820N2546090CNLET2VQ'), 'P-5WS33005ML186714UNLET2VI');
  assert.equal(planEssentielleDe(PLAN_ESSENTIELLE_MENSUEL), null);
  assert.equal(remiseAnnuelle(TARIFS.ultime), '2 mois offerts');
  assert.equal(remiseAnnuelle({ mois: 10, an: 120 }), '');
  const m = messageReconquete({ prenom: 'Léa', seances: 42, tonnageKg: 84300, tarif: TARIFS.ultime });
  assert.equal(m.title, 'Léa, ta place est toujours là');
  assert.equal(m.body, '42 séances et 84,3 t soulevées : tout est gardé. Ultime à l’année : 249 €, soit 2 mois offerts.');
  assert.equal(m.url, './?abonnement=1');
  const v = messageReconquete({ seances: 0, tarif: TARIFS.ultime });
  assert.doesNotMatch(v.body, /séance|soulev/);
  assert.equal(reconqueteDue(T0 - 29 * J, T0).due, false);
  assert.equal(reconqueteDue(T0 - 30 * J, T0).due, true);
  assert.equal(reconqueteDue(T0 - 38 * J, T0).perimee, true);
});

await test('PAUSE : suspend chez PayPal, reprise notée à J+30, journal ; le webhook SUSPENDED garde l’accès jusqu’à la fin payée', async () => {
  const w = monde({ users: lea() }, { abonnements: { [ABO]: sub(ULT_M) } });
  const r = await w.appel({ action: 'pause' });
  assert.equal(r.ok, true);
  assert.deepEqual(w.appels, ['suspend ' + ABO]);
  assert.equal(r.pause.reprise, T0 + 30 * J);
  assert.equal(w.F.lire('pauses/' + CLE).reprise, T0 + 30 * J);
  assert.equal(w.F.lire('users/' + CLE + '/abonnement/pause/reprise'), T0 + 30 * J);
  const j = Object.values(w.F.lire('paypal_journal'));
  assert.equal(j[0].type, 'pause');
  // PayPal prévient : l'accès court jusqu'à la prochaine échéance (déjà payée).
  await w.webhook({ id: 'WH-1', event_type: 'BILLING.SUBSCRIPTION.SUSPENDED', resource: { id: ABO } });
  assert.equal(w.F.lire('users/' + CLE + '/accessExpiry'), T0 + 12 * J);
  // Une seconde pause est refusée.
  assert.equal((await w.appel({ action: 'pause' })).raison, 'non_eligible');
});

await test('REPRISE AUTOMATIQUE à la date : activate, accès rouvert, push ; rien avant la date', async () => {
  const w = monde({ users: lea() }, { abonnements: { [ABO]: sub(ULT_M) } });
  await w.appel({ action: 'pause' });
  await w.webhook({ id: 'WH-2', event_type: 'BILLING.SUBSCRIPTION.SUSPENDED', resource: { id: ABO } });
  w.t = T0 + 29 * J;
  assert.deepEqual(await w.PP.reprisesQuotidien(w.t), {});
  w.t = T0 + 30 * J + 3600e3;
  const b = await w.PP.reprisesQuotidien(w.t);
  assert.equal(b[CLE], 'repris');
  assert.deepEqual(w.appels, ['suspend ' + ABO, 'activate ' + ABO]);
  assert.equal(w.F.lire('users/' + CLE + '/accessExpiry'), null);
  assert.equal(w.F.lire('users/' + CLE + '/abonnement/finAccesPaypal'), null);
  assert.equal(w.F.lire('users/' + CLE + '/abonnement/pause'), null);
  assert.equal(w.F.lire('pauses/' + CLE), null);
  assert.equal(w.pushs[0].message.title, 'Ton abonnement reprend aujourd’hui');
  assert.ok(Object.values(w.F.lire('paypal_journal')).some((x) => x.type === 'reprise'));
});

await test('REPRISE ANTICIPÉE à la demande ; et une RÉSILIATION pendant la pause gagne : rien n’est réactivé', async () => {
  const w = monde({ users: lea() }, { abonnements: { [ABO]: sub(ULT_M) } });
  await w.appel({ action: 'pause' });
  assert.equal((await w.appel({ action: 'reprendre' })).ok, true);
  assert.equal(w.appels.pop(), 'activate ' + ABO);
  assert.equal(w.pushs.length, 0);                       // elle l'a demandé : pas de notification
  const w2 = monde({ users: lea() }, { abonnements: { [ABO]: sub(ULT_M) } });
  await w2.appel({ action: 'pause' });
  await w2.F.ecrire('users/' + CLE + '/abonnement/resiliationDemandee', { ts: T0 + J, motif: '' });
  w2.t = T0 + 31 * J;
  const b = await w2.PP.reprisesQuotidien(w2.t);
  assert.equal(b[CLE], 'resiliee');
  assert.deepEqual(w2.appels, ['suspend ' + ABO]);
});

await test('REFUS : un annuel, un contrat engagé, l’abonnement d’un autre, PayPal en panne → rien de posé', async () => {
  const a = monde({ users: lea({ palier: 'annuel' }) }, { abonnements: { [ABO]: sub(ULT_M) } });
  assert.equal((await a.appel({ action: 'pause' })).raison, 'non_eligible');
  const e = monde({ users: lea({ engagementJusqu: T0 + 100 * J }) }, { abonnements: { [ABO]: sub(ULT_M) } });
  assert.equal((await e.appel({ action: 'pause' })).raison, 'non_eligible');
  const x = monde({ users: lea() }, { abonnements: { [ABO]: sub(ULT_M, { custom_id: 'autre@t,fr' }) } });
  assert.equal((await x.appel({ action: 'pause' })).raison, 'autre_compte');
  const p = monde({ users: lea() }, { abonnements: { [ABO]: sub(ULT_M) }, refus: { suspend: 500 } });
  assert.equal((await p.appel({ action: 'pause' })).raison, 'paypal_500');
  assert.equal(p.F.lire('pauses/' + CLE), null);
  assert.equal(p.F.lire('users/' + CLE + '/abonnement/pause'), null);
  for (const v of [a, e, x]) assert.deepEqual(v.appels, []);
});

await test('ESSENTIELLE : revise vers le bon plan, lien d’accord PayPal ; au retour, le changement est noté', async () => {
  const w = monde({ users: lea() }, { abonnements: { [ABO]: sub(ULT_M) } });
  const r = await w.appel({ action: 'essentielle' });
  assert.equal(r.ok, true);
  assert.match(r.approuver, /^https:\/\/www\.paypal\.com\//);
  assert.deepEqual(w.appels, ['revise ' + ABO]);
  assert.equal((await w.appel({ action: 'verifier_essentielle' })).raison, 'pas_encore');
  w.abos[ABO].plan_id = PLAN_ESSENTIELLE_MENSUEL;            // la personne a validé chez PayPal
  const v = await w.appel({ action: 'verifier_essentielle' });
  assert.equal(v.ok, true);
  assert.equal(w.F.lire('users/' + CLE + '/abonnement/changement/vers'), 'essentielle');
  const e = monde({ users: lea({ formule: 'essentielle' }) }, { abonnements: { [ABO]: sub(PLAN_ESSENTIELLE_MENSUEL) } });
  assert.equal((await e.appel({ action: 'essentielle' })).raison, 'non_eligible');
});

await test('MOTIF : compté par mois sous sa clé, une fois par résiliation ; jamais sans demande enregistrée', async () => {
  const w = monde({ users: lea({ resiliationDemandee: { ts: 111, motif: 'Trop cher : la salle me suffit' } }) }, { abonnements: { [ABO]: sub(ULT_M) } });
  assert.equal((await w.appel({ action: 'resiliation', ts: 111, motif: 'Trop cher' })).motif, 'trop_cher');
  assert.equal((await w.appel({ action: 'resiliation', ts: 111, motif: 'Trop cher' })).raison, 'deja');
  assert.deepEqual(w.F.lire('stats/resiliations/2026-10'), { trop_cher: 1 });
  assert.equal(w.F.lire('reconquete/' + CLE).ts, 111);
  assert.equal((await w.appel({ action: 'resiliation', ts: 999, motif: 'Autre' })).raison, 'aucune_demande');
  const s = monde({ users: lea({ resiliationDemandee: { ts: 5, motif: '' } }) }, { abonnements: { [ABO]: sub(ULT_M) } });
  await s.appel({ action: 'resiliation', ts: 5, motif: '' });
  assert.deepEqual(s.F.lire('stats/resiliations/2026-10'), { sans_reponse: 1 });
});

await test('RECONQUÊTE J+30 : push avec l’historique réel et l’offre de tarifs.json ; liste Brevo seulement avec accord ; revenu → rien', async () => {
  const base = (consent) => lea({ resiliationDemandee: { ts: 7, motif: '' } }, { tonnageTotal: 12500, sessions: [{ date: 1 }, { date: 2 }, { date: 3 }],
    consentements: consent ? { email: { accepte: true, le: 1 } } : undefined });
  const env = { BREVO_API_KEY: 'k', BREVO_LISTE_RECONQUETE: '31', BREVO_LISTE_RENOUVELLEMENT: '42' };
  const w = monde({ users: base(true), reconquete: { [CLE]: { ts: 7, le: T0, abo: ABO } } }, { abonnements: { [ABO]: sub(ULT_M) }, env });
  w.t = T0 + 20 * J;
  assert.equal((await w.PP.reconqueteQuotidien(w.t))[CLE], 'pas_encore');
  w.t = T0 + 30 * J;
  assert.equal((await w.PP.reconqueteQuotidien(w.t))[CLE], 'envoye');
  assert.equal(w.pushs[0].message.body, '3 séances et 12,5 t soulevées : tout est gardé. Ultime à l’année : 249 €, soit 2 mois offerts.');
  assert.equal(w.pushs[0].message.type, 'reconquete');
  assert.deepEqual(w.sio, ['POST /contacts', 'POST /contacts/lists/:id/contacts/remove', 'POST /contacts/lists/:id/contacts/add']);
  assert.deepEqual(w.B.listes[0].membres, ['lea@t.fr']);
  assert.equal(w.F.lire('reconquete/' + CLE), null);
  // Sans accord : pas d'e-mail ; sans liste configurée : JAMAIS celle du renouvellement.
  const n = monde({ users: base(false), reconquete: { [CLE]: { ts: 7, le: T0, abo: ABO } } }, { abonnements: { [ABO]: sub(ULT_M) }, env });
  n.t = T0 + 30 * J; await n.PP.reconqueteQuotidien(n.t);
  assert.deepEqual(n.sio, []);
  const t = monde({ users: base(true), reconquete: { [CLE]: { ts: 7, le: T0, abo: ABO } } }, { abonnements: { [ABO]: sub(ULT_M) }, env: { BREVO_API_KEY: 'k', BREVO_LISTE_RENOUVELLEMENT: '42' } });
  t.t = T0 + 30 * J; await t.PP.reconqueteQuotidien(t.t);
  assert.deepEqual(t.sio, []);
  assert.deepEqual(t.B.listes[1].membres, []);
  // Revenue entre-temps (plus de résiliation) : rien.
  const r = monde({ users: lea(), reconquete: { [CLE]: { ts: 7, le: T0, abo: ABO } } }, { abonnements: { [ABO]: sub(ULT_M) } });
  r.t = T0 + 30 * J;
  assert.equal((await r.PP.reconqueteQuotidien(r.t))[CLE], 'revenu');
  assert.equal(r.pushs.length, 0);
  // Plafond du jour pris : gardée pour demain.
  const p = monde({ users: base(false), reconquete: { [CLE]: { ts: 7, le: T0, abo: ABO } } }, { abonnements: { [ABO]: sub(ULT_M) }, plafond: true });
  p.t = T0 + 30 * J;
  assert.equal((await p.PP.reconqueteQuotidien(p.t))[CLE], 'plafond');
  assert.ok(p.F.lire('reconquete/' + CLE));
});

await test('planif : reprises à 9 h 10, reconquête à 12 h (Paris)', async () => {
  const L = travaux({ planifies: {} });
  const rp = L.find((x) => x.nom === 'reprises'), rc = L.find((x) => x.nom === 'reconquete');
  assert.ok(rp.quand({ heure: 9, minute: 10 }) && !rp.quand({ heure: 9, minute: 9 }));
  assert.ok(rc.quand({ heure: 12, minute: 0 }) && !rc.quand({ heure: 11, minute: 59 }) && !rc.quand({ heure: 21, minute: 0 }));
});

console.log('\n' + ok + ' tests verts (alternatives à la résiliation).');
