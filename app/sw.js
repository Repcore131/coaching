const CACHE = 'repcore-v903';
const SW_DATA = 'repcore-sw-data'; // persistent across updates — not wiped by activate

// DÉLAI DE GARDE sur index.html. Le handler était en network-first avec un
// simple .catch() : celui-ci ne joue que sur ÉCHEC, jamais sur LENTEUR. En
// « lie-fi » — un réseau qui répond au DNS et ne transporte rien — la promesse
// ne rejette pas, elle PEND, et l'athlète en sous-sol regarde un écran blanc
// aussi longtemps que le navigateur tolère la requête.
const SW_DELAI_RESEAU_MS = 2500;

// index.html EST dans ASSETS depuis ce lot. Sans lui, la copie hors-ligne ne
// se constituait qu'au premier passage réussi du handler fetch, et activate la
// détruisait à chaque déploiement.
// vendor/qr.js et les deux polices : rapatries pour supprimer trois tiers.
// Ils entrent dans ASSETS car ils sont demandes au PREMIER affichage — une
// police absente donne un texte de repli, un encodeur absent donne un QR
// absent. pdf.min.js et le moteur de lecture des captures, eux, sont charges
// dynamiquement : ils rejoignent le cache par le handler fetch au premier
// usage, et y restent pour le suivant, hors ligne compris. Cela n a ete VRAI
// qu a partir du lot qui a ajoute le put dans la branche generique du handler :
// avant lui, celle-ci lisait le cache sans jamais l alimenter.
// Le temps que le report de cache a le droit de prendre dans activate, qui
// retient la prise de contrôle. Au-delà, on laisse le reste au handler fetch.
const REPORT_BUDGET_MS = 1000;
const ASSETS = ['./index.html', './manifest.json', './icons/icon-192x192.png',
  './vendor/qr.js', './fonts/montserrat-var-latin.woff2',
  './fonts/bebasneue-400-latin.woff2'];

// Une séance en cours interdit la bascule. Prendre le contrôle en pleine
// séance, c'est purger le cache sous les pieds de quelqu'un qui est peut-être
// hors ligne.
//
// L'ÉTAT VIT DANS LE CACHE PARTAGÉ, ET NON DANS UNE VARIABLE DE MODULE.
//
// Une variable appartient au worker qui l'a déclarée. Le client levait le
// drapeau en postant au worker ACTIF, alors que le handler `install` du worker
// EN COURS D'INSTALLATION lisait SA copie, restée à false : skipWaiting()
// partait à chaque fois, et le garde-fou n'a jamais rien gardé.
//
// repcore-sw-data est le seul support que les deux workers voient. Il survit
// aux mises à jour, et activate l'épargne explicitement.
const SEANCE_CLE = '/seance-en-cours';
// QUATRE HEURES. Un drapeau plus vieux décrit une séance jamais terminée —
// l'app fermée en plein milieu, le téléphone éteint. Le respecter
// indéfiniment bloquerait TOUTES les mises à jour, pour toujours ; l'ignorer
// ramène ce cas-là au comportement d'avant, qui n'était pas pire.
const SEANCE_PEREMPTION_MS = 4 * 3600 * 1000;
// `_attenteFinSeance`, LUI, reste une variable de module — et c'est correct :
// il décrit ce que CE worker-ci a décidé de retenir, pas un état du monde.
let _attenteFinSeance = false;
async function seanceActive() {
  const s = await swGet(SEANCE_CLE);
  const d = s && Number(s.depuis);
  if (!d) return false;
  return (Date.now() - d) < SEANCE_PEREMPTION_MS;
}

self.addEventListener('install', e => {
  // TOUT est dans le waitUntil, y compris la décision de basculer : la lecture
  // de l'état est asynchrone, et une décision prise hors du waitUntil serait
  // prise avant que la réponse n'arrive.
  e.waitUntil((async () => {
    // allSettled et non addAll : un asset manquant ou en erreur ne doit plus
    // faire échouer toute l'installation du Service Worker.
    try {
      const c = await caches.open(CACHE);
      await Promise.allSettled(ASSETS.map(a => c.add(a)));
    } catch (err) {}
    // Sans séance en cours, comportement inchangé : la mise à jour est
    // immédiate. Avec, on retient la bascule jusqu'à SEANCE_TERMINEE.
    if (await seanceActive()) _attenteFinSeance = true;
    else self.skipWaiting();
  })());
});

