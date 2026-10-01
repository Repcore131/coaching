// ══ LES CARTES PAS ET SOMMEIL, D'APRES LES MAQUETTES DE KEVIN ═════════════
//
// Kevin, 24/09/2026, deux maquettes a l'appui : « remplace par celle-ci,
// exactement pareil en mise en page ». La carte unique — graphe gris, deux
// chiffres, des lignes de faits — devient sept blocs, dans cet ordre :
//   1. le graphe, titre et objectif quotidien dans son en-tete ;
//   2. la moyenne et la progression, cote a cote ;
//   3. (sommeil) la dette de la semaine ;
//   4. « On reprend ! » quand des jours manquent ;
//   5. le bouton de saisie ;
//   6. « ou », puis les deux methodes : a la main, ou par une capture.
// La periode se choisit dans l'en-tete de la section (sanRendre remplit
// #ls-per-pas et #ls-per-sommeil) : un menu au lieu de deux fleches.
//
// ⚠ CE QUI N'EST PLUS A L'ECRAN, PARCE QUE LA MAQUETTE NE LE PORTE PAS : la
//   serie en cours et la regularite des couchers. regulariteCoucher et
//   serieePas restent — le coach les lit sur sa fiche.
// ⚠ CE QUI RESTE, EN UNE LIGNE DISCRETE SOUS LES METHODES : la source des
//   donnees et « Où trouver… ». Les retirer aurait supprime deux reglages
//   sans le dire ; ils ne prennent qu'une ligne de texte.
//
// LA COULEUR D'UNE BARRE DIT OU EN EST LE JOUR PAR RAPPORT A L'OBJECTIF,
// comme sur la maquette : vert, orange, rouge. Les seuils sont ceux qu'elle
// montre — pour les pas, 6 843 sur 12 000 (57 %) est vert, 4 872 (41 %)
// orange, 1 320 (11 %) rouge ; pour le sommeil, 7h20 sur 8h00 (92 %) vert,
// 4h30 (56 %) orange, 3h48 (48 %) rouge.
const SAN_SEUILS={pas:{ok:.5,moy:.25},sommeil:{ok:.875,moy:.55}};
const SAN_NIV_COUL={ok:'#34e89e',moy:'#f5a524',bas:'#ff4040'};
// PURE. 'ok', 'moy' ou 'bas' pour une valeur rapportee a l'objectif.
function sanNiveau(quoi,v,obj){
  if(v==null||!(obj>0)) return null;
  const s=SAN_SEUILS[quoi==='sommeil'?'sommeil':'pas'], r=v/obj;
  return r>=s.ok?'ok':(r>=s.moy?'moy':'bas');
}
// PURE. L'axe vertical : un pas rond (3 000 pas, 2 h), un sommet au-dessus de
// l'objectif ET de la plus haute barre, jamais plus de six graduations.
function sanAxe(quoi,vals,obj){
  const nuit=(quoi==='sommeil');
  let pas=nuit?120:3000;
  const max=Math.max(obj||0,...vals.filter(v=>v!=null),0)*1.12;
  let haut=Math.max(pas,Math.ceil(max/pas)*pas);
  while(haut/pas>6){ pas*=2; haut=Math.ceil(max/pas)*pas; }
  const grad=[];
  for(let v=0;v<=haut;v+=pas) grad.push(v);
  return {haut,grad,lib:v=>nuit?(Math.round(v/60)+'h'):(v?(Math.round(v/100)/10+'K').replace('.',','):'0')};
}
// Les milliers avec une espace ordinaire : la fine insecable de
// toLocaleString manque a la police de titre, qui collait « 10452 ».
function _svEsp(t){ return String(t).replace(/[\u202f\u00a0]/g,' '); }
function _sanJourCourt(d){
  const s=d.toLocaleDateString('fr-FR',{weekday:'short'}).replace('.','');
  return s.charAt(0).toUpperCase()+s.slice(1);
}
function _sanGraphe(quoi,serie,obj,fmt){
  const ax=sanAxe(quoi,serie.map(x=>x.v),obj);
  const f0=fmt; fmt=v=>_svEsp(f0(v));
  const pc=v=>Math.max(0,Math.min(100,v/ax.haut*100));
  const lignes=ax.grad.map(v=>'<div class="sv-gl" style="bottom:'+pc(v)+'%"><span>'
    +escapeHtml(ax.lib(v))+'</span></div>').join('');
  const barres=serie.map(x=>{
    const niv=sanNiveau(quoi,x.v,obj);
    const lib=x.d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
    return '<button type="button" class="san-bar sv-bar" data-niv="'+(niv||'vide')+'"'
      +' onclick="sanOuvrirJour(\''+quoi+'\',\''+x.iso+'\')"'
      +' aria-label="'+escapeHtml(lib+' : '+(x.v==null?'aucune donnée':fmt(x.v)))+'">'
      +'<span class="sv-bar-z">'
        +(x.v==null?'<span class="sv-bar-v">-</span>'
          :'<span class="sv-bar-v">'+escapeHtml(fmt(x.v))+'</span>')
        +'<span class="sv-bar-f" style="height:'+(x.v==null?1.5:Math.max(1.5,pc(x.v)))+'%"></span>'
      +'</span>'
      +'<span class="sv-bar-j">'+escapeHtml(_sanJourCourt(x.d))+'</span>'
      +'</button>';
  }).join('');
  return '<div class="sv-graphe">'
    +'<div class="sv-axe">'+lignes
      +'<div class="sv-obj" style="bottom:'+pc(obj)+'%"><span>'+escapeHtml(fmt(obj))+'</span></div>'
    +'</div>'
    +'<div class="san-graph sv-barres">'+barres+'</div>'
    +'</div>';
}
// ── Les pictogrammes. Traces, pas des images : ils prennent la couleur du
//    domaine et restent nets a toutes les tailles.
const _SV_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">';
const SAN_ICO={
  synchro:_SV_SVG+'<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20.5V16h-4.5"/></svg>',
  chaussure:_SV_SVG+'<path d="M2.5 16.5h17.2a1.8 1.8 0 0 0 1.8-1.8c0-1.4-1-2.1-2.5-2.6l-4.1-1.5a3 3 0 0 1-1.3-.9L11.2 6.8a1.3 1.3 0 0 0-2-.2L7.6 8.3H2.5z"/><path d="M2.5 16.5v2h19v-2"/><path d="M9.6 10.2l1.2-1M11.4 11.6l1.2-1"/></svg>',
  lune:_SV_SVG+'<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/></svg>',
  crayon:_SV_SVG+'<path d="M16.9 3.6a2.1 2.1 0 0 1 3 3L8.4 18.1l-4 1 1-4z"/><path d="M14.8 5.7l3 3"/></svg>',
  calendrier:_SV_SVG+'<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13h.01M12 13h.01M16.5 13h.01M7.5 16.5h.01M12 16.5h.01"/></svg>',
  bas:_SV_SVG+'<path d="M6 9l6 6 6-6"/></svg>',
  droite:_SV_SVG+'<path d="M9 5l7 7-7 7"/></svg>',
  eclair:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.2 2.2L4.6 13.4h6.1l-1.2 8.4 8.8-11.4h-6.2z"/></svg>',
  clavier:_SV_SVG+'<rect x="2.5" y="5.5" width="19" height="13" rx="2.2"/><path d="M6.5 9.5h.01M10 9.5h.01M13.5 9.5h.01M17.5 9.5h.01M6.5 12.5h.01M10 12.5h.01M13.5 12.5h.01M17.5 12.5h.01M8 15.5h8"/></svg>',
  photo:_SV_SVG+'<path d="M22 18.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2h3.2l1.8-2.7h6l1.8 2.7H20a2 2 0 0 1 2 2z"/><circle cx="12" cy="13.2" r="3.8"/></svg>',
  histo:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3" y="10" width="3.6" height="9" rx="1"/><rect x="8.8" y="5" width="3.6" height="14" rx="1"/><rect x="14.6" y="12" width="3.6" height="7" rx="1"/><rect x="2" y="20.5" width="4" height="1.5" rx=".6"/><rect x="8" y="20.5" width="4" height="1.5" rx=".6"/><rect x="14" y="20.5" width="4" height="1.5" rx=".6"/></svg>',
  lit:_SV_SVG+'<path d="M3 18.5V6.5M3 14h18v4.5M21 14v-2.2a2.8 2.8 0 0 0-2.8-2.8H11v5"/><circle cx="7" cy="10.8" r="1.8"/></svg>',
  dormeur:_SV_SVG+'<path d="M3 19v-7M3 16h18v3M21 16v-2a2.5 2.5 0 0 0-2.5-2.5H12.5V16"/><circle cx="8" cy="12" r="1.9"/><path d="M14 4.5h3l-3 3.5h3M18.5 2.5h2l-2 2.3h2"/></svg>',
  cadenas:_SV_SVG+'<rect x="4.5" y="10.5" width="15" height="10.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>',
  info:_SV_SVG+'<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/></svg>'
};
function _svEnTete(quoi,r,bloc,fmt){
  const nuit=(quoi==='sommeil');
  const verrou=sanVerrouille(currentUser);
  const p0=r.jours[0].d,p6=r.jours[6].d;
  const sous=_sanOffset===0?'Sur les 7 derniers jours'
    :('Du '+p0.getDate()+' '+p0.toLocaleDateString('fr-FR',{month:'short'})+' au '
      +p6.getDate()+' '+p6.toLocaleDateString('fr-FR',{month:'short'}));
  const obj=nuit?escapeHtml(sanHM(bloc.objectif)).toUpperCase()
    :escapeHtml(_svEsp(sanNb(bloc.objectif)))+'<small>pas</small>';
  return '<div class="sv-g-tete">'
    +'<span class="sv-g-ico">'+(nuit?SAN_ICO.lune:SAN_ICO.chaussure)+'</span>'
    +'<div class="sv-g-t"><h3>'+(nuit?'Durée de sommeil':'Nombre de pas')+'</h3>'
      +'<span>'+escapeHtml(sous)+'</span></div>'
    +'<div class="sv-g-obj"><span>Objectif quotidien</span><strong>'+obj+'</strong></div>'
    +'<button type="button" class="sv-g-edit" onclick="sanObjectif(\''+quoi+'\')"'
      +(verrou?' data-verrou="" title="Ton coach a fixé cet objectif"':'')
      +' aria-label="'+(verrou?'Objectif fixé par ton coach':'Modifier mon objectif')+'">'
      +(verrou?SAN_ICO.cadenas:SAN_ICO.crayon)+'</button>'
    +'</div>';
}
function _svMoyenne(quoi,bloc,fmt){
  const nuit=(quoi==='sommeil');
  const f0=fmt; fmt=v=>_svEsp(f0(v));
  const e=bloc.ecart;
  const ecart=(e==null)?''
    :'<div class="sv-m-e" data-sens="'+(e>=0?'haut':'bas')+'"><i aria-hidden="true">'+(e>=0?'▲':'▼')+'</i>'
      +(e>=0?'+ ':'- ')+escapeHtml(_svEsp(nuit?sanHM(Math.abs(e)):sanNb(Math.abs(e))))+'</div>'
      +'<div class="sv-m-n">par rapport à l’objectif'+(nuit?' ('+escapeHtml(sanHM(bloc.objectif))+')':'')+'</div>';
  return '<div class="sv-moy">'
    +'<span class="sv-moy-ico">'+(nuit?SAN_ICO.lune:SAN_ICO.chaussure)+'</span>'
    +'<div class="sv-moy-c"><span class="sv-lbl">Moyenne</span>'
      +'<strong class="sv-moy-v">'+(bloc.moy==null?'-':escapeHtml(fmt(bloc.moy)))+'</strong>'
      +'<span class="sv-moy-u">'+(nuit?'par nuit':'pas / jour')+'</span>'
      +ecart+'</div></div>';
}
function _svProgression(quoi,r,bloc){
  const nuit=(quoi==='sommeil');
  const n=bloc.renseignes;
  // L'ANNEAU DIT, COMME SUR LA MAQUETTE : la part de l'objectif pour les pas,
  // la part des nuits renseignees pour le sommeil.
  const part=nuit?n/7:(bloc.moy==null?0:Math.min(1,bloc.moy/bloc.objectif));
  const C=2*Math.PI*42;
  const centre=nuit?(n+'/7'):(Math.round(part*100)+'%');
  const points=r.jours.map(j=>{
    const v=nuit?sanSommeilMin(currentUser,j.iso):sanPas(currentUser,j.iso);
    return '<i'+(v!=null?' data-plein=""':'')+'></i>';
  }).join('');
  const semaine=_sanOffset===0?'cette semaine':'sur la période';
  return '<div class="sv-prog">'
    +'<svg class="sv-anneau" viewBox="0 0 100 100" aria-hidden="true">'
      +(nuit?'<defs><linearGradient id="sv-g-nuit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c9cff"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs>':'')
      +'<circle cx="50" cy="50" r="42" class="sv-anneau-f"/>'
      +'<circle cx="50" cy="50" r="42" class="sv-anneau-p" stroke-dasharray="'+(C*part).toFixed(1)+' '+C.toFixed(1)+'"/>'
    +'</svg>'
    +'<span class="sv-anneau-v">'+escapeHtml(centre)+'</span>'
    +'<div class="sv-prog-c">'
      +'<span class="sv-prog-t">Progression'+(nuit?'<i aria-hidden="true">'+SAN_ICO.droite+'</i>':'')+'</span>'
      +(nuit?'<span class="sv-prog-s">nuits renseignées</span>'
        :'<span class="sv-prog-n"><b>'+n+' / 7</b> jours</span><span class="sv-prog-s">renseignés '+semaine+'</span>')
      +'<span class="sv-points" role="img" aria-label="'+n+' '+(nuit?'nuits':'jours')+' renseignés sur 7">'+points+'</span>'
    +'</div></div>';
}
function _svDette(u){
  const d=detteSommeil(u);
  if(!d) return '';
  return '<div class="sv-dette">'
    +'<span class="sv-dette-ico">'+SAN_ICO.lit+'</span>'
    +'<div class="sv-dette-c"><span class="sv-dette-t">Dette de sommeil'
      +'<button type="button" class="sv-info" onclick="sanDetteAide()" aria-label="Comment la dette est calculée">'+SAN_ICO.info+'</button></span>'
      +'<span class="sv-dette-s">sur '+d.nuits+' nuit'+(d.nuits>1?'s':'')+' renseignée'+(d.nuits>1?'s':'')
        +' · objectif '+escapeHtml(sanHM(d.objectif))+'</span></div>'
    +'<strong class="sv-dette-v" style="color:'+_teinteDette(d.dette,d.objectif)+'">'
      +(d.dette?escapeHtml(sanHM(d.dette)):'aucune')+'</strong>'
    +'</div>';
}
function sanDetteAide(){
  _sanFeuille('Dette de sommeil',
    '<div class="san-vide">Ce qui manque à ton objectif, nuit après nuit, sur les 7 derniers jours. '
    +'Une nuit plus longue que l’objectif en rembourse une partie. Seules les nuits renseignées comptent : '
    +'une nuit oubliée n’ajoute rien, et ne rembourse rien.</div>');
}
// Le raccourci de rattrapage, rendu seulement s'il y a quelque chose a
// rattraper. Il ouvre directement le PREMIER JOUR VIDE du domaine — le plus
// ancien, celui qui va sortir de la fenetre en premier.
function _htmlRattraper(u,quoi){
  const n=[];
  const d=new Date(); d.setHours(12,0,0,0);
  for(let i=1;i<=7;i++){
    const j=new Date(d); j.setDate(d.getDate()-i);
    const iso=localISODate(j);
    if((quoi==='sommeil'?sanSommeilMin(u,iso):sanPas(u,iso))==null) n.push(iso);
  }
  if(!n.length) return '';
  const q=quoi==='sommeil'?'nuit':'jour';
  const prem=premierJourVide(u,quoi,7);
  const lbl=prem?new Date(prem+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric'}):'';
  return '<button type="button" class="san-rattrap sv-rep" onclick="sanRattraper(\''+quoi+'\')">'
    +_svImg(quoi==='sommeil'?'rep-som':'rep-pas','sv-rep-deco')
    +'<span class="sv-rep-ico">'+SAN_ICO.eclair+'</span>'
    +'<span class="sv-rep-c"><span class="san-rattrap-t">On reprend !</span>'
    +'<span class="san-rattrap-n">'+n.length+' '+q+(n.length>1?'s':'')+' sans données cette semaine.'
    +(lbl?'<br>On commence par '+escapeHtml(lbl)+'.':'')+'</span></span>'
    +'<span class="sv-chev">'+SAN_ICO.droite+'</span></button>';
}
// PURE. Le plus ancien jour de la semaine sans donnee POUR CE DOMAINE : un
// jour ou les pas sont notes mais pas la nuit est un trou pour le sommeil, et
// pas pour les pas.
function premierJourVide(u,quoi,jours){
  const n=(jours>0?jours:7);
  const d=new Date(); d.setHours(12,0,0,0);
  for(let i=n;i>=1;i--){
    const j=new Date(d); j.setDate(d.getDate()-i);
    const iso=localISODate(j);
    const v=quoi==='sommeil'?sanSommeilMin(u,iso):sanPas(u,iso);
    if(v==null) return iso;
  }
  return null;
}
function sanRattraper(quoi){
  const iso=premierJourVide(currentUser,quoi,7);
  // Plus de trou : le bouton ne devrait pas etre la, mais s'il l'est (rendu
  // avant une saisie, clique apres), on ouvre le jour courant plutot que de
  // ne rien faire — un bouton muet se lit comme une panne.
  sanSaisir(quoi,iso||localISODate(new Date()));
}
// LES TELEPHONES DES DEUX METHODES, ET LE DECOR DE « ON REPREND ! », SONT
// DECOUPES DANS LES MAQUETTES DE KEVIN (img/lifestyle/, 5 a 14 ko chacun) :
// « exactement pareil » ne se redessine pas, il se reprend.
function _svImg(nom,classe){
  return '<img class="'+classe+'" src="img/lifestyle/'+nom+'.webp" alt="" aria-hidden="true" loading="lazy" decoding="async">';
}
function _svMethodes(u,quoi){
  const nuit=(quoi==='sommeil');
  return '<div class="san-import sv-meth">'
    +'<div class="sv-meth-tete"><span class="sv-meth-ico">'+(nuit?SAN_ICO.dormeur:SAN_ICO.histo)+'</span>'
      +'<div><h3>'+(nuit?'Ajouter mon sommeil':'Ajouter mes pas')+'</h3>'
      +'<span>Choisis la méthode qui te convient</span></div></div>'
    +'<div class="sv-meth-g">'
      +_svTuileSync(u,quoi)
      +'<button type="button" class="sv-tuile sv-tuile-m" onclick="sanSaisir(\''+quoi+'\')">'
        +'<span class="sv-tuile-h"><span class="sv-tuile-ico">'+SAN_ICO.clavier+'</span>'
          +'<span class="sv-tuile-t">Saisie manuelle</span><span class="sv-chev">'+SAN_ICO.droite+'</span></span>'
        +'<span class="sv-tuile-d">'+(nuit?'Renseigne la durée de ton sommeil du jour en quelques secondes.'
          :'Renseigne ton nombre de pas du jour en quelques secondes.')+'</span>'
        +_svImg(nuit?'tel-m-som':'tel-m-pas','sv-tel')
      +'</button>'
      // ⚠ LE CHAMP, PUIS SON BOUTON, DANS CET ORDRE. importerCaptureStats
      //   retrouve le bouton par nextElementSibling et y ecrit « Lecture en
      //   cours… » par textContent : il ne porte donc QUE du texte, et il
      //   couvre la tuile, invisible, pour que toute la tuile se touche.
      +'<div class="sv-tuile sv-tuile-c">'
        +'<span class="sv-tuile-h"><span class="sv-tuile-ico">'+SAN_ICO.photo+'</span>'
          +'<span class="sv-tuile-t">Depuis une capture d’écran</span><span class="sv-chev">'+SAN_ICO.droite+'</span></span>'
        +'<span class="sv-tuile-d">Importe une photo de ton application de santé (Apple Santé, Samsung Health, etc.).</span>'
        +_svImg(nuit?'tel-c-som':'tel-c-pas','sv-tel')
        +'<input type="file" accept="image/*,.heic,.heif,.hif" style="display:none" onchange="importerCaptureStats(this)">'
        +'<button type="button" class="sv-tuile-go" onclick="this.previousElementSibling.click()">Envoyer une capture</button>'
      +'</div>'
    +'</div>'
    +'<div class="sv-cadenas">'+SAN_ICO.cadenas+'<span>La capture est lue sur ton téléphone. Elle n\'est ni envoyée ni conservée.</span></div>'
    +'<div class="sv-pied">'
      +_svPiedSource(u,quoi)
      +'<span aria-hidden="true">·</span>'
      +'<button type="button" class="san-src" onclick="sanAide(\''+quoi+'\')">Où trouver '+(nuit?'mon sommeil':'mes pas')+' ?</button>'
    +'</div>'
    +'</div>';
}
function _htmlCarteSante(u,quoi){
  const nuit=(quoi==='sommeil');
  const r=sanResume(u,_sanOffset);
  const bloc=nuit?r.sommeil:r.pas;
  const fmt=nuit?sanHM:sanNb;
  const serie=r.jours.map(j=>({iso:j.iso,d:j.d,v:nuit?sanSommeilMin(u,j.iso):sanPas(u,j.iso)}));
  // Les couleurs du domaine, posees une fois sur la carte : ROUGE_MARQUE_MIN pour les
  // pas, #60a5fa pour le sommeil. Tout le reste en derive.
  return '<section class="san-carte sv-carte" data-quoi="'+(nuit?'sommeil':'pas')+'"'
    +' style="--sv-c:'+(nuit?'#60a5fa':ROUGE_MARQUE_MIN)+'">'
    +'<div class="sv-bloc sv-g">'+_svEnTete(quoi,r,bloc,fmt)+_sanGraphe(quoi,serie,bloc.objectif,fmt)+(nuit?_htmlPhasesNuit(u,r.jours):'')+'</div>'
    +'<div class="sv-duo">'+_svMoyenne(quoi,bloc,fmt)+_svProgression(quoi,r,bloc)+'</div>'
    +(nuit?_svDette(u):'')
    +_htmlRattraper(u,quoi)
    +'<div class="san-actions">'
      +'<button type="button" class="btn btn-red san-a1 sv-saisir" onclick="sanSaisir(\''+quoi+'\')">'
        +SAN_ICO.crayon+'<span>Ajouter / modifier mes données</span>'+SAN_ICO.droite+'</button>'
    +'</div>'
    +'<div class="sv-ou" aria-hidden="true"><span>ou</span></div>'
    +_svMethodes(u,quoi)
    +'</section>';
}
// LE MENU DE PERIODE, dans l'en-tete de chaque section. Douze semaines en
// arriere, comme les fleches permettaient ; on ne consulte pas l'avenir.
function _htmlSanPeriode(quoi){
  // ⚠ UN MENU NATIF PREND LA LARGEUR DE SA PLUS LONGUE OPTION. Kevin,
  //   24/09/2026 : « le bouton "7 derniers jours" est trop grand, il chevauche
  //   le sommeil ». Le libelle affiche est donc un <span> a la taille de la
  //   periode choisie, et le <select> est pose dessus, transparent : il garde
  //   le clavier, le lecteur d'ecran et la roue native du telephone.
  const lib=k=>k===0?'7 derniers jours':(k===-1?'Semaine précédente':('Il y a '+(-k)+' semaines'));
  const court=k=>k===0?'7 derniers jours':(k===-1?'Sem. précédente':('Il y a '+(-k)+' sem.'));
  let o='';
  for(let k=0;k>=-11;k--)
    o+='<option value="'+k+'"'+(k===_sanOffset?' selected':'')+'>'+lib(k)+'</option>';
  return '<label class="san-per-sel">'+SAN_ICO.calendrier
    +'<span class="san-per-lib">'+escapeHtml(court(_sanOffset))+'</span>'+SAN_ICO.bas
    +'<select onchange="sanPeriodeChoisir(this.value)" aria-label="Période affichée">'+o+'</select></label>';
}
function sanPeriodeChoisir(v){
  const n=Math.round(Number(v));
  _sanOffset=(isFinite(n)&&n<=0)?n:0;
  sanRendre();
}
// L'OBJECTIF QUOTIDIEN, AU CRAYON DE L'EN-TETE. Verrouille par le coach, il se
// lit sans se changer — et le dit, plutot qu'un bouton qui ne fait rien.
function sanObjectif(quoi){
  const u=currentUser;
  if(sanVerrouille(u)){ toast('Ton coach a fixé cet objectif.'); return; }
  const corps=quoi==='sommeil'
    ?'<label class="san-lab">Objectif de sommeil</label>'
      +'<input id="san-obj" inputmode="text" placeholder="8h00" value="'+escapeHtml(sanHM(sanObjSommeil(u)))+'">'
      +'<div class="san-aide">« 8h », « 7h30 » ou « 450 » minutes.</div>'
    :'<label class="san-lab">Jour d’entraînement</label>'
      +'<input id="san-obj" inputmode="numeric" placeholder="10000" value="'+sanObjPas(u)+'">'
      +'<label class="san-lab">Jour de repos</label>'
      +'<input id="san-obj-off" inputmode="numeric" placeholder="7000" value="'
        +escapeHtml(String(((u.stepsGoals||STEPS_GOALS_DEFAUT||{}).off)||''))+'">';
  _sanFeuille(quoi==='sommeil'?'Mon objectif de sommeil':'Mon objectif de pas',
    corps+'<button type="button" class="btn btn-red" style="width:100%;margin:14px 0 0" '
      +'onclick="sanObjectifEnregistrer(\''+quoi+'\')">Enregistrer</button>');
}
function sanObjectifEnregistrer(quoi){
  const u=currentUser;
  if(sanVerrouille(u)) return;
  // UN OBJECTIF DE PAS OU DE SOMMEIL EST UNE DONNEE DE SANTE (CHAMPS_SANTE) :
  // meme porte que la saisie du jour.
  if(!demanderConsentementSante(quoi==='sommeil'?'sommeil':'pas',()=>sanObjectifEnregistrer(quoi))) return;
  const v=(document.getElementById('san-obj')||{}).value||'';
  if(quoi==='sommeil'){
    const m=sanLireDuree(v);
    if(m==null||m<240||m>720){ toast('Un objectif entre 4h et 12h'); return; }
    u.sleepGoal=m;
  } else {
    const on=sanLirePas(v);
    const off=sanLirePas((document.getElementById('san-obj-off')||{}).value||'');
    if(on==null||on<500||on>60000){ toast('Un objectif entre 500 et 60 000 pas'); return; }
    u.stepsGoals=Object.assign({},u.stepsGoals||{},{on:on},(off!=null&&off>=500&&off<=60000)?{off:off}:{});
  }
  toastEcriture(saveUser(),'Objectif enregistré ✓','l’objectif est');
  sanFermer();
  sanRendre();
}
function sanPeriode(sens,auj){
  if(auj) _sanOffset=0;
  else{
    const n=_sanOffset+(sens<0?-1:1);
    if(n>0) return;            // on ne consulte pas l'avenir
    _sanOffset=n;
  }
  sanRendre();
}
function sanRendre(){
  const u=currentUser;
  const zs=document.getElementById('lifestyle-sleep-content');
  const zp=document.getElementById('lifestyle-steps-content');
  // R22 — L'IMPORT PAR CAPTURE N'EST PLUS EN TETE D'ECRAN : chaque carte le
  // porte sous son bouton de saisie (_htmlCarteSante). Le repli de
  // loadLifestyle, s'il joue, rend donc loadSteps/loadSleep AVEC leur import.
  try{ _rendreBandeSante(); }catch(e){}
  try{ if(zs) zs.innerHTML=_htmlCarteSante(u,'sommeil'); }catch(e){ if(zs) zs.innerHTML=''; }
  try{ if(zp) zp.innerHTML=_htmlCarteSante(u,'pas'); }catch(e){ if(zp) zp.innerHTML=''; }
  // LE MENU DE PERIODE VIT DANS L'EN-TETE DE SECTION, a droite du titre,
  // comme sur la maquette : un par section, et les deux suivent _sanOffset.
  for(const q of ['pas','sommeil']){
    try{ const zm=document.getElementById('ls-per-'+q); if(zm) zm.innerHTML=_htmlSanPeriode(q); }catch(e){}
  }
  try{ const zh=document.getElementById('lifestyle-habitudes');
       if(zh) zh.innerHTML=htmlHabitudes(u,{taux:true}); }catch(e){
       const zh=document.getElementById('lifestyle-habitudes'); if(zh) zh.innerHTML=''; }
  try{ const zc=document.getElementById('lifestyle-croise');
       if(zc) zc.innerHTML=_htmlCafeLimite(u)+_htmlRecuperationLifestyle(u)+_htmlCourbesRecup(u); }catch(e){
       const zc=document.getElementById('lifestyle-croise'); if(zc) zc.innerHTML=''; }
}
// ── LA FEUILLE DU JOUR ─────────────────────────────────────────────────
// Un clic sur une barre ouvre le detail, en bas d'ecran : sur un telephone,
// une infobulle de douze pixels ne se lit pas et ne se touche pas.
function sanOuvrirJour(quoi,iso){
  const u=currentUser;
  const d=new Date(iso+'T12:00:00');
  const lib=d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  const titre=lib.charAt(0).toUpperCase()+lib.slice(1);
  let corps='';
  if(quoi==='sommeil'){
    const e=sanSommeilEntree(u,iso),min=sanSommeilMin(u,iso),obj=sanObjSommeil(u);
    corps=min==null
      ? '<div class="san-vide">Aucune donnée pour cette nuit.</div>'
      : '<div class="san-gros">'+sanHM(min)+'</div>'
        +_sanL('Coucher',(e&&e.bed)||'-')+_sanL('Réveil',(e&&e.wake)||'-')
        +_sanL('Objectif',sanHM(obj))+_sanL('Écart',sanHMSigne(min-obj))
        // Les stades ne s'affichent QUE s'ils existent. Aucune estimation :
        // inventer un « sommeil profond » serait inventer une mesure.
        +((e&&(e.deep||e.light||e.rem||e.awake))
          ? '<div class="san-sous">Détail du sommeil</div>'
            +(e.deep?_sanL('Profond',sanHM(e.deep)):'')
            +(e.light?_sanL('Léger',sanHM(e.light)):'')
            +(e.rem?_sanL('REM',sanHM(e.rem)):'')
            +(e.awake?_sanL('Éveillé',sanHM(e.awake)):'')
          :'')
        +((e&&e.sleepScore)?_sanL('Score sommeil',String(e.sleepScore)):'');
  } else {
    const n=sanPas(u,iso),obj=sanObjPas(u);
    const e=((u&&u.stepsLog)||[]).find(x=>x&&x.date===iso);
    corps=n==null
      ? '<div class="san-vide">Aucune donnée pour ce jour.</div>'
      : '<div class="san-gros">'+sanNb(n)+'</div>'
        +_sanL('Objectif',sanNb(obj))
        +_sanL('Écart',(n-obj>=0?'+':'−')+sanNb(Math.abs(n-obj)))
        +((e&&e.km)?_sanL('Distance',String(e.km).replace('.',',')+' km'):'');
  }
  _sanFeuille(titre,corps
    +'<div class="san-f-actions">'
      +'<button type="button" class="btn btn-red btn-sm" style="flex:1;margin:0" '
        +'onclick="sanFermer();sanSaisir(\''+quoi+'\',\''+iso+'\')">Modifier</button>'
      +'<button type="button" class="btn btn-outline btn-sm" style="flex:1;margin:0" '
        +'onclick="sanSupprimer(\''+quoi+'\',\''+iso+'\')">Supprimer</button>'
    +'</div>');
}
function _sanL(t,v){ return '<div class="san-l"><span>'+escapeHtml(t)+'</span><strong>'+escapeHtml(String(v))+'</strong></div>'; }
function _sanFeuille(titre,html){
  let z=document.getElementById('san-feuille');
  if(!z){ z=document.createElement('div'); z.id='san-feuille'; document.body.appendChild(z); }
  z.innerHTML='<div class="san-f-fond" onclick="sanFermer()"></div>'
    +'<div class="san-f" role="dialog" aria-modal="true" aria-label="'+escapeHtml(titre)+'">'
      +'<div class="san-f-poignee"></div>'
      +'<div class="san-f-t">'+escapeHtml(titre)+'</div>'+html
      +'<button type="button" class="btn btn-outline btn-sm" style="width:100%;margin:12px 0 0" '
        +'onclick="sanFermer()">Fermer</button></div>';
  z.style.display='block';
}
function sanFermer(){ const z=document.getElementById('san-feuille'); if(z){ z.style.display='none'; z.innerHTML=''; } }
// ── LA SAISIE ──────────────────────────────────────────────────────────
// Trois champs au maximum, et la date par defaut est celle qu'on regarde.
function sanSaisir(quoi,iso){
  const u=currentUser;
  const jour=iso||localISODate(new Date());
  const e=quoi==='sommeil'?sanSommeilEntree(u,jour):((u.stepsLog||[]).find(x=>x&&x.date===jour));
  const min=quoi==='sommeil'?sanSommeilMin(u,jour):null;
  const corps=quoi==='sommeil'
    ? '<label class="san-lab">Date</label><input type="date" id="san-date" value="'+jour+'">'
      +'<label class="san-lab">Durée</label>'
      +'<input id="san-duree" inputmode="text" placeholder="7h30" value="'+(min!=null?sanHM(min):'')+'">'
      +'<div class="san-aide">« 7h30 », « 7:30 » ou « 450 » minutes.</div>'
      +'<label class="san-lab">Coucher</label><input type="time" id="san-bed" value="'+((e&&e.bed)||'')+'">'
      +'<label class="san-lab">Réveil</label><input type="time" id="san-wake" value="'+((e&&e.wake)||'')+'">'
    : '<label class="san-lab">Date</label><input type="date" id="san-date" value="'+jour+'">'
      +'<label class="san-lab">Pas</label>'
      +'<input id="san-pas" inputmode="text" placeholder="10 542" value="'+(e&&e.count!=null?e.count:'')+'">'
      +'<div class="san-aide">« 10542 » ou « 10.5k ».</div>'
      +'<label class="san-lab">Distance (facultatif)</label>'
      +'<input id="san-km" inputmode="decimal" placeholder="8,4" value="'+((e&&e.km)||'')+'">';
  _sanFeuille(quoi==='sommeil'?'Mon sommeil':'Mes pas',
    corps+'<button type="button" class="btn btn-red" style="width:100%;margin:14px 0 0" '
      +'onclick="sanEnregistrer(\''+quoi+'\')">Enregistrer</button>');
}
function sanEnregistrer(quoi){
  // ⚠ CETTE FONCTION N'EMPRUNTE PAS _recordSleep / _recordSteps : elle ecrit
  // dans sleepLog et stepsLog EN DIRECT, avec ses propres champs (source,
  // dataStatus, km). La porte posee dans les primitives ne la couvre donc
  // pas, et il en faut une ici — c'est precisement le genre de second chemin
  // qu'un verrou pose trop haut laisse passer.
  if(!demanderConsentementSante(quoi==='sommeil'?'sommeil':'pas',()=>sanEnregistrer(quoi))) return;
  const u=currentUser;
  const jour=(document.getElementById('san-date')||{}).value||localISODate(new Date());
  if(quoi==='sommeil'){
    const min=sanLireDuree((document.getElementById('san-duree')||{}).value);
    if(min==null) return toast('Durée illisible. Exemple : 7h30','var(--orange)');
    // ON DEMANDE, ON NE REFUSE PAS. Une nuit de 90 minutes existe ; une faute
    // de frappe aussi. Confirmer les distingue sans bloquer personne.
    if((min<120||min>16*60)&&!confirm(sanHM(min)+' de sommeil, c\'est bien ça ?')) return;
    const bed=(document.getElementById('san-bed')||{}).value||'';
    const wake=(document.getElementById('san-wake')||{}).value||'';
    if(!u.sleepLog) u.sleepLog=[];
    const i=u.sleepLog.findIndex(x=>x&&x.date===jour);
    const now=Date.now();
    if(i>=0){
      const e=u.sleepLog[i];
      e.duration=Math.round(min/60*100)/100;
      if(bed) e.bed=bed;
      if(wake) e.wake=wake;
      e.source=sanSource(u,'sommeil').cle; e.updatedAt=now; e.dataStatus='manual';
    } else {
      const e={date:jour,duration:Math.round(min/60*100)/100,
        source:sanSource(u,'sommeil').cle,dataStatus:'manual',createdAt:now,updatedAt:now};
      if(bed) e.bed=bed; if(wake) e.wake=wake;
      u.sleepLog.push(e);
    }
    try{ rcm('manual_sleep_added'); }catch(e){}
  } else {
    const n=sanLirePas((document.getElementById('san-pas')||{}).value);
    if(n==null) return toast('Nombre de pas illisible','var(--orange)');
    if(n>60000&&!confirm(sanNb(n)+' pas, c\'est bien ça ?')) return;
    const kmTxt=String((document.getElementById('san-km')||{}).value||'').replace(',','.').trim();
    const km=kmTxt?Number(kmTxt):null;
    if(!u.stepsLog) u.stepsLog=[];
    const i=u.stepsLog.findIndex(x=>x&&x.date===jour);
    const now=Date.now();
    if(i>=0){
      const e=u.stepsLog[i]; e.count=n;
      if(km!=null&&isFinite(km)&&km>0) e.km=km;
      e.source=sanSource(u,'pas').cle; e.updatedAt=now; e.dataStatus='manual';
    } else {
      const e={date:jour,count:n,source:sanSource(u,'pas').cle,dataStatus:'manual',
        createdAt:now,updatedAt:now};
      if(km!=null&&isFinite(km)&&km>0) e.km=km;
      u.stepsLog.push(e);
    }
    try{ rcm('manual_steps_added'); }catch(e){}
  }
  saveUser();
  CLOUD.pushOne(u.email,u);
  sanFermer(); sanRendre();
  toast('Enregistré','var(--green)');
}
function sanSupprimer(quoi,iso){
  if(!confirm('Supprimer les données de ce jour ?')) return;
  const u=currentUser;
  const cle=quoi==='sommeil'?'sleepLog':'stepsLog';
  u[cle]=(u[cle]||[]).filter(x=>!(x&&x.date===iso));
  saveUser();
  CLOUD.pushOne(u.email,u);
  sanFermer(); sanRendre();
  toast('Supprimé','var(--green)');
}
// ══ MODIFIER MA SOURCE — D'APRES LA MAQUETTE DE KEVIN (24/09/2026) ════════
// Deux familles, chacune sous son titre : les applications de sante, en
// lignes, et les montres, en grille de deux, chacune avec son logo (decoupe
// dans la maquette, img/sources/). La source choisie porte le point vert.
// Les sources que la maquette ne montre pas restent choisissables, en
// pastilles sous les montres : un athlete qui avait declare Oura ne doit pas
// voir son choix disparaitre de la liste.
//
// ⚠ « SYNCHRONISATION AUTOMATIQUE » : LE LIBELLE DE LA MAQUETTE, GARDE A LA
//   DEMANDE EXPRESSE DE KEVIN (24/09/2026, « laisse la synchronisation
//   automatique »), apres qu'il a ete prevenu qu'AUCUNE synchronisation
//   n'existe encore : choisir une source ne fait que la declarer (voir
//   sanPoserSource). Le jour ou une API branchera une source, ce libelle
//   deviendra vrai ; d'ici la, c'est une decision de produit, pas un oubli.
const SAN_SRC_APPS=['apple','google'];
const SAN_SRC_MONTRES=['garmin','samsung','huawei','fitbit','xiaomi','amazfit','polar','coros'];
function _sanSrcDesc(k,quoi){
  const nuit=(quoi==='sommeil');
  const q=nuit?'ton sommeil':'tes pas', qd=nuit?'de sommeil':'de pas';
  switch(k){
    case 'apple': return 'Synchronise automatiquement tes données '+qd+' depuis ton iPhone.';
    case 'google': return 'Connecte tes données depuis l’écosystème Android.';
    case 'garmin': return nuit?'Suivi du sommeil, récupération, HRV et plus encore.':'Pas, distance, récupération et plus encore.';
    case 'samsung': return 'Synchronise automatiquement tes données.';
    case 'huawei': return 'Synchronise '+q+' depuis ta montre Huawei.';
    case 'fitbit': return 'Synchronise '+q+' depuis ta montre Fitbit.';
    case 'xiaomi': return 'Synchronise tes données depuis ta montre Xiaomi.';
    case 'amazfit': return 'Synchronise tes données depuis ta montre Zepp (Amazfit).';
    case 'polar': return 'Synchronise '+q+' depuis ta montre Polar.';
    case 'coros': return 'Synchronise '+q+' depuis ta montre COROS.';
  }
  return '';
}
function _sanSrcLigne(quoi,k,act){
  return '<button type="button" class="san-src-o sv-src-o'+(k===act?' actif':'')+'" aria-pressed="'+(k===act)+'"'
    +' onclick="sanPoserSource(\''+quoi+'\',\''+k+'\')">'
    +'<span class="sv-src-logo"><img src="img/sources/'+k+'.webp" alt="" aria-hidden="true" loading="lazy" decoding="async"></span>'
    +'<span class="sv-src-c"><span class="sv-src-t">'+escapeHtml(SAN_SOURCES[k])+'</span>'
      +'<span class="sv-src-d">'+escapeHtml(_sanSrcDesc(k,quoi))+'</span></span>'
    +'<span class="sv-chev">'+SAN_ICO.droite+'</span></button>';
}
function _sanSrcFamille(titre,ico,corps){
  return '<section class="sv-src-s"><div class="sv-src-h"><span class="sv-src-hi">'+ico+'</span>'
    +'<h3>'+titre+'</h3><span class="sv-src-badge">Synchronisation automatique</span></div>'+corps+'</section>';
}
function sanChangerSource(quoi){
  const u=currentUser;
  const act=sanSource(u,quoi).cle;
  const coeur=_SV_SVG+'<path d="M20.8 5.6a5.4 5.4 0 0 0-7.7 0L12 6.7l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7L12 22l8.8-8.7a5.4 5.4 0 0 0 0-7.7z"/></svg>';
  const montre=_SV_SVG+'<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 6l.7-3.5h4.6L15 6M9 18l.7 3.5h4.6L15 18"/></svg>';
  const autres=Object.keys(SAN_SOURCES).filter(k=>SAN_SRC_APPS.indexOf(k)<0&&SAN_SRC_MONTRES.indexOf(k)<0)
    .map(k=>'<button type="button" class="san-src-o sv-src-p'+(k===act?' actif':'')+'" aria-pressed="'+(k===act)+'"'
      +' onclick="sanPoserSource(\''+quoi+'\',\''+k+'\')">'+escapeHtml(SAN_SOURCES[k])+'</button>').join('');
  // CE QUE CE CHOIX NE FAIT PAS : il ne synchronise rien. Il dit d'ou vient la
  // donnee, et l'historique deja enregistre garde SA source d'origine.
  _sanFeuille('Modifier ma source',
    '<div class="sv-src" style="--sv-c:'+(quoi==='sommeil'?'#60a5fa':'#ff3b3b')+'">'
    +'<div class="san-aide" style="margin-bottom:12px">D\'où viennent tes données.</div>'
    +_sanSrcFamille('Applications de santé',coeur,
      '<div class="sv-src-l1">'+SAN_SRC_APPS.map(k=>_sanSrcLigne(quoi,k,act)).join('')+'</div>')
    +_sanSrcFamille('Montres connectées',montre,
      '<div class="sv-src-l2">'+SAN_SRC_MONTRES.map(k=>_sanSrcLigne(quoi,k,act)).join('')+'</div>')
    +'<div class="sv-src-autres"><span>Autres sources</span><div>'+autres+'</div></div>'
    +'</div>');
}
function sanPoserSource(quoi,cle){
  if(!SAN_SOURCES[cle]) return;
  const u=currentUser;
  if(!u.santeSource) u.santeSource={};
  u.santeSource[quoi]=cle;
  saveUser();
  CLOUD.pushOne(u.email,u);
  try{ rcm('tracker_selected'); }catch(e){}
  sanFermer(); sanRendre();
}
// ══ GARMIN : LA MONTRE ENVOIE SEULE (lot G1, 30/09/2026) ═══════════════════
// La Health API de Garmin pousse les journées au serveur léger
// (cloudflare/src/garmin.js), qui les range dans sante_sync/<clé> comme
// celles de Health Connect : sanSyncTirer les lit et les fusionne sans rien
// savoir de plus, sauf l'origine d'un jour (jours/<d>/origines = 'garmin').
//
// L'ÉTAT vient de /fn/garmin {action:'etat'} : {dispo, lie, lieLe,
// derniereReception}. dispo:false tant que les secrets GARMIN_* ne sont pas
// posés côté serveur : la fiche Garmin garde alors ses instructions.
// Dispo et non relié : un bouton « Connecter Garmin » REMPLACE les
// instructions. Relié : l'état, et la révocation dans les réglages santé.
let _garminEtat=null;
function _garminNorm(r){
  if(!r||typeof r!=='object') return null;
  return {dispo:!!r.dispo,lie:!!r.lie,lieLe:Number(r.lieLe)||null,derniereReception:Number(r.derniereReception)||null};
}
async function garminEtatLire(){
  if(!SERVEUR_LEGER||typeof navigator!=='undefined'&&navigator.onLine===false) return _garminEtat;
  try{ _garminEtat=_garminNorm(await CLOUD._callFn('garmin',{action:'etat'})); }catch(e){}
  return _garminEtat;
}
// PURE. Ce que la fiche Garmin montre À LA PLACE des instructions ; '' quand
// la connexion n'est pas ouverte (les instructions restent).
function htmlGarminFiche(etat,maintenant){
  const e=_garminNorm(etat);
  if(!e||!e.dispo) return '';
  const quoi='Tes pas, ton sommeil, ta fréquence cardiaque au repos et ta variabilité';
  if(e.lie) return '<div class="gar-etat"><span class="sv-sync-pt" data-recu="'+!!e.derniereReception+'" aria-hidden="true"></span><b>Garmin est connecté</b></div>'
    +'<div class="san-aide">'+(e.derniereReception?'Dernière réception '+escapeHtml(_sanIlYa(e.derniereReception,maintenant))+'.'
      :'Rien reçu pour l’instant : Garmin envoie après la prochaine synchronisation de ta montre.')+'</div>'
    +'<div class="san-aide">'+quoi+' arrivent seuls, sans rien recopier.</div>'
    +'<button type="button" class="btn btn-outline btn-sm" style="width:100%;margin:12px 0 0" onclick="sanFermer();sanSyncOuvrir()">Gérer la connexion</button>';
  return '<div class="san-aide" style="margin-bottom:12px">Relie ton compte Garmin Connect : '+quoi.charAt(0).toLowerCase()+quoi.slice(1)+' arrivent seuls, même quand ton téléphone dort.</div>'
    +'<button type="button" class="btn btn-red" style="width:100%;margin:0" onclick="garminConnecter()">Connecter Garmin</button>'
    +'<div class="san-aide" style="margin-top:10px">Garmin te demande ton accord, puis te ramène ici.</div>';
}
// PURE. Le bloc Garmin des réglages santé ; '' quand la connexion n'est pas ouverte.
function htmlGarminReglages(etat,maintenant){
  const e=_garminNorm(etat);
  if(!e||!e.dispo) return '';
  if(e.lie) return '<div class="ss-garmin"><div class="ss-garmin-t"><span class="sv-sync-pt" data-recu="'+!!e.derniereReception+'" aria-hidden="true"></span><b>Garmin Connect</b> · connecté</div>'
    +'<div class="ss-d">'+(e.derniereReception?'Dernière réception '+escapeHtml(_sanIlYa(e.derniereReception,maintenant)):'Rien reçu pour l’instant')+'</div>'
    +'<button type="button" class="ss-deco" onclick="garminDeconnecter()">Déconnecter Garmin</button></div>';
  return '<div class="ss-garmin"><div class="ss-garmin-t"><b>Tu as une montre Garmin ?</b></div>'
    +'<div class="ss-d">Relie Garmin Connect : ta montre envoie seule, sans le téléphone.</div>'
    +'<button type="button" class="ss-btn" onclick="garminConnecter()">Connecter Garmin</button></div>';
}
async function garminConnecter(){
  if(!demanderConsentementSante('pas',()=>garminConnecter())) return null;
  try{
    const r=await CLOUD._callFn('garmin',{action:'lier'});
    if(r&&r.url){ location.href=r.url; return r.url; }
  }catch(e){ toast(e&&e.message?e.message:'Connexion impossible','var(--orange)'); }
  return null;
}
async function garminDeconnecter(){
  if(!confirm('Déconnecter Garmin ? Ta montre n’enverra plus rien à RepCore. Ce qui est déjà dans ton suivi reste.')) return false;
  try{
    await CLOUD._callFn('garmin',{action:'revoquer'});
    _garminEtat=Object.assign({},_garminEtat||{dispo:true},{lie:false,lieLe:null,derniereReception:null});
    try{ _ssPeindre(); }catch(e){}
    toast('Garmin déconnecté','var(--green)');
    return true;
  }catch(e){ toast(e&&e.message?e.message:'Connexion impossible','var(--orange)'); return false; }
}
// Le retour de Garmin : ?garmin=ok|refus|expire|erreur|ferme.
const GARMIN_RETOURS=Object.freeze({ok:['Garmin est connecté','var(--green)'],
  refus:['Connexion Garmin annulée','var(--orange)'],expire:['Le lien a expiré : recommence depuis les réglages santé','var(--orange)'],
  erreur:['Garmin n’a pas répondu : réessaie dans un instant','var(--orange)'],ferme:['La connexion Garmin n’est pas encore ouverte','var(--orange)']});
function garminRetour(code){
  const r=GARMIN_RETOURS[code];
  if(!r) return false;
  toast(r[0],r[1]);
  garminEtatLire().then(()=>{ try{ sanSyncOuvrir(); }catch(e){} }).catch(()=>{});
  if(code==='ok'){ _sanSyncLu=0; sanSyncTirer(true).catch(()=>{}); }
  return true;
}

// ══ LA SANTÉ SYNCHRONISÉE (Health Connect, Raccourci iPhone) ═════════════
// Décision de Kevin (28/09/2026). L'APK Android lit Health Connect, le
// Raccourci iPhone « RepCore Santé » lit Apple Santé ; les deux POSTENT au
// serveur léger (cloudflare/src/sante.js), qui range les jours dans
// sante_sync/<clé>. L'app les LIT ici et les FUSIONNE dans les journaux
// habituels, par les mêmes portes que la saisie (_recordSteps, _recordSleep,
// _recordWeight) : le reste de l'app ne sait pas d'où vient un chiffre.
//
// QUI GAGNE, jour par jour :
//   · une saisie MANUELLE postérieure à la réception de ce jour ;
//   · sinon la synchronisation, qui remplace une capture, une ancienne
//     synchronisation ou une saisie manuelle plus ancienne ;
//   · une pesée à la main n'est JAMAIS remplacée ;
//   · jamais une date future, jamais au-delà de 180 jours.
// VFC : RMSSD (Health Connect) et SDNN (Apple) ne se comparent pas ; la
// méthode voyage avec chaque valeur.
const SAN_SYNC_RETENTION_JOURS=180;
const SAN_SYNC_INTERVALLE_MS=10*60*1000;
const SAN_SYNC_URL_RECEPTION=SERVEUR_LEGER_URL+'/sante/i/';
const SAN_SYNC_DEFAUT={android:'google',ios:'apple'};
let _sanSyncLu=0, _sanSyncEnCours=null, _sanSyncMeta=null;

// L'appel authentifié du jeton : creer (rend le jeton en clair, une fois),
// revoquer, etat. La création exige le consentement santé.
async function santeJeton(action){
  if(action==='creer'&&!demanderConsentementSante('pas',()=>santeJeton('creer'))) return null;
  const r=await CLOUD._callFn('santeJeton',{action});
  if(action==='revoquer'){ _sanSyncMeta=null; _sanSyncLu=0; }
  return r;
}
// L'adresse que l'APK ou le Raccourci appellent.
function sanSyncAdresse(jeton){ return SAN_SYNC_URL_RECEPTION+encodeURIComponent(String(jeton||'')); }

// L'instant d'une entrée manuelle (0 si elle n'en porte pas).
function _sanInstant(e){ return Number(e&&(e.updatedAt||e.createdAt))||0; }
// Un chiffre saisi par l'athlète APRÈS la réception de ce jour gagne.
function _sanManuelGagne(e,recu){
  return !!(e&&e.dataStatus==='manual'&&_sanInstant(e)>(Number(recu)||0));
}
function _sanMarquer(e,marque){
  if(!e) return;
  const m=marque||{};
  e.dataStatus=m.dataStatus||'manual';
  e.updatedAt=Date.now();
  if(m.source) e.source=m.source;
}
// La source d'une origine reçue : une clé connue de SAN_SOURCES, sinon
// l'écosystème de la plateforme.
function _sanOrigine(o,plateforme){
  const k=String(o||'').toLowerCase();
  return SAN_SOURCES[k]&&k!=='manuel'?k:(SAN_SYNC_DEFAUT[plateforme]||'autre');
}

// PURE. Ce que la synchronisation `sync` ({meta, jours}) doit écrire dans
// `dossier` à l'instant `maintenant`. Rend le plan, sans rien toucher :
//   {pas:[{date,count,source}], sommeil:[{date,duration,bed,wake,phases,source}],
//    poids:[{date,kg}], fc:[{date,bpm}], vfc:[{date,ms,methode}],
//    origines:{pas,sommeil}, gardes:n}
// `gardes` compte les jours où une saisie manuelle plus récente l'emporte.
function sanFusionSync(dossier,sync,maintenant){
  const u=dossier||{}, t=Number(maintenant)||Date.now();
  const plan={pas:[],sommeil:[],poids:[],fc:[],vfc:[],origines:{},gardes:0};
  const meta=(sync&&sync.meta)||{}, jours=(sync&&sync.jours)||{};
  if(!meta.empreinte&&!meta.derniereReception) return plan;
  const auj=localISODate(new Date(t));
  const min=localISODate(new Date(t-SAN_SYNC_RETENTION_JOURS*864e5));
  const orig=meta.origines||{};
  const srcPas=_sanOrigine(orig.pas,meta.plateforme), srcSom=_sanOrigine(orig.sommeil,meta.plateforme);
  if(orig.pas||meta.plateforme) plan.origines.pas=srcPas;
  if(orig.sommeil||meta.plateforme) plan.origines.sommeil=srcSom;
  const trouver=(l,d)=>(Array.isArray(l)?l:[]).find(e=>e&&e.date===d)||null;
  for(const d of Object.keys(jours).sort()){
    const j=jours[d];
    if(!j||typeof j!=='object'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||d>auj||d<min) continue;
    const recu=Number(j.recu)||Number(meta.derniereReception)||0;
    // LOT G1 : un jour écrit par Garmin le dit (jours/<d>/origines) ; sinon l'origine du compte.
    const oj=(j.origines&&typeof j.origines==='object')?j.origines:{};
    const sp=oj.pas==='garmin'?'garmin':srcPas, ss=oj.sommeil==='garmin'?'garmin':srcSom;
    if(oj.pas==='garmin'&&!plan.origines.pas) plan.origines.pas='garmin';
    if(oj.sommeil==='garmin'&&!plan.origines.sommeil) plan.origines.sommeil='garmin';
    const n=Number(j.pas);
    if(isFinite(n)&&n>=0&&n<=99999){
      const e=trouver(u.stepsLog,d);
      if(_sanManuelGagne(e,recu)) plan.gardes++;
      else if(!(e&&e.dataStatus==='sync'&&Number(e.count)===Math.round(n)&&e.source===sp))
        plan.pas.push({date:d,count:Math.round(n),source:sp});
    }
    const m=Number(j.sommeilMin);
    if(isFinite(m)&&m>=30&&m<=1080){
      const e=trouver(u.sleepLog,d);
      const nuit={date:d,duration:Math.round(m/60*100)/100,source:ss};
      if(/^\d{2}:\d{2}$/.test(j.coucher||'')) nuit.bed=j.coucher;
      if(/^\d{2}:\d{2}$/.test(j.lever||'')) nuit.wake=j.lever;
      if(j.phases&&typeof j.phases==='object'){
        const p={};
        for(const k of ['profond','leger','paradoxal','eveil']) if(isFinite(Number(j.phases[k]))) p[k]=Math.round(Number(j.phases[k]));
        if(Object.keys(p).length) nuit.phases=p;
      }
      if(_sanManuelGagne(e,recu)) plan.gardes++;
      else if(!(e&&e.dataStatus==='sync'&&e.duration===nuit.duration&&e.bed===nuit.bed&&e.wake===nuit.wake
        &&JSON.stringify(e.phases||null)===JSON.stringify(nuit.phases||null)&&e.source===ss))
        plan.sommeil.push(nuit);
    }
    const kg=Number(j.poids);
    if(isFinite(kg)&&kg>=PESEE_MIN&&kg<=PESEE_MAX){
      const e=trouver(u.weightLog,d), v=Math.round(kg*10)/10;
      if(e&&e.dataStatus!=='sync') plan.gardes++;
      else if(!(e&&e.kg===v)) plan.poids.push({date:d,kg:v});
    }
    const bpm=Number(j.fcRepos);
    if(isFinite(bpm)&&bpm>=30&&bpm<=120){
      const e=trouver(u.fcReposLog,d);
      if(!(e&&e.bpm===Math.round(bpm))) plan.fc.push({date:d,bpm:Math.round(bpm)});
    }
    const ms=Number(j.vfc), methode=j.vfcMethode==='rmssd'||j.vfcMethode==='sdnn'?j.vfcMethode:null;
    if(isFinite(ms)&&ms>=5&&ms<=250&&methode){
      const e=trouver(u.vfcLog,d), v=Math.round(ms*10)/10;
      if(!(e&&e.ms===v&&e.methode===methode)) plan.vfc.push({date:d,ms:v,methode});
    }
  }
  return plan;
}
// Un journal {date,…} : la valeur du jour remplacée, triée, purgée à 180 jours.
function _sanJournalPoser(liste,entree,maintenant){
  const min=localISODate(new Date((Number(maintenant)||Date.now())-SAN_SYNC_RETENTION_JOURS*864e5));
  const l=(Array.isArray(liste)?liste:[]).filter(e=>e&&e.date!==entree.date&&e.date>=min);
  l.push(entree);
  return l.sort((a,b)=>a.date<b.date?-1:1);
}
// Applique un plan au dossier courant, par les portes habituelles.
// Rend le nombre de valeurs écrites.
function sanAppliquerSync(plan){
  const u=currentUser;
  if(!u||!plan||!aConsentiSante(u)) return 0;
  let n=0;
  for(const p of plan.pas) if(_recordSteps(p.date,p.count,{dataStatus:'sync',source:p.source})) n++;
  for(const s of plan.sommeil)
    if(_recordSleep(s.date,{bed:s.bed,wake:s.wake,duration:s.duration,phases:s.phases},{dataStatus:'sync',source:s.source})) n++;
  for(const p of plan.poids) if(_recordWeight(p.date,p.kg,{dataStatus:'sync'})) n++;
  for(const f of plan.fc){ u.fcReposLog=_sanJournalPoser(u.fcReposLog,f); n++; }
  for(const v of plan.vfc){ u.vfcLog=_sanJournalPoser(u.vfcLog,v); n++; }
  const o=plan.origines||{};
  for(const q of ['pas','sommeil']){
    if(o[q]&&(!u.santeSource||u.santeSource[q]!==o[q])){
      if(!u.santeSource) u.santeSource={};
      u.santeSource[q]=o[q]; n++;
    }
  }
  return n;
}
// LIRE, FUSIONNER, DIRE « CONSOMMÉ ». Au plus une lecture par 10 minutes
// (`force` pour le bouton d'essai). Silencieux en cas d'échec : la saisie
// manuelle et la capture restent là.
async function sanSyncTirer(force){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u||!u.email||u.role==='coach'||!SERVEUR_LEGER) return null;
  if(_sanSyncEnCours) return _sanSyncEnCours;
  if(!force&&Date.now()-_sanSyncLu<SAN_SYNC_INTERVALLE_MS) return null;
  if(typeof navigator!=='undefined'&&navigator.onLine===false) return null;
  _sanSyncLu=Date.now();
  _sanSyncEnCours=(async()=>{
    try{
      const token=await CLOUD._getToken(); if(!token) return null;
      const url=CLOUD._fbUrl.replace('users.json','sante_sync/'+String(u.email).toLowerCase().replace(/\./g,',')+'.json');
      const r=await fetch(url+'?auth='+token);
      if(!r.ok) return null;
      const sync=await r.json();
      const avant=JSON.stringify(_sanSyncMeta);
      _sanSyncMeta=_sanMetaNorm(sync&&sync.meta);
      if(JSON.stringify(_sanSyncMeta)!==avant){ try{ _majPastilleLifestyle(); }catch(e){} }
      if(!sync||!sync.meta) return null;
      const plan=sanFusionSync(currentUser,sync,Date.now());
      const n=sanAppliquerSync(plan);
      if(n){ saveUser(); CLOUD.pushOne(currentUser.email,currentUser); }
      if(n||JSON.stringify(_sanSyncMeta)!==avant){ try{ if(document.getElementById('s-lifestyle')?.classList.contains('active')) sanRendre(); }catch(e){} }
      try{ _rendreBandeSante(); }catch(e){}
      if(sync.meta.derniereReception&&!(Number(sync.consomme)>=Number(sync.meta.derniereReception))){
        try{ await fetch(url.replace('.json','/consomme.json')+'?auth='+token,{method:'PUT',body:JSON.stringify(Date.now())}); }catch(e){}
      }
      return {ecrits:n,gardes:plan.gardes,meta:_sanSyncMeta};
    }catch(e){ return null; }
    finally{ _sanSyncEnCours=null; }
  })();
  return _sanSyncEnCours;
}
try{
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) sanSyncTirer().catch(()=>{}); });
}catch(e){}
// ══ LA SANTÉ SYNCHRONISÉE — L'INTERFACE ══════════════════════════════════
// Une tuile en tête des méthodes (Lifestyle), une feuille « Connecter mes
// données santé » calquée sur #ios-install-modal, une pastille chez le coach.
//
// RACCOURCI_SANTE_URL : le lien iCloud du Raccourci « RepCore Santé », que
// Kevin publie lui-même. Vide, l'étape le dit au lieu d'ouvrir un lien mort.
// SAN_SYNC_APK_LIEN : le lien que l'APK (TWA com.repcore.app, version 4 et
// plus) intercepte : ConnecterSanteActivity range le jeton, fait confirmer le
// compte, demande l'accès à Health Connect et lance la première lecture.
// ⚠ À POSER : le lien iCloud que Kevin a publié (Raccourcis › RepCore Santé ›
//   Partager › Copier le lien iCloud). Seule forme acceptée : RACCOURCI_SANTE_FORME.
const RACCOURCI_SANTE_URL='';
const RACCOURCI_SANTE_FORME=/^https:\/\/www\.icloud\.com\/shortcuts\/[0-9a-f]{32}$/;
function raccourciSanteUrl(){ return RACCOURCI_SANTE_FORME.test(RACCOURCI_SANTE_URL)?RACCOURCI_SANTE_URL:''; }
// Plus de 48 h sans réception sur iPhone : la tuile passe à « À relancer ».
const SAN_SYNC_RELANCER_MS=48*3600e3;
let _sanEnvoiAt=0;   // l'heure où « Envoyer / Tester maintenant » a été touché
const SAN_SYNC_RACCOURCI_LANCER='shortcuts://run-shortcut?name=RepCore%20Sant%C3%A9';
const SAN_SYNC_APK_LIEN=j=>'intent://sante/connecter?jeton='+encodeURIComponent(j)+'#Intent;scheme=repcore;package=com.repcore.app;end';
const SAN_SYNC_APK_MIN=4;   // l'APK 3 (PWABuilder) ne sait pas lire Health Connect
const AIDE_APK_URL='/aide-apk.html';
const SAN_SYNC_SOURCES=Object.freeze({healthconnect:'Health Connect',raccourci:'Apple Santé',garmin:'Garmin Connect'});
const SAN_SYNC_GUET_MS=2*60*1000, SAN_SYNC_GUET_PAS_MS=10*1000;
let _ssAdresse=null, _ssJeton=null, _ssGuet=null, _ssGuetFin=0;
// L'APK se reconnaît à ?apk=<versionCode>, que LauncherActivity ajoute à
// chaque ouverture (rangé dans rc_apk par importFromURL), ou au référent
// android-app:// d'une ouverture par l'ancien APK (version 3, sans ?apk=).
function rcDansApk(){
  try{
    if(String(document.referrer||'').indexOf('android-app://com.repcore.app')===0&&!localStorage.getItem('rc_apk'))
      localStorage.setItem('rc_apk','3');
    return /^\d{1,6}$/.test(localStorage.getItem('rc_apk')||'');
  }catch(e){ return false; }
}
// La version de l'APK qui a ouvert la page (0 hors APK).
function rcVersionApk(){ try{ return Number(localStorage.getItem('rc_apk'))||0; }catch(e){ return 0; } }
// La méta, qu'elle vienne de la base (empreinte) ou de santeJeton('etat') (actif).
function _sanMetaNorm(m){
  if(!m||typeof m!=='object') return null;
  return {actif:!!(m.empreinte||m.actif),creeLe:Number(m.creeLe)||null,derniereReception:Number(m.derniereReception)||null,
    plateforme:m.plateforme||null,source:m.source||null,origines:m.origines||null,
    dernierEnvoi:(m.dernierEnvoi&&typeof m.dernierEnvoi==='object')?m.dernierEnvoi:null,
    // LOT G1 : relié à Garmin (sans jeton). `actif` reste celui du jeton Health Connect.
    garmin:(m.garmin&&typeof m.garmin==='object')?m.garmin:null};
}
function sanSyncActif(){ return !!(_sanSyncMeta&&_sanSyncMeta.actif); }
// PURE. « à l'instant », « il y a 12 min », « il y a 3 h », « hier », « il y a 4 jours ».
function _sanIlYa(t,maintenant){
  const d=Math.max(0,(Number(maintenant)||Date.now())-Number(t));
  if(d<60e3) return 'à l’instant';
  if(d<3600e3) return 'il y a '+Math.floor(d/60e3)+' min';
  if(d<86400e3) return 'il y a '+Math.floor(d/3600e3)+' h';
  const j=Math.floor(d/86400e3);
  return j===1?'hier':'il y a '+j+' jours';
}
// PURE. Ce que la tuile et le pied disent : {actif, recu, lib, source, quand}.
function sanSyncEtat(meta,quoi,maintenant){
  const m=_sanMetaNorm(meta);
  if(!m||!(m.actif||m.garmin)) return {actif:false,recu:false,lib:'',source:'',quand:''};
  const o=(m.origines||{})[quoi==='sommeil'?'sommeil':'pas'];
  const source=(o&&SAN_SOURCES[o]&&o!=='manuel')?SAN_SOURCES[o]:(SAN_SYNC_SOURCES[m.source]||(m.garmin?SAN_SOURCES.garmin:''));
  if(!m.derniereReception) return {actif:true,recu:false,lib:'En attente',source,quand:'rien reçu pour l’instant'};
  const quand=_sanIlYa(m.derniereReception,maintenant);
  // iPhone : l'automatisation ne part pas toujours. Au-delà de 48 h, on le dit.
  if(m.plateforme==='ios'&&(Number(maintenant)||Date.now())-m.derniereReception>SAN_SYNC_RELANCER_MS)
    return {actif:true,recu:true,relancer:true,lib:'À relancer',source,quand};
  return {actif:true,recu:true,lib:'Synchronisé',source,quand};
}
// PURE. « Données reçues : 3 jours, 2 nuits ».
function texteDonneesRecues(d){
  const j=Math.max(0,Math.round(Number(d&&d.jours)||0)), n=Math.max(0,Math.round(Number(d&&d.nuits)||0));
  return 'Données reçues : '+j+' jour'+(j>1?'s':'')+', '+(n?n+' nuit'+(n>1?'s':''):'aucune nuit');
}
// PURE. La bande du matin (#sante-envoyer) : affichée depuis `depuis`, tant
// qu'aucune réception n'est arrivée après, et 24 h au plus.
function htmlBandeSante(meta,depuis,maintenant){
  const d=Number(depuis)||0, t=Number(maintenant)||Date.now();
  if(!d||t-d>864e5) return '';
  const m=_sanMetaNorm(meta);
  if(m&&m.derniereReception&&m.derniereReception>=d) return '';
  return '<div class="san-bande" role="status">'
    +'<div class="san-bande-t">Ta nuit n’est pas encore arrivée</div>'
    +'<div class="san-bande-d">Lance le Raccourci RepCore Santé : tes données arrivent en quelques secondes.</div>'
    +'<a class="btn btn-red san-bande-b" href="'+SAN_SYNC_RACCOURCI_LANCER+'" onclick="sanEnvoiLance()">Envoyer mes données</a>'
    +'</div>';
}
function _sanBandeDepuis(){ try{ return Number(localStorage.getItem('rc_sante_bande'))||0; }catch(e){ return 0; } }
function _sanBandePoser(v){ try{ if(v) localStorage.setItem('rc_sante_bande',String(v)); else localStorage.removeItem('rc_sante_bande'); }catch(e){} }
function _rendreBandeSante(){
  const z=document.getElementById('ls-sante-bande');
  if(!z) return;
  const h=htmlBandeSante(_sanSyncMeta,_sanBandeDepuis(),Date.now());
  if(!h&&_sanBandeDepuis()) _sanBandePoser(0);
  z.innerHTML=h; z.style.display=h?'':'none';
}
// La notification du matin (./#sante-envoyer) : Lifestyle, et la bande en haut.
function sanEnvoyerOuvrir(){
  _sanBandePoser(Date.now());
  try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}
  try{ loadLifestyle(); }catch(e){}
  try{ santeJetonEtat().then(()=>_rendreBandeSante()).catch(()=>{}); }catch(e){}
}
try{ window.addEventListener('hashchange',()=>{ if(location.hash==='#sante-envoyer') sanEnvoyerOuvrir(); }); }catch(e){}
// Touché : « Envoyer mes données », « Envoyer maintenant », « Tester maintenant ».
// Le lien shortcuts:// part du GESTE lui-même (un <a href>, jamais
// location.href dans un délai) : iOS bloque un lien d'app qui n'en vient pas.
function sanEnvoiLance(){ _sanEnvoiAt=Date.now(); return true; }
// Au retour au premier plan, après un envoi : relire, fusionner, le dire.
async function sanEnvoiRetour(){
  if(!_sanEnvoiAt||Date.now()-_sanEnvoiAt>15*60e3) return null;
  const depuis=_sanEnvoiAt-5000;
  for(let i=0;i<7;i++){
    try{
      const m=await santeJetonEtat();
      if(m&&m.derniereReception&&m.derniereReception>=depuis){
        _sanEnvoiAt=0;
        toast(texteDonneesRecues(m.dernierEnvoi),'var(--green)');
        _sanSyncLu=0; sanSyncTirer(true).catch(()=>{});
        _rendreBandeSante();
        return m;
      }
    }catch(e){}
    await new Promise(r=>setTimeout(r,10000));
  }
  return null;
}
try{ document.addEventListener('visibilitychange',()=>{ if(!document.hidden) sanEnvoiRetour().catch(()=>{}); }); }catch(e){}
function _svTuileSync(u,quoi){
  const e=sanSyncEtat(_sanSyncMeta,quoi,Date.now());
  const nuit=(quoi==='sommeil');
  return '<button type="button" class="sv-tuile sv-tuile-s'+(e.relancer?' sv-sync-relancer':(e.actif?' sv-sync-on':''))+'" onclick="sanSyncOuvrir()">'
    +'<span class="sv-tuile-h"><span class="sv-tuile-ico">'+SAN_ICO.synchro+'</span>'
      +'<span class="sv-tuile-t">'+(e.actif?escapeHtml(e.lib):'Synchronisation automatique')+'</span><span class="sv-chev">'+SAN_ICO.droite+'</span></span>'
    +(e.actif
      ?'<span class="sv-tuile-d"><span class="sv-sync-pt" data-recu="'+e.recu+'"'+(e.relancer?' data-relancer="true"':'')+' aria-hidden="true"></span>'
        +escapeHtml([e.source,e.quand].filter(Boolean).join(' · '))+'</span>'
      :'<span class="sv-tuile-d">'+(nuit?'Ton sommeil arrive tout seul':'Tes pas arrivent tout seuls')
        +' depuis ton téléphone (Health Connect, Apple Santé).</span>')
    +'</button>';
}
function _svPiedSource(u,quoi){
  const e=sanSyncEtat(_sanSyncMeta,quoi,Date.now());
  if(e.actif) return '<button type="button" class="san-src" onclick="sanSyncOuvrir()">'+escapeHtml(e.lib)
    +(e.source?' : <strong>'+escapeHtml(e.source)+'</strong>':'')+' · '+escapeHtml(e.quand)+'</button>';
  return '<button type="button" class="san-src" onclick="sanChangerSource(\''+quoi+'\')">Source : <strong>'+escapeHtml(sanSource(u,quoi).lib)+'</strong></button>';
}

