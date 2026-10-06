// ══════════════ PLANCHER PROTÉIQUE PAR PRISE ═══════════════════════════════
// COUCHE D'AFFICHAGE. Le moteur de macros n'est pas touché : aucune de ces
// fonctions n'écrit, ne recalcule un total, ni ne modifie protSuggeree.
//
// protParRepas existait déjà et rendait `Math.round(p/n)` — un chiffre unique,
// juste à l'affichage mais dont la somme ne retombe PAS sur le total : quatre
// prises de 45 g pour 178 g de protéines font 180. On ajoute donc une
// répartition À RESTE, seule façon de tenir l'invariant de la règle 1.
//
// LES DEUX PLANCHERS SONT DES REPÈRES DE TERRAIN, au même titre que
// REPERES_VOLUME ou la conversion de 7 700 kcal par kilo déjà employée
// ailleurs : ils ne mesurent rien et ne prescrivent rien. Ils s'affichent, ils
// ne bloquent aucune saisie (règle 6).
const PROT_PLANCHER_PRISE=25;
const PROT_PLANCHER_PRISE_RELEVE=30;
// PURE. La répartition exacte. Les `reste` premières prises portent un gramme
// de plus, et la somme retombe sur le total AU GRAMME — pas « à l'arrondi
// près ». Un Math.round par prise ne le garantit jamais.
function repartitionProteines(total,n){
  const t=Math.round(Number(total));
  const k=parseInt(n,10);
  if(!(t>0)||!(k>=1)) return null;
  const base=Math.floor(t/k);
  const reste=t-base*k;
  return Array.from({length:k},(_,i)=>base+(i<reste?1:0));
}
// PURE. Le plancher relevé ? Deux motifs, jamais cumulés — un plancher n'a
// qu'une valeur.
//
// RÈGLE 4 : menopauseeOuAgee filtre déjà sur isFemale et rend false chez un
// homme, sans erreur ni message. On ne réécrit pas cette règle, on l'appelle.
function plancherPriseMotifs(user){
  const m=[];
  try{ if(menopauseeOuAgee(user)) m.push('menopause'); }catch(e){}
  try{ if(restrictionProlongee(user)) m.push('restriction'); }catch(e){}
  return m;
}
function plancherPrise(user){
  return plancherPriseMotifs(user).length
    ?PROT_PLANCHER_PRISE_RELEVE:PROT_PLANCHER_PRISE;
}
// PURE. LE POINT D'ENTRÉE. Rend null quand il n'y a rien à dire — et c'est le
// cas le plus fréquent, qu'il faut lire en premier :
//
// RÈGLE 3 : grossesse ou allaitement ⇒ RIEN. La prescription y est suspendue,
// et une répartition est une forme de prescription.
function repartitionPrises(user,macrosJour){
  try{ if(grossesseSuspend(user)) return null; }catch(e){}
  const r=protParRepas(user,macrosJour);
  if(!r) return null;
  const total=Math.round(Number(macrosJour&&macrosJour.p));
  const parts=repartitionProteines(total,r.nRepas);
  if(!parts) return null;
  const pl=plancherPrise(user);
  // La TENSION : la plus petite prise passe sous le plancher. On regarde la
  // plus petite et non la moyenne — c'est elle qui décrit la contrainte.
  const mini=Math.min.apply(null,parts);
  const tension=mini<pl;
  // RÈGLE : on ne propose JAMAIS d'augmenter le total. La seule variable qui
  // bouge est le nombre de prises, et jamais sous le minimum déjà retenu par
  // le produit — en dessous de trois, protParRepas ne rend rien du tout.
  let nSuggere=null;
  if(tension){
    const n=Math.max(REPAS_MIN,Math.floor(total/pl));
    if(n<r.nRepas) nSuggere=n;
  }
  return {nRepas:r.nRepas,total,parts,plancher:pl,mini,
    motifs:plancherPriseMotifs(user),tension,nSuggere};
}
// PURE. Le bonus ménopause doit-il être neutralisé ?
//
// LE CHOIX, ET POURQUOI. La spécification demandait de couper le bonus « quand
// la répartition est renseignée ». deb-meals-day est collecté à l'inscription :
// la condition aurait été vraie pour presque tout le monde, et une femme
// ménopausée aurait vu sa suggestion protéique BAISSER parce qu'elle a déclaré
// manger quatre fois par jour. Aucun lien ne relie ces deux choses.
//
// L'intention défendable derrière la consigne est d'éviter un DOUBLE COMPTAGE :
// que le bonus ne s'ajoute pas à un plancher par prise déjà relevé pour le même
// motif. C'est cette condition-là qui est retenue, et elle ne concerne que les
// dossiers réellement visés.
//
// AUCUN APPELANT N'EST BRANCHÉ DESSUS. protSuggeree n'est pas modifiée : les
// cinquante-quatre assertions du moteur de macros restent vraies, et cette
// fonction dit ce qu'il faudrait faire sans le faire à leur place. Le jour où
// le double comptage deviendra réel — le plancher par prise n'agit sur aucun
// total aujourd'hui — c'est ici que la décision est déjà écrite.
function bonusMenopauseNeutralise(user,macrosJour){
  const r=repartitionPrises(user,macrosJour);
  if(!r) return false;
  return r.motifs.indexOf('menopause')>=0;
}
const PRISE_PHRASE_PLANCHER='Repère : au moins '+PROT_PLANCHER_PRISE+' g de '
  +'protéines par prise. C\'est un ordre de grandeur, pas une consigne.';
const PRISE_PHRASE_RELEVE='Repère : au moins '+PROT_PLANCHER_PRISE_RELEVE+' g '
  +'de protéines par prise. C\'est un ordre de grandeur, pas une consigne.';
const PRISE_PHRASE_TENSION='Avec ce nombre de repas, chaque prise reste en '
  +'dessous de ce repère. Regrouper en moins de repas s\'en approche : le total '
  +'de la journée, lui, ne change pas.';
function phrasePlancherPrise(r){
  if(!r) return '';
  return (r.plancher===PROT_PLANCHER_PRISE_RELEVE)?PRISE_PHRASE_RELEVE:PRISE_PHRASE_PLANCHER;
}
// L'affichage. Les parts sont montrées telles quelles : quand elles ne sont pas
// toutes égales, c'est le prix de l'invariant, et le cacher derrière une
// moyenne serait mentir d'un gramme.
function _htmlRepartitionPrises(user,macrosJour){
  let r=null;
  try{ r=repartitionPrises(user,macrosJour); }catch(e){ r=null; }
  if(!r) return '';
  const egales=r.parts.every(x=>x===r.parts[0]);
  // LA LIGNE S ECRIT COMME UN CALCUL, et non comme une enumeration. Le point
  // median separait des parts sans dire ce qu on en faisait, et le tiret
  // cadratin annoncait un total sans dire d ou il venait : « 62 g · 62 g ·
  // 62 g · 61 g — 247 g au total » se lisait comme quatre nombres suivis d un
  // cinquieme. Avec les signes, la phrase se verifie a l oeil : 62 + 62 + 62
  // + 61 = 247. Demande de Kevin le 21/08/2026.
  // Le cas des parts EGALES garde sa multiplication, qui dit la meme chose en
  // plus court, et gagne le meme signe : 4 × 62 g = 248 g au total.
  const detail=egales
    ?r.nRepas+' × '+r.parts[0]+' g'
    :r.parts.join(' g + ')+' g';
  return `<div style="margin-top:8px;padding-top:8px;border-top:1px solid color-mix(in srgb,var(--text) 6%,transparent)">
    <div style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.6">${escapeHtml(detail)} = ${escapeHtml(String(r.total))} g au total.</div>
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:6px">${escapeHtml(phrasePlancherPrise(r))}</div>
    ${r.tension?`<div style="font-size:var(--fs-2xs);color:var(--text-dim);line-height:1.55;margin-top:6px">${escapeHtml(PRISE_PHRASE_TENSION)}${r.nSuggere?' Essaie '+r.nSuggere+' repas.':''}</div>`:''}
  </div>`;
}
// La vue coach : la répartition, le plancher, et la tension s'il y en a une.
// Aucun motif de santé n'est nommé — le coach voit le plancher relevé, pas
// pourquoi. La ménopause a son propre encart, qui appartient à l'athlète.
// N2.10 — CE QUE LA GRILLE AFFICHE, EN UN SEUL ENDROIT.
// La grille de macros montre, en mode automatique, le resultat de
// besoinsProposes recalcule ; le bloc « Proteines par prise » lisait, lui,
// nutrition.macros.on — la valeur ENREGISTREE. Sur un dossier pas encore
// enregistre, la meme fiche annoncait donc 190 g dans le champ PROT et
// « 4 x 44 g = 176 g » juste en dessous.
// Les deux passent maintenant par ici. Aucun recalcul n'est ajoute : c'est
// exactement ce que renderCoachNutriSection faisait deja pour lui seul.
function _calcAffiche(c){
  if(saisieManuelle(c)) return null;
  try{ const b=besoinsProposes(c,_propReglages());
    return (b&&b.source!==null)?b:null; }catch(e){ return null; }
}
// ⚠ _htmlRepartitionPrisesCoach ET renderRepartitionPrisesCoach ONT ETE
// RETIREES le 08/09/2026, avec la section « Proteines par prise » de la fiche
// coach. Kevin : « c'est inintéressant, dégage-le, il n'a rien à faire là ».
// Le bloc redisait le total de proteines de la grille juste au-dessus, divise
// par un nombre de repas que l'athlete regle lui-meme, et n'appelait aucune
// decision du coach.
// repartitionPrises, elle, RESTE : c'est l'ecran de l'athlete qui l'appelle,
// au moment de composer son assiette, ou le decoupage a un sens.

