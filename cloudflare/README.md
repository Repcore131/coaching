# Le serveur léger de RepCore — Cloudflare Worker, 0 €

Ce que le plan Spark de Firebase ne fait pas, sans rien payer ni donner de carte :

| Quoi | Quand |
|---|---|
| Notification « Ton coach a répondu à ton bilan » (et au bilan de cycle) | dans la minute qui suit la réponse |
| Notification « Nouveau défi » aux athlètes du coach | dans la minute |
| Défis : équipe, classement, paliers, podium, « Plus que 48 h » | à chaque progression, et chaque matin à 9 h |
| Série en danger | jeudi 18 h |
| Rappel de bilan | samedi 10 h |
| Ton mois en chiffres (Wrapped) | le 1er du mois, 10 h |
| Badge à portée | dimanche 17 h |
| Messages tombés la nuit (21 h – 8 h) | 8 h 05 |
| Rareté des badges | chaque nuit, 3 h 17 |
| Parrainage et codes ambassadeur : jugés, rattachés, parrain prévenu | dans la minute |
| Clic sur un lien partagé (écran « Viralité ») | à l'arrivée |

Règles d'envoi : **une notification par jour et par personne au plus**, rien entre 21 h et 8 h
(heure de Paris), chaque type se coupe dans l'app (Réglages → Notifications).

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
5. **Déployer** :
   ```
   npx wrangler@4 deploy
   ```
6. Vérifier : `https://repcore-serveur.<sous-domaine>.workers.dev/sante` doit répondre
   `{"ok":true,"base":true,"secret":true,"acces":"compte_service","vapid":true}`.

L'adresse du serveur est ensuite posée dans l'app (`SERVEUR_LEGER_URL`, `app/rc-core.*.js`) et dans
les pages publiques (`index.html`, `i/`, `p/`, `c/`), puis livrée : c'est ce qui allume le tout.

## Comment ça marche

