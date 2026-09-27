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
les appels de l'app. Les rappels planifiés avancent par lots d'une minute à l'autre ; au-delà de
quelques centaines d'abonnés, un rappel de 18 h peut finir vers 18 h 30. Rien ne se facture : au
pire, un jour de dépassement, les appels suivants sont refusés jusqu'à minuit (UTC).

## Installer (une seule fois)

1. **Créer le compte** : <https://dash.cloudflare.com/sign-up> (gratuit, sans carte). Choisir un
   sous-domaine `workers.dev` quand il est demandé — l'adresse du serveur sera
   `https://repcore-serveur.<ce-sous-domaine>.workers.dev`.
2. **Se connecter depuis le PC** (ouvre le navigateur, tu valides) :
   ```
   cd cloudflare
   npx wrangler@4 login
   ```
3. **Le code secret de la base** : console Firebase → ⚙ Paramètres du projet → Comptes de
   service → **Codes secrets de la base de données** → Afficher → copier. Puis :
   ```
   npx wrangler@4 secret put FIREBASE_DB_SECRET
   ```
   et coller le code quand il est demandé.
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
   `{"ok":true,"base":true,"secret":true,"vapid":true}`.

L'adresse du serveur est ensuite posée dans l'app (`SERVEUR_LEGER_URL`, `app/rc-core.*.js`) et dans
les pages publiques (`index.html`, `i/`, `p/`, `c/`), puis livrée : c'est ce qui allume le tout.

## Comment ça marche

- **Pas de déclencheurs de base** (Firebase ne sait pas appeler un Worker) : l'app **dépose un
  événement** dans `/evenements` (réponse du coach, défi publié ou mis à jour, demande de
  parrainage ou d'ambassadeur) et appelle `/reveil`. Le Worker le relève tout de suite, ou au
  plus tard dans la minute, **relit la base** pour vérifier ce qu'il annonce, agit, puis le supprime.
- **Le Worker ne relit jamais les séances d'un athlète** (10 ms de calcul) : c'est l'app de
  l'athlète qui écrit sa progression dans chaque défi où il est inscrit.
- **Le Worker n'écrit jamais dans `droits/`** : dans l'app, un nœud `droits/` non vide prime sur le
  dossier, et y écrire aurait coupé l'essai d'un filleul ou rétrogradé un parrain abonné.
- État de travail (curseurs des lots) : `/worker/jobs/<nom>`, fermé à tous les clients.

## Pas encore branché

- **Le mois offert au parrain** au premier paiement de son filleul : compté (`moisGagnes`), annoncé
  (événement, notification), mais pas encore crédité sur l'accès. Il se branchera avec le webhook
  PayPal, quand les paiements seront actifs.
- **L'aperçu personnalisé** des liens `/@pseudo` et `/coach/slug` (emblème du rang, prénom) : ils
  gardent l'aperçu par défaut.

## Tester

```
node cloudflare/test/push.test.mjs         # chiffrement RFC 8291 et jeton VAPID, vérifiés côté appareil
node cloudflare/test/metier.test.mjs       # le métier sur une base en mémoire, budget de requêtes compris
sh cloudflare/test/essai-workerd.sh <dossier>   # le Worker dans le vrai moteur Cloudflare (wrangler dev)
```
