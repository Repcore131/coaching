# Note de décision — modèle économique RepCore

**Rédigée le 27/07/2026** · Décision attendue de Kevin Guellec
**Statut : EN ATTENTE D'ARBITRAGE** — à dater et signer ci-dessous.

---

## 1. Le problème, en une phrase

Un coach tiers s'inscrit librement, recrute ses athlètes, ceux-ci paient
9,95 €/mois — et **100 % de cet argent arrive sur le compte PayPal du créateur**,
sans qu'aucune ligne de code ne prévoie de reversement.

L'application le dit elle-même à l'écran, à trois endroits (`app/index.html`
l. 716, 1093, 1127) :

> « Les paiements sont centralisés sur le compte du créateur — tu n'as rien à
> configurer. »

Ce n'est pas une maladresse de formulation : c'est le modèle tel qu'il est
codé. Un coach qui lit cette phrase apprend que le travail commercial qu'il
fournit produit un revenu qu'il ne touchera pas.

**Risque immédiat, indépendant de l'option retenue :** ces textes doivent
disparaître. Tant qu'ils sont affichés, RepCore annonce noir sur blanc à un
professionnel qu'il travaille gratuitement pour un tiers.

---

## 2. Pourquoi seulement deux options

Une troisième voie — reverser une commission aux coachs — est écartée d'emblée.
Encaisser l'argent d'un client pour le reverser à un professionnel fait de
RepCore un **intermédiaire de paiement**, activité réglementée (DSP2, statut
d'agent prestataire de services de paiement). Cela suppose soit un agrément,
soit de passer par un tiers de confiance type Stripe Connect — et le plan
Firebase actuel (Spark, aucune fonction serveur) ne permet déjà pas de
sécuriser une simple vérification d'abonnement. Hors de portée.

Restent deux modèles cohérents.

---

## 3. Option A — outil propriétaire de Guellec Coaching Pro

RepCore cesse d'être une plateforme ouverte. Aucun coach tiers ne s'inscrit.
L'app devient l'outil de travail d'un seul coach : Kevin.

**Revenus.** L'abonnement 9,95 €/mois ne subsiste que pour l'accès autonome
(athlète sans coach). Les athlètes suivis par Kevin ont l'app **incluse dans
leur prestation de coaching**, qui se facture hors application.

| Utilisateurs payants | MRR application |
|---|---|
| 10 | **99,50 €** |
| 50 | **497,50 €** |
| 200 | **1 990,00 €** |

*Lecture : « utilisateurs » = athlètes en accès autonome. Les athlètes coachés
par Kevin ne génèrent pas de MRR applicatif ; leur valeur est dans le tarif du
coaching, non modélisé ici.*

**Modifications de code — effort : S (une demi-journée).**

1. `s-coach-entry` : retirer le bouton « CRÉER MON COMPTE », ou le placer
   derrière un code d'invitation contrôlé par Kevin.
2. Supprimer les trois textes de reversement (l. 716, 1093, 1127).
3. Ajuster le texte de `s-welcome` : « ESPACE COACH » devient une entrée
   réservée, pas une invitation à l'inscription.
4. Rien d'autre. Le système de codes, les rôles et les règles RTDB restent
   inchangés.

**Risque juridique résiduel : faible.**
Kevin vend son propre coaching et encaisse ses propres clients. Il ne subsiste
que les obligations ordinaires : droit de rétractation sur l'abonnement
autonome, clarté des CGV, et responsabilité de traitement RGPD — déjà couverte
par `privacy.html`. Aucun flux financier appartenant à un tiers.

**Ce qu'on perd.** Toute perspective de croissance par d'autres coachs. Les
deux différenciateurs réels — ajustement au cycle menstruel, import OCR d'une
fiche papier — qu'**aucun des six concurrents B2B vérifiés ne propose**,
restent enfermés dans un cabinet.

---

## 4. Option B — abonnement coach, accès athlète gratuit

Le coach paie pour l'outil. L'athlète rattaché à un coach abonné accède
gratuitement.

**C'est le modèle de l'intégralité du marché vérifié.** Sur les six plateformes
B2B sourcées en §3 du rapport marketing, **six font payer le coach** :

| Plateforme | Qui paie | Prix vérifié |
|---|---|---|
| Synergy Performance (FR) | coach | 18 → 99 €/mois selon nb de clients |
| Hexfit (FR/QC) | coach | 9 → 139 /mois |
| ABC Trainerize (US) | coach | gratuit (1 client) → 275 $ (200) |
| Everfit (US) | coach | gratuit ≤5 clients, puis 16-19 $ |
| TrueCoach (US) | coach | 26 $ (5) → 137 $ (50) **+5 % de commission** |
| Fitr / FitrWoman | coach | **5 $ par athlète**, app athlète gratuite |

Aucun acteur ne fait payer l'athlète d'un coach. Le modèle actuel de RepCore
est donc seul de son espèce — et c'est un signal, pas une innovation.

**Tarif proposé**, positionné sous Hexfit et Synergy, cohérent avec un acteur
francophone naissant :

- **19 €/mois** jusqu'à 15 athlètes
- **39 €/mois** au-delà

**Revenus.** Hypothèse de structure : 1 coach pour 8 athlètes, répartition
observée sur les plateformes comparables.

| Utilisateurs (total) | Coachs | MRR |
|---|---|---|
| 10 | ~1 | **19 €** |
| 50 | ~6 | **114 €** |
| 200 | ~22 | **418 €** (≈ **550 €** avec 20 % au palier 39 €) |

**Le MRR de B est inférieur à celui de A à volume égal.** Ce n'est pas une
erreur de calcul : en A tout utilisateur paie, en B seul un utilisateur sur
neuf paie. B ne devient supérieur que si le nombre de coachs croît — ce que A
interdit par construction. B est un pari sur la croissance ; A est une rente
plafonnée.

**Modifications de code — effort : L (plusieurs jours).**

1. Créer un plan PayPal « RepCore Coach » sur developer.paypal.com et
   renseigner sa constante, sur le modèle de `PAYPAL_PLAN_ID`.
2. Conditionner l'accès au tableau de bord coach à un abonnement actif :
   nouveau statut, contrôle dans `checkAccess` et dans le filet de sécurité de
   `go()`.
3. Rendre l'accès athlète gratuit dès rattachement à un coach abonné :
   `checkAccess` doit lire le statut du **coach**, pas seulement celui de
   l'athlète. Or l'athlète n'a pas de droit de lecture sur le nœud du coach
   dans `database.rules.json` — **il faut donc modifier les règles RTDB**, ou
   recopier un indicateur d'abonnement dans le nœud de l'athlète au moment du
   rattachement.
4. Supprimer les trois textes de reversement.
5. Réécrire l'écran d'abonnement et les neuf textes annonçant « 9,95 €/mois »
   comme prix athlète.

**Point dur, à ne pas sous-estimer.** Sans fonction serveur (plan Spark), rien
n'empêche techniquement un coach de se déclarer abonné en modifiant son propre
nœud : les règles RTDB accordent au titulaire l'écriture sans restriction de
champ. Le contrôle serait honorifique tant que le plan Firebase ne change pas.
C'est le même arbitrage déjà assumé pour `status` et `paymentStatus` côté
athlète, mais il porte ici sur la totalité du revenu.

**Risque juridique résiduel : moyen, mais d'une autre nature.**
Kevin ne détient plus l'argent d'autrui — le risque aigu disparaît. En
revanche il devient **sous-traitant au sens de l'article 28 du RGPD** pour les
données que les coachs tiers lui confient sur leurs athlètes : un contrat de
sous-traitance devient obligatoire avec chaque coach, et `privacy.html` doit
distinguer les traitements dont RepCore est responsable de ceux où il est
sous-traitant. S'ajoute la TVA sur prestation B2B.

---

## 5. Synthèse

| | **A — outil propriétaire** | **B — abonnement coach** |
|---|---|---|
| MRR à 10 | 99,50 € | 19 € |
| MRR à 50 | 497,50 € | 114 € |
| MRR à 200 | 1 990 € | 418-550 € |
| Effort de code | **S** (½ journée) | **L** (plusieurs jours) |
| Risque juridique | **faible** | moyen (RGPD art. 28, TVA) |
| Plafond de croissance | la clientèle d'un seul coach | aucun |
| Conforme au marché | non applicable | **oui, 6/6** |
| Dépend d'un passage à Firebase Blaze | non | **oui, en pratique** |

**Lecture.** A rapporte plus, tout de suite, et coûte une demi-journée. B
rapporte moins à court terme, coûte plusieurs jours, exige de revoir les règles
RTDB et n'est réellement défendable qu'avec des fonctions serveur — donc un
changement de plan Firebase explicitement refusé jusqu'ici. Mais A referme
définitivement la porte au seul positionnement où RepCore est seul au monde :
plateforme coach-athlète francophone intégrant la physiologie féminine à la
programmation.

**Le choix n'est pas technique. Il est stratégique :** RepCore est-il l'outil
de Kevin, ou un produit ?

---

## 6. Décision

> **Option retenue :** AUCUNE — statu quo.
>
> **Date :** 27/07/2026
>
> **Formulation exacte de Kevin, consultee le 27/07/2026 :** « laisse comme
> c'etait ». Ni A ni B n'est retenue ; le modele actuel est maintenu tel quel,
> et aucune modification de code n'a ete appliquee.
>
> **CE QUI RESTE DONC VRAI, ET DOIT ETRE SU :** les trois textes de reversement
> (`app/index.html` l. 716, 1093, 1127) sont TOUJOURS AFFICHES. Un coach tiers
> qui s'inscrit lit encore que les paiements de ses athletes sont centralises
> sur le compte du createur. L'exposition decrite en §1 n'est pas levee.
>
> Cette note reste ouverte : elle pourra etre reprise sans travail
> supplementaire le jour ou l'arbitrage sera fait.

---

*Références : `app/index.html` l. 716, 1093, 1127 (textes de reversement) ;
`RepCore-AUDIT-2026-07-25/05-marketing-business.md` §3.1 (prix vérifiés par URL,
consultés le 25/07/2026).*
