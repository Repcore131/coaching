// ══ LA PROJECTION DE PROGRESSION (06/10/2026, build 1830) ════════════════
//
// La fiche coach disait « en progression », « plateau » — un état, jamais un
// rythme. Pour les trois exercices principaux de l'athlète, une carte compacte :
// l'e1RM des six dernières semaines (la sparkline des états), sa pente en
// kg/semaine, « au rythme actuel : 100 kg × 5 vers le 14 décembre », et le
// volume hebdomadaire moyen du muscle avec sa zone MEV / MAV / MRV. Au-delà de
// huit semaines, la DOSE-RÉPONSE : sa progression comparée entre ses semaines
// à volume haut et à volume bas.
//
// RIEN DE NOUVEAU À SAISIR, RIEN QUAND LES DONNÉES MANQUENT : sous quatre
// points, pas de projection ; une pente nulle ou négative, pas de projection ;
// au-delà de douze semaines, pas de date ; un écart de pente dans le bruit,
// pas de phrase de dose-réponse.
const PROJ_SEMAINES=6;
const PROJ_POINTS_MIN=4;
const PROJ_HORIZON_SEM=12;
const PROJ_PAS_CIBLE=5;            // la cible : le multiple de 5 kg suivant
const PROJ_EXOS=3;
const DOSE_SEMAINES_MIN=8, DOSE_SEMAINES_MAX=16, DOSE_GROUPE_MIN=3;
const _J_MS=864e5, _SEM_MS=7*864e5;

// PURE. Le meilleur e1RM de chaque semaine où l'exercice a été fait, sur les
// `n` dernières semaines : [{cle, t (lundi), v}], du plus ancien au plus récent.
function semainesE1rm(u,nomEx,maintenant,n){
  const t=Number(maintenant)||Date.now();
  const debut=_lundiDe(new Date(t-((n||PROJ_SEMAINES)-1)*_SEM_MS)).getTime();
  const par=new Map();
  for(const s of ((u&&u.sessions)||[])){
    if(!s||!s.data||s.deload||!(s.date>=debut&&s.date<=t)) continue;
    let p=null; try{ p=perfExercice(s,nomEx,u); }catch(e){ p=null; }
    if(!p||!(p.score>0)) continue;
    const l=_lundiDe(new Date(s.date)).getTime(), cle=semaineISO(new Date(s.date));
    const x=par.get(cle);
    if(!x||p.score>x.v) par.set(cle,{cle,t:l,v:p.score});
  }
  return Array.from(par.values()).sort((a,b)=>a.t-b.t);
}
// PURE. Les moindres carrés sur des points datés : pente par SEMAINE.
function _projRegression(points){
  const n=points.length;
  if(n<2) return null;
  const xs=points.map(p=>p.t/_SEM_MS), ys=points.map(p=>p.v);
  const mx=xs.reduce((a,b)=>a+b,0)/n, my=ys.reduce((a,b)=>a+b,0)/n;
  let num=0, den=0;
  for(let i=0;i<n;i++){ num+=(xs[i]-mx)*(ys[i]-my); den+=(xs[i]-mx)*(xs[i]-mx); }
  if(!den) return null;
  const pente=num/den;
  return {pente,a:my-pente*mx};
}
/**
 * PURE. La projection : {pente (kg e1RM/semaine), e1rm (aujourd'hui), cible
 * (kg), reps, semaines, date}, ou null — moins de 4 points, pente ≤ 0, ou
 * une cible au-delà de 12 semaines.
 * La cible : le multiple de 5 kg suivant la charge que l'e1RM permet
 * aujourd'hui à `reps` répétitions (RIR 0, la réciproque de e1rm()).
 */
