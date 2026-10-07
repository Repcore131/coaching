# RepCore — Plan « 50 000 € par mois », en partant de zéro

**Rédigé le 07/10/2026** à partir du code du dépôt (`tarifs.json`, `index.html`,
`cloudflare/`, `NOTE-DECISION-MODELE-ECONOMIQUE.md`, `docs/offre$dst.pdf`).
Contrainte : **0 € de budget**. Les canaux : influence, Instagram, bouche à oreille.

---

## 0. Le verdict, en 6 lignes

1. **Le produit est prêt à vendre.** Il est même en avance sur sa distribution : parrainage, codes
   ambassadeur, défis, duels, XP, rangs, badges, Wrapped mensuel, export vidéo pour Instagram,
   pages publiques athlète et coach, relances automatiques. Tout ça tourne déjà, gratuitement.
2. **Ce qui manque, c'est des gens.** Pas des fonctionnalités. Il faut **arrêter de coder des
   nouveautés** et passer 80 % du temps sur la vente pendant 90 jours.
3. **50 000 €/mois avec l'abonnement seul, c'est ~3 500 abonnés payants.** Atteignable, mais pas
   en un mois. L'argent **rapide** viendra du coaching à forte valeur (150 à 600 €) et de
   l'abonnement **annuel payé d'avance**. L'argent **récurrent** viendra de l'app.
4. **Trois freins coûtent des ventes aujourd'hui** : l'engagement de 12 mois, le paiement
   uniquement PayPal, et l'absence sur le Play Store. À régler avant de lancer la moindre campagne.
5. **Un succès viral ferait tomber l'app.** Les plans gratuits Firebase/Cloudinary encaissent
   quelques centaines d'utilisateurs actifs, pas quelques milliers (relevé du 23/09). Le passage
   à Firebase Blaze doit être **prêt à basculer** le jour où les 100 premiers euros arrivent.
6. **L'angle qui rend RepCore unique : les charges ajustées au cycle menstruel.** Aucun
   concurrent ne le fait. C'est l'histoire à raconter, et la cible est une audience féminine
   musculation très active sur Instagram et TikTok.

---

## 1. Ce que l'app a déjà (et qu'on va exploiter)

| Atout dans le code | À quoi il sert dans le plan |
|---|---|
| Essai 1 mois **sans carte** (`tarifs.json` → `essai`) | Barrière d'entrée nulle pour le trafic influence |
| Parrainage : le filleul a 1 mois offert, le parrain gagne 1 mois au 1er paiement | Bouche à oreille automatique |
| Codes ambassadeur : essai doublé (`index.html`, `cloudflare/src/metier.js`) | Code promo pour chaque influenceuse |
| `?src=` suivi de la provenance d'un clic (écran « Viralité ») | Savoir quelle influenceuse rapporte quoi, sans outil payant |
| Export **vidéo** des records, rangs, Wrapped (format Instagram) | Chaque utilisateur devient un créateur de pub gratuite |
| Défis d'équipe, duels, classements, séries, badges rares | Rétention et contenu « challenge » à poster |
| Pages publiques `/p/` (athlète) et `/c/` (vitrine coach) | Lien en bio, preuve sociale |
| Espace coach gratuit jusqu'à 200 comptes (`LIBRE_MAX=200`), puis 19 € / 39 € | Les coachs deviennent un canal de distribution |
| Offres de coaching déjà tarifées : 99 € / 150 € / 350 € / 600 € | Le cash rapide du mois 1 |
| Paiement direct au coach (`paiements-coach.js`, encore fermé) | Argument de vente aux coachs, plus tard |
| Blog SEO (cycle menstruel, fiche papier, suivi sans tableur) | Trafic gratuit sur la durée |
| Serveur Cloudflare gratuit (push, relances, Wrapped) | Relances automatiques = moins de résiliations |

**Les tarifs en vigueur** (`tarifs.json`) :
- Essentielle **9,50 €/mois** (114 €/an) · Ultime **24,90 €/mois** (298,80 €/an)
- Coach : gratuit / **19 €** / **39 €** par mois
- Coaching de Kevin : programme perso **99 €**, coaching **150 €/mois**, transformation
  **350 €/3 mois**, évolution **600 €/6 mois**, programme boutique **14,90 €**

