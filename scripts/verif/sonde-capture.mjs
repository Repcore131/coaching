#!/usr/bin/env node
// LA CAPTURE REND-ELLE LA MAIN ? (01/10/2026, .github/workflows/suite.yml)
// `--headless=new` ne composite pas sur certains postes : Page.captureScreenshot
// ne repond jamais, sans erreur (scripts/verif/README.md, « Le piege qui coute
// une heure »). Cette sonde ouvre about:blank, demande une capture et sort en 0
// si elle arrive en moins de 15 s, en 1 sinon — le workflow bascule alors en
// `--headless=old`.
//   node scripts/verif/sonde-capture.mjs [port]
const port = process.argv[2] || '9223';
const fin = (c, m) => { console.log(m); process.exit(c); };
setTimeout(() => fin(1, 'capture : pas de reponse en 15 s'), 15000);
try {
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = async (e) => {
    const m = JSON.parse(e.data);
    if (m.id !== 1) return;
    try { await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`); } catch (x) {}
    fin(m.result && m.result.data ? 0 : 1, m.result && m.result.data ? 'capture : ok' : 'capture : ' + JSON.stringify(m.error || m));
  };
  ws.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } }));
} catch (e) { fin(1, 'capture : ' + (e && e.message || e)); }
