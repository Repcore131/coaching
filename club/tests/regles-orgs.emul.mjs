// Règles multi-salles sur le simulateur Firebase : isolation entre sociétés, rôles,
// saisies personnelles, création d'une société, invitations, double authentification.
// Lancer : cd club/tests/emul && npx firebase-tools emulators:exec --only database --project fitpulse-test "node ../regles-orgs.emul.mjs"
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { avecRegle } from '../outils/fitpulse-serveur.mjs';

const HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000';
const NS = 'fitpulse-orgs';
const url = (p, extra = '') => `http://${HOST}/${p}.json?ns=${NS}${extra}`;
const owner = { authorization: 'Bearer owner' };
const key = id => crypto.createHash('sha256').update(id).digest('hex').slice(0, 40);
const T0 = Math.floor(Date.now() / 1000);
// Utilisateur simulé : jeton avec e-mail technique ; mfa = code TOTP vérifié pour CETTE connexion.
const who = (id, { mfa = false, autreSession = false } = {}) => ({ as: JSON.stringify({ uid: 'uid_' + id, token: { email: `fp-${key(id)}@fitpulse-niort.web.app`, email_verified: false, auth_time: T0, ...(mfa ? { mfaAt: autreSession ? T0 - 3600 : T0 } : {}) } }) });
const req = async (method, p, body, w = null) => (await fetch(url(p, `&auth_variable_override=${encodeURIComponent(w ? w.as : 'null')}`), { method, headers: { 'content-type': 'application/json', ...owner }, body: body === undefined ? undefined : JSON.stringify(body) })).status;
let fails = 0; const check = async (label, got, ok) => { const pass = ok ? got === 200 : got !== 200; console.log(`${pass ? 'OK ' : 'KO '} ${label} (${got})`); if (!pass) fails++; };

const rules = avecRegle('{\n  "rules": {\n  }\n}');
const r = await fetch(`http://${HOST}/.settings/rules.json?ns=${NS}`, { method: 'PUT', headers: owner, body: rules });
assert.equal(r.status, 200, 'règles refusées : ' + await r.text());
const U = (id, role) => ({ id, role, status: 'active', clubs: ['c1'], first: id, last: 'X', email: id + '@exemple.fr' });
const org = (nom, users, mfa) => ({ info: { nom, createdBy: 'x', creeLe: 1, statut: 'actif', securite: { mfa } }, clubs: { c1: { id: 'c1', name: nom + ' Centre' } }, data: { users: Object.fromEntries(users.map(([id, role]) => [id, U(id, role)])), targets: { '2026-10': {} }, entries: {} } });
const boot = {}; [['creaA', 'alpha'], ['mgrA', 'alpha'], ['memA', 'alpha'], ['mem2A', 'alpha'], ['mgrB', 'beta'], ['memB', 'beta']].forEach(([id, o]) => { boot[key(id)] = { org: o, uid: id }; });
await fetch(url(''), { method: 'PUT', headers: owner, body: JSON.stringify({ orgs: { alpha: org('Alpha', [['creaA', 'createur'], ['mgrA', 'manager'], ['memA', 'membre'], ['mem2A', 'membre']], true), beta: org('Beta', [['mgrB', 'manager'], ['memB', 'membre']], false) }, orgs_boot: boot, orgs_secret: { mgrA: { totp: 'SECRET' } } }) });

// 1. Isolation : un utilisateur de l'org A ne lit aucun chemin de l'org B
await check('membre A lit son espace', await req('GET', 'orgs/alpha/data', undefined, who('memA')), true);
for (const p of ['orgs/beta', 'orgs/beta/data', 'orgs/beta/data/users', 'orgs/beta/data/entries', 'orgs/beta/clubs', 'orgs/beta/info', 'orgs_invites/beta', 'orgs_inbox/beta/memB', 'orgs_product/beta'])
  await check(`membre A ne lit pas ${p}`, await req('GET', p, undefined, who('memA')), false);
await check('manager B ne lit pas l’org A', await req('GET', 'orgs/alpha/data', undefined, who('mgrB')), false);
await check('anonyme ne lit aucune société', await req('GET', 'orgs/alpha', undefined), false);
await check('personne ne liste toutes les sociétés', await req('GET', 'orgs', undefined, who('creaA', { mfa: true })), false);
await check('manager A n’écrit pas dans l’org B', await req('PUT', 'orgs/beta/data/targets/2026-10/memB', { contrats: 1 }, who('mgrA', { mfa: true })), false);

