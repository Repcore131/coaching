// ══ LA CARTE D'ATHLÈTE (28/09/2026) ═════════════════════════════════════
//
// Cinq notes de 1 à 99, calculées sur les 12 DERNIÈRES SEMAINES COMPLÈTES
// (lundi à dimanche), et une note globale :
//   FOR  la force — l'e1RM des mouvements de base (squat, développé couché,
//        soulevé de terre, développé militaire) RAPPORTÉ AU POIDS DE CORPS,
//        chacun comparé à son barème (homme / femme) ;
//   VOL  le volume — les séries faites par semaine ;
//   REG  la régularité — les semaines validées (le quota du programme) ;
//   PRO  la progression — l'e1RM de la seconde moitié contre la première ;
//   END  l'endurance — le temps d'entraînement par semaine.
// LA GLOBALE PÈSE D'ABORD REG ET PRO : la carte récompense ce que l'athlète
// maîtrise (venir, progresser) avant ce que la génétique lui a donné.
//
// LA COURBE EST DOUCE : note = 1 + 98 × (1 − e^(−1,6·x)), où x vaut 1 au
// niveau « avancé » du barème. x = 1 donne 79, x = 1,5 donne 90, x = 2 donne
// 95 : passer 90 demande une fois et demie la référence. Jamais 100.
//
// RECALCULÉE LE LUNDI (majCarteAthlete, à l'ouverture de l'accueil) : une
// note par semaine, gardée dans u.carteHist. Si elle monte, la carte
// s'affiche sur l'accueil avec son partage ; si elle change de cadre, la
// foudre frappe.
//
// ⚠ LE POIDS DE CORPS ENTRE DANS FOR : la carte est classée « santé »
//   (CHAMPS_SANTE), comme tout ce qui en dérive. La note, elle, ne dit
//   jamais le poids.
const CARTE_SEMAINES=12;
const CARTE_K=1.6;
// L'e1RM, en multiples du poids de corps, qui vaut x = 1 (niveau avancé).
const CARTE_BAREMES=Object.freeze({
  homme:Object.freeze({squat:1.75,couche:1.35,terre:2.1,militaire:0.85}),
  femme:Object.freeze({squat:1.35,couche:0.85,terre:1.65,militaire:0.55})
});
// Le poids de corps qu'on suppose quand aucun n'est connu (la note le dit).
const CARTE_POIDS_DEFAUT=Object.freeze({homme:78,femme:63});
// Les mouvements de base, reconnus par leur nom normalisé (exKey + alias).
const CARTE_MOUVEMENTS=Object.freeze([
  {cle:'squat',lib:'Squat',re:/^(BACK )?SQUAT( BARRE| ARRIERE| BARRE ARRIERE| HIGH BAR| LOW BAR)?$/},
  {cle:'couche',lib:'Développé couché',re:/^(DEVELOPPE COUCHE( BARRE)?|BENCH( PRESS)?)$/},
  {cle:'terre',lib:'Soulevé de terre',re:/^(SOULEVE DE TERRE( BARRE| CONVENTIONNEL| SUMO)?|DEADLIFT)$/},
  {cle:'militaire',lib:'Développé militaire',re:/^(DEVELOPPE MILITAIRE( BARRE)?|OVERHEAD PRESS|OHP)$/}
]);
// Les références des autres notes (x = 1).
const CARTE_REF=Object.freeze({seriesSemaine:45,minutesSemaine:180,gainPro:0.04});
// Le poids de chaque note dans la globale : REG et PRO avant FOR.
const CARTE_POIDS=Object.freeze({REG:0.27,PRO:0.25,FOR:0.18,VOL:0.15,END:0.15});
const CARTE_NOTES=Object.freeze(['FOR','VOL','REG','PRO','END']);
const CARTE_LIB=Object.freeze({FOR:'Force',VOL:'Volume',REG:'Régularité',PRO:'Progression',END:'Endurance'});
// Le cadre suit la globale.
const CARTE_CADRES=Object.freeze([
  Object.freeze({cle:'standard',min:1,lib:'STANDARD'}),
  Object.freeze({cle:'elite',min:70,lib:'ÉLITE'}),
  Object.freeze({cle:'legendaire',min:85,lib:'LÉGENDAIRE'})
]);
const CARTE_FORMATS=Object.freeze({carte:Object.freeze({w:1080,h:1512}),story:Object.freeze({w:1080,h:1920})});

/** PURE. La courbe douce : x (1 = référence) → 1..99. */
function carteCourbe(x){
  const v=Math.max(0,Number(x)||0);
  return Math.max(1,Math.min(99,Math.round(1+98*(1-Math.exp(-CARTE_K*v)))));
}
/** PURE. Le cadre d'une globale. */
function carteCadre(globale){
  const g=Number(globale)||0;
  let c=CARTE_CADRES[0];
  for(const x of CARTE_CADRES) if(g>=x.min) c=x;
  return c;
}
/** PURE. 'homme' ou 'femme' (défaut : homme). */
function carteSexe(u){
  const g=String((u&&(u.gender||u.sexe))||'').toLowerCase();
  return /^(f|femme|female|woman)/.test(g)?'femme':'homme';
}
/** PURE. Le dernier poids de corps connu (pesées, bilans, profil), ou null. */
function poidsCorpsActuel(u){
  let best=null;
  const prendre=(d,kg)=>{ const v=parseFloat(kg); if(!(v>=30&&v<=300)) return;
    const t=typeof d==='number'?d:Date.parse(d);
    if(!best||(isFinite(t)&&t>best.t)) best={t:isFinite(t)?t:0,kg:v}; };
  for(const e of ((u&&u.weightLog)||[])) if(e) prendre(e.date,e.kg);
  for(const b of ((u&&u.bilans)||[])) if(b) prendre(b.date,getBW(b));
  if(best) return best.kg;
  for(const k of ['profileWeight','weight']){ const v=parseFloat(u&&u[k]); if(v>=30&&v<=300) return v; }
  return null;
}
/** PURE. Le mouvement de base d'un nom d'exercice, ou null. */
function carteMouvementDe(nom){
  let k='';
  try{ k=resoudreAlias(exKey(nom)); }catch(e){ k=String(nom||'').toUpperCase(); }
  const m=CARTE_MOUVEMENTS.find(x=>x.re.test(k)||x.re.test(exKey(nom)));
  return m?m.cle:null;
}
// Les séries faites d'une séance : [{nom, kg, reps, rir}].
function _carteSeries(s,u){
  const out=[];
  const exos=(s&&s.data&&typeof s.data==='object'&&Object.keys(s.data).length)
    ?Object.keys(s.data).map(nm=>({nom:nm,sets:((s.data[nm]||{}).sets)||[]}))
    :((s&&s.exercises)||[]).filter(e=>e&&(e.name||e.nm)).map(e=>({nom:e.name||e.nm,sets:e.sets||[]}));
  for(const e of exos) for(const st of (e.sets||[])){
    if(!st||st.done===false) continue;
    // eff : la charge effective (typeCharge), quand le dossier est donné.
    let eff=null; try{ eff=u?chargeEffective(st,_exPourCharge(e.nom,u),u):(parseFloat(st.weight)||null); }catch(er){ eff=null; }
    out.push({nom:e.nom,kg:parseFloat(st.weight)||0,eff,reps:parseFloat(st.reps)||0,rir:parseFloat(st.rir)||0});
  }
  return out;
}
/**
 * PURE (horloge donnée). La note de l'athlète sur les 12 semaines complètes
 * qui précèdent le lundi de `maintenant`.
 * @returns {{FOR:number,VOL:number,REG:number,PRO:number,END:number,globale:number,
 *   cadre:string,semaine:string,x:Object,sansPoids:boolean,seances:number}}
 */
function noteAthlete(u,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const fin=_lundiDe(t).getTime();
  const debut=_lundiDe(_datePlusJours(fin,-7*CARTE_SEMAINES).getTime()+12*3600e3).getTime();
  const milieu=_lundiDe(_datePlusJours(fin,-7*(CARTE_SEMAINES/2)).getTime()+12*3600e3).getTime();
  const ses=((u&&u.sessions)||[]).filter(s=>s&&s.date>=debut&&s.date<fin);
  const sexe=carteSexe(u);
  const pc=poidsCorpsActuel(u);
  const poids=pc||CARTE_POIDS_DEFAUT[sexe];
  const bar=CARTE_BAREMES[sexe];
  // FOR et PRO : le meilleur e1RM par exercice, sur chaque moitié.
  const meilleur={}, moitie={};
  let series=0, minutes=0;
  for(const s of ses){
    const l=_carteSeries(s,u);
    series+=l.length;
    const d=Number(s.duration);
    minutes+=(d>0&&d<600)?d:l.length*3;
    const h=s.date<milieu?0:1;
    for(const x of l){
      if(!(x.eff>0)||!(x.reps>=1)||!e1rmFiable(x.reps,x.rir)) continue;
      const e=e1rm(x.eff,x.reps,x.rir);
      let k=x.nom; try{ k=resoudreAlias(exKey(x.nom)); }catch(er){}
      if(!meilleur[k]||e>meilleur[k].e) meilleur[k]={e,nom:x.nom};
      (moitie[k]=moitie[k]||[0,0]);
      if(e>moitie[k][h]) moitie[k][h]=e;
    }
  }
  // FOR : la moyenne des mouvements de base présents, chacun à son barème.
  const parMvt={};
  for(const k of Object.keys(meilleur)){
    const m=carteMouvementDe(meilleur[k].nom);
    if(m&&(!parMvt[m]||meilleur[k].e>parMvt[m])) parMvt[m]=meilleur[k].e;
  }
  const rapports=Object.keys(parMvt).map(m=>parMvt[m]/poids/bar[m]);
  const xFOR=rapports.length?rapports.reduce((a,b)=>a+b,0)/rapports.length:0;
  // VOL, END : par semaine.
  const xVOL=series/CARTE_SEMAINES/CARTE_REF.seriesSemaine;
  const xEND=minutes/CARTE_SEMAINES/CARTE_REF.minutesSemaine;
  // REG : les semaines validées, sur 12. Toutes validées : x = 1,5 (90).
  let quota=1; try{ quota=seancesPrevuesParSemaine(u); }catch(e){ quota=1; }
  const cpt={};
  for(const s of ses){ const l=_lundiDe(s.date).getTime(); cpt[l]=(cpt[l]||0)+1; }
  const validees=Object.keys(cpt).filter(l=>cpt[l]>=quota).length;
  const xREG=1.5*Math.min(CARTE_SEMAINES,validees)/CARTE_SEMAINES;
  // PRO : le gain moyen des exercices travaillés dans les DEUX moitiés.
  // Stable : x = 0,35 (43) ; +4 % sur 12 semaines : x = 1,35 (87).
  const gains=Object.keys(moitie).filter(k=>moitie[k][0]>0&&moitie[k][1]>0).map(k=>moitie[k][1]/moitie[k][0]-1);
  const g=gains.length?gains.reduce((a,b)=>a+b,0)/gains.length:null;
  const xPRO=g===null?0:Math.max(0,0.35+g/CARTE_REF.gainPro);
  const x={FOR:xFOR,VOL:xVOL,REG:xREG,PRO:xPRO,END:xEND};
  const o={};
  for(const k of CARTE_NOTES) o[k]=ses.length?carteCourbe(x[k]):1;
  let gl=0;
  for(const k of CARTE_NOTES) gl+=CARTE_POIDS[k]*o[k];
  o.globale=Math.max(1,Math.min(99,Math.round(gl)));
  o.cadre=carteCadre(o.globale).cle;
  o.semaine=localISODate(new Date(fin));
  o.x=x; o.sansPoids=!pc; o.seances=ses.length;
  return o;
}
// ── Le recalcul du lundi ────────────────────────────────────────────────
// Une fois par semaine : la note de la semaine est rangée dans l'historique
// (52 semaines au plus). Rend {note, monte, cadreChange} quand il y a du neuf,
// null sinon (déjà calculée cette semaine, ou pas d'athlète).
function majCarteAthlete(u,maintenant,o){
  if(!u||u.role==='coach') return null;
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const n=noteAthlete(u,t);
  if(u.carte&&u.carte.semaine===n.semaine&&!(o&&o.force)) return null;
  const prec=u.carte&&typeof u.carte==='object'?u.carte:null;
  const h=Array.isArray(u.carteHist)?u.carteHist.filter(x=>x&&x.s!==n.semaine):[];
  h.push({s:n.semaine,g:n.globale,FOR:n.FOR,VOL:n.VOL,REG:n.REG,PRO:n.PRO,END:n.END});
  h.sort((a,b)=>a.s<b.s?-1:1);
  u.carteHist=h.slice(-52);
  const monte=!!(prec&&n.globale>(Number(prec.globale)||0));
  const cadreChange=!!(prec&&prec.cadre!==n.cadre&&monte);
  u.carte={FOR:n.FOR,VOL:n.VOL,REG:n.REG,PRO:n.PRO,END:n.END,globale:n.globale,cadre:n.cadre,
    semaine:n.semaine,le:t,avant:prec?(Number(prec.globale)||null):null,
    // La carte reste sur l'accueil tant qu'elle n'a été ni partagée ni fermée.
    aMontrer:monte||!!(prec&&prec.aMontrer),foudre:cadreChange||!!(prec&&prec.foudre)};
  try{ saveUser(); }catch(e){ rcErreurMuette('majCarteAthlete',e); }
  return {note:n,monte,cadreChange};
}
// ── Les cadres dessinés (cartes-bruts/ → app/img/cartes/<cadre>.webp) ─────
// Posés par scripts/cartes_webp.py. Tant qu'un gabarit manque, le cadre est
// DESSINÉ (le même esprit, sans l'image) : la carte ne dépend jamais d'un
// fichier absent.
// UN CADRE EN ÉCHEC N'EST PLUS REDEMANDÉ (05/10/2026) : il est noté, l'image
// cassée lâchée, et la carte se dessine sans lui (null) pour la session.
const _carteCadresImg={};
const _carteCadresEchec=new Set();
function carteCadreImage(cle){
  if(_carteCadresEchec.has(cle)) return null;
  if(_carteCadresImg[cle]) return _carteCadresImg[cle];
  try{
    const im=new Image();
    im.decoding='async';
    im.onerror=()=>{ _carteCadresEchec.add(cle); delete _carteCadresImg[cle]; };
    im.src='img/cartes/'+cle+'.webp';
    _carteCadresImg[cle]=im;
    return im;
  }catch(e){ return null; }
}
function _carteCadrePret(cle){
  const im=carteCadreImage(cle);
  return (im&&im.complete&&im.naturalWidth>0)?im:null;
}
// Les couleurs du cadre dessiné.
const CARTE_TEINTES=Object.freeze({
  standard:{a:'#6b6b72',b:'#2a2a2e',accent:ROUGE_MARQUE,halo:'rgba(224,32,32,.18)'},
  elite:{a:'#ff3b3b',b:'#7a0a0a',accent:'#ff3b3b',halo:'rgba(255,59,59,.38)'},
  legendaire:{a:'#ffd36a',b:'#b3261e',accent:'#ffcf5a',halo:'rgba(255,190,70,.42)'}
});
function _carteChemin(g,x,y,w,h,r){
  g.beginPath();
  g.moveTo(x+r,y); g.lineTo(x+w-r,y); g.quadraticCurveTo(x+w,y,x+w,y+r);
  g.lineTo(x+w,y+h-r); g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  g.lineTo(x+r,y+h); g.quadraticCurveTo(x,y+h,x,y+h-r);
  g.lineTo(x,y+r); g.quadraticCurveTo(x,y,x+r,y); g.closePath();
}
function _carteCadreDessine(g,x,y,w,h,cle){
  const T=CARTE_TEINTES[cle]||CARTE_TEINTES.standard;
  g.save();
  // Le fond de la carte.
  const f=g.createLinearGradient(x,y,x+w,y+h);
  f.addColorStop(0,'#151517'); f.addColorStop(0.55,'#0b0b0c'); f.addColorStop(1,'#050505');
  _carteChemin(g,x,y,w,h,56); g.fillStyle=f; g.fill();
  // Le halo du haut.
  const hal=g.createRadialGradient(x+w/2,y+h*0.28,0,x+w/2,y+h*0.28,w*0.75);
  hal.addColorStop(0,T.halo); hal.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=hal; g.fill();
  // La bordure : deux traits, le dégradé de la teinte.
  const b=g.createLinearGradient(x,y,x+w,y+h);
  b.addColorStop(0,T.a); b.addColorStop(0.5,T.b); b.addColorStop(1,T.a);
  g.shadowColor=T.accent; g.shadowBlur=cle==='standard'?10:34;
  g.strokeStyle=b; g.lineWidth=14; _carteChemin(g,x+7,y+7,w-14,h-14,50); g.stroke();
  g.shadowBlur=0;
  g.strokeStyle='rgba(255,255,255,.18)'; g.lineWidth=2; _carteChemin(g,x+30,y+30,w-60,h-60,36); g.stroke();
  g.restore();
}
/**
 * La carte. `d` : {prenom, note:{FOR..END,globale,cadre}, rang (1..10),
 * signature}. `format` : 'carte' (1080×1512) ou 'story' (1080×1920 : la
 * carte centrée, un titre au-dessus). `o.emb` : l'emblème du rang chargé.
 */
