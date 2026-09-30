// ══ GARMIN HEALTH API : LA MONTRE POUSSE, SANS TÉLÉPHONE ENTRE LES DEUX ════
//
// Garmin Connect ENVOIE lui-même les résumés du jour (« dailies »), les nuits
// (« sleeps ») et la variabilité nocturne (« hrv ») à une adresse que nous
// déclarons dans son portail. Ce module les convertit au format interne
// rc-sante-1 et les écrit par LA MÊME fonction que Health Connect
// (ecrireJours de sante.js) : mêmes bornes, mêmes rejets comptés dans
// `ignores`, même fenêtre de 30 jours. Le reste de l'app ne sait pas qu'une
// journée vient de Garmin, sauf par son origine (jours/<d>/origines).
//
// LA LIAISON : OAuth 2.0 avec PKCE (Garmin Connect Developer Program).
//   POST /fn/garmin {action:'lier'}     (session Firebase) → {url}
//   GET  /garmin/lier?s=<état>          → 302 vers Garmin (code_challenge S256)
//   GET  /garmin/retour?code=&state=    → jetons, identifiant Garmin, 302 vers l'app
//   POST /fn/garmin {action:'etat'|'revoquer'}
//   POST /garmin/push/<GARMIN_PUSH_SECRET>   ← Garmin
//
// ⚠ GARMIN NE SIGNE PAS SES ENVOIS. Ce qui les authentifie : le secret dans
//   l'adresse déclarée au portail (comparé en temps constant), et, quand
//   Garmin le joint, l'en-tête garmin-client-id égal à notre identifiant
//   client. Faux secret ou autre client : 401, rien n'est lu. Puis chaque
//   résumé doit porter un userId relié à un compte RepCore.
// ⚠ LES JETONS GARMIN SONT CHIFFRÉS (AES-GCM, clé GARMIN_CLE, 32 octets en
//   base64) avant d'être écrits. Le jeton d'accès vit 24 h, celui de
//   rafraîchissement ~90 jours et CHANGE à chaque rafraîchissement.
// ⚠ RIEN N'EST OUVERT tant que les quatre secrets ne sont pas posés :
//   GARMIN_CLIENT_ID, GARMIN_CLIENT_SECRET, GARMIN_PUSH_SECRET, GARMIN_CLE.
//   Sans eux, l'app garde les instructions du guide Garmin.
//
// OÙ C'EST ÉCRIT (par ce serveur seul ; lecture interdite à l'app) :
//   garmin_liens/<clé>   {uid, jeton:<chiffré>, lieLe}
//   garmin_uid/<userId>  "<clé>"            (pour router un envoi)
//   garmin_etats/<état>  {cle, verifier:<chiffré>, t}   (10 minutes)
//   sante_sync/<clé>/meta/garmin {lieLe, derniereReception, dernierEnvoi}
//   (lu par l'athlète et son coach, comme toute la méta santé)
import { paris } from './metier.js';
import { ecrireJours } from './sante.js';
import { ErreurAppel } from './appels.js';

export const GARMIN_AUTORISER = 'https://connect.garmin.com/oauth2Confirm';
export const GARMIN_JETON = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';
export const GARMIN_API = 'https://apis.garmin.com';
export const PUSH_CORPS_MAX = 1024 * 1024;
export const ETAT_MS = 10 * 60e3;
export const APP_DEFAUT = 'https://repcore-sync.web.app/app/';
const cleEmail = (e) => String(e || '').toLowerCase().trim().replace(/\./g, ',');
const net = (v) => String(v || '').trim();
const UID_RE = /^[A-Za-z0-9-]{4,64}$/;