// Préchargement différé et non bloquant de la base alimentaire (672 Ko).
// index.html poste ce message au premier affichage de l'écran nutrition :
// la recherche d'aliment fonctionne alors hors-ligne aux visites suivantes,
// sans peser sur le tout premier chargement de l'app.
const CIQUAL_URL = './data/ciqual.json';
let _ciqualPrefetch = null;
self.addEventListener('message', e => {
  // Séance en cours : on retient la bascule. À la fin, si CE worker attendait,
  // il prend la main immédiatement — l'utilisateur n'a rien à faire.
  //
  // L'écriture passe par le cache partagé, jamais par une variable : c'est là
  // que le prochain `install` viendra lire. La page écrit la même clé de son
  // côté ; les deux chemins mènent au même endroit, ce qui est tout le point.
  if (e.data?.type === 'SEANCE_EN_COURS') {
    e.waitUntil(swSet(SEANCE_CLE, { depuis: Date.now() }));
    return;
  }
  if (e.data?.type === 'SEANCE_TERMINEE') {
    e.waitUntil((async () => {
      await swSet(SEANCE_CLE, null);
      if (_attenteFinSeance) { _attenteFinSeance = false; self.skipWaiting(); }
      // Le worker ACTIF, lui, n'a rien retenu : c'est update() qui redemande
      // au navigateur d'aller chercher sw.js, donc de relancer un `install`
      // qui, cette fois, ne verra plus de séance. Sans lui, la bascule
      // retenue attendait la fermeture de tous les onglets.
      try { await self.registration.update(); } catch (err) {}
    })());
    return;
  }
  if (e.data?.type !== 'PREFETCH_CIQUAL') return;
  if (_ciqualPrefetch) return;            // une seule tentative par cycle de vie du SW
  _ciqualPrefetch = caches.open(CACHE)
    .then(async c => {
      if (await c.match(CIQUAL_URL)) return;   // déjà en cache : rien à faire
      await c.add(CIQUAL_URL);
    })
    .catch(() => { _ciqualPrefetch = null; }); // échec (hors ligne) : réessayable
});

