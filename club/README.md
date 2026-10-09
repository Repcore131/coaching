# Fit Pulse

Pilotage commercial de **nos** clubs Fitness Park, sur le modèle de fitup-pro, **sans aucune partie réseau** :
pas de classement inter-enseignes, pas de feed ni de chat partagés avec d'autres clubs, pas d'observateurs.
Seuls les clubs créés ici existent.

Application sans dépendance (HTML, CSS, JavaScript), ouverte à `club/index.html`.

## Pages

| Page | Contenu |
|---|---|
| Tableau de bord | Vue perso / club, mois, mascotte qui suit le rythme, cartes KPI à paliers 25/50/75/100 % (réorganisables), taux de conversion, score pondéré, Bilan du jour, panneau Saisies (KPI + liste de tâches). Analyses : N vs N-1 **à période égale**, progression par objectif, évolution du CA (3M/6M/12M/24M/YTD). |
| Classement | Hebdo / mensuel / trimestriel, global ou par KPI, podium, « Vous êtes #… », all-time score / badges, comparaison **entre nos clubs** seulement. |
| Action Rétention | Tâches générées depuis la base clients : appel de suivi J+15/J+30, renouvellement, anniversaire, impayé. Résultats d'appel, 3 tentatives puis Perdus, Performance, Historique. « Réglé » crédite les impayés récupérés. |
| Résiliations | Saisie ou import, motifs, sauvetages (comptés dans le KPI Sauvetage résiliations), export CSV. |
| Chat | Un canal par club + « Tous nos clubs ». Réponses, réactions, images. |
| Feed | Saisies de l'équipe en direct, réactions 🔥 💪 👏. Nos clubs uniquement. |
| Défis flash | 6 à 72 h sur un KPI, classement rapporté à l'objectif de chacun, historique, trophées. |
| Imports CSV | Assistant 3 étapes (document, matching des colonnes et des vendeurs, validation), exports Resamania reconnus, **doublons détectés**, historique avec annulation / rétablissement et détail ligne par ligne, saisie manuelle mensuelle (contrôle d'inversion de colonnes). |
| Membres | Organigramme, historique des saisies (mois / jour par jour, éditable), planning de tâches, objectifs (total = membres actifs seulement), récaps, archivés. |
| Mes clubs | Nos clubs, base adhérents (base nette, contrats à signer), réglages des KPI et des points, sauvegarde / restauration. |
| Profil / Bilan mensuel | Niveaux Rookie → Légende, accomplissements, trophées (même décompte que le classement), bilan mensuel en stories avec carte téléchargeable. |

Les règles de calcul (score, paliers, rythme, égalités) sont écrites en tête de `calc.js` et affichées dans l'app.

## Liaison Resamania

Imports > **Resamania** : déposez plusieurs exports d'un coup (CSV des listes, ZIP des exports de gestion sans les
décompresser, XLSX). Chaque fichier est reconnu par ses colonnes (`resamania.js`, d'après l'audit du 05/10/2026) :

| Export Resamania | Alimente |
|---|---|
| Vente d'abonnements (gestion) | Contrats signés (commercial initial), nouveaux adhérents J+15/J+30 |
| Factures & avoirs, DetailLignes (gestion, ZIP) | Nutrition, accessoires (FPARK / NO_FPARK), Contrat B2B (société du client), avoirs déduits |
| Lignes de factures / d'avoirs (listes) | Nutrition, accessoires |
| Incidents (liste) | **Impayés récupérés par canal** (équipe, client en ligne, prélèvement automatique, automatismes, tiers) + impayés en cours |
| Clients en incident (gestion) | Impayés en cours, photo du jour |
| Clients abonnés sans prélèvement (gestion) | Tâche de relance « Sans mandat » |
| Clients club, Abonnements (listes) | Anniversaires, fins de contrat |
| Prospects, Résiliations | Prospects par commercial, résiliations et sauvetages (motifs techniques écartés) |
| Taux de transformation, performances commerciales, transactions Web, Paiements, Évolution clients | Contrôles et taux de transformation |

- **Pas de doublon** : chaque ligne reçoit une clé stable ; réimporter un fichier, ou deux exports qui se recouvrent
  (ZIP de gestion + liste), met à jour au lieu d'ajouter.
- **Annuaire des commerciaux** (Membres > Correspondances Resamania) : codes trigrammes, e-mails, id, « NOM Prénom »
  dans n'importe quel ordre. Un nom inconnu est demandé une fois, puis retenu. Les pseudo-vendeurs (Traitement
  automatique, Site web, PSO Site, En ligne…) ne sont jamais attribués à un commercial.
