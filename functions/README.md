# Déploiement — Cloud Functions RepCore

Ce dossier contient 4 Cloud Functions :
- **RCACCESS** (3 fonctions) — signature/vérification serveur des codes d'accès élève (HMAC)
- **verifyPaypalSubscription** (1 fonction) — v��rifie l'abonnement PayPal côté serveur avant
  d'activer le statut `AUTONOMIE_PREMIUM`

- **cloudinaryDestroy** (1 fonction, ajoutée le 23/09/2026) — supprime POUR DE BON une vidéo ou
  une photo chez Cloudinary, après avoir vérifié dans la base que le fichier appartient à
  l'appelant ou à un athlète dont il est le coach désigné. L'API secret ne quitte pas le serveur.

⚠ **AUCUNE DE CES FONCTIONS N'EST DÉPLOYÉE AUJOURD'HUI.** Mesuré le 23/09/2026 : les trois
adresses testées répondent 404 — le projet est en plan Spark, et le déploiement automatique
(`.github/workflows/firebase.yml`) ne publie que l'hébergement. L'application en tient compte :
tout média qu'elle n'a pas pu faire détruire entre dans une file locale (`rc_cloudinary_a_purger`),
rejouée à chaque démarrage et affichée. Le jour où le projet passe en Blaze,
`firebase deploy --only functions` suffit : les files se vident d'elles-mêmes, sans rien changer
à l'app. En attendant, `scripts/purge_cloudinary_orphelins.py` produit la liste des fichiers
orphelins à valider à la main.

Avant de publier le nouveau `index.html`, ces fonctions doivent être déployées.

## Prérequis