// ACTIVATION. L'ancienne version supprimait TOUT cache dont le nom différait,
// sans regarder ce que le nouveau contenait. Or activate s'exécute avant que
// le nouveau cache porte autre chose que les ASSETS : chaque déploiement
// détruisait la copie hors-ligne d'index.html ET les 852 Ko de Ciqual, que
// rien ne remplaçait tant que l'utilisateur n'avait pas rouvert l'écran
// nutrition EN LIGNE.
//
// Deux changements : on RECOPIE Ciqual de l'ancien cache vers le nouveau
// (852 Ko économisés par déploiement, et il survit hors ligne), et on ne
// supprime un ancien cache QUE si le nouveau porte bien index.html. Sinon on
// le garde un cycle de plus : un cache de trop coûte de la place, un cache
// manquant coûte l'application.
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    try {
      const neuf = await caches.open(CACHE);
      const cles = await caches.keys();
      const anciens = cles.filter(k => k !== CACHE && k !== SW_DATA);
      // 1. REPORT GENERAL. Deux entrées seulement étaient reportées, et tout le
      //    reste du cache hors ligne partait à la purge : pdf.min.js, le moteur
      //    de reconnaissance et ses données, zxing, et les 407 illustrations
      //    d'exercices déjà vues. Le commentaire d'ASSETS affirme pourtant que
      //    ces fichiers restent « pour le suivant, hors ligne compris ».
      //
      //    DU PLUS RÉCENT AU PLUS ANCIEN, première occurrence gagnante : quand
      //    plusieurs anciens caches ont survécu, le plus récent porte la version
      //    la plus juste.
      //
      //    ON NE REMPLACE JAMAIS ce que le nouveau cache porte déjà : ASSETS
      //    vient d'être téléchargé, il fait foi.
      //
      //    BUDGET DE TEMPS. activate retient la prise de contrôle : recopier
      //    15 Mo sur un téléphone lent ne doit pas la bloquer. On trie par
      //    valeur — vendor/ et exercices/ sont les plus coûteux à retélécharger
      //    — et on s'arrête quand le budget est épuisé. Ce qui reste sera repris
      //    par le handler fetch au premier usage, exactement comme avant.
      const _t0 = Date.now();
      let _reportes = 0, _sautes = 0, _octets = 0, _inconnus = 0;
      // La taille se lit dans l'en-tête, jamais en relisant le corps :
      // relire 15 Mo pour les mesurer coûterait le budget qu'on tient.
      const _taille = r => {
        try { return Number(r.headers.get('content-length')) || 0; }
        catch (err) { return 0; }
      };
      const _lisible = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' Mo'
        : n >= 1024 ? Math.round(n / 1024) + ' Ko' : n + ' o';
      const _prioritaire = u => /\/vendor\/|\/exercices\//.test(u);
      // index.html est traité juste en dessous, en réseau-d'abord ; tests.js ne
      // doit JAMAIS être mis en cache d'office — il n'est pas dans ASSETS pour
      // cette raison, et le reporter le remettrait par la porte de derrière.
      //
      // sw.js NON PLUS. versionSW() le lit pour afficher la version du cache ;
      // le transporter d'une version à l'autre lui faisait annoncer la
      // PRÉCÉDENTE. C'est aussi le seul fichier dont une copie périmée se
      // recopierait indéfiniment : chaque report la reconduirait.
      const _exclu = u => /\/index\.html$/.test(u) || /\/tests\.js$/.test(u)
        || /\/sw\.js$/.test(u);
      // LA BASE ALIMENTAIRE D'ABORD, ET HORS BUDGET. Elle n'entre dans le
      // cache que par un prefetch explicite, et le report ne la connaissait
      // pas : elle passait après vendor/ et les 407 illustrations, donc
      // souvent jamais. À chaque mise à jour la recherche d'aliment
      // redevenait indisponible hors ligne et 672 Ko repartaient sur le
      // réseau. C'est une entrée unique et connue : la faire concourir dans
      // un tri ne garantirait rien.
      //
      // put/clone, jamais add : add irait la rechercher sur le réseau.
      // `_ciqual` dit qu'elle a été REPORTÉE, pas qu'elle avait une taille
      // connue : une entrée sans content-length est reportée quand même, et le
      // journal doit le dire.
      let _ciqual = false;
      if (!(await neuf.match(CIQUAL_URL))) {
        for (let i = anciens.length - 1; i >= 0; i--) {
          try {
            const vieux = await caches.open(anciens[i]);
            const r = await vieux.match(CIQUAL_URL);
            if (r) {
              await neuf.put(CIQUAL_URL, r.clone());
              _ciqual = true; _reportes++;
              const _n = _taille(r);
              if (_n) _octets += _n; else _inconnus++;
              break;
            }
          } catch (err) {}
        }
      }
      for (let i = anciens.length - 1; i >= 0; i--) {
        try {
          const vieux = await caches.open(anciens[i]);
          const req = await vieux.keys();
          const tri = req.slice().sort((a, b) =>
            (_prioritaire(b.url) ? 1 : 0) - (_prioritaire(a.url) ? 1 : 0));
          for (const rq of tri) {
            if (_exclu(rq.url)) continue;
            if (Date.now() - _t0 > REPORT_BUDGET_MS) { _sautes++; continue; }
            try {
              if (await neuf.match(rq)) continue;
              const r = await vieux.match(rq);
              if (r) {
                await neuf.put(rq, r.clone()); _reportes++;
                const _n = _taille(r);
                if (_n) _octets += _n; else _inconnus++;
              }
            } catch (err) {}
          }
        } catch (err) {}
      }
      // ON DIT CE QU'ON N'A PAS FAIT. Un report tronqué en silence se lirait
      // comme un cache complet, et la prochaine ouverture hors ligne serait une
      // surprise.
      console.log('[RepCore SW] report cache :', _reportes, 'entrées,',
        _lisible(_octets) + (_inconnus ? ' (+ ' + _inconnus + ' sans taille connue)' : ''),
        'en ' + (Date.now() - _t0) + ' ms'
        + (_sautes ? ', ' + _sautes + ' hors budget' : '')
        + (_ciqual ? ', base alimentaire comprise' : ''));
      // 2. Report d'index.html si ASSETS a échoué (hors ligne à l'install).
      if (!(await neuf.match('./index.html'))) {
        for (const k of anciens) {
          try {
            const vieux = await caches.open(k);
            const r = await vieux.match('./index.html');
            if (r) { await neuf.put('./index.html', r.clone()); break; }
          } catch (err) {}
        }
      }
      // 3. Purge SOUS CONDITION. Le nouveau cache doit être utilisable.
      if (await neuf.match('./index.html')) {
        await Promise.all(anciens.map(k => caches.delete(k)));
      } else {
        console.warn('[RepCore SW] index.html absent du cache', CACHE,
          '— anciens caches conservés un cycle de plus');
      }
    } catch (err) { console.error('[RepCore SW] activate:', err); }
  })());
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Ne jamais intercepter les requêtes cross-origin (Firebase, Cloud Functions, Realtime DB…)
  // Sinon le SW renverrait index.html (HTML) en fallback offline, ce qui fait planter
  // tout appel fetch() qui attend du JSON — notamment generateAccessToken.
  if (!url.startsWith(self.location.origin)) return;
  // index.html : network-first AVEC DÉLAI DE GARDE. Toujours pas cache-first —
  // la mise à jour doit rester rapide — mais le réseau ne peut plus retenir
  // l'affichage au-delà de SW_DELAI_RESEAU_MS quand une copie existe.
  if (url.includes('index.html') || url.endsWith('/') || url.endsWith('/coaching/')) {
    e.respondWith((async () => {
      const reseau = fetch(e.request).then(r => {
        // La mise en cache est DÉTACHÉE de la réponse servie : si le quota
        // est saturé, on journalise et on sert quand même. Un put qui échoue
        // ne doit pas casser un affichage qui, lui, fonctionne.
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put('./index.html', clone))
          .catch(err => console.warn('[RepCore SW] put index.html:', err));
        return r;
      });
      const enCache = await caches.match('./index.html');
      // Aucune copie : on attend le réseau, quel que soit le temps. Servir
      // une page blanche plus vite n'est pas un progrès. Si le réseau échoue
      // AUSSI, le rejet remonte et le navigateur affiche son écran d'erreur —
      // explicite, et jamais une page vide.
      if (!enCache) return reseau;
      // Course. Le perdant n'est pas annulé : la réponse réseau arrivée après
      // le délai met le cache à jour pour le lancement suivant, sans remplacer
      // l'écran déjà affiché.
      const attente = new Promise(resolve => setTimeout(() => {
        // En-tête ajouté à la COPIE servie : le SW ne peut pas toucher au DOM,
        // c'est le client qui lit cet en-tête et pose la pastille.
        const h = new Headers(enCache.headers);
        h.set('X-RepCore-Cache', '1');
        resolve(enCache.blob().then(b => new Response(b, {
          status: enCache.status, statusText: enCache.statusText, headers: h
        })));
      }, SW_DELAI_RESEAU_MS));
      return Promise.race([reseau.catch(() => attente), attente]);
    })());
    return;
  }
  // sw.js : ON NE S'EN MÊLE PAS. versionSW() le lit avec {cache:'no-store'},
  // mais no-store ne parle qu'au cache HTTP — le service worker interceptait
  // quand même, et sa branche générique, cache-first, servait la copie de la
  // version PRÉCÉDENTE. L'écran de synchronisation annonçait donc une version
  // périmée. Et le put générique l'y remettait au premier passage, d'où le
  // report la reconduisait de version en version.
  //
  // Ni lecture ni écriture : on rend la main au navigateur, qui sait gérer le
  // script d'un service worker mieux que nous.
  if (/\/sw\.js$/.test(url.split('?')[0])) return;
  // Assets same-origin : cache-first, sans fallback HTML (évite de servir HTML
  // a la place d un asset). La reponse reseau REJOINT desormais le cache : sans
  // ce put, la branche lisait le cache sans jamais l alimenter, et vendor/
  // pdf.min.js etait retelecharge a CHAQUE ouverture de PDF sans jamais
  // fonctionner hors ligne — contrairement a ce que le commentaire d ASSETS
  // affirmait. Meme cause pour le moteur de lecture des captures.
  e.respondWith((async () => {
    const enCache = await caches.match(e.request);
    if (enCache) return enCache;
    const r = await fetch(e.request);
    // Mise en cache DETACHEE de la reponse servie, comme pour index.html : un
    // quota sature ne doit pas casser un affichage qui fonctionne. Seules les
    // reponses completes et valides sont conservees — une 404 ou une reponse
    // partielle en cache serait pire que pas de cache du tout.
    if (r && r.ok && r.status === 200) {
      const clone = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone))
        .catch(err => console.warn('[RepCore SW] put asset:', err));
    }
    return r;
  })());
});

