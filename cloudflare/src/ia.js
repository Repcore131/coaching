// ══ LE SOCLE IA, CÔTÉ SERVEUR (05/10/2026) ════════════════════════════════
//
// Rien n'est encore branché dans l'app : ce module pose le chemin par lequel
// TOUTE proposition rédigée par Claude passera — un seul point d'entrée
// (APPELS.ia, /fn/ia), un seul compteur, un seul journal.
//
//   ia({tache, athlete?, charge})  → {ok, proposition, journalId, coutMois, plafond}
//   iaRetour({journalId, statut, distance})  → le coach a validé, modifié ou rejeté
//
// CE QUI EST GARANTI ICI, ET NULLE PART AILLEURS :
//   · l'appelant est authentifié (appels.js) et, s'il nomme un athlète, il en
//     est le coach — même contrôle que medias.js (users/<a>/coachEmailKey ET
//     coachs/<coach>/clients/<a>) ;
//   · l'interrupteur : IA_COUPEE = '1', ou pas de clé → 503, sans appel ;
//   · le quota du mois, en micro-dollars (ia_quota/<compte>/<AAAA-MM>), selon
//     l'offre lue côté SERVEUR (coachs_registre, droits/ : des nœuds que
//     l'utilisateur ne peut pas écrire) ;
//   · la réponse est STRUCTURÉE (output_config.format, schéma JSON par tâche)
//     et le stop_reason est toujours lu : 'refusal' ou 'max_tokens' rendent
//     {ok:false, raison}, jamais un texte partiel ;
//   · rien n'est écrit sous users/ : une proposition reste une proposition,
//     c'est l'app qui l'envoie, après relecture du coach.
//
// ⚠ LA CLÉ (ANTHROPIC_API_KEY) N'EXISTE QUE DANS LE SECRET DU WORKER. Elle
//   n'est ni journalisée, ni renvoyée, ni écrite dans la base.

import Anthropic from '@anthropic-ai/sdk';
import { ErreurAppel } from './appels.js';
import { planEffectif, moisParis } from './quota-coach.js';

const SONNET = 'claude-sonnet-5-5';
const HAIKU = 'claude-haiku-4-5';

// Les tâches, et le modèle qui les sert. Sonnet 5.5 pour ce qui demande du
// jugement (lire un bilan, un import, construire un programme) ; Haiku 4.5
// pour le court et le fréquent.
export const TACHES = Object.freeze({
  bilan: SONNET, hebdo: SONNET, import: SONNET, programme: SONNET, relance: SONNET,
  repas: HAIKU, relance_courte: HAIKU,
});
// L'effort sur Sonnet 5.5 : 'low' pour la rédaction, 'medium' pour ce qui se
// construit (un import à lire, un programme à bâtir).
const EFFORT = Object.freeze({ bilan: 'low', hebdo: 'low', relance: 'low', import: 'medium', programme: 'medium' });

/**
 * PURE. Le modèle et ses réglages pour une tâche, ou null si elle est inconnue.
 * Sonnet 5.5 : réflexion adaptative (son défaut), effort par tâche, et le
 * repli côté serveur (fallbacks:'default') quand un classifieur décline.
 * Haiku 4.5 : ni effort ni réflexion — il ne connaît ni l'un ni l'autre.
 * @param {string} tache
 */