// ── PURES : la conversion ─────────────────────────────────────────────────
const JOUR_RE = /^\d{4}-\d{2}-\d{2}$/;
const nombre = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
// L'heure locale de la montre (heure affichée au poignet), en HH:MM.
function hhmm(sec, decalage) {
  const d = new Date((sec + (Number(decalage) || 0)) * 1000);
  return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
}
// Le jour d'un résumé : sa calendarDate (le jour de la montre ; pour une
// nuit, celui du RÉVEIL, comme partout dans rc-sante-1). Sans elle, le jour
// de Paris de son début (paris() de metier.js).
export function jourGarmin(x) {
  if (x && JOUR_RE.test(String(x.calendarDate || ''))) return String(x.calendarDate);
  const s = nombre(x && x.startTimeInSeconds);
  if (s == null) return null;
  const dur = x.durationInSeconds != null ? (nombre(x.durationInSeconds) || 0) : 0;
  // Une nuit sans date appartient au jour de son réveil.
  return paris((s + (x._nuit ? dur : 0)) * 1000).jour;
}
// Le plus récent l'emporte quand Garmin renvoie le même jour (il le fait à
// chaque synchronisation de la montre, avec des chiffres qui grandissent).
const recent = (a, b) => (nombre(b.startTimeInSeconds) || 0) + (nombre(b.durationInSeconds) || 0)
  >= (nombre(a.startTimeInSeconds) || 0) + (nombre(a.durationInSeconds) || 0);

/**
 * PURE. Les résumés d'UN utilisateur ({dailies, sleeps, hrv}) → les jours
 * rc-sante-1 {jours:{<date>:{pas, fcRepos, sommeilMin, coucher, lever,
 * phases, vfc, vfcMethode}}, ignores}. Les valeurs ne sont PAS bornées ici :
 * nettoyerJour (sante.js) le fait, pour toutes les sources pareil.
 */
export function garminVersJours(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const jours = {};
  let ignores = 0;
  const jour = (d) => jours[d] || (jours[d] = {});
  const liste = (k) => (Array.isArray(p[k]) ? p[k] : []);
  // Un résumé par jour et par type : le plus récent.
  const garder = (l, nuit) => {
    const par = {};
    for (const x of l) {
      if (!x || typeof x !== 'object') { ignores++; continue; }
      const d = jourGarmin(nuit ? Object.assign({ _nuit: true }, x) : x);
      if (!d) { ignores++; continue; }
      if (!par[d] || recent(par[d], x)) par[d] = x;
    }
    return par;
  };
  for (const [d, x] of Object.entries(garder(liste('dailies'), false))) {
    const j = jour(d);
    if (x.steps !== undefined) j.pas = x.steps;
    if (x.restingHeartRateInBeatsPerMinute !== undefined) j.fcRepos = x.restingHeartRateInBeatsPerMinute;
  }
  for (const [d, x] of Object.entries(garder(liste('sleeps'), true))) {
    const dur = nombre(x.durationInSeconds);
    if (dur == null) { ignores++; continue; }
    const j = jour(d);
    j.sommeilMin = Math.round(dur / 60);
    const min = (k) => (nombre(x[k]) == null ? undefined : Math.round(x[k] / 60));
    const ph = { profond: min('deepSleepDurationInSeconds'), leger: min('lightSleepDurationInSeconds'),
      paradoxal: min('remSleepInSeconds'), eveil: min('awakeDurationInSeconds') };
    for (const k of Object.keys(ph)) if (ph[k] === undefined) delete ph[k];
    if (Object.keys(ph).length) j.phases = ph;
    const s = nombre(x.startTimeInSeconds);
    if (s != null) {
      j.coucher = hhmm(s, x.startTimeOffsetInSeconds);
      j.lever = hhmm(s + dur + (nombre(x.awakeDurationInSeconds) || 0), x.startTimeOffsetInSeconds);
    }
  }
  for (const [d, x] of Object.entries(garder(liste('hrv'), true))) {
    // La VFC nocturne de Garmin est une RMSSD (ms) : elle se compare à celle
    // de Health Connect, jamais à la SDNN d'Apple.
    if (x.lastNightAvg === undefined) { ignores++; continue; }
    const j = jour(d);
    j.vfc = x.lastNightAvg;
    j.vfcMethode = 'rmssd';
  }
  return { jours, ignores };
}

