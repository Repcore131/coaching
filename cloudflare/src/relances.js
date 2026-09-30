// ══ LES RELANCES AUTOMATIQUES DU COACH (lot C3) — LE CALCUL, SANS BASE ═════
//
// Module PUR, éprouvé par cloudflare/test/relances.test.mjs. metier.js lit
// quelques champs, appelle ces fonctions, écrit ce qu'elles rendent.
//
// UNE RÈGLE = { actif, delai, moyen }, rangée sous son signal dans
// users/<coach>/relancesAuto.regles. Le coach les règle ; elles sont COUPÉES
// par défaut, et rien ici n'en allume une : actif vaut true ou rien.
//
// ⚠ SIX SIGNAUX SEULEMENT, CEUX QUI ONT UN TEXTE PAR DÉFAUT (_waCorpsGroupe de
//   l'app pour les cinq premiers, RELANCE_CORPS_INACTIF pour l'inactivité).
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
// 'inactif' EN DERNIER : l'ordre des cinq premiers ne change pas.
export const RELANCE_SIGNAUX = ['nostart', 'overdue', 'expiring', 'noprog', 'bilan', 'inactif'];
export const RELANCE_MOYENS = ['canal', 'push'];
export const RELANCE_DELAI_MAX = 14;
export const RELANCE_DELAI_DEFAUT = 2;
export const RELANCE_FENETRE_J = 7;
export const RELANCE_JOURNAL_J = 90;
// L'INACTIVITÉ A SES PROPRES BORNES : son délai EST le signal (N jours sans
// séance ni bilan), et une semaine sans séance n'est pas encore un silence.
export const RELANCE_INACTIF = { min: 7, max: 21, defaut: 10 };
// PURE. Le délai d'un signal, borné selon le signal.
export function delaiBorne(signal, v) {
  const d = Math.round(Number(v));
  if (signal === 'inactif') return Number.isFinite(d) ? Math.max(RELANCE_INACTIF.min, Math.min(RELANCE_INACTIF.max, d)) : RELANCE_INACTIF.defaut;
  return Number.isFinite(d) ? Math.max(0, Math.min(RELANCE_DELAI_MAX, d)) : RELANCE_DELAI_DEFAUT;
}

// LE TEXTE EST CELUI DE L'APP (_waCorpsGroupe), mot pour mot. Le test
// relances.test.mjs le relit dans rc-core et tombe s'ils divergent.
export const RELANCE_CORPS = {
  overdue: 'je vois que ton bilan est en retard : tu peux le remplir quand tu veux dans l\'app 💪',
  nostart: 'je n\'ai pas encore ton premier bilan : dis-moi si tu bloques sur quelque chose, on démarre quand tu veux 💪',
  expiring: 'ton accès RepCore arrive bientôt à échéance : pense à le renouveler pour garder ton suivi 💪',
  bilan: 'j\'ai bien reçu ton bilan, je le regarde et je reviens vers toi rapidement 💪',
  noprog: 'je prépare ton programme, je te l\'envoie très vite 💪',
  // Celui-ci a une variable : {jours}, remplacée à l'envoi (relanceComposer).
  inactif: 'ça fait {jours} jours qu\'on ne t\'a pas vu à l\'entraînement : tout va bien ? Dis-moi si on doit adapter quelque chose.',
};

