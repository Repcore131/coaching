// ══ LES TROIS GRAPHIQUES DU CADRE CORPS ════════════════════════════════════
//
// ⚠ ILS SE NOURRISSENT DES BILANS ET DES SEANCES, DE RIEN D'AUTRE. Aucun
//   chiffre n'est deduit d'une photo, aucun n'est extrapole entre deux
//   releves : une courbe relie des points mesures, et s'arrete ou les mesures
//   s'arretent.
//
// ⚠ ET AUCUN N'EST UN SCORE. Ce sont des kilos, des centimetres et des series
//   dures — trois unites, trois protocoles, trois sources. Un « indice de
//   progression » agrege n'aurait ni unite ni methode.
const CORPS_GRAPHE_SEMAINES=8;
/**
 * PURE. Les points d'une mensuration : [{x:date, v:valeur}], du plus ancien au
 * plus recent.
 *
 * ⚠ MEMES REGLES QUE L'ETIQUETTE : les valeurs REPORTEES sont ecartees. Une
 *   courbe qui relie un releve a un report dessine une progression que
 *   personne n'a mesuree — c'est exactement ce que corpsEcart refuse, et une
 *   courbe ment plus fort qu'un nombre parce qu'elle a l'air continue.
 */
function corpsPointsMesure(u,cle){
  if(!cle) return [];
  let bl=[];
  try{ bl=bilansOrdonnes(u)||[]; }catch(e){ return []; }
  const out=[];
  for(const b of bl){
    let rep=false; try{ rep=bmReportee(b,cle); }catch(e){ rep=false; }
    if(rep) continue;
    let v=null; try{ v=getBM(b,cle); }catch(e){ v=null; }
    if(v>0) out.push({x:Number(b&&b.date)||0,v});
  }
  return out;
}
// PURE. Les poids releves au bilan. getBW, et rien d'autre : la pesee
// quotidienne vit ailleurs et n'a pas le meme protocole — a jeun, apres les
// toilettes, sur la meme balance — ce qui rendrait les deux series
// incomparables sur un meme axe.
function corpsPointsPoids(u){
  let bl=[];
  try{ bl=bilansOrdonnes(u)||[]; }catch(e){ return []; }
  const out=[];
  for(const b of bl){
    let v=null; try{ v=getBW(b); }catch(e){ v=null; }
    if(v>0) out.push({x:Number(b&&b.date)||0,v});
  }
  return out;
}
/**
 * Les series dures par semaine d'un muscle, sur les dernieres semaines.
 * IMPURE — elle lit l'horloge par _volCleDecalee. `x` est un RANG de semaine,
 * pas une date : les semaines sont regulieres, et les espacer par leur
 * horodatage n'aurait fait qu'ajouter du bruit.
 *
 * ⚠ `fin` EST LE RANG DE LA DERNIERE SEMAINE MONTREE, et il n'est pas
 *   decoratif. Mesure faite un LUNDI : la semaine en cours etait vide, la
 *   courbe plongeait a zero au bord droit et le chiffre en tete du cadre
 *   annoncait « 0 » — sur un athlete qui s'entraine six fois par semaine. Le
 *   meme piege avait ete vu et traite pour la teinte ; il ne l'avait pas ete
 *   pour la courbe. On s'arrete donc a la derniere semaine TRAVAILLEE, celle
 *   que corpsSemaineVolume designe, et le pied du cadre la nomme.
 */
function corpsPointsVolume(u,muscle,n,fin){
  const N=Math.max(2,Number(n)||CORPS_GRAPHE_SEMAINES);
  const f=Math.max(0,Number(fin)||0);
  const out=[];
  for(let i=f+N-1;i>=f;i--){
    let vol={};
    try{ vol=volumeSemaine(u,_volCleDecalee(i))||{}; }catch(e){ vol={}; }
    out.push({x:f+N-1-i,v:Math.round((Number(vol[muscle])||0)*10)/10});
  }
  return out;
}
/**
 * La semaine EN COURS, ENTIERE, telle que le programme la prevoit — ou null
 * quand il ne prevoit aucune serie. IMPURE : elle lit l'horloge.
 *
 * ⚠ KEVIN, 22/09/2026 : « sur une semaine entiere de programme ». Le bord
 *   droit de la courbe etait la semaine en cours comptee sur les seules
 *   seances deja faites : un mardi, les trois courbes plongeaient, et le
 *   graphique disait l'avancee de la semaine au lieu de la charge du
 *   programme. volumePrescritSemaine rend la semaine effective du bloc —
 *   decharge et ecarts compris —, ou le gabarit sans bloc date.
 * @returns {{cle:string,muscles:Object.<string,number>,source:string}|null}
 */
function corpsSemainePrevue(u){
  let v=null;
  try{ v=volumePrescritSemaine(u,new Date()); }catch(e){ v=null; }
  const muscles=(v&&v.muscles)||{};
  if(!Object.keys(muscles).some(m=>MUSCLES[m]&&muscles[m]>0)) return null;
  let cle=null;
  try{ cle=_volCleDecalee(0); }catch(e){ return null; }
  return {cle,muscles,source:v.source};
}
/**
 * Les trois courbes des series dures et la phrase qui les date, ou null.
 * IMPURE — elle lit l'horloge.
 *
 * ⚠ AVEC UN PROGRAMME, LES SEMAINES PASSEES SONT CE QUI A ETE FAIT, ET LA
 *   SEMAINE EN COURS EST LA SEMAINE ENTIERE DU PROGRAMME, en pointillé. Elle
 *   n'est plus coupee a « aujourd'hui », et le lundi vide ne fait plus
 *   plonger la courbe. Les trois muscles sont les plus charges du PROGRAMME
 *   ENTIER — ceux que la silhouette peint le plus fonce, a cote.
 * ⚠ SANS PROGRAMME, RIEN N'EST PREVU ET RIEN NE S'INVENTE : la courbe
 *   s'arrete a la derniere semaine travaillee, comme avant.
 * @returns {{series:{lib:string,couleur:string,points:{x:number,v:number,prevu?:boolean}[]}[],pied:string}|null}
 */
function corpsCourbesVolume(u,semaines){
  // ⚠ QUATRE SEMAINES AU MINIMUM, quelle que soit la periode demandee : sur
  //   deux points, une courbe de volume ne dit rien qu'un chiffre ne dise
  //   mieux.
  const N=Math.max(4,Number(semaines)||CORPS_GRAPHE_SEMAINES);
  const serie=(m,points)=>({lib:(MUSCLES[m]||{}).lib||m,
    couleur:(MUSCLES[m]||{}).c||'var(--sub)',points});
  const lesTrois=ref=>Object.keys(ref).filter(m=>MUSCLES[m]&&ref[m]>0)
    .sort((a,b)=>(ref[b]||0)-(ref[a]||0)).slice(0,3);
  const prev=corpsSemainePrevue(u);
  if(prev){
    let prog=null;
    try{ prog=volumePrescritProgramme(u); }catch(e){ prog=null; }
    let top=lesTrois((prog&&prog.muscles)||{});
    if(!top.length) top=lesTrois(prev.muscles);
    if(!top.length) return null;
    return {series:top.map(m=>serie(m,corpsPointsVolume(u,m,N-1,1).concat([{x:N-1,
        v:Math.round((Number(prev.muscles[m])||0)*10)/10,prevu:true}]))),
      pied:'Les trois muscles les plus chargés du programme, sur '+N+' semaines : '
        +'les séries faites, puis en pointillé la semaine du '+_corpsLibSemaine(prev.cle)
        +' entière, telle que le programme la prévoit, et non son avancée.'};
  }
  const sem=corpsSemaineVolume(u);
  if(!sem) return null;
  let vol={};
  try{ vol=volumeSemaine(u,sem.cle)||{}; }catch(e){ vol={}; }
  const top=lesTrois(vol);
  if(!top.length) return null;
  return {series:top.map(m=>serie(m,corpsPointsVolume(u,m,N,sem.decalage))),
    pied:'Les trois muscles les plus chargés, sur '+N
      +' semaines, jusqu’à la semaine du '+_corpsLibSemaine(sem.cle)+'.'};
}
/**
 * PURE. Une courbe SVG, a echelle PARTAGEE entre ses series.
 *
 * ⚠ _sparkline N'A PAS PU SERVIR, ET C'EST LA SEULE RAISON D'AVOIR ECRIT
 *   CECI. Elle met a l'echelle chaque appel SUR SES PROPRES points : deux
 *   appels pour la cuisse droite et la cuisse gauche auraient donne deux
 *   courbes normalisees separement, superposees, ou un ecart d'un demi
 *   centimetre aurait l'air d'un ecart de dix. La geometrie, elle, est reprise
 *   telle quelle — meme viewBox etire, meme vector-effect pour que le trait
 *   garde son pixel.
 *
 * ⚠ AUCUN TEXTE DANS LE SVG. Le viewBox est etire en largeur
 *   (preserveAspectRatio="none") pour que les x tombent juste ; une lettre y
 *   serait aplatie. Les valeurs sont posees en HTML par-dessus.
 * @param {{lib:string,couleur:string,points:{x:number,v:number}[]}[]} series
 * @param {{h:number}} [o]
 * @returns {{svg:string,min:number,max:number,x0:number,x1:number}|null}
 */
function _corpsCourbe(series,o){
  const s=(series||[]).filter(x=>x&&Array.isArray(x.points)&&x.points.length);
  if(!s.length) return null;
  let xmin=Infinity,xmax=-Infinity,vmin=Infinity,vmax=-Infinity,n=0;
  // ⚠ LA BANDE DE TOLERANCE ENTRE DANS L'ECHELLE, elle n'est pas posee par
  //   dessus : dessinee hors des bornes, elle serait coupee par le cadre et
  //   une courbe au plafond n'aurait plus de marge visible au-dessus d'elle.
  for(const g of s) for(const p of g.points){
    if(!isFinite(p.x)||!isFinite(p.v)) continue;
    n++;
    const b=Math.abs(Number(g.bande)||0);
    if(p.x<xmin) xmin=p.x; if(p.x>xmax) xmax=p.x;
    if(p.v-b<vmin) vmin=p.v-b; if(p.v+b>vmax) vmax=p.v+b;
  }
  if(n<2) return null;
  const H=Number((o||{}).h)||40;
  const dx=(xmax-xmin)||1, dv=(vmax-vmin)||1;
  // ⚠ UNE SERIE QUI N'A PAS BOUGE SE TRACE AU MILIEU, PAS AU RAS DU SOL.
  //   Releve a la relecture du code : avec vmax === vmin, l'ecart vaut zero et
  //   la ligne tombait sur le plancher du cadre — un tour de buste stable a
  //   99 cm se lisait comme un tour de buste a zero. Le plat est une
  //   information ; le sol en est une autre, et fausse.
  const plat=(vmax===vmin);
  // Deux pixels de marge en haut et en bas : une courbe qui touche le bord se
  // lit comme une courbe coupee.
  const X=p=>((p.x-xmin)/dx)*100;
  const Y=p=>plat?(H/2):(H-2-((p.v-vmin)/dv)*(H-4));
  const trait=(pts,couleur,tirets)=>'<path d="'
    +pts.map((p,i)=>(i?'L':'M')+X(p).toFixed(2)+' '+Y(p).toFixed(2)).join(' ')
    +'" fill="none" stroke="'+escapeHtml(couleur)
    +'" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"'
    +(tirets?' stroke-dasharray="3 3"':'')
    +' vector-effect="non-scaling-stroke"/>';
  let corps='', bandes='';
  for(const g of s){
    const pts=g.points.filter(p=>isFinite(p.x)&&isFinite(p.v))
      .slice().sort((a,b)=>a.x-b.x);
    if(pts.length<2) continue;
    // LA MARGE DE MESURE, EN GRIS CLAIR AUTOUR DE LA LIGNE (Kevin, 23/09/2026 :
    // « sans elles, un coach lit une progression la ou il n'y a que du bruit de
    // ruban »). En gris et non a la couleur de la serie : la bande n'est pas
    // une seconde courbe, c'est le flou de la premiere.
    // ⚠ TOUTES LES BANDES SE DESSINENT AVANT TOUTES LES LIGNES, d'ou les deux
    //   chaines : sur deux series, la bande de la seconde aurait recouvert la
    //   ligne de la premiere.
    const bd=Math.abs(Number(g.bande)||0);
    if(bd>0){
      const haut=pts.map(p=>({x:p.x,v:p.v+bd}));
      const bas=pts.map(p=>({x:p.x,v:p.v-bd})).reverse();
      bandes+='<path d="'
        +haut.map((p,i)=>(i?'L':'M')+X(p).toFixed(2)+' '+Y(p).toFixed(2)).join(' ')+' '
        +bas.map(p=>'L'+X(p).toFixed(2)+' '+Y(p).toFixed(2)).join(' ')
        +' Z" fill="rgba(255,255,255,.10)" stroke="none"/>';
    }
    // ⚠ UN POINT PREVU SE TRACE EN POINTILLE, JAMAIS DANS LE TRAIT PLEIN. Le
    //   trait plein dit ce qui a ete fait ; prolonger ce trait jusqu'a un
    //   point prevu ferait passer le programme pour des seances faites.
    const i0=pts.findIndex(p=>p.prevu);
    const pleins=i0<0?pts:pts.slice(0,i0);
    const prevus=i0<0?[]:pts.slice(Math.max(0,i0-1));
    if(pleins.length>=2) corps+=trait(pleins,g.couleur,false);
    if(prevus.length>=2) corps+=trait(prevus,g.couleur,true);
  }
  if(!corps) return null;
  // Le filet du bas : il donne un sol a la courbe. Sans lui, une ligne seule
  // sur du noir ne dit pas si elle monte ou si le cadre penche.
  const grille='<line x1="0" y1="'+(H-2)+'" x2="100" y2="'+(H-2)
    +'" stroke="rgba(255,255,255,.12)" stroke-width="1" vector-effect="non-scaling-stroke"/>';
  return {svg:'<svg class="cc-corps-gc" viewBox="0 0 100 '+H+'"'
    +' preserveAspectRatio="none" aria-hidden="true">'+grille+bandes+corps+'</svg>',
    min:vmin,max:vmax,x0:xmin,x1:xmax,plat};
}
// « 100,9 ». Une decimale au plus, virgule francaise, et pas de zero inutile.
function _corpsNb(v){
  const n=Math.round((Number(v)||0)*10)/10;
  return String(n).replace('.',',');
}
// Une carte de graphique : titre, derniere valeur, courbe, bornes et legende.
function _htmlCorpsGraphe(titre,unite,series,o){
  const c=_corpsCourbe(series,o);
  if(!c) return '';
  // ⚠ LE CHIFFRE EN TETE NE SORT QUE S'IL DESIGNE QUELQUE CHOSE. Sur une
  //   carte a trois series — trois muscles — il aurait affiche la valeur de la
  //   PREMIERE sous un titre qui parle des trois. L'appelant passe alors une
  //   chaine vide, et la legende porte le sens.
  const der=(typeof (o||{}).valeur==='string')?o.valeur:(()=>{
    const g=series.find(x=>x&&x.points&&x.points.length);
    const p=g.points[g.points.length-1];
    return _corpsNb(p.v)+(unite?(' '+unite):'');
  })();
  const leg=series.length>1
    ?'<div class="cc-corps-gk">'+series.map(g=>'<span><i style="background:'
      +escapeHtml(g.couleur)+'"></i>'+escapeHtml(g.lib)+'</span>').join('')+'</div>':'';
  // ⚠ LA PERIODE, SUR LA CARTE, PARCE QU'UNE VALEUR PORTE SA DATE. Releve a la
  //   relecture a froid : « 100,9 kg » s'affichait en tete d'une courbe sans
  //   qu'on sache de quand datait ce chiffre ni sur quelle etendue la ligne
  //   etait tracee. Les etiquettes du corps, elles, portaient deja leurs dates.
  //   Elle n'est ecrite QUE lorsque les x sont des dates : sur la courbe de
  //   volume ce sont des rangs de semaine, et la semaine y est deja nommee.
  const per=((o||{}).dates&&c.x1>0)
    ?('du '+_corpsJour(c.x0)+' au '+_corpsJour(c.x1))
    :'';
  const pied=[(o||{}).pied||'',per].filter(Boolean).join(' · ');
  // ⚠ TOUT CE QUI ENTRE DANS LE HTML PASSE PAR escapeHtml, MEME CE QUI NE
  //   VIENT QUE DE CONSTANTES. Ces trois-la — la valeur en tete, les couleurs
  //   de legende, les couleurs de trace — ne portent aujourd'hui que des
  //   nombres et des jetons de palette, et etaient donc posees nues au milieu
  //   de voisines echappees. C'est exactement l'asymetrie qui, dans six mois,
  //   laisse passer la premiere chaine qui vient d'ailleurs.
  return '<div class="cc-corps-g">'
    +'<div class="cc-corps-gt"><span>'+escapeHtml(titre)+'</span><b>'
    +escapeHtml(der)+'</b></div>'
    // ET UNE SEULE BORNE QUAND RIEN N'A BOUGE : deux fois le meme nombre, en
    // haut et en bas du meme cadre, se lit comme une etendue.
    +'<div class="cc-corps-gz">'+c.svg
    +'<span class="cc-corps-gh">'+escapeHtml(_corpsNb(c.max))+'</span>'
    +(c.plat?'':'<span class="cc-corps-gb">'+escapeHtml(_corpsNb(c.min))+'</span>')
    +'</div>'+leg+(pied?('<div class="cc-corps-gp">'+escapeHtml(pied)+'</div>'):'')
    +'</div>';
}
/**
 * Les trois graphiques, empiles.
 *
 * ⚠ L'ORDRE EST CELUI DE LA MISSION, et il va du plus sur au plus derive : le
 *   poids est une lecture directe, les mensurations une lecture directe aussi
 *   mais par groupe, le volume un calcul. Un graphique qui ne peut rien tracer
 *   ne sort pas — une carte vide avec un titre est du mobilier.
 */
function _htmlCorpsGraphes(u,o){
  o=o||{};
  // LA PERIODE VIENT DE L'ETAGE, PAS DU CADRE : un seul selecteur pilote tout.
  // `depuis` = 0 pour « tout ». Les series par semaine, elles, se comptent en
  // rangs de semaine et non en dates : la periode s'y traduit en nombre de
  // semaines, avec un plancher de quatre — deux points ne font pas une courbe.
  const _dep=Number(o.depuis)||0;
  const _f=l=>_dep?(l||[]).filter(p=>p&&Number(p.x)>=_dep):(l||[]);
  let h='';
  // ── 1. LE POIDS ───────────────────────────────────────────────────────
  //
  // ⚠ AUCUNE COURBE DE POIDS EN MODE NEUTRE. Quand un antecedent de trouble
  //   du comportement alimentaire est declare au questionnaire de depart,
  //   blocPoidsCoach REFUSE deja de tracer quoi que ce soit : il remplace la
  //   section par un encart d'explication et une seule phrase chiffree. Tracer
  //   une courbe ici aurait defait cette decision trois sections plus haut,
  //   dans la meme fiche et sous les memes yeux.
  //
  //   LA SECTION POIDS PORTE DEJA L'EXPLICATION : on ne la repete pas. Deux
  //   annonces du meme fait dans le meme ecran, c'est une de trop — le fichier
  //   l'a deja tranche pour le bandeau « nouveau bilan ».
  //
  //   ⚠ ET SEULEMENT LE POIDS. Les mensurations et la charge restent : c'est
  //   la portee exacte de blocPoidsCoach, et l'elargir ici aurait invente une
  //   regle que personne n'a ecrite.
  let _neutre=false;
  try{ _neutre=aTCA(u); }catch(e){ _neutre=false; }
  if(!_neutre&&o.poids!==false) h+=_htmlCorpsGraphe('Poids','kg',
    [{lib:'Poids',couleur:'#E02020',points:_f(corpsPointsPoids(u))}],
    {h:44,dates:true,
     pied:'Relevé au bilan. La pesée quotidienne a son propre protocole '
      +'et n’est pas mélangée ici.'});
  // ── 2. LES MENSURATIONS, PAR GROUPE ───────────────────────────────────
  // ⚠ HUIT PETITES COURBES PLUTOT QU'UNE GRANDE. Un tour de bras de 39 cm et
  //   un tour de taille de 86 sur le meme axe ecrasent le premier contre le
  //   sol : ils n'ont rien a faire sur la meme echelle. Chaque groupe garde la
  //   sienne, et c'est ce que fait deja l'ecran Mensurations de l'athlete.
  let minis='', mx0=Infinity, mx1=-Infinity;
  for(const g of MENS_GROUPES){
    const series=g.items.map(it=>({lib:it.l||g.label,couleur:it.color,
      points:_f(corpsPointsMesure(u,it.k)),
      // LA MARGE DU RUBAN, DESSINEE AUTOUR DE CHAQUE TOUR : c'est la meme
      // tolerance que les etiquettes et la teinte annoncent deja en chiffres.
      bande:(typeof SYN_BRUIT_MESURE==='number')?SYN_BRUIT_MESURE:0.5}));
    const c=_corpsCourbe(series,{h:30});
    if(!c) continue;
    if(c.x0<mx0) mx0=c.x0;
    if(c.x1>mx1) mx1=c.x1;
    const der=(()=>{
      const s=series.find(x=>x.points.length);
      return _corpsNb(s.points[s.points.length-1].v);
    })();
    minis+='<div class="cc-corps-m">'
      +'<div class="cc-corps-mt"><span>'+escapeHtml(g.label)+'</span><b>'+der+'</b></div>'
      +c.svg+'</div>';
  }
  if(minis)
    h+='<div class="cc-corps-g"><div class="cc-corps-gt">'
      +'<span>Mensurations</span><b>cm</b></div>'
      +'<div class="cc-corps-mg">'+minis+'</div>'
      +'<div class="cc-corps-gp">Une échelle par groupe : un tour de bras et un '
      +'tour de taille sur le même axe ne se comparent pas.'
      // ⚠ L'ETENDUE EST CELLE DE TOUTES LES COURBES REUNIES, et le mot « au
      //   plus large » le dit : d'un groupe a l'autre la periode differe des
      //   que l'athlete saute une mesure, et annoncer une periode unique comme
      //   si elle valait pour chacune aurait menti sur les plus courtes.
      +(mx1>0?(' Relevés du '+_corpsJour(mx0)+' au '+_corpsJour(mx1)
        +', au plus large.'):'')
      +'</div></div>';
  // ── 3. LE VOLUME HEBDOMADAIRE, TROIS MUSCLES ──────────────────────────
  // ⚠ TROIS, PAS DIX-HUIT. Dix-huit lignes sur quatre-vingts pixels de haut
  //   font une pelote. Ce sont les trois muscles les plus charges de la
  //   semaine de reference — ceux dont la charge decide du reste.
  // ⚠ VINGT-SIX SEMAINES AU PLUS, meme sur « 1 an » ou « Tout ». Cinquante-deux
  //   points de volume sur quarante-quatre pixels de haut font une pelote, et
  //   chaque semaine coute un calcul de volume. Le pied de la carte dit
  //   toujours sur combien de semaines elle porte : la carte ne ment pas sur
  //   sa propre fenetre, elle la nomme.
  const cv=corpsCourbesVolume(u,_dep?Math.max(4,Math.min(26,Math.round((Date.now()-_dep)/6048e5))):0);
  if(cv) h+=_htmlCorpsGraphe('Séries dures par semaine','',cv.series,
    {h:44,valeur:'',pied:cv.pied});
  return h;
}
/**
 * Les deux colonnes d'etiquettes et leurs traits de rappel : une etiquette
 * par MENSURATION qui a un ecart, jamais par muscle.
 *
 * ⚠ AUCUNE COULEUR DE JUGEMENT SUR UN CENTIMETRE. C'est la regle R32 : aucun
 *   objectif declare ne dit dans quel sens un tour de cuisse « doit » aller.
 *   L'ecart s'ecrit donc toujours dans la meme encre.
 *
 *   ⚠ ET LA TEINTE « EVOLUTION » DU LOT 3 N'EST PAS UNE EXCEPTION A CETTE
 *     REGLE, MEME SI ELLE EN A L'AIR. Elle peint le muscle en vert quand son
 *     tour a PRIS et en rouge quand il a PERDU : c'est un SENS, pas un
 *     jugement, et la legende l'ecrit avant de dire quoi que ce soit d'autre
 *     (« la couleur dit le sens de la mesure, jamais un jugement sur son
 *     corps »). L'etiquette, elle, garde son encre unique : c'est ici que la
 *     regle s'applique, et elle n'a pas bouge. Kevin, 23/09/2026, a demande la
 *     teinte en ces termes ; si un jour elle doit tomber, c'est cette phrase-la
 *     qu'il faudra relire, pas le code.
 *
 *     ⚠ ET C'EST ARBITRE, PAS SUBI. La relecture du lot 11 lui a pose la
 *       question en face, le 24/09/2026 : « garde le vert et le rouge ». La
 *       teinte reste, avec sa legende qui la borne. Personne n'a besoin de
 *       rouvrir le sujet.
 *
 * ⚠ DEUX COMPTEURS, ET ILS NE DISENT PAS LA MEME CHOSE depuis le 23/09/2026 :
 *   `etiquettes` compte ce qui est POSE sur le corps — toute mensuration
 *   mesuree, zeros compris — et `avecEcart` ce qui porte un ECART calcule.
 *   Un seul compteur melangerait « dix tours affiches » et « trois tours qui
 *   ont bouge », et le pied de cadre se tromperait de phrase.
 * @returns {{etiquettes:string,traits:string,avecEcart:number,nEtiquettes:number}}
 */