export function routeIA(tache) {
  const model = Object.prototype.hasOwnProperty.call(TACHES, tache) ? TACHES[tache] : null;
  if (!model) return null;
  if (model === HAIKU) return { model, max_tokens: 4096, effort: null };
  return { model, max_tokens: 16000, effort: EFFORT[tache], thinking: { type: 'adaptive' },
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
}

// Les plafonds du mois, en MICRO-DOLLARS (1 000 000 µ$ = 1 $). Un coach Libre
// n'a pas d'assistant ; un athlète n'en a qu'en Ultime.
export const IA_PLAFONDS = Object.freeze({ libre: 0, coach: 3000000, pro: 10000000, ultime: 1000000 });

// Les prix, en $ par million de jetons : entrée, sortie, lecture de cache.
// Un million de jetons à 1 $ = 1 µ$ par jeton : le coût en µ$ est donc
// jetons × prix, sans conversion. claude-opus-4-8 : le modèle que le repli
// côté serveur peut servir à la place de Sonnet 5.5 (fallbacks:'default') ;
// un modèle inconnu est compté au prix le plus haut de la table.
export const PRIX = Object.freeze({
  [SONNET]: Object.freeze({ entree: 2, sortie: 10, cache: 0.2 }),
  [HAIKU]: Object.freeze({ entree: 1, sortie: 5, cache: 0.1 }),
  'claude-opus-4-8': Object.freeze({ entree: 5, sortie: 25, cache: 0.5 }),
});
const PRIX_INCONNU = PRIX['claude-opus-4-8'];

/**
 * PURE. Le coût d'un appel, en micro-dollars entiers (arrondi au supérieur :
 * le quota ne sous-compte jamais).
 * @param {string} modele
 * @param {{input_tokens?:number, output_tokens?:number, cache_read_input_tokens?:number}} usage
 */
export function coutMicro(modele, usage) {
  const p = PRIX[modele] || PRIX_INCONNU, u = usage || {};
  const n = (x) => Math.max(0, Number(x) || 0);
  return Math.ceil(n(u.input_tokens) * p.entree + n(u.cache_read_input_tokens) * p.cache + n(u.output_tokens) * p.sortie);
}

// LES SCHÉMAS DE RÉPONSE, un par tâche. Tous stricts : chaque champ est requis,
// rien d'autre n'est admis — c'est ce qui rend la sortie lisible sans deviner.
const texte = { type: 'string' };
const listeTextes = { type: 'array', items: texte };
const objet = (props) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });
const SERIE = objet({ exercice: texte, series: { type: 'integer' }, repetitions: texte, repos_s: { type: 'integer' }, note: texte });
const SEANCE = objet({ nom: texte, exercices: { type: 'array', items: SERIE } });
export const SCHEMAS = Object.freeze({
  bilan: objet({ resume: texte, points_forts: listeTextes, points_attention: listeTextes, message_athlete: texte }),
  hebdo: objet({ resume: texte, tendances: listeTextes, message_athlete: texte }),
  import: objet({ seances: { type: 'array', items: SEANCE }, illisible: listeTextes }),
  programme: objet({ titre: texte, seances: { type: 'array', items: SEANCE }, notes: texte }),
  relance: objet({ message: texte }),
  relance_courte: objet({ message: texte }),
  repas: objet({ aliments: { type: 'array', items: objet({ nom: texte, grammes: { type: 'number' } }) }, kcal: { type: 'number' } }),
});

// LES CONSIGNES, une par tâche. Courtes : le contexte précis arrive dans la charge.
const SOCLE = 'Tu assistes un coach sportif francophone dans RepCore. Tu proposes, le coach décide : '
  + 'ta réponse sera relue avant tout envoi. Tu écris en français, en tutoyant l’athlète, sans diagnostic médical. '
  + 'Si une donnée manque, dis-le plutôt que de l’inventer.';
const CONSIGNES = Object.freeze({
  bilan: 'Lis le bilan fourni et propose une réponse du coach : un résumé, ce qui progresse, ce qui demande attention, puis le message à l’athlète.',
  hebdo: 'Résume la semaine d’entraînement fournie : les faits, les tendances, et un court message à l’athlète.',
  import: 'Transcris le programme fourni (texte collé ou lu) en séances structurées. Ce que tu ne peux pas lire va dans « illisible ».',
  programme: 'Propose un programme à partir du profil et des contraintes fournis. Reste dans les volumes et fréquences indiqués.',
  relance: 'Rédige un message de relance bienveillant pour l’athlète, à partir du contexte fourni. Pas de culpabilisation.',
  relance_courte: 'Rédige une relance d’une ou deux phrases pour l’athlète, à partir du contexte fourni.',
  repas: 'Décris le repas fourni en aliments et grammes estimés, et donne le total de kilocalories.',
});

// La charge envoyée par l'app : un texte, ou un objet sérialisé. Bornée : au-delà,
// c'est une erreur de l'appelant, pas une raison de payer.
export const CHARGE_MAX = 60000;
const IA_JOURNAL_J = 90;
const J = 86400000;
const ID_JOURNAL_RE = /^[A-Za-z0-9_-]{1,40}$/;
const cleEmail = (e) => String(e || '').toLowerCase().replace(/\./g, ',');