function _dessinerCarteAthlete(d,format,o){
  const F=CARTE_FORMATS[format]||CARTE_FORMATS.carte;
  const W=F.w, H=F.h, story=format==='story';
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const g=cv.getContext('2d');
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif");
  const MONT="Montserrat,'Segoe UI',sans-serif";
  const ou=_visuelOutils(g);
  const x=d||{}, n=x.note||{};
  const cle=(CARTE_CADRES.find(c=>c.cle===n.cadre)||carteCadre(n.globale)).cle;
  const T=CARTE_TEINTES[cle];
  g.fillStyle='#000'; g.fillRect(0,0,W,H);
  // La carte : pleine page, ou centrée dans la story.
  const cw=story?980:W, ch=Math.round(cw*1512/1080);
  const cx0=(W-cw)/2, cy0=story?Math.round((H-ch)/2)+40:0;
  if(story){
    const hal=g.createRadialGradient(W/2,H/2,0,W/2,H/2,H*0.6);
    hal.addColorStop(0,T.halo); hal.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=hal; g.fillRect(0,0,W,H);
    g.textAlign='center'; g.fillStyle='#fff'; g.font='800 34px '+MONT;
    ou.ecrireEspace('MA CARTE D’ATHLÈTE',W/2,cy0-44,10,true);
  }
  const im=_carteCadrePret(cle);
  if(im){ try{ g.drawImage(im,cx0,cy0,cw,ch); }catch(e){ _carteCadreDessine(g,cx0,cy0,cw,ch,cle); } }
  else _carteCadreDessine(g,cx0,cy0,cw,ch,cle);
  const k=cw/1080;                           // l'échelle du dessin dans la carte
  const X=v=>cx0+v*k, Y=v=>cy0+v*k, S=v=>Math.round(v*k);
  g.textBaseline='alphabetic';
  // LA GLOBALE, en haut à gauche, et le cadre dessous.
  ou.ombre(true);
  g.textAlign='center'; g.fillStyle='#fff';
  g.font='700 '+S(250)+'px '+BEBAS; ou.ecrire(String(n.globale||1),X(250),Y(330));
  g.fillStyle=T.accent; g.font='800 '+S(34)+'px '+MONT;
  ou.ecrireEspace(carteCadre(n.globale).lib,X(250),Y(386),8,true);
  // L'EMBLÈME DU RANG, en haut à droite.
  if(o&&o.emb&&o.emb.naturalWidth){ try{ g.drawImage(o.emb,X(600),Y(110),S(340),S(340)); }catch(e){} }
  else{
    g.save(); g.fillStyle=T.accent; g.globalAlpha=.9; g.font='700 '+S(300)+'px '+BEBAS;
    ou.ecrire('⚡',X(770),Y(400)); g.restore();
  }
  // Le prénom, en grand, et un trait.
  const nom=String(x.prenom||'ATHLÈTE').toUpperCase();
  g.fillStyle='#fff';
  const ns=ou.ajuste(nom,'700',S(170),BEBAS,S(900),S(70));
  g.font='700 '+ns+'px '+BEBAS; ou.ecrire(ou.coupe(nom,S(900)),X(540),Y(640));
  ou.ombre(false);
  g.fillStyle=T.accent; g.fillRect(X(390),Y(680),S(300),S(6));
  // LES CINQ NOTES : deux colonnes (3 + 2), le chiffre puis le sigle.
  // Deux colonnes de deux, la cinquième centrée dessous : la carte est
  // remplie jusqu'à la signature.
  const pos=[[170,880],[170,1085],[600,880],[600,1085],[385,1290]];
  CARTE_NOTES.forEach((c,i)=>{
    const [bx,by]=pos[i];
    ou.ombre(true);
    g.textAlign='left'; g.fillStyle='#fff';
    g.font='700 '+S(160)+'px '+BEBAS; ou.ecrire(String(n[c]||1),X(bx),Y(by));
    g.fillStyle=T.accent; g.font='800 '+S(50)+'px '+MONT;
    ou.ecrireEspace(c,X(bx+175),Y(by-18),6,false);
    ou.ombre(false);
  });
  // LA SIGNATURE, en bas de la carte.
  g.textAlign='center';
  const sig=String(x.signature||'').trim();
  const t=(sig?sig.toUpperCase()+' · ':'')+'REPCORE';
  ou.ombre(true);
  g.fillStyle='rgba(255,255,255,.85)';
  const ss=ou.ajusteEspace(t,'700',S(40),BEBAS,7,S(860),S(22));
  g.font='700 '+ss+'px '+BEBAS; ou.ecrireEspace(t,X(540),Y(1440),7,true);
  _visuelAdresse(g,ou.ecrireEspace,X(540),Y(1440),ss);
  ou.ombre(false);
  return cv;
}
// PURE (sauf nomSurVisuels). Les données de la carte d'un athlète.
function carteDonnees(u){
  let sig=''; try{ sig=nomSurVisuels(u); }catch(e){ sig=''; }
  let r=1; try{ r=rangDe(xpDe(u)).rang.n; }catch(e){ r=1; }
  const c=(u&&u.carte)||noteAthlete(u);
  return {prenom:String((u&&u.fname)||'').trim().slice(0,24),note:c,rang:r,signature:sig};
}
// ── Le partage ─────────────────────────────────────────────────────────
// 1080×1512 se partage comme un POST (la légende), la story comme une story
// (le lien). SYNCHRONE jusqu'au partage (iOS).
function partagerCarteAthlete(btn,format){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u||_storyEnCours) return false;
  const f=format==='story'?'story':'carte';
  const emb=document.getElementById('carte-emb-src');
  const nom=f==='story'?'repcore-carte.jpg':'repcore-carte-post.jpg';
  const fmt=visuelFondFormat('carbone');
  _storyEnCours=true;
  let ok=false;
  try{
    const dessin=()=>_dessinerCarteAthlete(carteDonnees(u),f,{emb});
    ok=_storySortirPartage(dessin(),nom,undefined,fmt)||_storySortirTelechargement(dessin(),nom,fmt);
  }catch(e){ toast('Partage impossible : '+((e&&e.message)||'erreur'),'var(--orange)'); ok=false; }
  finally{ _storyEnCours=false; }
  if(ok&&u.carte&&u.carte.aMontrer){ u.carte.aMontrer=false; try{ saveUser(); }catch(e){ rcErreurMuette('partagerCarteAthlete',e); } }
  const sp=btn&&btn.querySelector?btn.querySelector('span'):null;
  if(sp&&ok){ const l=sp.textContent; _texteIco(sp,'Carte prête '+ICO.coche); setTimeout(()=>{ sp.textContent=l; },2000); }
  return ok;
}
// ── L'accueil : la carte, quand la note monte ───────────────────────────
// PURE.
function htmlCarteAccueil(u){
  const c=u&&u.carte;
  if(!c||!c.aMontrer) return '';
  const av=Number(c.avant)||0;
  return '<div class="ca-accueil" role="region" aria-label="Ta carte d’athlète">'
    +'<div class="ca-tete"><b>Ta note monte'+(av?' : '+av+' → '+c.globale:' : '+c.globale)+'</b>'
    +'<button type="button" class="ca-fermer" aria-label="Fermer" onclick="fermerCarteAccueil()">'+icon('croix',14)+'</button></div>'
    +'<canvas class="ca-vignette" id="ca-vignette" width="360" height="504" role="img" aria-label="Carte d’athlète, note '+c.globale+'"></canvas>'
    +'<div class="ca-btns">'
    +'<button type="button" class="btn btn-red btn-sm" onclick="partagerCarteAthlete(this,\'carte\')">'+icon('share',14)+' <span>Partager</span></button>'
    +'<button type="button" class="btn btn-outline btn-sm btn-casse" onclick="partagerCarteAthlete(this,\'story\')">En story</button>'
    +'</div></div>';
}
function _peindreVignetteCarte(id,u){
  const c=document.getElementById(id);
  if(!c||!u) return false;
  const g=c.getContext('2d');
  const emb=document.getElementById('carte-emb-src');
  const cv=_dessinerCarteAthlete(carteDonnees(u),'carte',{emb});
  g.clearRect(0,0,c.width,c.height);
  g.drawImage(cv,0,0,c.width,c.height);
  cv.width=0; cv.height=0;
  return true;
}
// L'emblème du rang, chargé une fois (la carte le dessine).
function _carteEmbleme(u){
  let e=document.getElementById('carte-emb-src');
  let n=1; try{ n=rangDe(xpDe(u)).rang.n; }catch(er){ n=1; }
  const src=rangEmbleme(n,true);
  if(!e){ e=new Image(); e.id='carte-emb-src'; e.hidden=true; e.alt=''; e.decoding='async'; document.body.appendChild(e); }
  if(e.getAttribute('src')!==src) e.src=src;
  return e;
}
function _rendreCarteAccueil(u){
  if(!u||u.role==='coach') return false;
  let r=null; try{ r=majCarteAthlete(u); }catch(e){ r=null; }
  const t=document.querySelector('#s-client-home .clh-tete');
  let z=document.getElementById('clh-carte');
  const h=htmlCarteAccueil(u);
  if(!z&&h&&t){ z=document.createElement('div'); z.id='clh-carte'; (document.getElementById('clh-filleuls')||t).insertAdjacentElement('afterend',z); }
  if(!z) return false;
  z.innerHTML=h; z.hidden=!h;
  if(!h) return false;
  const emb=_carteEmbleme(u);
  const peindre=()=>{ try{ _peindreVignetteCarte('ca-vignette',u); }catch(e){} };
  peindre();
  if(emb&&!emb.complete) emb.addEventListener('load',peindre,{once:true});
  const cadre=carteCadreImage(u.carte.cadre);
  if(cadre&&!cadre.complete) cadre.addEventListener('load',peindre,{once:true});
  // LE CHANGEMENT DE CADRE : la foudre frappe la carte, une fois.
  if(u.carte.foudre){
    u.carte.foudre=false; try{ saveUser(); }catch(e){ rcErreurMuette('_rendreCarteAccueil',e); }
    setTimeout(()=>{ try{ rcFoudre(document.getElementById('ca-vignette'),{eclairs:3}); }catch(e){} },400);
  }
  return true;
}
function fermerCarteAccueil(){
  const u=currentUser;
  if(u&&u.carte){ u.carte.aMontrer=false; try{ saveUser(); }catch(e){ rcErreurMuette('fermerCarteAccueil',e); } }
  const z=document.getElementById('clh-carte'); if(z){ z.innerHTML=''; z.hidden=true; }
  return true;
}
// ── L'onglet Évolution ne porte plus la carte d'athlète ──────────────────
// Retirée le 28/09/2026 (Kevin : « ça n'a rien à faire dans Évolution »).
// La carte garde sa note, son accueil et son partage ; seul l'onglet la perd.
// ── LA FIN DE SÉANCE : « +180 ⚡ », compté par arcCompteur, et le détail ──
// PURE.
function htmlVoltsFin(g,xpTotal){
  if(!g||!(g.total>0)) return '';
  const r=rangDe(xpTotal);
  const lignes=g.lignes.map(l=>'<div class="vt-l"><span>'+escapeHtml(l.lib)+'</span><b>+'+xpFormat(l.v)+'</b></div>').join('');
  return '<div class="vt-carte">'
    +'<div class="vt-tete"><img class="vt-emb" src="'+rangEmbleme(r.rang.n)+'" alt="" width="44" height="44" decoding="async">'
    +'<div class="vt-gain"><span id="vt-compteur" data-valeur="0">+0</span> <span class="vt-eclair" aria-hidden="true">'+icon('eclair',14)+'</span></div>'
    +'<div class="vt-rang">'+escapeHtml(r.rang.nom)+'</div></div>'
    +'<div class="vt-lignes">'+lignes+'</div>'
    +'<div class="rg-jauge vt-jauge"><span style="width:'+Math.round(r.part*100)+'%"></span></div>'
    +'<div class="rg-txt">'+escapeHtml(r.suivant?xpFormat(r.xp)+' / '+xpFormat(r.suivant.seuil)+' V vers '+r.suivant.nom:xpFormat(r.xp)+' V · rang maximal')+'</div>'
    +'</div>';
}
// LOT N2. « +40 ⚡ Journée dans ta cible » : la même forme que la fin de
// séance (vt-gain, vt-eclair), sans modale ni badge. '' quand la journée
// n'est pas tenue : aucun message d'échec, jamais.
function htmlVoltsCible(u,j){
  if(!u||u.role==='coach') return '';
  let c=null; try{ c=cibleTenueJour(u,j); }catch(e){ c=null; }
  if(!c||!c.tenue) return '';
  return '<div class="vt-cible" role="status"><span class="vt-gain">+'+xpFormat(XP_ACTIONS.cible)
    +' <span class="vt-eclair" aria-hidden="true">'+icon('eclair',14)+'</span></span><span class="vt-cible-t">Journée dans ta cible</span></div>';
}
function rendreVoltsFin(u,sess){
  const z=document.getElementById('wd-volts');
  if(!z) return null;
  // Une nouvelle fin de séance : le carrousel des trophées repart vide.
  _bdgTrophees=[];
  const zt=document.getElementById('wd-trophees'); if(zt) zt.innerHTML='';
  let g=null; try{ g=xpGainsSeance(u,sess); }catch(e){ g=null; }
  z.innerHTML=htmlVoltsFin(g,g?g.apres:xpDe(u));
  if(!g||!(g.total>0)) return g;
  const el=document.getElementById('vt-compteur');
  const fmt=v=>'+'+xpFormat(v);
  // Il monte quand le bloc entre en scène (.rcf-d3, ~950 ms), comme la bande
  // statistique : un chiffre qui a fini de compter avant d'apparaître ne dit rien.
  if(arcReduit()){ if(el){ el.textContent=fmt(g.total); el.dataset.valeur=String(g.total); } }
  else setTimeout(()=>{ try{ arcCompteur(el,g.total,{format:fmt,duree:900}); }catch(e){ if(el) el.textContent=fmt(g.total); } },1000);
  return g;
}
// ── LE PASSAGE DE RANG : écran plein, foudre, emblème dans le flash ───────
// Dans la même file que les badges et les paliers de série (après eux :
// majXp tourne après majBadges).
function _celebrerRang(n){
  const v=Number(n)||0; if(!v) return;
  _bdgFile.push({rang:v});
  _bdgPlanifier();
}
let _rangCourant=null;
function rangCarteDonnees(u,n){
  let sig=''; try{ sig=nomSurVisuels(u); }catch(e){ sig=''; }
  const r=RANGS[Math.max(0,Math.min(RANGS.length-1,(Number(n)||1)-1))];
  return {n:r.n,nom:r.nom,xp:xpDe(u),signature:sig};
}
function _rangEcran(n,reste){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  const d=rangCarteDonnees(u,n);
  _rangCourant=d;
  const suiv=RANGS[d.n]||null;
  let propose=false; try{ propose=PAGE_PUBLIQUE_PROPOSEE&&pagePropositionDue(u,d.n); }catch(e){ propose=false; }
  const z=_bdgCouche(
    '<div class="bdg-ecran-scene"><div class="bdg-ecran-med rg-ecran-med">'
      +'<img id="rg-ecran-img" src="'+rangEmbleme(d.n,true)+'" alt="" width="512" height="512" decoding="async"></div></div>'
    +'<div class="bdg-ecran-txt">'
    +'<div class="bdg-ecran-sur">NOUVEAU RANG</div>'
    +'<h2 class="bdg-ecran-nom">'+escapeHtml(d.nom)+'</h2>'
    +'<div class="bdg-ecran-meta">'+icon('eclair',14)+' '+escapeHtml(xpFormat(d.xp))+' V</div>'
    +'<p class="bdg-ecran-cond">'+escapeHtml(suiv?'Prochain rang : '+suiv.nom+', à '+xpFormat(suiv.seuil)+' V.':'Le rang le plus haut. Il n’y a rien au-dessus.')+'</p>'
    +_htmlVisuelFonds('rg-fonds')+_htmlVisuelMedia()
    +'<button type="button" class="btn btn-red bdg-ecran-part" onclick="partagerRang(this)">'+icon('share',16)+' <span>Partager</span></button>'
    +htmlBoutonInviter()
    // LA PAGE PUBLIQUE, proposée à la fin : ce qu'on vient de gagner se montre.
    +(propose?htmlPropositionPage(u):'')
    +'<button type="button" class="btn btn-outline btn-sm bdg-ecran-tard" onclick="bdgPlusTard()">'
      +(reste||_bdgRecap.length?'Suivant':'Plus tard')+'</button>'
    +'</div>',
    'Nouveau rang : '+d.nom);
  if(propose) _noterPropositionPage(u,d.n);
  const img=z.querySelector('#rg-ecran-img');
  const monter=()=>{ try{ monterSelecteurFond('rg-fonds',f=>_dessinerCarteRang(_rangCourant||d,f,img),null); }catch(e){} };
  if(img&&img.complete&&img.naturalWidth) monter(); else if(img) img.addEventListener('load',monter,{once:true});
  const med=z.querySelector('.bdg-ecran-med');
  if(arcReduit()){ try{ _bdgFoudre(med,{son:false}); }catch(e){} }
  else{
    _animer(z,[{opacity:0},{opacity:1}],{duration:120,easing:'linear'});
    // L'EMBLÈME NAÎT DANS LE FLASH : la foudre frappe à t=0, il sort du blanc
    // à 40 ms, plus grand, puis se pose.
    try{ _bdgFoudre(med,{eclairs:d.n>=8?3:2,conteneur:z}); }catch(e){}
    _animer(med,[{transform:'scale(.2)',opacity:0,filter:'brightness(4)'},
      {transform:'scale(1.15)',opacity:1,filter:'brightness(2)',offset:.55},
      {transform:'scale(1)',opacity:1,filter:'brightness(1)'}],
      {duration:900,delay:40,easing:ARC.snap,fill:'backwards'});
    const txt=z.querySelector('.bdg-ecran-txt');
    _animer(txt,[{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'none'}],
      {duration:360,delay:620,easing:ARC.discharge,fill:'backwards'});
  }
  try{ arcHaptique('succes'); }catch(e){}
  try{ const p=z.querySelector('.bdg-ecran-part'); if(p) p.focus({preventScroll:true}); }catch(e){}
}
/**
 * LA CARTE 1080×1920 : « NOUVEAU RANG · TITAN », l'emblème géant, les volts,
 * la signature « <NOM> · REPCORE ». `img` : l'emblème 512 déjà chargé (sans
 * lui, la carte se dessine sans emblème plutôt que de lever).
 */
