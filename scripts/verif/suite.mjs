// Lance la suite integree dans un Chrome headless et rend le rapport.
// --tolere=N (02/10/2026) : N echecs connus ignores le temps de leur correction.
// Par defaut 0 — tout echec fait sortir en 1, et la livraison s'arrete.
const args = process.argv.slice(2);
const opt = args.find((a) => a.startsWith('--tolere='));
const TOLERE = opt ? Math.max(0, parseInt(opt.slice(9), 10) || 0) : 0;
const [url, port='9223'] = args.filter((a) => !a.startsWith('--'));
const t = await (await fetch(`http://127.0.0.1:${port}/json/new?` + encodeURIComponent(url),
  { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let n = 0; const att = new Map();
const cmd = (m, p={}) => new Promise((res, rej) => { const id = ++n; att.set(id, res);
  ws.send(JSON.stringify({ id, method: m, params: p }));
  setTimeout(() => { if (att.has(id)) { att.delete(id); rej(new Error('timeout ' + m)); } }, 180000); });
ws.onmessage = e => { const m = JSON.parse(e.data);
  if (m.id && att.has(m.id)) { att.get(m.id)(m.result); att.delete(m.id); } };
await new Promise(r => ws.onopen = r);
// LE CACHE HTTP RESSERT tests.js MEME SANS SERVICE WORKER. Il est chargé par
// une balise <script> posée à la volée, bien après le chargement de la page :
// vider les caches du service worker ne l'atteint pas.
await cmd('Network.enable');
await cmd('Network.setCacheDisabled', { cacheDisabled: true });
// LE HEADLESS TOURNE EN UTC, ET AUCUN UTILISATEUR DE REPCORE N'Y VIT.
// Mesure faite : entre le 28 et le 29 mars 2026, deux minuits locaux du harnais
// sont separes de 24 heures pile — il n'y a pas de changement d'heure en UTC.
// Toute assertion ecrite pour verifier qu'un calcul de jours resiste au passage
// a l'heure d'ete passait donc au vert sans rien avoir traverse, y compris avec
// une division brute de millisecondes. Le fuseau est celui des utilisateurs.
await cmd('Emulation.setTimezoneOverride', { timezoneId: 'Europe/Paris' });
// LA FENETRE EST FIXEE ICI, ET PLUS PAR LA CI (02/10/2026). Un telephone,
// 412 de large, et 4000 de haut : un test de la liste de gene (tests.js,
// « menu de gene ») ferme son menu quand la case sort de l'ecran, si bien que
// le resultat dependait de la taille par defaut de la fenetre — 800x600 en
// local, autre chose sur un runner. VW / VH restent possibles pour une mesure.
await cmd('Emulation.setDeviceMetricsOverride', { width: +(process.env.VW || 412),
  height: +(process.env.VH || 4000), deviceScaleFactor: 1, mobile: !(process.env.VW || process.env.VH) });
await new Promise(r => setTimeout(r, 6000));
const ev = async x => {
  const r = await cmd('Runtime.evaluate',
    { expression: x, returnByValue: true, awaitPromise: true, timeout: 170000 });
  if (r.exceptionDetails) return { erreur: r.exceptionDetails.text + ' ' +
    ((r.exceptionDetails.exception||{}).description||'') };
  return r.result.value;
};
console.log('titre :', await ev('document.title'));
// LE SERVICE WORKER D'UNE SESSION PRECEDENTE SERVAIT L'ANCIEN tests.js. Il
// n'est pas dans ASSETS, mais l'enregistrement survit au profil et sa reponse
// en cache passe avant le serveur local : on modifiait un test, on relançait,
// et le rapport ne bougeait pas d'une ligne. On part d'une ardoise vide.
// LE PROFIL GARDE LE localStorage D'UN RUN A L'AUTRE, et la suite ECRIT
// dedans : comptes, dossiers, journaux. Deux lancements de suite sur le meme
// profil ne partaient donc pas du meme etat, et le nombre de tests joues
// DERIVAIT — 3 731 puis 3 738 puis 3 745, sept de plus a chaque fois. Pire, un
// etat accumule finissait par faire lever un test tot et la suite s'arretait a
// 1 035. On repart d'une ardoise vide, et on RECHARGE : l'app lit sa base au
// chargement.
console.log('nettoyage :', await ev(`(async()=>{ try{
  const rs=await navigator.serviceWorker.getRegistrations();
  for(const r of rs) await r.unregister();
  for(const k of await caches.keys()) await caches.delete(k);
  localStorage.clear(); sessionStorage.clear();
  if(indexedDB.databases) for(const d of await indexedDB.databases())
    if(d&&d.name) indexedDB.deleteDatabase(d.name);
  return 'sw, caches et stockage vides'; }catch(e){ return 'echec '+String(e&&e.message||e); } })()`));
await cmd('Page.reload', { ignoreCache: true });
await new Promise(r => setTimeout(r, 6000));
// LA TABLE CIQUAL EST CHARGEE AVANT, ET CELA CHANGE LA TAILLE DE LA SUITE.
// Sans elle, un test de substitution levait a mi-parcours ; la suite est un
// seul try, si bien que TOUT ce qui suivait ne s'executait plus. Mesure :
// 2 117 tests joues sans ce chargement, 3 729 avec — 1 612 assertions
// passaient pour absentes, et un lot pouvait en casser sans qu'on le voie.
console.log('ciqual :', await ev(`(async()=>{ try{ await _loadCiqual(); return 'chargee'; }
  catch(e){ return 'echec '+String(e&&e.message||e); } })()`));
// L'INDEX DES ILLUSTRATIONS AUSSI. Il se charge d'ordinaire au premier
// affichage d'une fiche ; la suite, elle, n'en affiche aucune. Sans ce
// chargement, l'assertion qui verifie que les nouvelles fiches ont bien une
// photo ne verifierait qu'une chose : que l'index n'est pas charge.
console.log('illustrations :', await ev(`(async()=>{ try{ const s=await chargerIndexIllustrations();
  return s.size+' fiches'; }catch(e){ return 'echec '+String(e&&e.message||e); } })()`));
// LES REGLES DE LA BASE, comme Ciqual et l'index : la sonde qui compare la
// liste blanche de coach_public a CHAMPS_PROFIL_COACH ne peut rien verifier
// sans elles, et un vert muet laisserait croire qu'elle l'a fait. La ligne
// ci-dessous dit si elles ont ete lues — servir la RACINE du depot, et non
// app/, est ce qui les rend accessibles.
console.log('regles :', await ev(`(async()=>{ try{
  const r=await fetch('../database.rules.json',{cache:'no-store'});
  if(!r.ok) return 'NON SERVIES (HTTP '+r.status+') — lance le serveur a la racine du depot';
  window._RC_RULES=await r.text();
  return 'chargees ('+window._RC_RULES.length+' o)';
}catch(e){ return 'NON SERVIES : '+String(e&&e.message||e); } })()`));
const rap = await ev(`(async()=>{ try{ const r=await chargerTests();
  return {total:r.total,echecs:r.echecs,
    liste:r.detail.filter(x=>!x.ok).map(x=>x.n+(x.d?' → '+x.d:'')+(x.ou?'  ['+x.ou+']':'')),
    noms:r.detail.filter(x=>!x.ok).map(x=>x.n)}; }
  catch(e){ return {erreur:String(e&&e.message||e)}; } })()`);
console.log(JSON.stringify(rap, null, 1).slice(0, 12000));
await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`);
// LE CODE DE SORTIE DIT LE RESULTAT : la CI le lit, et la livraison
// (firebase.yml, « Suite integree ») s'arrete sur un 1. Echec si :
//   · la suite a leve (rap.erreur) ou n'a rien rendu ;
//   · une ligne du rapport commence par « ⛔ SUITE INTERROMPUE » ;
//   · moins de SUITE_MIN tests joues (1000 par defaut) ;
//   · plus d'echecs que --tolere=N (0 par defaut) — hors echecs attendus de
//     SUITE_ATTENDUS (scripts/verif/echecs-attendus.json), propres a un
//     Chrome sans GPU ni codecs.
const MIN = +(process.env.SUITE_MIN || 1000);
const total = (rap && rap.total) || 0;
let echecs = (rap && rap.echecs) || 0;
let compte = echecs;
const interrompue = !!(rap && (rap.liste || []).some((l) => String(l).startsWith('⛔ SUITE INTERROMPUE')));
if (process.env.SUITE_ATTENDUS && rap && !rap.erreur) {
  const {readFileSync} = await import('node:fs');
  const attendus = new Set((JSON.parse(readFileSync(process.env.SUITE_ATTENDUS, 'utf8')).echecs) || []);
  const noms = rap.noms || [];
  const imprevus = noms.filter((n) => !attendus.has(n));
  const gueris = [...attendus].filter((n) => !noms.includes(n));
  console.log('\nEchecs attendus (hors navigateur reel) : ' + (noms.length - imprevus.length) + ' sur ' + attendus.size + '.');
  if (gueris.length) console.log('::warning::Attendu(s) qui passe(nt) desormais, a retirer de ' + process.env.SUITE_ATTENDUS + ' :\n  ' + gueris.join('\n  '));
  if (imprevus.length) console.log('::error::Echec(s) IMPREVU(S) :\n  ' + imprevus.join('\n  '));
  compte = imprevus.length;
}
const raisons = [];
if (!rap) raisons.push('aucun rapport');
else if (rap.erreur) raisons.push('erreur : ' + rap.erreur);
if (interrompue) raisons.push('suite interrompue');
if (rap && !rap.erreur && total < MIN) raisons.push('seulement ' + total + ' tests joues (minimum ' + MIN + ')');
if (compte > TOLERE) raisons.push(compte + ' echec(s) pour ' + TOLERE + ' tolere(s)');
console.log('\nSUITE : ' + total + ' tests, ' + echecs + ' echec(s)' + (TOLERE ? ' (' + TOLERE + ' tolere(s))' : '') +
  ' — ' + (raisons.length ? 'ROUGE : ' + raisons.join(' ; ') : 'VERT'));
if (raisons.length) console.log('::error::Suite integree ROUGE : ' + raisons.join(' ; '));
process.exit(raisons.length ? 1 : 0);
