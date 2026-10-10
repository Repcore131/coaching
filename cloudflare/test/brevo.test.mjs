// Les contacts e-mail vers Brevo : consentement, file, débit, erreurs, guide,
// suppression, listes d'événement.
//   node cloudflare/test/brevo.test.mjs
import assert from 'node:assert/strict';
import { creerBase } from '../src/base.js';
import { creerBrevo, inscrireListe, delaiEssai, aRetenter, emailValide, statutContact, EMAIL_PAR_MINUTE, EMAIL_ESSAIS_MAX, LEAD_PAR_IP_JOUR } from '../src/brevo.js';
import { travaux } from '../src/planif.js';
import { fausseBase } from './fausse-base.mjs';
import { fauxBrevo } from './faux-brevo.mjs';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const T0 = Date.parse('2026-10-11T10:00:00+02:00');
const ENV = { BREVO_API_KEY: 'k', LEAD_OUVERT: 'oui' };
const TOUS = ['PRENOM', 'NOM', 'SOURCE', 'DATE_INSCRIPTION', 'STATUT', 'ECHEANCE', 'MONTANT'];

function monde(initial, o) {
  const opt = o || {};
  const F = fausseBase(initial);
  const B = fauxBrevo({ attributs: opt.attributs || TOUS, listes: opt.listes || [{ id: 7, name: 'RepCore' }], forcer: opt.forcer, dossiers: opt.dossiers });
  const fetchImpl = (url, init) => (B.gere(url) ? B.fetch(url, init) : F.fetchImpl(url, init));
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl });
  const reste = opt.reste === undefined ? Infinity : opt.reste;
  const w = { F, B, t: T0 };
  w.E = creerBrevo({ db, env: opt.env || ENV, fetchImpl, maintenant: () => w.t, reste: () => reste });
  w.minute = () => w.E.minute(w.t);
  w.file = () => w.F.lire('email_file') || {};
  w.fetchImpl = fetchImpl;
  return w;
}
const user = (plus) => Object.assign({ role: 'athlete', status: 'FREE', fname: 'Léa', email: 'lea@t.fr', origine: { src: 'insta' } }, plus || {});
const AVEC = { consentements: { email: { accepte: true, le: T0 } } };

await test('PURE : délais 1, 2, 4… 60 min ; quoi retenter ; e-mail ; statut', async () => {
  assert.deepEqual([1, 2, 3, 4, 7, 12].map((n) => delaiEssai(n) / 60e3), [1, 2, 4, 8, 60, 60]);
  assert.deepEqual([0, 429, 500, 503, 400, 404, 422].map(aRetenter), [true, true, true, true, false, false, false]);
  assert.ok(emailValide('a@b.fr') && !emailValide('a@b') && !emailValide('a b@c.fr') && !emailValide(''));
  assert.equal(statutContact({ status: 'AUTONOMIE_PREMIUM' }), 'payant');
  assert.equal(statutContact({ status: 'FREE' }), 'essai');
});

await test('CONSENTEMENT ABSENT → aucune synchro (le drapeau seul ne suffit pas ; gardé 1 h, puis oublié)', async () => {
  const w = monde({ users: { 'lea@t,fr': user(), 'non@t,fr': user({ email: 'non@t.fr', consentements: { email: { accepte: false, le: T0 } } }) },
    email_optin: { 'lea@t,fr': { le: T0, accepte: true }, 'non@t,fr': { le: T0, accepte: true } } });
  const b = await w.minute();
  assert.deepEqual(b.optins, { 'lea@t,fr': 'sans_consentement', 'non@t,fr': 'sans_consentement' });
  assert.deepEqual(w.B.appels, []);
  assert.deepEqual(w.file(), {});
  assert.ok(w.F.lire('email_optin/lea@t,fr'));
  w.t += 3600e3 + 1;
  await w.minute();
  assert.deepEqual(w.B.appels, []);
  assert.equal(w.F.lire('email_optin'), null);
});