function projectionE1rm(points,reps,maintenant){
  const pts=(points||[]).filter(p=>p&&p.v>0&&p.t>0);
  if(pts.length<PROJ_POINTS_MIN) return null;
  const r=_projRegression(pts);
  if(!r||!(r.pente>0)) return null;
  const t=Number(maintenant)||Date.now();
  const nRep=Math.max(1,Math.round(Number(reps)||5));
  const actuel=r.a+r.pente*(t/_SEM_MS);
  if(!(actuel>0)) return null;
  const capacite=chargePourReps(actuel,nRep,0);
  let cible=Math.ceil(capacite/PROJ_PAS_CIBLE)*PROJ_PAS_CIBLE;
  if(cible-capacite<0.5) cible+=PROJ_PAS_CIBLE;
  const semaines=(e1rm(cible,nRep,0)-actuel)/r.pente;
  if(!(semaines>0)||semaines>PROJ_HORIZON_SEM) return null;
  return {pente:r.pente,e1rm:actuel,cible,reps:nRep,semaines,date:t+semaines*_SEM_MS};
}
/**
 * PURE. LA DOSE-RÉPONSE. `semaines` : [{vol, v}] chronologiques, semaine par
 * semaine. Le gain d'e1RM d'une semaine à la suivante est attribué au volume
 * de la première ; les semaines se rangent en « volume haut » et « volume bas »
 * autour de la médiane. Rend {mieux, moins} (volumes moyens, arrondis) ou
 * null : moins de 8 semaines, moins de 3 dans un groupe, ou un écart de pente
 * qui ne dépasse pas DEUX FOIS LE BRUIT (l'erreur type de la différence).
 */
