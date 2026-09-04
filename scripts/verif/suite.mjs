// Lance la suite integree dans un Chrome headless et rend le rapport.
const [,, url, port='9223'] = process.argv;
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
    liste:r.detail.filter(x=>!x.ok).map(x=>x.n+(x.d?' → '+x.d:'')+(x.ou?'  ['+x.ou+']':''))}; }
  catch(e){ return {erreur:String(e&&e.message||e)}; } })()`);
console.log(JSON.stringify(rap, null, 1).slice(0, 12000));
await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`);
process.exit(0);
