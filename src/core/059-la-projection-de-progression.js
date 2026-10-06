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
