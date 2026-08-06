# Import des pas et du sommeil par capture d'écran — plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** permettre à un athlète d'envoyer une capture d'écran de son application de montre pour remplir automatiquement ses pas et ses nuits, sans qu'aucune donnée ne quitte son téléphone.

**Architecture :** un moteur de reconnaissance de texte auto-hébergé (Tesseract) est chargé **à la demande** depuis `app/vendor/`, lit l'image sur l'appareil, et rend du texte brut. Un analyseur pur transforme ce texte en couples (date, valeur), puis des primitives d'écriture les déposent dans `stepsLog` / `sleepLog`. Aucun appel réseau vers un tiers, aucun champ de données nouveau.

**Tech Stack :** JavaScript vanilla, fichier unique `app/index.html`, Service Worker `app/sw.js`, Tesseract.js auto-hébergé, tests par assertions console (`testExercices()`).

**Spec :** `docs/superpowers/specs/2026-08-06-import-capture-stats-design.md`

## Global Constraints

- **Branche de travail :** `import-capture-stats`. Ne jamais committer sur `main` — une mise en ligne est en attente.
- **Fins de ligne :** tout commit se fait avec `git -c core.autocrlf=false`. Sans ça le diff fait 40 000 lignes.
- **Aucun CDN.** Toute dépendance est copiée dans `app/vendor/` et servie depuis le dépôt. C'est une règle du projet, appliquée à `pdf.min.js` et `qr.js`.
- **Aucun appel tiers.** La fonctionnalité ne doit émettre aucune requête réseau sortante hors de l'origine du site. Ne pas toucher à `LEGACY_PDF_IMPORT` (`app/index.html:13315`), qui coupe volontairement OCR.space, ni ajouter de garde à côté.
- **Bump du cache SW** à chaque lot : `const CACHE = 'repcore-vNNN'` en tête de `app/sw.js`. Valeur courante au départ de ce plan : `repcore-v474`.
- **L'app écrit dans la base de production même en local.** Aucun test ne se lance hors bac à sable (voir ci-dessous).
- **`testExercices()` laisse des comptes de test dans `rc_users` et `DB.set` appelle `CLOUD.push`.** Ne jamais lancer la suite hors du bac à sable.

### Bac à sable — obligatoire avant tout test

1. Copier `app/` dans le scratchpad de session.
2. Injecter en tête de `<head>` de la copie un script qui enveloppe `fetch`, `XMLHttpRequest` et `sendBeacon` et **rejette** toute URL contenant `firebaseio|firebasestorage|identitytoolkit|securetoken|api.cloudinary|api.ocr.space|paypal`, en journalisant dans `window.__RC_BLOCKED__`.
3. Neutraliser le Service Worker dans la copie (`if(false && 'serviceWorker' in navigator)`).
4. Semer les comptes directement dans `localStorage` (`rc_users`, `rc_session`), **sans passer par l'inscription Firebase**.
5. Servir avec `npx serve -p 4399` **sans** l'option `-s` (le mode SPA réécrit tout vers index.html et casse le chargement des fichiers de `vendor/`).

### Vérification syntaxique

`app/index.html` porte trois blocs `<script>`. Après chaque modification :

```bash
node -e "const fs=require('fs'),h=fs.readFileSync('app/index.html','utf8');const b=[...h.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);b.forEach((s,i)=>fs.writeFileSync('.blk'+i+'.js',s));console.log(b.length+' blocs extraits')"
for f in .blk*.js; do node --check "$f" || echo "ÉCHEC $f"; done && rm -f .blk*.js
```

---

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `app/index.html` | tout l'applicatif | modifié — analyseur, primitives d'écriture, chargeur, cadres UI |
| `app/vendor/tesseract/` | moteur de lecture auto-hébergé | créé |
| `app/vendor/LICENSE-tesseract.txt` | licence, comme `LICENSE-pdfjs.txt` | créé |
| `app/sw.js` | cache hors ligne | modifié — écriture en cache des assets, bump de version |
| `privacy.html` | politique de confidentialité | modifié — mention de la lecture locale |

L'analyseur (`_analyserCaptureStats`) est une **fonction pure** : texte en entrée, structure en sortie, aucun accès au DOM, à `currentUser` ni au réseau. C'est ce qui la rend testable sans navigateur et sans image, et c'est là que se concentre tout le risque de la fonctionnalité.

---

## Task 1 : L'analyseur de capture

Le cœur. Fonction pure, testée sur les textes réellement rendus par le moteur pour les deux captures de référence de Kevin.

