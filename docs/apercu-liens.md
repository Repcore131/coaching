# L’aperçu des liens de page publique (WhatsApp, DM Instagram)

## Le chemin d’un lien

1. On partage `https://repcore-sync.web.app/@julie?ref=JULIE7K2&src=bio`.
2. L’hébergement Firebase **redirige** (302, `firebase.json` → `redirects`)
   vers `https://repcore-serveur.repcore.workers.dev/@julie?…`.
3. Le Worker (`cloudflare/src/pages.js`) sert **la même page** `p/index.html`
   (relue sur l’hébergement), avec les balises `og:` de Julie : titre
   « Julie · rang VOLTAGE sur RepCore », description (séances, série),
   image `app/img/rangs/rang_3-og.jpg` (1200×630). Un `<base href>` rattache
   la page à l’hébergement : images, `/i` et l’app restent chez Firebase.
4. Mis en cache **6 h** (en-tête `Cache-Control`, cache Cloudflare quand le
   Worker a un domaine à soi, mémoire de l’instance sinon).
5. En panne : le Worker renvoie vers `p/?u=julie` (la page sans aperçu).

Même chose pour `/coach/<slug>` (nom, phrase, photo https du coach).

## Mettre en ligne, dans cet ordre

1. **Le Worker d’abord** : `cd cloudflare && npx wrangler deploy`.
   Vérifier : `curl -sA 'WhatsApp/2.23' https://repcore-serveur.repcore.workers.dev/@<un pseudo actif> | grep og:`
2. **Les règles** (`database.rules.json` : `volts`, `semaines`, badges en
   images, `meilleurs`) **avec l’app** (build 1633) : l’app publie ces champs,
   des règles anciennes les refuseraient et la page ne se mettrait plus à jour.
3. **L’hébergement** (`firebase.json`, `p/index.html`).
   Vérifier : `curl -sI https://repcore-sync.web.app/@<pseudo>?ref=X` →
   `302`, `location: https://repcore-serveur…/@<pseudo>?ref=X`.
   ⚠ Si le `?ref=` n’apparaît pas dans `location`, les liens perdent le code
   parrain en route : le signaler (la page retombe alors sur le code du
   profil, `p.ref`, ce qui limite le dégât).

## Vérifier l’aperçu (à la main, à chaque changement de pages.js ou des pages)

Ni WhatsApp ni Instagram ne se testent depuis un serveur : il faut deux
téléphones (ou un téléphone et un compte de test).

Avant : une page publique **active** (profil → Ma page publique, ou l’écran
d’un nouveau rang → « Mettre ma page en ligne »).

### WhatsApp
1. Envoyer le lien de la page (`Copier mon lien pour ma bio Instagram`) dans
   une conversation.
2. Avant d’envoyer, l’aperçu doit apparaître : **image de l’emblème**, titre
   « Prénom · rang NOM sur RepCore », description « N séances · N semaines… ».
3. Envoyer ; toucher l’aperçu : la page s’ouvre, l’emblème et la jauge
   s’affichent, « Rejoins Prénom sur RepCore » mène à `/i` avec le code.
4. WhatsApp garde un aperçu en cache sur le téléphone : pour revoir un
   changement, ajouter `&v=2` au lien.

### DM Instagram
1. Envoyer le même lien en message privé.
2. L’aperçu (image, titre) doit apparaître sous le lien. Instagram lit les
   balises avec le robot de Meta : si l’aperçu est ancien ou vide, le
   rafraîchir avec l’outil de débogage de partage de Meta
   (developers.facebook.com/tools/debug), qui affiche aussi ce que le robot
   a lu (redirection suivie, `og:image`, taille 1200×630).
3. Toucher le lien : il s’ouvre dans le navigateur intégré d’Instagram ; la
   page doit s’afficher entière (pas de page blanche).

### Coach
Même procédure avec `/coach/<slug>` : nom, phrase, photo du coach.

### Ce qui est prouvé sans téléphone
- `cloudflare/test/pages.test.mjs` : chemins, aperçu athlète/coach, gabarit
  du dépôt, `<base>`, cache 6 h, panne → page statique, HEAD, redirections
  de `firebase.json`, images og des 10 rangs en 1200×630.
- `sh cloudflare/test/essai-workerd.sh <dossier>` : dans le vrai moteur de
  Cloudflare, `/@julie` demandé avec l’agent de WhatsApp rend 200 et
  l’aperçu.

## Compte rendu
Pour chaque appli : aperçu présent (oui/non), image (emblème/défaut), titre,
lien ouvert correctement, code parrain gardé.