// `anim` (la vidéo) : {echelle, eclat, texte, xp} — l'emblème qui naît, le
// blanc qui le quitte, le texte qui arrive, les volts qui comptent.
function _dessinerCarteRang(d,fond,img,format,anim){
  const F=visuelFormat(format), W=F.w, H=F.h, post=F.cle==='post';
  const cv=_visuelToile(anim,W,H);
  const g=cv.getContext('2d');
  const f=fond||'transparent';
  if(!(anim&&anim.sansFond)) _visuelPeindreFond(g,W,H,f);
  const A=anim||{};
  const aTexte=A.texte==null?1:Math.max(0,Math.min(1,A.texte));
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif");
  const MONT="Montserrat,'Segoe UI',sans-serif";
  const M=72, LARG=W-M*2, cx=W/2;
  const o=_visuelOutils(g);
  const rouge=f==='rouge';
  g.textAlign='center'; g.textBaseline='alphabetic';
  // L'en-tête.
  o.ombre(true);
  g.globalAlpha=aTexte;
  const sur='NOUVEAU RANG · '+String(d.nom||'');
  const ss=o.ajusteEspace(sur,'800',46,MONT,9,LARG,26);
  g.fillStyle=rouge?'#fff':ROUGE_MARQUE; g.font='800 '+ss+'px '+MONT;
  o.ecrireEspace(sur,cx,post?110:300,9,true);
  o.ombre(false);
  // L'EMBLÈME GÉANT, avec un halo derrière.
  // En post, l'emblème descend à 720 px et remonte sous l'en-tête.
  const T=post?720:860, y0=post?150:400;
  if(anim) anim.geo={x:cx,y:y0+T/2,taille:T};
  g.globalAlpha=1;
  const ech=A.echelle==null?1:Math.max(0,A.echelle);
  g.save();
  if(ech!==1){ g.translate(cx,y0+T/2); g.scale(ech,ech); g.translate(-cx,-(y0+T/2)); g.globalAlpha=Math.min(1,ech/0.6); }
  const h=g.createRadialGradient(cx,y0+T/2,40,cx,y0+T/2,T*0.62);
  h.addColorStop(0,rouge?'rgba(255,255,255,.28)':'rgba(224,32,32,.42)');
  h.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=h; g.fillRect(0,y0-120,W,T+240);
  g.restore();
  if(img&&img.naturalWidth){
    g.save();
    if(ech!==1){ g.translate(cx,y0+T/2); g.scale(ech,ech); g.translate(-cx,-(y0+T/2)); g.globalAlpha=Math.min(1,ech/0.6); }
    try{ g.drawImage(img,cx-T/2,y0,T,T); }catch(e){}
    // L'ÉCLAT : l'emblème sort du flash, blanc, puis prend ses couleurs.
    if(A.eclat>0){
      g.globalCompositeOperation='lighter'; g.globalAlpha=Math.min(1,A.eclat);
      try{ g.drawImage(img,cx-T/2,y0,T,T); g.drawImage(img,cx-T/2,y0,T,T); }catch(e){}
    }
    g.restore();
  }
  // Le nom du rang, en grand, sous l'emblème.
  o.ombre(true);
  g.globalAlpha=aTexte;
  g.fillStyle='#fff';
  const ns=o.ajuste(String(d.nom||''),'700',post?170:210,BEBAS,LARG,90);
  g.font='700 '+ns+'px '+BEBAS; o.ecrire(String(d.nom||''),cx,y0+T+ns*0.9);
  g.fillStyle='rgba(255,255,255,.88)'; g.font='800 40px '+MONT;
  o.ecrireEspace('⚡ '+xpFormat(A.xp==null?d.xp:A.xp)+' V',cx,y0+T+ns*0.9+(post?64:80),4,true);
  _recSignature(g,o,String(d.signature||''),H-(post?44:110),LARG);
  o.ombre(false);
  g.globalAlpha=1;
  return cv;
}
function partagerRang(btn){
  const d=_rangCourant; if(!d||_storyEnCours) return false;
  const img=document.getElementById('rg-ecran-img');
  if(visuelMediaChoisi()==='video') return partagerVideo(videoScene('rang',{donnees:d,img,fond:visuelFondEffectif()}));
  const fond=visuelFondEffectif(), fmt=visuelFondFormat(fond);
  const nom=visuelNomFichier('repcore-rang',fond);
  _storyEnCours=true;
  let ok=false;
  try{
    ok=_storySortirPartage(_dessinerCarteRang(d,fond,img),nom,undefined,fmt)
      ||_storySortirTelechargement(_dessinerCarteRang(d,fond,img),nom,fmt);
  }catch(e){ toast('Partage impossible : '+((e&&e.message)||'erreur'),'var(--orange)'); ok=false; }
  finally{ _storyEnCours=false; }
  const sp=btn&&btn.querySelector?btn.querySelector('span'):null;
  if(sp&&ok){ _texteIco(sp,'Visuel prêt '+ICO.coche); setTimeout(()=>{ sp.textContent='Partager'; },2000); }
  return ok;
}
// ── LE CANAL ET LES DÉFIS : l'emblème miniature devant chaque prénom ──────
// Seul le coach voit des prénoms dans le Canal (qui a réagi à quoi) — un
// athlète n'apprend jamais l'existence d'un autre. Le rang vient du dossier de
// l'athlète que le coach a déjà (u.xp, sinon le calcul).
// PURE.
function htmlNomRang(nom,xp){
  const r=rangDe(xp);
  return '<span class="rg-nomrang"><img class="rg-mini" src="'+rangEmbleme(r.rang.n)+'" alt="'+escapeHtml(r.rang.nom)+'" title="'+escapeHtml(r.rang.nom)+'" width="16" height="16" decoding="async">'
    +escapeHtml(nom)+'</span>';
}
function canalPrenomsRangs(reactions,msgId,emoji){
  const users=DB.get('users')||{};
  const l=[];
  Object.keys(reactions||{}).forEach(k=>{
    if((reactions[k]||{})[msgId]!==emoji) return;
    const c=users[k.replace(/,/g,'.')];
    l.push({nom:(c&&(c.fname||c.email))||k.replace(/,/g,'.'),xp:xpDe(c)});
  });
  return l.sort((a,b)=>String(a.nom).localeCompare(String(b.nom)));
}
// ══ LE RAPPEL « SÉRIE EN DANGER » ═════════════════════════════════════════
// Jeudi 18 h et samedi 10 h, si la semaine n'est pas validée. Le push serveur
// (pushSerieEnDanger) couvre le jeudi, avec le même tag : il remplace la
// notification locale au lieu de s'y ajouter. Ici, c'est la notification LOCALE du service
// worker (periodicsync 'serie-reminder'), qui ne sait pas l'heure exacte —
// le navigateur la réveille à son rythme, au plus tôt toutes les 12 h, et
// elle part à son premier réveil après l'heure dite. Seulement si l'athlète
// a activé les rappels, a une série à perdre, et n'est pas suspendu.
function _seriePlanifierNotif(u){
  if(!u||!('serviceWorker' in navigator)) return false;
  let s=0; try{ s=streakSemaines(u)||0; }catch(e){ s=0; }
  let gel=false; try{ gel=suspensionEtat(u).actif; }catch(e){}
  // Le type coupé dans les réglages coupe AUSSI le rappel local.
  const actif=!!(u._notifEnabled&&s>0&&!gel&&pushTypeActif(u,'serie'));
  navigator.serviceWorker.ready.then(async reg=>{
    try{
      const c=await caches.open('repcore-sw-data');
      await c.put('/serie',new Response(JSON.stringify({actif,fname:u.fname||'',streak:s,
        streakWeek:u.streakWeek||null,jokers:Number(u.streakJokers)||0}),{headers:{'Content-Type':'application/json'}}));
      if(actif&&'periodicSync' in reg) await reg.periodicSync.register('serie-reminder',{minInterval:12*3600*1000});
    }catch(e){}
  }).catch(()=>{});
  return actif;
}
// ══════════ LE PLANNING DE RAPPEL, ECRIT EN UN SEUL ENDROIT ════════════
//
// Extrait de saveWoReminderConfig le 15/09/2026, quand l'ecran d'accueil des
// nouveaux inscrits a eu besoin d'ecrire le meme planning. Deux copies de ces
// cinq lignes auraient diverge : l'une aurait appris a gerer les minutes, ou
// a trier les jours, et l'autre non — et personne ne l'aurait su avant qu'un
// athlete ne recoive un rappel au mauvais moment.
//
// ⚠ ELLE NE DEMANDE AUCUNE PERMISSION, et c'est le partage des roles :
// l'APPELANT decide s'il faut demander, cette fonction ecrit. scheduleWoNotif
// ne touche pas davantage a Notification — elle pose un plan dans le cache du
// service worker et arme periodicSync. Un planning ecrit sans permission est
// donc parfaitement valide : il dormira jusqu'a ce que la permission arrive,
// et se declenchera tout seul ensuite, sans qu'on ait rien a rejouer.
//
// `jours` est TRIE et DEDOUBLONNE ici, une bonne fois : _nomsSeancesParJour
// associe les creneaux dans l'ordre du tableau, et un tableau desordonne
// donnait le nom d'une seance a un autre jour.
// ══════════ « QUELS JOURS COMPTES-TU T'ENTRAINER ? » ═══════════════════
//
// LE DEFAUT QU'IL CORRIGE : scheduleWoNotif existe depuis longtemps, mais rien
// ne l'arme sauf saveWoReminderConfig — une feuille qu'on n'atteint qu'en
// sachant deja qu'elle existe. Un nouvel inscrit ne recevait donc JAMAIS aucun
// rappel, et personne ne pouvait le remarquer : l'absence de notification ne
// produit aucune trace.
//
// OU IL S'INTERPOSE, ET POURQUOI LA. La demande disait « juste apres une
// inscription reussie, avant l'arrivee sur s-client-home ». Ces deux instants
// n'en font pas un : apres doRegister, un athlete part sur s-client-code,
// parfois sur son bilan de depart, parfois sur l'abonnement — il peut se
// passer plusieurs ecrans, et parfois plusieurs jours, avant qu'il voie son
// accueil. Poser l'ecran dans doRegister l'aurait donc mis AVANT l'acces, au
// milieu d'une file d'attente administrative : exactement la « seconde
// inscription » qu'on nous demande d'eviter.
//
// Il est donc pose sur la PREMIERE ARRIVEE A L'ACCUEIL, qui est litteralement
// « avant s-client-home » et qui couvre les trois branches d'un coup. Le
// compte vient d'etre cree — la garde des 30 jours le verifie — donc c'est
// bien du nouvel inscrit qu'il s'agit.
const JEN_FENETRE=30*864e5;
// ⚠ LA MEMOIRE EST LOCALE, PAS DANS LE DOSSIER. « Je choisirai plus tard »
// doit n'ECRIRE RIEN, et c'est la consigne exacte. Mais un ecran qui ne
// retient pas qu'il a ete montre revient a chaque ouverture : ce ne serait
// plus une proposition, ce serait un piege. Le temoin vit donc dans
// localStorage, par compte, sur CET appareil — rien ne part au reseau, rien
// n'entre dans le dossier, rien n'est synchronise.
// CONSEQUENCE ASSUMEE : un nouvel appareil repose la question une fois. Pour
// quelqu'un qui n'a jamais repondu, c'est le bon comportement.
const JEN_CLE='rc_jours_vu_';
function _jenVu(u){
  try{ return !!localStorage.getItem(JEN_CLE+((u&&u.email)||'')); }catch(e){ return true; }
}
function _jenMarquer(u){
  try{ localStorage.setItem(JEN_CLE+((u&&u.email)||''),String(Date.now())); }catch(e){}
}
// PURE. Faut-il poser la question a ce dossier, a cet instant ?
//
// LES QUATRE GARDES, et aucune de plus :
//   • un athlete — un coach ne s'entraine pas dans l'app ;
//   • un compte JEUNE — la question s'adresse au nouvel inscrit, pas a
//     quelqu'un qui utilise RepCore depuis six mois et n'a jamais voulu de
//     rappels ;
//   • aucun planning deja pose — celui qui a regle ses rappels a repondu ;
//   • jamais montre sur cet appareil.
function _doitProposerJours(u,maintenant,dejaVu){
  if(!u||!u.email||u.role==='coach') return false;
  if(u._woReminderEnabled) return false;
  if((u._woReminderDays||[]).length) return false;
  if(dejaVu) return false;
  const c=Number(u.createdAt)||0;
  const t=Number(maintenant)||0;
  if(!c||!t) return false;
  return (t-c)<JEN_FENETRE;
}
// PURE. Les jours proposes d'avance. Le chemin le plus court doit etre UNE
// touche : sans pre-selection, « C'est parti » serait desactive et l'ecran
// exigerait au moins deux gestes avant de rendre la main.
// LES CRENEAUX DU PROGRAMME D'ABORD — c'est la meilleure reponse possible,
// elle vient du coach. A defaut, lundi / mercredi / vendredi : trois seances
// espacees, le rythme le plus courant chez un debutant.
// ⚠ LES SEANCES D'ESSAI NE COMPTENT PAS. loadClientHome pose une configuration
// de repli — cinq jours actifs, marques `_essai` — a qui n'a pas encore de
// programme. La lire ici proposerait cinq jours d'entrainement au nom d'un
// coach qui n'a rien ecrit. hasProgram ecarte ces memes seances, pour la meme
// raison et avec le meme predicat.
function _jenJoursProposes(u){
  const act=((u&&u.sessions_config)||[]).reduce((a,s,i)=>{
    if(!s||!s.active) return a;
    try{ if(seanceEstExemple(s)) return a; }catch(e){}
    a.push(i); return a;
  },[]);
  // LUNDI / MERCREDI / VENDREDI a defaut : trois seances espacees, le rythme
  // le plus courant chez quelqu'un qui commence. Un defaut vide obligerait a
  // toucher l'ecran avant de pouvoir en sortir.
  return act.length?act:[0,2,4];
}
// ── Le rendu et les trois gestes ────────────────────────────────────────
let _jenJours=[], _jenMin=0;
function _ouvrirJoursEntrainement(){
  const u=currentUser;
  _jenJours=_jenJoursProposes(u);
  _jenMin=0;
  const z=document.getElementById('jen-jours');
  const DS=['L','Ma','Me','J','V','S','D'];
  if(z) z.innerHTML=DS.map((d,i)=>
    '<button type="button" id="jen-j-'+i+'" onclick="jenJour('+i+')" '
    +'aria-pressed="'+(_jenJours.includes(i)?'true':'false')+'" '
    +'style="flex:1;min-width:0;min-height:52px;border-radius:var(--r-2);cursor:pointer;'
    +'font-family:Montserrat,sans-serif;font-size:var(--fs-sm);font-weight:800">'+d+'</button>').join('');
  const h=document.getElementById('jen-heure');
  // DE 5 h A 22 h : avant et apres, ce n'est plus un creneau d'entrainement,
  // c'est une liste qu'on fait defiler pour rien.
  if(h) h.innerHTML=Array.from({length:18},(_,i)=>i+5)
    .map(x=>'<option value="'+x+'"'+(x===18?' selected':'')+'>'+String(x).padStart(2,'0')+'h</option>').join('');
  for(let i=0;i<7;i++) _jenPeindre(i);
  jenMin(0);
  go('s-jours-entrainement');
}
function _jenPeindre(i){
  const b=document.getElementById('jen-j-'+i);
  if(!b) return;
  const on=_jenJours.includes(i);
  b.setAttribute('aria-pressed',on?'true':'false');
  b.style.border='1px solid '+(on?'var(--red)':'var(--border)');
  b.style.background=on?'#1a0000':'transparent';
  b.style.color=on?'var(--red-text)':'var(--sub)';
}
function jenJour(i){
  const k=_jenJours.indexOf(i);
  if(k>=0) _jenJours.splice(k,1); else _jenJours.push(i);
  _jenPeindre(i);
}
function jenMin(m){
  _jenMin=(m===30)?30:0;
  [0,30].forEach(x=>{
    const el=document.getElementById('jen-min-'+x);
    if(!el) return;
    const on=x===_jenMin;
    el.style.background=on?'var(--red)':'transparent';
    el.style.border='1px solid '+(on?'var(--red)':'var(--border)');
    el.style.color=on?'var(--text)':'var(--sub)';
  });
}
// ⚠ AUCUNE PERMISSION DEMANDEE. On enregistre l'intention et on prepare le
// planning ; la permission viendra apres la premiere seance. C'est la consigne,
// et c'est aussi ce qui marche : deux demandes d'un coup se font refuser
// ensemble.
async function jenValider(){
  if(!_jenJours.length){
    toast('Choisis au moins un jour, ou « je choisirai plus tard »','var(--orange)');
    return;
  }
  const h=+(document.getElementById('jen-heure')?.value||18);
  // MARQUE D'ABORD. Si scheduleWoNotif echoue — pas de service worker, cache
  // indisponible — le planning est quand meme ecrit dans le dossier et l'ecran
  // ne doit pas revenir a la prochaine ouverture.
  _jenMarquer(currentUser);
  try{ await _appliquerRappelSeance(_jenJours,h,_jenMin); }catch(e){}
  toast('C’est note : rappel a '+String(h).padStart(2,'0')+':'
    +String(_jenMin).padStart(2,'0')+' '+ICO.coche);
  go('s-client-home');
  loadClientHome();
}
// ⚠ N'ECRIT AUCUN REGLAGE : ni jours, ni heure, ni activation, et rien dans le
// dossier. Seul le temoin local retient que l'ecran a ete montre — sans lui, la
// question reviendrait a chaque ouverture, et une proposition qui revient
// devient une corvee.
function jenPlusTard(){
  _jenMarquer(currentUser);
  go('s-client-home');
  loadClientHome();
}
async function _appliquerRappelSeance(jours,h,m){
  const j=[...new Set((jours||[]).map(Number).filter(x=>x>=0&&x<=6))].sort((a,b)=>a-b);
  currentUser._woReminderEnabled=true;
  currentUser._woReminderHour=(h>=0&&h<=23)?h:18;
  currentUser._woReminderMin=(m===30)?30:0;
  currentUser._woReminderDays=j;
  saveUser();
  await scheduleWoNotif();
  return j;
}
async function saveWoReminderConfig(){
  const h=+(document.getElementById('wrd-hour')?.value||18);
  const m=window._wrdMin??0;
  const days=window._wrdDays||[];
  if(!days.length){toast("Sélectionne au moins un jour d'entraînement",'var(--orange)');return;}
  const doSave=async()=>{
    await _appliquerRappelSeance(days,h,m);
    toast('Rappel activé à '+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+' '+ICO.coche);
    document.getElementById('wo-reminder-config')?.remove();
    renderWoReminderCard();
  };
  if(!_notifSupported()){toast(_NOTIF_INDISPO,'var(--orange)');return;}
  if(Notification.permission==='granted'){await doSave();return;}
  if(Notification.permission==='denied'){toast('Notifications bloquées : autorise-les dans les réglages du navigateur','var(--orange)');return;}
  const p=await Notification.requestPermission();
  if(p==='granted'){
    // SECOND POINT D'ACCORD — voir le premier, dans le rappel de bilan.
    try{ rcm('notif_granted'); }catch(e){}
    try{ pushAbonner({geste:true}); }catch(e){}
    await doSave();
  }
  else toast('Permission refusée : rappel non activé');
}
async function disableWoReminder(){
  currentUser._woReminderEnabled=false;saveUser();
  try{
    const c=await caches.open('repcore-sw-data');
    const r=await c.match('/wo-reminder');
    if(r){const d=await r.json();await c.put('/wo-reminder',new Response(JSON.stringify({...d,enabled:false}),{headers:{'Content-Type':'application/json'}}));}
  }catch(e){}
  toast('Rappels désactivés');
  document.getElementById('wo-reminder-config')?.remove();
  renderWoReminderCard();
}
function loadPhoto(input,imgId){
  const f=input.files[0];if(!f) return;
  compressImage(f,1200,0.75,data=>{
    const img=document.getElementById(imgId);img.src=data;img.style.display='block';
    const ph=document.getElementById(imgId+'-ph');if(ph) ph.style.display='none';
    input._data=data;
  });
}

// ======= PROGRESS =======
// UNE seule phrase, une seule fois. Aucun exercice, aucun protocole, aucun
// chiffre, et surtout aucune affirmation sur la densité osseuse de qui que ce
// soit : on dit pourquoi continuer, pas ce que vaut son squelette.
const MENO_ENCART_OSSEUX='Après la ménopause, le travail en charge est ce qui '
  +'protège le mieux la densité osseuse. C\'est la meilleure raison de continuer.';
// Le drapeau est posé par un GESTE, jamais par le rendu. Un écran qui écrit
// dans le dossier est exactement le défaut que le lot des compléments a
// corrigé, et un test de principe l'interdit désormais.
function accuserEncartOsseux(){
  currentUser.encartOsseuxVu=true;
  saveUser();
  _renderEncartOsseux();
  return true;
}
function _htmlEncartOsseux(user){
  const u=user||currentUser;
  if(!menopauseeOuAgee(u)||((u||{}).encartOsseuxVu)) return '';
  return `<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px 14px;margin-bottom:14px">
    <div style="font-size:var(--fs-sm);color:var(--text);line-height:1.75">${escapeHtml(MENO_ENCART_OSSEUX)}</div>
    <button onclick="accuserEncartOsseux()" class="btn btn-outline btn-sm" style="width:100%;margin:10px 0 0;font-size:var(--fs-2xs);letter-spacing:1px">J'ai compris</button>
  </div>`;
}
function _renderEncartOsseux(){
  const z=document.getElementById('prog-encart-osseux');
  if(z) z.innerHTML=_htmlEncartOsseux(currentUser);
  // Vigilance energetique : le questionnaire ne s affiche que si les signaux
  // le justifient, et jamais deux fois en trente jours.
  try{ renderReds(); }catch(e){}
}
function loadProgress(){
  go('s-progress');_renderEncartOsseux();renderBandeauPhase();
  // R32 — la phrase de synthese, en tete.
  try{ _renderSyntheseProgression(); }catch(e){}
  // R20 — L'ONGLET OU L'ATHLETE S'ETAIT ARRETE, et non plus toujours « Poids ».
  // Un nom inconnu (ancien onglet, valeur abimee) retombe sur « Poids ».
  // LE REPLI SUR DONNEES ABSENTES N'EST PAS ECRIT : « Perfs » choisi sur un
  // compte sans seance s'ouvre sur « Poids », mais reste le choix memorise —
  // la premiere seance faite, Évolution rouvrira sur « Perfs ». D'ou le
  // troisieme argument, qui coupe la memorisation pour ce rendu-ci.
  const _memo=currentUser&&currentUser.uiProgressTab;
  let _onglet=PROG_ONGLETS.indexOf(_memo)>=0?_memo:'poids';
  if(_onglet!=='poids'&&_progOngletVide(_onglet,currentUser)) _onglet='poids';
  showProgressTab(_onglet,_progBoutonOnglet(_onglet),true);
  // LE DEGRADE ET LE BADGE « +n » SONT RETIRES AVEC LE DEFILEMENT. Ils
  // annoncaient ce qui depassait a droite ; la bande se repliant desormais,
  // plus rien ne depasse et le badge aurait compte zero onglet cache tout en
  // masquant le coin du dernier bouton.
}

