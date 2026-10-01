#!/usr/bin/env node
// LES GESTES DELEGUES, relus contre le code. Voir « GESTES DELEGUES » en tete
// de app/rc-core.<build>.js.
//
// Depuis que script-src ne porte plus 'unsafe-inline', un onclick="…" ecrit
// dans une chaine HTML est un bouton MORT en production (et vivant sur un
// serveur local sans en-tete : la faute ne se voit pas en l'ecrivant). Et un
// data-on-click="f()" dont f n'est pas dans RC_ACTIONS est refuse par le
// moteur. Ce script tient les deux :
//   · aucun attribut on<evenement>= dans app/index.html, rc-core, motion-lab ;
//   · la table blanche RC_ACTIONS (bloc « actions:debut / actions:fin » en fin
//     de rc-core et de motion-lab.js) est EXACTEMENT ce que le code demande ;
//   · chaque geste dont le texte se lit dans la source s'analyse, et n'appelle
//     que des fonctions inscrites et des variables de RC_GESTE_VARS.
//
//   node scripts/verif/gestes.mjs            verifie (code de sortie 1 si faute)
//   node scripts/verif/gestes.mjs --ecrire   recrit les deux tables
//
// QUI ENTRE DANS LA TABLE : toute fonction declaree au premier niveau dont le
// nom apparait, suivi d'une parenthese, DANS UNE CHAINE du code (c'est la que
// vivent les gestes, y compris ceux qu'une fonction recoit en argument :
// emptyState(…,'openX()')) ou dans un attribut data-on-* de index.html. Quand
// le nom est compose a l'execution (`${fn}(${i})`), on le declare a cote par
// un commentaire :   // actions-en-plus: moveDay copierJour
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
import vm from 'node:vm';

const ECRIRE=process.argv.includes('--ecrire');
const coreNom=readdirSync('app').find((f)=>/^rc-core\.\d+\.js$/.test(f));
const FICHIERS={core:'app/'+coreNom, ml:'app/motion-lab.js', html:'app/index.html'};
const src={}; for(const k in FICHIERS) src[k]=readFileSync(FICHIERS[k],'utf8');
const fautes=[];