// Le palier d'un athlète au sens de l'IA : Ultime, ou rien. Mêmes champs que
// les règles (exercices) : palier ultime non échu, ultimeJusqu, bonusUltimeFin.
function athleteUltime(d, t) {
  if (!d || typeof d !== 'object') return false;
  const ech = Number(d.echeance) || 0;
  if (d.palier === 'ultime' && (ech === 0 || ech > t)) return true;
  return Number(d.ultimeJusqu) > t || Number(d.bonusUltimeFin) > t;
}
/** PURE. L'offre qui fixe le plafond : coach (libre/coach/pro), sinon ultime ou rien. */
export function offreIA(registre, droits, t) {
  if (registre && typeof registre === 'object') return planEffectif(registre, t);
  return athleteUltime(droits, t) ? 'ultime' : 'aucune';
}
export const plafondDe = (offre) => (Object.prototype.hasOwnProperty.call(IA_PLAFONDS, offre) ? IA_PLAFONDS[offre] : 0);

/** PURE. Les entrées du journal de plus de 90 jours : leurs identifiants. */
export function journalIAAPurger(brut, t) {
  const o = brut && typeof brut === 'object' ? brut : {};
  return Object.keys(o).filter((id) => o[id] && t - Number(o[id].t) > IA_JOURNAL_J * J);
}

/**
 * PURE. La proposition d'une réponse de l'API, ou {ok:false, raison}. Le
 * stop_reason est lu AVANT le contenu : un refus ou une réponse coupée ne
 * rendent jamais de texte partiel.
 */
export function lireReponse(r) {
  const stop = r && r.stop_reason;
  if (stop === 'refusal') return { ok: false, raison: 'refus' };
  if (stop === 'max_tokens') return { ok: false, raison: 'coupee' };
  if (stop !== 'end_turn' && stop !== 'stop_sequence') return { ok: false, raison: 'inattendue' };
  const bloc = ((r && r.content) || []).filter((b) => b && b.type === 'text').pop();
  if (!bloc) return { ok: false, raison: 'vide' };
  try { return { ok: true, proposition: JSON.parse(bloc.text) }; } catch (e) { return { ok: false, raison: 'illisible' }; }
}

// L'appelant est le coach de l'athlète : désigné par le dossier ET inscrit
// dans sa propre liste. Même contrôle que medias.js (verifierAcces).
async function verifierCoach(db, kMoi, kAthlete) {
  const lire = async (c) => (await db.ref(c).get()).val();
  const [coachDeclare, inscrit] = await Promise.all([
    lire('users/' + kAthlete + '/coachEmailKey'), lire('coachs/' + kMoi + '/clients/' + kAthlete)]);
  if (String(coachDeclare || '').toLowerCase() !== kMoi || inscrit !== true)
    throw new ErreurAppel(403, 'Cet athlète n’est pas dans ta liste.');
}

/**
 * @param {{env:any, db:any, fetchImpl?:Function, maintenant?:() => number}} o
 */
