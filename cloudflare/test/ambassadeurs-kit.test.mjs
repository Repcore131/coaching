// Les ambassadeurs : la semaine de la page secrète, et l'offre de lancement
// « ultime_demi » portée par un code.
//   node --test cloudflare/test/ambassadeurs-kit.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { creerBase } from '../src/base.js';
import { creerMetier, semaineAmbassadeur, AVANTAGES_AMB } from '../src/metier.js';
import { fausseBase } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const T = Date.parse('2026-10-05T12:00:00+02:00');
const SECRET = 'abcdefghijklmnopqrstuvwx';
function monde(initial) {
  const F = fausseBase(initial);
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl: F.fetchImpl });
  return { F, M: creerMetier({ db, vapid: VAPID, fetchImpl: F.fetchImpl, maintenant: () => T }) };
}
const amb = (o) => Object.assign({ nom: 'Julie Fit', actif: true, avantage: 'essai+1mois', secret: SECRET, creeLe: 1 }, o);

test('la semaine : 7 jours d’attribution additionnés (clics, inscrits, payants)', () => {
  assert.deepEqual(semaineAmbassadeur([{ clic: 10, inscription: 2 }, null, { clic: 5, payant: 1 }, { clic: -3 }]), { clics: 15, inscrits: 2, payants: 1 });
  assert.deepEqual(AVANTAGES_AMB, ['essai+1mois', 'ultime_demi']);
});

test('la vue secrète porte la semaine et l’avantage du code', async () => {
  const w = monde({ ambassadeurs: { JULIE: amb({ stats: { clics: 400, inscrits: 30, payants: 6 } }) },
    attribution: { jours: { '2026-10-05': { amb: { JULIE: { clic: 12, inscription: 3, payant: 1 } } },
      '2026-09-30': { amb: { JULIE: { clic: 8 } } }, '2026-09-20': { amb: { JULIE: { clic: 999 } } } } } });
  // Le passage quotidien recalcule toutes les vues.
  w.F.ecrire('ambassadeurs_publics/JULIE', { nom: 'Julie Fit', avantage: 'essai+1mois', actif: true });
  await w.M.ambassadeursQuotidien();
  const v = w.F.lire('ambassadeurs_vue/' + SECRET);
  assert.deepEqual(v.semaine, { clics: 20, inscrits: 3, payants: 1 }, 'les 7 derniers jours seulement');
  assert.equal(v.clics, 400);
  assert.equal(v.avantage, 'essai+1mois');
});

test('un code « ultime_demi » : pas de mois d’essai en plus, l’offre écrite dans droits/', async () => {
  const w = monde({ ambassadeurs: { LANCE: amb({ avantage: 'ultime_demi' }) }, users: { 'tom@t,fr': { createdAt: T - 60e3 } } });
  const r = await w.M.ambassadeurDemande('tom@t,fr', { code: 'LANCE' });
  assert.equal(r.ok, true);
  assert.equal(w.F.lire('droits/tom@t,fr/offreAmb'), 'ultime_demi');
  assert.equal(w.F.lire('ambassadeurs_vue/' + SECRET).avantage, 'ultime_demi');
  // Un code classique n'écrit rien de tel.
  const w2 = monde({ ambassadeurs: { JULIE: amb() }, users: { 'lea@t,fr': { createdAt: T - 60e3 } } });
  assert.equal((await w2.M.ambassadeurDemande('lea@t,fr', { code: 'JULIE' })).ok, true);
  assert.equal(w2.F.lire('droits/lea@t,fr/offreAmb'), null);
});
