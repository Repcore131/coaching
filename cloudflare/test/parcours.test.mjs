// Le parcours « Mise sous tension » : le rappel du 21e jour d'essai.
//   node --test cloudflare/test/parcours.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { creerBase } from '../src/base.js';
import { creerMetier, messageParcoursJ21 } from '../src/metier.js';
import { minute, travaux } from '../src/planif.js';
import { fausseBase, appareil } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const PARIS = (iso) => Date.parse(iso + '+02:00');
const LEA = 'lea@t,fr', TOM = 'tom@t,fr', ZOE = 'zoe@t,fr';
const JOUR = '2026-10-19';

function monde(initial, t) {
  const F = fausseBase(initial);
  let n = 0;
  const fetchCompte = (u, i) => { n++; return F.fetchImpl(u, i); };
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: fetchCompte });
  let horloge = t;
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: fetchCompte, maintenant: () => horloge });
  M.coachsEtUsers = () => db.ref('users').shallow();
  M.abonnes = () => db.ref('push').shallow();
  const w = { F, M, avance: (ms) => { horloge += ms; },
    minute: () => { n = 0; return minute({ db, M, compteur: () => n, maintenant: () => horloge }); } };
  w.jusquAuParcours = async () => {
    for (let i = 0; i < 8; i++) { const b = await w.minute(); if (b.travaux.parcours === 'fini') return b; w.avance(60e3); }
    throw new Error('travail « parcours » jamais fini');
  };
  w.vider = async () => {
    await w.jusquAuParcours();
    for (let i = 0; i < 10 && w.F.lire('evenements'); i++) { w.avance(60e3); await w.minute(); }
    assert.equal(w.F.lire('evenements'), null);
  };
  return w;
}
const tels = { [LEA]: appareil('https://push.test/lea'), [TOM]: appareil('https://push.test/tom'), [ZOE]: appareil('https://push.test/zoe') };
const push = Object.fromEntries(Object.keys(tels).map((k) => [k, { a: tels[k].abonnement }]));
const recus = (w) => w.F.recus.map((r) => { const k = Object.keys(tels).find((x) => r.endpoint === tels[x].abonnement.endpoint); return { k, m: tels[k].lire(r.init.body) }; });

test('le message : « Encore N étapes », type serie', () => {
  const m = messageParcoursJ21(2, JOUR);
  assert.equal(m.type, 'serie');
  assert.equal(m.title, 'Encore 2 étapes ⚡');
  assert.match(m.body, /badge SOUS TENSION/);
  assert.match(m.body, /Mise sous tension/);
  assert.equal(m.url, './?parcours=1');
  assert.equal(messageParcoursJ21(1, JOUR).title, 'Encore 1 étape ⚡');
  assert.equal(messageParcoursJ21(99, JOUR).title, 'Encore 7 étapes ⚡', 'borné');
});

test('le 21e jour : un push à ceux qui n’ont pas fini, puis le jour est effacé', async () => {
  const t = PARIS(JOUR + 'T18:20:00');
  const w = monde({ push, parcours_j21: { [JOUR]: { [LEA]: 2, [TOM]: 1, [ZOE]: 'x' }, '2026-10-20': { [ZOE]: 3 } } }, t);
  await w.vider();
  const r = recus(w);
  assert.deepEqual(r.map((x) => x.k).sort(), [LEA, TOM]);
  assert.equal(r.find((x) => x.k === LEA).m.title, 'Encore 2 étapes ⚡');
  assert.equal(r.find((x) => x.k === TOM).m.title, 'Encore 1 étape ⚡');
  assert.equal(w.F.lire('parcours_j21/' + JOUR), null, 'le jour est effacé');
  assert.deepEqual(w.F.lire('parcours_j21/2026-10-20'), { [ZOE]: 3 }, 'le lendemain attend son tour');
  // Relancé le même jour : rien ne repart.
  w.avance(10 * 60e3);
  await w.minute();
  assert.equal(recus(w).length, 2);
});

test('avant 18 h 15, rien ; le travail est déclaré', async () => {
  const w = monde({ push, parcours_j21: { [JOUR]: { [LEA]: 2 } } }, PARIS(JOUR + 'T12:00:00'));
  const b = await w.minute();
  assert.equal(b.travaux.parcours, undefined);
  assert.equal(w.F.recus.length, 0);
  assert.ok(travaux(w.M).some((x) => x.nom === 'parcours'));
});
