// LA FUMÉE DES PAGES (05/10/2026) : chaque page publique et l'app s'ouvrent-elles
// sans exception, sans ressource manquante, et sans « undefined » à l'écran ?
//
// La suite intégrée teste des fonctions ; elle n'ouvre jamais /, /i/, /p/…
// telles qu'un visiteur les ouvre. Une erreur de syntaxe dans une page
// publique, une image renommée, un libellé construit sur une valeur absente
// (« undefined séances », « NaN kg ») passaient donc. Ce script charge chaque
// page, à deux tailles et dans deux fuseaux, et échoue (sortie 1) sur :
//   · tout événement pageerror (Runtime.exceptionThrown : exception non
//     rattrapée, promesse rejetée sans catch) ;
//   · toute réponse 4xx/5xx d'une ressource du MÊME HÔTE, hors EXCEPTIONS ;
//   · tout texte VISIBLE (innerText) qui contient NaN, undefined, Infinity ou
//     [object Object].
//
// Même Chrome que la suite (protocole DevTools, port 9223), même serveur :
//   python3 -m http.server 8799 --bind 127.0.0.1 &      (à la RACINE du dépôt)
//   node scripts/verif/fumee-pages.mjs [http://127.0.0.1:8799] [9223]
const [, , base = 'http://127.0.0.1:8799', port = '9223'] = process.argv;
const PAGES = ['/', '/app/', '/app/ (athlète)', '/i/', '/p/', '/c/', '/a/', '/maj/'];
// L'ACCUEIL DE L'ATHLÈTE (s-client-home) : sans compte, /app/ n'ouvre que
// l'écran d'installation. Ce passage pose un athlète de démonstration dans le
// stockage local, recharge, et vérifie que c'est bien son accueil qui s'affiche.
const DEMO = { id: 'demo', email: 'demo@repcore.test', role: 'athlete', fname: 'Léa', lname: 'Démo', gender: 'F',
  birthdate: '1995-04-12', sessions: [], bilans: [], weightLog: [], sessions_config: [], onboarded: true,
  status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active', abonnement: { formule: 'ultime' } };
// LE RÉSEAU EXTÉRIEUR EST COUPÉ : la fumée regarde ce que les pages font
// d'elles-mêmes. Une base ou un Worker joignable en CI et pas en local
// rendrait deux résultats différents (l'athlète de démonstration, lu au
// serveur, tomberait sur l'écran du code).
const EXTERIEUR_BLOQUE = ['*firebaseio.com*', '*googleapis.com*', '*workers.dev*', '*cloudinary.com*', '*gstatic.com*', '*paypal.com*', '*fonts.googleapis.com*'];
const TAILLES = [{ nom: '390x844', width: 390, height: 844, mobile: true }, { nom: '1280x800', width: 1280, height: 800, mobile: false }];
const FUSEAUX = ['Europe/Paris', 'America/Martinique'];
// LES EXCEPTIONS, et pourquoi. Une ressource absente ici n'est PAS une panne :
//   · /favicon.ico : les navigateurs le demandent d'eux-mêmes ; les pages
//     déclarent leur icône par <link rel="icon">, le fichier racine n'existe pas ;
//   · les badges, emblèmes et vignettes qui ont un REPLI (onerror) : l'image
//     manquante est remplacée à l'écran, c'est le comportement prévu
//     (illustrations, rangs, badges des pages publiques sans pseudo réel).
// Toute autre 4xx/5xx du même hôte est un échec.
const EXCEPTIONS = [
  { motif: /\/favicon\.ico$/, raison: 'demandé par le navigateur, non déclaré' },
  { motif: /\/img\/(badges|rangs|illustrations|exercices)\/[^?]+\.(webp|png|jpg)(\?|$)/, raison: 'image à repli (onerror)' },
];
// SANS ÉGARD À LA CASSE : innerText rend le texte tel qu'il s'affiche, et un
// titre en text-transform:uppercase montre « UNDEFINED », pas « undefined ».
const TEXTE_INTERDIT = /\b(NaN|undefined|Infinity)\b|\[object Object\]/i;
const ATTENTE_MS = +(process.env.FUMEE_ATTENTE_MS || 3500);

const hote = new URL(base).host;
const echecs = [];
let vus = 0;

async function ouvrir() {
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let n = 0; const att = new Map(); const ecoute = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && att.has(m.id)) { att.get(m.id)(m); att.delete(m.id); }
    else if (m.method) for (const f of ecoute) f(m);
  };
  await new Promise((r) => (ws.onopen = r));
  const cmd = (method, params = {}) => new Promise((res, rej) => {
    const id = ++n; att.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (att.has(id)) { att.delete(id); rej(new Error('délai : ' + method)); } }, 60000);
  });
  return { t, ws, cmd, ecoute };
}