- **Plan Firebase Blaze (pay-as-you-go) obligatoire.** Les Cloud Functions ne fonctionnent pas
  sur le plan gratuit Spark. Le quota gratuit inclus dans Blaze (2 millions d'appels/mois) couvre
  très largement l'usage de RepCore — le coût réel attendu est proche de 0��/mois, mais il faut
  activer la facturation sur le projet Firebase pour pouvoir déployer.
- Node.js 20 installé en local (déjà le cas ici).

## 1. Activer Firebase Storage (obligatoire pour les PDF)

Les PDF sont maintenant stockés dans **Firebase Storage** (plus en base64 dans la base de données).
Cela supprime la limite de 4 Mo et les erreurs "stockage plein".

1. Va dans la **Console Firebase → Storage → Démarrer** et active Storage pour le projet `repcore-sync`.
2. Quand Firebase te demande les règles, accepte les règles sécurisées par défaut, puis remplace-les
   dans l'onglet **Règles** par :

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /pdfs/{emailKey}/{fileName} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Publie les règles (bouton **Publier**). Les PDF peuvent maintenant aller jusqu'à **20 Mo**.

> **Note :** Si le bucket par défaut n'est pas `repcore-sync.appspot.com`, mets à jour
> `CLOUD._storageBucket` dans `index.html` (recherche `_storageBucket`).

## 2. Configurer les secrets

```bash
# Secret pour les codes d'accès élève (HMAC) — à faire une seule fois
# Génère une chaîne aléatoire longue, ex. :
openssl rand -base64 32
# Puis enregistre-la (elle ne sera JAMAIS visible côté client) :
firebase functions:secrets:set RCACCESS_TOKEN_SECRET

# Secret PayPal (Client Secret de ton app PayPal Live)
# Récupère-le sur developer.paypal.com → Apps & Credentials → ton app Live → Client Secret
firebase functions:secrets:set PAYPAL_CLIENT_SECRET

# Clé PRIVÉE VAPID du Web Push (voir la section « Web Push » plus bas).
# Colle la valeur qui t'a été remise à part — elle n'est PAS dans le dépôt.
firebase functions:secrets:set VAPID_PRIVATE_KEY
```

## 3. Déployer les fonctions

```bash
# 1. Se connecter (ouvre un navigateur pour l'authentification Google)
firebase login

# 2. Vérifier que le bon projet est sélectionné (le fichier .firebaserc pointe vers "repcore-sync"
#    — à corriger si l'ID réel du projet est différent, visible dans la console Firebase)
firebase use --add

# 3. Installer les d��pendances des fonctions
cd functions && npm install && cd ..

# 4. Déployer uniquement les fonctions (ne touche pas aux règles de la base ni à l'hébergement)
firebase deploy --only functions
```

Après le déploiement, vérifie dans la sortie du terminal l'URL exacte des fonctions
(`generateAccessToken`, `extendAccessToken`, `verifyAccessToken`, `verifyPaypalSubscription`).
Si la région ou le nom du projet diffère de `europe-west1-repcore-sync`, mets à jour
`CLOUD._functionsBase` dans `index.html` (recherche `_functionsBase`) avant de publier.

## Ce que ça corrige

- Les codes d'accès élève (RCACCESS) sont maintenant signés avec une clé secrète connue
  uniquement du serveur — impossible d'en fabriquer un valide à la main, contrairement à avant
  (simple `base64(JSON)` que n'importe qui pouvait décoder et reconstruire).
- Un code désactiv�� par le coach est maintenant réellement bloqué à la saisie (v��rifié
  côté serveur), plus seulement cosmétique côté interface coach.
- Un même code ne peut plus être utilisé par deux personnes différentes (marqué consommé
  après la première utilisation réussie).
- Le bouton « +3 mois » applique maintenant la prolongation directement sur le compte de
  l'élève déjà inscrit, en une seule action côté serveur.
- Le statut `AUTONOMIE_PREMIUM` ne peut être attribué que par le serveur après vérification
  réelle auprès de l'API PayPal — impossible à falsifier côté client.
- Les PDF sont stockés dans Firebase Storage (plus en base64 dans localStorage/RTDB) —
  limite portée à 20 Mo, plus d'erreurs "stockage plein".

## Limite connue

`verifyAccessToken` retrouve le coach via `orderByChild('id').equalTo(...)` sur le nœud
`users` de la Realtime Database. Avec beaucoup d'utilisateurs, ça devient plus lent sans un
index dédié. Si besoin, ajoute manuellement dans la console Firebase (Realtime Database →
Règles) une entrée `".indexOn": ["id"]` sur le nœud `users` — non inclus automatiquement ici
pour ne pas risquer d'écraser les règles de sécurité déjà en place.

## statsBadges — la rareté des badges (26/09/2026)

Fonction **planifiée** (Cloud Scheduler, chaque nuit à 3 h 17 heure de Paris). Elle compte, pour
chaque badge, le pourcentage de dossiers athlètes qui le possèdent, et écrit
`/stats/badges = { maj, total, pct: { <idBadge>: 4.2 } }`. Aucune donnée personnelle : un
pourcentage par badge. Lecture publique, écriture serveur seulement (`database.rules.json`).

Comme les autres, elle demande le **plan Blaze** (Cloud Scheduler inclus : 3 tâches gratuites par
mois de facturation). Tant qu'elle ne tourne pas, `/stats/badges` reste vide et l'écran de
célébration n'affiche pas la ligne de rareté — rien d'autre ne change.

## Web Push — les notifications serveur (26/09/2026)

Jusqu'ici, tous les rappels étaient **locaux** : le service worker se réveillait quand le
navigateur le voulait bien (`periodicsync`, Chrome seulement), et iOS n'en recevait aucun. Le push
serveur part d'ici, à l'heure dite, vers tous les navigateurs qui le prennent en charge — y
compris Safari iOS 16.4+, **à condition que l'app soit installée** sur l'écran d'accueil.

### La paire de clés VAPID

- **Publique** : en clair dans le client (`VAPID_PUBLIQUE`, `app/rc-core.<build>.js`) et dans
  `functions/index.js`. Elle n'a rien de secret.
- **Privée** : **jamais dans le dépôt.** Elle vit dans les secrets Firebase Functions
  (`defineSecret("VAPID_PRIVATE_KEY")`) et n'est lue qu'au moment d'un envoi.

```bash
firebase functions:secrets:set VAPID_PRIVATE_KEY   # colle la clé privée (base64url, 43 caractères)
```

Les deux vont par paire. Pour en changer : `npx web-push generate-vapid-keys`, poser la privée
avec la commande ci-dessus, remplacer la publique **aux deux endroits**, puis déployer client et
fonctions. Chaque appareil voit au démarrage que l'empreinte de la clé a changé et se réabonne
tout seul (sauf sur iOS, où il faut repasser par le bouton des réglages).

### Les nœuds

| Nœud | Qui | Contenu |
|---|---|---|
| `/push/<emailKey>/<id>` | l'athlète (lecture, écriture) | `{endpoint, keys:{p256dh, auth}, cree, plateforme, vapid}` — une souscription par appareil ; `id` = hachage de l'endpoint |
| `/users/<emailKey>/pushPrefs` | l'athlète (dans son dossier) | `{<type>: false}` — les types coupés ; tout est allumé par défaut |
| `/push_log/<emailKey>` | serveur seul | `{jour, at, type}` — le plafond quotidien |
| `/push_attente/<emailKey>` | serveur seul | un message mis de côté pendant les heures calmes |

⚠ Les souscriptions ne sont **pas** dans `/users/<emailKey>/push` : le client envoie le dossier
entier par `PUT`, qui effacerait un enfant écrit à part.

### Les règles d'envoi — `envoyerPush(uid, message)`

- **Un push par jour et par utilisateur au plus** (jour de Paris), réservé par transaction sur
  `/push_log` — deux fonctions qui tirent en même temps n'en envoient pas deux.
- **Heures calmes : 21 h – 8 h, Europe/Paris.** Un événement (réponse du coach, défi) tombé la
  nuit est mis dans `/push_attente` et part à 8 h 05 (`pushApresHeuresCalmes`), s'il a moins de
  12 h. Les rappels planifiés tombent toujours hors de cette plage.
- **Chaque type se coupe** dans l'app : Réglages → Notifications (`pushPrefs`). Un type coupé
  coupe aussi le rappel local équivalent (série, Wrapped).
- **Souscriptions expirées** : un `404` ou un `410` du service push supprime
  `/push/<uid>/<id>` ; si aucun appareil n'a reçu le message, le jour n'est pas décompté.

### Les fonctions

| Fonction | Quand | Type |
|---|---|---|
| `pushSerieEnDanger` | jeudi 18 h (Paris) | `serie` — série > 0, semaine pas validée, hors suspension |
| `pushWrappedPret` | le 1er du mois, 10 h | `wrapped` — seulement si l'athlète s'est entraîné le mois écoulé |
| `pushRappelBilan` | samedi 10 h | `bilan` — dernier bilan vieux de 13 jours ou plus |
| `pushBadgeProche` | dimanche 17 h | `badge` — ASSIDU à 1 ou 2 séances |
| `pushApresHeuresCalmes` | tous les jours, 8 h 05 | vide `/push_attente` |
| `pushReponseCoachBilan`, `pushReponseCoachRite` | `reponseCoach` écrit sur un bilan / un rite | `coach` — à la première réponse seulement, pas à chaque correction |
| `pushFilleulInscrit` | création de `/parrainage/<parrain>/filleuls/<filleul>` | `filleul` — **dormant** : le parrainage n'existe pas encore dans l'app |
| `pushDefiCanal` | message du Canal de `type: 'defi'` | `defi` — à tous les athlètes de l'annuaire du coach |

Les tags reprennent ceux des notifications locales (`serie-<lundi>-jeu`, `wrapped-<clé>`) : si les
deux arrivent sur un même appareil, la seconde **remplace** la première au lieu de s'y ajouter.
Le rappel local reste ainsi le filet tant que les fonctions ne sont pas déployées.

**Région.** Les déclencheurs de base de données sont en `us-central1` : c'est la région de
l'instance RTDB par défaut (`repcore-sync-default-rtdb`), et un déclencheur doit y être. Les
tâches planifiées suivent la région globale (`europe-west1`).

**Coût.** Plan **Blaze** obligatoire. Cloud Scheduler facture au-delà de 3 tâches par compte de
facturation (≈ 0,10 $ par tâche et par mois) : avec `statsBadges`, cela fait 6 tâches. Chaque
tâche planifiée parcourt `/push` en `shallow` : seuls les abonnés sont lus.

### Côté client

- L'abonnement suit l'invitation existante (`_rendreInvitationNotif` → `invNotifOui`) et les deux
  autres points d'accord (rappels de bilan et de séance), dans le **même geste** que la permission.
- Au démarrage, une permission déjà accordée suffit à (ré)enregistrer la souscription, une fois
  par jour au plus — jamais de demande.
- **iOS** : rien n'est proposé tant que l'app n'est pas installée (`display-mode: standalone`),
  et l'abonnement ne part que d'un geste (bouton « Activer sur cet appareil » des réglages).
- `app/sw.js` affiche le message (titre, corps, icône, tag) et, au toucher, ouvre ou ramène l'app
  **sur l'écran visé** (`url`, limitée à la portée de l'app).

### Tester sans rien déployer

```bash
node functions/test/push.test.js
```

Banc autonome (firebase-admin, firebase-functions et web-push simulés, base en mémoire) : envoi,
plafond, heures calmes puis envoi de 8 h 05, type coupé, réponse corrigée, nettoyage 410, série
en danger, défi du Canal.

Un défi se lance depuis le Canal (« ⚡ Lancer un défi ») : c'est un message de `type: 'defi'` ;
un message ordinaire ne notifie personne. Voir la section suivante.

## Les défis du Canal (26/09/2026)

Le coach lance un défi depuis son Canal (« ⚡ Lancer un défi » : trois champs et trois modèles).
Ses athlètes le voient épinglé en haut de leur Canal, s'y inscrivent (« Je relève le défi »), et
un rappel reste sur leur accueil tant qu'il court.

### Les nœuds

| Nœud | Qui écrit | Contenu |
|---|---|---|
| `/canaux/<coach>/messages/<id>` | le coach | `{at, type:'defi', titre, texte, mesure, objectif, collectif, debut, fin, recompense?}` — `mesure` : `seances`, `tonnage`, `serie` (semaines validées) ou `progressionPct` |
| `…/defis/<id>/participants/<athlète>/inscription` | l'athlète | `{le, classement, pseudo?}` — le classement est un **opt-in** |
| `…/defis/<id>/participants/<athlète>/{valeur, metrique, termine, termineLe, place, maj}` | **les fonctions seules** | la progression |
| `…/defis/<id>/public` | **les fonctions seules** | l'équipe (part, somme), le classement et les avatars (initiales) — **sans aucune clé**, et ne nommant que ceux qui ont choisi le classement |
| `…/defis/<id>/etat` | **les fonctions seules** | paliers annoncés, dernier message système, rappel 48 h, clôture |
| `/canaux/<coach>/messages/s…` (`type:'systeme'`) | **les fonctions seules** | paliers, athlète qui boucle le défi, podium |
| `/defis_resultats/<athlète>/<id>` | **les fonctions seules** | `{titre, mesure, fin, termineLe, champion}` — lu par l'athlète pour ses badges |

Un athlète ne lit que **sa** feuille de participant et le résumé public : les participants sont
rangés par clé, et une clé est un e-mail. RepCore ne fait toujours connaître un athlète aux autres
que s'il le choisit (classement), sous son prénom ou son pseudo.

⚠ La demande parlait de `/canal/<coachId>/<msgId>` : le Canal existe déjà sous `/canaux/<coach>`
(messages, compteurs, réactions), le défi y est donc un message comme un autre.

### Les fonctions

| Fonction | Quand | Ce qu'elle fait |
|---|---|---|
| `defiApresSeance` | `/users/{uid}/sessions` change (région `us-central1`) | recalcule la valeur de l'athlète pour ses défis actifs, puis l'équipe, les places, le résumé public, et l'annonce du jour |
| `defiInscription` | une inscription est posée ou retirée | idem — les séances faites depuis le début du défi comptent tout de suite |
| `defisQuotidien` | tous les jours, 9 h (Paris) | rappel push « Plus que 48 h » (une fois, à qui n'a pas fini), annonces en attente, **clôture** : podium dans le Canal, `/defis_resultats` (CHAMPION au gagnant) |
| `pushDefiCanal` | un défi est publié | push « Nouveau défi » aux athlètes du coach |

**Messages système : un par jour et par défi au plus** (podium compris — une clôture attend le
lendemain si un message est déjà parti). Priorité : 100 % d'équipe, puis les athlètes qui ont
bouclé le défi (tous en un message ; ceux hors classement restent « un athlète »), puis le plus
haut palier d'équipe atteint (25/50/75 %).

**Le classement ne porte jamais sur les charges** : la progression en % pour un défi de
progression, la régularité (séances, ou semaines validées) pour tous les autres — un défi de
tonnage se classe aux séances. Le gagnant : la meilleure métrique parmi ceux qui ont bouclé le
défi, à égalité le premier à l'avoir bouclé.

Le calcul est dans `defis-calcul.js` (pur, sans Firebase). Le client a la même règle
(`defiValeur`) pour la jauge perso ; les deux bancs rejouent les mêmes fixtures.

```bash
node functions/test/defis.test.js
```

## Le parrainage (26/09/2026)

**La récompense.** Le filleul a 1 mois d'essai en plus (`OFFRES.essai_parrainage`) dès que sa
demande est acceptée. Le parrain gagne 1 mois offert — ses droits prolongés d'un mois — au
**premier paiement** du filleul, et rien avant. Au 10e filleul abonné : 1 mois d'Ultime en plus
(`droits/<clé>/bonusUltimeFin`, qui s'ajoute au palier payé sans le remplacer).

### Les nœuds

| Nœud | Qui écrit | Contenu |
|---|---|---|
| `/parrainage/codes/<CODE>` | le parrain, une fois | sa clé — **lisible par personne** (une clé est un e-mail) |
| `/parrainage/codesPublics/<CODE>` | le parrain, une fois | `{prenom}` — lu à l'inscription du filleul |
| `/parrainage/comptes/<clé>` | `code` : le titulaire, une fois ; **le reste : les fonctions seules** | `{code, filleuls:{<id haché>:{date, statut:'inscrit'\|'payant', prenom, payeLe}}, moisGagnes, payants, mentorLe, parrain:{code, le}}` — le titulaire le lit |
| `/parrainage/appareils/<id>` | le premier compte qui s'en sert | sa clé (anti-fraude) |
| `/parrainage/demandes/<clé>` | le filleul, **une fois à vie** | `{code, le, appareil}` ; puis `{etat, raison}` par la fonction |
| `/parrainage/liens`, `/parrainage/emails` | les fonctions seules | filleul → parrain ; adresses normalisées déjà parrainées |
| `/parrainage/evenements/<clé>` | les fonctions seules | `{type:'paiement'\|'mentor', at, prenom, mois}` — lu par le parrain |

⚠ La demande prévoyait `/users/<uid>/parrainage`. Le dossier `/users` s'écrit en entier depuis
l'appareil, et son titulaire peut y écrire n'importe quoi : un statut ou des mois gagnés posés là
ne vaudraient rien. L'original vit donc dans `/parrainage/comptes`, fermé en écriture ;
`u.parrainage` n'en est qu'un miroir (affichage, dates de RECRUTEUR et MENTOR). Chez le parrain,
un filleul est un identifiant haché, jamais son adresse.

### Les contrôles

- **Un seul parrain** : la règle n'accepte qu'une demande par compte, à vie.
- **Pas d'auto-parrainage** : la règle refuse son propre code ; la fonction compare les adresses
  **normalisées** (minuscules, sans `+alias`, sans les points chez Gmail).
- **Pas depuis l'appareil du parrain** : la règle refuse l'identifiant d'appareil enregistré par
  le parrain à la création de son code.
- **La fonction refuse aussi** : un compte de plus de 7 jours, une adresse déjà parrainée, un
  compte qui a déjà payé.
- **Rien pour le parrain tant que le filleul n'a pas payé** : seuls comptent un paiement vérifié
  par `verifyPaypalSubscription` avec un dernier paiement non nul, et les webhooks
  `PAYMENT.SALE.COMPLETED` et `PAYMENT.CAPTURE.COMPLETED`. `BILLING.SUBSCRIPTION.ACTIVATED` ne
  compte pas (une activation n'est pas un encaissement). Le premier seulement : une transaction
  sur le compte du parrain rend l'opération idempotente.

### Les fonctions

| Fonction | Quand | Ce qu'elle fait |
|---|---|---|
| `parrainageDemande` | création de `/parrainage/demandes/{uid}` | juge la demande ; si acceptée : filleul « inscrit » chez le parrain, lien, +30 jours d'essai (`essaiFinit`, ou `bonusEssaiJours` que `ouvrirEssai` ajoutera) |
| `pushFilleulInscrit` | un filleul apparaît chez le parrain | push « Julie vient de s'inscrire avec ton code » |
| `parrainagePaiement` (utilitaire) | `verifyPaypalSubscription`, webhook | statut « payant », +1 mois aux droits du parrain, événement, push « Julie vient de s'abonner : 1 mois offert ⚡ », palier des 10 |

### Le mois offert et l'engagement de 12 mois

Le mois offert **ne touche pas à PayPal** : l'abonnement du parrain, ses mensualités et son
engagement de douze mois restent exactement ce qu'ils sont. Ce qui change, c'est `droits/echeance`,
repoussée d'un mois (`prolonger`). Comme chaque renouvellement prolonge à son tour l'échéance
existante, ce mois reste « devant » : il ne remplace aucun mois payé, ne raccourcit pas
l'engagement et ne rembourse rien — il s'ajoute à la fin de l'accès. Concrètement, un parrain
engagé sur douze mois garde son accès un mois de plus quand il arrête, ou, s'il n'a pas
d'abonnement en cours, a un mois d'Essentielle ouvert tout de suite.

### Tant que les fonctions ne tournent pas

`PARRAINAGE_ACTIF` (client) vaut `FONCTIONS_SERVEUR` : sans elles, personne ne serait jamais
crédité, donc l'écran « Inviter des amis », le rappel de fin de séance, le lien personnel et les
badges RECRUTEUR/MENTOR restent fermés. Un code saisi à l'inscription fonctionne déjà (demande
enregistrée, essai du dossier allongé d'un mois).

```bash
node functions/test/parrainage.test.js
```

## Le lien perso et les pages publiques (26/09/2026)

Deux pages **hors de l'app**, autonomes (HTML + CSS inline, une seule requête, sans police ni
bibliothèque) — rendues en ~0,1 s une fois la page chargée :

| Adresse | Fichier | Lit |
|---|---|---|
| `/@<pseudo>` (ou `p/?u=<pseudo>`) | `p/index.html` | `/profils_publics/<pseudo>` |
| `/coach/<slug>` (ou `c/?s=<slug>`) | `c/index.html` | `/vitrines/<slug>` |

Les réécritures sont dans `firebase.json` ; `deploie.sh` copie `p/` et `c/`. Sur GitHub Pages (sans
réécriture), l'app produit la forme `p/?u=` / `c/?s=`.

**Les nœuds** (`database.rules.json`) :
- `/pseudos/<pseudo>`, `/slugs/<slug>` → clé du titulaire. Une réservation, **lisible par
  personne** (une clé est un e-mail) : on la prend en écrivant, un refus veut dire « déjà pris ».
- `/profils_publics/<pseudo>`, `/vitrines/<slug>` → **lecture publique**, en liste blanche de champs
  bornés : `prenom, rang{n,nom}, serie, seances, badges[{id,nom}], records[{exo,date}], ref, maj`
  pour un athlète ; `nom, equipe, phrase, bio, vision, photo (https), specialites[], programmes[],
  maj` pour un coach. Aucun champ n'existe pour un poids, une photo corporelle ou une donnée de
  santé. Écrits par le titulaire de la réservation, dans la même écriture que celle-ci.

**La page d'un athlète** est désactivée par défaut ; il l'active dans son profil (« Ma page
publique ») et choisit ce qu'elle montre. Elle se republie après chaque séance et au plus toutes
les six heures depuis l'accueil. **La vitrine d'un coach** se publie à chaque enregistrement de son
profil, depuis ce que `s-vitrine` montre déjà — sans ses coordonnées, sans son Canal, sans ses
images en base64 (seule une photo en `https` passe).

### L'aperçu Open Graph (DM Instagram, WhatsApp)

Les robots n'exécutent pas de JavaScript : l'aperçu se lit dans le HTML servi. Les deux pages
portent un aperçu **par défaut** (`og-image.png`) entre `<!--og:debut-->` et `<!--og:fin-->`.

La fonction **`pagePublique`** sert la **même** page (relue sur l'hébergement, gardée dix minutes)
avec l'aperçu de la personne : prénom, rang, séances, et **l'emblème du rang en image**
(`app/img/rangs/rang_<n>-og.jpg`, 1200×630, produits par `scripts/rangs.py`) ; nom, phrase et photo
pour un coach. Pour l'activer (plan Blaze), remplacer dans `firebase.json` les deux
`"destination"` de `/@*` et `/coach/*` par :

```json
"function": { "functionId": "pagePublique", "region": "europe-west1" }
```

Pas avant : une réécriture vers une fonction absente fait échouer le déploiement de l'hébergement.

```bash
node functions/test/pages.test.js
```

## Les ambassadeurs (26/09/2026)

Un code donné à un créateur de contenu. Ceux qui arrivent par lui ont **1 mois de plus pour
essayer** (`avantage: 'essai+1mois'`, le même mois que le parrainage) ; il touche une commission
sur ce qu'ils paient : `commissionPct` (20 %), `palierPct` (25 %) au-delà de `palierSeuil` (50)
payants, pendant `dureeMois` (12) mois **à partir du premier paiement** de chacun. Une commission
n'est **due que 30 jours après le paiement** (remboursements). **Aucun paiement automatique.**

### Les nœuds

| Nœud | Qui écrit | Contenu |
|---|---|---|
| `/ambassadeurs/<CODE>` | l'administrateur (fiche, `statut:'payee'`) ; les fonctions (le reste) | `{nom, instagram, avantage, commissionPct, palierPct, palierSeuil, dureeMois, actif, secret, creeLe, stats{clics, inscrits, payants, ca}, filleuls/<id>, commissions/<AAAA-MM>/<paiement>{montant, pct, commission, payeLe, dueLe, statut?}}` — lu par l'administrateur seul |
| `/ambassadeurs_publics/<CODE>` | l'administrateur | `{nom, avantage, actif}` — lu à l'inscription |
| `/ambassadeurs_vue/<secret>` | les fonctions (et l'administrateur) | le résumé, lu par l'ambassadeur via `a/?s=<secret>` ; jamais listable |
| `/ambassadeurs_demandes/<clé>` | l'inscrit, une fois | `{code, le, appareil}` ; puis `{etat, raison}` |
| `/ambassadeurs_liens`, `_paiements`, `_ventes`, `/paypal_abonnes` | les fonctions seules | inscrit → code ; paiements déjà comptés ; vente → commission (remboursements) ; abonnement → compte |

L'administrateur, c'est `guellec.coachingpro@gmail.com` — le même contrôle que les autres nœuds
réservés.

### Le parcours

1. **Le lien** : `<domaine>/?amb=CODE` (la page d'accueil relaie `amb`, `ref`, `src` jusqu'à
   l'app) ou `/i?amb=CODE` (`i/index.html` le garde). Le **clic** est compté par `ambClic`
   (fonction HTTP, une fois par jour et par appareil), appelée depuis ces deux pages.
2. **L'inscription** : le code arrive dans le champ « Code d'un ami ou d'un ambassadeur » (ou s'y
   tape). **Un seul avantage** : l'ambassadeur passe devant le parrain ; `parrainageDemande`
   refuse d'ailleurs un compte venu par un ambassadeur, et `ambassadeurDemande` un compte déjà
   filleul. Refusés aussi : code inconnu ou éteint, compte de plus de 7 jours, déjà client.
3. **Chaque paiement** : `ambassadeurPaiement`, appelé par `verifyPaypalSubscription` (dernier
   paiement non nul) et par le webhook (`PAYMENT.SALE.COMPLETED`, `PAYMENT.CAPTURE.COMPLETED`).
   Un même encaissement vu par les deux n'est compté qu'une fois (abonnement + jour + montant).
   `PAYMENT.SALE.REFUNDED` / `PAYMENT.CAPTURE.REFUNDED` passent la commission « remboursée ».
   ⚠ Une vente d'abonnement ne porte pas l'adresse du payeur : le webhook la retrouve désormais par
   `/paypal_abonnes/<abonnement>`, posé à l'activation (les renouvellements en profitent aussi).
4. **Chaque matin** (`ambassadeursQuotidien`, 6 h 20) : les résumés suivent le passage à « due ».

### Le tableau de bord (admin → « Ambassadeurs »)

Par code : clics → inscrits → payants (avec les taux), chiffre d'affaires, commission due / payée /
en attente ; créer un ambassadeur, l'éteindre, copier son lien d'invitation et son lien secret ;
**« marquer payé »** les commissions dues d'un mois ; **export CSV** mensuel des commissions dues de
tous les codes (« ; » et virgule décimale, pour Excel en français).

À déclarer dans PayPal (webhooks) en plus : `PAYMENT.SALE.REFUNDED`, `PAYMENT.CAPTURE.REFUNDED`.

```bash
node functions/test/ambassadeurs.test.js
```
