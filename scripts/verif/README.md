# Voir et éprouver l'app sans la déployer

Deux outils qui parlent à Chrome par le protocole DevTools : l'un rend des
captures, l'autre lance la suite intégrée. Ils évitent l'aller-retour
« pousser → attendre GitHub Pages → recharger » pour tout ce qui se vérifie
en local.

## Le piège qui coûte une heure

`--headless=new` **ne composite pas** sur ce poste : `Page.captureScreenshot`
ne rend jamais la main, sans erreur ni délai. Le mode `--headless=old`, lui,
marche. `Page.enable` ne se résout pas davantage — on s'en passe.

Le panneau de prévisualisation intégré de Claude Code souffre du même mal
(« Browser pane is not displayed »), voir la note de session correspondante.

## Mise en route

```bash
cd app && python -m http.server 8799 --bind 127.0.0.1 &
chrome.exe --headless=old --disable-gpu --no-first-run \
  --user-data-dir=/tmp/chr --remote-debugging-port=9223 about:blank &
```

## Rejouabilité

`suite.mjs` ouvre un onglet neuf et vide le stockage : il ne peut donc rien dire
de la rejouabilité. `idempotence.mjs` joue la suite TROIS fois dans la MÊME page
et compare les rapports — c'est le seul moyen de voir si elle rend ce qu'elle
emprunte à `DB`, à `currentUser` et aux caches. Une suite qui ne restaure pas
rend des échecs fantômes à la deuxième passe, et tout diagnostic bâti sur elle
devient douteux.

```bash
node scripts/verif/idempotence.mjs "http://127.0.0.1:8799/app/index.html"
```

Les trois totaux doivent être identiques, et `fantomes2`, `fantomes3` et
`gueris` vides. Un total qui DÉRIVE dit que la suite s'ajoute à elle-même ; un
fantôme dit qu'elle ne restaure pas.

Mesure du 02/09/2026 : 4 142 / 18 aux trois passes, aucun fantôme.

## Captures

`capture.mjs` prend une page qui contient des blocs `.banc`, chacun de
largeur fixe, et rend un PNG par banc — un même composant à 360, 430, 640 et
900 px sans monter quatre fenêtres. La page entière est trop haute pour une
seule capture : chaque banc est isolé le temps de la sienne.

```bash
node scripts/verif/capture.mjs "http://127.0.0.1:8799/_verif-supp.html" sortie
```

`scripts/avatar/verif_supp.py` fabrique une telle page pour l'écran des
compléments. Elle **découpe** dans `index.html` les déclarations dont le rendu
dépend — fermeture transitive, styles compris — au lieu d'en recopier une
version qui divergerait au premier changement.

## La suite intégrée

```bash
node scripts/verif/suite.mjs "http://127.0.0.1:8799/index.html"
```

Rend `{total, echecs, liste}`. Une cinquantaine d'échecs sont attendus hors
navigateur réel : écrans non montés, service worker absent. **Comparer à une
base** avant de conclure à une régression : relever le chiffre sur
`git stash`, puis sur la version modifiée.

### Deux pièges qui faisaient mentir le rapport

**Le service worker d'une session précédente sert l'ancien `tests.js`.** Il
n'est pas dans ses `ASSETS`, mais l'enregistrement survit au profil Chrome et
sa réponse passe avant le serveur local. On modifie un test, on relance, le
rapport ne bouge pas — et on croit que le test n'existe pas. Le script
désenregistre et vide les caches avant de commencer.

**La table Ciqual doit être chargée AVANT la suite.** Sans elle, un test de
substitution lève à mi-parcours ; la suite étant un seul `try`, tout ce qui
suivait ne s'exécutait plus. Mesuré : **2 117** tests joués sans ce
chargement, **3 729** avec. 1 612 assertions passaient pour absentes, et un
lot pouvait en casser sans que rien ne l'indique.

## Les gestes délégués, et la suite servie avec la CSP

Depuis le build 1760, `script-src` (firebase.json, `/app` et `/app/**`) ne porte
plus `'unsafe-inline'`. Trois conséquences, qu'aucun serveur local sans en-tête
ne montre :

- **un `onclick="…"` écrit dans une chaîne HTML est un bouton mort en
  production.** On écrit `data-on-click="f(x)"` (et `data-on-change`,
  `data-on-input`, `data-on-keydown`, `data-on-error`…). Le texte est le même,
  mais il n'est plus exécuté par le navigateur : il est lu par le moteur de
  gestes en tête de `rc-core.<build>.js`, qui n'appelle que les fonctions de la
  table blanche `RC_ACTIONS` ;
- **`f` doit être dans `RC_ACTIONS`**, sinon le geste est refusé (console :
  `[geste] …`). La table est écrite par le script, jamais à la main ;
- **les `<script>` en ligne de `app/index.html` passent par leur empreinte**
  (`'sha256-…'` dans la CSP). `python scripts/versionner_actifs.py` les recalcule
  à chaque build, `csp.mjs` les vérifie avant le déploiement.

```bash
node scripts/verif/gestes.mjs            # vérifie (aucun on…=, table à jour, gestes lisibles)
node scripts/verif/gestes.mjs --ecrire   # réécrit la table après avoir ajouté un geste
node scripts/verif/csp.mjs               # pas d'unsafe-inline, empreintes à jour
```

Un nom de fonction composé à l'exécution (`` `${fn}(${i})` ``) n'est pas
lisible par le script : on le déclare à côté par un commentaire
`// actions-en-plus: nomUn nomDeux`. Une variable d'état lue ou posée par un
geste (`_pfOuvert=!_pfOuvert`) s'inscrit dans `RC_GESTE_VARS`, en fin de
rc-core. `el.onclick=fn` posé par le code l'emporte toujours sur le
`data-on-click` du balisage ; pour appeler le geste d'un bouton,
`rcGesteClic(el)` et non `el.onclick()`.

Pour jouer la suite **dans les conditions de la production** :

```bash
node scripts/verif/serveur-csp.mjs 8000 &
CSP=1 VW=1280 VH=2000 node scripts/verif/suite.mjs http://127.0.0.1:8000/app/index.html 9223
```

Le serveur pose la CSP de firebase.json sur `/app/**`, plus `'unsafe-eval'` et
`blob:` dont `tests.js` a besoin (et lui seul). Avec `CSP=1`, la suite échoue
sur tout refus de `script-src` et sur tout geste refusé par le moteur ; les
refus d'`img-src` ou `connect-src` viennent des jeux d'essai (domaines
factices) et sont seulement listés.

**La copie publiée est minifiée** (`scripts/minifier_site.mjs`) : ses scripts en
ligne n'ont plus les empreintes du dépôt. Le déploiement Firebase les recalcule
sur `_site` et les pose dans le firebase.json du runner :

```bash
node scripts/verif/csp.mjs --site _site --poser
```

`deploie.sh` ne minifie pas : les empreintes du dépôt y sont les bonnes.
