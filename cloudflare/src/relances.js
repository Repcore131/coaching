// ══ LES RELANCES AUTOMATIQUES DU COACH (lot C3) — LE CALCUL, SANS BASE ═════
//
// Module PUR, éprouvé par cloudflare/test/relances.test.mjs. metier.js lit
// quelques champs, appelle ces fonctions, écrit ce qu'elles rendent.
//
// UNE RÈGLE = { actif, delai, moyen }, rangée sous son signal dans
// users/<coach>/relancesAuto.regles. Le coach les règle ; elles sont COUPÉES
// par défaut, et rien ici n'en allume une : actif vaut true ou rien.
//
// ⚠ CINQ SIGNAUX SEULEMENT, CEUX QUI ONT UN TEXTE (_waCorpsGroupe de l'app).
//   La douleur, le décrochage, la progression bloquée, le drapeau rouge et
//   les tâches du coach ne sont PAS dans cette liste, et aucune configuration
//   ne les y fait entrer : une clé inconnue est ignorée à la lecture.
// ⚠ AU PLUS UN MESSAGE AUTOMATIQUE PAR ATHLÈTE SUR SEPT JOURS GLISSANTS, tous
//   signaux confondus. Deux relances la même semaine, et l'athlète comprend
//   qu'il parle à une machine.
// ⚠ UN MESSAGE PAR ÉPISODE : un bilan en retard depuis trois semaines n'est
//   relancé qu'une fois. L'épisode est daté par `depuis` (le moment où le
//   signal s'est levé) : un nouveau retard repart de zéro.
// ⚠ JAMAIS WHATSAPP : ce moyen demande le geste du coach, par construction.

const J = 864e5;

// L'ordre dit lequel part quand deux signaux sont levés le même jour.
export const RELANCE_SIGNAUX = ['nostart', 'overdue', 'expiring', 'noprog', 'bilan'];
export const RELANCE_MOYENS = ['canal', 'push'];
export const RELANCE_DELAI_MAX = 14;
export const RELANCE_DELAI_DEFAUT = 2;
export const RELANCE_FENETRE_J = 7;
export const RELANCE_JOURNAL_J = 90;

// LE TEXTE EST CELUI DE L'APP (_waCorpsGroupe), mot pour mot. Le test
// relances.test.mjs le relit dans rc-core et tombe s'ils divergent.
export const RELANCE_CORPS = {
  overdue: 'je vois que ton bilan est en retard : tu peux le remplir quand tu veux dans l\'app 💪',
  nostart: 'je n\'ai pas encore ton premier bilan : dis-moi si tu bloques sur quelque chose, on démarre quand tu veux 💪',
  expiring: 'ton accès RepCore arrive bientôt à échéance : pense à le renouveler pour garder ton suivi 💪',
  bilan: 'j\'ai bien reçu ton bilan, je le regarde et je reviens vers toi rapidement 💪',
  noprog: 'je prépare ton programme, je te l\'envoie très vite 💪',
};

// PURE. Les règles lues, nettoyées : seules les cinq clés connues, actif
// strictement true, délai entier borné, moyen connu (sinon la notification).
export function reglesNormalisees(brut) {
  const src = (brut && typeof brut === 'object') ? brut : {};
  const out = {};
  for (const s of RELANCE_SIGNAUX) {
    const r = (src[s] && typeof src[s] === 'object') ? src[s] : {};
    const d = Math.round(Number(r.delai));
    out[s] = {
      actif: r.actif === true,
      delai: Number.isFinite(d) ? Math.max(0, Math.min(RELANCE_DELAI_MAX, d)) : RELANCE_DELAI_DEFAUT,
      moyen: RELANCE_MOYENS.indexOf(r.moyen) >= 0 ? r.moyen : 'push',
    };
  }
  return out;
}
// PURE. Une règle au moins peut-elle partir ? (interrupteur général compris)
export function relancesAllumees(cfg) {
  const c = (cfg && typeof cfg === 'object') ? cfg : {};
  if (c.pause === true) return false;
  const r = reglesNormalisees(c.regles);
  return RELANCE_SIGNAUX.some((s) => r[s].actif);
}