/* --- helpers --- */
function getBW(b){const v=parseFloat(b['bil-weight']||b['deb-weight']||b.weight);return isNaN(v)?null:v;}
function getBM(b,k){const v=parseFloat(b['bil-'+k]||b['deb-'+k]||b[k]);return isNaN(v)?null:v;}
// ══ LES GROUPES DE MENSURATIONS TRACABLES ══════════════════════════════════
//
// Ils servent a DEUX ecrans : l'onglet Mensurations de l'athlete, et le schema
// corporel de la fiche coach. Une liste par ecran aurait fini par decouper le
// meme corps de deux facons.
//
// TOUR DE HANCHE et TOUR DE COU n'ont pas de courbe : ils bougent trop peu pour
// qu'une ligne dise quoi que ce soit. Ils restent dans le TABLEAU — la donnee
// n'est pas perdue, elle n'a simplement pas besoin de son propre graphique.
const MENS_GROUPES=Object.freeze([
  {label:'Biceps (D / G)',items:[{k:'bicep-r',l:'Droit',color:ROUGE_MARQUE},{k:'bicep-l',l:'Gauche',color:'#f97316'}]},
  {label:'Cuisses (D / G)',items:[{k:'thigh-r',l:'Droit',color:'#06b6d4'},{k:'thigh-l',l:'Gauche',color:'#14b8a6'}]},
  {label:'Mollets (D / G)',items:[{k:'calf-r',l:'Droit',color:'#f472b6'},{k:'calf-l',l:'Gauche',color:'#a78bfa'}]},
  {label:'Tour de Poitrine',items:[{k:'chest',l:'',color:'#eab308'}]},
  {label:'Tour de Taille',items:[{k:'waist',l:'',color:'#3b82f6'}]},
  {label:'Fessier',items:[{k:'glutes',l:'',color:'#22c55e'}]},
  {label:'Buste',items:[{k:'bust',l:'',color:'#fb923c'}]}
]);
// ══ R32 — LA SYNTHESE D'EVOLUTION, ET CE QUE LE BILAN VIENT DE CHANGER ══════
//
// Deux lectures des MEMES bilans (bilansOrdonnes, getBW, getBM, MEAS) : la
// phrase en tete d'Evolution, et l'ecran qui suit l'envoi d'un bilan. Rien n'est
// ecrit, rien n'est recalcule a cote : ce sont des lectures.
//
// ⚠ LA PRUDENCE, ICI, N'EST PAS UNE OPTION.
// - AUCUN CHIFFRE INVENTE : une valeur absente de l'un des deux bilans sort de
//   la comparaison, elle n'est ni estimee ni reportee.
// - AUCUN JUGEMENT : « +2,1 kg », jamais « bonne progression ». Pas de rouge.
// - LE VERT SEULEMENT QUAND ON SAIT : pour le poids, et seulement si une phase
//   declaree donne un sens (masse : monter, seche : descendre). Maintien,
//   recomposition, peak week, aucune phase, ou mode neutre (TCA) : gris. Les
//   mensurations et l'e1RM restent gris — aucun objectif declare ne dit dans
//   quel sens un tour de cuisse « doit » aller.
// - « STABLE » SOUS LE BRUIT DE MESURE : 0,3 kg pour le poids, 0,5 cm pour une
//   mensuration. En dessous, un ecart n'est pas un signal.
// - masquerPoids : le poids n'apparait NULLE PART.
const SYN_SEMAINES=8;
const SYN_BRUIT_POIDS=0.3;
const SYN_BRUIT_MESURE=0.5;
const SYN_ECART_E1RM_MIN=0.5;
// « 2,1 », « 7,5 » : une decimale, virgule francaise.
function _synNombre(v){ return String(Math.round(Math.abs(Number(v))*10)/10).replace('.',','); }
// PURE. Un ecart dit : « +2,1 kg », « −0,6 cm », ou « stable » sous le bruit.
function _synEcart(v,unite,bruit){
  const d=Number(v);
  if(!isFinite(d)||Math.abs(d)<bruit) return {delta:'stable',sens:'stable'};
  return {delta:(d>0?'+':'−')+_synNombre(d)+' '+unite,sens:d>0?'hausse':'baisse'};
}
// « Tour de Biceps D » → « tour de biceps droit ».
function _libMesure(l,majuscule){
  let s=String(l||'').replace(/ D$/,' droit').replace(/ G$/,' gauche').toLowerCase();
  return majuscule?s.charAt(0).toUpperCase()+s.slice(1):s;
}
// PURE. Le poids va-t-il dans le sens de l'objectif DECLARE ? Faux dès qu'on
// ne peut pas le dire avec certitude.
function _synPoidsDansLeSens(user,d){
  if(!user||aTCA(user)) return false;
  const p=phaseCourante(user);
  const sens=(p&&PHASES[p.type])?PHASES[p.type].sens:0;
  if(!sens||!isFinite(d)||Math.abs(d)<SYN_BRUIT_POIDS) return false;
  return (d>0)===(sens>0);
}
// « 8 semaines », « 5 jours ».
function _synPeriode(debut,fin){
  const j=Math.max(0,Math.round((fin-debut)/864e5));
  if(j>=7){ const s=Math.round(j/7); return s+' semaine'+(s>1?'s':''); }
  return j+' jour'+(j>1?'s':'');
}
// La fenetre : le DERNIER bilan, et le premier bilan des huit semaines qui le
// precedent — ou le plus ancien disponible quand l'historique est plus court.
// Si aucun bilan ne tombe dans la fenetre, le plus recent d'avant elle.
function _synBilansFenetre(user){
  const bl=bilansOrdonnes(user);
  if(bl.length<2) return null;
  const der=bl[bl.length-1];
  const avant=bl.slice(0,-1);
  const debut=der.date-SYN_SEMAINES*7*864e5;
  const prem=avant.find(b=>b.date>=debut)||avant[avant.length-1];
  return (prem&&prem.date<der.date)?{prem,der}:null;
}
// PURE. L'exercice dont l'e1RM a le plus progresse entre deux dates : premiere
// et derniere seance de la periode, e1RM seulement (au-dela de 12 repetitions
// le modele ne vaut plus), jamais une seance mixte ni une decharge. Null si
// rien n'a progresse d'au moins un demi-kilo.
function _synMeilleurE1rm(user,debut,fin){
  const par=new Map();
  for(const s of ((user&&user.sessions)||[])){
    if(!s||!s.date||!s.data||s.deload) continue;
    if(s.date<debut||s.date>fin) continue;
    for(const nom of Object.keys(s.data)){
      let p=null;
      try{ p=perfExercice(s,nom,user); }catch(e){ p=null; }
      if(!p||p.metrique!=='e1RM'||p.mixte||!(p.score>0)) continue;
      let k=nom; try{ k=exKey(nom)||nom; }catch(e){}
      const e=par.get(k)||{nom,points:[]};
      e.points.push({date:s.date,score:p.score});
      par.set(k,e);
    }
  }
  let best=null;
  for(const e of par.values()){
    if(e.points.length<2) continue;
    e.points.sort((a,b)=>a.date-b.date);
    const d=e.points[e.points.length-1].score-e.points[0].score;
    if(d>=SYN_ECART_E1RM_MIN&&(!best||d>best.d)) best={nom:e.nom,d};
  }
  return best;
}
// PURE. La synthese, ou null. { periode, elements:[{type, libelle, delta, sens,
// accord}] } — trois elements au plus : le poids, la mensuration qui a le plus
// bouge, l'exercice qui a le plus progresse. `accord` porte le vert.
function syntheseProgression(user){
  if(!user) return null;
  const f=_synBilansFenetre(user);
  if(!f) return null;
  const {prem,der}=f;
  const elements=[];
  if(!user.masquerPoids){
    const a=getBW(prem), b=getBW(der);
    if(a!=null&&b!=null){
      const e=_synEcart(b-a,'kg',SYN_BRUIT_POIDS);
      elements.push({type:'poids',libelle:'poids',delta:e.delta,sens:e.sens,accord:_synPoidsDansLeSens(user,b-a)});
    }
  }
  // LA MENSURATION QUI A LE PLUS BOUGE, en valeur absolue. A egalite, le tour de
  // taille : c'est la mesure que l'athlete regarde d'abord.
  let best=null;
  for(const m of MEAS){
    const a=getBM(prem,m.k), b=getBM(der,m.k);
    if(a==null||b==null) continue;
    const d=b-a, ad=Math.abs(d), bd=best?Math.abs(best.d):-1;
    if(ad>bd+1e-9||(best&&Math.abs(ad-bd)<1e-9&&m.k==='waist')) best={m,d};
  }
  if(best){
    const e=_synEcart(best.d,'cm',SYN_BRUIT_MESURE);
    elements.push({type:'mesure',cle:best.m.k,libelle:_libMesure(best.m.l),delta:e.delta,sens:e.sens,accord:false});
  }
  const ex=_synMeilleurE1rm(user,prem.date,der.date);
  if(ex){
    const v=Math.round(ex.d*2)/2;
    elements.push({type:'exercice',libelle:String(ex.nom).toLowerCase(),
      delta:'+'+String(v).replace('.',',')+' kg d\'e1RM',sens:'hausse',accord:false});
  }
  if(!elements.length) return null;
  return {periode:_synPeriode(prem.date,der.date),elements:elements.slice(0,3)};
}
function _htmlSyntheseProgression(user){
  let s=null;
  try{ s=syntheseProgression(user); }catch(e){ s=null; }
  // MOINS DE DEUX BILANS : RIEN, pas « données insuffisantes ». L'etat vide de
  // chaque onglet le dit deja, et deux fois serait une de trop.
  if(!s) return '';
  return '<div class="prog-synthese">Sur '+escapeHtml(s.periode)+' : '
    +s.elements.map(e=>'<span class="syn-el">'+escapeHtml(e.libelle)+' <span class="syn-d'+(e.accord?' syn-vert':'')+'">'
      +escapeHtml(e.delta)+'</span>'+(e.type==='exercice'?rcInfo('e1rm'):'')+'</span>').join('<span class="syn-sep"> · </span>')
    +'</div>';
}
function _renderSyntheseProgression(){
  const z=document.getElementById('prog-synthese');
  if(z) z.innerHTML=_htmlSyntheseProgression(currentUser);
}
// ── L'ECRAN QUI SUIT LE BILAN ─────────────────────────────────────────────
// PURE. Ce que dit l'ecran de restitution. Il ne lit QUE le poids, les
// mensurations (MEAS) et le nombre de photos : aucune reponse de sante, aucun
// drapeau, aucune reponse au depistage (elles ne sont de toute facon pas
// conservees). Trois lignes d'ecart au plus.
const RESTIT_LIGNES_MAX=3;
function restitutionBilan(user,now){
  const bl=bilansOrdonnes(user);
  if(!bl.length) return null;
  const der=bl[bl.length-1];
  const depart=bl.length===1||der.type==='depart';
  const out={depart,lignes:[],coach:_phraseCoachBilan(user,now)};
  if(depart){
    // CE QUI A ETE ENREGISTRE, tel quel.
    if(!user.masquerPoids){
      const w=getBW(der);
      if(w!=null) out.lignes.push({libelle:'Poids',valeur:_synNombre(w)+' kg'});
    }
    for(const m of MEAS){
      const v=getBM(der,m.k);
      if(v!=null) out.lignes.push({libelle:_libMesure(m.l,true),valeur:_synNombre(v)+' cm'});
    }
    // LES VERDICTS NE SONT PAS DES PHOTOS. Depuis le controle a l'envoi (1573),
    // chaque photo gardee pose a cote d'elle `<cle>-ctl` ('vert|', 'orange|…') :
    // compter toute cle contenant « photo » rendait « Photos : 4 » pour deux.
    const photos=Object.keys(der).filter(k=>/photo/i.test(k)&&!/-ctl$/.test(k)&&der[k]).length;
    if(photos) out.lignes.push({libelle:'Photos',valeur:String(photos)});
    return out;
  }
  const prev=bl[bl.length-2];
  if(!user.masquerPoids){
    const a=getBW(prev), b=getBW(der);
    if(a!=null&&b!=null){
      const e=_synEcart(b-a,'kg',SYN_BRUIT_POIDS);
      out.lignes.push({libelle:'Poids',valeur:e.delta,sens:e.sens,accord:_synPoidsDansLeSens(user,b-a)});
    }
  }
  const mes=[];
  MEAS.forEach((m,i)=>{
    const a=getBM(prev,m.k), b=getBM(der,m.k);
    if(a==null||b==null) return;
    mes.push({m,i,d:b-a});
  });
  mes.sort((x,y)=>(Math.abs(y.d)-Math.abs(x.d))||(x.i-y.i));
  for(const x of mes){
    if(out.lignes.length>=RESTIT_LIGNES_MAX) break;
    const e=_synEcart(x.d,'cm',SYN_BRUIT_MESURE);
    out.lignes.push({libelle:_libMesure(x.m.l,true),valeur:e.delta,sens:e.sens,accord:false});
  }
  return out;
}
// LA PHRASE DU COACH. « Il te répond sous 48 h » ne s'ecrit que si on peut le
// tenir : la seule donnee de delai que l'athlete a le droit de lire est celle
// que le coach DECLARE (dispo.delaiH), deja affichee ailleurs sous la forme
// « Répond habituellement sous… ». Le delai median reel est reserve au coach.
// Sans delai declare : « Ton coach est prévenu. », rien de plus. Et pas de
// « Il » : le produit ne connait pas le genre du coach.
function _phraseCoachBilan(user,now){
  if(!user||!user.coachId) return 'Ton bilan est enregistré. Tu le retrouveras dans Évolution.';
  const t=(typeof now==='number')?now:Date.now();
  let suite='';
  try{
    const d=(profilCoachLocal(cleCoachDe(user))||{}).dispo||null;
    if(d&&absenceEnCours(d,t)){
      suite=' Absence déclarée jusqu\'au '+_dispoDateCourte(_dispoTs(d.absence.au))+'.';
    } else {
      const lib=dispoLibelle(d,t);
      if(lib){
        const nom=String(user.coachName||'').trim();
        suite=' '+(nom?nom+' '+lib.charAt(0).toLowerCase()+lib.slice(1):lib)+'.';
      }
    }
  }catch(e){ suite=''; }
  return 'Ton coach est prévenu.'+suite;
}
function _htmlRestitutionBilan(user){
  let r=null;
  try{ r=restitutionBilan(user,Date.now()); }catch(e){ r=null; }
  const ligne=l=>'<div class="rb-ligne"><span class="rb-l">'+escapeHtml(l.libelle)+'</span>'
    +'<span class="rb-v'+(l.accord?' syn-vert':'')+'">'+escapeHtml(l.valeur)+'</span></div>';
  let corps='';
  if(r&&r.depart){
    corps='<p class="rb-texte">Ton point de départ est enregistré. C\'est à partir de là que se mesurera ta progression.</p>'
      +(r.lignes.length?'<div class="rb-carte"><div class="rb-titre-carte">Enregistré</div>'+r.lignes.map(ligne).join('')+'</div>':'');
  } else if(r&&r.lignes.length){
    corps='<div class="rb-carte"><div class="rb-titre-carte">Depuis ton bilan précédent</div>'+r.lignes.map(ligne).join('')+'</div>';
  }
  return '<h1 class="rb-titre">Bilan enregistré</h1>'
    +corps
    +'<p class="rb-coach">'+escapeHtml(r?r.coach:_phraseCoachBilan(user))+'</p>'
    +'<button type="button" class="btn btn-red" onclick="loadProgress()">Voir ma progression</button>'
    +'<button type="button" class="btn btn-outline" style="margin-top:10px" onclick="go(\'s-client-home\');loadClientHome()">Retour à l\'accueil</button>';
}
// LA REPRISE APRES L'ACCORD DE SANTE. Le bilan attendait en memoire (bilData,
// bilType) pendant la question : on l'enregistre, et l'ecran de restitution
// suit exactement comme depuis bilNext — seulement si le bilan s'est ecrit.
function _bilanReprendreApresAccord(){
  if(!currentUser) return false;
  const avant=(currentUser.bilans||[]).length;
  try{ saveBilanFinal(); }catch(e){ return false; }
  if((currentUser.bilans||[]).length>avant){ try{ ouvrirRestitutionBilan(); }catch(e){} return true; }
  return false;
}
// Ouvert par bilNext, APRES saveBilanFinal — qui n'est pas modifiee : elle
// ramene a l'accueil, et cet ecran prend la place tout de suite derriere.
function ouvrirRestitutionBilan(){
  const z=document.getElementById('bf-contenu');
  if(!z||!currentUser) return false;
  z.innerHTML=_htmlRestitutionBilan(currentUser);
  go('s-bilan-fait');
  return true;
}
// PURE. Cette mesure a-t-elle été RELEVÉE à ce bilan, ou seulement reportée du
// précédent parce que rien n'avait bougé ? La valeur est la même et compte
// pareil ; ce qui change, c'est ce qu'on en dit — un report ne se donne jamais
// pour un relevé frais.
function bmReportee(b,k){
  try{ return ((b&&b.reprises)||[]).indexOf('bil-'+k)>=0; }catch(e){ return false; }
}
// ══════════════ L'ECART GAUCHE / DROITE ════════════════════════════════
//
// ⚠ LE PIEGE PRINCIPAL, ET IL EST DEVANT LA PORTE : UNE VALEUR REPORTEE.
// Quand l'athlete confirme qu'un tour de bras n'a pas bouge, RepCore recopie
// la valeur du bilan precedent et la marque `bmReportee`. Comparer une mesure
// du jour a une mesure d'il y a six semaines fabrique une asymetrie qui
// n'existe pas : le cote re-mesure a bouge, l'autre est fige. TOUTE PAIRE
// DONT L'UN DES DEUX COTES EST REPORTE EST ECARTEE — pas corrigee, pas
// ponderee : ecartee.
//
// ⚠ ET DEUX ECARTS ENTRE LA FICHE ET LE CODE :
//
// 1. IL N'EXISTE AUCUNE MESURE D'AVANT-BRAS. MEAS porte trois paires —
//    bicep, thigh, calf — et rien d'autre de bilateral. Le seuil de
//    l'avant-bras est donc pose dans la table pour le jour ou la mesure
//    existera, et il est INERTE aujourd'hui. L'ecrire vaut mieux que de
//    l'omettre : le jour ou la paire arrive, le seuil est deja la et il ne
//    sera pas invente a la hate.
//
// 2. LE SEUIL EST UNE FRONTIERE ENTRE MESURE ET BRUIT. Le metre-ruban a une
//    erreur de l'ordre du demi-centimetre : sur un bras de 38 cm, c'est
//    deja 1,3 %. Sous les seuils, ce n'est pas une petite asymetrie, c'est du
//    bruit — et LE DIRE est plus utile que de tracer une ligne.
const ASYM_PAIRES=Object.freeze([
  {site:'bicep', lib:'Bras',       g:'bicep-l', d:'bicep-r', seuil:0.03},
  {site:'thigh', lib:'Cuisse',     g:'thigh-l', d:'thigh-r', seuil:0.025},
  {site:'calf',  lib:'Mollet',     g:'calf-l',  d:'calf-r',  seuil:0.03},
  // INERTE : aucune de ces deux clefs n'existe dans MEAS aujourd'hui.
  {site:'forearm',lib:'Avant-bras',g:'forearm-l',d:'forearm-r',seuil:0.03}
]);
const ASYM_BILANS=3;               // trois bilans consecutifs, pas deux

// PURE. L'ecart d'UNE paire sur UN bilan, ou null.
//
// null couvre trois cas differents et ils se valent tous les trois ici : un
// cote manquant, un cote a zero, un cote reporte. Aucun n'est un ecart de
// zero — et les confondre ferait entrer des symetries parfaites imaginaires
// dans une suite qui sert a decider.
function ecartPaire(bilan,paire){
  if(!bilan||!paire) return null;
  if(bmReportee(bilan,paire.g)||bmReportee(bilan,paire.d)) return null;
  const g=getBM(bilan,paire.g), d=getBM(bilan,paire.d);
  const ng=Number(g), nd=Number(d);
  if(!isFinite(ng)||!isFinite(nd)||!(ng>0)||!(nd>0)) return null;
  const moy=(ng+nd)/2;
  if(!(moy>0)) return null;
  const brut=nd-ng;                                  // signe : + = droite plus grosse
  return {site:paire.site,lib:paire.lib,gauche:ng,droite:nd,
    ecart:Math.abs(brut),signe:brut>0?1:(brut<0?-1:0),
    fort:brut>0?'droite':(brut<0?'gauche':null),
    ecartRelatif:Math.abs(brut)/moy,seuil:paire.seuil};
}
// PURE. Tous les ecarts d'un bilan, paires ecartees comprises — elles rendent
// null, et l'appelant sait alors qu'il n'y a rien a lire plutot que rien a
// signaler.
function ecartsBilan(bilan){
  const out={};
  for(const p of ASYM_PAIRES) out[p.site]=ecartPaire(bilan,p);
  return out;
}

