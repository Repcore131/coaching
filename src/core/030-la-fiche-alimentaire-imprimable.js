// ══════════════ LA FICHE ALIMENTAIRE IMPRIMABLE ═══════════════════════════
//
// Kevin livre ses programmes sur deux planches : le PROGRAMME NUTRITIONNEL —
// un bloc par repas, avec les quantités — et les TABLEAUX NUTRITIONNELS — les
// sources de protéines, les fruits, les sources de glucides. Ses athlètes les
// impriment et les collent sur le frigo. L'application composait le même plan
// sans jamais pouvoir le sortir sur une feuille : le plan se lisait sur un
// téléphone, et nulle part ailleurs.
//
// ⚠ AUCUN CHIFFRE NOUVEAU. Chaque valeur de cette fiche vient d'une fonction
//   déjà écrite et déjà éprouvée — planCiblesJour, planCouverture, planSources,
//   PLAN_FRUITS. La fiche MET EN PAGE, elle ne calcule pas : un grammage qui
//   différerait de l'écran de l'athlète serait pire qu'une fiche absente.
//
// ⚠ ET ELLE SORT PAR window.print(), comme le rapport de période et la fiche
//   programme. Aucune bibliothèque, aucun appel réseau, aucune Cloud Function :
//   le plan Firebase reste Spark.
//
// LA FEUILLE EST BLANCHE ET LES LIGNES AUSSI (30/09/2026) : blanc et blanc
// cassé une ligne sur deux, la couleur ne reste que dans les en-têtes de repas
// et de tableaux. `print-color-adjust:exact` impose ces en-têtes au navigateur,
// qui aplatit les fonds par défaut. Le bouton dit « Imprimer / Enregistrer en
// PDF » : le PDF est la sortie attendue.
const FA_LIB_MOMENT=Object.freeze({
  petit_dej:'HEURE LIBRE', collation1:'MATIN', midi:'MIDI',
  avant:'ENTRAÎNEMENT', pendant:'ENTRAÎNEMENT', apres:'ENTRAÎNEMENT',
  collation2:'APRÈS-MIDI', soir:'SOIR', coucher:'AVANT SOMMEIL'
});
// PLUS D'EMOJI EN TETE DE REPAS (charte du 26/09/2026) : le nom du repas
// suffit, et un emoji change de dessin d'un telephone a l'autre.
const FA_ICONE=Object.freeze({});
const FA_MOTTO='« UNE MEILLEURE ALIMENTATION, DE MEILLEURS RÉSULTATS. »';

/**
 * LE NOM D'UN ALIMENT SUR UNE PLANCHE, ET LE COMPROMIS QU'IL PORTE.
 *
 * Ciqual nomme ses aliments par qualificatifs successifs : « Sardine, à
 * l'huile, appertisée, égouttée ». A L'ECRAN, la ligne est coupée et le nom
 * ENTIER reste dans l'attribut title — la donnée n'est pas perdue, elle est à
 * un survol. SUR DU PAPIER, IL N'Y A PAS DE SURVOL : ce qui est coupé est
 * perdu, et ce qui déborde passe sur trois lignes dans une colonne étroite.
 *
 * On garde donc les DEUX PREMIERS segments, qui identifient l'aliment
 * (« Sardine, à l'huile »), et on laisse les suivants, qui décrivent le
 * conditionnement. C'est ce que fait la planche du coach, et c'est assez pour
 * faire ses courses. Un nom déjà court n'est pas touché.
 */
function faNomPlanche(n){
  let t='';
  try{ t=planNomCourt(n); }catch(e){ t=String(n||''); }
  const b=String(t).split(',');
  if(b.length<=2) return t.trim();
  return (b[0]+','+b[1]).trim();
}

/**
 * PURE (à la table Ciqual près, comme tout ce module). Tout ce que la fiche
 * affiche, sans une once de mise en page — c'est ce qui la rend vérifiable.
 *
 * Rend TOUJOURS un objet : `ok:false` porte la raison, et la fiche l'affiche
 * au lieu d'une page blanche.
 */
// LA DERNIERE COLONNE DES TABLEAUX : LA QUANTITE POUR SIX REPAS (Kevin,
// 01/10/2026). Elle multipliait le grammage du repas par le nombre de repas
// qui appellent une source (« 2 repas » sur sa fiche) : ce n'est pas ce qu'il
// en attend. C'est une aide pour preparer : la portion d'un repas, six fois.
// ⚠ Le grammage du repas (colonne « Quantite ») ne change pas : lui reste
//   restant / nombre de sources, c'est la dose de l'athlete.
const FA_REPAS_COLONNE=6;
function ficheAlimDonnees(user,chercher){
  const u=_dossier(user);
  if(!u) return {ok:false,raison:'Aucun dossier.'};
  if(!planActif(u)) return {ok:false,raison:'Le plan alimentaire n’est pas encore composé.'};
  const plan=planDe(u);
  const today=localISODate(new Date());
  let isOn=false;
  try{ isOn=nutIsOnDay(today,u); }catch(e){}
  const cib=planCiblesJour(u,isOn,today);
  const couv=planCouverture(plan,chercher);
  const rest=planRestant(cib,couv);
  const src=planSources(plan,rest,chercher);
  const nSrc={p:src.proteines.nSources,c:src.glucides.nSources};
  const moment=planMoment(plan,u);
  const cles=Object.keys(couv.parRepas)
    .sort((a,b)=>planOrdreRepas(a,moment)-planOrdreRepas(b,moment));
  const repas=cles.map(cle=>{
    const r=couv.parRepas[cle];
    const lignes=(r.lignes||[]).map(x=>{
      if(x.note) return {type:'note',nom:x.nom};
      if(x.source) return {type:'source',macro:x.source,nom:x.nom,
        qte:'Se référer au tableau plus bas pour les quantités'};
      if(x.fruit) return {type:'fruit',nom:x.nom,
        qte:'Se référer au tableau plus bas pour les quantités'};
      const q=_planNb(x.item&&x.item.q);
      const un=planUniteItem(x.item);
      return {type:'aliment',nom:x.nom,
        q:(q==null?null:Math.round(q*100)/100),unite:planUnitePluriel(q,un),
        qte:(q==null?'-':String(Math.round(q*100)/100).replace('.',',')+' '+planUnitePluriel(q,un))};
    });
    return {cle,lib:planLibRepas(cle),moment:FA_LIB_MOMENT[cle]||'',
      icone:FA_ICONE[cle]||'',lignes};
  });
  // LES DEUX CATALOGUES, AVEC LEURS TROIS COLONNES. « pour la journée » est le
  // grammage du repas multiplié par le nombre de repas qui appellent une
  // source : c'est ce que la liste de courses fait déjà, et c'est ce que la
  // planche de Kevin appelle « quantité (portion) ».
  const table=(bloc)=>(bloc&&bloc.liste?bloc.liste:[]).map(s=>({
    nom:faNomPlanche(s.nom),
    q:(s.q==null?null:Math.round(s.q)),
    per100:(s.per100==null?null:Math.round(s.per100*100)/100),
    // La quantite AFFICHEE, six fois : le lecteur retrouve le compte.
    jour:(s.q==null)?null:Math.round(s.q)*FA_REPAS_COLONNE,
    alerte:!!s.excessif}));
  const coach=(function(){ try{ return coachAffichable(u)||null; }catch(e){ return null; } })();
  const nomCoach=(function(){
    const c=coach||{};
    const n=((c.fname||'')+' '+(c.lname||'')).trim();
    return n||String(u.coachName||'').trim()||'';
  })();
  return {ok:true,
    edite:Date.now(),
    athlete:((u.fname||'')+' '+(u.lname||'')).trim()||u.email||'',
    kcal:(cib&&cib.kcal>0)?Math.round(cib.kcal):null,
    jourOn:isOn,
    marque:(function(){ try{ return marqueCoachDe(u)||''; }catch(e){ return ''; } })(),
    coachNom:nomCoach,
    nSources:nSrc, nRepasColonne:FA_REPAS_COLONNE, moment,
    avecComplements:!!(plan&&plan.avecComplements),
    repas,
    proteines:table(src.proteines),
    glucides:table(src.glucides),
    fruits:PLAN_FRUITS.map(f=>({n:f.n,q:f.q}))};
}