function _htmlCorpsEtiquettes(u,genre,vue,o){
  o=o||{};
  const g0=(100-CORPS_PART_CORPS)/2;
  const par={l:[],r:[]};
  for(const m of (CORPS_MESURES[vue]||[])){
    const inf=corpsMesureEtiquette(u,m.k);
    if(!inf) continue;
    const a=corpsAncre(genre,vue,m.k);
    if(!a) continue;
    (par[m.s]||par.l).push({inf,x:g0+a.x*CORPS_PART_CORPS/100,y:a.y});
  }
  let ets='', segments='', points='', avecEcart=0, nEtiquettes=0;
  for(const cote of ['l','r']){
    const col=par[cote].slice().sort((p,q)=>p.y-q.y);
    const ys=corpsEtaler(col.map(p=>p.y),CORPS_ETIQ_GAP,CORPS_ETIQ_HAUT,CORPS_ETIQ_BAS);
    col.forEach((p,i)=>{
      const cy=ys[i];
      const inf=p.inf;
      nEtiquettes++;
      if(inf.ecart) avecEcart++;
      // TROIS LIGNES CHEZ LE COACH : la mensuration, son ecart, ses deux
      // dates. La source et la date sont SUR l'etiquette, la tolerance dans
      // l'infobulle et au pied du cadre — la doctrine, verifiable.
      //
      // ⚠ DEUX LIGNES CHEZ L'ELEVE (o.dates a faux). Kevin, 23/09/2026 : « tu
      //   ne me mets pas les dates, tu mets juste moins 1 cm, poitrine ... le
      //   client n'a pas besoin de voir ca. Autant le coach, oui ». Sur son
      //   ecran, l'athlete a la periode partout ailleurs — l'onglet trace ses
      //   courbes juste dessous, avec leurs dates.
      //
      // ⚠ L'INFOBULLE ET LA PHRASE LUE, ELLES, GARDENT LES DATES DES DEUX
      //   COTES. Un voyant peut survoler l'etiquette pour les retrouver ; les
      //   retirer de l'aria-label aurait pris a un lecteur d'ecran ce que le
      //   survol rend a tous les autres. On enleve une ligne a l'oeil, pas une
      //   information a quelqu'un.
      const lignes='<span class="cc-corps-em">'+escapeHtml(inf.lib)+'</span>'
        +'<span class="cc-corps-ev">'+escapeHtml(inf.valeur)+'</span>'
        +(o.dates===false?''
          :'<span class="cc-corps-ed">'+escapeHtml(inf.periode)+'</span>');
      // ⚠ role="img" ET aria-label, LA CONVENTION DE LA MAISON pour « cet
      //   ensemble visuel dit ceci ». Sans elle, un lecteur d'ecran enfilait
      //   trois fragments detaches sans dire qu'ils parlent du meme tour. Les
      //   points medians deviennent des virgules : ils separent a l'oeil et
      //   ne s'entendent pas.
      const parle=String(inf.titre).split(' · ').join(', ');
      ets+='<div class="cc-corps-et" data-c="'+cote+'" data-k="'+escapeHtml(inf.cle)+'"'
        +' role="img" aria-label="'+escapeHtml(parle)+'"'
        +' style="top:'+_arr1(cy)+'%" title="'+escapeHtml(inf.titre)+'">'
        +lignes+'</div>';
      // LE TRAIT PART DU BORD INTERIEUR DE L'ETIQUETTE et rejoint le tour par
      // une equerre : un segment horizontal a la hauteur de l'etiquette, puis
      // une oblique courte. C'est la geometrie de bBodySchema, a l'identique.
      const bx=(cote==='l')?CORPS_ETIQ_LARG:(100-CORPS_ETIQ_LARG);
      const mx=(cote==='l')?Math.max(bx,p.x-5):Math.min(bx,p.x+5);
      const droit=Math.abs(p.y-cy)<=1.5;
      const dd=droit?('M'+_arr1(bx)+','+_arr1(cy)+' L'+_arr1(p.x)+','+_arr1(p.y))
        :('M'+_arr1(bx)+','+_arr1(cy)+' L'+_arr1(mx)+','+_arr1(cy)
          +' L'+_arr1(p.x)+','+_arr1(p.y));
      segments+='<path class="cc-corps-tr" d="'+dd+'" vector-effect="non-scaling-stroke"/>';
      // LE POINT EST UN DIV, PAS UN <circle>. La scene est tracee en
      // preserveAspectRatio="none" pour que les centiemes tombent juste : un
      // cercle SVG y deviendrait une ellipse.
      points+='<div class="cc-corps-pt" style="left:'+_arr1(p.x)+'%;top:'+_arr1(p.y)+'%"></div>';
    });
  }
  const traits='<svg class="cc-corps-traits" viewBox="0 0 100 100"'
    +' preserveAspectRatio="none" aria-hidden="true">'+segments+'</svg>'+points;
  return {etiquettes:ets,traits,avecEcart,nEtiquettes};
}
/**
 * Le cadre du schema corporel. Rend '' quand il n'a rien le droit de montrer.
 *
 * ⚠ LE MEME CADRE DES DEUX COTES depuis le 23/09/2026 (Kevin : « rend
 *   disponible cette image ... corrige donc la version sur le profil de
 *   l'athlete dans le compte du coach au passage »). Deux rendus separes
 *   auraient fini par montrer deux corps differents pour le meme dossier — et
 *   c'est exactement ce que l'application evite partout ailleurs.
 *
 *   `o.titre`       remplace « Évolution élève numéro N » : chez l'athlete,
 *                   c'est SON corps, et un numero de fiche n'a aucun sens.
 *   `o.graphes`     a faux retire la colonne de courbes : l'onglet
 *                   Mensurations de l'athlete trace deja les siennes dessous.
 *   `o.dates`       a faux retire la troisieme ligne des etiquettes.
 *   `o.convention`  a faux retire la phrase de methode du pied de cadre.
 *   `o.explication` a faux retire le petit cadre qui explique la teinte.
 *
 * ⚠ LES TROIS DERNIERES SONT LA DEMANDE DE KEVIN DU 23/09/2026, ET ELLES NE
 *   RETIRENT QUE DE LA METHODE. « Ecart entre le premier et le dernier bilan
 *   ... supprime ca, je n'ai pas besoin de cette phrase-la sur le cote eleve,
 *   que sur le cote coach elle est interessante » ; « chaque muscle prend la
 *   couleur de la zone ... tu supprimes ce petit cadre-la, le client n'a pas
 *   besoin d'y avoir acces » ; « tu ne me mets pas les dates ». L'eleve garde
 *   TOUT CE QUI EST UNE MESURE — chaque tour, son ecart, sa silhouette, sa
 *   teinte et ses infobulles ; ce qui part, c'est le mode d'emploi que le
 *   coach, lui, doit pouvoir citer.
 *
 * ⚠ CE QUI NE DISPARAIT JAMAIS : LES PHRASES QUI EXPLIQUENT UN SILENCE. « Un
 *   seul bilan », « rien a lire de ce cote », « il faut deux releves » restent
 *   des deux cotes. Un cadre vide sans un mot serait une panne aux yeux de
 *   celui qui le regarde, et c'est la regle de la maison : on dit toujours
 *   pourquoi on se tait.
 *
 * ⚠ GROSSESSE OU ALLAITEMENT DECLARES : LE BLOC N'EXISTE PAS. Meme regle que
 *   les photos de progression, et pour la meme raison — on ne suit pas la
 *   transformation d'un corps qui change pour un motif qui ne nous regarde
 *   pas. C'est phpDisponible qui tranche, la meme fonction, pas une copie.
 */
function _htmlCorpsCadre(c,o){
  o=o||{};
  const u=_dossier(c);
  if(!u) return '';
  // ⚠ UNE INVITATION PAS ENCORE CONSOMMEE N'A PAS DE CORPS. `_fromCode` est un
  //   profil minimal fabrique a partir d'un code : personne ne s'est inscrit,
  //   il n'y a ni bilan ni silhouette a montrer. _majBoutonBilan ecarte ces
  //   dossiers pour la meme raison, et de la meme facon.
  if(c&&c._fromCode) return '';
  try{ if(!phpDisponible(u)) return ''; }catch(e){}
  // ⚠ LES DEUX VUES COTE A COTE — ONGLET DONNEES SEULEMENT. Kevin,
  //   24/09/2026 : « dans l'onglet Donnees et uniquement celui-la, mets la
  //   vue avant et la vue arriere a cote l'une de l'autre, le rectangle
  //   "Chaque muscle…" a droite des deux silhouettes, et le reste de la
  //   legende pile en dessous, au centre des trois parties ».
  //   Chaque vue est rendue par CETTE fonction, en pieces (o._parties) : deux
  //   calculs de teinte ou d'etiquettes a cote de celui-ci finiraient par
  //   montrer deux corps differents pour le meme dossier.
  if(o.deuxVues){
    const base=Object.assign({},o,{deuxVues:false,_parties:true});
    const f=_htmlCorpsCadre(c,Object.assign({},base,{vue:'face'}));
    const d=_htmlCorpsCadre(c,Object.assign({},base,{vue:'dos'}));
    // Sans bilan, la fonction rend son cadre eteint, en entier : on le garde.
    if(!f||typeof f==='string') return f||'';
    if(!d||typeof d==='string') return f.cadre;
    // LA PHRASE DU PIED EST CELLE DE LA VUE QUI PORTE UN ECART : celle de
    // l'autre dirait « rien a lire de ce cote », vrai pour elle seule.
    const note=(d.avecEcart&&!f.avecEcart)?d.note:f.note;
    return '<div class="cc-corps cc-corps-duo">'+f.tete
      +'<div class="cc-corps-trio">'
      +'<div class="cc-corps-col">'+f.scene+'</div>'
      +'<div class="cc-corps-col">'+d.scene+'</div>'
      +(f.explication?('<div class="cc-corps-col cc-corps-trio-x">'+f.explication+'</div>'):'')
      +'</div>'
      +'<div class="cc-corps-pied">'+note+(f.legende||d.legende)+'</div>'
      +'</div>';
  }
  const genre=woGenreAvatar(u);
  const vue=o.vue?((o.vue==='dos')?'dos':'face'):((_corpsVue==='dos')?'dos':'face');
  const pl=CORPS_PLANCHE[genre+'-'+vue]||CORPS_PLANCHE['h-face'];
  let bilans=[]; try{ bilans=bilansOrdonnes(u)||[]; }catch(e){ bilans=[]; }
  // LA LECTURE : celle du coach (_corpsMode), ou celle qu'impose l'appelant —
  // l'ecran de l'eleve reste sur le volume, une silhouette rouge et verte de son
  // propre corps n'est pas ce qu'on lui doit.
  const mode=(o.mode==='volume')?'volume':((o.mode==='evolution')?'evolution'
    :((_corpsMode==='volume')?'volume':'evolution'));
  const evo=(mode==='evolution'&&bilans.length)
    ?(function(){ try{ return corpsEvolutionVue(u,vue,o.evoPremier===true); }catch(e){ return null; } })():null;
  // ⚠ L'ONGLET FERME DIT S'IL Y A QUELQUE CHOSE A VOIR DE L'AUTRE COTE — ce
  //   que cette vue ne montre pas : la poitrine et le buste n'existent que de
  //   face, les fessiers que de dos. La pastille et son infobulle le disent.
  //
  //   ⚠ ELLE NE SORT QUE SUR L'ONGLET FERME, et elle n'est pas rouge : dans
  //     cette application le rouge appelle une decision, et ici il n'y a rien
  //     a decider, juste quelque chose a lire.
  const onglet=(k,lib)=>{
    const ferme=(vue!==k);
    let n=0;
    if(ferme&&bilans.length>=2){ try{ n=corpsEcartsDeVue(u,k); }catch(e){ n=0; } }
    const t=n?(n+' mensuration'+(n>1?'s ont':' a')+' bougé de ce côté'):'';
    return '<button type="button" class="cc-corps-o'+(ferme?'':' actif')
      +'" aria-pressed="'+(ferme?'false':'true')+'"'
      +(t?(' title="'+escapeHtml(t)+'" aria-label="'+escapeHtml(lib+' : '+t)+'"'):'')
      +' onclick="corpsVue(\''+k+'\')">'+escapeHtml(lib)
      +(n?'<span class="cc-corps-pa" aria-hidden="true"></span>':'')
      +'</button>';
  };
  // LE TITRE DIT L'ELEVE, par le numero de sa carte d'identite — rangArrivee,
  // la meme fonction : deux numeros pour le meme athlete sur la meme fiche
  // seraient deux reperes contradictoires. Sans rang connu, le titre se tait
  // sur le numero plutot que d'afficher « numéro 0 ».
  const rang=(function(){ try{ return rangArrivee(c); }catch(e){ return 0; } })();
  const titre=o.titre||('Évolution élève'+(rang?(' numéro '+rang):''));
  // LES DEUX BOUTONS DE LECTURE, avant ceux de la vue : ils decident de ce que
  // la couleur raconte, et la vue seulement de quel cote on regarde.
  // Ils ne sortent pas chez l'eleve (o.modes===false) : il n'a qu'une lecture.
  const bMode=(k,lib,t)=>{
    const on=(mode===k);
    return '<button type="button" class="cc-corps-o'+(on?' actif':'')
      +'" aria-pressed="'+(on?'true':'false')+'" title="'+escapeHtml(t)+'"'
      +' onclick="corpsMode(\''+k+'\')">'+escapeHtml(lib)+'</button>';
  };
  const tete='<div class="cc-corps-h">'
    +'<span class="cc-corps-t">'+escapeHtml(titre)+'</span>'
    +(o.modes===false?''
      :('<span class="cc-corps-vue cc-corps-lec" role="group" aria-label="Ce que dit la teinte">'
        +bMode('evolution','Évolution','Ce que ses tours ont fait depuis leur dernier relevé')
        +bMode('volume','Volume','Les séries que le programme donne à chaque muscle')+'</span>'))
    +(o._parties?''
      :('<span class="cc-corps-vue" role="group" aria-label="Vue du corps">'
        +onglet('face','Vue avant')+onglet('dos','Vue arrière')+'</span>'))
    +'</div>';
  // ⚠ LES ETIQUETTES SORTENT DES LE PREMIER BILAN depuis le 23/09/2026. Elles
  //   etaient conditionnees a deux bilans, parce qu'elles ne disaient que des
  //   ecarts ; elles disent maintenant TOUTES les mensurations mesurees, et un
  //   premier bilan en porte deja dix. Chacune annonce alors « 1 mesure » —
  //   ce qui est vrai, utile, et bien meilleur qu'un corps nu.
  const eti=bilans.length
    ?_htmlCorpsEtiquettes(u,genre,vue,o)
    :{etiquettes:'',traits:'',avecEcart:0,nEtiquettes:0};
  // LA TEINTE SORT DES LE PREMIER BILAN ; sans aucun bilan le cadre reste
  // eteint, comme ce matin.
  //
  // ⚠ ELLE DIT LE VOLUME TOTAL DU PROGRAMME (Kevin, 22/09/2026 : « selon le
  //   volume total de la prog, pas selon l'avancée de la semaine »). Le 1386
  //   la tirait des seances deja faites — pale le lundi, pleine le samedi ;
  //   le 1389, de la semaine EN COURS du bloc — elle changeait encore d'une
  //   semaine a l'autre, avec la progression et les decharges. Elle lit
  //   maintenant volumePrescritProgramme : toutes les semaines du programme,
  //   additionnees puis ramenees a la semaine. Elle ne bouge plus tant que le
  //   programme ne bouge pas.
  //
  // SANS PROGRAMME ACTIF, il n'y a pas de volume prevu a montrer : la teinte
  // retombe sur les series reellement faites (le calcul d'avant), et la
  // legende le dit.
  const prog=(bilans.length&&mode==='volume')?(function(){ try{ return volumePrescritProgramme(u); }catch(e){ return null; } })():null;
  const aProg=!!prog&&Object.keys(prog.muscles||{}).some(m=>(Number(prog.muscles[m])||0)>0);
  const sem=(bilans.length&&!aProg)?corpsSemaineVolume(u):null;
  let volSem={};
  if(aProg) volSem=prog.muscles;
  else if(sem){ try{ volSem=volumeSemaine(u,sem.cle)||{}; }catch(e){ volSem={}; } }
  const teintes=evo?evo.teintes:((aProg||!!sem)?corpsTeintes(u,vue,volSem):{});
  const teinte=evo?(Object.keys(teintes).length>0):(aProg||!!sem);
  const infos=evo?evo.infos:(teinte?corpsInfobulles(u,vue,volSem,aProg?prog:null):{});
  // LA SCENE PORTE LE RAPPORT DE LA TOILE, elargi de 100/CORPS_PART_CORPS : la
  // silhouette occupe cette part de sa largeur, et tout — traits, etiquettes —
  // se repere ensuite en centiemes de cette scene.
  // ⚠ LES TRAITS PASSENT PAR-DESSUS LA SILHOUETTE : dessines dessous, ils
  //   disparaitraient des qu'ils touchent le corps.
  const scene='<div class="cc-corps-scene"'+(bilans.length?'':' data-eteint=""')
    +' style="aspect-ratio:'+_arr1(pl.w*100/CORPS_PART_CORPS)+'/'+pl.h
    +';--et-l:'+_arr1(CORPS_ETIQ_LARG)+'%">'
    +_htmlCorpsPlanche(genre,vue,teintes,infos)
    +eti.traits
    +eti.etiquettes
    +'</div>';
  // AUCUN BILAN : la silhouette reste eteinte, et le cadre le DIT.
  if(!bilans.length)
    return '<div class="cc-corps">'+tete+scene
      +emptyState('calendar','<strong style="font-size:var(--fs-sm)">Pas encore de bilan</strong>'
        +'<br><span style="font-size:var(--fs-xs);display:inline-block;margin-top:6px">'
        +'La silhouette s’allumera dès qu’il aura envoyé son premier bilan.</span>','','',
        'padding:6px 0 0')
      +'</div>';
  // ⚠ LE PIED DE CADRE DIT LA RAISON, PAS L'ETAT. Trois silences possibles :
  //   un seul bilan ; des bilans sans deux releves d'une meme mensuration ; et
  //   des ecarts qui existent, mais de L'AUTRE cote — seulement les fessiers,
  //   et l'on regarde de face. Dire « aucun ecart » dans ce dernier cas serait
  //   faux.
  // ⚠ ET PAS DE TOLERANCE SANS MESURE : annoncer « ± 0,5 cm » au-dessus d'un
  //   cadre sans un seul ecart donnerait a croire qu'il y en a quelque part.
  let ailleurs=0;
  if(bilans.length>=2&&!eti.avecEcart){
    const ici=new Set((CORPS_MESURES[vue]||[]).map(m=>m.k));
    for(const m of (CORPS_MESURES[vue==='dos'?'face':'dos']||[])){
      if(ici.has(m.k)) continue;
      let x=null; try{ x=corpsEcart(u,m.k); }catch(e){ x=null; }
      if(x) ailleurs++;
    }
  }
  // LA PHRASE DE METHODE, celle que l'eleve ne voit plus : elle dit d'ou vient
  // le chiffre, ce qu'il ecarte, et ce qu'il arrondit. Le coach doit pouvoir la
  // citer devant un athlete qui conteste un ecart.
  const convention='<div class="cc-corps-n">Écart entre le premier et le '
    +'dernier bilan qui portent la mesure, reports exclus · ± '
    +String(SYN_BRUIT_MESURE).replace('.',',')+' cm de tolérance · un tour '
    +'mesuré une seule fois affiche 0 cm.</div>';
  const note=(bilans.length<2)
    ?'<div class="cc-corps-n">Un seul bilan : chaque tour porte sa mesure, et '
      +'les écarts apparaîtront au suivant.</div>'
    :(eti.avecEcart
      ?(o.convention===false?'':convention)
      :(ailleurs
        ?'<div class="cc-corps-n">Rien à lire de ce côté : les écarts relevés sont '
          +(vue==='dos'?'en vue avant':'en vue arrière')+'.</div>'
        :'<div class="cc-corps-n">Aucun écart à afficher : il faut deux relevés '
          +'d’une même mensuration pour en calculer un.</div>'));
  // ⚠ LA LEGENDE DIT CE QUE LA COULEUR DECRIT, ET CE QU'ELLE NE DECRIT PAS.
  //   Sans elle, un quadriceps orange vif a cote d'un « -1,5 cm » se lirait
  //   comme un jugement sur la cuisse. L'orange dit des SERIES — une charge de
  //   travail, pas un corps.
  // UNE REGLE GRADUEE, PAS DES PASTILLES : la teinte est continue, sa legende
  // aussi. Elle part de la rampe elle-meme, pas d'un dessin a cote qui finirait
  // par ne plus lui ressembler.
  // ⚠ LA SEMAINE EN COURS SE DIT « EN COURS ». Un mardi, elle ne porte qu'une
  //   ou deux seances : une silhouette pale n'y veut pas dire « il ne fait
  //   rien », et le coach doit pouvoir le lire.
  // ET LA CHARGE SE LIT SANS VOIR LA COULEUR : chaque muscle, ses series et sa
  // zone, pour un lecteur d'ecran — les memes phrases que sous le doigt.
  // LE PROGRAMME : combien de semaines il compte, et « décharges comprises »
  // quand il en a — elles tirent la moyenne vers le bas, et une silhouette un
  // peu plus pale pour cette raison-la doit pouvoir se lire. Sans bloc daté :
  // sa semaine type, le programme entier.
  const nd=aProg?(Number(prog.decharges)||0):0;
  const libSem=aProg
    ?(prog.source==='bloc'
      ?(prog.semaines+' semaine'+(prog.semaines>1?'s':'')
        +(nd?(', '+(nd>1?'décharges comprises':'décharge comprise')):'')+', ramené à la semaine')
      :'sa semaine type')
    :(sem?(_corpsLibSemaine(sem.cle)+(sem.decalage===0?' (en cours)':'')):'');
  const lus=Object.keys(infos).filter(m=>(Number(volSem[m])||0)>0)
    .sort((a,b)=>(Number(volSem[b])||0)-(Number(volSem[a])||0));
  // LA LEGENDE DE LA LECTURE ACTIVE, et elle seule : deux legendes de teinte
  // sous une silhouette qui n'en porte qu'une, ce sont deux conventions et un
  // coach qui lit la mauvaise.
  const legende=(evo&&teinte)?_htmlCorpsEvoLegende(vue,evo):(teinte
    // ⚠ DEUX-POINTS, PAS DE TIRET. Kevin, 23/09/2026 : « teinte, volume total
    //   du programme, deux points ... tu ne me mets pas de tiret, tu laisses
    //   deux points ». Le tiret cadratin se lisait comme une incise ; les
    //   deux-points annoncent la valeur qui suit, et c'est bien ce qu'elle est.
    ?'<div class="cc-corps-l">'
      +'<span class="cc-corps-lt">'+(aProg?'Teinte : volume total du programme : ':'Teinte : séries dures de la semaine du ')
      +escapeHtml(libSem)+(aProg?'':' · pas de programme actif')+'</span>'
      // LES QUATRE ZONES, pastille puis nom — la grammaire de la grille de
      // charge — ET CHACUNE S'OUVRE SUR SA DEFINITION (Kevin, 23/09/2026 :
      // « donne la possibilite de cliquer sur chacun et d'avoir une definition
      // sur ce que ca signifie »). Elles passent donc de <span> a <button> :
      // une legende cliquable qui reste un <span> n'est atteignable ni au
      // clavier ni au lecteur d'ecran. La definition vit dans RC_LEXIQUE, avec
      // les vingt autres — pas dans un panneau de plus qui divergerait.
      +Object.keys(GC_COULEURS).map(k=>'<button type="button" class="cc-corps-lp hit44"'
        +(GC_ZONE_LEX[k]?(' onclick="rcInfoOuvrir(\''+GC_ZONE_LEX[k]+'\')"'
          +' aria-label="'+escapeHtml('Que veut dire '+k+' ?')+'"'):' disabled')
        +'><i style="background:'+escapeHtml(GC_COULEURS[k])+'"></i>'
        +escapeHtml(k)+'</button>').join('')
      // Les points medians separent a l'oeil et ne s'entendent pas : a voix
      // haute, deux-points puis virgules, et un point-virgule entre muscles.
      +(lus.length?'<span class="cc-corps-lu">'+(aProg?'Séries programmées : ':'Séries de la semaine : ')
        +lus.map(m=>escapeHtml(String(infos[m]).replace(' · ',' : ').split(' · ').join(', ')))
          .join(' ; ')+'.</span>':'')
      +'</div>'
    :'');
  // L'EXPLICATION DE LA TEINTE, DANS UN PETIT CADRE (build 1398, Kevin :
  // « dans un petit rectangle »), SOUS LE GRAPHIQUE (1399 : « le cadre sous
  // le graphique »). Elle garde la classe cc-corps-lt : c'est toujours la
  // legende qui parle.
  const explication=(!teinte||o.explication===false)?'':('<div class="cc-corps-x"><p class="cc-corps-lt">'
    +(evo
      // ⚠ CE QUE LA COULEUR NE DIT PAS, AVANT CE QU'ELLE DIT. Un corps teinte
      //   en vert et rouge se lit comme une note si personne ne dit que non.
      ?'La couleur dit le sens de la mesure, jamais un jugement sur son corps : '
        +'vert, le tour a pris depuis son dernier relevé ; rouge, il a perdu ; '
        +'gris, il n’a pas bougé sur ses trois derniers relevés, à ± '
        +String(CORPS_BOUGE_MIN).replace('.',',')+' cm près. '
        +'Un muscle qu’aucun tour ne suit n’est pas teinté, et un tour mesuré une '
        +'seule fois non plus. Touchez un muscle pour ses chiffres et ses dates.'
    :(aProg
      // LE PREVU SE DIT PREVU, et son intensite aussi : sans consigne de
      // RIR, une serie programmee compte pleine — c'est un maximum, comme
      // le dit deja le panneau « Volume prescrit ».
      ?'Chaque muscle prend la couleur de sa zone pour le volume que le '
        +'programme lui donne par semaine : ni l’avancée de la semaine, ni le développement. '
        +(prog.avecConsigne?'Séries pondérées par l’intensité prescrite. ':'Sans intensité prescrite, c’est un maximum. ')
        +'Un muscle sans série programmée, ou sans repère de volume, n’est pas teinté. Touchez un muscle pour son chiffre.'
      :'Elle dit la zone du volume d’entraînement, jamais le '
        +'développement. Un muscle sans série, ou sans repère de volume, n’est pas teinté. Touchez un muscle pour son chiffre.'))
    +'</p></div>');
  // LES GRAPHIQUES NE SORTENT QUE S'ILS ONT DE QUOI TRACER. Chacun se tait
  // tout seul quand il lui manque un point ; les trois muets, la colonne
  // entiere disparait plutot que d'afficher un cadre a trois titres vides.
  const graphes=(o.graphes===false)?'':_htmlCorpsGraphes(u);
  // LE PETIT CADRE DE L'EXPLICATION VA SOUS LES GRAPHIQUES, dans la colonne
  // de droite ; sans graphique, il reste sous la legende.
  const avecG=(o.graphes!==false)&&!!graphes;
  if(o._parties) return {tete,scene,note,legende,explication,avecEcart:eti.avecEcart};
  return '<div class="cc-corps">'+tete
    +'<div class="cc-corps-grille">'
    +'<div class="cc-corps-col">'+scene+note+legende+(avecG?'':explication)+'</div>'
    +(avecG?('<div class="cc-corps-col">'+graphes+explication+'</div>'):'')
    +'</div></div>';
}
/**
 * LE SCHEMA CORPOREL SUR L'ECRAN DE L'ATHLETE, onglet Mensurations.
 *
 * Meme fonction de rendu que la fiche du coach — silhouette de son sexe,
 * etiquettes de toutes ses mensurations, ecart du premier au dernier bilan.
 * Ce qui change tient en cinq options, et TOUTES RETIRENT, aucune n'ajoute :
 * le titre (« Ton évolution » plutot qu'un numero de fiche), la colonne de
 * courbes (l'onglet trace deja les siennes dessous), les dates des etiquettes,
 * la phrase de methode et le petit cadre de la teinte. Kevin, 23/09/2026 :
 * « le client n'a pas besoin d'avoir acces a ce petit cadre-la, il a besoin
 * juste d'avoir sa photo ... de voir l'evolution au niveau des mesures ».
 *
 * ⚠ LES CALQUES DE ZONES SE PEIGNENT APRES L'INJECTION, ici comme chez le
 *   coach : ils lisent une image en niveaux de gris, ce qu'une chaine HTML ne
 *   sait pas faire. Sans cet appel, la silhouette sort grise.
 */