/** PURE. Un envoi de Garmin, rangé par utilisateur, et les liaisons retirées. */
export function garminParUtilisateur(corps) {
  const c = corps && typeof corps === 'object' ? corps : {};
  const par = {};
  let ignores = 0;
  for (const type of ['dailies', 'sleeps', 'hrv']) {
    for (const x of (Array.isArray(c[type]) ? c[type] : [])) {
      const uid = String((x && x.userId) || '');
      if (!UID_RE.test(uid)) { ignores++; continue; }
      (par[uid] || (par[uid] = { dailies: [], sleeps: [], hrv: [] }))[type].push(x);
    }
  }
  const retraits = new Set();
  for (const x of (Array.isArray(c.deregistrations) ? c.deregistrations : [])) {
    const uid = String((x && x.userId) || '');
    if (UID_RE.test(uid)) retraits.add(uid);
  }
  // Un changement de permissions qui retire l'export de santé vaut retrait.
  for (const x of (Array.isArray(c.userPermissionsChange) ? c.userPermissionsChange : [])) {
    const uid = String((x && x.userId) || '');
    const perm = Array.isArray(x && x.permissions) ? x.permissions : null;
    if (UID_RE.test(uid) && perm && perm.indexOf('HEALTH_EXPORT') < 0) retraits.add(uid);
  }
  return { par, retraits: [...retraits], ignores };
}

// ── LE CHIFFREMENT ET LE PKCE ─────────────────────────────────────────────
const enc = new TextEncoder();
function b64url(octets) {
  let s = '';
  for (const o of octets) s += String.fromCharCode(o);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function deB64(s) {
  const b = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b + '==='.slice((b.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
async function cleAes(env) {
  const brut = deB64(net(env.GARMIN_CLE));
  if (brut.length !== 32) throw new Error('GARMIN_CLE : 32 octets attendus');
  return crypto.subtle.importKey('raw', brut, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function chiffrer(obj, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cleAes(env), enc.encode(JSON.stringify(obj))));
  return 'v1.' + b64url(iv) + '.' + b64url(ct);
}
export async function dechiffrer(txt, env) {
  const [v, iv, ct] = String(txt || '').split('.');
  if (v !== 'v1' || !iv || !ct) throw new Error('jeton illisible');
  const clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(iv) }, await cleAes(env), deB64(ct));
  return JSON.parse(new TextDecoder().decode(clair));
}
export async function defiPkce(verifier) {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(verifier))));
}
function egal(a, b) {
  const x = String(a || ''), y = String(b || '');
  if (!x || !y) return false;
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x.charCodeAt(i % x.length) || 0) ^ (y.charCodeAt(i % y.length) || 0);
  return d === 0;
}
export function garminOuvert(env) {
  const e = env || {};
  return !!(net(e.GARMIN_CLIENT_ID) && net(e.GARMIN_CLIENT_SECRET) && net(e.GARMIN_PUSH_SECRET) && net(e.GARMIN_CLE));
}