// ── Un lexeur JavaScript minimal : chaines, gabarits, commentaires, regex ────
const MOTS_AVANT_REGEX=new Set(['return','typeof','case','in','of','delete','void','throw','new','else','do','instanceof','yield','await']);
export function lexer(s){
  const J=[]; let i=0; const n=s.length;
  const pile=[]; // gabarits ouverts : profondeur d'accolades au moment du ${
  let acc=0;
  let dern=null; // dernier jeton significatif
  const pousse=(t)=>{ J.push(t); if(t.t!=='com') dern=t; };
  const quasi=(debut)=>{ // lit un morceau de gabarit depuis debut ; rend l'indice apres
    let j=debut;
    while(j<n){
      const c=s[j];
      if(c==='\\'){ j+=2; continue; }
      if(c==='`'){ pousse({t:'tplq',v:s.slice(debut,j),a:debut,fin:true}); return j+1; }
      if(c==='$'&&s[j+1]==='{'){ pousse({t:'tplq',v:s.slice(debut,j),a:debut,fin:false}); pile.push(acc); acc=0; return j+2; }
      j++;
    }
    throw new Error('gabarit non ferme en '+debut);
  };
  while(i<n){
    const c=s[i];
    if(c===' '||c==='\n'||c==='\r'||c==='\t'||c===' '||c==='﻿'){ i++; continue; }
    if(c==='/'&&s[i+1]==='/'){ let j=s.indexOf('\n',i); if(j<0) j=n; J.push({t:'com',v:s.slice(i,j),a:i}); i=j; continue; }
    if(c==='/'&&s[i+1]==='*'){ let j=s.indexOf('*/',i+2); if(j<0) j=n; J.push({t:'com',v:s.slice(i,j+2),a:i}); i=j+2; continue; }
    if(c==="'"||c==='"'){
      let j=i+1;
      while(j<n&&s[j]!==c){ if(s[j]==='\\') j++; if(s[j]==='\n'&&s[j-1]!=='\\') break; j++; }
      pousse({t:'str',q:c,v:s.slice(i+1,j),a:i}); i=j+1; continue;
    }
    if(c==='`'){ pousse({t:'tpl',a:i}); i=quasi(i+1); continue; }
    if(c==='{'){ acc++; pousse({t:'p',v:c,a:i}); i++; continue; }
    if(c==='}'){
      if(acc===0&&pile.length){ acc=pile.pop(); pousse({t:'tplr',a:i}); i=quasi(i+1); continue; }
      acc--; pousse({t:'p',v:c,a:i}); i++; continue;
    }
    if(c==='/'){
      const regex=!dern||(dern.t==='p'&&dern.v!==')'&&dern.v!==']'&&dern.v!=='}')||(dern.t==='id'&&MOTS_AVANT_REGEX.has(dern.v))||dern.t==='tpl'||(dern.t==='tplq'&&!dern.fin);
      if(regex){
        let j=i+1, classe=false;
        while(j<n){ const d=s[j];
          if(d==='\\'){ j+=2; continue; }
          if(d==='\n') break;
          if(d==='[') classe=true; else if(d===']') classe=false;
          else if(d==='/'&&!classe) break;
          j++; }
        j++; while(j<n&&/[a-z]/.test(s[j])) j++;
        pousse({t:'re',v:s.slice(i,j),a:i}); i=j; continue;
      }
    }
    if(/[A-Za-z_$À-￿]/.test(c)){
      let j=i+1; while(j<n&&/[\w$À-￿]/.test(s[j])) j++;
      pousse({t:'id',v:s.slice(i,j),a:i}); i=j; continue;
    }
    if(/[0-9]/.test(c)||(c==='.'&&/[0-9]/.test(s[i+1]||''))){
      let j=i+1; while(j<n&&/[\w.]/.test(s[j])) j++;
      pousse({t:'num',v:s.slice(i,j),a:i}); i=j; continue;
    }
    pousse({t:'p',v:c,a:i}); i++;
  }
  return J;
}
const deschappe=(v)=>v.replace(/\\(\r?\n|[\s\S])/g,(_,c)=>c==='n'?'\n':c==='t'?'\t':c[0]==='\n'||c[0]==='\r'?'':c);
const entites=(s)=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(+d))
  .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const _debuts=new Map();
const ligneDe=(s,a)=>{
  let d=_debuts.get(s);
  if(!d){ d=[0]; for(let i=0;i<s.length;i++) if(s.charCodeAt(i)===10) d.push(i+1); _debuts.set(s,d); }
  let g=0, h=d.length-1;
  while(g<h){ const m=(g+h+1)>>1; if(d[m]<=a) g=m; else h=m-1; }
  return g+1;
};

// ── Les declarations de premier niveau ───────────────────────────────────────
function declarations(J){
  const d=new Set(); let prof=0;
  for(let i=0;i<J.length;i++){
    const t=J[i];
    if(t.t==='tpl'){ // sauter le gabarit entier
      let ouverts=1; while(ouverts&&++i<J.length){ if(J[i].t==='tpl') ouverts++; else if(J[i].t==='tplq'&&J[i].fin) ouverts--; }
      continue;
    }
    if(t.t==='p'){ if(t.v==='{'||t.v==='('||t.v==='[') prof++; else if(t.v==='}'||t.v===')'||t.v===']') prof--; continue; }
    if(prof!==0||t.t!=='id') continue;
    if(t.v==='function'){ let k=i+1; if(J[k]&&J[k].t==='p'&&J[k].v==='*') k++; if(J[k]&&J[k].t==='id') d.add(J[k].v); }
    else if(t.v==='const'||t.v==='let'||t.v==='var'){ const k=J[i+1]; if(k&&k.t==='id') d.add(k.v); }
  }
  return d;
}

