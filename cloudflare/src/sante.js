// ══ LA SYNCHRONISATION SANTÉ AUTOMATIQUE (format « rc-sante-1 ») ══════════
//
// Android (l'APK lit Health Connect) et iPhone (le Raccourci « RepCore Santé »)
// POSTENT les jours de santé ici, sans session Firebase : un JETON DE
// SYNCHRONISATION tient lieu de clé.
//
//   POST /fn/santeJeton {action:'creer'|'revoquer'|'etat'}   (session Firebase)
//     creer    32 octets aléatoires (base64url, 43 caractères), rendus EN CLAIR
//              UNE SEULE FOIS. Seule leur empreinte SHA-256 est gardée :
//              sante_jetons/<empreinte> = {cle, creeLe}. Un jeton actif par
//              compte : le précédent est révoqué.
//     revoquer efface sante_jetons/<empreinte> et tout sante_sync/<cle>.
//     etat     {actif, creeLe, derniereReception, plateforme, source, origines}.
//
//   POST /sante/i/<jeton>   (ou l'en-tête X-RepCore-Jeton)
//     Contrôles, DANS CET ORDRE : corps > 128 Ko → 413 ; jeton inconnu → 401 ;
//     plus de 20 envois dans l'heure → 429 ; JSON illisible ou v ≠ 1 → 400.
//     Au plus 14 jours, jamais plus d'un jour dans le futur, jamais plus de
//     30 jours en arrière (jours de Paris). Chaque valeur hors bornes est
//     écartée et comptée dans `ignores`. Une seule écriture multi-chemins.
//     LE CORPS N'EST JAMAIS JOURNALISÉ.
//
// UNE VFC N'EST PAS UNE AUTRE : Health Connect donne la RMSSD, Apple la SDNN.
// `vfcMethode` suit chaque valeur ; l'app ne compare jamais les deux.
import { paris } from './metier.js';
import { lignesVersJours } from './lignes.js';
import { ErreurAppel } from './appels.js';

export const CORPS_MAX = 128 * 1024;
export const ENVOIS_PAR_HEURE = 20;
export const JOURS_MAX = 14;
const JOUR_MS = 864e5;
// Ce qui ne s'accepte pas d'un envoi par jeton : la source 'garmin' ne vient
// que du Worker (garmin.js), jamais d'un téléphone.
const PAR_JETON = new Set(['android', 'ios']);
// 'garmin' : la Health API de Garmin, qui POUSSE elle-même (garmin.js). Elle
// n'entre jamais par /sante/i : sa source n'a pas de jeton de synchronisation.
export const PLATEFORMES = { android: 'healthconnect', ios: 'raccourci', garmin: 'garmin' };
export const METHODE_DEFAUT = { healthconnect: 'rmssd', raccourci: 'sdnn', garmin: 'rmssd' };
const JETON_RE = /^[A-Za-z0-9_-]{43}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
// Les bornes, celles de l'app (PESEE_MIN / PESEE_MAX pour le poids).
const BORNES = { pas: [0, 99999], sommeilMin: [30, 1080], fcRepos: [30, 120], vfc: [5, 250], poids: [25, 300], masseGrasse: [3, 60] };

const cleEmail = (e) => String(e || '').toLowerCase().trim().replace(/\./g, ',');

function b64url(octets) {
  let s = '';
  for (const o of octets) s += String.fromCharCode(o);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function empreinte(jeton) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(jeton))));
  return Array.from(h, (x) => x.toString(16).padStart(2, '0')).join('');
}

