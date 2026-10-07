// ══════════ LE BLOC DE PRIORITE ════════════════════════════════════════
//
// PRIORISER, C'EST ARBITRER — PAS AJOUTER. Sans plafond, « je priorise les
// epaules » veut dire « j'ajoute six series aux epaules », le budget de
// recuperation est depasse en silence, et l'athlete s'ecroule en trois
// semaines. Le plafond des 10 % est le coeur de cette fonctionnalite : c'est
// lui qui force le coach a retirer quelque part ce qu'il ajoute ailleurs.
//
// TROIS MUSCLES AU MAXIMUM, ET LA CONTRAINTE EST DURE. Au-dela, il n'y a plus
// de priorite : il y a un programme plus long. Un quatrieme muscle prioritaire
// est refuse avec la phrase qui l'explique — pas grise, pas ignore, refuse.
const BLOC_HAUTS_MAX=3;
const BLOC_PLAFOND_HAUSSE=0.10;   // +10 % de series ponderees, pas un de plus
const BLOC_SEMAINES_REF=4;        // la moyenne contre laquelle on mesure
// UNE SERIE DE MARGE SOUS LE MRV, TOUJOURS. La derniere serie avant le maximum
// recuperable est celle qui coute le plus et rend le moins : viser mrv-1 laisse
// de quoi absorber une mauvaise nuit sans basculer en surcharge.
const BLOC_MARGE_MRV=1;

// PURE. Le bloc en cours, ou null. Un bloc echu n'est PAS supprime — c'est le
// signal de fin qui s'en sert, et le coach decide de reconduire ou non.
function blocPriorite(user){
  const u=_dossier(user);
  const b=u&&u.blocPriorite;
  if(!b||typeof b!=='object') return null;
  const debut=Number(b.debut)||0;
  const semaines=Math.round(Number(b.semaines)||0);
  if(!(debut>0)||!(semaines>0)) return null;
  return {debut:debut,semaines:semaines,
    hauts:_tabBloc(b.hauts).slice(0,BLOC_HAUTS_MAX),
    bas:_tabBloc(b.bas),note:String(b.note||'')};
}
// PURE. Normalise ce que Firebase peut avoir rendu en objet — meme piege que
// sessions_config : une clef qui manque et le tableau revient en {0:…,2:…}.
function _tabBloc(v){
  if(Array.isArray(v)) return v.filter(Boolean);
  if(v&&typeof v==='object') return Object.keys(v).map(k=>v[k]).filter(Boolean);
  return [];
}
// PURE. Ou en est le bloc ? {semaine:1..n, reste, fini}.
function blocAvancement(user,maintenant){
  const b=blocPriorite(user);
  if(!b) return null;
  const t=Number(maintenant)||Date.now();
  const ecoulees=Math.floor((t-b.debut)/604800000);
  const semaine=Math.min(b.semaines,Math.max(1,ecoulees+1));
  return {semaine:semaine,total:b.semaines,reste:Math.max(0,b.semaines-ecoulees),
    fini:ecoulees>=b.semaines};
}
// L'AJOUT D'UN MUSCLE PRIORITAIRE. Rend {ok} ou {ok:false,raison}.
//
// LE REFUS EXPLIQUE, il ne se contente pas de bloquer. « Maximum atteint » ne
// dit pas pourquoi ; la phrase ci-dessous dit ce qu'il faut faire a la place.
function blocAjouterHaut(user,muscle){
  const u=_dossier(user);
  if(!u) return {ok:false,raison:'Aucun athlète ouvert.'};
  if(!reperesTable(muscle))
    return {ok:false,raison:'Ce muscle n’a pas de repère de volume : il ne peut pas être priorisé.'};
  if(!u.blocPriorite||typeof u.blocPriorite!=='object')
    u.blocPriorite={debut:Date.now(),semaines:6,hauts:[],bas:[],note:''};
  const b=u.blocPriorite;
  b.hauts=_tabBloc(b.hauts); b.bas=_tabBloc(b.bas);
  if(b.hauts.indexOf(muscle)>=0) return {ok:true,deja:true};
  if(b.hauts.length>=BLOC_HAUTS_MAX)
    return {ok:false,raison:'Trois muscles prioritaires au maximum. Au-delà, il n’y a plus de priorité : '
      +'le budget de récupération se répartit sur tout et rien ne progresse plus vite. '
      +'Retire-en un, ou fais deux blocs à la suite.'};
  // Un muscle ne peut pas etre prioritaire ET en maintien.
  const i=b.bas.indexOf(muscle); if(i>=0) b.bas.splice(i,1);
  b.hauts.push(muscle);
  return {ok:true};
}
function blocAjouterBas(user,muscle){
  const u=_dossier(user);
  if(!u) return {ok:false,raison:'Aucun athlète ouvert.'};
  if(!u.blocPriorite||typeof u.blocPriorite!=='object')
    u.blocPriorite={debut:Date.now(),semaines:6,hauts:[],bas:[],note:''};
  const b=u.blocPriorite;
  b.hauts=_tabBloc(b.hauts); b.bas=_tabBloc(b.bas);
  const i=b.hauts.indexOf(muscle); if(i>=0) b.hauts.splice(i,1);
  if(b.bas.indexOf(muscle)<0) b.bas.push(muscle);
  return {ok:true};
}
function blocRetirer(user,muscle){
  const u=_dossier(user);
  const b=u&&u.blocPriorite;
  if(!b) return {ok:true};
  b.hauts=_tabBloc(b.hauts).filter(m=>m!==muscle);
  b.bas=_tabBloc(b.bas).filter(m=>m!==muscle);
  return {ok:true};
}
// PURE. LA CIBLE D'UN MUSCLE PRIORITAIRE a la semaine `s` sur `n`.
//
// PROGRESSION LINEAIRE VERS mrv-1, EN PARTANT DE CE QU'IL FAIT DEJA.
//
// ⚠ LE DEPART EST max(mev, actuel), ET NON mev. Partir du MEV faisait BAISSER
// un muscle qu'on venait de declarer prioritaire : un athlete deja a dix
// series de deltoides lateraux, dont le MEV est a huit, se voyait proposer
// huit. « Prioriser » ne peut pas commencer par retirer du volume au muscle
// prioritaire — c'est le contraire de ce que le mot annonce. Trouve en
// eprouvant le moteur, pas au banc.
//
// La cible est une TRAJECTOIRE, pas un palier : la premiere semaine part du
// point ou l'athlete est, la derniere arrive a une serie sous le MRV.
function blocCibleHaut(rep,s,n,actuel){
  if(!rep) return null;
  const bas=Math.max(rep.mev,Math.round(Number(actuel)||0));
  const haut=Math.max(bas,rep.mrv-BLOC_MARGE_MRV);
  if(!(n>1)) return haut;
  const t=Math.min(1,Math.max(0,(s-1)/(n-1)));
  return Math.round(bas+(haut-bas)*t);
}
// PURE. L'arbitrage complet, muscle par muscle. AUCUNE ECRITURE.
//
// LE MAINTIEN N'EST PAS L'ABANDON : un muscle en bas descend exactement a son
// volume de maintien (rep.mv), jamais en dessous — sous le volume de maintien
// on perd du tissu pendant le bloc, et on paierait la priorite d'un muscle par
// la fonte d'un autre.
function blocArbitrage(user,maintenant){
  const u=_dossier(user);
  const b=blocPriorite(u);
  if(!b) return null;
  const av=blocAvancement(u,maintenant);
  const cle=semaineISO(new Date(Number(maintenant)||Date.now()));
  let vol={}; try{ vol=volumeSemaine(u,cle)||{}; }catch(e){ vol={}; }
  const lignes=[];
  const vus={};
  for(const m of b.hauts.concat(b.bas)) vus[m]=true;
  for(const m in vol) vus[m]=true;
  for(const m of Object.keys(vus)){
    const rep=(function(){ try{ return reperesEffectifs(u,m); }catch(e){ return null; } })();
    // Un muscle sans repere ne peut etre ni priorise ni mis en maintien : il
    // n'a ni MEV ni MRV. Meme garde que partout ailleurs.
    if(!rep) continue;
    const actuel=Number(vol[m])||0;
    let role='normal', cible=actuel;
    if(b.hauts.indexOf(m)>=0){ role='haut'; cible=blocCibleHaut(rep,av?av.semaine:1,b.semaines,actuel); }
    // En bas : le volume de MAINTIEN (rep.mv), pas le MEV.
    else if(b.bas.indexOf(m)>=0){ role='bas'; cible=rep.mv; }
    lignes.push({muscle:m,role:role,actuel:Math.round(actuel*10)/10,
      cible:cible,ecart:Math.round((cible-actuel)*10)/10,rep:rep});
  }
  lignes.sort((x,y)=>({haut:0,bas:1,normal:2})[x.role]-({haut:0,bas:1,normal:2})[y.role]
    ||y.actuel-x.actuel);
  return {bloc:b,avancement:av,lignes:lignes};
}
// PURE. LE PLAFOND, ET IL EST OPPOSABLE.
//
// LA SOMME PONDEREE DE LA SEMAINE ne doit pas depasser de plus de 10 % la
// moyenne des quatre semaines precedentes. Si la repartition demandee la
// depasse, le moteur REFUSE et dit ce qu'il faudrait retirer — il ne rabote pas
// tout seul : choisir OU retirer est une decision de coach.
function blocPlafond(user,arb,maintenant){
  const u=_dossier(user);
  const a=arb||blocArbitrage(u,maintenant);
  if(!a) return null;
  // La reference : la moyenne des quatre semaines revolues, en series
  // ponderees — la meme unite que volumeSemaine, donc comparable sans
  // conversion.
  const refs=[];
  for(let i=1;i<=BLOC_SEMAINES_REF;i++){
    let v={}; try{ v=volumeSemaine(u,_volCleDecalee(i))||{}; }catch(e){ v={}; }
    let s=0, vu=false;
    for(const m in v){ s+=Number(v[m])||0; vu=true; }
    if(vu) refs.push(s);
  }
  const reference=refs.length?refs.reduce((x,y)=>x+y,0)/refs.length:null;
  let apres=0, avant=0;
  for(const l of a.lignes){ avant+=l.actuel; apres+=l.cible; }
  const plafond=(reference==null)?null:reference*(1+BLOC_PLAFOND_HAUSSE);
  const hausse=(reference&&reference>0)?(apres-reference)/reference:null;
  // SANS REFERENCE, PAS DE PLAFOND OPPOSABLE. Un athlete sans historique n'a
  // pas de budget connu : on ne l'invente pas, on le dit.
  if(reference==null)
    return {ok:true,reference:null,avant:Math.round(avant*10)/10,
      apres:Math.round(apres*10)/10,hausse:null,depasse:0,aRetirer:[],
      raison:'Pas encore quatre semaines d’historique : le plafond ne peut pas être calculé.'};
  const depasse=Math.max(0,apres-plafond);
  // CE QU'IL FAUDRAIT RETIRER, et OU. On propose les muscles NORMAUX les plus
  // volumineux d'abord : ce sont ceux dont le retrait coute le moins au bloc.
  // Les prioritaires ne sont jamais proposes — les rogner viderait le bloc de
  // son sens ; les muscles en maintien non plus, ils sont deja a leur MEV.
  const aRetirer=[];
  if(depasse>0){
    let reste=depasse;
    const candidats=a.lignes.filter(l=>l.role==='normal'&&l.rep&&l.actuel>l.rep.mev)
      .sort((x,y)=>(y.actuel-y.rep.mev)-(x.actuel-x.rep.mev));
    for(const l of candidats){
      if(reste<=0) break;
      const dispo=l.actuel-l.rep.mev;
      const pris=Math.min(dispo,reste);
      if(pris>0){ aRetirer.push({muscle:l.muscle,series:Math.ceil(pris)}); reste-=pris; }
    }
    // Rien a rogner : le budget ne peut pas etre libere, il faut raccourcir le
    // bloc ou renoncer a un muscle prioritaire. On le dit plutot que de laisser
    // une liste vide et un refus sans issue.
    if(reste>0) aRetirer.push({muscle:null,series:Math.ceil(reste)});
  }
  return {ok:depasse<=0,reference:Math.round(reference*10)/10,
    avant:Math.round(avant*10)/10,apres:Math.round(apres*10)/10,
    plafond:Math.round(plafond*10)/10,
    hausse:hausse==null?null:Math.round(hausse*1000)/10,
    depasse:Math.round(depasse*10)/10,aRetirer:aRetirer,raison:null};
}
// PURE. LA PHRASE DE SYNTHESE. Le coach doit lire l'arbitrage COMPLET en une
// phrase avant d'appliquer quoi que ce soit : « +6 series sur les epaules,
// -4 sur les quadriceps, total hebdomadaire +2 % ».
function blocSynthese(user,arb,pla){
  const a=arb||blocArbitrage(user);
  if(!a) return '';
  const p=pla||blocPlafond(user,a);
  const nom=m=>((MUSCLES[m]||{}).lib||m).toLowerCase();
  const monte=a.lignes.filter(l=>l.ecart>=0.5)
    .sort((x,y)=>y.ecart-x.ecart).slice(0,2)
    .map(l=>'+'+volAffiche(l.ecart)+' sur les '+nom(l.muscle));
  const baisse=a.lignes.filter(l=>l.ecart<=-0.5)
    .sort((x,y)=>x.ecart-y.ecart).slice(0,2)
    .map(l=>volAffiche(l.ecart)+' sur les '+nom(l.muscle));
  const parts=monte.concat(baisse);
  if(!parts.length) return 'Aucun écart : la répartition demandée est déjà en place.';
  const tot=(p&&p.hausse!=null)
    ? ', total hebdomadaire '+(p.hausse>=0?'+':'')+String(p.hausse).replace('.',',')+' %'
    : '';
  return parts.join(', ')+tot+'.';
}
// ══════════ LES PROPOSITIONS, ET LEUR ECRITURE ═════════════════════════
//
// LE MOTEUR PROPOSE, LE COACH APPLIQUE. Rien ne s'ecrit dans sessions_config
// sans un geste, et chaque proposition est un bouton DISTINCT : appliquer les
// series sans toucher a l'ordre, ou l'inverse, doit rester possible. Un « tout
// appliquer » ferait porter au coach une decision qu'il n'a pas prise.

