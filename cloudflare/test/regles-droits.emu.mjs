// Les champs de droits gelés dans users/, coachs_registre et la création des
// codes, sur l'ÉMULATEUR de la Realtime Database (pas dans `npm test` : il faut
// Java et l'émulateur).
//   java -jar firebase-database-emulator-*.jar --port 9000
//   node cloudflare/test/regles-droits.emu.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BASE = process.env.EMU || 'http://127.0.0.1:9000';
const NS = 'droits' + Date.now().toString(36);
let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jeton = (email) => b64({ alg: 'none', typ: 'JWT' }) + '.' + b64({ sub: email, user_id: email, email, email_verified: true,
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, aud: NS, iss: 'https://securetoken.google.com/' + NS,
  firebase: { sign_in_provider: 'password' } }) + '.';
async function appel(qui, methode, chemin, corps) {
  const r = await fetch(BASE + '/' + chemin + '.json?ns=' + NS + (qui === 'owner' ? '' : '&auth=' + jeton(qui)), { method: methode,
    headers: Object.assign({ 'Content-Type': 'application/json' }, qui === 'owner' ? { Authorization: 'Bearer owner' } : {}),
    body: corps === undefined ? undefined : JSON.stringify(corps) });
  return { statut: r.status, corps: await r.text() };
}
const LEA = 'lea@t.fr', KEV = 'kev@t.fr', PIRATE = 'pirate@t.fr', NEUF = 'neuf@t.fr', CREA = 'guellec.coachingpro@gmail.com';
const K = (e) => e.replace(/\./g, ',');
const regles = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8');
assert.equal((await fetch(BASE + '/.settings/rules.json?ns=' + NS, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: regles })).status, 200);
const DOSSIER = () => ({ id: 'u_lea', email: LEA, role: 'athlete', status: 'FREE', accessExpiry: 1000, paymentStatus: 'none',
  coachPlan: 'libre', coachSubActive: false, updatedAt: 1, sessions: [{ id: 's1', date: 1 }],
  programmesAchetes: { p1: { le: 1, prixCts: 1490, ordre: 'O1', ouvertJusqu: 5 } },
  abonnement: { formule: 'essentielle', statutPaypal: 'ACTIVE', finAccesPaypal: 9, dernierPaiementLe: 8 } });
await appel('owner', 'PUT', '', {
  users: { [K(LEA)]: DOSSIER(), [K(PIRATE)]: { id: 'u_p', email: PIRATE, role: 'athlete', updatedAt: 1 },
    [K(CREA)]: { id: 'u_c', email: CREA, role: 'coach', updatedAt: 1 } },
  coachs_registre: { [K(KEV)]: { plan: 'libre', le: 1 } } });

