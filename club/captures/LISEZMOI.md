# Captures commerciales de Fit Pulse

Douze images (six scènes, thème clair et thème sombre), échelle 2, produites par le mode capture de l'application :

    node club/scripts/captures.mjs [--base sauvegarde.json]

| Scène | Écran | Format |
| --- | --- | --- |
| `home` | Accueil du manager | 1440 × 900 |
| `resiliations` | Résiliations à arbitrer | 1440 × 900 |
| `impayes` | Impayés | 1440 × 900 |
| `retention` | Adhérents à garder, sur téléphone | 390 × 844 |
| `imports` | Imports Resamania | 1440 × 900 |
| `themes` | L'accueil trois fois, accents FFD600, D6004C et 0066B3 | 1440 × 900 |

Données entièrement fictives (`captureState()` dans `capture.js`) : Club Démo Centre, six commerciaux, 40 adhérents, date figée au mardi 13 octobre 2026, 9 h 12. Le script échoue si une capture montre une erreur, un état vide, NaN ou undefined, un chiffre sans unité ou un nom de la vraie base (comptes de `tools/bootstrap.js`, et ceux d'une sauvegarde passée avec `--base`).

Une scène seule s'ouvre dans le navigateur : `?capture=1&scene=home&theme=dark&accent=D6004C&club=Club%20Démo%20Sud`.
