// ══ LE MÉTIER DU SERVEUR LÉGER ════════════════════════════════════════════
//
// Porté depuis functions/index.js (branche « viralité », builds 1591-1600),
// écrit d'abord pour les Cloud Functions du plan Blaze. Le plan Blaze est
// payant ; Kevin a tranché « 0 € ». Ce code tourne donc dans un Cloudflare
// Worker gratuit, et trois choses changent :
//
// 1. PAS DE DÉCLENCHEURS DE BASE. Ce que les Functions recevaient à l'écriture
//    d'un nœud (réponse du coach, défi publié, séance terminée, demande de
//    parrainage), le Worker le RELÈVE chaque minute dans des boîtes aux
//    lettres : /evenements (déposés par l'app), /parrainage/demandes et
//    /ambassadeurs_demandes (déjà écrits par l'app, sans « etat » tant
//    qu'ils n'ont pas été jugés).
//
// 2. DIX MILLISECONDES DE CALCUL ET CINQUANTE REQUÊTES PAR EXÉCUTION (plan
//    gratuit). Les rappels planifiés avancent donc PAR LOTS, d'une minute à
//    l'autre, avec un curseur dans /worker/jobs. Et le Worker ne relit JAMAIS
//    les séances d'un athlète : c'est l'app de l'athlète qui écrit sa propre
//    progression dans un défi (elle la calcule déjà pour sa jauge).
//
// 3. LA PAGE PUBLIQUE AVEC APERÇU PERSONNALISÉ n'est pas portée : les liens
//    /@pseudo et /coach/slug gardent l'aperçu par défaut (og-image.png).
//
// Les calculs PURS restent ceux de functions/*-calcul.js, avec leurs bancs.

import D from '../../functions/defis-calcul.js';
import P from '../../functions/parrainage-calcul.js';
import A from '../../functions/ambassadeurs-calcul.js';
import ATT from '../../functions/attribution-calcul.js';
import { envoyerA } from './push.js';
import * as DU from './duels.js';
import * as SA from './saisons.js';
import * as RE from './retour.js';
import * as RL from './relances.js';
import * as PR from './prospects.js';
import * as XPS from './xp.js';
import * as RT from './retention.js';
import * as RQ from './risque.js';
import * as L from './ligues.js';
import * as RA from './rappels.js';
import * as CS from './calendrier-saisons.js';
import * as QC from './quota-coach.js';
import { OFFRES_PAYPAL } from './paypal.js';
import TARIFS from '../../tarifs.json' with { type: 'json' };

export const CREATOR_EMAIL = 'guellec.coachingpro@gmail.com';
export const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
// La clé du créateur, destinataire des alertes (plafond de parrainage).
export const CLE_CREATEUR_PUSH = CREATOR_EMAIL.replace(/\./g, ',');
// 'message' : un athlète a écrit à son coach (messagerie, lot M2). Vers l'athlète,
// un message du coach part en type 'coach'.
export const PUSH_TYPES = ['serie', 'wrapped', 'bilan', 'badge', 'coach', 'filleul', 'defi', 'acces', 'retour', 'sante', 'relance', 'prospect', 'message'];
const BONUS_ESSAI_JOURS = 30;  // le mois offert par l'ami : = TARIFS.essai_parrainage.moisEnPlus × 30 (l'app l'ouvre, essaiOuvrir)
const PALIERS = ['aucun', 'essentielle', 'ultime', 'suivi'];

// ── LE TEMPS : À PARIS POUR LES TRAVAUX, CHEZ L'ATHLÈTE POUR LES ENVOIS ──
// Les travaux planifiés se déclenchent à l'heure de Paris (planif.js). Mais
// les heures calmes, et le jour du plafond des push (deux par jour), sont ceux de
// l'ATHLÈTE : son fuseau (users/<clé>/tz, posé par l'app au démarrage) ; à
// défaut, ou mal formé, Europe/Paris.
// UN FORMATEUR PAR FUSEAU, GARDÉ : en construire un à chaque appel coûtait
// ~0,07 ms, des milliers de fois par réveil. Un fuseau refusé par Intl n'est
// pas gardé (il retombe sur Paris).
export const TZ_DEFAUT = 'Europe/Paris';
// Un nom IANA : « UTC », ou « Zone/Ville » (« America/Argentina/Salta »).
export const TZ_RE = /^(?:UTC|[A-Z][A-Za-z_+-]*(?:\/[A-Za-z0-9_+-]+){1,2})$/;
const _formateurs = new Map();
function formateur(tz) {
  let f = _formateurs.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('fr-FR', { timeZone: tz, year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false });
    _formateurs.set(tz, f);
  }
  return f;
}
// Le fuseau à utiliser : celui donné s'il est bien formé ET connu d'Intl, sinon Paris.
export function fuseauValide(tz) {
  if (typeof tz !== 'string' || tz.length > 64 || !TZ_RE.test(tz)) return TZ_DEFAUT;
  try { formateur(tz); return tz; } catch (e) { return TZ_DEFAUT; }
}
export function heureLocale(t, tz) {
  const f = formateur(fuseauValide(tz));
  const p = {};
  for (const x of f.formatToParts(new Date(t))) p[x.type] = x.value;
  const annee = Number(p.year), mois = Number(p.month), date = Number(p.day);
  return { jour: p.year + '-' + p.month + '-' + p.day, heure: Number(p.hour) % 24, minute: Number(p.minute),
    annee, mois, date, joursem: new Date(Date.UTC(annee, mois - 1, date)).getUTCDay() };
}
export function paris(t) { return heureLocale(t, TZ_DEFAUT); }
// PURE. Le push du 21e jour d'essai, parcours « Mise sous tension » pas fini.
export function messageParcoursJ21(n, jour) {
  const k = Math.max(1, Math.min(7, Math.round(Number(n)) || 1));
  return { type: 'serie', prio: 'parcours', url: './?parcours=1', tag: 'parcours-j21-' + String(jour || ''),
    title: 'Encore ' + k + ' étape' + (k > 1 ? 's' : '') + ' ⚡',
    body: 'Ta Mise sous tension est presque bouclée : ' + (k > 1 ? 'les ' + k + ' dernières étapes débloquent' : 'la dernière étape débloque') + ' le badge SOUS TENSION.' };
}
// Les avantages qu'un code ambassadeur peut porter (un seul).
export const AVANTAGES_AMB = ['essai+1mois', 'ultime_demi'];
// PURE. La semaine d'un ambassadeur : la somme de 7 jours d'attribution.
export function semaineAmbassadeur(jours) {
  const o = { clics: 0, inscrits: 0, payants: 0 };
  for (const j of jours || []) {
    if (!j || typeof j !== 'object') continue;
    o.clics += Math.max(0, Number(j.clic) || 0);
    o.inscrits += Math.max(0, Number(j.inscription) || 0);
    o.payants += Math.max(0, Number(j.payant) || 0);
  }
  return o;
}
// Les heures calmes DU DESTINATAIRE (21 h – 8 h dans son fuseau). `plage`
// {de, a} : celle qu'un coach a réglée (Réglages de coaching, miroir dans
// pushPrefs.calme, 06/10/2026) ; invalide ou absente, l'origine.
export const CALME_DEFAUT = Object.freeze({ de: 21, a: 8 });
export function plageCalme(p) {
  const ok = (v) => Number.isInteger(v) && v >= 0 && v <= 23;
  const de = Number(p && p.de), a = Number(p && p.a);
  return ok(de) && ok(a) && de !== a ? { de, a } : CALME_DEFAUT;
}
export function heuresCalmes(t, tz, plage) {
  const h = heureLocale(t, tz).heure, { de, a } = plageCalme(plage);
  return de > a ? (h >= de || h < a) : (h >= de && h < a);
}
export function lundiParis(t) {
  const p = paris(t);
  const d = new Date(Date.UTC(p.annee, p.mois - 1, p.date));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
// ── LA PRIORITÉ D'UN PUSH (01/10/2026) ────────────────────────────────────
// Le plafond d'UN push par jour laissait la place au premier arrivé : la
// série en danger du jeudi 18 h, le J-2 et le résultat d'un duel (18 h 30),
// les réactions (19 h) étaient jetés dès qu'un rappel de santé ou un défi
// était parti le matin. Chaque message a désormais une priorité (plus grand
// = plus important) : `message.prio` (une clé de cette table) quand il le
// précise, sinon son TYPE. Le type, lui, ne change pas : c'est lui que
// règlent les préférences de l'athlète (pushPrefs).
export const PUSH_PRIORITE = Object.freeze({
  duel_fin: 90, serie: 85, duel_j2: 80,
  defi: 70,                       // les 48 h d'un défi, une saison, un duel qui commence
  ligue: 65,                      // les ligues (01/10/2026) : la zone de bascule du samedi, le résultat du lundi
  retour: 60, parcours: 60, accueil: 60,
  wrapped: 55, badge: 50, filleul: 50, coach: 50, message: 50,
  veille: 50,                     // la veille d'un créneau, 19 h 30 (type serie, 02/10/2026)
  reactions: 45, bilan: 40, acces: 40, prospect: 40, relance: 30, sante: 20 });
// Au-delà d'un push dans la journée, seul un message de cette priorité passe.
export const PRIO_SECOND = 80;
export const PUSH_PAR_JOUR = 2;
export function prioDe(message) {
  const m = message || {};
  if (typeof m.prio === 'number' && isFinite(m.prio)) return m.prio;
  return PUSH_PRIORITE[String(m.prio || '')] || PUSH_PRIORITE[String(m.type || '')] || 0;
}
// Combien de push ce journal compte AUJOURD'HUI (l'ancien format {jour, at,
// type}, sans `n`, en compte un).
export function pushDuJour(log, jour) {
  if (!log || log.jour !== jour) return 0;
  return Math.max(1, Number(log.n) || 1);
}
// Le plafond : au plus PUSH_PAR_JOUR par jour, et le second seulement pour
// une priorité ≥ PRIO_SECOND (série, duel). Rend la raison du refus, ou null.
export function plafondAtteint(log, jour, prio) {
  const n = pushDuJour(log, jour);
  if (n >= PUSH_PAR_JOUR) return 'plafond';
  if (n >= 1 && !(Number(prio) >= PRIO_SECOND)) return 'plafond';
  return null;
}
// `tz` : le fuseau de l'athlète. Le plafond compte SON jour (push_log.jour
// est écrit dans ce fuseau) : un changement d'heure ne le décale pas.
// `prio` : celle du message (prioDe) ; à défaut, celle de son type. Les
// heures calmes valent pour tous, le second push de priorité ≥ 80 compris.
export function pushAutorise(type, prefs, log, t, tz, prio) {
  if (PUSH_TYPES.indexOf(type) < 0) return { ok: false, raison: 'type' };
  if (prefs && prefs[type] === false) return { ok: false, raison: 'coupe' };
  if (heuresCalmes(t, tz, prefs && prefs.calme)) return { ok: false, raison: 'calme' };
  // Un humain qui écrit n'entre pas dans le plafond du jour : son plafond à
  // lui est celui du fil (filLibre), pris en transaction par envoyerPush.
  if (estHumain(type)) return { ok: true, raison: null };
  const p = prio === undefined ? (PUSH_PRIORITE[type] || 0) : prio;
  const plein = plafondAtteint(log, heureLocale(t, tz).jour, p);
  if (plein) return { ok: false, raison: plein };
  return { ok: true, raison: null };
}
// ── LES PUSH D'UN HUMAIN (06/10/2026) ──────────────────────────────────────
// Le plafond du jour faisait taire le deuxième message du coach, ou sa
// réponse à un bilan arrivée après le défi du matin. Un message écrit par
// une personne — la messagerie (`coach` vers l'athlète, `message` vers le
// coach) et la réponse au bilan, texte ou vocale (déposée en `coach`) — ne
// compte pas dans push_log. Son plafond : un push par FIL (le tag,
// « message-<clé> », qui regroupe aussi côté appareil) toutes les 10 min,
// push_log_humain/<clé>/<tag> = at. ⚠ `bilan` n'en est pas : c'est le
// RAPPEL de remplir son bilan (dimanche, accueil), un push de jeu.
export const PUSH_HUMAINS = Object.freeze(['message', 'coach']);
export const estHumain = (type) => PUSH_HUMAINS.indexOf(String(type || '')) >= 0;
export const FIL_HUMAIN_MS = 10 * 60e3;
// PURE. Le fil est-il libre à `t`, son dernier push datant de `at` ?
export const filLibre = (at, t) => !(Number(at) > 0 && t - Number(at) < FIL_HUMAIN_MS);
// La clé du fil dans la base : le tag, sans les caractères qu'elle refuse.
export const cleFil = (tag) => String(tag || 'rc').replace(/[.#$\[\]\/]/g, '_').slice(0, 120);

// LA RÉSERVATION DU JEUDI : de 8 h à 18 h (Paris), les rappels qui peuvent
// attendre (accès, santé) se taisent chez un athlète dont la série court et
// n'est pas encore validée cette semaine : la place du second push est
// gardée pour « Ta série est en danger » à 18 h. PURE.
export function reserveSerieJeudi(t, streak, streakWeek) {
  const p = paris(t);
  if (p.joursem !== 4 || p.heure < 8 || p.heure >= 18) return false;
  return Number(streak) > 0 && streakWeek !== lundiParis(t);
}

// ── LA NUIT, UNE FILE PAR ATHLÈTE (06/10/2026) ─────────────────────────────
// push_attente/<clé>/<id> = {message, at, tz} : au plus ATTENTE_FILE
// entrées, les plus récentes. L'ancienne place unique ({message, at, prio,
// cumul, tz}, ou le message à plat) écrasait la réponse de 22 h sous le défi
// de 23 h : la file les garde tous deux, et le matin UN push les résume
// (« 2 messages de ton coach, 1 défi »).
export const ATTENTE_MAX_MS = 14 * 3600e3;
export const ATTENTE_FILE = 5;
// L'ordre du résumé : le plus important d'abord (c'est lui qui donne au push
// du matin son type, son lien et ses préférences).
export const PRIO_PUSH = Object.freeze({ coach: 5, message: 5, acces: 4, prospect: 4, filleul: 3, defi: 2, relance: 2, serie: 2,
  bilan: 2, wrapped: 1, badge: 1, retour: 1, sante: 1 });
export const prioPush = (type) => PRIO_PUSH[String(type || '')] || 1;
// L'ancien format (une place) relu comme une entrée.
export function normaliserAttente(m) {
  if (!m || typeof m !== 'object') return null;
  if (m.message && typeof m.message === 'object') return { message: m.message, at: Number(m.at) || 0, tz: fuseauValide(m.tz) };
  const message = Object.assign({}, m); delete message.at;
  return { message, at: Number(m.at) || 0, tz: TZ_DEFAUT };
}
const ancienneAttente = (cur) => !!cur && ((cur.message && typeof cur.message === 'object') || typeof cur.at === 'number');
// PURE. Les entrées d'une file (ancien format compris), de la plus ancienne
// à la plus récente : [{id, message, at, tz}].
export function fileAttente(cur) {
  if (!cur || typeof cur !== 'object') return [];
  if (ancienneAttente(cur)) { const e = normaliserAttente(cur); return e ? [Object.assign({ id: 'ancien' }, e)] : []; }
  const out = [];
  for (const id of Object.keys(cur)) {
    const e = cur[id];
    if (!(e && typeof e === 'object' && e.message && typeof e.message === 'object')) continue;
    const x = { id, message: e.message, at: Number(e.at) || 0, tz: fuseauValide(e.tz) };
    if (e.calme && plageCalme(e.calme) !== CALME_DEFAUT) x.calme = plageCalme(e.calme);
    out.push(x);
  }
  return out.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
}
// PURE. La file après l'arrivée de `message` sous `id` : les ATTENTE_FILE
// plus récentes (objet prêt à écrire).
export function ajouterAttente(cur, id, message, t, tz, calme) {
  const p = calme ? plageCalme(calme) : null;
  const l = fileAttente(cur).concat([p && p !== CALME_DEFAUT ? { id, message, at: t, tz: fuseauValide(tz), calme: p } : { id, message, at: t, tz: fuseauValide(tz) }]).slice(-ATTENTE_FILE);
  const o = {};
  for (const e of l) o[e.id] = e.calme ? { message: e.message, at: e.at, tz: e.tz, calme: e.calme } : { message: e.message, at: e.at, tz: e.tz };
  return o;
}
const LIB_RESUME = Object.freeze({ coach: ['message de ton coach', 'messages de ton coach'], message: ['nouveau message', 'nouveaux messages'],
  defi: ['défi', 'défis'], serie: ['rappel de série', 'rappels de série'], badge: ['badge', 'badges'] });
// PURE. Le push du matin : une entrée part telle quelle ; plusieurs, un seul
// push qui les compte, au type, au lien et à la priorité de la plus importante.
export function resumeMatin(entrees) {
  const l = (entrees || []).filter((e) => e && e.message);
  if (!l.length) return null;
  if (l.length === 1) return Object.assign({}, l[0].message);
  const tri = l.slice().sort((a, b) => prioPush(b.message.type) - prioPush(a.message.type) || b.at - a.at);
  const haut = tri[0].message;
  const n = new Map();
  for (const e of tri) {
    const k = LIB_RESUME[e.message.type] ? e.message.type : 'autre';
    n.set(k, (n.get(k) || 0) + 1);
  }
  const morceaux = [];
  for (const [k, c] of n) {
    const lib = LIB_RESUME[k] || ['autre nouvelle', 'autres nouvelles'];
    morceaux.push(c + ' ' + lib[c > 1 ? 1 : 0]);
  }
  return Object.assign({ type: haut.type, url: haut.url || './', tag: 'matin', title: 'Pendant la nuit', body: morceaux.join(', ') },
    haut.prio !== undefined ? { prio: haut.prio } : {});
}
function prolonger(echeanceActuelle, ms, t) {
  return Math.max(Number(echeanceActuelle) || 0, t || Date.now()) + (Number(ms) || 0);
}
export const emailKey = (e) => String(e || '').toLowerCase().trim().replace(/\./g, ',');

// ── LA SÉRIE, RECALCULÉE À LA DATE DU JOUR ────────────────────────────────
// PORTÉ DE L'APP (rc-core : ecartNormalJours, _streakPerime, streakJokersBilan)
// et gardé identique : le compteur stocké ne bouge qu'à la fin d'une séance,
// et un push « ta série de 9 semaines est en danger » à quelqu'un dont l'app
// affiche 0 depuis trois semaines était faux.
//   · périmée : l'absence dépasse d'une semaine pleine l'écart normal
//     (7 / créneaux actifs, arrondi au-dessus, + 1 jour), à compter de la
//     dernière séance, d'une suspension levée ou d'un joker ;
//   · sauvée : les jokers couvrent les semaines terminées sans validation
//     (au moins une) — l'app les consommera à la prochaine ouverture ;
//   · cassée : sinon.
// ⚠ UNE DIFFÉRENCE, ASSUMÉE : l'app retire aussi des semaines manquées celles
//   qu'un historique de suspensions a couvertes (_tcSuspensions). Le serveur
//   ne lit pas cet historique ; il n'en tient compte que pour la dernière
//   suspension levée (depart). Au pire, il juge cassée une série que les
//   jokers sauveraient : il se tait, il ne ment pas.
export const SERIE_MAX_JOURS = 14;
const JOUR_MS = 864e5;
const lundiDeCle = (cle) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(cle || ''));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
};
export function serieDuJour(u, t) {
  const s = Math.max(0, Number(u && u.streak) || 0);
  const out = { valeur: 0, etat: 'aucune', semaines: s };
  if (!s) return out;
  if (u.suspension && u.suspension.actif) return Object.assign(out, { valeur: s, etat: 'gel' });
  const der = Number(u.lastSession) || 0;
  if (!der || t - der > SERIE_MAX_JOURS * JOUR_MS) return Object.assign(out, { etat: 'ancienne' });
  const creneaux = (Array.isArray(u.sessions_config) ? u.sessions_config : Object.values(u.sessions_config || {}))
    .filter((x) => x && x.active).length;
  const ecart = Math.ceil(7 / Math.max(1, creneaux)) + 1;
  const finSusp = (u.suspension && !u.suspension.actif && Number(u.suspension.fin) > 0) ? Number(u.suspension.fin) : 0;
  const depart = Math.max(der, finSusp, Number(u.streakJokerLe) || 0);
  if (Math.floor((t - depart) / JOUR_MS) <= ecart + 7) return Object.assign(out, { valeur: s, etat: 'vivante' });
  // Périmée : les jokers la sauvent-ils ?
  const l0 = lundiDeCle(u.streakWeek);
  const jokers = Math.max(0, Math.min(2, Number(u.streakJokers) || 0));
  if (l0 === null) return Object.assign(out, { etat: 'cassee' });
  const lc = lundiDeCle(lundiParis(t));
  let manquees = 0;
  for (let k = 1; k < 600 && l0 + 7 * k * JOUR_MS < lc; k++) manquees++;
  if (jokers >= Math.max(1, manquees)) return Object.assign(out, { valeur: s, etat: 'sauvee' });
  return Object.assign(out, { etat: 'cassee' });
}

// ── LE BUDGET D'UNE EXÉCUTION (plan gratuit : 50 sous-requêtes, 10 ms de calcul)
// Un push coûte ~7 requêtes (préférences, journal, abonnements, transaction,
// l'envoi) et ~1,5 ms de chiffrement par appareil (mesuré : test/charge.test.mjs).
// Cinq chiffrements par exécution tiennent sous les 10 ms avec la marge du
// reste (lecture, JSON) ; au-delà, la suite part en sous-tâches.
export const COUT_PUSH = 8;
// Le profil de relance (worker/profils/<uid>) : ses champs, et sa durée de vie.
export const PROFIL_CHAMPS = ['streak', 'streakWeek', 'lastSession', 'fname', 'accessExpiry', 'status', 'suspension', 'tz'];
export const PROFIL_VALIDITE_MS = 7 * 864e5;
export const MAX_CHIFFREMENTS = 5;
const MARGE = 2;

// UN IDENTIFIANT EN FIN DE FILE /evenements : après tout ce qui y est déjà
// (horodaté, trié comme ceux de l'app), au format que les règles acceptent.
let _nFile = 0;
export function idFile(t, marque) {
  const a = new Uint8Array(4); crypto.getRandomValues(a);
  return 'e' + Number(t).toString(36) + (marque || 'r') + (_nFile++ % 46656).toString(36).padStart(3, '0')
    + Array.from(a, (b) => (b % 36).toString(36)).join('');
}

// LES PLAFONDS, RÉGLABLES PAR VARIABLES (wrangler.toml, [vars]) : BUDGET,
// MAX_CHIFFREMENTS, COUT_PUSH. Absents ou illisibles : les valeurs du plan
// gratuit ci-dessus. Plan payant (docs/capacite.md) : BUDGET=900,
// MAX_CHIFFREMENTS=200.
export function limitesDe(env) {
  const n = (v, d) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x > 0 ? x : d; };
  const e = env || {};
  return { budget: n(e.BUDGET, 38), maxChiffrements: n(e.MAX_CHIFFREMENTS, MAX_CHIFFREMENTS), coutPush: n(e.COUT_PUSH, COUT_PUSH) };
}

/**
 * @param {{db:any, vapid:{publique:string, privee:string}, fetchImpl?:Function, maintenant?:()=>number,
 *   limites?:{maxChiffrements?:number, coutPush?:number}, file?:{sendBatch:Function}}} deps
 * `file` : la file Cloudflare Queues des push (env.PUSHS, si FILE_PUSH='queue') ;
 * absente, tout passe par /evenements comme sur le plan gratuit.
 */
