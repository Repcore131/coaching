// Un compte supprimé (événement compte_supprime) : le Worker efface, en UN
// update multi-chemins, ce que lui seul tient pour ce compte hors du dossier
// (COMPTE_NOEUDS), et rien tant que users/<clé> existe.
//   node --test cloudflare/test/compte-supprime.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { creerBase } from '../src/base.js';
import { creerMetier, COMPTE_NOEUDS, cleCompteValide } from '../src/metier.js';
import { minute } from '../src/planif.js';
import { fausseBase } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const T = Date.parse('2026-10-06T15:00:00+02:00');
const LEA = 'lea@t,fr', TOM = 'tom@t,fr', KEV = 'kev@t,fr';

// Tout ce que le Worker tient pour un compte, plus ses verrous de file.
const etatDe = (k) => ({
  worker: { profils: { [k]: { maj: T, fname: 'Prénom', status: 'actif', accessExpiry: T + 864e5, streak: 4 } },
    relances_acces: { [k]: { j7: T } } },
  push_log: { [k]: { jour: '2026-10-06', at: T, type: 'serie' } },
  push_attente: { [k]: { type: 'serie', title: 'x', at: T } },
  retour_etat: { [k]: { depuis: T, paliers: { 7: T } } },
  xp_etat: { [k]: { n: 3 } },
  xp_serveur: { [k]: { total: 300 } },
  evenements_attente: { [k]: { seance_fin: { '-': { id: 'eancien0001', at: T - 864e5 } } } },
});
const fusion = (...os) => {
  const r = {};
  const dans = (a, b) => { for (const [k, v] of Object.entries(b)) { if (v && typeof v === 'object') { a[k] = a[k] || {}; dans(a[k], v); } else a[k] = v; } };
  for (const o of os) dans(r, o);
  return r;
};

function monde(initial) {
  const F = fausseBase(initial);
  let n = 0;
  const ecritures = [];
  const fetchCompte = (u, i) => { n++; if (i && i.method && i.method !== 'GET') ecritures.push({ methode: i.method, chemin: new URL(u).pathname, corps: i.body ? JSON.parse(i.body) : null }); return F.fetchImpl(u, i); };
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: fetchCompte });
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: fetchCompte, maintenant: () => T });
  M.coachsEtUsers = () => db.ref('users').shallow();
  M.abonnes = () => db.ref('push').shallow();
  return { F, M, ecritures, minute: () => { n = 0; return minute({ db, M, compteur: () => n, maintenant: () => T }); } };
}
const chemins = (k) => COMPTE_NOEUDS.map((x) => x + '/' + k).concat('evenements_attente/' + k);

test('la liste des nœuds par compte : les sept de la consigne', () => {
  assert.deepEqual([...COMPTE_NOEUDS].sort(),
    ['push_attente', 'push_log', 'retour_etat', 'worker/profils', 'worker/relances_acces', 'xp_etat', 'xp_serveur']);
});

test('compte supprimé par l’athlète : plus aucun de ses nœuds, en un seul update, le voisin intact', async () => {
  const w = monde(fusion(etatDe(LEA), etatDe(TOM), { users: { [TOM]: { fname: 'Tom' } },
    evenements: { e1aaaaaaaa: { type: 'compte_supprime', par: LEA, dest: LEA, cible: LEA, at: T } } }));
  for (const c of chemins(LEA)) assert.ok(w.F.lire(c) !== null, 'présent avant : ' + c);
  assert.equal(await w.M.evenement({ type: 'compte_supprime', par: LEA, dest: LEA, cible: LEA, at: T }), 'efface');
  for (const c of chemins(LEA)) assert.equal(w.F.lire(c), null, 'effacé : ' + c);
  for (const c of chemins(TOM)) assert.ok(w.F.lire(c) !== null, 'le voisin garde : ' + c);
  // UN update multi-chemins, à la racine, et rien d'autre d'écrit.
  assert.equal(w.ecritures.length, 1);
  assert.equal(w.ecritures[0].methode, 'PATCH');
  assert.equal(w.ecritures[0].chemin, '/.json');
  assert.deepEqual(Object.keys(w.ecritures[0].corps).sort(), chemins(LEA).sort());
  assert.ok(Object.values(w.ecritures[0].corps).every((v) => v === null));
});

test('par la file : l’événement traité quitte la file, et la clé du compte n’apparaît plus nulle part', async () => {
  const w = monde(fusion(etatDe(LEA), { users: { [KEV]: { fname: 'Kevin' } },
    evenements: { e1aaaaaaaa: { type: 'compte_supprime', par: LEA, dest: LEA, cible: LEA, at: T } },
    evenements_attente: { [LEA]: { compte_supprime: { [LEA]: { id: 'e1aaaaaaaa', at: T } } } } }));
  await w.minute();
  assert.equal(w.F.lire('evenements'), null);
  assert.ok(!JSON.stringify(w.F.arbre).includes(LEA), JSON.stringify(w.F.arbre));
});

