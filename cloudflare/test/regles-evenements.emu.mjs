// Les règles de /evenements et /evenements_attente, sur l'ÉMULATEUR de la
// Realtime Database (pas dans `npm test` : il faut Java et l'émulateur).
//   java -jar firebase-database-emulator-*.jar --port 9000   (ou : npx firebase emulators:start --only database)
//   node cloudflare/test/regles-evenements.emu.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BASE = process.env.EMU || 'http://127.0.0.1:9000';
const NS = 'regles' + Date.now().toString(36);
let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jeton = (email) => b64({ alg: 'none', typ: 'JWT' }) + '.' + b64({ sub: email, user_id: email, email, email_verified: true,
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, aud: NS, iss: 'https://securetoken.google.com/' + NS,
  firebase: { sign_in_provider: 'password' } }) + '.';
async function appel(qui, methode, chemin, corps) {
  // ⚠ L'émulateur prend tout jeton en en-tête pour un compte de service
  //   (administrateur) : celui d'un utilisateur voyage dans ?auth=.
  const r = await fetch(BASE + '/' + chemin + '.json?ns=' + NS + (qui === 'owner' ? '' : '&auth=' + jeton(qui)), { method: methode,
    headers: Object.assign({ 'Content-Type': 'application/json' }, qui === 'owner' ? { Authorization: 'Bearer owner' } : {}),
    body: corps === undefined ? undefined : JSON.stringify(corps) });
  return { statut: r.status, corps: await r.text() };
}
const KEV = 'kev@t.fr', LEA = 'lea@t.fr', K = (e) => e.replace(/\./g, ',');
let n = 0;
const nid = () => 'e' + Date.now().toString(36) + (n++).toString(36).padStart(4, '0');
// Ce que fait l'app : l'événement ET son verrou, dans une seule requête.
const deposer = (qui, ev, o) => {
  const id = (o && o.id) || nid();
  const e = Object.assign({ par: K(qui), at: Date.now() }, ev);
  const maj = { ['evenements/' + id]: e };
  if (!(o && o.sansVerrou)) maj['evenements_attente/' + K(qui) + '/' + ev.type + '/' + ev.cible] = { id, at: { '.sv': 'timestamp' } };
  return appel(qui, 'PATCH', '', maj).then((r) => Object.assign(r, { id }));
};

let regles = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8');
assert.equal((await fetch(BASE + '/.settings/rules.json?ns=' + NS, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: regles })).status, 200);
await appel('owner', 'PUT', '', { users: { [K(LEA)]: { coachEmailKey: K(KEV) }, 'tom@t,fr': { coachEmailKey: 'autre@t,fr' } },
  canaux: { [K(KEV)]: { messages: { d1: { type: 'defi' }, m2: { type: 'texte' } } } } });