// ── LE JETON (appel authentifié) ─────────────────────────────────────────
export async function santeJeton({ auth, data }, ctx) {
  const { db } = ctx;
  const maintenant = (ctx.maintenant || Date.now)();
  const cle = cleEmail(auth && auth.email);
  if (!cle) throw new ErreurAppel(401, 'Connecte-toi pour effectuer cette action.');
  const action = String((data && data.action) || '');
  const meta = (await db.ref('sante_sync/' + cle + '/meta').get()).val() || null;
  if (action === 'etat') {
    const m = meta || {};
    return { actif: !!m.empreinte, creeLe: m.creeLe || null, derniereReception: m.derniereReception || null,
      plateforme: m.plateforme || null, source: m.source || null, origines: m.origines || null,
      dernierEnvoi: m.dernierEnvoi || null, garmin: m.garmin || null };
  }
  if (action === 'revoquer') {
    const maj = { ['sante_sync/' + cle]: null };
    if (meta && meta.empreinte) maj['sante_jetons/' + meta.empreinte] = null;
    // Et toute entrée de sante_jetons qui pointe encore vers ce compte : un
    // nœud sante_sync effacé à la main (suppression de compte, app hors
    // ligne) laissait son empreinte orpheline, porteuse de la clé du compte.
    // Requête indexée (".indexOn": "cle" dans les règles).
    try {
      const orph = await db.ref('sante_jetons').parChamp('cle', cle, 10);
      for (const emp of Object.keys(orph || {})) maj['sante_jetons/' + emp] = null;
    } catch (e) { /* sans index : l'empreinte connue suffit */ }
    await db.ref('').update(maj);
    return { actif: false };
  }
  if (action === 'creer') {
    const jeton = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const emp = await empreinte(jeton);
    const maj = {
      ['sante_jetons/' + emp]: { cle, creeLe: maintenant },
      ['sante_sync/' + cle + '/meta']: { empreinte: emp, creeLe: maintenant },
    };
    if (meta && meta.empreinte && meta.empreinte !== emp) maj['sante_jetons/' + meta.empreinte] = null;
    await db.ref('').update(maj);
    return { jeton, creeLe: maintenant };
  }
  throw new ErreurAppel(400, 'Action inconnue.');
}

// ── LA VALIDATION D'UN JOUR ──────────────────────────────────────────────
const dans = (v, [a, b]) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
const jourValide = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = Date.parse(d + 'T12:00:00Z');
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === d;
};
const decaler = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * JOUR_MS).toISOString().slice(0, 10);

/** Rend {v: champs retenus, ignores}. `v` vide : le jour entier est écarté. */
export function nettoyerJour(j, source) {
  const v = {};
  let ignores = 0;
  if (!j || typeof j !== 'object' || Array.isArray(j)) return { v, ignores: 1 };
  const num = (k, arrondi) => {
    if (j[k] === undefined || j[k] === null) return;
    const x = typeof j[k] === 'string' ? Number(j[k].replace(',', '.')) : j[k];
    if (dans(x, BORNES[k])) v[k] = arrondi ? Math.round(x) : Math.round(x * 10) / 10;
    else ignores++;
  };
  num('pas', true);
  num('sommeilMin', true);
  num('fcRepos', true);
  num('vfc', false);
  num('poids', false);
  num('masseGrasse', false);
  if (v.sommeilMin) {
    for (const k of ['coucher', 'lever']) {
      if (j[k] === undefined || j[k] === null) continue;
      if (HHMM.test(String(j[k]))) v[k] = String(j[k]); else ignores++;
    }
    const p = j.phases;
    if (p && typeof p === 'object') {
      const ph = {};
      let somme = 0, bon = true;
      for (const k of ['profond', 'leger', 'paradoxal', 'eveil']) {
        if (p[k] === undefined || p[k] === null) continue;
        if (!dans(p[k], [0, 1080])) { bon = false; break; }
        ph[k] = Math.round(p[k]); somme += ph[k];
      }
      if (bon && somme > 0 && somme <= v.sommeilMin + 60) v.phases = ph;
      else ignores++;
    }
  } else if (j.coucher != null || j.lever != null || j.phases != null) ignores++;
  if (v.vfc !== undefined) {
    const m = String(j.vfcMethode || '').toLowerCase();
    v.vfcMethode = m === 'rmssd' || m === 'sdnn' ? m : METHODE_DEFAUT[source] || 'sdnn';
  }
  return { v, ignores };
}


