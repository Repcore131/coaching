# Lot Confiance : compte rendu

Version 2026.10.8. Points 3, 4, 6 et 7 du lot G (impayés et rétention), un commit par point.

## Lancer le test

- Navigateur : ouvrir l'appli, se connecter, coller le contenu de `club/outils/test-confiance.js` dans la console. Une ligne `OK` ou `KO` par critère, puis le total. Le script travaille sur un club de test en mémoire, n'écrit rien en base et remet l'état d'origine à la fin.
- Sans navigateur : `TZ=Europe/Paris node --test club/tests/confiance.test.mjs` (même script, vérifie en plus que l'état est intact et qu'aucune écriture n'est partie).
- Tests détaillés du lot : `TZ=Europe/Paris node --test club/tests/lotg.test.mjs`.

Résultat au moment du commit : 22 critères sur 22 en `OK`, dans Node et dans Chromium sur la démo.

## Point 3 : un seul « Payé », un seul crédit (commit 79a21c0)

| Fichier | Lignes | Changement |
| --- | --- | --- |
| `club/pages-ops.js` | 468 à 489 | `dnId` puis `markPaid(c, amount, opts)` : la seule fonction qui enregistre un impayé récupéré ; crédit à `dunning.ownerId`, sinon à l'auteur ; dossier soldé : aucune seconde saisie. `markPaidOps` devient un alias. |
| `club/pages-ops.js` | 455 | Modale « Réglé » de la page Impayés : passe par `markPaid`. |
| `club/relances.js` | 374 | Issue « Payé » d'une relance : passe par `markPaid`. |
| `club/pages-data.js` | 313 et suivantes | `loyAct` : un impayé ouvre la feuille du dossier (`dunSheet`), plus d'enregistrement direct. |
| `club/pages-home.js` | 101 à 110 | `QUICK_EUR` sans Impayés. |
| `club/pages-main.js` | 388, 403 à 410 | Saisie détaillée : client obligatoire pour un impayé (`saisieClientImpaye`, `saisieClientTrouve`), enregistrement par `markPaid`. |
| `club/impayes.js` | 1 à 40 | Membres > Contrôles : `ctlImpayes`, `memControles`, `ctlFusion` (fusion avec l'import, tracée dans l'audit), rattachement d'un client. |
| `club/pages-team.js` | 11 | Onglet Contrôles dans Membres. |

## Point 4 : acomptes (commits e888b09 et 21a7df9)

| Fichier | Lignes | Changement |
| --- | --- | --- |
| `club/pages-ops.js` | 291 | Statut `partiel` : « Acompte reçu ». |
| `club/pages-ops.js` | 468 à 489 | Montant inférieur au solde : solde réduit, `paid` cumulé, ligne d'historique « Acompte 50,00 €, reste 70,00 € » ; identifiant `dn_<client>_<date>_<n>` pour deux acomptes le même jour. |
| `club/pages-ops.js` | 363 et suivantes | Badge « Acompte reçu » dans la liste. |
| `club/core.js` | `fmtEc` | Montant au centime pour l'historique. |
| `club/impayes.js` | 110 à 111 | Feuille du dossier : « Payé » et « Acompte » avec le reste dû dans le message. |

## Point 6 : un dossier, une histoire (commit 76728e7)

| Fichier | Lignes | Changement |
| --- | --- | --- |
| `club/impayes.js` | 42 à 116 | Issues `DUN_OUTCOMES` (sans « Joint, OK » ni « RDV »), `dunHist`, `dunSheet` (même feuille depuis l'accueil, Rétention, Relances et Impayés), `dunIssueOps` (historique, statut, prochaine relance). |
| `club/impayes.js` | 117 à 135 | Tiroir d'historique `dunHistOpen` ; `migrerLoyaltyImpayes` : anciennes actions Rétention de type impayé recopiées une fois dans `dunning.history`, drapeau `migratedLoyalty`, rejouable sans effet. |
| `club/app.js` | 36 | Migration lancée après la connexion. |
| `club/calc.js` | 501 et suivantes | `loyaltyTasks` lit les impayés dans le dossier (`dunning`), perdu seulement si le dossier l'est. |
| `club/relances.js` | `relSheet` | Une relance impayé ouvre la feuille du dossier. |

## Point 7 : cadences, 4 h, Perdus (commit b5dfeb7)

| Fichier | Lignes | Changement |
| --- | --- | --- |
| `club/calc.js` | 461 et suivantes | Types `suivi15` et `suivi30` (ancien `suivi` reconnu) ; issues « SMS programmé », « À rappeler », « Insatisfait », « Envoyé ». |
| `club/calc.js` | 501 et suivantes | Tentatives comptées par `tentativesComptees` (4 h d'écart ou autre jour), plus de passage automatique en Perdus, drapeau `aConfirmer` à 3 tentatives. |
| `club/impayes.js` | 47 à 58 | `tentativesComptees`, `tentativeRecente`, `dejaTente` (« Déjà tenté à 10 h 12 »). |
| `club/pages-data.js` | 313 à 345 | `loyAct` : refus avant 4 h, cadence de la prochaine action ; `loyPerdre` : fenêtre de confirmation (3 tentatives, « Programmer un SMS », « Classer perdu »), `loyPerdreOk`. |
| `club/pages-data.js` | 370 à 390 | `loyPerf` et `suivisRealises` : J+15 et J+30 réalisés comptés dans Résultats. |

## Total « Impayés récupérés »

Un seul calcul (`recoveredFor`, `club/calc.js` 89 à 107) pour l'accueil, la page Impayés, le classement (`ranking`, KPI impayes) et le récapitulatif (`monthFigures().impayesEquipe`). Le script compare les quatre valeurs à la somme des saisies du mois : identiques.

## Données existantes

Aucune donnée supprimée. Les migrations sont idempotentes et marquées : `dunning.migratedLoyalty` (actions impayé), `firstIncidentAt` posé seulement s'il manque. Les anciennes actions `suivi` restent lisibles comme J+15 ou J+30 selon leur date.

## Points restants

- SMS : le bouton ouvre l'application SMS du téléphone ; aucun envoi automatique (pas de fournisseur SMS branché). « Programmer un SMS » crée un rappel, pas un envoi différé.
- Bibliothèque de scripts : partage réseau dans `scriptsReseau` du club, pas encore partagé entre organisations (`/orgs`).
- Tarifs de la rétention saisis à la main ou repris de Resamania quand l'export le permet ; sans tarif, la carte affiche « tarif à renseigner » et passe après les autres.
- Rapport ROI : « non calculable » tant qu'aucun import Incidents n'existe pour le mois.
- La démo « Club Horizon » reste utilisée par les captures et les tests ; `?demo=1` lance désormais le Club Démo Centre.
- Déploiement et dépôt « fit-pulse » : en attente de votre feu vert.
