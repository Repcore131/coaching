// ══ LA MINUTE DU SERVEUR LÉGER ═══════════════════════════════════════════
//
// Cloudflare réveille le Worker chaque minute (une seule tâche programmée :
// le plan gratuit en autorise cinq). À chaque réveil, avec un BUDGET de
// requêtes (le plan gratuit en permet 50 par exécution, on s'arrête avant) :
//
//   0. le VERROU : un bail de 55 s dans /worker/verrou. Deux exécutions (la
//      minute et un /reveil de l'app) ne traitent jamais la file ensemble ;
//   1. les événements déposés par l'app (/evenements) et les sous-tâches que
//      le Worker s'est laissées (type « tache »), dans l'ordre des clés ;
//   2. les travaux du jour dont l'heure est passée (heure de Paris), repris
//      là où le réveil précédent s'est arrêté : /worker/jobs/<nom> garde le
//      jour, le curseur et, pour la rareté des badges, les comptes en cours.
//      TOUT /worker/jobs EST LU EN UN GET, et seuls les travaux dont l'état a
//      changé sont réécrits, en UN update multi-chemins à la fin — le même
//      qui rend le verrou. Un travail déjà fini ne coûte plus rien.
//
// LA FENÊTRE DE 21 H (01/10/2026). Les travaux qui envoient sans attendre
// (`fenetre: true` : serie, retour, bilan, wrapped, badge, duels) s'arrêtent
// à 21 h : après, envoyerPush les écarterait (heures calmes) et l'athlète
// serait compté « traité » sans avoir rien reçu. Une liste inachevée n'est
// PAS déclarée finie : son état reçoit `sautes` (les clés restantes) et une
// ligne { type: 'travail_incomplet' } entre dans /evenements_ko.
//
// LES PROFILS (worker/profils/<uid>, `profils: true`). Les rappels lisaient
// trois à cinq champs par athlète, y compris pour tous ceux qu'on ne relance
// pas. Les profils se lisent PAR PAGES de PAGE_PROFILS (une requête), sont
// filtrés en mémoire, et l'athlète écarté ne coûte plus rien (metier.js,
// « LES PROFILS DE RELANCE »).
//
// UN TRAVAIL MANQUÉ SE RATTRAPE : la condition est « l'heure est passée
// aujourd'hui et ce n'est pas fini », pas « il est exactement 18 h 00 ».
//
// UN ÉVÉNEMENT QUI ÉCHOUE NE BLOQUE RIEN : il repart en fin de file avec un
// compteur d'essais ; au cinquième échec, il est rangé dans /evenements_ko
// (écran Ambassadeurs de l'administrateur) et retiré de la file.

import { paris, idFile } from './metier.js';

// ══ LE MODE FILE (plan payant, FILE_PUSH='queue' : docs/capacite.md) ══════
// Les travaux PAR ATHLÈTE (`parAthlete` : acces, serie, bilan, wrapped,
// badge, retour) ne traitent plus les athlètes dans le réveil : ils lisent
// les abonnés par pages de PAGE_FILE (une requête) et ENFILENT un message par
// athlète ({quoi:'planifie', nom, uid}) dans Cloudflare Queues. Le
// consommateur (consommerLot, appelé par queue() dans index.js) fait le
// travail de l'athlète, comme le réveil l'aurait fait. Sans file (plan
// gratuit), rien ne change.
export const PAGE_FILE = 500;

