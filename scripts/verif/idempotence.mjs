// Joue chargerTests() TROIS FOIS dans la meme page et compare les rapports.
//
// POURQUOI CE LANCEUR EXISTE. suite.mjs ouvre un onglet neuf, vide le stockage
// et recharge : il ne peut donc RIEN dire de la rejouabilite. Or la suite ecrit
// dans DB, dans currentUser et dans une dizaine de caches ; si elle ne rendait
// pas ce qu elle emprunte, la deuxieme execution verrait l etat laisse par la
// premiere et rendrait des echecs fantomes — un diagnostic bati sur la suite
// deviendrait alors douteux.
//
// LA SORTIE SE LIT EN UN COUP D OEIL : les trois totaux doivent etre identiques,
// et fantomes2, fantomes3 et gueris doivent etre vides. Un total qui DERIVE dit
// que la suite s ajoute a elle-meme ; un fantome dit qu elle ne restaure pas.
//
// Mesure du 02/09/2026 : 4 142 / 18 aux trois passes, aucun fantome.
const [,, url, port='9223'] = process.argv;
const t = await (await fetch(`http://127.0.0.1:${port}/json/new?` + encodeURIComponent(url),
  { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let n = 0; const att = new Map();
const cmd = (m, p={}) => new Promise((res, rej) => { const id = ++n; att.set(id, res);
  ws.send(JSON.stringify({ id, method: m, params: p }));
  setTimeout(() => { if (att.has(id)) { att.delete(id); rej(new Error('timeout ' + m)); } }, 300000); });
ws.onmessage = e => { const m = JSON.parse(e.data);
  if (m.id && att.has(m.id)) { att.get(m.id)(m.result); att.delete(m.id); } };
await new Promise(r => ws.onopen = r);
await cmd('Network.enable');
await cmd('Network.setCacheDisabled', { cacheDisabled: true });
await new Promise(r => setTimeout(r, 6000));
const ev = async x => {
  const r = await cmd('Runtime.evaluate',
    { expression: x, returnByValue: true, awaitPromise: true, timeout: 290000 });
  if (r.exceptionDetails) return { erreur: r.exceptionDetails.text };
  return r.result.value;
};
console.log('nettoyage :', await ev(`(async()=>{ try{
  const rs=await navigator.serviceWorker.getRegistrations();
  for(const r of rs) await r.unregister();
  for(const k of await caches.keys()) await caches.delete(k);
  localStorage.clear(); sessionStorage.clear();
  return 'vide'; }catch(e){ return 'echec '+e.message; } })()`));
await cmd('Page.enable'); await cmd('Page.reload', { ignoreCache: true });
await new Promise(r => setTimeout(r, 6000));
const rap = await ev(`(async()=>{ try{
  const a=await chargerTests();
  const na=a.detail.filter(x=>!x.ok).map(x=>x.n);
  const b=await chargerTests();
  const nb=b.detail.filter(x=>!x.ok).map(x=>x.n);
  const c=await chargerTests();
  const nc=c.detail.filter(x=>!x.ok).map(x=>x.n);
  const setA=new Set(na);
  return {passe1:{total:a.total,echecs:a.echecs},
          passe2:{total:b.total,echecs:b.echecs},
          passe3:{total:c.total,echecs:c.echecs},
          fantomes2:nb.filter(x=>!setA.has(x)),
          fantomes3:nc.filter(x=>!setA.has(x)),
          gueris:na.filter(x=>!nc.includes(x))}; }
  catch(e){ return {erreur:String(e&&e.message||e)}; } })()`);
console.log(JSON.stringify(rap, null, 1).slice(0, 4000));
await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`);
process.exit(0);
