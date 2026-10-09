# Fiches « app » : ce qu'on modifie avant d'ouvrir les vannes. Chaque fiche : idée, pourquoi, qui, prompt.

CTX = """Tu travailles dans le dépôt RepCore (github Repcore131/coaching), branche indiquée par Kevin. RÈGLES DU PROJET, sans exception :
- PWA en JavaScript pur, sans framework. Balisage : app/index.html. Logique : app/rc-core.<build>.js (fichier unique, le numéro change : repère TOUJOURS par grep, jamais par numéro de ligne). Vidéo : app/motion-lab.js.
- Firebase Realtime Database en REST (objet CLOUD), plan Spark ; tout le travail serveur passe par le worker Cloudflare (cloudflare/src/, cron chaque minute). Cloud Functions non déployées. Règles : database.rules.json.
- PRIX : source unique tarifs.json. Après modification : python3 scripts/tarifs.py puis node scripts/verif/tarifs.mjs. Plans PayPal : node scripts/paypal_plans.mjs --tarifs.
- Paiement : PayPal Subscriptions (abonnements) et Orders (programmes, coaching), webhooks traités dans cloudflare/src/paypal.js.
- Style : identifiants en français, constantes en MAJUSCULES gelées (Object.freeze), fonctions PURE typées JSDoc et testées dans app/tests.js, tsc --checkJs doit passer (npx -y -p typescript@5.9 tsc -p tsconfig.json).
- ⚠ Un test interdit tout service d'e-mail ou de SMS DANS L'APP : toute synchronisation e-mail (Systeme.io) passe par le worker, jamais par le client.
- « Aucune valeur inventée », aucune promesse de résultat, conformité : résiliation en 3 clics (L215-1-1), mention « collaboration commerciale », RGPD (données de cycle = sensibles).
- Avant de coder : lis les modules cités, résume ce qui existe, réutilise. Termine par : tests, tsc OK, captures des écrans touchés, liste de ce que tu n'as pas fait et de ce que Kevin doit faire à la main."""