export const BUDGET = 38;          // requêtes par réveil (plafond Cloudflare : 50)
export const VERROU_MS = 55e3;     // le bail : moins que la minute entre deux réveils
export const REVEIL_MIN_MS = 30e3; // /reveil ne relance pas une file traitée il y a moins
export const ESSAIS_MAX = 5;
const LOT = 25;                    // événements lus d'un coup (une requête)
export const PAGE_PROFILS = 200;   // profils lus d'un coup (une requête)
export const FIN_FENETRE = 21;     // heure de Paris où s'arrêtent les travaux `fenetre`
const avantFenetre = (p) => p.heure < FIN_FENETRE;
// Le bail se rend dans l'update final s'il reste à coup sûr à nous (bien
// avant son échéance) ; sinon par transaction, comme avant.
const RENDU_DIRECT_MS = 40e3;
const apres = (p, h, m) => p.heure * 60 + p.minute >= h * 60 + m;
// Les coachs qui ont des athlètes : les clés de l'annuaire (une lecture).
const db_coachs = (M) => (M.coachsAvecAthletes ? M.coachsAvecAthletes() : []);
// Une relance lit une vingtaine de champs au pire : elle attend le réveil
// suivant plutôt que de dépasser le plafond de Cloudflare.
const COUT_RELANCE = 24;
// La fin de séance recalcule les volts ET rafraîchit le profil de relance
// (sept champs, une écriture) : elle attend d'avoir de quoi faire les deux.
// +6 depuis les ligues (01/10/2026) : la ligne du groupe, ou l'entrée d'un
// compte hors ligue (dossier, index, transaction, pseudo).
const COUT_SEANCE = 28;
// Un orphelin PayPal rejoué : un paiement peut ouvrir l'accès et créditer un
// parrain. S'il manque de budget en route, paypal.js lève AVANT d'écrire, et
// il reste en file (voir la boucle ci-dessous).
const COUT_ORPHELIN = 16;
// La reprise d'un premier paiement annulé (mois offert, attribution, accès,
// journal) : mesurée ~26 requêtes.
const COUT_REPRISE = 30;
// L'alerte d'un événement en échec : la garde horaire (transaction : 2) et
// un push urgent (abonnements, un envoi par appareil).
const COUT_ALERTE_KO = 8;

