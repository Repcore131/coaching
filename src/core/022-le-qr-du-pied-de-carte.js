// ══ LE QR DU PIED DE CARTE ═══════════════════════════════════════════════
//
// SYNCHRONE, SANS RESEAU, SANS `await`. C'est la contrainte qui commande tout
// le reste : le dessin part d'un clic, et iOS refuse navigator.share des que
// le geste a ete rendu a la boucle d'evenements. Une seule attente — un
// `await`, un `fetch`, un `img.onload` — et le partage echoue sur l'appareil
// ou il sert le plus.
//
// ⚠ ON N'ECRIT PAS UN SECOND ENCODEUR. vendor/qr.js en porte deja un, ecrit
// pour ce depot : mode octet, niveau de correction M, les huit masques
// evalues. Il est LOCAL — servi avec l'application, precache par le service
// worker, aucun tiers, aucun CDN — et RepCoreQR.matrice rend exactement la
// matrice de 0/1 demandee ici. En redessiner un deuxieme donnerait deux
// encodeurs a maintenir pour un seul format de QR, et le jour ou l'un des deux
// se tromperait, c'est l'image partagee qui mentirait.
//
// RIEN NE REMONTE. Un QR absent vaut mieux qu'un clic qui leve : l'appelant
// recoit null et dessine le pied sans lui.
function _qrMatrice(texte){
  try{
    const t=String(texte==null?'':texte).trim();
    if(!t) return null;
    if(typeof window==='undefined'||!window.RepCoreQR||!RepCoreQR.matrice) return null;
    const m=RepCoreQR.matrice(t);
    // Une matrice carree non vide, ou rien. Le texte trop long rend null.
    return (m&&m.length&&m.length===m[0].length)?m:null;
  }catch(e){ return null; }
}
// PURE au sens du dessin : elle lit le dossier, elle n'ecrit rien.
// Le nom affiche au pied de la carte. TROIS SOURCES, DANS L'ORDRE OU ELLES
// sont fiables : le nom que l'athlete voit deja partout dans l'application,
// puis le nom d'equipe publie par le coach, puis — sur l'appareil du coach
// lui-meme, ou il n'y a pas de « coachName » — son propre nom d'equipe.
// Vide quand l'athlete n'a pas de coach : le pied se contente alors de dire
// d'ou vient la carte.
function _nomCoachStory(u){
  const uu=u||currentUser||{};
  let pub=null;
  try{ pub=profilCoachLocal(cleCoachDe(uu)); }catch(e){}
  const c=[uu.coachName,pub&&pub.teamName,(uu.role==='coach')?uu.teamName:'']
    .map(v=>String(v==null?'':v).trim()).find(Boolean);
  return c||'';
}
// Les valeurs de la carte, calculees EXACTEMENT comme _renderWeeklyInto : si
// les deux divergeaient, l athlete partagerait une seance qu il ne voit pas.
function _storyDonnees(){
  const sc=currentUser&&currentUser.sessions_config;
  if(!sc||!sc.length) return null;
  const today=new Date().getDay();
  const todayIdx=today===0?6:today-1;
  let sel=_selDay!=null?_selDay:-1;
  if(sel===-1) sel=sc.findIndex((x,i)=>i===todayIdx&&x.active&&x.exercises&&x.exercises.length);
  if(sel===-1) sel=sc.findIndex(x=>x.active&&x.exercises&&x.exercises.length);
  if(sel<0) return null;
  const selS=sc[sel]||{};
  const nbEx=(selS.active&&selS.exercises&&selS.exercises.length)?selS.exercises.length:0;
  if(!nbEx) return null;                 // un jour de repos ne se poste pas
  return {sel,todayIdx,sc,
    // LE PIED DE CARTE SE CALCULE ICI, avec le reste. _dessinerStorySeance ne
    // lit aucun dossier : elle prend `d` et dessine. Deux lectures du meme
    // nom — une pour l'apercu, une pour le fichier — finiraient par diverger.
    coach:_nomCoachStory(currentUser),
    titre:(DAYS[sel]||'').toUpperCase()+(selS.name?' : '+selS.name.toUpperCase():''),
    repos:(selS.exercises.map(e=>e.repos).filter(Boolean)[0]||''),
    ex:selS.exercises.slice(0,14).map(e=>({n:String(e.name||'').toUpperCase(),
      d:String(e.series||'')&&String(e.reps||'')?String(e.series)+'×'+String(e.reps):(e.series?e.series+' séries':(e.reps?e.reps+' reps':''))})),
    coupes:Math.max(0,selS.exercises.length-14)};
}
// Le rendu. Toutes les mesures sont en pixels de l image finale, pas en
// unites d ecran : ce dessin ne depend d aucune mise en page.
// PRECHAUFFAGE DES POLICES, lance a l ouverture de l ecran. Attendre
// document.fonts.ready au moment du clic consommait le geste utilisateur et
// faisait refuser navigator.share par iOS. On l attend donc AVANT, et le
// dessin lui-meme ne contient plus aucune attente.
let _storyPolicesPretes=false;
function _prechaufferPolicesStory(){
  if(_storyPolicesPretes) return;
  try{
    if(document.fonts&&document.fonts.ready){
      document.fonts.ready.then(()=>{ _storyPolicesPretes=true; });
    } else { _storyPolicesPretes=true; }
  }catch(e){ _storyPolicesPretes=true; }
}
// SYNCHRONE, et ce n est pas un detail : tout ce qui suit le clic doit
// s executer dans la meme tache, sans quoi le geste utilisateur expire.
// LA CARTE SEULE, SANS FOND. Le canevas fait exactement la taille de la
// carte : pas de fond sombre, pas de halo, pas de signature en dessous. Ce
// qui deborde des coins arrondis reste TRANSPARENT — c est ce que « sans
// fond » veut dire, et c est ce qui permet de la poser sur n importe quel
// arriere-plan dans une story.
function _dessinerStorySeance(d){
  const nL=d.ex.length;
  const LH=76;                                  // hauteur d une ligne d exercice
  const CW=STORY_L-144;                         // la largeur qu elle avait deja
  // LE PIED SIGNE LA CARTE, ET IL COUTE 132 PX DE HAUT. Hauteur FIXE, et non
  // proportionnelle : le QR fait la meme taille quelle que soit la longueur de
  // la seance, et c'est lui qui commande. Un pied qui grandirait avec la liste
  // rendrait le QR minuscule sur une seance de trois exercices.
  const PIED=132;
  const CH=250+nL*LH+(d.coupes?64:0)+56+PIED;
  const CX=0, CY=0;                             // elle occupe tout le canevas
  const cv=document.createElement('canvas');
  cv.width=CW; cv.height=CH;
  const g=cv.getContext('2d');
    // PAS var(--pile-titre) : cette constante alimente ctx.font, et un canvas ne
  // resout pas les variables CSS — la police retomberait sur « 10px
  // sans-serif ». _tok rend la VALEUR du token : meme source unique, forme
  // utilisable. Le repli reprend la pile d'avant, au cas ou.
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif");
  const MONT="Montserrat,'Segoe UI',sans-serif";
  const rr=(x,y,w,h,r)=>{ g.beginPath();
    g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r);
    g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); };
  const grad=g.createLinearGradient(CX,CY,CX+CW,CY+CH);
  grad.addColorStop(0,ROUGE_MARQUE_MIN); grad.addColorStop(0.55,'#c01818'); grad.addColorStop(1,'#8e1010');
  // AUCUNE OMBRE PORTEE : le canevas s arrete au bord de la carte, une ombre
  // y serait coupee net. Elle n aurait de sens qu avec une marge, donc avec
  // un fond — precisement ce qu on retire.
  rr(CX,CY,CW,CH,34); g.fillStyle=grad; g.fill();
  // La trame diagonale, comme sur les cartes de l app.
  g.save(); rr(CX,CY,CW,CH,34); g.clip();
  g.strokeStyle='rgba(255,255,255,.05)'; g.lineWidth=2;
  for(let x=-CH;x<CW+CH;x+=26){ g.beginPath(); g.moveTo(CX+x,CY); g.lineTo(CX+x+CH,CY+CH); g.stroke(); }
  g.restore();
  // ── L en-tete ───────────────────────────────────────────────────────
  let y=CY+72;
  g.fillStyle='rgba(255,255,255,.62)'; g.font='800 26px '+MONT;
  g.textAlign='left'; g.textBaseline='alphabetic';
  _texteEspace(g,'SÉANCE DU JOUR',CX+52,y,9);
  // Les pastilles de la semaine, alignees a droite.
  const DS=['L','Ma','Me','J','V','S','D'];
  const pw=52,ph=52,pg=8;
  let px=CX+CW-52-(pw*7+pg*6);
  for(let i=0;i<7;i++){
    const act=d.sc[i]&&d.sc[i].active;
    rr(px,y-40,pw,ph,10);
    g.fillStyle=(i===d.sel)?'rgba(255,255,255,.30)':(act?'rgba(255,255,255,.11)':'rgba(0,0,0,.26)');
    g.fill();
    if(i===d.todayIdx&&i!==d.sel){ g.strokeStyle='rgba(255,255,255,.55)'; g.lineWidth=2; g.stroke(); }
    g.fillStyle=(i===d.sel)?_tok('--text','#efefef'):(act?'rgba(255,255,255,.78)':'rgba(255,255,255,.28)');
    g.font='800 24px '+MONT; g.textAlign='center';
    g.fillText(DS[i],px+pw/2,y-4);
    px+=pw+pg;
  }
  g.textAlign='left';
  // Le titre de la seance.
  y+=76;
  g.fillStyle=_tok('--text','#efefef'); g.font='700 66px '+BEBAS;
  _texteAjuste(g,d.titre,CX+52,y,CW-104,66,BEBAS);
  y+=46;
  g.fillStyle='rgba(255,255,255,.62)'; g.font='600 26px '+MONT;
  g.fillText(d.ex.length+' exercice'+(d.ex.length>1?'s':'')+(d.repos?' · '+d.repos:''),CX+52,y);
  // ── La liste ────────────────────────────────────────────────────────
  y+=42;
  g.strokeStyle='rgba(255,255,255,.17)'; g.lineWidth=2;
  g.beginPath(); g.moveTo(CX+52,y); g.lineTo(CX+CW-52,y); g.stroke();
  y+=54;
  d.ex.forEach((e,i)=>{
    rr(CX+52,y-30,40,40,8); g.fillStyle='rgba(0,0,0,.32)'; g.fill();
    g.fillStyle='rgba(255,255,255,.85)'; g.font='800 22px '+MONT;
    g.textAlign='center'; g.fillText(String(i+1),CX+72,y-2);
    g.textAlign='right'; g.fillStyle='rgba(255,255,255,.5)'; g.font='700 26px '+MONT;
    const dl=g.measureText(e.d).width;
    g.fillText(e.d,CX+CW-52,y);
    g.textAlign='left'; g.fillStyle=_tok('--text','#efefef'); g.font='800 28px '+MONT;
    _texteCoupe(g,e.n,CX+108,y,CW-160-dl-24);
    y+=LH;
  });
  if(d.coupes){
    g.fillStyle='rgba(255,255,255,.5)'; g.font='700 24px '+MONT;
    g.fillText('+ '+d.coupes+' autre'+(d.coupes>1?'s':'')+' exercice'+(d.coupes>1?'s':''),CX+108,y);
  }
  // ── LE PIED DE CARTE ────────────────────────────────────────────────
  //
  // LA CARTE EST SIGNEE. Elle ne l'etait pas : « juste le carre rouge », et la
  // marque devait revenir DANS la carte si on le decidait un jour, pas sous
  // elle. On le decide ici, et la raison a change entre-temps — ce n'est plus
  // une question de decor, c'est le seul chemin de retour qui existe. Une carte
  // partagee sur une story est vue par des gens qui ne connaissent ni le coach
  // ni l'application ; sans un nom et une adresse, elle ne ramene personne.
  //
  // ET C'EST BIEN DANS LA CARTE, pas dessous : le canevas grandit de 132 px, le
  // degrade, la trame et les coins arrondis s'etendent avec lui. Rien n'est
  // pose sur un fond qui n'existe pas — la regle « sans fond » tient toujours.
  const py=CY+CH-PIED;
  // Le meme filet que celui qui ouvre la liste : la carte se ferme comme elle
  // s'est ouverte.
  g.strokeStyle='rgba(255,255,255,.17)'; g.lineWidth=2;
  g.beginPath(); g.moveTo(CX+52,py); g.lineTo(CX+CW-52,py); g.stroke();
  // LE QR EST PLACE EN PREMIER parce que c'est lui qui decide de la largeur
  // qui reste au nom. Dans l'autre ordre, un nom d'equipe long passait dessous.
  let droite=CX+CW-52;
  const mat=_qrMatrice(urlQrSeance());
  if(mat){
    const nq=mat.length, marge=4, total=nq+marge*2;
    // 96 PX VISES, PAS ENTIER IMPOSE. Un pas fractionnaire etale chaque module
    // sur deux pixels : le lecteur voit du gris la ou la norme attend du noir,
    // et le QR devient capricieux a lire. On prend donc le multiple entier le
    // plus proche de 96, et c'est le panneau qui s'ajuste au QR — jamais
    // l'inverse.
    const pas=Math.max(2,Math.round(96/total));
    const cote=total*pas;
    const qx=CX+CW-52-cote, qy=Math.round(py+(PIED-cote)/2);
    // LE FOND BLANC N'EST PAS UN ORNEMENT. Le canevas est transparent : posee
    // sur une photo sombre, une grille de modules noirs sur rien n'est pas
    // lisible du tout. La « quiet zone » de 4 modules qu'exige la norme est
    // comprise dans le panneau — sans elle, beaucoup de lecteurs abandonnent.
    g.fillStyle='#fff'; rr(qx,qy,cote,cote,8); g.fill();
    g.fillStyle='#000';
    for(let r=0;r<nq;r++) for(let c=0;c<nq;c++)
      if(mat[r][c]) g.fillRect(qx+(c+marge)*pas,qy+(r+marge)*pas,pas,pas);
    droite=qx-24;
  }
  const larg=droite-(CX+52);
  const nomCoach=String(d.coach||'').trim().toUpperCase();
  g.textAlign='left'; g.textBaseline='alphabetic';
  // SANS COACH, PAS DE LIGNE VIDE : l'athlete libre garde le sous-titre seul,
  // centre dans la hauteur du pied. Un nom absent ne doit pas laisser un trou.
  let ty=py+(nomCoach?62:80);
  if(nomCoach){
    g.fillStyle=_tok('--text','#efefef'); g.font='800 34px '+MONT;
    _texteCoupe(g,nomCoach,CX+52,ty,larg);
    ty+=32;
  }
  g.fillStyle='rgba(255,255,255,.62)'; g.font='800 20px '+MONT;
  _texteEspace(g,'ENTRAÎNEMENT SUIVI SUR REPCORE',CX+52,ty,3);
  return cv;
}
// ══════════════ LE BILAN DE SEANCE, EN IMAGE ═══════════════════════════
//
// ⚠ CE N'EST PAS LA MEME IMAGE QUE LA CARTE DE SEANCE, ET IL FAUT LE DIRE.
// _dessinerStorySeance rend la carte du PROGRAMME : sans fond, sans ombre,
// sans signature — « juste le carre rouge », arbitre pour qu'on la POSE sur
// l'arriere-plan d'une story. C'etait le bon choix pour un autocollant.
//
// Celle-ci est un autre objet : une seance FAITE, publiee telle quelle. Elle
// occupe donc les 1080x1920 entiers, elle porte un fond, et elle PORTE LE NOM
// DE L'APP — le canal de diffusion est Instagram, et ce qui en sort doit dire
// d'ou ca vient. L'ancienne carte n'est pas touchee : deux objets, deux
// decisions, et fusionner les deux ferait perdre l'un ou l'autre.
//
// AUCUN CHIFFRE N'EST RECALCULE ICI. Durée, séries, volume et records sont
// ceux que l'ecran de fin de seance vient d'afficher : deux calculs du meme
// tonnage finiraient par ne plus dire la meme chose, et l'image contredirait
// l'ecran qu'on venait de lire.
// ⚠ SIX, C'ETAIT LA LIMITE D'UNE IMAGE A FOND NOIR DONT LA LIGNE FAISAIT
// 92 px. Depuis que l'image est transparente et que l'interligne se calcule
// sur le nombre d'exercices, une seance de huit tient sans se serrer — et une
// seance de huit est une seance ordinaire : celle que Kevin a envoyee en
// modele en comptait huit, dont deux auraient disparu.
const BILAN_EX_MAX=12;

// PURE. Ce qu'il y a a dessiner, ou null. Prend la SEANCE ENREGISTREE — celle
// que finishWorkout vient d'ecrire — et rien d'autre.
function bilanSeanceDonnees(sess,user){
  const s=sess||{};
  if(!s.date) return null;
  const data=(s.data&&typeof s.data==='object')?s.data:{};
  const noms=Object.keys(data);
  if(!noms.length) return null;      // une seance vide ne se poste pas
  const ex=[];
  let repsTotal=0;
  for(const nom of noms){
    const sets=((data[nom]||{}).sets)||[];
    let n=0, meilleure=null, rmin=null, rmax=null, fourch=null;
    for(const st of sets){
      if(!st||st.done!==true) continue;
      n++;
      if(!fourch) fourch=fourchetteReps(st.reps);
      const w=parseFloat(st.weight);
      const r=(typeof _perfReps==='function')?Number(_perfReps(st)):Number(st.reps);
      if(r>0){ repsTotal+=r;
        if(rmin==null||r<rmin) rmin=r;
        if(rmax==null||r>rmax) rmax=r; }
      if(!(w>0)||!(r>0)) continue;
      // LA SERIE LA PLUS LOURDE, et a charge egale celle qui a le plus de
      // repetitions. C'est ce qu'on montre d'un exercice : le haut de la pile.
      // Kevin, 09/09/2026 : « pas la moyenne, mais la charge la plus lourde
      // qui a ete mise sur les trois series » — c'etait deja la regle.
      if(!meilleure||w>meilleure.kg||(w===meilleure.kg&&r>meilleure.reps))
        meilleure={kg:w,reps:r,notees:st.repsDone!=null};
    }
    if(!n) continue;                 // exercice ouvert mais jamais valide
    // ══ R29 — SUR UNE FOURCHETTE, LES REPETITIONS DE LA SERIE LA PLUS LOURDE ══
    // Kevin, 17/09/2026 : 10-12 en programme, 11 reps a 34 puis 10 reps a 36 :
    // le bilan retient « 10 reps a 36 », et rien d'autre — ni « 10-11 », ni la
    // moyenne. Si les repetitions de cette serie n'ont pas ete notees, on
    // ecrit la fourchette du programme (`fourchette`) plutot qu'une moyenne
    // qu'il n'a jamais faite. Hors fourchette, rien ne change.
    if(fourch&&meilleure){
      const vu=meilleure.notees?meilleure.reps:null;
      ex.push({nom:String(nom).toUpperCase(),series:n,kg:meilleure.kg,reps:vu,
        rmin:vu,rmax:vu,fourchette:fourch.min+'-'+fourch.max});
      continue;
    }
    ex.push({nom:String(nom).toUpperCase(),series:n,
      kg:meilleure?meilleure.kg:null,reps:meilleure?meilleure.reps:null,
      // LA FOURCHETTE REELLE, pas celle du programme : « 3 × 12-15 » sur
      // l'image de Kevin est ce qui a ete FAIT. Un seul chiffre quand les
      // series se ressemblent — « 3 × 12-12 » se lirait comme une erreur.
      rmin:rmin,rmax:rmax});
  }
  if(!ex.length) return null;
  // ⚠ L'ORDRE DE LA SEANCE, ET PLUS L'ORDRE DES CHARGES. Le tri par tonnage
  // decroissant mettait la presse avant le squat et l'extension triceps avant
  // le developpe : la liste ne racontait plus la seance, elle classait des
  // machines. Le modele envoye par Kevin suit l'ordre du deroulement, et c'est
  // celui-la que `data` porte deja — Object.keys rend l'ordre d'insertion,
  // c'est-a-dire l'ordre des exercices de la seance.
  const d=new Date(Number(s.date));
  const mins=Math.max(0,Math.round(Number(s.duration)||0));
  return {
    titre:String(s.name||'SÉANCE').toUpperCase(),
    date:d.toLocaleDateString('fr-FR',{day:'2-digit',month:'long'}).toUpperCase(),
    // La forme du modele : « 09/09/2026 » et « 1H18 ». Une image qu'on garde
    // six mois doit porter son annee ; « 09 SEPTEMBRE » ne la porte pas.
    dateCourte:d.toLocaleDateString('fr-FR',
      {day:'2-digit',month:'2-digit',year:'numeric'}),
    dureeLib:(mins>=60?(Math.floor(mins/60)+'H'+String(mins%60).padStart(2,'0'))
                      :(mins+' MIN')),
    reps:repsTotal,
    nbEx:ex.length,
    mins:mins,
    series:Math.max(0,Math.round(Number(s.sets)||0)),
    seriesPrevues:Math.max(0,Math.round(Number(s.setsPlanned)||0)),
    volume:Math.max(0,Math.round(Number(s.volume)||0)),
    // LES RECORDS SONT PASSES PAR L'APPELANT, pas recalcules : c'est l'ecran
    // de fin qui les a comptes, et il n'y en a qu'un compte qui vaille.
    records:0,
    ex:ex.slice(0,BILAN_EX_MAX),
    autres:Math.max(0,ex.length-BILAN_EX_MAX)};
}
// PURE. Le tonnage, ecrit court. « 12 400 kg » se lit ; « 12,4 t » se lit
// mieux sur une image regardee deux secondes.
function bilanVolumeLib(kg){
  const v=Number(kg)||0;
  if(v>=10000) return String(Math.round(v/100)/10).replace('.',',')+' t';
  if(v>=1000) return String(Math.round(v/10)/100).replace('.',',')+' t';
  return v+' kg';
}
// ══ LE DESSIN — SANS FOND, ET C'EST TOUT LE PROPOS ═════════════════════
//
// Kevin, 09/09/2026, modele a l'appui : « je veux pas que ce soit sur un fond
// rouge, tout ca. Je veux que ce soit en format PNG, c'est-a-dire SANS FOND,
// uniquement avec l'ecriture blanche. »
//
// L'image portait un aplat noir, un halo rouge et une trame diagonale. Elle
// etait faite pour etre publiee TELLE QUELLE ; celle-ci est faite pour etre
// POSEE sur la photo que l'athlete a prise a la salle. Ce n'est pas un
// changement de gout, c'est un changement d'emploi — et il commande tout le
// reste : plus de fond, donc plus de rouge (illisible sur une photo claire
// comme sur une photo sombre), donc du blanc avec une ombre portee, seule
// facon de tenir sur les deux.
//
// ⚠ LE PNG N'EST PAS UN LUXE ICI, C'EST LA SEULE SORTIE POSSIBLE : le JPEG
// n'a pas de canal alpha et rendrait le fond NOIR. Mesure du 09/09/2026 sur
// ce format 1080x1920 : 10 ms et 163 Ko pour du texte blanc seul, 20 ms et
// 502 Ko avec l'ombre. Le commentaire de _b64versBlob annoncait 13 105 ms et
// 1 048 Ko pour un PNG — c'etait vrai de l'image PLEINE d'alors, dont la
// trame diagonale ne se compresse pas ; il ne l'est pas d'un canevas presque
// entierement transparent.
//
// AUCUN CHIFFRE N'EST RECALCULE ICI. Duree, series, volume et records sont
// ceux que l'ecran de fin de seance vient d'afficher.

