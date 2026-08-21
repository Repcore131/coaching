import { writeFileSync } from 'node:fs';
const [,, url, prefixe, port='9223'] = process.argv;
const t = await (await fetch(`http://127.0.0.1:${port}/json/new?` + encodeURIComponent(url),
  { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let n = 0; const att = new Map();
const cmd = (m, p={}) => new Promise((res, rej) => { const id = ++n; att.set(id, res);
  ws.send(JSON.stringify({ id, method: m, params: p }));
  setTimeout(() => { if (att.has(id)) { att.delete(id); rej(new Error('timeout ' + m)); } }, 25000); });
ws.onmessage = e => { const m = JSON.parse(e.data);
  if (m.id && att.has(m.id)) { att.get(m.id)(m.result); att.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const ev = async x => (await cmd('Runtime.evaluate', { expression: x, returnByValue: true })).result.value;
await new Promise(r => setTimeout(r, 3000));
const bancs = await ev(`JSON.stringify([...document.querySelectorAll('.banc')].map(b=>{
  const r=b.getBoundingClientRect(); return {w:Math.ceil(r.width),h:Math.ceil(r.height),l:b.style.width};}))`);
for (const [i, b] of JSON.parse(bancs).entries()) {
  // Un seul banc a l'ecran : la page entiere est trop haute pour une capture.
  await ev(`[...document.querySelectorAll('.banc')].forEach((x,k)=>x.style.display=k===${i}?'':'none');
    document.querySelector('.bancs').style.overflowX='visible';window.scrollTo(0,0);'ok'`);
  await cmd('Emulation.setDeviceMetricsOverride',
    { width: b.w + 34, height: b.h + 34, deviceScaleFactor: 2, mobile: false });
  await new Promise(r => setTimeout(r, 900));
  const { data } = await cmd('Page.captureScreenshot', { format: 'png' });
  const f = `${prefixe}-${b.l.replace('px','')}.png`;
  writeFileSync(f, Buffer.from(data, 'base64'));
  console.log('ecrit', f, b.w + 'x' + b.h);
}
await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`);
process.exit(0);
