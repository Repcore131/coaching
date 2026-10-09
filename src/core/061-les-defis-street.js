// ══ LES DÉFIS STREET (build 1956) ═════════════════════════════════════════
// Sept formats de défis de rue, branchés sur ce qui existe déjà :
//   solo     le record personnel (u.defisStreet, synchronisé avec le dossier) ;
//   équipe   un seul téléphone chronomètre tout le monde, et le chrono
//            s'arrête quand le DERNIER finit ;
//   battle   un duel existant (chunk 011, cloudflare/src/duels.js) dont la
//            mesure porte le format : « street_the100 ». Chacun pose son
//            meilleur essai dans duels/<id>/street/<sa clé>, le Worker compare.
// La vidéo est facultative (sauf « videoRequise ») : lue SUR LE TÉLÉPHONE par
// le motion-lab, elle compte les tractions propres (amplitude, sans kipping :
// arbreRepsPropresVideo, chunk 060) et donne le statut « certifié ».
//
// ⚠ CONTENU DE TRAVAIL À VALIDER PAR KEVIN : seul « The 100 » vient de la
//   demande (100 dips + 100 tractions + 100 pompes, au temps, découpage
//   libre). Les six autres définitions (étapes, règles) sont des propositions
//   de travail, marquées `travail:true`, à remplacer par les siennes.

/** Les exercices d'un défi : le libellé, et si la vidéo sait les lire. */
const STREET_EXOS=Object.freeze({
  traction:Object.freeze({lib:'tractions',video:true}),
  dips:Object.freeze({lib:'dips',video:false}),
  pompe:Object.freeze({lib:'pompes',video:false}),
  squat:Object.freeze({lib:'squats',video:false}),
  releve:Object.freeze({lib:'relevés de jambes',video:false}),
  burpee:Object.freeze({lib:'burpees',video:false})
});
// Un temps plus court que 0,6 s par répétition n'est pas humain.
const STREET_S_PAR_REP_MIN=0.6;
const STREET_SCORE_MAX=100000;
const STREET_ESSAIS_MAX=30;
const STREET_EQUIPE_MIN=2, STREET_EQUIPE_MAX=10;
const _etape=(exo,reps)=>Object.freeze({exo,reps});
const _format=(o)=>Object.freeze(Object.assign({},o,{etapes:Object.freeze(o.etapes),regles:Object.freeze(o.regles)}));
/**
 * Les sept formats. Chacun : {cle, nom, etapes[{exo, reps}], scoring
 * 'temps'|'reps', regles[], videoRequise, tempsMax (s), travail?}.
 * En « reps », l'unique étape a reps:0 : le maximum.
 */
const FORMATS_DEFIS=Object.freeze({
  the100:_format({cle:'the100',nom:'The 100',scoring:'temps',videoRequise:false,tempsMax:7200,
    etapes:[_etape('dips',100),_etape('traction',100),_etape('pompe',100)],
    regles:['Découpage libre : fractionne comme tu veux, dans l’ordre que tu veux.',
      'Une répétition incomplète ne compte pas : elle se refait.',
      'Le chrono tourne du départ à la dernière répétition, repos compris.']}),
  pharaon:_format({cle:'pharaon',nom:'Pharaon',scoring:'temps',videoRequise:false,tempsMax:7200,travail:true,
    etapes:[_etape('traction',55),_etape('dips',55),_etape('pompe',55)],
    regles:['Tours descendants de 10 à 1 : 10 tractions, 10 dips, 10 pompes, puis 9, 9, 9… jusqu’à 1.',
      'Chaque tour dans l’ordre, sans découper un tour.',
      'Chrono continu, repos compris.']}),
  demiBBR:_format({cle:'demiBBR',nom:'Demi-BBR',scoring:'temps',videoRequise:false,tempsMax:5400,travail:true,
    etapes:[_etape('traction',50),_etape('dips',50),_etape('pompe',50),_etape('squat',50)],
    regles:['Découpage libre, dans l’ordre des étapes.',
      'Une répétition incomplète ne compte pas.',
      'Chrono continu, repos compris.']}),
  onTheBar:_format({cle:'onTheBar',nom:'On the bar',scoring:'reps',videoRequise:true,tempsMax:1800,travail:true,
    etapes:[_etape('traction',0)],
    regles:['Le maximum de tractions sans lâcher la barre.',
      'Départ bras tendus, menton au-dessus de la barre à chaque répétition.',
      'Pas de kipping : une répétition avec élan ne compte pas.',
      'Vidéo obligatoire : elle compte les répétitions propres.']}),
  special6:_format({cle:'special6',nom:'Spécial 6',scoring:'temps',videoRequise:false,tempsMax:5400,travail:true,
    etapes:[_etape('traction',30),_etape('dips',30),_etape('pompe',60),_etape('squat',90),_etape('releve',30),_etape('burpee',30)],
    regles:['3 tours de 6 exercices : 10 tractions, 10 dips, 20 pompes, 30 squats, 10 relevés de jambes, 10 burpees.',
      'Chaque tour dans l’ordre.',
      'Chrono continu, repos compris.']}),
  super10:_format({cle:'super10',nom:'Super 10',scoring:'temps',videoRequise:false,tempsMax:5400,travail:true,
    etapes:[_etape('traction',100),_etape('dips',100),_etape('pompe',100)],
    regles:['10 tours de 10 tractions, 10 dips, 10 pompes.',
      'Chaque tour dans l’ordre, sans découper un tour.',
      'Chrono continu, repos compris.']}),
  deathPyramid:_format({cle:'deathPyramid',nom:'Death pyramid',scoring:'temps',videoRequise:false,tempsMax:5400,travail:true,
    etapes:[_etape('traction',100)],
    regles:['Pyramide de tractions : 1, 2, 3… 10, puis 9, 8… 1.',
      'Chaque palier d’un seul tenant, sans lâcher la barre.',
      'Repos libre entre les paliers, chrono continu.']})
});
const FORMATS_DEFIS_CLES=Object.freeze(Object.keys(FORMATS_DEFIS));