// PURE. Les exercices dont ce muscle est PRIMAIRE, avec leur position.
// _aplatirSessionsConfig d'abord : Firebase rend ce tableau en objet des
// qu'une clef manque, et .map leverait alors dans une fonction async.
function _blocExercicesDe(c,muscle){
  const u=_dossier(c);
  const cfg=_creneauxDe(u);
  const out=[];
  cfg.forEach((s,slot)=>{
    if(!s||s.active!==true||!Array.isArray(s.exercises)) return;
    s.exercises.forEach((ex,i)=>{
      if(!ex||!ex.name) return;
      let cls=null; try{ cls=resoudreMusclesLecture(ex.name,ex,u); }catch(e){ return; }
      if(!cls||cls===VOL_CARDIO||(cls.p||[]).indexOf(muscle)<0) return;
      out.push({slot:slot,idxExercice:i,nom:ex.name,series:Math.max(1,parseInt(ex.series,10)||0)});
    });
  });
  return out;
}
// PURE. LES GESTES DE SERIES a poser pour atteindre les cibles. Rend une liste
// de {slot,idxExercice,sens} — une SERIE par entree, pour que le coach voie
// exactement combien de gestes il applique.
//
// ON REPARTIT SUR LES EXERCICES, on n'empile pas tout sur le premier : quatre
// series de plus sur un seul mouvement, c'est un autre exercice, pas le meme
// en plus long.
function blocGestesSeries(c,arb){
  const a=arb||blocArbitrage(c);
  if(!a) return [];
  const out=[];
  for(const l of a.lignes){
    if(l.role==='normal') continue;
    let reste=Math.round(l.ecart);
    if(!reste) continue;
    const exs=_blocExercicesDe(c,l.muscle);
    if(!exs.length) continue;
    const sens=reste>0?'ajouter_serie':'retirer_serie';
    let i=0, garde=0;
    while(reste!==0&&garde++<40){
      const ex=exs[i%exs.length];
      // Les memes bornes que l'ajustement existant : jamais zero serie, jamais
      // au-dela du plafond. C'est appliquerAjustementSeances qui les tient ;
      // on les repose ici pour ne pas proposer un geste sans effet.
      if(sens==='retirer_serie'&&ex.series<=1){ i++; if(i>exs.length*3) break; continue; }
      if(sens==='ajouter_serie'&&ex.series>=AJ_SERIES_MAX){ i++; if(i>exs.length*3) break; continue; }
      ex.series+=(sens==='ajouter_serie'?1:-1);
      out.push({slot:ex.slot,idxExercice:ex.idxExercice,sens:sens,
        muscle:l.muscle,nom:ex.nom});
      reste+=(sens==='ajouter_serie'?-1:1);
      i++;
    }
  }
  return out;
}
// L'ECRITURE. Meme discipline que _ajEcrire — drapeau, instantane, DB.set,
// toastSync — et le MEME applicateur, appliquerAjustementSeances.
//
// ⚠ _ajEcrire ELLE-MEME N'EST PAS APPELABLE ICI : elle lit _ajCtx, le contexte
// de la feuille d'ajustement ouverte depuis une alerte. Il n'y en a pas quand
// le coach travaille dans le panneau de bloc. On reprend sa discipline, pas sa
// signature — et surtout le meme applicateur, pour qu'un correctif porte sur
// les deux chemins.
function _blocEcrire(clientId,gestes,libelle){
  const res=(function(){ try{ return resolveClient(clientId); }catch(e){ return null; } })();
  if(!res) return false;
  const c=res.c, users=res.users;
  let bloque=false;
  try{ bloque=drapeauQuelconqueActif(c); }catch(e){}
  if(bloque){ toast('Un drapeau est levé : aucun ajustement.','var(--orange)'); return false; }
  if(!gestes||!gestes.length){ toast('Rien à appliquer.','var(--orange)'); return false; }
  _pushSessionsHistory(c);
  for(const g of gestes){
    c.sessions_config=appliquerAjustementSeances(c.sessions_config,
      [{slot:g.slot,idxExercice:g.idxExercice}],{type:g.sens});
  }
  c.updatedAt=Date.now();
  users[c.email]=c;
  const ok=DB.set('users',users);
  try{ _viderCacheVolume(); _cacheSignaux.clear(); }catch(e){}
  try{ _journalSeance(c,'bloc_priorite',{quoi:libelle||'séries',n:gestes.length}); }catch(e){}
  toastSync(ok,CLOUD.pushOne(c.email,c),libelle||'Programme ajusté','l\'ajustement est');
  return true;
}
// GESTE 1 — LES SERIES. Refuse quand le plafond est depasse : c'est tout
// l'interet du plafond qu'il soit OPPOSABLE, pas indicatif.
function blocAppliquerSeries(clientId){
  const c=(function(){ try{ return getOwnedClient(clientId); }catch(e){ return null; } })();
  if(!c) return false;
  const a=blocArbitrage(c);
  if(!a){ toast('Aucun bloc en cours.','var(--orange)'); return false; }
  const p=blocPlafond(c,a);
  if(p&&!p.ok){
    // ON DIT CE QU'IL FAUDRAIT RETIRER, on ne rabote pas tout seul : choisir OU
    // retirer est une decision de coach, et la faire a sa place reviendrait a
    // decider du programme sans lui.
    const l=(p.aRetirer||[]).map(x=>x.muscle
      ? volAffiche(x.series)+' série'+(x.series>1?'s':'')+' sur les '+(((MUSCLES[x.muscle]||{}).lib||x.muscle).toLowerCase())
      : volAffiche(x.series)+' série'+(x.series>1?'s':'')+' qu’aucun muscle non prioritaire ne peut céder');
    toast('Plafond dépassé de '+volAffiche(p.depasse)+' séries. À retirer : '+l.join(', ')+'.','var(--red)');
    return false;
  }
  const g=blocGestesSeries(c,a);
  if(!g.length){ toast('Aucun écart de séries à appliquer.','var(--orange)'); return false; }
  const fait=_blocEcrire(clientId,g,g.length+' série'+(g.length>1?'s':'')+' ajustée'+(g.length>1?'s':''));
  if(fait) try{ renderBlocPriorite(getOwnedClient(clientId)); }catch(e){}
  return fait;
}
// GESTE 2 — L'ORDRE. Un muscle prioritaire se travaille EN PREMIER, quand la
// seance est encore fraiche. Remonter ses exercices en tete ne change ni le
// volume ni l'intensite : c'est le geste le moins couteux du lot, et souvent
// le plus rentable.
function blocAppliquerOrdre(clientId){
  const res=(function(){ try{ return resolveClient(clientId); }catch(e){ return null; } })();
  if(!res) return false;
  const c=res.c, users=res.users;
  const b=blocPriorite(c);
  if(!b||!b.hauts.length){ toast('Aucun muscle prioritaire.','var(--orange)'); return false; }
  const cfg=_creneauxDe(c);
  let bouge=0;
  const out=cfg.map(s=>{
    if(!s||s.active!==true||!Array.isArray(s.exercises)) return s;
    const prio=[], reste=[];
    for(const ex of s.exercises){
      let cls=null; try{ cls=resoudreMusclesLecture(ex&&ex.name,ex,c); }catch(e){ cls=null; }
      const est=!!(cls&&cls!==VOL_CARDIO&&(cls.p||[]).some(m=>b.hauts.indexOf(m)>=0));
      (est?prio:reste).push(ex);
    }
    if(!prio.length||!reste.length) return s;
    // DEJA EN TETE : on ne touche a rien. Un instantane et un envoi pour un
    // ordre inchange, c'est du bruit dans l'historique du coach.
    const dejaEnTete=s.exercises.slice(0,prio.length).every(x=>prio.indexOf(x)>=0);
    if(dejaEnTete) return s;
    bouge++;
    return Object.assign({},s,{exercises:prio.concat(reste)});
  });
  if(!bouge){ toast('Les exercices prioritaires sont déjà en tête.','var(--orange)'); return false; }
  _pushSessionsHistory(c);
  c.sessions_config=out;
  c.updatedAt=Date.now();
  users[c.email]=c;
  const ok=DB.set('users',users);
  try{ _journalSeance(c,'bloc_priorite',{quoi:'ordre des exercices',n:bouge}); }catch(e){}
  toastSync(ok,CLOUD.pushOne(c.email,c),bouge+' séance'+(bouge>1?'s réordonnées':' réordonnée'),'la réorganisation est');
  try{ renderBlocPriorite(getOwnedClient(clientId)); }catch(e){}
  return true;
}
// PURE. Faut-il une seance de plus ? La cible est-elle hors d'atteinte a
// frequence constante ?
//
// LE PLAFOND PAR SEANCE EST UN REPERE DE TERRAIN, comme les autres : au-dela
// d'une dizaine de series dures sur un meme muscle dans la meme seance, les
// dernieres n'apportent plus grand-chose. On ne le presente donc pas comme une
// verite, mais comme la raison d'une proposition.
const BLOC_SERIES_PAR_SEANCE=10;
function blocFrequenceProposee(c,arb){
  const a=arb||blocArbitrage(c);
  if(!a) return null;
  for(const l of a.lignes){
    if(l.role!=='haut') continue;
    const exs=_blocExercicesDe(c,l.muscle);
    const seances=new Set(exs.map(x=>x.slot)).size;
    if(!seances) continue;
    if(l.cible/seances>BLOC_SERIES_PAR_SEANCE)
      return {muscle:l.muscle,seances:seances,cible:l.cible,
        parSeance:Math.round(l.cible/seances*10)/10};
  }
  return null;
}
// PURE. LA MESURE QUI SUIT CE MUSCLE, ou null. Toutes n'en ont pas une : les
// deltoides n'ont aucun tour de bras qui les isole, et inventer un
// rapprochement serait pire que de dire qu'il n'y en a pas.
// ⚠ TROIS CORRECTIONS LE 20/09/2026, ET AUCUN APPARIEMENT INVENTE.
//
//   · DORSAUX → chest A SAUTE. Un tour de poitrine mesure les pectoraux ET le
//     dos ensemble : poser le meme centimetre sur deux muscles faisait lire
//     deux progressions la ou il n'y en a qu'une. Les dorsaux restent gris, et
//     le schema corporel le DIT — « pas de mesure ».
//   · FESSIERS passe de `hips` a `glutes`. Les deux existent au bilan ; le
//     tour de hanches passe sur l'os iliaque, le tour de fessiers sur le
//     muscle. C'est le second qui suit le fessier.
//   · MOLLETS → calf-r ENTRE. La mesure etait prise depuis toujours et n'etait
//     reliee a rien.
//
// ⚠ BICEPS ET TRICEPS PARTAGENT `bicep-r`, ET C'EST ASSUME. Un tour de bras ne
//   separe pas les deux, exactement comme le tour de poitrine ne separe pas
//   les pectoraux du dos. La difference tient a ce qu'on en dit : le schema
//   corporel affiche la SOURCE sous chaque ecart — les deux etiquettes portent
//   « biceps D », et le coach voit qu'il lit une mesure, pas deux. Les effacer
//   aurait rendu muets deux muscles qui sont, eux, bel et bien mesures. Meme
//   raisonnement pour quadriceps et ischios, qui partagent `thigh-r`.
//
// ⚠ ET RIEN D'AUTRE. Trapezes, lombaires, deltoides, abdominaux, avant-bras,
//   adducteurs, abducteurs : aucune mensuration ne les suit. Inventer un
//   rapprochement serait pire que de dire qu'il n'y en a pas.
const BLOC_MESURE_DE=Object.freeze({
  PECTORAUX:'chest', BICEPS:'bicep-r', TRICEPS:'bicep-r',
  QUADRICEPS:'thigh-r', ISCHIOS:'thigh-r',
  FESSIERS:'glutes', MOLLETS:'calf-r'
});
// PURE. L'evolution de la mesure liee, sur la duree du bloc. Rend
// {lib,delta} ou null.
function blocMesureBilan(user,muscle,debut,fin){
  const cle=BLOC_MESURE_DE[muscle];
  if(!cle) return null;
  let r=null; try{ r=rapMensurations(_dossier(user),debut,fin); }catch(e){ return null; }
  if(!r||!r.present) return null;
  const lib=(RAP_MESURES.find(x=>x.cle===cle)||{}).lib;
  const l=(r.lignes||[]).find(x=>x.lib===lib);
  return l?{lib:l.lib,delta:l.delta}:null;
}
// ══════════ LE PANNEAU DU COACH ════════════════════════════════════════
//
// LA SYNTHESE EN TETE, ET AVANT TOUT BOUTON. Le coach doit lire l'arbitrage
// COMPLET en une phrase — « +6 sur les epaules, -4 sur les quadriceps, total
// +2 % » — avant d'appliquer quoi que ce soit. Une liste de muscles sans total
// laisse croire qu'on ajoute sans retirer, et c'est exactement l'erreur que ce
// lot existe pour empecher.
const BLOC_ROLES=Object.freeze([
  {cle:'haut',   lib:'Prioritaire', c:'var(--red)'},
  {cle:'normal', lib:'Normal',      c:'var(--sub)'},
  {cle:'bas',    lib:'Maintien',    c:'var(--info)'}
]);
function _blocLigne(c,l){
  const nom=(MUSCLES[l.muscle]||{}).lib||l.muscle;
  const e=l.ecart;
  const sig=e>0.05?'+':'';
  const teinte=e>0.05?'var(--success)':(e<-0.05?'var(--orange)':'var(--sub)');
  return '<div style="margin-bottom:10px">'
    +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:4px">'
    +'<span style="font-size:var(--fs-xs);font-weight:800;color:'+((MUSCLES[l.muscle]||{}).c||'var(--text)')+'">'
    +escapeHtml(nom)+'</span>'
    +'<span style="font-size:var(--fs-2xs);color:var(--sub);white-space:nowrap">'
    +volAffiche(l.actuel)+' → <b style="color:var(--text)">'+volAffiche(l.cible)+'</b>'
    +(Math.abs(e)>0.05?' <span style="color:'+teinte+'">('+sig+volAffiche(e)+')</span>':'')
    +'</span></div>'
    // LA BARRE EXISTANTE, pas une seconde. _volBarre porte deja les zones, le
    // trait de MRV et le marquage d'aberration : en redessiner une ici, c'est
    // garantir que les deux divergeront au premier correctif.
    +_volBarre(l.muscle,l.actuel,l.rep,false,c)
    +'</div>';
}
function _htmlBlocPriorite(c){
  const u=_dossier(c);
  const b=blocPriorite(u);
  // PAS DE BLOC : un bouton pour en ouvrir un, et rien d'autre. Un panneau
  // vide avec trois colonnes vides serait du mobilier.
  if(!b){
    return '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:16px">'
      +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:8px">'
      +'<span style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase">Bloc de priorité</span></div>'
      +'<div style="font-size:var(--fs-xs);color:var(--text-faint);line-height:1.6;margin-bottom:10px">'
      +'Concentrer le volume sur un à trois muscles, à budget de récupération constant. '
      +'Ce qu’on ajoute quelque part se retire ailleurs.</div>'
      +'<button class="btn btn-outline btn-sm" style="width:100%" onclick="blocOuvrir()">Ouvrir un bloc</button></div>';
  }
  const a=blocArbitrage(u);
  const p=blocPlafond(u,a);
  const av=a&&a.avancement;
  const freq=blocFrequenceProposee(u,a);
  const parRole={haut:[],normal:[],bas:[]};
  for(const l of ((a&&a.lignes)||[])) (parRole[l.role]||parRole.normal).push(l);
  const colonne=r=>{
    const l=parRole[r.cle]||[];
    return '<div style="margin-bottom:12px">'
      +'<div style="font-size:var(--fs-2xs);font-weight:800;letter-spacing:1.5px;color:'+r.c
      +';text-transform:uppercase;margin-bottom:6px">'+r.lib+' ('+l.length+')</div>'
      +(l.length?l.map(x=>_blocLigne(u,x)).join('')
        :'<div style="font-size:var(--fs-2xs);color:var(--text-faint)">aucun</div>')
      +'</div>';
  };
  const depasse=!!(p&&!p.ok);
  return '<div style="background:var(--surface-1);border:1px solid '+(depasse?'var(--red)':'var(--border)')
    +';border-radius:var(--r-3);padding:14px;margin-bottom:16px">'
    +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:8px">'
    +'<span style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase">Bloc de priorité</span>'
    +'<span style="font-size:var(--fs-2xs);color:var(--text-faint)">'
    +(av?('semaine '+av.semaine+'/'+av.total):'')+'</span></div>'
    // LA PHRASE, EN TETE.
    +'<div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6;margin-bottom:'
    +(depasse?'6px':'11px')+'">'+escapeHtml(blocSynthese(u,a,p))+'</div>'
    +(depasse
      ? '<div style="font-size:var(--fs-xs);color:var(--red-light);line-height:1.6;margin-bottom:12px">'
        +'Plafond dépassé de '+volAffiche(p.depasse)+' séries pondérées ('
        +String(p.hausse).replace('.',',')+' % contre +10 % permis). À retirer : '
        +escapeHtml(((p.aRetirer||[]).map(x=>x.muscle
            ? volAffiche(x.series)+' sur les '+(((MUSCLES[x.muscle]||{}).lib||x.muscle).toLowerCase())
            : volAffiche(x.series)+' qu’aucun muscle non prioritaire ne peut céder').join(', ')))
        +'.</div>'
      : (p&&p.raison
        ? '<div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-bottom:12px">'+escapeHtml(p.raison)+'</div>'
        : ''))
    +BLOC_ROLES.map(colonne).join('')
    // TROIS BOUTONS DISTINCTS, REFUSABLES UN PAR UN. Rien ne s'applique en
    // bloc : le coach garde la main sur chaque geste.
    +'<div style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px">'
    +'<button class="btn btn-outline btn-sm" style="width:100%;margin-bottom:8px"'
    +(depasse?' disabled style="width:100%;margin-bottom:8px;opacity:.45"':'')
    +' onclick="blocAppliquerSeries('+JSON.stringify(String((u&&u.id)||'')).replace(/"/g,'&quot;')+')">'
    +'Enregistrer les séries</button>'
    +'<button class="btn btn-outline btn-sm" style="width:100%;margin-bottom:8px" onclick="blocAppliquerOrdre('
    +JSON.stringify(String((u&&u.id)||'')).replace(/"/g,'&quot;')+')">'
    +'Remonter les prioritaires en tête de séance</button>'
    +(freq
      ? '<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-bottom:8px">'
        +escapeHtml(((MUSCLES[freq.muscle]||{}).lib||freq.muscle))+' : '+volAffiche(freq.cible)
        +' séries sur '+freq.seances+' séance'+(freq.seances>1?'s':'')+', soit '+volAffiche(freq.parSeance)
        +' par séance. Une séance de plus les répartirait mieux.</div>'
      : '')
    +'<button class="btn btn-outline btn-sm" style="width:100%" onclick="blocFermer()">Clore le bloc</button>'
    +'</div></div>';
}
function renderBlocPriorite(c){
  const z=document.getElementById('ccd-bloc');
  if(!z) return false;
  let h=''; try{ h=c?_htmlBlocPriorite(c):''; }catch(e){ h=''; }
  z.innerHTML=h;
  try{ _animerJauges(z); }catch(e){}
  return true;
}
// L'OUVERTURE et la CLOTURE. Rien ne se reconduit tout seul : a l'echeance, le
// signal remonte au coach et c'est lui qui decide de reconduire, d'inverser ou
// de revenir a plat.
async function blocOuvrir(){
  const c=(function(){ try{ return getOwnedClient(currentClientId); }catch(e){ return null; } })();
  if(!c){ toast('Aucun athlète ouvert.','var(--orange)'); return false; }
  let n=null;
  try{ n=await rcSaisie('Durée du bloc','Combien de semaines ?','6'); }catch(e){ n=null; }
  if(n===null) return false;
  const s=Math.round(Number(String(n).replace(',','.')));
  if(!(s>=2&&s<=16)){ toast('Entre 2 et 16 semaines.','var(--orange)'); return false; }
  c.blocPriorite={debut:Date.now(),semaines:s,hauts:[],bas:[],note:''};
  return _blocSauver(c,'Bloc ouvert sur '+s+' semaines');
}
async function blocFermer(){
  const c=(function(){ try{ return getOwnedClient(currentClientId); }catch(e){ return null; } })();
  if(!c||!c.blocPriorite) return false;
  let ok=false;
  try{ ok=await rcConfirm('Clore le bloc ?','Le programme reste tel quel : clore ne défait rien, cela ferme seulement la période.','Clore','Annuler'); }
  catch(e){ ok=false; }
  if(!ok) return false;
  delete c.blocPriorite;
  return _blocSauver(c,'Bloc clos');
}
function blocBasculer(muscle,role){
  const c=(function(){ try{ return getOwnedClient(currentClientId); }catch(e){ return null; } })();
  if(!c) return false;
  let r={ok:true};
  if(role==='haut') r=blocAjouterHaut(c,muscle);
  else if(role==='bas') r=blocAjouterBas(c,muscle);
  else r=blocRetirer(c,muscle);
  // LE REFUS S'AFFICHE, IL NE SE DEVINE PAS. Un bouton qui ne repond pas
  // laisse croire a une panne ; la phrase dit pourquoi et quoi faire.
  if(!r.ok){ toast(r.raison||'Impossible.','var(--orange)'); return false; }
  return _blocSauver(c,null);
}
function _blocSauver(c,libelle){
  const res=(function(){ try{ return resolveClient(c&&c.id); }catch(e){ return null; } })();
  if(!res) return false;
  const cible=res.c, users=res.users;
  cible.blocPriorite=c.blocPriorite;
  cible.updatedAt=Date.now();
  users[cible.email]=cible;
  const ok=DB.set('users',users);
  const _envoi=CLOUD.pushOne(cible.email,cible);
  if(libelle) toastSync(ok,_envoi,libelle,'le bloc est');
  try{ renderBlocPriorite(getOwnedClient(cible.id)); }catch(e){}
  return true;
}
// ══════════ LA DISPONIBILITE ═══════════════════════════════════════════
//
// « LE SEUL LOGICIEL DE COACHING QUI SAIT SE TAIRE ». Un score affiche tous
// les jours viole ce positionnement : il transforme une app d'entrainement en
// tableau de bord qu'on consulte, et il apprend a l'athlete a chercher une
// permission avant de s'entrainer. Cette note EXISTE pour rester invisible :
// au-dessus du seuil, elle ne dit rien, et c'est son etat normal.
//
// QUATRE ENTREES, ET RIEN D'AUTRE. Tout ce que l'application collecte deja,
// chacun dans son ecran, et que personne ne lisait ensemble. Aucune mesure
// nouvelle n'est demandee a l'athlete : la donnee est la, elle n'etait pas
// croisee.
//
// AUCUNE MODULATION PAR LE CYCLE MENSTRUEL. L'arbitrage d'aout 2026 l'a
// ecartee sur des effets de 0,01 a 0,14 (McNulty 2020, Colenso-Semple 2023) :
// une note qui bougerait de deux points selon la phase donnerait a une
// incertitude l'apparence d'une mesure. Ne pas la reintroduire par ce chemin.
//
// AUCUN VOCABULAIRE MEDICAL. « Disponibilite », pas « recuperation HRV », pas
// « stress physiologique » : l'application ne mesure aucun de ces deux-la, et
// leur emprunter le nom serait leur emprunter une autorite qu'elle n'a pas.
// SIX ENTREES DEPUIS LE BUILD 1828 (06/10/2026) : la FC de repos et la VFC
// synchronisees (recupCardio, contre la base de 28 jours de l'athlete), et le
// ressenti DECLARE du cycle (« c'est dur », j1_difficile) — ce que l'athlete
// dit de sa journee, pas une phase calculee. Toujours aucune saisie de plus :
// une entree absente sort du calcul, son poids se redistribue.
const DISPO_POIDS=Object.freeze({sommeil:40,douleur:25,rir:20,charge:15,cardio:15,ressenti:15});
const DISPO_SEUIL_VERT=70;
const DISPO_SEUIL_ORANGE=50;
const DISPO_ENTREES_MIN=2;      // sous deux entrees : pas de donnee, pas d'avis
const DISPO_SOMMEIL_JOURS=30;   // la mediane personnelle, pas une norme
const DISPO_CHARGE_JOURS=28;

// PURE. Une date ISO en objet Date, a minuit LOCAL. `new Date('2026-09-03')`
// seul serait interprete en UTC : a Paris en ete, la date recule d'un jour et
// toutes les fenetres glissantes sont decalees de 24 h.
function _dateDeISO(iso){
  const d=new Date(String(iso||'')+'T00:00:00');
  return isNaN(d.getTime())?new Date():d;
}
// PURE. La mediane d'une liste, ou null. _mediane rend 0 sur une liste vide,
// ce qui se lirait ici comme « mediane nulle » — un athlete parfaitement
// repose plutot qu'un athlete inconnu.
function _dispoMediane(l){
  const t=(l||[]).filter(x=>typeof x==='number'&&isFinite(x));
  return t.length?_mediane(t):null;
}
// PURE. Un rapport a la reference, ramene sur 0..100.
//
// CENT AU-DESSUS DE LA REFERENCE, ET LA PENTE NE PUNIT QUE LA BAISSE. Dormir
// plus que d'habitude ne rend pas plus disponible que « disponible » : le
// plafond est a 100, et le supplement de sommeil n'achete pas de credit.
function _dispoRatio(valeur,reference,pentePourCent){
  if(valeur==null||reference==null||!(reference>0)) return null;
  const ecart=(valeur-reference)/reference;
  if(ecart>=0) return 100;
  return Math.max(0,Math.min(100,Math.round(100+ecart*100/(pentePourCent/100))));
}
// PURE. SOMMEIL — les deux dernieres nuits contre la mediane sur 30 jours.
//
// LA MEDIANE PERSONNELLE, JAMAIS UNE NORME. « Huit heures » est une moyenne de
// population ; quelqu'un qui dort six heures depuis dix ans n'est pas en dette
// de deux heures, il est a son point d'equilibre. On compare l'athlete a
// lui-meme, ce qui est aussi la seule comparaison qu'on ait le droit de faire.
//
// DEUX NUITS, PAS UNE. Une nuit courte est un evenement ; deux d'affilee sont
// un etat. Une seule nuit renseignee suffit pourtant a repondre : refuser de
// se prononcer parce qu'il manque la seconde ferait taire l'entree la plus
// lourde exactement les jours ou elle compte.
// Le journal de sommeil, UNE NUIT PAR DATE : une nuit saisie deux fois le même
// jour garde la DERNIÈRE saisie (l'ordre du journal fait foi).
function _dispoSommeilLog(user){
  const parDate=new Map();
  for(const e of ((user&&user.sleepLog)||[])){
    if(!e||!e.date||!(Number(e.duration)>0)) continue;
    parDate.set(String(e.date),e);
  }
  return Array.from(parDate.values());
}
// PURE. Le détail du sommeil : {score, moy, ref, ecartPct}, ou null.
// LE SEUL JUGEMENT DU SOMMEIL DE L'APP : disponibilite et scoreRecuperation
// le lisent tous deux ici.
function _dispoSommeilDetail(user,dateISO){
  const log=_dispoSommeilLog(user);
  if(!log.length) return null;
  const fin=dateISO||localISODate(new Date());
  const debut30=localISODate(_datePlusJours(_dateDeISO(fin),-DISPO_SOMMEIL_JOURS));
  const ref=_dispoMediane(log.filter(e=>e.date>debut30&&e.date<=fin).map(e=>Number(e.duration)));
  const j1=localISODate(_datePlusJours(_dateDeISO(fin),-1));
  const j2=localISODate(_datePlusJours(_dateDeISO(fin),-2));
  const deux=log.filter(e=>e.date===fin||e.date===j1||e.date===j2).map(e=>Number(e.duration));
  if(!deux.length||ref==null) return null;
  const moy=deux.reduce((a,b)=>a+b,0)/deux.length;
  return {score:_dispoRatio(moy,ref,30),moy,ref,ecartPct:Math.round((moy/ref-1)*100)};
}
function _dispoSommeil(user,dateISO){
  const d=_dispoSommeilDetail(user,dateISO);
  return d?d.score:null;
}
// PURE. DOULEUR — le nombre de series douloureuses sur sept jours.
//
// TOUTE DOULEUR DECLAREE COMPTE, pas seulement celle qui depasse le seuil des
// signaux coach. Ici on ne cherche pas a alerter quelqu'un, on cherche a
// savoir si le corps a envoye des signes : un « 1 » repete est une
// information, meme s'il ne merite pas de remonter au coach.
const DISPO_DOULEUR_ZERO=8;     // huit series douloureuses en sept jours = 0
function _dispoDouleur(user,dateISO){
  const ss=((user&&user.sessions)||[]).filter(s=>s&&s.date&&s.data);
  if(!ss.length) return null;
  const fin=_dateDeISO(dateISO||localISODate(new Date())).getTime()+86400000;
  const debut=fin-7*86400000;
  let n=0, vues=0;
  for(const sess of ss){
    if(!(sess.date>=debut&&sess.date<fin)) continue;
    vues++;
    for(const nom of Object.keys(sess.data)){
      const d=sess.data[nom];
      for(const s of ((d&&d.sets)||[])){
        const p=parseInt(s&&s.pain,10);
        if(isFinite(p)&&p>0) n++;
      }
    }
  }
  // AUCUNE SEANCE DANS LA FENETRE : on ne sait pas, on ne dit pas « zero
  // douleur ». Une semaine sans entrainement n'est pas une semaine sans mal.
  if(!vues) return null;
  return Math.max(0,Math.round(100-n*100/DISPO_DOULEUR_ZERO));
}
// PURE. ECART RIR — moyenne de (atteint - prescrit) sur sept jours.
//
// LE SIGNE COMPTE, ET IL EST CONTRE-INTUITIF. Un RIR ATTEINT plus BAS que
// prescrit veut dire que l'athlete est alle plus pres de l'echec que demande :
// il a puise davantage. C'est donc l'ecart NEGATIF qui degrade la
// disponibilite, pas le positif.
//
// PASSE PAR rirCorrige : c'est une lecture de decision, et deux athletes qui
// declarent « RIR 2 » ne sont pas au meme endroit — voir le calibrage.
const DISPO_RIR_ZERO=2;         // deux repetitions sous la consigne = 0
function _dispoEcartRir(user,dateISO){
  const u=user;
  if(!u||!Array.isArray(u.sessions)) return null;
  const fin=_dateDeISO(dateISO||localISODate(new Date())).getTime()+86400000;
  const debut=fin-7*86400000;
  // La consigne du jour d'abord — rirPlanned fige ce qui etait prescrit au
  // moment de la seance ; le gabarit d'aujourd'hui n'est qu'un repli.
  const pres={};
  try{
    for(const s of (Array.isArray(u.sessions_config)?u.sessions_config:[])){
      if(!s||s.active!==true||!Array.isArray(s.exercises)) continue;
      for(const ex of s.exercises){
        const r=_rirPrescrit(ex);
        if(r==='') continue;
        const k=exKey((ex&&ex.name)||'');
        if(k&&pres[k]==null) pres[k]=Number(r);
      }
    }
  }catch(e){}
  let somme=0, n=0;
  for(const sess of u.sessions){
    if(!sess||!sess.data||!(sess.date>=debut&&sess.date<fin)) continue;
    const fige=(sess.rirPlanned&&typeof sess.rirPlanned==='object')?sess.rirPlanned:null;
    for(const nom of Object.keys(sess.data)){
      const cons=(fige&&fige[nom]!=null)?Number(fige[nom]):pres[exKey(nom)];
      if(cons==null||!isFinite(cons)) continue;
      const d=sess.data[nom];
      for(const s of ((d&&d.sets)||[])){
        if(!s||s.done!==true||s.rir===''||s.rir==null) continue;
        const brut=(s.rir==='echec')?0:(parseInt(s.rir,10)||0);
        let v=brut; try{ v=rirCorrige(u,brut); }catch(e){ v=brut; }
        somme+=(v-cons); n++;
      }
    }
  }
  if(!n) return null;
  const ecart=somme/n;
  if(ecart>=0) return 100;      // plus facile que demande : rien a signaler
  return Math.max(0,Math.min(100,Math.round(100+ecart*100/DISPO_RIR_ZERO)));
}
// PURE. CHARGE — le rapport aigu/chronique de la charge INTERNE.
//
// LE TONNAGE A CEDE LA PLACE, ET C'EST LA MEME INTENTION MIEUX MESUREE. Ce
// terme cherchait « la semaine a-t-elle ete plus lourde que d'habitude » ;
// le tonnage n'en donnait qu'une moitie — il ignore la duree et l'effort
// percu, donc il ne voit pas une semaine courte et brutale. Le ratio les
// integre. Le tonnage, lui, N'EST RETIRE DE NULLE PART : il reste affiche,
// l'athlete le connait, et les deux mesures disent des choses differentes.
//
// C'EST LA HAUSSE QUI DEGRADE, pas la baisse : une semaine legere ne rend
// personne indisponible.
//
// SANS RATIO, PAS DE TERME. ratioCharge rend null sous trois semaines
// d'historique ou sous deux notes sur trois : l'entree sort alors du calcul
// et son poids se redistribue, plutot que d'inventer une valeur moyenne.
// PURE. CARDIO — la FC de repos et la VFC, contre la base de 28 jours de
// l'athlete (recupCardio). Une FC de repos 15 bpm au-dessus de sa base, ou une
// VFC 30 % en dessous, valent 0 ; au-dessus de la base, 100. Le pire des deux.
// Sans journal, ou sans base (une montre portee une seule nuit) : null.
const DISPO_FC_ZERO_BPM=15, DISPO_VFC_ZERO_PCT=30;
function _dispoCardioDetail(user,dateISO){
  const t=_dateDeISO(dateISO||localISODate(new Date())).getTime()+12*3600000;
  let c=null; try{ c=recupCardio(user,t); }catch(e){ c=null; }
  if(!c||(!c.fc&&!c.vfc)) return null;
  const notes=[];
  if(c.fc) notes.push(c.fc.ecart<=0?100:Math.max(0,Math.round(100-c.fc.ecart*100/DISPO_FC_ZERO_BPM)));
  if(c.vfc) notes.push(c.vfc.ecart>=0?100:Math.max(0,Math.round(100+c.vfc.ecart*100/DISPO_VFC_ZERO_PCT)));
  return {score:Math.min.apply(null,notes),fc:c.fc,vfc:c.vfc};
}
function _dispoCardio(user,dateISO){
  const d=_dispoCardioDetail(user,dateISO);
  return d?d.score:null;
}
// PURE. RESSENTI — le cycle DECLARE « c'est dur » (j1_difficile). Une phrase de
// l'athlete sur sa journee : elle pese comme une entree basse, sans plus.
const DISPO_RESSENTI_DUR=40;
function _dispoRessenti(user){
  return (user&&user.currentCycle==='j1_difficile')?DISPO_RESSENTI_DUR:null;
}
const DISPO_CHARGE_RATIO_ZERO=1.6;   // ratio a partir duquel le terme vaut 0
function _dispoCharge(user,dateISO){
  if(!user||!Array.isArray(user.sessions)) return null;
  const fin=_dateDeISO(dateISO||localISODate(new Date())).getTime()+86400000;
  let r=null; try{ r=ratioCharge(user,fin); }catch(e){ r=null; }
  if(r==null) return null;
  if(r<=1) return 100;
  const t=(r-1)/(DISPO_CHARGE_RATIO_ZERO-1);
  return Math.max(0,Math.min(100,Math.round(100-t*100)));
}
// PURE. La disponibilite. AUCUN ACCES AU DOM, aucune ecriture : l'affichage
// est ailleurs, et c'est ce qui la rend testable.
//
// UNE ENTREE ABSENTE EST RETIREE, SON POIDS REDISTRIBUE. On ne remplace jamais
// une absence par une moyenne : inventer « 50 » pour un sommeil non renseigne,
// c'est fabriquer une mesure et la faire peser 40 %.
//
// SOUS DEUX ENTREES : PAS DE DONNEE, PAS D'AVIS. Une note batie sur une seule
// mesure porterait tout le poids d'une seule saisie, et un oubli de la veille
// ferait annuler une seance.
function disponibilite(user,dateISO){
  const vide={note:null,drapeau:'vert',motif:null,donneesManquantes:[]};
  const u=(user===undefined)?currentUser:user;
  if(!u) return vide;
  const d=dateISO||localISODate(new Date());
  const sous={};
  const manquantes=[];
  const calc={sommeil:_dispoSommeil,douleur:_dispoDouleur,rir:_dispoEcartRir,charge:_dispoCharge,
    cardio:_dispoCardio,ressenti:_dispoRessenti};
  for(const k of Object.keys(DISPO_POIDS)){
    let v=null; try{ v=calc[k](u,d); }catch(e){ v=null; }
    if(v==null||!isFinite(v)) manquantes.push(k); else sous[k]=v;
  }
  const dispo=Object.keys(sous);
  if(dispo.length<DISPO_ENTREES_MIN)
    return {note:null,drapeau:'vert',motif:null,donneesManquantes:manquantes};
  let poidsTotal=0;
  for(const k of dispo) poidsTotal+=DISPO_POIDS[k];
  let note=0;
  for(const k of dispo) note+=sous[k]*DISPO_POIDS[k]/poidsTotal;
  note=Math.max(0,Math.min(100,Math.round(note)));
  const drapeau=note>=DISPO_SEUIL_VERT?'vert':(note>=DISPO_SEUIL_ORANGE?'orange':'rouge');
  // UNE SEULE CAUSE, JAMAIS DEUX. Une phrase qui liste trois facteurs n'est
  // plus une consigne, c'est un tableau de bord — et on retombe dans ce que
  // ce lot existe pour eviter. On nomme l'entree la plus degradee, et elle
  // seule.
  let motif=null;
  if(drapeau!=='vert'){
    let pire=null;
    for(const k of dispo) if(pire===null||sous[k]<sous[pire]) pire=k;
    motif=_dispoMotif(pire,drapeau,u,d);
  }
  return {note:note,drapeau:drapeau,motif:motif,donneesManquantes:manquantes,
    // `sous` sort pour la suite de tests et la fiche coach. Il ne s'affiche
    // JAMAIS a l'athlete : quatre sous-scores, c'est le tableau de bord.
    sousScores:sous,cause:drapeau==='vert'?null:(function(){
      let p=null; for(const k of dispo) if(p===null||sous[k]<sous[p]) p=k; return p;})()};
}
// PURE. La phrase. Elle nomme une cause et dit QUOI FAIRE : « ta note est de
// 58 » n'aide personne, « enleve la derniere serie » si.
function _dispoMotif(cause,drapeau,user,dateISO){
  const rouge=(drapeau==='rouge');
  if(cause==='sommeil')
    return rouge
      ? 'Deux nuits nettement plus courtes que d’habitude. Séance légère ou repos : dis-le à ton coach.'
      : 'Deux nuits courtes. Garde la charge, enlève la dernière série.';
  if(cause==='douleur'){
    let n=0;
    try{
      const fin=_dateDeISO(dateISO).getTime()+86400000, deb=fin-7*86400000;
      for(const s of ((user&&user.sessions)||[])){
        if(!s||!s.data||!(s.date>=deb&&s.date<fin)) continue;
        if(Object.keys(s.data).some(nom=>((s.data[nom]||{}).sets||[])
          .some(x=>isFinite(parseInt(x&&x.pain,10))&&parseInt(x.pain,10)>0))) n++;
      }
    }catch(e){}
    return rouge
      ? (n?n+' séances avec douleur cette semaine. ':'')+'Séance légère ou repos : dis-le à ton coach.'
      : 'Des douleurs déclarées cette semaine. Garde la charge, enlève la dernière série.';
  }
  if(cause==='cardio')
    return rouge
      ? 'Ta FC de repos ou ta VFC s’écartent nettement de ta base. Séance légère ou repos : dis-le à ton coach.'
      : 'Ta FC de repos ou ta VFC s’écartent de ta base. Garde la charge, enlève la dernière série.';
  if(cause==='ressenti')
    return rouge
      ? 'Tu as dit que c’était dur aujourd’hui. Séance légère ou repos : dis-le à ton coach.'
      : 'Tu as dit que c’était dur aujourd’hui. Garde la charge, un RIR de plus.';
  if(cause==='rir')
    return rouge
      ? 'Tu es allé nettement plus près de l’échec que prévu cette semaine. Séance légère ou repos : dis-le à ton coach.'
      : 'Tu pousses plus près de l’échec que prévu. Garde la charge, enlève la dernière série.';
  return rouge
    ? 'Ta charge a beaucoup augmenté cette semaine. Séance légère ou repos : dis-le à ton coach.'
    : 'Charge en nette hausse cette semaine. Garde la charge, enlève la dernière série.';
}
// ══════════ L'EFFET SUR LA SÉANCE (06/10/2026, build 1828) ══════════════
// 'orange' ou 'rouge' : UN RIR DE PLUS sur toutes les suggestions du jour, et
// pas de record à portée (le rouge garde en plus sa proposition d'alléger la
// semaine). Le cycle déclaré « c'est dur » prend le même chemin : charge
// gardée, un RIR de plus — sauf si le coach a choisi l'ancien réglage
// (cycleDurMode 'charge80' : ×0,80 sur la charge, voir getCycleFactor).
const DISPO_RIR_PLUS=1;
let _dispoEffetCache={cle:'',t:0,val:null};
function effetDispoDuJour(user,dateISO){
  const u=(user===undefined)?currentUser:user;
  const rien={rirPlus:0,pasDeRecord:false,drapeau:'vert',raison:null};
  if(!u) return rien;
  const d=dateISO||localISODate(new Date());
  const cle=[u.email||u.id||'?',d,u.updatedAt||0,(u.sessions||[]).length,(u.sleepLog||[]).length,u.currentCycle||''].join('|');
  if(_dispoEffetCache.cle===cle&&Date.now()-_dispoEffetCache.t<10000) return _dispoEffetCache.val;
  let r=rien;
  let dp=null; try{ dp=disponibilite(u,d); }catch(e){ dp=null; }
  const dur=u.currentCycle==='j1_difficile'&&u.cycleDurMode!=='charge80';
  if(dp&&(dp.drapeau==='orange'||dp.drapeau==='rouge'))
    r={rirPlus:DISPO_RIR_PLUS,pasDeRecord:true,drapeau:dp.drapeau,raison:'récupération en baisse, un RIR de plus aujourd’hui'};
  else if(dur)
    r={rirPlus:DISPO_RIR_PLUS,pasDeRecord:true,drapeau:dp?dp.drapeau:'vert',raison:'journée difficile déclarée, charge gardée et un RIR de plus'};
  _dispoEffetCache={cle,t:Date.now(),val:r};
  return r;
}
// PURE. Les verdicts des `n` derniers jours (le plus récent en premier).
function historiqueDispo(user,dateISO,n){
  const fin=_dateDeISO(dateISO||localISODate(new Date()));
  const out=[];
  for(let i=0;i<(n||7);i++){
    const d=localISODate(_datePlusJours(fin,-i));
    let x=null; try{ x=disponibilite(user,d); }catch(e){ x=null; }
    out.push({date:d,drapeau:x?x.drapeau:'vert',cause:x?x.cause:null,note:x?x.note:null});
  }
  return out;
}
// PURE. Le détail chiffré de la cause, pour la ligne du coach.
function _dispoDetail(cause,user,dateISO){
  try{
    if(cause==='sommeil'){ const s=_dispoSommeilDetail(user,dateISO); if(s) return 'sommeil '+(s.ecartPct>0?'+':'')+s.ecartPct+' % sous sa médiane'; }
    if(cause==='cardio'){ const c=_dispoCardioDetail(user,dateISO);
      if(c){ const l=[]; if(c.fc&&c.fc.ecart>0) l.push('FC de repos +'+String(c.fc.ecart).replace('.',',')+' bpm'); if(c.vfc&&c.vfc.ecart<0) l.push('VFC '+c.vfc.ecart+' %'); return (l.join(', ')||'FC de repos et VFC')+' contre sa base'; } }
    if(cause==='douleur') return 'douleurs déclarées sur 7 jours';
    if(cause==='rir') return 'plus près de l’échec que prévu';
    if(cause==='charge') return 'charge en nette hausse';
    if(cause==='ressenti') return 'journée difficile déclarée';
  }catch(e){}
  return cause||'';
}
// UNE LIGNE, LE MÊME VERDICT QUE CHEZ L'ATHLÈTE : « Récupération : orange
// depuis 3 jours (sommeil −25 % sous sa médiane) ». '' quand c'est vert.
function ligneRecuperationCoach(c,dateISO){
  const h=historiqueDispo(c,dateISO,7);
  const j=h[0];
  if(!j||j.drapeau==='vert') return '';
  let n=0; for(const x of h){ if(x.drapeau==='orange'||x.drapeau==='rouge') n++; else break; }
  const txt=n<=1?'aujourd’hui':'depuis '+n+' jours';
  const det=_dispoDetail(j.cause,c,j.date);
  return 'Récupération : '+j.drapeau+' '+txt+(det?' ('+det+')':'');
}
// ══════════ L'EFFET REEL ═══════════════════════════════════════════════
//
// UNE SEULE SURFACE : l'apercu de seance, et seulement quand le drapeau n'est
// pas vert. Pas d'accueil, pas d'onglet evolution, pas de rapport, et AUCUNE
// notification poussee — jamais. Un score qu'on peut aller consulter devient
// un score qu'on consulte, puis une permission qu'on attend.
//
// PROPOSER, JAMAIS IMPOSER. Le bouton allege ; il n'annule rien tout seul, et
// l'athlete peut l'ignorer et commencer sa seance telle quelle. Une
// application qui deciderait a sa place cesserait d'etre un outil.
//
// SANS EFFET, CE SERAIT DE LA DECORATION. Une note qui affiche « 58 » et ne
// change rien apprend a etre ignoree en trois semaines.
const DISPO_JOURNAL_MAX=12;
// Le journal des seances, distinct de celui de la nutrition.
//
// ⚠ ECART ASSUME AVEC LA DEMANDE, QUI NOMMAIT _pauseJournaliser : celle-ci
// ecrit dans user.nutrition.ajustHisto. Y ranger un allegement de SEANCE
// melangerait deux histoires qui n'ont ni la meme duree de vie ni les memes
// lecteurs — et le jour ou l'on exporte le journal nutrition, on exporterait
// des decisions d'entrainement. Meme discipline, meme fenetre de douze, autre
// tiroir.
function _journalSeance(user,quoi,extra){
  const u=_dossier(user);
  if(!u) return false;
  if(!Array.isArray(u.journalSeance)) u.journalSeance=[];
  u.journalSeance.push(Object.assign({date:Date.now(),origine:quoi},extra||{}));
  if(u.journalSeance.length>DISPO_JOURNAL_MAX)
    u.journalSeance=u.journalSeance.slice(-DISPO_JOURNAL_MAX);
  return true;
}
// PURE. Le dernier exercice allegeable d'une seance : le dernier qui ne soit
// ni du cardio ni deja a une seule serie. Rend son index, ou -1.
//
// LE DERNIER, ET C'EST LE MOINS COUTEUX. Retirer une serie au premier
// exercice ampute le travail principal ; la retirer a la fin retire ce que la
// fatigue a deja degrade.
function _dispoIndexAlleger(exercices){
  const l=Array.isArray(exercices)?exercices:[];
  for(let i=l.length-1;i>=0;i--){
    const ex=l[i];
    if(!ex||!ex.name) continue;
    try{ if(isCardio(ex)) continue; }catch(e){}
    if(Math.max(1,Number(ex.series)||3)<=1) continue;
    return i;
  }
  return -1;
}
// LE GESTE ORANGE. Pose une intention datee, consommee au lancement — le
// programme du coach n'est JAMAIS modifie : une seance allegee un mardi ne
// doit pas alleger tous les mardis suivants.
function dispoAllegerSeance(idx,d){
  const u=currentUser;
  if(!u) return false;
  const cfg=(Array.isArray(u.sessions_config)?u.sessions_config:[]);
  const sess=cfg[idx];
  if(!sess) return false;
  const i=_dispoIndexAlleger(sess.exercises);
  if(i<0){ try{ toast('Rien à alléger sur cette séance.','var(--orange)'); }catch(e){} return false; }
  const ex=sess.exercises[i];
  const avant=Math.max(1,Number(ex.series)||3);
  u.allegementJour={date:localISODate(new Date()),idx:idx,exercice:ex.name,
    avant:avant,apres:avant-1,cause:(d&&d.cause)||null,note:(d&&d.note)||null};
  // JOURNALISE AU GESTE, pas au lancement : le coach doit voir que l'athlete
  // a demande un allegement meme s'il ne commence finalement pas la seance.
  // C'est la meme information, et elle est plus utile tot.
  _journalSeance(u,'dispo_allegement',{exercice:ex.name,avant:avant,apres:avant-1,
    cause:(d&&d.cause)||null,note:(d&&d.note)||null});
  saveUserOuDire('Ton allègement de séance');
  const _envoi=CLOUD.pushOne(u.email,u);
  toastSync(true,_envoi,'Dernière série retirée sur '+ex.name+' '+ICO.coche,'l’allègement est');
  try{ _renderApercu(); }catch(e){}
  return true;
}
// CONSOMME AU LANCEMENT, ET UNE SEULE FOIS. L'intention porte sa date et son
// creneau : ouvrir un autre jour, ou une autre seance, ne la depense pas.
function _dispoConsommerAllegement(exercices,slotIdx){
  const u=currentUser;
  const a=u&&u.allegementJour;
  if(!a||a.date!==localISODate(new Date())) return false;
  if(typeof a.idx==='number'&&typeof slotIdx==='number'&&a.idx!==slotIdx) return false;
  const i=_dispoIndexAlleger(exercices);
  if(i<0) return false;
  exercices[i].series=Math.max(1,(Number(exercices[i].series)||3)-1);
  try{ delete u.allegementJour; saveUser(); }catch(e){ rcErreurMuette('_dispoConsommerAllegement',e); }
  return true;
}
// LE GESTE ROUGE. Reutilise le mecanisme de decharge plutot que d'en ecrire un
// second : deux allegements qui ne se ressembleraient pas finiraient par ne
// plus dire la meme chose de la meme semaine.
// DEUX TOUCHERS NE FONT QU'UNE DÉCHARGE (06/10/2026) : un verrou pendant la
// confirmation, et une semaine déjà allégée le dit au lieu de réécrire et de
// journaliser une seconde fois.
let _dispoReportEnCours=false;
async function dispoReporterSeance(d){
  const u=currentUser;
  if(!u||_dispoReportEnCours) return false;
  const actifs=(Array.isArray(u.sessions_config)?u.sessions_config:[]).filter(x=>x&&x.active);
  if(actifs.length&&actifs.every(x=>creneauEnDecharge(x))){
    try{ toast('Ta semaine est déjà allégée.','var(--info)'); }catch(e){}
    return false;
  }
  _dispoReportEnCours=true;
  try{ return await _dispoReporterSeance(u,d); } finally { _dispoReportEnCours=false; }
}
async function _dispoReporterSeance(u,d){
  let ok=false;
  try{ ok=await rcConfirm('Alléger la semaine ?',
    'Tes séances de cette semaine passeront en décharge : moins de séries, plus de réserve. Ton coach le verra.',
    'Alléger','Annuler'); }catch(e){ ok=false; }
  if(!ok) return false;
  let fait=false;
  try{ fait=appliquerDecharge(u,undefined,'athlete'); }catch(e){ fait=false; }
  if(!fait){ try{ toast('Aucune séance active à alléger.','var(--orange)'); }catch(e){} return false; }
  _journalSeance(u,'dispo_decharge',{cause:(d&&d.cause)||null,note:(d&&d.note)||null});
  saveUserOuDire('Ton report de séance');
  const _envoi=CLOUD.pushOne(u.email,u);
  toastSync(true,_envoi,'Semaine allégée '+ICO.coche,'l’allègement est');
  try{ _renderApercu(); }catch(e){}
  return true;
}
// L'ENCART. Rend '' quand le drapeau est vert — c'est-a-dire presque toujours,
// et c'est le but.
function _htmlDispo(idx){
  let d=null;
  try{ d=disponibilite(currentUser,localISODate(new Date())); }catch(e){ return ''; }
  // VERT, OU PAS DE DONNEE : RIEN. Pas un encart gris, pas un « tout va
  // bien » — le silence EST le message.
  if(!d||d.drapeau==='vert'||!d.motif) return '';
  const rouge=(d.drapeau==='rouge');
  const c=rouge?'var(--red)':'var(--orange)';
  const dejaAllege=!!(currentUser&&currentUser.allegementJour
    &&currentUser.allegementJour.date===localISODate(new Date()));
  return '<div style="background:'+(rouge?'rgba(224,32,32,.07)':'rgba(245,158,11,.07)')
    +';border:1px solid '+c+';border-radius:var(--r-3);padding:14px 16px;margin-bottom:14px">'
    // AUCUN CHIFFRE. « 58/100 » invite a comparer, a suivre, a optimiser la
    // note — et la note n'est pas l'objectif. On donne la consigne.
    +'<div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6">'
    +escapeHtml(d.motif)+'</div>'
    +(dejaAllege
      ? '<div style="font-size:var(--fs-xs);color:var(--success);margin-top:10px">'+icon('coche',14)+' Dernière série retirée pour aujourd’hui.</div>'
      : '<button class="btn btn-outline btn-sm" style="width:100%;margin-top:10px" onclick="'
        +(rouge?'dispoReporterSeance':'dispoAllegerSeance')
        +'('+(rouge?'':idx+',')+JSON.stringify({cause:d.cause,note:d.note}).replace(/"/g,'&quot;')+')">'
        +(rouge?'Alléger la semaine':'Enregistrer')+'</button>')
    +(rouge
      ? '<button class="btn btn-outline btn-sm" style="width:100%;margin-top:8px" onclick="clientTab(\'canal\')">En parler à ton coach</button>'
      : '')
    +'</div>';
}
// ══════════ LA BOUCLE DE RETOUR PAR MUSCLE ═════════════════════════════
//
// LES REPERES DE LA TABLE SONT LES MEMES POUR TOUT LE MONDE, et le commentaire
// de REPERES_VOLUME l'assume : c'est un repere de pratique de terrain, pas une
// mesure. Deux athletes n'ont pourtant ni la meme capacite de recuperation ni
// le meme point de rendement decroissant. Cette boucle deplace les bornes DE
// CET ATHLETE, une serie a la fois, sur ce qu'il rapporte de sa semaine.
//
// LA TABLE N'EST JAMAIS TOUCHEE. Elle reste le fond contre lequel tout se
// mesure — voir reperesTable : la regle se borne sur la REFERENCE et non sur
// le repere deja deplace, sinon chaque semaine partirait du resultat de la
// precedente et la derive n'aurait plus de fond.
//
// DEUX QUESTIONS, PAS TROIS. La performance ne se demande pas : l'historique
// la sait. Demander a quelqu'un ce que la donnee connait deja, c'est lui faire
// payer notre paresse et recolter une reponse moins fiable que le calcul.
const RETOUR_SEMAINES_MAX=12;      // meme fenetre glissante qu'ajustHisto
const RETOUR_CONGESTION=Object.freeze(['aucune','correcte','forte']);
const RETOUR_COURBATURES=Object.freeze(['aucune','legeres','marquees','encore']);
// Deux semaines muettes : on GELE le repere perso, on ne revient pas a la
// table. Revenir en silence changerait les seuils de quelqu'un qui n'a rien
// demande, et il le decouvrirait par une jauge qui change de couleur.
const RETOUR_GEL_SEMAINES=2;
// Sous ce seuil, la variation d'e1RM est du bruit de mesure : une charge
// arrondie au demi-kilo et une repetition de plus suffisent a la produire.
const RETOUR_PERF_SEUIL=0.02;      // 2 %

// PURE. Les retours d'un muscle, du plus ancien au plus recent.
function retoursMuscle(user,muscle){
  const u=_dossier(user);
  const l=u&&u.retourMuscle&&u.retourMuscle[muscle];
  return Array.isArray(l)?l.filter(x=>x&&x.semaineISO):[];
}
// PURE. Le retour d'une semaine donnee, ou null.
function retourSemaine(user,muscle,cle){
  return retoursMuscle(user,muscle).find(x=>x.semaineISO===cle)||null;
}
// PURE. L'e1RM moyen des exercices dont CE muscle est primaire, sur une
// semaine. Rend null quand la semaine n'a rien d'exploitable — une absence
// n'est pas un zero, et un zero ferait lire « effondrement ».
//
// PRIMAIRE SEULEMENT. Un developpe couche fait travailler les triceps, mais sa
// charge ne dit presque rien de leur progression : melanger les secondaires
// noierait le signal du muscle qu'on interroge.
function _perfMuscleSemaine(user,muscle,cle){
  const u=_dossier(user);
  const lundi=_lundiDeSemaine(cle);
  if(!lundi||!u||!Array.isArray(u.sessions)) return null;
  const debut=lundi.getTime(), fin=debut+7*86400000;
  let somme=0, n=0;
  for(const sess of u.sessions){
    if(!sess||!sess.data||sess.deload) continue;
    if(!(sess.date>=debut&&sess.date<fin)) continue;
    for(const nom of Object.keys(sess.data)){
      let cls=null; try{ cls=resoudreMusclesLecture(nom,{name:nom},u); }catch(e){ continue; }
      if(!cls||cls===VOL_CARDIO||(cls.p||[]).indexOf(muscle)<0) continue;
      const d=sess.data[nom];
      if(!d||!Array.isArray(d.sets)) continue;
      for(const s of d.sets){
        if(!s||s.done!==true) continue;
        const w=parseFloat(s.weight);
        const r=_perfReps(s);
        if(!(w>0)||!(r>0)||!e1rmFiable(r,_perfRir(s,u))) continue;
        // LE RIR CORRIGE : c'est une lecture de DECISION. Voir rirCorrige —
        // la perception se mesure, et deux athletes qui declarent « RIR 2 »
        // ne sont pas au meme endroit.
        const v=e1rm(w,r,_perfRir(s,u));
        if(v>0){ somme+=v; n++; }
      }
    }
  }
  return n?somme/n:null;
}
// PURE. 'hausse' | 'stable' | 'baisse' | null. Comparee a la MEME semaine de
// la table : la precedente, et non une moyenne — la regle parle de « la meme
// seance la semaine passee ».
function perfDeltaMuscle(user,muscle,cle){
  const a=_perfMuscleSemaine(user,muscle,cle);
  const b=_perfMuscleSemaine(user,muscle,_semainePrecedente(cle));
  if(a==null||b==null||!(b>0)) return null;
  const d=(a-b)/b;
  if(d>RETOUR_PERF_SEUIL) return 'hausse';
  if(d<-RETOUR_PERF_SEUIL) return 'baisse';
  return 'stable';
}
// PURE. La clef de la semaine precedant celle passee.
function _semainePrecedente(cle){
  const l=_lundiDeSemaine(cle);
  if(!l) return cle;
  const d=new Date(l); d.setDate(d.getDate()-7);
  return semaineISO(d);
}
// L'ECRITURE D'UN RETOUR. La performance est CALCULEE ici, jamais demandee.
// Rend {ok:true} ou {ok:false,raison}.
function enregistrerRetourMuscle(user,muscle,r){
  const u=_dossier(user);
  if(!u) return {ok:false,raison:'Aucun dossier ouvert.'};
  // UN MUSCLE SANS REPERE N'A NI MEV NI MRV A DEPLACER. La garde existe deja
  // pour les signaux — lombaires, abducteurs, adducteurs — et vaut ici pour la
  // meme raison : recolter un retour qu'on ne pourra pas appliquer, c'est
  // poser une question pour rien.
  if(!reperesTable(muscle)) return {ok:false,raison:'Ce muscle n’a pas de repère.'};
  const c=String((r&&r.congestion)||'');
  const k=String((r&&r.courbatures)||'');
  if(RETOUR_CONGESTION.indexOf(c)<0) return {ok:false,raison:'Congestion non renseignée.'};
  // Les courbatures se posent EN DIFFERE : un retour peut donc exister avec la
  // congestion seule, et se completer au retour dans l'app.
  if(k&&RETOUR_COURBATURES.indexOf(k)<0) return {ok:false,raison:'Courbatures non renseignées.'};
  const cle=(r&&r.semaineISO)||semaineISO(new Date());
  if(!u.retourMuscle||typeof u.retourMuscle!=='object') u.retourMuscle={};
  // FIREBASE REND LES TABLEAUX EN OBJETS des qu'une clef manque : on normalise
  // avant toute methode de tableau, sinon .findIndex leve dans une fonction
  // async et l'echec est avale.
  const l=_tabRetours(u.retourMuscle[muscle]);
  const i=l.findIndex(x=>x&&x.semaineISO===cle);
  const perf=(r&&r.perfDelta!==undefined)?r.perfDelta:perfDeltaMuscle(u,muscle,cle);
  const e=Object.assign({},i>=0?l[i]:{},{semaineISO:cle,congestion:c,maj:Date.now()});
  if(k) e.courbatures=k;
  e.perfDelta=perf;
  if(i>=0) l[i]=e; else l.push(e);
  l.sort((x,y)=>String(x.semaineISO).localeCompare(String(y.semaineISO)));
  u.retourMuscle[muscle]=l.slice(-RETOUR_SEMAINES_MAX);
  try{ saveUser(); }catch(e2){}
  return {ok:true,retour:e};
}
// PURE. Normalise ce que Firebase peut avoir rendu en objet.
function _tabRetours(v){
  if(Array.isArray(v)) return v.slice();
  if(v&&typeof v==='object') return Object.keys(v).map(k=>v[k]).filter(Boolean);
  return [];
}
// ══════════ LA REGLE DE DEPLACEMENT ════════════════════════════════════
//
// UNE SEULE REGLE, ET L'IMMOBILITE EST LE CAS NORMAL. Un systeme qui bouge a
// chaque semaine ne mesure plus rien : il suit son propre bruit. Deux
// situations seulement font bouger une borne, et tout le reste ne fait rien.
//
// JAMAIS DEUX BORNES DANS LA MEME SEMAINE POUR LE MEME MUSCLE. Monter le MEV
// et descendre le MRV d'un coup, c'est refermer la fenetre par les deux bouts
// sur une seule semaine d'observation. Les deux conditions s'excluent d'ailleurs
// par construction — on ne peut pas etre a la fois sous son potentiel et
// au-dela de sa recuperation — mais l'ordre des tests le garantit meme si un
// retour incoherent arrivait.
//
// LES BORNES DURES SE MESURENT CONTRE LA TABLE, pas contre le repere courant.
// Sans cela, douze semaines de « +1 » plafonnees a chaque fois sur le resultat
// de la precedente feraient deriver le repere sans fin.
const RETOUR_MEV_MIN_DELTA=-2;     // mevPerso >= mev - 2
const RETOUR_MRV_MAX_DELTA=4;      // mrvPerso <= mrv + 4

// PURE. Que dit la semaine ? 'monter' | 'descendre' | null.
//
// `precedent` sert au SEUL cas qui demande deux semaines : « perf en baisse
// deux semaines de suite ». Une baisse isolee est un mauvais jour, une nuit
// courte, un repas saute — la traiter comme un depassement de recuperation
// ferait retirer du volume a chaque accident.
function _verdictRetour(r,precedent){
  if(!r) return null;
  const c=r.congestion, k=r.courbatures, p=r.perfDelta;
  // ── LE VOLUME EST SOUS LE POTENTIEL ──
  // Congestion forte, recuperation intacte, performance qui ne recule pas :
  // le muscle encaisse plus que ce qu'on lui donne.
  if(c==='forte'
     &&(k==='aucune'||k==='legeres')
     &&(p==='hausse'||p==='stable')) return 'monter';
  // ── LA RECUPERATION EST DEPASSEE ──
  // Des courbatures encore presentes a la seance suivante sont un fait, pas
  // une impression : le muscle n'a pas fini de recuperer qu'on le recharge.
  if(k==='encore') return 'descendre';
  // Deux baisses consecutives. La seconde seule ne suffit pas.
  if(p==='baisse'&&precedent&&precedent.perfDelta==='baisse') return 'descendre';
  return null;
}
// PURE. Depuis combien de semaines ce muscle est-il muet ? Rend 0 quand la
// semaine revolue porte un retour.
function _semainesMuettes(user,muscle,cleRevolue){
  let c=cleRevolue, n=0;
  for(let i=0;i<RETOUR_SEMAINES_MAX;i++){
    if(retourSemaine(user,muscle,c)) return n;
    n++; c=_semainePrecedente(c);
  }
  return n;
}
// PURE. Le repere perso serait-il gele ? Deux semaines sans retour et on ne
// touche plus a rien — NI POUR LE DEPLACER, NI POUR REVENIR A LA TABLE.
// Revenir en silence changerait les seuils de quelqu'un qui n'a rien demande,
// et il le decouvrirait par une jauge qui change de couleur sans raison.
function calibrageMuscleGele(user,muscle,cleRevolue){
  const c=cleRevolue||_semainePrecedente(semaineISO(new Date()));
  return _semainesMuettes(user,muscle,c)>=RETOUR_GEL_SEMAINES;
}
// L'APPLICATION, UNE FOIS PAR SEMAINE REVOLUE ET PAR MUSCLE.
// Rend {bouge:'mev'|'mrv'|null, de, vers, raison}.
function appliquerRetourMuscle(user,muscle,cleRevolue){
  const u=_dossier(user);
  const vide={bouge:null};
  if(!u) return vide;
  // Un muscle sans repere n'a rien a deplacer — meme garde que les signaux.
  const t=reperesTable(muscle);
  if(!t) return vide;
  const cle=cleRevolue||_semainePrecedente(semaineISO(new Date()));
  // DEJA TRAITEE ? On ne rejoue pas une semaine : deux passages
  // deplaceraient la borne de deux series pour une seule observation.
  if(!u.reperesAuto||typeof u.reperesAuto!=='object') u.reperesAuto={};
  const etat=u.reperesAuto[muscle]||{};
  if(etat.derniereSemaine===cle) return vide;
  if(calibrageMuscleGele(u,muscle,cle)) return vide;
  const r=retourSemaine(u,muscle,cle);
  if(!r) return vide;
  const v=_verdictRetour(r,retourSemaine(u,muscle,_semainePrecedente(cle)));
  if(!v) return vide;
  const courant=Object.assign({},t,etat);
  let bouge=null, de=null, vers=null;
  if(v==='monter'){
    // PLAFONNE A mavMin DE LA TABLE : au-dela, ce n'est plus un minimum
    // efficace, c'est le milieu de la zone de travail — le MEV cesserait de
    // vouloir dire quelque chose.
    de=courant.mev;
    vers=Math.min(de+1,t.mavMin);                     // plafond de la regle
    vers=Math.max(t.mev+RETOUR_MEV_MIN_DELTA,vers);   // borne dure basse
    if(vers!==de){ etat.mev=vers; bouge='mev'; }
  } else {
    // PLANCHER A mavMin DE LA TABLE : sous ce seuil, le MRV passerait sous le
    // volume de travail habituel et toute la zone verte deviendrait rouge.
    de=courant.mrv;
    vers=Math.max(de-1,t.mavMin);                     // plancher de la regle
    vers=Math.min(t.mrv+RETOUR_MRV_MAX_DELTA,vers);   // borne dure haute
    if(vers!==de){ etat.mrv=vers; bouge='mrv'; }
  }
  // LA SEMAINE EST MARQUEE MEME QUAND RIEN NE BOUGE : une borne au plafond ne
  // doit pas etre reexaminee indefiniment.
  etat.derniereSemaine=cle;
  etat.maj=Date.now();
  u.reperesAuto[muscle]=etat;
  try{ saveUser(); }catch(e){ rcErreurMuette('appliquerRetourMuscle',e); }
  // Les caches portent des verdicts de zone que ce deplacement change.
  try{ _viderCacheVolume(); _cacheSignaux.clear(); }catch(e){}
  return {bouge:bouge,de:de,vers:vers,raison:v,semaine:cle};
}
// Toutes les semaines revolues non encore traitees, du plus ancien au plus
// recent. Appelee au demarrage : l'athlete qui ouvre l'app le lundi doit
// trouver ses reperes a jour sans avoir rien a faire.
function appliquerRetoursEnAttente(user){
  const u=_dossier(user);
  if(!u||!u.retourMuscle) return [];
  const faits=[];
  for(const m of Object.keys(u.retourMuscle)){
    // On remonte au plus douze semaines : au-dela, la fenetre glissante a
    // deja efface les retours.
    let cle=_semainePrecedente(semaineISO(new Date()));
    const aFaire=[];
    for(let i=0;i<RETOUR_SEMAINES_MAX;i++){ aFaire.unshift(cle); cle=_semainePrecedente(cle); }
    for(const c of aFaire){
      let r=null; try{ r=appliquerRetourMuscle(u,m,c); }catch(e){ r=null; }
      if(r&&r.bouge) faits.push(Object.assign({muscle:m},r));
    }
  }
  return faits;
}
// ══════════ QUAND POSER LA QUESTION ════════════════════════════════════
//
// UNE FOIS PAR SEMAINE ET PAR MUSCLE, SUR LA DERNIERE SEANCE QUI LE TOUCHE.
// Poser les questions a chaque seance est la facon la plus sure de detruire
// la donnee : des la troisieme semaine on repond au hasard pour faire
// disparaitre l'encart, et le bruit devient la mesure.
//
// « LA DERNIERE » NE SE DEVINE PAS, ELLE SE COMPTE. On ne peut pas savoir
// qu'une seance est la derniere de la semaine — sauf en comparant les seances
// DEJA faites sur ce muscle aux seances PREVUES par les creneaux actifs. Quand
// les deux se rejoignent, la semaine de ce muscle est finie.
//
// SANS PROGRAMME, ON DEMANDE A LA PREMIERE. Un athlete sans creneaux actifs
// n'a pas de « derniere seance » calculable ; ne jamais demander serait pire
// que demander tot.

// PURE. Combien de creneaux ACTIFS touchent ce muscle en primaire ?
function _seancesPrevuesMuscle(user,muscle){
  const u=_dossier(user);
  const cfg=(u&&Array.isArray(u.sessions_config))?u.sessions_config:[];
  let n=0;
  for(const s of cfg){
    if(!s||s.active!==true||!Array.isArray(s.exercises)) continue;
    const touche=s.exercises.some(ex=>{
      if(!ex||!ex.name) return false;
      let cls=null; try{ cls=resoudreMusclesLecture(ex.name,ex,u); }catch(e){ return false; }
      return !!(cls&&cls!==VOL_CARDIO&&(cls.p||[]).indexOf(muscle)>=0);
    });
    if(touche) n++;
  }
  return n;
}
// PURE. Combien de seances DEJA faites cette semaine touchent ce muscle ?
function _seancesFaitesMuscle(user,muscle,cle){
  const u=_dossier(user);
  const lundi=_lundiDeSemaine(cle||semaineISO(new Date()));
  if(!lundi||!u||!Array.isArray(u.sessions)) return 0;
  const debut=lundi.getTime(), fin=debut+7*86400000;
  let n=0;
  for(const sess of u.sessions){
    if(!sess||!sess.data) continue;
    if(!(sess.date>=debut&&sess.date<fin)) continue;
    const touche=Object.keys(sess.data).some(nom=>{
      let cls=null; try{ cls=resoudreMusclesLecture(nom,{name:nom},u); }catch(e){ return false; }
      return !!(cls&&cls!==VOL_CARDIO&&(cls.p||[]).indexOf(muscle)>=0);
    });
    if(touche) n++;
  }
  return n;
}
// PURE. Les muscles a interroger apres CETTE seance. Vide la plupart du temps,
// et c'est voulu : l'encart doit etre une surprise rare, pas un peage.
function musclesAInterroger(user,sess){
  const u=_dossier(user);
  const out=[];
  if(!u||!sess||!sess.data) return out;
  const cle=semaineISO(new Date(sess.date||Date.now()));
  const vus={};
  for(const nom of Object.keys(sess.data)){
    let cls=null; try{ cls=resoudreMusclesLecture(nom,{name:nom},u); }catch(e){ continue; }
    if(!cls||cls===VOL_CARDIO) continue;
    for(const m of (cls.p||[])) vus[m]=true;
  }
  for(const m of Object.keys(vus)){
    if(!reperesTable(m)) continue;                       // rien a deplacer
    if(retourSemaine(u,m,cle)) continue;                 // deja repondu cette semaine
    const prevues=_seancesPrevuesMuscle(u,m);
    const faites=_seancesFaitesMuscle(u,m,cle);
    if(prevues>0&&faites<prevues) continue;              // ce n'est pas la derniere
    out.push(m);
  }
  // TROIS MUSCLES AU PLUS, ET LES PLUS TRAVAILLES D'ABORD. Une seance de dos
  // en touche sept ; sept encarts a la suite, c'est le peage qu'on voulait
  // eviter. Les autres reviendront la semaine prochaine.
  let vol={}; try{ vol=volumeSemaine(u,cle)||{}; }catch(e){ vol={}; }
  out.sort((a,b)=>(vol[b]||0)-(vol[a]||0));
  return out.slice(0,3);
}
// PURE. Les retours en attente de leurs courbatures : la congestion a ete
// donnee, la question du lendemain n'a pas encore ete posee.
//
// PAS AVANT LE LENDEMAIN. Demander « as-tu des courbatures ? » dix minutes
// apres la seance n'a pas de sens physiologique, et la reponse serait
// toujours « aucune ».
const RETOUR_COURBATURES_DELAI_MS=20*3600*1000;   // 20 h : le lendemain matin
function retoursEnAttenteCourbatures(user){
  const u=_dossier(user);
  const out=[];
  if(!u||!u.retourMuscle) return out;
  for(const m of Object.keys(u.retourMuscle)){
    for(const r of _tabRetours(u.retourMuscle[m])){
      if(!r||r.courbatures) continue;
      if(!(Date.now()-(Number(r.maj)||0)>RETOUR_COURBATURES_DELAI_MS)) continue;
      out.push({muscle:m,semaineISO:r.semaineISO});
    }
  }
  return out;
}
// ══════════ LES DEUX ENCARTS ═══════════════════════════════════════════
//
// UN CHOIX UNIQUE, TROIS OU QUATRE BOUTONS, AUCUN CHAMP LIBRE. La question
// doit se repondre d'un doigt en sortant de la salle. Un curseur ou un champ
// texte ferait sauter l'encart, et un encart qu'on saute ne mesure rien.
const RETOUR_LIB_CONGESTION=Object.freeze({aucune:'Aucune',correcte:'Correcte',forte:'Forte'});
const RETOUR_LIB_COURBATURES=Object.freeze({aucune:'Aucune',legeres:'Légères',
  marquees:'Marquées',encore:'Encore là à la séance suivante'});

function _htmlChoixRetour(muscle,champ,libs){
  const lib=(MUSCLES[muscle]||{}).lib||muscle;
  return '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px 14px;margin-bottom:10px" data-retour="'+escapeHtml(muscle)+'">'
    +'<div style="font-size:var(--fs-2xs);font-weight:800;letter-spacing:1.5px;color:var(--sub);text-transform:uppercase;margin-bottom:8px">'
    +escapeHtml(lib)+'</div>'
    +'<div style="font-size:var(--fs-sm);color:#ccc;line-height:1.5;margin-bottom:10px">'
    +(champ==='congestion'?'Congestion pendant la séance ?':'Courbatures le lendemain ?')+'</div>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap">'
    +Object.keys(libs).map(v=>'<button type="button" class="btn btn-outline btn-sm" '
      +'style="flex:1 1 auto;min-width:0;padding:10px 8px;font-size:var(--fs-xs)" '
      +'onclick="rcRepondreRetour(this,'+JSON.stringify(muscle).replace(/"/g,'&quot;')+','
      +JSON.stringify(champ).replace(/"/g,'&quot;')+','+JSON.stringify(v).replace(/"/g,'&quot;')+')">'
      +escapeHtml(libs[v])+'</button>').join('')
    +'</div></div>';
}
// LE GESTE. Enregistre, puis retire SA carte — pas tout l'encart : une seance
// peut en poser trois, et les faire disparaitre ensemble ferait perdre les
// deux reponses non encore donnees.
function rcRepondreRetour(btn,muscle,champ,valeur){
  const donnees={};
  donnees[champ]=valeur;
  if(champ==='courbatures'){
    // La congestion existe deja : on ne la redemande pas, on complete.
    const r=retourSemaine(currentUser,muscle,semaineISO(new Date()))
      ||retoursMuscle(currentUser,muscle).slice(-1)[0];
    donnees.congestion=(r&&r.congestion)||'correcte';
    if(r&&r.semaineISO) donnees.semaineISO=r.semaineISO;
  }
  let res=null;
  try{ res=enregistrerRetourMuscle(currentUser,muscle,donnees); }catch(e){ res=null; }
  try{
    const carte=btn&&btn.closest('[data-retour]');
    if(carte) carte.remove();
  }catch(e){}
  try{
    if(res&&res.ok) toast('Noté '+ICO.coche);
    else if(res&&res.raison) toast(res.raison,'var(--orange)');
  }catch(e){}
  // PLUS RIEN A REMPLIR : la zone entiere s'efface plutot que de laisser un
  // titre au-dessus du vide.
  try{
    for(const id of ['wd-retour-zone','clh-retour-zone']){
      const z=document.getElementById(id);
      if(z&&!z.querySelector('[data-retour]')) z.style.display='none';
    }
  }catch(e){}
  return true;
}
// L'ENCART DE FIN DE SEANCE : la congestion, a chaud.
function rcRendreRetourSeance(sess){
  const z=document.getElementById('wd-retour-zone');
  if(!z) return false;
  z.style.display='none'; z.innerHTML='';
  let l=[];
  try{ l=musclesAInterroger(currentUser,sess); }catch(e){ l=[]; }
  if(!l.length) return false;
  z.innerHTML='<div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:8px">Ta semaine sur ces muscles</div>'
    +l.map(m=>_htmlChoixRetour(m,'congestion',RETOUR_LIB_CONGESTION)).join('');
  z.style.display='block';
  return true;
}
// ⚠ L'ENCART DE COURBATURES A QUITTE L'ACCUEIL le 14/09/2026. Kevin : « ça
// pollue ». Il ouvrait l'accueil sur « Depuis ta dernière séance » et une
// question par muscle, avant la séance du jour, le poids et la nutrition —
// trois choses qu'on vient chercher, contre une qu'on n'a pas demandee.
//
// LA FONCTION RESTE ET NE REND PLUS RIEN. Trois appelants la nomment ; les
// retirer un par un, c'est trois occasions d'en oublier un et de laisser une
// zone orpheline. Elle garantit desormais l'inverse de ce qu'elle faisait :
// que #clh-retour-zone soit vide.
//
// Masquer la zone en CSS ne suffisait PAS, et c'est l'erreur du lot precedent :
// z.style.display='block' reecrit la declaration en ligne, priorite comprise,
// et le !important posait donc avec elle. Couper a la source est le seul
// endroit qui tienne.
//
// CE QUE CA NE SUPPRIME PAS : le retour demande en FIN DE SEANCE, au seul
// moment ou la reponse vaut quelque chose. retoursEnAttenteCourbatures reste
// appelee par lui.
function rcRendreRetourAccueil(){
  const z=document.getElementById('clh-retour-zone');
  if(!z) return false;
  z.style.display='none'; z.innerHTML='';
  return false;
  // eslint-disable-next-line no-unreachable
  let l=[];
  try{ l=retoursEnAttenteCourbatures(currentUser); }catch(e){ l=[]; }
  if(!l.length) return false;
  z.innerHTML='<div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:8px">Depuis ta dernière séance</div>'
    +l.slice(0,3).map(x=>_htmlChoixRetour(x.muscle,'courbatures',RETOUR_LIB_COURBATURES)).join('');
  z.style.display='block';
  return true;
}
// PURE. La mention de source, ou ''. « MEV 12 · ajusté sur tes retours » :
// le coach doit distinguer un repere de reference d'un repere mesure, sinon
// il ne sait pas lequel il a le droit de contredire.
function mentionSourceRepere(user,muscle){
  let r=null; try{ r=reperesEffectifs(user,muscle); }catch(e){ return ''; }
  if(!r) return '';
  if(r.source==='perso') return 'ajusté sur tes retours';
  if(r.source==='coach') return 'fixé par ton coach';
  return '';
}
// LE JOURNAL, COTE COACH. Sans lui, l'allegement serait un secret entre
// l'athlete et l'application : le coach verrait une serie de moins dans
// l'historique sans savoir qu'elle a ete retiree, ni pourquoi. Un allegement
// silencieux dont le coach ignore l'existence est pire que pas d'allegement.
const DISPO_LIB_CAUSE=Object.freeze({sommeil:'sommeil court',douleur:'douleurs déclarées',
  rir:'effort au-delà de la consigne',charge:'charge en hausse'});
function _htmlJournalSeance(c){
  const u=_dossier(c);
  const l=Array.isArray(u&&u.journalSeance)?u.journalSeance.slice().reverse():[];
  if(!l.length) return '';
  const dat=t=>t?new Date(t).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}):'';
  const ligne=e=>{
    const cause=DISPO_LIB_CAUSE[e&&e.cause]||'';
    const quoi=(e&&e.origine==='dispo_decharge')
      ? 'Semaine allégée'
      : ('Dernière série retirée'+(e&&e.exercice?' : '+escapeHtml(e.exercice):''));
    return '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px">'
      +'<span style="font-size:var(--fs-xs);color:var(--text);min-width:0">'+quoi+'</span>'
      +'<span style="font-size:var(--fs-2xs);color:var(--sub);white-space:nowrap;flex-shrink:0">'
      +(cause?escapeHtml(cause)+' · ':'')+dat(e&&e.date)+'</span></div>';
  };
  return '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:16px">'
    +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:10px">'
    +'<span style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase">Allègements</span>'
    +'<span style="font-size:var(--fs-2xs);color:var(--text-faint)">décidés par l’athlète</span></div>'
    +l.slice(0,6).map(ligne).join('')
    +'<div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:8px;line-height:1.5">'
    +'Proposés par l’application quand le sommeil, la douleur, l’effort ou la charge sortent de l’ordinaire. Jamais imposés.</div></div>';
}
// LA MAIN DU COACH, RENDUE. Le bouton n'existe QUE s'il y a quelque chose a
// annuler : proposer « revenir aux reperes de reference » a un athlete dont
// aucun repere n'a bouge donnerait a croire qu'il y a eu un ajustement.
function _htmlBoutonReperes(c){
  const u=_dossier(c);
  const l=(u&&u.reperesAuto&&typeof u.reperesAuto==='object')
    ? Object.keys(u.reperesAuto).filter(m=>{
        const e=u.reperesAuto[m];
        return e&&(typeof e.mev==='number'||typeof e.mrv==='number');
      })
    : [];
  if(!l.length) return '';
  const noms=l.map(m=>(MUSCLES[m]||{}).lib||m).join(', ');
  return '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">'
    +'<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-bottom:6px">'
    +'Repères ajustés sur ses retours : '+escapeHtml(noms)+'.</div>'
    +'<button class="btn btn-outline btn-sm" style="width:100%" '
    +'onclick="rcReinitReperes()">Revenir aux repères de référence</button></div>';
}
// LE GESTE. Confirme avant d'agir : les seuils de l'athlete changent, et sa
// jauge changera de couleur sans qu'il ait rien fait.
async function rcReinitReperes(muscle){
  const c=(typeof currentClientId!=='undefined'&&currentClientId)?getOwnedClient(currentClientId):null;
  if(!c){ try{ toast('Aucun athlète ouvert.','var(--orange)'); }catch(e){} return false; }
  const quoi=muscle?((MUSCLES[muscle]||{}).lib||muscle):'tous les muscles';
  let ok=false;
  try{ ok=await rcConfirm('Revenir aux repères de référence pour '+quoi+' ? Les retours de l’athlète sont conservés, seuls les repères déplacés sont annulés.'); }
  catch(e){ ok=false; }
  if(!ok) return false;
  let r=null;
  try{ r=reinitialiserReperesMuscle(c,muscle); }catch(e){ r=null; }
  if(!r||!r.n){ try{ toast('Aucun repère à annuler.','var(--orange)'); }catch(e){} return false; }
  try{ renderVolumeCoach(c); }catch(e){}
  // LE « ✓ » ATTEND LES DEUX DESTINATIONS. Un try/catch synchrone autour de
  // la poussee annoncerait le succes avant que le reseau ait repondu : le
  // coach lirait « ramené ✓ » et l'athlete garderait ses seuils deplaces.
  // toastSync est le chemin deja emprunte par toutes les ecritures coach.
  const _envoi=CLOUD.pushOne(c.email,c);
  toastSync(true,_envoi,r.n+' repère'+(r.n>1?'s ramenés':' ramené')+' à la référence '+ICO.coche,
    'le retour aux repères de référence est');
  return true;
}
// LA MAIN DU COACH. Supprime le repere ajuste d'un muscle, ou de tous.
// Le retour brut, lui, N'EST PAS EFFACE : c'est une observation de l'athlete,
// pas une decision de l'application, et l'effacer empecherait de comprendre
// pourquoi le repere avait bouge.
function reinitialiserReperesMuscle(user,muscle){
  const u=_dossier(user);
  if(!u||!u.reperesAuto) return {ok:true,n:0};
  const cibles=muscle?[muscle]:Object.keys(u.reperesAuto);
  let n=0;
  for(const m of cibles) if(u.reperesAuto[m]){ delete u.reperesAuto[m]; n++; }
  if(!n) return {ok:true,n:0};
  try{ saveUser(); }catch(e){ rcErreurMuette('reinitialiserReperesMuscle',e); }
  try{ _viderCacheVolume(); _cacheSignaux.clear(); }catch(e){}
  // JOURNALISE COMME LES AJUSTEMENTS NUTRITION. Un repere qui revient a la
  // reference change des seuils : l'athlete doit pouvoir savoir quand, et le
  // coach doit pouvoir dire pourquoi.
  try{ _pauseJournaliser(u,'reperes_reinit',{muscle:muscle||'tous',n:n}); }catch(e){}
  return {ok:true,n:n};
}

// PURE. Le repere de REFERENCE, sans aucun etage. Sert a borner les
// deplacements automatiques : la regle se mesure contre la table, jamais
// contre le repere deja deplace — sinon chaque semaine partirait du resultat
// de la precedente et la derive n'aurait plus de fond.
function reperesTable(muscle){
  const d=REPERES_VOLUME[muscle];
  return d?Object.assign({},d):null;
}
// En déficit énergétique la capacité de récupération diminue : le volume qui
// faisait progresser à l'entretien devient du volume qu'on ne récupère plus.
// La zone de progrès descend donc d'un cran, sur [MEV, MAVmin[, et la bande
// qui était verte se lit comme un volume élevé. Le maintien disparaît en tant
// que zone : en déficit, le volume d'entretien EST l'objectif.
// Le maintien déclaré suit la même règle — on entretient, on ne construit pas.
function zoneVolume(n,rep,user){
  if(!rep) return null;
  const t=typePhase(user);
  const economie=(t==='seche'||t==='maintien');
  if(n<rep.mev) return VOL_ZONES[0];
  if(n<rep.mavMin) return economie?VOL_ZONES[2]:VOL_ZONES[1];
  if(n<=rep.mavMax) return economie?VOL_ZONES[3]:VOL_ZONES[2];
  if(n<=rep.mrv) return economie?VOL_ZONES[4]:VOL_ZONES[3];
  return VOL_ZONES[4];
}
// Arrondi à 0,5 près, à L'AFFICHAGE seulement : le calcul garde sa précision.
function volAffiche(n){
  const v=Math.round(n*2)/2;
  return Number.isInteger(v)?String(v):String(v).replace('.',',');
}

// ======= BILAN MULTI-STEP =======
let bilStep=0,bilType='coaching',bilData={},_bilPhotoLoading=0;
// L'ATTENTE DES PHOTOS EST BORNÉE. Elle ne l'était pas : un compteur qui ne
// redescendait jamais faisait tourner bilNext indéfiniment, et le bilan ne
// pouvait plus être validé. Dix secondes à 800 ms font treize passages ;
// au quatorzième on enregistre sans la photo plutôt que de retenir en otage
// tout ce que la personne vient de saisir.
const BIL_PHOTO_ESSAIS_MAX=13;   // 13 × 800 ms ≈ 10,4 s
let _bilPhotoEssais=0;

// ── Brouillon de bilan ──────────────────────────────────────────────────────
// Le questionnaire de départ compte une quinzaine d'étapes. Fermer l'onglet en
// cours de route effaçait toute la saisie : bilData ne vivait qu'en mémoire.
const BIL_DRAFT_KEY='rc_bil_draft';
// PURE. A qui appartient ce brouillon ? Rend 'moi', 'autre' ou 'incertain'.
//
// Une seule clé pour tout l’appareil, un contenu qui n’appartient qu’à une
// personne : sans cette question, la reprise de bilan traversait les comptes.
//
// POURQUOI CE N'EST PLUS BINAIRE. La règle d'origine refusait tout brouillon
// SANS adresse, avec ce raisonnement : « il date d'avant ce champ, on refuse
// plutôt que de deviner ». Le raisonnement était juste à l'époque, il ne l'est
// plus — parce que _bilEcrireDraft écrit `email:(currentUser&&currentUser.email)
// ||''`. Un brouillon écrit AUJOURD'HUI, alors que le compte n'est pas encore
// identifié, porte donc une adresse VIDE. « Sans adresse » ne veut plus dire
// « ancien » : ça veut dire « on ne sait pas ».
//
// ET NE PAS SAVOIR N'EST PAS SAVOIR QUE C'EST QUELQU'UN D'AUTRE. Le refus
// entraînait toute la chaîne : jamais proposé en reprise, jamais compté comme
// « bilan en cours », donc jamais annoncé avant d'être écrasé. L'athlète
// perdait ses réponses sans un mot.
//
// TROIS ETATS, PARCE QU'IL Y A TROIS SITUATIONS. Les confondre est précisément
// ce qui a produit la perte : « incertain » traité comme « autre ».
function _bilDraftProprio(d){
  const moi=(currentUser&&currentUser.email)||null;
  if(!d) return 'autre';
  const sien=d.email?String(d.email):'';
  if(!sien) return 'incertain';
  if(!moi) return 'incertain';
  return sien===String(moi)?'moi':'autre';
}
// PURE. Le brouillon est-il SUREMENT celui du compte courant ?
//
// Un brouillon sans adresse l'est quand UN SEUL COMPTE existe sur l'appareil :
// il n'y a personne d'autre a qui il puisse appartenir, et le refuser revient a
// jeter le travail du seul utilisateur present. Des qu'il y en a plusieurs, on
// ne devine pas — on DEMANDE, ailleurs, plutot que d'ecarter en silence.
function _bilDraftAMoi(d){
  const p=_bilDraftProprio(d);
  if(p==='moi') return true;
  if(p==='autre') return false;
  return _bilUnSeulCompte();
}
// Un seul compte connu de l'appareil ? Le registre du multi-compte fait foi.
// VIDE COMPTE POUR UN : le registre n'est ecrit qu'a partir du second compte
// sur certains chemins, et un appareil sans registre n'a jamais eu qu'un
// utilisateur.
function _bilUnSeulCompte(){
  try{ return comptesConnectes().length<=1; }catch(e){ return true; }
}
const BIL_DRAFT_TTL=7*24*3600*1000;
let _bilDraftTimer=null,_bilDraftAvertiPlein=false;
// Les photos ne vont PAS dans le brouillon. compressImage les ramène déjà à
// plusieurs centaines de Ko et elles sont écrites dès la compression dans
// rc_pendingphoto_* : les dupliquer ferait déborder le quota sur la saisie même
// qu'on cherche à sauver.
// SANS LES PHOTOS — elles vivent dans leurs propres clés — ET SANS LES
// REPRISES. Une mensuration pré-remplie n'est pas une réponse : recopiée dans
// le brouillon, elle faisait qu’ouvrir un bilan coaching puis en sortir
// laissait treize « réponses » jamais saisies, avec la carte « Bilan
// commencé » sur l’accueil et une question de reprise mensongère.
//
// bMesureSaisie retire la clef du Set dès que l’athlète y touche : ce qu’il
// corrige entre donc dans le brouillon au caractère près, comme avant.
function _bilDataSansPhotos(){
  const o={};
  for(const k of Object.keys(bilData)){
    if(k.includes('photo')) continue;
    if(_bilReprises&&_bilReprises.has(k)) continue;
    o[k]=bilData[k];
  }
  return o;
}
// SEPAREE DU MINUTEUR pour pouvoir etre appelee TOUT DE SUITE. En quittant
// l’écran, les dernières frappes sont encore dans le débounce : les perdre
// ferait reprendre le bilan quelques caractères en arrière. Le corps est
// INCHANGE, y compris son try/catch et l’alerte unique de quota.
function _bilEcrireDraft(){
    // EN MODIFICATION D'UN BILAN DÉJÀ ENVOYÉ, AUCUN BROUILLON : la clef est
    // unique, et l'écrire ici écraserait le bilan en cours de saisie, ou ferait
    // proposer « reprendre mon bilan » sur les réponses d'un bilan ancien.
    if(_bilEdition) return;
    try{
      // L ADRESSE DE CELUI QUI ÉCRIT. La clé est commune à l’appareil, le
      // contenu ne l’est pas : poids, mensurations, cycle et sommeil sont ceux
      // d’une seule personne.
      localStorage.setItem(BIL_DRAFT_KEY,JSON.stringify({
        bilType,bilStep,bilData:_bilDataSansPhotos(),ts:Date.now(),
        email:(currentUser&&currentUser.email)||''
      }));
    }catch(e){
      // Une seule alerte par session : la sauvegarde se déclenche à chaque
      // frappe, un toast par caractère serait pire que le problème signalé.
      if(!_bilDraftAvertiPlein){
        _bilDraftAvertiPlein=true;
        toast('Stockage plein : ton bilan ne sera pas récupérable si tu quittes l\'app.','var(--orange)');
      }
    }
}
// `_bilDraftTimer` est REMIS A NULL quand il part : sans quoi rien ne
// distingue un minuteur en attente d’un minuteur déjà consommé, et la sortie
// d’écran réécrirait un brouillon que personne n’attend.
function _bilSaveDraft(){
  clearTimeout(_bilDraftTimer);
  _bilDraftTimer=setTimeout(()=>{ _bilDraftTimer=null; _bilEcrireDraft(); },400);
}
function _bilClearDraft(){
  clearTimeout(_bilDraftTimer);
  _bilDraftTimer=null;
  try{localStorage.removeItem(BIL_DRAFT_KEY);}catch(e){}
}
// ── Quitter l’écran de bilan ────────────────────────────────────────────────
//
// `bilData` N’APPARTIENT QU’AU COMPTE QUI L’A COMMENCÉ, et peutBasculer s’en
// sert pour interdire la bascule. Il n’était vidé que par _comptesRemiseAZero
// et openBilan : un bilan VALIDÉ le laissait plein, et « Termine ou quitte
// ton bilan » s’affichait pour toujours sur un bilan précisément terminé.
//
// UNE SEULE FONCTION POUR LES QUATRE SORTIES — validation, bouton retour,
// retour matériel, « plus tard ». C’est le patron de _quitterEcranSeance,
// écrit pour la même raison : une sortie oubliée est une sortie qui ment.
//
// LE BROUILLON N’EST PAS TOUCHÉ ICI, et c’est tout le point : `garder` vrai
// l’ÉCRIT (le débounce n’a pas encore tiré), `garder` faux le laisse tel que
// l’appelant vient de le faire — saveBilanFinal et skipFirstBilan ont déjà
// appelé _bilClearDraft, le réécrire ressusciterait ce qu’ils effacent.
let _bilGen=0;
function _quitterEcranBilan(garder){
  clearTimeout(_bilDraftTimer);
  if(garder===true&&_bilDraftTimer!=null){ try{ _bilEcrireDraft(); }catch(e){} }
  _bilDraftTimer=null;
  // LES RAPPELS EN VOL SONT DESAVOUES. La compression d’une photo écrit dans
  // `bilData` bien après qu’on a quitté : sans ce compteur, prendre une photo
  // puis sortir aussitôt reremplissait `bilData` et reverrouillait la bascule.
  _bilGen++;
  bilData={}; bilStep=0;
  _bilEdition=null;
}
// Retourne le brouillon s'il est exploitable, null sinon. Ne supprime rien :
// c'est à l'appelant de décider, selon qu'il consulte ou qu'il repart à zéro.
//
// ET SEULEMENT S’IL EST À SOI. La clé est commune à l’appareil ; le contenu
// appartient à une personne. Sans ce filtre, l’accueil proposait « Reprendre
// mon bilan » sur les mensurations de quelqu’un d’autre.
//
// UN BROUILLON SANS ADRESSE — écrit avant ce correctif — est REFUSÉ. On ne
// sait pas à qui il appartient : le proposer serait deviner, et faire
// ressaisir ses propres mesures est moins grave que d’en montrer d’autres.
function _bilLoadDraft(type){
  try{
    const d=JSON.parse(localStorage.getItem(BIL_DRAFT_KEY)||'null');
    if(!d||!d.bilData||typeof d.bilStep!=='number') return null;
    if(!_bilDraftAMoi(d)) return null;
    if(type&&d.bilType!==type) return null;
    if(!d.ts||Date.now()-d.ts>BIL_DRAFT_TTL) return null;
    return d;
  }catch{return null;}
}
// PURE. Ce qui est vraiment renseigné dans un jeu de réponses : un tableau
// vide ne compte pas, '' et null non plus.
//
// EXTRAITE pour que le brouillon et la validation finale comptent la même
// chose avec le MÊME code. Deux copies de la même règle finissent par
// diverger — ce fichier en a déjà fait les frais ailleurs.
function _bilCompterReponses(o){
  return Object.values(o||{})
    .filter(v=>Array.isArray(v)?v.length:(v!==''&&v!=null)).length;
}
// Nombre de réponses réellement saisies : ouvrir puis refermer un bilan sans
// rien remplir ne doit pas déclencher de proposition de reprise.
function _bilDraftRempli(d){
  if(!d) return 0;
  return _bilCompterReponses(d.bilData);
}
// PURE. Le poids du bilan, quelle que soit la clef qui le porte — même
// couple que getBW. Se fier au seul bilType laisserait passer le cas où
// l'autre clef porte la valeur.
function _bilPoidsSaisi(d){
  const a=(d||{})['bil-weight'], b=(d||{})['deb-weight'];
  return !((a===''||a==null)&&(b===''||b==null));
}
function _bilPhotoPrefixe(type){return (type==='depart'?'deb':'bil')+'-photo-';}
// Les clefs pré-remplies depuis le dernier bilan. `null` tant que rien ne
// l'est — un questionnaire de départ, ou un brouillon repris.
let _bilReprises=null;
// AU-DELÀ, ON NE REPREND PLUS RIEN. Une mesure vieille de plus de deux mois
// n'est plus une valeur à corriger : c'est une valeur à reprendre depuis le
// début, et la proposer pré-remplie invite à la valider telle quelle.
const BIL_REPRISE_MAX_JOURS=60;
// PURE. `data` privé des clefs encore présentes dans `reprises` — celles que
// l'athlète n'a PAS touchées.
//
// Le compte des réponses et la présence du poids doivent porter là-dessus :
// sinon un bilan où rien n'a été saisi compte douze réponses, et le garde-fou
// « ton bilan est vide » ne se déclenche plus jamais sur un bilan coaching.
function _bilSansReprises(data,reprises){
  const out=Object.assign({},data||{});
  if(reprises&&reprises.size) for(const k of reprises) delete out[k];
  return out;
}
// ══ BUILD 1880 : LE POIDS DU BILAN VIENT DES PESÉES ═════════════════════════
// L'athlète se pèse souvent chaque jour : reprendre le poids du DERNIER BILAN
// (et le retirer à l'envoi) faisait demander « Valider sans ton poids ? ».
// Une moyenne de la semaine est une mesure réelle, pas une reprise.
const BIL_PESEES_JOURS=7, BIL_PESEES_MIN=3, BIL_PESEE_RECENTE_J=3, BIL_PESEE_ECART_MEDIANE=3;
/** PURE. {kg, source:'pesees', n} ou null. */
function poidsPourBilan(u,maintenant){
  if(!u||u.masquerPoids) return null;
  try{ if(aTCA(u)) return null; }catch(e){}
  const t=Number(maintenant)||Date.now();
  const jour=d=>localISODate(new Date(d));
  const debut=jour(t-(BIL_PESEES_JOURS-1)*864e5), auj=jour(t);
  const l=((u.weightLog)||[]).filter(e=>e&&e.date&&!e.agrege&&!e.horsCalcul&&e.date>=debut&&e.date<=auj)
    .map(e=>({date:e.date,kg:parseFloat(e.kg)})).filter(e=>e.kg>=PESEE_MIN&&e.kg<=PESEE_MAX);
  if(l.length){
    const tri=l.map(e=>e.kg).sort((a,b)=>a-b);
    const med=tri.length%2?tri[(tri.length-1)/2]:(tri[tri.length/2-1]+tri[tri.length/2])/2;
    const ok=l.filter(e=>Math.abs(e.kg-med)<=BIL_PESEE_ECART_MEDIANE);
    if(ok.length>=BIL_PESEES_MIN)
      return {kg:Math.round(ok.reduce((s,e)=>s+e.kg,0)/ok.length*10)/10,source:'pesees',n:ok.length};
  }
  const lim=jour(t-(BIL_PESEE_RECENTE_J-1)*864e5);
  const der=((u.weightLog)||[]).filter(e=>e&&e.date&&!e.agrege&&!e.horsCalcul&&e.date>=lim&&e.date<=auj).sort((a,b)=>a.date<b.date?-1:1).pop();
  const v=der?parseFloat(der.kg):NaN;
  return (v>=PESEE_MIN&&v<=PESEE_MAX)?{kg:Math.round(v*10)/10,source:'pesees',n:1}:null;
}
let _bilPoidsPesees=null;   // {kg,n} : le poids pré-rempli depuis les pesées
function _htmlPoidsPesees(){
  const p=_bilPoidsPesees;
  if(!p||String(bilData['bil-weight']||'')!==String(p.kg)) return '';
  return '<div class="rc-micro" id="bil-poids-pesees" style="font-size:var(--fs-2xs);color:var(--sub);margin:2px 0 6px">'
    +(p.n>1?'Moyenne de tes '+p.n+' pesées de la semaine.':'Ta dernière pesée.')+' Corrige si besoin.</div>';
}
// PURE. Les mensurations du dernier bilan QUI LES PORTE, clef par clef.
//
// Chaque mesure est cherchée séparément : un bilan où seul le poids a été
// noté ne doit pas masquer la cuisse relevée deux bilans plus tôt. getBM lit
// déjà les trois préfixes possibles — bil-, deb-, et la clef nue.
function mensurationsReprises(u){
  const l=(((u&&u.bilans)||[]).filter(b=>b&&b.date)).slice().sort((a,b)=>a.date-b.date);
  const out={};
  // LA BORNE EST PAR CLEF, et non sur le dernier bilan tout court : chaque
  // mesure est cherchée séparément, et un poids noté il y a huit jours reste
  // repris quand la cuisse, elle, date de six mois. Une borne globale
  // écarterait le récent avec l’ancien, ou garderait l’ancien avec le récent.
  const _limite=Date.now()-BIL_REPRISE_MAX_JOURS*24*3600*1000;
  const _frais=b=>Number(b&&b.date)>=_limite;
  for(const m of MEAS){
    let val=null,releve=null;
    for(let i=l.length-1;i>=0;i--){
      const v=getBM(l[i],m.k);
      if(v==null) continue;
      if(val===null) val=v;
      // LE DERNIER RELEVÉ, et non le dernier report : sans quoi un report
      // rafraîchirait le report suivant, et la borne des deux mois ne
      // tomberait jamais.
      if(!bmReportee(l[i],m.k)){ releve=l[i]; break; }
    }
    if(val!==null&&releve&&_frais(releve)) out['bil-'+m.k]=String(val);
  }
  for(let i=l.length-1;i>=0;i--){
    const w=getBW(l[i]);
    if(w!=null){ if(_frais(l[i])) out['bil-weight']=String(w); break; }
  }
  return out;
}
// Toucher une case la rend à son auteur : le pointillé tombe, sinon il
// désignerait une saisie fraîche comme une valeur reprise.
// BUILD 1864 : LES BORNES D'UNE MESURE DU BILAN. Poids PESEE_MIN..MAX, taille
// 100..250, longueurs selon MORPHO_MESURES, mensurations 10..250 cm.
function bornesMesureBilan(id){
  const k=String(id||'');
  if(/-weight$/.test(k)) return {min:PESEE_MIN,max:PESEE_MAX,unite:'kg'};
  if(/-height$/.test(k)) return {min:100,max:250,unite:'cm'};
  try{ const m=MORPHO_MESURES.find(x=>x.cle===k); if(m) return {min:m.min||10,max:m.max||250,unite:'cm'}; }catch(e){}
  return {min:10,max:250,unite:'cm'};
}
// PURE. Le mot d'aide d'une saisie hors bornes, ou ''.
function aideMesureBilan(id,brut){
  const v=lireDecimal(brut);
  if(v==null) return String(brut||'').trim()?'« '+String(brut).trim()+' » ? Un nombre, avec une virgule si besoin.':'';
  const b=bornesMesureBilan(id);
  if(v>=b.min&&v<=b.max) return '';
  const vt=String(v).replace('.',',');
  if(b.unite==='kg') return vt+' kg ? Vérifie la virgule.';
  if(/-height$/.test(id)&&v>=PESEE_MIN&&v<100) return vt+' cm ? C’est peut-être ton poids : ta taille va de 100 à 250 cm.';
  if(v>b.max&&v/10>=b.min&&v/10<=b.max) return vt+' cm ? En centimètres, ce serait '+String(v/10).replace('.',',')+'.';
  return vt+' '+b.unite+' ? Vérifie la virgule.';
}
function _bilMontrerAide(id,msg){
  try{
    const bx=document.getElementById('bx-'+id), ch=document.getElementById(id);
    const cadre=bx||ch;
    if(cadre){ cadre.style.borderColor=msg?'var(--orange)':''; if(!bx&&ch) ch.style.borderColor=msg?'var(--orange)':''; }
    let z=document.getElementById('bil-aide-mesures');
    const zone=document.querySelector('#bil-content .pad');
    if(!z&&zone){ z=document.createElement('div'); z.id='bil-aide-mesures'; z.setAttribute('role','status');
      z.style.cssText='font-size:var(--fs-xs);color:var(--orange);line-height:1.5;margin-top:8px'; zone.appendChild(z); }
    if(!z) return;
    const l=Object.assign({},z._aides||{});
    if(msg) l[id]=msg; else delete l[id];
    z._aides=l;
    z.textContent=Object.values(l).join(' ');
  }catch(e){}
}
function bMesureSaisie(id,v){
  const _avantVide=!String(bilData[id]||'').trim();
  // BUILD 1880 : corrigé à la main, le poids n'est plus « des pesées ».
  if(id==='bil-weight'&&_bilPoidsPesees){ const _n0=lireDecimal(v); if(_n0==null||_n0!==_bilPoidsPesees.kg){ _bilPoidsPesees=null; try{ const z=document.getElementById('bil-poids-pesees'); if(z) z.remove(); }catch(e){} } }
  // La valeur est rangée NORMALISÉE (point décimal) : « 62,0 » devient « 62 ».
  // Une saisie illisible est gardée telle quelle — l'aide le dit, rien ne se perd.
  const _n=lireDecimal(v);
  bilData[id]=_n!=null?String(_n):v;
  _bilMontrerAide(id,aideMesureBilan(id,v));
  // LE POINT S'ALLUME quand la case passe de vide a renseignee. 200 ms : c'est
  // un geste repete douze fois, il doit etre presque subliminal et ne jamais
  // retarder la frappe suivante.
  if(_avantVide&&String(v||'').trim()&&!arcReduit()){
    const d=document.getElementById('dot-'+id);
    if(d&&d.animate) _animer(d,
      [{transform:'scale(1)'},{transform:'scale(1.9)',offset:.4},{transform:'scale(1)'}],
      {duration:200,easing:ARC.discharge,fill:'none'});
    // LA DOUZIEME CASE. Une seule fois : le drapeau est remis a zero a l'entree
    // dans l'etape, par bBodySchema.
    try{
      if(!_bschComplet){
        const dots=document.querySelectorAll('.bsch svg circle[id^="dot-"]');
        const total=dots.length;
        let n=0;
        dots.forEach(c=>{ const k=c.id.slice(4); if(String(bilData[k]||'').trim()) n++; });
        if(total&&n>=total){
          _bschComplet=true;
          arcTraversee(document.querySelector('.bsch'),{duree:ARC.release});
        }
      }
    }catch(e){}
  }
  if(_bilReprises&&_bilReprises.has(id)){
    _bilReprises.delete(id);
    // DEUX FORMES DE CASE, ET UNE SEULE PORTE LA BORDURE.
    //
    // Les champs de bQ portent la leur : c’est sur eux qu’il faut repasser en
    // trait plein. Ceux du schéma corporel sont déclarés `border:none`, et le
    // pointillé vit sur le conteneur `bx-<id>` — y poser un STYLE de bordure
    // réveille la largeur par défaut, `medium`, soit TROIS pixels à la couleur
    // du texte. Un cadre blanc apparaissait autour de la case à la première
    // frappe, sur le geste même qui devait discrètement enlever le pointillé.
    //
    // LA STRUCTURE DÉCIDE, pas l’apparence : un conteneur `bx-` existe si et
    // seulement si c’est lui qui porte la bordure. Pas de getComputedStyle,
    // qui forcerait un calcul de style à chaque caractère saisi.
    const bx=document.getElementById('bx-'+id);
    if(bx) bx.style.borderStyle='solid';
    else{
      const ch=document.getElementById(id);
      if(ch&&ch.style) ch.style.borderStyle='solid';
    }
  }
}
function _bilEstReprise(id){ return !!(_bilReprises&&_bilReprises.has(id)); }
// La ligne sous le titre de l'étape. Elle ne s'affiche que s'il reste
// quelque chose à vérifier.
function _htmlNoteReprises(){
  if(!_bilReprises||!_bilReprises.size) return '';
  return `<div style="display:flex;gap:8px;align-items:flex-start;background:var(--surface-1);border:1px dashed color-mix(in srgb,var(--red) 45%,transparent);border-radius:var(--r-2);padding:10px 12px;margin-bottom:10px">
    <span style="flex:none;font-size:var(--fs-sm);line-height:1.3">↺</span>
    <span style="font-size:var(--fs-xs);color:var(--sub);line-height:1.55">Les cases en pointillé portent les valeurs de ton dernier bilan : corrige ce qui a changé.</span>
  </div>`;
}
// PURE. Le nom EXACT des deux boutons de l'écran de choix. Une question qui
// nommerait le bilan autrement que le bouton qu'on vient de toucher ferait
// hésiter au pire moment.
function _bilNomType(t){ return t==='depart'?'bilan de départ':'bilan coaching'; }
// Les photos survivent dans leurs propres clés. On ne récupère que celles du
// type en cours : un bilan de départ abandonné laisserait sinon ses photos
// s'inviter dans un bilan de suivi.
function _bilRestaurerPhotos(type){
  const prefixe='rc_pendingphoto_'+_bilPhotoPrefixe(type);
  let n=0;
  try{
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(!k||!k.startsWith(prefixe)) continue;
      const v=localStorage.getItem(k);
      if(v){bilData[k.slice('rc_pendingphoto_'.length)]=v;n++;}
    }
  }catch(e){}
  return n;
}
function _bilPurgerPhotos(type){
  const prefixe='rc_pendingphoto_'+_bilPhotoPrefixe(type);
  try{
    Object.keys(localStorage).filter(k=>k.startsWith(prefixe))
      .forEach(k=>localStorage.removeItem(k));
  }catch(e){}
}
// Branché une seule fois sur le conteneur, qui survit aux rendus d'étape.
// Délégation plutôt qu'un appel ajouté dans chaque oninput : les champs sont
// produits par sept helpers distincts (bQ, bT, bTA, bC, bEmo, bSlider, le
// schéma corporel) et un oubli serait silencieux.
function _bilBrancherAutoSave(){
  const zone=document.getElementById('bil-content');
  if(!zone||zone._draftBranche) return;
  zone._draftBranche=true;
  zone.addEventListener('input',_bilSaveDraft);
  zone.addEventListener('change',_bilSaveDraft);
}

function skipFirstBilan(){
  currentUser._firstBilanPending=true;
  _bilClearDraft();_bilPurgerPhotos('depart');
  // `false` : le brouillon vient d’être effacé volontairement, le réécrire
  // ferait reproposer une reprise de ce qu’on abandonne.
  _quitterEcranBilan(false);
  saveUser();
  go('s-client-home');
  loadClientHome();
}
// R34 — L'ECRAN « QUEL BILAN ? » A CHAQUE FOIS, comme avant R19 (Kevin,
// 17/09/2026). L'aiguillage de R19, qui ouvrait directement le bilan, est
// retire : l'ecran porte le bilan de depart tant qu'il n'est pas fait, le
// bilan coaching, sa frequence et le compte a rebours. Un brouillon en cours
// reste propose en reprise : openBilan le fait pour le type touche.
function openBilanChoice(){
  const hasDepart=currentUser.bilans?.some(b=>b.type==='depart');
  document.getElementById('bilan-choice-first').style.display=hasDepart?'none':'block';
  go('s-bilan-choice');
  _renderBilanChoiceUI();
}
function setBilanFreq(weeks){
  // Une cadence fixée par le coach prime : les boutons sont d'ailleurs cachés.
  if(bilanCadenceValide(currentUser&&currentUser.bilanCadence)){ _renderBilanChoiceUI(); return false; }
  currentUser._bilanFreq=weeks;
  saveUser();
  _renderBilanChoiceUI();
}
function _renderBilanChoiceUI(){
  const freq=currentUser._bilanFreq||2;
  const fd=document.getElementById('bilan-freq-display');
  // LA PHRASE ENTIERE, et non le seul nombre. « Bilan toutes les » vivait dans
  // le gabarit et imposait un pluriel : en hebdomadaire, la carte annonçait
  // « Bilan toutes les semaine ». Les deux formulations peuvent maintenant ne
  // pas se ressembler, ce qui est justement ce que le français demande.
  if(fd) fd.textContent=freq===1?'Bilan chaque semaine :':'Bilan toutes les 2 semaines :';
  // LA CADENCE DU COACH : ses mots à la place des boutons, qui disparaissent.
  const _cad=bilanCadenceValide(currentUser.bilanCadence);
  const _grp=(document.getElementById('bilan-freq-btn-1')||{}).parentElement||null;
  let _note=document.getElementById('bilan-freq-coach');
  if(_cad){
    if(fd) fd.textContent=_cad.freq===1?'Bilan chaque semaine :':'Bilan toutes les '+_cad.freq+' semaines :';
    if(_grp) _grp.style.display='none';
    if(!_note&&_grp){ _note=document.createElement('div'); _note.id='bilan-freq-coach'; _note.className='bcad-note'; _grp.insertAdjacentElement('afterend',_note); }
    if(_note){ _note.style.display=''; _note.textContent=texteCadenceCoach(_cad); }
  } else {
    if(_grp) _grp.style.display='flex';
    if(_note) _note.style.display='none';
  }
  [1,2].forEach(v=>{
    const btn=document.getElementById('bilan-freq-btn-'+v);
    if(!btn) return;
    const active=freq===v;
    btn.style.background=active?'var(--red)':'transparent';
    btn.style.color=active?'var(--text)':'var(--sub)';
    btn.style.border=active?'1px solid var(--red)':'1px solid var(--border)';
  });
  _majBoutonHistoriqueBilans();
  _updateBilanCountdown();
  if(window._bilanCdInterval) clearInterval(window._bilanCdInterval);
  window._bilanCdInterval=setInterval(()=>{
    if(!document.getElementById('s-bilan-choice')?.classList.contains('active')){
      clearInterval(window._bilanCdInterval);window._bilanCdInterval=null;return;
    }
    _updateBilanCountdown();
  },60000);
}
// R34 — LE COMPTE A REBOURS EST REVENU SUR L'ECRAN DE CHOIX, dans sa forme
// d'avant R19 : la date, puis jours, heures et minutes en grands chiffres.
// getNextBilanSaturday sans rattrapage : en retard, l'echeance est passee et
// le bloc le dit.
function _updateBilanCountdown(){
  const cd=document.getElementById('bilan-countdown');
  if(!cd) return;
  cd.style.display='block';
  const next=getNextBilanSaturday();
  if(!next){
    cd.innerHTML=`<div style="text-align:center;padding:14px 12px;font-size:var(--fs-sm);color:var(--sub);background:color-mix(in srgb,var(--text) 3%,transparent);border:1px solid color-mix(in srgb,var(--text) 7%,transparent);border-radius:var(--r-3)">Après ton 1er bilan, ton prochain rendez-vous apparaîtra ici.</div>`;
    return;
  }
  const diffMs=next.getTime()-Date.now();
  const dateLabel=next.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  if(diffMs<=0){
    // LA PHRASE DIT LE VRAI RETARD. Avant R19 elle disait « prévu aujourd'hui »
    // meme quand l'echeance datait de plusieurs jours.
    let n=null; try{ n=_bilRetardJours(next); }catch(e){ n=null; }
    const quand=(n==null||n<=0)?'est prévu aujourd’hui'
      :(n===1?'était attendu hier':'est attendu depuis '+n+' jours');
    cd.innerHTML=`<div style="background:linear-gradient(135deg,#c10000,#7a0000);border-radius:var(--r-3);padding:20px 16px;text-align:center;box-shadow:0 0 32px color-mix(in srgb,var(--red) 35%,transparent)"><div style="font-size:var(--fs-lg);font-weight:900;color:var(--text);letter-spacing:.5px;text-transform:uppercase">C'est le moment !</div><div style="font-size:var(--fs-sm);color:rgba(255,255,255,.75);margin-top:6px">Ton bilan ${quand} : complète-le maintenant.</div></div>`;
    return;
  }
  const totalMins=Math.floor(diffMs/60000);
  const days=Math.floor(totalMins/1440);
  const hours=Math.floor((totalMins%1440)/60);
  const mins=totalMins%60;
  const pad=n=>String(n).padStart(2,'0');
  const blocks=days>0
    ?[{v:pad(days),l:'JOURS',red:true},{v:pad(hours),l:'HEURES',red:false},{v:pad(mins),l:'MIN',red:false}]
    :[{v:pad(hours),l:'HEURES',red:true},{v:pad(mins),l:'MIN',red:false}];
  cd.innerHTML=`<div style="background:linear-gradient(160deg,#1a0000 0%,var(--surface-0) 60%);border:1px solid color-mix(in srgb,var(--red) 22%,transparent);border-radius:var(--r-3);padding:16px 14px 14px;position:relative;overflow:hidden;box-shadow:0 0 28px color-mix(in srgb,var(--red) 7%,transparent),0 6px 20px rgba(0,0,0,.55)">
    <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,color-mix(in srgb,var(--red) 95%,transparent),color-mix(in srgb,var(--red) 15%,transparent),transparent)"></div>
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:var(--red-text);margin-bottom:4px">Prochain bilan</div>
    <div style="font-size:var(--fs-md);font-weight:700;color:var(--text);margin-bottom:14px">${dateLabel}</div>
    <div style="display:flex;gap:6px">${blocks.map(b=>`<div style="flex:1;background:${b.red?'rgba(224,32,32,.13)':'rgba(255,255,255,.03)'};border:1px solid ${b.red?'rgba(224,32,32,.28)':'rgba(255,255,255,.07)'};border-radius:var(--r-2);padding:12px 6px;text-align:center"><div style="font-size:var(--fs-3xl);font-weight:900;line-height:1;font-variant-numeric:tabular-nums;color:${b.red?'var(--red)':'var(--text)'}${b.red?';--halo-c:color-mix(in srgb,var(--red) 55%,transparent);text-shadow:var(--halo-2)':''}">${b.v}</div><div style="font-size:var(--fs-xs);font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:rgba(255,255,255,.32);margin-top:6px">${b.l}</div></div>`).join('')}</div>
  </div>`;
}
// forcerReprise : appelé depuis la carte de reprise de l'accueil, où l'athlète
// a déjà exprimé son intention — lui reposer la question serait redondant.
// Etapes REELLEMENT affichables. Une etape conditionnelle qui rend une
// chaine vide — le bloc Traitement, hors semestre — ne doit ni occuper un
// numero ni imposer un « Suivant » sur du vide.
// ══ L'HISTORIQUE DES BILANS, ET LEUR MODIFICATION (Kevin, 05/10/2026) ════
// « La personne n'a pas eu le temps de prendre les photos, ou s'est trompée
// dans une mensuration » : jusqu'ici un bilan envoyé était figé. Un bouton
// « Historique des bilans » sur l'écran Bilan liste tout ce qu'elle a envoyé ;
// chaque ligne ouvre le RÉCAP (l'onglet Notes, déjà écrit) ou la MODIFICATION.
//
// MODIFIER ROUVRE LE MÊME QUESTIONNAIRE, PRÉ-REMPLI, et l'enregistrement
// RÉÉCRIT LE BILAN EXISTANT : même date, même numéro, même réponse du coach.
// Rien n'est créé, donc aucune courbe ne gagne un point, aucune série, aucun
// badge ne bouge ; le coach lit les nouvelles valeurs à la synchronisation
// suivante, sur le même bilan, marqué « modifié le … ».
let _bilEdition=null;          // {id,nom} pendant une modification, sinon null
let _bilPhotosAVenir=null;     // vues promises « plus tard » à la validation (build 1861)
const BIL_PREFIXES_REPONSES=/^(bil|deb|coach)-/;
// PURE. Les bilans, du plus récent au plus ancien, avec leur nom d'usage.
function historiqueBilans(u){
  const l=((u&&u.bilans)||[]).filter(b=>b&&b.date).slice().sort((a,b)=>a.date-b.date);
  let rang=0;
  return l.map(b=>{
    const depart=b.type==='depart';
    if(!depart) rang++;
    return {id:_idBilan(b),b,depart,nom:depart?'Bilan d’inscription':'Bilan '+rang,
      date:dateLocaleDeCle(b.date).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}),
      poids:getBW(b)||null,
      photos:['face','back','side'].filter(v=>{ try{ return photoBilanExiste(b,v); }catch(e){ return false; } }).length};
  }).reverse();
}
function _majBoutonHistoriqueBilans(){
  const cd=document.getElementById('bilan-countdown'); if(!cd) return;
  let z=document.getElementById('bilan-historique');
  const n=historiqueBilans(currentUser).length;
  if(!n){ if(z) z.remove(); return; }
  if(!z){ z=document.createElement('button'); z.type='button'; z.id='bilan-historique'; z.className='hb-ouvrir';
    z.onclick=()=>ouvrirHistoriqueBilans(); cd.insertAdjacentElement('afterend',z); }
  z.innerHTML='<span>Historique des bilans</span><b>'+n+'</b>';
}
function ouvrirHistoriqueBilans(){
  const l=historiqueBilans(currentUser);
  const lignes=l.map(x=>`<div class="hb-l">
      <div class="hb-l-t"><b>${escapeHtml(x.nom)}</b><span>${escapeHtml(x.date)}${x.b.modifieLe?' · modifié':''}</span>
        <i>${x.poids?escapeHtml(String(x.poids).replace('.',','))+' kg · ':''}${x.photos?x.photos+' photo'+(x.photos>1?'s':''):'sans photo'}</i></div>
      <div class="hb-l-b">
        <button type="button" class="hb-b" onclick="closeModal();openBilanNotes('${escapeHtml(x.id)}')">Récap</button>
        <button type="button" class="hb-b hb-b-r" onclick="modifierBilan('${escapeHtml(x.id)}')">Modifier</button>
        ${bilanSupprimable(x.b)?`<button type="button" class="hb-b" onclick="bilanSupprimerDemande('${escapeHtml(x.id)}')">Supprimer</button>`:''}
      </div></div>`).join('');
  const html=`<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
    <div class="hb" onclick="event.stopPropagation()" role="dialog" aria-label="Historique des bilans">
      <h2>Historique des bilans</h2>
      <p class="sub">Relis un bilan, ou corrige-le : une mesure fausse, des photos que tu n’avais pas eu le temps de prendre. Ton coach voit la correction sur le même bilan.</p>
      <div class="hb-liste">${lignes||emptyState('clipboard','Aucun bilan envoyé pour l’instant.')}</div>
      <button class="btn btn-outline" onclick="closeModal()">Fermer</button>
    </div></div>`;
  const old=document.getElementById('modal-overlay'); if(old) old.remove();
  document.body.insertAdjacentHTML('beforeend',html);
}
// BUILD 1865 : un bilan renvoyé par erreur se supprime — moins de 48 h, et
// tant que le coach n'y a pas répondu. Pierre tombale, et 8 s pour annuler.
const BIL_SUPPRESSION_H=48;
function bilanSupprimable(b,maintenant){
  return !!(b&&b.date&&(Number(maintenant)||Date.now())-Number(b.date)<=BIL_SUPPRESSION_H*3600e3&&!bilanRepondu(b));
}
let _bilanSupprime=null;
function supprimerBilan(id){
  const l=(currentUser&&currentUser.bilans)||[];
  const i=l.findIndex(b=>_idBilan(b)===id);
  if(i<0||!bilanSupprimable(l[i])) return false;
  const b=l[i], cle=cleSuppressionBilan(b);
  l.splice(i,1);
  marquerSupprime(currentUser,'bilans',cle);
  _bilanSupprime={b,index:i,cle};
  saveUser();
  return true;
}
function annulerSuppressionBilan(){
  const x=_bilanSupprime;
  if(!x) return false;
  _bilanSupprime=null;
  const l=currentUser.bilans||(currentUser.bilans=[]);
  if(l.indexOf(x.b)<0) l.splice(Math.min(x.index,l.length),0,x.b);
  try{ delete currentUser.supprimes.bilans[x.cle]; }catch(e){}
  saveUser();
  return true;
}
async function bilanSupprimerDemande(id){
  const x=historiqueBilans(currentUser).find(h=>h.id===id);
  if(!x) return false;
  const ok=await rcConfirm('Supprimer '+x.nom+' ?','Envoyé le '+x.date+'. Ton coach ne le verra plus.','Supprimer');
  if(!ok) return false;
  if(!supprimerBilan(id)) return false;
  try{ closeModal(); ouvrirHistoriqueBilans(); }catch(e){}
  try{ _suppActionToast(x.nom+' supprimé','Annuler',()=>{ annulerSuppressionBilan(); try{ closeModal(); ouvrirHistoriqueBilans(); }catch(e){} },ANNULER_MS); }catch(e){}
  return true;
}
// Rouvre le questionnaire sur un bilan déjà envoyé.
// `etape` (facultatif) : 'photos' ouvre directement l'étape des photos —
// calculée sur les étapes RÉELLES du questionnaire, jamais un index fixe.
function modifierBilan(id,etape){
  const x=historiqueBilans(currentUser).find(h=>h.id===id);
  if(!x){ toast('Ce bilan est introuvable','var(--orange)'); return false; }
  try{ closeModal(); }catch(e){}
  clearTimeout(_bilDraftTimer); _bilDraftTimer=null;
  _bilGen++;
  _bilEdition={id:x.id,nom:x.nom};
  bilType=x.depart?'depart':'coaching'; bilStep=0; _bilPhotoLoading=0; _bilReprises=null; _bilPoidsPesees=null;
  bilData={};
  for(const k of Object.keys(x.b)){
    if(!BIL_PREFIXES_REPONSES.test(k)) continue;
    const v=x.b[k];
    bilData[k]=Array.isArray(v)?v.slice():v;
  }
  if(etape==='photos'){
    const i=_bilIndexEtapePhotos(_etapesUtiles(bilType==='depart'?DEB_STEPS:BIL_STEPS),bilType);
    if(i>=0) bilStep=i;
  }
  renderBilStep(); go('s-bilan');
  return true;
}
// ══ LES VALEURS SUSPECTES (BUILD 1864) ═══════════════════════════════════
// PURE. [{cle, val, ref, texte}] : poids à plus de 10 % de la référence (poids
// nutritionnel, sinon dernier bilan), mensuration à plus de 25 % de la même
// mesure au dernier bilan qui la porte.
function valeursSuspectesBilan(type,data,user){
  const d=data||{}, out=[];
  const fr=v=>String(Math.round(v*10)/10).replace('.',',');
  const pre=type==='depart'?'deb-':'bil-';
  const bils=((user&&user.bilans)||[]).filter(b=>b&&b.date).slice().sort((a,b)=>b.date-a.date);
  const avant=suf=>{ for(const b of bils){ const v=lireDecimal(b['bil-'+suf]!=null?b['bil-'+suf]:b['deb-'+suf]); if(v!=null) return v; } return null; };
  for(const k of Object.keys(d)){
    if(k.indexOf(pre)!==0||/-photo|-ctl$|-q$/.test(k)) continue;
    const v=lireDecimal(d[k]);
    if(v==null) continue;
    const suf=k.slice(pre.length);
    if(suf==='weight'){
      let ref=null;
      try{ const p=poidsNutritionnel(user); if(p&&p.kg>0) ref=p.kg; }catch(e){}
      if(ref==null) ref=avant('weight');
      if(ref>0&&Math.abs(v-ref)/ref>0.10) out.push({cle:k,val:v,ref,texte:fr(v)+' kg (dernière : '+fr(ref)+')'});
      continue;
    }
    if(suf==='height') continue;
    // Les longueurs ne bougent pas d'un bilan à l'autre : elles ont leur propre contrôle (bLgSaisie).
    try{ if(MORPHO_MESURES.some(m=>m.cle===k)) continue; }catch(e){}
    const ref=avant(suf);
    if(ref>0&&Math.abs(v-ref)/ref>0.25) out.push({cle:k,val:v,ref,texte:fr(v)+' cm (dernière : '+fr(ref)+')'});
  }
  return out;
}
// « Corriger » : l'étape qui porte la case, et la case en surbrillance.
function _bilAllerAuChamp(steps,cle){
  for(let i=0;i<(steps||[]).length;i++){
    let h=''; try{ h=String(steps[i]()||''); }catch(e){ h=''; }
    if(h.indexOf('id="'+cle+'"')>=0){
      bilStep=i; renderBilStep();
      try{ const el=document.getElementById(cle); const bx=document.getElementById('bx-'+cle)||el;
        if(bx) bx.style.borderColor='var(--orange)';
        if(el){ el.focus(); if(el.scrollIntoView) el.scrollIntoView({block:'center'}); } }catch(e){}
      return true;
    }
  }
  return false;
}
// ══ LES PHOTOS DU BILAN QUI MANQUENT (BUILD 1861) ═════════════════════════
// L'élève oublie ses photos, n'a pas le temps, ou voit une photo refusée à
// tort : il validait sans rien dire, et il fallait bricoler la base pour qu'il
// y revienne. Une seule question à la validation, et une trace sur le bilan
// (photosAVenir) qui fait revenir la demande sur l'accueil.
const BIL_VUES=Object.freeze(['face','back','side']);
// L'index de l'étape qui porte les cartes photo, dans les étapes RÉELLES ; -1 sans.
function _bilIndexEtapePhotos(steps,type){
  const cle=_bilPhotoPrefixe(type)+'face';
  for(let i=0;i<(steps||[]).length;i++){
    let h=''; try{ h=String(steps[i]()||''); }catch(e){ h=''; }
    if(h.indexOf(cle)>=0) return i;
  }
  return -1;
}
// PURE. Les vues absentes parmi face/dos/profil. [] pendant une grossesse
// (photos facultatives), en modification d'un bilan envoyé, ou quand aucune vue
// n'est attendue (opts.attendues). opts.edition : défaut, la modification en cours.
function photosBilanManquantes(type,data,user,opts){
  const o=opts||{};
  const edition=('edition' in o)?o.edition:(typeof _bilEdition!=='undefined'?_bilEdition:null);
  if(edition) return [];
  let gr=false; try{ gr=!!grossesseSuspend(user); }catch(e){ gr=false; }
  if(gr) return [];
  const att=Array.isArray(o.attendues)?o.attendues:BIL_VUES;
  if(!att.length) return [];
  const pre=_bilPhotoPrefixe(type);
  return att.filter(v=>!(data&&data[pre+v]));
}
const BIL_LIB_VUES=Object.freeze({face:'de face',back:'de dos',side:'de profil'});
// Le bilan le plus récent qui attend encore des photos, ou null.
function bilanPhotosAVenir(user){
  const l=historiqueBilans(user||currentUser);
  for(const x of l){
    const a=x.b&&x.b.photosAVenir;
    if(Array.isArray(a)&&a.length) return x;
  }
  return null;
}
function _htmlPhotosAVenir(user){
  const x=bilanPhotosAVenir(user);
  if(!x) return '';
  const num=x.depart?'d’inscription':'n°'+(x.b.num||x.nom.replace(/\D+/g,''));
  return '<button type="button" class="clh-photos-avenir" onclick="modifierBilan('+_attrArg(x.id)+',\'photos\')"'
    +' style="display:block;width:100%;background:none;border:0;padding:6px 0;text-align:left;font:inherit;font-size:var(--fs-xs);color:var(--sub);cursor:pointer">'
    +'Photos du bilan '+escapeHtml(num)+' à ajouter →</button>';
}
// ══ BUILD 1868 : LE COACH DEMANDE DE COMPLÉTER UN BILAN ══════════════════
// b.aCompleter={vues:[...], mesures:[clés], note:'', le, par}. La demande se
// réduit au fur et à mesure que l'athlète comble les manques, et disparaît
// quand tout est là. Bilan d'inscription traité pareil (préfixe deb-).
const BIL_MESURES_ATTENDUES=Object.freeze(['weight']);
const BIL_LIB_MESURES=Object.freeze({weight:'le poids',height:'la taille'});
// PURE. Les vues photo absentes, et les mesures attendues restées vides.
// `user` (facultatif) : pendant une grossesse, les photos ne manquent pas.
function manquesBilan(b,user){
  if(!b) return {vues:[],mesures:[]};
  const pre=b.type==='depart'?'deb-':'bil-';
  let gr=false; try{ gr=!!(user&&grossesseSuspend(user)); }catch(e){ gr=false; }
  const vues=gr?[]:BIL_VUES.filter(v=>{ try{ return !photoBilanExiste(b,v); }catch(e){ return true; } });
  const dem=(b.aCompleter&&Array.isArray(b.aCompleter.mesures))?b.aCompleter.mesures:[];
  const vide=k=>{ const v=b[k]; return v==null||String(v).trim()===''; };
  const mesures=[...new Set(BIL_MESURES_ATTENDUES.map(x=>pre+x).concat(dem))].filter(vide);
  return {vues,mesures};
}
function _manquesVides(m){ return !m||(!(m.vues||[]).length&&!(m.mesures||[]).length); }
// « photo de face, de dos » ; « photo de face et le poids ».
function texteManquesBilan(m){
  const p=[];
  const v=(m&&m.vues)||[];
  if(v.length) p.push((v.length>1?'photos ':'photo ')+v.map(x=>BIL_LIB_VUES[x]||x).join(', '));
  for(const k of (m&&m.mesures)||[]){ const suf=String(k).replace(/^(bil|deb)-/,''); p.push(BIL_LIB_MESURES[suf]||suf); }
  return p.join(' et ');
}
// PURE (sur b). Réduit la demande à ce qui manque encore. 'comble' si elle
// disparaît, 'reste' si elle demeure (réduite), null sans demande.
function reduireDemandeCompleter(b){
  const d=b&&b.aCompleter;
  if(!d) return null;
  const vues=(Array.isArray(d.vues)?d.vues:[]).filter(v=>{ try{ return !photoBilanExiste(b,v); }catch(e){ return true; } });
  const mesures=(Array.isArray(d.mesures)?d.mesures:[]).filter(k=>b[k]==null||String(b[k]).trim()==='');
  if(!vues.length&&!mesures.length){ delete b.aCompleter; return 'comble'; }
  d.vues=vues; d.mesures=mesures;
  return 'reste';
}
// PURE. Complété après la réponse, et pas encore relu par le coach.
function bilanARelire(b){
  if(!b||!bilanRepondu(b)) return false;
  const c=Number(b.completeLe)||0;
  return c>(Number(b.reponseDate)||0)&&!(Number(b.correctionVueLe)>=c);
}
// Le bilan le plus récent qui porte une demande du coach, ou null.
function bilanACompleter(user){
  for(const x of historiqueBilans(user||currentUser)) if(x.b&&x.b.aCompleter) return x;
  return null;
}
function _htmlCarteACompleter(user){
  const x=bilanACompleter(user);
  if(!x) return '';
  const d=x.b.aCompleter;
  const m={vues:Array.isArray(d.vues)?d.vues:[],mesures:Array.isArray(d.mesures)?d.mesures:[]};
  if(_manquesVides(m)) return '';
  const jour=dateLocaleDeCle(x.b.date).toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
  const quoi=x.depart?'ton bilan d’inscription':'ton bilan du '+jour;
  return '<p class="ccd-manque clh-a-completer"><span class="ccd-manque-t">Ton coach te demande de compléter '
    +escapeHtml(quoi)+' : '+escapeHtml(texteManquesBilan(m))
    +(d.note?' — '+escapeHtml(String(d.note).slice(0,200)):'')+'</span>'
    +'<button type="button" class="ccd-manque-b" onclick="modifierBilan('+_attrArg(x.id)+(m.vues.length?',\'photos\'':'')+')">Compléter</button></p>';
}
// PURE. Applique les réponses `d` au bilan `b`, sans toucher à ce qui n'est pas
// une réponse (date, numéro, réponse du coach). Rend la liste des clefs changées.
function appliquerModifBilan(b,d,maintenant){
  const change=[];
  const pareil=(x,y)=>JSON.stringify(x===undefined?null:x)===JSON.stringify(y===undefined?null:y);
  for(const k of Object.keys(b)){
    if(!BIL_PREFIXES_REPONSES.test(k)||(k in d)) continue;
    delete b[k]; change.push(k);
  }
  for(const k of Object.keys(d)){
    if(!BIL_PREFIXES_REPONSES.test(k)||/^deb-scoff-/.test(k)) continue;
    if(pareil(b[k],d[k])) continue;
    b[k]=d[k]; change.push(k);
  }
  // Une mensuration corrigée n'est plus un report du bilan d'avant.
  if(Array.isArray(b.reprises)){
    b.reprises=b.reprises.filter(k=>change.indexOf(k)<0);
    if(!b.reprises.length) delete b.reprises;
  }
  if(change.length) b.modifieLe=maintenant||Date.now();
  // BUILD 1863 : CORRIGÉ APRÈS LA RÉPONSE DU COACH. Le coach doit le savoir —
  // sans quoi un poids corrigé ou des photos ajoutées passaient inaperçus. La
  // réponse n'est pas touchée.
  if(change.length&&bilanRepondu(b)){
    const ph=change.some(k=>/-photo-(face|back|side)$/.test(k));
    b.correctionApresReponse={le:maintenant||Date.now(),cles:change.slice(),photos:ph};
  }
  // BUILD 1878 : la trace lisible de la correction — photos regroupées, 10
  // clés au plus — et, après la réponse du coach, modifApresReponse.
  if(change.length){
    const cles=[];
    for(const k of change){ const c=/-photo-/.test(k)?'photos':k; if(cles.indexOf(c)<0) cles.push(c); }
    b.modifs={le:maintenant||Date.now(),cles:cles.slice(0,10)};
    if(bilanRepondu(b)) b.modifApresReponse=true;
  }
  return change;
}
// Le libellé lisible d'une clé corrigée (« photos », « tour de taille »).
function libelleCleBilan(k){
  if(k==='photos') return 'photos';
  try{ const m=MEAS.find(x=>'bil-'+x.k===k||'deb-'+x.k===k); if(m) return m.l.toLowerCase(); }catch(e){}
  if(/-weight$/.test(k)) return 'poids';
  try{ for(const t of ['suivi','depart']) for(const q of (BILAN_QUESTIONS[t]||[])) if(q.k===k) return String(q.lbl||q.l||k).toLowerCase(); }catch(e){}
  return k.replace(/^(bil|deb)-/,'');
}
// Le dernier passage du coach sur les bilans de cet athlète (côté coach).
function _bilansVusDe(c){
  try{ const v=currentUser&&currentUser.bilansVus; return Number(v&&v[_relCle(c)])||0; }catch(e){ return 0; }
}
// PURE. Une correction faite après la réponse, que le coach n'a pas encore lue.
function bilanCorrigeNonVu(b,vuLe){
  // BUILD 1878 : appelé avec un DOSSIER (c, vuLe) : un bilan des 60 derniers
  // jours corrigé après la réponse, et après le dernier passage du coach.
  if(b&&Array.isArray(b.bilans)){
    const v=vuLe!=null?Number(vuLe)||0:_bilansVusDe(b), m=Date.now();
    return b.bilans.some(x=>x&&x.modifApresReponse&&x.modifs&&Number(x.modifs.le)>v
      &&(m-Number(x.modifs.le))<=BIL_CORRECTION_JOURS*864e5&&!(Number(x.correctionVueLe)>=Number(x.modifs.le)));
  }
  const c=b&&b.correctionApresReponse;
  if(!c||!c.le) return false;
  return !(Number(b.correctionVueLe)>=Number(c.le));
}
// PURE. Le bilan corrigé non lu le plus récent des 60 derniers jours, ou null.
const BIL_CORRECTION_JOURS=60;
function bilanCorrigeAVoir(c,maintenant,vuLe){
  const m=Number(maintenant)||Date.now();
  const v=vuLe!=null?Number(vuLe)||0:_bilansVusDe(c);
  const l=((c&&c.bilans)||[]).filter(b=>b&&bilanCorrigeNonVu(b)&&Number(b.correctionApresReponse.le)>v&&(m-Number(b.correctionApresReponse.le))<=BIL_CORRECTION_JOURS*864e5);
  return l.sort((x,y)=>Number(y.correctionApresReponse.le)-Number(x.correctionApresReponse.le))[0]||null;
}
// « Photos ajoutées au bilan n°N » ou « Bilan n°N corrigé ».
function libelleCorrectionBilan(c,b,o){
  const x=b||bilanCorrigeAVoir(c);
  if(!x) return '';
  const nom=x.type==='depart'?'d’inscription':'n°'+(x.num||'?');
  // BUILD 1878 : « Bilan corrigé : Léa a ajouté ses photos ».
  if(o&&o.ligne){
    const qui=(c&&c!==x&&String(c.fname||'').trim())||'ton athlète';
    if(x.type==='depart') return 'Bilan d’inscription corrigé : '+qui+(x.correctionApresReponse.photos?' a ajouté ses photos':'');
    const n=((x.modifs&&x.modifs.cles)||x.correctionApresReponse.cles||[]).filter(k=>k!=='photos'&&!/-photo-/.test(k)).length;
    return 'Bilan corrigé : '+qui+(x.correctionApresReponse.photos?' a ajouté ses photos':' a modifié '+n+' réponse'+(n>1?'s':''));
  }
  // BUILD 1868 : complété à la demande du coach.
  if(x.completeSuiteDemande&&x.completeLe){
    const qui=(c&&c!==x&&String(c.fname||'').trim())||'Ton athlète';
    let j=''; try{ j=dateLocaleDeCle(x.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}); }catch(e){}
    return qui+' a complété son bilan '+(x.type==='depart'?'d’inscription':'du '+j)+(x.correctionApresReponse&&x.correctionApresReponse.photos?' (photos ajoutées)':'');
  }
  return x.correctionApresReponse.photos
    ?'Photos ajoutées au bilan '+nom
    :(x.type==='depart'?'Bilan d’inscription corrigé':'Bilan '+nom+' corrigé');
}
// Le coach ouvre le bilan : la correction est lue.
function _bilMarquerCorrectionsVues(client){
  try{
    if(!client||!client.email||currentUser.role!=='coach') return 0;
    const users=DB.get('users')||{};
    const c=users[client.email];
    if(!c||!_estMonAthlete(c,currentUser)||!Array.isArray(c.bilans)) return 0;
    const t=Date.now(); let n=0;
    c.bilans.forEach((b,i)=>{
      if(!bilanCorrigeNonVu(b)) return;
      b.correctionVueLe=t; n++;
      const bb=(client.bilans||[])[i]; if(bb&&bb!==b) bb.correctionVueLe=t;
    });
    if(!n) return 0;
    c.updatedAt=t; users[c.email]=c; DB.set('users',users);
    try{ CLOUD.pushOne(c.email,c).catch(()=>{}); }catch(e){}
    return n;
  }catch(e){ return 0; }
}
function _bilEnregistrerModif(){
  const ed=_bilEdition;
  const x=ed&&historiqueBilans(currentUser).find(h=>h.id===ed.id);
  if(!x){ toast('Ce bilan est introuvable : rien n’a été modifié','var(--orange)'); _quitterEcranBilan(false); openBilanChoice(); return false; }
  const change=appliquerModifBilan(x.b,bilData);
  // BUILD 1868 : la demande du coach se réduit à ce qui manque encore ; un
  // bilan DÉJÀ RÉPONDU qui change porte completeLe (sa réponse reste).
  const _avaitDemande=!!x.b.aCompleter;
  const _rd=reduireDemandeCompleter(x.b);
  if(change.length&&bilanRepondu(x.b)){
    x.b.completeLe=Date.now();
    if(_avaitDemande) x.b.completeSuiteDemande=true;
  }
  if(_rd&&!change.length) change.push('aCompleter');
  // Les photos promises se consomment au fur et à mesure qu'elles arrivent.
  if(Array.isArray(x.b.photosAVenir)){
    x.b.photosAVenir=x.b.photosAVenir.filter(v=>{ try{ return !photoBilanExiste(x.b,v); }catch(e){ return true; } });
    if(!x.b.photosAVenir.length){ delete x.b.photosAVenir; if(!change.length) change.push('photosAVenir'); }
  }
  // Le profil suit le bilan LE PLUS RÉCENT, comme à l'envoi : corriger un bilan
  // ancien ne doit pas ramener le poids du profil six semaines en arrière.
  const dernier=historiqueBilans(currentUser)[0];
  if(dernier&&dernier.id===x.id){
    const w=x.b['bil-weight']||x.b['deb-weight']; if(w) currentUser.weight=w;
    const h=parseFloat(x.b['deb-height']||x.b['bil-height']||0); if(h>100&&h<250) currentUser._evol_height=h;
  }
  try{ consommerDemandesMesure(x.b,currentUser); }catch(e){}
  Object.keys(x.b).filter(k=>k.includes('photo')).forEach(k=>{ try{ localStorage.removeItem('rc_pendingphoto_'+k); }catch(e){} });
  const enregistre=change.length?saveUser():true;
  // LES ANALYSES MORPHO SUIVENT LA CORRECTION (06/10/2026), comme à l'envoi
  // (saveBilanFinal) : photos ajoutées ou remplacées, rotule corrigée. Ce qui
  // ne change pas leur empreinte (poids, réponses) ne relance rien.
  if(change.length) try{ morphoInitialePeutEtre(currentUser); }catch(e){}
  if(change.length) (async()=>{ try{
    const r=await photosBilanMigrer(currentUser,{max:9});
    if(r.faites){ saveUser(); CLOUD.pushOne(currentUser.email,currentUser).catch(()=>{}); }
  }catch(e){} })();
  // BUILD 1878 : le coach est prévenu d'une correction faite après sa réponse.
  if(change.length&&x.b.modifApresReponse){ try{ const _i=(currentUser.bilans||[]).indexOf(x.b); if(_i>=0) deposerEvenement({type:'bilan_corrige',i:String(_i)}).catch(()=>{}); }catch(e){} }
  if(!change.length) toast('Aucun changement : '+x.nom+' est resté tel quel');
  else if(enregistre) toast(x.b.correctionApresReponse&&bilanCorrigeNonVu(x.b)
    ?'Ton coach est prévenu de la correction'
    :x.nom+' mis à jour : ton coach verra la correction');
  else toast('Stockage plein : la correction est envoyée au cloud, mais absente de cet appareil','var(--orange)');
  _quitterEcranBilan(false);
  openBilanChoice(); ouvrirHistoriqueBilans();
  return true;
}
function _etapesUtiles(steps){
  return (steps||[]).filter(f=>{
    try{ return String(f()||'').trim().length>0; }
    catch(e){ return true; }   // en cas d erreur, on garde : mieux vaut une
                               // etape fautive qu une etape escamotee
  });
}
// BUILD 1865 : un bilan de suivi envoyé il y a moins de 5 jours — l'élève
// croyait que le premier n'était pas parti. On propose de le corriger.
const BIL_DOUBLON_JOURS=5;
function bilanRecentDeType(user,type,maintenant){
  const m=Number(maintenant)||Date.now();
  const l=((user&&user.bilans)||[]).filter(b=>b&&b.type===type&&b.date&&(m-Number(b.date))<BIL_DOUBLON_JOURS*864e5);
  return l.sort((a,b)=>b.date-a.date)[0]||null;
}
async function openBilan(type,forcerReprise){
  if(type==='coaching'&&!forcerReprise&&!_bilEdition){
    const r=bilanRecentDeType(currentUser,'coaching');
    if(r){
      const d=dateLocaleDeCle(r.date).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
      const ch=await rcConfirm3('Tu as envoyé un bilan le '+d,'','Le corriger','En faire un nouveau','Annuler');
      if(ch===null) return false;
      if(ch==='ok') return modifierBilan(_idBilan(r));
    }
  }
  const brut=localStorage.getItem(BIL_DRAFT_KEY);
  // LE BROUILLON BRUT, avant tout filtre : _bilLoadDraft rend null dès que le
  // type diffère, et c'est précisément le cas qu'on veut voir ici.
  let ancien=null;
  try{ ancien=brut?JSON.parse(brut):null; }catch(e){ ancien=null; }
  // MÊME FILTRE QUE _bilLoadDraft, et pour la même raison : cette lecture-ci
  // court-circuite volontairement le type, pas le propriétaire. Sans elle, le
  // brouillon d’un AUTRE compte déclenchait encore la question « tu as un
  // bilan en cours », en nommant un bilan qui n’est pas le sien.
  // UN BROUILLON SANS ADRESSE, SUR UN APPAREIL A PLUSIEURS COMPTES : on ne
  // devine pas, mais on n'ecarte pas en silence non plus. On demande.
  // POSEE AVANT TOUT LE RESTE : la reponse decide si ce brouillon existe pour
  // la suite de cette fonction — y compris pour l'avertissement d'ecrasement.
  if(ancien&&_bilDraftProprio(ancien)==='incertain'&&!_bilUnSeulCompte()){
    const n=_bilDraftRempli(ancien);
    if(n>0){
      const sien=await rcConfirm('Un '+_bilNomType(ancien.bilType)+' commencé avec '+n
        +' réponse'+(n>1?'s':'')+' a été trouvé sur cet appareil, sans compte identifié.'
        +'\n\nPlusieurs comptes sont connectés ici. Est-ce le tien ?',null,'C’est le mien');
      // NON : il reste ou il est. On ne le supprime pas — son proprietaire le
      // retrouvera en se connectant, et c'est la meme doctrine que pour
      // l'instantane de seance : la lecture ne detruit rien.
      if(!sien) return false;
      ancien.email=(currentUser&&currentUser.email)||'';
      try{ localStorage.setItem(BIL_DRAFT_KEY,JSON.stringify(ancien)); }catch(e){}
    }
  }
  if(ancien&&!_bilDraftAMoi(ancien)) ancien=null;
  const autreType=!!(ancien&&ancien.bilType&&ancien.bilType!==type);
  // POSÉE AVANT DE TOUCHER AUX VARIABLES DU MODULE : refuser doit tout laisser
  // exactement comme c'était, brouillon compris. Les remettre à zéro d'abord
  // aurait laissé l'écran décrire un bilan vide pendant que le brouillon
  // existait encore.
  if(autreType&&_bilDraftRempli(ancien)>0){
    const n=_bilDraftRempli(ancien);
    if(!await rcConfirm('Tu as un '+_bilNomType(ancien.bilType)+' commencé avec '+n
      +' réponse'+(n>1?'s':'')+'.\n\nOuvrir un '+_bilNomType(type)+' l’effacera.\n\nContinuer ?',null,'Confirmer')) return false;
  }
  const brouillon=_bilLoadDraft(type);
  _bilEdition=null;
  bilType=type;bilStep=0;bilData={};_bilPhotoLoading=0;
  _bilReprises=null;
  if(brouillon&&_bilDraftRempli(brouillon)>0
     &&(forcerReprise||await rcConfirm('Reprendre ton bilan en cours ?\n\nTu en étais à l\'étape '
        +(brouillon.bilStep+1)+', avec '+_bilDraftRempli(brouillon)+' réponse'
        +(_bilDraftRempli(brouillon)>1?'s':'')+' déjà saisie'
        +(_bilDraftRempli(brouillon)>1?'s':'')+'.',null,'Reprendre'))){
    bilStep=brouillon.bilStep;
    bilData={...brouillon.bilData};
    _bilRestaurerPhotos(type);
  } else if(brut){
    // JAMAIS D'EFFACEMENT MUET. Les deux questions ci-dessus ne couvrent que
    // le brouillon RECONNU — celui d'un autre type, ou celui qu'on vient de
    // s'attribuer. Tout le reste tombait ici et etait efface sans un mot :
    // brouillon perime, brouillon d'un autre compte, brouillon refuse a la
    // question de reprise. Le dernier cas est un choix de l'athlete et ne se
    // rediscute pas ; les deux autres, non.
    //
    // ON NE DEMANDE QUE S'IL Y A QUELQUE CHOSE A PERDRE : un brouillon vide
    // s'efface sans ceremonie, c'est le cas de tous les jours.
    const _perdu=(()=>{ try{ return _bilDraftRempli(JSON.parse(brut)); }catch(e){ return 0; } })();
    if(_perdu>0&&!(brouillon&&_bilDraftRempli(brouillon)>0)){
      if(!await rcConfirm('Un bilan commencé avec '+_perdu+' réponse'+(_perdu>1?'s':'')
        +' est encore sur cet appareil, et n’a pas pu être repris.'
        +'\n\nOuvrir un nouveau bilan l’effacera définitivement.\n\nContinuer ?',
        null,'Effacer et continuer')) return false;
    }
    // Brouillon refusé, périmé, ou d'un autre type : on repart à zéro pour de
    // bon, photos en attente comprises — sinon elles reviendraient plus tard.
    //
    // LES DEUX PRÉFIXES, et non celui du bilan demandé. Un brouillon de départ
    // abandonné laissait ses `deb-photo-*` derrière lui, et _bilRestaurerPhotos
    // les aurait ressorties au prochain questionnaire de départ — c'est
    // exactement ce que son commentaire redoute. Il n'existe qu'UNE clef de
    // brouillon : une fois celui-ci détruit, plus rien de légitime ne peut
    // réclamer une photo en attente, de l'un ou l'autre type. Cela couvre aussi
    // le brouillon illisible, dont on ne connaît pas le type.
    _bilClearDraft();
    _bilPurgerPhotos('depart');_bilPurgerPhotos('coaching');
  }
  // LES MENSURATIONS DU DERNIER BILAN SONT REPRISES. Sans elles, douze tours
  // à retaper toutes les deux semaines — et chaque case oubliée creuse un trou
  // dans une courbe, parce qu'un bilan sans la valeur n'est pas un bilan avec
  // la valeur d'avant : c'est une rupture.
  //
  // JAMAIS POUR LE QUESTIONNAIRE DE DÉPART : il n'y a aucun bilan antérieur, et
  // le pré-remplir reviendrait à lui inventer un passé.
  //
  // `bilData` vide dit à lui seul que rien n'a été repris du brouillon : la
  // reprise en pose au moins une réponse, c'est sa condition d'existence.
  // APRÈS UNE REPRISE DE BROUILLON AUSSI, et pas seulement sur un bilan neuf.
  // La condition était « bilData vide » : une reprise de brouillon sautait donc
  // le pré-remplissage, _bilReprises restait null, et les mensurations
  // — présentes dans l’ancien brouillon — se présentaient comme neuves : sans
  // pointillés, sans la note, et comptées comme des réponses.
  //
  // LIMITÉ AUX CLEFS ABSENTES DU BROUILLON. `in` et non une valeur vide : une
  // case que l’athlète a délibérément effacée est une décision, pas un trou —
  // la re-remplir reviendrait à lui rendre ce qu’il vient de retirer.
  _bilPoidsPesees=null;
  if(type==='coaching'&&!_bilEdition&&!('bil-weight' in bilData)){
    // BUILD 1880 : la moyenne des pesées de la semaine, une MESURE (pas une reprise).
    let _p=null; try{ _p=poidsPourBilan(currentUser); }catch(e){ _p=null; }
    if(_p){ bilData['bil-weight']=String(_p.kg); _bilPoidsPesees={kg:_p.kg,n:_p.n}; }
  }
  if(type==='coaching'){
    let _r={};
    try{ _r=mensurationsReprises(currentUser); }catch(e){ _r={}; }
    const _k=Object.keys(_r).filter(k=>!(k in bilData));
    if(_k.length){
      for(const k of _k) bilData[k]=_r[k];
      _bilReprises=new Set(_k);
    }
  }
  // Le nombre d'étapes peut avoir changé depuis l'écriture du brouillon.
  const steps=_etapesUtiles(type==='depart'?DEB_STEPS:BIL_STEPS);
  bilStep=Math.max(0,Math.min(bilStep,steps.length-1));
  renderBilStep();go('s-bilan');
}
// Entrée depuis la carte « Bilan commencé » de l'accueil.
function bilResumeAndGo(){
  const d=_bilLoadDraft();
  if(!d||!_bilDraftRempli(d)){
    const el=document.getElementById('clh-resume-bilan');
    if(el) el.style.display='none';
    _bilClearDraft();return;
  }
  openBilan(d.bilType,true);
}
// ── « Finir plus tard » ────────────────────────────────────────────────────
//
// LA CINQUIEME SORTIE DU BILAN, et elle ne fabrique rien de neuf : c est le
// chemin que bilBack emprunte deja a l etape 0, avec une destination fixe.
// Ce qui manquait n etait pas la mecanique, c etait une PORTE VISIBLE — la
// seule facon de sortir en conservant sa saisie etait la fleche de retour,
// depuis la premiere etape, ce que rien n annoncait.
//
// ON ECRIT LE BROUILLON SOI-MEME, sans attendre le debounce de 400 ms. Les
// dernieres frappes sont encore en vol : sortir sans les ecrire ferait
// reprendre le bilan quelques caracteres en arriere, et le poids que
// l athlete vient de corriger serait le seul a manquer.
//
// PUIS, la reponse donnee, on quitte avec `false`, et c est volontaire : `true` reecrirait le
// brouillon une seconde fois, alors qu on vient de le poser a la main.
// La convention du fichier est que `false` signifie « l appelant a deja
// fait le necessaire », pas « oublie tout ».
// ON DEMANDE AVANT, comme pour la seance. Et la question vient de
// HIST_CONFIRME, celle que pose deja le retour materiel sur ce meme ecran :
// deux formulations pour un seul geste finissent toujours par diverger, et
// c est celle-la qui promet le brouillon a l athlete.
//
// SI LA QUESTION LEVE, ON RESTE. C est ce que fait deja le retour materiel :
// son .then n agit que sur une reponse, et une exception laisse l athlete ou
// il est. Rien n est perdu pour autant, l enregistrement automatique continue.
async function bilPlusTard(){
  const q=HIST_CONFIRME['s-bilan'];
  if(!await rcConfirm(q[0],q[1],q[2],q[3])) return;
  // COMPTE AVANT DE QUITTER : _quitterEcranBilan vide bilData.
  const n=_bilCompterReponses(_bilDataSansPhotos());
  try{ _bilEcrireDraft(); }catch(e){}
  _quitterEcranBilan(false);
  go('s-client-home');
  loadClientHome();
  // Le nombre est DIT. « Enregistre » sans quantite laisse le doute sur ce
  // qui a ete garde ; une reprise qui redemande une reponse deja donnee est
  // exactement ce que cette porte doit eviter.
  toast(n?('Bilan enregistré : '+n+' réponse'+(n>1?'s':'')+' conservée'+(n>1?'s':'')+'.')
        :'Bilan enregistré, tu pourras le reprendre.','var(--green)');
}
function bilBack(){
  if(bilStep>0){bilStep--;renderBilStep();}
  else{
    // AVANT la navigation : loadClientHome dessine la carte « Bilan commencé »
    // à partir du BROUILLON, et le débounce ne l’a peut-être pas encore écrit.
    if(_bilEdition){ _quitterEcranBilan(false); openBilanChoice(); ouvrirHistoriqueBilans(); return; }
    _quitterEcranBilan(true);
    // R34 — comme avant R19 : le bilan coaching revient a l'ecran de choix,
    // par lequel on est toujours passe ; le questionnaire de depart, a
    // l'accueil.
    if(bilType==='depart'){go('s-client-home');loadClientHome();}else{go('s-bilan-choice');}
  }
}
async function bilNext(){
  const steps=_etapesUtiles(bilType==='depart'?DEB_STEPS:BIL_STEPS);
  if(bilStep<steps.length-1){bilStep++;renderBilStep();}
  else{
    if(_bilPhotoLoading>0&&++_bilPhotoEssais<=BIL_PHOTO_ESSAIS_MAX){
      toast('Photos en cours de compression, patiente une seconde...','var(--orange)');
      setTimeout(bilNext,800); return;
    }
    if(_bilPhotoLoading>0){
      // Dix secondes : la compression ne reviendra pas. On ne retient pas en
      // otage tout ce qui a été saisi pour une photo qui ne s'ajoutera pas.
      _bilPhotoLoading=0;
      toast('La photo n’a pas pu être ajoutée. Ton bilan est enregistré sans elle.','var(--orange)');
    }
    // Remis à zéro sur CHAQUE passage propre : un second bilan dans la même
    // session ne doit pas hériter du compteur du premier.
    _bilPhotoEssais=0;
    // UN BILAN VIDE N'EST PAS UN BILAN. Il s'enregistrait quand même, comptait
    // dans l'historique, et surtout RÉARMAIT le cycle de rappel : l'ancre de
    // isBilanNotifDay comme de getNextBilanSaturday est la date du DERNIER
    // bilan. Valider à vide repoussait le prochain rappel de quinze jours,
    // sans qu'une seule donnée ait été saisie.
    //
    // APRÈS le bloc des photos, et non avant : une photo encore en
    // compression finira dans bilData, et le bilan ne sera alors pas vide.
    // SANS LES REPRISES. Les mensurations pré-remplies ne sont pas des
    // réponses : les compter faisait qu’un bilan coaching où rien n’avait été
    // touché passait le garde-fou, s’enregistrait, et repoussait le prochain
    // rappel de quinze jours sans qu’une seule donnée ait été saisie.
    const _saisi=_bilSansReprises(bilData,_bilReprises);
    if(!_bilCompterReponses(_saisi)){
      toast('Ton bilan est vide : renseigne au moins ton poids ou une mesure.','var(--orange)');
      return;
    }
    // LE POIDS NE BLOQUE PAS, IL SE SIGNALE. Un bilan peut légitimement ne
    // porter que des ressentis ; mais c'est le seul champ qui porte une
    // courbe, et son absence laissera un trou visible dans le suivi.
    // Sur le même jeu : un poids seulement REPRIS ne fera pas de point sur la
    // courbe, puisqu’il va être retiré du bilan enregistré. L’avertissement
    // doit donc bien tomber.
    // BUILD 1864 : UN CHIFFRE DE TROP SE DEMANDE AVANT DE PARTIR. Poids à plus
    // de 10 % de la référence, mensuration à plus de 25 % du dernier bilan.
    const _susp=valeursSuspectesBilan(bilType,bilData,currentUser);
    if(_susp.length){
      const ok=await rcConfirm('Vérifie ces valeurs',
        _susp.map(x=>x.texte).join('\n'),'C’est juste','Corriger');
      if(!ok){ _bilAllerAuChamp(steps,_susp[0].cle); return; }
    }
    // LES PHOTOS ET LE POIDS : UNE SEULE QUESTION (build 1861). Quand les deux
    // manquent, les deux messages tiennent dans le même texte.
    const _iPh=_bilIndexEtapePhotos(steps,bilType);
    const _manq=photosBilanManquantes(bilType,bilData,currentUser,{attendues:_iPh>=0?BIL_VUES:[]});
    const _sansPoids=!_bilPoidsSaisi(_saisi);
    _bilPhotosAVenir=null;
    if(_manq.length){
      const txt='Ton coach s’en sert pour voir ce que la balance ne montre pas.'
        +(_sansPoids?'\n\nTon poids manque aussi : ta courbe n’aura pas de point pour ce bilan.':'');
      const r=await rcConfirm3('Il manque tes photos',txt,'Ajouter mes photos','Envoyer sans, je les ajoute plus tard','Annuler');
      if(r==='ok'){
        bilStep=_iPh; renderBilStep();
        try{ const c=document.querySelector('input[onchange*="'+_bilPhotoPrefixe(bilType)+_manq[0]+'"]');
          const carte=c&&c.closest('div'); if(carte&&carte.scrollIntoView) carte.scrollIntoView({block:'center'}); }catch(e){}
        return;
      }
      if(r!=='milieu') return;
      _bilPhotosAVenir=_manq.slice();
    } else if(_sansPoids
       &&!await rcConfirm('Valider sans ton poids ?\n\nTa courbe n’aura pas de point pour ce bilan.',null,'Valider')) return;
    // R32 — L'ECRAN DE RESTITUTION, seulement si le bilan S'EST ECRIT : la porte
    // du consentement de sante peut rendre la main sans rien enregistrer.
    const _nBilansAvant=((currentUser&&currentUser.bilans)||[]).length;
    saveBilanFinal();
    if(((currentUser&&currentUser.bilans)||[]).length>_nBilansAvant){
      try{ ouvrirRestitutionBilan(); }catch(e){}
    }
  }
}
function renderBilStep(){
  const steps=_etapesUtiles(bilType==='depart'?DEB_STEPS:BIL_STEPS);
  const total=steps.length;
  document.getElementById('bil-title').textContent=_bilEdition?('Modifier · '+_bilEdition.nom):(bilType==='depart'?'Questionnaire de début':'Bilan Coaching');
  // LE NUMERO D ETAPE EST LA VALEUR, le total n est qu un reperage. Ils sont
  // ecrits par la meme phrase, mais seul le premier est peint en blanc.
  // Aucune des deux valeurs ne vient de l exterieur : bilStep est un entier
  // interne, total sort de _etapesUtiles — rien a echapper ici.
  document.getElementById('bil-step-label').innerHTML=(bilStep+1)+'<span style="color:var(--sub);font-weight:700">/'+total+'</span>';
  document.getElementById('bil-progress').style.width=((bilStep+1)/total*100)+'%';
  document.getElementById('bil-next-btn').textContent=bilStep===total-1?(_bilEdition?'Enregistrer les modifications':'Valider '):'Suivant →';
  document.getElementById('bil-back-btn').style.visibility='visible';
  // Le cadre de disponibilite se lit AVANT d ecrire, pas apres l envoi.
  const _bilZone=document.getElementById('bil-content');
  _bilZone.innerHTML='<div class="pad">'
    +htmlBandeauDispo()+steps[bilStep]()+'</div>';
  // Les deux etapes qui portent un schema corporel — le bilan de depart et le
  // bilan de suivi — le recoivent ici, une seule fois chacune : le WeakSet
  // interne empeche le rejeu si l'etape est re-rendue sans etre quittee.
  try{ requestAnimationFrame(()=>arcTracerSchema(_bilZone)); }catch(e){}
  const skipBtn=document.getElementById('bil-skip-depart');
  if(skipBtn) skipBtn.style.display=(!_bilEdition&&bilType==='depart'&&!currentUser?.bilans?.some(b=>b.type==='depart'))?'block':'none';
  _bilBrancherAutoSave();
  // Enregistre aussi le numéro d'étape : sans ça, une reprise ramènerait à la
  // dernière étape où l'athlète a tapé quelque chose, pas où il en était.
  _bilSaveDraft();
}
function pickBilChoice(groupId,val,multi){
  if(multi){
    if(!bilData[groupId])bilData[groupId]=[];
    const arr=bilData[groupId],idx=arr.indexOf(val);
    if(idx>=0)arr.splice(idx,1);else arr.push(val);
    document.querySelectorAll('[data-grp="'+groupId+'"]').forEach(el=>el.classList.toggle('sel',arr.includes(el.dataset.val)));
  } else {
    bilData[groupId]=val;
    document.querySelectorAll('[data-grp="'+groupId+'"]').forEach(el=>el.classList.toggle('sel',el.dataset.val===val));
  }
  // Un clic ne déclenche pas d'événement `input` : la délégation ne le voit pas.
  _bilSaveDraft();
}
// LE POIDS PORTE LE MEME POINTILLÉ que les cases du schéma. Il est rendu ici,
// hors de bBodySchema : pré-rempli sans marque, il serait le pire des deux
// mondes — c'est la seule valeur qui alimente une courbe que tout le monde
// regarde, et un athlète distrait y inscrirait le poids d'il y a quinze jours.
// Aucune mensuration ne passe par bQ : seul le poids est concerné.
function bQ(id){const _r=_bilEstReprise(id);
  return`<input type="text" inputmode="decimal" autocomplete="off" id="${id}" placeholder="-" value="${escapeHtml(String(bilData[id]||'').replace('.',','))}" oninput="bMesureSaisie('${id}',this.value)" style="width:68px;text-align:right;padding:6px 8px;font-size:var(--fs-lg);font-weight:800;margin:0;background:var(--bg);border:1px ${_r?'dashed rgba(224,32,32,.5)':'solid #222'};border-radius:var(--r-1)">`;}