// ── Les gestes ecrits dans les chaines ───────────────────────────────────────
// Rend [{evt, texte, a}] : le texte du geste, les parties calculees remplacees
// par 0. `texte` vaut null quand la fin du geste n'a pas ete trouvee.
function gestesDuCode(J){
  const out=[];
  const RE=/data-on-([a-z]+)="/g;
  for(let i=0;i<J.length;i++){
    const t=J[i];
    if(t.t!=='str'&&t.t!=='tplq') continue;
    const txt=deschappe(t.v);
    RE.lastIndex=0; let m;
    while((m=RE.exec(txt))){
      let corps=txt.slice(RE.lastIndex);
      const f=corps.indexOf('"');
      if(f>=0){ out.push({evt:m[1],texte:corps.slice(0,f),a:t.a}); continue; }
      // Le geste deborde de ce jeton : on suit le gabarit ou la concatenation.
      let k=i, trou=false, fini=false, prof=0, imbr=0;
      let mode=(t.t==='tplq'&&!t.fin)?'trou-gabarit':'concat';
      const ajoute=(x)=>{ if(trou){ corps+='0'; trou=false; } corps+=x;
        const g=corps.indexOf('"'); if(g>=0){ corps=corps.slice(0,g); fini=true; } };
      while(!fini&&++k<J.length){
        const u=J[k];
        if(u.t==='com') continue;
        if(mode==='trou-gabarit'){
          // dans un ${…} du gabarit porteur : tout est calcule, jusqu'a son }
          trou=true;
          if(u.t==='tpl') imbr++;
          else if(u.t==='tplq'&&u.fin&&imbr>0) imbr--;
          else if(u.t==='tplr'&&imbr===0) mode='texte-gabarit';
          continue;
        }
        if(mode==='texte-gabarit'){ ajoute(deschappe(u.v)); mode=u.fin?'concat':'trou-gabarit'; continue; }
        // concat : les chaines de premier niveau sont du texte, le reste est calcule
        if(u.t==='p'){
          if(u.v==='('||u.v==='['||u.v==='{'){ prof++; trou=true; continue; }
          if(u.v===')'||u.v===']'||u.v==='}'){ prof--; if(prof<0) break; trou=true; continue; }
          if(prof===0&&(u.v===';'||u.v===',')) break;
          if(u.v!=='+'||prof>0) trou=true;
          continue;
        }
        if(prof===0&&u.t==='str'){ ajoute(deschappe(u.v)); continue; }
        if(prof===0&&u.t==='tpl'){ mode='texte-gabarit'; continue; }
        if(u.t==='tpl'){ // gabarit dans une parenthese : on le saute en entier
          let n=1; while(n&&++k<J.length){ if(J[k].t==='tpl') n++; else if(J[k].t==='tplq'&&J[k].fin) n--; }
        }
        trou=true;
      }
      out.push({evt:m[1],texte:fini?corps:null,a:t.a});
      break; // le reste de ce jeton appartient au geste qu'on vient de suivre
    }
  }
  return out;
}

// ── Le moteur, tel qu'il est dans rc-core ────────────────────────────────────
const mm=/\/\/ gestes:debut\n([\s\S]*?)\/\/ gestes:fin/.exec(src.core);
if(!mm){ console.error('gestes : le bloc « gestes:debut / gestes:fin » manque dans '+FICHIERS.core); process.exit(1); }
const bac={console}; vm.createContext(bac);
vm.runInContext(mm[1]+'\n;globalThis.__g={rcGesteNoms,RC_GESTE_BULLE,RC_GESTE_CIBLE};',bac);
const {rcGesteNoms,RC_GESTE_BULLE,RC_GESTE_CIBLE}=bac.__g;
const EVTS=new Set([...RC_GESTE_BULLE,...RC_GESTE_CIBLE]);