for (const fuseau of FUSEAUX) for (const taille of TAILLES) for (const page of PAGES) {
  const ou = `${page} · ${taille.nom} · ${fuseau}`;
  const o = await ouvrir();
  const erreurs = [], manquants = [];
  o.ecoute.push((m) => {
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails || {};
      erreurs.push(((d.exception && d.exception.description) || d.text || 'exception').split('\n')[0]);
    }
    if (m.method === 'Network.responseReceived') {
      const r = m.params.response;
      let u; try { u = new URL(r.url); } catch (e) { return; }
      if (u.host === hote && r.status >= 400 && !EXCEPTIONS.some((x) => x.motif.test(u.pathname)))
        manquants.push(r.status + ' ' + u.pathname);
    }
  });
  try {
    await o.cmd('Runtime.enable');
    await o.cmd('Network.enable');
    await o.cmd('Network.setCacheDisabled', { cacheDisabled: true });
    await o.cmd('Network.setBlockedURLs', { urls: EXTERIEUR_BLOQUE });
    // UN VISITEUR NEUF : la suite intégrée, jouée juste avant dans le même
    // Chrome, laisse un compte dans le localStorage — /app/ s'ouvrait alors
    // sur l'espace coach, et l'écran d'arrivée n'était jamais regardé.
    await o.cmd('Storage.clearDataForOrigin', { origin: new URL(base).origin, storageTypes: 'all' });
    await o.cmd('Emulation.setTimezoneOverride', { timezoneId: fuseau });
    await o.cmd('Emulation.setDeviceMetricsOverride', { width: taille.width, height: taille.height, deviceScaleFactor: 1, mobile: taille.mobile });
    const chemin = page.split(' ')[0], athlete = /athlète/.test(page);
    const charger = async (rel) => {
      if (rel) await o.cmd('Page.reload', {}); else await o.cmd('Page.navigate', { url: base + chemin });
      const fin = Date.now() + 20000;
      for (;;) {
        const r = await o.cmd('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
        if (r.result && r.result.result && r.result.result.value === 'complete') break;
        if (Date.now() > fin) { erreurs.push('la page ne finit pas de charger'); break; }
        await new Promise((r) => setTimeout(r, 200));
      }
      await new Promise((r) => setTimeout(r, ATTENTE_MS));
    };
    await charger(false);
    if (athlete) {
      await o.cmd('Runtime.evaluate', { expression: `(()=>{ const u=Object.assign(${JSON.stringify(DEMO)},{consent:{health:true,policyVersion:POLICY_VERSION}});
        localStorage.setItem('rc_session',JSON.stringify(u)); localStorage.setItem('rc_users',JSON.stringify({[u.email]:u}));
        // L'ACCUEIL, pas les accueils de nouvel inscrit : depuis le 05/10/2026,
        // un athlète sans coach et sans séance part sur le parcours de première
        // séance (et, avant, sur la question des jours). On les dit déjà vus.
        localStorage.setItem('rc_jours_vu_'+u.email,'1'); localStorage.setItem('rc_premiere_seance_'+u.email,'1'); })()` });
      await charger(true);
      const r = await o.cmd('Runtime.evaluate', { expression: '(document.querySelector(".screen.active")||{}).id||""', returnByValue: true });
      const ecran = r.result && r.result.result && r.result.result.value;
      if (ecran !== 's-client-home') erreurs.push('l’accueil de l’athlète ne s’ouvre pas (écran : ' + ecran + ')');
    }
    const r = await o.cmd('Runtime.evaluate', { expression: 'document.body ? document.body.innerText : ""', returnByValue: true });
    const texte = String((r.result && r.result.result && r.result.result.value) || '');
    if (!texte.trim()) erreurs.push('page vide');
    const lignes = texte.split('\n').filter((l) => TEXTE_INTERDIT.test(l));
    for (const l of lignes.slice(0, 5)) echecs.push(`${ou} : texte visible « ${l.trim().slice(0, 100)} »`);
  } catch (e) {
    erreurs.push('sonde : ' + e.message);
  }
  for (const e of erreurs) echecs.push(`${ou} : ${e}`);
  for (const m of manquants) echecs.push(`${ou} : ressource ${m}`);
  vus++;
  try { o.ws.close(); } catch (e) {}
  await fetch(`http://127.0.0.1:${port}/json/close/${o.t.id}`).catch(() => {});
}

const uniques = [...new Set(echecs)];
console.log(`Fumée : ${vus} chargements (${PAGES.length} pages × ${TAILLES.length} tailles × ${FUSEAUX.length} fuseaux), ${uniques.length} problème(s).`);
if (uniques.length) {
  console.log(uniques.map((x) => '  ' + x).join('\n'));
  console.log('::error::Fumée des pages ROUGE : ' + uniques.length + ' problème(s)');
  process.exit(1);
}
console.log('VERT');
process.exit(0);