---

## 2. Les 7 corrections avant d'envoyer le moindre visiteur (semaine 1)

Chaque visiteur venu d'une influenceuse coûte une relation. Il ne faut pas le gâcher.

| # | Problème relevé | Pourquoi ça coûte de l'argent | Correction |
|---|---|---|---|
| 1 | **Engagement de 12 mois** sur l'abonnement mensuel (`engagementMois: 12`) | Le trafic Instagram est froid et impulsif. « Engagé 12 mois » à 9,50 € fait fuir au moment de payer. Aucun concurrent grand public ne le fait. | Mensuel **sans engagement**, et un **annuel payé d'avance** avec ~2 mois offerts. Le cash arrive plus tôt et le taux de conversion monte. |
| 2 | **Prix incohérent** : la page dit 9,50 €, les données Google (JSON-LD, `index.html` l. 43) disent 9,95 € | Google affiche un autre prix que la page : perte de confiance, risque de pratique trompeuse. | Aligner sur `tarifs.json` (relancer `scripts/tarifs.py`). |
| 3 | **Paiement uniquement PayPal** | Une partie des 18-30 ans n'a pas de compte PayPal ou ne veut pas en créer. | Vérifier que le paiement **par carte sans compte PayPal** est visible au moment de payer. Plus tard : Stripe (pas d'abonnement mensuel, seulement une commission par vente). |
| 4 | **Pas sur le Play Store** (PWA + APK manuel, `aide-apk.html`) | « Télécharge l'app » est le réflexe. Un lien vers une page d'aide APK perd la moitié des Android. | Publier en TWA sur Google Play : **25 $ une seule fois**, c'est la seule dépense recommandée. iPhone : garder la PWA, avec une vidéo de 10 s « Partager → Sur l'écran d'accueil ». |
| 5 | **Plafonds gratuits** (relevé du 23/09, `docs/offre$dst.pdf`) : Realtime DB ≈ 10 coachs actifs, Cloudinary ≈ 100 vidéos au total | Un Reel qui fait 300 000 vues amène 3 000 inscriptions en 48 h : l'app ralentit ou tombe pour tout le monde, y compris les payants. | Appliquer les lots du rapport « Tenir sans payer » (vérifier lesquels sont faits). Préparer le passage en **Blaze** (paiement à l'usage, gratuit en dessous des mêmes seuils), à activer dès les premiers revenus. |
| 6 | **Arrêter le rythme de développement** (467 mises en ligne en 30 jours au 23/09) | Chaque mise en ligne retélécharge l'app chez tout le monde et consomme le quota d'hébergement. Et chaque heure de code est une heure sans vendre. | Gel des fonctionnalités pendant 90 jours. Une mise en ligne par semaine maximum, correctifs seulement. |
| 7 | **Note de décision « modèle coach » restée en suspens** | Sans arbitrage, impossible de démarcher des coachs avec une offre claire. | Les paliers coach 19 €/39 € existent maintenant dans `tarifs.json` : confirmer cette option B et l'écrire noir sur blanc sur la page coach. |

---

## 3. D'où viendront les 50 000 € — le modèle

On ne compte pas sur une seule source. Voici la cible au **mois 12**, scénario ambitieux :

| Source | Volume visé | Prix moyen | CA mensuel |
|---|---|---|---|
| Abonnements athlètes (mix 65 % Essentielle / 35 % Ultime) | 2 300 payants | ~15 € | **34 500 €** |
| Abonnements coachs (19 € / 39 €) | 250 coachs | ~27 € | **6 750 €** |
| Coaching de Kevin (150 €/mois ou forfaits) | 40 clients | ~150 € | **6 000 €** |
| Programmes boutique (14,90 €) et programmes perso (99 €) | 120 + 10 ventes | — | **2 800 €** |
| **Total** | | | **≈ 50 000 €** |