function renderCorpsAthlete(z){
  if(!z) return false;
  let h='';
  try{ h=_htmlCorpsCadre(currentUser,{titre:'Ton évolution',graphes:false,
    dates:false,convention:false,explication:false,mode:'volume',modes:false})||''; }
  catch(e){ h=''; }
  // LA DEMANDE DE SON COACH, AU-DESSUS DE SA SILHOUETTE. Aucune notification,
  // ici comme pour les videos : la demande attend a l'endroit ou la mesure se
  // lit, et elle s'eteint toute seule au bilan qui la porte.
  if(h){ try{ h=_htmlDemandeMesureAthlete(currentUser)+h; }catch(e){} }
  z.innerHTML=h;
  try{ _corpsPeindreCalques(z); }catch(e){}
  return !!h;
}
// ══ LE VERDICT : QUATRE CARTES, ET UNE SEULE LIGNE D'ALERTE ═══════════════
//
// Kevin, 23/09/2026. La question a laquelle cet etage repond, et la seule :
// « est-ce qu'il perd du gras ou du muscle ». Le poids seul ne la tranche
// jamais ; le pourcentage de masse grasse seul non plus.
//
// ⚠ LA LECTURE PORTE SUR L'ECART ENTRE DEUX BILANS, JAMAIS SUR LE CHIFFRE.
//   L'estimation de masse grasse vient de la formule de la marine americaine
//   (calcBF, deja dans l'app) : elle se trompe de plusieurs points sur un
//   individu, mais elle se trompe DANS LE MEME SENS d'un bilan a l'autre,
//   avec le meme ruban et la meme personne. C'est ce qui rend l'ECART lisible
//   quand le chiffre ne l'est pas. La carte le dit a l'ecran, et pas
//   seulement ici en commentaire.
//
// ⚠ LE SEUIL DE « PRESERVEE » EST MESURE, PAS CHOISI. Un ruban se trompe d'un
//   demi-centimetre (SYN_BRUIT_MESURE). Passe dans la formule, ce demi-
//   centimetre deplace la masse maigre estimee de 0,48 kg chez une femme de
//   62 kg, 0,63 kg chez un homme de 80 kg, 0,64 kg chez un homme de 100 kg —
//   mesure sur les trois cas, en faisant varier taille, cou et hanches de
//   ±0,5 cm. La balance, elle, ajoute son propre bruit : 0,3 kg (SYN_BRUIT_
//   POIDS) fois la part maigre, soit environ 0,25 kg. Au pire, 0,9 kg. En
//   dessous, on ne sait pas distinguer une perte de muscle d'une erreur de
//   ruban : on ecrit « preservee », et c'est la verite.
const CCD_MAIGRE_BRUIT=0.9;
// La marge de l'estimation, en points de pourcentage. La formule de la marine
// annonce une erreur type de 3 a 4 points sur un individu.
const CCD_BF_MARGE=4;
// Trois bilans sans bouger, c'est une mesure qui dort. Deux ne suffisent pas :
// un tour peut ne pas bouger d'un bilan au suivant sans que ce soit un oubli.
const CCD_DORT_BILANS=3;
/**
 * PURE. Les trois chiffres du verdict et ce qui dort, ou null quand le
 * dossier ne porte pas de quoi les etablir.
 *
 * @param {any} u le dossier de l'athlete
 * @returns {{poids:any, gras:any, maigre:any, dort:any}}
 */
function ccdVerdict(u,depuisLePremier){
  // ⚠ `depuisLePremier` EST POSE PAR LA PAIRE DE BILANS (lot 5), jamais par
  //   defaut. Sans paire, l'ecart des cartes est celui du bilan d'avant ; avec
  //   une paire, le dossier est deja borne aux deux dates choisies, et l'ecart
  //   doit alors courir d'un bout a l'autre de cette fenetre — sans quoi deux
  //   bilans compares a six mois d'intervalle afficheraient l'ecart des deux
  //   derniers de la periode, ce que personne n'a demande.
  const _dp=(depuisLePremier===true);
  const out={poids:null,gras:null,maigre:null,dort:null};
  let bl=[];
  try{ bl=bilansOrdonnes(u)||[]; }catch(e){ bl=[]; }
  // LE POIDS : les deux derniers bilans qui en portent un.
  const pesees=bl.filter(b=>getBW(b)>0);
  if(pesees.length){
    const fin=pesees[pesees.length-1];
    const deb=(pesees.length>1)?pesees[_dp?0:(pesees.length-2)]:null;
    const vFin=getBW(fin), vDeb=deb?getBW(deb):null;
    const jours=deb?Math.max(1,Math.round((Number(fin.date)-Number(deb.date))/86400000)):0;
    let kgSem=null;
    // LA VITESSE VIENT DES PESEES QUOTIDIENNES QUAND IL Y EN A — c'est le
    // meme calcul que la courbe de pesee, pas un second. Sans elles, l'ecart
    // entre les deux bilans, ramene a la semaine.
    try{ const v=vitesseHebdo(serieVitesse(u)); if(v&&isFinite(v.kgSem)) kgSem=v.kgSem; }catch(e){}
    if(kgSem==null&&deb&&jours>=7) kgSem=(vFin-vDeb)/(jours/7);
    out.poids={valeur:vFin,date:Number(fin.date)||0,
      delta:(vDeb!=null)?Math.round((vFin-vDeb)*10)/10:null,
      depuis:deb?(Number(deb.date)||0):0,kgSem:kgSem,
      // LA VALEUR DE DEPART, pour la lecture en pourcentage : « depuis 66 kg ».
      premier:getBW(pesees[0])};
  }
  // LA MASSE GRASSE : les deux derniers bilans ou la formule a ses mesures.
  const taille=parseFloat((u&&(u._evol_height||u['init-height']||u.height))||0)||null;
  const genre=(u&&(u._evol_gender||u.gender))||'';
  const femme=(function(){ try{ return isFemale(genre); }catch(e){ return false; } })();
  // ⚠ UNE SEULE LISTE DE COMPOSITION POUR TOUT L'ONGLET (lot 4) : les cartes
  //   d'ici et la courbe de l'etage 3 lisent ccdCompositionSerie. Deux calculs
  //   de masse maigre dans le meme ecran finiraient par donner deux chiffres.
  const calc=ccdCompositionSerie(u);
  if(calc.length){
    const f=calc[calc.length-1];
    const d=(calc.length>1)?calc[_dp?0:(calc.length-2)]:null;
    out.gras={kg:f.gras,pct:f.pct,date:f.date,marge:CCD_BF_MARGE,
      delta:d?Math.round((f.gras-d.gras)*10)/10:null,depuis:d?d.date:0,
      premier:calc[0].gras};
    const dm=d?Math.round((f.maigre-d.maigre)*10)/10:null;
    out.maigre={kg:f.maigre,date:f.date,delta:dm,depuis:d?d.date:0,
      premier:calc[0].maigre,
      sens:(dm==null)?null:(Math.abs(dm)<CCD_MAIGRE_BRUIT?'preservee':(dm>0?'hausse':'baisse'))};
  } else {
    // RIEN A CALCULER : on dit CE QUI MANQUE, et rien d'autre. Une carte qui
    // affiche un tiret laisse croire a une panne.
    const dernier=bl.length?bl[bl.length-1]:null;
    const manque=[];
    if(!taille) manque.push('sa taille debout');
    if(dernier){
      if(!(getBM(dernier,'waist')>0)) manque.push('son tour de taille');
      if(!(getBM(dernier,'neck')>0)) manque.push('son tour de cou');
      if(femme&&!(getBM(dernier,'hips')>0)) manque.push('son tour de hanches');
    }
    if(!dernier) manque.push('un premier bilan');
    out.gras={manque:manque};
  }
  // CE QUI DORT : les tours identiques, au ruban pres, sur les trois derniers
  // bilans qui les portent. C'est ce qu'un coach rate en lisant une liste.
  const dort=[];
  for(const cle in CORPS_NOMS){
    let s=[];
    try{ s=corpsRelevesReels(u,cle)||[]; }catch(e){ s=[]; }
    if(s.length<CCD_DORT_BILANS) continue;
    const trois=s.slice(-CCD_DORT_BILANS).map(x=>x.valeur);
    const ecart=Math.max.apply(null,trois)-Math.min.apply(null,trois);
    if(ecart<SYN_BRUIT_MESURE) dort.push({cle,nom:_libMesure(CORPS_NOMS[cle]),depuis:s[s.length-CCD_DORT_BILANS].date});
  }
  out.dort={n:dort.length,noms:dort.map(x=>x.nom),bilans:CCD_DORT_BILANS};
  return out;
}
// « 20 sept. » — la date d'un relevé, courte.
function _ccdJour(ts){
  const t=Number(ts)||0;
  if(!t) return '';
  try{ return new Date(t).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}); }
  catch(e){ return ''; }
}
// « −1,4 kg », « +0,3 kg », ou '' — le signe se lit, le zero ne s'ecrit pas.
function _ccdDelta(v,unite){
  if(v==null||!isFinite(v)) return '';
  const a=Math.abs(v);
  if(a<0.05) return '0 '+unite;
  return (v>0?'+':'−')+_synNombre(v)+' '+unite;
}
/**
 * Une carte du verdict. `source` porte la date et la marge : aucune valeur
 * affichee dans cette application ne sort sans elles.
 */
function _ccdCarte(libelle,valeur,delta,phrase,source,o){
  o=o||{};
  // LE SENS DE L'ECART : une fleche, et une couleur quand elle veut dire
  // quelque chose (la masse maigre qui baisse, la masse grasse qui monte).
  const fl=(o.d!=null&&isFinite(o.d)&&Math.abs(o.d)>=0.05)?(o.d>0?CCD_ICO.haut:CCD_ICO.bas):'';
  return '<article class="ccd-v"'+(o.k?' data-k="'+o.k+'"':'')+'>'
    +(o.ico?'<span class="ccdx-ico">'+o.ico+'</span>':'')
    +'<div class="ccdx-c">'
    +'<span class="ccd-v-l">'+escapeHtml(libelle)+'</span>'
    +'<span class="ccd-v-n">'+escapeHtml(valeur)+'</span>'
    +(delta?'<span class="ccd-v-d"'+(o.ton?' data-ton="'+o.ton+'"':'')+'>'+escapeHtml(delta)+fl+'</span>':'')
    +(o.dep?'<span class="ccdx-dep">'+escapeHtml(o.dep)+'</span>':'')
    +(phrase?'<span class="ccd-v-p">'+escapeHtml(phrase)+'</span>':'')
    +(source?'<span class="ccd-v-s">'+escapeHtml(source)+'</span>':'')
    +'</div>'
    +(o.spark||'')
    +(o.clic?'<button type="button" class="ccdx-chev" onclick="'+o.clic+'" aria-label="'+escapeHtml(o.clicLib||'Voir')+'">'+CCD_ICO.droite+'</button>':'')
    +'</article>';
}
/**
 * Les quatre cartes, plus la ligne d'alerte. Rend '' quand il n'y a pas un
 * seul bilan : l'etage disparait alors avec son bouton (_ccdMajEtages).
 */
function _htmlCcdVerdict(u,depuisLePremier){
  const v=ccdVerdict(u,depuisLePremier);
  if(!v.poids&&(!v.gras||v.gras.manque)&&!v.dort.n) return '';
  const sr=_ccdSeries(u);
  const dep=t=>t?('par rapport au bilan du '+_ccdJour(t)):'';
  const cartes=[];
  // 1. LE POIDS.
  if(v.poids){
    const p=v.poids;
    const lu=_ccdLu(p.valeur,'kg',p.delta,p.premier);
    cartes.push(_ccdCarte('Poids',lu.grand,lu.petit,
      (p.kgSem!=null&&isFinite(p.kgSem))?(_ccdDelta(p.kgSem,'kg')+' par semaine'):'',
      'pesé au bilan du '+_ccdJour(p.date)+' · à 0,3 kg près',
      {k:'poids',ico:CCD_ICO.poids,spark:_ccdSpark(sr.poids),d:_ccdLecture==='absolu'?p.delta:null,dep:_ccdLecture==='absolu'?dep(p.depuis):''}));
  }
  // 2 et 3. LA MASSE MAIGRE ET LA MASSE GRASSE, ou ce qui manque pour elles.
  // ⚠ ORDRE DE LA MAQUETTE (24/09/2026) : la maigre avant la grasse.
  if(v.gras&&v.gras.manque){
    const m=v.gras.manque;
    cartes.push('<article class="ccd-v ccd-v-manque" data-k="gras"><span class="ccdx-ico">'+CCD_ICO.gras+'</span><div class="ccdx-c">'
      +'<span class="ccd-v-l">Masse grasse</span>'
      +'<span class="ccd-v-p">Pas encore calculable : il manque '+escapeHtml(m[0]||'une mesure')+'.</span>'
      +'<span class="ccd-v-s">avec elle, tu sauras s\'il perd du gras ou du muscle</span></div></article>');
  } else if(v.gras){
    const m=v.maigre;
    const dit={preservee:'préservée',baisse:'en baisse',hausse:'en hausse'}[m&&m.sens]||'';
    const lm=_ccdLu(m.kg,'kg',m.delta,m.premier);
    cartes.push(_ccdCarte('Masse maigre',lm.grand,lm.petit,dit,
      'le poids moins la masse grasse, au bilan du '+_ccdJour(m.date)+' · à '+_synNombre(CCD_MAIGRE_BRUIT)+' kg près',
      {k:'maigre',ico:CCD_ICO.maigre,spark:_ccdSpark(sr.maigre),d:_ccdLecture==='absolu'?m.delta:null,
       ton:m.sens==='baisse'?'mal':'bien',dep:_ccdLecture==='absolu'?dep(m.depuis):''}));
    const lg=_ccdLu(v.gras.kg,'kg',v.gras.delta,v.gras.premier);
    cartes.push(_ccdCarte('Masse grasse',lg.grand,lg.petit,
      _synNombre(v.gras.pct)+' % de son poids',
      'estimée au ruban le '+_ccdJour(v.gras.date)+' · à '+v.gras.marge+' points près',
      {k:'gras',ico:CCD_ICO.gras,spark:_ccdSpark(sr.gras),d:_ccdLecture==='absolu'?v.gras.delta:null,
       ton:(v.gras.delta!=null&&v.gras.delta>0)?'attention':'bien',dep:_ccdLecture==='absolu'?dep(v.gras.depuis):''}));
  }
  // 4. CE QUI DORT.
  const d=v.dort;
  cartes.push(_ccdCarte('Ce qui dort',
    d.n?(d.n+' mesure'+(d.n>1?'s':'')):'Rien',
    d.n?(d.noms.slice(0,2).join(', ')+(d.n>2?(' et '+(d.n-2)+' autre'+(d.n>3?'s':'')):'')):'',
    d.n?('pareilles depuis '+d.bilans+' bilans'):'tout a bougé depuis '+d.bilans+' bilans',
    'au ruban, à 0,5 cm près',
    {k:'dort',ico:CCD_ICO.dort,clic:'ccdVoirDetail(\'ccd-mens\')',clicLib:'Voir les douze tours'}));
  return '<div class="ccd-v4">'+cartes.join('')+'</div>'
    // LA PHRASE QUI BORNE LES DEUX ESTIMATIONS. Elle est SOUS les cartes, pas
    // dans une infobulle : ce qu'elle dit change la façon de lire les deux
    // chiffres du milieu, et personne n'ouvre une infobulle avant de lire.
    +((v.gras&&!v.gras.manque)
      ?'<p class="ccd-v-note">Masse grasse estimée au ruban : c\'est son écart d\'un '
        +'bilan à l\'autre qui se lit, pas le chiffre du jour.</p>':'');
}
/**
 * UNE SEULE LIGNE D'ALERTE, LA PLUS SAILLANTE, ou rien. expliquerUrgence rend
 * deja les motifs tries par gravite pour la liste « Pourquoi cet athlete est
 * ici » : on en prend le premier plutot que d'inventer un second classement,
 * qui finirait par le contredire.
 */
