// ══ LES APPELS DE L'APP (protocole « onCall » des Cloud Functions) ════════
//
// L'app appelait des Cloud Functions par CLOUD._callFn(nom, data) : POST
// {data}, jeton Firebase en `Authorization: Bearer`, réponse {result} ou
// {error:{message}}. Le serveur léger parle EXACTEMENT ce protocole sur
// /fn/<nom> : l'app n'a qu'à changer d'adresse (_functionsBase).
//
// LE JETON EST VÉRIFIÉ ICI, sans secret : c'est un JWT RS256 signé par Google,
// dont les clés publiques sont publiées (et gardées en mémoire le temps que
// Google indique). On contrôle la signature, le projet (aud), l'émetteur
// (iss), l'expiration, et on en tire l'adresse e-mail. Un appel sans jeton
// valide ne touche à rien.

const JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let _cles = { t: 0, max: 0, parKid: {} };

const b64u = (s) => {
  const b = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b + '==='.slice((b.length + 3) % 4));
  const o = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i);
  return o;
};
const json64 = (s) => JSON.parse(new TextDecoder().decode(b64u(s)));

async function clesGoogle(fetchImpl, maintenant) {
  if (_cles.t && maintenant - _cles.t < _cles.max) return _cles.parKid;
  const r = await (fetchImpl || fetch)(JWK_URL);
  if (!r.ok) throw new Error('clés Google injoignables (' + r.status + ')');
  const cc = (r.headers.get('Cache-Control') || '').match(/max-age=(\d+)/);
  const d = await r.json();
  const parKid = {};
  for (const k of d.keys || []) {
    parKid[k.kid] = await crypto.subtle.importKey('jwk', k, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  }
  _cles = { t: maintenant, max: Math.min(cc ? Number(cc[1]) * 1000 : 3600e3, 6 * 3600e3), parKid };
  return parKid;
}

/** Rend {email, uid} si le jeton est valide pour ce projet, sinon lève. */
export async function verifierJeton(jeton, projet, o) {
  const opts = o || {};
  const t = (opts.maintenant || Date.now)();
  const morceaux = String(jeton || '').split('.');
  if (morceaux.length !== 3) throw new Error('jeton mal formé');
  const tete = json64(morceaux[0]), corps = json64(morceaux[1]);
  if (tete.alg !== 'RS256' || !tete.kid) throw new Error('algorithme refusé');
  const cles = opts.cles || await clesGoogle(opts.fetchImpl, t);
  const cle = cles[tete.kid];
  if (!cle) throw new Error('clé inconnue');
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cle, b64u(morceaux[2]),
    new TextEncoder().encode(morceaux[0] + '.' + morceaux[1]));
  if (!ok) throw new Error('signature invalide');
  const s = Math.floor(t / 1000);
  if (corps.aud !== projet) throw new Error('mauvais projet');
  if (corps.iss !== 'https://securetoken.google.com/' + projet) throw new Error('mauvais émetteur');
  if (!(corps.exp > s)) throw new Error('jeton expiré');
  if (!(corps.iat <= s + 300)) throw new Error('jeton du futur');
  if (!corps.sub) throw new Error('jeton sans sujet');
  if (!corps.email) throw new Error('jeton sans adresse');
  // email_verified : le serveur le lit LUI-MÊME dans un jeton signé par Google
  // (parrainage : un filleul n'est qualifié qu'avec une adresse vérifiée).
  return { email: String(corps.email).toLowerCase(), uid: corps.sub, emailVerifie: corps.email_verified === true };
}

// Une erreur « à la Firebase » : le client lit error.message.
export class ErreurAppel extends Error {
  constructor(statut, message) { super(message); this.statut = statut; }
}
export async function repondreAppel(req, gestionnaires, contexte) {
  const nom = new URL(req.url).pathname.replace(/^\/fn\//, '');
  const g = gestionnaires[nom];
  const envoyer = (statut, corps) => new Response(JSON.stringify(corps), { status: statut,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store' } });
  if (!g) return envoyer(404, { error: { message: 'Fonction inconnue.', status: 'NOT_FOUND' } });
  let auth = null;
  const h = req.headers.get('Authorization') || '';
  if (/^Bearer\s+/i.test(h)) {
    try { auth = await verifierJeton(h.replace(/^Bearer\s+/i, ''), contexte.projet, { fetchImpl: contexte.fetchImpl, cles: contexte.cles }); }
    catch (e) { return envoyer(401, { error: { message: 'Session invalide : reconnecte-toi.', status: 'UNAUTHENTICATED' } }); }
  }
  if (!auth) return envoyer(401, { error: { message: 'Connecte-toi pour effectuer cette action.', status: 'UNAUTHENTICATED' } });
  let data = {};
  try { const b = await req.json(); data = (b && b.data) || {}; } catch (e) { data = {}; }
  try {
    const result = await g({ auth, data }, contexte);
    return envoyer(200, { result: result === undefined ? null : result });
  } catch (e) {
    const statut = e instanceof ErreurAppel ? e.statut : 500;
    return envoyer(statut, { error: { message: e instanceof ErreurAppel ? e.message : 'Erreur interne.', status: String(statut) } });
  }
}
