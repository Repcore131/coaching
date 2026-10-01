// Les ligues (cloudflare/src/ligues.js, metier.js) : répartition
// déterministe en groupes de 20, montée et descente, fusion des petites
// divisions, absents non reclassés, égalités ; puis le travail du lundi, la
// séance en semaine et les push, sur une base en mémoire.
//   node --test cloudflare/test/ligues.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { creerBase } from '../src/base.js';
import { creerMetier, lundiParis } from '../src/metier.js';
import { travaux } from '../src/planif.js';
import * as L from '../src/ligues.js';
import { fausseBase } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const PARIS = (iso) => Date.parse(iso + '+02:00');
const J = 864e5;
// Lundi 12 octobre 2026, 00 h 45 à Paris : la semaine close est celle du 5.
const T = PARIS('2026-10-12T00:45:00');
const LUNDI = '2026-10-12', PREC = '2026-10-05', AVANT = '2026-09-28';
const cpt = (i, o) => Object.assign({ k: 'a' + String(i).padStart(3, '0') + '@t,fr', division: 'bronze', sem: { [PREC]: { v: 100 + i, n: 1 } }, debut: T - 90 * J }, o || {});

test('répartition : déterministe (graine = le lundi), groupes équilibrés de 20 au plus', () => {
  const comptes = Array.from({ length: 45 }, (_, i) => cpt(i));
  const a = L.repartir(comptes, T, LUNDI), b = L.repartir(comptes.slice().reverse(), T, LUNDI);
  assert.deepEqual(a, b, 'même lundi, mêmes groupes, quel que soit l’ordre de lecture');
  assert.deepEqual(a.map((g) => g.membres.length), [15, 15, 15]);
  assert.deepEqual(a.map((g) => g.id), ['bronze-1', 'bronze-2', 'bronze-3']);
  const tous = a.flatMap((g) => g.membres.map((m) => m.k));
  assert.equal(new Set(tous).size, 45, 'chacun une fois');
  const c = L.repartir(comptes, T + 7 * J, L.lundiPlus(LUNDI, 1));
  assert.notDeepEqual(c.map((g) => g.membres.map((m) => m.k)), a.map((g) => g.membres.map((m) => m.k)), 'un autre lundi, un autre mélange');
  // Vingt pile : un groupe ; vingt et un : deux de 11 et 10.
  assert.deepEqual(L.repartir(comptes.slice(0, 20), T, LUNDI).map((g) => g.membres.length), [20]);
  assert.deepEqual(L.repartir(comptes.slice(0, 21), T, LUNDI).map((g) => g.membres.length), [11, 10]);
});

test('répartition : actifs la semaine passée ou inscrits depuis moins de 14 jours ; coach, opt-out, suspension exclus', () => {
  const inactif = cpt(1, { sem: { [AVANT]: { v: 300, n: 2 } } });
  assert.equal(L.eligible(inactif, LUNDI, T), false, 'aucune séance la semaine passée');
  assert.equal(L.eligible(cpt(2, { sem: {}, debut: T - 10 * J }), LUNDI, T), true, 'nouveau, sans séance');
  assert.equal(L.eligible(cpt(3, { sem: {}, debut: T - 20 * J }), LUNDI, T), false);
  assert.equal(L.eligible(cpt(4, { coach: true }), LUNDI, T), false);
  assert.equal(L.eligible(cpt(5, { off: true }), LUNDI, T), false);
  assert.equal(L.eligible(cpt(6, { suspendu: true }), LUNDI, T), false);
  assert.equal(L.eligible(cpt(7), LUNDI, T), true);
});

