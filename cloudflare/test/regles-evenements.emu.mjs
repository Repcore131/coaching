// Les règles de /evenements et /evenements_attente, sur l'ÉMULATEUR de la
// Realtime Database (pas dans `npm test` : il faut Java et l'émulateur).
//   java -jar firebase-database-emulator-*.jar --port 9000   (ou : npx firebase emulators:start --only database)
//   node cloudflare/test/regles-evenements.emu.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CREATEUR_UID } from '../src/createur.js';

const BASE = process.env.EMU || 'http://127.0.0.1:9000';
const NS = 'regles' + Date.now().toString(36);
let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
// Le créateur se présente sous SON UID (createur.js) : les règles ne le
// reconnaissent plus à son adresse. Un autre UID se force par UID_FORCE.
const UID_FORCE = new Map();
const uidDe = (email) => UID_FORCE.get(email) || (email === 'guellec.coachingpro@gmail.com' ? CREATEUR_UID : email);
const jeton = (email) => b64({ alg: 'none', typ: 'JWT' }) + '.' + b64({ sub: uidDe(email), user_id: uidDe(email), email, email_verified: true,
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
await test('codesPublics : un code se lit SANS compte (prénom et rang), la liste jamais', async () => {
  await appel('owner', 'PATCH', 'parrainage', { codes: { JULIE7K2: K(LEA) }, codesPublics: { JULIE7K2: { prenom: 'Julie', rang: 3 } } });
  const r = await fetch(BASE + '/parrainage/codesPublics/JULIE7K2.json?ns=' + NS);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { prenom: 'Julie', rang: 3 });
  assert.equal((await fetch(BASE + '/parrainage/codesPublics.json?ns=' + NS)).status, 401, 'la liste des codes');
  assert.equal((await fetch(BASE + '/parrainage/codes/JULIE7K2.json?ns=' + NS)).status, 401, 'le code mène à une adresse : fermé');
});
await test('codesPublics/<code>/rang : son propriétaire seul, un entier de 1 à 10', async () => {
  assert.equal((await appel(LEA, 'PUT', 'parrainage/codesPublics/JULIE7K2/rang', 5)).statut, 200);
  assert.equal((await appel(KEV, 'PUT', 'parrainage/codesPublics/JULIE7K2/rang', 9)).statut, 401);
  for (const v of [11, 0, 2.5, 'TITAN']) assert.equal((await appel(LEA, 'PUT', 'parrainage/codesPublics/JULIE7K2/rang', v)).statut, 401, String(v));
  assert.equal((await appel(LEA, 'PUT', 'parrainage/codesPublics/JULIE7K2/prenom', 'Autre')).statut, 401, 'le prénom ne se réécrit pas');
  assert.equal((await appel(LEA, 'PUT', 'parrainage/codesPublics/JULIE7K2/email', 'x')).statut, 401);
});
await test('filleul_seance : seulement pour un compte réellement parrainé', async () => {
  const TOM = 'tom@t.fr';
  assert.equal((await deposer(TOM, { type: 'filleul_seance', cible: '-' })).statut, 401);
  await appel('owner', 'PUT', 'parrainage/liens/' + K(TOM), { parrain: K(LEA), id: 'f1' });
  assert.equal((await deposer(TOM, { type: 'filleul_seance', cible: '-' })).statut, 200);
  assert.equal((await deposer(TOM, { type: 'filleul_seance', cible: 'x' })).statut, 401);
});
// ── LES DUELS ─────────────────────────────────────────────────────────────
const TOMD = 'tom@t.fr', ZOE = 'zoe@t.fr', DID = 'dtest1234567';
const creerDuel = (qui, id, x) => appel(qui, 'PATCH', '', {
  ['duels/' + id]: Object.assign({ createur: K(qui), createurNom: 'Léa', mesure: 'seances', duree: 14, creeLe: Date.now(), statut: 'attente' }, x || {}),
  ['duels_publics/' + id]: { prenom: 'Léa', mesure: 'seances', duree: 14 } });
await test('duel : créé par son créateur, en attente, sans invité ni score ; la fiche publique se lit sans compte', async () => {
  assert.equal((await creerDuel(LEA, DID)).statut, 200);
  assert.equal((await creerDuel(LEA, 'dtest7654321', { statut: 'en_cours' })).statut, 401, 'statut imposé');
  assert.equal((await creerDuel(LEA, 'dtest7654322', { scores: { createur: 9 } })).statut, 401, 'scores par le client');
  assert.equal((await creerDuel(LEA, 'dtest7654323', { invite: K(TOMD) })).statut, 401, 'invité imposé');
  assert.equal((await creerDuel(LEA, 'dtest7654324', { duree: 30 })).statut, 401, 'durée hors liste');
  assert.equal((await appel(KEV, 'PATCH', '', { ['duels/dtest7654325']: { createur: K(LEA), createurNom: 'x', mesure: 'seances', duree: 14, creeLe: 1, statut: 'attente' } })).statut, 401, 'pour quelqu’un d’autre');
  assert.equal((await creerDuel(LEA, DID)).statut, 401, 'pas deux fois');
  const pub = await fetch(BASE + '/duels_publics/' + DID + '.json?ns=' + NS);
  assert.equal(pub.status, 200);
  assert.equal((await pub.json()).prenom, 'Léa');
});
await test('duel : lu par ses deux participants seulement', async () => {
  assert.equal((await appel(LEA, 'GET', 'duels/' + DID)).statut, 200);
  assert.equal((await appel(TOMD, 'GET', 'duels/' + DID)).statut, 401, 'pas encore invité');
  assert.equal((await appel(TOMD, 'PATCH', 'duels/' + DID, { invite: K(TOMD), inviteNom: 'Tom' })).statut, 200, 'rejoindre');
  assert.equal((await appel(TOMD, 'GET', 'duels/' + DID)).statut, 200);
  assert.equal((await appel(ZOE, 'GET', 'duels/' + DID)).statut, 401);
  assert.equal((await appel(ZOE, 'PATCH', 'duels/' + DID, { invite: K(ZOE) })).statut, 401, 'la place est prise');
  assert.equal((await appel(LEA, 'PATCH', 'duels/dtest7654321', { invite: K(LEA) })).statut, 401);
});
await test('duel : le créateur ne se défie pas lui-même ; statut, scores et dates restent au Worker', async () => {
  assert.equal((await creerDuel(LEA, 'dtest0000001')).statut, 200);
  assert.equal((await appel(LEA, 'PUT', 'duels/dtest0000001/invite', K(LEA))).statut, 401);
  for (const [c, v] of [['statut', 'termine'], ['scores', { createur: 99 }], ['debut', 1], ['gagnant', 'createur']]) {
    assert.equal((await appel(LEA, 'PUT', 'duels/' + DID + '/' + c, v)).statut, 401, c);
    assert.equal((await appel(TOMD, 'PUT', 'duels/' + DID + '/' + c, v)).statut, 401, c);
  }
});
await test('duel : chacun écrit SA progression, seulement pendant le duel', async () => {
  const prog = { valeur: 3, maj: Date.now() };
  assert.equal((await appel(TOMD, 'PUT', 'duels/' + DID + '/progres/' + K(TOMD), prog)).statut, 401, 'pas encore commencé');
  await appel('owner', 'PUT', 'duels/' + DID + '/statut', 'en_cours');
  assert.equal((await appel(TOMD, 'PUT', 'duels/' + DID + '/progres/' + K(TOMD), prog)).statut, 200);
  assert.equal((await appel(TOMD, 'PUT', 'duels/' + DID + '/progres/' + K(LEA), prog)).statut, 401, 'celle de l’autre');
  assert.equal((await appel(ZOE, 'PUT', 'duels/' + DID + '/progres/' + K(ZOE), prog)).statut, 401, 'hors duel');
  assert.equal((await appel(TOMD, 'PUT', 'duels/' + DID + '/progres/' + K(TOMD), { valeur: -1, maj: 1 })).statut, 401);
});
await test('duel : les événements duel_rejoint / duel_maj, par un participant seulement', async () => {
  assert.equal((await deposer(TOMD, { type: 'duel_maj', cible: DID })).statut, 200);
  assert.equal((await deposer(LEA, { type: 'duel_rejoint', cible: DID })).statut, 200);
  assert.equal((await deposer(ZOE, { type: 'duel_maj', cible: DID })).statut, 401);
  assert.equal((await deposer(LEA, { type: 'duel_maj', cible: 'dinexistant12' })).statut, 401);
});
await test('le défi RepCore du mois : écrit par Kevin seul, lu par tout compte connecté', async () => {
  const d = { titre: '12 séances en octobre', mesure: 'seances', objectif: 12, debut: 1, fin: 2 };
  assert.equal((await appel(LEA, 'PUT', 'defi_mois/2026-10', d)).statut, 401);
  assert.equal((await appel('guellec.coachingpro@gmail.com', 'PUT', 'defi_mois/2026-10', d)).statut, 200);
  assert.equal((await appel(LEA, 'GET', 'defi_mois/2026-10')).statut, 200);
  assert.equal((await appel('guellec.coachingpro@gmail.com', 'PUT', 'defi_mois/2026-11', Object.assign({}, d, { fin: 0 }))).statut, 401, 'fin avant début');
});
// ── LES ÉVÉNEMENTS SAISONNIERS ──────────────────────────────────────────
const KEVIN = 'guellec.coachingpro@gmail.com';
const saison = (x) => Object.assign({ nom: 'Hiver de fer', debut: Date.now() - 864e5, fin: Date.now() + 10 * 864e5, mesure: 'seances',
  objectifPerso: 10, objectifCollectif: 100, badgeCle: 'hiver', couleurAccent: '#3aa0ff', texteAccueil: 'Dix séances.' }, x || {});
await test('saisons : créées par Kevin seul, champs vérifiés, lues par tout compte connecté', async () => {
  assert.equal((await appel(LEA, 'PUT', 'saisons/hiver-2026', saison())).statut, 401);
  assert.equal((await appel(KEVIN, 'PUT', 'saisons/hiver-2026', saison())).statut, 200);
  for (const [c, v] of [['couleurAccent', 'rouge'], ['mesure', 'poids'], ['badgeCle', 'Hiver !'], ['objectifPerso', 0], ['fin', 1]])
    assert.equal((await appel(KEVIN, 'PUT', 'saisons/test-' + c.toLowerCase(), saison({ [c]: v }))).statut, 401, c);
  assert.equal((await appel(KEVIN, 'PUT', 'saisons/Majuscules', saison())).statut, 401, 'id');
  assert.equal((await appel(LEA, 'GET', 'saisons/hiver-2026')).statut, 200);
  assert.equal((await fetch(BASE + '/saisons.json?ns=' + NS)).status, 401, 'pas sans compte');
});
await test('saisons : chacun écrit SA progression, pendant la saison seulement', async () => {
  const p = { valeur: 4, maj: Date.now() };
  assert.equal((await appel(LEA, 'PUT', 'saisons_progres/hiver-2026/' + K(LEA), p)).statut, 200);
  assert.equal((await appel(LEA, 'PUT', 'saisons_progres/hiver-2026/' + K(KEV), p)).statut, 401, 'celle d’un autre');
  assert.equal((await appel(LEA, 'PUT', 'saisons_progres/inconnue/' + K(LEA), p)).statut, 401, 'saison inconnue');
  assert.equal((await appel(LEA, 'PUT', 'saisons_progres/hiver-2026/' + K(LEA), { valeur: -1, maj: 1 })).statut, 401);
  await appel(KEVIN, 'PUT', 'saisons/finie-2025', saison({ debut: Date.now() - 30 * 864e5, fin: Date.now() - 3 * 864e5 }));
  assert.equal((await appel(LEA, 'PUT', 'saisons_progres/finie-2025/' + K(LEA), p)).statut, 401, 'saison finie');
  assert.equal((await appel(LEA, 'GET', 'saisons_progres/hiver-2026')).statut, 401, 'les valeurs des autres ne se lisent pas');
});
await test('saisons : les résultats, lus par leur titulaire, écrits par le Worker seul ; le compteur se lit sans compte', async () => {
  await appel('owner', 'PUT', 'saisons_resultats/' + K(LEA) + '/hiver-2026', { nom: 'Hiver de fer', annee: '2026' });
  await appel('owner', 'PUT', 'stats/saisons/hiver-2026', { total: 4 });
  assert.equal((await appel(LEA, 'GET', 'saisons_resultats/' + K(LEA))).statut, 200);
  assert.equal((await appel(KEV, 'GET', 'saisons_resultats/' + K(LEA))).statut, 401);
  assert.equal((await appel(LEA, 'PUT', 'saisons_resultats/' + K(LEA) + '/x', { nom: 'triche' })).statut, 401);
  assert.equal((await appel(LEA, 'PUT', 'stats/saisons/hiver-2026', { total: 9999 })).statut, 401);
  assert.equal((await fetch(BASE + '/stats/saisons/hiver-2026.json?ns=' + NS)).status, 200);
});
await test('parcours_j21 : chacun écrit SES étapes restantes (1 à 7) sous un jour, personne ne lit', async () => {
  const j = 'parcours_j21/2026-10-19/';
  assert.equal((await appel(LEA, 'PUT', j + K(LEA), 2)).statut, 200);
  assert.equal((await appel(LEA, 'PUT', j + K(KEV), 2)).statut, 401, 'celle d’un autre');
  for (const v of [0, 8, 2.5, 'deux']) assert.equal((await appel(LEA, 'PUT', j + K(LEA), v)).statut, 401, String(v));
  assert.equal((await appel(LEA, 'PUT', 'parcours_j21/19-10-2026/' + K(LEA), 2)).statut, 401, 'jour mal formé');
  assert.equal((await appel(LEA, 'PUT', j + K(LEA), null)).statut, 200, 'fini : effacé');
  assert.equal((await appel(LEA, 'GET', j + K(LEA))).statut, 401, 'pas même le sien');
});
await test('retour_etat : la relance des inactifs, fermée à tout client', async () => {
  assert.equal((await appel(LEA, 'PUT', 'retour_etat/' + K(LEA), { depuis: 1, paliers: {} })).statut, 401);
  assert.equal((await appel(LEA, 'GET', 'retour_etat/' + K(LEA))).statut, 401);
});
await test('seance_fin : tout compte connecté, cible « - » seulement', async () => {
  assert.equal((await deposer(LEA, { type: 'seance_fin', cible: '-' })).statut, 200);
  assert.equal((await deposer(KEV, { type: 'seance_fin', cible: 'x' })).statut, 401);
});
await test('compte_supprime : seulement pour un compte dont le dossier n’existe plus, cible = dest, jamais un chemin', async () => {
  const PARTI = 'parti@t,fr';
  // Le dossier existe encore : refusé, pour soi comme pour un autre.
  assert.equal((await deposer(LEA, { type: 'compte_supprime', dest: K(LEA), cible: K(LEA) })).statut, 401, 'son propre compte, encore là');
  assert.equal((await deposer(KEV, { type: 'compte_supprime', dest: K(LEA), cible: K(LEA) })).statut, 401, 'le compte d’un autre, encore là');
  // Le dossier n'existe pas : accepté, avec son verrou sous la clé du déposant.
  const r = await deposer(KEV, { type: 'compte_supprime', dest: PARTI, cible: PARTI });
  assert.equal(r.statut, 200, r.corps);
  assert.equal(JSON.parse((await appel('owner', 'GET', 'evenements_attente/' + K(KEV) + '/compte_supprime/' + PARTI)).corps).id, r.id);
  assert.equal((await deposer(KEV, { type: 'compte_supprime', dest: PARTI, cible: PARTI })).statut, 401, 'un deuxième tant que le premier attend');
  // La cible doit être dest ; ni vide, ni « - », ni un chemin.
  assert.equal((await deposer(KEV, { type: 'compte_supprime', dest: 'autre@t,fr', cible: '-' })).statut, 401, 'cible ≠ dest');
  assert.equal((await deposer(KEV, { type: 'compte_supprime', cible: '-' })).statut, 401, 'sans dest');
  assert.notEqual((await deposer(KEV, { type: 'compte_supprime', dest: 'a/b', cible: 'a/b' })).statut, 200, 'un chemin');
  // Celui qui supprime son compte : son dossier parti, il dépose pour lui-même.
  const SOI = 'soi@t.fr';
  await appel('owner', 'PUT', 'users/' + K(SOI), { fname: 'Soi' });
  assert.equal((await deposer(SOI, { type: 'compte_supprime', dest: K(SOI), cible: K(SOI) })).statut, 401);
  await appel('owner', 'DELETE', 'users/' + K(SOI));
  assert.equal((await deposer(SOI, { type: 'compte_supprime', dest: K(SOI), cible: K(SOI) })).statut, 200);
  // Et les nœuds du Worker restent fermés aux clients : lui seul les efface.
  await appel('owner', 'PUT', 'worker/profils/' + PARTI, { fname: 'Parti' });
  assert.equal((await appel(KEV, 'DELETE', 'worker/profils/' + PARTI)).statut, 401);
  assert.equal((await appel(KEV, 'GET', 'worker/profils/' + PARTI)).statut, 401);
});
await test('xp_serveur : écrit par le Worker seul, lu par l’athlète et son coach ; volts_publics lisible par tous', async () => {
  await appel('owner', 'PUT', 'users/' + K(LEA) + '/coachEmailKey', K(KEVIN));
  await appel('owner', 'PUT', 'xp_serveur/' + K(LEA), { total: 5000 });
  await appel('owner', 'PUT', 'volts_publics/lea_fer', { xp: 5000 });
  assert.equal((await appel(LEA, 'PUT', 'xp_serveur/' + K(LEA), { total: 999999 })).statut, 401, 'l’athlète n’écrit pas son total');
  assert.equal((await appel(LEA, 'GET', 'xp_serveur/' + K(LEA))).statut, 200);
  assert.equal((await appel(KEVIN, 'GET', 'xp_serveur/' + K(LEA))).statut, 200, 'son coach le lit');
  assert.equal((await appel(KEV, 'GET', 'xp_serveur/' + K(LEA))).statut, 401, 'un autre, non');
  assert.equal((await appel(LEA, 'GET', 'xp_etat/' + K(LEA))).statut, 401);
  assert.equal((await appel(LEA, 'PUT', 'volts_publics/lea_fer', { xp: 1 })).statut, 401);
  assert.equal((await fetch(BASE + '/volts_publics/lea_fer.json?ns=' + NS)).status, 200);
});
await test('offre de lancement : un code peut porter « ultime_demi » ; droits.offreAmb et demiPackUtilise écrits par le serveur seul', async () => {
  assert.equal((await appel(KEVIN, 'PUT', 'ambassadeurs_publics/LANCE', { nom: 'Julie', avantage: 'ultime_demi', actif: true })).statut, 200);
  assert.equal((await appel(KEVIN, 'PUT', 'ambassadeurs_publics/TRICHE', { nom: 'X', avantage: 'ultime_gratuit', actif: true })).statut, 401);
  assert.equal((await appel(LEA, 'PATCH', 'droits/' + K(LEA), { offreAmb: 'ultime_demi' })).statut, 401, 'l’athlète ne s’offre pas le demi-tarif');
  assert.equal((await appel(KEVIN, 'PATCH', 'droits/' + K(LEA), { offreAmb: 'ultime_demi', demiPackUtilise: true })).statut, 200);
});
await test('activite : chacun écrit SON résumé, personne ne le lit ; stats/retention au créateur seul, badges publics', async () => {
  const r = { v: 1, inscrit: '2026-10-01', sem: '2026-09-28', src: 'amb', debut: [0, 1, 8], jour: '2026-10-20', j30: '0'.repeat(29) + '1',
    seance1: true, parcours: false, finEssai: 0, payant: false, lev: { notif: true, coach: false } };
  assert.equal((await appel(LEA, 'PUT', 'activite/' + K(LEA), r)).statut, 200);
  assert.equal((await appel(LEA, 'PUT', 'activite/' + K(KEV), r)).statut, 401, 'celui d’un autre');
  assert.equal((await appel(LEA, 'PUT', 'activite/' + K(LEA), Object.assign({}, r, { poids: 80 }))).statut, 401, 'aucun champ en plus');
  assert.equal((await appel(LEA, 'PUT', 'activite/' + K(LEA), Object.assign({}, r, { lev: { humeur: true } }))).statut, 401, 'levier inconnu');
  assert.equal((await appel(LEA, 'GET', 'activite/' + K(LEA))).statut, 401, 'pas même le sien');
  await appel('owner', 'PUT', 'stats/retention', { comptes: 1 });
  await appel('owner', 'PUT', 'stats/badges', { total: 1, pct: {} });
  assert.equal((await appel(LEA, 'GET', 'stats/retention')).statut, 401);
  assert.equal((await appel(KEVIN, 'GET', 'stats/retention')).statut, 200);
  assert.equal((await fetch(BASE + '/stats/badges.json?ns=' + NS)).status, 200, 'les pourcentages des badges restent publics');
  assert.equal((await fetch(BASE + '/stats/retention.json?ns=' + NS)).status, 401);
});
console.log(ok + ' tests passés (émulateur)');