// ══ LES INDICATEURS DU CRÉATEUR (02/10/2026) — PURE ═════════════════════════
// L'onglet monétisation recalculait le revenu depuis le cache de l'app : les
// dossiers que l'appareil avait sous la main, au prix de la table — un abonné
// à l'ancien tarif comptait au nouveau, un annuel pour un mois plein, un
// résilié tant que son dossier disait « active ». Ici, depuis ce que le
// SERVEUR sait :
//   · droits/<clé> (source paypal) : actif si sans échéance ; une échéance
//     future = RÉSILIÉ EN COURS (fermerALaFin la pose), exclu du MRR ; passée = fini ;
//   · le MONTANT RÉELLEMENT PRÉLEVÉ : la dernière vente de l'abonnement dans
//     paypal_transactions (le plan demi compte 12,45 € le premier mois) ; un
//     plan annuel (OFFRES_PAYPAL.periode) compte pour an / 12 ;
//   · les coachs : coachPlan + coachSubActive (le registre, côté serveur) ;
//     un coach dont la fin est notée (paypal_fins) est résilié, exclu du MRR.
// Montants en EUROS TTC, arrondis au centime à la fin seulement.
//   churnMois      résiliations notées ce mois ÷ (actifs + elles), en %
//   conversionEssai part des comptes passés par l'essai qui ont payé, en %
//   partAnnuel     part des athlètes abonnés actifs en annuel, en %
//   revenuParCoach MRR des formules coach ÷ coachs payants, en €
//   remboursesMois remboursements totaux (annuleLe) du mois, en €
const euros2 = (cts) => Math.round(cts) / 100;
const pct1 = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
export function indicateurs(droits, transactions, users, maintenant, fins) {
  const t = Number(maintenant) || Date.now();
  const mois = paris(t).jour.slice(0, 7);
  const duMois = (x) => Number(x) > 0 && paris(Number(x)).jour.slice(0, 7) === mois;
  const D = droits || {}, X = transactions || {}, U = users || {}, F = fins || {};
  // La dernière vente de chaque abonnement, et qui a déjà payé un abonnement.
  const derniere = {}, payeurs = new Set();
  let remboursesCts = 0;
  for (const [id, x] of Object.entries(X)) {
    if (!x || typeof x !== 'object') continue;
    if (duMois(x.annuleLe)) {
      const r = Object.values(x.rembourses || {}).reduce((a, b) => a + (Number(b) || 0), 0);
      remboursesCts += r > 0 ? r : (Number(x.montant) || 0);
    }
    if (x.type !== 'abonnement') continue;
    if (x.cle) payeurs.add(String(x.cle));
    if (!x.abo) continue;
    const p = derniere[x.abo];
    if (!p || (Number(x.le) || 0) > (Number(p.le) || 0)) derniere[x.abo] = Object.assign({ id }, x);
  }
  const par = { essentielle: 0, ultime: 0, coach: 0, pro: 0 };
  let actifs = 0, resilies = 0, athletes = 0, annuels = 0, coachs = 0, essais = 0, convertis = 0;
  for (const [cle, d] of Object.entries(D)) {
    if (!d || typeof d !== 'object') continue;
    if (Number(d.essaiOuvertLe) > 0) { essais++; if (payeurs.has(cle)) convertis++; }
    const pal = String(d.palier || '');
    if (d.source !== 'paypal' || (pal !== 'essentielle' && pal !== 'ultime')) continue;
    const ech = Number(d.echeance) || 0;
    if (ech > 0) { if (ech > t) resilies++; continue; }
    const v = d.abo ? derniere[d.abo] : null;
    let cts = Math.round(TARIFS[pal].mois * 100), an = false;
    if (v && Number(v.montant) > 0) {
      cts = Number(v.montant);
      const pl = OFFRES_PAYPAL[v.plan];
      // Sans plan noté (ventes d'avant le 02/10/2026) : un montant au-delà de
      // six mensualités ne peut être qu'un annuel.
      an = pl ? pl.periode === 'an' : cts > Math.round(TARIFS[pal].mois * 100) * 6;
    }
    par[pal] += an ? cts / 12 : cts;
    actifs++; athletes++; if (an) annuels++;
  }
  for (const [cle, u] of Object.entries(U)) {
    const p = u && u.coachPlan;
    if ((p !== 'coach' && p !== 'pro') || u.coachSubActive !== true) continue;
    if (F[cle]) { resilies++; continue; }
    par[p] += Math.round(TARIFS.coach[p] * 100);
    actifs++; coachs++;
  }
  const resMois = Object.values(F).filter((f) => f && duMois(f.le)).length;
  const total = par.essentielle + par.ultime + par.coach + par.pro;
  return {
    mrrTTC: euros2(total),
    mrrParFormule: { essentielle: euros2(par.essentielle), ultime: euros2(par.ultime), coach: euros2(par.coach), pro: euros2(par.pro) },
    abonnesActifs: actifs,
    resiliesEnCours: resilies,
    churnMois: pct1(resMois, actifs + resMois),
    conversionEssai: pct1(convertis, essais),
    partAnnuel: pct1(annuels, athletes),
    revenuParCoach: coachs ? euros2((par.coach + par.pro) / coachs) : null,
    remboursesMois: euros2(remboursesCts),
  };
}

