# Fit Pulse multi-salles

Fit Pulse peut servir plusieurs sociétés clientes, chacune isolée des autres. Le mode
s'active par configuration ; la base historique (`/pulse`) continue de fonctionner tant
que la bascule n'est pas faite.

## Modèle de données

| Chemin | Contenu | Qui lit, qui écrit |
|---|---|---|
| `/orgs/{org}/info` | nom, abonnement, statut, sécurité (`securite/mfa`), région | membres de la société (lecture) ; création par le fondateur, statut et abonnement par l'éditeur seulement |
| `/orgs/{org}/clubs/{club}` | clubs de la société | membres ; créateur (création), managers (réglages) |
| `/orgs/{org}/data/…` | toutes les collections de l'appli (users, entries, targets, imports, clients…) | membres ; objectifs et imports : managers ; un membre n'écrit que ses saisies |
| `/orgs_boot/{clé}` | `{ org, uid }` : le compte et sa société | lisible clé par clé (connexion), jamais en liste |
| `/orgs_invites/{org}/{jeton}` | invitation : e-mail, rôle, expiration (7 jours), usage | lisible par son seul lien ; liste aux managers |
| `/orgs_mail/{org}`, `/orgs_push/{org}`, `/orgs_inbox/{org}`, `/orgs_product/{org}` | file d'e-mails, abonnements push, notifications, suivi produit | hors de `/orgs/{org}` : les droits de lecture descendent dans l'arbre |
| `/orgs_secret/{org}/{uid}/totp` | secret de double authentification | serveur seulement |

Règles : `club/outils/fitpulse-regles-orgs.mjs`, posées avec celles de `/pulse` par
`fitpulse-serveur.mjs`. Tests : `club/tests/regles-orgs.emul.mjs` (isolation entre sociétés,
rôles, saisies, inscription, invitations, double authentification) et
`club/tests/multi.emul.mjs` (la vraie appli dans un navigateur, sur le simulateur).

## Double authentification (managers et créateurs)

Un code TOTP (application d'authentification) est demandé à chaque connexion. Il est vérifié
par le serveur (fonctions `totpEtat`, `totpInscrire`, `totpValider` de `club/cloud`), qui
ajoute au jeton de CETTE connexion la revendication `mfaAt = auth_time`. Les règles de la base
refusent tout accès à un manager ou un créateur sans elle quand `info/securite/mfa` vaut
`true` (imposé à la création d'une société, non modifiable par elle).

## Région

Les nouveaux espaces sont prévus dans une base Realtime Database en `europe-west1`
(Belgique). La page Confidentialité affiche la région lue dans l'adresse de la base.

## Bascule (à faire une fois)

1. Projet Firebase au forfait Blaze. Créer une instance Realtime Database en `europe-west1`.
2. Déployer les fonctions : `cd club/cloud && npm install && npm run copier && firebase deploy --only functions`.
3. Dans `club/config.js`, pointer `databaseURL` vers la nouvelle instance et ajouter `multi: true`.
4. Poser les règles (`node club/outils/fitpulse-serveur.mjs regles` avec `FIREBASE_DB_URL` de la nouvelle base).
5. Migrer : `node club/outils/migration-orgs.mjs --org fitnessparkniort --nom "FPN Gestion" --mois 2026-09`
   (essai, aucun écriture), puis la même commande avec `--ecrire`. Le script refuse d'écrire si
   un total du mois de contrôle diffère, relit après écriture et revérifie. `/pulse` n'est pas modifié.
6. Côté serveur GitHub, `FITPULSE_MULTI=1` : chaque passage (push, rapports, brief, relève des
   e-mails, imports) tourne pour chaque société.

## Essai en local

    (cd club && python3 -m http.server 8765) &
    cd club/tests/emul && npx firebase-tools emulators:exec --only database,auth --project demo-fitpulse "node ../multi.emul.mjs"

`http://localhost:8765/?emu=<espace>` ouvre l'appli sur le simulateur (localhost uniquement).