test('dossier effacé par le coach : les nœuds de l’athlète partent, et le verrou posé sous la clé du coach aussi', async () => {
  const w = monde(fusion(etatDe(LEA), etatDe(KEV), { users: { [KEV]: { fname: 'Kevin' } },
    evenements_attente: { [KEV]: { compte_supprime: { [LEA]: { id: 'e1aaaaaaaa', at: T } } } } }));
  assert.equal(await w.M.evenement({ type: 'compte_supprime', par: KEV, dest: LEA, cible: LEA, at: T }), 'efface');
  for (const c of chemins(LEA)) assert.equal(w.F.lire(c), null, c);
  assert.equal(w.F.lire('evenements_attente/' + KEV + '/compte_supprime'), null);
  for (const c of chemins(KEV)) assert.ok(w.F.lire(c) !== null, 'le coach garde : ' + c);
});

test('le compte existe encore : rien n’est effacé, rien n’est écrit', async () => {
  const depart = fusion(etatDe(LEA), { users: { [LEA]: { fname: 'Léa' } } });
  const w = monde(depart);
  assert.equal(await w.M.evenement({ type: 'compte_supprime', par: KEV, dest: LEA, cible: LEA, at: T }), 'compte_existe');
  assert.equal(await w.M.evenement({ type: 'compte_supprime', par: LEA, dest: LEA, cible: LEA, at: T }), 'compte_existe');
  assert.equal(w.ecritures.length, 0);
  assert.deepEqual(w.F.arbre, depart);
});

test('une clé vide ou qui serait un chemin : refusée avant toute requête (elle viserait un nœud entier)', async () => {
  const depart = fusion(etatDe(LEA), etatDe(TOM));
  const w = monde(depart);
  for (const dest of ['', undefined, '/', 'lea@t,fr/jour', 'a/b', 'lea@t.fr', 'a#b', 'a$b', 'a[b', 'a]b', 'x'.repeat(201), 42, { a: 1 }]) {
    assert.equal(await w.M.evenement({ type: 'compte_supprime', par: KEV, dest, cible: '-', at: T }), 'cle_invalide', String(dest));
  }
  assert.equal(w.F.requetes(), 0);
  assert.deepEqual(w.F.arbre, depart);
  assert.ok(cleCompteValide(LEA));
});

test('chaque nœud par compte que le Worker écrit est dans la liste, et le README la donne', () => {
  // Tout « '<nœud>/' + uid|k|cle » écrit ou lu dans metier.js, hors dossiers que l'app efface elle-même.
  const src = readFileSync(new URL('../src/metier.js', import.meta.url), 'utf8');
  for (const n of COMPTE_NOEUDS) assert.ok(src.includes("'" + n + "/' + "), n + ' : encore utilisé par metier.js');
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  for (const n of COMPTE_NOEUDS) assert.ok(readme.includes('`' + n + '/<clé>`'), 'README : ' + n);
  assert.ok(readme.includes('compte_supprime'));
});

test('l’app dépose compte_supprime sur ses trois parcours, et les règles l’admettent', () => {
  const dir = new URL('../../app/', import.meta.url);
  const src = readFileSync(new URL(readdirSync(dir).find((x) => /^rc-core\.\d+\.js$/.test(x)), dir), 'utf8');
  assert.match(src, /deposerEvenement\(\{type:'compte_supprime',dest:String\(cle\|\|''\)\}\)/);
  // Les deux gestes du coach passent par supprimerDossier ; l'athlète attend le dépôt avant d'effacer son identité.
  const dossier = src.slice(src.indexOf('async supprimerDossier(email){'));
  assert.match(dossier.slice(0, 900), /if\(r\.ok\) compteSupprimeSignaler\(key\)/);
  const soi = src.slice(src.indexOf('async function requestAccountDeletion(){'));
  const iDepot = soi.indexOf('await compteSupprimeSignaler(safeKey)'), iDossier = soi.indexOf("'users/'+safeKey+'.json'"), iIdentite = soi.indexOf('accounts:delete');
  assert.ok(iDossier > 0 && iDepot > iDossier && iIdentite > iDepot, 'dossier, puis dépôt, puis identité');
  const regles = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8');
  assert.match(regles, /\|message\|compte_supprime\)\$/);
  assert.ok(regles.includes("=== 'compte_supprime' && newData.val() === newData.parent().child('dest').val() && newData.val().length > 0 && !newData.val().contains('/') && !root.child('users').child(newData.val()).exists()"));
});