# qui : 'claude' = Claude le fait seul · 'duo' = Claude + toi (une action de ta part) · 'toi'
APP = [
dict(id='A1', titre='Un seul prix, partout', qui='claude', effort='S', gain='★★★',
 idee="""L'audit a trouvé 11 contradictions : Google lit Essentielle à 9,95 € (JSON-LD de la landing) au lieu de 9,50 € ; la page /i dit « sans engagement » alors que les CGV disent 12 mois ; l'invité a 1 mois sur la landing et 2 mois dans le code ; le parrain est payé « au premier paiement » selon la landing, à 4 séances selon le code ; l'écran de fin d'essai affiche « 24,90 € en annuel ou 24,90 € au mois » ; la commission ambassadeur vaut 20-25 % dans le code et 30 % dans le plan.""",
 pourquoi="""Un prix qui change d'une page à l'autre, c'est le premier signal de méfiance, et une pratique commerciale trompeuse en droit. C'est aussi la correction la plus rapide du document.""",
 prompt="""OBJECTIF : zéro contradiction de prix, de durée ou de condition entre tarifs.json, la landing (y compris JSON-LD), /i, /c, l'app, les CGV et les docs.

1. Lis tarifs.json, scripts/tarifs.py, scripts/tarifs.mjs, scripts/verif/tarifs.mjs. Liste les clés couvertes et celles qui ne le sont pas.
2. Étends la recopie automatique aux endroits non couverts : JSON-LD de index.html (offers.price), FAQ de la landing (durée d'essai de l'invité, moment de récompense du parrain), i/index.html (mention d'engagement), écran de fin d'essai et bandeau annuel dans app/index.html et rc-core (« 24,90 € en annuel ou 24,90 € au mois »). Tout texte chiffré passe par data-tarif / data-nb.
3. Ajoute à scripts/verif/tarifs.mjs un contrôle qui ÉCHOUE si un montant en euros présent dans index.html, i/, c/, app/index.html, terms.html, legal.html ne correspond à aucune valeur de tarifs.json (liste blanche explicite pour les exemples).
4. Supprime les commentaires périmés (9,95 / 99 / 249) dans rc-core et scripts/paypal_plans.mjs ; mets à jour NOTE-DECISION-MODELE-ECONOMIQUE.md.
5. N'invente AUCUNE nouvelle valeur : là où deux sources se contredisent sans décision (commission 20/25 % vs 30 %, essai invité 1 ou 2 mois, récompense parrain), écris la liste dans DECISIONS-A-PRENDRE.md avec les deux options et arrête-toi pour ces points.
6. Corrige legal.html (hébergeur : Firebase Hosting, Google Ireland) et la mention identique des CGV.
7. Tests : verif/tarifs passe, tests.js passe ; donne le diff des textes visibles avant/après."""),

dict(id='A2', titre='Mensuel sans engagement, annuel qui récompense', qui='duo', effort='S', gain='★★★',
 idee="""Aujourd'hui le mensuel engage 12 mois, mais l'engagement n'est pas exigible (une annulation PayPal coupe sans recouvrement) et l'annuel coûte exactement 12 mois, sans remise. On passe à : <b>mensuel résiliable à tout moment</b> et <b>annuel = 10 mois payés</b> (Essentielle 95 €, Ultime 249 €). L'écran d'abonnement ouvre sur le mensuel, avec l'annuel mis en avant comme « 2 mois offerts ».""",
 pourquoi="""« Engagement 12 mois » fait fuir le trafic froid qui arrive d'Instagram, sans rien protéger. Un vrai annuel remisé fait encaisser d'avance et coupe la résiliation pendant un an.""",
 prompt="""OBJECTIF : supprimer l'engagement de 12 mois pour les NOUVEAUX abonnés et créer un annuel remisé, sans casser les abonnements existants.

1. Lis tarifs.json (engagementMois, essentielle.an, ultime.an), les écrans d'abonnement (app/index.html, recherche « engagement »), engagementJusqu dans rc-core, cloudflare/src/paypal.js, scripts/paypal_plans.mjs, terms.html §5.
2. tarifs.json : engagementMois:0, essentielle.an:95, ultime.an:249 (à confirmer par Kevin dans DECISIONS-A-PRENDRE.md avant de publier). Lance scripts/tarifs.py et verif/tarifs.mjs.
3. Plans PayPal : prépare la commande scripts/paypal_plans.mjs --tarifs pour créer les plans annuels aux nouveaux montants ; NE PAS l'exécuter : écris dans le compte rendu la commande exacte à lancer par Kevin et où récupérer les nouveaux identifiants. Le worker doit accepter anciens ET nouveaux montants pendant la transition.
4. Abonnés existants : rien ne change pour eux (on garde engagementJusqu si présent) ; le texte « sans engagement » ne s'affiche que pour les nouveaux.
5. Écran d'abonnement : onglet par défaut = « Chaque mois » dans l'app comme sur la landing ; carte annuelle avec « 2 mois offerts » calculé depuis tarifs.json (jamais écrit en dur).
6. CGV : réécris le §5 (durée, résiliation, renouvellement) ; garde la résiliation en 3 clics.
7. Tests : calcul de la remise, affichage selon ancien/nouvel abonné, verif/tarifs OK."""),

dict(id='A3', titre='La boutique ne cannibalise plus l’abonnement', qui='claude', effort='S', gain='★★★',
 idee="""Le programme « Fondations » à 14,90 € ouvre 3 mois d'Ultime : c'est Ultime à 4,97 € par mois, le chemin le moins cher de toute l'app. On change la règle : <b>un programme acheté reste à toi à vie</b> et ouvre <b>30 jours d'app</b> ; ensuite il reste lisible avec Essentielle. Et on remplit les 4 emplacements vides (masse, sèche, force, reprise) avec le catalogue de la partie 3.""",
 pourquoi="""Sans ça, chaque programme vendu fait perdre un abonnement Ultime. Avec ça, la boutique devient une porte d'entrée vers l'abonnement au lieu d'un raccourci pour l'éviter.""",
 prompt="""OBJECTIF : un programme boutique = accès au programme à vie + 30 jours d'app, puis lecture du programme incluse dans Essentielle.

1. Lis le catalogue boutique dans rc-core (Fondations, aCompleter), tarifs.json (coaching.boutique_prog), cloudflare/src/paypal.js (achat programme, contrôle prixCts).
2. tarifs.json : boutique_prog.mois → 1 (30 jours) ; ajoute boutique_prog.acces:'vie'.
3. Modèle : /users/{uid}/programmesAchetes/{slug} = {date, prixCts, source} ; l'accès au contenu du programme ne dépend plus de l'abonnement ; les fonctions Ultime, si.
4. Le webhook PayPal accorde 30 jours (pas 3 mois) à partir de l'achat et enregistre l'achat à vie. Les achats déjà faits gardent leurs droits.
5. Prépare la structure des 4 programmes vides avec les fiches du catalogue que Kevin remplira (nom, promesse, durée, séances) : ne crée AUCUN contenu d'entraînement inventé, seulement les emplacements et les textes de vente fournis.
6. Tests : achat → 30 jours, fin des 30 jours → programme lisible, abonnement Ultime → tout ouvert."""),

dict(id='A4', titre='Le compte coach gratuit, vraiment limité', qui='claude', effort='S', gain='★★',
 idee="""Le palier coach « Libre » (0 €) ne bloque jamais : n'importe qui peut ouvrir un compte coach et donner jusqu'à 12 mois d'app gratuite à des dizaines d'athlètes. On met de vraies limites : <b>Libre = 1 athlète, codes de 1 mois</b> ; Coach (19 €) = 15 athlètes, codes jusqu'à 6 mois ; Pro (39 €) = illimité, 12 mois.""",
 pourquoi="""C'est une fuite directe : chaque athlète « offert » par un faux coach est un abonné perdu. La limite pousse aussi les vrais coachs vers le palier payant.""",
 prompt="""OBJECTIF : appliquer réellement les quotas des paliers coach.

1. Lis tarifs.json (coach), la gestion des quotas coach dans rc-core (alerte de dépassement, proposition de palier) et la création des codes coach (durée maximale 12 mois).
2. Constante gelée QUOTAS_COACH = {libre:{athletes:1, moisCode:1}, coach:{athletes:15, moisCode:6}, pro:{athletes:Infinity, moisCode:12}} dans tarifs.json (recopiée par scripts/tarifs.py).
3. Fonction PURE peutRattacher(palier, nbActifs) et dureeCodeMax(palier). Au-delà du quota : le rattachement est refusé avec un écran clair « passe au palier Coach » (bouton d'abonnement), au lieu d'une simple alerte.
4. Les athlètes déjà rattachés au-delà du quota gardent leur accès jusqu'à la fin de leur code (aucune coupure rétroactive) ; prévenir le coach.
5. Règles RTDB : empêcher côté serveur (database.rules.json ou worker) la création d'un code au-delà de la durée du palier.
6. Tests : chaque palier, dépassement, codes existants."""),

dict(id='A5', titre='Payer par carte, sans compte PayPal', qui='duo', effort='S', gain='★★★',
 idee="""Le bouton « carte bancaire sans compte PayPal » existe dans le code, mais il ne s'affiche que si le compte PayPal Business l'autorise. À faire ensemble : tu actives deux réglages dans PayPal (5 minutes), Claude vérifie le parcours sur iPhone et Android, et ajoute un test automatique qui alerte si le bouton carte disparaît.""",
 pourquoi="""Une bonne partie des 18-30 ans n'a pas ou n'utilise pas PayPal. Chaque personne qui ne voit que « PayPal » au moment de payer est une vente perdue au dernier mètre.""",
 prompt="""OBJECTIF : garantir que le paiement par carte sans compte PayPal fonctionne et le rester.

PARTIE KEVIN (je te guide pas à pas, réponds « fait » à chaque étape) :
a) paypal.com → Paramètres du compte → Paiements sur le site web → « Compte PayPal facultatif » = Activé.
b) Vérifie que le compte est bien Business, vérifié, avec le compte bancaire confirmé.
c) Fais un achat test à 1 € avec une carte (je te prépare un plan de test à 1 € à supprimer ensuite).

PARTIE CLAUDE :
1. Lis le chargement du SDK PayPal dans rc-core (enable-funding=card) et le second bouton « Payer par carte ».
2. Vérifie avec Playwright (Chromium, profils iPhone 13 et Pixel 7) que le bouton carte est rendu ; capture d'écran du parcours jusqu'au formulaire carte (sans payer).
3. Si le SDK ne rend pas le bouton carte : affiche un message clair et un lien de secours (page de paiement PayPal hébergée) au lieu d'un écran vide.
4. Ajoute un contrôle hebdomadaire (workflow GitHub ou cron du worker) qui charge la page de paiement et alerte Kevin si le bouton carte n'apparaît plus.
5. Compte rendu : captures, résultat du test, ce qui reste à faire chez PayPal."""),

dict(id='A6', titre='Firebase prêt pour le pic viral', qui='duo', effort='S', gain='★★',
 idee="""Le plan gratuit Spark a une limite dure : <b>100 connexions simultanées</b> sur la base. Un Reel qui part, et la 101e personne ne voit plus rien. Décision : rester sur Spark (c'est ta règle), mais préparer la bascule : compte Blaze configuré <b>avec alerte budget à 1 €</b> et plafond, prêt à activer en 2 minutes, et l'app qui affiche « forte affluence, réessaie dans une minute » au lieu de planter.""",
 pourquoi="""La pire chose qui puisse arriver, c'est un pic de visites sur une app qui ne charge pas : la viralité se transforme en mauvaise réputation. Le quota gratuit de Blaze est le même que Spark : tant que tu restes dessous, ça coûte 0 €.""",
 prompt="""OBJECTIF : survivre à un pic sans payer tant qu'il n'a pas lieu.

PARTIE KEVIN (pas à pas) :
a) console.firebase.google.com → projet repcore-sync → Utilisation et facturation : relève les pics de connexions simultanées des 30 derniers jours (je t'explique où).
b) console.cloud.google.com/billing : crée un compte de facturation SANS l'associer au projet, puis un budget à 1 € avec alertes à 50/90/100 % sur ton e-mail. (Associer au projet = activer Blaze : on ne le fait que le jour où l'alerte de connexions sonne.)

PARTIE CLAUDE :
1. Lis l'objet CLOUD (connexions, écouteurs temps réel) dans rc-core : liste chaque écouteur permanent et estime les connexions par utilisateur actif.
2. Réduis les connexions inutiles : écouteurs fermés quand l'écran n'est pas visible, lectures ponctuelles (GET REST) au lieu d'écouteurs pour ce qui ne bouge pas.
3. Dégradation propre : si la base refuse la connexion (limite atteinte), écran « forte affluence » avec réessai automatique, et la séance en cours continue hors ligne (le cache local existe).
4. Le worker vérifie chaque minute le nombre d'utilisateurs actifs (/stats) et envoie une alerte push/e-mail à Kevin à 70 connexions simultanées estimées.
5. Écris docs/BASCULE-BLAZE.md : les 5 clics pour activer Blaze le jour J et revenir en arrière.
6. Tests : simulation de refus de connexion, reprise."""),

dict(id='A7', titre='La fiche Google Play', qui='duo', effort='M', gain='★★★',
 idee="""L'app Android existe déjà (TWA générée par Bubblewrap, com.repcore.app, assetlinks en place) mais elle n'est distribuée qu'en APK sur GitHub. Publier sur Google Play coûte 25 $ une fois et donne la recherche Play Store, la confiance d'une vraie fiche et les avis. Point de vigilance : Google impose ses règles de facturation pour les abonnements vendus dans une app.""",
 pourquoi="""« Télécharger un APK » fait peur à 90 % des gens. Une fiche Play avec des avis lève le doute, et c'est la seule dépense du lancement.""",
 prompt="""OBJECTIF : publier RepCore sur Google Play, conforme aux règles de facturation.

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
5. Compte rendu : fichiers prêts dans docs/play/, check-list de soumission."""),

dict(id='A8', titre='La fin d’essai qui donne envie de rester', qui='claude', effort='M', gain='★★★',
 idee="""Aujourd'hui la fin d'essai, c'est un bandeau et un écran. Aucun push à J-3 ou J-1, aucun e-mail. On ajoute : pushes <b>J-3, J-1 et J0</b>, un écran <b>« Ce que tu as construit en 30 jours »</b> (séances, kilos soulevés, records, régularité, ton avatar) et une offre claire : mensuel, annuel 2 mois offerts, ou programme.""",
 pourquoi="""La fin d'essai est LE moment où l'argent rentre ou ne rentre jamais. Montrer ce qu'on perd en partant convertit bien mieux qu'un rappel de prix.""",
 prompt="""OBJECTIF : transformer la fin d'essai en moment de conversion.

1. Lis s-essai-bilan, le bandeau d'essai (J1, J-9, J-3), cloudflare/src/metier.js (job acces, pushes), planif.js, retention.js (entonnoir finEssai → payant).
2. Worker : pushes de fin d'essai à J-3, J-1 et J0 (heure locale 18 h 30), uniquement aux abonnés aux notifications, messages personnalisés avec un chiffre réel (« 12 séances, 3 records : on continue ? »). Jamais de chiffre inventé : sans séance, un autre message.
3. Écran s-essai-bilan refait : 4 chiffres (séances, tonnage, records, semaines tenues), avatar de progression, 3 offres (mensuel, annuel avec 2 mois offerts, programme boutique), lien coaching.
4. Fonction PURE resumeEssai(sessions, records) testée.
5. Si e-mail opt-in (fiche A11) : le worker ajoute le tag « fin_essai » dans Systeme.io à J-3 pour déclencher la séquence e-mail.
6. Mesure : événements trial_end_viewed / trial_end_offer_clicked dans metrics/<jour>.
7. Tests : essai sans séance, avec séances, déjà payant."""),

dict(id='A9', titre='Relancer ceux qui n’ont jamais commencé', qui='claude', effort='S', gain='★★★',
 idee="""Les relances partent 7, 14 et 30 jours après la <b>dernière séance</b> : celui qui s'inscrit et ne fait jamais de séance n'est jamais relancé. C'est pourtant le plus gros trou de l'entonnoir. On ajoute J+1 (« ta première séance t'attend, 25 minutes »), J+3 (« la séance la plus simple pour démarrer ») et J+6 (« besoin d'aide ? réponds-moi »).""",
 pourquoi="""Un inscrit qui fait sa première séance a plusieurs fois plus de chances de payer. Ces 3 pushes ne coûtent rien et touchent les gens au moment où ils ont encore envie.""",
 prompt="""OBJECTIF : relancer les inscrits sans première séance.

1. Lis cloudflare/src/retour.js et metier.js (relances après dernière séance), le parcours « Mise sous tension » et l'entonnoir de retention.js.
2. Ajoute dans le worker un job « jamais_commence » : inscrits depuis 1, 3 et 6 jours, 0 séance, abonnés aux notifications → push personnalisé (prénom, programme du jour). Un seul push par jour et par personne, tous types confondus (respect du plafond existant).
3. Le push ouvre directement la séance du jour (lien profond).
4. Mesure : taux de 1re séance après chaque push (attribution par levier dans retention.js).
5. Tests : sélection des cibles, plafond, désinscription."""),

dict(id='A10', titre='La pause au lieu du départ', qui='claude', effort='M', gain='★★★',
 idee="""La résiliation se fait en 3 clics, et ça doit rester (c'est la loi). Mais on peut proposer, <b>à côté</b>, sans rien bloquer : « mettre en pause 1 mois » et « passer à Essentielle » pour un abonné Ultime. Et 30 jours après un départ, un message de retour avec ce qu'il a construit.""",
 pourquoi="""Une bonne partie des résiliations viennent d'une pause de vie (vacances, blessure, examens), pas d'un rejet de l'app. Chaque abonné gardé vaut environ 250 € de chiffre sur sa durée de vie.""",
 prompt="""OBJECTIF : des alternatives à la résiliation, conformes à L215-1-1 (résiliation en 3 clics maximum, sans obstacle).

1. Lis le parcours Réglages → Résilier dans rc-core (motif facultatif) et la décision L215-1-1 commentée dans le code. Ne la contourne pas.
2. Sur l'écran de confirmation, AU MÊME NIVEAU que le bouton « Résilier » (pas avant, pas en plus d'étapes) : « Mettre en pause 1 mois » (suspension PayPal de l'abonnement via l'API, reprise automatique) et « Passer à Essentielle » (si Ultime). Le bouton Résilier reste le premier et le plus visible.
3. Worker : suspension/reprise PayPal (subscriptions/{id}/suspend et activate), journal dans paypal_journal.
4. Retour J+30 : push et (si opt-in) tag Systeme.io « reconquete » avec un résumé réel de son historique et l'offre du moment.
5. Analyse : chaque motif de résiliation est compté par mois dans /stats pour le rapport du lundi.
6. Tests : 3 clics comptés, pause et reprise, motif enregistré."""),

dict(id='A11', titre='Récupérer l’e-mail (et l’envoyer dans Systeme.io)', qui='duo', effort='M', gain='★★★',
 idee="""Aujourd'hui aucune adresse e-mail n'est collectée pour le marketing : chaque inscrit qui n'active pas les notifications est perdu pour toujours. On ajoute une case <b>« recevoir les conseils de Kevin par e-mail »</b> (opt-in, décochée) à l'inscription et un formulaire « guide offert » sur la landing. Le worker envoie le contact dans Systeme.io avec sa source.""",
 pourquoi="""Tu passes de 1 200 à 2 000 contacts sans effort supplémentaire, et chaque essai a une seconde chance par e-mail. C'est le canal que tu possèdes : ni Instagram ni Google ne peuvent te le couper.""",
 prompt="""OBJECTIF : opt-in e-mail à l'inscription + formulaire lead magnet sur la landing, synchronisés avec Systeme.io par le worker.

PARTIE KEVIN : systeme.io → Paramètres du profil → Clé API publique : crée une clé, puis `npx wrangler secret put SYSTEMEIO_API_KEY` dans cloudflare/ (je te guide). Indique-moi le nom du tag unique utilisé sur le plan gratuit (ex. « repcore »).

PARTIE CLAUDE :
1. Lis l'inscription (register_completed), la page landing index.html, cloudflare/src/index.js (routes) et la doc https://developer.systeme.io/reference/api (création de contact, tags).
2. App : case opt-in décochée à l'inscription (« Reçois mes conseils et les nouveautés par e-mail »), consentement horodaté dans /users/{uid}/consentements/email.
3. Landing : bloc « Le guide offert : muscu et cycle menstruel, phase par phase » → formulaire prénom + e-mail → route du worker /lead (anti-spam : champ piège + limite par IP).
4. Worker : file d'envoi vers Systeme.io (POST contact + tag), 30 requêtes/minute max, reprise sur erreur, jamais d'e-mail envoyé par le worker lui-même. Champs perso : source (?src), date, statut (essai/payant).
5. Respect du test qui interdit l'e-mail dans l'app : rien de tout ça côté client, sauf la case.
6. Désinscription : un lien Systeme.io suffit ; la suppression de compte dans l'app supprime aussi le contact (API DELETE).
7. Tests : consentement absent → aucune synchro ; limite de débit ; erreurs API."""),

dict(id='A12', titre='MyProtein dans l’app', qui='duo', effort='S', gain='★★',
 idee="""Le seul endroit où MyProtein apparaît aujourd'hui, c'est une liste de pré-workouts, sans lien ni code. On prépare des emplacements propres, activables dès que tu as l'accord écrit : <b>carte partenaire dans l'écran Compléments</b>, code promo copiable, lien suivi, <b>défi du mois « présenté par MyProtein »</b>, et mention « lien partenaire ».""",
 pourquoi="""C'est un revenu sans stock et sans service client, et un partenaire connu rassure les gens qui doutent d'une nouvelle app. On prépare tout maintenant, on allume quand le contrat est signé.""",
 prompt="""OBJECTIF : des emplacements partenaire génériques, pilotés par la base, prêts pour MyProtein.

1. Lis les écrans s-supplements et s-supplement-edit, la carte de défi, la fin de Wrapped.
2. Nœud /partenaires/{cle} = {actif:false, nom, logo, code, lien, mention, emplacements:['complements','defi','wrapped'], debut, fin} ; règles RTDB : lecture publique, écriture admin.
3. Composant renderCartePartenaire(p, emplacement) : logo, une phrase, code copiable en un tap, lien avec ?utm_source=repcore&utm_medium=app&utm_campaign=<emplacement>, mention « lien partenaire » visible.
4. Rien ne s'affiche tant que actif=false. Pas de partenaire dans les écrans de séance (on ne pollue pas l'entraînement).
5. Compteurs : vues et clics par emplacement dans metrics/<jour>, lus par le rapport du lundi.
6. Tests : partenaire inactif, dates, plusieurs emplacements."""),

dict(id='A13', titre='Le coaching vendu dans l’app', qui='claude', effort='M', gain='★★★',
 idee="""Ton offre la plus rentable (coaching avec suivi 150 à 600 €, création de programme sans suivi 99 €) est vendue hors de l'app, via beacons.ai : aucune mesure, aucun lien avec l'ambassadeur qui a amené la personne. On la vend <b>dans l'app</b> avec PayPal (le paiement Orders existe déjà), avec deux familles bien distinctes : <b>« Je te suis »</b> et <b>« Je te crée ton programme »</b>, et l'écran « Passer au coaching » après 3 mois d'abonnement.""",
 pourquoi="""Un coaching vendu = le chiffre de 15 à 60 abonnements. Le vendre là où les gens sont déjà (l'app) et savoir d'où viennent les acheteurs, c'est doubler l'effet de chaque vidéo.""",
 prompt="""OBJECTIF : vendre les 5 formules de coaching de tarifs.json dans l'app, mesurées et attribuées.

1. Lis tarifs.json (coaching.*), les liens beacons.ai dans index.html, app/index.html et rc-core, l'achat de programme (PayPal Orders) et cloudflare/src/paiements-coach.js.
2. Écran s-coaching-kevin : deux familles — « Avec suivi » (Essentiel 150 €, Transformation 350 €, Évolution 600 €) et « Sans suivi » (Programme personnalisé 99 €, Révision 40 €). Pour chacune : ce qui est inclus (texte de tarifs.json), délai de réponse, bouton de paiement.
3. Paiement PayPal Orders (montant contrôlé côté worker contre tarifs.json), puis questionnaire d'entrée (objectif, disponibilités, matériel, blessures, cycle facultatif) et création automatique du lien athlète ↔ coach Kevin.
4. Attribution : la source (?src, code ambassadeur) est enregistrée sur l'achat ; la commission ambassadeur s'applique selon la décision de DECISIONS-A-PRENDRE.md.
5. « Passer au coaching » : carte affichée une fois, après 3 mois d'abonnement actif et au moins 20 séances.
6. Remplace les liens beacons.ai par l'écran (garde beacons comme secours si le paiement échoue).
7. CGV : ajoute la section coaching et programmes (aujourd'hui exclue).
8. Tests : contrôle du montant, attribution, carte « passer au coaching »."""),

dict(id='A14', titre='Mesurer d’où vient chaque euro', qui='claude', effort='S', gain='★★',
 idee="""L'app sait déjà compter (src, ambassadeurs, entonnoir), mais la landing et le blog n'envoient <b>aucun</b> src : le rapport verra « direct » partout. On met un src sur chaque lien (bio Instagram, LinkedIn, newsletter, blog, QR des salles, Play Store), on lit aussi les UTM, et on expose un tableau <b>/stats/ventes</b> lu par le rapport du lundi.""",
 pourquoi="""Sans ça, tu ne sauras jamais si c'est la vidéo, l'influenceuse ou l'e-mail qui a vendu, et tu continueras ce qui ne marche pas.""",
 prompt="""OBJECTIF : attribution complète et un point d'accès de statistiques pour le rapport du lundi.

1. Lis l'attribution (attribution/jours/…, /arrivee, functions/attribution-calcul.js) et retention.js.
2. Landing et blog : tous les CTA portent ?src=<page> (landing_hero, landing_tarifs, blog_<slug>) ; la landing transmet src/ref/utm_* à l'app.
3. L'app lit utm_source/utm_medium/utm_campaign et les range dans src si src est absent.
4. Worker : route GET /stats/ventes?token=… (jeton secret STATS_TOKEN) → JSON des 7 et 28 derniers jours : visites, inscriptions, 1res séances, essais finis, payants, CA par offre, résiliations et motifs, par src et par ambassadeur.
5. Écris docs/LIENS-SUIVIS.md : la liste des liens à utiliser partout (bio, LinkedIn, e-mails, QR) avec leur src.
6. Tests : propagation des paramètres, calcul des agrégats."""),

dict(id='A15', titre='Le parrain récompensé au bon moment', qui='claude', effort='S', gain='★★',
 idee="""Le parrain gagne son mois dès que le filleul fait 4 séances, avant tout paiement : on offre un mois sans rien encaisser, et la landing dit l'inverse. On garde l'esprit (récompense rapide) mais on la verse <b>au premier paiement du filleul</b>, et on affiche le <b>prénom du parrain</b> aussi sur la landing (« Thomas t'offre ton 2e mois »).""",
 pourquoi="""Le parrainage doit rapporter plus qu'il ne coûte. Le prénom d'un ami sur la page d'arrivée, c'est la meilleure preuve sociale qui existe.""",
 prompt="""OBJECTIF : récompense du parrain au premier paiement du filleul, prénom du parrain visible dès la landing.

1. Lis functions/parrainage-calcul.js, cloudflare/src/metier.js (crédit du parrain), i/index.html et la classe body.invite de index.html.
2. Change la condition de crédit : premier paiement confirmé par webhook (et non 4 séances). Garde le mois « mentor » à 10 filleuls PAYANTS.
3. Landing : si ?ref= présent, bandeau « [Prénom] t'offre ton 2e mois » avec l'emblème de son rang (même source que /i).
4. Mets à jour la FAQ et les CGV via tarifs.json (fiche A1).
5. Tests : crédit au paiement, pas de crédit sans paiement, affichage du prénom échappé."""),

dict(id='A16', titre='Le mini-chat qui répond à 2 h du matin', qui='duo', effort='M', gain='★★',
 idee="""Une bulle de discussion sur la landing (et dans l'app avant l'abonnement) qui répond aux vraies questions : « c'est quoi la différence entre Essentielle et Ultime ? », « ça marche pour une débutante ? », « je peux annuler ? ». Elle s'appuie <b>uniquement</b> sur tes pages (tarifs, FAQ, CGV) et propose l'essai ou un message à Kevin. Seul coût : quelques euros d'API par mois, avec un plafond.""",
 pourquoi="""Les gens doutent et n'osent pas te demander. Une réponse immédiate, honnête et sans pression lève le doute au moment exact où il apparaît. Et chaque question posée te dit quoi améliorer.""",
 prompt="""OBJECTIF : un assistant de questions-réponses sur la landing, ancré sur les pages de RepCore, avec plafond de coût.

PARTIE KEVIN : console.anthropic.com → crée une clé API, mets un plafond de dépense mensuel (ex. 10 €), puis `npx wrangler secret put ANTHROPIC_API_KEY` dans cloudflare/ (je te guide).

PARTIE CLAUDE :
1. Lis index.html, tarifs.json, FAQ, terms.html. Construis docs/base-chat.md (connaissances autorisées) générée automatiquement depuis ces fichiers (script dans scripts/), pour qu'elle suive les prix.
2. Worker : route POST /chat → modèle Claude le plus économique disponible, système strict : répondre uniquement à partir de base-chat.md, en français, 80 mots max, jamais de conseil médical, jamais de promesse de résultat, toujours proposer l'essai gratuit ou « écrire à Kevin ». Limites : 10 messages par visiteur et par jour, 300 conversations par jour, coupure si le budget mensuel est atteint.
3. Landing : bulle discrète en bas à droite, chargée à la demande, accessible au clavier.
4. Journal anonymisé des questions (sans e-mail ni IP en clair) → résumé hebdomadaire dans le rapport du lundi : questions fréquentes, réponses manquantes.
5. Tests : refus hors sujet, plafond, réponse quand le modèle est indisponible (renvoi vers la FAQ)."""),

dict(id='A17', titre='Le coach fixe ses prix et devient ambassadeur', qui='claude', effort='M', gain='★★★',
 idee="""Deux corrections sur l'espace coach. 1) La vitrine d'un coach affiche aujourd'hui <b>tes</b> prix : chaque coach doit fixer les siens. 2) On fait de chaque coach un <b>ambassadeur</b> : quand un de ses athlètes passe en abonnement payant à la fin de son coaching, le coach touche la même commission qu'une influenceuse. Il a enfin intérêt à pousser l'app.""",
 pourquoi="""C'est le mécanisme qui transforme 1 coach en 5 à 30 abonnés payants pour toi. Sans intérêt financier, le coach utilise l'app gratuitement et ne la recommande jamais.""",
 prompt="""OBJECTIF : prix libres pour les coachs externes, et commission coach sur les athlètes convertis.

1. Lis c/index.html (formules affichées depuis tarifs.json), cloudflare/src/paiements-coach.js (payee = coach, sans frais), functions/ambassadeurs-calcul.js (commission, J+30), le message de fin de coaching qui renvoie vers Essentielle.
2. Modèle : /coachs/{uid}/formules/{id} = {lib, prixCts, mois, comprend} saisis par le coach (bornes 0-2000 €) ; la vitrine et paiements-coach.js lisent ces prix ; fallback : aucune formule affichée (jamais les prix de Kevin).
3. Commission coach : un athlète rattaché à un coach qui devient abonné payant RepCore dans les 90 jours suivant la fin de son code → le coach est crédité comme un ambassadeur (taux de la décision commune), 12 mois, payé selon le même rapport mensuel.
4. Tableau du coach : « Tes athlètes devenus abonnés : X · ta commission du mois : Y € ».
5. Garde paiements-coach.js fermé (PAIEMENTS_COACH) tant que Kevin n'a pas validé les CGV coach ; écris ce qu'il faut ajouter aux CGV.
6. Tests : prix bornés, commission dans la fenêtre de 90 jours, pas de double commission ambassadeur + coach."""),

dict(id='A18', titre='La salle partenaire et ses QR codes', qui='claude', effort='M', gain='★★',
 idee="""Pour Corona Gym et les suivantes : une <b>page salle</b> dans l'app (logo, machines filmées, défi de la salle), un <b>QR code par machine</b> qui ouvre directement la fiche filmée, et un code salle qui offre 2 mois d'essai. Tout est généré par un script à partir d'une simple liste de machines.""",
 pourquoi="""Chaque membre qui scanne une machine devient un essai, sans pub, tous les jours. Et la salle gagne un service que ses concurrentes n'ont pas.""",
 prompt="""OBJECTIF : « mode salle partenaire » générique, prêt pour Corona Gym.

1. Lis la banque d'exercices (/exercices, scripts/seed_exercices.py, app/exercices/), les codes d'essai (metier.js) et les vitrines coach (c/index.html) pour réutiliser le modèle.
2. Nœud /salles/{slug} = {nom, ville, logo, couleurs, machines:[{slug, nom, exerciceSlug, video}], codeEssai, actif}.
3. Page publique /salle/{slug} (comme /c) : présentation, liste des machines, bouton « 2 mois offerts avec le code de la salle ».
4. Lien de QR par machine : /salle/{slug}/m/{machine}?src=qr_{slug} → fiche filmée ; dans l'app si installée, sinon page publique + essai.
5. Script scripts/qr_salle.mjs : à partir d'un CSV (machine, exercice, vidéo), génère la page, les QR en PNG et un PDF A4 d'étiquettes à coller (logo salle + RepCore).
6. Statistiques par salle (scans, essais, payants) dans /stats/ventes (fiche A14).
7. Tests : génération sur un CSV de 3 machines, page sans vidéo, salle inactive."""),
]