export function travaux(M) {
  return [
    { nom: 'stats_badges', quand: (p) => apres(p, 3, 17), cles: () => M.coachsEtUsers(), un: (c, t, acc) => M.statsBadgesUn(c, acc), fin: M.statsBadgesFin, cout: 3 },
    // Le 1er du mois : l'idempotence PayPal de plus de 90 jours.
    { nom: 'purge_paypal', quand: (p) => p.date === 1 && apres(p, 4, 10), une: (t) => (M.paypal ? M.paypal.purgerEvenements(t) : null) },
    { nom: 'ambassadeurs', quand: (p) => apres(p, 6, 20), une: M.ambassadeursQuotidien },
    // Les coachs qui ont résilié : leur palier se referme à la fin payée.
    // LES RÉSILIATIONS ARRIVÉES À DATE (02/10/2026) : l'abonnement est annulé
    // chez PayPal trois jours avant la date d'effet (paypal.js, resiliationsDues).
    { nom: 'resiliations', quand: (p) => apres(p, 5, 45), une: (t) => (M.paypal ? M.paypal.resiliationsDues(t) : null) },
    { nom: 'fins_coachs', quand: (p) => apres(p, 6, 0), une: () => (M.paypal ? M.paypal.finsCoachs() : null) },
    // LES INDICATEURS DU CRÉATEUR (02/10/2026) : MRR, résiliés, churn… écrits
    // chaque jour dans indicateurs/<AAAA-MM-JJ>, après les fins du jour.
    { nom: 'indicateurs', quand: (p) => apres(p, 6, 50), une: (t) => (M.indicateursJour ? M.indicateursJour(t) : null) },
    // LE QUOTA D'UN COACH, APPLIQUÉ (02/10/2026) : après fins_coachs, qui remet
    // en Libre un coach dont l'abonnement est fini. Voir metier.js couvertureCoach.
    { nom: 'couverture_coachs', quand: (p) => apres(p, 6, 30), cles: () => (M.couvertureCles ? M.couvertureCles() : []),
      un: (k, t, acc) => (M.couvertureUn ? M.couvertureUn(k, t, acc) : null), fin: (acc, t) => (M.couvertureFin ? M.couvertureFin(acc, t) : null), cout: 7 },
    // « Ton accès se termine dans N jours », une fois par échéance.
    { nom: 'acces', quand: (p) => apres(p, 11, 0) && p.heure < 21, cles: () => M.abonnes(), un: M.planifies.acces, cout: 12, push: true, profils: true, parAthlete: true },
    // Les messages mis de côté pour la nuit : CHAQUE HEURE (01/10/2026), car
    // le matin est celui de l'athlète, dans son fuseau (8 h à Montréal, c'est
    // 14 h à Paris). Chacun part quand SES heures calmes sont finies.
    { nom: 'attente', heure: true, quand: () => true, une: M.apresHeuresCalmes },
    { nom: 'defis', quand: (p) => apres(p, 9, 0), cles: () => M.coachsAvecCanal(), un: (c, t) => M.defisQuotidienCoach(c, t), cout: 8 },
    // Série en danger : jeudi DÈS 17 H (18 h jusqu'au 01/10/2026) — trois
    // heures de fenêtre et non plus deux : voir README, « Charge ».
    { nom: 'serie', quand: (p) => p.joursem === 4 && apres(p, 17, 0) && avantFenetre(p), cles: () => M.abonnes(), un: M.planifies.serie, cout: 15, push: true, fenetre: true, profils: true, parAthlete: true },
    // LE DERNIER APPEL DU SAMEDI, 10 h (01/10/2026) : la série encore en danger,
    // pour qui ne s'est pas entraîné depuis jeudi 18 h.
    { nom: 'serie_sam', quand: (p) => p.joursem === 6 && apres(p, 10, 0) && avantFenetre(p), cles: () => M.abonnes(), un: M.planifies.serieSamedi, cout: 15, push: true, fenetre: true, profils: true, parAthlete: true },
    { nom: 'bilan', quand: (p) => p.joursem === 6 && apres(p, 10, 0) && avantFenetre(p), cles: () => M.abonnes(), un: M.planifies.bilan, cout: 12, push: true, fenetre: true, parAthlete: true },
    { nom: 'wrapped', quand: (p) => p.date === 1 && apres(p, 10, 0) && avantFenetre(p), cles: () => M.abonnes(), un: M.planifies.wrapped, cout: 10, push: true, fenetre: true, profils: true, parAthlete: true },
    { nom: 'badge', quand: (p) => p.joursem === 0 && apres(p, 17, 0) && avantFenetre(p), cles: () => M.abonnes(), un: M.planifies.badge, cout: 10, push: true, fenetre: true, parAthlete: true },
    // LA VEILLE D'UN CRÉNEAU (02/10/2026), 19 h 30 : « Demain : Haut du corps »,
    // et le record à portée s'il y en a un. Deux par semaine au plus.
    { nom: 'veille', quand: (p) => apres(p, 19, 30) && avantFenetre(p), cles: () => M.abonnes(), un: M.planifies.veille, cout: 14, push: true, fenetre: true, profils: true, parAthlete: true },
    // Les duels suivis (/duels_actifs) : le push de J-2, la clôture, l'oubli.
    { nom: 'duels', quand: (p) => apres(p, 18, 30) && avantFenetre(p), cles: () => (M.duelsActifs ? M.duelsActifs() : []), un: (id, t) => M.duelQuotidienUn(id, t), cout: 10, push: true, fenetre: true },
    // Les réactions des amis du jour : une poussée groupée par personne, 19 h.
    { nom: 'reactions', quand: (p) => apres(p, 19, 0) && p.heure < 21, cles: () => (M.reactionsAttente ? M.reactionsAttente() : []),
      un: (uid, t) => M.reactionsPushUn(uid, t), cout: 8, push: true },
    // La rétention (/stats/retention) : un résumé d'activité par compte, par lots,
    // la nuit (l'accumulateur est gardé entre deux minutes).
    // LE POINT DE LA SEMAINE (hebdo.js, ia.js) : le lot part le dimanche après
    // 23 h ; il est relevé chaque heure du lundi, jusqu'à ce qu'il soit fini.
    { nom: 'hebdo_envoi', quand: (p) => p.joursem === 0 && apres(p, 23, 0), une: (t) => (M.hebdoEnvoi ? M.hebdoEnvoi(t) : null) },
    { nom: 'hebdo_collecte', heure: true, quand: (p) => p.joursem === 1, une: (t) => (M.hebdoCollecte ? M.hebdoCollecte(t) : null) },
    // LE JOURNAL DE L'ASSISTANT IA (ia.js) : au-delà de 90 jours, effacé —
    // même règle que le journal des relances (journalAPurger).
    { nom: 'ia_journal', quand: (p) => apres(p, 4, 40), cles: () => (M.iaComptes ? M.iaComptes() : []),
      un: (k, t) => (M.iaPurgerUn ? M.iaPurgerUn(k, t) : null), cout: 2 },
    { nom: 'retention', quand: (p) => apres(p, 4, 30), cles: () => (M.activiteComptes ? M.activiteComptes() : []), un: (k, t, acc) => M.retentionUn(k, t, acc),
      fin: (acc) => M.retentionFin(acc), cout: 3 },
    // La relance des inactifs : J+7, J+14, J+30 après la dernière séance.
    // Les relances automatiques des coachs (lot C3) : une lecture par coach,
    // puis une sous-tâche par athlète dans la file. Avant 11 h : le premier
    // push du jour n'est pas encore pris par l'accès ou le retour.
    { nom: 'relances', quand: (p) => apres(p, 10, 30) && p.heure < 21, cles: () => (M.relancesCoachUn ? db_coachs(M) : []),
      un: (coach, t) => M.relancesCoachUn(coach, t), cout: 6 },
    { nom: 'retour', quand: (p) => apres(p, 11, 0) && avantFenetre(p), cles: () => M.abonnes(), un: (uid, t, acc, profil, log) => (M.retourUn ? M.retourUn(uid, t, profil, log) : null), cout: 12, push: true, fenetre: true, profils: true, parAthlete: true },
    // La santé synchronisée : « Ta nuit n'est pas encore arrivée » (iPhone), vers 10 h.
    { nom: 'sante_rappel', quand: (p) => apres(p, 10, 0) && p.heure < 21, cles: () => (M.santeComptes ? M.santeComptes() : []),
      un: (k, t) => (M.santeRappelUn ? M.santeRappelUn(k, t) : null), cout: 8, push: true },
    // L'accueil d'un athlète coaché (lot C1) : bilan, programme, première séance.
    { nom: 'accueil', quand: (p) => apres(p, 17, 30) && p.heure < 21, une: (t) => (M.accueilRelances ? M.accueilRelances(t) : null) },
    // Le parcours « Mise sous tension » : le rappel du 21e jour d'essai.
    { nom: 'parcours', quand: (p) => apres(p, 18, 15), une: (t) => (M.parcoursJ21 ? M.parcoursJ21(t) : null) },
    // Les événements saisonniers : CHAQUE HEURE (heure: true), le compteur
    // collectif, les badges Édition, les annonces (lancement, mi-parcours, J-2, fin).
    // Les messages programmés du canal (lot C5) : CHAQUE HEURE, une lecture.
    { nom: 'canal_programmes', heure: true, quand: () => true, une: (t) => (M.canalProgrammesHeure ? M.canalProgrammesHeure(t) : null) },
    // Les prospects sans réponse depuis 48 h (lot C6) : CHAQUE HEURE, au coach.
    { nom: 'prospects', heure: true, quand: (p) => p.heure >= 8 && p.heure < 21, une: (t) => (M.prospectsRelanceHeure ? M.prospectsRelanceHeure(t) : null) },
    { nom: 'saisons', heure: true, quand: () => true, une: (t) => (M.saisonsHeure ? M.saisonsHeure(t) : null) },
    // LA SAISON DU MOIS SUIVANT (02/10/2026) : le 25 à 12 h, depuis le
    // calendrier des modèles, si Kevin n'en a pas posé une à la main.
    { nom: 'saisons_auto', quand: (p) => p.date === 25 && apres(p, 12, 0), une: (t) => (M.saisonsAuto ? M.saisonsAuto(t) : null) },
    // LES LIGUES (01/10/2026) : le lundi 00 h 30, la clôture de la semaine et
    // les nouveaux groupes (un compte par pas, la répartition à la fin) ; le
    // samedi 11 h, la zone de bascule ; le lundi 9 h, le résultat. Les deux
    // derniers ne font qu'enfiler des push (sous-tâches) : pas de fenêtre.
    { nom: 'ligues', quand: (p) => p.joursem === 1 && apres(p, 0, 30), cles: () => (M.liguesComptes ? M.liguesComptes() : []),
      un: (k, t, acc) => M.liguesUn(k, t, acc), fin: (acc, t) => M.liguesFin(acc, t), cout: 8 },
    { nom: 'ligues_sam', quand: (p) => p.joursem === 6 && apres(p, 11, 0) && p.heure < 21, cles: (t) => (M.liguesGroupes ? M.liguesGroupes(M.lundiDe(t)) : []),
      un: (g, t) => M.liguesSamediUn(g, t), cout: 6 },
    { nom: 'ligues_lundi', quand: (p) => p.joursem === 1 && apres(p, 9, 0) && p.heure < 21, cles: (t) => (M.liguesGroupes ? M.liguesGroupes(M.lundiDe(t, -1)) : []),
      un: (g, t) => M.liguesLundiUn(g, t), cout: 4 },
  ];
}

