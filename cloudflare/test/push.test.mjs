// Le chiffrement RFC 8291 et le jeton VAPID, vérifiés du côté de l'APPAREIL :
// on déchiffre avec le module crypto de Node (implémentation indépendante),
// et on vérifie la signature ES256 avec la clé publique.
//   node cloudflare/test/push.test.mjs
import nodeCrypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chiffrer, jetonVapid, b64uVersOctets, octetsVersB64u, envoyerA } from '../src/push.js';

const b64u = (b) => Buffer.from(b).toString('base64url');
let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };

// L'appareil : sa paire ECDH et son secret d'authentification.
const ua = nodeCrypto.createECDH('prime256v1'); ua.generateKeys();
const uaPublic = ua.getPublicKey();                 // 65 octets non compressés
const authSecret = nodeCrypto.randomBytes(16);

function hkdf(sel, ikm, info, n) {
  const prk = nodeCrypto.createHmac('sha256', sel).update(ikm).digest();
  return nodeCrypto.createHmac('sha256', prk).update(Buffer.concat([info, Buffer.from([1])])).digest().subarray(0, n);
}
function dechiffrer(corps) {
  const b = Buffer.from(corps);
  const sel = b.subarray(0, 16);
  const rs = b.readUInt32BE(16);
  const idlen = b[20];
  const asPublic = b.subarray(21, 21 + idlen);
  const chiffre = b.subarray(21 + idlen);
  const secret = ua.computeSecret(asPublic);
  const ikm = hkdf(authSecret, secret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32);
  const cek = hkdf(sel, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(sel, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const tag = chiffre.subarray(chiffre.length - 16);
  const d = nodeCrypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(tag);
  const clair = Buffer.concat([d.update(chiffre.subarray(0, chiffre.length - 16)), d.final()]);
  assert.equal(clair[clair.length - 1], 2, 'délimiteur du dernier enregistrement');
  return { rs, texte: clair.subarray(0, clair.length - 1).toString('utf8') };
}

await test('le message chiffré se déchiffre chez l’appareil (RFC 8291)', async () => {
  const charge = JSON.stringify({ title: 'Ton coach a répondu à ton bilan', body: 'Belle régularité ⚡', url: './' });
  const corps = await chiffrer(charge, b64u(uaPublic), b64u(authSecret));
  const r = dechiffrer(corps);
  assert.equal(r.rs, 4096);
  assert.equal(r.texte, charge);
});

await test('deux envois du même message ne se ressemblent pas (sel et clé éphémère)', async () => {
  const a = await chiffrer('x', b64u(uaPublic), b64u(authSecret));
  const b = await chiffrer('x', b64u(uaPublic), b64u(authSecret));
  assert.notEqual(Buffer.from(a).toString('hex'), Buffer.from(b).toString('hex'));
});

// La paire VAPID du serveur.
const vapid = nodeCrypto.createECDH('prime256v1'); vapid.generateKeys();
const pub = b64u(vapid.getPublicKey()), priv = b64u(vapid.getPrivateKey());

await test('le jeton VAPID est un JWT ES256 valide pour l’origine du service', async () => {
  const j = await jetonVapid('https://fcm.googleapis.com/fcm/send/abc', pub, priv, 'mailto:x@y.fr', Date.UTC(2026, 8, 27));
  const [t, c, s] = j.split('.');
  const corps = JSON.parse(Buffer.from(c, 'base64url').toString());
  assert.equal(corps.aud, 'https://fcm.googleapis.com');
  assert.equal(corps.sub, 'mailto:x@y.fr');
  assert.equal(JSON.parse(Buffer.from(t, 'base64url').toString()).alg, 'ES256');
  const cle = nodeCrypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256',
    x: b64u(vapid.getPublicKey().subarray(1, 33)), y: b64u(vapid.getPublicKey().subarray(33)) }, format: 'jwk' });
  const valide = nodeCrypto.verify('sha256', Buffer.from(t + '.' + c), { key: cle, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'));
  assert.ok(valide, 'signature ES256');
});

await test('l’envoi pose les bons en-têtes et rend le statut du service', async () => {
  let vu = null;
  const r = await envoyerA({ endpoint: 'https://push.example/abc', keys: { p256dh: b64u(uaPublic), auth: b64u(authSecret) } }, '{"title":"x"}',
    { publique: pub, privee: priv, contact: 'mailto:x@y.fr', fetchImpl: async (url, init) => { vu = { url, init }; return { status: 201 }; } });
  assert.equal(r.statut, 201);
  assert.equal(vu.init.headers['Content-Encoding'], 'aes128gcm');
  assert.match(vu.init.headers.Authorization, /^vapid t=[^.]+\.[^.]+\.[^,]+, k=/);
  assert.equal(dechiffrer(vu.init.body).texte, '{"title":"x"}');
});

console.log(ok + ' tests passés');
