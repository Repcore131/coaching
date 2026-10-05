// ══════════════ LE MOTEUR DU TABLEUR ═══════════════════════════════════
//
// Porte la chaine que Kevin tient dans ses tableurs .ods depuis des annees, et
// que l'app ne reproduisait pas. Le 05/08/2026 nous avions tranche de NE PAS
// la porter — `besoinsProposes` faisait deja le travail autrement. Kevin a
// rouvert l'arbitrage le 07/09/2026, capture a l'appui : sur son propre
// dossier l'app annoncait 2 317 kcal la ou son tableur en donne 3 139.
//
// ⚠ TROIS ECARTS, PAS UN. Mesures faites sur son cas (100 kg, 190 cm, 26 ans,
// homme, 12 h de musculation par semaine) avant d'ecrire une ligne :
//   · la formule      Harris-Benedict 2 209 contre Mifflin 2 072   (+137)
//   · le facteur      1,4 choisi a la main contre 1,20 par defaut  (+20 %)
//   · la reduction    x0,85 a plat contre un deficit derive d'une vitesse
// Les trois se cumulent. N'en corriger qu'un n'aurait rien rapproche.
//
// ⚠ ET UNE RESERVE, DITE A KEVIN AVANT DE L'ECRIRE. Harris-Benedict 1918 est
// la version d'ORIGINE. Elle surestime de 5 a 15 % sur les populations
// actuelles — c'est precisement pourquoi la revision Roza (1984) puis
// Mifflin-St Jeor (1990) existent. L'ecart de +137 kcal n'est pas un defaut de
// l'app : c'est cette surestimation. Kevin a confirme vouloir SA chaine ; elle
// tient donc sur la constante ci-dessous, et une seule ligne la ramene a
// Mifflin le jour ou il changera d'avis.
const MB_FORMULE='harris';        // 'harris' | 'mifflin'

// ── L'AGE, CALCULE ET NON SAISI ────────────────────────────────────────
//
// ⚠ UN AGE SAISI VIEILLIT MAL. « 26 » entre au bilan de depart reste 26 pour
// toujours : deux ans plus tard le metabolisme de base est calcule sur un age
// faux, et personne ne s'en apercoit — c'est la seule des quatre entrees qui
// se perime toute seule. La date de naissance, elle, ne bouge jamais.
//
// L'age saisi reste lu EN REPLI, et il le restera : des dossiers en portent un
// sans date de naissance, et les priver de calcul serait leur faire payer un
// changement qu'ils n'ont pas demande.
function ageActuel(user){
  const u=_dossier(user);
  const bd=(u&&u.birthdate)||_dernierChamp(u,'deb-birthdate')||null;
  const a=bd?_ageRevolu(bd):null;
  if(a!=null&&a>=0&&a<=120) return a;
  const bl=((u&&u.bilans)||[]).filter(b=>b&&b.date).slice().sort((x,y)=>x.date-y.date);
  const b=bl[bl.length-1]||{};
  return parseFloat(b['deb-age']||(u&&u['init-age'])||(u&&u.age)||0)||null;
}

// Harris-Benedict 1918, dans sa forme d'origine — celle du tableur.
//   Homme : 66   + 13,7 x poids + 5   x taille - 6,8 x age
//   Femme : 655  +  9,6 x poids + 1,8 x taille - 4,7 x age
function mbHarrisBenedict(poids,taille,age,sexe){
  const p=Number(poids), t=Number(taille), a=Number(age);
  if(!(p>0)||!(t>0)||!(a>0)) return null;
  return Math.round(isFemale(sexe)
    ? 655+9.6*p+1.8*t-4.7*a
    : 66+13.7*p+5*t-6.8*a);
}
// Le point d'entree unique du metabolisme de repos estime. Katch reste
// prioritaire quand la masse maigre est MESUREE : une mesure vaut mieux que
// n'importe quelle estimation, quelle que soit la formule retenue ici.
// LA FORMULE EST CHOISIE PAR DOSSIER (30/09/2026) : mbFormuleDe(u). `u`
// absent, c'est la constante MB_FORMULE (appelants d'avant).
function mbEstime(poids,taille,age,sexe,u){
  return (u?mbFormuleDe(u):MB_FORMULE)==='harris'
    ? mbHarrisBenedict(poids,taille,age,sexe)
    : mbMifflin(poids,taille,age,sexe);
}
const MB_FORMULES=Object.freeze(['harris','mifflin']);
const MB_NOMS=Object.freeze({katch:'Katch-McArdle',harris:'Harris-Benedict',mifflin:'Mifflin-St Jeor'});
const MB_IMC_MIFFLIN=30;
// PURE. La formule d'estimation du metabolisme pour CE dossier :
//   1. le reglage du coach (nutrition.tableur.formuleMB) ;
//   2. sinon Mifflin-St Jeor si l'IMC atteint 30 — Harris-Benedict surestime
//      d'autant plus que le poids monte, et c'est la que l'ecart se paie ;
//   3. sinon la constante MB_FORMULE.
// UN SEUL CHEMIN : cibleTableur, besoinsProposes, _depensePourPlafond et le
// metabolisme du tableau de bord la lisent tous, et nomment ce qu'elle rend.
function mbFormuleDe(u){
  const r=u&&u.nutrition&&u.nutrition.tableur&&u.nutrition.tableur.formuleMB;
  if(MB_FORMULES.indexOf(r)>=0) return r;
  const imc=_imcPourFormule(u);
  if(imc!=null&&imc>=MB_IMC_MIFFLIN) return 'mifflin';
  return MB_FORMULE;
}
function _imcPourFormule(u){
  let p=null; try{ p=poidsNutritionnel(u).kg; }catch(e){ p=null; }
  const bl=((u&&u.bilans)||[]).filter(b=>b&&b.date).slice().sort((x,y)=>x.date-y.date);
  const b=bl[bl.length-1]||{};
  const t=parseFloat((u&&(u._evol_height||u['init-height']))||b['deb-height']||(u&&u.height)||0)||null;
  if(!(p>0)||!(t>0)) return null;
  return p/Math.pow(t/100,2);
}

// ── L'ECHELLE D'ACTIVITE HORS SPORT, celle du tableur ──────────────────
//
// ⚠ CINQ NIVEAUX, LA OU L'APP EN AVAIT QUATRE, et des valeurs differentes :
// l'app tenait 1,15 / 1,25 / 1,40 / 1,55, le tableur tient 1,2 / 1,4 / 1,5 /
// 1,6 / 1,7. On garde CELLE DU TABLEUR — c'est la methode de Kevin, et deux
// echelles cote a cote finiraient par donner deux chiffres pour le meme
// athlete selon l'ecran regarde.
const NAF_ECHELLE=Object.freeze([
  Object.freeze({cle:'sedentaire',lib:'Sédentaire',            f:1.2,
    aide:'Assis la majeure partie de la journée'}),
  Object.freeze({cle:'peu',       lib:'Peu actif',             f:1.4,
    aide:'Debout, déplacements réguliers, peu de port de charges'}),
  Object.freeze({cle:'moyen',     lib:'Moyennement actif',     f:1.5,
    aide:'Marche soutenue une bonne partie de la journée'}),
  Object.freeze({cle:'actif',     lib:'Actif',                 f:1.6,
    aide:'Effort physique continu, port de charges'}),
  Object.freeze({cle:'tres',      lib:'Très actif',            f:1.7,
    aide:'Travail de force toute la journée'})
]);
// La table des metiers de l'app classe en quatre niveaux ; l'echelle en compte
// cinq. La correspondance se fait par la DESCRIPTION, pas par le rang — et
// « Très actif » n'est jamais atteint automatiquement : il reste un choix
// explicite du coach, parce qu'aucun intitule de metier ne le garantit.
const NAF_DEPUIS_METIER=Object.freeze({
  sedentaire:'sedentaire', leger:'peu', modere:'moyen', lourd:'actif'
});
function nafNiveau(cle){
  return NAF_ECHELLE.filter(x=>x.cle===cle)[0]||null;
}
// PURE. Ce que la personne a coche dans son bilan, ramene a l'echelle.
//
// ⚠ ON ACCEPTE LA CLE ET LE LIBELLE. Le formulaire stocke le libelle — un
// bilan doit se lire tel quel, « Sédentaire » et pas « sedentaire » — mais
// un reglage venu d'ailleurs porte la cle. Les deux entrent ici, et la
// comparaison ignore accents et casse : « tres actif » vaut « Très actif ».
function nafDepuisReponse(txt){
  const nrm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
                 .toLowerCase().trim();
  const t=nrm(txt);
  if(!t) return null;
  return NAF_ECHELLE.filter(x=>
    x.cle===t||nrm(x.lib)===t)[0]||null;
}
// PURE. LE NIVEAU DECLARE CONTREDIT LE METIER (30/09/2026). « Actif » ou
// « Très actif » coché au bilan par un athlete dont le metier reconnu est
// assis : le plus souvent, il a compte ses seances dans son activite de la
// journee — et le sport, compte a part, l'est alors deux fois. On ne corrige
// rien (sa reponse passe devant le metier) : on le dit au coach.
const NAF_ALERTE_METIER='niveau déclaré supérieur à celui du métier : vérifier qu’il ne compte pas le sport';
function nafIncoherent(user){
  const u=_dossier(user);
  const dec=nafDepuisReponse(_dernierChamp(u,'deb-naf'));
  if(!dec||(dec.cle!=='actif'&&dec.cle!=='tres')) return false;
  return niveauMetier(_dernierChamp(u,'deb-job'))==='sedentaire';
}
// PURE. Le niveau retenu et d'ou il vient : le reglage explicite du coach
// d'abord, la profession ensuite, et le sedentaire en dernier recours.
function nafRetenu(user,opts){
  const o=opts||{};
  if(o.naf&&nafNiveau(o.naf)) return {n:nafNiveau(o.naf),source:'reglage'};
  const u=_dossier(user);
  const regle=((u&&u.nutrition&&u.nutrition.tableur)||{}).naf;
  if(regle&&nafNiveau(regle)) return {n:nafNiveau(regle),source:'reglage'};
  const metier=_dernierChamp(u,'deb-job');
  // ⚠ LE NIVEAU DECLARE PASSE DEVANT LA PROFESSION. La personne a repondu
  // elle-meme dans son bilan : sa reponse vaut mieux qu'une deduction faite
  // sur un intitule de metier. Seul le reglage du coach, lu plus haut, la
  // depasse encore.
  const dec=nafDepuisReponse(_dernierChamp(u,'deb-naf'));
  if(dec) return {n:dec,source:'declare',metier:metier||null};
  const niv=niveauMetier(metier);
  if(niv&&NAF_DEPUIS_METIER[niv])
    return {n:nafNiveau(NAF_DEPUIS_METIER[niv]),source:'metier',metier:metier};
  // ⚠ LES PAS, ET NE PAS LES PERDRE. La premiere version de cette fonction
  // s'arretait a la profession et retombait au sedentaire : un athlete sans
  // metier reconnu mais qui releve ses pas depuis quinze jours perdait ce
  // qu'il avait pris la peine de mesurer, en silence. Une assertion du banc
  // l'a dit — « un releve de pas suffit a sortir du NEAT par defaut ».
  //
  // Les bornes sont celles d'ACT_PAS, ramenees a l'echelle a cinq niveaux :
  // on ne tient pas deux tables de pas, on relit celle qui existe.
  const pas=moyennePas14j(u);
  if(pas!=null){
    const cle=pas<=4000?'sedentaire':(pas<=7500?'peu'
      :(pas<=10000?'moyen':'actif'));
    return {n:nafNiveau(cle),source:'pas',pas:pas,metier:metier||null};
  }
  return {n:nafNiveau('sedentaire'),source:'defaut',metier:metier||null};
}

// ── LE COEFFICIENT D'OBJECTIF ──────────────────────────────────────────
//
// Le tableur multiplie la depense totale par un coefficient : 0,85 en seche.
// C'est un menu deroulant, pas une constante — et les trois autres objectifs
// en ont un aussi, sans quoi le calcul ne saurait rien faire d'une prise de
// masse.
//
// ⚠ IL REMPLACE LE DEFICIT DERIVE D'UNE VITESSE, il ne s'y ajoute pas. Les
// deux repondent a la meme question ; les cumuler retrancherait deux fois.
const OBJ_COEF_DEFAUT=Object.freeze({seche:0.85,masse:1.10,recomp:1.00,maintien:1.00,
  peak:1.00});
const OBJ_COEF_ECHELLE=Object.freeze({
  seche:   Object.freeze([0.90,0.85,0.80,0.75,0.70]),
  masse:   Object.freeze([1.05,1.10,1.15,1.20]),
  recomp:  Object.freeze([1.00,0.97,0.95]),
  maintien:Object.freeze([1.00]),
  // PEAK WEEK : du maintien vers le haut, et le coach choisit. On ne descend
  // PAS sous 100 % de la depense — arriver sur scene en deficit est le contraire
  // de ce qu'on cherche — et on ne propose pas un cran au-dela de +20 %, qui
  // serait un protocole de charge deguise en coefficient.
  peak:    Object.freeze([1.00,1.05,1.10,1.15,1.20])
});
/**
 * PURE. Le coefficient d'objectif REELLEMENT applicable a une phase.
 *
 * ⚠ UN COEFFICIENT D'UNE AUTRE PHASE N'EST PAS UN COEFFICIENT DE CELLE-CI.
 *   Kevin, 20/09/2026 : « le total ne bouge pas malgré le fait de changer prise
 *   de masse / sèche ». Mesure faite sur sa capture : 3 711 kcal de dépense,
 *   « Prise de masse » affichée, le menu sur « 105 % » — et un total de 3 154,
 *   soit 3 711 × 0,85. Le coefficient de la SECHE avait survécu au changement
 *   de phase, et il continuait de piloter le calcul.
 *
 * ⚠ ET L'ECRAN MENTAIT DEUX FOIS. Le menu est construit sur
 *   `OBJ_COEF_ECHELLE[phase]` : 0,85 n'est pas dans le barème de la prise de
 *   masse, aucune option ne portait `selected`, et un navigateur affiche alors
 *   LA PREMIERE. Le coach lisait donc « 105 % » au-dessus d'un calcul fait à
 *   85 %, sans rien pour le signaler.
 *
 * ⚠ LA VALEUR STOCKEE N'EST PAS EFFACEE, et c'est voulu : un coach qui revient
 *   à la sèche retrouve le 0,85 qu'il avait choisi. Ce qui change, c'est qu'on
 *   ne l'APPLIQUE plus à une phase qui ne le connaît pas.
 * @param {number} coef
 * @param {string} phase
 * @returns {number}
 */
function coefPourPhase(coef,phase){
  const p=phase||'maintien';
  const ech=OBJ_COEF_ECHELLE[p];
  const c=Number(coef);
  if(!isFinite(c)) return objCoefDefaut(p);
  if(!Array.isArray(ech)) return c;
  return ech.some(v=>Math.abs(v-c)<1e-9)?c:objCoefDefaut(p);
}
function objCoefDefaut(phase){
  return OBJ_COEF_DEFAUT[phase]!=null?OBJ_COEF_DEFAUT[phase]:1.00;
}

