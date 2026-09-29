// Les messages programmés du canal (lot C5) : publiés à l'heure, modifiables et annulables avant.
//   node --test cloudflare/test/canal-programmes.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { creerBase } from '../src/base.js';
import { creerMetier } from '../src/metier.js';
import { travaux } from '../src/planif.js';
import { fausseBase } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const H = 3600e3;
const T = Date.parse('2026-10-05T08:00:30+02:00');
const COACH = 'kev@t,fr';

function monde(initial) {
  const F = fausseBase(initial);
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: F.fetchImpl });
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: F.fetchImpl, maintenant: () => T });
  return { F, M, db };
}

test('à l’heure dite : publié sous le même identifiant, la sonde suit, le programmé disparaît', async () => {
  const w = monde({ canal_programmes: { [COACH]: {
    'p1759644000000-a': { quand: T - 30e3, titre: 'Votre semaine', texte: 'Ces sept derniers jours, vous avez fait 47 séances.', lien: 'https://exemple.fr/v', cree: 1 },
    'p1759647600000-b': { quand: T + H, texte: 'Dans une heure' },
    'p1759644000001-c': { quand: T - 30e3, texte: 'Lien douteux', lien: 'javascript:alert(1)' },
  } } });
  assert.equal(await w.M.canalProgrammesHeure(T), 2);
  const msgs = w.F.lire('canaux/' + COACH + '/messages');
  assert.deepEqual(Object.keys(msgs).sort(), ['p1759644000000-a', 'p1759644000001-c']);
  assert.deepEqual(msgs['p1759644000000-a'], { at: T, titre: 'Votre semaine', texte: 'Ces sept derniers jours, vous avez fait 47 séances.', epingle: false, lien: 'https://exemple.fr/v' });
  assert.equal(msgs['p1759644000001-c'].lien, undefined, 'un lien non https ne part pas');
  assert.equal(w.F.lire('coach_public/' + COACH + '/canalDernier'), T);
  assert.deepEqual(Object.keys(w.F.lire('canal_programmes/' + COACH)), ['p1759647600000-b'], 'le futur reste, modifiable');
});

test('modifié ou annulé avant l’heure : c’est la dernière version qui part, ou rien', async () => {
  const w = monde({ canal_programmes: { [COACH]: { 'p1759644000000-a': { quand: T + H, texte: 'Première version' },
    'p1759644000000-z': { quand: T + H, texte: 'À annuler' } } } });
  assert.equal(await w.M.canalProgrammesHeure(T), 0);
  assert.equal(w.F.lire('canaux'), null);
  await w.db.ref('canal_programmes/' + COACH + '/p1759644000000-a/texte').set('Version corrigée');
  await w.db.ref('canal_programmes/' + COACH + '/p1759644000000-z').remove();
  assert.equal(await w.M.canalProgrammesHeure(T + H), 1);
  const msgs = w.F.lire('canaux/' + COACH + '/messages');
  assert.deepEqual(Object.keys(msgs), ['p1759644000000-a']);
  assert.equal(msgs['p1759644000000-a'].texte, 'Version corrigée');
});

test('un message en retard de plus d’un jour ne part pas seul : il est marqué', async () => {
  const w = monde({ canal_programmes: { [COACH]: { 'p1759644000000-a': { quand: T - 30 * H, texte: 'Trop tard' } } } });
  assert.equal(await w.M.canalProgrammesHeure(T), 0);
  assert.equal(w.F.lire('canaux'), null);
  assert.equal(w.F.lire('canal_programmes/' + COACH + '/p1759644000000-a/manque'), true);
  assert.equal(await w.M.canalProgrammesHeure(T + H), 0, 'et il ne repart pas l’heure suivante');
});

test('le travail est horaire, dans planif.js', () => {
  const x = travaux({ planifies: {} }).find((w) => w.nom === 'canal_programmes');
  assert.ok(x && x.heure === true);
});