await test('CONSENTEMENT DONNÉ → contact créé dans la liste RepCore, avec PRENOM, SOURCE, DATE_INSCRIPTION, STATUT ; la clé part en en-tête', async () => {
  const w = monde({ users: { 'lea@t,fr': user(AVEC) }, email_optin: { 'lea@t,fr': { le: T0, accepte: true } } });
  const b = await w.minute();
  assert.equal(b.faites, 1);
  const c = w.B.contacts['lea@t.fr'];
  assert.deepEqual(c.attributs, { PRENOM: 'Léa', SOURCE: 'insta', DATE_INSCRIPTION: '2026-10-11', STATUT: 'essai' });
  assert.deepEqual(w.B.listes[0].membres, ['lea@t.fr']);
  assert.ok(w.B.cles.every((x) => x === 'k'));
  // Le paiement : mise à jour (un seul appel, la liste est gardée en mémoire).
  await w.E.contactDuCompte('lea@t,fr', 'payant');
  w.B.appels.length = 0;
  await w.minute();
  assert.deepEqual(w.B.appels, ['POST /contacts']);
  assert.equal(w.B.contacts['lea@t.fr'].attributs.STATUT, 'payant');
  assert.equal(Object.keys(w.B.contacts).length, 1);
});

await test('PRÉPARATION : les attributs manquants sont créés une fois, la liste RepCore aussi si elle n’existe pas', async () => {
  const w = monde({}, { attributs: ['PRENOM', 'NOM'], listes: [{ id: 4, name: 'INFLU 1' }] });
  await w.E.enfiler({ op: 'contact', email: 'a@t.fr', source: 's', date: 'd', statut: 'essai' });
  await w.minute();
  for (const n of ['SOURCE', 'DATE_INSCRIPTION', 'STATUT', 'ECHEANCE', 'MONTANT']) assert.ok(w.B.attributs.has(n), n);
  const l = w.B.listes.find((x) => x.name === 'RepCore');
  assert.ok(l && l.folderId === 1 && l.membres.includes('a@t.fr'));
  assert.equal(w.F.lire('worker/email/prepare'), 'v2');
  w.B.appels.length = 0;
  await w.E.enfiler({ op: 'contact', email: 'b@t.fr' });
  await w.minute();
  assert.deepEqual(w.B.appels, ['POST /contacts']);              // ni préparation ni recherche de liste
});

await test('LIMITE DE DÉBIT : 30 requêtes par minute au plus, même sur deux exécutions ; la suite à la minute d’après', async () => {
  const w = monde({});
  for (let i = 0; i < 40; i++) await w.E.enfiler({ op: 'contact', email: 'x' + i + '@t.fr' });
  await w.minute();
  assert.ok(w.B.appels.length <= EMAIL_PAR_MINUTE, w.B.appels.length + ' appels');
  await w.minute();
  assert.ok(w.B.appels.length <= EMAIL_PAR_MINUTE, 'deuxième exécution : ' + w.B.appels.length);
  const avant = Object.keys(w.file()).length;
  assert.ok(avant > 0);
  w.t += 60e3;
  await w.minute();
  assert.ok(Object.keys(w.file()).length < avant);
  const p = monde({}, { reste: 8 });
  await p.E.enfiler({ op: 'contact', email: 'a@t.fr' });
  await p.minute();
  assert.deepEqual(p.B.appels, []);
});

