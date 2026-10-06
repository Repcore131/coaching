# Architecture de Fit Pulse : état actuel et cible

## Aujourd'hui
- Application web sans build : `club/index.html` charge les scripts dans l'ordre (config, core, parse, calc, ui, pages…, revenus, saison, motivation, pilotage, donnees, app). Une seule feuille de style, polices et bibliothèques hébergées dans `club/vendor` et `club/fonts`.
- Données : Firebase Realtime Database, nœud `/pulse` (état complet du club), `/pulse_boot` (clé de connexion vers l'identifiant), boîte d'envoi des invitations.
- Connexion : comptes Firebase synthétiques dérivés de l'e-mail et du code ; l'identifiant interne est lu dans `/pulse_boot`.
- Règles : un bloc généré par `club/outils/fitpulse-serveur.mjs` (rôles membre, manager, créateur ; écritures par collection ; audit et journaux en création seule).
- Hors ligne : service worker réseau d'abord, copie locale de la base (IndexedDB) et file d'écritures persistante.

```
navigateur ── index.html + scripts ──▶ Firebase Auth (comptes synthétiques)
     │                                     │
     └── écoute /pulse, écritures par lots ┴─▶ Realtime Database /pulse, /pulse_boot
GitHub Actions ─▶ règles + déploiement Hosting ; tests à chaque PR
```

## Cible (v2) et migration sans coupure
1. Arbre par club : `/v2/clubs/<clubId>/{entries, clients, relances, touches, …}` et `/v2/members/<uid>` ; écoutes ciblées (saisies des 13 derniers mois, 200 derniers messages) au lieu de l'arbre entier.
2. Identité : `auth.uid` réel par personne (lien e-mail ou code à usage unique), rôles en custom claims ; règles exprimées avec `auth.uid`.
3. Index incrémental côté client : mise à jour par delta au lieu d'un recalcul complet.
4. Envois serveur (notifications push, e-mails) : Cloud Functions planifiées, ou à défaut un workflow GitHub Actions planifié sur la branche principale.
5. Migration : script Admin SDK qui lit `/pulse`, crée `/v2`, double écriture pendant deux semaines, bascule de lecture, puis `/pulse` en lecture seule.