/** PURE. Le format, depuis sa clé ou l'objet lui-même ; null s'il est inconnu. */
function formatDefi(f){
  if(f&&typeof f==='object') return FORMATS_DEFIS[f.cle]===f?f:null;
  return Object.prototype.hasOwnProperty.call(FORMATS_DEFIS,String(f))?FORMATS_DEFIS[String(f)]:null;
}
/** PURE. Combien de tractions le format demande (la vidéo n'en lit pas d'autre). */
function formatTractions(f){
  const x=formatDefi(f); if(!x) return 0;
  return x.etapes.filter(e=>e.exo==='traction').reduce((s,e)=>s+e.reps,0);
}
/** PURE. Un score lisible : « 12:34 », « 23 rép. ». */
function texteScoreStreet(f,v){
  const x=formatDefi(f), n=Number(v)||0;
  if(!(n>0)) return 'pas de score';
  if(x&&x.scoring==='reps') return Math.round(n)+' rép.';
  const s=Math.round(n); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
}
/** PURE. Le meilleur de deux scores (0 ou absent : jamais meilleur). */
function streetMeilleur(f,a,b){
  const x=formatDefi(f), A=Number(a)||0, B=Number(b)||0;
  if(!(A>0)) return B>0?B:0;
  if(!(B>0)) return A;
  return x&&x.scoring==='reps'?Math.max(A,B):Math.min(A,B);
}
/**
 * PURE. Le score d'un essai.
 * @param {string|object} format
 * @param {{temps?:number, reps?:number[], video?:any}} saisies
 *   temps : secondes (format au temps) ; reps : une valeur par étape (faites) ;
 *   video : les mesures du motion-lab (mlTestCompatVideo), facultatives.
 * @returns {{score:number, valide:boolean, certifie:boolean, statut:'certifie'|'valide'|'invalide', raisons:string[]}}
 */
function scoreDefi(format,saisies){
  const f=formatDefi(format);
  const raisons=[];
  const fin=(score,valide,certifie)=>({score:valide?score:0,valide,certifie:!!(valide&&certifie),
    statut:valide?(certifie?'certifie':'valide'):'invalide',raisons});
  if(!f){ raisons.push('Format inconnu.'); return fin(0,false,false); }
  const s=(saisies&&typeof saisies==='object')?saisies:{};
  const reps=Array.isArray(s.reps)?s.reps.map(x=>Math.max(0,Math.floor(Number(x)||0))):[];
  let score=0, valide=true;
  if(f.scoring==='temps'){
    const t=Number(s.temps);
    if(!(isFinite(t)&&t>0)){ raisons.push('Le chrono n’a pas de temps.'); valide=false; }
    else if(t>f.tempsMax){ raisons.push('Plus de '+Math.round(f.tempsMax/60)+' minutes : l’essai est hors délai.'); valide=false; }
    f.etapes.forEach((e,i)=>{
      const fait=reps[i]||0;
      if(fait<e.reps){ raisons.push('Il manque '+(e.reps-fait)+' '+STREET_EXOS[e.exo].lib+'.'); valide=false; }
    });
    const total=f.etapes.reduce((a,e)=>a+e.reps,0);
    if(valide&&t<total*STREET_S_PAR_REP_MIN){ raisons.push('Temps impossible pour '+total+' répétitions.'); valide=false; }
    score=valide?Math.round(t*10)/10:0;
  } else {
    score=reps[0]||0;
    if(!(score>=1)){ raisons.push('Aucune répétition saisie.'); valide=false; }
    if(score>1000){ raisons.push('Plus de 1000 répétitions : à vérifier.'); valide=false; }
  }
  // LA VIDÉO : seules les tractions se lisent. Il en faut autant de propres
  // que le format en demande (au temps) ou que l'essai en déclare (aux reps).
  let certifie=false;
  const besoin=f.scoring==='reps'?score:formatTractions(f);
  if(s.video&&besoin>0){
    const r=arbreRepsPropresVideo(s.video,ARBRE_AMPLITUDE_PROPRE);
    if(r.vis<COMPAT_VIS_MIN) raisons.push('Vidéo : le corps n’est pas assez visible.');
    else if(r.n<besoin) raisons.push('Vidéo : '+r.n+' traction'+(r.n>1?'s':'')+' propre'+(r.n>1?'s':'')+' sur '+besoin+(r.raisons.length?' ('+r.raisons.join(', ')+')':'')+'.');
    else certifie=true;
  }
  if(f.videoRequise&&!certifie){
    if(!s.video) raisons.push('Vidéo obligatoire pour ce format.');
    valide=false;
  }
  return fin(score,valide,certifie);
}
/**
 * PURE. Le score d'une équipe : chaque membre fait le format entier ; au
 * temps, le chrono s'arrête quand le DERNIER finit (le plus long des temps) ;
 * aux répétitions, elles s'additionnent. Un membre sans essai valide rend
 * l'équipe incomplète : pas de score.
 * @param {string|object} format
 * @param {{nom:string, temps?:number, reps?:number[]}[]} membres
 */
