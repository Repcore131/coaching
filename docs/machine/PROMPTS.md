# RepCore — La machine : prompts et messages

## Bloc contexte (avant chaque prompt de code)

```text
Tu travailles dans le dépôt RepCore (github Repcore131/coaching), branche indiquée par Kevin. RÈGLES DU PROJET, sans exception :
- PWA en JavaScript pur, sans framework. Balisage : app/index.html. Logique : app/rc-core.<build>.js (fichier unique, le numéro change : repère TOUJOURS par grep, jamais par numéro de ligne). Vidéo : app/motion-lab.js.
- Firebase Realtime Database en REST (objet CLOUD), plan Spark ; tout le travail serveur passe par le worker Cloudflare (cloudflare/src/, cron chaque minute). Cloud Functions non déployées. Règles : database.rules.json.
- PRIX : source unique tarifs.json. Après modification : python3 scripts/tarifs.py puis node scripts/verif/tarifs.mjs. Plans PayPal : node scripts/paypal_plans.mjs --tarifs.
- Paiement : PayPal Subscriptions (abonnements) et Orders (programmes, coaching), webhooks traités dans cloudflare/src/paypal.js.
- Style : identifiants en français, constantes en MAJUSCULES gelées (Object.freeze), fonctions PURE typées JSDoc et testées dans app/tests.js, tsc --checkJs doit passer (npx -y -p typescript@5.9 tsc -p tsconfig.json).
- ⚠ Un test interdit tout service d'e-mail ou de SMS DANS L'APP : toute synchronisation e-mail (Systeme.io) passe par le worker, jamais par le client.
- « Aucune valeur inventée », aucune promesse de résultat, conformité : résiliation en 3 clics (L215-1-1), mention « collaboration commerciale », RGPD (données de cycle = sensibles).
- Avant de coder : lis les modules cités, résume ce qui existe, réutilise. Termine par : tests, tsc OK, captures des écrans touchés, liste de ce que tu n'as pas fait et de ce que Kevin doit faire à la main.
```

## Partie 2 · Les fiches app

### A1 · Un seul prix, partout (Claude le fait seul)

L'audit a trouvé 11 contradictions : Google lit Essentielle à 9,95 € (JSON-LD de la landing) au lieu de 9,50 € ; la page /i dit « sans engagement » alors que les CGV disent 12 mois ; l'invité a 1 mois sur la landing et 2 mois dans le code ; le parrain est payé « au premier paiement » selon la landing, à 4 séances selon le code ; l'écran de fin d'essai affiche « 24,90 € en annuel ou 24,90 € au mois » ; la commission ambassadeur vaut 20-25 % dans le code et 30 % dans le plan.

**Pourquoi :** Un prix qui change d'une page à l'autre, c'est le premier signal de méfiance, et une pratique commerciale trompeuse en droit. C'est aussi la correction la plus rapide du document.

```text
OBJECTIF : zéro contradiction de prix, de durée ou de condition entre tarifs.json, la landing (y compris JSON-LD), /i, /c, l'app, les CGV et les docs.

1. Lis tarifs.json, scripts/tarifs.py, scripts/tarifs.mjs, scripts/verif/tarifs.mjs. Liste les clés couvertes et celles qui ne le sont pas.
2. Étends la recopie automatique aux endroits non couverts : JSON-LD de index.html (offers.price), FAQ de la landing (durée d'essai de l'invité, moment de récompense du parrain), i/index.html (mention d'engagement), écran de fin d'essai et bandeau annuel dans app/index.html et rc-core (« 24,90 € en annuel ou 24,90 € au mois »). Tout texte chiffré passe par data-tarif / data-nb.
3. Ajoute à scripts/verif/tarifs.mjs un contrôle qui ÉCHOUE si un montant en euros présent dans index.html, i/, c/, app/index.html, terms.html, legal.html ne correspond à aucune valeur de tarifs.json (liste blanche explicite pour les exemples).
4. Supprime les commentaires périmés (9,95 / 99 / 249) dans rc-core et scripts/paypal_plans.mjs ; mets à jour NOTE-DECISION-MODELE-ECONOMIQUE.md.
5. N'invente AUCUNE nouvelle valeur : là où deux sources se contredisent sans décision (commission 20/25 % vs 30 %, essai invité 1 ou 2 mois, récompense parrain), écris la liste dans DECISIONS-A-PRENDRE.md avec les deux options et arrête-toi pour ces points.
6. Corrige legal.html (hébergeur : Firebase Hosting, Google Ireland) et la mention identique des CGV.
7. Tests : verif/tarifs passe, tests.js passe ; donne le diff des textes visibles avant/après.
```

### A2 · Mensuel sans engagement, annuel qui récompense (Claude + toi)

Aujourd'hui le mensuel engage 12 mois, mais l'engagement n'est pas exigible (une annulation PayPal coupe sans recouvrement) et l'annuel coûte exactement 12 mois, sans remise. On passe à : mensuel résiliable à tout moment et annuel = 10 mois payés (Essentielle 95 €, Ultime 249 €). L'écran d'abonnement ouvre sur le mensuel, avec l'annuel mis en avant comme « 2 mois offerts ».

**Pourquoi :** « Engagement 12 mois » fait fuir le trafic froid qui arrive d'Instagram, sans rien protéger. Un vrai annuel remisé fait encaisser d'avance et coupe la résiliation pendant un an.

```text
OBJECTIF : supprimer l'engagement de 12 mois pour les NOUVEAUX abonnés et créer un annuel remisé, sans casser les abonnements existants.

1. Lis tarifs.json (engagementMois, essentielle.an, ultime.an), les écrans d'abonnement (app/index.html, recherche « engagement »), engagementJusqu dans rc-core, cloudflare/src/paypal.js, scripts/paypal_plans.mjs, terms.html §5.
2. tarifs.json : engagementMois:0, essentielle.an:95, ultime.an:249 (à confirmer par Kevin dans DECISIONS-A-PRENDRE.md avant de publier). Lance scripts/tarifs.py et verif/tarifs.mjs.
3. Plans PayPal : prépare la commande scripts/paypal_plans.mjs --tarifs pour créer les plans annuels aux nouveaux montants ; NE PAS l'exécuter : écris dans le compte rendu la commande exacte à lancer par Kevin et où récupérer les nouveaux identifiants. Le worker doit accepter anciens ET nouveaux montants pendant la transition.
4. Abonnés existants : rien ne change pour eux (on garde engagementJusqu si présent) ; le texte « sans engagement » ne s'affiche que pour les nouveaux.
5. Écran d'abonnement : onglet par défaut = « Chaque mois » dans l'app comme sur la landing ; carte annuelle avec « 2 mois offerts » calculé depuis tarifs.json (jamais écrit en dur).
6. CGV : réécris le §5 (durée, résiliation, renouvellement) ; garde la résiliation en 3 clics.
7. Tests : calcul de la remise, affichage selon ancien/nouvel abonné, verif/tarifs OK.
```

### A3 · La boutique ne cannibalise plus l’abonnement (Claude le fait seul)

Le programme « Fondations » à 14,90 € ouvre 3 mois d'Ultime : c'est Ultime à 4,97 € par mois, le chemin le moins cher de toute l'app. On change la règle : un programme acheté reste à toi à vie et ouvre 30 jours d'app ; ensuite il reste lisible avec Essentielle. Et on remplit les 4 emplacements vides (masse, sèche, force, reprise) avec le catalogue de la partie 3.