// PURE. LA QUALIFICATION. Rend l'asymetrie averee d'un site, ou null.
//
// TROIS BILANS CONSECUTIFS, ET DANS LE MEME SENS. Une mesure isolee ne dit
// rien : c'est le metre-ruban, pas le muscle. « Consecutifs » se lit sur les
// trois DERNIERS bilans du dossier — pas sur les trois derniers ou la paire
// etait lisible. Un bilan ou l'un des cotes a ete reporte COUPE la suite : la
// serie n'est pas continue, et on ne la recolle pas par-dessus le trou.
function asymetrieSite(bilans,site,seuilPerso){
  const p=ASYM_PAIRES.filter(x=>x.site===site)[0];
  if(!p) return null;
  const l=(bilans||[]).filter(b=>b&&typeof b.date==='number')
                      .slice().sort((a,b)=>a.date-b.date);
  if(l.length<ASYM_BILANS) return null;
  const der=l.slice(-ASYM_BILANS);
  const seuil=(typeof seuilPerso==='number'&&seuilPerso>0)?seuilPerso:p.seuil;
  const e=[];
  for(const b of der){
    const x=ecartPaire(b,p);
    // UN TROU COUPE LA SUITE. Reporte, incomplet, illisible : dans les trois
    // cas la serie n'est plus consecutive.
    if(!x) return null;
    e.push(x);
  }
  // MEME SENS SUR LES TROIS. Un bras plus gros puis l'autre, c'est la main
  // qui tient le metre qui change, pas le corps.
  const s=e[0].signe;
  if(s===0) return null;
  if(!e.every(x=>x.signe===s)) return null;
  // AU-DESSUS DU SEUIL SUR LES TROIS. Deux fois au-dessus et une fois en
  // dessous, c'est une mesure qui oscille autour de la frontiere du bruit.
  if(!e.every(x=>x.ecartRelatif>=seuil)) return null;
  const dernier=e[e.length-1];
  return {site:site,lib:p.lib,fort:dernier.fort,
    ecart:dernier.ecart,ecartRelatif:dernier.ecartRelatif,
    seuil:seuil,bilans:ASYM_BILANS,
    // La suite complete : c'est elle qui permet au coach de voir que ce n'est
    // pas un accident de mesure.
    suite:e.map(x=>Math.round(x.ecart*10)/10)};
}
// PURE. Toutes les asymetries averees d'un dossier, la plus marquee d'abord.
function asymetries(user){
  const u=_dossier(user);
  const b=(u&&u.bilans)||[];
  const out=[];
  for(const p of ASYM_PAIRES){
    const a=asymetrieSite(b,p.site);
    if(a) out.push(a);
  }
  return out.sort((x,y)=>y.ecartRelatif-x.ecartRelatif);
}
// ── LA CONSEQUENCE : LE SIGNAL, LA PHRASE, LE GESTE ────────────────────
//
// ⚠ DEUX NOTIONS D'« UNILATERAL » COEXISTAIENT, et il fallait choisir sans en
// ecrire une troisieme : exUnilateral(nom) le devine du nom, et la fiche de
// banque porte un champ `unilateral` DECLARE par le coach. La declaration
// gagne quand elle existe — c'est un fait saisi, pas une deduction — et le
// nom sert de repli pour tout ce qui n'est pas dans la banque. Un seul
// accesseur, ici.
function estUnilateral(ex,user){
  const nom=String((ex&&(ex.name||ex))||'');
  if(!nom) return false;
  try{
    const f=ficheBanque(nom,user);
    if(f&&typeof f.unilateral==='boolean') return f.unilateral;
  }catch(e){}
  try{ return exUnilateral(nom); }catch(e){ return false; }
}
// Les patrons qui travaillent un site mesure. On passe par le SCHEMA et non
// par le muscle : c'est le decoupage deja partage par la substitution, la
// charge axiale et les regles d'emploi.
const ASYM_SCHEMAS=Object.freeze({
  bicep:['isolation-coude'],
  thigh:['isolation-genou','squat','fente'],
  calf:['mollets-cheville'],
  forearm:['poignet-avant-bras']
});
// PURE. Les exercices unilateraux du programme qui touchent le site. Rend []
// quand il n'y en a pas — et une liste vide N'EST PAS un echec : le geste
// reste valable, il n'a simplement pas d'exercice a nommer.
function exercicesUnilaterauxSite(user,site){
  const u=_dossier(user);
  if(!u) return [];
  try{ _aplatirSessionsConfig(u); }catch(e){}
  const schemas=ASYM_SCHEMAS[site]||[];
  const out=[];
  for(const sc of (Array.isArray(u.sessions_config)?u.sessions_config:[])){
    if(!sc||!sc.active||!Array.isArray(sc.exercises)) continue;
    for(const e of sc.exercises){
      if(!e||!e.name) continue;
      if(!estUnilateral(e,u)) continue;
      let s=null; try{ s=schemaDe(e,u); }catch(err){ s=null; }
      if(s&&schemas.indexOf(s)>=0&&out.indexOf(e.name)<0) out.push(e.name);
    }
  }
  return out;
}
// PURE. LA PHRASE ET LE GESTE.
//
// ⚠ ON NE PROPOSE PAS DE SERIES SUPPLEMENTAIRES DU COTE FAIBLE. C'est le
// reflexe evident et c'est l'inverse du protocole tenu par les coachs :
// ajouter du volume unilateral d'un seul cote cree une asymetrie DE FATIGUE
// par-dessus l'asymetrie de taille, et le cote faible recupere moins bien que
// celui qu'on voulait rattraper. Le cote FORT s'aligne sur le faible, a
// volume egal — et le cote faible passe en premier, quand il est frais.
function phraseAsymetrie(a){
  if(!a) return '';
  const cm=String(Math.round(a.ecart*10)/10).replace('.',',');
  const cote=a.fort==='droite'?'droit':'gauche';
  // « sur trois bilans » et non « sur 3 bilans » : c'est une phrase, pas un
  // releve, et le chiffre isole y ferait tache.
  const n=({1:'un',2:'deux',3:'trois',4:'quatre'})[a.bilans]||String(a.bilans);
  return a.lib+' '+cote+' +'+cm+' cm sur '+n+' bilans.';
}
function gesteAsymetrie(a,user){
  if(!a) return '';
  const faible=a.fort==='droite'?'gauche':'droit';
  const ex=(user!==undefined)?exercicesUnilaterauxSite(user,a.site):[];
  return 'Les exercices unilatéraux du côté '+faible+' passent en premier, et le '
    +'côté fort s’aligne sur le nombre de répétitions du côté faible.'
    +(ex.length?' Concernés : '+ex.slice(0,3).join(', ')+'.':'');
}
// PURE. Le signal complet, tel que la fiche coach le lit.
// PRIORITE BASSE, et c'est deliberé : une asymetrie de 3 % ne se corrige pas
// dans la semaine, et la faire remonter au-dessus d'une douleur serait
// deplacer le regard du coach au mauvais endroit.
const ASYM_GRAVITE=3;
function signalAsymetrie(user){
  const l=asymetries(user);
  if(!l.length) return null;
  const a=l[0];
  return {code:'asymetrie',gravite:ASYM_GRAVITE,site:a.site,
    phrase:phraseAsymetrie(a),geste:gesteAsymetrie(a,user),
    ecart:a.ecart,ecartRelatif:a.ecartRelatif,toutes:l};
}
// PURE. LA CELLULE « ECART » D'UNE LIGNE DE MENSURATION, sur le DERNIER
// bilan. Rend null — donc « — » a l'affichage — quand il n'y a rien a dire.
//
// ⚠ VIDE, ET SURTOUT PAS ZERO. Une paire incomplete ou reportee n'a pas un
// ecart nul : elle n'a pas d'ecart du tout. Afficher « 0 » ferait lire une
// symetrie parfaite la ou l'on n'a rien mesure — et sur ce sujet precis,
// c'est exactement le contresens que la fonctionnalite doit eviter.
//
// ⚠ ET LA VALEUR EST UNE CHAINE, PAS UN NOMBRE. renderDataTable traite 0,
// '0' et '' comme des cases vides : un ecart reellement nul — les deux cotes
// a 38,0 — serait tombe dans le meme trou que « pas mesurable ». Formatee a
// une decimale, « 0,0 » se distingue de « — » et dit ce qu'il dit.
//
// LES DEUX LIGNES D'UNE PAIRE PORTENT LE SIGNE : « +1,6 » du cote fort,
// « −1,6 » du cote faible. Chaque ligne se lit alors seule, sans avoir a
// chercher l'autre pour savoir de quel cote penche l'ecart.
function _cellEcartMensuration(bilans,cle){
  const l=(bilans||[]).filter(b=>b&&typeof b.date==='number');
  if(!l.length) return null;
  const dernier=l[l.length-1];
  for(const p of ASYM_PAIRES){
    if(p.g!==cle&&p.d!==cle) continue;
    const e=ecartPaire(dernier,p);
    if(!e) return null;
    const signe=(cle===p.d)?e.signe:-e.signe;
    const v=Math.round(e.ecart*10)/10;
    if(v===0) return '0,0';
    return (signe>0?'+':'−')+String(v).replace('.',',');
  }
  return null;                        // mesure non bilaterale : rien a dire
}
// ══ R33 — CE QUE L'ONGLET MASSE GRASSE DIT QUAND IL N'A PAS DE CHIFFRE ══════
//
// L'ecart entre deux bilans sous le bruit : la formule US Navy a une marge de
// 3 a 4 points, un point d'ecart ne dit rien. Au plus un point : « stable ».
// SEUL L'ECART EST CONCERNE : chaque valeur de bilan reste affichee telle quelle.
const MG_BRUIT_POINTS=1.0;
function ecartMasseGrasse(diff){
  if(diff==null||!isFinite(diff)) return null;
  if(Math.abs(diff)<=MG_BRUIT_POINTS) return 'stable';
  return (diff>0?'+':'')+diff+'%';
}
// PURE. Pourquoi calcBF rend null pour ce bilan, dit comme on le dit dans
// l'onglet Mensurations : ce qui manque, et quand le reprendre. Null quand le
// bilan a tout ce qu'il faut. La taille manquante a son propre message, plus
// haut dans la carte : elle ne se releve pas au bilan, elle se saisit ici.
function messageMesuresMasseGrasse(b,female){
  if(!b) return null;
  const manque=[];
  if(getBM(b,'waist')==null) manque.push('ton tour de taille');
  if(getBM(b,'neck')==null) manque.push('ton tour de cou');
  if(female&&getBM(b,'hips')==null) manque.push('ton tour de hanches');
  if(manque.length){
    const liste=manque.length===1?manque[0]
      :manque.slice(0,-1).join(', ')+' et '+manque[manque.length-1];
    return 'Il manque '+liste+' pour estimer ta masse grasse. Relève-'
      +(manque.length>1?'les':'le')+' au prochain bilan.';
  }
  // Toutes les mesures, et pourtant pas de chiffre : chez l'homme, la formule
  // prend le logarithme de (taille − cou), impossible si le cou est plus grand.
  if(!female){
    const w=getBM(b,'waist'), n=getBM(b,'neck');
    if(w!=null&&n!=null&&w<=n)
      return 'Ton tour de taille ('+String(w).replace('.',',')+' cm) n’est pas plus grand que ton tour de cou ('
        +String(n).replace('.',',')+' cm) : la masse grasse ne peut pas être estimée. Vérifie ces deux mesures au prochain bilan.';
  }
  return null;
}
function calcBF(waist,neck,hips,height,gender){
  // Formule US Navy (mesures en cm)
  if(!waist||!neck||!height) return null;
  const female=isFemale(gender);
  try{
    let bf;
    if(female){
      if(!hips) return null;
      bf=495/(1.29579-0.35004*Math.log10(waist+hips-neck)+0.22100*Math.log10(height))-450;
    } else {
      if(waist<=neck) return null;
      bf=495/(1.0324-0.19077*Math.log10(waist-neck)+0.15456*Math.log10(height))-450;
    }
    if(!isFinite(bf)||isNaN(bf)) return null;
    return Math.max(2,Math.min(60,Math.round(bf*10)/10));
  }catch{return null;}
}
// L'ANNEAU. Refait en ARCS TRACÉS et non plus en parts recouvertes par un
// disque. Le resultat a l'ecran est proche, mais tracer un arc donne trois
// choses qu'un camembert masque ne donne pas : un jeu entre les segments,
// des bouts arrondis, et une piste sombre visible derriere — ce qui fait la
// difference entre un diagramme et un objet dessine.
// `opts.label` : un mot au-dessus du pourcentage (« masse grasse ») ;
// `opts.max` : le diametre plafond, 120 px par defaut.
function drawPie(id,slices,opts){
  const o=opts||{};
  const cv=document.getElementById(id);if(!cv)return;
  const sz=Math.min(cv.parentElement.offsetWidth||120,o.max||120);
  // DENSITÉ D'ÉCRAN, comme _setupCanvas : sans elle, 110 pixels de toile sont
  // étirés sur 330 pixels physiques et tout l'anneau est mou.
  const dpr=Math.min(window.devicePixelRatio||1,3);
  cv.width=Math.round(sz*dpr);cv.height=Math.round(sz*dpr);
  cv.style.width=sz+'px';cv.style.height=sz+'px';
  const ctx=cv.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,sz,sz);
  const cx=sz/2,cy=sz/2,ep=sz*0.15,R=cx*0.88-ep/2;
  const total=slices.reduce((s,x)=>s+x.val,0)||1;
  // La piste : elle donne un fond au segment le plus fin, qui sans elle
  // flotte dans le vide des qu'il descend sous quelques pour cent.
  ctx.strokeStyle='#161616';ctx.lineWidth=ep;
  ctx.beginPath();ctx.arc(cx,cy,R,0,2*Math.PI);ctx.stroke();
  // Le jeu entre segments est retire de chacun, pas ajoute : la somme des
  // arcs doit rester le tour complet, sinon l'anneau ne ferme pas.
  const jeu=slices.length>1?0.062:0;
  let a=-Math.PI/2;
  slices.forEach(sl=>{
    const sw=2*Math.PI*(sl.val/total);
    if(sw>jeu){
      // Le degrade traverse le disque en diagonale : un aplat de couleur
      // unique est ce qui donne l'aspect imprimé qu'on veut perdre.
      const g=ctx.createLinearGradient(cx-R,cy-R,cx+R,cy+R);
      g.addColorStop(0,sl.color);g.addColorStop(1,sl.color+'99');
      ctx.strokeStyle=g;ctx.lineWidth=ep;
      // Bouts DROITS : un bout arrondi deborde de la moitie de l'epaisseur
      // et recouvrirait entierement la coupure entre deux parts.
      ctx.lineCap='butt';
      ctx.shadowColor=sl.color;ctx.shadowBlur=6;
      ctx.beginPath();ctx.arc(cx,cy,R,a+jeu/2,a+sw-jeu/2);ctx.stroke();
      ctx.shadowBlur=0;
    }
    a+=sw;
  });
  ctx.lineCap='butt';
  // Le coeur : un degre radial plutot qu'un aplat noir, pour que le centre
  // ait un fond et non un trou.
  const gc=ctx.createRadialGradient(cx,cy-sz*0.06,sz*0.02,cx,cy,R-ep/2);
  gc.addColorStop(0,'#1c1c1c');gc.addColorStop(1,'#0b0b0b');
  ctx.beginPath();ctx.arc(cx,cy,R-ep/2,0,2*Math.PI);ctx.fillStyle=gc;ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.05)';ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle=_tok('--text','#efefef');ctx.font=`800 ${Math.round(sz*0.145)}px Montserrat,sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.shadowColor='rgba(255,255,255,.35)';ctx.shadowBlur=10;
  if(o.label){
    ctx.font=`800 ${Math.round(sz*0.19)}px Montserrat,sans-serif`;
    ctx.fillText(Math.round(slices[0].val/total*100)+'%',cx,cy+sz*0.07);
    ctx.shadowBlur=0;
    ctx.fillStyle=_tok('--sub','#9a9a9a');ctx.font=`600 ${Math.round(sz*0.058)}px Montserrat,sans-serif`;
    const mots=String(o.label).toUpperCase().split(' ');
    mots.forEach((m,i)=>ctx.fillText(m,cx,cy-sz*0.1+(i-(mots.length-1)/2)*sz*0.075));
  }else ctx.fillText(Math.round(slices[0].val/total*100)+'%',cx,cy);
  ctx.shadowBlur=0;
}

const MEAS=[
  {k:'bicep-r',l:'Tour de Biceps D',color:ROUGE_MARQUE},
  {k:'bicep-l',l:'Tour de Biceps G',color:'#f97316'},
  {k:'chest',l:'Tour de Poitrine',color:'#eab308'},
  {k:'waist',l:'Tour de Taille',color:'#3b82f6'},
  {k:'hips',l:'Tour de Hanche',color:'#38bdf8'},
  {k:'glutes',l:'Tour de Fessier',color:'#22c55e'},
  {k:'thigh-r',l:'Tour de Cuisse D',color:'#06b6d4'},
  {k:'thigh-l',l:'Tour de Cuisse G',color:'#14b8a6'},
  {k:'calf-r',l:'Tour de Mollet D',color:'#f472b6'},
  {k:'calf-l',l:'Tour de Mollet G',color:'#a78bfa'},
  {k:'bust',l:'Tour de Buste',color:'#fb923c'},
  {k:'neck',l:'Tour de Cou',color:'#94a3b8'},
];
// ══════════════ ONGLET VOLUME (ATHLÈTE) ══════════════
let _volDecalage=0;                 // 0 = semaine courante, 1 = la précédente…
const VOL_SEMAINES_MAX=12;          // profondeur de navigation offerte
// Une semaine sautée ne casse pas la comparaison, une vraie coupure si. Sans
// cette limite, un athlète revenant après cinq semaines d'arrêt se serait vu
// comparer à ses semaines d'avant la coupure, ce qui ne veut rien dire.
const VOL_COUPURE=3;                // semaines vides consécutives = coupure
const VOL_DELTA_N=4;                // semaines entraînées prises pour la moyenne
const VOL_DELTA_MIN=2;              // en dessous, aucun delta n'est affiché

function _volCleDecalee(n){
  const d=_lundiDe(new Date());
  d.setDate(d.getDate()-7*n);
  return semaineISO(d);
}
// Moyenne des VOL_DELTA_N semaines ENTRAÎNÉES précédentes, abandonnée dès
// qu'une coupure est franchie.
function _volMoyennePrecedente(user,decalage,muscle){
  const vals=[]; let vides=0;
  for(let n=decalage+1;n<=decalage+26&&vals.length<VOL_DELTA_N;n++){
    const c=_calculSemaine(user,_volCleDecalee(n));
    if(!c.eligibles){ if(++vides>=VOL_COUPURE) break; continue; }
    vides=0;
    vals.push(c.muscles[muscle]||0);
  }
  if(vals.length<VOL_DELTA_MIN) return null;
  return vals.reduce((a,b)=>a+b,0)/vals.length;
}

