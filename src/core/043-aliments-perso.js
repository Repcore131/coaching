// ══ ALIMENTS PERSO ════════════════════════════════════════════════════════
// Ranges dans le dossier de l athlete, sous son propre noeud. Aucune donnee
// Ciqual ni OFF n y est recopiee : ce sont ses valeurs, saisies par lui.
// L identifiant est une CHAINE (« p1723... ») la ou Ciqual utilise des
// nombres : saveFoodEntry ne pousse dans recentFoods que les id numeriques,
// donc un aliment perso n y entre jamais et aucune ligne ne devient morte.
function _alimsPerso(){
  const l=currentUser&&currentUser.nutrition&&currentUser.nutrition.alimentsPerso;
  return Array.isArray(l)?l:[];
}
function _persoParId(id){ return _alimsPerso().find(a=>a&&a.id===id)||null; }
// Le champ de recherche normalise, calcule a l enregistrement : le classement
// lit f.s comme pour Ciqual, sans cas particulier.
// Le champ de recherche normalise, la provenance, et la note de fiabilite.
// La note est CALCULEE ici, une fois, a l enregistrement : la recalculer a
// chaque affichage couterait un passage sur toute la liste a chaque frappe.
function _persoIndexer(a){
  a.s=_fjNorm(a.n||'');
  // MANUEL par defaut. CUSTOM est reserve a ce qu un relecteur a valide, et
  // rien dans l application ne le pose aujourd hui : ce serait mentir sur le
  // niveau de confiance. Le passage de MANUEL a CUSTOM viendra avec la
  // moderation, ou pas du tout.
  if(!a.source) a.source=NUTRI_SOURCES.MANUEL;
  if(a.verifie!==true) a.verifie=false;
  try{ a.fiabilite=nutriControle(a).fiabilite; }catch(e){ a.fiabilite=null; }
  return a;
}

let _persoEdit=null;        // l aliment en cours de saisie, null = creation
let _persoPrefill=null;     // ce qu un scan a rapporte : code-barres, marque