// ─── SW data store (Cache API key/value, survives SW updates) ───────────────
async function swGet(key) {
  try {
    const c = await caches.open(SW_DATA);
    const r = await c.match(key);
    return r ? r.json() : null;
  } catch(e) { return null; }
}
async function swSet(key, val) {
  try {
    const c = await caches.open(SW_DATA);
    await c.put(key, new Response(JSON.stringify(val), { headers: { 'Content-Type': 'application/json' } }));
  } catch(e) {}
}

// ─── Periodic background sync — fires even when app is closed (Chrome/Android) ─
self.addEventListener('periodicsync', e => {
  if (e.tag === 'bilan-reminder') e.waitUntil(swCheckAndNotify());
  if (e.tag === 'wo-reminder') e.waitUntil(swCheckWoReminder());
  if (e.tag === 'supp-reminder') e.waitUntil(swCheckSuppReminders());
});

// Jour LOCAL au format AAAA-MM-JJ. toISOString() rend une date UTC : a
// 00 h 30 en France l'ete, elle designe encore la veille, et la cle de
// deduplication d'une notification changeait donc a 2 h du matin au lieu de
// minuit. L'application, elle, a toujours raisonne en date locale.
function _jourLocal(d) {
  const x = d || new Date();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const j = String(x.getDate()).padStart(2, '0');
  return x.getFullYear() + '-' + m + '-' + j;
}