function _htmlCcdAlerte(c){
  let l=[];
  try{ l=expliquerUrgence(c)||[]; }catch(e){ return ''; }
  if(!l.length) return '';
  const x=l[0];
  const quand=x.date?(' · '+_ccdJour(x.date)):'';
  return '<p class="ccd-v-al"><span class="ccd-v-al-p"></span>'
    +escapeHtml(String(x.motif||''))+escapeHtml(quand)+'</p>';
}
// ══ LOT 5 : LES OUTILS DE LECTURE ══════════════════════════════════════════
//
// Kevin, 23/09/2026 : « C'est ce qui separe un ecran joli d'un ecran qu'on
// utilise dix fois par jour. »
//
// TROIS OUTILS, ET ILS NE VIVENT QUE DANS LA TETE DE L'ECRAN :
//   • la LECTURE (valeur du jour, ecart, pourcentage) ;
//   • la PAIRE de bilans compares, qui recalcule les etages 1 et 2 ;
//   • les TROIS MESURES EPINGLEES, qui remontent en grand sous les cartes.
//
// ⚠ AUCUN DES TROIS N'EST UNE DONNEE DE L'ATHLETE. La lecture et la paire sont
//   des lentilles : elles vivent le temps d'une consultation, comme la vue
//   avant/arriere. Les epingles, elles, sont une preference DU COACH sur un
//   athlete : elles se rangent dans le dossier du coach, jamais dans celui de
//   l'athlete, qui decrit quelqu'un d'autre.
const CCD_LECTURES=Object.freeze([
  {cle:'absolu',lib:'Valeur',aide:'La valeur du dernier bilan'},
  {cle:'ecart',lib:'Écart',aide:'L’écart depuis le bilan d’avant'},
  {cle:'pourcent',lib:'%',aide:'Le pourcentage depuis le premier bilan'}
]);
let _ccdLecture='absolu';
function ccdLecture(m){
  _ccdLecture=CCD_LECTURES.some(x=>x.cle===m)?m:'absolu';
  _ccdRefaireEtages();
  // « Un seul jeu de boutons, il s'applique aux cartes ET aux tableaux »
  // (lot 5) : le tableau des douze tours est arrive au lot 10, il suit.
  try{ renderMensCoach(getOwnedClient(currentClientId)); }catch(e){}
  try{
    const b=document.querySelector('#ccd-outils .ccd-lec .cc-corps-o.actif');
    if(b) b.focus();
  }catch(e){}
  return _ccdLecture;
}
// LES DEUX BILANS COMPARES, en millisecondes, ou 0 pour « les deux derniers ».
let _ccdPaireA=0, _ccdPaireB=0;
function ccdPaire(a,b){
  const x=Number(a)||0, y=Number(b)||0;
  // Deux bornes ou aucune, et dans l'ordre : une paire a moitie posee
  // afficherait une periode que personne n'a choisie.
  if(!x||!y||x===y){ _ccdPaireA=0; _ccdPaireB=0; }
  else { _ccdPaireA=Math.min(x,y); _ccdPaireB=Math.max(x,y); }
  _ccdRefaireEtages();
  return {a:_ccdPaireA,b:_ccdPaireB};
}
function ccdPaireActive(){ return !!(_ccdPaireA&&_ccdPaireB); }
/**
 * PURE. Le dossier RAMENE A LA PAIRE CHOISIE, ou le dossier tel quel.
 *
 * ⚠ ON BORNE LA SOURCE, ON NE PARAMETRE PAS LES CALCULS. Toutes les lectures
 *   de cet onglet partent de bilansOrdonnes et de serieWeight : leur donner un
 *   dossier dont les bilans s'arretent aux deux dates choisies recalcule TOUT
 *   l'etage 1 et l'etage 2 d'un coup, sans ajouter un parametre a douze
 *   fonctions qui finiraient par ne plus le passer au bon endroit.
 *
 * ⚠ LES PESEES QUOTIDIENNES SONT BORNEES AUSSI. Sans cela, la vitesse affichee
 *   sur la carte du poids serait celle d'aujourd'hui sous deux bilans
 *   d'octobre : un chiffre juste, au mauvais endroit.
 */
function ccdBorner(u){
  if(!u||!ccdPaireActive()) return u;
  const a=_ccdPaireA, b=_ccdPaireB;
  const iA=_jourISO(a), iB=_jourISO(b);
  return Object.assign({},u,{
    bilans:((u.bilans)||[]).filter(x=>x&&Number(x.date)>=a&&Number(x.date)<=b),
    weightLog:((u.weightLog)||[]).filter(e=>e&&e.date>=iA&&e.date<=iB)
  });
}
// Les etages 1 et 2 se refont ensemble : ce sont eux que les outils commandent.
function _ccdRefaireEtages(){
  try{
    const c=getOwnedClient(currentClientId);
    if(!c) return false;
    try{ renderVerdictCoach(c); }catch(e){}
    try{ renderCorpsCoach(c); }catch(e){}
    try{ renderAnatCoach(c); }catch(e){}
    return true;
  }catch(e){ return false; }
}
// ── LA LECTURE APPLIQUEE A UN CHIFFRE ──────────────────────────────────────
// « 61,4 kg », « −1,4 kg », « −7 % ». Rend aussi la ligne qui accompagne, pour
// qu'aucune des trois lectures ne cache ce que les deux autres montrent.
function _ccdPourcent(valeur,premier){
  if(premier==null||!isFinite(premier)||!premier) return null;
  return Math.round((valeur-premier)/premier*1000)/10;
}
function _ccdLu(valeur,unite,delta,premier){
  const abs=_synNombre(valeur)+' '+unite;
  if(_ccdLecture==='ecart'){
    if(delta==null||!isFinite(delta)) return {grand:abs,petit:'premier bilan, pas encore d’écart'};
    return {grand:_ccdDelta(delta,unite),petit:abs+' aujourd’hui'};
  }
  if(_ccdLecture==='pourcent'){
    const p=_ccdPourcent(valeur,premier);
    if(p==null) return {grand:abs,petit:'premier bilan, pas encore de pourcentage'};
    return {grand:(p>0?'+':(p<0?'−':''))+_synNombre(p)+' %',
      petit:'depuis '+_synNombre(premier)+' '+unite};
  }
  return {grand:abs,petit:_ccdDelta(delta,unite)};
}
// ── LES TROIS MESURES EPINGLEES ────────────────────────────────────────────
//
// ⚠ TROIS, ET LE QUATRIEME POUSSE LE PLUS ANCIEN. Refuser le quatrieme clic en
//   silence se lit comme un bouton casse ; ouvrir une alerte pour dire non est
//   pire. La ligne d'aide dit la regle avant qu'on la rencontre.
const CCD_EPINGLE_MAX=3;
// Ce qu'on peut epingler : les trois chiffres du verdict, et chaque tour.
function ccdEpinglables(){
  const l=[{cle:'poids',lib:'Poids'},{cle:'gras',lib:'Masse grasse'},
    {cle:'maigre',lib:'Masse maigre'}];
  for(const k in CORPS_NOMS) l.push({cle:k,lib:CORPS_NOMS[k]});
  return l;
}
function ccdEpingles(id){
  const t=(currentUser&&currentUser.ccdEpingles)||{};
  const l=t[String(id||currentClientId||'')];
  return Array.isArray(l)?l.slice(0,CCD_EPINGLE_MAX):[];
}
function ccdEpingler(cle){
  const id=String(currentClientId||'');
  if(!id||!currentUser) return [];
  const t=Object.assign({},currentUser.ccdEpingles||{});
  let l=(Array.isArray(t[id])?t[id]:[]).slice();
  const i=l.indexOf(cle);
  if(i>=0) l.splice(i,1);
  else { l.push(cle); if(l.length>CCD_EPINGLE_MAX) l.shift(); }
  t[id]=l;
  currentUser.ccdEpingles=t;
  // ⚠ LE DOSSIER DU COACH, ET C'EST TOUT. saveUser n'enregistre que
  //   currentUser : l'athlete ne porte rien de ce choix, qui n'est pas le sien.
  try{ saveUser(); }catch(e){}
  _ccdRefaireEtages();
  return l;
}
/**
 * PURE. Ce que dit une mesure epinglee : sa valeur du jour, son ecart, sa
 * valeur au premier bilan, sa source et sa marge.
 * @returns {{lib:string,valeur:number,unite:string,delta:number|null,
 *            premier:number|null,date:number,source:string}|null}
 */
function ccdEpingleValeur(u,cle){
  if(cle==='poids'||cle==='gras'||cle==='maigre'){
    let v=null; try{ v=ccdVerdict(u); }catch(e){ return null; }
    if(cle==='poids'){
      if(!v.poids) return null;
      return {lib:'Poids',valeur:v.poids.valeur,unite:'kg',delta:v.poids.delta,
        premier:v.poids.premier!=null?v.poids.premier:null,date:v.poids.date,
        source:'pesé au bilan · à '+_synNombre(SYN_BRUIT_POIDS)+' kg près'};
    }
    if(!v.gras||v.gras.manque) return null;
    if(cle==='gras') return {lib:'Masse grasse',valeur:v.gras.kg,unite:'kg',
      delta:v.gras.delta,premier:v.gras.premier!=null?v.gras.premier:null,date:v.gras.date,
      source:'estimée au ruban · à '+v.gras.marge+' points près'};
    return {lib:'Masse maigre',valeur:v.maigre.kg,unite:'kg',delta:v.maigre.delta,
      premier:v.maigre.premier!=null?v.maigre.premier:null,date:v.maigre.date,
      source:'le poids moins la masse grasse · à '+_synNombre(CCD_MAIGRE_BRUIT)+' kg près'};
  }
  let rel=[]; try{ rel=corpsRelevesReels(u,cle)||[]; }catch(e){ rel=[]; }
  if(!rel.length) return null;
  const fin=rel[rel.length-1];
  return {lib:CORPS_NOMS[cle]||cle,valeur:fin.valeur,unite:'cm',
    delta:(rel.length>1)?Math.round((fin.valeur-rel[rel.length-2].valeur)*10)/10:null,
    premier:rel[0].valeur,date:fin.date,
    source:'au ruban · à '+_synNombre(SYN_BRUIT_MESURE)+' cm près'};
}
function _htmlCcdEpingles(u){
  const l=ccdEpingles();
  if(!l.length) return '';
  const cartes=[];
  for(const cle of l){
    let e=null; try{ e=ccdEpingleValeur(u,cle); }catch(err){ e=null; }
    const lib=e?e.lib:((ccdEpinglables().find(x=>x.cle===cle)||{}).lib||cle);
    if(!e){
      cartes.push('<article class="ccd-v ccd-v-manque"><span class="ccd-v-l">'+escapeHtml(lib)+'</span>'
        +'<span class="ccd-v-p">Pas encore de relevé sur la période lue.</span></article>');
      continue;
    }
    const lu=_ccdLu(e.valeur,e.unite,e.delta,e.premier);
    cartes.push(_ccdCarte(lib,lu.grand,lu.petit,'',
      e.source+(e.date?(' · '+_ccdJour(e.date)):'')));
  }
  return '<div class="ccd-v4 ccd-epi">'+cartes.join('')+'</div>';
}
// ── LA BARRE D'OUTILS, EN TETE DE L'ETAGE 1 ────────────────────────────────
//
// ⚠ UNE SEULE LIGNE VISIBLE. Mesure a 375 px : les quatre cartes tombent a
//   445 px du haut et le corps commence a 802 px, pour 812 px d'ecran. Deux
//   lignes d'outils poussaient la silhouette hors de vue des l'ouverture.
//   Les boutons de lecture restent donc dehors, et le reste s'ouvre d'un
//   geste, replie par defaut.
// LA BARRE VA DANS LA LIGNE DE TITRE DE L'ETAGE (#ccd-outils), LE PANNEAU
// RESTE DANS L'ETAGE : deplie, il a besoin de toute la largeur, et la ligne de
// titre n'en a plus qu'un tiers une fois le titre pose.
function _htmlCcdBarre(){
  return '<div class="ccd-outils"><div class="ccd-out-h">'
    +'<span class="cc-corps-vue ccd-lec" role="group" aria-label="Ce que les cartes affichent">'
    +CCD_LECTURES.map(x=>'<button type="button" class="cc-corps-o'
      +((x.cle===_ccdLecture)?' actif':'')+'" aria-pressed="'+((x.cle===_ccdLecture)?'true':'false')
      +'" title="'+escapeHtml(x.aide)+'" onclick="ccdLecture(\''+x.cle+'\')">'
      +escapeHtml(x.lib)+'</button>').join('')+'</span>'
    +'<button type="button" class="ccd-out-b" aria-expanded="false"'
    +' aria-controls="ccd-out-c" onclick="ccdOutils(this)">Outils</button>'
    +'</div></div>';
}
function _htmlCcdOutils(u){
  let bl=[]; try{ bl=bilansOrdonnes(u)||[]; }catch(e){ bl=[]; }
  const opts=(sel)=>bl.map(b=>'<option value="'+Number(b.date)+'"'
    +((Number(b.date)===sel)?' selected':'')+'>'
    +escapeHtml(_ccdJour(b.date))+'</option>').join('');
  const a=ccdPaireActive()?_ccdPaireA:(bl.length>1?Number(bl[bl.length-2].date):0);
  const b=ccdPaireActive()?_ccdPaireB:(bl.length?Number(bl[bl.length-1].date):0);
  const epi=ccdEpingles();
  return '<div class="ccd-out-c" id="ccd-out-c" hidden>'
    +(bl.length>1
      ?('<div class="ccd-out-l"><label>Comparer<select onchange="ccdPaireDepuisEcran()" id="ccd-pa">'
        +opts(a)+'</select></label><label>à<select onchange="ccdPaireDepuisEcran()" id="ccd-pb">'
        +opts(b)+'</select></label>'
        +(ccdPaireActive()?'<button type="button" class="ccd-out-r" onclick="_ccdFenetre=null;ccdPaire(0,0)">Revenir aux deux derniers</button>':'')
        +'</div><p class="ccd-out-p">Les cartes et la silhouette se recalculent entre ces deux bilans. '
        +'Les courbes, elles, suivent la période choisie dans « Ses courbes ».</p>')
      :'<p class="ccd-out-p">Il faut deux bilans pour en comparer deux.</p>')
    +'<div class="ccd-out-l ccd-out-e">'
    +ccdEpinglables().map(x=>'<button type="button" class="ccd-epi-b'
      +((epi.indexOf(x.cle)>=0)?' actif':'')+'" aria-pressed="'+((epi.indexOf(x.cle)>=0)?'true':'false')
      +'" onclick="ccdEpingler(\''+x.cle+'\')">'+escapeHtml(x.lib)+'</button>').join('')
    +'</div><p class="ccd-out-p">Trois mesures épinglées au plus : la quatrième '
    +'remplace la plus ancienne. Le choix se garde pour cet athlète.</p>'
    +'</div>';
}
function ccdOutils(b){
  const c=document.getElementById('ccd-out-c');
  if(!c) return false;
  const ouvert=!c.hidden;
  c.hidden=ouvert;
  b.setAttribute('aria-expanded',ouvert?'false':'true');
  return !ouvert;
}
function ccdPaireDepuisEcran(){
  _ccdFenetre=null;
  const a=document.getElementById('ccd-pa'), b=document.getElementById('ccd-pb');
  if(!a||!b) return null;
  const r=ccdPaire(Number(a.value)||0,Number(b.value)||0);
  // LE PANNEAU RESTE OUVERT : le rendu l'a referme, et le coach qui compare
  // deux bilans en compare souvent trois.
  try{
    const z=document.getElementById('ccd-out-c');
    const t=document.querySelector('#ccd-outils .ccd-out-b');
    if(z){ z.hidden=false; if(t) t.setAttribute('aria-expanded','true'); }
  }catch(e){}
  return r;
}
// ══ LOT 6 : UNE SEULE MESURE RECLAMEE A LA FOIS ════════════════════════════
//
// Kevin, 23/09/2026 : « Aujourd'hui l'ecran affiche une liste de huit mesures
// manquantes sous "il manque, pour aller plus loin". C'est decourageant, et
// c'est faux : il en manque rarement huit. »
//
// UNE LIGNE, UNE MESURE, ET CE QU'ELLE DEBLOQUE. Quand elle est saisie, la
// suivante apparait — si elle sert a quelque chose, pas avant.
//
// ⚠ L'ORDRE N'EST PAS UN GOUT : il va de ce qui debloque le plus a ce qui
//   debloque le moins. La taille debout ouvre A LA FOIS la masse grasse et
//   l'echelle des longueurs ; le tour de cou et le tour de taille ouvrent la
//   masse grasse, donc la lecture « gras ou muscle » qui est la question de
//   tout cet onglet ; les tours du corps n'ouvrent qu'eux-memes, un muscle a
//   la fois sur la silhouette.
const CCD_MANQUES=Object.freeze([
  {cle:'taille',lib:'sa taille debout',champ:'height',
   debloque:'calculer sa masse grasse et mettre ses longueurs à l’échelle',
   effort:'Une fois, et c’est valable pour toujours.'},
  {cle:'neck',lib:'son tour de cou',champ:'neck',
   debloque:'calculer sa masse grasse et suivre gras contre muscle',
   effort:'Trente secondes, une fois.'},
  {cle:'waist',lib:'son tour de taille',champ:'waist',
   debloque:'calculer sa masse grasse et suivre gras contre muscle',
   effort:'Trente secondes, à chaque bilan.'},
  {cle:'hips',lib:'son tour de hanches',champ:'hips',femme:true,
   debloque:'calculer sa masse grasse et suivre gras contre muscle',
   effort:'Trente secondes, à chaque bilan.'},
  {cle:'deb-rotule',lib:'la hauteur de son genou',champ:'rotule',
   debloque:'mettre ses longueurs à l’échelle sur sa photo',
   effort:'Une fois, au mur, et c’est valable pour toujours.'},
  {cle:'chest',lib:'son tour de poitrine',champ:'chest',
   debloque:'suivre ses pectoraux sur la silhouette',
   effort:'Trente secondes, à chaque bilan.'},
  {cle:'bicep-r',lib:'son tour de bras droit',champ:'bicep-r',
   debloque:'suivre ses bras sur la silhouette',
   effort:'Trente secondes, à chaque bilan.'},
  {cle:'thigh-r',lib:'son tour de cuisse droite',champ:'thigh-r',
   debloque:'suivre ses cuisses sur la silhouette',
   effort:'Trente secondes, à chaque bilan.'},
  {cle:'calf-r',lib:'son tour de mollet droit',champ:'calf-r',
   debloque:'suivre ses mollets sur la silhouette',
   effort:'Trente secondes, à chaque bilan.'}
]);
// PURE. Vrai quand la mesure n'est nulle part au dossier.
function _ccdManqueCette(u,m){
  if(m.cle==='taille')
    return !(parseFloat((u&&(u._evol_height||u['init-height']||u.height))||0)>0);
  // La hauteur de genou n'est pas un tour : elle vit dans les longueurs du
  // premier bilan, pas dans les mensurations, et se lit par mesureMorpho.
  if(m.cle===MORPHO_ROTULE) return mesureMorpho(u,MORPHO_ROTULE).cm==null;
  let rel=[]; try{ rel=corpsRelevesReels(u,m.cle)||[]; }catch(e){ rel=[]; }
  return !rel.length;
}
/**
 * PURE. LA mesure a reclamer, ou null quand il n'en manque aucune qui serve.
 *
 * ⚠ LE TOUR DE HANCHES N'EST RECLAME QU'AUX FEMMES : la formule de la marine
 *   ne le demande pas aux hommes, et le reclamer serait reclamer pour rien.
 * @returns {{cle,lib,debloque,effort,seule:boolean,reste:number}|null}
 */
function ccdMesureManquante(u){
  if(!u) return null;
  let femme=false;
  try{ femme=isFemale((u._evol_gender||u.gender)||''); }catch(e){ femme=false; }
  const manquantes=CCD_MANQUES.filter(m=>(!m.femme||femme)&&_ccdManqueCette(u,m));
  if(!manquantes.length) return null;
  const m=manquantes[0];
  // COMBIEN IL EN RESTE POUR LA MEME CHOSE : « la seule qui manque » ne
  // s'ecrit que quand c'est vrai.
  const memeBut=manquantes.filter(x=>x.debloque===m.debloque);
  // ⚠ `reste` COMPTE CELLES QUI MANQUENT POUR LA MEME CHOSE, pas toutes :
  //   « la premiere des 6 qui manquent pour calculer sa masse grasse » etait
  //   faux, il n'en manquait que deux pour elle.
  return {cle:m.cle,lib:m.lib,champ:m.champ,debloque:m.debloque,effort:m.effort,
    seule:memeBut.length===1,reste:memeBut.length,total:manquantes.length};
}
// La phrase du coach, en une ligne.
function ccdPhraseManque(m){
  if(!m) return '';
  const tete=m.lib.charAt(0).toUpperCase()+m.lib.slice(1);
  return tete+'. '+(m.seule
    ?('C’est la seule mesure qui manque pour '+m.debloque+'.')
    :('C’est la première des '+m.reste+' qui manquent pour '+m.debloque+'.'))
    +' '+m.effort;
}
// ── LA DEMANDE, PAR LE CHEMIN DES DEMANDES DE VIDEO ────────────────────────
//
// Kevin : « Le mecanisme des demandes de video existe : reprends-le. » C'est
// le meme objet, le meme chemin d'ecriture, la meme poussee, et la meme regle :
// AUCUNE NOTIFICATION. Une demande est en attente tant qu'elle est dans le
// tableau ; la consommer, c'est la retirer.
function demandeMesurePour(cle,user){
  const u=user||currentUser;
  if(!cle||!u||!Array.isArray(u.demandesMesure)) return null;
  return u.demandesMesure.find(d=>d&&d.cle===cle)||null;
}
function demanderMesure(cle){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  if(!c.email){ toast('Cet élève n’a pas encore de dossier synchronisé','var(--orange)'); return false; }
  const m=CCD_MANQUES.find(x=>x.cle===cle);
  if(!m) return false;
  if(!Array.isArray(c.demandesMesure)) c.demandesMesure=[];
  if(demandeMesurePour(cle,c)){ toast('Demande déjà en cours pour cette mesure','var(--orange)'); return false; }
  c.demandesMesure.push({cle:cle,date:Date.now(),parQui:(currentUser||{}).id});
  users[c.email]=c;
  const ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(c.email,c);
  try{ renderVerdictCoach(getOwnedClient(currentClientId)); }catch(e){}
  toastSync(ok,envoi,'Mesure demandée : '+m.lib,'la demande est');
  return true;
}
function annulerDemandeMesure(cle){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c||!Array.isArray(c.demandesMesure)) return false;
  const i=c.demandesMesure.findIndex(d=>d&&d.cle===cle);
  if(i<0) return false;
  c.demandesMesure.splice(i,1);
  users[c.email]=c;
  const ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(c.email,c);
  try{ renderVerdictCoach(getOwnedClient(currentClientId)); }catch(e){}
  toastSync(ok,envoi,'Demande retirée','le retrait est');
  return true;
}
/**
 * Le bilan qui arrive eteint les demandes qu'il satisfait. Rend le nombre de
 * demandes retirees, pour que l'appelant sache s'il doit enregistrer.
 *
 * ⚠ ON NE REGARDE PAS SI LA VALEUR EST « BONNE » : elle est saisie, la demande
 *   n'a plus lieu d'etre. Un controle de vraisemblance vit deja dans le
 *   formulaire, et le doubler ici laisserait une demande allumee sur une
 *   mesure que l'athlete a bel et bien envoyee.
 */
