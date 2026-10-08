// node --test cloudflare/test/erreurs.test.mjs — le capteur d'erreurs (série 6, lot 14).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fausseBase } from './fausse-base.mjs';
import { creerBase } from '../src/base.js';
const base = (i) => creerBase({ url: 'https://base.test', auth: 's', fetchImpl: fausseBase(i).fetchImpl });
import { erreurDepuisCorps, enregistrerErreur, ERREURS_JOUR_MAX, ERREUR_CORPS_MAX } from '../src/erreurs.js';

const T = Date.UTC(2026, 9, 8, 10);
const corps = (o) => JSON.stringify(Object.assign({ m: 'x is not a function', s: 'rc-core.1938.js:12', ou: 'renderVolume', b: '1938', h: 'abc123' }, o || {}));

test('le corps : borné à 2 Ko, champs contrôlés, adresse retirée', () => {
  assert.equal(erreurDepuisCorps('x'.repeat(ERREUR_CORPS_MAX + 1), T).raison, 'taille');
  assert.equal(erreurDepuisCorps('pas du json', T).raison, 'json');
  assert.equal(erreurDepuisCorps(corps({ b: '../users' }), T).raison, 'champs');
  assert.equal(erreurDepuisCorps(corps({ h: 'A/B' }), T).raison, 'champs');
  const e = erreurDepuisCorps(corps({ m: 'échec pour lea@exemple.fr' }), T);
  assert.equal(e.ok, true);
  assert.equal(e.chemin, 'erreurs/2026-10-08/1938/abc123');
  assert.equal(e.champs.m, 'échec pour [e-mail]');
});
test('deux passages : une entrée, n = 2, premier et dernier', async () => {
  const db = base({});
  await enregistrerErreur(db, corps(), T);
  await enregistrerErreur(db, corps(), T + 1000);
  const v = (await db.ref('erreurs/2026-10-08/1938/abc123').get()).val();
  assert.equal(v.n, 2);
  assert.equal(v.premier, T);
  assert.equal(v.dernier, T + 1000);
  assert.equal((await db.ref('erreurs_jour/2026-10-08').get()).val(), 1);
});
test('au-delà de 500 empreintes par jour : refus, les connues comptent encore', async () => {
  const db = base({ erreurs_jour: { '2026-10-08': ERREURS_JOUR_MAX }, erreurs: { '2026-10-08': { 1938: { connu1: { n: 1, m: 'x', premier: T, dernier: T } } } } });
  assert.equal((await enregistrerErreur(db, corps({ h: 'neuf99' }), T)).raison, 'plafond');
  assert.equal((await enregistrerErreur(db, corps({ h: 'connu1' }), T)).ok, true);
  assert.equal((await db.ref('erreurs/2026-10-08/1938/connu1/n').get()).val(), 2);
});
