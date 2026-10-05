# Park Pulse

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
- **Partagé** : renseigner un projet Firebase dans `config.js` et déployer `database.rules.pulse.json`. Seules les adresses
  ajoutées dans Membres peuvent lire et écrire la base.

## Lancer en local

    cd club && python3 -m http.server 8765    # puis http://localhost:8765
