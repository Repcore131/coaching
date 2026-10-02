# Le serveur léger de RepCore — Cloudflare Worker, 0 €

Ce que le plan Spark de Firebase ne fait pas, sans rien payer ni donner de carte :

| Quoi | Quand |
|---|---|
| Notification « Ton coach a répondu à ton bilan » (et au bilan de cycle) | dans la minute qui suit la réponse |
| Notification « Nouveau défi » aux athlètes du coach | dans la minute |
| Défis : équipe, classement, paliers, podium, « Plus que 48 h » | à chaque progression, et chaque matin à 9 h |
| Série en danger | jeudi 17 h (jusqu’à 21 h) |
| Rappel de bilan | samedi 10 h |
| Ton mois en chiffres (Wrapped) | le 1er du mois, 10 h |
| Badge à portée | dimanche 17 h |
| Messages tombés la nuit (21 h – 8 h, heure de l'athlète) | dès 8 h chez l'athlète (vérifié chaque heure) |
| Rareté des badges | chaque nuit, 3 h 17 |
| Parrainage et codes ambassadeur : jugés, rattachés, parrain prévenu | dans la minute |
| Clic sur un lien partagé (écran « Viralité ») | à l'arrivée |

## Règles d'envoi

- **Deux notifications par jour et par personne au plus, la seconde seulement si elle compte.**
  Chaque message a une priorité (`PUSH_PRIORITE`, `src/metier.js`) : duel_fin 90, serie 85,
  duel_j2 80, defi 70, retour, parcours et accueil 60, wrapped 55, badge, filleul, coach et message
  50, reactions 45, bilan, acces et prospect 40, relance 30, sante 20. Le message la précise dans
  `prio`, sinon c'est celle de son type ; le type, lui, reste celui des préférences (`pushPrefs`).
  - `push_log/<clé>` = `{jour, n, at, type, prio}` : le premier push du jour passe toujours ; le
    second seulement si sa priorité est **≥ 80** (la série, un duel) ; jamais de troisième.
  - Le jour est celui de l'athlète, dans son fuseau : un changement d'heure ne le décale pas.
  - Un message refusé pour le plafond ou les heures calmes ne perd pas son travail : le J-2 d'un
    duel (`duels/<id>/rappel`) et les réactions (`reactions_push/<clé>`) ne sont consommés
    qu'après un envoi réussi ou un refus définitif (préférence coupée, aucun appareil).
  - **Le jeudi, de 8 h à 18 h**, l'accès et le rappel de santé se taisent chez un athlète dont la
    série n'est pas validée cette semaine : l'accès repart le lendemain, la santé est sautée.
  - **Le samedi 10 h**, `serie_sam` : « Dernier week-end pour ta série de N semaines », pour qui ne
    s'est pas entraîné depuis jeudi 18 h.
  - Le push urgent de l'administrateur (litige PayPal) reste hors plafond.
- **Rien entre 21 h et 8 h, heure de l'athlète.**
  - Le fuseau, c'est `users/<clé>/tz` : le nom IANA du fuseau de l'appareil (`America/Montreal`),
    écrit par l'app à chaque démarrage s'il a changé.
  - Un fuseau absent ou mal formé vaut `Europe/Paris`. L'app, le Worker et la règle de la base
    partagent le même motif ; `scripts/verif/regles.mjs` vérifie qu'ils restent identiques.
  - Les travaux planifiés (série, bilan, badge, Wrapped, accès, retour) se déclenchent toujours à
    l'heure de **Paris**. Ils n'envoient que si l'heure **locale** de l'athlète est entre 8 h et 21 h.
  - Sinon, le message est **déposé** pour son matin, et compté comme parti : il n'est pas redéposé le
    lendemain.
- **La nuit, un seul message attend : le plus important.**
  - `push_attente/<clé>` = `{message, at, prio, cumul, tz}`.
  - Un nouveau message ne remplace l'attendu que si sa priorité est **au moins égale** :

    | priorité | types |
    |---|---|
    | 5 | coach, message |
    | 4 | acces, prospect |
    | 3 | filleul |
    | 2 | defi, relance, serie, bilan |
    | 1 | wrapped, badge, retour, sante |

    Le mot du coach survit donc au défi de l'équipe.
  - `cumul` compte les messages fusionnés. Au-delà d'un, l'envoi du matin ajoute « + N autres
    nouvelles » au texte.
  - Le travail `attente` passe **chaque heure** : chaque message part quand l'athlète est sorti de
    *ses* heures calmes. 8 h à Montréal, c'est 14 h à Paris. Un message de plus de 14 h est retiré.
- **Une panne passagère ne perd rien.**
  - 429 ou 5xx sur **tous** les appareils : le jour n'est pas consommé.
  - Dans la file (événement, sous-tâche), l'envoi lève `push_transitoire`. `planif.js` le remet en
    fin de file (`essais` + 1 ; au cinquième échec, `evenements_ko`).
  - 404 ou 410 : l'abonnement est mort, il est supprimé.
- **Chaque type se coupe** dans l'app (Réglages → Notifications).
- **Le coût** : le fuseau et les préférences se lisent en **une** requête (la surface du dossier,
  `?shallow=true`). Les rappels planifiés lisent le fuseau dans le profil (`worker/profils`), sans
  requête de plus.

## Ce que coûte le plan gratuit

Cloudflare Workers Free : 100 000 appels par jour, 10 ms de calcul et 50 requêtes par exécution,
5 tâches programmées. RepCore en utilise **une** (chaque minute), soit 1 440 réveils par jour, plus
les appels de l'app. Les rappels planifiés avancent par lots d'une minute à l'autre (mesures plus
bas, « Charge »). Rien ne se facture : au pire, un jour de dépassement, les appels suivants sont
refusés jusqu'à minuit (UTC).

## Installer (une seule fois)

1. **Créer le compte** : <https://dash.cloudflare.com/sign-up> (gratuit, sans carte). Choisir un
   sous-domaine `workers.dev` quand il est demandé — l'adresse du serveur sera
   `https://repcore-serveur.<ce-sous-domaine>.workers.dev`.
