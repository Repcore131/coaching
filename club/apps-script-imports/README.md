# Script Gmail : exports Resamania importés sans clic

Projet Google Apps Script : `Code.gs` et `appsscript.json`. Toutes les 15 minutes, il relit les
messages libellés `FP-import` et envoie leurs exports à Fit Pulse. Le jeton du club n'est jamais
écrit dans le code : il est rangé dans les propriétés du script.

## Filtre Gmail à créer

Dans Gmail, Paramètres, Filtres et adresses bloquées, Créer un filtre :

- **De** : `ADRESSE_EXPEDITEUR_RESAMANIA` (à compléter après lecture d'un vrai message d'export
  Resamania : recopier l'adresse exacte de l'expéditeur) ;
- **Contient les mots** : `export` ;
- action : **Appliquer le libellé** `FP-import`, et cocher « Appliquer également le filtre aux
  conversations correspondantes ».

## Marche à suivre pour le manager

1. Dans Fit Pulse, Réglages, Club, carte « Arrivée des exports » : cliquer « Jeton du script Gmail »
   et copier le jeton affiché (il ne sera plus montré).
2. Ouvrir https://script.google.com avec le compte Gmail qui reçoit les exports, créer un projet
   « Fit Pulse imports », coller `Code.gs`, puis dans Paramètres du projet cocher « Afficher le
   fichier manifeste » et coller `appsscript.json`.
3. Dans `Code.gs`, remplacer `INGEST_URL` et `CLUB_ID` par les valeurs données par Fit Pulse.
4. Dans Paramètres du projet, Propriétés du script, ajouter `FP_CLUB_TOKEN` (le jeton de l'étape 1)
   et `FP_MANAGER_EMAIL` (l'adresse qui recevra les alertes « Export à ouvrir à la main »).
5. Sélectionner la fonction `installer`, cliquer Exécuter et accepter les autorisations : les
   libellés `FP-import`, `FP-importé`, `FP-erreur` et le déclencheur de 15 minutes sont créés.
6. Créer le filtre Gmail ci-dessus, puis vérifier au bout de 15 minutes la feuille « Journal
   imports » (dans Google Drive) et l'onglet Imports, Automatique de Fit Pulse.

## Garanties

- Un même message traité deux fois ne crée qu'un import : l'id Gmail part avec chaque fichier et
  Fit Pulse refuse un id déjà traité (réponse 409, notée « déjà traité » dans le journal).
- Un lien qui renvoie une page de connexion n'importe rien : le fil reçoit `FP-erreur` et le
  manager reçoit l'e-mail « Export à ouvrir à la main » avec le lien.
