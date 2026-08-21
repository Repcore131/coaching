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
await new Promise(r => setTimeout(r, 6000));
const ev = async x => {
  const r = await cmd('Runtime.evaluate',
    { expression: x, returnByValue: true, awaitPromise: true, timeout: 170000 });
  if (r.exceptionDetails) return { erreur: r.exceptionDetails.text + ' ' +
    ((r.exceptionDetails.exception||{}).description||'') };
  return r.result.value;
};
console.log('titre :', await ev('document.title'));
const rap = await ev(`(async()=>{ try{ const r=await chargerTests();
  return {total:r.total,echecs:r.echecs,
    liste:r.detail.filter(x=>!x.ok).map(x=>x.n+(x.d?' → '+x.d:''))}; }
  catch(e){ return {erreur:String(e&&e.message||e)}; } })()`);
console.log(JSON.stringify(rap, null, 1).slice(0, 12000));
await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`);
process.exit(0);