// `prefill` vient du scan : un produit absent des bases se cree avec son
// code-barres deja porte, sinon il faudrait le retaper chiffre par chiffre.
function ouvrirAlimentPerso(id,prefill){
  _persoEdit=id?_persoParId(id):null;
  go('s-food-perso');
  const v=(k,d)=>{ const e=document.getElementById(k); if(e) e.value=(d==null?'':d); };
  const a=_persoEdit||(prefill?Object.assign({},prefill):{});
  // Le code-barres est PORTE, pas affiche : il ne se corrige pas a la main,
  // et un champ de treize chiffres au milieu du formulaire n aiderait
  // personne. Il est repris a l enregistrement.
  _persoPrefill=(!id&&prefill)?prefill:null;
  v('perso-nom',a.n); v('perso-kcal',a.k); v('perso-p',a.p);
  v('perso-c',a.c); v('perso-l',a.l); v('perso-f',a.f); v('perso-e',a.e);
  v('perso-alcool',a.alcool);
  const t=document.getElementById('perso-titre');
  if(t) t.textContent=_persoEdit?'Modifier mon aliment':'Créer un aliment';
  const sup=document.getElementById('perso-supprimer');
  if(sup) sup.style.display=_persoEdit?'block':'none';
  _persoDire('');
  majPersoCoherence();
}
function _persoNb(id){
  const e=document.getElementById(id);
  if(!e) return null;
  const t=String(e.value||'').trim().replace(',','.');
  if(!t) return null;
  const v=parseFloat(t);
  return isFinite(v)?v:null;
}
function _persoDire(msg,couleur){
  const e=document.getElementById('perso-etat');
  if(!e) return;
  e.textContent=msg||'';
  e.style.color=couleur||'var(--sub)';
  e.style.display=msg?'block':'none';
}
// L energie DEDUITE des macros : 4 kcal par gramme de proteine et de glucide,
// 9 par gramme de lipide (facteurs d Atwater). Elle n est jamais imposee — une
// etiquette peut legitimement s en ecarter, les fibres et les polyols comptant
// autrement — mais un ecart de plus d un quart signale presque toujours une
// faute de frappe ou une colonne « par portion » lue par erreur.
// N2.14 — CETTE FONCTION NE CALCULE PLUS RIEN DE SON COTE. Elle ignorait
// l'alcool, si bien que le meme aliment alcoolise etait declare incoherent sur
// l'ecran d'aliment perso et coherent au controle Open Food Facts.
function _kcalAtwater(pr,gl,li,al){
  if(pr==null&&gl==null&&li==null&&al==null) return null;
  return kcalDesMacros(pr,gl,li,al);
}
function majPersoCoherence(){
  const pr=_persoNb('perso-p'), gl=_persoNb('perso-c'), li=_persoNb('perso-l');
  // N2.14 — l'alcool compte ici comme partout ailleurs.
  const al=_persoNb('perso-alcool');
  const th=_kcalAtwater(pr,gl,li,al);
  const el=document.getElementById('perso-coherence');
  if(!el) return;
  const k=_persoNb('perso-kcal');
  if(th==null){ el.innerHTML=''; return; }
  const arr=Math.round(th);
  if(k==null){
    el.innerHTML='<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.5">'
      +'D&apos;après les macros, environ <b style="color:var(--text)">'+arr+' kcal</b> pour 100 g. '
      +'<button type="button" class="btn btn-outline btn-sm" style="margin-top:6px;width:100%" onclick="persoAppliquerKcal('+arr+')">Utiliser cette valeur</button></div>';
    return;
  }
  const ecart=arr>0?Math.abs(k-arr)/arr:0;
  el.innerHTML=ecart>0.25
    ?'<div style="font-size:var(--fs-xs);color:var(--orange);line-height:1.5">Les macros donnent environ <b>'+arr+' kcal</b>, tu as saisi <b>'+k+'</b>. Vérifie que tu n&apos;as pas lu la colonne « par portion ».</div>'
    :'<div style="font-size:var(--fs-xs);color:var(--text-faint);line-height:1.5">Cohérent avec les macros (~'+arr+' kcal).</div>';
}
function persoAppliquerKcal(v){
  const e=document.getElementById('perso-kcal');
  if(e){ e.value=v; majPersoCoherence(); }
}
function enregistrerAlimentPerso(){
  const nom=String((document.getElementById('perso-nom')||{}).value||'').trim();
  if(nom.length<2){ _persoDire('Donne un nom à cet aliment.','var(--orange)'); return; }
  if(nom.length>80){ _persoDire('Nom trop long (80 caractères maximum).','var(--orange)'); return; }
  const ch={k:_persoNb('perso-kcal'),p:_persoNb('perso-p'),c:_persoNb('perso-c'),
            l:_persoNb('perso-l'),f:_persoNb('perso-f'),e:_persoNb('perso-e'),
            // N2.14 — sous le nom que lit nutriAtwater, pas un second nom.
            alcool:_persoNb('perso-alcool')};
  // Une valeur negative ou delirante ne se corrige pas toute seule plus loin :
  // elle contaminerait tous les totaux du jour.
  for(const k in ch){
    const v=ch[k];
    if(v==null) continue;
    if(v<0){ _persoDire('Aucune valeur ne peut être négative.','var(--orange)'); return; }
    if(k!=='k'&&v>100){ _persoDire('Plus de 100 g pour 100 g d&apos;aliment : vérifie tes valeurs.','var(--orange)'); return; }
    if(k==='k'&&v>900){ _persoDire('Au-delà de 900 kcal pour 100 g : vérifie ta saisie.','var(--orange)'); return; }
  }
  if(ch.k==null&&ch.p==null&&ch.c==null&&ch.l==null){
    _persoDire('Renseigne au moins l&apos;énergie ou une macro.','var(--orange)'); return; }
  // La somme des macros ne peut pas depasser 100 g pour 100 g de produit.
  const somme=(ch.p||0)+(ch.c||0)+(ch.l||0)+(ch.alcool||0);
  if(somme>100){ _persoDire('Protéines + glucides + lipides dépassent 100 g pour 100 g.','var(--orange)'); return; }
  if(!currentUser.nutrition) currentUser.nutrition={};
  const liste=_alimsPerso().slice();
  if(_persoEdit){
    const i=liste.findIndex(a=>a&&a.id===_persoEdit.id);
    if(i<0){ _persoDire('Cet aliment n&apos;existe plus.','var(--orange)'); return; }
    liste[i]=_persoIndexer(Object.assign({},liste[i],ch,{n:nom}));
  } else {
    if(liste.length>=200){ _persoDire('Tu as atteint 200 aliments personnels.','var(--orange)'); return; }
    // Le modele porte la provenance, le code-barres quand il vient d un scan,
    // la marque et la portion fabricant. quantite_ref / unite_ref n existent
    // PAS : tout est pour 100 g dans cette application — Ciqual, Open Food
    // Facts et le journal partagent cet invariant. L introduire ouvrirait la
    // porte aux valeurs « par portion », exactement ce que offValide rejette.
    liste.push(_persoIndexer(Object.assign({id:'p'+Date.now(),n:nom,g:'Mon aliment',
      source:NUTRI_SOURCES.MANUEL,
      code_barres:(_persoPrefill&&_persoPrefill.code_barres)||null,
      marque:(_persoPrefill&&_persoPrefill.marque)||null,
      portion_g:(_persoPrefill&&_persoPrefill.portion_g)||null,
      verifie:false},ch)));
  }
  currentUser.nutrition.alimentsPerso=liste;
  const cree=!_persoEdit;
  const dernier=liste[_persoEdit?liste.findIndex(a=>a&&a.id===_persoEdit.id):liste.length-1];
  toastEcriture(saveUser(),cree?'Aliment créé '+ICO.coche:'Aliment modifié '+ICO.coche,'cet aliment est');
  // Un COACH publie sa liste pour ses athletes. En arriere-plan et sans
  // toast : c est un effet de bord de son enregistrement, pas une action
  // qu il a demandee, et l echouer ne doit pas lui faire croire que sa
  // saisie est perdue — elle est deja dans son dossier.
  try{ _publierAlimentsCoach(); }catch(e){}
  // A la creation, on enchaine sur la quantite : l athlete cree un aliment
  // parce qu il est en train de le manger, pas pour garnir une bibliotheque.
  if(cree&&dernier) selectPersoFood(dernier.id); else go('s-food-search');
}
function supprimerAlimentPerso(){
  if(!_persoEdit) return;
  const id=_persoEdit.id;
  rcConfirm('Supprimer cet aliment ?',
    'Il disparaîtra de tes recherches. Les repas déjà enregistrés avec cet aliment ne changent pas.',
    'Supprimer').then(ok=>{
      if(!ok) return;
      currentUser.nutrition.alimentsPerso=_alimsPerso().filter(a=>a&&a.id!==id);
      _persoEdit=null;
      toastEcriture(saveUser(),'Aliment supprimé','cette suppression est');
      go('s-food-search');
      onFjSearch((document.getElementById('fj-search-input')||{}).value||'');
    });
}
// Le meme ecran de quantite que Ciqual et OFF : un seul parcours a maintenir,
// et l athlete ne voit aucune difference de traitement.
function selectPersoFood(id){
  const a=_persoParId(id);
  if(!a) return false;
  _fjFood=a;
  go('s-food-add');
  document.getElementById('fja-food-name').textContent=a.n;
  const g=document.getElementById('fja-food-group');
  if(g) g.textContent='Mon aliment';
  const q=document.getElementById('fja-qty');
  if(q) q.value=100;
  if(!_fjRepasChoisi) _fjRepas=repasSelonHeure();
  document.querySelectorAll('.fj-repas-btn').forEach(b=>b.classList.toggle('active',b.dataset.repas===_fjRepas));
  // Les favoris sont une liste d identifiants Ciqual : un id perso n y serait
  // pas resolu. On offre a la place la modification de l aliment.
  const ep=document.getElementById('fja-epingle-slot');
  if(ep) ep.innerHTML='';
  const po=document.getElementById('fja-portions');
  if(po) po.innerHTML='<button type="button" class="btn btn-outline btn-sm" style="width:100%;margin-top:10px" onclick="ouvrirAlimentPerso('+_attrArg(a.id)+')">Modifier mes valeurs</button>';
  _majFjaFiabilite();
  _fjUnite='g';
  const pu=document.getElementById('fja-unites-slot');
  if(pu) pu.innerHTML=_htmlUnites(_fjFood);
  updateFjaCalc();
  return true;
}
// ══ LECTURE D UNE ETIQUETTE ═══════════════════════════════════════════════
// Le tableau nutritionnel est normalise en Europe : les memes intitules, dans
// le meme ordre, avec les valeurs pour 100 g. C est ce qui le rend lisible
// sans modele, contrairement a une photo de plat.
//
// AUCUN APPEL RESEAU : le moteur est celui deja embarque pour les captures de
// pas, servi depuis ./vendor/. La photo ne quitte pas le telephone et n est
// ni enregistree ni mise en cache.
//
// Le resultat n est jamais enregistre tel quel : il REMPLIT le formulaire, et
// l athlete valide. Une lecture optique se trompe, et une macro fausse fausse
// toute la journee.
function _etiqNormaliser(txt){
  return String(txt||'').toLowerCase()
    .replace(/[éèêë]/g,'e').replace(/[àâä]/g,'a').replace(/[ùûü]/g,'u')
    .replace(/[îï]/g,'i').replace(/[ôö]/g,'o').replace(/ç/g,'c')
    // La virgule decimale francaise, et les espaces des milliers.
    .replace(/(\d)[ \u00a0](\d{3})\b/g,'$1$2')
    .replace(/(\d),(\d)/g,'$1.$2');
}
// Le premier nombre d une ligne, apres l intitule. La lecture optique confond
// « g » et « 9 » : on n exige donc PAS l unite, on prend le nombre.
function _etiqNombre(ligne){
  const m=String(ligne||'').match(/(\d+(?:\.\d+)?)/);
  return m?parseFloat(m[1]):null;
}
// PAS d exclusion des lignes « dont ». Elle semblait necessaire, elle est
// nuisible : « dont sucres » ne contient pas « glucides » et « dont acides
// gras satures » ne contient ni « lipides » ni « matieres grasses », donc ces
// sous-lignes ne matchent jamais l intitule parent — le premier match est deja
// le total. En revanche, sur les etiquettes qui impriment « Matieres grasses
// dont saturees 21 g » sur UNE ligne, l exclusion jetait la ligne entiere et
// faisait perdre la valeur. Mesure : lipides et glucides passaient a null.
//
// LES INTITULES SONT ABIMES PAR LA LECTURE, et exiger le mot exact perdait la
// ligne entiere. Mesure sur dix etiquettes reelles : « Matieres rasses » (le g
// de grasses avale par le fond bleu), « Hibres alimentaires », « Sal » pour
// « Sel ». Chaque fois, l intitule ne matchait pas et la valeur, pourtant
// lisible a cote, etait perdue. Les variantes admises restent des variantes
// D UN SEUL MOT : on n elargit pas jusqu a matcher n importe quoi, la valeur
// retenue etant de toute facon bornee par les gardes plus bas.
const ETIQ_CHAMPS=[
  {k:'l',re:/(mati[e]res? g?r?asses|lipides)/},
  {k:'c',re:/glucides/},
  {k:'f',re:/[fh]ibres/},
  {k:'p',re:/prot[e]?[ie]?nes/},
  {k:'e',re:/\bs[ea][l1i]\b|sodium/},
];
// LA LIGNE DES APPORTS DE REFERENCE N EST PAS CELLE DU PRODUIT. Toute etiquette
// europeenne imprime « Apport de reference pour un adulte-type (8400 kJ /
// 2000 kcal) », et les colonnes de pourcentage portent AR*, RI* ou NRV. Quand
// la ligne d energie du tableau se lisait mal, c est ce 2000 qui etait pris
// pour l energie du produit : mesure sur les amandes, 2000 kcal ecrites pour
// 621 reelles. Une valeur fausse a la place d une case vide.
const ETIQ_REFERENCE=/reference|apport|adulte-type|adulte type|nrv|ar\*|ri\*/;
// Aucun aliment ne depasse 900 kcal pour 100 g — l huile pure plafonne a 900.
// Ce qui sort de la n est pas une energie : c est un kilojoule pris pour une
// calorie, deux nombres colles, ou du bruit. Mesure : 7305 et 9305 lus sur une
// creme a 305, 2000 sur les amandes.
const ETIQ_KCAL_MAX=900;
function _etiqAnalyser(texte){
  const t=_etiqNormaliser(texte);
  const lignes=t.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const out={};
  // L energie : la ligne porte souvent les DEUX unites (« 1570 kj / 375 kcal »).
  // On vise le nombre colle a « kcal », jamais le premier de la ligne.
  for(const L of lignes){
    if(ETIQ_REFERENCE.test(L)) continue;
    // LE NOMBRE NE DOIT PAS SORTIR D UN MOT. « K@kcalfis9kcal » — du bruit lu
    // sur une canette — donnait 9 kcal pour 42 : le 9 etait colle a des
    // lettres. Un vrai nombre est precede d un espace ou d un debut de ligne.
    // ET « kcal » S ECRIT DE TRAVERS : keal, kal, kcaI, kca. On accepte la
    // famille, pas n importe quoi.
    const m=L.match(/(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*k?\s*[ce][ai]?[ail]\b/);
    if(m){
      const v=parseFloat(m[1]);
      if(v>0&&v<=ETIQ_KCAL_MAX&&v!==2000){ out.k=v; break; }
    }
  }
  for(const c of ETIQ_CHAMPS){
    for(let i=0;i<lignes.length;i++){
      const L=lignes[i];
      if(!c.re.test(L)||ETIQ_REFERENCE.test(L)) continue;
      // Une ligne du tableau est COURTE et commence par son intitule. Sans
      // cette garde, « Sans sel ajouté » imprime en facade passe pour la ligne
      // de sel, et le repli sur la ligne suivante lit le 100 de « pour 100 g ».
      if(L.length>60||L.search(c.re)>25) continue;
      let v=_etiqNombre(L.replace(c.re,' '));
      // La valeur est parfois rejetee sur la ligne suivante par la mise en
      // page — mais alors cette ligne ne porte QUE le nombre et son unite.
      // Accepter n importe quelle ligne suivante, c est ramasser le premier
      // nombre venu.
      if(v==null&&lignes[i+1]&&/^\d+(?:\.\d+)?\s*(g|mg|9|kcal)?$/.test(lignes[i+1].trim()))
        v=_etiqNombre(lignes[i+1]);
      // Un macronutriment au-dela de 100 g pour 100 g de produit n existe pas :
      // c est que la lecture a attrape autre chose.
      if(v!=null&&c.k!=='k'&&v>100) v=null;
      // On ne s arrete que sur une valeur TROUVEE : sinon la premiere ligne
      // qui contient le mot bloque la recherche des suivantes.
      if(v!=null){ out[c.k]=v; out['_l_'+c.k]=L; break; }
    }
  }
  // Le sodium n est pas le sel : 1 g de sodium vaut 2,5 g de sel. La decision
  // se prend sur LA LIGNE RETENUE, pas sur le texte entier — un « sans sel
  // ajoute » imprime ailleurs sur l emballage annulerait la conversion, et la
  // valeur sortirait 2,5 fois trop basse.
  const _ls=out['_l_e']||'';
  if(out.e!=null&&/sodium/.test(_ls)&&!/\bs[ea][l1i]\b/.test(_ls)) out.e=Math.round(out.e*2.5*100)/100;
  for(const _k in out) if(_k.indexOf('_l_')===0) delete out[_k];
  // ══ LA GARDE DE COHERENCE : 4 / 4 / 9 ═══════════════════════════════════
  //
  // C EST ELLE QUI EMPECHE LE PIRE, et le pire n est pas une case vide. La
  // virgule decimale disparait tres souvent a la lecture — « 0,8 g » ressort
  // « 8 », « 8,9 g » ressort « 93 » — et le nombre obtenu reste sous 100 : la
  // borne du dessus ne le voit pas passer. Mesure sur un jus d orange : 8 g de
  // proteines et 93 g de glucides ecrites pour 0,8 et 8,9. Un facteur dix sur
  // une macro, pose dans le formulaire comme une valeur lue.
  //
  // Les macros ne peuvent pas peser plus lourd que l energie annoncee juste
  // au-dessus d elles. 4 kcal le gramme de proteine et de glucide, 9 pour le
  // lipide : la somme doit tomber SOUS l energie, jamais nettement au-dessus.
  // La marge de 15 % couvre les fibres, les polyols et l arrondi legal.
  //
  // ON GARDE L ENERGIE ET ON JETTE LES MACROS, pas l inverse : l energie est
  // lue sur sa propre ligne, avec son unite ecrite en toutes lettres, et c est
  // la valeur la plus sure du tableau. Les macros, elles, viennent de tomber
  // ensemble — on ne sait pas laquelle est fausse, donc aucune n est gardee.
  if(out.k!=null){
    const _somme=4*(out.p||0)+4*(out.c||0)+9*(out.l||0);
    if(_somme>out.k*1.15){
      out.incoherent=Math.round(_somme);
      delete out.p; delete out.c; delete out.l; delete out.f;
    }
  }
  // « POUR 100 G » SURVIT AU g LU 9, 5 ou 6. C est la confusion la plus frequente de
  // toutes, et elle declenchait l avertissement « ce sont peut-etre les valeurs
  // par portion » sur des lectures parfaitement bonnes : « Pour 100 9 »,
  // « POUR 1005 », « 1009 ». Le doute jete sur une lecture juste use la
  // confiance aussi surement qu une valeur fausse.
  out.pour100=/(pour|par)\s*100\s*(g|9|5|6|s|ml|mi|$)|100\s*(g|9|ml)\b/.test(t);
  return out;
}
// ══ LA PHOTO EST PREPAREE AVANT D'ETRE LUE (build 1412) ═══════════════════
//
// Kevin, 23/09/2026 : « la photo du tableau des valeurs nutritionnelles ne
// fonctionne pas très bien, il lit mal les infos et ne les renote pas ».
//
// MESURE, sur huit tableaux dessines puis abimes comme des photos de telephone
// (reduits, JPEG, flous, penches, fond sombre, colonne eloignee, sodium au lieu
// de sel, ligne d'apports de reference) — 48 valeurs a trouver :
//   • lecture directe, telle qu'elle etait : 29 justes, 3 fausses, 16 absentes ;
//   • image PREPAREE avant lecture        : 35 justes, 5 fausses,  8 absentes.
// La preparation double presque le nombre de cases remplies. Les fausses, elles,
// sont reglees par l'arbitrage ci-dessous, pas par la preparation.
//
// CE QUE FAIT LA PREPARATION, et pourquoi chaque etape :
//   • GRIS : le moteur travaille de toute facon en luminance ; le faire nous
//     evite qu'il le fasse sur une image deja reduite.
//   • NIVEAUX ETIRES (2 % / 98 %) : une photo de rayon n'a ni blanc ni noir —
//     du gris clair sur du gris moyen. Etirer l'histogramme rend au texte le
//     contraste que le papier avait.
//   • AGRANDIE jusqu'a 1 500 px de petit cote (×3 au plus) : c'est la hauteur
//     de texte ou la VIRGULE DECIMALE fait plus de deux pixels. Sa disparition
//     est la premiere cause de valeur fausse — « 0,85 g » lu « 85 ».
//   • INVERSEE si le fond est sombre : un tableau blanc sur noir se lit mal,
//     et les emballages sombres sont courants.
//
// ELLE NE JETTE JAMAIS LA PHOTO D'ORIGINE : si la preparation echoue, on lit
// l'image telle quelle. Une lecture moins bonne vaut mieux que pas de lecture.
function _etiqPreparer(dataUrl,cible){
  return new Promise((res,rej)=>{
    const im=new Image();
    im.onload=()=>{
      try{
        const petit=Math.min(im.width,im.height)||1;
        const f=Math.max(1,Math.min(3,(cible||1500)/petit));
        const W=Math.round(im.width*f), H=Math.round(im.height*f);
        // Au-dela de 40 Mpx, un telephone d'entree de gamme rend un canvas vide.
        if(W*H>40e6){ res(dataUrl); return; }
        const c=document.createElement('canvas'); c.width=W; c.height=H;
        const x=c.getContext('2d',{willReadFrequently:true});
        x.imageSmoothingQuality='high';
        x.drawImage(im,0,0,W,H);
        const d=x.getImageData(0,0,W,H), p=d.data;
        const hist=new Uint32Array(256);
        for(let i=0;i<p.length;i+=4){
          const g=(p[i]*0.299+p[i+1]*0.587+p[i+2]*0.114)|0;
          p[i]=p[i+1]=p[i+2]=g; hist[g]++;
        }
        const n=W*H;
        let bas=0,haut=255,acc=0;
        for(let i=0;i<256;i++){ acc+=hist[i]; if(acc>n*0.02){ bas=i; break; } }
        acc=0;
        for(let i=255;i>=0;i--){ acc+=hist[i]; if(acc>n*0.02){ haut=i; break; } }
        // Image deja plate (photo tres sous-exposee, ou unie) : on n'etire pas,
        // ca ne ferait qu'amplifier le bruit.
        if(haut-bas<20){ bas=0; haut=255; }
        let somme=0; for(let i=0;i<256;i++) somme+=i*hist[i];
        const inverser=(somme/n)<110;
        const ech=255/(haut-bas);
        for(let i=0;i<p.length;i+=4){
          let g=(p[i]-bas)*ech;
          g=g<0?0:(g>255?255:g);
          if(inverser) g=255-g;
          p[i]=p[i+1]=p[i+2]=g;
        }
        x.putImageData(d,0,0);
        res(c.toDataURL('image/png'));
      }catch(e){ res(dataUrl); }
    };
    im.onerror=()=>res(dataUrl);
    try{ im.src=dataUrl; }catch(e){ res(dataUrl); }
  });
}
// ══ DEUX LECTURES, ET C'EST L'ENERGIE QUI ARBITRE ═════════════════════════
//
// CE QUI NE MARCHAIT PAS : la seconde lecture ne servait qu'a remplir les cases
// VIDES de la premiere. Quand les deux lisaient la meme case differemment —
// « 58 g » d'un cote, « 28 g » de l'autre — la premiere gagnait par principe,
// meme quand son chiffre contredisait l'energie imprimee juste au-dessus.
//
// L'ENERGIE EST L'ARBITRE, et elle a le droit de l'etre : elle est lue sur sa
// propre ligne, avec son unite ecrite en toutes lettres, et c'est la valeur la
// plus sure du tableau. 4 kcal le gramme de proteine et de glucide, 9 pour le
// lipide : parmi les combinaisons possibles, on retient celle qui tombe SOUS
// l'energie annoncee, et la plus complete.
//
// ⚠ ON NE DEVINE TOUJOURS AUCUNE VIRGULE. « 589 » peut valoir 5,8 ou 58,9 : la
//   regle du fichier reste de laisser la case vide, et les assertions des dix
//   photos reelles le verifient. L'arbitrage ne CHOISIT QUE parmi des valeurs
//   REELLEMENT LUES, jamais une valeur calculee.
//
// ⚠ ET SI AUCUNE COMBINAISON NE TIENT, on garde l'energie et on ecarte les
//   macros, comme avant : c'est le cas du jus d'orange (0,8 g lu « 8 », 8,9 g lu
//   « 93 »), ou les deux macros sont fausses ensemble.
const ETIQ_SEL_MAX=30;        // au-dela, ce n'est plus du sel : c'est un chiffre perdu
// La somme 4/4/9 doit tomber SOUS l'energie, et pas tres loin en dessous : les
// fibres et les polyols expliquent un ecart de quelques pour cent, pas trente.
// Au-dessus de 1,08, c'est une macro lue trop grande ; sous 0,78, c'en est une
// lue trop petite ou une virgule perdue dans l'autre sens.
const ETIQ_SOMME_HAUT=1.08, ETIQ_SOMME_BAS=0.78;
// PURE. Cette lecture se tient-elle ? Sans energie, rien a comparer : on dit
// oui, faute d'arbitre. Sans aucune macro, non — une lecture de plus ne coute
// qu'un instant et peut tout remplir.
function _etiqTient(x){
  if(!x) return false;
  if(x.k==null) return true;
  const s=4*(Number(x.p)||0)+4*(Number(x.c)||0)+9*(Number(x.l)||0);
  if(!s) return false;
  return s<=x.k*ETIQ_SOMME_HAUT&&s>=x.k*ETIQ_SOMME_BAS;
}
// ══ LE « g » LU COMME UN 9 COLLE AU NOMBRE ════════════════════════════════
//
// Mesure, sur le banc d'etiquettes ET par le vrai bouton photo : « 6,7 g » de
// fibres ressort « 6,79 », « 3,1 g » de proteines ressort « 3,19 », « 3,6 g »
// ressort « 3,69 ». Toujours le meme motif : le g de l'unite se lit 9 et se
// colle a la derniere decimale.
//
// CE N'EST PAS UNE DEVINETTE, ET C'EST LA REGLE QUI LE DIT : le reglement
// europeen 1169/2011 impose UNE decimale aux matieres grasses, glucides,
// proteines et fibres. « 3,19 g » de proteines n'existe donc pas sur une
// etiquette ; deux decimales dont la derniere est un 9, c'est l'unite qu'on a
// relue. On retire ce seul chiffre.
//
// ⚠ LE SEL EST EXCLU, ET C'EST TOUT L'INTERET DE LE DIRE : lui se declare AU
//   CENTIEME (« 0,85 g », « 1,19 g »). Sa deuxieme decimale est legitime, on
//   n'y touche pas.
function _etiqSansUniteCollee(cle,v){
  if(cle==='e'||cle==='k') return v;
  const n=Number(v);
  if(!isFinite(n)) return v;
  const s=String(n);
  const pt=s.indexOf('.');
  if(pt<0) return n;                          // un entier ne porte pas d'unite collee
  const dec=s.slice(pt+1);
  if(dec.length!==2||dec[1]!=='9') return n;  // une seule decimale, ou pas de 9 final
  return Number(s.slice(0,pt+2));
}
function _etiqCandidats(lectures,cle){
  const out=[];
  (lectures||[]).forEach((l,rang)=>{
    if(!l||l[cle]==null) return;
    const v=_etiqSansUniteCollee(cle,Number(l[cle]));
    if(!isFinite(v)) return;
    if(!out.some(x=>Math.abs(x.v-v)<0.001)) out.push({v,rang});
  });
  return out;
}
function _etiqFusionner(lectures){
  const L=(lectures||[]).filter(Boolean);
  if(!L.length) return {};
  const out={};
  // pour100 : il suffit qu'UNE lecture ait vu la mention.
  out.pour100=L.some(l=>!!l.pour100);
  // L'energie : la premiere lecture qui en a une. Les bornes ont deja joue
  // dans _etiqAnalyser, on ne les rejoue pas.
  const ks=_etiqCandidats(L,'k');
  if(ks.length) out.k=ks[0].v;
  // Le sel et les fibres ne pesent pas dans la somme 4/4/9 : ils se choisissent
  // a la majorite, puis au rang. Le sel est BORNE — 85 g pour 100 g n'existe
  // pas, et on ne sait pas si c'etait 8,5 ou 0,85 : on laisse vide.
  for(const cle of ['f','e']){
    const c=_etiqCandidats(L,cle).filter(x=>cle!=='e'||x.v<=ETIQ_SEL_MAX);
    if(!c.length) continue;
    const compte=c.map(x=>({x,n:L.filter(l=>l&&Math.abs(Number(l[cle])-x.v)<0.001).length}));
    // ⚠ A EGALITE DE VOIX, LA VALEUR AVEC DECIMALES GAGNE quand l'autre est son
    //   entier tronque : « 6,7 g » lu « 6 » est le cas courant, l'inverse
    //   n'existe pas. On ne fabrique rien — les deux valeurs ont ete LUES.
    const tronque=(a,b)=>Number.isInteger(a)&&!Number.isInteger(b)&&Math.abs(a-b)<1;
    compte.sort((a,b)=>(b.n-a.n)
      ||(tronque(a.x.v,b.x.v)?1:(tronque(b.x.v,a.x.v)?-1:0))
      ||(a.x.rang-b.x.rang));
    out[cle]=compte[0].x.v;
  }
  // Les trois macros qui pesent : on essaie toutes les combinaisons de valeurs
  // LUES (au plus quelques dizaines), et on garde la plus complete qui tienne
  // sous l'energie. A egalite de completude, la somme la plus proche de
  // l'energie ; puis le meilleur rang de lecture.
  // ⚠ TOUT OU RIEN, JAMAIS UNE MACRO SACRIFIEE POUR EN SAUVER UNE AUTRE.
  //   Sur le jus d'orange des photos reelles — 0,8 g de proteines lu « 8 » et
  //   8,9 g de glucides lu « 93 » pour 40 kcal —, jeter les seuls glucides
  //   faisait tenir l'arithmetique et laissait « 8 g » de proteines dans le
  //   formulaire : dix fois trop, et l'athlete n'avait aucune raison de s'en
  //   mefier. On ne sait pas laquelle des deux est fausse ; on ne garde donc
  //   AUCUNE des deux. Les combinaisons examinees remplissent toutes les cases
  //   pour lesquelles une valeur a ete lue — ou aucune.
  const P=_etiqCandidats(L,'p');
  const C=_etiqCandidats(L,'c');
  const G=_etiqCandidats(L,'l');
  const _ou=c=>c.length?c:[{v:null,rang:0}];
  let meilleur=null;
  for(const p of _ou(P)) for(const c of _ou(C)) for(const g of _ou(G)){
    const somme=4*(p.v||0)+4*(c.v||0)+9*(g.v||0);
    const remplies=(p.v!=null?1:0)+(c.v!=null?1:0)+(g.v!=null?1:0);
    if(out.k!=null&&somme>out.k*ETIQ_SOMME_HAUT) continue;   // ne tient pas sous l'energie
    const score={remplies,ecart:out.k!=null?Math.abs(out.k-somme):0,
      rang:p.rang+c.rang+g.rang,p,c,g,somme};
    if(!meilleur
       ||score.ecart<meilleur.ecart
       ||(score.ecart===meilleur.ecart&&score.rang<meilleur.rang))
      meilleur=score;
  }
  if(meilleur&&meilleur.remplies>0){
    if(meilleur.p.v!=null) out.p=meilleur.p.v;
    if(meilleur.c.v!=null) out.c=meilleur.c.v;
    if(meilleur.g.v!=null) out.l=meilleur.g.v;
  } else if(out.k!=null){
    // Aucune combinaison ne tient : on le DIT, et on garde l'energie seule.
    // La somme la plus BASSE des lectures : c'est le chiffre le moins accusateur
    // qu'on puisse montrer, et celui qu'on met dans le message.
    const pires=L.map(l=>4*(Number(l.p)||0)+4*(Number(l.c)||0)+9*(Number(l.l)||0))
      .filter(x=>x>0);
    if(pires.length) out.incoherent=Math.round(Math.min.apply(null,pires));
  }
  return out;
}
let _etiqEnCours=false;
async function lireEtiquette(input){
  if(_etiqEnCours) return;
  const f=input&&input.files&&input.files[0];
  if(!f){ return; }
  _etiqEnCours=true;
  const btn=document.getElementById('perso-etiq-btn');
  if(btn) btn.disabled=true;
  _persoDire('Lecture de l&apos;étiquette… (quelques secondes)','var(--sub)');
  try{
    // On passe par le meme redimensionnement que l import de programme : une
    // photo de 12 Mpx fait echouer la lecture par manque de memoire sur les
    // telephones d entree de gamme.
    // _lireImage N APPELLE PAS son callback quand elle renonce — fichier trop
    // lourd, image illisible : elle affiche un toast et sort. Sans garde, la
    // promesse ne se resoudrait jamais, le bouton resterait desactive et il
    // faudrait relancer l application. On borne donc l attente.
    if(f.size>20*1024*1024){
      _persoDire('Photo trop lourde (20 Mo maximum). Reprends-la en qualité moindre.','var(--orange)');
      return;
    }
    const dataUrl=await new Promise((res,rej)=>{
      const t=setTimeout(()=>rej(new Error('image illisible')),20000);
      try{ _lireImage(input,1400,1800,b64=>{ clearTimeout(t); res(b64); }); }
      catch(e){ clearTimeout(t); rej(e); }
    });
    if(!dataUrl){ _persoDire('Image illisible.','var(--orange)'); return; }
    // ══ DEUX LECTURES, PAS UNE ══════════════════════════════════════════
    //
    // Le meme tableau ne se lit pas pareil selon la taille a laquelle on le
    // presente au moteur et la facon dont il decoupe la page. Ce n'est pas une
    // impression : sur dix etiquettes reelles photographiees par d'autres que
    // nous, la premiere lecture rendait 7 valeurs justes et la seconde en
    // rattrapait 5 de plus que la premiere avait manquees — le sel et les
    // fibres d'un muesli, l'energie d'une creme, trois macros d'un jus.
    //
    // La seconde presente l'image plus GRANDE — la virgule decimale d'un
    // « 5,8 g » ne fait que deux pixels apres la reduction de la premiere, et
    // c'est elle qui, en disparaissant, transforme 5,8 en 58 — et demande le
    // decoupage en colonne unique, qui suit mieux un tableau a deux colonnes.
    //
    // ON NE FUSIONNE QUE LES CASES RESTEES VIDES. La premiere lecture garde la
    // main sur ce qu'elle a lu : deux lectures qui se contredisent ne se
    // departagent pas, et prendre la seconde au hasard reviendrait a tirer a
    // pile ou face sur une macro. Mesure : la fusion en deux passes rend 12
    // valeurs justes et AUCUNE fausse ; en ajouter une troisieme monte a 14
    // justes mais en ramene 4 fausses, ce qu'on ne veut a aucun prix.
    // ══ LA PHOTO EST PREPAREE, PUIS LUE DEUX FOIS, PUIS ARBITREE ════════
    //
    // Mesure sur huit tableaux abimes comme des photos (48 valeurs) :
    // lecture directe 29 justes / 3 fausses / 16 absentes ; image preparee
    // 35 / 5 / 8. La preparation remplit les cases, l'arbitrage par l'energie
    // retire les fausses — voir _etiqPreparer et _etiqFusionner.
    //
    // LA TROISIEME LECTURE — l'image BRUTE, sans preparation — ne part que s'il
    // reste des cases vides : une etiquette deja bien lue ne doit pas coûter
    // trois passages de moteur sur un telephone.
    const _lectures=[];
    const _prep=await _etiqPreparer(dataUrl,1500).catch(()=>dataUrl);
    _lectures.push(_etiqAnalyser(await _lireCaptureStats(_prep)));
    // ⚠ ON RELIT AUSSI QUAND LA LECTURE NE TIENT PAS, et pas seulement quand
    //   elle est incomplete. Mesure : un tableau sur fond sombre rendait
    //   « 28 g » de glucides pour 58 — une case REMPLIE, donc aucune relecture
    //   ne partait, et l'arbitrage n'avait rien a comparer. La somme 4/4/9
    //   tombait a 268 kcal pour 375 annoncees : c'est ce desaccord qui declenche
    //   desormais la lecture suivante.
    const _aRelire=()=>{
      const x=_etiqFusionner(_lectures);
      return ['k','p','c','l','f','e'].some(k=>x[k]==null)||!_etiqTient(x);
    };
    try{
      if(_aRelire()){
        const _grand=await _etiqPreparer(dataUrl,2400).catch(()=>null);
        if(_grand) _lectures.push(_etiqAnalyser(await _lireCaptureStats(_grand,{psm:4})));
      }
    }catch(e){}
    try{
      if(_aRelire()) _lectures.push(_etiqAnalyser(await _lireCaptureStats(dataUrl)));
    }catch(e){}
    const r=_etiqFusionner(_lectures);
    const mis=[];
    const pose=(id,v)=>{ if(v==null) return; const e=document.getElementById(id);
      if(e){ e.value=v; mis.push(id); } };
    pose('perso-kcal',r.k); pose('perso-p',r.p); pose('perso-c',r.c);
    pose('perso-l',r.l);    pose('perso-f',r.f); pose('perso-e',r.e);
    majPersoCoherence();
    if(r.incoherent){
      // ON LE DIT, plutot que de rendre une case vide sans raison : les macros
      // ont bien ete lues, elles ont ete ECARTEES, et l'athlete doit savoir que
      // ce n'est pas la photo qui etait mauvaise mais la lecture qui se
      // contredisait. Sans ce message, il recadre et recommence pour rien.
      _persoDire('Les macros lues ne collent pas aux calories ('+r.incoherent+' kcal contre '+r.k+') : elles ont été écartées plutôt que posées fausses. Saisis-les à la main.','var(--orange)');
    } else if(!mis.length){
      _persoDire('Rien n&apos;a pu être lu. Cadre le tableau nutritionnel bien à plat, ou saisis les valeurs à la main.','var(--orange)');
    } else if(!r.pour100){
      _persoDire(mis.length+' valeur(s) lue(s), mais « pour 100 g » n&apos;apparaît pas : vérifie que ce ne sont pas les valeurs par portion.','var(--orange)');
    } else {
      _persoDire(mis.length+' valeur(s) lue(s). Vérifie-les : une lecture optique se trompe.','var(--green)');
    }
  }catch(e){
    _persoDire('Lecture impossible : '+((e&&e.message)||'erreur')+'. Saisis les valeurs à la main.','var(--orange)');
  }finally{
    _etiqEnCours=false;
    // Plusieurs mega-octets rendus tout de suite. Une etiquette se lit une
    // fois ; garder le moteur charge pour une eventuelle seconde photo
    // couterait la memoire de tout le reste de la session.
    try{ _libererLecteurTexte(); }catch(e){}
    if(btn) btn.disabled=false;
    // Le meme fichier doit pouvoir etre repris apres une correction de cadrage.
    try{ input.value=''; }catch(e){}
  }
}

// L ajout au journal passe par le controle. Sous le seuil de fiabilite, on
// DEMANDE : un accord tacite sur une fiche douteuse n est pas un accord, et
// une macro fausse fausse la journee entiere.
// PURE. LE TEXTE DE L'AVERTISSEMENT, separe du DOM pour qu'une assertion
// puisse l'exercer sans ouvrir d'ecran. Rend '' quand il n'y a rien a dire.
//
// ⚠ IL NE SORT QUE POUR « allergie ». Une intolerance est deja dite dans la
// liste, et la redire au moment de valider ferait d'un aliment tolere un
// aliment negocie. Un « choix » ne dit JAMAIS rien : c'est une decision, pas
// un symptome, et l'app n'a pas a la commenter au moment ou l'athlete la
// contredit — ce jour-la moins que les autres.
function texteAvertissementEviction(ev,estMarque){
  if(!ev||ev.niveau!=='allergie') return '';
  return 'Tu as déclaré : « '+ev.libelle+' ». Cet aliment y correspond ('
    +ev.raison+').'
    +(estMarque?'\n\n'+EV_OFF_RESERVE:'')
    +'\n\nRepCore ne bloque pas : c’est toi qui sais.';
}
// L'AVERTISSEMENT LUI-MEME. Rend true s'il faut poursuivre.
//
// ⚠ IL NE BLOQUE PAS. Une app qui refuse d'enregistrer ce que quelqu'un a
// mange ne fait pas disparaitre le repas : elle fait disparaitre la donnee, et
// avec elle la seule trace qui aurait explique la journee.
async function avertirEviction(user,aliment){
  let ev=null;
  try{ ev=evictionDe(user,aliment); }catch(e){ return true; }
  const t=texteAvertissementEviction(ev,!!(aliment&&aliment._off));
  if(!t) return true;
  try{ return !!(await rcConfirm('Éviction déclarée',t,'Ajouter quand même')); }
  catch(e){ return true; }
}
async function saveFoodEntry(){
  const f=_fjFood;if(!f) return;
  const qty=parseFloat(document.getElementById('fja-qty')?.value)||0;
  if(qty<=0||qty>9999){toast('Quantité invalide (1-9999g)','var(--orange)');return;}
  try{
    const ctrl=nutriControle(f);
    // SEULEMENT les impossibilites arithmetiques. Une fiche incomplete n est
    // pas une fiche fausse : 143 aliments Ciqual ne portent aucune energie
    // parce que l ANSES ne la publie pas, et l affichage sait deja dire
    // « énergie non renseignée ». Bloquer sur la completude les effacerait.
    if(ctrl.impossibles&&ctrl.impossibles.length){
      toast(ctrl.impossibles[0],'var(--orange)');
      return;
    }
    // ⚠ CHEMIN 3. L'aliment est arrive jusqu'ici — par un code-barres scanne,
    // par les recents, ou parce qu'il etait deja au journal. Les listes l'ont
    // peut-etre retire, mais les listes ne sont pas la seule porte.
    //
    // ⚠ ET LA DECISION SE PREND SYNCHRONEMENT, l'attente seulement ensuite.
    // Un `await` inconditionnel ici suspend saveFoodEntry AVANT l'ecriture :
    // dix assertions qui l'appellent sans l'attendre ne voyaient plus rien
    // s'ecrire, et la suite s'arretait a mi-parcours. Meme forme que la
    // branche de fiabilite juste en dessous, qui n'attend que si elle demande.
    const _ev=(function(){ try{ return evictionDe(currentUser,f); }catch(e){ return null; } })();
    const _txtEv=texteAvertissementEviction(_ev,!!(f&&f._off));
    if(_txtEv){
      const _oke=await rcConfirm('Éviction déclarée',_txtEv,'Ajouter quand même');
      if(!_oke) return;
    }
    if(ctrl.fiabilite!=null&&ctrl.fiabilite<NUTRI_SEUIL_CONFIRME){
      const ok=await rcConfirm('Fiche peu fiable',
        (ctrl.alertes[0]||'Cette fiche est incomplète.')+' L’ajouter faussera peut-être ton bilan du jour. Tu peux la corriger en créant ton propre aliment.',
        'Ajouter quand même');
      if(!ok) return;
    }
  }catch(e){}
  const r=qty/100;
  const entry={
    id:Date.now(),alim_id:f.id,nom:f.n,groupe:f.g||'',qty,repas:_fjRepas,
    // L'énergie estimée quand la table n'en donne pas (kcalPortion), et marquée.
    kcal:kcalPortion(f,r).kcal,
    p:f.p!=null?parseFloat((f.p*r).toFixed(1)):null,
    c:f.c!=null?parseFloat((f.c*r).toFixed(1)):null,
    l:f.l!=null?parseFloat((f.l*r).toFixed(1)):null,
    fi:f.f!=null?parseFloat((f.f*r).toFixed(1)):null,
    // `e` de Ciqual = sel en g/100 g. Deux décimales : au dixième, 0,17 g
    // deviendrait 0,2 g, et l'écart se cumule sur une journée entière.
    sel:f.e!=null?parseFloat((f.e*r).toFixed(2)):null,
    // Marqueur peri-seance, pose a la main par l'athlete. Purement
    // descriptif : aucun total ne le lit, aucun calcul ne s'en sert.
    // false et non undefined, pour que basculerPeriSeance ait toujours
    // une valeur a inverser.
    periSeance:false,
    ...(kcalPortion(f,r).estimee?{kcalEstimee:true}:{}),
  };
  // Micronutriments : meme prorata que les macros ci-dessus, et il n'existe
  // qu'un seul endroit ou il est ecrit.
  _poserMicros(entry,f,r);
  // PRODUIT DE MARQUE : deux champs, sur l ENTREE seulement. Le document
  // `user` n en recoit aucun, et rien n est migre. Contrainte ODbL : la
  // donnee OFF ne se recopie pas ailleurs que dans ce que l athlete a
  // reellement journalise.
  if(f._off&&f._off.ean){ entry.alim_source='off'; entry.ean=f._off.ean; }
  // AFFICHAGE SEUL. `qty` reste la seule verite, en grammes. Cette chaine
  // sert a relire « 2 oeufs » dans les recents, et rien ne la recalcule.
  try{ const _lu=fjaLibelleUniteChoisie(); if(_lu) entry.unite=_lu; }catch(e){}
  if(!currentUser.nutrition) currentUser.nutrition={};
  if(!currentUser.nutrition.log) currentUser.nutrition.log={};
  if(!currentUser.nutrition.log[_fjDate]) currentUser.nutrition.log[_fjDate]={entries:[]};
  currentUser.nutrition.log[_fjDate].entries.push(entry);
  // LOT N3 : les récents à un geste (12, distincts, avec la quantité), dans le
  // dossier. Relevés AVANT, pour que « Annuler » les rende tels quels.
  const _avantRecS=Array.isArray(currentUser.nutrition.recentsSaisie)?currentUser.nutrition.recentsSaisie.slice():undefined;
  try{ currentUser.nutrition.recentsSaisie=majRecents(currentUser.nutrition.recentsSaisie,entry); }catch(e){}
  // R27 — CE QUE L'AJOUT VA CHANGER A COTE DE L'ENTREE, releve AVANT : les
  // recents et le compteur d'usage de cet aliment. « Annuler » les rend tels
  // quels ; sans ca, un aliment ajoute par erreur resterait en tete des
  // recents et compterait pour devenir « fréquent ».
  const _avantRecents=Array.isArray(currentUser.nutrition.recentFoods)
    ?currentUser.nutrition.recentFoods.slice():undefined;
  const _ufAvant=currentUser.nutrition.usageFoods;
  const _avantUsage=(_ufAvant&&Object.prototype.hasOwnProperty.call(_ufAvant,String(f.id)))
    ?Object.assign({},_ufAvant[String(f.id)]):undefined;
  // Les recents resolvent par _ciqualDB.find(f=>f.id===id) : un identifiant
  // OFF n y serait jamais retrouve, et la ligne serait morte.
  // FREQUENTS : le nombre de fois qu un aliment a ete ajoute, et la derniere.
  // Les recents disent « tu viens de t en servir », les frequents disent « tu
  // t en sers tout le temps » — ce ne sont pas les memes aliments, et un
  // athlete regulier voyait ses dix recents balayes par une seule journee
  // inhabituelle.
  try{
    if(!currentUser.nutrition.usageFoods) currentUser.nutrition.usageFoods={};
    const _uf=currentUser.nutrition.usageFoods;
    const _ck=String(f.id);
    const _pr=_uf[_ck]||{n:0,t:0};
    _uf[_ck]={n:(_pr.n||0)+1,t:Date.now()};
    // PLAFOND : au-dela de 300 aliments comptes, on retire les moins utilises.
    // Sans quoi ce dictionnaire grossit sans fin dans un dossier synchronise.
    const _cles=Object.keys(_uf);
    if(_cles.length>300){
      _cles.sort((x,y)=>((_uf[y].n||0)-(_uf[x].n||0))||((_uf[y].t||0)-(_uf[x].t||0)));
      const _neuf={};
      for(const _k of _cles.slice(0,300)) _neuf[_k]=_uf[_k];
      currentUser.nutrition.usageFoods=_neuf;
    }
  }catch(e){}
  if(typeof f.id==='number'){
    let rec=currentUser.nutrition.recentFoods||[];
    currentUser.nutrition.recentFoods=[f.id,...rec.filter(id=>id!==f.id)].slice(0,10);
  }
  _fjIdNeuf=entry.id;
  // R27 — LE BANDEAU DIT « AJOUTÉ ✓ » : le toast de succes le repeterait. Le
  // toast d'ECHEC d'ecriture, lui, reste — c'est la seule chose qu'il dise.
  if(!saveUser()) toastEcriture(false,'','cet aliment est');
  try{ _nutGeste(_fjDate); }catch(e){}
  // R27 — ON ENCHAINE SUR L'ALIMENT SUIVANT. Un repas, c'est trois ou quatre
  // aliments : revenir a la nutrition apres chacun obligeait a redescendre
  // jusqu'au journal et a rouvrir la recherche. « Terminer », dans le bandeau,
  // ramene au journal — sur le jour ou l'on vient d'ecrire (_fjDate).
  _fjRepasChoisi=true;
  const _n=currentUser.nutrition;
  _fjSaisieAjout={date:_fjDate,id:entry.id,entree:entry,nom:entry.nom,qty:entry.qty,repas:entry.repas,
    annule:false,cleUsage:String(f.id),avantRecents:_avantRecents,avantUsage:_avantUsage,
    avantRecS:_avantRecS,apresRecS:Array.isArray(_n.recentsSaisie)?_n.recentsSaisie.slice():undefined,
    apresRecents:Array.isArray(_n.recentFoods)?_n.recentFoods.slice():undefined,
    apresUsage:(_n.usageFoods&&_n.usageFoods[String(f.id)])?Object.assign({},_n.usageFoods[String(f.id)]):undefined};
  _fjRetourRecherche();
}
// ══ R27 — LA SAISIE ENCHAINEE : LE BANDEAU, « ANNULER », « TERMINER » ══════
//
// PHRASE DU BANDEAU. « ajouté à <repas> » ne se dit pas en français pour
// quatre repas sur cinq : on ecrit la preposition qui va avec chacun.
const FJ_REPAS_AJOUTE=Object.freeze({matin:'au petit-déjeuner',dejeuner:'au déjeuner',
  diner:'au dîner',collation:'à la collation',coucher:'au coucher'});
function _fjRetourRecherche(){
  go('s-food-search');
  const res=document.getElementById('fj-results-list');
  if(res) res.innerHTML='';
  const inp=document.getElementById('fj-search-input');
  // SANS DELAI, contrairement a openFoodSearch : le focus pose dans le meme
  // geste que le toucher « Ajouter » est le seul que les telephones laissent
  // ouvrir le clavier. preventScroll : go() vient de remettre la page en haut.
  if(inp){ inp.value=''; try{ inp.focus({preventScroll:true}); }catch(e){ try{ inp.focus(); }catch(_){} } }
  _renderFjBandeau();
  // Re-rendue : le reseau a pu tomber pendant la saisie.
  _renderFjActions();
  if(_ciqualDB) _renderFjRecent(); else _loadCiqual().then(()=>_renderFjRecent());
}
// L'ENTREE EST-ELLE ENCORE LA, EXACTEMENT UNE FOIS ? deleteFoodEntry retire
// PAR IDENTIFIANT tout ce qui le porte : si deux entrees le partageaient — une
// copie de la veille numerotee dans la meme milliseconde —, « Annuler » en
// retirerait deux. Et si elle a disparu ou change entre-temps — synchronisation,
// remplacement par une equivalence —, il n'y a plus rien a annuler. Dans les
// deux cas, pas de lien : un bouton qui ment est pire que pas de bouton.
function _fjAjoutRetirable(s){
  if(!s||s.annule) return false;
  const memes=_fjEntrees(s.date).filter(e=>e&&e.id===s.id);
  if(memes.length!==1) return false;
  const e=memes[0];
  return e===s.entree||(e.nom===s.nom&&e.qty===s.qty&&e.repas===s.repas);
}
function _htmlFjBandeau(s){
  if(!s) return '';
  const qte=String(s.qty).replace('.',',')+' g';
  const ou=FJ_REPAS_AJOUTE[s.repas]||('au repas « '+(FJ_REPAS_LIB[s.repas]||s.repas)+' »');
  // Le nom en gras : les noms Ciqual portent eux-memes des virgules et des
  // « ajouté » (« Riz blanc, cuit, sans sel ajouté »), la phrase doit rester
  // lisible d'un coup. Espace insecable devant ✓ : il ne part pas seul a la ligne.
  const phrase=s.annule
    ?'<strong>'+escapeHtml(s.nom)+'</strong> '+qte+' retiré du journal'
    :'<strong>'+escapeHtml(s.nom)+'</strong> '+qte+' ajouté '+escapeHtml(ou)+' '+icon('coche',14);
  return '<div class="fj-bandeau'+(s.annule?' annule':'')+'">'
    +'<div class="fj-bandeau-t">'+phrase+'</div>'
    +'<div class="fj-bandeau-a">'
    +(_fjAjoutRetirable(s)?'<button type="button" class="fj-bandeau-annuler" onclick="annulerAjoutAliment()">Annuler</button>':'<span></span>')
    +'<button type="button" class="btn btn-sm fj-bandeau-fin" onclick="terminerSaisieAliments()">Terminer</button>'
    +'</div></div>';
}
function _renderFjBandeau(){
  const z=document.getElementById('fj-ajout-bandeau');
  if(z) z.innerHTML=_htmlFjBandeau(_fjSaisieAjout);
}
// « ANNULER » PASSE PAR deleteFoodEntry, la suppression du journal : pas une
// seconde facon de retirer une entree. Rend true si l'entree est partie.
function annulerAjoutAliment(){
  const s=_fjSaisieAjout;
  if(!s||s.annule) return false;
  if(!_fjAjoutRetirable(s)){
    toast('Cet aliment n\'est plus dans ton journal tel qu\'il a été ajouté : rien n\'a été retiré.','var(--orange)');
    _renderFjBandeau();
    return false;
  }
  // LES COMPTEURS D'ABORD, pour que la sauvegarde de deleteFoodEntry les
  // emporte avec la suppression. Seulement s'ils sont encore ceux que l'ajout
  // a poses : un autre ajout entre-temps les a legitimement changes.
  const n=currentUser.nutrition||{};
  const j=v=>JSON.stringify(v===undefined?null:v);
  if(j(n.recentFoods)===j(s.apresRecents)){
    if(s.avantRecents===undefined) delete n.recentFoods; else n.recentFoods=s.avantRecents.slice();
  }
  if(j(n.recentsSaisie)===j(s.apresRecS)){
    if(s.avantRecS===undefined) delete n.recentsSaisie; else n.recentsSaisie=s.avantRecS.slice();
  }
  if(n.usageFoods&&j(n.usageFoods[s.cleUsage])===j(s.apresUsage)){
    if(s.avantUsage===undefined) delete n.usageFoods[s.cleUsage];
    else n.usageFoods[s.cleUsage]=Object.assign({},s.avantUsage);
  }
  deleteFoodEntry(s.date,s.id);
  if(_fjEntrees(s.date).some(e=>e&&e.id===s.id)){
    toast('L\'aliment n\'a pas pu être retiré.','var(--orange)');
    _renderFjBandeau();
    return false;
  }
  s.annule=true;
  _renderFjBandeau();
  if(_ciqualDB) _renderFjRecent();
  return true;
}
// « TERMINER » : le journal du jour ou l'on vient d'ecrire, et a sa hauteur.
// L'en-tete du jour en haut de l'ecran si le dernier aliment ajoute tient sous
// lui ; sinon le repas de cet aliment, pour qu'il soit sous les yeux.
function terminerSaisieAliments(){
  const s=_fjSaisieAjout;
  const date=(s&&s.date)||_fjDate;
  _fjSaisieAjout=null;
  loadNutrition(date);
  // loadNutrition peut d'abord demander l'age : on ne defile que si c'est
  // bien la nutrition qui s'est ouverte.
  if((document.querySelector('.screen.active')||{}).id!=='s-nutrition') return false;
  const viser=()=>{
    const nav=document.getElementById('fj-nav-slot');
    const neuf=document.querySelector('#fj-today-section .fj-entry.fj-neuf');
    let cible=nav||document.getElementById('fj-today-section');
    if(nav&&neuf){
      const barre=document.getElementById('client-tabbar');
      const bas=window.innerHeight-((barre&&barre.getBoundingClientRect().height)||0);
      if(neuf.getBoundingClientRect().bottom-nav.getBoundingClientRect().top>bas) cible=neuf.parentElement||neuf;
    }
    if(cible) _defiler(cible,{behavior:'instant'});
  };
  viser();
  // Une seconde fois apres la mise en page : les jauges et les cartes du haut
  // peuvent encore changer de hauteur au premier rendu.
  try{ requestAnimationFrame(viser); }catch(e){}
  return true;
}

function deleteFoodEntry(date,id){
  const log=currentUser.nutrition?.log?.[date];
  if(!log) return;
  log.entries=log.entries.filter(e=>e.id!==id);
  saveUser();
  _renderFjDaySummary(date);
}

function _renderFjDaySummary(date){
  // LA DATE AFFICHÉE DEVIENT LA DATE D'ÉCRITURE. saveFoodEntry écrit dans
  // log[_fjDate] ; les flèches de navigation, elles, ne touchaient pas
  // _fjDate. Les deux ne tenaient d'accord que parce qu'un seul chemin — le
  // bouton d'ajout, qui reporte la date affichée — le voulait bien. Un
  // appelant qui l'oublie écrivait dans le mauvais jour. Ici, la divergence
  // devient impossible plutôt que simplement improbable.
  if(date) _fjDate=date;
  // Une liste d equivalences ouverte vise une entree PRECISE : changer de
  // jour la laisserait pointer dans le vide.
  try{ if(_eqCtx&&_eqCtx.date!==date) fermerEquivalents(); }catch(e){}
  const el=document.getElementById('fj-today-section');
  if(!el) return;
  const todayStr=localISODate(new Date());
  const isToday=date===todayStr;
  const [_yy,_mm,_dd]=date.split('-').map(Number);
  const prevStr=localISODate(new Date(_yy,_mm-1,_dd-1));
  const nextStr=localISODate(new Date(_yy,_mm-1,_dd+1));
  const dateLbl=_libelleJourNut(date);
  const nextBtn=isToday
    ?`<button disabled style="flex-shrink:0;background:none;border:1px solid var(--border);color:var(--text-dim);border-radius:var(--r-2);padding:6px 12px;font-size:var(--fs-md);line-height:1;cursor:not-allowed">→</button>`
    :`<button onclick="_renderFjDaySummary('${nextStr}')" style="flex-shrink:0;background:none;border:1px solid var(--border);color:var(--text-mid);border-radius:var(--r-2);padding:6px 12px;cursor:pointer;font-size:var(--fs-md);line-height:1">→</button>`;
  const nut=currentUser.nutrition||{};
  const entries=(nut.log?.[date]?.entries)||[];
  const isOn=nutIsOnDay(date);
  // LE TOTAL DU JOUR N EST PLUS ADDITIONNE ICI. Il l etait pour les six tuiles,
  // puis pour les deux barres du sel et des fibres ; les deux sont parties dans
  // la carte des objectifs, qui refait la somme sur le meme journal. En garder
  // une seconde ici, que plus rien ne lit, c est se preparer a la voir diverger
  // le jour ou quelqu un la modifie sans modifier l autre. Il ne reste de ce
  // rendu qu une LISTE : ce que l athlete a mange, repas par repas.
  // UN SEUL RAPPEL MÉDICAL PAR ÉCRAN (build 1842) : le signal d'apport, rendu
  // au-dessus pour la même journée, porte déjà le sien.
  const _sigMicro=(function(){ try{ return !!_htmlSignalMicro(currentUser,date); }catch(e){ return false; } })();
  const _microHtml=_htmlCouvertureMicro(currentUser,undefined,{sansDisclaimer:_sigMicro});
  // Le repère de répartition ne se rend NULLE PART sur l'écran de l'athlète.
  // Il est parti d'ici d'abord, parce qu'il sortait deux fois dès que le
  // journal était visible ; la carte des objectifs, qui le gardait, ne le rend
  // plus non plus depuis le 24/08/2026. Le fantôme d'un `_repHtml` vide
  // laissait croire à un emplacement qui n'existe plus.
  // « coucher » ferme la journée. Il passe après « Collation », qui n'est pas à
  // une heure fixe et sert déjà de fourre-tout en fin de liste.
  const repasOrder=['matin','dejeuner','diner','collation','coucher'];
  const repasLabels={matin:'Petit-déjeuner',dejeuner:'Déjeuner',diner:'Dîner',collation:'Collation',coucher:'Avant de se coucher'};
  const grouped={};
  entries.forEach(e=>{const r=e.repas||'dejeuner';if(!grouped[r])grouped[r]=[];grouped[r].push(e);});
  // PAS DE BADGE SUR UNE DIÈTE NON CYCLÉE. Les deux jours portent alors les
  // mêmes cibles : annoncer « JOUR OFF » ferait croire à un total réduit qui
  // n'existe pas. Le badge dit une différence, il se tait quand il n'y en a pas.
  const dayBadge=!dieteCyclee(currentUser)?'':isOn
    ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:var(--fs-xs);font-weight:800;color:var(--success);background:var(--success-bg);border:1px solid var(--success-border);border-radius:var(--r-1);padding:2px 8px;letter-spacing:1px">${icon('zap',10)} JOUR ON</span>`
    : `<span style="display:inline-flex;align-items:center;gap:4px;font-size:var(--fs-xs);font-weight:800;color:var(--sub);background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-1);padding:2px 8px;letter-spacing:1px">${icon('moon',10)} JOUR OFF</span>`;
  // PLUS DE CADRE ROUGE AUTOUR DU JOURNAL. Demande de Kevin, 24/08/2026 : la
  // carte .nut-hud etait la troisieme de l ecran a porter le meme cadre et le
  // meme ciel d eclairs, pour un contenu qui n est ni un objectif ni un bilan
  // — une navigation, une consigne, un bouton. Ce qui reste ici est une liste.
  //
  // LA NAVIGATION ET LA CONSIGNE PARTENT DANS #fj-nav-slot, au-dessus de
  // l hydratation. L emplacement peut manquer : en diete stricte, l ecran
  // n est pas monte du tout.
  const _nav=document.getElementById('fj-nav-slot');
  if(_nav) _nav.innerHTML=`
    <div style="margin-bottom:20px;${_animEntree('fj-nav')}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <button onclick="_renderFjDaySummary('${prevStr}')" style="flex-shrink:0;background:none;border:1px solid var(--border);color:var(--text-mid);border-radius:var(--r-2);padding:6px 12px;cursor:pointer;font-size:var(--fs-md);line-height:1">←</button>
        <div style="flex:1;min-width:0;text-align:center">
          <div class="nut-titre" style="transform:none">${dateLbl}</div>
          <div style="margin-top:6px">${dayBadge}</div>
        </div>
        ${nextBtn}
      </div>
      ${htmlConsigneJournal(date,entries.length===0)}
    </div>`;
  el.innerHTML=`
    ${_htmlSelSemaine(currentUser,date)}
    ${_microHtml}
    ${_htmlDernierAjout(date)}
    <!-- 22 px SOUS LE BOUTON, ET NON 12. Le bloc d hydratation porte lui-meme
         une marge haute de 14 px, et deux marges voisines se fondent en la plus
         grande : 12 en donnaient donc 14, et les deux paraissaient colles. C est
         la marge du BOUTON qu on ouvre, pas celle du bloc : ce dernier est
         partage avec l ecran de progression et la fiche coach. -->
    ${isToday?`<button onclick="copierHier()" style="width:100%;margin-bottom:24px;padding:10px 0;background:none;border:1px dashed var(--border);border-radius:var(--r-3);color:var(--sub);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:700;letter-spacing:1px;cursor:pointer">Copier la journée d'hier</button>`:''}
    ${_htmlHydratationNut(currentUser,date)}
    ${repasOrder.map(r=>!grouped[r]?(date<=todayStr?_htmlRepasVide(date,r,repasLabels[r]):''):`
      <div style="margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <div style="flex:1;min-width:0;font-size:var(--fs-xs);color:var(--sub);letter-spacing:2px;font-weight:700;text-transform:uppercase">${repasLabels[r]}</div>
          ${!isToday?`<button onclick="refaireRepas('${date}','${r}')" style="flex-shrink:0;background:none;border:1px solid var(--border);border-radius:var(--r-2);color:var(--sub);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:700;letter-spacing:.5px;padding:6px 10px;cursor:pointer">Refaire aujourd'hui</button>`:''}
          <button type="button" class="fj-enr" onclick="ouvrirEnregistrerRepas('${date}','${r}')" aria-label="Enregistrer ce repas">Enregistrer</button>
        </div>
        ${_htmlNommerRepas(date,r)}
        ${grouped[r].map(e=>`<div class="fj-entry${e.id===_fjIdNeuf?' fj-neuf':''}">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(e.nom)}</div>
            <div style="font-size:var(--fs-xs);color:var(--sub);margin-top:2px">${[(e.recette&&e.unite)?escapeHtml(e.unite):e.qty+'g',_fragmentSiValeur('P ',e.p,'g'),_fragmentSiValeur('G ',e.c,'g'),_fragmentSiValeur('L ',e.l,'g')].filter(x=>x).join(' · ')}</div>
          </div>
          <div style="flex-shrink:0;margin-left:8px;text-align:right">
            ${e.kcal!=null?`<div style="font-family:'Bebas Neue','Arial Narrow',Impact,'Haettenschweiler','Franklin Gothic Condensed',sans-serif;font-weight:400;font-size:17px;letter-spacing:.5px;color:var(--red-text)">${e.kcal}<span style="font-size:var(--fs-xs);color:var(--sub);font-weight:400"> kcal${e.kcalEstimee?' estimées':''}</span></div>`:`<span style="font-size:var(--fs-xs);font-weight:800;color:var(--amber);background:#1a0e00;border:1px solid #3a1e00;border-radius:var(--r-1);padding:1px 6px;letter-spacing:.5px">VALEUR INDISPONIBLE</span>`}
            <button class="hit44" onclick="ouvrirEquivalents('${date}',${e.id})" title="Équivalences" aria-label="Voir des équivalences"
              style="background:none;border:none;color:var(--text-dim);font-size:var(--fs-md);cursor:pointer;padding:2px 4px;margin-top:4px">${icon('echange',14)}</button>
            <button class="hit44" onclick="deleteFoodEntry('${date}',${e.id})" style="background:none;border:none;color:var(--text-dim);font-size:var(--fs-md);cursor:pointer;padding:2px 4px;margin-top:4px">${icon('croix',14)}</button>
          </div>
        </div>`).join('')}
      </div>`).join('')}`;

  // LES DEUX CARTES PARLENT DU MÊME JOUR.
  //
  // La carte des objectifs vit dans un AUTRE conteneur (nut-diet-content) et
  // restait figée sur la date du système : en reculant d’un jour, l’écran
  // affichait deux badges JOUR ON/OFF contradictoires, et des cibles qui
  // n’étaient pas celles du jour consulté. On la re-rend ici, sur la date
  // affichée, parce que c’est ce rendu-ci qui SAIT quel jour est à l’écran.
  //
  // L’emplacement peut manquer — en diète stricte, le journal n’est pas
  // affiché du tout : on ne fabrique alors rien.
  const _slot=document.getElementById('nut-rings-slot');
  if(_slot) _slot.innerHTML=_renderStrictMacroRings(currentUser.nutrition||{},date);
  if(_slot) _animerJauges(_slot);
  // 1 300 ms : la duree de l animation plus une marge. Passe ce delai, le
  // marqueur s eteint pour tout le monde, y compris pour un rendu declenche
  // par autre chose qu un ajout.
  if(_fjIdNeuf!=null) setTimeout(()=>{_fjIdNeuf=null;},1300);
}
// Demande au Service Worker de mettre la base Ciqual (672 Ko) en cache.
// Appelé au premier affichage de l'écran nutrition seulement : la recherche
// d'aliment marchera hors-ligne ensuite, sans alourdir le 1er chargement.
// ── Signaux de séance vers le service worker ─────────────────────────────
// skipWaiting() était inconditionnel : un nouveau SW prenait le contrôle en
// pleine séance, après avoir purgé le cache. Le client ne rechargeait pas
// — controllerchange le retient déjà — mais les requêtes suivantes passaient
// par un cache vide, et une séance hors ligne pouvait perdre ses assets.
//
// L'ÉTAT EST ÉCRIT DANS LE CACHE PARTAGÉ, pas seulement posté.
//
// Poster à `reg.active` ne pouvait pas marcher : le drapeau est lu par le
// handler `install` du worker EN COURS D'INSTALLATION, qui ne partage aucune
// variable avec le worker actif. repcore-sw-data, lui, est vu par les deux.
//
// Le message reste envoyé, et à `reg.waiting` AUSSI : un worker déjà en
// attente ne lit plus rien du cache — il a fini son install — et c'est ce
// message-là qui le libère à la fin de la séance.
const SW_DATA_CACHE='repcore-sw-data';   // MÊME nom que SW_DATA dans sw.js
async function _swSeance(type){
  const enCours=(type==='SEANCE_EN_COURS');
  try{
    const c=await caches.open(SW_DATA_CACHE);
    await c.put('/seance-en-cours',
      new Response(JSON.stringify(enCours?{depuis:Date.now()}:null),
        {headers:{'Content-Type':'application/json'}}));
  }catch(e){}
  try{
    const reg=await navigator.serviceWorker?.ready;
    if(!reg) return;
    reg.active?.postMessage({type});
    reg.waiting?.postMessage({type});
  }catch(e){}
}
// Version du cache du SW, pour l'écran de synchronisation. Lue DANS sw.js
// plutôt que recopiée ici : deux sources finiraient par diverger.
let _swVersionCache=null;
async function versionSW(){
  if(_swVersionCache!==null) return _swVersionCache;
  try{
    const r=await fetch('./sw.js',{cache:'no-store'});
    if(!r.ok) return (_swVersionCache='');
    const t=await r.text();
    const m=t.match(/const\s+CACHE\s*=\s*'([^']+)'/);
    return (_swVersionCache=(m?m[1]:''));
  }catch(e){ return (_swVersionCache=''); }
}
function _renderVersionSW(){
  const z=document.getElementById('cloud-sw-version');
  if(!z) return;
  versionSW().then(v=>{ if(v) z.textContent='Version '+v; });
}
// Pastille : la page vient du cache, on le DIT. Un affichage rapide obtenu
// sur une copie n'est pas la même chose qu'un affichage à jour, et laisser
// croire le contraire est le vrai risque du délai de garde.
//
// toast() dure 2,8 s et existe déjà : une seconde pastille serait un second
// mécanisme à maintenir pour trois secondes d'affichage.
let _pastilleCacheFaite=false;
function _pastilleServiParCache(){
  if(_pastilleCacheFaite||!window._rcServiParCache) return false;
  _pastilleCacheFaite=true;
  try{ toast('Hors ligne : version en cache','var(--sub)'); }catch(e){}
  return true;
}
// ── Carte « Capacité », créateur seulement ──────────────────────────────
// C'est une PENTE, pas une vérité, et l'écran le dit deux fois plutôt qu'une :
// la console Firebase reste la seule source faisant foi. Un chiffre affiché
// sans cette réserve serait pris pour une mesure.
const QUOTA_REGISTRE='Estimation CLIENT, mesurée sur cet appareil seulement : '
  +'sans déduplication entre appareils, et sans le trafic de tes athlètes. '
  +'La console Firebase est la seule source faisant foi.';
function _fmtOctets(n){
  const u=['o','Ko','Mo','Go'];
  let v=Number(n)||0,i=0;
  while(v>=1024&&i<u.length-1){ v/=1024; i++; }
  return (i?v.toFixed(v<10?2:1):Math.round(v))+' '+u[i];
}
// PURE. Rend '' pour qui n'est pas le créateur : la carte n'existe alors
// PAS dans le DOM, elle n'est pas masquée.
function _htmlCapacite(user){
  const u=user||currentUser;
  if(!u||u.email!==CREATOR_EMAIL) return '';
  const e=etatQuota();
  const pj=projectionQuota(e);
  const pct=(e.part*100);
  // Un relevé qui n'a pas vu le début du mois n'annonce pas de pourcentage :
  // un chiffre partiel présenté comme complet est pire qu'une absence.
  const chiffre=e.complet
    ? _fmtOctets(e.octets)+' · '+(pct<0.1?'<0,1':pct.toFixed(1)).replace('.',',')+' %'
    : 'relevé incomplet';
  const nComptes=(()=>{ try{ return Object.keys(DB.get('users')||{}).length; }catch(x){ return 0; } })();
  const poids=(()=>{
    try{
      const us=Object.values(DB.get('users')||{});
      if(!us.length) return null;
      let tot=0,photos=0;
      for(const x of us){
        const s1=JSON.stringify(x).length; tot+=s1;
        const sans=JSON.stringify(x,(k,v)=>
          (typeof v==='string'&&v.indexOf('data:image')===0)?undefined:v).length;
        photos+=(s1-sans);
      }
      return {moyen:Math.round(tot/us.length),partPhotos:tot?photos/tot:0};
    }catch(x){ return null; }
  })();
  const l=(t,v)=>`<div style="display:flex;justify-content:space-between;gap:10px;font-size:var(--fs-sm);padding:4px 0">
    <span style="color:var(--sub)">${escapeHtml(t)}</span><span style="color:var(--text)">${escapeHtml(v)}</span></div>`;
  return `<div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-3);padding:16px;margin-bottom:20px">
    <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:10px">Capacité</div>
    ${l('Ce mois-ci',chiffre)}
    ${e.complet?l('Quota mensuel',_fmtOctets(QUOTA_MOIS_OCTETS)):''}
    ${l('Appels réseau comptés',String(e.appels))}
    ${l('Comptes sur cet appareil',String(nComptes))}
    ${poids?l('Poids moyen d\'un dossier',_fmtOctets(poids.moyen)):''}
    ${poids&&poids.partPhotos>0.02?l('dont photos',Math.round(poids.partPhotos*100)+' %'):''}
    ${pj?l('Franchissement projeté',pj.depasse?'quota déjà dépassé':(pj.date.toLocaleDateString('fr-FR')+' (~'+pj.joursRestants+' j)')):''}
    ${l('Dernier relevé',e.maj?new Date(e.maj).toLocaleString('fr-FR'):'aucun')}
    ${e.degrade?`<div style="margin-top:10px;background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:var(--r-2);padding:10px 12px;font-size:var(--fs-xs);color:var(--orange);line-height:1.6">Au-delà de ${Math.round(SEUIL_DEGRADATION*100)} % : synchronisation périodique ralentie à ${Math.round(SYNC_PERIODE_DEGRADEE_MS/60000)} min et préchargement de la base alimentaire suspendu. Journalisation et envoi des séances INCHANGÉS.</div>`
      :e.alerte?`<div style="margin-top:10px;background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:var(--r-2);padding:10px 12px;font-size:var(--fs-xs);color:var(--orange);line-height:1.6">Au-delà de ${Math.round(SEUIL_ALERTE*100)} % du quota estimé.</div>`:''}
    ${_htmlCapaciteGlobale()}
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:10px">${escapeHtml(QUOTA_REGISTRE)}</div>
  </div>`;
}
/**
 * LE RELEVÉ DE TOUS LES APPAREILS, ressource par ressource.
 *
 * ⚠ ET IL DIT QUAND IL NE SAIT PAS. Trois états se ressemblent à l'écran et ne
 *   veulent pas du tout dire la même chose : « personne n'a rien consommé »,
 *   « je n'ai pas encore lu » et « mes compteurs sont refusés ». Le troisième
 *   arrive tant que database.rules.json n'est pas déployé — la liste blanche de
 *   noms du nœud metrics refuse les quatre compteurs — et afficher zéro dans ce
 *   cas serait annoncer un service au repos alors qu'on ne mesure rien.
 */
function _htmlCapaciteGlobale(){
  const l=(t,v,c)=>`<div style="display:flex;justify-content:space-between;gap:10px;font-size:var(--fs-sm);padding:4px 0">
    <span style="color:var(--sub)">${escapeHtml(t)}</span><span style="color:${c||'var(--text)'}">${escapeHtml(v)}</span></div>`;
  const q=rcqEtat();
  const g=_capaciteGlobale;
  const titre=`<div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:2px;font-weight:700;text-transform:uppercase;margin:14px 0 6px;border-top:1px solid var(--border);padding-top:12px">Tous appareils, ce mois</div>`;
  if(q.refuses>0&&!q.envoyes)
    return titre+`<div style="font-size:var(--fs-xs);color:var(--orange);line-height:1.6">
      ${q.refuses} écriture(s) de compteur REFUSÉE(S). Les quatre noms (oct_in_ko,
      oct_out_ko, cld_envois, cld_ko) doivent être déclarés dans database.rules.json,
      et les règles déployées : <code>firebase deploy --only database</code>.
      Tant que ce n'est pas fait, ce bloc ne mesure rien, et ne prétend rien.</div>`;
  if(!g) return titre+`<div style="font-size:var(--fs-xs);color:var(--text-faint);line-height:1.6">Lecture en cours…</div>`;
  if(g.erreur) return titre+`<div style="font-size:var(--fs-xs);color:var(--orange);line-height:1.6">Relevé illisible : ${escapeHtml(g.erreur)}. Le droit de lecture sur le nœud metrics est réservé au créateur, et il vient des règles : déployées ou non.</div>`;
  if(!g.jours) return titre+`<div style="font-size:var(--fs-xs);color:var(--text-faint);line-height:1.6">Aucun compteur pour ${escapeHtml(g.mois||'')} : soit rien n'a été consommé, soit les règles ne sont pas déployées. ${q.envoyes?('Cet appareil en a fait accepter '+q.envoyes+', donc la première hypothèse est la bonne.'):'Cet appareil n\'en a encore fait accepter aucun.'}</div>`;
  const part=(o,max)=>{ const p=o/max*100; return (p<0.1?'<0,1':p.toFixed(1)).replace('.',',')+' %'; };
  const rtdb=g.rtdbOctets;
  // LA PROJECTION REPREND projectionQuota, sur l'état AGRÉGÉ : même pente, même
  // règle du « pas assez de recul », un seul calcul dans le fichier.
  const pj=projectionQuota({octets:rtdb,debut:new Date(g.premier+'T00:00:00').getTime()});
  return titre
    +l('Base : entrant',_fmtOctets(g.oct_in_ko*1024))
    +l('Base : sortant',_fmtOctets(g.oct_out_ko*1024))
    +l('Base : total / quota',_fmtOctets(rtdb)+' / '+_fmtOctets(QUOTA_MOIS_OCTETS)+' · '+part(rtdb,QUOTA_MOIS_OCTETS),
       rtdb>=QUOTA_MOIS_OCTETS*SEUIL_DEGRADATION?'var(--orange)':'var(--text)')
    +l('Hébergeur : envois',String(g.cld_envois))
    +l('Hébergeur : octets reçus',_fmtOctets(g.cldOctets)+' / '+_fmtOctets(CLOUDINARY_QUOTA_MOIS_OCTETS)
       +' · '+part(g.cldOctets,CLOUDINARY_QUOTA_MOIS_OCTETS),
       g.cldOctets>=CLOUDINARY_QUOTA_MOIS_OCTETS*SEUIL_DEGRADATION?'var(--orange)':'var(--text)')
    +l('Jours relevés',g.jours+' (du '+String(g.premier).slice(8)+' au '+String(g.dernier).slice(8)+')')
    +(pj?l('Franchissement projeté',pj.depasse?'quota déjà dépassé'
        :(pj.date.toLocaleDateString('fr-FR')+' (~'+pj.joursRestants+' j)')):'')
    +(q.refuses?l('Compteurs refusés',String(q.refuses),'var(--orange)'):'')
    +`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:8px">Le plafond de l'hébergeur est une ESTIMATION du plan gratuit (25 crédits) : à vérifier sur le tableau de bord Cloudinary avant d'en tirer une décision.</div>`;
}
function _renderCapacite(){
  const z=document.getElementById('mt-capacite');
  if(!z) return;
  z.innerHTML=_htmlCapacite(currentUser);
  // LE RELEVÉ AGRÉGÉ EST LU UNE FOIS, PUIS LA CARTE SE REDESSINE. Une lecture
  // réseau dans un rendu synchrone n'existe pas : ce qui existe, c'est un
  // rendu tout de suite avec ce qu'on sait, et un second quand on en sait plus.
  if(_capaciteGlobale===null&&currentUser&&currentUser.email===CREATOR_EMAIL){
    etatCapaciteGlobale().then(g=>{
      _capaciteGlobale=g||{erreur:'aucune réponse'};
      const y=document.getElementById('mt-capacite');
      if(y) y.innerHTML=_htmlCapacite(currentUser);
    }).catch(()=>{});
  }
}
let _ciqualPrefetchAsked=false;
function _prefetchCiqual(){
  if(_ciqualPrefetchAsked) return;
  // 852 Ko en une fois : c'est le premier poste à suspendre quand le quota
  // se tend. La recherche d'aliment continue de fonctionner EN LIGNE ;
  // seule sa disponibilité hors-ligne est reportée.
  if(quotaDegrade()) return;
  _ciqualPrefetchAsked=true;
  try{
    navigator.serviceWorker?.ready
      .then(reg=>reg.active?.postMessage({type:'PREFETCH_CIQUAL'}))
      .catch(()=>{});
  }catch(e){}
}
// `dateAff` traverse jusqu'au journal. Sans argument, aujourd'hui : c'est le
// comportement de tous les appelants existants.
// `dateCaff` EST DISTINCTE de `dateAff` : le journal alimentaire et le suivi
// caféine se naviguent séparément, chacun avec sa propre date. Les confondre
// ferait sauter le journal au jour de la caféine, ou l’inverse.
function loadNutrition(dateAff,dateCaff){
  // Les anciens clics du ±20 (voir ajustKcal) : chez un athlète SANS coach,
  // c'est ici qu'ils sont retirés ; avec un coach, sur sa fiche à lui, pour
  // qu'un même dossier ne soit pas corrigé deux fois.
  try{
    if(currentUser&&!(currentUser.coachEmailKey||currentUser.coachId)&&_ajustMigrer(currentUser)) saveUser();
  }catch(e){}
  // SANS COACH (build 1833) : phase et objectif réconciliés, puis les cibles
  // réécrites si le calcul s'écarte de plus de 20 kcal de ce qui est stocké.
  // Une seule écriture, sans toast ; hors ligne, la copie locale suffit.
  try{
    let ch=false;
    if(syncPhaseObjectif(currentUser)) ch=true;
    if(resyncCiblesAthlete(currentUser)) ch=true;
    if(ch){ currentUser.updatedAt=Date.now(); saveUser(); CLOUD.pushOne(currentUser.email,currentUser); }
  }catch(e){}
  // ⚠ PREMIER CALCUL DE CHARGE : l'ecran de nutrition est celui qui calcule
  // les reperes energetiques — mbEstime a besoin de l'age ET du genre, et
  // sans eux il rend null, c'est-a-dire un ecran de chiffres absents sans
  // explication. On demande donc les deux ICI, avec la phrase qui dit
  // pourquoi, plutot qu'a l'inscription.
  //
  // Un coach n'est pas concerne : il lit les reperes de ses athletes, pas les
  // siens.
  try{
    if(currentUser&&currentUser.role!=='coach'&&!naissanceComplete(currentUser)){
      if(!demanderNaissanceGenre('charge',()=>loadNutrition(dateAff,dateCaff))) return;
    }
  }catch(e){}
  go('s-nutrition');
  _prefetchCiqual();
  const nut=currentUser.nutrition||{};
  const dt=typeDiete(nut);
  // R26 — le <select> de tete est parti. L'option verrouillee, son cadenas et
  // la raison du verrou vivent dans la feuille « Mon approche »
  // (_htmlChoixDiete), rendue a chaque ouverture ; le bouton de tete (R34)
  // est ecrit par _renderNutriContent.
  _renderNutriContent(dt,dateAff);
  loadSuppEmbedded();
  loadCaffeineEmbedded(dateCaff);
}

// ======= NUTRITION COACH (gestion plan client) =======

// ══════════════ POINT DE DÉPART NUTRITIONNEL ════════════════════════════════
// Une PROPOSITION, jamais une prescription. Rien de ce qui suit n'écrit dans
// nutrition.macros : le coach relit et enregistre lui-même, et côté athlète la
// proposition ne s'affiche que si AUCUN coach n'a rempli les objectifs.
//
// Tout est recalculé à la lecture, depuis le DERNIER bilan. Un nouveau bilan
// change donc la proposition sans qu'il y ait quoi que ce soit à migrer.

// ── Métabolisme de base : deux formules, choisies par la donnée disponible ──
// Mifflin-St Jeor ne demande que poids, taille, âge et sexe. C'est elle qui
// porte la différence homme / femme : +5 chez l'homme, −161 chez la femme. On
// n'ajoute donc aucun correctif de sexe par-dessus.

// ══════════════ DÉPENSE : PROFESSION + SPORTS ═══════════════════════════════
// Deux entrées nouvelles au bilan, deux barèmes. Comme REPERES_VOLUME, ce sont
// des repères de PRATIQUE DE TERRAIN et non des mesures : la dépense réelle
// d'une même personne varie d'un jour à l'autre, et deux tables publiées ne
// donnent jamais les mêmes chiffres. Point de départ ajustable, jamais verdict.

// ── Sports : des MET par intensité, et le POIDS de l'athlète ───────────────
// ⚠ DES MET, PLUS DES kcal ABSOLUES (30/09/2026). L'ancienne table donnait
//   la même dépense à une athlète de 55 kg et à un athlète de 100 kg : une
//   heure de musculation modérée valait 350 kcal pour les deux. La dépense
//   d'un effort est proportionnelle à la masse déplacée ; le Compendium of
//   Physical Activities (Ainsworth et al., 2011) la tabule en MET, 1 MET
//   valant environ 1 kcal par kilo et par heure.
//
// MET NETS : kcal/h = (MET − 1) × poids. Le « 1 » est le métabolisme de
// repos de cette heure-là, que le NAF compte déjà (métabolisme × NAF couvre
// les 24 heures). Le laisser compterait deux fois la même heure.
//
// Les valeurs sont celles du Compendium 2011 (codes 01xxx à 21xxx), à
// l'intensité la plus proche ; quand le Compendium n'a qu'une ou deux
// lignes pour un sport (golf, surf, ping-pong…), la troisième est interpolée.
// Ce sont des repères, pas des mesures : la même heure varie d'une personne
// et d'une séance à l'autre.
const SPORT_INTENSITES=Object.freeze([
  Object.freeze({cle:'faible', lib:'Faible'}),
  Object.freeze({cle:'moderee',lib:'Modérée'}),
  Object.freeze({cle:'haute',  lib:'Haute'})
]);
// Sans poids connu, on compte sur 75 kg, et c'est dit (sportPoidsDefaut).
const SPORT_POIDS_DEFAUT=75;
const SPORTS_MET=Object.freeze({
  'Marche':          Object.freeze([2.8,3.5,5.0]),
  'Course à pied':   Object.freeze([7.0,9.8,11.5]),
  'Vélo':            Object.freeze([4.0,6.8,10.0]),
  'Natation':        Object.freeze([5.8,8.3,9.8]),
  'Tennis':          Object.freeze([5.0,7.3,8.0]),
  'Football':        Object.freeze([7.0,8.0,10.0]),
  'Musculation':     Object.freeze([3.5,5.0,6.0]),
  'Yoga':            Object.freeze([2.5,3.0,4.0]),
  'Ski':             Object.freeze([5.3,6.8,9.0]),
  'Boxe':            Object.freeze([5.5,7.8,12.8]),
  'Danse':           Object.freeze([3.0,5.0,7.3]),
  'Randonnée':       Object.freeze([5.3,6.0,7.8]),
  'Trail':           Object.freeze([8.0,9.0,11.0]),
  'Corde à sauter':  Object.freeze([8.8,11.8,12.3]),
  'Rameur':          Object.freeze([4.8,7.0,8.5]),
  'Vélo elliptique': Object.freeze([4.0,5.0,6.5]),
  'Spinning':        Object.freeze([6.8,8.5,11.0]),
  'CrossFit':        Object.freeze([5.0,8.0,10.0]),
  'HIIT':            Object.freeze([5.0,8.0,10.0]),
  'Escalade':        Object.freeze([5.8,7.3,8.0]),
  'Basket':          Object.freeze([4.5,6.5,8.0]),
  'Handball':        Object.freeze([6.0,8.0,12.0]),
  'Rugby':           Object.freeze([6.3,7.3,8.3]),
  'Volley':          Object.freeze([3.0,4.0,6.0]),
  'Badminton':       Object.freeze([4.5,5.5,7.0]),
  'Padel':           Object.freeze([4.5,6.0,7.0]),
  'Squash':          Object.freeze([7.3,9.0,12.0]),
  'Arts martiaux':   Object.freeze([5.3,7.8,10.3]),
  'Judo':            Object.freeze([5.3,7.8,10.3]),
  'Pilates':         Object.freeze([2.8,3.0,3.8]),
  'Stretching':      Object.freeze([2.3,2.5,3.0]),
  'Aquagym':         Object.freeze([3.5,5.3,6.0]),
  'Équitation':      Object.freeze([3.8,5.8,7.3]),
  'Golf':            Object.freeze([3.5,4.3,4.8]),
  'Roller':          Object.freeze([7.0,9.8,12.3]),
  'Patinage':        Object.freeze([5.5,7.0,9.0]),
  'Surf':            Object.freeze([3.0,4.0,5.0]),
  'Kayak':           Object.freeze([3.5,5.0,8.0]),
  'Ping-pong':       Object.freeze([3.5,4.0,5.0]),
  'Athlétisme':      Object.freeze([6.0,8.0,10.0]),
  'Gymnastique':     Object.freeze([3.8,5.0,6.5]),
  // 1 MET = le repos : zéro kcal nette.
  'Aucun':           Object.freeze([1,1,1])
});
// PURE. kcal NETTES par heure : (MET − 1) × poids, 75 kg sans poids connu.
function kcalHeureSport(sport,intensite,poids){
  const t=SPORTS_MET[sport];
  if(!t) return null;
  const i=SPORT_INTENSITES.findIndex(x=>x.cle===intensite);
  const met=t[i<0?1:i];
  const kg=Number(poids)>0?Number(poids):SPORT_POIDS_DEFAUT;
  return Math.round(Math.max(0,met-1)*kg);
}
// Le poids qui chiffre le sport : le poids nutritionnel commun (dernière
// pesée, sinon poids d'inscription), 75 kg à défaut.
function poidsSport(user){
  let kg=null;
  try{ kg=poidsNutritionnel(user).kg; }catch(e){ kg=null; }
  return (Number(kg)>0)?Number(kg):SPORT_POIDS_DEFAUT;
}
// Dépense sportive rapportée au JOUR : le coach raisonne en heures par
// semaine, le calcul en kcal par jour. On divise donc par sept, comme demandé.
function depenseSportsParJour(liste,poids){
  const l=Array.isArray(liste)?liste:[];
  let semaine=0; const detail=[];
  for(const e of l){
    if(!e||!e.sport) continue;
    const h=Number(e.heures);
    const kh=kcalHeureSport(e.sport,e.intensite,poids);
    if(kh==null||!(h>0)) continue;
    semaine+=kh*h;
    detail.push(e.sport.toLowerCase()+' '+String(h).replace('.',',')+' h');
  }
  return {jour:Math.round(semaine/7),semaine:Math.round(semaine),detail};
}

// ── Professions : familles, et niveau d'activité de chacune ────────────────
// Le facteur ne compte QUE l'activité hors sport — ce que la littérature
// appelle le NEAT. Il est donc plus bas que les multiplicateurs classiques,
// qui englobent l'entraînement : ici le sport est ajouté à part, en kcal, et
// le compter deux fois gonflerait la dépense de plusieurs centaines de kcal.
// ⚠ LES FACTEURS SONT CEUX DE L'ECHELLE DU TABLEUR (NAF_ECHELLE, via
//   NAF_DEPUIS_METIER), ET PLUS L'ANCIENNE 1,15 / 1,25 / 1,40 / 1,55 (QA du
//   27/09/2026). Le calcul des besoins etait passe a l'echelle du tableur, mais
//   ce tableau-ci gardait l'ancienne : le bilan annoncait « facteur 1,15 » a
//   l'athlete pendant que ses cibles etaient calculees a 1,20, et le plancher
//   calorique se plafonnait sur une depense plus basse que celle affichee.
const METIER_NIVEAUX=Object.freeze({
  sedentaire:Object.freeze({lib:'Assis la majeure partie de la journée', f:1.2}),
  leger:     Object.freeze({lib:'Debout, peu de marche',                 f:1.4}),
  modere:    Object.freeze({lib:'Marche soutenue, charges légères',      f:1.5}),
  lourd:     Object.freeze({lib:'Effort physique continu, port de charges',f:1.6})
});
const METIERS_FAMILLES=Object.freeze([
  Object.freeze({fam:'Bureau, gestion, informatique',n:'sedentaire',l:Object.freeze([
    'Comptable','Contrôleur de gestion','Assistant administratif','Secrétaire',
    'Développeur','Ingénieur informatique','Analyste','Data analyst','Chef de projet',
    'Juriste','Avocat','Notaire','Banquier','Conseiller clientèle','Assureur',
    'Ressources humaines','Chargé de recrutement','Community manager','Graphiste',
    'Rédacteur','Traducteur','Architecte','Dessinateur industriel','Télé-conseiller',
    'Standardiste','Statisticien','Consultant','Chercheur','Cadre dirigeant'])}),
  Object.freeze({fam:'Enseignement et petite enfance',n:'leger',l:Object.freeze([
    'Enseignant','Professeur des écoles','Professeur de collège ou lycée',
    'Formateur','Éducateur spécialisé','Animateur','Assistante maternelle',
    'Auxiliaire de puériculture','Agent territorial d\'école','Surveillant scolaire'])}),
  Object.freeze({fam:'Santé et soin',n:'modere',l:Object.freeze([
    'Infirmier','Aide-soignant','Auxiliaire de vie','Kinésithérapeute',
    'Ostéopathe','Ergothérapeute','Sage-femme','Ambulancier','Brancardier',
    'Manipulateur radio','Préparateur en pharmacie','Dentiste','Vétérinaire',
    'Aide médico-psychologique'])}),
  Object.freeze({fam:'Santé assise',n:'sedentaire',l:Object.freeze([
    'Médecin généraliste','Médecin spécialiste','Psychologue','Pharmacien',
    'Diététicien','Orthophoniste','Radiologue'])}),
  Object.freeze({fam:'Commerce et vente',n:'leger',l:Object.freeze([
    'Vendeur','Conseiller de vente','Caissier','Hôte de caisse','Commercial',
    'Représentant','Chef de rayon','Responsable de magasin','Fleuriste',
    'Coiffeur','Esthéticienne','Opticien','Bijoutier'])}),
  Object.freeze({fam:'Restauration et hôtellerie',n:'modere',l:Object.freeze([
    'Serveur','Barman','Cuisinier','Chef de cuisine','Commis de cuisine',
    'Plongeur','Pâtissier','Boulanger','Boucher','Charcutier','Poissonnier',
    'Femme ou valet de chambre','Réceptionniste'])}),
  Object.freeze({fam:'Bâtiment et travaux publics',n:'lourd',l:Object.freeze([
    'Maçon','Charpentier','Couvreur','Plaquiste','Carreleur','Peintre en bâtiment',
    'Plombier','Chauffagiste','Électricien','Menuisier','Serrurier','Terrassier',
    'Coffreur','Ferrailleur','Grutier','Conducteur d\'engins','Chef de chantier'])}),
  Object.freeze({fam:'Industrie et logistique',n:'modere',l:Object.freeze([
    'Opérateur de production','Agent de fabrication','Technicien de maintenance',
    'Soudeur','Chaudronnier','Tourneur-fraiseur','Mécanicien','Carrossier',
    'Cariste','Préparateur de commandes','Magasinier','Agent de conditionnement'])}),
  Object.freeze({fam:'Manutention et livraison',n:'lourd',l:Object.freeze([
    'Manutentionnaire','Déménageur','Livreur','Coursier','Éboueur','Docker',
    'Agent de tri','Facteur'])}),
  Object.freeze({fam:'Transport',n:'sedentaire',l:Object.freeze([
    'Chauffeur routier','Chauffeur de bus','Chauffeur de taxi','Chauffeur VTC',
    'Conducteur de train','Pilote','Contrôleur des transports'])}),
  Object.freeze({fam:'Agriculture et espaces verts',n:'lourd',l:Object.freeze([
    'Agriculteur','Éleveur','Maraîcher','Viticulteur','Jardinier','Paysagiste',
    'Bûcheron','Ouvrier agricole','Horticulteur'])}),
  Object.freeze({fam:'Sécurité et secours',n:'modere',l:Object.freeze([
    'Policier','Gendarme','Pompier','Militaire','Agent de sécurité','Vigile',
    'Maître-nageur','Surveillant pénitentiaire','Secouriste'])}),
  Object.freeze({fam:'Propreté et services',n:'modere',l:Object.freeze([
    'Agent d\'entretien','Agent de propreté','Femme ou homme de ménage',
    'Laveur de vitres','Gardien d\'immeuble','Concierge','Agent de restauration'])}),
  Object.freeze({fam:'Sport et animation',n:'lourd',l:Object.freeze([
    'Coach sportif','Éducateur sportif','Professeur de sport','Préparateur physique',
    'Sportif professionnel','Moniteur de ski','Guide de haute montagne',
    'Professeur d’EPS','Animateur sportif',
    'Moniteur de fitness','Professeur de danse','Professeur de yoga'])}),
  // ⚠ ENCADRER UNE SALLE N'EST PAS Y COACHER. Aucun de ces intitules n'etait
  // dans la table : le facteur retombait sur le niveau de base, et le calcul
  // perdait 20 % sur le metier de Kevin lui-meme. Ils sont a « Debout, peu de
  // marche » et non au niveau des coachs — on tient l'accueil, on regle des
  // machines et on marche dans la salle, on ne demontre pas les seances a
  // longueur de journee. C'est le niveau que Kevin retient dans son tableur.
  Object.freeze({fam:'Encadrement de salle de sport',n:'leger',l:Object.freeze([
    'Responsable de salle','Gérant de salle','Directeur de salle',
    'Manager de salle','Responsable de club','Gérant de salle de sport',
    'Conseiller sportif','Réceptionniste de salle','Responsable de club de sport'])}),
  Object.freeze({fam:'Sans activité professionnelle',n:'sedentaire',l:Object.freeze([
    'Étudiant','Sans emploi','Retraité','Parent au foyer','En arrêt de travail'])})
]);
// Index plat, construit une fois. La recherche est faite sur une forme
// normalisée — sans accent ni casse — sinon « eleveur » ne trouve « Éleveur ».
function _normMetier(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
}
let _idxMetiers=null;
function _metiersIndex(){
  if(_idxMetiers) return _idxMetiers;
  const out=[];
  for(const f of METIERS_FAMILLES)
    for(const nom of f.l) out.push({nom,fam:f.fam,niveau:f.n,k:_normMetier(nom)});
  _idxMetiers=out;
  return out;
}
// Métiers proposés pendant la frappe. Ceux qui COMMENCENT par la saisie
// d'abord : taper « bou » doit remonter « Boulanger » avant « Charbounier ».
function chercherMetiers(q,max){
  const k=_normMetier(q);
  if(k.length<2) return [];
  const idx=_metiersIndex();
  const debut=idx.filter(m=>m.k.startsWith(k));
  const dedans=idx.filter(m=>!m.k.startsWith(k)&&m.k.indexOf(k)>=0);
  return debut.concat(dedans).slice(0,max||8);
}
function niveauMetier(nom){
  const k=_normMetier(nom);
  if(!k) return null;
  const m=_metiersIndex().find(x=>x.k===k);
  return m?m.niveau:null;
}
// Facteur de profession. Rend null quand le métier n'est pas reconnu : on ne
// devine pas le niveau d'activité d'un intitulé qu'on ne connaît pas.
function facteurProfession(nom){
  const n=niveauMetier(nom);
  if(!n) return null;
  return {f:METIER_NIVEAUX[n].f,niveau:n,lib:METIER_NIVEAUX[n].lib};
}

function mbMifflin(poids,taille,age,sexe){
  const p=Number(poids),t=Number(taille),a=Number(age);
  if(!(p>0)||!(t>0)||!(a>0)) return null;
  return Math.round(10*p+6.25*t-5*a+(isFemale(sexe)?-161:5));
}
// Katch-McArdle part de la MASSE MAIGRE. Elle ne connaît pas le sexe et n'en a
// pas besoin : la différence de composition est déjà dans la masse maigre. À
// poids égal, elle distingue deux personnes que Mifflin confondrait.
function mbKatch(masseMaigreKg){
  const mm=Number(masseMaigreKg);
  if(!(mm>0)) return null;
  return Math.round(370+21.6*mm);
}

// Masse maigre du dernier bilan, par le MÊME chemin que l'écran % de gras :
// calcBF puis retrait de la masse grasse. Aucune formule parallèle, sinon les
// deux écrans finiraient par annoncer deux masses maigres différentes.
// Dernière valeur NON VIDE d'un champ, en remontant les bilans du plus récent
// au plus ancien. La profession est renseignée au bilan de départ et n'est pas
// forcément redonnée à chaque suivi : la chercher seulement dans le dernier
// bilan la ferait disparaître dès le suivi suivant.
function _dernierChamp(user,champ){
  const bl=((user&&user.bilans)||[]).filter(x=>x&&x.date).slice().sort((x,y)=>y.date-x.date);
  for(const x of bl){
    const v=x[champ];
    if(Array.isArray(v)){ if(v.length) return v; continue; }
    if(v!=null&&String(v).trim()!=='') return v;
  }
  return null;
}
function masseMaigreDuBilan(user){
  const bl=((user&&user.bilans)||[]).filter(b=>b&&b.date).slice().sort((a,b)=>a.date-b.date);
  const b=bl[bl.length-1];
  if(!b) return null;
  const w=getBW(b);
  const taille=parseFloat(user._evol_height||user['init-height']||b['deb-height']||user.height||0);
  const sexe=user._evol_gender||user.gender||b['deb-gender']||'';
  const bf=calcBF(getBM(b,'waist'),getBM(b,'neck'),getBM(b,'hips'),taille,sexe);
  if(bf===null||!(w>0)) return null;
  const mg=Math.round(w*bf/10)/10;
  return Math.round((w-mg)*10)/10;
}

// ══ LA MASSE MAIGRE ESTIMÉE (build 1836) ══════════════════════════════════
// PURE. Formule de Boer, sur la taille et le poids : H 0,407 × P + 0,267 × T
// − 19,2 ; F 0,252 × P + 0,473 × T − 48,3 (P en kg, T en cm). Sert quand les
// tours de mesure manquent : le plancher garde ainsi LA MÊME règle de
// disponibilité énergétique (30 kcal/kg de masse maigre + l'entraînement), au
// lieu de 22 kcal/kg de poids total sans l'entraînement. masseMaigreDuBilan
// (mesurée) reste prioritaire. null sans taille, sans poids, ou ≤ 0.
function masseMaigreEstimee(user){
  if(!user) return null;
  let p=null; try{ p=poidsNutritionnel(user).kg; }catch(e){ p=null; }
  const bl=((user.bilans)||[]).filter(b=>b&&b.date).slice().sort((x,y)=>x.date-y.date);
  const b=bl[bl.length-1]||{};
  const t=parseFloat(user._evol_height||user['init-height']||b['deb-height']||user.height||0)||null;
  if(!(p>0)||!(t>0)) return null;
  const sexe=user._evol_gender||user.gender||b['deb-gender']||'';
  const kg=isFemale(sexe)?(0.252*p+0.473*t-48.3):(0.407*p+0.267*t-19.2);
  if(!(kg>0)) return null;
  return {kg:Math.round(kg*10)/10,source:'estimee'};
}

// ── L'ajustement par les pas ────────────────────────────────────────────────
// N2.17 — ACT_SEANCES ET facteurActivite SONT PARTIS le 26/08/2026.
// Le facteur d'activite tire du NOMBRE DE CRENEAUX a ete remplace par
// facteurNEAT, qui n'utilisait plus ce bareme : le commentaire de « UNE seule
// convention de depense », juste en dessous, explique pourquoi — l'ancienne
// table montait jusqu'a 1,65, un multiplicateur qui englobe l'entrainement,
// et c'etait la racine du double comptage. La fonction n'avait plus aucun
// appelant en production ; elle n'etait plus tenue que par cinq assertions
// qui ne verifiaient qu'elle-meme. Elles sont parties avec.
//
// moyennePas14j reste vivante (nafRetenu la lit). ACT_PAS, ACT_MIN et ACT_MAX ne
// servent plus a facteurNEAT depuis qu'il suit nafRetenu (QA du 27/09/2026).
//
// Comme REPERES_VOLUME, ce bareme est un repere de PRATIQUE DE TERRAIN et non
// une mesure. Le compteur de pas d'un telephone pose sur un bureau ne vaut
// rien : c'est un point de depart que le coach ajuste, jamais un verdict.
const ACT_PAS=Object.freeze([
  Object.freeze({max:4000,  d:-0.05}),
  Object.freeze({max:7500,  d: 0    }),
  Object.freeze({max:10000, d: 0.05 }),
  Object.freeze({max:Infinity, d:0.10})
]);
const ACT_MIN=1.15, ACT_MAX=1.90;
function moyennePas14j(user){
  const log=((user&&user.stepsLog)||[]).filter(e=>e&&e.date&&Number(e.count)>0);
  if(!log.length) return null;
  const limite=localISODate(new Date(Date.now()-14*864e5));
  const l=log.filter(e=>e.date>=limite);
  if(!l.length) return null;
  return Math.round(l.reduce((s,e)=>s+Number(e.count),0)/l.length);
}
// ── UNE seule convention de dépense ────────────────────────────────────────
// Deux modèles exclusifs cohabitaient : profession reconnue → NEAT × facteur
// plus les sports en kcal ; profession inconnue → facteur tiré du NOMBRE DE
// CRÉNEAUX (l'ancienne table ACT_SEANCES, retirée depuis), sports ignorés. Deux athlètes identiques obtenaient
// donc deux dépenses différentes selon que leur intitulé de poste était
// reconnu, un footballeur voyait ses six heures compter zéro, et un athlète
// qui n'avait pas listé « Musculation » voyait son entraînement compter zéro.
//
// Désormais : le facteur ne couvre JAMAIS le sport, le sport est TOUJOURS
// ajouté en kcal, et l'entraînement RepCore est compté EXACTEMENT une fois.
//
// Conséquence assumée : pour un athlète sans profession reconnue, l'ancien
// facteur par séances (jusqu'à 1,65) englobait l'entraînement. Le nouveau
// calcul part de 1,20 et rajoute les créneaux en kcal — la dépense baisse
// nettement, et c'était précisément le double comptage qu'on corrige.
const NEAT_BASE=1.20;
// Facteur d'activité HORS SPORT : le nombre de créneaux est du sport, il se
// compte en kcal, pas en multiplicateur.
// ⚠ UNE SEULE SOURCE : nafRetenu (QA du 27/09/2026). Cette fonction tenait sa
//   propre echelle — l'ancienne, 1,15 pour un metier assis — et ignorait le
//   reglage du coach. _depensePourPlafond passait par elle : le plancher
//   calorique se plafonnait sur une depense qui n'etait pas celle affichee, et
//   corriger le niveau d'activite de l'athlete ne deplacait pas ce plafond.
//   Elle rend desormais exactement le niveau que retient le calcul des besoins.
function facteurNEAT(user){
  const metier=_dernierChamp(user,'deb-job');
  const pas=moyennePas14j(user);
  const r=nafRetenu(user);
  const n=(r&&r.n)||nafNiveau('sedentaire');
  const source=r&&r.source==='metier'?'profession':((r&&r.source)||'defaut');
  return {f:n.f,source,pas:pas==null?null:pas,niveau:n.cle,lib:n.lib,metier:metier||null};
}

// Durée d'une séance, lue dans un champ de TEXTE LIBRE déjà collecté et
// jamais exploité jusqu'ici. On sait lire « 45min », « 1h30 », « 1 h », « 90 ».
// Un nombre nu sous 10 est refusé : « 1,5 » peut vouloir dire une heure et
// demie comme une minute et demie, et deviner vaudrait moins que le repli.
const SEANCE_MIN_DEFAUT=60, SEANCE_MIN_MIN=10, SEANCE_MIN_MAX=240;
function _dureeSeanceMin(user){
  const brut=_dernierChamp(user,'deb-session-duration');
  const t=String(brut==null?'':brut).toLowerCase().replace(',','.').trim();
  const borne=(v)=>(v>=SEANCE_MIN_MIN&&v<=SEANCE_MIN_MAX)?v:null;
  let v=null;
  const h=t.match(/(\d+(?:\.\d+)?)\s*h\s*(\d+)?/);
  if(h) v=borne(Math.round(parseFloat(h[1])*60+(h[2]?parseInt(h[2],10):0)));
  if(v==null){
    const m=t.match(/(\d+(?:\.\d+)?)/);
    // Un nombre nu n'est retenu que s'il ne peut être que des minutes.
    if(m&&parseFloat(m[1])>=10) v=borne(Math.round(parseFloat(m[1])));
  }
  if(v==null) return {min:SEANCE_MIN_DEFAUT,source:'defaut',brut:brut==null?null:String(brut)};
  return {min:v,source:'declaree',brut:String(brut)};
}

// Musculation, quel que soit l'accent ou la casse de l'intitulé stocké.
function _estMusculation(nom){
  return String(nom||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().trim()==='musculation';
}
// Tout le sport en kcal par jour, entraînement RepCore compris — et compté
// UNE fois. Les créneaux du programme sont la source de référence ; quand
// l'athlète a AUSSI déclaré une ligne « Musculation », on ne fait pas la somme
// des deux : on retient la plus élevée et on le dit.
//
// Pourquoi la plus élevée et non les créneaux seuls : ignorer purement la
// déclaration ferait BAISSER la dépense de tout athlète qui avait déclaré plus
// d'heures que ses créneaux n'en valent — une régression silencieuse sur des
// dossiers en cours. Le prix assumé : qui surdéclare garde son chiffre.
// ══ LES SPORTS REGLES PAR LE COACH (build 1405) ══════════════════════════
// Kevin, 22/09/2026, sur le tableau « Dépense selon l'activité sportive » :
// « donne la possibilité de rajouter un sport ou modifier heure et
// intensité ». La liste du coach vit dans nutrition.tableur.sports — avec
// les autres reglages du tableau, synchronisee avec eux — sous la forme
// {lignes:[{sport,heures,intensite}], date}.
// ⚠ UN OBJET ET NON UN TABLEAU NU : Firebase ne garde pas un tableau vide.
//   Un coach qui retire tous les sports aurait vu sa liste disparaitre du
//   serveur, et l'athlete retomber sur les creneaux et le bilan. `date`
//   garde le noeud en vie ; `lignes` peut revenir en objet a clefs
//   numeriques, on le relit donc dans les deux formes.
// QUAND ELLE EXISTE, ELLE FAIT FOI, seule : les creneaux RepCore et le bilan
// ne sont plus lus — sinon un sport corrige par le coach serait compte une
// seconde fois depuis la declaration. Le tableau le dit, et offre le retour
// au calcul automatique.
function _sportsCoach(user){
  const s=user&&user.nutrition&&user.nutrition.tableur&&user.nutrition.tableur.sports;
  if(!s||typeof s!=='object'||Array.isArray(s)) return null;
  const brut=Array.isArray(s.lignes)?s.lignes
    :(s.lignes&&typeof s.lignes==='object'?Object.keys(s.lignes).sort((a,b)=>a-b).map(k=>s.lignes[k]):[]);
  return brut.filter(e=>e&&typeof e.sport==='string'&&e.sport)
    .map(e=>({sport:e.sport,
      heures:Math.min(60,Math.max(0,Number(e.heures)||0)),
      intensite:SPORT_INTENSITES.some(x=>x.cle===e.intensite)?e.intensite:'moderee'}));
}
function kcalSportParJour(user){
  // Le poids de l'athlète chiffre chaque heure (MET nets).
  const _kg=poidsSport(user);
  const _kgDefaut=!(function(){ try{ return poidsNutritionnel(user).kg>0; }catch(e){ return false; } })();
  // ── LA LISTE DU COACH, SI ELLE EXISTE ──
  const _sc=_sportsCoach(user);
  if(_sc){
    const connus=[],inconnus=[];
    for(const e of _sc){
      if(kcalHeureSport(e.sport,e.intensite,_kg)==null){ if(e.heures>0) inconnus.push(e.sport); continue; }
      connus.push(e);
    }
    const tout=depenseSportsParJour(connus,_kg);
    const dM=depenseSportsParJour(connus.filter(e=>_estMusculation(e.sport)),_kg);
    const dA=depenseSportsParJour(connus.filter(e=>!_estMusculation(e.sport)),_kg);
    const cr=((user&&user.sessions_config)||[]).filter(x=>x&&x.active).length;
    const du=_dureeSeanceMin(user);
    return {jour:Math.round(tout.semaine/7),semaine:tout.semaine,source:'coach',doublon:false,inconnus,poids:_kg,poidsDefaut:_kgDefaut,
      detailMuscu:dM.detail,creneaux:cr,dureeMin:du.min,dureeSource:du.source,dureeBrut:du.brut,
      semaineMuscu:dM.semaine,semaineCreneaux:Math.round(cr*(du.min/60)*kcalHeureSport('Musculation','moderee',_kg)),
      semaineDeclaree:dM.semaine,detail:dA.detail,autres:dA.semaine,
      lignes:_sc.map(e=>Object.assign({},e,{origine:'coach'}))};
  }
  const brut=_dernierChamp(user,'deb-sports');
  const liste=Array.isArray(brut)?brut:[];
  const autres=[],muscu=[],inconnus=[];
  for(const e of liste){
    if(!e||!e.sport) continue;
    // Nom RAMENÉ à la clé du barème : reconnue sur une forme normalisée, la
    // ligne doit être chiffrée sur la clé exacte, sinon ses heures tombent à
    // zéro sans que personne ne le voie.
    if(_estMusculation(e.sport)){ muscu.push({...e,sport:'Musculation'}); continue; }
    // Un sport absent du barème n'est pas compté — mais il est NOMMÉ. Le
    // passer sous silence laisserait croire qu'il a été pris en compte.
    if(kcalHeureSport(e.sport,e.intensite,_kg)==null&&Number(e.heures)>0){
      inconnus.push(String(e.sport)); continue; }
    autres.push(e);
  }
  const dAutres=depenseSportsParJour(autres,_kg);
  const dMuscu=depenseSportsParJour(muscu,_kg);
  const creneaux=((user&&user.sessions_config)||[]).filter(x=>x&&x.active).length;
  const duree=_dureeSeanceMin(user);
  const kh=kcalHeureSport('Musculation','moderee',_kg);
  const semCreneaux=Math.round(creneaux*(duree.min/60)*kh);
  const doublon=muscu.length>0&&creneaux>0;
  let semMuscu,source;
  if(creneaux>0&&semCreneaux>=dMuscu.semaine){ semMuscu=semCreneaux; source='creneaux'; }
  else if(dMuscu.semaine>0){ semMuscu=dMuscu.semaine; source='declaree'; }
  else if(creneaux>0){ semMuscu=semCreneaux; source='creneaux'; }
  else { semMuscu=0; source='aucune'; }
  const semaine=dAutres.semaine+semMuscu;
  // LES LIGNES QUE LE TABLEAU MONTRE — exactement celles qui sont comptees,
  // plus les sports hors bareme (nommes, a zero). Le tableau montrait une
  // seule ligne « Musculation » portant la depense de TOUS les sports, et les
  // autres sports declares n'apparaissaient nulle part.
  const lignes=[];
  if(source==='creneaux') lignes.push({sport:'Musculation',
    heures:Math.round(creneaux*(duree.min/60)*100)/100,intensite:'moderee',origine:'creneaux'});
  else if(source==='declaree') for(const e of muscu) if(Number(e.heures)>0)
    lignes.push({sport:'Musculation',heures:Number(e.heures),intensite:e.intensite||'moderee',origine:'bilan'});
  for(const e of autres) if(Number(e.heures)>0)
    lignes.push({sport:String(e.sport),heures:Number(e.heures),intensite:e.intensite||'moderee',origine:'bilan'});
  for(const e of liste) if(e&&e.sport&&inconnus.indexOf(String(e.sport))>=0&&Number(e.heures)>0)
    lignes.push({sport:String(e.sport),heures:Number(e.heures),intensite:e.intensite||'moderee',origine:'bilan'});
  return {jour:Math.round(semaine/7),semaine,source,doublon,inconnus,poids:_kg,poidsDefaut:_kgDefaut,
    detailMuscu:dMuscu.detail,
    creneaux,dureeMin:duree.min,dureeSource:duree.source,dureeBrut:duree.brut,
    semaineMuscu:semMuscu,semaineCreneaux:semCreneaux,semaineDeclaree:dMuscu.semaine,
    detail:dAutres.detail,autres:dAutres.semaine,lignes};
}

// ── Protéines : le coach choisit, la phase propose ─────────────────────────
// En grammes par kilo de POIDS DE CORPS. La sèche demande le plus — c'est là
// qu'il faut protéger le muscle — la prise de masse un cran en dessous, et
// hors phase déclarée on reste sur le bas de l'échelle.
const PROT_DEFAUT=Object.freeze({seche:2.4,masse:2.2,recomp:2.2,maintien:1.8});
const PROT_BASE=1.8;
// L'échelle de la liste déroulante : de 2,4 à 1,8 par pas de 0,1.
const PROT_ECHELLE=Object.freeze([2.4,2.3,2.2,2.1,2.0,1.9,1.8]);
// ── Ménopause : des repères ajustés, et RIEN d'autre ──────────────────────
// L'âge n'intervenait que dans le terme −5 × âge de Mifflin. Une athlète de
// 54 ans recevait le modal de cycle avant chaque séance, les mêmes
// fourchettes et le même plancher protéique qu'une athlète de 22 ans.
//
// Ce lot ne dit RIEN du traitement hormonal, rien des bouffées de chaleur, du
// sommeil ou de l'humeur, et n'affirme rien sur la densité osseuse de qui que
// ce soit. Il ajuste deux repères et mentionne une fois pourquoi continuer.
const STATUTS_HORMONAUX=Object.freeze([
  Object.freeze({cle:'cycles_reguliers',lib:'Cycles réguliers'}),
  Object.freeze({cle:'perimenopause',   lib:'Périménopause'}),
  Object.freeze({cle:'menopause',       lib:'Ménopause'})
]);
const PROT_BONUS_MENOPAUSE=0.2;   // g/kg ajoutés à la SUGGESTION, jamais imposés
const PROT_MIN_MENOPAUSE=2.0;     // borne basse de l'échelle proposée
const MENO_AGE_SEUIL=50;
const MENO_CIBLE_SECHE=Object.freeze({min:-0.8,max:-0.3,alerte:-1.1});
// Absent = 'cycles_reguliers' : aucun dossier existant ne change.
function statutHormonal(user){
  const v=(user||{}).statutHormonal;
  return STATUTS_HORMONAUX.some(x=>x.cle===v)?v:'cycles_reguliers';
}
// Déclaré chez un homme : ignoré, sans erreur et sans message.
function _hormonalApplicable(user){
  return isFemale((user&&(user._evol_gender||user.gender))||'');
}
// La DÉCLARATION seule ouvre la fourchette de vitesse.
function menopauseDeclaree(user){
  return _hormonalApplicable(user)&&statutHormonal(user)==='menopause';
}
// L'ÂGE suffit pour le bonus protéique et l'encart : une athlète de 54 ans
// n'a pas à déclarer quoi que ce soit pour qu'on cesse de lui proposer le
// plancher protéique d'une femme de 22 ans.
function menopauseeOuAgee(user){
  if(!_hormonalApplicable(user)) return false;
  if(statutHormonal(user)==='menopause') return true;
  const a=_ageUtilisateur(user);
  return a!=null&&a>=MENO_AGE_SEUIL;
}
// L'échelle proposée au coach démarre plus haut. Il reste libre de descendre
// en dessous s'il le décide — ce sont des repères, pas des barrières.
function protEchelle(user){
  let l=PROT_ECHELLE.slice();
  if(menopauseeOuAgee(user)){
    const m=l.filter(v=>v>=PROT_MIN_MENOPAUSE);
    if(m.length) l=m;
  }
  // Les deux se cumulent sans se gêner : la ménopause relève le PLANCHER
  // proposé, PES relève le PLAFOND. L'ordre décroissant est conservé.
  if(aPES(user)) l=PROT_ECHELLE_PES.concat(l);
  return Object.freeze(l);
}
// PROT_DEFAUT n'est PAS modifié : seule la SUGGESTION bouge.
//
// Conséquence assumée en sèche : PROT_DEFAUT.seche vaut déjà 2,4, soit la
// borne haute de l'échelle. Le bonus y est donc entièrement avalé par le
// plafond, et la suggestion reste 2,4. Il opère bien dans les trois autres
// phases (2,2 → 2,4 ; 1,8 → 2,0). Le jour où le lot A2-01 portera l'échelle à
// 3,0, la sèche passera d'elle-même à 2,6.
function protSuggeree(user,phase){
  const base=PROT_DEFAUT[phase]||PROT_BASE;
  if(!menopauseeOuAgee(user)) return base;
  const ech=protEchelle(user);
  const haut=Math.max.apply(null,ech.slice());
  return Math.min(Math.round((base+PROT_BONUS_MENOPAUSE)*10)/10,haut);
}
// La fourchette la plus LARGE de plusieurs repères, et l'alerte la plus
// permissive avec elle : une fourchette large assortie d'une alerte étroite
// autoriserait une vitesse tout en la signalant.
function _fourchetteLaPlusLarge(l){
  const v=(l||[]).filter(Boolean);
  if(!v.length) return null;
  const alertes=v.map(x=>x.alerte).filter(x=>typeof x==='number');
  return {min:Math.min.apply(null,v.map(x=>x.min)),
          max:Math.max.apply(null,v.map(x=>x.max)),
          alerte:alertes.length?Math.min.apply(null,alertes):null};
}
// VALEUR PAR DÉFAUT, et non plancher : le vrai plancher est
// LIP_PLANCHER_G_KG (0,6). Le commentaire d'origine disait « plancher, jamais
// en dessous » — inexact déjà, et franchement trompeur maintenant que la
// valeur est réglable.
const LIP_G_PAR_KG=0.8;
// Répartition glucides/lipides réglable POUR TOUT LE MONDE. Seul le g/kg de
// protéines l'était : tout le reste partait en glucides, soit près de la
// moitié de l'apport. Ce n'est pas une question de pathologie, c'est une
// question de réglage qui manquait.
const LIP_ECHELLE=Object.freeze([0.6,0.8,1.0,1.2,1.5]);
// ── SOPK : un repère élargi, aucun mode dédié ─────────────────────────────
// Une athlète avec insulinorésistance recevait ~50 % de son apport en
// glucides, et sa perte plus lente était lue par ajustementPropose comme un
// déficit insuffisant — donc comme une raison de baisser encore.
//
// RepCore ne dépiste RIEN et n'affirme RIEN sur le traitement : il élargit
// une fourchette quand un diagnostic médical est déclaré, et il renvoie vers
// le suivi qui va avec.
const SOPK_CIBLE_SECHE=Object.freeze({min:-1.0,max:-0.3,alerte:-1.4});
// ── PES : réduction des risques, et STRICTEMENT rien d'autre ─────────────
// « Produits améliorant la performance ». RepCore ne nomme aucune molécule,
// ne propose aucune dose, aucun protocole, aucune durée de cycle, aucun
// seuil d'analyse interprété, et ne donne aucun conseil d'usage. Il fait
// DEUX choses : rappeler de faire un bilan sanguin, et ouvrir le choix de
// protéines au coach. Le reste appartient au médecin.
//
// Ce n'est PAS une entrée de ETATS_DECLARABLES : chaque libellé de cette
// liste porte « diagnostiqué par un médecin » et un test l'exige. Un usage
// déclaré n'est pas un diagnostic. Champ séparé, comme la contraception et
// la grossesse.
const PES_PHRASE='C\'est ton médecin qui prescrit les analyses et qui seul '
  +'peut les interpréter. RepCore ne fait que te rappeler d\'en faire et de '
  +'les garder sous la main.';
const PES_NOTE_PARTAGE='Non transmise à ton coach, sauf si tu l\'actives '
  +'ci-dessous. Sans partage, il ne verra pas non plus le choix de protéines '
  +'élargi.';
// PURE. Aucune autre condition : ni âge, ni sexe, ni phase.
function aPES(user){ return !!((user||{}).pes); }
// L'échelle protéique s'OUVRE, la suggestion ne bouge PAS. Suggérer plus de
// protéines parce que quelqu'un déclare un usage reviendrait à faire dire au
// produit une chose qui relève du coach. Il choisit ; on ne choisit pas pour
// lui, et surtout pas à partir de ça.
const PROT_ECHELLE_PES=Object.freeze([3.0,2.9,2.8,2.7,2.6,2.5]);
// Le lot A2-03 doit livrer la liste complète des états déclarables et son
// interface. Il n'est pas là : cette liste porte pour l'instant la SEULE
// entrée dont ce lot a besoin, et A2-03 l'étendra. Aucune question de
// dépistage, aucun questionnaire de symptômes — une déclaration, rien d'autre.
const ETATS_DECLARABLES=Object.freeze([
  Object.freeze({cle:'sopk',    lib:'SOPK diagnostiqué par un médecin'}),
  Object.freeze({cle:'thyroide',lib:'Trouble thyroïdien diagnostiqué par un médecin'})
]);
// CONTRAIREMENT à la contraception, ces déclarations sont VISIBLES du coach
// sans réglage : c'est lui qui ajuste les lipides sous SOPK et qui pose la
// question du bilan thyroïdien. Les cacher viderait les deux lots de leur
// effet. La contraception, elle, ne sert à aucune décision de coaching.
function etatsDeclares(user){
  const l=(user&&user.etatsSante);
  if(!Array.isArray(l)) return [];
  return l.filter(x=>ETATS_DECLARABLES.some(e=>e.cle===x));
}
function aEtat(user,cle){ return etatsDeclares(user).indexOf(cle)>=0; }
// ── Thyroïde : un état, un traitement, RIEN d'autre ───────────────────────
// Aucune dose, aucune molécule, aucune valeur de TSH — celle-ci relève d'un
// autre lot, et une valeur biologique ne s'interprète pas ici.
const THYROIDE_ETATS=Object.freeze([
  Object.freeze({cle:'hypo',           lib:'Hypothyroïdie'}),
  Object.freeze({cle:'hyper',          lib:'Hyperthyroïdie'}),
  Object.freeze({cle:'traitee_stable', lib:'Traitée et stabilisée'})
]);
function thyroideDe(user){
  const t=(user&&user.thyroide)||{};
  const etat=THYROIDE_ETATS.some(x=>x.cle===t.etat)?t.etat:null;
  return {etat,traitement:!!t.traitement};
}
// ── Correction métabolique : une décision de COACH, jamais un calcul ──────
// mbMifflin et mbKatch ne dépendent que du gabarit : rien ne permettait
// d'exprimer un métabolisme inférieur à la prédiction. Ce facteur le permet,
// et il porte le nom de ce qu'il est — une correction décidée, pas mesurée.
const CORRECTION_MB_MIN=0.85, CORRECTION_MB_MAX=1.15, CORRECTION_MB_PAS=0.05;
const CORRECTION_MB_ECHELLE=Object.freeze(
  Array.from({length:7},(_,i)=>Math.round((CORRECTION_MB_MIN+i*CORRECTION_MB_PAS)*100)/100));
// Hors bornes après désérialisation, valeur illisible, pas non respecté : on
// retombe sur 1. Un métabolisme corrigé de moitié par une donnée corrompue
// serait pire que pas de correction du tout.
function correctionMB(user){
  const v=Number((user||{}).correctionMB);
  if(!isFinite(v)) return 1;
  if(v<CORRECTION_MB_MIN||v>CORRECTION_MB_MAX) return 1;
  return Math.round(v*100)/100;
}
// SUGGÉRÉE, jamais imposée : le coach voit une proposition et tranche.
function correctionMBSuggeree(user){
  const t=thyroideDe(user);
  if(!aEtat(user,'thyroide')||!t.etat) return 1;
  if(t.etat==='hypo'&&t.traitement===false) return 0.90;
  if(t.etat==='hyper') return 1.10;
  return 1;
}
// Défensive : le champ n'existe pas encore dans les dossiers, et un tableau
// absent ou d'une autre forme ne doit rien casser.
function aSOPK(user){
  const l=(user&&user.etatsSante);
  return Array.isArray(l)&&l.indexOf('sopk')>=0;
}
// L'élargissement ne vaut que là où le champ a un sens. Un homme qui
// déclarerait un SOPK garde la fourchette standard, sans message d'erreur.
function sopkApplicable(user){
  return aSOPK(user)&&isFemale((user&&(user._evol_gender||user.gender))||'');
}
const FIBRES_PAR_1000=14;
const CYCLE_GLUC=0.15;           // jour ON : +15 % de glucides ; OFF : ce qui garde la moyenne
// ⚠ LA SEMAINE, PAS LA PAIRE DE JOURS (30/09/2026). +15 % / −15 % ne tombe
//   juste que pour 3,5 jours d'entraînement sur 7. Avec 6 créneaux, six jours à
//   +15 % et un seul à −15 % servaient 11 % de glucides de trop sur la semaine.
//   Les jours ON gardent +CYCLE_GLUC ; les jours OFF retirent CYCLE_GLUC ×
//   nOn / nOff, pour que (nOn × gOn + nOff × gOff) / 7 = g. nOn = créneaux
//   actifs (sessions_config) ; à 0 ou à 7, il n'y a pas de cycle.
// PURE.
// ⚠ LE JOUR OFF NE DESCEND PLUS SOUS 70 % (build 1834). Avec 6 créneaux,
//   −15 % × 6 / 1 donnait −90 % : 20 g de glucides le jour de repos, que le
//   plancher relevait ensuite en reportant le même lift sur le jour ON — la
//   moyenne de la semaine dépassait la cible de plus de 300 kcal. La baisse du
//   jour OFF est plafonnée à CYCLE_GLUC_OFF_MAX, et c'est la hausse du jour ON
//   qui s'en déduit (xOn = xOff × nOff / nOn ≤ CYCLE_GLUC) : la semaine garde
//   la cible à ±1 g. pctOn / pctOff sont les pourcentages RÉELS.
const CYCLE_GLUC_OFF_MAX=0.30;
function cycleGlucides(user,g){
  const sc=(user&&user.sessions_config)||[];
  const l=Array.isArray(sc)?sc:(typeof sc==='object'?Object.values(sc):[]);
  const nOn=Math.min(7,l.filter(x=>x&&x.active).length), nOff=7-nOn;
  const G=Math.max(0,Number(g)||0);
  if(nOn<=0||nOff<=0) return {cycle:false,nOn,nOff,gOn:Math.round(G),gOff:Math.round(G),pctOn:0,pctOff:0};
  const brutOff=CYCLE_GLUC*nOn/nOff, plafonne=brutOff>CYCLE_GLUC_OFF_MAX;
  const xOff=plafonne?CYCLE_GLUC_OFF_MAX:brutOff;
  const xOn=xOff*nOff/nOn;
  // Plafonné, le jour OFF s'arrondit VERS LE HAUT (jamais sous 70 %) ; le jour
  // ON prend alors ce qui garde la semaine à la cible.
  const gOff=plafonne?Math.ceil(G*(1-xOff)-1e-9):Math.round(G*(1-xOff));
  const gOn=Math.max(0,Math.round((7*G-nOff*gOff)/nOn));
  return {cycle:true,nOn,nOff,gOn,gOff,
    pctOn:Math.round(xOn*100),pctOff:Math.round(xOff*100)};
}

// ── Point de départ calorique, dérivé de la vitesse visée ───────────────────
// Comme REPERES_VOLUME, ces trois nombres sont des repères de
// PRATIQUE DE TERRAIN et non une mesure. 7700 kcal par kilo est la conversion
// d'usage pour du tissu adipeux : la composition réelle du poids perdu ou pris
// n'est jamais purement grasse, elle varie d'une personne à l'autre et au fil
// d'une même phase. Les deux plafonds ne viennent d'aucune formule non plus —
// ils bornent ce qu'un point de départ automatique a le droit de proposer, pour
// qu'une grande dépense ne se traduise pas en déficit démesuré.
// C'est un point de départ que le coach ajuste, jamais un verdict.
const KCAL_PAR_KG_CORPS=7700;
const DEFICIT_MAX_PART=0.25;      // jamais moins de 75 % de la dépense
const SURPLUS_MAX_PART=0.15;      // jamais plus de 115 %
// PURE. Milieu de la fourchette de la phase, LU dans PHASES : recopier les
// valeurs ici les ferait diverger le jour où la table bouge.
function cibleVitesseMilieu(phase){
  const p=phase&&PHASES[phase];
  if(!p||typeof p.min!=='number'||typeof p.max!=='number') return 0;
  return (p.min+p.max)/2;
}
// PURE. Écart calorique quotidien correspondant à une vitesse hebdomadaire.
function deltaKcalJour(pctSemaine,poids){
  const pc=Number(pctSemaine), kg=Number(poids);
  if(!isFinite(pc)||!isFinite(kg)||!(kg>0)||!pc) return 0;
  return Math.round((pc/100*kg*KCAL_PAR_KG_CORPS)/7);
}

// lipGparKg ABSENT = comportement d'avant ce lot, au gramme près. Le plancher
// de lipides reste le dernier mot : un réglage ne descend pas sous lui.
// `ref` (30/09/2026) : le POIDS DE REFERENCE des proteines et des lipides
// (poidsMacros). Absent, c'est le poids total, comme avant.
function _repartition(kcal,poids,gParKg,lipGparKg,ref){
  const r0=(Number(ref)>0)?Number(ref):poids;
  const p=Math.round(gParKg*r0);
  const lkg=(typeof lipGparKg==='number'&&isFinite(lipGparKg))
    ?Math.max(LIP_PLANCHER_G_KG,lipGparKg):LIP_G_PAR_KG;
  const l=Math.round(lkg*r0);
  const reste=kcal-4*p-9*l;
  // Des glucides négatifs n'existent pas : quand protéines et lipides
  // dépassent déjà la cible, le total du jour la dépasse aussi. CE N'EST PLUS
  // SILENCIEUX (30/09/2026) : `depasse` dit de combien, et l'écran l'affiche.
  const g=Math.max(0,Math.round(reste/4));
  const depasse=reste<0?Math.round(4*p+9*l-kcal):0;
  // Glucides très bas : moins de 2 g/kg de poids de référence, ou moins de
  // 100 g par jour. La séance en paie le prix.
  const glucidesBas=g<GLUC_MIN_G_KG*r0||g<GLUC_MIN_G_JOUR;
  return {p,l,g,depasse,glucidesBas,ref:r0};
}
const GLUC_MIN_G_KG=2, GLUC_MIN_G_JOUR=100;
// ══ LE POIDS DES MACROS : LE POIDS DU CORPS, POINT (Kevin, 05/10/2026) ═══
// « 2,2 g par kilo de poids de corps », c'est 2,2 × le poids de la balance :
// 85 kg donnent 187 g de protéines, pas 147. Le 30/09 j'avais remplacé ce
// poids par la masse maigre × 1,15 (ou un poids « ajusté » dès l'IMC 30) sans
// que l'écran le dise à l'endroit du chiffre : le libellé annonçait un calcul
// et la case en affichait un autre. Kevin : « on ne calcule pas selon la masse
// maigre ». Les deux règles sont RETIRÉES. Si un dossier demande moins de
// protéines, le coach baisse le g/kg : c'est son réglage, et il se lit.
// La fonction reste, avec sa forme, pour ses appelants (macros, eau).
//
// ══ LE POIDS AJUSTÉ REVIENT, ÉCRIT DANS LA CASE (build 1835) ══════════════
// Le reproche du 05/10 portait sur un calcul que l'écran ne montrait PAS à
// l'endroit du chiffre. Le poids du corps reste le défaut ; un IMC ≥ 30 passe
// au POIDS AJUSTÉ (25 × taille² + 0,25 × (poids − 25 × taille²)), et la base
// est écrite DANS la case des protéines et des lipides, chez le coach comme
// chez l'athlète. Au banc, sans lui : H 120 kg / 175 cm en sèche à 2,4 g/kg →
// 288 g de protéines (50 % des kcal) et 75 g de glucides.
// Réglage par dossier : nutrition.tableur.baseGkg ∈ {'total','ajuste'} ; le
// choix du coach est respecté, et le libellé le dit.
const MACROS_IMC_AJUSTE=30, MACROS_BASES=Object.freeze(['total','ajuste']);
function poidsMacros(u){
  let poids=null; try{ poids=poidsNutritionnel(u).kg; }catch(e){ poids=null; }
  const reg=((((u&&u.nutrition)||{}).tableur)||{}).baseGkg;
  const choisi=MACROS_BASES.indexOf(reg)>=0?reg:null;
  let imc=null; try{ imc=_imcPourFormule(u); }catch(e){ imc=null; }
  const total={kg:poids,type:'total',lib:'',choisi:!!choisi,imc};
  if(!(poids>0)||imc==null) return total;            // taille inconnue → total
  const base=choisi||(imc>=MACROS_IMC_AJUSTE?'ajuste':'total');
  if(base==='total') return total;
  const t2=poids/imc;                                  // taille² en m²
  const ideal=25*t2;
  const kg=Math.round((ideal+0.25*(poids-ideal))*10)/10;
  if(!(kg>0)||kg>=poids) return total;
  return {kg,type:'ajuste',lib:'',choisi:!!choisi,imc};
}
// LE PLAFOND DES 40 % (build 1835). Un IMC ≥ 30 sans choix explicite du
// coach : les protéines ne dépassent jamais 40 % des kcal du jour. Le g/kg
// retenu est abaissé d'autant, et la case le DIT (plafond40).
const PROT_PART_MAX_IMC=0.40;
function protPlafonnee(pm,kcal,gk){
  const g=Number(gk);
  if(!pm||!(pm.kg>0)||pm.choisi||pm.imc==null||pm.imc<MACROS_IMC_AJUSTE||!(Number(kcal)>0)||!(g>0)) return {gk,pm};
  const max=Math.floor(PROT_PART_MAX_IMC*Number(kcal)/4)/pm.kg;
  if(g<=max) return {gk,pm};
  return {gk:max,pm:Object.assign({},pm,{plafond40:true})};
}
// La phrase : « calculé sur 87 kg (poids ajusté) ». Au poids du corps, vide —
// sauf quand le coach l'a CHOISI malgré un IMC ≥ 30 : alors on le dit.
function libPoidsMacros(pm){
  if(!pm||!(pm.kg>0)) return '';
  const kg=String(Math.round(pm.kg)).replace('.',',');
  const pl=pm.plafond40?', protéines plafonnées à 40 % des kcal':'';
  if(pm.type==='ajuste') return 'calculé sur '+kg+' kg (poids ajusté)'+pl;
  if(pm.type==='total'&&pm.choisi&&pm.imc!=null&&pm.imc>=MACROS_IMC_AJUSTE)
    return 'calculé sur '+kg+' kg (poids du corps, choix du coach)';
  return '';
}
// La base, en une courte mention pour la case : « × 87 kg ajustés ».
function baseGkgCourte(pm){
  if(!pm||!(pm.kg>0)) return '';
  return '× '+String(Math.round(pm.kg)).replace('.',',')+' kg'+(pm.type==='ajuste'?' ajustés':'')
    +(pm.plafond40?' · 40 % des kcal max':'');
}
// Les deux alertes, dites à l'écran (coach et athlète).
function _htmlAlertesMacros(x,vu){
  if(!x) return '';
  const l=[];
  const ref=libPoidsMacros(x.poidsRefObj);
  if(ref) l.push('<div class="mac-ref">'+escapeHtml(ref.charAt(0).toUpperCase()+ref.slice(1))+'.</div>');
  if(x.depasse>0) l.push('<div class="mac-alerte">Protéines et lipides dépassent la cible de '+x.depasse
    +' kcal : '+(vu==='athlete'?'ton total servi est plus haut que prévu.':'le total servi est plus haut que la cible.')+'</div>');
  if(x.glucidesBas) l.push('<div class="mac-alerte">Glucides très bas : performance en séance compromise.</div>');
  return l.length?'<div class="mac-alertes">'+l.join('')+'</div>':'';
}
function _bloc(p,l,g){
  const kcal=Math.round(4*p+9*l+4*g);
  return {kcal,p,l,g,f:Math.round(FIBRES_PAR_1000*kcal/1000)};
}
// ⚠ ELLE NE RELEVE PLUS RIEN (24/09/2026). Kevin : « supprime les blocage et
//   limite ». Elle remontait les glucides d'une journee jusqu'au plancher, en
//   silence, y compris sur le chemin automatique.
//
//   CE QUI A CHANGE, ET CE QUI N'A PAS CHANGE. Le plancher est toujours calcule
//   (plancherEffectif), toujours affiche (la ligne du tableau des besoins, la
//   liste des violations du coach) et toujours trace quand le coach passe
//   outre. Ce qui disparait, c'est la CORRECTION SILENCIEUSE : le chiffre
//   affiche est desormais celui que le calcul donne, et si quelqu'un veut le
//   voir descendre, il descend.
//
//   LA FONCTION RESTE, VIDE, PLUTOT QUE D'ETRE RETIREE DE SES SIX APPELS : le
//   jour ou le plancher doit revenir, il revient ici, en une ligne, et non a
//   six endroits qu'il faudrait retrouver.
//
// ⚠ ELLE RELEVE A NOUVEAU, COTE ATHLETE SEULEMENT (30/09/2026). `appliquer`
//   est decide par l'appelant : vrai sur les chemins de l'athlete (ses propres
//   cibles, le calcul automatique), faux cote coach, qui garde la main et voit
//   l'avertissement. La journee est remontee PAR LES GLUCIDES jusqu'au plancher
//   (plancherAthlete) ; proteines et lipides ne bougent pas.
function _relevePlancher(j,user,appliquer){
  if(!appliquer||!j) return j;
  const pl=plancherAthlete(user);
  if(!(pl>0)||!(Number(j.kcal)<pl)) return j;
  let g=Math.max(0,Number(j.g)||0)+Math.ceil((pl-Number(j.kcal))/4);
  let r=_bloc(j.p,j.l,g);
  for(let i=0;i<3&&r.kcal<pl;i++){ g++; r=_bloc(j.p,j.l,g); }
  return r;
}
// Le plancher qui borne les cibles de l'athlete : plancherKcal, et sans
// plancher lisible, l'absolu (1 200 kcal pour une femme, 1 500 pour un homme).
function plancherAthlete(user){
  let p=null; try{ p=plancherKcal(user); }catch(e){ p=null; }
  if(p>0) return p;
  const u=user||{};
  const bl=(u.bilans||[]).filter(b=>b&&b.date).slice().sort((a,b)=>a.date-b.date);
  const sexe=u._evol_gender||u.gender||((bl[bl.length-1]||{})['deb-gender'])||'';
  return isFemale(sexe)?KCAL_PLANCHER_ABS.F:KCAL_PLANCHER_ABS.H;
}
// PURE (build 1834). Les deux journées cyclées, relevées au plancher CHACUNE
// pour elle-même : le jour OFF au plancher, le jour ON inchangé s'il est déjà
// au-dessus. Le lift n'est reporté sur le jour ON que si le jour ON passerait
// sous le jour OFF. Rend aussi la moyenne de la semaine SERVIE et son écart à
// la journée de base (elle-même relevée), en kcal par jour.
const CYCLE_ECART_DIT_KCAL=50;
function journeesCyclees(user,p,l,g,cg,appliquer){
  const offRel=_relevePlancher(_bloc(p,l,cg.gOff),user,appliquer);
  let on=_relevePlancher(_bloc(p,l,cg.gOn),user,appliquer);
  if(on.g<offRel.g) on=_bloc(p,l,offRel.g);
  const base=_relevePlancher(_bloc(p,l,g),user,appliquer);
  const moyenneServie=(cg.nOn*on.kcal+cg.nOff*offRel.kcal)/7;
  return {on,off:offRel,moyenneServie,cible:base.kcal,ecartCible:Math.round(moyenneServie-base.kcal)};
}
// La phrase, ou '' sous CYCLE_ECART_DIT_KCAL.
function texteEcartPlancher(ecart){
  const x=Math.round(Number(ecart)||0);
  return x>CYCLE_ECART_DIT_KCAL?'le plancher du jour de repos ajoute '+x+' kcal par jour en moyenne':'';
}
// Sur quel appareil sommes-nous ? Celui du coach ne borne jamais les cibles
// d'un athlete : il les voit, il est averti, il decide.
function _appareilAthlete(){ return !(currentUser&&currentUser.role==='coach'); }

// opts : { protGparKg, lipGparKg, cycle }  — cycle à false donne le MÊME total
// jours, ce que demandent les athlètes qui ne veulent pas gérer deux colonnes.
