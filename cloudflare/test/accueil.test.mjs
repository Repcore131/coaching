// Lot C1 : les relances de l'accueil d'un athlète coaché (bilan, programme, première séance).
//   node --test cloudflare/test/accueil.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { creerBase } from '../src/base.js';
import { creerMetier } from '../src/metier.js';
import { travaux } from '../src/planif.js';
import { fausseBase, appareil } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const PARIS = (iso) => Date.parse(iso + '+02:00');
const LEA = 'lea@t,fr', TOM = 'tom@t,fr', ZOE = 'zoe@t,fr';
const JOUR = '2026-10-02', DEMAIN = '2026-10-03';
const T = PARIS(JOUR + 'T17:40:00');

function monde(initial, t) {
  const F = fausseBase(initial);
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: F.fetchImpl });
  let horloge = t;
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: F.fetchImpl, maintenant: () => horloge });
  return { F, M, avance: (ms) => { horloge += ms; }, t: () => horloge };
}
const tels = { [LEA]: appareil('https://push.test/lea'), [TOM]: appareil('https://push.test/tom'), [ZOE]: appareil('https://push.test/zoe') };
const push = Object.fromEntries(Object.keys(tels).map((k) => [k, { a: tels[k].abonnement }]));
const recus = (w) => w.F.recus.map((r) => { const k = Object.keys(tels).find((x) => r.endpoint === tels[x].abonnement.endpoint); return { k, m: tels[k].lire(r.init.body) }; });

test('le travail « accueil » est déclaré, en fin d’après-midi', () => {
  const x = travaux(monde({}, T).M).find((y) => y.nom === 'accueil');
  assert.ok(x);
  assert.equal(x.quand({ heure: 12, minute: 0 }), false);
});

test('chaque étape pas faite : une poussée, tracée ; le jour est effacé', async () => {
  const w = monde({ push, users: { [LEA]: { email: 'lea@t.fr' }, [TOM]: { email: 'tom@t.fr' } },
    parcours_relances: { [JOUR]: { [LEA]: { bilan: true }, [TOM]: { programme: true } } } }, T);
  const n = await w.M.accueilRelances(w.t());
  assert.equal(n, 2);
  const r = recus(w);
  assert.equal(r.find((x) => x.k === LEA).m.title, 'Ton bilan de départ t’attend');
  assert.equal(r.find((x) => x.k === TOM).m.title, 'Ton programme est prêt');
  assert.equal(w.F.lire('accueil_trace/' + LEA + '/bilan'), T);
  assert.equal(w.F.lire('parcours_relances/' + JOUR), null);
});

test('une étape ne part JAMAIS deux fois, même redéposée', async () => {
  const w = monde({ push, users: { [LEA]: { email: 'lea@t.fr' } },
    accueil_trace: { [LEA]: { bilan: PARIS('2026-10-01T17:40:00') } },
    parcours_relances: { [JOUR]: { [LEA]: { bilan: true } } } }, T);
  assert.equal(await w.M.accueilRelances(w.t()), 0);
  assert.equal(w.F.recus.length, 0);
});

test('l’athlète qui a tout fait ne reçoit rien', async () => {
  const w = monde({ push,
    users: { [ZOE]: { email: 'zoe@t.fr', bilans: [{ type: 'depart', date: 1 }], lastSession: T - 864e5, parcours: { programmeLu: T - 2 * 864e5 } } },
    parcours_relances: { [JOUR]: { [ZOE]: { bilan: true, programme: true, seance: true } } } }, T);
  assert.equal(await w.M.accueilRelances(w.t()), 0);
  assert.equal(w.F.recus.length, 0);
  assert.equal(w.F.lire('accueil_trace/' + ZOE), null);
});

test('deux étapes le même jour : le plafond commun n’en laisse partir qu’une, l’autre repart demain une fois', async () => {
  const w = monde({ push, users: { [LEA]: { email: 'lea@t.fr' } },
    parcours_relances: { [JOUR]: { [LEA]: { bilan: true, seance: true } } } }, T);
  assert.equal(await w.M.accueilRelances(w.t()), 1);
  assert.equal(w.F.recus.length, 1);
  const repris = w.F.lire('parcours_relances/' + DEMAIN + '/' + LEA) || {};
  assert.equal(Object.keys(repris).length, 1);
  assert.equal(Object.values(repris)[0], 'repris');
  // Le lendemain, elle part ; si le plafond la refuse encore, elle ne revient plus.
  w.avance(864e5);
  assert.equal(await w.M.accueilRelances(w.t()), 1);
  assert.equal(w.F.recus.length, 2);
  assert.equal(w.F.lire('parcours_relances/' + DEMAIN), null);
});
