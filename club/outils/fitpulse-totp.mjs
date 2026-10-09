/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
// ══ FIT PULSE — double authentification TOTP (serveur) ═════════════════════
// Codes à 6 chiffres toutes les 30 secondes (RFC 6238, HMAC-SHA1), compatibles
// avec Google Authenticator, Microsoft Authenticator, 1Password…
// Le secret ne quitte jamais le serveur : /orgs_secret/{org}/{uid}/totp (aucune
// règle de lecture). Un code juste ajoute au jeton de CETTE connexion la
// revendication mfaAt = auth_time : les règles de la base n'ouvrent l'espace
// d'un manager ou d'un créateur qu'à cette condition.
import crypto from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(buf) { let bits = 0, val = 0, out = ''; for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) out += B32[(val << (5 - bits)) & 31]; return out; }
export function deBase32(s) { const c = String(s).toUpperCase().replace(/[^A-Z2-7]/g, ''); let bits = 0, val = 0; const out = []; for (const ch of c) { val = (val << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); }
// Code à l'instant t (secondes), n chiffres.
export function totp(secret, t = Date.now() / 1000, { pas = 30, chiffres = 6 } = {}) {
  const key = Buffer.isBuffer(secret) ? secret : deBase32(secret);
  const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(t / pas)));
  const h = crypto.createHmac('sha1', key).update(ctr).digest(); const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 10 ** chiffres;
  return String(n).padStart(chiffres, '0');
}
// Un pas de décalage toléré (horloge du téléphone), comparaison à temps constant.
export function verifier(secret, code, t = Date.now() / 1000) {
  const c = String(code || '').replace(/\D/g, ''); if (c.length !== 6) return false;
  return [-1, 0, 1].some(d => { const a = Buffer.from(totp(secret, t + d * 30)), b = Buffer.from(c); return crypto.timingSafeEqual(a, b); });
}
export const nouveauSecret = () => base32(crypto.randomBytes(20));
export const uriOtpauth = (secret, compte, emetteur = 'Fit Pulse') => `otpauth://totp/${encodeURIComponent(emetteur)}:${encodeURIComponent(compte)}?secret=${secret}&issuer=${encodeURIComponent(emetteur)}&algorithm=SHA1&digits=6&period=30`;

// ── Opérations (appelées par les fonctions club/cloud) ────────────────────
// db : { lire(chemin), ecrire(chemin, valeur) } ; fixer(claims) : revendications du compte.
const ESSAIS_MAX = 5, FENETRE = 15 * 60000;
async function limiter(db, base, now) {
  const e = (await db.lire(`${base}/essais`)) || { n: 0, depuis: now };
  if (now - e.depuis > FENETRE) { e.n = 0; e.depuis = now; }
  if (e.n >= ESSAIS_MAX) throw Object.assign(new Error('Trop d’essais : patientez un quart d’heure.'), { code: 'resource-exhausted' });
  return e;
}
export async function inscrire({ db, org, uid, compte, now = Date.now() }) {
  const base = `orgs_secret/${org}/${uid}/totp`; const deja = await db.lire(base);
  if (deja && deja.confirme) throw Object.assign(new Error('Double authentification déjà configurée.'), { code: 'already-exists' });
  const secret = nouveauSecret(); await db.ecrire(base, { secret, confirme: false, at: now });
  return { secret, uri: uriOtpauth(secret, compte) };
}
// Premier code (confirme l'application) ou code de connexion : même vérification.
export async function valider({ db, org, uid, code, authTime, fixer, now = Date.now() }) {
  const base = `orgs_secret/${org}/${uid}/totp`; const s = await db.lire(base);
  if (!s || !s.secret) throw Object.assign(new Error('Double authentification non configurée.'), { code: 'failed-precondition' });
  const e = await limiter(db, base, now);
  if (!verifier(s.secret, code, now / 1000)) { e.n++; await db.ecrire(`${base}/essais`, e); throw Object.assign(new Error('Code incorrect.'), { code: 'permission-denied' }); }
  await db.ecrire(`${base}/essais`, null); if (!s.confirme) await db.ecrire(`${base}/confirme`, true);
  await fixer({ mfaAt: authTime });
  return { ok: true };
}
export async function etat({ db, org, uid }) { const s = await db.lire(`orgs_secret/${org}/${uid}/totp`); return { configure: !!(s && s.confirme) }; }