// Compléments : les dix créneaux restent, ils disent QUAND chaque produit est
// dû. Mais l'émission est regroupée en trois moments. Dix notifications par
// jour, c'est un produit qu'on finit par couper — et couper les
// notifications, c'est aussi couper les deux rappels qui comptent.
const SUPP_GROUPES = [
  { cle: 'matin', heure: 8,  timings: ['jeun', 'matin', 'toutes-4h'] },
  { cle: 'jour',  heure: 13, timings: ['midi', 'apres-midi', 'avant-entrainement', 'intra', 'apres-entrainement'] },
  { cle: 'soir',  heure: 20, timings: ['soir', 'coucher'] }
];
// Fréquence de bilan, en semaines. Bornée : une valeur aberrante venue d'un
// cache corrompu ne doit pas espacer les rappels de 99 semaines.
function _freqBilan(sched) {
  const n = Number(sched && sched.freqSemaines);
  return (n === 1 || n === 2) ? n : 2;
}

async function swCheckAndNotify() {
  const sched = await swGet('/bilan-schedule');
  if (!sched?.nextDate) return;
  if (Date.now() < sched.nextDate) return;
  const today = _jourLocal();
  if (await swGet('/bilan-last-notif') === today) return;
  await swSet('/bilan-last-notif', today);
  // Advance schedule by 14 days for the next cycle
  // Avance paramétrée par la fréquence CHOISIE par l'athlète. Le repli sur 2
  // est obligatoire : les caches écrits par les versions antérieures ne
  // portent pas ce champ.
  const _fq = _freqBilan(sched);
  await swSet('/bilan-schedule', { ...sched, nextDate: sched.nextDate + _fq * 7 * 24 * 3600 * 1000 });
  await self.registration.showNotification(_fq === 1 ? 'Bilan de la semaine' : 'Bilan de quinzaine', {
    body: (sched.fname || '') + ', 10 min quand tu as le temps ce week-end.',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-192x192.png',
    tag: 'bilan-reminder',
    // Une notification qui reste collée jusqu'au clic pour un rappel de bilan
    // est disproportionnée : elle se subit, elle ne se lit pas.
    requireInteraction: false,
    data: { url: './?bilan=1' }
  });
}

// ─── Notification click → open / focus app at bilan screen ─────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || './';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
      const w = ws.find(c => c.url.startsWith(self.registration.scope));
      return w ? w.focus() : clients.openWindow(url);
    })
  );
});