function doseReponse(semaines){
  const l=(semaines||[]).filter(x=>x&&x.v>0&&isFinite(Number(x.vol)));
  if(l.length<DOSE_SEMAINES_MIN) return null;
  const d=[];
  for(let i=0;i<l.length-1;i++) d.push({vol:Number(l[i].vol),gain:l[i+1].v-l[i].v});
  const vols=d.map(x=>x.vol).slice().sort((a,b)=>a-b);
  const med=vols[Math.floor(vols.length/2)];
  const haut=d.filter(x=>x.vol>med), bas=d.filter(x=>x.vol<=med);
  if(haut.length<DOSE_GROUPE_MIN||bas.length<DOSE_GROUPE_MIN) return null;
  const moy=a=>a.reduce((s,x)=>s+x,0)/a.length;
  const gH=moy(haut.map(x=>x.gain)), gB=moy(bas.map(x=>x.gain));
  const tous=d.map(x=>x.gain), m=moy(tous);
  const sd=Math.sqrt(tous.reduce((s,x)=>s+(x-m)*(x-m),0)/Math.max(1,tous.length-1));
  const bruit=sd*Math.sqrt(1/haut.length+1/bas.length);
  if(!(Math.abs(gH-gB)>2*bruit)) return null;
  const vH=Math.round(moy(haut.map(x=>x.vol))), vB=Math.round(moy(bas.map(x=>x.vol)));
  return gH>gB?{mieux:vH,moins:vB,ecart:gH-gB,bruit}:{mieux:vB,moins:vH,ecart:gB-gH,bruit};
}
// Les exercices principaux : les plus fréquents sur les 6 dernières semaines,
// à charge externe, hors cardio. Le muscle primaire suit la classification de
// l'athlète (resoudreMusclesLecture).
function exercicesPrincipaux(u,maintenant,n){
  const t=Number(maintenant)||Date.now(), debut=t-PROJ_SEMAINES*_SEM_MS;
  const cpt=new Map();
  for(const s of ((u&&u.sessions)||[])){
    if(!s||!s.data||s.deload||!(s.date>=debut&&s.date<=t)) continue;
    for(const nom of Object.keys(s.data)){
      try{ if(isCardio({name:nom,reps:''})||typeCharge(_exPourCharge(nom,u))!=='externe') continue; }catch(e){ continue; }
      const k=exKey(nom), x=cpt.get(k)||{nom,n:0,der:0};
      x.n++; x.der=Math.max(x.der,s.date); cpt.set(k,x);
    }
  }
  return Array.from(cpt.values()).sort((a,b)=>(b.n-a.n)||(b.der-a.der)).slice(0,n||PROJ_EXOS);
}
function _projMuscle(u,nom){
  try{ const c=resoudreMusclesLecture(nom,{name:nom},u); return (c&&c!==VOL_CARDIO&&(c.p||[])[0])||null; }catch(e){ return null; }
}
// Le volume hebdomadaire moyen d'un muscle sur les `n` dernières semaines
// RÉVOLUES, et sa zone.
function volumeMoyenMuscle(u,muscle,n){
  if(!muscle) return null;
  const vals=[];
  for(let k=1;k<=(n||PROJ_SEMAINES);k++){
    let v=null; try{ v=(volumeSemaine(u,_volCleDecalee(k))||{})[muscle]; }catch(e){ v=null; }
    vals.push(Number(v)||0);
  }
  const moy=vals.reduce((a,b)=>a+b,0)/vals.length;
  if(!(moy>0)) return null;
  let r=null; try{ r=reperesEffectifs(u,muscle); }catch(e){ r=null; }
  const zone=!r?null:moy<r.mev?'sous le MEV':moy<r.mavMin?'entre MEV et MAV':moy<=r.mavMax?'dans le MAV':moy<=r.mrv?'haut du MAV':'au-dessus du MRV';
  return {moy:Math.round(moy*10)/10,zone};
}
// Les semaines {vol, v} de la dose-réponse : e1RM et volume du muscle.
function _doseSemaines(u,nom,muscle,maintenant){
  const pts=semainesE1rm(u,nom,maintenant,DOSE_SEMAINES_MAX);
  return pts.map(p=>{ let v=0; try{ v=Number((volumeSemaine(u,p.cle)||{})[muscle])||0; }catch(e){ v=0; } return {vol:v,v:p.v}; });
}
const _projDate=t=>{ try{ return new Date(t).toLocaleDateString('fr-FR',{day:'numeric',month:'long'}); }catch(e){ return ''; } };
const _projKg=v=>String(Math.round(v*10)/10).replace('.',',');
// Les répétitions de référence : le bas de la fourchette prescrite, sinon 5.
function _projReps(u,nom){
  for(const sc of ((u&&u.sessions_config)||[])){
    for(const ex of ((sc&&sc.exercises)||[])){
      if(!ex||exKey(ex.name||'')!==exKey(nom)) continue;
      const f=fourchetteReps(ex.reps); if(f) return f.min;
      const n=parseInt(ex.reps,10); if(n>0&&n<=12) return n;
    }
  }
  return 5;
}
// PURE au rendu près. Les cartes, ou '' quand rien n'a de quoi s'afficher.
function htmlProjectionsCoach(u,maintenant){
  const t=Number(maintenant)||Date.now();
  const cartes=[];
  for(const x of exercicesPrincipaux(u,t,PROJ_EXOS)){
    const pts=semainesE1rm(u,x.nom,t,PROJ_SEMAINES);
    if(pts.length<2) continue;
    const reps=_projReps(u,x.nom);
    const pr=projectionE1rm(pts,reps,t);
    const reg=_projRegression(pts);
    const muscle=_projMuscle(u,x.nom);
    const vol=volumeMoyenMuscle(u,muscle,PROJ_SEMAINES);
    const dose=muscle?doseReponse(_doseSemaines(u,x.nom,muscle,t)):null;
    const l=[];
    l.push('e1RM sur '+PROJ_SEMAINES+' semaines : '+_projKg(pts[0].v)+' → '+_projKg(pts[pts.length-1].v)+' kg'
      +(reg?' · '+(reg.pente>=0?'+':'')+_projKg(reg.pente)+' kg/semaine':''));
    if(pr) l.push('Au rythme actuel : '+_projKg(pr.cible)+' kg × '+pr.reps+' vers le '+_projDate(pr.date));
    if(vol) l.push(_bbMuscle(muscle).replace(/^./,c=>c.toUpperCase())+' : '+_projKg(vol.moy)+' séries / semaine'+(vol.zone?' · '+vol.zone:''));
    if(dose) l.push('Ses '+_bbMuscle(muscle)+' ont mieux progressé autour de '+dose.mieux+' séries que de '+dose.moins+'.');
    cartes.push('<div class="proj-carte" style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:10px 14px;margin-bottom:8px">'
      +'<div style="font-size:var(--fs-sm);font-weight:800;color:var(--text-strong)">'+escapeHtml(x.nom)+'</div>'
      +_sparkline(pts.map(p=>p.v),'var(--sub)')
      +l.map(s=>'<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6">'+escapeHtml(s)+'</div>').join('')
      +'</div>');
  }
  return cartes.join('');
}
// ══════════════════════════════════════════════════════════════════════════
//  LA LANGUE DE L'APP (07/10/2026) : français, anglais, portugais, espagnol
// ══════════════════════════════════════════════════════════════════════════
//
// Kevin : « donne la possibilité en s'inscrivant de choisir sa langue, et toute
// l'app s'adapte et traduit ».
//
// LE CODE RESTE EN FRANÇAIS. L'app porte plus de douze mille textes écrits
// dans le code ; les passer un par un par une table de clés aurait demandé de
// réécrire chaque écran. À la place, UN TRADUCTEUR remplace à l'écran ce qui
// vient d'être affiché :
//   - chaque nœud de texte et chaque attribut lisible (title, placeholder,
//     aria-label, alt) est cherché dans le dictionnaire de la langue ;
//   - un texte fixe se traduit tel quel (« Annuler ») ; une phrase à variable
//     passe par un MOTIF (« {0} séances cette semaine ») ;
//   - les textes dessinés (visuels à partager) passent par le même traducteur.
// Les dictionnaires sont app/i18n/<langue>.json, fabriqués à partir de
// scripts/i18n_extraire.mjs. Un texte absent du dictionnaire RESTE EN FRANÇAIS :
// jamais de case vide, jamais de clé à l'écran.
//
// ⚠ EN FRANÇAIS, RIEN DE TOUT CECI NE TOURNE : aucun observateur, aucune
//   lecture de dictionnaire, aucun coût. La suite de tests juge donc l'app
//   telle qu'elle a toujours été.
// ⚠ LA LANGUE EST UN CHOIX, jamais une déduction : sans choix explicite (à
//   l'inscription, ou dans le profil), l'app est en français, quel que soit
//   le réglage du téléphone.
// ⚠ CE QUI N'EST PAS TRADUIT, et c'est voulu : ce que l'utilisateur écrit
//   lui-même, le nom des aliments du répertoire, les pages légales.
const RC_LANGUES=Object.freeze(['fr','en','pt','es']);
const RC_LANGUES_NOMS=Object.freeze({fr:'Français',en:'English',pt:'Português',es:'Español'});
// La région des dates et des nombres, par langue.
const RC_LANGUES_REGION=Object.freeze({fr:'fr-FR',en:'en-GB',pt:'pt-PT',es:'es-ES'});
const RC_LANGUE_CLE='rc_langue';
const _rcI18n={langue:'fr',pret:false,exact:null,casse:null,plat:null,rates:null,parDebut:null,parFin:null,reste:null,cache:new Map(),obs:null,enCours:null};

