# Journal des versions de Fit Pulse

## 2026.10.7 (octobre 2026)
- Relève des résiliations : messages au score de 2 dans un onglet « À vérifier » (« C'est une demande » ou « Ignorer ») ; motif toujours pris dans la liste du club, « Santé » sans détail ; règles communes au script Gmail et à l'appli, testées sur 12 e-mails anonymisés.
- Rattachement à la fiche client (e-mail, numéro, nom), suggestions quand plusieurs fiches se ressemblent, fusion des doublons, import Resamania rattaché au dossier ouvert du même client ; dossiers visibles dans la fiche client.
- Clôture automatique d'après Resamania (après chaque import et la nuit), retrait visuel de la carte avec « Annuler » pendant 8 s, colonne « Fermé par » ; badge et tuile comptent les demandes en attente de réponse puis en cours.
- Nouvelle carte de dossier : compte à rebours de réponse, Contacter (appel, SMS, réponse Gmail), Proposer une offre, Valider la résiliation ou la suspension ; version téléphone en trois boutons.
- Escalade des demandes sans réponse (4 h, 24 h, 48 h, heures calmes 22 h à 7 h) et résumé du matin à l'heure choisie ; modèles de messages modifiables (Réglages > Modèles de résiliation).
- E-mail et téléphone des dossiers rangés à part, lisibles par le manager et le responsable ; « Changer le secret » avec 24 h de recouvrement ; contrôle « Confirmations envoyées » ; fiche du registre des traitements.
- Indicateurs : sans réponse, délai médian de première réponse, répondues sous 24 h, taux de sauvetage ; onglet Analyse (vendeur, offre, motif, source, six mois) ; récapitulatif : délai de réponse et euros sauvés.
- Démonstration : scénario de relève en huit dossiers fictifs.

## 2026.10.6 (octobre 2026)
- Résiliations : statut tiré de l'état Resamania (annulée, rejetée, acceptée, soumise) sans jamais rétrograder un dossier ; date de réception, délai de prise en charge mesuré de la réception au premier contact ; sauvetage déclaré avec offre et note, confirmé par l'import suivant (« À confirmer » après 15 jours).
- Dossiers en trois phases (en attente de réponse, en cours, clos) avec échéance de réponse ; colonnes Resamania facultatives (canal de saisie, numéro client, date de réception, date d'effet) ; demandes faites dans l'appli signalées.
- Réglages > Relève des résiliations : règles de détection, seuil, expéditeurs, banc d'essai, configuration à copier, secret de signature et guide d'installation en 10 étapes.
- Fonctions `ingestResiliations` (requêtes signées HMAC), `setMailSecret` et `graphPoll` (Microsoft 365) ; heure de la dernière relève et alerte au manager après 3 h sans passage.
- Script Google Apps Script prêt à installer (`apps-script/`).

## 2026.10.5 (octobre 2026)
- Identité produit : thème clair par défaut (sombre par préférence ou par choix), jetons encre, graphite, gris, filet, fond, surface et signal bleu ; polices Geist et Geist Mono (repli IBM Plex) ; échelle 12 à 32 px ; logo « P pouls ».
- Sobriété : ni italique ni capitales sur les titres, ni biais, ni dégradé, ni flou ; chaque nombre porte son unité ; projection des paliers à partir du 5 ; entonnoir proportionnel.
- Mes objectifs en tableau triable (Rythme attendu, Écart, Tendance 30 jours) ; ordre des indicateurs dans Réglages ; Journal du jour ; Rapport mensuel imprimable ; réactions Vu, Bravo, Question.
- Ton factuel : toasts chiffrés, célébration réservée au palier d'équipe, une fois par palier et par mois.
- Marque blanche : accent et logo par club et par réseau (Réglages > Apparence), contraste calculé, SVG contrôlé ; un commercial ne voit que ses dossiers.
- Icônes redessinées, états vides illustrés, niveaux Recrue, Confirmé, Expert, Référent, nouvelle page de connexion.
- Mode capture (`?capture=1`) et `scripts/captures.mjs` : 12 captures commerciales contrôlées.

## 2026.10.4 (octobre 2026)
- Réglages en quatre cartes : Mon club (logo réduit à 100 Ko), Repères métier (panier moyen, jours ouvrés, heures du brief et du bilan), KPI suivis (créateur), Messages types.
- Réversibilité : export complet en tableur (ZIP de CSV et LISEZMOI), version et état du service.
- Mise en route : checklist de démarrage d'un nouveau club.
- Démo vendeur « Club Horizon » et démo guidée de 7 minutes.

## 2026.10.3
- Application neutre, paramétrable par client (nom, enseigne, logo, couleurs, société).
- Confiance des chiffres, données et RGPD, adoption par l'équipe.
- Ma journée, brief du jour, clôture du jour, impayés par ancienneté, résiliations en euros, contrôle des imports, revenus du récap.

## 2026.10.2
- Nouvelle identité : Zones, compte à rebours en jours ouvrés, tracé de pouls, couleur du club, logo.
- Antériorité : licence, concepts propres datés, paquet e-Soleau.

## 2026.10.1
- Relève horaire des demandes de résiliation, imports Resamania automatiques, rétention en euros.
- Opportunités et brief du matin, matrice d'équipe, fiabilité des chiffres, confidentialité, multi-salles.
- Ce que Fit Pulse a rapporté, prospects par étape, récap des résiliations.

## 2026.10
- Première version : objectifs, classement, relances, impayés, résiliations, imports Resamania, récapitulatif du mois.
