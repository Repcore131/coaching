// ══ LE POULS DU WORKER : LES 429 SERVIS, ET L'ALERTE DE QUOTA ══════════════
//
// Chaque route publique est limitée par adresse IP (wrangler.toml,
// [[ratelimits]]). Un 429 isolé est un script qui boucle et que l'on arrête ;
// des centaines par heure disent autre chose — une attaque répartie, ou un
// bug de l'app qui martèle le serveur — et le créateur doit le savoir avant
// que le quota du plan gratuit ne tombe.
//
// LE COMPTE. Chaque instance du Worker compte ses 429 en mémoire (noter429) ;
// au plus une fois par minute, elle ajoute ce compte au seau de l'heure UTC,
// worker/pouls_429/<AAAAMMJJHH>, par transaction (viderPouls). Une instance
// recyclée perd au plus une minute de compte : c'est une alerte, pas une
// facture.
//
// L'ALERTE. La tâche de la minute lit le seau de l'heure (surveillerQuota) :
// au-delà de SEUIL_429_HEURE, un push urgent au créateur, UN par heure —
// worker/pouls_alerte/<heure>, posé par transaction, l'empêche de recommencer.
//
// LE MÉNAGE, à la demie de chaque heure : les seaux de plus de 48 h ; et à
// 03:30 UTC, les jours posés DANS LE FUTUR sous /metrics et /attribution. La règle ne peut
// pas borner la date d'une clé à « aujourd'hui à un jour près » — le langage
// des règles n'a aucune fonction de date — alors on retire ici ce qu'un
// script aurait écrit pour un jour qui n'existe pas encore.
//
// LE BUDGET. Le réveil de la minute (planif.js) garde 38 requêtes sur les 50
// du plan gratuit ; ce qui suit en prend 3 d'ordinaire (vidage, lecture du
// seau), 4 de plus l'heure d'une alerte, et au plus 2 lectures + 3 effacements
// au ménage — MENAGE_MAX borne les effacements d'un passage.
import { CLE_CREATEUR_PUSH } from './metier.js';

export const SEUIL_429_HEURE = 500;
const VIDAGE_MS = 60 * 1000;
const JOUR_MS = 24 * 60 * 60 * 1000;
const MENAGE_MAX = 3;

let enAttente = 0;
let dernierVidage = 0;

// L'heure UTC d'un instant : AAAAMMJJHH (trie dans l'ordre chronologique).
export const heureUTC = (t) => new Date(t).toISOString().slice(0, 13).replace(/[-T]/g, '');
const jourUTC = (t) => new Date(t).toISOString().slice(0, 10);

// Un 429 vient d'être servi. Rend vrai si le compte est mûr pour être versé.
export function noter429(t) {
  enAttente++;
  return t - dernierVidage >= VIDAGE_MS;
}
// Pour les tests seulement.
export function _reinitPouls() { enAttente = 0; dernierVidage = 0; }
export const _enAttente = () => enAttente;

// Verse le compte en mémoire dans le seau de l'heure. Un échec le rend à la
// mémoire : il partira au vidage suivant.
export async function viderPouls(db, t) {
  const n = enAttente;
  if (!n) return 0;
  enAttente = 0;
  dernierVidage = t;
  try {
    await db.ref('worker/pouls_429/' + heureUTC(t)).transaction((v) => (Number(v) || 0) + n);
  } catch (e) {
    enAttente += n;
    return 0;
  }
  return n;
}

// La tâche de la minute : l'alerte, et le ménage de 03:00 UTC.
export async function surveillerQuota({ db, M, t }) {
  const h = heureUTC(t);
  const bilan = { heure: h, n429: 0, alerte: false };
  bilan.n429 = Number(await db.ref('worker/pouls_429/' + h).get().then((s) => s.val()).catch(() => 0)) || 0;
  if (bilan.n429 > SEUIL_429_HEURE) {
    const pose = await db.ref('worker/pouls_alerte/' + h).transaction((v) => (v ? undefined : t));
    if (pose.committed) {
      bilan.alerte = true;
      await M.envoyerPush(CLE_CREATEUR_PUSH, { type: 'admin', url: './', tag: 'quota-429-' + h,
        title: 'Serveur : trafic refusé en masse',
        body: bilan.n429 + ' requêtes refusées (429) depuis le début de l’heure. Une attaque, ou l’app qui boucle : à regarder.' },
        { urgent: true }).catch(() => null);
    }
  }
  const d = new Date(t);
  if (d.getUTCMinutes() === 30) bilan.menage = await menage(db, t, d.getUTCHours() === 3).catch(() => null);
  return bilan;
}

// Rend { seaux, futurs } : ce qui a été effacé. MENAGE_MAX au plus, le reste
// attend le passage suivant.
export async function menage(db, t, futurs) {
  const r = { seaux: 0, futurs: 0 };
  let reste = MENAGE_MAX;
  const effacer = async (chemin, cle) => { await db.ref(chemin + '/' + cle).remove(); reste--; };
  const vieux = heureUTC(t - 2 * JOUR_MS);
  for (const n of ['worker/pouls_429', 'worker/pouls_alerte']) {
    if (reste <= 0) break;
    for (const k of (await db.ref(n).shallow()).sort()) {
      if (reste <= 0 || k >= vieux) break;
      await effacer(n, k); r.seaux++;
    }
  }
  if (!futurs) return r;
  // Demain (UTC) est encore admis : un appareil à l'est de Greenwich y est déjà.
  const demain = jourUTC(t + JOUR_MS);
  for (const n of ['metrics', 'attribution/jours']) {
    if (reste <= 0) break;
    for (const k of (await db.ref(n).shallow()).sort().reverse()) {
      if (reste <= 0 || k <= demain) break;
      await effacer(n, k); r.futurs++;
    }
  }
  return r;
}