function consommerDemandesMesure(bi,user){
  const u=user||currentUser;
  if(!bi||!u||!Array.isArray(u.demandesMesure)||!u.demandesMesure.length) return 0;
  const avant=u.demandesMesure.length;
  u.demandesMesure=u.demandesMesure.filter(d=>{
    if(!d||!d.cle) return false;
    const m=CCD_MANQUES.find(x=>x.cle===d.cle);
    if(!m) return false;
    const v=bi['bil-'+m.champ]||bi['deb-'+m.champ];
    return !(v!==undefined&&v!==''&&parseFloat(v)>0);
  });
  return avant-u.demandesMesure.length;
}
/**
 * PURE (au dossier pres). Les AUTRES athletes a qui la meme mesure manque, et
 * qui n'ont pas deja la demande en attente.
 *
 * ⚠ POURQUOI CE BOUTON EXISTE. Kevin, 24/09/2026 : « reclamer la hauteur de
 *   genou a tes athletes actuels ». Une mesure NEUVE manque a TOUT LE MONDE le
 *   jour ou elle arrive : demander athlete par athlete, c'est autant de fois le
 *   meme geste, et un coach de vingt eleves ne le fera pas. La regle reste
 *   celle du lot 6 — une seule mesure a la fois, celle qui debloque le plus —
 *   mais elle vaut pour toute la liste d'un coup.
 *
 * ⚠ UN ELEVE QUI N'A PAS ENCORE DE DOSSIER EST ECARTE : `_fromCode` n'est
 *   qu'un code d'invitation, il n'y a personne au bout pour lire la demande.
 * @returns {any[]}
 */
function ccdManqueAutres(cle){
  const m=CCD_MANQUES.find(x=>x.cle===cle);
  if(!m) return [];
  let l=[]; try{ l=getClients()||[]; }catch(e){ return []; }
  const moi=String(currentClientId||'');
  return l.filter(c=>{
    if(!c||c._fromCode||!c.email) return false;
    if(String(c.id||'')===moi) return false;
    const u=_dossier(c);
    let femme=false;
    try{ femme=isFemale((u._evol_gender||u.gender)||''); }catch(e){ femme=false; }
    if(m.femme&&!femme) return false;
    if(!_ccdManqueCette(u,m)) return false;
    return !demandeMesurePour(cle,u);
  });
}
/**
 * La meme demande, a tous ceux a qui elle manque. UN SEUL GESTE DU COACH.
 *
 * ⚠ UNE SEULE ECRITURE LOCALE, UNE POUSSEE PAR DOSSIER. DB.set reecrit la
 *   table entiere : la rappeler vingt fois ecrirait vingt fois le meme gros
 *   objet. La poussee, elle, est par dossier — c'est le chemin des demandes de
 *   video, et il ne change pas.
 * ⚠ ET TOUJOURS AUCUNE NOTIFICATION : la demande attend dans l'app, a l'endroit
 *   ou la mesure se saisit.
 */
function demanderMesureATous(cle){
  const m=CCD_MANQUES.find(x=>x.cle===cle);
  if(!m) return 0;
  const users=DB.get('users')||{};
  const liste=ccdManqueAutres(cle);
  let n=0;
  const envois=[];
  for(const c of liste){
    const d=users[c.email];
    if(!d||!_estMonAthlete(d,currentUser)) continue;
    if(demandeMesurePour(cle,d)) continue;
    if(!Array.isArray(d.demandesMesure)) d.demandesMesure=[];
    d.demandesMesure.push({cle:cle,date:Date.now(),parQui:(currentUser||{}).id});
    d.updatedAt=Date.now();
    users[c.email]=d;
    envois.push([c.email,d]);
    n++;
  }
  if(!n){ toast('Personne d’autre n’a besoin de cette mesure.','var(--orange)'); return 0; }
  const ok=DB.set('users',users);
  let envoi=Promise.resolve(true);
  try{ envoi=Promise.all(envois.map(([e,d])=>CLOUD.pushOne(e,d))); }catch(e){}
  try{ renderVerdictCoach(getOwnedClient(currentClientId)); }catch(e){}
  toastSync(ok,envoi,'Mesure demandée à '+n+' athlète'+(n>1?'s':''),'les demandes sont');
  return n;
}
// LA LIGNE DU COACH : la mesure, ce qu'elle debloque, et le geste.
function _htmlCcdManque(c){
  const u=_dossier(c);
  if(!u) return '';
  let m=null; try{ m=ccdMesureManquante(u); }catch(e){ m=null; }
  if(!m) return '';
  const d=demandeMesurePour(m.cle,u);
  // LES AUTRES A QUI ELLE MANQUE : le compte est DANS le bouton, pour que le
  // clic soit informe. Une mesure neuve manque a tout le monde le jour ou elle
  // arrive, et personne ne fera vingt fois le meme geste.
  const autres=(function(){ try{ return ccdManqueAutres(m.cle); }catch(e){ return []; } })();
  // ⚠ « AUX 1 AUTRE » NE SE DIT PAS. A un seul, on le nomme : c'est plus
  //   court a lire, et ca dit exactement qui va recevoir la demande.
  const libTous=(autres.length===1)
    ?('La demander aussi à '+(String((autres[0]||{}).fname||'').trim()||'ton autre athlète'))
    :('La demander aux '+autres.length+' autres');
  return '<p class="ccd-manque"><span class="ccd-manque-t">'
    +escapeHtml(ccdPhraseManque(m))+'</span>'
    +(d
      ?('<span class="ccd-manque-d">Demandé le '+escapeHtml(_ccdJour(d.date))+'.'
        +'<button type="button" class="ccd-out-r" onclick="annulerDemandeMesure(\''+m.cle+'\')">Retirer la demande</button></span>')
      :('<button type="button" class="ccd-manque-b" onclick="demanderMesure(\''+m.cle+'\')">Le lui demander</button>'))
    +(autres.length?('<button type="button" class="ccd-manque-b ccd-manque-tous"'
      +' onclick="demanderMesureATous(\''+m.cle+'\')">'
      +escapeHtml(libTous)+'</button>'):'')
    +'</p>';
}
// ET LA LIGNE DE L'ATHLETE, sur son ecran de mensurations : il n'y a aucune
// notification, ici comme pour les videos ; la demande attend a l'endroit ou
// la mesure se saisit.
function _htmlDemandeMesureAthlete(u){
  const l=((u&&u.demandesMesure)||[]).filter(Boolean);
  if(!l.length) return '';
  const noms=l.map(d=>{
    const m=CCD_MANQUES.find(x=>x.cle===d.cle);
    return m?m.lib.replace(/^son /,'ton ').replace(/^sa /,'ta '):'';
  }).filter(Boolean);
  if(!noms.length) return '';
  return '<p class="ccd-manque ccd-manque-a"><span class="ccd-manque-t">'
    +escapeHtml('Ton coach te demande '+(noms.length>1?'ces mesures':'une mesure')+' : '
      +noms.join(', ')+'. Tu la saisis à ton prochain bilan.')
    +'</span></p>';
}
// ══ LOT 9 : LES SIGNAUX, REGROUPES ET TRIES ════════════════════════════════
//
// Kevin, 23/09/2026 : « Aujourd'hui les plateaux, la douleur, l'asymetrie, la
// forme et le volume sont disperses dans la page. Rassemble-les dans l'etage 5,
// chacun en une ligne, et trie-les par importance : ce qui bloque un
// entrainement d'abord, ce qui merite un oeil ensuite. Un signal absent ne
// laisse pas de case vide, il n'apparait pas. »
//
// ⚠ AUCUN SECOND CLASSEMENT. L'ordre vient d'expliquerUrgence, celui qui range
//   deja les motifs de la liste « Pourquoi cet athlete est ici » et qui decide
//   du rang de l'athlete dans la file du coach. Un classement ecrit ici
//   finirait par le contredire : le meme athlete serait « urgent » en haut de
//   liste et « a regarder ensuite » dans sa fiche.
//
// ⚠ ET LES BLOCS COMPLETS NE SONT PAS SUPPRIMES, ILS SONT RANGES (lot 10) :
//   chaque ligne pointe vers le sien dans l'etage du detail, avec ses boutons
//   et ses tableaux. Une ligne qui resume sans donner acces a ce qu'elle
//   resume, c'est une information de moins, pas une de plus.
const CCD_SIG_BLOQUE=7;   // au-dessus, ca bloque un entrainement
// LA COULEUR DE LA PASTILLE (Kevin, 29/09/2026, sa maquette) : la FAMILLE du
// signal, pas sa note. r = rouge, un geste du coach est attendu ; o = orange,
// a surveiller ; g = gris, a lire. Ce qui bloque une seance est toujours rouge.
const CCD_SIG_BLOCS=Object.freeze([
  {re:/^Douleur/,ancre:'ccd-douleur',ton:'r',
   geste:'Ne rien forcer dessus, et structurer la gêne.'},
  {re:/^Plateau/,ancre:'ccd-plateaux',ton:'r',
   geste:'Le détail dit quel muscle plafonne, et depuis quand.'},
  {re:/^Volume/,ancre:'ccd-volume',ton:'o',
   geste:'Le détail donne le prescrit et le réalisé, muscle par muscle.'},
  {re:/^Forme/,ancre:'ccd-forme',ton:'o',
   geste:'Le détail trace ce qu’il a déclaré, séance après séance.'},
  {re:/^Asymétrie/,ancre:'ccd-asymetrie',ton:'o',geste:''},
  {re:/^Décharge/,ancre:'ccd-bloc',ton:'r',geste:'La proposition attend sa réponse.'},
  {re:/^Drapeau/,ancre:'ccd-securite',ton:'r',geste:'À traiter avant toute séance.'},
  {re:/^Restriction/,ancre:'ccd-reds',ton:'o',geste:''},
  {re:/^Séances écourtées/,ancre:'ccd-plateaux',ton:'o',geste:''},
  // Les bilans menent au calendrier des bilans, range dans le detail.
  {re:/^Bilan sans réponse/,ancre:'ccd-bilans',ton:'g',geste:''},
  {re:/^Bilan en retard/,ancre:'ccd-bilans',ton:'r',geste:''},
  {re:/^Accès/,ancre:'',ton:'o',geste:''}
]);
/**
 * PURE. Les signaux de la fiche, dans l'ordre d'expliquerUrgence, chacun avec
 * son geste et le bloc qui le detaille.
 * @returns {Array<{motif:string,gravite:number,date:number|null,
 *                  geste:string,ancre:string,bloque:boolean}>}
 */