const texteErreur = (err) => String((err && err.message) || err).slice(0, 200);

// UN ÉVÉNEMENT (ou une sous-tâche). Lève en cas d'échec : c'est minute() qui
// décide de la suite (fin de file, ou evenements_ko).
async function traiter(db, M, e) {
  if (!e || typeof e !== 'object') return 'vide';
  if (e.type === 'tache') {
    if (e.quoi === 'fin_paypal') return M.paypal ? M.paypal.finTache(String(e.cle || '')) : 'sans_paypal';
    if (e.quoi === 'resiliation_paypal') return M.paypal ? M.paypal.resiliationTache(String(e.cle || '')) : 'sans_paypal';
    // Un événement PayPal arrivé avant le lien de son abonnement, rejoué dans
    // l'ordre de PayPal (paypal.js, rejouerOrphelins).
    if (e.quoi === 'orphelin_paypal') return M.paypal ? M.paypal.rejouerUnOrphelin(String(e.abo || ''), String(e.k || '')) : 'sans_paypal';
    // La reprise d'un premier paiement remboursé ou contesté (paypal.js, annuler).
    if (e.quoi === 'annulation_suite') return M.paypal && e.suite ? M.paypal.annulationSuite(e.suite) : 'sans_paypal';
    return M.tache(e);
  }
  if (e.type === 'parrainage_demande') {
    const d = (await db.ref('parrainage/demandes/' + e.par).get()).val();
    return d && !d.etat ? M.parrainageDemande(e.par, d) : 'deja_juge';
  }
  if (e.type === 'ambassadeur_demande') {
    const d = (await db.ref('ambassadeurs_demandes/' + e.par).get()).val();
    return d && !d.etat ? M.ambassadeurDemande(e.par, d) : 'deja_juge';
  }
  if (e.type === 'abonnement') return M.paypal ? M.paypal.indexer(e.par, e.abo, e.remplace) : 'sans_paypal';
  return M.evenement(e);
}