// ── 1. Aucun gestionnaire en ligne ───────────────────────────────────────────
const RE_ON=/(?<=[\s"'`])on[a-z]+\s*=\s*\\?["']/g;
for(const k in FICHIERS){
  const sansCom=k==='html'?src[k].replace(/<!--[\s\S]*?-->/g,(x)=>x.replace(/[^\n]/g,' ')).replace(/<script[^>]*>[\s\S]*?<\/script>/g,(x)=>x.replace(/[^\n]/g,' ')):null;
  if(k==='html'){
    for(const m of sansCom.matchAll(RE_ON)) fautes.push(FICHIERS[k]+':'+ligneDe(src[k],m.index)+' attribut en ligne « '+m[0]+' » (ecrire data-on-…)');
  }
}
const jetons={core:lexer(src.core), ml:lexer(src.ml)};
const blocsHtml=[...src.html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m)=>m[1]);
for(const k of ['core','ml']) for(const t of jetons[k]){
  if(t.t!=='str'&&t.t!=='tplq') continue;
  for(const m of deschappe(t.v).matchAll(RE_ON)) fautes.push(FICHIERS[k]+':'+ligneDe(src[k],t.a)+' attribut en ligne « '+m[0]+' » (ecrire data-on-…)');
}
for(const b of blocsHtml) for(const t of lexer(b)){
  if(t.t!=='str'&&t.t!=='tplq') continue;
  for(const m of deschappe(t.v).matchAll(RE_ON)) fautes.push(FICHIERS.html+' (script en ligne) attribut en ligne « '+m[0]+' »');
}

// ── 2. Ce que le code demande ────────────────────────────────────────────────
const decl={core:declarations(jetons.core), ml:declarations(jetons.ml)};
for(const b of blocsHtml) for(const d of declarations(lexer(b))) decl.core.add(d);
const voulu={core:new Set(), ml:new Set()};
const inscrire=(nom,ou)=>{
  if(decl.core.has(nom)) voulu.core.add(nom);
  else if(decl.ml.has(nom)) voulu.ml.add(nom);
  else if(ou) fautes.push(ou+' appelle « '+nom+' », qui n est declaree nulle part au premier niveau');
};
// 2a. les noms suivis d'une parenthese dans une chaine
const RE_APPEL=/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g;
for(const k of ['core','ml']) for(const t of jetons[k]){
  if(t.t==='com'){ const d=/^\/[/*]\s*actions-en-plus\s*:\s*([\w$ ,]+)/.exec(t.v);
    if(d) for(const nom of d[1].split(/[\s,]+/).filter(Boolean)) inscrire(nom,FICHIERS[k]+':'+ligneDe(src[k],t.a)+' (actions-en-plus)');
    continue; }
  if(t.t!=='str'&&t.t!=='tplq') continue;
  for(const m of t.v.matchAll(RE_APPEL)) inscrire(m[1],null);
}
// 2b. les gestes lisibles : analyse, fonctions, variables
const varsMm=/\/\/ gestes-vars:debut\n([\s\S]*?)\/\/ gestes-vars:fin/.exec(src.core);
const varsDites=new Set(varsMm?[...varsMm[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:\s*\[/gm)].map((m)=>m[1]):[]);
let lus=0, illisibles=0;
const examiner=(evt,texte,ou)=>{
  if(!EVTS.has(evt)){ fautes.push(ou+' data-on-'+evt+' : evenement que le moteur n ecoute pas (RC_GESTE_BULLE / RC_GESTE_CIBLE)'); return; }
  if(texte===null){ illisibles++; fautes.push(ou+' geste dont la fin n a pas ete trouvee'); return; }
  const t=entites(texte);
  if(/^\s*0?\s*$/.test(t)) return;            // vide, ou entierement calcule
  let r;
  try{ r=rcGesteNoms(t); }catch(e){ fautes.push(ou+' geste illisible ('+e.message+') : '+t.slice(0,120)); return; }
  lus++;
  for(const f of r.fonctions) inscrire(f,ou);
  for(const v of r.variables) if(!varsDites.has(v)) fautes.push(ou+' lit « '+v+' », absente de RC_GESTE_VARS : '+t.slice(0,120));
};
for(const k of ['core','ml']) for(const g of gestesDuCode(jetons[k])) examiner(g.evt,g.texte,FICHIERS[k]+':'+ligneDe(src[k],g.a));
// 2c. LES GESTES PASSES EN ARGUMENT : emptyState(…,'Réessayer','bqRecharger()').
// Leur texte n'est pas a cote d'un data-on-*, mais c'est une chaine ENTIERE qui
// commence par une action et finit par une parenthese. Elle doit s'analyser
// aussi : une fonction flechee ou un await y passeraient inapercus, et le
// bouton ne ferait rien (trouve au banc des boutons, « Réessayer » de la banque).
const RE_ENTIER=/^([A-Za-z_$][\w$]*)\([^<>]*\);?$/;
for(const k of ['core','ml']) for(const t of jetons[k]){
  if(t.t!=='str') continue;
  const m=RE_ENTIER.exec(t.v);
  if(!m||!(decl.core.has(m[1])||decl.ml.has(m[1]))) continue;
  const texte=entites(deschappe(t.v));
  try{ const r=rcGesteNoms(texte);
    for(const v of r.variables) if(!varsDites.has(v)) fautes.push(FICHIERS[k]+':'+ligneDe(src[k],t.a)+' le geste « '+texte.slice(0,80)+' » lit « '+v+' », absente de RC_GESTE_VARS');
  }catch(e){ fautes.push(FICHIERS[k]+':'+ligneDe(src[k],t.a)+' chaine qui a la forme d un geste et ne s analyse pas ('+e.message+') : '+texte.slice(0,100)); }
}
{
  const sans=src.html.replace(/<!--[\s\S]*?-->/g,(x)=>x.replace(/[^\n]/g,' ')).replace(/<script[^>]*>[\s\S]*?<\/script>/g,(x)=>x.replace(/[^\n]/g,' '));
  for(const m of sans.matchAll(/data-on-([a-z]+)="([^"]*)"/g)) examiner(m[1],m[2],FICHIERS.html+':'+ligneDe(src.html,m.index));
}

// ── 3. Les tables ────────────────────────────────────────────────────────────
const RE_TABLE=/\/\/ actions:debut\n[\s\S]*?\/\/ actions:fin\n?/;
const table=(noms)=>{
  const l=[...noms].sort(); const lignes=[]; let cur='';
  for(const nm of l){ if((cur+nm).length>110){ lignes.push(cur); cur=''; } cur+=(cur?',':'')+nm; }
  if(cur) lignes.push(cur);
  return '// actions:debut\n// TABLE BLANCHE DES GESTES. Ecrite par `node scripts/verif/gestes.mjs --ecrire` : ne pas\n'
    +'// la retoucher a la main, la CI la compare a ce que le code demande.\nrcActions({\n'+lignes.map((x)=>'  '+x).join(',\n')+'\n});\n// actions:fin\n';
};
let ecrit=0;
for(const k of ['core','ml']){
  const neuf=table(voulu[k]);
  const m=RE_TABLE.exec(src[k]);
  if(m&&m[0]===neuf) continue;
  if(ECRIRE){
    const t=m?src[k].replace(RE_TABLE,()=>neuf):src[k].replace(/\n*$/,'\n')+neuf;
    writeFileSync(FICHIERS[k],t); ecrit++;
  } else {
    const avant=new Set(m?[...m[0].matchAll(/^\s{2}(.+?),?$/gm)].flatMap((x)=>x[1].split(',')).filter(Boolean):[]);
    const manque=[...voulu[k]].filter((x)=>!avant.has(x)), trop=[...avant].filter((x)=>!voulu[k].has(x));
    fautes.push(FICHIERS[k]+' : la table RC_ACTIONS n est pas a jour'
      +(manque.length?' ; manquent '+manque.slice(0,12).join(', '):'')+(trop.length?' ; en trop '+trop.slice(0,12).join(', '):'')
      +' — lancer `node scripts/verif/gestes.mjs --ecrire`');
  }
}
if(fautes.length){ console.error('Gestes :\n  '+fautes.slice(0,80).join('\n  ')+(fautes.length>80?'\n  … et '+(fautes.length-80)+' autres':'')); process.exit(1); }
console.log('Gestes : aucun gestionnaire en ligne ; '+lus+' gestes analyses ; table blanche a jour ('
  +voulu.core.size+' actions dans rc-core, '+voulu.ml.size+' dans motion-lab)'+(ecrit?' — '+ecrit+' table(s) recrite(s)':''));