2. **Se connecter depuis le PC** (ouvre le navigateur, tu valides) :
   ```
   cd cloudflare
   npx wrangler@4 login
   ```
3. **L'accès à la base : un compte de service** (voir « Accès à la base » plus bas) — la clé JSON
   dans `C:\Users\kevin\RepCore-secrets\compte-service.json`, puis :
   ```
   powershell -ExecutionPolicy Bypass -File C:\RepCore-web\cloudflare\compte-service.ps1
   ```
4. **La clé privée des notifications** (elle est dans `C:\Users\kevin\RepCore-secrets\vapid-privee.txt`,
   hors du dépôt) :
   ```
   type C:\Users\kevin\RepCore-secrets\vapid-privee.txt | npx wrangler@4 secret put VAPID_PRIVATE_KEY
   ```
5. **Déployer** : la première fois à la main (`npx wrangler@4 deploy`), ensuite **par GitHub**
   seulement — voir « Déployer » ci-dessous.
6. Vérifier : `https://repcore-serveur.<sous-domaine>.workers.dev/sante` doit répondre
   `{"ok":true,"base":true,"vapid":true,"derniereMinuteIlYA_s":…,"file":0,"ko":0}` — `ok` n'est vrai
   qu'une fois la première minute passée (voir « La veille »). Le détail (mode d'accès à la base, secrets posés) est
   réservé à l'administrateur : `/sante?cles=1` (voir « Limites »).

L'adresse du serveur est ensuite posée dans l'app (`SERVEUR_LEGER_URL`, `app/rc-core.*.js`) et dans
les pages publiques (`index.html`, `i/`, `p/`, `c/`), puis livrée : c'est ce qui allume le tout.

## Déployer

**Le Worker part de `main`, par `.github/workflows/cloudflare.yml`, et de nulle part ailleurs.**