/** Le document. Deux planches, dans l'ordre des deux PDF du coach. */
function htmlFicheAlim(user,chercher){
  const d=ficheAlimDonnees(user,chercher);
  if(!d.ok) return emptyState('clipboard',escapeHtml(d.raison));
  const E=escapeHtml;
  // L'EN-TÊTE, LE PIED ET LES DEUX RAILS sont communs aux deux planches : ils
  // FONT la planche. Les écrire deux fois les aurait fait diverger au premier
  // ajustement.
  const marque=d.marque
    ? `<img class="fa-logo-img" src="${E(d.marque)}" alt="">`
    : `<div class="fa-logo-txt">REP<span>CORE</span></div>`;
  // LE LOGO DU COACH PREND LA PLACE DU RAIL GAUCHE, A COTE DU TITRE (retour
  // de Kevin le 30/09/2026) : en tete de page, il poussait tout le bandeau
  // vers le bas et restait petit. Sans logo, rien ne change.
  const tete=(titre1,titre2,sous)=>`<header class="fa-tete">
      <div class="fa-tete-g">${d.marque?'':`${marque}<div class="fa-logo-sous">MORE THAN PROGRESS</div>`}</div>
      <div class="fa-tete-d">
        ${d.coachNom?`<div class="fa-tete-coach"><span class="fa-tiret"></span>${E(d.coachNom.toUpperCase())}</div>`:''}
        <div class="fa-tete-sous">NUTRITION | PERFORMANCE | RÉSULTATS</div>
      </div>
    </header>
    <div class="fa-bandeau">
      ${d.marque?`<div class="fa-rail-logo">${marque}<div class="fa-logo-sous">MORE THAN PROGRESS</div></div>`
        :`<div class="fa-rail fa-rail-g">NUTRITION<br>PERFORMANCE<br>SANTÉ<br>DISCIPLINE</div>`}
      <div class="fa-titre-bloc">
        <h1 class="fa-h1">${E(titre1)} <em>${E(titre2)}</em></h1>
        ${sous?`<div class="fa-h1-sous">${sous}</div>`:''}
      </div>
      <div class="fa-rail fa-rail-d">DISCIPLINE<br>AUJOURD'HUI<br><b>RÉSULTATS</b><br>DEMAIN.</div>
    </div>`;
  const pied=`<footer class="fa-pied">
      <div class="fa-pied-g">${d.marque?`<img class="fa-pied-logo" src="${E(d.marque)}" alt="">`:''}<div>${d.coachNom?`<b>${E(d.coachNom.toUpperCase())}</b>`:''}<span>COACHING | NUTRITION | SUIVI</span></div></div>
      <div class="fa-pied-c">DES FONDATIONS SOLIDES<br>POUR DE MEILLEURS RÉSULTATS.${(d.athlete&&d.athlete.indexOf('@')<0)?`<small class="fa-pied-pour">POUR ${E(d.athlete.toUpperCase())} · ${E(new Date(d.edite||Date.now()).toLocaleDateString('fr-FR'))}</small>`:`<small class="fa-pied-pour">${E(new Date(d.edite||Date.now()).toLocaleDateString('fr-FR'))}</small>`}</div>
      <div class="fa-pied-d">REP<span>CORE</span><em>MORE THAN PROGRESS</em></div>
    </footer>`;

  // ── PLANCHE 1 : LE PROGRAMME ────────────────────────────────────────────
  const ligne=(l)=>{
    if(l.type==='note') return `<tr class="fa-note"><td colspan="2">${E(l.nom)}</td></tr>`;
    const cls=l.type==='source'?(l.macro==='p'?' fa-l-prot':' fa-l-gluc')
      :(l.type==='fruit'?' fa-l-fruit':'');
    const val=(l.type==='aliment'&&l.q!=null)
      ? `<b>${E(String(l.q).replace('.',','))}</b> ${E(l.unite||'')}`
      : E(l.qte||'');
    return `<tr class="fa-l${cls}"><td class="fa-l-n">${E(l.nom)}</td><td class="fa-l-q">${val}</td></tr>`;
  };
  const blocs=d.repas.map((r,i)=>{
    const mots=String(r.lib).split(' ');
    const t1=mots.shift(), t2=mots.join(' ');
    const note=(r.lignes[0]&&r.lignes[0].type==='note')?r.lignes[0].nom:'';
    const corps=r.lignes.filter((l,k)=>!(k===0&&l.type==='note')).map(ligne).join('');
    return `<section class="fa-repas">
      <div class="fa-repas-tete">
        ${r.icone?`<span class="fa-repas-ico">${r.icone}</span>`:''}
        <span class="fa-repas-t">${E(t1)} <em>${E(t2)}</em></span>
        ${note?`<span class="fa-repas-note">${E(note)}</span>`:''}
        <span class="fa-repas-moment">${E(r.moment)}</span>
        <span class="fa-repas-num">${String(i+1).padStart(2,'0')}</span>
      </div>
      <table class="fa-tbl">${corps||'<tr class="fa-l"><td colspan="2">-</td></tr>'}</table>
    </section>`;
  }).join('');

  // ── PLANCHE 2 : LES TABLEAUX ────────────────────────────────────────────
  const tbl4=(lignes)=>lignes.length
    ? `<table class="fa-t4"><colgroup><col class="fa-col-nom"><col><col><col class="fa-col-jour"></colgroup>`
      +`<thead><tr><th>Aliment</th><th>Quantité</th>
        <th>Pour 100 g</th><th>Pour ${d.nRepasColonne} repas</th></tr></thead><tbody>`
      +lignes.map(l=>`<tr><td class="fa-t4-n">${E(l.nom)}</td>
        <td${l.alerte?' class="fa-alerte"':''}>${l.q==null?'-':E(l.q+' g')}</td>
        <td>${l.per100==null?'-':E(String(l.per100).replace('.',',')+' g')}</td>
        <td>${l.jour==null?'-':E(l.jour+' g')}</td></tr>`).join('')
      +'</tbody></table>'
    : `<div class="fa-vide-t">Aucune source posée par le coach.</div>`;
  // LA LISTE DES GLUCIDES PASSE SUR DEUX COLONNES au-dela de douze lignes.
  // Sur une seule, ses trente lignes rendaient la seconde planche trop haute :
  // pour la faire tenir sur la feuille, il fallait la reduire, et elle
  // laissait deux bandes blanches sur les cotes.
  const FA_DEUX_COL=12;
  const tblGluc=d.glucides.length>FA_DEUX_COL
    ? `<div class="fa-2col">${tbl4(d.glucides.slice(0,Math.ceil(d.glucides.length/2)))}`
      +`${tbl4(d.glucides.slice(Math.ceil(d.glucides.length/2)))}</div>`
    : tbl4(d.glucides);
  const tblFruits=`<table class="fa-t2"><colgroup><col class="fa-col-fruit"><col></colgroup><thead><tr><th>Aliment</th><th>Quantité</th></tr></thead><tbody>`
    +d.fruits.map(f=>`<tr><td class="fa-t4-n">${E(f.n)}</td><td>${E(f.q)}</td></tr>`).join('')
    +'</tbody></table>';

  return `<article class="fa-page fa-p1">
    ${tete('PROGRAMME','NUTRITIONNEL',
      (d.kcal?`( ${d.kcal} Cal )`:'')
      +`<div class="fa-h1-note">Ce programme alimentaire est proposé à titre indicatif, `
      +`en tant qu'exemple adapté à vos besoins.</div>`)}
    ${blocs}
    ${pied}
  </article>
  <article class="fa-page fa-p2">
    ${tete('TABLEAUX','NUTRITIONNELS',
      `<div class="fa-h1-note">DES REPÈRES SIMPLES POUR MIEUX MANGER</div>`)}
    <div class="fa-cols">
      <section class="fa-carte fa-c-prot">
        <div class="fa-carte-t">SOURCES DE PROTÉINES</div>
        ${tbl4(d.proteines)}
      </section>
      <section class="fa-carte fa-c-fruit">
        <div class="fa-carte-t">1 PORTION DE FRUITS</div>
        ${tblFruits}
      </section>
    </div>
    <section class="fa-carte fa-c-gluc">
      <div class="fa-carte-t">SOURCES DE GLUCIDES</div>
      ${tblGluc}
    </section>
    <div class="fa-motto">${E(FA_MOTTO)}</div>
    ${pied}
  </article>`;
}

let _faCible=null;
/**
 * L'ÉCRAN, POUR LES DEUX CÔTÉS. `s-fiche-alim` ne porte NI `s-coach-` NI
 * `s-client-` : le garde de rôle de go() filtre sur ces deux préfixes, et un
 * écran que l'athlète et son coach ouvrent tous les deux ne doit s'appeler ni
 * l'un ni l'autre. Même raison que `s-traitement-edit`.
 */
function ouvrirFicheAlim(cible){
  _faCible=cible||currentUser;
  goAvecRetour('s-fiche-alim');
  faRendre();
  return true;
}
function faRendre(){
  const z=document.getElementById('fa-corps');
  if(!z) return false;
  // LA TABLE CIQUAL EST NÉCESSAIRE : sans elle, toutes les sources
  // s'afficheraient « aliment introuvable ». On rend une fois — l'écran ne
  // doit pas rester blanc — puis on recommence quand elle est là, exactement
  // comme le fait l'écran de l'athlète.
  if(!_ciqualDB){ try{ _loadCiqual().then(()=>{ if(_faCible) faRendre(); }); }catch(e){} }
  let h='';
  try{ h=htmlFicheAlim(_faCible); }
  catch(e){ h=etatErreur('Fiche indisponible : '+escapeHtml(String(e&&e.message||e))); }
  z.innerHTML=h;
  faEchelle();
  return true;
}
/**
 * LA PLANCHE NE SE REFLOW PAS, ELLE SE MET A L'ECHELLE. Un tableau de quatre
 * colonnes replie sur 375 px ne ressemble plus a ce qui sortira de
 * l'imprimante, et l'apercu ne servirait alors a rien.
 *
 * `zoom` D'ABORD : il change la mise en page, donc la planche reduite ne laisse
 * pas un demi-ecran de vide sous elle. La ou il manque, `transform` fait la
 * meme chose a l'oeil — mais il ne reprend pas la place, et il faut alors poser
 * la hauteur a la main.
 */
function faEchelle(){
  const z=document.getElementById('fa-corps');
  if(!z) return null;
  const pages=[...z.querySelectorAll('.fa-page')];
  if(!pages.length) return null;
  const zoomOk=(typeof CSS!=='undefined'&&CSS.supports&&CSS.supports('zoom','0.5'));
  let k=1;
  for(const p of pages){
    p.style.zoom=''; p.style.transform=''; p.style.height='';
    // CHAQUE PLANCHE A SA LARGEUR : 1 024 px, 1 120 pour la seconde.
    k=Math.min(1,(z.clientWidth||1024)/(p.offsetWidth||1024));
    if(k>=1) continue;
    if(zoomOk){ p.style.zoom=String(k); continue; }
    const h=p.getBoundingClientRect().height;
    p.style.transform='scale('+k+')';
    p.style.height=Math.round(h*k)+'px';
  }
  return k;
}
/**
 * LA PLANCHE TIENT SUR UNE FEUILLE, ET C'EST CALCULE AVANT D'IMPRIMER.
 *
 * Une planche fait 1024 px de large et deux mille et quelques de haut : c'est
 * une AFFICHE, pas une page A4. Laissee telle quelle, chacune se coupait en
 * deux feuilles — mesure au banc : un PDF de quatre pages pour deux planches,
 * avec un tableau tranche au milieu.
 *
 * On garde donc la mise en page EXACTE de l'ecran — meme largeur, mêmes
 * colonnes, mêmes retours a la ligne — et on met la planche entiere a
 * l'echelle pour qu'elle entre dans la surface utile : 198 mm sur 285 mm,
 * c'est-a-dire une A4 moins les marges de 6 mm de la page nommee « fa ».
 *
 * ⚠ LA HAUTEUR SE MESURE A ZOOM 1. `getBoundingClientRect` rend la hauteur
 *   DEJA mise a l'echelle par le zoom d'ecran : mesurer sans le remettre a
 *   plat ferait retrecir la planche un peu plus a chaque impression.
 */
function faImprimer(){
  const pages=[...document.querySelectorAll('#fa-corps .fa-page')];
  // 198 mm et 285 mm, en pixels CSS : une A4 moins les marges de 6 mm de la
  // page nommee « fa » (rc-style, @page fa). Elles etaient de 14 mm, et la
  // planche flottait au milieu de la feuille (retour de Kevin le 30/09/2026).
  const L=748.3, H=1077.2;
  for(const p of pages){
    const garde=p.style.zoom;
    p.style.zoom='1';
    const h=p.getBoundingClientRect().height||1;
    // LA LARGEUR SE MESURE AUSSI : la seconde planche est plus large que la
    // premiere (voir .fa-p2 dans rc-style), pour qu'elle remplisse la feuille.
    const w=p.getBoundingClientRect().width||1024;
    p.style.zoom=garde;
    // ⚠ SEPT POUR CENT DE MARGE, ET UN ARRONDI VERS LE BAS. La hauteur se
    //   mesure en media ECRAN, et la planche est un peu plus haute en media
    //   IMPRESSION : l'ecran qui la porte passe de flex a block, et les
    //   paddings tombent a zero. Mesure au banc : 1 033 px rendus pour 988
    //   attendus, soit 4,5 % de plus — et le PDF sortait en trois pages pour
    //   deux planches. Sept pour cent couvrent cet ecart sans qu'on ait a
    //   deviner d'ou vient chaque pixel.
    const k=Math.min(L/w,(H*0.93)/h);
    p.style.setProperty('--fa-k-print',String(Math.floor(k*1000)/1000));
  }
  return rapImprimer();
}
window.faImprimer=faImprimer;

// LES COLONNES CHIFFREES, dans l’ordre où on les lit sur un banc. Le nom,
// la méthode et la description ne sont PAS ici : ce sont des textes longs,
// ils tiennent dans la première cellule, en sous-lignes. Dix colonnes sur
// une A4 ne se lisent plus.
const PP_COLS=Object.freeze([
  {cle:'materiel',lib:'Matériel',v:ex=>ex.materiel},
  {cle:'series',  lib:'Séries',  v:ex=>ex.series},
  {cle:'reps',    lib:'Reps',    v:ex=>ex.reps},
  // La programmation passe devant le texte libre — voir _chargePrescrite.
  // Comme pour le RIR, LA COLONNE N'APPARAIT QUE SI QUELQU'UN LA REMPLIT :
  // _ppColonnes ne retient que les colonnes non vides.
  {cle:'charge',  lib:'Charge',  v:ex=>_chargePrescrite(ex)},
  // N6.3 + B3.10 — DEUX CLEFS, ET C'EST `rir` QUI EST ECRITE.
  //
  // Le commentaire disait exactement l'inverse : « rirCible est le champ que
  // l'editeur ecrit desormais ». Rien ne cassait — _rirPrescrit lit rirCible
  // puis se replie sur rir, et comme personne n'ecrivait rirCible, le repli
  // s'appliquait toujours. Mais le prochain lecteur aurait cherche la consigne
  // dans le mauvais champ.
  //
  // POURQUOI LES DEUX COHABITENT : `rirCible` n'est ecrit par aucune ligne du
  // fichier, mais un dossier deja en circulation peut en porter un — il suffit
  // qu'une version anterieure l'ait ecrit, ou qu'un import l'ait pose. Le
  // supprimer ferait perdre sa consigne a cet athlete-la, en silence. Il reste
  // donc LU EN PRIORITE, et B3.4 le met a jour en meme temps que `rir` quand
  // il existe, pour qu'il ne gagne jamais sur une valeur plus recente.
  // LA COLONNE N'APPARAIT QUE SI QUELQU'UN LA REMPLIT — _ppColonnes ne retient
  // que les colonnes non vides. Une absence de consigne n'est pas une consigne.
  {cle:'rir',     lib:'RIR',     v:ex=>_rirPrescrit(ex)},
  {cle:'repos',   lib:'Repos',   v:ex=>ex.repos},
  {cle:'tempo',   lib:'Tempo',   v:ex=>ex.tempo}
]);
function _ppTexte(v){ return String(v==null?'':v).trim(); }
// PURE. La charge prescrite d'un exercice, quel que soit le champ qui la porte.
// Vide quand il n'y a pas de consigne, et vide veut dire vide.
//
// MEME REGLE QUE _rirPrescrit, juste en dessous, et volontairement : le champ
// STRUCTURE passe devant le champ TEXTE LIBRE, on se replie sur l'ancien quand
// le nouveau n'a rien a dire, et une absence n'est jamais comblee. Ecrire une
// seconde convention aurait donne deux fonctions voisines qui arbitrent la meme
// question de deux facons.
//
// CE QU'ELLE REPARE. La programmation par exercice calcule une charge — 1RM,
// pourcentage de la table, RPE de la semaine — et l'expose par
// consigneProgEx(ex).kg. Mais l'apercu de seance et la fiche imprimee ne
// lisaient que ex.charge, le champ texte libre : le coach voyait sa charge
// calculee dans l'editeur, et l'athlete recevait une case vide. La consigne
// existait et n'arrivait pas.
//
// LA PROGRAMMATION D'ABORD, et c'est le sens : elle est datee, calculee et
// tenue a jour semaine par semaine, la ou ex.charge est une note que personne
// ne relit. Hors programmation — semaine passee, ligne incomplete, au-dela de
// douze repetitions ou la table ne dit rien — on retombe sur le texte libre,
// qui reste ce qu'il a toujours ete.
function _chargePrescrite(ex){
  if(!ex||typeof ex!=='object') return '';
  const c=(()=>{ try{ return consigneProgEx(ex); }catch(e){ return null; } })();
  if(c&&c.kg!=null) return String(c.kg).replace('.',',')+' kg';
  const v=(ex.charge!=null&&String(ex.charge).trim()!=='')?ex.charge:ex.poids;
  return String(v==null?'':v).trim();
}
// N6.3 — PURE. L'intensite prescrite d'un exercice, quel que soit le champ qui
// la porte. Vide quand il n'y a pas de consigne, et vide veut dire vide.
function _rirPrescrit(ex){
  if(!ex||typeof ex!=='object') return '';
  const v=(ex.rirCible!=null&&String(ex.rirCible).trim()!=='')?ex.rirCible:ex.rir;
  const s=String(v==null?'':v).trim();
  if(s==='') return '';
  const n=Number(s);
  return (isFinite(n)&&n>=0&&n<=5)?String(Math.round(n)):'';
}
// PURE. Les créneaux actifs, avec leur INDICE de jour conservé : filtrer
// d’abord perdrait la correspondance avec DAYS, et la fiche annoncerait le
// mauvais jour dès qu’un créneau est éteint.
// LA FICHE DIT LA SEMAINE EN COURS (06/10/2026) : la séance du jour —
// écarts du bloc et décharge du créneau compris —, comme l'aperçu et la
// séance. Une copie : le gabarit n'est pas touché.
function _ppSeancesActives(u){
  const cfg=(u&&Array.isArray(u.sessions_config))?u.sessions_config:[];
  const t=Date.now();
  return cfg.map((s,i)=>({s,i})).filter(x=>x.s&&x.s.active===true)
    .map(x=>{ let j=null; try{ j=seanceDuJourAffichee(u,x.i,t); }catch(e){ j=null; } return {s:j||x.s,i:x.i}; });
}
// LES COLONNES VIDES SAUTENT — pas de « — » ni de « 0 », c’est la règle de
// l’application : une absence de consigne n’est pas une consigne.
//
// Le choix se fait sur TOUT le document et non séance par séance : deux
// tableaux aux colonnes différentes sur la même page se liraient comme deux
// documents, et l’œil qui descend la colonne « Charge » la perdrait.
function _ppColonnes(seances){
  const exs=[];
  (seances||[]).forEach(x=>((x.s&&x.s.exercises)||[]).forEach(e=>{ if(e) exs.push(e); }));
  return PP_COLS.filter(c=>exs.some(e=>_ppTexte(c.v(e))!==''));
}
function _ppBloc(lib,txt){
  const t=_ppTexte(txt);
  if(!t) return '';
  return `<div class="pp-lbl">${escapeHtml(lib)}</div><div class="pp-txt">${escapeHtml(t)}</div>`;
}
function _ppTable(seance,cols){
  const exs=((seance&&seance.exercises)||[]).filter(Boolean);
  if(!exs.length) return '';
  const th=cols.map(c=>`<th>${escapeHtml(c.lib)}</th>`).join('');
  const lignes=exs.map((ex,n)=>{
    let meth=''; try{ meth=_libTechniqueSeries(ex)||''; }catch(e){ meth=''; }
    const desc=_ppTexte(ex.description);
    // La méthode PORTE DÉJÀ ses séries concernées : _libTechniqueSeries rend
    // « Rest-pause · séries : dernière ». On ne reformule pas ici, sinon la
    // fiche et la bannière de séance finiraient par ne plus dire pareil.
    const nom=`<div class="pp-nom">${n+1}. ${escapeHtml(_ppTexte(ex.name)||'Exercice '+(n+1))}</div>`
      +(meth?`<div class="pp-meta">${escapeHtml(meth)}</div>`:'')
      +(desc?`<div class="pp-meta">${escapeHtml(desc)}</div>`:'');
    return `<tr><td>${nom}</td>`+cols.map(c=>`<td>${escapeHtml(_ppTexte(c.v(ex)))}</td>`).join('')+'</tr>';
  }).join('');
  return `<table class="rap-tbl"><thead><tr><th>Exercice</th>${th}</tr></thead><tbody>${lignes}</tbody></table>`;
}
// PURE. Ne lit QUE `u` : la même fonction sert l’athlète sur son dossier et
// le coach sur celui d’un client. Un `currentUser` glissé ici ferait imprimer
// le programme du coach sur la fiche de son athlète.
function htmlProgrammePrint(u){
  const seances=_ppSeancesActives(u);
  const tete=`<header class="pp-tete">
    <div class="rap-titre">Programme</div>
    <div class="rap-sous">${escapeHtml(_ppTexte(u&&u.fname)||'Athlète')}</div>
    <div class="rap-meta">Édité le ${new Date().toLocaleDateString('fr-FR')}</div>
  </header>`;
  const sign=htmlSignatureDocument(u);
  if(!seances.length) return tete+emptyState('','Aucun créneau actif : rien à imprimer.',null,null,'padding:12px 0')+sign;
  const cols=_ppColonnes(seances);
  return tete+seances.map(x=>{
    const s=x.s;
    const jour=_ppTexte(s.day)||DAYS[x.i]||'';
    const nom=_ppTexte(s.name);
    const titre=jour?(jour+(nom?' · '+nom:'')):_nomSeance(s,x.i);
    // ?? et non || : demarrerSeance applique le protocole mémorisé avec la
    // MÊME règle. Un champ vidé volontairement par le coach doit rester vide
    // sur la fiche comme au lancement — sans quoi le papier promettrait un
    // échauffement que l’écran ne montrera pas.
    const wu=_ppTexte(s.warmup??(u&&u._defaultWarmup)??'');
    const cd=_ppTexte(s.cooldown??(u&&u._defaultCooldown)??'');
    return `<section class="pp-seance"><h2>${escapeHtml(titre)}</h2>`
      +_ppBloc('Échauffement',wu)
      +_ppTable(s,cols)
      +_ppBloc('Retour au calme',cd)
      +_ppBloc('Notes',s.notes)
      +'</section>';
  }).join('')+sign;
}
let _ppCible=null;
// Sur le modèle d’ouvrirRapport : la cible est passée, et le défaut est le
// dossier courant. goAvecRetour et non go — l’écran est atteignable depuis
// la fiche coach, et le rendra un jour depuis l’onglet de l’athlète.
function ouvrirProgrammePrint(cible){
  _ppCible=cible||currentUser;
  goAvecRetour('s-programme-print');
  ppRendre();
  return true;
}
function ppRendre(){
  const z=document.getElementById('pp-corps');
  if(!z) return false;
  let h='';
  try{ h=htmlProgrammePrint(_ppCible); }catch(e){ h=emptyState('','Fiche indisponible.',null,null,'padding:12px 0'); }
  z.innerHTML=h;
  return true;
}
// ══════════════ PHOTOS DE PROGRESSION ═════════════════════════════════════
// UNE PHOTO DE SPORTIF EST UNE DONNÉE DE SANTÉ par destination — article 9
// RGPD, doctrine CNIL. Tout ce bloc en découle.
//
// LE CHOIX STRUCTURANT : les photos NE QUITTENT PAS L'APPAREIL tant qu'elles
// ne sont pas explicitement partagées. Elles vivent en IndexedDB, en Blob.
//
// Pourquoi : un upload Cloudinary NON SIGNÉ ne permet AUCUNE suppression
// programmatique. L'API de destruction exige la clé secrète, qu'une SPA ne
// peut pas embarquer sans la publier ; le `delete_token` d'un upload non signé
// ne vit que dix minutes. Promettre « la révocation supprime les fichiers »
// pour une photo envoyée serait un mensonge, et un consentement recueilli sur
// un mensonge est vicié. En local, la promesse est tenable et vérifiable.
//
// Le document `user` ne porte QUE des métadonnées : date, pose, dimensions,
// octets. Jamais de base64, jamais de Blob.
const PHP_POSES=Object.freeze([
  {cle:'face',   lib:'De face'},
  {cle:'dos',    lib:'De dos'},
  {cle:'profilG',lib:'Profil gauche'},
  {cle:'profilD',lib:'Profil droit'}
]);
const PHP_MAX_DIM=1280;
const PHP_QUALITE=0.75;
const PHP_MAX_SEANCES=200;
const PHP_DB='repcore-photos';
const PHP_STORE='blobs';
const PHP_FILE_CLE='rc_photos_attente';

// ── Le nœud ────────────────────────────────────────────────────────────────
// PURE. Nœud absent = état initial. L'absence n'est pas une valeur, et la
// lecture n'écrit RIEN — c'est la règle qui empêche un simple chargement de
// créer un consentement par inadvertance.
function phpEtat(u){
  const p=(u&&u.photosProgression)||null;
  const c=(p&&p.consentement)||null;
  return {
    donne:!!(c&&c.donne),
    date:(c&&c.date)||0,
    partageCoach:!!(c&&c.donne&&c.partageCoach),
    seances:Array.isArray(p&&p.seances)?p.seances:[]
  };
}
// PURE. RÈGLE 5 : grossesse ou allaitement déclarés, la fonction est MASQUÉE.
// Même doctrine que la suspension d'entraînement : on ne suit pas la
// transformation d'un corps qui change pour une raison qui ne nous regarde pas.
function phpDisponible(u){
  const g=u&&u.grossesse&&u.grossesse.etat;
  return !(g==='enceinte'||g==='allaitement');
}

// ── Compression : un BLOB, jamais du base64 ───────────────────────────────
// compressImage existante rend un data URL et sert à huit autres endroits :
// elle n'est PAS touchée. Celle-ci rend un Blob, ce que le stockage local
// attend et ce que le document `user` ne verra jamais.
//
// RÈGLE 3 : un échec de compression est un échec d'ENVOI. L'original ne part
// jamais — ni vers IndexedDB, ni vers le réseau.
function compressImageBlob(file,maxDim,quality){
  return new Promise((resolve,reject)=>{
    if(!file||!/^image\//.test(file.type||'')) return reject(new Error('Ce fichier n\'est pas une image.'));
    const md=maxDim>0?maxDim:PHP_MAX_DIM;
    const q=(quality>0&&quality<=1)?quality:PHP_QUALITE;
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Lecture du fichier impossible.'));
    reader.onload=ev=>{
      const img=new Image();
      img.onerror=()=>reject(new Error('Image illisible.'));
      img.onload=()=>{
        try{
          let w=img.width,h=img.height;
          if(!(w>0&&h>0)) return reject(new Error('Image sans dimensions.'));
          if(w>md||h>md){
            if(w>=h){h=Math.round(h*md/w);w=md;}
            else{w=Math.round(w*md/h);h=md;}
          }
          const cv=document.createElement('canvas');
          cv.width=w;cv.height=h;
          cv.getContext('2d').drawImage(img,0,0,w,h);
          if(!cv.toBlob) return reject(new Error('Compression indisponible sur ce navigateur.'));
          cv.toBlob(b=>{
            if(!b||!b.size) return reject(new Error('La compression a échoué.'));
            resolve({blob:b,w,h,octets:b.size});
          },'image/jpeg',q);
        }catch(e){ reject(new Error('La compression a échoué.')); }
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Stockage local : IndexedDB, en Blob ───────────────────────────────────
// PAS localStorage : son quota de cinq mégaoctets saute à la troisième séance,
// et il ne stocke que des chaînes — donc du base64, donc ce qu'on refuse.
function phpDB(){
  return new Promise((resolve,reject)=>{
    if(!window.indexedDB) return reject(new Error('Stockage local indisponible.'));
    const r=indexedDB.open(PHP_DB,1);
    r.onupgradeneeded=()=>{ const db=r.result;
      if(!db.objectStoreNames.contains(PHP_STORE)) db.createObjectStore(PHP_STORE); };
    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>reject(new Error('Stockage local indisponible.'));
  });
}
function _phpTx(mode,fn){
  return phpDB().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(PHP_STORE,mode);
    const st=tx.objectStore(PHP_STORE);
    let out;
    try{ out=fn(st); }catch(e){ return reject(e); }
    tx.oncomplete=()=>resolve(out&&out.result!==undefined?out.result:out);
    tx.onerror=()=>reject(new Error('Écriture locale impossible.'));
  }));
}
function phpEcrireBlob(cle,blob){ return _phpTx('readwrite',st=>st.put(blob,cle)); }
function phpLireBlob(cle){ return _phpTx('readonly',st=>st.get(cle)); }
function phpSupprimerBlob(cle){ return _phpTx('readwrite',st=>st.delete(cle)); }
// RÈGLE 2 : la révocation supprime RÉELLEMENT. Ici, c'est tenable — et c'est
// exactement pourquoi les photos restent locales par défaut.
function phpViderBlobs(){ return _phpTx('readwrite',st=>st.clear()); }

function phpFileEcrire(l){
  try{ localStorage.setItem(PHP_FILE_CLE,JSON.stringify((l||[]).slice(0,PHP_MAX_SEANCES*4)));
    return true; }catch(e){ return false; }
}

// PURE. Toutes les poses partagées, pour la liste de purge honnête.
function phpPartagees(u){
  const out=[];
  for(const s of phpEtat(u).seances)
    for(const p of PHP_POSES){
      const x=s.poses&&s.poses[p.cle];
      if(x&&x.publicId) out.push({date:s.date,pose:p.cle,publicId:x.publicId,url:x.url});
    }
  return out;
}
// ══ TOUT ENVOI CLOUDINARY EST SIGNÉ PAR LE SERVEUR (01/10/2026) ══════════════
// Les envois partaient avec un preset PUBLIC : quiconque lisait ce fichier
// pouvait déposer n'importe quoi, n'importe où, sur le compte de RepCore. Le
// Worker (cloudinarySigner) vérifie le jeton, IMPOSE le dossier (le sien, ou
// celui d'un athlète dont on est le coach), signe les formats, et limite à
// trente signatures par heure. L'app recopie ce qu'il rend, tel quel, dans
// l'envoi : elle ne connaît ni le secret ni le preset.
// Rend {url, champs}. Lève si la signature est refusée ou injoignable : les
// appelants gardent alors le média en file (fileEnvoiPoser), comme une coupure.
async function _cloudinarySigner(dossier,type,publicId){
  const data={dossier:String(dossier||''),type:String(type||'')};
  if(publicId) data.publicId=String(publicId);
  let r;
  try{ r=await CLOUD._callFn('cloudinarySigner',data); }
  catch(e){ throw new Error('Envoi non autorisé pour le moment ('+((e&&e.message)||'serveur injoignable')+')'); }
  if(!r||!r.signature||!r.cloud_name||!r.resource_type) throw new Error('Signature d’envoi invalide');
  const champs={};
  for(const k of Object.keys(r)) if(k!=='cloud_name'&&k!=='resource_type'&&r[k]!=null) champs[k]=String(r[k]);
  return {url:'https://api.cloudinary.com/v1_1/'+encodeURIComponent(r.cloud_name)+'/'+r.resource_type+'/upload',champs,cloudName:String(r.cloud_name)};
}
function _champsDansFormData(fd,champs){ for(const k of Object.keys(champs||{})) fd.append(k,champs[k]); return fd; }
// L'endpoint IMAGE, et non /video/upload que l'existant utilise pour tout.
// AUCUNE transformation n'est demandée : elles consomment des crédits, et la
// compression est déjà faite côté client.
async function phpUploadImage(blob,nom,dossier){
  // LE DOSSIER EST UN ARGUMENT DEPUIS LE BUILD 1421 : les photos de bilan
  // passent par la meme porte, sous 'bilan/'. Un seul chemin d'envoi, un seul
  // endroit ou corriger le jour ou l'hebergeur change.
  const sig=await _cloudinarySigner('repcore/'+(currentUser.id||currentUser.email)+'/'+(dossier||'progression'),'image');
  const fd=new FormData();
  fd.append('file',blob,(nom||'photo').replace(/\//g,'_')+'.jpg');
  _champsDansFormData(fd,sig.champs);
  const res=await fetch(sig.url,{method:'POST',body:fd});
  if(!res.ok) throw new Error('Erreur serveur '+res.status);
  const data=await res.json();
  if(data.error) throw new Error(data.error.message);
  // CE QUE L'HEBERGEUR A RECU, COMPTE. Sans ce chiffre, le cout de Cloudinary
  // n'apparait sur aucun ecran et ne se decide nulle part.
  try{ rcq('cld_envois',1); rcqOctets('cld_ko',(blob&&blob.size)||Number(data.bytes)||0); }catch(e){}
  return data;
}
// ── Révocation ────────────────────────────────────────────────────────────
// CE QU'ELLE FAIT VRAIMENT, et ce qu'elle ne peut pas faire.
//
// Les blobs locaux sont DÉTRUITS : garantie tenue, vérifiable. Les copies déjà
// transmises au coach ne peuvent pas être effacées depuis l'application — un
// upload non signé ne le permet pas, et embarquer la clé secrète reviendrait à
// donner à tout le monde le droit d'effacer le compte. On tente le
// `delete_token` quand on est encore dans ses dix minutes ; au-delà, on REND LA
// LISTE des identifiants à purger, et l'écran le dit sans le maquiller.
async function phpRevoquer(u){
  if(!u||!u.photosProgression) return {ok:true,local:0,restants:[]};
  const partagees=phpPartagees(u);
  const restants=[];
  for(const p of partagees){
    let efface=false;
    const x=(phpEtat(u).seances.find(s=>s.date===p.date)||{poses:{}}).poses[p.pose];
    if(x&&x.deleteToken){
      try{ efface=await phpAnnulerUpload(x.deleteToken); }catch(e){ efface=false; }
    }
    // PUIS LA FONCTION SERVEUR. Une revocation est un DROIT : tout ce qui peut
    // etre detruit doit l'etre, et ce qui reste doit rester ecrit quelque part.
    if(!efface){
      const _d=await _cldDetruire(p.publicId,'image',
        {proprietaire:u.email,quoi:'photo de progression ('+p.pose+', '+p.date+')'});
      efface=_d.ok;
    }
    if(!efface) restants.push({publicId:p.publicId,date:p.date,pose:p.pose});
  }
  let local=0;
  try{ await phpViderBlobs(); local=1; }catch(e){ local=0; }
  phpFileEcrire([]);
  u.photosProgression.seances=[];
  u.photosProgression.consentement={donne:false,date:Date.now(),partageCoach:false};
  // La liste des identifiants restants est CONSERVÉE : la cacher reviendrait à
  // laisser croire que tout a disparu.
  //
  // FUSIONNÉE, JAMAIS ÉCRASÉE. phpSupprimerPose a pu en inscrire avant nous :
  // ses poses ne sont plus dans `seances`, donc phpPartagees ne les voit pas et
  // la boucle ci-dessus ne les recalcule pas. L’affectation les effaçait — et
  // avec elles la seule trace de fichiers qui, eux, restent chez l'hébergeur.
  //
  // DÉDOUBLONNÉ PAR publicId : une pose inscrite par phpSupprimerPose peut
  // reparaître dans les restants si la séance a été recréée entre-temps.
  const anciens=Array.isArray(u.photosProgression.aPurger)?u.photosProgression.aPurger:[];
  const fusion=[];
  const vus=new Set();
  for(const e of anciens.concat(restants)){
    const id=e&&e.publicId;
    if(!id||vus.has(id)) continue;
    vus.add(id); fusion.push(e);
  }
  if(fusion.length) u.photosProgression.aPurger=fusion;
  else delete u.photosProgression.aPurger;
  // `restants` reste ce qui a échoué CE COUP-CI — d’autres lecteurs pourraient
  // s'y fier. `aPurger` est le total, et c'est lui que l'écran doit annoncer.
  return {ok:true,local,restants,aPurger:fusion};
}
// Le `delete_token` d'un upload non signé : valable dix minutes, et seulement
// si le préréglage l'autorise. C'est la SEULE suppression qu'un client puisse
// faire, et elle ne couvre qu'une annulation immédiate.
async function phpAnnulerUpload(token){
  const users=DB.get('users')||{};
  const coach=currentUser&&currentUser.coachId
    ?Object.values(users).find(x=>x.id===currentUser.coachId):null;
  const cloudName=(coach&&coach.cloudinaryName)||currentUser.cloudinaryName||'dntu57ml';
  const fd=new FormData();
  fd.append('token',token);
  const res=await fetch('https://api.cloudinary.com/v1_1/'+cloudName+'/delete_by_token',
    {method:'POST',body:fd});
  if(!res.ok) return false;
  const d=await res.json();
  return d&&d.result==='ok';
}

// ══════════════ LES PHOTOS DE BILAN, HORS DU DOCUMENT ══════════════════════
//
// CE QUI SE PASSAIT, MESURÉ LE 23/09/2026 sur une photo de corps plausible :
//   • `addBilanPhoto` compressait en 1080×1440 et écrivait le data-URL —
//     373 815 caractères — DANS LE DOSSIER, puis une SECONDE copie sous
//     rc_photo_<date>_<champ>. Deux fois 365 Ko de chaîne, dans un
//     localStorage qui plafonne à cinq mégaoctets : trois bilans avec leurs
//     trois vues et le stockage de l'appareil est plein ;
//   • `_doPushOne` recompressait CHAQUE photo en 220×293 à chaque poussée —
//     8 835 caractères l'unité — et poussait le document ENTIER. Vingt-quatre
//     photos, c'est 212 Ko renvoyés sur le réseau à chaque écriture du
//     dossier, plus un décodage/réencodage de vingt-quatre images à chaque
//     fois, sur le téléphone de quelqu'un.
//
// CE QU'ON FAIT, et c'est le motif DÉJÀ EN PLACE pour les photos de
// progression, repris tel quel : compressImageBlob → un Blob dans IndexedDB →
// l'hébergeur à la demande. LE DOCUMENT NE PORTE PLUS QU'UNE RÉFÉRENCE :
// {cle, w, h, octets} et, une fois la photo transmise, {url, publicId}.
// Soixante-dix octets à la place de huit mille huit cents.
//
// ⚠ UNE PHOTO DE BILAN EST TRANSMISE AU COACH, ET ELLE L'A TOUJOURS ÉTÉ : elle
//   fait partie du bilan qu'il lit, c'est même ce pour quoi elle est prise. Ce
//   lot ne change pas QUI la voit — il change PAR OÙ elle passe. Ce qui change
//   pour de bon, c'est qu'elle ne traverse plus le document à chaque
//   synchronisation, et que la haute définition ne quitte plus l'appareil.
//
// ⚠ ET LA MIGRATION NE PERD RIEN. Tant qu'une photo ancienne n'est pas montée
//   chez l'hébergeur, SON BASE64 RESTE DANS LE DOSSIER. On n'échange une chaîne
//   contre une référence qu'une fois la référence valide — jamais l'inverse.
const BILP_MAX_DIM=1280;
const BILP_QUALITE=0.78;
const BILP_VUES=Object.freeze(['face','back','side']);
const BILP_PREFIXES=Object.freeze(['bil-photo-','deb-photo-']);
const BILP_JOURNAL_CLE='rc_migration_photos';

/** La clef de stockage local d'une photo de bilan. Distincte de celles des
 *  photos de progression (date/pose) : même magasin, deux familles. */
function bilPhotoCle(date,champ){ return 'bilan/'+(date||0)+'/'+(champ||''); }
/** PURE. La référence au nouveau format, ou null. */
function photoBilanRef(b,vue){
  for(const p of BILP_PREFIXES){
    const v=b&&b[p+vue];
    if(v&&typeof v==='object'&&(v.cle||v.url)) return v;
  }
  return null;
}
/** PURE. Le champ sous lequel la photo est rangée dans ce bilan. */
function photoBilanChamp(b,vue){
  for(const p of BILP_PREFIXES) if(b&&b[p+vue]!==undefined&&b[p+vue]!==null) return p+vue;
  return (b&&b.type==='depart'?'deb-photo-':'bil-photo-')+vue;
}
/**
 * LA PORTE UNIQUE DE LECTURE. Elle rend une source AFFICHABLE TOUT DE SUITE —
 * une URL ou un data-URL — ou null. Quatre rangements ont existé et coexistent :
 * la référence neuve, le base64 du document, `photos.<vue>`, et la copie locale
 * sous rc_photo_. Les quatre lecteurs de l'app passent par ici, sans quoi l'un
 * d'eux finit par ne plus voir ce que les autres montrent.
 *
 * ⚠ LE BLOB LOCAL N'EST PAS RENDU ICI : il demande une lecture asynchrone.
 *   C'est `photoBilanHydrater` qui le pose après le rendu, et
 *   `photoBilanRef(...).cle` qui dit qu'il y en a un.
 */
function photoBilanSrc(b,vue){
  for(const p of BILP_PREFIXES){
    const v=b&&b[p+vue];
    if(v&&typeof v==='object'&&v.url) return v.url;
    if(typeof v==='string'&&v) return v;
  }
  if(b&&b.photos&&typeof b.photos[vue]==='string'&&b.photos[vue]) return b.photos[vue];
  try{
    return localStorage.getItem('rc_photo_'+b.date+'_bil-photo-'+vue)
      ||localStorage.getItem('rc_photo_'+b.date+'_deb-photo-'+vue)||null;
  }catch(e){ return null; }
}
/** Y a-t-il quelque chose à montrer, d'une façon ou d'une autre ? */
function photoBilanExiste(b,vue){
  return !!(photoBilanSrc(b,vue)||(photoBilanRef(b,vue)||{}).cle);
}
/** Le Blob local, s'il est sur cet appareil. */
async function photoBilanBlob(ref){
  if(!ref||!ref.cle) return null;
  try{ return await phpLireBlob(ref.cle)||null; }catch(e){ return null; }
}
/**
 * HYDRATATION APRÈS RENDU. Les vignettes qui n'ont qu'un blob local portent
 * data-bil-cle : on lit IndexedDB et on pose l'URL objet. Les URL objet sont
 * RELÂCHÉES au chargement de l'image — sans quoi chaque ouverture de l'écran
 * retiendrait une photo entière en mémoire jusqu'au rechargement de la page.
 */
async function photoBilanHydrater(racine){
  const zone=racine||document;
  const imgs=[...zone.querySelectorAll('img[data-bil-cle]:not([data-bil-pret])')];
  for(const img of imgs){
    img.setAttribute('data-bil-pret','1');
    try{
      const blob=await phpLireBlob(img.getAttribute('data-bil-cle'));
      if(!blob) continue;
      const u=URL.createObjectURL(blob);
      img.addEventListener('load',()=>{ try{ URL.revokeObjectURL(u); }catch(e){} },{once:true});
      img.src=u;
    }catch(e){}
  }
  return imgs.length;
}

/**
 * ENREGISTRER UNE PHOTO DE BILAN, AU NOUVEAU FORMAT.
 *
 * Le Blob compressé va dans IndexedDB — jamais de base64, jamais localStorage,
 * qui ne stocke que des chaînes et ferait exactement ce qu'on fuit. Puis la
 * photo monte chez l'hébergeur, parce que le coach doit la voir.
 *
 * SI L'ENVOI ÉCHOUE, LA PHOTO N'EST PAS PERDUE : le blob reste sur l'appareil,
 * la référence dit `aEnvoyer`, et le prochain passage réessaie. C'est la règle
 * du chantier : on ne troque jamais une image contre rien.
 */
async function photoBilanEnregistrer(cible,bilan,vue,file){
  if(!bilan) return {ok:false,raison:'Bilan introuvable.'};
  let c=null;
  try{ c=await compressImageBlob(file,BILP_MAX_DIM,BILP_QUALITE); }
  catch(e){ return {ok:false,raison:(e&&e.message)||'Compression impossible.'}; }
  const champ=photoBilanChamp(bilan,vue);
  const cle=bilPhotoCle(bilan.date,champ);
  try{ await phpEcrireBlob(cle,c.blob); }
  catch(e){ return {ok:false,raison:'Stockage local indisponible : la photo n’a pas été gardée.'}; }
  const ref={cle:cle,w:c.w,h:c.h,octets:c.octets};
  try{
    const d=await phpUploadImage(c.blob,cle,'bilan');
    ref.url=d.secure_url; ref.publicId=d.public_id;
  }catch(e){
    ref.aEnvoyer=true;
    bilan[champ]=ref;
    return {ok:true,transmise:false,ref:ref,
      raison:'La photo est sur ton appareil. Elle partira à ton coach dès que possible.'};
  }
  bilan[champ]=ref;
  return {ok:true,transmise:true,ref:ref};
}

/** PURE. Les photos de bilan dont le blob est ici et l'URL nulle part. */
function photosBilanARenvoyer(user){
  const u=_dossier(user);
  const out=[];
  for(const b of (Array.isArray(u&&u.bilans)?u.bilans:[])){
    if(!b||!b.date) continue;
    for(const vue of BILP_VUES) for(const pre of BILP_PREFIXES){
      const r=b[pre+vue];
      if(r&&typeof r==='object'&&r.cle&&!r.url) out.push({bilan:b,champ:pre+vue,ref:r});
    }
  }
  return out;
}
/**
 * LE RENVOI QUE `photoBilanEnregistrer` PROMETTAIT (E2, 25/09/2026). Une photo
 * dont l'envoi a échoué gardait `aEnvoyer` pour toujours : rien ne la
 * reprenait, et le coach restait sans photo. Même règle que la migration :
 * SON dossier seulement (le blob est sur cet appareil), et la référence ne
 * change que si l'envoi a réussi.
 */
async function photosBilanRenvoyer(user,options){
  const o=options||{};
  const liste=photosBilanARenvoyer(user);
  let faites=0,echecs=0;
  for(const x of liste.slice(0,o.max||6)){
    let blob=null;
    try{ blob=await phpLireBlob(x.ref.cle); }catch(e){ blob=null; }
    if(!blob){ echecs++; continue; }
    try{
      const d=await phpUploadImage(blob,x.ref.cle,'bilan');
      if(!d||!d.secure_url){ echecs++; continue; }
      x.ref.url=d.secure_url; x.ref.publicId=d.public_id;
      delete x.ref.aEnvoyer;
      faites++;
    }catch(e){ echecs++; }
  }
  return {faites,echecs,restantes:photosBilanARenvoyer(user).length};
}

// ── LA MIGRATION DES ANCIENNES ────────────────────────────────────────────
// ⚠ ELLE NE S'EXÉCUTE QUE SUR SON PROPRE DOSSIER, et jamais sur celui d'un
//   autre : c'est l'appareil qui porte les blobs, et migrer le dossier d'un
//   athlète depuis le téléphone de son coach y écrirait des références vers des
//   blobs qui n'existent que chez le coach.
function bilpJournal(){
  try{ const l=JSON.parse(localStorage.getItem(BILP_JOURNAL_CLE)||'[]');
    return Array.isArray(l)?l:[]; }catch(e){ return []; }
}
function bilpJournalEcrire(l){
  try{ localStorage.setItem(BILP_JOURNAL_CLE,JSON.stringify((l||[]).slice(-200))); return true; }
  catch(e){ return false; }
}
/** PURE. Ce qu'il reste à migrer dans un dossier : les photos en base64. */
function photosBilanAMigrer(user){
  const u=_dossier(user);
  const out=[];
  for(const b of (Array.isArray(u&&u.bilans)?u.bilans:[])){
    if(!b||!b.date) continue;
    for(const vue of BILP_VUES) for(const p of BILP_PREFIXES){
      const v=b[p+vue];
      if(typeof v==='string'&&v.length>600) out.push({bilan:b,champ:p+vue,vue:vue,octets:v.length});
    }
  }
  return out;
}
/** Le poids, en octets, des photos encore en base64 dans le document. */
function poidsPhotosBilan(user){
  return photosBilanAMigrer(user).reduce((n,x)=>n+x.octets,0);
}
/** Un data-URL en Blob, sans passer par le réseau ni par une image. */
function _dataUrlEnBlob(d){
  const i=String(d||'').indexOf(',');
  if(i<0) return null;
  const tete=d.slice(0,i), b64=d.slice(i+1);
  const type=(tete.match(/data:([^;]+)/)||[])[1]||'image/jpeg';
  try{
    const bin=atob(b64);
    const buf=new Uint8Array(bin.length);
    for(let k=0;k<bin.length;k++) buf[k]=bin.charCodeAt(k);
    return new Blob([buf],{type:type});
  }catch(e){ return null; }
}
/**
 * LA MIGRATION, UNE PHOTO À LA FOIS, ET JAMAIS DESTRUCTRICE.
 *
 * Pour chaque photo en base64 : un Blob dans IndexedDB, un envoi chez
 * l'hébergeur, et SEULEMENT SI LES DEUX ONT RÉUSSI, la chaîne est remplacée par
 * la référence. Tout échec laisse le dossier exactement comme il était.
 *
 * Elle est journalisée : `rc_migration_photos` dit ce qui est parti, quand, et
 * combien d'octets ont quitté le document.
 */
async function photosBilanMigrer(user,options){
  const o=options||{};
  const u=_dossier(user);
  const liste=photosBilanAMigrer(u);
  if(!liste.length) return {faites:0,restantes:0,octets:0};
  const max=o.max||6;                     // par paquets : on ne bloque personne
  let faites=0,octets=0,echecs=0;
  const journal=bilpJournal();
  for(const x of liste.slice(0,max)){
    const blob=_dataUrlEnBlob(x.bilan[x.champ]);
    if(!blob){ echecs++; continue; }
    const cle=bilPhotoCle(x.bilan.date,x.champ);
    try{ await phpEcrireBlob(cle,blob); }catch(e){ echecs++; continue; }
    let ref=null;
    try{
      const d=await phpUploadImage(blob,cle,'bilan');
      // ⚠ NI w NI h ICI, ET C'EST VOLONTAIRE : on ne les connait pas sans
      //   decoder l'image, et ecrire des zeros donnerait a un futur lecteur
      //   deux chiffres faux qu'il croirait mesures. Absent dit « inconnu ».
      ref={cle:cle,octets:blob.size,url:d.secure_url,publicId:d.public_id};
    }catch(e){
      // ⚠ ON NE TOUCHE PAS AU DOSSIER. Le base64 reste : c'est la seule copie
      //   que le coach peut lire, et la perdre pour gagner des octets serait
      //   exactement l'inverse de ce lot.
      echecs++; continue;
    }
    journal.push({date:x.bilan.date,champ:x.champ,octets:x.octets,le:Date.now(),
      url:ref.url?1:0});
    x.bilan[x.champ]=ref;
    faites++; octets+=x.octets;
  }
  bilpJournalEcrire(journal);
  return {faites:faites,restantes:photosBilanAMigrer(u).length,octets:octets,echecs:echecs};
}

// ══ L'INTERFACE DES PHOTOS DE PROGRESSION A ETE RETIREE (27/09/2026) ══════
// Kevin : « il demande deja les photos dans les bilans, [...] le comparateur
// ne marche pas, retire ces deux cadres ». La seance quatre poses, le
// comparateur, la frise « Tes photos », l'accord, le partage et la vue coach
// sont partis. RESTENT, parce que d'autres s'en servent : le stockage des
// images sur l'appareil et l'envoi a l'hebergeur (les photos de BILAN passent
// par eux), et la revocation, que la suppression de compte appelle pour purger
// ce que d'anciens dossiers auraient deja partage.
// ══════════════ TROIS HABITUDES, UNE PASTILLE ═════════════════════════════
// Trois comportements hors salle, un appui par jour, aucun écran nouveau.
//
// CE QUI N'EST PAS ASSIGNABLE, et pourquoi. Une habitude ne peut porter ni sur
// un poids, ni sur une mesure corporelle, ni sur une restriction alimentaire.
// Ce ne sont pas des habitudes, ce sont des données de santé — et le garde-fou
// TCA du module nutrition ne les couvrirait pas ici : il surveille les apports
// déclarés, pas une case cochée. « Perdre 2 kg » et « sauter le petit-déjeuner »
// entreraient dans le dossier sans qu'aucun filet ne les voie passer.
const HAB_MAX=3;
const HAB_RETRO_JOURS=2;          // J-2 accepté, J-3 refusé
const HAB_FENETRE_JOURS=28;       // le pourcentage affiché au coach
const HAB_SIGNAL_JOURS=14;
const HAB_SIGNAL_SEUIL=40;        // en dessous, une entrée de NIVEAU 6
const HAB_LIBELLE_MAX=40;
const HAB_CATALOGUE=Object.freeze([
  {cle:'sommeil',    lib:'Dormir assez'},
  {cle:'pas',        lib:'Atteindre mes pas'},
  {cle:'hydratation',lib:'Boire régulièrement'},
  {cle:'proteines',  lib:'Protéines à chaque repas'},
  {cle:'mobilite',   lib:'Faire ma mobilité'},
  {cle:'marche',     lib:'Marcher'},
  {cle:'coucher',    lib:'Me coucher à heure fixe'},
  // TROIS DE PLUS, pour les habitudes recommandees de la maquette de Kevin
  // (24/09/2026). Relues comme les sept autres : aucune n'est restrictive —
  // « Aucune substance » vise le tabac et l'alcool, pas la nourriture.
  {cle:'alimentation',lib:'Suivre mon plan alimentaire'},
  {cle:'stress',     lib:'Prendre un temps pour souffler'},
  {cle:'substance',  lib:'Aucune substance (tabac, alcool)'}
]);
// Un poids, une mesure, une restriction. Les motifs sont larges à dessein :
// en cas de doute on REFUSE, et le coach reformule. Le coût d'un refus est un
// message ; le coût d'un faux négatif est une consigne de restriction inscrite
// au dossier d'un athlète.
const HAB_MOTIFS_INTERDITS=Object.freeze([
  {re:/\b\d+\s*(kg|kilo|kilos|g|grammes?|lbs?|livres?)\b/i,          quoi:'un poids'},
  {re:/\bpoids\b|\bpeser\b|\bpèse\b|\bpese\b|\bbalance\b|\bimc\b/i,  quoi:'un poids'},
  {re:/\bmaigrir\b|\bmincir\b|\bs[ée]cher\b|\bperdre du (gras|ventre|poids)\b/i, quoi:'un poids'},
  // Les motifs de MESURE passent avant le « perdre N » générique : « perdre
  // 3 cm » est une mesure, pas un poids, et le refus doit nommer la bonne
  // raison — un coach à qui on répond de travers reformule de travers.
  {re:/\bmasse grasse\b|\btour de (taille|hanches?|bras|cuisses?)\b|\bmensurations?\b/i, quoi:'une mesure corporelle'},
  {re:/\b\d+\s*(cm|centim[èe]tres?)\b/i,                             quoi:'une mesure corporelle'},
  {re:/\bperdre\b\s*\d|\bprendre\b\s*\d/i,                           quoi:'un poids'},
  {re:/\bsauter\b.*\b(repas|petit[- ]d[ée]jeuner|d[ée]jeuner|d[îi]ner|go[ûu]ter)\b/i, quoi:'une restriction alimentaire'},
  {re:/\bje[ûu]ne\b|\bje[ûu]ner\b|\bjeune intermittent\b|\bfasting\b/i, quoi:'une restriction alimentaire'},
  {re:/\b(ne pas|arr[êe]ter de|supprimer|[ée]liminer|bannir|interdire|se priver|priver)\b.*\b(manger|sucre|gras|glucides?|pain|f[ée]culents?|dessert|alcool)\b/i, quoi:'une restriction alimentaire'},
  {re:/\bsans (sucre|gras|glucides?|f[ée]culents?|pain)\b|\bz[ée]ro (sucre|glucides?)\b/i, quoi:'une restriction alimentaire'},
  {re:/\bd[ée]ficit\b|\brestriction\b|\bprivation\b|\bd[ée]tox\b/i,   quoi:'une restriction alimentaire'}
]);
// Sous grossesse déclarée, la barre monte : RIEN de nutritionnel en saisie
// libre. Le catalogue reste ouvert — aucune de ses sept entrées n'est
// restrictive — mais un libellé écrit à la main qui parle de nourriture est
// refusé, parce qu'on ne peut pas garantir ce qu'il dira.
const HAB_MOTIF_NUTRI=/\b(manger|repas|calorie|kcal|glucide|lipide|prot[ée]ine|sucre|gras|f[ée]culent|portion|assiette|di[èe]te|r[ée]gime|collation|grignot)/i;
// PURE. Valide un libellé d'habitude. Rend {ok:true} ou {ok:false, raison}.
// `duCatalogue` : une entrée de HAB_CATALOGUE est déjà relue — aucune des sept
// n'est restrictive. La règle 9 vise la SAISIE LIBRE, dont on ne peut rien
// garantir. Sans cette distinction, « Protéines à chaque repas » serait refusé
// à une femme enceinte, alors que c'est précisément ce qu'on lui conseille.
function habitudeLibelleValide(lib,porteur,duCatalogue){
  const t=String(lib==null?'':lib).trim();
  if(!t) return {ok:false,raison:'Donne un libellé.'};
  if(t.length>HAB_LIBELLE_MAX)
    return {ok:false,raison:'Quarante caractères au maximum ('+t.length+' saisis).'};
  for(const m of HAB_MOTIFS_INTERDITS)
    if(m.re.test(t)) return {ok:false,
      raison:'Une habitude ne peut pas porter sur '+m.quoi+'. C\'est une donnée de santé, et elle n\'a pas sa place dans une case à cocher.'};
  let enceinte=false;
  try{ const g=porteur&&porteur.grossesse&&porteur.grossesse.etat;
    enceinte=(g==='enceinte'||g==='allaitement'); }catch(e){}
  if(enceinte&&!duCatalogue&&HAB_MOTIF_NUTRI.test(t))
    return {ok:false,raison:'Grossesse ou allaitement déclarés : aucune habitude nutritionnelle écrite à la main. Passe par la liste.'};
  return {ok:true};
}
// PURE.
function habitudesDe(u){
  const l=(u&&u.habitudes);
  return Array.isArray(l)?l.filter(h=>h&&h.cle):[];
}
// ÉCRIT. PLAFOND DUR : le quatrième ajout est REFUSÉ, jamais un écrasement.
// La fonction rend {ok, raison} — l'appelant affiche la raison, il ne devine
// pas pourquoi rien ne s'est passé.
function habitudeAjouter(u,cle,libelle){
  if(!u) return {ok:false,raison:'Aucun athlète.'};
  const k=String(cle||'').trim();
  if(!k) return {ok:false,raison:'Clé manquante.'};
  const l=habitudesDe(u);
  if(l.some(h=>h.cle===k)) return {ok:false,raison:'Cette habitude est déjà assignée.'};
  if(l.length>=HAB_MAX)
    return {ok:false,raison:'Trois habitudes au maximum. Retires-en une avant d\'en ajouter une autre.'};
  const cat=HAB_CATALOGUE.find(x=>x.cle===k);
  const lib=cat?cat.lib:String(libelle||'').trim();
  const v=habitudeLibelleValide(lib,u,!!cat);
  if(!v.ok) return v;
  u.habitudes=l.concat([{cle:k,libelle:lib}]);
  return {ok:true};
}
// ÉCRIT. RÈGLE 8 : l'historique est CONSERVÉ. On retire la ligne, pas les
// coches — l'athlète les a faites, elles lui appartiennent, et un coach qui
// remet l'habitude un mois plus tard retrouve tout.
function habitudeRetirer(u,cle){
  if(!u) return false;
  const l=habitudesDe(u);
  const n=l.filter(h=>h.cle!==cle);
  if(n.length===l.length) return false;
  u.habitudes=n;
  return true;
}
// PURE. RÈGLE 7 : rétroactif jusqu'à J-2, jamais le futur. La date locale fait
// foi, via localISODate — pas l'UTC, qui décale la journée d'un athlète à
// 23 h en hiver.
function habJourValide(dateISO,now){
  const t=(typeof now==='number')?now:Date.now();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dateISO||''))) return false;
  for(let i=0;i<=HAB_RETRO_JOURS;i++)
    if(localISODate(_datePlusJours(t,-i))===dateISO) return true;
  return false;
}
// PURE.
function habCoche(u,cle,dateISO){
  const j=((u&&u.habitudesLog)||{})[dateISO];
  return Array.isArray(j)&&j.indexOf(cle)>=0;
}
// ÉCRIT. Un appui bascule. AUCUNE notification n'est émise, ni à la coche ni à
// l'absence de coche : une pastille grise ne réveille personne.
function habBasculer(u,cle,dateISO,now){
  if(!u||!habJourValide(dateISO,now)) return false;
  if(!habitudesDe(u).some(h=>h.cle===cle)) return false;
  if(!u.habitudesLog||typeof u.habitudesLog!=='object') u.habitudesLog={};
  const j=Array.isArray(u.habitudesLog[dateISO])?u.habitudesLog[dateISO].slice():[];
  const i=j.indexOf(cle);
  if(i<0) j.push(cle); else j.splice(i,1);
  if(j.length) u.habitudesLog[dateISO]=j; else delete u.habitudesLog[dateISO];
  return true;
}
// PURE. RÈGLE 6 : une FENÊTRE GLISSANTE, jamais un compteur remis à zéro. Un
// compteur qui retombe à zéro punit une journée manquée par un mois de perte ;
// un pourcentage la dilue, ce qui est exactement ce qu'elle mérite.
//
// Le jour COURANT est exclu du dénominateur : à 8 h du matin, personne n'a
// encore rien coché, et le compter ferait chuter le taux tous les matins.
function habTaux(u,cle,jours,now){
  const t=(typeof now==='number')?now:Date.now();
  const n=(jours>0?jours:HAB_FENETRE_JOURS);
  let faits=0,total=0;
  for(let i=1;i<=n;i++){
    const d=localISODate(_datePlusJours(t,-i));
    total++;
    if(habCoche(u,cle,d)) faits++;
  }
  return total?Math.round(faits/total*100):null;
}
// PURE. Le taux toutes habitudes confondues, ou null s'il n'y en a aucune.
function habTauxGlobal(u,jours,now){
  const l=habitudesDe(u);
  if(!l.length) return null;
  const taux=l.map(h=>habTaux(u,h.cle,jours,now));
  return Math.round(taux.reduce((a,b)=>a+b,0)/taux.length);
}
// PURE. Sept booléens, lundi → dimanche, pour la ligne de pastilles.
function habSemaine(u,cle,now){
  const t=(typeof now==='number')?now:Date.now();
  const lundi=_lundiDe(new Date(t));
  const out=[];
  for(let i=0;i<7;i++){
    const d=new Date(lundi); d.setDate(lundi.getDate()+i);
    const iso=localISODate(d);
    out.push(d.getTime()>t?null:habCoche(u,cle,iso));
  }
  return out;
}
// PURE. Le signal coach. RÈGLE 4 : il n'ira JAMAIS au-dessus du niveau 6 — il
// rejoint la disjonction existante, au même rang que le plateau et la forme
// basse. La santé passe avant l'intendance, et une habitude est de
// l'intendance.
function habSignalBas(u,now){
  const l=habitudesDe(u);
  if(!l.length) return false;
  const g=habTauxGlobal(u,HAB_SIGNAL_JOURS,now);
  return g!=null&&g<HAB_SIGNAL_SEUIL;
}
// ══════════════ COULOIR DE RETOUR ═════════════════════════════════════════
// Une sortie au dispositif de détection : suspendre sans punir, puis rouvrir
// un chemin. RepCore ne décide JAMAIS de la levée — elle appartient au coach.
//
// À LIRE AVANT : le signal coach existant se déclenche à DEUX séances sur
// trois (SIG_DOULEUR_MIN_SEANCES), et une assertion verrouille ce deux. La
// suspension, elle, demande TROIS séances CONSÉCUTIVES du même mouvement :
// c'est une règle plus stricte, dans des fonctions SÉPARÉES. Le détecteur de
// signal n'est pas touché, pas plus que le module de douleur.
const SUSP_DOULEUR_SEANCES=3;
const SUSP_ZERO_JOURS=90;

// PURE. Douleur maximale déclarée par mouvement, séance par séance, en ordre
// chronologique. Une série non validée compte : une douleur saisie est une
// douleur saisie — même règle que _seriesDouloureuses, qu'on ne réécrit pas.
function _suspSerieParMouvement(u){
  const out={};
  const ss=((u&&u.sessions)||[]).filter(s=>s&&s.date>0).slice().sort((a,b)=>a.date-b.date);
  for(const s of ss){
    const d=(s&&s.data)||{};
    for(const nom of Object.keys(d)){
      const sets=((d[nom]&&d[nom].sets)||[]);
      if(!sets.length) continue;
      let max=0;
      for(const st of sets){
        const p=parseInt(st&&st.pain,10);
        if(isFinite(p)&&p>max) max=p;
      }
      const k=exKey(nom);
      const e=out[k]=out[k]||{nom,l:[]};
      e.l.push({date:s.date,pain:max});
    }
  }
  return out;
}
// PURE. RÈGLE 8 : un mouvement que le coach a remplacé ne suspend plus rien.
// La suspension ne portait que sur lui, elle part avec lui.
function _suspAuProgramme(u,nom){
  const k=exKey(nom);
  for(const s of ((u&&u.sessions_config)||[])){
    if(!s||!s.active) continue;
    for(const ex of ((s.exercises)||[])) if(ex&&exKey(ex.name)===k) return true;
  }
  return false;
}
// PURE. Le mouvement qui suspend, ou null.
//
// « Trois séances consécutives » se compte sur les séances OÙ LE MOUVEMENT EST
// FAIT, et non sur les séances de l'athlète. Un développé fait une fois par
// semaine n'apparaît jamais trois fois de suite dans les trois dernières
// séances : compté autrement, la règle ne se déclencherait jamais.
function douleurSuspendante(u){
  const par=_suspSerieParMouvement(u);
  let best=null;
  for(const k in par){
    const e=par[k], l=e.l;
    if(l.length<SUSP_DOULEUR_SEANCES) continue;
    const der=l.slice(-SUSP_DOULEUR_SEANCES);
    if(!der.every(x=>x.pain>=SIG_PAIN_SEUIL)) continue;
    if(!_suspAuProgramme(u,e.nom)) continue;                  // règle 8
    const c={nom:e.nom,seances:SUSP_DOULEUR_SEANCES,
      painMax:der.reduce((m,x)=>Math.max(m,x.pain),0),
      depuis:der[0].date,derniere:der[der.length-1].date};
    if(!best||c.derniere>best.derniere) best=c;
  }
  return best;
}
// PURE. L'état de suspension. Nœud absent = état initial : {actif:false}, et
// l'absence n'est pas une valeur.
//
// La CAUSE est consignée, jamais interprétée : le couloir ne qualifie rien.
// Le nœud existant FAIT FOI tant qu'il est actif — un drapeau levé puis reposé
// dans la semaine ne redémarre pas un second gel, sinon la valeur gelée serait
// celle d'après la première suspension, c'est-à-dire zéro.
function suspensionEtat(u,now){
  const t=(typeof now==='number')?now:Date.now();
  const s=(u&&u.suspension)||null;
  let cause=null,mouvement=null,debut=0;
  try{ const g=drapeauGeneralActif(u); if(g){ cause='general'; debut=g.date||0; } }catch(e){}
  if(!cause){ try{ const d=drapeauRougeActif(u); if(d){ cause='drapeau'; debut=d.date||0; } }catch(e){} }
  if(!cause){
    const m=douleurSuspendante(u);
    if(m){ cause='douleur'; mouvement=m.nom; debut=m.depuis; }
  }
  if(!cause) return {actif:false,cause:null,debut:0,streakGele:0,jours:0,mouvement:null};
  const ouvert=!!(s&&s.actif&&s.debut>0);
  const d0=ouvert?s.debut:(debut||t);
  const gel=ouvert?Math.max(0,Number(s.streakGele)||0):Math.max(0,Number((u&&u.streak)||0));
  return {actif:true,cause:ouvert?(s.cause||cause):cause,debut:d0,streakGele:gel,
    jours:Math.max(0,Math.floor((t-d0)/864e5)),
    mouvement:mouvement||(ouvert?(s.mouvement||null):null)};
}
// PURE. La valeur gelée. Le champ du dossier est `suspension.streakGele` ; cet
// accesseur est la SEULE lecture, pour qu'il n'existe jamais deux copies de la
// même vérité.
function _streakGele(u){ return suspensionEtat(u).streakGele; }
// PURE. RÈGLE 9 : au-delà de quatre-vingt-dix jours, la série repart de zéro.
// Jamais silencieusement — cette fonction porte la phrase qui le dit.
function suspensionRemiseAZero(u,now){
  const sp=suspensionEtat(u,now);
  return !!(sp.actif&&sp.jours>SUSP_ZERO_JOURS&&sp.streakGele>0);
}
function suspensionMessageReprise(u,now){
  if(!suspensionRemiseAZero(u,now)) return '';
  const sp=suspensionEtat(u,now);
  return 'Ton compteur de semaines repart de zéro : il était en pause depuis '
    +sp.jours+' jours. Ce n\'est pas un recul, c\'est un point de départ.';
}
// PURE. Fin de la dernière suspension refermée, 0 s'il n'y en a jamais eu.
// Sert à _streakPerime : une suspension n'est pas une absence.
function _suspFinDerniere(u){
  const s=(u&&u.suspension)||null;
  return (s&&!s.actif&&s.fin>0)?s.fin:0;
}
// ÉCRIT. Le SEUL point d'écriture du couloir. Il ouvre le nœud à la pose, le
// referme à la levée, et ne touche à rien entre les deux. Aucune donnée n'est
// effacée : refermer, c'est poser `actif:false` et une date de fin.
function suspensionSynchroniser(u,now){
  if(!u) return false;
  const t=(typeof now==='number')?now:Date.now();
  const sp=suspensionEtat(u,t);
  const s=u.suspension||null;
  const ouvert=!!(s&&s.actif);
  if(sp.actif&&!ouvert){
    u.suspension={actif:true,cause:sp.cause,debut:sp.debut,
      streakGele:sp.streakGele,mouvement:sp.mouvement||null,fin:0};
    return true;
  }
  if(!sp.actif&&ouvert){
    // LEVÉE. La série repart de sa valeur gelée — sauf au-delà de quatre-
    // vingt-dix jours, où elle repart de zéro et où le message le dit.
    const jours=Math.max(0,Math.floor((t-s.debut)/864e5));
    u.streak=(jours>SUSP_ZERO_JOURS)?0:Math.max(0,Number(s.streakGele)||0);
    if(!u.streak) u.streakWeek=null;
    u.suspension=Object.assign({},s,{actif:false,fin:t});
    u._reprise={depuis:t,cause:s.cause||null,mouvement:s.mouvement||null,
      remiseAZero:jours>SUSP_ZERO_JOURS,jours};
    return true;
  }
  return false;
}
// PURE. Y a-t-il un retour en cours ? La séance de retour est la PREMIÈRE
// séance après la levée : le drapeau se consomme, il ne s'installe pas.
function repriseEnCours(u){
  const r=(u&&u._reprise)||null;
  return (r&&r.depuis>0)?r:null;
}
// ══════════════ TAUX DE COMPLÉTION — 4 SEMAINES GLISSANTES ═══════════════
// Une MESURE, pas un jugement. Aucun palier, aucune médaille, aucun libellé
// qualitatif, aucune couleur d'alerte : un pourcentage, une flèche, et la
// fenêtre écrite à côté. Le chiffre ne déclenche aucune notification.
//
// Les semaines suspendues sortent du DÉNOMINATEUR : une pause déclarée ou un
// drapeau rouge ne sont pas des échecs d'assiduité, et les compter comme tels
// serait punir quelqu'un d'avoir dit qu'il allait mal.
const TC_SEMAINES=4;
const TC_JOURS=TC_SEMAINES*7;
const TC_ANCIENNETE_MIN_J=21;     // rien avant trois semaines
const TC_REPRISE_J=60;            // au-delà, c'est une reprise, pas un échec
const TC_TENDANCE_CHUTE=25;       // points perdus au-delà desquels le signal 6
const TC_FENETRE_LIB='4 dernières semaines';

// PURE. Les bornes des périodes suspendues, en millisecondes.
//
// LA GROSSESSE N'EN FAIT PAS PARTIE, et c'est un choix. Le champ ne porte que
// `declareLe` : aucune date de fin n'est conservée, même après l'accouchement.
// L'utiliser comme borne de départ ferait fondre le dénominateur
// indéfiniment. Elle rend donc le taux NON INTERPRÉTABLE (voir plus bas) —
// « — » plutôt qu'un chiffre faux, et jamais un échec.
function _tcSuspensions(u){
  const out=[];
  const p=u&&u.phase&&u.phase.pause;
  if(p&&p.debut>0&&Number(p.jours)>0) out.push({a:p.debut,b:p.debut+Number(p.jours)*864e5});
  const d=u&&u.drapeauRouge;
  if(d&&d.date>0) out.push({a:d.date,b:Infinity});      // actif : il court encore
  for(const h of ((u&&u.historiqueDrapeaux)||[]))
    if(h&&h.date>0&&h.leve>0) out.push({a:h.date,b:h.leve});
  // SUSPENSION POUR DOULEUR RÉPÉTÉE. Elle n'est pas un drapeau, et sans cette
  // ligne ses semaines resteraient au dénominateur : l'athlète serait compté
  // absent d'un entraînement que l'application venait de suspendre.
  const sp=u&&u.suspension;
  if(sp&&sp.debut>0) out.push({a:sp.debut,b:sp.actif?Infinity:(sp.fin||Infinity)});
  return out;
}
// PURE. Une semaine [debut, fin[ est-elle suspendue ? Le moindre recouvrement
// suffit : une semaine à moitié sous drapeau rouge n'est pas une semaine
// d'entraînement normale.
function _tcSemaineSuspendue(susp,debut,fin){
  for(const s of susp) if(s.a<fin&&s.b>debut) return true;
  return false;
}
function _tcSessions(u){
  const l=(u&&u.sessions)||[];
  return Array.isArray(l)?l.filter(s=>s&&typeof s.date==='number'&&s.date>0):[];
}
// PURE. Le taux sur une fenêtre, ou null si toutes les semaines sont suspendues.
function _tcSurFenetre(u,quota,susp,fin){
  let faites=0,semaines=0;
  for(let i=TC_SEMAINES-1;i>=0;i--){
    const b=fin-i*7*864e5, a=b-7*864e5;
    if(_tcSemaineSuspendue(susp,a,b)) continue;         // hors dénominateur
    semaines++;
    for(const s of _tcSessions(u)) if(s.date>=a&&s.date<b) faites++;
  }
  if(!semaines) return null;
  // BORNAGE STRICT : dépasser son quota ne donne pas 130 %.
  return {taux:Math.min(100,Math.round(faites/(quota*semaines)*100)),semaines};
}
// PURE. {taux, tendance, fenetre, interpretable}.
function tauxCompletion(u,now){
  const t=(typeof now==='number')?now:Date.now();
  const nul={taux:null,tendance:null,fenetre:TC_FENETRE_LIB,interpretable:false,raison:null};
  if(!u) return Object.assign({},nul,{raison:'inconnu'});
  // Programme sans AUCUNE séance active : seancesPrevuesParSemaine force le
  // quota à 1, ce qui produirait un taux inventé. On ne dit rien plutôt.
  const actives=((u.sessions_config)||[]).filter(s=>s&&s.active).length;
  if(!actives) return Object.assign({},nul,{raison:'sans_programme'});
  // Grossesse ou allaitement : voir _tcSuspensions. Pas d'échec, pas de
  // chiffre — la période n'a pas de fin connue.
  const g=u.grossesse&&u.grossesse.etat;
  if(g==='enceinte'||g==='allaitement')
    return Object.assign({},nul,{raison:'suspendu'});
  // Moins de trois semaines d'ancienneté : rien à interpréter.
  const cree=Number(u.createdAt)||0;
  if(!cree||(t-cree)<TC_ANCIENNETE_MIN_J*864e5)
    return Object.assign({},nul,{raison:'trop_recent'});
  const ses=_tcSessions(u).slice().sort((a,b)=>a.date-b.date);
  // Reprise : une longue absence suivie d'un retour. Afficher 0 % ferait
  // porter à quelqu'un qui revient le poids des semaines où il n'était pas là.
  const dansFenetre=ses.filter(s=>s.date>=t-TC_JOURS*864e5);
  if(dansFenetre.length){
    const avant=ses.filter(s=>s.date<dansFenetre[0].date);
    if(avant.length&&(dansFenetre[0].date-avant[avant.length-1].date)>=TC_REPRISE_J*864e5)
      return Object.assign({},nul,{raison:'reprise'});
  }
  const quota=Math.max(1,Number(seancesPrevuesParSemaine(u))||1);
  const susp=_tcSuspensions(u);
  const rec=_tcSurFenetre(u,quota,susp,t);
  if(!rec) return Object.assign({},nul,{raison:'suspendu'});
  const pre=_tcSurFenetre(u,quota,susp,t-TC_JOURS*864e5);
  return {taux:rec.taux,tendance:pre?(rec.taux-pre.taux):null,
    fenetre:TC_FENETRE_LIB,interpretable:true,raison:null,semaines:rec.semaines};
}
// PURE. Ce que l'écran affiche : un chiffre, ou un mot. JAMAIS un palier.
function tauxCompletionLib(r){
  if(!r||!r.interpretable){
    if(r&&r.raison==='reprise') return 'reprise';
    return '-';
  }
  return r.taux+' %';
}
function tauxCompletionFleche(r){
  if(!r||!r.interpretable||r.tendance==null) return '';
  if(r.tendance>=3) return '▲';
  if(r.tendance<=-3) return '▼';
  return '=';
}
// ══ LES JOKERS DE SÉRIE ═══════════════════════════════════════════════════
//
// Une semaine ratée ne devrait pas effacer six mois. Un joker se GAGNE toutes
// les quatre semaines validées (au plus deux en réserve) et se CONSOMME tout
// seul, au moment où la série allait casser : chaque semaine terminée sans
// validation en coûte un. S'il n'y en a pas assez, la série casse comme avant.
//
// ⚠ u.streak RESTE UN NOMBRE. La demande disait u.streak.jokers ; mais le
//   compteur est lu comme un nombre par des dizaines d'endroits (accueil,
//   fiche coach, rite, badges, rapports) et dans le dossier synchronisé. Les
//   jokers vivent à côté : u.streakJokers (0 à 2), u.streakJokersUtilises (le
//   nombre consommé dans la série EN COURS, remis à zéro quand elle casse) et
//   u.streakJokerLe (la date de la dernière consommation).
//
// ⚠ UN JOKER N'EST PAS UNE ABSENCE, comme une suspension n'en est pas une :
//   _streakPerime compte les jours à partir de streakJokerLe s'il est plus
//   récent que la dernière séance. Sans cela, le compteur sauvé retombait à
//   zéro à l'affichage suivant.
const STREAK_JOKERS_MAX=2, STREAK_JOKER_TOUS=4;
const SERIE_PALIERS=Object.freeze([4,8,12,26,52]);
// PURE. La clé de la semaine calendaire (le lundi, AAAA-MM-JJ local) : même
// forme que streakWeek.
function _streakCleSemaine(t){ return localISODate(_lundiDe(t)); }
function _streakLundiDeCle(cle){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(cle||''));
  return m?new Date(+m[1],+m[2]-1,+m[3]):null;
}
/**
 * PURE. Que se passe-t-il pour la série à l'instant `now` ?
 * @returns {{gel:boolean,perime:boolean,manquees:string[],consommes:number,
 *   casse:boolean,cle:?string,semaines:number,jokers:number}}
 *   `manquees` : les semaines TERMINÉES sans validation depuis la dernière
 *   créditée (hors suspension) ; `consommes` : les jokers à dépenser pour
 *   sauver la série ; `casse` : il n'y en a pas assez.
 */
function streakJokersBilan(u,now){
  const t=(typeof now==='number')?now:Date.now();
  const s=Math.max(0,Number(u&&u.streak)||0);
  const jokers=Math.max(0,Math.min(STREAK_JOKERS_MAX,Number(u&&u.streakJokers)||0));
  const out={gel:false,perime:false,manquees:[],consommes:0,casse:false,cle:null,semaines:s,jokers};
  if(!s) return out;
  // SOUS SUSPENSION, RIEN NE BOUGE : ni casse, ni joker. Le gel suffit.
  try{ if(suspensionEtat(u,t).actif){ out.gel=true; return out; } }catch(e){}
  out.perime=_streakPerime(u,t);
  if(!out.perime) return out;
  const l0=_streakLundiDeCle(u&&u.streakWeek);
  if(!l0){ out.casse=true; return out; }
  // Les semaines entre la dernière créditée et la semaine en cours (qui, elle,
  // n'est pas terminée), moins celles qu'une suspension a couvertes.
  let susp=[]; try{ susp=_tcSuspensions(u)||[]; }catch(e){ susp=[]; }
  const lc=_lundiDe(t).getTime();
  for(let k=1;k<600;k++){
    const a=new Date(l0.getFullYear(),l0.getMonth(),l0.getDate()+7*k);
    if(a.getTime()>=lc) break;
    const b=new Date(a.getFullYear(),a.getMonth(),a.getDate()+7);
    let suspendue=false; try{ suspendue=_tcSemaineSuspendue(susp,a.getTime(),b.getTime()); }catch(e){}
    if(!suspendue) out.manquees.push(localISODate(a));
  }
  // Au moins un : la série allait casser, c'est donc qu'une absence la menace.
  const besoin=Math.max(1,out.manquees.length);
  if(jokers>=besoin){
    out.consommes=besoin;
    out.cle=out.manquees.length?out.manquees[out.manquees.length-1]:String(u.streakWeek);
  } else out.casse=true;
  return out;
}
// ÉCRIT. Consomme les jokers si la série allait casser et qu'ils suffisent.
// Rend le bilan ; `sauve` dit qu'une série a été sauvée.
function _streakAppliquerJokers(u,now){
  const t=(typeof now==='number')?now:Date.now();
  const b=streakJokersBilan(u,t);
  if(!b.consommes) return Object.assign(b,{sauve:false});
  u.streakJokers=b.jokers-b.consommes;
  u.streakJokersUtilises=(Number(u.streakJokersUtilises)||0)+b.consommes;
  u.streakWeek=b.cle;
  u.streakJokerLe=t;
  return Object.assign(b,{sauve:true});
}
// PURE. « Ton joker a sauvé ta série de 12 semaines » (deux jokers : « Tes
// jokers ont sauvé… »).
function streakMessageJoker(b){
  if(!b||!b.sauve) return '';
  return (b.consommes>1?'Tes '+b.consommes+' jokers ont sauvé':'Ton joker a sauvé')
    +' ta série de '+b.semaines+' semaine'+(b.semaines>1?'s':'');
}
// AU RETOUR : une fois par session, depuis l'accueil — l'athlète qui revient
// après une semaine ratée apprend tout de suite que sa série tient.
let _streakRattrape=false;
function _streakRattrapage(){
  if(_streakRattrape) return null;
  _streakRattrape=true;
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u||u.role==='coach') return null;
  let b=null; try{ b=_streakAppliquerJokers(u,Date.now()); }catch(e){ b=null; }
  if(b&&b.sauve){
    try{ saveUser(); }catch(e){ rcErreurMuette('_streakRattrapage',e); }
    try{ toast(ICO.bouclier+' '+streakMessageJoker(b),'var(--green)',5000); }catch(e){}
  }
  return b;
}
function updateStreak(){
  const now=Date.now();
  // RÈGLE 2 : le gel est un gel, pas un crédit. Sous suspension le compteur ne
  // monte pas — et il ne se périme pas non plus. `lastSession` continue
  // d'avancer : l'athlète a le droit de s'entraîner et de journaliser
  // (règle 7), on ne lui retire pas la trace de ce qu'il a fait.
  try{
    if(suspensionEtat(currentUser,now).actif){ currentUser.lastSession=now; return; }
  }catch(e){}
  // LES JOKERS D'ABORD : si la série allait casser et qu'il y en a assez,
  // ils sont consommés, et elle ne casse pas.
  let _jk=null; try{ _jk=_streakAppliquerJokers(currentUser,now); }catch(e){ _jk=null; }
  // Même prédicat que l'affichage : la valeur stockée et la valeur montrée ne
  // peuvent pas diverger.
  if(_streakPerime(currentUser,now)){
    currentUser.streak=0;currentUser.streakWeek=null;
    currentUser.streakJokersUtilises=0;
  }
  const quota=seancesPrevuesParSemaine(currentUser);
  // LA SEMAINE CALENDAIRE (01/10/2026), et non plus les sept derniers jours
  // glissants : la même que les badges, les volts « semaine », les duels et
  // les défis. Seules les séances qui COMPTENT (seanceComptee : au moins une
  // série validée) ; une séance est rangée dans la semaine de sa date de FIN
  // (s.date), même à cheval sur minuit dimanche.
  // Pas de recalcul rétroactif : streak et streakWeek gardent leur passé.
  const lundi=_lundiDe(now).getTime();
  const faites=(currentUser.sessions||[]).filter(s=>s&&Number(s.date)>0&&seanceComptee(s)&&_lundiDe(Number(s.date)).getTime()===lundi).length;
  // streakWeek : lundi de la dernière semaine créditée, pour ne compter
  // qu'une fois même si l'athlète dépasse son quota.
  const cle=localISODate(_lundiDe(now));
  if(faites>=quota&&currentUser.streakWeek!==cle){
    currentUser.streak=(currentUser.streak||0)+1;
    currentUser.streakWeek=cle;
    const n=currentUser.streak;
    // UN JOKER TOUTES LES QUATRE SEMAINES VALIDÉES, deux au plus en réserve.
    if(n%STREAK_JOKER_TOUS===0)
      currentUser.streakJokers=Math.min(STREAK_JOKERS_MAX,(Number(currentUser.streakJokers)||0)+1);
    // LES PALIERS : 4, 8, 12, 26, 52 semaines — la foudre, un écran, une carte.
    if(SERIE_PALIERS.indexOf(n)>=0){ try{ _celebrerSerie(n); }catch(e){} }
  }
  currentUser.lastSession=now;
  if(_jk&&_jk.sauve){ try{ toast(ICO.bouclier+' '+streakMessageJoker(_jk),'var(--green)',5000); }catch(e){} }
}
// ══ L'ARRONDI D'UNE CHARGE, ET L'UNITÉ (30/09/2026) ═══════════════════════
//
// UNE SEULE FONCTION, arrondiCharge. roundWeight, arrondiCharge125,
// _arrondirCharge et arrondiAuPas en sont des enveloppes, au comportement
// inchangé (les appelants et les tests les connaissent).
//
// LE PAS DÉPEND DU MATÉRIEL (materielExercice) : une barre se charge de
// 2,5 kg en 2,5 kg (1,25 sous 20 kg), des haltères de 2 en 2, une machine de 5
// en 5. user.pasMateriel[matériel] le remplace, dans l'unité de l'athlète.
//
// L'UNITÉ : le dossier stocke TOUJOURS des kilos. En livres (user.unite =
// 'lb'), l'arrondi se fait en livres (5 lb barre et haltères, 10 lb machine)
// et rend les kilos qui leur correspondent ; l'affichage et la saisie
// convertissent (1 lb = 0,45359237 kg).
// ⚠ UNE SAISIE INCHANGÉE NE RECONVERTIT PAS : 100 kg s'affiche 220,5 lb, et
//   réenregistrer 220,5 lb garde 100 kg, pas 100,017 (afficheVersKg).
const LB_KG=0.45359237;
const UNITES_CHARGE=Object.freeze(['kg','lb']);
const PAS_MATERIEL=Object.freeze({
  kg:Object.freeze({BARRE:2.5,SMITH:2.5,BARRE_EZ:2.5,HALTERES:2,MACHINE:5,PRESSE:5,HACK:5,POULIE:2.5,POULIE_HAUTE:2.5,POULIE_BASSE:2.5,AUCUN:1}),
  lb:Object.freeze({BARRE:5,SMITH:5,BARRE_EZ:5,HALTERES:5,MACHINE:10,PRESSE:10,HACK:10,POULIE:5,POULIE_HAUTE:5,POULIE_BASSE:5,AUCUN:2.5})
});
// L'ordre dit quel matériel décide quand le nom en cite plusieurs : les
// haltères d'un « développé couché haltère » avant le banc, la machine avant la barre.
const _PAS_PRIORITE=['HALTERES','MACHINE','PRESSE','HACK','POULIE_HAUTE','POULIE_BASSE','POULIE','SMITH','BARRE_EZ','BARRE','AUCUN'];
function uniteCharge(user){ return (user&&user.unite==='lb')?'lb':'kg'; }
/** PURE. Le pas, dans l'unité de l'athlète, pour une valeur `x` exprimée dans cette unité. */
function pasCharge(x,ex,user){
  const u=uniteCharge(user);
  let mats=[]; try{ mats=materielExercice(ex&&ex.name); }catch(e){ mats=[]; }
  const perso=(user&&user.pasMateriel&&typeof user.pasMateriel==='object')?user.pasMateriel:{};
  for(const m of _PAS_PRIORITE){
    if(mats.indexOf(m)<0) continue;
    const p=Number(perso[m]);
    if(p>0&&p<=50) return p;
    if(m==='BARRE'||m==='SMITH'||m==='BARRE_EZ') break;          // la barre : le pas fin sous 20 kg
    return PAS_MATERIEL[u][m];
  }
  const pb=Number(perso.BARRE);
  if(pb>0&&pb<=50) return pb;
  return u==='lb'?(x<45?2.5:5):(x<20?1.25:2.5);
}
/**
 * PURE. La charge arrondie à ce qu'on peut charger, en KG (null si <= 0).
 *   o = {ex, user, sens:'haut'|'bas'|'proche', depart (kg), pas (forcé)}
 * Sans `sens` mais avec `depart` : dans le sens du changement, comme
 * arrondiCharge125, et jamais sous un pas.
 */
function arrondiCharge(kg,o){
  const opt=o||{};
  const v=Number(kg);
  if(!isFinite(v)||v<=0) return null;
  const u=uniteCharge(opt.user), f=u==='lb'?1/LB_KG:1;
  const x=v*f;
  const aDepart=opt.depart!=null&&isFinite(Number(opt.depart));
  const dep=aDepart?Number(opt.depart)*f:null;
  const pas=Number(opt.pas)>0?Number(opt.pas):pasCharge(x,opt.ex,opt.user);
  let sens=opt.sens;
  if(!sens&&aDepart){
    if(Math.abs(Math.round(x*1e6)/1e6-dep)<1e-9) return Number(opt.depart);
    sens=x>dep?'haut':'bas';
  }
  const q=Math.round(x/pas*1e6)/1e6;
  const n=sens==='haut'?Math.ceil(q):(sens==='bas'?Math.floor(q):Math.round(q));
  let r=n*pas;
  if(aDepart||sens==='haut') r=Math.max(pas,r);
  r=Math.round(r*1e6)/1e6;
  return u==='lb'?Math.round(r*LB_KG*1e6)/1e6:r;
}
// ── L'affichage et la saisie dans l'unité de l'athlète ─────────────────
/** PURE. Des kilos, affichés dans l'unité (0,1 lb ; 0,01 kg). */
function kgVersAffiche(kg,user){
  const v=Number(kg);
  if(kg===''||kg==null||!isFinite(v)) return null;
  return uniteCharge(user)==='lb'?Math.round(v/LB_KG*10)/10:Math.round(v*100)/100;
}
/** PURE. Une saisie dans l'unité, en kilos. `kgActuel` : la valeur déjà stockée,
 *  gardée telle quelle si la saisie ne l'a pas changée (pas de dérive). */
function afficheVersKg(val,user,kgActuel){
  const x=parseFloat(String(val==null?'':val).replace(',','.'));
  if(!isFinite(x)) return null;
  if(uniteCharge(user)!=='lb') return x;
  if(kgActuel!=null&&kgActuel!==''&&kgVersAffiche(kgActuel,user)===Math.round(x*10)/10) return Number(kgActuel);
  return Math.round(x*LB_KG*1e6)/1e6;
}
// La valeur d'un champ de saisie : telle quelle en kilos, convertie en livres.
function _poidsSaisie(v){
  if(v===''||v==null) return '';
  if(uniteCharge(currentUser)!=='lb') return v;
  const a=kgVersAffiche(v,currentUser);
  return a==null?'':a;
}
// PURE. Une charge PROPOSÉE (suggestion, série suivante, échauffement).
// ⚠ À LA BARRE, EN KILOS, LE 1,25 DE chargeSuivante RESTE : la progression
//   fine (93,75 après une coupure, 101,25 après une série facile) est voulue,
//   et un arrondi au 2,5 l'effacerait. Le pas du matériel s'applique dès qu'il
//   est propre à l'exercice (haltères, machine, poulie, poids du corps), que
//   l'athlète en a posé un (pasMateriel), ou qu'il compte en livres.
function _pasPropreA(ex,user){
  if(uniteCharge(user)==='lb') return true;
  if(user&&user.pasMateriel&&typeof user.pasMateriel==='object'&&Object.keys(user.pasMateriel).length) return true;
  let mats=[]; try{ mats=materielExercice(ex&&ex.name); }catch(e){ mats=[]; }
  for(const m of _PAS_PRIORITE){ if(mats.indexOf(m)<0) continue; return !(m==='BARRE'||m==='SMITH'||m==='BARRE_EZ'); }
  return false;
}
function arrondiSuggestion(kg,o){
  const v=Number(kg);
  if(!isFinite(v)||v<=0) return null;
  const opt=o||{};
  return _pasPropreA(opt.ex,opt.user)?arrondiCharge(v,opt):v;
}
/** PURE. La charge suggérée telle qu'elle s'affiche : arrondie, dans l'unité. */
function chargeSuggereeAffichee(kg,o){
  const k=arrondiSuggestion(kg,o);
  return k==null?null:kgVersAffiche(k,o&&o.user);
}
function _unite(){ return uniteCharge(currentUser); }
function _kgAff(kg){ const a=kgVersAffiche(kg,currentUser); return a==null?0:a; }
function _uniteTxt(nom){ return ' '+_unite()+(chargeParMain({name:nom})?'/main':''); }
// Le réglage, dans « Mes réglages ».
function _rendreUniteReglages(){
  const z=document.getElementById('cr-unite');
  if(!z||!currentUser) return false;
  const u=uniteCharge(currentUser);
  z.innerHTML='<div class="cr-unite"><label for="cr-unite-sel">Unité des charges</label>'
    +'<select id="cr-unite-sel" onchange="choisirUnite(this.value)">'
    +'<option value="kg"'+(u==='kg'?' selected':'')+'>Kilos (kg)</option>'
    +'<option value="lb"'+(u==='lb'?' selected':'')+'>Livres (lb)</option></select>'
    +'<div class="cr-unite-d">Tes charges restent enregistrées en kilos ; elles s’affichent et se saisissent dans l’unité choisie.</div></div>';
  return true;
}
function choisirUnite(v){
  if(!currentUser||UNITES_CHARGE.indexOf(v)<0) return false;
  if(v==='lb') currentUser.unite='lb'; else delete currentUser.unite;
  try{ saveUser(); }catch(e){ rcErreurMuette('choisirUnite',e); }
  _rendreUniteReglages();
  toast(v==='lb'?'Charges en livres '+ICO.coche:'Charges en kilos '+ICO.coche,'var(--green)');
  return true;
}
// Enveloppe : au-dessus sous 20 kg, au plus proche au-delà (comme avant).
function roundWeight(w){
  const v=Number(w);
  if(!(v>0)) return 0;
  return arrondiCharge(v,{sens:v<20?'haut':'proche'});
}
// ══ LE TYPE DE CHARGE D'UN EXERCICE (30/09/2026) ═══════════════════════════
//
// Une traction ne se charge pas comme un développé couché. Cinq cas :
//   externe      la charge saisie est ce qui est soulevé (le cas d'avant) ;
//   poids_corps  le corps est la charge (tractions, dips, pompes…) ; un poids
//                saisi y est un lest ;
//   leste        le nom le dit (« lesté ») : poids du corps + lest ;
//   assiste      machine à contrepoids : la charge saisie est l'ASSISTANCE,
//                progresser veut dire en retirer ;
//   elastique    au poids du corps, aidé d'un élastique qu'on ne mesure pas.
// Le coach peut le poser (ex.typeCharge) ; sinon il se lit dans le nom.
//
// ⚠ SANS POIDS DE CORPS CONNU, pas de charge effective (null) : aucun e1RM
//   n'est calculé, mais les séries comptent dans le VOLUME (serieEligible).
// ⚠ LE POIDS DE CORPS EST L'ACTUEL (poidsCorpsActuel), appliqué à tout
//   l'historique : c'est la seule valeur mesurée qu'on ait à chaque séance.
const TYPES_CHARGE=Object.freeze(['externe','poids_corps','leste','assiste','elastique']);
function _nomCharge(nom){
  return String(nom||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
// Les mouvements au poids du corps (EX_GUIDE_BRUT, et le groupe 'AUCUN' de
// EX_MATERIEL_MOTS). Une machine, une poulie ou une barre guidée les chargent :
// « DIPS MACHINE » est une charge externe.
const _RE_POIDS_CORPS=/\btractions?\b|\bpull ?ups?\b|\bchin ?ups?\b|\bdips?\b|\bpompes?\b|\bpush ?ups?\b|\bnordic\b|\bpistol\b|\bmuscle ?ups?\b|\bpike\b|\bhandstand\b|\breleves? de (genoux|jambes)\b|\bgainage\b|\bplanche\b|\bplank\b|\bburpees?\b|\bsuperman\b|\bmontee de genoux\b|\bjumping jack\b|\bfire hydrant\b|\bchaise\b|\bau sol\b/;
function _estPoidsCorpsNom(n){
  if(/\bmachine\b|\bpoulie\b|\bcable\b|\bsmith\b/.test(n)) return false;
  return _RE_POIDS_CORPS.test(n);
}
/** PURE. 'externe' | 'poids_corps' | 'leste' | 'assiste' | 'elastique'. */
function typeCharge(ex){
  if(ex&&TYPES_CHARGE.indexOf(ex.typeCharge)>=0) return ex.typeCharge;
  const n=_nomCharge(ex&&ex.name);
  if(!n) return 'externe';
  if(/\b(assiste|guide)e?s?\b/.test(n)&&/\b(traction|dips?|pull)/.test(n)) return 'assiste';
  const pdc=_estPoidsCorpsNom(n);
  if(/elastique|\bband/.test(n)&&pdc) return 'elastique';
  if(/\blest/.test(n)) return 'leste';
  return pdc?'poids_corps':'externe';
}
/** PURE. La part du poids de corps soulevée, ou null quand on ne la connaît pas. */
function coefPoidsCorps(nom){
  const n=_nomCharge(nom);
  if(/\bpompes?\b|\bpush ?ups?\b/.test(n)) return /\binclinee?s?\b/.test(n)?0.5:0.65;
  if(/\btractions?\b|\bpull ?ups?\b|\bchin ?ups?\b|\bdips?\b|\bmuscle ?ups?\b/.test(n)) return 1;
  return null;
}
/**
 * PURE (le dossier est lu). La charge réellement déplacée par une série, en
 * kg, ou null quand on ne peut pas la dire (pas de poids de corps, ou un
 * mouvement dont on ne connaît pas la part de corps soulevée).
 */
function chargeEffective(set,ex,user){
  const t=typeCharge(ex);
  const w=Math.max(0,parseFloat(set&&set.weight)||0);
  if(t==='externe') return w>0?w:null;
  let pc=null; try{ pc=poidsCorpsActuel(user); }catch(e){ pc=null; }
  if(!(pc>0)) return null;
  const k=coefPoidsCorps(ex&&ex.name);
  if(t==='poids_corps') return k==null?null:pc*k+w;
  if(t==='leste') return pc*(k==null?1:k)+w;
  if(t==='assiste') return Math.max(0,pc-w);
  if(t==='elastique') return pc*(k==null?1:k);
  return null;
}
// L'exercice tel que le coach l'a posé (son typeCharge), retrouvé par son
// nom dans le programme ; le nom seul sinon.
function _exPourCharge(nom,user){
  const ex={name:nom};
  try{
    const k=exKey(nom);
    for(const c of ((user&&user.sessions_config)||[])){
      const l=c&&c.exercises; if(!l) continue;
      for(const e of (Array.isArray(l)?l:Object.values(l)))
        if(e&&e.typeCharge&&TYPES_CHARGE.indexOf(e.typeCharge)>=0&&exKey(e.name)===k){ ex.typeCharge=e.typeCharge; return ex; }
    }
  }catch(e){}
  return ex;
}
// LA CONVENTION DES HALTÈRES (30/09/2026) : la charge notée est celle d'UNE
// main. ex.chargeParMain la pose ; sans lui, les haltères du nom (materielExercice).
function chargeParMain(ex){
  if(ex&&typeof ex.chargeParMain==='boolean') return ex.chargeParMain;
  try{ return materielExercice(ex&&ex.name).indexOf('HALTERES')>=0; }catch(e){ return false; }
}
// Détecte les exercices à contrepoids (DIPS/TRACTIONS assistés ou guidés).
// Sur ces machines : progression = MOINS de charge (moins d'assistance).
function isCounterweightEx(name){
  if(!name) return false;
  return typeCharge({name})==='assiste';
}
// ── Au poids du corps, on progresse en répétitions ─────────────────────
// PURE. Les répétitions à viser : +1 si la dernière série laissait plus de
// réserve que la cible, les mêmes sinon. null sans répétitions connues.
function repsSuivantes(reps,rir,cible){
  const r=Math.round(parseFloat(reps));
  if(!(r>0)) return null;
  const i=(rir==='echec')?0:parseInt(rir,10);
  const c=parseInt(cible,10);
  const vise=isFinite(c)?c:2;
  return {reps:(isFinite(i)&&i>vise)?r+1:r,monte:isFinite(i)&&i>vise,rir:isFinite(i)?i:null};
}
// La dernière série faite de cet exercice sur ce créneau, au poids du corps
// (sans lest) : ses répétitions et son RIR.
function _prevSeriePoidsCorps(name,slot,progName){
  const l=(currentUser&&currentUser.sessions)||[];
  for(let i=l.length-1;i>=0;i--){
    const sess=l[i]; if(!sess||!sess.data) continue;
    // UNE SÉANCE DE DÉCHARGE N'EST PAS UN REPÈRE (06/10/2026) : la suite
    // repart de la dernière séance normale.
    if(sess.deload===true) continue;
    if(!_memeCreneau(sess,slot,progName)) continue;
    const d=_dataDeSeance(sess,name); if(!d||!Array.isArray(d.sets)) continue;
    const done=d.sets.filter(s=>s&&s.done&&!(parseFloat(s.weight)>0)&&_perfReps(s)>0);
    if(done.length) return Object.assign({},done[done.length-1],{_refDate:_dateRefSeance(sess)});
  }
  return null;
}
// calcSug a été SUPPRIMÉE (lot T1) : aucun appelant, et une seconde façon de
// proposer une charge, qui divergeait de chargeSuivante.
// Même rattachement au créneau que getLastZeroRIRWeight : voir _memeCreneau.
// ── Progression de charge : la formule du coach ─────────────────────────────
// Multiplicateur appliqué à la charge de la dernière série, selon son RIR :
//   ÉCHEC → ×0,95   RIR 5 → ×1,125   RIR 4 → ×1,10   RIR 3 → ×1,075
//   RIR 2 → ×1,05   RIR 1 → ×1,025   RIR 0 → ×1,00
// puis arrondi TOUJOURS au 1,25 supérieur.
//
// C'est un pourcentage et non un palier fixe : le pas suit donc la charge, ce
// qui règle de lui-même l'écart entre une barre à 20 kg et une à 200 kg.
const SUG_MULTIPLICATEURS=Object.freeze({echec:0.95,5:1.125,4:1.10,3:1.075,2:1.05,1:1.025,0:1});
function multiplicateurRir(rir){
  const r=String(rir==null?'':rir).trim().toLowerCase();
  if(r==='echec') return SUG_MULTIPLICATEURS.echec;
  const n=parseInt(r,10);
  // RIR non renseigné : on ne fait pas varier la charge plutôt que de deviner.
  if(!isFinite(n)) return SUG_MULTIPLICATEURS[0];
  if(n>=5) return SUG_MULTIPLICATEURS[5];
  if(n>=4) return SUG_MULTIPLICATEURS[4];
  if(n>=3) return SUG_MULTIPLICATEURS[3];
  if(n>=2) return SUG_MULTIPLICATEURS[2];
  if(n>=1) return SUG_MULTIPLICATEURS[1];
  return SUG_MULTIPLICATEURS[0];
}
// Arrondi au 1,25 DANS LE SENS DU CHANGEMENT : au supérieur quand la charge
// monte, à l'inférieur quand elle baisse. Toujours arrondir au supérieur
// annulait les baisses trop petites pour le pas : à 20 kg, les 5 % de l'échec
// valent 1 kg, moins que 1,25, et la charge revenait à son point de départ.
// C'est aussi ce que réclament les machines guidées, où l'on RETIRE du poids
// de compensation pour progresser.
// Enveloppe d'arrondiCharge, au pas FIXE de 1,25 (le comportement d'avant).
function arrondiCharge125(cible,depart){
  // Une multiplication à virgule flottante peut tomber à 1e-13 au-dessus d'un
  // multiple exact : sans ce rattrapage, 110 monterait à 111,25.
  const x=Math.round((Number(cible)||0)*1e6)/1e6;
  const d=Number(depart)||0;
  if(Math.abs(x-d)<1e-9) return d;
  // Jamais en dessous d'un cran : une charge ne descend pas à zéro.
  if(!(x>0)) return 1.25;
  return arrondiCharge(x,{depart:d,pas:1.25});
}

// ── Montée en charge : les séries d'approche, affichage seul ────────────────
// Ce que le pratiquant met sur la barre AVANT sa première série de travail.
//
// LES RÉPÉTITIONS DESCENDENT QUAND LA CHARGE MONTE (30/09/2026). Chaque
// palier porte les siennes, tirées de la répétition prescrite R (bas de la
// fourchette, sinon le premier nombre) : jusqu'à 50 % de la charge, R dans la
// limite de 10 ; jusqu'à 65 %, 6 ; jusqu'à 80 %, 4 ; au-delà, 2. Jamais plus
// que R, jamais zéro. L'échauffement prépare sans fatiguer : dix répétitions
// à 90 % d'une série de douze useraient la série de travail.
// Rien de tout ceci n'existe en donnée : aucune ligne dans le tableau, aucune
// case à valider, rien dans woState.sessionData, donc rien dans le tonnage, le
// volume ou l'historique. C'est un pense-bête, pas une série.
//
// Le NOMBRE de séries d'approche suit la charge de travail : plus la barre est
// lourde, plus il faut de marches pour l'atteindre. Ce sont les paliers du
// coach, pas une mesure.
//   moins de 20 kg → 1 · de 20 à 50 → 2 · de 50 à 100 → 3 · au-delà → 4
function _nbSeriesApproche(w){
  if(w<20) return 1;
  if(w<50) return 2;
  if(w<=100) return 3;
  return 4;
}
// Les pourcentages sont indexés sur le nombre de paliers. À trois, ce sont
// ceux d'avant — 50, 70, 85. Les autres échelles gardent le même esprit :
// partir autour de la moitié, finir juste sous la charge de travail.
const MONTEE_POURCENTS=Object.freeze({
  1:Object.freeze([0.50]),
  2:Object.freeze([0.50,0.75]),
  3:Object.freeze([0.50,0.70,0.85]),
  4:Object.freeze([0.40,0.60,0.75,0.90])
});
// arrondiCharge125 est appelée avec la charge de travail comme point de DÉPART :
// la rampe descend donc vers l'inférieur, et aucun palier ne peut dépasser —
// ni même atteindre — la charge visée. C'est le seul arrondi appliqué.
function seriesApproche(chargeTravail,repsPrescrites,ex){
  const w=Number(chargeTravail);
  if(!isFinite(w)||!(w>0)) return [];
  // Sous ces trois formes l'échauffement en charge n'a pas de sens : le cardio
  // n'a pas de barre, l'isométrie compte des secondes, et sur un contrepoids
  // une charge PLUS BASSE veut dire un exercice PLUS DUR — une rampe
  // descendante y serait exactement à l'envers.
  if(ex&&(isCardio(ex)||techniqueDe(ex)==='isometrie'||isCounterweightEx(ex.name))) return [];
  // Sans prescription chiffrée (« max », « AMRAP », champ vide) il n'y a rien
  // à écrire en face de chaque palier.
  const R=repsApprocheBase(repsPrescrites);
  if(!R) return [];
  const pcts=MONTEE_POURCENTS[_nbSeriesApproche(w)]||MONTEE_POURCENTS[3];
  return pcts.map(pct=>({pct,charge:arrondiCharge125(w*pct,w),reps:repsApproche(pct,R)}));
}
// PURE. La répétition prescrite de référence : le bas d'une fourchette
// (fourchetteReps), sinon le premier nombre (« 10 par jambe » → 10). 0 si rien.
function repsApprocheBase(reps){
  const f=fourchetteReps(reps);
  if(f) return f.min;
  const m=String(reps==null?'':reps).match(/\d+/);
  const n=m?parseInt(m[0],10):0;
  return n>0?n:0;
}
// PURE. Les répétitions d'un palier à `pct` de la charge de travail.
function repsApproche(pct,R){
  const r=Math.max(1,Math.round(Number(R))||0);
  const plafond=pct<=0.5?10:(pct<=0.65?6:(pct<=0.8?4:2));
  return Math.max(1,Math.min(r,plafond));
}
function _fmtChargeMontee(v){ return String(v).replace('.',','); }
function _htmlMonteeCharge(chargeTravail,ex,idx){
  const paliers=seriesApproche(chargeTravail,ex&&ex.reps,ex);
  if(!paliers.length) return '';
  const masque=!!(currentUser&&currentUser.monteeChargeMasquee);
  // L'UNITÉ ET LES RÉPÉTITIONS SORTENT DU GROUPE quand elles sont les mêmes
  // pour tous les paliers (un seul palier, ou R petit). Depuis que les
  // répétitions descendent avec la charge, c'est la forme longue le plus
  // souvent : chaque palier dit ses répétitions.
  const memesReps=paliers.every(p=>String(p.reps)===String(paliers[0].reps));
  const txt=memesReps
    ? paliers.map(p=>_fmtChargeMontee(chargeSuggereeAffichee(p.charge,{ex,user:currentUser,sens:'proche'}))).join(' · ')+' '+_unite()+' × '+paliers[0].reps
    : paliers.map(p=>_fmtChargeMontee(chargeSuggereeAffichee(p.charge,{ex,user:currentUser,sens:'proche'}))+' '+_unite()+' × '+p.reps).join(' · ');
  return `<div class="wo-ramp sub" style="background:var(--surface-2);border-radius:var(--r-2);padding:10px 12px;margin-bottom:12px"><button type="button" onclick="basculerMonteeCharge()" style="background:none;border:none;padding:0;margin:0;color:inherit;font:inherit;cursor:pointer">Échauffement <span class="wo-ramp-caret">${masque?'▸':'▾'}</span></button><span class="wo-ramp-det"${masque?' style="display:none"':''}> : ${txt}</span></div>`;
}
// Préférence GLOBALE, pas par exercice : replier la rampe une fois la replie
// partout, sinon il faudrait la replier à chaque exercice de chaque séance.
function basculerMonteeCharge(){
  if(!currentUser) return;
  currentUser.monteeChargeMasquee=!currentUser.monteeChargeMasquee;
  saveUser();
  // Repli EN PLACE, sans re-rendre le bloc : renderSets repeindrait le tableau
  // des séries, et une saisie en cours non validée disparaîtrait.
  const m=!!currentUser.monteeChargeMasquee;
  document.querySelectorAll('.wo-ramp-det').forEach(e=>{ e.style.display=m?'none':''; });
  document.querySelectorAll('.wo-ramp-caret').forEach(e=>{ e.textContent=m?'▸':'▾'; });
}

// ── Reprise après coupure ──────────────────────────────────────────────────
// Une charge d'il y a quatre mois n'est pas un repère, c'est un souvenir. Le
// produit borne déjà les séries de pesées (PESEE_COUPURE_JOURS) et le volume
// (VOL_COUPURE) ; la charge suggérée, elle, ne bornait rien : un athlète qui
// revenait après un long arrêt recevait sa charge d'avant, majorée du
// multiplicateur de RIR par-dessus.
const SUG_JOURS_PERIME=28;
const SUG_DECOTES=Object.freeze([{jours:56,part:0.90},{jours:112,part:0.80}]);
const SUG_JOURS_ABANDON=112;
const SUG_NOTE_REPERE='Repère de terrain, pas une mesure.';

// PURE. Rend le facteur à appliquer à la charge de référence, ou null quand la
// référence est trop vieille pour qu'on propose quoi que ce soit.
// Une date de référence dans le futur (horloge décalée) arrive ici à 0 jour et
// ne décote donc rien.
function decoteReprise(joursEcoules){
  const j=Number(joursEcoules);
  if(!isFinite(j)||j<=SUG_JOURS_PERIME) return 1;
  if(j>SUG_JOURS_ABANDON) return null;
  for(const d of SUG_DECOTES) if(j<=d.jours) return d.part;
  // La table doit couvrir jusqu'au seuil d'abandon. Si elle ne le fait plus, on
  // ne propose rien plutôt que d'appliquer 1 en silence — un test le vérifie.
  return null;
}
// Date de la séance de référence, en jour local. Rend null sur une date absente
// ou aberrante : sans date, pas de décote, et le comportement reste l'actuel.
function _dateRefSeance(sess){
  const t=Number(sess&&sess.date);
  if(!isFinite(t)||t<=0) return null;
  return localISODate(new Date(t));
}
// Jours calendaires entre la référence et aujourd'hui. Jamais en millisecondes :
// deux séances à 23 h et à 1 h du matin sont à un jour d'écart, pas à deux heures.
// « 12 mars », ou « 12 mars 2025 » quand l'année n'est pas la courante : à
// quatre mois de distance on peut avoir changé d'année.
function _libDateRef(refDate){
  if(!refDate) return '';
  const d=new Date(refDate+'T12:00:00');
  if(isNaN(d.getTime())) return '';
  const opt={day:'numeric',month:'long'};
  if(d.getFullYear()!==new Date().getFullYear()) opt.year='numeric';
  return d.toLocaleDateString('fr-FR',opt);
}
function joursDepuisRef(refDate,aujourdhui){
  if(!refDate) return null;
  const auj=aujourdhui||localISODate(new Date());
  const j=_joursEntre(refDate,auj);
  return isFinite(j)?Math.max(0,j):null;
}
// LOT T1 : LE PLAFOND DU PAS. Le multiplicateur suit la charge, donc le pas
// grossit avec elle : 180 kg au squat à RIR 5 proposaient +22,5 kg d'un coup.
// Plafond sur la HAUSSE seulement, par schéma moteur (schemaDe : la
// classification du catalogue, pas une seconde liste) ; jamais sur une baisse,
// jamais sur un contrepoids. Les isolations, mollets, gainage, port de charge et
// pliométrie n'en ont pas : leurs charges ne l'atteignent pas.
const PAS_PLAFOND_KG=Object.freeze({'squat':10,'charniere-hanche':10,'fente':10,
  'poussee-horizontale':5,'poussee-verticale':5,'tirage-horizontal':5,'tirage-vertical':5,'halterophilie':5});
function plafondPas(exNom){
  if(!exNom) return null;
  let k=null; try{ k=schemaDe(exNom,currentUser); }catch(e){ k=null; }
  return (k&&PAS_PLAFOND_KG[k])||null;
}
// PURE. EN DÉCHARGE, LA CHARGE NE MONTE PAS (06/10/2026) : min(charge de
// référence, suggestion). Sur un contrepoids, monter veut dire RETIRER de
// l'assistance : c'est donc le max qu'on garde.
function plafondDecharge(sug,ref,contrepoids,enDecharge){
  const s=Number(sug), r=parseFloat(ref);
  if(!enDecharge||!(s>0)||!(r>0)) return sug;
  return contrepoids?Math.max(s,r):Math.min(s,r);
}
function chargeSuivante(charge,rir,contrepoids,decote,exNom){
  const w=parseFloat(charge)||0;
  if(!(w>0)) return null;
  const m=multiplicateurRir(rir);
  // Décote de reprise : 1 par défaut, donc aucun appelant à trois arguments ne
  // change de comportement. Elle DIVISE sur un contrepoids : là, le poids
  // affiché est l'assistance, et repartir plus bas veut dire s'assister
  // DAVANTAGE. La multiplier aurait retiré de l'assistance, donc rendu
  // l'exercice plus dur — l'inverse exact d'une reprise en douceur.
  const d=(decote==null)?1:Number(decote);
  if(!isFinite(d)||d<=0) return null;
  // Contrepoids (dips ou tractions guidés) : le poids affiché est celui de la
  // COMPENSATION. Plus il est élevé, plus c'est facile. Progresser veut donc
  // dire en retirer, d'où l'inverse du multiplicateur — et l'arrondi qui suit
  // le sens fait que la compensation baisse vraiment.
  // Le DÉPART de l'arrondi reste la charge réellement faite : la cible décotée
  // ne doit jamais être dépassée, sinon « on repart 10 % en dessous » est faux.
  const res=arrondiCharge125(contrepoids?w/(m*d):w*m*d,w);
  const cap=contrepoids?null:plafondPas(exNom);
  return (cap&&res!=null&&res-w>cap)?Math.round((w+cap)*100)/100:res;
}

// ══ LA PROGRESSION DE CHARGE (06/10/2026, build 1825) ═══════════════════
//
// chargeSuivante multipliait la dernière charge par multiplicateurRir(RIR
// fait) — la formule du coach, qu'on GARDE — sans regarder ni les
// répétitions faites, ni la fourchette, ni le RIR prescrit. Mesures au banc :
// 20 kg × 7-6-5-5 à RIR 1 pour 4 × 8-10 à RIR 2 → 22 kg ; série à série à
// RIR 3 : 22 → 24 → 28 → 32 ; un RIR vide ne faisait jamais monter.
//
// PURE. progressionCharge rend {kg, repsVisees, raison} :
//   1. L'ÉCART D'INTENSITÉ d = RIR fait − RIR visé (_rirPrescrit, sinon 2 ;
//      'echec' = 0) passe par la grille de Kevin : d ≤ 0 → ×1, d = 1 →
//      ×1,025… Un RIR fait égal au RIR visé ne fait plus monter. L'échec
//      alors que la cible est ≥ 1 : ×0,95.
//   2. LA DOUBLE PROGRESSION, avec une fourchette a-b : on ne monte que quand
//      TOUTES les séries de travail atteignent b (à RIR ≥ visé, ou RIR non
//      noté), d'au moins un pas, et on vise alors a. Sous a : on garde (on
//      baisse d'un pas si le RIR fait est sous le visé de plus d'un) et l'on
//      vise a. Entre les deux : on garde, et l'on vise une répétition de plus.
//   3. L'ARRONDI au pas du matériel (arrondiSuggestion) ; une hausse plus
//      petite que la moitié du pas ne monte pas : on garde, une répétition de
//      plus. Plafonds : +10 % d'une séance à l'autre, +5 % d'une série à la
//      suivante, en plus du plafond en kg du schéma (plafondPas). ⚠ Une
//      double progression ACCOMPLIE monte toujours d'un pas, même quand ce
//      seul pas dépasse 10 % (8 → 10 kg aux haltères) : sinon une charge
//      légère ne progresserait jamais.
//   4. SÉRIE À SÉRIE (mode 'serie') : la suivante ne monte que si la
//      précédente a été faite au haut de la fourchette avec d ≥ 2 ; sinon la
//      même, ou un pas de moins si le RIR fait est sous le visé de plus d'un.
//   5. CONTREPOIDS : la même logique, inversée (l'assistance baisse).
//      POIDS DU CORPS sans lest (poidsCorps) : repsSuivantes, borné au haut
//      de la fourchette ; au-delà, un lest ou une variante plus dure.
// La décote de reprise s'applique au résultat ; le cycle, la consigne du
// coach (_cons.kg) et la programmation (s.rpeCible) restent chez l'appelant.
const PROG_PLAFOND_SEANCE=0.10;
const PROG_PLAFOND_SERIE=0.05;
const PROG_RIR_CIBLE_DEFAUT=2;
const PROG_SERIE_ECART_MIN=2;
function _progRir(v){
  const s=String(v==null?'':v).trim().toLowerCase();
  if(s==='') return null;
  if(s==='echec') return {n:0,echec:true};
  const n=parseInt(s,10);
  return (isFinite(n)&&n>=0)?{n:Math.min(5,n),echec:false}:null;
}
// La fourchette a-b, ou un nombre fixe (a = b), ou null.
function _progBornes(reps){
  const f=fourchetteReps(reps);
  if(f) return {a:f.min,b:f.max,fourchette:true};
  const t=String(reps==null?'':reps).trim();
  return /^\d+$/.test(t)&&parseInt(t,10)>0?{a:parseInt(t,10),b:parseInt(t,10),fourchette:false}:null;
}
// Le pas du matériel, en kg.
function _progPas(w,ex,user){
  try{
    if(uniteCharge(user)==='lb') return pasCharge(w/LB_KG,ex,user)*LB_KG;
    return pasCharge(w,ex,user);
  }catch(e){ return 2.5; }
}
// L'arrondi d'une proposition : au pas du matériel quand il est propre à
// l'exercice, au 1,25 à la barre en kilos (comme chargeSuivante).
function _progArrondi(kg,sens,ex,user){
  if(!(kg>0)) return null;
  try{
    if(_pasPropreA(ex,user)) return arrondiCharge(kg,{ex,user,sens});
  }catch(e){}
  return arrondiCharge(kg,{pas:1.25,sens});
}
function _progKgTxt(v,user){
  const a=kgVersAffiche(v,user);
  return String(a==null?v:a).replace('.',',')+' '+uniteCharge(user);
}
// Les répétitions RÉELLEMENT connues d'une série : repsDone, ou un nombre
// fixe ; une fourchette sans saisie ne dit pas combien ont été faites.
function repsFaitesSerie(s){
  if(!s) return null;
  if(s.repsDone!=null&&String(s.repsDone).trim()!==''){ const n=Number(s.repsDone); return n>0?n:null; }
  const t=String(s.reps==null?'':s.reps).trim();
  return /^\d+$/.test(t)?parseInt(t,10):null;
}
/**
 * PURE. @param {{charge:any,repsFaites?:any,rirFait?:any,reps?:any,rirCible?:any,
 *   contrepoids?:boolean,decote?:number|null,ex?:any,user?:any,mode?:string,poidsCorps?:boolean}} o
 * @returns {{kg:number|null,repsVisees:number|null,raison:string}|null}
 */
function progressionCharge(o){
  const x=o||{};
  const ex=x.ex&&typeof x.ex==='object'?x.ex:{name:String(x.ex||'')};
  const user=x.user;
  const serie=x.mode==='serie';
  const R=(Array.isArray(x.repsFaites)?x.repsFaites:[x.repsFaites]).map(Number).filter(n=>isFinite(n)&&n>0);
  const B=_progBornes(x.reps);
  const rc=_progRir(x.rirCible), cible=rc?rc.n:PROG_RIR_CIBLE_DEFAUT;
  const rf=_progRir(x.rirFait), d=rf?rf.n-cible:null;
  const rirTxt=rf?(rf.echec?' à l’échec':' à RIR '+rf.n):', RIR non noté';
  const fTxt=B?(B.fourchette?'ta fourchette '+B.a+'-'+B.b:'tes '+B.a+' reps'):'';
  // ── 5. Poids du corps sans lest : on progresse en répétitions.
  if(x.poidsCorps){
    const last=R.length?R[R.length-1]:null;
    const rs=repsSuivantes(last,x.rirFait,cible);
    if(!rs) return null;
    let v=rs.reps, raison=last+' reps'+rirTxt+(rs.monte?' : il te restait de la réserve, vise '+v:' : garde '+v+' reps, et vise le RIR prévu');
    if(B&&v>B.b){
      v=B.b;
      raison=last+' reps'+rirTxt+', haut de '+fTxt+' atteint → ajoute un lest ou une variante plus dure';
    }
    return {kg:null,repsVisees:v,raison};
  }
  const w=parseFloat(x.charge);
  if(!(w>0)) return null;
  const dec=(x.decote==null)?1:Number(x.decote);
  if(!isFinite(dec)||dec<=0) return null;
  const cw=!!x.contrepoids;
  const pas=_progPas(w,ex,user);
  const kgTxt=v=>_progKgTxt(v,user);
  const tete=kgTxt(w)+' × '+(R.length?R.join('-'):'?')+rirTxt;
  const mn=R.length?Math.min.apply(null,R):null;
  // dir : +1 progresser, 0 garder, -1 reculer ; `fac` : le facteur de la grille.
  let dir=0, fac=1, vise=null, verdict='', pasPlein=false, accomplie=false;
  if(serie){
    const r=R.length?R[R.length-1]:null;
    const haut=B?(r!=null&&r>=B.b):true;
    if(haut&&d!=null&&d>=PROG_SERIE_ECART_MIN){ dir=1; fac=multiplicateurRir(String(d)); verdict=(B?'haut de '+fTxt+', ':'')+'RIR '+rf.n+' pour '+cible+' visé'; }
    else if(rf&&rf.n<cible-1){ dir=-1; pasPlein=true; verdict='RIR '+rf.n+' pour '+cible+' visé'; }
    else verdict=rf?('RIR '+rf.n+' pour '+cible+' visé'):'RIR non noté';
  } else if(rf&&rf.echec&&cible>=1){
    dir=-1; fac=SUG_MULTIPLICATEURS.echec; verdict='échec pour RIR '+cible+' visé'; vise=B?B.a:null;
  } else if(B&&R.length){
    if(mn<B.a){
      verdict='sous '+fTxt; vise=B.a;
      if(rf&&rf.n<cible-1){ dir=-1; pasPlein=true; }
    } else if(mn>=B.b&&(!rf||rf.n>=cible)){
      dir=1; accomplie=true; vise=B.a; verdict=(R.length>1?B.b+' partout, ':'')+'haut de '+fTxt+' atteint';
      fac=Math.max(multiplicateurRir(String(Math.max(0,d||0))),(w+pas)/w);
    } else {
      vise=Math.min(B.b,mn+1);
      verdict=mn>=B.b?('haut de '+fTxt+' à RIR '+rf.n+' pour '+cible+' visé'):('dans '+fTxt);
    }
  } else if(d!=null&&d>0){
    dir=1; fac=multiplicateurRir(String(d)); verdict='RIR '+rf.n+' pour '+cible+' visé';
  } else {
    verdict=rf?('RIR '+rf.n+' pour '+cible+' visé'):'RIR non noté';
  }
  // ── La cible, puis la décote de reprise.
  let t;
  if(dir===1) t=cw?w/fac:w*fac;
  else if(dir===-1) t=pasPlein?(cw?w+pas:w-pas):(cw?w/fac:w*fac);
  else t=w;
  t=cw?t/dec:t*dec;
  // ── 3. L'arrondi, la demi-marche, les plafonds.
  const gain=cw?w-t:t-w;            // ce que la proposition rend plus DUR
  let kg, petit=false;
  if(Math.abs(t-w)<1e-9) kg=w;
  else if(gain>0&&dir===1&&dec===1&&gain<pas/2){ kg=w; petit=true; }
  else kg=_progArrondi(t,t>w?'haut':'bas',ex,user);
  if(kg==null) kg=w;
  if(gain>0&&dir===1){
    const rel=serie?PROG_PLAFOND_SERIE:PROG_PLAFOND_SEANCE;
    if(!cw){
      let cap=w*(1+rel);
      const capKg=plafondPas(ex.name); if(capKg) cap=Math.min(cap,w+capKg);
      if(accomplie) cap=Math.max(cap,w+pas);
      if(kg>cap+1e-9){ kg=_progArrondi(cap,'bas',ex,user)||w; if(kg<w) kg=w; }
    } else {
      let plancher=w*(1-rel);
      if(accomplie) plancher=Math.min(plancher,w-pas);
      if(kg<plancher-1e-9){ kg=_progArrondi(plancher,'haut',ex,user)||w; if(kg>w) kg=w; }
    }
    if(Math.abs(kg-w)<1e-9) petit=true;
  }
  kg=Math.round(kg*1e6)/1e6;
  if(petit&&R.length) vise=B?Math.min(B.b,Math.max(mn,B.a)+1):mn+1;
  // ── 6. La raison, en une ligne.
  const monte=cw?kg<w-1e-9:kg>w+1e-9, baisse=cw?kg>w+1e-9:kg<w-1e-9;
  const action=(cw?(monte?'on réduit l’assistance à ':baisse?'on remet de l’assistance, ':'on garde l’assistance à ')
      :(monte?'on monte à ':baisse?'on baisse à ':'on garde '))+kgTxt(kg)
    +(petit&&gain>0?' (la hausse ne fait pas un demi-pas)':'')
    +(vise?', vise '+vise:'');
  return {kg,repsVisees:vise,raison:(serie?'':tete+', ')+verdict+' → '+action};
}
// La suggestion de la première série, d'après la dernière séance NORMALE du
// créneau : ses séries de travail, le RIR de sa dernière série, et la
// consigne d'aujourd'hui. Une seule porte pour _blocExo et l'échauffement.
function suggestionDepuisHistorique(ex,slot,progName,decote,user){
  const u=user||currentUser;
  if(!ex||!ex.name) return null;
  const prev=getPrevPerf(ex.name,slot,progName);
  if(!prev) return null;
  let ps=[]; try{ ps=prevSeries(ex.name,slot,progName,u).filter(Boolean); }catch(e){ ps=[]; }
  const res=progressionCharge({charge:prev.weight,repsFaites:ps.map(p=>p.reps).filter(n=>n>0),
    rirFait:prev.rir,reps:ex.reps,rirCible:_rirPrescrit(ex),contrepoids:isCounterweightEx(ex.name),
    decote,ex,user:u});
  return res?Object.assign({prev},res):null;
}

// ══ LA SÉRIE PRÉCÉDENTE, PAR INDEX (30/09/2026) ═════════════════════════
// PURE. La dernière séance du même créneau qui porte cet exercice, série par
// série : [{kg, reps, rir} | null, …]. null pour une série non validée ou
// sans charge. Tableau vide sans historique.
function prevSeries(name,slot,progName,user){
  const u=user||currentUser;
  const l=(u&&Array.isArray(u.sessions))?u.sessions:[];
  for(let k=l.length-1;k>=0;k--){
    const sess=l[k];
    if(!sess||!sess.data||!_memeCreneau(sess,slot,progName)) continue;
    if(sess.deload===true) continue;                 // la décharge n'est pas un repère
    const d=_dataDeSeance(sess,name);
    if(!d||!Array.isArray(d.sets)) continue;
    const r=d.sets.map(x=>{
      if(!x||!x.done||!(parseFloat(x.weight)>0)) return null;
      const rd=(x.repsDone!=null&&x.repsDone!=='')?parseInt(x.repsDone,10):parseInt(x.reps,10);
      return {kg:parseFloat(x.weight),reps:isFinite(rd)&&rd>0?rd:null,rir:x.rir==null?'':String(x.rir)};
    });
    if(r.some(Boolean)) return r;
  }
  return [];
}
// Recopie la série précédente dans la série i : la charge, et les
// répétitions faites quand la prescription est une fourchette.
function _woPrecAppliquer(ex,s,p){
  s.weight=String(p.kg);
  if(p.reps&&fourchetteReps(s.reps||ex.reps)) s.repsDone=p.reps;
}
function _woPrecCopier(idx,i){
  if(typeof woState==='undefined'||!woState) return false;
  const ex=(woState.exercises||[])[idx], d=woState.sessionData&&woState.sessionData[idx], s=d&&d.sets&&d.sets[i];
  if(!ex||!s||s.done) return false;
  const p=prevSeries(ex.name,woState.slot,woState.progName)[i];
  if(!p) return false;
  _woPrecAppliquer(ex,s,p);
  s.userEdited=true; s.isAuto=false;
  renderSets(ex,d,idx);
  woPersist();
  return true;
}
// ══ LE RIR EN UN TOUCHER, JUSTE APRÈS LE ✓ (30/09/2026) ══════════════════
// Le menu restait le seul chemin, et il se fermait à la validation : un RIR
// oublié l'était pour de bon. Après le ✓, une bande de sept pastilles (les
// valeurs de RIR_CHOIX, inchangées) reste 4 s ; un toucher note le RIR de la
// série et referme. On l'ignore : elle s'en va seule, et rien n'attend.
const RIR_BANDE_MS=4000;
let _rirBandeMin=null;
function _rirBandeFermer(){
  if(_rirBandeMin){ clearTimeout(_rirBandeMin); _rirBandeMin=null; }
  const z=document.getElementById('wo-rir-bande');
  if(z){ z.hidden=true; z.innerHTML=''; delete z.dataset.serie; }
}
function _rirBandeOuvrir(idx,i){
  const z=document.getElementById('wo-rir-bande');
  const ex=woState&&(woState.exercises||[])[idx];
  const s=woState&&woState.sessionData&&woState.sessionData[idx]&&woState.sessionData[idx].sets[i];
  if(!z||!ex||!s||!s.done||s.rpeCible||isCardio(ex)||(s.rir!==''&&s.rir!=null)){ _rirBandeFermer(); return false; }
  z.innerHTML=`<div class="rir-bande" role="group" aria-label="RIR de la série ${i+1}">`
    +`<span class="rir-bande-t">RIR<br>série ${i+1}</span><div class="rir-bande-p">`
    +RIR_CHOIX.map(c=>`<button type="button" class="rir-pastille" onclick="_rirBandeChoisir(${idx},${i},'${c[0]}')"`
      +` aria-label="${escapeHtml(c[1]+' : '+c[2])}">${escapeHtml(c[1])}</button>`).join('')
    +`</div></div>`;
  z.dataset.serie=idx+':'+i;
  z.hidden=false;
  if(_rirBandeMin) clearTimeout(_rirBandeMin);
  _rirBandeMin=setTimeout(_rirBandeFermer,RIR_BANDE_MS);
  return true;
}
function _rirBandeChoisir(idx,i,v){
  const d=woState&&woState.sessionData&&woState.sessionData[idx], s=d&&d.sets&&d.sets[i];
  if(!s||!RIR_CHOIX.some(c=>c[0]===v)){ _rirBandeFermer(); return false; }
  s.rir=v;
  _rirBandeFermer();
  // Le RIR noté décide maintenant de la série suivante (chargeSuivante).
  renderSets(woState.exercises[idx],d,idx);
  woPersist();
  return true;
}
function getPrevPerf(name,slot,progName){
  if(!currentUser.sessions?.length) return null;
  for(let i=currentUser.sessions.length-1;i>=0;i--){
    const sess=currentUser.sessions[i];if(!sess||!sess.data) continue;
    // LA DÉCHARGE N'EST PAS UN REPÈRE (06/10/2026). La suggestion d'après
    // repart de la dernière séance NORMALE — avec sa date, donc avec la
    // décote de reprise (decoteReprise) si elle a plus de 28 jours.
    if(sess.deload===true) continue;
    if(!_memeCreneau(sess,slot,progName)) continue;
    const d=_dataDeSeance(sess,name);if(!d) continue;
    // `s.weight` était vrai pour la chaîne '0' comme pour '-50' : la dernière
    // série RÉELLEMENT chargée était alors ignorée au profit d'une série qui
    // ne donne aucune suggestion — chargeSuivante rend 0 ou un négatif, et
    // _blocExo retombe sur « Pas encore d'historique ». Une seule saisie
    // aberrante coupait donc la progression pour de bon.
    const done=d.sets.filter(s=>s.done&&parseFloat(s.weight)>0);
    // COPIE, et non la série elle-même : y écrire _refDate reviendrait à
    // glisser un champ parasite dans l'historique de l'athlète, que le prochain
    // saveUser persisterait. La date vient de la SÉANCE — une série n'en porte
    // pas. Le test « sessions[0].data intact » n'aurait pas vu la différence :
    // il compare les clés de data, pas les objets série.
    if(done.length) return Object.assign({},done[done.length-1],
      {_refDate:_dateRefSeance(sess)});
  }return null;
}
// ══════════════ CALCUL DU VOLUME PAR MUSCLE ET PAR SEMAINE ══════════════
// Tout est DÉRIVÉ de user.sessions. Rien n'est écrit dans les séances, aucune
// migration, et le seul champ nouveau est user.reperesVolume, optionnel.

// ── Résolution musculaire EN LECTURE SEULE ─────────────────────────────────
// resoudreMuscles() écrit dans currentUser.exMuscles et met les inconnus en
// file « à classer ». Appelée depuis un calcul de volume, elle aurait trois
// effets indésirables : consulter un écran grossirait la file d'attente, le
// cache de volume s'invaliderait pendant le calcul qui le remplit (l'écriture
// dans exMuscles est justement ce qui l'invalide), et surtout un coach qui
// consulte le volume d'un athlète résoudrait contre SA propre table de
// classification. D'où cette variante : aucune écriture, utilisateur explicite.
// MÊME CŒUR QUE resoudreAlias, volontairement : voir _resoudreAliasChaine.
// EX_RENOMMAGES s'applique donc ici aussi, même quand `user` n'a pas d'exAlias.
// C'est ce calcul-là qui décide dans quel muscle un exercice compte : le jour
// où il divergerait de resoudreAlias, le volume affiché ne serait plus celui
// de l'exercice affiché.
function _aliasPour(k,user){
  return _resoudreAliasChaine(k,user&&user.exAlias);
}
// Marqueur distinct de null : un cardio n'est pas un exercice « non rattaché »,
// il n'a simplement pas de muscle à compter et ne doit pas être signalé.
const VOL_CARDIO=Object.freeze({cardio:true});
// ══ RECONNAISSANCE APPROCHÉE ══════════════════════════════════════════════
// Troisième étage du résolveur, après le nom exact et les motifs : l'entrée du
// guide la plus proche. Il rattrape les déclinaisons que personne n'a saisies
// (« CHEST PRESS ALLONGÉ » quand le guide a « CHEST PRESS DEBOUT ») et les
// fautes de frappe.
const EX_MOTS_VIDES = new Set(['A','AU','AUX','DE','DES','DU','LA','LE','LES',
  'EN','ET','SUR','SOUS','AVEC','SANS','POUR','UN','UNE','DANS','PAR','D','L']);
function _exMots(k){
  return String(k||'').split(' ').filter(m=>m && !EX_MOTS_VIDES.has(m));
}
// Distance d'édition, bornée : au-delà de `max` on abandonne sans finir le
// calcul — on ne veut savoir que « est-ce à une correction près ».
function _exDist(a,b,max){
  if(Math.abs(a.length-b.length)>max) return max+1;
  let prec=Array.from({length:b.length+1},(_,j)=>j);
  for(let i=1;i<=a.length;i++){
    const cur=[i]; let mini=i;
    for(let j=1;j<=b.length;j++){
      const c=a[i-1]===b[j-1]?0:1;
      cur[j]=Math.min(prec[j]+1, cur[j-1]+1, prec[j-1]+c);
      if(cur[j]<mini) mini=cur[j];
    }
    if(mini>max) return max+1;
    prec=cur;
  }
  return prec[b.length];
}
let _exVoc=null, _exFreq=null;
function _exIndex(){
  if(_exVoc) return;
  _exVoc=new Set(); _exFreq=new Map();
  for(const k of _exGuide().keys()){
    const vus=new Set(_exMots(k));
    for(const m of vus){
      _exVoc.add(m);
      _exFreq.set(m,(_exFreq.get(m)||0)+1);
    }
  }
}
// Un mot du guide à UNE correction près, ou le mot lui-même. Pas deux : à deux,
// « BARRE » et « BANC » se confondent, et un dos deviendrait un pec.
function _exPrefixe(a,b){
  const n=Math.min(a.length,b.length); let i=0;
  while(i<n && a[i]===b[i]) i++;
  return i;
}
function _exMotProche(m){
  _exIndex();
  if(_exVoc.has(m)) return m;
  if(m.length<5) return null;
  // À ÉGALE DISTANCE, ON DÉPARTAGE — sans quoi on garde le premier mot
  // rencontré, c'est-à-dire l'ordre d'insertion, autant dire le hasard.
  // « LATERALES » est à une correction de « LATERALE » comme de « LATERALS » ;
  // le préfixe commun tranche les pluriels et les accords, et la fréquence
  // tranche le reste.
  let best=null,bd=2,bp=-1,bf=-1;
  for(const v of _exVoc){
    const d=_exDist(m,v,1);
    if(d>1) continue;
    const p=_exPrefixe(m,v), f=_exFreq.get(v)||0;
    if(d<bd || (d===bd && (p>bp || (p===bp && f>bf)))){ bd=d; bp=p; bf=f; best=v; }
  }
  return bd<=1?best:null;
}
const EX_PROCHE_SEUIL = 0.55;   // part du poids de la requête qu'il faut couvrir
const EX_PROCHE_MARGE = 1.25;   // avance exigée sur le deuxième candidat
// L'entrée du guide la plus proche, ou null. CONSERVATEUR PAR CONSTRUCTION :
// devant deux familles proches, on rend null. Un muscle attribué au hasard va
// grossir le mauvais volume sans que personne ne le voie ; une absence, elle,
// se voit — l'exercice apparaît comme non rattaché.
function _exApprocher(k){
  _exIndex();
  const mots=_exMots(k).map(_exMotProche).filter(Boolean);
  if(!mots.length) return null;
  const poids=m=>1/Math.log(2+(_exFreq.get(m)||0));   // rare = lourd
  const total=mots.reduce((a,m)=>a+poids(m),0);
  if(!(total>0)) return null;
  let b1=null,s1=0,s2=0,mus1=null,mus2=null;
  for(const [kk,val] of _exGuide()){
    const set=new Set(_exMots(kk));
    let s=0;
    for(const m of mots) if(set.has(m)) s+=poids(m);
    // Une entrée beaucoup plus longue que la requête ne doit pas gagner par
    // accumulation : on rapporte au plus long des deux.
    s=s/Math.max(1,Math.max(mots.length,set.size))*Math.max(mots.length,1);
    if(s>s1){ s2=s1; mus2=mus1; s1=s; b1=kk; mus1=val.p[0]; }
    else if(s>s2){ s2=s; mus2=val.p[0]; }
  }
  if(!b1) return null;
  if(s1/total < EX_PROCHE_SEUIL) return null;
  // LA MARGE SE JUGE SUR LE MUSCLE, PAS SUR L'ENTRÉE. Une douzaine d'entrées
  // « DEVELOPPE COUCHE … » à des scores voisins ne sont pas une hésitation :
  // elles disent toutes pectoraux. N'exiger une avance que lorsque les deux
  // meilleurs candidats DÉSIGNENT DES MUSCLES DIFFÉRENTS.
  if(s2>0 && mus2 && mus2!==mus1 && s1/s2 < EX_PROCHE_MARGE) return null;
  const g=_exGuide().get(b1);
  return g?{p:g.p.slice(),s:g.s.slice(),src:'proche',via:b1}:null;
}
function resoudreMusclesLecture(nom,ex,user){
  const k0=exKey(nom); if(!k0) return null;
  const k=_aliasPour(k0,user);
  // Même ordre que resoudreMuscles : un choix déjà enregistré fait foi.
  const dejaVu=user&&user.exMuscles&&user.exMuscles[k];
  // R15 — meme revue que resoudreMuscles, mais SANS ECRIRE : cette lecture
  // sert aussi a la fiche coach, sur le dossier d'un autre.
  if(dejaVu&&!_autoARevoir(k,dejaVu)) return _normaliserMuscles(dejaVu,k);
  if((ex&&isCardio(ex))||_exGuideEstCardio(k)||_exGuideEstPosing(k)) return VOL_CARDIO;
  const g=_exGuide().get(k);
  if(g) return {p:g.p.slice(),s:g.s.slice(),src:'auto'};
  for(const rg of EX_REGLES) if(rg.motif.test(k)) return {p:rg.p.slice(),s:rg.s.slice(),src:'auto'};
  // DERNIER RECOURS : l'entrée du guide la plus proche. Après les motifs et non
  // avant — ceux-ci sont écrits à la main et tranchent des cas que la ressemblance
  // confondrait (« développé militaire » est une épaule, pas un pectoral).
  const pr=_exApprocher(k);
  if(pr) return pr;
  return null;   // inconnu : à compter comme « non rattaché », pas à deviner
}

// ── Pondérations ───────────────────────────────────────────────────────────
function poidsIntensite(s){
  const r=s?s.rir:null;
  if(r===''||r==null) return POIDS_RIR_ABSENT;
  const k=String(r);
  if(k in POIDS_RIR) return POIDS_RIR[k];
  const n=parseInt(k,10);
  // Valeur inattendue : on ne perd pas la série. En dessous de 4 on compte
  // plein, au-delà de 5 on ne compte plus, dans la continuité de la table.
  if(!isFinite(n)) return POIDS_RIR_ABSENT;
  return n<=3?1:(n===4?0.5:0);
}
function _poidsRoleCls(m,cls){
  if(!cls||cls===VOL_CARDIO) return POIDS_ROLE.AUCUN;
  if((cls.p||[]).includes(m)) return POIDS_ROLE.PRIMAIRE;
  if((cls.s||[]).includes(m)) return POIDS_ROLE.SECONDAIRE;
  return POIDS_ROLE.AUCUN;
}
function poidsRole(m,ex,user){
  const r=_poidsRoleCls(m,resoudreMusclesLecture(ex&&ex.name,ex,user||currentUser));
  return r===POIDS_ROLE.SECONDAIRE?poidsSecondaire(user||currentUser):r;
}
// Éligibilité d'une série : réalisée, chargée, et pas du cardio.
// Une série unilatérale (« 10 par jambe ») compte 1 et non 2, une dégressive
// (phase 1 + phase 2) compte 1 et non 2 : dans sess.data, un objet de sets EST
// une série, et le weight2/p2reps d'une dégressive vit dans ce même objet.
// La convention est donc tenue par la structure, sans code dédié.
// AU POIDS DU CORPS (typeCharge), une série faite compte sans charge saisie :
// des tractions à vide sont des tractions.
function serieEligible(s,ex){
  if(!s||s.done!==true) return false;
  if(isCardio(ex)) return false;
  if(parseFloat(s.weight)>0) return true;
  const t=typeCharge(ex);
  return t==='poids_corps'||t==='assiste'||t==='elastique';
}
function serieDure(s,m,ex,user){
  if(!serieEligible(s,ex)) return 0;
  // La technique entre en TROISIÈME facteur, après l'intensité et le rôle du
  // muscle. Elle vaut 1,0 pour presque tout : c'est une convention assumée,
  // pas une mesure — voir POIDS_TECHNIQUE et le texte affiché à l'écran Volume.
  return poidsIntensite(s)*poidsRole(m,ex,user)*poidsTechnique(techniqueDe(ex),user);
}

// ── Semaines ISO ───────────────────────────────────────────────────────────
// _lundiDe est la seule définition de « début de semaine » du fichier, déjà
// employée par updateStreak et renderNutriDots : on la réutilise plutôt que
// d'en introduire une seconde qui finirait par diverger.
// LES COULEURS DE ZONE. Elles reprennent VOL_ZONES, qui sert deja a l ecran
// de volume de l athlete : deux palettes pour la meme notion finiraient par
// se contredire.
const GC_COULEURS=Object.freeze({
  'sous-MEV' :'#6f6f6f',
  'MEV-MAV'  :'#3b82f6',
  'MAV-MRV'  :'#22c55e',
  'sur-MRV'  :'#e05050'
});
// CE QUE CHAQUE ZONE VEUT DIRE, en toutes lettres — Kevin, 23/09/2026 :
// « donne la possibilite de cliquer sur chacun et d'avoir une definition sur
// ce que ca signifie ». La definition elle-meme vit dans RC_LEXIQUE, avec les
// vingt autres : une seule table de definitions dans l'application, et le meme
// panneau qui les montre.
// ⚠ LES CLES SONT CELLES DE GC_COULEURS, et une assertion verifie qu'aucune
//   n'est orpheline : une zone sans definition rendrait un bouton mort.
const GC_ZONE_LEX=Object.freeze({
  'sous-MEV':'zone_sous_mev',
  'MEV-MAV' :'zone_mev_mav',
  'MAV-MRV' :'zone_mav_mrv',
  'sur-MRV' :'zone_sur_mrv'
});
// L athlete courant de la grille. Le coach ouvre la grille DEPUIS une fiche ;
// l'athlete ouvre LA SIENNE depuis « Mes seances » (lot 3).
let _gcAthlete=null;
// QUI REGARDE, ET SUR QUI. Les trois se lisent partout dans l'ecran : la
// grille d'un coach et la grille de son propre bloc ne disent pas les memes
// phrases, et ne proposent pas les memes gestes.
function _gcCoach(){ return !!(currentUser&&currentUser.role==='coach'); }
function _gcSurSoi(){
  return !!(currentUser&&_gcAthlete&&_gcAthlete.email&&_gcAthlete.email===currentUser.email);
}
function _gcModifiable(){ return _gcCoach()||_gcSurSoi(); }