// PURE. La langue choisie, 'fr' à défaut. Le dossier (u.langue) suit le compte
// d'un appareil à l'autre ; l'appareil garde le dernier choix pour les écrans
// d'avant la connexion.
function rcLangue(){
  let l=''; try{ l=String(localStorage.getItem(RC_LANGUE_CLE)||''); }catch(e){ l=''; }
  return RC_LANGUES.indexOf(l)>=0?l:'fr';
}
// PURE. La même normalisation que scripts/i18n_extraire.mjs (norme) : toute
// suite d'espaces, insécables ou fines comprises, vaut une espace ; bords rognés.
function rcI18nNorme(s){ return String(s).replace(/[\s   ​⁠]+/g,' ').trim(); }
// PURE. Sans casse ni accents : « Soulevé de terre » et « SOULEVE DE TERRE » se retrouvent.
function _rcI18nPlat(s){ return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
// Rend à une traduction la casse du texte d'origine (CAPITALES, Majuscule initiale).
function _rcI18nCasse(n,c){
  const reg=RC_LANGUES_REGION[_rcI18n.langue]||undefined, bas=n.toLocaleLowerCase('fr-FR');
  if(n===n.toLocaleUpperCase('fr-FR')&&n!==bas) return c.toLocaleUpperCase(reg);
  if(n.charAt(0)!==bas.charAt(0)&&n.slice(1)===bas.slice(1)){ const cb=c.toLocaleLowerCase(reg); return cb.charAt(0).toLocaleUpperCase(reg)+cb.slice(1); }
  if(n===bas) return c.toLocaleLowerCase(reg);
  return c;
}
function _rcI18nEchapper(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
// Pose un dictionnaire {x:{fr:tr}, m:[[motif,tr],…]} et en construit les index.
function rcI18nPoser(langue,dico){
  const S=_rcI18n;
  S.langue=langue; S.cache=new Map();
  S.exact=new Map(); S.casse=new Map(); S.plat=new Map(); S.parDebut=new Map(); S.parFin=new Map(); S.reste=[];
  const x=(dico&&dico.x)||{};
  for(const k in x){
    const v=x[k]; if(typeof v!=='string'||!v||v===k) continue;
    S.exact.set(k,v);
    const b=k.toLocaleLowerCase('fr-FR'); if(!S.casse.has(b)) S.casse.set(b,v);
    const p=_rcI18nPlat(k); if(!S.plat.has(p)) S.plat.set(p,v);
  }
  const m=((dico&&dico.m)||[]).map(e=>{
    const morceaux=String(e[0]).split(/\{\d+\}/), ordre=(String(e[0]).match(/\{(\d+)\}/g)||[]).map(t=>Number(t.slice(1,-1)));
    return {src:e[0],tr:e[1],morceaux,ordre,fixe:morceaux.join('').length,re:null};
  }).filter(e=>typeof e.tr==='string'&&e.tr&&e.fixe>=3);
  // Le plus précis d'abord : le motif qui a le plus de texte fixe gagne.
  m.sort((a,b)=>b.fixe-a.fixe);
  for(const e of m){
    const deb=e.morceaux[0], fin=e.morceaux[e.morceaux.length-1];
    if(deb.length>=4){ const k=deb.slice(0,4); (S.parDebut.get(k)||S.parDebut.set(k,[]).get(k)).push(e); }
    else if(fin.length>=4){ const k=fin.slice(-4); (S.parFin.get(k)||S.parFin.set(k,[]).get(k)).push(e); }
    else S.reste.push(e);
  }
  S.pret=langue!=='fr';
  return S.exact.size+m.length;
}
function _rcI18nMotif(n,prof){
  const S=_rcI18n;
  const essai=(liste)=>{
    if(!liste) return null;
    for(const e of liste){
      if(!e.re) e.re=new RegExp('^'+e.morceaux.map(_rcI18nEchapper).join('([\\s\\S]*?)')+'$');
      const r=e.re.exec(n);
      if(!r) continue;
      // Chaque variable est elle-même traduite si elle est un texte connu
      // (« Total : {0} » où {0} vaut « 3 séances »).
      return e.tr.replace(/\{(\d+)\}/g,(tout,i)=>{
        const p=e.ordre.indexOf(Number(i));
        return p<0?'':_rcI18nTexte(r[p+1],prof+1);
      });
    }
    return null;
  };
  return essai(S.parDebut.get(n.slice(0,4)))||essai(S.parFin.get(n.slice(-4)))||essai(S.reste);
}
function _rcI18nTexte(s,prof){
  const S=_rcI18n;
  if(!S.pret||s==null) return s;
  const brut=String(s);
  if(brut.length<2||brut.length>700||!/\p{L}{2}/u.test(brut)) return brut;
  const deja=S.cache.get(brut); if(deja!==undefined) return deja;
  const n=rcI18nNorme(brut);
  let t=S.exact.get(n);
  if(t===undefined){
    // Les bords décoratifs (« ✓ Enregistré », « Séances : ») : le cœur seul est cherché.
    const b=/^([^\p{L}\d]*)([\s\S]*?)([^\p{L}\d]*)$/u.exec(n);
    if(b&&(b[1]||b[3])&&b[2]){
      const c=S.exact.get(b[2]);
      if(c!==undefined) t=b[1]+c+b[3];
    }
  }
  if(t===undefined&&n.length>2){
    // Un texte dont le code a changé la casse, ou écrit avec (ou sans) ses accents :
    // on le retrouve par ses minuscules, puis sans accents, et on lui rend sa casse.
    const bas=n.toLocaleLowerCase('fr-FR');
    let c=(bas!==n)?S.casse.get(bas):undefined;
    if(c===undefined){ c=S.plat.get(_rcI18nPlat(n)); }
    if(c!==undefined) t=_rcI18nCasse(n,c);
  }
  if(t===undefined&&prof<3){ const m0=_rcI18nMotif(n,prof); if(m0!=null) t=m0; }
  if(t===undefined&&prof<3&&n.length>3&&n===n.toLocaleUpperCase('fr-FR')&&n!==n.toLocaleLowerCase('fr-FR')){
    // Une phrase à variable passée en capitales par le code (« 4 SEMAINES »).
    const m=_rcI18nMotif(n.toLocaleLowerCase('fr-FR'),prof);
    if(m!=null) t=m.toLocaleUpperCase(RC_LANGUES_REGION[S.langue]||undefined);
  }
  if(t===undefined&&prof<2){
    // Plusieurs textes posés côte à côte : chacun le sien. D'abord les
    // séparateurs francs (point médian, barre, deux-points, fin de phrase),
    // puis, à défaut, la virgule.
    for(const sep of [/( [·•|] | : |\. (?=\p{Lu}))/u,/(, )/]){
      if(!sep.test(n)) continue;
      const morceaux=n.split(sep);
      let change=false;
      const out2=morceaux.map((x,k)=>{ if(k%2||!x) return x; const y=_rcI18nTexte(x,prof+1); if(y!==x) change=true; return y; });
      if(change){ t=out2.join(''); break; }
    }
  }
  // Pour le diagnostic : ce qui est resté en français (lu par scripts/i18n, jamais par l'app).
  if(t===undefined&&S.rates&&S.rates.size<4000&&/\p{L}{3}/u.test(n)) S.rates.add(n);
  let out=brut;
  if(t!==undefined&&t!==null){
    // Les blancs de bord du nœud sont rendus tels quels : ils font la mise en page.
    out=(/^\s*/.exec(brut)[0])+t+(/\s*$/.exec(brut)[0]);
  }
  if(S.cache.size>12000) S.cache.clear();
  S.cache.set(brut,out);
  return out;
}
// Le texte à montrer dans la langue choisie. En français, ou sans traduction : le texte reçu.
function rcI18nT(s){ return _rcI18n.pret?_rcI18nTexte(s,0):s; }

// ── L'ÉCRAN ────────────────────────────────────────────────────────────────
const _RC_I18N_ATTRS=['title','placeholder','aria-label','alt'];
function _rcI18nHors(el){
  // Ce que l'utilisateur écrit, le code et les zones marquées ne se traduisent pas.
  for(let e=el;e&&e.nodeType===1;e=e.parentElement){
    const t=e.tagName;
    if(t==='SCRIPT'||t==='STYLE'||t==='TEXTAREA'||t==='CODE'||t==='PRE') return true;
    if(e.isContentEditable||e.hasAttribute('data-i18n-off')) return true;
  }
  return false;
}
// ⚠ UNE <option> SANS ATTRIBUT value A POUR VALEUR SON TEXTE. Traduire ce texte
//   ferait enregistrer « Man » là où le code attend « Homme ». On fige donc
//   d'abord la valeur française dans l'attribut, puis on traduit le libellé.
function _rcI18nOption(noeudTexte){
  const p=noeudTexte.parentElement;
  if(p&&p.tagName==='OPTION'&&!p.hasAttribute('value')) p.setAttribute('value',p.textContent);
}
function _rcI18nNoeud(n){
  if(n.nodeType===3){
    const v=n.nodeValue;
    if(!v||n.__rcT===v) return;
    if(n.parentElement&&_rcI18nHors(n.parentElement)) return;
    _rcI18nOption(n);
    const t=_rcI18nTexte(v,0);
    if(t!==v){ n.__rcT=t; n.nodeValue=t; } else n.__rcT=v;
    return;
  }
  if(n.nodeType!==1) return;
  if(n.tagName==='TEXTAREA'&&!n.hasAttribute('data-i18n-off')){ const v=n.getAttribute('placeholder'); if(v){ const t=_rcI18nTexte(v,0); if(t!==v) n.setAttribute('placeholder',t); } return; }
  if(_rcI18nHors(n)) return;
  const attrs=(el)=>{
    for(const a of _RC_I18N_ATTRS){
      const v=el.getAttribute&&el.getAttribute(a);
      if(v){ const t=_rcI18nTexte(v,0); if(t!==v) el.setAttribute(a,t); }
    }
    if(el.tagName==='INPUT'&&/^(button|submit|reset)$/i.test(el.type||'')&&el.value){ const t=_rcI18nTexte(el.value,0); if(t!==el.value) el.value=t; }
  };
  attrs(n);
  const w=document.createTreeWalker(n,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{acceptNode(x){
    if(x.nodeType===1){
      const t=x.tagName;
      if(t==='TEXTAREA'&&!x.hasAttribute('data-i18n-off')){ const v=x.getAttribute('placeholder'); if(v){ const tr=_rcI18nTexte(v,0); if(tr!==v) x.setAttribute('placeholder',tr); } return NodeFilter.FILTER_REJECT; }
      if(t==='SCRIPT'||t==='STYLE'||t==='TEXTAREA'||t==='CODE'||t==='PRE'||x.isContentEditable||x.hasAttribute('data-i18n-off')) return NodeFilter.FILTER_REJECT;
    }
    return NodeFilter.FILTER_ACCEPT;
  }});
  for(let x=w.nextNode();x;x=w.nextNode()){
    if(x.nodeType===1) attrs(x);
    else{ const v=x.nodeValue; if(v&&x.__rcT!==v){ _rcI18nOption(x); const t=_rcI18nTexte(v,0); if(t!==v){ x.__rcT=t; x.nodeValue=t; } else x.__rcT=v; } }
  }
}
function _rcI18nObserver(){
  const S=_rcI18n;
  if(S.obs||typeof MutationObserver==='undefined') return;
  S.obs=new MutationObserver(lot=>{
    for(const m of lot){
      if(m.type==='characterData') _rcI18nNoeud(m.target);
      else if(m.type==='attributes'){
        const el=m.target, v=el.getAttribute(m.attributeName);
        if(v&&!_rcI18nHors(el)){ const t=_rcI18nTexte(v,0); if(t!==v) el.setAttribute(m.attributeName,t); }
      }
      else for(const n of m.addedNodes) _rcI18nNoeud(n);
    }
  });
  S.obs.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:_RC_I18N_ATTRS});
}
// Les textes DESSINÉS : fillText, strokeText et measureText passent par le
// traducteur (les visuels écrivent leurs libellés au pinceau, pas dans le DOM).
let _rcI18nToileFaite=false;
function _rcI18nToile(){
  if(_rcI18nToileFaite||typeof CanvasRenderingContext2D==='undefined') return;
  _rcI18nToileFaite=true;
  const P=CanvasRenderingContext2D.prototype;
  for(const f of ['fillText','strokeText','measureText']){
    const natif=P[f];
    P[f]=function(t){ if(_rcI18n.pret&&typeof t==='string'){ const a=Array.prototype.slice.call(arguments); a[0]=_rcI18nTexte(t,0); return natif.apply(this,a); } return natif.apply(this,arguments); };
  }
}
// Les dates et les nombres : le code les demande en 'fr-FR' ; dans une autre
// langue, la région de cette langue répond à sa place.
let _rcI18nDatesFaites=false;
function _rcI18nDates(){
  if(_rcI18nDatesFaites) return;
  _rcI18nDatesFaites=true;
  const region=(l)=>(_rcI18n.pret&&(l==='fr-FR'||l==='fr'))?(RC_LANGUES_REGION[_rcI18n.langue]||l):l;
  for(const [proto,noms] of [[Date.prototype,['toLocaleDateString','toLocaleTimeString','toLocaleString']],[Number.prototype,['toLocaleString']]]){
    for(const f of noms){
      const natif=proto[f];
      proto[f]=function(l,o){ return arguments.length?natif.call(this,region(l),o):natif.call(this); };
    }
  }
}
async function rcI18nCharger(langue){
  const S=_rcI18n;
  if(RC_LANGUES.indexOf(langue)<0||langue==='fr') return false;
  if(S.pret&&S.langue===langue) return true;
  if(S.enCours&&S.enCours.langue===langue) return S.enCours.p;
  const p=(async()=>{
    try{
      const r=await fetch('./i18n/'+langue+'.json?v='+encodeURIComponent(window.RC_BUILD||''));
      if(!r.ok) return false;
      rcI18nPoser(langue,await r.json());
    }catch(e){ return false; }
    try{ document.documentElement.lang=langue; }catch(e){}
    _rcI18nToile(); _rcI18nDates(); _rcI18nObserver();
    try{ if(document.title) document.title=_rcI18nTexte(document.title,0); }catch(e){}
    try{ _rcI18nNoeud(document.body); }catch(e){}
    return true;
  })();
  S.enCours={langue,p};
  const ok=await p;
  if(S.enCours&&S.enCours.p===p) S.enCours=null;
  return ok;
}
// LE CHOIX. Posé sur l'appareil et, une fois connecté, dans le dossier. Passer
// d'une langue étrangère à une autre (ou revenir au français) recharge la page :
// l'écran porte alors des textes déjà traduits, que plus rien ne sait relire.
function rcLangueChoisir(langue,sansRecharger){
  const l=RC_LANGUES.indexOf(langue)>=0?langue:'fr';
  const avant=rcLangue();
  try{ if(l==='fr') localStorage.removeItem(RC_LANGUE_CLE); else localStorage.setItem(RC_LANGUE_CLE,l); }catch(e){}
  try{
    if(currentUser&&(currentUser.langue||'fr')!==l){
      currentUser.langue=l;
      saveUser(currentUser);
    }
  }catch(e){}
  _rcLangueSelecteurs(l);
  if(l===avant) return true;
  if(avant==='fr'||!_rcI18n.pret){ if(l!=='fr') rcI18nCharger(l); return true; }
  if(!sansRecharger){ try{ location.reload(); }catch(e){} }
  return true;
}
// Les sélecteurs de langue de l'app montrent tous la langue en cours.
function _rcLangueSelecteurs(l){
  try{ document.querySelectorAll('select.rc-langue').forEach(s=>{ if(s.value!==l) s.value=l; }); }catch(e){}
}
function htmlSelecteurLangue(id){
  const l=rcLangue();
  return '<select class="rc-langue" data-i18n-off'+(id?' id="'+id+'"':'')+' onchange="rcLangueChoisir(this.value)" aria-label="Langue · Language · Idioma">'
    +RC_LANGUES.map(k=>'<option value="'+k+'"'+(k===l?' selected':'')+'>'+RC_LANGUES_NOMS[k]+'</option>').join('')+'</select>';
}
// À la connexion : la langue du COMPTE l'emporte sur celle de l'appareil (un
// compte créé en anglais s'ouvre en anglais sur un téléphone neuf). Un compte
// sans langue hérite de celle de l'appareil.
function rcLangueDuCompte(u){
  try{
    if(!u) return false;
    const c=RC_LANGUES.indexOf(u.langue)>=0?u.langue:'';
    const a=rcLangue();
    if(c&&c!==a){ rcLangueChoisir(c); return true; }
    if(!c&&a!=='fr'){ u.langue=a; try{ saveUser(u); }catch(e){} }
  }catch(e){}
  return false;
}
// Au démarrage : la langue de l'appareil, tout de suite.
(function(){
  try{
    const l=rcLangue();
    _rcLangueSelecteurs(l);
    if(l!=='fr') rcI18nCharger(l);
  }catch(e){}
})();