**Ce qu'il faut savoir honnêtement :**
- C'est du **chiffre d'affaires TTC**, pas du bénéfice. Retirer la TVA (20 %), les frais PayPal
  (~3 %), les commissions des influenceuses (voir §5) et, à ce volume, quelques dizaines à
  centaines d'euros d'hébergement. Le net restera très élevé (pas de salaire, pas de stock).
- **Scénario prudent** au même mois 12 : 12 000 à 18 000 €/mois. L'écart entre les deux, c'est
  presque uniquement le nombre d'influenceuses actives et le taux de résiliation.
- **Le chiffre qui décide de tout : la résiliation mensuelle.** À 8 % par mois, 2 300 abonnés
  en perdent 184 chaque mois : il faut **~380 nouveaux payants par mois** pour continuer à
  monter. Soit ~2 000 essais par mois, soit ~20 000 visiteurs par mois sur la page.

**Le tunnel à surveiller chaque semaine (les cibles) :**

```
Vues Instagram ──▶ clic bio/lien  ──▶ essai gratuit ──▶ payant ──▶ reste 3 mois
                   1 à 2 %            10 à 15 %         20 à 25 %   75 %
```

---

## 4. Le plan de lancement, phase par phase

### Phase 0 — Semaine 1 : réparer les fuites (0 €, ~5 jours)
- Les 7 corrections du §2.
- Créer **un compte Instagram + TikTok « RepCore »** et garder le compte perso de Kevin comme
  visage de la marque (les gens suivent des personnes, pas des logos).
- Un **lien en bio unique** vers `repcore-sync.web.app/?src=bio_ig`.
- Préparer **10 vidéos d'avance** (voir §6) avant de publier la première.

### Phase 1 — Jours 1 à 30 : le cash immédiat (objectif 3 000 à 6 000 €)
L'app seule ne fera pas 5 000 € le premier mois. Le coaching, si.

1. **Offre « Transformation 90 jours »** à 350 € (déjà dans `tarifs.json`), vendue en story
   et en messages privés : 10 places, puis liste d'attente. 10 × 350 € = **3 500 €**.
   L'app est incluse : chaque client devient aussi un utilisateur actif et un témoignage.
2. **Offre Fondateur** sur l'annuel, limitée à **300 places** : Ultime annuel à 149 € au lieu
   de 298,80 € (« prix bloqué à vie »). 50 ventes = **7 450 € encaissés d'un coup**.
   Le compteur de places restantes se montre en story chaque jour.