// PURE. Les règles lues, nettoyées : seules les cinq clés connues, actif
// strictement true, délai entier borné, moyen connu (sinon la notification).
export function reglesNormalisees(brut) {
  const src = (brut && typeof brut === 'object') ? brut : {};
  const out = {};
  for (const s of RELANCE_SIGNAUX) {
    const r = (src[s] && typeof src[s] === 'object') ? src[s] : {};
    out[s] = {
      actif: r.actif === true,
      delai: delaiBorne(s, r.delai),
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

// ── L'ÉCHÉANCE DU BILAN : LA RÈGLE DE L'APP (echeanceBilan), EN JOURS DE PARIS ──
// « dernier bilan + N semaines », arrondi au jour choisi le plus proche
// (±3 jours) ; la cadence du coach (d.cadence = {freq, jour}) prime sur la
// fréquence de l'athlète (d.freq, 2 par défaut), et sans cadence c'est le
// samedi. EN RETARD dès le lendemain de l'échéance.
const _fmtJour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
const _fmtHeure = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hour12: false });
const _jourParis = (t) => _fmtJour.format(new Date(t));
// Minuit à Paris d'une date « AAAA-MM-JJ », en ms (heure d'été comprise).
function _minuitParis(jour) {
  const [y, m, d] = jour.split('-').map(Number);
  const t0 = Date.UTC(y, m - 1, d);
  return t0 - (Number(_fmtHeure.format(new Date(t0))) % 24) * 3600e3;
}
const _decaler = (jour, n) => { const [y, m, d] = jour.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
export const BILAN_FREQS = [1, 2, 4];
// PURE. La cadence posée par le coach, bornée ; null si absente ou invalide.
export function cadenceValide(x) {
  if (!x || typeof x !== 'object') return null;
  const f = Number(x.freq), j = Number(x.jour);
  if (BILAN_FREQS.indexOf(f) < 0 || !Number.isInteger(j) || j < 0 || j > 6) return null;
  return { freq: f, jour: j };
}
/** PURE. {jour:'AAAA-MM-JJ' (l'échéance, à Paris), freq, jourSem, source}. */
export function echeanceBilanParis(dernierMs, cadence, freqAthlete) {
  const cad = cadenceValide(cadence);
  const fa = Number(freqAthlete);
  const freq = cad ? cad.freq : (BILAN_FREQS.indexOf(fa) >= 0 ? fa : 2);
  const jourSem = cad ? cad.jour : 6;
  const brut = _decaler(_jourParis(dernierMs), freq * 7);
  const [y, m, d] = brut.split('-').map(Number);
  let ecart = ((jourSem - new Date(Date.UTC(y, m - 1, d)).getUTCDay()) % 7 + 7) % 7;
  if (ecart > 3) ecart -= 7;
  return { jour: _decaler(brut, ecart), freq, jourSem, source: cad ? 'coach' : 'athlete' };
}
/** PURE. En retard à l'instant t ? {depuis (minuit à Paris du lendemain de l'échéance), echeance} ou null. */
export function retardBilan(dernierMs, cadence, freqAthlete, t) {
  const e = echeanceBilanParis(dernierMs, cadence, freqAthlete);
  if (_jourParis(t) <= e.jour) return null;
  return { depuis: _minuitParis(_decaler(e.jour, 1)), echeance: e.jour };
}

// PURE. Les signaux levés pour un athlète, avec le moment où chacun s'est
// levé. Les prédicats sont ceux de l'app (neverStarted, needsAlert,
// hasNewBilan, la ligne « accès », hasProgram) :
//   d = { bilans, createdAt, status, echeance, programme (bool),
//         cadence (bilanCadence du coach), freq (_bilanFreq de l'athlète),
//         derniereSeance (lastSession, ms), delaiInactif (jours) }
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
    // LA RÈGLE DE L'APP (needsAlert → echeanceBilan) : la cadence du coach,
    // sinon la fréquence de l'athlète et le samedi, en retard dès le lendemain.
    const rt = retardBilan(dd, x.cadence, x.freq, t);
    if (rt) out.overdue = { depuis: rt.depuis };
    // Répondu par écrit OU de vive voix (bilanRepondu de l'app).
    if (!der.reponseCoach && !(der.reponseAudio && der.reponseAudio.url)) out.bilan = { depuis: dd, bilan: dd };
    const dep = bilans.filter((b) => b.type === 'depart').sort((a, b) => Number(a.date) - Number(b.date))[0];
    if (dep && x.programme === false) out.noprog = { depuis: Number(dep.date) };
  }
  // L'INACTIVITÉ (dernierSigneDeVie de l'app) : au moins une séance, puis ni
  // séance ni bilan depuis delaiInactif jours. L'épisode est daté par la
  // dernière activité + le délai : une séance le referme, la suivante en ouvre un autre.
  const seance = Number(x.derniereSeance) || 0;
  if (seance > 0) {
    const derAct = bilans.reduce((m, b) => Math.max(m, Number(b.date) || 0), seance);
    const depuis = derAct + delaiBorne('inactif', x.delaiInactif) * J;
    if (t >= depuis) out.inactif = { depuis, jours: Math.floor((t - derAct) / J) };
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
    // Le délai de l'inactivité est déjà dans son signal : ne pas l'attendre deux fois.
    if (s !== 'inactif' && t - Number(x.depuis) < r.delai * J) { raison = 'delai'; continue; }
    if (reporteParCoach(reports[s], s, x.bilan, t)) { raison = 'reporte'; continue; }
    if (partis.some((e) => e.signal === s && Number(e.depuis) === Number(x.depuis))) { raison = 'deja'; continue; }
    return Object.assign({ signal: s, moyen: r.moyen, depuis: Number(x.depuis) }, x.jours != null ? { jours: x.jours } : {});
  }
  return { signal: null, raison };
}