test('fusion : une division de moins de 8 actifs rejoint sa voisine ; chacun garde sa division', () => {
  const comptes = [...Array.from({ length: 30 }, (_, i) => cpt(i)), ...Array.from({ length: 5 }, (_, i) => cpt(100 + i, { division: 'acier' }))];
  const g = L.repartir(comptes, T, LUNDI);
  assert.equal(g.length, 2);
  assert.ok(g.every((x) => x.division === 'bronze'), 'la division affichée : la majoritaire');
  assert.equal(g.flatMap((x) => x.membres).filter((m) => m.division === 'acier').length, 5, 'les 5 d’ACIER restent en ACIER');
  // LÉGENDE (3) rejoint TITAN (12) par le bas ; FOUDRE (4) et VOLTAGE (3) se mêlent jusqu'à 8 au moins.
  const p = L.fusionner([[], [], Array(3).fill({}), Array(4).fill({}), Array(12).fill({}), Array(3).fill({})]);
  assert.ok(p.every((x) => x.comptes.length >= L.FUSION_MIN), JSON.stringify(p.map((x) => [x.divs, x.comptes.length])));
  assert.deepEqual(p.map((x) => x.divs), [[2, 3, 4, 5]]);
  // Assez de monde partout : aucune fusion.
  assert.deepEqual(L.fusionner([Array(8).fill({}), Array(9).fill({})]).map((x) => x.divs), [[0], [1]]);
});

const groupe20 = (division) => ({ division, membres: Array.from({ length: 20 }, (_, i) => ({ k: 'm' + String(i).padStart(2, '0'), division })) });
const sem20 = () => Object.fromEntries(Array.from({ length: 20 }, (_, i) => ['m' + String(i).padStart(2, '0'), { v: 1000 - i * 10, n: 3, der: 1, nAvant: 1 }]));

test('clôture : le top 5 monte, les 5 derniers descendent, les autres restent', () => {
  const r = L.cloturer(groupe20('foudre'), sem20());
  assert.deepEqual(r.map((x) => x.place), Array.from({ length: 20 }, (_, i) => i + 1));
  assert.deepEqual(r.slice(0, 5).map((x) => [x.mouvement, x.vers]), Array(5).fill(['monte', 'titan']));
  assert.ok(r.slice(5, 15).every((x) => x.mouvement === 'reste' && x.vers === 'foudre'));
  assert.deepEqual(r.slice(15).map((x) => [x.mouvement, x.vers]), Array(5).fill(['descend', 'voltage']));
  // En BRONZE, personne ne descend ; en LÉGENDE, personne ne monte plus haut.
  const b = L.cloturer(groupe20('bronze'), sem20());
  assert.ok(b.slice(15).every((x) => x.mouvement === 'reste' && x.vers === 'bronze'));
  const l = L.cloturer(groupe20('legende'), sem20());
  assert.ok(l.slice(0, 5).every((x) => x.mouvement === 'reste' && x.vers === 'legende'));
  assert.ok(l.slice(15).every((x) => x.mouvement === 'descend' && x.vers === 'titan'));
  // Un petit groupe : un tiers monte, un tiers descend, jamais les mêmes.
  assert.equal(L.nMonte(8), 2); assert.equal(L.nMonte(15), 5); assert.equal(L.nMonte(2), 0);
});

test('clôture : égalité départagée par les séances, puis la dernière séance la plus tôt', () => {
  const g = { division: 'acier', membres: ['x', 'y', 'z'].map((k) => ({ k, division: 'acier' })) };
  const r = L.cloturer(g, { x: { v: 500, n: 2, der: 30 }, y: { v: 500, n: 3, der: 50 }, z: { v: 500, n: 2, der: 10 } });
  assert.deepEqual(r.map((x) => x.k), ['y', 'z', 'x']);
});

test('absents : deux semaines sans séance, pas de reclassement ; une seule, classé ; suspendu, sans descente', () => {
  const s = sem20();
  s.m03 = { v: 0, n: 0, nAvant: 0 };             // absent deux semaines
  s.m04 = { v: 0, n: 0, nAvant: 2 };             // absent une semaine : classé (dernier)
  s.m05 = { v: 0, n: 0, nAvant: 2, suspendu: true };
  const r = L.cloturer(groupe20('titan'), s);
  const de = (k) => r.find((x) => x.k === k);
  assert.deepEqual([de('m03').mouvement, de('m03').vers, de('m03').place], ['sorti', 'titan', 0]);
  assert.deepEqual([de('m05').mouvement, de('m05').vers], ['sorti', 'titan']);
  assert.deepEqual([de('m04').mouvement, de('m04').place, de('m04').taille], ['descend', 18, 18]);
});