// L'ÉCHEC : en fin de file avec un essai de plus, ou, au cinquième, rangé
// dans evenements_ko. Une seule écriture : retrait et dépôt ensemble. Le
// verrou de l'app (evenements_attente) suit le nouvel identifiant, pour que
// l'événement compte toujours comme « en attente ».
// AU CINQUIÈME ÉCHEC, LE CRÉATEUR EST PRÉVENU (push urgent, une fois par
// heure au plus : metier.js, alerteKo), si le budget du réveil le permet.
async function echec(db, id, e, err, t, M, reste) {
  const essais = (Number(e && e.essais) || 0) + 1;
  const erreur = texteErreur(err);
  const maj = { ['evenements/' + id]: null };
  if (essais >= ESSAIS_MAX) {
    maj['evenements_ko/' + id] = Object.assign({}, e, { essais, erreur, le: t });
  } else {
    const nid = idFile(t, 'r');
    maj['evenements/' + nid] = Object.assign({}, e, { essais, erreur });
    if (e && e.par && e.type && e.cible && e.type !== 'tache')
      maj['evenements_attente/' + e.par + '/' + e.type + '/' + e.cible + '/id'] = nid;
  }
  await db.ref().update(maj);
  if (essais >= ESSAIS_MAX && M && M.alerteKo && (!reste || reste() >= COUT_ALERTE_KO)) {
    try { await M.alerteKo(String((e && e.type) || '?'), erreur, t); } catch (e2) { /* l'événement est rangé : c'est l'essentiel */ }
  }
  return essais;
}