3. **La salle de sport de Kevin** (le dossier `club/` / Fit Pulse montre un accès direct au
   terrain) : affiche avec QR code au vestiaire, 30 essais offerts aux adhérents, défi
   « Le club RepCore du mois » avec classement affiché. *(Demander l'accord de la direction.)*
4. **50 bêta-testeurs** recrutés en messages privés parmi les abonnés de Kevin : un mois offert
   contre un témoignage vidéo de 20 secondes. Ces vidéos servent toute l'année.

### Phase 2 — Mois 2 à 4 : la machine à influence (objectif 400 à 900 payants)
**Le principe : on ne paie personne d'avance. On partage les revenus.**

- **Cible** : micro-influenceuses et micro-influenceurs fitness francophones, **5 000 à 60 000
  abonnés**, qui font de la musculation en salle. Priorité aux femmes qui parlent de leur cycle,
  de leur programme, de leur progression : l'ajustement au cycle est l'argument que personne
  d'autre ne peut leur proposer.
- **L'offre ambassadeur** (s'appuie sur les codes ambassadeur déjà codés) :
  - leur communauté a **2 mois d'essai** au lieu d'un, avec leur code ;
  - elles touchent **30 % de chaque paiement de leurs filleuls pendant 12 mois** ;
  - elles ont Ultime gratuit à vie ;
  - un tableau de bord de leurs inscriptions (l'écran « Viralité » + `?src=`).
  Ce n'est pas un intermédiaire de paiement : c'est une commission d'affiliation payée par
  Kevin depuis son propre compte, comme une dépense marketing (elles facturent sous leur statut).
- **Volume** : 15 messages privés par jour, 6 jours sur 7 = ~360 contacts par mois.
  À 10 % d'acceptation et 50 % d'actives, ça fait **~18 ambassadrices actives par mois**.
  Une ambassadrice moyenne à 20 000 abonnés ramène 15 à 40 payants sur 3 mois.
- **Message type** (court, personnel, sans pièce jointe) :
  > « Salut [prénom], j'ai vu ta vidéo sur [sujet précis]. Je suis coach et j'ai créé RepCore,
  > une app de muscu qui te dit quelle charge mettre à chaque série — et qui l'ajuste selon ta
  > phase du cycle si tu l'actives. Je te l'offre à vie. Si elle te plaît et que tu en parles,
  > ta commu a 2 mois gratuits et toi 30 % de ce qu'ils paient pendant un an. Je t'envoie
  > l'accès ? »
- **Un « défi RepCore » par mois** (défis d'équipe déjà codés) : 30 jours, classement public,
  le gagnant a un an d'Ultime offert. Chaque ambassadrice lance son équipe → compétition entre
  communautés → les participants postent leurs rangs et records en vidéo.

### Phase 3 — Mois 3 à 6 : les coachs comme canal (objectif 100 à 250 coachs)
Un coach, c'est 5 à 30 athlètes qui arrivent d'un coup.
- **Qui démarcher** : coachs indépendants et personal trainers sur Instagram, qui suivent leurs
  clients sur Excel, Google Sheets ou WhatsApp. Le blog `suivi-athletes-sans-tableur.html` et
  l'import d'une fiche papier par photo sont l'argument.
- **Offre** : gratuit pour 1 athlète (palier Libre, déjà codé), puis 19 € / 39 €. Pour les 50 premiers :
  **3 mois offerts sur le palier Coach** en échange d'un avis public.
- **Argument qui tue** : « tes clients ont l'app avec ton nom, tu vois leurs charges, leurs
  bilans, leur cycle, et ils te paient directement sur ton PayPal » (quand `paiements-coach`
  sera ouvert, après test en sandbox).
- **Volume** : 10 messages coach par jour. Taux réaliste 5 à 8 % d'inscription.

### Phase 4 — Mois 6 à 12 : faire tourner tout seul
- **Bouche à oreille mécanique** : chaque Wrapped du 1er du mois, chaque nouveau rang et chaque
  record proposent une vidéo partageable avec le lien de parrainage. Mettre l'objectif
  « 1 partage par utilisateur par mois ».
- **Réduire la résiliation sous 6 %** : les relances existent déjà (série en danger, badge à
  portée, bilan du samedi). Ajouter un appel ou un vocal de Kevin aux 20 plus anciens abonnés
  chaque mois : ça coûte 1 heure et ça crée des témoignages.
- **SEO** : 2 articles par mois sur les requêtes que le blog cible déjà (cycle menstruel et
  musculation, programme de muscu femme, charge à mettre en muscu). Trafic gratuit qui s'empile.
- **Embaucher sans payer** : les meilleures ambassadrices deviennent « coach RepCore » et
  reprennent une partie du coaching à 150 € en partage de revenus. Kevin passe de 40 clients
  au plafond à une équipe.

---

## 5. Ce que coûtent les commissions (pour ne pas être surpris)

| | Mois 6 (prudent) | Mois 12 (ambitieux) |
|---|---|---|
| CA total | ~8 000 € | ~50 000 € |
| Part venue des ambassadrices | ~50 % | ~40 % |
| Commission 30 % sur cette part | ~1 200 € | ~6 000 € |
| Frais PayPal (~3 %) | ~240 € | ~1 500 € |
| Hébergement (Blaze, Cloudinary) | 0 à 30 € | 100 à 400 € |

La commission n'est due que sur un argent déjà encaissé : il n'y a **jamais** de trou de
trésorerie. C'est ce qui rend le plan possible avec 0 € au départ.

---

## 6. Le contenu Instagram / TikTok — 1 vidéo par jour, 6 formats

Tout est filmable au téléphone, en salle, sans montage payant.

| Format | Exemple d'accroche (3 premières secondes) | But |
|---|---|---|
| **La charge** | « Tu sais pas quoi mettre sur la barre ? Mon app te le dit à chaque série. » | Montrer le cœur du produit |
| **Le cycle** | « Pourquoi tu es plus faible certaines semaines du mois (et quoi faire). » | L'angle unique, partageable entre filles |
| **La fiche papier** | « J'ai pris en photo mon vieux programme papier → il est dans l'app en 10 s. » | Effet « waouh » démontrable |
| **Avant/après d'un client** | Bilan photo + courbe de l'app (avec accord, `CONSENTEMENT-TEMOIGNAGE.md`) | Preuve et vente du coaching |
| **Le défi** | « 30 jours, 400 personnes, une seule équipe gagne. Je suis 12e. » | Embarquer la communauté |
| **Le record / rang** | La vidéo exportée par l'app, telle quelle | Prouver que les gens l'utilisent |

Règles simples : sous-titres à l'écran, 7 à 20 secondes, un seul message par vidéo, un appel à
l'action en commentaire épinglé (« Écris RepCore et je t'envoie 2 mois gratuits » → message
privé avec le lien `?src=` de la vidéo).

---

## 7. Les chiffres à suivre chaque lundi (15 minutes)

| Indicateur | Où le lire | Cible |
|---|---|---|
| Nouveaux essais de la semaine | Écran Viralité / base | +20 % par mois |
| Essai → payant | Base (`droits`) | ≥ 20 % |
| Résiliation mensuelle | PayPal | < 8 %, puis < 6 % |
| Ambassadrices actives (≥ 1 inscription / semaine) | Codes ambassadeur | 10 au mois 2, 40 au mois 6 |
| Coachs payants | Paliers coach | 30 au mois 4, 250 au mois 12 |
| Places de coaching occupées | — | 10 au mois 1, 40 au mois 6 |
| Quota Firebase utilisé | Console Firebase | Basculer en Blaze à 70 % |

---

## 8. Calendrier résumé

| Période | Priorité unique | CA mensuel visé (prudent → ambitieux) |
|---|---|---|
| Semaine 1 | Les 7 corrections, 10 vidéos d'avance | 0 € |
| Mois 1 | Coaching 350 € + Offre Fondateur annuelle | 3 000 → 10 000 € (dont annuel encaissé d'avance) |
| Mois 2-3 | 30 ambassadrices, 1 défi par mois | 3 000 → 8 000 € |
| Mois 4-6 | Coachs + défis inter-communautés | 6 000 → 20 000 € |
| Mois 7-9 | Équipe de coachs RepCore, SEO | 10 000 → 35 000 € |
| Mois 10-12 | Résiliation sous 6 %, tout tourne | 12 000 → 50 000 € |

---

## 9. Les risques à garder en tête

- **La panne au pire moment** : un Reel qui part fort sur un plan gratuit saturé. Voir §2 n° 5.
- **Le droit de la consommation** : l'engagement de 12 mois sur un abonnement grand public
  attire des litiges et des remboursements PayPal. Sa suppression protège aussi le CA.
- **Les données de santé** (cycle menstruel, photos, mensurations) : c'est l'argument de vente,
  c'est aussi une catégorie sensible au sens du RGPD. Garder le consentement explicite déjà en
  place et ne jamais montrer une donnée de cycle dans un contenu sans accord écrit.
- **Les influenceuses** : contrat simple (commission, durée, mention « collaboration
  commerciale » obligatoire en France depuis la loi de 2023 sur l'influence).
- **Le temps de Kevin** : il ne peut pas coder, coacher 40 personnes et envoyer 25 messages
  par jour. Le gel du développement (§2 n° 6) n'est pas optionnel.
- **Fit Pulse (`club/`)** : c'est un deuxième produit B2B (pilotage d'une salle). Il pourrait
  se vendre à d'autres clubs, mais seulement après avoir vérifié à qui il appartient s'il a été
  construit pour un employeur. Hors de ce plan pour l'instant.