// LA MARQUE DU COACH, PRECHAUFFEE. Le dessin est SYNCHRONE — le moindre await
// consommerait le geste utilisateur et iOS refuserait le partage —, or une
// image, meme en base64, ne se decode pas instantanement. On la charge donc a
// l'affichage du bouton, bien avant le clic, exactement comme les polices.
// Sans elle, l'image sort sans logo : c'est un cas normal, pas une panne.
let _marqueCoachImg=null;
function _prechaufferMarqueCoach(){
  try{
    // LE COACH LUI-MÊME (victoire, récap d'équipe) signe avec SA marque ; un
    // athlète, avec celle de son coach.
    const src=(currentUser&&currentUser.role==='coach')
      ?String(currentUser.logo||currentUser.signature||'')
      :((typeof marqueCoachDe==='function')?marqueCoachDe(currentUser):'');
    if(!src){ _marqueCoachImg=null; return; }
    if(_marqueCoachImg&&_marqueCoachImg.getAttribute('data-src')===src) return;
    const im=new Image();
    im.setAttribute('data-src',src);
    im.src=src;
    _marqueCoachImg=im;
  }catch(e){ _marqueCoachImg=null; }
}
// Rend l'image seulement si elle est PRETE a etre dessinee. `complete` seul ne
// suffit pas : il vaut vrai aussi pour une image en erreur, et drawImage
// leverait alors au milieu du dessin.
function _marqueCoachPrete(){
  const im=_marqueCoachImg;
  return (im&&im.complete&&im.naturalWidth>0)?im:null;
}
// ══ LE NOM SUR LES VISUELS ════════════════════════════════════════════
// PURE. Le nom que l'athlete a choisi de montrer sur ses visuels, en
// majuscules, ou '' s'il ne veut rien montrer. Un seul reglage pour tous les
// visuels, presents et a venir : « Nom affiche sur mes visuels » dans le
// profil — prenom (defaut), pseudo, ou rien. Un pseudo demande mais absent
// retombe sur le prenom ; sans prenom non plus, rien.
const VISUEL_NOMS=Object.freeze(['prenom','pseudo','rien']);
function nomSurVisuels(u){
  if(!u) return '';
  const r=VISUEL_NOMS.indexOf(u.visuelNom)>=0?u.visuelNom:'prenom';
  if(r==='rien') return '';
  const net=x=>String(x||'').replace(/\s+/g,' ').trim().slice(0,24);
  const p=net(u.pseudo), f=net(u.fname);
  const n=(r==='pseudo'&&p)?p:f;
  try{ return n.toLocaleUpperCase('fr-FR'); }catch(e){ return n.toUpperCase(); }
}
// ══ LE FOND DES VISUELS ═══════════════════════════════════════════════
// Trois fonds pour tous les visuels 1080×1920, présents et à venir (bilan de
// séance aujourd'hui ; record, badge, série, cycle demain) :
//   'transparent' — PNG sans fond, à poser sur sa propre photo en story ;
//   'photo'       — la photo de l'athlète en « cover », assombrie en bas ;
//   'carbone'     — un dégradé noir et une trame de fibre de carbone. Il a
//                   remplacé le fond ROUGE le 27/09/2026 (Kevin : « des muscles
//                   coloriés en rouge sur du rouge, c'est pas foufou »).
// ⚠ LA PHOTO NE QUITTE JAMAIS LE TÉLÉPHONE. Elle est lue par un <input>,
//   gardée en mémoire le temps de la page (une URL d'objet), et dessinée dans
//   le canevas : rien ne l'envoie, rien ne la stocke. Seul le CHOIX du fond
//   est retenu, dans localStorage.
//
// POUR UN NOUVEAU VISUEL, trois gestes :
//   1. son dessin prend un `fond` et appelle _visuelPeindreFond(g,W,H,fond)
//      avant tout le reste ;
//   2. son écran pose _htmlVisuelFonds(id) puis monterSelecteurFond(id,
//      fond=>sonDessin(donnees,fond)) — les vignettes, la note et le choix
//      suivent tout seuls ;
//   3. sa sortie passe visuelFondFormat(fond) à _storySortirTelechargement /
//      _storySortirPartage, avec le nom visuelNomFichier('repcore-xxx',fond).
const VISUEL_FOND=Object.freeze({
  LISTE:Object.freeze(['transparent','photo','carbone']),
  CLE:'rc_visuel_fond',
  LIB:Object.freeze({transparent:'Sans fond',photo:'Ma photo',carbone:'Carbone',edition:'Édition'}),
  // La vignette : 180 × 320, le 9:16 de la story.
  VL:180, VH:320
});
/** La photo choisie, en mémoire seulement : {img,url} ou null. */
let _visuelPhoto=null;
function _visuelPhotoPrete(){
  const im=_visuelPhoto&&_visuelPhoto.img;
  return !!(im&&im.complete&&im.naturalWidth>0);
}
/** Le dernier fond choisi sur cet appareil. localStorage peut manquer : 'transparent'. */
// LE FOND « ÉDITION » n'existe que pendant un événement saisonnier : la
// couleur de l'édition, son nom et son année en tête du visuel. Choisi puis
// l'édition finie, il retombe sur le carbone.
function visuelFondsListe(maintenant){
  let s=null; try{ s=saisonActive(maintenant); }catch(e){ s=null; }
  return s?VISUEL_FOND.LISTE.concat(['edition']):VISUEL_FOND.LISTE.slice();
}
function visuelFondChoisi(){
  let f=null;
  try{ f=localStorage.getItem(VISUEL_FOND.CLE); }catch(e){ f=null; }
  // Qui avait choisi le rouge retrouve le fond plein qui l'a remplacé.
  if(f==='rouge') f='carbone';
  if(f==='edition') return visuelFondsListe().indexOf('edition')>=0?'edition':'carbone';
  return VISUEL_FOND.LISTE.indexOf(f)>=0?f:'transparent';
}
function visuelFondMemoriser(f){
  if(visuelFondsListe().indexOf(f)<0) return false;
  try{ localStorage.setItem(VISUEL_FOND.CLE,f); return true; }catch(e){ return false; }
}
/** Le fond qu'on dessine vraiment : « photo » sans photo chargée retombe sur « sans fond ». */
function visuelFondEffectif(){
  const f=visuelFondChoisi();
  return (f==='photo'&&!_visuelPhotoPrete())?'transparent':f;
}
/** PURE. Le format de sortie : PNG pour garder la transparence, JPEG 0,9 sinon. */
function visuelFondFormat(fond){
  return fond==='transparent'?{type:'image/png',ext:'png',q:null}:{type:'image/jpeg',ext:'jpg',q:0.9};
}
// ══ LES FORMATS : STORY 9:16, POST 4:5 (27/09/2026) ═════════════════════
// UN SEUL RÉGLAGE POUR TOUS LES VISUELS. L'avant/après (AA_FORMATS) et le
// visuel du coach (VC_FORMATS) avaient chacun le leur ; les autres ne
// savaient faire que la story, et un post Instagram recadrait la moitié du
// visuel. Chaque dessin prend désormais un `format` et RECALCULE sa mise en
// page pour sa hauteur ; sans `format`, c'est le dernier choisi sur cet
// appareil (visuelFormatChoisi).
const VISUEL_FORMATS=Object.freeze({
  story:Object.freeze({w:1080,h:1920,lib:'Story',ratio:'9:16'}),
  post:Object.freeze({w:1080,h:1350,lib:'Post',ratio:'4:5'})
});
const VISUEL_FORMAT_CLE='rc_visuel_format';
// LA TOILE D'UN VISUEL. Neuve pour une image ; pour la vidéo (anim.cv), la
// même à chaque frame, effacée : trente toiles de 8 Mo par seconde, c'est le
// ramasse-miettes qui ferait sauter des images.
function _visuelToile(anim,W,H){
  const cv=(anim&&anim.cv)||document.createElement('canvas');
  if(cv.width!==W||cv.height!==H){ cv.width=W; cv.height=H; }
  else if(anim&&anim.cv){ const g=cv.getContext('2d'); g.setTransform(1,0,0,1,0,0); g.globalAlpha=1; g.globalCompositeOperation='source-over'; g.clearRect(0,0,W,H); }
  return cv;
}
/** Le dernier format choisi sur cet appareil ; 'story' par défaut. */
function visuelFormatChoisi(){
  let f=null;
  try{ f=localStorage.getItem(VISUEL_FORMAT_CLE); }catch(e){ f=null; }
  return VISUEL_FORMATS[f]?f:'story';
}
function visuelFormatMemoriser(f){
  if(!VISUEL_FORMATS[f]) return false;
  try{ localStorage.setItem(VISUEL_FORMAT_CLE,f); return true; }catch(e){ return false; }
}
/** PURE (sauf le défaut). {cle,w,h,lib,ratio} du format demandé, sinon du dernier choisi. */
function visuelFormat(format){
  const k=VISUEL_FORMATS[format]?format:visuelFormatChoisi();
  return Object.assign({cle:k},VISUEL_FORMATS[k]);
}
/** repcore-bilan.png, repcore-bilan.jpg, repcore-bilan-post.jpg. */
function visuelNomFichier(base,fond,format){
  return base+(visuelFormat(format).cle==='post'?'-post':'')+'.'+visuelFondFormat(fond).ext;
}
/**
 * Peint le fond sur tout le canevas, AVANT le reste du visuel.
 * @param {CanvasRenderingContext2D} g @param {number} W @param {number} H
 * @param {'transparent'|'photo'|'carbone'|'rouge'} fond
 */
function _visuelPeindreFond(g,W,H,fond){
  if(fond==='carbone'){
    // LE DÉGRADÉ : un noir qui s'éclaircit à peine au centre-haut, là où se
    // posent le titre et les silhouettes, et se referme vers les bords.
    const grad=g.createLinearGradient(0,0,W,H);
    grad.addColorStop(0,'#1b1b1d'); grad.addColorStop(0.5,'#0f0f10'); grad.addColorStop(1,'#050505');
    g.fillStyle=grad; g.fillRect(0,0,W,H);
    // LA TRAME DE CARBONE : un tissage de petites cases dont le reflet
    // alterne (horizontal, vertical), très discret pour ne rien voler aux
    // muscles.
    const c=Math.max(8,Math.round(W/90));
    g.save();
    for(let y=0;y<H;y+=c) for(let x=0;x<W;x+=c){
      const hz=((x/c)+(y/c))%2===0;
      const r=hz?g.createLinearGradient(x,y,x,y+c):g.createLinearGradient(x,y,x+c,y);
      r.addColorStop(0,'rgba(255,255,255,.045)'); r.addColorStop(0.5,'rgba(255,255,255,0)'); r.addColorStop(1,'rgba(0,0,0,.25)');
      g.fillStyle=r; g.fillRect(x,y,c,c);
    }
    g.restore();
    // LE HALO : un voile clair derrière le centre, et les coins assombris.
    const hal=g.createRadialGradient(W/2,H*0.42,0,W/2,H*0.42,Math.max(W,H)*0.62);
    hal.addColorStop(0,'rgba(255,255,255,.07)'); hal.addColorStop(0.55,'rgba(0,0,0,0)'); hal.addColorStop(1,'rgba(0,0,0,.55)');
    g.fillStyle=hal; g.fillRect(0,0,W,H);
    return true;
  }
  if(fond==='rouge'){
    // Le dégradé et la trame de _dessinerStorySeance, sur tout le format.
    const grad=g.createLinearGradient(0,0,W,H);
    grad.addColorStop(0,ROUGE_MARQUE_MIN); grad.addColorStop(0.55,'#c01818'); grad.addColorStop(1,'#8e1010');
    g.fillStyle=grad; g.fillRect(0,0,W,H);
    g.save();
    g.strokeStyle='rgba(255,255,255,.05)'; g.lineWidth=2;
    for(let x=-H;x<W+H;x+=26){ g.beginPath(); g.moveTo(x,0); g.lineTo(x+H,H); g.stroke(); }
    g.restore();
    return true;
  }
  if(fond==='edition'){
    // La couleur de l'édition, sur un noir profond ; son nom et son année en
    // tête, en petites capitales espacées (le visuel commence plus bas).
    let sa=null; try{ sa=saisonActive(); }catch(e){ sa=null; }
    const c=saisonCouleur(sa);
    g.fillStyle='#050506'; g.fillRect(0,0,W,H);
    const hal=g.createRadialGradient(W/2,H*0.35,0,W/2,H*0.35,Math.max(W,H)*0.75);
    hal.addColorStop(0,c+'55'); hal.addColorStop(0.55,c+'14'); hal.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=hal; g.fillRect(0,0,W,H);
    g.save(); g.strokeStyle=c+'22'; g.lineWidth=3;
    for(let x=-H;x<W+H;x+=48){ g.beginPath(); g.moveTo(x,0); g.lineTo(x+H*0.6,H); g.stroke(); }
    g.restore();
    g.fillStyle=c; g.fillRect(0,0,W,Math.max(6,Math.round(H/240)));
    if(sa){
      const t=('ÉDITION '+sa.nom+' · '+saisonAnnee(sa)).toUpperCase();
      g.save(); g.textAlign='center'; g.textBaseline='alphabetic'; g.fillStyle=c;
      const fs=Math.max(12,Math.round(W/42));
      g.font='800 '+fs+'px Montserrat,sans-serif';
      let s2=t; while(g.measureText(s2).width>W*0.9&&s2.length>4) s2=s2.slice(0,-2);
      g.fillText(s2,W/2,Math.round(H/32)+fs);
      g.restore();
    }
    return true;
  }
  if(fond==='photo'&&_visuelPhotoPrete()){
    const im=_visuelPhoto.img, iw=im.naturalWidth, ih=im.naturalHeight;
    // « cover » : la photo remplit tout, centrée, rognée sur le côté qui dépasse.
    const k=Math.max(W/iw,H/ih), dw=iw*k, dh=ih*k;
    g.fillStyle='#000'; g.fillRect(0,0,W,H);
    g.drawImage(im,(W-dw)/2,(H-dh)/2,dw,dh);
    // LE BAS ASSOMBRI : de 0 à 70 % de noir, là où le texte descend.
    const v=g.createLinearGradient(0,H*0.3,0,H);
    v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,.7)');
    g.fillStyle=v; g.fillRect(0,0,W,H);
    return true;
  }
  return false;                                   // transparent : rien
}
/**
 * Le choix « Story / Post », posé À CÔTÉ du sélecteur de fond : chaque visuel
 * qui a le second a le premier. `id` : celui du sélecteur de fond voisin.
 */
function _htmlVisuelFormats(id){
  const k0=visuelFormatChoisi();
  return '<div class="vfmt" role="radiogroup" aria-label="Format de l’image" data-pour="'+id+'">'
    +Object.keys(VISUEL_FORMATS).map(k=>'<button type="button" class="vfmt-b'+(k===k0?' actif':'')+'" role="radio" aria-checked="'+(k===k0)+'"'
      +' data-format="'+k+'" onclick="visuelFormatChoisir(\''+id+'\',\''+k+'\')">'
      +VISUEL_FORMATS[k].lib+'<small>'+VISUEL_FORMATS[k].ratio+'</small></button>').join('')
    +'</div>';
}
/** Un clic sur « Story » ou « Post » : retenu, et tous les sélecteurs à l'écran repeints. */
function visuelFormatChoisir(id,k){
  if(!VISUEL_FORMATS[k]) return false;
  visuelFormatMemoriser(k);
  document.querySelectorAll('.vfmt .vfmt-b').forEach(b=>{
    const on=b.getAttribute('data-format')===k;
    b.classList.toggle('actif',on); b.setAttribute('aria-checked',String(on));
  });
  for(const x of [..._visuelFondsMontes.keys()]) _visuelFondsPeindre(x);
  return true;
}
/** Le sélecteur : le format, trois vignettes cliquables, et l'<input> de la photo. */
function _htmlVisuelFonds(id){
  const f=visuelFondEffectif();
  return _htmlVisuelFormats(id)
    +'<button type="button" class="vf-legende" onclick="voirLegende(typeDuSelecteur(\''+id+'\'))">Voir la légende</button>'
    +'<div class="vf" id="'+id+'" role="radiogroup" aria-label="Fond du visuel">'
    +visuelFondsListe().map(k=>'<button type="button" class="vf-b'+(k===f?' actif':'')+'" role="radio" aria-checked="'+(k===f)+'" data-fond="'+k+'"'
      // Un libellé d'une ligne pour les trois : « changer » se dit au survol.
      +(k==='photo'?' title="Touche à nouveau pour changer de photo"':'')
      +' onclick="visuelFondChoisir(\''+id+'\',\''+k+'\')">'
      +'<canvas class="vf-c" width="'+VISUEL_FOND.VL+'" height="'+VISUEL_FOND.VH+'" aria-hidden="true"></canvas>'
      +'<span>'+VISUEL_FOND.LIB[k]+'</span></button>').join('')
    +'<input type="file" accept="image/*" capture="environment" class="vf-f" hidden onchange="visuelFondPhoto(\''+id+'\',this)">'
    +'</div>';
}
/** La note sous les boutons : ce que le fichier sera, selon le fond. */
function _visuelNoteFond(fond){
  if(fond==='transparent') return 'PNG sans fond, à apposer sur ta photo en story.<br>'
    +'Dans la galerie, le visuel s’affichera en blanc : c’est normal.';
  if(fond==='photo') return 'JPEG sur ta photo, prêt à poster.<br>Ta photo reste sur ton téléphone : rien n’est envoyé.';
  return 'JPEG sur fond carbone, prêt à poster.';
}
// Les sélecteurs à l'écran : id → {dessiner, note}. Un écran qui se redessine
// remonte le sien ; un id absent du document est oublié au passage.
const _visuelFondsMontes=new Map();
/**
 * Branche un sélecteur posé par _htmlVisuelFonds.
 * @param {string} id
 * @param {(fond:string)=>HTMLCanvasElement|null} dessiner le visuel complet, pour un fond
 * @param {string} [noteId] l'élément dont le texte suit le fond
 */
