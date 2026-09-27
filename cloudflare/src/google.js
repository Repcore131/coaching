// ══ L'ACCÈS À LA BASE PAR UN COMPTE DE SERVICE (27/09/2026) ══════════════
//
// Remplace le « code secret de la base de données » historique de Firebase :
// un accès TOTAL, sans date d'expiration, qui voyageait dans l'URL de chaque
// requête (?auth=…) — donc dans les journaux de tout ce que la requête
// traverse. Il se révoque d'un bloc, et ne dit pas qui s'en est servi.
//
// ICI : la clé d'un compte de service Google (secret FIREBASE_SERVICE_ACCOUNT,
// le fichier JSON entier) signe un jeton JWT ; Google l'échange contre un
// JETON D'ACCÈS OAuth valable une heure, envoyé dans l'en-tête
// Authorization. La clé ne quitte jamais le worker, le jeton expire seul, et
// la clé se renouvelle sans toucher au code (README, « Rotation »).
//
// Le jeton est gardé en mémoire de l'isolat jusqu'à cinq minutes de son
// expiration : une requête OAuth par heure et par isolat, pas une par appel.

const PORTEE = 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email';
const b64u = (octets) => {
  let s = '';
  for (const b of new Uint8Array(octets)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64uTexte = (t) => b64u(new TextEncoder().encode(t));

// Le JSON du compte de service, tel que la console Google le donne.
export function lireCompteService(brut) {
  let c = brut;
  if (typeof brut === 'string') { try { c = JSON.parse(brut); } catch (e) { return null; } }
  if (!c || !c.client_email || !c.private_key) return null;
  return { email: String(c.client_email), cle: String(c.private_key).replace(/\\n/g, '\n'),
    kid: c.private_key_id ? String(c.private_key_id) : '', uri: String(c.token_uri || 'https://oauth2.googleapis.com/token') };
}

async function importerCle(pem) {
  const corps = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(corps), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

let _cache = null;       // { email, jeton, expire }
let _enVol = null;       // { email, promesse }
export function oublierJetonGoogle() { _cache = null; _enVol = null; }

export async function jetonCompteService(compte, o) {
  const opt = o || {};
  const F = opt.fetchImpl || fetch;
  const now = opt.maintenant || Date.now;
  if (!compte) throw new Error('compte de service absent');
  if (_cache && _cache.email === compte.email && _cache.expire > now()) return _cache.jeton;
  if (_enVol && _enVol.email === compte.email) return _enVol.promesse;
  const promesse = (async () => {
    const iat = Math.floor(now() / 1000);
    const tete = b64uTexte(JSON.stringify(Object.assign({ alg: 'RS256', typ: 'JWT' }, compte.kid ? { kid: compte.kid } : {})));
    const charge = b64uTexte(JSON.stringify({ iss: compte.email, sub: compte.email, scope: PORTEE, aud: compte.uri, iat, exp: iat + 3600 }));
    const cle = await importerCle(compte.cle);
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cle, new TextEncoder().encode(tete + '.' + charge));
    const r = await F(compte.uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + tete + '.' + charge + '.' + b64u(sig) });
    if (!r.ok) throw new Error('Google OAuth ' + r.status);
    const j = await r.json();
    if (!j.access_token) throw new Error('jeton Google absent');
    const duree = Math.max(60, (Number(j.expires_in) || 3600) - 300) * 1000;
    _cache = { email: compte.email, jeton: j.access_token, expire: now() + duree };
    return j.access_token;
  })();
  _enVol = { email: compte.email, promesse };
  try { return await promesse; } finally { if (_enVol && _enVol.promesse === promesse) _enVol = null; }
}