- **Contrôles** : liste à exactement 2 000 lignes (tronquée), encodage ISO-8859-15 corrigé, contrats Fit Pulse vs
  performances commerciales, client en ligne vs transactions Web.
- **Routines** : 7 exports chaque lundi, 10 le 2 du mois, avec chemin, filtres et nom de fichier, cochés à l'import.
- Page **Impayés** : total récupéré tous canaux, part de l'équipe (seule comptée pour le KPI et la prime), 6 mois.

ZIP et XLSX sont lus avec JSZip et SheetJS, chargés depuis cdnjs à la première utilisation.

## Accès

| Rôle | Peut faire |
|---|---|
| Créateur | Tout : nos clubs, KPI et points, nommer managers et créateurs, sauvegarde, remise à zéro. Voit tous les clubs, n'est ni classé ni objectivé. |
| Manager | Ses clubs : équipe (membres), objectifs, imports, tâches, défis flash, codes d'accès des membres. |
| Membre | Ses saisies, son tableau de bord, classement, rétention, résiliations, chat, feed. |

Connexion par **e-mail + code personnel** (`FP-XXXX-XXXX-XXXX`). Une même adresse peut porter un accès Créateur et un accès
Manager : c'est le code qui choisit le compte. Les comptes de départ sont déclarés dans `config.js` avec l'empreinte
(SHA-256 salée) de leur code, jamais le code lui-même. Un code n'est affiché qu'une fois, à sa création ; on en régénère
un depuis Membres (créateur, manager pour ses membres) ou Mon profil > Sécurité.

## Deux modes

- **Local** (par défaut) : les données restent dans le navigateur. Idéal pour essayer (bouton « données de démonstration »).
- **Démonstration** (`?demo=1` ou bouton « Voir la démo » de la connexion) : à montrer à un prospect. Jeu fictif
  généré par `seedDemo()` (`demo.js`) : « Club Démo Centre », 6 commerciaux, 3 mois d'historique, 40 relances,
  12 impayés, 8 résiliations en cours, 2 défis. Ouvert sans connexion, aucun appel Firebase, tout le stockage du
  navigateur passe par la seule clé `fp_demo`, ni logo ni nom de l'enseigne, bandeau « Données fictives de
  démonstration » avec « Quitter la démo ». Recharger la page reste en démonstration.
- **Partagé** (site en ligne) : base Firebase repcore-sync, nœud `/pulse`. Connexion e-mail + code depuis n'importe quel appareil : la clé SHA-256(e-mail|code) ouvre `/pulse_boot`, règles posées par `outils/fitpulse-serveur.mjs` (lancé à chaque mise en ligne et par `fitpulse-mail.yml`).

## Demandes de résiliation reçues par e-mail

Chaque heure, le serveur (`outils/fitpulse-resmail.mjs`, lancé par `fitpulse-mail.yml`, ou la fonction
`club/cloud` au forfait Blaze) lit la boîte Gmail de l'accueil par l'API Gmail. Les messages des 30 derniers jours
qui parlent de résiliation, ou qui viennent de l'appli adhérents, deviennent `/pulse/resRequests/{club}/{fil}`
(clé = fil Gmail : jamais de doublon). Page Résiliations, bloc « Demandes reçues » : Ouvrir le mail, Je m'en occupe,
Contacté, Sauvé, Résilier (crée le dossier), Hors sujet. Pastille rouge sans réponse de l'accueil depuis 48 h.

Réglages : Résiliations > Demandes reçues > Réglages (boîte relevée, expéditeurs de l'appli). Secrets côté serveur
uniquement : `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_TOKENS` (`{"niort":"<refresh token>"}`), jeton OAuth
du compte accueil avec la portée `gmail.readonly`. Extrait de 200 caractères, purgé 90 jours après traitement.

## Mettre en ligne (vraie adresse)

Fit Pulse a son propre projet Firebase, séparé de RepCore. Depuis Google Cloud Shell :

    firebase login --no-localhost          # première fois seulement, commande seule
    bash club/mettre-en-ligne.sh fitpulse-niort

→ `https://fitpulse-niort.web.app` (gratuit). Si le nom est pris, en choisir un autre (`fitpulse-niort-79`…).
Sur téléphone : ouvrir l'adresse puis « Ajouter à l'écran d'accueil » : l'app s'installe avec son icône.
Un nom de domaine à soi (ex. `fitpulse.fr`) s'achète chez un registraire (≈ 10 €/an) puis se relie dans
Firebase > Hosting > Ajouter un domaine personnalisé.

## Lancer en local

    cd club && python3 -m http.server 8765    # puis http://localhost:8765
