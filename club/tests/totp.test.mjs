// Double authentification TOTP : vecteurs officiels RFC 6238, fenêtre, limite d'essais, revendication.
//   node club/tests/totp.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totp, verifier, base32, deBase32, inscrire, valider, etat } from '../outils/fitpulse-totp.mjs';

const RFC = Buffer.from('12345678901234567890'); // clé de l'annexe B de la RFC 6238 (SHA-1)
test('vecteurs de la RFC 6238 (8 chiffres)', () => {
  for (const [t, v] of [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130']]) assert.equal(totp(RFC, t, { chiffres: 8 }), v);
});
test('base32 aller-retour', () => { assert.deepEqual(deBase32(base32(RFC)), RFC); assert.equal(base32(Buffer.from('foobar')), 'MZXW6YTBOI'); });
test('un pas de décalage toléré, pas deux', () => {
  const s = base32(RFC); const t = 1700000000;
  assert.ok(verifier(s, totp(s, t), t)); assert.ok(verifier(s, totp(s, t - 30), t)); assert.ok(verifier(s, totp(s, t + 30), t));
  assert.ok(!verifier(s, totp(s, t - 90), t)); assert.ok(!verifier(s, '12345', t)); assert.ok(!verifier(s, 'abcdef', t));
});
function fausseBase() { const D = {}; return { D, lire: async p => p.split('/').reduce((o, k) => o == null ? o : o[k], D) ?? null, ecrire: async (p, v) => { const k = p.split('/'); let o = D; k.slice(0, -1).forEach(x => { o = o[x] = o[x] || {}; }); if (v === null) delete o[k.at(-1)]; else o[k.at(-1)] = v; } }; }
test('inscription, premier code, revendication liée à la connexion', async () => {
  const db = fausseBase(); const r = await inscrire({ db, org: 'alpha', uid: 'u1', compte: 'a@b.fr' });
  assert.match(r.uri, /^otpauth:\/\/totp\/Fit%20Pulse:a%40b\.fr\?secret=[A-Z2-7]+&issuer=Fit%20Pulse/);
  assert.deepEqual(await etat({ db, org: 'alpha', uid: 'u1' }), { configure: false });
  let claims = null; await valider({ db, org: 'alpha', uid: 'u1', code: totp(r.secret), authTime: 1234, fixer: async c => { claims = c; } });
  assert.deepEqual(claims, { mfaAt: 1234 }); assert.deepEqual(await etat({ db, org: 'alpha', uid: 'u1' }), { configure: true });
  await assert.rejects(inscrire({ db, org: 'alpha', uid: 'u1', compte: 'a@b.fr' }), /déjà configurée/);
});
test('code faux refusé, 5 essais au plus', async () => {
  const db = fausseBase(); const r = await inscrire({ db, org: 'alpha', uid: 'u2', compte: 'x' }); const now = Date.now();
  for (let i = 0; i < 5; i++) await assert.rejects(valider({ db, org: 'alpha', uid: 'u2', code: '000000', authTime: 1, fixer: async () => {}, now }), /Code incorrect/);
  await assert.rejects(valider({ db, org: 'alpha', uid: 'u2', code: totp(r.secret, now / 1000), authTime: 1, fixer: async () => {}, now }), /Trop d’essais/);
  await valider({ db, org: 'alpha', uid: 'u2', code: totp(r.secret, (now + 16 * 60000) / 1000), authTime: 1, fixer: async () => {}, now: now + 16 * 60000 });
});
