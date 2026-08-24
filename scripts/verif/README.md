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
