// ══ LE PILOTE DE SÈCHE (build 1958) ═══════════════════════════════════════
// Il surveille la vitesse de perte (tendancePoids : moyenne mobile 7 jours,
// pente sur 14 jours par régression) et PROPOSE au coach l'ajustement suivant,
// avec son raisonnement (propositionSeche). Le coach valide en un clic ou garde
// comme ça ; rien ne change sans lui. L'athlète ne voit que sa nouvelle cible
// et une phrase.
// Il s'appuie sur ce qui existe, sans le dupliquer :
//   les pesées      serieWeight (pesées et bilans, une par jour) ;
//   les planchers   plancherKcal (absolu, par kilo, masse maigre) et, pour les
//                   lipides, le plus haut de LIP_PLANCHER_G_KG et 0,66 g/kg ;
//   les gardes      drapeau rouge, antécédent alimentaire, grossesse, pause,
//                   déficit au palier de blocage : le pilote se tait, comme
//                   ajustementPropose.
// Stockage : u.nutrition.pilote = {cardioMinSem, histo[12], derniere}
// (database.rules.json, liste blanche). Les kcal passent par ajouterAjustAuto,
// le même chemin que l'ajustement proposé : la grille, le plan et les anneaux
// lisent le même total.

const PILOTE_SECHE=Object.freeze({
  perteCible:Object.freeze([0.5,1.0]),     // % du poids par semaine
  periodeAjustementJours:14,
  phases:3, semainesParPhase:3,
  pasKcal:100,
  ordre:Object.freeze(['cardio','glucides','lipides']),
  plancherLipides:0.66,                     // g/kg
  proteines:Object.freeze([1.8,2.2])        // g/kg, haut de fourchette si déficit important
});
// Valeurs de travail, à confirmer par Kevin : le pas de cardio proposé, et ce
// qu'on appelle un déficit « important » (perte au-dessus de 0,8 %/semaine).
const PILOTE_CARDIO_PAS_MIN=60;            // min/semaine
const PILOTE_DEFICIT_IMPORTANT=0.8;
const PILOTE_PESEES_MIN=8, PILOTE_FENETRE_J=14;
const PILOTE_HISTO_MAX=12;
const PILOTE_ACTIONS=Object.freeze(['rien','cardio_plus','baisser_glucides','remonter']);

const _pct=v=>String(Math.round(Number(v)*100)/100).replace('.',',');
const _pjour=s=>Date.parse(String(s)+'T12:00:00Z');
/**
 * PURE. La tendance du poids à la date `fin` (AAAA-MM-JJ).
 * @param {{date:string, kg:number, agrege?:boolean}[]} pesees
 * @returns {{fiable:boolean, n:number, moyenne7:number|null, penteSem:number|null,
 *   perteSem:number|null, mobiles:{date:string,kg:number}[], raison?:string}}
 *   penteSem : % du poids par semaine (négatif = perte) ; perteSem = −penteSem.
 */
