# Fit Pulse : sources tierces et licences

Tout le reste (code de l'application et des outils serveur, textes, méthodes de calcul, visuels vectoriels de `art.js`, logo de `assets/logo/`) a été écrit pour Fit Pulse : voir `LICENSE` et `docs/concepts-propres.md`.

## Bibliothèques

Fichiers copiés tels quels dans `vendor/`, chargés à la demande, jamais modifiés. Ils ne font pas partie de l'œuvre Fit Pulse.

| Bibliothèque | Fichier | Version | Licence | Usage |
| --- | --- | --- | --- | --- |
| JSZip | `vendor/jszip.min.js` | 3.10.1 | MIT ou GPLv3, au choix (utilisée sous MIT) ; inclut pako (MIT) | lecture des exports .xlsx de Resamania |
| SheetJS Community Edition | `vendor/xlsx.full.min.js` | 0.20.3 | Apache 2.0 | lecture des tableurs .xls et .xlsx |
| Firebase JS SDK (compat) | `vendor/firebase-app-compat.js`, `firebase-auth-compat.js`, `firebase-database-compat.js` | firebase 10.12.2 (app-compat 0.2.35, auth-compat 0.5.9, database-compat 1.0.5) | Apache 2.0 | connexion et base de données en mode partagé |

Outils de développement et de test (non distribués avec l'application) : ESLint 9 (MIT), Playwright (Apache 2.0), firebase-tools 13 pour le simulateur (MIT).

## Polices

Hébergées sur le site (`fonts/`, déclarées dans `fonts.css`), aucun appel à Google Fonts.

| Police | Auteur | Licence |
| --- | --- | --- |
| Barlow Condensed | Jeremy Tribby | SIL Open Font License 1.1 |
| Montserrat | Julieta Ulanovsky et contributeurs | SIL Open Font License 1.1 |

L'OFL autorise l'usage commercial et l'intégration dans un logiciel ; les polices ne peuvent pas être vendues seules.

## Images

| Fichier | Origine | Droits | À vérifier |
| --- | --- | --- | --- |
| `assets/logo/*.svg`, `favicon.png`, `icon-*.png`, `apple-touch-icon.png`, `assets/fitpulse-logo.png` | dessinés pour Fit Pulse (tracés SVG, PNG générés depuis ces SVG) le 9 octobre 2026, commit `d189d91` | Fit Pulse | rien |
| visuels de `art.js` (insignes de zone, paliers, trophées, illustrations des écrans vides) | dessinés en SVG dans le code | Fit Pulse | rien |
| `assets/hero-banner.jpg`, `assets/hero-login.jpg` | images d'ambiance créées dans Canva (commit `e27d11f`, 5 octobre 2026) | licence Canva du compte qui les a créées | vérifier dans Canva que chaque élément utilisé (photo, illustration) est couvert par la licence de contenu Canva pour un usage commercial dans un logiciel vendu, sans élément « Pro » utilisé hors abonnement ; conserver la preuve (capture de l'élément et de sa licence) |
| `assets/fitpulse-source.webp` | ancien logo, créé dans Canva (commit `fd68884`, 5 octobre 2026) | licence Canva | plus utilisé par l'application ; à garder seulement comme trace, ou à retirer |
| `assets/logo-fitness-park.svg` | logo de l'enseigne Fitness Park | marque de Fitness Park, propriété de son titulaire | plus affiché par défaut ; ne peut être affiché que par un club du réseau autorisé par l'enseigne ; à exclure de toute version vendue à d'autres salles |

## Données

Les données de démonstration (`demo.js`, `?demo=1`) sont fictives : noms, chiffres et club inventés.
