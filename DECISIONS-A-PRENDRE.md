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

## 1 à 4. Tranchés par Kevin le 09/10/2026 — appliqués

Dans les quatre cas, ce qui tournait déjà est gardé ; les textes qui le
contredisaient ont été réécrits (FAQ de la landing, /i, /a, app, CGV §4).

1. **Essai de la personne invitée : 2 mois** (l'essai + un mois offert par
   l'ami ou l'ambassadeur « essai+1mois »). App : `moisInvite()`,
   `offreMoisInvite()`, `texteMoisOfferts()` lisent `tarifs.json`.
2. **Récompense du parrain : aux quatre premières séances ou au premier
   paiement**, le premier des deux, une fois par invité (worker inchangé).
3. **Commission des ambassadeurs : 20 %, puis 25 % au-delà de 50 payants,
   pendant 12 mois** (`AMB_DEFAUTS` inchangé).
4. **Premier mois d'Ultime à moitié prix : après un suivi ET avec un code
   ambassadeur « ultime_demi »** (CGV §4 complétée).

## 5. Abonnement sans engagement et annuel remisé — PUBLIÉ le 09/10/2026

**a et b réglés** : 95 € et 249 € confirmés par Kevin, plans PayPal créés
(`P-5WS33005ML186714UNLET2VI`, `P-2NY44820N2546090CNLET2VQ`), site et worker
déployés le 09/10/2026, date de la version des CGV.

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