// ── LA FEUILLE « CONNECTER MES DONNÉES SANTÉ » ────────────────────────────
function _ssEtape(n,titre,texte,extra){
  return '<div class="ss-etape"><div class="ss-num">'+n+'</div><div class="ss-c">'
    +'<div class="ss-t">'+titre+'</div>'+(texte?'<div class="ss-d">'+texte+'</div>':'')+(extra||'')+'</div></div>';
}
function _ssBouton(lib,action,second){
  return '<button type="button" class="ss-btn'+(second?' ss-btn-2':'')+'" onclick="'+action+'">'+lib+'</button>';
}
function _ssPlateforme(){
  try{
    if(rcInstalliOS()) return 'ios';
    if(/Android/i.test(navigator.userAgent||'')) return rcDansApk()&&rcVersionApk()>=SAN_SYNC_APK_MIN?'apk':'android';
  }catch(e){}
  return 'autre';
}
function _ssAdresseHtml(){
  if(!_ssAdresse) return _ssBouton(sanSyncActif()?'Créer une nouvelle adresse':'Créer et copier mon adresse','sanSyncCreer()');
  return '<input class="ss-adr" readonly value="'+escapeHtml(_ssAdresse)+'" onclick="this.select()" aria-label="Ton adresse personnelle">'
    +_ssBouton('Copier','sanSyncCopier()',true)
    +'<div class="ss-d ss-avert">Affichée une seule fois. Ne la partage pas : elle suffit pour envoyer des données à ton dossier.</div>';
}
function _ssGuetHtml(){
  const m=_sanSyncMeta;
  if(_ssGuet==='recu'||(m&&m.derniereReception&&!_ssGuet)) return '<div class="ss-etat" data-ok="true">Reçu '+escapeHtml(_sanIlYa(m.derniereReception,Date.now()))+'.</div>';
  if(_ssGuet==='echec') return '<div class="ss-etat" data-ok="false">Rien reçu en 2 minutes. Vérifie que l’adresse est bien collée, puis relance le test.</div>';
  if(_ssGuet) return '<div class="ss-etat">En attente de la première réception…</div>';
  return '';
}
function _htmlSanSyncFeuille(){
  const p=_ssPlateforme();
  const m=_sanSyncMeta;
  let corps='';
  if(p==='ios'){
    corps=_ssEtape(1,'Copie ton <span class="ss-r">adresse personnelle</span>','Le Raccourci l’utilise pour envoyer tes données à RepCore.',_ssAdresseHtml())
      +_ssEtape(2,'Installe le Raccourci <span class="ss-r">RepCore Santé</span>',
        raccourciSanteUrl()?'À l’ajout, colle ton adresse quand il la demande ; au premier lancement, autorise l’accès à Santé.':'Le lien du Raccourci arrive très bientôt.',
        raccourciSanteUrl()?'<a class="ss-btn ss-btn-2" href="'+escapeHtml(raccourciSanteUrl())+'" target="_blank" rel="noopener">Obtenir le Raccourci</a>':'')
      +_ssEtape(3,'Automatise-le à <span class="ss-r">9 h</span>',
        'Raccourcis › Automatisation › + › Heure de la journée : 09:00, tous les jours, Exécuter immédiatement › RepCore Santé.')
      +_ssEtape(4,'Teste maintenant','Lance le Raccourci une fois : RepCore guette la réception pendant 2 minutes.',
        '<a class="ss-btn ss-btn-2" href="'+SAN_SYNC_RACCOURCI_LANCER+'" onclick="sanEnvoiLance();sanSyncGuetter()">Tester maintenant</a>')
      +_ssEtape(5,'C’est reçu ?','',_ssGuetHtml()||'<div class="ss-etat">Le test s’affiche ici.</div>');
  } else if(p==='apk'){
    const src=(TRK_APPAREILS.find(a=>a.id===sanSource(currentUser,'pas').cle)||{}).app||'l’application de ta montre';
    corps=_ssEtape(1,'Relie ta montre à <span class="ss-r">Health Connect</span>',
        'Dans '+escapeHtml(src)+', active le partage avec Health Connect (dans ses réglages).')
      +_ssEtape(2,'Autorise <span class="ss-r">RepCore</span>','Android te demande quelles données partager : pas, sommeil, fréquence cardiaque, poids.',
        _ssBouton(sanSyncActif()?'Autoriser à nouveau':'Autoriser','sanSyncApk()'))
      +_ssEtape(3,'C’est reçu ?','La première synchronisation part tout de suite.',_ssGuetHtml()||'<div class="ss-etat">La réception s’affiche ici.</div>');
  } else if(p==='android'){
    const maj=rcDansApk();   // l'ancien APK (version 3) : à mettre à jour
    corps=_ssEtape(1,(maj?'Mets à jour':'Installe')+' l’application <span class="ss-r">RepCore</span> pour Android',
        'C’est elle qui lit Health Connect : le navigateur n’y a pas accès.'+(maj?' Installe-la par-dessus l’ancienne, sans désinstaller.':''),
        '<a class="ss-btn" href="'+AIDE_APK_URL+'" target="_blank" rel="noopener">'+(maj?'Mettre à jour':'Installer l’application')+'</a>')
      +_ssEtape(2,'Ouvre RepCore depuis l’application','Puis reviens ici : la connexion prend une minute.');
  } else {
    corps=_ssEtape(1,'Ouvre RepCore sur ton <span class="ss-r">téléphone</span>','La synchronisation lit Apple Santé (iPhone) ou Health Connect (Android), qui vivent sur le téléphone.');
  }
  const e=sanSyncEtat(m,'pas',Date.now());
  // iPhone déjà connecté : l'envoi à la main en tête ; À RELANCER : l'aide d'abord.
  if(p==='ios'&&e.actif){
    corps=(e.relancer?'<div class="ss-aide"><div class="ss-t">Rien n’est arrivé depuis '+escapeHtml(e.quand.replace(/^il y a /,''))+'</div>'
        +'<div class="ss-d">Trois causes, presque toujours :</div><ul class="ss-causes">'
        +'<li><b>iPhone verrouillé</b> à l’heure de l’automatisation : iOS la reporte, parfois jusqu’au lendemain.</li>'
        +'<li><b>Automatisation désactivée</b> : Raccourcis › Automatisation › RepCore Santé, « Exécuter immédiatement » coché.</li>'
        +'<li><b>Autorisations Santé refusées</b> au Raccourci : Réglages › Santé › Accès aux données › Raccourcis.</li></ul></div>':'')
      +'<a class="ss-btn ss-envoi" href="'+SAN_SYNC_RACCOURCI_LANCER+'" onclick="sanEnvoiLance()">Envoyer maintenant</a>'
      +corps;
  }
  return '<div class="ss-tete"><div class="ss-titre">Connecter mes données santé</div>'
      +'<button type="button" class="ss-x" onclick="sanSyncFermer()" aria-label="Fermer">✕</button></div>'
    +(e.actif?'<div class="ss-statut'+(e.relancer?' ss-relancer':'')+'"><span class="sv-sync-pt" data-recu="'+e.recu+'"'+(e.relancer?' data-relancer="true"':'')+' aria-hidden="true"></span><b>'+escapeHtml(e.lib)+'</b>'
      +escapeHtml([e.source,e.quand].filter(Boolean).map(x=>' · '+x).join(''))+'</div>':'')
    // LOT G1 : Garmin, qui envoie sans le téléphone. Relié, il passe devant les étapes du téléphone.
    +((_garminEtat&&_garminEtat.lie)?htmlGarminReglages(_garminEtat,Date.now()).replace('class="ss-garmin"','class="ss-garmin ss-garmin-tete"'):'')
    +'<div class="ss-etapes">'+corps+'</div>'
    +((_garminEtat&&_garminEtat.lie)?'':htmlGarminReglages(_garminEtat,Date.now()))
    +'<div class="ss-note">Pas, sommeil, fréquence cardiaque au repos, variabilité, poids : rien d’autre. Une saisie à la main reste prioritaire.</div>'
    // Le jeton Health Connect seulement : un compte relié à Garmin seul n'en a pas.
    +(sanSyncActif()?'<button type="button" class="ss-deco" onclick="sanSyncDeconnecter()">Déconnecter</button>':'');
}
function _ssPeindre(){
  const z=document.getElementById('sante-sync-feuille');
  if(z) z.innerHTML=_htmlSanSyncFeuille();
}
function sanSyncOuvrir(){
  let m=document.getElementById('sante-sync-modal');
  if(!m){
    m=document.createElement('div');
    m.id='sante-sync-modal'; m.className='ss-fond';
    m.setAttribute('role','dialog'); m.setAttribute('aria-modal','true'); m.setAttribute('aria-label','Connecter mes données santé');
    m.onclick=(ev)=>{ if(ev.target===m) sanSyncFermer(); };
    m.innerHTML='<div class="ss-feuille" id="sante-sync-feuille"></div>';
    document.body.appendChild(m);
  }
  _ssPeindre();
  m.style.display='flex';
  // L'état du serveur, frais : la feuille se repeint quand il arrive.
  santeJetonEtat().then(()=>_ssPeindre()).catch(()=>{});
  garminEtatLire().then(()=>_ssPeindre()).catch(()=>{});
}
function sanSyncFermer(){
  const m=document.getElementById('sante-sync-modal');
  if(m) m.style.display='none';
  _ssAdresse=null; _ssJeton=null;
  try{ if(document.getElementById('s-lifestyle')?.classList.contains('active')) sanRendre(); }catch(e){}
}
async function santeJetonEtat(){
  const r=await CLOUD._callFn('santeJeton',{action:'etat'});
  _sanSyncMeta=_sanMetaNorm(r);
  return _sanSyncMeta;
}
async function sanSyncCreer(pourApk){
  if(!demanderConsentementSante('pas',()=>{ sanSyncOuvrir(); sanSyncCreer(); })) return null;
  if(sanSyncActif()&&!confirm('Une nouvelle adresse remplace l’ancienne : le Raccourci ou l’application devront la recevoir à nouveau. Continuer ?')) return null;
  try{
    const r=await santeJeton('creer');
    if(!r||!r.jeton) return null;
    _ssAdresse=sanSyncAdresse(r.jeton); _ssJeton=r.jeton;
    _sanSyncMeta={actif:true,creeLe:r.creeLe,derniereReception:null,plateforme:null,source:null,origines:null};
    _ssPeindre();
    if(!pourApk) sanSyncCopier();   // l'APK reçoit le jeton par le lien, pas par le presse-papiers
    return _ssAdresse;
  }catch(e){ toast(e&&e.message?e.message:'Connexion impossible','var(--orange)'); return null; }
}
function sanSyncCopier(){
  if(!_ssAdresse) return;
  try{ navigator.clipboard.writeText(_ssAdresse).then(()=>toast('Adresse copiée','var(--green)'),()=>{}); }catch(e){}
}
async function sanSyncApk(){
  if(!_ssJeton) await sanSyncCreer(true);
  if(!_ssJeton) return;
  sanSyncGuetter();
  try{ location.href=SAN_SYNC_APK_LIEN(_ssJeton); }catch(e){}
}
// GUETTER LA PREMIÈRE RÉCEPTION : santeJeton('etat') toutes les 10 s, 2 minutes au plus.
function sanSyncGuetter(){
  const t0=Date.now()-5000;
  _ssGuet='attente'; _ssGuetFin=Date.now()+SAN_SYNC_GUET_MS;
  _ssPeindre();
  const tour=async()=>{
    if(_ssGuet!=='attente') return;
    try{
      const m=await santeJetonEtat();
      if(m&&m.derniereReception>=t0){
        _ssGuet='recu'; _ssPeindre();
        toast('Données reçues','var(--green)');
        _sanSyncLu=0; sanSyncTirer(true).catch(()=>{});
        return;
      }
    }catch(e){}
    if(Date.now()>=_ssGuetFin){ _ssGuet='echec'; _ssPeindre(); return; }
    setTimeout(tour,SAN_SYNC_GUET_PAS_MS);
  };
  setTimeout(tour,SAN_SYNC_GUET_PAS_MS);
}
async function sanSyncDeconnecter(){
  if(!confirm('Déconnecter la synchronisation ? L’adresse ne marchera plus, et les données en attente sur le serveur sont effacées. Ce qui est déjà dans ton suivi reste.')) return;
  try{
    await santeJeton('revoquer');
    _ssAdresse=null; _ssJeton=null; _ssGuet=null;
    _ssPeindre();
    toast('Synchronisation déconnectée','var(--green)');
  }catch(e){ toast(e&&e.message?e.message:'Connexion impossible','var(--orange)'); }
}

