/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — textes de l'interface ═════════════════════════════════════
// Dictionnaire unique : noms de l'appli, menus, titres des pages, vocabulaire
// propre (Zones, Sprints, Carnet du mois, Le Pouls du club…), phrases de rythme,
// compte à rebours, notifications. Chargé avant tous les autres scripts.
// Ton : direct et professionnel, vouvoiement, ni emoji ni tiret cadratin.
// Les fonctions reçoivent des valeurs déjà formatées (et échappées si besoin).
const TXT = {
  app: {
    nom: 'Fit Pulse',
    accroche: 'Objectifs, relances et rétention du club',
    accueil: 'Objectifs, classement, relances et imports Resamania de votre club. Les données restent dans votre espace.',
  },
  // Vocabulaire propre à Fit Pulse
  mots: {
    pouls: 'Le Pouls du club',
    garder: 'Adhérents à garder',
    sprints: 'Sprints',
    sprint: 'Sprint',
    cloture: 'Clôture du jour',
    carnet: 'Carnet du mois',
    carnets: 'Carnets du mois',
    clubReglages: 'Club et réglages',
    monEspace: 'Mon espace',
    zone: 'Zone',
  },
  nav: {
    home: 'Accueil', journee: 'Ma journée', kpimatin: 'KPI du matin', dashboard: 'Mes objectifs', relances: 'Relances', leaderboard: 'Classement',
    equipeMembre: 'Équipe', recap: 'Récap du mois', rapporte: 'Ce que Fit Pulse a rapporté', team: 'Pilotage équipe', equipeManager: 'Matrice équipe',
    b2b: 'Entreprise', resiliations: 'Résiliations', impayes: 'Impayés', loyalty: 'Adhérents à garder', pouls: 'Le Pouls du club',
    imports: 'Imports Resamania', controle: 'Contrôle des chiffres', confiance: 'Confiance des chiffres', profil: 'Mon espace', confidentialite: 'Confidentialité',
  },
  pages: {
    confidentialite: 'Confidentialité', donnees: 'Données personnelles', equipe: 'Équipe', controle: 'Contrôle des chiffres', kpimatin: 'KPI du matin',
    legal: 'Informations légales', team: 'Pilotage équipe', coaching: 'Fiche coaching', client: 'Fiche client', imports: 'Imports',
    loyalty: 'Adhérents à garder', clubs: 'Club et réglages', home: 'Accueil', mesRelances: 'Mes relances', dashboard: 'Mes objectifs',
    leaderboard: 'Classement', pouls: 'Le Pouls du club', chat: 'Chat', resiliations: 'Résiliations', impayes: 'Impayés',
    quality: 'Contrôle qualité', recap: 'Récapitulatif du mois', equipePaliers: 'Équipe et paliers', profil: 'Mon espace', produit: 'Suivi produit',
    rapporte: 'Ce que Fit Pulse a rapporté', relances: 'Relances', opportunites: 'Opportunités',
  },
  // Paliers individuels : 5 zones gagnées par mois validés
  zones: {
    seuil: 0.8, // un mois est validé à 80 % de la valeur cible
    liste: [
      { id: 'z1', label: 'Zone 1', min: 0 },
      { id: 'z2', label: 'Zone 2', min: 2 },
      { id: 'z3', label: 'Zone 3', min: 5 },
      { id: 'z4', label: 'Zone 4', min: 9 },
      { id: 'z5', label: 'Zone 5', min: 14 },
    ],
    regle: 'Un mois est validé quand le score des KPI obligatoires atteint 80 % de l’objectif.',
    titre: z => `${z.label}`,
    valides: n => `${n} mois validé${n > 1 ? 's' : ''}`,
    avant: (n, z) => `Encore ${n} mois validé${n > 1 ? 's' : ''} pour la ${z}`,
    max: 'Zone 5 atteinte',
    seuilMois: n => `${n} mois`,
  },
  // Phrases de rythme (cartes KPI)
  rythme: {
    sansObjectif: 'Pas d’objectif ce mois-ci',
    atteint: 'Objectif atteint',
    auDela: v => `Objectif atteint, ${v} au-delà`,
    aRattraper: v => `${v} à rattraper pour tenir le rythme`,
    palier: (v, p) => `Dans le rythme. Palier ${p} % : encore ${v}`,
    dans: 'Dans le rythme',
    surveiller: 'À surveiller',
    retard: 'En retard',
  },
  // Compte à rebours de fin de mois
  compteur: {
    court: (j, o) => `J-${j} · ${o} jours ouvrés`,
    titre: (j, o, mois) => `Fin ${mois} : ${j} jour${j > 1 ? 's' : ''} calendaire${j > 1 ? 's' : ''} après aujourd’hui, ${o} jour${o > 1 ? 's' : ''} ouvré${o > 1 ? 's' : ''} aujourd’hui compris (hors dimanches et jours fériés)`,
  },
  pouls: {
    sous: 'Les saisies de l’équipe, en direct. Visible par les seuls membres de vos clubs.',
    tous: 'Tous nos clubs',
    videTitre: 'Le Pouls démarre à la première saisie',
  },
  cloture: {
    bouton: 'Clôture du jour',
    vide: 'Journée sans saisie',
    complete: 'Journée complète',
    bonne: 'Journée enregistrée',
    notif: 'Clôture du jour, à 19 h 30',
  },
  carnet: {
    profil: 'Mes carnets du mois',
    introuvable: 'Carnet introuvable.',
    personnel: 'Ce carnet est personnel.',
  },
  equipe: {
    org: 'Membres et rôles', hist: 'Saisies par jour', carnets: 'Carnets du mois',
    vide: 'Ajoutez votre équipe dans Membres et rôles.',
    droits: ['Saisir ses KPI, voir son tableau de bord, le classement, Le Pouls du club, le chat', 'Traiter les relances (Adhérents à garder) et les résiliations'],
    valider: 'Saisi depuis Adhérents à garder : à valider',
    noteValider: 'Un point orange signale un règlement saisi depuis Adhérents à garder, à valider.',
  },
  profil: {
    etapes: 'Étapes franchies',
    premier100: 'Premier objectif atteint',
    premier100Detail: 'Un KPI à 100 % sur un mois',
  },
  classement: {
    clubs: 'Vos clubs uniquement. Score d’un club = moyenne des scores de ses membres actifs sur les KPI obligatoires : la taille de l’équipe ne compte pas.',
    reperes: ['Dans le rythme', 'À surveiller', 'En retard'],
  },
  imports: {
    etapes: ['Document', 'Correspondance des colonnes', 'Validation'],
    deposer: 'Choisir un fichier CSV (ou le faire glisser ici)',
    auto: 'Enregistré à chaque modification',
  },
  base: {
    explication: 'Base de fin de mois = clients actifs au dernier jour, moins les sortants du mois.',
    actifs: 'Clients actifs', fin: 'Base de fin de mois',
  },
  clubs: {
    sous: 'Les clubs de votre espace. Aucun autre club ne voit ces données.',
    couleur: 'Couleur du club',
    couleurAide: 'Utilisée pour les boutons et les repères. La couleur Fit Pulse reste celle de la marque.',
    couleurDefaut: 'Couleur Fit Pulse',
    logo: 'Logo du club',
    logoAide: 'Fichier image déposé dans assets/ (par exemple assets/logo-club.svg). Vide : pas de logo.',
    offres: 'Il faut des offres classées par gamme (Club et réglages > Réglages > Offres et prix) et l’export Vente d’abonnements.',
    stockage: 'Stockage du navigateur plein : exportez une sauvegarde (Club et réglages > Réglages).',
  },
  kpi: { invites: 'Invités convertis' },
  taches: { passage: 'Contrôle des entrées du matin', avis: 'Réponse aux avis des autres plateformes' },
  garder: {
    relancer: 'Relancer dans Adhérents à garder',
    sous: 'fins d’engagement à relancer',
  },
  notifs: { cloture: 'Clôture du jour' },
  propriete: {
    titre: 'Propriété du logiciel',
    texte: 'Fit Pulse (code, interfaces, textes, méthodes de calcul, nom et logo) est un logiciel propriétaire : tous droits réservés. Son historique est versionné et daté ; les concepts propres à Fit Pulse sont décrits dans docs/concepts-propres.md. Toute reproduction, même partielle, est interdite sans autorisation écrite.',
    version: 'Version v0.1-2026-10',
  },
};