function ccdSignaux(c){
  let l=[];
  try{ l=expliquerUrgence(c)||[]; }catch(e){ return []; }
  return l.map(x=>{
    const b=CCD_SIG_BLOCS.find(y=>y.re.test(String(x.motif||'')))||{};
    const bloque=(Number(x.gravite)||0)>=CCD_SIG_BLOQUE;
    return {motif:String(x.motif||''),gravite:Number(x.gravite)||0,
      date:x.date||null,geste:b.geste||'',ancre:b.ancre||'',
      bloque,ton:bloque?'r':(b.ton||'g')};
  });
}
// Une ligne : la pastille de gravite, le motif, sa date, son geste, et le
// chemin vers son bloc.
// La maquette de Kevin (29/09/2026) : la premiere ligne de la liste (la plus
// grave, l'ordre est celui d'expliquerUrgence) est cerclee de rouge ; toute
// ligne qui mene a un bloc se touche en entier et finit par un chevron.
const _CCD_CHEVRON='<svg class="ccd-sig-ch" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function _htmlCcdSignal(s,premier){
  const va=s.ancre?(' onclick="ccdVoirDetail(\''+s.ancre+'\')"'):'';
  return '<li class="ccd-sig ccd-sig-'+(s.ton||'g')+(s.bloque?' ccd-sig-b':'')
    +(premier?' ccd-sig-1':'')+(s.ancre?' ccd-sig-a':'')+'"'+va+'>'
    +'<span class="ccd-sig-p" aria-hidden="true"><i></i></span>'
    +'<span class="ccd-sig-c">'
    +'<span class="ccd-sig-m">'+escapeHtml(s.motif)
    +(s.date?('<span class="ccd-sig-d"> · '+escapeHtml(_ccdJour(s.date))+'</span>'):'')
    +'</span>'
    +(s.geste?('<span class="ccd-sig-g">'+escapeHtml(s.geste)+'</span>'):'')
    +'</span>'
    +(s.ancre?('<button type="button" class="ccd-out-r ccd-sig-v"'
      +(s.geste?'':' aria-label="Voir le détail"')
      +' onclick="event.stopPropagation();ccdVoirDetail(\''+s.ancre+'\')">'
      +(s.geste?'<span>Voir le détail</span>':'')+_CCD_CHEVRON+'</button>'):'')
    +'</li>';
}
function _htmlCcdSignaux(c){
  const l=ccdSignaux(c);
  if(!l.length) return '';
  const bloc=l.filter(x=>x.bloque), oeil=l.filter(x=>!x.bloque);
  // ⚠ UN GROUPE VIDE NE SORT PAS. « Ce qui bloque une seance : rien » est une
  //   case vide avec un titre, et la mission le refuse explicitement.
  const groupe=(titre,items)=>items.length
    ?('<div class="ccd-sig-gr"><h4 class="ccd-sig-t">'+escapeHtml(titre)+'</h4>'
      +'<ul class="ccd-sig-l">'+items.map(x=>_htmlCcdSignal(x,x===l[0])).join('')+'</ul></div>')
    :'';
  return groupe('Ce qui bloque une séance',bloc)
    +groupe('Ce qui mérite un œil',oeil);
}
function renderSignauxCoach(c){
  const z=document.getElementById('ccd-signaux');
  if(!z) return false;
  let h='';
  try{ h=c?_htmlCcdSignaux(c):''; }catch(e){ h=''; }
  z.innerHTML=h;
  return !!h;
}
// Le detail d'un signal : l'etage 6, son repli ouvert, et le bloc sous les yeux.
//
// ⚠ DEUX REPLIS PEUVENT ETRE FERMES : celui de l'etage entier (« Tout le
//   detail ») et celui de la section du bloc (« Volume », « Douleur »...).
//   Scroller vers un noeud replie ne montre rien, et le coach conclurait que le
//   bouton ne marche pas. On passe par ccdReplier, qui memorise l'ouverture :
//   c'est lui qui l'a demandee.
function ccdVoirDetail(ancre){
  try{
    ccdEtage('detail');
    const ouvrir=id=>{
      const c=document.getElementById(id);
      const s=c&&c.closest&&c.closest('.cc-sect');
      if(s&&s.classList.contains('replie')) ccdReplier(id);
    };
    ouvrir('ccd-detail');
    const z=document.getElementById(ancre);
    if(!z) return false;
    const sz=z.closest&&z.closest('.cc-sect');
    if(sz&&sz.classList.contains('replie')){
      const c=sz.querySelector(':scope>.cc-sect-c');
      if(c&&c.id) ouvrir(c.id);
    }
    if(z.scrollIntoView) z.scrollIntoView({block:'center',behavior:'smooth'});
    return true;
  }catch(e){ return false; }
}
// ══ LOT 10 : LE TABLEAU DES DOUZE TOURS, DANS LE DETAIL ════════════════════
//
// Kevin, 23/09/2026 : « Tout le reste part dans l'etage 6, replie : le tableau
// des douze tours, le calendrier des bilans, le journal, le dossier, la
// securite. Rien n'est supprime, tout est range. »
//
// Le calendrier, le journal, le dossier et la securite y etaient deja. Il
// manquait le tableau : il vivait sur l'ecran « Evolution », que le coach doit
// ouvrir a part.
//
// ⚠ IL N'EST PAS RECOPIE DE renderBilanEvolution, ET IL NE LA REMPLACE PAS.
//   Celui-la nomme ses colonnes « Bilan 1, 2, 3 » et ignore la bascule ; celui-ci
//   les DATE et suit la lecture choisie en tete de fiche (valeur, ecart,
//   pourcentage). Les deux passent par renderDataTable, qui reste la seule
//   fabrique de tableaux de l'application.
//
// ⚠ UNE VALEUR REPORTEE RESTE GRISE, ici comme ailleurs : le coach doit
//   distinguer d'un coup d'oeil une mesure reprise d'un releve du jour, sans
//   quoi il lit une stagnation la ou personne n'a sorti le metre.
function _htmlCcdMensurations(c){
  const u=_dossier(c);
  if(!u) return '';
  let bl=[]; try{ bl=bilansOrdonnes(u)||[]; }catch(e){ bl=[]; }
  if(!bl.length) return '';
  // LES TOURS QUI ONT AU MOINS UNE MESURE : une ligne de douze tirets pour un
  // athlete qui n'en a mesure que trois, c'est neuf lignes de mobilier.
  const tours=MEAS.filter(m=>bl.some(b=>getBM(b,m.k)>0));
  if(!tours.length) return '';
  const lu=(v,i,vals)=>{
    if(v==null) return null;
    if(_ccdLecture==='ecart'){
      let p=null;
      for(let j=i-1;j>=0;j--) if(vals[j]!=null){ p=vals[j]; break; }
      return (p==null)?_synNombre(v):_ccdDelta(Math.round((v-p)*10)/10,'');
    }
    if(_ccdLecture==='pourcent'){
      let d=null;
      for(let j=0;j<i;j++) if(vals[j]!=null){ d=vals[j]; break; }
      if(d==null||!d) return _synNombre(v);
      const p=Math.round((v-d)/d*1000)/10;
      return (p>0?'+':(p<0?'−':''))+_synNombre(p)+' %';
    }
    return _synNombre(v);
  };
  // ⚠ LA DERNIERE COLONNE N'EST PAS UN ECART DANS LE TEMPS : _cellEcartMensuration
  //   rend l'ecart DROITE/GAUCHE au dernier bilan, et rien pour un tour qui
  //   n'existe que d'un cote. Le tableau de l'ecran Evolution l'intitule
  //   « Écart » tout court, ce qui se lit comme le chemin parcouru : ici elle
  //   porte son vrai nom, et le pied de tableau le redit.
  const colonnes=['Tour'].concat(bl.map(b=>_ccdJour(b.date))).concat(['Écart D/G']);
  const lignes=tours.map(m=>{
    const vals=bl.map(b=>{ const v=getBM(b,m.k); return (v>0)?v:null; });
    return {label:_libMesure(m.l,true),labelBg:m.color||'var(--border)',labelColor:'var(--text)',
      values:vals.map((v,i)=>lu(v,i,vals))
        .concat([(function(){ try{ return _cellEcartMensuration(bl,m.k); }catch(e){ return null; } })()]),
      valueStyleFn:(v,ci,vide)=>(ci>=bl.length)
        ?(vide?'background:#080808;color:var(--sub);':'background:var(--dark);color:var(--sub);')
        :(vide?'background:#080808;color:var(--sub);'
          :('background:var(--dark);color:'
            +((bl[ci]&&(function(){ try{ return bmReportee(bl[ci],m.k); }catch(e){ return false; } })())
              ?'var(--text-faint)':'var(--text)')+';'))};
  });
  // ⚠ LE MARQUEUR DE CASE VIDE EST UN POINT, PAS UN TIRET CADRATIN.
  //   renderDataTable met un tiret cadratin par defaut, et le tiret cadratin
  //   est interdit dans tout ce que Kevin lit. Le pied de tableau dit ce que
  //   le point veut dire, sans quoi il passerait pour une valeur.
  const t=renderDataTable(colonnes,lignes,
    {stickyCol0:true,firstColMinWidth:'118px',pad:'4px 6px',mb:'8px',emptyVal:'·'});
  const dit={absolu:'la valeur relevée à chaque bilan',
    ecart:'l’écart avec le bilan d’avant',
    pourcent:'le pourcentage depuis le premier bilan'}[_ccdLecture]||'';
  return t+'<p class="ccd-out-p">Un point, c’est une mesure absente de ce bilan. '
    +'Chaque colonne porte la date de son bilan, et '
    +'chaque case '+escapeHtml(dit)+' (la bascule en tête de fiche). La dernière '
    +'colonne dit l’écart entre le côté droit et le côté gauche au dernier bilan, '
    +'quand la mesure existe des deux côtés. Tout est au ruban, à ± '
    +String(SYN_BRUIT_MESURE).replace('.',',')+' cm près. En gris, une valeur '
    +'reportée du bilan précédent sans avoir été re-mesurée.</p>';
}
function renderMensCoach(c){
  const z=document.getElementById('ccd-mens');
  if(!z) return false;
  let h='';
  try{ h=c?_htmlCcdMensurations(c):''; }catch(e){ h=''; }
  z.innerHTML=h;
  try{ z.querySelectorAll('[data-scroll-fade]').forEach(e=>setupScrollFade(e)); }catch(e){}
  return !!h;
}
// ══ L'ETAGE « OU IL EN EST », D'APRES LA MAQUETTE DE KEVIN (24/09/2026) ═══
// « Remplace par celle-ci et rajoute les fonctionnalites. » Autour des quatre
// cartes, qui gardent leurs chiffres, leurs sources et leurs marges :
//   • un en-tete : la lecture (valeur, ecart, %), trois periodes d'un appui
//     (7 jours, 28 jours, 3 mois) et les deux bilans compares ;
//   • sur chaque carte, une icone, une mini-courbe et le sens de l'ecart ;
//   • « Comparer les periodes » : les trois ecarts cote a cote ;
//   • « Donnees incompletes » : toutes les mesures qui manquent, et la demande.
// ⚠ UNE PERIODE, C'EST UNE PAIRE DE BILANS. Les chiffres viennent des bilans,
//   pas d'un calendrier : « 28 jours » compare le dernier bilan au dernier
//   bilan pose au moins 28 jours avant lui (ou au premier), et la carte dit
//   de quel bilan l'ecart part. Rien n'est interpole entre deux bilans.
// ⚠ « MASSE MAIGRE », PAS « MUSCULAIRE » : la formule donne le poids moins la
//   masse grasse (os, eau, organes compris), pas le muscle seul.
const CCD_FENETRES=Object.freeze([{k:'7j',j:7,lib:'7 jours'},{k:'28j',j:28,lib:'28 jours'},{k:'3m',j:91,lib:'3 mois'}]);
let _ccdFenetre=null;
// PURE. La paire de bilans d'une fenetre : le dernier, et le dernier pose au
// moins `jours` jours avant lui — ou le premier. null sous deux bilans.
function ccdFenetreBilans(u,jours){
  let bl=[]; try{ bl=bilansOrdonnes(u)||[]; }catch(e){ bl=[]; }
  if(bl.length<2) return null;
  const B=bl[bl.length-1], lim=Number(B.date)-jours*864e5;
  let A=bl[0];
  for(let i=bl.length-2;i>=0;i--) if(Number(bl[i].date)<=lim){ A=bl[i]; break; }
  return {a:Number(A.date),b:Number(B.date)};
}
// PURE. Le dossier ramene a deux dates — ccdBorner, pour une paire donnee.
function _ccdBornerA(u,a,b){
  const iA=_jourISO(a), iB=_jourISO(b);
  return Object.assign({},u,{
    bilans:((u&&u.bilans)||[]).filter(x=>x&&Number(x.date)>=a&&Number(x.date)<=b),
    weightLog:((u&&u.weightLog)||[]).filter(e=>e&&e.date>=iA&&e.date<=iB)});
}
function ccdPeriodeVerdict(k){
  const f=CCD_FENETRES.find(x=>x.k===k);
  const c=getOwnedClient(currentClientId);
  if(!f||!c) return null;
  const p=ccdFenetreBilans(_dossier(c),f.j);
  _ccdFenetre=p?k:null;
  if(p) ccdPaire(p.a,p.b); else ccdPaire(0,0);
  return p;
}
function _ccdSvg(p,plein){ return '<svg viewBox="0 0 24 24" '+(plein?'fill="currentColor"':'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="square" stroke-linejoin="miter"')+' aria-hidden="true">'+p+'</svg>'; }
const CCD_ICO={
  athlete:_ccdSvg('<circle cx="12" cy="7.5" r="4"/><path d="M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5z"/>',true),
  poids:_ccdSvg('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 9.5a4 4 0 0 1 8 0M12 9.5l1.8-2"/>'),
  maigre:_ccdSvg('<path d="M6 19c-1.5-2-1.5-5 .5-7l3-3c.8-.8 2-.5 2.3.5l.5 1.6 3-1.1c1.4-.5 2.9.4 3 1.9.3 3.2-1.2 7.1-5.3 7.1z"/><path d="M9 7.5l-1-3.5 3 .5"/>'),
  gras:_ccdSvg('<path d="M12.3 2.5c.6 3-1.9 4.6-3.3 6.6-1.3 1.8-2 3.4-2 5.3a5 5 0 0 0 10 0c0-2.3-1-4.1-2.3-5.6.1 1.6-.6 2.8-1.6 3.3.5-3.3-.4-6.8-.8-9.6z"/>'),
  dort:_ccdSvg('<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/><path d="M15 4h3.5L15 8h3.5"/>'),
  bas:_ccdSvg('<path d="M6 9l6 6 6-6"/>'),
  haut:_ccdSvg('<path d="M6 15l6-6 6 6"/>'),
  droite:_ccdSvg('<path d="M9 5l7 7-7 7"/>'),
  calendrier:_ccdSvg('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13h.01M12 13h.01M16.5 13h.01M7.5 16.5h.01M12 16.5h.01"/>'),
  info:_ccdSvg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>'),
  barres:_ccdSvg('<rect x="3.5" y="12" width="4" height="8.5" rx="1.2"/><rect x="10" y="7" width="4" height="13.5" rx="1.2"/><rect x="16.5" y="3.5" width="4" height="17" rx="1.2"/>',true),
  alerte:_ccdSvg('<circle cx="12" cy="12" r="10"/><path d="M12 7v6.5M12 16.8h.01" stroke="#1a0d00" stroke-width="2.4" stroke-linecap="round"/>',true)
};
// La mini-courbe : les derniers releves, sans echelle — elle dit une forme,
// le chiffre est a cote. Rien sous deux points.
function _ccdSpark(vals){
  const v=(vals||[]).filter(x=>x!=null&&isFinite(x)).slice(-8);
  if(v.length<2) return '';
  const mn=Math.min(...v), mx=Math.max(...v), et=(mx-mn)||1;
  const pts=v.map((x,i)=>[(i/(v.length-1))*96+2,26-((x-mn)/et)*22]);
  const l=pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  const der=pts[pts.length-1];
  return '<svg class="ccdx-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">'
    +'<polygon points="2,30 '+l+' 98,30" class="ccdx-spark-a"/>'
    +'<polyline points="'+l+'" class="ccdx-spark-l"/>'
    +'<circle cx="'+der[0].toFixed(1)+'" cy="'+der[1].toFixed(1)+'" r="2.4" class="ccdx-spark-p"/></svg>';
}
function _ccdSeries(u){
  let bl=[]; try{ bl=bilansOrdonnes(u)||[]; }catch(e){ bl=[]; }
  let comp=[]; try{ comp=ccdCompositionSerie(u)||[]; }catch(e){ comp=[]; }
  return {poids:bl.map(b=>getBW(b)).filter(x=>x>0),
    gras:comp.map(x=>x.gras),maigre:comp.map(x=>x.maigre)};
}
// L'en-tete de l'etage : lecture, periodes, et les deux bilans compares.
function _htmlCcdTete(u){
  let bl=[]; try{ bl=bilansOrdonnes(u)||[]; }catch(e){ bl=[]; }
  const a=ccdPaireActive()?_ccdPaireA:(bl.length>1?Number(bl[bl.length-2].date):0);
  const b=ccdPaireActive()?_ccdPaireB:(bl.length?Number(bl[bl.length-1].date):0);
  const jj=t=>t?new Date(t).toLocaleDateString('fr-FR'):'';
  const plage=a&&b?(jj(a)+' – '+jj(b)):(b?jj(b):'Aucun bilan');
  return '<div class="ccdx-tete">'
    +'<span class="ccdx-tete-i">'+CCD_ICO.athlete+'</span>'
    +'<div class="ccdx-tete-c"><h4>Athlète</h4><span>Vue d’ensemble de ses données principales</span></div>'
    +'<span class="cc-corps-vue ccd-lec ccdx-lec" role="group" aria-label="Ce que les cartes affichent">'
      +CCD_LECTURES.map(x=>'<button type="button" class="cc-corps-o'+((x.cle===_ccdLecture)?' actif':'')
        +'" aria-pressed="'+((x.cle===_ccdLecture)?'true':'false')+'" title="'+escapeHtml(x.aide)
        +'" onclick="ccdLecture(\''+x.cle+'\')">'+escapeHtml(x.lib)+'</button>').join('')+'</span>'
    +'<span class="ccdx-per" role="group" aria-label="Période comparée">'
      +CCD_FENETRES.map(f=>'<button type="button" class="ccdx-per-b'+(_ccdFenetre===f.k?' actif':'')+'"'
        +' aria-pressed="'+(_ccdFenetre===f.k)+'"'+(bl.length<2?' disabled':'')
        +' onclick="ccdPeriodeVerdict(\''+f.k+'\')">'+f.lib+'</button>').join('')+'</span>'
    +'<button type="button" class="ccdx-plage ccd-out-b" aria-expanded="false" aria-controls="ccd-out-c"'
      +' onclick="ccdOutils(this)" title="Choisir les deux bilans comparés, et les mesures épinglées">'
      +CCD_ICO.calendrier+'<span>'+escapeHtml(plage)+'</span>'+CCD_ICO.bas+'</button>'
    +'</div>';
}
// « COMPARER LES PERIODES » : ouvre la feuille des trois ecarts.
function _htmlCcdComparer(u){
  let bl=[]; try{ bl=bilansOrdonnes(u)||[]; }catch(e){ bl=[]; }
  if(bl.length<2) return '';
  return '<div class="ccdx-bande">'
    +'<span class="ccdx-bande-i">'+CCD_ICO.info+'</span>'
    +'<div class="ccdx-bande-c"><h5>Comparer les périodes</h5>'
      +'<span>Analyse les évolutions de l’athlète en comparant différentes périodes (7 jours, 28 jours, 3 mois) pour identifier les tendances et ajuster l’entraînement.</span></div>'
    +'<button type="button" class="btn btn-red ccdx-bande-b" onclick="ccdComparerPeriodes()">'+CCD_ICO.barres+'<span>Les comparer</span></button>'
    +'<button type="button" class="ccdx-bande-b2" onclick="ccdChoisirPeriode()">'+CCD_ICO.calendrier+'<span>Choisir une période</span></button>'
    +'</div>';
}
function ccdChoisirPeriode(){
  const t=document.querySelector('#ccd-verdict .ccdx-plage');
  const c=document.getElementById('ccd-out-c');
  if(t&&c&&c.hidden) ccdOutils(t);
  try{ (document.getElementById('ccd-pa')||t).focus(); t.scrollIntoView({block:'center',behavior:'smooth'}); }catch(e){}
}
// PURE. Les trois ecarts cote a cote.
function ccdComparaison(u){
  return CCD_FENETRES.map(f=>{
    const p=ccdFenetreBilans(u,f.j);
    if(!p) return {f,p:null};
    let v=null; try{ v=ccdVerdict(_ccdBornerA(u,p.a,p.b),true); }catch(e){ v=null; }
    return {f,p,poids:v&&v.poids?v.poids.delta:null,
      maigre:v&&v.maigre?v.maigre.delta:null,gras:v&&v.gras&&!v.gras.manque?v.gras.delta:null};
  });
}
function ccdComparerPeriodes(){
  const c=getOwnedClient(currentClientId);
  if(!c) return;
  const l=ccdComparaison(_dossier(c));
  const cel=v=>v==null?'-':escapeHtml(_ccdDelta(v,'kg'));
  _sanFeuille('Comparer les périodes',
    '<table class="ccdx-tab"><thead><tr><th>Période</th><th>Poids</th><th>Masse maigre</th><th>Masse grasse</th></tr></thead><tbody>'
    +l.map(x=>'<tr><th>'+x.f.lib+(x.p?'<small>depuis le '+escapeHtml(_ccdJour(x.p.a))+'</small>':'')+'</th>'
      +(x.p?('<td>'+cel(x.poids)+'</td><td>'+cel(x.maigre)+'</td><td>'+cel(x.gras)+'</td>')
        :'<td colspan="3">Il faut deux bilans.</td>')+'</tr>').join('')
    +'</tbody></table>'
    +'<div class="san-aide" style="margin-top:10px">Chaque période compare le dernier bilan au dernier bilan posé au moins aussi loin avant lui. '
    +'Masse grasse estimée au ruban, à '+CCD_BF_MARGE+' points près ; masse maigre à '+_synNombre(CCD_MAIGRE_BRUIT)+' kg près.</div>');
}
// « DONNEES INCOMPLETES » : combien de mesures manquent, et la feuille qui
// les nomme toutes, chacune avec ce qu'elle debloque et sa demande.
function _ccdManquesTous(u){
  let femme=false; try{ femme=isFemale((u&&(u._evol_gender||u.gender))||''); }catch(e){}
  return CCD_MANQUES.filter(m=>(!m.femme||femme)&&_ccdManqueCette(u,m));
}
function _htmlCcdIncomplet(c){
  const u=_dossier(c);
  if(!u) return '';
  const l=_ccdManquesTous(u);
  if(!l.length) return '';
  return '<div class="ccdx-incomplet">'
    +'<span class="ccdx-inc-i">'+CCD_ICO.alerte+'</span>'
    +'<div class="ccdx-inc-c"><h5>Données incomplètes</h5>'
      +'<span>'+l.length+' mesure'+(l.length>1?'s manquent':' manque')+' à son dossier. '
      +escapeHtml(ccdPhraseManque(ccdMesureManquante(u)).split('. ')[0])+' d’abord : c’est elle qui débloque le plus.</span></div>'
    +'<button type="button" class="ccdx-inc-lien" onclick="ccdVoirManques()">Voir les données manquantes'+CCD_ICO.droite+'</button>'
    +'</div>';
}
function ccdVoirManques(){
  const c=getOwnedClient(currentClientId);
  if(!c) return;
  const u=_dossier(c);
  const l=_ccdManquesTous(u);
  _sanFeuille('Données manquantes',
    (_htmlCcdManque(c)||'')
    +'<div class="ccdx-manq-l">'+l.map(m=>{
      const d=demandeMesurePour(m.cle,u);
      return '<div class="ccdx-manq"><div><b>'+escapeHtml(m.lib.charAt(0).toUpperCase()+m.lib.slice(1))+'</b>'
        +'<span>Pour '+escapeHtml(m.debloque)+'. '+escapeHtml(m.effort)+'</span></div>'
        +(d?'<em>Demandé le '+escapeHtml(_ccdJour(d.date))+'</em>'
          :'<button type="button" class="ccd-manque-b" onclick="demanderMesure(\''+m.cle+'\');ccdVoirManques()">Le lui demander</button>')
        +'</div>';
    }).join('')+'</div>');
}
function renderVerdictCoach(c){
  const z=document.getElementById('ccd-verdict');
  if(!z) return false;
  const u=_dossier(c);
  // ⚠ LES CARTES LISENT LE DOSSIER BORNE A LA PAIRE, LES OUTILS LE DOSSIER
  //   ENTIER : les deux menus deroulants doivent proposer TOUS les bilans,
  //   sans quoi on ne pourrait plus sortir de la paire qu'on vient de poser.
  const b=ccdBorner(u);
  let h='';
  try{ h=u?_htmlCcdVerdict(b,ccdPaireActive()):''; }catch(e){ h=''; }
  if(h){
    // LA MAQUETTE DU 24/09/2026 : l'en-tete, les cartes, la comparaison des
    // periodes, et les donnees qui manquent (la demande vit dans leur feuille).
    try{ h='<div class="ccdx">'+_htmlCcdTete(u)+_htmlCcdOutils(u)+h+_htmlCcdEpingles(b)
      +_htmlCcdComparer(u)+_htmlCcdIncomplet(c)+'</div>'; }catch(e){}
  }
  z.innerHTML=h;
  // LA BARRE VIT DANS LA LIGNE DE TITRE, et elle disparait avec les cartes :
  // trois boutons de lecture au-dessus d'un etage vide ne lisent rien.
  const zb=document.getElementById('ccd-outils');
  if(zb) zb.innerHTML=h?_htmlCcdBarre():'';
  const a=document.getElementById('ccd-verdict-alerte');
  if(a){ let t=''; try{ t=h?_htmlCcdAlerte(c):''; }catch(e){ t=''; } a.innerHTML=t; }
  return true;
}
// ══ LOT 4 : LES COURBES, TOUTES SUR LA MEME PERIODE ════════════════════════
//
// Kevin, 23/09/2026 : « UN SEUL SELECTEUR DE PERIODE en tete de l'etage, qui
// pilote TOUS les graphiques a la fois : 30 jours, 90 jours, 1 an, tout.
// Aujourd'hui chaque bloc fait ce qu'il veut. »
//
// ⚠ « TOUT » EST LA VUE D'OUVERTURE, et ce n'est pas un defaut de paresse : a
//   l'ouverture d'une fiche, rien de ce qui est au dossier ne doit etre cache.
//   Une fenetre de 30 jours par defaut aurait fait disparaitre trois bilans sur
//   quatre chez un athlete suivi au trimestre, sans que personne ne le voie.
//   C'est le coach qui retrecit.
// 6M, 1 AN, TOUT : les trois boutons de la maquette de Kevin (28/09/2026).
const CCD_PERIODES=Object.freeze([{j:182,lib:'6 mois'},{j:365,lib:'1 an'},{j:0,lib:'Tout'}]);
let _ccdPeriode=0;
function ccdPeriode(j){
  const n=Number(j)||0;
  _ccdPeriode=CCD_PERIODES.some(p=>p.j===n)?n:0;
  try{
    const c=getOwnedClient(currentClientId);
    if(c){
      renderCourbesCoach(c);
      // LE BLOC DE PESEE SUIT LA MEME PERIODE : c'est exactement la plainte de
      // depart, « chaque bloc fait ce qu'il veut ». Sa VITESSE, elle, garde sa
      // propre fenetre de mesure — c'est un protocole, pas un cadrage.
      renderPoidsCoach(c);
    }
    const b=document.querySelector('#ccd-courbes .db-seg button.actif');
    if(b) b.focus();
  }catch(e){}
  return _ccdPeriode;
}
// L'instant d'ou partent les courbes, ou 0 pour « tout ».
function ccdDepuis(){ return _ccdPeriode?(Date.now()-_ccdPeriode*86400000):0; }
// PURE. Les points qui tombent dans la periode choisie.
function ccdFenetre(points){
  const d=ccdDepuis();
  const l=points||[];
  return d?l.filter(p=>p&&Number(p.x)>=d):l;
}
// Le libelle de la periode, pour les phrases qui la nomment.
function ccdPeriodeLib(){
  const p=CCD_PERIODES.find(x=>x.j===_ccdPeriode);
  return p?p.lib.toLowerCase():'tout';
}
/**
 * PURE. La composition du corps, bilan par bilan : le poids releve, le
 * pourcentage de masse grasse estime, les kilos de gras et ceux de maigre.
 *
 * ⚠ UNE SEULE FORMULE DANS TOUT L'ONGLET. Les quatre cartes du verdict lisent
 *   cette liste, la courbe aussi : deux calculs de masse maigre dans le meme
 *   ecran finiraient par donner deux chiffres, et le coach ne saurait pas
 *   lequel croire.
 * @returns {Array<{date:number,pct:number,poids:number,gras:number,maigre:number}>}
 */
function ccdCompositionSerie(u){
  let bl=[]; try{ bl=bilansOrdonnes(u)||[]; }catch(e){ return []; }
  const taille=parseFloat((u&&(u._evol_height||u['init-height']||u.height))||0)||null;
  const genre=(u&&(u._evol_gender||u.gender))||'';
  const out=[];
  if(!taille) return out;
  for(const b of bl){
    const p=getBW(b);
    if(!(p>0)) continue;
    let v=null;
    try{ v=calcBF(getBM(b,'waist'),getBM(b,'neck'),getBM(b,'hips'),taille,genre); }catch(e){ v=null; }
    if(v==null) continue;
    const gras=Math.round(p*v/100*10)/10;
    out.push({date:Number(b.date)||0,pct:v,poids:p,gras:gras,
      maigre:Math.round((p-gras)*10)/10});
  }
  return out;
}
// PURE. La masse maigre en points de courbe.
function ccdPointsMaigre(u){
  return ccdCompositionSerie(u).map(c=>({x:c.date,v:c.maigre}));
}
// ── LA PROJECTION ──────────────────────────────────────────────────────────
//
// « Au rythme des quatre dernieres semaines, 97,5 kg le 21 octobre. »
//
// ⚠ ET SES TROIS BORNES, TOUTES DEMANDEES : quatre pesees au minimum, huit
//   semaines au maximum, et la phrase qui la borne sous elle. On en ajoute une
//   quatrieme, qui est deja la doctrine du fichier pour la vitesse etendue :
//   quatre pesees faites en trois jours decrivent une humeur, pas une tendance.
//   Il faut donc qu'elles s'etalent sur deux semaines au moins.
//
// ⚠ CE N'EST PAS LA VITESSE DU PROTOCOLE. vitesseHebdo travaille sur la
//   moyenne mobile a sept jours et exige un regime de pesee quasi quotidien ;
//   elle sert a PROPOSER un ajustement calorique, et elle a raison d'etre
//   exigeante. Ici on ne propose rien : on prolonge une droite pour la montrer,
//   avec sa fourchette et la phrase qui dit ce qu'elle vaut.
const CCD_PROJ_JOURS=28;        // « les quatre dernieres semaines »
const CCD_PROJ_PESEES_MIN=4;    // « pas de projection sur moins de quatre pesees »
const CCD_PROJ_ETALEMENT=14;    // ... ni sur quatre pesees faites dans la meme semaine
const CCD_PROJ_SEM_MAX=8;       // « pas de projection au-dela de huit semaines »
/**
 * PURE (au jour pres : elle lit la derniere pesee, pas l'horloge).
 * @returns {{valeur:number,bas:number,haut:number,date:number,kgSem:number,
 *            n:number,debut:string,fin:string,semaines:number}
 *           |{manque:'pesees'|'etalement'|'aucune',n?:number,jours?:number}}
 */
function ccdProjection(u,semaines){
  const sem=Math.min(CCD_PROJ_SEM_MAX,Math.max(1,Number(semaines)||CCD_PROJ_SEM_MAX));
  let s=[]; try{ s=serieWeight(u)||[]; }catch(e){ s=[]; }
  if(!s.length) return {manque:'aucune',n:0};
  const fin=s[s.length-1].date;
  const dans=s.filter(e=>_joursEntre(e.date,fin)<=CCD_PROJ_JOURS-1);
  if(dans.length<CCD_PROJ_PESEES_MIN) return {manque:'pesees',n:dans.length};
  const etal=_joursEntre(dans[0].date,fin);
  if(etal<CCD_PROJ_ETALEMENT) return {manque:'etalement',jours:etal,n:dans.length};
  // MOINDRES CARRES SUR LES DATES REELLES, comme la vitesse etendue : des
  // pesees ne sont pas equidistantes, et regresser sur leur rang donnerait une
  // pente qui ne correspond a aucune duree.
  const pts=dans.map(e=>({x:_joursEntre(dans[0].date,e.date),y:Number(e.kg)||0}));
  const n=pts.length;
  const mx=pts.reduce((a,p)=>a+p.x,0)/n, my=pts.reduce((a,p)=>a+p.y,0)/n;
  let num=0,den=0;
  for(const p of pts){ num+=(p.x-mx)*(p.y-my); den+=(p.x-mx)*(p.x-mx); }
  if(!den) return {manque:'etalement',jours:etal,n:n};
  const pente=num/den, ord=my-pente*mx;            // kg par jour
  // LA FOURCHETTE VIENT DE LA DISPERSION DES PESEES ELLES-MEMES : l'ecart type
  // des residus donne le bruit autour de la droite, et l'incertitude de la
  // pente, portee jusqu'a la date visee, donne le reste. Les deux s'ajoutent.
  let sc=0;
  for(const p of pts) sc+=Math.pow(p.y-(ord+pente*p.x),2);
  const disp=(n>2)?Math.sqrt(sc/(n-2)):Math.max(SYN_BRUIT_POIDS,Math.sqrt(sc/Math.max(1,n-1)));
  const sePente=den?(disp/Math.sqrt(den)):0;
  const h=sem*7, xFin=pts[n-1].x;
  const valeur=ord+pente*(xFin+h);
  const marge=Math.max(SYN_BRUIT_POIDS,disp+sePente*h);
  const d=new Date(); const [A,M,J]=String(fin).split('-').map(Number);
  d.setFullYear(A,M-1,J); d.setHours(12,0,0,0);
  d.setDate(d.getDate()+h);
  return {valeur:Math.round(valeur*10)/10,
    bas:Math.round((valeur-marge)*10)/10,haut:Math.round((valeur+marge)*10)/10,
    date:d.getTime(),kgSem:Math.round(pente*7*100)/100,n:n,
    debut:dans[0].date,fin:fin,semaines:sem};
}
// « 21 octobre ».
function _ccdJourLong(ts){
  try{ return new Date(Number(ts)||0).toLocaleDateString('fr-FR',{day:'numeric',month:'long'}); }
  catch(e){ return ''; }
}
// « du 26 août au 23 septembre » a partir de deux dates ISO de pesee.
function _ccdJourISO(iso){
  const [A,M,J]=String(iso||'').split('-').map(Number);
  if(!A) return '';
  const d=new Date(); d.setFullYear(A,M-1,J); d.setHours(12,0,0,0);
  return _ccdJourLong(d.getTime());
}
/**
 * La projection en UNE phrase, et la phrase qui la borne sous elle.
 *
 * ⚠ AUCUN PRONOM. La phrase de la mission dit « il serait a 97,5 kg » ; la
 *   moitie des athletes du dossier sont des femmes, et l'ecran ne sait pas
 *   toujours a qui il parle. On annonce donc le chiffre sans pronom, ce qui ne
 *   retire rien a la phrase.
 */