// ─── Workout reminder ───────────────────────────────────────────────────────
async function swCheckWoReminder() {
  const sched = await swGet('/wo-reminder');
  if (!sched?.enabled) return;

  const now = new Date();
  const todayStr = _jourLocal(now);
  if (sched.lastNotifDate === todayStr) return;

  const todayJS = now.getDay();                          // 0=Sun … 6=Sat
  const todayApp = todayJS === 0 ? 6 : todayJS - 1;     // 0=Lun … 6=Dim
  if (!(sched.days || []).includes(todayApp)) return;

  const h = now.getHours();
  if (h < (sched.hour ?? 18)) return;       // trop tôt
  if (h >= (sched.hour ?? 18) + 3) return;  // plus de 3h après l'heure cible

  await swSet('/wo-reminder', { ...sched, lastNotifDate: todayStr });

  // Le nom de la séance du jour, quand le planning le porte. Sans lui, on
  // reste générique plutôt que d'inventer un intitulé.
  const _nom = (sched.noms && sched.noms[todayApp]) || 'ta séance';
  await self.registration.showNotification('Séance du jour', {
    body: (sched.fname || '') + ', ' + _nom + ' est au programme.',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-192x192.png',
    tag: 'wo-reminder',
    requireInteraction: false,
    data: { url: './?wo=1' }
  });
}

// ─── Supplement reminders ───────────────────────────────────────────────────
async function swCheckSuppReminders() {
  const sched = await swGet('/supp-reminders');
  if (!sched?.enabled || !sched?.items?.length) return;

  const now = new Date();
  const todayStr = _jourLocal(now);
  const h = now.getHours();
  const lastNotif = sched.lastNotif || {};

  // Les dix créneaux restent la nomenclature de référence : c'est ce que
  // portent les compléments eux-mêmes. Ils ne pilotent plus l'ÉMISSION, qui
  // passe par SUPP_GROUPES — mais ils servent à vérifier qu'aucun créneau
  // n'est orphelin le jour où on en ajoutera un.
  const TIMING_HOURS = {
    'jeun': 6, 'matin': 7, 'midi': 12, 'apres-midi': 15,
    'avant-entrainement': 17, 'intra': 18, 'apres-entrainement': 20,
    'soir': 19, 'coucher': 21, 'toutes-4h': 8
  };
  const _couverts = SUPP_GROUPES.reduce((a, g) => a.concat(g.timings), []);
  const _orphelins = Object.keys(TIMING_HOURS).filter(k => _couverts.indexOf(k) < 0);

  const updatedLastNotif = { ...lastNotif };
  let changed = false;

  // UNE notification par groupe et par jour, trois groupes : trois au maximum.
  // La boucle porte sur les groupes et non sur les créneaux, ce qui rend le
  // plafond structurel plutôt que surveillé.
  for (const g of SUPP_GROUPES) {
    if (h < g.heure || h >= g.heure + 3) continue;
    if (lastNotif[g.cle] === todayStr) continue;
    const timings = g.timings.concat(_orphelins.length && g.cle === 'jour' ? _orphelins : []);
    const due = sched.items.filter(x => (x.timings || []).some(t => timings.indexOf(t) >= 0));
    if (!due.length) continue;
    updatedLastNotif[g.cle] = todayStr;
    changed = true;
    const noms = due.map(x => x.name + (x.dosage_quantity ? ' ' + x.dosage_quantity + (x.dosage_unit ? ' ' + x.dosage_unit : '') : '')).join(' · ');
    await self.registration.showNotification('Compléments', {
      body: (sched.fname || '') + ' : ' + noms,
      icon: './icons/icon-192x192.png',
      badge: './icons/icon-192x192.png',
      tag: 'supp-' + g.cle,
      requireInteraction: false,
      data: { url: './' }
    });
  }

  if (changed) await swSet('/supp-reminders', { ...sched, lastNotif: updatedLastNotif });
}

// ─── Server push (future backend / VAPID integration) ──────────────────────
self.addEventListener('push', e => {
  const d = e.data?.json() || {};
  e.waitUntil(self.registration.showNotification(d.title || 'RepCore 💪', {
    body: d.body || 'Rappel RepCore.',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-192x192.png',
    tag: d.tag || 'repcore',
    data: { url: d.url || './' }
  }));
});