- **Pas de déclencheurs de base** (Firebase ne sait pas appeler un Worker) : l'app **dépose un
  événement** dans `/evenements` (réponse du coach, défi publié ou mis à jour, demande de
  parrainage ou d'ambassadeur, abonnement PayPal souscrit) et appelle `/reveil`. Le Worker le relève tout de suite, ou au
  plus tard dans la minute, **relit la base** pour vérifier ce qu'il annonce, agit, puis le supprime.
- **Le Worker ne relit jamais les séances d'un athlète** (10 ms de calcul) : c'est l'app de
  l'athlète qui écrit sa progression dans chaque défi où il est inscrit.
- **Le Worker n'écrit jamais dans `droits/`** : dans l'app, un nœud `droits/` non vide prime sur le
  dossier, et y écrire aurait coupé l'essai d'un filleul ou rétrogradé un parrain abonné.
- État de travail (curseurs des lots) : `/worker/jobs/<nom>`, fermé à tous les clients.
- **Un événement à la fois par type, par compte et par cible** : l'app écrit l'événement ET son
  verrou `evenements_attente/<compte>/<type>/<cible>` (`{id, at}`, `at` à l'heure du serveur) dans la
  même requête. Les règles refusent l'un sans l'autre, et un deuxième tant que le premier est dans la
  file ou date de moins de 30 s. La cible est l'athlète (`reponse_*`), le défi (`defi_*`) ou `-`, et
  elle doit exister (un coach ne vise que ses athlètes, un défi que son Canal). Testé sur l'émulateur :
  `node test/regles-evenements.emu.mjs` (Java et l'émulateur de la Realtime Database requis).

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
  Sans le secret (ou sans en-tête), la réponse est 401. `/sante` tout court reste public.
- **`/arrivee` et `/amb-clic`** : 30 appels par minute et par adresse IP, au-delà `429`. C'est la
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

Mesuré le 27/09/2026 (Node 22), après le passage des rappels planifiés par lots. Un réveil par
minute :

| abonnés | chemin | réveils (minutes) | fini à | servis | requêtes max / réveil | requêtes en tout | chiffrements max / réveil | calcul médian / max |
|---|---|---|---|---|---|---|---|---|
| 10 | défi publié (12 h) | 3 | 12:02 | 10 | 34 | 88 | 4 | 6.1 / 13.8 ms |
| 10 | série (jeudi 18 h) | 2 | 18:01 | 10 | 36 | 71 | 5 | 8.6 / 8.6 ms |
| 100 | défi publié (12 h) | 25 | 12:24 | 100 | 34 | 850 | 4 | 4.6 / 7.3 ms |
| 100 | série (jeudi 18 h) | 20 | 18:19 | 100 | 36 | 701 | 5 | 6.4 / 10.3 ms |
| 1 000 | défi publié (12 h) | 250 | 16:09 | 1 000 | 34 | 8 500 | 4 | 5.3 / 14.9 ms |
| 1 000 | série (jeudi 18 h) | 880 | lendemain 08:39 | **1 000** (900 le jeudi) | 36 | 12 897 | 5 | 0.2 / 21.7 ms |

Avant (même jour, même banc) : série à 1 000 abonnés, 2 push par réveil, **360 servis**, les 640
autres rien ; à 100, 50 minutes au lieu de 20.

Ce qu'il faut en retenir :

- **Un rappel planifié ne relit plus le dossier champ par champ.** La série lit `streak`…`streakWeek`
  en une requête (plage de clés `startAt`/`endAt` : cinq compteurs et dates voisins), puis la liste
  des clés du dossier (`shallow`) pour ne lire `suspension` et `pushPrefs` que s'ils existent.
  ⚠ `shallow` ne donne pas les valeurs : Firebase rend `true` pour chaque clé, valeurs simples
  comprises (vérifié sur la base ; la fausse base du banc fait de même). Les abonnements et le
  journal du jour se lisent par lot de 20 clés, en deux requêtes. Le journal s'écrit sans
  transaction (une requête au lieu de deux) : la minute tient le verrou, seul un webhook PayPal
  pourrait passer entre la lecture et l'écriture, et au pire ce serait un second push ce jour-là.
  Les états des travaux du jour se lisent d'un coup (`worker/jobs`), plus un par travail.
  Un push de série coûte ainsi 5 requêtes (plage, clés, prénom, journal, envoi) au lieu de 11.
- **Ce sont maintenant les 5 chiffrements qui bornent** (~1,1 ms chacun, soit ~5,5 ms, sous les
  10 ms) : 5 push par minute pour un rappel planifié, avec 36 requêtes sur 50. La file (défi publié,
  sous-tâches) reste à 4 par minute : elle n'a pas de lot, chaque événement est isolé.
- **La série du jeudi ne perd plus personne.** À 5 par minute, 18 h à 21 h en sert 900. Ce qui
  tombe dans les heures calmes va dans `push_attente` (au lieu d'être jeté) et part le vendredi à
  partir de 8 h 05, **sauf si la semaine a été validée entre-temps** (le message garde `semaine`,
  `tache()` relit `streakWeek` avant d'envoyer). Pour tout servir le jeudi à 1 000, il faudrait
  commencer à 17 h 30 (`travaux()` dans `src/planif.js`).
- Le « calcul » est celui de Node (`performance.now()`, hors base simulée mais avec ses réponses
  fabriquées) : une estimation haute. Les pics (premier réveil, JIT, ramasse-miettes) ne se
  reproduisent pas dans un Worker chaud. Le médian de 0,2 ms de la série à 1 000 : la plupart des
  880 réveils sont ceux de la nuit, où il n'y a rien à faire.

- **PayPal** (`POST /paypal`) : chaque événement est vérifié chez PayPal (signature).
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
     `.PAYMENT.FAILED`, `PAYMENT.SALE.COMPLETED`, `PAYMENT.SALE.REFUNDED`,
     `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`.
   - Noter le **Webhook ID** affiché, et le **Secret** de l'application (même page).
2. Cloudinary (https://console.cloudinary.com/settings/api-keys) : **API Key** et **API Secret**.
3. `powershell -ExecutionPolicy Bypass -File C:\RepCore-web\cloudflare\secrets-paiements.ps1`
   pose les quatre secrets. `/sante` doit alors dire `"paypal":true,"cloudinary":true`.

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

## Pas encore branché

- **Le mois de mentorat** de l'Ultime (il vivait dans `droits/`, que le Worker n'écrit pas).
- **L'aperçu personnalisé** des liens `/@pseudo` et `/coach/slug` (emblème du rang, prénom) : ils
  gardent l'aperçu par défaut.

## Accès à la base

Le worker lit et écrit la Realtime Database **en administrateur**, avec un **jeton d'accès OAuth** tiré
d'un compte de service Google et envoyé dans l'en-tête `Authorization` (`src/google.js`). Il vaut
une heure, se renouvelle seul, et la clé qui le signe ne quitte jamais le worker.

Il remplace l'ancien **code secret de la base de données** (`FIREBASE_DB_SECRET`) : un accès total,
sans expiration, envoyé dans l'URL de chaque requête (`?auth=…`), donc dans les journaux de ce
qu'elle traverse. Tant que le compte de service n'est pas posé, le worker s'en sert encore, et
`/sante` le dit : `"acces":"secret_historique"`. L'état voulu est `"acces":"compte_service"`.

### Mise en place (une fois)

1. Console Google Cloud, projet `repcore-sync` :
   <https://console.cloud.google.com/iam-admin/serviceaccounts?project=repcore-sync> → **Créer un
   compte de service** → nom `repcore-worker`.
2. Rôle : **Firebase Realtime Database Admin** (`roles/firebasedatabase.admin`), et rien d'autre.
   Pas le compte `firebase-adminsdk` : il ouvre tout le projet (authentification, hébergement…).
3. Le compte → **Clés** → **Ajouter une clé** → **JSON**. Enregistrer le fichier sous
   `C:\Users\kevin\RepCore-secrets\compte-service.json`, **hors du dépôt**.
4. `powershell -ExecutionPolicy Bypass -File C:\RepCore-web\cloudflare\compte-service.ps1` : pose
   le secret `FIREBASE_SERVICE_ACCOUNT`, vérifie `/sante`, puis retire `FIREBASE_DB_SECRET` du worker.
5. **Révoquer l'ancien code secret** : console Firebase → ⚙ Paramètres du projet → Comptes de
   service → Codes secrets de la base de données → supprimer. Tant qu'il existe, il ouvre toute la
   base, à qui l'a.

### Rotation (tous les 90 jours, ou tout de suite si la clé a pu fuiter)

1. Même page, compte `repcore-worker` → **Clés** → **Ajouter une clé** → JSON : remplacer
   `compte-service.json` par le nouveau fichier.
2. Relancer `compte-service.ps1` : le worker prend la nouvelle clé au déploiement du secret (les
   jetons déjà émis avec l'ancienne restent valables au plus une heure).
3. `/sante` doit dire `"acces":"compte_service"`.
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