| quand | ce qui tourne |
|---|---|
| une PR qui touche `cloudflare/`, `functions/*-calcul.js` ou `tarifs.json` | `npm test` et la compilation (`wrangler deploy --dry-run`) ; **rien n'est déployé** |
| un push sur `main` qui touche ces fichiers, ou *Run workflow* sur `main` | les tests, puis `wrangler deploy --tag <commit>`, puis la **sonde** `/sante` (5 essais, 30 s d'écart : `ok`, `vapid` et `base` vrais). Sonde en échec : `wrangler rollback` vers la version précédente, et le travail est **rouge** |
| chaque matin (05:23 UTC) | la **concordance** : la version en ligne doit porter le tag du dernier commit de `main` qui touche le Worker. Un déploiement fait à la main depuis une autre branche, ou un déploiement raté : **rouge** |

Un `npx wrangler deploy` depuis ton poste reste possible en urgence. La concordance du lendemain sera
alors rouge, tant que *Run workflow* sur `main` n'aura pas remis la version de `main`.

### Les deux secrets GitHub (une fois)

1. **Le jeton Cloudflare** : Cloudflare → *My Profile* (en haut à droite) → *API Tokens* →
   *Create Token* → modèle **« Edit Cloudflare Workers »** → *Use template*.
   - *Account Resources* : ton compte seulement.
   - *Zone Resources* : *All zones* convient (le Worker est sur `workers.dev`).
   - *Continue to summary* → *Create Token*, puis **copier le jeton** : il n'est montré qu'une fois.
2. **L'identifiant du compte** : Cloudflare → *Workers & Pages* → colonne de droite, **Account ID**.
3. Dépôt GitHub → *Settings* → *Secrets and variables* → *Actions* → *New repository secret* :
   - `CLOUDFLARE_API_TOKEN` : le jeton ;
   - `CLOUDFLARE_ACCOUNT_ID` : l'identifiant.

Sans eux, le travail affiche un avertissement et ne déploie rien.

**Les secrets du Worker lui-même** (`FIREBASE_SERVICE_ACCOUNT`, `VAPID_PRIVATE_KEY`, `PAYPAL_*`…) restent
posés chez Cloudflare par `wrangler secret put`. Un déploiement ne les touche pas, et ils ne passent
jamais par GitHub.

## Comment ça marche

- **Pas de déclencheurs de base** (Firebase ne sait pas appeler un Worker) : l'app **dépose un
  événement** dans `/evenements` (réponse du coach, défi publié ou mis à jour, demande de
  parrainage ou d'ambassadeur, abonnement PayPal souscrit) et appelle `/reveil`. Le Worker le relève tout de suite, ou au
  plus tard dans la minute, **relit la base** pour vérifier ce qu'il annonce, agit, puis le supprime.
- **Le Worker ne relit jamais les séances d'un athlète** (10 ms de calcul) : c'est l'app de
  l'athlète qui écrit sa progression dans chaque défi où il est inscrit.
- **Le Worker écrit `droits/` par `majDroits`, en transaction, et ne réécrit jamais un accès posé à
  la main** (source `main` ou `suspension`, écran Accès du créateur). C'est lui seul qui l'écrit : le
  paiement PayPal (`/paypal`), l'essai (`/fn/ouvrirEssai`, `essai.js`), l'achat d'un programme
  (`/fn/verifierAchatProgramme`, même chemin que le webhook), les codes de coach, le parrainage. Les
  règles le ferment à tous les clients ; dans l'app, un nœud `droits/` non vide prime sur le dossier.
- État de travail (curseurs des lots) : `/worker/jobs/<nom>`, fermé à tous les clients.
- **Un événement à la fois par type, par compte et par cible** : l'app écrit l'événement ET son
  verrou `evenements_attente/<compte>/<type>/<cible>` (`{id, at}`, `at` à l'heure du serveur) dans la
  même requête. Les règles refusent l'un sans l'autre, et un deuxième tant que le premier est dans la
  file ou date de moins de 30 s. La cible est l'athlète (`reponse_*`), le défi (`defi_*`) ou `-`, et
  elle doit exister (un coach ne vise que ses athlètes, un défi que son Canal). Testé sur l'émulateur :
  `node test/regles-evenements.emu.mjs` (Java et l'émulateur de la Realtime Database requis).

## Les événements saisonniers (`src/saisons.js`)

Des éditions limitées dans `/saisons/<id>` (`/evenements` est la file du
Worker). Travail HORAIRE `saisons` (`heure: true` dans `planif.js`) : pour
chaque saison suivie (du début à deux jours après la fin), la progression
écrite par les apps (`saisons_progres`), le compteur collectif
(`/stats/saisons/<id>`), le badge Édition de qui a bouclé
(`/saisons_resultats`), et une annonce à la fois — lancement, mi-parcours aux
retardataires, J-2, fin — entre 9 h et 21 h, Paris. Les push qui dépassent le
budget de la minute sont différés dans la file. Tests : `test/saisons.test.mjs`.

## Les duels (`src/duels.js`)

Deux athlètes, une mesure, 7 à 28 jours (`/duels/<id>`, lu par les deux
seulement). L'app dépose `duel_rejoint` (l'invité a relevé) et `duel_maj`
(une séance terminée) ; le Worker démarre le duel à la première séance de
l'invité, recopie les scores depuis la progression que chacun écrit (règle des
défis du Canal : il ne relit jamais les séances), pousse le début, J-2 et le
résultat, et écrit le CHAMPION dans `/defis_resultats`. `/duels_actifs` est
l'index du travail du jour « duels » (18 h 30). Une lecture et une écriture
par événement. Tests : `test/duels.test.mjs`, règles :
`test/regles-evenements.emu.mjs` (émulateur).

## L'aperçu des pages publiques (`src/pages.js`)

`/@<pseudo>` et `/coach/<slug>` : `firebase.json` y redirige, et le Worker
sert la page avec l'aperçu de la personne (WhatsApp, DM Instagram), mis en
cache 6 h. Deux sous-requêtes au plus par page non cachée. Mise en ligne et
vérification à la main : `docs/apercu-liens.md`.

## Tenir dans le plan gratuit (`src/planif.js`)

- **Budget dans les boucles internes aussi.** Un réveil s'arrête à 38 requêtes (plafond : 50) et à
  5 chiffrements de push (~1,3 ms chacun, plafond de calcul : 10 ms). Envoyer un défi à tous les
  athlètes, le rappel des 48 h, les messages de la nuit (8 h 05), les vues des ambassadeurs, les fins
  PayPal des coachs : chaque boucle regarde le budget **avant** chaque tour. Quand il ne suffit plus,
  elle écrit la suite en **sous-tâches** (type `tache`, une par athlète, compte ou ambassadeur) au bout
  de `/evenements`, en une seule écriture, et rend la main. Les règles refusent ce type à l'app.
- **Un échec ne bloque rien.** Un événement ou une sous-tâche qui lève repart **en fin de file** avec
  `essais` + 1 et l'erreur. Au 5e échec, il est rangé dans `evenements_ko/` et retiré de la file. Un
  travail du jour qui lève cinq réveils de suite y va aussi, et ne tourne plus ce jour-là.
  `evenements_ko` s'affiche en tête de l'écran Ambassadeurs (quoi, pour qui, pourquoi), avec un
  bouton « Vu, effacer ».
- **Verrou.** `worker/verrou` = `{jusqua, id, fileLe}`, pris en transaction pour 55 s. Deux exécutions
  (la minute et un `/reveil`) ne traitent jamais la file ensemble ; un bail laissé par une exécution
  morte expire seul.
- **`/reveil`** ne fait rien si la file a été parcourue il y a moins de 30 s (`fileLe`).
- **Purge** : le 1er du mois, 4 h 10, `paypal_evenements` de plus de 90 jours (PayPal ne renvoie
  plus rien après trois jours), par lots de 200, les plus anciens d'abord (`.indexOn: ["at"]`).

## La veille

- **Le pouls** : chaque minute écrit, dans la même écriture que le bail rendu (aucune requête de
  plus), `worker/verrou/pouls` = `{t, requetes, evenements, echecs, erreur, source}`.
- **`/sante`** (public, mis en cache 30 s, 3 lectures au plus) rend
  `{ok, base, vapid, derniereMinuteIlYA_s, file, ko}` : `file` = les événements en attente (`50+`
  au-delà), `ko` = ceux rangés en échec. **503** si le pouls manque ou a plus de 5 minutes, ou si la
  base ne répond pas (`raison` : `pouls_absent`, `pouls_ancien`, `base_injoignable`).
- **`.github/workflows/veille-serveur.yml`**, toutes les 15 minutes : `curl` sur `/sante`. Si ça
  échoue, ou si `ko` a monté depuis le dernier courriel : un courriel (`scripts/envoyer_mail.mjs`,
  mêmes secrets `MAIL_*` que le rapport payeur), **un par heure au plus**, et le travail échoue tant
  que la panne dure. Une panne est vue en 20 minutes au pire, plus le retard éventuel des travaux
  programmés de GitHub.
- **Un événement rangé dans `evenements_ko`** (cinq échecs) envoie aussi un push urgent au créateur,
  un par heure au plus (`worker/alerte_ko`).
- **Les journaux** : `[observability]` dans `wrangler.toml` garde un réveil sur dix (le bilan JSON de
  la minute, et les erreurs) : tableau de bord Cloudflare > Workers > repcore-serveur > Logs.
- **L'essayer** : couper le déclencheur (Workers > repcore-serveur > Settings > Triggers), attendre
  5 minutes, puis lancer la veille à la main (Actions > Veille du serveur > Run workflow) : croix
  rouge et courriel. Remettre le déclencheur.

## Le créateur, reconnu par son UID

Depuis le 01/10/2026, les règles de la base et le Worker ne reconnaissent plus le créateur à son
adresse e-mail (un compte Google, Apple ou lié peut porter la même adresse sous un autre UID), mais
à **son UID Firebase et une adresse vérifiée** : `auth.uid === '<UID>' && auth.token.email_verified === true`.

L'UID vit dans **une seule constante**, `CREATEUR_UID` de `src/createur.js`. Pour la poser :

1. Console Firebase → *Authentication* → *Utilisateurs* → la ligne `guellec.coachingpro@gmail.com`
   → colonne **UID utilisateur** (28 caractères ; ce n'est pas un secret).
2. Remplacer `'UID_CREATEUR_A_POSER'` par cet UID dans `CREATEUR_UID` (pas dans `UID_A_POSER`).
3. `node scripts/poser_uid_createur.mjs` (depuis la racine) : le recopie dans `database.rules.json`.
4. `node scripts/verif/regles.mjs` doit finir par « Rien de bloquant. »

Tant que l'UID n'est pas posé, `regles.mjs` échoue — et avec lui le déploiement (`firebase.yml`) :
des règles déployées avec le texte de remplacement ne reconnaîtraient plus personne comme créateur.
L'adresse du créateur doit aussi être **vérifiée** : le jeton porte `email_verified`. Si elle ne
l'est pas, cliquer le lien de vérification reçu par e-mail, puis se déconnecter et se reconnecter
(le jeton n'est relu qu'à la connexion ou au renouvellement, au plus une heure).

## Limites

- **`/sante?cles=1`** interroge PayPal et Cloudinary : il est réservé à l'administrateur. Poser le
  secret une fois (un long mot de passe au hasard, gardé dans `RepCore-secrets`) :
  ```
  npx wrangler@4 secret put ADMIN_SECRET
  ```
  puis, pour vérifier les clés (PowerShell) :
  ```
  $s = Get-Content C:\Users\kevin\RepCore-secrets\admin-secret.txt
  Invoke-RestMethod https://repcore-serveur.repcore.workers.dev/sante?cles=1 -Headers @{Authorization="Bearer $s"}
  ```
  Sans le secret (ou sans en-tête), la réponse est 401. `/sante` tout court reste public, et ne dit
  que `ok`, `base`, `vapid` et le pouls (voir « La veille ») : le mode d'accès à la base (`acces`) et les secrets posés
  (`paypalPose`, `cloudinaryPose`, `garmin`) ne sortent que par `/sante?cles=1`.
- **Aucune route publique sans limite** (01/10/2026). Trois limiteurs par adresse IP, déclarés dans
  `wrangler.toml` et posés par `npx wrangler deploy` (rien à régler à la main) :
  `LIMITE_ROUTES` (toute requête sauf `OPTIONS`, 120 par minute), `LIMITE_ARRIVEES` (ci-dessous) et
  `LIMITE_REVEIL` (`/reveil`, **POST seulement** — sinon `405` —, 6 par minute). Au-delà : `429`.
- **L'alerte de quota** (`src/pouls.js`) : chaque `429` servi est compté dans
  `worker/pouls_429/<AAAAMMJJHH>` (heure UTC). Au-delà de **500 par heure**, un push urgent part vers
  le créateur, une fois par heure. Chaque nuit (03:30 UTC), les jours posés dans le futur sous
  `/metrics` et `/attribution` sont effacés — la règle ne sait pas borner une date.
- **`/arrivee`, `/amb-clic`, `/prospect`, `/vitrine-vue`** : 30 appels par minute et par adresse IP, au-delà `429`. C'est la
  **limitation de débit des Workers** (`[[ratelimits]]` dans `wrangler.toml`, binding
  `LIMITE_ARRIVEES`), gratuite, sans rien à régler dans le tableau de bord. Les **règles de limitation
  du pare-feu** (WAF, *Security → WAF → Rate limiting rules*, une règle gratuite) ne s'appliquent
  qu'à un **domaine à soi** relié à Cloudflare, pas à `*.workers.dev`. Si le serveur passe un jour
  sur un tel domaine, ajouter en plus : *URI Path* `equals` `/arrivee` ou `/amb-clic`, *Characteristics*
  = IP, 5 requêtes par 10 secondes (la seule période du plan gratuit), action *Block*.

## Charge

`node test/charge.test.mjs` simule un coach et N athlètes abonnés aux notifications, sur la base en
mémoire (`CHARGE=10,100,1000` pour choisir N ; `npm test` fait 10 et 100). À chaque réveil : au
plus 50 requêtes, au plus 5 chiffrements, et chacun reçoit son message une fois.

Mesuré le 01/10/2026 (Node 22), après le lot « charge » (jobs en un GET, profils par pages, fenêtre
de 21 h, série dès 17 h). Un réveil par minute :

| abonnés | chemin | réveils (minutes) | fini à | servis | requêtes max / réveil | requêtes en tout | chiffrements max / réveil | calcul médian / max |
|---|---|---|---|---|---|---|---|---|
| 10 | défi publié (12 h) | 3 | 12:02 | 10 | 35 | 96 | 4 | 10.5 / 18.4 ms |
| 10 | série (jeudi 17 h) | 5 | 17:04 | 10 | 34 | 147 | 2 | 5.4 / 8.0 ms |
| 100 | défi publié (12 h) | 25 | 12:24 | 100 | 35 | 851 | 4 | 8.3 / 13.3 ms |
| 100 | série (jeudi 17 h) | 50 | 17:49 | 100 | 34 | 1 409 | 2 | 4.8 / 9.7 ms |
| 1 000 | défi publié (12 h) | 250 | 16:09 | 1 000 | 35 | 8 501 | 4 | 8.8 / 33.4 ms |
| 1 000 | série (jeudi 17 h) | 241 | 21:01 | **480** | 34 | 6 749 | 2 | 6.6 / 15.4 ms |

**Au-delà de ~500 athlètes, ou deux jeudis de suite avec `sautes` > 0 : passer au plan payant.**
Quand, combien, et comment : `docs/capacite.md`. Le mode file (`FILE_PUSH = "queue"`, Cloudflare
Queues) est prêt dans le code et testé à 10 000 abonnés (épreuve (d) ci-dessous).

Et quatre épreuves, dans `npm test` :

| épreuve | résultat |
|---|---|
| (a) **tous** les travaux actifs, jeudi 1er octobre 18 h, 300 abonnés, rien de pré-marqué | **300/300 servis à 20:13**, au plus 35 requêtes par réveil |
| (b) la série lancée à 20 h 40 pour 300 : la fenêtre se ferme | 40 servis, 260 dans `sautes` et dans `evenements_ko`, aucun compté sans push |
| (c) base vide, 1 440 minutes (minute + alerte de quota) | **7 615 sous-requêtes par jour** (23 098 avant), au plus 9 par réveil |
| (d) **mode file** (plan payant, fausse file en mémoire), 10 000 abonnés, série du jeudi | **10 000/10 000 servis**, enfilés en 1 réveil, 505 lots de 20, 1 % de 503 rejoués, personne deux fois |

Ce qu'il faut en retenir :

- **LES NOUVEAUX PLAFONDS.** Série du jeudi : **~480 athlètes** servis entre 17 h et 21 h (180 avant :
  18 h–21 h, et trois à cinq lectures par athlète, même pour ceux qu'on ne relance pas). Un défi
  publié : toujours 4 par minute par la file, ~1 000 en 4 h. Au-delà de 480 athlètes à relancer le
  même jeudi, la liste s'arrête à 21 h : `worker/jobs/serie/sautes` dit combien, et une ligne
  `travail_incomplet` apparaît dans l'écran des échecs (`evenements_ko`).
- **Ce qui a changé** :
  - `worker/jobs` se lit en **un GET** par réveil, et ne s'écrit qu'en **un update** final, celui qui
    rend aussi le verrou. Un travail fini ne coûte plus rien ; une minute à vide en coûte 5.
  - Les rappels (`serie`, `acces`, `retour`, `wrapped`) lisent `worker/profils` et `push_log` **par
    pages de 200** (une requête chacune) : un athlète écarté (série cassée, déjà notifié aujourd'hui,
    pas d'échéance) ne coûte plus aucune requête. Le profil est rafraîchi à chaque fin de séance
    (`seance_fin`) et, s'il manque ou date de plus de 7 jours, par le rappel lui-même — en deux
    requêtes : la « surface » du dossier (`?shallow=true` : tous ses champs simples d'un coup) et
    l'écriture. Il ne sert qu'à **écarter** : un athlète retenu est relu avant tout envoi.
  - `serie`, `retour`, `bilan`, `wrapped`, `badge` et `duels` s'arrêtent à **21 h** : après, le push
    serait écarté (heures calmes) et l'athlète compté traité sans rien recevoir.
  - L'alerte de quota lit son seau toutes les 5 minutes, et non chaque minute.
- **Le chiffrement d'un push coûte ~1,2 à 2 ms** : 5 par réveil au plus (`MAX_CHIFFREMENTS`), sous
  les 10 ms. **Ce sont toujours les 50 requêtes qui bornent** : un push en coûte 5 (préférences,
  abonnements, transaction du journal, envoi), un rappel planifié retenu ~7 de plus au pire ; d'où 2
  rappels par minute (le travail garde 15 + 2 requêtes de marge par athlète).
- Le « calcul » est celui de Node, hors base simulée mais avec ses réponses fabriquées : une
  estimation haute. Les pics (premier réveil, JIT) ne se reproduisent pas dans un Worker chaud.
- **Le levier suivant**, si 480 ne suffit plus : passer au plan payant de Cloudflare (1 000
  sous-requêtes par exécution), ou étaler la série sur le mercredi soir.

- **PayPal** (`POST /paypal`) : chaque événement est vérifié chez PayPal (signature).
  - **Dans le plafond des 50 sous-requêtes** (01/10/2026). Un webhook a un budget de 44 (`BUDGET_REQUETE`,
    `index.js`) ; mesuré avant ce lot, un premier paiement complet en coûtait 72 d'un bloc.
    - Ce qui peut attendre la minute suivante part en sous-tâches : les suites d'un premier paiement
      (parrain, ambassadeur, attribution) ; la reprise d'un premier paiement remboursé ou contesté ;
      les push (parrain, filleul, litige) ; les orphelins au-delà du premier, et l'événement du lien
      après eux, dans l'ordre de PayPal. Chaque sous-tâche est gardée par sa transaction : la rejouer
      ne compte rien deux fois.
    - Avant chaque écriture, il reste au moins 8 requêtes, sinon `ErreurBudget` est levée **avant
      d'écrire** : réponse 503, l'événement reste `en_cours`, et PayPal le renvoie.
    - Les tests (`paypal.test.mjs`, `remboursements.test.mjs`) comptent chaque sous-requête de chaque
      webhook : au plus 40 aujourd'hui, 46 exigés.
  - **Une seule fois** : `paypal_evenements/<id>` passe à `en_cours` avant le traitement, à `fait`
    après son succès seulement. Un renvoi d'un événement `fait` : 200. Pendant un `en_cours` de moins
    de 10 min : 503 (PayPal renverra). Plus vieux : repris. Une erreur : état `erreur`, réponse 500.
  - **Le compte** se lit dans `custom_id` (posé par l'app sur l'abonnement, `<clé>|<programme>` sur
    la commande d'un programme), relu chez PayPal ; jamais d'après l'adresse du payeur. Un événement
    sans compte est rangé dans `paypal_orphelins/<abonnement>` et rejoué, dans l'ordre, dès que le lien
    est fait (par `indexer()` ou par un événement suivant).
  - **Paiement** : n'ouvre que si l'abonnement, relu chez PayPal, est `ACTIVE` et que c'est le courant
    du dossier (`paypalSubscriptionId`). Un coach retrouve le palier du plan payé. Le premier paiement
    (parrain, ambassadeur, statistique « payant ») n'est compté que si plan, montant et devise sont
    dans `OFFRES_PAYPAL` (miroir des offres de l'app, vérifié par un test) ; un programme, au prix de
    la boutique.
  - **Résiliation, suspension, fin** : ignorées pour un abonnement qui n'est pas le courant. L'accès
    reste ouvert jusqu'à `max(fin déjà posée, fin payée + mois en réserve)`. La réserve n'est consommée
    qu'à la fin effective (travail `fins_coachs`, 6 h, en transaction) ; si l'abonnement repart avant,
    elle reste acquise. Un coach garde son palier jusque-là, puis il se referme.
  - **Jeton OAuth** gardé en mémoire du worker jusqu'à son expiration.
  - **Remboursements, rétrofacturations, litiges** (`PAYMENT.SALE.REFUNDED`, `PAYMENT.CAPTURE.REFUNDED`,
    `PAYMENT.SALE.REVERSED`, `CUSTOMER.DISPUTE.CREATED` / `RESOLVED`). Chaque encaissement est noté dans
    `paypal_transactions` (à qui, combien, premier paiement ou non) ; ceux d'avant sont relus chez PayPal.
    - total, rétrofacturation, litige perdu : commission « annulée » ; et si c'était le premier paiement,
      mois offert au parrain repris (réserve, ou mois au bout d'un accès encore à venir), sinon une
      **dette** d'un mois soldée sur son prochain mois gagné ; état « payant » retiré de l'attribution ;
      accès du remboursé fermé à la date du remboursement (programme : ce programme seul) ;
    - partiel : la commission seule, au prorata (`commissionInitiale` gardée) ;
    - litige ouvert : commission « suspendue » (ni due ni exportée) ; gagné : rétablie, rien d'autre ;
    - une seule reprise par transaction : la rétrofacturation qui suit un litige perdu ne refait rien.
    Chaque cas écrit une ligne dans `paypal_journal` (qui, quoi, pourquoi, ce qui a été fait), lue en
    tête de l'écran Ambassadeurs de l'administrateur ; chaque litige envoie un push à Kevin, à toute
    heure et hors plafond quotidien.
- **Le mois offert au parrain** est crédité dans son dossier : fin PayPal reculée d'un mois (seulement
  si PayPal a vraiment posé une fin), accès daté prolongé, mois en réserve s'il paie déjà (ou est
  suivi, ou a un Ultime acheté), sinon un mois d'Essentielle.
- **Les appels de l'app** (`POST /fn/<nom>`, jeton Firebase vérifié) : `cloudinaryDestroy`, qui
  supprime une vidéo de correction (la sienne, ou celle d'un de ses athlètes pour le coach).
- **Fin d'accès** : chaque jour à 11 h, « Ton accès se termine dans N jours » (3 jours ou moins),
  une fois par échéance.

## Brancher les paiements (une seule fois)

1. PayPal Developer (https://developer.paypal.com/dashboard/applications/live) > l'application
   RepCore > **Webhooks > Add Webhook** :
   - URL : `https://repcore-serveur.repcore.workers.dev/paypal`
   - Événements : `BILLING.SUBSCRIPTION.ACTIVATED`, `.CANCELLED`, `.EXPIRED`, `.SUSPENDED`,
     `.PAYMENT.FAILED`, **`.UPDATED`** (changer de formule, lot 45), `PAYMENT.SALE.COMPLETED`,
     `PAYMENT.SALE.REFUNDED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`.
   - Noter le **Webhook ID** affiché, et le **Secret** de l'application (même page).
2. Cloudinary (https://console.cloudinary.com/settings/api-keys) : **API Key** et **API Secret**.
3. `powershell -ExecutionPolicy Bypass -File C:\RepCore-web\cloudflare\secrets-paiements.ps1`
   pose les quatre secrets. `/sante?cles=1` doit alors dire `"paypal":"ok","cloudinary":"ok"`.

Sans ces secrets, rien ne casse : `/paypal` refuse (signature invérifiable), et les suppressions
de vidéos attendent dans la file de l'app jusqu'à ce que le serveur sache les faire.

Le **nom du compte Cloudinary** vient du worker, jamais de l'app : secret facultatif
`CLOUDINARY_CLOUD_NAME` (`npx wrangler@4 secret put CLOUDINARY_CLOUD_NAME`), `dntu57ml` à défaut.

### Qui peut supprimer quoi

`cloudinaryDestroy` ne croit rien de ce que l'app envoie, à part l'identifiant du média :

- le propriétaire de `repcore/<id>/…` est lu dans `/medias_proprio/<id>` (écrit une seule fois par le
  compte lui-même), et doit porter `users/<proprio>/id === <id>`, id qu'aucun autre dossier ne porte
  (requête indexée sur `users/.indexOn: ["id"]`) ;
- l'appelant est ce propriétaire, ou son coach : `users/<proprio>/coachEmailKey` le désigne **et**
  `coachs/<coach>/clients/<proprio>` vaut `true` (liste écrite par le coach seul, et seulement pour un
  athlète qui le désigne) ;
- réponses : 400 (identifiant invalide) et 403 (pas le tien) sont définitives, l'app sort le média de
  sa file ; 409 (propriétaire pas encore indexé) et 503 le laissent en file.

### Les envois signés (`cloudinarySigner`, 01/10/2026)

L'app ne poste plus rien à Cloudinary sans une **signature du Worker** : `/fn/cloudinarySigner`
vérifie le jeton Firebase, impose le dossier (`repcore/<id du compte>[/<rubrique>]`, celui d'un
athlète dont l'appelant est le coach — même contrôle que la suppression —, ou
`repcore/audio/<clé de l'athlète>`), signe les formats (`allowed_formats`) et limite à **30 signatures
par heure et par compte**. Le secret est le même `CLOUDINARY_API_SECRET` que pour la suppression.
Preset signé : `repcore_videos` par défaut, ou le secret facultatif `CLOUDINARY_UPLOAD_PRESET`.

**À faire par Kevin dans la console Cloudinary, une fois le Worker déployé** (sinon un envoi sans
signature reste possible, puisque le preset public existe encore) :

1. https://console.cloudinary.com → **Settings** → **Upload** → **Upload presets** → `repcore_videos`.
2. **Signing mode** : passer de *Unsigned* à **Signed**. Enregistrer. À partir de là, un envoi sans
   signature valide est refusé par Cloudinary (`401 Upload preset must be whitelisted for unsigned
   uploads`).
3. Dans le même preset, **Upload control** :
   - **Allowed formats** : `mp4, mov, webm, jpg, png, webp` (plus `ogg, m4a` si les commentaires
     audio doivent continuer de passer : ils partent comme des vidéos) ;
   - **Max file size** : la console n'a qu'un plafond par preset. Mettre **100 Mo** sur
     `repcore_videos` ; pour tenir **10 Mo** sur les images, créer un second preset signé
     `repcore_images` (formats `jpg, png, webp`, 10 Mo) et le poser en secret
     `CLOUDINARY_UPLOAD_PRESET_IMAGE` — le Worker l'utilisera pour les images dès qu'il est posé.
4. Vérifier : un envoi depuis l'app passe ; `curl -F file=@x.jpg -F upload_preset=repcore_videos
   https://api.cloudinary.com/v1_1/dntu57ml/image/upload` répond une erreur.

Les comptes Cloudinary « personnels » d'un coach (`cloudinaryName`/`cloudinaryPreset` dans son
dossier) ne servent plus aux envois : seul le compte du service sait être signé par le Worker.

## Paiement direct au coach (`paiements-coach.js`) : FERMÉ tant que la sandbox ne l'a pas prouvé

Un coach relié (palier Coach ou Pro) encaisse ses formules sur **son** compte PayPal : la commande
Orders v2 porte `payee` = le coach, **aucun** `platform_fees`, rien ne passe par le compte RepCore
(NOTE-DECISION-MODELE-ECONOMIQUE.md §2). Tout le parcours refuse de s'ouvrir tant que la variable
`PAIEMENTS_COACH` ne vaut pas `oui`. Elle n'est pas posée : c'est voulu.

Ce que la documentation PayPal ne dit pas, et que la sandbox doit trancher avant d'ouvrir :
1. une commande créée avec les identifiants de RepCore et `payee` = un autre compte est-elle acceptée
   sans accord de partenaire ? (sinon PayPal répond `PAYEE_NOT_CONSENTED` ou `NOT_AUTHORIZED`) ;
2. le webhook `PAYMENT.CAPTURE.COMPLETED` d'une telle commande arrive-t-il chez nous ? (la capture au
   retour de l'athlète ouvre déjà l'accès : le webhook n'est qu'un filet) ;
3. un remboursement fait depuis le compte du coach nous est-il signalé (`PAYMENT.CAPTURE.REFUNDED`) ?

La marche à suivre (developer.paypal.com, onglet Sandbox) :
1. créer deux comptes sandbox Business (RepCore et un coach) et un compte Personal (l'athlète) ;
2. une application sandbox rattachée au compte RepCore : noter son Client ID et son secret ;
3. un Worker de test : `npx wrangler deploy --env sandbox`, avec un bloc `[env.sandbox]` dans
   wrangler.toml (`name = "repcore-serveur-sandbox"`, vars `PAYPAL_API_BASE = "https://api-m.sandbox.paypal.com"`,
   `PAIEMENTS_COACH = "oui"`, `PAYPAL_CLIENT_ID` = celui de sandbox) et le secret posé par
   `npx wrangler secret put PAYPAL_CLIENT_SECRET --env sandbox` ;
4. relier le merchant id du coach sandbox, payer une formule avec le compte Personal, vérifier dans le
   tableau de bord sandbox que l'argent est **chez le coach**, et que RepCore n'a rien reçu ;
5. rembourser depuis le compte du coach et regarder si `paiements_coach/<coach>/<commande>` passe à
   `rembourse`. Sinon, le dire : le remboursement ne serait alors connu que du coach.

Ensuite seulement : `PAIEMENTS_COACH = "oui"` dans `[vars]`, puis `npx wrangler deploy`.

## Garmin (`garmin.js`) : FERMÉ tant que les quatre secrets ne sont pas posés

La montre envoie seule : Garmin pousse les journées (`dailies`), les nuits
(`sleeps`) et la variabilité (`hrv`) au Worker, qui les écrit comme Health
Connect. Sans les secrets, `/garmin/push` répond 404 et l'app garde les
instructions du guide Garmin.

1. Demander l'accès au **Garmin Connect Developer Program** (Health API),
   https://developer.garmin.com/gc-developer-program/ ; créer l'application
   (OAuth 2.0 PKCE). Garmin fournit un *consumer key* et un *consumer secret*.
2. Redirect URI de l'application : `https://repcore-serveur.repcore.workers.dev/garmin/retour`.
3. Tirer un secret d'envoi et une clé de chiffrement :
   `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"` (secret d'envoi) ;
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` (clé).
4. Les poser : `npx wrangler secret put GARMIN_CLIENT_ID`, `GARMIN_CLIENT_SECRET`,
   `GARMIN_PUSH_SECRET`, `GARMIN_CLE`.
5. Dans l'outil « Endpoint Configuration » du portail Garmin, déclarer en **push**
   (pas en ping) pour Dailies, Sleeps, HRV, Deregistrations et User Permissions :
   `https://repcore-serveur.repcore.workers.dev/garmin/push/<GARMIN_PUSH_SECRET>`.
6. Vérifier : `/sante?cles=1` dit `"garmin": true`, puis relier un compte de test depuis
   l'app (Lifestyle › Connecter mes données santé › Connecter Garmin) et
   synchroniser la montre : la journée arrive dans `sante_sync/<clé>/jours`.

⚠ Garmin ne signe pas ses envois : c'est le secret de l'adresse (et l'en-tête
`garmin-client-id` quand il est présent) qui les authentifie. Changer
`GARMIN_PUSH_SECRET` impose de redéclarer l'adresse au portail.

## Pas encore branché

- **Le mois de mentorat** de l'Ultime (il vivait dans `droits/` côté Cloud Functions ; pas encore porté dans le Worker).
- **L'aperçu personnalisé** des liens `/@pseudo` et `/coach/slug` (emblème du rang, prénom) : ils
  gardent l'aperçu par défaut.

## Accès à la base

Le worker lit et écrit la Realtime Database **en administrateur**, avec un **jeton d'accès OAuth** tiré
d'un compte de service Google et envoyé dans l'en-tête `Authorization` (`src/google.js`). Il vaut
une heure, se renouvelle seul, et la clé qui le signe ne quitte jamais le worker.

Il remplace l'ancien **code secret de la base de données** (`FIREBASE_DB_SECRET`) : un accès total,
sans expiration, envoyé dans l'URL de chaque requête (`?auth=…`), donc dans les journaux de ce
qu'elle traverse. Tant que le compte de service n'est pas posé, le worker s'en sert encore, et
`/sante?cles=1` le dit : `"acces":"secret_historique"`. L'état voulu est `"acces":"compte_service"`.

### Mise en place (une fois)

1. Console Google Cloud, projet `repcore-sync` :
   <https://console.cloud.google.com/iam-admin/serviceaccounts?project=repcore-sync> → **Créer un
   compte de service** → nom `repcore-worker`.
2. Rôle : **Firebase Realtime Database Admin** (`roles/firebasedatabase.admin`), et rien d'autre.
   Pas le compte `firebase-adminsdk` : il ouvre tout le projet (authentification, hébergement…).
3. Le compte → **Clés** → **Ajouter une clé** → **JSON**. Enregistrer le fichier sous
   `C:\Users\kevin\RepCore-secrets\compte-service.json`, **hors du dépôt**.
4. `powershell -ExecutionPolicy Bypass -File C:\RepCore-web\cloudflare\compte-service.ps1` : pose
   le secret `FIREBASE_SERVICE_ACCOUNT`, vérifie `/sante?cles=1`, puis retire `FIREBASE_DB_SECRET` du worker.
5. **Révoquer l'ancien code secret** : console Firebase → ⚙ Paramètres du projet → Comptes de
   service → Codes secrets de la base de données → supprimer. Tant qu'il existe, il ouvre toute la
   base, à qui l'a.

### Rotation (tous les 90 jours, ou tout de suite si la clé a pu fuiter)

1. Même page, compte `repcore-worker` → **Clés** → **Ajouter une clé** → JSON : remplacer
   `compte-service.json` par le nouveau fichier.
2. Relancer `compte-service.ps1` : le worker prend la nouvelle clé au déploiement du secret (les
   jetons déjà émis avec l'ancienne restent valables au plus une heure).
3. `/sante?cles=1` doit dire `"acces":"compte_service"`.
4. Supprimer l'**ancienne** clé dans **Clés** (son identifiant est `private_key_id` dans l'ancien
   fichier), puis effacer l'ancien fichier.

Une clé supprimée chez Google ne signe plus rien : c'est la révocation. Aucun code à changer.

## Tester

**Tous les tests d'un coup** (Node 22 ou plus, rien à installer) :

```
cd cloudflare
npm test
```

`npm test` lance `node --test "test/*.test.mjs"` : chaque fichier `*.test.mjs` tourne dans son
propre processus, l'un après l'autre, et le tout échoue si un seul échoue. Aujourd'hui :

| Fichier | Ce qu'il vérifie |
|---|---|
| `google.test.mjs` | le jeton du compte de service : JWT RS256 signé par la clé, échangé chez Google, gardé jusqu'à 5 min de son expiration ; la base l'envoie en en-tête, plus rien dans l'URL |
| `index.test.mjs` | le point d'entrée `fetch` : `OPTIONS /fn/cloudinaryDestroy` → 204 **sans corps** et en-têtes CORS ; `POST` sans jeton → 401 avec CORS ; aucune erreur ne sort sans CORS |
| `appels.test.mjs` | le jeton Firebase (RS256) et la suppression Cloudinary : propriétaire et coach réel acceptés, id usurpé et coach usurpé refusés (403), index absent (409), compte Cloudinary pris dans le worker |
| `metier.test.mjs` | le métier sur une base en mémoire, budget de requêtes compris |
| `remboursements.test.mjs` | remboursement total d'un premier paiement, mois consommé (dette puis soldée), mois retiré d'un accès, rétrofacturation, remboursement partiel puis solde, litige ouvert puis gagné (push à Kevin), litige perdu puis rétrofacturation, litige perdu en partie, paiement suivant remboursé, paiement d'avant le registre, programme remboursé |
| `paypal.test.mjs` | les webhooks PayPal : signature, double envoi, erreur puis renvoi, `en_cours` repris, orphelin rejoué, liaison par `custom_id`, paiement après annulation, suspension + annulation avec mois en réserve, ancien abonnement annulé, coach qui repaie, montants contre `OFFRES_PAYPAL`, achat de programme, jeton en cache |
| `push.test.mjs` | chiffrement RFC 8291 et jeton VAPID, vérifiés côté appareil |
| `planif.test.mjs` | la file sous contrainte : échec en fin de file puis `evenements_ko` au 5e, erreur puis réussite, verrou (deux exécutions, bail échu), `/reveil` à moins de 30 s, défi à 30 athlètes et rappel des 48 h en sous-tâches, ambassadeurs et fins de coachs différés, purge des 90 jours, `/sante?cles=1` protégé, limite par IP |
| `charge.test.mjs` | charge simulée (10 et 100 abonnés ; 1 000 avec `CHARGE=10,100,1000`) : requêtes, chiffrements et calcul par réveil |

Un fichier seul : `node test/index.test.mjs` (depuis `cloudflare/`).

Dans le vrai moteur Cloudflare (wrangler dev) :

```
sh cloudflare/test/essai-workerd.sh <dossier>
```

⚠ **Une réponse 204 ou 304 n'a jamais de corps**, pas même `''` : `new Response('', {status:204})`
lève « Invalid response status code 204 ». Le helper `reponse()` de `src/index.js` passe `null`
pour ces statuts ; tout le `fetch` est dans le `try`, pour qu'aucune exception ne sorte sans
en-têtes CORS (le navigateur la verrait comme « Impossible de joindre le serveur »).