function tendancePoids(pesees,fin){
  const f=fin||localISODate(new Date());
  const tf=_pjour(f);
  const l=(pesees||[]).filter(p=>p&&!p.agrege&&/^\d{4}-\d{2}-\d{2}$/.test(String(p.date))&&Number(p.kg)>0&&_pjour(p.date)<=tf)
    .map(p=>({date:p.date,kg:Number(p.kg),j:(_pjour(p.date)-tf)/864e5})).sort((a,b)=>a.j-b.j);
  const fen=l.filter(p=>p.j>-PILOTE_FENETRE_J);
  const mobiles=fen.map(p=>{ const w=l.filter(x=>x.j<=p.j&&x.j>p.j-7); return {date:p.date,kg:Math.round(w.reduce((a,x)=>a+x.kg,0)/w.length*100)/100}; });
  const der7=l.filter(p=>p.j>-7);
  const moyenne7=der7.length?Math.round(der7.reduce((a,x)=>a+x.kg,0)/der7.length*100)/100:null;
  if(fen.length<PILOTE_PESEES_MIN) return {fiable:false,n:fen.length,moyenne7,penteSem:null,perteSem:null,mobiles,
    raison:'Tendance non fiable : '+fen.length+' pesée'+(fen.length>1?'s':'')+' sur '+PILOTE_FENETRE_J+' jours, il en faut '+PILOTE_PESEES_MIN+'.'};
  // Régression linéaire des pesées brutes sur 14 jours : kg par jour.
  const n=fen.length, mx=fen.reduce((a,p)=>a+p.j,0)/n, my=fen.reduce((a,p)=>a+p.kg,0)/n;
  let sxy=0, sxx=0; for(const p of fen){ sxy+=(p.j-mx)*(p.kg-my); sxx+=(p.j-mx)*(p.j-mx); }
  const pente=sxx>0?sxy/sxx:0;
  const penteSem=Math.round(pente*7/my*100*100)/100;
  return {fiable:true,n,moyenne7,penteSem,perteSem:Math.round(-penteSem*100)/100,mobiles};
}
/** PURE. L'e1RM baisse-t-il sur les 3 dernières séances d'un exercice ? Rend les noms. */
function forceEnBaisse(series){
  const out=[];
  for(const nom of Object.keys(series||{})){
    const l=(series[nom]||[]).filter(x=>Number(x&&x.e1)>0).sort((a,b)=>a.date<b.date?-1:1).slice(-3);
    if(l.length===3&&l[2].e1<l[1].e1&&l[1].e1<l[0].e1) out.push(nom);
  }
  return out;
}
/**
 * PURE. La proposition du pilote.
 * @param {{tendance:object, tendancePrecedente?:object, macros:{kcal,p,g,l}, poidsKg:number,
 *   plancherKcal:number|null, histo?:{date:number,action:string,decision?:string}[],
 *   maintenant?:number, semaines?:number, force?:Object<string,{date,e1}[]>, garde?:string}} etat
 * @returns {{action:'rien'|'cardio_plus'|'baisser_glucides'|'remonter', valeur:number,
 *   phrase:string, alertes:string[], raisonnement:string[], apres?:object}}
 */