await test('ERREURS : 5xx et réseau retentés plus tard, 4xx définitif, 429 suspend la file, abandon au 8e échec', async () => {
  const w = monde({}, { forcer: { 'POST /contacts': { statut: 503 } } });
  await w.E.enfiler({ op: 'contact', email: 'a@t.fr' });
  assert.equal((await w.minute()).reportees, 1);
  const op = Object.values(w.file())[0];
  assert.equal(op.essais, 1); assert.equal(op.prochain, T0 + 60e3);
  w.B.appels.length = 0; await w.minute(); assert.deepEqual(w.B.appels, []);   // pas avant l'heure
  for (let i = 0; i < EMAIL_ESSAIS_MAX; i++) { w.t += 3600e3; await w.minute(); }
  assert.deepEqual(w.file(), {});
  assert.equal(Object.values(w.F.lire('email_echecs'))[0].statut, 503);
  const r = monde({}, { forcer: { 'POST /contacts': 'reseau' } });
  await r.E.enfiler({ op: 'contact', email: 'a@t.fr' });
  assert.equal((await r.minute()).reportees, 1);
  const d = monde({}, { forcer: { 'POST /contacts': { statut: 401, corps: { code: 'unauthorized' } } } });
  await d.E.enfiler({ op: 'contact', email: 'a@t.fr' });
  assert.equal((await d.minute()).echecs, 1);
  assert.equal(Object.values(d.F.lire('email_echecs'))[0].etape, 'contact');
  const q = monde({}, { forcer: { 'POST /contacts': { statut: 429, entetes: { 'x-sib-ratelimit-reset': '120' } } } });
  await q.E.enfiler({ op: 'contact', email: 'a@t.fr' }); await q.E.enfiler({ op: 'contact', email: 'b@t.fr' });
  await q.minute();
  assert.equal(q.B.appels.filter((x) => x === 'POST /contacts').length, 1);
  assert.equal(q.F.lire('worker/email/debit/pauseJusqua'), T0 + 120e3);
  q.B.appels.length = 0; q.t += 60e3;
  assert.equal((await q.minute()).etat, 'pause_429');
  assert.deepEqual(q.B.appels, []);
});

await test('ATTRIBUTS REFUSÉS (400) : le contact passe avec le seul prénom, l’échec est noté', async () => {
  const w = monde({}, { forcer: { 'POST /contacts/attributes/normal/:nom': { statut: 403 } } });
  // Préparation refusée : rien ne part, la file attend.
  await w.E.enfiler({ op: 'contact', email: 'a@t.fr', prenom: 'A', source: 'x' });
  assert.match((await w.minute()).etat, /^preparation_403/);
  assert.equal(Object.keys(w.file()).length, 1);
  const v = monde({}, { attributs: ['PRENOM'] });
  await v.F.ecrire('worker/email/prepare', 'v2');                    // préparation « faite », attributs pourtant absents
  await v.E.enfiler({ op: 'contact', email: 'a@t.fr', prenom: 'A', source: 'x', statut: 'essai' });
  await v.minute();
  assert.deepEqual(v.B.contacts['a@t.fr'].attributs, { PRENOM: 'A' });
  assert.equal(Object.values(v.F.lire('email_echecs'))[0].raison, 'attributs_refuses');
  assert.deepEqual(v.file(), {});
});

await test('NON CONFIGURÉ (pas de clé) : rien ne part, la file attend', async () => {
  const w = monde({}, { env: {} });
  await w.E.enfiler({ op: 'contact', email: 'a@t.fr' });
  assert.equal((await w.minute()).etat, 'non_configure');
  assert.deepEqual(w.B.appels, []);
  assert.equal(Object.keys(w.file()).length, 1);
});

await test('GUIDE (/lead) : champ piège, e-mail, accord, 5 par IP et par jour (IP hachée), fermé tant que non ouvert', async () => {
  const w = monde({});
  assert.equal((await w.E.lead({ prenom: 'Zoé', email: 'Zoe@T.fr', accord: true, src: 'tiktok' }, '1.2.3.4')).statut, 200);
  const op = Object.values(w.file())[0];
  assert.deepEqual([op.email, op.prenom, op.source, op.statut], ['zoe@t.fr', 'Zoé', 'guide_tiktok', 'prospect']);
  assert.equal(w.F.lire('leads/zoe@t,fr').texte, 'guide-cycle-v1');
  assert.ok(!JSON.stringify(w.F.lire('lead_ip')).includes('1.2.3.4'));
  assert.deepEqual((await w.E.lead({ email: 'bot@t.fr', accord: true, site: 'http://x' }, '9.9.9.9')).corps, { ok: true });
  assert.equal(Object.keys(w.file()).length, 1);
  assert.equal((await w.E.lead({ email: 'pas-un-mail', accord: true }, '1.2.3.5')).statut, 400);
  assert.equal((await w.E.lead({ email: 'a@t.fr' }, '1.2.3.5')).corps.raison, 'accord');
  for (let i = 1; i < LEAD_PAR_IP_JOUR; i++) assert.equal((await w.E.lead({ email: 'a' + i + '@t.fr', accord: true }, '1.2.3.4')).statut, 200);
  assert.equal((await w.E.lead({ email: 'trop@t.fr', accord: true }, '1.2.3.4')).statut, 429);
  w.t += 864e5;
  assert.equal((await w.E.lead({ email: 'demain@t.fr', accord: true }, '1.2.3.4')).statut, 200);
  await w.minute();
  assert.deepEqual(Object.keys(w.F.lire('lead_ip')), ['2026-10-12']);
  const f = monde({}, { env: { BREVO_API_KEY: 'k' } });
  assert.equal(f.E.leadOuvert(), false);
  assert.equal((await f.E.lead({ email: 'a@t.fr', accord: true }, '1')).statut, 503);
});