// ── Repère péri-entraînement ────────────────────────────────────────────────
// TROIS phrases, AUCUN chiffre. Elles ne disent pas quand manger ni combien :
// elles rappellent où placer une part de glucides déjà comptés dans le total du
// jour. Le total, lui, ne bouge pas.
//
// Rédaction RELUE ET VALIDÉE par Kevin Guellec le 3 août 2026, telle quelle.
// Le registre est celui du produit : un repère de terrain, pas une consigne.
// Toute modification de ces trois phrases demande une nouvelle validation —
// ce sont des textes de coaching, pas des libellés d'interface.
const REPERES_PERI=Object.freeze({
  'matin':"Séance le matin : place une part de tes glucides au repas précédent, "
    +"ou juste après si tu t'entraînes à jeun.",
  'apres-midi':"Séance l'après-midi : le déjeuner porte l'essentiel du travail. "
    +"Si la séance est loin du repas, une collation avant évite d'arriver à vide.",
  'soir':"Séance le soir : garde une part de tes glucides pour le repas qui suit, "
    +"plutôt que de tout placer en début de journée."
});
const REPERE_PERI_REGISTRE='Repère de terrain, à ajuster avec ton coach.';
// Le champ est en choix MULTIPLE : _dernierChamp rend un tableau. On retient la
// PREMIÈRE valeur reconnue, une seule fois — trois repères affichés côte à côte
// se contrediraient.
function _periSeanceCle(user){
  const brut=_dernierChamp(user,'deb-training-time');
  const l=Array.isArray(brut)?brut:(brut==null?[]:[brut]);
  for(const v of l){
    const n=_microNorm(v);
    if(!n) continue;
    if(/matin/.test(n)) return 'matin';
    if(/apres|midi/.test(n)) return 'apres-midi';
    if(/soir/.test(n)) return 'soir';
  }
  return null;
}
// Le repère ne s'affiche QUE les jours d'entraînement. Un jour de repos, il n'y
// a pas de séance autour de laquelle placer quoi que ce soit.
function repereSeance(user,dateStr){
  // Sur le planning de `user`, pas sur celui de l’utilisateur courant.
  if(!nutIsOnDay(dateStr,user)) return null;
  const c=_periSeanceCle(user);
  if(!c||!REPERES_PERI[c]) return null;
  return {cle:c,texte:REPERES_PERI[c]};
}
function _htmlReperesRepas(user,macrosJour,dateStr){
  const pr=protParRepas(user,macrosJour);
  let per=null;
  try{ per=repereSeance(user,dateStr); }catch(e){}
  if(!pr&&!per) return '';
  return `<div style="margin-top:10px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:12px 14px">
    ${pr?`<div style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.6">${escapeHtml(phraseProtParRepas(pr))}</div>`:''}
    ${per?`<div style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.6;margin-top:${pr?'6px':'0'}">${escapeHtml(per.texte)}</div>`:''}
    ${_htmlRepartitionPrises(user,macrosJour)}
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-top:8px">${escapeHtml(REPERE_PERI_REGISTRE)}</div>
  </div>`;
}

// Bascule du marqueur péri-séance, à la main. Elle n'écrit QUE ce booléen :
// aucun total n'est recalculé, aucun objectif n'est touché. C'est une note que
// l'athlète se laisse à lui-même, et que le coach peut lire.
function basculerPeriSeance(dateStr,id){
  const log=((currentUser.nutrition||{}).log)||{};
  const jour=log[dateStr];
  if(!jour||!Array.isArray(jour.entries)) return false;
  const e=jour.entries.find(x=>x&&String(x.id)===String(id));
  if(!e) return false;
  e.periSeance=!e.periSeance;
  const ok=saveUser();
  toastEcriture(ok,e.periSeance?'Marqué autour de la séance':'Marque retirée','la marque est');
  try{ _renderFjDaySummary(dateStr); }catch(err){}
  return true;
}

// `porteur` EST OPTIONNEL et retombe sur currentUser : les appelants sans
// dossier explicite — tous les écrans athlète — ne changent pas.
//
// IL EXISTE PARCE QUE CETTE FONCTION EST APPELÉE SUR DES DOSSIERS QUI NE SONT
// PAS CELUI DE L’UTILISATEUR COURANT : la fiche coach et le composeur de plan
// travaillent sur un client. Sans lui, les jours ON/OFF lus étaient ceux du
// COACH — ou tous OFF, puisqu’un coach n’a le plus souvent pas de
// sessions_config.
//
// LOT N7 : le calendrier d'abord ; puis, pour un jour CLOS, la marque posée à
// la fin d'une séance ce jour-là (jamais les séances relues après coup) ; et
// pour AUJOURD'HUI, la réalité (jourOnReel), en direct.
function nutIsOnDay(dateStr,porteur){
  const _u=porteur||currentUser;
  if(nutIsOnDayCalendrier(dateStr,_u)) return true;
  const n=_u&&_u.nutrition;
  if(n&&n.joursSeance&&n.joursSeance[dateStr]===true) return true;
  if(dateStr===localISODate(new Date())) return jourOnReel(_u,dateStr);
  return false;
}
// ══ LOT N7 : L'ASSIETTE SUIT LA SÉANCE RÉELLE (29/09/2026) ═══════════════
// Un jour OFF au calendrier où l'on s'est entraîné devient un jour ON : les
// cibles du jour d'entraînement s'appliquent. L'inverse n'existe pas (un jour
// ON sans séance reste ON : la séance peut encore venir).
//
// ⚠ CE QUI EST DÉJÀ MANGÉ NE BOUGE PAS : seules les cibles changent, le
//   journal reste tel quel.
// ⚠ JAMAIS RÉTROACTIF SUR UN JOUR CLOS. Aujourd'hui suit la réalité en
//   direct ; un jour passé ne relit PAS les séances. Il garde le calendrier,
//   sauf la marque posée À LA FIN d'une séance (nutrition.joursSeance), le jour
//   même. Une séance saisie après coup pour hier, ou effacée ensuite, ne change
//   donc rien aux cibles d'hier, ni aux volts ou aux séries qui en découlent.
const JOURS_SEANCE_GARDES=120;
const RAPPEL_GLUC_AVANT_MIN=180;      // la séance est dans les 3 heures
const RAPPEL_GLUC_PART=0.3;           // glucides du jour sous 30 % de la cible
const RAPPEL_GLUC_TEXTE='Ta séance est bientôt, il te reste l’essentiel de tes glucides.';
// Une séance compte comme faite quand au moins une série a été validée. Une
// séance quittée sans enregistrer ne laisse aucune trace ; une séance
// abandonnée sans série (ou marquée annulée) n'est pas un entraînement.
function _seanceFaite(s){
  if(!s||!(Number(s.date)>0)||s.annulee) return false;
  return seriesValideesSeance(s)>0;
}
/** PURE. Le jour est-il un jour d'entraînement au calendrier (sessions_config) ? */
function nutIsOnDayCalendrier(dateStr,porteur){
  const _u=porteur||currentUser;
  const cfg=_u&&_u.sessions_config;
  if(!cfg) return false;
  const [_y,_m,_day]=String(dateStr).split('-').map(Number);
  const d=new Date(_y,_m-1,_day);
  const idx=(d.getDay()+6)%7; // lundi=0
  return cfg[idx]?.active===true;
}
/**
 * PURE. Le jour ON réel : true si une séance a été TERMINÉE ce jour-là (jour
 * local), sinon la valeur du calendrier.
 */
function jourOnReel(user,dateISO){
  const ses=(user&&Array.isArray(user.sessions))?user.sessions:[];
  if(ses.some(s=>_seanceFaite(s)&&localISODate(new Date(Number(s.date)))===dateISO)) return true;
  return nutIsOnDayCalendrier(dateISO,user);
}
// La marque, posée par la fin de séance, le jour même, et nulle part ailleurs.
function marquerJourSeance(u,sess){
  if(!u||!_seanceFaite(sess)) return false;
  if(!u.nutrition) u.nutrition={};
  const n=u.nutrition, j=localISODate(new Date(Number(sess.date)));
  const m=(n.joursSeance&&typeof n.joursSeance==='object')?n.joursSeance:{};
  m[j]=true;
  // Le ménage : les 120 derniers jours suffisent à tout ce qui relit les cibles
  // d'un jour passé ; au-delà, le calendrier fait foi, comme avant ce lot.
  const lim=_jourPlus(j,-JOURS_SEANCE_GARDES);
  for(const k of Object.keys(m)) if(k<lim) delete m[k];
  n.joursSeance=m;
  return true;
}
// PURE. Le rappel d'avant-séance part-il maintenant ? {envoyer, raison}.
// Réglage coupé par défaut ; un par jour au plus ; jamais sous aTCA ni sous
// suspension ; seulement si le créneau du jour est dans les 3 heures, qu'aucune
// séance n'est déjà faite, et que les glucides sont sous 30 % de la cible.
function rappelAvantSeanceEtat(u,maintenant){
  const non=r=>({envoyer:false,raison:r});
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  if(!u||u.role==='coach') return non('coach');
  const n=u.nutrition||{};
  if(n.rappelAvantSeance!==true) return non('coupe');
  try{ if(aTCA(u)) return non('atca'); }catch(e){}
  try{ if(suspensionEtat(u).actif) return non('suspension'); }catch(e){}
  const j=localISODate(new Date(t));
  if(n.rappelAvantSeanceLe===j) return non('deja');
  if(((u.sessions)||[]).some(s=>_seanceFaite(s)&&localISODate(new Date(Number(s.date)))===j)) return non('faite');
  let c=null; try{ c=prochainCreneau(u,t); }catch(e){ c=null; }
  if(!c||c.dansJours!==0) return non('pas_de_seance');
  const d=new Date(t), dans=(c.h*60+c.m)-(d.getHours()*60+d.getMinutes());
  if(!(dans>0&&dans<=RAPPEL_GLUC_AVANT_MIN)) return non('trop_tot');
  let m=null; try{ m=_getEffectiveMacros(n,nutIsOnDay(j,u),j,u); }catch(e){ m=null; }
  const g=Number(m&&m.g);
  if(!(g>0)) return non('sans_cible');
  const tot=journalTotalJour(n.log||{},j);
  if(tot.c>=g*RAPPEL_GLUC_PART) return non('assez');
  return {envoyer:true,raison:'ok'};
}
// À l'ouverture de l'application : la bannière, et la notification système si
// l'application n'est pas au premier plan. La date est posée d'abord : un
// deuxième appel le même jour ne renvoie rien.
function verifierRappelAvantSeance(){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  const e=rappelAvantSeanceEtat(u,Date.now());
  if(!e.envoyer) return false;
  u.nutrition.rappelAvantSeanceLe=localISODate(new Date());
  try{ saveUser(); }catch(err){ rcErreurMuette('verifierRappelAvantSeance',err); }
  try{
    document.getElementById('rappel-gluc-banniere')?.remove();
    const b=document.createElement('div');
    b.id='rappel-gluc-banniere'; b.className='rg-banniere'; b.setAttribute('role','status');
    b.innerHTML='<span>'+escapeHtml(RAPPEL_GLUC_TEXTE)+'</span><button type="button" aria-label="Fermer" onclick="this.parentNode.remove()">'+icon('croix',14)+'</button>';
    document.body.appendChild(b);
    setTimeout(()=>{ try{ b.remove(); }catch(err){} },30000);
  }catch(err){}
  try{
    if(!_appAuPremierPlan()&&_notifSupported()&&Notification.permission==='granted')
      navigator.serviceWorker.ready.then(reg=>reg.showNotification('Avant ta séance',{
        body:RAPPEL_GLUC_TEXTE,icon:'./icons/icon-192x192.png',badge:'./icons/icon-192x192.png',
        tag:'rappel-glucides',data:{url:'./'}})).catch(()=>{});
  }catch(err){}
  return true;
}
function basculerRappelAvantSeance(on){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u) return false;
  if(!u.nutrition) u.nutrition={};
  u.nutrition.rappelAvantSeance=!!on;
  toastEcriture(saveUser(),on?'Rappel avant la séance activé':'Rappel avant la séance coupé','ton réglage est');
  return true;
}
// La ligne de l'écran nutrition : dite seulement quand la séance a changé les
// cibles (jour OFF au calendrier, diète cyclée).
function ligneJourSeance(u,jour){
  try{
    if(!dieteCyclee(u)) return '';
    if(nutIsOnDayCalendrier(jour,u)||!nutIsOnDay(jour,u)) return '';
  }catch(e){ return ''; }
  const auj=jour===localISODate(new Date());
  return auj?'Tu t’es entraîné aujourd’hui : cibles du jour d’entraînement.'
    :'Tu t’es entraîné ce jour-là : cibles du jour d’entraînement.';
}

function setNutriDietType(type){
  // Deuxième garde, au MOMENT de l'écriture : désactiver l'option de la liste
  // ne protège que la souris. Le champ reste atteignable au clavier et depuis
  // la console, et c'est ici que le refus doit tenir.
  if(type==='strict'){
    const a=accesDieteStricte(currentUser);
    if(!a.ok){
      toast(a.raison==='sans_coach'
        ?'La diète stricte est composée par un coach : il t\'en faut un.'
        :(a.raison==='referme'
          ?'Ton coach a refermé ta diète stricte, le temps de retravailler ton plan.'
          :'Ton coach ne t\'a pas encore ouvert la diète stricte.'),'var(--orange)');
      const s=document.getElementById('nut-diet-select');
      if(s) s.value=typeDiete(currentUser.nutrition||{});
      return;
    }
  }
  if(!currentUser.nutrition) currentUser.nutrition={};
  currentUser.nutrition.dietType=type;
  saveUser();
  const sel=document.getElementById('nut-diet-select');
  if(sel) sel.value=type;
  _renderNutriContent(type);
}

// ======= CYCLE NUTRITION (Diète Flexible uniquement) =======
// ── UNE seule source de vérité pour le cycle ──────────────────────────────
// Trois implémentations coexistaient : le modal d'entraînement avec un
// découpage 28 jours EN DUR dans ses libellés, le module nutritionnel qui
// CALCULE la phase depuis la date des dernières règles, et une case à cocher
// dans le calculateur. Sur un cycle de 35 jours à J26, la nutrition disait
// « stable » — correct — pendant que l'entraînement retirait une série au
// titre d'un « J22→J28 » qui n'existe pas à cette longueur. Deux verdicts
// opposés le même jour, sur le même dossier.
//
// confCycle lit user.cycle et retombe, CHAMP PAR CHAMP, sur l'ancien
// nutrition.cycleAdaptation. Champ par champ et non objet par objet : un
// dossier qui ne modifie qu'un réglage écrit une seule clé dans user.cycle,
// et un repli en bloc lui ferait perdre sa date de règles au premier clic.
// AUCUNE migration n'est écrite : le repli vit à la LECTURE.
function confCycle(user){
  const u=user||{};
  const a=(u.nutrition&&u.nutrition.cycleAdaptation)||{};
  const c=u.cycle||{};
  const pris=(x,y)=>x!==undefined?x:y;
  return {
    // 'enabled' ne figure pas dans la forme annoncée du champ, mais
    // l'algorithme de phase commence par lui : le retirer changerait le
    // comportement de tous les dossiers déjà configurés.
    enabled:!!pris(c.enabled,a.enabled),
    suivi:pris(c.suivi,u.cycleSuivi),
    lastPeriodDate:pris(c.lastPeriodDate,a.lastPeriodDate)||null,
    cycleLength:pris(c.cycleLength,a.cycleLength)||28,
    intensiteRegles:pris(c.intensiteRegles,a.intensite_regles)||'supportable',
    sensibilitePms:!!pris(c.sensibilitePms,a.sensibilite_pms),
    // La phase calculée ajuste-t-elle la charge ? NON par défaut (30/09/2026) :
    // seule une réponse déclarée du jour la modifie. true strict.
    ajusterAuto:pris(c.ajusterAuto,a.ajusterAuto)===true,
    // PAS de !! ici, et c'est capital : « pas déclaré » doit rester distinct
    // de « déclaré irrégulier ». Avec la coercition, tout dossier n'ayant
    // jamais rien dit lisait regulier === false, donc cycleIrregulier vrai,
    // donc PLUS AUCUN ajustement automatique — pour toutes les athlètes à la
    // fois, et sans un mot.
    regulier:pris(c.regulier,a.regulier)
  };
}
// ── Le calendrier cesse de projeter à l'infini ────────────────────────────
// Le modulo faisait tourner le cycle indéfiniment sur une date jamais
// réactualisée : une athlète dont les règles se sont arrêtées voyait le
// produit continuer à annoncer des phases, ajuster ses macros et lui ajouter
// un complément. Ailleurs, le produit refuse systématiquement de calculer sur
// une donnée insuffisante — besoinsProposes rend source:null, mm7 exige quatre
// pesées. C'est la même exigence qui s'applique ici.
const CYCLE_PEREMPTION_MARGE=10;        // jours de grâce au-delà de la longueur
const CYCLE_REGLES_MAX=24;              // entrées conservées, comme weightLog
const CYCLE_MIN_CYCLES_OBSERVES=3;      // entrées avant d'oser une longueur
const CYCLE_ECART_IRREGULIER=4;         // écart-type en jours
// Un intervalle hors de ces bornes n'est pas un cycle : il est EXCLU du calcul
// mais CONSERVÉ dans le journal — c'est peut-être l'information la plus utile.
const CYCLE_INTERVALLE_MIN=15, CYCLE_INTERVALLE_MAX=90;
// LA serrure : aucun effet automatique — macros, complément, volume, charge —
// ne doit découler d'autre chose que de ces trois phases. Une liste unique
// vaut mieux que six comparaisons dispersées qu'on oublierait d'étendre.
const CYCLE_PHASES_AGISSANTES=Object.freeze(['menstrual','luteal_late','stable']);
function phaseAgissante(phase){
  return CYCLE_PHASES_AGISSANTES.indexOf(phase)>=0;
}
const CYCLE_MSG_IRREGULIER='Tes cycles varient trop pour qu\'un calendrier soit '
  +'fiable. Indique-moi comment tu te sens avant chaque séance, c\'est plus juste.';
// Le journal des règles. Dédoublonné, trié, borné — même mécanique que
// weightLog, pour la même raison : un jour n'a qu'une valeur.
function _cycleRegles(user){
  const c=(user&&user.cycle)||{};
  const l=(Array.isArray(c.regles)?c.regles:[])
    .filter(x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x));
  return Array.from(new Set(l)).sort();
}
function _cycleIntervalles(user){
  const l=_cycleRegles(user), out=[];
  for(let i=1;i<l.length;i++) out.push(_joursEntre(l[i-1],l[i]));
  return out;
}
function _cycleIntervallesRetenus(user){
  return _cycleIntervalles(user)
    .filter(x=>x>=CYCLE_INTERVALLE_MIN&&x<=CYCLE_INTERVALLE_MAX);
}
// PURE. Médiane des intervalles retenus. Le seuil porte sur les ENTRÉES du
// journal et non sur les intervalles : trois dates observées font deux
// intervalles, et c'est ce cas que le critère d'acceptation chiffre.
function longueurObservee(user){
  const v=_cycleIntervallesRetenus(user);
  if(v.length<CYCLE_MIN_CYCLES_OBSERVES-1) return null;
  const t=v.slice().sort((a,b)=>a-b);
  const n=t.length;
  return n%2?t[(n-1)/2]:Math.round((t[n/2-1]+t[n/2])/2);
}
// Nombre de cycles sur lesquels la longueur observée repose, pour le dire à
// l'écran : deux intervalles, c'est trois règles observées.
function _cyclesObserves(user){
  const v=_cycleIntervallesRetenus(user);
  return v.length?v.length+1:0;
}
// PURE. La déclaration explicite suffit — elle n'a pas besoin d'un journal
// pour être vraie. Sinon, c'est la dispersion des intervalles qui parle.
function cycleIrregulier(user){
  // La périménopause EST l'irrégularité : aucune autre condition n'est
  // requise, et phaseCycle rend 'irregulier'. Le ressenti déclaré avant la
  // séance reprend la main, ce qui est plus juste qu'un calendrier.
  if(statutHormonal(user)==='perimenopause'&&_hormonalApplicable(user)) return true;
  const c=(user&&user.cycle)||{};
  if(c.regulier===false) return true;
  const v=_cycleIntervallesRetenus(user);
  if(v.length<CYCLE_MIN_CYCLES_OBSERVES-1) return false;
  const moy=v.reduce((a,b)=>a+b,0)/v.length;
  const ec=Math.sqrt(v.reduce((a,b)=>a+(b-moy)*(b-moy),0)/v.length);
  return ec>CYCLE_ECART_IRREGULIER;
}
// Jours écoulés depuis la dernière date déclarée, ou null.
function joursDepuisRegles(user,dateISO){
  const conf=confCycle(user);
  if(!conf.lastPeriodDate) return null;
  const d=Math.floor((new Date((dateISO||localISODate(new Date()))+'T00:00:00')
    -new Date(conf.lastPeriodDate+'T00:00:00'))/86400000);
  return d<0?null:d;
}
function messageCyclePerime(user,dateISO){
  const n=joursDepuisRegles(user,dateISO);
  if(n==null) return '';
  return 'Ta dernière date de règles remonte à '+n+' jours. Mets-la à jour '
    +'pour que les ajustements reprennent.';
}
// ══════════ GROSSESSE : LE PRODUIT CESSE DE PRESCRIRE ══════════
// Chez une athlète enceinte, la sèche restait accessible, ajustementPropose
// proposait des baisses, le plancher était celui d'une non-enceinte, la
// limite de caféine restait à 400 mg, le modal de cycle s'affichait avant
// chaque séance, et la prise de poids ATTENDUE était signalée comme une
// dérive.
//
// RepCore ne devient PAS un accompagnement de grossesse. Il n'y a ici aucune
// courbe de poids, aucun apport par trimestre, aucun programme prénatal,
// aucune liste d'exercices : seulement des SUSPENSIONS de ce qui est
// contre-indiqué, et un renvoi vers qui suit la grossesse.
const GROSSESSE_ETATS=Object.freeze([
  Object.freeze({cle:'enceinte',   lib:'Je suis enceinte'}),
  Object.freeze({cle:'allaitement',lib:'J\'allaite'}),
  Object.freeze({cle:'post_partum',lib:'Je suis en post-partum'})
]);
// PURE. Aucune date de terme, aucun trimestre, aucune date d'accouchement :
// le produit n'en a pas besoin pour cesser de prescrire.
function etatGrossesse(user){
  const e=((user&&user.grossesse)||{}).etat;
  return GROSSESSE_ETATS.some(x=>x.cle===e)?e:null;
}
// Les états qui SUSPENDENT. Le post-partum n'en fait pas partie : il ne
// suspend rien, il pose une question au moment de repartir en sèche.
function grossesseSuspend(user){
  const e=etatGrossesse(user);
  return e==='enceinte'||e==='allaitement';
}
const GROSSESSE_MSG='Merci de me l\'avoir dit. RepCore n\'est pas conçu pour '
  +'accompagner une grossesse : je désactive les objectifs de perte de poids, '
  +'les alertes de poids et je baisse ta limite de caféine à 200 mg. Ton suivi '
  +'et ton entraînement restent disponibles. Pour l\'alimentation et l\'activité '
  +'pendant ta grossesse, c\'est ton médecin ou ta sage-femme qui te suit.';
// Sans AUCUN chiffre : le surcoût de la lactation varie trop pour être annoncé,
// et l'annoncer serait exactement le genre de prescription que ce lot retire.
const GROSSESSE_MSG_ALLAITEMENT='Ton besoin est plus élevé pendant '
  +'l\'allaitement, dans une proportion qui varie beaucoup : c\'est à voir avec '
  +'un professionnel.';
const GROSSESSE_REFUS_SECHE='Pas d\'objectif de perte de poids pendant cette '
  +'période. C\'est ton médecin ou ta sage-femme qui suit ce sujet.';
const GROSSESSE_Q_POSTNATALE='As-tu eu ta visite post-natale ?';

// ══════════════ RETOUR POST-PARTUM : TROIS FENÊTRES, AUCUNE APTITUDE ══════
// Le post-partum était une simple déclaration : il ne suspendait rien et
// posait une question au moment de repartir en sèche. Il le fait toujours —
// ce chemin est INTÉGRÉ, jamais remplacé, et deux assertions l'épinglent.
//
// CE QUE CE LOT AJOUTE : une date d'accouchement OPTIONNELLE, dont se
// dérivent trois fenêtres. Sans date, rien ne change, strictement.
//
// LES FENÊTRES SONT EN SEMAINES. C'est la seule lecture qui rende les cinq
// critères cohérents entre eux : J-30 vaut quatre semaines et tombe en 0_6 ;
// J-100 vaut quatorze semaines, donc 12_plus, que la césarienne décale d'un
// cran EN ARRIÈRE vers 6_12 ; J-120 vaut dix-sept semaines et reste en
// 12_plus. Le décalage va vers PLUS de prudence, ce qui s'accorde avec le
// renvoi renforcé — l'inverse aurait allégé les précautions après une
// chirurgie, ce qu'aucune lecture honnête de la consigne ne permet.
//
// CE QUE REPCORE NE FAIT PAS ICI : aucun test physique, aucune validation
// d'aptitude, aucun terme médical à l'athlète, aucune justification
// physiologique. Il cesse de proposer, et il renvoie.
const PP_FENETRES=Object.freeze(['0_6','6_12','12_plus']);
const PP_SEM_0_6=6, PP_SEM_6_12=12;
// RÈGLE 4 : au-delà de douze MOIS, l'état devient informatif. Ce seuil-ci est
// en mois, à la différence des fenêtres — les deux « 12 » ne parlent pas de la
// même unité, et les confondre était le piège de ce lot.
const PP_SEM_INFORMATIF=52;
const PP_QUESTION_JOURS=7;
const PP_MODES_NAISSANCE=Object.freeze([
  Object.freeze({cle:'voie_basse',lib:'Voie basse'}),
  Object.freeze({cle:'cesarienne',lib:'Césarienne'})
]);
// Trois questions, en mots courants. Aucun terme médical, aucune explication
// de ce qu'un symptôme « signifie » : on demande, on ne commente pas.
const PP_SYMPTOMES=Object.freeze([
  Object.freeze({cle:'fuites',   q:'As-tu des fuites urinaires à l\'effort ?'}),
  Object.freeze({cle:'pesanteur',q:'Ressens-tu une pesanteur dans le bas-ventre ?'}),
  Object.freeze({cle:'douleur',  q:'As-tu des douleurs pendant ou après l\'effort ?'})
]);
const PP_RENVOI='Une sage-femme ou un kinésithérapeute spécialisé peut faire le '
  +'point avec toi avant de reprendre les impacts. RepCore ne remplace pas cet '
  +'avis et n\'évalue rien lui-même.';
const PP_RENVOI_CESARIENNE='Après une césarienne, ce point est à faire avant de '
  +'reprendre les impacts, avec une sage-femme ou un kinésithérapeute '
  +'spécialisé. RepCore ne remplace pas cet avis et n\'évalue rien lui-même.';
const PP_RENVOI_SYMPTOME='Tu as signalé quelque chose. Ce point mérite un avis '
  +'avant de reprendre les impacts : une sage-femme ou un kinésithérapeute '
  +'spécialisé saura te dire où tu en es.';
const PP_TITRE='Reprise après accouchement';
// PURE. Le sous-nœud, sans jamais l'écrire. Il vit DANS user.grossesse, qui
// est un bloc privé : la date d'accouchement est une donnee de sante, et elle
// suit exactement la meme regle de partage que le reste du bloc.
function ppEtat(user){
  const g=(user&&user.grossesse)||{};
  const p=(g&&g.pp)||{};
  const mode=PP_MODES_NAISSANCE.some(x=>x.cle===g.modeNaissance)?g.modeNaissance:null;
  return {
    date:(typeof g.dateAccouchement==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(g.dateAccouchement))
      ?g.dateAccouchement:null,
    mode,
    symptomes:(p.symptomes&&typeof p.symptomes==='object')?p.symptomes:{},
    dateSymptomes:Number(p.dateSymptomes)||0,
    dernierePropo:Number(p.dernierePropo)||0,
    evaluationPerineale:p.evaluationPerineale===true,
    levee:(p.levee&&typeof p.levee==='object')?p.levee:null
  };
}
// PURE. RÈGLE 1 : aucune date ⇒ null, et TOUT le module se tait. On n'infère
// jamais une date depuis un bilan, un âge ou quoi que ce soit d'autre.
function ppSemaines(user,now){
  const e=ppEtat(user);
  if(!e.date) return null;
  const t=(typeof now==='number')?now:Date.now();
  const d=new Date(e.date+'T00:00:00');
  if(isNaN(d.getTime())) return null;
  // Math.floor, ET NON round : une derive d'une heure fait basculer le rang
  // juste au bord. On compte les jours en calendrier, puis on en fait des
  // semaines — la division ne porte plus alors sur des millisecondes.
  const sem=Math.floor(Math.round((t-d.getTime())/864e5)/7);
  return sem>=0?sem:null;
}
// PURE. Un cran en arrière, jamais en dessous de la plus prudente.
function _ppReculer(f){
  const i=PP_FENETRES.indexOf(f);
  return i<=0?PP_FENETRES[0]:PP_FENETRES[i-1];
}
// PURE. Un symptôme déclaré, quel qu'il soit.
function ppSymptomePositif(user){
  const s=ppEtat(user).symptomes;
  return PP_SYMPTOMES.some(x=>s[x.cle]===true);
}
// PURE. La fenêtre effective, décalages compris.
//
// RÈGLE 4 contre RÈGLE 2 : au-delà de douze mois l'état devient informatif et
// n'a plus d'effet sur les fenêtres — donc null, MÊME avec un symptôme. La
// règle 2 continue de valoir pour le RENVOI, qui lui ne s'éteint pas : voir
// ppRenvoi. C'est la seule façon de tenir les deux sans qu'une des deux mente.
function ppFenetre(user,now){
  const sem=ppSemaines(user,now);
  if(sem===null) return null;
  if(sem>=PP_SEM_INFORMATIF) return null;
  let f=(sem<PP_SEM_0_6)?'0_6':(sem<PP_SEM_6_12?'6_12':'12_plus');
  if(ppEtat(user).mode==='cesarienne') f=_ppReculer(f);
  if(ppSymptomePositif(user)) f=_ppReculer(f);
  return f;
}
// PURE. L'impact est-il proposable ? RÈGLE 3 : ce n'est PAS une validation
// d'aptitude. RepCore ne dit pas « tu peux » — il cesse seulement de refuser
// de proposer, une fois que quelqu'un dont c'est le métier a fait le point.
// Sans date : null, c'est-à-dire « la question ne se pose pas », et le
// comportement d'avant ce lot vaut.
function ppImpactAutorise(user,now){
  const f=ppFenetre(user,now);
  if(f===null) return null;
  // LA LEVÉE DU COACH. Elle ne supprime pas la fenêtre — celle-ci reste
  // affichée, avec sa date et sa cause — elle lève le refus de proposer.
  // C'est une décision de coach, tracée et horodatée, du même ordre que le
  // droit de fixer une macro à la main : on retire l'automatisme, pas la
  // liberté de celui qui suit l'athlète.
  if(ppLeveeActive(user)) return true;
  if(f!=='12_plus') return false;
  if(!ppEtat(user).evaluationPerineale) return false;
  return !ppSymptomePositif(user);
}
// PURE. Le renvoi qui convient, ou rien. La règle 2 s'applique ICI sans
// limite d'ancienneté : un symptôme déclaré renvoie toujours.
function ppRenvoi(user,now){
  const e=ppEtat(user);
  if(!e.date) return '';
  if(ppSymptomePositif(user)) return PP_RENVOI_SYMPTOME;
  const f=ppFenetre(user,now);
  if(f===null) return '';
  if(e.mode==='cesarienne') return PP_RENVOI_CESARIENNE;
  return (f==='12_plus'&&e.evaluationPerineale)?'':PP_RENVOI;
}
// PURE. Les protocoles proposables en fenêtre basse : mobilité et intensité
// faible, pris de la bibliothèque EXISTANTE. Aucune taxonomie d'impact n'est
// inventée sur les exercices — il n'en existe pas dans le produit, et en
// créer une reviendrait à classer des mouvements par risque périnéal, ce que
// la doctrine interdit.
const PP_OBJECTIFS_DOUX=Object.freeze(['MOBILITE','RECUPERATION']);
const PP_INTENSITES_DOUCES=Object.freeze(['FAIBLE','TRES_FAIBLE']);
function ppProtocolesDoux(){
  try{
    return PROTOCOLES.filter(p=>p&&PP_OBJECTIFS_DOUX.indexOf(p.objectif)>=0
      &&PP_INTENSITES_DOUCES.indexOf(p.intensite)>=0);
  }catch(e){ return []; }
}
// PURE. Le questionnaire est-il à proposer ? Une fois par semaine, en 6_12,
// et JAMAIS imposé — c'est une proposition, refusable en fermant l'encart.
function ppProposerQuestions(user,now){
  const f=ppFenetre(user,now);
  if(f!=='6_12') return false;
  const t=(typeof now==='number')?now:Date.now();
  const e=ppEtat(user);
  return !(e.dernierePropo&&(t-e.dernierePropo)<PP_QUESTION_JOURS*864e5);
}
// PURE. La levée du coach est-elle active ? Elle ne supprime pas la fenêtre —
// elle lève le refus de proposer de l'impact, et laisse la trace.
function ppLeveeActive(user){
  const l=ppEtat(user).levee;
  return !!(l&&l.date);
}
// PURE. Ce que le coach peut voir. RÈGLE DU BLOC PRIVÉ : `grossesse` ne quitte
// l'appareil que si l'athlète a ouvert le partage. Le coach ne reçoit donc
// simplement PAS le nœud sans cela — cette fonction dit la même chose que le
// réseau, pour que l'écran ne promette pas ce que la synchronisation ne livre
// pas.
function ppVisibleCoach(c){
  try{ return !!santeVisibleCoach(c,'grossesse'); }catch(e){ return false; }
}
// ── L'écran athlète ───────────────────────────────────────────────────────
// Deux champs OPTIONNELS, et rien qui ressemble à un dossier obstétrical. La
// carte ne s'ouvre que sur l'état post-partum déclaré : personne d'autre n'a
// à voir cette question.
const PP_INTRO='Si tu veux, indique ta date d\'accouchement. RepCore s\'en sert '
  +'seulement pour arrêter de te proposer certaines choses trop tôt. Tu peux '
  +'laisser vide : rien ne change alors.';
const PP_LIB_FENETRES=Object.freeze({
  '0_6':'Les premières semaines',
  '6_12':'Reprise progressive',
  '12_plus':'Reprise complète'
});
function _htmlPostPartum(user){
  const u=user||currentUser;
  if(etatGrossesse(u)!=='post_partum') return '';
  const e=ppEtat(u);
  const f=ppFenetre(u);
  const renvoi=ppRenvoi(u);
  const modes=PP_MODES_NAISSANCE.map(m=>
    `<div class="obj-opt${e.mode===m.cle?' sel':''}" onclick="ppSetMode('${m.cle}')"
      role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
      <div style="font-weight:800">${escapeHtml(m.lib)}</div>
    </div>`).join('');
  // La fenêtre est nommée en mots courants. Aucun terme médical, aucune
  // justification de ce qui se passe dans le corps : RepCore décrit ce qu'il
  // fait, pas ce qu'elle est.
  const bloc=f?`<div style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.7;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
      <b>${escapeHtml(PP_LIB_FENETRES[f]||'')}</b>${f==='0_6'
        ?' : je te propose seulement de la mobilité et des échauffements.'
        :(f==='6_12'?' : du renforcement progressif, sans impact.'
          :(ppImpactAutorise(u)?' : plus de restriction de ma part.'
            :' : les impacts attendent que tu aies fait le point.'))}
    </div>`:'';
  const evalRow=(f==='12_plus'||f==='6_12')
    ?`<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;margin-top:10px">
        <input type="checkbox" ${e.evaluationPerineale?'checked':''} onchange="ppSetEvaluation(this.checked)"
          style="width:16px;height:16px;accent-color:var(--red);flex-shrink:0;margin-top:2px">
        <span style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.55">J'ai fait le point avec une sage-femme ou un kinésithérapeute.</span>
      </label>`:'';
  return `<div class="card" style="margin-bottom:14px">
    <label style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:8px">${escapeHtml(PP_TITRE)}</label>
    <div style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.7;margin-bottom:10px">${escapeHtml(PP_INTRO)}</div>
    <input type="date" value="${escapeHtml(e.date||'')}" onchange="ppSetDate(this.value)"
      aria-label="Date d'accouchement"
      style="width:100%;padding:10px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-2);color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-sm)">
    ${e.date?`<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">${modes}</div>`:''}
    ${bloc}${evalRow}
    ${renvoi?`<div style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.7;margin-top:10px">${escapeHtml(renvoi)}</div>`:''}
    ${e.date?`<button onclick="ppEffacerDate()" class="btn btn-outline btn-sm" style="width:100%;margin-top:10px;font-size:var(--fs-2xs);letter-spacing:1px;color:var(--sub)">Retirer cette date</button>`:''}
    ${blocDisclaimerSante()}
  </div>`;
}
// ── Le questionnaire ─────────────────────────────────────────────────────
// PROPOSÉ, jamais imposé : « Plus tard » repousse d'une semaine et le refus
// n'a aucun effet sur la fenêtre. Seules les réponses POSITIVES agissent.
function _htmlPpQuestions(user){
  const u=user||currentUser;
  if(!ppProposerQuestions(u)) return '';
  const s=ppEtat(u).symptomes;
  return `<div class="card" style="margin-bottom:14px">
    <label style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:10px">Comment ça se passe ?</label>
    ${PP_SYMPTOMES.map(x=>`<div style="padding:8px 0;border-top:1px solid color-mix(in srgb,var(--text) 6%,transparent)">
      <div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6;margin-bottom:6px">${escapeHtml(x.q)}</div>
      <div style="display:flex;gap:6px">
        ${[['0','Non'],['1','Oui']].map(([v,l])=>
          `<button type="button" onclick="ppRepondre('${x.cle}',${v},this)"
            style="flex:1;min-height:36px;border-radius:var(--r-2);cursor:pointer;font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;
              background:${s[x.cle]===(v==='1')?'rgba(224,32,32,.14)':'#111'};border:1px solid ${s[x.cle]===(v==='1')?'var(--red)':'var(--border)'};color:${s[x.cle]===(v==='1')?'var(--text)':'var(--sub)'}">${l}</button>`).join('')}
      </div>
    </div>`).join('')}
    <button class="btn btn-red" style="width:100%;margin-top:12px" onclick="ppValiderQuestions()">Envoyer</button>
    <button class="btn btn-outline" style="width:100%;margin-top:8px" onclick="ppPlusTard()">Plus tard</button>
  </div>`;
}
let _ppRep={};
function ppRepondre(cle,v,el){
  _ppRep[cle]=(Number(v)===1);
  try{
    const p=el.parentNode;
    for(const b of p.children){ b.style.background='#111'; b.style.borderColor='var(--border)'; b.style.color='var(--sub)'; }
    el.style.background='rgba(224,32,32,.14)'; el.style.borderColor='var(--red)'; el.style.color='var(--text)';
  }catch(e){}
  return true;
}
function _ppNoeud(){
  if(!currentUser.grossesse||typeof currentUser.grossesse!=='object') currentUser.grossesse={};
  if(!currentUser.grossesse.pp||typeof currentUser.grossesse.pp!=='object') currentUser.grossesse.pp={};
  return currentUser.grossesse.pp;
}
function ppSetDate(v){
  const ok=/^\d{4}-\d{2}-\d{2}$/.test(String(v||''));
  if(!currentUser.grossesse||typeof currentUser.grossesse!=='object') currentUser.grossesse={};
  if(ok) currentUser.grossesse.dateAccouchement=String(v);
  else delete currentUser.grossesse.dateAccouchement;
  saveUser(); _renderPostPartum();
  return true;
}
function ppEffacerDate(){
  if(currentUser.grossesse) delete currentUser.grossesse.dateAccouchement;
  saveUser(); _renderPostPartum();
  return true;
}
function ppSetMode(cle){
  if(!PP_MODES_NAISSANCE.some(x=>x.cle===cle)) return false;
  if(!currentUser.grossesse||typeof currentUser.grossesse!=='object') currentUser.grossesse={};
  currentUser.grossesse.modeNaissance=cle;
  saveUser(); _renderPostPartum();
  return true;
}
function ppSetEvaluation(v){
  _ppNoeud().evaluationPerineale=(v===true);
  saveUser(); _renderPostPartum();
  return true;
}
function ppValiderQuestions(){
  const n=_ppNoeud();
  const s=(n.symptomes&&typeof n.symptomes==='object')?n.symptomes:{};
  for(const x of PP_SYMPTOMES) if(_ppRep[x.cle]!==undefined) s[x.cle]=_ppRep[x.cle];
  n.symptomes=s; n.dateSymptomes=Date.now(); n.dernierePropo=Date.now();
  _ppRep={};
  saveUser(); _renderPostPartum();
  return true;
}
// Refuser n'a AUCUN effet sur la fenêtre : c'est ce qui fait qu'il s'agit
// d'une proposition et non d'un passage obligé.
function ppPlusTard(){
  _ppNoeud().dernierePropo=Date.now();
  _ppRep={};
  saveUser(); _renderPostPartum();
  return true;
}
function _renderPostPartum(){
  const z=document.getElementById('atp-pp');
  if(!z) return;
  let h=''; try{ h=_htmlPostPartum(currentUser)+_htmlPpQuestions(currentUser); }catch(e){ h=''; }
  z.innerHTML=h;
}
// ── La carte coach ────────────────────────────────────────────────────────
// Elle ne s'affiche QUE si l'athlète a ouvert le partage du bloc grossesse.
// Sans cela, le nœud n'atteint même pas le coach : le dire à l'écran évite de
// promettre ce que la synchronisation ne livre pas.
function _htmlPostPartumCoach(c){
  if(!c||etatGrossesse(c)!=='post_partum') return '';
  if(!ppVisibleCoach(c)) return '';
  const e=ppEtat(c);
  if(!e.date) return '';
  const f=ppFenetre(c);
  const dat=t=>{ try{ return new Date(t).toLocaleDateString('fr-FR'); }catch(x){ return ''; } };
  const causes=[];
  if(e.mode==='cesarienne') causes.push('césarienne');
  if(ppSymptomePositif(c)) causes.push('signalement de l\'athlète');
  if(f==='12_plus'&&!e.evaluationPerineale) causes.push('point non encore fait');
  const impact=ppImpactAutorise(c);
  return `<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:16px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:8px">
      <span style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase">${escapeHtml(PP_TITRE)}</span>
      <span style="font-size:var(--fs-xs);font-weight:800;color:${impact===true?'var(--sub)':'var(--orange)'}">${escapeHtml(f?(PP_LIB_FENETRES[f]||''):'Informatif')}</span>
    </div>
    <div style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.7">Début de la fenêtre : ${escapeHtml(dat(new Date(e.date+'T00:00:00').getTime()))}.</div>
    ${causes.length?`<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.7">Cause : ${escapeHtml(causes.join(', '))}.</div>`:''}
    <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.7">Impacts ${impact===true?'sans restriction de RepCore':'non proposés par RepCore'}.</div>
    ${e.levee?`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">Levée le ${escapeHtml(dat(e.levee.date))}${e.levee.par?' par '+escapeHtml(e.levee.par):''}.</div>`
      :`<button onclick="ppCoachLever()" class="btn btn-outline btn-sm" style="width:100%;margin-top:10px;font-size:var(--fs-2xs);letter-spacing:1px">Lever pour cette athlète</button>`}
    ${blocDisclaimerSante()}
  </div>`;
}
// ÉCRIT sur le dossier de l'ATHLÈTE, par la carte des utilisateurs — même
// chemin que coachLeverDrapeau. La trace est horodatée et n'est jamais
// effacée par ce module.
async function ppCoachLever(){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c||!c.email) return false;
  if(!ppVisibleCoach(c)) return false;
  if(!await rcConfirm('Lever la restriction d\'impacts pour cette athlète ? La trace restera dans son dossier.',null,'Lever')) return false;
  if(!c.grossesse||typeof c.grossesse!=='object') c.grossesse={};
  if(!c.grossesse.pp||typeof c.grossesse.pp!=='object') c.grossesse.pp={};
  c.grossesse.pp.levee={date:Date.now(),par:(currentUser&&(currentUser.fname||currentUser.email))||'coach'};
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(c.email,c),'Restriction levée','la levée est');
  try{ renderPostPartumCoach(c); }catch(e){}
  return true;
}
function renderPostPartumCoach(c){
  const z=document.getElementById('ccd-pp');
  if(!z) return;
  let h=''; try{ h=c?_htmlPostPartumCoach(c):''; }catch(e){ h=''; }
  z.innerHTML=h;
}
// ── Contraception : le modèle calendaire ne s'applique pas à tout le monde ──
// Sous contraception combinée en continu, il n'y a ni ovulation ni phase
// lutéale physiologique. Le produit demandait pourtant une « date des dernières
// règles » à quelqu'un qui n'en a pas, puis lui projetait des phases, ajustait
// ses macros et lui suggérait un complément.
//
// Aucun nom de produit, aucun dosage, aucune date de début, aucun conseil : la
// seule chose dont le calcul a besoin est de savoir si un calendrier veut dire
// quelque chose.
const CONTRACEPTIONS=Object.freeze([
  Object.freeze({cle:'aucune',       lib:'Pas de contraception hormonale'}),
  Object.freeze({cle:'non_hormonale',lib:'Stérilet au cuivre'}),
  Object.freeze({cle:'cyclique',     lib:'Contraception hormonale avec une pause / des saignements réguliers'}),
  Object.freeze({cle:'continue',     lib:'Contraception hormonale en continu / pas de saignements'}),
  Object.freeze({cle:'ne_dit_pas',   lib:'Je préfère ne pas répondre'})
]);
const CYCLE_MSG_SANS_CYCLE='Sous contraception en continu, il n\'y a pas de '
  +'phases à suivre. Tu peux toujours m\'indiquer comment tu te sens avant '
  +'chaque séance.';
// Absent = non déclaré, traité comme 'aucune' : aucun dossier existant ne
// change de comportement du jour au lendemain.
function contraceptionDe(user){
  const v=((user&&user.cycle)||{}).contraception;
  return CONTRACEPTIONS.some(x=>x.cle===v)?v:'aucune';
}
// Pas de cycle à modéliser du tout.
function cycleSansCycle(user){
  const c=contraceptionDe(user);
  return c==='continue'||c==='ne_dit_pas';
}
// Le calendrier existe — la plaquette — mais il ne décrit AUCUNE physiologie.
// Les repères de dates tiennent, les ajustements métaboliques non.
//
// C'est une fonction SÉPARÉE et non un champ ajouté au retour de phaseCycle :
// cinquante-six sites comparent son résultat à une chaîne, et un objet y serait
// truthy sans jamais égaler 'luteal_late'. Rien ne planterait, tous les effets
// disparaîtraient en silence — y compris ceux qu'on veut garder. Même raison
// que _ajustAdherenceBloque, exposée à côté d'ajustementPropose plutôt que
// glissée dans son retour.
function cycleCalendaireSeul(user){
  return contraceptionDe(user)==='cyclique';
}
// PURE. Plus de modulo : un calendrier qui se répète tout seul finit toujours
// par mentir. Au-delà de la longueur du cycle plus la marge, on ne sait plus,
// et on le DIT au lieu de projeter.
function phaseCycle(user,dateISO){
  // AVANT la configuration : une athlète sous contraception continue n'a
  // aucune raison d'avoir renseigné une date de règles, et le message doit
  // quand même pouvoir s'afficher. Une date renseignée malgré tout est
  // conservée dans le dossier, simplement inutilisée.
  if(cycleSansCycle(user)) return 'sans_cycle';
  const conf=confCycle(user);
  if(!conf.enabled||!conf.lastPeriodDate) return null;
  // L'irrégularité passe AVANT tout : un calendrier n'y veut rien dire, quelle
  // que soit la date.
  if(cycleIrregulier(user)) return 'irregulier';
  // La longueur OBSERVÉE prime sur la longueur déclarée dès qu'elle existe.
  // Bornée comme l'autre : une médiane reste une estimation.
  const len=Math.max(20,Math.min(40,longueurObservee(user)||conf.cycleLength||28));
  // N2.19 — UNE DATE ABSENTE EST UN REFUS, PAS UNE PHASE. Le composeur de plan
  // appelait planCiblesJour(c,true,null) : ce null arrivait ici, produisait
  // new Date('nullT00:00:00'), un diffDays a NaN, aucune des trois bornes
  // franchie — et la fonction rendait « stable ». L'adaptation de cycle
  // n'etait donc JAMAIS appliquee dans l'apercu du coach, sans erreur ni
  // message. Un echec silencieux vaut moins que pas de reponse du tout.
  if(typeof dateISO!=='string'||!/^\d{4}-\d{2}-\d{2}/.test(dateISO)) return null;
  const diffDays=Math.floor((new Date(dateISO+'T00:00:00')-new Date(conf.lastPeriodDate+'T00:00:00'))/86400000);
  if(diffDays<0) return null;
  const jour=diffDays+1;
  if(jour>len+CYCLE_PEREMPTION_MARGE) return 'perime';
  if(jour<=5) return 'menstrual';
  if(jour>=Math.ceil(len*0.80)+1) return 'luteal_late';
  return 'stable';
}
// Écritures du journal. Le tableau est borné par la FIN : ce sont les plus
// anciennes qui sont évincées.
function _cycleAjouterRegles(user,dateISO){
  if(!user) return null;
  if(!user.cycle) user.cycle={};
  const l=_cycleRegles(user);
  if(l.indexOf(dateISO)<0) l.push(dateISO);
  l.sort();
  user.cycle.regles=l.slice(-CYCLE_REGLES_MAX);
  user.cycle.lastPeriodDate=dateISO;
  return user.cycle.regles;
}
// Aucune alarme sur une occurrence, aucune notification, jamais. Le champ est
// consigné, il ne parle pas.
function _cycleAjouterAbsence(user,dateISO){
  if(!user) return null;
  if(!user.cycle) user.cycle={};
  const l=(Array.isArray(user.cycle.absences)?user.cycle.absences:[])
    .filter(x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x));
  const s=Array.from(new Set(l.concat([dateISO]))).sort();
  user.cycle.absences=s.slice(-CYCLE_REGLES_MAX);
  return user.cycle.absences;
}
// Les deux lectures de config qui restaient locales passent par confCycle,
// sinon elles liraient un cycleAdaptation figé dès qu'un réglage est écrit
// dans user.cycle — et l'adaptation s'arrêterait sans un mot.
function _getCycleNutConf(){return confCycle(currentUser);}

// Conservé : il reste appelé en une dizaine d'endroits, et le renommer
// n'apporterait rien. Ce n'est plus qu'un alias.
function _getCyclePhaseNut(dateStr){
  return phaseCycle(currentUser,dateStr);
}

// Le porteur du dossier est passé EXPLICITEMENT. Un canal global aurait été
// faux dès le second appelant : _renderCycleNutSettings l'appelle aussi.
function _applyNutCycleModifier(base,isOn,phase,conf,porteur){
  // Protéines : jamais modifiées — seuls glucides et lipides varient
  const m={...base};
  // Une phase périmée ou irrégulière n'est pas une phase : elle ne peut rien
  // ajuster. La garde est ICI, dans la fonction qui applique, et pas
  // seulement chez ses appelants — c'est la seule qui ne s'oublie pas.
  if(!phaseAgissante(phase)) return m;
  // Contraception cyclique : la plaquette donne un calendrier, pas une
  // physiologie. On ne déplace pas des glucides sur la foi d'un jour de
  // comprimé. Le RESSENTI, lui, continue d'agir sur la charge.
  if(porteur!==undefined&&cycleCalendaireSeul(porteur)) return m;
  if(!m.kcal) return m;
  if(phase==='menstrual'&&conf.intensiteRegles==='difficile'){
    // +10g glucides (+40kcal) compensés par lipides → kcal total inchangé
    m.g=Math.round((m.g||0)+10);
    m.l=parseFloat(((m.l||0)-40/9).toFixed(1));
  } else if(phase==='luteal_late'&&!isOn&&conf.sensibilitePms){
    // +4% OFF uniquement — ~12g glucides, reste en lipides
    // Jamais de restriction automatique — en cas de doute on reste neutre
    const extra=Math.round(m.kcal*0.04);
    const dGKcal=Math.min(extra,48); // max 12g glucides = 48kcal
    m.kcal=m.kcal+extra;
    m.g=Math.round((m.g||0)+Math.round(dGKcal/4));
    m.l=parseFloat(((m.l||0)+(extra-dGKcal)/9).toFixed(1));
  }
  return m;
}

// Le type de diete etait lu a cinq endroits avec DEUX defauts contradictoires :
// 'flexible' dans le calcul des macros, 'strict' sur les trois ecrans. Un dossier
// sans dietType recevait donc les modificateurs de cycle menstruel ET l'ajout
// automatique d'omega-3, pendant que le coach voyait l'interface « strict ».
// Le commentaire du calcul disait pourtant, noir sur blanc, que l'adaptation ne
// s'applique qu'en diete flexible.
//
// Un seul defaut desormais, et c'est le PRUDENT : sans choix explicite, on
// n'applique aucune adaptation automatique. Aucune migration n'est ecrite — le
// defaut vit a la LECTURE, donc les dossiers existants ne sont pas touches.
const DIETE_DEFAUT='strict';
const DIETES_CONNUES=Object.freeze(['strict','flexible']);
// PURE. Une valeur inconnue — corruption, version future — retombe sur le
// defaut plutot que d'activer un chemin que personne n'a choisi.
function typeDiete(nut){
  const v=nut&&nut.dietType;
  return DIETES_CONNUES.indexOf(v)>=0?v:DIETE_DEFAUT;
}
// Encart de TRANSITION. Un dossier peut tres bien avoir l'adaptation de cycle
// activee et un suivi qui n'est pas flexible : jusqu'ici l'adaptation
// s'appliquait quand meme cote macros. Maintenant qu'elle ne s'applique plus,
// la couper EN SILENCE serait pire — l'athlete verrait ses chiffres changer
// sans explication. On le dit, et on ne touche a rien en base.
const DIETE_TRANSITION=
  'Ton adaptation de cycle est active, mais ton suivi n\'est pas en diète '
  +'flexible : elle ne s\'applique pas à tes macros. Choisis un type de suivi '
  +'avec ton coach.';
// `porteur` EXPLICITE, comme _getEffectiveMacros et pour la même raison.
//
// La config de cycle vit désormais dans `user.cycle` — c’est la seule cible
// d’écriture de saveCycleNutSettings depuis la migration. Le porteur était
// DEVINÉ : sur la fiche coach, où la nutrition est celle du CLIENT, on
// fabriquait un `{nutrition:nut}` qui perd `c.cycle`. confCycle ne retrouvait
// alors que le `cycleAdaptation` hérité, `enabled` valait false, et la
// bannière ne sortait JAMAIS côté coach — alors que son appelant écrit « le
// coach doit voir la même chose que son athlète ».
//
// Le repli est celui d’avant, mot pour mot : sans porteur, on retrouve le
// dossier courant quand c’est bien sa nutrition, et l’objet synthétique
// sinon. Les trois appels athlète ne changent donc pas de comportement.
function _dieteTransitionActive(nut,porteur){
  const _p=porteur||((nut===((currentUser||{}).nutrition))?currentUser:{nutrition:nut});
  const c=confCycle(_p);
  return typeDiete(nut)==='strict'&&!!c.enabled&&!!c.lastPeriodDate;
}
function _htmlDieteTransition(nut,porteur){
  if(!_dieteTransitionActive(nut,porteur)) return '';
  return `<div style="margin-top:12px;background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:var(--r-3);padding:12px 14px">
    <div style="font-size:var(--fs-xs);color:var(--text);line-height:1.6">${escapeHtml(DIETE_TRANSITION)}</div>
  </div>`;
}
// ══ L'ATHLETE REGLE SES PROPRES CIBLES ═════════════════════════════════
// En diete flexible, les cibles ne bougeaient pas : elles venaient de
// nutrition.macros, ecrit par le coach, et l'athlete n'avait aucune prise
// dessus. Demande de Kevin, 14/09/2026 — objectif, plus ou moins 20 kcal, et
// les g/kg de proteines et de lipides reglables par l'athlete lui-meme.
//
// TOUT PASSE PAR cibleTableur, LE MOTEUR DU TABLEAU DU COACH. Pas un second
// calcul : le meme. C'est ce qui fait que les deux ecrans ne peuvent pas
// diverger, et que le coach voit immediatement ce que l'athlete a change —
// le resultat est ecrit dans nutrition.macros, la ou le coach lit deja.
//
// CE QUE CA NE COUVRE PAS : la diete stricte, ou les grammages viennent du
// plan du coach et n'ont pas a etre negocies depuis l'assiette.
const ATH_OBJECTIFS=Object.freeze([
  {k:'seche',   lib:'Sèche'},
  {k:'maintien',lib:'Maintien'},
  {k:'masse',   lib:'Prise de masse'}
]);
const ATH_DELTA_PAS=20;
// ══ LE ±20 EST UN REGLAGE PARTAGE, DES DEUX COTES (build 1412) ════════════
//
// Demande de Kevin, 23/09/2026 : « remets la possibilité de mettre +20 / −20
// cal chez le coach ET chez l'athlète, les deux doivent synchroniser les
// résultats l'un chez l'autre : si le coach clique +20, les calories de
// l'élève et celles affichées sur son profil chez le coach augmentent, et
// inversement si c'est l'athlète qui baisse ou augmente. »
//
// CE QUI EXISTAIT : un ±20 cote athlete SEULEMENT, ecrit dans
// `nutrition.perso.delta` — donc invisible du coach — et BLOQUE des que le
// coach avait pose les chiffres. Il recopiait bien sa valeur dans
// `nutrition.tableur.deltaAthlete`, mais PERSONNE ne lisait cette case :
// verifie, aucun lecteur dans tout le fichier. Le coach, lui, n'avait aucun
// bouton.
//
// ⚠ UN SEUL FOYER : `nutrition.tableur.delta`, la grille que les deux cotes
//   partagent deja pour les g/kg et le coefficient. Les deux anciennes cases
//   sont relues en REPLI (un athlete qui avait deja un ±40 le garde) et
//   effacees au premier geste, pour qu'il n'y ait jamais deux verites.
//
// ⚠ IL S'APPLIQUE DANS cibleTableur, sur le total et AVANT le plancher : un
//   −20 ne peut donc pas faire descendre sous le plancher de securite, et les
//   grammes se repartissent dans le total ajuste plutot qu'a cote.
//
// ⚠ L'ORIGINE DES CIBLES N'EST JAMAIS TOUCHEE PAR UN ±20. C'est la garde du
//   19/09/2026 : `origine:'athlete'` leve le verrou du coach. Un ±20 de
//   l'athlete deplace donc le total SANS reprendre la main sur la
//   prescription — exactement comme les menus g/kg depuis le 20/09.
// ⚠ PLUS DE BORNE (24/09/2026). Elle valait 500 kcal : une cible a 2 400 ne
//   pouvait pas descendre a 1 800 par ce bouton, et l'athlete comme le coach
//   cliquaient dans le vide une fois la borne atteinte. Le total reste borne a
//   zero dans cibleTableur — des calories negatives n'existent pas — et c'est
//   la seule borne qui reste.
const DELTA_KCAL_MAX=Infinity;
// ══ LE ±20, PAR AUTEUR (Kevin, 27/09/2026) ═══════════════════════════════
// « Il faut que je sache qui a augmenté, qui a baissé. » Chaque côté a sa
// case : nutrition.tableur.ajust = {coach, athlete}, en kilocalories. Le
// total appliqué est leur somme, et la mention à côté des boutons dit qui a
// fait quoi (« L'athlète a baissé de 20 »).
//
// ⚠ LES ANCIENS CLICS NE COMPTENT PLUS. L'ancienne case unique
//   (tableur.delta, et avant elle perso.delta, tableur.deltaAthlete)
//   accumulait sans dire qui : un athlète s'est retrouvé à −740 kcal (1 931
//   ramenés à 1 191) sans que personne ne sache d'où. Elle est ignorée, et
//   _ajustMigrer retire une fois ce qu'elle avait déjà appliqué aux cibles.
function ajustKcal(u){
  const a=((((u&&u.nutrition)||{}).tableur)||{}).ajust||{};
  const n=v=>{ const x=Math.round(Number(v)); return isFinite(x)?x:0; };
  const j=ajustAutoJours(u);
  return {coach:n(a.coach),athlete:n(a.athlete),auto:n(a.auto),autoOn:j.on,autoOff:j.off,
    jour:(a.jour==='on'||a.jour==='off')?a.jour:'tous'};
}
// ══ L'AJUSTEMENT AUTOMATIQUE, UNE TROISIÈME CASE (build 1837) ═════════════
// appliquerAjustement écrivait directement nutrition.macros[jour] avec
// l'origine 'ajustement' : saisieManuelle basculait la fiche du coach en
// manuel, et le plan (planCiblesJour, qui recalcule) ne voyait plus les
// anneaux (jour OFF 1 707 contre 1 650 kcal). L'ajustement est désormais un
// DÉCALAGE de la grille, à côté du ±20 du coach et de l'athlète :
// nutrition.tableur.ajust = {coach, athlete, auto, jour, autoJ:{on,off}}.
// `auto` est la somme signée, `jour` le jour visé ('on' | 'off' | 'tous'),
// `autoJ` le détail par jour quand deux ajustements ont visé deux jours.
// _tbJournees l'applique au SEUL jour visé, en glucides ; tous les chemins de
// cibles (grille, plan, carte, anneaux) passent par lui.
// PURE. Le décalage automatique de chaque journée, en kcal.
function ajustAutoJours(u){
  const a=((((u&&u.nutrition)||{}).tableur)||{}).ajust||{};
  const n=v=>{ const x=Math.round(Number(v)); return isFinite(x)?x:0; };
  if(a.autoJ&&typeof a.autoJ==='object') return {on:n(a.autoJ.on),off:n(a.autoJ.off)};
  const x=n(a.auto);
  if(a.jour==='on') return {on:x,off:0};
  if(a.jour==='off') return {on:0,off:x};
  return {on:x,off:x};
}
// ÉCRIT (sans enregistrer). Ajoute `kcal` au jour visé ; rend le nouveau détail.
function ajouterAjustAuto(u,jour,kcal){
  if(!u.nutrition) u.nutrition={};
  const tb=u.nutrition.tableur=Object.assign({},u.nutrition.tableur||{});
  const j=ajustAutoJours(u);
  const d=Math.round(Number(kcal)||0);
  if(jour==='on'||jour==='tous') j.on+=d;
  if(jour==='off'||jour==='tous') j.off+=d;
  const aj=Object.assign({},tb.ajust||{});
  aj.autoJ={on:j.on,off:j.off};
  aj.jour=(j.on&&j.off)?(j.on===j.off?'tous':'mixte'):(j.on?'on':(j.off?'off':'tous'));
  aj.auto=aj.jour==='on'?j.on:(aj.jour==='off'?j.off:(aj.jour==='tous'?j.on:j.on+j.off));
  aj.maj=Date.now(); aj.dernier='auto';
  tb.ajust=aj;
  return j;
}
// PURE. Une journée décalée de `kcal`, portés par les glucides seuls.
function _avecAutoJour(b,kcal){
  const d=Math.round(Number(kcal)||0);
  if(!b||!d) return b;
  const g=Math.max(0,Math.round((Number(b.g)||0)+d/4));
  return _bloc(Number(b.p)||0,Number(b.l)||0,g);
}
// PURE. Le ±20 en vigueur : la part du coach plus celle de l'athlète. La part
// AUTOMATIQUE n'y entre pas : elle vise un jour, et _tbJournees l'applique.
function deltaKcalPartage(u){
  const a=ajustKcal(u);
  return a.coach+a.athlete;
}
// ÉCRIT, une fois. Un dossier qui porte encore l'origine 'ajustement' (avant
// le build 1837) : l'origine reprend 'tableur' si le coach a posé son niveau
// d'activité (tableur.naf), 'athlete' sinon ; l'écart « cibles moins calcul »
// de chaque journée est reporté dans ajust.autoJ. Les cibles ne bougent pas.
function _migrerOrigineAjustement(u){
  const m=(((u||{}).nutrition)||{}).macros;
  if(!m||m.origine!=='ajustement') return false;
  const tb=u.nutrition.tableur||{};
  let base=null;
  try{
    const sv=tb.ajust;
    // Le calcul SANS ajustement automatique : la référence de l'écart.
    u.nutrition.tableur=Object.assign({},tb,{ajust:Object.assign({},sv||{},{auto:0,jour:'tous',autoJ:{on:0,off:0}})});
    const t=cibleTableur(u,{});
    if(t&&!(t.manque&&t.manque.length)) base=_tbJournees(u,t,dieteCyclee(u));
    u.nutrition.tableur=tb;
  }catch(e){ u.nutrition.tableur=tb; base=null; }
  m.origine=tb.naf?'tableur':'athlete';
  m.origineDate=Date.now();
  if(base&&base.on&&base.off){
    const ec=j=>Math.round((Number((m[j]||{}).kcal)||0)-(Number(base[j].kcal)||0));
    const aj=Object.assign({},tb.ajust||{});
    aj.autoJ={on:ec('on'),off:ec('off')};
    aj.jour=(aj.autoJ.on&&aj.autoJ.off)?'mixte':(aj.autoJ.on?'on':(aj.autoJ.off?'off':'tous'));
    aj.auto=aj.autoJ.on+aj.autoJ.off;
    aj.maj=Date.now();
    u.nutrition.tableur=Object.assign({},tb,{ajust:aj});
  }
  return true;
}
// PURE. L'ancien ajustement encore porté par le dossier (0 s'il n'y en a pas).
function _ajustAncien(u){
  const nut=(u&&u.nutrition)||{};
  const tb=nut.tableur||{};
  for(const v of [tb.delta,(nut.perso||{}).delta,tb.deltaAthlete]){
    const x=Math.round(Number(v));
    if(v!==undefined&&v!==null&&isFinite(x)) return x;
  }
  return 0;
}
function _ajustAncienPresent(u){
  const nut=(u&&u.nutrition)||{};
  const tb=nut.tableur||{};
  return tb.delta!==undefined||tb.deltaAthlete!==undefined||tb.deltaHisto!==undefined
    ||(nut.perso&&nut.perso.delta!==undefined);
}
// ECRIT, une fois par dossier. Efface l'ancienne case et, en saisie
// manuelle — où chaque clic décalait directement les grammes —, retire des
// cibles ce qu'elle y avait mis. En automatique, rien à défaire : les cibles
// se recalculent sans elle (_tbReconcilier). Rend true si le dossier a changé.
function _ajustMigrer(u){
  // Build 1837 : l'origine 'ajustement' d'avant est reprise ici, une fois.
  let _ch=false; try{ _ch=_migrerOrigineAjustement(u); }catch(e){ _ch=false; }
  if(!u||!_ajustAncienPresent(u)) return _ch;
  const nut=u.nutrition;
  const d=_ajustAncien(u);
  let manuel=false; try{ manuel=saisieManuelle(u); }catch(e){ manuel=false; }
  const m=nut.macros||{};
  const tb=Object.assign({},nut.tableur||{});
  delete tb.delta; delete tb.deltaAthlete; delete tb.deltaHisto;
  nut.tableur=tb;
  if(nut.perso&&nut.perso.delta!==undefined){ const p=Object.assign({},nut.perso); delete p.delta; nut.perso=p; }
  if(d&&manuel&&m.on){
    const dec=b=>{
      const o=Object.assign({},b||{});
      o.kcal=Math.max(0,Math.round(Number(o.kcal)||0)-d);
      o.g=Math.max(0,Math.round((Number(o.g)||0)-d/4));
      return o;
    };
    nut.macros=Object.assign({},m,{on:dec(m.on),off:dec(m.off||m.on)});
  }
  return true;
}
// ECRIT. Le seul ecrivain du ±20 : le bouton du coach et celui de l'athlete
// passent tous les deux par lui, sur le meme champ, avec le meme pas.
// Il ne persiste ni ne pousse : c'est l'appelant qui sait s'il ecrit un
// dossier a lui (saveUser) ou celui d'un athlete (DB.set + pushOne).
//
// `origineSiAbsente` : ce que vaut la prescription quand le dossier n'en porte
// pas encore. Elle n'est JAMAIS deduite du role du dossier — sur l'appareil du
// coach, le dossier lu est celui de l'athlete, et en deduire 'athlete'
// deverrouillerait ses propres cibles.
//
// Rend {delta, bouge, kcal?, manque?, manuel?} — jamais null hors dossier
// absent, pour que l'appelant puisse toujours dire ce qui s'est passe.
// L'AUTEUR : 'athlete' quand c'est l'athlète qui clique (origineSiAbsente
// 'athlete'), le coach sinon. Chacun ne bouge que SA case.
// `montant` (06/10/2026) : le brouillon du coach applique son écart en UNE
// fois (−100, +50…) ; sans lui, le pas de vingt, comme avant.
function appliquerDeltaKcal(u,sens,origineSiAbsente,montant){
  if(!u) return null;
  if(!u.nutrition) u.nutrition={};
  try{ _ajustMigrer(u); }catch(e){}
  const nut=u.nutrition;
  const par=(origineSiAbsente==='athlete')?'athlete':'coach';
  // ⚠ COTE ATHLETE, UNE BAISSE PEUT ETRE REFUSEE (30/09/2026) : jamais avec un
  //   antecedent alimentaire declare (aTCA), jamais sous le plancher. Rien
  //   n'est ecrit dans ces deux cas. Cote coach, rien ne change : il est averti
  //   (sousPlancher), il decide.
  if(par==='athlete'&&sens<0){
    let tca=false; try{ tca=aTCA(u); }catch(e){ tca=false; }
    if(tca) return {delta:deltaKcalPartage(u),bouge:false,refus:'tca'};
  }
  const _tbAvant=nut.tableur, _macrosAvant=nut.macros;
  const avant=deltaKcalPartage(u);
  const _m=Number(montant)>0?Math.round(Number(montant)):ATH_DELTA_PAS;
  const pas=(sens<0?-_m:_m);
  const tb=Object.assign({},nut.tableur||{});
  const aj=Object.assign({coach:0,athlete:0},ajustKcal(u));
  aj[par]+=pas;
  // La part automatique (build 1837) est gardée telle quelle.
  tb.ajust=Object.assign({},(nut.tableur||{}).ajust||{},{coach:aj.coach,athlete:aj.athlete,maj:Date.now(),dernier:par});
  nut.tableur=tb;
  const n=deltaKcalPartage(u);
  if(n===avant) return {delta:n,bouge:false};
  let manuel=false; try{ manuel=saisieManuelle(u); }catch(e){ manuel=false; }
  if(manuel){
    // LES CHIFFRES ECRITS A LA MAIN SE DECALENT, ils ne se recalculent pas :
    // le contrat de la saisie manuelle est que ce sont EUX qui priment. Les
    // glucides absorbent l'ecart, comme partout ailleurs dans le fichier.
    const m=nut.macros||{};
    // ⚠ ON DECALE, ON NE RECALCULE PAS. Les grammes du coach peuvent s'ecarter
    //   de la somme 4/4/9 — il compte les fibres autrement, ou il arrondit a sa
    //   main — et les redresser au passage changerait sa prescription bien
    //   au-dela des vingt calories demandees. Les glucides prennent l'ecart, et
    //   eux seuls : vingt kilocalories, c'est cinq grammes.
    const dec=b=>{
      const o=Object.assign({},b||{});
      o.kcal=Math.max(0,Math.round(Number(o.kcal)||0)+pas);
      o.g=Math.max(0,Math.round((Number(o.g)||0)+pas/4));
      return o;
    };
    nut.macros=Object.assign({},m,{on:dec(m.on),off:dec(m.off||m.on)});
    const _pl=plancherAthlete(u);
    const _min=Math.min(Number((nut.macros.on||{}).kcal)||0,Number((nut.macros.off||{}).kcal)||0);
    if(par==='athlete'&&sens<0&&_min<_pl){
      nut.tableur=_tbAvant; nut.macros=_macrosAvant;
      return {delta:avant,bouge:false,refus:'plancher',plancher:_pl};
    }
    try{ _histoNoter(u,origineSiAbsente==='athlete'?'athlete':'coach'); }catch(e){}
    return {delta:n,bouge:true,manuel:true,kcal:(nut.macros.on||{}).kcal,sousPlancher:_min<_pl};
  }
  let t=null; try{ t=cibleTableur(u,{appliquerPlancher:par==='athlete'}); }catch(e){ t=null; }
  if(!t||(t.manque&&t.manque.length))
    return {delta:n,bouge:true,manque:(t&&t.manque)||['calcul impossible']};
  // L'athlete ne descend pas sous son plancher : le total VISE (avant la
  // remontee) passerait dessous, la baisse est refusee et rien ne change.
  if(par==='athlete'&&sens<0&&t.sousPlancher){
    nut.tableur=_tbAvant;
    return {delta:avant,bouge:false,refus:'plancher',plancher:t.plancher};
  }
  const cyc=(function(){ try{ return dieteCyclee(u); }catch(e){ return false; } })();
  let j=null; try{ j=_tbJournees(u,t,cyc); }catch(e){ j=null; }
  if(!j||!j.on) return {delta:n,bouge:true,manque:['calcul impossible']};
  const m=nut.macros||{};
  const origine=m.origine||origineSiAbsente||'tableur';
  nut.macros={on:j.on,off:j.off,origine,origineDate:Date.now()};
  try{ _histoNoter(u,origine==='athlete'?'athlete':'tableur'); }catch(e){}
  return {delta:n,bouge:true,kcal:j.on.kcal,sousPlancher:!!t.sousPlancher};
}
// PURE. La mention affichee a cote du total, des deux cotes : « +40 » ou rien.
function libelleDeltaKcal(u){
  const d=deltaKcalPartage(u);
  return d?((d>0?'+':'')+d):'';
}
// PURE. QUI A BOUGÉ LE TOTAL, en toutes lettres, pour la mention posée à côté
// du ±20 : « L'athlète a baissé de 20 · Le coach a augmenté de 40 ».
// `vu` : 'athlete' sur l'écran de l'athlète (« Tu as… », « Ton coach a… »),
// sinon la fiche du coach. Vide quand personne n'a rien ajusté.
function libelleAjustKcal(u,vu){
  const a=ajustKcal(u);
  const verbe=v=>(v<0?'baissé':'augmenté')+' de '+Math.abs(v);
  const moi=vu==='athlete';
  const l=[];
  if(a.athlete) l.push((moi?'Tu as ':'L’athlète a ')+verbe(a.athlete));
  if(a.coach) l.push((moi?'Ton coach a ':'Le coach a ')+verbe(a.coach));
  const t=texteAjustAuto(u);
  if(t) l.push(t);
  return l.join(' · ');
}
// PURE. « Ajustement automatique : −210 kcal les jours de repos », ou ''.
function texteAjustAuto(u){
  const j=ajustAutoJours(u);
  const k=v=>(v>0?'+':'−')+Math.abs(v)+' kcal';
  if(!j.on&&!j.off) return '';
  let q;
  if(j.on&&j.off&&j.on===j.off) q=k(j.on)+' par jour';
  else q=[j.off?k(j.off)+' les jours de repos':'',j.on?k(j.on)+' les jours d’entraînement':''].filter(Boolean).join(', ');
  return 'Ajustement automatique : '+q;
}
// Côté coach : remet la part automatique à 0, le trace, recalcule et envoie.
function annulerAjustAuto(){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c||!c.nutrition) return false;
  const j=ajustAutoJours(c);
  if(!j.on&&!j.off) return false;
  const n=c.nutrition;
  let manuel=false; try{ manuel=saisieManuelle(c); }catch(e){ manuel=false; }
  const tb=n.tableur=Object.assign({},n.tableur||{});
  tb.ajust=Object.assign({},tb.ajust||{},{auto:0,jour:'tous',autoJ:{on:0,off:0},maj:Date.now(),dernier:'coach'});
  if(!Array.isArray(n.ajustHisto)) n.ajustHisto=[];
  n.ajustHisto.push({date:Date.now(),decision:'annule',par:'coach',kcalDeltaOn:-j.on,kcalDeltaOff:-j.off});
  if(n.ajustHisto.length>12) n.ajustHisto=n.ajustHisto.slice(-12);
  const m=n.macros||{};
  if(manuel){
    // En saisie manuelle, les grammes se décalent en retour (comme le ±20).
    n.macros=Object.assign({},m,{on:_avecAutoJour(m.on,-j.on)||m.on,off:_avecAutoJour(m.off,-j.off)||m.off});
  } else {
    try{
      const t=cibleTableur(c,_tbOptsDe(c));
      if(t&&!(t.manque&&t.manque.length)){
        const jj=_tbJournees(c,t,dieteCyclee(c));
        n.macros={on:jj.on,off:jj.off,origine:m.origine||'tableur',origineDate:Date.now()};
      }
    }catch(e){}
  }
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(c.email,c),'Ajustement automatique annulé','l’annulation est');
  try{ renderCoachNutriSection(c); }catch(e){}
  return true;
}
function _athPerso(u){
  const n=(u&&u.nutrition)||{};
  const p=n.perso||{};
  return {objectif:ATH_OBJECTIFS.some(o=>o.k===p.objectif)?p.objectif:null,
          delta:Number(p.delta)||0};
}
// ══ QUAND LE COACH A POSE LES CHIFFRES, ILS FONT FOI ══════════════════════
// Demande de Kevin, 19/09/2026, apres avoir constate le defaut : il reajustait
// les macros d'une athlete en flexible et elle ne voyait RIEN changer.
//
// LES DEUX ECRANS SE CONTREDISAIENT, et c'est tout le defaut. La carte « Mon
// objectif » RECALCULE ses cibles par cibleTableur — poids, taille, age, NAF,
// coefficient — sans jamais lire nutrition.macros. Les anneaux, eux, lisent
// nutrition.macros par _getEffectiveMacros. Le coach enregistrait 2 200 kcal :
// la donnee partait, descendait, arrivait dans le dossier de l'athlete, et sa
// carte continuait d'afficher les 2 013 du calcul pendant que ses anneaux
// comptaient sur 2 200. Et au premier geste sur cette carte, _athEcrireCibles
// REECRIVAIT nutrition.macros avec le calcul : la prescription du coach etait
// effacee, sans un mot ni pour lui ni pour elle.
//
// L'ARBITRE EST LE COMMUTATEUR QUI EXISTE DEJA — « Saisie manuelle », sur la
// fiche du coach. Il dit noir sur blanc « tes chiffres priment : ils ne
// bougeront plus ». Il ne manquait qu'une chose : que l'ecran de l'athlete
// l'ecoute. Aucun concept neuf, aucune migration, et un seul endroit ou la
// question se decide.
//
// LE REPLI SANS DRAPEAU EST CELUI DE saisieManuelle — un dossier qui porte
// deja des grammes porte une prescription — MOINS ceux que l'athlete a ecrits
// elle-meme depuis cette carte. Sans ce retrait, une athlete qui a regle ses
// propres cibles se retrouverait verrouillee sur elles, par un coach qui n'a
// jamais rien pose.
function ciblesPoseesParCoach(u){
  const n=(u&&u.nutrition)||{};
  // ⚠ LA GRILLE DU COACH PASSE DEVANT LE DRAPEAU, et cet ordre est le
  //   correctif du 20/09/2026 au soir. Kevin : « malgre la modif sur le profil
  //   du coach, cela ne s'affiche pas sur celui de l'athlete ». Mesure faite
  //   sur ses deux captures : son tableau annonce 1,9 g/kg et 3 933 kcal en
  //   Recomposition, l'ecran de l'athlete 2,2 g/kg et 4 082 kcal en Seche, et
  //   sa carte porte « elles remplacent celles de sa grille » — donc elle
  //   n'etait PAS verrouillee.
  //
  //   POURQUOI. `manuel:false` — ecrit des que le coach baisse l'interrupteur
  //   « Saisie manuelle » — rendait false ici, et l'athlete reprenait la main
  //   sur TOUT. C'etait juste au 14/09, quand le calcul automatique n'ecrivait
  //   rien : « en automatique, l'athlete garde la main ». Ca ne l'est plus
  //   depuis le build 1317, ou chaque menu du tableur ECRIT et POUSSE — le
  //   coach pose donc des chiffres en automatique aussi, et `manuel:false`
  //   les faisait ignorer.
  //
  //   `manuel:false` DIT « le coach ne tape pas les grammes a la main ». Il ne
  //   dit pas « le coach n'a rien pose ». Ce sont deux phrases differentes, et
  //   c'est leur confusion qui a produit deux ecrans qui ne parlent pas du
  //   meme athlete.
  // `'histo'` : le coach a remis une ancienne cible en place — c'est lui qui
  // decide, au meme titre que s'il venait de la calculer.
  if(((n.macros||{}).origine)==='tableur'||((n.macros||{}).origine)==='histo') return true;
  // L'AJUSTEMENT NE VERROUILLE QU'AVEC UN COACH (build 1833). Sans coach, c'est
  // l'athlète qui l'a accepté : il se lit comme 'athlete'.
  if(((n.macros||{}).origine)==='ajustement'&&sansCoach(u)) return false;
  // Le drapeau explicite gagne ensuite : un coach qui a LEVE l'interrupteur a
  // dit ce qu'il voulait, et un dossier ou l'athlete avait pris la main avant
  // ce lot se repare au premier enregistrement du coach.
  if(typeof n.manuel==='boolean') return n.manuel;
  if(((n.macros||{}).origine)==='athlete') return false;
  // ⚠ LE CALCULATEUR DU COACH POSE UNE PRESCRIPTION, et cette ligne doit etre
  //   lue avec celle de saisieManuelle qui vient d'ecarter la meme origine.
  //   Les deux fonctions repondent a DEUX QUESTIONS DIFFERENTES que le drapeau
  //   `manuel` confondait :
  //     saisieManuelle      — « le coach tape-t-il les grammes a la main ? »
  //     ciblesPoseesParCoach — « ses chiffres l'emportent-ils sur ceux de
  //                             l'athlete ? »
  //   Pour des grammes sortis du tableur, la reponse est NON a la premiere et
  //   OUI a la seconde. Sans cette ligne, le correctif du matin — la carte
  //   « Mon objectif » verrouillee sur les chiffres du coach — serait defait
  //   par la porte d'a cote : l'athlete aurait repris la main au premier ±20.
  if(((n.macros||{}).origine)==='tableur') return true;
  try{ return saisieManuelle(u)===true; }catch(e){ return false; }
}
// Les cibles EN VIGUEUR pour un jour donne, exactement celles des anneaux :
// nutrition.macros, cyclage ON/OFF et adaptation de cycle compris. Un second
// chemin vers la meme cible divergerait, et c'est precisement la divergence
// qu'on repare ici.
function ciblesEnVigueur(u,jourISO){
  const nut=(u&&u.nutrition)||{};
  if(!nut.macros) return null;
  const j=jourISO||localISODate(new Date());
  let m=null;
  try{ m=_getEffectiveMacros(nut,nutIsOnDay(j,u),j,u); }catch(e){ return null; }
  // ⚠ UNE JOURNEE VIDE NE FAIT PLUS TAIRE LA CARTE (24/09/2026). Un dossier
  //   enregistre avec une seule des deux colonnes laissait l'athlete devant
  //   « ton coach n'a pas encore pose tes cibles » alors qu'il venait de les
  //   poser. L'ecriture ne peut plus produire ce cas ; les dossiers deja
  //   abimes, eux, se reparent ici : on retombe sur l'autre journee.
  if(!m||!(Number(m.kcal)>0)){
    try{ m=_getEffectiveMacros(nut,!nutIsOnDay(j,u),j,u); }catch(e){ m=null; }
  }
  if(!m) return null;
  const kcal=Math.round(Number(m.kcal)||0);
  const p=Math.round(Number(m.p)||0), l=Math.round(Number(m.l)||0),
        g=Math.round(Number(m.g)||0);
  if(!kcal&&!p&&!l&&!g) return null;
  return {kcal,p,l,g};
}
// PURE. Les cibles de l'athlete, moteur du coach compris, delta applique.
// Le delta tombe sur les GLUCIDES et eux seuls : proteines et lipides sont
// des planchers de sante, on ne les rabote pas pour vingt calories.
function ciblesAthlete(u){
  const per=_athPerso(u);
  const opts={};
  // L'objectif choisi est la PHASE du calcul (coefficient ET g/kg), sauf phase du coach.
  if(per.objectif){ opts.coef=objCoefDefaut(per.objectif); opts.objectif=per.objectif; }
  // ⚠ protGkg / lipGkg ET NON protGparKg / lipGparKg. Les deux noms coexistent
  // dans ce fichier : besoinsProposes lit `protGparKg`, cibleTableur lit
  // `protGkg`. Ces deux lignes passaient les noms de la PREMIERE a la SECONDE,
  // qui les ignorait en silence — les deux menus g/kg de la carte etaient donc
  // inertes depuis leur mise en ligne : l'athlete choisissait 2,2 g/kg, le
  // calcul restait sur la valeur suggeree et le menu retombait dessus au
  // rendu suivant.
  // ⚠ ON NE SURCHARGE PLUS DEPUIS `nutrition.reglages`. C'etait la seconde
  //   maison du meme reglage : l'athlete y ecrivait, le coach lisait
  //   `nutrition.tableur`, et aucun des deux ne voyait l'autre. `cibleTableur`
  //   lit maintenant le foyer commun — et garde `reglages` en dernier recours
  //   pour les dossiers d'avant ce lot, ce qui rend cette surcharge inutile en
  //   plus d'etre nuisible.
  // LES CIBLES DE L'ATHLETE NE PASSENT JAMAIS SOUS SON PLANCHER (30/09/2026).
  opts.appliquerPlancher=true;
  let t=null;
  try{ t=cibleTableur(u,opts); }catch(e){ return null; }
  if(!t||(t.manque&&t.manque.length)) return t?{manque:t.manque||[]}:null;
  // ⚠ PLUS DE +per.delta ICI (build 1412) : cibleTableur porte desormais le
  //   ±20 partage. L'ajouter une seconde fois le comptait deux fois.
  const kcal=Math.max(0,Math.round(t.kcal));
  const p=Math.round(t.p),l=Math.round(t.l);
  // Les glucides absorbent l'ecart. Jamais negatifs : un total impossible se
  // lit a zero glucide, pas en chiffre rouge invente.
  let g=Math.max(0,Math.round((kcal-p*4-l*9)/4));
  // L'arrondi des glucides peut rendre une somme d'une à deux kcal SOUS le
  // plancher (1 199 pour 1 200) : les grammes affichés doivent le tenir.
  { let _pl=0; try{ _pl=plancherAthlete(u); }catch(e){ _pl=0; }
    for(let i=0;i<3&&4*p+9*l+4*g<_pl;i++) g++; }
  const _ref=Number(t.poidsRef)>0?Number(t.poidsRef):Number(t.poids)||0;
  return {kcal,p,l,g,protGkg:t.protGkg,lipGkg:t.lipGkg,
          poidsRef:t.poidsRef,poidsRefObj:t.poidsRefObj,
          // LE DEPASSEMENT SE MESURE CONTRE LA CIBLE CALCULEE (t.ajuste), avant la
          // remontee au plancher : c'est elle que proteines et lipides ont deja
          // mangee. Mesure contre le total remonte, il ne se voyait jamais chez
          // l'athlete — le plancher l'absorbait, en silence.
          depasse:Math.max(0,Math.round(p*4+l*9-(Number(t.ajuste)>0?Number(t.ajuste):kcal))),
          glucidesBas:g<GLUC_MIN_G_KG*_ref||g<GLUC_MIN_G_JOUR,
          // LE COEFFICIENT ET L'OBJECTIF REELLEMENT APPLIQUES (ceux du calcul) :
          // une phase posee par le coach l'emporte sur le choix de l'athlete.
          coef:t.coef,objectif:t.phase,objectifChoisi:per.objectif,
          delta:deltaKcalPartage(u),manque:[]};
}
// Ecrit les cibles LA OU TOUT LE MONDE LES LIT : nutrition.macros.on/off.
// Les deux journees recoivent la meme valeur — le cyclage ON/OFF est une
// decision du coach, pas de l'athlete, et _getEffectiveMacros continue
// d'appliquer par-dessus l'adaptation de cycle.
function _athEcrireCibles(){
  // ⚠ LE DERNIER VERROU AVANT L'ECRITURE, et il est volontairement redondant
  // avec les trois gardes des boutons. Un ecran rendu AVANT que la
  // modification du coach ne descende porte encore ses boutons actifs : le
  // rendu n'est repeint que si l'athlete est sur l'accueil. Sans ce garde-ci,
  // ce clic-la — sur une carte devenue perimee entre-temps — effacerait la
  // prescription qui vient tout juste d'arriver.
  if(ciblesPoseesParCoach(currentUser)) return false;
  const c=ciblesAthlete(currentUser);
  if(!c||(c.manque&&c.manque.length)) return false;
  if(!_athEcrireCiblesLocal()) return false;
  saveUser();
  CLOUD.pushOne(currentUser.email,currentUser);
  return true;
}
// La part d'écriture SANS enregistrement : l'appelant enregistre.
function _athEcrireCiblesLocal(){
  if(ciblesPoseesParCoach(currentUser)) return false;
  const c=ciblesAthlete(currentUser);
  if(!c||(c.manque&&c.manque.length)) return false;
  if(!currentUser.nutrition) currentUser.nutrition={};
  const bloc={kcal:c.kcal,p:c.p,g:c.g,l:c.l};
  const m=currentUser.nutrition.macros||{};
  // L'ajustement automatique (build 1837) : sur le seul jour visé.
  const aj=ajustAutoJours(currentUser);
  currentUser.nutrition.macros=Object.assign({},m,{on:Object.assign({},m.on,_avecAutoJour(bloc,aj.on)||bloc),
    off:Object.assign({},m.off,_avecAutoJour(bloc,aj.off)||bloc),origine:'athlete'});
  return true;
}
// ÉCRIT (build 1833), sur l'appareil de l'athlète SANS coach seulement : quand
// la cible recalculée s'écarte de plus de 20 kcal de nutrition.macros, la
// nouvelle cible est écrite — la carte et les anneaux montrent alors le même
// chiffre. Rend true si le dossier a changé (l'appelant enregistre).
const ATH_RESYNC_KCAL=20;
function resyncCiblesAthlete(u){
  if(!u||u!==currentUser||!sansCoach(u)||ciblesPoseesParCoach(u)) return false;
  // Un ajustement accepté a écrit SES journées (le jour visé seulement) : elles
  // sont la cible en vigueur, et la carte les lit (_htmlCiblesAthlete).
  if((((u.nutrition||{}).macros)||{}).origine==='ajustement') return false;
  const c=ciblesAthlete(u);
  if(!c||(c.manque&&c.manque.length)||!(c.kcal>0)) return false;
  const m=((u.nutrition||{}).macros)||{};
  const aj=ajustAutoJours(u);
  const ecart=j=>Math.abs((Number((m[j]||{}).kcal)||0)-(_avecAutoJour(_bloc(c.p,c.l,c.g),aj[j])||_bloc(c.p,c.l,c.g)).kcal);
  if(ecart('on')<=ATH_RESYNC_KCAL&&ecart('off')<=ATH_RESYNC_KCAL) return false;
  return _athEcrireCiblesLocal();
}
// LE GARDE DES TROIS BOUTONS, EN TETE ET NON AU MOMENT D'ECRIRE LES CIBLES.
// athObjectif ecrit `nutrition.tableur.coef` — LA GRILLE DU COACH — avant
// meme d'appeler _athEcrireCibles : s'arreter plus bas aurait laisse un clic
// changer le coefficient d'objectif sur la fiche du coach, sans toucher aux
// cibles. Un ecran qui ne fait rien a moitie.
//
// ET IL PARLE. Un bouton qui ne repond pas se clique trois fois avant qu'on
// se demande pourquoi ; le repaint qui suit retire les boutons de l'ecran,
// puisque la carte se rend alors dans sa forme verrouillee.
function _athVerrouille(){
  if(!ciblesPoseesParCoach(currentUser)) return false;
  toast('Tes cibles sont posées par ton coach','var(--orange)');
  try{ loadNutrition(); }catch(e){}
  return true;
}
// Le refus du déficit en un clic : le MÊME texte que utiliserBesoinsProposes.
const ATH_REFUS_DEFICIT_TCA='Vu ce que tu as déclaré, RepCore ne pose pas de déficit tout seul. Passe par ton coach.';
// UN SEUL CLIC À LA FOIS (build 1833) : un double clic sur « Sèche » ouvrait
// deux confirmations.
let _athObjEnCours=false;
async function athObjectif(k){
  if(_athObjEnCours) return;
  if(_athVerrouille()) return;
  if(!ATH_OBJECTIFS.some(o=>o.k===k)) return;
  _athObjEnCours=true;
  try{ await _athObjectif(k); }finally{ _athObjEnCours=false; }
}
async function _athObjectif(k){
  // UNE SÈCHE NE S'ÉCRIT PAS D'UN CLIC (30/09/2026). Refusée avec un
  // antécédent alimentaire déclaré ou pendant une grossesse ; sinon, le
  // déficit est annoncé en kcal par jour et doit être confirmé.
  if(k==='seche'){
    let tca=false, gro=false;
    try{ tca=aTCA(currentUser); }catch(e){}
    try{ gro=grossesseSuspend(currentUser); }catch(e){}
    if(tca){ toast(ATH_REFUS_DEFICIT_TCA,'var(--orange)'); return; }
    if(gro){ toast(GROSSESSE_REFUS_SECHE,'var(--orange)'); return; }
    // Sans coach, la phase en cours (« masse ») passerait devant l'objectif
    // visé dans cibleTableur : le déficit annoncé se calcule SANS elle.
    const _uPrev=sansCoach(currentUser)?Object.assign({},currentUser,{phase:null}):currentUser;
    let t=null; try{ t=cibleTableur(_uPrev,{coef:objCoefDefaut('seche'),objectif:'seche',appliquerPlancher:true}); }catch(e){ t=null; }
    const _ok=t&&!(t.manque&&t.manque.length);
    const deficit=_ok?Math.round((t.avecSport||0)-(t.kcal||0)):0;
    // CE QUE LA SÈCHE FAIT AUX GLUCIDES (build 1835), en une phrase.
    const _alerte=!_ok?'':(Number(t.depasse)>0
      ?'Protéines et lipides dépassent la cible de '+Math.round(t.depasse)+' kcal : glucides à '+Math.round(t.g)+' g/j, séances moins énergiques.'
      :(t.glucidesBas?'Glucides à '+Math.round(t.g)+' g/j : séances moins énergiques.':''));
    const NL=String.fromCharCode(10);
    if((deficit>0||_alerte)&&!await rcConfirm((deficit>0?'La sèche pose un déficit d’environ '+deficit
      +' kcal par jour, sous ta dépense estimée de '+Math.round(t.avecSport)+' kcal.':'')
      +(_alerte?(deficit>0?NL+NL:'')+_alerte:'')
      +NL+NL
      +'Tu peux revenir en arrière à tout moment. Continuer ?',null,'Confirmer')) return;
  }
  // SANS COACH, L'OBJECTIF EST AUSSI LA PHASE (build 1833) : mêmes refus
  // (grossesse, antécédent alimentaire, vigilance énergétique), dits par
  // changerPhase. Refusée, rien n'est écrit.
  if(sansCoach(currentUser)&&!changerPhase(currentUser,k,null,'athlete')) return;
  if(!currentUser.nutrition) currentUser.nutrition={};
  const p=currentUser.nutrition.perso||{};
  p.objectif=k; p.objectifLe=(sansCoach(currentUser)&&currentUser.phase&&Number(currentUser.phase.debut))||Date.now();
  currentUser.nutrition.perso=p;
  // ET DANS nutrition.tableur, LA OU LE COACH LIT. cibleTableur prend son
  // coefficient dans u.nutrition.tableur.coef : sans cette ligne, l'athlete
  // aurait choisi « seche » et le tableau du coach serait reste sur le
  // maintien — deux ecrans, deux verites, sur la meme personne.
  const tb=currentUser.nutrition.tableur||{};
  // (tb.objectifAthlete n'avait aucun lecteur : il n'est plus écrit. La phase
  // de l'athlète se lit dans nutrition.perso.objectif, voir cibleTableur.)
  tb.coef=objCoefDefaut(k);
  currentUser.nutrition.tableur=tb;
  _athEcrireCibles(); loadNutrition();
}
/**
 * Le ±20 de l'athlete.
 *
 * ⚠ IL N'EST PLUS BLOQUE PAR LE VERROU DU COACH (build 1412), et c'est la
 *   demande de Kevin du 23/09/2026 : les deux cotes doivent pouvoir bouger le
 *   total, et chacun doit voir l'autre. Meme doctrine que athGkg depuis le
 *   20/09 : il ecrit dans LA MEME case que le coach, « nutrition.tableur », et
 *   l'ORIGINE des cibles n'est pas touchee — la prescription reste la sienne,
 *   c'est le total commun qui se decale de vingt calories.
 */
function athDelta(sens){
  if(!currentUser) return;
  const r=appliquerDeltaKcal(currentUser,sens,'athlete');
  if(!r) return;
  if(r.refus==='tca'){
    toast(ATH_REFUS_DEFICIT_TCA,'var(--orange)');
    return;
  }
  if(r.refus==='plancher'){
    toast('Tu es à ton plancher de '+r.plancher+' kcal : en dessous, ton corps n’a plus de quoi fonctionner et récupérer. Pour aller plus bas, passe par ton coach.','var(--orange)');
    return;
  }
  if(r.manque&&r.manque.length){
    toast('Cibles impossibles à recalculer : il manque '+r.manque.join(', '),'var(--orange)');
    return;
  }
  if(!r.bouge){
    // Branche morte depuis que la borne est tombee (24/09/2026) : elle ne
    // pouvait se declencher qu'a DELTA_KCAL_MAX. On la garde, sans citer une
    // limite qui n'existe plus.
    toast('Rien n’a bouge.','var(--orange)');
    return;
  }
  saveUser();
  CLOUD.pushOne(currentUser.email,currentUser);
  loadNutrition();
}
/**
 * Le g/kg vu de l'ecran de l'athlete.
 *
 * ⚠ CE GESTE N'EST PLUS BLOQUE PAR LE VERROU DU COACH, et c'est la demande de
 *   Kevin du 20/09/2026 : « si c'est l'athlete qui modifie, ca se modifie sur
 *   la page du coach, et inversement ». Elle ne contourne rien — elle ecrit
 *   dans LA MEME case que lui, `nutrition.tableur`, et le total se recalcule
 *   depuis cette grille commune.
 *
 * ⚠ ET LE CORRECTIF DU 19/09 TIENT TOUJOURS. Ce qu'il protegeait, c'est que la
 *   carte de l'athlete RECALCULE ses cibles dans son coin et efface la
 *   prescription du coach — en la marquant `origine:'athlete'`, ce qui defait
 *   son verrou. Ici l'origine reste `'tableur'` : la grille partagee. Son ±20
 *   et son objectif personnel, eux, restent bloques quand le coach a pose les
 *   chiffres — ce sont des ecarts a SA grille, pas la grille elle-meme.
 * @param {'prot'|'lip'} quoi
 * @param {string|number} val
 */
function athGkg(quoi,val){
  const v=Number(val);
  if(!isFinite(v)||v<=0) return;
  if(quoi!=='prot'&&quoi!=='lip') return;
  if(!currentUser.nutrition) currentUser.nutrition={};
  const tb=currentUser.nutrition.tableur||{};
  if(quoi==='prot') tb.protGkg=v; else tb.lipGkg=v;
  currentUser.nutrition.tableur=tb;
  // ⚠ ON EFFACE LE REPLI DEVENU FAUX. `nutrition.reglages` est lu en dernier
  //   recours par cibleTableur : laisser une vieille valeur a cote de la
  //   neuve n'aurait rien casse aujourd'hui — le foyer passe devant — mais
  //   aurait laisse deux chiffres pour un reglage, et le prochain a lire le
  //   dossier n'aurait pas su lequel fait foi.
  try{
    const r=currentUser.nutrition.reglages;
    if(r){ if(quoi==='prot') delete r.prot; else delete r.lip; }
  }catch(e){}
  _athEcrireGrille();
  loadNutrition();
}
/**
 * Reecrit les macros apres un changement de g/kg venu de l'ecran de l'athlete.
 *
 * ⚠ LE TOTAL NE BOUGE PAS. C'est la limite exacte de ce qu'elle peut faire, et
 *   elle vient d'un test du 19/09/2026 qui l'a rattrapee : recalculer tout le
 *   bloc depuis la grille remplacait le total du coach — 2 100 kcal poses a la
 *   main devenaient 2 112 — c'est-a-dire precisement l'effacement de
 *   prescription que ce correctif-la interdisait. Elle regle la REPARTITION a
 *   l'interieur du total ; le total reste a celui qui l'a pose.
 *
 * ⚠ ET L'ORIGINE N'EST PAS TOUCHEE. La marquer 'athlete' aurait leve le verrou
 *   du coach — c'est le sens de cette valeur. Un changement de repartition
 *   n'est pas une reprise en main : on laisse l'origine telle qu'elle est.
 */
function _athEcrireGrille(){
  if(!currentUser) return false;
  const nut=currentUser.nutrition||{};
  const m=nut.macros||{};
  const poids=(function(){ try{ return poidsNutritionnel(currentUser).kg; }catch(e){ return 0; } })();
  if(!(poids>0)) return false;
  const tb=nut.tableur||{};
  const pk=Number(tb.protGkg), lk=Number(tb.lipGkg);
  // AUCUNE CIBLE ENCORE : il n'y a pas de total a respecter, la grille entiere
  // fait foi — c'est le cas de l'athlete que le coach n'a pas encore reglee.
  if(!m.on||!(Number(m.on.kcal)>0)){
    let t=null;
    try{ t=cibleTableur(currentUser,{}); }catch(e){ return false; }
    if(!t||(t.manque&&t.manque.length)) return false;
    const cyc=(function(){ try{ return dieteCyclee(currentUser); }catch(e){ return false; } })();
    let j=null;
    try{ j=_tbJournees(currentUser,t,cyc); }catch(e){ j=null; }
    if(!j||!j.on) return false;
    currentUser.nutrition=nut;
    // ⚠ `'athlete'` ET NON `'tableur'` DANS CETTE BRANCHE. On n'y entre que
    //   lorsque le dossier ne porte AUCUNE cible : le coach n'a rien pose, et
    //   c'est elle qui regle les siennes. Marquer 'tableur' l'aurait
    //   verrouillee hors de sa propre carte des le premier menu qu'elle
    //   touche — depuis le 20/09/2026 au soir, cette origine ferme la carte.
    nut.macros={on:j.on,off:j.off,origine:'athlete',origineDate:Date.now()};
    saveUser();
    CLOUD.pushOne(currentUser.email,currentUser);
    return true;
  }
  // LE CAS ORDINAIRE : on garde le kcal de chaque journee et on redistribue.
  const _parCoach=(function(){ try{ return ciblesPoseesParCoach(currentUser); }catch(e){ return true; } })();
  const refaire=(bloc)=>{
    const kcal=Math.round(Number(bloc&&bloc.kcal)||0);
    if(!(kcal>0)) return bloc;
    const _ref=poidsMacros(currentUser).kg||poids;
    const r=_repartition(kcal,poids,
      isFinite(pk)&&pk>0?pk:(Number(bloc.p)/_ref),
      isFinite(lk)&&lk>0?lk:undefined,_ref);
    // Le kcal EST celui d'avant, pas celui que _bloc recalculerait a partir
    // des grammes : arrondir trois macros puis re-multiplier les ferait
    // deriver de quelques calories a chaque passage.
    // SAUF SOUS LE PLANCHER, quand les cibles sont les siennes (30/09/2026) :
    // un total d'avant ce build, reste dessous, remonte par les glucides.
    if(!_parCoach&&kcal<plancherAthlete(currentUser))
      return Object.assign({},bloc,_relevePlancher(_bloc(r.p,r.l,r.g),currentUser,true));
    return Object.assign({},bloc,{p:r.p,l:r.l,g:r.g,kcal});
  };
  currentUser.nutrition=nut;
  nut.macros=Object.assign({},m,{on:refaire(m.on),off:refaire(m.off||m.on)});
  saveUser();
  CLOUD.pushOne(currentUser.email,currentUser);
  return true;
}
// La base des g/kg dans la case de la carte : le même composant que « le reste ».
function _baseCase(pm){
  const t=baseGkgCourte(pm);
  return t?'<span class="rc-obj-reste">'+escapeHtml(t)+'</span>':'';
}
function _htmlCiblesAthlete(u){
  // ══ LA FORME VERROUILLEE PASSE DEVANT TOUT LE RESTE ══════════════════════
  // Quand le coach a pose les chiffres, la carte MONTRE LES SIENS — pris a la
  // meme source que les anneaux quinze lignes plus bas — et ne propose plus
  // rien a regler. C'est le correctif du 19/09/2026 : voir ciblesPoseesParCoach.
  //
  // AVANT ciblesAthlete, ET C'EST DELIBERE : le calcul peut echouer faute de
  // poids ou de taille, et la carte se serait tue — en cachant a l'athlete des
  // cibles qui, elles, sont parfaitement ecrites dans son dossier. Ce qu'on
  // affiche ici ne depend d'aucun calcul.
  if(ciblesPoseesParCoach(u)){
    const v=ciblesEnVigueur(u);
    // Interrupteur leve, cibles pas encore ecrites : on le DIT. Retomber sur
    // la carte reglable remettrait entre ses mains ce que le coach vient
    // justement de reprendre.
    if(!v) return '<div class="rc-obj-carte">'
      +'<div class="rc-obj-titre">Mes cibles</div>'
      +'<div class="rc-obj-note" style="margin-top:0;padding-top:0;border-top:none">'
      +'Ton coach n’a pas encore posé tes cibles. Elles apparaîtront ici dès '
      +'qu’il les aura enregistrées.</div></div>';
    // ⚠ LES DEUX MENUS g/kg RESTENT, MEME VERROUILLEE. Demande de Kevin,
    //   20/09/2026 : le reglage est PARTAGE, elle doit pouvoir y toucher et le
    //   coach doit le voir. Ce qui reste bloque, ce sont le ±20 et l'objectif
    //   personnel — des ecarts a la grille du coach, pas la grille elle-meme.
    const _gr=(function(){ try{ return cibleTableur(u,{}); }catch(e){ return null; } })();
    const _ech=(bas,haut)=>{ const o=[];for(let x=bas;x<=haut;x+=0.1) o.push(Math.round(x*10)/10); return o; };
    const _sel=(quoi,val,bas,haut)=>'<select onchange="athGkg(\''+quoi+'\',this.value)" onclick="event.stopPropagation()" '
      +'style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-2);color:var(--text);'
      +'font-size:var(--fs-2xs);padding:4px 6px">'
      +_ech(bas,haut).map(x=>'<option value="'+x+'"'+(Math.abs(x-val)<0.05?' selected':'')+'>'+String(x).replace('.',',')+' g/kg</option>').join('')
      +'</select>';
    const l=(t,n,extra)=>'<div class="rc-obj-l2"><span class="rc-obj-n2">'+t+'</span>'
      +'<span class="rc-obj-v2">'+(extra||'')
      +'<span class="rc-obj-g">'+n+' g</span></span></div>';
    // ⚠ LE ±20 REVIENT, MEME VERROUILLEE (build 1412). Il ne reprend pas la
    //   main sur la prescription : il decale le total PARTAGE, et le coach le
    //   voit sur sa grille comme elle voit le sien.
    const _dl=libelleAjustKcal(u,'athlete');
    // ⚠ QUEL JOUR EST AFFICHE, ET COMBIEN VAUT L'AUTRE (24/09/2026). La carte
    //   montre la journee D'AUJOURD'HUI (ciblesEnVigueur passe par
    //   _getEffectiveMacros et nutIsOnDay) sous un libelle qui disait « kcal
    //   par jour » : un jour de repos, elle affichait 1 661 quand la grille du
    //   coach affichait 1 797, et les deux ecrans semblaient se contredire.
    const _cycA=(function(){ try{ return dieteCyclee(u); }catch(e){ return false; } })();
    const _onA=(function(){ try{ return nutIsOnDay(localISODate(new Date()),u); }
      catch(e){ return true; } })();
    const _autreJour=(function(){
      const m=((u&&u.nutrition)||{}).macros||{};
      const a=_onA?m.off:m.on;
      const k=Math.round(Number((a||{}).kcal)||0);
      return k>0?k:0;
    })();
    const _libJour=_cycA
      ?('kcal aujourd’hui · '+(_onA?'jour d’entraînement':'jour de repos'))
      :'kcal par jour';
    return '<div class="rc-obj-carte">'
      +'<div class="rc-obj-titre">Mes cibles</div>'
      +'<div class="rc-obj-kcal">'
        +'<button type="button" class="rc-obj-pas" onclick="athDelta(-1)" aria-label="Vingt calories de moins">−20</button>'
        +'<div class="rc-obj-centre">'
          +'<div class="rc-obj-nb">'+Number(v.kcal).toLocaleString('fr-FR')+'</div>'
          +'<div class="rc-obj-u">'+_libJour+'</div></div>'
        +'<button type="button" class="rc-obj-pas" onclick="athDelta(1)" aria-label="Vingt calories de plus">+20</button>'
      +'</div>'
      +(_dl?'<div class="rc-obj-ajust">Mis à jour : '+_dl+'</div>':'')
      // Les cibles ont suivi la pesée (build 1840) : dit pendant 7 jours.
      +(function(){ try{ const r=reconcilEnCours(u); if(!r||r.cause!=='poids') return '';
        const d=Math.round(Number(r.apres.on.kcal)-Number(r.avant.on.kcal));
        return '<div class="rc-obj-ajust">Tes cibles ont suivi ta pesée : '+(d>0?'+':'−')+Math.abs(d)+' kcal.</div>'; }catch(e){ return ''; } })()
      +'<div class="rc-obj-macros">'
        // LA BASE DES g/kg, DANS LA CASE (build 1835).
        +l('Protéines',v.p,_gr?_sel('prot',Number(_gr.protGkg)||1.8,1.2,2.6)+_baseCase(_gr.poidsRefObj):'')
        +l('Lipides',v.l,_gr?_sel('lip',Number(_gr.lipGkg)||0.9,0.6,1.4)+_baseCase(_gr.poidsRefObj):'')
        +l('Glucides',v.g,'<span class="rc-obj-reste">le reste</span>')
      +'</div>'
      +'<div class="rc-obj-note">'
      +((_cycA&&_autreJour)
        ?('Les '+(_onA?'jours de repos':'jours d’entraînement')+' : '
          +_autreJour.toLocaleString('fr-FR')+' kcal. ')
        :'')
      +'Le total vient de ton coach. Le ±20 et les '
      +'grammes par kilo se règlent des deux côtés : ce que tu changes ici, il '
      +'le voit sur sa grille, et ce qu’il change, tu le vois ici.</div>'
      +'</div>';
  }
  let c=ciblesAthlete(u);
  if(!c) return '';
  // SANS COACH, APRÈS UN AJUSTEMENT ACCEPTÉ (build 1833) : la carte montre les
  // journées qu'il a écrites (celles des anneaux), pas un recalcul.
  if(!(c.manque&&c.manque.length)&&sansCoach(u)&&((((u.nutrition||{}).macros)||{}).origine==='ajustement'
    ||(function(){ const a=ajustAutoJours(u); return !!(a.on||a.off); })())){
    const v=ciblesEnVigueur(u);
    if(v) c=Object.assign({},c,{kcal:v.kcal,p:v.p,l:v.l,g:v.g});
  }
  if(c.manque&&c.manque.length){
    return '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);'
      +'padding:14px 14px;margin-bottom:20px;font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6">'
      +'Tes cibles ne peuvent pas être calculées : il manque '
      +escapeHtml(c.manque.join(', '))+'. Complète ton bilan.</div>';
  }
  const per=_athPerso(u);
  // Recomp et peak n'ont pas de bouton : « Maintien » est actif (build 1833).
  const _actif=objectifDePhase(c.objectif);
  const bouton=(o)=>'<button type="button" class="rc-obj-b'+(_actif===o.k?' actif':'')
    +'" aria-pressed="'+(_actif===o.k?'true':'false')
    +'" onclick="athObjectif(\''+o.k+'\')">'+o.lib+'</button>';
  // +1e-9 : 0,6 + 9 × 0,1 vaut 1,5000000000000002, et la borne 1,5 sautait.
  const ech=(v,haut)=>{ const o=[];for(let x=v;x<=haut+1e-9;x+=0.1) o.push(Math.round(x*10)/10); return o; };
  const sel=(quoi,val,bas,haut)=>'<select onchange="athGkg(\''+quoi+'\',this.value)" onclick="event.stopPropagation()" '
    +'style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-2);color:var(--text);'
    +'font-size:var(--fs-2xs);padding:4px 6px">'
    +ech(bas,haut).map(x=>'<option value="'+x+'"'+(Math.abs(x-val)<0.05?' selected':'')+'>'+String(x).replace('.',',')+' g/kg</option>').join('')
    +'</select>';
  const ligne=(t,v,u2,extra)=>'<div class="rc-obj-l2"><span class="rc-obj-n2">'+t+'</span>'
    +'<span class="rc-obj-v2">'+(extra||'')
    +'<span class="rc-obj-g">'+v+u2+'</span></span></div>';
  return '<div class="rc-obj-carte">'
    +'<div class="rc-obj-titre">Mon objectif</div>'
    +'<div class="rc-obj-choix">'+ATH_OBJECTIFS.map(bouton).join('')+'</div>'
    +'<div class="rc-obj-kcal">'
      +'<button type="button" class="rc-obj-pas" onclick="athDelta(-1)" aria-label="Vingt calories de moins">−20</button>'
      +'<div class="rc-obj-centre">'
        // LE MEME TOTAL QUE LA GRILLE DU COACH : la somme des grammes
        // AFFICHES, et non le total avant leur arrondi. Les deux ecrans
        // s'ecartaient d'une kilocalorie, ce qui suffit a faire douter.
        +'<div class="rc-obj-nb">'+Number(_bloc(c.p,c.l,c.g).kcal).toLocaleString('fr-FR')+'</div>'
        +'<div class="rc-obj-u">kcal par jour</div></div>'
      +'<button type="button" class="rc-obj-pas" onclick="athDelta(1)" aria-label="Vingt calories de plus">+20</button>'
    +'</div>'
    +(libelleAjustKcal(u,'athlete')?'<div class="rc-obj-ajust">Mis à jour : '+libelleAjustKcal(u,'athlete')+'</div>':'')
    +'<div class="rc-obj-macros">'
      // La plage s'élargit jusqu'à la valeur en vigueur : un menu qui n'a pas
      // l'option affiche la première, et ment sur le réglage (1,5 lu « 0,6 »).
      // LA BASE DES g/kg, DANS LA CASE (build 1835) : « × 87 kg ajustés ».
      +ligne('Protéines',c.p,' g',sel('prot',Number(c.protGkg)||1.8,1.2,Math.max(2.6,Number(c.protGkg)||0))+_baseCase(c.poidsRefObj))
      +ligne('Lipides',c.l,' g',sel('lip',Number(c.lipGkg)||0.9,0.6,Math.max(1.4,Number(c.lipGkg)||0))+_baseCase(c.poidsRefObj))
      +ligne('Glucides',c.g,' g','<span class="rc-obj-reste">le reste</span>')
    +'</div>'
    // Le poids de référence, les glucides très bas, le total dépassé : dits, jamais tus.
    +_htmlAlertesMacros(c,'athlete')
    // TANT QU'AUCUNE CIBLE N'EST ENREGISTRÉE (build 1838) : le premier geste suffit.
    +(macrosRemplies((u&&u.nutrition)||{})?'':'<div class="rc-obj-note">Choisis ton objectif : tes cibles s’enregistrent tout de suite.</div>')
    +'<div class="rc-obj-note">'+(sansCoach(u)
      ?'Tes cibles suivent ton poids : elles se mettent à jour à chaque pesée.'
      :'Ton coach voit ces cibles : elles remplacent celles de sa grille.')+'</div>'
    +'</div>';
}
function _getEffectiveMacros(nut,isOn,dateStr,porteur){
  // Ne s'applique qu'en Diète Flexible — toutes les autres diètes retournent la base intacte
  const base=(isOn?nut.macros?.on:nut.macros?.off)||{};
  if(typeDiete(nut)!=='flexible') return base;
  // Le porteur explicite d'abord, le dossier courant ensuite quand c'est bien
  // sa nutrition, et à défaut la nutrition seule — soit exactement ce que
  // cette fonction savait lire avant ce lot.
  const _porteur=porteur||((nut===((currentUser||{}).nutrition))?currentUser:{nutrition:nut});
  const conf=confCycle(_porteur);
  // `_porteur.gender` ET NON currentUser.gender. Sur la fiche coach et dans le
  // composeur de plan, currentUser est le COACH : l’adaptation de cycle d’une
  // athlète était silencieusement ignorée dès que le coach est un homme, et
  // planCiblesJour produisait alors des grammages calés sur des cibles autres
  // que celles que l’athlète voit sur son propre écran.
  if(!conf.enabled||!conf.lastPeriodDate||!isFemale(_porteur.gender)) return base;
  // La phase vient du MÊME dossier que la config. Passer par
  // _getCyclePhaseNut, qui lit currentUser, faisait dire « cycle actif » à
  // l'une et « aucune phase » à l'autre sur un dossier étranger.
  const phase=phaseCycle(_porteur,dateStr);
  if(!phaseAgissante(phase)||phase==='stable') return base;
  return _applyNutCycleModifier(base,isOn,phase,conf,_porteur);
}

// ── La seule recommandation prescriptive du produit, et elle s'écrivait TOUTE
// SEULE ─────────────────────────────────────────────────────────────────────
// _manageCycleSupplements poussait une entrée dans nutrition.supplements sans
// qu'aucun geste ne l'ait demandée, et un bandeau annonçait « +2 gélules
// recommandées ». Le pied du tableau des compléments dit pourtant l'inverse,
// noir sur blanc : « Ce classement parle de la solidité des preuves, pas de ce
// qui te serait utile à toi. C'est une conversation à avoir avec ton coach. »
// Et l'oméga-3 est classé B, pas A.
//
// CE QUE VAUT LA RÉFÉRENCE, honnêtement. Rahbar et al., BJOG 2012, porte sur
// la DYSMÉNORRHÉE en population générale — pas sur l'inconfort de fin de cycle,
// pas chez des athlètes. L'extrapolation n'est pas établie. Et l'incorporation
// membranaire des oméga-3 se fait sur PLUSIEURS SEMAINES : une prise de cinq à
// huit jours par cycle est physiologiquement discutable. La référence reste
// citée parce qu'elle existe ; elle est située parce qu'elle ne suffit pas.
//
// D'où : une SUGGESTION, un clic, et un refus mémorisé. Aucune écriture.
const SUGG_OMEGA3_CLE='omega3_luteal';
const SUGG_REFUS_MAX=20;
const SUGG_OMEGA3_TEXTE='Certaines femmes trouvent un bénéfice aux oméga-3 sur '
  +'l\'inconfort de fin de cycle. Les données sont limitées (niveau de preuve B). '
  +'Tu veux l\'ajouter à ta liste ?';
// PURE. Elle ne pousse rien, n'appelle pas saveUser, et ne désactive plus rien.
function suggestionCycleSupplements(user,dateISO){
  const u=user||currentUser||{};
  const nut=u.nutrition||{};
  // Conditions CONSERVÉES de l'existant : diète flexible, cycle configuré,
  // athlète femme, lutéale tardive agissante, aucun oméga-3 déjà présent.
  if(typeDiete(nut)!=='flexible') return null;
  if(!isFemale(u._evol_gender||u.gender)) return null;
  const conf=confCycle(u);
  if(!conf.enabled||!conf.lastPeriodDate) return null;
  // AJOUTÉE par ce lot, et non conservée : la sensibilité PMS ne conditionnait
  // rien jusqu'ici. Elle restreint donc la portée — c'est voulu.
  if(!conf.sensibilitePms) return null;
  const ph=phaseCycle(u,dateISO||localISODate(new Date()));
  if(!phaseAgissante(ph)||ph!=='luteal_late') return null;
  // Ni sous contraception continue — la phase n'est déjà plus agissante — ni
  // sous contraception cyclique, où la fin de plaquette n'est pas une phase
  // lutéale.
  if(cycleCalendaireSeul(u)) return null;
  const list=Array.isArray(nut.supplements)?nut.supplements:[];
  // Quelle qu'en soit l'origine : une entrée déjà là rend la question sans objet.
  if(list.some(s=>s&&/om[eé]ga/i.test(String(s.name||'')))) return null;
  const refus=((u.cycle||{}).suggestionsRefusees)||[];
  if(refus.indexOf(SUGG_OMEGA3_CLE)>=0) return null;
  const f=_suppFiche('Oméga-3');
  return {suggere:true,cle:SUGG_OMEGA3_CLE,libelle:SUGG_OMEGA3_TEXTE,
    preuve:(f&&f.preuve)||'B'};
}
// L'entrée créée est EXACTEMENT celle d'avant, champ pour champ : ce lot change
// qui la décide, pas ce qu'elle contient.
function accepterSuggestionCycle(){
  if(!suggestionCycleSupplements(currentUser)) return false;
  _suppStore().push({id:'cycle_o3_'+Date.now(),name:'Oméga-3 (EPA/DHA)',
    dosage_quantity:2,dosage_unit:'gélules',timings:['soir'],
    notes:'Phase lutéale tardive : soutien anti-inflammatoire',
    active:true,_cycleManaged:true,_cyclePhase:'luteal_late'});
  const ok=saveUser();
  toastEcriture(ok,'Ajouté à ta liste '+ICO.coche,'le complément est');
  try{ _renderNutriContent(typeDiete(currentUser.nutrition)); }catch(e){}
  return true;
}
// Un refus ne se redemande pas au cycle suivant. Il ne se lève que depuis les
// réglages, par un geste explicite.
function refuserSuggestionCycle(){
  if(!currentUser.cycle) currentUser.cycle={};
  const l=(Array.isArray(currentUser.cycle.suggestionsRefusees)
    ?currentUser.cycle.suggestionsRefusees:[]).slice();
  if(l.indexOf(SUGG_OMEGA3_CLE)<0) l.push(SUGG_OMEGA3_CLE);
  currentUser.cycle.suggestionsRefusees=l.slice(-SUGG_REFUS_MAX);
  saveUser();
  try{ _renderNutriContent(typeDiete(currentUser.nutrition)); }catch(e){}
  return true;
}
function revoirSuggestionsCycle(){
  if(!currentUser.cycle) currentUser.cycle={};
  currentUser.cycle.suggestionsRefusees=[];
  saveUser();
  try{ _renderNutriContent(typeDiete(currentUser.nutrition)); }catch(e){}
  return true;
}
function _htmlSuggestionCycle(user){
  const s=suggestionCycleSupplements(user||currentUser);
  if(!s) return '';
  return `<div style="margin-bottom:10px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:12px 14px">
    <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.7">${escapeHtml(s.libelle)}</div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button onclick="accepterSuggestionCycle()" class="btn btn-outline btn-sm" style="flex:1;margin:0;font-size:var(--fs-2xs);letter-spacing:1px">Ajouter</button>
      <button onclick="refuserSuggestionCycle()" class="btn btn-outline btn-sm" style="flex:1;margin:0;font-size:var(--fs-2xs);letter-spacing:1px;color:var(--sub)">Non merci</button>
    </div>
  </div>`;
}
// MIGRATION. Les entrées déjà écrites par l'app restent : personne ne se fait
// retirer une ligne sans le savoir. On dit d'où elle vient, et on laisse le
// choix — c'est tout ce que ce lot doit à ceux qui l'ont subie.
function _htmlMigrationCycleSupp(user){
  const u=user||currentUser||{};
  const list=((u.nutrition||{}).supplements)||[];
  if(((u.cycle||{}).migrationSuppVue)) return '';
  if(!list.some(x=>x&&x._cycleManaged)) return '';
  return `<div style="margin-bottom:10px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:12px 14px">
    <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.7">Cette ligne avait été ajoutée automatiquement par l'app. Tu peux la garder ou la retirer.</div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button onclick="garderSuggestionCycleAuto()" class="btn btn-outline btn-sm" style="flex:1;margin:0;font-size:var(--fs-2xs);letter-spacing:1px">Je la garde</button>
      <button onclick="retirerSuggestionCycleAuto()" class="btn btn-outline btn-sm" style="flex:1;margin:0;font-size:var(--fs-2xs);letter-spacing:1px;color:var(--sub)">La retirer</button>
    </div>
  </div>`;
}
function garderSuggestionCycleAuto(){
  if(!currentUser.cycle) currentUser.cycle={};
  currentUser.cycle.migrationSuppVue=true;
  saveUser();
  try{ _renderNutriContent(typeDiete(currentUser.nutrition)); }catch(e){}
  return true;
}
function retirerSuggestionCycleAuto(){
  const l=_suppStore();
  for(let i=l.length-1;i>=0;i--) if(l[i]&&l[i]._cycleManaged) l.splice(i,1);
  if(!currentUser.cycle) currentUser.cycle={};
  currentUser.cycle.migrationSuppVue=true;
  const ok=saveUser();
  toastEcriture(ok,'Ligne retirée','la suppression est');
  try{ _renderNutriContent(typeDiete(currentUser.nutrition)); }catch(e){}
  return true;
}

function _renderCycleNutSettings(nut){
  if(!isFemale(currentUser.gender)) return '';
  // Une seule lecture, celle de confCycle : les réglages écrivent désormais
  // dans user.cycle, et relire nut.cycleAdaptation afficherait l'état d'avant.
  const conf=confCycle(currentUser);
  const on=!!conf.enabled;
  const lastP=conf.lastPeriodDate||'';
  const len=conf.cycleLength||28;
  const intens=conf.intensiteRegles;
  const pms=!!conf.sensibilitePms;
  const regulier=!!conf.regulier;
  const today=localISODate(new Date());
  const isOn=nutIsOnDay(today);
  const base=(isOn?nut.macros?.on:nut.macros?.off)||{};
  // La longueur observée, quand le journal en porte assez pour la dire.
  const _obs=longueurObservee(currentUser);
  const _nObs=_cyclesObserves(currentUser);
  const obsHtml=_obs
    ?`<div style="font-size:var(--fs-xs);color:var(--sub);margin-top:8px">longueur observée : <strong style="color:var(--text)">${_obs} jours</strong> (sur ${_nObs} cycle${_nObs>1?'s':''})</div>`
    :'';
  // La case d'absence reflète une déclaration du mois en cours, rien de plus.
  const _abs=((currentUser.cycle||{}).absences)||[];
  const absenceCeMois=_abs.some(d=>String(d).slice(0,7)===today.slice(0,7));
  // Un refus ne se lève que d'un geste : sans ce bouton, il serait définitif.
  const _refusCycle=((((currentUser||{}).cycle)||{}).suggestionsRefusees||[]).length>0;
  // Sous contraception cyclique, ce qui se répète est une PLAQUETTE, pas un
  // cycle : « phase lutéale tardive » décrirait une physiologie qui n'a pas
  // lieu. Seuls les libellés changent ; les valeurs internes, elles, sont les
  // mêmes partout. Déclaré ICI et non dans le bloc du bandeau : le texte
  // d'aide du réglage PMS en a besoin lui aussi, et il est rendu plus bas.
  const _calSeul=cycleCalendaireSeul(currentUser);
  const _contra=contraceptionDe(currentUser);
  const _partage=!!((((currentUser||{}).cycle)||{}).contraceptionPartagee);
  let phaseHtml='';
  // Sans cycle à suivre, le bandeau s'affiche quand même : c'est LUI qui porte
  // l'explication, et il n'y a par définition aucune date de règles.
  if(on&&(lastP||phaseCycle(currentUser,today)==='sans_cycle')){
    const phase=_getCyclePhaseNut(today);
    const pLabels={
      menstrual:{txt:_calSeul?'Semaine d\'arrêt':'Phase menstruelle (J1-5)',color:'#a78bfa'},
      stable:{txt:_calSeul?'Milieu de plaquette':'Phase stable : référence',color:'var(--green)'},
      luteal_late:{txt:_calSeul?'Fin de plaquette':'Phase lutéale tardive',color:'var(--orange)'},
      perime:{txt:'Date trop ancienne',color:'var(--sub)'},
      irregulier:{txt:'Cycles irréguliers',color:'var(--sub)'},
      sans_cycle:{txt:'Pas de phases à suivre',color:'var(--sub)'}
    };
    const pl=phase?pLabels[phase]:null;
    const eff=phaseAgissante(phase)&&phase!=='stable'
      ?_applyNutCycleModifier(base,isOn,phase,conf,currentUser):base;
    const dKcal=Math.round((eff.kcal||0)-(base.kcal||0));
    const dG=Math.round((eff.g||0)-(base.g||0));
    const dL=parseFloat(((eff.l||0)-(base.l||0)).toFixed(1));
    const hasAdj=dKcal!==0||dG!==0||dL!==0;
    const adjLabel=hasAdj
      ?[dG!==0?`glucides ${dG>0?'+':''}${dG}g`:null,dL!==0?`lipides ${dL>0?'+':''}${dL}g`:null,dKcal!==0?`${dKcal>0?'+':''}${dKcal} kcal`:null].filter(Boolean).join(' · ')
      :phase==='sans_cycle'?CYCLE_MSG_SANS_CYCLE
      :_calSeul?'Repère de plaquette : aucun ajustement de macros'
      :phase==='perime'?messageCyclePerime(currentUser,today)
      :phase==='irregulier'?CYCLE_MSG_IRREGULIER
      :phase==='luteal_late'&&!conf.sensibilitePms?'Sensibilité PMS désactivée : pas d\'ajustement'
      :phase==='menstrual'&&intens!=='difficile'?'Règles supportables : pas d\'ajustement':'Macros inchangées';
    if(pl) phaseHtml=`<div data-phase-cycle style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
      <span style="font-size:var(--fs-xs);font-weight:800;color:${pl.color};background:${pl.color}18;border:1px solid ${pl.color}33;border-radius:var(--r-2);padding:4px 10px">${pl.txt}</span>
      <div style="font-size:var(--fs-xs);color:var(--sub);margin-top:6px">${hasAdj?'Ajust. actif : ':''}<span style="color:${hasAdj?'var(--text)':'var(--sub)'}">${adjLabel}</span></div>
    </div>`;
    else phaseHtml=`<div style="font-size:var(--fs-xs);color:var(--sub);margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">Date antérieure au cycle actuel : mets à jour la date des règles.</div>`;
  }
  const needDate=on&&!lastP?`<div style="font-size:var(--fs-xs);color:var(--orange);margin-top:8px">↑ Renseigne la date de tes dernières règles pour activer l'adaptation.</div>`:'';
  const settingsHtml=on?`<div style="margin-top:12px;display:flex;flex-direction:column;gap:10px">
    ${needDate}
    <div>
      <div style="font-size:var(--fs-xs);color:var(--sub);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:6px">Dernières règles</div>
      <input type="date" id="cycle-last-period" value="${lastP}" max="${today}"
        style="width:100%;padding:10px 12px;background:var(--surface-2);border:1.5px solid var(--border);border-radius:var(--r-2);color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-md);box-sizing:border-box"
        onchange="saveCycleNutSettings()">
    </div>
    <div>
      <div style="font-size:var(--fs-xs);color:var(--sub);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:6px">Longueur du cycle (jours)</div>
      <!-- onchange et NON oninput : le gestionnaire se termine par un
           _renderNutriContent qui reconstruit ce champ. À chaque frappe il
           était donc détruit et recréé : le focus partait, et « 3 » avait déjà
           été ramené à 20 avant qu'on ait pu taper le second chiffre. Saisir
           « 30 » était matériellement impossible. onchange n'intervient qu'au
           blur, quand la valeur est complète. -->
      <input type="number" id="cycle-len" value="${len}" min="20" max="40"
        style="width:100%;padding:10px 12px;background:var(--surface-2);border:1.5px solid var(--border);border-radius:var(--r-2);color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-md);box-sizing:border-box"
        onchange="saveCycleNutSettings()">
    </div>
    <div>
      <div style="font-size:var(--fs-xs);color:var(--sub);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:8px">Intensité des règles</div>
      <div style="display:flex;gap:8px">
        <button onclick="saveCycleNutSettings('intensite','supportable')" style="flex:1;padding:10px 0;border-radius:var(--r-2);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;cursor:pointer;border:1.5px solid ${intens==='supportable'?'var(--green)':'var(--border)'};background:${intens==='supportable'?'rgba(34,197,94,.12)':'#111'};color:${intens==='supportable'?'var(--green)':'#555'}">Supportable</button>
        <button onclick="saveCycleNutSettings('intensite','difficile')" style="flex:1;padding:10px 0;border-radius:var(--r-2);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;cursor:pointer;border:1.5px solid ${intens==='difficile'?'var(--red)':'var(--border)'};background:${intens==='difficile'?'rgba(224,32,32,.12)':'#111'};color:${intens==='difficile'?'var(--red)':'#555'}">Difficile</button>
      </div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid var(--border)">
      <div>
        <div style="font-size:var(--fs-sm);font-weight:700;color:var(--text)">Sensibilité PMS</div>
        <div style="font-size:var(--fs-xs);color:var(--sub);margin-top:2px">${_calSeul?'Sans effet sur les macros sous contraception cyclique':'+4% calories jours OFF en phase lutéale tardive'}</div>
      </div>
      <label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;margin-left:12px;cursor:pointer">
        <input type="checkbox" id="cycle-pms" ${pms?'checked':''} onchange="saveCycleNutSettings()" style="opacity:0;width:0;height:0;position:absolute">
        <span style="position:absolute;inset:0;background:${pms?'var(--red)':'var(--border)'};border-radius:var(--r-3);transition:background var(--t-2);pointer-events:none">
          <span style="position:absolute;top:3px;left:3px;width:18px;height:18px;background:#fff;border-radius:var(--r-full);transition:transform var(--t-2);transform:translateX(${pms?'20px':'0px'})"></span>
        </span>
      </label>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid var(--border)">
      <div>
        <div style="font-size:var(--fs-sm);font-weight:700;color:var(--text)">Ajuster la charge d'après la phase</div>
        <div style="font-size:var(--fs-xs);color:var(--sub);margin-top:2px">Coupé : seule ta réponse du jour (« règles, c'est dur », « ça va ») modifie la charge proposée.</div>
      </div>
      <label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;margin-left:12px;cursor:pointer">
        <input type="checkbox" id="cycle-ajuster" ${conf.ajusterAuto?'checked':''} onchange="saveCycleNutSettings()" aria-label="Ajuster la charge d'après la phase" style="opacity:0;width:0;height:0;position:absolute">
        <span style="position:absolute;inset:0;background:${conf.ajusterAuto?'var(--red)':'var(--border)'};border-radius:var(--r-3);transition:background var(--t-2);pointer-events:none">
          <span style="position:absolute;top:3px;left:3px;width:18px;height:18px;background:#fff;border-radius:var(--r-full);transition:transform var(--t-2);transform:translateX(${conf.ajusterAuto?'20px':'0px'})"></span>
        </span>
      </label>
    </div>
    <div style="border-top:1px solid var(--border);padding-top:10px">
      <!-- Aucun nom de produit, aucun dosage, aucune date de début : la seule
           chose dont le calcul a besoin est de savoir si un calendrier veut
           dire quelque chose. RepCore ne donne aucun conseil sur ce sujet. -->
      <div style="font-size:var(--fs-xs);color:var(--sub);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:8px">Contraception</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${CONTRACEPTIONS.map(c=>`<button onclick="saveCycleNutSettings('contraception','${c.cle}')"
          style="text-align:left;padding:10px 12px;border-radius:var(--r-2);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:700;cursor:pointer;line-height:1.45;border:1.5px solid ${_contra===c.cle?'var(--red)':'var(--border)'};background:${_contra===c.cle?'rgba(224,32,32,.10)':'#111'};color:${_contra===c.cle?'var(--text)':'#666'}">${escapeHtml(c.lib)}</button>`).join('')}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0 2px;margin-top:10px;border-top:1px solid var(--border)">
        <div>
          <div style="font-size:var(--fs-sm);font-weight:700;color:var(--text)">Partager avec mon coach</div>
          <div style="font-size:var(--fs-xs);color:var(--sub);margin-top:2px;line-height:1.5">Désactivé, cette réponse ne quitte pas ce téléphone, et un changement d'appareil la perd.</div>
        </div>
        <label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;margin-left:12px;cursor:pointer">
          <input type="checkbox" id="cycle-contra-partage" ${_partage?'checked':''} onchange="saveCycleNutSettings()" style="opacity:0;width:0;height:0;position:absolute">
          <span style="position:absolute;inset:0;background:${_partage?'var(--red)':'var(--border)'};border-radius:var(--r-3);transition:background var(--t-2);pointer-events:none">
            <span style="position:absolute;top:3px;left:3px;width:18px;height:18px;background:#fff;border-radius:var(--r-full);transition:transform var(--t-2);transform:translateX(${_partage?'20px':'0px'})"></span>
          </span>
        </label>
      </div>
    </div>
    <div style="border-top:1px solid var(--border);padding-top:10px">
      <!-- DEUX boutons et non un interrupteur : « off » ne saurait pas dire
           si rien n'a été déclaré ou si les cycles sont irréguliers, et le
           second couperait tous les ajustements automatiques. Tant que rien
           n'est choisi, aucun des deux n'est allumé. -->
      <div style="font-size:var(--fs-xs);color:var(--sub);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:8px">Régularité</div>
      <div style="display:flex;gap:8px">
        <button onclick="saveCycleNutSettings('regulier','oui')" style="flex:1;padding:10px 0;border-radius:var(--r-2);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;cursor:pointer;border:1.5px solid ${regulier===true?'var(--green)':'var(--border)'};background:${regulier===true?'rgba(34,197,94,.12)':'#111'};color:${regulier===true?'var(--green)':'#555'}">Réguliers</button>
        <button onclick="saveCycleNutSettings('regulier','non')" style="flex:1;padding:10px 0;border-radius:var(--r-2);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;cursor:pointer;border:1.5px solid ${regulier===false?'var(--orange)':'var(--border)'};background:${regulier===false?'rgba(245,158,11,.12)':'#111'};color:${regulier===false?'var(--orange)':'#555'}">Irréguliers</button>
      </div>
      ${obsHtml}
    </div>
    ${_refusCycle?`<div style="border-top:1px solid var(--border);padding-top:10px">
      <div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.55;margin-bottom:8px">Tu as écarté une suggestion de complément.</div>
      <button onclick="revoirSuggestionsCycle()" class="btn btn-outline btn-sm" style="width:100%;margin:0;letter-spacing:1px;font-size:var(--fs-2xs)">Revoir les suggestions</button>
    </div>`:''}
    <div style="border-top:1px solid var(--border);padding-top:10px">
      <button onclick="declarerReglesAujourdhui()" class="btn btn-outline btn-sm" style="width:100%;margin:0;letter-spacing:1px;font-size:var(--fs-2xs)">Mes règles ont commencé aujourd'hui</button>
      <label style="display:flex;align-items:center;gap:10px;margin-top:10px;cursor:pointer">
        <input type="checkbox" id="cycle-absence" ${absenceCeMois?'checked':''} onchange="declarerAbsenceCycle(this.checked)" style="width:16px;height:16px;accent-color:var(--red);flex-shrink:0">
        <span style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.5">Je n'ai pas eu mes règles ce mois-ci</span>
      </label>
    </div>
    ${phaseHtml}
  </div>`:'';
  return `<div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-4);padding:14px;margin-bottom:20px">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:var(--fs-xs);color:var(--sub);text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:4px">Adaptation cycle menstruel</div>
        <div style="font-size:var(--fs-xs);color:var(--sub)">Ajuste tes macros selon ta phase</div>
      </div>
      <label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;cursor:pointer">
        <input type="checkbox" id="cycle-enabled" ${on?'checked':''} onchange="saveCycleNutSettings()" style="opacity:0;width:0;height:0;position:absolute">
        <span style="position:absolute;inset:0;background:${on?'var(--red)':'var(--border)'};border-radius:var(--r-3);transition:background var(--t-2);pointer-events:none">
          <span style="position:absolute;top:3px;left:3px;width:18px;height:18px;background:#fff;border-radius:var(--r-full);transition:transform var(--t-2);transform:translateX(${on?'20px':'0px'})"></span>
        </span>
      </label>
    </div>
    ${settingsHtml}
  </div>`;
}

// L'écriture va dans user.cycle, la SEULE cible désormais. Rien n'est recopié
// depuis nutrition.cycleAdaptation : le repli de confCycle est champ par
// champ, donc un réglage modifié seul ne fait perdre aucun des autres.
// « Mes règles ont commencé aujourd'hui » : une entrée au journal ET la date
// de référence remise à jour. C'est le geste qui fait repartir les
// ajustements après une péremption.
function declarerReglesAujourdhui(){
  _cycleAjouterRegles(currentUser,localISODate(new Date()));
  const ok=saveUser();
  toastEcriture(ok,'Date enregistrée '+ICO.coche,'la date est');
  _renderNutriContent(typeDiete(currentUser.nutrition));
}
// Consigné, jamais commenté. Aucune alarme sur une occurrence, aucune
// notification : ce champ est une donnée, pas un message.
function declarerAbsenceCycle(coche){
  const mois=localISODate(new Date()).slice(0,7);
  if(!currentUser.cycle) currentUser.cycle={};
  if(coche) _cycleAjouterAbsence(currentUser,localISODate(new Date()));
  else currentUser.cycle.absences=(currentUser.cycle.absences||[])
    .filter(d=>String(d).slice(0,7)!==mois);
  saveUser();
  _renderNutriContent(typeDiete(currentUser.nutrition));
}
function saveCycleNutSettings(field,value){
  if(!currentUser.cycle) currentUser.cycle={};
  const conf=currentUser.cycle;
  if(field==='intensite'){
    conf.intensiteRegles=value;
  } else if(field==='contraception'){
    try{ if(conf.contraception!==value)
      marquerDeclaration(currentUser,'cycle',value,
        (value&&value!=='aucune')?'declare':'retire'); }catch(e){}
    conf.contraception=CONTRACEPTIONS.some(x=>x.cle===value)?value:undefined;
  } else if(field==='regulier'){
    // Recliquer le bouton déjà allumé retire la déclaration : on redevient
    // « pas déclaré », ce qu'aucun interrupteur ne savait exprimer.
    const v=(value==='oui');
    conf.regulier=(conf.regulier===v)?undefined:v;
  } else {
    const g=id=>document.getElementById(id);
    if(g('cycle-enabled')) conf.enabled=g('cycle-enabled').checked;
    if(g('cycle-pms')) conf.sensibilitePms=g('cycle-pms').checked;
    if(g('cycle-ajuster')){ if(g('cycle-ajuster').checked) conf.ajusterAuto=true; else delete conf.ajusterAuto; }
    if(g('cycle-contra-partage')) conf.contraceptionPartagee=g('cycle-contra-partage').checked;
    if(g('cycle-last-period')&&g('cycle-last-period').value) conf.lastPeriodDate=g('cycle-last-period').value;
    // Ne clamper qu'une valeur COMPLÈTE. Un champ vidé ne doit rien écrire :
    // le clamp le remplacerait par 20 sous les doigts de l'utilisatrice.
    // parseInt(...)||28 était pire encore : une saisie illisible retombait
    // silencieusement sur 28, en écrasant la valeur précédemment enregistrée.
    // Ici, ce qui n'est pas un nombre ne touche à rien.
    const _len=g('cycle-len')?String(g('cycle-len').value).trim():'';
    if(_len!==''){
      const _n=parseInt(_len,10);
      if(isFinite(_n)) conf.cycleLength=Math.max(20,Math.min(40,_n));
    }
  }
  saveUser();
  _renderNutriContent(typeDiete(currentUser.nutrition));
}

// N2.18 — _renderMacroTargets EST PARTIE le 26/08/2026. Quarante lignes sans
// aucun appelant, et son propre commentaire le disait deja. Elle portait en
// outre une colonne « SUCRE » que le reste du produit a retiree : un objectif
// que rien ne compare ne se saisit pas.
// ── Proposition côté athlète ───────────────────────────────────────────────
// Elle ne s'affiche QUE si personne n'a rempli les objectifs. Dès qu'un coach
// a écrit des macros, cette carte disparaît : le coach prime, toujours, et il
// n'y a pas de bouton capable d'écraser son travail.
//
// Note : la zone annoncée dans le cahier des charges n'existe pas — la
// fonction qui la rendait n'était appelée nulle part, et elle a été retirée.
// La carte est donc posée dans _renderNutriContent, l'écran où l'athlète
// regarde réellement ses macros.
function macrosRemplies(nut){
  const m=(nut&&nut.macros)||{};
  const rempli=o=>!!o&&['kcal','p','g','l'].some(k=>Number(o[k])>0);
  return rempli(m.on)||rempli(m.off);
}
// PURE. Le texte DEJA echappe, avec le ⓘ du NEAT pose juste apres le premier
// « NEAT » — et nulle part ailleurs. Sans « NEAT », le texte revient intact.
function _premierNeatInfo(h){
  const i=String(h).indexOf('NEAT');
  return i<0?h:h.slice(0,i+4)+rcInfo('neat')+h.slice(i+4);
}
// La carte « Mon objectif » rend-elle sa forme RÉGLABLE ? (build 1838) Alors
// elle est LA proposition chiffrée : le point de départ ne s'y ajoute pas.
function carteObjectifReglable(u){
  try{
    if(ciblesPoseesParCoach(u)) return false;
    const c=ciblesAthlete(u);
    return !!(c&&!(c.manque&&c.manque.length));
  }catch(e){ return false; }
}
function _htmlDepartAthlete(nut){
  if(macrosRemplies(nut)) return '';
  if(carteObjectifReglable(currentUser)) return '';
  // La même phase que la carte (et que cibleTableur) : l'objectif de l'athlète.
  const b=besoinsProposes(currentUser,{objectif:((nut&&nut.perso)||{}).objectif});
  if(!b||b.source===null) return '';
  // Le nom vient de la formule QUI A CALCULE (b.source), jamais d'un défaut.
  const nom=mbNom(b.source);
  const bloc=(t,j,coul)=>`<div style="flex:1;min-width:0;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:10px 6px;text-align:center">
      <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:1.2px;color:${coul};margin-bottom:6px">${t}</div>
      <div style="font-size:var(--fs-lg);font-weight:900;color:var(--text);line-height:1">${j.kcal}<span style="font-size:var(--fs-2xs);color:var(--sub);font-weight:400"> kcal</span></div>
      <div style="font-size:var(--fs-2xs);color:var(--sub);margin-top:4px;line-height:1.5">P ${j.p} · G ${j.g} · L ${j.l}<br>Fibres ${j.f}</div>
    </div>`;
  return `<div style="background:var(--dark);border:1px solid var(--surface-2);border-radius:var(--r-4);padding:14px;margin-bottom:20px">
    <div style="font-size:var(--fs-xs);color:var(--sub);text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:4px">Point de départ proposé</div>
    <div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-bottom:12px">Ton coach n'a pas encore fixé tes objectifs. Voici un point de départ calculé sur ton dernier bilan : tu peux l'utiliser en attendant.</div>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      ${bloc('JOUR ON',b.on,'var(--success)')}
      ${bloc('JOUR OFF',b.off,'var(--sub)')}
    </div>
    <button class="btn btn-outline btn-sm" style="width:100%;margin:0;letter-spacing:1px;font-size:var(--fs-2xs)" onclick="utiliserBesoinsProposes()">Enregistrer ces objectifs</button>
    <!-- R10 : LES HYPOTHESES SONT REPLIEES, PAS REECRITES. Le texte du repli
         est celui d'avant, au caractere pres : seul le ⓘ du NEAT s'y ajoute,
         apres le premier emploi du mot. -->
    <details class="nut-hyp" style="margin-top:10px">
      <summary style="font-size:var(--fs-2xs);color:var(--sub);cursor:pointer">Comment ces objectifs sont calculés</summary>
      <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6;margin-top:6px">${escapeHtml(nom)} · dépense estimée ${b.depense} kcal : ${_premierNeatInfo(escapeHtml(b.hypotheses.join(' · ')))}.</div>
    </details>
    ${blocDisclaimerSante()}
  </div>`;
}
async function utiliserBesoinsProposes(){
  const nut=currentUser.nutrition||{};
  // Deuxième garde, au MOMENT de l'écriture et pas seulement au rendu : entre
  // l'affichage de la carte et le clic, une synchronisation a pu apporter les
  // macros du coach. On ne les écrase pas.
  if(macrosRemplies(nut)){ toast('Ton coach a fixé tes objectifs entre-temps','var(--orange)'); loadNutrition(); return; }
  const b=besoinsProposes(currentUser,{objectif:((nut&&nut.perso)||{}).objectif});
  if(!b||b.source===null){ toast('Données de base incomplètes','var(--orange)'); return; }
  // Un DÉFICIT ne s'écrit pas d'un clic. Ce chemin-ci n'est relu par personne :
  // l'athlète appuie et les objectifs sont posés. Le chemin coach, lui, reste
  // ouvert — un professionnel voit les chiffres avant de valider.
  const deficit=(b.delta<0)?-b.delta:0;
  if(deficit>0){
    // Antécédent de TCA déclaré : personne ne passe outre, même en confirmant.
    // Même garde-fou qu'ajustementPropose, pour la même raison — proposer de
    // manger moins est exactement ce qu'il existe pour empêcher.
    let tca=false;
    try{ tca=aTCA(currentUser); }catch(e){}
    if(tca){
      toast('Vu ce que tu as déclaré, RepCore ne pose pas de déficit tout seul. Passe par ton coach.','var(--orange)');
      return;
    }
    if(!await rcConfirm('Ces objectifs posent un déficit d\'environ '+deficit
      +' kcal par jour, sous ta dépense estimée de '+b.depense+' kcal.'
      +String.fromCharCode(10)+String.fromCharCode(10)
      +'Tu peux les modifier à tout moment. Continuer ?',null,'Confirmer')) return;
  }
  const j=o=>({kcal:o.kcal,p:o.p,g:o.g,l:o.l,f:o.f});
  if(!currentUser.nutrition) currentUser.nutrition={};
  currentUser.nutrition.macros={on:j(b.on),off:j(b.off),origine:'auto',
    origineDate:Date.now(),origineSource:b.source};
  const ok=saveUser();
  toastEcriture(ok,'Objectifs enregistrés '+ICO.coche,'les objectifs sont');
  loadNutrition();
}

// ── Les trois anneaux, PARTAGES ───────────────────────────────────────
// Ils vivaient DANS _renderStrictMacroRings. L accueil les affiche desormais
// lui aussi : une seconde implementation aurait fini par diverger de
// celle-ci au premier ajustement de couleur, d arrondi ou de seuil.
//
// `tot` porte le consomme, `m` les cibles. Les deux ecrans les calculent
// differemment — journal alimentaire d un cote, plan valide de l autre — mais
// le dessin, lui, est le meme.

// ══════════════ EXPRESSION DES MACROS : g · % · g/kg ══════════════════════
// PUREMENT PRÉSENTATIONNEL. Rien n'est écrit, ni dans le dossier ni ailleurs :
// la préférence vit en session. Le moteur — besoinsProposes, _repartition,
// _getEffectiveMacros — n'est pas touché d'une ligne.
//
// CE QUE LE SÉLECTEUR NE COUVRE PAS, ET POURQUOI. Le bloc macros du coach
// n'est pas un affichage : ce sont DIX CHAMPS DE SAISIE dont la valeur repart
// telle quelle vers le dossier, en grammes. Y convertir le contenu ferait
// partir un « 30 » tapé en pourcentage comme 30 grammes de protéines. Le coach
// reçoit donc une ligne de LECTURE SEULE sous ses champs, qui reformule ce
// qu'il vient de taper sans y toucher.
//
// Le calcul par aliment du journal reste en grammes : « 2,0 g/kg de poids de
// corps » pour 100 g de riz ne veut rien dire.
const MACRO_UNITES=Object.freeze(['g','pct','gkg']);
const MACRO_KCAL=Object.freeze({p:4,c:4,g:4,l:9});
// N2.14 — L'ALCOOL A SA CONSTANTE, comme les trois autres. Il valait 7 en dur
// dans nutriAtwater et ZERO dans _kcalAtwater : le meme spiritueux recevait
// deux verdicts de coherence selon l'ecran d'ou on le regardait.
const ALCOOL_KCAL=7;
// N2.14 — LA CONVERSION DES MACROS EN CALORIES, EN UN SEUL ENDROIT.
// Le facteur 4/4/9 etait reecrit a la main une quinzaine de fois alors que
// MACRO_KCAL existait deja et ne servait qu'a partsPourcent. Cette fonction
// est la forme POSITIONNELLE ; nutriAtwater en est la forme objet, et toutes
// deux rendent exactement les memes nombres qu'avant.
//
// L'ALCOOL COMPTE. Une seule regle desormais : 7 kcal/g, partout. Sans lui, un
// spiritueux affiche un ecart delirant — mesure sur la table Ciqual : 62 900 %
// sur le whisky, 3 192 % sur le vin blanc sec, parce que ses calories ne
// viennent d'aucune des trois macros.
function kcalDesMacros(p,c,l,alcool){
  return (p||0)*MACRO_KCAL.p+(c||0)*MACRO_KCAL.c
        +(l||0)*MACRO_KCAL.l+(alcool||0)*ALCOOL_KCAL;
}
const MACRO_UNITE_CLE='rc_macro_unite';
const MACRO_GLUC_ZERO='Les protéines et les lipides saturent déjà la cible : '
  +'il ne reste rien pour les glucides. Ce n\'est pas un objectif à zéro, '
  +'c\'est un réglage qui ne laisse pas de place.';

// PURE. Les trois parts en pourcentage des kcal, SOMME EXACTEMENT 100.
//
// L'arrondi est porté par les GLUCIDES : on arrondit protéines et lipides,
// puis on donne le reste aux glucides. Arrondir les trois indépendamment
// produit 99 ou 101 une fois sur deux, et un total qui ne fait pas 100 dans un
// écran de nutrition est une faute visible.
//
// Le total de référence est celui RÉELLEMENT servi (4p+9l+4g), pas la cible :
// quand protéines et lipides la dépassent déjà — le cas documenté de
// _repartition — la somme sur la cible vaudrait plus de 100. Sur le total
// servi, elle vaut 100 par construction, et elle est vraie.
function partsPourcent(p,l,g){
  const P=Math.max(0,Number(p)||0), L=Math.max(0,Number(l)||0), G=Math.max(0,Number(g)||0);
  const total=MACRO_KCAL.p*P+MACRO_KCAL.l*L+MACRO_KCAL.c*G;
  if(!(total>0)) return null;
  let pp=Math.round(MACRO_KCAL.p*P/total*100);
  let pl=Math.round(MACRO_KCAL.l*L/total*100);
  let pg=100-pp-pl;
  // Deux arrondis vers le haut peuvent rendre la part des glucides négative
  // quand elle vaut zéro. On la ramène à zéro et on reprend l'écart sur la
  // plus grosse des deux autres : la somme reste 100, et la valeur corrigée
  // est celle qui supporte le mieux un point de moins.
  if(pg<0){
    const manque=-pg; pg=0;
    if(pp>=pl) pp-=manque; else pl-=manque;
  }
  return {p:pp,l:pl,c:pg,total:Math.round(total)};
}
// PURE. Le poids de référence : celui du DERNIER BILAN, comme partout ailleurs
// dans le produit. Rend null quand il n'y en a pas — et le mode g/kg devient
// alors indisponible, ce que l'écran dit.