function propositionSeche(etat){
  const e=etat||{}, alertes=[], raisonnement=[];
  const rien=(phrase)=>({action:'rien',valeur:0,phrase,alertes,raisonnement});
  if(e.garde) return rien(e.garde);
  const t=e.tendance;
  const kg=Number(e.poidsKg)||0, m=e.macros||{};
  // Les planchers, vérifiés à chaque passage : une alerte même sans proposition.
  const plLip=Math.round(PILOTE_SECHE.plancherLipides*kg*10)/10;
  if(kg>0&&Number(m.l)>0&&Number(m.l)<plLip) alertes.push('Lipides sous le plancher : '+m.l+' g pour '+_pct(plLip)+' g ('+_pct(PILOTE_SECHE.plancherLipides)+' g/kg).');
  const pkg=kg>0?Number(m.p)/kg:null;
  const perte=t&&t.fiable?t.perteSem:null;
  if(pkg!=null&&pkg<PILOTE_SECHE.proteines[0]) alertes.push('Protéines à '+String(Math.round(pkg*10)/10).replace('.',',')+' g/kg : le pilote vise '+_pct(PILOTE_SECHE.proteines[0])+' à '+_pct(PILOTE_SECHE.proteines[1])+' g/kg.');
  else if(pkg!=null&&perte!=null&&perte>PILOTE_DEFICIT_IMPORTANT&&pkg<PILOTE_SECHE.proteines[1]) alertes.push('Déficit important : monter les protéines vers '+_pct(PILOTE_SECHE.proteines[1])+' g/kg.');
  const baisse=forceEnBaisse(e.force);
  if(baisse.length&&perte!=null&&perte>0) alertes.push('Perte musculaire possible : la force baisse sur 3 séances ('+baisse.slice(0,3).join(', ')+').');
  const sem=Number(e.semaines)||0, finSeche=PILOTE_SECHE.phases*PILOTE_SECHE.semainesParPhase;
  if(sem>finSeche) alertes.push(sem+' semaines de sèche : au-delà de '+finSeche+', prévoir une pause au maintien.');
  if(!t||!t.fiable) return rien((t&&t.raison)||'Tendance non fiable : aucune proposition.');
  const [bas,haut]=PILOTE_SECHE.perteCible;
  raisonnement.push('Perte mesurée : '+_pct(perte)+' %/semaine sur '+PILOTE_FENETRE_J+' jours ('+t.n+' pesées), cible '+_pct(bas)+' à '+_pct(haut)+' %.');
  // Un ajustement par période de 14 jours, validé ou refusé.
  const der=(e.histo||[]).filter(h=>h&&h.decision).slice(-1)[0];
  const now=Number(e.maintenant)||Date.now();
  if(der&&now-Number(der.date)<PILOTE_SECHE.periodeAjustementJours*864e5){
    const j=Math.ceil((Number(der.date)+PILOTE_SECHE.periodeAjustementJours*864e5-now)/864e5);
    return rien('Dernier ajustement il y a moins de '+PILOTE_SECHE.periodeAjustementJours+' jours : on laisse agir ('+j+' j).');
  }
  const kcal=Number(m.kcal)||0, g=Number(m.g)||0;
  if(perte>haut){
    // Trop rapide : on remonte par les glucides, 100 kcal, 200 au-delà de 1,5 %.
    const v=perte>1.5?2*PILOTE_SECHE.pasKcal:PILOTE_SECHE.pasKcal;
    raisonnement.push('Au-dessus de '+_pct(haut)+' % : on remonte de '+v+' kcal par les glucides, pour préserver le muscle.');
    return {action:'remonter',valeur:v,phrase:'Ta perte va plus vite que prévu : on remonte un peu les glucides (+'+v+' kcal).',alertes,raisonnement,
      apres:{kcal:kcal+v,g:g+Math.round(v/4),p:m.p,l:m.l}};
  }
  if(perte>=bas){ raisonnement.push('Dans la cible : on ne touche à rien.'); return rien('Rythme dans la cible : on continue.'); }
  // Trop lent : seulement deux périodes de suite.
  const prec=e.tendancePrecedente;
  if(!(prec&&prec.fiable&&prec.perteSem<bas)){
    raisonnement.push('Sous '+_pct(bas)+' % sur cette période seulement : on attend la suivante avant de bouger.');
    return rien('Perte un peu lente : on attend une deuxième période pour confirmer.');
  }
  raisonnement.push('Sous '+_pct(bas)+' % deux périodes de suite ('+_pct(prec.perteSem)+' puis '+_pct(perte)+' %).');
  // L'ordre : cardio d'abord, puis les glucides ; les lipides restent au coach.
  const dejaCardio=(e.histo||[]).some(h=>h&&h.action==='cardio_plus'&&h.decision==='applique');
  if(!dejaCardio){
    raisonnement.push('Premier levier : le cardio (+'+PILOTE_CARDIO_PAS_MIN+' min par semaine), les apports ne bougent pas.');
    return {action:'cardio_plus',valeur:PILOTE_CARDIO_PAS_MIN,phrase:'On ajoute '+PILOTE_CARDIO_PAS_MIN+' min de cardio par semaine, ton alimentation ne change pas.',alertes,raisonnement};
  }
  const v=PILOTE_SECHE.pasKcal, gApres=g-Math.round(v/4), kApres=kcal-v;
  const pl=Number(e.plancherKcal)||0;
  if(!(pl>0)){ alertes.push('Plancher calorique inconnu : aucune baisse proposée.'); return rien('Perte lente, mais sans plancher connu on ne baisse pas.'); }
  if(kApres<pl){ alertes.push('Plancher atteint : '+kApres+' kcal passerait sous '+pl+' kcal.'); return rien('Perte lente, mais on est au plancher : on ne descend plus.'); }
  if(gApres<Math.max(0,kg)*1){
    alertes.push('Glucides au plus bas (1 g/kg) : la suite passerait par les lipides (plancher '+_pct(PILOTE_SECHE.plancherLipides)+' g/kg), à décider par le coach.');
    return rien('Perte lente : le prochain levier est au coach.');
  }
  raisonnement.push('Le cardio a déjà été ajouté : −'+v+' kcal par les glucides, au-dessus du plancher de '+pl+' kcal.');
  return {action:'baisser_glucides',valeur:-v,phrase:'Ta perte ralentit : on retire '+v+' kcal de glucides.',alertes,raisonnement,
    apres:{kcal:kApres,g:gApres,p:m.p,l:m.l}};
}
/** PURE. Le muscle au-dessus de sa cible pendant la sèche : −20 à −30 % proposé, charges gardées. */
function volumeSecheSuggestions(muscles,repere){
  const out=[];
  for(const m of Object.keys(muscles||{})){
    const n=Number(muscles[m])||0;
    let r=null; try{ r=repere(m); }catch(e){ r=null; }
    const cible=r&&r.mavMax>0?r.mavMax:null;
    if(cible&&n>cible) out.push({muscle:m,actuel:Math.round(n*10)/10,cible,de:Math.round(n*0.7),a:Math.round(n*0.8)});
  }
  return out.sort((a,b)=>b.actuel/b.cible-a.actuel/a.cible);
}