function _volBarre(m,n,rep,aberrant,user){
  const z=zoneVolume(n,rep,user);
  // Sans repère, aucune zone : on montre la quantité, on ne la juge pas.
  const echelle=rep?Math.max(rep.mrv*1.25,n*1.05):Math.max(n*1.15,10);
  const pc=v=>Math.max(0,Math.min(100,v/echelle*100));
  const seg=(a,b,c)=>b>a?`<div class="vb-seg" style="left:${pc(a)}%;width:${pc(b)-pc(a)}%;background:${c}"></div>`:'';
  const fond=rep
    ? seg(0,rep.mev,VOL_ZONES[0].c)+seg(rep.mev,rep.mavMin,VOL_ZONES[1].c)
      +seg(rep.mavMin,rep.mavMax,VOL_ZONES[2].c)+seg(rep.mavMax,rep.mrv,VOL_ZONES[3].c)
      +seg(rep.mrv,echelle,VOL_ZONES[4].c)
    : `<div class="vb-seg" style="left:0;width:100%;background:var(--surface-3)"></div>`;
  const couleur=z?z.c:'#8a8a8a';
  // Le remplissage est PLUS FIN que la piste, et centré : à pleine hauteur il
  // recouvrait les seuils déjà franchis, alors que situer la valeur par rapport
  // à eux est tout l'intérêt de la barre. Les zones restent lisibles au-dessus
  // et au-dessous, le trait de MRV traverse le tout.
  // LA PISTE EST UN CALQUE A PART (27/09/2026, maquette de Kevin) : elle seule
  // rogne ses zones, pour que le halo du remplissage et du trait deborde.
  return `<div class="vb${aberrant?' vb-aberrant':''}">
      <div class="vb-piste">${fond}</div>
      <div class="rc-barre vb-rempli" data-bar-w="${pc(n).toFixed(1)}" style="--vb-c:${couleur};width:0;transition:width 480ms var(--c-out) var(--rcv-d,0ms)"></div>
      ${rep?`<div class="vb-repere" style="left:${pc(rep.mrv)}%"></div>`:''}
    </div>`;
}
// L'ICONE DU STATUT, devant son libellé : un triangle pour ce qui monte trop,
// une coche pour la zone de progrès, un rond pour le reste.
function _volIconeZone(z){
  const c=z?z.c:'var(--text-faint)';
  const tri='<path d="M12 3 22 20H2z" fill="'+c+'" fill-opacity=".18" stroke="'+c+'" stroke-width="2" stroke-linejoin="round"/><path d="M12 9.5v5" stroke="'+c+'" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.3" r="1.25" fill="'+c+'"/>';
  const coche='<circle cx="12" cy="12" r="10" fill="'+c+'"/><path d="m7.5 12.3 3 3 6-6.3" fill="none" stroke="#0b0b0b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
  const rond='<circle cx="12" cy="12" r="9" fill="'+c+'" fill-opacity=".18" stroke="'+c+'" stroke-width="2"/><path d="M12 8v4.5" stroke="'+c+'" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="16" r="1.25" fill="'+c+'"/>';
  const k=z&&z.cle;
  return '<svg class="vc-ico" viewBox="0 0 24 24" aria-hidden="true">'
    +(k==='ELEVE'||k==='AU_DESSUS'?tri:k==='PROGRES'?coche:rond)+'</svg>';
}
// L'ILLUSTRATION DU MUSCLE (planche de Kevin, 27/09/2026), teintée à sa
// couleur. Un muscle sans image garde sa carte, sans vignette.
const VOL_ILLUS=new Set(['PECTORAUX','DORSAUX','TRAP_SUP','TRAP_MED','LOMBAIRES','DELT_ANT','DELT_LAT',
  'DELT_POST','BICEPS','TRICEPS','AVANT_BRAS','QUADRICEPS','ISCHIOS','FESSIERS','ABDUCTEURS',
  'ADDUCTEURS','MOLLETS','ABDOS']);
function _volIllus(m){
  return VOL_ILLUS.has(m)?'./img/muscles/'+m.toLowerCase().replace(/_/g,'-')+'.webp':'';
}