// UN TRAVAIL, pour ce réveil. `etat0` : ce que /worker/jobs portait (lu en
// une fois par minute()). Rien n'est écrit ici : l'état modifié va dans `maj`.
async function unTravail(w, etat0, { db, M, t, p, reste, bilan, maj, enfiles }) {
  const chemin = 'worker/jobs/' + w.nom;
  if (!w.quand(p)) {
    // LA FENÊTRE S'EST FERMÉE SUR UNE LISTE INACHEVÉE : ni « fini », ni
    // silence. `sautes` le dit, une fois, et evenements_ko le montre.
    if (w.fenetre && !avantFenetre(p) && etat0 && etat0.jour === p.jour && !etat0.fini && etat0.sautes == null && etat0.total != null) {
      const sautes = Math.max(0, (Number(etat0.total) || 0) - (Number(etat0.curseur) || 0));
      maj[chemin] = Object.assign({}, etat0, { sautes });
      maj['evenements_ko/' + idFile(t, 'j')] = { type: 'travail_incomplet', nom: w.nom, sautes, le: t };
      bilan.travaux[w.nom] = 'sautes:' + sautes;
    }
    return;
  }
  if (reste() < 6) return;
  // Un travail HORAIRE (heure: true) repart à chaque heure de Paris.
  const periode = w.heure ? p.jour + 'h' + p.heure : p.jour;
  let etat = etat0 && etat0.jour === periode ? JSON.parse(JSON.stringify(etat0)) : { jour: periode, curseur: 0, fini: false, acc: {} };
  if (etat.fini) return;
  const avant = JSON.stringify(etat0 || null);
  // Firebase ne garde pas un objet vide : relu, il revient null.
  if (!etat.acc || typeof etat.acc !== 'object') etat.acc = {};
  if (w.une) {
    // `false` : coupé par le budget, à reprendre au réveil suivant.
    // Une erreur cinq fois de suite le range dans evenements_ko.
    try {
      const r = await w.une(t);
      etat.fini = r !== false;
      etat.essais = null;
    } catch (err) {
      bilan.erreur = texteErreur(err);
      etat.essais = (Number(etat.essais) || 0) + 1;
      if (etat.essais >= ESSAIS_MAX) {
        etat.fini = true;
        maj['evenements_ko/' + idFile(t, 'j')] = { type: 'travail', nom: w.nom, essais: etat.essais, erreur: bilan.erreur, le: t };
      }
    }
  } else if (w.parAthlete && M.enModeFile && M.enModeFile()) {
    // LE MODE FILE : des pages de PAGE_FILE abonnés, un message par athlète.
    // Une page coûte une lecture et un envoi par paquet de 100.
    const coutPage = 1 + Math.ceil(PAGE_FILE / 100);
    while (!etat.fini && reste() >= coutPage + 2) {
      const page = await M.abonnesPage(etat.dernier || '', PAGE_FILE);
      await M.enfiler(page.map((uid) => ({ quoi: 'planifie', nom: w.nom, uid })));
      enfiles.n += Math.ceil(page.length / 100);
      if (page.length) etat.dernier = page[page.length - 1];
      etat.curseur = (Number(etat.curseur) || 0) + page.length;
      etat.total = etat.curseur;
      if (page.length < PAGE_FILE) etat.fini = true;
    }
  } else {
    const cles = (await w.cles(t)).sort();
    etat.total = cles.length;
    // LA REPRISE SE FAIT APRÈS LA DERNIÈRE CLÉ TRAITÉE, pas à un index :
    // une liste qui rétrécit entre deux réveils (un duel clos sort de
    // /duels_actifs) décalerait l'index et sauterait des clés.
    let i = etat.dernier != null ? cles.findIndex((k) => String(k) > String(etat.dernier)) : (Number(etat.curseur) || 0);
    if (i < 0) i = cles.length;
    const assez = () => reste() >= (w.cout || 10) + 2 && (!w.push || !M.peutPousser || M.peutPousser());
    // LES PROFILS ET LE JOURNAL DES PUSH, PAR PAGES : une requête chacun pour
    // PAGE_PROFILS clés à partir de la clé courante. `null` : rien pour cette
    // clé (pas de profil : le métier le construit ; pas de push aujourd'hui).
    const pager = (lire) => {
      let page = null;
      return async (k) => {
        const dedans = page && (page.n < PAGE_PROFILS || String(k) <= page.fin);
        if (!dedans) {
          const v = (await lire(String(k), PAGE_PROFILS)) || {};
          const ks = Object.keys(v).sort();
          page = { v, n: ks.length, fin: ks.length ? ks[ks.length - 1] : '' };
        }
        return page.v[k] || null;
      };
    };
    const pagine = w.profils && M.profilsPage && M.logsPage;
    const profilDe = pagine ? pager(M.profilsPage) : null, logDe = pagine ? pager(M.logsPage) : null;
    while (i < cles.length && assez()) {
      try {
        if (pagine) await w.un(cles[i], t, etat.acc, await profilDe(cles[i]), await logDe(cles[i]));
        else await w.un(cles[i], t, etat.acc);
      } catch (err) { bilan.erreur = texteErreur(err); }
      etat.dernier = String(cles[i]);
      i++;
    }
    etat.curseur = i;
    if (i >= cles.length) {
      if (w.fin) await w.fin(etat.acc || {}, t);
      etat.fini = true;
    }
  }
  bilan.travaux[w.nom] = etat.fini ? 'fini' : etat.curseur;
  if (JSON.stringify(etat) !== avant) maj[chemin] = etat;
}