// ── Le dossier : de l'athlète à l'état du pilote ─────────────────────────────
/** Les e1RM des 3 dernières semaines, par exercice (le meilleur de chaque séance). */
function _piloteForce(u,maintenant){
  const out={}, lim=(Number(maintenant)||Date.now())-21*864e5;
  for(const s of (u&&Array.isArray(u.sessions)?u.sessions:[])){
    if(!s||!s.data||s.deload===true||!(Number(s.date)>=lim)) continue;
    for(const nom of Object.keys(s.data)){
      const d=s.data[nom]; if(!d||!Array.isArray(d.sets)) continue;
      let best=0;
      for(const se of d.sets){
        if(!se||se.done!==true) continue;
        const w=parseFloat(se.weight), r=parseInt(se.repsDone!=null&&se.repsDone!==''?se.repsDone:se.reps,10);
        if(!(w>0)||!(r>0)) continue;
        try{ if(!e1rmFiable(r,se.rir)) continue; best=Math.max(best,e1rm(w,r,se.rir)); }catch(e){}
      }
      if(best>0) (out[nom]=out[nom]||[]).push({date:localISODate(new Date(Number(s.date))),e1:best});
    }
  }
  return out;
}
/** La raison de se taire (gardes de l'app), ou ''. */
function _piloteGarde(u){
  const g=(f)=>{ try{ return !!f(); }catch(e){ return false; } };
  const ph=(()=>{ try{ return phaseCourante(u); }catch(e){ return null; } })();
  if(!ph||ph.type!=='seche') return 'Le pilote ne suit qu’une phase de sèche.';
  if(g(()=>drapeauQuelconqueActif(u))) return 'Signal de santé actif : aucune proposition automatique.';
  if(g(()=>aTCA(u))) return 'Antécédent alimentaire déclaré : aucune proposition automatique.';
  if(g(()=>grossesseSuspend(u))) return 'Grossesse ou allaitement : aucune proposition automatique.';
  if(g(()=>pauseActive(u))) return 'Pause en cours : le pilote attend la reprise.';
  if(g(()=>paliersDeficit(u)==='blocage')) return 'Déficit énergétique au palier de blocage : aucune baisse, à voir avec l’athlète.';
  return '';
}
/** L'état du pilote pour un dossier, à la date du jour. */
function etatSeche(u,maintenant){
  const t=Number(maintenant)||Date.now(), j=localISODate(new Date(t));
  const nut=(u&&u.nutrition)||{};
  const base=(nut.macros&&(nut.macros.off||nut.macros.on))||{};
  let pesees=[]; try{ pesees=serieWeight(u); }catch(e){ pesees=[]; }
  let kg=0; try{ kg=Number(poidsNutritionnel(u).kg)||0; }catch(e){ kg=0; }
  let pl=null; try{ pl=plancherKcal(u); }catch(e){ pl=null; }
  let sem=0; try{ sem=Number(semainesEcoulees(u))||0; }catch(e){ sem=0; }
  const p=nut.pilote||{};
  return {tendance:tendancePoids(pesees,j),tendancePrecedente:tendancePoids(pesees,localISODate(new Date(t-PILOTE_FENETRE_J*864e5))),
    macros:{kcal:Number(base.kcal)||0,p:Number(base.p)||0,g:Number(base.g)||0,l:Number(base.l)||0},poidsKg:kg,plancherKcal:pl,
    histo:Array.isArray(p.histo)?p.histo:Object.values(p.histo||{}),maintenant:t,semaines:sem,force:_piloteForce(u,t),garde:_piloteGarde(u),pesees};
}