// ── L'ÉCRITURE DES JOURS, COMMUNE À TOUTES LES SOURCES ───────────────────
// Health Connect, le Raccourci iPhone et Garmin passent par ici : mêmes
// fenêtres (30 jours en arrière, 1 en avant, 14 au plus), mêmes bornes
// (nettoyerJour), mêmes rejets comptés dans `ignores`, même rétention.
// Rend {maj, jours, nuits, ignores} : les chemins à écrire, SANS les écrire.
//
// DEUX SOURCES LE MÊME JOUR : la plus récente gagne, champ par champ (c'est
// l'ordre des écritures). Chaque champ garde son origine dans
// jours/<d>/origines/<famille> : 'garmin' quand Garmin l'a écrit, effacée
// quand une autre source le réécrit.
const FAMILLE = { pas: 'pas', sommeilMin: 'sommeil', coucher: 'sommeil', lever: 'sommeil', phases: 'sommeil',
  fcRepos: 'fcRepos', vfc: 'vfc', vfcMethode: 'vfc', poids: 'poids', masseGrasse: 'masseGrasse' };
export function ecrireJours(cle, brut, source, maintenant) {
  const maj = {};
  let ignores = 0;
  brut = brut && typeof brut === 'object' ? brut : {};
  const aujourdhui = paris(maintenant).jour;
  const max = decaler(aujourdhui, 1), min = decaler(aujourdhui, -30);
  let dates = Object.keys(brut).filter((d) => {
    const bon = jourValide(d) && d <= max && d >= min;
    if (!bon) ignores++;
    return bon;
  }).sort();
  if (dates.length > JOURS_MAX) { ignores += dates.length - JOURS_MAX; dates = dates.slice(-JOURS_MAX); }
  let jours = 0, nuits = 0;
  for (const d of dates) {
    const { v, ignores: n } = nettoyerJour(brut[d], source);
    ignores += n;
    const cles = Object.keys(v);
    if (!cles.length) { ignores++; continue; }
    jours++;
    if (v.sommeilMin) nuits++;
    // Champ par champ : un envoi des pas seuls n'efface pas le sommeil reçu.
    const p = 'sante_sync/' + cle + '/jours/' + d + '/';
    for (const k of cles) maj[p + k] = v[k];
    maj[p + 'recu'] = maintenant;
    const familles = new Set(cles.map((k) => FAMILLE[k]).filter(Boolean));
    for (const f of familles) maj[p + 'origines/' + f] = source === 'garmin' ? 'garmin' : null;
    // Une nuit Garmin remplace la nuit entière : pas d'heure de coucher ni de
    // phases d'une autre source mêlées à sa durée.
    if (source === 'garmin' && v.sommeilMin) for (const k of ['coucher', 'lever', 'phases']) if (v[k] === undefined) maj[p + k] = null;
  }
  // LA RÉTENTION : 30 jours. Chaque envoi efface les jours de 31 à 45 jours
  // en arrière, sans rien lire (un envoi par quinzaine suffit à tout purger).
  for (let i = 31; i <= 45; i++) maj['sante_sync/' + cle + '/jours/' + decaler(aujourdhui, -i)] = null;
  return { maj, jours, nuits, ignores };
}

const refus = (statut, erreur) => ({ statut, corps: { erreur } });

// ── « À QUEL COMPTE CE JETON ENVOIE-T-IL ? » ───────────────────────────────
// POST /sante/qui, en-tête X-RepCore-Jeton → {compte:'l•••@gmail.com'}.
// L'APK le fait confirmer avant de ranger un jeton reçu par un lien : une
// page malveillante ne peut pas y glisser le sien sans que ça se voie.
// Masqué : la première lettre et le domaine, rien de plus.
export function masquer(cle) {
  const e = String(cle || '').replace(/,/g, '.');
  const i = e.indexOf('@');
  if (i < 1) return '•••';
  return e[0] + '•••' + e.slice(i);
}
export async function compteDuJeton(req, ctx) {
  const jeton = String(req.headers.get('X-RepCore-Jeton') || '').trim();
  if (!JETON_RE.test(jeton)) return refus(401, 'jeton inconnu');
  const emp = await empreinte(jeton);
  const lien = (await ctx.db.ref('sante_jetons/' + emp).get()).val();
  if (!lien || !lien.cle) return refus(401, 'jeton inconnu');
  const meta = (await ctx.db.ref('sante_sync/' + lien.cle + '/meta/empreinte').get()).val();
  if (meta !== emp) return refus(401, 'jeton inconnu');
  return { statut: 200, corps: { compte: masquer(lien.cle) } };
}

