// Le script console du lot Confiance (club/outils/test-confiance.js), lancé
// sur le vrai code de l'appli : tous les critères doivent répondre OK et
// l'état d'origine doit être rendu intact.
//   TZ=Europe/Paris node --test club/tests/confiance.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chargerAppli } from '../outils/fitpulse-rapport.mjs';

test('script console du lot Confiance : tout OK, état d’origine rendu', () => {
  const run = chargerAppli({ clubs: { k: { id: 'k', name: 'Club réel' } }, users: { u: { id: 'u', first: 'Alex', last: 'M', role: 'manager', status: 'active', clubs: ['k'] } }, clients: { x: { id: 'x', clubId: 'k', name: 'Réel', balance: 99 } } });
  run(`CLUB = S.clubs.k; ME = S.users.u; globalThis.ECRITS = 0; backend.write = () => { ECRITS++; }; backend.sideWrite = () => { ECRITS++; };`);
  const avant = run('JSON.stringify(S)');
  const R = run(readFileSync(new URL('../outils/test-confiance.js', import.meta.url), 'utf8'));
  const lignes = [...R.lignes];
  assert.equal(R.ko, 0, lignes.join('\n'));
  assert.ok(R.ok >= 20, lignes.join('\n'));
  assert.match(lignes.join('\n'), /OK total Impayés récupérés identique/);
  assert.equal(run('JSON.stringify(S)'), avant);
  assert.equal(run('CLUB.id + ME.id'), 'ku');
  assert.equal(run('ECRITS'), 0);
});
