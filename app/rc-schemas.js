// ══ RC-SCHEMAS — LE MOTEUR D'ILLUSTRATIONS DE REPCORE (build 1963) ═════════
// JavaScript PUR, sans dépendance, partagé par l'app (chargé à la demande,
// comme motion-lab.js : chargerSchemas) et par scripts/generer_atlas.mjs
// (qui l'exécute tel quel et exporte l'atlas en SVG et WebP). Un seul code,
// donc un seul dessin.
//
// TOUT EST CONSTRUIT, RIEN N'EST RECOPIÉ : chaque schéma est une construction
// géométrique originale — des segments de longueurs données, des angles
// résolus, des cotes. Aucun dessin existant n'est reproduit.
//
// LE REPÈRE : le monde est en centimètres, l'axe y monte, le sol est y = 0.
// Le rendu ramène tout à l'écran (y descend) avec une seule échelle par
// schéma : deux silhouettes côte à côte se comparent à la même échelle.
//
// LA CHARTE : encre #141416, accent #E02020, fond #F2F2F4, bouts ronds,
// aucune police externe (Arial, Helvetica, sans-serif : celles du système).
//
// LES POSES SONT CALCULÉES, et c'est ce que vérifient les tests d'invariants :
// les longueurs des segments sont conservées dans chaque pose ; au squat et
// au soulevé, la barre est à l'aplomb du milieu du pied ; au squat, le buste
// s'incline davantage quand le fémur s'allonge.
(function(racine){
  'use strict';
  const CHARTE=Object.freeze({encre:'#141416',accent:'#E02020',fond:'#F2F2F4',trait:'#9A9AA2',police:'Arial, Helvetica, sans-serif'});
  const R2=v=>Math.round(v*100)/100;
  const DEG=Math.PI/180;
  const echap=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const col=c=>CHARTE[c]||CHARTE.encre;

  // ── LES PRIMITIVES, EN COORDONNÉES D'ÉCRAN ────────────────────────────────
  /** PURE. Un segment à bouts ronds. a, b : {x, y} écran. */
  function segment(a,b,epaisseur,couleur,tirets){
    return '<line x1="'+R2(a.x)+'" y1="'+R2(a.y)+'" x2="'+R2(b.x)+'" y2="'+R2(b.y)+'" stroke="'+col(couleur)+'" stroke-width="'+R2(epaisseur||2)+'" stroke-linecap="round"'
      +(tirets?' stroke-dasharray="'+tirets+'"':'')+'/>';
  }
  /** PURE. Un arc de cercle de `debut` à `fin` degrés (0 = droite, sens trigonométrique à l'écran). */
  function arcAngle(c,rayon,debut,fin,couleur,epaisseur){
    const p=a=>({x:c.x+rayon*Math.cos(a*DEG),y:c.y-rayon*Math.sin(a*DEG)});
    const a=p(debut), b=p(fin), grand=Math.abs(fin-debut)>180?1:0, sens=fin>debut?0:1;
    return '<path d="M'+R2(a.x)+' '+R2(a.y)+' A'+R2(rayon)+' '+R2(rayon)+' 0 '+grand+' '+sens+' '+R2(b.x)+' '+R2(b.y)+'" fill="none" stroke="'+col(couleur||'accent')+'" stroke-width="'+R2(epaisseur||1.6)+'" stroke-linecap="round"/>';
  }
  /** PURE. Le texte, police du système. */
  function texte(p,s,taille,ancre,couleur,gras){
    return '<text x="'+R2(p.x)+'" y="'+R2(p.y)+'" font-family="'+CHARTE.police+'" font-size="'+R2(taille||12)+'" text-anchor="'+(ancre||'middle')+'"'
      +(gras?' font-weight="700"':'')+' fill="'+col(couleur)+'">'+echap(s)+'</text>';
  }
  /**
   * PURE. Une cote : la ligne de mesure, décalée de `decalage` (écran), ses
   * deux points d'arrêt, ses deux lignes de rappel et son texte au milieu.
   */
  function cote(a,b,libelle,decalage,couleur){
    const dx=b.x-a.x, dy=b.y-a.y, L=Math.hypot(dx,dy)||1;
    const nx=-dy/L*(decalage||0), ny=dx/L*(decalage||0);
    const A={x:a.x+nx,y:a.y+ny}, B={x:b.x+nx,y:b.y+ny};
    const c=couleur||'accent';
    const cote_=decalage<0?-1:1;
    // Une cote plutôt verticale porte son texte à côté, pas sur sa ligne.
    const vertical=Math.abs(dy)>Math.abs(dx);
    const m=vertical?{x:(A.x+B.x)/2+cote_*7,y:(A.y+B.y)/2+4}:{x:(A.x+B.x)/2-dy/L*12*cote_,y:(A.y+B.y)/2+dx/L*12*cote_+4};
    const ancre=vertical?(cote_>0?'start':'end'):'middle';
    return (decalage?segment(a,A,1,'trait','2 3')+segment(b,B,1,'trait','2 3'):'')
      +segment(A,B,1.4,c)
      +'<circle cx="'+R2(A.x)+'" cy="'+R2(A.y)+'" r="2.6" fill="'+col(c)+'"/><circle cx="'+R2(B.x)+'" cy="'+R2(B.y)+'" r="2.6" fill="'+col(c)+'"/>'
      +(libelle?texte(m,libelle,11,ancre,c,true):'');
  }
  function cercle(c,r,couleur,plein,ep){
    return '<circle cx="'+R2(c.x)+'" cy="'+R2(c.y)+'" r="'+R2(r)+'" fill="'+(plein?col(couleur):'none')+'"'+(plein?'':' stroke="'+col(couleur)+'" stroke-width="'+R2(ep||2)+'"')+'/>';
  }

  // ── LA SILHOUETTE PARAMÉTRIQUE ────────────────────────────────────────────
  // Les proportions par défaut sont des parts de la taille, celles des tables
  // anthropométriques usuelles (Winter) : fémur 24,5 %, tibia 24,6 %, bras
  // 18,6 %, avant-bras 14,6 %, épaules 25,9 %, bassin 19,1 %, tronc (hanche →
  // épaule) 28,8 %. Une valeur ≤ 1 se lit comme une part de la taille, une
  // valeur > 1 comme des centimètres.
  const PROPORTIONS=Object.freeze({tronc:0.288,femur:0.245,tibia:0.246,bras:0.186,avantBras:0.146,main:0.108,
    epaules:0.259,bassin:0.191,thorax:0.125,pied:0.152,cheville:0.039,cou:0.052,tete:0.13});
  /** PURE. La silhouette complète, en centimètres. */
  function silhouette(p){
    const o=p||{};
    const H=Number(o.taille)>100&&Number(o.taille)<250?Number(o.taille):175;
    const s={taille:H};
    for(const k of Object.keys(PROPORTIONS)){
      const v=Number(o[k]);
      s[k]=v>0?(v<=1?v*H:v):PROPORTIONS[k]*H;
    }
    return Object.freeze(s);
  }
  const P=(x,y)=>({x,y});
  const plus=(a,v,l,ang)=>P(a.x+l*Math.cos(ang),a.y+l*Math.sin(ang));
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  /** PURE. Les deux points communs à deux cercles, ou null. */
  function intersection(c1,r1,c2,r2){
    const d=dist(c1,c2);
    if(d>r1+r2+1e-9||d<Math.abs(r1-r2)-1e-9||d===0) return null;
    const a=(r1*r1-r2*r2+d*d)/(2*d), h=Math.sqrt(Math.max(0,r1*r1-a*a));
    const m=P(c1.x+a*(c2.x-c1.x)/d,c1.y+a*(c2.y-c1.y)/d);
    return [P(m.x+h*(c2.y-c1.y)/d,m.y-h*(c2.x-c1.x)/d),P(m.x-h*(c2.y-c1.y)/d,m.y+h*(c2.x-c1.x)/d)];
  }
  /** PURE. Le coude d'un bras de longueurs l1, l2 entre l'épaule S et la main W (côté `sens`). */
  function coude(S,W,l1,l2,sens){
    const d=dist(S,W)||1e-9;
    // Hors d'atteinte : la main est ramenée sur la sphère atteignable, trop
    // loin (bras tendu) comme trop près (bras replié au plus court).
    const k=d>l1+l2?(l1+l2)/d*0.999999:(d<Math.abs(l1-l2)?(Math.abs(l1-l2)/d)*1.000001:1);
    const W2=P(S.x+(W.x-S.x)*k,S.y+(W.y-S.y)*k);
    const i=intersection(S,l1,W2,l2);
    if(!i) return {E:P((S.x+W2.x)/2,(S.y+W2.y)/2),W:W2};
    const E=(sens<0?i[0].y<i[1].y:i[0].y>i[1].y)?i[0]:i[1];
    return {E,W:W2};
  }

  // ── LES POSES ─────────────────────────────────────────────────────────────
  // Une pose rend {pts, segs:[[a,b,épaisseur,couleur]], deco:[…], meta}.
  // `segs` porte les segments ANATOMIQUES (ceux dont la longueur se vérifie),
  // `deco` le reste (sol, barre, disques, cotes).
  function _pied(s,xCheville,deco){
    const talon=P(xCheville-0.2*s.pied,0), orteil=P(xCheville+0.8*s.pied,0);
    deco.push({t:'seg',a:talon,b:orteil,ep:5,c:'encre'});
    return {talon,orteil,milieu:P(xCheville+0.3*s.pied,0)};
  }
  function deboutProfil(s){
    const A=P(0,s.cheville), K=P(0,A.y+s.tibia), Hh=P(0,K.y+s.femur), S=P(0,Hh.y+s.tronc);
    const E=P(0,S.y-s.bras), W=P(0,E.y-s.avantBras), C=P(0,S.y+s.cou), T=P(0,C.y+s.tete/2);
    const deco=[]; _pied(s,0,deco);
    return {pts:{cheville:A,genou:K,hanche:Hh,epaule:S,coude:E,poignet:W,cou:C,tete:T},
      segs:[['cheville','genou',s.tibia],['genou','hanche',s.femur],['hanche','epaule',s.tronc],['epaule','coude',s.bras],['coude','poignet',s.avantBras],['epaule','cou',s.cou]],
      deco,meta:{}};
  }
  /** Le squat de profil. o : {tibiaDeg (avancée du tibia), femurDeg (sous l'horizontale, 0 = parallèle)}. */
  function squat(s,o){
    o=o||{};
    const th=(Number(o.tibiaDeg)>0?Number(o.tibiaDeg):30)*DEG, fe=(Number(o.femurDeg)||0)*DEG;
    // Le milieu du pied est en x = 0 ; la cheville 30 % de pied en arrière.
    const xA=-0.3*s.pied;
    const deco=[]; const pied=_pied(s,xA,deco);
    const A=P(xA,s.cheville);
    const K=P(A.x+s.tibia*Math.sin(th),A.y+s.tibia*Math.cos(th));
    const Hh=P(K.x-s.femur*Math.cos(fe),K.y-s.femur*Math.sin(fe));
    // LA BARRE À L'APLOMB DU MILIEU DU PIED : l'épaule (barre haute) en x = 0.
    const sinA=(0-Hh.x)/s.tronc;
    if(!(Math.abs(sinA)<=1)) return {pts:{cheville:A,genou:K,hanche:Hh},segs:[],deco,meta:{ok:false,raison:'Tronc trop court pour garder la barre au-dessus du pied.'}};
    const al=Math.asin(sinA);
    const S=P(Hh.x+s.tronc*Math.sin(al),Hh.y+s.tronc*Math.cos(al));
    const C=P(S.x+s.cou*Math.sin(al*0.6),S.y+s.cou*Math.cos(al*0.6));
    const T=P(C.x+s.tete*0.5*Math.sin(al*0.4),C.y+s.tete*0.5*Math.cos(al*0.4));
    // Les mains sur la barre, coudes derrière.
    const W=P(S.x+6,S.y-6), cd=coude(S,W,s.bras,s.avantBras,-1);
    deco.push({t:'barre',c:P(0,S.y)},{t:'tirets',a:P(0,0),b:P(0,S.y+8)});
    return {pts:{cheville:A,genou:K,hanche:Hh,epaule:S,cou:C,tete:T,coude:cd.E,poignet:cd.W,milieuPied:pied.milieu,barre:P(0,S.y)},
      segs:[['cheville','genou',s.tibia],['genou','hanche',s.femur],['hanche','epaule',s.tronc],['epaule','coude',s.bras],['coude','poignet',s.avantBras],['epaule','cou',s.cou]],
      deco,meta:{ok:true,buste:R2(al/DEG),tibia:R2(th/DEG),femur:R2(fe/DEG)}};
  }
  /** Le soulevé de terre au départ, de profil : barre sur le milieu du pied, bras verticaux. */
  function souleve(s){
    const R=22.5, xA=-0.3*s.pied;
    const deco=[]; const pied=_pied(s,xA,deco);
    const A=P(xA,s.cheville), B=P(0,R);
    // Le tibia vient au contact de la barre.
    const ang=Math.atan2(B.y-A.y,B.x-A.x);
    const K=P(A.x+s.tibia*Math.cos(ang),A.y+s.tibia*Math.sin(ang));
    // Les épaules juste devant la barre, les bras tendus jusqu'à elle.
    const S=P(3,R+Math.sqrt(Math.pow(s.bras+s.avantBras,2)-9));
    const i=intersection(K,s.femur,S,s.tronc);
    if(!i) return {pts:{},segs:[],deco,meta:{ok:false,raison:'Pas de position possible avec ces leviers.'}};
    const Hh=i[0].x<i[1].x?i[0]:i[1];
    const al=Math.atan2(S.x-Hh.x,S.y-Hh.y);
    const W=B, cd=coude(S,W,s.bras,s.avantBras,1);
    const C=P(S.x+s.cou*Math.sin(al),S.y+s.cou*Math.cos(al));
    const T=P(C.x+s.tete*0.5*Math.sin(al),C.y+s.tete*0.5*Math.cos(al));
    deco.push({t:'disque',c:B,r:R},{t:'tirets',a:P(0,0),b:P(0,S.y+10)});
    return {pts:{cheville:A,genou:K,hanche:Hh,epaule:S,coude:cd.E,poignet:cd.W,cou:C,tete:T,milieuPied:pied.milieu,barre:B},
      segs:[['cheville','genou',s.tibia],['genou','hanche',s.femur],['hanche','epaule',s.tronc],['epaule','coude',s.bras],['coude','poignet',s.avantBras],['epaule','cou',s.cou]],
      deco,meta:{ok:true,buste:R2(90-Math.atan2(S.y-Hh.y,S.x-Hh.x)/DEG),hanche:R2(Hh.y)}};
  }
  /** Le développé couché vu des pieds : barre sur la poitrine, et la barre bras tendus (amplitude). */
  function developpe(s,o){
    o=o||{};
    const yS=s.thorax*0.45, prise=(Number(o.prise)||1.6)*s.epaules;
    const SL=P(-s.epaules/2,yS), SR=P(s.epaules/2,yS);
    const bas=s.thorax+2;
    const WL=P(-prise/2,bas), WR=P(prise/2,bas);
    const L=coude(SL,WL,s.bras,s.avantBras,-1), Rr=coude(SR,WR,s.bras,s.avantBras,-1);
    const dx=prise/2-s.epaules/2, haut=yS+Math.sqrt(Math.max(0,Math.pow(s.bras+s.avantBras,2)-dx*dx));
    const deco=[{t:'ellipse',c:P(0,s.thorax/2),rx:s.epaules/2*0.92,ry:s.thorax/2},{t:'seg',a:P(-s.epaules,0),b:P(s.epaules,0),ep:4,c:'trait'},
      {t:'barreH',a:P(-prise/2-12,bas),b:P(prise/2+12,bas)},{t:'barreH',a:P(-prise/2-12,haut),b:P(prise/2+12,haut),fantome:true},
      {t:'cote',a:P(prise/2+20,bas),b:P(prise/2+20,haut),txt:Math.round(haut-bas)+' cm',dec:0}];
    return {pts:{epauleG:SL,epauleD:SR,coudeG:L.E,coudeD:Rr.E,mainG:L.W,mainD:Rr.W},
      segs:[['epauleG','coudeG',s.bras],['coudeG','mainG',s.avantBras],['epauleD','coudeD',s.bras],['coudeD','mainD',s.avantBras],['epauleG','epauleD',s.epaules]],
      deco,meta:{ok:true,amplitude:R2(haut-bas)}};
  }
  /** Le développé vu des pieds, coudes à hauteur d'épaules (humérus parallèle au sol). */
  function humerusParallele(s){
    const yS=s.thorax*0.45;
    const SL=P(-s.epaules/2,yS), SR=P(s.epaules/2,yS);
    const EL=P(SL.x-s.bras,yS), ER=P(SR.x+s.bras,yS);
    const WL=P(EL.x,yS+s.avantBras), WR=P(ER.x,yS+s.avantBras);
    const ecart=(yS+s.avantBras)-(s.thorax+2);
    const deco=[{t:'ellipse',c:P(0,s.thorax/2),rx:s.epaules/2*0.92,ry:s.thorax/2},{t:'seg',a:P(-s.epaules*1.4,0),b:P(s.epaules*1.4,0),ep:4,c:'trait'},
      {t:'tirets',a:P(EL.x-8,yS),b:P(ER.x+8,yS)},{t:'barreH',a:P(WL.x-8,WL.y),b:P(WR.x+8,WR.y)}];
    if(Math.abs(ecart)>0.5) deco.push({t:'cote',a:P(0,s.thorax),b:P(0,WL.y-2),txt:(ecart>0?'':'−')+Math.round(Math.abs(ecart))+' cm',dec:0});
    return {pts:{epauleG:SL,epauleD:SR,coudeG:EL,coudeD:ER,mainG:WL,mainD:WR},
      segs:[['epauleG','coudeG',s.bras],['coudeG','mainG',s.avantBras],['epauleD','coudeD',s.bras],['coudeD','mainD',s.avantBras]],
      deco,meta:{ok:true,ecart:R2(ecart)}};
  }
  /** La traction de face, en suspension ; la cote dit la course jusqu'au menton au-dessus de la barre. */
  function traction(s){
    const Bh=s.taille+s.bras+s.avantBras-10, prise=1.5*s.epaules, dx=(prise-s.epaules)/2;
    const yS=Bh-Math.sqrt(Math.pow(s.bras+s.avantBras,2)-dx*dx);
    const SL=P(-s.epaules/2,yS), SR=P(s.epaules/2,yS);
    const WL=P(-prise/2,Bh), WR=P(prise/2,Bh);
    const L=coude(SL,WL,s.bras,s.avantBras,1), R=coude(SR,WR,s.bras,s.avantBras,1);
    const HL=P(-s.bassin*0.28,yS-s.tronc), HR=P(s.bassin*0.28,yS-s.tronc);
    const KL=P(HL.x,HL.y-s.femur), KR=P(HR.x,HR.y-s.femur);
    const C=P(0,yS+s.cou), T=P(0,C.y+s.tete/2);
    const ySh=Bh+3-(s.cou+s.tete*0.3);
    const deco=[{t:'barreH',a:P(-prise/2-15,Bh),b:P(prise/2+15,Bh)},{t:'tirets',a:P(-s.epaules,ySh),b:P(s.epaules,ySh)},
      {t:'cote',a:P(s.epaules/2+18,yS),b:P(s.epaules/2+18,ySh),txt:Math.round(ySh-yS)+' cm',dec:0}];
    return {pts:{epauleG:SL,epauleD:SR,coudeG:L.E,coudeD:R.E,mainG:L.W,mainD:R.W,hancheG:HL,hancheD:HR,genouG:KL,genouD:KR,cou:C,tete:T},
      segs:[['epauleG','coudeG',s.bras],['coudeG','mainG',s.avantBras],['epauleD','coudeD',s.bras],['coudeD','mainD',s.avantBras],['epauleG','hancheG'],['epauleD','hancheD'],['hancheG','genouG',s.femur],['hancheD','genouD',s.femur],['epauleG','epauleD',s.epaules]],
      deco,meta:{ok:true,course:R2(ySh-yS)}};
  }
  /** L'envergure : bras en croix, de face, contre la taille. */
  function envergure(s){
    const yS=s.taille-s.cou-s.tete, bout=s.epaules/2+s.bras+s.avantBras+s.main;
    const SL=P(-s.epaules/2,yS), SR=P(s.epaules/2,yS);
    const EL=P(SL.x-s.bras,yS), ER=P(SR.x+s.bras,yS), WL=P(EL.x-s.avantBras,yS), WR=P(ER.x+s.avantBras,yS);
    const ML=P(-bout,yS), MR=P(bout,yS);
    const HL=P(-s.bassin*0.28,yS-s.tronc), HR=P(s.bassin*0.28,yS-s.tronc);
    const KL=P(HL.x,HL.y-s.femur), KR=P(HR.x,HR.y-s.femur), AL=P(KL.x,KL.y-s.tibia), AR=P(KR.x,KR.y-s.tibia);
    const C=P(0,yS+s.cou), T=P(0,C.y+s.tete/2);
    const deco=[{t:'seg',a:P(-bout-10,0),b:P(bout+10,0),ep:2,c:'trait'},
      {t:'cote',a:ML,b:MR,txt:'envergure '+Math.round(2*bout)+' cm',dec:26},
      {t:'cote',a:P(bout+16,0),b:P(bout+16,s.taille),txt:'taille '+Math.round(s.taille)+' cm',dec:0}];
    return {pts:{epauleG:SL,epauleD:SR,coudeG:EL,coudeD:ER,mainG:WL,mainD:WR,boutG:ML,boutD:MR,hancheG:HL,hancheD:HR,genouG:KL,genouD:KR,chevilleG:AL,chevilleD:AR,cou:C,tete:T},
      segs:[['epauleG','coudeG',s.bras],['coudeG','mainG',s.avantBras],['mainG','boutG',s.main],['epauleD','coudeD',s.bras],['coudeD','mainD',s.avantBras],['mainD','boutD',s.main],
        ['epauleG','epauleD',s.epaules],['epauleG','hancheG'],['epauleD','hancheD'],['hancheG','genouG',s.femur],['hancheD','genouD',s.femur],['genouG','chevilleG',s.tibia],['genouD','chevilleD',s.tibia]],
      deco,meta:{ok:true,envergure:R2(2*bout),rapport:R2(2*bout/s.taille)}};
  }
  /** Debout de profil, la cote sur le tronc (buste court ou long). */
  function buste(s){
    const p=deboutProfil(s);
    p.deco.push({t:'cote',a:p.pts.hanche,b:p.pts.epaule,txt:'tronc '+Math.round(s.tronc)+' cm',dec:-22});
    p.meta={ok:true,tronc:R2(s.tronc)};
    return p;
  }
  // ── Les schémas d'articulation : des constructions courtes, cotées ─────────
  /** Le valgus du coude : le bras de face, l'avant-bras qui s'écarte de l'axe. */
  function valgusCoude(s,o){
    const a=(Number(o&&o.angle)||15)*DEG;
    const S=P(0,s.bras+s.avantBras), E=P(0,s.avantBras), W=P(s.avantBras*Math.sin(a),s.avantBras-s.avantBras*Math.cos(a));
    const deco=[{t:'tirets',a:E,b:P(0,E.y-s.avantBras)},{t:'arc',c:E,r:s.avantBras*0.45,deb:-90,fin:-90+a/DEG},
      {t:'txt',p:P(s.avantBras*0.35,E.y-s.avantBras*0.62),s:Math.round(a/DEG)+'°',ancre:'start'}];
    return {pts:{epaule:S,coude:E,poignet:W},segs:[['epaule','coude',s.bras],['coude','poignet',s.avantBras]],deco,meta:{ok:true,angle:R2(a/DEG)}};
  }
  /** Genoux de face : valgum (rentrés, chevilles écartées) ou varum (sortis, genoux écartés). */
  function genoux(s,o){
    const type=o&&o.type==='varum'?'varum':'valgum', a=(Number(o&&o.angle)||8)*DEG, hx=s.bassin*0.28;
    const HL=P(-hx,s.femur+s.tibia), HR=P(hx,s.femur+s.tibia);
    const dirK=type==='valgum'?1:-1;
    const KL=P(HL.x+dirK*s.femur*Math.sin(a),HL.y-s.femur*Math.cos(a)), KR=P(HR.x-dirK*s.femur*Math.sin(a),HR.y-s.femur*Math.cos(a));
    const AL=P(KL.x-dirK*s.tibia*Math.sin(a),KL.y-s.tibia*Math.cos(a)), AR=P(KR.x+dirK*s.tibia*Math.sin(a),KR.y-s.tibia*Math.cos(a));
    const deco=[{t:'tirets',a:P(HL.x,HL.y),b:P(HL.x,0)},{t:'tirets',a:P(HR.x,HR.y),b:P(HR.x,0)}];
    if(type==='valgum') deco.push({t:'cote',a:AL,b:AR,txt:'chevilles : '+Math.round(dist(AL,AR))+' cm',dec:-18});
    else deco.push({t:'cote',a:KL,b:KR,txt:'genoux : '+Math.round(dist(KL,KR))+' cm',dec:0});
    return {pts:{hancheG:HL,hancheD:HR,genouG:KL,genouD:KR,chevilleG:AL,chevilleD:AR},
      segs:[['hancheG','genouG',s.femur],['genouG','chevilleG',s.tibia],['hancheD','genouD',s.femur],['genouD','chevilleD',s.tibia]],deco,meta:{ok:true,type}};
  }
  /** Le bassin de profil : la ligne épine arrière → épine avant, contre l'horizontale. */
  function bassin(s,o){
    const ang=(Number(o&&o.angle)||0)*DEG, L=s.bassin*0.75;
    const c=P(0,s.femur+s.tibia);
    const ar=P(c.x-L/2*Math.cos(ang),c.y+L/2*Math.sin(ang)), av=P(c.x+L/2*Math.cos(ang),c.y-L/2*Math.sin(ang));
    const S=P(c.x-4,c.y+s.tronc), K=P(c.x+2,c.y-s.femur);
    const deco=[{t:'tirets',a:P(c.x-L*0.75,c.y),b:P(c.x+L*0.75,c.y)},
      {t:'arc',c,r:L*0.45,deb:ang>0?-ang/DEG:0,fin:ang>0?0:-ang/DEG},
      {t:'txt',p:P(c.x+L*0.55,c.y+(ang>0?-14:18)),s:Math.round(Math.abs(ang/DEG))+'°',ancre:'start'},
      {t:'txt',p:P(av.x+4,av.y+14),s:'avant',ancre:'start',taille:10,c:'trait'}];
    return {pts:{epineArriere:ar,epineAvant:av,epaule:S,genou:K,centre:c},segs:[['epineArriere','epineAvant',L],['centre','epaule'],['centre','genou']],deco,meta:{ok:true,angle:R2(ang/DEG)}};
  }
  /** Le cou de profil : dans l'axe du buste, ou en extension (tête renversée). */
  function cou(s,o){
    const ang=(Number(o&&o.angle)||0)*DEG;
    const H=P(0,0), S=P(0,s.tronc), C=P(-s.cou*Math.sin(ang),S.y+s.cou*Math.cos(ang)), T=P(C.x-s.tete*0.5*Math.sin(ang*1.2),C.y+s.tete*0.5*Math.cos(ang*1.2));
    const deco=[{t:'tirets',a:S,b:P(0,S.y+s.cou+s.tete)}];
    if(ang) deco.push({t:'arc',c:S,r:s.cou*0.9,deb:90,fin:90+ang/DEG},{t:'txt',p:P(-s.cou*1.1,S.y+s.cou*1.2),s:Math.round(ang/DEG)+'°',ancre:'end'});
    return {pts:{hanche:H,epaule:S,cou:C,tete:T},segs:[['hanche','epaule',s.tronc],['epaule','cou',s.cou]],deco,meta:{ok:true,angle:R2(ang/DEG)}};
  }
  /** Les élévations latérales, de face : le bras jusqu'à l'horizontale, pas au-delà. */
  function elevations(s){
    const yS=s.taille-s.cou-s.tete;
    const SL=P(-s.epaules/2,yS), SR=P(s.epaules/2,yS);
    const ER=P(SR.x+s.bras,yS), WR=P(ER.x+s.avantBras,yS);
    const EL=P(SL.x,yS-s.bras), WL=P(SL.x,EL.y-s.avantBras);
    const HL=P(-s.bassin*0.28,yS-s.tronc), HR=P(s.bassin*0.28,yS-s.tronc);
    const C=P(0,yS+s.cou), T=P(0,C.y+s.tete/2);
    const deco=[{t:'tirets',a:P(SR.x,yS),b:P(WR.x+12,yS)},{t:'arc',c:SR,r:s.bras*0.6,deb:-90,fin:0},
      {t:'txt',p:P(SR.x+s.bras*0.5,yS-s.bras*0.5),s:'90°',ancre:'start'}];
    return {pts:{epauleG:SL,epauleD:SR,coudeG:EL,coudeD:ER,mainG:WL,mainD:WR,hancheG:HL,hancheD:HR,cou:C,tete:T},
      segs:[['epauleG','coudeG',s.bras],['coudeG','mainG',s.avantBras],['epauleD','coudeD',s.bras],['coudeD','mainD',s.avantBras],['epauleG','epauleD',s.epaules],['epauleG','hancheG'],['epauleD','hancheD']],
      deco,meta:{ok:true},accent:[['epauleD','coudeD'],['coudeD','mainD']]};
  }
  /** Le biceps, coude à 90° de profil : le corps charnu s'arrête à `espace` du pli du coude. */
  function biceps(s,o){
    const esp=Number(o&&o.espace)>=0?Number(o.espace):3;
    const S=P(0,s.bras), E=P(0,0), W=P(s.avantBras,0);
    const fin=P(3,esp), deb=P(3,s.bras*0.85);
    const deco=[{t:'ventre',a:deb,b:fin,ep:9},{t:'cote',a:P(-4,0),b:P(-4,esp),txt:esp+' cm',dec:-14}];
    return {pts:{epaule:S,coude:E,poignet:W},segs:[['epaule','coude',s.bras],['coude','poignet',s.avantBras]],deco,meta:{ok:true,espace:esp}};
  }
  /** Le mollet de profil : la part du corps charnu sur la jambe, et le tendon qui reste. */
  function mollet(s,o){
    const part=Number(o&&o.part)>0&&Number(o.part)<1?Number(o.part):0.6;
    const K=P(0,s.tibia+s.cheville), A=P(0,s.cheville);
    const bas=P(-4,K.y-s.tibia*part);
    const deco=[{t:'ventre',a:P(-4,K.y-3),b:bas,ep:11},{t:'seg',a:bas,b:P(-3,1),ep:2.4,c:'encre'},
      {t:'cote',a:P(-14,bas.y),b:P(-14,1),txt:'tendon '+Math.round(bas.y-1)+' cm',dec:0}];
    _pied(s,0,deco);
    return {pts:{genou:K,cheville:A},segs:[['genou','cheville',s.tibia]],deco,meta:{ok:true,tendon:R2(bas.y-1)}};
  }
  /** La longue portion du triceps : de l'omoplate à l'olécrane, bras le long du corps puis au-dessus de la tête. */
  function triceps(s){
    const S=P(0,0), O=P(-2.5,-3);           // l'origine, sous et derrière l'articulation
    const E1=P(0,-s.bras), Ol1=P(-2,-s.bras), W1=P(0,E1.y-s.avantBras);
    const E2=P(0,s.bras), Ol2=P(-2,s.bras+0.5), W2=P(-s.avantBras*0.7,E2.y+s.avantBras*0.7);
    const l1=dist(O,Ol1), l2=dist(O,Ol2);
    const deco=[{t:'ventre',a:O,b:Ol1,ep:6,c:'accent'},{t:'seg',a:S,b:E2,ep:3,c:'trait'},{t:'seg',a:E2,b:W2,ep:3,c:'trait'},
      {t:'seg',a:O,b:Ol2,ep:2,c:'accent',tirets:'4 4'},
      {t:'txt',p:P(8,E2.y-4),s:'+'+Math.round(l2-l1)+' cm',ancre:'start',c:'accent'}];
    return {pts:{epaule:S,coude:E1,poignet:W1,origine:O},segs:[['epaule','coude',s.bras],['coude','poignet',s.avantBras]],deco,meta:{ok:true,etirement:R2(l2-l1)}};
  }
  /** Le dos de face : le bord inférieur des dorsaux, haut ou bas sur le tronc. */
  function dorsaux(s,o){
    const bas=Number(o&&o.bas)>0&&Number(o.bas)<1?Number(o.bas):0.15;
    const yS=s.tronc, SL=P(-s.epaules/2,yS), SR=P(s.epaules/2,yS);
    const HL=P(-s.bassin/2,0), HR=P(s.bassin/2,0);
    const aisL=P(SL.x+3,yS-8), aisR=P(SR.x-3,yS-8), pointe=P(0,s.tronc*bas);
    const deco=[{t:'seg',a:P(0,0),b:P(0,yS+4),ep:1.5,c:'trait'},{t:'seg',a:aisL,b:pointe,ep:4,c:'accent'},{t:'seg',a:aisR,b:pointe,ep:4,c:'accent'},
      {t:'seg',a:HL,b:HR,ep:3,c:'trait'},{t:'cote',a:P(s.bassin/2+8,0),b:P(s.bassin/2+8,pointe.y),txt:Math.round(pointe.y)+' cm',dec:0}];
    return {pts:{epauleG:SL,epauleD:SR,hancheG:HL,hancheD:HR,pointe},segs:[['epauleG','epauleD',s.epaules],['epauleG','hancheG'],['epauleD','hancheD']],deco,meta:{ok:true,hauteur:R2(pointe.y)}};
  }
  const POSES=Object.freeze({deboutProfil,squat,souleve,developpe,humerusParallele,traction,envergure,buste,valgusCoude,genoux,bassin,cou,elevations,biceps,mollet,triceps,dorsaux});

  // ── LE RENDU ──────────────────────────────────────────────────────────────
  function _boite(pose){
    const xs=[], ys=[];
    const ajoute=p=>{ if(p&&isFinite(p.x)&&isFinite(p.y)){ xs.push(p.x); ys.push(p.y); } };
    Object.values(pose.pts||{}).forEach(ajoute);
    for(const d of pose.deco||[]){
      ajoute(d.a); ajoute(d.b); ajoute(d.c); ajoute(d.p);
      if(d.t==='disque'){ ajoute(P(d.c.x-d.r,d.c.y-d.r)); ajoute(P(d.c.x+d.r,d.c.y+d.r)); }
      if(d.t==='ellipse'){ ajoute(P(d.c.x-d.rx,d.c.y-d.ry)); ajoute(P(d.c.x+d.rx,d.c.y+d.ry)); }
      if(d.t==='cote'&&d.dec){ ajoute(P(d.a.x,d.a.y+d.dec*0.8)); ajoute(P(d.b.x,d.b.y+d.dec*0.8)); }
    }
    if(pose.pts&&pose.pts.tete){ ajoute(P(pose.pts.tete.x,pose.pts.tete.y+12)); }
    return {x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)};
  }
  /** Dessine une pose dans une boîte écran {x, y, w, h} à l'échelle k (px par cm) donnée. */
  function _dessinerPose(pose,cadre,k,s){
    const b=_boite(pose);
    const ox=cadre.x+(cadre.w-(b.x1-b.x0)*k)/2-b.x0*k, oy=cadre.y+(cadre.h+(b.y1-b.y0)*k)/2+b.y0*k;
    const m=p=>({x:ox+p.x*k,y:oy-p.y*k});
    const ep=Math.max(2.5,Math.min(7,k*3.2));
    let h='';
    for(const d of pose.deco||[]){
      if(d.t==='seg') h+=segment(m(d.a),m(d.b),d.ep||2,d.c||'trait',d.tirets);
      else if(d.t==='tirets') h+=segment(m(d.a),m(d.b),1.2,'trait','4 4');
      else if(d.t==='barre') h+=cercle(m(d.c),Math.max(3,k*2.2),'accent',true);
      else if(d.t==='barreH') h+=segment(m(d.a),m(d.b),d.fantome?2:4,d.fantome?'trait':'accent',d.fantome?'6 5':null);
      else if(d.t==='disque') h+=cercle(m(d.c),d.r*k,'trait',false,2)+cercle(m(d.c),Math.max(3,k*1.6),'accent',true);
      else if(d.t==='ellipse'){ const c=m(d.c); h+='<ellipse cx="'+R2(c.x)+'" cy="'+R2(c.y)+'" rx="'+R2(d.rx*k)+'" ry="'+R2(d.ry*k)+'" fill="none" stroke="'+CHARTE.trait+'" stroke-width="2"/>'; }
      else if(d.t==='ventre') h+=segment(m(d.a),m(d.b),Math.max(4,Math.min(16,(d.ep||8)*k*0.45)),d.c||'accent');
    }
    const accent=new Set((pose.accent||[]).map(x=>x.join('-')));
    for(const sg of pose.segs||[]){
      const a=pose.pts[sg[0]], c=pose.pts[sg[1]]; if(!a||!c) continue;
      h+=segment(m(a),m(c),ep,accent.has(sg[0]+'-'+sg[1])?'accent':'encre');
    }
    for(const [n,p] of Object.entries(pose.pts||{})){
      if(n==='tete') h+=cercle(m(p),Math.max(6,(s?s.tete:22)*k*0.42),'encre',false,ep*0.7);
      else if(!/^(milieuPied|barre|centre|origine|pointe|bout[GD])$/.test(n)) h+=cercle(m(p),ep*0.62,'encre',true);
    }
    for(const d of pose.deco||[]){
      if(d.t==='cote') h+=cote(m(d.a),m(d.b),d.txt,d.dec||0);
      else if(d.t==='arc') h+=arcAngle(m(d.c),d.r*k,d.deb,d.fin);
      else if(d.t==='txt') h+=texte(m(d.p),d.s,d.taille||12,d.ancre,d.c||'accent',true);
    }
    return h;
  }
  /**
   * PURE. Un schéma : une pose (ou deux comparées), titre et légende.
   * @param {{titre?:string, legende?:string, pose:string, params?:object, comparer?:[{lib,params,options}]}} def
   */
  function dessiner(def,o){
    o=o||{};
    const W=Number(o.largeur)||640, H=Number(o.hauteur)||440, titreH=def.titre?34:8, piedH=def.legende?40:10;
    const fn=POSES[def.pose];
    if(!fn) throw new Error('Pose inconnue : '+def.pose);
    const cas=def.comparer&&def.comparer.length?def.comparer:[{lib:'',params:def.params||{},options:def.options||{}}];
    const poses=cas.map(c=>{ const s=silhouette(Object.assign({},def.params||{},c.params||{})); return {s,lib:c.lib,pose:fn(s,Object.assign({},def.options||{},c.options||{}))}; });
    // UNE SEULE ÉCHELLE pour tout le schéma : les longueurs se comparent à l'œil.
    const n=poses.length, cw=(W-20)/n, ch=H-titreH-piedH-(n>1?22:0);
    let k=Infinity;
    // La marge laisse la place au texte des cotes, qui déborde des points.
    for(const p of poses){ const b=_boite(p.pose); k=Math.min(k,(cw-90)/Math.max(1,b.x1-b.x0),(ch-24)/Math.max(1,b.y1-b.y0)); }
    let corps='';
    poses.forEach((p,i)=>{
      const cadre={x:10+i*cw,y:titreH,w:cw,h:ch};
      corps+=_dessinerPose(p.pose,cadre,k,p.s);
      if(p.lib) corps+=texte({x:cadre.x+cw/2,y:titreH+ch+16},p.lib,13,'middle','encre',true);
    });
    const leg=def.legende?_lignes(def.legende,Math.floor(W/7)).map((l,i)=>texte({x:W/2,y:H-piedH+16+i*15},l,11.5,'middle','encre')).join(''):'';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="'+echap(def.titre||def.pose)+'">'
      +'<rect width="'+W+'" height="'+H+'" rx="14" fill="'+CHARTE.fond+'"/>'
      +(def.titre?texte({x:W/2,y:24},def.titre,16,'middle','encre',true):'')+corps+leg+'</svg>';
  }
  function _lignes(t,max){
    const mots=String(t).split(/\s+/), out=[]; let l='';
    for(const m of mots){ if((l+' '+m).trim().length>max&&l){ out.push(l); l=m; } else l=(l+' '+m).trim(); }
    if(l) out.push(l);
    return out.slice(0,2);
  }

  // ── L'ATLAS : 20 SCHÉMAS ──────────────────────────────────────────────────
  // Les paramètres sont des parts de la taille (≤ 1) ; chaque comparaison ne
  // change QUE ce qu'elle montre, le reste est la silhouette par défaut.
  const _e=(cle,titre,legende,pose,params,comparer,options)=>Object.freeze({cle,titre,legende,pose,params:Object.freeze(params||{}),
    comparer:comparer?Object.freeze(comparer.map(c=>Object.freeze(c))):null,options:Object.freeze(options||{})});
  const ATLAS_SCHEMAS=Object.freeze([
    _e('femur_squat','Fémur court, fémur long au squat','À tibia et tronc égaux, un fémur long recule la hanche : le buste se penche davantage pour garder la barre au-dessus du pied.','squat',{},
      [{lib:'Fémur court',params:{femur:0.225}},{lib:'Fémur long',params:{femur:0.27}}]),
    _e('squat_favorable','Squat favorable, squat défavorable','Fémur court et tronc long : buste droit. Fémur long et tronc court : buste penché, plus de travail pour la hanche et le dos.','squat',{},
      [{lib:'Favorable',params:{femur:0.225,tronc:0.305}},{lib:'Défavorable',params:{femur:0.27,tronc:0.27}}]),
    _e('developpe_cage_fine','Développé : cage fine, bras longs','Une cage peu profonde et des bras longs : la barre parcourt une longue course entre la poitrine et les bras tendus.','developpe',{thorax:0.105,bras:0.2,avantBras:0.157}),
    _e('developpe_cage_epaisse','Développé : cage épaisse, bras courts','Une cage profonde et des bras courts : la poitrine vient à la rencontre de la barre, la course est courte.','developpe',{thorax:0.15,bras:0.172,avantBras:0.135}),
    _e('humerus_parallele','Humérus parallèle au sol','Coudes à hauteur d’épaules : selon la profondeur de la cage, la barre est encore au-dessus de la poitrine, ou déjà dessus.','humerusParallele',{},
      [{lib:'Cage fine',params:{thorax:0.105}},{lib:'Cage épaisse',params:{thorax:0.15}}]),
    _e('tractions_humerus','Tractions : humérus long, humérus court','Plus le bras est long, plus la course entre la suspension et le menton au-dessus de la barre est longue.','traction',{},
      [{lib:'Humérus court',params:{bras:0.17}},{lib:'Humérus long',params:{bras:0.2}}]),
    _e('souleve_bras','Soulevé : bras longs, bras courts','Des bras longs montent les épaules : la hanche part plus haut et le buste plus droit. Des bras courts la font descendre.','souleve',{},
      [{lib:'Bras longs',params:{bras:0.2,avantBras:0.157}},{lib:'Bras courts',params:{bras:0.172,avantBras:0.135}}]),
    _e('envergure_taille','Envergure et taille','Bras en croix, l’envergure dépasse souvent un peu la taille. Au-delà de 1,03 fois la taille, les bras sont longs.','envergure',{}),
    _e('buste_court_long','Buste court, buste long','À taille égale, la longueur du tronc change la façon de squatter et de soulever.','buste',{},
      [{lib:'Buste court',params:{tronc:0.27}},{lib:'Buste long',params:{tronc:0.305}}]),
    _e('valgus_coude','Valgus du coude','L’avant-bras s’écarte naturellement de l’axe du bras, de 5 à 15°, souvent plus chez les femmes. Il oriente la prise.','valgusCoude',{},null,{angle:15}),
    _e('genoux_valgum','Genoux en valgum','Les genoux se rapprochent quand les chevilles restent écartées.','genoux',{},null,{type:'valgum',angle:7}),
    _e('genoux_varum','Genoux en varum','Les genoux s’écartent quand les chevilles se touchent.','genoux',{},null,{type:'varum',angle:6}),
    _e('bassin_anteversion','Bassin en antéversion','L’avant du bassin descend : la cambrure lombaire augmente.','bassin',{},null,{angle:14}),
    _e('bassin_retroversion','Bassin en rétroversion','L’avant du bassin remonte : le bas du dos s’arrondit.','bassin',{},null,{angle:-6}),
    _e('cou_neutre_extension','Cou neutre, cou en extension','Le regard à l’horizontale garde le cou dans l’axe du buste ; la tête renversée le met en extension.','cou',{},
      [{lib:'Neutre',options:{angle:0}},{lib:'En extension',options:{angle:30}}]),
    _e('elevations_horizontale','Élévations jusqu’à l’horizontale','Le bras monte jusqu’à l’horizontale : au-delà, ce sont surtout les trapèzes qui travaillent.','elevations',{}),
    _e('biceps_court_long','Biceps court, biceps long','L’espace entre le corps charnu du biceps et le pli du coude : grand pour un biceps court, presque nul pour un biceps long.','biceps',{},
      [{lib:'Biceps court',options:{espace:5}},{lib:'Biceps long',options:{espace:1}}]),
    _e('mollets_courts_longs','Mollets courts, mollets longs','Un mollet court laisse un long tendon d’Achille ; un mollet long descend presque jusqu’à la cheville.','mollet',{},
      [{lib:'Mollet court',options:{part:0.42}},{lib:'Mollet long',options:{part:0.72}}]),
    _e('triceps_longue_portion','Triceps : la longue portion','La longue portion part de l’omoplate : bras au-dessus de la tête, elle s’allonge et travaille en position étirée.','triceps',{}),
    _e('dorsaux_insertion','Dorsaux : insertion haute, insertion basse','Le bord inférieur des dorsaux s’arrête plus ou moins haut au-dessus du bassin : c’est une forme, pas un défaut.','dorsaux',{},
      [{lib:'Insertion haute',options:{bas:0.32}},{lib:'Insertion basse',options:{bas:0.1}}])
  ]);
  /** PURE. Le SVG d'une entrée de l'atlas, par sa clé. */
  function dessinerAtlas(cle,o){
    const e=ATLAS_SCHEMAS.find(x=>x.cle===cle);
    if(!e) throw new Error('Schéma inconnu : '+cle);
    return dessiner({titre:e.titre,legende:e.legende,pose:e.pose,params:e.params,comparer:e.comparer,options:e.options},o);
  }
  /** PURE. Le schéma personnel : la pose avec les mesures de l'athlète. */
  function dessinerPersonnel(params,pose,o){
    const t={squat:'Ton squat',souleve:'Ton soulevé de terre',developpe:'Ton développé couché',traction:'Ta traction',envergure:'Ton envergure'};
    return dessiner({titre:(o&&o.titre)||t[pose]||'Ton schéma',legende:o&&o.legende,pose,params},o);
  }

  racine.RCSchemas=Object.freeze({CHARTE,PROPORTIONS,ATLAS_SCHEMAS,POSES,segment,arcAngle,cote,texte,cercle,silhouette,intersection,dessiner,dessinerAtlas,dessinerPersonnel});
})(typeof globalThis!=='undefined'?globalThis:this);
