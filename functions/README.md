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
| `pushDefiCanal` | message du Canal avec `defi: true` | `defi` — à tous les athlètes de l'annuaire du coach |

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

Un défi se lance depuis le Canal : case « C'est un défi » dans la feuille du message, qui écrit
`defi: true` (règle ajoutée dans `database.rules.json`) ; un message ordinaire ne notifie personne.