**Pourquoi :** Sans ça, chaque programme vendu fait perdre un abonnement Ultime. Avec ça, la boutique devient une porte d'entrée vers l'abonnement au lieu d'un raccourci pour l'éviter.

```text
OBJECTIF : un programme boutique = accès au programme à vie + 30 jours d'app, puis lecture du programme incluse dans Essentielle.

1. Lis le catalogue boutique dans rc-core (Fondations, aCompleter), tarifs.json (coaching.boutique_prog), cloudflare/src/paypal.js (achat programme, contrôle prixCts).
2. tarifs.json : boutique_prog.mois → 1 (30 jours) ; ajoute boutique_prog.acces:'vie'.
3. Modèle : /users/{uid}/programmesAchetes/{slug} = {date, prixCts, source} ; l'accès au contenu du programme ne dépend plus de l'abonnement ; les fonctions Ultime, si.
4. Le webhook PayPal accorde 30 jours (pas 3 mois) à partir de l'achat et enregistre l'achat à vie. Les achats déjà faits gardent leurs droits.
5. Prépare la structure des 4 programmes vides avec les fiches du catalogue que Kevin remplira (nom, promesse, durée, séances) : ne crée AUCUN contenu d'entraînement inventé, seulement les emplacements et les textes de vente fournis.
6. Tests : achat → 30 jours, fin des 30 jours → programme lisible, abonnement Ultime → tout ouvert.
```

### A4 · Le compte coach gratuit, vraiment limité (Claude le fait seul)

Le palier coach « Libre » (0 €) ne bloque jamais : n'importe qui peut ouvrir un compte coach et donner jusqu'à 12 mois d'app gratuite à des dizaines d'athlètes. On met de vraies limites : Libre = 1 athlète, codes de 1 mois ; Coach (19 €) = 15 athlètes, codes jusqu'à 6 mois ; Pro (39 €) = illimité, 12 mois.

**Pourquoi :** C'est une fuite directe : chaque athlète « offert » par un faux coach est un abonné perdu. La limite pousse aussi les vrais coachs vers le palier payant.

```text
OBJECTIF : appliquer réellement les quotas des paliers coach.

1. Lis tarifs.json (coach), la gestion des quotas coach dans rc-core (alerte de dépassement, proposition de palier) et la création des codes coach (durée maximale 12 mois).
2. Constante gelée QUOTAS_COACH = {libre:{athletes:1, moisCode:1}, coach:{athletes:15, moisCode:6}, pro:{athletes:Infinity, moisCode:12}} dans tarifs.json (recopiée par scripts/tarifs.py).
3. Fonction PURE peutRattacher(palier, nbActifs) et dureeCodeMax(palier). Au-delà du quota : le rattachement est refusé avec un écran clair « passe au palier Coach » (bouton d'abonnement), au lieu d'une simple alerte.
4. Les athlètes déjà rattachés au-delà du quota gardent leur accès jusqu'à la fin de leur code (aucune coupure rétroactive) ; prévenir le coach.
5. Règles RTDB : empêcher côté serveur (database.rules.json ou worker) la création d'un code au-delà de la durée du palier.
6. Tests : chaque palier, dépassement, codes existants.
```

### A5 · Payer par carte, sans compte PayPal (Claude + toi)

Le bouton « carte bancaire sans compte PayPal » existe dans le code, mais il ne s'affiche que si le compte PayPal Business l'autorise. À faire ensemble : tu actives deux réglages dans PayPal (5 minutes), Claude vérifie le parcours sur iPhone et Android, et ajoute un test automatique qui alerte si le bouton carte disparaît.

**Pourquoi :** Une bonne partie des 18-30 ans n'a pas ou n'utilise pas PayPal. Chaque personne qui ne voit que « PayPal » au moment de payer est une vente perdue au dernier mètre.

```text
OBJECTIF : garantir que le paiement par carte sans compte PayPal fonctionne et le rester.

PARTIE KEVIN (je te guide pas à pas, réponds « fait » à chaque étape) :
a) paypal.com → Paramètres du compte → Paiements sur le site web → « Compte PayPal facultatif » = Activé.
b) Vérifie que le compte est bien Business, vérifié, avec le compte bancaire confirmé.
c) Fais un achat test à 1 € avec une carte (je te prépare un plan de test à 1 € à supprimer ensuite).

PARTIE CLAUDE :
1. Lis le chargement du SDK PayPal dans rc-core (enable-funding=card) et le second bouton « Payer par carte ».
2. Vérifie avec Playwright (Chromium, profils iPhone 13 et Pixel 7) que le bouton carte est rendu ; capture d'écran du parcours jusqu'au formulaire carte (sans payer).
3. Si le SDK ne rend pas le bouton carte : affiche un message clair et un lien de secours (page de paiement PayPal hébergée) au lieu d'un écran vide.
4. Ajoute un contrôle hebdomadaire (workflow GitHub ou cron du worker) qui charge la page de paiement et alerte Kevin si le bouton carte n'apparaît plus.
5. Compte rendu : captures, résultat du test, ce qui reste à faire chez PayPal.
```

### A6 · Firebase prêt pour le pic viral (Claude + toi)