// ── LE MODULE ─────────────────────────────────────────────────────────────
// ctx : {db, env, fetchImpl?, maintenant?}. fetchImpl sert aux appels à Garmin.
export function creerGarmin(ctx) {
  const { db, env } = ctx;
  const f = ctx.fetchImpl || fetch;
  const now = () => (ctx.maintenant || Date.now)();
  const appUrl = () => net(env.APP_URL) || APP_DEFAUT;
  const redirection = (u) => new Response(null, { status: 302, headers: { Location: u, 'Cache-Control': 'no-store' } });
  const vers = (etat) => redirection(appUrl() + '?garmin=' + etat);

  async function jetons(corps) {
    const r = await f(GARMIN_JETON, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(Object.assign({ client_id: net(env.GARMIN_CLIENT_ID), client_secret: net(env.GARMIN_CLIENT_SECRET) }, corps)).toString() });
    if (!r.ok) throw new Error('jeton Garmin refusé (' + r.status + ')');
    const j = await r.json();
    if (!j || !j.access_token || !j.refresh_token) throw new Error('jeton Garmin incomplet');
    const t = now();
    return { a: j.access_token, r: j.refresh_token, ea: t + (Number(j.expires_in) || 86400) * 1000 - 60e3,
      er: t + (Number(j.refresh_token_expires_in) || 7776000) * 1000 };
  }
  // Un jeton d'accès valable, rafraîchi (et réécrit) s'il a expiré.
  async function acces(cle, lien) {
    let j = await dechiffrer(lien.jeton, env);
    if (j.ea > now()) return j.a;
    j = await jetons({ grant_type: 'refresh_token', refresh_token: j.r });
    await db.ref('garmin_liens/' + cle + '/jeton').set(await chiffrer(j, env));
    return j.a;
  }
  async function delier(cle, uid) {
    const maj = { ['garmin_liens/' + cle]: null, ['sante_sync/' + cle + '/meta/garmin']: null };
    if (uid) maj['garmin_uid/' + uid] = null;
    await db.ref('').update(maj);
  }

  // /fn/garmin — l'app, session Firebase vérifiée.
  async function appel({ auth, data }, req) {
    const cle = cleEmail(auth && auth.email);
    if (!cle) throw new ErreurAppel(401, 'Connecte-toi pour effectuer cette action.');
    const action = String((data && data.action) || '');
    const dispo = garminOuvert(env);
    const lien = (await db.ref('garmin_liens/' + cle).get()).val();
    if (action === 'etat') {
      const m = (await db.ref('sante_sync/' + cle + '/meta/garmin').get()).val() || {};
      return { dispo, lie: !!(lien && lien.uid), lieLe: (lien && lien.lieLe) || null,
        derniereReception: m.derniereReception || null, dernierEnvoi: m.dernierEnvoi || null };
    }
    if (!dispo) throw new ErreurAppel(503, 'La connexion Garmin n’est pas encore ouverte.');
    if (action === 'lier') {
      const etat = b64url(crypto.getRandomValues(new Uint8Array(24)));
      const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
      await db.ref('garmin_etats/' + etat).set({ cle, verifier: await chiffrer(verifier, env), t: now() });
      const base = new URL((req && req.url) || 'https://repcore-serveur.repcore.workers.dev/').origin;
      return { url: base + '/garmin/lier?s=' + etat };
    }
    if (action === 'revoquer') {
      if (!lien) return { lie: false };
      // Chez Garmin d'abord ; s'il ne répond pas, la liaison tombe quand même ici.
      try {
        const a = await acces(cle, lien);
        await f(GARMIN_API + '/wellness-api/rest/user/registration', { method: 'DELETE', headers: { Authorization: 'Bearer ' + a } });
      } catch (e) { /* le retrait local suffit à couper la réception */ }
      await delier(cle, lien.uid);
      return { lie: false };
    }
    throw new ErreurAppel(400, 'Action inconnue.');
  }

  // GET /garmin/lier?s=<état> : vers la page d'autorisation de Garmin.
  async function lier(req) {
    if (!garminOuvert(env)) return vers('ferme');
    const s = new URL(req.url).searchParams.get('s') || '';
    if (!/^[A-Za-z0-9_-]{32}$/.test(s)) return vers('expire');
    const e = (await db.ref('garmin_etats/' + s).get()).val();
    if (!e || now() - Number(e.t) > ETAT_MS) return vers('expire');
    const q = new URLSearchParams({ response_type: 'code', client_id: net(env.GARMIN_CLIENT_ID),
      code_challenge: await defiPkce(await dechiffrer(e.verifier, env)), code_challenge_method: 'S256',
      redirect_uri: new URL(req.url).origin + '/garmin/retour', state: s });
    return redirection(GARMIN_AUTORISER + '?' + q.toString());
  }

  // GET /garmin/retour?code=&state= : les jetons, l'identifiant, la liaison.
  async function retour(req) {
    if (!garminOuvert(env)) return vers('ferme');
    const u = new URL(req.url);
    const s = u.searchParams.get('state') || '';
    if (!/^[A-Za-z0-9_-]{32}$/.test(s)) return vers('expire');
    const e = (await db.ref('garmin_etats/' + s).get()).val();
    // L'état ne sert qu'une fois, qu'il aboutisse ou non.
    await db.ref('garmin_etats/' + s).remove();
    if (!e || now() - Number(e.t) > ETAT_MS) return vers('expire');
    if (u.searchParams.get('error') || !u.searchParams.get('code')) return vers('refus');
    try {
      const j = await jetons({ grant_type: 'authorization_code', code: u.searchParams.get('code'),
        code_verifier: await dechiffrer(e.verifier, env), redirect_uri: u.origin + '/garmin/retour' });
      const r = await f(GARMIN_API + '/wellness-api/rest/user/id', { headers: { Authorization: 'Bearer ' + j.a } });
      if (!r.ok) throw new Error('identifiant Garmin (' + r.status + ')');
      const uid = String(((await r.json()) || {}).userId || '');
      if (!UID_RE.test(uid)) throw new Error('identifiant Garmin illisible');
      const cle = String(e.cle);
      const t = now();
      const maj = {
        ['garmin_liens/' + cle]: { uid, jeton: await chiffrer(j, env), lieLe: t },
        ['garmin_uid/' + uid]: cle,
        ['sante_sync/' + cle + '/meta/garmin/lieLe']: t,
      };
      // Une montre ne sert qu'un compte : reliée ailleurs, elle en est retirée.
      const avant = (await db.ref('garmin_uid/' + uid).get()).val();
      if (avant && avant !== cle) { maj['garmin_liens/' + avant] = null; maj['sante_sync/' + avant + '/meta/garmin'] = null; }
      // Et ce compte n'a qu'une montre : l'ancienne ne route plus ici.
      const ancien = (await db.ref('garmin_liens/' + cle + '/uid').get()).val();
      if (ancien && ancien !== uid) maj['garmin_uid/' + ancien] = null;
      await db.ref('').update(maj);
      return vers('ok');
    } catch (err) {
      return vers('erreur');
    }
  }

  // POST /garmin/push/<secret> : ce que Garmin envoie. Rend {statut, corps}.
  async function recevoir(req) {
    if (!garminOuvert(env)) return { statut: 404, corps: { erreur: 'fermé' } };
    const secret = decodeURIComponent(new URL(req.url).pathname.replace(/^\/garmin\/push\/?/, ''));
    if (!egal(secret, net(env.GARMIN_PUSH_SECRET))) return { statut: 401, corps: { erreur: 'signature' } };
    const client = req.headers.get('garmin-client-id');
    if (client != null && !egal(net(client), net(env.GARMIN_CLIENT_ID))) return { statut: 401, corps: { erreur: 'signature' } };
    if (Number(req.headers.get('Content-Length') || 0) > PUSH_CORPS_MAX) return { statut: 413, corps: { erreur: 'trop gros' } };
    const texte = await req.text();
    if (enc.encode(texte).length > PUSH_CORPS_MAX) return { statut: 413, corps: { erreur: 'trop gros' } };
    let corps = null;
    try { corps = JSON.parse(texte); } catch (e) { corps = null; }
    if (!corps || typeof corps !== 'object') return { statut: 400, corps: { erreur: 'format' } };
    const t = now();
    const g = garminParUtilisateur(corps);
    let ignores = g.ignores, jours = 0, inconnus = 0;
    for (const uid of g.retraits) {
      const cle = (await db.ref('garmin_uid/' + uid).get()).val();
      if (cle) await delier(String(cle), uid); else await db.ref('garmin_uid/' + uid).remove();
    }
    for (const uid of Object.keys(g.par)) {
      if (g.retraits.includes(uid)) continue;
      const cle = (await db.ref('garmin_uid/' + uid).get()).val();
      if (!cle) { inconnus++; continue; }
      const conv = garminVersJours(g.par[uid]);
      const e = ecrireJours(String(cle), conv.jours, 'garmin', t);
      ignores += conv.ignores + e.ignores;
      jours += e.jours;
      const base = 'sante_sync/' + cle + '/meta/';
      const maj = Object.assign({}, e.maj, {
        [base + 'derniereReception']: t,
        [base + 'garmin/derniereReception']: t,
        [base + 'garmin/dernierEnvoi']: { jours: e.jours, nuits: e.nuits },
      });
      // L'origine est notée JOUR PAR JOUR (jours/<d>/origines, ecrireJours), pas
      // dans meta/origines : celle-ci dit l'application que Health Connect
      // relaie (Samsung, Fitbit…), et Garmin l'écraserait pour tous les jours.
      await db.ref('').update(maj);
    }
    // Garmin veut un 200 rapide, même quand rien n'est pour nous.
    return { statut: 200, corps: { jours, ignores, inconnus } };
  }

  return { appel, lier, retour, recevoir };
}