**Files:**
- Modify: `app/index.html` — ajouter les fonctions près de `_recordSteps` (~l. 32950)
- Test: `app/index.html` — nouvelles assertions dans `testExercices()` (l. 37609)

**Interfaces:**
- Produces: `_analyserCaptureStats(texte)` → `{type:'pas'|'sommeil'|null, jours:[{date:'AAAA-MM-JJ', valeur:Number}], ignorees:Number}`. `valeur` est un nombre entier de pas, ou une durée en heures décimales à une décimale. `jours` est trié par date croissante, sans doublon de date.

- [ ] **Step 1 : Écrire le test qui échoue**

À insérer dans `testExercices()`, juste avant `currentUser=sauve;`. Les deux chaînes sont le texte **réellement** rendu par le moteur sur les captures de Kevin — ne pas les « nettoyer », leur désordre est le sujet du test.

```javascript
    // ── Import par capture : analyse du texte OCR — 14 cas ──
    const _capPas=`€ Pas :
1j 7j 4s Ta

“ 31 juil. — 6 août
Ja) 4 844 J
6 août » 60%
mercredi N
5 août - 25% 3 003
mardi 6 242 >
4 août » 52%
lundi N
3 août » 25% 3 096
dimanche 2 814 D
2 août * 23%
samedi
1 août - 34% 4 150 >
vendredi
31 juillet - 29% 3 546 ,`;
    const _capSom=`€ Sommeil :
{ 7j 4s Ta

“ 31 juil. — 6 août

jeudi 79 6h 35m
6 août Score Durée
mercredi 54 7h 10m
5 août Score Durée
mardi 86 8h 20m
4 août Score Durée
lundi 73 6h 4m
3 août Score Durée
dimanche 53 7h 5m
2 août Score Durée
samedi 69 6h 19m
1 août Score Durée
vendredi 78 6h 44m
31 juillet Score Durée`;
    const _aPas=_analyserCaptureStats(_capPas,new Date('2026-08-06T12:00:00'));
    const _aSom=_analyserCaptureStats(_capSom,new Date('2026-08-06T12:00:00'));

    ok('Capture de pas reconnue comme telle',_aPas.type==='pas');
    ok('Capture de sommeil reconnue comme telle',_aSom.type==='sommeil');
    ok('Sept journées de pas, pas huit',_aPas.jours.length===7,
       'lu '+_aPas.jours.length+' : l\'en-tête « 31 juil. — 6 août » a dû passer');
    ok('Sept nuits, pas huit',_aSom.jours.length===7);
    ok('Les sept totaux de pas sont exacts',
       JSON.stringify(_aPas.jours.map(j=>j.valeur))
         ===JSON.stringify([3546,4150,2814,3096,6242,3003,4844]),
       'lu '+JSON.stringify(_aPas.jours.map(j=>j.valeur)));
    ok('Les sept durées sont converties comme l\'app le fait',
       JSON.stringify(_aSom.jours.map(j=>j.valeur))
         ===JSON.stringify([6.7,6.3,7.1,6.1,8.3,7.2,6.6]),
       'lu '+JSON.stringify(_aSom.jours.map(j=>j.valeur)));
    ok('Les dates sont datées de l\'année en cours',
       _aPas.jours[6].date==='2026-08-06'&&_aPas.jours[0].date==='2026-07-31');
    ok('Un pourcentage n\'est jamais pris pour un total de pas',
       !_aPas.jours.some(j=>[60,25,52,23,34,29].includes(j.valeur)));
    ok('Un score de sommeil n\'est jamais pris pour une durée',
       !_aSom.jours.some(j=>[79,54,86,73,53,69,78].includes(j.valeur)));
    ok('Une valeur sur la ligne du dessus est bien rattachée',
       _aPas.jours.find(j=>j.date==='2026-08-06').valeur===4844);
    ok('Une valeur sur la ligne de la date est bien rattachée',
       _aPas.jours.find(j=>j.date==='2026-08-05').valeur===3003);
    ok('Une capture de janvier lue en janvier date de l\'année précédente',
       _analyserCaptureStats('mardi 8 000\n31 décembre - 50%',
         new Date('2027-01-03T12:00:00')).jours[0].date==='2026-12-31');
    ok('Une nuit de plus de 18 h est refusée',
       _analyserCaptureStats('lundi 19h 30m\n3 août Score',
         new Date('2026-08-06T12:00:00')).jours.length===0);
    ok('Un texte sans aucune date ne rend rien, sans lever',
       _analyserCaptureStats('bonjour ceci n\'est pas une capture',
         new Date('2026-08-06T12:00:00')).jours.length===0);
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Dans le bac à sable, console du navigateur : `testExercices()`
Attendu : ÉCHEC — `_analyserCaptureStats is not defined`.

- [ ] **Step 3 : Écrire l'implémentation minimale**

À insérer dans `app/index.html` juste avant `function _recordSteps(` (~l. 32950).

```javascript
// ── Import des pas et du sommeil par capture d'écran ────────────────────────
// L'analyse est VOLONTAIREMENT indépendante de la mise en page. Le texte rendu
// par la lecture des captures réelles n'est pas régulier : la valeur tombe
// tantôt sur la ligne de la date (« 5 août - 25% 3 003 »), tantôt sur celle du
// dessus (« 4 844 » puis « 6 août » 60% »). Les noms de jours sont peu fiables
// — « jeudi » ressort en « Ja) » — et les anneaux de progression laissent du
// bruit (J, N, D, >). Seule la DATE se lit de façon sûre : c'est donc elle qui
// sert d'ancre, jamais le jour de la semaine ni la position dans l'écran.
const _CAP_MOIS=['janvier','février','mars','avril','mai','juin','juillet',
  'août','septembre','octobre','novembre','décembre'];
// Comparaison sans accent ni casse : « août » et « aout » doivent tomber juste,
// et un mois abrégé (« juil. ») se résout par préfixe d'au moins trois lettres.
function _capSansAccent(s){
  // Plage des diacritiques combinants, écrite en échappements : un caractère
  // combinant collé en littéral dans le source serait invisible et fragile.
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function _capMoisVersNumero(mot){
  const m=_capSansAccent(mot).replace(/\.$/,'');
  if(m.length<3) return 0;
  for(let i=0;i<12;i++){
    if(_capSansAccent(_CAP_MOIS[i]).startsWith(m)) return i+1;
  }
  return 0;
}
// Les séparateurs de milliers vus sur les captures sont l'espace ordinaire,
// l'espace fine insécable et l'insécable. On les efface avant de lire l'entier.
function _capEntiers(ligne){
  // Les pourcentages partent AVANT la recherche : sinon « 5 août - 25% 3 003 »
  // rendrait 25, qui est un pourcentage d'objectif, pas un nombre de pas.
  const propre=String(ligne).replace(/\d+\s*%/g,' ');
  return [...propre.matchAll(/\d[\d\s]*\d|\d/g)]
    .map(m=>parseInt(m[0].replace(/\s/g,''),10))
    .filter(n=>Number.isFinite(n));
}
function _capDuree(ligne){
  const m=/(\d{1,2})\s*h\s*(\d{1,2})\s*m/i.exec(String(ligne));
  if(!m) return null;
  const mins=(+m[1])*60+(+m[2]);
  // Même plafond que calcSleepDuration : au-delà de 18 h ce n'est pas une nuit.
  if(mins<=0||mins>18*60) return null;
  // Même conversion que l'app, au dixième d'heure près.
  return Math.round(mins/6)/10;
}
function _analyserCaptureStats(texte,aujourdhui){
  const ref=aujourdhui instanceof Date?aujourdhui:new Date();
  const lignes=String(texte||'').split('\n').map(l=>l.trim());
  const type=lignes.some(l=>_capDuree(l)!=null)?'sommeil':'pas';
  const reDate=/(\d{1,2})\s*([A-Za-zÀ-ÿ]{3,})\.?/g;
  const vus={};
  let ignorees=0;
  for(let i=0;i<lignes.length;i++){
    reDate.lastIndex=0;
    let m;
    while((m=reDate.exec(lignes[i]))){
      const jour=+m[1], mois=_capMoisVersNumero(m[2]);
      if(!mois||jour<1||jour>31) continue;
      // Année absente des captures. On prend l'année en cours, et si la date
      // obtenue tombe dans le futur on recule d'un an : sans quoi tout import
      // fait début janvier serait daté d'un an en avance.
      let annee=ref.getFullYear();
      let d=new Date(annee,mois-1,jour,12,0,0);
      if(d.getTime()>ref.getTime()+864e5){ annee--; d=new Date(annee,mois-1,jour,12,0,0); }
      if(d.getMonth()!==mois-1) continue; // 31 février et consorts
      const cle=annee+'-'+String(mois).padStart(2,'0')+'-'+String(jour).padStart(2,'0');
      if(vus[cle]!=null) continue;
      // LA RÈGLE : la valeur est sur la ligne de la date, sinon sur celle du
      // dessus. Sans valeur, la date est abandonnée — c'est ce qui écarte tout
      // seul la ligne d'en-tête « 31 juil. — 6 août », qui n'en porte aucune.
      let valeur=null;
      for(const l of [lignes[i], i>0?lignes[i-1]:'']){
        if(type==='sommeil'){
          const d2=_capDuree(l);
          if(d2!=null){ valeur=d2; break; }
        }else{
          const cands=_capEntiers(l).filter(n=>n>=100&&n<=99999);
          if(cands.length){ valeur=Math.max(...cands); break; }
        }
      }
      if(valeur==null){ ignorees++; continue; }
      vus[cle]=valeur;
    }
  }
  const jours=Object.keys(vus).sort().map(k=>({date:k,valeur:vus[k]}));
  return {type:jours.length?type:null, jours, ignorees};
}
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Console du bac à sable : `testExercices()`
Attendu : les 14 nouvelles assertions au vert, et **aucune régression** sur les ~2974 existantes.

- [ ] **Step 5 : Vérifier la syntaxe puis committer**

```bash
git -c core.autocrlf=false add app/index.html
git -c core.autocrlf=false commit -m "Import par capture : l analyseur, ancre sur la date"
```

---

## Task 2 : Les primitives d'écriture

**Files:**
- Modify: `app/index.html:33132-33150` — extraire `_recordSleep` de `saveSleep()`
- Modify: `app/index.html` — ajouter `_appliquerCaptureStats` après `_analyserCaptureStats`
- Test: `app/index.html` — assertions dans `testExercices()`

**Interfaces:**
- Consumes: `_analyserCaptureStats(texte, aujourdhui)` de la Task 1 ; `_recordSteps(dateStr, count)` (existant, `app/index.html:32950`).
- Produces: `_recordSleep(dateStr, {bed, wake, duration})` → `Boolean` ; `_appliquerCaptureStats(analyse)` → `{ecrits:Number, remplaces:Number, du:'AAAA-MM-JJ'|null, au:'AAAA-MM-JJ'|null}`.

- [ ] **Step 1 : Écrire le test qui échoue**

À insérer dans `testExercices()` après les assertions de la Task 1.

```javascript
    // ── Import par capture : écriture — 6 cas ──
    currentUser.stepsLog=[]; currentUser.sleepLog=[];
    const _rApp=_appliquerCaptureStats(_analyserCaptureStats(_capPas,
      new Date('2026-08-06T12:00:00')));
    ok('Les sept journées de pas sont écrites',_rApp.ecrits===7);
    ok('Aucune journée remplacée sur un journal vide',_rApp.remplaces===0);
    ok('La plage de dates est rapportée',
       _rApp.du==='2026-07-31'&&_rApp.au==='2026-08-06');
    ok('Le total du 6 août est bien dans stepsLog',
       (currentUser.stepsLog.find(e=>e.date==='2026-08-06')||{}).count===4844);
    const _rApp2=_appliquerCaptureStats(_analyserCaptureStats(_capPas,
      new Date('2026-08-06T12:00:00')));
    ok('Un second import compte les journées comme remplacées',_rApp2.remplaces===7);
    ok('Une nuit importée n\'a ni coucher ni lever, mais une durée',
       (()=>{ currentUser.sleepLog=[];
         _appliquerCaptureStats(_analyserCaptureStats(_capSom,
           new Date('2026-08-06T12:00:00')));
         const n=currentUser.sleepLog.find(e=>e.date==='2026-08-04');
         return n&&n.duration===8.3&&!n.bed&&!n.wake; })());
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Console du bac à sable : `testExercices()`
Attendu : ÉCHEC — `_appliquerCaptureStats is not defined`.

- [ ] **Step 3 : Extraire `_recordSleep` de `saveSleep()`**

Remplacer le corps de `saveSleep()` (`app/index.html:33132`) par une version qui délègue, et poser la primitive au-dessus. La logique de rétention et d'écrasement était écrite en dur dans `saveSleep` ; l'import ne doit pas la recopier.

```javascript
// Jumelle de _recordSteps : une date, une nuit, écrasement plutôt qu'empilement.
// Extraite de saveSleep pour que l'import de capture n'ait pas à redire les
// règles de conservation. bed et wake sont facultatifs : une nuit importée d'une
// capture n'en porte pas, seule la durée est connue.
function _recordSleep(dateStr,{bed,wake,duration}={}){
  const d=Number(duration);
  if(!dateStr||!Number.isFinite(d)||d<=0||d>18) return false;
  if(!currentUser.sleepLog) currentUser.sleepLog=[];
  const entry={date:dateStr,duration:d};
  if(bed) entry.bed=bed;
  if(wake) entry.wake=wake;
  const idx=currentUser.sleepLog.findIndex(e=>e.date===dateStr);
  if(idx>=0) currentUser.sleepLog[idx]=entry;
  else currentUser.sleepLog.push(entry);
  const cutoff=localISODate(new Date(Date.now()-180*24*3600*1000));
  currentUser.sleepLog=currentUser.sleepLog.filter(e=>e.date>=cutoff);
  return true;
}
```

Puis, dans `saveSleep()`, remplacer le bloc allant de `if(!currentUser.sleepLog) currentUser.sleepLog=[];` jusqu'à la ligne `currentUser.sleepLog=currentUser.sleepLog.filter(e=>e.date>=cutoff);` incluse par :

```javascript
  if(!_recordSleep(jour,{bed,wake,duration})) return toast('Nuit invalide','var(--orange)');
```

- [ ] **Step 4 : Écrire `_appliquerCaptureStats`**

À placer juste après `_analyserCaptureStats`.

```javascript
// Écrit sans écran de validation — décision de Kevin, actée dans la spec. La
// sûreté ne vient donc pas d'une relecture par l'athlète mais du REJET : les
// valeurs impossibles sont refusées par _recordSteps / _recordSleep eux-mêmes,
// et le compte des journées remplacées ressort dans le toast pour qu'un
// écrasement ne soit jamais muet.
function _appliquerCaptureStats(analyse){
  const res={ecrits:0,remplaces:0,du:null,au:null};
  if(!analyse||!analyse.jours||!analyse.jours.length) return res;
  const aujourd=localISODate(new Date());
  for(const j of analyse.jours){
    if(j.date>aujourd) continue; // une capture ne renseigne jamais le futur
    const avant=analyse.type==='sommeil'
      ? (currentUser.sleepLog||[]).some(e=>e.date===j.date)
      : (currentUser.stepsLog||[]).some(e=>e.date===j.date);
    const ok=analyse.type==='sommeil'
      ? _recordSleep(j.date,{duration:j.valeur})
      : _recordSteps(j.date,j.valeur);
    if(!ok) continue;
    res.ecrits++;
    if(avant) res.remplaces++;
    if(!res.du||j.date<res.du) res.du=j.date;
    if(!res.au||j.date>res.au) res.au=j.date;
  }
  return res;
}
```

- [ ] **Step 5 : Lancer le test pour vérifier qu'il passe**

Console du bac à sable : `testExercices()`
Attendu : les 6 nouvelles assertions au vert. Vérifier en particulier qu'aucune assertion existante sur le sommeil n'est tombée — `saveSleep` vient d'être remaniée.

- [ ] **Step 6 : Vérifier la syntaxe puis committer**

```bash
git -c core.autocrlf=false add app/index.html
git -c core.autocrlf=false commit -m "Import par capture : ecriture, et _recordSleep extraite de saveSleep"
```

---

## Task 3 : Le lecteur embarqué et sa mise en cache

**Files:**
- Create: `app/vendor/tesseract/tesseract.min.js`, `worker.min.js`, `tesseract-core-simd-lstm.wasm`, `tesseract-core-lstm.wasm`, `fra.traineddata`
- Create: `app/vendor/LICENSE-tesseract.txt`
- Modify: `app/sw.js:163-165` — écrire en cache les assets same-origin
- Modify: `app/sw.js:1` — bump `CACHE`
- Modify: `app/index.html` — `_chargerLecteurTexte()` et `_lireCaptureStats(dataUrl)`

**Interfaces:**
- Produces: `async _lireCaptureStats(dataUrl)` → `String` (texte brut). Lève une exception à message lisible si le moteur ne peut pas se charger.

- [ ] **Step 1 : Copier les fichiers du moteur dans le dépôt**

```bash
mkdir -p app/vendor/tesseract && cd /tmp && npm i tesseract.js
cp node_modules/tesseract.js/dist/tesseract.min.js /c/Users/kevin/Downloads/RepCore-web/app/vendor/tesseract/
cp node_modules/tesseract.js/dist/worker.min.js /c/Users/kevin/Downloads/RepCore-web/app/vendor/tesseract/
cp node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm /c/Users/kevin/Downloads/RepCore-web/app/vendor/tesseract/
cp node_modules/tesseract.js-core/tesseract-core-lstm.wasm /c/Users/kevin/Downloads/RepCore-web/app/vendor/tesseract/
cp node_modules/tesseract.js/LICENSE /c/Users/kevin/Downloads/RepCore-web/app/vendor/LICENSE-tesseract.txt
```

`fra.traineddata` (1,19 Mo) **n'est pas dans le paquet npm** : Tesseract le télécharge depuis un CDN au premier usage. Il doit donc être rapatrié dans le dépôt, sans quoi la fonctionnalité appellerait un tiers — ce que le projet interdit, et ce qui ferait sortir la capture du téléphone.

Il a déjà été téléchargé pendant la vérification de faisabilité :

```bash
cp "/c/Users/kevin/AppData/Local/Temp/claude/C--Users-kevin-Downloads/bee7fb93-b41b-435d-ae14-983ee73d8640/scratchpad/ocrtest/fra.traineddata" app/vendor/tesseract/
```

S'il a été purgé, le reprendre depuis le dépôt `tesseract-ocr/tessdata_fast` (variante *fast*, la seule à 1,19 Mo ; *best* pèse une quinzaine de Mo pour un gain nul sur des chiffres nets).

Vérifier ensuite la présence des cinq fichiers et leur poids :

```bash
ls -l app/vendor/tesseract/ && du -sh app/vendor/tesseract/
```

Attendu : `tesseract.min.js` ≈ 61 Ko, `worker.min.js` ≈ 109 Ko, les deux `.wasm` ≈ 2,8 Mo chacun, `fra.traineddata` ≈ 1,2 Mo — total de l'ordre de 7 Mo.

Vérifier ensuite qu'aucun fichier ne dépasse 100 Mo et que le total ajouté est bien de l'ordre de 7 Mo (deux variantes wasm + données de langue).

- [ ] **Step 2 : Corriger l'écriture en cache du Service Worker**

`app/sw.js:163-165` lit le cache mais n'y écrit jamais. Le commentaire de `app/sw.js:17` affirme pourtant que `pdf.min.js` « rejoint le cache par le handler fetch ». C'est faux aujourd'hui, et sans ce correctif les ~7 Mo du moteur seraient retéléchargés à chaque import et ne marcheraient jamais hors ligne.

Remplacer :

```javascript
  // Assets same-origin : cache-first, sans fallback HTML (évite de servir HTML à la place d'un asset)
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
```

par :

```javascript
  // Assets same-origin : cache-first, sans fallback HTML (évite de servir HTML
  // a la place d un asset). La reponse reseau REJOINT le cache — sans ce put,
  // vendor/pdf.min.js et le moteur de lecture etaient retelecharges a chaque
  // usage et ne fonctionnaient jamais hors ligne, contrairement a ce que le
  // commentaire d ASSETS affirmait.
  e.respondWith((async () => {
    const enCache = await caches.match(e.request);
    if (enCache) return enCache;
    const r = await fetch(e.request);
    // Mise en cache DETACHEE de la reponse servie, comme pour index.html : un
    // quota sature ne doit pas casser un affichage qui fonctionne. Seules les
    // reponses completes et valides sont conservees.
    if (r && r.ok && r.status === 200) {
      const clone = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone))
        .catch(err => console.warn('[RepCore SW] put asset:', err));
    }
    return r;
  })());
```

Corriger aussi le commentaire de `app/sw.js:17` s'il reste trompeur, et bumper `CACHE` en `repcore-v475`.

- [ ] **Step 3 : Écrire le chargeur paresseux**

À placer avant `_analyserCaptureStats` dans `app/index.html`.

```javascript
// Le moteur pèse environ 7 Mo. Il n'est chargé QUE lorsqu'un athlète envoie une
// capture : le charger au démarrage ferait payer ce poids à tous ceux qui ne
// s'en serviront jamais. Une fois chargé, le Service Worker le garde en cache.
let _lecteurTexte=null, _lecteurTextePromesse=null;
const _TESS='./vendor/tesseract/';
function _chargerScript(src){
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=src; s.onload=resolve;
    s.onerror=()=>reject(new Error('Chargement impossible : '+src));
    document.head.appendChild(s);
  });
}
async function _chargerLecteurTexte(){
  if(_lecteurTexte) return _lecteurTexte;
  if(_lecteurTextePromesse) return _lecteurTextePromesse;
  _lecteurTextePromesse=(async()=>{
    if(!window.Tesseract) await _chargerScript(_TESS+'tesseract.min.js');
    // Tous les chemins sont LOCAUX. Sans ces trois options, Tesseract va
    // chercher son cœur et ses données de langue sur un CDN — ce que le projet
    // a banni, et ce qui ferait sortir la capture du téléphone.
    _lecteurTexte=await window.Tesseract.createWorker('fra',1,{
      workerPath:_TESS+'worker.min.js',
      corePath:_TESS,
      langPath:_TESS,
    });
    return _lecteurTexte;
  })();
  return _lecteurTextePromesse;
}
async function _lireCaptureStats(dataUrl){
  const w=await _chargerLecteurTexte();
  const {data}=await w.recognize(dataUrl);
  return (data&&data.text)||'';
}
```

- [ ] **Step 4 : Vérifier en direct dans le bac à sable**

Dans la console du bac à sable, avec la capture de Kevin convertie en data URL :

```javascript
const t = await _lireCaptureStats(dataUrlDeLaCapture);
console.log(_analyserCaptureStats(t));
```

Attendu : `type:'pas'`, 7 journées, valeurs `[3546,4150,2814,3096,6242,3003,4844]`.
Vérifier ensuite `window.__RC_BLOCKED__` : il doit être **vide**. Toute entrée signifierait qu'un appel réseau tiers est parti — échec de la tâche, à corriger avant de continuer.

Vérifier enfin dans l'onglet Réseau qu'aucune requête ne sort vers un domaine autre que celui du bac à sable.

- [ ] **Step 5 : Committer**

```bash
git -c core.autocrlf=false add app/vendor app/sw.js app/index.html
git -c core.autocrlf=false commit -m "Import par capture : lecteur embarque, et le SW ecrit enfin les assets en cache"
```

---

## Task 4 : Le cadre dans les deux pages

**Files:**
- Modify: `app/index.html:30495` — fin de `loadSteps()`
- Modify: `app/index.html:33131` — fin de `loadSleep()`
- Modify: `app/index.html` — `_htmlCadreImportCapture()` et `importerCaptureStats(input)`

**Interfaces:**
- Consumes: `_lireCaptureStats`, `_analyserCaptureStats`, `_appliquerCaptureStats`, `saveUser()`, `toastEcriture()`, `_rerenderLifestyle()`.

- [ ] **Step 1 : Écrire le cadre et son gestionnaire**

À placer après `_appliquerCaptureStats`.

```javascript
// Cadre commun aux deux pages. Le même bloc accepte les deux types de capture :
// la nature est déduite du contenu, pas de la page d'où il est ouvert.
function _htmlCadreImportCapture(){
  return `
    <div style="background:linear-gradient(180deg,var(--surface-1),var(--dark));border:1px solid var(--surface-2);border-radius:14px;padding:16px;margin-bottom:14px;animation:fadeInUp .5s ease">
      <div style="font-family:'Bebas Neue','Arial Narrow',Impact,sans-serif;font-size:15px;letter-spacing:2.5px;color:#8a8a8a;text-transform:uppercase;margin-bottom:9px">Pas noté tes stats ?</div>
      <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.55;margin-bottom:11px">
        Envoie la capture d'écran de ton application de montre (pas ou sommeil, vue 7 jours de préférence) : les chiffres sont lus et remplis automatiquement.
        <b style="color:#8a8a8a">La capture est lue sur ton téléphone. Elle n'est ni envoyée ni conservée.</b>
      </div>
      <input type="file" accept="image/*" id="cap-import-input" style="display:none" onchange="importerCaptureStats(this)">
      <button id="cap-import-btn" onclick="document.getElementById('cap-import-input').click()" style="width:100%;padding:13px;background:linear-gradient(180deg,#131313,#0c0c0c);border:1px solid #2a2a2a;color:#c9c9c9;border-radius:9px;font-family:Montserrat,sans-serif;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;cursor:pointer">Envoyer une capture</button>
    </div>`;
}
async function importerCaptureStats(input){
  const f=input&&input.files&&input.files[0];
  input.value='';
  if(!f) return;
  const btn=document.getElementById('cap-import-btn');
  const libelle=btn?btn.textContent:'';
  // La première lecture télécharge le moteur : sans ce retour visuel, l'athlète
  // croit que rien ne se passe et renvoie sa capture.
  if(btn){ btn.disabled=true; btn.textContent='Lecture en cours…'; }
  try{
    const dataUrl=await new Promise((res,rej)=>{
      const r=new FileReader();
      r.onload=()=>res(r.result);
      r.onerror=()=>rej(new Error('Image illisible'));
      r.readAsDataURL(f);
    });
    const texte=await _lireCaptureStats(dataUrl);
    const analyse=_analyserCaptureStats(texte,new Date());
    if(!analyse.jours.length){
      return toast('Je n\'ai rien pu lire sur cette image. Essaie la vue 7 jours de ton application de montre.','var(--orange)');
    }
    const r=_appliquerCaptureStats(analyse);
    if(!r.ecrits) return toast('Rien à enregistrer sur cette capture.','var(--orange)');
    const quoi=analyse.type==='sommeil'?'nuit':'journée';
    const fmt=d=>new Date(d+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
    const plage=r.du===r.au?fmt(r.du):fmt(r.du)+' → '+fmt(r.au);
    const remplacees=r.remplaces?', dont '+r.remplaces+' remplacée'+(r.remplaces>1?'s':''):'';
    toastEcriture(saveUser(),
      r.ecrits+' '+quoi+(r.ecrits>1?'s':'')+' ('+plage+')'+remplacees,'tes stats sont');
    _rerenderLifestyle();
  }catch(err){
    toast(err&&err.message?err.message:'Lecture impossible','var(--orange)');
  }finally{
    if(btn){ btn.disabled=false; btn.textContent=libelle; }
  }
}
```

- [ ] **Step 2 : Brancher le cadre dans les deux pages**

Dans `loadSteps()` et dans `loadSleep()`, insérer `${_htmlCadreImportCapture()}` **en dernier bloc** du gabarit, juste avant la fermeture du littéral de gabarit — le cadre doit venir en bas de la page, après l'historique, comme Kevin l'a demandé.

- [ ] **Step 3 : Vérifier le parcours complet dans le bac à sable**

Depuis l'interface réelle, pas depuis la console : ouvrir la page Pas, cliquer « Envoyer une capture », choisir la capture de pas de Kevin.
Attendu : bouton qui passe à « Lecture en cours… », puis un toast « 7 journées (31 juil. → 6 août) », puis l'histogramme de la semaine qui se remplit.
Recommencer avec la même capture : le toast doit indiquer « dont 7 remplacées ».
Recommencer sur la page Sommeil avec la capture de sommeil.
Vérifier `window.__RC_BLOCKED__` : vide.

- [ ] **Step 4 : Committer**

```bash
git -c core.autocrlf=false add app/index.html
git -c core.autocrlf=false commit -m "Import par capture : le cadre en bas des pages Pas et Sommeil"
```

---

## Task 5 : La confidentialité, écrite noir sur blanc

**Files:**
- Modify: `privacy.html`
- Modify: `app/sw.js:1` — bump `CACHE` en `repcore-v476`

- [ ] **Step 1 : Ajouter la mention dans `privacy.html`**

La fonctionnalité **n'ajoute aucun sous-traitant** : rien ne doit donc entrer dans le tableau de la section 5, et la phrase « Aucun autre service tiers n'est contacté par l'application » (`privacy.html:250`) reste vraie telle quelle — vérifier qu'elle n'a pas besoin d'être amendée.

En revanche l'absence de transmission ne se devine pas : un lecteur qui voit « import de capture » supposera l'inverse. Ajouter une carte **juste après** celle intitulée « Stockage local (localStorage) » (`privacy.html:252-255`), en reprenant exactement son format :

```html
  <div class="card">
    <div class="card-title">Lecture des captures d'écran (sur votre appareil)</div>
    <p style="margin:0;font-size:13px">Vous pouvez remplir vos pas et vos nuits en envoyant une capture d'écran de votre application de montre. L'image est analysée <strong>directement sur votre appareil</strong> : elle n'est transmise à aucun service tiers, et elle n'est jamais enregistrée — ni sur votre appareil, ni dans votre dossier. Seules les valeurs lues (nombre de pas, durée de sommeil) et leur date sont conservées, exactement comme si vous les aviez saisies à la main.</p>
  </div>
```

- [ ] **Step 2 : Vérifier**

Ouvrir `privacy.html` dans le bac à sable, relire la section, vérifier la cohérence avec les autres entrées (ton, format, niveau de détail).

- [ ] **Step 3 : Committer**

```bash
git -c core.autocrlf=false add privacy.html app/sw.js
git -c core.autocrlf=false commit -m "Import par capture : la politique de confidentialite dit que rien ne sort"
```

---

## Fin de lot

- [ ] Lancer `testExercices()` une dernière fois dans le bac à sable : les ~2974 assertions existantes **plus** les 20 nouvelles, toutes au vert.
- [ ] Lancer `await testNotifs()` : 62 assertions, aucune régression.
- [ ] Vérification syntaxique des trois blocs `<script>` (commande en tête de plan).
- [ ] Vérifier une dernière fois qu'aucune requête tierce ne part : `window.__RC_BLOCKED__` vide après un parcours complet.
- [ ] **Ne pas fusionner dans `main` sans l'accord de Kevin.** La mise en ligne de la diète et du canal attend une reconstruction GitHub Pages ; `main` doit rester dans l'état qu'il veut publier.
