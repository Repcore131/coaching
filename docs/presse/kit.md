# RepCore : dossier de presse

## 1. L'histoire

Kevin Guellec est coach sportif diplômé d'État.
Il a conçu et codé seul sa propre application de musculation : RepCore.
Elle réunit dans un seul outil la séance, la nutrition, le sommeil et la progression.
L'idée de départ est simple : à chaque série, l'application propose la charge à soulever, d'après ce qui a été fait la fois précédente.
Les athlètes qui le souhaitent peuvent être suivis par un coach dans la même application : programme, bilans, correction vidéo.
RepCore prend aussi en compte le cycle menstruel : si l'athlète l'active, les charges et le volume s'ajustent selon la phase qu'elle déclare.
L'application s'ouvre dans le navigateur et s'ajoute à l'écran d'accueil, sans passer par un magasin d'applications.
Elle fonctionne hors ligne, en salle, et se synchronise au retour du réseau.
Elle existe en français, en anglais, en espagnol et en portugais.
Kevin continue de coacher et de faire évoluer l'application lui-même.

## 2. Ce que fait l'application

- **Carnet de séance** : une charge proposée pour chaque série, modifiable à tout moment, avec séries, répétitions, RIR et minuteur de repos.
- **Nutrition** : journal alimentaire avec scan, recherche et photo d'étiquette, et des besoins calculés.
- **Suivi du cycle menstruel** : facultatif et désactivé par défaut ; une fois activé, il ajuste les charges et le volume selon la phase déclarée, et l'athlète garde la main sur chaque valeur.
- **Guide d'exercices** : plus de 400 exercices filmés en salle, avec le placement, l'amplitude, le tempo et les erreurs à éviter.
- **Coaching et analyse du mouvement** : le coach suit ses athlètes, lit leurs bilans et corrige leurs mouvements en vidéo, avec des angles, des trajectoires et des mesures d'amplitude dessinés sur l'image.

Source : la page d'accueil https://repcore-sync.web.app/ (rubriques et questions fréquentes).

## 3. Chiffres

Chaque chiffre peut être recompté.

| Chiffre | Valeur | Comment le recompter |
|---|---|---|
| Langues de l'application | 4 (français, anglais, espagnol, portugais) | le français dans le code, plus les trois dictionnaires `app/i18n/en.json`, `es.json`, `pt.json` |
| Exercices du guide | plus de 400 | texte de la page d'accueil ; 436 illustrations dans `app/exercices/` (`ls app/exercices/*.webp`) |
| Articles du blog | 4 | fichiers de `blog/`, hors `index.html` ; https://repcore-sync.web.app/blog/ |
| Formule Essentielle | 9,50 € par mois ou 95 € par an | `tarifs.json`, clé `essentielle` |
| Formule Ultime | 24,90 € par mois ou 249 € par an | `tarifs.json`, clé `ultime` |
| Essai | 1 mois, sans carte bancaire | `tarifs.json`, clé `essai` |
| Formules pour les coachs | 0 €, 19 € et 39 € par mois | `tarifs.json`, clé `coach` |
| Engagement | aucun | `tarifs.json`, clé `engagementMois` |

Les prix sont publics : https://repcore-sync.web.app/tarifs.json

## 4. Visuels

| Visuel | Fichier | Adresse publique |
|---|---|---|
| Logo | `app/icons/logo.png` | https://repcore-sync.web.app/app/icons/logo.png |
| Portrait de Kevin Guellec | `app/img/vente/kevin.webp` | https://repcore-sync.web.app/app/img/vente/kevin.webp |
| Capture de l'application : la charge proposée en séance | `app/img/vente/seance-charge.webp` | https://repcore-sync.web.app/app/img/vente/seance-charge.webp |

D'autres captures de l'application (séance, nutrition, courbes) se trouvent dans `app/img/vente/`.

## 5. Contact

Kevin Guellec
guellec.coachingpro@gmail.com
https://repcore-sync.web.app

Mis à jour le 10 octobre 2026