function bT(id,ph){return`<input type="text" id="${id}" placeholder="${ph||''}" value="${escapeHtml(bilData[id]||'')}" oninput="bilData['${id}']=this.value">`;}
// ⚠ UNE DATE DE NAISSANCE, PAS UN AGE. « 26 » saisi une fois reste 26 pour
// toujours : deux ans plus tard le metabolisme de base se calcule sur un age
// faux, et rien ne le signale — c'est la seule des quatre entrees du calcul
// qui se perime toute seule. La date, elle, ne bouge jamais.
//
// L'age est affiche EN REGARD, et se met a jour a la frappe : sans lui on
// saisit une date a l'aveugle, et une erreur de decennie ne se voit pas.
function bDate(id){
  const v=escapeHtml(bilData[id]||'');
  const a=bilData[id]?_ageRevolu(bilData[id]):null;
  return `<span style="display:inline-flex;align-items:center;gap:10px">`
    +`<input type="date" id="${id}" value="${v}" max="${_dateMaxNaissance()}"`
    +` oninput="bilData['${id}']=this.value;bMajAge('${id}')"`
    +` style="padding:6px 8px;font-size:var(--fs-sm);font-weight:700;margin:0;`
    +`background:var(--bg);border:1px solid var(--border);border-radius:var(--r-1);color:var(--text)">`
    +`<span id="${id}-age" style="font-size:var(--fs-xs);color:var(--sub);white-space:nowrap">`
    +(a!=null&&a>=0&&a<=120?(a+' ans'):'')+`</span></span>`;
}
function bMajAge(id){
  const z=document.getElementById(id+'-age');
  if(!z) return;
  const a=bilData[id]?_ageRevolu(bilData[id]):null;
  z.textContent=(a!=null&&a>=0&&a<=120)?(a+' ans'):'';
}
// La borne du selecteur natif : on ne nait pas demain, et un centenaire de
// plus de 120 ans releve de la faute de frappe.
function _dateMaxNaissance(){
  const d=new Date();
  return (d.getFullYear()-10)+'-12-31';
}
function bTA(id,ph){return`<textarea id="${id}" rows="3" placeholder="${ph||''}" oninput="bilData['${id}']=this.value" style="resize:none">${escapeHtml(bilData[id]||'')}</textarea>`;}
// R35 — LE LIBELLE D'UN CHOIX PEUT DIFFERER DE SA VALEUR. bC enregistre la
// chaine du choix telle quelle, et d'autres calculs la comparent (le type de
// diete relu par saveBilanFinal, par exemple) : corriger un libelle en
// reecrivant la chaine aurait change la valeur stockee et laisse les anciens
// bilans sans correspondance. La valeur ne bouge donc pas ; seul l'affichage
// passe par cette table, dans le questionnaire comme dans la lecture des
// reponses (_texteReponseLue). Anciens et nouveaux bilans se lisent pareil.
const BIL_CHOIX_LIBELLES=Object.freeze({
  'deb-location':Object.freeze({'Park de Street Workout':'Parc de street workout'}),
  'deb-nutrition-type':Object.freeze({
    'Diet strict : Plan alimentaire détaillé avec quantités précises':'Diète stricte : ton coach compose ton plan, repas par repas',
    'Diet flexible : Conseils personnalisés + calcul via application':'Diète flexible : tu fixes tes macros et tu manges ce que tu veux dans ces limites'})
});
function _libelleChoix(gid,val){
  const t=Object.prototype.hasOwnProperty.call(BIL_CHOIX_LIBELLES,gid)?BIL_CHOIX_LIBELLES[gid]:null;
  return (t&&typeof val==='string'&&Object.prototype.hasOwnProperty.call(t,val))?t[val]:val;
}
// Le texte d'une reponse tel qu'on le LIT, pour la question `k` : les choix
// renommes y prennent leur libelle actuel. Les calculs, eux, continuent de
// lire la valeur brute par _texteReponse.
function _texteReponseLue(k,val){
  return _texteReponse(Array.isArray(val)?val.map(v=>_libelleChoix(k,v)):_libelleChoix(k,val));
}
function bC(gid,choices,multi){
  return choices.map(c=>`<div class="choice-opt${bilData[gid]&&(multi?bilData[gid].includes(c):bilData[gid]===c)?' sel':''}" data-grp="${gid}" data-val="${c}" onclick="pickBilChoice('${gid}',this.dataset.val,${!!multi})" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">${_libelleChoix(gid,c)}</div>`).join('');
}
// Échelle d'émojis néon — visages SVG au trait (rendu identique sur tous les appareils)
// Mêmes valeurs stockées que bC (compat stats coach)
const BEMO_FACES={
  // très content : yeux plissés de joie + grand sourire
  happy2:'<path d="M14.5,20.5 Q18.5,15.5 22.5,20.5"/><path d="M25.5,20.5 Q29.5,15.5 33.5,20.5"/><path d="M14,28 Q24,39 34,28"/>',
  // content : sourire simple
  happy:'<circle cx="17" cy="20" r="1.9" class="emo-dot"/><circle cx="31" cy="20" r="1.9" class="emo-dot"/><path d="M16,29 Q24,36 32,29"/>',
  // neutre : bouche droite
  neutral:'<circle cx="17" cy="20" r="1.9" class="emo-dot"/><circle cx="31" cy="20" r="1.9" class="emo-dot"/><path d="M16.5,30.5 L31.5,30.5"/>',
  // contrarié : bouche vers le bas
  sad:'<circle cx="17" cy="21" r="1.9" class="emo-dot"/><circle cx="31" cy="21" r="1.9" class="emo-dot"/><path d="M16,33 Q24,26.5 32,33"/>',
  // furieux : sourcils froncés + bouche très tombante
  angry:'<path d="M12.5,16 L20,19.5"/><path d="M35.5,16 L28,19.5"/><circle cx="17.5" cy="23" r="1.9" class="emo-dot"/><circle cx="30.5" cy="23" r="1.9" class="emo-dot"/><path d="M16,34 Q24,27 32,34"/>'
};
function bEmojiScale(gid,opts){
  return `<div class="emo-row">`+opts.map(o=>{
    const inner=o.svg||('<circle cx="24" cy="24" r="20"/>'+BEMO_FACES[o.f]);
    return `<div class="emo-opt${bilData[gid]===o.v?' sel':''}" data-grp="${gid}" data-val="${o.v}" style="--eo:${o.c};--eo-glow:${o.c}55" onclick="pickBilChoice('${gid}',this.dataset.val,false)" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">`+
    `<svg class="emo" viewBox="0 0 48 48" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`+
    `<span class="emo-lbl">${o.l||o.v}</span></div>`;}).join('')+`</div>`;
}
// Icônes intensité (flammes) et hydratation (verres à niveau)
const BICON={
  flame1:'<path d="M24,16 C20.5,20.5 17,24.5 17,29 a7,7 0 0 0 14,0 C31,24.5 27.5,20.5 24,16 Z"/>',
  flame2:'<path d="M19.5,12 C16,17 12.5,21.5 12.5,26.5 a7,7 0 0 0 14,0 C26.5,21.5 23,17 19.5,12 Z"/><path d="M32.5,21 C30.5,23.8 28.5,26 28.5,28.8 a4,4 0 0 0 8,0 C36.5,26 34.5,23.8 32.5,21 Z"/>',
  flame3:'<path d="M24,7 C20,13 15.5,18.5 15.5,25 a8.5,8.5 0 0 0 17,0 C32.5,18.5 28,13 24,7 Z"/><path d="M24,19 C22,21.5 21,23.5 21,26 a3,3 0 0 0 6,0 C27,23.5 26,21.5 24,19 Z" class="emo-dot"/><path d="M10.5,23 C9,25 7.5,26.5 7.5,28.5 a3.2,3.2 0 0 0 6.4,0 C13.9,26.5 12.5,25 10.5,23 Z"/><path d="M37.5,23 C36,25 34.5,26.5 34.5,28.5 a3.2,3.2 0 0 0 6.4,0 C40.9,26.5 39.5,25 37.5,23 Z"/>',
  glass:(lvl)=>`<path d="M15,8 L15,39 a5,5 0 0 0 5,5 h8 a5,5 0 0 0 5,-5 L33,8"/><path d="M13,8 L35,8"/><path d="M18.5,${lvl} h11 v${38.2-lvl<0?0:38.2-lvl} a3.6,3.6 0 0 1 -3.6,3.6 h-3.8 a3.6,3.6 0 0 1 -3.6,-3.6 Z" class="emo-dot" stroke="none"/>`
};
// Choix Homme/Femme — cartes avec les silhouettes du schéma de mensurations
function bGenderCards(gid){
  const opts=[{v:'Homme',b:BSCH_M},{v:'Femme',b:BSCH_F}];
  return `<div class="gsl-row">`+opts.map(o=>
    `<div class="gsl-opt${bilData[gid]===o.v?' sel':''}" data-grp="${gid}" data-val="${o.v}" onclick="pickBilChoice('${gid}',this.dataset.val,false)" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">`+
    `<svg viewBox="0 48 360 484" preserveAspectRatio="xMidYMid meet"><path class="gsl-body" d="${o.b.body}" fill-rule="evenodd"/></svg>`+
    `<div class="gsl-lbl">${o.v.toUpperCase()}</div></div>`).join('')+`</div>`;
}
// Curseur néon 1-10 — stocke "X/10" (affiché tel quel côté coach)
const BSL_COLORS=[ROUGE_MARQUE,'#ef4116','#f97316','#fb9d1e','#eab308','#c9d411','#a3e635','#67dd2f','#3ad348','#22c55e'];
const BSL_LABELS=['À plat','Très faible','En baisse','Fragile','Moyenne','Correcte','Bonne','Très bonne','Excellente','EN FEU !'];
// Poses de reference pour les photos de progression (extraites du visuel "LES PHOTOS")
const BPOSE={
  face:'data:image/png;base64,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',
  back:'data:image/png;base64,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',
  side:'data:image/png;base64,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'
};
// Meme visuel, version femme : les trois silhouettes du « LES PHOTOS » feminin
// du coach, decoupees de la meme facon et a la meme hauteur que celles du
// jeu masculin. Le bandeau de legende qui barrait les tibias a ete enjambe,
// et les gris ont ete posterises — a 118 px, la plus grande taille ou l'app
// les affiche, ca ne se voit pas, et le poids reste celui du jeu masculin.
const BPOSE_F={
  face:'data:image/png;base64,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',
  back:'data:image/png;base64,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',
  side:'data:image/png;base64,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'
};
// Poses selon le genre. Le questionnaire de depart fait foi quand il porte la
// reponse — un athlete remplit son premier bilan avant que son profil ne soit
// complet — sinon on retombe sur le profil. Meme regle que bBodySchema, pour
// que le schema de mensurations et les poses photo ne se contredisent jamais.
function posesGenre(prefix){
  let femme;
  if(prefix==='deb'&&bilData['deb-gender']) femme=bilData['deb-gender']==='Femme';
  else femme=isFemale(currentUser&&(currentUser._evol_gender||currentUser.gender));
  return femme?BPOSE_F:BPOSE;
}
// 3 cartes photo avec personnage neon : la pose a reproduire est montree au-dessus du bouton