// 2. Rôles : un membre ne modifie pas un objectif ; les imports aux managers
await check('membre ne modifie pas un objectif', await req('PUT', 'orgs/alpha/data/targets/2026-10/memA', { contrats: 99 }, who('memA')), false);
await check('manager (double authentification faite) fixe un objectif', await req('PUT', 'orgs/alpha/data/targets/2026-10/memA', { contrats: 20 }, who('mgrA', { mfa: true })), true);
await check('membre ne crée pas d’import', await req('PUT', 'orgs/alpha/data/imports/i1', { id: 'i1', active: true }, who('memA')), false);
await check('manager crée un import', await req('PUT', 'orgs/alpha/data/imports/i1', { id: 'i1', active: true }, who('mgrA', { mfa: true })), true);
await check('membre ne change pas son rôle', await req('PUT', 'orgs/alpha/data/users/memA/role', 'manager', who('memA')), false);
await check('membre change son prénom', await req('PUT', 'orgs/alpha/data/users/memA/first', 'Alex', who('memA')), true);

// 3. Saisies : un membre n'écrit que les siennes
const E = (uid, extra = {}) => ({ id: 'e', userId: uid, clubId: 'c1', kpiId: 'contrats', date: '2026-10-05', value: 1, source: 'manual', at: 1, ...extra });
await check('membre saisit pour lui', await req('PUT', 'orgs/alpha/data/entries/e1', E('memA'), who('memA')), true);
await check('membre ne saisit pas pour un collègue', await req('PUT', 'orgs/alpha/data/entries/e2', E('mem2A'), who('memA')), false);
await check('membre ne modifie pas la saisie d’un collègue', await req('PUT', 'orgs/alpha/data/entries/e1/value', 5, who('mem2A')), false);

// 4. Double authentification exigée (org A) : manager sans code TOTP, ou code d'une autre connexion
await check('manager sans double authentification : rien', await req('GET', 'orgs/alpha/data', undefined, who('mgrA')), false);
await check('manager, code vérifié pour une autre connexion : rien', await req('GET', 'orgs/alpha/data', undefined, who('mgrA', { mfa: true, autreSession: true })), false);
await check('manager avec double authentification : lit', await req('GET', 'orgs/alpha/data', undefined, who('mgrA', { mfa: true })), true);
await check('membre : pas de double authentification exigée', await req('GET', 'orgs/alpha/data', undefined, who('memA')), true);
await check('org B (non exigée) : manager sans double authentification', await req('PUT', 'orgs/beta/data/targets/2026-10/memB', { contrats: 3 }, who('mgrB')), true);
await check('la société ne désactive pas la double authentification', await req('PUT', 'orgs/alpha/info/securite/mfa', false, who('creaA', { mfa: true })), false);
await check('le statut d’abonnement n’est pas modifiable par la société', await req('PUT', 'orgs/alpha/info/statut', 'actif', who('creaA', { mfa: true })), false);
await check('secrets TOTP illisibles', await req('GET', 'orgs_secret/mgrA', undefined, who('mgrA', { mfa: true })), false);

// 5. Inscription autonome : création d'une société par un nouveau compte, une seule fois
const nouvelle = (o, k, uid) => ({ [`orgs/${o}/info`]: { nom: 'Gamma', createdBy: 'uid_' + uid, creeLe: Date.now(), statut: 'essai', securite: { mfa: true } }, [`orgs/${o}/clubs/c1`]: { id: 'c1', name: 'Gamma Centre' }, [`orgs/${o}/data/users/${uid}`]: U(uid, 'manager'), [`orgs_boot/${k}`]: { org: o, uid, privilegie: true } });
await check('nouveau compte crée sa société', await req('PATCH', '', nouvelle('gamma', key('fondateur'), 'fondateur'), who('fondateur')), true);
await check('un autre compte ne recrée pas la même société', await req('PATCH', '', nouvelle('gamma', key('intrus'), 'intrus'), who('intrus')), false);
await check('un nouveau compte ne prend pas une société existante', await req('PATCH', '', nouvelle('alpha', key('intrus'), 'intrus'), who('intrus')), false);
await check('statut d’une nouvelle société imposé (essai)', await req('PATCH', '', { ...nouvelle('delta', key('f2'), 'f2'), 'orgs/delta/info': { nom: 'Delta', createdBy: 'uid_f2', creeLe: 1, statut: 'actif', securite: { mfa: true } } }, who('f2')), false);

