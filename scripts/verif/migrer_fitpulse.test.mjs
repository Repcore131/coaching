// node --test scripts/verif/migrer_fitpulse.test.mjs — sur de FAUSSES bases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planMigrationFitpulse, memeValeur, texteMigration, NOEUDS_FITPULSE } from '../migrer_fitpulse.mjs';
import { comparerRegles } from './regles_en_ligne.mjs';

const RC = { pulse: { club: { a: 1, b: { c: 2 } } }, pulse_boot: { x: 1 }, fitpulse_mail: { m: { to: 'a@b.fr' } } };
test('à blanc : tout est à copier, rien n’est purgeable', () => {
  const p = planMigrationFitpulse(RC, {});
  assert.deepEqual(Object.keys(p.copier).sort(), ['fitpulse_mail', 'pulse', 'pulse_boot']);
  assert.deepEqual(p.vides.sort(), ['pulse_inbox', 'pulse_push']);
  assert.equal(p.purgeable, false);
  assert.match(texteMigration(p, 'blanc'), /rien n’a été écrit/);
});
test('copie identique (ordre des clés indifférent) : purgeable, et seuls les nœuds Fit Pulse partent', () => {
  const cible = { pulse: { club: { b: { c: 2 }, a: 1 } }, pulse_boot: { x: 1 }, fitpulse_mail: { m: { to: 'a@b.fr' } } };
  const p = planMigrationFitpulse(RC, cible);
  assert.equal(p.purgeable, true);
  assert.deepEqual(p.purger, { pulse: null, pulse_boot: null, fitpulse_mail: null });
  for (const k of Object.keys(p.purger)) assert.ok(NOEUDS_FITPULSE.includes(k));
});
test('une copie différente : remplacée, et la purge reste refusée', () => {
  const p = planMigrationFitpulse(RC, { pulse: { club: { a: 9 } }, pulse_boot: { x: 1 }, fitpulse_mail: { m: { to: 'a@b.fr' } } });
  assert.deepEqual(p.differents, ['pulse']);
  assert.equal(p.purgeable, false);
  assert.match(texteMigration(p, 'purger'), /PURGE REFUSÉE/);
  assert.ok(memeValeur({ a: [1, 2] }, { a: [1, 2] }) && !memeValeur({ a: 1 }, { a: '1' }));
});
test('règles en ligne : un bloc retiré par le déploiement est signalé', () => {
  const enLigne = '{"rules":{\n// commentaire\n"pulse":{".read":true},"users":{".read":false}}}';
  const depot = '{"rules":{"users":{".read":false},"droits":{}}}';
  const d = comparerRegles(enLigne, depot);
  assert.deepEqual(d, { retires: ['pulse'], ajoutes: ['droits'], modifies: [] });
});