// ── LA RÉCEPTION ─────────────────────────────────────────────────────────
// Rend { statut, corps } : index.js y pose les en-têtes (CORS compris).
export async function recevoirSante(req, ctx) {
  const { db } = ctx;
  const maintenant = (ctx.maintenant || Date.now)();
  // 1. LA TAILLE, avant tout (l'en-tête si présent, puis les octets lus).
  const annonce = Number(req.headers.get('Content-Length') || 0);
  if (annonce > CORPS_MAX) return refus(413, 'trop gros');
  const texte = await req.text();
  if (new TextEncoder().encode(texte).length > CORPS_MAX) return refus(413, 'trop gros');
  // 2. LE JETON.
  const url = new URL(req.url);
  const jeton = decodeURIComponent(url.pathname.replace(/^\/sante\/i\/?/, '')) || String(req.headers.get('X-RepCore-Jeton') || '').trim();
  if (!JETON_RE.test(jeton)) return refus(401, 'jeton inconnu');
  const emp = await empreinte(jeton);
  const lien = (await db.ref('sante_jetons/' + emp).get()).val();
  if (!lien || !lien.cle) return refus(401, 'jeton inconnu');
  const cle = String(lien.cle);
  const meta = (await db.ref('sante_sync/' + cle + '/meta').get()).val();
  // Un dossier effacé par son propriétaire, ou un jeton remplacé : révoqué.
  if (!meta || meta.empreinte !== emp) return refus(401, 'jeton inconnu');
  // 3. LE PLAFOND : 20 envois par heure glissante (fenêtre fixe d'une heure).
  const f = meta.fenetre && maintenant - meta.fenetre.debut < 3600e3 ? meta.fenetre : { debut: maintenant, n: 0 };
  if (f.n >= ENVOIS_PAR_HEURE) return refus(429, 'trop d’envois');
  const base = 'sante_sync/' + cle + '/meta/';
  const maj = { [base + 'fenetre']: { debut: f.debut, n: f.n + 1 } };
  // 4. LE FORMAT.
  let corps = null;
  try { corps = JSON.parse(texte); } catch (e) { corps = null; }
  const source = corps && PAR_JETON.has(corps.plateforme) && PLATEFORMES[corps.plateforme];
  // v : 1, ou « 1 » quand le Dictionnaire du Raccourci l'a typé Texte.
  if (!corps || typeof corps !== 'object' || String(corps.v) !== '1' || !source || corps.source !== source) {
    await db.ref('').update(maj);
    return refus(400, 'format');
  }
  let ignores = 0;
  let brut = corps.jours && typeof corps.jours === 'object' ? corps.jours : {};
  if (corps.lignes && typeof corps.lignes === 'object') {
    const l = lignesVersJours(corps.lignes);
    brut = Object.assign({}, brut, l.jours);
    ignores += l.ignores;
  }
  const e = ecrireJours(cle, brut, source, maintenant);
  Object.assign(maj, e.maj);
  ignores += e.ignores;
  const { jours, nuits } = e;
  const origines = {};
  if (corps.origines && typeof corps.origines === 'object') {
    for (const k of ['pas', 'sommeil']) {
      const o = String(corps.origines[k] || '').toLowerCase();
      if (/^[a-z]{2,20}$/.test(o)) origines[k] = o;
    }
  }
  maj[base + 'derniereReception'] = maintenant;
  maj[base + 'plateforme'] = corps.plateforme;
  maj[base + 'source'] = source;
  if (Object.keys(origines).length) maj[base + 'origines'] = origines;
  maj[base + 'recus'] = (Number(meta.recus) || 0) + 1;
  // Ce que l'app dit après un envoi : « Données reçues : 3 jours, 2 nuits ».
  maj[base + 'dernierEnvoi'] = { jours, nuits };
  await db.ref('').update(maj);
  return { statut: 200, corps: { jours, ignores } };
}

