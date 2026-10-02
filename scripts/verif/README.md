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
python3 -m http.server 8799 --bind 127.0.0.1 &   # à la RACINE du dépôt
node scripts/verif/suite.mjs "http://127.0.0.1:8799/app/index.html" [port] [--tolere=N]
```

Rend `{total, echecs, liste}`, puis une ligne finale lisible :

```
SUITE : 6037 tests, 0 echec(s) — VERT
```

**Le code de sortie arrête la livraison** (lot 51, 02/10/2026) : la suite joue
dans `.github/workflows/firebase.yml`, AVANT « Deployer », et sort en **1** si
elle a levé, si une ligne du rapport commence par « ⛔ SUITE INTERROMPUE », si
moins de 1 000 tests ont joué (`SUITE_MIN`), ou s'il y a plus d'échecs que
`--tolere=N` (0 par défaut — à n'utiliser que le temps de corriger un échec
connu). `SUITE_ATTENDUS` retire en plus les échecs propres à un Chrome sans
GPU ni codecs (`echecs-attendus.json`, vide aujourd'hui).

**La fenêtre est fixée par le script** : 412×4000, mobile
(`Emulation.setDeviceMetricsOverride` avant le premier `Runtime.evaluate`). Le
« menu de gêne » de `tests.js` se ferme quand sa case sort de l'écran : le
résultat dépendait de la taille par défaut de la fenêtre. `VW` / `VH`
l'écrasent pour une mesure ponctuelle.

**Chiffre de référence (02/10/2026, build 1798) : 6 037 tests, échecs
attendus = 0.** Contre-épreuve : `DLR_ALLEGE` passé de 0.80 à 0.81 → 2 échecs,
sortie 1.

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