export function creerIA({ env, db, fetchImpl, maintenant }) {
  const now = maintenant || Date.now;
  const cle = String((env && env.ANTHROPIC_API_KEY) || '').trim();
  const coupee = String((env && env.IA_COUPEE) || '').trim() === '1' || !cle;
  // LE FETCH INJECTÉ : celui du Worker compte les sous-requêtes (outils),
  // celui des tests imite /v1/messages. Une seule nouvelle tentative : le
  // budget d'une requête est de 44 sous-requêtes.
  const client = coupee ? null : new Anthropic({ apiKey: cle, fetch: fetchImpl, maxRetries: 1, timeout: 120000 });

  async function appeler({ auth, data }) {
    const d = data && typeof data === 'object' ? data : {};
    const tache = String(d.tache || '');
    const route = routeIA(tache);
    if (!route) throw new ErreurAppel(400, 'Tâche inconnue.');
    if (coupee) throw new ErreurAppel(503, 'L’assistant est en pause.');
    const t = now();
    const kMoi = cleEmail(auth && auth.email);
    let kAthlete = null;
    if (d.athlete != null && d.athlete !== '') {
      kAthlete = String(d.athlete);
      if (!/^[^/.#$\[\]]{1,200}$/.test(kAthlete)) throw new ErreurAppel(400, 'Athlète invalide.');
      if (kAthlete !== kMoi) await verifierCoach(db, kMoi, kAthlete);
    }
    const charge = typeof d.charge === 'string' ? d.charge : JSON.stringify(d.charge == null ? '' : d.charge);
    if (!charge || charge.length > CHARGE_MAX) throw new ErreurAppel(400, 'Contenu vide ou trop long.');
    // LE QUOTA : l'offre lue dans les nœuds du serveur, la consommation du mois.
    const mois = moisParis(t);
    const lire = async (c) => (await db.ref(c).get()).val();
    const [registre, droits, conso] = await Promise.all([
      lire('coachs_registre/' + kMoi), lire('droits/' + kMoi), lire('ia_quota/' + kMoi + '/' + mois)]);
    const plafond = plafondDe(offreIA(registre, droits, t));
    if ((Number(conso) || 0) >= plafond) throw new ErreurAppel(429, 'Quota IA du mois atteint.');

    const corps = {
      model: route.model, max_tokens: route.max_tokens,
      system: SOCLE + '\n\n' + CONSIGNES[tache],
      messages: [{ role: 'user', content: charge }],
      output_config: Object.assign({ format: { type: 'json_schema', schema: SCHEMAS[tache] } },
        route.effort ? { effort: route.effort } : {}),
    };
    let r;
    try {
      r = route.betas
        ? await client.beta.messages.create(Object.assign(corps, { thinking: route.thinking, betas: route.betas, fallbacks: route.fallbacks }))
        : await client.messages.create(corps);
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new ErreurAppel(503, 'L’assistant est très demandé : réessaie dans un instant.');
      if (e instanceof Anthropic.APIError) throw new ErreurAppel(502, 'L’assistant n’a pas répondu.');
      throw e;
    }
    // LE COÛT EST COMPTÉ MÊME QUAND LA RÉPONSE NE SERT PAS : un refus ou une
    // réponse coupée ont été facturés. Top-level usage : l'essai qui a produit
    // la réponse (sur repli, le modèle de repli et ses prix).
    const modele = String((r && r.model) || route.model);
    const usage = (r && r.usage) || {};
    const cout = coutMicro(modele, usage);
    const tx = await db.ref('ia_quota/' + kMoi + '/' + mois).transaction((v) => (Number(v) || 0) + cout);
    const coutMois = Number(tx && tx.snapshot && tx.snapshot.val()) || (Number(conso) || 0) + cout;
    const lu = lireReponse(r);
    // LE JOURNAL : une ligne par appel. 'propose' seulement si une proposition
    // part vers l'app ; un échec est noté comme tel, sans texte.
    const ref = db.ref('ia_journal/' + kMoi).push();
    await ref.set(Object.assign({ t, tache, modele, tin: Number(usage.input_tokens) || 0, tout: Number(usage.output_tokens) || 0,
      cout, statut: lu.ok ? 'propose' : 'echec' }, kAthlete ? { athlete: kAthlete } : {}, lu.ok ? {} : { raison: lu.raison }));
    if (!lu.ok) return { ok: false, raison: lu.raison, journalId: ref.key, coutMois, plafond };
    return { ok: true, proposition: lu.proposition, journalId: ref.key, coutMois, plafond };
  }

  // LE RETOUR DU COACH : ce qu'il a fait de la proposition, et de combien le
  // texte envoyé s'en écarte (0 : tel quel, 1 : tout réécrit).
  async function retour({ auth, data }) {
    const d = data && typeof data === 'object' ? data : {};
    const kMoi = cleEmail(auth && auth.email);
    const id = String(d.journalId || '');
    if (!ID_JOURNAL_RE.test(id)) throw new ErreurAppel(400, 'Entrée de journal invalide.');
    const statut = String(d.statut || '');
    if (['valide', 'modifie', 'rejete'].indexOf(statut) < 0) throw new ErreurAppel(400, 'Statut invalide.');
    const distance = Number(d.distance);
    if (!(distance >= 0 && distance <= 1)) throw new ErreurAppel(400, 'Distance invalide (0 à 1).');
    const chemin = 'ia_journal/' + kMoi + '/' + id;
    const e = (await db.ref(chemin).get()).val();
    if (!e) throw new ErreurAppel(404, 'Entrée de journal introuvable.');
    await db.ref(chemin).update({ statut, distance: Math.round(distance * 1000) / 1000, retourLe: now() });
    return { ok: true };
  }

  // LA PURGE DE LA NUIT, compte par compte (planif.js) : plus de 90 jours.
  async function purgerUn(k, t) {
    const brut = (await db.ref('ia_journal/' + k).get()).val();
    const vieux = journalIAAPurger(brut, t);
    if (!vieux.length) return 0;
    const maj = {};
    for (const id of vieux) maj['ia_journal/' + k + '/' + id] = null;
    await db.ref().update(maj);
    return vieux.length;
  }

  return { appeler, retour, purgerUn };
}