// ══ LA CARTE DU COACH ════════════════════════════════════════════════════════
/** PURE. Le graphique : pesées, moyenne mobile, zone cible 0,5-1 %/semaine. */
function svgPiloteSeche(pesees,tendance,fin){
  const W=320, H=140, P=24;
  const tf=_pjour(fin), deb=tf-28*864e5;
  const pts=(pesees||[]).filter(p=>p&&!p.agrege&&_pjour(p.date)>=deb&&_pjour(p.date)<=tf&&Number(p.kg)>0);
  if(pts.length<2) return '';
  const mob=(tendance&&tendance.mobiles)||[];
  const all=pts.map(p=>Number(p.kg)).concat(mob.map(p=>p.kg));
  let lo=Math.min(...all), hi=Math.max(...all);
  const ref=mob.length?mob[0]:{date:pts[0].date,kg:pts[0].kg};
  const jRef=(_pjour(ref.date)-deb)/864e5, reste=28-jRef;
  const zBas=ref.kg*(1-PILOTE_SECHE.perteCible[0]/100*reste/7), zHaut=ref.kg*(1-PILOTE_SECHE.perteCible[1]/100*reste/7);
  lo=Math.min(lo,zHaut)-0.3; hi=Math.max(hi,ref.kg)+0.3;
  const x=d=>P+(_pjour(d)-deb)/864e5/28*(W-2*P), xj=j=>P+j/28*(W-2*P), y=v=>H-P+( -(v-lo)/(hi-lo))*(H-2*P);
  const zone='<polygon class="pl-zone" points="'+xj(jRef)+','+y(ref.kg)+' '+xj(28)+','+y(zBas)+' '+xj(28)+','+y(zHaut)+'"/>';
  const brut=pts.map(p=>'<circle class="pl-pt" cx="'+x(p.date).toFixed(1)+'" cy="'+y(p.kg).toFixed(1)+'" r="2.2"/>').join('');
  const ligne=mob.length>1?'<polyline class="pl-mm" points="'+mob.map(p=>x(p.date).toFixed(1)+','+y(p.kg).toFixed(1)).join(' ')+'"/>':'';
  return '<svg class="pl-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Pesées, moyenne sur 7 jours et zone cible">'+zone+brut+ligne
    +'<text x="'+P+'" y="12" class="pl-tx">'+String(Math.round(hi*10)/10).replace('.',',')+' kg</text>'
    +'<text x="'+P+'" y="'+(H-6)+'" class="pl-tx">'+String(Math.round(lo*10)/10).replace('.',',')+' kg</text></svg>';
}
/** Un horodatage (ms) en date lisible. */
const _plDateLib=ms=>new Date(Number(ms)).toLocaleDateString('fr-FR');
const PILOTE_ACTION_LIB=Object.freeze({rien:'Rien à changer',cardio_plus:'Cardio +',baisser_glucides:'Glucides −',remonter:'Remonter'});
/** PURE. Le contenu de la carte, depuis l'état et la proposition. */
function htmlPiloteSeche(et,pr,fin){
  const E=escapeHtml, t=et.tendance;
  let h='<div class="pl-carte"><div class="pl-t">Pilote de sèche</div>';
  if(et.garde&&/phase de sèche/.test(et.garde)) return h+'<p class="sub">'+E(et.garde)+'</p></div>';
  h+=svgPiloteSeche(et.pesees,t,fin)
    +'<div class="pl-ligne">'+(t.fiable?'Tendance '+(t.perteSem>=0?'−':'+')+_pct(Math.abs(t.perteSem))+' %/sem · moyenne 7 j '+_pct(t.moyenne7)+' kg':E(t.raison))+'</div>'
    +'<div class="pl-cible">Zone cible : '+_pct(PILOTE_SECHE.perteCible[0])+' à '+_pct(PILOTE_SECHE.perteCible[1])+' % par semaine</div>';
  h+='<div class="pl-prop pl-'+pr.action+'"><b>'+E(PILOTE_ACTION_LIB[pr.action])+(pr.valeur?' '+(pr.action==='cardio_plus'?pr.valeur+' min/sem':(pr.valeur>0?'+':'')+pr.valeur+' kcal'):'')+'</b><span>'+E(pr.phrase)+'</span></div>';
  if(pr.raisonnement.length) h+='<ul class="pl-raison">'+pr.raisonnement.map(x=>'<li>'+E(x)+'</li>').join('')+'</ul>';
  if(pr.alertes.length) h+='<ul class="pl-alertes">'+pr.alertes.map(x=>'<li>'+E(x)+'</li>').join('')+'</ul>';
  if(pr.action!=='rien') h+='<div class="pl-btns"><button type="button" class="btn btn-red btn-sm" onclick="piloteDecider(\'applique\')">Valider</button>'
    +'<button type="button" class="btn btn-outline btn-sm" onclick="piloteDecider(\'refuse\')">Garder comme ça</button></div>';
  const hi=et.histo.slice(-6).reverse();
  if(hi.length) h+='<div class="pl-lab">Historique</div><ul class="pl-histo">'+hi.map(x=>'<li>'+E(_plDateLib(x.date))+' · '+E(PILOTE_ACTION_LIB[x.action]||x.action)
    +(x.valeur?' '+(x.action==='cardio_plus'?x.valeur+' min':(x.valeur>0?'+':'')+x.valeur+' kcal'):'')+' · '+(x.decision==='applique'?'validé':'gardé comme ça')+'</li>').join('')+'</ul>';
  return h+'</div>';
}
function renderPiloteSeche(c){
  const z=document.getElementById('ccd-pilote'); if(!z) return false;
  let ph=null; try{ ph=phaseCourante(c); }catch(e){ ph=null; }
  if(!c||!ph||ph.type!=='seche'){ z.innerHTML=''; return false; }
  const et=etatSeche(c), pr=propositionSeche(et);
  z.innerHTML=htmlPiloteSeche(et,pr,localISODate(new Date()));
  return true;
}
/**
 * PURE (sur c). Le geste du coach : la proposition validée passe par
 * ajouterAjustAuto (kcal) ou le cardio du pilote ; dans les deux cas,
 * l'historique et la phrase pour l'athlète. Rend la proposition jouée, ou null.
 */
