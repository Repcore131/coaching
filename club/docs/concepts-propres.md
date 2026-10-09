# Fit Pulse : concepts propres

Ce document recense les concepts originaux de Fit Pulse, avec pour chacun une description, la date de sa première implémentation et le commit correspondant, tirés de l'historique git (`git log -S<identifiant> --reverse`, dépôt complet). Les dates sont celles des commits (UTC).

Titulaire des droits : voir `LICENSE`.

| Concept | Première implémentation | Commit |
| --- | --- | --- |
| Relève horaire des demandes de résiliation | 9 octobre 2026 | `2dae45a` |
| File d'appels en euros | 5 octobre 2026 (valeur en jeu), 9 octobre 2026 (file triée et session) | `9172612`, `66f6c4e` |
| Impayés par canal et délai médian | 5 octobre 2026 (canaux), 9 octobre 2026 (délai médian) | `9e1262c`, `ad359d8` |
| Paliers collectifs avec projection | 5 octobre 2026 | `72337cc`, `e27d11f` |
| Zones par mois validés | 9 octobre 2026 | `7f06f96` |
| Tracé de pouls | 9 octobre 2026 | `7f06f96`, `d189d91` |
| Carnet du mois | 5 octobre 2026 (bilan mensuel), 9 octobre 2026 (nom actuel) | `6acb54a`, `7f06f96` |
| Page « Ce que Fit Pulse a rapporté » | 9 octobre 2026 | `1cf040b` |

## Relève horaire des demandes de résiliation

Chaque heure, un passage serveur lit la boîte e-mail du club (requête Gmail limitée aux demandes de résiliation), analyse chaque fil (adhérent, date de réception, motif, pièce jointe), le rapproche de la base adhérents et crée ou complète un dossier « Demande reçue ». Le dossier porte un délai de traitement de 48 heures et un responsable ; les fils sont fusionnés sans doublon et purgés après 90 jours. Aucun jeton d'accès n'est présent dans l'application.

- Première implémentation : 2026-10-09 14:10:55 UTC
- Commit : `2dae45a58150897bda74bbb07cadf71807536407` (« Fit Pulse : relève horaire des demandes de résiliation reçues par e-mail »)
- Code : `club/demandes.js`, `club/outils/fitpulse-resmail.mjs`

## File d'appels en euros

Les appels de rétention (fins d'engagement, J+15, J+30, impayés, résiliations) ne sont pas classés par date mais par valeur en jeu : mensualité multipliée par les mois d'engagement restants. La session d'appels enchaîne les dossiers du plus coûteux au moins coûteux et cumule la valeur protégée.

- Valeur en jeu d'un dossier : 2026-10-05 17:47:44 UTC, commit `91726124144e4d87ea1e565836940c9f54120c1d`
- File triée en euros, session d'appels et valeur protégée : 2026-10-09 14:25:47 UTC, commit `66f6c4ea8067ebd232db6b8901816ff1f63c078c`
- Code : `club/calc.js` (`valeurEnJeu`, `valueAtStake`), `club/retention.js`

## Impayés par canal et délai médian

Chaque régularisation d'impayé est attribuée à son canal (équipe du club, client en ligne, prélèvement automatique, automatismes, tiers) d'après la liste Incidents de Resamania ; l'équipe ne se voit créditer que ce qu'elle a réellement récupéré. Le délai médian entre l'ouverture et la régularisation, et les promesses de paiement échues, sont suivis par club.

- Canaux de régularisation : 2026-10-05 14:23:24 UTC, commit `9e1262cdc66972d3b7521e4b9586c1f3c3e92fb1`
- Délai médian, promesses échues, calcul unique des montants récupérés : 2026-10-09 14:31:59 UTC, commit `ad359d88ecf530d6ff89fe63a262c8254ac83d53`
- Code : `club/resamania.js`, `club/pages-ops.js` (`dunStats`), `club/calc.js` (`recoveredParts`)

## Paliers collectifs avec projection

Des paliers d'équipe (P1, P2, P3) sont fixés sur les KPI du club pour le mois ; Fit Pulse projette, au rythme actuel, le palier qui sera atteint en fin de mois et en déduit la « météo » du club (la pire projection des paliers).

- Paliers collectifs : 2026-10-05 14:59:27 UTC, commit `72337cc02a0393cff52dcca01a3d6dfee4fb1d1e`
- Projection et météo du club : 2026-10-05 15:12:43 UTC, commit `e27d11fb3356c60d8a76809901d88f095c7b85ba`
- Code : `club/pages-home.js` (`palRead`, météo)

## Zones par mois validés

La progression individuelle ne repose pas sur un cumul de points mais sur la régularité : un mois est validé quand le score des KPI obligatoires atteint 80 % de l'objectif. Zone 1 à Zone 5 pour 0, 2, 5, 9 et 14 mois validés.

- Première implémentation : 2026-10-09 17:20:12 UTC
- Commit : `7f06f96824117d17a179020b18bdf777c8376ed6`
- Code : `club/calc.js` (`moisValides`, `zoneOf`), `club/art.js` (`zoneBadge`), `club/txt.js` (`TXT.zones`)

## Tracé de pouls

Le rythme de chaque commercial et du club est représenté par une ligne de pouls dont l'amplitude et la couleur suivent l'état (en avance, dans le rythme, à surveiller, en retard). Le même tracé forme le logo : la barre du T de FIT se prolonge en battement jusqu'au P de PULSE.

- Tracé dans l'interface : 2026-10-09 17:20:12 UTC, commit `7f06f96824117d17a179020b18bdf777c8376ed6`
- Logo : 2026-10-09 17:23:36 UTC, commit `d189d91043c73f85cf3e2f7b2041187564cfdced`
- Code : `club/ui.js` (`pulseLine`), `club/assets/logo/`
- Logo « P pouls » (lot D) : carré arrondi plein, P en négatif dont la panse se prolonge en tracé de pouls à trois pics ; `club/ui.js` (`logoMark`), `club/assets/brand/`

## Carnet du mois

À la fin de chaque mois, chaque commercial reçoit un carnet personnel en plusieurs écrans : score, meilleur KPI, classement, actions de rétention, mot du manager et objectif concret pour le mois suivant (quantité par semaine sur le KPI le plus en retard), exportable en image.

- Bilan mensuel personnel : 2026-10-05 12:14:40 UTC, commit `6acb54a4ab3d157b73ec6ba49c107f0d38231852`
- Nom « Carnet du mois » : 2026-10-09 17:20:12 UTC, commit `7f06f96824117d17a179020b18bdf777c8376ed6`
- Code : `club/pages-team.js` (`PAGES.wrap`, `drawWrapCard`)

## Page « Ce que Fit Pulse a rapporté »

Le mois, ligne par ligne et vérifiable : impayés régularisés par l'équipe, résiliations sauvées multipliées par la valeur restante du contrat, renouvellements obtenus après une relance notée dans les 45 jours, ventes boutique saisies. Chaque euro renvoie à son dossier ; le total est comparé au prix de l'abonnement Fit Pulse.

- Première implémentation : 2026-10-09 15:37:51 UTC
- Commit : `1cf040bce02f02a36eceb872d06047edd437a778`
- Code : `club/rapporte.js`

## Méthode

Pour retrouver ces informations : `git log -S<identifiant> --reverse --format="%H %ad %s" --date=iso -- club | head -1`, avec les identifiants cités ci-dessus. Le dépôt doit être complet (`git fetch --unshallow` si le clone est superficiel).
