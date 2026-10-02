# La sauvegarde de la base

La base Realtime Database `repcore-sync` est au plan Spark : **Firebase n'en garde aucune copie**.
Ce qui est effacé, par erreur ou par un script, l'est pour de bon, sauf ici.

## Ce qui tourne, et quand

| quand (UTC) | mode | ce qui est exporté | où c'est gardé |
|---|---|---|---|
| chaque nuit, 02:17 | `--critiques` | `droits`, `paypal_evenements`, `paypal_transactions`, `paypal_journal`, `paypal_abonnes`, `paypal_premiers`, `paypal_orphelins`, `parrainage`, `ambassadeurs`, `ambassadeurs_publics`, `evenements_ko`, `worker` | artefact du travail, **35 jours** |
| chaque dimanche, 02:37 | `--complet` | toute la base | artefact 35 jours **et** release brouillon `sauvegarde-AAAA-MM-JJ`, **les 8 dernières** |
| à la demande | au choix | onglet Actions → *Sauvegarde de la base* → *Run workflow* | comme ci-dessus |

Le dimanche, les deux tournent : les critiques à 02:17, le complet à 02:37.

- **L'export** : `scripts/sauvegarde_base.mjs`, sans dépendance.
  - **Accès** : le compte de service (secret `FIREBASE_SERVICE_ACCOUNT`, le même que `firebase.yml`), échangé contre un jeton OAuth d'une heure.
  - **Format** : un fichier `.json.gz` par nœud, plus un `manifeste.json` qui donne la date, le mode, et pour chaque fichier sa taille et son sha256.
  - **Un nœud trop gros** (plus de 200 Mo en lecture, ou une erreur 413) est repris un niveau plus bas : ses clés d'abord, puis ses enfants par plages de clés. Il ne peut pas dépasser la limite de 256 Mo d'une réponse REST.
- **Le chiffrement** se fait avec `openssl enc -aes-256-cbc -pbkdf2 -iter 200000` et la clé `SAUVEGARDE_CLE`.
  - Le travail vérifie que l'archive se déchiffre à l'identique (même sha256), puis efface le clair.
  - **Rien n'est jamais téléversé en clair.**
- **En cas d'échec**, un courriel part via `scripts/envoyer_mail.mjs`, avec les mêmes secrets `MAIL_*` que le rapport payeur.

### Les secrets à poser (une fois)

Les secrets se posent dans Settings → Secrets and variables → **Actions** → *New repository secret*.

- **`SAUVEGARDE_CLE`** (nouveau) : une longue phrase de passe tirée au hasard (au moins 32 caractères).
  - **Garde-en une copie hors de GitHub**, dans ton gestionnaire de mots de passe.
  - GitHub ne la ré-affiche jamais. Sans elle, aucune archive ne se relit.
  - Si tu la changes, garde aussi l'ancienne tant que des archives chiffrées avec elle existent (35 jours, ou 8 semaines pour les releases).
- `FIREBASE_SERVICE_ACCOUNT` et `MAIL_MOT_DE_PASSE` sont déjà posés.

## Le coût en bande passante (quota Spark : 10 Go téléchargés par mois)

**Chaque export compte** dans les 10 Go mensuels du projet entier, au même titre que le trafic de l'app.
Le résumé de chaque exécution donne trois chiffres :
- ce qui a été **téléchargé** depuis la base ;
- le nombre de requêtes ;
- **ce que ce rythme coûte par mois** : ×30 pour les critiques, ×4,35 pour le complet.

Ordre de grandeur, avec **C** la taille des nœuds critiques et **T** celle de la base entière :

  **par mois ≈ 30 × C + 4,35 × T**

| si la base pèse | et les critiques | coût mensuel | part du quota |
|---|---|---|---|
| 50 Mo | 5 Mo | ~370 Mo | ~3,6 % |
| 200 Mo | 10 Mo | ~1,2 Go | ~11,4 % |
| 1 Go | 30 Mo | ~5,2 Go | ~52 % |

