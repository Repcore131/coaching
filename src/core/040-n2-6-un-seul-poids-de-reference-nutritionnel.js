// ══════ N2.6 — UN SEUL POIDS DE REFERENCE NUTRITIONNEL ════════════════════
// TROIS DEFINITIONS CONCURRENTES alimentaient trois lignes du MEME panneau :
//   • besoinsProposes prenait getBW(dernier bilan), puis init-weight — un
//     bilan sans pesee le faisait donc retomber sur le poids DECLARE A
//     L'INSCRIPTION, parfois vieux de plusieurs mois ;
//   • poidsReference remontait les bilans jusqu'a en trouver un qui porte un
//     poids, mais ignorait le journal de pesees ;
//   • _poidsPourPlancher lisait la derniere pesee du journal.
// Le coach lisait donc, sur un meme ecran, des grammages cales sur un poids,
// des g/kg sur un autre, et un plancher calorique sur un troisieme — avec
// plusieurs kilos d'ecart possibles.
//
// LA SOURCE UNIQUE EST LA PESEE LA PLUS RECENTE (arbitrage de Kevin, 26/08/
// 2026). serieWeight fusionne DEJA les bilans et le journal de pesees, les
// borne a PESEE_MIN/PESEE_MAX, les range par jour et marque la provenance de
// chacun : la derniere entree est, par construction, la mesure la plus
// fraiche. Elle ne peut jamais revenir en arriere, ce que faisait le repli sur
// init-weight de besoinsProposes.
//
// AUCUNE FORMULE N'EST TOUCHEE : c'est l'ENTREE des trois lectures qui est
// unifiee, pas leur calcul.
function poidsNutritionnel(user){
  try{
    const s=serieWeight(user);
    if(s.length){
      const d=s[s.length-1];
      return {kg:d.kg,source:d.source,date:d.date};
    }
  }catch(e){}
  // Dernier recours : le poids declare a l'inscription. Il n'a jamais ete
  // mesure par personne, et c'est pour cela qu'il est dit comme tel.
  const init=parseFloat((user&&user['init-weight'])||0);
  return (init>0)?{kg:init,source:'initial',date:null}
                 :{kg:null,source:null,date:null};
}
// N2.6 — CETTE FONCTION NE DECIDE PLUS RIEN. Elle remontait les bilans de son
// cote pendant que deux autres lectures en faisaient autant, differemment.
// Elle rend maintenant le poids de reference commun, et rien d'autre.
function poidsReference(user){
  return poidsNutritionnel(user).kg;
}
// PURE. Le sélecteur a-t-il le droit de proposer g/kg ?
function macroUniteDisponible(unite,poidsRef){
  if(MACRO_UNITES.indexOf(unite)<0) return false;
  if(unite==='gkg') return !!(poidsRef>0);
  return true;
}
// PURE. Le formatage d'UNE macro. `macro` vaut 'p', 'c' (ou 'g') ou 'l'.
//
// `contexte` porte les trois grammages du jour — indispensable au mode %, qui
// est une PART et n'a aucun sens sur une valeur isolée. Sans contexte, on
// retombe sur les grammes plutôt que d'inventer un pourcentage.
function formatMacro(valeurGrammes,macro,unite,poidsRef,contexte){
  const v=Number(valeurGrammes);
  const cle=(macro==='g')?'c':macro;
  if(!isFinite(v)) return {texte:'-',valeur:null,unite:'g'};
  const u=(MACRO_UNITES.indexOf(unite)>=0)?unite:'g';
  if(u==='gkg'){
    if(!(poidsRef>0)) return {texte:Math.round(v)+' g',valeur:Math.round(v),unite:'g',
      repli:true,raison:'Aucun poids au dossier : les g/kg ne peuvent pas être calculés.'};
    const gk=Math.round(v/poidsRef*100)/100;
    return {texte:String(gk).replace('.',',')+' g/kg',valeur:gk,unite:'gkg',poidsRef};
  }
  if(u==='pct'){
    if(!contexte) return {texte:Math.round(v)+' g',valeur:Math.round(v),unite:'g',repli:true};
    const parts=partsPourcent(contexte.p,contexte.l,
      (contexte.c!==undefined?contexte.c:contexte.g));
    if(!parts) return {texte:'0 %',valeur:0,unite:'pct'};
    const n=parts[cle];
    return {texte:n+' %',valeur:n,unite:'pct',
      zero:(cle==='c'&&n===0),parts:parts};
  }
  return {texte:Math.round(v)+' g',valeur:Math.round(v),unite:'g'};
}
// La préférence. EN SESSION, jamais dans le dossier : c'est un confort de
// lecture, pas une donnée de suivi. sessionStorage la fait survivre à un
// changement d'écran et mourir à la fermeture de l'onglet.
let _macroUnite=null;
function macroUnite(){
  if(_macroUnite) return _macroUnite;
  try{
    const v=sessionStorage.getItem(MACRO_UNITE_CLE);
    if(MACRO_UNITES.indexOf(v)>=0){ _macroUnite=v; return v; }
  }catch(e){}
  return 'g';
}
function setMacroUnite(u){
  const v=(MACRO_UNITES.indexOf(u)>=0)?u:'g';
  _macroUnite=v;
  try{ sessionStorage.setItem(MACRO_UNITE_CLE,v); }catch(e){}
  // Les trois écrans qui portent des cibles se redessinent. Aucune écriture,
  // aucun saveUser : on relit et on réaffiche.
  try{ renderNutriAnneaux(); }catch(e){}
  try{ if(typeof _renderStrictDiet==='function') _renderStrictDiet(); }catch(e){}
  try{ if(typeof _fjDate!=='undefined'&&_fjDate) _renderFjDaySummary(_fjDate); }catch(e){}
  try{ const c=getOwnedClient(currentClientId); if(c) renderCoachNutriSection(c); }catch(e){}
  return v;
}
// Le sélecteur, partagé par tous les écrans qui l'affichent.
// PURE. Les deux phrases qui accompagnent le selecteur d'unite. Extraites
// pour pouvoir etre posees AILLEURS que le boitier : sur la ligne du titre,
// elles feraient passer l'en-tete de une a trois lignes.
function htmlMacroUniteNote(user){
  const pr=poidsReference(user);
  const u=macroUnite();
  if(u==='gkg'&&pr>0) return `<div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-bottom:8px">par kilo · ${String(pr).replace('.',',')} kg au dernier bilan</div>`;
  if(!pr) return `<div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-bottom:8px">g/kg indisponible : aucun poids au dossier</div>`;
  return '';
}
// `sansNote` est OPTIONNEL et vaut faux : les appels existants rendent le
// boitier ET la note, au caractere pres, comme avant.
function htmlMacroUnite(user,idSuffixe,sansNote){
  const pr=poidsReference(user);
  const u=macroUnite();
  const libs={g:'g',pct:'%',gkg:'g/kg'};
  // TROIS SEGMENTS DANS UN SEUL BOITIER, et non trois boutons cote a cote :
  // c'est le boitier qui dit qu'un seul des trois vaut a la fois. Les etats
  // (choisi, disponible, indisponible) sont portes par la feuille, sur
  // [aria-pressed] et [disabled] -- donc par les attributs qui les DECLARENT
  // deja pour les technologies d'assistance, jamais par une classe parallele
  // qui pourrait s'en desynchroniser.
  return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
    <div class="nut-seg">
    ${MACRO_UNITES.map(x=>{
      const dispo=macroUniteDisponible(x,pr);
      return `<button type="button" onclick="setMacroUnite('${x}')" ${dispo?'':'disabled'}
        aria-pressed="${x===u&&dispo?'true':'false'}"
        title="${dispo?'':'Aucun poids au dossier'}">${libs[x]}</button>`;}).join('')}
    </div>
    ${sansNote?'':htmlMacroUniteNote(user)}
  </div>`;
}

// PURE. Le couple « consommé / cible » d'une macro, dans l'unité choisie.
// Les DEUX se convertissent : en %, la part du consommé est sa part des kcal
// consommées, celle de la cible sa part des kcal cibles. Comparer une part à
// une part reste juste ; comparer une part à des grammes ne le serait pas.
function _macroCouple(cle,tot,m,unite,poidsRef){
  const u=macroUniteDisponible(unite,poidsRef)?unite:'g';
  const gCible=(cle==='c')?m.g:m[cle];
  const fFait=formatMacro(tot[cle],cle,u,poidsRef,{p:tot.p,l:tot.l,c:tot.c});
  const fCible=(typeof gCible==='number'&&isFinite(gCible)&&gCible>0)
    ? formatMacro(gCible,cle,u,poidsRef,{p:m.p,l:m.l,c:m.g}) : null;
  return {fait:fFait,cible:fCible,unite:u};
}
// PURE. Le texte d'explication quand les glucides tombent à zéro. C'est le cas
// documenté de _repartition : protéines et lipides saturent la cible.
function macroNoteGlucidesZero(m){
  const g=(m&&(m.g!==undefined?m.g:m.c));
  return (g===0||g==='0')?MACRO_GLUC_ZERO:'';
}
// ── La ligne de lecture seule du coach ────────────────────────────────────
// SOUS les champs de saisie, jamais dedans. Le coach continue de taper des
// grammes ; cette ligne lui dit ce que ça donne en pourcentages et en g/kg,
// pour les DEUX journées, sans jamais les moyenner.
// ⚠ htmlMacrosCoachLecture A ETE RETIREE le 08/09/2026 avec la section
// « Cibles en cours ». Elle redisait en pourcentages les grammages que le
// tableau « Macronutriments » porte trois ecrans plus haut : deux affichages
// du meme chiffre, dont un derive — et c'est celui qui derive qui se met a
// mentir en premier.
// partsPourcent, formatMacro et setMacroUnite RESTENT : ce sont les outils de
// l'ecran de l'athlete, qui a bien besoin de ses parts.
// Le compteur des degrades d'anneaux. Il ne sert qu'a rendre les identifiants
// uniques dans le document, jamais a designer quoi que ce soit.
let _nutSerie=0;
function htmlAnneauxMacros(tot,m,marge,unite,poidsRef){
  const R=47,cx=60,cy=60,sw=6.5;
  const circ=+(2*Math.PI*R).toFixed(2);
  // UN NUMERO D'ORDRE PAR APPEL. Les degrades vivent dans un <defs> local a ce
  // balisage, et l'accueil comme la diete stricte gardent leurs trois anneaux
  // dans le meme document : sans ce numero, les seconds reprendraient les
  // degrades des premiers -- un identifiant en double, en SVG, c'est le premier
  // qui gagne, en silence.
  const gid='nutA'+(_nutSerie=(_nutSerie||0)+1);
  const ring=(val,tgt,color,label,cle,ico)=>{
    const pct=tgt&&val?Math.min(val/tgt,1):0;
    const d=+(pct*circ).toFixed(2);
    // Le centre affiche le CONSOMME, la cible passe en dessous : ajouter un
    // aliment doit faire bouger le chiffre en meme temps que l'arc.
    const fait=Math.round(val||0);
    const _u=(typeof unite==='string')?unite:'g';
    const _cv=(_u!=='g'&&typeof _macroCouple==='function')
      ?_macroCouple(cle,tot,m,_u,poidsRef):null;
    // La cible est arrondie : l'adaptation de cycle produit des lipides a la
    // decimale, et « / 61.6 g » en face d'un consomme entier ne veut rien dire.
    const cible=(typeof tgt==='number'&&isFinite(tgt)&&tgt>0)?Math.round(tgt):null;
    // Au-dela de 110 % de la cible, le chiffre vire a l'orange. L'arc est
    // plafonne a 100 % par Math.min : a lui seul, il ne peut pas distinguer
    // « pile atteint » de « largement depasse ».
    const trop=cible!=null&&val>tgt*1.1;
    // LE CORPS SUIT LA LONGUEUR. Le diametre interieur vaut 2*(R - sw/2), moins
    // une marge ; une capitale de Bebas avance d'environ 0,45 em. Trois signes
    // gardent le corps nominal, « 2,71 G/KG » descend a une vingtaine de pixels.
    const _txt=String(_cv?_cv.fait.texte:fait);
    const _fs=Math.max(15,Math.min(36,Math.round((2*(R-sw/2)-8)/(0.48*Math.max(1,_txt.length)))));
    return `<div class="nut-a">
      <svg viewBox="0 0 120 120" data-atteint="${pct>=1?'1':'0'}" aria-hidden="true">
        <!-- LE CERCEAU EXTERIEUR ET LE FILET INTERIEUR ne portent aucune
             donnee : ils donnent a l'anneau l'epaisseur d'un cadran plutot que
             celle d'un trait, et c'est tout ce qu'on leur demande. -->
        <defs>
          <!-- L'arc part sombre en bas et arrive incandescent en haut : c'est
               le degrade qui dit dans quel sens la course a ete faite. Le
               repere est celui du trace, apres la rotation de -90 degres. -->
          <linearGradient id="${gid}" x1="0" y1="1" x2="0.35" y2="0">
            <stop offset="0" stop-color="#8f0505"/>
            <stop offset=".45" stop-color="#e01414"/>
            <stop offset="1" stop-color="#ff5a5a"/>
          </linearGradient>
          <!-- Le fond du cadran. Il reprend le degrade de la carte au lieu
               d'un aplat : un aplat unique se detacherait comme un disque
               plus sombre sous le coin haut-droit, qui est le point clair du
               fond. -->
          <radialGradient id="${gid}f" cx=".38" cy=".3" r=".78">
            <stop offset="0" stop-color="#170707"/>
            <stop offset="1" stop-color="#080303"/>
          </radialGradient>
        </defs>
        <circle cx="${cx}" cy="${cy}" r="${R-sw/2+0.5}" fill="url(#${gid}f)"/>
        <circle cx="${cx}" cy="${cy}" r="57" fill="none" stroke="rgba(224,32,32,.28)" stroke-width="1"/>
        <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#1c1111" stroke-width="${sw}"/>
        <circle cx="${cx}" cy="${cy}" r="${R-sw/2-2.5}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="1"/>
        <!-- LE TOUR ENTIER EST TRACE, et masque par son propre decalage. Un
             stroke-dasharray anime ne peut pas s'interpoler proprement ; un
             stroke-dashoffset, si. On part du tour complet cache, et
             _animerJauges pose la valeur finale au tour d'apres. -->
        <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="url(#${gid})" stroke-width="${sw}"
          stroke-dasharray="${circ}" stroke-dashoffset="${circ.toFixed(2)}" data-arc-off="${(circ-d).toFixed(2)}"
          class="rc-anneau" style="transition:stroke-dashoffset var(--t-4) var(--c-out)"
          stroke-linecap="${d>0?'round':'butt'}"
          ${d>0?`filter="drop-shadow(0 0 2px ${color})"`:''}
          transform="rotate(-90 ${cx} ${cy})"/>
        ${d>0?`<!-- LE POINT CHAUD EN TETE DE COURSE. Un tiret de longueur nulle
             a bout rond : place au meme decalage que l'arc, il se pose donc
             exactement sur son extremite et voyage avec lui pendant les 620 ms
             de la transition, sans une ligne de JS de plus. -->
        <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#fff2f2" stroke-width="${sw-1.6}"
          stroke-dasharray="7 ${circ}" stroke-dashoffset="${(circ+7).toFixed(2)}" data-arc-off="${(circ-d+7).toFixed(2)}"
          style="transition:stroke-dashoffset var(--t-4) var(--c-out)"
          stroke-linecap="round" filter="drop-shadow(0 0 3px #ffbcbc)"
          transform="rotate(-90 ${cx} ${cy})"/>`:''}
        ${_icoG(ico,cx,32,18,'#ff3b3b',1.9)}
        <!-- GRAISSE 400, IMPERATIVEMENT. Bebas Neue n'est chargee qu'en 400
             dans ce depot : toute valeur superieure produit un gras synthetique
             baveux, que le navigateur fabrique en epaississant le trace. -->
        <text x="${cx}" y="${cy+6}" dominant-baseline="middle" text-anchor="middle"
          font-family="'Bebas Neue','Arial Narrow',Impact,'Haettenschweiler','Franklin Gothic Condensed',sans-serif" font-size="${_fs}" font-weight="400" letter-spacing="0.5"
          style="font-variant-numeric:tabular-nums"
          ${_cv?'':`data-num="${fait}"`}
          fill="${trop?'var(--orange)':'var(--text)'}">${_cv?_cv.fait.texte:fait}</text>
        <text x="${cx}" y="${cy+29}" dominant-baseline="middle" text-anchor="middle"
          font-family="Montserrat,sans-serif" font-size="12" fill="#8a8a8a">${_cv?(_cv.cible?'/ '+_cv.cible.texte:''):_fragmentSiValeur('/ ',cible,' g')}</text>
      </svg>
      <div class="nut-lbl">${label}</div>
      <div class="nut-soul"></div>
    </div>`;
  };
  // LES TROIS ANNEAUX SONT ROUGES. Le jaune et le vert d'avant codaient la
  // MACRO ; or la macro est deja nommee sous chaque anneau, et son pictogramme
  // la redit au centre. Trois teintes pour une information ecrite deux fois,
  // c'etait trois teintes qui ne servaient qu'a fragmenter la carte.
  return `<div class="nut-anneaux"${marge?' style="margin-bottom:'+marge+'"':''}>
    ${ring(tot.p,m.p,'#ff1e1e','Protéines','p','haltere')}
    ${ring(tot.c,m.g,'#ff1e1e','Glucides','c','wheat')}
    ${ring(tot.l,m.l,'#ff1e1e','Lipides','l','droplet')}
  </div>`;
}
// La ligne Calories et sa barre, PARTAGÉES elles aussi, pour la même raison
// que les anneaux : deux écrans qui affichent le même total ne doivent pas
// pouvoir diverger sur son arrondi ni sur le plafonnement de la barre.
function htmlLigneCalories(tot,m){
  const pct=m.kcal?Math.min((tot.kcal||0)/m.kcal,1):0;
  // LE CAISSON, ET NON UNE LIGNE POSEE SUR LE FOND. Les calories sont la
  // somme des trois anneaux du dessus : les encadrer dit qu'on change de
  // niveau de lecture, la ou une ligne nue se serait lue comme une quatrieme
  // macro.
  return `<div class="nut-bloc">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <span class="nut-cap">Calories</span>
      <span class="nut-kcal"><span id="rcmac-kcal" data-num="${Math.round(tot.kcal||0)}" style="font-variant-numeric:tabular-nums">${Math.round(tot.kcal||0)}</span><small>${m.kcal?' / '+m.kcal+' kcal':' kcal'}</small></span>
    </div>
    <div class="nut-piste">
      <div class="rc-barre" data-bar-w="${(pct*100).toFixed(1)}" style="height:100%;width:0;transition:width var(--t-3) var(--c-out)">
        <!-- L'ECLAIR VOYAGE DANS LA BARRE, pas au-dessus : enfant du
             remplissage, il suit sa largeur sans qu'on ait a lui calculer une
             position ni a l'animer separement. -->
        <span class="nut-zap">${icon('zap',12)}</span>
      </div>
    </div>
  </div>`;
}
// ── LA TUILE DE MACRO, PARTAGEE PAR LES DEUX CARTES ─────────────────────
// Le journal la rend en CONSOMME/CIBLE, avec sa jauge. La carte des
// objectifs la rend en CIBLE SEULE, sans jauge. Une seule fabrique, parce
// que deux copies du meme hexagone finiraient par diverger sur un detail —
// la taille de l icone, l arrondi, la couleur du libelle — et les deux
// grilles se liraient alors comme deux composants differents.
//
// UNE TUILE = UN HEXAGONE, UN CHIFFRE, UN LIBELLE, et une jauge quand il y a
// quelque chose a comparer. La couleur n est ecrite QU UNE fois, sur --c :
// les quatre morceaux la relisent.
//
// LA JAUGE EST PLAFONNEE A 100 %, LE POURCENTAGE NE L EST PAS. Un trait qui
// deborderait de sa piste ne voudrait rien dire, mais « 120 % » se lit tres
// bien et c est precisement ce que l athlete doit voir.
function htmlTuileNut(val,cible,unite,label,coul,ico,opts){
  const o=opts||{};
  const nb=v=>typeof v==='number'?parseFloat(v.toFixed(1)):v;
  // `cible > 0` ET NON `cible` : le sel est appele avec zero, et une cible
  // de zero ne se compare pas davantage qu une cible absente. Sans cible, ni
  // jauge ni pourcentage : il n y a rien a comparer, et un « 0 % » mentirait.
  const aCible=typeof cible==='number'&&isFinite(cible)&&cible>0;
  // EN CIBLE SEULE, LE GROS CHIFFRE EST LA CIBLE. La progression, ce sont les
  // anneaux au-dessus ; la redire ici ecrirait deux fois la meme phrase, et
  // deux grilles de tuiles identiques dont l une montre le consomme et
  // l autre la cible seraient illisibles l une sous l autre.
  const tete=o.cibleSeule
    ? `<span class="fj-val">${aCible?nb(cible):'-'}</span>${aCible&&unite?`<span class="fj-cible">${unite}</span>`:''}`
    : `<span class="fj-val">${nb(val)}</span>${aCible?`<span class="fj-cible">/${nb(cible)}${unite}</span>`:''}`;
  const pc=(!o.cibleSeule&&aCible)?Math.round((val/cible)*100):null;
  return `<div class="fj-tuile${o.kcal?' fj-kcal':''}" style="--c:${coul}">
    <div class="fj-tete">
      <span class="fj-hexa" aria-hidden="true">${icon(ico,15)}</span>
      <div style="min-width:0">${tete}</div>
    </div>
    <div class="fj-lbl">${label}</div>
    ${o.cibleSeule?'':`<div class="fj-pied">
      <div class="fj-barre"><i style="width:${pc==null?0:Math.min(pc,100)}%"></i></div>
      <span class="fj-pct">${pc==null?'-':pc+'%'}</span>
    </div>`}
  </div>`;
}
// LES SIX TUILES, DECRITES UNE FOIS. Les deux cartes lisent cette liste :
// l athlete retrouve la meme macro a la meme place dans les deux grilles, et
// une macro ajoutee un jour apparait des deux cotes du meme coup.
//
// `tot` et `cible` NE PORTENT PAS LE MEME NOM et c est la raison d etre de la
// table : les totaux du journal disent `c` et `fi` la ou les objectifs disent
// `g` et `f`. Les deux appels ecrivaient ce decalage a la main.
const TUILES_NUT=Object.freeze([
  Object.freeze({tot:'p',   cible:'p',   unite:'g',label:'Protéines',coul:'#ff2d2d',    ico:'haltere'}),
  Object.freeze({tot:'c',   cible:'g',   unite:'g',label:'Glucides', coul:'var(--gluc)',ico:'wheat'}),
  Object.freeze({tot:'l',   cible:'l',   unite:'g',label:'Lipides',  coul:'#22c55e',    ico:'droplet'}),
  Object.freeze({tot:'sel', cible:'sel', unite:'g',label:'Sel',      coul:'#60a5fa',    ico:'salt'}),
  Object.freeze({tot:'fi',  cible:'f',   unite:'g',label:'Fibres ℹ', coul:'#a78bfa',    ico:'leaf'}),
  Object.freeze({tot:'kcal',cible:'kcal',unite:'', label:'Kcal',     coul:'var(--text)',ico:'flame',kcal:true})
]);
// ── LES DEUX LIGNES LÉGÈRES DU JOURNAL ──────────────────────────────────
// Le sel et les fibres sont les deux SEULES macros que les anneaux de la carte
// des objectifs ne portent pas — protéines, glucides et lipides y ont leur
// anneau, les calories leur barre. Ils gardent donc une trace ici, mais réduite
// à une ligne : la grille de six tuiles redisait pour les quatre autres ce que
// les anneaux disent déjà, et deux fois la même chose sur un même écran, c'est
// une fois de trop.
//
// LA BARRE EST UNE `.rc-barre`, comme celle des calories : elle se remplit au
// rendu, par _animerJauges, avec la même courbe et la même durée. « Plus
// léger » tient dans la piste — 3 px contre 12 — et dans l'absence de caisson,
// pas dans une seconde mécanique d'animation qu'il faudrait tenir à jour.
//
// SANS CIBLE, PAS DE PISTE. Le sel n'en a pas tant que le poids de l'athlète
// est inconnu : une piste vide se lirait comme un objectif à zéro.
function htmlLigneMiniNut(label,val,cible,unite,coul){
  const nb=v=>String(typeof v==='number'?parseFloat(v.toFixed(1)):v).replace('.',',');
  const aCible=typeof cible==='number'&&isFinite(cible)&&cible>0;
  const pc=aCible?Math.min(((val||0)/cible)*100,100):0;
  return `<div class="fj-mini-e" style="--c:${coul}">
    <div class="fj-mini-t">
      <span class="fj-mini-lbl">${label}</span>
      <span class="fj-mini-v">${nb(val||0)}<small>${aCible?' / '+nb(cible)+unite:' '+unite}</small></span>
    </div>
    ${aCible?`<div class="fj-mini-p"><i class="rc-barre" data-bar-w="${pc.toFixed(1)}" style="width:0;transition:width var(--t-3) var(--c-out)"></i></div>`:''}
  </div>`;
}
// LA CONSIGNE, ET LE SEUL BOUTON D'AJOUT DE LA CARTE. Il était en haut, dans
// l'en-tête ; il descend ici pour se tenir avec la phrase qui explique ce qu'il
// fait. Deux boutons identiques dans une même carte n'auraient appris à
// personne comment on ajoute un aliment.
//
// LES TROIS ÉTAPES NE S'AFFICHENT QUE SUR UNE JOURNÉE VIDE. C'est là qu'on ne
// sait pas quoi faire ; les relire tous les jours par-dessus son propre journal
// serait du bruit. Le bouton, lui, reste toujours.
const FJ_ETAPES=Object.freeze([
  'Appuie sur + AJOUTER UN ALIMENT.',
  'Cherche-le dans la table, scanne son code-barres, ou crée-le à la main.',
  'Donne la quantité en grammes : le total du jour se met à jour tout seul.'
]);
function htmlConsigneJournal(date,vide){
  const etapes=FJ_ETAPES.map((t,i)=>`<li class="fj-etape"><span class="fj-etape-n">${i+1}</span><span>${escapeHtml(t)}</span></li>`).join('');
  return `<div style="margin-top:14px">
    ${vide?`<div class="fj-consigne">
      <!-- Court, et sur une ligne : « Comment on remplit sa journee » passait
           sur deux a 375 px, avec l interlettrage de .nut-cap. -->
      <div class="nut-cap" style="margin-bottom:10px">Pour commencer</div>
      <ol class="fj-etapes">${etapes}</ol>
    </div>`:''}
    <button class="btn btn-red" style="width:100%;margin:${vide?'12px 0 0':'0'};letter-spacing:1.5px" onclick="openFoodSearch('${date}')">+ Ajouter un aliment</button>
  </div>`;
}
// LA CIBLE DE SEL N'EST PAS UNE MACRO. Elle ne sort pas de
// _getEffectiveMacros — le dossier ne porte aucun gramme de sel — mais du
// moteur sodique, qui a besoin du dossier entier et de la date. Les deux cartes
// passent par ici pour que le chiffre affiché et la phrase qui l'explique
// viennent du MÊME calcul : deux appels séparés pourraient afficher une cible
// et une note qui ne parlent pas de la même journée.
//
// Les macros ne sont pas modifiées, elles sont COPIÉES : `m` vient de
// _getEffectiveMacros, que vingt autres écrans relisent.
function _selPourGrille(user,dateISO,m){
  let t=null;
  try{ t=cibleSodiumJour(user,dateISO,m); }catch(e){ t=null; }
  return {macros:(t?Object.assign({},m,{sel:t.targetSaltG}):m),
    cible:t,note:(t?phraseCibleSodium(t):'')};
}
function htmlGrilleTuilesNut(tot,m,opts){
  const o=opts||{};
  return `<div class="fj-grille">${TUILES_NUT.map(t=>{
    // Les kcal sont ARRONDIES avant d entrer dans la tuile : une somme
    // d aliments tombe sur 1847,3 kcal, et la decimale n a aucun sens ici.
    const brut=(tot&&tot[t.tot])||0;
    const v=t.tot==='kcal'?Math.round(brut):brut;
    const c=t.cible?((m&&m[t.cible])||0):0;
    return htmlTuileNut(v,c,t.unite,t.label,t.coul,t.ico,{kcal:t.kcal,cibleSeule:o.cibleSeule});
  }).join('')}</div>`;
}
// PURE. Le libellé d’un jour, PARTAGÉ par le journal et la carte des
// objectifs. Les deux en-têtes nomment le même jour : les laisser calculer
// ce nom chacun de son côté, c’est accepter qu’ils finissent par diverger.
function _libelleJourNut(dateISO){
  const auj=localISODate(new Date());
  if(dateISO===auj) return "Aujourd'hui";
  const h=new Date(); h.setDate(h.getDate()-1);
  if(dateISO===localISODate(h)) return 'Hier';
  const [y,m,d]=String(dateISO||'').split('-').map(Number);
  if(!(y>0&&m>0&&d>0)) return String(dateISO||'');
  return new Date(y,m-1,d).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
}
// `jourAff` est OPTIONNELLE et retombe sur aujourd’hui : le rendu initial et
// les tests intégrés, qui appellent avec le seul `nut`, ne changent pas.

// ⚠ LE GARDE-FOU TCA S'APPLIQUE INTEGRALEMENT A CETTE LIGNE, et c'est la
// seule de tout le lot qui parle a l'athlete. Dire « tes apports en fer sont a
// 45 % du repere », puis nommer trois aliments a manger, a quelqu'un dont le
// depistage a conclu a un risque de trouble du comportement alimentaire, c'est
// exactement ce que ce garde-fou existe pour empecher. Le coach, lui, continue
// de la voir : c'est un professionnel, et c'est a lui d'en faire quelque chose.
//
// ⚠ ELLE N'EXISTE PAS QUAND IL N'Y A RIEN A DIRE. Pas d'onglet, pas de sept
// jauges, pas d'emplacement vide qui attend : la rarete EST le dispositif. Une
// ligne toujours presente serait lue une fois puis jamais plus, et les quatre
// gardes du calcul n'auraient servi a rien.
function _htmlSignalMicro(user,finISO){
  const u=_dossier(user);
  if(!u) return '';
  try{ if(aTCA(u)) return ''; }catch(e){}
  let s=null;
  try{ s=signalMicro(u,finISO); }catch(e){ return ''; }
  if(!s) return '';
  let l=[];
  try{ l=alimentsRichesEn(u,s.cle,MICRO_SIGNAL_N_ALIMENTS,finISO); }catch(e){ l=[]; }
  // LES SIENS D'ABORD, ET LA PHRASE LE DIT. « Parmi ce que tu manges deja »
  // n'est pas un ornement : c'est la raison pour laquelle le conseil est
  // suivi, et la taire reviendrait a rendre la liste indistincte d'un
  // classement de la base.
  const siens=l.filter(x=>x.sien);
  const intro=l.length
    ? (siens.length===l.length
        ? 'Parmi ce que tu manges déjà, les plus riches en '+s.lib.toLowerCase()+' :'
        : (siens.length
            ? 'Les plus riches en '+s.lib.toLowerCase()+', dont '+siens.length
              +' que tu manges déjà :'
            : 'Les plus riches en '+s.lib.toLowerCase()+' :'))
    : '';
  return `<div style="margin-bottom:14px;background:var(--surface-1);border:1px solid var(--border);border-left:1px solid var(--border);border-radius:var(--r-3);padding:12px 14px">
    <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.6;font-weight:600">${escapeHtml(phraseSignalMicro(s))}</div>
    ${l.length?`<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6;margin-top:8px">${escapeHtml(intro)}</div>
    <div style="font-size:var(--fs-xs);color:var(--text);line-height:1.7;margin-top:4px">${
      l.map(x=>'· '+escapeHtml(x.nom)+' <span style="color:var(--text-faint)">('
        +escapeHtml(String(x.valeur))+' '+escapeHtml(x.unite)+' / 100 g)</span>').join('<br>')
    }</div>`:''}
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6;margin-top:10px">${escapeHtml(MICRO_DISCLAIMER)}</div>
  </div>`;
}
function _renderStrictMacroRings(nut,jourAff){
  const today=jourAff||localISODate(new Date());
  const estAuj=today===localISODate(new Date());
  const isOn=nutIsOnDay(today);
  const m=_getEffectiveMacros(nut,isOn,today);
  // LE BLOC DE REPERES N EST PLUS RENDU A L ATHLETE. Demande de Kevin, du
  // 24/08/2026 : les six tuiles de cibles prennent sa place au bas de la
  // carte. C etait son DERNIER emplacement — il avait deja quitte le journal
  // pour ne pas s y afficher deux fois — et il ne reparait donc nulle part
  // ailleurs sur l ecran de l athlete.
  //
  // ⚠ LE COTE COACH A DISPARU A SON TOUR le 08/09/2026 : Kevin a fait retirer
  // la section « Proteines par prise » de la fiche, et son rendu avec.
  // repartitionPrises, elle, reste appelee par l ecran de l athlete.
  // Ce qui n a plus d appelant, ce sont les trois
  // pieces qui ne parlaient qu a l athlete — _htmlReperesRepas,
  // _htmlRepartitionPrises et les phrases peri-seance. Elles ne sont pas
  // supprimees ici : ces textes sont relus et valides, et les effacer est une
  // decision separee de celle de les retirer de cette carte.
  if(!m.kcal&&!m.p&&!m.g&&!m.l) return '';
  // APRES la sortie anticipee : sans macros, la carte ne se rend pas du tout,
  // et le moteur sodique n'a aucune raison de tourner pour rien.
  const _sel=_selPourGrille(currentUser,today,m);
  const entries=(nut.log?.[today]?.entries)||[];
  // LE SEL ET LES FIBRES ENTRENT DANS CE TOTAL depuis que leurs deux barres
  // vivent ici. Le journal les comptait de son cote ; deux additions du meme
  // journal auraient fini par diverger sur une decimale.
  const tot=entries.reduce((a,e)=>({
    kcal:a.kcal+(e.kcal||0),p:a.p+(e.p||0),c:a.c+(e.c||0),l:a.l+(e.l||0),
    fi:a.fi+(e.fi||0),sel:a.sel+(e.sel||0)
  }),{kcal:0,p:0,c:0,l:0,fi:0,sel:0});
  // Les aliments enregistres avant ce champ, et les 190 aliments de Ciqual
  // qui n ont pas de valeur de sel, comptent pour zero. On le DIT plutot que
  // d afficher un total qui aurait l air complet.
  const _selManquant=entries.filter(e=>e&&e.sel==null).length;
  // PAS DE BADGE SUR UNE DIÈTE NON CYCLÉE. Les deux jours portent alors les
  // mêmes cibles : annoncer « JOUR OFF » ferait croire à un total réduit qui
  // n'existe pas. Le badge dit une différence, il se tait quand il n'y en a pas.
  const dayBadge=!dieteCyclee(currentUser)?'':isOn
    ?`<span style="display:inline-flex;align-items:center;gap:4px;font-size:var(--fs-xs);font-weight:800;color:var(--success);background:var(--success-bg);border:1px solid var(--success-border);border-radius:var(--r-1);padding:4px 10px;letter-spacing:1px">${icon('zap',10)} JOUR ON</span>`
    :`<span style="display:inline-flex;align-items:center;gap:4px;font-size:var(--fs-xs);font-weight:800;color:var(--sub);background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-1);padding:4px 10px;letter-spacing:1px">${icon('moon',10)} JOUR OFF</span>`;
  // L HABILLAGE EST CELUI DE LA CARTE DE L ACCUEIL, et rien d autre : meme
  // cadre .nut-hud, meme ciel d eclairs, meme en-tete .nut-tete. Ce que la
  // carte MONTRE ne bouge pas — son titre, son badge de phase, son jour
  // on/off, ses anneaux, sa ligne de calories et ses reperes de repas restent
  // ceux de la diete. On ne rapporte pas de l accueil son selecteur d unite
  // ni son score de la semaine : ils n ont rien a faire ici.
  //
  // .nut-lien N EST PAS REPRISE non plus. Sur l accueil elle rend la carte
  // cliquable pour ouvrir l onglet nutrition ; ici on y est deja, et un
  // curseur de main sur une carte qui ne mene nulle part serait un mensonge.
  return `<div class="card-nut nut-hud" style="margin-bottom:20px;${_animEntree('nut-rings')}">
    ${_htmlNutEclairs('D')}
    <div class="nut-tete">
      <span class="nut-boul">${icon('target',15)}</span>
      <span class="nut-sep"></span>
      <span class="nut-titre">${estAuj?'Objectifs du jour':'Objectifs'}</span>${rcInfo('macros')}
      <span style="display:inline-flex;align-items:center;gap:6px;margin-left:auto">${badgePhase(currentUser)}${dayBadge}</span>
      ${estAuj?'':`<div style="flex-basis:100%;margin-top:2px;font-size:var(--fs-xs);font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--red-text)">${_libelleJourNut(today)}</div>`}
    </div>
    ${(()=>{ const l=ligneJourSeance(currentUser,today); return l?'<div class="nut-jour-seance">'+escapeHtml(l)+'</div>':''; })()}
    ${htmlAnneauxMacros(tot,m,'16px')}
    ${(()=>{ try{ return htmlRepartitionProt(currentUser,entries,today); }catch(e){ return ''; } })()}
    ${htmlLigneCalories(tot,m)}
    <!-- LE SEL ET LES FIBRES, SOUS LA BARRE DES CALORIES. Ce sont les deux
         seules macros que les anneaux ne portent pas ; elles etaient dans le
         journal, elles remontent ici, ou vit deja tout ce qui se compare a une
         cible. Demande de Kevin, 24/08/2026. -->
    <div class="fj-mini" style="margin-top:14px">
      ${htmlLigneMiniNut('Sel',tot.sel,_sel.macros.sel,' g','#60a5fa')}
      ${htmlLigneMiniNut('Fibres ℹ',tot.fi,m.f,' g','#a78bfa')}
    </div>
    <!-- « fibres : indicatif » N EST ECRIT QU UNE FOIS, plus bas, sous les
         tuiles : les deux blocs portent le meme « ℹ » et la meme reserve, et
         la redire ici la faisait sortir deux fois dans la meme carte. Le sel
         non compte, lui, parle du TOTAL CONSOMME : sa place est sous la barre
         qui l affiche, pas sous une grille de cibles. -->
    ${_selManquant?`<div style="font-size:var(--fs-2xs);color:var(--text-faint);text-align:right;margin-top:8px">sel non compté sur ${_selManquant} aliment${_selManquant>1?'s':''}</div>`:''}
    <!-- LE SIGNAL D'APPORT, SOUS LES MACROS ET NULLE PART AILLEURS. Il rend la
         chaine vide dans l'immense majorite des cas : c'est le comportement
         attendu, pas une panne.
         IL N'EST PAS DANS htmlAnneauxMacros, ou il avait ete pose d'abord :
         cette fonction-la est PARTAGEE avec la carte de l'accueil, et elle ne
         recoit pas le jour affiche, la ligne y etait du code mort, avalee par
         son propre try/catch sur un « jourAff » qui n'existait pas dans sa
         portee. Ici, « today » est le jour reellement regarde.
         ET PAS D'ACCENT GRAVE DANS CE COMMENTAIRE : il vit A L'INTERIEUR
         d'un template literal, ou le premier backtick venu ferme la chaine et
         emporte le fichier entier. -->
    ${(()=>{ try{ return _htmlSignalMicro(currentUser,today); }catch(e){ return ''; } })()}
    <!-- LOT N2 : LES VOLTS DE LA CIBLE TENUE, dans la forme de la fin de
         seance. Rien du tout quand la journee ne l est pas : on ne dit jamais
         a quelqu un qu il a rate sa journee alimentaire. -->
    ${(()=>{ try{ return htmlVoltsCible(currentUser,today); }catch(e){ return ''; } })()}
    <!-- LES SIX CIBLES, EN TUILES. Elles ne repetent pas les anneaux : les
         anneaux disent OU EN EST la journee, les tuiles disent CE QU IL FAUT
         ATTEINDRE, et elles portent les deux cibles que les anneaux ne
         montrent pas du tout, le sel et les fibres. Demande de Kevin, sur sa
         maquette du 21/08/2026. -->
    <div style="margin-top:14px">
      <div class="nut-cap" style="margin-bottom:10px">Tes cibles</div>
      ${htmlGrilleTuilesNut(tot,_sel.macros,{cibleSeule:true})}
      <!-- LA MEME NOTE QU AU JOURNAL. Le « ℹ » de la tuile des fibres ne veut
           rien dire sans elle, et une grille qui porte le signe sans porter la
           legende renvoie le lecteur a une phrase qui n est pas la. -->
      <div style="font-size:var(--fs-xs);color:var(--text-dim);text-align:right;margin-top:10px">fibres : indicatif</div>
      ${_sel.note?`<div style="font-size:var(--fs-xs);color:var(--text-faint);line-height:1.55;margin-top:8px">${escapeHtml(_sel.note)}</div>`:''}
    </div>
  </div>`;
}

// `dateAff` est OPTIONNELLE et retombe sur aujourd'hui : les vingt appelants
// existants ne changent pas d'un iota. Elle sert à ceux qui savent sur quel
// jour le journal doit rester — après un ajout, notamment.
// ── LE CIEL D ECLAIRS, PARTAGE PAR LES DEUX CARTES DE NUTRITION ─────────
// Il est pose en dur dans l accueil, et rendu ici pour la diete. UNE SEULE
// description des faisceaux existe donc dans le fichier — celle-ci — et le
// banc verifie que la copie de l accueil lui reste identique.
//
// LES IDENTIFIANTS SONT SUFFIXES, et ce n est pas un detail : les deux
// cartes vivent dans le meme document, sur deux ecrans dont un seul est
// visible mais qui existent tous les deux. Deux degrades nommes nutEg, et
// url(#nutEg) resoudrait vers le premier venu — un document invalide qui
// marche par accident jusqu au jour ou l ordre change.
function _htmlNutEclairs(c){
  return '<svg class="nut-eclairs" viewBox="0 0 480 360" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="nutEg'+c+'" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff3a3a"/><stop offset=".26" stop-color="#e00808"/><stop offset="1" stop-color="#4a0000"/></linearGradient><filter id="nutEf'+c+'" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter></defs><g class="nut-ec nut-ec1 fx-loop"><path d="M470.0,-10.0 L456.5,13.5 L431.1,24.4 L417.1,47.4 L391.0,57.4 L371.3,74.4 L369.3,110.1 L349.8,127.2 L312.0,124.9 L300.0,150.0 M385.4,69.7 L373.6,84.7 L362.1,100.0 L355.6,118.7 L342.2,132.7 M361.6,92.0 L344.4,89.1 L345.7,110.2 L342.4,125.4 L324.1,121.1 M455.0,40.0 L428.1,52.8 L423.4,88.9 L378.7,83.0 L389.8,135.7 L340.9,125.3 L320.1,144.5 L318.9,184.3 L288.4,193.2 L260.8,205.3 L250.0,235.0 M337.9,151.4 L346.4,170.8 L368.9,171.1 L373.1,196.4 L396.8,195.1 M322.7,165.9 L313.0,181.7 L284.5,160.0 L281.4,189.0 L266.3,194.0" stroke="url(#nutEg'+c+')" stroke-width="8" fill="none" stroke-linecap="round" filter="url(#nutEf'+c+')" opacity=".9"/><path d="M470.0,-10.0 L456.5,13.5 L431.1,24.4 L417.1,47.4 L391.0,57.4 L371.3,74.4 L369.3,110.1 L349.8,127.2 L312.0,124.9 L300.0,150.0 M385.4,69.7 L373.6,84.7 L362.1,100.0 L355.6,118.7 L342.2,132.7 M361.6,92.0 L344.4,89.1 L345.7,110.2 L342.4,125.4 L324.1,121.1 M455.0,40.0 L428.1,52.8 L423.4,88.9 L378.7,83.0 L389.8,135.7 L340.9,125.3 L320.1,144.5 L318.9,184.3 L288.4,193.2 L260.8,205.3 L250.0,235.0 M337.9,151.4 L346.4,170.8 L368.9,171.1 L373.1,196.4 L396.8,195.1 M322.7,165.9 L313.0,181.7 L284.5,160.0 L281.4,189.0 L266.3,194.0" stroke="#ff7070" stroke-width="1" opacity=".55" fill="none" stroke-linecap="round"/></g><g class="nut-ec nut-ec2 fx-loop"><path d="M430.0,-12.0 L405.7,11.7 L375.0,29.0 L345.5,47.6 L341.2,91.1 L302.0,100.1 L281.0,127.0 L259.0,153.0 L246.5,188.4 L215.0,205.0 M352.2,66.6 L356.0,84.8 L365.9,97.3 L382.5,103.2 L396.3,111.7 M486.0,120.0 L462.7,142.1 L441.4,165.6 L438.3,203.5 L406.2,218.6 L399.3,253.4 L361.7,264.3 L355.7,299.8 L330.0,320.0 M423.8,199.8 L419.0,222.6 L399.8,233.3 L384.1,246.9 L371.1,262.7" stroke="url(#nutEg'+c+')" stroke-width="8" fill="none" stroke-linecap="round" filter="url(#nutEf'+c+')" opacity=".9"/><path d="M430.0,-12.0 L405.7,11.7 L375.0,29.0 L345.5,47.6 L341.2,91.1 L302.0,100.1 L281.0,127.0 L259.0,153.0 L246.5,188.4 L215.0,205.0 M352.2,66.6 L356.0,84.8 L365.9,97.3 L382.5,103.2 L396.3,111.7 M486.0,120.0 L462.7,142.1 L441.4,165.6 L438.3,203.5 L406.2,218.6 L399.3,253.4 L361.7,264.3 L355.7,299.8 L330.0,320.0 M423.8,199.8 L419.0,222.6 L399.8,233.3 L384.1,246.9 L371.1,262.7" stroke="#ff7070" stroke-width="1" opacity=".55" fill="none" stroke-linecap="round"/></g><g class="nut-ec nut-ec3 fx-loop"><path d="M300.0,-14.0 L276.3,12.9 L254.3,41.6 L231.4,69.4 L186.5,74.5 L169.8,108.6 L142.5,131.8 L120.0,160.0 M223.9,59.5 L226.4,76.5 L235.7,89.5 L241.5,104.5 L256.4,114.1 M219.4,63.9 L204.7,66.7 L200.7,87.5 L181.3,82.6 L171.1,92.9 M470.0,200.0 L443.9,220.9 L429.7,254.5 L390.7,261.7 L383.5,302.7 L341.7,306.9 L319.2,331.7 L300.0,360.0 M421.9,245.2 L416.0,256.9 L425.0,274.7 L415.0,284.8 L402.4,293.7 M60.0,-10.0 L57.1,18.7 L29.3,37.9 L38.6,71.3 L24.7,95.8 L10.0,120.0 M33.6,58.8 L30.9,69.7 L33.2,78.1 L48.2,80.3 L48.7,89.7" stroke="url(#nutEg'+c+')" stroke-width="8" fill="none" stroke-linecap="round" filter="url(#nutEf'+c+')" opacity=".9"/><path d="M300.0,-14.0 L276.3,12.9 L254.3,41.6 L231.4,69.4 L186.5,74.5 L169.8,108.6 L142.5,131.8 L120.0,160.0 M223.9,59.5 L226.4,76.5 L235.7,89.5 L241.5,104.5 L256.4,114.1 M219.4,63.9 L204.7,66.7 L200.7,87.5 L181.3,82.6 L171.1,92.9 M470.0,200.0 L443.9,220.9 L429.7,254.5 L390.7,261.7 L383.5,302.7 L341.7,306.9 L319.2,331.7 L300.0,360.0 M421.9,245.2 L416.0,256.9 L425.0,274.7 L415.0,284.8 L402.4,293.7 M60.0,-10.0 L57.1,18.7 L29.3,37.9 L38.6,71.3 L24.7,95.8 L10.0,120.0 M33.6,58.8 L30.9,69.7 L33.2,78.1 L48.2,80.3 L48.7,89.7" stroke="#ff7070" stroke-width="1" opacity=".55" fill="none" stroke-linecap="round"/></g></svg>';
}
function _renderNutriContent(type,dateAff){
  // R26 — « Mon approche » suit chaque rendu, quel que soit le chemin qui a
  // change la diete. R34 — c'est desormais le bouton de tete.
  _majApprocheNut(type);
  const contentEl=document.getElementById('nut-diet-content');
  // Encart de transition : il se pose AVANT tout le reste, parce qu'il explique
  // pourquoi les chiffres affiches en dessous ne portent aucune adaptation.
  const _transi=_htmlDieteTransition(currentUser&&currentUser.nutrition);
  const fjSec=document.getElementById('fj-today-section');
  if(!contentEl) return;
  const nut=currentUser.nutrition||{};
  // ELLE VIENT DE coach_public, PAS DE `users` : voir coachAffichable. Ce
  // rendu cherchait le dossier complet du coach dans le stockage local de
  // l athlete, qui ne le contient jamais — la photo ne pouvait donc pas
  // s afficher, et le cercle retombait toujours sur son haltere.
  const _flxPhoto=photoCoachDe(currentUser);
  const _flxCircle=_flxPhoto
    ?`<img src="${escapeHtml(_flxPhoto)}" style="width:54px;height:54px;border-radius:var(--r-full);object-fit:cover;flex-shrink:0;border:2px solid rgba(255,255,255,.35);box-shadow:0 0 0 4px rgba(0,0,0,.18)">`
    :`<div style="width:54px;height:54px;border-radius:var(--r-full);background:rgba(0,0,0,.28);border:2px solid rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--text)">${icon('dumbbell',22)}</div>`;
  if(type==='flexible'){
    // L'ENCART QUI EXPLIQUE LA DIETE VIENT EN PREMIER, LA CARTE DES CIBLES
    // JUSTE APRES. On dit d'abord ou l'on est, on regle ensuite : l'ordre
    // inverse faisait regler des chiffres avant d'avoir nomme la methode.
    contentEl.innerHTML=`
      <div class="banner-hero" style="margin-bottom:20px;${_animEntree('nut-hero')}">
        <div style="position:relative;display:flex;gap:14px;align-items:flex-start">
          ${_flxCircle}
          <div style="flex:1;min-width:0">
            <div style="font-size:var(--fs-xs);color:rgba(255,255,255,.55);letter-spacing:3px;font-weight:800;text-transform:uppercase;margin-bottom:4px">Ton approche</div>
            <div style="font-size:var(--fs-xl);font-weight:900;color:var(--text);letter-spacing:-0.3px;line-height:1.1;margin-bottom:8px">DIÈTE FLEXIBLE</div>
            <p style="margin:0;font-size:var(--fs-sm);color:rgba(255,255,255,.72);line-height:1.65">La diète flexible, c'est la liberté de manger ce que tu veux: à condition d'atteindre tes objectifs de macros sur la journée. Protéines, glucides, lipides: tant que tu es dans les clous en fin de journée, tu progresses. Tu gardes ta liberté au quotidien, avec des résultats au rendez-vous.</p>
          </div>
        </div>
      </div>
      ${(()=>{ try{ return _htmlCiblesAthlete(currentUser); }catch(e){ return ''; } })()}
      ${_htmlSopkAthlete(currentUser)}
      ${_htmlDepartAthlete(nut)}
      ${_htmlPlancherAthlete(currentUser)}
      ${_htmlPalierAthlete(currentUser)}
      ${_htmlRecuperationAthlete(currentUser)}
      ${_htmlAjustement(currentUser,false)}
      <div id="nut-rings-slot">${_renderStrictMacroRings(nut)}</div>
      <!-- LA NAVIGATION DU JOURNAL ET SA CONSIGNE.
           Demande de Kevin : le geste d ajouter un aliment se decide juste
           apres avoir lu ses cibles, pas apres avoir descendu tout l ecran.
           Le journal lui-meme, les repas, les aliments, reste plus bas, dans
           #fj-today-section : c est une liste, elle se consulte, elle ne se
           decide pas. -->
      <div id="fj-nav-slot"></div>
      <!-- L HYDRATATION A QUITTE CET ENDROIT. Elle se rend desormais dans le
           journal, SOUS « Copier la journee d hier » : demande de Kevin, du
           24/08/2026. Elle etait au-dessus du bouton, et collee a lui. -->
      ${_renderCycleNutSettings(nut)}`;
    // LE JOUR VISÉ, ou aujourd'hui à défaut. Cette ligne ramenait le journal à
    // aujourd'hui après chaque rendu : un aliment ajouté à un jour passé
    // paraissait perdu, et on le saisissait une seconde fois.
    if(fjSec){fjSec.style.display='block';_renderFjDaySummary(dateAff||localISODate(new Date()));}
  } else {
    if(fjSec) fjSec.style.display='none';
    _renderStrictDiet();
  }
}

// L'écran verrouillé. Il reprend la forme des accès réservés de
// l'application — cadenas, contenu grisé — mais il ne se contente PAS de
// fermer : il dit pourquoi, et il propose une sortie. Un athlète qui n'a pas
// de coach n'attend rien de personne ; le laisser devant une porte close sans
// lui montrer la diète flexible, qui elle fonctionne en autonomie, serait le
// bloquer pour rien.
const STRICT_VERROU=Object.freeze({
  sans_coach:Object.freeze({
    titre:'Réservé au suivi coaché',
    texte:'La diète stricte est un plan alimentaire composé repas par repas '
      +'par ton coach. Sans coach, il n\'y a personne pour l\'écrire.',
    action:'La diète flexible, elle, te suit en autonomie : tu fixes tes '
      +'macros et tu manges ce que tu veux dans ces limites.'
  }),
  referme:Object.freeze({
    titre:'Ton coach l\'a refermée pour le moment',
    texte:'Il retravaille ton plan alimentaire. Rien n\'est perdu : tu le '
      +'retrouveras dès qu\'il te l\'aura rouvert, tel qu\'il l\'aura préparé.',
    action:'En attendant, tu peux suivre ta nutrition en diète flexible.'
  }),
  non_valide:Object.freeze({
    titre:'Ton coach ne l\'a pas encore ouverte',
    texte:'Ton coach prépare ton plan alimentaire. Tu y auras accès dès '
      +'qu\'il te l\'aura ouvert : tu n\'as rien à faire.',
    action:'En attendant, tu peux suivre ta nutrition en diète flexible.'
  })
});
function _htmlStrictVerrou(raison){
  const v=STRICT_VERROU[raison]||STRICT_VERROU.non_valide;
  return `<div style="position:relative;border:1px solid var(--border);border-radius:var(--r-4);padding:28px 20px;text-align:center;background:linear-gradient(180deg,var(--surface-1),var(--dark));overflow:hidden">
    <div style="position:absolute;inset:0;background-image:none;pointer-events:none"></div>
    <div style="position:relative">
      <div style="color:var(--text-dim);line-height:0;margin-bottom:14px">${icon('lock',40)}</div>
      <div style="font-family:var(--pile-titre);font-size:var(--fs-xl);letter-spacing:2.5px;text-transform:uppercase;color:var(--text-dim);margin-bottom:4px">Diète stricte</div>
      <div style="font-size:var(--fs-md);font-weight:800;color:var(--text-strong);margin-bottom:10px">${escapeHtml(v.titre)}</div>
      <p style="margin:0 0 10px;font-size:var(--fs-sm);color:var(--sub);line-height:1.65">${escapeHtml(v.texte)}</p>
      <p style="margin:0 0 20px;font-size:var(--fs-xs);color:var(--text-faint);line-height:1.6">${escapeHtml(v.action)}</p>
      <button class="btn btn-outline btn-sm btn-doigt" style="width:100%;margin:0;letter-spacing:1px;font-size:var(--fs-xs)" onclick="setNutriDietType('flexible')">Passer en diète flexible</button>
      ${raison==='sans_coach'?`<button class="btn btn-outline btn-sm" style="width:100%;margin:8px 0 0;letter-spacing:1px;font-size:var(--fs-xs)" onclick="go('s-client-code')">J'ai un code coach</button>`:''}
    </div>
  </div>`;
}

// ══ R26 — MON APPROCHE : LA LIGNE, LA FEUILLE, LA CONFIRMATION ═══════════
//
// Le <select> de tete est parti. Ce qui changeait le type de diete d'un geste
// passe desormais par trois temps : la ligne du bas, la feuille qui dit ce que
// chaque diete change au quotidien, puis une confirmation. Le geste d'ecriture,
// lui, ne change pas : c'est toujours setNutriDietType, avec sa garde.
//
// `ligne` est ce qu'affiche « Mon approche : … ».
const DIETE_CHOIX=Object.freeze([
  Object.freeze({type:'flexible',nom:'DIÈTE FLEXIBLE',ligne:'diète flexible',
    desc:'Tu fixes tes macros et tu manges ce que tu veux dans ces limites. '
      +'Tu notes chaque aliment dans le journal.'}),
  Object.freeze({type:'strict',nom:'DIÈTE STRICTE',ligne:'diète stricte',
    desc:'Ton coach compose ton plan repas par repas. Tu réponds simplement '
      +'chaque jour si tu l\'as respecté.'})
]);
// CE QUE DIT LA CONFIRMATION, VERIFIE SUR LE CODE. setNutriDietType n'ecrit
// QUE nutrition.dietType : le journal (nutrition.log), les cibles reglees
// (nutrition.perso, nutrition.macros), les reponses du jour (nutrition.days)
// et le plan du coach restent dans le dossier. _renderNutriContent n'affiche
// que la diete choisie — journal masque en stricte, plan et suivi du jour
// absents en flexible — et les relit tels quels au retour.
const DIETE_CONFIRMER=Object.freeze({
  strict:Object.freeze({titre:'Passer en diète stricte ?',
    texte:'Ton journal alimentaire ne sera plus affiché. Tes données sont '
      +'conservées et tu les retrouveras si tu reviens en flexible.',
    ok:'Passer en diète stricte'}),
  flexible:Object.freeze({titre:'Passer en diète flexible ?',
    texte:'Ton plan repas et ton suivi quotidien ne seront plus affichés. Tes '
      +'données sont conservées et tu les retrouveras si tu reviens en stricte.',
    ok:'Passer en diète flexible'})
});
// PURE. Les deux options, dans l'ordre de DIETE_CHOIX.
// L'option verrouillee reste VISIBLE, avec son cadenas. La retirer ferait
// croire que la diete stricte n'existe pas, alors qu'elle est seulement
// fermee — et un athlete qui ne sait pas qu'elle existe ne la demandera
// jamais a son coach. Elle dit POURQUOI, avec le texte de l'ecran verrouille :
// une seule redaction de la raison, pas deux.
function _htmlChoixDiete(user){
  const actuel=typeDiete((user&&user.nutrition)||{});
  const acces=accesDieteStricte(user);
  return DIETE_CHOIX.map(o=>{
    const verrou=o.type==='strict'&&!acces.ok;
    const v=verrou?(STRICT_VERROU[acces.raison]||STRICT_VERROU.non_valide):null;
    const ici=o.type===actuel;
    return '<button type="button" class="dch-opt'+(ici?' actif':'')+'" data-diete="'+o.type+'"'
      +(ici?' aria-current="true"':'')
      +(verrou?' disabled':' onclick="choisirDiete(\''+o.type+'\')"')+'>'
      +'<span class="dch-tete"><span class="dch-nom">'+o.nom+(verrou?' 🔒':'')+'</span>'
      +(ici?'<span class="dch-etat">Actuelle</span>':'')+'</span>'
      +'<span class="dch-desc">'+escapeHtml(o.desc)+'</span>'
      +(v?'<span class="dch-verrou"><strong>'+escapeHtml(v.titre)+'</strong>'+escapeHtml(v.texte)+'</span>':'')
      +'</button>';
  }).join('');
}
function ouvrirChoixDiete(){
  const c=document.getElementById('rc-diete-corps');
  if(!c||!currentUser) return null;
  c.innerHTML=_htmlChoixDiete(currentUser);
  const f=_feuilleOuvrir('rc-diete');
  try{
    const b=c.querySelector('.dch-opt.actif:not(:disabled)')||c.querySelector('.dch-opt:not(:disabled)');
    if(b) b.focus({preventScroll:true});
  }catch(e){}
  return f;
}
function fermerChoixDiete(tout_de_suite){ _feuilleFermer('rc-diete',tout_de_suite); }
// Rend true si la diete a change.
async function choisirDiete(type){
  if(DIETES_CONNUES.indexOf(type)<0||!currentUser) return false;
  const actuel=typeDiete(currentUser.nutrition||{});
  // La feuille part AVANT la question : deux calques empiles, et le retour
  // fermerait la feuille du dessous en laissant la question ouverte.
  fermerChoixDiete();
  if(type===actuel) return false;
  const acces=accesDieteStricte(currentUser);
  // Verrouillee : pas de question pour un refus. setNutriDietType refuse et
  // dit pourquoi, avec ses propres mots.
  if(type==='strict'&&!acces.ok){ setNutriDietType(type); return false; }
  // QUITTER UNE STRICTE VERROUILLEE NE FAIT RIEN PERDRE DE VISIBLE : l'ecran
  // ne montrait que le verrou, ni plan ni suivi du jour. « Ton plan repas ne
  // sera plus affiche » y serait faux, et le bouton du verrou fait deja ce
  // passage sans question.
  if(!(type==='flexible'&&actuel==='strict'&&!acces.ok)){
    const q=DIETE_CONFIRMER[type];
    if(!await rcConfirm(q.titre,q.texte,q.ok)) return false;
  }
  setNutriDietType(type);
  return typeDiete(currentUser.nutrition||{})===type;
}
// La ligne suit LE RENDU, pas le dossier : _renderNutriContent affiche la
// flexible pour 'flexible' et la stricte pour tout le reste, et la ligne dit
// la meme chose que l'ecran au-dessus d'elle.
function _majApprocheNut(type){
  const v=document.getElementById('nut-approche-val');
  if(!v) return;
  v.textContent=DIETE_CHOIX.find(o=>o.type===(type==='flexible'?'flexible':'strict')).ligne;
}

// Le jour visé par les deux boutons OUI/NON. `null` = aujourd'hui.
let _strictJour=null;
// PURE. Le jour retenu : celui choisi s'il est recevable, aujourd'hui sinon.
// MÊME BORNE QUE _bandeauJour — STEPS_RETENTION_JOURS — parce que c'est le
// même sélecteur qui la propose : offrir un jour hors de portée serait un
// piège.
function _strictJourValide(choisi,maintenant){
  const now=maintenant||new Date();
  const auj=localISODate(now);
  const min=localISODate(new Date(now.getTime()-STEPS_RETENTION_JOURS*24*3600*1000));
  const j=String(choisi||'');
  return (j>=min&&j<=auj)?j:auj;
}
// Le handler du sélecteur, à la forme attendue par _bandeauJour : une chaîne
// vide ramène à aujourd'hui.
function setStrictJour(v){
  _strictJour=v||null;
  _renderStrictDiet();
}
function _renderStrictDiet(){
  const el=document.getElementById('nut-diet-content');
  if(!el) return;
  // LE VERROU PASSE AVANT TOUT. Rien du plan — ni les macros, ni les repas,
  // ni la liste de courses — ne doit être construit pour quelqu'un qui n'y a
  // pas droit : un écran grisé par-dessus un contenu rendu se contourne.
  //
  // L'encart de transition, LUI, reste au-dessus du verrou : il ne parle pas
  // du plan mais des réglages de cycle de l'athlète, et il dit précisément
  // qu'ils ne s'appliquent pas hors diète flexible. Le masquer laisserait une
  // adaptation active sans effet et sans explication.
  const _acces=accesDieteStricte(currentUser);
  if(!_acces.ok){
    el.innerHTML=_htmlDieteTransition(currentUser&&currentUser.nutrition)
      +_htmlStrictVerrou(_acces.raison);
    return;
  }
  // Les sources du plan sont des identifiants Ciqual : sans la table, elles
  // s'afficheraient toutes « aliment introuvable ». On rend une première fois
  // sans elle — l'écran ne doit pas rester blanc — puis on recommence.
  // _loadCiqual pose _ciqualDB même en cas d'échec réseau, donc pas de boucle.
  if(planActif(currentUser)&&!_ciqualDB) _loadCiqual().then(()=>_renderStrictDiet());
  const nut=currentUser.nutrition||{};
  const _transiStrict=_htmlDieteTransition(nut);
  // LE JOUR CHOISI, et non plus le jour même : une journée oubliée la veille
  // était perdue, et la série de jours consécutifs cassait pour une case non
  // cochée.
  const _sjour=_strictJourValide(_strictJour);
  // ⚠ LA SERIE « JOURS CONSECUTIFS » N'EST PLUS A L'ECRAN (Kevin, 24/09/2026 :
  //   « supprime le jour consecutif et agrandis les boutons »). serieDieteJours
  //   reste — pure, testee, et lue ailleurs ; seul l'affichage part.
  // Meme lecture que l en-tete de la diete flexible, et pour la meme raison.
  const coachPhoto=photoCoachDe(currentUser);
  const coachCircle=coachPhoto
    ?`<img src="${escapeHtml(coachPhoto)}" style="width:54px;height:54px;border-radius:var(--r-full);object-fit:cover;flex-shrink:0;border:2px solid rgba(255,255,255,.35);box-shadow:0 0 0 4px rgba(0,0,0,.18)">`
    :`<div style="width:54px;height:54px;border-radius:var(--r-full);background:rgba(0,0,0,.28);border:2px solid rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--text)">${icon('dumbbell',22)}</div>`;
  // LE SUIVI DU JOUR, EN UNE CARTE (maquette de Kevin, 24/09/2026), juste
  // sous le cadre qui explique la diete : voir _htmlSuiviAlimentaire.
  const suiviDuJour=_htmlSuiviAlimentaire(currentUser,_sjour);
  // LA FICHE A IMPRIMER, EN ROUGE, JUSTE APRES « 1 PORTION DE FRUITS » (Kevin,
  // 24/09/2026). Le plan de l'athlete ouvre les deux planches que Kevin colle
  // sur le frigo, remplies avec ce plan-ci.
  // ⚠ ELLE EST POSEE PAR L'ECRAN, dans l'emplacement que _htmlPlanAthlete
  //   reserve apres la table des fruits (son second argument) : ce rendu-la
  //   ne porte lui-meme AUCUN bouton, et une assertion le garde. Sans plan,
  //   _htmlPlanAthlete ne rend rien — pas de fiche, rien a imprimer.
  const ficheAlim=`<button class="btn btn-red btn-doigt" style="width:100%;margin:0 0 16px"
      onclick="ouvrirFicheAlim()">Fiche alimentaire à imprimer</button>`;
  el.innerHTML=`${_transiStrict}
    <!-- Définition diète stricte -->
    <div class="banner-hero" style="margin-bottom:20px;animation:fadeInUp var(--t-3) var(--c-out)">
      <div style="position:relative;display:flex;gap:14px;align-items:flex-start">
        ${coachCircle}
        <div style="flex:1;min-width:0">
          <div style="font-size:var(--fs-xs);color:rgba(255,255,255,.55);letter-spacing:3px;font-weight:800;text-transform:uppercase;margin-bottom:4px">Ton approche</div>
          <div style="font-size:var(--fs-xl);font-weight:900;color:var(--text);letter-spacing:-0.3px;line-height:1.1;margin-bottom:8px">DIÈTE STRICTE</div>
          <p style="margin:0;font-size:var(--fs-xs);color:rgba(255,255,255,.72);line-height:1.6">Ton programme alimentaire est 100&nbsp;% défini par ton coach: chaque repas, chaque apport. L'avantage: zéro prise de tête. Tu sais exactement quoi manger, quand, et en quelle quantité. Le cadre strict te permet de t'organiser au maximum et de progresser sans improviser.</p>
        </div>
      </div>
    </div>
    <!-- LE SUIVI ALIMENTAIRE, JUSTE SOUS LE CADRE EXPLICATIF (Kevin,
         24/09/2026). Avec ou sans plan : il est rendu ici, une seule fois, et
         _htmlPlanAthlete ne le recoit plus. -->
    ${suiviDuJour}
    <!-- Plan alimentaire pas encore composé. Le bloc DISPARAÎT dès qu'un plan
         existe : « Plan alimentaire à venir » juste au-dessus d'un plan complet
         se lisait comme une contradiction. Le plan en photo a été retiré : le
         coach compose désormais le plan dans l'application, il ne le dépose
         plus en image. -->
    ${!planActif(currentUser)?`
    <div style="margin-bottom:20px">
      <div style="font-size:var(--fs-xs);color:var(--sub);text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:6px">${icon('clipboard',12)} Plan alimentaire</div>
      <div style="background:var(--surface-1);border:1px dashed var(--border);border-radius:var(--r-3);padding:32px 16px;text-align:center;color:var(--text-dim);font-size:var(--fs-sm)"><div style="margin-bottom:8px;opacity:.3">${icon('clipboard',32)}</div>Plan alimentaire à venir</div>
    </div>`:''}
    <!-- Le plan composé par le coach : repas imposés et sources interchangeables -->
    ${_htmlPlanAthlete(currentUser,ficheAlim)}
`;
}

// ══ SUIVI ALIMENTAIRE — LA MAQUETTE DE KEVIN (24/09/2026) ═════════════════
// La question du jour et ses deux compteurs, reunis dans UNE carte, juste
// sous le cadre qui explique la diete stricte : « remplace par celle-ci et
// place-la juste en dessous du cadre explicatif ». Elle vivait au milieu du
// plan, a la place de la liste de courses, ou sous « Plan alimentaire a
// venir » quand le plan n'existait pas encore.
// Dans l'ordre : l'en-tete et le jour vise ; Oui / Non ; la serie ; les
// sept derniers jours en anneau ; les sept pastilles, qui menent chacune a
// leur jour ; « Voir mon suivi », quatre semaines d'un coup d'oeil.
// ⚠ « CETTE SEMAINE » = LES SEPT DERNIERS JOURS, ceux des pastilles juste
//   dessous. Compter la semaine calendaire sous sept pastilles glissantes,
//   c'etait afficher deux chiffres qui ne se recoupent pas.
const _SA_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">';
const SA_ICO={
  couverts:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 2.5a1 1 0 0 1 1 1V9a1 1 0 0 0 1 1V3.5a1 1 0 1 1 2 0V10a1 1 0 0 0 1-1V3.5a1 1 0 1 1 2 0V9a3 3 0 0 1-2.2 2.9V20.5a1.5 1.5 0 0 1-3 0v-8.6A3 3 0 0 1 5 9V3.5a1 1 0 0 1 1-1zM17.5 2.5c1.9 0 3 2.6 3 6.2 0 2.4-.9 3.8-2 4.3v7.5a1.5 1.5 0 0 1-3 0V3.8c0-.7.6-1.3 2-1.3z"/></svg>',
  oui:_SA_SVG+'<path d="M4.5 12.5l5 5L19.5 7"/></svg>',
  non:_SA_SVG+'<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
  moins:_SA_SVG+'<path d="M7 12h10"/></svg>',
  points:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="7" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="17" cy="12" r="1.6"/></svg>',
  calendrier:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13h.01M12 13h.01M16.5 13h.01M7.5 16.5h.01M12 16.5h.01"/></svg>',
  bas:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  droite:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  histo:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="11" width="3.4" height="9" rx="1.2"/><rect x="10.3" y="6" width="3.4" height="14" rx="1.2"/><rect x="16.6" y="9" width="3.4" height="11" rx="1.2"/></svg>'
};
// PURE. L'etat d'un jour pour sa pastille : 'oui', 'non', 'vide' (jour passe
// sans reponse) ou 'attente' (aujourd'hui, pas encore repondu).
function saEtatJour(u,iso,auj){
  const r=(((u&&u.nutrition)||{}).days||{})[iso];
  const v=r&&r.respected;
  if(v===true) return 'oui';
  if(v===false) return 'non';
  return iso===auj?'attente':'vide';
}
// PURE. Les n derniers jours, du plus ancien a aujourd'hui.
function saJours(n,maintenant){
  const d=maintenant?new Date(maintenant):new Date(); d.setHours(12,0,0,0);
  const out=[];
  for(let i=n-1;i>=0;i--){ const j=new Date(d); j.setDate(d.getDate()-i); out.push({iso:localISODate(j),d:j}); }
  return out;
}
function _saPastille(etat){
  return '<span class="sa-p" data-e="'+etat+'">'
    +(etat==='oui'?SA_ICO.oui:etat==='non'?SA_ICO.non:etat==='attente'?SA_ICO.points:SA_ICO.moins)+'</span>';
}
function _saJourCourt(d){
  const s=d.toLocaleDateString('fr-FR',{weekday:'short'}).replace('.','');
  return s.charAt(0).toUpperCase()+s.slice(1);
}
function _htmlSuiviAlimentaire(u,sjour){
  // ⚠ LA MAQUETTE, A L'ECHELLE : chaque element est pose a ses coordonnees
  //   (voir la feuille de styles, « SUIVI ALIMENTAIRE — A L'ECHELLE »). Ne
  //   pas y ajouter de ligne : la carte a la hauteur de la maquette, rien de
  //   plus. La serie « jours consecutifs » en est partie a la demande de
  //   Kevin (24/09/2026) : Oui et Non ont pris sa place.
  const auj=localISODate(new Date());
  const sAuj=(sjour===auj);
  const r=((((u&&u.nutrition)||{}).days||{})[sjour]||{}).respected;
  const jours=saJours(7);
  const tenus=jours.filter(j=>saEtatJour(u,j.iso,auj)==='oui').length;
  const C=2*Math.PI*42;
  const min=localISODate(new Date(Date.now()-STEPS_RETENTION_JOURS*24*3600*1000));
  let opts='';
  for(let t=new Date(auj+'T12:00:00');localISODate(t)>=min;t.setDate(t.getDate()-1)){
    const iso=localISODate(t);
    opts+='<option value="'+iso+'"'+(iso===sjour?' selected':'')+'>'
      +(iso===auj?'Aujourd’hui : ':'')+t.toLocaleDateString('fr-FR')+'</option>';
  }
  const dateLib=new Date(sjour+'T12:00:00').toLocaleDateString('fr-FR');
  const bouton=(val,titre,sous,ico)=>{
    const actif=(r===val);
    return '<button type="button" class="sa-rep" data-v="'+(val?'oui':'non')+'"'+(actif?' data-actif=""':'')
      +' aria-pressed="'+actif+'" onclick="setNutriRespected(\''+sjour+'\','+val+')">'
      +'<span class="sa-rep-i">'+ico+'</span><span class="sa-rep-t"><b>'+titre+'</b><span>'+sous+'</span></span></button>';
  };
  // Les sept pastilles, aux abscisses de la maquette : 142 d'ecart, la
  // premiere a 28 du bord interieur.
  const pastilles=jours.map((j,i)=>{
    const e=saEtatJour(u,j.iso,auj);
    const lib=j.d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
    return '<button type="button" class="sa-j'+(j.iso===sjour?' sa-j-vise':'')+'" style="left:calc('+(28+142*i)+' * var(--u))"'
      +' onclick="setStrictJour(\''+(j.iso===auj?'':j.iso)+'\')"'
      +' aria-label="'+escapeHtml(lib+' : '+(e==='oui'?'plan respecté':e==='non'?'plan non respecté':'pas de réponse'))+'">'
      +_saPastille(e)+'<span>'+escapeHtml(_saJourCourt(j.d))+'</span></button>';
  }).join('');
  return '<section class="sa-carte" aria-label="Suivi alimentaire"><div class="sa-in">'
    +'<span class="sa-ico">'+SA_ICO.couverts+'</span>'
    +'<h3 class="sa-titre">Suivi <span>alimentaire</span></h3>'
    +'<span class="sa-q">J’ai respecté mon plan<br>'+(sAuj?'aujourd’hui':'ce jour-là')+' ?</span>'
    +'<label class="sa-date">'+SA_ICO.calendrier+'<span>'+escapeHtml(dateLib)+'</span>'+SA_ICO.bas
      +'<select onchange="setStrictJour(this.value===\''+auj+'\'?\'\':this.value)" aria-label="Choisir le jour">'+opts+'</select></label>'
    +bouton(true,'Oui','Plan respecté',SA_ICO.oui)
    +bouton(false,'Non','Plan non respecté',SA_ICO.non)
    +'<i class="sa-vl sa-vl2" aria-hidden="true"></i>'
    +'<div class="sa-anneau"><svg viewBox="0 0 100 100" aria-hidden="true">'
      +'<circle cx="50" cy="50" r="42" class="sa-an-f"/>'
      +'<circle cx="50" cy="50" r="42" class="sa-an-p" stroke-dasharray="'+(C*tenus/7).toFixed(1)+' '+C.toFixed(1)+'"/></svg>'
      +'<div class="sa-an-c"><strong>'+tenus+'<small>/7</small></strong><span>Cette semaine</span></div></div>'
    +'<i class="sa-hl" aria-hidden="true"></i>'
    +pastilles
    +'<i class="sa-vl sa-vl3" aria-hidden="true"></i>'
    +'<button type="button" class="sa-voir" onclick="saVoirSuivi()">'+SA_ICO.histo
      +'<span>Voir mon suivi</span>'+SA_ICO.droite+'</button>'
    +'</div></section>';
}
// « VOIR MON SUIVI » : quatre semaines, jour par jour, et leur taux. Les
// memes pastilles que la carte, et chacune mene a son jour.
function saVoirSuivi(){
  const u=currentUser, auj=localISODate(new Date());
  const jours=saJours(28);
  const rep=jours.filter(j=>{ const e=saEtatJour(u,j.iso,auj); return e==='oui'||e==='non'; });
  const oui=jours.filter(j=>saEtatJour(u,j.iso,auj)==='oui').length;
  const grille=jours.map(j=>{
    const e=saEtatJour(u,j.iso,auj);
    return '<button type="button" class="sa-j" onclick="sanFermer();setStrictJour(\''+(j.iso===auj?'':j.iso)+'\')"'
      +' aria-label="'+escapeHtml(j.d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}))+'">'
      +_saPastille(e)+'<span>'+j.d.getDate()+'</span></button>';
  }).join('');
  _sanFeuille('Mon suivi alimentaire',
    '<div class="sa-bilan"><strong>'+oui+'<small>/'+(rep.length||0)+'</small></strong>'
      +'<span>jours où tu as respecté ton plan, sur les jours renseignés des 4 dernières semaines</span></div>'
    +'<div class="sa-grille">'+grille+'</div>'
    +'<div class="san-aide" style="margin-top:10px">Touche un jour pour y répondre ou corriger ta réponse.</div>');
}
function setNutriRespected(key,val){
  if(!currentUser.nutrition) currentUser.nutrition={};
  if(!currentUser.nutrition.days) currentUser.nutrition.days={};
  if(!currentUser.nutrition.days[key]) currentUser.nutrition.days[key]={};
  currentUser.nutrition.days[key].respected=val;
  saveUser();
  const dt=typeDiete(currentUser.nutrition);
  if(dt==='strict') _renderStrictDiet();
}

// ══════════════════ DIÈTE STRICTE : LE PLAN DU COACH ══════════════════════
// Jusqu'ici, « diète stricte » voulait dire : le coach photographie son
// tableur et l'athlète lit l'image. Tout le travail du coach — le squelette de
// repas, et surtout les listes de sources interchangeables dont le grammage
// s'ajuste pour retomber sur les mêmes macros — restait dans un fichier .ods
// sur son ordinateur. Ce module le porte dans l'application.
//
// CE QU'IL NE FAIT PAS. Il ne recalcule aucune calorie. Les cibles viennent de
// nutrition.macros, c'est-à-dire du moteur déjà en place (Mifflin-St Jeor ou
// Katch-McArdle, NEAT, g/kg de protéines et de lipides), validé par le coach
// sur sa fiche client. Le tableur, lui, part de Harris-Benedict et d'une
// répartition en pourcentages. Porter cette seconde formule ici aurait donné
// deux chiffres différents pour le même athlète selon l'écran regardé — le
// coach sur sa fiche, l'athlète sur son plan. Un seul moteur, un seul chiffre.
//
// LES DEUX VOCABULAIRES SE CROISENT ICI, et c'est le piège du module : les
// objectifs enregistrés appellent les glucides « g » (nutrition.macros.g),
// Ciqual les appelle « c ». Tout ce fichier parle Ciqual — p / c / l — et la
// traduction se fait dans planCiblesJour, à cet endroit-là et nulle part
// ailleurs.
const PLAN_V=1;
// Les repas du tableur, dans son ordre. Liste FERMÉE : une clé inconnue
// arrivant d'une version future se range en fin de plan plutôt que de faire
// disparaître la ligne.
const PLAN_REPAS=Object.freeze([
  Object.freeze({cle:'petit_dej',  lib:'Petit-déjeuner'}),
  Object.freeze({cle:'collation1', lib:'Collation 1'}),
  Object.freeze({cle:'midi',       lib:'Repas du midi'}),
  Object.freeze({cle:'avant',      lib:'Avant séance'}),
  Object.freeze({cle:'pendant',    lib:'Pendant la séance'}),
  Object.freeze({cle:'apres',      lib:'Après séance'}),
  // « Collation 2 » passe AVANT le repas du soir : c'est une collation d'
  // après-midi, pas d'après-dîner. Demande de Kevin, qui lit ce plan tous les
  // jours. Le repas d'avant-coucher, lui, reste le dernier.
  Object.freeze({cle:'collation2', lib:'Collation 2'}),
  Object.freeze({cle:'soir',       lib:'Repas du soir'}),
  // Absent des tableurs, demandé après coup. Il se range en dernier parce que
  // l'ordre d'affichage du plan EST l'ordre de ce tableau, et qu'aucun repas ne
  // vient après celui-là dans la journée.
  Object.freeze({cle:'coucher',    lib:'Avant de se coucher'})
]);
function planLibRepas(cle){
  const r=PLAN_REPAS.find(x=>x.cle===cle);
  return r?r.lib:String(cle||'Repas');
}
// ── Le moment de la séance ────────────────────────────────────────────────
// Les trois repas de séance ne sont pas à une heure fixe : ils suivent
// l'entraînement. Qui s'entraîne le matin les prend avant midi, qui s'entraîne
// le soir les prend après le repas du soir. Ils se déplacent donc ENSEMBLE :
// séparer « Pendant » de son « Avant » et de son « Après » ne veut rien dire.
//
// Le vocabulaire est celui de _periSeanceCle (matin / apres-midi / soir), déjà
// employé par le repère péri-séance. Deux listes de moments qui divergeraient
// finiraient par se contredire sur le même écran.
const PLAN_SEANCE=Object.freeze(['avant','pendant','apres']);
// Le bloc se pose juste APRÈS ce repas-là. « apres-midi » redonne exactement
// l'ordre d'origine : c'est la valeur par défaut, donc aucun plan déjà composé
// ne bouge tant que le coach n'a rien choisi.
const PLAN_ANCRE_SEANCE=Object.freeze({'matin':'petit_dej','apres-midi':'midi','soir':'soir'});
const PLAN_MOMENT_DEFAUT='apres-midi';
const PLAN_MOMENTS=Object.freeze([
  Object.freeze({cle:'matin',      lib:'Matin'}),
  Object.freeze({cle:'apres-midi', lib:'Après-midi'}),
  Object.freeze({cle:'soir',       lib:'Soir'})
]);
function planMomentLib(cle){
  const m=PLAN_MOMENTS.find(x=>x.cle===cle);
  return m?m.lib:planMomentLib(PLAN_MOMENT_DEFAUT);
}
// PURE. L'ordre des repas pour un moment donné : la liste de base, le bloc
// séance retiré, puis réinséré derrière son ancre.
function planOrdreCles(moment){
  const m=PLAN_ANCRE_SEANCE[moment]?moment:PLAN_MOMENT_DEFAUT;
  const ancre=PLAN_ANCRE_SEANCE[m];
  const out=[];
  for(const r of PLAN_REPAS){
    if(PLAN_SEANCE.indexOf(r.cle)>=0) continue;
    out.push(r.cle);
    if(r.cle===ancre) out.push.apply(out,PLAN_SEANCE);
  }
  return out;
}
function planOrdreRepas(cle,moment){
  const i=planOrdreCles(moment).indexOf(cle);
  return i<0?PLAN_REPAS.length:i;
}
// Ce que le coach a choisi ; à défaut ce que l'athlète a répondu au
// questionnaire de départ ; à défaut l'ordre d'origine. Le coach n'a donc rien
// à saisir quand la réponse de l'athlète suffit, et il garde le dernier mot.
function planMoment(plan,user){
  const v=plan&&plan.momentSeance;
  if(PLAN_ANCRE_SEANCE[v]) return v;
  let q=null;
  try{ q=user?_periSeanceCle(user):null; }catch(e){}
  return PLAN_ANCRE_SEANCE[q]?q:PLAN_MOMENT_DEFAUT;
}
// ── Ce que Ciqual ne sait pas dire ────────────────────────────────────────
// La table Anses donne des grammes pour 100 g, et rien d'autre. Un œuf, un
// scoop de whey ou un petit yaourt ne s'y expriment pas : leurs macros sont
// données PAR PIÈCE dans les tableurs du coach, colonne « POUR 100 g OU
// 1 UNITÉ ». Elles vivent donc ici, et le coach peut les écraser ligne par
// ligne — un scoop ne fait pas le même poids d'une marque à l'autre.
//
// « comp » marque les lignes de complément : elles n'apparaissent que si le
// plan est en version « avec compléments ». C'est le seul effet de cet
// interrupteur, exactement comme dans les tableurs, où les deux versions d'un
// même programme ne diffèrent que par ces lignes-là.
const PLAN_PORTIONS=Object.freeze({
  // Œuf : la valeur Ciqual de « Œuf cru » (12,8 / 0,06 / 9,83 pour 100 g)
  // ramenée à un œuf moyen de 50 g. Le tableur écrivait 6 / 0 / 5 — même
  // chose à un dixième près, mais celle-ci est traçable.
  oeuf:      Object.freeze({lib:'Œuf entier',     u:'œuf',    p:6.4, c:0.03, l:4.92}),
  yaourt:    Object.freeze({lib:'Petit yaourt',   u:'yaourt', p:5.4, c:5,    l:3.8}),
  whey:      Object.freeze({lib:'Whey isolate',   u:'scoop',  p:25,  c:1.6,  l:1,  comp:true}),
  creme_riz: Object.freeze({lib:'Crème de riz',   u:'scoop',  p:0,   c:37,   l:0}),
  malto:     Object.freeze({lib:'Maltodextrine',  u:'scoop',  p:0,   c:47.5, l:0,  comp:true}),
  omega3:    Object.freeze({lib:'Oméga 3',        u:'gélule', p:0,   c:0,    l:0,  comp:true}),
  multivit:  Object.freeze({lib:'Multivitamine',  u:'dose',   p:0,   c:0,    l:0,  comp:true}),
  creatine:  Object.freeze({lib:'Créatine',       u:'g',      p:0,   c:0,    l:0,  comp:true}),
  collagene: Object.freeze({lib:'Collagène',      u:'g',      p:0,   c:0,    l:0,  comp:true}),
  // En grammes, donc comptées pour 100 g comme n'importe quel aliment. Elle
  // est ici et non prise dans Ciqual pour une seule raison : c'est la ligne
  // dont le tableur calcule la quantité par paliers de poids, et
  // amandesSuggerees a besoin de la reconnaître pour proposer ce nombre.
  // Les valeurs, elles, sont bien celles de Ciqual (« Amande, émondée, sans
  // sel ajouté », 15041) et non celles du tableur.
  amandes:   Object.freeze({lib:'Amandes',        u:'g',      p:21.4,c:8.76, l:52.5})
});
// Une unité en grammes ou en millilitres se compte POUR 100 ; tout le reste se
// compte à la pièce. Une seule règle, lisible, plutôt qu'un drapeau à tenir à
// jour sur chaque ligne.
function planParUnite(u){
  const s=String(u==null?'g':u).trim().toLowerCase();
  return s!=='g'&&s!=='ml'&&s!=='gr'&&s!=='grammes'&&s!=='millilitres';
}
// ⚠ LA PERIODISATION A ETE RETIREE le 08/09/2026, ET C'EST LE MEME CORRECTIF
// QUE LA VITESSE VISEE LA VEILLE : un second moteur, branche par-dessus le
// premier.
//
// Kevin, captures a l'appui : « le seul calcul qui compte est celui des
// tableaux du coach ; les resultats doivent etre ceux qui apparaissent dans
// l'apercu du plan ». Or le palier multipliait la cible de la fiche une
// SECONDE fois — le coefficient d'objectif de la seche (0,85) puis le palier
// (0,85) font 68 % de la depense, et rien a l'ecran ne montrait le produit.
//
// LE 08/09/2026 AU MATIN, LES MULTIPLICATEURS PAR DEFAUT ETAIENT PASSES A 1.
// Ca ne suffisait pas : les plans deja composes portaient leurs propres
// paliers dans plan.phases et continuaient de couper. Un reglage qui ne peut
// plus etre juste ne se met pas a 1, il se retire.
//
// LES DONNEES NE SONT PAS EFFACEES : un `plan.phases` deja enregistre reste au
// dossier, simplement plus rien ne le lit. On ne reecrit pas les dossiers
// d'autrui pour un reglage d'affichage.
const PLAN_SOURCES_DEFAUT=2;
const PLAN_SOURCES_MAX=8;
// Au-delà, une source ne peut plus raisonnablement couvrir sa part : 1,8 kg de
// fromage blanc en un repas n'est pas une consigne, c'est un symptôme. On
// l'affiche quand même — masquer le chiffre cacherait le problème — mais on
// le dit.
const PLAN_QTE_ALERTE=1500;
const PLAN_JOURS_SEMAINE=7;
const PLAN_NOTE_CUISSON='Les quantités sont à peser CRUES. Cuisson al dente '
  +'de préférence : des pâtes trop cuites ont un index glycémique plus élevé '
  +'que les mêmes pâtes al dente.';
const PLAN_NOTE_CHEATMEAL=Object.freeze([
  'Un seul cheatmeal par semaine : un repas avec les aliments habituellement proscrits.',
  'Favoriser les cheatmeals salés : pâtes bolognaise, pizza, burger (plutôt que sucrés).'
]);
const PLAN_NOTE_INDICATIF='Ce programme alimentaire est proposé à titre '
  +'indicatif, en tant qu\'exemple adapté à tes besoins.';

// ══════════ LES CATALOGUES DU COACH, RATTACHÉS À CIQUAL ═══════════════════
// Les cinquante sources des tableurs .ods, rattachées une par une aux entrées
// Anses. TOUT EST EN CRU OU EN SEC : c'est la consigne même du tableur
// (« les quantités sont à peser CRUES »), et huit de ses lignes de glucides
// portaient pourtant une valeur d'aliment cuit. Les remettre en sec rend la
// liste homogène — l'athlète pèse toujours avant cuisson — et divise les
// portions de légumineuses par environ deux et demi.
//
// Restent en cuit les seules préparations qui n'existent pas autrement :
// patate douce au four, frites, chips.
//
// « Le riz brun » a disparu de la liste : une fois les deux ramenés au cru,
// c'est le même aliment que « Le riz complet ».
const PLAN_CAT_PROTEINES=Object.freeze([
  Object.freeze({lib:'Farine d\'amande déshuilée',p:52,hors:true}), // rien d'équivalent chez Anses
  28812,   // Jambon sec — 28,7
  26053,   // Thon, cru — 24,0
  20515,   // Pois cassé, sec — 23,8
  26034,   // Sardine, à l'huile, appertisée, égouttée — 23,3 (n'existe pas crue en boîte)
  26180,   // Thon à l'huile de tournesol, appertisé, égoutté — 23,3
  26037,   // Saumon fumé — 22,2 (fumé par nature)
  6250,    // Bœuf, steak haché 5% MG cru — 21,9
  15041,   // Amande, émondée, sans sel ajouté — 21,4
  6002,    // Bœuf, épaule crue — 21,4
  28204,   // Porc, filet mignon cru — 21,2
  36003,   // Poulet, viande crue — 20,9
  20516,   // Pois chiche, sec — 20,5
  15034,   // Lin, graine — 19,0
  15044,   // Pistache, grillée, sans sel ajouté — 18,4
  40106,   // Foie, veau, cru — 15,5
  22000,   // Œuf cru — 12,8
  32140,   // Flocons d'avoine — 10,6
  20359,   // Lentille, sèche (aliment moyen) — 25,1
  19644    // Fromage blanc, nature, 0% MG — 7,3
]);
const PLAN_CAT_GLUCIDES=Object.freeze([
  9119,    // Riz thaï ou basmati, cru — 78,4
  7352,    // Galette de riz complet soufflé — 77,9
  9614,    // Polenta ou semoule de maïs, précuite, à cuire — 74,0
  9102,    // Riz complet, cru — 71,4
  9080,    // Blé dur complet, précuit, à cuire — 67,7
  9870,    // Pâtes sèches, au blé complet, crues — 67,6
  9690,    // Boulgour de blé, cru — 65,8
  9415,    // Farine de blé tendre ou froment T150 — 64,9
  13011,   // Datte, chair et peau, sans noyau, sèche — 64,7
  Object.freeze({lib:'Spaghetti de pois chiches',c:60,hors:true}),
  9340,    // Quinoa, cru — 58,1
  32140,   // Flocons d'avoine — 57,7
  7815,    // Tortilla souple (à garnir), à base de blé — 53,0 (pas de version complète)
  20516,   // Pois chiche, sec — 47,5
  20515,   // Pois cassé, sec — 47,5
  20525,   // Haricot rouge, sec — 46,1
  20359,   // Lentille, sèche (aliment moyen) — 44,5
  7110,    // Pain complet ou intégral (T150) — 41,2
  20518,   // Fève, sèche — 33,3
  53100,   // Banane plantain, crue — 29,6
  20812,   // Farine de pulpe de patate douce — 50,1
  13005,   // Banane, chair sans peau, crue — 19,7
  4101,    // Patate douce, crue — 17,1
  4008,    // Pomme de terre, sans peau, crue — 16,2
  // Les quatre préparations de l'encadré « si vous disposez d'un Airfryer ».
  // Elles n'existent que cuites, donc elles restent cuites.
  4102,    // Patate douce, cuite (au four) — 16,3
  4027,    // Pomme de terre sautée/rissolée, préfrite, surgelée, cuite — 23,0
  Object.freeze({lib:'Frites de patate douce (maison)',c:20,hors:true}),
  Object.freeze({lib:'Chips de légumes faits maison',c:18,hors:true})
]);

// ══════════ LA TABLE DES FRUITS ═══════════════════════════════════════════
// Reprise TELLE QUELLE du tableur, sur demande du coach. Aucun calcul : ce
// sont des équivalences de portion, les mêmes pour tout le monde et dans tous
// les programmes. Elle s'affiche sous les sources de glucides, là où le
// tableur la place, et la ligne « une portion de fruit au choix » du
// squelette y renvoie.
const PLAN_FRUITS=Object.freeze([
  Object.freeze({n:'Banane',       q:'1 petite banane (env. 90 g)'}),
  Object.freeze({n:'Pomme',        q:'1 petite pomme (env. 130 g)'}),
  Object.freeze({n:'Orange',       q:'1 orange moyenne (env. 160 g)'}),
  Object.freeze({n:'Raisin',       q:'30 à 35 raisins (~95 g)'}),
  Object.freeze({n:'Mangue',       q:'1/2 mangue moyenne (env. 110 g)'}),
  Object.freeze({n:'Ananas',       q:'2 tranches moyennes (~120 g)'}),
  Object.freeze({n:'Pêche',        q:'1 grande pêche (env. 140 g)'}),
  Object.freeze({n:'Poire',        q:'1 petite poire (env. 130 g)'}),
  Object.freeze({n:'Kiwi',         q:'2 kiwis moyens (~130 g)'}),
  Object.freeze({n:'Cerises',      q:'environ 15 cerises (~110 g)'}),
  Object.freeze({n:'Fraises',      q:'250 g'}),
  Object.freeze({n:'Framboises',   q:'300 g'}),
  Object.freeze({n:'Myrtilles',    q:'140 g'}),
  Object.freeze({n:'Melon (cantaloup)',q:'1/4 de melon (~160 g)'}),
  Object.freeze({n:'Pastèque',     q:'1/8 de pastèque (~300 g)'}),
  Object.freeze({n:'Nectarine',    q:'1 grosse nectarine (~150 g)'}),
  Object.freeze({n:'Abricots',     q:'3 gros abricots (~130 g)'}),
  Object.freeze({n:'Prunes',       q:'2 à 3 prunes moyennes (~130 g)'}),
  Object.freeze({n:'Groseilles',   q:'250 g'}),
  Object.freeze({n:'Pamplemousse', q:'1/2 pamplemousse (~180 g)'})
]);

// ══════════ LES PRÉ-MODÈLES ═══════════════════════════════════════════════
// Les squelettes des quatre tableurs, ligne par ligne et dans leur ordre.
// « c » marque une ligne de complément : elle ne s'affiche qu'en version avec
// compléments, et c'est le seul effet de cet interrupteur — exactement comme
// entre les deux versions d'un même tableur.
//
// IL N'Y A PAS DE MODÈLE DE SÈCHE FEMME : le tableur correspondant n'existe
// pas encore. L'écran de composition le dit au lieu de servir en silence un
// modèle d'homme.
// Trois marques, et chacune correspond à une différence RÉELLE entre les deux
// tableurs d'une même paire :
//   comp      la ligne est un complément ; en version sans, elle est remplacée
//             par son substitut, ou retirée s'il n'y en a pas ;
//   avecSeul  la ligne n'existe que dans la version avec (les amandes, que le
//             coach retire pour compenser le lait protéiné ajouté) ;
//   sansSeul  la ligne n'existe que dans la version sans (les dattes séchées
//             pendant la séance, qui remplacent les glucides de la malto) ;
//   noteSans  le texte de la note change (« Sous forme de SHAKER » devient
//             « Dans un bol mélanger » quand il n'y a plus de poudre).
const _L={
  note:(r,t,ts)=>({r,note:t,noteSans:ts||null}),
  fruit:(r)=>({r,fruit:true}),
  srcP:(r)=>({r,src:'p'}),
  srcC:(r)=>({r,src:'c'}),
  ciq:(r,id,q,o)=>Object.assign({r,ciqual:id,q,u:'g'},o||{}),
  por:(r,p,q,o)=>Object.assign({r,portion:p,q},o||{}),
  auto:(r,p,a,o)=>Object.assign({r,portion:p,auto:a},o||{}),
  lib:(r,n,q,u,p,g,l,o)=>Object.assign({r,libre:n,q,u,p,c:g,l},o||{})
};
const _C={comp:true},_AV={avecSeul:true},_SA={sansSeul:true},_CAV={comp:true};
// Les lignes communes aux quatre modèles : midi et soir sont toujours bâtis
// autour des deux sources au choix. C'est LE motif du tableur.
function _planRepasSource(r,huile,legumes){
  const out=[_L.srcP(r),_L.srcC(r)];
  if(huile) out.push(_L.ciq(r,17130,huile));            // Huile de colza
  if(legumes) out.push(_L.lib(r,'Un bol de légumes',legumes,'g',1,4,0));
  out.push(_L.por(r,'creatine',2,_C));
  return out;
}
const PLAN_MODELES=Object.freeze({
  // ── SÈCHE HOMME ────────────────────────────────────────────────────────
  seche_H:Object.freeze([].concat(
    [_L.note('petit_dej','Sous forme de PANCAKES'),
     _L.auto('petit_dej','oeuf','oeufs'),
     _L.ciq('petit_dej',19644,250),                     // Fromage blanc 0%
     _L.note('petit_dej','À consommer à côté'),
     _L.por('petit_dej','omega3',2,_C),
     _L.por('petit_dej','multivit',1,_C)],
    [_L.fruit('collation1'),
     _L.por('collation1','whey',1,_C),
     _L.auto('collation1','amandes','amandes',_AV),
     _L.por('collation1','yaourt',6)],
    _planRepasSource('midi',10,200),
    [_L.note('avant','Sous forme de SHAKER','Dans un bol mélanger'),
     _L.por('avant','whey',1,_C),
     _L.por('avant','creme_riz',1,_C),
     _L.ciq('avant',31008,30)],                         // Miel
    [_L.note('pendant','Dans une gourde de 1,5 L d\'eau'),
     _L.por('pendant','malto',1,_C),
     _L.lib('pendant','Sel iodé',1,'pincée',0,0,0)],
    _planRepasSource('soir',10,200),
    [_L.ciq('soir',19644,250)]                          // Fromage blanc du soir
  )),
  // ── SÈCHE FEMME ────────────────────────────────────────────────────────
  // Deux différences avec le modèle homme, relevées dans le tableur : le lait
  // protéiné y est à 400 mL et non 500, et il n'y a pas de maltodextrine du
  // tout — le Pulco citron est là dans les deux versions.
  seche_F:Object.freeze([].concat(
    [_L.note('petit_dej','Sous forme de PANCAKES'),
     _L.auto('petit_dej','oeuf','oeufs'),
     _L.ciq('petit_dej',19644,150),
     _L.note('petit_dej','À consommer à côté'),
     _L.por('petit_dej','omega3',2,_C),
     _L.por('petit_dej','multivit',1,_C)],
    [_L.fruit('collation1'),
     _L.por('collation1','whey',1,{comp:true,sub:{libre:'Lait protéiné (soja)',q:400,u:'mL',p:5,c:2.5,l:1.8}}),
     _L.auto('collation1','amandes','amandes'),
     _L.por('collation1','yaourt',3,_AV)],
    _planRepasSource('midi',0,150),
    [_L.note('avant','Sous forme de SHAKER','Dans un bol mélanger'),
     _L.por('avant','whey',1,{comp:true,sub:{libre:'Lait protéiné (soja)',q:400,u:'mL',p:5,c:2.5,l:1.8}}),
     _L.por('avant','creme_riz',1,_C)],
    [_L.note('pendant','Dans une gourde de 1,5 L d\'eau'),
     _L.lib('pendant','Pulco citron',200,'mL',0.2,1.6,0),
     _L.lib('pendant','Sel iodé',1,'pincée',0,0,0)],
    _planRepasSource('soir',15,150)
  )),
  // ── PRISE DE MASSE HOMME ───────────────────────────────────────────────
  masse_H:Object.freeze([].concat(
    [_L.note('petit_dej','Sous forme de PANCAKES'),
     _L.auto('petit_dej','oeuf','oeufs'),
     _L.ciq('petit_dej',19644,250),
     _L.por('petit_dej','creme_riz',1,_C),
     _L.note('petit_dej','À consommer à côté'),
     _L.por('petit_dej','omega3',2,_C),
     _L.por('petit_dej','multivit',1,_C),
     _L.fruit('petit_dej')],
    [_L.por('collation1','whey',1,_C),
     _L.auto('collation1','amandes','amandes',_AV),
     _L.por('collation1','yaourt',6)],
    _planRepasSource('midi',10,150),
    [_L.note('avant','Sous forme de SHAKER','Dans un bol mélanger'),
     _L.por('avant','whey',1,_C),
     _L.por('avant','creme_riz',1.5,_C),
     _L.ciq('avant',31008,30)],
    [_L.note('pendant','Dans une gourde de 1,5 L d\'eau'),
     _L.por('pendant','malto',2,_C),
     _L.lib('pendant','Sel iodé',1,'pincée',0,0,0),
     _L.ciq('pendant',13011,25,_SA)],                   // Dattes séchées ~5
    _planRepasSource('soir',10,150)
  )),
  // ── PRISE DE MASSE FEMME ───────────────────────────────────────────────
  masse_F:Object.freeze([].concat(
    [_L.note('petit_dej','Sous forme de PANCAKES'),
     _L.auto('petit_dej','oeuf','oeufs'),
     _L.ciq('petit_dej',19644,150),
     _L.por('petit_dej','creme_riz',1,_C),
     _L.note('petit_dej','À consommer à côté'),
     _L.por('petit_dej','omega3',2,_C),
     _L.por('petit_dej','multivit',1,_C),
     _L.fruit('petit_dej')],
    [_L.por('collation1','whey',1,_C),
     _L.auto('collation1','amandes','amandes',_AV),
     _L.por('collation1','yaourt',3)],
    _planRepasSource('midi',15,150),
    [_L.note('avant','Sous forme de SHAKER','Dans un bol mélanger'),
     _L.por('avant','whey',1,_C),
     _L.por('avant','creme_riz',1,_C),
     _L.ciq('avant',31008,20)],
    [_L.note('pendant','Dans une gourde de 1,5 L d\'eau'),
     _L.por('pendant','malto',1,_C),
     _L.lib('pendant','Sel iodé',1,'pincée',0,0,0),
     _L.ciq('pendant',13011,15,_SA)],                   // Dattes séchées ~3
    _planRepasSource('soir',0,150)
  )),
  // ══ RECOMPOSITION ══════════════════════════════════════════════════════
  // Demande de Kevin, 08/09/2026 : « genere-moi deux nouveaux modeles pour la
  // recompo, un pour le maintien et un pour la peak week ».
  //
  // ⚠ CE QU'UN MODELE EST, ET CE QU'IL N'EST PAS. Il ne fixe AUCUN gramme :
  // les quantites des deux sources au choix sortent des cibles du coach, par
  // planGrammage. Un modele decrit un SQUELETTE — quels repas, ou tombent les
  // sources libres, quels complements — et rien d'autre. C'est pour cela qu'on
  // peut en ajouter sans toucher au calcul.
  //
  // LA RECOMPOSITION EMPRUNTE LA STRUCTURE DE LA SECHE, avec deux differences
  // assumees : un fruit au petit-dejeuner, et pas de maltodextrine pendant la
  // seance. On mange autour de son entretien — il n'y a ni deficit a proteger
  // ni surplus a placer, donc rien qui justifie de charger l'intra-seance.
  recomp_H:Object.freeze([].concat(
    [_L.note('petit_dej','Sous forme de PANCAKES'),
     _L.auto('petit_dej','oeuf','oeufs'),
     _L.ciq('petit_dej',19644,250),                     // Fromage blanc 0%
     _L.fruit('petit_dej'),
     _L.note('petit_dej','À consommer à côté'),
     _L.por('petit_dej','omega3',2,_C),
     _L.por('petit_dej','multivit',1,_C)],
    [_L.fruit('collation1'),
     _L.por('collation1','whey',1,_C),
     _L.auto('collation1','amandes','amandes',_AV),
     _L.por('collation1','yaourt',6)],
    _planRepasSource('midi',10,200),
    [_L.note('avant','Sous forme de SHAKER','Dans un bol mélanger'),
     _L.por('avant','whey',1,_C),
     _L.ciq('avant',31008,20)],                         // Miel
    [_L.note('pendant','Dans une gourde de 1,5 L d\'eau'),
     _L.lib('pendant','Sel iodé',1,'pincée',0,0,0)],
    _planRepasSource('soir',10,200)
  )),
  recomp_F:Object.freeze([].concat(
    [_L.note('petit_dej','Sous forme de PANCAKES'),
     _L.auto('petit_dej','oeuf','oeufs'),
     _L.ciq('petit_dej',19644,150),
     _L.fruit('petit_dej'),
     _L.note('petit_dej','À consommer à côté'),
     _L.por('petit_dej','omega3',2,_C),
     _L.por('petit_dej','multivit',1,_C)],
    [_L.fruit('collation1'),
     _L.por('collation1','whey',1,{comp:true,sub:{libre:'Lait protéiné (soja)',q:400,u:'mL',p:5,c:2.5,l:1.8}}),
     _L.auto('collation1','amandes','amandes'),
     _L.por('collation1','yaourt',3,_AV)],
    _planRepasSource('midi',0,150),
    [_L.note('avant','Sous forme de SHAKER','Dans un bol mélanger'),
     _L.por('avant','whey',1,{comp:true,sub:{libre:'Lait protéiné (soja)',q:400,u:'mL',p:5,c:2.5,l:1.8}})],
    [_L.note('pendant','Dans une gourde de 1,5 L d\'eau'),
     _L.lib('pendant','Sel iodé',1,'pincée',0,0,0)],
    _planRepasSource('soir',15,150)
  )),
  // ══ MAINTIEN ═══════════════════════════════════════════════════════════
  // LE SQUELETTE LE PLUS COURT DES SIX, et c'est le sujet : on entretient.
  // Quatre prises, pas d'avant ni de pendant-seance — la collation et les deux
  // repas a source libre couvrent la journee. Un athlete en maintien qui
  // recoit six prises a preparer abandonne le plan en trois semaines.
  maintien_H:Object.freeze([].concat(
    [_L.note('petit_dej','Sous forme de PANCAKES'),
     _L.auto('petit_dej','oeuf','oeufs'),
     _L.ciq('petit_dej',19644,250),
     _L.fruit('petit_dej'),
     _L.note('petit_dej','À consommer à côté'),
     _L.por('petit_dej','omega3',2,_C),
     _L.por('petit_dej','multivit',1,_C)],
    [_L.fruit('collation1'),
     _L.auto('collation1','amandes','amandes'),
     _L.por('collation1','yaourt',6)],
    _planRepasSource('midi',10,200),
    _planRepasSource('soir',10,200)
  )),
  maintien_F:Object.freeze([].concat(
    [_L.note('petit_dej','Sous forme de PANCAKES'),
     _L.auto('petit_dej','oeuf','oeufs'),
     _L.ciq('petit_dej',19644,150),
     _L.fruit('petit_dej'),
     _L.note('petit_dej','À consommer à côté'),
     _L.por('petit_dej','omega3',2,_C),
     _L.por('petit_dej','multivit',1,_C)],
    [_L.fruit('collation1'),
     _L.auto('collation1','amandes','amandes'),
     _L.por('collation1','yaourt',3)],
    _planRepasSource('midi',0,150),
    _planRepasSource('soir',15,150)
  )),
  // ══ PEAK WEEK ══════════════════════════════════════════════════════════
  //
  // ⚠ CE MODELE NE PORTE AUCUN PROTOCOLE, ET C'EST SA SEULE REGLE.
  // Pas de charge en glucides chiffree, pas de manipulation de l'eau, pas de
  // manipulation du sodium, pas de dessiccation. Il donne au coach un
  // squelette PROPRE pour la semaine de scene — quatre prises simples, les
  // deux sources au choix aux grammages qu'il aura fixes lui-meme — et rien
  // d'autre. Le protocole appartient au coach, qui est dans la salle avec son
  // athlete. Voir le commentaire de PHASES.peak, qui dit la meme chose de la
  // phase, et l'assertion « La peak week ne porte AUCUN protocole ».
  //
  // ⚠ LA PINCEE DE SEL EST CONSERVEE, et c'est deliberé : la RETIRER serait
  // deja une consigne — « coupe le sel » — c'est-a-dire exactement ce que ce
  // modele s'interdit. Elle est dans les six modeles, elle reste dans
  // celui-ci.
  peak_H:Object.freeze([].concat(
    [_L.note('petit_dej','Sous forme de PANCAKES'),
     _L.auto('petit_dej','oeuf','oeufs'),
     _L.ciq('petit_dej',19644,250),
     _L.note('petit_dej','À consommer à côté'),
     _L.por('petit_dej','omega3',2,_C),
     _L.por('petit_dej','multivit',1,_C)],
    [_L.fruit('collation1'),
     _L.por('collation1','yaourt',6)],
    _planRepasSource('midi',10,200),
    [_L.note('pendant','Dans une gourde de 1,5 L d\'eau'),
     _L.lib('pendant','Sel iodé',1,'pincée',0,0,0)],
    _planRepasSource('soir',10,200)
  )),
  peak_F:Object.freeze([].concat(
    [_L.note('petit_dej','Sous forme de PANCAKES'),
     _L.auto('petit_dej','oeuf','oeufs'),
     _L.ciq('petit_dej',19644,150),
     _L.note('petit_dej','À consommer à côté'),
     _L.por('petit_dej','omega3',2,_C),
     _L.por('petit_dej','multivit',1,_C)],
    [_L.fruit('collation1'),
     _L.por('collation1','yaourt',3)],
    _planRepasSource('midi',0,150),
    [_L.note('pendant','Dans une gourde de 1,5 L d\'eau'),
     _L.lib('pendant','Sel iodé',1,'pincée',0,0,0)],
    _planRepasSource('soir',15,150)
  ))
});
// Les substitutions de la version SANS compléments, relevées entre les deux
// tableurs de chaque paire : là où le coach retire la whey, il met du lait
// protéiné ; là où il retire la crème de riz et la maltodextrine, il met des
// flocons d'avoine et du Pulco citron. Ce n'est donc pas « masquer les lignes
// de complément », c'est les REMPLACER — et l'apport reste couvert.
const PLAN_SUBSTITUTS_SANS_COMP=Object.freeze({
  whey:      Object.freeze({libre:'Lait protéiné (soja)',q:500,u:'mL',p:5,c:2.5,l:1.8}),
  creme_riz: Object.freeze({ciqual:32140,q:60,u:'g'}),        // Flocons d'avoine
  malto:     Object.freeze({libre:'Pulco citron',q:200,u:'mL',p:0.2,c:1.6,l:0}),
  omega3:    null, multivit:null, creatine:null, collagene:null
});
// Une note sans rien en dessous est un titre qui ne titre plus rien : elle
// arrive quand la version sans compléments vide le groupe qu'elle annonçait
// (« À consommer à côté » au-dessus de l'oméga 3 et de la multivitamine).
function _planNettoyerNotes(sq){
  const garder=[];
  for(let i=0;i<sq.length;i++){
    const it=sq[i];
    if(it.note==null){ garder.push(it); continue; }
    let utile=false;
    for(let j=i+1;j<sq.length;j++){
      if(sq[j].repas!==it.repas) break;
      if(sq[j].note!=null) break;
      utile=true; break;
    }
    if(utile) garder.push(it);
  }
  return garder;
}

// Quel modèle pour cet athlète ? Rend null quand il n'y en a pas — et c'est
// un état parfaitement valide, que l'écran doit nommer.
function planModeleCle(user){
  return planModeleSuggere(user).cle;
}
// La phase déclarée n'est PAS toujours là, et quand elle l'est elle ne dit pas
// toujours sèche ou masse : recomposition et maintien sont des phases
// parfaitement valides pour lesquelles il n'existe aucun tableur. Un écran de
// composition vide en face d'un coach qui attend son modèle est une panne,
// pas une position prudente.
//
// On cherche donc plus loin : la phase d'abord, puis l'objectif écrit dans le
// profil ou relevé au bilan de départ. Et on DIT d'où vient la déduction —
// « d'après son objectif » ne vaut pas « d'après sa phase », et le coach doit
// pouvoir corriger en connaissance de cause.
const PLAN_MOTS_SECHE=/s[eè]ch|perte de poids|maigrir|affiner|perdre du gras|d[eé]finition/i;
const PLAN_MOTS_MASSE=/prise de (masse|muscle)|prise de poids|masse|volume|grossir|prendre du muscle/i;
function _planNormObjectif(user){
  const u=user||{};
  return [u.objective,u.bilanGoals].filter(Boolean).join(' ');
}
function planModeleSuggere(user){
  const f=_planFemme(user);
  const pour=(fam)=>fam+'_'+(f?'F':'H');
  let t=null;
  try{ t=typePhase(user); }catch(e){}
  // ⚠ LES CINQ PHASES ONT DESORMAIS LEUR MODELE (08/09/2026). Avant, seules
  // seche et masse en avaient une, et un athlete en recomposition, en maintien
  // ou en peak week tombait sur « il n'existe pas de tableur pour cette
  // phase » — un ecran de composition vide en face d'un coach qui attend son
  // modele. Le repli par objectif reste dessous : il sert aux dossiers sans
  // phase declaree.
  if(PLAN_MODELES[pour(t)]) return {cle:pour(t),source:'phase'};
  const o=_planNormObjectif(user);
  if(o){
    // La sèche est testée en premier : « perte de poids et prise de muscle »
    // est une réponse courante au bilan, et c'est la restriction qui pilote
    // la structure du plan.
    if(PLAN_MOTS_SECHE.test(o)) return {cle:pour('seche'),source:'objectif'};
    if(PLAN_MOTS_MASSE.test(o)) return {cle:pour('masse'),source:'objectif'};
  }
  return {cle:null,source:null};
}
// La famille d'un modèle, deduite de sa clef : « seche_H » donne « seche ».
// ⚠ ELLE NE CHOISIT PLUS UNE ECHELLE DE PALIERS depuis le 08/09/2026 — la
// periodisation a ete retiree — mais elle porte toujours le LIBELLE lu a
// l'ecran, et c'est desormais PLAN_MODELE_LIB qui dit ce qui est une famille.
function planModeleFamille(cle){
  const i=String(cle||'').lastIndexOf('_');
  const fam=i>0?String(cle).slice(0,i):'';
  return PLAN_MODELE_LIB[fam]?fam:null;
}
const PLAN_MODELE_LIB=Object.freeze({
  seche:'Sèche', masse:'Prise de masse', recomp:'Recomposition',
  maintien:'Maintien', peak:'Peak week'
});
function planModeleLib(cle){
  const fam=planModeleFamille(cle);
  if(!fam||!PLAN_MODELE_LIB[fam]) return '';
  return PLAN_MODELE_LIB[fam]+' '+(String(cle).slice(-2)==='_F'?'femme':'homme');
}
// Construit un plan COMPLET depuis le modèle : squelette, catalogues, paliers.
// Rend null s'il n'y a pas de modèle pour cet athlète.
function planDepuisModele(user,avecComplements,cleForcee){
  const cle=cleForcee||planModeleCle(user);
  if(!cle||!PLAN_MODELES[cle]) return null;
  const poids=_planPoids(user),femme=_planFemme(user);
  const avec=!!avecComplements;
  let squelette=[];
  for(const m of PLAN_MODELES[cle]){
    let it=Object.assign({},m);
    const r=it.r; delete it.r; it.repas=r;
    if(it.avecSeul&&!avec) continue;
    if(it.sansSeul&&avec) continue;
    delete it.avecSeul; delete it.sansSeul;
    // La note change de texte quand la poudre disparaît.
    if(it.note!=null){
      if(!avec&&it.noteSans) it.note=it.noteSans;
      delete it.noteSans;
      squelette.push(it); continue;
    }
    // Version sans compléments : la ligne est REMPLACÉE quand le coach a un
    // substitut, retirée sinon.
    // Le substitut de la ligne prime sur celui de la table : le lait protéiné
    // est à 400 mL dans les tableurs femme et à 500 dans ceux d'homme.
    if(it.comp&&!avec){
      const sub=it.sub||PLAN_SUBSTITUTS_SANS_COMP[it.portion];
      if(!sub) continue;
      it=Object.assign({repas:r},sub);
    }
    delete it.sub;
    // Les deux lignes que le tableur chiffrait par paliers de poids.
    if(it.auto){
      const n=(it.auto==='oeufs')?oeufsSuggeres(poids,femme):amandesSuggerees(poids,femme);
      it.q=(n>0)?n:1;
      delete it.auto;
    }
    squelette.push(it);
  }
  squelette=_planNettoyerNotes(squelette);
  for(const it of squelette) it.id=_cplId();
  // ⚠ UN MODELE NE POSE PLUS DE PALIERS depuis le 08/09/2026 : ils
  // multipliaient la cible de la fiche une seconde fois. Un modele decrit un
  // SQUELETTE DE REPAS, les quantites viennent de planGrammage, et la cible du
  // calcul du coach — un seul endroit.
  return {v:PLAN_V,avecComplements:avec,nRepasSourcesLibres:null,
    squelette,
    sources:{proteines:PLAN_CAT_PROTEINES.slice(),glucides:PLAN_CAT_GLUCIDES.slice()},
    courses:{jours:{},stock:{}},modele:cle};
}

function _planNb(v){
  if(v==null||v==='') return null;
  const n=typeof v==='number'?v:parseFloat(String(v).replace(',','.'));
  return isFinite(n)?n:null;
}
// Lecture TOLÉRANTE, et c'est tout le contrat de compatibilité de ce module :
// un dossier sans plan rend null, et l'application se comporte exactement
// comme avant ce lot. Il n'y a pas de migration à jouer.
function planDe(porteur){
  const p=porteur&&porteur.nutrition&&porteur.nutrition.plan;
  if(!p||typeof p!=='object') return null;
  return p;
}
function planSquelette(plan){
  return (plan&&Array.isArray(plan.squelette))?plan.squelette.filter(Boolean):[];
}
function planCatalogue(plan,macro){
  const s=(plan&&plan.sources)||{};
  const l=(macro==='p')?s.proteines:s.glucides;
  return Array.isArray(l)?l.filter(x=>x!=null):[];
}
// Un plan « actif » porte au moins une ligne de squelette ou une source. Un
// objet vide créé par une sauvegarde ratée ne doit pas faire apparaître un
// écran de plan vide chez l'athlète.
function planActif(porteur){
  const p=planDe(porteur);
  if(!p) return false;
  return planSquelette(p).length>0
    ||planCatalogue(p,'p').length>0||planCatalogue(p,'c').length>0;
}
function _planCiqual(id){
  if(!Array.isArray(_ciqualDB)) return null;
  return _ciqualDB.find(f=>f&&f.id===id)||null;
}
// ⚠ L'ALIMENT D'UNE LIGNE, MÊME SANS LA BASE (30/09/2026). Chez l'athlète, le
//   plan se peint AVANT que Ciqual (873 Ko) soit chargé : ses aliments s'y
//   lisaient « Aliment introuvable (#19644) » et ne comptaient dans aucun
//   total — et hors ligne, sans la base en cache, ils y restaient. Le coach
//   enregistre donc avec chaque ligne une copie de ce qu'il a vu
//   (ciqualRef : nom, groupe, P/G/L pour 100 g). La base reste prioritaire :
//   la copie ne sert que quand elle manque.
function _planAlimentLigne(item,chercher){
  if(!item||item.ciqual==null) return null;
  const f=_planResolveur(chercher)(item.ciqual);
  if(f) return f;
  const r=item.ciqualRef;
  return (r&&typeof r==='object'&&r.n)?r:null;
}
// Le libellé d'un aliment qu'on ne sait pas nommer : la base arrive, elle est
// indisponible, ou l'aliment n'y est vraiment pas.
function _planLibIntrouvable(id){
  const charge=Array.isArray(_ciqualDB)&&_ciqualDB.length;
  if(!charge){
    let indispo=false; try{ indispo=ciqualIndisponible(); }catch(e){}
    return indispo?'Aliment #'+id+' (base d’aliments indisponible hors ligne)':'Aliment en cours de chargement…';
  }
  return 'Aliment introuvable (#'+id+')';
}
// La copie posée à l'enregistrement, sur chaque ligne Ciqual que la base connaît.
function planFigerAliments(plan){
  let n=0;
  for(const it of planSquelette(plan)){
    if(!it||it.ciqual==null) continue;
    const f=_planCiqual(it.ciqual);
    if(!f) continue;
    it.ciqualRef={n:String(f.n||''),g:String(f.g||''),p:_planNb(f.p),c:_planNb(f.c),l:_planNb(f.l)};
    n++;
  }
  return n;
}

// ══════════════ L'ACCÈS À LA DIÈTE STRICTE ════════════════════════════════
// La diète stricte n'est pas un mode de suivi qu'on choisit dans une liste :
// c'est un programme que le coach compose ligne par ligne pour UN athlète.
// Sans coach, il n'y a rien à afficher. Et un athlète dont le coach n'a pas
// encore ouvert l'accès verrait un écran vide qu'il prendrait pour une panne.
// Dans les deux cas l'écran se verrouille, et il DIT lequel des deux cas
// s'applique — un verrou muet est le pire des deux mondes.
//
// LA COMPATIBILITÉ EST LE POINT DÉLICAT. Le champ n'existe dans aucun dossier
// aujourd'hui : le lire comme « non validé » couperait d'un coup l'accès à
// tous les athlètes qui suivent déjà une diète stricte. Absent vaut donc
// « validé » dès que le dossier porte une trace d'usage — un plan, une photo
// de plan, ou une seule journée cochée. Personne ne perd ce qu'il utilise ;
// les nouveaux, eux, attendent que leur coach ouvre la porte.
//
// strictPhotos EST UN CHAMP MORT DEPUIS LE RETRAIT DU PLAN EN PHOTO. Plus rien
// ne l'écrit — ni l'athlète ni le coach n'ont de bouton pour en ajouter. Il
// n'est conservé QU'ICI, en lecture, et pour une seule raison : un athlète dont
// la seule trace d'usage était une photo perdrait son accès à la diète stricte
// le jour où cette ligne disparaîtrait. Elle regarde le passé, elle ne fabrique
// plus rien. À ne retirer qu'après une purge des dossiers, jamais avant.
function _strictUsageExistant(user){
  const n=(user&&user.nutrition)||{};
  if(planActif(user)) return true;
  if(Array.isArray(n.strictPhotos)&&n.strictPhotos.length) return true;
  const d=n.days||{};
  for(const k in d) if(d[k]&&(d[k].respected===true||d[k].respected===false)) return true;
  return false;
}
// PURE. Rend {ok, raison} — jamais un simple booléen : c'est la RAISON qui
// décide de ce que l'écran verrouillé raconte, et les deux ne se déduisent
// pas l'une de l'autre.
function accesDieteStricte(user){
  if(!user) return {ok:false,raison:'sans_coach'};
  // Le coach passe : il consulte l'écran de son athlète depuis sa fiche.
  if(user.role==='coach') return {ok:true,raison:null};
  if(!user.coachId) return {ok:false,raison:'sans_coach'};
  const v=((user.nutrition)||{}).strictAcces;
  if(v===true) return {ok:true,raison:null};
  // ⚠ DEUX FERMETURES QUI NE SE RACONTENT PAS PAREIL (24/09/2026). « Jamais
  //   ouverte » et « refermée après usage » mènent à la même porte close, mais
  //   pas au même texte : dire « pas encore ouverte » à une athlète dont le
  //   programme est déjà composé dans son dossier lui fait douter de ce qu'elle
  //   a vécu. La nuance ne s'invente pas : elle vient de _strictUsageExistant,
  //   qui ne répond oui que sur une trace réelle.
  if(v===false) return {ok:false,raison:_strictUsageExistant(user)?'referme':'non_valide'};
  return _strictUsageExistant(user)
    ?{ok:true,raison:'usage_existant'}
    :{ok:false,raison:'non_valide'};
}
// Les fonctions de ce module reçoivent TOUTES leur résolveur d'aliment en
// dernier argument. Ce n'est pas de la décoration : c'est ce qui rend le
// moteur testable sans charger 873 Ko de Ciqual, et vérifiable sur les valeurs
// exactes des tableurs du coach.
function _planResolveur(chercher){
  return (typeof chercher==='function')?chercher:_planCiqual;
}
// Une ligne du squelette est-elle retenue ? Les lignes de complément ne
// comptent qu'en version « avec compléments », et les marqueurs de source
// libre ne portent aucun aliment : ils disent « ici, une source au choix ».
// Trois sortes de lignes ne portent AUCUN aliment et ne comptent donc nulle
// part : le marqueur « source au choix », la ligne de fruit qui renvoie à la
// table des équivalences, et la note du coach (« Sous forme de PANCAKES »,
// « Dans une gourde de 1,5 L ») que le tableur écrit au-dessus d'un groupe.
function planLigneTexte(item){
  return !!(item&&(item.src||item.fruit||item.note));
}
function planLigneRetenue(plan,item){
  if(!item) return false;
  if(planLigneTexte(item)) return false;
  if(item.comp&&!(plan&&plan.avecComplements)) return false;
  return true;
}

// PURE. Macros d'UNE ligne, pour la quantité que porte la ligne.
// Trois origines, dans cet ordre de priorité : des macros écrites à la main
// (le dernier mot revient toujours au coach), une portion de PLAN_PORTIONS,
// un aliment Ciqual. Rend null quand rien n'est calculable — jamais des zéros,
// qui se liraient comme « cet aliment n'apporte rien ».
function planMacrosItem(item,chercher){
  if(!item||typeof item!=='object') return null;
  const q=_planNb(item.q);
  if(q==null||q<0) return null;
  let per=null,unite=item.u;
  const aLaMain=(_planNb(item.p)!=null||_planNb(item.c)!=null||_planNb(item.l)!=null);
  if(aLaMain){
    per={p:_planNb(item.p)||0,c:_planNb(item.c)||0,l:_planNb(item.l)||0};
  } else if(item.portion&&PLAN_PORTIONS[item.portion]){
    const po=PLAN_PORTIONS[item.portion];
    per={p:po.p,c:po.c,l:po.l};
    if(unite==null) unite=po.u;
  } else if(item.ciqual!=null){
    const f=_planAlimentLigne(item,chercher);
    if(!f) return null;
    per={p:_planNb(f.p)||0,c:_planNb(f.c)||0,l:_planNb(f.l)||0};
    if(unite==null) unite='g';
  } else return null;
  const k=planParUnite(unite)?q:q/100;
  const p=per.p*k,c=per.c*k,l=per.l*k;
  return {p,c,l,kcal:kcalDesMacros(p,c,l)};
}
// Nom affiché d'une ligne, quelle que soit son origine.
function planNomItem(item,chercher){
  if(!item) return '';
  if(item.note) return String(item.note);
  if(item.fruit) return 'Une portion de fruit au choix';
  if(item.src) return item.src==='p'
    ?'Une source de protéines au choix':'Une source de glucides au choix';
  // LOT R1 : une recette de la bibliothèque, en portions.
  if(item.recette) return String(item.recetteNom||'Recette');
  if(item.libre) return String(item.libre);
  if(item.portion&&PLAN_PORTIONS[item.portion]) return PLAN_PORTIONS[item.portion].lib;
  if(item.ciqual!=null){
    const f=_planAlimentLigne(item,chercher);
    if(f) return f.n;
    return _planLibIntrouvable(item.ciqual);
  }
  return 'Ligne sans aliment';
}
function planUniteItem(item){
  if(item&&item.u!=null) return String(item.u);
  if(item&&item.portion&&PLAN_PORTIONS[item.portion]) return PLAN_PORTIONS[item.portion].u;
  return 'g';
}

// PURE. Ce que le squelette couvre déjà, en tout et repas par repas.
// « irresolus » nomme les lignes qu'on n'a pas su chiffrer au lieu de les
// compter pour zéro : un aliment Ciqual retiré d'une version à l'autre ferait
// autrement grossir le restant en silence, et donc les grammages proposés.
// ── Deux apports que le squelette ne nomme pas, et qui comptent quand même ──
// Une ligne « une portion de fruit au choix » vaut 20 g de glucides : toutes
// les portions de la table sont calibrées ainsi, et le tableur porte ce 20
// dans ses huit fichiers.
//
// Et 10 g de lipides sont ajoutés au total, une fois, en forfait : c'est
// l'HUILE DE CUISSON. Elle n'est écrite nulle part parce qu'on ne la pèse
// pas, mais elle est bien mangée. Un forfait, pas un calcul — ni par repas,
// ni par ligne.
//
// Ne pas les compter gonflait le restant, donc les grammages des sources :
// l'athlète pesait plus que sa cible, tous les jours.
const PLAN_FRUIT_GLUCIDES=20;
const PLAN_HUILE_CUISSON_LIP=10;
function _planConst(plan,champ,defaut){
  const v=_planNb(plan&&plan[champ]);
  return (v!=null&&v>=0)?v:defaut;
}
function planCouverture(plan,chercher){
  const res=_planResolveur(chercher);
  const tot={p:0,c:0,l:0,kcal:0};
  const parRepas={},irresolus=[];
  const gFruit=_planConst(plan,'fruitGlucidesG',PLAN_FRUIT_GLUCIDES);
  let nFruits=0;
  for(const item of planSquelette(plan)){
    if(item.comp&&!(plan&&plan.avecComplements)) continue;
    const cle=item.repas||'petit_dej';
    if(!parRepas[cle]) parRepas[cle]={p:0,c:0,l:0,kcal:0,lignes:[]};
    const nom=planNomItem(item,res);
    // Les lignes de texte gardent leur PLACE dans le repas — c'est tout leur
    // intérêt : « Sous forme de PANCAKES » n'a de sens qu'au-dessus des œufs.
    // Elles ne comptent dans aucune macro et ne figurent pas dans irresolus,
    // qui ne parle que d'aliments qu'on n'a pas su chiffrer.
    if(planLigneTexte(item)){
      // À une exception près : le fruit. Il ne nomme pas d'aliment — l'athlète
      // choisit dans la table — mais toutes les portions de cette table sont
      // équivalentes, et le coach les a calibrées à 20 g de glucides.
      let mf=null;
      if(item.fruit&&gFruit>0){
        mf={p:0,c:gFruit,l:0,kcal:4*gFruit};
        tot.c+=gFruit; tot.kcal+=mf.kcal;
        parRepas[cle].c+=gFruit; parRepas[cle].kcal+=mf.kcal;
        nFruits++;
      }
      parRepas[cle].lignes.push({item,nom,macros:mf,
        source:item.src||null,fruit:!!item.fruit,note:!!item.note});
      continue;
    }
    const m=planMacrosItem(item,res);
    if(!m){ irresolus.push(nom); parRepas[cle].lignes.push({item,nom,macros:null}); continue; }
    tot.p+=m.p; tot.c+=m.c; tot.l+=m.l; tot.kcal+=m.kcal;
    parRepas[cle].p+=m.p; parRepas[cle].c+=m.c; parRepas[cle].l+=m.l; parRepas[cle].kcal+=m.kcal;
    parRepas[cle].lignes.push({item,nom,macros:m});
  }
  // L'huile de cuisson, une fois pour toutes, à la fin : un forfait, pas un
  // calcul. Elle n'appartient à aucune ligne et ne se compte pas par repas.
  const huile=_planConst(plan,'huileCuissonG',PLAN_HUILE_CUISSON_LIP);
  if(huile>0){ tot.l+=huile; tot.kcal+=9*huile; }
  return {p:tot.p,c:tot.c,l:tot.l,kcal:tot.kcal,parRepas,irresolus,
    fruits:{n:nFruits,parPortion:gFruit,glucides:nFruits*gFruit},
    huileCuisson:{lipides:huile}};
}

// PURE. Le restant, et le fait qu'il soit négatif dit à voix haute.
// Un restant négatif n'est pas une erreur de calcul : c'est un squelette qui
// dépasse déjà la cible. Le tableur du coach en produit un pour de vrai
// (−0,33 g de lipides sur la prise de masse femme) et l'affichait sans rien
// dire. Ici la source concernée rend 0 et le coach est averti.
function planRestant(cibles,couv){
  const out={p:0,c:0,l:0,negatifs:[]};
  const noms={p:'protéines',c:'glucides',l:'lipides'};
  for(const k of ['p','c','l']){
    const cible=_planNb(cibles&&cibles[k]);
    const couvert=_planNb(couv&&couv[k])||0;
    if(cible==null){ out[k]=null; continue; }
    const r=cible-couvert;
    out[k]=r;
    if(r<0) out.negatifs.push({macro:k,lib:noms[k],cible,couvert,ecart:-r});
  }
  return out;
}

// ══════════════ CE QUE LES DEUX ÉCRANS DU PLAN PARTAGENT ══════════════
// Le code couleur des tableurs papier : protéines rouge, glucides jaune,
// fruits vert. C'est ce que le coach et ses athlètes lisent depuis des années.
// Il vit ICI et non dans chaque écran : la fiche coach portait ses propres
// valeurs en dur — protéines en BLEU — et les deux côtés se contredisaient sur
// la même donnée. Une couleur qui change de sens selon l'écran ne code plus rien.
const PLAN_COULEURS=Object.freeze({p:'#ff3b30',c:'#f5c518',fruit:'#22c55e'});

// PURE. Le total d'un repas, sources « au choix » comprises.
// planCouverture ne chiffre que les aliments IMPOSÉS : une source au choix n'a
// pas d'aliment tant que l'athlète n'a pas choisi. Mais son grammage est calculé
// POUR atteindre une cible — restant / nombre de repas qui se la partagent — et
// ce chiffre-là est certain quel que soit l'aliment retenu. On l'ajoute donc à
// la macro visée. Les macros collatérales de l'aliment choisi, elles, restent
// inconnues : c'est un ORDRE DE GRANDEUR, et les deux écrans le disent par un ~.
function planTotalRepas(r,rest,nSrc){
  let p=(r&&r.p)||0,c=(r&&r.c)||0,l=(r&&r.l)||0;
  for(const x of ((r&&r.lignes)||[])){
    if(!x.source) continue;
    const cible=_planNb(rest&&rest[x.source]);
    if(cible==null||!(cible>0)) continue;
    const n=(nSrc&&nSrc[x.source])||1;
    if(x.source==='p') p+=cible/n; else c+=cible/n;
  }
  return {p,c,l,kcal:kcalDesMacros(p,c,l)};
}
function planTotalRepasHtml(t){
  if(!t||!(t.kcal>0)) return '';
  return `<span class="plan-macros" title="Ordre de grandeur : les macros secondaires de la source choisie ne sont pas comptées">`
    +`~${Math.round(t.kcal)} kcal · ${Math.round(t.p)}P ${Math.round(t.c)}G ${Math.round(t.l)}L</span>`;
}

// PURE. Combien de repas se partagent une source libre.
// Trois niveaux, du plus explicite au plus prudent : le réglage du coach, le
// nombre de marqueurs « source au choix » réellement posés dans le squelette,
// puis la valeur de départ. Le « 2 » du tableur n'est plus qu'un dernier
// recours, et il porte un nom.
function planNbSources(plan,macro){
  const forc=_planNb(plan&&plan.nRepasSourcesLibres);
  if(forc!=null&&forc>=1&&forc<=PLAN_SOURCES_MAX) return Math.round(forc);
  const n=planSquelette(plan).filter(x=>x&&x.src===macro).length;
  if(n>0) return n;
  return PLAN_SOURCES_DEFAUT;
}

// PURE. LE cœur du module.
// (restant / nombre de repas à source libre) / (macro pour 100 g / 100)
// Calcul SANS arrondi : l'arrondi n'appartient qu'à l'affichage, sinon deux
// sources voisines finissent par ne plus donner le même total.
function planGrammage(restant,nSources,per100){
  const r=_planNb(restant),n=_planNb(nSources),p=_planNb(per100);
  if(r==null||n==null||p==null) return null;
  if(!(n>=1)) return null;
  if(!(p>0)) return null;            // division par zéro : une source qui
  if(!(r>0)) return 0;               // n'apporte pas cette macro n'en est pas une
  return (r/n)/(p/100);
}

// PURE. Les deux catalogues, chacun avec le grammage de chaque source.
// Triés par quantité croissante, comme dans le tableur : le coach lit d'un
// coup d'œil ce qui pèse le moins dans l'assiette.
// Une entrée de catalogue est soit un identifiant Ciqual, soit un objet
// {lib, p, c} pour les trois aliments que la table Anses ne porte pas —
// farine d'amande déshuilée, spaghetti de pois chiches, chips de légumes
// maison. Ils gardent la valeur du coach, et ils le DISENT : « hors Ciqual »
// s'affiche à côté, pour que personne ne prenne plus tard ce chiffre pour une
// donnée Anses ni pour une erreur de rattachement.
//
// La clé sert d'identifiant de ligne dans la liste de courses ET dans des
// attributs onclick : elle est donc contrainte à l'alphanumérique, comme les
// identifiants de ligne de squelette et pour la même raison.
function planSourceRef(src,macro,chercher){
  if(src==null) return null;
  if(typeof src==='object'){
    const lib=String(src.lib||'Source');
    return {cle:'x'+lib.replace(/[^A-Za-z0-9]/g,'').slice(0,24)||'x',
      id:null,nom:lib,groupe:'',per100:_planNb(src[macro]),
      horsCiqual:true,introuvable:false};
  }
  const f=_planResolveur(chercher)(src);
  if(!f) return {cle:'c'+src,id:src,nom:_planLibIntrouvable(src),groupe:'',
    per100:null,horsCiqual:false,introuvable:true};
  return {cle:'c'+src,id:src,nom:f.n,groupe:f.g||'',per100:_planNb(f[macro]),
    horsCiqual:false,introuvable:false};
}
function planSources(plan,restant,chercher){
  const res=_planResolveur(chercher);
  const faire=(macro)=>{
    const n=planNbSources(plan,macro);
    const out=[];
    const cat=planCatalogue(plan,macro==='p'?'p':'c');
    for(let i=0;i<cat.length;i++){
      const r=planSourceRef(cat[i],macro,res);
      if(!r) continue;
      const q=planGrammage(restant&&restant[macro],n,r.per100);
      out.push(Object.assign({},r,{index:i,q,
        excessif:(q!=null&&q>PLAN_QTE_ALERTE),
        inexploitable:(!r.introuvable&&(r.per100==null||!(r.per100>0)))}));
    }
    out.sort((a,b)=>{
      if(a.q==null&&b.q==null) return 0;
      if(a.q==null) return 1;
      if(b.q==null) return -1;
      return a.q-b.q;
    });
    return {nSources:n,liste:out};
  };
  return {proteines:faire('p'),glucides:faire('c')};
}

// ── Paliers du tableur → règles continues ─────────────────────────────────
// Le tableur posait des seuils par IF imbriqués : 6 œufs à partir de 90 kg,
// 7 à partir de 105, et RIEN en dessous de 60 kg — la formule rendait FAUX,
// donc une case vide. Les deux règles ci-dessous rendent EXACTEMENT les mêmes
// nombres sur toute la plage couverte par le tableur, sans aucun seuil écrit,
// et continuent de répondre en dehors de cette plage.
//   Œufs   : plancher de poids / 15, moins un chez la femme.
//   Amandes: plancher de poids / 10, plus 15 g (homme) ou 10 g (femme).
function _planFemme(user){
  const bl=((user&&user.bilans)||[]).filter(b=>b&&b.date).slice().sort((a,b)=>a.date-b.date);
  const b=bl[bl.length-1]||{};
  const sexe=(user&&(user._evol_gender||user.gender))||b['deb-gender']||'';
  try{ return isFemale(sexe); }catch(e){ return false; }
}
// Poids lu par le MÊME chemin que besoinsProposes : le dernier bilan qui en
// porte un, à défaut la valeur d'inscription. Deux lectures différentes du
// poids dans la même application finiraient par proposer deux nombres d'œufs.
function _planPoids(user){
  const bl=((user&&user.bilans)||[]).filter(b=>b&&b.date).slice().sort((a,b)=>a.date-b.date);
  const b=bl[bl.length-1];
  let v=null;
  try{ v=b?getBW(b):null; }catch(e){}
  if(v>0) return v;
  const i=_planNb(user&&user['init-weight']);
  return (i!=null&&i>0)?i:null;
}
function oeufsSuggeres(poids,femme){
  const p=_planNb(poids);
  if(p==null||!(p>0)) return null;
  return Math.max(0,Math.floor(p/15)-(femme?1:0));
}
function amandesSuggerees(poids,femme){
  const p=_planNb(poids);
  if(p==null||!(p>0)) return null;
  return Math.max(0,Math.floor(p/10)+(femme?10:15));
}

// ⚠ planPaliers ET planPalierCourant ONT ETE RETIREES le 08/09/2026 avec
// la periodisation. Voir la pierre tombale de PLAN_PHASES_DEFAUT.
// Les cibles du jour. C'est la SEULE frontière entre le vocabulaire des
// objectifs (kcal/p/g/l/f) et celui de Ciqual (p/c/l) — la traduction se fait
// ici, une fois.
//
// ⚠ LA BASE VIENT DU CALCUL DE LA FICHE, PAS DE LA COPIE ENREGISTREE, DEPUIS
// LE 08/09/2026 — et c'est le correctif de ce lot. Kevin, captures a l'appui :
// « le seul calcul qui compte est celui-la [les tableaux du coach] ; les
// resultats doivent etre ceux qui apparaissent dans l'apercu du plan ».
//
// CE QUI SE PASSAIT. Le plan lisait `nutrition.macros`, la derniere copie
// ENREGISTREE, pendant que la fiche affichait le calcul VIVANT. Sur le dossier
// de Kevin : dossier 2 317 kcal, fiche 3 154. Deux ecrans, deux totaux, et
// seule une banniere reliait les deux.
//
// ET PLUS AUCUN MULTIPLICATEUR DE PALIER. La periodisation frappait ces
// chiffres une seconde fois — 0,85 du coefficient d'objectif, puis 0,85 du
// palier — et rien a l'ecran ne montrait le produit. Elle a ete retiree avec
// ses reglages : voir le commentaire de _cplHtmlApercu.
//
// LA SAISIE MANUELLE RESTE PRIORITAIRE : quand le coach a ecrit ses propres
// chiffres, ce sont les siens qui commandent le plan, pas un calcul qu'il a
// justement decide de ne pas suivre.
function planCiblesJour(porteur,isOn,dateStr){
  const nut=(porteur&&porteur.nutrition)||{};
  // N2.19 — LA DATE DU JOUR, EXPLICITEMENT. Cinq appels du composeur de plan
  // passent null ; sans ce repli, l'apercu du coach ignorait l'adaptation de
  // cycle que son athlete recoit bel et bien, et les deux ecrans annoncaient
  // des grammages de glucides differents pour le meme jour.
  let _d=dateStr;
  if(!_d){ try{ _d=localISODate(new Date()); }catch(e){ _d=null; } }
  let base=null;
  // ⚠ `nut.manuel===true` ET NON saisieManuelle(porteur) : cette derniere rend
  // vrai des qu'un dossier porte des macros, ce qui est le cas de presque
  // tous. Elle ferait retomber le plan sur la copie enregistree partout, et le
  // correctif serait inerte sans qu'aucun test ne le voie.
  if(nut.manuel!==true){
    try{
      const t=cibleTableur(porteur,{});
      if(t&&!(t.manque&&t.manque.length)&&t.kcal>0){
        const j=_tbJournees(porteur,t,dieteCyclee(porteur));
        const d=isOn?j.on:j.off;
        if(d&&d.kcal>0) base={kcal:d.kcal,p:d.p,g:d.g,l:d.l,f:d.f};
      }
    }catch(e){ base=null; }
  }
  // LE REPLI EXISTE ET IL COMPTE : un dossier sans poids, sans taille ou sans
  // date de naissance ne se calcule pas. Plutot qu'un plan vide, on retombe
  // sur ce qui est enregistre — exactement ce que faisait cette fonction avant.
  if(!base){ try{ base=_getEffectiveMacros(nut,isOn,_d,porteur)||{}; }catch(e){ base={}; } }
  return {kcal:_planNb(base.kcal),p:_planNb(base.p),c:_planNb(base.g),
    l:_planNb(base.l),f:_planNb(base.f)};
}

// ── Liste de courses ──────────────────────────────────────────────────────
// Répondre oui ou non au suivi du jour refait TOUT le rendu de l'écran :
// sans cette mémoire, la liste se refermerait sous les doigts à chaque
// réponse. Elle n'est pas persistée — c'est un état d'affichage, pas une
// donnée.
let _lcOuvert=false;
// Dans le tableur, deux lignes — Fromage blanc et Œufs — pointaient sur des
// cellules détruites par un déplacement de colonnes et affichaient #REF!. Ce
// n'était pas rattrapable : la formule ne savait plus de quel aliment elle
// parlait. Ici, chaque ligne est produite PAR l'objet qui la porte, donc une
// ligne sans aliment n'existe pas — il n'y a plus de référence à casser.
function _planCleCourse(item,i){
  if(item&&item.id!=null) return 's'+item.id;
  return 's#'+i;
}
// « 42 œuf » sur une liste de courses se lit comme une faute d'accord, et
// c'est le coach qui la porterait. L'unité vient soit de PLAN_PORTIONS, soit
// de sa saisie : on n'ajoute le pluriel que s'il manque.
// Les SYMBOLES d'unité sont invariables : « 999 gs » et « 200 mLs » se
// lisaient comme une faute. Seuls les noms communs s'accordent — œuf, scoop,
// gélule, yaourt, dose, pincée.
const PLAN_UNITES_INVARIABLES=Object.freeze(
  ['g','kg','mg','ml','cl','dl','l','gr','kcal','%']);
function planUnitePluriel(n,unite){
  const u=String(unite==null?'':unite);
  if(!u||PLAN_UNITES_INVARIABLES.indexOf(u.toLowerCase())>=0) return u;
  return (Math.abs(_planNb(n)||0)>=2&&!/s$/i.test(u))?u+'s':u;
}
function planFormatQte(g,unite){
  const v=_planNb(g);
  if(v==null) return '-';
  if(unite&&unite!=='g'){
    const n=Math.round(v*100)/100;
    return n.toString().replace('.',',')+' '+planUnitePluriel(n,unite);
  }
  if(Math.abs(v)>=1000) return (Math.round(v/10)/100).toString().replace('.',',')+' kg';
  return Math.round(v)+' g';
}
// Le nombre de jours par ligne vit dans plan.courses.jours, le stock déjà
// présent dans plan.courses.stock. Une ligne de squelette se mange tous les
// jours par défaut : c'est le sens même d'un repas imposé.
// Regroupe les lignes qui designent la MEME denree. On ne fusionne que ce
// qui s additionne vraiment : meme nom ET meme unite. « 2 oeufs » et
// « 100 g » ne font pas 102 de quoi que ce soit, et deux denrees qui se
// ressemblent ne sont pas la meme — la comparaison est donc sur le nom
// exact, normalise (accents, casse), jamais approchante.
function _lcFusionner(lignes){
  const out=[],index=new Map();
  for(const l of lignes||[]){
    const k=_fjNorm(String(l.lib||'').trim())+'\u0000'+String(l.unite||'');
    const d=index.get(k);
    if(!d){ const c=Object.assign({},l,{cles:[l.cle]}); index.set(k,c); out.push(c); continue; }
    d.qte=(d.qte||0)+(l.qte||0);
    // Le stock deja soustrait se cumule lui aussi : il sert a expliquer la
    // ligne au coach, il doit rester coherent avec la quantite affichee.
    d.stock=(d.stock||0)+(l.stock||0);
    d.cles.push(l.cle);
    // La ligne ne vient plus d un seul endroit : ne pas laisser croire
    // qu elle est purement imposee ou purement choisie.
    if(d.origine!==l.origine) d.origine='mixte';
  }
  return out;
}
function planListeCourses(plan,porteur,chercher){
  const res=_planResolveur(chercher);
  const co=(plan&&plan.courses)||{};
  const jours=co.jours||{},stock=co.stock||{};
  const lignes=[],alertes=[];
  const nJours=(cle,parDefaut)=>{
    const v=_planNb(jours[cle]);
    return (v!=null&&v>=0)?v:parDefaut;
  };
  planSquelette(plan).forEach((item,i)=>{
    if(!planLigneRetenue(plan,item)) return;
    const cle=_planCleCourse(item,i);
    const q=_planNb(item.q);
    if(q==null) return;
    const j=nJours(cle,PLAN_JOURS_SEMAINE);
    const st=_planNb(stock[cle])||0;
    const besoin=Math.max(0,q*j-st);
    lignes.push({cle,lib:planNomItem(item,res),qte:besoin,unite:planUniteItem(item),
      origine:'squelette',jours:j,stock:st,repas:item.repas||null});
  });
  // Les sources : ce que l'athlète a choisi de manger, sur le nombre de jours
  // que le coach lui a attribué. Somme des jours ≠ 7 = des repas non couverts,
  // et le tableur ne le disait nulle part.
  const cibles=planCiblesJour(porteur,true,null);
  const couv=planCouverture(plan,res);
  const rest=planRestant(cibles,couv);
  const src=planSources(plan,rest,res);
  for(const [macro,bloc] of [['p',src.proteines],['c',src.glucides]]){
    let totJours=0;
    for(const s of bloc.liste){
      const cle=s.cle;
      const j=nJours(cle,0);
      totJours+=j;
      if(!(j>0)) continue;
      const st=_planNb(stock[cle])||0;
      const q=_planNb(s.q);
      if(q==null) continue;
      const besoin=Math.max(0,q*bloc.nSources*j-st);
      lignes.push({cle,lib:s.nom,qte:besoin,unite:'g',origine:'source',
        macro,jours:j,stock:st,parRepas:q,nSources:bloc.nSources});
    }
    if(totJours>0&&totJours!==PLAN_JOURS_SEMAINE)
      alertes.push((macro==='p'?'Protéines':'Glucides')+' : '
        +totJours+' jour'+(totJours>1?'s':'')+' répartis sur '+PLAN_JOURS_SEMAINE
        +(totJours<PLAN_JOURS_SEMAINE
          ?' : il reste '+(PLAN_JOURS_SEMAINE-totJours)+' jour'
            +((PLAN_JOURS_SEMAINE-totJours)>1?'s':'')+' sans source attribuée.'
          :' : la semaine est dépassée.'));
  }
  return {lignes:_lcFusionner(lignes),alertes,restant:rest,couverture:couv,cibles};
}

// Tout ce qui doit passer sous les yeux du coach avant qu'il publie. Aucune
// de ces alertes ne bloque : elles se voient, c'est leur seul rôle.
function planAlertes(plan,porteur,chercher){
  // Sans la table Ciqual en mémoire, CHAQUE source se lirait « introuvable ».
  // Ce serait une alerte fausse, et une alerte fausse coûte plus cher que pas
  // d'alerte du tout : on se tait jusqu'à ce que la table soit là.
  if(!chercher&&!Array.isArray(_ciqualDB)) return [];
  const res=_planResolveur(chercher);
  const out=[];
  const cibles=planCiblesJour(porteur,true,null);
  if(!(cibles.kcal>0))
    out.push('Aucun objectif enregistré : les grammages ne peuvent pas être calculés.');
  const couv=planCouverture(plan,res);
  for(const nom of couv.irresolus)
    out.push('« '+nom+' » n\'a pas pu être chiffré : sa ligne ne compte pas dans la couverture.');
  const rest=planRestant(cibles,couv);
  for(const n of rest.negatifs)
    out.push('Le squelette couvre déjà '+Math.round(n.couvert)+' g de '+n.lib
      +' pour une cible de '+Math.round(n.cible)+' g : '+Math.round(n.ecart)
      +' g de trop. Les sources de '+n.lib+' affichent 0.');
  const src=planSources(plan,rest,res);
  for(const bloc of [src.proteines,src.glucides])
    for(const s of bloc.liste){
      if(s.introuvable) out.push('Une source du catalogue n\'existe plus dans Ciqual (#'+s.id+').');
      else if(s.inexploitable) out.push('« '+s.nom+' » n\'apporte pas cette macro : aucun grammage possible.');
      else if(s.excessif) out.push('« '+s.nom+' » demanderait '+Math.round(s.q)
        +' g par repas : au-delà de ce qui se mange.');
    }
  const lc=planListeCourses(plan,porteur,res);
  for(const a of lc.alertes) out.push(a);
  // ⚠ L'ALERTE DE PLANCHER A ETE RETIREE le 08/09/2026 avec la periodisation :
  // c'etait le multiplicateur de palier qui pouvait faire passer un jour sous
  // le plancher calorique. Le plancher lui-meme n'a pas bouge — _relevePlancher
  // le tient dans le calcul du coach, en amont, et l'y annonce.
  return out;
}