export function creerMetier(deps) {
  const { db } = deps;
  const LIM = Object.assign({ maxChiffrements: MAX_CHIFFREMENTS, coutPush: COUT_PUSH }, deps.limites || {});
  const file = deps.file && typeof deps.file.sendBatch === 'function' ? deps.file : null;
  const now = deps.maintenant || (() => Date.now());
  const _val = async (c) => (await db.ref(c).get()).val();
  const _lire = (uid, champ) => _val('users/' + uid + '/' + champ);

  // ══ LE BUDGET, ET CE QUI NE TIENT PAS DEDANS ═══════════════════════════
  // planif.js fixe `reste` (les requêtes encore permises) à chaque réveil.
  // Les boucles internes — un défi à tous les athlètes, le rappel des 48 h,
  // les messages de la nuit, les ambassadeurs, les fins PayPal — le consultent
  // AVANT chaque tour. Quand il ne suffit plus, elles écrivent la suite en
  // SOUS-TÂCHES (une par athlète) au bout de /evenements, en une seule
  // écriture, et rendent la main : le réveil suivant les reprend.
  // Hors d'un réveil (webhook PayPal), rien n'est fixé : pas de limite ici.
  let _reste = () => Infinity;
  let _chiffres = 0;
  function fixerBudget(fn) { _reste = typeof fn === 'function' ? fn : () => Infinity; _chiffres = 0; _abonnes = null; }
  const reste = () => _reste();
  const peutPousser = () => _reste() >= LIM.coutPush + MARGE && _chiffres < LIM.maxChiffrements;
  const chiffrements = () => _chiffres;
  // `maj` : d'autres écritures à faire DANS LA MÊME requête (le passage de
  // relais est atomique : rien n'est retiré sans que sa suite soit écrite).
  // AVEC LA FILE (plan payant, FILE_PUSH='queue') : les PUSH partent dans
  // Cloudflare Queues (enfiler) ; le reste — PayPal, relances, xp —, dont
  // l'ordre compte, reste dans /evenements.
  async function differer(taches, maj0) {
    const t = now();
    const maj = Object.assign({}, maj0 || {});
    let reste = taches;
    if (file) {
      await enfiler(taches.filter((x) => x && x.quoi === 'push'));
      reste = taches.filter((x) => !(x && x.quoi === 'push'));
    }
    for (const x of reste) maj['evenements/' + idFile(t, 't')] = Object.assign({ type: 'tache', par: 'worker', at: t }, x);
    if (Object.keys(maj).length) await db.ref().update(maj);
    return taches.length;
  }
  // `urgent` voyage avec la sous-tâche : un push d'administrateur différé (un
  // litige PayPal) garde sa priorité à la minute suivante.
  const tachePush = (uid, message, o) => Object.assign({ quoi: 'push', uid, message }, o && o.attendre === false ? { attendre: false } : {},
    o && o.urgent ? { urgent: true } : {});
  // [{uid, message}] : envoyés tant que le budget le permet, le reste différé.
  // UN SEUL DESTINATAIRE : pousser1. C'est ainsi que partent les push du
  // chemin PayPal (parrain, filleul, plafond, litige) : un webhook à court de
  // requêtes dépose le push pour la minute suivante au lieu de tomber.
  const pousser1 = (uid, message, o) => pousserA([{ uid, message }], o);
  async function pousserA(liste, o) {
    let envoyes = 0;
    // AVEC LA FILE : tout part dans la file, le consommateur envoie.
    if (file) {
      await differer(liste.map((x) => tachePush(x.uid, x.message, o)));
      return { envoyes: 0, differes: liste.length };
    }
    for (let i = 0; i < liste.length; i++) {
      if (!peutPousser()) {
        await differer(liste.slice(i).map((x) => tachePush(x.uid, x.message, o)));
        return { envoyes, differes: liste.length - i };
      }
      const r = await envoyerPush(liste[i].uid, liste[i].message, o);
      if (r.envoye) envoyes++;
    }
    return { envoyes, differes: 0 };
  }

  // LA FILE : par paquets de 100 (le plafond de sendBatch), un message par
  // tâche. Rend le nombre d'envois (chacun compte dans le budget de l'appelant).
  async function enfiler(corps) {
    if (!file || !corps.length) return 0;
    let n = 0;
    for (let i = 0; i < corps.length; i += 100) { await file.sendBatch(corps.slice(i, i + 100).map((body) => ({ body }))); n++; }
    return n;
  }
  const enModeFile = () => !!file;
  // LES ABONNÉS PAR PAGES (mode file) : `n` clés de /push après `apres`, en
  // une requête. Les clés seules sont gardées.
  async function abonnesPage(apres, n) {
    const ref = apres ? db.ref('push').orderByKey().startAt(String(apres)).limitToFirst(n + 1) : db.ref('push').orderByKey().limitToFirst(n);
    const v = (await ref.get()).val() || {};
    return Object.keys(v).sort().filter((k) => !apres || k > String(apres)).slice(0, n);
  }

  // ── LES DROITS (palier, échéance) — écrits par le serveur seul ──────────
  async function lireDroits(cle) { return _val('droits/' + cle); }
  async function ecrireDroits(cle, champs) {
    const patch = Object.assign({}, champs || {}, { maj: now() });
    if (patch.palier !== undefined) patch.palier = PALIERS.indexOf(String(patch.palier)) > 0 ? String(patch.palier) : 'aucun';
    if (patch.echeance !== undefined) patch.echeance = Number(patch.echeance) || 0;
    await db.ref('droits/' + cle).update(patch);
    return patch;
  }
  // ── droits/ SUIT CHAQUE CHANGEMENT DE PAIEMENT (27/09/2026) ────────────
  // Le dossier, son titulaire l'écrit : un accès qui ne vit que là se
  // trafique depuis une console. droits/, seul le créateur l'écrit (et ce
  // serveur, avec son accès administrateur) : c'est ce que l'app lit d'abord.
  //
  // `fn(actuel)` rend les champs à poser, ou rien. En transaction : deux
  // événements PayPal simultanés ne s'écrasent pas.
  // ⚠ UN ACCÈS POSÉ À LA MAIN N'EST PAS RÉÉCRIT. Ouvert (« main ») ou fermé
  //   (« suspension ») par le créateur depuis l'écran Accès, il prime sur ce
  //   que PayPal annonce ; « rendre » la main efface le nœud, et le serveur
  //   reprend au changement suivant.
  const SOURCES_MAIN = ['main', 'suspension'];
  // A-T-IL DÉJÀ PAYÉ ? Trois traces que son titulaire ne peut pas fabriquer
  // pour lui-même, ou qui l'engagent : le premier paiement noté par le
  // serveur, un abonnement PayPal dans le dossier (le vider n'efface pas
  // paypal_premiers), et un accès posé par PayPal dans droits/.
  // ⚠ PAS createdAt : un compte ancien n'a pas forcément payé, et createdAt,
  //   son titulaire l'écrit — le remettre à aujourd'hui passait pour neuf.
  async function dejaPaye(cle, droits) {
    const [premier, abo] = await Promise.all([_val('paypal_premiers/' + cle), _lire(cle, 'paypalSubscriptionId')]);
    const d = droits === undefined ? await lireDroits(cle) : droits;
    return !!(premier || (abo && /^I-/.test(String(abo))) || (d && /^paypal/.test(String(d.source || '')))
      || (d && String(d.abo || '')));
  }
  async function majDroits(cle, fn) {
    if (!cle) return null;
    let res = null;
    const tx = await db.ref('droits/' + cle).transaction((d) => {
      if (d && SOURCES_MAIN.indexOf(String(d.source)) >= 0) return undefined;
      const n = fn(d || null);
      if (!n) return undefined;
      const out = Object.assign({}, d || {}, n, { maj: now() });
      out.palier = PALIERS.indexOf(String(out.palier)) >= 0 ? String(out.palier) : 'aucun';
      out.echeance = Math.max(0, Number(out.echeance) || 0);
      for (const k of Object.keys(out)) if (out[k] === null || out[k] === undefined) delete out[k];
      res = out;
      return out;
    });
    return tx.committed ? res : null;
  }
  // Le palier ouvert à l'instant t par un nœud droits/, comme l'app le lit.
  const palierDroits = (d, t) => {
    if (!d) return null;
    const p = PALIERS.indexOf(String(d.palier)) > 0 ? String(d.palier) : 'aucun';
    return (Number(d.echeance) > 0 && t >= Number(d.echeance)) ? 'aucun' : p;
  };

  // ══ WEB PUSH ═══════════════════════════════════════════════════════════
  // `o.urgent` : un message pour l'ADMINISTRATEUR (un litige PayPal). Ni
  // heures calmes, ni plafond du jour, ni préférences : chaque litige
  // doit arriver, à l'heure où il arrive. Réservé au code du serveur.
  // `o.tz` : le fuseau de l'athlète déjà lu (profil) ; sinon relu ici.
  // `o.attendre === false` : un message qui n'a de sens que maintenant ; en
  // heures calmes, il est abandonné au lieu d'attendre le matin.
  // PANNE PASSAGÈRE (429 ou 5xx sur TOUS les appareils, ou réseau) : le jour
  // n'est pas consommé, et — dans la file (tâche, événement : enFile) ou sur
  // demande (o.leverTransitoire) — on LÈVE « push_transitoire » : planif.js
  // le remet en file (essais + 1). Ailleurs : { raison: 'transitoire' }.
  async function envoyerPush(uid, message, o) {
    const t = now();
    const type = String((message && message.type) || '');
    const urgent = !!(o && o.urgent);
    const logDonne = !!o && o.log !== undefined;
    const tzDonne = !!o && o.tz !== undefined;
    // UNE lecture pour le fuseau ET les préférences : la surface du dossier
    // (tz y est en clair ; pushPrefs, objet, n'y vaut que « true » — relu
    // seulement s'il existe, c'est-à-dire si l'athlète a réglé quelque chose).
    const humain = estHumain(type);
    // Un push d'humain ne lit pas push_log : il n'y compte pas.
    const [surf, log] = urgent ? [null, null] : await Promise.all([_surface(uid), (logDonne || humain) ? (humain ? null : o.log) : _val('push_log/' + uid)]);
    const prefs = surf ? await _objet(uid, surf, 'pushPrefs') : null;
    const tz0 = tzDonne ? o.tz : (surf ? surf.tz : null);
    const tz = fuseauValide(tz0);
    const prio = prioDe(message);
    const ok = urgent ? { ok: true, raison: null } : pushAutorise(type, prefs, log, t, tz, prio);
    if (!ok.ok) {
      if (ok.raison === 'calme' && (!o || o.attendre !== false)) {
        const id = idFile(t, 'n');
        await db.ref('push_attente/' + uid).transaction((cur) => ajouterAttente(cur, id, message, t, tz, prefs && prefs.calme));
        return { envoye: 0, raison: 'calme', differe: true };
      }
      return { envoye: 0, raison: ok.raison };
    }
    const subs = (await _val('push/' + uid)) || {};
    const ids = Object.keys(subs);
    if (!ids.length) return { envoye: 0, raison: 'aucun_abonnement' };
    const jour = heureLocale(t, tz).jour;
    // LA PLACE SE PREND EN TRANSACTION : deux envois simultanés ne prennent
    // pas la même. `avant` garde le journal d'avant, rendu si rien ne part.
    let avant = null;
    const fil = 'push_log_humain/' + uid + '/' + cleFil(message.tag || ('rc-' + type));
    if (!urgent && humain) {
      const tx = await db.ref(fil).transaction((cur) => {
        if (!filLibre(cur, t)) return undefined;
        avant = cur || null;
        return t;
      });
      if (!tx.committed) return { envoye: 0, raison: 'fil' };
    } else if (!urgent) {
      const tx = await db.ref('push_log/' + uid).transaction((cur) => {
        if (plafondAtteint(cur, jour, prio)) return undefined;
        avant = cur && cur.jour === jour ? cur : null;
        return { jour, n: pushDuJour(cur, jour) + 1, at: t, type, prio };
      });
      if (!tx.committed) return { envoye: 0, raison: 'plafond' };
    }
    const charge = JSON.stringify({ title: message.title, body: message.body || '',
      url: message.url || './', tag: message.tag || ('rc-' + type), type });
    let envoye = 0, tentes = 0, passagers = 0;
    await Promise.all(ids.map(async (id) => {
      const s = subs[id];
      if (!s || !s.endpoint || !s.keys) return;
      _chiffres++;
      tentes++;
      try {
        const r = await envoyerA(s, charge, { publique: deps.vapid.publique, privee: deps.vapid.privee,
          contact: 'mailto:' + CREATOR_EMAIL, fetchImpl: deps.fetchImpl });
        if (r.statut >= 200 && r.statut < 300) envoye++;
        else if (r.statut === 404 || r.statut === 410) await db.ref('push/' + uid + '/' + id).remove();
        else if (r.statut === 429 || r.statut >= 500) passagers++;
      } catch (e) { passagers++; /* un appareil injoignable n'arrête pas les autres */ }
    }));
    // RIEN N'EST PARTI : la place est rendue — le journal redevient celui
    // d'avant (le premier push du jour reste compté), ou disparaît.
    if (!envoye && !urgent && humain) {
      await db.ref(fil).transaction((cur) => (Number(cur) === t ? avant : undefined));
    } else if (!envoye && !urgent) {
      await db.ref('push_log/' + uid).transaction((cur) => (cur && cur.jour === jour && Number(cur.at) === t) ? (avant || null) : undefined);
    }
    if (!envoye && tentes > 0 && passagers === tentes) {
      if (_enFile || (o && o.leverTransitoire)) throw new Error('push_transitoire');
      return { envoye: 0, raison: 'transitoire' };
    }
    return { envoye, raison: envoye ? null : 'echec' };
  }
  // UN PUSH « TERMINÉ » : parti, ou refusé pour de bon (préférence coupée,
  // aucun appareil, type inconnu, appareils hors service). Le plafond, les
  // heures calmes et la panne passagère laissent l'état en place : le travail
  // suivant réessaie.
  const pushTermine = (r) => !!r && (r.envoye > 0 || ['coupe', 'aucun_abonnement', 'type', 'echec'].indexOf(r.raison) >= 0);
  // planif.js le pose pendant qu'il traite un événement ou une sous-tâche.
  let _enFile = false;
  const enFile = (v) => { _enFile = !!v; };
  // LES ABONNÉS, UNE LECTURE PAR RÉVEIL : serie, acces, retour, bilan… la
  // demandaient chacun, à chaque minute. fixerBudget (début de réveil) l'oublie.
  let _abonnes = null;
  // ══ L'ALERTE D'UN ÉVÉNEMENT EN ÉCHEC (01/10/2026) ═════════════════════
  // Un événement rangé dans evenements_ko (cinq échecs) ne se voyait qu'en
  // ouvrant l'écran des échecs. Le créateur reçoit un push URGENT, une fois
  // par heure de Paris au plus : worker/alerte_ko porte l'heure du dernier,
  // posée en transaction (deux réveils ne l'envoient pas deux fois).
  async function alerteKo(type, erreur, t) {
    const p = paris(t), heure = p.jour + 'h' + p.heure;
    const tx = await db.ref('worker/alerte_ko').transaction((v) => (v === heure ? undefined : heure));
    if (!tx.committed) return { envoye: 0, raison: 'deja' };
    return envoyerPush(CLE_CREATEUR_PUSH, { type: 'coach', url: './', tag: 'serveur-ko-' + heure,
      title: 'Serveur : un événement en échec', body: String(type || '?') + ' : ' + String(erreur || '').slice(0, 140) }, { urgent: true });
  }
  const abonnes = () => (_abonnes = _abonnes || db.ref('push').shallow().catch((e) => { _abonnes = null; throw e; }));
  // La surface d'un dossier (base.js, surface) : ses champs simples en UNE
  // requête ; un champ objet y vaut `true` et se relit à part s'il sert.
  const _surface = (uid) => db.ref('users/' + uid).surface();
  const _objet = async (uid, s, champ) => (s[champ] === true ? _lire(uid, champ) : (s[champ] === undefined ? null : s[champ]));

  // ══ LES PROFILS DE RELANCE (worker/profils/<uid>, 01/10/2026) ══════════
  // Les rappels planifiés lisaient trois à cinq champs PAR ATHLÈTE, y compris
  // pour tous ceux qu'on ne relance pas (série cassée, déjà entraîné, pas
  // d'échéance proche). Le profil réunit ces champs en un nœud que le Worker
  // seul écrit ; planif.js les lit PAR PAGES (une requête pour 200) et les
  // passe un à un : l'athlète écarté en mémoire ne coûte plus rien.
  //
  // QUI L'ÉCRIT : la fin de séance (seance_fin, après les volts), et le
  // rappel lui-même quand le profil manque ou date de plus de PROFIL_VALIDITE_MS.
  // CE QU'IL DÉCIDE : seulement d'ÉCARTER. Un athlète retenu est relu dans
  // son dossier avant tout envoi, comme avant. Les champs de séance (série,
  // semaine, dernière séance) ne changent qu'avec une séance, qui rafraîchit
  // le profil ; l'échéance d'accès peut bouger sans séance (code, PayPal,
  // créateur) : elle est relue au plus tard au bout de sept jours.
  // DEUX REQUÊTES d'ordinaire : la surface du dossier (tous les champs
  // simples d'un coup), et l'écriture. Une troisième si une suspension existe.
  async function rafraichirProfil(uid, t) {
    const s = await _surface(uid);
    const p = { maj: t };
    for (const c of PROFIL_CHAMPS) if (c !== 'suspension' && s[c] !== undefined && s[c] !== null && s[c] !== true) p[c] = s[c];
    const susp = await _objet(uid, s, 'suspension');
    if (susp) p.suspension = susp;
    if (p.suspension && typeof p.suspension === 'object') p.suspension = { actif: !!p.suspension.actif, fin: Number(p.suspension.fin) || 0 };
    else delete p.suspension;
    if (p.fname != null) p.fname = String(p.fname).slice(0, 40);
    await db.ref('worker/profils/' + uid).set(p);
    return p;
  }
  // `profil` : undefined (appel hors des pages : lecture directe, comme
  // avant), null (aucun profil) ou le nœud lu.
  async function profilUtile(uid, profil, t) {
    if (profil === undefined) return null;
    if (profil && Number(profil.maj) > t - PROFIL_VALIDITE_MS) return profil;
    return rafraichirProfil(uid, t);
  }
  async function profilsPage(debut, n) {
    return (await db.ref('worker/profils').orderByKey().startAt(String(debut)).limitToFirst(n).get()).val() || {};
  }
  // Le journal des push (push_log/<uid> : {jour, n, at, type, prio}), par pages
  // aussi : un athlète dont le plafond du jour est pris POUR CETTE PRIORITÉ est
  // écarté sans une seule requête, dans chaque travail.
  async function logsPage(debut, n) {
    return (await db.ref('push_log').orderByKey().startAt(String(debut)).limitToFirst(n).get()).val() || {};
  }
  // `log` : undefined (pas lu par pages), null (rien aujourd'hui) ou le journal.
  // Le jour du plafond est celui de l'athlète (son fuseau, porté par le profil).
  const dejaNotifie = (log, t, tz, cle) => !!plafondAtteint(log, heureLocale(t, tz).jour, PUSH_PRIORITE[cle] || 0);
  // `pr` : le profil lu (porte tz) — envoyerPush n'a alors pas à relire le fuseau.
  const optLog = (log, o, pr) => Object.assign({}, o || {}, log === undefined ? {} : { log: log || null },
    pr ? { tz: pr.tz || null } : {});

  // La réservation du jeudi (reserveSerieJeudi) pour un athlète : le profil
  // s'il est là, sinon deux champs — et seulement le jeudi de 8 h à 18 h.
  async function serieReservee(uid, t, pr) {
    if (!reserveSerieJeudi(t, 1, null)) return false;
    const [streak, semaine] = pr ? [pr.streak, pr.streakWeek] : await Promise.all([_lire(uid, 'streak'), _lire(uid, 'streakWeek')]);
    return reserveSerieJeudi(t, streak, semaine);
  }
  // ── LA SÉRIE EN DANGER : jeudi 17 h (« jeu ») et le dernier appel du samedi
  // 10 h (« sam »). LA SÉRIE EST RECALCULÉE À LA DATE DU JOUR (serieDuJour, la
  // règle de l'app) : rien si elle est cassée, gelée, ou si la dernière séance
  // date de plus de 14 jours. Deux temps : trois champs d'abord, qui écartent
  // la plupart des dossiers ; le reste ensuite.
  async function serieEnDanger(uid, t, profil, log, quand) {
    if (dejaNotifie(log, t, profil && profil.tz, 'serie')) return 'plafond';
    const lundi = lundiParis(t);
    const pr = await profilUtile(uid, profil, t);
    const [streak, semaine, der] = pr ? [pr.streak, pr.streakWeek, pr.lastSession]
      : await Promise.all(['streak', 'streakWeek', 'lastSession'].map((c) => _lire(uid, c)));
    if (!(Number(streak) > 0) || semaine === lundi) return 'rien';
    if (!(Number(der) > 0) || t - Number(der) > SERIE_MAX_JOURS * JOUR_MS) return 'ancienne';
    // LE SAMEDI : seulement si l'athlète ne s'est pas entraîné depuis le
    // premier appel (jeudi 18 h). Une séance validerait la semaine de toute
    // façon ; celle-ci compte aussi une séance enregistrée en retard.
    if (quand === 'sam' && Number(der) >= jeudi18h(lundi)) return 'ouvert';
    // La surface du dossier : prénom et jokers d'un coup ; la suspension et
    // le planning, objets, relus seulement s'ils existent. LA SUSPENSION EST
    // TOUJOURS RELUE ICI, jamais prise au profil : elle change sans séance.
    const s = await _surface(uid);
    const [susp, config] = await Promise.all([_objet(uid, s, 'suspension'), _objet(uid, s, 'sessions_config')]);
    const fname = s.fname, jokerLe = s.streakJokerLe;
    // LES JOKERS QUE LE DOSSIER EXPLIQUE (xp.js, jokersAdmis) : ceux de la
    // série en cours, et ceux du coffre de la mission du jour, DATÉS dans
    // u.missions — relu seulement s'il en faut pour expliquer la réserve.
    let jokers = 0;
    if (Number(s.streakJokers) > 0) {
      const base = { streakJokers: s.streakJokers, streak, streakJokersUtilises: s.streakJokersUtilises };
      jokers = XPS.jokersAdmis(base);
      if (jokers < Math.min(XPS.JOKERS_MAX, Number(s.streakJokers) || 0) && s.missions !== undefined) {
        jokers = XPS.jokersAdmis(Object.assign(base, { missions: await _objet(uid, s, 'missions') }));
      }
    }
    const etat = serieDuJour({ streak, streakWeek: semaine, lastSession: der, suspension: susp, streakJokers: jokers,
      streakJokerLe: jokerLe, sessions_config: config }, t);
    if (etat.etat !== 'vivante' && etat.etat !== 'sauvee') return etat.etat;
    // Pas de doublon : une relance « retour » vient de partir.
    if (RE.retourRecent(RE.etatPeriode(await _val('retour_etat/' + uid), der), t)) return 'retour';
    const n = etat.valeur;
    const semaines = n + ' semaine' + (n > 1 ? 's' : '');
    const m = quand === 'sam'
      ? { title: 'Dernier week-end pour ta série de ' + semaines, body: 'Une séance d’ici dimanche soir et elle continue.' }
      : { title: 'Ta série de ' + semaines + ' est en danger',
        body: (fname ? fname + ', il' : 'Il') + ' te reste jusqu’à dimanche pour valider ta semaine.'
          + (Number(jokers) > 0 ? ' Ton joker la sauverait, mais garde-le pour un vrai coup dur.' : '') };
    const r = await envoyerPush(uid, Object.assign({ type: 'serie', prio: 'serie', url: './?wo=1', tag: 'serie-' + lundi + '-' + quand }, m), optLog(log, {}, pr));
    return r && r.envoye ? 'envoye' : ((r && r.raison) || 'echec');
  }
  // Jeudi 18 h, heure de Paris, de la semaine qui commence le lundi `lundi`.
  function jeudi18h(lundi) {
    const [a, mo, j] = String(lundi).split('-').map(Number);
    let x = Date.UTC(a, mo - 1, j + 3, 16, 0);       // 18 h en heure d'été
    if (paris(x).heure !== 18) x += 3600e3;          // 18 h en heure d'hiver
    return x;
  }

  // ── LES RAPPELS PLANIFIÉS — UNE PERSONNE À LA FOIS ─────────────────────
  // Chacun rend la même chose : il traite UNE clé. Le découpage en lots et le
  // curseur sont dans planif.js.
  const planifies = {
    // Série en danger : jeudi, de 17 h à 21 h (serieEnDanger, ci-dessus).
    async serie(uid, t, acc, profil, log) {
      return serieEnDanger(uid, t, profil, log, 'jeu');
    },
    // LE DERNIER APPEL DU SAMEDI, 10 h (01/10/2026) : la même série, si rien
    // n'a bougé depuis jeudi 18 h (pas de séance depuis le premier appel).
    async serieSamedi(uid, t, acc, profil, log) {
      return serieEnDanger(uid, t, profil, log, 'sam');
    },
    // Wrapped prêt : le 1er du mois, 10 h — pour qui s'est entraîné le mois écoulé.
    async wrapped(uid, t, acc, profil, log) {
      if (dejaNotifie(log, t, profil && profil.tz, 'wrapped')) return 'plafond';
      const p = paris(t);
      const moisPrec = p.mois === 1 ? 12 : p.mois - 1, anPrec = p.mois === 1 ? p.annee - 1 : p.annee;
      const debut = Date.UTC(anPrec, moisPrec - 1, 1) - 2 * 3600e3;
      const cle = 'm-' + anPrec + '-' + String(moisPrec).padStart(2, '0');
      const nom = new Date(Date.UTC(anPrec, moisPrec - 1, 15)).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'Europe/Paris' });
      const pr = await profilUtile(uid, profil, t);
      const der = Number(pr ? pr.lastSession : await _lire(uid, 'lastSession')) || 0;
      if (der < debut) return;
      await envoyerPush(uid, { type: 'wrapped', url: './?wrapped=' + cle, tag: 'wrapped-' + cle,
        title: 'Ton mois de ' + nom + ' est prêt', body: 'Tes chiffres, tes records et ton profil t’attendent.' }, optLog(log, {}, pr));
    },
    // Rappel de bilan : samedi 10 h, dernier bilan vieux de 13 jours ou plus.
    // SEULEMENT POUR QUI A UN COACH ET A DÉJÀ FAIT UN BILAN : le bilan est
    // ce que le coach lit ; sans coach, ou avant le premier, ce rappel
    // demandait un geste que personne n'attendait.
    async bilan(uid, t) {
      const [role, coach] = await Promise.all([_lire(uid, 'role'), _lire(uid, 'coachEmailKey')]);
      if (role === 'coach' || !coach) return 'sans_coach';
      const s = await db.ref('users/' + uid + '/bilans').orderByKey().limitToLast(1).get();
      let der = 0; s.forEach((c) => { der = Number((c.val() || {}).date) || 0; });
      if (!der) return 'aucun_bilan';
      if (t - der < 13 * 864e5) return 'recent';
      const fname = await _lire(uid, 'fname');
      await envoyerPush(uid, { type: 'bilan', url: './?bilan=1', tag: 'bilan-' + paris(t).jour,
        title: 'C’est l’heure de ton bilan', body: (fname ? fname + ', 10' : '10') + ' minutes quand tu as le temps ce week-end.' });
    },
    // FIN D'ACCÈS : chaque jour, 11 h — trois jours ou moins avant l'échéance,
    // UNE fois par échéance. C'était le bandeau de l'accueil, qu'on ne voit
    // qu'en ouvrant l'app : la notification le dit à qui ne l'ouvre plus.
    async acces(uid, t, acc, profil, log) {
      if (dejaNotifie(log, t, profil && profil.tz, 'acces')) return 'plafond';
      // Le profil ÉCARTE (pas d'échéance dans les trois jours) ; retenu, le
      // dossier est relu avant d'envoyer quoi que ce soit.
      const pr = await profilUtile(uid, profil, t);
      if (pr) { const e0 = Number(pr.accessExpiry) || 0; if (!(e0 > t) || e0 - t > 3 * 864e5) return 'profil'; }
      // LE JEUDI, LA SÉRIE D'ABORD : le rappel d'accès attend demain (il reste
      // au moins deux jours), relances_acces n'est pas posé.
      if (await serieReservee(uid, t, pr)) return 'reserve_serie';
      const [statut, ech, fin, fname, deja] = await Promise.all([_lire(uid, 'status'), _lire(uid, 'accessExpiry'),
        _lire(uid, 'abonnement/finAccesPaypal'), _lire(uid, 'fname'), _val('worker/relances_acces/' + uid)]);
      const e = Number(ech) || 0;
      if (!(e > t) || e - t > 3 * 864e5 || Number(deja) === e) return;
      const j = Math.max(1, Math.ceil((e - t) / 864e5));
      const quand = j === 1 ? 'dans moins de 24 heures' : 'dans ' + j + ' jours';
      const date = new Date(e).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' });
      let m = null;
      if (statut === 'COACHING_SUIVI')
        m = { title: 'Ton accès se termine ' + quand, body: (fname ? fname + ', il' : 'Il') + ' prend fin le ' + date + '. Préviens ton coach s’il doit le prolonger.' };
      else if (statut === 'AUTONOMIE_PREMIUM')
        m = { title: 'Ton abonnement prend fin ' + quand, body: fin ? 'Tu as résilié : ton accès reste ouvert jusqu’au ' + date + '.' : 'Ton accès prend fin le ' + date + '.' };
      if (!m) return;
      // Heures calmes CHEZ L'ATHLÈTE : il attend son matin (push_attente), et
      // compte comme parti — sinon le rappel serait redéposé chaque jour.
      const r = await envoyerPush(uid, Object.assign({ type: 'acces', url: './', tag: 'acces-' + e }, m), optLog(log, {}, pr));
      if (r.envoye || r.differe) await db.ref('worker/relances_acces/' + uid).set(e);
    },
    // BADGE PROCHE : dimanche 17 h — le plus proche d'ASSIDU (séances FAITES,
    // xp_etat.faites : une séance vide ne compte pas, et plus de lecture de
    // toutes les clés de séances), de BRISEUR DE RECORDS (xp_etat.s.record / 50)
    // et d'un PALIER DE SÉRIE (streak + 1). Un seul push (rappels.js, badgeProche).
    async badge(uid) {
      const [faites, rec, streak] = await Promise.all([_val('xp_etat/' + uid + '/faites'), _val('xp_etat/' + uid + '/s/record'), _lire(uid, 'streak')]);
      const b = RA.badgeProche({ faites, records: Math.floor((Number(rec) || 0) / XPS.XP.record), streak });
      if (!b) return 'loin';
      const r = await envoyerPush(uid, { type: 'badge', url: './', tag: b.tag, title: b.title, body: b.body });
      return r && r.envoye ? b.cle : ((r && r.raison) || 'echec');
    },
    // LA VEILLE (02/10/2026) : 19 h 30, la veille d'un créneau actif, à qui ne
    // s'est pas entraîné aujourd'hui (son jour à lui). Deux par semaine au
    // plus (worker/veille/<k> : les dates). Type serie, priorité 50 : dans le
    // plafond de deux push par jour, sans passer devant un second push.
    async veille(uid, t, acc, profil, log) {
      if (dejaNotifie(log, t, profil && profil.tz, 'veille')) return 'plafond';
      const pr = await profilUtile(uid, profil, t);
      const s = (await _surface(uid)) || {};
      if (s.role === 'coach') return 'coach';
      const tz = pr ? pr.tz : s.tz, loc = heureLocale(t, tz);
      const der = Number(pr ? pr.lastSession : s.lastSession) || 0;
      if (der > 0 && heureLocale(der, tz).jour === loc.jour) return 'seance_du_jour';
      const c = RA.creneauDemain(await _objet(uid, s, 'sessions_config'), loc.joursem);
      if (!c) return 'repos';
      const susp = pr ? pr.suspension : await _objet(uid, s, 'suspension');
      if (susp && susp.actif) return 'suspension';
      const dates = (await _val('worker/veille/' + uid)) || [];
      if (RA.veillesDeLaSemaine(dates, lundiParis(t)) >= RA.VEILLE_PAR_SEMAINE) return 'deux_cette_semaine';
      const exos = RA.exercicesDu(c);
      const [meilleurs, jr] = exos.length ? await Promise.all([_val('xp_etat/' + uid + '/meilleurs'), _val('xp_etat/' + uid + '/jr')]) : [null, null];
      const m = Object.assign({ tag: 'veille-' + loc.jour }, RA.messageVeille(c, RA.recordAPortee(exos, meilleurs, jr)));
      const r = await envoyerPush(uid, m, optLog(log, {}, pr));
      if (!r.envoye && !r.differe) return r.raison || 'echec';
      await db.ref('worker/veille/' + uid).set((Array.isArray(dates) ? dates : Object.values(dates)).concat([loc.jour]).slice(-4));
      return 'envoye';
    },
  };
  // Les messages mis de côté pendant la nuit, CHAQUE HEURE (planif.js) : ceux
  // dont l'athlète est sorti de SES heures calmes (son fuseau, gardé avec le
  // message) passent en sous-tâches, dans la même écriture qui les retire de
  // push_attente ; les autres attendent l'heure suivante. Un par athlète,
  // envoyés au rythme du budget, et rien ne se perd en route. Au-delà de
  // ATTENTE_MAX_MS (une nuit et plus), le message est trop vieux : retiré.
  async function apresHeuresCalmes() {
    const t = now();
    const tout = (await _val('push_attente')) || {};
    const maj = {}, taches = [];
    for (const uid of Object.keys(tout)) {
      const l = fileAttente(tout[uid]).filter((e) => t - e.at <= ATTENTE_MAX_MS);
      if (!l.length) { maj['push_attente/' + uid] = null; continue; }
      if (heuresCalmes(t, l[l.length - 1].tz, l[l.length - 1].calme)) continue;
      maj['push_attente/' + uid] = null;
      taches.push(tachePush(uid, resumeMatin(l), { attendre: false }));
    }
    if (Object.keys(maj).length) await differer(taches, maj);
    return taches.length;
  }

  // ── LA RARETÉ DES BADGES (la nuit), dossier par dossier ────────────────
  async function statsBadgesUn(uid, acc) {
    // La surface : le rôle d'un coup ; les badges relus seulement s'il y en a.
    const s = await _surface(uid);
    const role = s.role;
    const badges = role === 'coach' ? null : await _objet(uid, s, 'badges');
    if (role === 'coach') return;
    acc.total = (acc.total || 0) + 1;
    acc.n = acc.n || {};
    const b = (badges && typeof badges === 'object') ? badges : {};
    for (const id of Object.keys(b)) if (b[id] && Number(b[id].at) > 0) acc.n[id] = (acc.n[id] || 0) + 1;
  }
  async function statsBadgesFin(acc) {
    if (!acc.total) return;
    const pct = {};
    for (const id of Object.keys(acc.n || {})) pct[id] = Math.round(acc.n[id] / acc.total * 1000) / 10;
    await db.ref('stats/badges').set({ maj: now(), total: acc.total, pct });
  }

  // ══ LES DÉFIS DU CANAL ═════════════════════════════════════════════════
  async function defisDuCoach(coach) {
    const s = await db.ref('canaux/' + coach + '/messages').orderByChild('type').equalTo('defi').get();
    const out = [];
    s.forEach((c) => { const v = c.val(); if (v && v.type === 'defi') out.push(Object.assign({}, v, { id: c.key })); });
    return out;
  }
  const defiChemin = (coach, id, sous) => 'canaux/' + coach + '/defis/' + id + (sous ? '/' + sous : '');
  // Le classement d'un défi recalculé : l'événement de l'app (inscription) ou
  // la sous-tâche que pose progresEcrire après une séance.
  async function defiMaj(coach, id0, t) {
    const id = String(id0 || '').replace(/[^A-Za-z0-9_-]/g, '');
    const m = id ? await _val('canaux/' + coach + '/messages/' + id) : null;
    if (!m || m.type !== 'defi') return 'pas_un_defi';
    const etat = (await _val(defiChemin(coach, id, 'etat'))) || {};
    if (etat.clos) return 'clos';
    await recalculerDefi(coach, Object.assign({}, m, { id }), t);
    return 'recalcule';
  }
  // ⚠ LA VALEUR N'EST PAS RECALCULÉE ICI : le Worker l'écrit après chaque
  //   séance (progresEcrire, depuis xp_etat) — plus l'app depuis le
  //   01/10/2026. Le prénom vient de l'inscription (prenom, ou pseudo) :
  //   aucune lecture de dossier.
  async function participants(coach, defi) {
    const brut = (await _val(defiChemin(coach, defi.id, 'participants'))) || {};
    return Object.keys(brut).filter((k) => brut[k] && brut[k].inscription).map((k) => {
      const p = brut[k], ins = p.inscription || {};
      return { cle: k, nom: String(ins.pseudo || ins.prenom || '').trim() || 'Athlète', classement: ins.classement === true,
        valeur: Number(p.valeur) || 0, metrique: Number(p.metrique) || 0, termine: !!p.termine, termineLe: Number(p.termineLe) || 0 };
    });
  }
  async function publierSysteme(coach, defi, texte, t) {
    const id = 's' + t + '-' + String(defi.id).slice(-6).replace(/[^a-z0-9]/gi, '');
    await db.ref().update({
      ['canaux/' + coach + '/messages/' + id]: { at: t, type: 'systeme', texte: String(texte).slice(0, 1000), defiId: defi.id },
      ['coach_public/' + coach + '/canalDernier']: t });
    return id;
  }
  async function recalculerDefi(coach, defi, t, o) {
    const parts = await participants(coach, defi);
    const equipe = D.partEquipe(defi, parts.map((p) => p.valeur));
    for (const p of parts) {
      const fini = D.aTermine(defi, p.valeur, equipe);
      if (fini && !p.termineLe) p.termineLe = t;
      p.termine = fini;
    }
    const pl = D.places(parts);
    // UNE SEULE ÉCRITURE pour tous les participants et le résumé public.
    const maj = {};
    for (const p of parts) {
      const b = defiChemin(coach, defi.id, 'participants/' + p.cle);
      maj[b + '/termine'] = p.termine;
      maj[b + '/termineLe'] = p.termine ? p.termineLe : null;
      maj[b + '/place'] = pl[p.cle] || null;
    }
    maj[defiChemin(coach, defi.id, 'public')] = Object.assign(D.resumePublic(defi, parts), { maj: t });
    await db.ref().update(maj);
    if (!(o && o.sansAnnonce)) {
      const etat = (await _val(defiChemin(coach, defi.id, 'etat'))) || {};
      const a = D.annonceSuivante(defi, etat, parts, equipe, paris(t).jour);
      if (a) {
        await publierSysteme(coach, defi, a.texte, t);
        await db.ref(defiChemin(coach, defi.id, 'etat')).set(a.etat);
      }
    }
    return { parts, equipe };
  }
  async function cloturer(coach, defi, t) {
    const r = await recalculerDefi(coach, defi, t, { sansAnnonce: true });
    const g = D.gagnant(r.parts);
    await publierSysteme(coach, defi, D.textePodium(defi, r.parts), t);
    const maj = {};
    for (const p of r.parts.filter((x) => x.termine)) {
      maj['defis_resultats/' + p.cle + '/' + defi.id] = {
        titre: String(defi.titre || '').slice(0, 80), mesure: defi.mesure, collectif: !!defi.collectif,
        fin: Number(defi.fin), termineLe: p.termineLe || t, champion: !!(g && g.cle === p.cle), coach };
    }
    const etat = (await _val(defiChemin(coach, defi.id, 'etat'))) || {};
    maj[defiChemin(coach, defi.id, 'etat')] = Object.assign({}, etat, { clos: true, closLe: t, dernierSysteme: paris(t).jour,
      champion: g ? g.cle : null });
    await db.ref().update(maj);
  }
  // Tous les matins, 9 h : rappel des 48 h, annonces en attente, clôture.
  // Un défi coûte ~5 requêtes (~8 à la clôture) : si le budget ne suffit plus
  // pour le suivant, le coach entier est repris en sous-tâche. Tout y est
  // idempotent (rappel48, dernierSysteme, clos) ; le premier défi passe
  // toujours, pour que chaque reprise avance.
  async function defisQuotidienCoach(coach, t) {
    const jour = paris(t).jour;
    let n = 0;
    for (const defi of await defisDuCoach(coach)) {
      if (n++ > 0 && _reste() < 10) { await differer([{ quoi: 'defis_coach', coach }]); return 'differe'; }
      const etat = (await _val(defiChemin(coach, defi.id, 'etat'))) || {};
      if (etat.clos || t < Number(defi.debut)) continue;
      if (t > Number(defi.fin)) {
        if (etat.dernierSysteme !== jour) await cloturer(coach, defi, t);
        continue;
      }
      if (Number(defi.fin) - t <= 48 * 3600e3 && !etat.rappel48) {
        const parts = await participants(coach, defi);
        // Noté AVANT les envois : ceux qui ne tiennent pas dans le budget sont
        // déjà écrits en sous-tâches quand pousserA rend la main.
        await db.ref(defiChemin(coach, defi.id, 'etat/rappel48')).set(true);
        await pousserA(parts.filter((x) => !x.termine).map((p) => ({ uid: p.cle, message: { type: 'defi', url: './?canal=1', tag: 'defi-48h-' + defi.id,
          title: 'Plus que 48 h : ' + String(defi.titre || 'ton défi').slice(0, 60),
          body: 'Objectif : ' + D.texteObjectif(defi) + '. Tu en es à ' + String(p.valeur).replace('.', ',') + '.' } })), { attendre: false });
      }
      await recalculerDefi(coach, defi, t);
    }
  }
  const coachsAvecCanal = () => db.ref('canaux').shallow();
  const coachsAvecAthletes = () => db.ref('annuaire_coach').shallow();

  // ══ LE QUOTA D'UN COACH, APPLIQUÉ (02/10/2026) ══════════════════════════
  // Le travail « couverture_coachs » (planif.js, chaque jour à 6 h 30, et de
  // nouveau dès qu'une formule coach change chez PayPal) : pour chaque athlète
  // de l'annuaire d'un coach, droits/<athlète>/couvertParCoach = {jusqu} —
  // couvert : maintenant + 36 h ; hors quota après la grâce : l'instant de la
  // coupure (l'app retire alors le « suivi » d'un code de coach, voir palierDe).
  // Le rang de rattachement est gardé dans droits/<athlète>/rattache =
  // {coach, le} : le client ne peut pas l'écrire, donc pas s'antidater. Le
  // compteur de mois au-dessus du quota vit dans coachs_registre/<coach>/quota,
  // pour la même raison (users/<coach>/paliers s'écrit depuis le navigateur).
  // Voir quota-coach.js pour la règle.
  //
  // PAR ATHLÈTE, PAS PAR COACH : 38 requêtes par réveil, et un coach de vingt
  // athlètes en demande plus de soixante. Les clés sont « coach|athlète »
  // (l'annuaire, lu en une fois), chacune lit trois ou cinq petits nœuds et
  // range ce qu'elle a vu dans `acc` ; la fin calcule les places et écrit
  // tout en UNE mise à jour.
  // ⚠ On n'écrit QUE dans un droits/<athlète> qui existe : créer le nœud pour y
  //   poser couvertParCoach fermerait l'accès d'un athlète dont le dossier
  //   décide encore (avant la bascule).
  const CLE_CREATEUR_Q = CREATOR_EMAIL.replace(/\./g, ',');
  async function couvertureCles() {
    const an = (await _val('annuaire_coach')) || {};
    const out = [];
    for (const c of Object.keys(an)) for (const a of Object.keys(an[c] || {})) out.push(c + '|' + a);
    return out.sort();
  }
  async function couvertureUn(paire, t0, acc) {
    const t = Number(t0) || now();
    const [coach, a] = String(paire).split('|');
    if (!coach || !a) return;
    acc.c = acc.c || {};
    if (!acc.c[coach]) {
      const [registre, clients] = await Promise.all([_val('coachs_registre/' + coach), _val('users/' + coach + '/clients')]);
      const r = registre && typeof registre === 'object' ? registre : null;
      acc.c[coach] = { registre: r ? { plan: r.plan || 'libre', actifJusqu: Number(r.actifJusqu) || 0, le: Number(r.le) || 0, quota: r.quota || null } : null,
        clients: Array.isArray(clients) ? clients : Object.values(clients || {}), a: {} };
    }
    const C = acc.c[coach];
    if (!C.registre && coach !== CLE_CREATEUR_Q) return;          // pas (encore) un coach au registre
    const [droits, lien, jours] = await Promise.all([_val('droits/' + a), _val('users/' + a + '/coachEmailKey'), db.ref('xp_etat/' + a + '/jr').shallow()]);
    if (lien !== coach) return;                                   // l'annuaire garde parfois un ancien coach
    const ra = droits && droits.rattache;
    let le = (ra && ra.coach === coach && Number(ra.le) > 0) ? Number(ra.le) : 0, ordre = -1;
    if (!le) {
      // LA PREMIÈRE FOIS : la date du dossier (jamais avant l'entrée du coach au
      // registre, jamais dans le futur), ou maintenant ; et le rang dans clients.
      const [id, rattacheLe] = await Promise.all([_val('users/' + a + '/id'), _val('users/' + a + '/rattacheLe')]);
      const rl = Number(rattacheLe);
      le = Math.max(rl > 0 && rl <= t ? rl : t, Number(C.registre && C.registre.le) || 0);
      ordre = id != null ? C.clients.indexOf(id) : -1;
    }
    C.a[a] = { actif: QC.estActif(jours, paris(t).jour), le, ordre, existe: !!droits,
      couvAvant: Number(droits && droits.couvertParCoach && droits.couvertParCoach.jusqu) || 0,
      raCoach: (ra && ra.coach) || '', raLe: Number(ra && ra.le) || 0 };
  }
  async function couvertureFin(acc, t0) {
    const t = Number(t0) || now();
    const maj = {};
    const bilan = {};
    for (const coach of Object.keys((acc && acc.c) || {})) {
      const C = acc.c[coach];
      const createur = coach === CLE_CREATEUR_Q;
      if (!C.registre && !createur) continue;
      const athletes = Object.keys(C.a || {}).map((cle) => Object.assign({ cle }, C.a[cle]));
      const plan = QC.planEffectif(C.registre, t);
      const quota = createur ? Infinity : QC.QUOTAS[plan];
      const nActifs = athletes.filter((x) => x.actif).length;
      const etat = QC.cyclesSuivants((C.registre && C.registre.quota) || {}, nActifs > quota, QC.moisParis(t));
      const r = QC.placesCoach({ plan, createur, cycles: etat.cycles, athletes });
      for (const x of athletes) {
        if (!x.existe) continue;
        const couvert = r.couverts.has(x.cle);
        // Hors quota depuis un passage précédent : la date de la coupure ne bouge plus.
        if (couvert || !(x.couvAvant > 0 && x.couvAvant <= t)) maj['droits/' + x.cle + '/couvertParCoach'] = couvert
          // L'OFFRE DU COACH, avec la couverture (05/10/2026) : l'app de l'athlète
          // ne peut pas lire coachs_registre, et c'est elle qui ouvre la photo du repas.
          ? { jusqu: t + QC.COUVERT_MARGE_MS, plan: createur ? 'pro' : plan } : { jusqu: t };
        if (x.raCoach !== coach || x.raLe !== x.le) maj['droits/' + x.cle + '/rattache'] = { coach, le: x.le };
      }
      if (!createur) maj['coachs_registre/' + coach + '/quota'] = { cycles: etat.cycles, mois: etat.mois, n: r.n,
        horsQuota: r.horsQuota.length, quota: r.quota === Infinity ? -1 : r.quota, maj: t };
      bilan[coach] = { n: r.n, quota: r.quota, enGrace: r.enGrace, horsQuota: r.horsQuota, cycles: etat.cycles };
    }
    if (Object.keys(maj).length) await db.ref().update(maj);
    return bilan;
  }
  // Un coach d'un seul tenant (tests, et l'écran d'administration au besoin).
  async function couvertureCoach(coach, t0) {
    const t = Number(t0) || now();
    const an = await db.ref('annuaire_coach/' + coach).shallow();
    const acc = {};
    for (const a of an || []) await couvertureUn(coach + '|' + a, t, acc);
    if (!acc.c) acc.c = {};
    if (!acc.c[coach]) await couvertureUn(coach + '|', t, acc);
    return (await couvertureFin(acc, t))[coach] || null;
  }
  // Un changement de formule coach (paypal.js) : le travail du jour repasse dès
  // le réveil suivant, au lieu d'attendre demain 6 h 30.
  async function couvertureRelancer() { await db.ref('worker/jobs/couverture_coachs').remove(); }

  // ══ LE PARRAINAGE ══════════════════════════════════════════════════════
  async function parrainageDemande(uid, d) {
    const t = now();
    const code = String(d.code || '').toUpperCase();
    const parrain = P.CODE_RE.test(code) ? await _val('parrainage/codes/' + code) : null;
    const filleulEmail = P.cleVersEmail(uid);
    const [appareil, lien, emailVu, droits, creeLe, prenom, amb] = await Promise.all([
      d.appareil ? _val('parrainage/appareils/' + String(d.appareil).replace(/[^a-z0-9]/g, '')) : null,
      _val('parrainage/liens/' + uid),
      _val('parrainage/emails/' + P.cleNormalisee(filleulEmail)),
      lireDroits(uid), _lire(uid, 'createdAt'), _lire(uid, 'fname'), _val('ambassadeurs_liens/' + uid)]);
    const dec = P.deciderRattachement(Object.assign({}, d, { code }), {
      filleul: uid, filleulEmail, parrain, parrainEmail: parrain ? P.cleVersEmail(parrain) : '',
      appareilsParrain: (appareil && appareil === parrain) ? { [d.appareil]: true } : {},
      dejaFilleul: !!lien, dejaAmbassadeur: !!amb, emailDejaVu: !!emailVu, creeLe, maintenant: t,
      dejaPaye: await dejaPaye(uid, droits) });
    const dem = 'parrainage/demandes/' + uid;
    if (!dec.ok) { await db.ref(dem).update({ etat: 'refuse', raison: dec.raison, traiteLe: t }); return { ok: false, raison: dec.raison }; }
    const id = P.idFilleul(uid);
    const nom = String(prenom || '').trim().slice(0, 24);
    await db.ref().update({
      ['parrainage/comptes/' + parrain + '/filleuls/' + id]: { date: t, statut: 'inscrit', prenom: nom || null },
      ['parrainage/comptes/' + uid + '/parrain']: { code, le: t },
      ['parrainage/liens/' + uid]: { parrain, id },
      ['parrainage/emails/' + P.cleNormalisee(filleulEmail)]: uid,
      [dem + '/etat']: 'accepte', [dem + '/traiteLe']: t });
    await bonusEssai(uid, droits);
    // Le parrain est prévenu (ex-déclencheur pushFilleulInscrit).
    await pousser1(parrain, { type: 'filleul', url: './?parrainage=1', tag: 'filleul-' + id,
      title: (nom ? nom + ' vient' : 'Ton filleul vient') + ' de s’inscrire avec ton code',
      body: 'Ses quatre premières séances t’offriront 1 mois de RepCore.' });
    return { ok: true };
  }
  // ⚠ L'ESSAI DU FILLEUL NE PASSE PAS PAR droits/. La version Cloud Functions
  //   y posait `bonusEssaiJours` seul : un nœud sans palier, lu « aucun », qui
  //   fermait l'accès au moment même où le filleul utilisait un code ami.
  //   Le serveur léger n'écrit dans droits/ que des accès complets (palier et
  //   échéance, voir majDroits) ; l'essai, c'est l'app qui le donne à
  //   l'inscription (essaiOuvrir, bonusJours). Rien à faire ici.
  async function bonusEssai() { return null; }
  // ══ LE FILLEUL QUALIFIÉ (01/10/2026) — voir P.filleulQualifie ══════════
  // L'adresse vérifiée : le Worker l'a vue LUI-MÊME dans un jeton Firebase
  // (appel emailVerifie, droits-appels.js) et l'a notée dans
  // parrainage/verifies/<clé>, que personne d'autre n'écrit. Les séances : le
  // dossier, relu ici.
  async function qualificationFilleul(k, t) {
    const [seances, verifie] = await Promise.all([_lire(k, 'sessions'), _val('parrainage/verifies/' + k)]);
    return P.filleulQualifie(seances, Number(verifie) > 0, t);
  }
  const optsParrainage = (qualifie) => ({ qualifie, auPaiement: P.PARRAINAGE_AU_PAIEMENT, plafond: P.PARRAIN_MOIS_MAX_AN });
  // AU-DELÀ DU PLAFOND : rien n'est crédité, c'est journalisé, et le créateur
  // est prévenu (son prénom de parrain seulement, jamais d'adresse).
  async function plafondParrain(parrain, idFilleul, t, source) {
    await db.ref('parrainage_plafond/' + parrain).push().set({ filleul: idFilleul, le: t, source: String(source || ''),
      max: P.PARRAIN_MOIS_MAX_AN });
    const prenom = String((await _lire(parrain, 'fname')) || 'Un parrain').slice(0, 24);
    await pousser1(CLE_CREATEUR_PUSH, { type: 'admin', url: './?paiements=1', tag: 'parrainage-plafond-' + idFilleul,
      title: 'Parrainage : plafond atteint',
      body: prenom + ' a déjà reçu ' + P.PARRAIN_MOIS_MAX_AN + ' mois offerts sur 12 mois. Ce filleul ne lui en donne pas.' },
      { urgent: true }).catch(() => null);
  }
  // LE PREMIER PAIEMENT D'UN FILLEUL : 1 mois au parrain, s'il ne l'a pas
  // déjà eu par les quatre séances du filleul (P.premierPaiement). Idempotent.
  async function parrainagePaiement(cle, source) {
    const lien = await _val('parrainage/liens/' + cle);
    if (!lien || !lien.parrain || !lien.id) return null;
    const t = now();
    const [prenom, qualifie] = await Promise.all([_lire(cle, 'fname'), qualificationFilleul(cle, t)]);
    let res = null;
    const tx = await db.ref('parrainage/comptes/' + lien.parrain).transaction((compte) => {
      const c = compte || {};
      const p = P.premierPaiement(c, lien.id, t, optsParrainage(qualifie));
      if (!p) return undefined;
      res = p;
      const f = Object.assign({}, (c.filleuls || {})[lien.id], p.filleul);
      if (prenom && !f.prenom) f.prenom = String(prenom).slice(0, 24);
      const out = Object.assign({}, c, { moisGagnes: p.moisGagnes, payants: p.payants, actifs: p.actifs,
        filleuls: Object.assign({}, c.filleuls, { [lien.id]: f }) });
      if (p.mentor) out.mentorLe = t;
      return out;
    });
    if (!tx.committed || !res) return null;
    if (prenom) res.prenom = String(prenom).trim().slice(0, 24) || res.prenom;
    if (res.plafond) await plafondParrain(lien.parrain, lien.id, t, 'paiement');
    // Pas de mois : déjà venu, filleul pas encore qualifié (il viendra avec la
    // qualification), ou plafond. Un merci, rien de plus.
    if (!res.credit) {
      await db.ref('parrainage/evenements/' + lien.parrain).push().set({ type: 'abonne', at: t, prenom: res.prenom, mois: 0, source: String(source || '') });
      const txt = P.textePaiement(res);
      await pousser1(lien.parrain, { type: 'filleul', url: './?parrainage=1', tag: 'filleul-paie-' + lien.id, title: txt.title, body: txt.body });
      return res;
    }
    // LE MOIS OFFERT, CRÉDITÉ DANS LE DOSSIER (jamais dans droits/, voir
    // bonusEssai), et SANS JAMAIS RIEN RETIRER :
    //   · abonné qui a résilié (fin PayPal posée, pas encore atteinte) : sa fin recule d'un mois ;
    //   · accès daté sans fin PayPal (un mois déjà offert) : il s'allonge d'un mois ;
    //   · abonné en cours, athlète suivi, ou accès Ultime par un programme :
    //     le mois va en RÉSERVE — il s'ajoutera à la fin de son abonnement
    //     (paypal.js, fermerALaFin). Lui ouvrir Essentielle ferait descendre
    //     l'Ultime d'un programme, et un athlète suivi n'a rien à gagner ;
    //   · personne sans accès : un mois d'Essentielle s'ouvre tout de suite.
    const mode = await crediterMoisOffert(lien.parrain, t);
    // LA TRACE DU CRÉDIT, pour pouvoir le reprendre si ce paiement est
    // remboursé ou rétrofacturé (retirerMoisOffert) : à qui, et comment.
    await db.ref('parrainage/credits/' + cle).set({ parrain: lien.parrain, id: lien.id, mode, le: t });
    await db.ref('parrainage/evenements/' + lien.parrain).push().set({
      type: res.mentor ? 'mentor' : 'paiement', at: t, prenom: res.prenom, mois: 1, source: String(source || '') });
    const txt = P.textePaiement(res);
    await pousser1(lien.parrain, { type: 'filleul', url: './?parrainage=1', tag: 'filleul-paie-' + lien.id, title: txt.title, body: txt.body });
    return res;
  }

  // LES QUATRE PREMIÈRES SÉANCES D'UN FILLEUL : 1 mois au parrain, une fois
  // (la marque creditE, posée dans la même transaction). Un filleul payé
  // avant ses quatre séances a déjà donné son mois : rien de plus.
  // ⚠ Ce mois-là ne se reprend pas au remboursement d'un paiement : il ne
  //   vient pas d'un paiement (pas de trace dans parrainage/credits/).
  // ⚠ DEPUIS LE 01/10/2026 : seulement un filleul QUALIFIÉ, et — au paiement
  //   (P.PARRAINAGE_AU_PAIEMENT) — seulement s'il a déjà payé. Rend
  //   'non_qualifie' ou 'attente_paiement' quand il faudra repasser.
  async function parrainageSeuil(k, t) {
    const lien = await _val('parrainage/liens/' + k);
    if (!lien || !lien.parrain || !lien.id) return 'sans_parrain';
    const [prenom, qualifie] = await Promise.all([_lire(k, 'fname'), qualificationFilleul(k, t)]);
    if (!qualifie) return 'non_qualifie';
    let res = null, attente = false;
    const tx = await db.ref('parrainage/comptes/' + lien.parrain).transaction((compte) => {
      const c = compte || {};
      const p = P.seuilSeances(c, lien.id, t, optsParrainage(true));
      const f0 = (c.filleuls || {})[lien.id];
      attente = !p && !!f0 && !f0.creditE && !f0.plafondLe && P.PARRAINAGE_AU_PAIEMENT && f0.statut !== 'payant';
      if (!p) return undefined;
      res = p;
      const f = Object.assign({}, (c.filleuls || {})[lien.id], p.filleul);
      if (prenom && !f.prenom) f.prenom = String(prenom).slice(0, 24);
      const out = Object.assign({}, c, { moisGagnes: p.moisGagnes, actifs: p.actifs,
        filleuls: Object.assign({}, c.filleuls, { [lien.id]: f }) });
      if (p.mentor) out.mentorLe = t;
      return out;
    });
    if (!tx.committed || !res) return attente ? 'attente_paiement' : 'deja';
    if (res.plafond) { await plafondParrain(lien.parrain, lien.id, t, 'seances'); return 'plafond'; }
    if (!res.credit) return 'deja_paye';
    if (prenom) res.prenom = String(prenom).trim().slice(0, 24) || res.prenom;
    const mode = await crediterMoisOffert(lien.parrain, t);
    // AU PAIEMENT, ce mois-là vient d'un filleul PAYANT : il se reprend si
    // ce paiement est remboursé, comme celui de parrainagePaiement.
    await db.ref((P.PARRAINAGE_AU_PAIEMENT ? 'parrainage/credits/' : 'parrainage/credits_seances/') + k)
      .set({ parrain: lien.parrain, id: lien.id, mode, le: t });
    await db.ref('parrainage/evenements/' + lien.parrain).push().set({
      type: res.mentor ? 'mentor' : 'seances', at: t, prenom: res.prenom, mois: 1 });
    const txt = P.texteSeuil(res, mode);
    await pousser1(lien.parrain, { type: 'filleul', url: './?parrainage=1', tag: 'filleul-seuil-' + lien.id, title: txt.title, body: txt.body });
    return 'credite';
  }

  async function crediterMoisOffert(parrain, t) {
    const [statut, paiementSt, ech, role, prog, finPaypal, d] = await Promise.all(['status', 'paymentStatus', 'accessExpiry', 'role',
      'programmesAchetes', 'abonnement/finAccesPaypal'].map((c) => _lire(parrain, c)).concat([lireDroits(parrain)]));
    if (role === 'coach') return 'coach';
    // UNE DETTE PASSE AVANT : un mois offert pour un filleul remboursé, déjà
    // consommé au moment du remboursement, se paie sur le mois suivant.
    const dette = await db.ref('parrainage/comptes/' + parrain + '/dette').transaction((n) => (Number(n) > 0 ? (Number(n) - 1 || null) : undefined));
    if (dette.committed) return 'dette_soldee';
    const e = Number(ech) || 0;
    const ultimeProgramme = !!(prog && typeof prog === 'object' && Object.values(prog).some((x) => x && Number(x.ouvertJusqu) > t));
    const b = 'users/' + parrain + '/';
    const fp = Number(finPaypal) || 0;
    const reserve = async () => {
      await db.ref('parrainage/comptes/' + parrain + '/moisEnReserve').transaction((n) => (Number(n) || 0) + 1);
      return 'reserve';
    };
    // ── droits/ D'ABORD, quand il porte un accès ouvert ──────────────────
    //   · daté (une résiliation, un mois déjà offert) : la date recule d'un mois ;
    //   · sans fin (abonnement en cours, accès posé à la main) : en réserve.
    // Le mois compté sur une fin PayPal est noté dans paypal_fins : si
    // l'abonnement repart avant la fin, il retourne en réserve (paypal.js).
    const pd = palierDroits(d, t);
    const de = Number(d && d.echeance) || 0;
    const manuel = !!(d && SOURCES_MAIN.indexOf(String(d.source)) >= 0);
    // ── ENCORE À L'ESSAI (rien de payé, pas d'athlète suivi) : la fin
    //    d'essai recule d'un mois, dans droits/ (ce que l'app lit d'abord,
    //    essaiFin) et dans le dossier (les versions d'avant). Tout reste ouvert.
    const essai = await _lire(parrain, 'essai');
    const finEssai = Math.max(Number(essai && essai.finit) || 0, Number(d && d.essaiFinit) || 0);
    const payeOuSuivi = statut === 'COACHING_SUIVI' || (statut === 'AUTONOMIE_PREMIUM' && paiementSt === 'active')
      || (pd && pd !== 'aucun' && String(d.source) !== 'essai');
    if (finEssai > t && !payeOuSuivi && !manuel) {
      const fin = finEssai + MONTH_MS;
      await majDroits(parrain, (x) => ({ palier: 'ultime', echeance: fin, source: 'essai', essaiFinit: fin,
        essaiOuvertLe: Number(x && x.essaiOuvertLe) || Number(essai && essai.ouvertLe) || null }));
      if (essai && typeof essai === 'object') await db.ref().update({ [b + 'essai/finit']: fin, [b + 'updatedAt']: t });
      return 'essai_recule';
    }
    if (pd && pd !== 'aucun') {
      if (de > t && !manuel) {
        const fin = Math.max(de, e, fp) + MONTH_MS;
        await majDroits(parrain, () => ({ echeance: fin }));
        const maj = { [b + 'updatedAt']: t };
        if (e > 0) maj[b + 'accessExpiry'] = fin;
        if (fp > 0) maj[b + 'abonnement/finAccesPaypal'] = fin;
        await db.ref().update(maj);
        const paypal = fp > 0 || String(d.source) === 'paypal';
        if (paypal) await db.ref('paypal_fins/' + parrain).transaction((f) => (f ? Object.assign({}, f, { fin, moisRecules: (Number(f.moisRecules) || 0) + 1 }) : undefined));
        return paypal ? 'fin_reculee' : 'acces_prolonge';
      }
      return reserve();
    }
    if (!d) {
      // ── SANS NŒUD droits/ : l'ancien modèle, le temps de la transition ──
      // ⚠ « FIN RECULÉE » SEULEMENT SI PAYPAL A VRAIMENT POSÉ UNE FIN. Un
      //   accessExpiry seul (un mois déjà offert, un essai) n'est pas une
      //   résiliation : y écrire finAccesPaypal inventait une fin PayPal.
      if (statut === 'AUTONOMIE_PREMIUM' && paiementSt === 'active' && e > t && fp > 0) {
        const fin = Math.max(e, fp) + MONTH_MS;
        await db.ref().update({ [b + 'accessExpiry']: fin, [b + 'abonnement/finAccesPaypal']: fin, [b + 'updatedAt']: t });
        await db.ref('paypal_fins/' + parrain).transaction((f) => (f ? Object.assign({}, f, { fin, moisRecules: (Number(f.moisRecules) || 0) + 1 }) : undefined));
        return 'fin_reculee';
      }
      // Un accès daté qui ne vient pas de PayPal (mois déjà offert) : il s'allonge.
      if (statut === 'AUTONOMIE_PREMIUM' && paiementSt === 'active' && e > t) {
        await db.ref().update({ [b + 'accessExpiry']: e + MONTH_MS, [b + 'updatedAt']: t });
        return 'acces_prolonge';
      }
      if ((statut === 'AUTONOMIE_PREMIUM' && paiementSt === 'active') || statut === 'COACHING_SUIVI' || ultimeProgramme) return reserve();
    } else if (manuel || statut === 'COACHING_SUIVI' || ultimeProgramme) return reserve();
    // UN MOIS D'ESSENTIELLE S'OUVRE, dans droits/ (ce que l'app lit d'abord)
    // et dans le dossier (l'ancien modèle, pour les versions d'avant).
    const fin = Math.max(de, e, t) + MONTH_MS;
    await majDroits(parrain, (x) => ({ palier: 'essentielle', echeance: fin, source: 'parrainage', abo: (x && x.abo) || null }));
    await db.ref().update({ [b + 'status']: 'AUTONOMIE_PREMIUM', [b + 'paymentStatus']: 'active',
      [b + 'accessExpiry']: fin, [b + 'abonnement/formule']: 'essentielle',
      [b + 'abonnement/source']: 'parrainage', [b + 'updatedAt']: t });
    return 'mois_ouvert';
  }

  // ══ QUAND UN PREMIER PAIEMENT EST REMBOURSÉ OU RÉTROFACTURÉ ══════════════
  //
  // LE MOIS OFFERT AU PARRAIN EST REPRIS, s'il ne l'a pas encore consommé :
  //   · en réserve : il en sort ;
  //   · ajouté au bout d'un accès : retiré, si le mois entier est encore à
  //     venir (l'accès finit plus d'un mois après aujourd'hui) ;
  //   · sinon (commencé, ou déjà écoulé) : une DETTE d'un mois, soldée sur le
  //     prochain mois qu'il gagnera (crediterMoisOffert).
  // Le filleul repasse de « payant » à « rembourse » dans son compte.
  // Rend {parrain, resultat} ou null s'il n'y avait rien à reprendre.
  async function retirerMoisOffert(cleFilleul, t) {
    const c = await _val('parrainage/credits/' + cleFilleul);
    if (!c || !c.parrain || c.retireLe) return null;
    const parrain = c.parrain, b = 'users/' + parrain + '/';
    const garde = await db.ref('parrainage/credits/' + cleFilleul + '/retireLe').transaction((v) => (v ? undefined : t));
    if (!garde.committed) return null;
    const reserve = async () => (await db.ref('parrainage/comptes/' + parrain + '/moisEnReserve')
      .transaction((n) => (Number(n) >= 1 ? Number(n) - 1 : undefined))).committed;
    let resultat = 'rien';
    if (c.mode === 'coach') resultat = 'rien';
    else if (c.mode === 'dette_soldee') {
      await db.ref('parrainage/comptes/' + parrain + '/dette').transaction((n) => (Number(n) || 0) + 1);
      resultat = 'dette';
    } else if (c.mode === 'reserve') {
      resultat = (await reserve()) ? 'reserve_retiree' : 'dette';
    } else {
      // fin_reculee, acces_prolonge, mois_ouvert : un mois au bout de l'accès.
      const [ech, fp, dr] = await Promise.all([_lire(parrain, 'accessExpiry'), _lire(parrain, 'abonnement/finAccesPaypal'), lireDroits(parrain)]);
      const e = Math.max(Number(ech) || 0, Number(dr && dr.echeance) || 0);
      if (e - MONTH_MS > t) {
        const maj = { [b + 'updatedAt']: t };
        if (Number(ech) > 0) maj[b + 'accessExpiry'] = Number(ech) - MONTH_MS;
        if (Number(fp) > 0) maj[b + 'abonnement/finAccesPaypal'] = Number(fp) - MONTH_MS;
        await db.ref().update(maj);
        if (Number(dr && dr.echeance) > 0) await majDroits(parrain, (x) => ({ echeance: Number(x.echeance) - MONTH_MS,
          essaiFinit: Number(x.essaiFinit) > 0 ? Number(x.essaiFinit) - MONTH_MS : null }));
        if (c.mode === 'essai_recule') {
          const es = await _lire(parrain, 'essai');
          if (es && Number(es.finit) > 0) await db.ref().update({ [b + 'essai/finit']: Number(es.finit) - MONTH_MS, [b + 'updatedAt']: t });
        }
        await db.ref('paypal_fins/' + parrain).transaction((f) => (f ? Object.assign({}, f, { fin: Number(f.fin) - MONTH_MS,
          moisRecules: Math.max(0, (Number(f.moisRecules) || 0) - 1) }) : undefined));
        resultat = 'mois_retire';
      } else if (c.mode === 'fin_reculee' && !(Number(fp) > 0) && await reserve()) {
        resultat = 'reserve_retiree';     // l'abonnement était reparti : le mois était retourné en réserve
      } else resultat = 'dette';
    }
    if (resultat === 'dette' && c.mode !== 'dette_soldee')
      await db.ref('parrainage/comptes/' + parrain + '/dette').transaction((n) => (Number(n) || 0) + 1);
    await db.ref('parrainage/comptes/' + parrain).transaction((compte) => {
      if (!compte || !compte.filleuls || !compte.filleuls[c.id]) return undefined;
      const filleuls = Object.assign({}, compte.filleuls, { [c.id]: Object.assign({}, compte.filleuls[c.id], { statut: 'rembourse', annuleLe: t }) });
      return Object.assign({}, compte, { filleuls, moisGagnes: Math.max(0, (Number(compte.moisGagnes) || 0) - 1),
        payants: Object.keys(filleuls).filter((k) => filleuls[k] && filleuls[k].statut === 'payant').length });
    });
    await db.ref('parrainage/credits/' + cleFilleul + '/resultat').set(resultat);
    return { parrain, resultat };
  }

  // L'ÉTAT « PAYANT » DE L'ATTRIBUTION : retiré du dossier, et décompté du
  // jour où il avait été compté (écran « Viralité »).
  // ⚠ LA VERITE « DEJA PAYE » VIT DANS attribution_payes/<cle> (hors users/,
  //   ferme aux clients) : c'est elle qu'on lit d'abord et qu'on efface.
  async function annulerAttribution(cle, t) {
    const [origine0, surServeur] = await Promise.all([_val('users/' + cle + '/origine'), _val('attribution_payes/' + cle)]);
    const origine = origine0 || {};
    const payeLe = Number(surServeur) > 0 ? Number(surServeur) : Number(origine.payeLe);
    if (!(payeLe > 0)) return null;
    const lien = await _val('ambassadeurs_liens/' + cle);
    const o = Object.assign({}, origine, lien && lien.code ? { amb: lien.code } : {});
    for (const c of ATT.cheminsEvenement('payant', o, payeLe))
      await db.ref(c).transaction((n) => (Number(n) > 1 ? Number(n) - 1 : null));
    // updatedAt AVEC : sans lui, l'app ne redescend pas le dossier (voir base.js).
    await db.ref().update({ ['users/' + cle + '/origine/payeLe']: null, ['users/' + cle + '/origine/annuleLe']: t,
      ['users/' + cle + '/updatedAt']: t, ['attribution_payes/' + cle]: null });
    return { payeLe };
  }

  // ══ LA COMMISSION D'UNE VENTE : suspendue, rétablie, annulée, réduite ════
  // Retrouvée par ambassadeurs_ventes/<vente> (posé au paiement). Rend
  // {code, commission, avant, apres, dejaPayee} ou null (pas de commission).
  async function commissionVente(vente, action, o) {
    const id = String(vente || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
    const v = id ? await _val('ambassadeurs_ventes/' + id) : null;
    if (!v || !v.code || !v.mois || !v.pid) return null;
    const t = now();
    let out = null;
    const tx = await db.ref('ambassadeurs/' + v.code + '/commissions/' + v.mois + '/' + v.pid).transaction((x) => {
      if (!x) return undefined;
      const y = Object.assign({}, x);
      const avant = Number(x.commission) || 0;
      if (action === 'suspendre') {
        if (x.statut === 'annulee' || x.statut === 'rembourse' || x.statut === 'suspendue') return undefined;
        y.statutAvant = x.statut || null; y.statut = 'suspendue'; y.suspendueLe = t;
      } else if (action === 'retablir') {
        if (x.statut !== 'suspendue') return undefined;
        y.statut = x.statutAvant || null; y.statutAvant = null; y.suspendueLe = null;
      } else if (action === 'annuler') {
        if (x.statut === 'annulee' || x.statut === 'rembourse') return undefined;
        if (x.statut === 'payee' || x.statutAvant === 'payee') y.etaitPayee = true;
        y.statut = 'annulee'; y.statutAvant = null; y.annuleeLe = t;
      } else if (action === 'prorata') {
        const ref = String(o.ref || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60) || 'r';
        if (x.rembourses && x.rembourses[ref] !== undefined) return undefined;
        const initial = Number(x.montantInitial) || Number(x.montant) || 0;
        const rembourses = Object.assign({}, x.rembourses, { [ref]: Math.round(Number(o.montant) * 100) / 100 });
        const total = Object.values(rembourses).reduce((a, b) => a + (Number(b) || 0), 0);
        const net = Math.max(0, Math.round((initial - total) * 100) / 100);
        y.montantInitial = initial;
        y.commissionInitiale = Number(x.commissionInitiale) || avant;
        y.rembourses = rembourses; y.montant = net;
        y.commission = Math.round(net * (Number(x.pct) || 0)) / 100;
        if (net <= 0) { y.statut = 'annulee'; y.annuleeLe = t; }
        if (x.statut === 'payee') y.etaitPayee = true;
      } else return undefined;
      out = { code: v.code, mois: v.mois, avant, apres: Number(y.commission) || 0, statut: y.statut || 'attente', dejaPayee: !!y.etaitPayee };
      return y;
    });
    if (!tx.committed) return null;
    if (action === 'prorata') await db.ref('ambassadeurs/' + v.code + '/stats/ca')
      .transaction((n) => Math.max(0, Math.round(((Number(n) || 0) - (Number(o.montant) || 0)) * 100) / 100));
    await ambMajVue(v.code);
    return out;
  }

  // ══ LES AMBASSADEURS ═══════════════════════════════════════════════════
  async function ambConfig(code) {
    const a = await _val('ambassadeurs/' + code);
    if (!a || !a.nom) return null;
    const o = {};
    for (const k of ['nom', 'actif', 'commissionPct', 'palierPct', 'palierSeuil', 'dureeMois', 'secret', 'avantage'])
      if (a[k] !== null && a[k] !== undefined) o[k] = a[k];
    return o;
  }
  async function ambMajVue(code) {
    const a = await _val('ambassadeurs/' + code);
    if (!a || !/^[a-z0-9]{24}$/.test(String(a.secret || ''))) return null;
    const t = now();
    const cfg = A.config(a);
    // LA SEMAINE : les 7 derniers jours de Paris, lus dans l'attribution
    // (attribution/jours/<jour>/amb/<code> : clic, inscription, payant).
    const jours = Array.from({ length: 7 }, (_, i) => ATT.jourParis(t - i * 864e5));
    const lus = await Promise.all(jours.map((j) => _val('attribution/jours/' + j + '/amb/' + code).catch(() => null)));
    const v = Object.assign(A.resume(code, a, t), { commissionPct: cfg.commissionPct, palierPct: cfg.palierPct,
      palierSeuil: cfg.palierSeuil, dureeMois: cfg.dureeMois, actif: cfg.actif, maj: t,
      avantage: AVANTAGES_AMB.indexOf(a.avantage) >= 0 ? a.avantage : 'essai+1mois', semaine: semaineAmbassadeur(lus) });
    await db.ref('ambassadeurs_vue/' + a.secret).set(v);
    return v;
  }
  const incr = (c) => db.ref(c).transaction((n) => (Number(n) || 0) + 1);
  async function ambassadeurDemande(uid, d) {
    const t = now();
    const code = String(d.code || '').toUpperCase();
    const dem = 'ambassadeurs_demandes/' + uid;
    const cfg = A.CODE_AMB_RE.test(code) ? await ambConfig(code) : null;
    const [lien, parrain, droits, creeLe] = await Promise.all([
      _val('ambassadeurs_liens/' + uid), _val('parrainage/liens/' + uid), lireDroits(uid), _lire(uid, 'createdAt')]);
    let raison = null;
    if (!cfg || cfg.actif === false) raison = 'code_inconnu';
    else if (lien) raison = 'deja_rattache';
    else if (parrain) raison = 'deja_parraine';
    else if (await dejaPaye(uid, droits)) raison = 'deja_client';
    else if (Number(creeLe) > 0 && t - Number(creeLe) > P.DELAI_RATTACHEMENT_MS) raison = 'compte_ancien';
    if (raison) { await db.ref(dem).update({ etat: 'refuse', raison, traiteLe: t }); return { ok: false, raison }; }
    const id = P.idFilleul(uid);
    await db.ref().update({
      ['ambassadeurs_liens/' + uid]: { code, id, le: t },
      ['ambassadeurs/' + code + '/filleuls/' + id]: { inscritLe: t },
      [dem + '/etat']: 'accepte', [dem + '/traiteLe']: t });
    await incr('ambassadeurs/' + code + '/stats/inscrits');
    await incr('attribution/jours/' + ATT.jourParis(t) + '/amb/' + code + '/inscription');
    // L'OFFRE DE LANCEMENT : le code porte « ultime_demi » (1er mois d'Ultime
    // à moitié prix) AU LIEU du mois d'essai en plus. Écrite dans droits/,
    // que l'app lit d'abord et que le client ne peut pas écrire.
    if (cfg.avantage === 'ultime_demi') await majDroits(uid, () => ({ offreAmb: 'ultime_demi' }));
    else await bonusEssai(uid, droits);
    await ambMajVue(code);
    return { ok: true };
  }
  async function ambassadeurPaiement(cle, p) {
    const lien = await _val('ambassadeurs_liens/' + cle);
    if (!lien || !lien.code || !lien.id) return null;
    const montant = Number(p && p.montant);
    if (!(montant > 0)) return null;
    const code = lien.code;
    const pid = A.idPaiement(Object.assign({}, p, { montant }));
    const vente = p.venteId ? String(p.venteId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60) : '';
    const tx = await db.ref('ambassadeurs_paiements/' + pid).transaction((cur) => (cur ? undefined : { code, le: now() }));
    if (!tx.committed) return null;
    const cfg = (await ambConfig(code)) || {};
    const fRef = 'ambassadeurs/' + code + '/filleuls/' + lien.id;
    const filleul = (await _val(fRef)) || {};
    let payants = Number(await _val('ambassadeurs/' + code + '/stats/payants')) || 0;
    if (!filleul.premierPaiement) {
      const r = await db.ref('ambassadeurs/' + code + '/stats/payants').transaction((n) => (Number(n) || 0) + 1);
      payants = Number(r.snapshot.val()) || payants + 1;
    }
    const le = Number(p.le) || now();
    await db.ref('ambassadeurs/' + code + '/stats/ca').transaction((n) => Math.round(((Number(n) || 0) + montant) * 100) / 100);
    const c = A.commissionPour(cfg, filleul, payants, { montant, le });
    const maj = {};
    if (!filleul.premierPaiement) maj[fRef + '/premierPaiement'] = le;
    if (c) {
      maj['ambassadeurs/' + code + '/commissions/' + c.mois + '/' + pid] = { filleul: lien.id, montant: c.montant, pct: c.pct,
        commission: c.commission, payeLe: c.payeLe, dueLe: c.dueLe };
      maj['ambassadeurs_paiements/' + pid + '/mois'] = c.mois;
      if (vente) maj['ambassadeurs_ventes/' + vente] = { code, mois: c.mois, pid };
    }
    if (Object.keys(maj).length) await db.ref().update(maj);
    await ambMajVue(code);
    return c;
  }
  // L'ancien point d'entrée (un remboursement, sans autre suite) : la
  // commission de la vente est annulée. paypal.js passe désormais par
  // commissionVente et les reprises ci-dessus.
  async function ambassadeurRemboursement(ress) {
    let id = String(ress.sale_id || '');
    if (!id && Array.isArray(ress.links)) {
      const up = ress.links.find((l) => l && l.rel === 'up');
      if (up && up.href) id = String(up.href).split('/').pop();
    }
    return commissionVente(id, 'annuler');
  }
  // LE PREMIER PAIEMENT pour l'écran « Viralité » : une seule fois.
  //
  // ⚠ LA TRANSACTION PORTE SUR attribution_payes/<cle>, PAS SUR LE DOSSIER
  //   (30/09/2026). users/<cle>/origine/payeLe est ecrit par le client a chaque
  //   PUT du dossier : un appareil qui le remettait a null (copie ancienne,
  //   fusion) rouvrait la porte, et le paiement suivant etait compte une
  //   seconde fois. Le nœud serveur est ferme aux clients ; payeLe n'en est
  //   plus que la copie lisible par l'app, remise en place si elle a disparu.
  async function attributionPaiement(cle) {
    const t = now();
    const origine0 = (await _val('users/' + cle + '/origine')) || {};
    // UN DOSSIER DEJA COMPTE AVANT CE NŒUD : on le reporte, on ne recompte pas.
    if (Number(origine0.payeLe) > 0) {
      await db.ref('attribution_payes/' + cle).transaction((cur) => (cur ? undefined : Number(origine0.payeLe)));
      return null;
    }
    const tx = await db.ref('attribution_payes/' + cle).transaction((cur) => (cur ? undefined : t));
    if (!tx.committed) {
      // Deja compte : si le client a efface la copie, on la remet (et on date).
      const v = Number(await _val('attribution_payes/' + cle));
      if (v > 0) await db.ref().update({ ['users/' + cle + '/origine/payeLe']: v, ['users/' + cle + '/updatedAt']: t });
      return null;
    }
    await db.ref().update({ ['users/' + cle + '/origine/payeLe']: t, ['users/' + cle + '/updatedAt']: t });
    const origine = Object.assign({}, origine0, { payeLe: t });
    const lien = await _val('ambassadeurs_liens/' + cle);
    const o = Object.assign({}, origine, lien && lien.code ? { amb: lien.code } : {});
    for (const c of ATT.cheminsEvenement('payant', o, t)) await incr(c);
    return origine;
  }
  // Une vue coûte 2 requêtes : au-delà du budget, un ambassadeur par sous-tâche.
  async function ambassadeursQuotidien() {
    const codes = Object.keys((await _val('ambassadeurs_publics')) || {});
    for (let i = 0; i < codes.length; i++) {
      if (i > 0 && _reste() < 6) { await differer(codes.slice(i).map((code) => ({ quoi: 'amb_vue', code }))); return 'differe'; }
      try { await ambMajVue(codes[i]); } catch (e) { /* le suivant */ }
    }
    return codes.length;
  }

  // ══ L'ATTRIBUTION : l'arrivée par un lien ══════════════════════════════
  async function arrivee(q) {
    const t = now();
    for (const c of ATT.cheminsArrivee(q, t)) await incr(c);
    const amb = String(q.amb || '').toUpperCase();
    if (ATT.AMB_RE.test(amb)) {
      const cfg = await ambConfig(amb);
      if (cfg && cfg.actif !== false) await incr('ambassadeurs/' + amb + '/stats/clics');
    }
  }

  // ══ LES ÉVÉNEMENTS DÉPOSÉS PAR L'APP (/evenements) ═════════════════════
  // Chaque événement porte `par` (la clé de qui l'a déposé, contrôlée par
  // les règles). Le Worker VÉRIFIE ce qu'il annonce avant d'agir : il ne
  // croit pas un événement sur parole, il relit la base.
  async function evenement(e) {
    const t = now();
    const type = String(e && e.type || '');
    if (type === 'reponse_bilan' || type === 'reponse_rite') {
      const dest = String(e.dest || '');
      const i = String(e.i || '').replace(/[^A-Za-z0-9_-]/g, '');
      if (!dest || !i) return 'incomplet';
      if ((await _lire(dest, 'coachEmailKey')) !== e.par) return 'pas_son_coach';
      const base = 'users/' + dest + '/' + (type === 'reponse_bilan' ? 'bilans' : 'rites') + '/' + i;
      const rep = await _val(base + '/reponseCoach');
      // Une réponse VOCALE vaut une réponse (bilans seulement) : relue elle aussi.
      const audio = (!rep && type === 'reponse_bilan') ? await _val(base + '/reponseAudio') : null;
      if (!rep && !(audio && audio.url)) return 'sans_reponse';
      const dureeTxt = (s) => { const n = Math.max(0, Math.round(Number(s) || 0)); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); };
      await envoyerPush(dest, { type: 'coach', url: './', tag: 'coach-' + (type === 'reponse_bilan' ? 'bilan' : 'rite') + '-' + i,
        title: type === 'reponse_bilan' ? 'Ton coach a répondu à ton bilan' : 'Ton coach a répondu à ton bilan de cycle',
        body: rep ? String(rep).slice(0, 120) : 'Une réponse vocale (' + dureeTxt(audio.duree) + ') t’attend dans l’app.' });
      return 'envoye';
    }
    // BUILD 1878 : l'athlète a corrigé un bilan après la réponse : on
    // prévient SON coach, après avoir relu la correction en base.
    if (type === 'bilan_corrige') {
      const ath = String(e.par || '');
      const i = String(e.i || '').replace(/[^A-Za-z0-9_-]/g, '');
      if (!ath || !i) return 'incomplet';
      const coach = await _lire(ath, 'coachEmailKey');
      if (!coach) return 'sans_coach';
      const b = await _val('users/' + ath + '/bilans/' + i);
      if (!b || !b.modifApresReponse || !b.modifs) return 'sans_correction';
      const prenom = String((await _lire(ath, 'fname')) || 'Ton athlète').slice(0, 40);
      const cles = Array.isArray(b.modifs.cles) ? b.modifs.cles : Object.values(b.modifs.cles || {});
      await envoyerPush(coach, { type: 'coach', url: './', tag: 'bilan-corrige-' + ath + '-' + i,
        title: 'Bilan corrigé',
        body: prenom + (cles.includes('photos') ? ' a ajouté ses photos.' : ' a modifié ' + cles.length + ' réponse' + (cles.length > 1 ? 's' : '') + '.') });
      return 'envoye';
    }
    // BUILD 1868 : le coach demande de compléter un bilan. Relu en base : la
    // demande (aCompleter) doit y être, et venir du coach de l'athlète.
    if (type === 'bilan_a_completer') {
      const dest = String(e.dest || '');
      const i = String(e.i || '').replace(/[^A-Za-z0-9_-]/g, '');
      if (!dest || !i) return 'incomplet';
      if ((await _lire(dest, 'coachEmailKey')) !== e.par) return 'pas_son_coach';
      const dem = await _val('users/' + dest + '/bilans/' + i + '/aCompleter');
      if (!dem || typeof dem !== 'object') return 'sans_demande';
      const LIB = { face: 'de face', back: 'de dos', side: 'de profil' };
      const vues = (Array.isArray(dem.vues) ? dem.vues : Object.values(dem.vues || {})).map(v => LIB[v]).filter(Boolean);
      await envoyerPush(dest, { type: 'coach', url: './', tag: 'coach-completer-' + i,
        title: 'Ton coach te demande de compléter ton bilan',
        body: vues.length ? 'Photos ' + vues.join(', ') + ' à ajouter.' : 'Une mesure manque à ton bilan.' });
      return 'envoye';
    }
    // LA MESSAGERIE (lot M2) : un message privé coach ↔ athlète. Comme une
    // réponse de bilan, le Worker relit le message en base avant de pousser :
    // l'événement ne suffit pas, ni pour le texte ni pour l'auteur.
    if (type === 'message') {
      const coach = String(e.coach || ''), dest = String(e.dest || ''), i = String(e.i || '').replace(/[^A-Za-z0-9_-]/g, '');
      if (!coach || !dest || !i) return 'incomplet';
      const deCoach = e.par === coach;
      if (!deCoach && dest !== coach) return 'incoherent';
      const athlete = deCoach ? dest : String(e.par || '');
      if ((await _lire(athlete, 'coachEmailKey')) !== coach) return 'pas_son_coach';
      const m = await _val('messages/' + coach + '/' + athlete + '/' + i);
      if (!m || m.de !== (deCoach ? 'coach' : 'athlete')) return 'sans_message';
      if (m.lu === true) return 'deja_lu';
      const extrait = String(m.texte || '').replace(/\s+/g, ' ').slice(0, 120);
      if (deCoach) {
        await envoyerPush(athlete, { type: 'coach', url: './?messages=1', tag: 'message-' + coach,
          title: 'Ton coach t’a écrit', body: extrait });
      } else {
        const prenom = String((await _lire(athlete, 'fname')) || 'Ton athlète').slice(0, 40);
        await envoyerPush(coach, { type: 'message', url: './?messages=1', tag: 'message-' + athlete,
          title: prenom + ' t’a écrit', body: extrait });
      }
      return 'envoye';
    }
    if (type === 'defi_publie') {
      const coach = String(e.par || ''), msg = String(e.msg || '').replace(/[^A-Za-z0-9_-]/g, '');
      const m = msg ? await _val('canaux/' + coach + '/messages/' + msg) : null;
      if (!m || m.type !== 'defi') return 'pas_un_defi';
      const obj = D.texteObjectif(m);
      const fin = Number(m.fin) ? new Date(Number(m.fin)).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' }) : '';
      const annuaire = await db.ref('annuaire_coach/' + coach).shallow();
      const message = { type: 'defi', url: './?canal=1', tag: 'defi-' + msg,
        title: 'Nouveau défi : ' + String(m.titre || 'ton coach te lance un défi').slice(0, 60),
        body: (m.collectif ? 'En équipe : ' : 'Objectif : ') + obj + (fin ? ' d’ici le ' + fin : '') + '. Tu le relèves ?' };
      const r = await pousserA(annuaire.map((uid) => ({ uid, message })));
      return r.differes ? 'differe' : 'envoye';
    }
    // defi_maj DÉPOSÉ PAR UN ATHLÈTE (son inscription) : sa valeur se calcule
    // d'abord (les séances déjà faites depuis le début comptent), en sous-
    // tâche — elle reposera elle-même un defi_maj ; le classement suit.
    if (type === 'defi_maj') {
      const par = String(e.par || ''), coach = String(e.coach || ''), id = String(e.id || '').replace(/[^A-Za-z0-9_-]/g, '');
      if (par && par !== 'worker' && coach && id) await differer([{ quoi: 'progres', cle: par, cibles: [{ g: 'defi', id, coach }] }]);
      return defiMaj(coach, id, t);
    }
    // LA PREMIÈRE SÉANCE D'UN FILLEUL : son parrain est prévenu, une fois.
    // L'événement ne dit rien que le Worker croie : le lien de parrainage et
    // la séance sont relus. La séance pas encore synchronisée (le dossier
    // part juste après l'événement) : on LÈVE, et la file réessaie à la
    // minute suivante (planif.js, cinq essais).
    if (type === 'filleul_seance') {
      const par = String(e.par || '');
      const lien = await _val('parrainage/liens/' + par);
      if (!lien || !lien.parrain || !lien.id) return 'sans_parrain';
      const [der, prenom] = await Promise.all([_lire(par, 'lastSession'), _lire(par, 'fname')]);
      if (!(Number(der) > 0)) throw new Error('première séance pas encore synchronisée');
      const fait = await db.ref('parrainage/comptes/' + lien.parrain + '/filleuls/' + lien.id + '/premiereSeance')
        .transaction((v) => (v ? undefined : t));
      if (!fait.committed) return 'deja_prevenu';
      const nom = String(prenom || '').trim().slice(0, 24);
      await envoyerPush(lien.parrain, { type: 'filleul', url: './?parrainage=1', tag: 'filleul-seance-' + lien.id,
        title: (nom || 'Ton filleul') + ' a fait sa première séance',
        body: 'Ton invitation a pris. Ses quatre premières séances t’offriront 1 mois de RepCore.' });
      return 'prevenu';
    }
    if (type === 'duel_rejoint' || type === 'duel_maj' || type === 'duel_cree') return duelEvenement(e, t);
    if (type === 'reaction') return reactionEvenement(e, t);
    // UNE SÉANCE TERMINÉE : les volts recalculés par le serveur.
    // Les volts, puis le profil de relance (worker/profils) : la séance est
    // ce qui change la série, la semaine et la dernière séance.
    if (type === 'seance_fin') {
      const k = String(e.par || '');
      const r = await xpRecalculer(k, t, true);
      if (r !== 'cle') await rafraichirProfil(k, t);
      return r;
    }
    return 'type_inconnu';
  }

  // ══ LES DUELS (voir duels.js) ═════════════════════════════════════════
  // Une lecture du duel, une écriture multi-chemins, et les push : quatre
  // sous-requêtes au plus par événement (plus celles des push, comptées par
  // pousserA). L'index /duels_actifs porte les duels à suivre chaque jour
  // (J-2, clôture) : le travail du jour ne balaie jamais /duels.
  async function duelEvenement(e, t) {
    const id = String(e.cible || e.id || '');
    if (!DU.DUEL_ID_RE.test(id)) return 'duel_invalide';
    const d = await _val('duels/' + id);
    if (!d) return 'duel_inconnu';
    d.id = id;
    const par = String(e.par || '');
    // LA REVANCHE (lot B) : le créateur a nommé un ami par son pseudo (les
    // règles ont vérifié que cet ami le suit). Le Worker y met la clé de
    // l'invité, le range dans ses duels reçus, et le prévient. Rien à
    // accepter : sa première séance lance le compte.
    if (e.type === 'duel_cree') {
      const v = DU.revancheValide(d, par);
      if (v !== 'ok') return v;
      const invite = await _val('pseudos/' + d.invitePseudo);
      const suit = invite ? await _val('amis/' + invite + '/' + d.createurPseudo) : null;
      if (!invite || !suit || invite === d.createur) {
        await db.ref().update({ ['duels/' + id + '/statut']: 'annule', ['duels/' + id + '/maj']: t });
        return 'revanche_refusee';
      }
      const [pp, fn] = await Promise.all([_val('profils_publics/' + d.invitePseudo + '/prenom'), _lire(invite, 'fname')]);
      const nom = String(pp || fn || '').trim().slice(0, 24) || null;
      await db.ref().update({ ['duels/' + id + '/invite']: invite, ['duels/' + id + '/inviteNom']: nom,
        ['duels/' + id + '/rejointLe']: t, ['duels/' + id + '/maj']: t,
        ['duels_actifs/' + id]: { fin: 0, depuis: t },
        ['duels_joueur/' + d.createur + '/' + id]: true, ['duels_joueur/' + invite + '/' + id]: true,
        ['duels_recus/' + invite + '/' + id]: { le: t, de: String(d.createurNom || '').slice(0, 24) || null } });
      Object.assign(d, { invite, inviteNom: nom });
      await pousserA([{ uid: invite, message: DU.pushRevanche(d) }], { attendre: false });
      return 'revanche';
    }
    if (par !== d.createur && par !== d.invite) return 'pas_participant';
    if (e.type === 'duel_rejoint') {
      if (d.statut !== 'attente' || par !== d.invite) return 'deja_' + d.statut;
      // duels_joueur/<k>/<id> : l'index que relit xpRecalculer pour écrire
      // la progression de chacun après ses séances.
      await db.ref().update({ ['duels/' + id + '/statut']: 'accepte', ['duels/' + id + '/rejointLe']: t, ['duels/' + id + '/maj']: t,
        ['duels_actifs/' + id]: { fin: 0, depuis: t },
        ['duels_joueur/' + d.createur + '/' + id]: true, ['duels_joueur/' + d.invite + '/' + id]: true });
      await pousserA([{ uid: d.createur, message: DU.pushRejoint(d) }], { attendre: false });
      return 'accepte';
    }
    // duel_maj : une séance terminée (ou une progression réécrite).
    if (d.statut === 'accepte') {
      if (par !== d.invite) return 'pas_commence';
      const { debut, fin } = DU.demarrage(d, t, e.at);
      // La progression d'avant le début ne compte pas : elle est effacée.
      await db.ref().update({ ['duels/' + id + '/statut']: 'en_cours', ['duels/' + id + '/debut']: debut,
        ['duels/' + id + '/fin']: fin, ['duels/' + id + '/scores']: { createur: 0, invite: 0 },
        ['duels/' + id + '/progres']: null, ['duels/' + id + '/maj']: t, ['duels_actifs/' + id]: { fin },
        ['duels_joueur/' + d.createur + '/' + id]: true, ['duels_joueur/' + d.invite + '/' + id]: true });
      Object.assign(d, { statut: 'en_cours', debut, fin, scores: { createur: 0, invite: 0 } });
      // LA SÉANCE QUI LANCE LE DUEL COMPTE : sa progression (et celle du
      // créateur) se calcule depuis xp_etat dès le démarrage, que la séance
      // ait été recalculée avant ou après cet événement. Le duel compte à
      // partir de `debut` (un jour : les bornes de valeurServeur sont des jours).
      await differer([d.createur, d.invite].map((cle) => ({ quoi: 'progres', cle, cibles: [{ g: 'duel', id, coach: null }] })));
      await pousserA([d.createur, d.invite].map((uid) => ({ uid, message: DU.pushDebut(d, uid) })), { attendre: false });
      return 'demarre';
    }
    if (d.statut !== 'en_cours') return 'clos';
    if (t > Number(d.fin)) return duelCloturer(d, t);
    // Les scores relus de la progression (écrite par le Worker), et l'index du
    // joueur posé s'il manque (un duel commencé avant l'index).
    const scores = DU.scoresDe(d);
    await db.ref().update({ ['duels/' + id + '/scores']: scores, ['duels/' + id + '/maj']: t, ['duels_joueur/' + par + '/' + id]: true });
    // Une valeur que le Worker n'a jamais écrite (un duel d'avant l'index,
    // donc pas relu par la séance) : elle l'est maintenant, en sous-tâche.
    const p = d.progres && d.progres[par];
    if (!(p && p.srv === true)) await differer([{ quoi: 'progres', cle: par, cibles: [{ g: 'duel', id, coach: null }] }]);
    return 'scores';
  }
  async function duelCloturer(d, t) {
    const scores = DU.scoresDe(d);
    const gagnant = DU.gagnantDe(scores);
    Object.assign(d, { scores });
    const maj = { ['duels/' + d.id + '/statut']: 'termine', ['duels/' + d.id + '/scores']: scores,
      ['duels/' + d.id + '/gagnant']: gagnant, ['duels/' + d.id + '/termineLe']: t, ['duels/' + d.id + '/maj']: t,
      ['duels_actifs/' + d.id]: null };
    for (const cle of [d.createur, d.invite]) if (cle) maj['duels_joueur/' + cle + '/' + d.id] = null;
    // Les deux reçoivent leur résultat ; le gagnant, le badge CHAMPION (l'app le lit ici).
    for (const cle of [d.createur, d.invite]) if (cle) maj['defis_resultats/' + cle + '/' + d.id] = DU.resultatPour(d, cle, gagnant, t);
    await db.ref().update(maj);
    await pousserA([d.createur, d.invite].filter(Boolean).map((uid) => ({ uid, message: DU.pushResultat(d, uid, gagnant) })), { attendre: false });
    return 'termine';
  }
  // Le travail du jour, un duel à la fois (planif.js) : J-2, clôture, oubli.
  async function duelQuotidienUn(id, t) {
    const d = await _val('duels/' + id);
    if (d) d.id = id;
    const suite = DU.suiteDuel(d, t);
    if (suite === 'oublier') { await db.ref('duels_actifs/' + id).remove(); return 'oublie'; }
    if (suite === 'cloturer') return duelCloturer(d, t);
    if (suite === 'annuler') {
      const oubli = {};
      for (const cle of [d.createur, d.invite]) if (cle) oubli['duels_joueur/' + cle + '/' + id] = null;
      await db.ref().update(Object.assign({ ['duels/' + id + '/statut']: 'annule', ['duels/' + id + '/maj']: t, ['duels_actifs/' + id]: null }, oubli));
      return 'annule';
    }
    // LE J-2 : duels/<id>/rappel n'est posé qu'une fois CHACUN servi — envoi
    // réussi, ou refus définitif (préférence, aucun appareil). Refusé pour le
    // plafond ou les heures calmes, il est retenté demain, tant qu'il reste
    // plus de 12 h ; rappelPour/<uid> retient qui l'a déjà eu.
    if (suite === 'rappel') {
      const deja = d.rappelPour || {};
      const maj = {};
      let reste = false;
      for (const uid of [d.createur, d.invite].filter(Boolean)) {
        if (deja[uid]) continue;
        // Plus de budget dans ce réveil : la sous-tâche part à la minute suivante.
        if (file || !peutPousser()) { await differer([tachePush(uid, DU.pushRappel(d, uid), { attendre: false })]); maj['duels/' + id + '/rappelPour/' + uid] = true; continue; }
        const r = await envoyerPush(uid, DU.pushRappel(d, uid), { attendre: false });
        if (pushTermine(r)) maj['duels/' + id + '/rappelPour/' + uid] = true;
        else reste = true;
      }
      if (!reste || Number(d.fin) - t <= RAPPEL_REESSAI_MS) maj['duels/' + id + '/rappel'] = true;
      if (Object.keys(maj).length) await db.ref().update(maj);
      return reste ? 'rappel_a_reprendre' : 'rappel';
    }
    return 'rien';
  }
  const duelsActifs = () => db.ref('duels_actifs').shallow();
  // Un J-2 refusé (plafond, heures calmes) se retente demain s'il reste plus
  // que cela avant la fin du duel.
  const RAPPEL_REESSAI_MS = 12 * 3600e3;

  // ══ LES RÉACTIONS ENTRE AMIS (lot D) ═════════════════════════════════════
  // /reactions/<pseudo>/<jour>/<pseudo de l'envoyeur> = un des cinq emojis,
  // écrit par l'envoyeur (les règles : il suit le destinataire). L'événement
  // ne pousse RIEN : il note seulement qu'il y a quelque chose à dire
  // (/reactions_push/<compte>), et le travail de 19 h le dit, UNE poussée
  // groupée par jour au plus. Jamais une poussée par réaction.
  const REACTIONS = ['💪', '🔥', '👏', '😮', '⚡'];
  async function reactionEvenement(e, t) {
    const pk = String(e.cible || ''), jour = String(e.jour || '');
    if (!/^[a-z0-9_]{3,40}$/.test(pk) || !/^\d{4}-\d{2}-\d{2}$/.test(jour)) return 'invalide';
    const [uid, pp] = await Promise.all([_val('pseudos/' + pk), _lire(String(e.par || ''), 'pagePublique')]);
    const moi = pp && typeof pp.pseudo === 'string' ? pp.pseudo.replace(/\./g, '__') : '';
    if (!uid || !moi || uid === e.par) return 'sans_destinataire';
    const r = await _val('reactions/' + pk + '/' + jour + '/' + moi);
    if (REACTIONS.indexOf(r) < 0) return 'sans_reaction';
    await db.ref('reactions_push/' + uid).set({ pk, jour, le: t });
    return 'note';
  }
  const reactionsAttente = () => db.ref('reactions_push').shallow();
  // reactions_push/<uid> N'EST EFFACÉ QU'APRÈS : un envoi réussi, ou un refus
  // définitif (préférence coupée, aucun appareil). Refusé pour le plafond ou
  // les heures calmes, il reste, et le travail du lendemain réessaie.
  async function reactionsPushUn(uid, t) {
    const a = await _val('reactions_push/' + uid);
    const oublier = () => db.ref('reactions_push/' + uid).remove();
    if (!a || !a.pk || !a.jour) { await oublier(); return 'rien'; }
    const r = (await _val('reactions/' + a.pk + '/' + a.jour)) || {};
    const qui = Object.keys(r).filter((k) => REACTIONS.indexOf(r[k]) >= 0);
    if (!qui.length) { await oublier(); return 'rien'; }
    const p1 = (await _val('profils_publics/' + qui[0] + '/prenom')) || 'Un ami';
    const nom = String(p1).trim().slice(0, 24) || 'Un ami';
    const n = qui.length - 1;
    const title = n ? nom + ' et ' + n + ' autre' + (n > 1 ? 's' : '') + ' ont réagi à ta séance' : nom + ' a réagi à ta séance';
    const res = await envoyerPush(uid, { type: 'defi', prio: 'reactions', url: './?duels=1', tag: 'reactions-' + a.jour, title, body: qui.map((k) => r[k]).join(' ') });
    if (pushTermine(res)) await oublier();
    return res && res.envoye ? 'envoye' : ((res && res.raison) || 'echec');
  }

  // ══ LES ÉVÉNEMENTS SAISONNIERS (voir saisons.js) — CHAQUE HEURE ═══════
  // Par saison suivie : la progression écrite par les apps (1 lecture), l'état
  // des annonces (1), une écriture multi-chemins (compteur collectif, badges
  // des nouveaux finis, annonce faite), et, s'il y a une annonce, la liste
  // des abonnés (1) et les push (pousserA diffère ce qui dépasse le budget).
  // Rend false quand le budget coupe : le travail reprend au réveil suivant.
  async function saisonsHeure(t) {
    // Une saison AUTOMATIQUE s'efface devant une saison posée à la main sur la
    // même période (calendrier-saisons.js) : ni push, ni badge pour elle.
    const toutes = CS.saisonsEffectives((await _val('saisons')) || {});
    const ids = Object.keys(toutes).filter((id) => SA.SAISON_ID_RE.test(id) && SA.saisonSuivie(toutes[id], t)).sort();
    for (const id of ids) {
      if (_reste() < 10) return false;
      const s = toutes[id];
      const [progres, etat] = await Promise.all([_val('saisons_progres/' + id), _val('saisons_etat/' + id)]);
      const vals = SA.valeurs(progres);
      const e = etat || {};
      const maj = { ['stats/saisons/' + id]: SA.statsSaison(s, vals, t) };
      for (const k of SA.nouveauxFinis(s, vals, e.finis)) {
        maj['saisons_resultats/' + k + '/' + id] = SA.resultatSaison(id, s, t);
        maj['saisons_etat/' + id + '/finis/' + k] = t;
      }
      // LES ANNONCES ATTENDENT LE JOUR (9 h – 21 h, Paris) : lancée à minuit,
      // une saison est annoncée au réveil, pas pendant la nuit.
      const h = paris(t).heure;
      const quoi = (h >= 9 && h < 21) ? SA.annonceSaison(s, e, t) : null;
      if (quoi) maj['saisons_etat/' + id + '/' + quoi] = t;
      await db.ref().update(maj);
      if (quoi) {
        const abonnes = await db.ref('push').shallow();
        // Mi-parcours et J-2 : les inscrits (« Je participe ») et ceux qui ont avancé.
        const inscrits = (quoi === 'mi' || quoi === 'j2') ? ((await _val('saisons_inscrits/' + id)) || {}) : undefined;
        const dest = SA.destinataires(quoi, s, abonnes, vals, inscrits);
        await pousserA(dest.map((uid) => ({ uid, message: SA.messageSaison(quoi, id, s, uid, vals) })), { attendre: false });
      }
    }
    return true;
  }

  // ══ LA SAISON DU MOIS SUIVANT, LE 25 À 12 H (calendrier-saisons.js) ═════
  // Si rien ne commence le mois prochain, la saison du modèle est posée,
  // `auto: true`. L'objectif collectif suit les participants de la saison du
  // mois en cours (stats/saisons/<id>.participants), 1 au moins.
  async function saisonsAuto(t) {
    const toutes = (await _val('saisons')) || {};
    const p = paris(t);
    const b = CS.bornesMois(p.mois, p.annee);
    const enCours = CS.saisonsDuMois(toutes, b.debut, b.fin);
    let participants = 0;
    for (const id of enCours) participants += Number(await _val('stats/saisons/' + id + '/participants')) || 0;
    const a = CS.saisonAuto(toutes, t, participants);
    if (!a) return 'deja';
    await db.ref('saisons/' + a.id).set(a.saison);
    return a.id;
  }

  // ══ LA RÉTENTION (retention.js) — chaque nuit, par lots ════════════════
  // Un résumé d'activité par compte, une lecture chacun ; l'accumulateur vit
  // dans worker/jobs/retention/acc d'une minute à l'autre (planif.js), et la
  // fin publie /stats/retention — des agrégats seulement.
  //
  // LE RISQUE D'ABANDON (risque.js, 05/10/2026) : la même lecture sert aussi
  // le modèle. acc.rq.x : les exemples (sans clé), acc.rq.v : les variables
  // du jour par compte. La fin entraîne, publie risque_modele (aucune clé) et
  // risque/<compte> = {p, t}, puis vide acc.rq : worker/jobs se relit chaque
  // minute, il ne garde pas une liste de comptes toute la journée.
  async function retentionUn(k, t, acc) {
    const r = await _val('activite/' + k);
    const a = RT.accumuler(acc && acc.c ? acc : RT.accVide(), r, t);
    for (const x of Object.keys(a)) acc[x] = a[x];
    const rq = acc.rq = (acc.rq && typeof acc.rq === 'object') ? acc.rq : {};
    const ex = RQ.exemple(k, r, t);
    if (ex) (rq.x = Array.isArray(rq.x) ? rq.x : Object.values(rq.x || {})).push(ex);
    const v = RQ.variables(r, t, 0);
    if (v) (rq.v = rq.v || {})[k] = RQ.VARIABLES.map((n) => v[n]);
    return RT.resumeValide(r) ? 'compte' : 'illisible';
  }
  const activiteComptes = () => db.ref('activite').shallow();
  async function retentionFin(acc) {
    const t = now();
    const v = RT.resultat(acc, t);
    await db.ref('stats/retention').set(v);
    const rq = (acc && acc.rq) || {};
    const lignes = Array.isArray(rq.x) ? rq.x : Object.values(rq.x || {});
    const m = RQ.modele(lignes, t);
    const maj = { risque_modele: { poids: m.poids, n: m.n, nTest: m.nTest, positifs: m.positifs, auc: m.auc, defaut: m.defaut, t } };
    for (const k of Object.keys(rq.v || {})) {
      const x = Object.fromEntries(RQ.VARIABLES.map((n, j) => [n, Number(rq.v[k][j]) || 0]));
      maj['risque/' + k] = { p: RQ.risque(x, m.poids), t };
    }
    await db.ref().update(maj);
    if (acc) delete acc.rq;
    return v;
  }

  // ══ LES VOLTS RECALCULÉS PAR LE SERVEUR (xp.js) ═════════════════════════
  // Les séances NOUVELLES seulement (xp_etat/<k>.n = l'index de la suivante),
  // par lots de XPS.LOT_SEANCES : un historique ancien se rattrape en
  // sous-tâches, jamais d'un bloc. Une écriture multi-chemins pose l'état, le
  // total (/xp_serveur/<k>, lu par le coach) et, si l'athlète montre son rang
  // sur sa page publique, /volts_publics/<pseudo>.
  async function xpRecalculer(k, t, exigerNouvelle) {
    if (!/^[^/.#$\[\]]{3,200}$/.test(k)) return 'cle';
    const etat0 = (await _val('xp_etat/' + k)) || XPS.etatVide();
    const n0 = Number(etat0.n) || 0;
    const brut = (await db.ref('users/' + k + '/sessions').orderByKey().startAt(n0).limitToFirst(XPS.LOT_SEANCES).get()).val();
    const nouvelles = XPS.listeSeances(brut, n0);
    // L'événement part à la fin de la séance, le dossier juste après : s'il
    // n'est pas encore là, on LÈVE et la file réessaie à la minute suivante
    // (planif.js, cinq essais) — comme filleul_seance.
    if (exigerNouvelle && !nouvelles.length) {
      const der = Number(await _lire(k, 'lastSession')) || 0;
      if (der > (Number(etat0.derniere) || 0) + 60e3) throw new Error('séance pas encore synchronisée');
    }
    const [alias, detail, badges, bilans, cree, pp] = await Promise.all([
      nouvelles.length ? _lire(k, 'exAlias') : null, _lire(k, 'xpDetail'), _lire(k, 'badges'),
      db.ref('users/' + k + '/bilans').shallow(), _lire(k, 'createdAt'), _lire(k, 'pagePublique')]);
    const etat = nouvelles.length ? XPS.avancer(etat0, nouvelles, alias, t) : etat0;
    const premiere = nouvelles.length && Number(nouvelles[0].date) > 0 ? Number(nouvelles[0].date) : 0;
    etat.debut = Math.min(...[Number(etat0.debut) || Infinity, Number(cree) || Infinity, premiere || Infinity]);
    if (!isFinite(etat.debut)) etat.debut = t;
    const r = XPS.totalServeur(etat, detail, { nBilans: bilans.length, badges, debut: etat.debut }, t);
    const rg = XPS.rangDe(r.total);
    etat.maj = t;
    const maj = {
      ['xp_etat/' + k]: etat,
      ['xp_serveur/' + k]: { total: r.total, cat: r.cat, rang: { n: rg.rang.n, nom: rg.rang.nom },
        client: Math.round(Number(detail && detail.total) || 0), secrets: Object.keys(etat.secrets || {}),
        nonVerifies: r.nonVerifies, seances: etat.n, maj: t },
    };
    // La page publique : seulement si ce pseudo est bien le sien et qu'il y montre son rang.
    const pseudo = pp && typeof pp.pseudo === 'string' ? pp.pseudo : '';
    if (/^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/.test(pseudo)) {
      // Le point d'un pseudo est « __ » en base (Firebase refuse le point dans une clé).
      const pk = pseudo.replace(/\./g, '__');
      const [proprio, rangPublic] = await Promise.all([_val('pseudos/' + pk), _val('profils_publics/' + pk + '/rang')]);
      // Les volts de la semaine (sem : {lundi: {v, n}}, treize semaines) y
      // sont toujours, pour le classement entre amis ; le rang et la jauge,
      // seulement s'il les montre.
      // derJour : le JOUR de la dernière séance, rien de ce qu'elle contenait
      // (les réactions de ses amis s'y accrochent).
      const sem = etat.sem && Object.keys(etat.sem).length ? etat.sem : null;
      const derJour = Number(etat.derniere) > 0 ? XPS.heureLocale(Number(etat.derniere), null).jour : null;
      if (proprio === k) maj['volts_publics/' + pk] = rangPublic
        ? Object.assign({ rang: { n: rg.rang.n, nom: rg.rang.nom }, maj: t, masquer: r.nonVerifies, sem, derJour }, XPS.voltsPublics(r.total))
        : (sem ? { sem, derJour, maj: t } : null);
    }
    // LES LIGUES : le score de la semaine dans le groupe (une écriture de plus,
    // dans la même mise à jour), ou l'entrée d'un compte hors ligue à sa séance.
    if (nouvelles.length) { try { await liguesApresSeance(k, etat, t, maj); } catch (e) { /* les volts passent d'abord */ } }
    await db.ref().update(maj);
    // LES QUATRE PREMIÈRES SÉANCES D'UN FILLEUL : le mois de son parrain.
    // Relu une fois le seuil passé, jusqu'à ce que ce soit réglé (etat.parr) ;
    // sans parrain et trop vieux pour en avoir un, réglé aussi.
    if ((Number(etat.faites) || 0) >= P.SEUIL_SEANCES && !etat0.parr) {
      const r = await parrainageSeuil(k, t);
      // Pas encore qualifié, ou qualifié mais pas encore payé : on repassera
      // à la prochaine séance (la marque parr n'est pas posée).
      const repasser = r === 'non_qualifie' || r === 'attente_paiement'
        || (r === 'sans_parrain' && Number(cree) > 0 && t - Number(cree) <= P.DELAI_RATTACHEMENT_MS);
      if (!repasser) await db.ref('xp_etat/' + k + '/parr').set(t);
    }
    // LES SCORES DES DÉFIS, DES DUELS ET DES SAISONS, tirés du journal que
    // l'on vient d'écrire (voir progresApresSeance, ci-dessous).
    if (nouvelles.length) await progresApresSeance(k, etat0, etat, t);
    // Un lot plein : la suite en sous-tâche.
    if (nouvelles.length >= XPS.LOT_SEANCES) { await differer([{ quoi: 'xp', cle: k }]); return 'suite'; }
    return 'recalcule';
  }


  // ══ LES LIGUES (ligues.js, 01/10/2026) ══════════════════════════════════
  // LE LUNDI 00 H 30 (Paris) : le travail « ligues » lit chaque compte de
  // xp_etat (sa semaine close, sa ligue, son dossier), puis, à la fin, CLÔT
  // la semaine passée (ligues_resultats/<k>/<lundi>) et CRÉE les groupes de la
  // nouvelle (ligues/<lundi>/<g>, ligues_public, ligues_membres), en UNE
  // écriture multi-chemins. Les clés de compte ne sortent jamais du Worker :
  // ligues_prive/<lundi>/<g>/<k> (aucune lecture client) fait le lien ;
  // ligues/<lundi>/<g>.membres et ligues_public ne portent qu'un nom public
  // (pseudo vérifié, ou « Athlète N »).
  // EN SEMAINE : xpRecalculer met à jour la ligne du compte dans
  // ligues_public, ou fait entrer un compte hors ligue dans un groupe de sa
  // division (ligues_index, le nombre de membres par groupe, en transaction).
  const LIGUES_GARDE = 3;                // semaines gardées en base
  const liguesComptes = () => db.ref('xp_etat').shallow();
  // Le pseudo public, s'il est bien le sien (pseudos/<clé> → son compte).
  async function _pseudoVerifie(k, s) {
    const pp = await _objet(k, s, 'pagePublique');
    const ps = pp && typeof pp.pseudo === 'string' ? pp.pseudo : '';
    if (!/^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/.test(ps)) return '';
    return (await _val('pseudos/' + ps.replace(/\./g, '__'))) === k ? ps : '';
  }
  async function liguesUn(k, t, acc) {
    if (!/^[^/.#$\[\]]{3,200}$/.test(k)) return 'cle';
    const lundi = lundiParis(t), prec = L.lundiPlus(lundi, -1), avant = L.lundiPlus(lundi, -2);
    const [sem, der, debut, m, s0] = await Promise.all([_val('xp_etat/' + k + '/sem'), _val('xp_etat/' + k + '/derniere'),
      _val('xp_etat/' + k + '/debut'), _val('ligues_membres/' + k), _surface(k)]);
    const s = s0 || {};
    const [susp, ps] = await Promise.all([_objet(k, s, 'suspension'), _pseudoVerifie(k, s)]);
    const w = (sem && sem[prec]) || {}, wa = (sem && sem[avant]) || {};
    if (!acc.c || typeof acc.c !== 'object') acc.c = {};
    acc.c[k] = { d: (m && m.division) || 'bronze', g: (m && m.lundi === prec && m.groupe) || '',
      v: Number(w.v) || 0, n: Number(w.n) || 0, nA: Number(wa.n) || 0, der: Number(der) || 0, debut: Number(debut) || 0,
      coach: s.role === 'coach' ? 1 : 0, off: s.liguesOff === true ? 1 : 0, susp: susp && susp.actif ? 1 : 0, ps };
    return 'lu';
  }
  // PURE. Les écritures de la clôture et de la répartition (exportée pour les tests).
  function liguesEcritures(acc, t) {
    const lundi = lundiParis(t), prec = L.lundiPlus(lundi, -1);
    const c = (acc && acc.c) || {};
    const maj = {}, division = {};
    // 1. LA CLÔTURE de la semaine passée, groupe par groupe.
    const parGroupe = {};
    for (const k of Object.keys(c).sort()) if (c[k].g) (parGroupe[c[k].g] = parGroupe[c[k].g] || []).push({ k, division: c[k].d });
    for (const g of Object.keys(parGroupe)) {
      const semV = {};
      for (const m of parGroupe[g]) { const x = c[m.k]; semV[m.k] = { v: x.v, n: x.n, der: x.der, nAvant: x.nA, suspendu: !!x.susp }; }
      for (const r of L.cloturer({ membres: parGroupe[g] }, semV)) {
        division[r.k] = r.vers;
        const res = { division: r.division, vers: r.vers, place: r.place, mouvement: r.mouvement, taille: r.taille, at: t };
        maj['ligues_resultats/' + r.k + '/' + prec] = res;
        maj['ligues_prive/' + prec + '/' + g + '/' + r.k + '/r'] = res;
      }
    }
    // 2. LA RÉPARTITION de la semaine qui commence.
    const comptes = Object.keys(c).map((k) => ({ k, division: division[k] || c[k].d, sem: { [prec]: { n: c[k].n } },
      debut: c[k].debut, coach: !!c[k].coach, off: !!c[k].off, suspendu: !!c[k].susp }));
    const places = new Set();
    for (const gr of L.repartir(comptes, t, lundi)) {
      const membres = {};
      gr.membres.forEach((m, i) => {
        const nom = L.nomPublic(c[m.k].ps, i), cle = L.cleNom(nom);
        membres[cle] = true; places.add(m.k);
        maj['ligues_prive/' + lundi + '/' + gr.id + '/' + m.k] = { nom, division: m.division };
        maj['ligues_membres/' + m.k] = { lundi, groupe: gr.id, division: m.division, nom };
        maj['ligues_public/' + lundi + '/' + gr.id + '/' + cle] = { nom, v: 0, n: 0, der: 0 };
      });
      maj['ligues/' + lundi + '/' + gr.id] = { division: gr.division, membres, n: gr.membres.length };
      maj['ligues_index/' + lundi + '/' + gr.division + '/' + gr.id] = gr.membres.length;
    }
    // Hors ligue cette semaine : la division est gardée pour son retour.
    for (const k of Object.keys(c)) if (!places.has(k) && division[k]) maj['ligues_membres/' + k] = { division: division[k] };
    // Les semaines anciennes partent.
    const vieux = L.lundiPlus(lundi, -LIGUES_GARDE);
    for (const n of ['ligues', 'ligues_public', 'ligues_prive', 'ligues_index']) maj[n + '/' + vieux] = null;
    return maj;
  }
  async function liguesFin(acc, t) {
    const maj = liguesEcritures(acc, typeof t === 'number' ? t : now());
    await db.ref().update(maj);
    return Object.keys(maj).length;
  }
  // EN SEMAINE, après une séance recalculée. Écrit dans `maj` (l'update de
  // xpRecalculer) ; seule l'entrée dans un groupe prend sa place par transaction.
  async function liguesApresSeance(k, etat, t, maj) {
    const lundi = lundiParis(t);
    const w = (etat && etat.sem && etat.sem[lundi]) || { v: 0, n: 0 };
    const ligne = (nom) => ({ nom, v: Number(w.v) || 0, n: Number(w.n) || 0, der: Number(etat && etat.derniere) || 0 });
    const m = await _val('ligues_membres/' + k);
    if (m && m.lundi === lundi && m.groupe && m.nom) {
      maj['ligues_public/' + lundi + '/' + m.groupe + '/' + L.cleNom(m.nom)] = ligne(m.nom);
      return 'maj';
    }
    // HORS LIGUE : il y entre à sa séance, dans sa division (BRONZE au début).
    const s = (await _surface(k)) || {};
    if (s.role === 'coach' || s.liguesOff === true) return 'hors';
    const susp = await _objet(k, s, 'suspension');
    if (susp && susp.actif) return 'hors';
    const div = (m && m.division) || 'bronze';
    const index = (await _val('ligues_index/' + lundi)) || {};
    let choix = L.groupeDArrivee(index, div);
    let rang = 1;
    if (choix) {
      const tx = await db.ref('ligues_index/' + lundi + '/' + choix.division + '/' + choix.g)
        .transaction((cur) => ((Number(cur) || 0) >= L.TAILLE_MAX ? undefined : (Number(cur) || 0) + 1));
      if (!tx.committed) choix = null; else rang = Number(tx.snapshot.val()) || 1;
    }
    if (!choix) {
      choix = { g: div + '-' + (Object.keys(index[div] || {}).length + 1), division: div, neuf: true };
      maj['ligues_index/' + lundi + '/' + div + '/' + choix.g] = 1;
      maj['ligues/' + lundi + '/' + choix.g + '/division'] = div;
    }
    const nom = L.nomPublic(await _pseudoVerifie(k, s), rang - 1), cle = L.cleNom(nom);
    maj['ligues/' + lundi + '/' + choix.g + '/membres/' + cle] = true;
    maj['ligues_prive/' + lundi + '/' + choix.g + '/' + k] = { nom, division: div };
    maj['ligues_membres/' + k] = { lundi, groupe: choix.g, division: div, nom };
    maj['ligues_public/' + lundi + '/' + choix.g + '/' + cle] = ligne(nom);
    return 'entre';
  }
  // LE SAMEDI 11 H : la zone de bascule, groupe par groupe (deux lectures),
  // un push en sous-tâche pour chacun de ceux qui y sont.
  const liguesGroupes = (lundi) => db.ref('ligues_prive/' + lundi).shallow();
  async function liguesSamediUn(g, t) {
    const lundi = lundiParis(t);
    const [pub, prive] = await Promise.all([_val('ligues_public/' + lundi + '/' + g), _val('ligues_prive/' + lundi + '/' + g)]);
    if (!prive) return 'vide';
    const semV = {}, membres = [];
    for (const k of Object.keys(prive)) {
      const x = prive[k] || {}, l = (pub && pub[L.cleNom(x.nom || '')]) || {};
      membres.push({ k, division: x.division || 'bronze' });
      semV[k] = { v: l.v, n: l.n, der: l.der };
    }
    const ordre = L.classer(membres, semV), taches = [];
    ordre.forEach((m, i) => {
      const zone = L.zoneBascule(i + 1, ordre.length, m.division);
      if (zone) taches.push(tachePush(m.k, L.messageBascule(i + 1, ordre.length, m.division, zone)));
    });
    if (taches.length) await differer(taches);
    return taches.length;
  }
  // LE LUNDI 9 H : le résultat de la semaine close, à chacun de ceux qui ont été classés.
  async function liguesLundiUn(g, t) {
    const prec = L.lundiPlus(lundiParis(t), -1);
    const prive = (await _val('ligues_prive/' + prec + '/' + g)) || {};
    const taches = [];
    for (const k of Object.keys(prive)) {
      const r = prive[k] && prive[k].r;
      if (r && r.mouvement !== 'sorti') taches.push(tachePush(k, Object.assign({ tag: 'ligue-' + prec }, L.messageResultat(r))));
    }
    if (taches.length) await differer(taches);
    return taches.length;
  }

  // ══ LES SCORES ÉCRITS PAR LE SERVEUR (01/10/2026) ═══════════════════════
  // Les valeurs des défis du Canal (participants/<k>/valeur, metrique), des
  // duels (duels/<id>/progres/<k>) et des saisons (saisons_progres/<id>/<k>)
  // étaient écrites par l'app — et donc par n'importe quelle console. Les
  // règles les ferment au client ; le Worker les tire de xp_etat (le journal
  // e.jr, XPS.valeurServeur) après chaque séance recalculée.
  // AU PLUS PROGRES_MAX écritures par recalcul (une seule écriture multi-
  // chemins) : au-delà, une sous-tâche « progres » reprend la suite.
  const PROGRES_MAX = 4;
  const refId = (c) => c.g === 'defi' ? 'f_' + c.id : (c.g === 'duel' ? 'd_' + c.id : 's_' + c.id);
  // Les cibles d'un joueur : ses duels en cours (index duels_joueur/<k>), la
  // saison suivie, les défis en cours du canal de son coach où il est inscrit.
  // Chacune porte sa définition (mesure, debut, fin).
  async function progresCibles(k, t) {
    const [duels, saisons, coach] = await Promise.all([db.ref('duels_joueur/' + k).shallow(), _val('saisons'), _lire(k, 'coachEmailKey')]);
    const out = [];
    const oublis = {};
    for (const id of duels.filter((x) => DU.DUEL_ID_RE.test(x))) {
      const d = await _val('duels/' + id);
      if (!d || d.statut === 'termine' || d.statut === 'annule' || (d.createur !== k && d.invite !== k)) { oublis['duels_joueur/' + k + '/' + id] = null; continue; }
      if (d.statut !== 'en_cours') continue;
      out.push({ g: 'duel', id, mesure: d.mesure, debut: Number(d.debut), fin: Number(d.fin), d });
    }
    if (Object.keys(oublis).length) await db.ref().update(oublis);
    const _sEff = CS.saisonsEffectives(saisons || {});
    for (const id of Object.keys(_sEff)) {
      const x = _sEff[id];
      if (SA.saisonSuivie(x, t) && t <= Number(x.fin) + 864e5) out.push({ g: 'saison', id, mesure: x.mesure, debut: Number(x.debut), fin: Number(x.fin) });
    }
    if (coach && typeof coach === 'string') {
      for (const m of await defisDuCoach(coach)) {
        if (!(t >= Number(m.debut) && t <= Number(m.fin))) continue;
        const ins = await _val(defiChemin(coach, m.id, 'participants/' + k + '/inscription'));
        if (ins) out.push({ g: 'defi', id: m.id, coach, mesure: m.mesure, debut: Number(m.debut), fin: Number(m.fin) });
      }
    }
    return out;
  }
  // Le quota de la mesure « serie » : les créneaux actifs du planning.
  async function progresQuota(k) {
    const c = await _lire(k, 'sessions_config');
    const l = Array.isArray(c) ? c : (c && typeof c === 'object' ? Object.values(c) : []);
    return Math.max(1, l.filter((x) => x && x.active).length);
  }
  // Écrit les valeurs de `cibles` (PROGRES_MAX au plus), en une écriture.
  // `etatAvant` : l'état d'avant les séances de ce recalcul (l'instantané
  // « avant » d'une progression en % se fige dessus).
  async function progresEcrire(k, etatAvant, etat0, cibles, t) {
    const lot = cibles.slice(0, PROGRES_MAX), reste = cibles.slice(PROGRES_MAX);
    const quota = lot.some((c) => c.mesure === 'serie') ? await progresQuota(k) : 1;
    let etat = etat0;
    const maj = {}, defis = [];
    for (const c of lot) {
      const rid = refId(c);
      if (c.mesure === 'progressionPct' && !(etat.ref && etat.ref[rid])) {
        etat = XPS.figerRef(etatAvant, etat, rid, t);
        maj['xp_etat/' + k + '/ref'] = etat.ref;
      }
      const v = Math.max(0, Number(XPS.valeurServeur(etat, c.mesure, c.debut, c.fin, quota, rid)) || 0);
      if (c.g === 'duel') {
        maj['duels/' + c.id + '/progres/' + k] = { valeur: v, maj: t, srv: true };
        // Les scores suivent dans la même écriture (la valeur de l'autre est celle qu'il a déjà).
        const p = Object.assign({}, (c.d && c.d.progres) || {}, { [k]: { valeur: v } });
        maj['duels/' + c.id + '/scores'] = DU.scoresDe(Object.assign({}, c.d, { progres: p }));
        maj['duels/' + c.id + '/maj'] = t;
      } else if (c.g === 'saison') {
        maj['saisons_progres/' + c.id + '/' + k] = { valeur: v, maj: t, srv: true };
      } else {
        const base = defiChemin(c.coach, c.id, 'participants/' + k);
        maj[base + '/valeur'] = v;
        maj[base + '/metrique'] = Math.max(0, Number(XPS.metriqueServeur(etat, c.mesure, c.debut, c.fin, quota, rid)) || 0);
        maj[base + '/maj'] = t;
        maj[base + '/srv'] = true;
        defis.push({ quoi: 'defi_maj', coach: c.coach, id: c.id });
      }
    }
    if (Object.keys(maj).length) await db.ref().update(maj);
    // Le classement, les paliers et les annonces d'un défi : en sous-tâche
    // (ils relisent tous les participants), comme l'événement de l'app.
    const suite = defis.slice();
    if (reste.length) suite.push({ quoi: 'progres', cle: k, cibles: reste.map((c) => ({ g: c.g, id: c.id, coach: c.coach || null })) });
    if (suite.length) await differer(suite);
    return lot.length;
  }
  async function progresApresSeance(k, etatAvant, etat, t) {
    // À court de budget : tout part en sous-tâche (l'instantané « avant »
    // se fige alors sur l'état courant).
    if (_reste() < 16) { await differer([{ quoi: 'progres', cle: k }]); return 'differe'; }
    const cibles = await progresCibles(k, t);
    if (!cibles.length) return 0;
    return progresEcrire(k, etatAvant, etat, cibles, t);
  }
  // La sous-tâche : toutes les cibles, ou celles qu'un recalcul a laissées.
  async function progresTache(e) {
    const k = String(e.cle || ''), t = now();
    if (!/^[^/.#$\[\]]{3,200}$/.test(k)) return 'cle';
    const etat = (await _val('xp_etat/' + k)) || XPS.etatVide();
    let cibles;
    if (Array.isArray(e.cibles)) {
      const toutes = await progresCibles(k, t);
      const voulu = new Set(e.cibles.map((c) => c.g + '|' + c.id));
      cibles = toutes.filter((c) => voulu.has(c.g + '|' + c.id));
    } else cibles = await progresCibles(k, t);
    return cibles.length ? progresEcrire(k, etat, etat, cibles, t) : 0;
  }

  // ══ LA RELANCE DES INACTIFS (J+7, J+14, J+30) — 11 h, une personne à la fois ══
  // Trois champs d'abord (la dernière séance écarte presque tout le monde),
  // le reste seulement pour qui est au bon jour. retour_etat/<uid> retient
  // les paliers envoyés de la période ; le Worker seul le lit et l'écrit.
  const _LIRE_RETOUR = ['fname', 'xpRang', 'streak', 'tonnageTotal'];
  async function retourUn(uid, t, profil, log) {
    if (dejaNotifie(log, t, profil && profil.tz, 'retour')) return 'plafond';
    const pr = await profilUtile(uid, profil, t);
    const der = Number(pr ? pr.lastSession : await _lire(uid, 'lastSession')) || 0;
    let palier = RE.palierDuJour(der, t);
    // LE PALIER PRÉCOCE dépend des créneaux : relus seulement les jours où il
    // peut tomber (2 à 6 jours d'absence).
    if (!palier && der > 0) {
      const n = RE.joursDepuis(der, t);
      if (n >= 2 && n < RE.RETOUR_PALIERS[0]) palier = RE.palierDuJour(der, t, RE.creneauxActifs(await _lire(uid, 'sessions_config')));
    }
    if (!palier) return 'rien';
    const [susp, etat0, logPush] = await Promise.all([_lire(uid, 'suspension'), _val('retour_etat/' + uid), log !== undefined ? (log || null) : _val('push_log/' + uid)]);
    const etat = RE.etatPeriode(etat0, der);
    const ok = RE.retourAutorise({ palier, etat, suspension: susp, logPush, t });
    if (!ok.ok) return ok.raison;
    // Le total du SERVEUR (xp_serveur/<k>.total) : « plus que 1 240 V avant MACHINE ».
    const [fname, xpRang, streak, tonnageTotal, total] = await Promise.all([..._LIRE_RETOUR.map((c) => _lire(uid, c)), _val('xp_serveur/' + uid + '/total')]);
    // Heures calmes chez l'athlète : déposé pour son matin, et compté comme parti.
    const r = await envoyerPush(uid, RE.messageRetour(palier, { fname, xpRang, streak, tonnageTotal, total }, t), optLog(log, {}, pr));
    if (!r.envoye && !r.differe) return r.raison || 'echec';
    etat.paliers[palier] = t;
    await db.ref('retour_etat/' + uid).set(etat);
    return 'envoye';
  }

  // ══ LE PARCOURS DU PROSPECT (lot C6) ═══════════════════════════════════
  // POST /prospect depuis la vitrine publique (sans compte). Le slug désigne le
  // coach (slugs/<slug>) ; la vitrine dit quelles formules il propose. Deux
  // lectures, une écriture, une notification au coach.
  const LIB_FORMULES = { programme_perso: 'le Programme personnalisé', revision_prog: 'la Révision de programme',
    coaching_essentiel: 'le Coaching Essentiel', coaching_transfo: 'le Coaching Transformation', coaching_evolution: 'le Coaching Évolution' };
  const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
  async function prospectRecevoir(corps, t) {
    const slug = String((corps && corps.slug) || '').toLowerCase();
    if (!SLUG_RE.test(slug)) return { ok: false, raison: 'page' };
    const [coach, vitrine] = await Promise.all([_val('slugs/' + slug), _val('vitrines/' + slug)]);
    if (!coach || !vitrine) return { ok: false, raison: 'page' };
    const existants = await _val('prospects/' + coach);
    const r = PR.prospectDepuisFormulaire(corps, vitrine, existants, t);
    // Un doublon n'est pas une erreur pour la personne : sa demande est bien arrivée.
    if (!r.ok) return r.raison === 'doublon' ? { ok: true, deja: true } : r;
    await db.ref('prospects/' + coach + '/' + idFile(t, 'p')).set(r.prospect);
    try { await envoyerPush(coach, PR.messageNouveauProspect(r.prospect, LIB_FORMULES[r.prospect.formule]), { attendre: true }); } catch (e) { /* le prospect est enregistré, c'est l'essentiel */ }
    return { ok: true };
  }
  // GET /vitrine-vue?s=<slug> : une visite par appareil et par jour (la page
  // s'en souvient), comptée par jour. Aucun identifiant, aucune adresse.
  async function vitrineVue(slug, t) {
    const s = String(slug || '').toLowerCase();
    if (!SLUG_RE.test(s)) return false;
    if (!(await _val('slugs/' + s))) return false;
    await db.ref('vitrines_stats/' + s + '/' + paris(t).jour).transaction((v) => (Number(v) || 0) + 1);
    return true;
  }
  // CHAQUE HEURE : les prospects sans réponse depuis 48 h. UNE notification par
  // coach (elle compte ses prospects en attente), et chacun n'est relancé
  // qu'une fois (relanceLe).
  async function prospectsRelanceHeure(t) {
    const tout = (await _val('prospects')) || {};
    for (const coach of Object.keys(tout).sort()) {
      const l = PR.prospectsARelancer(tout[coach], t);
      if (!l.length) continue;
      if (_reste() < 16) return false;
      const r = await envoyerPush(coach, PR.messageRelanceCoach(l), { attendre: true });
      // Heures calmes : envoyerPush l'a mise de côté pour 8 h 05, elle part donc.
      // Plafond du jour pris, ou pas d'appareil : on réessaie à l'heure suivante.
      if (!r.envoye && r.raison !== 'calme') continue;
      const maj = {};
      for (const p of l) maj['prospects/' + coach + '/' + p.id + '/relanceLe'] = t;
      await db.ref().update(maj);
    }
    return true;
  }

  // ══ LES MESSAGES PROGRAMMÉS DU CANAL (lot C5) ══════════════════════════
  // canal_programmes/<coach>/<id> = {quand, titre, texte, lien?}, écrit par le
  // coach. Chaque heure, UNE lecture de tout le nœud, et UNE écriture pour tout
  // ce qui est dû : le message entre dans canaux/<coach>/messages sous le même
  // identifiant, la sonde canalDernier suit, l'entrée programmée disparaît.
  // ⚠ Un message en retard de plus d'une journée (serveur arrêté) ne part pas
  //   tout seul : il est marqué « manque », et le coach décide.
  const CANAL_RETARD_MAX = 24 * 3600e3;
  const lienSur = (l) => (/^https:\/\/[^\s]+$/i.test(String(l || '')) ? String(l).slice(0, 500) : '');
  async function canalProgrammesHeure(t) {
    const tout = (await _val('canal_programmes')) || {};
    const maj = {};
    let n = 0;
    for (const coach of Object.keys(tout)) {
      const l = tout[coach] || {};
      let dernier = 0;
      for (const id of Object.keys(l)) {
        const m = l[id];
        if (!m || !(Number(m.quand) > 0) || Number(m.quand) > t || m.manque) continue;
        if (t - Number(m.quand) > CANAL_RETARD_MAX) { maj['canal_programmes/' + coach + '/' + id + '/manque'] = true; continue; }
        const titre = String(m.titre || '').slice(0, 80), texte = String(m.texte || '').slice(0, 1000);
        maj['canal_programmes/' + coach + '/' + id] = null;
        if (!titre && !texte) continue;
        const msg = { at: t, titre, texte, epingle: false };
        const lien = lienSur(m.lien);
        if (lien) msg.lien = lien;
        maj['canaux/' + coach + '/messages/' + id] = msg;
        dernier = t; n++;
      }
      if (dernier) maj['coach_public/' + coach + '/canalDernier'] = dernier;
    }
    if (Object.keys(maj).length) await db.ref().update(maj);
    return n;
  }

  // ══ LES RELANCES AUTOMATIQUES DU COACH (lot C3) ════════════════════════
  // Le travail « relances » (planif.js, 10 h 30) lit les règles de chaque
  // coach : une lecture. Coupées, en pause ou absentes : rien d'autre. Sinon
  // l'annuaire du coach, et UNE SOUS-TÂCHE PAR ATHLÈTE (quoi: 'relance'),
  // traitée dans la file au rythme du budget.
  // ⚠ LA SOUS-TÂCHE RELIT LES RÈGLES : « je reprends la main » et
  //   l'exclusion d'un athlète valent pour les sous-tâches déjà en file.
  // Le journal, relances_auto/<coach>/<athlète>/<id>, est écrit par le
  // Worker seul ; le coach le lit en entier, l'athlète sa propre branche
  // (le moyen « canal » s'y lit : c'est un message privé dans l'app, JAMAIS
  // le canal collectif du coach, que tous ses athlètes lisent).
  const RELANCE_REPORTS = { nostart: 'nostart', overdue: 'overdue', expiring: 'expiring', noprog: 'noprog', bilan: 'bilan', inactif: 'inactif' };
  async function relancesCoachUn(coach, t) {
    const cfg = await _lire(coach, 'relancesAuto');
    if (!RL.relancesAllumees(cfg)) return 'coupe';
    const [annuaire, alertes] = await Promise.all([db.ref('annuaire_coach/' + coach).shallow(), _lire(coach, 'alertStatus')]);
    const exclus = (cfg.exclus && typeof cfg.exclus === 'object') ? cfg.exclus : {};
    const a = (alertes && typeof alertes === 'object') ? alertes : {};
    // Les reports du coach (alertStatus) sont par identifiant d'athlète : on
    // garde ceux des cinq types, encore en cours, et la sous-tâche retient le sien.
    const reports = {};
    for (const k of Object.keys(a)) {
      const m = /^(nostart|overdue|expiring|noprog|bilan|inactif)-(.+)$/.exec(k);
      if (!m || !a[k] || typeof a[k] !== 'object') continue;
      if (Number(a[k].until) && t >= Number(a[k].until)) continue;
      (reports[m[2]] = reports[m[2]] || {})[RELANCE_REPORTS[m[1]]] = { until: Number(a[k].until) || 0, seenUpTo: Number(a[k].seenUpTo) || 0 };
    }
    const taches = [];
    for (const uid of (annuaire || []).slice().sort()) {
      if (exclus[uid]) continue;
      taches.push({ quoi: 'relance', coach, uid, reports });
    }
    if (taches.length) await differer(taches);
    return taches.length;
  }
  // Le programme existe-t-il ? (hasProgram de l'app ; les séances d'exemple
  // ne comptent pas). Lu seulement si la règle « sans programme » est allumée.
  async function aUnProgramme(uid) {
    const [cfg, pdfU, pdfL, pdf, prog] = await Promise.all([_lire(uid, 'sessions_config'), _lire(uid, 'programPdfStorageUrl'),
      _lire(uid, 'programPdfLink'), _lire(uid, 'programPdf'), db.ref('users/' + uid + '/program').shallow()]);
    const l = Array.isArray(cfg) ? cfg : Object.values(cfg || {});
    return !!(l.some((s) => s && s.active && s.exercises && Object.keys(s.exercises).length && !s._essai && !s._foundation)
      || pdfU || pdfL || pdf || (prog && prog.length));
  }
  async function relanceAthlete(e) {
    const t = now();
    const coach = String(e.coach || ''), uid = String(e.uid || '');
    if (!coach || !uid) return 'vide';
    const [cfg, journal, sonCoach] = await Promise.all([_lire(coach, 'relancesAuto'), _val('relances_auto/' + coach + '/' + uid), _lire(uid, 'coachEmailKey')]);
    if (sonCoach !== coach) return 'pas_son_coach';
    const regles = RL.reglesNormalisees(cfg && cfg.regles);
    // Rien à lire si le choix est déjà fermé (pause, exclu, semaine prise).
    const avant = RL.choisirRelance({ cfg, cleAthlete: uid, signaux: {}, journal, t });
    if (avant.raison !== 'aucun_signal') return avant.raison;
    const [bilans, createdAt, fname, id, cadence, freq] = await Promise.all(['bilans', 'createdAt', 'fname', 'id', 'bilanCadence', '_bilanFreq'].map((c) => _lire(uid, c)));
    // Série 6 : le défaut du coach (defautsCoach.bilan, sinon reglagesCoach.cadence).
    const [defautsCoach, reglagesCoach] = await Promise.all([_lire(coach, 'defautsCoach'), _lire(coach, 'reglagesCoach')]);
    // La cadence du dossier, le défaut du coach, la fréquence de l'athlète : l'échéance est celle de l'app.
    const d = { bilans, createdAt, cadence, freq, coach: { defautsCoach, reglagesCoach } };
    if (regles.expiring.actif) {
      const [status, accessExpiry, droits] = await Promise.all([_lire(uid, 'status'), _lire(uid, 'accessExpiry'), lireDroits(uid)]);
      d.status = status;
      d.echeance = (droits && Number(droits.echeance) > 0) ? Number(droits.echeance) : Number(accessExpiry) || 0;
    }
    if (regles.noprog.actif) d.programme = await aUnProgramme(uid);
    // L'inactivité : lastSession, le résumé que l'app pose à chaque séance ;
    // à défaut, la dernière entrée de sessions (une seule, par sa clé).
    if (regles.inactif.actif) {
      let der = Number(await _lire(uid, 'lastSession')) || 0;
      if (!der) {
        const s = (await db.ref('users/' + uid + '/sessions').orderByKey().limitToLast(1).get()).val();
        for (const x of Object.values(s || {})) der = Math.max(der, Number(x && x.date) || 0);
      }
      d.derniereSeance = der;
      d.delaiInactif = regles.inactif.delai;
    }
    const reports = (e.reports && id != null && e.reports[String(id)]) || {};
    const choix = RL.choisirRelance({ cfg, cleAthlete: uid, signaux: RL.signauxRelance(d, t), journal, reports, t });
    if (!choix.signal) return choix.raison;
    // Le texte du coach s'il en a écrit un (relancesAuto.textes), sinon celui par défaut.
    const texte = RL.texteRelance(choix.signal, fname, RL.textesNormalises(cfg && cfg.textes)[choix.signal], { jours: choix.jours });
    let statut = 'parti', raison = null;
    if (choix.moyen === 'push') {
      const r = await envoyerPush(uid, { type: 'relance', url: './', tag: 'relance-' + choix.signal,
        title: 'Un mot de ton coach', body: texte }, { attendre: false });
      if (!r.envoye) { statut = 'non_parti'; raison = r.raison || 'echec'; }
    }
    // Un refus n'est noté qu'une fois par épisode et par raison : sans ça, un
    // athlète sans notification ajouterait une ligne au journal chaque jour.
    const deja = RL.journalListe(journal).some((x) => x.statut === 'non_parti' && x.signal === choix.signal
      && Number(x.depuis) === choix.depuis && x.raison === raison);
    const maj = {};
    for (const vieux of RL.journalAPurger(journal, t)) maj['relances_auto/' + coach + '/' + uid + '/' + vieux] = null;
    if (!(statut === 'non_parti' && deja)) maj['relances_auto/' + coach + '/' + uid + '/' + idFile(t, 'r')] =
      Object.assign({ at: t, signal: choix.signal, depuis: choix.depuis, moyen: choix.moyen, texte, statut }, raison ? { raison } : {});
    if (Object.keys(maj).length) await db.ref().update(maj);
    // LOT C7 : le compte anonyme du jour, comme les compteurs de l'app (metrics/<jour>/coach_relance_auto).
    if (statut === 'parti') { try { await db.ref('metrics/' + paris(t).jour + '/coach_relance_auto').transaction((v) => (Number(v) || 0) + 1); } catch (e) { /* un compte manqué ne bloque rien */ } }
    return statut === 'parti' ? 'envoye' : raison;
  }

  // ══ LOT C1 : LES RELANCES DE L'ACCUEIL D'UN ATHLÈTE COACHÉ ═════════════
  // /parcours_relances/<jour>/<compte>/<étape> = true, déposé par l'app de
  // l'athlète (bilan à J2, séance à J6) ou par son coach à la publication
  // (programme non lu). Le Worker lit la liste du JOUR (une lecture), relit la
  // seule chose qui dit si l'étape est faite, et pousse au plafond commun
  // (deux poussées par jour au plus, la seconde pour la série ou un duel). UNE FOIS PAR ÉTAPE : la trace
  // accueil_trace/<compte>/<étape> = la date de l'envoi, que la fiche du coach
  // lit aussi. Plafond du jour déjà pris : l'étape repart au lendemain, une fois.
  const ACCUEIL_MSG = {
    bilan: { type: 'bilan', prio: 'accueil', url: './?bilan=1', title: 'Ton bilan de départ t’attend',
      body: 'Cinq minutes, et ton coach a de quoi écrire ton programme.' },
    programme: { type: 'serie', prio: 'accueil', url: './', title: 'Ton programme est prêt',
      body: 'Ton coach l’a écrit pour toi : jette un œil avant ta première séance.' },
    seance: { type: 'serie', prio: 'accueil', url: './?wo=1', title: 'Ta première séance t’attend',
      body: 'Ton programme est là : une séance, et ton accueil est presque bouclé.' },
  };
  async function accueilFaite(k, etape) {
    if (etape === 'bilan') return ((await db.ref('users/' + k + '/bilans').shallow()) || []).length > 0;
    if (etape === 'seance') return Number(await _lire(k, 'lastSession')) > 0;
    if (etape === 'programme') return Number(await _val('users/' + k + '/parcours/programmeLu')) > 0;
    return true;
  }
  // LE TRAVAIL QUOTIDIEN (planif.js, « indicateurs ») : quatre lectures, une
  // écriture, indicateurs/<AAAA-MM-JJ> (lu par le créateur seul).
  async function indicateursJour(tBrut) {
    const t = tBrut || Date.now();
    const [droits, tx, registre, fins] = await Promise.all([_val('droits'), _val('paypal_transactions'), _val('coachs_registre'), _val('paypal_fins')]);
    // Les coachs, du REGISTRE (le serveur l'écrit ; users/<clé>/coachPlan n'en est que le miroir).
    const users = {};
    for (const [cle, r] of Object.entries(registre || {})) {
      if (r && typeof r === 'object') users[cle] = { coachPlan: String(r.plan || 'libre'), coachSubActive: Number(r.actifJusqu) > t };
    }
    const res = indicateurs(droits, tx, users, t, fins);
    await db.ref('indicateurs/' + paris(t).jour).set(Object.assign({ maj: t }, res));
    return res;
  }

  async function accueilRelances(t) {
    const jour = paris(t).jour;
    const liste = (await _val('parcours_relances/' + jour)) || {};
    const demain = paris(t + 864e5).jour;
    const maj = { ['parcours_relances/' + jour]: null };
    let n = 0;
    for (const k of Object.keys(liste).sort()) {
      const et = liste[k] || {};
      for (const etape of Object.keys(et)) {
        if (!ACCUEIL_MSG[etape]) continue;
        if (_reste() < 16) { maj['parcours_relances/' + demain + '/' + k + '/' + etape] = true; continue; }
        if (await _val('accueil_trace/' + k + '/' + etape)) continue;
        if (await accueilFaite(k, etape)) continue;
        const m = ACCUEIL_MSG[etape];
        const r = await envoyerPush(k, Object.assign({ tag: 'accueil-' + etape }, m), { attendre: false });
        if (r.envoye) { maj['accueil_trace/' + k + '/' + etape] = t; n++; }
        else if (r.raison === 'plafond' && et[etape] !== 'repris') maj['parcours_relances/' + demain + '/' + k + '/' + etape] = 'repris';
      }
    }
    await db.ref().update(maj);
    return n;
  }

  // ══ LE PARCOURS « MISE SOUS TENSION » : LE RAPPEL DU 21e JOUR D'ESSAI ══
  // Chaque app tient /parcours_j21/<jour J21 de son essai>/<elle> = le
  // nombre d'étapes qui lui restent (null quand le parcours est fini). Le
  // Worker lit la liste DU JOUR seulement (une lecture), pousse « encore N
  // étapes » (type serie : même réglage que les rappels de régularité), et
  // efface le jour. Rend false quand le budget coupe.
  async function parcoursJ21(t) {
    const jour = paris(t).jour;
    const liste = (await _val('parcours_j21/' + jour)) || {};
    const dest = Object.keys(liste).map((uid) => ({ uid, n: Math.round(Number(liste[uid])) }))
      .filter((x) => x.n >= 1 && x.n <= 7).sort((a, b) => (a.uid < b.uid ? -1 : 1));
    if (dest.length && _reste() < 6) return false;
    // Effacé AVANT les push : pousserA diffère ce qui dépasse le budget, rien
    // ne repart donc deux fois.
    await db.ref('parcours_j21/' + jour).remove();
    if (dest.length) await pousserA(dest.map((x) => ({ uid: x.uid, message: messageParcoursJ21(x.n, jour) })), { attendre: false });
    return true;
  }

  // ══ UNE SOUS-TÂCHE (écrite par differer, jamais par l'app : les règles
  // refusent le type « tache » à un client) ══════════════════════════════
  async function tache(e) {
    const quoi = String((e && e.quoi) || '');
    if (quoi === 'push') {
      const o = Object.assign({}, e.attendre === false ? { attendre: false } : {}, e.urgent ? { urgent: true } : {});
      const r = await envoyerPush(String(e.uid || ''), e.message || {}, Object.keys(o).length ? o : undefined);
      return r.envoye ? 'envoye' : (r.raison || 'rien');
    }
    if (quoi === 'amb_vue') { await ambMajVue(String(e.code || '')); return 'vue'; }
    if (quoi === 'defis_coach') return defisQuotidienCoach(String(e.coach || ''), now());
    if (quoi === 'xp') return xpRecalculer(String(e.cle || ''), now());
    if (quoi === 'progres') return progresTache(e);
    if (quoi === 'defi_maj') return defiMaj(String(e.coach || ''), String(e.id || ''), now());
    if (quoi === 'relance') return relanceAthlete(e);
    // LES SUITES D'UN PREMIER PAIEMENT PayPal, différées par un webhook à court
    // de budget (paypal.js, premierPaiement). Chacune est gardée par sa
    // transaction : la rejouer ne compte rien deux fois.
    if (quoi === 'paiement_suite') {
      const cle = String(e.cle || '');
      if (!cle) return 'incomplet';
      if (e.etape === 'parrainage') return (await parrainagePaiement(cle, 'paypal')) ? 'parrainage' : 'rien';
      if (e.etape === 'ambassadeur') return (await ambassadeurPaiement(cle, e.p || {})) ? 'ambassadeur' : 'rien';
      if (e.etape === 'attribution') return (await attributionPaiement(cle)) ? 'attribution' : 'rien';
      return 'etape_inconnue';
    }
    return 'tache_inconnue';
  }

  return { indicateursJour, envoyerPush, enFile, alerteKo, abonnes, planifies, serieReservee, profilsPage, logsPage, rafraichirProfil, apresHeuresCalmes, statsBadgesUn, statsBadgesFin,
    defisQuotidienCoach, coachsAvecCanal, coachsAvecAthletes, couvertureCoach, couvertureCles, couvertureUn, couvertureFin, couvertureRelancer, recalculerDefi, parrainageDemande, parrainagePaiement, parrainageSeuil,
    ambassadeurDemande, ambassadeursQuotidien, arrivee, evenement, lireDroits, majDroits, palierDroits, dejaPaye,
    crediterMoisOffert, ambassadeurPaiement, ambassadeurRemboursement, attributionPaiement,
    retirerMoisOffert, annulerAttribution, commissionVente,
    fixerBudget, reste, peutPousser, chiffrements, differer, pousserA, pousser1, tache, enfiler, enModeFile, abonnesPage,
    duelEvenement, duelCloturer, duelQuotidienUn, duelsActifs, reactionEvenement, reactionsAttente, reactionsPushUn, saisonsHeure, saisonsAuto, parcoursJ21, accueilRelances, retourUn, relancesCoachUn, canalProgrammesHeure, prospectRecevoir, vitrineVue, prospectsRelanceHeure, relanceAthlete, xpRecalculer, retentionUn, retentionFin, activiteComptes,
    lundiDe: (t, d) => L.lundiPlus(lundiParis(t), d || 0), liguesComptes, liguesUn, liguesFin, liguesEcritures, liguesApresSeance, liguesGroupes, liguesSamediUn, liguesLundiUn };
}