Le plan gratuit Spark a une limite dure : 100 connexions simultanées sur la base. Un Reel qui part, et la 101e personne ne voit plus rien. Décision : rester sur Spark (c'est ta règle), mais préparer la bascule : compte Blaze configuré avec alerte budget à 1 € et plafond, prêt à activer en 2 minutes, et l'app qui affiche « forte affluence, réessaie dans une minute » au lieu de planter.

**Pourquoi :** La pire chose qui puisse arriver, c'est un pic de visites sur une app qui ne charge pas : la viralité se transforme en mauvaise réputation. Le quota gratuit de Blaze est le même que Spark : tant que tu restes dessous, ça coûte 0 €.

```text
OBJECTIF : survivre à un pic sans payer tant qu'il n'a pas lieu.

PARTIE KEVIN (pas à pas) :
a) console.firebase.google.com → projet repcore-sync → Utilisation et facturation : relève les pics de connexions simultanées des 30 derniers jours (je t'explique où).
b) console.cloud.google.com/billing : crée un compte de facturation SANS l'associer au projet, puis un budget à 1 € avec alertes à 50/90/100 % sur ton e-mail. (Associer au projet = activer Blaze : on ne le fait que le jour où l'alerte de connexions sonne.)

PARTIE CLAUDE :
1. Lis l'objet CLOUD (connexions, écouteurs temps réel) dans rc-core : liste chaque écouteur permanent et estime les connexions par utilisateur actif.
2. Réduis les connexions inutiles : écouteurs fermés quand l'écran n'est pas visible, lectures ponctuelles (GET REST) au lieu d'écouteurs pour ce qui ne bouge pas.
3. Dégradation propre : si la base refuse la connexion (limite atteinte), écran « forte affluence » avec réessai automatique, et la séance en cours continue hors ligne (le cache local existe).
4. Le worker vérifie chaque minute le nombre d'utilisateurs actifs (/stats) et envoie une alerte push/e-mail à Kevin à 70 connexions simultanées estimées.
5. Écris docs/BASCULE-BLAZE.md : les 5 clics pour activer Blaze le jour J et revenir en arrière.
6. Tests : simulation de refus de connexion, reprise.
```

### A7 · La fiche Google Play (Claude + toi)

L'app Android existe déjà (TWA générée par Bubblewrap, com.repcore.app, assetlinks en place) mais elle n'est distribuée qu'en APK sur GitHub. Publier sur Google Play coûte 25 $ une fois et donne la recherche Play Store, la confiance d'une vraie fiche et les avis. Point de vigilance : Google impose ses règles de facturation pour les abonnements vendus dans une app.

**Pourquoi :** « Télécharger un APK » fait peur à 90 % des gens. Une fiche Play avec des avis lève le doute, et c'est la seule dépense du lancement.

```text
OBJECTIF : publier RepCore sur Google Play, conforme aux règles de facturation.

PARTIE KEVIN (pas à pas) :
a) play.google.com/console : compte développeur (25 $), identité vérifiée (pièce d'identité, adresse, téléphone), profil « particulier » ou « organisation » selon ton statut.
b) Créer l'application « RepCore », catégorie Santé et remise en forme, gratuite.
c) Remplir : politique de confidentialité (repcore-sync.web.app/privacy.html), questionnaire de classification, sécurité des données (je te donne chaque réponse), public cible 18+.
d) Test fermé : 12 testeurs pendant 14 jours (obligatoire pour les nouveaux comptes personnels) → je t'écris le message pour recruter 12 testeurs parmi tes abonnés.

PARTIE CLAUDE :
1. Lis android/ (twa-manifest.json, LISEZMOI.md), well-known/assetlinks.json, .github/workflows/apk.yml. Produis un AAB signé (bundle) au lieu de l'APK, versionCode incrémenté, et documente la clé de signature (Play App Signing).
2. FACTURATION : dans la version Play, ne PAS afficher le paiement PayPal des contenus numériques. Implémente un drapeau CANAL='play' (détecté via l'en-tête/paramètre de la TWA) : l'écran d'abonnement affiche « Ton abonnement se gère sur repcore-sync.web.app » sans lien de paiement direct, OU (option 2, à décider) Google Play Billing via l'API Digital Goods. Écris les deux options et leurs conséquences (commission Google 15 %) dans DECISIONS-A-PRENDRE.md avant de coder l'option 2.
3. Prépare la fiche : titre (30 car.), description courte (80) et longue (4000) optimisées « programme musculation », « suivi charge », « cycle menstruel » ; 8 captures 1080×1920 générées avec Playwright depuis un compte de démo ; icône 512 ; bannière 1024×500.
4. Ajoute « ?src=play » à l'URL de démarrage de la TWA pour mesurer les installations Play.
5. Compte rendu : fichiers prêts dans docs/play/, check-list de soumission.
```

### A8 · La fin d’essai qui donne envie de rester (Claude le fait seul)

Aujourd'hui la fin d'essai, c'est un bandeau et un écran. Aucun push à J-3 ou J-1, aucun e-mail. On ajoute : pushes J-3, J-1 et J0, un écran « Ce que tu as construit en 30 jours » (séances, kilos soulevés, records, régularité, ton avatar) et une offre claire : mensuel, annuel 2 mois offerts, ou programme.

**Pourquoi :** La fin d'essai est LE moment où l'argent rentre ou ne rentre jamais. Montrer ce qu'on perd en partant convertit bien mieux qu'un rappel de prix.

```text
OBJECTIF : transformer la fin d'essai en moment de conversion.

1. Lis s-essai-bilan, le bandeau d'essai (J1, J-9, J-3), cloudflare/src/metier.js (job acces, pushes), planif.js, retention.js (entonnoir finEssai → payant).
2. Worker : pushes de fin d'essai à J-3, J-1 et J0 (heure locale 18 h 30), uniquement aux abonnés aux notifications, messages personnalisés avec un chiffre réel (« 12 séances, 3 records : on continue ? »). Jamais de chiffre inventé : sans séance, un autre message.
3. Écran s-essai-bilan refait : 4 chiffres (séances, tonnage, records, semaines tenues), avatar de progression, 3 offres (mensuel, annuel avec 2 mois offerts, programme boutique), lien coaching.
4. Fonction PURE resumeEssai(sessions, records) testée.
5. Si e-mail opt-in (fiche A11) : le worker ajoute le tag « fin_essai » dans Systeme.io à J-3 pour déclencher la séquence e-mail.
6. Mesure : événements trial_end_viewed / trial_end_offer_clicked dans metrics/<jour>.
7. Tests : essai sans séance, avec séances, déjà payant.
```

### A9 · Relancer ceux qui n’ont jamais commencé (Claude le fait seul)

Les relances partent 7, 14 et 30 jours après la dernière séance : celui qui s'inscrit et ne fait jamais de séance n'est jamais relancé. C'est pourtant le plus gros trou de l'entonnoir. On ajoute J+1 (« ta première séance t'attend, 25 minutes »), J+3 (« la séance la plus simple pour démarrer ») et J+6 (« besoin d'aide ? réponds-moi »).

**Pourquoi :** Un inscrit qui fait sa première séance a plusieurs fois plus de chances de payer. Ces 3 pushes ne coûtent rien et touchent les gens au moment où ils ont encore envie.

```text
OBJECTIF : relancer les inscrits sans première séance.

1. Lis cloudflare/src/retour.js et metier.js (relances après dernière séance), le parcours « Mise sous tension » et l'entonnoir de retention.js.
2. Ajoute dans le worker un job « jamais_commence » : inscrits depuis 1, 3 et 6 jours, 0 séance, abonnés aux notifications → push personnalisé (prénom, programme du jour). Un seul push par jour et par personne, tous types confondus (respect du plafond existant).
3. Le push ouvre directement la séance du jour (lien profond).
4. Mesure : taux de 1re séance après chaque push (attribution par levier dans retention.js).
5. Tests : sélection des cibles, plafond, désinscription.
```

### A10 · La pause au lieu du départ (Claude le fait seul)

La résiliation se fait en 3 clics, et ça doit rester (c'est la loi). Mais on peut proposer, à côté, sans rien bloquer : « mettre en pause 1 mois » et « passer à Essentielle » pour un abonné Ultime. Et 30 jours après un départ, un message de retour avec ce qu'il a construit.

**Pourquoi :** Une bonne partie des résiliations viennent d'une pause de vie (vacances, blessure, examens), pas d'un rejet de l'app. Chaque abonné gardé vaut environ 250 € de chiffre sur sa durée de vie.

```text
OBJECTIF : des alternatives à la résiliation, conformes à L215-1-1 (résiliation en 3 clics maximum, sans obstacle).

1. Lis le parcours Réglages → Résilier dans rc-core (motif facultatif) et la décision L215-1-1 commentée dans le code. Ne la contourne pas.
2. Sur l'écran de confirmation, AU MÊME NIVEAU que le bouton « Résilier » (pas avant, pas en plus d'étapes) : « Mettre en pause 1 mois » (suspension PayPal de l'abonnement via l'API, reprise automatique) et « Passer à Essentielle » (si Ultime). Le bouton Résilier reste le premier et le plus visible.
3. Worker : suspension/reprise PayPal (subscriptions/{id}/suspend et activate), journal dans paypal_journal.
4. Retour J+30 : push et (si opt-in) tag Systeme.io « reconquete » avec un résumé réel de son historique et l'offre du moment.
5. Analyse : chaque motif de résiliation est compté par mois dans /stats pour le rapport du lundi.
6. Tests : 3 clics comptés, pause et reprise, motif enregistré.
```

### A11 · Récupérer l’e-mail (et l’envoyer dans Systeme.io) (Claude + toi)

Aujourd'hui aucune adresse e-mail n'est collectée pour le marketing : chaque inscrit qui n'active pas les notifications est perdu pour toujours. On ajoute une case « recevoir les conseils de Kevin par e-mail » (opt-in, décochée) à l'inscription et un formulaire « guide offert » sur la landing. Le worker envoie le contact dans Systeme.io avec sa source.

**Pourquoi :** Tu passes de 1 200 à 2 000 contacts sans effort supplémentaire, et chaque essai a une seconde chance par e-mail. C'est le canal que tu possèdes : ni Instagram ni Google ne peuvent te le couper.

```text
OBJECTIF : opt-in e-mail à l'inscription + formulaire lead magnet sur la landing, synchronisés avec Systeme.io par le worker.

PARTIE KEVIN : systeme.io → Paramètres du profil → Clé API publique : crée une clé, puis `npx wrangler secret put SYSTEMEIO_API_KEY` dans cloudflare/ (je te guide). Indique-moi le nom du tag unique utilisé sur le plan gratuit (ex. « repcore »).

PARTIE CLAUDE :
1. Lis l'inscription (register_completed), la page landing index.html, cloudflare/src/index.js (routes) et la doc https://developer.systeme.io/reference/api (création de contact, tags).
2. App : case opt-in décochée à l'inscription (« Reçois mes conseils et les nouveautés par e-mail »), consentement horodaté dans /users/{uid}/consentements/email.
3. Landing : bloc « Le guide offert : muscu et cycle menstruel, phase par phase » → formulaire prénom + e-mail → route du worker /lead (anti-spam : champ piège + limite par IP).
4. Worker : file d'envoi vers Systeme.io (POST contact + tag), 30 requêtes/minute max, reprise sur erreur, jamais d'e-mail envoyé par le worker lui-même. Champs perso : source (?src), date, statut (essai/payant).
5. Respect du test qui interdit l'e-mail dans l'app : rien de tout ça côté client, sauf la case.
6. Désinscription : un lien Systeme.io suffit ; la suppression de compte dans l'app supprime aussi le contact (API DELETE).
7. Tests : consentement absent → aucune synchro ; limite de débit ; erreurs API.
```

### A12 · MyProtein dans l’app (Claude + toi)

Le seul endroit où MyProtein apparaît aujourd'hui, c'est une liste de pré-workouts, sans lien ni code. On prépare des emplacements propres, activables dès que tu as l'accord écrit : carte partenaire dans l'écran Compléments, code promo copiable, lien suivi, défi du mois « présenté par MyProtein », et mention « lien partenaire ».

**Pourquoi :** C'est un revenu sans stock et sans service client, et un partenaire connu rassure les gens qui doutent d'une nouvelle app. On prépare tout maintenant, on allume quand le contrat est signé.

```text
OBJECTIF : des emplacements partenaire génériques, pilotés par la base, prêts pour MyProtein.

1. Lis les écrans s-supplements et s-supplement-edit, la carte de défi, la fin de Wrapped.
2. Nœud /partenaires/{cle} = {actif:false, nom, logo, code, lien, mention, emplacements:['complements','defi','wrapped'], debut, fin} ; règles RTDB : lecture publique, écriture admin.
3. Composant renderCartePartenaire(p, emplacement) : logo, une phrase, code copiable en un tap, lien avec ?utm_source=repcore&utm_medium=app&utm_campaign=<emplacement>, mention « lien partenaire » visible.
4. Rien ne s'affiche tant que actif=false. Pas de partenaire dans les écrans de séance (on ne pollue pas l'entraînement).
5. Compteurs : vues et clics par emplacement dans metrics/<jour>, lus par le rapport du lundi.
6. Tests : partenaire inactif, dates, plusieurs emplacements.
```

### A13 · Le coaching vendu dans l’app (Claude le fait seul)

Ton offre la plus rentable (coaching avec suivi 150 à 600 €, création de programme sans suivi 99 €) est vendue hors de l'app, via beacons.ai : aucune mesure, aucun lien avec l'ambassadeur qui a amené la personne. On la vend dans l'app avec PayPal (le paiement Orders existe déjà), avec deux familles bien distinctes : « Je te suis » et « Je te crée ton programme », et l'écran « Passer au coaching » après 3 mois d'abonnement.

**Pourquoi :** Un coaching vendu = le chiffre de 15 à 60 abonnements. Le vendre là où les gens sont déjà (l'app) et savoir d'où viennent les acheteurs, c'est doubler l'effet de chaque vidéo.

```text
OBJECTIF : vendre les 5 formules de coaching de tarifs.json dans l'app, mesurées et attribuées.

1. Lis tarifs.json (coaching.*), les liens beacons.ai dans index.html, app/index.html et rc-core, l'achat de programme (PayPal Orders) et cloudflare/src/paiements-coach.js.
2. Écran s-coaching-kevin : deux familles — « Avec suivi » (Essentiel 150 €, Transformation 350 €, Évolution 600 €) et « Sans suivi » (Programme personnalisé 99 €, Révision 40 €). Pour chacune : ce qui est inclus (texte de tarifs.json), délai de réponse, bouton de paiement.
3. Paiement PayPal Orders (montant contrôlé côté worker contre tarifs.json), puis questionnaire d'entrée (objectif, disponibilités, matériel, blessures, cycle facultatif) et création automatique du lien athlète ↔ coach Kevin.
4. Attribution : la source (?src, code ambassadeur) est enregistrée sur l'achat ; la commission ambassadeur s'applique selon la décision de DECISIONS-A-PRENDRE.md.
5. « Passer au coaching » : carte affichée une fois, après 3 mois d'abonnement actif et au moins 20 séances.
6. Remplace les liens beacons.ai par l'écran (garde beacons comme secours si le paiement échoue).
7. CGV : ajoute la section coaching et programmes (aujourd'hui exclue).
8. Tests : contrôle du montant, attribution, carte « passer au coaching ».
```

### A14 · Mesurer d’où vient chaque euro (Claude le fait seul)

L'app sait déjà compter (src, ambassadeurs, entonnoir), mais la landing et le blog n'envoient aucun src : le rapport verra « direct » partout. On met un src sur chaque lien (bio Instagram, LinkedIn, newsletter, blog, QR des salles, Play Store), on lit aussi les UTM, et on expose un tableau /stats/ventes lu par le rapport du lundi.

**Pourquoi :** Sans ça, tu ne sauras jamais si c'est la vidéo, l'influenceuse ou l'e-mail qui a vendu, et tu continueras ce qui ne marche pas.

```text
OBJECTIF : attribution complète et un point d'accès de statistiques pour le rapport du lundi.

1. Lis l'attribution (attribution/jours/…, /arrivee, functions/attribution-calcul.js) et retention.js.
2. Landing et blog : tous les CTA portent ?src=<page> (landing_hero, landing_tarifs, blog_<slug>) ; la landing transmet src/ref/utm_* à l'app.
3. L'app lit utm_source/utm_medium/utm_campaign et les range dans src si src est absent.
4. Worker : route GET /stats/ventes?token=… (jeton secret STATS_TOKEN) → JSON des 7 et 28 derniers jours : visites, inscriptions, 1res séances, essais finis, payants, CA par offre, résiliations et motifs, par src et par ambassadeur.
5. Écris docs/LIENS-SUIVIS.md : la liste des liens à utiliser partout (bio, LinkedIn, e-mails, QR) avec leur src.
6. Tests : propagation des paramètres, calcul des agrégats.
```

### A15 · Le parrain récompensé au bon moment (Claude le fait seul)

Le parrain gagne son mois dès que le filleul fait 4 séances, avant tout paiement : on offre un mois sans rien encaisser, et la landing dit l'inverse. On garde l'esprit (récompense rapide) mais on la verse au premier paiement du filleul, et on affiche le prénom du parrain aussi sur la landing (« Thomas t'offre ton 2e mois »).

**Pourquoi :** Le parrainage doit rapporter plus qu'il ne coûte. Le prénom d'un ami sur la page d'arrivée, c'est la meilleure preuve sociale qui existe.

```text
OBJECTIF : récompense du parrain au premier paiement du filleul, prénom du parrain visible dès la landing.

1. Lis functions/parrainage-calcul.js, cloudflare/src/metier.js (crédit du parrain), i/index.html et la classe body.invite de index.html.
2. Change la condition de crédit : premier paiement confirmé par webhook (et non 4 séances). Garde le mois « mentor » à 10 filleuls PAYANTS.
3. Landing : si ?ref= présent, bandeau « [Prénom] t'offre ton 2e mois » avec l'emblème de son rang (même source que /i).
4. Mets à jour la FAQ et les CGV via tarifs.json (fiche A1).
5. Tests : crédit au paiement, pas de crédit sans paiement, affichage du prénom échappé.
```

### A16 · Le mini-chat qui répond à 2 h du matin (Claude + toi)

Une bulle de discussion sur la landing (et dans l'app avant l'abonnement) qui répond aux vraies questions : « c'est quoi la différence entre Essentielle et Ultime ? », « ça marche pour une débutante ? », « je peux annuler ? ». Elle s'appuie uniquement sur tes pages (tarifs, FAQ, CGV) et propose l'essai ou un message à Kevin. Seul coût : quelques euros d'API par mois, avec un plafond.

**Pourquoi :** Les gens doutent et n'osent pas te demander. Une réponse immédiate, honnête et sans pression lève le doute au moment exact où il apparaît. Et chaque question posée te dit quoi améliorer.

```text
OBJECTIF : un assistant de questions-réponses sur la landing, ancré sur les pages de RepCore, avec plafond de coût.

PARTIE KEVIN : console.anthropic.com → crée une clé API, mets un plafond de dépense mensuel (ex. 10 €), puis `npx wrangler secret put ANTHROPIC_API_KEY` dans cloudflare/ (je te guide).

PARTIE CLAUDE :
1. Lis index.html, tarifs.json, FAQ, terms.html. Construis docs/base-chat.md (connaissances autorisées) générée automatiquement depuis ces fichiers (script dans scripts/), pour qu'elle suive les prix.
2. Worker : route POST /chat → modèle Claude le plus économique disponible, système strict : répondre uniquement à partir de base-chat.md, en français, 80 mots max, jamais de conseil médical, jamais de promesse de résultat, toujours proposer l'essai gratuit ou « écrire à Kevin ». Limites : 10 messages par visiteur et par jour, 300 conversations par jour, coupure si le budget mensuel est atteint.
3. Landing : bulle discrète en bas à droite, chargée à la demande, accessible au clavier.
4. Journal anonymisé des questions (sans e-mail ni IP en clair) → résumé hebdomadaire dans le rapport du lundi : questions fréquentes, réponses manquantes.
5. Tests : refus hors sujet, plafond, réponse quand le modèle est indisponible (renvoi vers la FAQ).
```

### A17 · Le coach fixe ses prix et devient ambassadeur (Claude le fait seul)

Deux corrections sur l'espace coach. 1) La vitrine d'un coach affiche aujourd'hui tes prix : chaque coach doit fixer les siens. 2) On fait de chaque coach un ambassadeur : quand un de ses athlètes passe en abonnement payant à la fin de son coaching, le coach touche la même commission qu'une influenceuse. Il a enfin intérêt à pousser l'app.

**Pourquoi :** C'est le mécanisme qui transforme 1 coach en 5 à 30 abonnés payants pour toi. Sans intérêt financier, le coach utilise l'app gratuitement et ne la recommande jamais.

```text
OBJECTIF : prix libres pour les coachs externes, et commission coach sur les athlètes convertis.

1. Lis c/index.html (formules affichées depuis tarifs.json), cloudflare/src/paiements-coach.js (payee = coach, sans frais), functions/ambassadeurs-calcul.js (commission, J+30), le message de fin de coaching qui renvoie vers Essentielle.
2. Modèle : /coachs/{uid}/formules/{id} = {lib, prixCts, mois, comprend} saisis par le coach (bornes 0-2000 €) ; la vitrine et paiements-coach.js lisent ces prix ; fallback : aucune formule affichée (jamais les prix de Kevin).
3. Commission coach : un athlète rattaché à un coach qui devient abonné payant RepCore dans les 90 jours suivant la fin de son code → le coach est crédité comme un ambassadeur (taux de la décision commune), 12 mois, payé selon le même rapport mensuel.
4. Tableau du coach : « Tes athlètes devenus abonnés : X · ta commission du mois : Y € ».
5. Garde paiements-coach.js fermé (PAIEMENTS_COACH) tant que Kevin n'a pas validé les CGV coach ; écris ce qu'il faut ajouter aux CGV.
6. Tests : prix bornés, commission dans la fenêtre de 90 jours, pas de double commission ambassadeur + coach.
```

### A18 · La salle partenaire et ses QR codes (Claude le fait seul)

Pour Corona Gym et les suivantes : une page salle dans l'app (logo, machines filmées, défi de la salle), un QR code par machine qui ouvre directement la fiche filmée, et un code salle qui offre 2 mois d'essai. Tout est généré par un script à partir d'une simple liste de machines.

**Pourquoi :** Chaque membre qui scanne une machine devient un essai, sans pub, tous les jours. Et la salle gagne un service que ses concurrentes n'ont pas.

```text
OBJECTIF : « mode salle partenaire » générique, prêt pour Corona Gym.

1. Lis la banque d'exercices (/exercices, scripts/seed_exercices.py, app/exercices/), les codes d'essai (metier.js) et les vitrines coach (c/index.html) pour réutiliser le modèle.
2. Nœud /salles/{slug} = {nom, ville, logo, couleurs, machines:[{slug, nom, exerciceSlug, video}], codeEssai, actif}.
3. Page publique /salle/{slug} (comme /c) : présentation, liste des machines, bouton « 2 mois offerts avec le code de la salle ».
4. Lien de QR par machine : /salle/{slug}/m/{machine}?src=qr_{slug} → fiche filmée ; dans l'app si installée, sinon page publique + essai.
5. Script scripts/qr_salle.mjs : à partir d'un CSV (machine, exercice, vidéo), génère la page, les QR en PNG et un PDF A4 d'étiquettes à coller (logo salle + RepCore).
6. Statistiques par salle (scans, essais, payants) dans /stats/ventes (fiche A14).
7. Tests : génération sur un CSV de 3 machines, page sans vidéo, salle inactive.
```

## Partie 4 · Les messages

### Influence · femmes

**DM 1 · le premier contact** (Jour 0)

```text
Coucou [prénom] 🙂
Moi c'est Kevin, coach en salle. Ta vidéo sur [sujet précis] m'a vraiment parlé, surtout [le détail qui t'a plu].

Je t'écris parce que j'ai passé plus d'un an à créer une app de muscu, RepCore, et il me manque l'avis de vraies pratiquantes comme toi. Elle te dit quelle charge mettre à chaque série, et elle s'adapte à ton cycle : les semaines où tu te sens vidée, elle ajuste au lieu de te faire culpabiliser.

Est-ce que tu serais partante pour la tester gratuitement 2-3 semaines et me dire franchement ce que tu en penses ? Zéro obligation de poster quoi que ce soit, promis.
```

**DM 2 · la relance douce** (Jour 4, si pas de réponse)

```text
Je me permets de remonter mon message, je sais que tes DM débordent 🙈
Si ça ne te parle pas, aucun souci, dis-le moi simplement. Et si tu es curieuse, je t'envoie l'accès en 30 secondes.
```

**DM 3 · l’accès** (Dès le « oui »)

```text
Merci, ça me fait super plaisir 🙏
Voici ton accès Ultime offert : [lien ?src=test_prenom]
Pour que ton avis m'aide vraiment, teste juste 3 choses pendant 2 semaines :
1. ta séance avec la charge proposée à chaque série,
2. le suivi du cycle (si tu veux l'activer),
3. ton premier bilan.
Tout ce qui t'agace, tout ce qui te manque : envoie-moi même un vocal, je prends tout.
```

**DM 4 · le point à J+7** (Jour 7 après l’accès)

```text
Hello [prénom] ! Petit point à mi-parcours : qu'est-ce qui t'a plu, et qu'est-ce que tu changerais en premier ? Je corrige vite, ton retour compte vraiment.
```

**DM 5 · la proposition** (Après son retour (J+14 à J+21))

```text
Merci pour tes retours, j'ai déjà modifié [ce qu'elle a demandé] grâce à toi 💪
Si l'app t'a plu, j'aimerais qu'on fasse équipe : ta commu a 2 mois offerts avec ton code [CODE], et toi tu touches 30 % de ce qu'ils paient pendant 12 mois. Rien à avancer, rien d'obligatoire, tu en parles quand et comme tu veux (avec la mention « collaboration commerciale »). Et ton accès reste offert à vie. Ça te dit ?
```

### Influence · hommes

**DM 1 · le premier contact** (Jour 0)

```text
Salut [prénom] !
Kevin, coach en salle. Ta vidéo sur [sujet précis] est vraiment propre, surtout [détail].

J'ai passé plus d'un an à coder une app de muscu, RepCore, et je cherche l'avis de mecs qui s'entraînent sérieusement. Elle te dit quelle charge mettre à chaque série à partir de tes séances précédentes et de ton RIR, et elle repère quand tu stagnes avant toi.

Tu serais chaud pour la tester gratuitement 2-3 semaines et me dire cash ce que tu en penses ? Aucune obligation de poster.
```

**DM 2 · la relance** (Jour 4, si pas de réponse)

```text
Je remonte mon message, je sais que tes DM sont pleins 😅 Si ça ne te parle pas, pas de souci. Sinon je t'envoie l'accès en 30 secondes.
```

**DM 3 · l’accès** (Dès le « oui »)

```text
Top, merci ! Ton accès Ultime offert : [lien ?src=test_prenom]
Teste 3 choses : la charge proposée série par série, l'analyse vidéo d'un exercice, ton premier bilan. Tout ce qui te gêne, balance-le moi, même en vocal.
```

**DM 4 · le point à J+7** (Jour 7)

```text
Alors, premiers retours ? Ce que tu gardes, ce que tu jettes ? Je corrige vite.
```

**DM 5 · la proposition** (J+14 à J+21)

```text
Merci pour tes retours, [ce qu'il a demandé] est déjà corrigé. Si l'app te plaît : ta commu a 2 mois offerts avec ton code [CODE], tu touches 30 % de ce qu'ils paient pendant 12 mois, rien à avancer. Ton accès reste offert à vie. Partant ?
```

### Coachs · Instagram

**DM 1 · le coach** (Jour 0)

```text
Salut [prénom], je suis coach comme toi 🙂 Petite question : tes clients, tu les suis comment aujourd'hui ? Excel, PDF, WhatsApp ?
J'ai construit RepCore pour arrêter de tout ressaisir : ton client a l'app, elle lui propose la charge à chaque série, et toi tu vois ses séances, ses bilans et même son cycle en un coup d'œil. Je te l'offre 3 mois avec tes clients pour que tu juges sur pièce. Je t'envoie l'accès ?
```

**DM 2 · la relance** (Jour 4)

```text
Je remonte mon message 🙏 Si tu veux, je te montre en 10 minutes en visio comment un client voit son programme et comment toi tu le suis.
```

**DM 3 · après la démo** (Le jour de la démo)

```text
Merci pour l'échange ! Voici ton accès coach : [lien]. Crée ton premier client en 2 minutes (ou invite-moi comme client test), et dis-moi ce qui te manque pour y mettre tous tes élèves.
```

### Ambassadeurs MyProtein (WhatsApp)

```text
Salut [prénom] ! C'est Kevin, ambassadeur MyProtein comme toi 💪
J'ai créé RepCore, une app de muscu qui te dit quelle charge mettre à chaque série (et qui s'adapte au cycle pour les filles). Je cherche quelques ambassadeurs pour la tester gratuitement et me faire des retours.
Si ça te dit, je t'envoie un accès offert, sans engagement. Et si elle te plaît, on peut faire équipe : ta commu a 2 mois offerts, toi 30 % pendant un an.
```

### LinkedIn · post

```text
Après plus d'un an de développement, je lance RepCore.

Je suis coach en salle. Pendant des années, j'ai vu la même chose : des gens motivés qui ne savent pas quoi mettre sur la barre, des programmes en PDF qu'on abandonne au bout de trois semaines, des coachs qui passent leurs soirées sur Excel et WhatsApp.

Alors j'ai construit l'outil que j'aurais voulu avoir :
→ la bonne charge proposée à chaque série,
→ un entraînement qui s'adapte au cycle menstruel,
→ un espace coach où l'on voit tout sans rien ressaisir.

[vidéo]

Vous êtes coach, vous travaillez en salle ou vous dirigez un club ? Écrivez-moi, je vous montre en 10 minutes ce que ça change pour vos clients et vos membres.
```

### LinkedIn · coach

```text
Bonjour [prénom], merci pour la connexion. Je vois que vous coachez [type de public] : comment suivez-vous vos clients aujourd'hui ? Je viens de lancer RepCore, une app où vos clients ont leur programme avec la charge proposée à chaque série, et où vous voyez séances et bilans sans rien ressaisir. Je vous l'offre 3 mois avec vos clients. Ça vous dit que je vous montre en 10 minutes ?
```

### LinkedIn · salle

```text
Bonjour [prénom], j'ai vu votre parcours chez [salle / réseau]. Je viens de lancer RepCore, une app de musculation. Je propose aux salles de filmer chacune de leurs machines (réglage, exécution, erreurs) et de les mettre dans l'app avec un QR code sur chaque machine : vos membres savent quoi faire dès le premier jour, et vous récupérez du contenu pour vos réseaux. 10 minutes pour vous montrer ?
```

### Mail Corona Gym

```text
Objet : Les machines de Corona Gym, filmées et expliquées pour vos membres

Bonjour Ibrahim,

Félicitations pour l'ouverture de Corona Gym Bordeaux : 1 800 m², un espace HYROX officiel et un corner SBD, c'est un vrai lieu.

Je suis Kevin, coach diplômé, et j'ai créé RepCore, une app de musculation qui propose la bonne charge à chaque série. Je propose aux salles qui ouvrent de filmer chacune de leurs machines (réglage, exécution, erreurs), de les mettre dans l'app avec un QR code sur chaque machine, et de vous livrer les vidéos pour vos réseaux.

Vos nouveaux membres savent quoi faire dès le premier jour, et vous récupérez une quarantaine de contenus. Pour vous, c'est gratuit pendant les 30 premiers jours.

Est-ce que je peux passer vous montrer en 10 minutes cette semaine ?

Kevin Guellec
Coach · fondateur de RepCore
[téléphone] · repcore-sync.web.app
```

## Partie 5 · Les moteurs

### M1 · Le rapport du lundi (Chaque lundi 7 h 45)

```text
Crée une routine planifiée « Rapport du lundi RepCore », chaque lundi à 7 h 45 (Europe/Paris).
À chaque exécution :
1. PayPal : liste les transactions et abonnements des 7 derniers jours (montant, offre, nouveau / renouvelé / remboursé).
2. RepCore : lis https://<worker>/stats/ventes?token=<STATS_TOKEN> (fiche A14) : visites, inscriptions, 1res séances, essais finis, payants, CA par offre, résiliations et motifs, par source et par ambassadeur.
3. Compare à la semaine précédente et aux 4 dernières semaines (Google Sheets « RepCore · pilotage », un onglet par semaine, tu ajoutes la ligne).
4. Écris un rapport de 15 lignes max : les 3 chiffres qui comptent, ce qui a vendu (source), ce qui fuit (étape de l'entonnoir), et 5 priorités concrètes pour la semaine, chacune avec son brouillon prêt (DM, e-mail, post) ou son prompt de code.
5. Envoie-le par Gmail à guellec.coachingpro@gmail.com, objet « RepCore · semaine du [date] ».
Règles : aucun chiffre inventé ; si une source ne répond pas, écris-le en premier. Ne modifie rien, n'envoie rien d'autre.
```

### M2 · Le moteur SEO (2 articles par semaine)

```text
Crée une routine planifiée « SEO RepCore », mardi et vendredi à 6 h.
À chaque exécution, dans le dépôt Repcore131/coaching :
1. Lis blog/ et sitemap.xml ; tiens à jour docs/seo/plan.md (liste de 60 sujets classés par intention de recherche : débutante, fessiers, cycle, charge, sèche, coachs ; je la crée à la 1re exécution).
2. Prends le prochain sujet non traité, écris un article de 900 à 1 400 mots en français, au ton de Kevin (coach, direct, bienveillant), structuré (H2/H3), avec 1 encadré « ce que fait RepCore », 2 liens internes, un appel à l'essai blog_<slug>, balises title/description/OG, données structurées Article.
3. Garde-fous : aucune promesse médicale ou de résultat, sources citées pour toute affirmation scientifique, pas de chiffre inventé, pas de copie.
4. Ajoute l'article au sitemap et à la page d'index du blog, crée une branche, ouvre une pull request « SEO : [titre] », et fusionne-la automatiquement si les contrôles (tests, verif/tarifs) passent ; sinon laisse-la ouverte et préviens Kevin.
5. Une fois par mois : relis les articles publiés, corrige les liens cassés et mets à jour les prix depuis tarifs.json.
```

### M3 · La chasse aux coachs et aux salles (Chaque matin, 10 contacts)

```text
Crée une routine planifiée « Prospection B2B RepCore », du lundi au vendredi à 7 h 30.
À chaque exécution :
1. Lis le Google Sheets « RepCore · prospects » (onglets Coachs et Salles) pour éviter les doublons.
2. Trouve 10 nouveaux contacts (6 coachs indépendants, 4 salles indépendantes) dans la zone en cours (ordre : Bordeaux, Niort, La Rochelle, Poitiers, Nantes, puis grandes villes), avec l'outil de prospection connecté et la recherche web : nom, rôle, ville, site ou Instagram, e-mail professionnel PUBLIC uniquement, un détail personnel vérifiable (spécialité, post récent, ouverture).
3. Exclus : Fitness Park et toute salle de ton employeur, les franchises, toute personne sans e-mail pro public.
4. Pour chacun, crée un brouillon Gmail (jamais un envoi) : 90 mots max, le détail personnel en première ligne, l'offre (coach : 3 mois offerts + 30 % sur ses athlètes devenus abonnés ; salle : machines filmées + QR codes, gratuit 30 jours), une seule question, la signature de Kevin, une ligne de désinscription (« dites-moi si je ne dois plus vous écrire »).
5. Ajoute chaque ligne au Sheets (date, contact, source, statut « brouillon »).
6. Le vendredi : relance J+7 en brouillon pour les « envoyés » sans réponse (une seule relance).
```

### M4 · Les partenariats et la presse (Le 1er et le 15 du mois)

```text
Crée une routine planifiée « Partenariats & presse RepCore », le 1er et le 15 de chaque mois à 9 h.
À chaque exécution :
1. Relis le Sheets « RepCore · partenariats » (déjà contactés, réponses).
2. Propose 10 opportunités nouvelles et vérifiées (marques fitness et nutrition compatibles avec MyProtein, médias, podcasts, newsletters, événements HYROX/powerlifting, salons) avec : contact public, angle d'histoire (« coach qui a codé seul son app », « la muscu qui suit le cycle »), ce que ça rapporte, effort.
3. Pour les 5 meilleures, écris un brouillon Gmail personnalisé (120 mots max) et un mini dossier de presse (docs/presse/kit.md tenu à jour : histoire, chiffres réels, 3 visuels, contact).
4. Envoie à Kevin un récapitulatif « oui / non » : il répond avec les numéros à envoyer ; seuls ceux-là partent (brouillons → envoi après son accord écrit dans la conversation).
```

### M5 · Le vivier d’influenceuses et d’influenceurs (Chaque lundi, 15 comptes)

```text
Crée une routine planifiée « Vivier influence RepCore », chaque lundi à 8 h.
À chaque exécution :
1. Lis le Sheets « RepCore · influence » (colonnes : compte, abonnés, niche, DM1, DM2, oui/non, accès, retour J7, proposition, code, 1re vidéo, inscrits, payants).
2. Trouve 15 nouveaux comptes francophones, 5 000 à 150 000 abonnés, publication de moins de 14 jours, niche muscu en salle / fessiers / powerlifting féminin / HYROX / cycle (12 femmes, 3 hommes). N'ajoute que des comptes dont tu as vérifié l'existence et l'activité ; écris l'URL et la date de vérification. Exclus les comptes qui font la promotion d'une autre app de coaching.
3. Pour chacun, écris le DM 1 (modèle féminin ou masculin du guide) personnalisé avec le sujet de sa dernière vidéo et un détail précis, 80 mots max.
4. Calcule les relances dues cette semaine (DM 2 à J+4 sans réponse, point J+7, proposition J+14 après retour) et liste-les avec leur texte.
5. Envoie à Kevin un récapitulatif : « 15 nouveaux DM à envoyer, X relances, Y propositions » avec tout le texte prêt à copier.
```

### M6 · La veille concurrentielle (Le 1er du mois)

```text
Crée une routine planifiée « Veille concurrents RepCore », le 1er de chaque mois à 8 h.
À chaque exécution :
1. Pour chaque concurrent de docs/veille/concurrents.md (je le crée et je l'enrichis), relève : prix publics, nouveautés annoncées, notes et 10 derniers avis des stores (surtout les plaintes), positionnement.
2. Cherche les nouvelles apps de coaching musculation lancées en France ce mois-ci.
3. Écris docs/veille/AAAA-MM.md : ce qui a changé, les 5 plaintes les plus fréquentes chez les autres, où RepCore est devant, où il est derrière.
4. Propose 3 modifications (produit, prix ou message) avec pour chacune : pourquoi, gain attendu, et le prompt Claude Code prêt (dans le format des fiches du guide).
5. Ouvre une pull request avec le rapport et envoie le résumé à Kevin par e-mail.
```

### M7 · Les e-mails qui vendent tout seuls (Une fois, puis en continu)

```text
Mets en place la machine e-mail RepCore.
1. Rédige dans docs/emails/ : la séquence de bienvenue (5 e-mails, guide partie 4), la campagne de lancement (5 e-mails), et un modèle de newsletter hebdomadaire (histoire, conseil, lien ; 150 à 250 mots ; signé Kevin ; une question pour inciter à répondre).
2. Pour chaque e-mail : objet + 2 variantes, aperçu, texte brut, lien avec ?src=mail_<nom>.
3. Guide pas à pas pour Kevin dans Systeme.io (plan gratuit : 1 séquence = la bienvenue ; Startup au lancement) : où coller chaque e-mail, délais, déclencheur (tag), test d'envoi.
4. Crée une routine planifiée « Newsletter RepCore » chaque jeudi 7 h : écrit la newsletter de la semaine à partir des nouveautés de l'app, du meilleur article SEO et d'une question d'abonné, et l'envoie à Kevin en brouillon (il la colle et programme en 2 minutes ; si l'API Systeme.io permet l'envoi direct, propose-le).
5. Vérifie l'authentification du domaine d'envoi (SPF, DKIM, DMARC) et écris les enregistrements DNS à ajouter.
```

### M8 · Les commissions du mois (Le 1er du mois)

```text
Crée une routine planifiée « Commissions RepCore », le 1er du mois à 9 h.
1. Lis le calcul existant (functions/ambassadeurs-calcul.js, workflow rapport-payeur.yml, scripts/rapport_payeur.mjs) et les paiements PayPal du mois.
2. Calcule par bénéficiaire (ambassadeurs, coachs) : filleuls payants, montants encaissés (hors remboursements, après J+30), commission due.
3. Écris docs/commissions/AAAA-MM.md et l'onglet du Sheets « RepCore · commissions ».
4. Prépare le lot de paiements PayPal (fichier prêt à importer) SANS l'exécuter, et un message personnel par bénéficiaire avec son chiffre.
5. Envoie le tout à Kevin pour validation.
```

### M9 · L’usine à vidéos pub (À la demande)

```text
Génère une série de variantes publicitaires RepCore.
1. À partir de la vidéo fournie (et des captures d'écran réelles de l'app dans app/img/vente), propose 8 accroches (2 secondes, texte à l'écran) adaptées aux 3 cibles : femmes 18-34 en salle, pratiquants autonomes, coachs.
2. Monte 5 variantes : 6 s (story), 10 s, 15 s (reel), en 9:16 et 4:5, sous-titres Montserrat blanc, mot-clé rouge #E02020, logo final. Utilise l'outil vidéo connecté pour les plans d'ambiance seulement (jamais un faux écran d'app, jamais une fausse personne présentée comme cliente).
3. Donne le coût en crédits avant de générer, et attends l'accord de Kevin.
4. Livre les fichiers et un tableau « accroche / version / pour quel public ».
```

### M10 · La réponse aux questions et aux avis (Chaque jour)

```text
Crée une routine planifiée « Questions et avis RepCore », chaque jour à 20 h.
1. Lis le journal anonymisé du mini-chat (worker), les motifs de résiliation du jour (/stats/ventes) et les nouveaux avis Google Play.
2. Regroupe les questions par thème ; si une question revient 3 fois sans bonne réponse, propose l'ajout à la FAQ (pull request sur index.html et la base du chat).
3. Propose une réponse à chaque avis (ton de Kevin, courtois, sans promesse) : Kevin la publie.
4. N'envoie un message à Kevin que s'il y a quelque chose à faire (avis à 1-2 étoiles, demande de remboursement, bug signalé).
```

## Les 3 prompts maîtres

### Lance ma semaine

```text
Tu es mon équipe marketing RepCore. Lis le dernier rapport du lundi, le Sheets de pilotage, les prospects, le vivier influence et mes notes de compte rendu. Donne-moi : les 3 actions qui rapportent le plus cette semaine (avec le texte prêt à envoyer ou à poster), ce que tu fais seul cette semaine, et ce que je dois valider (liste numérotée, je réponds par les numéros).
```

### Génère-moi une campagne

```text
Génère la campagne complète « [objet : Black Friday / défi fessiers / Fondateur / nouvelle salle] » : page de vente dans le dépôt (p/[slug], aux couleurs RepCore, prix depuis tarifs.json, lien ?src=), 3 e-mails Systeme.io, le script de la story compte à rebours et du post vidéo, 15 DM pour les ambassadrices, le message LinkedIn, et le tableau de suivi. Calendrier sur 10 jours. Tu me montres tout avant publication, puis tu publies la page et prépares les brouillons.
```

### Trouve-moi de l’argent

```text
Passe en revue tous les leviers du guide (fiches app, moteurs, 50 leviers) et mes chiffres réels. Classe les 5 actions qui rapporteraient le plus d'euros ce mois-ci par heure de mon temps. Pour chacune : le gain estimé (avec ton hypothèse), ce que tu fais seul, ce que je dois faire (en minutes), et tout le matériel prêt (textes, brouillons, prompts de code). Rien n'est envoyé sans mon accord.
```

## Partie 6 · Prompts des risques

### L’essai et les droits contrôlés côté téléphone

```text
Lis comment rc-core décide qu'un utilisateur a droit à l'essai, à Ultime ou à un programme (statuts, dates, FONCTIONS_SERVEUR=false). Propose et implémente une vérification côté serveur sans Blaze : les droits (fin d'essai, abonnement, programmes achetés) sont écrits uniquement par le worker (clé de service) et les règles database.rules.json interdisent au client de les modifier. Le client lit, ne décide plus. Tests de règles : un client ne peut pas prolonger son essai ni s'attribuer un programme.
```

### Les données de santé (cycle, photos, mensurations)

```text
Audite le traitement des données de cycle, des photos de bilan et des mensurations : consentement explicite et séparé, finalité affichée, accès coach seulement si l'athlète l'accepte, export (JSON) et suppression complète (base + stockage + Systeme.io) depuis les réglages. Mets à jour privacy.html et écris docs/RGPD-registre.md (registre des traitements). Liste ce que Kevin doit signer (sous-traitance coachs).
```

### La loi sur l’influence

```text
Rédige docs/influence/contrat-ambassadeur.md : contrat d'une page conforme à la loi du 9 juin 2023 (objet, rémunération 30 % sur encaissé 12 mois, mention « collaboration commerciale » obligatoire, interdictions (promesses de résultat, santé), durée, résiliation, données personnelles), et le kit ambassadrice (3 idées de vidéos, 5 accroches, mentions, lien et code). Signale ce qui doit être validé par un juriste.
```

### La promesse sur le cycle

```text
Cherche dans index.html, l'app, les articles du blog, les e-mails et docs/ toute formulation qui promet un résultat lié au cycle (« plus de force », « plus de résultats »). Propose une reformulation centrée sur l'adaptation et le ressenti, et ajoute un test qui échoue si une liste de formulations interdites réapparaît.
```

### Le compte PayPal gelé

```text
Écris docs/PLAN-B-PAIEMENT.md : que faire si le compte PayPal est restreint (procédure, documents, délais), et étudie un second prestataire compatible avec l'architecture (worker Cloudflare, sans Blaze) : avantages, frais, travail nécessaire. Ne code rien, propose.
```