// ══ LE RAPPEL DU MATIN (iPhone) ══════════════════════════════════════════
// Le Raccourci « RepCore Santé » tourne par une automatisation iOS, qui ne
// part pas toujours (téléphone verrouillé, automatisation coupée). Vers 10 h
// (planif.js), un compte iPhone dont la nuit n'est pas arrivée reçoit :
// « Ta nuit n'est pas encore arrivée » — une fois par jour au plus, jamais
// deux jours de suite sans réception entre les deux, et plus rien après
// deux rappels restés sans effet, jusqu'à la prochaine réception.
// L'état vit dans sante_sync/<clé>/rappel {jour, n, recu} (serveur seul).
export const RAPPEL_MAX = 2;
export const MESSAGE_RAPPEL = { type: 'sante', title: 'Ta nuit n\u2019est pas encore arriv\u00e9e',
  body: 'Touche pour l\u2019envoyer \u00e0 RepCore.', url: './#sante-envoyer', tag: 'sante-rappel' };

/** PURE. Faut-il notifier ce compte maintenant ? Rend {ok, raison, n}. */
export function rappelSante({ meta, rappel, t }) {
  const m = meta || {};
  if (!m.empreinte) return { ok: false, raison: 'inactif' };
  if (m.plateforme !== 'ios') return { ok: false, raison: 'pas_ios' };
  const recu = Number(m.derniereReception) || 0;
  if (!recu) return { ok: false, raison: 'jamais_recu' };
  const p = paris(t), r = paris(recu);
  // Reçu aujourd'hui après 4 h (Paris) : la nuit est là.
  if (r.jour === p.jour && r.heure >= 4) return { ok: false, raison: 'recu' };
  if (r.jour > p.jour) return { ok: false, raison: 'recu' };
  // Les rappels comptent depuis la DERNIÈRE réception : une nouvelle remet à zéro.
  const e = rappel && Number(rappel.recu) === recu ? rappel : { jour: null, n: 0, recu };
  if (e.jour === p.jour) return { ok: false, raison: 'deja' };
  if ((Number(e.n) || 0) >= RAPPEL_MAX) return { ok: false, raison: 'silence' };
  if (e.jour && e.jour === decaler(p.jour, -1)) return { ok: false, raison: 'hier' };
  return { ok: true, raison: null, n: (Number(e.n) || 0) + 1, recu };
}

/** Un compte (clé de sante_sync) : lit, décide, pousse, retient. */
// `serieReservee(cle, t)` (metier.js) : le jeudi de 8 h à 18 h, un athlète dont
// la série n'est pas validée garde sa place pour « Ta série est en danger » ;
// le rappel de santé est alors SAUTÉ (rien n'est retenu : il pourra partir demain).
export async function rappelSanteUn(cle, t, { db, envoyerPush, serieReservee }) {
  const node = (await db.ref('sante_sync/' + cle + '/meta').get()).val();
  if (!node || node.plateforme !== 'ios') return 'pas_ios';
  const rappel = (await db.ref('sante_sync/' + cle + '/rappel').get()).val();
  const d = rappelSante({ meta: node, rappel, t });
  if (!d.ok) return d.raison;
  if (serieReservee && await serieReservee(cle, t)) return 'reserve_serie';
  const r = await envoyerPush(cle, MESSAGE_RAPPEL, { attendre: false });
  if (!r || !r.envoye) return (r && r.raison) || 'echec';
  await db.ref('sante_sync/' + cle + '/rappel').set({ jour: paris(t).jour, n: d.n, recu: d.recu });
  return 'envoye';
}