test('zone de bascule : 6e à 8e (sous la montée), 13e à 16e (autour de la descente) ; messages', () => {
  const z = Array.from({ length: 20 }, (_, i) => L.zoneBascule(i + 1, 20, 'foudre'));
  assert.deepEqual(z.map((x, i) => x && i + 1).filter(Boolean), [6, 7, 8, 13, 14, 15, 16]);
  assert.equal(L.zoneBascule(14, 20, 'bronze'), null, 'pas de descente en BRONZE');
  assert.equal(L.zoneBascule(6, 20, 'legende'), null, 'rien au-dessus de LÉGENDE');
  const m = L.messageBascule(6, 20, 'foudre', 'monte');
  assert.equal(m.title, 'Tu es 6e de ta ligue FOUDRE');
  assert.match(m.body, /top 5 monte/);
  assert.equal(m.type, 'defi'); assert.equal(m.prio, 'ligue');
  assert.equal(L.messageResultat({ mouvement: 'monte', vers: 'titan', place: 2, taille: 20 }).title, 'Tu montes en TITAN ⚡');
  assert.equal(L.nomPublic('marc.fit', 3), 'marc.fit');
  assert.equal(L.nomPublic('', 6), 'Athlète 7');
  assert.equal(L.cleNom('marc.fit'), 'marc__fit');
  // Le groupe d'arrivée en semaine : le moins plein de sa division, sinon la plus proche.
  assert.deepEqual(L.groupeDArrivee({ bronze: { 'bronze-1': 20, 'bronze-2': 18 } }, 'bronze'), { g: 'bronze-2', division: 'bronze' });
  assert.deepEqual(L.groupeDArrivee({ bronze: { 'bronze-1': 24 }, acier: { 'acier-1': 12 } }, 'bronze'), { g: 'acier-1', division: 'acier' });
  assert.equal(L.groupeDArrivee({}, 'titan'), null);
});

// ══ SUR UNE BASE EN MÉMOIRE ═══════════════════════════════════════════════
function monde(initial, t) {
  const F = fausseBase(initial);
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: F.fetchImpl });
  let horloge = t;
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: F.fetchImpl, maintenant: () => horloge });
  return { F, M, db, avance: (ms) => { horloge += ms; }, get t() { return horloge; } };
}
// 22 athlètes actifs la semaine du 5 (score 100 + 10 i), un coach, un opt-out.
function dossiers() {
  const o = { xp_etat: {}, users: {}, pseudos: {} };
  for (let i = 0; i < 22; i++) {
    const k = 'a' + String(i).padStart(2, '0') + '@t,fr';
    o.xp_etat[k] = { n: 3, debut: T - 60 * J, derniere: T - 2 * J - i * 60e3, sem: { [PREC]: { v: 100 + 10 * i, n: 2 } } };
    o.users[k] = { role: 'athlete', fname: 'A' + i };
  }
  o.users['a00@t,fr'].pagePublique = { pseudo: 'lea.fit' }; o.pseudos.lea__fit = 'a00@t,fr';
  // Un pseudo usurpé (pas le sien) n'est pas affiché.
  o.users['a01@t,fr'].pagePublique = { pseudo: 'kevin' }; o.pseudos.kevin = 'autre@t,fr';
  o.xp_etat['coach@t,fr'] = { n: 1, debut: T - 60 * J, sem: { [PREC]: { v: 900, n: 3 } } };
  o.users['coach@t,fr'] = { role: 'coach' };
  o.xp_etat['off@t,fr'] = { n: 1, debut: T - 60 * J, sem: { [PREC]: { v: 900, n: 3 } } };
  o.users['off@t,fr'] = { role: 'athlete', liguesOff: true };
  return o;
}
async function lundiMatin(w) {
  const acc = {};
  for (const k of (await w.M.liguesComptes()).slice().sort()) await w.M.liguesUn(k, w.t, acc);
  await w.M.liguesFin(acc, w.t);
  return acc;
}

