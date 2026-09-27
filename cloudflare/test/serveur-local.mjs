// La fausse base ET le faux service de push, servis en HTTP, pour éprouver le
// Worker dans le vrai moteur de Cloudflare (`wrangler dev`).
//   node cloudflare/test/serveur-local.mjs <port> <scenario.json> <sortie.json>
// Le scénario est l'état initial de la base ; le service de push reçoit sur
// http://127.0.0.1:<port>/push/<id>. À chaque requête, l'état et ce que le
// push a reçu sont réécrits dans <sortie.json>.
import http from 'node:http';
import fs from 'node:fs';
import { fausseBase } from './fausse-base.mjs';

const [port, scenario, sortie] = process.argv.slice(2);
const F = fausseBase(JSON.parse(fs.readFileSync(scenario, 'utf8')));
const recus = [];
http.createServer(async (req, res) => {
  const morceaux = [];
  for await (const c of req) morceaux.push(c);
  const corps = Buffer.concat(morceaux);
  const url = 'http://127.0.0.1:' + port + req.url;
  if (req.url.startsWith('/service-push/')) {
    recus.push({ endpoint: url, headers: req.headers, corps: corps.toString('base64') });
    res.writeHead(201); res.end();
  } else {
    const h = {};
    for (const [k, v] of Object.entries(req.headers)) h[k === 'x-firebase-etag' ? 'X-Firebase-ETag' : k] = v;
    const r = await F.fetchImpl(url, { method: req.method, headers: h, body: corps.length ? corps.toString('utf8') : undefined });
    const texte = await r.text();
    const et = r.headers.get('ETag');
    res.writeHead(r.status, Object.assign({ 'Content-Type': 'application/json' }, et ? { ETag: et } : {}));
    res.end(texte);
  }
  fs.writeFileSync(sortie, JSON.stringify({ base: F.arbre, push: recus }, null, 1));
}).listen(Number(port), '127.0.0.1', () => console.log('fausse base sur ' + port));
