// Le risque d'abandon (risque.js) : les variables d'un résumé connu, la cible
// sans fuite du futur, l'entraînement déterministe, le repli sur les poids
// par défaut, et un modèle publié sans aucune clé de compte.
//   node cloudflare/test/risque.test.mjs
import assert from 'node:assert/strict';
import * as RQ from '../src/risque.js';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const T = Date.parse('2026-10-05T10:00:00Z');   // aujourd'hui (Paris) : 2026-10-05

await test('variables : un résumé connu, compté à la main', () => {
  // Les 30 derniers jours, le dernier = aujourd'hui : rien pendant 16 jours, puis 9 jours actifs sur 14.
  const r = { inscrit: '2026-07-01', jour: '2026-10-05', j30: '0000000000000000' + '11100110101101', lev: { checkin: true, coach: true } };
  assert.deepEqual(RQ.variables(r, T, 0), { a7: 0.571, a14: 0.643, a30: 0.3, pente: 0.643, dernier: 0,
    checkin: 1, notif: 0, coach: 1, anciennete: 0.533 });
  // Muet depuis 5 jours (résumé publié il y a 5 jours, rien après) : les jours après r.jour sont inactifs.
  const v = RQ.variables({ inscrit: '2026-09-01', jour: '2026-09-30', j30: '1'.repeat(30), lev: {} }, T, 0);
  assert.equal(v.dernier, 0.167);
  assert.equal(v.a7, 0.286);
  // Les jours avant l'inscription ne comptent pas : inscrit il y a 3 jours, actif les 3.
  const n = RQ.variables({ inscrit: '2026-10-03', jour: '2026-10-05', j30: '0'.repeat(27) + '111', lev: {} }, T, 0);
  assert.equal(n.a7, 1);
  assert.equal(n.anciennete, 0.011);
  assert.equal(RQ.variables({ inscrit: 'x' }, T, 0), null);
  assert.equal(RQ.variables({ inscrit: '2026-10-10', jour: '2026-10-05', j30: '0' }, T, 0), null);
});

await test('cible et exemple : 14 jours après une observation placée 14 jours avant, sans rien du futur dans les variables', () => {
  // Muet jusqu'à l'observation, actif après : cible 1, et les variables (à l'observation) ne voient rien.
  const r = { inscrit: '2026-08-01', jour: '2026-10-05', j30: '0'.repeat(16) + '00000000000001', lev: {} };
  assert.equal(RQ.cible(r, T), 1);
  const ex = RQ.exemple('a@b,fr', r, T);
  assert.deepEqual(ex.slice(1, 6), [1, 0, 0, 0, 0]);
  // L'inverse : actif avant l'observation, muet après.
  const s = { inscrit: '2026-08-01', jour: '2026-10-05', j30: '1'.repeat(16) + '0'.repeat(14), lev: {} };
  assert.equal(RQ.cible(s, T), 0);
  assert.ok(RQ.exemple('x', s, T)[2] > 0);
  // Inscrit après l'observation, ou parti avant : pas un exemple.
  assert.equal(RQ.cible({ inscrit: '2026-10-01', jour: '2026-10-05', j30: '1' }, T), null);
  assert.equal(RQ.cible({ inscrit: '2026-01-01', jour: '2026-09-01', j30: '1' }, T), null);
  // Le tirage du jeu de test est stable : la même clé, le même côté.
  assert.equal(RQ.enTest('lea@t,fr'), RQ.enTest('lea@t,fr'));
});

// Un jeu synthétique séparable : les actifs récents restent, les muets partent.
function jeu(n) {
  const l = [];
  for (let i = 0; i < n; i++) {
    const actif = i % 2 === 0;
    const x = { a7: actif ? 0.6 + (i % 5) / 20 : (i % 3) / 20, a14: actif ? 0.55 : 0.05, a30: actif ? 0.5 : 0.1, pente: actif ? 0.2 : -0.3,
      dernier: actif ? 0.03 : 0.7 + (i % 4) / 20, checkin: i % 3 === 0 ? 1 : 0, notif: i % 2, coach: i % 5 === 0 ? 1 : 0, anciennete: (i % 9) / 9 };
    l.push([RQ.enTest('compte' + i) ? 1 : 0, actif ? 1 : 0].concat(RQ.VARIABLES.map((k) => x[k])));
  }
  return l;
}

await test('entraînement : un jeu séparable donne une AUC > 0,9 ; deux nuits, les mêmes poids', () => {
  const L = jeu(400);
  const m = RQ.modele(L, T);
  assert.equal(m.defaut, false);
  assert.ok(m.nTest >= 40 && m.nTest <= 120, 'environ 20 % tenus à l’écart : ' + m.nTest);
  assert.ok(m.auc > 0.9, 'AUC ' + m.auc);
  assert.ok(m.poids.dernier < 0 && m.poids.a7 > 0);
  assert.deepEqual(RQ.modele(L, T).poids, m.poids);
  // Un muet depuis trois semaines est à risque ; un actif ne l'est pas.
  assert.ok(RQ.risque({ a7: 0, a14: 0, a30: 0.1, pente: -0.3, dernier: 0.8 }, m.poids) >= RQ.SEUIL_RISQUE);
  assert.ok(RQ.risque({ a7: 0.7, a14: 0.6, a30: 0.5, pente: 0.1, dernier: 0 }, m.poids) < 0.3);
});

await test('jeu trop petit (ou une classe sous 30) : les poids par défaut, documentés', () => {
  const petit = RQ.modele(jeu(150), T);
  assert.equal(petit.defaut, true);
  assert.deepEqual(petit.poids, Object.assign({}, RQ.POIDS_DEFAUT));
  const desequilibre = RQ.modele(jeu(400).map((l, i) => (i % 2 === 1 && i > 40 ? null : l)).filter(Boolean), T);
  assert.equal(desequilibre.defaut, true);
  // Les poids par défaut disent déjà l'essentiel.
  assert.ok(RQ.risque({ dernier: 1 }, RQ.POIDS_DEFAUT) >= RQ.SEUIL_RISQUE);
  assert.ok(RQ.risque({ a7: 0.7, a14: 0.6, a30: 0.5, dernier: 0 }, RQ.POIDS_DEFAUT) < RQ.SEUIL_RISQUE);
});

await test('risque_modele ne porte aucune clé de compte', () => {
  const L = jeu(400);
  const m = RQ.modele(L, T);
  const j = JSON.stringify(m);
  for (let i = 0; i < 400; i++) assert.equal(j.indexOf('compte' + i), -1);
  assert.deepEqual(Object.keys(m).sort(), ['auc', 'defaut', 'n', 'nTest', 'poids', 'positifs', 't']);
  assert.deepEqual(Object.keys(m.poids).sort(), ['biais'].concat(RQ.VARIABLES).sort());
  // L'exemple non plus : [test, cible, variables…], que des nombres.
  assert.ok(RQ.exemple('lea@t,fr', { inscrit: '2026-08-01', jour: '2026-10-05', j30: '1'.repeat(30) }, T).every((x) => typeof x === 'number'));
});

console.log(ok + ' tests risque');
