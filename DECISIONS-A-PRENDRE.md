# Décisions à prendre — prix, durées, conditions

**Rédigé le 09/10/2026.** Décisions attendues de Kevin.

Pour les points ci-dessous, deux sources du dépôt se contredisent et je n'ai
trouvé **aucune décision écrite** qui tranche. Je n'ai donc rien changé à ces
textes : choisir une option à la place de Kevin serait inventer une valeur.
Chaque point donne les sources (à retrouver par `grep`, les numéros de ligne
changent d'un build à l'autre), les deux options et ce que chacune implique
de modifier.

Une fois une option choisie : la valeur va dans `tarifs.json` quand c'en est
une, puis `node scripts/tarifs.mjs` et `node scripts/verif/tarifs.mjs`.

---

## 1. L'essai de la personne invitée : 1 mois ou 2 mois ?

Cela concerne la personne qui arrive par un lien de parrainage (`?ref=`) ou par
un code ambassadeur dont l'avantage est `essai+1mois`.

| Ce qui dit **2 mois** (1 mois d'essai + 1 mois offert) | Ce qui dit **1 mois** (le mois d'essai, « offert par l'ami ») |
|---|---|
| `tarifs.json` : `essai_parrainage.moisEnPlus = 1` | `app/rc-core.*.js`, commentaire « LES AMBASSADEURS » : « Kevin, 28/09/2026 : un mois, pas deux — le même que le parrainage, `TARIFS.essai_parrainage.moisEnPlus = 0` » |
| Worker `cloudflare/src/metier.js` : `BONUS_ESSAI_JOURS = 30` | `app/rc-core.*.js`, commentaire « LE PARRAINAGE » : « un mois, pas deux : `OFFRES.essai_parrainage` vaut 0 » |
| CGV `terms.html` §4 : « un mois de plus […], soit 2 mois » | `index.html`, FAQ (visible et JSON-LD) : « Son lien t'offre ton premier mois » |
| `i/index.html` : « 2 mois d'accès complet, dont un offert par ton ami » | `i/index.html` (script) : « <prénom> t'offre ton premier mois » |
| App : `essaiDuree` (60 jours pour un filleul), carte d'invitation (`invitationDonnees`), `texteEssaiRestant` (« deux mois ») | App : `parrainageMessage` : « ton premier mois est offert » ; `a/index.html` : « leur premier mois offert grâce à toi » |
| `index.html`, commentaire du script d'invitation : « son essai est doublé » | |

**Ce qui tourne réellement :** 2 mois (`tarifs.json` et le worker).

- **Option A — 2 mois.** Rien à changer dans `tarifs.json` ni dans le worker.
  À réécrire : la FAQ de `index.html` (par exemple « Son lien t'offre un mois
  de plus : <span data-nb="essai.moisParraine">2</span> mois, … »), le texte
  du script de `i/index.html`, `parrainageMessage`, la note de `a/index.html`,
  et les deux commentaires de rc-core qui disent `moisEnPlus = 0`.
- **Option B — 1 mois.** `tarifs.json` : `essai_parrainage.moisEnPlus = 0` ;
  worker : `BONUS_ESSAI_JOURS = 0` (puis `wrangler deploy`) ; CGV §4 (la
  phrase « un mois de plus, soit 2 mois » disparaît) ; `i/index.html` (« 2
  mois d'accès complet, dont un offert ») ; les tests de rc-core qui jouent
  60 jours (« Parrainage : sur les 60 jours d'un filleul… »).

## 2. La récompense du parrain : à quel moment ?

| **Au premier paiement** de la personne invitée | **À ses quatre premières séances** |
|---|---|
| `index.html`, FAQ (visible et JSON-LD) : « le jour de ton premier paiement, ton ami gagne un mois » | CGV `terms.html` §4 : « lorsque la personne invitée a terminé ses quatre premières séances » |
| `app/rc-core.*.js`, commentaire « LE PARRAINAGE » : « au PREMIER paiement du filleul, et rien avant (anti-fraude) » | App : `filleulStatut` (« 'actif' : ses quatre premières séances, le mois du parrain est tombé ») ; `essaiDuree` (« 60 aussi pour un parrain à l'essai dont le filleul a fait ses quatre séances ») |
| `docs/RepCore-Plan-Viralite-Instagram.pdf` : « Récompense décidée : […] au PREMIER paiement du filleul » | |

**Ce qui tourne réellement :** les deux, et c'est le premier des deux qui
compte (`cloudflare/src/metier.js` : `parrainageSeuil` à 4 séances,
`parrainagePaiement` au premier paiement, un seul mois par personne invitée).

- **Option A — quatre séances (ou le premier paiement s'il arrive avant).**
  C'est ce que fait le worker. À réécrire : la FAQ de `index.html` et le
  commentaire de rc-core ; la CGV peut ajouter « ou à son premier paiement
  s'il intervient avant ».
- **Option B — premier paiement seulement.** Retirer le crédit à quatre
  séances du worker (`parrainageSeuil` et son appel dans le cron, puis
  `wrangler deploy`), réécrire la CGV §4, `filleulStatut` et le texte de
  l'écran parrainage.

## 3. La commission des ambassadeurs : 20 % / 25 % ou 30 % ?

| **20 %, puis 25 % au-delà de 50 payants, pendant 12 mois** | **30 %** |
|---|---|
| `app/rc-core.*.js` : `AMB_DEFAUTS = {commissionPct:20, palierPct:25, palierSeuil:50, dureeMois:12}` | Cité dans la demande du 09/10/2026. **Je n'ai trouvé aucune source de 30 % dans le dépôt** (recherche dans `*.md`, `*.html`, `*.js`, `*.mjs` et le texte des PDF de `docs/`). |
| `functions/README.md`, `functions/test/ambassadeurs.test.js`, `app/tests.js` | |
| `a/index.html` affiche le taux de la fiche de chaque ambassadeur (pas de valeur en dur) | |

Chaque ambassadeur a son propre taux, modifiable dans l'écran admin : la
valeur par défaut ne change que les fiches **créées après coup**.

- **Option A — 20 / 25 %.** Rien à changer. Dire d'où vient le 30 % pour le
  corriger à la source (contrat, message, document hors dépôt).
- **Option B — 30 %.** Changer `AMB_DEFAUTS` (et dire si le palier 25 %
  disparaît ou passe à une autre valeur), les tests cités, `functions/README.md`,
  et les fiches des ambassadeurs déjà créés (une à une dans l'écran admin).
- **Dans les deux cas :** la commission n'est pas dans `tarifs.json`. L'y
  mettre ferait contrôler ce taux comme les prix ; je ne l'ai pas fait sans ton
  accord.

## 4. Le premier mois d'Ultime à moitié prix : pour qui ?

| **Après un suivi par un coach, une seule fois** | **Avec un code ambassadeur « ultime_demi »** |
|---|---|
| CGV `terms.html` §4 : « La personne dont le suivi par un coach prend fin peut se voir proposer, une seule fois… » | `i/index.html` : « L'OFFRE DE LANCEMENT d'un code ambassadeur ultime_demi » (« Avec ce code : ton 1er mois d'Ultime à 12,45 € ») |
| `scripts/paypal_plans.mjs` : description du plan « Premier mois d'Ultime à moitié prix après un suivi » | Worker `cloudflare/src/metier.js` : `AVANTAGES_AMB = ['essai+1mois', 'ultime_demi']` ; `a/index.html` (« leur 1er mois d'Ultime à moitié prix ») |

Le prix, lui, est cohérent partout (`ultime_demi.premierMois`), et
l'engagement aussi : la CGV dit « durée, reconduction et résiliation sont
celles de l'abonnement Ultime ». J'ai donc corrigé le « sans engagement » de
`i/index.html` en « engagement 12 mois », sans attendre ce point.

- **Option A — les deux publics.** Compléter la CGV §4 : « … ou la personne
  qui s'inscrit avec un code ambassadeur portant cet avantage ».
- **Option B — après un suivi seulement.** Retirer `ultime_demi` de
  `AVANTAGES_AMB` (worker) et de l'écran admin des ambassadeurs, et le bloc
  `offre-demi` de `i/index.html`.

## 5. Abonnement sans engagement et annuel remisé — à confirmer AVANT de publier

Préparé sur la branche le 09/10/2026, **pas encore en ligne** (rien n'est
publié tant que la branche n'est pas fusionnée et déployée). Valeurs posées
dans `tarifs.json` sur ta demande, à confirmer :

| Clé | Avant | Après | Ce que la page en déduit |
|---|---|---|---|
| `engagementMois` | 12 | **0** | « sans engagement » partout (data-texte) |
| `essentielle.an` | 114 € | **95 €** | 2 mois offerts (12 × 9,50 = 114 ; 114 − 95 = 19 = 2 × 9,50) |
| `ultime.an` | 298,80 € | **249 €** | 2 mois offerts (12 × 24,90 = 298,80 ; − 249 = 49,80 = 2 × 24,90) |

Les contrats déjà engagés sont gardés tels quels dans `tarifs.json →
contrats_engages` (12 mois, 114 € et 298,80 €) : écrans, CGV et worker les
lisent là.

À trancher avant la mise en ligne :

- **a. Les montants 95 € et 249 €** (oui / autres). S'ils changent : `tarifs.json`,
  puis `node scripts/tarifs.mjs`, `node scripts/verif/tarifs.mjs`, et les
  `montants` de `PLANS_ANNUELS_SANS_ENGAGEMENT` dans `cloudflare/src/paypal.js`
  (un test vérifie qu'ils suivent `tarifs.json`).
- **b. La date d'entrée en vigueur des CGV.** Le texte dit « avant l'entrée en
  vigueur de la présente version » et l'en-tête « Version du 9 octobre 2026 » :
  mets la date réelle de publication.
- **c. L'information avant chaque renouvellement annuel (art. L215-1) — CODÉE
  le 09/10/2026** (`cloudflare/src/renouvellement.js`). Le worker note la date
  anniversaire de chaque annuel payé (`renouvellements/<clé>`) et, à J-60,
  envoie une notification et pose l'étiquette Systeme.io qui déclenche
  l'e-mail. **Reste à Kevin** : dans Systeme.io, créer l'étiquette, les champs
  `date_renouvellement` et `montant_renouvellement`, et la règle « étiquette
  ajoutée → e-mail » ; puis poser les secrets du worker `SYSTEMEIO_API_KEY`,
  `SYSTEMEIO_TAG_RENOUVELLEMENT` (et les variables `SYSTEMEIO_CHAMP_ECHEANCE`,
  `SYSTEMEIO_CHAMP_MONTANT`). Sans eux, seule la notification part : la loi
  demande un écrit (e-mail), la notification seule ne suffit pas.
- **d. Le renouvellement des ANCIENS annuels engagés.** Les CGV de l'époque disent
  « à l'issue des douze mois, reconduction mois par mois », mais leur plan PayPal
  est annuel : PayPal reprélèvera 114 € / 298,80 € pour une nouvelle année. Option
  A : à l'échéance, basculer ces abonnés sur un plan mensuel (geste PayPal à
  prévoir). Option B : les prévenir et rembourser sur demande la part non voulue.
  Aucun abonné annuel engagé n'est connu à ce jour (note de `paypal_plans.mjs`,
  24/09/2026) : à vérifier dans PayPal avant de choisir.

---

*Ce fichier se vide au fur et à mesure : une fois un point tranché et
appliqué, supprime sa section et note la décision (date, formulation) là où
elle s'applique — `tarifs.json` pour une valeur, le commentaire du code pour
une règle.*