// ══════════════ LA CHAINE COMPLETE, PURE ═══════════════════════════════
//
// Rend les cinq lignes du tableur ET les macros, ou {manque:[…]} quand une
// donnee indispensable n'est pas la. On ne devine RIEN : un chiffre invente
// serait pire que pas de chiffre.
//
// `opts` porte les reglages en cours du coach — ce qu'il est en train de
// bouger dans les menus deroulants prime sur ce qui est enregistre, sinon
// l'ecran montrerait le resultat d'avant son geste.
function cibleTableur(user,opts){
  const o=opts||{};
  const u=_dossier(user);
  const reg=((u&&u.nutrition&&u.nutrition.tableur)||{});
  const bl=((u&&u.bilans)||[]).filter(b=>b&&b.date).slice().sort((a,b)=>a.date-b.date);
  const b=bl[bl.length-1]||{};
  // MEMES SOURCES QUE besoinsProposes, deliberement : deux lectures du poids
  // finiraient par donner deux poids.
  const poids=poidsNutritionnel(u).kg;
  const taille=parseFloat((u&&(u._evol_height||u['init-height']))||b['deb-height']||(u&&u.height)||0)||null;
  const age=ageActuel(u);
  const sexe=(u&&(u._evol_gender||u.gender))||b['deb-gender']||'';
  const manque=[];
  if(!(poids>0)) manque.push('poids');
  if(!(taille>0)) manque.push('taille');
  if(!(age>0)) manque.push('âge');
  if(!sexe) manque.push('sexe');
  if(manque.length) return {manque};

  // ── Ligne 1 : le metabolisme de base ─────────────────────────────────
  const mm=masseMaigreDuBilan(u);
  let mb=null, mbSource=null;
  if(mm!=null){ mb=mbKatch(mm); mbSource='katch'; }
  if(mb==null){ mb=mbEstime(poids,taille,age,sexe,u); mbSource=mbFormuleDe(u); }
  if(mb==null) return {manque:['calcul impossible']};
  const _corr=(typeof o.correctionMB==='number')
    ?correctionMB({correctionMB:o.correctionMB}):correctionMB(u);
  const mbCorrige=_corr!==1?Math.round(mb*_corr):mb;

  // ── Ligne 2 : la depense hors sport ──────────────────────────────────
  const naf=nafRetenu(u,o);
  const horsSport=Math.round(mbCorrige*naf.n.f);

  // ── Ligne 3 : la depense avec le sport ──────────────────────────────
  const sport=kcalSportParJour(u);
  const avecSport=horsSport+sport.jour;

  // ── Ligne 4 : le coefficient d'objectif ─────────────────────────────
  // ⚠ L'OBJECTIF DE L'ATHLETE DEVIENT LA PHASE QUAND LE COACH N'EN A POSE
  //   AUCUNE (30/09/2026). Sans ces lignes, un athlete sans user.phase restait
  //   en 'maintien' : coefPourPhase(0,85, 'maintien') rendait 1,00 et
  //   protSuggeree 1,8 g/kg — « Sèche » ne changeait ni les kcal ni le g/kg.
  //   L'objectif vient de opts.objectif, sinon de nutrition.perso.objectif
  //   quand les cibles sont celles de l'athlete (origine 'athlete'). Une phase
  //   posee par le coach gagne toujours : le choix de l'athlete est ignore.
  const _phCoach=(typeof phaseCourante==='function')?phaseCourante(u):null;
  const _objAth=(function(){
    if(_phCoach) return null;
    const ok=k=>ATH_OBJECTIFS.some(x=>x.k===k)?k:null;
    if(o.objectif) return ok(o.objectif);
    const nu=(u&&u.nutrition)||{};
    return ((nu.macros||{}).origine==='athlete')?ok((nu.perso||{}).objectif):null;
  })();
  const phase=_phCoach?(_phCoach.type||'maintien'):(_objAth||'maintien');
  // ⚠ LE COEFFICIENT EST RAMENE A LA PHASE EN COURS. Sans cette ligne, celui
  //   d'une phase precedente pilotait encore le total pendant que le menu — qui
  //   ne le trouve pas dans son bareme — affichait sa premiere option. Voir
  //   coefPourPhase : le defaut du 20/09/2026.
  const coef=coefPourPhase(
    (typeof o.coef==='number'&&isFinite(o.coef))?o.coef
      :((typeof reg.coef==='number'&&isFinite(reg.coef))?reg.coef:objCoefDefaut(phase)),
    phase);
  const brut=Math.round(avecSport*coef);

  // ── Les macros ──────────────────────────────────────────────────────
  // g/kg de proteines et de lipides : les memes constantes que partout
  // ailleurs dans le fichier, et les memes menus deroulants.
  // ⚠ LE REPLI EST protSuggeree ET NON PROT_DEFAUT[phase], depuis le
  // 08/09/2026. PROT_DEFAUT ne connait que la phase ; protSuggeree connait
  // AUSSI l'athlete — c'est elle qui porte le bonus menopause et qui borne au
  // haut de protEchelle(u). Une athlete menopausee recevait donc du tableur un
  // g/kg SOUS le plancher de sa propre echelle, pendant que le second
  // selecteur — celui de « Point de depart », retire le meme jour — lui
  // montrait la bonne. Le defaut divergeait de l'echelle qui l'encadre ; tant
  // qu'il y avait deux menus, l'un des deux rattrapait l'autre.
  // protSuggeree LEVE si la phase est inconnue : le repli d'avant reste
  // derriere elle, il ne disparait pas.
  const _protSug=(function(){
    try{ const v=protSuggeree(u,phase); if(typeof v==='number'&&isFinite(v)) return v; }
    catch(e){}
    return (PROT_DEFAUT[phase]!=null?PROT_DEFAUT[phase]:PROT_BASE);
  })();
  // ⚠ UN SEUL FOYER POUR LE g/kg : `nutrition.tableur`. Kevin, 20/09/2026 :
  //   « il faut que les modifs se fassent dans les 2 sens ». Le coach ecrivait
  //   dans `nutrition.tableur.protGkg`, l'athlete dans
  //   `nutrition.reglages.prot` — deux maisons pour le MEME reglage, qui ne se
  //   parlaient pas. `nutrition.reglages` reste lu EN REPLI, et seulement en
  //   repli : les dossiers ou l'athlete avait choisi son g/kg avant ce lot ne
  //   doivent pas le perdre en silence.
  const _regAnc=((u&&u.nutrition&&u.nutrition.reglages)||{});
  const protGkg=(typeof o.protGkg==='number'&&isFinite(o.protGkg))?o.protGkg
    :((typeof reg.protGkg==='number'&&isFinite(reg.protGkg))?reg.protGkg
      :((typeof _regAnc.prot==='number'&&isFinite(_regAnc.prot))?_regAnc.prot:_protSug));
  const lipGkg=(typeof o.lipGkg==='number'&&isFinite(o.lipGkg))?o.lipGkg
    :((typeof reg.lipGkg==='number'&&isFinite(reg.lipGkg))?reg.lipGkg
      :((typeof _regAnc.lip==='number'&&isFinite(_regAnc.lip))?_regAnc.lip:LIP_G_PAR_KG));
  // ⚠ LE PLANCHER CALORIQUE GARDE LE DERNIER MOT, comme sur le chemin
  // automatique. Un coefficient de 0,70 sur une petite depense peut descendre
  // sous ce qu'un adulte doit manger ; le tableur, lui, ne le savait pas.
  let pl=0; try{ pl=plancherAthlete(u)||0; }catch(e){ pl=0; }
  // LE PLANCHER EST APPLIQUE COTE ATHLETE (30/09/2026). opts.appliquerPlancher
  // decide ; sans lui, vrai sur l'appareil de l'athlete tant que ses cibles ne
  // sont pas posees par le coach (dont la derogation confirmee reste la sienne),
  // faux sur l'appareil du coach.
  const appliquer=(o.appliquerPlancher!==undefined)?!!o.appliquerPlancher
    :(_appareilAthlete()&&!(function(){ try{ return ciblesPoseesParCoach(u); }catch(e){ return false; } })());
  // ⚠ LE ±20 PARTAGE S'APPLIQUE ICI, et nulle part ailleurs (build 1412) : le
  //   tableau du coach, les journees ON/OFF et la carte de l'athlete sortent
  //   tous de ce calcul, donc tous les trois le portent du meme coup. AVANT le
  //   plancher : un −20 ne fait pas descendre sous le plancher de securite.
  //   Le total brut reste la depense × coefficient, sans l'ajustement : c'est ce que
  //   la ligne « total brut » du tableau annonce, et elle ne doit pas se mettre
  //   a inclure un reglage manuel sans le dire.
  const deltaKcal=(typeof o.delta==='number'&&isFinite(o.delta))?Math.round(o.delta):deltaKcalPartage(u);
  const ajuste=Math.max(0,brut+deltaKcal);
  // ⚠ LE TOTAL N'EST PLUS REMONTE AU PLANCHER (24/09/2026). Cette ligne valait
  //   `Math.max(ajuste,pl)`, et c'est elle qui rendait le bouton −20 INERTE
  //   chez l'athlete : une fois sous le plancher, vingt calories de moins ne
  //   changeaient plus rien a l'ecran. Le plancher reste calcule et dit
  //   (`plancher`, `sousPlancher`), il ne corrige plus.
  const kcal=appliquer?Math.max(ajuste,pl):ajuste;
  // Proteines et lipides sur le POIDS DE REFERENCE (poidsMacros).
  const _pm=poidsMacros(u);
  const rep=_repartition(kcal,poids,protGkg,lipGkg,_pm.kg);
  const bloc=_bloc(rep.p,rep.l,rep.g);

  return {
    poids,taille,age,sexe,
    mb:mbCorrige, mbBrut:mb, mbSource, correction:_corr,
    naf:naf.n, nafSource:naf.source, metier:naf.metier||null,
    horsSport, sportJour:sport.jour, sportSemaine:sport.semaine,
    sportSource:sport.source, creneaux:sport.creneaux, dureeMin:sport.dureeMin,
    sportLignes:sport.lignes||[], sportPoids:sport.poids, sportPoidsDefaut:!!sport.poidsDefaut,
    // Le niveau déclaré dépasse celui du métier : le sport y est-il compté ?
    nafAlerte:naf.source==='declare'&&nafIncoherent(u),
    avecSport,
    // `sousPlancher` DIT que les chiffres passent dessous — avant, il disait
    // qu'ils avaient ete remontes. Meme nom, sens inverse, et c'est celui-la
    // que l'ecran doit annoncer.
    coef, phase, brut, delta:deltaKcal, ajuste, plancher:pl, sousPlancher:(pl>0&&ajuste<pl),
    // Le plancher a-t-il ete applique, et a-t-il releve le total ? Les journees
    // (_tbJournees) suivent la meme decision.
    appliquePlancher:appliquer, releve:appliquer&&pl>0&&ajuste<pl,
    kcal, p:bloc.p, l:bloc.l, g:bloc.g, f:bloc.f,
    protGkg, lipGkg, manque:[],
    poidsRef:_pm.kg, poidsRefObj:_pm, glucidesBas:rep.glucidesBas, depasse:rep.depasse
  };
}
function besoinsProposes(user,opts){
  const o=opts||{};
  // Le chemin AUTOMATIQUE borne au plancher sur l'appareil de l'athlete (30/09/2026).
  const _appl=(o.appliquerPlancher!==undefined)?!!o.appliquerPlancher:_appareilAthlete();
  const hypotheses=[];
  const bl=((user&&user.bilans)||[]).filter(b=>b&&b.date).slice().sort((a,b)=>a.date-b.date);
  const b=bl[bl.length-1]||{};
  // N2.6 — LA MEME SOURCE QUE LE PLANCHER ET LES g/kg. getBW(dernier bilan)
  // puis init-weight faisait retomber le calcul sur le poids DECLARE A
  // L'INSCRIPTION des que le dernier bilan ne portait pas de pesee : les
  // grammages revenaient alors des mois en arriere, en silence.
  const poids=poidsNutritionnel(user).kg;
  const taille=parseFloat((user&&(user._evol_height||user['init-height']))||b['deb-height']||(user&&user.height)||0)||null;
  // ⚠ ageActuel, ET NON LE CHAMP SAISI. Depuis le 07/09/2026 le bilan demande
  // une DATE DE NAISSANCE ; un dossier ouvert depuis n'a plus de `deb-age`, et
  // cette ligne le declarait sans age — donc sans AUCUNE proposition, en
  // silence. C'est l'assertion d'unification qui l'a dit. ageActuel retombe
  // lui-meme sur l'age saisi : un seul chemin, les deux generations servies.
  const age=ageActuel(user);
  const sexe=(user&&(user._evol_gender||user.gender))||b['deb-gender']||'';
  // On ne devine RIEN. Sans l'une de ces quatre données, il n'y a pas de
  // proposition — un chiffre inventé serait pire que pas de chiffre.
  const manque=[];
  if(!(poids>0)) manque.push('poids');
  if(!(taille>0)) manque.push('taille');
  if(!(age>0)) manque.push('âge');
  if(!sexe) manque.push('sexe');
  if(manque.length) return {source:null,on:null,off:null,manque,hypotheses};

  const mm=masseMaigreDuBilan(user);
  let mb=null,source=null;
  if(mm!=null){ mb=mbKatch(mm); source='katch';
    hypotheses.push('masse maigre '+String(mm).replace('.',',')+' kg, mesurée au dernier bilan'); }
  if(mb==null){ mb=mbEstime(poids,taille,age,sexe,user); source=mbFormuleDe(user);
    // ⚠ LA FORMULE EST NOMMEE. Elle a change le 07/09/2026 — Harris-Benedict
    // a la place de Mifflin, sur decision de Kevin — et un athlete dont la
    // proposition monte de 137 kcal a le droit de savoir pourquoi.
    hypotheses.push('tours de mesure absents : estimation '
      +(MB_NOMS[source]||'Mifflin-St Jeor')
      +' sur poids, taille, âge et sexe'); }
  if(mb==null) return {source:null,on:null,off:null,manque:['calcul impossible'],hypotheses};
  // AVANT le facteur d'activité, et sur le métabolisme de repos seul. Ce
  // n'est pas une mesure : c'est une décision de coach, et elle se dit.
  // Le réglage en cours du coach prime sur la valeur enregistrée : c'est ce
  // qu'il est en train de régler qu'il doit voir.
  const _corr=(typeof o.correctionMB==='number')
    ?correctionMB({correctionMB:o.correctionMB}):correctionMB(user);
  if(_corr!==1){
    mb=Math.round(mb*_corr);
    const pct=Math.round((_corr-1)*100);
    hypotheses.push('métabolisme corrigé de '+(pct>0?'+':'')+pct
      +' % sur décision du coach');
  }

  // Profession et sports viennent du DERNIER bilan qui les porte. Un athlète
  // qui n'a pas encore refait son bilan garde l'ancien calcul : personne ne
  // perd sa proposition le jour de la mise à jour.
  // UN SEUL CHEMIN. Le NEAT ne couvre jamais le sport, le sport est toujours
  // ajouté en kcal, et l'entraînement RepCore est compté exactement une fois.
  // Deux athlètes identiques ne diffèrent plus que par leur NEAT.
  // ⚠ UN SEUL FACTEUR POUR TOUTE L'APP, DEPUIS LE 07/09/2026. Deux echelles
  // cohabitaient — quatre niveaux ici (1,15 a 1,55), cinq dans les tableaux du
  // coach (1,2 a 1,7) — et le meme athlete recevait deux depenses selon
  // l'ecran regarde. C'est celle du tableur qui reste : c'est la methode de
  // Kevin, et c'est elle qu'il lit.
  //
  // nafRetenu porte AUSSI le reglage explicite du coach, ce que facteurNEAT ne
  // savait pas faire : un metier non reconnu se corrige desormais a la main au
  // lieu de retomber en silence sur le niveau de base.
  const _naf=nafRetenu(user,o);
  const neatPas=(function(){ try{ return facteurNEAT(user); }catch(e){ return {}; } })();
  const neat={f:_naf.n.f,source:(_naf.source==='metier'?'profession':_naf.source),
    lib:_naf.n.lib,niveau:_naf.n.cle,metier:_naf.metier||neatPas.metier||null,
    pas:neatPas.pas!==undefined?neatPas.pas:null};
  const sport=kcalSportParJour(user);
  const metier=neat.metier;
  const depense=Math.round(mb*neat.f)+sport.jour;
  const modele=neat.source;
  const act={f:neat.f,source:neat.source,pas:neat.pas,seances:sport.creneaux,
    niveau:neat.niveau||null,metier:metier||null};
  // Un facteur s'écrit à deux décimales : « NEAT × 1,2 » se lisait comme une
  // valeur tronquée. Les kcal, elles, restent en entier.
  const _vf=(x)=>Number(x).toFixed(2).replace('.',',');
  // ── Le NEAT, nommé et chiffré ──
  if(neat.source==='profession')
    hypotheses.push(metier.toLowerCase()+' : '+neat.lib.toLowerCase()
      +' → NEAT × '+_vf(neat.f));
  else if(neat.source==='pas')
    hypotheses.push(neat.pas.toLocaleString('fr-FR')
      +' pas par jour en moyenne → NEAT × '+_vf(neat.f));
  else
    hypotheses.push('ni profession reconnue ni relevé de pas → NEAT × '+_vf(neat.f));
  // Dire « déduit des pas » sans aucun relevé de pas était faux. La phrase
  // suit ce qui a RÉELLEMENT servi.
  if(metier&&neat.source==='pas')
    hypotheses.push('profession « '+metier+' » non reconnue : NEAT déduit des pas seuls');
  else if(metier&&neat.source==='defaut')
    hypotheses.push('profession « '+metier+' » non reconnue, et aucun relevé de pas : NEAT de base');
  // ── L'entraînement RepCore, valorisé en kcal comme n'importe quel sport ──
  const _dm=sport.dureeMin;
  const _dTxt=_dm%60===0?(_dm/60)+' h':(_dm>60?Math.floor(_dm/60)+' h '+(_dm%60):_dm+' min');
  const _jMuscu=Math.round(sport.semaineMuscu/7);
  if(_naf.source==='declare'&&nafIncoherent(user)) hypotheses.push(NAF_ALERTE_METIER);
  // Le poids qui chiffre le sport (MET nets).
  if(sport.semaine>0)
    hypotheses.push('sport chiffré en MET nets sur '+String(Math.round(sport.poids*10)/10).replace('.',',')+' kg'
      +(sport.poidsDefaut?' (poids inconnu : valeur par défaut)':''));
  if(sport.source==='coach')
    hypotheses.push('sports réglés à la main par le coach → '+sport.semaine
      +' kcal par semaine, soit '+sport.jour+' par jour');
  else if(sport.source==='creneaux'&&sport.creneaux>0)
    hypotheses.push(sport.creneaux+' créneau'+(sport.creneaux>1?'x':'')+' RepCore × '
      +_dTxt+' → '+sport.semaineMuscu+' kcal par semaine, soit '+_jMuscu+' par jour');
  else if(sport.source==='declaree')
    // Le détail porte déjà le mot « musculation » : le préfixer le doublait.
    hypotheses.push((sport.detailMuscu.join(', ')||'musculation déclarée')+' déclarée'
      +' → '+sport.semaineMuscu+' kcal par semaine, soit '+_jMuscu+' par jour');
  // ── Le doublon : dit à voix haute, jamais additionné ──
  if(sport.doublon)
    hypotheses.push(sport.source==='creneaux'
      ?'musculation déclarée dans les sports et '+sport.creneaux+' créneau'
        +(sport.creneaux>1?'x':'')+' actif'+(sport.creneaux>1?'s':'')
        +' : je compte les créneaux, pas les deux'
      :'musculation déclarée dans les sports et '+sport.creneaux+' créneau'
        +(sport.creneaux>1?'x':'')+' actif'+(sport.creneaux>1?'s':'')
        +' : je retiens la déclaration, plus élevée (jamais les deux)');
  // ── La durée de séance : le repli est DIT, jamais silencieux ──
  if(sport.creneaux>0&&sport.dureeSource==='defaut')
    hypotheses.push('durée de séance '+(sport.dureeBrut?'illisible (« '+sport.dureeBrut+' »)'
      :'non renseignée')+' : '+SEANCE_MIN_DEFAUT+' min retenues');
  // ── Les autres sports ──
  if(sport.source==='coach'){}
  else if(sport.autres>0)
    hypotheses.push('sports déclarés '+sport.detail.join(', ')+' → '+sport.autres
      +' kcal par semaine, soit '+Math.round(sport.autres/7)+' par jour');
  else if(!sport.doublon&&sport.source!=='declaree')
    hypotheses.push('aucun sport déclaré en dehors de RepCore');
  // ── Ce qu'on n'a pas su compter, nommé plutôt que passé sous silence ──
  if(sport.inconnus.length)
    hypotheses.push(sport.inconnus.join(', ')+' : sport'+(sport.inconnus.length>1?'s':'')
      +' non reconnu'+(sport.inconnus.length>1?'s':'')+', non compté'
      +(sport.inconnus.length>1?'s':''));
  const phase=typePhase(user);
  const gParKg=(typeof o.protGparKg==='number'&&isFinite(o.protGparKg))
    ? o.protGparKg
    // Une SUGGESTION qui ne serait pas appliquée quand le coach n'a rien réglé
    // ne serait pas une suggestion : ce serait un affichage.
    : protSuggeree(user,phase);
  const libPhase=(phase&&PHASES[phase]&&PHASES[phase].lib)||'';
  hypotheses.push(String(gParKg).replace('.',',')+' g de protéines par kilo'
    +(libPhase?' ('+libPhase.toLowerCase()+')':''));
  // Le g/kg de lipides est annoncé DÈS qu'il s'écarte du défaut : un chiffre
  // qui change la moitié de l'assiette ne doit pas passer sous silence.
  const lipKg=(typeof o.lipGparKg==='number'&&isFinite(o.lipGparKg))
    ?Math.max(LIP_PLANCHER_G_KG,o.lipGparKg):LIP_G_PAR_KG;
  if(lipKg!==LIP_G_PAR_KG)
    hypotheses.push(String(lipKg).replace('.',',')+' g de lipides par kilo');

  // Le point de départ ne vaut plus la maintenance : il vise la vitesse
  // déclarée pour la phase. Sans phase, le delta est nul et le comportement
  // d'avant ce lot est conservé au kilocalorie près.
  // opts.vitesse ABSENT ⇒ cibleVitesseChoisie rend le MILIEU, soit exactement
  // ce que cibleVitesseMilieu rendait. Le comportement d avant ce lot est
  // conserve a la kilocalorie pres, et une assertion l epingle.
  // ══ LE COEFFICIENT D'OBJECTIF, ET NON PLUS UN DEFICIT DERIVE D'UNE
  //    VITESSE. Decision de Kevin, 07/09/2026.
  //
  // Les deux repondaient a la meme question et donnaient deux reponses : la
  // vitesse visee produisait ici un deficit de 769 kcal la ou le coefficient
  // du tableur en produit 554. Les cumuler aurait retranche deux fois ; en
  // garder deux aurait laisse l'app annoncer deux totaux pour le meme athlete.
  //
  // ⚠ LA VITESSE NE DISPARAIT PAS, ELLE CHANGE DE ROLE. Elle etait l'ENTREE
  // du calcul ; elle en devient la CONSEQUENCE, annoncee plus bas a partir du
  // total reellement servi — ce que le code faisait deja pour le cas ou le
  // plancher relevait la journee. `o.vitesse` reste accepte : le coach qui
  // pilote encore par la vitesse n'est pas mis dehors du jour au lendemain.
  // ⚠ LA MEME REGLE QUE cibleTableur, PAR LA MEME FONCTION. Les deux resolvent
  //   le coefficient d'objectif ; deux normalisations ecrites separement
  //   auraient fini par donner deux totaux pour le meme athlete — le defaut
  //   meme qu'on repare ici. Voir coefPourPhase.
  const _coefTb=coefPourPhase(
    (typeof o.coef==='number'&&isFinite(o.coef))?o.coef
      :((typeof (((user&&user.nutrition)||{}).tableur||{}).coef==='number')
        ?user.nutrition.tableur.coef:objCoefDefaut(phase||'maintien')),
    phase);
  const pctVise=cibleVitesseChoisie(phase,
    (o.vitesse===undefined?null:o.vitesse),user);
  let cible;
  let _parCoef=false;
  if(o.vitesse!==undefined&&o.vitesse!==null){
    cible=depense+deltaKcalJour(pctVise,poids);
  } else {
    cible=Math.round(depense*_coefTb);
    _parCoef=true;
    hypotheses.push('objectif à '+Math.round(_coefTb*100)+' % de la dépense');
  }
  // ⚠ LES PLAFONDS NE BRIDENT PAS UN COEFFICIENT CHOISI. Ils existent pour
  // qu'une GRANDE DEPENSE ne se traduise pas automatiquement en deficit
  // demesure ; un coefficient sorti d'un menu borne est une decision de coach,
  // et 0,70 — le plus bas du menu — tomberait sous le plafond de 25 %. Le
  // plancher calorique, lui, s'applique toujours : c'est lui la vraie
  // securite, et c'est une borne ABSOLUE, pas une proportion.
  // Les plafonds passent AVANT le plancher : le plancher doit rester le
  // dernier mot, et pouvoir remonter une valeur déjà bornée.
  if(!_parCoef){
    cible=Math.max(cible,Math.round(depense*(1-DEFICIT_MAX_PART)));
    cible=Math.min(cible,Math.round(depense*(1+SURPLUS_MAX_PART)));
  }
  const deltaRetenu=cible-depense;
  // Le poids de reference des proteines et des lipides, et il est DIT.
  const _pm=poidsMacros(user);
  const r=_repartition(cible,poids,gParKg,lipKg,_pm.kg);
  { const _lr=libPoidsMacros(_pm); if(_lr) hypotheses.push(_lr); }
  if(r.depasse>0) hypotheses.push('protéines et lipides dépassent la cible de '+r.depasse+' kcal');
  if(r.glucidesBas) hypotheses.push('glucides très bas : performance en séance compromise');
  // Le cycle se règle sur le nombre de créneaux : sans créneau, ou avec sept,
  // il n'y a pas de jour de repos à opposer (cycleGlucides).
  const _cg=cycleGlucides(user,r.g);
  const cycle=o.cycle!==false&&_cg.cycle;
  // Les journées sont calculées AVANT d'annoncer quoi que ce soit : le
  // plancher peut les relever, et c'est le total servi qui décide de la
  // vitesse réelle.
  let on,off;
  if(!cycle){
    const j=_relevePlancher(_bloc(r.p,r.l,r.g),user,_appl);
    on=j; off=Object.assign({},j);
  } else {
    // LE PLANCHER ÉCRASAIT LE CYCLE. Signalé par Kevin le 25/08/2026 : « pas
    // normal que ce soit les mêmes chiffres en ON et OFF ».
    //
    // Les deux journées étaient relevées SÉPARÉMENT. Sur une sèche un peu
    // marquée, les deux tombaient sous le plancher, et _relevePlancher les
    // remontait toutes les deux à la MÊME valeur : deux colonnes identiques,
    // un cycle annoncé qui n'existait plus, et rien à l'écran pour le dire.
    //
    // On relève donc la journée BASSE, et on reporte le même nombre de grammes
    // sur la haute. L'écart voulu — deux fois CYCLE_GLUC des glucides de base —
    // est conservé exactement, aucune journée ne passe sous le plancher, et le
    // supplément est le même des deux côtés. Le total servi monte d'autant,
    // mais c'est déjà ce que la ligne « kcal servies » annonce, et le
    // commentaire de deltaServi juste en dessous le dit depuis toujours.
    const gOn=_cg.gOn, gOff=_cg.gOff;
    const offRel=_relevePlancher(_bloc(r.p,r.l,gOff),user,_appl);
    const lift=offRel.g-gOff;                 // 0 quand le plancher ne mord pas
    off=offRel;
    on=_relevePlancher(_bloc(r.p,r.l,gOn+lift),user,_appl);
  }
  // La vitesse ANNONCÉE est celle que produit le total RÉELLEMENT servi — pas
  // celle visée, pas même celle retenue après plafond. Quand le plancher relève
  // les journées de 290 kcal, annoncer −0,55 % pendant qu'on en sert −0,33 %
  // serait un mensonge à l'athlète. Le défaut existait déjà ; ce lot fait
  // baisser les dépenses, donc mordre le plancher bien plus souvent, et il
  // aurait multiplié l'écart par dix.
  // La moyenne de la SEMAINE : nOn jours ON, nOff jours OFF.
  const deltaServi=(cycle?Math.round((_cg.nOn*on.kcal+_cg.nOff*off.kcal)/7):on.kcal)-depense;
  // La LIGNE dépend de l'intention (deltaRetenu), ses CHIFFRES du total servi.
  // Sans phase déclarée l'intention est nulle, et l'arrondi du bloc suffisait à
  // faire apparaître un « surplus de 1 kcal » qui ne veut rien dire.
  if(deltaRetenu!==0&&deltaServi===0){
    hypotheses.push('le plancher ramène le total au niveau de la dépense : aucune vitesse de poids visée');
  } else if(deltaRetenu!==0){
    const pctReel=poids>0?(deltaServi*7)/(poids*KCAL_PAR_KG_CORPS)*100:0;
    hypotheses.push((deltaServi<0?'déficit':'surplus')+' de '+Math.abs(deltaServi)
      +' kcal par jour, visant '+(pctReel>0?'+':'')
      +String(Math.round(pctReel*100)/100).replace('.',',')
      +' % de poids par semaine');
  }
  hypotheses.push(cycle
    ?'glucides +'+_cg.pctOn+' % les jours d\'entraînement ('+_cg.nOn+'), −'+_cg.pctOff
      +' % les jours de repos ('+_cg.nOff+') : la semaine garde la cible'
    :(o.cycle!==false&&!_cg.cycle
      ?(_cg.nOn>=7?'sept créneaux sur sept':'aucun créneau actif')+' : pas de cycle, même total tous les jours'
      :'même total tous les jours'));
  // delta reste le delta de CIBLE, avant plancher : c'est lui qui décide si
  // l'athlète pose un déficit d'un clic, et le garde-fou TCA s'y adosse.
  // Le remplacer par deltaServi ouvrirait ce chemin dès que le plancher
  // ramène la journée au niveau de la dépense.
  // La moyenne de la SEMAINE servie (nOn jours ON, nOff jours OFF), non arrondie.
  return {moyenne:cycle?(_cg.nOn*on.kcal+_cg.nOff*off.kcal)/7:on.kcal,nOn:_cg.nOn,nOff:_cg.nOff,
    poidsRef:_pm.kg,poidsRefObj:_pm,glucidesBas:r.glucidesBas,depasse:r.depasse,source,on,off,act,depense,mb,gParKg,modele,cycle,delta:deltaRetenu,
    poids,deltaServi,hypotheses};
}
// ── Réglages de la proposition, côté coach ─────────────────────────────────
// Ils vivent en mémoire, PAS dans le dossier de l'athlète : ce sont les
// curseurs du calcul, pas une donnée de suivi. Rien n'est enregistré tant que
// le coach n'a pas cliqué sur son bouton habituel.
let _propProt=null;      // null = valeur suggérée par la phase
let _propLip=null;       // null = valeur suggérée par le dossier
// null = « suis le reglage ecrit dans le dossier ». Cette variable ne servait
// qu'a la proposition de point de depart, et donnait un SECOND selecteur pour
// la meme question que celui de la fiche — deux controles qui pouvaient se
// contredire a l'ecran. Le selecteur de la proposition a ete retire ; il ne
// reste que celui qui ecrit, et la proposition le suit.
let _propCycle=null;
function _propReglages(){
  // LA MEMOIRE D'ABORD, LE DOSSIER ENSUITE. Les curseurs de la session priment —
  // le coach est en train de les manipuler — mais a l'ouverture ils valent null,
  // et c'est le dossier qui doit repondre. Sans ce repli, un calcul dit
  // « automatique » aurait change tout seul d'un rechargement a l'autre : les
  // reglages retombaient sur les valeurs suggerees.
  const _c=(()=>{ try{ return getOwnedClient(currentClientId); }catch(e){ return null; } })();
  const _r=reglagesCalcul(_c);
  const p=(typeof _propProt==='number')?_propProt:_r.prot;
  const l=(typeof _propLip==='number')?_propLip:_r.lip;
  return {protGparKg:(typeof p==='number')?p:undefined,
    lipGparKg:(typeof l==='number')?l:undefined,
    // La correction du metabolisme n'a plus de curseur non plus — elle vivait
    // dans le meme bloc. besoinsProposes retombe sur correctionMB(user), qui
    // LIT LE DOSSIER : une correction deja enregistree continue de s'appliquer.
    correctionMB:undefined,
    cycle:(_propCycle===null)
      ?(()=>{ try{ return dieteCyclee(getOwnedClient(currentClientId)); }catch(e){ return true; } })()
      :_propCycle,
    // ⚠ `vitesse` N'EST PLUS PASSEE DEPUIS LE 08/09/2026, ET C'EST LE COEUR
    // DU CORRECTIF. besoinsProposes porte deux chemins : avec une vitesse,
    // « depense + delta » ; sans, « depense x coefficient d'objectif » — celui
    // des tableaux du coach. Cette ligne en passait TOUJOURS une, le curseur
    // ou le milieu de la fourchette a defaut : le chemin du coefficient
    // n'etait jamais pris, et l'ecran de la fiche annoncait un total que le
    // dossier ne recevait pas.
    // LA CLEF EST OMISE, pas mise a null : besoinsProposes teste
    // `o.vitesse!==undefined&&o.vitesse!==null` — les deux marchent, mais une
    // clef absente dit mieux « il n'y a pas de vitesse a considerer ».
    // Un `nutrition.reglages.vitesse` deja enregistre n'est PAS efface : on ne
    // reecrit pas les dossiers, on cesse simplement de le lire.
    _sansVitesse:true};
}

