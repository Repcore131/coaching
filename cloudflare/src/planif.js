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
//
// UN TRAVAIL MANQUÉ SE RATTRAPE : la condition est « l'heure est passée
// aujourd'hui et ce n'est pas fini », pas « il est exactement 18 h 00 ».
//
// UN ÉVÉNEMENT QUI ÉCHOUE NE BLOQUE RIEN : il repart en fin de file avec un
// compteur d'essais ; au cinquième échec, il est rangé dans /evenements_ko
// (écran Ambassadeurs de l'administrateur) et retiré de la file.

import { paris, idFile } from './metier.js';

export const BUDGET = 38;          // requêtes par réveil (plafond Cloudflare : 50)
export const VERROU_MS = 55e3;     // le bail : moins que la minute entre deux réveils
export const REVEIL_MIN_MS = 30e3; // /reveil ne relance pas une file traitée il y a moins
export const ESSAIS_MAX = 5;
const LOT = 25;                    // événements lus d'un coup (une requête)
const apres = (p, h, m) => p.heure * 60 + p.minute >= h * 60 + m;
// Les coachs qui ont des athlètes : les clés de l'annuaire (une lecture).
const db_coachs = (M) => (M.coachsAvecAthletes ? M.coachsAvecAthletes() : []);
// Une relance lit une vingtaine de champs au pire : elle attend le réveil
// suivant plutôt que de dépasser le plafond de Cloudflare.
const COUT_RELANCE = 24;