function scoreEquipe(format,membres){
  const f=formatDefi(format);
  const raisons=[];
  if(!f) return {score:0,valide:false,raisons:['Format inconnu.'],membres:[]};
  const l=Array.isArray(membres)?membres:[];
  // Un format filmé ne se joue pas en équipe : un téléphone ne filme pas dix barres.
  if(f.videoRequise) return {score:0,valide:false,raisons:['Format filmé : pas de mode équipe.'],membres:[]};
  if(l.length<STREET_EQUIPE_MIN) raisons.push('Une équipe, c’est au moins '+STREET_EQUIPE_MIN+' membres.');
  if(l.length>STREET_EQUIPE_MAX) raisons.push('Une équipe, c’est '+STREET_EQUIPE_MAX+' membres au plus.');
  const res=l.map(m=>Object.assign({nom:String((m&&m.nom)||'').slice(0,24)},scoreDefi(f,{temps:m&&m.temps,reps:m&&m.reps})));
  const manquants=res.filter(r=>!r.valide);
  if(manquants.length) raisons.push('Équipe incomplète : '+manquants.map(r=>r.nom||'un membre').join(', ')+' n’'+(manquants.length>1?'ont':'a')+' pas fini.');
  const valide=!raisons.length;
  let score=0;
  if(valide) score=f.scoring==='reps'?res.reduce((a,r)=>a+r.score,0):Math.max(...res.map(r=>r.score));
  return {score,valide,raisons,membres:res};
}
// ── Le dossier : records et derniers essais ──────────────────────────────────
/** PURE. L'état street du dossier, nettoyé. */
function defisStreetEtat(u){
  const x=(u&&u.defisStreet&&typeof u.defisStreet==='object')?u.defisStreet:{};
  const rec=(x.records&&typeof x.records==='object')?x.records:{};
  const records={};
  for(const k of FORMATS_DEFIS_CLES){
    const r=rec[k]; if(!r||typeof r!=='object') continue;
    const o={};
    if(r.solo&&Number(r.solo.score)>0) o.solo=r.solo;
    if(r.equipe&&Number(r.equipe.score)>0) o.equipe=r.equipe;
    if(o.solo||o.equipe) records[k]=o;
  }
  const essais=(Array.isArray(x.essais)?x.essais:Object.values(x.essais||{})).filter(e=>e&&formatDefi(e.f)&&Number(e.score)>0);
  return {records,essais};
}
/**
 * PURE (sur u). Range un essai VALIDE : le record du mode s'il est battu, et
 * l'essai dans les derniers (30). Les bornes sont celles des règles.
 * @returns {{ok:boolean, record:boolean, raison?:string}}
 */