function _htmlCcdProjection(u){
  let p=null; try{ p=ccdProjection(u); }catch(e){ p=null; }
  if(!p) return '';
  if(p.manque){
    const q=(p.manque==='aucune')
      ?'Aucune pesée au dossier : pas de projection.'
      :(p.manque==='pesees'
        ?('Pas de projection : '+(p.n||0)+' pesée'+((p.n||0)>1?'s':'')+' sur les quatre dernières semaines, il en faut '+CCD_PROJ_PESEES_MIN+'.')
        :('Pas de projection : ses '+(p.n||0)+' pesées tiennent sur '+(p.jours||0)+' jour'+((p.jours||0)>1?'s':'')+', il en faut au moins '+CCD_PROJ_ETALEMENT+'.'));
    return '<p class="ccd-proj ccd-proj-non">'+escapeHtml(q)+'</p>';
  }
  return '<p class="ccd-proj"><b>'+escapeHtml('Au rythme des quatre dernières semaines : '
      +_synNombre(p.valeur)+' kg le '+_ccdJourLong(p.date)+'.')+'</b><br>'
    +escapeHtml(p.n+' pesées du '+_ccdJourISO(p.debut)+' au '+_ccdJourISO(p.fin)+', soit '
      +(p.kgSem>0?'+':'−')+_synNombre(p.kgSem)+' kg par semaine. À cette date, la fourchette '
      +'va de '+_synNombre(p.bas)+' à '+_synNombre(p.haut)+' kg. Une tendance n’est pas une promesse.')
    +'</p>';
}
// ── L'ETAGE DES COURBES ────────────────────────────────────────────────────
function _htmlCcdPeriodes(){
  return '<div class="ccd-per" role="group" aria-label="Période de toutes les courbes">'
    +'<span class="cc-corps-vue">'
    +CCD_PERIODES.map(p=>'<button type="button" class="cc-corps-o'
      +((p.j===_ccdPeriode)?' actif':'')+'" aria-pressed="'+((p.j===_ccdPeriode)?'true':'false')
      +'" onclick="ccdPeriode('+p.j+')">'+escapeHtml(p.lib)+'</button>').join('')
    +'</span></div>';
}
// L'ETAGE DES COURBES EST LE TABLEAU DE BORD DE LA MAQUETTE (28/09/2026) :
// voir _htmlCcdTableau. Le nom reste, ses appelants aussi.
function _htmlCcdCourbes(c,largeur){
  return _htmlCcdTableau(c,largeur||_dbLargeur||0);
}
// Ce qui manque pour tracer la masse maigre, dans les memes mots que la carte
// du verdict — une seule facon de nommer une mesure absente.
function _htmlCcdManqueMaigre(u){
  let v=null; try{ v=ccdVerdict(u); }catch(e){ v=null; }
  const m=(v&&v.gras&&v.gras.manque)?v.gras.manque:[];
  return '<p class="ccd-proj ccd-proj-non">'
    +escapeHtml(m.length
      ?('Pas de courbe de masse maigre : il manque '+m.join(', ')+'.')
      :'Pas de courbe de masse maigre : il faut deux bilans qui portent le tour de taille et le tour de cou.')
    +'</p>';
}
// ══ SES COURBES : LE TABLEAU DE BORD DE LA MAQUETTE DE KEVIN (28/09/2026) ═════
//
// « Remplace exactement pareil, répartition pareil » : six cartes, trois rangs.
//   1. Poids et masse grasse  |  Masse maigre et masse grasse
//   2. Mensurations  |  Séries dures par semaine  |  Répartition des séries
//   3. Composition corporelle  |  Rapports clés
//
// ⚠ RIEN N'EST INVENTÉ, ET C'EST LA SEULE LIBERTÉ PRISE AVEC LA MAQUETTE. Elle
//   montre une masse musculaire, des masses osseuse et hydrique, et des kilos
//   gagnés par bras ou par dorsal : aucune de ces mesures n'existe au dossier
//   (il faudrait une balance à impédance segmentaire). La deuxième carte trace
//   donc ce qui se calcule vraiment, masse maigre et masse grasse en kilos, par
//   la formule déjà en place (ccdCompositionSerie) ; la composition par zone
//   montre les TOURS relevés au ruban et les SÉRIES du programme.
// ⚠ UNE SEULE PÉRIODE POUR TOUT L'ÉTAGE (lot 4, 23/09/2026) : les trois cartes
//   qui portent le sélecteur écrivent le même état, _ccdPeriode.
// ⚠ LA MARGE DE MESURE RESTE DESSINÉE autour du poids et de la masse maigre.
// ⚠ AUCUNE COURBE DE POIDS EN MODE NEUTRE (aTCA), comme blocPoidsCoach.

const DB_MOIS=['Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.'];
// Les groupes de la répartition et des séries, dans l'ordre de la maquette.
const DB_GROUPES=Object.freeze([
  {cle:'pec',lib:'Pectoraux',c:'#ef4444',m:['PECTORAUX'],img:'PECTORAUX'},
  {cle:'dos',lib:'Dorsaux',c:'#3b82f6',m:['DORSAUX','TRAP_SUP','TRAP_MED','LOMBAIRES'],img:'DORSAUX'},
  {cle:'jam',lib:'Jambes',c:'#22c55e',m:['QUADRICEPS','ISCHIOS','FESSIERS','ABDUCTEURS','ADDUCTEURS','MOLLETS'],img:'QUADRICEPS'},
  {cle:'epa',lib:'Épaules',c:'#eab308',m:['DELT_ANT','DELT_LAT','DELT_POST'],img:'DELT_LAT'},
  {cle:'bra',lib:'Bras',c:'#a855f7',m:['BICEPS','TRICEPS','AVANT_BRAS'],img:'BICEPS'},
  {cle:'abd',lib:'Abdos',c:'#f97316',m:['ABDOS'],img:'ABDOS'}
]);
// Les tours de la carte Mensurations et de la composition, dans l'ordre de la maquette.
const DB_TOURS=Object.freeze([
  {cle:'poitrine',lib:'Poitrine',c:'#3b82f6',k:['chest'],img:'PECTORAUX'},
  {cle:'taille',lib:'Taille',c:'#ef4444',k:['waist'],img:'ABDOS'},
  {cle:'hanches',lib:'Hanches',c:'#f59e0b',k:['hips'],img:'FESSIERS'},
  {cle:'cuisses',lib:'Cuisses',c:'#22c55e',k:['thigh-r','thigh-l'],img:'QUADRICEPS'},
  {cle:'bras',lib:'Bras',c:'#a855f7',k:['bicep-r','bicep-l'],img:'BICEPS'}
]);
let _dbUnite='cm', _dbZone='tours', _dbRef='precedent', _dbLargeur=0, _dbClient=null;
const _dbDonnees={};

// ── LES DONNÉES (PURES, sauf mention) ──────────────────────────────────────
function _dbNb(v,d){
  if(v==null||!isFinite(v)) return '';
  const k=Math.pow(10,d==null?1:d);
  return String(Math.round(v*k)/k).replace('.',',');
}
function _dbSigne(v,d){ return (v>0?'+':v<0?'−':'')+_dbNb(Math.abs(v),d); }
// La moyenne des deux côtés quand les deux sont relevés, sinon le côté relevé.
function _dbTourBilan(b,k){
  const vals=k.map(x=>{ let v=null; try{ v=getBM(b,x); }catch(e){ v=null; } return v>0?v:null; }).filter(v=>v!=null);
  if(!vals.length) return null;
  return Math.round(vals.reduce((a,v)=>a+v,0)/vals.length*10)/10;
}
function dbPointsTour(u,t){
  let bl=[]; try{ bl=bilansOrdonnes(u)||[]; }catch(e){ return []; }
  const out=[];
  for(const b of bl){
    let rep=false; try{ rep=t.k.every(x=>bmReportee(b,x)); }catch(e){ rep=false; }
    if(rep) continue;
    const v=_dbTourBilan(b,t.k);
    if(v>0) out.push({x:Number(b&&b.date)||0,v});
  }
  return out;
}
function dbTaille(u){
  const t=parseFloat((u&&(u._evol_height||u['init-height']||u.height))||0);
  if(t>0) return t;
  try{ const d=(bilansOrdonnes(u)||[]).find(b=>b&&b.type==='depart'); const v=parseFloat(d&&d['deb-height']); return v>0?v:null; }catch(e){ return null; }
}
// Le poids et le pourcentage de gras, bilan par bilan.
function dbSeriesPoidsGras(u){
  const comp=ccdCompositionSerie(u);
  return {poids:corpsPointsPoids(u), pct:comp.map(c=>({x:c.date,v:c.pct})),
    maigre:comp.map(c=>({x:c.date,v:c.maigre})), gras:comp.map(c=>({x:c.date,v:c.gras}))};
}
// Les séries dures d'un groupe dans une semaine (muscles additionnés).
function _dbSomme(vol,g){ return Math.round(g.m.reduce((a,m)=>a+(Number((vol||{})[m])||0),0)*10)/10; }
/**
 * Les séries dures par groupe, semaine par semaine, datées. IMPURE : horloge.
 * Même règle que corpsCourbesVolume : avec un programme, la semaine en cours
 * est la semaine ENTIÈRE du programme, en pointillé ; sans programme, on
 * s'arrête à la dernière semaine travaillée.
 */
function dbSeriesVolume(u,semaines){
  const N=Math.max(4,Math.min(26,Number(semaines)||CORPS_GRAPHE_SEMAINES));
  let prev=null; try{ prev=corpsSemainePrevue(u); }catch(e){ prev=null; }
  let fin=0, sem=null;
  if(!prev){ try{ sem=corpsSemaineVolume(u); }catch(e){ sem=null; } if(!sem) return null; fin=sem.decalage||0; }
  else fin=1;
  const lundi0=(()=>{ try{ return new Date(_lundiDeSemaine(_volCleDecalee(0))).getTime(); }catch(e){ const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d.getTime(); } })();
  const semaine=[];
  const nPasses=prev?N-1:N;
  for(let i=fin+nPasses-1;i>=fin;i--){
    let vol={}; try{ vol=volumeSemaine(u,_volCleDecalee(i))||{}; }catch(e){ vol={}; }
    semaine.push({x:lundi0-i*6048e5,vol});
  }
  if(prev) semaine.push({x:lundi0,vol:prev.muscles,prevu:true});
  // PAS DE SEMAINES VIDES AVANT LA PREMIERE SEANCE : sur « Tout », vingt
  // semaines a zero ecrasaient les huit qui comptent.
  const tot=s=>DB_GROUPES.reduce((a,g)=>a+_dbSomme(s.vol,g),0);
  while(semaine.length>4&&!semaine[0].prevu&&tot(semaine[0])===0) semaine.shift();
  const series=DB_GROUPES.map(g=>({lib:g.lib,couleur:g.c,cle:g.cle,
    points:semaine.map(s=>Object.assign({x:s.x,v:_dbSomme(s.vol,g)},s.prevu?{prevu:true}:{}))}))
    .filter(s=>s.points.some(p=>p.v>0));
  if(!series.length) return null;
  // Les quatre groupes les plus chargés sur la période : au-delà, une pelote.
  series.sort((a,b)=>b.points.reduce((t,p)=>t+p.v,0)-a.points.reduce((t,p)=>t+p.v,0));
  return {series:series.slice(0,4),prevu:!!prev,semaines:N,
    ref:prev?{muscles:prev.muscles,lib:'la semaine du programme'}:{muscles:(semaine[semaine.length-1]||{}).vol||{},lib:'la dernière semaine travaillée'}};
}
// La répartition de la semaine de référence, par groupe (+ « Autres »).
function dbRepartition(muscles){
  const m=muscles||{};
  const groupes=DB_GROUPES.map(g=>({lib:g.lib,c:g.c,n:_dbSomme(m,g)}));
  const pris=new Set(DB_GROUPES.flatMap(g=>g.m));
  const autres=Math.round(Object.keys(m).filter(k=>!pris.has(k)).reduce((a,k)=>a+(Number(m[k])||0),0)*10)/10;
  if(autres>0) groupes.push({lib:'Autres',c:'#9ca3af',n:autres});
  const total=Math.round(groupes.reduce((a,g)=>a+g.n,0)*10)/10;
  if(!(total>0)) return null;
  return {total,groupes:groupes.filter(g=>g.n>0).map(g=>Object.assign(g,{pct:Math.round(g.n/total*100)}))};
}
// Les rapports clés : la dernière valeur de chaque mesure, et son écart à la
// précédente (« Dernière mesure ») ou à la première (« Depuis le début »).
function dbRapports(u,ref){
  let bl=[]; try{ bl=bilansOrdonnes(u)||[]; }catch(e){ bl=[]; }
  const taille=dbTaille(u);
  const comp=ccdCompositionSerie(u);
  const parDate=d=>comp.find(c=>c.date===d)||null;
  const sexe=(u&&(u._evol_gender||u.gender))||'';
  let age=null;
  try{ const d=bl.find(b=>b&&b.type==='depart'); age=parseFloat((u&&u.age)||(d&&d['deb-age']))||null; }catch(e){ age=null; }
  const lire={
    imc:b=>{ const p=getBW(b); return (p>0&&taille)?p/Math.pow(taille/100,2):null; },
    th:b=>{ const w=getBM(b,'waist'), h=getBM(b,'hips'); return (w>0&&h>0)?w/h:null; },
    bras:b=>_dbTourBilan(b,['bicep-r','bicep-l']),
    cuisse:b=>_dbTourBilan(b,['thigh-r','thigh-l']),
    maigre:b=>{ const c=parDate(Number(b.date)||0); return c?(c.maigre/c.poids*100):null; },
    mb:b=>{ const c=parDate(Number(b.date)||0); if(c) return mbKatch(c.maigre);
      const p=getBW(b); return (p>0&&taille&&age)?mbEstime(p,taille,age,sexe,u):null; }
  };
  const defs=[
    {cle:'imc',lib:'IMC',unite:'',d:1},
    {cle:'th',lib:'Tour de taille / hanches',unite:'',d:2},
    {cle:'bras',lib:'Tour de bras',unite:' cm',d:1},
    {cle:'cuisse',lib:'Tour de cuisse',unite:' cm',d:1},
    {cle:'maigre',lib:'Ratio masse maigre',unite:' %',d:1},
    {cle:'mb',lib:'Métabolisme estimé',unite:' kcal',d:0}];
  return defs.map(df=>{
    const vals=bl.map(b=>{ let v=null; try{ v=lire[df.cle](b); }catch(e){ v=null; } return v; }).filter(v=>v!=null&&isFinite(v));
    const der=vals.length?vals[vals.length-1]:null;
    const base=vals.length>1?(ref==='debut'?vals[0]:vals[vals.length-2]):null;
    return Object.assign({},df,{valeur:der,ecart:(der!=null&&base!=null)?der-base:null,
      formule:df.cle==='mb'?(comp.length?'Katch-McArdle':MB_NOMS[mbFormuleDe(u)]):''});
  });
}
// La composition par zone. `tours` : l'écart du ruban depuis la première
// mesure. `series` : la charge de la semaine de référence et sa part.
function dbZones(u,mode,ref){
  if(mode==='series'){
    const r=dbRepartition(ref||{});
    return DB_GROUPES.filter(g=>g.cle!=='abd').map(g=>{
      const n=_dbSomme(ref||{},g);
      return {lib:g.lib,img:g.img,valeur:n,unite:'séries',part:r?(n/r.total):0,pct:r?Math.round(n/r.total*100):0};
    });
  }
  return DB_TOURS.map(t=>{
    const p=dbPointsTour(u,t);
    if(p.length<2) return {lib:t.lib,img:t.img,valeur:null};
    const e=Math.round((p[p.length-1].v-p[0].v)*10)/10;
    return {lib:t.lib,img:t.img,valeur:e,unite:'cm',pct:p[0].v?Math.round(e/p[0].v*1000)/10:0};
  });
}