export function travaux(M) {
  return [
    { nom: 'stats_badges', quand: (p) => apres(p, 3, 17), cles: () => M.coachsEtUsers(), un: (c, t, acc) => M.statsBadgesUn(c, acc), fin: M.statsBadgesFin, cout: 3 },
    // Le 1er du mois : l'idempotence PayPal de plus de 90 jours.
    { nom: 'purge_paypal', quand: (p) => p.date === 1 && apres(p, 4, 10), une: (t) => (M.paypal ? M.paypal.purgerEvenements(t) : null) },
    { nom: 'ambassadeurs', quand: (p) => apres(p, 6, 20), une: M.ambassadeursQuotidien },
    // Les coachs qui ont résilié : leur palier se referme à la fin payée.
    { nom: 'fins_coachs', quand: (p) => apres(p, 6, 0), une: () => (M.paypal ? M.paypal.finsCoachs() : null) },
    // L'avis avant le renouvellement d'un annuel (art. L215-1), une fois par
    // échéance : notification et e-mail Systeme.io (renouvellement.js).
    { nom: 'renouvellement', quand: (p) => apres(p, 10, 45) && p.heure < 21, cles: () => (M.paypal && M.paypal.renouvellementsCles ? M.paypal.renouvellementsCles() : []),
      un: (k, t) => M.paypal.avisRenouvellementUn(k, t), cout: 12 },
    // « Ton accès se termine dans N jours », une fois par échéance.
    { nom: 'acces', quand: (p) => apres(p, 11, 0) && p.heure < 21, cles: () => M.abonnes(), un: M.planifies.acces, cout: 12, push: true },
    // Pas en heures calmes : ce serait relire les messages mis de côté pour la
    // nuit et les jeter au lieu de les envoyer le lendemain à 8 h 05.
    { nom: 'attente', quand: (p) => apres(p, 8, 5) && p.heure < 21, une: M.apresHeuresCalmes },
    { nom: 'defis', quand: (p) => apres(p, 9, 0), cles: () => M.coachsAvecCanal(), un: (c, t) => M.defisQuotidienCoach(c, t), cout: 8 },
    { nom: 'serie', quand: (p) => p.joursem === 4 && apres(p, 18, 0), cles: () => M.abonnes(), un: M.planifies.serie, cout: 15, push: true },
    { nom: 'bilan', quand: (p) => p.joursem === 6 && apres(p, 10, 0), cles: () => M.abonnes(), un: M.planifies.bilan, cout: 12, push: true },
    { nom: 'wrapped', quand: (p) => p.date === 1 && apres(p, 10, 0), cles: () => M.abonnes(), un: M.planifies.wrapped, cout: 10, push: true },
    { nom: 'badge', quand: (p) => p.joursem === 0 && apres(p, 17, 0), cles: () => M.abonnes(), un: M.planifies.badge, cout: 10, push: true },
    // Les duels suivis (/duels_actifs) : le push de J-2, la clôture, l'oubli.
    { nom: 'duels', quand: (p) => apres(p, 18, 30), cles: () => (M.duelsActifs ? M.duelsActifs() : []), un: (id, t) => M.duelQuotidienUn(id, t), cout: 10, push: true },
    // Les réactions des amis du jour : une poussée groupée par personne, 19 h.
    { nom: 'reactions', quand: (p) => apres(p, 19, 0) && p.heure < 21, cles: () => (M.reactionsAttente ? M.reactionsAttente() : []),
      un: (uid, t) => M.reactionsPushUn(uid, t), cout: 8, push: true },
    // La rétention (/stats/retention) : un résumé d'activité par compte, par lots,
    // la nuit (l'accumulateur est gardé entre deux minutes).
    { nom: 'retention', quand: (p) => apres(p, 4, 30), cles: () => (M.activiteComptes ? M.activiteComptes() : []), un: (k, t, acc) => M.retentionUn(k, t, acc),
      fin: (acc) => M.retentionFin(acc), cout: 3 },
    // La relance des inactifs : J+7, J+14, J+30 après la dernière séance.
    // Les relances automatiques des coachs (lot C3) : une lecture par coach,
    // puis une sous-tâche par athlète dans la file. Avant 11 h : le plafond
    // d'une notification par jour n'est pas encore pris par l'accès ou le retour.
    { nom: 'relances', quand: (p) => apres(p, 10, 30) && p.heure < 21, cles: () => (M.relancesCoachUn ? db_coachs(M) : []),
      un: (coach, t) => M.relancesCoachUn(coach, t), cout: 6 },
    { nom: 'retour', quand: (p) => apres(p, 11, 0), cles: () => M.abonnes(), un: (uid, t) => (M.retourUn ? M.retourUn(uid, t) : null), cout: 12, push: true },
    // La santé synchronisée : « Ta nuit n'est pas encore arrivée » (iPhone), vers 10 h.
    { nom: 'sante_rappel', quand: (p) => apres(p, 10, 0) && p.heure < 21, cles: () => (M.santeComptes ? M.santeComptes() : []),
      un: (k, t) => (M.santeRappelUn ? M.santeRappelUn(k, t) : null), cout: 8, push: true },
    // L'accueil d'un athlète coaché (lot C1) : bilan, programme, première séance.
    { nom: 'accueil', quand: (p) => apres(p, 17, 30) && p.heure < 21, une: (t) => (M.accueilRelances ? M.accueilRelances(t) : null) },
    // La fin d'essai (10/10/2026) : J-3, J-1 et J0 à 18 h 30, avec les vrais
    // chiffres de l'essai (finessai.js).
    // Les inscrits sans première séance (premiere.js) : J1, J3, J6, à 17 h.
    // Les alternatives à la résiliation (paypal.js) : la fin des pauses d'un
    // mois, puis la reconquête à J+30 d'une résiliation.
    { nom: 'reprises', quand: (p) => apres(p, 9, 10) && p.heure < 21, une: (t) => (M.paypal && M.paypal.reprisesQuotidien ? M.paypal.reprisesQuotidien(t) : null) },
    { nom: 'reconquete', quand: (p) => apres(p, 12, 0) && p.heure < 21, une: (t) => (M.paypal && M.paypal.reconqueteQuotidien ? M.paypal.reconqueteQuotidien(t) : null) },
    { nom: 'jamais_commence', quand: (p) => apres(p, 17, 0) && p.heure < 21, une: (t) => (M.premiere ? M.premiere.quotidien(t) : null) },
    { nom: 'fin_essai', quand: (p) => apres(p, 18, 30) && p.heure < 21, une: (t) => (M.finEssai ? M.finEssai.quotidien(t) : null) },
    // Le parcours « Mise sous tension » : le rappel du 21e jour d'essai.
    { nom: 'parcours', quand: (p) => apres(p, 18, 15), une: (t) => (M.parcoursJ21 ? M.parcoursJ21(t) : null) },
    // Les événements saisonniers : CHAQUE HEURE (heure: true), le compteur
    // collectif, les badges Édition, les annonces (lancement, mi-parcours, J-2, fin).
    // Les messages programmés du canal (lot C5) : CHAQUE HEURE, une lecture.
    // LES CONNEXIONS SIMULTANÉES (09/10/2026) : CHAQUE MINUTE (minute: true),
    // comptées depuis /presence, alerte à Kevin à 70 (affluence.js).
    { nom: 'affluence', minute: true, quand: () => true, une: (t) => (M.affluence ? M.affluence.minute(t) : null) },
    // Et chaque nuit, les présences de plus de 24 h.
    { nom: 'presence_purge', quand: (p) => apres(p, 4, 40), une: (t) => (M.affluence ? M.affluence.purger(t) : null) },
    { nom: 'canal_programmes', heure: true, quand: () => true, une: (t) => (M.canalProgrammesHeure ? M.canalProgrammesHeure(t) : null) },
    // Les prospects sans réponse depuis 48 h (lot C6) : CHAQUE HEURE, au coach.
    { nom: 'prospects', heure: true, quand: (p) => p.heure >= 8 && p.heure < 21, une: (t) => (M.prospectsRelanceHeure ? M.prospectsRelanceHeure(t) : null) },
    { nom: 'saisons', heure: true, quand: () => true, une: (t) => (M.saisonsHeure ? M.saisonsHeure(t) : null) },
  ];
}

const texteErreur = (err) => String((err && err.message) || err).slice(0, 200);

