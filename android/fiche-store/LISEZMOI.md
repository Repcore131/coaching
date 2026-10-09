# La fiche Play Store de RepCore

Format **fastlane (supply)** : chaque fichier se colle tel quel dans la Play Console
(*Présence sur le Store › Fiche principale*), ou s'envoie avec `fastlane supply`.

```
fiche-store/
  modeles/full_description.txt      le modèle : prix en {{tarif:<clé>}}, nombres en {{nb:<clé>}}
  fr-FR/title.txt                   ≤ 30 caractères
  fr-FR/short_description.txt       ≤ 80 caractères
  fr-FR/full_description.txt        ≤ 4000 caractères — ÉCRIT par scripts/tarifs.mjs, ne pas modifier à la main
  fr-FR/changelogs/<versionCode>.txt   ≤ 500 caractères, un par version envoyée
  fr-FR/images/phoneScreenshots/    6 captures 1080×1920 (JPEG)
  fr-FR/images/featureGraphic.jpg   la bannière 1024×500
  fr-FR/images/icon.png             l'icône 512×512 (copie d'android/store_icon.png)
```

**Contrôle** : `node scripts/verif/fiche-store.mjs`. Il vérifie les longueurs, refuse un prix écrit en
dur, refuse une description qui ne serait plus le modèle rendu avec `tarifs.json`, et vérifie les
images : nombre, dimensions et absence de couche alpha.

## Modifier la fiche
- **Le texte long** se modifie dans `modeles/full_description.txt`, puis `node scripts/tarifs.mjs`.
  Un prix s'écrit `{{tarif:essentielle.mois}}`, jamais « 9,50 € ».
- **Une nouvelle version** de l'APK ou de l'AAB : ajouter `fr-FR/changelogs/<versionCode>.txt` (le
  contrôle l'exige pour le `versionCode` de `android/app/build.gradle`).

## Les six captures et la bannière
Elles sont produites par `node scripts/captures-store.mjs`, qui demande un serveur sur le dépôt et un
Chromium sans tête, comme la suite : voir l'en-tête du script. Chacune pose une vraie image de
l'app dans un téléphone, sous un titre court :

| # | Fichier | Titre | Source |
|---|---|---|---|
| 1 | `1_seance.jpg` | La bonne charge, à chaque série. | `app/img/vente/seance-charge.webp` |
| 2 | `2_nutrition.jpg` | Ta nutrition, même hors ligne. | `app/img/vente/nutrition-journal.webp` (le haut) |
| 3 | `3_progression.jpg` | Ta progression, semaine après semaine. | `app/img/vente/evolution-poids.webp` |
| 4 | `4_correction.jpg` | Ta technique corrigée, image par image. | `app/img/vente/correction.webp` |
| 5 | `5_exercices.jpg` | 400+ exercices filmés et expliqués. | `app/img/vente/exercice-tirage.webp` |
| 6 | `6_coach.jpg` | Pour les coachs : toi, tu coaches. | l'écran **Espace coach** de l'app, capturé au moment de générer |

**Bannière** (`featureGraphic.jpg`, 1024×500) : `app/img/vente/og-vente.jpg`, recadrée.

- ⚠ **1080×1920, et non 1080×2340.** La Play Console refuse une capture dont le grand côté dépasse le
  double du petit (2340 / 1080 = 2,17).
- ⚠ **JPEG, et non PNG.** Chrome produit des PNG avec couche alpha, que la Play Console refuse.
- ⚠ **La bannière reprend `og-vente.jpg`, qui annonce « 500 exercices filmés »**, alors que la landing
  et la fiche disent « 400+ ». Corriger l'image source, puis régénérer.
- Pour de meilleures captures, prises sur un vrai téléphone avec un compte de démonstration : les
  déposer dans `fr-FR/images/phoneScreenshots/` (2 à 8, JPEG ou PNG sans alpha), puis lancer le contrôle.