function renderVolume(){
  const u=currentUser;
  const cle=_volCleDecalee(_volDecalage);
  const c=_calculSemaine(u,cle);
  const lundi=_lundiDeSemaine(cle);
  const dim=new Date(lundi); dim.setDate(dim.getDate()+6);
  const fmt=d=>d.getDate()+'/'+String(d.getMonth()+1).padStart(2,'0');

  const nav=`<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:14px">
      <button class="hit44" onclick="_volNav(1)" ${_volDecalage>=VOL_SEMAINES_MAX-1?'disabled':''}
        style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-2);color:${_volDecalage>=VOL_SEMAINES_MAX-1?'var(--text-faint)':'var(--text)'};width:38px;height:34px;cursor:pointer;font-size:var(--fs-lg)">←</button>
      <div style="text-align:center;flex:1;min-width:0">
        <div style="font-size:var(--fs-sm);font-weight:800">${_volDecalage===0?'Cette semaine':(_volDecalage===1?'Semaine dernière':'Il y a '+_volDecalage+' semaines')}</div>
        <div style="font-size:var(--fs-2xs);color:var(--sub);margin-top:1px">${fmt(lundi)} au ${fmt(dim)}</div>
      </div>
      <button class="hit44" onclick="_volNav(-1)" ${_volDecalage<=0?'disabled':''}
        style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-2);color:${_volDecalage<=0?'var(--text-faint)':'var(--text)'};width:38px;height:34px;cursor:pointer;font-size:var(--fs-lg)">→</button>
    </div>`;

  // R10 — CE QUI EST COMPTE, DIT SOUS LE TITRE. La definition a ete ecrite
  // APRES lecture de _calculSemaine : ce n'est PAS un tonnage (il a sa carte
  // plus bas), c'est un decompte de series, par muscle, sur la semaine — et
  // un muscle secondaire y recoit une demi-serie (POIDS_ROLE.SECONDAIRE). Rien
  // de plus n'est affirme ici.
  const tete=`<div style="margin-bottom:12px">
      <div style="display:flex;align-items:center;font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase">Volume${rcInfo('volume')}</div>
      <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5">${reperesComptageDe(u)==='direct'
        ?'Séries hebdomadaires par muscle, en séries directes : le travail indirect n’est pas compté, comme dans les repères RP.'
        :'Séries hebdomadaires par muscle. Un muscle secondaire compte une demi-série. Repères RP en séries directes ; tu comptes le travail indirect à 0,5.'}</div>
    </div>`;
  // Bandeau d'honnêteté : permanent, non masquable.
  const bandeau=`<div style="background:var(--surface-2);border-left:3px solid var(--sub);border-radius:var(--r-2);padding:10px 12px;margin-top:16px;font-size:var(--fs-xs);color:var(--sub);line-height:1.6">
      Repères indicatifs. Ils varient fortement d'une personne à l'autre : 
      selon l'expérience, l'âge, le sommeil et la récupération.
      Ils ne remplacent pas l'avis de ton coach.
    </div>`;

  if(!c.seances){
    document.getElementById('progress-content').innerHTML=nav+tete
      +`<div class="sub" style="font-size:var(--fs-sm);background:var(--surface-2);border-radius:var(--r-3);padding:20px;text-align:center;line-height:1.6">
          ${_volDecalage===0?'Fais ta première séance, ton volume apparaîtra ici.':'Aucune séance cette semaine-là.'}
        </div>`+bandeau;
    return;
  }

  const lignes=Object.keys(c.muscles).filter(m=>c.muscles[m]>=0.5)
    .sort((a,b)=>c.muscles[b]-c.muscles[a]);
  const absents=Object.keys(MUSCLES).filter(m=>!(c.muscles[m]>=0.5));

  const corps=lignes.map(m=>{
    const n=c.muscles[m];
    const rep=reperesEffectifs(u,m);
    const z=zoneVolume(n,rep,u);
    const freq=c.freq[m]||0;
    const moy=_volMoyennePrecedente(u,_volDecalage,m);
    let delta='';
    if(moy!=null){
      const d=n-moy;
      const signe=d>0?'+':'';
      // Un écart sous une demi-série n'est pas un mouvement, c'est du bruit.
      if(Math.abs(d)>=0.5) delta=`<span class="vc-delta ${d>0?'vc-plus':'vc-moins'}">${signe}${volAffiche(d)}</span>`;
      else delta=`<span class="vc-delta vc-stable">stable</span>`;
    }
    const illus=_volIllus(m);
    const mc=(MUSCLES[m]||{}).c||'var(--text)';
    return `<div class="vc${illus?'':' vc-sans-illus'}" style="--vc-c:${z?z.c:'#3a3a3a'}">
      ${illus?`<img class="vc-illus" src="${illus}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`:''}
      <div class="vc-corps">
        <div class="vc-tete">
          <span class="vc-nom" style="color:${mc}">${(MUSCLES[m]||{}).lib||m}${rcInfo('zones_volume')}${(()=>{ const _s=(rep&&rep.source)||'table'; if(_s==='table') return ''; return `<span style="font-weight:400;color:var(--text-faint);font-size:var(--fs-2xs)"> · ${_s==='perso'?'ajusté sur ses retours':'fixé par toi'}</span>`; })()}</span>
          <span class="vc-chiffres"><span class="vc-series">${volAffiche(n)} série${n>=2?'s':''}${freq?' · '+freq+'×/sem':''}</span>${delta}</span>
        </div>
        ${_volBarre(m,n,rep,c.aberrants[m],u)}
        <div class="vc-zone" style="color:${z?z.c:'var(--text-faint)'}">
          ${_volIconeZone(z)}<span>${z?z.lib:'pas de repère établi'}</span>${c.aberrants[m]?' <span style="color:var(--orange);font-weight:600">· inhabituel</span>':''}
        </div>
        ${_htmlConcentration(c,m)}
      </div>
    </div>`;
  }).join('');

  // Avertissements, dans l'ordre où ils changent la lecture du chiffre.
  let alertes='';
  if(c.eligibles&&c.sansRir/c.eligibles>VOL_PART_SANS_RIR){
    alertes+=`<div style="background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:var(--r-2);padding:10px 12px;margin-bottom:12px;font-size:var(--fs-xs);color:var(--orange);line-height:1.6">
      Intensité non renseignée sur ${c.sansRir} série${c.sansRir>1?'s':''} : ce comptage est une estimation haute.
    </div>`;
  }
  if(c.nonRattachees){
    alertes+=`<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-2);padding:10px 12px;margin-bottom:12px;font-size:var(--fs-xs);color:var(--sub);line-height:1.6">
      ${c.nonRattachees} série${c.nonRattachees>1?'s':''} non rattachée${c.nonRattachees>1?'s':''} à un muscle
      (${c.exNonRattaches.slice(0,3).map(escapeHtml).join(', ')}${c.exNonRattaches.length>3?'…':''}).
      <button onclick="loadExClassify()" style="background:none;border:none;color:var(--link);font-size:var(--fs-xs);font-family:Montserrat,sans-serif;cursor:pointer;text-decoration:underline;padding:0">Les classer</button>
    </div>`;
  }

  const zero=absents.length?`<div style="margin-top:14px;font-size:var(--fs-xs);color:var(--text-faint);line-height:1.6">
      Aucun volume cette semaine : ${absents.map(m=>(MUSCLES[m]||{}).lib||m).join(', ')}
    </div>`:'';

  // Convention de comptage des techniques d'intensification. Le texte est
  // OBLIGATOIRE : il dit que 1,0 est une convention et non une mesure, et il
  // n'apparait que si l'athlete a reellement pratique une de ces techniques —
  // sinon c'est un avertissement sur un probleme qu'il n'a pas.
  const conv=_techniquesPratiquees(u).length
    ? `<div style="margin-top:14px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);padding:10px 12px;font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6">
        ${escapeHtml(TEXTE_CONVENTION_TECHNIQUE)}
        <div style="margin-top:6px">${_techniquesPratiquees(u).map(f=>escapeHtml(LIB_FAMILLE[f]||f)+' : '+_fmtPoidsTech(poidsTechnique(f,u))+(poidsTechniqueSurcharge(f,u)!=null?' (ajusté)':'')).join(' · ')}</div>
      </div>` : '';
  // Charge axiale : sous les muscles, comme demandé, et sans repère absolu.
  const axial=_htmlChargeAxiale(u,_volDecalage,null,{});
  document.getElementById('progress-content').innerHTML=
    nav+tete+'<div id="prog-muscles"></div>'+alertes+corps+zero+axial+_htmlTonnage(u,_volDecalage)+_htmlRecords(u)
    +_htmlHydratation(u,nutIsOnDay(localISODate(new Date())))+conv+bandeau;
  // LE REMPLISSAGE SEUL BOUGE : le fond zone, le trait de MRV et le contour des
  // valeurs aberrantes sont des REPERES, pas des mesures, et restent poses a
  // leur place. La cascade est plafonnee a huit lignes — au-dela, elle devient
  // une attente.
  try{
    const _pc=document.getElementById('progress-content');
    if(_pc){
      _pc.querySelectorAll('.rc-barre').forEach((b,i)=>b.style.setProperty('--rcv-d',Math.min(i,8)*40+'ms'));
      // Huit colonnes de tonnage au maximum : 385 ms de cascade, aucun plafond
      // necessaire. Nom de variable distinct de celui des barres de semaine.
      _pc.querySelectorAll('.rc-barre-v').forEach((b,i)=>b.style.setProperty('--rcb-d',i*55+'ms'));
      _animerJauges(_pc);
      // _fmtKg garde le separateur de milliers et l'unite du rendu actuel.
      if(document.getElementById('rc-tonnage-num'))
        arcChiffre('rc-tonnage-num',0,tonnageSemaine(u,_volDecalage).kg,{duree:900,format:v=>_fmtKg(v)});
      // Prop 38 : renderVolume ecrit #progress-content sans passer par
      // showProgressTab — sans ce rappel, ses courbes ne se traceraient jamais.
      requestAnimationFrame(()=>arcTracerCourbes(_pc));
    }
  }catch(e){}
  // LA CARTE MUSCULAIRE de la semaine affichée (ou des quatre dernières).
  try{ rendreMusclesEvolution(); }catch(e){}
}
// Familles reellement pratiquees sur la fenetre affichee : on ne parle de
// convention que si elle s'applique a quelque chose.
const LIB_FAMILLE=Object.freeze({normale:'Séries normales',degressive:'Dégressives',
  rest_pause:'Rest-pause',myo_reps:'Mini-séries',superset:'Supersets',
  partielles:'Partielles',isometrie:'Isométrie'});
function _fmtPoidsTech(v){ return String(Math.round(v*100)/100).replace('.',','); }
function _techniquesPratiquees(user){
  const vues=new Set();
  for(const sess of ((user&&user.sessions)||[]).slice(-30)){
    for(const nom of Object.keys((sess&&sess.data)||{})){
      const d=sess.data[nom];
      const f=techniqueDe({name:nom,reps:(d&&d.reps)||'',methode:d&&d.methode,technique:d&&d.technique});
      if(f!=='normale') vues.add(f);
    }
  }
  return [...vues];
}
function _volNav(d){
  const n=_volDecalage+d;
  if(n<0||n>=VOL_SEMAINES_MAX) return;
  _volDecalage=n;
  renderVolume();
}

// ══════════════ CHARGE AXIALE HEBDOMADAIRE ══════════════
// AUCUN repère absolu n'est inventé. REPERES_VOLUME exclut volontairement les
// lombaires faute de consensus de terrain, et cet indicateur ne le contredit
// pas : il ne compare l'athlète qu'à LUI-MÊME, en variation relative. Il ne
// dit jamais « trop » ni « élevé », n'entre pas dans urgencyScore et ne
// déclenche aucune notification. C'est une entrée en conversation, pas une
// alerte.
const AXIAL_ZONE='rachis-lombaire';
const AXIAL_HAUSSE_SIGNAL=0.50;
const AXIAL_NOTE_REPERE='Repère de terrain, pas une mesure : à regarder avec ton coach.';
const AXIAL_INVITE_GRILLE='Charge lombaire : pas encore notée. Renseigne la colonne rachis lombaire de tes schémas pour la suivre.';

// Charge lombaire d'un schéma moteur, de 0 à 3.
// Une zone listée dans `hors` vaut 0 : le schéma A ÉTÉ jugé, il ne charge
// simplement pas cette articulation. Une note ABSENTE n'est pas un zéro —
// c'est « pas encore jugé », comme le dit déjà chargeSchema — et on rend null
// pour que l'appelant puisse le compter au lieu de le confondre avec zéro.
function chargeLombaireSchema(schema,grille){
  if(!schema||!SCHEMAS_META[schema]) return null;
  if((SCHEMAS_META[schema].hors||[]).indexOf(AXIAL_ZONE)>=0) return 0;
  const g=grille||_grilleCharges();
  const v=g&&g[schema]&&g[schema][AXIAL_ZONE];
  return (typeof v==='number'&&isFinite(v)&&v>=CHARGE_MIN&&v<=CHARGE_MAX)?v:null;
}

// PURE. `grille` est explicite : _grilleCharges() lit currentUser, et sur la
// fiche coach c'est bien la grille du COACH qui fait foi — mais autant que ce
// soit un paramètre plutôt qu'un effet de bord.
//
// Le rôle musculaire n'entre PAS dans la pondération : une charge axiale n'a
// pas de muscle primaire ou secondaire, POIDS_ROLE n'aurait rien à pondérer.
// Restent l'intensité et la technique, comme pour le volume.
function chargeAxialeSemaine(user,decalageSemaines,grille){
  const res={points:0,nSeries:0,nExercicesSansSchema:0,nSeriesNonNotees:0,
    exSansSchema:[],schemasNonNotes:[]};
  const cle=_volCleDecalee(decalageSemaines||0);
  const lundi=_lundiDeSemaine(cle);
  if(!lundi||!user||!Array.isArray(user.sessions)) return res;
  const debut=lundi.getTime(), fin=debut+7*86400000;
  const g=grille||_grilleCharges();
  const vusSans=new Set(), vusNon=new Set();
  for(const sess of user.sessions){
    if(!sess||!sess.data) continue;
    const t=sess.date;
    if(!(t>=debut&&t<fin)) continue;
    for(const nom of Object.keys(sess.data)){
      const d=sess.data[nom];
      if(!d||!Array.isArray(d.sets)||!d.sets.length) continue;
      // reps forcée en chaîne : isCardio y appelle .toLowerCase(), et une
      // valeur numérique ferait tomber tout l'écran volume.
      const ex={name:nom,reps:String((d.sets[0]&&d.sets[0].reps)||''),
        methode:d.methode,technique:d.technique};
      if(isCardio(ex)) continue;
      let dures=0;
      for(const s of d.sets){
        if(!serieEligible(s,ex)) continue;
        const pi=poidsIntensite(s);
        if(!pi) continue;
        dures+=pi*poidsTechnique(techniqueDe(ex),user);
      }
      if(!dures) continue;
      const schema=schemaDe(ex,user);
      if(!schema){ vusSans.add(nom); continue; }
      const ch=chargeLombaireSchema(schema,g);
      if(ch==null){ vusNon.add(schema); res.nSeriesNonNotees+=dures; continue; }
      res.nSeries+=dures;
      res.points+=dures*ch;
    }
  }
  res.exSansSchema=[...vusSans];
  res.schemasNonNotes=[...vusNon];
  res.nExercicesSansSchema=vusSans.size;
  const r1=x=>Math.round(x*10)/10;
  res.points=r1(res.points); res.nSeries=r1(res.nSeries);
  res.nSeriesNonNotees=r1(res.nSeriesNonNotees);
  return res;
}

// Variation contre les VOL_DELTA_N dernières semaines ENTRAÎNÉES. Même
// parcours que _volMoyennePrecedente : on saute les semaines vides, on
// s'arrête après VOL_COUPURE vides consécutives, on rend null sous
// VOL_DELTA_MIN semaines exploitables. Le calendrier n'est pas réimplémenté.
function variationChargeAxiale(user,grille,decalageSemaines){
  const dec=decalageSemaines||0;
  const semaine=chargeAxialeSemaine(user,dec,grille);
  const vals=[]; let vides=0;
  for(let n=dec+1;n<=dec+26&&vals.length<VOL_DELTA_N;n++){
    const c=_calculSemaine(user,_volCleDecalee(n));
    if(!c.eligibles){ if(++vides>=VOL_COUPURE) break; continue; }
    vides=0;
    vals.push(chargeAxialeSemaine(user,n,grille).points);
  }
  if(vals.length<VOL_DELTA_MIN)
    return {semaine,points:semaine.points,moyenne:null,variation:null,semaines:vals.length};
  const moy=vals.reduce((a,b)=>a+b,0)/vals.length;
  // Une moyenne nulle ne permet aucune variation relative : on ne divise pas
  // par zéro pour annoncer une hausse infinie.
  const v=moy>0?(semaine.points-moy)/moy:null;
  return {semaine,points:semaine.points,moyenne:moy,variation:v,semaines:vals.length};
}

// Un athlète a-t-il une contrainte active sur le rachis lombaire ?
function _axialContrainteLombaire(user){
  try{ return contraintesActives(user).some(c=>c&&c.zone===AXIAL_ZONE); }
  catch(e){ return false; }
}
// Remontée en haut de la fiche coach : drapeau rouge, ou contrainte déclarée
// sur cette zone précise.
function axialPrioritaire(user){
  let drapeau=false;
  try{ drapeau=!!drapeauQuelconqueActif(user); }catch(e){}
  return drapeau||_axialContrainteLombaire(user);
}

// Rendu commun aux deux écrans. Aucune couleur d'alerte : le gris du texte
// secondaire, et rien d'autre.
function _htmlChargeAxiale(user,decalageSemaines,grille,options){
  const o=options||{};
  const v=variationChargeAxiale(user,grille,decalageSemaines);
  const s=v.semaine;
  // Rien de la semaine : aucune phrase, pas même un zéro.
  if(!s.nSeries&&!s.nSeriesNonNotees&&!s.nExercicesSansSchema) return '';
  const lignes=[];
  // Grille vide : le zéro serait faux, on dit ce qui manque.
  if(!s.nSeries&&s.nSeriesNonNotees){
    lignes.push(escapeHtml(AXIAL_INVITE_GRILLE));
  } else {
    const pct=v.variation!=null
      ? ' · '+(v.variation>=0?'+':'−')+Math.round(Math.abs(v.variation)*100)
        +' % contre '+(v.semaines>1?('tes '+v.semaines+' dernières semaines'):'ta semaine précédente')
      : '';
    lignes.push('Charge lombaire : '+_fmtAxial(s.points)+' point'+(s.points>=2?'s':'')+pct);
  }
  if(s.nExercicesSansSchema)
    lignes.push(s.nExercicesSansSchema+' exercice'+(s.nExercicesSansSchema>1?'s':'')
      +' non rattaché'+(s.nExercicesSansSchema>1?'s':'')+' à un schéma');
  if(s.nSeries&&s.nSeriesNonNotees)
    lignes.push(_fmtAxial(s.nSeriesNonNotees)+' série'+(s.nSeriesNonNotees>=2?'s':'')
      +' sur des schémas dont la charge lombaire n\'est pas notée');
  const signal=(v.variation!=null&&v.variation>=AXIAL_HAUSSE_SIGNAL)
    ? '<div style="margin-top:6px">Ta charge lombaire augmente vite cette semaine. '
      +escapeHtml(AXIAL_NOTE_REPERE)+'</div>'
    : '';
  const disclaimer=o.disclaimer
    ? '<div style="margin-top:6px">'+escapeHtml(DISCLAIMER_SANTE)+'</div>' : '';
  return `<div style="margin-top:14px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);padding:10px 12px;font-size:var(--fs-xs);color:var(--sub);line-height:1.6">
    ${lignes.map(t=>'<div>'+t+'</div>').join('')}
    ${signal}
    ${disclaimer}
  </div>`;
}
function _fmtAxial(v){ return String(Math.round(v*10)/10).replace('.',','); }

// ══════════════ VOLUME CÔTÉ COACH ══════════════
// Les repères et la classification sont ceux de L'ATHLÈTE, pas ceux du coach :
// resoudreMusclesLecture et reperesEffectifs prennent l'utilisateur en
// paramètre, c'est toute la raison de leur existence.
let _volCoachDeplie=false;

// ── Les quatre rendus ─────────────────────────────────────────────────────
// Aucun n'invente de repère : le tonnage se compare à lui-même et le dit, les
// records sont des faits, le RIR moyen est une moyenne, l'écart est un rapport.
const TONNAGE_AVERTISSEMENT='Comparable seulement à programme constant : changer d\'exercices change le tonnage sans rien dire de l\'effort.';
function _fmtKg(v){
  const n=Math.round(Number(v)||0);
  return n>=1000?String(Math.round(n/100)/10).replace('.',',')+' t':n+' kg';
}
function _htmlTonnage(user,decalage){
  const t=tonnageSemaine(user,decalage||0);
  // Une semaine sans séance est un TROU, pas une baisse : on ne trace pas une
  // chute vers zéro pour une semaine où l'athlète n'est pas venu.
  const hist=[];
  for(let k=(decalage||0)+VOL_SEMAINES_MAX-1;k>=(decalage||0);k--){
    const w=tonnageSemaine(user,k);
    hist.push({k,kg:w.kg,vide:!w.nSeances});
  }
  const max=Math.max(1,...hist.map(x=>x.kg));
  const barres=hist.map(x=>{
    const h=x.vide?0:Math.max(4,Math.round(x.kg/max*100));
    return `<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%" title="${x.vide?'aucune séance':_fmtKg(x.kg)}">`
      +(x.vide
        ?`<div style="height:3px;background:repeating-linear-gradient(90deg,var(--border),var(--border) 3px,transparent 3px,transparent 6px);border-radius:var(--r-1)"></div>`
        :`<div class="rc-barre-v" data-bar-h="${h}" style="height:0;min-height:4px;background:linear-gradient(180deg,var(--red),#7a0000);border-radius:var(--r-1) var(--r-1) 0 0;transition:height 420ms var(--c-out) var(--rcb-d,0ms)"></div>`)
      +`</div>`;}).join('');
  if(!hist.some(x=>!x.vide)) return '';
  return `<div style="margin-top:14px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:8px">
      <span style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase">Tonnage</span>
      <span style="font-size:var(--fs-sm);font-weight:800;color:var(--text)">${t.nSeances?`<span id="rc-tonnage-num" style="font-variant-numeric:tabular-nums">${_fmtKg(t.kg)}</span>`:'-'}<span style="font-size:var(--fs-2xs);color:var(--sub);font-weight:600">${t.nSeances?' · '+t.nSeances+' séance'+(t.nSeances>1?'s':''):' aucune séance'}</span></span>
    </div>
    <div style="display:flex;align-items:flex-end;gap:4px;height:54px;margin-bottom:6px">${barres}</div>
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5">${escapeHtml(TONNAGE_AVERTISSEMENT)}</div>
  </div>`;
}
// Les huit exercices les plus travaillés, par nombre de séries validées.
const RECORDS_TOP=8;
function _htmlRecords(user){
  const compte={};
  for(const sess of ((user&&user.sessions)||[])){
    for(const nom of Object.keys((sess&&sess.data)||{})){
      const d=sess.data[nom];
      if(!d||!Array.isArray(d.sets)) continue;
      const k=_aliasPour(exKey(nom),user);
      if(!k) continue;
      const n=d.sets.filter(x=>x&&x.done===true&&parseFloat(x.weight)>0).length;
      if(!n) continue;
      if(!compte[k]) compte[k]={nom,n:0};
      compte[k].n+=n;
    }
  }
  const tri=Object.keys(compte).map(k=>compte[k]).sort((a,b)=>b.n-a.n).slice(0,RECORDS_TOP);
  const lignes=tri.map(x=>({nom:x.nom,rec:recordsExercice(user,x.nom)}))
    .filter(x=>x.rec&&x.rec.meilleureCharge);
  if(!lignes.length) return '';
  const dt=ms=>new Date(ms).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
  return `<div style="margin-top:14px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:10px">Records</div>
    ${lignes.map(x=>{
      // UNE LIGNE DÉPLIABLE PAR EXERCICE (05/10/2026) : le record de charge en
      // tête, et dessous le record à chaque tranche de répétitions (« au moins
      // N »), puis la meilleure série en volume.
      const pr=x.rec.parReps||{}, u=_uniteTxt(x.nom);
      const kg=v=>String(_kgAff(v)).replace('.',',');
      const tranches=RECORDS_TRANCHES.filter(N=>pr[N]).map(N=>`<div class="rec-tr"><span>${N} rép${N>1?'s':''} et +</span><b>${kg(pr[N].kg)}${u}</b><i>${dt(pr[N].date)}</i></div>`).join('');
      const mv=x.rec.meilleurVolumeSerie;
      const vol=mv?`<div class="rec-tr"><span>Meilleure série (volume)</span><b>${kg(mv.kg)}${u} × ${mv.reps}</b><i>${dt(mv.date)}</i></div>`:'';
      const tete=`<span style="font-size:var(--fs-xs);color:var(--text-strong);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(x.nom)}</span>
      <span style="font-size:var(--fs-xs);font-weight:800;color:var(--text);white-space:nowrap">${kg(x.rec.meilleureCharge.kg)}${u}${x.rec.meilleureCharge.reps?` × ${x.rec.meilleureCharge.reps}`:''}<span style="font-size:var(--fs-2xs);color:var(--text-faint);font-weight:600"> · ${dt(x.rec.meilleureCharge.date)}</span></span>`;
      return (tranches||vol)
        ?`<details class="rec-ex"><summary>${tete}</summary><div class="rec-trs">${tranches}${vol}</div></details>`
        :`<div class="rec-ex rec-ex-seul">${tete}</div>`;
    }).join('')}
  </div>`;
}
// Fiche coach : le RIR moyen des quatre dernières séances.
const RIR_DERNIERES=4;
// PURE. La moyenne de RIR d'une TRANCHE de seances, deja triees de la plus
// recente a la plus ancienne. Rend null quand aucune seance de la tranche ne
// porte de RIR : une tranche muette n'est pas une tranche a zero.
function _rirTranche(triees,depuis,combien){
  const l=triees.slice(depuis,depuis+combien).map(x=>rirMoyenSeance(x)).filter(Boolean);
  if(!l.length) return null;
  return {moy:l.reduce((a,r)=>a+r.moyenne,0)/l.length,
          n:l.length,
          manquantes:l.reduce((a,r)=>a+(r.nTotal-r.nRenseignees),0)};
}
function _htmlRirMoyen(c){
  const triees=((c&&c.sessions)||[]).filter(x=>x&&x.date&&x.data)
    .slice().sort((a,b)=>b.date-a.date);
  const ss=triees.slice(0,RIR_DERNIERES);
  const l=ss.map(x=>({d:x.date,r:rirMoyenSeance(x)})).filter(x=>x.r);
  if(!l.length) return '';
  const moy=Math.round(l.reduce((a,x)=>a+x.r.moyenne,0)/l.length*100)/100;
  const manquantes=l.reduce((a,x)=>a+(x.r.nTotal-x.r.nRenseignees),0);
  // N6.10 — LA DERIVE. Fenetre precedente de MEME LONGUEUR, et rien du tout
  // quand elle n'existe pas : une derive calculee sur une fenetre incomplete
  // dirait le contraire de la verite un mois sur deux.
  const _av=_rirTranche(triees,RIR_DERNIERES,RIR_DERNIERES);
  let derive='';
  if(_av&&_av.n===RIR_DERNIERES&&l.length===RIR_DERNIERES){
    const d=Math.round((moy-_av.moy)*100)/100;
    // Un ecart NUL ne se commente pas : une fleche horizontale ajouterait du
    // bruit a une information qui dit « rien n'a bouge ».
    if(Math.abs(d)>=0.05){
      const fl=d>0?'▲':'▼';
      // B3.6 — ET LE MOT QUI DIT CE QUE LA FLECHE VEUT DIRE, quand il y a
      // quelque chose a dire. Le volume de la semaine sert d'arbitre : monter
      // l'intensite en montant le volume n'est pas monter l'intensite seule.
      let _dVol=null;
      try{ const _ch=_chargeHebdo(c); if(_ch&&_ch.pct!=null) _dVol=_ch.pct; }catch(e){}
      const mot=lectureDeriveRir(d,_dVol);
      derive=`<span style="color:var(--text-faint)"> · ${fl} ${String(Math.abs(d)).replace('.',',')} sur les ${RIR_DERNIERES} précédentes${mot?' · '+mot:''}</span>`;
    }
  }
  return `<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
    <div style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1.5px;font-weight:800;text-transform:uppercase;margin-bottom:4px">Intensité moyenne · ${l.length} dernière${l.length>1?'s':''} séance${l.length>1?'s':''}</div>
    <div style="font-size:var(--fs-xs);color:var(--text-strong)">${String(moy).replace('.',',')}<span style="color:var(--sub)"> répétition${moy>=2?'s':''} en réserve</span>${derive}${manquantes?`<span style="color:var(--text-faint)"> · ${manquantes} série${manquantes>1?'s':''} sans intensité notée, exclue${manquantes>1?'s':''} du calcul</span>`:''}</div>
  </div>`;
}
// ══════ B3.1 — L'INTENSITE PRESCRITE CONTRE L'INTENSITE FAITE ══════════
//
// LA BOUCLE CASSAIT AU QUATRIEME MAILLON. Le coach prescrit « RIR 2 »,
// l'athlete saisit son RIR serie par serie, la fiche coach affiche une moyenne
// REALISEE — et rien, nulle part, ne rapprochait les deux. Le coach ne pouvait
// pas savoir si sa consigne d'intensite avait ete suivie : il voyait un chiffre
// sans le sien a cote.
//
// PAR EXERCICE, ET NON EN BLOC. Une moyenne generale melange un developpe
// couche prescrit a RIR 1 et un curl prescrit a RIR 3 : leur moyenne ne dit
// rien de ni l'un ni l'autre. C'est exercice par exercice que le coach ajuste.
//
// L'ABSENCE DE CONSIGNE SE LIT COMME UNE ABSENCE. _rirPrescrit rend '' quand
// rien n'est prescrit, et un exercice sans consigne est ECARTE — jamais compte
// pour un zero, qui signifie « jusqu'a l'echec » et serait le contresens le
// plus grave possible ici.
//
// L'ECHELLE EST CELLE QUI EXISTE, et « echec » vaut RIR 0 — exactement comme
// rirMoyenSeance le fait deja pour la moyenne affichee juste au-dessus. Deux
// echelles pour un meme chiffre en feraient deux chiffres incomparables.
const RIR_ECART_MINI=0.3;   // en deca, l'ecart n'est pas un ecart : c'est du bruit
// PURE. Rend [{nom, prescrit, realise, n, ecart}], du plus grand ecart au plus
// petit. Vide quand aucune consigne n'est posee, ou qu'aucune serie prescrite
// n'a encore ete faite.
function ecartRirPrescrit(user){
  const out=[];
  if(!user) return out;
  // LA CONSIGNE, PAR CLEF D'EXERCICE. exKey est l'identite d'un exercice
  // partout ailleurs — charge suggeree, records, plateau : la meme ici, sinon
  // « Developpe couche » et « DEVELOPPE COUCHE » seraient deux exercices.
  const pres={};
  try{
    const cfg=Array.isArray(user.sessions_config)?user.sessions_config:[];
    for(const s of cfg){
      if(!s||s.active!==true||!Array.isArray(s.exercises)) continue;
      for(const ex of s.exercises){
        const r=_rirPrescrit(ex);
        if(r==='') continue;
        const k=exKey((ex&&ex.name)||'');
        if(k&&pres[k]==null) pres[k]=Number(r);
      }
    }
  }catch(e){ return out; }
  if(!Object.keys(pres).length) return out;
  // LE REALISE, SUR LA MEME FENETRE QUE LA MOYENNE AFFICHEE AU-DESSUS.
  // Deux fenetres differentes sur une meme carte feraient lire deux verites.
  const faits={};
  try{
    const ss=((user.sessions)||[]).filter(x=>x&&x.date&&x.data)
      .slice().sort((a,b)=>b.date-a.date).slice(0,RIR_DERNIERES);
    for(const sess of ss){
      // B3.5 — LA CONSIGNE DE CE JOUR-LA D'ABORD. `rirPlanned` fige ce qui
      // etait prescrit au moment de la seance ; le gabarit d'aujourd'hui n'est
      // qu'un repli, pour les seances anterieures a ce champ.
      const fige=(sess.rirPlanned&&typeof sess.rirPlanned==='object')?sess.rirPlanned:null;
      for(const nom of Object.keys(sess.data||{})){
        const k=exKey(nom);
        const cons=fige&&fige[nom]!=null?Number(fige[nom]):pres[k];
        if(cons==null) continue;
        const d=sess.data[nom];
        if(!d||!Array.isArray(d.sets)) continue;
        for(const s of d.sets){
          if(!s||s.done!==true) continue;
          if(s.rir===''||s.rir==null) continue;
          // LECTURE DE DECISION, DONC CORRIGEE. C'est la comparaison meme que
          // le calibrage existe pour rendre juste : un athlete qui declare
          // « RIR 2 » avec deux repetitions de reserve en plus n'a PAS suivi
          // une consigne de RIR 2 — il s'est entraine plus facile qu'on ne le
          // lui demandait, et c'est exactement ce que le coach doit lire.
          // Sans correction, il lisait l'inverse et baissait l'intensite.
          const v=rirCorrige(user,(s.rir==='echec')?0:(parseInt(s.rir,10)||0));
          const f=faits[k]||(faits[k]={somme:0,n:0,nom,sommeCons:0});
          f.somme+=v; f.n++; f.sommeCons+=cons;
        }
      }
    }
  }catch(e){ return out; }
  for(const k in faits){
    const f=faits[k];
    if(!f.n) continue;
    const realise=Math.round(f.somme/f.n*100)/100;
    // LA CONSIGNE MOYENNE SUR LA FENETRE, et non celle d'aujourd'hui : elle a
    // pu changer d'une semaine a l'autre depuis que le bloc se periodise.
    const prescrit=Math.round(f.sommeCons/f.n*100)/100;
    out.push({nom:f.nom,prescrit,realise,n:f.n,
              ecart:Math.round((realise-prescrit)*100)/100});
  }
  out.sort((a,b)=>Math.abs(b.ecart)-Math.abs(a.ecart));
  return out;
}
// LE MOT COMPTE PLUS QUE LE CHIFFRE. « RIR 3,4 pour 2 » ne dit rien tant qu'on
// n'a pas fait la soustraction ; « plus facile que demande » se lit d'un coup.
// UN RIR PLUS HAUT QUE PRESCRIT = PLUS FACILE : il reste plus de repetitions en
// reserve. C'est le sens inverse de l'intuition, et c'est pour cela qu'on
// l'ecrit en toutes lettres plutot qu'en fleche.
function _htmlEcartRir(c){
  let l=[];
  try{ l=ecartRirPrescrit(c); }catch(e){ return ''; }
  if(!l.length) return '';
  const ligne=x=>{
    const dur=x.ecart<=-RIR_ECART_MINI, fac=x.ecart>=RIR_ECART_MINI;
    const mot=dur?'plus dur que demandé':fac?'plus facile que demandé':'conforme';
    const col=dur?'var(--orange)':fac?'var(--orange)':'var(--green)';
    const nb=v=>String(v).replace('.',',');
    return `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-top:6px">
      <span style="font-size:var(--fs-2xs);color:var(--text-strong);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(x.nom)}</span>
      <span style="font-size:var(--fs-2xs);color:${col};white-space:nowrap">${mot} <span style="color:var(--text-faint)">· ${nb(x.realise)} pour ${nb(x.prescrit)}</span></span>
    </div>`;
  };
  const horsCible=l.filter(x=>Math.abs(x.ecart)>=RIR_ECART_MINI);
  return `<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
    <div style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1.5px;font-weight:800;text-transform:uppercase;margin-bottom:4px">Intensité demandée · faite</div>
    ${(horsCible.length?horsCible:l).slice(0,RIR_ECART_MAX).map(ligne).join('')}
    ${horsCible.length?'':`<div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:6px">Tout est conforme à la consigne.</div>`}
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:6px;line-height:1.5">Un chiffre plus haut que la consigne veut dire plus facile : il reste plus de répétitions en réserve. Sur les ${RIR_DERNIERES} dernières séances.</div>
  </div>`;
}
// Cinq lignes au plus : au-dela, la carte devient une liste qu'on ne lit plus.
const RIR_ECART_MAX=5;

// ══════ LES PROGRAMMATIONS QUI S'ACHEVENT ══════════════════════════════
//
// Demande de Kevin, 27/08/2026 : « une semaine avant la fin de la
// programmation, le coach aura la notification comme quoi le bloc arrive a sa
// fin et il va falloir en remettre une en place. »
//
// UNE SEMAINE AVANT, ET PAS LE JOUR OU CA TOMBE : le lundi ou la derniere
// semaine commence, il est trop tard pour preparer la suite sans bousculer
// l'athlete. Prevenir pendant la derniere semaine laisse sept jours.
//
// PURE. Rend [{nom, restantes, jour}] — les exercices dont la programmation
// s'acheve, tous creneaux confondus, du plus urgent au moins urgent.
function progExQuiFinissent(user,date){
  const out=[];
  try{
    const cfg=Array.isArray(user&&user.sessions_config)?user.sessions_config:[];
    cfg.forEach((s,slot)=>{
      if(!s||s.active!==true||!Array.isArray(s.exercises)) return;
      for(const ex of s.exercises){
        const r=(()=>{ try{ return finProgExProche(ex,date); }catch(e){ return null; } })();
        if(r==null) return;
        out.push({nom:(ex&&ex.name)||'',restantes:r,
                  jour:(typeof DAYS!=='undefined'&&DAYS[slot])?DAYS[slot]:''});
      }
    });
  }catch(e){ return out; }
  out.sort((a,b)=>a.restantes-b.restantes);
  return out;
}
// LA CARTE. Orange et non rouge : ce n'est pas une alerte, c'est une echeance
// — rien n'est casse, il y a simplement quelque chose a preparer.
function _htmlFinProgEx(c){
  let l=[];
  try{ l=progExQuiFinissent(c); }catch(e){ return ''; }
  if(!l.length) return '';
  const dit=x=>x.restantes<=1?'dernière semaine'
    :(x.restantes+' semaines restantes');
  return `<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
    <div style="font-size:var(--fs-2xs);color:var(--orange);letter-spacing:1.5px;font-weight:800;text-transform:uppercase;margin-bottom:4px">Programmation à renouveler</div>
    ${l.slice(0,RIR_ECART_MAX).map(x=>`<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-top:6px">
      <span style="font-size:var(--fs-2xs);color:var(--text-strong);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(x.nom)}${x.jour?`<span style="color:var(--text-faint)"> · ${escapeHtml(x.jour)}</span>`:''}</span>
      <span style="font-size:var(--fs-2xs);color:var(--orange);white-space:nowrap">${dit(x)}</span>
    </div>`).join('')}
    ${l.length>RIR_ECART_MAX?`<div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:6px">et ${l.length-RIR_ECART_MAX} de plus</div>`:''}
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:6px;line-height:1.5">Sans nouvelle programmation, ces exercices repasseront en charge libre et l’athlète notera de nouveau ses répétitions en réserve, comme avant.</div>
  </div>`;
}
// Fiche coach : ce qui est prescrit contre ce qui est fait.
function _htmlEcartPrescrit(c){
  const l=ecartPrescritRealise(c).filter(x=>x.part!=null);
  if(!l.length) return '';
  const dits=l.slice(0,6);
  return `<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
    <div style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1.5px;font-weight:800;text-transform:uppercase;margin-bottom:6px">Prescrit / réalisé</div>
    ${dits.map(x=>`<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:var(--fs-xs);color:var(--text-strong);margin-bottom:4px">
      <span>${escapeHtml((MUSCLES[x.muscle]||{}).lib||x.muscle)}</span>
      <span style="white-space:nowrap;color:var(--sub)">${volAffiche(x.realise)} / ${volAffiche(x.prescrit)} · ${Math.round(x.part*100)} %</span>
    </div>`).join('')}
    ${l.length>dits.length?`<div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:4px">et ${l.length-dits.length} autre${l.length-dits.length>1?'s':''}</div>`:''}
  </div>`;
}

// « Compter le travail indirect » : le réglage du coach pour cet athlète.
function _htmlComptageCoach(c){
  const v=reperesComptageDe(c);
  return '<label class="vol-comptage">Compter le travail indirect<span class="vol-comptage-d">Les repères RP sont écrits en séries directes.</span>'
    +'<select onchange="ccdComptageEnregistrer(this.value)" aria-label="Compter le travail indirect">'
    +'<option value="fractionne"'+(v==='fractionne'?' selected':'')+'>À 0,5 série (par défaut)</option>'
    +'<option value="direct"'+(v==='direct'?' selected':'')+'>Non, séries directes</option>'
    +'</select></label>';
}
function ccdComptageEnregistrer(v){
  if(REPERES_COMPTAGES.indexOf(v)<0) return false;
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  if(v==='direct') c.reperesComptage='direct'; else delete c.reperesComptage;
  c.updatedAt=Date.now();
  users[c.email]=c;
  try{ _viderCacheVolume(); }catch(e){}
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(c.email,c),'Comptage enregistré '+ICO.coche,'le réglage est');
  try{ renderVolumeCoach(c); }catch(e){}
  return true;
}
function renderVolumeCoach(c){
  const z=document.getElementById('ccd-volume');
  if(!z) return;
  // N4.15 — LE BOUTON DE DECHARGE SURVIT A L'ABSENCE DE SEANCE. Cette
  // fonction vidait son conteneur et sortait des que l'athlete n'avait encore
  // rien fait — or c'est elle, et elle seule, qui rend le bouton de decharge.
  // Un athlete fraichement programme, avec quatre creneaux actifs et aucune
  // seance realisee, n'avait aucun acces a la decharge depuis sa fiche : il
  // fallait passer par l'ecran groupe, deux navigations de plus.
  // LE BLOC « VOLUME » NE REAPPARAIT PAS POUR AUTANT : le vide est delibere
  // quand il n'y a rien a mesurer. Seul le bouton reste, et
  // _htmlBoutonDecharge s'impose deja la bonne condition — au moins un
  // creneau actif, sinon il ne rend rien.
  if(!c||!Array.isArray(c.sessions)||!c.sessions.length){
    z.innerHTML=_htmlBoutonDecharge(c);
    return;
  }
  const cle=semaineISO(new Date());
  const res=_calculSemaine(c,cle);
  if(!res.seances){
    z.innerHTML=`<div style="font-size:var(--fs-xs);color:var(--text-faint);margin-bottom:14px">Aucune séance cette semaine.</div>`
      +_htmlComptageCoach(c)+_htmlBoutonDecharge(c);
    return;
  }
  const lignes=Object.keys(res.muscles).filter(m=>res.muscles[m]>=0.5)
    .sort((a,b)=>res.muscles[b]-res.muscles[a]);
  // Vue compacte : uniquement ce qui sort de la zone. Un muscle sans repère ne
  // peut sortir d'aucune zone, il n'apparaît donc pas ici.
  const hors=lignes.map(m=>({m,n:res.muscles[m],rep:reperesEffectifs(c,m)}))
    .filter(x=>x.rep&&(x.n<x.rep.mev||x.n>x.rep.mrv));

  const ligne=(m,n,rep)=>{
    const zo=zoneVolume(n,rep,c);
    // LA FREQUENCE ENTRE LE VOLUME ET LA ZONE, en teinte neutre : douze séries
    // en une séance et douze sur trois jours ne se lisent pas pareil, et c’est
    // la première question devant un volume. La ZONE RESTE EN DERNIER : c’est
    // elle qui porte la couleur, et rien ne doit concurrencer ce signal-là.
    //
    // En commentaire JS et non dans le gabarit : un commentaire HTML posé là
    // partirait dans le DOM à chaque ligne de muscle, à chaque rendu.
    // `cle` est la MEME semaine que celle du volume juste au-dessus, et
    // _calculSemaine est memoisee : cet appel relit l’objet que `res` porte
    // deja, il n’en calcule pas un second.
    const _fq=_libFrequence(c,cle,m);
    return `<div style="margin-bottom:10px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:4px">
        <span style="font-size:var(--fs-xs);font-weight:800;color:${(MUSCLES[m]||{}).c||'var(--text)'}">${(MUSCLES[m]||{}).lib||m}${(()=>{ const _s=(rep&&rep.source)||'table'; if(_s==='table') return ''; return `<span style="font-weight:400;color:var(--text-faint);font-size:var(--fs-2xs)"> · ${_s==='perso'?'ajusté sur ses retours':'fixé par toi'}</span>`; })()}</span>
        <span style="font-size:var(--fs-2xs);color:${zo?zo.c:'var(--sub)'};white-space:nowrap">${volAffiche(n)} série${n>=2?'s':''}${_fq?' · <span style="color:var(--sub)">'+escapeHtml(_fq)+'</span>':''} · ${zo?zo.lib:'pas de repère'}</span>
      </div>
      ${_volBarre(m,n,rep,res.aberrants[m],c)}
      ${_htmlConcentration(res,m)}
    </div>`;
  };

  const corps=_volCoachDeplie
    ? lignes.map(m=>ligne(m,res.muscles[m],reperesEffectifs(c,m))).join('')
    : (hors.length?hors.map(x=>ligne(x.m,x.n,x.rep)).join('')
       :`<div style="font-size:var(--fs-xs);color:var(--success);margin-bottom:6px">Tous les muscles travaillés sont dans leur zone.</div>`);

  // Drapeau rouge levé, ou contrainte déclarée sur le rachis lombaire : la
  // charge axiale passe EN TÊTE, avec le disclaimer santé. Sinon elle reste
  // en bas de bloc, à sa place d'indicateur parmi d'autres.
  const _axPrio=axialPrioritaire(c);
  const _axial=_htmlChargeAxiale(c,0,null,{disclaimer:_axPrio});
  z.innerHTML=(_axPrio?_axial:'')
    +`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:16px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:10px">
      <span style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase">Volume 7 jours</span>
      <button onclick="_volCoachDeplie=!_volCoachDeplie;renderVolumeCoach(getOwnedClient(currentClientId))" style="background:none;border:none;color:var(--sub);font-size:var(--fs-2xs);font-family:Montserrat,sans-serif;cursor:pointer;text-decoration:underline;padding:0">${_volCoachDeplie?'réduire':'voir tout'}</button>
    </div>
    ${corps}
    ${res.nonRattachees?`<div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:6px">${res.nonRattachees} série${res.nonRattachees>1?'s':''} non rattachée${res.nonRattachees>1?'s':''}</div>`:''}
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:8px;line-height:1.5">Repères indicatifs, à ajuster selon l'athlète.</div>
    <div style="margin-top:12px">${_htmlComptageCoach(c)}</div>
    ${_axPrio?'':_axial}
    ${(()=>{ try{ return _htmlEcheanceCoach(c); }catch(e){ return ''; } })()}
    ${(()=>{ try{ return _htmlRendement(c); }catch(e){ return ''; } })()}
    ${(()=>{ try{ return _htmlEcartsCoach(c); }catch(e){ return ''; } })()}
    ${(()=>{ try{ return _htmlJournalSeance(c); }catch(e){ return ''; } })()}
    ${_htmlRirMoyen(c)}
    ${_htmlFinProgEx(c)}
    ${_htmlEcartRir(c)}
    ${(()=>{ try{ return _htmlRatioPousseeTirage((c&&c.sessions_config)||[],c); }catch(e){ return ''; } })()}
    ${_htmlEcartPrescrit(c)}
    ${_htmlAdherenceCoach(c)}
    ${_htmlCarteDecharge(c)}
    ${_htmlBoutonDecharge(c)}
  </div>`;
}
// La carte de proposition. Elle NOMME ses motifs chiffrés : un coach doit
// pouvoir discuter la proposition, donc la refuser en connaissance de cause.
// Le score lui-même n'est écrit nulle part côté athlète — règle 5.
function _htmlCarteDecharge(c){
  let pr=null;
  try{ pr=evaluerPropositionDecharge(c); }catch(e){ return ''; }
  if(!pr) return '';
  const f=fatigueDe(c)||{motifs:[]};
  if(!f.motifs.length) return '';   // règle 3 : jamais de proposition muette
  const av=dechargePlanifieeApres(c,pr.semaineIndex);
  const titre=(av!==null&&typeof pr.semaineIndex==='number')
    ?'Avancer la décharge prévue en semaine '+(av+1)+' à la semaine '+(pr.semaineIndex+1)
    :'Décharge suggérée';
  const sem=(typeof pr.semaineIndex==='number')?('semaine '+(pr.semaineIndex+1)+' du bloc')
    :('semaine '+escapeHtml(String(pr.semaineProposee)));
  return `<div style="margin-top:10px;background:var(--info-bg);border:1px solid var(--info-border);border-radius:var(--r-3);padding:12px 14px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:1.5px;color:var(--info);text-transform:uppercase;margin-bottom:6px">`
    +escapeHtml(titre)+`</div>
    <div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-bottom:8px">Sur la `
    +escapeHtml(sem)+`. Proposition, pas décision : rien n'est appliqué tant que tu ne cliques pas.</div>`
    +f.motifs.map(m=>`<div style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.6;border-left:1px solid var(--border);padding-left:10px;margin-bottom:6px">`
      +escapeHtml(String(m.libelle||''))+` · <b>`+escapeHtml(String(m.valeur))+`</b> `
      +escapeHtml(String(m.unite||''))+`</div>`).join('')
    +`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
      <button class="btn btn-outline btn-sm" style="flex:1;min-width:96px;letter-spacing:.5px;font-size:var(--fs-2xs)" onclick="cdAppliquer()">Enregistrer</button>
      <button class="btn btn-outline btn-sm" style="flex:1;min-width:96px;letter-spacing:.5px;font-size:var(--fs-2xs)" onclick="cdReporter()">Reporter</button>
      <button class="btn btn-outline btn-sm" style="flex:1;min-width:96px;letter-spacing:.5px;font-size:var(--fs-2xs)" onclick="cdRefuser()">Refuser</button>
    </div></div>`;
}
function _cdCible(){ try{ return getOwnedClient(currentClientId); }catch(e){ return null; } }
function _cdApres(c,msg){ saveUser(); toast(msg); try{ renderVolumeCoach(c); }catch(e){} }
function cdAppliquer(){
  const c=_cdCible(); if(!c) return false;
  const pr=propositionDechargeOuverte(c); if(!pr) return false;
  if(!appliquerDecharge(c,pr.semaineIndex)) { toast('Aucun créneau actif à décharger.','var(--orange)'); return false; }
  _cdApres(c,'Décharge appliquée'); return true;
}
function cdReporter(){
  const c=_cdCible(); if(!c||!reporterDecharge(c)) return false;
  _cdApres(c,'Reportée d\'une semaine'); return true;
}
function cdRefuser(){
  const c=_cdCible(); if(!c||!refuserDecharge(c)) return false;
  _cdApres(c,'Proposition écartée'); return true;
}
// Decharge programmee sur TOUS les creneaux actifs. Elle reutilise le booleen
// deload existant, le meme que la case a cocher de l'editeur de seances : rien
// de neuf en base, et le bandeau que l'athlete voit deja en seance s'allume
// sans qu'on ait a en creer un second.
// ══════ N4.12 — QUATRE RACCOURCIS, ET PAS UN DE PLUS ══════════════════════
// L'espace coach se travaille au clavier — des noms d'exercices, des nombres,
// des notes — et tout s'y validait a la souris : aucun accesskey dans le
// fichier, et trois seuls gestionnaires de touches, tous locaux.
//
// QUATRE GESTES, CEUX QU'ON REPETE : enregistrer l'editeur d'exercices,
// publier le programme, ajouter un exercice, atteindre la recherche
// d'athletes. Chacun APPELLE LE BOUTON EXISTANT plutot que sa fonction : le
// bouton porte l'etat — desactive apres publication, absent hors contexte —
// et le rejouer par le clavier contournerait ce verrou.
//
// TROIS GARDES, ET LES TROIS COMPTENT :
//   • l'ecran actif doit etre un ecran COACH — un athlete a les memes touches
//     sous les doigts sur ses propres ecrans ;
//   • le focus ne doit pas etre dans un champ — meme garde que le lecteur de
//     correction video, qui l'ecrit deja : INPUT, TEXTAREA, SELECT, plus le
//     contenteditable que celui-la n'avait pas ;
//   • aucune modale ouverte — Echap lui appartient, et le reste aussi.
const RACCOURCIS_COACH=Object.freeze([
  {ecran:'s-coach-program', touche:'s', bouton:'cp-sauver',    dit:'Enregistrer'},
  {ecran:'s-coach-sessions',touche:'p', bouton:'csm-publier',  dit:'Publier'},
  {ecran:'s-coach-program', touche:'e', action:'addExercise',  dit:'Ajouter un exercice'},
  {ecran:'s-coach-home',    touche:'/', champ:'ch-rech',       dit:'Rechercher'},
  // B2.6 — LA TOUCHE QUI MONTRE LES AUTRES. Sans `ecran` : elle vaut partout
  // dans l'espace coach, y compris la ou aucun autre raccourci n'existe — c'est
  // la seule facon d'apprendre qu'il n'y en a pas ici.
  {touche:'?',              action:'ouvrirAideRaccourcis', dit:'Voir les raccourcis'}
]);
// PURE. Les raccourcis utiles sur un ecran donne : ceux qui le nomment, plus
// ceux qui valent partout. Une liste recopiee a la main mentirait au premier
// ajout — c'est tout l'objet de la fiche.
function raccourcisDeLEcran(ecran){
  return RACCOURCIS_COACH.filter(r=>!r.ecran||r.ecran===ecran);
}
function _rcSaisieActive(){
  const a=document.activeElement;
  if(!a) return false;
  if(/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return true;
  return a.isContentEditable===true;
}
function _rcEcranActif(){
  const e=document.querySelector('.screen.active');
  return e?e.id:'';
}
function _rcModaleOuverte(){
  try{
    const m=document.getElementById('modal-overlay');
    return !!(m&&m.style.display!=='none'&&m.offsetParent!==null);
  }catch(e){ return false; }
}
function raccourciCoach(ev){
  if(!ev||ev.ctrlKey||ev.metaKey||ev.altKey) return false;
  if(_rcSaisieActive()||_rcModaleOuverte()) return false;
  const ecran=_rcEcranActif();
  const t=String(ev.key||'').toLowerCase();
  // B2.6 — UN RACCOURCI SANS `ecran` VAUT PARTOUT. Les quatre premiers
  // nomment le leur ; « ? » n'en nomme aucun, et c'est ce qui lui permet de
  // repondre meme la ou il n'y a rien d'autre a annoncer.
  for(const r of RACCOURCIS_COACH){
    if((r.ecran&&r.ecran!==ecran)||r.touche!==t) continue;
    if(r.champ){
      const c=document.getElementById(r.champ);
      if(!c) return false;
      ev.preventDefault();
      c.focus();
      try{ c.select(); }catch(e){}
      return true;
    }
    if(r.bouton){
      const b=document.getElementById(r.bouton);
      // LE BOUTON PORTE L'ETAT : desactive apres publication, absent hors
      // contexte. Le clavier ne doit pas passer devant lui.
      if(!b||b.disabled||b.offsetParent===null) return false;
      ev.preventDefault();
      b.click();
      return true;
    }
    if(r.action&&typeof window[r.action]==='function'){
      ev.preventDefault();
      try{ window[r.action](); }catch(e){}
      return true;
    }
  }
  return false;
}