/**
 * Un réveil. `compteur()` rend le nombre de requêtes déjà émises dans ce
 * réveil (base ET services de push). `source` : 'reveil' quand c'est l'app
 * qui l'a demandé (/reveil), sinon la minute de Cloudflare.
 */
export async function minute({ db, M, compteur, maintenant, source, budget }) {
  const horloge = maintenant || Date.now;
  const t = horloge();
  const p = paris(t);
  // `budget` : BUDGET, ou la variable du même nom (plan payant : 900).
  // Les envois à la file (sendBatch) comptent aussi.
  const B = Number(budget) > 0 ? Number(budget) : BUDGET;
  const enfiles = { n: 0 };
  const reste = () => B - compteur() - enfiles.n;
  if (M.fixerBudget) M.fixerBudget(reste);
  const bilan = { evenements: 0, echecs: 0, travaux: {} };

  // 0. LE VERROU. Pris en transaction : de deux exécutions simultanées, une
  //    seule l'obtient. Un bail échu (exécution morte en route) se reprend.
  const moi = idFile(t, 'v');
  let refus = null;
  const pris = await db.ref('worker/verrou').transaction((v) => {
    if (v && Number(v.jusqua) > t) { refus = 'occupe'; return undefined; }
    if (source === 'reveil' && v && t - (Number(v.fileLe) || 0) < REVEIL_MIN_MS) { refus = 'recent'; return undefined; }
    refus = null;
    return Object.assign({}, v || {}, { jusqua: t + VERROU_MS, id: moi });
  });
  if (!pris.committed) return Object.assign(bilan, { verrou: refus || 'occupe', requetes: compteur() });
  bilan.verrou = 'pris';

  let fileLe = null;
  const maj = {};
  try {
    // 1. LES ÉVÉNEMENTS, un lot lu en une requête, traités dans l'ordre.
    const lot = (await db.ref('evenements').orderByKey().limitToFirst(LOT).get()).val() || {};
    const ids = Object.keys(lot).sort();
    let fini = true;
    for (const id of ids) {
      const e = lot[id];
      const cout = (e && e.type === 'tache' && e.quoi === 'relance') ? COUT_RELANCE : (e && e.type === 'seance_fin') ? COUT_SEANCE
        : (e && e.type === 'tache' && e.quoi === 'annulation_suite') ? COUT_REPRISE
        : (e && e.type === 'tache' && (e.quoi === 'orphelin_paypal' || e.quoi === 'paiement_suite')) ? COUT_ORPHELIN : 12;
      if (reste() < cout) { fini = false; break; }
      let ok = true;
      // DANS LA FILE : un push en panne passagère (429, 5xx) y lève
      // « push_transitoire », et l'événement repart en fin de file (echec).
      if (M.enFile) M.enFile(true);
      try { await traiter(db, M, e); } catch (err) {
        // À COURT DE BUDGET (paypal.js lève AVANT d'écrire) : il reste en tête
        // de file, sans compter un essai, pour la minute suivante.
        if (err && err.budget) { fini = false; break; }
        ok = false;
        bilan.echecs++;
        bilan.erreur = texteErreur(err);
        if (M.enFile) M.enFile(false);
        try { await echec(db, id, e, err, t, M, reste); } catch (e2) { /* il reste en tête : réessayé au réveil suivant */ }
      } finally { if (M.enFile) M.enFile(false); }
      if (ok) await db.ref('evenements/' + id).remove();
      bilan.evenements++;
    }
    // La file est « traitée » si ce réveil l'a parcourue jusqu'au bout.
    if (fini) fileLe = horloge();

    // 2. LES TRAVAUX DU JOUR. Tout /worker/jobs en UN GET ; chaque état
    //    modifié part dans `maj`, écrit en une fois dans le `finally`.
    if (reste() >= 6) {
      const jobs = (await db.ref('worker/jobs').get()).val() || {};
      for (const w of travaux(M)) await unTravail(w, jobs[w.nom], { db, M, t, p, reste, bilan, maj, enfiles });
    }
  } finally {
    // LE POULS : ce que ce réveil a fait, écrit DANS LA MÊME écriture que le
    // bail rendu — aucune requête de plus. /sante le lit : un pouls de plus
    // de 5 minutes, c'est un cron arrêté ou une base injoignable.
    const pouls = { t: horloge(), requetes: compteur(), evenements: bilan.evenements, echecs: bilan.echecs,
      erreur: bilan.erreur || null, source: source || 'cron' };
    // LE BAIL EST RENDU, et l'heure de la file notée — s'il est encore à nous.
    // D'ordinaire DANS LE MÊME update que les travaux : à moins de 40 s du
    // début, le bail de 55 s ne peut pas avoir été repris par un autre.
    const direct = horloge() - t < RENDU_DIRECT_MS;
    if (direct) Object.assign(maj, { 'worker/verrou/jusqua': 0, 'worker/verrou/id': null, 'worker/verrou/pouls': pouls }, fileLe ? { 'worker/verrou/fileLe': fileLe } : {});
    try { if (Object.keys(maj).length) await db.ref().update(maj); } catch (e) { bilan.erreur = texteErreur(e); }
    if (!direct) {
      try {
        await db.ref('worker/verrou').transaction((v) => (v && v.id === moi
          ? Object.assign({}, v, { jusqua: 0, id: null, pouls }, fileLe ? { fileLe } : {}) : undefined));
      } catch (e) { /* le bail expire seul dans 55 s */ }
    }
  }
  bilan.requetes = compteur();
  if (M.chiffrements) bilan.chiffrements = M.chiffrements();
  return bilan;
}