// PURE. Les signaux levés pour un athlète, avec le moment où chacun s'est
// levé. Les prédicats sont ceux de l'app (neverStarted, needsAlert,
// hasNewBilan, la ligne « accès », hasProgram) :
//   d = { bilans, createdAt, status, echeance, programme (bool) }
export function signauxRelance(d, t) {
  const x = d || {};
  const bilans = (Array.isArray(x.bilans) ? x.bilans : Object.values(x.bilans || {}))
    .filter((b) => b && Number(b.date) > 0);
  const out = {};
  if (!bilans.length) {
    const cree = Number(x.createdAt) || 0;
    if (t - cree > 3 * J) out.nostart = { depuis: cree + 3 * J };
  } else {
    let der = bilans[0];
    for (const b of bilans) if (Number(b.date) >= Number(der.date)) der = b;
    const dd = Number(der.date);
    if (t - dd > 14 * J) out.overdue = { depuis: dd + 14 * J };
    if (!der.reponseCoach) out.bilan = { depuis: dd, bilan: dd };
    const dep = bilans.filter((b) => b.type === 'depart').sort((a, b) => Number(a.date) - Number(b.date))[0];
    if (dep && x.programme === false) out.noprog = { depuis: Number(dep.date) };
  }
  const ech = Number(x.echeance) || 0;
  if (x.status === 'COACHING_SUIVI' && ech > t && ech - t < 14 * J) out.expiring = { depuis: ech - 14 * J };
  return out;
}

// PURE. La ligne reportée par le coach (isAlertSnoozed de l'app) : le coach a
// dit « pas maintenant », l'app ne relance pas à sa place.
export function reporteParCoach(st, signal, bilan, t) {
  if (!st || typeof st !== 'object') return false;
  if (st.until && t >= Number(st.until)) return false;
  if (signal === 'bilan' && bilan && st.seenUpTo && bilan > Number(st.seenUpTo)) return false;
  return true;
}

// PURE. Le journal d'un athlète en liste, du plus récent au plus ancien.
export function journalListe(brut) {
  const o = (brut && typeof brut === 'object') ? brut : {};
  return Object.keys(o).map((id) => Object.assign({ id }, o[id])).filter((e) => e && Number(e.at) > 0)
    .sort((a, b) => Number(b.at) - Number(a.at));
}

/**
 * PURE. Ce qui part pour UN athlète aujourd'hui : {signal, moyen, depuis} ou
 * {signal:null, raison}.
 *   o = { cfg (relancesAuto du coach), cleAthlete, signaux, journal (brut),
 *         reports ({type: entrée alertStatus}), t }
 */
export function choisirRelance(o) {
  const cfg = (o && o.cfg && typeof o.cfg === 'object') ? o.cfg : {};
  const t = Number(o && o.t) || 0;
  if (cfg.pause === true) return { signal: null, raison: 'pause' };
  const exclus = (cfg.exclus && typeof cfg.exclus === 'object') ? cfg.exclus : {};
  if (o && o.cleAthlete && exclus[o.cleAthlete]) return { signal: null, raison: 'exclu' };
  const regles = reglesNormalisees(cfg.regles);
  if (!RELANCE_SIGNAUX.some((s) => regles[s].actif)) return { signal: null, raison: 'coupe' };
  const journal = journalListe(o && o.journal);
  const partis = journal.filter((e) => e.statut === 'parti');
  if (partis.some((e) => t - Number(e.at) < RELANCE_FENETRE_J * J)) return { signal: null, raison: 'semaine' };
  const sig = (o && o.signaux) || {};
  const reports = (o && o.reports) || {};
  let raison = 'aucun_signal';
  for (const s of RELANCE_SIGNAUX) {
    const r = regles[s], x = sig[s];
    if (!r.actif || !x) continue;
    if (t - Number(x.depuis) < r.delai * J) { raison = 'delai'; continue; }
    if (reporteParCoach(reports[s], s, x.bilan, t)) { raison = 'reporte'; continue; }
    if (partis.some((e) => e.signal === s && Number(e.depuis) === Number(x.depuis))) { raison = 'deja'; continue; }
    return { signal: s, moyen: r.moyen, depuis: Number(x.depuis) };
  }
  return { signal: null, raison };
}

// PURE. Le texte envoyé : « Salut <prénom>, » puis le corps de l'app.
export function texteRelance(signal, prenom) {
  const p = String(prenom || '').trim().slice(0, 30);
  return (p ? 'Salut ' + p + ', ' : 'Salut ! ') + (RELANCE_CORPS[signal] || '');
}

// PURE. Les entrées à effacer : plus de RELANCE_JOURNAL_J jours.
export function journalAPurger(brut, t) {
  return journalListe(brut).filter((e) => t - Number(e.at) > RELANCE_JOURNAL_J * J).map((e) => e.id);
}
