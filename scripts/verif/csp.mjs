#!/usr/bin/env node
// LA CONTENT-SECURITY-POLICY DE L'APP (firebase.json), relue contre le code.
//
// Deux fautes a eviter, et elles sont silencieuses toutes les deux :
//   · une CSP qui disparait, ou qui perd object-src 'none' / base-uri 'self',
//     ou dont connect-src / img-src redeviennent ouverts (*, https:) — une
//     donnee de dossier injectee pourrait alors exfiltrer vers n'importe ou ;
//   · un domaine que l'app appelle (fetch('https://…')) et que connect-src
//     n'admet pas — la fonction casse en production, et seulement la.
// Et deux autres depuis le build 1760 :
//   · 'unsafe-inline' qui revient dans script-src ;
//   · l'empreinte d'un script en ligne de app/index.html qui n'est plus la
//     bonne (le bloc est alors refuse par le navigateur, en production seule).
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
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
// PAS DE 'unsafe-inline' NI DE 'unsafe-eval' DANS script-src (build 1760). Les
// gestionnaires en ligne ont ete remplaces par des gestes delegues
// (data-on-*, voir scripts/verif/gestes.mjs) : y remettre 'unsafe-inline',
// c'est rendre a une donnee injectee le droit d'executer du code.
const ss=dir['script-src']||[];
for(const interdit of ["'unsafe-inline'","'unsafe-eval'","'unsafe-hashes'",'data:','blob:'])
  if(ss.includes(interdit)) fautes.push('script-src ne doit pas porter '+interdit);
// LES SCRIPTS EN LIGNE DE app/index.html PASSENT PAR LEUR EMPREINTE. Elle
// change des qu'un caractere du bloc change — donc a CHAQUE build, le premier
// bloc portant RC_BUILD. scripts/versionner_actifs.py les recalcule ; une
// empreinte perimee, et le navigateur refuse le bloc en production : plus de
// RC_BUILD, plus de theme, plus de _tok. L'empreinte porte sur le texte tel
// que l'analyseur HTML le rend, c'est-a-dire en LF.
//
// ⚠ LA COPIE PUBLIEE N'EST PAS LE DEPOT. scripts/minifier_site.mjs retire les
// lignes de commentaire des <script> en ligne de _site/app/index.html : leurs
// empreintes ne sont donc PLUS celles du source. Le deploiement appelle
//   node scripts/verif/csp.mjs --site _site --poser
// qui recalcule les empreintes sur la copie assemblee et les ecrit dans
// firebase.json (celui du poste qui deploie, jamais commite), puis verifie.
// Sans --site : le depot, c'est-a-dire ce que serveur-csp.mjs et deploie.sh
// (qui ne minifie pas) servent.
const args=process.argv.slice(2);
const iSite=args.indexOf('--site');
const SITE=iSite>=0?args[iSite+1]:'';
const fichierIndex=(SITE?SITE.replace(/[\\/]+$/,'')+'/':'')+'app/index.html';
const html=readFileSync(fichierIndex,'utf8');
const attendues=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map((m)=>"'sha256-"+createHash('sha256').update(m[1].replace(/\r\n?/g,'\n'),'utf8').digest('base64')+"'");
if(args.includes('--poser')){
  if(!SITE){ console.error('CSP : --poser ne vaut qu avec --site <dossier> (dans le depot, c est scripts/versionner_actifs.py)'); process.exit(1); }
  const brut=readFileSync('firebase.json','utf8');
  const neuf=brut.replace(/script-src ('self'[^;"]*)/g,(_,v)=>{
    const l=v.split(/\s+/).filter((x)=>x&&!x.startsWith("'sha256-"));
    return 'script-src '+[l[0],...attendues,...l.slice(1)].join(' ');
  });
  if(neuf!==brut){ writeFileSync('firebase.json',neuf); console.log('CSP : empreintes de '+fichierIndex+' posees dans firebase.json'); }
  ss.splice(0,ss.length,...((neuf.match(/script-src ('self'[^;"]*)/)||['',''])[1].split(/\s+/)));
}
const portees=ss.filter((v)=>v.startsWith("'sha256-"));
for(const h of attendues) if(!portees.includes(h))
  fautes.push('script-src ne porte pas l empreinte '+h+' d un script en ligne de '+fichierIndex+' — lancer `python scripts/versionner_actifs.py`');
for(const h of portees) if(!attendues.includes(h))
  fautes.push('script-src porte une empreinte qui ne correspond a aucun script en ligne : '+h+' — lancer `python scripts/versionner_actifs.py`');
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
console.log('CSP : presente sur /app et /app/**, bornee ('+hotes.size+' domaines appeles, tous admis), script-src sans unsafe-inline ('
  +attendues.length+' scripts en ligne admis par empreinte)');