# Le « gel » : seulement ce qui fait vendre ou garder un abonné. € par heure de travail estimé.
GEL = [
 ('A1','Un seul prix partout','2 h','très fort'),('A2','Mensuel sans engagement + annuel −2 mois','3 h','très fort'),
 ('A3','Boutique qui ne cannibalise plus','2 h','fort'),('A9','Relance des jamais-commencés','2 h','très fort'),
 ('A8','Fin d’essai J-3 / J-1 / J0','5 h','très fort'),('A5','Carte sans compte PayPal','1 h + toi 10 min','très fort'),
 ('A14','Mesure des sources','3 h','fort'),('A11','E-mail opt-in → Systeme.io','5 h','fort'),
 ('A13','Coaching vendu dans l’app','8 h','très fort'),('A15','Parrain au premier paiement','2 h','moyen'),
 ('A4','Quotas coach réels','3 h','moyen'),('A10','Pause au lieu du départ','5 h','fort'),
 ('A12','Emplacements MyProtein','3 h','moyen'),('A17','Coach : prix libres + commission','8 h','fort'),
 ('A6','Firebase prêt pour le pic','4 h + toi 10 min','assurance'),('A7','Fiche Google Play','8 h + toi 1 h','fort'),
 ('A18','Salle partenaire + QR','8 h','moyen'),('A16','Mini-chat de vente','6 h + toi 10 min','moyen'),
]
