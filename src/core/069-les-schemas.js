// ══ LES SCHÉMAS (build 1963) ══════════════════════════════════════════════
// Le moteur vit dans app/rc-schemas.js, chargé à la demande comme le Motion
// Lab (chargerSchemas) : le même code dessine l'atlas livré dans
// app/img/schemas (scripts/generer_atlas.mjs) et le schéma PERSONNEL, avec
// les mesures de l'athlète (silhouetteDuDossier).
// Trois branchements :
//   la consigne d'un exercice   « le bon réglage pour toi » : la pose de son
//                               schéma (squat, charnière, développé, tirage),
//                               dessinée avec SES leviers ;
//   la lecture morpho (M2)      son schéma personnel, squat, soulevé, développé ;
//   les profils (M1, M3)        l'image de l'atlas qui explique chaque profil.
// Un emplacement se pose dans le HTML (.sch-perso, data-sch-pose) ; un seul
// observateur le peint quand il apparaît. Sans aucune mesure, rien n'est
// dessiné : un schéma « personnel » aux proportions moyennes mentirait.

let _schChargement=null;
function chargerSchemas(){
  if(window.RCSchemas) return Promise.resolve(window.RCSchemas);
  if(_schChargement) return _schChargement;
  _schChargement=new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='./rc-schemas.js?v='+encodeURIComponent(String(window.RC_BUILD||''));
    s.onload=()=>window.RCSchemas?res(window.RCSchemas):(_schChargement=null,rej(new Error('Schémas illisibles')));
    s.onerror=()=>{ _schChargement=null; s.remove(); rej(new Error('Les schémas n’ont pas pu se charger.')); };
    document.head.appendChild(s);
  });
  return _schChargement;
}
/**
 * PURE (sur le dossier). Les leviers de l'athlète, en centimètres, depuis ses
 * mesures morpho ; ce qui manque garde la proportion par défaut.
 *   fémur ≈ entrejambe − hauteur de genou + 4,5 % de la taille (la hanche est
 *   au-dessus de l'entrejambe) ; tibia ≈ hauteur de genou − 3,9 % (la cheville) ;
 *   humérus = bras − avant-bras quand les deux sont mesurés.
 * @returns {{params:object, mesures:string[]}}
 */
function silhouetteDuDossier(u){
  const m=k=>{ try{ const r=mesureMorpho(u,k); return r&&r.cm>0?r.cm:null; }catch(e){ return null; } };
  let t=null; try{ t=_tailleCm(u); }catch(e){ t=null; }
  const params={}, mesures=[];
  if(t>100&&t<250) params.taille=t;
  const H=params.taille||175;
  const ej=m('deb-entrejambe'), ge=m('deb-genou'), br=m('deb-bras'), ab=m('deb-avantbras');
  if(ej&&ge&&ej>ge){ params.femur=Math.round((ej-ge+0.045*H)*10)/10; mesures.push('deb-entrejambe'); }
  if(ge){ params.tibia=Math.round((ge-0.039*H)*10)/10; mesures.push('deb-genou'); }
  if(br&&ab&&br>ab){ params.bras=Math.round((br-ab)*10)/10; params.avantBras=ab; mesures.push('deb-bras','deb-avantbras'); }
  else if(ab){ params.avantBras=ab; mesures.push('deb-avantbras'); }
  for(const [k,c] of [['epaules','deb-epaules'],['bassin','deb-bassin'],['thorax','deb-thorax'],['pied','deb-pied']]){ const v=m(c); if(v){ params[k]=v; mesures.push(c); } }
  return {params,mesures};
}
// Le schéma d'exercice → la pose qui le montre.
const SCHEMA_POSE=Object.freeze({'squat':'squat','charniere-hanche':'souleve','poussee-horizontale':'developpe','tirage-vertical':'traction'});
// Les profils morpho → l'entrée de l'atlas qui les explique (P1 fémur, P2 tronc,
// P3 tibia, P4-P5 bras, P6-P7 charpente, P8 ossature, P11 épaule, P12 chaîne postérieure).
const PROFIL_ATLAS=Object.freeze({P1:'femur_squat',P2:'buste_court_long',P3:'squat_favorable',P4:'souleve_bras',P5:'tractions_humerus',
  P6:'developpe_cage_epaisse',P7:'developpe_cage_fine',P8:'envergure_taille',P11:'elevations_horizontale',P12:'souleve_bras'});
/** PURE. L'emplacement d'un schéma personnel (peint plus tard), ou '' sans mesure. */
function htmlSchemaPersonnel(u,pose,titre){
  if(!u||!pose) return '';
  const s=silhouetteDuDossier(u);
  if(!s.mesures.length) return '';
  return '<div class="sch-perso" data-sch-pose="'+escapeHtml(pose)+'" data-sch-titre="'+escapeHtml(titre||'')+'" data-sch-params="'+escapeHtml(JSON.stringify(s.params))+'" role="img" aria-label="'+escapeHtml(titre||'Ton schéma')+'"></div>';
}
/** PURE. Le « bon réglage pour toi » d'un exercice : son schéma personnel, ou ''. */
function htmlReglageSchema(u,ex){
  let sc=null; try{ sc=schemaDe(ex,u); }catch(e){ sc=null; }
  const pose=SCHEMA_POSE[sc];
  if(!pose) return '';
  const h=htmlSchemaPersonnel(u,pose,'Le bon réglage pour toi');
  return h?'<div class="sch-bloc"><div class="sch-t">Le bon réglage pour toi</div>'+h+'</div>':'';
}
/** PURE. Les images de l'atlas pour des profils actifs. */
function htmlAtlasProfils(cles){
  const vus=new Set(), out=[];
  for(const k of cles||[]){ const a=PROFIL_ATLAS[k]; if(a&&!vus.has(a)){ vus.add(a); out.push(a); } }
  return out.map(a=>'<img class="sch-atlas" src="./img/schemas/'+a+'.webp" alt="" loading="lazy" decoding="async" onerror="this.remove()">').join('');
}
/** Peint les emplacements .sch-perso pas encore peints. Rend le nombre peint. */
async function peindreSchemas(racine){
  const l=[...(racine||document).querySelectorAll('.sch-perso:not([data-peint])')];
  if(!l.length) return 0;
  let R=null; try{ R=await chargerSchemas(); }catch(e){ return 0; }
  let n=0;
  for(const z of l){
    z.setAttribute('data-peint','1');
    try{
      const p=JSON.parse(z.getAttribute('data-sch-params')||'{}');
      z.innerHTML=R.dessinerPersonnel(p,z.getAttribute('data-sch-pose'),{titre:z.getAttribute('data-sch-titre')||undefined,largeur:520,hauteur:360});
      n++;
    }catch(e){ z.remove(); }
  }
  return n;
}
// UN SEUL OBSERVATEUR : un emplacement qui apparaît (consigne, lecture morpho)
// se peint, sans que chaque rendu ait à y penser.
let _schObs=null;
function _schObserver(){
  if(_schObs||typeof MutationObserver==='undefined'||typeof document==='undefined'||!document.body) return;
  let t=null;
  _schObs=new MutationObserver(()=>{ if(t) return; t=setTimeout(()=>{ t=null; if(document.querySelector('.sch-perso:not([data-peint])')) peindreSchemas().catch(()=>{}); },120); });
  _schObs.observe(document.body,{childList:true,subtree:true});
}
try{ if(typeof document!=='undefined'){ if(document.body) _schObserver(); else document.addEventListener('DOMContentLoaded',_schObserver); } }catch(e){}
