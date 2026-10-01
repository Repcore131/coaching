# La capacité du serveur léger, et quand passer au plan payant

Le serveur léger (`cloudflare/`, un Worker Cloudflare) tourne sur le **plan gratuit**. Ce document
dit jusqu'où il tient, à quel signe il faut passer au **plan Workers Paid (5 $/mois)**, et comment
faire. Le passage est **préparé dans le code** (le « mode file ») : il s'active par la configuration,
sans réécrire de code.

## Les plafonds du plan gratuit

| Ressource | Plafond Cloudflare | Ce que RepCore en fait |
|---|---|---|
| Sous-requêtes par exécution | 50 | `BUDGET` = 38 par réveil, 44 par appel de l'app (`/fn`, `/paypal`) |
| Calcul par exécution | 10 ms | `MAX_CHIFFREMENTS` = 5 push chiffrés par réveil (~1,2 à 2 ms chacun) |
| Appels par jour | 100 000 | 1 440 réveils (un par minute), plus les appels de l'app |
| Tâches programmées | 5 | une seule, chaque minute |

## Ce que cela donne, mesuré

Mesures de `cloudflare/test/charge.test.mjs` (base en mémoire, Node 22), détaillées dans
`cloudflare/README.md`, « Charge » :

| Chemin | Débit sur le plan gratuit | Ce qui se passe au-delà |
|---|---|---|
| **Série en danger** (jeudi, 17 h–21 h) | **~480 athlètes** relancés (180 avant le lot « charge » du 01/10/2026) | la liste s'arrête à 21 h : `worker/jobs/serie/sautes` > 0 et une ligne `travail_incomplet` dans `evenements_ko` |
| **Accès qui se termine**, **retour** (rappels quotidiens) | **~2 000 athlètes** par jour : la plupart sont écartés sans requête (profils et journal lus par pages de 200) | même chose : `sautes` à 21 h |
| **La file `/evenements`** (défi publié, réponse du coach, sous-tâches) | **~4 à 6 événements par minute** (un push = ~8 requêtes, 5 chiffrements) ; un défi pour 1 000 athlètes : ~4 h | la file s'allonge ; les messages arrivent en retard, aucun ne se perd |
| **Appels par jour** | 100 000 : **~12 000 athlètes actifs**, estimés à ~8 appels par jour et par athlète (`/fn`, `/reveil`, `/arrivee`, pages publiques) | au-delà, les appels sont refusés jusqu'à minuit UTC |

Le premier plafond atteint n'est pas le quota du jour : c'est **la série du jeudi**, vers 500 athlètes.

## La règle de bascule

**Passer au plan payant dès que l'un de ces deux signes apparaît :**

1. **800 athlètes actifs** (abonnés aux notifications, `/push`) ou plus ; **ou**
2. un travail planifié qui finit avec **`sautes` > 0 deux jeudis de suite** (la série n'a pas pu
   prévenir tout le monde avant 21 h). On le voit dans l'écran des échecs (`evenements_ko`, ligne
   `travail_incomplet`), ou dans la base : `worker/jobs/serie/sautes`.

Un seul jeudi incomplet peut venir d'une panne : on attend le suivant. Deux de suite, c'est la charge.

## Ce que le plan payant change

**Workers Paid, 5 $ par mois** (à vérifier sur <https://developers.cloudflare.com/workers/platform/pricing/>) :

| | Gratuit | Payant |
|---|---|---|
| Sous-requêtes par exécution | 50 | 1 000 |
| Calcul par exécution | 10 ms | 30 s |
| Appels | 100 000 par jour | 10 millions par mois inclus |
| Cloudflare Queues | — | 1 million d'opérations par mois incluses (un message ≈ 3 opérations : écrit, lu, effacé) |

Avec le **mode file** (`FILE_PUSH = "queue"`) :

- les travaux par athlète (`acces`, `serie`, `bilan`, `wrapped`, `badge`, `retour`) **lisent les
  abonnés par pages de 500** et **enfilent un message par athlète** dans la file `repcore-push`,
  au lieu de traiter les athlètes dans le réveil ;
- chaque push différé (`differer`, `pousserA`, `pousser1`) part dans la même file. Les autres
  sous-tâches (PayPal, relances, volts), dont l'ordre compte, restent dans `/evenements` ;
- le **consommateur** (`queue()` dans `cloudflare/src/index.js`, `consommerLot` dans `planif.js`)
  prend les messages **par lots de 20**. Il acquitte (`ack`) ce qui est fait et rejoue (`retry`) ce qui
  a échoué : un service de push qui répond 429 ou 5xx pour tous les appareils de l'athlète, ou une
  base injoignable. Après 5 essais, le message part dans `repcore-push-ko`.

**Mesuré** (épreuve (d) de `charge.test.mjs`, fausse file en mémoire) : avec **10 000 abonnés**, la
série du jeudi est enfilée en **un réveil** (20 pages de 500, 100 envois de 100 messages). Elle est
servie à **100 %** en 505 lots, sans aucun doublon. Les 1 % de 503 simulés sont rejoués puis livrés.
On compte au plus 30 requêtes par réveil et ~220 par lot.

**Coût des Queues**, en ordre de grandeur pour 10 000 athlètes :
- environ 5 messages par athlète et par semaine (série, retour, accès, bilan, badge), soit ~200 000
  messages par mois ;
- à ~3 opérations par message, cela fait ~600 000 opérations par mois ;
- c'est **dans le million inclus** : la facture reste de **5 $ par mois**.

## Comment basculer (une demi-heure)

1. **Le plan** : tableau de bord Cloudflare > Workers & Pages > Plans > **Workers Paid** (5 $/mois).
2. **Les deux files**, une fois, depuis `cloudflare/` :
   ```
   npx wrangler@4 queues create repcore-push
   npx wrangler@4 queues create repcore-push-ko
   ```
3. **`cloudflare/wrangler.toml`** :
   - décommenter le bloc `[[queues.producers]]` / `[[queues.consumers]]`, en bas du fichier ;
   - ajouter dans `[vars]` :
     ```
     FILE_PUSH = "queue"
     BUDGET = "900"
     MAX_CHIFFREMENTS = "200"
     ```
4. **Déployer** : pousser sur `main`. Le workflow `cloudflare.yml` déploie, puis sonde `/sante`.
5. **Vérifier** :
   - Cloudflare > Queues > `repcore-push` : les messages entrent et sortent ;
   - `repcore-push-ko` reste vide ;
   - le jeudi suivant, `worker/jobs/serie` finit sans `sautes`.

**Revenir en arrière** :
- retirer `FILE_PUSH` des `[vars]` et redéployer : tout repasse par `/evenements` ;
- les messages déjà en file sont encore consommés tant que le bloc `[[queues.consumers]]` reste.

## Les réglages, en un coup d'œil

| Variable (`[vars]`) | Gratuit (défaut) | Payant | Où elle sert |
|---|---|---|---|
| `BUDGET` | 38 | 900 | requêtes par réveil (`planif.js`, `minute`) et par lot de la file |
| `MAX_CHIFFREMENTS` | 5 | 200 | push chiffrés par exécution (`metier.js`, `peutPousser`) |
| `COUT_PUSH` | 8 | 8 | requêtes réservées par push |
| `FILE_PUSH` | absent | `queue` | le mode file (avec la liaison `PUSHS`) |

Une valeur absente ou illisible reprend le défaut gratuit (`limitesDe`, `metier.js`).
