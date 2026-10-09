#!/usr/bin/env node
// LA CONTENT-SECURITY-POLICY DE L'APP (firebase.json), relue contre le code.
//
// Deux fautes a eviter, et elles sont silencieuses toutes les deux :
//   · une CSP qui disparait, ou qui perd object-src 'none' / base-uri 'self',
//     ou dont connect-src / img-src redeviennent ouverts (*, https:) — une
//     donnee de dossier injectee pourrait alors exfiltrer vers n'importe ou ;
//   · un domaine que l'app appelle (fetch('https://…')) et que connect-src
//     n'admet pas — la fonction casse en production, et seulement la.
import {readFileSync} from 'node:fs';
import {fichierCode} from './source-prod.mjs';

const conf=JSON.parse(readFileSync('firebase.json','utf8'));
const heads=(conf.hosting&&conf.hosting.headers)||[];
const csp=(source)=>{
  const e=heads.find((h)=>h.source===source);
  const k=e&&(e.headers||[]).find((x)=>x.key==='Content-Security-Policy');
  return k?k.value:'';
};
const fautes=[];
const a=csp('/app/**'), b=csp('/app');
if(!a) fautes.push('pas de Content-Security-Policy sur /app/**');
if(!b) fautes.push('pas de Content-Security-Policy sur /app (sans barre : les en-tetes suivent le chemin demande)');
if(a&&b&&a!==b) fautes.push('/app et /app/** ne portent pas la meme CSP');
const dir={};
for(const p of a.split(';').map((x)=>x.trim()).filter(Boolean)){ const [n,...v]=p.split(/\s+/); dir[n]=v; }
if(String(dir['object-src'])!=="'none'") fautes.push("object-src doit valoir 'none'");
if(String(dir['base-uri'])!=="'self'") fautes.push("base-uri doit valoir 'self'");
for(const d of ['connect-src','img-src','media-src','script-src','default-src'])
  if(!dir[d]) fautes.push(d+' absent');
  else if(dir[d].some((v)=>v==='*'||v==='https:'||v==='http:')) fautes.push(d+' ouvert a tout domaine ('+dir[d].join(' ')+')');
// Les domaines appeles par l'app.
const code=readFileSync(fichierCode(),'utf8');
const admis=(liste,h)=>liste.some((v)=>{
  const m=v.match(/^https:\/\/(.+)$/); if(!m) return false;
  const pat=m[1];
  return pat.startsWith('*.')?(h.endsWith(pat.slice(1))):h===pat;
});
const hotes=new Set([...code.matchAll(/fetch\(\s*['`]https:\/\/([a-z0-9.-]+)/g)].map((m)=>m[1]));
for(const h of ['repcore-sync-default-rtdb.firebaseio.com','repcore-serveur.repcore.workers.dev']) hotes.add(h);
for(const h of hotes) if(!admis(dir['connect-src']||[],h)) fautes.push('connect-src n admet pas '+h+', que l app appelle');
if(fautes.length){ console.error('CSP :\n  '+fautes.join('\n  ')); process.exit(1); }
console.log('CSP : presente sur /app et /app/**, bornee ('+hotes.size+' domaines appeles, tous admis)');
