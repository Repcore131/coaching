# Fit Pulse : sources tierces et licences

Tout le reste (code de l'application et des outils serveur, textes, méthodes de calcul, visuels vectoriels de `art.js`, logo de `assets/brand/`) a été écrit pour Fit Pulse : voir `LICENSE` et `docs/concepts-propres.md`.

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
| Geist, Geist Mono | Vercel et Basement Studio | SIL Open Font License 1.1 |
| IBM Plex Sans, IBM Plex Mono (repli, `fontPair: 'plex'`) | IBM, Mike Abbink et Bold Monday | SIL Open Font License 1.1 |

L'OFL autorise l'usage commercial et l'intégration dans un logiciel ; les polices ne peuvent pas être vendues seules.

## Images

| Fichier | Origine | Droits | À vérifier |
| --- | --- | --- | --- |
| `assets/brand/logo-mark.svg`, `logo-full.svg`, `logo-white.svg` et leurs PNG, `favicon.png`, `icon-*.png`, `apple-touch-icon.png` | logo « P pouls » dessiné pour Fit Pulse en SVG (lot D, octobre 2026), PNG générés depuis ces SVG | Fit Pulse | rien |
| icônes de navigation (`ICONS` dans `core.js`), insignes de niveau, paliers et trophées (`art.js`) | redessinés en SVG dans le code d'après la planche `assets/brand/icons-sheet.png` | Fit Pulse | rien |
| `assets/brand/icons-sheet.png`, `empty-1..8.png` (et `-a`), `level1..4.png`, `login-visual.webp` | planches et visuel fournis par le titulaire en octobre 2026 (images générées), découpés et réduits pour le site | à confirmer par le titulaire | vérifier les conditions de l'outil qui a produit ces images (usage commercial dans un logiciel vendu, absence de marque ou de personne identifiable) et en garder la preuve ; le visuel de connexion est en WebP, une photo en PNG dépassant 120 Ko |
| `assets/logo/*.svg` | premier logo (9 octobre 2026, commit `d189d91`) | Fit Pulse | conservé comme historique, plus utilisé par l'application |
| `assets/logo-fitness-park.svg` | logo de l'enseigne Fitness Park | marque de Fitness Park, propriété de son titulaire | plus affiché par défaut ; ne peut être affiché que par un club du réseau autorisé par l'enseigne ; à exclure de toute version vendue à d'autres salles |

## Données

Les données de démonstration (`demo.js`, `?demo=1`) sont fictives : noms, chiffres et club inventés.