// ══════════════ VITESSE VISÉE : LE COACH CHOISIT DANS LA FOURCHETTE ═══════
// Le point de départ visait systématiquement le MILIEU de la fourchette. Le
// coach peut désormais choisir où se placer dedans — jamais en dehors.
//
// LE NOM. `cibleVitesse` était déjà pris : elle reçoit le DOSSIER et rend la
// fourchette d'ALERTE effective, elle est appelée 70 fois dont 64 en
// assertions. La redéfinir aurait remplacé la fonction à l'exécution et fait
// tomber tout le module d'alerte de poids. D'où `cibleVitesseChoisie`, voisine
// explicite de `cibleVitesseMilieu`, dont elle prend la place.
//
// LA BORNE EST LA FOURCHETTE EFFECTIVE, pas PHASES brut. cibleVitesse(user)
// REMPLACE la fourchette sous grossesse et sous pause — elle y devient celle
// du maintien — et l'ÉLARGIT sous SOPK ou ménopause. Borner sur PHASES aurait
// autorisé −1,0 %/semaine chez une femme enceinte encore marquée en sèche,
// alors que le produit a précisément décidé le contraire.
const PROP_VITESSE_PAS=0.05;
let _propVitesse=null;   // null = milieu de la fourchette. JAMAIS persisté.
let _propVitessePhase=null;  // la phase pour laquelle le curseur a été posé

