# Les zones musculaires de l'avatar de séance

Les vingt-huit planches d'`app/icons/avatar/` (7 niveaux × homme/femme ×
face/dos) reçoivent un surlignage rouge sur le muscle travaillé. Ce dossier
produit la table `WO_ZONES` qui vit dans `app/index.html`.

## Pourquoi ce n'est pas fait à la main

Une ellipse ne sera jamais la forme d'un pectoral : elle déborde d'un côté,
laisse un croissant blanc de l'autre, et les vingt-huit planches finissaient
avec la même tache ronde. Un contour dessiné à la main, lui, il en faudrait
**364** — treize muscles sur chacune des vingt-huit planches — et le premier
redessin d'une planche les périmerait tous.

D'où le découpage en deux : un **relevé** par planche, et **un gabarit** par
vue.

- `chart.py` — le relevé. Pour chaque planche, ligne par ligne : où commence
  et où finit le bras gauche, le torse, le bras droit ; puis les deux jambes
  sous l'entrejambe. Les bords extérieurs viennent de l'alpha (exacts). Le bord
  bras/torse est mesuré là où les bras se détachent, et remonte en droite de
  l'aisselle vers le haut de l'épaule au-dessus : c'est le sillon
  delto-pectoral. L'anatomie **verticale** est la même aux sept niveaux (genou,
  mollet et cheville tombent aux mêmes lignes du niveau 1 au niveau 7) : elle
  est donc figée par famille, et seules les largeurs sont relevées.

- `muscles.py` — le gabarit, un par vue. Un point vaut `(y, segment, t)` où `t`
  est une **fraction de membre**, jamais une distance : « le biceps va du milieu
  du bras à son bord interne ». Le même gabarit épouse donc le bras fin du
  niveau 1 et le bras épais du niveau 7 sans un réglage de plus. Les `y` sont
  lus sur les planches masculines de référence et reportés sur l'échelle
  anatomique de la famille — ce qui suffit à passer au corps féminin, dont les
  épaules et l'entrejambe sont plus bas.

- `build.py` — le produit des deux : le contour du muscle sur *cette* planche.
  Spline fermée de Catmull-Rom, puis Douglas-Peucker dans le repère de
  **l'affichage** (56 × 118 px) et non du fichier, avec une tolérance qui suit
  l'épaisseur de la forme : un demi-centième mange un sixième du trapèze et
  rien du quadriceps.

- `export.py` / `poser.py` — la table JS. `poser.py` la repose dans
  `index.html` en place ; il est rejouable et ne touche à rien d'autre.

## Contrôler

```
python poser.py     # regénère et repose la table
python verif.py     # rejoue, sous node, les assertions que tests.js porte dessus
python apercu.py    # planches « ce que voit l'athlète », à la taille d'affichage
python qa.py vue h face      # les 7 niveaux, tous les muscles empilés
python qa.py image n4-h.png  # une planche, un muscle par vignette
python qa.py zoom n4-h-dos.png DORSAUX TRAPEZES   # à la loupe
python overlay.py -h.png     # le relevé posé sur le dessin (bords torse/bras/jambes)
python grid.py n4-h.png      # la planche avec une grille de coordonnées
```

`apercu.py` et `verif.py` relisent **la table livrée dans `index.html`**, pas
leur propre calcul : ils contrôlent ce qui part en production.

## Si une planche est redessinée

Refaire tourner `poser.py`, puis regarder `apercu.py`. Si un muscle a glissé,
c'est le gabarit de `muscles.py` qu'on corrige — jamais la table.