// ── LE MOTEUR DE COURBE (PUR) ──────────────────────────────────────────────
// Interpolation monotone (Fritsch-Carlson) : la courbe passe par chaque point
// et ne dessine jamais un creux ou une bosse que les mesures n'ont pas.
function _dbLisse(pts){
  const n=pts.length;
  if(n<2) return n?('M'+pts[0][0]+','+pts[0][1]):'';
  if(n===2) return 'M'+pts[0][0]+','+pts[0][1]+'L'+pts[1][0]+','+pts[1][1];
  const dx=[],dy=[],m=[],t=[];
  for(let i=0;i<n-1;i++){ dx[i]=pts[i+1][0]-pts[i][0]; dy[i]=pts[i+1][1]-pts[i][1]; m[i]=dx[i]?dy[i]/dx[i]:0; }
  t[0]=m[0]; t[n-1]=m[n-2];
  for(let i=1;i<n-1;i++) t[i]=(m[i-1]*m[i]<=0)?0:(m[i-1]+m[i])/2;
  for(let i=0;i<n-1;i++){
    if(m[i]===0){ t[i]=0; t[i+1]=0; continue; }
    const a=t[i]/m[i], b=t[i+1]/m[i], s=a*a+b*b;
    if(s>9){ const k=3/Math.sqrt(s); t[i]=k*a*m[i]; t[i+1]=k*b*m[i]; }
  }
  const f=v=>Math.round(v*10)/10;
  let d='M'+f(pts[0][0])+','+f(pts[0][1]);
  for(let i=0;i<n-1;i++){
    const h=dx[i]/3;
    d+='C'+f(pts[i][0]+h)+','+f(pts[i][1]+t[i]*h)+' '+f(pts[i+1][0]-h)+','+f(pts[i+1][1]-t[i+1]*h)+' '+f(pts[i+1][0])+','+f(pts[i+1][1]);
  }
  return d;
}
function _dbPas(etendue,cible){
  const brut=etendue/Math.max(1,cible), p=Math.pow(10,Math.floor(Math.log10(brut||1)));
  for(const k of [1,2,2.5,5,10]) if(brut<=k*p) return k*p;
  return 10*p;
}
function _dbAxe(vals,bande,forcer){
  let lo=Math.min(...vals.map(v=>v-(bande||0))), hi=Math.max(...vals.map(v=>v+(bande||0)));
  if(forcer&&forcer.min!=null) lo=Math.min(lo,forcer.min);
  if(!(hi>lo)){ lo-=1; hi+=1; }
  const pas=_dbPas(hi-lo,4);
  lo=Math.floor(lo/pas)*pas; hi=Math.ceil(hi/pas)*pas;
  if(hi===lo) hi=lo+pas;
  const ticks=[]; for(let v=lo;v<=hi+pas/1000;v+=pas) ticks.push(Math.round(v*1000)/1000);
  return {lo,hi,ticks};
}
function _dbTicksX(x0,x1,largeur){
  const J=864e5, jours=(x1-x0)/J, out=[];
  if(jours<=75){
    const n=Math.max(2,Math.min(6,Math.floor(largeur/80)));
    for(let i=0;i<=n;i++){ const x=x0+(x1-x0)*i/n, d=new Date(x); out.push({x,lib:String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')}); }
    return out;
  }
  const mois=[]; const d=new Date(x0); d.setDate(1); d.setHours(0,0,0,0); d.setMonth(d.getMonth()+1);
  while(d.getTime()<=x1){ mois.push(d.getTime()); d.setMonth(d.getMonth()+1); }
  const pas=Math.max(1,Math.ceil(mois.length/Math.max(2,Math.floor(largeur/70))));
  mois.forEach((x,i)=>{ if(i%pas===0) out.push({x,lib:DB_MOIS[new Date(x).getMonth()]}); });
  return out;
}
/**
 * Une courbe complète : grille, axes, aires dégradées, traits lissés, points,
 * bande de marge, et la zone de survol qui porte l'info-bulle.
 * @param {{id:string,W:number,H:number,series:Array,axeD?:boolean,fmtG?:Function,fmtD?:Function,repere?:boolean,minG?:number}} o
 */
function _dbCourbe(o){
  const S=(o.series||[]).filter(s=>s&&s.points&&s.points.length);
  if(!S.length) return '';
  const W=Math.max(220,Math.round(o.W)), H=o.H||170;
  const aD=S.some(s=>s.axe==='d');
  const pg=38, pd=aD?42:12, ph=10, pb=24;
  const xs=[...new Set(S.flatMap(s=>s.points.map(p=>p.x)))].sort((a,b)=>a-b);
  let x0=xs[0], x1=xs[xs.length-1]; if(x1===x0){ x0-=864e5; x1+=864e5; }
  const sx=x=>pg+(x-x0)/(x1-x0)*(W-pg-pd);
  const axe=cote=>{ const l=S.filter(s=>(s.axe||'g')===cote); if(!l.length) return null;
    return _dbAxe(l.flatMap(s=>s.points.map(p=>p.v)),Math.max(0,...l.map(s=>s.bande||0)),cote==='g'&&o.minG!=null?{min:o.minG}:null); };
  const A={g:axe('g'),d:axe('d')};
  const sy=(v,cote)=>{ const a=A[cote]||A.g; return ph+(1-(v-a.lo)/(a.hi-a.lo))*(H-ph-pb); };
  const fG=o.fmtG||(v=>_dbNb(v,0)), fD=o.fmtD||(v=>_dbNb(v,0)+' %');
  let g='';
  const aG=A.g||A.d;
  for(const t of aG.ticks){ const y=sy(t,A.g?'g':'d');
    g+='<line x1="'+pg+'" x2="'+(W-pd)+'" y1="'+y+'" y2="'+y+'" class="db-grille-l"/>'
      +'<text x="'+(pg-8)+'" y="'+(y+4)+'" text-anchor="end" class="db-ax">'+escapeHtml(A.g?fG(t):fD(t))+'</text>'; }
  if(A.g&&A.d) for(const t of A.d.ticks){ const y=sy(t,'d');
    g+='<text x="'+(W-pd+8)+'" y="'+(y+4)+'" class="db-ax">'+escapeHtml(fD(t))+'</text>'; }
  for(const t of _dbTicksX(x0,x1,W-pg-pd)){
    const X=sx(t.x), ancre=X>W-pd-22?'end':(X<pg+22?'start':'middle');
    g+='<text x="'+X+'" y="'+(H-6)+'" text-anchor="'+ancre+'" class="db-ax">'+escapeHtml(t.lib)+'</text>';
  }
  let defs='', aires='', bandes='', traits='', points='';
  S.forEach((s,i)=>{
    const c=escapeHtml(s.couleur), cote=s.axe||'g';
    const reels=s.points.filter(p=>!p.prevu), prevus=s.points.filter(p=>p.prevu);
    const pts=reels.map(p=>[sx(p.x),sy(p.v,cote)]);
    const gid=o.id+'-g'+i;
    defs+='<linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+c+'" stop-opacity="'+(s.aire===false?0:.32)+'"/><stop offset="1" stop-color="'+c+'" stop-opacity="0"/></linearGradient>';
    if(pts.length>1&&s.aire!==false){
      const bas=H-pb;
      aires+='<path d="'+_dbLisse(pts)+'L'+pts[pts.length-1][0]+','+bas+'L'+pts[0][0]+','+bas+'Z" fill="url(#'+gid+')"/>';
    }
    if(s.bande&&pts.length>1){
      const haut=reels.map(p=>[sx(p.x),sy(p.v+s.bande,cote)]), bas=reels.map(p=>[sx(p.x),sy(p.v-s.bande,cote)]).reverse();
      bandes+='<path d="'+_dbLisse(haut)+'L'+bas.map(q=>q[0]+','+q[1]).join('L')+'Z" class="db-bande"/>';
    }
    if(pts.length>1) traits+='<path d="'+_dbLisse(pts)+'" fill="none" stroke="'+c+'" stroke-width="2.4" stroke-linecap="round" style="filter:drop-shadow(0 0 4px '+c+')"/>';
    if(prevus.length&&pts.length){ const q=prevus[prevus.length-1];
      traits+='<path d="M'+pts[pts.length-1][0]+','+pts[pts.length-1][1]+'L'+sx(q.x)+','+sy(q.v,cote)+'" fill="none" stroke="'+c+'" stroke-width="2.2" stroke-dasharray="5 4"/>'; }
    pts.forEach((q,j)=>{ const der=j===pts.length-1&&!prevus.length;
      points+='<circle cx="'+q[0]+'" cy="'+q[1]+'" r="'+(der?4.5:3)+'" fill="'+c+'" stroke="#0b0b0b" stroke-width="1.2"'+(der?' style="filter:drop-shadow(0 0 5px '+c+')"':'')+'/>'; });
  });
  const repere=o.repere?'<line x1="'+sx(x1)+'" x2="'+sx(x1)+'" y1="'+ph+'" y2="'+(H-pb)+'" class="db-repere"/>':'';
  // L'info-bulle lit ces lignes : une par date, les valeurs de chaque série.
  _dbDonnees[o.id]={W,H,pg,pd,ph,pb,xs:xs.map(x=>sx(x)),dates:xs,
    lignes:xs.map(x=>S.map(s=>{ const p=s.points.find(q=>q.x===x); return p?{lib:s.lib,c:s.couleur,v:p.v,prevu:!!p.prevu,fmt:s.fmt}:null; }).filter(Boolean)),
    semaine:!!o.semaine};
  return '<div class="db-zone-g" id="'+escapeHtml(o.id)+'"><svg class="db-svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+escapeHtml(o.titre||'Courbe')+'">'
    +'<defs>'+defs+'</defs>'+g+bandes+aires+repere+traits+points
    +'<line class="db-curseur" x1="0" x2="0" y1="'+ph+'" y2="'+(H-pb)+'" style="display:none"/>'
    +'<rect x="'+pg+'" y="0" width="'+(W-pg-pd)+'" height="'+(H-pb)+'" fill="transparent" onpointermove="dbSurvol(event,\''+escapeHtml(o.id)+'\')" onpointerdown="dbSurvol(event,\''+escapeHtml(o.id)+'\')" onpointerleave="dbQuitter(\''+escapeHtml(o.id)+'\')"/>'
    +'</svg><div class="db-bulle" style="display:none"></div></div>';
}
function dbSurvol(ev,id){
  const d=_dbDonnees[id], z=document.getElementById(id);
  if(!d||!z) return;
  const svg=z.querySelector('svg'), r=svg.getBoundingClientRect();
  const x=(ev.clientX-r.left)*(d.W/(r.width||d.W));
  let i=0, best=Infinity; d.xs.forEach((v,k)=>{ const e=Math.abs(v-x); if(e<best){ best=e; i=k; } });
  const l=z.querySelector('.db-curseur'); l.setAttribute('x1',d.xs[i]); l.setAttribute('x2',d.xs[i]); l.style.display='';
  const b=z.querySelector('.db-bulle');
  const dt=new Date(d.dates[i]);
  const tete=(d.semaine?'Semaine du ':'')+String(dt.getDate()).padStart(2,'0')+'/'+String(dt.getMonth()+1).padStart(2,'0')+'/'+dt.getFullYear();
  b.innerHTML='<b>'+escapeHtml(tete)+'</b>'+d.lignes[i].map(p=>'<span><i style="background:'+escapeHtml(p.c)+'"></i>'
    +escapeHtml(p.lib)+' : '+escapeHtml(p.fmt?p.fmt(p.v):_dbNb(p.v,1))+(p.prevu?' (prévu)':'')+'</span>').join('');
  b.style.display='block';
  const px=d.xs[i]*(r.width/d.W);
  const bw=b.offsetWidth||150;
  b.style.left=Math.max(0,Math.min((r.width-bw),px+(px>r.width/2?-bw-12:12)))+'px';
  b.style.top='6px';
}
function dbQuitter(id){
  const z=document.getElementById(id); if(!z) return;
  const l=z.querySelector('.db-curseur'), b=z.querySelector('.db-bulle');
  if(l) l.style.display='none'; if(b) b.style.display='none';
}

// ── LES CARTES ─────────────────────────────────────────────────────────────
function _dbInfo(cle,texte){
  return '<button type="button" class="db-i" aria-label="Explication" aria-expanded="false" onclick="dbInfo(this)">i</button>'
    +'<p class="db-info" hidden>'+escapeHtml(texte)+'</p>';
}
function dbInfo(b){
  const p=b&&b.closest('.db-carte')&&b.closest('.db-carte').querySelector('.db-info');
  if(!p) return;
  p.hidden=!p.hidden; b.setAttribute('aria-expanded',String(!p.hidden));
}
function _dbPeriodes(){
  const L={182:'6M',365:'1 an',0:'Tout'};
  return '<span class="db-seg" role="group" aria-label="Période">'
    +CCD_PERIODES.map(p=>'<button type="button" class="'+(p.j===_ccdPeriode?'actif':'')+'" aria-pressed="'+(p.j===_ccdPeriode)+'" onclick="ccdPeriode('+p.j+')">'+escapeHtml(L[p.j]||p.lib)+'</button>').join('')+'</span>';
}
function _dbCarte(cls,titre,info,droite,corps){
  return '<section class="db-carte '+cls+'"><div class="db-tete"><h4 class="db-titre">'+escapeHtml(titre)+(info?' '+info:'')+'</h4>'+(droite||'')+'</div>'+corps+'</section>';
}
function _dbLegende(series){
  return '<div class="db-leg">'+series.map(s=>'<span><i style="background:'+escapeHtml(s.couleur)+';color:'+escapeHtml(s.couleur)+'"></i>'+escapeHtml(s.lib)+'</span>').join('')+'</div>';
}
function _dbVide(t){ return '<p class="db-vide">'+escapeHtml(t)+'</p>'; }

function _dbCartePoids(u,W,neutre){
  const info=_dbInfo('pg','Poids relevé au bilan (axe de gauche) et masse grasse estimée par la formule de la Navy à partir des tours de taille, de cou'
    +' et de hanches (axe de droite). La bande grise autour du poids est la marge de la balance : ± '+String(SYN_BRUIT_POIDS).replace('.',',')+' kg.');
  if(neutre) return _dbCarte('db-c-pg','Poids et masse grasse',info,'',_dbVide('Courbe de poids masquée : un antécédent est déclaré au questionnaire de départ.'));
  const s=dbSeriesPoidsGras(u);
  const series=[{lib:'Poids (kg)',couleur:'#ef4444',points:ccdFenetre(s.poids),bande:SYN_BRUIT_POIDS,fmt:v=>_dbNb(v,1)+' kg'}];
  const pct=ccdFenetre(s.pct);
  if(pct.length) series.push({lib:'Masse grasse (%)',couleur:'#3b82f6',points:pct,axe:'d',fmt:v=>_dbNb(v,1)+' %'});
  const c=_dbCourbe({id:'db-pg',titre:'Poids et masse grasse',W,H:180,series,repere:true,fmtD:v=>_dbNb(v,0)+'%'});
  let proj=''; try{ proj=_htmlCcdProjection(u)||''; }catch(e){ proj=''; }
  return _dbCarte('db-c-pg','Poids et masse grasse',info,_dbPeriodes(),
    c?(_dbLegende(series)+c+(pct.length?'':_htmlCcdManqueMaigre(u).replace('Pas de courbe de masse maigre','Pas de courbe de masse grasse'))+proj):_dbVide('Rien à tracer sur cette période : il faut deux bilans avec un poids.'));
}
function _dbCarteMasses(u,W,neutre){
  const info=_dbInfo('mm','Masse maigre (tout ce qui n’est pas du gras : muscles, os, eau, organes) et masse grasse, en kilos, par la même formule que la carte voisine.'
    +' La masse musculaire seule ne se mesure qu’avec une balance à impédance : on ne l’invente pas. Marge de la masse maigre : ± '+String(CCD_MAIGRE_BRUIT).replace('.',',')+' kg.');
  if(neutre) return _dbCarte('db-c-mm','Masse maigre et masse grasse',info,'',_dbVide('Masquée pour la même raison que le poids.'));
  const s=dbSeriesPoidsGras(u);
  const maigre=ccdFenetre(s.maigre), gras=ccdFenetre(s.gras);
  if(maigre.length<2) return _dbCarte('db-c-mm','Masse maigre et masse grasse',info,_dbPeriodes(),_htmlCcdManqueMaigre(u));
  const series=[{lib:'Masse grasse (kg)',couleur:'#22c55e',points:gras,fmt:v=>_dbNb(v,1)+' kg'},
    {lib:'Masse maigre (kg)',couleur:'#a855f7',points:maigre,bande:CCD_MAIGRE_BRUIT,fmt:v=>_dbNb(v,1)+' kg'}];
  return _dbCarte('db-c-mm','Masse maigre et masse grasse',info,_dbPeriodes(),
    _dbLegende(series)+_dbCourbe({id:'db-mm',titre:'Masse maigre et masse grasse',W,H:180,series,minG:0}));
}
function _dbCarteMens(u,W){
  const info=_dbInfo('me','Tours relevés au ruban à chaque bilan. Cuisses et bras : moyenne des deux côtés. Marge du ruban : ± '+String(SYN_BRUIT_MESURE).replace('.',',')+' cm.');
  const k=_dbUnite==='in'?1/2.54:1, u2=_dbUnite==='in'?' in':' cm';
  const series=DB_TOURS.map(t=>({lib:t.lib,couleur:t.c,points:ccdFenetre(dbPointsTour(u,t)).map(p=>({x:p.x,v:Math.round(p.v*k*10)/10})),aire:false,fmt:v=>_dbNb(v,1)+u2}))
    .filter(s=>s.points.length);
  const seg='<span class="db-seg" role="group" aria-label="Unité"><button type="button" class="'+(_dbUnite==='cm'?'actif':'')+'" onclick="dbUnite(\'cm\')">cm</button><button type="button" class="'+(_dbUnite==='in'?'actif':'')+'" onclick="dbUnite(\'in\')">inch</button></span>';
  if(!series.some(s=>s.points.length>1)) return _dbCarte('db-c-me','Mensurations',info,seg,_dbVide('Il faut deux bilans avec un même tour pour tracer une courbe.'));
  return _dbCarte('db-c-me','Mensurations',info,seg,_dbLegende(series)+_dbCourbe({id:'db-me',titre:'Mensurations',W,H:150,series}));
}
function _dbCarteSeries(u,W,v){
  const info=_dbInfo('sd','Séries dures par semaine et par groupe musculaire (un muscle secondaire compte une demi-série). Les quatre groupes les plus chargés.'
    +(v&&v.prevu?' La dernière semaine, en pointillé, est la semaine entière telle que le programme la prévoit, pas son avancée.':''));
  if(!v) return _dbCarte('db-c-sd','Séries dures par semaine',info,_dbPeriodes(),_dbVide('Aucune séance ni programme à compter pour l’instant.'));
  const series=v.series.map(s=>Object.assign({},s,{aire:true,fmt:x=>_dbNb(x,1)+' séries'}));
  return _dbCarte('db-c-sd','Séries dures par semaine',info,_dbPeriodes(),
    _dbLegende(series)+_dbCourbe({id:'db-sd',titre:'Séries dures par semaine',W,H:150,series,minG:0,semaine:true}));
}
function _dbCarteRepartition(v){
  const info=_dbInfo('rp','Répartition des séries dures de '+(v?v.ref.lib:'la semaine')+' entre les groupes musculaires.');
  const r=v?dbRepartition(v.ref.muscles):null;
  if(!r) return _dbCarte('db-c-rp','Répartition des séries',info,'',_dbVide('Rien à répartir pour l’instant.'));
  const R=54, C=2*Math.PI*R; let acc=0;
  const arcs=r.groupes.map(g=>{ const l=g.n/r.total*C, gap=r.groupes.length>1?2:0;
    const a='<circle cx="70" cy="70" r="'+R+'" fill="none" stroke="'+escapeHtml(g.c)+'" stroke-width="20" stroke-dasharray="'+Math.max(0,l-gap)+' '+(C-Math.max(0,l-gap))+'" stroke-dashoffset="'+(-acc)+'" transform="rotate(-90 70 70)"/>';
    acc+=l; return a; }).join('');
  const donut='<svg class="db-donut" viewBox="0 0 140 140" role="img" aria-label="Répartition des séries"><circle cx="70" cy="70" r="'+R+'" fill="none" stroke="#1a1a1a" stroke-width="20"/>'+arcs
    +'<text x="70" y="70" text-anchor="middle" class="db-don-n">'+escapeHtml(_dbNb(r.total,1))+'</text><text x="70" y="88" text-anchor="middle" class="db-don-s">séries / sem.</text></svg>';
  const leg='<ul class="db-rleg">'+r.groupes.map(g=>'<li><i style="background:'+escapeHtml(g.c)+'"></i><span>'+escapeHtml(g.lib)+'</span><b>'+g.pct+'%</b><em>('+escapeHtml(_dbNb(g.n,1))+')</em></li>').join('')+'</ul>';
  return _dbCarte('db-c-rp','Répartition des séries',info,'','<div class="db-rep">'+donut+leg+'</div>');
}
function _dbCarteZones(u,v){
  const info=_dbInfo('cz','Tours : l’écart du ruban depuis la première mesure, zone par zone ; la couleur dit le sens de la mesure, jamais un jugement. '
    +'Séries : la charge de '+(v?v.ref.lib:'la semaine')+' par zone et sa part du total. Les masses par zone demanderaient une balance à impédance segmentaire.');
  const seg='<span class="db-seg db-seg-l" role="group" aria-label="Lecture"><button type="button" class="'+(_dbZone==='tours'?'actif':'')+'" onclick="dbZone(\'tours\')">Tours</button><button type="button" class="'+(_dbZone==='series'?'actif':'')+'" onclick="dbZone(\'series\')">Séries</button></span>';
  const z=dbZones(u,_dbZone,v?v.ref.muscles:null);
  const max=Math.max(0.0001,...z.map(x=>Math.abs(x.valeur||0)));
  const tuiles=z.map(x=>{
    const img=_volIllus(x.img);
    const vide=x.valeur==null;
    const val=vide?'':(_dbZone==='series'?_dbNb(x.valeur,1)+' séries':_dbSigne(x.valeur,1)+' cm');
    const part=_dbZone==='series'?(x.part||0):(Math.abs(x.valeur||0)/max);
    const coul=_dbZone==='series'?'#ef4444':((x.valeur||0)>=0?'#22c55e':'#ef4444');
    const sous=vide?'':(_dbZone==='series'?(x.pct+' % du total'):(_dbSigne(x.pct,1)+' %'));
    return '<div class="db-tz">'+(img?'<img src="'+img+'" alt="">':'<span class="db-tz-i"></span>')
      +'<div class="db-tz-c"><b class="db-tz-n">'+escapeHtml(x.lib)+'</b>'
      +(vide?'<span class="db-tz-v db-tz-vide">pas deux mesures</span>':'<span class="db-tz-v" style="color:'+coul+'">'+escapeHtml(val)+'</span>'
        +'<span class="db-tz-b"><i style="width:'+Math.round(part*100)+'%;background:'+coul+'"></i></span><span class="db-tz-p" style="color:'+coul+'">'+escapeHtml(sous)+'</span>')
      +'</div></div>';
  }).join('');
  return _dbCarte('db-c-cz','Composition corporelle',info,seg,'<div class="db-tzs">'+tuiles+'</div>');
}
const DB_ICONES={
  imc:'<path d="M5 20h14M7 20V9h10v11M9 9V6a3 3 0 0 1 6 0v3"/>',
  th:'<path d="M8 3c0 5 2 6 2 9s-2 4-2 9M16 3c0 5-2 6-2 9s2 4 2 9M7 12h10"/>',
  bras:'<path d="M4 16c3-1 5-4 6-8 1-2 3-3 5-2 2 1 2 4 0 5-2 1-3 2-3 4 0 3 4 3 8 3"/>',
  cuisse:'<path d="M9 3c-1 6-2 10-1 18M15 3c1 6 1 10 0 18M8 12h8"/>',
  maigre:'<circle cx="12" cy="5" r="2"/><path d="M12 7v7m0 0-3 7m3-7 3 7M7 10h10"/>',
  mb:'<path d="M12 21c4 0 6-3 6-6 0-4-3-5-3-9-2 2-3 3-3 5-1-1-2-2-2-4-2 2-4 5-4 8 0 3 2 6 6 6z"/>'
};
function _dbCarteRapports(u,neutre){
  const info=_dbInfo('rk','IMC : poids / taille². Ratio taille / hanches : tour de taille divisé par tour de hanches. Ratio masse maigre : part du poids qui n’est pas du gras. '
    +'Métabolisme : dépense au repos, par Katch-McArdle (masse maigre) ou, à défaut, la formule retenue pour ce dossier (Harris-Benedict ou Mifflin-St Jeor). Écarts comparés à la mesure précédente ou à la première.');
  const sel='<select class="db-sel" onchange="dbRapportRef(this.value)" aria-label="Comparer à"><option value="precedent"'+(_dbRef==='precedent'?' selected':'')+'>Dernière mesure</option><option value="debut"'+(_dbRef==='debut'?' selected':'')+'>Depuis le début</option></select>';
  const masquer=new Set(neutre?['imc','maigre','mb']:[]);
  const t=dbRapports(u,_dbRef).filter(r=>!masquer.has(r.cle)).map(r=>{
    const vide=r.valeur==null;
    return '<div class="db-rk"><svg class="db-rk-i" viewBox="0 0 24 24" aria-hidden="true">'+DB_ICONES[r.cle]+'</svg><div>'
      +'<span class="db-rk-l">'+escapeHtml(r.lib)+'</span>'
      +'<b class="db-rk-v">'+(vide?'<span class="db-rk-vide">à mesurer</span>':escapeHtml(_dbNb(r.valeur,r.d)+r.unite))+'</b>'
      +(r.ecart!=null?'<span class="db-rk-e">'+(Math.abs(r.ecart)<Math.pow(10,-r.d)/2?'stable':((r.ecart>0?'↑ ':'↓ ')+escapeHtml(_dbSigne(r.ecart,r.d))))+'</span>':'')
      +'</div></div>';
  }).join('');
  return _dbCarte('db-c-rk','Rapports clés',info,sel,'<div class="db-rks">'+t+'</div>');
}
// Les réglages de l'étage : chacun redessine l'étage entier.
function _dbRedessiner(){
  try{ const c=getOwnedClient(currentClientId); if(c) renderCourbesCoach(c); }catch(e){}
}
function dbUnite(v){ _dbUnite=(v==='in')?'in':'cm'; _dbRedessiner(); return _dbUnite; }
function dbZone(v){ _dbZone=(v==='series')?'series':'tours'; _dbRedessiner(); return _dbZone; }
function dbRapportRef(v){ _dbRef=(v==='debut')?'debut':'precedent'; _dbRedessiner(); return _dbRef; }

/**
 * L'étage entier. `largeur` est celle du conteneur : les courbes sont
 * dessinées à leur taille réelle, pixel pour pixel, pour que les textes des
 * axes gardent leur taille sur téléphone comme sur ordinateur.
 */
function _htmlCcdTableau(c,largeur){
  const u=_dossier(c);
  if(!u) return '';
  if(c&&c._fromCode) return '';
  try{ if(!phpDisponible(u)) return ''; }catch(e){}
  let neutre=false; try{ neutre=aTCA(u); }catch(e){ neutre=false; }
  const L=Math.max(300,Number(largeur)||1100);
  const cols=L>=900?3:(L>=640?2:1);
  const gap=14, pad=36;
  // La largeur utile de chaque courbe : celle de sa carte, moins ses marges.
  const w1=Math.floor(cols===1?L:(L-gap)/2)-pad;
  const w2=Math.floor(cols===3?(L-2*gap)*1.3/3.6:(cols===2?(L-gap)/2:L))-pad;
  let v=null; try{ v=dbSeriesVolume(u,_ccdPeriode?Math.round(_ccdPeriode/7):26); }catch(e){ v=null; }
  const r1=_dbCartePoids(u,w1,neutre)+_dbCarteMasses(u,w1,neutre);
  const r2=_dbCarteMens(u,w2)+_dbCarteSeries(u,w2,v)+_dbCarteRepartition(v);
  const r3=_dbCarteZones(u,v)+_dbCarteRapports(u,neutre);
  // LOT T6 : les amplitudes, dans la même forme, seulement quand un test existe.
  let r4=''; try{ r4=_dbCarteAmplitudes(u,w1); }catch(e){ r4=''; }
  // LA TROISIEME RANGEE A COTE A COTE SEULEMENT QUAND ELLE Y TIENT : cinq zones
  // et six rapports dans deux demi-cartes de 470 px coupaient leurs chiffres.
  return '<div class="db" data-cols="'+cols+'"'+(L>=1150?' data-large="1"':'')+'>'
    +'<div class="db-rang db-r1">'+r1+'</div>'
    +'<div class="db-rang db-r2">'+r2+'</div>'
    +'<div class="db-rang db-r3">'+r3+'</div>'
    +(r4?'<div class="db-rang db-r4">'+r4+'</div>':'')+'</div>';
}

function renderCourbesCoach(c){
  const z=document.getElementById('ccd-courbes');
  if(!z) return false;
  // LES COURBES SONT DESSINEES A LEUR TAILLE REELLE : on mesure le conteneur.
  // Masque (autre vue de la fiche), il mesure 0 : on garde la derniere largeur
  // connue, et l'observateur redessine des qu'il reapparait.
  const l=z.clientWidth||0;
  if(l) _dbLargeur=l;
  let h='';
  try{ h=_htmlCcdCourbes(c,_dbLargeur)||''; }catch(e){ h=''; }
  z.innerHTML=h;
  _dbSuivreLargeur(z);
  return !!h;
}
function _dbSuivreLargeur(z){
  if(!z||z._dbRO||typeof ResizeObserver!=='function') return;
  z._dbRO=new ResizeObserver(()=>{
    const l=z.clientWidth;
    if(!l||Math.abs(l-_dbLargeur)<40) return;
    _dbLargeur=l;
    try{ const c=getOwnedClient(currentClientId); if(c) z.innerHTML=_htmlCcdCourbes(c,l)||''; }catch(e){}
  });
  z._dbRO.observe(z);
}
