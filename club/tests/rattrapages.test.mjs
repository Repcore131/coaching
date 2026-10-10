// « Ce que Fit Pulse a rapporté », prospects Meta (doublons), récap des résiliations.
//   TZ=Europe/Paris node club/tests/rattrapages.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { chargerAppli } from '../outils/fitpulse-rapport.mjs';

const J = (run, code) => JSON.parse(run(`JSON.stringify(${code})`));
const demo = () => { const run = chargerAppli('demo'); run(`CLUB = S.clubs.horizon; ME = S.users.u1;`); return run; };

test('#/rapporte : chaque euro renvoie à un dossier, la somme des lignes est le total', () => {
  const run = demo();
  run(`S.clients.c1.renewedAt = today(); S.clients.c1.end = addDays(today(), 365); S.loyalty.rx = { id: 'rx', clientId: 'c1', type: 'renouvellement', outcome: 'ok', userId: 'u2', at: Date.now() - 2 * 864e5 }; REV++;`);
  const R = J(run, `rapporteMois('horizon', curMonth())`);
  assert.equal(R.lignes.length, 4);
  for (const l of R.lignes) { assert.equal(Math.round(l.dossiers.reduce((s, d) => s + Math.round(d.euros * 100), 0)) / 100, l.total, l.cle); for (const d of l.dossiers) assert.ok(d.ref && d.date && d.libelle && Number.isFinite(d.euros), l.cle); }
  assert.equal(Math.round(R.lignes.reduce((s, l) => s + Math.round(l.total * 100), 0)) / 100, R.total);
  assert.ok(R.lignes.find(l => l.cle === 'renouvellements').dossiers.some(d => d.ref === 'c1'));
  assert.ok(R.lignes.find(l => l.cle === 'impayes').total > 0);
});

test('formulaires Meta : réimporter le même fichier ne crée aucun doublon, téléphones fusionnés', () => {
  const run = demo();
  const table = { headers: ['first_name', 'last_name', 'email', 'phone_number', 'created_time'], rows: [['Léa', 'Martin', 'lea@ex.fr', 'p:+33612345678', '2026-10-05T10:00:00+0200'], ['Léa', 'Martin', '', '06 12 34 56 78', ''], ['Hugo', 'Petit', 'hugo@ex.fr', '', ''], ['Sans', 'Contact', '', '', '']] };
  run(`__T = ${JSON.stringify(table)};`);
  const n0 = J(run, `Object.keys(S.prospects).length`);
  const r1 = J(run, `(() => { const p = metaPlan(__T, 'horizon'); p.ops.forEach(([a, b]) => setPath(S, a, b)); REV++; return p.res; })()`);
  assert.deepEqual(r1, { lues: 4, nouvelles: 2, fusionnees: 0, connues: 1, ignorees: 1 });
  const n1 = J(run, `Object.keys(S.prospects).length`); assert.equal(n1, n0 + 2);
  const r2 = J(run, `(() => { const p = metaPlan(__T, 'horizon'); p.ops.forEach(([a, b]) => setPath(S, a, b)); REV++; return p.res; })()`);
  assert.equal(r2.nouvelles, 0); assert.equal(J(run, `Object.keys(S.prospects).length`), n1);
  const lea = J(run, `Object.values(S.prospects).find(p => p.email === 'lea@ex.fr')`);
  assert.equal(lea.phone, '+33612345678'); assert.equal(lea.source, 'meta'); assert.equal(lea.etape, 'nouveau'); assert.equal(lea.creeLe, '2026-10-05');
});

test('étape et source déduites pour les fiches existantes', () => {
  const run = demo();
  assert.deepEqual(J(run, `[prospSource({ provenance: 'Réseaux sociaux Facebook' }), prospSource({ provenance: 'Site web' }), prospSource({ provenance: 'Passage' }), prospEtape({ id: 'x', clubId: 'horizon', statut: 'Essai', creeLe: today() })]`), ['meta', 'site', 'passage', 'essai']);
});

test('récap : préavis non respecté au seuil, dossier sans date de réception exclu et compté à part', () => {
  const run = demo();
  run(`const mk = curMonth(); S.clubs.horizon.preavisJours = 30; S.resiliations = {
    a: { id: 'a', clubId: 'horizon', client: 'A', date: mk + '-02', effective: addDays(mk + '-02', 10), status: 'nouvelle' },
    b: { id: 'b', clubId: 'horizon', client: 'B', date: mk + '-03', effective: addDays(mk + '-03', 45), status: 'nouvelle' },
    c: { id: 'c', clubId: 'horizon', client: 'C', effective: mk + '-20', status: 'nouvelle' } }; REV++;`);
  const R = J(run, `resRecap('horizon', curMonth())`);
  assert.equal(R.seuil, 30); assert.deepEqual(R.nonRespecte.map(r => r.id), ['a']); assert.deepEqual(R.sansDate.map(r => r.id), ['c']); assert.equal(R.avecDate.length, 2);
});

test('aucun libellé repris d’un concurrent', () => {
  const dir = new URL('../', import.meta.url);
  for (const f of readdirSync(dir).filter(f => /\.(js|html)$/.test(f))) assert.doesNotMatch(readFileSync(new URL(f, dir), 'utf8'), /Performance-ROI|CA additionnel|Leads Meta/i, f);
});
