#!/usr/bin/env node
// UN SERVEUR LOCAL QUI POSE LA CONTENT-SECURITY-POLICY DE firebase.json.
//
// POURQUOI. `python -m http.server` ne pose aucun en-tete : un onclick="…"
// ecrit par megarde dans une chaine HTML y marche tres bien, et ne meurt qu'en
// production, la ou la CSP est servie. Ce serveur rend la racine du depot avec
// la CSP de /app/** telle que firebase.json la porte, pour que la suite
// navigateur tourne DANS les conditions de la production.
//
//   node scripts/verif/serveur-csp.mjs [port=8000] [--sans-csp]
//   CSP=1 VW=1280 VH=2000 node scripts/verif/suite.mjs http://127.0.0.1:8000/app/index.html 9223
//
// ⚠ DEUX AJOUTS POUR LE BANC, et pour lui seul : 'unsafe-eval' et blob: dans
// script-src. app/tests.js passe par new Function et par un import de blob:
// (test N2) ; l'app, elle, n'en a pas besoin et la production ne les porte
// pas. 'unsafe-inline' n'est PAS ajoute : c'est justement ce qu'on eprouve.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const args=process.argv.slice(2);
const SANS=args.includes('--sans-csp');
const PORT=Number(args.find((a)=>/^\d+$/.test(a))||8000);
const RACINE=process.cwd();
const conf=JSON.parse(fs.readFileSync('firebase.json','utf8'));
const entree=((conf.hosting&&conf.hosting.headers)||[]).find((h)=>h.source==='/app/**');
const prod=entree&&(entree.headers.find((x)=>x.key==='Content-Security-Policy')||{}).value;
if(!prod&&!SANS){ console.error('serveur-csp : pas de Content-Security-Policy sur /app/** dans firebase.json'); process.exit(1); }
const CSP=SANS?'':prod.replace(/script-src /,"script-src 'unsafe-eval' blob: ");
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml',
  '.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.webp':'image/webp','.wasm':'application/wasm',
  '.mp4':'video/mp4','.webm':'video/webm','.gif':'image/gif','.ico':'image/x-icon'};
http.createServer((req,res)=>{
  let rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'');
  let f=path.resolve(RACINE,rel);
  if(!f.startsWith(RACINE)){ res.writeHead(403); return res.end('non'); }
  if(fs.existsSync(f)&&fs.statSync(f).isDirectory()) f=path.join(f,'index.html');
  fs.readFile(f,(e,d)=>{
    if(e){ res.writeHead(404); return res.end('absent : '+rel); }
    const h={'content-type':TYPES[path.extname(f).toLowerCase()]||'application/octet-stream','cache-control':'no-store'};
    if(CSP&&/^app(\/|$)/.test(rel)) h['content-security-policy']=CSP;
    res.writeHead(200,h); res.end(d);
  });
}).listen(PORT,'127.0.0.1',()=>console.log('depot servi sur http://127.0.0.1:'+PORT+'/'+(CSP?' avec la CSP de /app/**':' sans CSP')));