function monterSelecteurFond(id,dessiner,noteId){
  _visuelFondsMontes.set(id,{dessiner,noteId:noteId||null});
  _visuelFondsPeindre(id);
  // Les polices peuvent arriver après : on repeint alors les vignettes.
  try{ if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>_visuelFondsPeindre(id)); }catch(e){}
}
function _visuelFondsPeindre(id){
  const m=_visuelFondsMontes.get(id), z=document.getElementById(id);
  if(!m||!z){ _visuelFondsMontes.delete(id); return false; }
  const f=visuelFondEffectif();
  z.querySelectorAll('.vf-b').forEach(b=>{
    const on=b.getAttribute('data-fond')===f;
    b.classList.toggle('actif',on); b.setAttribute('aria-checked',String(on));
  });
  if(m.noteId){ const n=document.getElementById(m.noteId); if(n) n.innerHTML=_visuelNoteFond(f); }
  // LES VIGNETTES SE DESSINENT APRÈS LA PEINTURE, une par tâche : trois
  // visuels complets d'affilée bloqueraient l'écran de fin de séance.
  const cvs=[...z.querySelectorAll('.vf-b')];
  // LA VIGNETTE PREND LA FORME DU FORMAT : 9:16 ou 4:5.
  const fmt=visuelFormat();
  cvs.forEach((b,i)=>setTimeout(()=>{
    const c=b.querySelector('canvas'); if(!c||!c.isConnected) return;
    const vh=Math.round(VISUEL_FOND.VL*fmt.h/fmt.w);
    if(c.height!==vh){ c.height=vh; c.style.aspectRatio=fmt.w+'/'+fmt.h; }
    const k=b.getAttribute('data-fond'), x=c.getContext('2d'); if(!x) return;
    x.clearRect(0,0,c.width,c.height);
    if(k==='transparent'){
      // Le damier dit « transparent » mieux qu'un mot.
      for(let yy=0;yy<c.height;yy+=12) for(let xx=0;xx<c.width;xx+=12){
        x.fillStyle=((xx+yy)/12)%2?'#2a2a2e':'#1c1c20'; x.fillRect(xx,yy,12,12); }
    }
    if(k==='photo'&&!_visuelPhotoPrete()){
      x.fillStyle='#16161a'; x.fillRect(0,0,c.width,c.height);
      x.strokeStyle='rgba(255,255,255,.35)'; x.lineWidth=3; x.setLineDash([8,6]);
      x.strokeRect(10,10,c.width-20,c.height-20); x.setLineDash([]);
      x.fillStyle='rgba(255,255,255,.7)'; x.font='800 64px Montserrat,sans-serif'; x.textAlign='center'; x.textBaseline='middle';
      x.fillText('+',c.width/2,c.height/2);
      return;
    }
    let v=null;
    try{ v=m.dessiner(k); }catch(e){ v=null; }
    if(v){ x.drawImage(v,0,0,c.width,c.height); v.width=0; v.height=0; }
  },40+i*60));
  return true;
}
/** Un clic sur une vignette. « Ma photo » sans photo : on ouvre le choix du fichier. */
function visuelFondChoisir(id,fond){
  if(visuelFondsListe().indexOf(fond)<0) return false;
  if(fond==='photo'&&(!_visuelPhotoPrete()||visuelFondEffectif()==='photo')){
    const inp=document.querySelector('#'+id+' .vf-f');
    if(inp){ inp.value=''; inp.click(); }
    return true;
  }
  visuelFondMemoriser(fond);
  for(const k of [..._visuelFondsMontes.keys()]) _visuelFondsPeindre(k);
  return true;
}
/** La photo choisie : lue ici, gardée en mémoire, jamais envoyée. */
function visuelFondPhoto(id,input){
  const f=input&&input.files&&input.files[0];
  if(!f||!/^image\//.test(f.type||'image/')) return false;
  const url=URL.createObjectURL(f);
  const im=new Image();
  im.onload=()=>{
    try{ if(_visuelPhoto&&_visuelPhoto.url) URL.revokeObjectURL(_visuelPhoto.url); }catch(e){}
    _visuelPhoto={img:im,url};
    visuelFondMemoriser('photo');
    for(const k of [..._visuelFondsMontes.keys()]){
      _visuelFondsPeindre(k);
    }
  };
  im.onerror=()=>{ try{ URL.revokeObjectURL(url); }catch(e){} toast('Cette image ne s’ouvre pas.','var(--orange)'); };
  im.src=url;
  return true;
}
// `fond` (FACULTATIF) : 'transparent' (défaut, le PNG d'avant), 'photo' ou 'rouge'.
// `format` (FACULTATIF) : 'story' (1080×1920) ou 'post' (1080×1350) ; sans
// lui, le dernier choisi. En post, la liste garde ce qui TIENT, et le reste
// passe dans « +N autres » : on ne rétrécit pas les lignes jusqu'à l'illisible.
function _dessinerBilanSeance(d,fond,format){
  const F=visuelFormat(format), W=F.w, H=F.h, post=F.cle==='post';
  const cv=document.createElement('canvas');
  cv.width=W; cv.height=H;
  const g=cv.getContext('2d');
  _visuelPeindreFond(g,W,H,fond||'transparent');
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif");
  const MONT="Montserrat,'Segoe UI',sans-serif";
  const M=72;                                   // la marge laterale
  const LARG=W-M*2;

  // ── L'OMBRE PORTEE, ET POURQUOI ELLE EST OBLIGATOIRE ─────────────────
  // Du blanc pur sur une photo de salle passe encore ; sur un mur clair, un
  // sol beige ou un t-shirt blanc, il disparait. L'ombre est le seul moyen de
  // rester lisible sur les deux SANS remettre un fond — c'est-a-dire sans
  // reprendre d'une main ce que la demande retire de l'autre.
  const ombre=(on)=>{
    g.shadowColor=on?'rgba(0,0,0,.78)':'transparent';
    g.shadowBlur=on?12:0;
    g.shadowOffsetX=0; g.shadowOffsetY=on?2:0;
  };
  // ⚠ ECRIT DEUX FOIS, ET C'EST LA MESURE QUI L'IMPOSE. Une seule passe pose
  // une aureole qui se voit sur du sombre et se perd sur du blanc. La seconde
  // passe empile la meme ombre sur elle-meme — elle devient un contour — puis
  // le blanc est repose par-dessus, sans ombre, pour qu'il reste franc.
  // Le canvas n'a pas de text-shadow : c'est le seul moyen.
  const ecrire=(t,x,y)=>{ g.fillText(t,x,y); g.fillText(t,x,y);
    const sc=g.shadowColor; g.shadowColor='transparent';
    g.fillText(t,x,y); g.shadowColor=sc; };
  // MEME REGLE POUR LE TEXTE ESPACE. _texteEspace pose les lettres une a une
  // avec fillText : une seule passe, donc une seule ombre — et sur fond blanc,
  // la date et les libelles restaient les seuls a disparaitre.
  const ecrireEspace=(t,x,y,esp,centre)=>{
    _texteEspace(g,t,x,y,esp,centre); _texteEspace(g,t,x,y,esp,centre);
    const sc=g.shadowColor; g.shadowColor='transparent';
    _texteEspace(g,t,x,y,esp,centre); g.shadowColor=sc; };
  // Ajuste la TAILLE jusqu'a ce que le texte tienne, en gardant la graisse
  // demandee. _texteAjuste fixe 700 en dur et ne convient qu'au titre.
  const ajuste=(t,poids,taille,police,max,mini)=>{
    let s=taille;
    g.font=poids+' '+s+'px '+police;
    while(g.measureText(t).width>max&&s>(mini||18)){
      s-=1; g.font=poids+' '+s+'px '+police;
    }
    return s;
  };

  // ── LA MISE EN PAGE SE CALCULE AVANT DE DESSINER ─────────────────────
  // Le bloc est CENTRE verticalement, et c'est l'inverse de la regle qui
  // valait pour l'image a fond noir : la, un creux sous une liste courte
  // laissait un rectangle noir vide, il fallait donc ancrer en haut. Ici le
  // creux est TRANSPARENT — il n'existe pas. Centrer donne une image qu'on
  // pose au milieu d'une story sans avoir a la deplacer.
  const marque=_marqueCoachPrete();
  const eq=(d.equivalent&&d.equivalent.texte)?d.equivalent:null;
  const H_TITRE=post?128:154, H_DATE=56, H_REC=d.records>0?58:0;
  const H_STATS=150+(eq?84:0);
  const H_MARQUE=marque?(post?150:188):96;
  const MARGE=post?64:150;
  // CE QUI TIENT : la place entre les marges, moins tout le reste (et la ligne
  // « +N autres »). Au-delà, les exercices du bas passent dans cette ligne.
  let ex=d.ex, autres=Math.max(0,d.autres|0);
  let LH=ex.length<=6?86:(ex.length<=9?76:66);   // l'interligne suit la liste
  if(post) LH=Math.min(LH,66);
  const place=H-2*MARGE-(H_TITRE+H_DATE+H_REC+34+H_STATS+H_MARQUE);
  const tient=Math.max(1,Math.floor((place-46)/LH));
  if(ex.length>tient){ autres+=ex.length-tient; ex=ex.slice(0,tient); }
  const n=ex.length;
  const H_LISTE=34+n*LH+(autres?46:0);
  // L'ÉQUIVALENT FUN, EN OPTION (case « Ajouter l'équivalent fun », décochée
  // par défaut) : une ligne de plus sous les quatre chiffres. Absent, la mise
  // en page est exactement celle d'avant.
  const HTOT=H_TITRE+H_DATE+H_REC+H_LISTE+H_STATS+H_MARQUE;
  let y=Math.max(MARGE,Math.round((H-HTOT)/2));

  ombre(true);
  g.textAlign='left'; g.textBaseline='alphabetic';

  // ── LE TITRE ─────────────────────────────────────────────────────────
  g.fillStyle='#ffffff';
  const ts=ajuste(d.titre,'700',post?100:118,BEBAS,LARG,52);
  g.font='700 '+ts+'px '+BEBAS;
  ecrire(d.titre,M,y+ts*0.82);
  y+=H_TITRE;
  // La date et la duree, sur une seule ligne. L'annee y est : une image gardee
  // six mois doit dire de quand elle date.
  g.fillStyle='rgba(255,255,255,.88)'; g.font='700 30px '+MONT;
  ecrireEspace(d.dateCourte+'   ·   '+d.dureeLib,M,y,3);
  y+=H_DATE;
  if(d.records>0){
    g.fillStyle='rgba(255,255,255,.95)'; g.font='800 27px '+MONT;
    ecrireEspace((d.records>1?(d.records+' NOUVEAUX RECORDS'):'1 NOUVEAU RECORD'),M,y,4);
    y+=H_REC;
  }

  // ── LA LISTE ─────────────────────────────────────────────────────────
  ombre(false);
  g.strokeStyle='rgba(255,255,255,.55)'; g.lineWidth=2;
  g.beginPath(); g.moveTo(M,y-6); g.lineTo(W-M,y-6); g.stroke();
  ombre(true);
  y+=34;
  ex.forEach((e,i)=>{
    const yy=y+i*LH;
    // LA CHARGE LA PLUS LOURDE DES SERIES, a droite, en blanc plein : c'est le
    // chiffre qu'on cherche des yeux. Le compte de series le precede, atténué.
    // R29 — une fourchette montre les repetitions de la serie la plus lourde,
    // ou la fourchette du programme si elles n'ont pas ete notees.
    const rep=e.fourchette
      ? (e.reps!=null?String(e.reps):e.fourchette)
      : (e.rmin!=null)
      ? (e.rmin===e.rmax?String(e.rmin):(e.rmin+'-'+e.rmax))
      : '';
    const gauche=e.series+' × '+(rep||'-');
    const droite=(e.kg!=null)?(String(e.kg).replace('.',',')+' KG'):'';
    g.textAlign='right';
    let dx=W-M;
    if(droite){
      g.fillStyle='#ffffff'; g.font='700 40px '+BEBAS;
      ecrire(droite,dx,yy);
      dx-=g.measureText(droite).width+26;
    }
    g.fillStyle='rgba(255,255,255,.78)'; g.font='700 36px '+BEBAS;
    ecrire(gauche,dx,yy);
    dx-=g.measureText(gauche).width+30;
    // ⚠ LE NOM SE REDUIT, IL NE SE COUPE PLUS. Sur le modele envoye par Kevin,
    // la premiere ligne se terminait par « 2: » — le nom avait pousse la charge
    // hors de l'image, et c'est la charge qu'on venait lire. On mesure donc la
    // place qui reste, et la taille du nom s'y plie ; en dessous de 22 px, et
    // seulement la, on coupe.
    g.textAlign='left';
    const place=dx-M;
    const ns=ajuste(e.nom,'700',40,BEBAS,place,22);
    g.fillStyle='rgba(255,255,255,.98)'; g.font='700 '+ns+'px '+BEBAS;
    if(g.measureText(e.nom).width>place) _texteCoupe(g,e.nom,M,yy,place);
    else ecrire(e.nom,M,yy);
  });
  y+=n*LH;
  if(autres){
    g.fillStyle='rgba(255,255,255,.55)'; g.font='700 30px '+BEBAS;
    g.fillText('+ '+autres+' AUTRE'+(autres>1?'S':''),M,y+8);
    y+=46;
  }

  // ── LES QUATRE CHIFFRES ──────────────────────────────────────────────
  // Ceux du modele : volume, exercices, series, reps. Sans cadre ni pastille —
  // un cadre est un fond, et il n'y a plus de fond.
  ombre(false);
  g.strokeStyle='rgba(255,255,255,.55)'; g.lineWidth=2;
  g.beginPath(); g.moveTo(M,y+14); g.lineTo(W-M,y+14); g.stroke();
  ombre(true);
  const chiffres=[
    {v:(d.volume>=10000?bilanVolumeLib(d.volume).toUpperCase()
        :(String(d.volume).replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' KG')),l:'VOLUME'},
    {v:String(d.nbEx),l:'EXERCICES'},
    {v:String(d.series),l:'SÉRIES'},
    {v:String(d.reps),l:'REPS'}];
  const cw=LARG/4;
  chiffres.forEach((c,i)=>{
    const cx=M+cw*i+cw/2;
    g.textAlign='center';
    g.fillStyle='#ffffff';
    const vs=ajuste(c.v,'700',72,BEBAS,cw-16,34);
    g.font='700 '+vs+'px '+BEBAS;
    ecrire(c.v,cx,y+96);
    g.fillStyle='rgba(255,255,255,.76)'; g.font='800 21px '+MONT;
    ecrireEspace(c.l,cx,y+134,4,true);
  });
  if(eq){
    const t='= '+eq.texte.toUpperCase()+' '+eq.emoji;
    g.textAlign='center'; g.fillStyle='#ffffff';
    const es=ajuste(t,'800',34,MONT,LARG,20);
    g.font='800 '+es+'px '+MONT;
    ecrire(t,W/2,y+192);
  }
  g.textAlign='left';
  y+=H_STATS;

  // ── LA MARQUE ────────────────────────────────────────────────────────
  //
  // LE LOGO DU COACH S'IL EN A UN, SA SIGNATURE SINON — marqueCoachDe tranche,
  // et elle le fait a un seul endroit. Demande de Kevin : l'athlete publie sa
  // seance, le coach y apparait.
  //
  // « REPCORE » RESTE, en dessous et discret. C'etait deja l'arbitrage de
  // l'image precedente et il n'a pas change de raison : ce qui sort de l'app
  // circule sur Instagram, et une image qui ne dit pas d'ou elle vient ne fait
  // connaitre personne. En blanc a 30 %, il ne dispute rien au logo du coach.
  const cxm=W/2;
  if(marque){
    const MH=post?104:140, MW=LARG*0.62;
    const r=Math.min(MW/marque.naturalWidth,MH/marque.naturalHeight);
    const w=Math.round(marque.naturalWidth*r), h=Math.round(marque.naturalHeight*r);
    ombre(true);
    g.globalAlpha=0.95;
    try{ g.drawImage(marque,Math.round(cxm-w/2),y+8,w,h); }catch(e){}
    g.globalAlpha=1;
    y+=h+34;
  } else {
    y+=18;
  }
  ombre(true);
  g.textAlign='center';
  // LA SIGNATURE DE L'ATHLETE. Kevin, 26/09/2026 : « <PRENOM OU PSEUDO> ·
  // REPCORE » a la place du mot-symbole seul, meme police, meme double passe
  // d'ombre, en blanc a 85 %, espacement large. Sans nom a montrer (reglage
  // « rien », ou ni prenom ni pseudo), le mot-symbole d'avant, inchange.
  // La mise en page ne bouge pas : la ligne occupe exactement la place du
  // mot-symbole, et la taille se plie si un nom long depasse la largeur.
  // ⚠ LE DESSIN NE LIT QUE `d`, jamais le dossier (test « L'image reprend
  //   les chiffres de l'écran ») : la signature y est posée par _bilanDonneesDe.
  const sig=String(d.signature||'');
  if(sig){
    const t=sig+' · REPCORE', esp=7;
    let ts=34;
    const larg=()=>{ g.font='700 '+ts+'px '+BEBAS;
      return String(t).split('').reduce((a,c)=>a+g.measureText(c).width+esp,0)-esp; };
    while(larg()>LARG&&ts>22) ts-=1;
    g.fillStyle='rgba(255,255,255,.85)'; g.font='700 '+ts+'px '+BEBAS;
    ecrireEspace(t,cxm,y+30,esp,true);
    _visuelAdresse(g,ecrireEspace,cxm,y+30,ts);
  } else {
    g.fillStyle='rgba(255,255,255,.48)'; g.font='700 34px '+BEBAS;
    ecrireEspace('REPCORE',cxm,y+30,5,true);
    _visuelAdresse(g,ecrireEspace,cxm,y+30,34);
  }
  ombre(false);
  return cv;
}
// ══ LA CARTE DE RECORD ═════════════════════════════════════════════════
//
// Le deuxième visuel 1080×1920 après le bilan de séance, et sur SON modèle :
// mêmes polices (Bebas pour les chiffres, Montserrat pour les libellés), même
// ombre en double passe, même épure — pas de cadre, pas de pastille, le fond
// vient du sélecteur partagé (_visuelPeindreFond).
//
// `record` : {nm, histMax, curMax, gain} — la forme que rend recordsDeSeance
// et que lit _htmlRecordsFin —, plus `date` (ms) et `signature` posés par
// l'appelant. ⚠ LE DESSIN NE LIT QUE SES ARGUMENTS, jamais le dossier : même
// règle que _dessinerBilanSeance, les vignettes du sélecteur en dépendent.
//
// Les outils d'écriture sont ceux du bilan, extraits une fois pour les deux
// cartes de record : la carte seule et le récapitulatif.
function _visuelOutils(g){
  const ombre=(on)=>{
    g.shadowColor=on?'rgba(0,0,0,.78)':'transparent';
    g.shadowBlur=on?12:0;
    g.shadowOffsetX=0; g.shadowOffsetY=on?2:0;
  };
  const ecrire=(t,x,y)=>{ g.fillText(t,x,y); g.fillText(t,x,y);
    const sc=g.shadowColor; g.shadowColor='transparent';
    g.fillText(t,x,y); g.shadowColor=sc; };
  const ecrireEspace=(t,x,y,esp,centre)=>{
    _texteEspace(g,t,x,y,esp,centre); _texteEspace(g,t,x,y,esp,centre);
    const sc=g.shadowColor; g.shadowColor='transparent';
    _texteEspace(g,t,x,y,esp,centre); g.shadowColor=sc; };
  const ajuste=(t,poids,taille,police,max,mini)=>{
    let s=taille;
    g.font=poids+' '+s+'px '+police;
    while(g.measureText(t).width>max&&s>(mini||18)){ s-=1; g.font=poids+' '+s+'px '+police; }
    return s;
  };
  // Le texte espacé, réduit jusqu'à tenir dans `max`.
  const ajusteEspace=(t,poids,taille,police,esp,max,mini)=>{
    t=rcI18nT(t);   // on mesure le texte qui sera réellement dessiné
    let s=taille;
    const larg=()=>{ g.font=poids+' '+s+'px '+police;
      return String(t).split('').reduce((a,c)=>a+g.measureText(c).width+esp,0)-esp; };
    while(larg()>max&&s>(mini||18)) s-=1;
    return s;
  };
  // AU-DELÀ DU PLANCHER DE TAILLE, ON COUPE : un nom de 70 caractères ne tient
  // pas à 24 px, et un texte qui sort de l'image se lit moins bien qu'un « … ».
  // `coupe` pour le texte d'un seul tenant, `coupeEspace` pour l'espacé, à la
  // police déjà posée.
  const coupe=(t,max)=>{
    let v=String(t);
    if(g.measureText(v).width<=max) return v;
    while(v.length>1&&g.measureText(v+'…').width>max) v=v.slice(0,-1);
    return v.replace(/\s+$/,'')+'…';
  };
  const largEspace=(t,esp)=>String(t).split('').reduce((a,c)=>a+g.measureText(c).width+esp,0)-esp;
  const coupeEspace=(t,esp,max)=>{
    let v=String(t);
    if(largEspace(v,esp)<=max) return v;
    while(v.length>1&&largEspace(v+'…',esp)>max) v=v.slice(0,-1);
    return v.replace(/\s+$/,'')+'…';
  };
  return {ombre,ecrire,ecrireEspace,ajuste,ajusteEspace,coupe,coupeEspace};
}
// PURE. « 102,5 » : la virgule française, sans zéro inutile.
function _recKg(v){
  const n=Math.round((Number(v)||0)*100)/100;
  return String(n).replace('.',',');
}
// PURE. Le gain en pourcentage de l'ancien record. Une décimale sous 10 % —
// « +2,5 % » dit quelque chose, « +3 % » arrondirait la moitié du progrès —,
// entier au-delà.
function _recPct(r){
  const h=Number(r&&r.histMax)||0, g=Number(r&&r.gain)||0;
  if(!(h>0)||!(g>0)) return '';
  const p=g/h*100;
  const v=p<10?Math.round(p*10)/10:Math.round(p);
  return String(v).replace('.',',');
}
// PURE. « 26/09/2026 », comme la date du bilan : une image gardée six mois
// doit porter son année.
function _recDate(t){
  try{ return new Date(t||Date.now()).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}); }
  catch(e){ return ''; }
}
// L'ÉCLAIR EN FILIGRANE, derrière le chiffre. Le même geste que rcFoudre
// (déplacement du point milieu), mais TIRÉ D'UNE GRAINE : les trois vignettes
// du sélecteur et le fichier final doivent montrer le même éclair — un hasard
// neuf à chaque dessin ferait changer l'image entre l'aperçu et l'envoi.
function _recGraine(s){
  let h=2166136261;
  for(const c of String(s||'')){ h^=c.charCodeAt(0); h=Math.imul(h,16777619); }
  return h>>>0;
}
function _recAlea(graine){
  let a=graine||1;
  return ()=>{ a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a);
    t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; };
}
function _recEclairFiligrane(g,x1,y1,x2,y2,graine,fond){
  const al=_recAlea(graine);
  let pts=[{x:x1,y:y1},{x:x2,y:y2}];
  let d=Math.hypot(x2-x1,y2-y1)*0.16;
  for(let n=0;n<7;n++){
    const nv=[pts[0]];
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i], b=pts[i+1];
      const dx=b.x-a.x, dy=b.y-a.y, L=Math.hypot(dx,dy)||1, e=(al()*2-1)*d;
      nv.push({x:(a.x+b.x)/2-dy/L*e,y:(a.y+b.y)/2+dx/L*e},b);
    }
    pts=nv; d/=2;
  }
  // Sur le fond rouge, un éclair rouge disparaîtrait : il passe en blanc.
  const coul=fond==='rouge'?'rgba(255,255,255,':'rgba(224,32,32,';
  g.save();
  g.lineJoin='round'; g.lineCap='round';
  g.shadowColor=fond==='rouge'?'rgba(255,255,255,.5)':ROUGE_MARQUE; g.shadowBlur=22;
  g.strokeStyle=coul+'.42)'; g.lineWidth=7;
  g.beginPath(); g.moveTo(pts[0].x,pts[0].y); for(const p of pts) g.lineTo(p.x,p.y); g.stroke();
  g.shadowBlur=0;
  g.strokeStyle=coul+'.75)'; g.lineWidth=2.4;
  g.beginPath(); g.moveTo(pts[0].x,pts[0].y); for(const p of pts) g.lineTo(p.x,p.y); g.stroke();
  g.restore();
}
// L'ADRESSE SOUS LA SIGNATURE (02/10/2026) : RC_ADRESSE_AFFICHEE, sans
// https://, ≈ 60 % de la taille de la signature, blanc à 0,7, avec l'ombre en
// cours (lisible sur le carbone, la photo et le rouge). En Montserrat : une
// adresse se lit en minuscules, le Bebas n'a que des capitales. Pas de QR :
// une story se regarde une seconde, une adresse courte se retient et se tape.
// `adresse` : celle à écrire (tests), RC_ADRESSE_AFFICHEE sinon. Rend la
// hauteur ajoutée sous la ligne de base de la signature (0 sans adresse : le
// visuel est exactement celui d'avant).
function _visuelAdresse(g,ecrireEspace,cx,y,ts,adresse){
  const a=String(adresse===undefined?RC_ADRESSE_AFFICHEE:adresse).trim().replace(/^https?:\/\//i,'').replace(/\/+$/,'');
  if(!a) return 0;
  const taille=Math.max(14,Math.round(ts*0.6)), dy=Math.round(taille*1.45);
  g.save();
  g.fillStyle='rgba(255,255,255,.7)';
  g.font='600 '+taille+"px Montserrat,'Segoe UI',sans-serif";
  ecrireEspace(a,cx,y+dy,2,true);
  g.restore();
  return dy;
}
// La signature du bas, reprise du bilan : « <NOM> · REPCORE », ou le
// mot-symbole seul quand l'athlète a choisi de ne rien montrer ; l'adresse
// dessous (_visuelAdresse). Rend {ts, dy} : la taille de la signature et la
// hauteur ajoutée par l'adresse.
function _recSignature(g,o,sig,y,LARG,adresse){
  const B=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif");
  const cx=g.canvas.width/2;
  o.ombre(true);
  let ts=34;
  if(sig){
    const t=sig+' · REPCORE', esp=7;
    ts=o.ajusteEspace(t,'700',34,B,esp,LARG,22);
    g.fillStyle='rgba(255,255,255,.85)'; g.font='700 '+ts+'px '+B;
    o.ecrireEspace(t,cx,y,esp,true);
  }else{
    g.fillStyle='rgba(255,255,255,.48)'; g.font='700 34px '+B;
    o.ecrireEspace('REPCORE',cx,y,5,true);
  }
  const dy=_visuelAdresse(g,o.ecrireEspace,cx,y,ts,adresse);
  // LE COACH ET LA DATE, en petit, sous la signature (05/10/2026, main) — et
  // sous l'adresse quand elle est là. Le nom de l'athlète, lui, reste celui de
  // son réglage « Nom affiché sur mes visuels » : c'est `sig`, et « rien »
  // reste rien.
  let dy2=0;
  try{
    const l2=_recSignatureLigne2(currentUser);
    // Seulement si elle tient dans l'image : en format post, la signature est
    // à 50 px du bas, et l'adresse en prend déjà une partie.
    if(l2&&y+dy+27<=g.canvas.height-6){
      dy2=27;
      g.save();
      g.textAlign='center'; g.textBaseline='alphabetic';
      g.font="600 17px Montserrat,'Segoe UI',sans-serif";
      g.fillStyle='rgba(255,255,255,.55)';
      g.fillText(l2,cx,y+dy+dy2,LARG);
      g.restore();
    }
  }catch(e){ dy2=0; }
  return {ts,dy:dy+dy2};
}
// PURE. « COACH <NOM> · 05/10/2026 », ou la date seule sans coach.
function _recSignatureLigne2(u,maintenant){
  let coach=''; try{ coach=signatureCoachNom(u); }catch(e){ coach=''; }
  let d=''; try{ d=new Date(maintenant||Date.now()).toLocaleDateString('fr-FR'); }catch(e){ d=''; }
  return [(coach&&u&&u.role!=='coach')?'COACH '+coach.toLocaleUpperCase('fr-FR'):'',d].filter(Boolean).join(' · ');
}
// PURE. Le sur-titre de la carte d'un record.
function surTitreRecord(r){ return (r&&r.objectif)?'OBJECTIF ATTEINT':'NOUVEAU RECORD'; }
/**
 * Le visuel d'UN record.
 * @param {{nm:string,histMax:number,curMax:number,gain:number,date?:number,signature?:string}} record
 * @param {'transparent'|'photo'|'rouge'} [fond]
 */
function _dessinerCarteRecord(record,fond,format,anim){
  const F=visuelFormat(format), W=F.w, H=F.h, post=F.cle==='post';
  const cv=_visuelToile(anim,W,H);
  const g=cv.getContext('2d');
  const f=fond||'transparent';
  if(!(anim&&anim.sansFond)) _visuelPeindreFond(g,W,H,f);
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif");
  const MONT="Montserrat,'Segoe UI',sans-serif";
  const M=72, LARG=W-M*2, cx=W/2;
  const o=_visuelOutils(g);
  const r=record||{};
  const nom=String(r.nm||'').toUpperCase();
  // `anim.valeur` : le chiffre en train de compter (la vidéo). La taille, le
  // filigrane et tout le reste suivent la VRAIE valeur : rien ne saute.
  const vrai=_recKg(r.curMax), anc=(r.type!=='reps'&&Number(r.histMax)>0)?_recKg(r.histMax):'';
  const nouv=(anim&&anim.valeur!=null)?String(anim.valeur):vrai;
  const pct=_recPct(r);
  // Un record d'assistance est une assistance RETIRÉE : pas de « + », pas de %.
  const gainTxt=r.type==='reps'?('+'+(r.reps-r.repsAvant)+' REP'+(r.reps-r.repsAvant>1?'S':'')+' · '+r.reps+' × '+_recKg(r.curMax)+' KG')
    :r.assiste?(Number(r.gain)>0?('−'+_recKg(r.gain)+' KG D’ASSISTANCE'):'')
    :(Number(r.gain)>0?('+'+_recKg(r.gain)+' KG'):'')+(pct?('  ·  +'+pct+' %'):'');

  // ── LA MISE EN PAGE, CENTRÉE COMME CELLE DU BILAN ────────────────────
  // Le creux est transparent : centrer donne une image qu'on pose au milieu
  // d'une story sans avoir à la déplacer.
  const H_TAG=70, H_NOM=128, H_ANC=anc?86:0, H_CHIFFRE=300, H_GAIN=gainTxt?96:0, H_DATE=60;
  const HTOT=H_TAG+H_NOM+H_ANC+H_CHIFFRE+H_GAIN+H_DATE;
  let y=Math.max(post?110:180,Math.round((H-HTOT)/2)-(post?30:40));
  g.textBaseline='alphabetic';

  // LE SUR-TITRE : « NOUVEAU RECORD », ou « OBJECTIF ATTEINT » quand ce
  // record était le record à portée annoncé avant la séance.
  o.ombre(true); g.textAlign='center';
  g.fillStyle='#ffffff'; g.font='800 34px '+MONT;
  o.ecrireEspace(surTitreRecord(r),cx,y+34,10,true);
  // Le trait rouge sous l'étiquette : la seule touche de couleur hors éclair.
  o.ombre(false);
  g.fillStyle=f==='rouge'?'rgba(255,255,255,.85)':ROUGE_MARQUE;
  g.fillRect(cx-44,y+54,88,5);
  y+=H_TAG;

  // Le nom de l'exercice
  o.ombre(true);
  g.fillStyle='rgba(255,255,255,.96)';
  const ns=o.ajuste(nom,'700',104,BEBAS,LARG,44);
  g.font='700 '+ns+'px '+BEBAS;
  o.ecrire(o.coupe(nom,LARG),cx,y+ns*0.86);
  y+=H_NOM;

  // L'ancienne valeur, petite et barrée : on la lit, on sait qu'elle est dépassée.
  if(anc){
    const t=anc+' KG';
    g.fillStyle='rgba(255,255,255,.6)'; g.font='700 62px '+BEBAS;
    o.ecrire(t,cx,y+52);
    const w=g.measureText(t).width;
    o.ombre(false);
    g.strokeStyle=f==='rouge'?'rgba(255,255,255,.9)':ROUGE_MARQUE; g.lineWidth=5;
    g.beginPath(); g.moveTo(cx-w/2-10,y+30); g.lineTo(cx+w/2+10,y+30); g.stroke();
    o.ombre(true);
    y+=H_ANC;
  }

  // LE CHIFFRE, en très gros. L'éclair passe DERRIÈRE : dessiné d'abord, il
  // traverse la zone du chiffre de haut en bas, un peu en biais — et elle
  // seule : sur le nom ou l'ancienne valeur, il les rayerait.
  const base=y+H_CHIFFRE-24;
  _recEclairFiligrane(g,cx+190,y+8,cx-150,base+30,_recGraine(nom+'|'+vrai),f);
  // Le nombre et « KG » mesurés ensemble, puis réduits ensemble s'ils
  // débordent : « 227,5 » à 300 px ne tient pas avec son unité.
  let cs=300;
  const mesure=(v)=>{ g.font='700 '+cs+'px '+BEBAS; const a=g.measureText(v).width;
    g.font='700 '+Math.round(cs*0.3)+'px '+BEBAS; return a+14+g.measureText('KG').width; };
  while(mesure(vrai)>LARG&&cs>120) cs-=4;
  while(mesure(nouv)>LARG&&cs>120) cs-=4;
  const total=mesure(nouv);
  if(anim) anim.geo={x:cx,y:base-cs*0.38,taille:cs};
  g.font='700 '+cs+'px '+BEBAS;
  const wN=g.measureText(nouv).width;
  const x0=cx-total/2;
  o.ombre(true);
  g.textAlign='left'; g.fillStyle='#ffffff';
  o.ecrire(nouv,x0,base);
  g.font='700 '+Math.round(cs*0.3)+'px '+BEBAS;
  g.fillStyle='rgba(255,255,255,.9)';
  o.ecrire('KG',x0+wN+14,base);
  g.textAlign='center';
  y+=H_CHIFFRE;

  // « +X KG · +Y % »
  if(gainTxt){
    g.fillStyle='#ffffff';
    const gs=o.ajusteEspace(gainTxt,'800',46,MONT,4,LARG,26);
    g.font='800 '+gs+'px '+MONT;
    o.ecrireEspace(gainTxt,cx,y+60,4,true);
    y+=H_GAIN;
  }
  // La date
  g.fillStyle='rgba(255,255,255,.82)'; g.font='700 30px '+MONT;
  o.ecrireEspace(_recDate(r.date),cx,y+36,4,true);

  // LA SIGNATURE, EN BAS DE L'IMAGE et non sous le bloc : c'est une marque,
  // elle a sa place fixe, là où l'œil la cherche.
  _recSignature(g,o,String(r.signature||''),H-(post?80:150),LARG);
  o.ombre(false);
  return cv;
}
/**
 * Le visuel de PLUSIEURS records : « 3 NOUVEAUX RECORDS » et une ligne par
 * record, dans l'ordre de l'écran.
 * @param {{records:Array<{nm:string,histMax:number,curMax:number,gain:number}>,date?:number,signature?:string}} d
 * @param {'transparent'|'photo'|'rouge'} [fond]
 */
function _dessinerCarteRecords(d,fond,format){
  const F=visuelFormat(format), W=F.w, H=F.h, post=F.cle==='post';
  const cv=document.createElement('canvas');
  cv.width=W; cv.height=H;
  const g=cv.getContext('2d');
  const f=fond||'transparent';
  _visuelPeindreFond(g,W,H,f);
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif");
  const MONT="Montserrat,'Segoe UI',sans-serif";
  const M=72, LARG=W-M*2, cx=W/2;
  const o=_visuelOutils(g);
  const l=((d&&d.records)||[]).filter(r=>r&&r.nm&&r.curMax>0);
  const n=l.length;
  // En post, le titre et les lignes se resserrent : quatre records tiennent
  // entre le haut et la signature.
  const LH=post?(n<=3?170:152):(n<=3?196:170);
  const H_TITRE=post?214:250, H_DATE=post?58:70, H_LISTE=n*LH;
  let y=Math.max(post?70:180,Math.round((H-(H_TITRE+H_DATE+H_LISTE))/2)-(post?20:40));
  g.textBaseline='alphabetic';

  // LE TITRE, l'éclair derrière lui cette fois : c'est lui le chiffre à lire.
  const titre=n+' NOUVEAUX RECORDS';
  _recEclairFiligrane(g,cx+170,y-10,cx-130,y+185,_recGraine(l.map(r=>r.nm).join('|')),f);
  o.ombre(true); g.textAlign='center'; g.fillStyle='#ffffff';
  const [chiffre,...reste]=titre.split(' ');
  // Le nombre en très gros, le mot en dessous : « 3 » se lit d'abord.
  g.font='700 '+(post?180:210)+'px '+BEBAS;
  o.ecrire(chiffre,cx,y+(post?146:170));
  const ts=o.ajusteEspace(reste.join(' '),'800',40,MONT,9,LARG,24);
  g.font='800 '+ts+'px '+MONT;
  o.ecrireEspace(reste.join(' '),cx,y+(post?196:226),9,true);
  y+=H_TITRE;
  g.fillStyle='rgba(255,255,255,.82)'; g.font='700 30px '+MONT;
  o.ecrireEspace(_recDate(d&&d.date),cx,y+30,4,true);
  y+=H_DATE;

  // LES LIGNES. Le nom en haut, puis l'ancienne valeur barrée, la nouvelle
  // en gros et le gain — la carte seule en réduction.
  l.forEach((r,i)=>{
    const yy=y+i*LH;
    o.ombre(false);
    g.strokeStyle='rgba(255,255,255,.4)'; g.lineWidth=2;
    g.beginPath(); g.moveTo(M,yy); g.lineTo(W-M,yy); g.stroke();
    o.ombre(true);
    g.textAlign='left'; g.fillStyle='rgba(255,255,255,.96)';
    const nom=String(r.nm).toUpperCase();
    const ns=o.ajuste(nom,'700',54,BEBAS,LARG,28);
    g.font='700 '+ns+'px '+BEBAS;
    if(g.measureText(nom).width>LARG) _texteCoupe(g,nom,M,yy+62,LARG); else o.ecrire(nom,M,yy+62);
    // La valeur, à droite : ancienne barrée, puis la nouvelle.
    const nouv=_recKg(r.curMax)+' KG';
    g.textAlign='right'; g.fillStyle='#ffffff'; g.font='700 96px '+BEBAS;
    o.ecrire(nouv,W-M,yy+160);
    let dx=W-M-g.measureText(nouv).width-28;
    if(r.type!=='reps'&&Number(r.histMax)>0){
      const a=_recKg(r.histMax);
      g.fillStyle='rgba(255,255,255,.6)'; g.font='700 48px '+BEBAS;
      o.ecrire(a,dx,yy+150);
      const w=g.measureText(a).width;
      o.ombre(false);
      g.strokeStyle=f==='rouge'?'rgba(255,255,255,.9)':ROUGE_MARQUE; g.lineWidth=4;
      g.beginPath(); g.moveTo(dx-w-6,yy+134); g.lineTo(dx+6,yy+134); g.stroke();
      o.ombre(true);
    }
    // Le gain à gauche, sous le nom.
    const pct=_recPct(r);
    g.textAlign='left'; g.fillStyle='rgba(255,255,255,.9)'; g.font='800 32px '+MONT;
    o.ecrireEspace(r.type==='reps'?('+'+(r.reps-r.repsAvant)+' REP · '+r.reps+' × '+_recKg(r.curMax)+' KG'):r.assiste?('−'+_recKg(r.gain)+' KG D’ASSISTANCE'):('+'+_recKg(r.gain)+' KG'+(pct?(' · +'+pct+' %'):'')),M,yy+150,2);
  });
  _recSignature(g,o,String((d&&d.signature)||''),H-(post?64:150),LARG);
  o.ombre(false);
  return cv;
}
// Ecrit un texte en l espacant, l API canvas n ayant pas de letter-spacing
// fiable partout.
function _texteEspace(g,t,x,y,esp,centre){
  // La langue : le libellé est traduit AVANT d'être découpé en lettres.
  const cs=String(rcI18nT(t)).split('');
  const w=cs.reduce((a,c)=>a+g.measureText(c).width+esp,0)-esp;
  let cx=centre?x-w/2:x;
  const alg=g.textAlign; g.textAlign='left';
  for(const c of cs){ g.fillText(c,cx,y); cx+=g.measureText(c).width+esp; }
  g.textAlign=alg;
}
// Reduit la taille jusqu a ce que le texte tienne : un nom de seance long ne
// doit pas deborder de la carte.
function _texteAjuste(g,t,x,y,max,taille,police){
  let s=taille;
  g.font='700 '+s+'px '+police;
  while(g.measureText(t).width>max&&s>28){ s-=2; g.font='700 '+s+'px '+police; }
  g.fillText(t,x,y);
}
// Coupe avec des points de suspension, plutot que de laisser deborder sur la
// colonne des series.
function _texteCoupe(g,t,x,y,max){
  let v=String(t);
  if(g.measureText(v).width<=max){ g.fillText(v,x,y); return; }
  while(v.length>1&&g.measureText(v+'…').width>max) v=v.slice(0,-1);
  g.fillText(v+'…',x,y);
}
// LE GESTE. Sur telephone, `<a download>` ne met rien dans la galerie : iOS
// l ignore et Android depose dans « Telechargements ». La feuille de partage
// native propose « Enregistrer l image » ET Instagram — c est celle-la qu on
// veut. Le telechargement reste le repli sur ordinateur.
// dataURL -> Blob, SANS attente. fetch(dataURL) ou toBlob rendraient une
// promesse, et l autorisation de partager serait perdue le temps qu elle se
// resolve.
//
// JPEG ET NON PNG. Mesure sur le rendu 1080x1920 reel : l encodage PNG prend
// 13 105 ms et pese 1 048 Ko ; le JPEG a 0,92 prend 59 ms et pese 118 Ko.
// Deux cent vingt fois plus rapide, neuf fois plus leger, pour une image qui
// n a aucune transparence a preserver. Le PNG bloquait l application treize
// secondes, et faisait donc expirer le geste utilisateur qu on cherche
// justement a preserver.
// Le type est LU dans l'en-tête de la dataURL : un JPEG déclaré PNG part
// avec le mauvais type, et certaines applications le refusent.
function _b64versBlob(dataUrl){
  const i=dataUrl.indexOf(',');
  const m=/^data:([^;,]+)/.exec(dataUrl.slice(0,i));
  const bin=atob(dataUrl.slice(i+1));
  const n=bin.length;
  const u=new Uint8Array(n);
  for(let k=0;k<n;k++) u[k]=bin.charCodeAt(k);
  return new Blob([u],{type:m?m[1]:'image/png'});
}
// PURE. Le nom de fichier accordé au format RÉELLEMENT produit : un appelant
// qui passe « repcore-seance.png » avec un format JPEG (visuelFondFormat)
// obtient « repcore-seance.jpg ». Sans format, PNG — ce que toDataURL rend.
function _nomSelonFormat(nom,fmt){
  const ext=(fmt&&fmt.ext)||'png';
  const base=String(nom||'repcore').replace(/\.(png|jpe?g|webp)$/i,'');
  return base+'.'+ext;
}
// L ecran de secours, et le seul geste qui marche sur TOUS les telephones :
// l appui long sur une image affichee. iOS propose « Ajouter aux photos »,
// Android « Telecharger l image ». On le dit, parce que personne ne devine
// qu il faut appuyer longtemps.
// `nomFichier` et `fmt` : le nom et le type RÉELS (visuelNomFichier,
// visuelFondFormat) — le lien « Télécharger » nommait « repcore-seance.png »
// un bilan, un record ou un JPEG.
function _ouvrirApercuStory(url,nomFichier,fmt){
  document.getElementById('story-apercu')?.remove();
  const nom=_nomSelonFormat(nomFichier||'repcore-visuel',fmt);
  const d=document.createElement('div');
  d.id='story-apercu';
  d.style.cssText='position:fixed;inset:0;z-index:var(--z-modal);background:var(--scrim);display:flex;'
    +'flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:20px';
  d.innerHTML='<img src="'+url+'" alt="Ton visuel RepCore" '
    +'style="max-width:100%;max-height:64vh;border-radius:var(--r-3);box-shadow:var(--e3)">'
    +'<div style="font-size:var(--fs-sm);color:var(--text-strong);text-align:center;line-height:1.6;max-width:320px">'
    +'Appuie <b>longuement</b> sur l’image, puis choisis <b>Ajouter aux photos</b> '
    +'(iPhone) ou <b>Télécharger l’image</b> (Android).</div>'
    +'<a href="'+url+'" download="'+escapeHtml(nom)+'" type="'+escapeHtml((fmt&&fmt.type)||'image/png')+'" class="btn btn-outline btn-sm" '
    +'style="width:auto;padding:8px 20px">Télécharger</a>'
    +'<button type="button" class="btn btn-outline btn-sm" style="width:auto;padding:8px 20px" '
    +'onclick="fermerApercuStory()">Fermer</button>';
  document.body.appendChild(d);
}
function fermerApercuStory(){
  const d=document.getElementById('story-apercu');
  if(!d) return false;
  // L URL de l objet n est relachee qu A LA FERMETURE : la relacher plus tot
  // viderait l image que l athlete est justement en train de garder appuyee.
  const img=d.querySelector('img');
  const u=img&&img.src;
  d.remove();
  if(u&&u.indexOf('blob:')===0) setTimeout(()=>{ try{ URL.revokeObjectURL(u); }catch(e){} },1000);
  return true;
}
// iOS, iPadOS compris. Le second test n'est pas une coquetterie : depuis
// iPadOS 13, un iPad se declare « MacIntel » et se confondrait avec un Mac de
// bureau — seul le nombre de points de contact les separe.
function _estIOS(){
  try{
    const n=(typeof navigator!=='undefined')?navigator:null;
    if(!n) return false;
    const p=String(n.platform||''), u=String(n.userAgent||'');
    if(/iP(hone|ad|od)/.test(p)||/iP(hone|ad|od)/.test(u)) return true;
    return /Mac/.test(p)&&(n.maxTouchPoints||0)>1;
  }catch(e){ return false; }
}
// ══ LA SORTIE D'UNE IMAGE : UN SEUL CHEMIN POUR LES DEUX ═══════════════
//
// Ce bloc etait ecrit deux fois, dans telechargerSeanceDuJour et dans
// partagerSeanceDuJour. Une troisieme image — le bilan de seance — en aurait
// fait quatre copies, et la regle iOS qui vit dedans est precisement celle
// qu'on ne peut pas se permettre de laisser diverger : Safari refuse la
// navigation de premier niveau vers une URL `data:`, et l'echec est MUET —
// a.click() ne rend ni evenement, ni promesse, ni exception.
//
// TOUT EST SYNCHRONE, et ce n'est pas un detail : le moindre await
// consommerait le geste utilisateur, et iOS refuserait le partage.
// LE LIEN DE L'ATHLETE, COPIE A LA SORTIE D'UN VISUEL. Seulement si
// lienPerso() existe (idee 16) : sans elle, rien du tout. Instagram ne lit pas
// les liens poses sur une image ; le sticker « Lien » de la story, si. On met
// donc le lien dans le presse-papiers au moment ou l'athlete s'apprete a
// publier, et on lui dit quoi en faire.
function _storyCopierLien(src){
  if(typeof lienPerso!=='function') return false;
  try{
    const l=lienPerso(src||'visuel');
    if(!l||!navigator.clipboard||!navigator.clipboard.writeText) return false;
    navigator.clipboard.writeText(String(l))
      .then(()=>{
        toast('Lien copié · colle-le avec le sticker Lien','var(--green)',4000);
        try{ attribCompter('copie',src||'visuel'); }catch(e){}
        // LA PREMIÈRE FOIS : les trois étapes du sticker Lien, en images fixes.
        try{ montrerTutoSticker(); }catch(e){}
      })
      .catch(()=>{});
    return true;
  }catch(e){ return false; }
}
// ══ LA LÉGENDE D'UN POST (28/09/2026) ═══════════════════════════════════
// Une story se partage avec le sticker Lien (le lien est copié). Un POST se
// publie avec une légende : on l'écrit pour l'athlète, on la copie, il la
// colle sous sa photo. Trois à cinq modèles par visuel, tutoiement (on parle
// à qui lit), un ⚡ au plus, jamais deux fois le même de suite. Toujours
// « #RepCore », le compte Instagram de RepCore quand il est renseigné, et
// « Lien dans ma bio » si la page publique de la personne est en ligne.
//
// LE COMPTE INSTAGRAM OFFICIEL (Kevin, 02/10/2026), avec son @ : il ferme
// chaque légende (après « Lien dans ma bio »), et la coupe d'une légende trop
// longue raccourcit le texte, jamais lui. Vide, il n'apparaît pas.
const RC_COMPTE_INSTAGRAM='@kevin.gllc';
// L'ADRESSE ÉCRITE SOUS LA SIGNATURE DES VISUELS (02/10/2026), sans https:// :
// celle qu'on peut taper après avoir vu une story. Vide : rien de plus, le
// visuel est celui d'avant. Pas de QR (voir _visuelAdresse).
const RC_ADRESSE_AFFICHEE='repcore-sync.web.app';
const LEGENDE_MAX=220;
const _moisInvite=()=>TARIFS.essai.mois+TARIFS.essai_parrainage.moisEnPlus;
const _LEGENDES=Object.freeze({
  bilan:[d=>'Séance bouclée. Et toi, tu t’entraînes quand cette semaine ?',
    d=>'Une de plus au compteur ⚡ Et toi, tu en es où cette semaine ?',
    d=>'Pas de séance parfaite, juste une séance faite. Tu viens ?',
    d=>'Tout est noté : les charges, les séries, les reps. Tu fais pareil ?'],
  record:[d=>(d.exo?'Nouveau record sur '+d.exo+' ⚡':'Nouveau record ⚡')+' Tu crois que je m’arrête là ?',
    d=>'Record battu. Le travail paie, et tu le sais.',
    d=>'Plus lourd que la dernière fois. Et toi, ton prochain record ?',
    d=>'Petit à petit, la barre monte. Tu suis ?'],
  records:[d=>'Plusieurs records dans la même séance ⚡ Tu fais mieux ?',
    d=>'Journée à records. Tu sais ce qui t’attend si tu t’y mets.',
    d=>'Les charges montent, séance après séance. Et toi ?'],
  serie:[d=>(d.semaines?d.semaines+' semaines d’affilée':'Série en cours')+' ⚡ Tu tiens combien, toi ?',
    d=>'Pas une semaine ratée. La régularité bat la motivation, tu verras.',
    d=>(d.semaines?d.semaines+' semaines':'Semaine après semaine')+' sans lâcher. Tu te lances ?',
    d=>'La série continue. Ton tour ?'],
  rang:[d=>'Nouveau rang'+(d.nom?' : '+d.nom:'')+' ⚡ Tu montes avec moi ?',
    d=>'Un palier de plus. Chaque séance compte, tu le sais.',
    d=>'Rang débloqué'+(d.nom?' : '+d.nom:'')+'. Et toi, tu en es où ?'],
  cycle:[d=>'Cycle terminé. Le suivant commence demain, tu viens ?',
    d=>'Quatre semaines tenues ⚡ Tu signes pour le prochain ?',
    d=>'Un cycle de plus derrière moi. Et toi, ton prochain objectif ?'],
  defi:[d=>'Défi relevé'+(d.titre?' : « '+d.titre+' »':'')+' ⚡ Tu relèves le prochain ?',
    d=>'Relevé jusqu’au bout. Tu t’y mets avec nous ?',
    d=>'Défi validé. Le prochain, tu le fais avec nous ?'],
  champion:[d=>'Champion du défi ⚡ Tu viens me détrôner ?',
    d=>'Premier du défi'+(d.titre?' « '+d.titre+' »':'')+'. Le prochain, tu tentes ta chance ?',
    d=>'Défi gagné. Tu crois pouvoir faire mieux ?'],
  badge:[d=>'Badge débloqué'+(d.nom?' : '+d.nom:'')+' ⚡ Tu l’as, toi ?',
    d=>'Un badge de plus dans la collection. Tu commences la tienne ?',
    d=>'Celui-là, il se mérite. Tu tentes ?'],
  muscles:[d=>'Ma semaine, muscle par muscle ⚡ Et toi, tu as travaillé quoi ?',
    d=>'Tout ce qui a travaillé cette semaine. Tu regardes la tienne ?',
    d=>'Rien n’a été oublié. Tu vérifies ton équilibre ?'],
  wrapped:[d=>(d.seances?d.seances+' séances':'Mon mois')+' en chiffres ⚡ Et toi, ton bilan ?',
    d=>'Le résumé qui fait plaisir. Tu regardes le tien ?',
    d=>'Un mois de travail, en cinq images. Tu te lances ?',
    d=>'Les chiffres ne mentent pas. Ton tour ?'],
  avant:[d=>'Avant, après. Le temps et la régularité ⚡ Tu commences quand ?',
    d=>'Même personne, quelques mois plus tard. Tu te lances ?',
    d=>'Pas de raccourci : des séances, et encore des séances. Et toi ?'],
  victoire:[d=>'Victoire de la semaine ⚡ Fier de mon athlète. Et toi, ton objectif ?',
    d=>'Le travail de mon athlète, en un chiffre. Tu veux le même suivi ?',
    d=>'Chaque kilo se gagne. Tu viens t’entraîner avec nous ?'],
  team:[d=>'La team a tout donné cette semaine ⚡ Tu nous rejoins ?',
    d=>'Toute l’équipe, en chiffres. Tu veux en faire partie ?',
    d=>'Séances, records, tonnage : la team avance. Et toi ?'],
  // Le CODE est dans chaque modèle (celui qui lit le post ne peut pas
  // cliquer : il recopie). Sans code connu, on dit de le demander.
  // L'ESSAI PARRAINÉ (02/10/2026) : essai.mois + essai_parrainage.moisEnPlus
  // (tarifs.json, 2 mois), comme invitationDonnees et les pages publiques — les
  // légendes disaient « ton premier mois est offert ».
  invitation:[d=>'Je double ton essai RepCore : '+_moisInvite()+' mois ⚡ '+(d.code?'Mon code : '+d.code+'.':'Demande-moi mon code.')+' Tu t’y mets ?',
    d=>'Tu cherches une app pour suivre tes séances ? '+(d.code?'Avec le code '+d.code+', ton':'Avec mon code, ton')+' essai passe à '+_moisInvite()+' mois, sans carte.',
    d=>'On s’entraîne ensemble ? '+(d.code?'Code '+d.code+' à l’inscription : ':'Mon code à l’inscription : ')+_moisInvite()+' mois d’essai pour toi au lieu de '+TARIFS.essai.mois+'.',
    d=>'Toute l’app ouverte, sans carte bancaire, pendant '+_moisInvite()+' mois. '+(d.code?'Ton code : '+d.code+'.':'Demande-moi mon code.')+' Tu viens ?'],
  saison:[d=>'Édition bouclée ⚡ Tu étais de la partie ?',
    d=>'Une édition, un badge, jamais réédité. Tu l’as eu, toi ?',
    d=>'Objectif tenu jusqu’au bout. La prochaine, tu viens ?'],
  duel:[d=>'Duel lancé ⚡ Qui tient le plus longtemps ? Tu relèves ?',
    d=>'Un contre un, pas de cadeau. Et toi, tu défies qui ?',
    d=>'Le duel est tranché. Tu veux ta revanche ?'],
  carte:[d=>'Ma carte d’athlète'+(d.note?' : '+d.note:'')+' ⚡ Et toi, tu sortirais combien ?',
    d=>'Force, volume, régularité, progression, endurance : tout est noté. Tu montes à combien ?',
    d=>(d.note?d.note+' de note globale.':'Ma note monte.')+' Douze semaines de travail. Tu relèves le défi ?'],
  visuel:[d=>'Une séance de plus ⚡ Et toi, tu t’entraînes quand ?',
    d=>'La régularité, c’est tout. Tu viens ?',
    d=>'Chaque séance compte. Tu te lances ?']
});
/**
 * La légende d'un visuel. `donnees` : ce qui la rend précise quand on le sait
 * ({exo}, {semaines}, {nom}, {titre}, {seances}). `o.u` : la personne (sa page
 * publique) ; `o.indice` : le modèle voulu (tests), sinon tiré au hasard sans
 * reprendre le dernier de ce type.
 */
function legendePartage(type,donnees,o){
  const opt=o||{};
  const k=_LEGENDES[type]?type:'visuel';
  const l=_LEGENDES[k];
  const cle='rc_legende_'+k;
  let der=-1;
  try{ const v=localStorage.getItem(cle); der=v===null?-1:Number(v); if(!isFinite(der)) der=-1; }catch(e){ der=-1; }
  let i;
  if(Number.isInteger(opt.indice)) i=((opt.indice%l.length)+l.length)%l.length;
  else{
    i=Math.floor(Math.random()*l.length);
    if(l.length>1&&i===der) i=(i+1+Math.floor(Math.random()*(l.length-1)))%l.length;
  }
  try{ localStorage.setItem(cle,String(i)); }catch(e){}
  // LES DONNÉES SONT BORNÉES AVANT D'ENTRER : un nom d'exercice de 200
  // caractères prendrait toute la légende, et la coupe emporterait la
  // question qui s'adresse au lecteur. 40 caractères au plus, sans ⚡.
  const net={};
  for(const [c,v] of Object.entries(donnees||{})){
    if(typeof v!=='string'){ net[c]=v; continue; }
    const x=v.replace(/⚡/g,'').replace(/\s+/g,' ').trim();
    net[c]=x.length>40?x.slice(0,39).replace(/\s+\S*$/,'')+'…':x;
  }
  let corps=String(l[i](net)||'').replace(/\s+/g,' ').trim();
  // Un ⚡ au plus : une donnée qui en apporterait un second le perd.
  let vu=false;
  corps=corps.replace(/⚡/g,()=>{ if(vu) return ''; vu=true; return '⚡'; }).replace(/\s+/g,' ').trim();
  const u=opt.u!==undefined?opt.u:((typeof currentUser!=='undefined')?currentUser:null);
  let bio=false; try{ bio=!!urlPagePerso(u); }catch(e){ bio=false; }
  // LE COMPTE OFFICIEL EN DERNIER : « #RepCore · Lien dans ma bio · @compte ».
  const compte=String((opt.compte!==undefined?opt.compte:RC_COMPTE_INSTAGRAM)||'').trim();
  const fin='#RepCore'+(bio?' · Lien dans ma bio':'')+(compte?' · '+compte:'');
  // Une donnée trop longue (un titre de défi) raccourcit le corps, jamais la fin.
  const place=LEGENDE_MAX-1-fin.length-1;
  if(corps.length>place) corps=corps.slice(0,place-1).replace(/\s+\S*$/,'')+'…';
  return corps+'\n'+fin;
}
// Ce que l'écran en cours sait du visuel (pour une légende précise). Chaque
// lecture est protégée : l'absence donne la légende générale.
function _legendeDonneesEcran(type){
  const d={};
  try{
    if(type==='serie'&&_serieCourante) d.semaines=Number(_serieCourante.semaines)||0;
    if(type==='rang'&&_rangCourant) d.nom=String(_rangCourant.nom||'');
    if((type==='defi'||type==='champion')&&_defiCourant) d.titre=String(_defiCourant.titre||'').slice(0,60);
    if(type==='wrapped'&&_wr&&_wr.w) d.seances=Number(_wr.w.seances)||0;
    if(type==='carte'&&currentUser&&currentUser.carte) d.note=Number(currentUser.carte.globale)||0;
    if(type==='invitation'){ const c=invitationDonnees(currentUser).code; if(c) d.code=c; }
  }catch(e){}
  return d;
}
// LA LÉGENDE PRÉPARÉE : « Voir la légende » la montre et la laisse modifier ;
// la sortie suivante du même type utilise CELLE-LÀ, puis l'oublie.
const _legendePrete={};
function _legendePour(type){
  const k=_LEGENDES[type]?type:'visuel';
  if(_legendePrete[k]){ const t=_legendePrete[k]; delete _legendePrete[k]; return t; }
  return legendePartage(k,_legendeDonneesEcran(k));
}
// PURE. Un fichier de post (repcore-<type>-post.jpg) ?
function _estPost(nomFichier){ return /-post\.(jpe?g|png)$/i.test(String(nomFichier||'')); }
// La légende dans le presse-papiers, DANS le geste (Safari refuse l'écriture
// hors d'un geste de l'utilisateur).
function _storyCopierLegende(texte){
  try{
    if(!navigator.clipboard||!navigator.clipboard.writeText) return false;
    navigator.clipboard.writeText(String(texte)).then(()=>{
      toast('Légende copiée · colle-la sous ta photo','var(--green)',4000);
    }).catch(()=>{});
    return true;
  }catch(e){ return false; }
}
// En post : la légende. En story : le lien (sticker Lien), comme avant.
function _storyCopierSelonFormat(nomFichier,legende){
  return _estPost(nomFichier)?_storyCopierLegende(legende):_storyCopierLien(srcDuVisuel(nomFichier));
}
// ── « Voir la légende » : lue, modifiable, copiée avant le partage ───────
// Le type suit le sélecteur de fond de l'écran (son id).
const _TYPE_DU_SELECTEUR=Object.freeze({'wd-fonds':'bilan','sd-fonds':'bilan','dfe-fonds':'defi','bdg-ecran-fonds':'badge',
  'bdg-fiche-fonds':'badge','rg-fonds':'rang','rite-fonds':'cycle','serie-fonds':'serie','vc-fonds':'victoire','pr-fonds':'invitation'});
function typeDuSelecteur(id){
  const s=String(id||'');
  if(/^musc-/.test(s)) return 'muscles';
  try{ if(s==='vc-fonds'&&_vc&&_vc.type==='recap') return 'team'; }catch(e){}
  try{ if(s==='dfe-fonds'&&_defiCourant&&_defiCourant.champion) return 'champion'; }catch(e){}
  return _TYPE_DU_SELECTEUR[s]||'visuel';
}
function voirLegende(type){
  const t=_LEGENDES[type]?type:'visuel';
  const texte=_legendePrete[t]||legendePartage(t,_legendeDonneesEcran(t));
  _legendePrete[t]=texte;
  document.getElementById('legende-ecran')?.remove();
  const d=document.createElement('div');
  d.id='legende-ecran';
  d.setAttribute('role','dialog'); d.setAttribute('aria-modal','true'); d.setAttribute('aria-label','Légende du post');
  d.style.cssText='position:fixed;inset:0;z-index:var(--z-modal);background:var(--scrim);display:flex;align-items:center;justify-content:center;padding:20px';
  d.innerHTML='<div style="width:min(420px,100%);background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:16px">'
    +'<div style="font-weight:800;margin-bottom:6px">La légende de ton post</div>'
    +'<div class="sub" style="font-size:var(--fs-xs);margin-bottom:10px">Modifie-la si tu veux : c’est elle qui sera copiée au partage en post.</div>'
    +'<textarea id="legende-texte" rows="5" maxlength="'+LEGENDE_MAX+'" style="width:100%;box-sizing:border-box" oninput="legendeModifiee(\''+t+'\',this.value)">'
    +escapeHtml(texte)+'</textarea>'
    +'<div class="sub" id="legende-compte" style="font-size:var(--fs-2xs);text-align:right;margin:4px 0 10px">'+texte.length+' / '+LEGENDE_MAX+'</div>'
    +'<div style="display:flex;gap:8px">'
    +'<button type="button" class="btn btn-red btn-sm" style="flex:1;margin:0;min-height:44px" onclick="copierLegende(\''+t+'\')">Copier</button>'
    +'<button type="button" class="btn btn-outline btn-sm" style="flex:0 0 auto;width:auto;padding:0 16px;margin:0;min-height:44px" onclick="fermerLegende()">Fermer</button>'
    +'</div></div>';
  d.addEventListener('click',e=>{ if(e.target===d) fermerLegende(); });
  document.body.appendChild(d);
  return texte;
}
function legendeModifiee(type,v){
  const t=String(v||'').slice(0,LEGENDE_MAX);
  _legendePrete[type]=t;
  const c=document.getElementById('legende-compte'); if(c) c.textContent=t.length+' / '+LEGENDE_MAX;
  return t;
}
function copierLegende(type){
  const x=document.getElementById('legende-texte');
  const t=legendeModifiee(type,x?x.value:(_legendePrete[type]||''));
  _storyCopierLegende(t);
  return t;
}
function fermerLegende(){ document.getElementById('legende-ecran')?.remove(); return true; }

// `fmt` FACULTATIF (visuelFondFormat) : JPEG qualité 0,9 quand le visuel a un fond, PNG sinon.
//
// ⚠ LE LIEN EST COPIÉ D'ABORD, DANS LE GESTE. Il ne l'était qu'après le
//   téléchargement, et jamais sur iPhone (la branche de l'aperçu rendait la
//   main avant) : or c'est là que la story se publie, et le presse-papiers
//   refuse une écriture hors du geste de l'utilisateur.
function _storySortirTelechargement(cv,nomFichier,fmt){
  const jpeg=!!(fmt&&fmt.type==='image/jpeg');
  const dataUrl=jpeg?cv.toDataURL('image/jpeg',fmt.q||0.9):cv.toDataURL('image/png');
  cv.width=0; cv.height=0;            // 8 Mo rendus tout de suite
  const nom=_nomSelonFormat(nomFichier,jpeg?fmt:null);
  try{ attribCompter('telechargement',srcDuVisuel(nomFichier)); }catch(e){}
  // Story : le lien (sticker Lien). Post : la légende, à coller sous la photo.
  _storyCopierSelonFormat(nomFichier,_estPost(nomFichier)?_legendePour(srcDuVisuel(nomFichier)):'');
  if(_estIOS()){ _ouvrirApercuStory(dataUrl,nom,jpeg?fmt:{type:'image/png',ext:'png'}); return true; }
  const a=document.createElement('a');
  a.href=dataUrl;                     // pas d'URL d'objet : rien a liberer,
  a.download=nom;                     // et rien qui puisse expirer trop tot
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast('Image téléchargée','var(--green)');
  return true;
}
// Rend false quand le partage natif n'existe pas : l'appelant retombe alors
// sur le telechargement, qui est ce que l'athlete attendait de toute facon.
// `meta` est FACULTATIF et porte {title,text,url}. Le bilan de seance appelle
// sans lui et son comportement ne bouge pas d'un octet.
//
// ⚠ TEXTE + FICHIER, LE PIEGE iOS. Sur plusieurs versions de Safari, joindre
// `text` ou `url` a un `files` fait TOMBER LE FICHIER : la feuille s'ouvre avec
// un lien nu, l'image a disparu, et rien ne le dit. On ne suppose donc rien —
// on DEMANDE au navigateur, avec la charge exacte qu'on s'apprete a envoyer, et
// on retombe sur le fichier seul des qu'il repond non. L'image est ce qu'on
// partage ; le texte n'est qu'un bonus, et un bonus ne coute pas le principal.
function _storySortirPartage(cv,nomFichier,meta,fmt){
  const jpeg=!!(fmt&&fmt.type==='image/jpeg');
  const dataUrl=jpeg?cv.toDataURL('image/jpeg',fmt.q||0.9):cv.toDataURL('image/png');
  cv.width=0; cv.height=0;
  const blob=_b64versBlob(dataUrl);
  let f=null;
  try{ f=new File([blob],_nomSelonFormat(nomFichier,jpeg?fmt:null),{type:jpeg?'image/jpeg':'image/png'}); }catch(e){}
  if(f&&navigator.canShare&&navigator.canShare({files:[f]})&&navigator.share){
    let charge={files:[f]};
    // LA LÉGENDE VOYAGE AUSSI DANS `text` (quand le navigateur l'accepte avec
    // le fichier) : certaines applications la reprennent d'elles-mêmes.
    const legende=_legendePour(srcDuVisuel(nomFichier));
    const riche=Object.assign({files:[f]},Object.assign({text:legende},meta||{}));
    try{ if(navigator.canShare(riche)) charge=riche; }catch(e){}
    _storyCopierSelonFormat(nomFichier,legende);
    // UN PARTAGE RÉUSSI, c'est une feuille de partage RÉSOLUE (pas annulée).
    navigator.share(charge).then(()=>{ try{ attribCompter('partage',srcDuVisuel(nomFichier)); }catch(e){} }).catch(()=>{});
    return true;
  }
  return false;
}
// ══ LA VIDÉO D'UN VISUEL : record, rang, Wrapped (28/09/2026) ═══════════
// Une story ou un Reel qui BOUGE se regarde jusqu'au bout ; une image fixe se
// saute. La vidéo reprend l'animation de l'app — la foudre qui frappe, le
// chiffre qui compte — et la fige une seconde à la fin, sur la carte qu'on
// aurait partagée en image.
//
// COMMENT. Une toile 1080×1920 redessinée image par image ; le TEMPS DE LA
// VIDÉO pilote tout (foudre : _foudreScene/_foudrePeindre ; compteur :
// arcValeurA) — une image sautée par un téléphone lent ne décale rien, la
// suivante est là où elle doit être. canvas.captureStream(30) alimente un
// MediaRecorder : MP4 quand il sait l'écrire (Safari iOS 14.5+), sinon WebM
// VP9 (Chrome, Android), VP8 en dernier recours. 4 Mbit/s, moins si la durée
// ferait dépasser 8 Mo (marge de 15 %) : Wrapped, 8,5 s, pèse ~4,3 Mo.
//
// L'ENREGISTREMENT EST EN TEMPS RÉEL (c'est le principe de MediaRecorder) :
// une barre de progression le montre. Il finit HORS DU GESTE de l'athlète :
// iOS refuserait la feuille de partage ouverte à ce moment-là. La vidéo prête,
// on la montre, et c'est un NOUVEAU toucher (« Partager ») qui la partage.
//
// SANS MediaRecorder ni captureStream (vieux navigateurs), la bascule
// « Image / Vidéo » n'est pas posée du tout : on n'offre pas un bouton qui
// échouerait.
//
// TEST MANUEL : docs/video-partage.md (iPhone installé, Android, story, Reel).
const VIDEO_FORMAT=Object.freeze({w:1080,h:1920});
const VIDEO_IPS=30;
const VIDEO_DEBIT=4e6;                       // bit/s
const VIDEO_MAX_OCTETS=8*1024*1024;          // 8 Mo
const VIDEO_FIN_FIGEE=1000;                  // la dernière image, tenue 1 s
const VIDEO_WRAPPED_SLIDE=1500;              // 5 slides × 1,5 s
const VIDEO_ECHELLE=2.4;                     // traits de la foudre : 1080 px d'image ≈ 450 px d'écran
// MP4 d'abord : c'est ce qu'Instagram et la pellicule iPhone lisent partout.
const VIDEO_TYPES=Object.freeze(['video/mp4;codecs=avc1.42E01E','video/mp4;codecs=avc1','video/mp4',
  'video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm']);
/**
 * PURE quand `estSupporte` est donné (les tests). Le premier type que
 * l'enregistreur sait écrire : {mime, type, ext}, ou null.
 */
function videoTypeChoisi(estSupporte){
  let f=estSupporte;
  if(typeof f!=='function'){
    try{
      const MR=(typeof window!=='undefined')?window.MediaRecorder:undefined;
      f=(MR&&typeof MR.isTypeSupported==='function')?(t=>MR.isTypeSupported(t)):null;
    }catch(e){ f=null; }
  }
  if(!f) return null;
  for(const t of VIDEO_TYPES){
    let ok=false; try{ ok=!!f(t); }catch(e){ ok=false; }
    if(ok) return {mime:t,type:t.split(';')[0],ext:/mp4/.test(t)?'mp4':'webm'};
  }
  return null;
}
/** Le navigateur sait-il fabriquer la vidéo ? Sinon, pas de bascule du tout. */
function videoExportPossible(){
  try{
    if(typeof window==='undefined'||typeof window.MediaRecorder!=='function') return false;
    if(typeof HTMLCanvasElement==='undefined'||typeof HTMLCanvasElement.prototype.captureStream!=='function') return false;
    return !!videoTypeChoisi();
  }catch(e){ return false; }
}
/** PURE. Le débit : 4 Mbit/s, abaissé si la durée ferait passer le fichier au-dessus de 8 Mo. */
function videoDebit(dureeMs){
  const s=Math.max(1,Number(dureeMs)||0)/1000;
  return Math.max(5e5,Math.min(VIDEO_DEBIT,Math.floor(VIDEO_MAX_OCTETS*8*0.85/s)));
}
// ── La bascule « Image / Vidéo » ──────────────────────────────────────
const VISUEL_MEDIA_CLE='rc_visuel_media';
/** 'video' seulement si c'est le choix retenu ET que le navigateur sait la faire. */
function visuelMediaChoisi(){
  let m=null;
  try{ m=localStorage.getItem(VISUEL_MEDIA_CLE); }catch(e){ m=null; }
  return (m==='video'&&videoExportPossible())?'video':'image';
}
function visuelMediaChoisir(k){
  if(k!=='image'&&k!=='video') return false;
  try{ localStorage.setItem(VISUEL_MEDIA_CLE,k); }catch(e){}
  document.querySelectorAll('.vmed .vmed-b').forEach(b=>{
    const on=b.getAttribute('data-media')===k;
    b.classList.toggle('actif',on); b.setAttribute('aria-checked',String(on));
  });
  return true;
}
/** La bascule, ou RIEN quand la vidéo est impossible ici. */
function _htmlVisuelMedia(){
  if(!videoExportPossible()) return '';
  const m=visuelMediaChoisi();
  // stopPropagation : dans Wrapped, un toucher sur la slide la ferait avancer.
  return '<div class="vmed" role="radiogroup" aria-label="Partager une image ou une vidéo">'
    +[['image','Image','fixe'],['video','Vidéo','9:16 animée']].map(([k,l,p])=>
      '<button type="button" class="vmed-b'+(k===m?' actif':'')+'" role="radio" aria-checked="'+(k===m)+'" data-media="'+k+'"'
      +' onclick="event.stopPropagation();visuelMediaChoisir(\''+k+'\')">'+l+'<small>'+p+'</small></button>').join('')
    +'</div>';
}
// ── Les scènes : ce qu'on peint à l'instant t (ms de vidéo) ────────────
// Une scène : {type, nom, anim (ms d'animation), preparer(W,H) → état,
// peindre(g,t,état,W,H)}. La fin figée s'ajoute après `anim`.
// Une vidéo n'a pas de transparence : « sans fond » devient le carbone.
function _videoFond(fond){ return (!fond||fond==='transparent')?'carbone':fond; }
function _videoToile(W,H){ const c=document.createElement('canvas'); c.width=W; c.height=H; return c; }
function _videoFondToile(fond,W,H){
  const c=_videoToile(W,H);
  const g=c.getContext('2d');
  g.fillStyle='#000'; g.fillRect(0,0,W,H);
  _visuelPeindreFond(g,W,H,fond);
  return c;
}
// Le tremblement de l'impact, tiré une fois : ±6 px d'écran amortis en 280 ms.
function _videoSecousse(){
  const kf=[], N=9;
  for(let k=0;k<=N;k++){
    const a=(1-k/N)*6*VIDEO_ECHELLE;
    kf.push(k===N?[0,0]:[(Math.random()*2-1)*a,(Math.random()*2-1)*a]);
  }
  return (t)=>{
    if(!(t>=0&&t<280)) return [0,0];
    const x=t/280*N, i=Math.floor(x), r=x-i;
    const A=kf[i], B=kf[Math.min(N,i+1)];
    return [A[0]+(B[0]-A[0])*r,A[1]+(B[1]-A[1])*r];
  };
}
// Le halo rouge qui pulse deux fois derrière le chiffre frappé.
function _videoHalo(g,geo,t){
  if(!geo||t<0||t>1000) return false;
  const puls=Math.abs(Math.sin(Math.PI*(t/500)));
  const r=geo.taille*(1.1+puls*0.35);
  const h=g.createRadialGradient(geo.x,geo.y,0,geo.x,geo.y,r);
  h.addColorStop(0,'rgba(224,32,32,'+(0.5*puls).toFixed(3)+')'); h.addColorStop(1,'rgba(224,32,32,0)');
  g.save(); g.fillStyle=h; g.fillRect(geo.x-r,geo.y-r,r*2,r*2); g.restore();
  return true;
}
// La carte (déjà dessinée sur son calque), posée avec son fondu et sa secousse.
function _videoPoser(g,calque,alpha,dxy){
  g.save();
  g.globalAlpha=Math.max(0,Math.min(1,alpha));
  g.drawImage(calque,dxy[0],dxy[1]);
  g.restore();
}
// LE RECORD : la carte apparaît avec l'ANCIENNE valeur, la foudre frappe le
// chiffre à 350 ms, il compte jusqu'au nouveau record en grésillant (600 ms),
// le halo pulse deux fois. Plusieurs records : la carte récapitulative,
// frappée en son centre.
function _videoSceneRecord(d,fond){
  const r=d||{};
  const multi=Array.isArray(r.records);
  const f=_videoFond(fond);
  const T_IMPACT=350, T_COMPTE=600;
  const vers=Number(r.curMax)||0;
  const de=(Number(r.histMax)>0&&Number(r.histMax)<vers)?Number(r.histMax):vers;
  return {type:multi?'records':'record',nom:multi?'repcore-records':'repcore-record',anim:2600,
    preparer(W,H){
      const e={fond:_videoFondToile(f,W,H),secousse:_videoSecousse(),bruit:arcBruit(de,vers,true),foudre:null};
      if(multi){ e.calque=_dessinerCarteRecords(r,'transparent','story'); e.geo={x:W/2,y:H*0.42,taille:300}; }
      else{ e.calque=_videoToile(W,H); e.anim={cv:e.calque,sansFond:true}; }
      return e;
    },
    peindre(g,t,e,W,H){
      g.drawImage(e.fond,0,0);
      if(!multi){
        const v=t<T_IMPACT?de:arcValeurA(de,vers,(t-T_IMPACT)/T_COMPTE,e.bruit);
        // Les valeurs de passage tombent au demi-kilo, la dernière est la vraie.
        e.anim.valeur=Math.abs(v-vers)<1e-9?null:_recKg(Math.max(0,Math.round(v*2)/2));
        _dessinerCarteRecord(r,f,'story',e.anim);
        e.geo=e.anim.geo;
      }
      if(!e.foudre&&e.geo) e.foudre=_foudreScene(e.geo,W,{eclairs:3,echelle:VIDEO_ECHELLE});
      _videoHalo(g,e.geo,t-T_IMPACT-FOUDRE_IMPACT);
      _videoPoser(g,e.calque,t/250,e.secousse(t-T_IMPACT-FOUDRE_IMPACT));
      if(e.foudre&&t>=T_IMPACT) _foudrePeindre(g,e.foudre,t-T_IMPACT,W,H);
    }};
}
// LE RANG : la foudre frappe dans le noir, l'emblème sort du flash (petit,
// blanc, trop grand, puis posé), le texte arrive, les volts comptent depuis
// le seuil du rang. Comme l'écran de l'app.
function _videoSceneRang(d,img,fond){
  const x=d||{};
  const f=_videoFond(fond);
  const T0=250;
  const rg=(typeof RANGS!=='undefined'&&RANGS[(Number(x.n)||1)-1])||null;
  const xp=Number(x.xp)||0, xp0=Math.min(xp,rg?Number(rg.seuil)||0:0);
  // Ease « snap » approché : sortie rapide, arrivée douce.
  const snap=p=>1-Math.pow(1-Math.max(0,Math.min(1,p)),3);
  return {type:'rang',nom:'repcore-rang',anim:2700,
    preparer(W,H){
      const e={fond:_videoFondToile(f,W,H),calque:_videoToile(W,H),secousse:_videoSecousse(),foudre:null};
      e.anim={cv:e.calque,sansFond:true};
      return e;
    },
    peindre(g,t,e,W,H){
      g.drawImage(e.fond,0,0);
      const u=t-T0-40;
      let ech;
      if(u<0) ech=0;
      else if(u<495) ech=0.2+(1.15-0.2)*snap(u/495);
      else ech=1.15-0.15*snap((u-495)/405);
      e.anim.echelle=ech;
      e.anim.eclat=u<0?0:Math.max(0,1-u/900);
      e.anim.texte=(u-620)/360;
      e.anim.xp=Math.round(arcValeurA(xp0,xp,(u-700)/800,null));
      _dessinerCarteRang(x,f,img,'story',e.anim);
      if(!e.foudre&&e.anim.geo) e.foudre=_foudreScene(e.anim.geo,W,{eclairs:(Number(x.n)||0)>=8?3:2,echelle:VIDEO_ECHELLE});
      _videoPoser(g,e.calque,1,e.secousse(t-T0-FOUDRE_IMPACT));
      if(e.foudre&&t>=T0) _foudrePeindre(g,e.foudre,t-T0,W,H);
    }};
}
// WRAPPED : les cinq slides, 1,5 s chacune. Le grand chiffre monte à chaque
// arrivée, les barres du haut avancent comme dans l'app, et le profil est
// révélé par la foudre. La dernière image — le résumé — reste 1 s.
function _videoSceneWrapped(w,per,signature){
  const sl=wrappedSlides(w,per);
  const D=VIDEO_WRAPPED_SLIDE;
  return {type:'wrapped',nom:'repcore-wrapped',anim:sl.length*D,
    preparer(W,H){ return {calque:_videoToile(W,H),foudre:null,secousse:_videoSecousse()}; },
    peindre(g,t,e,W,H){
      const i=Math.max(0,Math.min(sl.length-1,Math.floor(t/D)));
      const tl=t-i*D, s=sl[i];
      const a={cv:e.calque};
      if(s.k!=='profil') a.grand=arcValeurA(0,Number(s.grand)||0,tl/900,null);
      _dessinerWrapped(w,per,i,signature,'story',a);
      const dxy=s.k==='profil'?e.secousse(tl-FOUDRE_IMPACT):[0,0];
      _videoPoser(g,e.calque,1,dxy);
      // L'arrivée d'une slide : un fondu depuis le noir, 120 ms.
      if(i>0&&tl<120){ g.save(); g.fillStyle='rgba(0,0,0,'+(1-tl/120).toFixed(3)+')'; g.fillRect(0,0,W,H); g.restore(); }
      if(s.k==='profil'){
        if(!e.foudre) e.foudre=_foudreScene(a.geo||{x:W/2,y:H*0.28},W,{eclairs:3,echelle:VIDEO_ECHELLE});
        _foudrePeindre(g,e.foudre,tl,W,H);
      }
      // Les barres : pleines avant, la courante se remplit.
      const n=sl.length, m=48, esp=12, lb=(W-m*2-esp*(n-1))/n;
      g.save();
      for(let k=0;k<n;k++){
        const x0=m+k*(lb+esp);
        g.fillStyle='rgba(255,255,255,.28)'; g.fillRect(x0,44,lb,8);
        const p=k<i?1:(k===i?Math.min(1,tl/D):0);
        if(p>0){ g.fillStyle='#fff'; g.fillRect(x0,44,lb*p,8); }
      }
      g.restore();
    }};
}
/**
 * La scène d'un visuel. type : 'record' ({donnees, fond}), 'rang' ({donnees,
 * img, fond}), 'wrapped' ({w, per, signature}).
 */
function videoScene(type,o){
  const x=o||{};
  if(type==='record'||type==='records') return _videoSceneRecord(x.donnees,x.fond);
  if(type==='rang') return _videoSceneRang(x.donnees,x.img,x.fond);
  if(type==='wrapped') return _videoSceneWrapped(x.w,x.per,x.signature);
  return null;
}
/** PURE. La durée totale d'une scène : l'animation, puis la fin figée. */
function videoDuree(scene){ return (Number(scene&&scene.anim)||0)+VIDEO_FIN_FIGEE; }
/**
 * FABRIQUE LA VIDÉO. `scene` : une scène (videoScene) ou {type, …} ;
 * `dureeMs` (facultatif) : la durée totale voulue — l'animation est alors
 * accélérée ou ralentie pour tenir, la fin figée garde 1 s (30 % au plus).
 * `o.progression(p)` : 0..1 ; `o.annule()` : true pour tout arrêter.
 * Rend Promise<{blob, type, ext, nom, taille, duree}>.
 */
function exporterVideoVisuel(scene,dureeMs,o){
  o=o||{};
  return new Promise((res,rej)=>{
    try{
      const sc=(scene&&typeof scene.peindre==='function')?scene:videoScene(scene&&scene.type,scene);
      if(!sc) throw new Error('scène inconnue');
      const ty=videoTypeChoisi();
      if(!ty||!videoExportPossible()) throw new Error('ce navigateur ne sait pas enregistrer de vidéo');
      const W=VIDEO_FORMAT.w, H=VIDEO_FORMAT.h;
      const total=Number(dureeMs)>0?Number(dureeMs):videoDuree(sc);
      const figee=Math.min(VIDEO_FIN_FIGEE,total*0.3);
      const cv=_videoToile(W,H);
      const g=cv.getContext('2d');
      const etat=sc.preparer(W,H);
      let fige=null;
      const peindre=(t)=>{
        const ta=Math.min(sc.anim,t*sc.anim/Math.max(1,total-figee));
        if(ta>=sc.anim&&fige){ g.drawImage(fige,0,0); return; }
        g.setTransform(1,0,0,1,0,0); g.globalAlpha=1; g.globalCompositeOperation='source-over';
        g.fillStyle='#000'; g.fillRect(0,0,W,H);
        sc.peindre(g,ta,etat,W,H);
        // LA FIN FIGÉE : peinte une fois, recopiée ensuite (et rien ne tremble plus).
        if(ta>=sc.anim){ fige=_videoToile(W,H); fige.getContext('2d').drawImage(cv,0,0); }
      };
      peindre(0);
      const flux=cv.captureStream(VIDEO_IPS);
      const rec=new MediaRecorder(flux,{mimeType:ty.mime,videoBitsPerSecond:videoDebit(total)});
      const morceaux=[];
      let fini=false, annule=false;
      const liberer=()=>{
        try{ flux.getTracks().forEach(p=>p.stop()); }catch(e){}
        for(const c of [cv,fige,etat&&etat.calque,etat&&etat.fond]) if(c){ c.width=0; c.height=0; }
      };
      rec.ondataavailable=ev=>{ if(ev.data&&ev.data.size) morceaux.push(ev.data); };
      rec.onerror=ev=>{ fini=true; liberer(); rej((ev&&ev.error)||new Error('enregistrement interrompu')); };
      rec.onstop=()=>{
        liberer();
        if(annule){ rej(new Error('annulé')); return; }
        const blob=new Blob(morceaux,{type:ty.type});
        // UN FICHIER VIDE N'EST PAS UNE VIDEO (29/09/2026). Sur une machine
        // saturee, l'encodeur peut s'arreter sans avoir rendu un seul octet :
        // on proposait alors de partager « 0 Mo ». C'est un echec, et il se dit.
        if(!blob.size){ rej(new Error('rien n’a pu être enregistré, réessaie')); return; }
        res({blob,type:ty.type,ext:ty.ext,nom:sc.nom+'.'+ty.ext,taille:blob.size,duree:total});
      };
      rec.start(250);
      const t0=performance.now();
      // requestAnimationFrame ne tourne pas sur une page cachée : un minuteur
      // prend le relais, pour que la vidéo se termine quand même.
      const suite=()=>{ if(typeof document!=='undefined'&&document.hidden) setTimeout(image,1000/VIDEO_IPS); else requestAnimationFrame(image); };
      const image=()=>{
        if(fini) return;
        const t=performance.now()-t0;
        if(o.annule&&o.annule()){ annule=true; fini=true; try{ rec.stop(); }catch(e){} return; }
        try{ peindre(Math.min(t,total)); }catch(e){}
        if(o.progression){ try{ o.progression(Math.min(1,t/total)); }catch(e){} }
        if(t>=total){
          fini=true;
          // Une dernière frame capturée, puis l'arrêt.
          setTimeout(()=>{ try{ rec.stop(); }catch(e){} },1000/VIDEO_IPS*2);
          return;
        }
        suite();
      };
      suite();
    }catch(e){ rej(e); }
  });
}
// ── L'écran : la barre de progression, puis la vidéo et ses deux sorties ──
let _videoEnCours=null;              // {annule} pendant l'enregistrement
let _videoPrete=null;                // {blob, type, nom, url, src} une fois prête
function partagerVideo(scene){
  if(_videoEnCours||!scene) return false;
  if(!videoExportPossible()){ toast('Ton navigateur ne sait pas créer de vidéo : partage l’image.','var(--orange)'); return false; }
  const suivi={annule:false};
  _videoEnCours=suivi;
  _videoEcran(videoDuree(scene));
  exporterVideoVisuel(scene,undefined,{progression:_videoProgression,annule:()=>suivi.annule})
    .then(r=>{ _videoEnCours=null; if(suivi.annule) return; _videoEcranPret(r,scene); })
    .catch(e=>{
      _videoEnCours=null;
      if(suivi.annule) return;
      fermerVideo();
      toast('Vidéo impossible : '+((e&&e.message)||'erreur'),'var(--orange)');
    });
  return true;
}
function _videoEcran(duree){
  fermerVideo();
  const d=document.createElement('div');
  d.id='video-export';
  d.setAttribute('role','dialog'); d.setAttribute('aria-modal','true'); d.setAttribute('aria-label','Ta vidéo');
  d.style.cssText='position:fixed;inset:0;z-index:var(--z-modal);background:var(--scrim);display:flex;'
    +'flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:20px';
  d.innerHTML='<div class="vid-carte">'
    +'<div class="vid-titre">Ta vidéo se prépare…</div>'
    +'<div class="vid-sous">Elle s’enregistre en temps réel ('+Math.round(duree/100)/10+' s) : garde l’app ouverte.</div>'
    +'<div class="vid-barre" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="vid-barre-i"></i></div>'
    +'<button type="button" class="btn btn-outline btn-sm vid-btn" onclick="annulerVideo()">Annuler</button>'
    +'</div>';
  document.body.appendChild(d);
  return d;
}
function _videoProgression(p){
  const i=document.getElementById('vid-barre-i');
  if(!i) return;
  const v=Math.round(Math.max(0,Math.min(1,p))*100);
  i.style.width=v+'%';
  const b=i.parentNode; if(b&&b.setAttribute) b.setAttribute('aria-valuenow',String(v));
}
function _videoEcranPret(r,scene){
  const d=document.getElementById('video-export');
  if(!d) return false;
  let url='';
  try{ url=URL.createObjectURL(r.blob); }catch(e){ url=''; }
  _videoPrete={blob:r.blob,type:r.type,nom:r.nom,url,src:(scene&&scene.type)||'visuel'};
  let f=null; try{ f=new File([r.blob],r.nom,{type:r.type}); }catch(e){ f=null; }
  const partage=!!(f&&navigator.canShare&&navigator.share&&(()=>{ try{ return navigator.canShare({files:[f]}); }catch(e){ return false; } })());
  const lourde=r.taille>VIDEO_MAX_OCTETS;
  d.innerHTML='<div class="vid-carte">'
    +'<video class="vid-apercu" src="'+url+'" autoplay muted loop playsinline aria-label="Aperçu de ta vidéo"></video>'
    +'<div class="vid-sous">'+(Math.round(r.taille/1e5)/10).toLocaleString('fr-FR')+' Mo · '+r.ext.toUpperCase()
      +(lourde?' · lourde : Instagram peut la recompresser':'')+'</div>'
    +(partage?'<button type="button" class="btn btn-red vid-btn" onclick="partagerVideoPrete()">'+icon('share',16)+' <span>Partager la vidéo</span></button>':'')
    +'<a class="btn btn-outline vid-btn" href="'+url+'" download="'+escapeHtml(r.nom)+'" onclick="telechargerVideoPrete()">'
      +icon('download',16)+' <span>Télécharger</span></a>'
    +'<button type="button" class="btn btn-outline btn-sm vid-btn" onclick="fermerVideo()">Fermer</button>'
    +'</div>';
  return true;
}
// SYNCHRONE : c'est un toucher neuf, iOS accepte la feuille de partage.
// Le lien est copié (sticker Lien de la story) ; la légende part dans `text`
// quand le navigateur l'accepte avec le fichier (un Reel la reprend).
function partagerVideoPrete(){
  const v=_videoPrete; if(!v) return false;
  let f=null; try{ f=new File([v.blob],v.nom,{type:v.type}); }catch(e){ f=null; }
  if(!f||!navigator.share) return telechargerVideoPrete();
  const legende=_legendePour(v.src);
  let charge={files:[f]};
  try{ if(navigator.canShare({files:[f],text:legende})) charge={files:[f],text:legende}; }catch(e){}
  _storyCopierLien(v.src);
  navigator.share(charge).then(()=>{ try{ attribCompter('partage',v.src); }catch(e){} }).catch(()=>{});
  return true;
}
// Le lien <a download> fait le travail ; on compte et on copie le lien.
function telechargerVideoPrete(){
  const v=_videoPrete; if(!v) return false;
  try{ attribCompter('telechargement',v.src); }catch(e){}
  _storyCopierLien(v.src);
  return true;
}
function annulerVideo(){
  if(_videoEnCours) _videoEnCours.annule=true;
  return fermerVideo();
}
function fermerVideo(){
  const d=document.getElementById('video-export');
  if(d) d.remove();
  const u=_videoPrete&&_videoPrete.url;
  _videoPrete=null;
  if(u) setTimeout(()=>{ try{ URL.revokeObjectURL(u); }catch(e){} },1000);
  return !!d;
}
let _storyEnCours=false;
// TELECHARGER. Rien d autre. La feuille de partage native n existe pas
// partout — navigator.share est absent de beaucoup de navigateurs de bureau
// et de certains navigateurs mobiles — et quand elle manquait, ce bouton
// ouvrait un apercu au lieu de rendre un fichier. Ce n est pas ce qu on lui
// demande.
//
// Le lien avec l attribut `download` est le seul mecanisme universel. Sur
// ordinateur et sur Android le fichier part dans les telechargements ; sur
// iPhone il arrive dans Fichiers, d ou il se deplace vers Photos. Le partage
// natif reste offert par un BOUTON SEPARE, pour qui veut publier directement.
function telechargerSeanceDuJour(){
  if(_storyEnCours) return false;
  const d=_storyDonnees();
  if(!d){ toast('Aucune séance à partager aujourd’hui.','var(--orange)'); return false; }
  _storyEnCours=true;
  try{
    // LA SORTIE EST PARTAGEE avec le bilan de seance : voir
    // _storySortirTelechargement, ou vit desormais la regle iOS.
    return _storySortirTelechargement(_dessinerStorySeance(d),'repcore-seance.png');
  }catch(e){
    toast('Téléchargement impossible : '+((e&&e.message)||'erreur'),'var(--orange)');
    return false;
  }finally{
    _storyEnCours=false;
  }
}
// ══ LE BILAN DE SEANCE : TELECHARGER, PARTAGER ═════════════════════════
//
// La seance affichee est celle qui vient d'etre enregistree — la derniere du
// dossier. On ne la recalcule pas : finishWorkout l'a ecrite, l'ecran de fin
// la lit, l'image la lit aussi.
let _bilanRecords=0;
function _bilanSeanceCourante(){
  const l=(currentUser&&currentUser.sessions)||[];
  const s=l[l.length-1];
  const d=bilanSeanceDonnees(s,currentUser);
  if(!d) return null;
  // LES RECORDS VIENNENT DE L'ECRAN DE FIN, qui les a comptes. Zero par
  // defaut : mieux vaut ne rien annoncer qu'annoncer un compte a nous.
  d.records=Math.max(0,Math.round(Number(_bilanRecords)||0));
  return d;
}
// LE BOUTON DIT CE QU'IL FAIT. Le dessin du visuel prend de quelques dizaines
// de millisecondes a une demi-seconde selon le telephone : sans retour, on
// touche deux fois, et le second appel retombait sur le verrou _storyEnCours
// sans rien dire. Trois etats, et le libelle revient toujours — meme en cas
// d'echec, sinon le bouton reste bloque sur « Génération… ».
// Les trois etats du bouton : pret, en cours, fait. Sans le troisieme,
// l'athlete clique, rien ne bouge a l'ecran — le fichier est parti dans le
// dossier de telechargements, qu'il ne regarde pas — et il reclique.
//
// ⚠ ON N'ECRIT QUE DANS LE <span>, jamais dans le bouton. `btn.textContent=…`
// remplacait TOUT le contenu, icone comprise : elle disparaissait au premier
// clic et ne revenait jamais.
function _telechargerAvecEtat(btn){
  const lib='Télécharger ma séance';
  const z=btn?(btn.querySelector('span')||btn):null;
  const pose=t=>{ if(z) z.textContent=t; };
  if(btn){ btn.disabled=true; btn.classList.remove('fait'); pose('Génération…'); }
  // Rendu differe d'une frame : sans cela le libelle ne s'affiche jamais, le
  // dessin bloquant le fil avant que le navigateur ait repeint.
  requestAnimationFrame(()=>{ setTimeout(()=>{
    let ok=false;
    try{ ok=telechargerBilanSeance(); }catch(e){ ok=false; }
    pose(ok?'Visuel téléchargé':lib);
    if(btn){
      btn.disabled=false;
      if(ok) btn.classList.add('fait');
    }
    if(ok){
      try{ if(typeof arcHaptique==='function') arcHaptique('succes'); }catch(e){}
      setTimeout(()=>{ pose(lib); if(btn) btn.classList.remove('fait'); },2400);
    }
  },0); });
  return true;
}
// ⚠ LA SEANCE VISEE DEVIENT UN PARAMETRE, et c'est tout ce qui change ici.
// L'historique doit pouvoir telecharger le visuel d'une seance d'il y a trois
// semaines ; sans ce parametre il aurait fallu une seconde fonction, qui
// aurait divergé du dessin de l'ecran de fin au premier ajustement.
// Sans argument, le comportement est EXACTEMENT celui d'avant : la derniere
// seance, par _bilanSeanceCourante.
// LA CASE « Ajouter l'équivalent fun ». DÉCOCHÉE PAR DÉFAUT : le visuel est
// déjà dense, et une ligne de plus ne doit y entrer que si l'athlète la veut.
// Le choix est une préférence d'affichage de CET appareil (localStorage), pas
// une donnée du dossier.
function bilanEquivalentActif(){
  try{ return localStorage.getItem('rc_bilan_equiv')==='1'; }catch(e){ return false; }
}
function bilanEquivalentBasculer(on){
  try{ localStorage.setItem('rc_bilan_equiv',on?'1':'0'); }catch(e){}
  // Les vignettes du sélecteur de fond redessinent la carte : on les repeint.
  for(const k of ['wd-fonds','sd-fonds']){ try{ _visuelFondsPeindre(k); }catch(e){} }
  return !!on;
}
function _htmlBilanEquivalent(){
  return '<label class="rcf-eq-opt"><input type="checkbox"'+(bilanEquivalentActif()?' checked':'')
    +' onchange="bilanEquivalentBasculer(this.checked)"> Ajouter l’équivalent fun</label>';
}
function _bilanDonneesDe(sc){
  if(!sc){
    const d=_bilanSeanceCourante();
    if(d&&bilanEquivalentActif()){ try{ d.equivalent=equivalentTonnage(d.volume); }catch(e){ d.equivalent=null; } }
    return d;
  }
  const d=bilanSeanceDonnees(sc,currentUser);
  if(!d) return null;
  // LES RECORDS SONT RECOMPTES POUR CETTE SEANCE-LA. _bilanRecords est le
  // compte de la DERNIERE seance, pose par l'ecran de fin : l'appliquer a une
  // seance ancienne lui preterait des records qu'elle n'a pas faits.
  try{
    const ant=listeHistoriqueSeances(currentUser).filter(x=>x.date<sc.date);
    d.records=recordsDeSeance(sc,ant).length;
  }catch(e){ d.records=0; }
  // LA SIGNATURE DE L'ATHLETE, selon son reglage « Nom affiche sur mes visuels ».
  try{ d.signature=nomSurVisuels(currentUser); }catch(e){ d.signature=''; }
  // L'équivalent fun, seulement si la case est cochée.
  if(bilanEquivalentActif()){ try{ d.equivalent=equivalentTonnage(d.volume); }catch(e){ d.equivalent=null; } }
  return d;
}
function telechargerBilanSeance(sc){
  if(_storyEnCours) return false;
  const d=_bilanDonneesDe(sc);
  if(!d){ toast('Aucune séance à partager.','var(--orange)'); return false; }
  _storyEnCours=true;
  const fond=visuelFondEffectif();
  try{ return _storySortirTelechargement(_dessinerBilanSeance(d,fond),visuelNomFichier('repcore-bilan',fond),visuelFondFormat(fond)); }
  catch(e){ toast('Téléchargement impossible : '+((e&&e.message)||'erreur'),'var(--orange)'); return false; }
  finally{ _storyEnCours=false; }
}
function partagerBilanSeance(sc){
  if(_storyEnCours) return false;
  const d=_bilanDonneesDe(sc);
  if(!d){ toast('Aucune séance à partager.','var(--orange)'); return false; }
  _storyEnCours=true;
  const fond=visuelFondEffectif();
  try{
    if(_storySortirPartage(_dessinerBilanSeance(d,fond),visuelNomFichier('repcore-bilan',fond),undefined,visuelFondFormat(fond))) return true;
    _storyEnCours=false;
    return telechargerBilanSeance(sc);
  }catch(e){
    toast('Partage impossible : '+((e&&e.message)||'erreur'),'var(--orange)');
    return false;
  }finally{ _storyEnCours=false; }
}
// LES DEUX BOUTONS, sur l'ecran de fin de seance. « Partager » n'apparait que
// la ou il fonctionne : un bouton qui retomberait sur le telechargement ferait
// deux boutons pour un seul geste.
//
// ⚠ L'ORDRE S'INVERSE, ET C'EST UNE DEMANDE. Kevin, 09/09/2026 : « donne la
// possibilite post-seance de mettre telecharger ma seance, le bouton un peu
// plus voyant, un peu plus rouge ». Le telechargement etait en second, en
// contour gris ; il passe devant, en rouge plein et pleine largeur. Le partage
// natif reste — c'est encore le geste le plus court sur telephone, il propose
// « Enregistrer l'image » ET Instagram — mais il devient le second.
//
// ⚠ ET ON DIT CE QU'ON TELECHARGE. Une image SANS FOND s'ouvre sur du blanc
// dans la galerie d'un telephone en mode clair : du texte blanc y parait
// vide, et l'athlete croit que le telechargement a echoue. La phrase sous les
// boutons coute deux lignes et evite exactement ce contresens.
function renderPartageBilan(){
  const z=document.getElementById('wd-partage');
  if(!z) return false;
  if(!_bilanSeanceCourante()){ z.innerHTML=''; return true; }
  // LE LOGO DU COACH SE CHARGE MAINTENANT, pas au clic : le dessin est
  // synchrone, une image pas encore decodee ne s'y dessinerait pas.
  try{ _prechaufferMarqueCoach(); }catch(e){}
  // Le partage reste SECOND, et il ne remplace jamais le telechargement :
  // l'athlete doit pouvoir recuperer l'image et la poster ou il veut.
  // ⚠ LE TELECHARGEMENT DOMINE, ET CE N'EST PAS UN DETAIL DE STYLE. C'est le
  // geste que l'athlete veut : recuperer l'image et la poser sur SA photo. Le
  // partage natif reste — c'est le chemin le plus court sur telephone — mais
  // il devient franchement secondaire : contour fin, pas de rouge, plus petit.
  // Deux boutons de meme poids laissaient le choix a l'utilisateur alors que
  // l'un des deux est la bonne reponse neuf fois sur dix.
  const part=(typeof navigator!=='undefined'&&navigator.share)
    ?'<button type="button" class="rcf-share" onclick="partagerBilanSeance()">'
      +'Partager ma séance</button>':'';
  // LE FOND AVANT LES BOUTONS : on choisit, puis on télécharge.
  z.innerHTML=_htmlVisuelFonds('wd-fonds')+_htmlBilanEquivalent()
    +'<button type="button" class="rcf-dl" id="wd-dl" '
    +'onclick="_telechargerAvecEtat(this)">'+icon('download',18)
    +'<span>Télécharger ma séance</span></button>'+part
    // Les deux phrases, et les deux-points. « en blanc : c'est normal » se lit
    // comme une explication ; un tiret ou un separateur graphique en aurait
    // fait deux affirmations sans lien. La note suit le fond choisi : « en
    // blanc » ne se dit que du PNG sans fond.
    +'<div class="rcf-note" id="wd-note">'+_visuelNoteFond(visuelFondEffectif())+'</div>';
  monterSelecteurFond('wd-fonds',f=>{ const d=_bilanDonneesDe(); return d?_dessinerBilanSeance(d,f):null; },'wd-note');
  return true;
}
// Le partage natif, en plus et jamais a la place. Tout est SYNCHRONE : le
// moindre await consommerait le geste utilisateur, et iOS refuserait.
function partagerSeanceDuJour(){
  if(_storyEnCours) return false;
  const d=_storyDonnees();
  if(!d){ toast('Aucune séance à partager aujourd’hui.','var(--orange)'); return false; }
  _storyEnCours=true;
  try{
    // LE TEXTE NOMME LE COACH, ET L'ADRESSE EST CELLE DU QR. Les deux disent la
    // meme chose que le pied de la carte : qui a programme la seance, et ou
    // aller pour la meme chose. Une image qu'on republie perd souvent sa
    // legende — d'ou le pied, qui lui ne se perd pas.
    const _n=d.ex.length;
    const _meta={title:'Ma séance du jour',
      text:(d.coach?(d.coach+' : '):'')+d.titre+' · '+_n+' exercice'+(_n>1?'s':''),
      url:lienPerso('seance')||RC_URL_VITRINE};
    if(_storySortirPartage(_dessinerStorySeance(d),'repcore-seance.png',_meta)){
      // ⚠ ON COMPTE UNE FEUILLE DE PARTAGE OUVERTE, PAS UNE PUBLICATION. Ce qui
      // se passe ensuite — publier, annuler, choisir une application — se passe
      // hors du navigateur, et nous n'en savons rien. Le chiffre mesure une
      // INTENTION de partager, et ce lot ne pretend rien de plus.
      try{ rcm('story_partagee'); }catch(x){}
      return true;
    }
    // Pas de partage natif ici : on ne laisse pas l athlete sans rien, on
    // telecharge. C est ce qu il attendait de toute facon.
    _storyEnCours=false;
    return telechargerSeanceDuJour();
  }catch(e){
    toast('Partage impossible : '+((e&&e.message)||'erreur'),'var(--orange)');
    return false;
  }finally{
    _storyEnCours=false;
  }
}
function _renderWeeklyInto(el,sc){
  window._weekProgEl=el;
  // Les polices seront pretes bien avant que quiconque touche « Partager ».
  try{ _prechaufferPolicesStory(); }catch(e){}
  const today=new Date().getDay();
  const todayIdx=today===0?6:today-1;
  let sel=_selDay!=null?_selDay:-1;
  if(sel===-1) sel=sc.findIndex((s,i)=>i===todayIdx&&s.active&&s.exercises?.length);
  if(sel===-1) sel=sc.findIndex(s=>s.active&&s.exercises?.length);
  _selDay=sel;
  const isFoundation=sc.some(s=>s._foundation);
  const selS=sel>=0?sc[sel]:{};
  const progNote=sc.find(s=>s.notes&&s._foundation)?.notes||'';
  const nbEx=selS.active&&selS.exercises?.length?selS.exercises.length:0;
  const heading=nbEx
    ?((DAYS[sel]||'').toUpperCase()+(selS.name?' : '+selS.name.toUpperCase():''))
    :((DAYS[sel]||'').toUpperCase()+' : REPOS');
  const mainRest=nbEx?(selS.exercises.map(e=>e.repos).filter(Boolean)[0]||''):'';
  el.innerHTML=`
    <div class="banner-hero" style="margin-bottom:16px">
      <div style="position:relative">
        <div style="margin-bottom:12px">
          <!-- LA RANGEE DU HAUT NE PORTE QUE DU COURT : le sur-titre et les
               pastilles. Le titre, lui, a besoin de toute la largeur : c'est
               d'avoir partagé sa ligne avec les sept pastilles qui le coupait
               en deux, et en quatre sur un écran de 360. -->
          <div class="sem-rangee">
            <div class="eyebrow sem-sur" style="color:rgba(255,255,255,.55)">Séance du jour</div>
            <div class="sem-jours">
            ${sc.map((s,i)=>{
              const isToday=i===todayIdx;const isSel=i===sel;
              const bg=isSel?'rgba(255,255,255,.28)':s.active?'rgba(255,255,255,.1)':'rgba(0,0,0,.25)';
              const col=isSel?'var(--text)':s.active?'rgba(255,255,255,.75)':'rgba(255,255,255,.25)';
              const bord=isToday&&!isSel?'1px solid rgba(255,255,255,.55)':'1px solid transparent';
              return `<div class="sem-jour" onclick="_setWeekDay(${i})" style="background:${bg};border:${bord};color:${col}" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">${DAY_ICONS[i]}</div>`;
            }).join('')}
            </div>
          </div>
          <div style="font-family:var(--pile-titre);font-size:var(--fs-2xl);font-weight:400;color:var(--text);letter-spacing:1px;line-height:1">${heading}</div>
          ${nbEx?`<div style="font-size:var(--fs-xs);color:rgba(255,255,255,.6);margin-top:4px">${nbEx} exercice${nbEx>1?'s':''}${mainRest?' · '+mainRest+' repos':''}</div>`:'<div style="font-size:var(--fs-xs);color:rgba(255,255,255,.5);margin-top:4px">Récupération active</div>'}
        </div>
        ${nbEx?`<div style="border-top:1px solid color-mix(in srgb,var(--text) 15%,transparent);padding-top:10px;display:flex;flex-direction:column;gap:6px">
          ${selS.exercises.map((ex,i)=>`
            <div style="display:flex;align-items:center;gap:8px">
              <div style="width:18px;height:18px;background:rgba(0,0,0,.3);border-radius:var(--r-1);display:flex;align-items:center;justify-content:center;font-size:var(--fs-xs);font-weight:900;color:rgba(255,255,255,.65);flex-shrink:0">${i+1}</div>
              <div style="font-size:var(--fs-xs);color:var(--text);font-weight:700;text-transform:uppercase;letter-spacing:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(ex.name)}</div>
              <div style="font-size:var(--fs-xs);color:rgba(255,255,255,.45);flex-shrink:0">${libSeriesReps(ex)}${_rirPrescrit(ex)?' @RIR'+escapeHtml(_rirPrescrit(ex)):''}</div>
            </div>`).join('')}
        </div>`:''}
        ${nbEx?`<div style="margin-top:12px;padding-top:10px;border-top:1px solid color-mix(in srgb,var(--text) 15%,transparent);display:flex;justify-content:flex-end;gap:8px">
          <button id="story-btn" type="button" onclick="event.stopPropagation();telechargerSeanceDuJour()" aria-label="Télécharger la séance du jour en image"
            style="display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:6px 12px;border-radius:var(--r-2);cursor:pointer;
              background:rgba(0,0,0,.28);border:1px solid color-mix(in srgb,var(--text) 22%,transparent);color:var(--text);
              font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;letter-spacing:0">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">
              <path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
            </svg>Télécharger
          </button>
          <!-- PARTAGER n'apparaît QUE si la feuille de partage native existe.
               Sans elle, partagerSeanceDuJour retombe sur le téléchargement :
               ce serait deux boutons pour une seule action, sur tout le bureau.
               Placé à droite, au bord : c'est le geste qu'on vient chercher. -->
          ${(typeof navigator!=='undefined'&&navigator.share)?`
          <button id="story-partage-btn" type="button" onclick="event.stopPropagation();partagerSeanceDuJour()" aria-label="Partager la séance du jour"
            style="display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:6px 12px;border-radius:var(--r-2);cursor:pointer;
              background:color-mix(in srgb,var(--text) 16%,transparent);border:1px solid color-mix(in srgb,var(--text) 34%,transparent);color:var(--text);
              font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;letter-spacing:0">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">
              <path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
            </svg>Partager
          </button>`:''}
        </div>`:''}
      </div>
    </div>
  `;
}
// Rend le programme hebdomadaire, en annonçant le repli quand c'en est un.
// Le bandeau est inséré APRÈS le rendu — _renderWeeklyInto écrase innerHTML —
// et window._weekProgEl reste `el`, donc changer de jour le régénère au lieu
// de l'empiler.
function _rendreSemaineAvecBandeau(el,sc){
  _renderWeeklyInto(el,sc);
  if(programmeEstEssai()) el.insertAdjacentHTML('afterbegin',_bandeauEssai());
}
function _renderProgExercisesInto(el){
  // sessions_config est toujours prioritaire (fondation ou séances modifiées par le coach)
  const sc=currentUser.sessions_config;
  const hasActive=sc&&sc.some(s=>s.active&&s.exercises?.length);
  if(hasActive){_rendreSemaineAvecBandeau(el,sc);return;}

  // Fallback : ancien programme unique assigné par le coach
  const u=(DB.get('users')||{})[currentUser.email]||currentUser;
  // UN PDF NE COUPE PLUS CET ÉCRAN. Cette branche vidait la zone et sortait,
  // parce qu'un encart PDF prenait le relais juste au-dessus. Cet encart
  // n'existe plus : `pv-pdf-zone` reste en display:none et rien ne l'allume,
  // `openHomePdf` et `openPdfNewTab` sont sans appelant. Il ne restait donc
  // qu'un écran blanc, sans un mot, pendant que le sélecteur de séances
  // proposait un contenu complet. On descend maintenant sur le repli.
  const prog=getProgram();
  if(!prog._isDefault){
    el.innerHTML=`
      <div style="margin-bottom:14px">
        <div style="font-size:var(--fs-xs);color:var(--red-text);letter-spacing:2.5px;font-weight:800;text-transform:uppercase;margin-bottom:6px">Mon programme</div>
        <div style="font-size:var(--fs-lg);font-weight:900;letter-spacing:-0.3px">${escapeHtml(prog.name)}</div>
        ${prog.notes?`<p class="sub" style="margin-top:6px;font-size:var(--fs-sm);line-height:1.6">${escapeHtml(prog.notes)}</p>`:''}
      </div>
      ${prog.exercises.map((ex,idx)=>_renderExCard(ex,idx)).join('')}`;
    return;
  }
  // Rien de publié. Plutôt que d'afficher une impasse pendant que le sélecteur
  // de séances propose, lui, un contenu complet, on montre ce même repli ici —
  // annoncé comme tel par le bandeau. C'est la contradiction que corrige ce
  // correctif : l'accueil ne peut plus dire « en cours de création » alors
  // qu'un programme est proposé ailleurs comme s'il était configuré.
  // initSessionsConfig n'écrit rien : la config reste en mémoire, et la
  // regénérer à chaque rendu est déterministe.
  const essai=currentUser.sessions_config||initSessionsConfig();
  if(essai.some(s=>s.active&&s.exercises?.length)){_rendreSemaineAvecBandeau(el,essai);return;}
  // Filet de sécurité : ni programme, ni repli exploitable.
  el.innerHTML='<div style="border:1px dashed var(--border);border-radius:var(--r-3);background:var(--surface-0);margin-bottom:14px">'
    // R13 — QUI DOIT AGIR. Avec un coach, c'est lui : aucun bouton, on dit
    // qu'on attend sa publication. Sans coach, l'athlete peut agir : le code.
    +(currentUser.coachId
      ?emptyState('dumbbell','<b style=\"color:var(--text);font-size:var(--fs-lg);display:block;margin-bottom:6px\">Programme en cours de création</b>Ton coach n\'a pas encore publié ton programme. Il apparaîtra ici dès qu\'il le publie.')
      :emptyState('dumbbell','<b style=\"color:var(--text);font-size:var(--fs-lg);display:block;margin-bottom:6px\">Pas encore de programme</b>Il arrive avec le code de ton coach.','Entrer un code coach','go(\'s-client-code\')'))
    +'</div>';
}
// ======= WORKOUT =======
function startWorkout(){
  const prog=getProgram();
  if(!prog.exercises?.length){toast('Aucun programme défini.','var(--red)');return;}
  try{ _woVerrouEcran(); }catch(e){}
  // Même raison qu'en tête de launchWorkout : woState est remplacé juste après,
  // et avec lui la seule référence à l'intervalle en cours.
  if(woState?.timerInterval) clearInterval(woState.timerInterval);
  // Chemin hérité : ce programme unique ne vient pas d'un créneau de la semaine.
  // slot:null fait retomber la recherche d'historique sur le nom de la séance.
  _ckEtat={};_ckStopChrono();
  // Même raison que dans launchWorkout : sans ce vidage, les badges de record
  // de la séance précédente se rallument sur des séries qui ne les ont pas.
  _resetRecordsVus();
  woState={exercises:prog.exercises,currentEx:0,startTime:Date.now(),timerInterval:null,sessionData:{},progName:prog.name,slot:null,
    // Même amorçage que launchWorkout : une demande du coach vaut case cochée
    // d'avance. Sans cette ligne, le chemin hérité l'ignorerait en silence.
    aFilmer:(prog.exercises||[]).filter(ex=>!isCardio(ex)&&demandeVideoPour(ex.name,currentUser))
      .map(ex=>ex.name),
    warmup:String(prog.warmup??currentUser._defaultWarmup??'').trim(),
    cooldown:String(prog.cooldown??currentUser._defaultCooldown??'').trim()};
  woState.timerInterval=setInterval(()=>{
    const el=Math.floor((Date.now()-woState.startTime)/1000);
    document.getElementById('wo-timer').textContent=fmtDureeSeance(el);
  },1000);
  go('s-workout');
  document.getElementById('wo-title').textContent=prog.name;
  renderWoEx();
}
