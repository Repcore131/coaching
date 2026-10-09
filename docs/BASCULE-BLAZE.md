# Bascule Blaze : survivre à un pic sans payer tant qu'il n'a pas lieu

*Rédigé le 09/10/2026.* À lire **le jour où l'alerte « connexions simultanées »
arrive** sur ton téléphone.

---

## 1. Ce qui compte comme une connexion

Le plan gratuit de Firebase (Spark) accepte **100 connexions simultanées** à
la Realtime Database. La documentation de Firebase définit une connexion comme
un canal temps réel ouvert (WebSocket, long polling ou flux « server-sent
events »). **Une requête REST ponctuelle (un `fetch` qui lit ou écrit puis se
ferme) n'en est pas une.**

Or l'app n'utilise pas le SDK temps réel de Firebase : tout passe par des
requêtes REST, sauf **un seul** canal permanent.

| Écouteur | Où | Qui | Quand il est ouvert | Connexions |
|---|---|---|---|---|
| Flux de la boîte du coach (`EventSource` sur `/boite_coach/<clé>`) | `BOITE_COACH` dans `app/rc-core.*.js` | coach uniquement | app au premier plan, après l'arrivée sur l'accueil coach ; **fermé** app cachée, **endormi** après 10 min sans un geste (nouveau), **jamais** pendant une forte affluence (nouveau) | **1 par coach actif**, 0 sinon |
| Synchro périodique (`_tourSync`) | idem | tout le monde | toutes les 5 min (30 min au-delà de 85 % du quota) ; **plus du tout app cachée** (nouveau) | 0 (REST) |
| Envois de dossier (`_doPushOne`), lectures ponctuelles (`pullUser`, canal, boutique, profils…) | `CLOUD` | tout le monde | à chaque geste | 0 (REST) |
| Présence (`CLOUD.presence`, nouveau) | `CLOUD` | tout le monde | avec la synchro périodique, app visible | 0 (REST, 40 octets) |
| Le worker Cloudflare | `cloudflare/src/` | serveur | chaque minute | 0 (REST) |

**Estimation par utilisateur actif :** un athlète = 0 connexion persistante ;
un coach = 1 tant qu'il a l'app ouverte et qu'il s'en sert. La limite de 100
correspond donc à **100 coachs devant l'app au même moment**. Les athlètes ne
la consomment pas.

**Le compteur du worker est volontairement pessimiste.** Il compte **chaque
appareil actif** (présence de moins de 6 minutes) comme une connexion, et
indique à part combien de flux de coach sont réellement ouverts. Mieux vaut une
alerte un peu tôt qu'un refus de connexion sans prévenir. Compare-le une fois
au graphe « Connexions » de la console (§3, étape a) pour voir l'écart réel.

## 2. Ce que fait l'app si la base refuse quand même

- **Bandeau « Forte affluence »** en haut de l'écran (pas un écran bloquant).
  Il dit que la séance continue, que tout est gardé sur le téléphone, et quand
  aura lieu le prochain essai. Un bouton « Réessayer maintenant » est proposé.
- **Déclencheur** : une réponse 429, 503 ou 402 de la base, à une lecture ou à
  un envoi.
- **Pendant l'affluence**, plus aucune descente périodique, aucun flux de
  coach, aucun envoi. Les séances s'enregistrent localement et s'ajoutent à la
  file d'envoi, comme hors ligne.
- **Réessai** : une seule petite lecture (`CLOUD.sonder`), après 30 s, 60 s,
  2 min, 4 min, puis toutes les 5 min. Chaque délai varie de ± 20 % pour que
  tous les téléphones ne reviennent pas à la même seconde.
- **Reprise** : la première réponse OK ferme le bandeau, vide la file d'envoi
  et rouvre le flux du coach.

## 3. Préparer, une fois (déjà fait si tu as suivi le guide du 09/10/2026)

a) **Relever les pics de connexions.** Va sur console.firebase.google.com, ouvre
   le projet `repcore-sync`, puis Realtime Database, onglet **Utilisation**. Sur
   le graphe **Connexions**, choisis la période des 30 derniers jours et note le
   maximum.

b) **Créer un compte de facturation sans l'associer au projet.** Sur
   console.cloud.google.com/billing, clique « Créer un compte » et renseigne ta
   carte. Ensuite :
   - ouvre **Budgets et alertes**, puis « Créer un budget » ;
   - champ d'application : tous les projets ;
   - montant : **1 €** ;
   - seuils : **50 %, 90 %, 100 %** ;
   - notifications : ton e-mail.

   **N'associe pas le projet** : tant qu'il n'est pas associé, il reste en Spark
   et rien n'est facturé.

## 4. Le jour J : activer Blaze en 5 clics

Quand l'alerte « 70 connexions simultanées estimées » arrive, et que le niveau
tient ou monte :

1. Va sur **console.firebase.google.com** et ouvre le projet **repcore-sync**.
2. En bas du menu de gauche, sur l'étiquette **Spark**, clique **« Mettre à
   niveau »** (*Upgrade*).
3. Choisis **Blaze (paiement à l'usage)**.
4. Sélectionne le **compte de facturation** créé à l'étape b). Si la console
   propose une alerte budgétaire, garde celle de 1 € ou mets un plafond
   d'alerte plus haut.
5. Clique **« Acheter »** (*Purchase*) pour confirmer.

La limite passe à 200 000 connexions simultanées. Rien à redéployer : l'app et
le worker sont les mêmes.

**Ce qui NE change PAS automatiquement** : les Cloud Functions. Depuis le
09/10/2026, le déploiement (`.github/workflows/firebase.yml`) ne les envoie que
si la variable de dépôt `DEPLOYER_FONCTIONS` vaut `oui`. Ne la pose pas : le
worker Cloudflare fait déjà ce travail, et les fonctions le feraient en double
(webhooks PayPal traités deux fois).

Pour le prix au Go stocké et téléchargé en Blaze, voir firebase.google.com/pricing.
Le budget à 1 € t'alerte dès le premier euro.

## 5. Revenir en arrière (5 clics)

Une fois le pic passé (le graphe « Connexions » redescend durablement sous 70) :

1. Va sur **console.firebase.google.com** et ouvre **repcore-sync**.
2. Clique la roue dentée, puis **Utilisation et facturation**.
3. Ouvre l'onglet **Détails et paramètres**.
4. Clique **« Modifier la formule »**.
5. Choisis **Spark** et confirme.

Les données restent en place. Le retour à Spark n'est possible que si aucun
service réservé à Blaze n'est utilisé (par exemple des Cloud Functions
déployées) : c'est une raison de plus de ne pas poser `DEPLOYER_FONCTIONS`.

En secours, depuis Google Cloud : console.cloud.google.com/billing, **Gestion
du compte**, puis sur la ligne `repcore-sync` : **Désactiver la facturation**.

## 6. Où lire les chiffres

- **`/stats/connexions`** (lisible par toi seul) contient :
  - `estime` : appareils actifs, l'estimation pessimiste ;
  - `flux` : flux de coach ouverts ;
  - `pic` : maximum du jour ;
  - `alerteLe` : heure de la dernière alerte.
- **Notification** : au plus une par heure tant que l'estimation reste à 70 ou
  plus.
- **Code** :
  - `cloudflare/src/affluence.js` pour le comptage et l'alerte ;
  - `AFFLUENCE`, `BOITE_COACH` et `CLOUD.presence` dans `app/rc-core.*.js` pour
    le côté app.