// ── CHEZ LE COACH : « synchronisé » et la dernière réception ─────────────
// Lu dans sante_sync/<athlète>/meta (règles : le coach désigné), au plus une
// fois par 10 minutes et par athlète ; le rendu reste pur.
const _sanSyncCoach={};
function _sanSyncCoachLire(c){
  const e=String((c&&c.email)||'').toLowerCase();
  if(!e) return null;
  const k=e.replace(/\./g,',');
  const x=_sanSyncCoach[k];
  if(!x||Date.now()-x.lu>SAN_SYNC_INTERVALLE_MS){
    _sanSyncCoach[k]={lu:Date.now(),meta:x?x.meta:null};
    (async()=>{
      try{
        const token=await CLOUD._getToken(); if(!token) return;
        const r=await fetch(CLOUD._fbUrl.replace('users.json','sante_sync/'+k+'/meta.json')+'?auth='+token);
        if(!r.ok) return;
        const m=_sanMetaNorm(await r.json());
        const avant=JSON.stringify(_sanSyncCoach[k].meta);
        _sanSyncCoach[k].meta=m;
        if(JSON.stringify(m)!==avant){ try{ _csRepeindre('pas'); _csRepeindre('sommeil'); }catch(e){} }
      }catch(e){}
    })();
  }
  return _sanSyncCoach[k].meta;
}
// PURE. La pastille du coach.
function _htmlSyncCoach(meta){
  const m=_sanMetaNorm(meta);
  if(!m||!(m.actif||m.garmin)) return '';
  const d=m.derniereReception?new Date(m.derniereReception).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):null;
  return '<div class="cso-sync-l"><span class="cso-sync"><span class="sv-sync-pt" data-recu="'+!!d+'" aria-hidden="true"></span>synchronisé</span>'
    +'<span class="cso-sync-d">'+(d?'Dernière réception : '+escapeHtml(d):'Aucune réception pour l’instant')+'</span></div>';
}
function getSleepWeek(){
  const today=new Date(),dow=today.getDay();
  const mon=new Date(today);
  mon.setDate(today.getDate()-(dow===0?6:dow-1));
  return Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return localISODate(d);});
}
function calcSleepDuration(bed,wake){
  if(!bed||!wake) return null;
  const [bh,bm]=bed.split(':').map(Number);
  const [wh,wm]=wake.split(':').map(Number);
  let mins=(wh*60+wm)-(bh*60+bm);
  if(mins<=0) mins+=24*60;
  if(mins>18*60) return null;
  return Math.round(mins/6)/10;
}
function sleepColor(h){
  if(!h) return 'var(--border)';
  if(h>=7&&h<=9) return '#22c55e';
  if((h>=6&&h<7)||(h>9&&h<=10)) return '#f97316';
  return ROUGE_MARQUE;
}
function updateSleepPreview(){
  const bed=document.getElementById('sleep-bed-input')?.value;
  const wake=document.getElementById('sleep-wake-input')?.value;
  const dur=calcSleepDuration(bed,wake);
  const el=document.getElementById('sleep-preview');
  if(el) el.innerHTML=dur!=null?`<span style="font-weight:800;font-size:var(--fs-xl);color:${sleepColor(dur)}">${dur}h</span> de sommeil`:'';
}
// `user` EST OPTIONNEL et retombe sur currentUser : les trois appels existants
// ne changent pas.
// Meme contrat que loadSteps. `user` reste en deuxieme position : la fiche
// coach l'appelle ainsi depuis toujours, et deplacer ce parametre casserait
// un appelant pour une question de gout.
function loadSleep(containerId='sleep-content',user,opts){
  const _avecImport=!opts||opts.avecImport!==false;
  if(containerId==='sleep-content') go('s-sleep');
  const _u=user||currentUser;
  const log=(_u&&_u.sleepLog)||[];
  const todayStr=localISODate(new Date());
  const dayNames=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const weekDates=getSleepWeek();
  const weekData=weekDates.map((d,i)=>{
    const entry=log.find(e=>e.date===d)||null;
    return{date:d,label:dayNames[i],entry,isToday:d===todayStr};
  });
  const withData=weekData.filter(d=>d.entry?.duration!=null);
  const weekAvg=withData.length?Math.round(withData.reduce((s,d)=>s+d.entry.duration,0)/withData.length*10)/10:0;
  const weekTotal=withData.length?Math.round(withData.reduce((s,d)=>s+d.entry.duration,0)*10)/10:null;
  const maxVal=Math.max(...weekData.map(d=>d.entry?.duration||0),8);
  // Comme pour les pas : le graphe reste sur la semaine, la carte de saisie
  // suit le jour choisi, qui peut être antérieur.
  const selStr=_jourSleep();
  const todayEntry=log.find(e=>e.date===selStr)||null;
  const avgColor=sleepColor(weekAvg);

  let bars='';
  weekData.forEach(d=>{
    const h=d.entry?.duration||0;
    const pct=h?Math.max(5,Math.round(h/maxVal*100)):4;
    const col=sleepColor(h);
    bars+=_htmlBarreSemaine(pct,col,d.isToday,null);
  });
  let labels='';
  weekData.forEach(d=>{
    labels+=`<div style="flex:1;text-align:center;font-size:var(--fs-xs);font-weight:800;color:${d.isToday?'var(--red)':'var(--sub)'};text-transform:uppercase;letter-spacing:.5px">${d.label}</div>`;
  });
  let counts='';
  weekData.forEach(d=>{
    const h=d.entry?.duration;
    counts+=`<div style="flex:1;text-align:center;font-size:var(--fs-xs);font-weight:700;color:${h?sleepColor(h):'var(--border)'};margin-top:4px">${h!=null?h+'h':'·'}</div>`;
  });

  let histHtml='';
  if(log.length){
    const sortedLog=[...log].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,21);
    const rows=renderDataList(sortedLog,e=>{
      const lbl=new Date(e.date).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
      const col=sleepColor(e.duration);
      const badge=e.duration>=7&&e.duration<=9?'Idéal':'';
      return `<div style="font-size:var(--fs-sm);font-weight:600;color:var(--text-mid);text-transform:capitalize">${lbl}</div><div style="display:flex;align-items:center;gap:10px">${(e.bed&&e.wake)?`<div style="font-size:var(--fs-xs);color:var(--sub)">${e.bed} → ${e.wake}</div>`:''}${badge?`<span style="font-size:var(--fs-xs);font-weight:800;color:var(--green)">${badge}</span>`:''}<div style="font-size:var(--fs-md);font-weight:800;color:${col}">${e.duration}h</div></div>`;
    },{pad:'9px 0',justify:'space-between',gap:0,border:'#111'});
    histHtml=`<div style="background:linear-gradient(180deg,var(--surface-1),var(--dark));border:1px solid var(--surface-2);border-radius:var(--r-4);padding:16px;position:relative;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 8px 22px rgba(0,0,0,.4)"><div class="hist-bloc" style="position:relative"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div style="font-family:var(--pile-titre);font-size:var(--fs-lg);letter-spacing:2.5px;color:var(--sub);text-transform:uppercase">Historique</div><span style="font-size:var(--fs-xs);color:var(--text-faint);font-weight:700">${sortedLog.length} nuit${sortedLog.length>1?'s':''}</span></div>${rows}</div></div>`;
  }

  document.getElementById(containerId).innerHTML=`
    <!-- R28, MEME ORDRE QUE LES PAS : la nuit a saisir d abord, puis la
         semaine et sa moyenne, la cafeine, l historique. R34, l historique
         n est plus replie. -->
    <div class="card-nut" style="margin-bottom:14px;${_animEntree('sleep-saisie')}">
      
      <div style="position:absolute;left:50%;top:-30px;transform:translateX(-50%);width:130px;height:90px;border-radius:var(--r-full);background:radial-gradient(circle,rgba(96,165,250,.13),transparent 68%);pointer-events:none"></div>
      <div style="position:relative">
        ${_bandeauJour('sleep-date-input',selStr,'changeSleepDate',{avecFleches:true,
          prev:_jourVoisin(selStr,-1,STEPS_RETENTION_JOURS),
          next:_jourVoisin(selStr,1,STEPS_RETENTION_JOURS),
          retention:STEPS_RETENTION_JOURS})}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div>
            <div style="display:inline-flex;align-items:center;gap:6px;font-size:var(--fs-xs);font-weight:800;color:#60a5fa;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px"><span style="display:inline-flex;filter:drop-shadow(0 0 5px rgba(96,165,250,.9))"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter" width="12" height="12"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></span>Coucher</div>
            <input type="time" id="sleep-bed-input" value="${todayEntry?.bed||''}" oninput="updateSleepPreview()" style="font-family:var(--pile-titre);font-size:var(--fs-xl);letter-spacing:1px;text-align:center;padding:12px 4px;background:linear-gradient(180deg,var(--bg),var(--bg));border:1px solid #12304d;border-radius:var(--r-2);color:#9cc4ee;width:100%;box-sizing:border-box;box-shadow:var(--e-inset);--halo-c:rgba(96,165,250,.5);text-shadow:var(--halo-1)">
          </div>
          <div>
            <div style="display:inline-flex;align-items:center;gap:6px;font-size:var(--fs-xs);font-weight:800;color:#f5c518;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px"><span style="display:inline-flex;filter:drop-shadow(0 0 5px rgba(245,197,24,.9))"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter" width="12" height="12"><circle cx="12" cy="12" r="4.5"/><line x1="12" y1="2" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22"/><line x1="4.2" y1="4.2" x2="6" y2="6"/><line x1="18" y1="18" x2="19.8" y2="19.8"/><line x1="2" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22" y2="12"/><line x1="4.2" y1="19.8" x2="6" y2="18"/><line x1="18" y1="6" x2="19.8" y2="4.2"/></svg></span>Lever</div>
            <input type="time" id="sleep-wake-input" value="${todayEntry?.wake||''}" oninput="updateSleepPreview()" style="font-family:var(--pile-titre);font-size:var(--fs-xl);letter-spacing:1px;text-align:center;padding:12px 4px;background:linear-gradient(180deg,var(--bg),var(--surface-0));border:1px solid #4d3d12;border-radius:var(--r-2);color:#f0d98a;width:100%;box-sizing:border-box;box-shadow:var(--e-inset);--halo-c:rgba(245,197,24,.45);text-shadow:var(--halo-1)">
          </div>
        </div>
        <div id="sleep-preview" style="text-align:center;font-size:var(--fs-sm);color:var(--text-faint);margin-bottom:12px;min-height:26px">${todayEntry?.duration!=null?`<span style="font-family:var(--pile-titre);font-size:var(--fs-2xl);color:${sleepColor(todayEntry.duration)};--halo-c:${sleepColor(todayEntry.duration)};text-shadow:var(--halo-2)aa">${todayEntry.duration}h</span> de sommeil`:''}</div>
        <button class="btn btn-red" onclick="saveSleep()">Enregistrer</button>
        <!-- Jumelle de la carte des pas : sous le bouton de la nuit, en
             alternative. R28 : dans la carte, comme sur Lifestyle. -->
        ${_avecImport?_htmlCadreImportCapture('sommeil',{alternative:true}):''}
      </div>
    </div>

    <div class="card-nut" style="margin-bottom:14px;${_animEntree('sleep-sem')}">
      
      <div style="position:relative">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <span style="font-family:var(--pile-titre);font-size:var(--fs-lg);letter-spacing:2.5px;color:var(--sub);text-transform:uppercase">Cette semaine</span>
          <span style="font-size:var(--fs-xs);font-weight:800;letter-spacing:1px;color:var(--text-dim)"><span style="display:inline-block;width:6px;height:6px;border-radius:var(--r-full);background:var(--green);vertical-align:middle;box-shadow:0 0 6px color-mix(in srgb,var(--green) 90%,transparent)"></span> 7-9H</span>
        </div>
        <div style="display:flex;align-items:flex-end;gap:4px;height:80px;margin-bottom:8px;border-bottom:1px solid color-mix(in srgb,var(--text) 5%,transparent)">${bars}</div>
        <div style="display:flex;gap:4px">${labels}</div>
        <div style="display:flex;gap:4px">${counts}</div>
      </div>
    </div>
    <div style="background:#0b1d33;border-radius:var(--r-4);padding:20px;margin-bottom:14px;text-align:center;position:relative;overflow:hidden;box-shadow:var(--e3);${_animEntree('sleep-moy')}">
      
      <div style="position:absolute;right:-20px;top:-20px;width:96px;height:96px;border-radius:var(--r-full);background:color-mix(in srgb,var(--text) 5%,transparent);pointer-events:none"></div>
      <div style="position:absolute;left:14px;top:12px;color:rgba(255,255,255,.16)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter" width="22" height="22"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></div>
      <div style="position:relative">
        <div style="font-size:var(--fs-xs);color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:3px;font-weight:800;margin-bottom:8px">Moyenne hebdomadaire</div>
        <div style="font-family:var(--pile-titre);font-size:var(--fs-3xl);line-height:.95;color:${weekAvg?avgColor:'rgba(255,255,255,.55)'};letter-spacing:1px;--halo-c:${weekAvg?avgColor:'rgba(255,255,255,.4)'};text-shadow:var(--halo-3),0 0 34px ${weekAvg?avgColor+'66':'transparent'}">${weekAvg?weekAvg+'h':'-'}</div>
        <div style="font-size:var(--fs-xs);color:rgba(255,255,255,.55);margin-top:6px">heures / nuit &nbsp;·&nbsp; ${withData.length} / 7 nuits renseignées</div>
        <div style="margin-top:14px;display:flex;justify-content:center;gap:16px">
          <div style="text-align:center;flex:1"><div style="font-size:var(--fs-xs);color:rgba(255,255,255,.45);letter-spacing:1.5px;font-weight:800">OPTIMAL</div><div style="font-family:var(--pile-titre);font-size:var(--fs-xl);color:var(--green);margin-top:2px">7 – 9 h</div></div>
          <div style="width:1px;background:color-mix(in srgb,var(--text) 15%,transparent)"></div>
          <div style="text-align:center;flex:1"><div style="font-size:var(--fs-xs);color:rgba(255,255,255,.45);letter-spacing:1.5px;font-weight:800">TOTAL SEMAINE</div><div style="font-family:var(--pile-titre);font-size:var(--fs-xl);color:${weekTotal!=null?avgColor:'rgba(255,255,255,.5)'};margin-top:2px">${weekTotal!=null?weekTotal+'h':'-'}</div></div>
        </div>
      </div>
    </div>

    <!-- Le MÊME porteur que le journal ci-dessus. Lire les nuits d’un dossier
         et la caféine d’un autre mélangerait deux personnes : c’est le défaut
         qu’on vient de fermer sur nutIsOnDay et _getEffectiveMacros. -->
    ${_htmlCafeineNuits(_u,weekDates)}
    ${histHtml}
  `;
  // Meme gabarit de barres que les pas : elles naissent a 4 px et montent.
  try{
    const _z=document.getElementById(containerId);
    if(_z) _animerJauges(_z);
  }catch(e){}
}
// Jumelle de _recordSteps : une date, une nuit, écrasement plutôt qu'empilement.
// Extraite de saveSleep pour que l'import par capture n'ait pas à redire les
// règles de conservation. bed et wake sont FACULTATIFS : une nuit venue d'une
// capture ne porte que sa durée, l'écran de la montre n'affichant ni l'heure de
// coucher ni celle de lever.
function _recordSleep(dateStr,{bed,wake,duration,phases}={},marque){
  const d=Number(duration);
  // Même plafond que calcSleepDuration : au-delà de 18 h ce n'est pas une nuit.
  if(!dateStr||!Number.isFinite(d)||d<=0||d>18) return false;
  if(!currentUser.sleepLog) currentUser.sleepLog=[];
  const idx=currentUser.sleepLog.findIndex(e=>e.date===dateStr);
  // ON MET A JOUR CE QUI CHANGE, ON NE REMPLACE PAS L'ENTREE. C'est ce que
  // font deja _recordWeight — `weightLog[idx].kg=…` — et _recordSteps —
  // `stepsLog[idx].count=…` : seule cette fonction-ci reconstruisait un objet
  // neuf et l'affectait par-dessus l'ancien.
  //
  // CE QUE CA EFFACAIT. L'import par capture d'ecran appelle
  // _recordSleep(date,{duration}) SANS bed ni wake — l'application de montre ne
  // les fournit pas. L'entree neuve n'avait donc pas ces champs, et les heures
  // de coucher et de lever saisies A LA MAIN pour cette nuit-la disparaissaient.
  //
  // ET CE N'EST PAS QU'UN AFFICHAGE : `bed` alimente l'alerte de cafeine
  // residuelle — cafeineResiduelle(jours, nuit.bed) compare la cafeine encore
  // presente a l'heure du coucher. Perdre l'heure de coucher eteignait
  // silencieusement cette alerte pour la nuit importee.
  //
  // LES CHAMPS FOURNIS GAGNENT, LES AUTRES SURVIVENT : une saisie manuelle qui
  // porte bed et wake les met a jour, un import qui n'a que la duree ne touche
  // qu'a elle.
  // LES PHASES (synchronisation) suivent la durée : une durée saisie sans
  // phases retire celles d'une autre nuit mesurée, qui ne lui iraient plus.
  if(idx>=0){
    const e=currentUser.sleepLog[idx];
    e.duration=d;
    if(bed) e.bed=bed;
    if(wake) e.wake=wake;
    if(phases) e.phases=phases; else delete e.phases;
  } else {
    const entry={date:dateStr,duration:d};
    if(bed) entry.bed=bed;
    if(wake) entry.wake=wake;
    if(phases) entry.phases=phases;
    currentUser.sleepLog.push(entry);
  }
  _sanMarquer(currentUser.sleepLog.find(e=>e.date===dateStr),marque);
  const cutoff=localISODate(new Date(Date.now()-180*24*3600*1000));
  // LES VOLTS DES NUITS PURGÉES sont mis de côté : xpCalcul relit le journal,
  // et une nuit qui en sort ne doit pas faire BAISSER les volts.
  const _purgees=new Set(currentUser.sleepLog.filter(e=>e&&e.date<cutoff&&Number(e.duration)>0).map(e=>e.date));
  if(_purgees.size){
    const a=(currentUser.xpArchive&&typeof currentUser.xpArchive==='object')?currentUser.xpArchive:{};
    a.sommeil=(Number(a.sommeil)||0)+_purgees.size*XP_ACTIONS.sommeil;
    currentUser.xpArchive=a;
  }
  currentUser.sleepLog=currentUser.sleepLog.filter(e=>e.date>=cutoff);
  return true;
}
function saveSleep(){
  if(!demanderConsentementSante('sommeil',saveSleep)) return;
  const bed=document.getElementById('sleep-bed-input')?.value;
  const wake=document.getElementById('sleep-wake-input')?.value;
  if(!bed||!wake) return toast('Renseigne l\'heure de coucher et de lever','var(--orange)');
  const duration=calcSleepDuration(bed,wake);
  if(duration===null) return toast('Heures invalides : vérifie la saisie','var(--orange)');
  const jour=_jourSleep();
  if(!_recordSleep(jour,{bed,wake,duration})) return toast('Nuit invalide','var(--orange)');
  const suffixe=jour===localISODate(new Date())
    ? ''
    : ' pour le '+new Date(jour+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
  toastEcriture(saveUser(),duration+'h enregistrées'+suffixe+' !','ta nuit est');
  _rerenderLifestyle();
}

// R34 — lifestyleSectionDuMoment est retiree avec les replis de R28 : les
// deux sections sont affichees en entier, il n'y a plus rien a ouvrir.
function loadLifestyle(){
  go('s-lifestyle');
  try{ sanSyncTirer().catch(()=>{}); }catch(e){}
  // ⚠ LES DEUX CARTES REMPLACENT LES DEUX ANCIENS RENDUS SUR CET ECRAN, et
  // seulement sur celui-ci : les ecrans s-steps et s-sleep gardent loadSteps
  // et loadSleep tels quels, avec leur saisie. Rien n'est supprime.
  try{ sanRendre(); }
  // R22 — avec leur import : il n'y a plus de carte d'import en tete d'ecran.
  catch(e){ loadSteps('lifestyle-steps-content'); loadSleep('lifestyle-sleep-content'); }
}

// ======= CHARTS =======
function _setupCanvas(id,defaultH){
  const cv=document.getElementById(id);if(!cv)return null;
  const ctx=cv.getContext('2d');
  // LA HAUTEUR VOULUE EST LUE UNE SEULE FOIS. Écrire cv.height réécrit
  // l'attribut html : au rendu suivant on relirait une valeur déjà
  // multipliée par la densité, et le graphique grandirait à chaque passage.
  if(cv.dataset.hLogique==null) cv.dataset.hLogique=String(parseInt(cv.getAttribute('height'))||defaultH);
  const H=parseInt(cv.dataset.hLogique)||defaultH;
  // MÊME PIÈGE SUR LA LARGEUR. On retient la règle CSS d'origine — « 100% »
  // pour une toile fluide, rien pour une toile qui tient sa largeur de son
  // attribut — et on la rétablit avant de mesurer. Sans ça, on relirait la
  // largeur figée par le rendu précédent.
  if(cv.dataset.wCss==null) cv.dataset.wCss=cv.style.width||'';
  if(cv.dataset.wCss) cv.style.width=cv.dataset.wCss;
  const W=cv.offsetWidth||400;
  // LA DENSITÉ D'ÉCRAN. Sans elle, 300 pixels de toile sont étirés sur 900
  // pixels physiques : c'est tout le flou. Plafonnée à 3 — au-delà le coût
  // mémoire grimpe au carré sans rien apporter à l'œil.
  const dpr=Math.min(window.devicePixelRatio||1,3);
  cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);
  cv.style.width=W+'px';cv.style.height=H+'px';
  // Après setTransform, tout ce que dessinent les appelants reste exprimé en
  // pixels CSS : aucun d'eux n'a à connaître la densité.
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  // ANIMATION 9. Reporté d'une frame : à cet instant l'appelant n'a encore rien
  // dessiné, et balayer une toile vide n'aurait rien montré. Une frame plus
  // tard le tracé est là, et arcTracerCourbes ne le jouera qu'une fois.
  // Le drapeau dit « celle-ci sera peinte » : arcTracerCourbes ignore, sans
  // les marquer, les toiles qui ne le portent pas.
  cv.dataset.arcPret='1';
  try{ requestAnimationFrame(()=>arcTracerCourbes(cv)); }catch(e){}
  return{cv,ctx,w:W,h:H};
}
// LA GRILLE. Des traits pleins gris tirent l'oeil autant que la courbe :
// pointilles et plus sombres, ils redeviennent ce qu'ils sont — un reperage.
// La ligne du bas reste pleine : c'est le socle du graphique, pas un repere.
// pt/pb : les marges HAUTE et BASSE, distinctes de la marge horizontale.
// p seul servait aux trois, si bien qu'un couloir de 32 px reserve aux
// libelles d'ordonnee ecrasait aussi la courbe de 64 px sur sa hauteur.
// Sans argument, pt et pb valent p : les appelants existants ne changent pas.
function _drawGrid(ctx,w,h,p,mn,mx,pt,pb){
  pt=pt||p; pb=pb||p;
  [0,.5,1].forEach(t=>{
    const y=h-pb-t*(h-pt-pb);
    ctx.strokeStyle=t===0?_tok('--border','#242424'):'#242424';ctx.lineWidth=1;
    ctx.setLineDash(t===0?[]:[3,4]);
    ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(w-p,y);ctx.stroke();
    ctx.setLineDash([]);ctx.fillStyle='#4a4a4a';
    ctx.font='600 9px Montserrat,sans-serif';ctx.textAlign='left';ctx.textBaseline='alphabetic';
    ctx.fillText((mn+t*(mx-mn)).toFixed(1),0,y+4);
  });
}
function _drawXLabels(ctx,labels,p,xs,h){
  ctx.shadowBlur=0;ctx.fillStyle='#5a5a5a';
  ctx.font='700 9px Montserrat,sans-serif';ctx.textAlign='center';ctx.textBaseline='alphabetic';
  labels.forEach((l,i)=>ctx.fillText(l,p+i*xs,h-4));
}
// o.base : ordonnee du socle. Fournie, la surface sous la courbe est remplie
// d'un degrade qui s'eteint vers le bas. EN OPTION, et c'est deliberé : sur
// un graphique a plusieurs series, deux aplats superposes brouillent la
// lecture au lieu de l'aider.
function _drawLineSeries(ctx,pts,color,lineW,dotR,o){
  o=o||{};
  if(!pts.length) return;
  ctx.setLineDash([]);
  if(o.base!=null&&pts.length>1){
    const hauts=Math.min.apply(null,pts.map(q=>q.y));
    const g=ctx.createLinearGradient(0,hauts,0,o.base);
    g.addColorStop(0,color+'5c');g.addColorStop(.5,color+'26');g.addColorStop(1,color+'0a');
    ctx.beginPath();ctx.moveTo(pts[0].x,o.base);
    pts.forEach(q=>ctx.lineTo(q.x,q.y));
    ctx.lineTo(pts[pts.length-1].x,o.base);ctx.closePath();
    ctx.fillStyle=g;ctx.shadowBlur=0;ctx.fill();
  }
  // LA LUEUR est portee par l'ombre du contexte : sur un fond noir, un trait
  // net parait imprime, un trait qui rayonne parait allume.
  ctx.strokeStyle=color;ctx.lineWidth=lineW;
  ctx.lineJoin='round';ctx.lineCap='round';
  ctx.shadowColor=color;ctx.shadowBlur=9;
  if(pts.length>1){
    ctx.beginPath();
    pts.forEach((pt,i)=>i===0?ctx.moveTo(pt.x,pt.y):ctx.lineTo(pt.x,pt.y));
    ctx.stroke();
  }
  // Les points par-dessus : un anneau sombre les detache du remplissage,
  // sinon ils se noient dedans des que la courbe descend.
  pts.forEach(pt=>{
    ctx.shadowBlur=10;ctx.fillStyle=color;
    ctx.beginPath();ctx.arc(pt.x,pt.y,dotR,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.strokeStyle='#0b0b0b';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(pt.x,pt.y,dotR,0,Math.PI*2);ctx.stroke();
  });
  ctx.shadowBlur=0;
}
function lineChart(id,labels,data,color){
  const c=_setupCanvas(id,160);if(!c)return;
  const{ctx,w,h}=c;const p=32,pt=12,pb=20;
  if(!data.length)return;
  const mn=Math.min(...data)*0.98,mx=Math.max(...data)*1.02;
  const xs=(w-p*2)/(data.length-1||1),ys=(h-pt-pb)/(mx-mn||1);
  _drawGrid(ctx,w,h,p,mn,mx,pt,pb);
  _drawLineSeries(ctx,data.map((v,i)=>({x:p+i*xs,y:h-pb-(v-mn)*ys})),color,2.5,4,{base:h-pb});
  _drawXLabels(ctx,labels,p,xs,h);
}
function barChart(id,labels,data){
  const c=_setupCanvas(id,140);if(!c)return;
  const{ctx,w,h}=c;const p=20;
  if(!data.length)return;
  const mx=Math.max(...data,1)*1.1;
  const bw=(w-p*2)/data.length*.7,gap=(w-p*2)/data.length;
  data.forEach((v,i)=>{
    const x=p+i*gap+(gap-bw)/2,bh=(v/mx)*(h-p*2),y=h-p-bh;
    const g=ctx.createLinearGradient(0,y,0,h-p);g.addColorStop(0,ROUGE_MARQUE);g.addColorStop(1,'#7f1d1d');
    ctx.fillStyle=g;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,bw,bh,4);else ctx.rect(x,y,bw,bh);ctx.fill();
    ctx.fillStyle='#555';ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillText(labels[i],x+bw/2,h-4);
  });
}
function multiLineChart(id,labels,series){
  const c=_setupCanvas(id,100);if(!c)return;
  const{ctx,w,h}=c;const p=32,pt=12,pb=20;
  const allVals=series.flatMap(s=>s.data.filter(v=>v));if(!allVals.length)return;
  const mn=Math.min(...allVals)*0.98,mx=Math.max(...allVals)*1.02;
  const xs=(w-p*2)/(labels.length-1||1),ys=(h-pt-pb)/(mx-mn||1);
  _drawGrid(ctx,w,h,p,mn,mx,pt,pb);
  series.forEach(s=>{
    if(!s.data.some(v=>v))return;
    _drawLineSeries(ctx,s.data.map((v,i)=>v?{x:p+i*xs,y:h-pb-(v-mn)*ys}:null).filter(Boolean),s.color,2,3);
  });
  _drawXLabels(ctx,labels,p,xs,h);
}
function openPhotoFull(src,title){
  const m=document.createElement('div');
  m.style.cssText='position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer';
  m.onclick=()=>m.remove();
  m.innerHTML=`<div style="font-size:var(--fs-xs);color:var(--sub);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:12px">${escapeHtml(title)}</div>
    <img src="${escapeHtml(src)}" style="max-width:94vw;max-height:80vh;object-fit:contain;border-radius:var(--r-2)">
    <div style="font-size:var(--fs-xs);color:var(--text-dim);margin-top:12px">Touche pour fermer</div>`;
  document.body.appendChild(m);
}

