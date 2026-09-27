// ══ LE WEB PUSH, EN WEBCRYPTO ═════════════════════════════════════════════
//
// La bibliothèque `web-push` des Cloud Functions s'appuie sur le module
// crypto de Node, absent d'un Worker. Ce fichier fait la même chose avec
// WebCrypto, en suivant deux normes :
//   · RFC 8291 — le chiffrement du message (aes128gcm) pour UN appareil ;
//   · RFC 8292 — VAPID : le serveur signe (ES256) un jeton qui prouve au
//     service de push qu'il possède la clé privée dont l'appareil a reçu la
//     publique à l'abonnement.
//
// LES CLÉS VAPID : la publique est dans l'app (VAPID_PUBLIQUE) et ici ; la
// PRIVÉE (32 octets, base64url) n'est que dans les secrets du Worker.

const te = new TextEncoder();

export function b64uVersOctets(s) {
  const b = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b + '==='.slice((b.length + 3) % 4));
  const o = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i);
  return o;
}
export function octetsVersB64u(o) {
  let s = '';
  const a = new Uint8Array(o);
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function concat(...parts) {
  const n = parts.reduce((s, p) => s + p.length, 0);
  const o = new Uint8Array(n); let i = 0;
  for (const p of parts) { o.set(p, i); i += p.length; }
  return o;
}
async function hmac(cle, donnees) {
  const k = await crypto.subtle.importKey('raw', cle, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, donnees));
}

// ── RFC 8291 : le corps chiffré pour un abonnement {p256dh, auth} ─────────
export async function chiffrer(charge, p256dh, authSecret, opts) {
  const uaPublic = b64uVersOctets(p256dh);          // 65 octets, 0x04 || x || y
  const auth = b64uVersOctets(authSecret);          // 16 octets
  const o = opts || {};
  // Paire éphémère du serveur (une par message).
  const paire = o.paire || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', paire.publicKey));
  const uaCle = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaCle }, paire.privateKey, 256));
  // IKM = HKDF(auth, secret, "WebPush: info\0" || ua || as)
  const prkCle = await hmac(auth, secret);
  const ikm = await hmac(prkCle, concat(te.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])));
  const sel = o.sel || crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(sel, ikm);
  const cek = (await hmac(prk, concat(te.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(te.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  // Un seul enregistrement : le message, puis le délimiteur 0x02 (dernier).
  const clair = concat(te.encode(charge), new Uint8Array([2]));
  const aes = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, clair));
  const rs = new Uint8Array([0, 0, 16, 0]);          // 4096, grand-boutiste
  return concat(sel, rs, new Uint8Array([asPublic.length]), asPublic, chiffre);
}

// ── RFC 8292 : le jeton VAPID ──────────────────────────────────────────────
const _clesVapid = new Map();
async function cleVapid(publique, privee) {
  const k = publique + '|' + privee.slice(0, 6);
  if (_clesVapid.has(k)) return _clesVapid.get(k);
  const pub = b64uVersOctets(publique);
  const jwk = { kty: 'EC', crv: 'P-256', x: octetsVersB64u(pub.slice(1, 33)), y: octetsVersB64u(pub.slice(33, 65)),
    d: privee, ext: true };
  const cle = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  _clesVapid.set(k, cle);
  return cle;
}
export async function jetonVapid(endpoint, publique, privee, contact, maintenant) {
  const aud = new URL(endpoint).origin;
  const t = Math.floor((maintenant || Date.now()) / 1000);
  const tete = octetsVersB64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const corps = octetsVersB64u(te.encode(JSON.stringify({ aud, exp: t + 12 * 3600, sub: contact })));
  const aSigner = te.encode(tete + '.' + corps);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await cleVapid(publique, privee), aSigner);
  return tete + '.' + corps + '.' + octetsVersB64u(sig);   // WebCrypto rend r || s : c'est la forme JWS
}

/**
 * Envoie UN message à UN abonnement. Rend {statut} — 201 : parti ; 404/410 :
 * l'abonnement n'existe plus (à supprimer) ; autre : échec.
 */
export async function envoyerA(abonnement, charge, { publique, privee, contact, ttl, fetchImpl }) {
  const corps = await chiffrer(charge, abonnement.keys.p256dh, abonnement.keys.auth);
  const jeton = await jetonVapid(abonnement.endpoint, publique, privee, contact);
  const r = await (fetchImpl || fetch)(abonnement.endpoint, {
    method: 'POST',
    headers: {
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': String(ttl || 24 * 3600),
      'Urgency': 'normal',
      'Authorization': 'vapid t=' + jeton + ', k=' + publique,
    },
    body: corps,
  });
  return { statut: r.status };
}
