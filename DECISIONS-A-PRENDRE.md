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
  envoie une notification et inscrit le contact dans une liste **Brevo**
  (11/10/2026 : Brevo remplace Systeme.io pour l'app ; attributs `ECHEANCE` et
  `MONTANT`, créés par le worker). **Reste à Kevin** : la clé API Brevo (secret
  `BREVO_API_KEY`) et, dans Brevo, l'automatisation « contact ajouté à la liste
  Renouvellement → e-mail ». Claude pose ensuite `BREVO_LISTE_RENOUVELLEMENT`.
  Sans eux, seule la notification part : la loi demande un écrit (e-mail), la
  notification seule ne suffit pas.
- **d. Le renouvellement des ANCIENS annuels engagés.** Les CGV de l'époque disent
  « à l'issue des douze mois, reconduction mois par mois », mais leur plan PayPal
  est annuel : PayPal reprélèvera 114 € / 298,80 € pour une nouvelle année. Option
  A : à l'échéance, basculer ces abonnés sur un plan mensuel (geste PayPal à
  prévoir). Option B : les prévenir et rembourser sur demande la part non voulue.
  Aucun abonné annuel engagé n'est connu à ce jour (note de `paypal_plans.mjs`,
  24/09/2026) : à vérifier dans PayPal avant de choisir.


## 6. Google Play : comment vend-on l'abonnement dans la version Play ?

*Ajouté le 10/10/2026.* Google Play impose sa propre facturation pour tout
contenu numérique vendu **dans** une app qu'il distribue : abonnements
Essentielle et Ultime, programmes de la boutique, formules coach. L'app ne
doit pas non plus y renvoyer vers un autre moyen de paiement par un lien, un
bouton ou un appel à payer ailleurs. RepCore n'entre pas dans l'exception des
« apps de lecture » : elle ne couvre que les livres, la musique, la vidéo et
la presse.

**Ce qui est codé aujourd'hui : l'option 1.** La version Play (AAB, canal
`play`, ouverte avec `?src=play`) n'affiche aucun paiement PayPal. L'écran
d'abonnement montre « Ton abonnement se gère sur repcore-sync.web.app », sans
lien. L'achat de programme et le paiement au coach ne s'ouvrent pas. Les
accès déjà acquis (abonnement web, essai, code coach) fonctionnent
normalement : Google l'autorise.

| | **Option 1 : pas de vente dans l'app Play** (codée) | **Option 2 : Google Play Billing** (API Digital Goods) |
|---|---|---|
| Ce que voit l'utilisateur Play | Un message sans lien, aucun bouton pour payer | Le bouton d'achat natif de Google Play |
| Commission | Aucune, puisque rien ne se vend dans l'app | **15 %** sur les abonnements prélevés par Google. Pour un achat unique (programme de la boutique) : 15 % sur le premier million de dollars de l'année si tu t'inscris au programme de frais réduits de Google, sinon 30 % |
| Conversion | Faible : il faut que l'utilisateur pense à aller sur le site, et l'app ne peut pas l'y inviter | Achat en deux gestes, carte déjà enregistrée chez Google |
| Prix | Les mêmes partout | Mêmes prix (moins de marge) ou prix Play plus élevés : à décider, et à écrire dans les CGV |
| Travail | Fait | Gros chantier, détaillé ci-dessous |
| Risque de refus Google | Moyen sur la phrase : Google peut y voir un renvoi vers le web. Variante plus sûre, prête à poser : « L'abonnement n'est pas disponible dans cette version. » | Faible, c'est la voie standard |
| Résiliation, CGV | Rien ne change | Résiliation dans Google Play (« Abonnements ») : la mention L215-1-1 et les CGV §5 doivent le dire. Remboursements gérés par Google |

**Le chantier de l'option 2 :**
- **Play Console** : créer les produits et abonnements, avec les mêmes
  identifiants pour les formules mensuelles et annuelles.
- **Android** : fonction « Play Billing » de Bubblewrap (`DigitalGoodsService`).
- **App** : `getDigitalGoodsService` et Payment Request API dans `rc-core`,
  à la place du SDK PayPal quand `canalApp() === 'play'`.
- **Worker** : vérifier chaque achat auprès de la Google Play Developer API
  (compte de service), reconnaître (`acknowledge`) sous 3 jours sinon Google
  rembourse, et suivre les renouvellements et résiliations par les
  notifications en temps réel (Pub/Sub, qui pousse vers le worker).
- **Tests** : des achats de test avec les comptes testeurs.

**À trancher :**
- **a. Option 1 ou option 2.** Ma recommandation : publier d'abord en
  option 1. Le test fermé de 14 jours arrive de toute façon avant la mise en
  production. Passer en option 2 quand la version Play attire du monde.
- **b. La phrase de l'option 1.** « Ton abonnement se gère sur
  repcore-sync.web.app » (posée, à ta demande) ou la variante plus sûre
  ci-dessus. Changer `CANAL_PLAY_TEXTE` dans `rc-core`.

---

*Ce fichier se vide au fur et à mesure : une fois un point tranché et
appliqué, supprime sa section et note la décision (date, formulation) là où
elle s'applique — `tarifs.json` pour une valeur, le commentaire du code pour
une règle.*