// PURE. La fourchette dans laquelle le curseur a le droit de vivre, ou null
// quand il n'y a pas de phase — sans phase, le delta reste nul (règle 6) et le
// curseur n'a rien à border.
//
// RÈGLE 5 : sous antécédent de trouble alimentaire OU drapeau rouge actif, la
// borne CÔTÉ DÉFICIT est ramenée au milieu. Le coach garde la main pour
// ralentir, jamais pour accélérer. C'est la doctrine constante du produit :
// aTCA coupe déjà onze chemins ailleurs.
function bornesVitesseChoisie(user){
  let f=null;
  try{ f=cibleVitesse(user); }catch(e){ f=null; }
  if(!f||f.phase==null||typeof f.min!=='number'||typeof f.max!=='number') return null;
  let min=f.min, max=f.max;
  const milieu=(min+max)/2;
  let bride=false, grossesse=false;
  try{ if(aTCA(user)) bride=true; }catch(e){}
  try{ if(drapeauRougeActif(user)) bride=true; }catch(e){}
  // AJOUT AU-DELA DE LA REGLE 5, assume. cibleVitesse ne neutralise que les
  // ALERTES sous grossesse : elle conserve la fourchette de la phase, et une
  // sechee declaree resterait donc reglable a -1,0 %/semaine. Or le produit
  // dit ailleurs, mot pour mot : « Pas d'objectif de perte de poids pendant
  // cette periode. » Le cote deficit est donc FERME, pas ramene au milieu.
  try{ if(typeof grossesseSuspend==='function'&&grossesseSuspend(user)) grossesse=true; }catch(e){}
  if(grossesse){
    if(min<0) min=0;
    if(max<0) max=0;
  }
  if(bride){
    // Le côté « déficit » est le côté NÉGATIF, quelle que soit la phase : en
    // sèche c'est min (−1,0), en prise de masse il n'y a pas de déficit à
    // brider. On remonte donc la borne basse au milieu quand elle est
    // négative, et on ne touche à rien sinon.
    if(min<0) min=Math.min(milieu,0);
    if(max<0) max=Math.min(max,0);
  }
  return {min:Math.min(min,max),max:Math.max(min,max),milieu:(f.min+f.max)/2,
    phase:f.phase,bride:bride||grossesse,pause:!!f.pause,grossesse:grossesse||!!f.grossesse};
}
// PURE. La vitesse retenue. `override` null, absent, ou illisible ⇒ le MILIEU,
// c'est-à-dire le comportement d'avant ce lot à la kilocalorie près.
//
// RÈGLE 1 : la valeur est TOUJOURS ramenée dans la fourchette, même demandée
// explicitement. Un coach qui tape −5 obtient la borne, pas −5.
function cibleVitesseChoisie(phase,override,user){
  const milieu=cibleVitesseMilieu(phase);
  if(override==null) return milieu;
  const v=parseFloat(String(override).replace(',','.'));
  if(!isFinite(v)) return milieu;
  // Sans dossier, on borne sur PHASES : c'est le seul repère disponible, et il
  // reste plus strict que pas de borne du tout.
  const p=phase&&PHASES[phase];
  let min,max;
  const b=user?bornesVitesseChoisie(user):null;
  if(b&&b.phase===phase){ min=b.min; max=b.max; }
  else if(p&&typeof p.min==='number'){ min=Math.min(p.min,p.max); max=Math.max(p.min,p.max); }
  else return milieu;
  return Math.max(min,Math.min(max,v));
}
// ÉCRIT EN MÉMOIRE SEULEMENT. Rien n'atteint le document `user` : c'est un
// curseur de calcul, pas une donnée de suivi — comme _propProt.
// ⚠ setPropVitesse ET _propVitesseCourante ONT ETE RETIREES avec le curseur
// qu'elles servaient. _propVitesse et _propVitessePhase restent declarees et
// remises a null par la reinitialisation : ce sont deux variables de session
// que plus rien ne pose, et les effacer demanderait de toucher a la fonction
// qui remet TOUS les curseurs a zero pour un gain nul.
// RÈGLE 2 : un changement de phase remet le curseur au milieu. Une vitesse
// choisie pour une sèche n'a aucun sens sur une prise de masse, et la laisser
// active serait pire que la réinitialiser.

// ── Le curseur, côté coach ────────────────────────────────────────────────
// MASQUÉ sans phase déclarée : sans phase le delta reste nul, et un curseur
// qui ne pilote rien est un piège. Rien n'est ajouté au dossier de l'athlète,
// et l'écran athlète ne change pas d'un pixel.
// ⚠ _htmlVitesseCoach A ETE RETIREE le 08/09/2026 avec le curseur de vitesse
// visee : il pilotait un SECOND moteur de calcul, concurrent du coefficient
// d'objectif des tableaux. Voir le commentaire dans _htmlTableauxTableur.
// Le suivi de la vitesse a la balance, lui, n'est pas touche : c'est
// cibleVitesse, une autre fonction, et elle reste.
// Valeur SUGGÉRÉE, jamais imposée : le coach voit une proposition et tranche.
// Elle ne dépend plus d'aucun état de santé — voir REGLES_ETAT_VALEUR et la
// garde qui l'accompagne juste en dessous.
function lipSuggere(user){
  return LIP_G_PAR_KG;
}

// ══════ AUCUNE CIBLE CHIFFRÉE NE DÉPEND D'UN DIAGNOSTIC ═══════════════════
// Le produit portait une règle qui contredisait sa propre doctrine : sous SOPK
// « diagnostiqué par un médecin », les lipides passaient à 1,2 g/kg. RepCore
// suspend, élargit, renvoie — il ne prescrit pas. Et la guideline
// internationale (Teede et al., J Clin Endocrinol Metab 2023;108(10):2447)
// conclut qu'AUCUNE répartition de macronutriments n'a démontré de supériorité
// dans le SOPK. La règle affirmait donc quelque chose de faux, avec l'autorité
// d'un chiffre.
//
// CE QUI EST RETIRÉ : l'automatisme. CE QUI RESTE : la liberté du coach de
// fixer 1,2 g/kg à la main — l'échelle des lipides ne bouge pas.
//
// LA TABLE ci-dessous recense TOUTES les règles liant une valeur numérique à
// un état de santé déclaré, y compris celles qu'on garde. Une règle qu'on ne
// nomme pas est une règle qu'on ne peut pas garder honnête.
//
//   diagnostic : l'état figure dans ETATS_DECLARABLES, dont chaque libellé
//                porte « diagnostiqué par un médecin » (un test l'exige).
//   nature     : 'cible' fixe une valeur · 'elargissement' ouvre une
//                fourchette ou une échelle · 'suspension' coupe un objectif ·
//                'correction_mb' déplace le métabolisme estimé.
const REGLES_ETAT_VALEUR=Object.freeze([
  Object.freeze({etat:'sopk',      diagnostic:true,  nature:'elargissement',
    quoi:'fourchette de vitesse de sèche', ref:'SOPK_CIBLE_SECHE'}),
  Object.freeze({etat:'thyroide',  diagnostic:true,  nature:'correction_mb',
    quoi:'correction du métabolisme suggérée', ref:'correctionMBSuggeree'}),
  Object.freeze({etat:'menopause', diagnostic:false, nature:'cible',
    quoi:'bonus de protéines suggéré', ref:'PROT_BONUS_MENOPAUSE'}),
  Object.freeze({etat:'menopause', diagnostic:false, nature:'elargissement',
    quoi:'plancher de l\'échelle protéique', ref:'PROT_MIN_MENOPAUSE'}),
  Object.freeze({etat:'menopause', diagnostic:false, nature:'elargissement',
    quoi:'fourchette de vitesse de sèche', ref:'MENO_CIBLE_SECHE'}),
  Object.freeze({etat:'menopause', diagnostic:false, nature:'cible',
    quoi:'plancher protéique par prise', ref:'PROT_PLANCHER_PRISE_RELEVE'}),
  Object.freeze({etat:'pes',       diagnostic:false, nature:'elargissement',
    quoi:'plafond de l\'échelle protéique', ref:'PROT_ECHELLE_PES'}),
  Object.freeze({etat:'grossesse', diagnostic:false, nature:'suspension',
    quoi:'objectif de perte et alertes', ref:'grossesseSuspend'}),
  Object.freeze({etat:'tca',       diagnostic:false, nature:'suspension',
    quoi:'majoration du plancher calorique', ref:'PLANCHER_MAJORATION_TCA'})
]);
// LA GARDE. Elle échoue si une CIBLE de macronutriment est conditionnée à un
// DIAGNOSTIC. Les deux mots comptent :
//
// — « diagnostic » exclut la ménopause, qui est une étape de vie et non une
//   entrée d'ETATS_DECLARABLES. Son bonus protéique reste une cible et il est
//   inscrit comme telle dans la table : la garde ne le couvre pas, elle ne le
//   cache pas non plus.
// — « macronutriment » exclut la correction métabolique thyroïdienne, qui est
//   liée à un diagnostic mais ne fixe aucune macro. Elle repose d'ailleurs sur
//   un fait d'une autre nature : un métabolisme abaissé sous hypothyroïdie non
//   traitée se mesure, alors que la supériorité d'une répartition dans le SOPK
//   ne s'est jamais démontrée. Le jour où quelqu'un voudra la retirer, ce sera
//   une décision produit distincte, avec ses propres sources.
function assertNoDiagnosisBoundNumericTarget(){
  const fautes=REGLES_ETAT_VALEUR.filter(r=>r.diagnostic&&r.nature==='cible');
  return {ok:fautes.length===0,
    fautes:fautes.map(r=>r.etat+' → '+r.quoi+' ('+r.ref+')')};
}
// La note qui remplace le chiffre. Elle cite sa source et son année, et ne
// porte AUCUNE valeur : c'est tout l'objet du lot.
const SOPK_NOTE_LIPIDES='Aucune répartition de macronutriments n\'a démontré '
  +'de supériorité dans le SOPK (guideline internationale 2023). Adapte selon '
  +'la tolérance de l\'athlète et l\'avis du praticien qui la suit.';
// ── Migration : rien ne change en silence ────────────────────────────────
// Le g/kg de lipides n'a JAMAIS été persisté — _propLip vit en mémoire et le
// dossier ne garde que les grammes. Il n'existe donc aucun plan « portant
// 1,2 g/kg » à repérer : ce qui existe, c'est un plan dont les lipides VALENT
// 1,2 × poids. La détection est donc une présomption, et le bandeau est écrit
// pour rester vrai dans les deux cas — règle automatique retirée, ou valeur
// choisie par le coach, qui reste libre de la choisir encore.
const SOPK_MIGRATION_TITRE='Règle de lipides retirée';
const SOPK_MIGRATION_TEXTE='La suggestion automatique de lipides sous SOPK a '
  +'été retirée : aucune répartition n\'a démontré de supériorité. Au prochain '
  +'recalcul, la suggestion revient au standard. Le plan enregistré n\'a pas '
  +'été modifié, et si tu avais fixé cette valeur toi-même, rien ne t\'empêche '
  +'de la reprendre.';
const SOPK_LIP_ANCIENNE_REGLE=1.2;
// PURE. Le plan de cette athlète ressemble-t-il à ce que produisait la règle ?
// Tolérance d'un gramme : les grammes sont arrondis, et un poids relevé après
// coup décale légèrement le produit.
function planSousAncienneRegleSopk(c){
  if(!c||!sopkApplicable(c)) return false;
  const m=((c.nutrition||{}).macros)||{};
  const l=Number((m.on&&m.on.l));
  if(!isFinite(l)||!(l>0)) return false;
  let poids=null;
  try{ poids=_planPoids(c); }catch(e){ poids=null; }
  if(!(poids>0)) return false;
  const ancien=Math.round(SOPK_LIP_ANCIENNE_REGLE*poids);
  const standard=Math.round(LIP_G_PAR_KG*poids);
  // Si les deux coïncident, il n'y a rien à annoncer : la valeur ne bougera pas.
  if(ancien===standard) return false;
  return Math.abs(l-ancien)<=1;
}
function migrationSopkVue(c){
  return !!(((c||{}).migrations||{}).sopkLipidRuleRemoved);
}
function migrationSopkADire(c){
  return planSousAncienneRegleSopk(c)&&!migrationSopkVue(c);
}
function _htmlMigrationSopk(c){
  if(!migrationSopkADire(c)) return '';
  return `<div style="background:var(--surface-1);border:1px solid var(--warning-border);border-radius:var(--r-3);padding:14px;margin-bottom:12px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:8px">${escapeHtml(SOPK_MIGRATION_TITRE)}</div>
    <div style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.7">${escapeHtml(SOPK_MIGRATION_TEXTE)}</div>
    <button onclick="accuserMigrationSopk()" class="btn btn-outline btn-sm" style="width:100%;margin:10px 0 0;font-size:var(--fs-2xs);letter-spacing:1px">J'ai compris</button>
  </div>`;
}
// ÉCRIT, et seulement sur un clic : l'indicateur est posé par le coach, pas
// par un rendu. Un bandeau qui s'efface tout seul au premier affichage
// disparaîtrait le jour où la fiche s'ouvre par accident.
function accuserMigrationSopk(){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c||!c.email) return false;
  if(!c.migrations||typeof c.migrations!=='object') c.migrations={};
  c.migrations.sopkLipidRuleRemoved=true;
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(c.email,c),'Noté','la note est');
  try{ renderCoachNutriSection(c); }catch(e){}
  return true;
}
const SOPK_RENVOI_ATHLETE='Tu as déclaré un SOPK. RepCore adapte ses repères, '
  +'mais il ne remplace pas le suivi médical qui va avec.';
function _htmlSopkAthlete(user){
  return sopkApplicable(user||currentUser)
    ?`<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6;margin-bottom:12px">${escapeHtml(SOPK_RENVOI_ATHLETE)}</div>`
    :'';
}
// `muet` : poser la valeur SANS repeindre. Depuis le 08/09/2026, le seul
// selecteur de g/kg vit dans le tableau des macros, et majTableauTableur
// repeint deja une fois pour tout le monde — repeindre ici en plus ferait
// deux rendus complets de la section a chaque cran du menu.
function _propSetProt(v,muet){
  const n=parseFloat(v);
  _propProt=isFinite(n)?n:null;
  if(muet) return;
  const c=getOwnedClient(currentClientId);
  if(c) renderCoachNutriSection(c);
}
let _propCorr=null;      // null = valeur suggérée par le dossier
// ⚠ _propSetCorr A ETE RETIREE avec le menu de correction du metabolisme.
// correctionMB(user) lit toujours le dossier : une correction enregistree
// continue de s'appliquer, elle ne se regle simplement plus depuis cet ecran.
function _propSetLip(v,muet){
  const n=parseFloat(v);
  _propLip=isFinite(n)?n:null;
  if(muet) return;
  const c=getOwnedClient(currentClientId);
  if(c) renderCoachNutriSection(c);
}
function _propSetCycle(v){
  _propCycle=(String(v)==='1');
  const c=getOwnedClient(currentClientId);
  if(c) renderCoachNutriSection(c);
}
// Le bloc de commande + la ligne d'hypothèses. Rendu vide quand la proposition
// est impossible : pas de bouton qui ne mènerait à rien.
// N2.5 — SIX APPELS A besoinsProposes N'ETAIENT PAS PROTEGES, alors que les
// six autres du fichier le sont. Deux d'entre eux sont interpoles directement
// dans le innerHTML du panneau nutrition : une exception y laissait TOUT le
// panneau vide, sans un mot. Le risque est reel — besoinsProposes traverse
// kcalSportParJour et facteurNEAT, qui appellent .filter sur sessions_config,
// et Firebase rend ce tableau sous forme d'objet des qu'un creneau manque.
//
// ON NE MASQUE PAS L'ERREUR : _besoinsSurs rend null, et chaque appelant dit
// au coach que le point de depart n'a pas pu etre calcule. Un panneau vide ne
// lui apprend rien ; une phrase, si.
function _besoinsSurs(c){
  try{ const b=besoinsProposes(c,_propReglages()); return b||null; }
  catch(e){ try{ console.error('besoinsProposes',e); }catch(err){} return null; }
}
const BESOINS_ECHEC='Le point de départ n’a pas pu être calculé sur ce dossier. '
  +'Ses données de base sont peut-être incomplètes, ou sa configuration de '
  +'séances est revenue du serveur sous une forme inattendue. Les cibles déjà '
  +'enregistrées, elles, restent intactes.';