function piloteAppliquer(c,pr,decision,t){
  if(!c||!pr||pr.action==='rien'||PILOTE_ACTIONS.indexOf(pr.action)<0) return null;
  if(!c.nutrition) c.nutrition={};
  const p=c.nutrition.pilote=Object.assign({cardioMinSem:0,histo:[]},c.nutrition.pilote||{});
  p.histo=(Array.isArray(p.histo)?p.histo:Object.values(p.histo||{})).slice();
  const at=Number(t)||Date.now();
  if(decision==='applique'){
    if(pr.action==='cardio_plus') p.cardioMinSem=Math.min(1000,(Number(p.cardioMinSem)||0)+pr.valeur);
    else ajouterAjustAuto(c,'tous',pr.valeur);
    p.derniere={date:at,action:pr.action,valeur:pr.valeur,phrase:pr.phrase.slice(0,200)};
    if(pr.apres&&pr.apres.kcal) p.derniere.kcal=pr.apres.kcal;
  }
  p.histo.push({date:at,action:pr.action,valeur:pr.valeur,decision});
  p.histo=p.histo.slice(-PILOTE_HISTO_MAX);
  return pr;
}
function piloteDecider(decision){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users); if(!c) return false;
  const pr=propositionSeche(etatSeche(c));
  if(!piloteAppliquer(c,pr,decision)){ toast('Plus de proposition à jouer.','var(--orange)'); renderPiloteSeche(c); return false; }
  // Les kcal ont bougé : les cibles se réécrivent par le chemin du tableur.
  if(decision==='applique'&&pr.action!=='cardio_plus'){
    try{
      if(c.nutrition.manuel===true||saisieManuelle(c)){
        const m=c.nutrition.macros||{};
        for(const k of ['on','off']) if(m[k]&&Number(m[k].kcal)>0){
          const gD=Math.round(pr.valeur/4);
          m[k]=Object.assign({},m[k],{kcal:Number(m[k].kcal)+pr.valeur,g:Math.max(0,Number(m[k].g)+gD)});
        }
      } else {
        const tb=cibleTableur(c,{});
        if(tb&&!(tb.manque&&tb.manque.length)){
          const j=_tbJournees(c,tb,dieteCyclee(c));
          const m=c.nutrition.macros||{};
          c.nutrition.macros={on:j.on,off:j.off,origine:m.origine||'tableur',origineDate:Date.now()};
        }
      }
    }catch(e){}
  }
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(c.email,c),decision==='applique'?'Ajustement validé '+ICO.coche:'Noté : on garde comme ça','le pilote est');
  renderPiloteSeche(c);
  try{ renderCoachNutriSection(c); }catch(e){}
  return true;
}
// ── Côté athlète : la nouvelle cible et une phrase, 7 jours ───────────────────
/** PURE. La carte de l'athlète, ou ''. */
function htmlPiloteAthlete(u,maintenant){
  const d=u&&u.nutrition&&u.nutrition.pilote&&u.nutrition.pilote.derniere;
  const t=Number(maintenant)||Date.now();
  if(!d||!(t-Number(d.date)<7*864e5)) return '';
  try{ if(aTCA(u)) return ''; }catch(e){}
  const cible=d.action==='cardio_plus'?'Cardio : '+((u.nutrition.pilote.cardioMinSem)||d.valeur)+' min par semaine'
    :(d.kcal?'Nouvelle cible : '+String(d.kcal).replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' kcal':'Nouvelle cible posée par ton coach');
  return '<div class="pl-ath"><b>'+escapeHtml(cible)+'</b><span>'+escapeHtml(d.phrase||'')+'</span></div>';
}
function rendrePiloteAthlete(u){
  const z=document.getElementById('clh-pilote'); if(!z) return false;
  const h=(u&&u.role!=='coach')?htmlPiloteAthlete(u):'';
  z.innerHTML=h; z.hidden=!h;
  return !!h;
}
/** Le bandeau de l'éditeur : volume −20 à −30 % sur les muscles au-dessus de leur cible, pendant la sèche. */
function htmlVolumeSeche(muscles,u){
  let ph=null; try{ ph=phaseCourante(u); }catch(e){ ph=null; }
  if(!ph||ph.type!=='seche') return '';
  const l=volumeSecheSuggestions(muscles,m=>reperesEffectifs(u,m));
  if(!l.length) return '';
  return '<div class="pl-vol"><b>Sèche : volume à alléger</b><span>'
    +l.slice(0,5).map(x=>escapeHtml((MUSCLES[x.muscle]||{}).lib||x.muscle)+' '+volAffiche(x.actuel)+' → '+x.de+'-'+x.a+' séries').join(' · ')
    +'. Charges conservées : on retire des séries, pas des kilos. Rien n’est modifié automatiquement.</span></div>';
}