test('le lundi 00 h 30 : les groupes, les noms publics (jamais une adresse), coach et opt-out dehors', async () => {
  const w = monde(dossiers(), T);
  assert.equal(lundiParis(T), LUNDI);
  await lundiMatin(w);
  const gs = w.F.lire('ligues/' + LUNDI);
  assert.deepEqual(Object.keys(gs).sort(), ['bronze-1', 'bronze-2']);
  assert.deepEqual(Object.values(gs).map((g) => g.n), [11, 11]);
  const txt = JSON.stringify([gs, w.F.lire('ligues_public/' + LUNDI)]);
  assert.ok(!/@|,fr/.test(txt), 'aucune clé de compte dans ce que lisent les membres');
  assert.match(txt, /lea\.fit/);
  assert.ok(!/kevin/.test(txt), 'un pseudo usurpé n’est pas affiché');
  assert.match(txt, /Athlète \d+/);
  assert.equal(w.F.lire('ligues_membres/coach@t,fr'), null);
  assert.equal(w.F.lire('ligues_membres/off@t,fr'), null);
  const m = w.F.lire('ligues_membres/a00@t,fr');
  assert.equal(m.lundi, LUNDI); assert.equal(m.nom, 'lea.fit'); assert.equal(m.division, 'bronze');
  // Relancer la fin (une minute coupée) rend les mêmes groupes.
  const avant = JSON.stringify(w.F.lire('ligues'));
  await lundiMatin(w);
  assert.equal(JSON.stringify(w.F.lire('ligues')), avant);
});

test('en semaine : la séance met à jour la ligne du groupe ; un compte hors ligue entre dans sa division', async () => {
  const w = monde(dossiers(), T);
  await lundiMatin(w);
  w.avance(2 * J);                                   // mercredi
  const etat = { derniere: w.t, sem: { [LUNDI]: { v: 260, n: 2 } } };
  const maj = {};
  assert.equal(await w.M.liguesApresSeance('a00@t,fr', etat, w.t, maj), 'maj');
  const g = w.F.lire('ligues_membres/a00@t,fr').groupe;
  assert.deepEqual(maj, { ['ligues_public/' + LUNDI + '/' + g + '/lea__fit']: { nom: 'lea.fit', v: 260, n: 2, der: w.t } });
  // Un nouveau venu : il entre dans le groupe le moins plein, sous un nom public.
  w.F.ecrire('users/neuf@t,fr', { role: 'athlete' });
  const m2 = {};
  assert.equal(await w.M.liguesApresSeance('neuf@t,fr', { derniere: w.t, sem: { [LUNDI]: { v: 100, n: 1 } } }, w.t, m2), 'entre');
  await w.db.ref().update(m2);
  const mn = w.F.lire('ligues_membres/neuf@t,fr');
  assert.equal(mn.division, 'bronze');
  assert.equal(w.F.lire('ligues_index/' + LUNDI + '/bronze/' + mn.groupe), 12);
  assert.equal(mn.nom, 'Athlète 12');
  assert.equal(w.F.lire('ligues/' + LUNDI + '/' + mn.groupe + '/membres/Athlète_12'), true);
  // Coach et opt-out n'entrent pas.
  assert.equal(await w.M.liguesApresSeance('coach@t,fr', etat, w.t, {}), 'hors');
  assert.equal(await w.M.liguesApresSeance('off@t,fr', etat, w.t, {}), 'hors');
});

