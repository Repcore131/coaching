# Typographie maison — fabrication

Les deux polices `app/fonts/repcore-plein.woff2` et `app/fonts/repcore-contour.woff2`
ne sont pas des fichiers reçus : elles sont **générées** depuis l'alphabet dessiné à
la main dans le dépôt [Repcore131/FontApp](https://github.com/Repcore131/FontApp),
qui ne contient que des PNG (aucun `.ttf`/`.otf`/`.woff2`).

Sans ces deux scripts, les polices seraient irreproductibles.

## Regénérer

```bash
pip install fonttools potracer brotli pillow numpy
python tools/typo/composer_glyphes.py build/glyphes
python tools/typo/construire_police.py build/glyphes app/fonts
```

Puis incrémenter `?v=` dans les deux `@font-face` de `app/index.html` **et** dans la
liste `ASSETS` de `app/sw.js` — les deux adresses doivent rester identiques, sinon le
service worker met en cache une URL que personne ne demande.

## Ce que fait `composer_glyphes.py`

Il ne dessine rien. Il complète le jeu de FontApp sur deux manques :

- **17 capitales accentuées**, composées depuis les marques déjà tracées à la main
  (aigu, grave, circonflexe, tréma, tilde). Le source de l'app en compte 22 600
  occurrences, et `check_accents.js` interdit tout libellé désaccentué.
  La cédille n'existait pas : on emploie la **virgule**, forme dont la cédille dérive
  historiquement et qui est du même trait.
- **28 signes** présents en Plein et absents du Contour — dont le tiret cadratin, qui
  sert de valeur « vide » dans toute l'application. Ils sont évidés depuis le Plein à
  l'épaisseur mesurée du trait Contour (6 px pour 257 de capitale).

## Ce que fait `construire_police.py`

Vectorise chaque PNG et assemble deux woff2. Points qui ont coûté cher :

- `potrace.Bitmap.__init__` appelle `invert()` **sans condition** : passer le masque
  tel quel fait tracer le fond, et chaque glyphe sort en négatif.
- Le point, le tiret bas et la barre verticale sont des rectangles pleins bord à bord.
  Sans une marge d'un pixel, potrace n'a aucun fond à contourner et ne rend rien.
- Le sens de parcours est **recalculé par profondeur d'imbrication**, jamais hérité de
  potrace : un `O` évidé compte quatre bordières, et une alternance fausse au troisième
  niveau fait remplir la contre-forme par la règle non-zero.
- `capHeight` 700/1000, `ascender` 900, `descender` -300 : exactement les métriques de
  Bebas Neue, la police remplacée. Les tailles de titre déjà en place gardent donc leur
  rendu optique.
- Les minuscules sont mappées sur les capitales dans la police elle-même : la typo n'a
  que des capitales, et un titre non passé en majuscules par le CSS s'afficherait sinon
  vide.