function _htmlBesoinsEchec(){
  return `<div style="background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:var(--r-2);padding:10px 12px;font-size:var(--fs-2xs);color:var(--orange);line-height:1.55;margin-bottom:10px">${escapeHtml(BESOINS_ECHEC)}</div>`;
}
// N2.20 — LE SELECTEUR AFFICHE TOUJOURS LA VALEUR QUE LE CALCUL UTILISE.
// L'etendue de l'echelle des proteines depend de DECLARATIONS DE L'ATHLETE —
// PES, menopause. Si l'une est retiree apres que le coach a enregistre un g/kg
// qui n'appartenait qu'a l'echelle elargie, aucune option n'etait marquee
// selected : le navigateur affichait la PREMIERE de la liste pendant que
// besoinsProposes continuait de calculer sur la valeur enregistree. Le coach
// lisait donc un g/kg de proteines qui n'etait pas celui applique.
//
// La valeur hors echelle est AJOUTEE et signalee, jamais masquee : la masquer
// etait exactement le probleme. protEchelle et protSuggeree ne changent pas.
function _optionsEchelle(echelle,courant,suffixe,suggere){
  const liste=(echelle||[]).slice();
  const hors=(typeof courant==='number')&&liste.indexOf(courant)<0;
  if(hors){
    liste.push(courant);
    // Meme sens de tri que les echelles du fichier : du plus haut au plus bas.
    liste.sort((a,b)=>b-a);
  }
  return liste.map(v=>{
    const nb=String(v).replace('.',',');
    const marque=(v===courant&&hors)?' · hors échelle'
      :((v===suggere)?' · suggéré':'');
    return `<option value="${v}"${courant===v?' selected':''}>${nb}${suffixe}${marque}</option>`;
  }).join('');
}
// ⚠ _htmlDepartCoach A ETE RETIREE le 08/09/2026. Elle avait perdu ses deux
// menus de g/kg (partis dans le tableau des macros), puis son curseur de
// vitesse et son menu de correction du metabolisme — tous deux reglaient un
// SECOND moteur, concurrent du coefficient d'objectif des tableaux. Il ne
// restait qu'une phrase qui decrivait une grille elle-meme retiree.
// _htmlMigrationSopk, dont c'etait le seul point d'affichage, est rendue
// directement par le bloc « Regler les objectifs ».
// _htmlBesoinsEchec n'a plus d'appelant : les tableaux disent deja « Calcul
// impossible : il manque … », avec la liste de ce qui manque.
// ⚠ _htmlDepartHypotheses A ETE RETIREE le 08/09/2026. C'etait le paragraphe
// que Kevin a pointe : « Mifflin-St Jeor · 2 222 kcal au repos · dépense
// estimée 3 711 kcal … déficit de 558 kcal par jour, visant −0,5 % de poids par
// semaine ». Il disait en dix lignes ce que les tableaux « Facteurs » et
// « Besoins caloriques » disent maintenant ligne par ligne, chacune avec sa
// source ET son menu de reglage. Deux expressions du meme calcul, dont une
// qu'on ne pouvait pas corriger — et c'est toujours celle-la qui derive.
// Elle n'avait qu'un appelant, le panneau du coach.
// PRÉ-REMPLIT les champs et rien d'autre. Aucune écriture, aucun push : le
// coach relit, corrige, puis clique sur « Enregistrer » comme d'habitude.
// ══════ CALCUL AUTOMATIQUE DES CIBLES, ET SAISIE MANUELLE EN SECOURS ══════
// Demande de Kevin, 25/08/2026 : « ça doit être calculé en automatique et
// s'ajuster selon les modifications au niveau objectifs nutritionnels ; mettre
// en dessous un bouton on/off pour le manuel ».
//
// PAR DÉFAUT, AUTOMATIQUE. Les dix champs se remplissent depuis
// besoinsProposes et se recalculent à chaque changement de protéines, de
// lipides, de correction du métabolisme ou de vitesse visée. Le coach qui veut
// poser ses propres chiffres lève l'interrupteur.
//
// LE DÉFAUT DÉPEND DE CE QUE PORTE DÉJÀ LE DOSSIER, et ce n'est pas un
// caprice. Kevin veut l'automatique par défaut, et c'est ce que reçoit tout
// athlète dont les cibles ne sont pas encore posées.
//
// MAIS UN DOSSIER QUI PORTE DÉJÀ DES GRAMMES PORTE UNE PRESCRIPTION. Ces
// chiffres ont été saisis et relus par un coach, parfois ajustés séance après
// séance. Les passer d'office en automatique aurait affiché le calcul à la
// place, et le premier enregistrement — fait pour une tout autre raison —
// aurait remplacé la diète de l'athlète sans que personne ne l'ait demandé.
// Ces dossiers-là démarrent donc en manuel, et le coach bascule quand il veut.
//
// Une fois le champ écrit, il fait foi : ce repli ne sert qu'aux dossiers qui
// n'ont jamais vu cet interrupteur.
function saisieManuelle(user){
  const n=(user&&user.nutrition)||{};
  if(typeof n.manuel==='boolean') return n.manuel;
  const m=n.macros||{};
  // ⚠ DES GRAMMES ECRITS PAR LE CALCUL NE SONT PAS DES GRAMMES TAPES A LA
  //   MAIN, et les confondre retournait l'interrupteur tout seul. MESURE FAITE
  //   dans un navigateur, sur un dossier neuf sans drapeau : le coach clique
  //   « Enregistrer pour l'athlète », les grammes arrivent, et au rendu suivant
  //   `saisieManuelle` rend VRAI parce que le dossier « porte des grammes ».
  //   La case « Saisie manuelle » se cochait d'elle-meme, dix champs de saisie
  //   apparaissaient, et les menus de g/kg cessaient de recalculer — alors que
  //   le coach n'avait jamais rien tape.
  //
  //   `origine:'tableur'` EST ECRIT PAR LE CALCULATEUR, ET PAR LUI SEUL. Le
  //   choix de cette valeur-la et d'aucune autre est deliberee : les grammes
  //   tapes par un coach partent en `'coach'`, ceux de l'athlete en
  //   `'athlete'`, et les dossiers d'avant les origines n'en portent aucune —
  //   tous continuent de tomber dans le repli ci-dessous, exactement comme
  //   avant.
  //   `'histo'` — une cible remise en place depuis l'historique (build 1408) —
  //   se lit comme elle : ce sont des grammes deja calcules, remis en place,
  //   pas des grammes tapes. Sans cette ligne, un dossier en automatique
  //   basculait en saisie manuelle des qu'on remettait une ancienne cible.
  if(m.origine==='tableur'||m.origine==='histo') return false;
  const pose=o=>!!(o&&(Number(o.kcal)>0||Number(o.p)>0||Number(o.g)>0||Number(o.l)>0));
  return pose(m.on)||pose(m.off);
}
// ══════ LES RÉGLAGES DE CALCUL, ÉCRITS DANS LE DOSSIER ════════════════════
// SANS EUX, L'AUTOMATIQUE N'AURAIT RIEN D'AUTOMATIQUE. _propProt, _propLip et
// _propVitesse vivent en mémoire : à la prochaine ouverture — ou sur un autre
// appareil — ils repartent à null, la proposition retombe sur les valeurs
// suggérées, et les cibles de l'athlète changeraient toutes seules sans que
// personne n'ait rien touché. Le commentaire de SOPK_MIGRATION le constate
// déjà : « le g/kg de lipides n'a JAMAIS été persisté ».
//
// correctionMB fait exception : elle a déjà son champ dans le dossier
// (user.correctionMB), et on ne la déplace pas.
function reglagesCalcul(user){
  const r=(user&&user.nutrition&&user.nutrition.reglages)||{};
  const n=v=>{ const x=Number(v); return isFinite(x)?x:undefined; };
  return {prot:n(r.prot),lip:n(r.lip),vitesse:(r.vitesse==null?undefined:n(r.vitesse))};
}
// Écrit ce qui a servi au calcul. Appelé au MÊME moment que les grammes : les
// deux décrivent la même décision, et les séparer ferait un dossier dont les
// cibles ne correspondent plus à ses propres réglages.
function _poserReglagesCalcul(c){
  if(!c) return;
  if(!c.nutrition) c.nutrition={};
  const o=_propReglages();
  const r=c.nutrition.reglages||{};
  if(typeof o.protGparKg==='number') r.prot=o.protGparKg;
  if(typeof o.lipGparKg==='number')  r.lip=o.lipGparKg;
  if(o.vitesse!=null&&isFinite(o.vitesse)) r.vitesse=o.vitesse;
  c.nutrition.reglages=r;
  // La correction du métabolisme garde son champ historique.
  if(typeof o.correctionMB==='number') c.correctionMB=o.correctionMB;
}
function saveClientNutriManuel(v){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  if(!c.nutrition) c.nutrition={};
  const manuel=!!v;
  c.nutrition.manuel=manuel;
  // EN REPASSANT EN AUTOMATIQUE, LES CIBLES SONT RECALCULÉES ET ÉCRITES tout
  // de suite. Les laisser telles quelles afficherait des chiffres calculés à
  // l'écran pendant que l'athlète en garderait d'autres — l'écran du coach
  // dirait une chose, le journal de son élève une autre.
  if(!manuel){
    const b=_besoinsSurs(c);
    if(b&&b.source!==null){
      const cyc=dieteCyclee(c);
      const saisie={on:Object.assign({},b.on),
                    off:cyc?Object.assign({},b.off):Object.assign({},b.on)};
      // N2.15 — LE MEME CONTROLE QUE LE BOUTON D'ENREGISTREMENT.
      // Cette ecriture est une PRESCRIPTION : elle pose les cibles que
      // l'athlete va suivre. Elle passait pourtant a cote de controlerMacros
      // et de la trace de confirmation qu'exige saveClientNutriMacros. C'est
      // aujourd'hui sans consequence — le chemin automatique releve deja les
      // journees au plancher par _relevePlancher — mais un changement de
      // repartition ouvrirait la breche sans qu'aucun test ne le voie.
      //
      // AUCUNE VIOLATION : la bascule reste immediate, exactement comme avant.
      // UNE VIOLATION : le MODE bascule quand meme — c'est un mode
      // d'affichage — mais AUCUNE cible n'est ecrite sans le geste explicite
      // du bouton, et la section « Ce que voit ton athlete » montrera l'ecart.
      // ⚠ LE CHEMIN AUTOMATIQUE ECRIT AUSSI, MAINTENANT (24/09/2026). Il
      //   refusait d'ecrire des cibles sous le plancher, sans derogation.
      //   Depuis que le plancher ne corrige plus, un calcul peut legitimement
      //   descendre dessous : refuser ici aurait laisse la bascule sans effet
      //   et le coach sans cibles, sans qu'il comprenne pourquoi.
      const viol=controlerMacros(saisie,c);
      c.nutrition.macros=Object.assign({},c.nutrition.macros,
        Object.assign({},saisie,{origine:'auto',origineDate:Date.now()}));
      _histoNoter(c,'auto');
      _poserReglagesCalcul(c);
      if(viol.length){
        const pl=plancherEffectif(c);
        window._plDerniereViol={email:c.email,liste:viol};
        try{ toast((pl.tca||pl.deficit)
          ?'Le calcul passe sous le plancher, et un antécédent est déclaré : cibles écrites quand même'
          :'Le calcul passe sous le plancher : cibles écrites',
          'var(--red)'); }catch(e){}
      }
    }
  }
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(c.email,c),
    manuel?'Saisie manuelle activée '+ICO.coche:'Calcul automatique rétabli '+ICO.coche,'le réglage est');
  renderCoachNutriSection(c);
  return true;
}
// L'interrupteur, sous la grille. Même habillage que celui de l'accès à la
// diète stricte : c'est le même geste, et deux dessins pour un même
// interrupteur se liraient comme deux mécanismes différents.
// N2.22 — D'OU VIENNENT LES CIBLES EN COURS.
// nutrition.macros.origine est ecrit a trois endroits — 'auto' et 'coach' par
// saveClientNutriMacros, 'ajustement' par appliquerAjustement — avec sa date,
// et AUCUN ecran ne le lisait. Le coach ne pouvait donc pas savoir que son
// athlete avait modifie ses propres cibles depuis son ecran d'ajustement.
// Rien de nouveau n'est ecrit : cette ligne LIT ce qui existe deja.
// ⚠ 'athlete' MANQUAIT A CETTE TABLE depuis que la carte « Mon objectif » du
// 14/09/2026 ecrit cette origine-la. Un libelle absent rend `dit` undefined,
// donc la ligne ENTIERE disparaissait : le coach dont l'athlete venait de
// remplacer ses cibles ne lisait plus rien du tout — pas meme la mention
// rassurante « saisies par toi » qu'il avait la veille. Le silence disait le
// contraire de ce qui s'etait passe.
const NUT_ORIGINE=Object.freeze({
  coach:'saisies par toi',
  auto:'calculées automatiquement',
  athlete:'réglées par ton athlète depuis son écran',
  ajustement:'issues d’un ajustement appliqué par ton athlète'});
function _htmlOrigineCibles(c){
  const m=((c&&c.nutrition)||{}).macros||{};
  const dit=NUT_ORIGINE[m.origine];
  if(!dit) return '';
  let quand='';
  if(m.origineDate>0){
    try{ quand=' le '+new Date(m.origineDate).toLocaleDateString('fr-FR',
      {day:'2-digit',month:'short',year:'numeric'}); }catch(e){}
  }
  // L'ajustement et la carte « Mon objectif » viennent tous deux de l'athlete :
  // ce sont les deux cas que le coach n'a pas decides lui-meme, et les deux
  // qu'il faut donc distinguer a l'oeil.
  const alerte=(m.origine==='ajustement'||m.origine==='athlete');
  return '<div style="margin-top:8px;font-size:var(--fs-2xs);line-height:1.55;color:'
    +(alerte?'var(--orange)':'var(--text-faint)')+'">'
    +'Cibles enregistrées '+dit+quand+'.</div>';
}
// ⚠ _htmlManuelCoach A ETE RETIREE le 08/09/2026. Son commutateur vit
// desormais dans la premiere ligne du tableau « Macronutriments » — la ou sont
// les valeurs qu'il ouvre a la frappe. Il etait pose au-dessus d'une SECONDE
// grille, elle-meme retiree : il deverrouillait des champs qui redisaient le
// tableau du dessus.

// ══════ DIÈTE CYCLÉE OU NON ═══════════════════════════════════════════════
// Demande de Kevin, 25/08/2026 : pouvoir régler une diète NON cyclée — les
// mêmes valeurs tous les jours — au lieu du couple jour ON / jour OFF.
//
// Le choix existait déjà, mais UNIQUEMENT dans la proposition de point de
// départ (_propCycle), en mémoire et jamais écrit : la grille de saisie
// affichait deux colonnes quoi qu'il arrive, et l'athlète voyait toujours un
// badge « JOUR OFF » les jours sans séance.
//
// LE MODÈLE DE DONNÉES NE CHANGE PAS, et c'est délibéré. Une diète non cyclée
// écrit les MÊMES valeurs dans `on` et dans `off`. Tout ce qui lit ces cibles
// — le journal, les anneaux, la diète stricte, les alertes, l'export — continue
// de fonctionner sans une ligne de changement, et un retour au cyclé ne
// demande aucune migration. Introduire une troisième forme (`macros.tous`)
// aurait obligé chacun de ces lecteurs à connaître les deux, et le premier
// oublié aurait servi des cibles vides.
//
// `!==false` : les dossiers existants, qui ne portent pas ce champ, restent
// cyclés. C'est le comportement d'avant, et personne ne doit voir sa diète
// changer parce qu'une version est passée.
function dieteCyclee(user){
  const n=user&&user.nutrition;
  return !(n&&n.cycle===false);
}
function saveClientNutriCycle(v){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  if(!c.nutrition) c.nutrition={};
  const cycle=(String(v)==='1');
  c.nutrition.cycle=cycle;
  // LES CIBLES SUIVENT IMMÉDIATEMENT. Basculer en non cyclé sans recopier ON
  // sur OFF laisserait l'athlète avec deux totaux différents alors que l'écran
  // du coach n'en montre plus qu'un — il croirait avoir réglé une chose, et
  // son élève en verrait une autre les jours de repos.
  //
  // ⚠ ET DANS L'AUTRE SENS, LA RECOPIE NE SUFFISAIT PAS. En ACTIVANT le
  //   cyclage, rien ne recalculait : le tableau « Journées » affichait deux
  //   colonnes ON/OFF pendant que le dossier de l'athlète gardait une seule
  //   valeur. En calcul automatique on repose donc les DEUX journées, par le
  //   même chemin que les menus au-dessus — un second calcul du cyclage aurait
  //   fini par donner deux répartitions pour le même réglage.
  const m=c.nutrition.macros;
  const jc=_tbEcrireCibles(c);
  if(!jc&&!cycle&&m&&m.on) m.off=Object.assign({},m.on);
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  // La proposition de point de départ suit le même réglage : deux sources pour
  // la même question finiraient par se contredire à l'écran.
  try{ _propCycle=cycle; }catch(e){}
  toastSync(ok,CLOUD.pushOne(c.email,c),
    cycle?'Diète cyclée '+ICO.coche:'Diète non cyclée : mêmes valeurs tous les jours '+ICO.coche,
    'le réglage est');
  renderCoachNutriSection(c);
  return true;
}
// ══════ REMETTRE LES CALCULS AU POINT DE DÉPART ═══════════════════════════
// Demande de Kevin : « si la personne lâche sa sèche ou sa PDM quelque temps ».
//
// CE N'EST PAS UNE SUPPRESSION. L'historique des phases, le journal
// alimentaire, les bilans et les pesées ne sont pas touchés : ce sont les
// données de l'athlète, et une remise à zéro qui les emporterait serait une
// perte, pas un redémarrage.
//
// Ce qui est remis à zéro, ce sont les trois choses qui décrivent une course
// en cours et qui deviennent fausses après un arrêt :
//   • les cibles, recalculées depuis le DERNIER bilan — c'est tout l'intérêt,
//     le poids a bougé pendant l'interruption ;
//   • le compteur de semaines, qui affichait « 4e semaine » d'une phase
//     abandonnée depuis un mois ;
//   • la pause et la transition en attente, qui parlent d'un déroulé fini.
function _resumeReinit(c){
  const b=_besoinsSurs(c);
  if(!b||b.source===null) return null;
  const sem=(()=>{ try{ return semainesPhase(c); }catch(e){ return null; } })();
  return {b,sem,pause:!!(c.phase&&c.phase.pause),
          transi:!!(c.phase&&c.phase.transition)};
}
async function reinitialiserCalculs(){
  const c0=getOwnedClient(currentClientId);
  if(!c0) return false;
  const r=_resumeReinit(c0);
  if(!r){ toast('Données de base incomplètes : rien à recalculer','var(--orange)'); return false; }
  const lignes=['Les cibles seront recalculées depuis son dernier bilan : '
    +r.b.on.kcal+' kcal'+(dieteCyclee(c0)?' les jours ON, '+r.b.off.kcal+' les jours OFF.':' tous les jours.')];
  if(r.sem>1) lignes.push('Le compteur de phase repart de la 1re semaine (il en est à la '
    +(r.sem)+'e).');
  if(r.pause) lignes.push('La pause en cours est levée.');
  if(r.transi) lignes.push('La transition proposée est annulée.');
  lignes.push('Son historique, son journal et ses bilans ne sont pas touchés.');
  const ok=await rcConfirm('Remettre les calculs au point de départ ?',
    lignes.join('\n\n'),'Remettre à zéro');
  if(!ok) return false;
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  const b=_besoinsSurs(c);
  if(!b||b.source===null){ toast('Données de base incomplètes','var(--orange)'); return false; }
  if(!c.nutrition) c.nutrition={};
  const cycle=dieteCyclee(c);
  // Non cyclée : le même total tous les jours, dans les deux colonnes.
  const on=Object.assign({},b.on), off=cycle?Object.assign({},b.off):Object.assign({},b.on);
  c.nutrition.macros=Object.assign({},c.nutrition.macros,
    {on,off,origine:'reinit',origineDate:Date.now()});
  if(c.phase){
    // LE DÉPART REPART D'AUJOURD'HUI, le type de phase ne change pas : c'est au
    // coach de dire s'il repasse en sèche ou en maintien, pas à ce bouton.
    c.phase.debut=Date.now();
    delete c.phase.pause;
    delete c.phase.transition;
  }
  c.updatedAt=Date.now(); users[c.email]=c;
  const ecrit=DB.set('users',users);
  try{ _viderCachePlateau(); _viderCacheSignaux(); }catch(e){}
  toastSync(ecrit,CLOUD.pushOne(c.email,c),'Calculs remis au point de départ '+ICO.coche,'la remise à zéro est');
  try{ renderCoachNutriSection(getOwnedClient(currentClientId)); }catch(e){}
  return true;
}