// ======= HELPERS =======
// « 5/12 » quand le total prévu est connu, « 5 » sinon. Partagé par le récap de
// fin de séance et la fiche coach : les deux décrivent le même dossier et ne
// doivent pas pouvoir diverger. setsPlanned n'existe que sur les séances
// enregistrées depuis son introduction — tout l'historique antérieur retombe
// donc sur le seul nombre réalisé, sans dénominateur inventé.
// Le garde p>=f écarte aussi les dossiers incohérents, où l'on afficherait
// « 14/12 ».
function fmtSeries(sets,planned){
  const f=parseInt(sets)||0, p=parseInt(planned)||0;
  return (p>0&&p>=f)?(f+'/'+p):String(f);
}
// Accord du mot « série » : sur le total prévu quand il existe, sinon sur le
// réalisé — « 1/12 série » serait faux.
function pluSeries(sets,planned){
  return Math.max(parseInt(sets)||0,parseInt(planned)||0)>1?'s':'';
}
function ini(f,l){return((f||'?')[0]+(l||'?')[0]).toUpperCase();}
// escapeHtml : encode pour le CONTEXTE HTML uniquement — texte de noeud ou
// valeur d'attribut. Ne convient NI a une URL, NI a un fragment de code JS :
// dans un attribut onclick, les entites sont decodees avant que le JS ne soit
// parse, donc l'echappement n'y protege de rien. Pour du JS, ne pas construire
// la chaine — poser le handler en JS et passer les valeurs telles quelles.
function escapeHtml(s){if(s==null)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
// safeUrlRaw : valide le schéma et rend l'URL TELLE QUELLE. À réserver aux
// usages hors HTML (window.open, fetch…), où des entités casseraient l'adresse.
// ── Lien vidéo : normalisation du schéma ────────────────────────────────────
// safeUrl exige « http:// » ou « https:// » en tête et rend '#' sinon. Or on
// colle rarement une URL complète : « youtu.be/abc », « www.youtube.com/... »
// ou l'identifiant seul donnaient un lien mort, sans le moindre signe que
// quelque chose n'allait pas. On complète le schéma manquant plutôt que de
// relâcher safeUrl, qui protège l'attribut href de toute l'application.
function normaliserUrlVideo(v){
  let s=String(v==null?'':v).trim();
  if(!s) return '';
  // Protocole déjà là : on ne touche à rien, safeUrl tranchera.
  if(/^https?:\/\//i.test(s)) return s;
  // « //youtu.be/abc », forme héritée des intégrations.
  if(/^\/\//.test(s)) return 'https:'+s;
  // Un autre schéma que http(s) n'a rien à faire dans un lien vidéo, et
  // laisser passer « javascript: » serait une faille.
  if(/^[a-z][a-z0-9+.-]*:/i.test(s)) return '';
  // Identifiant YouTube seul : 11 caractères de l'alphabet des identifiants.
  // Le champ est explicitement « lien vidéo YouTube », l'interprétation est sûre.
  if(/^[A-Za-z0-9_-]{11}$/.test(s)) return 'https://youtu.be/'+s;
  // Reste un nom de domaine : il lui faut au moins un point avant le premier
  // « / », sinon c'est du texte libre et on n'en fait pas un lien.
  const hote=s.split(/[/?#]/)[0];
  if(/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(hote)) return 'https://'+s;
  return '';
}
function safeUrlRaw(u){
  if(!u) return '#';
  const s=String(u).trim();
  return /^https?:\/\//i.test(s) ? s : '#';
}
// safeUrl : version à utiliser dans un attribut HTML. Valider le schéma ne
// suffisait pas — une valeur comme `https://x" autofocus="` passait le test
// puis sortait de l'attribut href, permettant d'injecter d'autres attributs.
function safeUrl(u){
  const s=safeUrlRaw(u);
  return s==='#' ? '#' : escapeHtml(s);
}
// ══ LES SOURCES D'IMAGE VENUES D'UN DOSSIER (30/09/2026) ═════════════════════
// Une photo de bilan, une photo de programme : l'athlete les ecrit dans SON
// dossier, et le coach les affiche. Posees telles quelles dans src="…", un
// guillemet suffisait a sortir de l'attribut et a poser un onerror sur l'ecran
// du coach. srcImageSureRaw n'admet que ce que l'app produit elle-meme :
// une image en base64 (jpeg, png, webp), Cloudinary, ou un blob: local.
// Rend '' sinon. srcImageSure l'echappe pour l'attribut.
function srcImageSureRaw(s){
  const v=String(s==null?'':s).trim();
  if(/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+\/=\s]*$/i.test(v)) return v;
  if(/^https:\/\/res\.cloudinary\.com\//i.test(v)) return v;
  if(/^blob:/i.test(v)) return v;
  return '';
}
function srcImageSure(s){ return escapeHtml(srcImageSureRaw(s)); }
// Plus large, pour les images d'un programme (fiche d'exercice, photo de
// seance) : celles de l'app vivent aussi sous ./img/… et sur d'autres hotes
// https. Un chemin relatif ou https, une image base64, un blob: — echappe.
function srcImageAttr(s){
  const v=String(s==null?'':s).trim();
  if(srcImageSureRaw(v)) return escapeHtml(v);
  if(/^https:\/\//i.test(v)) return escapeHtml(v);
  if(v&&!/^[a-z][a-z0-9+.-]*:/i.test(v)&&!/^\/\//.test(v)) return escapeHtml(v);
  return '';
}
// Une valeur passee en ARGUMENT dans un gestionnaire en ligne (onclick="f(…)").
// escapeHtml seul n'y protege de rien — l'attribut est decode avant que le JS
// ne soit lu, voir escapeHtml. JSON.stringify en fait un litteral JS sur, puis
// escapeHtml le rend inoffensif dans l'attribut. S'ecrit SANS guillemets
// autour : onclick="f(${jsArg(x)})".
function jsArg(v){ return escapeHtml(JSON.stringify(String(v==null?'':v))); }
function ago(ts){const d=Math.floor((Date.now()-ts)/864e5);return d===0?"aujourd'hui":d===1?"hier":"il y a "+d+"j";}
// Retourne true si la donnée est réellement sur l'appareil, false si le quota
// localStorage a débordé. Les appelants qui annoncent un succès à l'utilisateur
// doivent conditionner leur « ✓ » sur cette valeur : sinon l'utilisateur ferme
// l'app en croyant sa saisie enregistrée alors qu'elle n'existe nulle part
// localement. La donnée part quand même au cloud dans les deux cas.
function saveUser(){
  currentUser.updatedAt=Date.now();
  delete currentUser._st;delete currentUser._stb64;delete currentUser._sk;
  const users=DB.get('users')||{};
  // ⚠ LE VERROU DE L'ARTICLE 9, ET C'EST ICI QU'IL DOIT ETRE.
  //
  // saveUser est le SEUL point par lequel un dossier devient durable : le
  // stockage local passe par elle, et la poussee distante part de la meme
  // ligne, deux instructions plus bas. Un verrou pose ailleurs laisserait
  // toujours un chemin ouvert ; pose ici, il n'en laisse aucun.
  //
  // Dans le cas normal — quelqu'un qui a consenti — _sansSante rend le meme
  // objet, sans copie ni parcours : le cout est nul.
  const aEcrire=_sansSante(currentUser);
  users[currentUser.email]=aEcrire;
  // Les deux écritures sont évaluées séparément AVANT le &&, sans quoi un
  // échec sur 'users' court-circuiterait l'écriture de 'session'.
  const usersOk=DB.set('users',users);
  const sessionOk=DB.set('session',aEcrire);
  // ⚠ A L'EQUIPE SYNCHRO (01/10/2026, lot du cache de DB.get) : cet envoi
  //   DOUBLE celui que DB.set('users',…) vient de programmer deux lignes plus
  //   haut (set pousse deja 'users'). Laisse tel quel a dessein — le lot ne
  //   touche pas a CLOUD.* — mais a examiner. Aujourd'hui CLOUD.push remet
  //   son minuteur de 2 s a zero, donc un seul envoi part : le second appel
  //   ne fait que repousser le premier. Sans cet amortissement, chaque
  //   saveUser enverrait deux fois.
  if(CLOUD.canWrite()){
    CLOUD.push(users);
  }
  return usersOk&&sessionOk;
}
// Annonce le résultat d'une écriture locale. Un « ✓ » ne doit jamais s'afficher
// quand le quota a débordé : l'utilisateur fermerait l'app en croyant sa saisie
// enregistrée alors qu'elle n'existe que dans le cloud — et hors ligne, elle
// n'existe nulle part. `perdu` est une proposition complète fournie par
// l'appelant, ce qui règle l'accord en genre (« la photo est », « le programme
// est ») sans que le helper ait à le deviner.
// ══ QUAND CA RATE, ET SEULEMENT QUAND CA RATE ═══════════════════════════
//
// POURQUOI PAS toastSync. Celle-ci parle AUSSI en cas de succes, et c'est ce
// qu'on ne veut pas ici : les trois gestes qu'elle couvre annoncent deja leur
// resultat autrement — le code s'affiche a l'ecran, la ligne du complement
// disparait, la date d'acces se met a jour. Un second message dirait deux fois
// la meme chose, et l'utilisateur finirait par ne plus lire ni l'un ni l'autre.
//
// CE QUI RESTE MUET, EN REVANCHE, C'EST L'ECHEC — et il ne l'est plus.
//
// LE MESSAGE DEPEND DE LA NATURE DE L'ECHEC, et c'est tout l'interet de ne pas
// se contenter d'un texte unique :
//
//   - PANNE ORDINAIRE (reseau coupe, 5xx) : _doPushOne l'a deja mise dans
//     rc_sync_queue et arme une relance, rejouee au demarrage suivant et apres
//     chaque authentification. La poussee se REPARE toute seule, et le dire
//     evite d'alarmer pour une panne dont l'app s'occupe deja.
//
//   - REFUS DELIBERE (`_nonRejouable`) : le serveur porte une version plus
//     complete et l'envoi a ete annule pour ne pas ecraser le travail du coach.
//     Celui-la NE SERA JAMAIS REJOUE — le promettre serait un mensonge. On rend
//     donc son message tel quel : il est deja ecrit pour etre lu, et il dit la
//     seule chose utile.
//
// `quoi` nomme le geste et `consequence` dit ce que ca change POUR QUELQU'UN :
// « pas encore envoye » ne veut rien dire tout seul ; « ton athlete ne la verra
// pas encore » se comprend d'un coup.
//
// NE REJETTE JAMAIS : ses appelants sont des « lance et oublie », et un rejet
// non capture ne doit pas sortir d'un helper dont tout l'objet est de rendre
// les echecs visibles.
function direSiEnvoiEchoue(promesse,quoi,consequence){
  return Promise.resolve(promesse).then(()=>true,e=>{
    if(e&&e._nonRejouable&&e.message){ try{ toast(e.message,'var(--orange)'); }catch(_e){} return false; }
    try{
      toast((quoi||'Ce changement')+' est enregistré ici mais pas encore envoyé'
        +(consequence?' : '+consequence+'.':'.')
        +' RepCore réessaiera tout seul.','var(--orange)');
    }catch(_e){}
    return false;
  });
}
function toastEcriture(ok,succes,perdu){
  if(ok){toast(succes);return true;}
  toast('Stockage plein : '+perdu+' dans le cloud uniquement, pas sur cet appareil','var(--orange)');
  return false;
}
// Même chose, mais pour une sauvegarde qui a DEUX destinations : l'appareil et
// le cloud. Quatre issues, un seul « ✓ » vert — celui où la donnée est
// réellement aux deux endroits. Les appelants passaient jusqu'ici la promesse
// de CLOUD.pushOne à la trappe et annonçaient le succès avant même que le
// serveur ait répondu.
// Retourne une promesse qui n'échoue jamais : les appelants « fire-and-forget »
// peuvent l'ignorer sans provoquer de rejet non capturé.
// ── LE RETOUR AU PREMIER PLAN : DESCENDRE, PUIS REPEINDRE ─────────────────
// ⚠ LA DESCENTE SEULE NE SUFFISAIT PAS. Mesure au banc a deux appareils : le
//   coach passe les calories a 2 777 ; l'athlete, sur son accueil, remet
//   l'app au premier plan. Son dossier recoit bien 2 777 — son accueil
//   continue d'afficher 2 000. Et la boucle de fond, qui repeint quand ELLE
//   trouve du nouveau, n'en trouvait plus : la descente du retour l'avait
//   deja integre. L'athlete gardait l'ancien chiffre sous les yeux jusqu'a
//   changer d'onglet — exactement le moment ou l'on regarde l'ecran.
//
// LE MEME REPEINT QUE LA BOUCLE DE FOND, aux memes ecrans, avec la meme
// retenue : rien tant qu'un champ a le focus.
//
// ⚠ ET PAS SEULEMENT AU RETOUR AU PREMIER PLAN. La modification du coach
//   arrive aussi par l'INTEGRATION APRES ENVOI : l'athlete enregistre une
//   pesee, son envoi relit le serveur et en ramene les nouvelles calories.
//   Mesure au banc : c'est meme ce chemin-la qui les avait apportees, et il
//   ne repeignait rien. D'ou _planifierRepeint, appele par les DEUX points
//   d'integration (syncUser, _doPushOne) des que le dossier affiche change
//   reellement — empreinte avant, empreinte apres.
//
// `emails` : les dossiers qui ont change. Le coach ne rouvre la fiche que si
// c'est celle de l'athlete concerne.
// ⚠ L'ECRAN NUTRITION DE L'ATHLETE SUIT LA DESCENTE (build 1403). Mesure au
//   banc a deux appareils, le 22/09/2026 : les huit reglages du coach —
//   coefficient, activite, g/kg, cyclage, phase, saisie manuelle et retour a
//   l'automatique — arrivaient TOUS dans le dossier de l'athlete, et son ecran
//   Nutrition restait sur les anciens chiffres tant qu'elle n'en sortait pas :
//   la descente ne repeignait que l'accueil. Kevin : « verifie bien que toute
//   modif du coach s'applique sur le profil de l'athlete automatiquement ».
//   ON NE PASSE PAS PAR loadNutrition : elle appelle go(), qui ferme les
//   saisies ouvertes — un aliment en cours d'ajout disparaitrait sous les
//   doigts. Seul le contenu est repeint, au jour affiche, a la meme hauteur.
function _repeindreNutritionAthlete(){
  try{
    if(!currentUser||currentUser.role==='coach') return false;
    const s=document.getElementById('s-nutrition');
    if(!s||!s.classList.contains('active')) return false;
    const ae=document.activeElement;
    if(ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return false;
    const se=document.scrollingElement||document.documentElement;
    const y=se.scrollTop, ys=s.scrollTop;
    _renderNutriContent(typeDiete(currentUser.nutrition||{}),
      (typeof _fjDate!=='undefined'&&_fjDate)||undefined);
    // ET LA LISTE DES COMPLEMENTS, que le coach change aussi (build 1405).
    try{ loadSuppEmbedded(); }catch(e){}
    try{ se.scrollTop=y; s.scrollTop=ys; }catch(e){}
    return true;
  }catch(e){ console.warn('[RepCore] repeint de la nutrition :',e); return false; }
}
// ⚠ LES AUTRES ECRANS DE L'ATHLETE AVAIENT LE MEME ANGLE MORT (build 1405).
//   Apres la nutrition (1403), l'audit de tous les ecrans ou l'athlete lit
//   quelque chose que son coach peut changer : la descente ne repeignait
//   QUE l'accueil et la nutrition. Mesure au banc a deux appareils, athlete
//   immobile sur l'ecran : le coach renomme une seance, repond a un bilan,
//   corrige une video, assigne une habitude, pose un objectif de pas, ajoute
//   un complement, remplit une journee d'affutage — tout arrivait dans le
//   dossier, rien a l'ecran tant qu'elle n'en sortait pas.
//
//   REPEINTS, un par ecran : Mes seances, l'apercu d'une seance, Évolution
//   (bandeau de phase et reponses aux bilans), Corrections, Lifestyle et
//   l'ecran Pas, Compléments, Échéance.
//   PAS REPEINTS, et pourquoi :
//   • Canal : ses messages ne voyagent pas dans le dossier — l'ecran les
//     telecharge lui-meme a l'ouverture, aucune descente ne les apporte ;
//   • Sommeil, Caféine, Santé, Traitements, Évictions, Historique, Quel
//     bilan ? : rien que le coach puisse y changer ;
//   • le profil, l'edition de sa propre seance, les parcours d'accueil, la
//     saisie d'un bilan : des formulaires en cours — repeindre y effacerait
//     ce qui n'est pas encore enregistre ;
//   • la correction Motion Lab et le comparateur : une video qui joue.
//
// LES MEMES QUATRE RETENUES POUR TOUS, dans _ecranAthleteRepeignable :
// l'ecran doit etre CELUI qu'on regarde, aucun champ ne doit avoir le focus,
// aucune seance ne doit etre en cours — et jamais de go(), qui fermerait une
// saisie ouverte et recalculerait les pastilles d'onglets. Seul le contenu
// est repeint, a la meme hauteur.
//
// UNE SEANCE EN COURS : l'ecran de seance a l'ecran, ou un instantane
// rc_wo_state a soi, encore valable. Tant qu'il existe, la seance peut
// reprendre d'un geste : on ne touche a rien. Le repeint attendra la
// descente suivante — ou le prochain passage sur l'ecran, qui le redessine.
function _seanceEnCours(){
  try{
    const w=document.getElementById('s-workout');
    if(w&&w.classList.contains('active')) return true;
    return !!_woLoadSnap();
  }catch(e){ return true; }   // dans le doute, on ne derange pas
}
// L'ecran `id` peut-il etre repeint maintenant ? Rend l'ecran, ou null.
function _ecranAthleteRepeignable(id){
  if(!currentUser||currentUser.role==='coach') return null;
  const s=document.getElementById(id);
  if(!s||!s.classList.contains('active')) return null;
  const ae=document.activeElement;
  if(ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return null;
  if(_seanceEnCours()) return null;
  return s;
}
// A LA MEME HAUTEUR. Les ecrans defilent dans leur .scroll-area, pas dans la
// page : garder le seul scrollTop du document ne retenait rien.
function _repeindreSansBouger(s,peindre){
  const se=document.scrollingElement||document.documentElement;
  const zones=[s].concat(Array.prototype.slice.call(s.querySelectorAll('.scroll-area')));
  const hauts=zones.map(z=>z.scrollTop), y=se.scrollTop;
  try{ peindre(); }
  finally{
    try{ zones.forEach((z,i)=>{ if(z.isConnected) z.scrollTop=hauts[i]; }); se.scrollTop=y; }catch(e){}
  }
  return true;
}
// MES SEANCES. Le choix « Alterner » deplie sous un creneau serait referme
// sous le doigt : on attend qu'il soit replie.
function _repeindreSeancesAthlete(){
  try{
    const s=_ecranAthleteRepeignable('s-session-manager');
    if(!s) return false;
    if(s.querySelector('[id^="alt-"]:not(:empty)')) return false;
    return _repeindreSansBouger(s,_renderSessionManager);
  }catch(e){ console.warn('[RepCore] repeint des séances :',e); return false; }
}
// L'APERCU D'UNE SEANCE, avant de la lancer : le mot du coach et les
// exercices. Les lignes deja depliees le restent — tant que leur nombre n'a
// pas change, sans quoi le rang ne designerait plus le meme exercice.
function _repeindreApercuAthlete(){
  try{
    const s=_ecranAthleteRepeignable('s-seance-apercu');
    if(!s) return false;
    const z=document.getElementById('ap-contenu');
    const lignes=()=>z?Array.prototype.slice.call(z.querySelectorAll(':scope > details')):[];
    const ouverts=lignes().map(d=>d.open);
    let fait=false;
    _repeindreSansBouger(s,()=>{
      fait=_renderApercu()!==false;
      const l=lignes();
      if(fait&&l.length===ouverts.length) l.forEach((d,i)=>{ if(ouverts[i]) d.open=true; });
    });
    return fait;
  }catch(e){ console.warn('[RepCore] repeint de l’aperçu :',e); return false; }
}
// ÉVOLUTION : le bandeau de phase, la synthese, et l'onglet ouvert — c'est
// dans « Notes » que la reponse du coach a un bilan s'affiche. showProgressTab
// avec sansMemo : un repeint n'est pas un choix d'onglet, il n'ecrit rien.
// LE QUESTIONNAIRE LEAF-Q ENTAME n'est pas redessine : ses reponses vivent
// dans _leafqRep, mais leur surlignage dans le DOM.
function _repeindreEvolutionAthlete(){
  try{
    const s=_ecranAthleteRepeignable('s-progress');
    if(!s) return false;
    const onglet=PROG_ONGLETS.find(t=>{ const b=_progBoutonOnglet(t); return !!(b&&b.classList.contains('btn-red')); })||'poids';
    return _repeindreSansBouger(s,()=>{
      const z=document.getElementById('prog-encart-osseux');
      if(z) z.innerHTML=_htmlEncartOsseux(currentUser);
      if(!Object.keys(_leafqRep||{}).length){ try{ renderReds(); }catch(e){} }
      renderBandeauPhase();
      try{ _renderSyntheseProgression(); }catch(e){}
      showProgressTab(onglet,_progBoutonOnglet(onglet),true);
    });
  }catch(e){ console.warn('[RepCore] repeint d’Évolution :',e); return false; }
}
// CORRECTIONS. Autant de cartes qu'avant : « voir plus » deja touche ne se
// replie pas. La zone d'envoi, hors de la liste, n'est pas touchee.
function _repeindreVideosAthlete(){
  try{
    const s=_ecranAthleteRepeignable('s-videos');
    if(!s) return false;
    const l=document.getElementById('vid-card-list');
    const n=l?l.children.length:0;
    return _repeindreSansBouger(s,()=>{
      _renderVideosListe();
      if(n>20) _renderVideoBatch(20,n-20);
    });
  }catch(e){ console.warn('[RepCore] repeint des corrections :',e); return false; }
}
// LIFESTYLE, et l'ecran Pas : les habitudes et les objectifs de pas du coach.
// Meme repli que _rerenderLifestyle si les cartes echouent.
function _repeindreLifestyleAthlete(){
  try{
    let s=_ecranAthleteRepeignable('s-lifestyle');
    if(s) return _repeindreSansBouger(s,()=>{
      try{ sanRendre(); }catch(e){
        loadSteps('lifestyle-steps-content',{avecImport:false});
        loadSleep('lifestyle-sleep-content',null,{avecImport:false});
      }
    });
    s=_ecranAthleteRepeignable('s-steps');
    if(s) return _repeindreSansBouger(s,()=>loadSteps('steps-content',{repeint:true}));
    return false;
  }catch(e){ console.warn('[RepCore] repeint de Lifestyle :',e); return false; }
}
// COMPLÉMENTS : le coach en ajoute, en retire, en change la dose.
function _repeindreComplementsAthlete(){
  try{
    const s=_ecranAthleteRepeignable('s-supplements');
    if(!s) return false;
    return _repeindreSansBouger(s,_renderSupplements);
  }catch(e){ console.warn('[RepCore] repeint des compléments :',e); return false; }
}
// ÉCHÉANCE : les journees d'affutage que le coach pose une a une. Chez
// l'athlete, le dossier affiche est le sien — on repart de currentUser.
function _repeindreEcheanceAthlete(){
  try{
    const s=_ecranAthleteRepeignable('s-echeance');
    if(!s) return false;
    if(_echCible&&_echCible.email!==currentUser.email) return false;
    _echCible=currentUser;
    return _repeindreSansBouger(s,_renderEcheance);
  }catch(e){ console.warn('[RepCore] repeint de l’échéance :',e); return false; }
}
// Un seul ecran est actif a la fois : au plus un repeint. Rend les noms de
// ceux qui ont eu lieu.
const _REPEINTS_ATHLETE=[
  ['seances',_repeindreSeancesAthlete],['apercu',_repeindreApercuAthlete],
  ['evolution',_repeindreEvolutionAthlete],['corrections',_repeindreVideosAthlete],
  ['lifestyle',_repeindreLifestyleAthlete],['complements',_repeindreComplementsAthlete],
  ['echeance',_repeindreEcheanceAthlete]];
function _repeindreEcransAthlete(){
  const faits=[];
  if(!currentUser||currentUser.role==='coach') return faits;
  for(const [nom,f] of _REPEINTS_ATHLETE){ try{ if(f()) faits.push(nom); }catch(e){} }
  return faits;
}
function _repeindreApresDescente(emails){
  try{
    if(!currentUser) return false;
    const _ae=document.activeElement;
    if(_ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(_ae.tagName)) return false;
    const _actif=id=>{ const e=document.getElementById(id); return !!(e&&e.classList.contains('active')); };
    if(currentUser.role==='athlete'){
      try{ checkFeedbackNotif(); _majPastilleVideos(); checkReponseBilanNotif(); _majPastilleBilan(); }catch(e){}
      if(_actif('s-client-home')) loadClientHome();
      _repeindreNutritionAthlete();
      // ET TOUS SES AUTRES ECRANS : voir _repeindreEcransAthlete.
      _repeindreEcransAthlete();
    } else if(currentUser.role==='coach'){
      if(_actif('s-coach-home')){
        const _db=document.getElementById('ct-dashboard');
        if(_db&&getComputedStyle(_db).display!=='none') loadCoachHome();
      }
      if(_actif('s-coach-client')&&currentClientId){
        let _vu=null; try{ _vu=(getOwnedClient(currentClientId)||{}).email; }catch(e){}
        if(!emails||(_vu&&emails.indexOf(_vu)>=0)) openClientDetail(currentClientId,true);
      }
    }
    return true;
  }catch(e){ console.warn('[RepCore] repeint apres descente :',e); return false; }
}
// Ce dossier est-il a l'ecran ? L'athlete : le sien. Le coach : la fiche
// ouverte. Sinon, inutile de calculer des empreintes.
function _repeintUtile(email){
  try{
    if(typeof currentUser!=='object'||!currentUser||!email) return false;
    if(currentUser.role!=='coach') return currentUser.email===email;
    const s=document.getElementById('s-coach-client');
    if(!s||!s.classList.contains('active')||!currentClientId) return false;
    return ((getOwnedClient(currentClientId)||{}).email)===email;
  }catch(e){ return false; }
}
// Regroupe les repeints : une descente de plusieurs dossiers, ou une descente
// suivie d'un envoi, ne repeint qu'une fois.
let _repeintMinuteur=null, _repeintEmails=[];
function _planifierRepeint(email){
  try{
    if(email) _repeintEmails.push(email); else _repeintEmails=null;
    clearTimeout(_repeintMinuteur);
    _repeintMinuteur=setTimeout(()=>{
      const e=_repeintEmails; _repeintEmails=[]; _repeintMinuteur=null;
      _repeindreApresDescente(e);
    },400);
  }catch(e){}
}
// ══ LE FLUX DE LA BOITE DU COACH (30/09/2026) ═════════════════════════════
// Voir CLOUD._signalerCoach. UN EventSource (streaming REST de Firebase) sur
// /boite_coach/<maClé>, ouvert a l'arrivee sur s-coach-home et garde tant que
// l'app est au premier plan. Plan Spark : 100 connexions simultanees — un flux
// par coach connecte, jamais un par athlete.
//
// Ce que le flux porte : des nombres. Pour chaque athlete dont la valeur
// differe de la version deja integree (base.maj), UN syncUser — et seulement
// celui-la. Les autres dossiers ne sont pas relus.
//
// FERME QUAND L'APP PASSE EN ARRIERE-PLAN (document.hidden) : un flux ouvert
// dans un onglet oublie compterait contre les 100 pour rien. Rouvert au retour.
// auth_revoked : le jeton (une heure) a expire — on le rafraichit et on
// rouvre. Toute autre coupure : reconnexion a delai croissant, plafonne.
// LA RELEVE DE CINQ MINUTES RESTE LE FILET : si le flux tombe, rien n'est perdu.
const BOITE_COACH={
  _es:null,_cle:null,_voulu:false,_gen:0,_essais:0,_minuteur:null,_revoque:0,
  _enCours:new Set(),
  _DELAI_MIN:1000,_DELAI_MAX:300000,
  _maCle(){
    try{
      if(typeof currentUser!=='object'||!currentUser||currentUser.role!=='coach'||!currentUser.email) return null;
      return String(currentUser.email).replace(/\./g,',');
    }catch(e){ return null; }
  },
  ouvert(){ return !!this._es; },
  // Appele a l'arrivee sur l'accueil du coach, et au retour au premier plan.
  ouvrir(){
    const cle=this._maCle();
    if(!cle){ this.fermer(); return false; }
    this._voulu=true;
    if(typeof EventSource!=='function'||document.hidden) return false;
    // Un autre compte : l'ancien flux lisait la boite de quelqu'un d'autre.
    if(this._cle!==cle){ this._fermerFlux(); this._essais=0; }
    this._cle=cle;
    if(this._es||this._minuteur) return true;
    this._connecter(false);
    return true;
  },
  // Deconnexion : plus rien a ecouter, et plus de reouverture au retour.
  fermer(){ this._voulu=false; this._fermerFlux(); this._cle=null; this._essais=0; },
  _fermerFlux(){
    this._gen++;
    clearTimeout(this._minuteur); this._minuteur=null;
    if(this._es){ try{ this._es.close(); }catch(e){} }
    this._es=null;
  },
  _replanifier(){
    if(!this._voulu||document.hidden) return;
    const d=Math.min(this._DELAI_MAX,this._DELAI_MIN*Math.pow(2,this._essais));
    this._essais++;
    clearTimeout(this._minuteur);
    this._minuteur=setTimeout(()=>{ this._minuteur=null; this._connecter(false); },d);
  },
  async _connecter(rafraichir){
    this._fermerFlux();
    const gen=this._gen, cle=this._cle;
    if(!this._voulu||!cle||document.hidden) return false;
    // Jeton expire cote serveur : on force le rafraichissement.
    if(rafraichir){ CLOUD._idToken=null; CLOUD._tokenExpiry=0; }
    let tok=null; try{ tok=await CLOUD._getToken(); }catch(e){ tok=null; }
    if(gen!==this._gen||!this._voulu||document.hidden||cle!==this._maCle()) return false;
    if(!tok){ this._replanifier(); return false; }
    let es;
    try{ es=new EventSource(CLOUD._urlBoiteCoach(cle)+'?auth='+encodeURIComponent(tok)); }
    catch(e){ this._replanifier(); return false; }
    this._es=es;
    const vif=()=>this._es===es;
    const lire=ev=>{
      if(!vif()) return;
      this._essais=0;
      let m=null; try{ m=JSON.parse(ev.data); }catch(e){ return; }
      this._recevoir(m);
    };
    es.addEventListener('put',lire);
    es.addEventListener('patch',lire);
    es.addEventListener('auth_revoked',()=>{
      if(!vif()) return;
      this._fermerFlux();
      // Deux revocations coup sur coup : le rafraichissement ne suffit pas,
      // on laisse passer le delai croissant plutot que de marteler.
      const t=Date.now();
      if(t-this._revoque<10000){ this._replanifier(); }
      else this._connecter(true);
      this._revoque=t;
    });
    // `cancel` : la regle refuse la lecture. Delai croissant, jusqu'au plafond.
    es.addEventListener('cancel',()=>{ if(!vif()) return; this._fermerFlux(); this._replanifier(); });
    // L'EventSource se reconnecterait seul, mais avec le MEME jeton, et sans
    // borne : on reprend la main.
    es.onerror=()=>{ if(!vif()) return; this._fermerFlux(); this._replanifier(); };
    return true;
  },
  // {path, data} de Firebase : « / » porte la boite entiere (put) ou une
  // partie (patch) ; « /<athleteKey> » une seule entree.
  _recevoir(m){
    if(!m||typeof m!=='object') return [];
    const p=String(m.path||'/');
    let entrees={};
    if(p==='/'){ if(m.data&&typeof m.data==='object') entrees=m.data; }
    else { const k=p.replace(/^\/+/,'').split('/')[0]; if(k) entrees[k]=m.data; }
    const lances=[];
    for(const k of Object.keys(entrees)){
      const v=Number(entrees[k]);
      if(!(v>0)) continue;
      const email=k.replace(/,/g,'.');
      if(currentUser&&email===currentUser.email) continue;
      const b=CLOUD._lireBase(email);
      if(b&&b.maj===v) continue;
      if(this._enCours.has(email)) continue;
      this._enCours.add(email);
      lances.push(email);
      Promise.resolve().then(()=>CLOUD.syncUser(email))
        .then(ch=>{ if(ch) _planifierRepeint(email); })
        .catch(()=>{})
        .finally(()=>{ this._enCours.delete(email); });
    }
    return lances;
  }
};
document.addEventListener('visibilitychange',()=>{
  try{
    if(document.hidden) BOITE_COACH._fermerFlux();
    else if(BOITE_COACH._voulu) BOITE_COACH.ouvrir();
  }catch(e){}
});
async function _descenteAuRetour(){
  if(!CLOUD.ok()||!currentUser) return false;
  // Garde anti-rafale : basculer entre deux apps déclenche plusieurs
  // évènements rapprochés, qui feraient repartir autant de requêtes.
  const _now=Date.now();
  if(window._derniereSyncVisible&&_now-window._derniereSyncVisible<60000) return false;
  window._derniereSyncVisible=_now;
  let _change=false;
  try{ _change=await CLOUD.syncRelevantUsers(); }catch(e){ return false; }
  if(_change) _planifierRepeint();
  return !!_change;
}
function toastSync(localOk,promesse,succes,perdu){
  return Promise.resolve(promesse).then(
    ()=>toastEcriture(localOk,succes,perdu),
    e=>{
      // Le message générique couvre le cas courant — réseau coupé, 5xx Firebase —
      // où l'utilisateur n'a rien à faire de particulier. Deux échecs sont au
      // contraire actionnables (se reconnecter, arbitrer un conflit de version)
      // et sont remontés tels quels : les noyer dans le générique ferait perdre
      // la seule information utile. Uniquement si l'écriture locale a réussi,
      // sinon leur texte (« enregistrée sur cet appareil ») serait faux.
      const detail=(localOk&&e&&e._actionnable)?e.message:null;
      toast(detail||(localOk
        ?'Enregistré sur cet appareil : synchronisation en échec'
        :'Échec : ni enregistré sur cet appareil, ni synchronisé. Recommence.'),
        'var(--orange)');
      return false;
    });
}
// L’INSTANTANÉ DE SÉANCE PART AVEC LA SESSION. Il porte désormais une
// adresse, donc le compte suivant ne le lirait pas — mais le laisser
// derrière soi, c’est laisser les charges et les réponses de douleur de
// quelqu’un dans le stockage d’un appareil partagé. Même geste que pour le
// brouillon de bilan dans _comptesRemiseAZero.
function silentLogout(){DB.del('session');currentUser=null;CLOUD.signOut();oublierBanque();
  try{ BOITE_COACH.fermer(); }catch(e){}
  try{ retirerMarque(); }catch(e){}
  try{localStorage.removeItem('rc_wo_state');}catch(e){}}
async function logout(){
  if(!await rcConfirm('Se déconnecter ?',null,'Se déconnecter')) return;
  // Le compte quitte le registre : ses jetons viennent d'être révoqués, le
  // garder en liste promettrait une bascule qui échouerait.
  const _sortant=compteActif();
  let _reste=[];
  try{
    _comptesEcrire(comptesConnectes().filter(c=>c.email!==_sortant));
    _reste=comptesConnectes();
  }catch(e){}
  silentLogout();
  // LA SESSION EST DÉJÀ DÉTRUITE : il n’y a plus rien à protéger. Sans cette
  // ligne, une séance ou un bilan en cours faisait refuser la bascule par
  // peutBasculer — à juste titre pour un changement de compte ordinaire, où
  // l’on revient, mais ici le compte vient d’être déconnecté. L’application
  // restait alors avec currentUser à null sur un écran authentifié, sans
  // aucune navigation, et le seul message visible était « Termine ta séance »
  // pour une séance qu’on ne pouvait plus atteindre.
  //
  // AVANT le test de `_suivant`, et non dans sa branche : le chemin sans
  // compte suivant laissait lui aussi woState en mémoire, rc_wo_state dans le
  // stockage, et un setInterval qui continuait d’écrire dans #wo-timer pour un
  // compte qui n’existe plus.
  _comptesRemiseAZero();
  // Un autre compte est resté connecté : on l'active au lieu de renvoyer sur
  // l'écran d'accueil, comme le fait Instagram.
  const users=DB.get('users')||{};
  const _suivant=_reste.find(c=>users[c.email]);
  // LE RETOUR EST TESTÉ. basculerCompte rend false sur quatre chemins — pas
  // seulement le garde : adresse vide, compte déjà actif, dossier absent du
  // stockage. Chacun laissait l’application sans écran.
  if(_suivant && basculerCompte(_suivant.email)) return;
  go('s-welcome');
}

// ======= PHOTO PROGRAMME =======
let progPhotoData=null, progPhoto2Data=null, _pdfVideoLinks=null;

function _updateAnalyzeBtn(){
  const btn=document.getElementById('prog-analyze-btn');
  if(!btn) return;
  // Drapeau baisse : le bouton d'analyse ne s'affiche jamais, meme avec une
  // photo chargee. La photo, elle, reste — c'est la vignette de la seance.
  btn.style.display=(progPhotoData&&_importLegacyOuvert())?'flex':'none';
}
function loadProgPhoto(input){
  const f=input.files[0];if(!f) return;
  compressImage(f,1200,0.75,data=>{
    progPhotoData=data;
    const img=document.getElementById('prog-photo-preview');
    img.src=data;img.style.display='block';
    document.getElementById('prog-photo-ph').style.display='none';
    document.getElementById('prog-photo-actions').style.display='flex';
    document.getElementById('prog-photo-zone').style.borderColor='var(--red)';
    _updateAnalyzeBtn();
  });
}
function dropProgPhoto(e){
  e.preventDefault();
  const f=e.dataTransfer.files[0];
  if(f&&f.type.startsWith('image/')){
    document.getElementById('prog-photo-input').files=e.dataTransfer.files;
    loadProgPhoto(document.getElementById('prog-photo-input'));
  }
}
function clearProgPhoto(){
  progPhotoData=null;
  document.getElementById('prog-photo-preview').style.display='none';
  document.getElementById('prog-photo-ph').style.display='block';
  document.getElementById('prog-photo-actions').style.display='none';
  document.getElementById('prog-photo-zone').style.borderColor='var(--border)';
  _updateAnalyzeBtn();
}
function loadProgPhoto2(input){
  if(!_importLegacyOuvert()) return _refusImportLegacy();
  const f=input.files[0];if(!f) return;
  compressImage(f,1600,0.92,data=>{
    progPhoto2Data=data;
    // Persist in localStorage — Firebase strips photo2 on every push
    const idx=_athleteSessionIdx();
    if(currentUser?.email&&idx!==null){
      _setPhotoLS('rc_p2_'+currentUser.email+'_'+idx,data);
    }
    document.getElementById('prog-photo2-ph').style.display='none';
    document.getElementById('prog-photo2-ready').style.display='block';
  });
}
function clearProgPhoto2(){
  progPhoto2Data=null;
  _pdfVideoLinks=null;
  // Remove from localStorage too
  const idx2=_athleteSessionIdx();
  if(currentUser?.email&&idx2!==null){
    try{localStorage.removeItem('rc_p2_'+currentUser.email+'_'+idx2);}catch(e){}
  }
  document.getElementById('prog-photo2-ph').style.display='flex';
  document.getElementById('prog-photo2-ready').style.display='none';
  const pz=document.getElementById('prog-paste-zone');
  const pi=document.getElementById('prog-paste-input');
  if(pz) pz.style.display='none';
  if(pi) pi.value='';
}
function togglePasteLiens(){
  const pz=document.getElementById('prog-paste-zone');
  if(!pz) return;
  pz.style.display=pz.style.display==='none'?'block':'none';
}
function savePastedLinks(){
  const raw=document.getElementById('prog-paste-input')?.value||'';
  const links=[...new Set(raw.split(/[\n,\s]+/).map(s=>s.trim()).filter(s=>s.includes('youtu')))];
  if(!links.length){toast('Aucun lien YouTube reconnu : vérifie le format.','var(--orange)');return;}
  _pdfVideoLinks=links;
  progPhoto2Data='pdf';
  document.getElementById('prog-photo2-ph').style.display='none';
  document.getElementById('prog-paste-zone').style.display='none';
  document.getElementById('prog-photo2-ready').style.display='block';
  const lbl=document.getElementById('prog-photo2-label');
  if(lbl) lbl.textContent='✓ '+links.length+' lien(s) YouTube prêts';
  toast(links.length+' lien(s) enregistrés ✓');
}

async function importVideoLinksFromPdf(input){
  if(!_importLegacyOuvert()) return _refusImportLegacy();
  const file=input.files[0];
  if(!file) return;
  input.value='';
  toast('Lecture du PDF...','var(--green)');
  try{
    const buf=await file.arrayBuffer();

    // Méthode 1 : octets bruts (latin1)
    const rawText=new TextDecoder('latin1').decode(buf);
    const fromRaw=parseVideoLinks(rawText);

    // Méthode 2 : PDF.js
    await _loadPdfJs();
    const pdf=await pdfjsLib.getDocument({data:new Uint8Array(buf)}).promise;
    let pdfJoined='', pdfNoSp='';
    const annotUrls=[];
    for(let p=1;p<=pdf.numPages;p++){
      const page=await pdf.getPage(p);
      const content=await page.getTextContent();
      const strs=content.items.map(it=>it.str);
      pdfJoined+=strs.join(' ')+'\n';
      pdfNoSp+=strs.join('')+'\n'; // join sans espace (URLs fragmentées)
      try{
        const anns=await page.getAnnotations();
        for(const a of anns){
          const u=a.url||a.unsafeUrl||(a.action&&(a.action.url||a.action.URI||a.action.uri))||'';
          if(u) annotUrls.push(u);
        }
      }catch{}
    }
    const fromText=parseVideoLinks(pdfJoined);
    const fromNoSp=parseVideoLinks(pdfNoSp);
    const fromAnnot=annotUrls.filter(u=>u&&(u.includes('youtu.be')||u.includes('youtube.com')));
    const links=[...new Set([...fromRaw,...fromAnnot,...fromText,...fromNoSp])];

    if(links.length){
      _pdfVideoLinks=links;
      progPhoto2Data='pdf';
      document.getElementById('prog-photo2-ph').style.display='none';
      document.getElementById('prog-photo2-ready').style.display='block';
      const lbl=document.getElementById('prog-photo2-label');
      if(lbl) lbl.textContent='✓ '+links.length+' lien(s) YouTube trouvé(s)';
      toast(links.length+' lien(s) YouTube importé(s) ✓');
    } else {
      // Modale diagnostic — montre le texte brut extrait
      const preview=t=>t.replace(/</g,'&lt;').slice(0,400);
      const html=`<div id="modal-overlay" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
      <div style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:20px;width:100%;max-width:500px;max-height:80vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <b style="color:var(--red-light)">Aucun lien trouvé : Diagnostic</b>
          <button onclick="document.getElementById('modal-overlay').remove()" style="background:none;border:none;color:var(--sub);font-size:var(--fs-xl);cursor:pointer">✕</button>
        </div>
        <p style="font-size:var(--fs-xs);color:var(--sub);margin-bottom:8px">Copie ce texte et envoie-le pour qu'on diagnostique :</p>
        <div style="font-size:var(--fs-xs);margin-bottom:6px;color:var(--green)">Annotations trouvées (${annotUrls.length}) :</div>
        <textarea style="width:100%;height:60px;font-size:var(--fs-xs);font-family:monospace;background:var(--surface-1);border:1px solid var(--border);color:#ccc;padding:6px;border-radius:var(--r-2)" readonly>${annotUrls.join('\n')||'(aucune)'}</textarea>
        <div style="font-size:var(--fs-xs);margin:8px 0 4px;color:var(--green)">Texte PDF extrait (début) :</div>
        <textarea style="width:100%;height:100px;font-size:var(--fs-xs);font-family:monospace;background:var(--surface-1);border:1px solid var(--border);color:#ccc;padding:6px;border-radius:var(--r-2)" readonly>${preview(pdfJoined)||'(vide)'}</textarea>
        <div style="font-size:var(--fs-xs);margin:8px 0 4px;color:var(--green)">Octets bruts (début) :</div>
        <textarea style="width:100%;height:60px;font-size:var(--fs-xs);font-family:monospace;background:var(--surface-1);border:1px solid var(--border);color:#ccc;padding:6px;border-radius:var(--r-2)" readonly>${preview(rawText)}</textarea>
      </div></div>`;
      document.body.insertAdjacentHTML('beforeend',html);
    }
  }catch(e){
    toast('Erreur : '+(e.message||'réessaie'),'var(--red)');
  }
}
async function analyzeProgPhotos(){
  if(!_importLegacyOuvert()) return _refusImportLegacy();
  if(!progPhotoData){toast('Ajoute d\'abord la photo de séance.','var(--orange)');return;}
  const btn=document.getElementById('prog-analyze-btn');
  const reset=()=>{if(btn){ btn.disabled=false; btn.classList.remove('arc-attente-bar'); btn.innerHTML=' Analyser les 2 photos → Importer les exercices'; }};
  if(btn){ btn.disabled=true; btn.classList.add('arc-attente-bar'); btn.innerHTML='Lecture photo séance...'; }
  try{
    const text=await _ocrImage(progPhotoData);
    if(!text){toast('Texte illisible. Photo plus nette ?','var(--orange)');reset();return;}
    const exercises=parseWorkoutSheet(text);
    if(!exercises.length){toast('Aucun exercice détecté.','var(--orange)');reset();return;}
    let videoLinks=[];
    if(_pdfVideoLinks&&_pdfVideoLinks.length){
      // PDF sélectionné : extraction directe du texte numérique (fiable à 100%)
      videoLinks=_pdfVideoLinks;
    } else if(!progPhoto2Data||progPhoto2Data===''){
      // photo2 absente (stripée de Firebase au rechargement) — avertir l'utilisateur
      toast('Photo vidéos non chargée : recharge-la ci-dessus puis réanalyse','var(--orange)');
    } else if(progPhoto2Data&&progPhoto2Data!=='pdf'){
      if(btn) btn.innerHTML='Lecture liens vidéos...';
      try{
        // 4 passes : 3 résolutions + 1 prétraitement rouge-sur-noir
        const r1=await resizeForOcr(progPhoto2Data,1500).catch(()=>progPhoto2Data);
        const r2=await resizeForOcr(progPhoto2Data,800).catch(()=>r1);
        const r3=await preprocessRedOnDark(progPhoto2Data).catch(()=>r1);
        const [t1,t2,t3,t4]=await Promise.all([
          _ocrImage(r1,{isTable:false,engine:1,language:'eng'}).catch(()=>''),
          _ocrImage(r1,{isTable:false,engine:2,language:'eng'}).catch(()=>''),
          _ocrImage(r2,{isTable:false,engine:2,language:'eng'}).catch(()=>''),
          _ocrImage(r3,{isTable:false,engine:2,language:'eng'}).catch(()=>'')
        ]);
        const combined=t1+'\n'+t2+'\n'+t3+'\n'+t4;
        videoLinks=parseVideoLinks(combined);
        if(!videoLinks.length){
          const esc=s=>s.replace(/</g,'&lt;').slice(0,600);
          document.body.insertAdjacentHTML('beforeend',`
          <div id="modal-overlay" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
          <div style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:20px;width:100%;max-width:500px;max-height:85vh;overflow-y:auto">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <b style="color:var(--red-light)">Lecture automatique : texte brut</b>
              <button onclick="document.getElementById('modal-overlay').remove()" style="background:none;border:none;color:var(--sub);font-size:var(--fs-xl);cursor:pointer">✕</button>
            </div>
            <p style="font-size:var(--fs-xs);color:var(--sub);margin-bottom:8px">Envoie-moi ce texte :</p>
            <div style="font-size:var(--fs-xs);color:var(--green);margin-bottom:4px">M1 original :</div>
            <textarea readonly style="width:100%;height:70px;font-size:var(--fs-xs);font-family:monospace;background:var(--surface-1);border:1px solid var(--border);color:#ccc;padding:6px;border-radius:var(--r-2);box-sizing:border-box">${esc(t1)||'(vide)'}</textarea>
            <div style="font-size:var(--fs-xs);color:var(--green);margin:6px 0 4px">M2 original :</div>
            <textarea readonly style="width:100%;height:70px;font-size:var(--fs-xs);font-family:monospace;background:var(--surface-1);border:1px solid var(--border);color:#ccc;padding:6px;border-radius:var(--r-2);box-sizing:border-box">${esc(t2)||'(vide)'}</textarea>
            <div style="font-size:var(--fs-xs);color:var(--green);margin:6px 0 4px">M1 prétraité :</div>
            <textarea readonly style="width:100%;height:70px;font-size:var(--fs-xs);font-family:monospace;background:var(--surface-1);border:1px solid var(--border);color:#ccc;padding:6px;border-radius:var(--r-2);box-sizing:border-box">${esc(t3)||'(vide)'}</textarea>
          </div></div>`);
        }
      }catch(e){
        toast('Erreur de lecture : '+(e.message||'réessaie'),'var(--red)');
      }
    }
    showOcrReviewModal(exercises,_athleteSessionIdx(),videoLinks);
    reset();
  }catch(e){toast('Erreur : '+e.message,'var(--red)');reset();}
}

// ======= CALCULATEUR RIR (logique Sheets) =======
function openCalc(pw,pr,prir,gender){
  // La charge arrive en kilos : elle s'affiche dans l'unité de l'athlète.
  document.getElementById('calc-pw').value=(pw!==''&&pw!=null&&uniteCharge(currentUser)==='lb')?(kgVersAffiche(pw,currentUser)||''):(pw||'');
  document.getElementById('calc-pr').value=pr||'';
  document.getElementById('calc-prir').value=prir||'';
  // La phrase est posée par updateCalcTable, appelée juste en dessous : elle
  // suit la saisie au lieu d'être figée à l'ouverture.
  // R24 — LES ⓘ DE LA MODALE (« à l'échec » → rir, « Force max estimée » →
  // e1rm). Le gabarit est statique : on les pose ici, une fois.
  try{ document.querySelectorAll('#calc-modal .calc-i[data-lex]').forEach(z=>{
    if(!z.firstElementChild) z.innerHTML=rcInfo(z.getAttribute('data-lex')); }); }catch(e){}
  document.getElementById('calc-modal').style.display='block';
  updateCalcTable();
}