**À surveiller** : au-delà d'environ 500 Mo de base, le complet hebdomadaire mange une part sensible du quota.
Les leviers, dans l'ordre :
- espacer le complet (tous les quinze jours : changer le second cron) ;
- sortir de `--critiques` un nœud qui grossit (`worker/profils`, par exemple, se reconstruit tout seul) ;
- passer au plan Blaze, qui a de vraies sauvegardes automatiques.

La lecture `?shallow=true` qui liste les nœuds ne coûte presque rien. Les fichiers `.json.gz` réduisent la place prise, pas le téléchargement : la base envoie du JSON non compressé.

## Restaurer un nœud

Restaurer, c'est **réécrire un nœud entier** tel que l'archive le porte : ce qui a été ajouté depuis disparaît. Toujours commencer par une simulation.

### 1. Récupérer l'archive

- **Une nuit récente** : onglet Actions → *Sauvegarde de la base* → l'exécution voulue → *Artifacts* → télécharger, puis dézipper. Tu obtiens `sauvegarde-AAAA-MM-JJ-critiques.tar.enc`.
- **Une complète plus ancienne** : onglet *Releases* → le brouillon `sauvegarde-AAAA-MM-JJ` → le fichier `.tar.enc`.

### 2. Saisir les secrets dans ton terminal (jamais dans un fichier)

```bash
read -rs SAUVEGARDE_CLE && export SAUVEGARDE_CLE
```

Pour l'accès à la base : le fichier JSON du compte de service, là où tu le gardes (`--compte <chemin>`). Tu peux aussi exporter `FIREBASE_SERVICE_ACCOUNT` de la même façon.

### 3. Simuler (par défaut : rien n'est écrit)

```bash
node scripts/restaurer_noeud.mjs sauvegarde-2026-10-05-critiques.tar.enc droits --compte ~/RepCore-secrets/compte-service.json
```

Le script :
- déchiffre dans un dossier temporaire ;
- vérifie le sha256 de chaque part (une part abîmée arrête tout) ;
- relit le nœud actuel dans la base, de la même façon que la sauvegarde ;
- affiche les clés **à ajouter**, **à retirer** et **modifiées** ;
- efface le dossier déchiffré.

Une base intacte affiche **`0 différence.`**

### 4. Écrire, si la simulation montre ce que tu attends

```bash
node scripts/restaurer_noeud.mjs sauvegarde-2026-10-05-critiques.tar.enc droits --compte ~/RepCore-secrets/compte-service.json --ecrire
```

- **Un nœud normal** : un seul `PUT` du nœud entier.
- **Un nœud qui avait été découpé** (trop gros) : des `PATCH` par lots, puis la suppression des enfants absents de l'archive. Le résultat est le même qu'un `PUT`.
- **Ensuite** : relance la simulation. Elle doit afficher `0 différence.`

⚠ Restaurer `droits` ou `paypal_*` remet l'argent et les accès **à la date de l'archive**. Un paiement reçu depuis disparaîtrait. Rejoue-le ensuite depuis PayPal (le Worker sait rejouer un événement), ou restaure seulement les clés touchées à la main.

### Ce qui est testé

- **Automatiquement** : `node scripts/verif/sauvegarde.test.mjs` fait tourner l'export et la restauration contre la base en mémoire (`cloudflare/test/fausse-base.mjs`). Il vérifie :
  - la liste `--critiques` ;
  - la descente d'un niveau sur un 413 et au-delà de la limite d'octets ;
  - le manifeste (sha256, tailles) ;
  - l'aller-retour, qui donne **0 différence** sur chaque nœud, découpés compris ;
  - qu'une simulation n'écrit rien ;
  - que `--ecrire` remet la base à l'identique après dégâts (clé effacée, modifiée, ajoutée) ;
  - qu'une part abîmée est refusée ;
  - le chiffrement : il utilise les mêmes commandes `tar` et `openssl` que le workflow, et une mauvaise clé est refusée.
- **Sur la vraie base, à faire une fois** après la première exécution :
  1. lancer *Sauvegarde de la base* à la main, en mode `critiques` ;
  2. télécharger l'artefact ;
  3. lancer la **simulation** sur `droits` : elle doit afficher `0 différence.`, ou seulement les changements faits depuis l'export.

  Note la date de ce test ici : _(à compléter)_.
