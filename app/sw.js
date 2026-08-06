const CACHE = 'repcore-v473';
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
// absent. pdf.min.js, lui, est charge dynamiquement : il rejoint le cache par
// le handler fetch a la premiere ouverture d un PDF, et y reste pour
// l ouverture suivante, hors ligne comprise.
const ASSETS = ['./index.html', './manifest.json', './icons/icon-192x192.png',
  './vendor/qr.js', './fonts/montserrat-var-latin.woff2',
  './fonts/bebasneue-400-latin.woff2'];

// Une séance en cours interdit la bascule. Le client poste SEANCE_EN_COURS au
// lancement et SEANCE_TERMINEE à la fin ; tant que ce drapeau est levé, le
// nouveau SW reste en attente. Prendre le contrôle en pleine séance, c'est
// purger le cache sous les pieds de quelqu'un qui est peut-être hors ligne.
let _seanceEnCours = false;
let _attenteFinSeance = false;

self.addEventListener('install', e => {
  // allSettled et non addAll : un asset manquant ou en erreur ne doit plus
  // faire échouer toute l'installation du Service Worker.
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(ASSETS.map(a => c.add(a))))
      .catch(() => {})
  );
  // Conditionné : voir _seanceEnCours. Sans séance en cours, comportement
  // inchangé — la mise à jour reste immédiate.
  if (_seanceEnCours) _attenteFinSeance = true;
  else self.skipWaiting();
});

// Préchargement différé et non bloquant de la base alimentaire (672 Ko).
// index.html poste ce message au premier affichage de l'écran nutrition :
// la recherche d'aliment fonctionne alors hors-ligne aux visites suivantes,
// sans peser sur le tout premier chargement de l'app.
const CIQUAL_URL = './data/ciqual.json';
let _ciqualPrefetch = null;
self.addEventListener('message', e => {
  // Séance en cours : on retient la bascule. À la fin, si un SW attendait,
  // il prend la main immédiatement — l'utilisateur n'a rien à faire.
  if (e.data?.type === 'SEANCE_EN_COURS') { _seanceEnCours = true; return; }
  if (e.data?.type === 'SEANCE_TERMINEE') {
    _seanceEnCours = false;
    if (_attenteFinSeance) { _attenteFinSeance = false; self.skipWaiting(); }
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
      // 1. Report de Ciqual, depuis le premier ancien cache qui le porte.
      if (!(await neuf.match(CIQUAL_URL))) {
        for (const k of anciens) {
          try {
            const vieux = await caches.open(k);
            const r = await vieux.match(CIQUAL_URL);
            if (r) { await neuf.put(CIQUAL_URL, r.clone()); break; }
          } catch (err) {}
        }
      }
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
  // Assets same-origin : cache-first, sans fallback HTML (évite de servir HTML à la place d'un asset)
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
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