await test('réponse du coach à SON athlète : acceptée, avec son verrou', async () => {
  const r = await deposer(KEV, { type: 'reponse_bilan', dest: K(LEA), i: '0', cible: K(LEA) });
  assert.equal(r.statut, 200, r.corps);
  const v = JSON.parse((await appel('owner', 'GET', 'evenements_attente/' + K(KEV) + '/reponse_bilan/' + K(LEA))).corps);
  assert.equal(v.id, r.id);
  assert.ok(Math.abs(v.at - Date.now()) < 5000, 'heure du serveur');
});
await test('un deuxième pour la même cible tant que le premier attend : refusé', async () => {
  const r = await deposer(KEV, { type: 'reponse_bilan', dest: K(LEA), i: '1', cible: K(LEA) });
  assert.equal(r.statut, 401);
});
await test('le premier traité, mais moins de 30 s après : refusé ; 30 s après : accepté', async () => {
  const v = JSON.parse((await appel('owner', 'GET', 'evenements_attente/' + K(KEV) + '/reponse_bilan/' + K(LEA))).corps);
  await appel('owner', 'DELETE', 'evenements/' + v.id);
  assert.equal((await deposer(KEV, { type: 'reponse_bilan', dest: K(LEA), i: '1', cible: K(LEA) })).statut, 401);
  await appel('owner', 'PUT', 'evenements_attente/' + K(KEV) + '/reponse_bilan/' + K(LEA) + '/at', Date.now() - 31000);
  assert.equal((await deposer(KEV, { type: 'reponse_bilan', dest: K(LEA), i: '1', cible: K(LEA) })).statut, 200);
});
await test('sans verrou, ou avec un verrou qui désigne un autre id : refusé', async () => {
  assert.equal((await deposer(KEV, { type: 'defi_publie', msg: 'd1', cible: 'd1' }, { sansVerrou: true })).statut, 401);
  const id = nid();
  const r = await appel(KEV, 'PATCH', '', { ['evenements/' + id]: { type: 'defi_publie', msg: 'd1', cible: 'd1', par: K(KEV), at: Date.now() },
    ['evenements_attente/' + K(KEV) + '/defi_publie/d1']: { id: nid(), at: { '.sv': 'timestamp' } } });
  assert.equal(r.statut, 401);
});
await test('la cible doit exister : un athlète d’un autre coach, un message qui n’est pas un défi : refusé', async () => {
  assert.equal((await deposer(KEV, { type: 'reponse_bilan', dest: 'tom@t,fr', i: '0', cible: 'tom@t,fr' })).statut, 401);
  assert.equal((await deposer(KEV, { type: 'defi_publie', msg: 'm2', cible: 'm2' })).statut, 401);
  assert.equal((await deposer(KEV, { type: 'reponse_bilan', dest: K(LEA), i: '0', cible: 'autre' })).statut, 401, 'cible ≠ dest');
  assert.equal((await deposer(KEV, { type: 'defi_publie', msg: 'd1', cible: 'd1' })).statut, 200);
  assert.equal((await deposer(LEA, { type: 'defi_maj', coach: K(KEV), id: 'd1', cible: 'd1' })).statut, 200);
  assert.equal((await deposer(LEA, { type: 'defi_maj', coach: K(KEV), id: 'zz', cible: 'zz' })).statut, 401);
});
await test('parrainage, ambassadeur, abonnement : cible « - », un seul en attente', async () => {
  assert.equal((await deposer(LEA, { type: 'parrainage_demande', cible: '-' })).statut, 200);
  assert.equal((await deposer(LEA, { type: 'parrainage_demande', cible: '-' })).statut, 401);
  assert.equal((await deposer(LEA, { type: 'abonnement', abo: 'I-ABCDEF12', cible: 'x' })).statut, 401);
  assert.equal((await deposer(LEA, { type: 'abonnement', abo: 'I-ABCDEF12', cible: '-' })).statut, 200);
});
await test('une sous-tâche du Worker (type « tache ») ne s’écrit pas depuis l’app ; l’ancien format (sans cible) non plus', async () => {
  assert.equal((await deposer(LEA, { type: 'tache', quoi: 'push', cible: '-' })).statut, 401);
  const id = nid();
  assert.equal((await appel(LEA, 'PUT', 'evenements/' + id, { type: 'parrainage_demande', par: K(LEA), at: Date.now() })).statut, 401);
});
await test('le verrou d’un autre compte ne s’écrit pas ; un faux « at » non plus', async () => {
  const id = nid();
  assert.equal((await appel(LEA, 'PATCH', '', { ['evenements/' + id]: { type: 'ambassadeur_demande', par: K(LEA), at: 1, cible: '-' },
    ['evenements_attente/' + K(LEA) + '/ambassadeur_demande/-']: { id, at: 1 } })).statut, 401);
  assert.equal((await appel(LEA, 'PUT', 'evenements_attente/' + K(KEV) + '/x/-', { id, at: { '.sv': 'timestamp' } })).statut, 401);
});
await test('evenements_ko : lu et effacé par l’administrateur seul', async () => {
  await appel('owner', 'PUT', 'evenements_ko/e1', { type: 'defi_maj', essais: 5, erreur: 'x' });
  assert.equal((await appel(LEA, 'GET', 'evenements_ko')).statut, 401);
  assert.equal((await appel(LEA, 'DELETE', 'evenements_ko/e1')).statut, 401);
  assert.equal((await appel('guellec.coachingpro@gmail.com', 'GET', 'evenements_ko')).statut, 200);
  assert.equal((await appel('guellec.coachingpro@gmail.com', 'PUT', 'evenements_ko/e1', { a: 1 })).statut, 401);
  assert.equal((await appel('guellec.coachingpro@gmail.com', 'DELETE', 'evenements_ko/e1')).statut, 200);
});
await test('paypal_evenements : la requête de la purge (orderBy at, endAt) est indexée', async () => {
  await appel('owner', 'PUT', 'paypal_evenements', { 'WH-1': { etat: 'fait', at: 1 }, 'WH-2': { etat: 'fait', at: Date.now() } });
  const r = await fetch(BASE + '/paypal_evenements.json?ns=' + NS + '&orderBy=%22at%22&endAt=1000&limitToFirst=200', { headers: { Authorization: 'Bearer owner' } });
  assert.deepEqual(Object.keys(await r.json()), ['WH-1']);
});
console.log(ok + ' tests passés (émulateur)');