function defiStreetEnregistrer(u,format,mode,res,t){
  const f=formatDefi(format);
  if(!u||!f) return {ok:false,record:false,raison:'Format inconnu.'};
  if(['solo','equipe','battle'].indexOf(mode)<0) return {ok:false,record:false,raison:'Mode inconnu.'};
  if(!res||!res.valide||!(res.score>0)||res.score>STREET_SCORE_MAX) return {ok:false,record:false,raison:'Essai non valide.'};
  const at=Number(t)||Date.now();
  const e=defisStreetEtat(u);
  const essai={f:f.cle,mode,score:res.score,at,certifie:!!res.certifie};
  const nm=Math.floor(Number(res.membres)||0);
  if(mode==='equipe'){ if(nm<STREET_EQUIPE_MIN||nm>STREET_EQUIPE_MAX) return {ok:false,record:false,raison:'Équipe hors bornes.'}; essai.membres=nm; }
  const champ=mode==='equipe'?'equipe':'solo';
  const avant=e.records[f.cle]&&e.records[f.cle][champ];
  const record=!avant||streetMeilleur(f,avant.score,res.score)!==Number(avant.score);
  if(record){
    const r=Object.assign({},e.records[f.cle]||{});
    r[champ]=champ==='equipe'?{score:res.score,at,membres:nm}:{score:res.score,at,certifie:!!res.certifie};
    e.records[f.cle]=r;
  }
  e.essais.push(essai);
  u.defisStreet={records:e.records,essais:e.essais.slice(-STREET_ESSAIS_MAX)};
  return {ok:true,record};
}
/** PURE. Le record solo d'un format, ou null. */
function recordStreet(u,format){
  const f=formatDefi(format); if(!f) return null;
  const r=defisStreetEtat(u).records[f.cle];
  return (r&&r.solo)||null;
}
// ── Le classement ────────────────────────────────────────────────────────────
/** PURE. /classements_street/<format> → [{pseudo, score, certifie, rang}], du meilleur au moins bon. */
function classementStreet(format,brut){
  const f=formatDefi(format); if(!f) return [];
  const l=Object.keys(brut||{}).map(p=>({pseudo:amiPseudoDeCle(p),score:Number(brut[p]&&brut[p].score)||0,certifie:!!(brut[p]&&brut[p].certifie),at:Number(brut[p]&&brut[p].at)||0}))
    .filter(x=>x.score>0&&x.score<=STREET_SCORE_MAX);
  l.sort((a,b)=>(f.scoring==='reps'?b.score-a.score:a.score-b.score)||(b.certifie-a.certifie)||(a.at-b.at));
  let rang=0, prec=null;
  l.forEach((x,i)=>{ if(x.score!==prec){ rang=i+1; prec=x.score; } x.rang=rang; });
  return l;
}
async function lireClassementStreet(format){
  const f=formatDefi(format); if(!f||!CLOUD.ok()) return null;
  try{
    const token=await CLOUD._getToken(); if(!token) return null;
    const q='&orderBy=%22score%22&'+(f.scoring==='reps'?'limitToLast':'limitToFirst')+'=50';
    const r=await fetch(CLOUD._fbUrl.replace('users.json','classements_street/'+f.cle+'.json')+'?auth='+token+q);
    return r.ok?classementStreet(f,await r.json()):null;
  }catch(e){ return null; }
}
/** Publie le record solo sous le pseudo public (opt-in, un geste). */
async function publierClassementStreet(format){
  const f=formatDefi(format), u=currentUser;
  const rec=recordStreet(u,f), mp=_monPseudo(u);
  if(!f||!rec) return false;
  if(!mp){ toast('Choisis d’abord ton nom public dans Mon profil.','var(--orange)'); return false; }
  const ok=await CLOUD.racinePatch({['classements_street/'+f.cle+'/'+pseudoPublicCle(mp)]:{score:Number(rec.score),at:Number(rec.at)||Date.now(),certifie:!!rec.certifie}}).catch(()=>false);
  toast(ok?'Ton record est au classement.':'Publication impossible pour l’instant.',ok?'var(--green)':'var(--orange)');
  if(ok) ouvrirFormatStreet(f.cle);
  return ok;
}

