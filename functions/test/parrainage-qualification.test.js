// Le filleul qualifié et le plafond du parrain (règles pures, 01/10/2026).
//   node --test 'functions/test/*.test.js'
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../parrainage-calcul");

const J = 864e5;
const T = Date.UTC(2026, 9, 1, 10);          // 1er octobre 2026, 12 h à Paris
const faite = (d) => ({ date: d, data: { Squat: { sets: [{ done: true, weight: "60", reps: "8" }] } } });
const vide = (d) => ({ date: d, data: { Squat: { sets: [{ done: false }] } } });

test("4 séances le même jour → non qualifié", () => {
  const s = [0, 1, 2, 3].map((h) => faite(T - 12 * J + h * 3600e3));
  assert.equal(P.filleulQualifie(s, true, T), false);
});
test("4 jours distincts sur 12 jours, e-mail vérifié → qualifié", () => {
  const s = [12, 8, 4, 0].map((k) => faite(T - k * J));
  assert.equal(P.filleulQualifie(s, true, T), true);
});
test("e-mail non vérifié → non qualifié, même avec les séances", () => {
  const s = [12, 8, 4, 0].map((k) => faite(T - k * J));
  assert.equal(P.filleulQualifie(s, false, T), false);
  assert.equal(P.filleulQualifie(s, undefined, T), false);
  assert.equal(P.filleulQualifie(s, "true", T), false, "seul le booléen true compte");
});
test("4 jours distincts mais sur moins de 10 jours → non qualifié", () => {
  assert.equal(P.filleulQualifie([9, 6, 3, 0].map((k) => faite(T - k * J)), true, T), false);
  assert.equal(P.filleulQualifie([10, 6, 3, 0].map((k) => faite(T - k * J)), true, T), true, "10 jours pile");
});
test("une séance sans série validée, ou datée dans le futur, ne compte pas", () => {
  const s = [faite(T - 12 * J), faite(T - 8 * J), faite(T - 4 * J), vide(T)];
  assert.equal(P.filleulQualifie(s, true, T), false);
  assert.equal(P.filleulQualifie(s.slice(0, 3).concat([faite(T + 2 * J)]), true, T), false);
  // Objet indexé (forme Firebase) accepté.
  assert.equal(P.filleulQualifie({ 0: faite(T - 12 * J), 1: faite(T - 8 * J), 2: faite(T - 4 * J), 3: faite(T) }, true, T), true);
});

const compte = (n, le) => ({ filleuls: Object.fromEntries(Array.from({ length: n }, (_, i) => ["f" + i, { creditE: true, creditLe: le, statut: "payant" }])) });
test("premier paiement : non qualifié → payant en attente, aucun mois", () => {
  const c = { filleuls: { x: { prenom: "Léa" } } };
  const r = P.premierPaiement(c, "x", T, { qualifie: false, auPaiement: true });
  assert.equal(r.credit, false); assert.equal(r.enAttente, true); assert.equal(r.filleul.statut, "payant");
  // Puis la qualification arrive : c'est le seuil qui crédite.
  const c2 = { filleuls: { x: Object.assign({}, c.filleuls.x, r.filleul) } };
  const s = P.seuilSeances(c2, "x", T + J, { qualifie: true, auPaiement: true });
  assert.equal(s.credit, true);
});
test("au paiement : qualifié mais pas encore payé → le seuil ne crédite rien", () => {
  assert.equal(P.seuilSeances({ filleuls: { x: {} } }, "x", T, { qualifie: true, auPaiement: true }), null);
  assert.equal(P.seuilSeances({ filleuls: { x: { statut: "payant" } } }, "x", T, { qualifie: false, auPaiement: true }), null);
});
test("plafond : 6 mois sur 12 mois glissants, le 7e est refusé ; au-delà d'un an, il repart", () => {
  const plein = compte(6, T - 30 * J);
  plein.filleuls.x = { statut: undefined };
  const r = P.premierPaiement(plein, "x", T, { qualifie: true, auPaiement: true });
  assert.equal(r.credit, false); assert.equal(r.plafond, true); assert.equal(r.filleul.plafondLe, T);
  assert.equal(r.moisGagnes, 0);
  const vieux = compte(6, T - 400 * J); vieux.filleuls.x = {};
  assert.equal(P.premierPaiement(vieux, "x", T, { qualifie: true, auPaiement: true }).credit, true);
  // Le mois du palier des 10 compte dans le plafond.
  const m = compte(5, T - 30 * J); m.mentorLe = T - 10 * J; m.filleuls.x = {};
  assert.equal(P.moisOffertsSurUnAn(m, T), 6);
  assert.equal(P.premierPaiement(m, "x", T, { qualifie: true, auPaiement: true }).plafond, true);
  // Refusé une fois : on ne le rejuge pas.
  const c2 = { filleuls: { x: { statut: "payant", plafondLe: T } } };
  assert.equal(P.seuilSeances(c2, "x", T + J, { qualifie: true, auPaiement: true }), null);
});
test("sans options (ancien appelant) : le comportement d'avant", () => {
  assert.equal(P.premierPaiement({ filleuls: { x: {} } }, "x", T).credit, true);
  assert.equal(P.seuilSeances({ filleuls: { x: {} } }, "x", T).credit, true);
});
