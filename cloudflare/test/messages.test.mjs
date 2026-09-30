// La messagerie coach ↔ athlète (lot M2) : l'événement « message » relu en base avant la notification.
//   node --test cloudflare/test/messages.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { creerBase } from '../src/base.js';
import { creerMetier, PUSH_TYPES } from '../src/metier.js';
import { fausseBase, appareil } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const T = Date.parse('2026-10-02T15:00:00+02:00');
const COACH = 'coach@t,fr', LEA = 'lea@t,fr', ZOE = 'zoe@t,fr';
const tels = { [COACH]: appareil('https://push.test/coach'), [LEA]: appareil('https://push.test/lea'), [ZOE]: appareil('https://push.test/zoe') };
const push = Object.fromEntries(Object.keys(tels).map((k) => [k, { a: tels[k].abonnement }]));
const recus = (w) => w.F.recus.map((r) => { const k = Object.keys(tels).find((x) => r.endpoint === tels[x].abonnement.endpoint); return { k, m: tels[k].lire(r.init.body) }; });
function monde(extra) {
  const F = fausseBase(Object.assign({ push,
    users: { [LEA]: { email: 'lea@t.fr', fname: 'Léa', coachEmailKey: COACH }, [ZOE]: { email: 'zoe@t.fr', fname: 'Zoé', coachEmailKey: 'autre@t,fr' },
      [COACH]: { email: 'coach@t.fr', role: 'coach' } },
    messages: { [COACH]: { [LEA]: {
      m1: { de: 'coach', texte: 'Salut Léa, comment tu te sens après la séance de jambes ?', at: T - 60e3, lu: false },
      m2: { de: 'athlete', texte: 'Un peu courbaturée mais ça va, merci !', at: T - 30e3, lu: false },
      m3: { de: 'coach', texte: 'Déjà lu', at: T - 20e3, lu: true } } } } }, extra || {}));
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: F.fetchImpl });
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: F.fetchImpl, maintenant: () => T });
  return { F, M };
}

test('le type de push « message » est déclaré', () => {
  assert.ok(PUSH_TYPES.includes('message'));
  assert.ok(PUSH_TYPES.includes('coach'));
});

test('du coach vers l’athlète : relu en base, push de type coach avec le texte', async () => {
  const w = monde();
  assert.equal(await w.M.evenement({ type: 'message', par: COACH, coach: COACH, dest: LEA, i: 'm1' }), 'envoye');
  const r = recus(w);
  assert.equal(r.length, 1);
  assert.equal(r[0].k, LEA);
  assert.equal(r[0].m.type, 'coach');
  assert.equal(r[0].m.title, 'Ton coach t’a écrit');
  assert.equal(r[0].m.body, 'Salut Léa, comment tu te sens après la séance de jambes ?');
  assert.equal(r[0].m.url, './?messages=1');
});

test('de l’athlète vers le coach : push de type message, avec son prénom', async () => {
  const w = monde();
  assert.equal(await w.M.evenement({ type: 'message', par: LEA, coach: COACH, dest: COACH, i: 'm2' }), 'envoye');
  const r = recus(w);
  assert.equal(r.length, 1);
  assert.equal(r[0].k, COACH);
  assert.equal(r[0].m.type, 'message');
  assert.equal(r[0].m.title, 'Léa t’a écrit');
});

test('ce qui ne se croit pas sur parole : pas son coach, message absent, mauvais auteur, déjà lu', async () => {
  const w = monde();
  assert.equal(await w.M.evenement({ type: 'message', par: COACH, coach: COACH, dest: ZOE, i: 'm1' }), 'pas_son_coach');
  assert.equal(await w.M.evenement({ type: 'message', par: COACH, coach: COACH, dest: LEA, i: 'mX' }), 'sans_message');
  // L'athlète annonce un message qui est celui du coach.
  assert.equal(await w.M.evenement({ type: 'message', par: LEA, coach: COACH, dest: COACH, i: 'm1' }), 'sans_message');
  // Un athlète qui vise un autre que son coach.
  assert.equal(await w.M.evenement({ type: 'message', par: LEA, coach: COACH, dest: ZOE, i: 'm2' }), 'incoherent');
  assert.equal(await w.M.evenement({ type: 'message', par: COACH, coach: COACH, dest: LEA, i: 'm3' }), 'deja_lu');
  assert.equal(await w.M.evenement({ type: 'message', par: COACH, coach: COACH, dest: LEA }), 'incomplet');
  assert.equal(w.F.recus.length, 0);
});

test('les préférences comptent : un coach qui a coupé « message » ne reçoit rien', async () => {
  const w = monde();
  await w.M.evenement({ type: 'message', par: COACH, coach: COACH, dest: LEA, i: 'm1' });
  const w2 = monde({ users: { [LEA]: { email: 'lea@t.fr', fname: 'Léa', coachEmailKey: COACH }, [COACH]: { email: 'coach@t.fr', role: 'coach', pushPrefs: { message: false } } } });
  await w2.M.evenement({ type: 'message', par: LEA, coach: COACH, dest: COACH, i: 'm2' });
  assert.equal(w2.F.recus.length, 0);
  assert.equal(w.F.recus.length, 1);
});