// ══ L'ÉCRAN : LA GALERIE ════════════════════════════════════════════════════
function ouvrirDefisStreet(){
  rendreDefisStreet();
  go('s-defis-street');
  return true;
}
/** PURE. Les étapes en une ligne : « 100 dips · 100 tractions · 100 pompes ». */
function etapesTexte(f){
  const x=formatDefi(f); if(!x) return '';
  return x.etapes.map(e=>(e.reps?e.reps+' ':'max ')+STREET_EXOS[e.exo].lib).join(' · ');
}
/** PURE. La galerie des formats, avec le record de chacun. */
function htmlGalerieStreet(u){
  return '<div class="ds-galerie">'+FORMATS_DEFIS_CLES.map(k=>{
    const f=FORMATS_DEFIS[k], r=recordStreet(u,f);
    return '<button type="button" class="ds-carte" data-format="'+k+'" onclick="ouvrirFormatStreet('+jsArg(k)+')">'
      +'<span class="ds-nom">'+escapeHtml(f.nom)+'</span>'
      +'<span class="ds-etapes">'+escapeHtml(etapesTexte(f))+'</span>'
      +'<span class="ds-pied"><span class="ds-tag">'+(f.scoring==='temps'?'au temps':'aux répétitions')+'</span>'
      +(f.videoRequise?'<span class="ds-tag ds-video">vidéo requise</span>':'')
      +(r?'<span class="ds-record">Record '+escapeHtml(texteScoreStreet(f,r.score))+(r.certifie?' '+icon('check',12):'')+'</span>':'')+'</span>'
      +'</button>';
  }).join('')+'</div>';
}
function rendreDefisStreet(){
  const z=document.getElementById('ds-contenu'); if(!z) return false;
  z.innerHTML='<p class="sub ds-intro">Sept formats de rue. Seul, en équipe, ou en battle contre un pote : choisis, lance le chrono.</p>'
    +htmlGalerieStreet(currentUser);
  return true;
}
/** La fiche d'un format : étapes, règles, les trois modes, le classement. */
function ouvrirFormatStreet(cle){
  const f=formatDefi(cle); if(!f) return false;
  const E=escapeHtml, r=recordStreet(currentUser,f);
  closeModal();
  document.body.insertAdjacentHTML('beforeend',
    '<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="ds-f-t" class="ds-fiche">'
    +'<div class="ds-fiche-t" id="ds-f-t">'+E(f.nom)+'</div>'
    +'<div class="ds-etapes">'+E(etapesTexte(f))+' · '+(f.scoring==='temps'?'score au temps':'score aux répétitions')+'</div>'
    +'<ul class="ds-regles">'+f.regles.map(x=>'<li>'+E(x)+'</li>').join('')+'</ul>'
    +(r?'<div class="ds-rec">Ton record : <b>'+E(texteScoreStreet(f,r.score))+'</b>'+(r.certifie?' · certifié en vidéo':'')+'</div>':'')
    +'<div class="ds-modes">'
    +'<button type="button" class="btn btn-red" onclick="ouvrirChronoStreet('+jsArg(f.cle)+',\'solo\')">Solo</button>'
    +(f.videoRequise?'':'<button type="button" class="btn btn-outline" onclick="ouvrirEquipeStreet('+jsArg(f.cle)+')">En équipe</button>')
    +'<button type="button" class="btn btn-outline" onclick="lancerBattleStreet('+jsArg(f.cle)+',this)">Battle</button></div>'
    +'<div class="ds-lab">Classement</div><div id="ds-classement" class="ds-classement"><p class="sub">Chargement…</p></div>'
    +(r?'<button type="button" class="rb-lien" onclick="publierClassementStreet('+jsArg(f.cle)+')">Publier mon record au classement</button>':'')
    +'</div></div>');
  lireClassementStreet(f).then(l=>{
    const z=document.getElementById('ds-classement'); if(!z) return;
    z.innerHTML=htmlClassementStreet(f,l,_monPseudo(currentUser));
  });
  return true;
}
/** PURE. Le classement rendu ; `moi` en surbrillance. */
function htmlClassementStreet(f,l,moi){
  if(l==null) return '<p class="sub">Classement indisponible hors connexion.</p>';
  if(!l.length) return '<p class="sub">Personne encore : sois le premier à publier ton record.</p>';
  return '<ol class="ds-cl">'+l.slice(0,50).map(x=>'<li class="'+(moi&&x.pseudo===moi?'moi':'')+'"><span class="ds-rang">'+x.rang+'</span>'
    +'<span class="ds-ps">@'+escapeHtml(x.pseudo)+'</span><span class="ds-sc">'+escapeHtml(texteScoreStreet(f,x.score))+(x.certifie?' '+icon('check',12):'')+'</span></li>').join('')+'</ol>';
}
/** Le battle : un duel au format street, lien à envoyer (chunk 011). */
async function lancerBattleStreet(cle,btn){
  const f=formatDefi(cle); if(!f) return false;
  if(btn) btn.disabled=true;
  const garde=duelsGardeFou(_duelsEnCours());
  if(garde){ toast(garde,'var(--orange)'); if(btn) btn.disabled=false; return false; }
  const r=await creerDuel('street_'+f.cle,7);
  if(btn) btn.disabled=false;
  if(!r.ok){ toast(r.erreur,'var(--orange)'); return false; }
  closeModal();
  toast('Battle '+f.nom+' créé : envoie le lien à ton pote. 7 jours pour poser vos essais.','var(--green)',5000);
  envoyerDuel(r.id,null);
  return true;
}