// UN ÉVÉNEMENT (ou une sous-tâche). Lève en cas d'échec : c'est minute() qui
// décide de la suite (fin de file, ou evenements_ko).
async function traiter(db, M, e) {
  if (!e || typeof e !== 'object') return 'vide';
  if (e.type === 'tache') {
    if (e.quoi === 'fin_paypal') return M.paypal ? M.paypal.finTache(String(e.cle || '')) : 'sans_paypal';
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
  if (e.type === 'abonnement') return M.paypal ? M.paypal.indexer(e.par, e.abo) : 'sans_paypal';
  return M.evenement(e);
}

// L'ÉCHEC : en fin de file avec un essai de plus, ou, au cinquième, rangé
// dans evenements_ko. Une seule écriture : retrait et dépôt ensemble. Le
// verrou de l'app (evenements_attente) suit le nouvel identifiant, pour que
// l'événement compte toujours comme « en attente ».
async function echec(db, id, e, err, t) {
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
  return essais;
}

/**
 * Un réveil. `compteur()` rend le nombre de requêtes déjà émises dans ce
 * réveil (base ET services de push). `source` : 'reveil' quand c'est l'app
 * qui l'a demandé (/reveil), sinon la minute de Cloudflare.
 */
export async function minute({ db, M, compteur, maintenant, source }) {
  const horloge = maintenant || Date.now;
  const t = horloge();
  const p = paris(t);
  const reste = () => BUDGET - compteur();
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
  try {
    // 1. LES ÉVÉNEMENTS, un lot lu en une requête, traités dans l'ordre.
    const lot = (await db.ref('evenements').orderByKey().limitToFirst(LOT).get()).val() || {};
    const ids = Object.keys(lot).sort();
    let fini = true;
    for (const id of ids) {
      const e = lot[id];
      const cout = (e && e.type === 'tache' && e.quoi === 'relance') ? COUT_RELANCE : 12;
      if (reste() < cout) { fini = false; break; }
      let ok = true;
      try { await traiter(db, M, e); } catch (err) {
        ok = false;
        bilan.echecs++;
        bilan.erreur = texteErreur(err);
        try { await echec(db, id, e, err, t); } catch (e2) { /* il reste en tête : réessayé au réveil suivant */ }
      }
      if (ok) await db.ref('evenements/' + id).remove();
      bilan.evenements++;
    }
    // La file est « traitée » si ce réveil l'a parcourue jusqu'au bout.
    if (fini) fileLe = horloge();

    // 2. LES TRAVAUX DU JOUR.
    for (const w of travaux(M)) {
      if (!w.quand(p) || reste() < 6) continue;
      const ref = db.ref('worker/jobs/' + w.nom);
      let etat = (await ref.get()).val();
      // Un travail HORAIRE (heure: true) repart à chaque heure de Paris.
      // Un travail MINUTE (minute: true) repart à chaque minute.
      const periode = w.minute ? p.jour + 'h' + p.heure + 'm' + p.minute : (w.heure ? p.jour + 'h' + p.heure : p.jour);
      if (!etat || etat.jour !== periode) etat = { jour: periode, curseur: 0, fini: false, acc: {} };
      if (etat.fini) continue;
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
            await db.ref('evenements_ko/' + idFile(t, 'j')).set({ type: 'travail', nom: w.nom, essais: etat.essais, erreur: bilan.erreur, le: t });
          }
        }
      } else {
        const cles = (await w.cles()).sort();
        // LA REPRISE SE FAIT APRÈS LA DERNIÈRE CLÉ TRAITÉE, pas à un index :
        // une liste qui rétrécit entre deux réveils (un duel clos sort de
        // /duels_actifs) décalerait l'index et sauterait des clés.
        let i = etat.dernier != null ? cles.findIndex((k) => String(k) > String(etat.dernier)) : (Number(etat.curseur) || 0);
        if (i < 0) i = cles.length;
        const assez = () => reste() >= (w.cout || 10) + 2 && (!w.push || !M.peutPousser || M.peutPousser());
        while (i < cles.length && assez()) {
          try { await w.un(cles[i], t, etat.acc); } catch (err) { bilan.erreur = texteErreur(err); }
          etat.dernier = String(cles[i]);
          i++;
        }
        etat.curseur = i;
        if (i >= cles.length) {
          if (w.fin) await w.fin(etat.acc || {});
          etat.fini = true;
        }
      }
      bilan.travaux[w.nom] = etat.fini ? 'fini' : etat.curseur;
      await ref.set(etat);
    }
  } finally {
    // LE BAIL EST RENDU, et l'heure de la file notée — s'il est encore à nous.
    try {
      await db.ref('worker/verrou').transaction((v) => (v && v.id === moi
        ? Object.assign({}, v, { jusqua: 0, id: null }, fileLe ? { fileLe } : {}) : undefined));
    } catch (e) { /* le bail expire seul dans 55 s */ }
  }
  bilan.requetes = compteur();
  if (M.chiffrements) bilan.chiffrements = M.chiffrements();
  return bilan;
}