// ══ LE CONSOMMATEUR DE LA FILE (mode file : index.js, queue()) ═══════════
// Un lot de messages (max_batch_size = 20). Chaque message :
//   · {quoi:'push', uid, message, …} : un push différé (envoyerPush) ;
//   · {quoi:'planifie', nom, uid} : le travail `nom` pour cet athlète, à
//     l'heure du traitement (le plafond des push du jour et les heures
//     calmes de l'athlète s'appliquent comme dans le réveil).
// RÉUSSI : msg.ack(). UNE ERREUR (dont « push_transitoire » : 429 ou 5xx sur
// tous ses appareils, voir envoyerPush) : msg.retry() — Cloudflare le
// rejoue, et au cinquième échec (max_retries) il part dans repcore-push-ko.
// `budget` : comme pour minute() ; un message qui ne tient plus est rejoué.
export async function consommerLot(batch, { M, compteur, maintenant, budget }) {
  const horloge = maintenant || Date.now;
  const B = Number(budget) > 0 ? Number(budget) : BUDGET;
  if (M.fixerBudget) M.fixerBudget(() => B - compteur());
  const parNom = Object.fromEntries(travaux(M).filter((w) => w.parAthlete).map((w) => [w.nom, w]));
  const bilan = { ok: 0, rejoues: 0, erreur: null };
  for (const msg of (batch && batch.messages) || []) {
    const e = msg.body || {};
    if (B - compteur() < 12) { msg.retry(); bilan.rejoues++; continue; }
    if (M.enFile) M.enFile(true);
    try {
      if (e.quoi === 'planifie') {
        const w = parNom[String(e.nom || '')];
        if (w && e.uid) await w.un(String(e.uid), horloge(), {});
      } else if (e.quoi === 'push') {
        await M.tache(Object.assign({ type: 'tache' }, e));
      }
      msg.ack(); bilan.ok++;
    } catch (err) {
      msg.retry(); bilan.rejoues++; bilan.erreur = texteErreur(err);
    } finally { if (M.enFile) M.enFile(false); }
  }
  bilan.requetes = compteur();
  return bilan;
}