// ══ LE CHRONO PLEIN ÉCRAN ═══════════════════════════════════════════════════
// _chsEtat : {f, mode, duel?, depart, fin, membres:[{nom, fin}], faits:[n], minuteur}
let _chsEtat=null;
function _chsArreter(){ if(_chsEtat&&_chsEtat.minuteur){ clearInterval(_chsEtat.minuteur); _chsEtat.minuteur=null; } }
function _chsPleinEcran(oui){
  try{
    if(oui&&document.documentElement.requestFullscreen&&!document.fullscreenElement){ const p=document.documentElement.requestFullscreen(); if(p&&p.catch) p.catch(()=>{}); }
    if(!oui&&document.fullscreenElement&&document.exitFullscreen){ const p=document.exitFullscreen(); if(p&&p.catch) p.catch(()=>{}); }
  }catch(e){}
}
function quitterChronoStreet(){
  _chsArreter(); _chsPleinEcran(false);
  _chsEtat=null;
  retourDe('s-chrono-street','s-defis-street');
  return true;
}
/** PURE. « 12:34,5 » : le chrono à la dixième. */
function chronoTexte(ms){
  const d=Math.max(0,Math.floor(Number(ms)/100)||0), s=Math.floor(d/10);
  return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')+','+(d%10);
}
function ouvrirChronoStreet(cle,mode,duelId,membres){
  const f=formatDefi(cle); if(!f) return false;
  closeModal();
  _chsArreter();
  const m=mode==='equipe'?'equipe':(mode==='battle'?'battle':'solo');
  _chsEtat={f:f.cle,mode:m,duel:m==='battle'?String(duelId||''):'',depart:0,fin:0,minuteur:null,
    membres:m==='equipe'?(Array.isArray(membres)?membres:String(membres||'').split(',')).map(n=>String(n).trim().slice(0,24)).filter(Boolean).map(nom=>({nom,fin:0})):[],
    faits:f.etapes.map(()=>0),res:null,video:null};
  rendreChronoStreet();
  go('s-chrono-street');
  return true;
}
function chsDemarrer(){
  if(!_chsEtat||_chsEtat.depart) return false;
  _chsEtat.depart=Date.now();
  _chsPleinEcran(true);
  try{ arcHaptique('finRepos'); }catch(e){}
  _chsEtat.minuteur=setInterval(_chsTic,100);
  rendreChronoStreet();
  return true;
}
function _chsTic(){
  const z=document.getElementById('chs-temps');
  if(!_chsEtat||!_chsEtat.depart||_chsEtat.fin) return _chsArreter();
  if(z) z.textContent=chronoTexte(Date.now()-_chsEtat.depart);
}
/** Une étape faite (solo, battle) : coche ou décoche. */
function chsEtape(i){
  if(!_chsEtat) return false;
  const f=formatDefi(_chsEtat.f), e=f.etapes[i]; if(!e) return false;
  _chsEtat.faits[i]=_chsEtat.faits[i]>=e.reps?0:e.reps;
  rendreChronoStreet();
  return true;
}
/** Un membre a fini (équipe) : le chrono s'arrête au dernier. */
function chsMembreFini(i){
  const s=_chsEtat; if(!s||!s.depart||s.fin) return false;
  const m=s.membres[i]; if(!m||m.fin) return false;
  m.fin=Date.now();
  if(s.membres.every(x=>x.fin)) return chsStop();
  rendreChronoStreet();
  return true;
}
function chsStop(){
  const s=_chsEtat; if(!s||!s.depart||s.fin) return false;
  s.fin=Date.now();
  _chsArreter(); _chsPleinEcran(false);
  try{ arcHaptique('finRepos'); }catch(e){}
  const f=formatDefi(s.f);
  if(f.scoring==='temps') _chsCalculer();
  rendreChronoStreet();
  return true;
}
/** Le score de l'essai, depuis l'état du chrono. */
function _chsCalculer(){
  const s=_chsEtat, f=formatDefi(s.f);
  const temps=(s.fin-s.depart)/1000;
  if(s.mode==='equipe'){
    const r=scoreEquipe(f,s.membres.map(m=>({nom:m.nom,temps:m.fin?(m.fin-s.depart)/1000:0,reps:m.fin?f.etapes.map(e=>e.reps):[]})));
    s.res=Object.assign({certifie:false,statut:r.valide?'valide':'invalide'},r,{membres:s.membres.length});
  } else {
    const reps=f.scoring==='reps'?[Math.floor(Number(s.repsSaisies)||0)]:s.faits;
    s.res=scoreDefi(f,{temps,reps,video:s.video});
  }
  return s.res;
}
function chsValiderReps(){
  const i=document.getElementById('chs-reps');
  if(!_chsEtat) return false;
  _chsEtat.repsSaisies=Math.max(0,Math.floor(Number(i&&i.value)||0));
  _chsCalculer();
  rendreChronoStreet();
  return true;
}
async function chsVideo(input){
  const fl=input&&input.files&&input.files[0];
  try{ if(input) input.value=''; }catch(e){}
  if(!fl||!_chsEtat) return false;
  toast('Analyse de la vidéo…','var(--sub)',2500);
  let r=null;
  try{
    await chargerMotionLab();
    if(typeof window.mlTestCompatVideo!=='function') throw new Error('indisponible');
    r=await window.mlTestCompatVideo(fl,'traction',{});
  }catch(e){ r={ok:false}; }
  if(!r||!r.ok){ toast('La vidéo n’a pas pu être lue.','var(--orange)'); return false; }
  _chsEtat.video=r.mesures;
  _chsCalculer();
  rendreChronoStreet();
  return true;
}
/** Range l'essai : dossier, et duel en battle. */
async function chsEnregistrer(btn){
  const s=_chsEtat; if(!s||!s.res||!s.res.valide||s.enregistre) return false;
  if(btn) btn.disabled=true;
  const r=defiStreetEnregistrer(currentUser,s.f,s.mode,s.res,s.fin);
  if(!r.ok){ toast(r.raison,'var(--orange)'); if(btn) btn.disabled=false; return false; }
  s.enregistre=true; s.record=r.record;
  saveUserOuDire('Ton essai');
  if(s.mode==='battle'&&s.duel) await _chsPoserBattle(s);
  rendreChronoStreet();
  toast(r.record?'Nouveau record : '+texteScoreStreet(s.f,s.res.score):'Essai enregistré.','var(--green)',5000,{lib:'Partager',fn:()=>partagerResultatStreet()});
  return true;
}
/** Le meilleur essai du battle, posé dans duels/<id>/street/<moi>. */
async function _chsPoserBattle(s){
  const id=s.duel; if(!DUEL_ID_RE.test(id)) return false;
  let d=_duelsCache[id]; try{ const x=await _duelLire(id); if(x){ d=x; _duelsCache[id]=x; } }catch(e){}
  const moi=_moiCle();
  const avant=d&&d.street&&d.street[moi];
  const best=streetMeilleur(s.f,avant&&avant.score,s.res.score);
  if(avant&&best===Number(avant.score)&&!(s.res.certifie&&!avant.certifie&&best===s.res.score)){ toast('Ton meilleur essai du battle reste '+texteScoreStreet(s.f,avant.score)+'.','var(--sub)'); return true; }
  const ok=await CLOUD.racinePatch({['duels/'+id+'/street/'+moi]:{score:s.res.score,at:Date.now(),certifie:!!s.res.certifie}}).catch(()=>false);
  if(!ok){ toast('Le battle n’a pas reçu ton score (fini, ou hors connexion).','var(--orange)'); return false; }
  deposerEvenement({type:'duel_maj',id}).catch(()=>{});
  return true;
}
function rendreChronoStreet(){
  const z=document.getElementById('chs-contenu'); if(!z) return false;
  const s=_chsEtat; if(!s){ z.innerHTML=''; return false; }
  const f=formatDefi(s.f), E=escapeHtml;
  const titre='<div class="chs-t">'+E(f.nom)+' · '+(s.mode==='equipe'?'en équipe':s.mode==='battle'?'battle':'solo')+'</div>';
  let h=titre;
  const ecoule=s.depart?((s.fin||Date.now())-s.depart):0;
  h+='<div class="chs-temps" id="chs-temps" role="timer" aria-live="off">'+chronoTexte(ecoule)+'</div>';
  if(!s.depart){
    h+='<div class="ds-etapes chs-c">'+E(etapesTexte(f))+'</div>'
      +'<button type="button" class="btn btn-red chs-go" onclick="chsDemarrer()">Partez</button>';
  } else if(!s.fin){
    if(s.mode==='equipe'){
      h+='<div class="chs-membres">'+s.membres.map((m,i)=>'<button type="button" class="chs-m'+(m.fin?' fini':'')+'" '+(m.fin?'disabled':'')+' onclick="chsMembreFini('+i+')">'
        +'<span>'+E(m.nom)+'</span><span>'+(m.fin?chronoTexte(m.fin-s.depart):'Fini')+'</span></button>').join('')+'</div>'
        +'<p class="sub chs-c">Le chrono s’arrête quand le dernier a fini.</p>'
        +'<button type="button" class="rb-lien" onclick="chsStop()">Arrêter (équipe incomplète)</button>';
    } else {
      if(f.scoring==='temps') h+='<div class="chs-etapes">'+f.etapes.map((e,i)=>'<button type="button" class="chs-e'+(s.faits[i]>=e.reps?' fait':'')+'" aria-pressed="'+(s.faits[i]>=e.reps)+'" onclick="chsEtape('+i+')">'
        +e.reps+' '+E(STREET_EXOS[e.exo].lib)+'</button>').join('')+'</div>';
      h+='<button type="button" class="btn btn-red chs-go" onclick="chsStop()">'+(f.scoring==='temps'?'Terminé':'J’ai lâché la barre')+'</button>';
    }
  } else if(f.scoring==='reps'&&!s.res){
    h+='<label for="chs-reps">Combien de tractions propres ?</label>'
      +'<input id="chs-reps" type="number" inputmode="numeric" min="0" max="1000" style="width:100%;margin:6px 0 12px">'
      +'<button type="button" class="btn btn-red chs-go" onclick="chsValiderReps()">Voir mon score</button>';
  } else if(s.res){
    const r=s.res;
    h+='<div class="chs-res chs-'+r.statut+'">'
      +'<div class="chs-score">'+(r.valide?E(texteScoreStreet(f,r.score)):'Non valide')+'</div>'
      +(r.valide?'<div class="chs-statut">'+(r.statut==='certifie'?'Certifié en vidéo':'Valide')+(s.record?' · nouveau record':'')+'</div>':'')
      +(r.raisons.length?'<ul class="chs-raisons">'+r.raisons.map(x=>'<li>'+E(x)+'</li>').join('')+'</ul>':'')
      +'</div>';
    if(s.mode!=='equipe'&&formatTractions(f)+(f.scoring==='reps'?1:0)>0&&!r.certifie&&!s.enregistre)
      h+='<label class="btn btn-outline chs-go" style="display:block;text-align:center">Certifier en vidéo'
        +'<input type="file" accept="video/*" capture="environment" hidden onchange="chsVideo(this)"></label>'
        +'<p class="sub chs-c">Filme les tractions de profil, à 3 m, barre et corps entier dans l’image. Lue sur ton téléphone, jamais envoyée.</p>';
    if(r.valide&&!s.enregistre) h+='<button type="button" class="btn btn-red chs-go" onclick="chsEnregistrer(this)">'+(s.mode==='battle'?'Poser mon score au battle':'Enregistrer')+'</button>';
    if(s.enregistre) h+='<button type="button" class="btn btn-red chs-go" onclick="partagerResultatStreet()">'+icon('share',16)+' <span>Partager en story</span></button>';
    h+='<button type="button" class="btn btn-outline chs-go" onclick="ouvrirChronoStreet('+jsArg(f.cle)+','+jsArg(s.mode)+','+jsArg(s.duel)+','+jsArg(s.membres.map(m=>m.nom))+')">Recommencer</button>';
  }
  z.innerHTML=h;
  return true;
}
// ── L'équipe : les prénoms avant le départ ───────────────────────────────────
function ouvrirEquipeStreet(cle){
  const f=formatDefi(cle); if(!f||f.videoRequise) return false;
  closeModal();
  const moi=String((currentUser&&(currentUser.fname||currentUser.pseudo))||'Moi').slice(0,24);
  document.body.insertAdjacentHTML('beforeend',
    '<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="ds-eq-t" class="ds-fiche">'
    +'<div class="ds-fiche-t" id="ds-eq-t">'+escapeHtml(f.nom)+' en équipe</div>'
    +'<p class="sub">Un prénom par ligne, '+STREET_EQUIPE_MIN+' à '+STREET_EQUIPE_MAX+'. Chacun fait le format entier ; ce téléphone chronomètre tout le monde.</p>'
    +'<label for="ds-eq">L’équipe</label><textarea id="ds-eq" rows="4" maxlength="260" style="width:100%">'+escapeHtml(moi)+'\n</textarea>'
    +'<div id="ds-eq-err" class="arb-err" hidden></div>'
    +'<button type="button" class="btn btn-red" style="width:100%;margin-top:10px" onclick="equipeStreetPartir('+jsArg(f.cle)+')">Au chrono</button>'
    +'</div></div>');
  return true;
}
/** PURE. Les prénoms d'une équipe, nettoyés ; {noms} ou {erreur}. */
function equipeStreetNoms(texte){
  const noms=String(texte||'').split(/\n|,/).map(x=>x.trim().slice(0,24)).filter(Boolean);
  if(noms.length<STREET_EQUIPE_MIN) return {erreur:'Il faut au moins '+STREET_EQUIPE_MIN+' prénoms.'};
  if(noms.length>STREET_EQUIPE_MAX) return {erreur:STREET_EQUIPE_MAX+' prénoms au plus.'};
  return {noms};
}
function equipeStreetPartir(cle){
  const r=equipeStreetNoms((document.getElementById('ds-eq')||{}).value);
  if(r.erreur){ const z=document.getElementById('ds-eq-err'); if(z){ z.textContent=r.erreur; z.hidden=false; } return false; }
  return ouvrirChronoStreet(cle,'equipe','',r.noms);
}
// ── La carte story du résultat ───────────────────────────────────────────────
function _dessinerCarteStreet(s,fond,format){
  const f=formatDefi(s.f), r=s.res;
  const F=visuelFormat(format), W=F.w, H=F.h;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const g=cv.getContext('2d');
  _visuelPeindreFond(g,W,H,fond||'transparent');
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif"), MONT="Montserrat,'Segoe UI',sans-serif";
  const o=_visuelOutils(g), cx=W/2, LARG=W-144;
  const rouge=fond==='rouge';
  g.textAlign='center'; g.textBaseline='alphabetic';
  let y=Math.round(H*0.3);
  o.ombre(true);
  g.fillStyle=rouge?'#fff':ROUGE_MARQUE; g.font='800 34px '+MONT;
  o.ecrireEspace((s.mode==='equipe'?'DÉFI STREET · ÉQUIPE':s.mode==='battle'?'DÉFI STREET · BATTLE':'DÉFI STREET'),cx,y,10,true);
  const t=String(f.nom).toUpperCase(), cs=o.ajuste(t,'700',180,BEBAS,LARG,90);
  g.fillStyle='#fff'; g.font='700 '+cs+'px '+BEBAS; o.ecrire(t,cx,y+40+cs*0.82);
  y+=40+cs*0.82+40;
  const sc=texteScoreStreet(f,r.score), cs2=o.ajuste(sc,'700',260,BEBAS,LARG,120);
  g.font='700 '+cs2+'px '+BEBAS; o.ecrire(sc,cx,y+cs2*0.82);
  y+=cs2*0.82+70;
  g.font='800 36px '+MONT;
  o.ecrireEspace(etapesTexte(f).toUpperCase(),cx,y,4,true);
  if(r.certifie){ g.fillStyle=rouge?'#fff':ROUGE_MARQUE; g.font='800 36px '+MONT; o.ecrireEspace('CERTIFIÉ EN VIDÉO',cx,y+70,8,true); }
  else if(s.record){ g.fillStyle=rouge?'#fff':ROUGE_MARQUE; g.font='800 36px '+MONT; o.ecrireEspace('RECORD PERSONNEL',cx,y+70,8,true); }
  o.ombre(false);
  return cv;
}
function partagerResultatStreet(){
  const s=_chsEtat;
  if(!s||!s.res||!s.res.valide||_storyEnCours) return false;
  const fond=visuelFondEffectif(), fmt=visuelFondFormat(fond), nom=visuelNomFichier('repcore-street',fond);
  _storyEnCours=true;
  let ok=false;
  try{ ok=_storySortirPartage(_dessinerCarteStreet(s,fond),nom,undefined,fmt)||_storySortirTelechargement(_dessinerCarteStreet(s,fond),nom,fmt); }
  catch(e){ toast('Partage impossible : '+((e&&e.message)||'erreur'),'var(--orange)'); ok=false; }
  finally{ _storyEnCours=false; }
  return ok;
}