test('le lundi suivant : la clôture (résultats, montées), le samedi la zone de bascule, le lundi 9 h le résultat', async () => {
  const w = monde(dossiers(), T);
  await lundiMatin(w);
  const g = w.F.lire('ligues_prive/' + LUNDI);
  const groupe = Object.keys(g).sort()[0], ks = Object.keys(g[groupe]).sort();
  // La semaine : chacun s'entraîne, scores 1000 - 50 i dans l'ordre des clés (sauf le dernier, absent).
  ks.forEach((k, i) => {
    if (i === ks.length - 1) return;
    w.F.ecrire('xp_etat/' + k + '/sem/' + LUNDI, { v: 1000 - 50 * i, n: 2 });
    const nom = g[groupe][k].nom;
    w.F.ecrire('ligues_public/' + LUNDI + '/' + groupe + '/' + L.cleNom(nom), { nom, v: 1000 - 50 * i, n: 2, der: T + J });
  });
  // SAMEDI 11 H : la zone de bascule (11 membres : 3 montent ; 4e à 6e, et autour des 3 derniers).
  w.avance(5 * J + 10 * 3600e3 + 15 * 60e3);
  const nPush = await w.M.liguesSamediUn(groupe, w.t);
  const taches = Object.values(w.F.lire('evenements') || {}).filter((e) => e.quoi === 'push');
  assert.equal(taches.length, nPush);
  assert.ok(taches.some((e) => e.uid === ks[3] && /Tu es 4e de ta ligue BRONZE/.test(e.message.title)), JSON.stringify(taches.map((e) => [e.uid, e.message.title])));
  assert.ok(!taches.some((e) => e.uid === ks[0]), 'le premier n’est pas en zone de bascule');
  assert.ok(taches.every((e) => e.message.prio === 'ligue' && e.message.type === 'defi'));
  w.F.ecrire('evenements', null);
  // LUNDI SUIVANT 00 H 45 : la clôture.
  w.avance(T + 7 * J - w.t);
  await lundiMatin(w);
  const r0 = w.F.lire('ligues_resultats/' + ks[0] + '/' + LUNDI), rd = w.F.lire('ligues_resultats/' + ks[ks.length - 2] + '/' + LUNDI);
  assert.deepEqual([r0.place, r0.mouvement, r0.vers], [1, 'monte', 'acier']);
  assert.deepEqual([rd.mouvement, rd.vers], ['reste', 'bronze'], 'en BRONZE, personne ne descend');
  assert.equal(w.F.lire('ligues_membres/' + ks[0]).division, 'acier', 'il commence la semaine en ACIER');
  // Le dernier, absent cette semaine mais actif la précédente : classé (dernier), pas sorti.
  const ra = w.F.lire('ligues_resultats/' + ks[ks.length - 1] + '/' + LUNDI);
  assert.equal(ra.mouvement, 'reste'); assert.equal(ra.place, ks.length);
  // LUNDI 9 H : un push de résultat pour chaque classé du groupe.
  w.avance(8 * 3600e3 + 15 * 60e3);
  const n9 = await w.M.liguesLundiUn(groupe, w.t);
  assert.equal(n9, ks.length);
  const res = Object.values(w.F.lire('evenements') || {}).filter((e) => e.quoi === 'push' && e.uid === ks[0]);
  assert.equal(res[0].message.title, 'Tu montes en ACIER ⚡');
});

test('le planificateur : lundi 00 h 30, samedi 11 h, lundi 9 h', () => {
  const w = travaux({ planifies: {} }).filter((x) => /^ligues/.test(x.nom));
  assert.deepEqual(w.map((x) => x.nom), ['ligues', 'ligues_sam', 'ligues_lundi']);
  const p = (joursem, heure, minute) => ({ joursem, heure, minute });
  assert.equal(w[0].quand(p(1, 0, 29)), false); assert.equal(w[0].quand(p(1, 0, 30)), true); assert.equal(w[0].quand(p(2, 0, 30)), false);
  assert.equal(w[1].quand(p(6, 11, 0)), true); assert.equal(w[1].quand(p(6, 10, 59)), false);
  assert.equal(w[2].quand(p(1, 9, 0)), true); assert.equal(w[2].quand(p(1, 8, 59)), false);
});