// 6. Invitation : lien à usage unique, 7 jours
const T = 'a'.repeat(32), T2 = 'b'.repeat(32), T3 = 'c'.repeat(32);
const invit = (uid, extra = {}) => ({ email: uid + '@exemple.fr', role: 'membre', uid, expiresAt: Date.now() + 7 * 864e5, orgNom: 'Alpha', clubs: ['c1'], by: 'mgrA', at: Date.now(), ...extra });
await check('membre ne crée pas d’invitation', await req('PUT', `orgs_invites/alpha/${T}`, invit('u9'), who('memA')), false);
await check('manager crée une invitation', await req('PUT', `orgs_invites/alpha/${T}`, invit('u9'), who('mgrA', { mfa: true })), true);
await check('invitation de plus de 7 jours refusée', await req('PUT', `orgs_invites/alpha/${T3}`, invit('u11', { expiresAt: Date.now() + 9 * 864e5 }), who('mgrA', { mfa: true })), false);
await check('invitation lisible par son lien', await req('GET', `orgs_invites/alpha/${T}`, undefined), true);
await check('membre ne lit pas le suivi produit de sa société', await req('GET', 'orgs_product/alpha', undefined, who('memA')), false);
await check('membre ne lit pas la boîte d’un collègue', await req('GET', 'orgs_inbox/alpha/mem2A', undefined, who('memA')), false);
await check('liste des invitations non lisible par un membre', await req('GET', 'orgs_invites/alpha', undefined, who('memA')), false);
const accepter = (k, uid, t, extra = {}) => ({ [`orgs_boot/${k}`]: { org: 'alpha', uid, invite: t }, [`orgs/alpha/data/users/${uid}`]: { ...U(uid, 'membre'), invite: t, ...extra }, [`orgs_invites/alpha/${t}/usedAt`]: Date.now(), [`orgs_invites/alpha/${t}/usedBy`]: k });
await check('invité : rôle supérieur à l’invitation refusé', await req('PATCH', '', accepter(key('invite1'), 'u9', T, { role: 'manager' }), who('invite1')), false);
await check('invité accepte le lien', await req('PATCH', '', accepter(key('invite1'), 'u9', T), who('invite1')), true);
await check('le même lien ne sert pas deux fois', await req('PATCH', '', accepter(key('invite2'), 'u9', T), who('invite2')), false);
await check('l’invité lit l’espace de sa société', await req('GET', 'orgs/alpha/data', undefined, who('invite1')), true);
await fetch(url(`orgs_invites/alpha/${T2}`), { method: 'PUT', headers: owner, body: JSON.stringify(invit('u10', { expiresAt: Date.now() - 1000 })) });
await check('lien expiré refusé', await req('PATCH', '', accepter(key('invite3'), 'u10', T2), who('invite3')), false);

// 7. Clés de connexion
await check('clé de connexion lisible une par une', await req('GET', `orgs_boot/${key('memA')}`, undefined), true);
await check('liste des clés illisible', await req('GET', 'orgs_boot', undefined, who('creaA', { mfa: true })), false);
await check('manager A ne crée pas de clé pour l’org B', await req('PUT', `orgs_boot/${key('x1')}`, { org: 'beta', uid: 'memB' }, who('mgrA', { mfa: true })), false);
await check('manager A crée une clé dans sa société', await req('PUT', `orgs_boot/${key('x2')}`, { org: 'alpha', uid: 'mem2A' }, who('mgrA', { mfa: true })), true);
await check('membre ne détourne pas la clé d’un autre', await req('PUT', `orgs_boot/${key('x3')}`, { org: 'alpha', uid: 'mgrA' }, who('memA')), false);

console.log(fails ? `${fails} échec(s)` : 'Toutes les règles multi-salles se comportent comme attendu.');
process.exit(fails ? 1 : 0);