await test('SUPPRESSION DU COMPTE : le contact est supprimé chez Brevo (DELETE), une création en file est retirée', async () => {
  const w = monde({ users: { 'lea@t,fr': user(AVEC) }, email_optin: { 'lea@t,fr': { le: T0, accepte: true } } });
  await w.minute();
  assert.ok(w.B.contacts['lea@t.fr']);
  await w.E.contactDuCompte('lea@t,fr', 'payant');
  assert.equal((await w.E.appel({ auth: { email: 'lea@t.fr' }, data: { action: 'supprimer' } })).ok, true);
  assert.deepEqual(Object.values(w.file()).map((x) => x.op), ['supprimer']);
  w.t += 60e3;
  await w.minute();
  assert.deepEqual(w.B.contacts, {});
  assert.ok(w.B.appels.includes('DELETE /contacts/:email'));
  const v = monde({});
  await v.E.appel({ auth: { email: 'x@t.fr' }, data: { action: 'supprimer' } });
  assert.equal((await v.minute()).faites, 1);                        // pas contact : 404, sans erreur
});

await test('LISTE D’ÉVÉNEMENT (inscrireListe) : contact mis à jour, retiré puis remis dans la liste ; sans liste configurée, rien', async () => {
  const B = fauxBrevo({ attributs: TOUS, listes: [{ id: 12, name: 'Renouvellement' }] });
  const env = { BREVO_API_KEY: 'k' };
  assert.equal(await inscrireListe(env, B.fetch, { email: 'a@t.fr', prenom: 'A', liste: '12', attributs: { ECHEANCE: '5 octobre 2027' } }), 'envoye');
  assert.deepEqual(B.appels, ['POST /contacts', 'POST /contacts/lists/:id/contacts/remove', 'POST /contacts/lists/:id/contacts/add']);
  assert.deepEqual(B.listes[0].membres, ['a@t.fr']);
  assert.equal(B.contacts['a@t.fr'].attributs.ECHEANCE, '5 octobre 2027');
  B.appels.length = 0;
  assert.equal(await inscrireListe(env, B.fetch, { email: 'a@t.fr', liste: '12' }), 'envoye');   // une seconde fois : retiré puis remis
  assert.deepEqual(B.listes[0].membres, ['a@t.fr']);
  assert.equal(await inscrireListe({}, B.fetch, { email: 'a@t.fr', liste: '12' }), 'non_configure');
  assert.equal(await inscrireListe(env, B.fetch, { email: 'a@t.fr', liste: '' }), 'non_configure');
  assert.equal(await inscrireListe(env, B.fetch, { email: 'a@t.fr', liste: 'abc' }), 'non_configure');
  assert.equal(await inscrireListe(env, B.fetch, { email: 'pas-une-adresse', liste: '12' }), 'sans_email');
  const P = fauxBrevo({ forcer: { 'POST /contacts/lists/:id/contacts/add': { statut: 500 } }, listes: [{ id: 12, name: 'R' }] });
  await assert.rejects(inscrireListe(env, P.fetch, { email: 'a@t.fr', liste: '12' }), /Brevo liste_ajout 500/);
});

await test('planif : « emails » chaque minute', async () => {
  const j = travaux({ planifies: {} }).find((x) => x.nom === 'emails');
  assert.ok(j && j.minute && j.quand({ heure: 3, minute: 7 }));
});

console.log('\n' + ok + ' tests verts (Brevo).');