// ── relanceTexte:debut
// LA MÊME FONCTION DANS L'APP (aperçu) ET DANS LE WORKER (envoi) : le test
// relances.test.mjs exécute celle de l'app et compare, cas par cas.
// PURE. « Salut <prénom>, » puis le texte du coach s'il est valable (1 à
// RELANCE_TEXTE_MAX caractères une fois nettoyé), sinon le texte par défaut.
// {prénom} et {jours} sont remplacés ; les caractères de contrôle et les
// chevrons disparaissent ; le résultat est tronqué s'il déborde encore.
const RELANCE_TEXTE_MAX = 280;
function relanceComposer(defaut, prenom, perso, vars) {
  const net = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  const p = net(prenom).slice(0, 30);
  const brut = typeof perso === 'string' ? net(perso) : '';
  let corps = (brut && brut.length <= RELANCE_TEXTE_MAX) ? brut : net(defaut);
  const v = (vars && typeof vars === 'object') ? vars : {};
  const j = Math.round(Number(v.jours));
  corps = net(corps.replace(/\{pr[ée]nom\}/gi, p).replace(/\{jours\}/gi, Number.isFinite(j) && j > 0 ? String(j) : 'quelques'));
  if (corps.length > RELANCE_TEXTE_MAX) corps = corps.slice(0, RELANCE_TEXTE_MAX - 1).trimEnd() + '…';
  return (p ? 'Salut ' + p + ', ' : 'Salut ! ') + corps;
}
// ── relanceTexte:fin
export { relanceComposer, RELANCE_TEXTE_MAX };
// PURE. Les textes du coach (relancesAuto.textes), nettoyés : un par signal connu.
export function textesNormalises(brut) {
  const src = (brut && typeof brut === 'object') ? brut : {};
  const out = {};
  for (const s of RELANCE_SIGNAUX) if (typeof src[s] === 'string' && src[s].trim()) out[s] = src[s];
  return out;
}
// PURE. Le texte envoyé : « Salut <prénom>, » puis le texte du coach (perso)
// s'il est valable, sinon le texte par défaut ; vars = { jours }.
export function texteRelance(signal, prenom, perso, vars) {
  return relanceComposer(RELANCE_CORPS[signal] || '', prenom, perso, vars);
}

// PURE. Les entrées à effacer : plus de RELANCE_JOURNAL_J jours.
export function journalAPurger(brut, t) {
  return journalListe(brut).filter((e) => t - Number(e.at) > RELANCE_JOURNAL_J * J).map((e) => e.id);
}