await test('un athlète NE PEUT PAS s’écrire status=COACHING_SUIVI, role=coach, coachPlan=pro, accessExpiry=0', async () => {
  const b = 'users/' + K(LEA) + '/';
  assert.equal((await appel(LEA, 'PUT', b + 'status', 'COACHING_SUIVI')).statut, 401);
  assert.equal((await appel(LEA, 'PUT', b + 'role', 'coach')).statut, 401);
  assert.equal((await appel(LEA, 'PUT', b + 'coachPlan', 'pro')).statut, 401);
  assert.equal((await appel(LEA, 'PUT', b + 'coachSubActive', true)).statut, 401);
  assert.equal((await appel(LEA, 'PUT', b + 'accessExpiry', 0)).statut, 401);
  assert.equal((await appel(LEA, 'PUT', b + 'paymentStatus', 'active')).statut, 401);
  assert.equal((await appel(LEA, 'PATCH', b.slice(0, -1), { status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active' })).statut, 401);
});
await test('ni un programme acheté, ni la formule ou l’état PayPal de son abonnement', async () => {
  const b = 'users/' + K(LEA) + '/';
  assert.equal((await appel(LEA, 'PUT', b + 'programmesAchetes/p2', { le: 2, prixCts: 0, ordre: 'x', ouvertJusqu: 9e12 })).statut, 401);
  assert.equal((await appel(LEA, 'PUT', b + 'programmesAchetes/p1/ouvertJusqu', 9e12)).statut, 401);
  assert.equal((await appel(LEA, 'PUT', b + 'abonnement/formule', 'ultime')).statut, 401);
  assert.equal((await appel(LEA, 'PUT', b + 'abonnement/statutPaypal', 'ACTIVE2')).statut, 401);
  assert.equal((await appel(LEA, 'PUT', b + 'abonnement/finAccesPaypal', 9e12)).statut, 401);
  assert.equal((await appel(LEA, 'PUT', b + 'abonnement/dernierPaiementLe', 9e12)).statut, 401);
});
await test('le dossier ENTIER, reprenant les mêmes valeurs, passe ; le même avec status changé est refusé', async () => {
  const d = DOSSIER(); d.sessions.push({ id: 's2', date: 2 }); d.updatedAt = 2;
  assert.equal((await appel(LEA, 'PUT', 'users/' + K(LEA), d)).statut, 200);
  assert.equal((await appel(LEA, 'PUT', 'users/' + K(LEA) + '/status', 'FREE')).statut, 200, 'la même valeur, seule');
  const d2 = DOSSIER(); d2.status = 'COACHING_SUIVI';
  assert.equal((await appel(LEA, 'PUT', 'users/' + K(LEA), d2)).statut, 401);
  const lu = JSON.parse((await appel('owner', 'GET', 'users/' + K(LEA) + '/status')).corps);
  assert.equal(lu, 'FREE');
});
await test('un compte neuf crée son dossier en athlete, jamais en coach ni avec un statut', async () => {
  assert.equal((await appel(NEUF, 'PUT', 'users/' + K(NEUF), { id: 'u_n', email: NEUF, role: 'coach', updatedAt: 1 })).statut, 401);
  assert.equal((await appel(NEUF, 'PUT', 'users/' + K(NEUF), { id: 'u_n', email: NEUF, role: 'athlete', status: 'COACHING_SUIVI', updatedAt: 1 })).statut, 401);
  assert.equal((await appel(NEUF, 'PUT', 'users/' + K(NEUF), { id: 'u_n', email: NEUF, role: 'athlete', updatedAt: 1 })).statut, 200);
});
await test('coachs_registre : lu par son titulaire seul, écrit par personne', async () => {
  assert.equal((await appel(KEV, 'GET', 'coachs_registre/' + K(KEV))).statut, 200);
  assert.equal((await appel(LEA, 'GET', 'coachs_registre/' + K(KEV))).statut, 401);
  assert.equal((await appel(PIRATE, 'PUT', 'coachs_registre/' + K(PIRATE), { plan: 'pro', le: 1 })).statut, 401);
  assert.equal((await appel(KEV, 'PUT', 'coachs_registre/' + K(KEV) + '/plan', 'pro')).statut, 401);
});
const code = (x) => Object.assign({ coachEmailKey: K(KEV), coachId: 'u_kev', type: 'athlete', active: true, redeemed: false,
  months: 3, expiry: Date.now() + 1e10, etat: 'envoye' }, x);
await test('/rc_codes : pas de création sans être au registre des coachs', async () => {
  assert.equal((await appel(PIRATE, 'PUT', 'rc_codes/RC-PIRA-TE01', code({ coachEmailKey: K(PIRATE) }))).statut, 401);
  assert.equal((await appel(LEA, 'PUT', 'rc_codes/RC-PIRA-TE02', code({ coachEmailKey: K(LEA) }))).statut, 401);
});
await test('/rc_codes : un coach enregistré crée SES codes, pas ceux d’un autre', async () => {
  assert.equal((await appel(KEV, 'PUT', 'rc_codes/RC-KEVI-N001', code())).statut, 200);
  assert.equal((await appel(KEV, 'PUT', 'rc_codes/RC-KEVI-N002', code({ coachEmailKey: K(LEA) }))).statut, 401);
  assert.equal((await appel(KEV, 'PATCH', 'rc_codes/RC-KEVI-N001', { expiry: Date.now() + 2e10, months: 6 })).statut, 200, 'il prolonge le sien');
});
await test('/rc_codes : un tiers ne passe plus redeemed à true (c’est le Worker qui consomme)', async () => {
  assert.equal((await appel(LEA, 'PATCH', 'rc_codes/RC-KEVI-N001', { redeemed: true, athleteEmail: LEA, etat: 'cree' })).statut, 401);
  assert.equal(JSON.parse((await appel('owner', 'GET', 'rc_codes/RC-KEVI-N001/redeemed')).corps), false);
});
await test('le créateur peut tout écrire : ses champs gelés, droits/, un code', async () => {
  const b = 'users/' + K(CREA) + '/';
  assert.equal((await appel(CREA, 'PUT', b + 'status', 'COACHING_SUIVI')).statut, 200);
  assert.equal((await appel(CREA, 'PUT', b + 'coachPlan', 'pro')).statut, 200);
  assert.equal((await appel(CREA, 'PUT', b + 'role', 'athlete')).statut, 200);
  assert.equal((await appel(CREA, 'PATCH', 'droits/' + K(LEA), { palier: 'ultime', echeance: 0, source: 'main' })).statut, 200);
  assert.equal((await appel(CREA, 'PUT', 'rc_codes/RC-CREA-TEUR', code({ coachEmailKey: K(CREA), type: 'coach' }))).statut, 200);
});
await test('parrainage : un compte ne se déclare pas « adresse vérifiée », n’écrit pas le journal du plafond', async () => {
  assert.equal((await appel(LEA, 'PUT', 'parrainage/verifies/' + K(LEA), Date.now())).statut, 401);
  assert.equal((await appel(LEA, 'GET', 'parrainage/verifies/' + K(LEA))).statut, 401);
  assert.equal((await appel(LEA, 'PUT', 'parrainage_plafond/' + K(LEA) + '/x', { le: 1 })).statut, 401);
});
console.log(ok + ' tests passés');