function proposerPointDepart(){
  const c=getOwnedClient(currentClientId);
  if(!c) return;
  const b=_besoinsSurs(c);
  if(!b||b.source===null){ toast('Données de base incomplètes','var(--orange)'); return; }
  // Le sucre n'est pas proposé : aucune cible de sucre ajouté ne sort du
  // calcul, et en inventer une sur un écran de santé serait pire que la
  // laisser vide. Le coach la remplit s'il le souhaite.
  // `if(el)` couvre deja le cas non cycle, ou le champ OFF n existe pas : on
  // remplit ce qui est a l ecran, et rien d autre.
  for(const [col,j] of [['on',b.on],['off',b.off]])
    for(const k of ['kcal','p','g','l','f']){
      const el=document.getElementById('ccd-'+col+'-'+k);
      if(el) el.value=j[k];
    }
  toast('Proposition remplie. Relis, puis enregistre.');
}

// Toute ouverture de fiche remet la confirmation a zero si elle ne vise pas
// CET athlete. Le simple fait de changer d'ecran ne doit jamais transporter
// un accord donne ailleurs.
// N2.1 — TOUS LES CURSEURS DE CALCUL, ET PLUS SEULEMENT LA CONFIRMATION.
// _propProt, _propLip, _propCorr, _propCycle et _propVitesse sont des
// variables de MODULE : elles survivaient au changement d'athlete. Le coach
// reglait les lipides de A sans enregistrer, ouvrait B, et voyait les cibles
// de B calculees avec le curseur de A — sur un ecran qui affiche des calories.
// Seule _plConfirme etait protegee.
let _ccdDernierAthlete=null;
function _plOublierSiAutreAthlete(email){
  if(_plConfirme&&_plConfirme.email!==email) _plConfirme=null;
  if(email!==undefined&&email!==_ccdDernierAthlete){
    _ccdDernierAthlete=email;
    // null = « suis le dossier ouvert ». _propReglages retombe alors sur
    // nutrition.reglages, puis sur la suggestion : jamais sur le precedent.
    _propProt=null; _propLip=null; _propCorr=null; _propCycle=null;
    _propVitesse=null; _propVitessePhase=null;
  }
}
// L'interrupteur d'accès, avec sous les yeux du coach CE QUE VOIT SON
// ATHLÈTE. Un interrupteur qui dit seulement « ouvert / fermé » laisse croire
// qu'il règle un détail ; celui-ci annonce l'écran d'en face.
function _htmlStrictAccesCoach(c){
  const a=accesDieteStricte(c);
  const ouvert=a.ok;
  const herite=(a.raison==='usage_existant');
  return `<div style="background:var(--dark);border:1px solid ${ouvert?'var(--border)':'var(--warning-border)'};border-radius:var(--r-3);padding:14px;margin-bottom:16px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div style="flex:1;min-width:0">
        <div style="font-size:var(--fs-sm);font-weight:700;color:var(--text)">Accès à la diète stricte</div>
        <div style="font-size:var(--fs-2xs);color:${ouvert?'var(--text-faint)':'var(--orange)'};line-height:1.55;margin-top:4px">${ouvert
          ?'Ton athlète voit son plan, ses sources et sa liste de courses.'
          :'Ton athlète voit un écran verrouillé. Il ne verra rien tant que tu n\'auras pas ouvert.'}</div>
      </div>
      <label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;cursor:pointer">
        <input type="checkbox" ${ouvert?'checked':''} onchange="saveClientStrictAcces(this.checked)" style="opacity:0;width:0;height:0;position:absolute">
        <span style="position:absolute;inset:0;background:${ouvert?'var(--success)':'var(--border)'};border-radius:var(--r-3);transition:background var(--t-2);pointer-events:none">
          <span style="position:absolute;top:3px;left:3px;width:18px;height:18px;background:#fff;border-radius:var(--r-full);transition:transform var(--t-2);transform:translateX(${ouvert?'20px':'0px'})"></span>
        </span>
      </label>
    </div>
    ${herite?`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:8px">Ouvert d'office : cet athlète suivait déjà une diète stricte avant que ce réglage existe.</div>`:''}
  </div>`;
}

// Résumé du plan sur la fiche client, et la porte d'entrée vers sa
// composition. Volontairement court : la fiche client porte déjà beaucoup, et
// tout ce qui se règle vraiment se règle sur l'écran dédié.
function _htmlPlanResumeCoach(c){
  const plan=planDe(c);
  const bouton=(lib)=>`<button onclick="ouvrirPlanCoach()" style="width:100%;margin-top:8px;padding:12px 0;background:var(--surface-2);border:1px solid var(--border);color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;letter-spacing:1.5px;border-radius:var(--r-3);cursor:pointer">${lib}</button>`;
  // Même précaution que sur l'écran de l'athlète : le résumé compte des
  // sources, et le décompte des alertes ne veut rien dire sans Ciqual.
  // On repasse le MÊME objet client plutôt que de le relire : getOwnedClient
  // affiche un toast quand la fiche a été quittée entre-temps, et ce toast
  // n'aurait rien à voir avec ce que le coach est en train de faire.
  if(planActif(c)&&!_ciqualDB) _loadCiqual().then(()=>{
    if(document.getElementById('ccd-nutrition')) renderCoachNutriSection(c);
  });
  if(!planActif(c)){
    return `<div style="margin-bottom:16px">
      <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:6px">${icon('clipboard',12)} Plan alimentaire</div>
      <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6">Aucun plan composé. Tu peux poser un squelette de repas et deux catalogues de sources interchangeables : leurs grammages se calculent tout seuls pour retomber sur les macros que tu viens de fixer.</div>
      ${bouton('COMPOSER LE PLAN')}
    </div>`;
  }
  const nLignes=planSquelette(plan).filter(x=>!x.src).length;
  const nMarq=planSquelette(plan).filter(x=>x.src).length;
  const nP=planCatalogue(plan,'p').length,nC=planCatalogue(plan,'c').length;
  let alertes=[];
  try{ alertes=planAlertes(plan,c); }catch(e){}
  return `<div style="margin-bottom:16px">
    <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:6px">${icon('clipboard',12)} Plan alimentaire</div>
    <div style="font-size:var(--fs-xs);color:#ccc;line-height:1.7">
      ${nLignes} ligne${nLignes>1?'s':''} de repas · ${nMarq} source${nMarq>1?'s':''} au choix · catalogues ${nP} protéines / ${nC} glucides${plan.avecComplements?' · avec compléments':''}
    </div>
    ${alertes.length?`<div style="font-size:var(--fs-xs);color:var(--orange);line-height:1.6;margin-top:6px">${alertes.length} point${alertes.length>1?'s':''} à regarder dans la composition.</div>`:''}
    ${accesDieteStricte(c).ok?'':`<div style="font-size:var(--fs-xs);color:var(--orange);line-height:1.6;margin-top:6px">Ce plan est prêt mais ton athlète ne le voit pas : l'accès à la diète stricte est fermé, juste au-dessus.</div>`}
    ${bouton('MODIFIER LE PLAN')}
  </div>`;
}

// ── Journal alimentaire, côté coach : LECTURE SEULE ───────────────────────
// La donnée voyageait déjà : `nutrition` n'est pas retiré de l'envoi, et
// SANTE_CHAMPS ne masque que grossesse, pes, constantes et analyses. Le
// journal est donc dans /users/{emailKey}, que les règles ouvrent au coach.
// C'est l'interface qui le cachait, pas le stockage.
//
// Le coach LIT. Il ne corrige pas le journal de quelqu'un d'autre : aucun
// champ, aucune suppression, seulement la navigation entre les jours — même
// doctrine que la section photos.
// PURE. Les jours RÉELLEMENT journalisés d'une fenêtre, du plus récent au
// plus ancien. Un jour sans entrée n'est pas un jour à zéro : c'est un jour
// dont on ne sait rien, et le faire compter tirerait toutes les moyennes
// vers le bas.
function journalJours(log,nbJours,finISO){
  const out=[];
  const l=log||{};
  const fin=finISO||'';
  const cles=Object.keys(l).filter(k=>{
    const e=(l[k]&&l[k].entries)||[];
    if(!e.length) return false;
    return fin?k<=fin:true;
  }).sort((a,b)=>a<b?1:-1);
  const n=Number(nbJours)>0?Number(nbJours):null;
  if(!n) return cles;
  // La fenêtre se compte en JOURS de calendrier depuis `fin`, pas en nombre
  // d'entrées : sept jours dont deux journalisés font une moyenne sur deux.
  const bas=fin?_journalRecule(fin,n-1):null;
  return cles.filter(k=>!bas||k>=bas);
}
// PURE. La date ISO `n` jours avant celle donnée. Midi, comme partout
// ailleurs dans ce fichier : 'YYYY-MM-DD' seul s'interprète en UTC et
// décalerait d'un jour à l'ouest de Greenwich.
function _journalRecule(dateISO,n){
  const d=new Date(String(dateISO)+'T12:00:00');
  if(isNaN(d.getTime())) return '';
  d.setDate(d.getDate()-(Number(n)||0));
  const p2=x=>(x<10?'0':'')+x;
  return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());
}
// PURE. Le total d'un jour.
function journalTotalJour(log,dateISO){
  const e=((log||{})[dateISO]&&(log||{})[dateISO].entries)||[];
  return e.reduce((a,x)=>({
    kcal:a.kcal+(Number(x.kcal)||0), p:a.p+(Number(x.p)||0),
    c:a.c+(Number(x.c)||0), l:a.l+(Number(x.l)||0), n:a.n+1
  }),{kcal:0,p:0,c:0,l:0,n:0});
}
// PURE. La moyenne sur une fenêtre, calculée sur les seuls jours journalisés.
// `null` quand il n'y en a aucun : afficher « 0 kcal » ferait croire à un
// jeûne là où il n'y a qu'une absence de saisie.
function journalMoyenne(log,nbJours,finISO){
  const jours=journalJours(log,nbJours,finISO);
  if(!jours.length) return null;
  const t=jours.reduce((a,k)=>{
    const j=journalTotalJour(log,k);
    return {kcal:a.kcal+j.kcal,p:a.p+j.p,c:a.c+j.c,l:a.l+j.l};
  },{kcal:0,p:0,c:0,l:0});
  const n=jours.length;
  return {jours:n,kcal:Math.round(t.kcal/n),p:Math.round(t.p/n),
    c:Math.round(t.c/n),l:Math.round(t.l/n)};
}
// ⚠ _ccdJournalJour, _ccdJournalJourValide ET ccdJournalAller ONT ETE
// RETIREES le 08/09/2026 avec la navigation jour par jour qu’elles servaient.
// Le calendrier tient son etat dans _ccdCalMois et _ccdCalJour, et un jour
// choisi ne s’y « rabat » plus sur le plus recent : on ne peut cliquer que
// sur une case qui porte deja une saisie.
// ⚠ _htmlJournalCoach A ETE REMPLACE PAR UN CALENDRIER le 08/09/2026 —
// voir _htmlJournalCal plus bas. Il montrait deux cartes de moyennes et UN
// SEUL jour, qu'on atteignait par deux fleches : retrouver le mardi de la
// semaine derniere demandait six clics, et rien ne disait quels jours etaient
// saisis. Kevin : « mets-le moi comme un calendrier, je clique sur une case et
// j'ai ce que la personne a mange ce jour-la ».
// ⚠ _htmlDieteCoach A ETE REMPLACE PAR _htmlDieteRespect le 08/09/2026 : le
// pourcentage seul, en haut d'un cadre, ne disait pas sur combien de jours il
// portait. Il est devenu un anneau vert et rouge, remonte en tete de l'onglet,
// avec le decompte des jours tenus et des jours hors cible. Le sous-titre de
// _sousTitreDiete, lui, n'a pas bouge : c'est toujours lui qui dit sur QUOI le
// pourcentage porte.
// ⚠ _NUT_VUE A ETE RETIRE le 08/09/2026 avec le bloc « Aujourd'hui » : c'etait
// sa liste de champs, et elle n'avait pas d'autre lecteur. Le long commentaire
// qui la precedait decrivait cet ecran-la ; ce qu'il disait de vrai — les deux
// ecrans peuvent diverger, et il faut le dire — est repris par _cplHtmlDesync.
// N3.6 — LE GESTE EXPLICITE : descendre CE dossier, maintenant.
// Il ne contourne PAS la sonde de fraicheur : syncUser interroge d'abord
// updatedAt et ne tire le dossier que s'il est strictement plus recent. Le
// geste n'est donc pas plus couteux qu'un reveil du sondage — c'est le meme
// chemin, declenche a la main.
let _majEnCours=false;
function _saisieEnCours(){
  try{
    const a=document.activeElement;
    if(!a) return false;
    if(!/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
    return !!a.closest('#s-coach-client');
  }catch(e){ return false; }
}
async function actualiserClient(){
  if(_majEnCours) return false;
  const c=getOwnedClient(currentClientId);
  if(!c||!c.email){ toast('Ce dossier n’est pas synchronisé.','var(--orange)'); return false; }
  _majEnCours=true;
  try{
    const z=document.getElementById('ccd-fraicheur');
    if(z) z.innerHTML='<span class="sub" style="font-size:var(--fs-2xs)">Vérification…</span>';
    let change=false;
    try{ change=await CLOUD.syncUser(c.email); }
    catch(e){ toast('Impossible de joindre le cloud.','var(--red)'); return false; }
    if(!change){
      toast('Son dossier est déjà à jour.','var(--sub)');
      _majFraicheur();
      return false;
    }
    // NE PAS REPEINDRE PENDANT UNE SAISIE. Le coach peut etre en train de
    // taper une note ou un grammage : lui reecrire la fiche sous les doigts
    // perdrait sa saisie. On le dit, et il rouvrira quand il aura fini.
    if(_saisieEnCours()){
      toast('Du nouveau est arrivé : termine ta saisie, la fiche se mettra à jour ensuite.','var(--info)');
      _majFraicheur();
      return true;
    }
    toast('Dossier mis à jour '+ICO.coche,'var(--success)');
    // ⚠ `true` — C'EST UN RAFRAICHISSEMENT, PAS UNE OUVERTURE. Ce drapeau
    //   manquait ici, et c'etait le SEUL des quinze appels en place a
    //   l'oublier. Deux effets, tous deux mesures au banc le 21/09/2026 :
    //
    //   · L'ONGLET REVENAIT SUR « ENTRAINEMENT ». openClientDetail repart du
    //     premier onglet quand le drapeau manque — c'est voulu en ouvrant la
    //     fiche de quelqu'un d'autre, ca ne l'est pas en actualisant celle
    //     qu'on a sous les yeux. Le coach qui cliquait « Actualiser » en
    //     reglant des macros se retrouvait en haut du programme. La regle est
    //     ecrite noir sur blanc dans openClientDetail ; cet appel-ci ne la
    //     respectait pas.
    //   · QUATRE DESCENTES RESEAU AU LIEU D'UNE. Sans le drapeau, la fonction
    //     force une descente a chaque passage — « ouvrir une fiche force une
    //     descente », ce qui est juste a l'ouverture et redondant ici, puisque
    //     actualiserClient vient precisement d'en faire une. Compteur pose sur
    //     CLOUD.syncUser : quatre appels pour un clic.
    try{ openClientDetail(currentClientId,true); }catch(e){}
    return true;
  } finally {
    _majEnCours=false;
    _majFraicheur();
  }
}
// PURE. Ce que le coach lit a cote du bouton.
function htmlFraicheurClient(c){
  const d=(c&&c.email)?CLOUD.derniereDescente(c.email):null;
  if(!d) return '<span class="sub" style="font-size:var(--fs-2xs)">Pas encore vérifié depuis l’ouverture de l’app.</span>';
  const min=Math.floor((Date.now()-d.ts)/60000);
  let quand;
  if(min<1) quand='à l’instant';
  else if(min<60) quand='il y a '+min+' min';
  else{
    try{ quand='à '+new Date(d.ts).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }
    catch(e){ quand='il y a '+Math.floor(min/60)+' h'; }
  }
  return '<span class="sub" style="font-size:var(--fs-2xs)">Dernière descente '+quand
    +(d.change?' · du nouveau':'')+'</span>';
}
function _majFraicheur(){
  try{
    const z=document.getElementById('ccd-fraicheur');
    if(!z) return;
    const c=getOwnedClient(currentClientId);
    z.innerHTML=htmlFraicheurClient(c);
  }catch(e){}
}
// PURE. Les deux ecrans disent-ils autre chose l'un que l'autre ?
//
// ⚠ LE BLOC « AUJOURD'HUI » A ETE RETIRE le 08/09/2026, SUR DEMANDE DE KEVIN
// — capture a l'appui, en pointant precisement ce cadre.
//
// Il redisait, en haut de la fiche, ce que l'athlete a sous les yeux : le
// total du jour, ses trois macros, sa cible de sel, et deux avertissements
// quand ces chiffres s'ecartaient de ceux que le coach est en train de regler
// juste en dessous. C'etait un TROISIEME affichage des memes nombres, apres
// les tableaux du calcul et le plan.
//
// CE QUI PORTAIT L'AVERTISSEMENT NE DISPARAIT PAS AVEC LUI : le decalage entre
// la copie enregistree et le calcul vivant est dit par _cplHtmlDesync, dans
// l'apercu du plan, et par le bouton « Appliquer ces cibles » des tableaux.
//
// ecartAthleteVu et _htmlAthleteVoit n'avaient pas d'autre appelant.
// ══════════════ LES TABLEAUX DU CALCUL, COTE COACH ═════════════════════
//
// Ce que Kevin lit dans ses tableurs depuis des annees, rendu dans l'app. Le
// calcul etait deja juste depuis cibleTableur ; ce qui manquait, c'est de
// pouvoir le VERIFIER LIGNE A LIGNE. Un total qu'on ne peut pas decomposer ne
// se corrige pas, il se subit.
//
// ⚠ CETTE MEMOIRE NE SURVIT PLUS D'UN GESTE A L'AUTRE, et c'est le dernier
//   maillon du va-et-vient demande par Kevin le 20/09/2026. Elle avait un sens
//   tant que les menus du tableur ne touchaient QUE la session — l'ecriture au
//   dossier attendait un bouton. Depuis le build 1317, chaque menu ecrit et
//   pousse immediatement : le dossier est alors la seule verite, et garder une
//   copie a cote ne pouvait plus que MASQUER quelque chose.
//
//   CE QU'ELLE MASQUAIT, MESURE : le coach met 1,6 g/kg, l'athlete met 2,2
//   depuis son ecran ; le dossier porte bien 2,2, sa carte affiche 176 g — et
//   le tableau du coach continuait d'afficher 1,6, parce que sa session le
//   tenait encore. Les deux ecrans annoncaient deux grilles differentes pour
//   le meme athlete.
//
//   RENDRE UN OBJET NEUF A CHAQUE APPEL NE PERD RIEN : le seul ecrivain,
//   majTableauTableur, y pose la valeur qu'il vient de recevoir puis la
//   persiste dans la foulee. Les autres clefs, absentes de l'objet, gardent
//   simplement celles du dossier — ce qui est exactement ce qu'on veut.
let _tbOpts=null;   // conserve pour les deux ecritures qui le relisent
function _tbOptsDe(c){
  _tbOpts={email:(c&&c.email)||''};
  return _tbOpts;
}
// Le geste des menus. `quoi` nomme le reglage, la valeur arrive en chaine.
/**
 * Recalcule les cibles depuis les tableaux et les ECRIT dans le dossier.
 * Rend les deux journees ecrites, ou null si rien n'a ete ecrit.
 *
 * ⚠ ELLE NE TOUCHE A RIEN EN SAISIE MANUELLE. C'est le contrat affiche en
 *   toutes lettres sous l'interrupteur — « tes chiffres priment : ils ne
 *   bougeront plus si tu changes les g/kg ou la vitesse ». Un coach qui a
 *   ecrit ses grammes a la main ne doit pas les voir disparaitre parce qu'il
 *   a deroule un menu pour comparer.
 *
 * ⚠ ET ELLE N'ECRIT PAS `manuel:false`. Le reflexe serait de poser le drapeau
 *   pour dire « on est en automatique » ; il verrouillerait la question dans
 *   le mauvais sens, parce que `ciblesPoseesParCoach` lit le MEME champ pour
 *   decider si l'athlete peut reprendre la main. `manuel:false` aurait rendu
 *   les cibles du coach effacables d'un clic sur ±20, cote athlete. C'est
 *   l'origine qui porte l'information, et elle repond juste aux deux
 *   questions.
 * @param {any} c  le dossier de l'athlete, deja sorti de DB
 */
function _tbEcrireCibles(c){
  if(!c) return null;
  try{ if(saisieManuelle(c)) return null; }catch(e){ return null; }
  let t=null;
  try{ t=cibleTableur(c,_tbOptsDe(c)); }catch(e){ return null; }
  // CALCUL INCOMPLET : ON N'ECRIT RIEN. Les tableaux disent deja ce qui
  // manque ; ecrire des cibles bancales serait pire que n'en pas ecrire.
  if(!t||(t.manque&&t.manque.length)) return null;
  const cyc=(function(){ try{ return dieteCyclee(c); }catch(e){ return false; } })();
  let j=null;
  try{ j=_tbJournees(c,t,cyc); }catch(e){ return null; }
  if(!j||!j.on) return null;
  if(!c.nutrition) c.nutrition={};
  c.nutrition.macros={on:j.on,off:cyc?j.off:j.on,
    origine:'tableur',origineDate:Date.now()};
  _histoNoter(c,'tableur');
  return j;
}
// L'AVIS EST DIFFERE, PAS L'ENVOI. Les chiffres partent au premier geste ; ce
// qui attend, c'est le message. Un coach qui compare trois coefficients de
// suite aurait recu trois bandeaux en deux secondes, et les aurait appris a
// ignorer — y compris celui qui annonce un echec de synchronisation.
//
// ⚠ TOUS LES ENVOIS SONT RETENUS, PAS LE DERNIER. Ne garder que la derniere
//   promesse aurait avale l'echec d'un envoi precedent : le coach aurait vu
//   « enregistre » alors qu'une de ses modifications n'etait jamais partie.
let _tbAvisT=0, _tbAvisOk=true, _tbAvisEnvois=[];
function _tbAvis(localOk,envoi,texte){
  _tbAvisOk=_tbAvisOk&&!!localOk;
  try{ _tbAvisEnvois.push(Promise.resolve(envoi)); }catch(e){}
  try{ clearTimeout(_tbAvisT); }catch(e){}
  _tbAvisT=setTimeout(()=>{
    const ok=_tbAvisOk, envois=_tbAvisEnvois;
    _tbAvisOk=true; _tbAvisEnvois=[];
    try{ toastSync(ok,Promise.all(envois),texte,'la cible est'); }catch(e){}
  },700);
}
/**
 * Le ±20 du coach (build 1412). Meme champ, meme pas et meme ecrivain que
 * celui de l'athlete : c'est ce qui fait que les deux ecrans ne peuvent pas
 * annoncer deux totaux.
 *
 * ⚠ IL ECRIT ET POUSSE AU GESTE MEME, comme les menus de ce tableau depuis le
 *   19/09 : l'athlete recoit le nouveau total a sa prochaine synchro, sans que
 *   le coach ait a trouver un bouton d'envoi.
 */
function tbkDelta(sens){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  const r=appliquerDeltaKcal(c,sens,'tableur');
  if(!r) return false;
  if(r.manque&&r.manque.length){
    try{ toast('Calcul incomplet : '+r.manque.join(', '),'var(--orange)'); }catch(e){}
    try{ renderCoachNutriSection(c); }catch(e){}
    return false;
  }
  if(!r.bouge){
    // Branche morte depuis que la borne est tombee (24/09/2026).
    try{ toast('Rien n’a bouge.','var(--orange)'); }catch(e){}
    return false;
  }
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  _tbAvis(ok,CLOUD.pushOne(c.email,c),
    'Ton athlète est sur '+_tbNb(r.kcal)+' kcal'
    +(r.delta?(' ('+(r.delta>0?'+':'')+r.delta+' d’ajustement)'):''));
  // Sous le plancher : le coach peut, mais il le voit.
  if(r.sousPlancher){ try{ toast('Attention : ce total passe sous le plancher de '+_tbNb(plancherAthlete(c))+' kcal de ton athlète.','var(--red)'); }catch(e){} }
  try{ renderCoachNutriSection(c); }catch(e){}
  return true;
}
// L'écart entre les deux formules, pour ce dossier : ce qu'on gagne ou perd en changeant.
function _htmlEcartFormules(t){
  const hb=mbHarrisBenedict(t.poids,t.taille,t.age,t.sexe), mf=mbMifflin(t.poids,t.taille,t.age,t.sexe);
  if(!(hb>0)||!(mf>0)) return '';
  const e=_tbNb(Math.abs(hb-mf));
  // D'ABORD CE QUI EST REELLEMENT CALCULE (Kevin, 05/10/2026). Avec une masse
  // maigre mesuree, c'est Katch-McArdle, quel que soit le choix du menu : la
  // phrase le disait en dernier, apres deux chiffres qui ne servaient pas, et
  // le menu « Mifflin-St Jeor » se lisait comme la formule en cours.
  if(t.mbSource==='katch')
    return 'Calcul actuel : Katch-McArdle, sur sa masse maigre mesurée'
      +(t.mbBrut>0?' ('+_tbNb(t.mbBrut)+' kcal)':'')
      +'. Ce choix ne servira que sans masse maigre : Harris-Benedict '+_tbNb(hb)
      +', Mifflin-St Jeor '+_tbNb(mf)+', écart de '+e+' kcal.';
  const harris=t.mbSource==='harris';
  return 'Calcul actuel : '+(harris?'Harris-Benedict':'Mifflin-St Jeor')+', '
    +_tbNb(harris?hb:mf)+' kcal. '+(harris?'Mifflin-St Jeor':'Harris-Benedict')
    +' donnerait '+_tbNb(harris?mf:hb)+' kcal : écart de '+e+' kcal.';
}
function majTableauTableur(quoi,val){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  const o=_tbOptsDe(c);
  if(quoi==='naf') o.naf=String(val||'')||undefined;
  else if(quoi==='formuleMB') o.formuleMB=MB_FORMULES.indexOf(val)>=0?val:null;
  else{
    const v=parseFloat(String(val).replace(',','.'));
    o[quoi]=isFinite(v)?v:undefined;
    // ⚠ LES DEUX STOCKAGES SUIVENT LE MEME GESTE, depuis le 08/09/2026.
    // nutrition.tableur nourrit ces tableaux ; nutrition.reglages nourrit
    // besoinsProposes, donc les trois chiffres de la vitesse visée. Tant que
    // deux selecteurs existaient, chacun n'ecrivait que le sien et les deux
    // ecrans se contredisaient. Il n'en reste qu'un : il doit poser les deux,
    // sinon la vitesse chiffrerait avec un g/kg que plus personne n'affiche.
    // On passe par les poseurs plutot que d'ecrire les variables : une seule
    // fonction pose chacune, et la regle « isFinite sinon null » ne vit qu'a
    // un endroit.
    if(quoi==='protGkg') _propSetProt(val,true);
    else if(quoi==='lipGkg') _propSetLip(val,true);
  }
  // ⚠ ON ECRIT ET ON POUSSE ICI, au geste meme. Demande de Kevin, 19/09/2026 :
  //   « dès que le coach modifie les calculs sur ce tableur, la modif se fait
  //   immédiatement côté athlète, que ce soit diète flexible ou stricte ».
  //   Jusqu'ici ce menu ne touchait QUE la memoire de session : mesure faite
  //   dans un navigateur, deux changements de menu laissaient le dossier de
  //   l'athlete a `macros:null` et le compteur d'envois a zero. Elle ne
  //   recevait rien tant que le coach n'avait pas trouve le bouton rouge.
  //
  //   LES DEUX DIETES SONT SERVIES PAR LA MEME ECRITURE, et c'est pour ca
  //   qu'il n'y a rien de plus a faire pour la stricte : flexible et stricte
  //   lisent toutes les deux `nutrition.macros` par _getEffectiveMacros. Une
  //   seconde source pour la stricte aurait fini par diverger de la premiere.
  if(!c.nutrition) c.nutrition={};
  const reg=Object.assign({},c.nutrition.tableur||{});
  for(const k of ['naf','coef','protGkg','lipGkg']) if(o[k]!==undefined) reg[k]=o[k];
  // La formule : un choix explicite, ou « automatique » (le champ retiré).
  if(quoi==='formuleMB'){ if(o.formuleMB) reg.formuleMB=o.formuleMB; else delete reg.formuleMB; }
  c.nutrition.tableur=reg;
  const manuel=(function(){ try{ return saisieManuelle(c); }catch(e){ return false; } })();
  const j=_tbEcrireCibles(c);
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  // CE QUE LE MESSAGE DIT DEPEND DE CE QUI S'EST VRAIMENT PASSE. « Cibles
  // envoyées » sur un dossier en saisie manuelle — ou sur un calcul incomplet —
  // aurait annonce un envoi qui n'a pas eu lieu.
  _tbAvis(ok,CLOUD.pushOne(c.email,c),
    j?('Ton athlète est sur '+_tbNb(j.on.kcal)+' kcal')
     :(manuel?'Réglage enregistré : en saisie manuelle, tes chiffres priment'
             :'Réglage enregistré : calcul incomplet, cibles inchangées'));
  try{ renderCoachNutriSection(c); }catch(e){}
  return true;
}
// ── LES SPORTS DU TABLEAU : ajouter, regler, retirer (build 1405) ─────────
// Le PREMIER geste fige la liste affichee — creneaux RepCore et bilan — en
// liste du coach, puis la modifie : le coach part de ce qu'il voit, pas d'une
// page blanche. Chaque geste ecrit, recalcule les cibles et pousse, comme
// les menus du tableau : l'athlete le recoit a sa prochaine synchro.
function _tbSportsEcrire(modif,texte){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  if(!c.nutrition) c.nutrition={};
  let lignes=[];
  try{ lignes=((kcalSportParJour(c)||{}).lignes||[])
    .map(e=>({sport:e.sport,heures:Number(e.heures)||0,intensite:e.intensite||'moderee'})); }catch(e){ lignes=[]; }
  if(modif(lignes)===false){ try{ renderCoachNutriSection(c); }catch(e){} return false; }
  const reg=Object.assign({},c.nutrition.tableur||{});
  reg.sports={lignes:lignes.map(e=>({sport:String(e.sport),
    heures:Math.min(60,Math.max(0,Number(e.heures)||0)),
    intensite:SPORT_INTENSITES.some(x=>x.cle===e.intensite)?e.intensite:'moderee'})),date:Date.now()};
  c.nutrition.tableur=reg;
  const manuel=(function(){ try{ return saisieManuelle(c); }catch(e){ return false; } })();
  const j=_tbEcrireCibles(c);
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  _tbAvis(ok,CLOUD.pushOne(c.email,c),
    j?((texte?texte+', ':'')+'ton athlète est sur '+_tbNb(j.on.kcal)+' kcal')
     :(manuel?'Sport enregistré : en saisie manuelle, tes chiffres priment'
             :'Sport enregistré : calcul incomplet, cibles inchangées'));
  try{ renderCoachNutriSection(c); }catch(e){}
  return true;
}
function majSportTableur(i,champ,val){
  return _tbSportsEcrire(l=>{
    const e=l[Number(i)];
    if(!e) return false;
    if(champ==='heures'){
      const v=parseFloat(String(val).replace(',','.'));
      if(!isFinite(v)||v<0||v>60) return false;
      e.heures=Math.round(v*4)/4;
    } else if(champ==='intensite'){
      if(!SPORT_INTENSITES.some(x=>x.cle===val)) return false;
      e.intensite=val;
    } else if(champ==='sport'){
      if(!SPORTS_MET[val]||val==='Aucun') return false;
      e.sport=val;
    } else return false;
  },'Sport modifié');
}
// UN SPORT AJOUTE COMPTE ZERO HEURE : le total ne bouge qu'au moment ou le
// coach dit combien. Ajouter une ligne ne doit pas, a soi seul, faire manger
// quatre-vingts kilocalories de plus.
function ajouterSportTableur(){
  return _tbSportsEcrire(l=>{ l.push({sport:'Course à pied',heures:0,intensite:'moderee'}); },'Sport ajouté');
}
function retirerSportTableur(i){
  return _tbSportsEcrire(l=>{ if(!l[Number(i)]) return false; l.splice(Number(i),1); },'Sport retiré');
}
// LE RETOUR AU CALCUL AUTOMATIQUE : la liste du coach s'efface, les creneaux
// RepCore et le bilan reprennent la main.
function sportsTableurAuto(){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c||!c.nutrition||!c.nutrition.tableur||!c.nutrition.tableur.sports) return false;
  const reg=Object.assign({},c.nutrition.tableur);
  delete reg.sports;
  c.nutrition.tableur=reg;
  const j=_tbEcrireCibles(c);
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  _tbAvis(ok,CLOUD.pushOne(c.email,c),
    'Sports recalculés depuis les créneaux et le bilan'+(j?' : ton athlète est sur '+_tbNb(j.on.kcal)+' kcal':''));
  try{ renderCoachNutriSection(c); }catch(e){}
  return true;
}
// ══ L'HISTORIQUE DES CIBLES (build 1408) ═════════════════════════════════
// Kevin, 22/09/2026 : « un historique des modifications pour voir les anciens
// enregistrements avec le nombre de calories en gros, la date entre
// parentheses a cote, et en dessous glucides, proteines et lipides ; ou l'on
// peut selectionner un ancien enregistrement pour le remettre en place, et la
// possibilite d'annuler quand meme ».
//
// IL VIT DANS LE DOSSIER (nutrition.histo) et non sur l'appareil du coach :
// c'est l'historique des cibles de l'ATHLETE, il doit survivre a un changement
// de telephone et se lire depuis n'importe quel appareil du coach.
//
// ⚠ UNE LIGNE PAR CIBLE REELLEMENT DIFFERENTE, et pas une par geste. Chaque
//   menu du tableau reecrit les cibles : sans regroupement, trois secondes de
//   reglages auraient rempli l'historique de vingt lignes identiques a une
//   kilocalorie pres. Deux ecritures rapprochees se fondent en une, sauf un
//   ENVOI EXPLICITE (« Enregistrer et transmettre »), qui garde sa ligne.
const HISTO_MAX=25;
const HISTO_FUSION_MS=600000;   // 10 min
const HISTO_LIB=Object.freeze({tableur:'réglage du tableau',coach:'saisie manuelle',
  transmis:'transmis à l’athlète',auto:'calcul automatique',histo:'remise en place',
  reinit:'remise au point de départ'});
function _histoBloc(b){
  const n=v=>Math.round(Number(v)||0);
  const o=b||{};
  return {kcal:n(o.kcal),p:n(o.p),g:n(o.g),l:n(o.l),f:n(o.f)};
}
/** PURE. L'historique d'un dossier, quelle que soit la forme rendue par Firebase. */
function histoCibles(c){
  const h=c&&c.nutrition&&c.nutrition.histo;
  const l=Array.isArray(h)?h:(h&&typeof h==='object'
    ?Object.keys(h).sort((a,b)=>a-b).map(k=>h[k]):[]);
  return l.filter(e=>e&&e.on&&Number(e.on.kcal)>0)
    .map(e=>({d:Number(e.d)||0,src:String(e.src||'coach'),on:_histoBloc(e.on),off:_histoBloc(e.off||e.on)}));
}
function _histoNoter(c,src){
  try{
    const m=(c&&c.nutrition&&c.nutrition.macros)||null;
    if(!m||!m.on||!(Number(m.on.kcal)>0)) return;
    const e={d:Date.now(),src:src||'coach',on:_histoBloc(m.on),off:_histoBloc(m.off||m.on)};
    const l=histoCibles(c);
    const der=l[l.length-1];
    const memes=der&&JSON.stringify(der.on)===JSON.stringify(e.on)
      &&JSON.stringify(der.off)===JSON.stringify(e.off);
    if(memes){
      // La meme cible : on ne la note pas deux fois — mais un envoi explicite
      // le dit, parce que c'est lui qui prouve que l'athlete l'a recue.
      if(e.src==='transmis'){ der.src='transmis'; der.d=e.d; }
      c.nutrition.histo=l; return;
    }
    if(der&&e.d-der.d<HISTO_FUSION_MS&&der.src!=='transmis'&&e.src!=='transmis') l.pop();
    l.push(e);
    while(l.length>HISTO_MAX) l.shift();
    c.nutrition.histo=l;
  }catch(err){}
}
// LA DERNIERE TRANSMISSION CONFIRMEE, sur CET appareil. Elle ne va pas dans le
// dossier : ce serait une ecriture de plus a pousser pour dire qu'on vient de
// pousser. L'historique, lui, garde la ligne « transmis ».
const TBK_TRANSMIS_CLE='rc_tbk_transmis';
function _transmisLire(){
  try{ const o=JSON.parse(localStorage.getItem(TBK_TRANSMIS_CLE)||'null');
    return (o&&typeof o==='object')?o:{}; }catch(e){ return {}; }
}
function _transmisPoser(email,info){
  if(!email) return;
  try{ const o=_transmisLire(); o[email]=info;
    localStorage.setItem(TBK_TRANSMIS_CLE,JSON.stringify(o)); }catch(e){}
}
// ⚠ ON ATTEND LA REPONSE DU SERVEUR AVANT DE DIRE « TRANSMIS ». Un message
//   « transmis » pendant qu'une synchro echoue ferait croire l'athlete servi —
//   c'est exactement ce que Kevin demande de pouvoir verifier.
function _confirmerTransmission(c,localOk,envoi){
  return Promise.resolve(envoi).then(r=>{
    if(r===false) throw new Error('envoi refusé');
    const _on=((c.nutrition||{}).macros||{}).on||{};
    _transmisPoser(c.email,{d:Date.now(),kcal:Math.round(Number(_on.kcal)||0)});
    toast('Transmis à ton athlète '+ICO.coche+' : reçu à sa prochaine ouverture, au plus tard dans cinq minutes','var(--green)');
    try{ renderCoachNutriSection(getOwnedClient(currentClientId)||c); }catch(e){}
    return true;
  }).catch(()=>{
    toast(localOk?'Enregistré ici, mais PAS ENCORE TRANSMIS : la synchronisation a échoué, l’envoi repartira tout seul'
                 :'Échec : ni enregistré sur cet appareil, ni transmis. Recommence.','var(--orange)');
    try{ renderCoachNutriSection(getOwnedClient(currentClientId)||c); }catch(e){}
    return false;
  });
}
// UN SEUL BOUTON D'ENREGISTREMENT. Kevin : « il y a trop de boutons
// similaires, fais juste un “enregistrer et transmettre à l'athlète” ou le
// coach a la confirmation du transfert ».
//   · en saisie manuelle, il enregistre les chiffres tapes (meme controle de
//     plancher qu'avant, meme trace de derogation) ;
//   · en calcul automatique, il envoie les cibles du tableau.
// Dans les deux cas, il attend la reponse du serveur et le DIT.
async function enregistrerEtTransmettre(malgrePlancher){
  const c0=getOwnedClient(currentClientId);
  if(!c0){ toast('Aucun athlète ouvert','var(--orange)'); return false; }
  const manuel=(function(){ try{ return saisieManuelle(c0); }catch(e){ return false; } })();
  if(manuel){
    const ok=saveClientNutriMacros(malgrePlancher,true);
    if(!ok) return false;
    return _confirmerTransmission(getOwnedClient(currentClientId)||c0,true,window._tbDernierEnvoi);
  }
  const ok=await appliquerCiblesTableur(true);
  if(!ok) return false;
  return _confirmerTransmission(getOwnedClient(currentClientId)||c0,true,window._tbDernierEnvoi);
}
// ── REMETTRE EN PLACE UN ANCIEN ENREGISTREMENT, ET POUVOIR L'ANNULER ──────
// L'etat d'avant est garde en memoire de session : « annuler » doit ramener
// EXACTEMENT ce qui etait en place, y compris si l'ancienne cible remise est
// elle-meme deja dans l'historique.
let _histoAnnul=null;
let _histoOuvert=false;
function basculerHistoTableur(){
  _histoOuvert=!_histoOuvert;
  try{ renderCoachNutriSection(getOwnedClient(currentClientId)); }catch(e){}
  return _histoOuvert;
}
async function histoRemettre(i){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  const l=histoCibles(c);
  const e=l[Number(i)];
  if(!e){ toast('Cet enregistrement n’existe plus','var(--orange)'); return false; }
  const cyc=(function(){ try{ return dieteCyclee(c); }catch(e2){ return false; } })();
  const manuel=(function(){ try{ return saisieManuelle(c); }catch(e2){ return false; } })();
  const ok=await rcConfirm('Remettre ces cibles en place ?',
    'Ton athlète passera à '+_tbNb(e.on.kcal)+' kcal'
    +(cyc&&e.off.kcal!==e.on.kcal?(' les jours ON et '+_tbNb(e.off.kcal)+' les jours OFF'):' par jour')
    +', '+_tbNb(e.on.p)+' g de protéines, '+_tbNb(e.on.g)+' g de glucides et '
    +_tbNb(e.on.l)+' g de lipides.'
    +(manuel?' Tu pourras annuler juste après.'
            :' En calcul automatique, le prochain réglage du tableau recalculera les cibles ;'
             +' tu pourras annuler juste après.'),'Remettre en place');
  if(!ok) return false;
  const m=(c.nutrition||{}).macros||{};
  _histoAnnul={email:c.email,date:Date.now(),remis:e.on.kcal,
    avant:{on:Object.assign({},m.on||{}),off:Object.assign({},m.off||m.on||{}),
           origine:m.origine||null,origineDate:m.origineDate||null}};
  if(!c.nutrition) c.nutrition={};
  // ⚠ `origine:'histo'` EST LUE PAR TROIS FONCTIONS, et il a fallu les trois.
  //   MESURE AU BANC : sans elles, la remise en place ne tenait pas dix
  //   millisecondes — `_tbReconcilier`, appelee AVANT chaque rendu de la
  //   section, recalculait la cible du tableau et l'ecrasait — et elle
  //   basculait le dossier en saisie manuelle, parce que `saisieManuelle` ne
  //   reconnait comme « calculee » que l'origine « tableur ».
  //   Une cible remise en place est une PRESCRIPTION : elle tient jusqu'au
  //   prochain reglage du tableau, qui la recalcule et le dit dans la
  //   confirmation ci-dessus.
  c.nutrition.macros={on:Object.assign({},e.on),off:Object.assign({},cyc?e.off:e.on),
    origine:'histo',origineDate:Date.now()};
  _histoNoter(c,'histo');
  c.updatedAt=Date.now(); users[c.email]=c;
  const localOk=DB.set('users',users);
  return _confirmerTransmission(c,localOk,CLOUD.pushOne(c.email,c));
}
function histoAnnuler(){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c||!_histoAnnul||_histoAnnul.email!==c.email) return false;
  const a=_histoAnnul.avant||{};
  if(!a.on||!(Number(a.on.kcal)>0)){ _histoAnnul=null; return false; }
  if(!c.nutrition) c.nutrition={};
  c.nutrition.macros={on:Object.assign({},a.on),off:Object.assign({},a.off||a.on),
    origine:a.origine||'coach',origineDate:a.origineDate||Date.now()};
  _histoNoter(c,'histo');
  _histoAnnul=null;
  c.updatedAt=Date.now(); users[c.email]=c;
  const localOk=DB.set('users',users);
  return _confirmerTransmission(c,localOk,CLOUD.pushOne(c.email,c));
}
// ⚠ enregistrerReglagesTableur A ETE RETIREE le 22/09/2026 (build 1408).
// C'etait le bouton « Enregistrer les reglages », l'un des quatre que Kevin a
// demande de fondre en un seul : il rangeait sous nutrition.tableur ce que
// chaque menu y ecrit deja de lui-meme depuis le 19/09. Sans bouton, elle
// n'avait plus d'appelant.
const _tbNb=v=>(v==null||!isFinite(v))?'-':String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const _tbDec=v=>(v==null||!isFinite(v))?'-':String(Math.round(v*100)/100).replace('.',',');

// PURE. Les deux journees d'un total, cyclees ou non.
//
// ⚠ LE MEME MECANISME QUE LE CHEMIN AUTOMATIQUE, pas un second. L'ecart voulu
// — deux fois CYCLE_GLUC des glucides de base — est conserve exactement,
// aucune journee ne passe sous le plancher, et le supplement est le meme des
// deux cotes. Une seconde facon de cycler finirait par donner deux repartitions
// pour le meme athlete selon le bouton presse.
function _tbJournees(user,t,cyclee,appliquer){
  // Le plancher suit la decision prise pour le total (t.appliquePlancher).
  const ap=(appliquer!==undefined)?!!appliquer:!!(t&&t.appliquePlancher);
  if(!cyclee){
    const j=_relevePlancher(_bloc(t.p,t.l,t.g),user,ap);
    return {on:j,off:j};
  }
  // Sur la SEMAINE (cycleGlucides) : sans créneau ou avec sept, pas de cycle.
  const cg=cycleGlucides(user,t.g);
  if(!cg.cycle){
    const j=_relevePlancher(_bloc(t.p,t.l,t.g),user,ap);
    return {on:j,off:j,cycle:false,nOn:cg.nOn,nOff:cg.nOff};
  }
  const gOn=cg.gOn, gOff=cg.gOff;
  const offRel=_relevePlancher(_bloc(t.p,t.l,gOff),user,ap);
  const lift=offRel.g-gOff;
  return {off:offRel,on:_relevePlancher(_bloc(t.p,t.l,gOn+lift),user,ap),
    cycle:true,nOn:cg.nOn,nOff:cg.nOff,pctOn:cg.pctOn,pctOff:cg.pctOff};
}

// ⚠ SANS CE BOUTON, LES TABLEAUX NE SONT QU'UN AFFICHAGE. Ils annoncaient
// 3 139 kcal pendant que le dossier en portait 2 317, et rien ne reliait les
// deux : le coach aurait recopie les chiffres a la main dans la grille du
// dessous, ou — plus probablement — aurait cru que l'app les avait pris.
//
// LE GESTE EST EXPLICITE ET SEPARE de l'enregistrement des reglages : regler
// le calcul et decider que son resultat devient la cible de l'athlete sont
// deux decisions, et la seconde change ce qu'il mange demain.
async function appliquerCiblesTableur(silencieux){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  let t=null;
  try{ t=cibleTableur(c,_tbOptsDe(c)); }catch(e){ t=null; }
  if(!t||(t.manque&&t.manque.length)){
    try{ toast('Calcul incomplet : '+((t&&t.manque)||['données manquantes']).join(', '),
      'var(--orange)'); }catch(e){}
    return false;
  }
  // ⚠ dieteCyclee ATTEND LE DOSSIER, PAS SA NUTRITION. Elle lit
  // `user.nutrition.cycle` : lui passer c.nutrition lui faisait chercher
  // c.nutrition.nutrition, toujours absent — et `!(undefined)` vaut vrai, donc
  // TOUT dossier etait traite comme cycle. Un athlete non cycle recevait deux
  // colonnes ON/OFF differentes alors que les tableaux lui en montraient une.
  const cyc=(function(){ try{ return dieteCyclee(c); }catch(e){ return false; } })();
  const j=_tbJournees(c,t,cyc);
  const ok=await rcConfirm('Enregistrer ces cibles ?',
    'Ton athlète verra '+j.on.kcal+' kcal'+(cyc?(' les jours ON et '+j.off.kcal
      +' kcal les jours OFF'):' par jour')+', '+j.on.p+' g de protéines, '
    +j.on.g+' g de glucides et '+j.on.l+' g de lipides. Ses cibles actuelles '
    +'seront remplacées.','Enregistrer');
  if(!ok) return false;
  if(!c.nutrition) c.nutrition={};
  // Les reglages de calcul partent AVEC : sans eux, rouvrir la fiche
  // recalculerait autre chose que ce qui vient d'etre applique.
  const o=_tbOpts||{};
  const reg=Object.assign({},c.nutrition.tableur||{});
  for(const k of ['naf','coef','protGkg','lipGkg']) if(o[k]!==undefined) reg[k]=o[k];
  c.nutrition.tableur=reg;
  c.nutrition.macros={on:j.on,off:cyc?j.off:j.on,
    origine:'tableur',origineDate:Date.now()};
  _histoNoter(c,'transmis');
  c.updatedAt=Date.now(); users[c.email]=c;
  const _ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(c.email,c);
  window._tbDernierEnvoi=envoi;
  if(!silencieux) toastSync(_ok,envoi,'Cibles appliquées','la cible est');
  try{ renderCoachNutriSection(c); }catch(e){}
  return _ok;
}
