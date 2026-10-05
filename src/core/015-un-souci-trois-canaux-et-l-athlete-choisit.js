// ══ « UN SOUCI ? » : TROIS CANAUX, ET L'ATHLETE CHOISIT ══════════════════
//
// Le lien unique retombait sur le mail des que le WhatsApp n'etait pas publie,
// sans jamais dire qu'un TROISIEME canal existait — le mot au coach, dans
// l'application, propose plus bas dans une carte separee. Les trois sont
// desormais au meme endroit, et cette carte a disparu avec.
//
// ⚠ LE CONSENTEMENT COMMANDE TOUJOURS. _canauxCoach porte la meme regle
// qu'avant : sans consentement horodate, aucun numero ne devient un lien. Un
// canal absent n'affiche AUCUN bouton — un bouton qui n'ouvre rien fait croire
// qu'on a ecrit.
function _rendreContactCoach(u,users){
  const z=document.getElementById('clh-contact');
  if(!z) return false;
  const uu=u||currentUser;
  if(!uu||!uu.coachId){ z.innerHTML=''; return false; }
  const c=_canauxCoach(uu.coachId,users);
  const bouts=[];
  if(c.whatsapp) bouts.push(['a','https://wa.me/'+c.whatsapp,'WhatsApp','wa']);
  if(c.mail) bouts.push(['a','mailto:'+c.mail,'E-mail','ml']);
  // LE MOT DANS L'APPLICATION est toujours disponible : il ne depend d'aucun
  // numero ni d'aucun consentement, et il reste chez soi.
  bouts.push(['b','motOuvrirDepuisContact()','Dans l\'app','ap']);
  if(!bouts.length){ z.innerHTML=''; return false; }
  // La mention de sortie et les horaires restent portees par l'info-bulle,
  // comme avant — voir la note de CONTACT_SORTIE.
  let titre='';
  try{ const _c=contactCoach(c.src);
    titre=CONTACT_SORTIE+(_c&&_c.horaires?' Réponses : '+_c.horaires:''); }catch(e){}
  // ⚠ LES TROIS CANAUX NE S'AFFICHENT PLUS SOUS LE LIEN. Poses a demeure, ils
  // occupaient une rangee de l'accueil pour une question qu'on se pose
  // rarement — « ca mange de la place pour rien ». Le lien redevient donc ce
  // qu'il etait, LEGER, et les trois portes s'ouvrent au clic.
  z.innerHTML='<button type="button" class="cct-lien" onclick="ouvrirContactCoach()" '
    +'title="'+escapeHtml(titre)+'">'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    +'stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">'
    +'<path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>'
    +'Un souci ? Contacte ton coach</button>';
  // Les canaux sont gardes pour l'ouverture de la feuille : les recalculer au
  // clic relirait le magasin pour rien, et surtout hors du contexte ou la
  // fonction a ete appelee.
  _contactBouts=bouts; _contactTitre=titre;
  return true;
}
// La feuille des canaux. Elle n'existe qu'au moment ou on la demande.
let _contactBouts=[], _contactTitre='';
function ouvrirContactCoach(){
  const z=document.getElementById('cct-corps');
  if(!z||!_contactBouts.length) return null;
  z.innerHTML=_contactBouts.map(b=>b[0]==='a'
    ?'<a class="cct-b" href="'+escapeHtml(b[1])+'" target="_blank" rel="noopener noreferrer" '
      +'onclick="_journaliserContactCoach();fermerContactCoach(true)" '
      +'title="'+escapeHtml(_contactTitre)+'">'+escapeHtml(b[2])+'</a>'
    :'<button type="button" class="cct-b" onclick="fermerContactCoach(true);'+b[1]+'">'
      +escapeHtml(b[2])+'</button>').join('');
  const f=_feuilleOuvrir('rc-contact');
  try{ const p=document.querySelector('#cct-corps .cct-b'); if(p) p.focus({preventScroll:true}); }catch(e){}
  return f;
}
function fermerContactCoach(tout_de_suite){ _feuilleFermer('rc-contact',tout_de_suite); }
// Le renvoi est journalise AU CLIC, pas a l'affichage : un bouton vu n'est pas
// un bouton touche. Le journal vit dans le dossier de l'ATHLETE — c'est le seul
// document qu'il peut ecrire.
function _journaliserContactCoach(){
  try{ journaliserRenvoi(currentUser,currentUser.id); saveUser(); }catch(e){ rcErreurMuette('_journaliserContactCoach',e); }
  return true;
}
// Ouvre l'editeur du mot au coach ET l'amene sous les yeux : il vit plus bas
// dans la page, et l'ouvrir sans y aller donnerait un bouton qui ne fait rien.
function motOuvrirDepuisContact(){
  motOuvrir();
  try{ _defiler(document.getElementById('clh-mot'),{block:'center'}); }catch(e){}
  return true;
}
function renderMotCoach(){
  const z=document.getElementById('clh-mot');
  if(!z) return false;
  // AUCUN COACH, AUCUN CHAMP : ecrire a personne n'a pas de sens, et la
  // promesse « ton coach le lit » serait fausse.
  if(!currentUser||!currentUser.coachId){ z.innerHTML=''; return true; }
  const m=motCoach(currentUser);
  const enc='background:var(--surface-1);border:1px solid var(--border);'
    +'border-radius:var(--r-3);padding:12px 14px;margin-bottom:16px';
  if(_motEdition){
    z.innerHTML='<div style="'+enc+'">'
      +'<div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);'
      +'text-transform:uppercase;margin-bottom:8px">À dire à ton coach</div>'
      +'<textarea id="mot-texte" rows="4" maxlength="'+MOT_COACH_MAX+'" '
      +'placeholder="Ce qui n’entre dans aucune case : une douleur, une semaine compliquée, '
      +'un truc qui te bloque, une bonne nouvelle." '
      +'style="width:100%;box-sizing:border-box;resize:vertical">'
      +escapeHtml(m?m.texte:'')+'</textarea>'
      +'<div style="display:flex;gap:6px;margin-top:8px">'
      +'<button class="btn btn-red btn-sm" style="flex:1;margin:0" onclick="motEnregistrer()">Enregistrer</button>'
      +'<button class="btn btn-outline btn-sm" style="flex:0 0 auto;margin:0" onclick="motAnnuler()">Annuler</button>'
      +'</div>'
      +'<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:8px">'
      +escapeHtml(MOT_COACH_MENTION)+'</div></div>';
    const t=document.getElementById('mot-texte'); if(t) t.focus();
    return true;
  }
  // ⚠ PLUS DE CARTE D'INVITATION QUAND IL N'Y A RIEN A DIRE. « Quelque chose
  // a dire a ton coach ? » occupait un cadre entier de l'accueil pour poser
  // une question a laquelle on repond rarement — et le meme geste est
  // desormais l'un des trois canaux de « Un souci ? », juste au-dessus.
  // L'emplacement reste : des qu'un mot est ECRIT, il s'affiche ici.
  if(!m){ z.innerHTML=''; return true; }
  z.innerHTML='<div style="'+enc+'">'
    +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px">'
    +'<span style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);'
    +'text-transform:uppercase">À dire à ton coach</span>'
    +(m.maj?'<span style="font-size:var(--fs-2xs);color:var(--text-faint)">'
      +new Date(m.maj).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})+'</span>':'')
    +'</div>'
    // pre-wrap : les retours a la ligne de l'athlete sont a lui.
    +'<div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6;white-space:pre-wrap">'
    +escapeHtml(m.texte)+'</div>'
    +'<button class="btn btn-outline btn-sm" style="width:100%;margin:10px 0 0" '
    +'onclick="motOuvrir()">Modifier</button></div>';
  return true;
}
function motOuvrir(){ _motEdition=true; renderMotCoach(); return true; }
function motAnnuler(){ _motEdition=false; renderMotCoach(); return true; }
function motEnregistrer(){
  const t=document.getElementById('mot-texte');
  const r=poserMotCoach(currentUser,t?t.value:'');
  if(!r.ok){ toast(r.raison,'var(--orange)'); return false; }
  _motEdition=false;
  renderMotCoach();
  toast(r.efface?'Mot effacé':'Ton coach le verra en ouvrant ton dossier');
  return true;
}
// ── LA SURFACE DU COACH ────────────────────────────────────────────────
//
// TEL QUEL, ET RIEN D'AUTRE : pas de resume, pas de mise en forme, pas
// d'etiquette deduite. Le seul traitement est l'echappement.
function renderMotCoachFiche(c){
  const z=document.getElementById('ccd-mot');
  if(!z) return false;
  const m=motCoach(c);
  if(!m){
    z.innerHTML='<div class="sub" style="font-size:var(--fs-xs);line-height:1.6">'
      +'Rien d’écrit. Ce champ est le sien : il y met ce qui n’entre dans aucune case.</div>';
    return true;
  }
  const neuf=(()=>{ try{ return motCoachNouveau(currentUser,c); }catch(e){ return false; } })();
  z.innerHTML='<div style="background:var(--surface-1);border:1px solid var(--border);'
    +'border-radius:var(--r-3);padding:12px 14px">'
    +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px">'
    +(neuf?'<span style="font-size:var(--fs-2xs);font-weight:800;letter-spacing:1px;'
      +'color:var(--red-text);text-transform:uppercase">Nouveau</span>':'<span></span>')
    +(m.maj?'<span style="font-size:var(--fs-2xs);color:var(--text-faint)">'
      +new Date(m.maj).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'})
      +'</span>':'')
    +'</div>'
    +'<div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6;white-space:pre-wrap">'
    +escapeHtml(m.texte)+'</div></div>';
  // LU AU MOMENT OU C'EST AFFICHE, et une seule ecriture : marquerMotCoachLu
  // sort de lui-meme quand le marqueur est deja a jour.
  try{ marquerMotCoachLu(currentUser,c); }catch(e){}
  return true;
}
// Un fil de notes horodatées par athlète. Il vit dans le document DU COACH,
// jamais dans celui de l'athlète, et ce choix n'est pas une commodité : c'est
// ce qui rend la note inaccessible à l'athlète MÊME s'il interroge la base
// directement.
//
// POURQUOI AUCUNE RÈGLE RTDB NOUVELLE N'EST NÉCESSAIRE POUR LA CONFIDENTIALITÉ.
// La règle de /users/$emailKey n'ouvre la lecture qu'au propriétaire et au
// coach DE ce document — celui que désigne son champ coachEmailKey. Un athlète
// n'est jamais le coach de son coach : le dossier du coach lui est fermé par
// construction. Une règle a tout de même été ajoutée, mais pour BORNER le
// champ, pas pour le protéger : chaque saveUser est un PUT du document entier,
// et un texte libre non borné dans un document réécrit à chaque sauvegarde
// finit par déborder le quota.
//
// CE QUI RESTE VRAI ET QU'IL FAUT SAVOIR : si le dossier d'un coach portait un
// jour coachEmailKey — un coach qui serait lui-même l'athlète d'un autre —
// cet autre coach lirait le dossier entier, notes comprises. Aucun écran ne
// pose ce champ sur un coach aujourd'hui.
//
// CONSÉQUENCE GRATUITE : urgencyScore reçoit le dossier de L'ATHLÈTE. Une note
// ne peut pas entrer dans le score d'urgence, même par accident.
const NOTE_TAGS=Object.freeze(['blessure','materiel','perso','methode']);
const NOTE_TAG_LIB=Object.freeze({blessure:'Blessure',materiel:'Matériel',
  perso:'Perso',methode:'Méthode'});
const NOTE_TEXTE_MAX=600;
const NOTE_MAX_PAR_ATHLETE=200;
const NOTE_APERCU=3;
// Affichée AU MOMENT de la saisie, pas dans une politique qu'il faudrait aller
// chercher. RepCore ne peut pas automatiser la communication de cette note :
// l'export de l'athlète lit SON dossier, et la note n'y est pas. C'est donc une
// obligation manuelle du coach, et elle est écrite comme telle.
const NOTE_MENTION='Note privée : elle reste dans ton dossier et l\'athlète ne '
  +'la voit nulle part dans l\'application. Mais elle porte sur lui , elle lui '
  +'est donc communicable s\'il exerce son droit d\'accès, et RepCore ne peut '
  +'pas le faire à ta place. Écris ce que tu assumerais de lui montrer.';
// PURE. Le fil d'un athlète, quel que soit l'état du champ. Une entrée sans
// identifiant ou sans date est écartée : elle ne serait ni supprimable ni
// triable.
function _notesFil(coachNotes,athleteId){
  if(!coachNotes||typeof coachNotes!=='object'||Array.isArray(coachNotes)) return [];
  const l=coachNotes[athleteId];
  if(!Array.isArray(l)) return [];
  return l.filter(n=>n&&typeof n==='object'&&n.id&&isFinite(Number(n.at)));
}
// PURE. Copie de surface du dictionnaire, fils clonés : c'est ce qui permet aux
// deux fonctions d'écriture de ne jamais toucher leur entrée.
function _notesCopie(notes){
  const out={};
  if(notes&&typeof notes==='object'&&!Array.isArray(notes))
    for(const k in notes) out[k]=Array.isArray(notes[k])?notes[k].slice():notes[k];
  return out;
}
// PURE. Deux notes écrites dans la même milliseconde ne doivent pas partager
// un identifiant : la suppression unitaire en effacerait deux.
function _noteId(fil,at){
  const base='n'+at;
  if(!fil.some(n=>n.id===base)) return base;
  for(let i=2;i<9999;i++){ const c=base+'-'+i; if(!fil.some(n=>n.id===c)) return c; }
  return base+'-'+fil.length;
}
// PURE, NE MUTE RIEN. Rend {ok:true,notes,note} ou {ok:false,raison}.
// N6.13 — PURE. Une echeance lisible, ou rien. On accepte une date ISO ou un
// horodatage, on refuse tout le reste : une echeance illisible qui deviendrait
// NaN ferait remonter la note tous les jours, pour toujours.
const NOTE_ECHEANCE_MAX_JOURS=365;
function _noteEcheanceValide(v){
  if(v==null||v==='') return null;
  let t=null;
  if(typeof v==='number'&&isFinite(v)) t=v;
  else{
    const s=String(v).trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d=new Date(s+'T12:00:00');
    if(isNaN(d.getTime())) return null;
    t=d.getTime();
  }
  // Bornee : une echeance a trois ans n'est pas un rappel, c'est un oubli.
  const max=Date.now()+NOTE_ECHEANCE_MAX_JOURS*864e5;
  if(t>max) return null;
  return t;
}
// PURE. Les notes dont l'echeance est atteinte, pour un athlete.
function notesEchues(coachNotes,athleteId,maintenant){
  const t=isFinite(Number(maintenant))?Number(maintenant):Date.now();
  return _notesFil(coachNotes,athleteId).filter(n=>n&&n.echeance&&n.echeance<=t);
}
function noteAjouter(notes,athleteId,texte,tag,now,echeance){
  const id=String(athleteId||'');
  if(!id) return {ok:false,raison:'Aucun athlète sélectionné.'};
  // Un élève créé par code n'a pas encore de dossier : son identifiant est
  // provisoire (_code_…) et changera à son inscription. Une note posée dessus
  // serait orpheline le jour où il s'inscrit — on la refuse plutôt que de la
  // perdre en silence.
  if(id.indexOf('_code_')===0)
    return {ok:false,raison:'Cet élève n\'a pas encore de dossier : la note serait perdue à son inscription.'};
  const t=String(texte||'').trim().slice(0,NOTE_TEXTE_MAX);
  if(!t) return {ok:false,raison:'Écris quelque chose.'};
  const fil=_notesFil(notes,id);
  if(fil.length>=NOTE_MAX_PAR_ATHLETE)
    return {ok:false,raison:'Ce fil est plein ('+NOTE_MAX_PAR_ATHLETE+' notes). Supprime avant d\'ajouter.'};
  const at=isFinite(Number(now))?Number(now):Date.now();
  // N6.13 — L'ECHEANCE EST OPTIONNELLE, et absente veut dire absente : une
  // note sans « a revoir le … » ne remonte nulle part, comme avant.
  const note={id:_noteId(fil,at),at,texte:t,tag:NOTE_TAGS.indexOf(tag)>=0?tag:null};
  const _ech=_noteEcheanceValide(echeance);
  if(_ech) note.echeance=_ech;
  const sortie=_notesCopie(notes);
  sortie[id]=[note].concat(fil);
  return {ok:true,notes:sortie,note};
}
// PURE, NE MUTE RIEN. Suppression DÉFINITIVE : pas de corbeille, pas de
// marqueur de suppression. Un fil vidé disparaît du dictionnaire plutôt que
// d'y laisser un tableau vide que chaque PUT réécrirait.
function noteSupprimer(notes,athleteId,noteId){
  const id=String(athleteId||'');
  const fil=_notesFil(notes,id);
  if(!fil.some(n=>n.id===noteId)) return {ok:false,raison:'Note introuvable.'};
  const sortie=_notesCopie(notes);
  const reste=fil.filter(n=>n.id!==noteId);
  if(reste.length) sortie[id]=reste; else delete sortie[id];
  return {ok:true,notes:sortie};
}
// PURE. Plein texte sur TOUS les fils, via norm — insensible aux accents et à
// la casse. Tous les mots doivent être présents : un ET, pas un OU, sinon deux
// mots élargissent au lieu de resserrer. Trié du plus récent au plus ancien.
function notesRecherche(coachNotes,requete){
  const out=[];
  if(!coachNotes||typeof coachNotes!=='object'||Array.isArray(coachNotes)) return out;
  const mots=norm(requete).split(/\s+/).filter(Boolean);
  for(const id of Object.keys(coachNotes)){
    for(const n of _notesFil(coachNotes,id)){
      if(mots.length){
        const c=norm(n.texte)+' '+norm(NOTE_TAG_LIB[n.tag]||n.tag||'');
        if(!mots.every(m=>c.indexOf(m)>=0)) continue;
      }
      out.push({athleteId:id,note:n});
    }
  }
  return out.sort((a,b)=>b.note.at-a.note.at);
}
// PURE. Les n dernières notes d'un fil, la plus récente en tête.
function notesDernieres(coachNotes,athleteId,n){
  const k=(isFinite(Number(n))&&Number(n)>0)?Math.round(Number(n)):NOTE_APERCU;
  return _notesFil(coachNotes,athleteId).slice().sort((a,b)=>b.at-a.at).slice(0,k);
}

// ── Le bloc en fiche client ────────────────────────────────────────────────
let _jrQ='', _jrTout=false;
function _jrDate(at){
  try{ return new Date(at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'2-digit'}); }
  catch(e){ return ''; }
}
// Le prénom derrière un identifiant, pour la recherche transversale. Sans
// getOwnedClient : celui-ci affiche un toast quand il ne trouve pas, et une
// recherche sur douze fils en produirait douze.
function _jrNom(id){
  const u=Object.values(DB.get('users')||{}).find(x=>x&&x.id===id);
  if(!u) return 'Athlète retiré';
  return ((u.fname||'')+' '+(u.lname||'')).trim()||u.email||'Sans nom';
}
function _jrHtmlNote(n,nom){
  return '<div style="border-left:2px solid var(--border);padding:0 0 0 10px;margin-bottom:10px">'
    +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">'
    +'<span style="font-size:var(--fs-2xs);color:var(--text-faint);letter-spacing:.5px">'
    +escapeHtml(_jrDate(n.at))+(nom?' · '+escapeHtml(nom):'')
    +(n.tag?' · <span style="color:var(--sub)">'+escapeHtml(NOTE_TAG_LIB[n.tag]||n.tag)+'</span>':'')
    +'</span>'
    +'<button class="hit44" onclick="jrSupprimer('+JSON.stringify(n.id).replace(/"/g,'&quot;')+')"'
    +' aria-label="Supprimer cette note" style="background:none;border:none;color:var(--text-faint);'
    +'font-size:var(--fs-lg);line-height:1;cursor:pointer;min-width:44px;min-height:44px;margin:-12px -10px -12px 0;'
    +'flex-shrink:0">×</button></div>'
    +'<div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.6;white-space:pre-wrap;word-break:break-word">'
    +escapeHtml(n.texte)+'</div></div>';
}
/**
 * L'HISTORIQUE DU TUNNEL, dans le profil de la personne. Une frise : chaque
 * relance garde son rang, son canal, sa date, son heure et sa note.
 *
 * ⚠ RIEN N'EST JAMAIS ECRASE. `tunnelValider` ajoute au tableau, il ne le
 *   remplace pas, et replanifier n'y touche pas du tout — l'historique est
 *   reserve a ce qui a ete TENTE, pas a ce qui a ete prevu.
 * @param {string} codeId
 * @returns {string}
 */
function _tunnelHistorique(codeId){
  const c=_tunnelCode(codeId);
  if(!c) return '';
  const k=tunnelCrm(c);
  const n=k.relances.length;
  const s=TUNNEL_LIB[tunnelStatut(n)];
  const dt=t=>{ if(!t) return '-'; const q=new Date(t), p=x=>String(x).padStart(2,'0');
    return p(q.getDate())+'/'+p(q.getMonth()+1)+'/'+q.getFullYear()+' à '+p(q.getHours())+':'+p(q.getMinutes()); };
  const canal=cl=>{ const x=TUNNEL_CANAUX.find(y=>y.cle===cl); return x?x.lib:(cl||'-'); };
  const ligne=(quand,titre,corps)=>'<div style="display:flex;gap:10px;padding:8px 0;border-top:1px solid var(--border)">'
    +'<span style="flex:0 0 106px;font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5">'+escapeHtml(quand)+'</span>'
    +'<span style="flex:1;min-width:0"><span style="display:block;font-size:var(--fs-xs);font-weight:800;color:var(--text-strong)">'+titre+'</span>'
    +(corps?'<span style="display:block;font-size:var(--fs-2xs);color:var(--sub);line-height:1.55;margin-top:2px">'+corps+'</span>':'')
    +'</span></div>';
  let frise=ligne(dt(c.createdAt),'Ajouté au tunnel','Code d’accès créé.');
  k.relances.forEach(r=>{
    frise+=ligne(dt(r.date),'Relance #'+(r.n||'?')+' · '+escapeHtml(canal(r.canal)),
      (r.note?escapeHtml(String(r.note)):'<i style="color:var(--text-faint)">Sans note</i>'));
  });
  if(k.termineLe) frise+=ligne(dt(k.termineLe),'Fin du tunnel',
    c.active===false?'Accès désactivé : tunnel terminé.'
                    :'Quatre relances atteintes. L’accès n’a PAS pu être désactivé : ferme le code à la main.');
  const ech=(n<TUNNEL_MAX&&k.prochaine)
    ?'<div style="font-size:var(--fs-2xs);color:var(--sub);margin-top:8px">Prochaine relance : <b style="color:var(--text-strong)">'+dt(k.prochaine)+'</b></div>'
    :'';
  return '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-top:12px">'
    +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:4px">'
    +'<span style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase">Historique du tunnel commercial</span>'
    +'<span style="flex:none;font-size:var(--fs-2xs);font-weight:800;letter-spacing:1px;text-transform:uppercase;'
    +'color:'+s.c+';border:1px solid '+s.c+';border-radius:var(--r-4);padding:2px 8px">'+escapeHtml(s.lib)+' · '+n+'/'+TUNNEL_MAX+'</span>'
    +'</div>'+frise+ech
    +(n<TUNNEL_MAX
      ?'<div style="display:flex;gap:6px;margin-top:12px">'
       +'<button type="button" class="btn btn-red btn-sm" style="flex:1;margin:0;min-height:38px;font-size:var(--fs-2xs)" onclick="tunnelRelancer(\''+escapeHtml(codeId)+'\')">Relancer</button>'
       +'<button type="button" class="btn btn-blanc btn-sm" style="flex:1;margin:0;min-height:38px;font-size:var(--fs-2xs)" onclick="tunnelPlanifier(\''+escapeHtml(codeId)+'\')">'
       +(k.prochaine?'Replanifier':'Planifier')+'</button></div>'
      :'')
    +'</div>';
}
function renderJournalCoach(c){
  const z=document.getElementById('ccd-journal');
  if(!z) return false;
  if(!currentUser||currentUser.role!=='coach'){ z.innerHTML=''; return false; }
  const cn=currentUser.coachNotes;
  const id=(c&&c.id)||'';
  const surCode=String(id).indexOf('_code_')===0;
  let corps;
  if(_jrQ){
    // Recherche transversale : tous les fils, pas seulement celui-ci.
    const res=notesRecherche(cn,_jrQ);
    corps=res.length
      ?res.map(o=>_jrHtmlNote(o.note,_jrNom(o.athleteId))).join('')
      :'<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;padding:4px 0 8px">'
       +'Aucune note ne contient ça. Efface la recherche pour revoir ce fil.</div>';
  }else{
    const fil=_notesFil(cn,id);
    const vues=_jrTout?fil.slice().sort((a,b)=>b.at-a.at):notesDernieres(cn,id,NOTE_APERCU);
    corps=fil.length
      ?vues.map(n=>_jrHtmlNote(n,null)).join('')
        +(fil.length>vues.length||_jrTout
          ?'<button onclick="jrBasculerTout()" style="background:none;border:none;color:var(--link);'
           +'font-family:inherit;font-size:var(--fs-xs);text-decoration:underline;cursor:pointer;padding:2px 0;'
           +'min-height:34px">'+(_jrTout?'réduire':'tout voir ('+fil.length+')')+'</button>'
          :'')
      :'<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;padding:4px 0 8px">'
       +'Aucune note. Ce fil ne sert qu\'à toi : ce qu\'il a dit, ce qui a coincé, '
       +'ce qu\'il faudra reprendre.</div>';
  }
  const opts=NOTE_TAGS.map(t=>'<option value="'+t+'">'+escapeHtml(NOTE_TAG_LIB[t])+'</option>').join('');
  z.innerHTML='<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px">'
    +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:10px">'
    // N1.16 — « Journal » tout court se confondait avec le JOURNAL
    // ALIMENTAIRE de l'athlete, une section plus haut dans un autre onglet.
    // Le carnet du coach porte ses notes ; il n'a rien a voir avec ce que
    // l'athlete a mange.
    +'<span style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase">Mes notes</span>'
    +'</div>'
    +'<input id="jr-q" type="search" inputmode="search" placeholder="Chercher dans tous tes fils"'
    +' value="'+escapeHtml(_jrQ)+'" oninput="jrChercher()" style="width:100%;margin-bottom:10px">'
    +corps
    +(surCode
      ?'<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6;border-top:1px solid var(--border);padding-top:10px;margin-top:4px">'
       +'Cet élève n\'a pas encore de dossier : le journal s\'ouvrira à son inscription.</div>'
      :'<div style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px">'
       +'<textarea id="jr-texte" rows="2" maxlength="'+NOTE_TEXTE_MAX+'" placeholder="Ce que tu veux retrouver la prochaine fois"'
       +' style="width:100%;resize:vertical"></textarea>'
       +'<div style="display:flex;gap:6px;margin-top:8px">'
       +'<select id="jr-tag" style="flex:1;min-width:0"><option value="">Sans étiquette</option>'+opts+'</select>'
       // N6.13 — L'ECHEANCE. Vide par defaut : une note est d'abord une note,
       // et la plupart n'ont rien a rappeler.
       +'<input type="date" id="jr-echeance" title="À revoir le… (facultatif)"'
       +' style="flex:1;min-width:0"'+'>'
       +'<button class="btn btn-outline btn-sm" style="flex:0 0 auto;margin:0;letter-spacing:.5px;font-size:var(--fs-2xs)" onclick="jrAjouter()">Enregistrer</button>'
       +'</div>'
       +'<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6;margin-top:8px">'+escapeHtml(NOTE_MENTION)+'</div>'
       +'</div>')
    +'</div>'
    // L'HISTORIQUE COMMERCIAL NE CONCERNE QUE CEUX QUI N'ONT PAS DE DOSSIER :
    // un athlete inscrit est sorti du tunnel, et lui poser une frise de
    // relances commerciales sous ses notes n'aurait aucun sens.
    +(surCode?_tunnelHistorique(String(id).replace('_code_','')):'');
  return true;
}
function _jrRafraichir(){
  try{ renderJournalCoach(getOwnedClient(currentClientId)); }catch(e){}
}
function jrChercher(){
  const e=document.getElementById('jr-q');
  _jrQ=e?e.value:'';
  _jrTout=false;
  _jrRafraichir();
  // Le champ est reconstruit par le rendu : on lui rend le curseur, sinon on
  // ne peut pas taper deux lettres de suite.
  const n=document.getElementById('jr-q');
  if(n){ n.focus(); try{ n.setSelectionRange(n.value.length,n.value.length); }catch(e2){} }
  return true;
}
function jrBasculerTout(){ _jrTout=!_jrTout; _jrRafraichir(); return true; }
function jrAjouter(){
  const c=getOwnedClient(currentClientId);
  if(!c) return false;
  const t=(document.getElementById('jr-texte')||{}).value||'';
  const tag=(document.getElementById('jr-tag')||{}).value||null;
  const ech=(document.getElementById('jr-echeance')||{}).value||null;
  const r=noteAjouter(currentUser.coachNotes,c.id,t,tag,Date.now(),ech);
  if(!r.ok){ toast(r.raison,'var(--orange)'); return false; }
  currentUser.coachNotes=r.notes;
  // saveUser rend faux quand localStorage déborde : la note serait alors dans
  // le cloud et pas sur l'appareil. On ne montre pas un « ✓ » dans ce cas.
  const ok=saveUser();
  _jrQ=''; _jrTout=false;
  _jrRafraichir();
  toastEcriture(ok,'Noté','la note est');
  return true;
}
async function jrSupprimer(noteId){
  const c=getOwnedClient(currentClientId);
  if(!c) return false;
  // « Pas de corbeille » est une règle de STOCKAGE, pas une raison de détruire
  // sans avertir. Rien ici ne se récupère.
  if(!await rcConfirm('Supprimer cette note ? Elle ne sera pas récupérable.',null,'Supprimer')) return false;
  // La recherche est transversale : la note à supprimer n'appartient pas
  // forcément au fil affiché.
  let cible=c.id;
  if(!_notesFil(currentUser.coachNotes,cible).some(n=>n.id===noteId)){
    const trouve=notesRecherche(currentUser.coachNotes,'').find(o=>o.note.id===noteId);
    if(!trouve) return false;
    cible=trouve.athleteId;
  }
  const r=noteSupprimer(currentUser.coachNotes,cible,noteId);
  if(!r.ok){ toast(r.raison,'var(--orange)'); return false; }
  currentUser.coachNotes=r.notes;
  const ok=saveUser();
  _jrRafraichir();
  toastEcriture(ok,'Note supprimée','la suppression est');
  return true;
}

function getOwnedClient(cid,users){
  if(!currentUser) return null;
  if(cid?.startsWith('_code_')){
    const codeId=cid.replace('_code_','');
    const code=(currentUser.studentCodes||[]).find(x=>x.codeId===codeId);
    if(!code){toast('Élève introuvable ou non autorisé','var(--orange)');return null;}
    return {id:cid,fname:code.studentName.split(' ')[0],lname:code.studentName.split(' ').slice(1).join(' '),role:'athlete',status:'COACHING_SUIVI',sessions:[],bilans:[],streak:0,_fromCode:true,_codeInfo:code};
  }
  const all=users||(DB.get('users')||{});
  const c=Object.values(all).find(u=>u.id===cid);
  // N3.8 — LE MEME PREDICAT QUE LA LISTE, ET UN SEUL.
  // Deux predicats d'appartenance coexistaient et ne disaient pas la meme
  // chose : _estMonAthlete accepte le rattachement par coachId OU par
  // coachEmailKey, et peuple le tableau de bord ; celui-ci n'acceptait que
  // coachId, et gardait les soixante-neuf points d'ecriture de la fiche.
  // Un eleve rattache par code depuis son propre telephone etait donc
  // liste, synchronise, affiche — et refuse a la moindre action, avec un
  // « Eleve introuvable ou non autorise » que rien n'expliquait.
  // L'ACCES N'EST PAS ELARGI : la regle .write de /users/$emailKey autorise
  // deja exactement ces deux rattachements, coachEmailKey compris. C'est le
  // client qui etait plus restrictif que le serveur, pas l'inverse.
  if(!c||!_estMonAthlete(c,currentUser)){toast('Élève introuvable ou non autorisé','var(--orange)');return null;}
  return c;
}
// LA NAVIGATION PAR ANCRES DE LA FICHE ATHLETE. Trois choses : le saut lui-meme
// (par _defiler, qui respecte la preference systeme la ou scrollIntoView ne le
// fait pas), la marque d'arrivee sur le titre de la section atteinte, et la
// puce qui s'allume — .pf-chip.active existait et n'etait posee nulle part.
// ══════ REPLIER UNE SECTION DE LA FICHE ═══════════════════════════════════
// « C'est pas du tout pratique et utilisable », Kevin, 25/08/2026. Les onglets
// rangeaient, mais chaque onglet restait un rouleau de sections toutes
// deployees : l'onglet Données en aligne onze.
//
// REPLIEES, ELLES FONT UN SOMMAIRE. C'est la différence entre une fiche qu'on
// parcourt et une fiche qu'on subit.
//
// L'ETAT EST RETENU PAR SECTION, PAS PAR ATHLETE : un coach qui replie
// « Prises » ne veut pas la revoir chez le suivant non plus. Un seul objet dans
// le stockage local, une clef par section.
const CCD_REPLI_CLE='rc_ccd_replis';
// Repliees a la premiere ouverture : tout l'onglet Données, qui est le
// fourre-tout, plus les trois blocs de reference qu'on ne consulte pas chaque
// jour. Le reste s'ouvre — l'entrainement et la nutrition sont ce qu'on vient
// voir.
// ⚠ QUATRE SECTIONS ONT QUITTE CETTE LISTE le 23/09/2026 : 'ccd-bilans',
//   'ccd-poids', 'ccd-pp' et 'ccd-photos-progression'. Kevin : « ces quatre
//   sections contiennent le plus d'information et elles s'ouvrent fermees :
//   c'est la raison numero un pour laquelle le coach croit que l'app ne sait
//   rien faire ». Elles s'ouvrent deployees, et c'est desormais l'ETAGE du
//   detail qui se replie d'un bloc — 'ccd-detail', ci-dessous.
const CCD_REPLI_DEFAUT=['ccd-journal','ccd-detail',
  'ccd-dossier','ccd-reds','ccd-securite',
  'ccd-suspension','ccd-sessions-recap','ccd-rite',
  // ⚠ 'ccd-prises' A QUITTE CETTE LISTE le 08/09/2026 avec la section
  // « Proteines par prise ». Une clef qui ne designe plus rien ne casse rien,
  // et c'est le probleme : elle survit indefiniment, et le prochain lecteur la
  // croit vivante.
  // ET LE CALENDRIER DU JOURNAL S OUVRE REPLIE. Kevin, 08/09/2026 : « le
  // journal alimentaire, honnetement, moi il ne m'interesse pas ». Il est au
  // fond de l'onglet, et il ne se deploie que si on va le chercher.
  // ⚠ 'ccd-cal' RETIRE le 23/09/2026 (build 1412) : le journal est devenu une
  //   section FIXE, comme « Calculs alimentaires ». Un etat de repli retenu
  //   pour une section qui ne se replie plus n'aurait plus aucun effet.
  // LES REGLAGES DE NUTRITION S OUVRENT REPLIES. Le coach vient d abord LIRE
  // ce qui est CONSTATE — le type de diete, la phase, le taux de respect et
  // les cibles en cours, tous en tete d onglet — et ne regle qu ensuite. C est
  // aussi ce qui ramene l onglet Nutrition a une hauteur du meme ordre que les
  // trois autres : il portait la moitie du volume rendu du dossier.
  'ccd-nut-reglages','ccd-nut-strict','ccd-supplements','ccd-traitements','ccd-caffeine'];
function _ccdReplis(){
  try{ const o=JSON.parse(localStorage.getItem(CCD_REPLI_CLE)||'null');
    return (o&&typeof o==='object')?o:null; }catch(e){ return null; }
}
function _ccdPoserRepli(id,replie){
  try{
    const o=_ccdReplis()||{};
    o[id]=!!replie;
    localStorage.setItem(CCD_REPLI_CLE,JSON.stringify(o));
  }catch(e){}
}
// Applique l'etat retenu a toutes les sections rendues. Appelee a chaque
// ouverture de fiche : les sections sont les memes elements d'un athlete a
// l'autre, mais leur visibilite change, et une section masquee puis remontree
// doit retrouver son etat.
function ccdAppliquerReplis(){
  // R10 — les ⓘ des sections, peints une fois : ils sont statiques.
  try{ document.querySelectorAll('#s-coach-client .cc-sect-i[data-lex]').forEach(z=>{
    if(!z.firstChild) z.innerHTML=rcInfo(z.getAttribute('data-lex')); }); }catch(e){}
  try{
    const memo=_ccdReplis();
    document.querySelectorAll('#s-coach-client .cc-sect').forEach(s=>{
      const c=s.querySelector(':scope>.cc-sect-c');
      const id=c&&c.id; if(!id) return;
      // UNE SECTION FIXE ne se replie jamais, et son titre n'est pas un bouton.
      if(s.classList.contains('cc-sect-fixe')){
        s.classList.remove('replie');
        const t0=s.querySelector(':scope>.cc-sect-t');
        if(t0){ t0.removeAttribute('role'); t0.removeAttribute('tabindex'); t0.removeAttribute('aria-expanded'); }
        return;
      }
      const r=memo&&Object.prototype.hasOwnProperty.call(memo,id)
        ? !!memo[id]
        : CCD_REPLI_DEFAUT.indexOf(id)>=0;
      s.classList.toggle('replie',r);
      const t=s.querySelector(':scope>.cc-sect-t');
      if(t){
        // Le titre EST le bouton : viser un chevron de 12 px au pouce ne marche
        // pas. aria-expanded dit l'etat a qui n'a pas le chevron sous les yeux.
        t.setAttribute('role','button');
        t.setAttribute('tabindex','0');
        t.setAttribute('aria-expanded',String(!r));
      }
    });
  }catch(e){}
}
function ccdReplier(id){
  const c=document.getElementById(id);
  const s=c&&c.closest('.cc-sect');
  if(!s) return false;
  const r=!s.classList.contains('replie');
  s.classList.toggle('replie',r);
  const t=s.querySelector(':scope>.cc-sect-t');
  if(t) t.setAttribute('aria-expanded',String(!r));
  _ccdPoserRepli(id,r);
  return r;
}
// UN SEUL ECOUTEUR, DELEGUE, ARME UNE FOIS. Poser un onclick sur chacun des
// vingt-sept titres aurait demande de le reposer a chaque rendu — et un rendu
// oublie aurait laisse une section qui ne repond plus.
function _ccdArmerReplis(){
  if(window._ccdReplisArmes) return;
  const e=document.getElementById('s-coach-client');
  if(!e) return;
  window._ccdReplisArmes=true;
  const bascule=ev=>{
    const t=ev.target&&ev.target.closest&&ev.target.closest('.cc-sect-t');
    if(!t||!e.contains(t)) return;
    if(t.parentElement&&t.parentElement.classList.contains('cc-sect-fixe')) return;
    const c=t.parentElement&&t.parentElement.querySelector(':scope>.cc-sect-c');
    if(!c||!c.id) return;
    ev.preventDefault();
    ccdReplier(c.id);
  };
  e.addEventListener('click',bascule);
  e.addEventListener('keydown',ev=>{
    if(ev.key!=='Enter'&&ev.key!==' ') return;
    bascule(ev);
  });
}

// ══════ LES QUATRE ONGLETS DE LA FICHE ATHLÈTE ════════════════════════════
// Demande de Kevin, 25/08/2026 : ranger la fiche avec un onglet entraînement /
// programme, un nutrition, un lifestyle et un données complémentaires.
//
// La barre était une barre d'ANCRES : cinq puces qui faisaient défiler vers une
// section perdue dans un rouleau de vingt-sept. On lisait le dossier d'un bout
// à l'autre, ou on ne le lisait pas.
//
// CE QUI RESTE HORS ONGLETS : l'identité, les compteurs, les contre-indications,
// les alertes, le contact et les trois actions. Enterrer une contre-indication
// derrière un onglet reviendrait à demander au coach de se souvenir qu'elle
// existe — c'est exactement ce que le commentaire de ce bloc refuse depuis son
// écriture.
const CCD_VUES=['entrainement','nutrition','lifestyle','donnees'];
// Les sections qui portent un signal de sécurité, et l'onglet qui les contient.
// UN ONGLET FERMÉ NE DOIT JAMAIS CACHER UN SIGNAL : la puce s'allume quand l'une
// d'elles a quelque chose à dire. Sans ça, ranger la fiche l'aurait rendue moins
// sûre qu'un long rouleau.
// ⚠ 'ccd-douleur' A CHANGE D'ONGLET le 23/09/2026 : la douleur est descendue
//   dans l'etage « Ce qui appelle un oeil » de l'onglet Donnees, avec les
//   autres signaux. La pastille la suit — sinon elle se serait allumee sur un
//   onglet qui ne la contient plus, et se serait tue sur celui qui la porte.
const CCD_ALERTES={entrainement:['ccd-douleur'],
  donnees:['ccd-douleur','ccd-reds','ccd-securite','ccd-suspension']};
// LES SIX ETAGES DE L'ONGLET DONNEES, dans l'ordre ou ils se lisent. La barre
// d'ancres en rend un bouton chacun, et seul le dernier s'ouvre replie.
const CCD_ETAGES=['verdict','corps','courbes','longueurs','signaux','detail'];
let _ccdVue='entrainement';
// C'EST LE DOCUMENT QUI DEFILE, PAS .scroll-area. Celle-ci ne deborde jamais :
// .screen est en min-height sans height, et .scroll-area en flex:1 — le
// commentaire de go() l'explique deja en detail, celui de s-protocoles le
// redit. Deux consequences, corrigees ici :
//   • ccdVue posait scrollTop=0 sur un element qui vaut deja zero : le coach
//     qui basculait d'onglet a 2 000 px de haut restait a 2 000 px, au milieu
//     d'un autre contenu ;
//   • l'ecouteur de defilement etait pose sur ce meme element, qui n'emet
//     jamais l'evenement : #ccd-ancres[data-serre] ne se declenchait jamais.
//
// REMONTEE INSTANTANEE. html porte scroll-behavior:smooth : un defilement
// anime de deux mille pixels au changement d'onglet serait pire que le defaut.
// On neutralise le comportement le temps du saut plutot que de passer
// behavior:'instant', que les navigateurs anciens ignorent silencieusement —
// ils feraient alors le defilement anime qu'on cherche a eviter.
function _ccdRemonter(){
  try{
    const h=document.documentElement;
    const av=h.style.scrollBehavior;
    h.style.scrollBehavior='auto';
    window.scrollTo(0,0);
    h.style.scrollBehavior=av;
  }catch(e){ try{ window.scrollTo(0,0); }catch(err){} }
}
// LA BARRE D'ONGLETS SE CALE SOUS LA TOPBAR, QUELLE QUE SOIT SA HAUTEUR.
// Elle etait collee a top:52px — un chiffre herite d'un commentaire qui decrit
// une topbar disparue. La vraie mesure 73 px : 14 de marge, un bouton retour de
// 44 au minimum, 14 de marge et 1 de bordure. La topbar portant z-index:6
// contre 5, les vingt et un pixels superieurs des puces passaient dessous des
// que la page defilait, et les libelles etaient rognes.
//
// AUCUNE VALEUR EN DUR : la hauteur est MESUREE, et un ResizeObserver la
// reprend si elle change — changer le bouton retour, la police du titre ou le
// padding ne redemandera pas de corriger un chiffre ici.
function _ccdCalerAncres(){
  try{
    const e=document.getElementById('s-coach-client');
    const tb=e&&e.querySelector(':scope>.topbar');
    const nav=document.getElementById('ccd-ancres');
    if(!tb||!nav) return;
    // LA BARRE DES ETAGES SE CALE SOUS CELLE DES ONGLETS, par la meme mesure.
    // Et les deux hauteurs partent dans --ccd-haut : c'est ce que vaut le
    // bandeau colle, donc de combien un etage vise doit s'arreter plus bas
    // (scroll-margin-top). Sans elle, le titre de l'etage passait dessous.
    const etg=document.getElementById('ccd-etages');
    const poser=()=>{
      const h=Math.round(tb.getBoundingClientRect().height);
      if(h>0) nav.style.top=h+'px';
      const hn=Math.round(nav.getBoundingClientRect().height);
      if(etg&&h>0&&hn>0) etg.style.top=(h+hn)+'px';
      const he=(etg&&etg.classList.contains('actif'))?Math.round(etg.getBoundingClientRect().height):0;
      try{ document.documentElement.style.setProperty('--ccd-haut',(h+hn+he+8)+'px'); }catch(e){}
    };
    poser();
    if(!window._ccdTopObs&&typeof ResizeObserver==='function'){
      window._ccdTopObs=new ResizeObserver(poser);
      window._ccdTopObs.observe(tb);
    }
  }catch(e){}
}
// ══ LE BILAN QUI ATTEND D'ETRE LU ════════════════════════════════════════
//
// MEME PREDICAT QUE LE BADGE ET QUE LA LISTE : hasNewBilan, et rien d'autre.
// La fiche a deja porte un jugement different du sien — elle lisait seenBilans,
// que le rendu venait d'ecrire, et s'eteignait donc a la premiere ouverture
// pendant que la liste restait allumee. Une seule source, ici comme ailleurs.
//
// LE COACH N'EST PAS OBLIGE DE CLIQUER : la barre dit deja la date. Elle mene
// a l'ecran des bilans, ou la reponse complete se lit.
// ══ LE BOUTON DE LA CARTE D'IDENTITE ═════════════════════════════════════
//
// IL NE S'AFFICHE PAS QUAND IL N'Y A RIEN A OUVRIR. viewClientBilans rend un
// toast « Aucun bilan disponible » sur un dossier vide : un bouton qui ne sait
// que dire non n'a pas sa place sur la carte d'identite.
//
// SON LIBELLE DIT CE QU'ON VA TROUVER. « Nouveau bilan » quand il y en a un
// jamais lu, « Voir le dernier bilan » sinon — meme predicat que le bandeau de
// l'onglet Entrainement et que la liste d'athletes : hasNewBilan, et rien
// d'autre. Trois ecrans qui jugent le meme dossier doivent en dire la meme
// chose.
function _majBoutonBilan(c){
  const z=document.getElementById('ccd-tete-act');
  if(!z) return false;
  const n=(c&&!c._fromCode&&Array.isArray(c.bilans))?c.bilans.length:0;
  if(!n){ z.innerHTML=''; return false; }
  let neuf=false;
  try{ neuf=hasNewBilan(c); }catch(e){ neuf=false; }
  // LA DATE DU DERNIER BILAN. Elle ne sort QUE lorsqu'il y en a un a lire :
  // « recu le 6 septembre » sous un bouton qui dit « voir le dernier bilan »
  // n'ajoute rien — on va le voir, on verra bien quand il date. Sous « nouveau
  // bilan a checker », elle dit s'il faut y aller maintenant ou ce soir.
  let quand='';
  if(neuf){
    const d=Math.max.apply(null,c.bilans.map(b=>Number(b&&b.date)||0));
    if(d>0){ try{ quand=new Date(d).toLocaleDateString('fr-FR',{day:'numeric',month:'long'}); }
             catch(e){ quand=''; } }
  }
  z.innerHTML='<div class="ccd-tete-a">'
    +'<button type="button" class="ccd-tete-b'+(neuf?' neuf':'')+'" onclick="viewClientBilans()">'
    +(neuf?'<span class="ccd-tete-pt"></span>':'')
    +'<span class="ccd-tete-bt">'+(neuf?'Nouveau bilan à checker':'Voir le dernier bilan')
    +(quand?('<small>reçu le '+escapeHtml(quand)+'</small>'):'')
    +'</span></button></div>';
  return true;
}
// ⚠ _majBilanNeuf A ETE RETIREE le 08/09/2026, quelques heures apres avoir
// ete ecrite. Elle remplissait un bandeau « Nouveau bilan a checker » en tete
// de l'onglet Entrainement ; Kevin a ensuite demande un bouton « Voir le
// dernier bilan » sur la carte d'identite, qui prend ce meme libelle et cette
// meme date quand il y a du neuf. La carte ne quitte jamais l'ecran, le
// bandeau si — et les deux se retrouvaient a l'ecran en meme temps, a vingt
// pixels d'ecart, pour dire la meme chose. Voir _majBoutonBilan.
function ccdVue(nom){
  const v=CCD_VUES.indexOf(nom)>=0?nom:'entrainement';
  // LE RAFRAICHISSEMENT DE FOND NE DOIT PAS RAMENER LE COACH EN HAUT.
  // openClientDetail repasse ici toutes les 30 s avec l'onglet DEJA ouvert :
  // remonter a chaque passage arracherait la page sous ses yeux pendant
  // qu'il lit. On ne remonte que sur un vrai changement d'onglet.
  const _change=(v!==_ccdVue);
  _ccdVue=v;
  _ccdPlacerBlocs(v);
  try{
    document.querySelectorAll('#s-coach-client .ccd-vue').forEach(z=>{
      z.classList.toggle('actif',z.dataset.vue===v);
    });
    document.querySelectorAll('#ccd-ancres .ccd-tuile').forEach(b=>{
      b.classList.toggle('active',b.dataset.vue===v);
      // L'ETAT EST AUSSI DIT AUX OUTILS D'ASSISTANCE. Une couleur et un halo
      // ne se lisent pas au lecteur d'ecran : sans cela, quatre boutons
      // identiques, et rien qui dise lequel est ouvert.
      b.setAttribute('aria-current',b.dataset.vue===v?'page':'false');
    });
    // LA BARRE DES SIX ETAGES NE PARAIT QUE SUR L'ONGLET QU'ELLE SERT. Posee
    // partout, elle aurait mene a des etages absents des trois autres onglets.
    const nav=document.getElementById('ccd-etages');
    if(nav) nav.classList.toggle('actif',v==='donnees');
    // L'ONGLET OUVERT EST DIT A L'ECRAN LUI-MEME : c'est ce qui permet a la
    // feuille de styles d'alleger l'en-tete sur Donnees sans qu'une fonction
    // de rendu ait a le savoir. Voir « L'EN-TETE S'EFFACE DEVANT LE VERDICT ».
    const ec=document.getElementById('s-coach-client');
    if(ec) ec.dataset.vue=v;
    // On remonte : garder la position d'un onglet en montrerait un autre par
    // son milieu, sur une hauteur qui n'a aucune raison de correspondre.
    if(_change) _ccdRemonter();
  }catch(e){}
  // E4 : le moteur de l'analyse morpho ne part qu'ici, à l'arrivée sur Données.
  if(_change&&v==='donnees'){ try{ const c=getOwnedClient(currentClientId); if(c) _anatLancerFond(c); }catch(e){} }
  _ccdMajEtages();
  _ccdMajAlertes();
  _ccdMajColonnes();
  return v;
}
// LES BLOCS QUI VIVENT DANS DEUX ONGLETS. Kevin, 24/09/2026 : l'onglet
// Entrainement redevient celui d'hier matin, et Donnees garde ses etages.
// Un seul exemplaire de chaque bloc : il est DEPLACE vers l'onglet ouvert.
// Sur Entrainement, il se pose apres son <template data-ent-ancre> ; partout
// ailleurs, il retourne a sa place dans Donnees, que marque un <template
// data-don-ancre> pose au premier passage — le bloc y est encore a ce moment.
// Un bloc range dans une .cc-sect-c voyage AVEC sa section : le titre
// « Volume », « Plateaux » ou « Douleur » part avec lui.
const CCD_BLOCS_ENTRAINEMENT=['ccd-corps','ccd-asymetrie','ccd-forme',
  'ccd-volume','ccd-plateaux','ccd-douleur'];
let _ccdCorpsEnt=null;
function _ccdPlacerBlocs(v){
  try{
    for(const id of CCD_BLOCS_ENTRAINEMENT){
      const el=document.getElementById(id);
      if(!el) continue;
      const bloc=el.classList.contains('cc-sect-c')?el.closest('.cc-sect'):el;
      const ici=document.querySelector('#s-coach-client template[data-ent-ancre="'+id+'"]');
      if(!bloc||!ici) continue;
      let la=document.querySelector('#s-coach-client template[data-don-ancre="'+id+'"]');
      if(!la){
        la=document.createElement('template');
        la.setAttribute('data-don-ancre',id);
        bloc.before(la);
      }
      const cible=(v==='entrainement')?ici:la;
      if(bloc.previousElementSibling!==cible) cible.after(bloc);
    }
  }catch(e){}
  // LA SILHOUETTE NE SE DESSINE PAS PAREIL DANS LES DEUX ONGLETS : avec ses
  // courbes sur Entrainement, sans elles sur Donnees. On la repeint quand on
  // passe de l'un a l'autre, pas a chaque rafraichissement de fond.
  const ent=(v==='entrainement');
  if(_ccdCorpsEnt!==ent){
    _ccdCorpsEnt=ent;
    try{ const c=getOwnedClient(currentClientId); if(c) renderCorpsCoach(c); }catch(e){}
  }
}
// Compte ce qui est REELLEMENT affiche dans chaque onglet, et pose `data-solo`
// sur ceux qui n'ont qu'un bloc. Au-dela de 1025 px, l'onglet actif se met en
// deux colonnes ; avec un seul bloc, la seconde resterait vide sur toute la
// hauteur — mieux vaut alors la pleine largeur.
//
// LE COMPTAGE SE FAIT SUR LE DISPLAY CALCULE, pas sur offsetParent : les blocs
// d'un onglet ferme ont tous un offsetParent nul, et l'onglet serait declare
// solo a tort des qu'on le quitte. Le display calcule d'un enfant, lui, ne
// depend pas de celui de son parent.
//
// Une section vide est deja masquee par .cc-sect:has(>.cc-sect-c:empty) : elle
// n'occupe aucune piste de la grille, et ne doit donc pas compter.
//
// Appele au changement d'onglet et a l'ouverture de la fiche. PAS au repli :
// replier change une hauteur, jamais un nombre de blocs.
function _ccdMajColonnes(){
  try{
    document.querySelectorAll('#s-coach-client .ccd-vue').forEach(z=>{
      let n=0;
      for(const e of z.children){
        if(getComputedStyle(e).display!=='none'&&++n>1) break;
      }
      if(n<=1) z.setAttribute('data-solo','');
      else z.removeAttribute('data-solo');
    });
  }catch(e){}
}
// PURE au sens de l'écran : elle ne lit que ce qui est rendu. Une section vide
// est masquée par la règle .cc-sect:has(>.cc-sect-c:empty), et son onglet
// n'allume donc rien — c'est le comportement voulu.
function _ccdMajAlertes(){
  try{
    for(const vue of CCD_VUES){
      const b=document.querySelector('#ccd-ancres .ccd-tuile[data-vue="'+vue+'"]');
      if(!b) continue;
      const chaud=(CCD_ALERTES[vue]||[]).some(id=>{
        const z=document.getElementById(id);
        if(!z||!(z.textContent||'').trim()) return false;
        const s=z.closest('.cc-sect');
        return !(s&&s.style.display==='none');
      });
      if(chaud) b.setAttribute('data-alerte',''); else b.removeAttribute('data-alerte');
    }
  }catch(e){}
}
// ══ LES SIX ETAGES DE L'ONGLET DONNEES ═══════════════════════════════════
//
// Kevin, 23/09/2026 : « il ne manque presque rien, il manque un ordre ». Les
// sections de l'onglet Donnees sont rangees en six etages — ou il en est, son
// corps, ses courbes, ses longueurs, ce qui appelle un oeil, le detail — et la
// barre d'ancres mene a chacun.
//
// ⚠ UN ETAGE VIDE N'A PAS DE BOUTON, ET PAS DE TITRE. Un dossier neuf n'a ni
//   photo, ni bilan, ni signal : la moitie des etages n'ont alors rien a dire.
//   Un titre seul au-dessus du vide se lit comme une panne. On mesure donc ce
//   qui est REELLEMENT rendu, exactement comme _ccdMajColonnes le fait pour
//   les colonnes, et l'etage disparait avec son bouton.
/**
 * PURE au sens de l'ecran : elle ne lit que ce qui est rendu.
 * @param {Element} sec l'etage
 * @returns {boolean} vrai s'il n'a rien a montrer
 */
function _ccdEtageVide(sec){
  try{
    for(const e of sec.children){
      if(e.classList.contains('ccd-et-h')) continue;          // le titre ne compte pas
      if(getComputedStyle(e).display==='none') continue;
      if((e.textContent||'').trim()) return false;
      if(e.querySelector('img,canvas,svg,input,button')) return false;
    }
    return true;
  }catch(e){ return false; }
}
// Range les etages vides et leurs boutons. Appelee au changement d'onglet et
// apres chaque rendu de fiche.
function _ccdMajEtages(){
  try{
    const nav=document.getElementById('ccd-etages');
    let n=0;
    for(const cle of CCD_ETAGES){
      const sec=document.getElementById('ccd-et-'+cle);
      const b=nav&&nav.querySelector('.ccd-et-b[data-et="'+cle+'"]');
      const vide=!sec||_ccdEtageVide(sec);
      if(sec) sec.hidden=vide;
      if(b) b.hidden=vide;
      if(!vide) n++;
    }
    // UN SEUL ETAGE NE FAIT PAS UNE BARRE : elle ne menerait qu'a l'endroit ou
    // l'on est deja.
    if(nav) nav.classList.toggle('vide',n<2);
  }catch(e){}
}
/**
 * Mene a un etage. Ouvre d'abord l'onglet Donnees — sans quoi le defilement
 * viserait un bloc masque, et rien ne se passerait, comme pour ccdAller.
 * @param {string} cle
 * @returns {boolean}
 */
function ccdEtage(cle){
  const sec=document.getElementById('ccd-et-'+cle);
  if(!sec) return false;
  if(_ccdVue!=='donnees') ccdVue('donnees');
  if(sec.hidden) return false;
  _ccdEtageActif(cle);
  try{ sec.scrollIntoView({block:'start'}); }catch(e){ _defiler(sec); }
  return true;
}
// Le bouton de l'etage ou l'on est. Une barre qui ne suit pas le pouce ment
// des le premier defilement.
function _ccdEtageActif(cle){
  try{
    document.querySelectorAll('#ccd-etages .ccd-et-b').forEach(b=>{
      const a=b.dataset.et===cle;
      b.classList.toggle('active',a);
      b.setAttribute('aria-current',a?'true':'false');
    });
  }catch(e){}
}
// Garde son role : mener a une section precise. Elle OUVRE d'abord l'onglet
// qui la contient — sinon elle faisait defiler vers un bloc masque, et il ne
// se passait rien.
function ccdAller(id){
  const z=document.getElementById(id);
  if(!z) return;
  try{ const v=z.closest('.ccd-vue'); if(v&&v.dataset.vue!==_ccdVue) ccdVue(v.dataset.vue); }catch(e){}
  _defiler(z);
  if(arcReduit()) return;
  const t=z.closest('.cc-sect')?.querySelector('.cc-sect-t');
  if(!t) return;
  // Sans changement de point de depart, une classe reposee ne rejoue pas :
  // il faut forcer une reprise de mise en page entre le retrait et la pose.
  t.classList.remove('cc-vise');
  void t.offsetWidth;
  t.classList.add('cc-vise');
}
// ARME UNE SEULE FOIS, et pas a chaque openClientDetail : la fonction est
// rappelee toutes les 30 s par la boucle de synchro. L'observateur tolere une
// cible non rendue — .cc-sect:has(>.cc-sect-c:empty) masque les sections vides.
function _ccdArmerAncres(){
  try{
    const nav=document.getElementById('ccd-ancres');
    if(!nav) return;
    _ccdCalerAncres();
    // L'OBSERVATEUR DE DEFILEMENT A ETE RETIRE. Il allumait la puce de la
    // section qu'on traversait ; les puces designent maintenant un ONGLET, et
    // c'est ccdVue qui les commande. Le laisser aurait fait clignoter la barre
    // au fil du pouce, sur des sections qui ne sont plus toutes affichees.
    // LA BARRE SE RESSERRE au-dela de 120 px, et se rouvre sous 60 px.
    // L'HYSTERESIS EST OBLIGATOIRE : sans elle la barre pompe a chaque
    // micro-mouvement du pouce. L'ecoute est PASSIVE et amortie par une frame :
    // elle ne retient jamais le defilement.
    if(!window._ccdSerreArme){
      window._ccdSerreArme=true;
      let tic=false;
      // SUR window, ET NON SUR .scroll-area : c'est le document qui defile.
      window.addEventListener('scroll',()=>{
        // HORS DE LA FICHE ATHLETE, RIEN (01/10/2026). L'ecouteur est pose une
        // fois pour toutes sur window : sans ce garde, il lisait la position
        // des sections #ccd-et-* — un getBoundingClientRect, donc une mise en
        // page forcee — a chaque defilement de n'importe quel ecran, tant que
        // _ccdVue restait sur 'donnees'.
        if(!document.getElementById('s-coach-client')?.classList.contains('active')) return;
        if(tic) return;
        tic=true;
        requestAnimationFrame(()=>{
          tic=false;
          const y=window.scrollY||document.documentElement.scrollTop||0;
          if(y>120) nav.setAttribute('data-serre','');
          else if(y<60) nav.removeAttribute('data-serre');
          // L'ETAGE SOUS LE BANDEAU : celui dont le haut est passe, le plus
          // bas des trois premiers pixels visibles. Le meme ecouteur que la
          // barre serree, une seule frame pour les deux.
          if(_ccdVue!=='donnees') return;
          let vu='';
          for(const cle of CCD_ETAGES){
            const s=document.getElementById('ccd-et-'+cle);
            if(!s||s.hidden) continue;
            if(s.getBoundingClientRect().top<=140) vu=cle;
          }
          if(vu) _ccdEtageActif(vu);
        });
      },{passive:true});
    }
  }catch(e){}
}
// ══════ B2.F1 — LE TIROIR DE DETAIL ═══════════════════════════════════
//
// PURE. Le tiroir est-il le bon geste ici ? Deux conditions, et les deux
// comptent : la largeur — la place n'existe qu'a partir de 1440 px — et
// l'ecran, parce que la liste d'athletes ne vit que sur l'accueil coach.
const TIROIR_LARGEUR_MIN=1440;
function _tiroirDisponible(){
  try{
    if(!window.matchMedia
      ||!matchMedia('(min-width:'+TIROIR_LARGEUR_MIN+'px)').matches) return false;
    const a=document.querySelector('.screen.active');
    return !!(a&&a.id==='s-coach-home');
  }catch(e){ return false; }
}
// AUCUNE DONNEE INVENTEE, ET AUCUN RENDU DUPLIQUE : le tiroir rappelle ce que
// la LIGNE calcule deja — _crAssidu, _crPoids, _crDiete, _crCharge, _crProgres,
// _crBilans — en clair plutot qu'en colonnes de trois caracteres. Il ne
// reproduit pas la fiche : il dit juste s'il faut l'ouvrir.
function _htmlTiroirAthlete(c){
  if(!c) return '';
  const nom=((c.fname||'')+' '+(c.lname||'')).trim()||c.email||'Athlète';
  const ligne=(lib,v)=>{
    const t=String(v==null?'':v).trim();
    if(!t) return '';
    return '<div style="display:flex;align-items:baseline;justify-content:space-between;'
      +'gap:10px;margin-top:8px">'
      +'<span style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1px;'
      +'text-transform:uppercase;font-weight:800">'+escapeHtml(lib)+'</span>'
      +'<span style="font-size:var(--fs-xs);color:var(--text-strong);text-align:right">'
      +t+'</span></div>';
  };
  const _sr=f=>{ try{ return f(c); }catch(e){ return ''; } };
  const corps=ligne('Assiduité',_sr(_crAssidu))+ligne('Poids',_sr(_crPoids))
    +ligne('Diète',_sr(_crDiete))+ligne('Charge',_sr(_crCharge))
    +ligne('Progrès',_sr(_crProgres))+ligne('Bilans',_sr(_crBilans));
  return '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">'
    +'<span style="font-size:var(--fs-sm);font-weight:800;color:var(--text);overflow:hidden;'
    +'text-overflow:ellipsis;white-space:nowrap">'+escapeHtml(nom)+'</span>'
    +'<button type="button" onclick="_tiroirFermer()" aria-label="Fermer le panneau" '
    +'style="background:none;border:none;color:var(--sub);font-size:var(--fs-md);'
    +'cursor:pointer;line-height:1;flex:none">×</button></div>'
    // RIEN QUAND RIEN N'EST MESURE : un panneau de six tirets ne dirait rien
    // de plus qu'une ligne vide, et il ferait croire a une panne.
    +(corps||'<div style="font-size:var(--fs-2xs);color:var(--text-faint);'
      +'line-height:1.55;margin-top:8px">Aucune mesure encore.</div>')
    +'<button type="button" class="btn btn-red btn-sm" style="width:100%;margin-top:14px" '
    +'onclick="openClientDetail(\''+String(c.id||'').replace(/'/g,'')+'\',false,true)">Ouvrir la fiche</button>';
}
function _tiroirOuvrir(cid){
  try{
    const z=document.getElementById('ch-tiroir');
    if(!z) return false;
    const c=(function(){ try{ return getOwnedClient(cid); }catch(e){ return null; } })();
    if(!c) return false;
    z.innerHTML=_htmlTiroirAthlete(c);
    document.querySelectorAll('#ch-clients-list .client-row').forEach(n=>{
      if(n.dataset.cid===String(cid)) n.setAttribute('aria-selected','true');
      else n.removeAttribute('aria-selected');
    });
    return true;
  }catch(e){ return false; }
}
function _tiroirFermer(){
  try{
    const z=document.getElementById('ch-tiroir');
    if(z) z.innerHTML='';
    document.querySelectorAll('#ch-clients-list .client-row[aria-selected]')
      .forEach(n=>n.removeAttribute('aria-selected'));
  }catch(e){}
}
// ══════ B2.F4 — LA POSITION DE LA LISTE, LE TEMPS D'UN ALLER-RETOUR ════
// Deux variables de module, et rien de persistant.
let _posAccueilCoach=0, _retourAccueilCoach=false, _ligneARevoir=null;
// On retient en QUITTANT la liste, et on arme le retour. Ici plutot que dans
// go() : c'est le seul geste qui ouvre un athlete, et c'est celui dont on veut
// pouvoir revenir.
function _retenirPositionAccueil(id){
  try{
    const pan=document.getElementById('ct-dashboard');
    _posAccueilCoach=pan?pan.scrollTop:0;
    _ligneARevoir=id||null;
    _retourAccueilCoach=true;
  }catch(e){}
}
// LA LIGNE QU'ON VIENT DE QUITTER SE SIGNALE, brievement : c'est ce qui evite
// de la chercher des yeux dans quinze lignes qui se ressemblent.
// NEUTRALISE SOUS prefers-reduced-motion — la classe existante .cc-vise porte
// deja cette garde, on la reutilise plutot que d'en ecrire une seconde.
function _signalerLigneAthlete(id){
  try{
    if(!id||arcReduit()) return;
    const l=document.getElementById('ch-clients-list');
    if(!l) return;
    const n=l.querySelector('[data-cid="'+String(id).replace(/"/g,'')+'"]');
    if(!n) return;
    n.classList.remove('cc-vise');
    void n.offsetWidth;
    n.classList.add('cc-vise');
  }catch(e){}
}
function openClientDetail(cid,_refresh,_force){
  // B2.F1 — AU-DELA DE 1440 PX, LE PREMIER CLIC REMPLIT LE TIROIR et ne quitte
  // pas la liste. Le bouton « Ouvrir la fiche » du tiroir rappelle cette meme
  // fonction avec _force : c'est le second clic, celui qui decide vraiment.
  // Sous 1440 px, ou hors de l'accueil coach, rien de tout cela ne s'applique.
  if(!_refresh&&!_force&&_tiroirDisponible()&&_tiroirOuvrir(cid)) return;
  // B2.F4 — ON RETIENT OU L'ON ETAIT AVANT DE QUITTER LA LISTE. Pas au
  // rafraichissement : celui-la ne quitte pas l'ecran.
  if(!_refresh) _retenirPositionAccueil(cid);
  if(!_refresh) rcmCoach('coach_fiche_ouverte');
  setTimeout(_ccdArmerAncres,0);
  // N3.6 — la ligne de fraicheur est repeinte a chaque ouverture, et a
  // chaque passage de la boucle de synchro : « il y a 4 min » doit vieillir.
  setTimeout(_majFraicheur,0);
  // L'ONGLET, POSE APRES LE RENDU. _refresh est la boucle de synchro, qui
  // repasse ici toutes les 30 s : elle ne doit PAS ramener le coach sur
  // Entrainement pendant qu'il lit la nutrition. Une ouverture franche, elle,
  // repart du premier onglet — d'un athlete a l'autre, le dernier onglet lu
  // n'a aucune raison d'etre le bon.
  const _memeAthlete=(currentClientId===cid);
  setTimeout(()=>{ _ccdArmerReplis(); ccdAppliquerReplis();
    ccdVue((_refresh&&_memeAthlete)?_ccdVue:'entrainement');
    // ccdVue le fait deja pour l'onglet visible ; ce second appel couvre
    // les trois autres, dont le contenu vient d'etre rendu.
    _ccdMajColonnes();
    // ET LES ETAGES, une fois le contenu pose : c'est lui qui dit lesquels
    // ont quelque chose a montrer.
    _ccdMajEtages(); _ccdCalerAncres(); },0);
  setTimeout(_majLiensClasser,0);
  // N3.10 — LE BROUILLON DE SEANCES APPARTIENT A UN ATHLETE. Ouvrir la fiche
  // d'un autre abandonne celui qui restait en memoire : il n'etait remis a
  // null nulle part, et survivait donc a tout le reste de la navigation.
  if(currentClientId!==cid&&_coachEditClient&&_coachEditClient.id!==cid) _coachEditClient=null;
  currentClientId=cid;
  const c=getOwnedClient(cid);
  if(!c) return;
  // N3.19 — OUVRIR UNE FICHE FORCE UNE DESCENTE, sans regarder les horodatages.
  // Un appareil dont un envoi a echoue porte une copie locale qui se croit plus
  // recente que le serveur : la sonde repond « rien de neuf » et la fiche reste
  // figee, video comprise. C'est le geste qui repare les appareils DEJA
  // aveugles, pour lesquels B1.3 arrive trop tard.
  //
  // ICI ET PAS DANS LA BOUCLE DE RAFRAICHISSEMENT : une lecture par ouverture
  // de fiche, pas une toutes les trente secondes. `_refresh` EST cette boucle,
  // et elle ne passe donc pas par la.
  if(!_refresh&&c.email){
    CLOUD.syncUser(c.email,true)
      .then(v=>{ if(v&&currentClientId===cid) openClientDetail(cid,true); })
      .catch(()=>{});
  }
  // La réponse au bilan se compose dans cette fiche : son contexte, c’est le
  // prénom de l’athlète. Posé ici et non dans blocReponseBilan, qui est un
  // rendu — un rendu ne doit pas modifier l’état de l’application, et il est
  // partagé avec l’écran de l’ATHLÈTE, où ce contexte n’a rien à faire.
  // SANS CIBLE, et c’est délibéré : le prénom est la SEULE variable posée ici,
  // et il vaut pour tous les blocs de réponse de cette fiche — il y en a un par
  // bilan, chacun avec son propre identifiant. Nommer un seul champ laisserait
  // les autres sans contexte, et _tplCtxPour ne leur rendrait que le prénom :
  // exactement ce qu’on veut, mais par accident plutôt que par décision.
  try{ tplContexte({prenom:c.fname},null); }catch(e){}
  // Volume de la semaine en cours, calcule avec la classification et les
  // reperes de L ATHLETE.
  try{ renderJournalCoach(c); }catch(e){}
  try{ renderVolumeCoach(c); }catch(e){}
  try{ renderPlateauxCoach(c); }catch(e){}
  // LE CORPS EST RENDU ICI, ET NULLE PART AILLEURS. C'est ce qui le fait
  // repeindre a chaque descente de dossier : actualiserClient rappelle
  // openClientDetail des que quelque chose a change, et le bloc suit sans un
  // clic de plus.
  // LE VERDICT EN PREMIER : c'est le premier etage de l'onglet Donnees, et il
  // repond a la seule question qu'on se pose en ouvrant une fiche.
  try{ renderVerdictCoach(c); }catch(e){}
  try{ renderCorpsCoach(c); }catch(e){}
  try{ renderAnatCoach(c); }catch(e){}
  try{ renderCourbesCoach(c); }catch(e){}
  try{ renderSignauxCoach(c); }catch(e){}
  try{ renderMensCoach(c); }catch(e){}
  try{ renderMethodesCoach(c); }catch(e){}
  try{ renderRevueMorphoCoach(c); }catch(e){}
  try{ renderPremierProgrammeIA(c); }catch(e){}
  try{ renderRisqueFiche(c); }catch(e){}
  try{ renderAsymetrieCoach(c); }catch(e){}
  try{ renderMotCoachFiche(c); }catch(e){}
  try{ renderRelanceFiche(c); }catch(e){}
  try{ renderAccueilFiche(c); }catch(e){}
  // La file d'une ligne groupée « À traiter » (Athlète suivant).
  try{ _rendreFileSignal(c.id); }catch(e){}
  try{ renderPaiementsFiche(c); }catch(e){}
  try{ renderDouleurCoach(c); }catch(e){}
  try{ renderLeveeCoach(c); }catch(e){}
  // BILAN DE SECURITE : une ligne, sans le detail des reponses — le coach
  // n a pas a savoir LESQUELLES, seulement qu une vigilance s impose.
  try{
    const _zt=document.getElementById('ccd-securite');
    if(_zt) _zt.innerHTML=aTCA(c)
      ?`<div style="background:var(--info-bg);border:1px solid var(--info-border);border-radius:var(--r-3);padding:12px 14px;margin-bottom:16px;font-size:var(--fs-xs);color:var(--text-strong);line-height:1.6">${escapeHtml(SCOFF_ALERTE_COACH)}</div>`
      :'';
  }catch(e){}
  try{ renderHabitudesCoach(c); }catch(e){}
  try{ _ccdBilCalReset(); renderCalendrierBilansCoach(c); }catch(e){}
  try{ renderRedsCoach(c); }catch(e){}
  try{ renderPostPartumCoach(c); }catch(e){}
  try{ renderDossierSanteCoach(c); }catch(e){}
  // Chips de reponse au bilan : la zone n'existe qu'apres le rendu des
  // reponses, on la peuple donc ici et non a la construction du bloc.
  setTimeout(()=>{ try{ _renderQuickCommentChips('bilan'); }catch(e){} },0);
  try{ renderPhaseCoach(c); }catch(e){}
  // Les trois blocs de tete de l'onglet Nutrition, poses le 08/09/2026 : le
  // type de diete, le taux de respect, et le calendrier du journal tout en bas.
  try{ renderDieteChoixCoach(c); }catch(e){}
  try{ renderDieteRespectCoach(c); }catch(e){}
  try{ renderJournalNutriCoach(c); }catch(e){}
  try{ renderFormeCoach(c); }catch(e){}
  try{ renderPoidsCoach(c); }catch(e){}

  document.getElementById('ccd-title').textContent=c.fname||c.lname||'';
  const _av=document.getElementById('ccd-avatar');
  if(c.athletePhoto) _av.innerHTML=`<img src="${escapeHtml(c.athletePhoto)}" style="width:100%;height:100%;object-fit:cover">`;
  else{_av.style.background='var(--surface-2)';_av.textContent=ini(c.fname,c.lname);}
  // ⚠ LE NUMERO N'EST PAS UN IDENTIFIANT, C'EST UN REPERE. Il dit a quel rang
  //   cet athlete est arrive ; il ne sert a le retrouver nulle part, et il
  //   bouge si quelqu'un quitte le portefeuille. Voir rangArrivee.
  const _nom=((c.fname||'')+' '+(c.lname||'')).trim()||'Profil incomplet';
  const _rang=(function(){ try{ return rangArrivee(c); }catch(e){ return 0; } })();
  document.getElementById('ccd-name').textContent=
    _rang?('Athlète n°'+_rang+' : '+_nom):_nom;
  document.getElementById('ccd-info').textContent=c._fromCode
    ?'Code généré le '+new Date(c._codeInfo.createdAt).toLocaleDateString('fr-FR')+' · Expire le '+new Date(c._codeInfo.expiry).toLocaleDateString('fr-FR')
    :(c.objective||c.bilanGoals||'Objectif non défini')+' • '+(c.level||'Niveau ?');
  const _oldSeen=(currentUser.seenBilans||{})[c.email]||0;
  const _newBil=!c._fromCode&&(c.bilans||[]).some(b=>b.date>_oldSeen);
  if(_newBil){
    if(!currentUser.seenBilans) currentUser.seenBilans={};
    currentUser.seenBilans[c.email]=Math.max(...c.bilans.map(b=>b.date));
    saveUser();
  }
  try{ _majBoutonBilan(c); }catch(e){}
  // « Partager une victoire » : sa meilleure progression de charge.
  try{ _rendreBoutonVictoire(c); }catch(e){}
  const _pq=document.getElementById('ccd-pourquoi');
  if(_pq) _pq.innerHTML=_htmlPourquoiIci(c);
  document.getElementById('ccd-badge').innerHTML=c._fromCode
    ?'<span class="badge badge-orange">En attente d\'inscription</span>'
    // seenBilans continue d’être tenu à jour par le rendu juste au-dessus : il
    // sert à distinguer un bilan jamais ouvert d’un bilan lu. Il n’a jamais
    // décidé de ce badge — la fiche l’a lu un temps, et elle annonçait alors
    // autre chose que la liste sur le même dossier.
    :_enAttenteAbonnement(c)?'<span class="badge badge-orange">Abonnement à souscrire</span>'
    :_accesExpire(c)?'<span class="badge badge-gray">Lecture seule : accès expiré</span>'
    // ⚠ « NOUVEAU BILAN » A QUITTE CE BADGE le 08/09/2026 : la barre
    // cliquable de la carte le dit desormais, en toutes lettres, avec la date
    // et un chemin vers le bilan. Le garder ici aurait fait dire deux fois la
    // meme chose dans la meme carte, a dix centimetres d’ecart — et le badge,
    // lui, ne menait nulle part. La barre et la liste jugent du meme predicat.
    // La cascade continue donc jusqu’a l’etat de suivi de l’athlete, qui est
    // ce que ce badge a toujours eu de plus utile a dire.
    :needsAlert(c)?'<span class="badge badge-red"> Bilan en retard</span>':isActive(c)?'<span class="badge badge-green"> Actif</span>':'<span class="badge badge-gray">Inactif</span>';
  const _pd=document.getElementById('ccd-profile-details');
  if(_pd){
    const _bits=[];
    if(c.age) _bits.push(`<div style="font-size:var(--fs-xs)"><span style="color:var(--sub)">Âge</span><br><strong>${c.age} ans</strong></div>`);
    if(c.gender) _bits.push(`<div style="font-size:var(--fs-xs)"><span style="color:var(--sub)">Sexe</span><br><strong>${isFemale(c.gender)?'Femme':'Homme'}</strong></div>`);
    if(c.profileWeight) _bits.push(`<div style="font-size:var(--fs-xs)"><span style="color:var(--sub)">Poids</span><br><strong>${c.profileWeight} kg</strong></div>`);
    if(c.objective) _bits.push(`<div style="font-size:var(--fs-xs);flex-basis:100%"><span style="color:var(--sub)">Objectif profil</span><br><strong>${escapeHtml(c.objective)}</strong></div>`);
    if(c.bilanGoals) _bits.push(`<div style="font-size:var(--fs-xs);flex-basis:100%"><span style="color:var(--sub)">Objectifs bilan départ</span><br><strong>${escapeHtml(c.bilanGoals)}</strong></div>`);
    if(_bits.length){_pd.innerHTML=_bits.join('');_pd.style.display='flex';}
    else _pd.style.display='none';
  }
  // ⚠ LA RANGEE DU BAS S'EFFACE QUAND ELLE N'A RIEN A PORTER. C'est ELLE qui
  //   tient le filet separateur depuis qu'il n'y en a plus qu'un : sur un
  //   dossier sans details de profil ET sans bilan — une invitation qu'on
  //   vient d'ouvrir — le laisser aurait tire un trait sous les compteurs pour
  //   n'annoncer rien, et ajoute 21 px de rouge vide sous la carte.
  //
  //   ELLE EST RELUE APRES _pd ET _majBoutonBilan, jamais avant : les deux
  //   ecrivent leur contenu plus haut dans cette fonction, et la question
  //   « est-ce vide ? » n'a de reponse qu'une fois les deux passes.
  const _bas=document.querySelector('#s-coach-client .ccd-tete-bas');
  if(_bas){
    const _act=document.getElementById('ccd-tete-act');
    const _plein=(_pd&&_pd.style.display!=='none')
               ||(_act&&String(_act.innerHTML).trim()!=='');
    _bas.style.display=_plein?'flex':'none';
  }
  // Lien WhatsApp vers l'athlète. Sans numéro, le lien reste utile — WhatsApp
  // s'ouvre avec le texte et le coach choisit le contact — mais le libellé le
  // dit, pour ne pas laisser croire à un destinataire déjà résolu.
  // LOT M2 : le fil privé, depuis la fiche.
  const _mb=document.getElementById('ccd-msg');
  if(_mb){ _mb.style.display=c._fromCode?'none':'flex'; _mb.innerHTML='Message à '+escapeHtml(c.fname||'cet athlète'); }
  // Les étiquettes de l'athlète, modifiables.
  try{ _rendreEtiquettesFiche(c); }catch(e){}
  const _wa=document.getElementById('ccd-wa');
  if(_wa){
    if(c._fromCode){_wa.style.display='none';}
    else{
      const _tel=_telAthlete(c);
      const _pre=c.fname||'cet athlète';
      _wa.href=safeUrlRaw(waLink(_tel,'Salut '+(c.fname||'')+' 💪'));
      _wa.onclick=()=>{ noterContact(c.id); };
      _wa.innerHTML='Écrire à '+escapeHtml(_pre);
      // SANS NUMERO, LA BANNIERE NE S'AFFICHE PAS. Elle proposait d'ecrire a
      // quelqu'un dont on n'a pas le numero, et le lien pour l'enregistrer
      // s'affichait juste en dessous : deux lignes pour dire qu'il manque une
      // donnee. Le lien seul le dit mieux, et il reste juste en dessous.
      _wa.style.display=_tel?'flex':'none';
      // LE LIBELLE NE BOUGE PLUS : « Enregistrer son numéro » ne tient pas
      // dans les 85 px d'un quart de ligne. La nuance passe dans l'infobulle,
      // et l'etat se lit deja au-dessus — le lien vert ne s'affiche que
      // lorsqu'un numero existe.
      const _def=document.getElementById('ccd-wa-set');
      if(_def) _def.title=_tel?'Modifier le numéro enregistré':'Enregistrer son numéro';
    }
  }
  // Modèle appliqué : sans cette ligne, le coach n'avait aucun moyen de savoir
  // lequel de ses programmes cet athlète suit — l'écran des séances ne montre
  // que le contenu, jamais son origine.
  const _ap=document.getElementById('ccd-assigned-prog');
  if(_ap){
    if(c.assignedProgramName){
      _ap.innerHTML='<strong style="color:var(--text-strong)">Programme :</strong> '+escapeHtml(c.assignedProgramName)
        +(c.assignedProgramAt?', assigné le '+new Date(c.assignedProgramAt).toLocaleDateString('fr-FR'):'');
      _ap.style.display='block';
    } else _ap.style.display='none';
  }
  document.getElementById('ccd-streak').textContent=streakSemaines(c)+'';
  // Le taux se lit A COTE de la serie : deux mesures d assiduite, une seule
  // lecture. Aucun palier, aucune couleur d alerte.
  const _tcz=document.getElementById('ccd-taux');
  if(_tcz) _tcz.innerHTML=htmlTauxCompletion(c,false);
  document.getElementById('ccd-sessions').textContent=(c.sessions||[]).length;
  const lb=c.bilans?.length?c.bilans[c.bilans.length-1]:null;
  document.getElementById('ccd-weight').textContent=lb&&getBW(lb)?getBW(lb)+'kg':'-';
  // Contre-indications du bilan de départ, épinglées en haut de la fiche.
  // Elles viennent de la même déclaration que la liste complète des réponses
  // (BILAN_QUESTIONS.depart, entrées `alerte`) : en ajouter une au
  // questionnaire suffit à la faire apparaître ici.
  const _al=document.getElementById('ccd-alertes');
  if(_al){
    const ci=contreIndications(c.bilans);
    // L'encart s'affiche desormais aussi quand rien n'est declare en texte
    // libre mais qu'une contrainte a ete structuree, ou qu'un drapeau rouge
    // est actif — c'est le cas le plus urgent, il ne peut pas dependre de la
    // presence d'un texte.
    const _ctL=contraintesActives(c), _ctD=drapeauRougeActif(c);
    _al.style.display=(ci.length||_ctL.length||_ctD)?'block':'none';
    _al.innerHTML=(!ci.length&&!_ctL.length&&!_ctD)?'':`<div style="background:#1a0d00;border:1px solid var(--orange);border-left:1px solid var(--border);border-radius:var(--r-2);padding:12px 14px">
      <div style="font-size:var(--fs-xs);color:var(--orange);font-weight:900;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px">À prendre en compte</div>
      ${blocDrapeauRouge(c)}
      ${ci.map(x=>`<div style="font-size:var(--fs-sm);line-height:1.55;margin-bottom:4px"><span style="color:#fcd34d;font-weight:700">${x.lbl} :</span> <span style="color:var(--text)">${escapeHtml(x.txt)}</span></div>`).join('')}
      ${_ctL.length?`<div style="margin-top:10px;border-top:1px solid #3a2400;padding-top:8px">
        <div style="font-size:var(--fs-xs);color:var(--orange);font-weight:800;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px">Contraintes structurées</div>
        ${_ctL.map(x=>_ligneContrainte(x,true,c.id)).join('')}
      </div>`:''}
      <button class="btn btn-outline btn-sm" onclick="ouvrirFormContrainte('',${jsArg(c.id)})" style="margin-top:10px;letter-spacing:1px;font-size:var(--fs-2xs)">Structurer une contrainte</button>
      ${blocDisclaimerSante()}
    </div>`;
  }
  // Le rite AVANT les bilans, comme dans le balisage : il porte une question
  // posée, et quelqu’un attend au bout.
  try{ renderTendancesCoach(c); }catch(e){}
  try{ renderRiteCoach(c); }catch(e){}
  const be=document.getElementById('ccd-bilans');
  if(c._fromCode){
    be.innerHTML=`<div style="background:var(--surface-1);border:1px solid var(--surface-2);border-radius:var(--r-3);padding:16px;text-align:center">
      <div style="margin-bottom:10px">${icon('smartphone',32)}</div>
      <div style="font-weight:700;margin-bottom:6px">${escapeHtml(c.fname||'')} n'a pas encore créé son compte</div>
      <div class="sub" style="font-size:var(--fs-sm);line-height:1.6">Envoie-lui le code d'accès pour qu'elle s'inscrive.<br>Ses données apparaîtront ici automatiquement dès qu'elle aura complété son premier bilan.</div>
    </div>`;
  } else if(!c.bilans?.length){
    // R13 — le coach ne remplit pas le bilan de son athlete : on dit qui agit
    // et quand, sans bouton.
    be.innerHTML=emptyState('clipboard','Pas encore de bilan de '+escapeHtml(c.fname||'ton athlète')+'. Il s\'affichera ici dès son envoi.',null,null,'padding:20px');
  } else {
    be.innerHTML=c.bilans.slice(-3).reverse().map(b=>{
      // Deux jeux de valeurs, et c'est voulu : calcBF veut des NOMBRES, donc le
      // repli à 0. L'affichage, lui, doit distinguer « pas mesuré » de « zéro »
      // — sans quoi la ligne annonce « Poids: 0kg » à un athlète qui n'a
      // simplement rien renseigné.
      const bwN=getBW(b),bWaistN=getBM(b,'waist'),bNeckN=getBM(b,'neck'),bHipsN=getBM(b,'hips');
      const bw=bwN||0,bWaist=bWaistN||0,bNeck=bNeckN||0,bHips=bHipsN||0;
      const bfPct=calcBF(bWaist,bNeck,bHips,parseFloat(c._evol_height||c['init-height']||c['deb-height']||0),c.gender||'H');
      // Extrait actionnable sous les chiffres : ce sur quoi le coach peut agir
      // dès maintenant. Remplace la citation unique tronquée à 80 caractères,
      // qui ne montrait qu'une seule des trois informations utiles.
      // Rien pour un bilan de départ : ses réponses sont épinglées plus haut,
      // et aucune clé bil-* n'y figure de toute façon.
      const _ACTIONNABLES=[
        {k:'bil-diff-detail',repli:'bil-diff-type',lbl:'Difficultés'},
        {k:'bil-prog-modifs',lbl:'Demande'},
        {k:'bil-motivation',lbl:'Motivation'},
      ];
      const _extrait=b.type==='depart'?[]:_ACTIONNABLES
        .map(a=>({lbl:a.lbl,txt:_texteReponse(b[a.k])||(a.repli?_texteReponse(b[a.repli]):'')}))
        .filter(x=>x.txt);
      return `<div class="card" style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-weight:700">${dateLocaleDeCle(b.date).toLocaleDateString('fr-FR')}</span><span class="badge ${b.date>_oldSeen?'badge-orange':'badge-green'}">${b.date>_oldSeen?'Nouveau '+icon('etoile',10):'Complété'}</span></div>
      <div style="display:flex;gap:16px;flex-wrap:wrap">${_fragmentSiValeur('<span class="sub">Poids: <strong style="color:var(--text)">',bwN,'kg</strong></span>')}${_fragmentSiValeur('<span class="sub">MG: <strong style="color:var(--text)">',bfPct,'%</strong></span>')}${_fragmentSiValeur('<span class="sub">Taille: <strong style="color:var(--text)">',bWaistN,'cm</strong></span>')}</div>
      ${_extrait.length?`<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px">
        ${_extrait.map(x=>`<div style="font-size:var(--fs-xs);line-height:1.5;margin-bottom:4px"><span style="color:var(--sub);font-weight:700">${x.lbl} :</span> <span style="color:#ccc">${escapeHtml(x.txt.length>90?x.txt.slice(0,90)+'…':x.txt)}</span></div>`).join('')}
        <button class="btn btn-outline btn-sm" style="margin-top:6px" onclick="viewClientBilans();evoTab('reponses')">Voir toutes les réponses</button>
      </div>`:''}
    </div>`}).join('');
  }
  // ══ SES VIDEOS : LA VIGNETTE D'ABORD ═══════════════════════════════════
  // Kevin, 08/09/2026 : « restyle-le comme le bloc video du profil athlete,
  // vignette + correction, que ca fasse un peu plus clean ».
  //
  // LA CARTE NE MONTRAIT AUCUNE IMAGE. Un nom, une date, un bouton : devant
  // six lignes, le coach ne pouvait pas savoir laquelle il avait deja regardee
  // sans les ouvrir une par une. La vignette, elle, se reconnait — c'est
  // exactement ce que la carte cote athlete fait deja, et c'est la raison pour
  // laquelle elle se lit mieux.
  // ELLE NE COUTE PAS LE TELECHARGEMENT DE LA VIDEO : preload="metadata" ne
  // rapatrie que l'en-tete du fichier, et une video YouTube n'est qu'une
  // image de 320 px servie par YouTube. Voir _vignetteVideoHtml.
  const _vids=(c.videos||[]).slice().reverse().slice(0,6);
  const _pendingVids=_vids.filter(videoNonCorrigee);
  const _vEl=document.getElementById('ccd-videos');
  if(_vEl) _vEl.innerHTML=!_vids.length?'':(`
    <div class="cvv-tete">
      <span>Vidéos</span>
      <span class="badge ${_pendingVids.length?'badge-orange':'badge-green'}">${_pendingVids.length?_pendingVids.length+' à corriger':'Tout corrigé'}</span>
    </div>
    ${_vids.map(v=>`<div class="cvv-c${videoNonCorrigee(v)?' cvv-att':''}">
      ${_vignetteVideoHtml(v.url)}
      <div class="cvv-t">
        <div class="cvv-n">${escapeHtml(v.name)}</div>
        <div class="cvv-d">${dateLocaleDeCle(v.date).toLocaleDateString('fr-FR')}${videoNonCorrigee(v)?' · <span class="cvv-att-l">en attente de ta correction</span>':' · corrigée'}</div>
      </div>
      <button class="btn ${videoNonCorrigee(v)?'btn-red':'btn-outline'} btn-sm cvv-b" onclick="openVideoCorrection(${jsArg(c.email)},${jsArg(v.id)})">${videoNonCorrigee(v)?'Corriger':'Modifier'}</button>
      ${analysesComparables(c,v).length?`<button class="btn btn-outline btn-sm cvv-b" onclick="comparerAnalyses(${jsArg(c.email)},${jsArg(v.id)})">Comparer avec…</button>`:''}
    </div>`).join('')}`);

  _majDemandesVideo();
  renderCoachSessionRecap(c);
  renderCoachMicroSection(c);
  renderCoachNutriSection(c);
  renderCoachSuppSection(c);
  try{ renderCoachEvictionsSection(c); }catch(e){}
  try{ renderCoachTraitementsSection(c); }catch(e){}
  try{ renderCoachAmplitudesSection(c); }catch(e){}
  renderCoachCaffeineSection(c);
  try{ renderBatterieCoach(c); }catch(e){}
  try{ renderSommeilCoach(c); }catch(e){}
  try{ renderPasCoach(c); }catch(e){}
  if(!_refresh) go('s-coach-client');
  // Sync immédiat puis rafraîchi automatique (sans bouton)
  if(!_refresh && CLOUD.ok()){
    CLOUD.syncRelevantUsers().then(()=>{
      if(currentClientId===cid) openClientDetail(cid,true);
    }).catch(()=>{});
  }
}

// ── Demander une vidéo, côté coach ─────────────────────────────────────────
// Même chemin d'écriture et de push que la semaine de décharge : la carte des
// utilisateurs, getOwnedClient pour le contrôle d'appartenance, DB.set puis
// CLOUD.pushOne. Aucun canal neuf, et rien qui déclenche une notification.
// LA VIGNETTE D'UNE VIDEO. Deux formes possibles, une seule sortie.
//
// UN FICHIER EST SON PROPRE APERCU : preload="metadata" ne descend que
// l'en-tete du fichier — pas la video — et #t=0.1 demande la premiere image
// plutot qu'un rectangle noir, sans quoi Safari ne peint rien tant qu'on n'a
// pas touche le lecteur. LE MUET N'EST PAS COSMETIQUE : sans lui, iOS refuse
// de peindre l'image d'une video qu'il n'a pas le droit de jouer.
//
// ⚠ AUCUNE VIGNETTE POUR UNE VIDEO YOUTUBE, ET C'EST DELIBERE. img.youtube.com
// aurait donne une image toute faite, mais elle serait demandee A L'OUVERTURE
// DE LA FICHE, pour six lignes d'un coup, sans que personne ait touche quoi que
// ce soit — et privacy.html promet exactement le contraire, en toutes lettres :
// « rien n'est demande a YouTube tant que vous n'avez pas touche le lien ».
// Cette promesse vaut plus qu'une image de 320 px. Le lien YouTube garde donc
// le cartouche neutre, et le lecteur reste dans l'ecran de correction, ou le
// coach a choisi d'aller.
function _vignetteVideoHtml(url){
  const vide='<span class="cvv-vig cvv-vig-0" aria-hidden="true">&#9654;</span>';
  const u=String(url||'');
  if(!u) return vide;
  const sr=safeUrl(u);
  if(sr==='#') return vide;
  if(/\.(mp4|mov|webm|mkv)(\?|$)/i.test(u))
    return '<video class="cvv-vig" src="'+sr+'#t=0.1" preload="metadata" muted '
      +'playsinline webkit-playsinline tabindex="-1" aria-hidden="true"></video>';
  return vide;
}
// ⚠ L'HABILLAGE EST CELUI DE LA MAQUETTE DE KEVIN (21/09/2026) : « stylise
//   l'image 1 exactement comme la 2 ». Cadre a liseré rouge, photo d'athlete
//   en fond, titre « DEMANDE DE VIDEO », champ « Exercice concerne » a
//   icone, bouton « Demander la video », devise en marge.
//   La photo est celle de la maquette, decoupee hors de ses elements
//   d'interface (img/demande-video.webp).
//
// ⚠ UNE PHRASE DE LA MAQUETTE N'EST PAS REPRISE, ET C'EST VOULU : « ton
//   athlete recevra une notification ». Aucune notification n'est envoyee —
//   un test l'exige, et le promettre ferait attendre au coach un signal qui
//   ne vient jamais. Le pied dit ce qui se passe vraiment.
//
// Les demandes en cours restent la, entre le texte et le champ : sans elles,
// le coach ne pourrait plus en retirer une.
const _DV_ICO_LECTURE='<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor" stroke="none"/></svg>';
const _DV_ICO_ENVOI='<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter"><path d="M21.5 2.5 10.8 13.2"/><path d="M21.5 2.5 14.6 21.3l-3.8-8.1-8.1-3.8z"/></svg>';
const _DV_ICO_INFO='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.6" r=".9" fill="currentColor" stroke="none"/></svg>';
const _DV_ICO_FLECHE='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square" stroke-linejoin="miter"><path d="m6 9 6 6 6-6"/></svg>';
function _htmlDemandesVideo(c){
  const prog=exercicesDuProgramme(c);
  const dem=((c&&c.demandesVideo)||[]).filter(Boolean);
  if(!prog.length&&!dem.length) return '';
  const cours=dem.length?`<div class="dv-cours">
      <span class="dv-cours-t">${dem.length} en cours</span>
      ${dem.map((d,i)=>`<span class="cvv-puce">
        <span class="cvv-puce-n">${escapeHtml(d.exercice)}</span>
        <span class="cvv-puce-d">${dateLocaleDeCle(d.date).toLocaleDateString('fr-FR')}</span>
        <button class="cvd-annul" data-i="${i}" title="Retirer la demande" aria-label="Retirer la demande de ${escapeHtml(d.exercice)}">×</button>
      </span>`).join('')}
    </div>`:'';
  return `<div class="dv">
    <div class="dv-photo" aria-hidden="true"></div>
    <div class="dv-devise" aria-hidden="true"><span>Discipline</span><span>Aujourd’hui</span><span>Résultats</span><span>Demain</span></div>
    <div class="dv-tete">
      <span class="dv-ico" aria-hidden="true">${_DV_ICO_LECTURE}</span>
      <div class="dv-titres"><div class="dv-titre">Demande <em>de vidéo</em></div>
        <div class="dv-sous">Demande à ton athlète de t’envoyer une vidéo</div></div>
    </div>
    <p class="dv-txt">Sélectionne l’exercice pour lequel tu souhaites recevoir une vidéo de réalisation.<br class="dv-br">
      Ton athlète pourra te l’envoyer directement depuis l’application.</p>
    ${cours}
    ${prog.length?`<div class="dv-form">
      <label class="dv-champ">
        <span class="dv-champ-ico" aria-hidden="true">${icon('haltere',26)}</span>
        <span class="dv-champ-c"><span class="dv-champ-l">Exercice concerné</span>
          <select id="cvd-select" aria-label="Exercice à filmer">
            <option value="" disabled selected>Sélectionner un exercice</option>
            ${prog.map((n,i)=>`<option value="${i}">${escapeHtml(n)}</option>`).join('')}
          </select></span>
        <span class="dv-champ-fl" aria-hidden="true">${_DV_ICO_FLECHE}</span>
      </label>
      <button type="button" class="dv-btn" onclick="demanderVideo()">${_DV_ICO_ENVOI}<span>Demander la vidéo</span></button>
    </div>
    <div class="dv-pied">
      <span class="dv-info" aria-hidden="true">${_DV_ICO_INFO}</span>
      <span class="dv-pied-t">Ton athlète la verra dans sa séance et pourra t’envoyer sa vidéo directement depuis l’application. Aucune notification n’est envoyée.</span>
      <span class="dv-slogan" aria-hidden="true">Progresser <b>•</b> Un jour à la fois <i></i></span>
    </div>`
    :`<div class="dv-pied"><span class="dv-pied-t">Aucun exercice dans ses créneaux actifs : il n'y a rien à demander.</span></div>`}
  </div>`;
}
function demanderVideo(){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return;
  if(!c.email){ toast('Cet élève n\'a pas encore de dossier synchronisé','var(--orange)'); return; }
  const sel=document.getElementById('cvd-select');
  // LE CHAMP S'OUVRE SUR « Selectionner un exercice », comme la maquette : sans
  // choix, on le dit — la suite aurait repondu « pas dans son programme ».
  if(sel&&sel.value===''&&sel.selectedIndex<=0&&sel.options[0]&&sel.options[0].value===''){
    toast('Choisis d’abord un exercice','var(--orange)'); return;
  }
  const prog=exercicesDuProgramme(c);
  const nom=prog[parseInt(sel&&sel.value,10)];
  // Une demande hors programme est REFUSÉE : l'athlète ne verrait jamais la
  // ligne en séance, et la demande resterait en attente pour toujours.
  if(!nom||!estDansLeProgramme(nom,c)){ toast('Cet exercice n\'est pas dans son programme','var(--orange)'); return; }
  if(!Array.isArray(c.demandesVideo)) c.demandesVideo=[];
  if(demandeVideoPour(nom,c)){ toast('Demande déjà en cours pour cet exercice','var(--orange)'); return; }
  c.demandesVideo.push({exercice:nom,date:Date.now(),parQui:currentUser.id});
  users[c.email]=c;
  const ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(c.email,c);
  _majDemandesVideo();
  toastSync(ok,envoi,'Vidéo demandée : '+nom,'la demande est');
}
function annulerDemandeVideo(i){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c||!Array.isArray(c.demandesVideo)||!c.demandesVideo[i]) return;
  const nom=c.demandesVideo[i].exercice;
  c.demandesVideo.splice(i,1);
  users[c.email]=c;
  const ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(c.email,c);
  _majDemandesVideo();
  toastSync(ok,envoi,'Demande retirée : '+nom,'le retrait est');
}
// Repeint la seule zone concernée, et recâble les croix en JS : un index dans
// un attribut onclick tiendrait, mais la liste est reconstruite à chaque fois
// et le décalage d'index serait invisible à la relecture.
function _majDemandesVideo(){
  const z=document.getElementById('ccd-demandes-video');
  if(!z) return;
  const c=getOwnedClient(currentClientId);
  z.innerHTML=c?_htmlDemandesVideo(c):'';
  z.querySelectorAll('.cvd-annul').forEach(b=>{
    const i=parseInt(b.getAttribute('data-i'),10);
    b.onclick=()=>annulerDemandeVideo(i);
  });
}

// PURE. Les codes qui appartiennent à cet athlète.
//
// L'ADRESSE D'ABORD : c'est l'identité, et elle ne bouge pas quand le coach
// corrige une faute de frappe dans le nom. Le nom normalisé ne sert QU'aux
// codes émis avant que `athleteEmail` ne soit écrit.
//
// Et quand `athleteEmail` est présent mais ne correspond pas, on ne retombe
// PAS sur le nom : deux homonymes fermeraient le code l’un de l’autre.
function _codesDeLAthlete(codes,athlete){
  const email=String((athlete||{}).email||'').toLowerCase();
  const nom=exKey(((athlete||{}).fname||'')+' '+((athlete||{}).lname||''));
  return (codes||[]).filter(c=>{
    if(!c) return false;
    if(c.athleteEmail) return !!email&&String(c.athleteEmail).toLowerCase()===email;
    return !!nom&&exKey(c.studentName||'')===nom;
  });
}
// LE CODE TOMBE AVEC LE RATTACHEMENT.
//
// Sans cela, getClients relisait le code resté actif et recréait un élève
// fantôme `_code_...` : l'élève « retiré » revenait dans la liste au rendu
// suivant, avec le badge « En attente d’inscription ».
//
// Et le code restait OUVERT côté serveur : il pouvait encore servir à se
// rattacher à ce coach. On le ferme donc D’ABORD, et sur /rc_codes — même
// discipline que toggleStudentCode. Si le serveur refuse, RIEN n'est retiré :
// un élève détaché dont le code fonctionne encore serait le même défaut,
// simplement déplacé.
async function confirmDeleteClient(){
  const cible=getOwnedClient(currentClientId);
  if(!cible) return;
  const estCode=currentClientId.startsWith('_code_');
  // Les codes déjà fermés ne sont pas re-touchés : inutile d’exiger le réseau
  // pour refermer une porte déjà close.
  const codes=(estCode
    ? (currentUser.studentCodes||[]).filter(c=>c&&('_code_'+c.codeId)===currentClientId)
    : _codesDeLAthlete(currentUser.studentCodes,cible)).filter(c=>c.active!==false);
  const _phrase=codes.length
    ? '\nSon code d\'accès sera désactivé : il ne pourra plus s\'en servir pour se rattacher à toi.'
    : '';
  if(!await rcConfirm('Retirer cet élève de ton suivi ?\nSon compte reste actif mais il ne sera plus associé à ton coaching.'+_phrase,null,'Retirer')) return;
  // LE SERVEUR D’ABORD. Un code sans jeton n’a pas de nœud à fermer — il date
  // d’avant leur enregistrement — et ne bloque donc rien.
  for(const code of codes){
    if(!code.token) continue;
    if(!await _majActifDistant(code.token,false)){
      toast('Impossible de désactiver son code d\'accès : vérifie ta connexion. L\'élève n\'a PAS été retiré.','var(--red)');
      return;
    }
  }
  let ok=true,envoi=Promise.resolve();
  if(estCode){
    // Élève code uniquement → supprimer le code
    const codeId=currentClientId.replace('_code_','');
    currentUser.studentCodes=(currentUser.studentCodes||[]).filter(c=>c.codeId!==codeId);
    ok=saveUser();
  } else {
    // Élève enregistré → détacher du coach
    const users=DB.get('users')||{};
    const athlete=Object.values(users).find(u=>u.id===currentClientId);
    if(athlete){
      athlete.coachId=null;athlete.coachName=null;athlete.coachCode=null;
      // ⚠ coachEmailKey AUSSI, ET C'EST CE QUI MANQUAIT. _estMonAthlete
      // reconnait un athlete par coachId OU par coachEmailKey : effacer le
      // premier en laissant le second, c'est ne rien effacer du tout. L'eleve
      // « retire » revenait dans la liste au rendu suivant, et le coach
      // accumulait des profils qu'il croyait avoir sortis — d'ou les doublons
      // et les inactifs en trop.
      //
      // Le serveur, lui, etait deja propre : pushOne met coachEmailKey a null
      // des que coachId est vide. Le commentaire d'a cote le disait, mais la
      // COPIE LOCALE gardait la clef, et c'est elle que la liste relit.
      athlete.coachEmailKey=null;
      athlete.updatedAt=Date.now();
      users[athlete.email]=athlete;
      ok=DB.set('users',users);
      // Cet envoi porte la révocation : c'est lui qui efface coachEmailKey côté
      // serveur, et donc le droit d'accès de l'ex-coach au dossier de santé.
      // Tant qu'il n'a pas abouti, le détachement n'est que cosmétique.
      envoi=CLOUD.pushOne(athlete.email,athlete);
      // Et il sort de la liste du coach : plus de suppression de ses médias.
      try{ CLOUD.inscrireClientCoach(athlete.email,false).catch(()=>{}); }catch(e){}
    }
    // Le serveur a accepté : la liste du coach peut suivre. Sans cette ligne,
    // getClients recréerait l’élève fantôme au prochain rendu.
    codes.forEach(c=>{c.active=false;});
    // Nettoyer les refs côté coach
    if(currentUser.clients) currentUser.clients=currentUser.clients.filter(id=>id!==currentClientId);
    if(currentUser.seenBilans) delete currentUser.seenBilans[athlete?.email];
    ok=saveUser()&&ok;
  }
  go('s-coach-home');loadCoachHome();
  toastSync(ok,envoi,'Élève retiré du suivi','le retrait est');
}
// PURE. Un dossier VIDE : ni séance, ni bilan, ni mesure. C'est la coquille
// d'un profil créé par erreur — un doublon de saisie — et rien d'autre.
// Le distinguer change la question posée : on ne fait pas retaper un nom pour
// jeter une coquille vide.
function _dossierVide(c){
  if(!c) return true;
  const n=x=>Array.isArray(x)?x.length:0;
  return !n(c.sessions)&&!n(c.bilans)&&!n(c.weightLog)&&!n(c.videos)
    &&!n(c.mensurations)&&!n(c.photos);
}
// ══ EFFACER DEFINITIVEMENT LE DOSSIER D'UN ATHLETE ═══════════════════════
//
// ⚠ CE NE SONT PAS LES DONNEES DU COACH. Ce sont les seances, les bilans,
// les mesures et les photos d'une personne, et il n'y a pas de corbeille :
// une fois le noeud supprime dans la base, rien ne le rend.
//
// « Retirer du suivi » reste le geste normal, et il est juste a cote : il
// coupe le lien, l'athlete garde son compte, et il peut revenir avec un
// nouveau code. La suppression n'existe que pour ce que « retirer » ne
// nettoie pas — un profil cree en double, jamais utilise.
//
// DEUX PORTES, SELON CE QU'IL Y A DEDANS :
//   • dossier VIDE : une confirmation, et c'est parti. Faire retaper un nom
//     pour jeter une coquille vide, c'est apprendre au coach a taper sans
//     lire — et le jour ou le dossier n'est pas vide, il tapera pareil.
//   • dossier QUI PORTE QUELQUE CHOSE : il faut retaper le prenom. Ce n'est
//     pas une formalite, c'est le seul moment ou le nom de la personne est
//     relu avant que ses donnees partent.
async function supprimerAthleteDefinitivement(){
  const cible=getOwnedClient(currentClientId);
  if(!cible) return false;
  // UN ELEVE QUI N'EXISTE QUE PAR SON CODE N'A PAS DE DOSSIER A SUPPRIMER :
  // il n'a jamais cree de compte. Retirer le code suffit, et c'est ce que
  // « Retirer du suivi » fait deja — on y renvoie plutot que de faire semblant.
  if(String(currentClientId||'').startsWith('_code_')){
    toast('Cet élève n\'a pas encore de compte : « Retirer du suivi » suffit à '
      +'effacer son invitation.','var(--orange)');
    return false;
  }
  const nom=((cible.fname||'')+' '+(cible.lname||'')).trim()||cible.email||'cet athlète';
  const vide=_dossierVide(cible);
  if(vide){
    if(!await rcConfirm('Effacer définitivement le dossier de '+nom+' ?\n\n'
      +'Ce dossier ne porte aucune séance ni aucun bilan. Il sera supprimé de la '
      +'base, et son compte ne pourra plus servir.',null,'Effacer')) return false;
  } else {
    const attendu=(cible.fname||'').trim();
    const saisi=await rcSaisie('Effacer définitivement le dossier de '+nom+' ?\n\n'
      +'Ses séances, bilans, mesures et photos seront SUPPRIMÉS de la base. '
      +'Ce sont ses données, et rien ne les rendra.\n\n'
      +'Retape son prénom ('+attendu+') pour confirmer.','',
      {libelleOk:'Effacer définitivement'});
    if(saisi===null) return false;
    if(exKey(saisi)!==exKey(attendu)){
      toast('Le prénom ne correspond pas : rien n\'a été supprimé.','var(--orange)');
      return false;
    }
  }
  // LE SERVEUR D'ABORD, ET TANT QUE LE LIEN EXISTE ENCORE : la regle
  // d'ecriture accorde le droit au coach que le dossier DESIGNE. Nettoyer
  // localement avant, ce serait perdre le droit de supprimer a distance.
  const parti=await CLOUD.supprimerDossier(cible.email);
  if(!parti){
    toast('Impossible de supprimer le dossier dans la base : vérifie ta '
      +'connexion. RIEN n\'a été supprimé.','var(--red)');
    return false;
  }
  // Le serveur a accepte : l'appareil peut suivre.
  const users=DB.get('users')||{};
  for(const k of Object.keys(users)){
    const u=users[k];
    if(u&&(u.id===currentClientId||(cible.email&&u.email===cible.email))) delete users[k];
  }
  let ok=DB.set('users',users);
  // Les codes qui menaient a lui n'ont plus de destination.
  const codes=_codesDeLAthlete(currentUser.studentCodes,cible);
  for(const code of codes){
    if(code.token) await _majActifDistant(code.token,false);
    code.active=false;
  }
  if(currentUser.clients) currentUser.clients=currentUser.clients.filter(id=>id!==currentClientId);
  if(currentUser.seenBilans) delete currentUser.seenBilans[cible.email];
  // Ses étiquettes et son dernier contact partent avec lui.
  try{ etiquettesOublierAthlete(currentUser,currentClientId); }catch(e){}
  ok=saveUser()&&ok;
  currentClientId=null;
  go('s-coach-home');loadCoachHome();
  toast(ok?'Dossier de '+nom+' supprimé':'Dossier supprimé, mais la liste locale n\'a pas pu être enregistrée',
        ok?'var(--green)':'var(--orange)');
  return true;
}
// Bascule des deux volets de l'écran d'évolution coach. Portée au conteneur
// #evo-content : plusieurs écrans utilisent .btn-red, un sélecteur global
// repeindrait des boutons étrangers.
function evoTab(t){
  const root=document.getElementById('evo-content');
  if(!root) return;
  root.querySelectorAll('[data-evo-pane]').forEach(p=>{
    p.style.display=p.dataset.evoPane===t?'':'none';
  });
  root.querySelectorAll('[data-evo-tab]').forEach(b=>{
    const actif=b.dataset.evoTab===t;
    b.classList.toggle('btn-red',actif);
    b.classList.toggle('btn-outline',!actif);
    if(actif) b.setAttribute('aria-current','true'); else b.removeAttribute('aria-current');
  });
}
function viewClientBilans(){
  const c=getOwnedClient(currentClientId);
  if(!c) return;
  if(!c.bilans?.length){toast('Aucun bilan disponible','var(--orange)');return;}
  document.getElementById('evo-title').textContent=c.fname+' : Évolution';
  renderBilanEvolution(c);
  // N3.15 — L'ECRITURE EST ICI, apres le rendu et sur un GESTE : le coach
  // vient d'ouvrir l'evolution de son athlete. Le rendu, lui, peut etre
  // rappele par le rafraichissement periodique sans rien ecrire.
  try{ _ecrireTailleDeduite(); }catch(e){}
  go('s-coach-bilan-evo');
}

function addBilanPhoto(bilanDate,bilanType,view,inputEl){
  const file=inputEl.files[0];
  if(!file)return;
  // Compression AVANT tout stockage, comme uploadAthletePhoto et l'avatar coach.
  // Une photo de téléphone de 8 Mo devient un dataURL d'environ 11 Mo une fois
  // encodée en base64 : le double du quota localStorage à elle seule, et elle
  // était écrite DEUX fois (nœud utilisateur + clé rc_photo_). 1080×1440
  // conserve le cadrage portrait des photos de progression.
  // Pas de garde-fou sur file.size ici, contrairement aux avatars : c'est
  // justement une photo d'appareil photo, et la compresser est le travail de
  // cette fonction, pas la refuser.
  // ⚠ PLUS UN SEUL OCTET D'IMAGE DANS LE DOCUMENT (build 1421). Cette fonction
  //   ecrivait le data-URL de 1080x1440 — 374 Ko mesures — DANS le bilan, puis
  //   une SECONDE copie sous rc_photo_. Le document partait ensuite en entier a
  //   chaque synchronisation, avec une recompression de chaque photo au passage.
  //   Desormais : un Blob dans IndexedDB, un envoi chez l'hebergeur, et une
  //   REFERENCE de soixante-dix octets dans le bilan.
  (async()=>{
    const users=DB.get('users')||{};
    const cl=getOwnedClient(currentClientId,users);
    if(!cl)return;
    const bil=cl.bilans?.find(b=>b.date===bilanDate&&b.type===bilanType);
    if(!bil)return;
    const r=await photoBilanEnregistrer(cl,bil,view,file);
    if(!r.ok){ toast(r.raison||'Photo non enregistree','var(--orange)'); return; }
    cl.updatedAt=Date.now(); users[cl.email]=cl;
    const localOk=DB.set('users',users);
    renderBilanEvolution(cl);
    try{ photoBilanHydrater(); }catch(e){}
    // ON DIT CE QUI S'EST PASSE. Une photo gardee sur l'appareil mais pas encore
    // transmise n'est pas une photo ajoutee : le coach ne la verra pas encore.
    if(!r.transmise){ toast(r.raison,'var(--orange)'); return; }
    toastSync(localOk,CLOUD.pushOne(cl.email,cl),'Photo ajoutée','la photo est');
  })();
}

function drawLineChart(canvas,datasets,labels){
  if(!canvas)return;
  // MEME DEFAUT que le graphique cafeine, meme correction : le canevas etait
  // dimensionne en pixels CSS puis etire par le navigateur. Sur un ecran a 3x,
  // les courbes de poids et de masse grasse sortaient floues.
  const _dpr=Math.min(window.devicePixelRatio||1,3);
  const W=canvas.parentElement.offsetWidth||300,H=160;
  canvas.width=Math.round(W*_dpr);
  canvas.height=Math.round(H*_dpr);
  canvas.style.width=W+'px';
  canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d');
  // Les coordonnees restent en unites CSS : l echelle est portee ici, une fois.
  ctx.setTransform(_dpr,0,0,_dpr,0,0);
  ctx.clearRect(0,0,W,H);
  const pad={t:16,b:28,l:36,r:12};
  const cw=W-pad.l-pad.r,ch=H-pad.t-pad.b;
  // Compute global min/max across all datasets
  const allVals=datasets.flatMap(d=>d.data.filter(v=>v>0));
  if(!allVals.length)return;
  // ANIMATION 9. Cette fonction ne passe pas par _setupCanvas : sans ce
  // rappel-ci, les graphiques du bilan seraient les seuls à ne pas se tracer.
  //
  // APRES LE TEST, ET PAS AVANT. Le drapeau et la trame etaient poses en tete de
  // fonction, donc AUSSI quand il n'y a rien a tracer — un athlete sans pesee
  // faisait jouer une traversee sur un canevas vide. Le drapeau promet « celle-ci
  // sera peinte » ; le poser sur un canevas qui sort une ligne plus bas en fait
  // une promesse fausse, et arcTracerCourbes depense une frame a la tenir.
  const mn=Math.min(...allVals),mx=Math.max(...allVals);
  canvas.dataset.arcPret='1';
  try{ requestAnimationFrame(()=>arcTracerCourbes(canvas)); }catch(e){}
  const range=mx-mn||1;
  const yMin=mn-range*0.12,yMax=mx+range*0.12;
  // Grid
  // MEME CONTRAT VISUEL QUE _drawLineSeries : le socle est plein, les reperes
  // intermediaires en pointilles. Deux graphiques du meme produit ne peuvent
  // pas se lire differemment selon qu'on est coach ou athlete.
  ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y=pad.t+ch*(1-i/4);
    ctx.strokeStyle=(i===0?'#333':'#242424');
    ctx.setLineDash(i===0?[]:[3,4]);
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+cw,y);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='#4a4a4a';ctx.font='600 9px Montserrat,sans-serif';
    ctx.textAlign='right';ctx.fillText(Math.round(yMin+(yMax-yMin)*i/4),pad.l-3,y+3);
  }
  // X labels
  const n=labels.length;
  labels.forEach((lbl,i)=>{
    const x=pad.l+(n<2?cw/2:cw*i/(n-1));
    ctx.fillStyle='#5a5a5a';ctx.font='700 9px Montserrat,sans-serif';ctx.textAlign='center';
    ctx.fillText(lbl,x,H-6);
  });
  // Lines
  datasets.forEach(ds=>{
    const pts=ds.data.map((v,i)=>({
      x:pad.l+(n<2?cw/2:cw*i/(n-1)),
      y:pad.t+ch*(1-(v-yMin)/(yMax-yMin)),
      ok:v>0
    }));
    // LE REMPLISSAGE, POUR LA SEULE SERIE DE MARQUE. Le degrade sous la courbe
    // dit « c'est celle-ci qu'on suit » ; l'appliquer a toutes le dirait de
    // personne. Base = pad.t+ch, le socle de la grille.
    const _ok=pts.filter(p=>p.ok);
    if(ds.color===ROUGE_MARQUE&&_ok.length>1){
      const _hauts=Math.min.apply(null,_ok.map(q=>q.y));
      const _g=ctx.createLinearGradient(0,_hauts,0,pad.t+ch);
      _g.addColorStop(0,ds.color+'5c');_g.addColorStop(.5,ds.color+'26');_g.addColorStop(1,ds.color+'0a');
      ctx.beginPath();ctx.moveTo(_ok[0].x,pad.t+ch);
      _ok.forEach(q=>ctx.lineTo(q.x,q.y));
      ctx.lineTo(_ok[_ok.length-1].x,pad.t+ch);ctx.closePath();
      ctx.fillStyle=_g;ctx.shadowBlur=0;ctx.fill();
    }
    // La lueur est portee par l'ombre du contexte, comme dans _drawLineSeries :
    // sur un fond noir, un trait net parait imprime, un trait qui rayonne
    // parait allume.
    ctx.beginPath();ctx.strokeStyle=ds.color;ctx.lineWidth=2.5;
    ctx.lineJoin='round';ctx.lineCap='round';
    ctx.shadowColor=ds.color;ctx.shadowBlur=9;
    let started=false;
    pts.forEach(p=>{if(!p.ok)return;if(!started){ctx.moveTo(p.x,p.y);started=true;}else ctx.lineTo(p.x,p.y);});
    ctx.stroke();
    ctx.shadowBlur=0;
    pts.forEach(p=>{if(!p.ok)return;
      ctx.beginPath();ctx.arc(p.x,p.y,4,0,2*Math.PI);ctx.fillStyle=ds.color;ctx.fill();
      ctx.beginPath();ctx.arc(p.x,p.y,4,0,2*Math.PI);
      ctx.strokeStyle='#0b0b0b';ctx.lineWidth=1.5;ctx.stroke();});
  });
}

// N3.15 — La taille deduite d'un bilan, retenue par le rendu et ecrite par
// _ecrireTailleDeduite, qu'openClientDetail appelle APRES avoir rendu. Deux
// gestes distincts parce qu'un rendu qui ecrit est un rendu qu'on ne peut plus
// appeler librement — et celui-ci est rappele toutes les cinq minutes.
let _tailleARetenir=null;
function _ecrireTailleDeduite(){
  const t=_tailleARetenir;
  _tailleARetenir=null;
  if(!t||!t.id||!(t.height>0)) return false;
  try{
    const users=DB.get('users')||{};
    const at=Object.values(users).find(u=>u.id===t.id);
    // RELUE AU MOMENT D'ECRIRE : entre le rendu et ici, une synchronisation a
    // pu descendre un dossier qui porte deja la taille.
    if(!at||at._evol_height||at['init-height']) return false;
    if(!_estMonAthlete(at,currentUser)) return false;
    at._evol_height=t.height;
    at.updatedAt=Date.now();
    users[at.email]=at;
    DB.set('users',users);
    CLOUD.pushOne(at.email,at);
    return true;
  }catch(e){ return false; }
}
// N3.16 — « BILAN 3 » DOIT DESIGNER LE MEME RELEVE DES DEUX COTES.
// Le coach lisait c.bilans TEL QUEL et nommait ses colonnes par position dans
// le tableau ; l'athlete triait par date. _mergeUser trie lui aussi, mais
// toute ecriture locale posterieure ajoute EN FIN de tableau : un bilan
// antidate s'intercalait en position 2 chez l'athlete et restait en 3 chez le
// coach. Les deux commentaient « le bilan 3 » en designant deux releves
// differents.
// Un seul ordre, un seul filtre, une seule fonction. Aucun calcul de
// mensuration n'est touche : c'est l'ORDRE de lecture qui est unifie.
function bilansOrdonnes(u){
  return _comblerMensurations(
    ((u&&u.bilans)||[]).filter(b=>b&&b.date).slice().sort((a,b)=>a.date-b.date));
}
// PURE. Les trous de mensuration comblés par la dernière valeur RELEVÉE.
//
// Kevin, 26/08/2026 : « ce qui est troué, c'est exactement le même que le
// bilan précédent, donc fais en sorte que les chiffres se mettent. » Le
// correctif d'enregistrement ne vaut que pour les bilans à venir : ceux déjà
// au dossier ont perdu leurs reprises au moment où ils ont été validés, et un
// biceps à 44 cm inchangé depuis le bilan d'avant y reste un « — ».
//
// ON NE RÉÉCRIT RIEN. C'est une lecture : les bilans du dossier ne bougent
// pas, on rend des COPIES comblées. Rien ne remonte au serveur, et le jour où
// la vraie mesure arrive elle prend simplement la place du report.
//
// TROIS BORNES, parce que combler un trou, c'est affirmer quelque chose :
//   • JAMAIS LE POIDS. Il alimente une moyenne mobile et une vitesse dont sort
//     un ajustement calorique ; un poids reporté y ferait un point neuf. Les
//     mensurations, elles, ne se lisent que d'un bilan à l'autre.
//   • LA VALEUR VIENT DU DERNIER RELEVÉ, jamais d'un report : sans quoi un
//     report comblerait le suivant, de proche en proche, et la borne ci-dessous
//     ne tomberait jamais.
//   • BIL_REPRISE_MAX_JOURS. C'est déjà la réponse de l'app à « combien de
//     temps une mesure peut-elle tenir lieu de la mesure d'aujourd'hui »,
//     posée pour le pré-remplissage du formulaire. Au-delà de deux mois le
//     trou reste un trou : dire « rien n'a bougé » sur six mois serait une
//     affirmation, pas un report.
//
// ET CHAQUE VALEUR COMBLÉE EST MARQUÉE dans `reprises` — la même trace que
// pose l'enregistrement. Les deux tableaux l'écrivent en gris : elle compte
// pour lire une stagnation, elle ne se donne jamais pour un relevé du jour.
function _comblerMensurations(l){
  if(!l||l.length<2) return l||[];
  const limite=BIL_REPRISE_MAX_JOURS*24*3600*1000;
  const out=l.slice();
  // Dernier relevé RÉEL de chaque mesure : {valeur, date}.
  const vus={};
  for(let i=0;i<out.length;i++){
    let b=out[i],copie=false;
    for(const m of MEAS){
      const v=getBM(b,m.k);
      if(v!=null){
        // Un report déjà marqué ne devient pas une référence.
        if(!bmReportee(b,m.k)) vus[m.k]={v,date:Number(b.date)};
        continue;
      }
      const src=vus[m.k];
      if(!src||Number(b.date)-src.date>limite) continue;
      if(!copie){ b=Object.assign({},b); b.reprises=(b.reprises||[]).slice(); out[i]=b; copie=true; }
      b['bil-'+m.k]=String(src.v);
      if(b.reprises.indexOf('bil-'+m.k)<0) b.reprises.push('bil-'+m.k);
    }
  }
  return out;
}
function renderBilanEvolution(c){
  const bilans=bilansOrdonnes(c);
  const maxB=bilans.length;
  // Height: chercher dans le profil, puis dans tous les bilans (pris une fois, valable à vie)
  const deb=bilans.find(b=>b.type==='depart');
  const heightFromBilans=bilans.map(b=>parseFloat(b['deb-height']||b['bil-height']||0)).find(h=>h>100)||0;
  const height=parseFloat(c._evol_height||c['init-height']||c.height||deb?.['deb-height']||c['deb-height']||heightFromBilans||0);
  // N3.15 — UN RENDU N'ECRIT PLUS DANS LE DOSSIER, ET NE POUSSE PLUS.
  // Cette ligne ecrivait _evol_height, posait updatedAt, enregistrait et
  // poussait au serveur — depuis une fonction d'AFFICHAGE, rappelee par le
  // rafraichissement de cinq minutes. Une fiche laissee ouverte produisait
  // donc des requetes d'ecriture toutes les cinq minutes, et l'horodatage
  // qu'elle posait etait le seul effet de bord reseau declenche par un simple
  // affichage dans tout le perimetre coach.
  // LA FONCTIONNALITE RESTE : une taille trouvee dans un bilan finit toujours
  // sur le profil — mais par une ecriture EXPLICITE, hors du chemin de rendu.
  // C'est la regle que le fichier applique deja ailleurs.
  if(height&&!c._evol_height&&!c['init-height']) _tailleARetenir={id:c.id,height};
  const gender=c._evol_gender||c.gender||'H';
  const female=isFemale(gender);

  // Measurements list
  const MEAS=[
    {key:'bicep-r',label:'Tour de biceps D',color:ROUGE_MARQUE},
    {key:'bicep-l',label:'Tour de biceps G',color:'#f97316'},
    {key:'chest',label:'Tour de poitrine',color:'#eab308'},
    {key:'waist',label:'Tour de taille',color:'#3b82f6'},
    {key:'hips',label:'Tour de hanche',color:'#38bdf8'},
    {key:'glutes',label:'Tour de fessier',color:'#22c55e'},
    {key:'thigh-r',label:'Tour de cuisse D',color:'#06b6d4'},
    {key:'thigh-l',label:'Tour de cuisse G',color:'#14b8a6'},
    {key:'calf-r',label:'Tour de Mollet D',color:'#f472b6'},
    {key:'calf-l',label:'Tour de Mollet G',color:'#a78bfa'},
    {key:'bust',label:'Tour de buste',color:'#fb923c'},
    {key:'neck',label:'Tour de cou',color:'#94a3b8'},
  ];

  // Groups for mini charts
  const GROUPS=[
    {label:'Biceps',keys:['bicep-r','bicep-l'],colors:[ROUGE_MARQUE,'#f97316']},
    {label:'Tour de poitrine',keys:['chest'],colors:['#eab308']},
    {label:'Tour de taille',keys:['waist'],colors:['#3b82f6']},
    {label:'Tour de hanche',keys:['hips'],colors:['#38bdf8']},
    {label:'Tour de fessier',keys:['glutes'],colors:['#22c55e']},
    {label:'Tour de cuisses',keys:['thigh-r','thigh-l'],colors:['#06b6d4','#14b8a6']},
    {label:'Tour de mollets',keys:['calf-r','calf-l'],colors:['#f472b6','#a78bfa']},
    {label:'Tour de buste',keys:['bust'],colors:['#fb923c']},
  ];

  // Get value for bilan index (1-indexed)
  const bVal=(b,k)=>getBM(b,k)||0;

  // Build bilan headers (1→N)
  const bHeaders=Array.from({length:maxB},(_,i)=>`Bilan ${i+1}`);

  // ── Table des mensurations ──────────────────────────────────────────
  const buildMeasTable=()=>{
    // LA COLONNE D'ECART FERME LA TABLE : elle porte le dernier bilan, et
    // c'est la derniere chose qu'on lit apres avoir parcouru la ligne.
    const columns=['Parties mesurées',...bHeaders,'Écart'];
    const rows=MEAS.map(m=>({
      label:m.label,labelBg:m.color||'var(--border)',labelColor:'var(--text)',
      values:Array.from({length:maxB},(_,i)=>{const v=bilans[i]?bVal(bilans[i],m.key):0;return v||null;})
        .concat([(()=>{ try{ return _cellEcartMensuration(bilans,m.key); }catch(e){ return null; } })()]),
      // REPORTÉE, DONC GRISE — cote coach aussi. C'est lui qui lit la
      // stagnation, et il doit distinguer d'un coup d'oeil une mesure reprise
      // d'un relevé du jour.
      valueStyleFn:(v,ci,empty)=>ci>=maxB
        ? (empty?'background:var(--bg);color:var(--sub);':'background:var(--dark);color:var(--sub);')
        : (empty?'background:var(--bg);color:var(--sub);'
          :('background:var(--dark);color:'
            +(bilans[ci]&&bmReportee(bilans[ci],m.key)?'var(--text-faint)':'var(--text)')+';'))
    }));
    return renderDataTable(columns,rows,{stickyCol0:true,firstColMinWidth:'130px',pad:'4px 6px',mb:'24px'})
      +(bilans.some(b=>b&&MEAS.some(m=>bmReportee(b,m.key)))
        ?`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin:-20px 0 24px">
           Les valeurs en gris ont été reportées du bilan précédent, sans être
           re-mesurées : l'athlète a confirmé qu'elles n'avaient pas bougé.</div>`:'');
  };

  // ── Mini graphiques par groupe ──────────────────────────────────────
  const buildGroupCharts=()=>{
    const labels=bilans.map((_,i)=>`${i+1}`);
    // ⚠ minmax(0,1fr) ET NON 1fr. Mesure en 375 px : la grille sortait de
    //   l'ecran de 134 px et faisait glisser TOUTE la fiche de cote, en-tete
    //   compris. La raison est un classique : `1fr` vaut `minmax(auto,1fr)`, et
    //   `auto` ne descend jamais sous la largeur minimale du contenu — ici un
    //   canvas auquel _setupCanvas a pose une largeur en pixels au rendu
    //   precedent. La colonne restait donc bloquee a 250 px sur un telephone
    //   qui n'en offre que 161. minmax(0,…) autorise la colonne a retrecir, et
    //   le canvas se remesure au rendu suivant.
    return `<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;margin-bottom:24px">`+
      GROUPS.map((g,gi)=>`<div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-3);padding:10px">
        <div style="font-size:var(--fs-xs);font-weight:800;color:${g.colors[0]};text-align:center;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">${g.label}</div>
        <canvas id="evo-chart-${gi}" style="width:100%;max-width:100%;display:block"></canvas>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:4px;flex-wrap:wrap">
          ${g.keys.map((k,ki)=>`<span style="font-size:var(--fs-xs);color:${g.colors[ki]};font-weight:700"> - ${k.endsWith('-r')?'Droit':k.endsWith('-l')?'Gauche':g.label}</span>`).join('')}
        </div>
      </div>`).join('')+`</div>`;
  };

  // ── Evolution du poids ─────────────────────────────────────────────
  const buildWeightSection=()=>{
    return `
      <div style="font-size:var(--fs-xs);font-weight:800;color:var(--red-text);text-align:center;margin-bottom:8px;text-transform:uppercase;letter-spacing:2px">EVOLUTION DU POIDS EN KG</div>
      <div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-3);padding:12px;margin-bottom:12px">
        <canvas id="evo-weight-chart" style="width:100%;display:block"></canvas>
      </div>
      ${renderDataTable(
        ['Bilan',...bHeaders],
        [{label:'Poids en kg',labelBg:'var(--surface-2)',labelColor:'var(--red)',
          values:Array.from({length:maxB},(_,i)=>bilans[i]?getBW(bilans[i])||null:null)}],
        {stickyCol0:true,firstColMinWidth:'100px',pad:'5px 6px',dataPad:'4px 6px',mb:'24px',emptyColor:'var(--sub)'}
      )}`;
  };

  // ── % Masse grasse + masse maigre ──────────────────────────────────
  const buildFatSection=()=>{
    // 05/10/2026 : une masse grasse MESURÉE à ±3 jours du bilan passe devant
    // l'estimation US Navy, et le tableau dit laquelle (mgMasquee : comme le poids).
    const _mgU=_dossier(c)||c||null;
    const bfVals=bilans.map(b=>{
      const w=getBW(b),waist=getBM(b,'waist'),neck=getBM(b,'neck'),hips=getBM(b,'hips');
      let mes=null; try{ if(_mgU&&!mgMasquee(_mgU)) mes=_mgMesureAutour(_mgU,localISODate(new Date(b.date))); }catch(e){ mes=null; }
      const bf=mes?mes.pct:calcBF(waist,neck,hips,height,gender);
      const mg=bf!==null&&w?Math.round(w*bf/10)/10:null;
      const mm=mg!==null&&w?Math.round((w-mg)*10)/10:null;
      return{bf,mg,mm,w,mes};
    });
    // Formula note
    const formulaNote=`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);padding:12px;margin-bottom:14px;font-size:var(--fs-xs);line-height:1.8">
      <div style="font-size:var(--fs-xs);font-weight:800;text-transform:uppercase;letter-spacing:2px;color:var(--red-text);margin-bottom:6px">Formule US Navy ${female?'(Femme)':'(Homme)'} : Calcul automatique</div>
      ${female
        ?`<div style="color:var(--text-mid);font-family:monospace;font-size:var(--fs-xs)">%MG = 495 / [1,29579 − 0,35004 × log(<b style="color:var(--text)">taille</b> + <b style="color:#69f0ae">hanches</b> − <b style="color:#ffd600">cou</b>) + 0,22100 × log(<b style="color:var(--accent-blue)">hauteur</b>)] − 450</div>
         <div style="color:var(--text-dim);font-size:var(--fs-xs);margin-top:4px">taille = tour de taille · hanches = tour de hanches · cou = tour de cou · hauteur = taille en cm</div>`
        :`<div style="color:var(--text-mid);font-family:monospace;font-size:var(--fs-xs)">%MG = 495 / [1,0324 − 0,19077 × log(<b style="color:var(--text)">taille</b> − <b style="color:#ffd600">cou</b>) + 0,15456 × log(<b style="color:var(--accent-blue)">hauteur</b>)] − 450</div>
         <div style="color:var(--text-dim);font-size:var(--fs-xs);margin-top:4px">taille = tour de taille · cou = tour de cou · hauteur = taille en cm</div>`
      }
      <div style="margin-top:8px;color:var(--sub);font-size:var(--fs-xs);border-top:1px solid var(--border);padding-top:8px"> Précision estimée ±3% par rapport à la réalité. La formule est une estimation : pour un résultat précis, privilégier une pesée hydrostatique ou DEXA.</div>
    </div>`;
    // Pie charts for each bilan (first 3 with data)
    const pieBilans=bfVals.map((b,i)=>b.mg!==null?{idx:i,mg:b.mg,mm:b.mm}:null).filter(Boolean).slice(0,4);
    const pies=pieBilans.length?`<div style="display:flex;gap:12px;overflow-x:auto;margin-bottom:16px;justify-content:center">`+
      pieBilans.map(p=>`<div style="text-align:center;flex-shrink:0">
        <div style="font-size:var(--fs-xs);font-weight:800;margin-bottom:6px">Bilan ${p.idx+1}</div>
        <canvas id="evo-pie-${p.idx}" width="100" height="100"></canvas>
        <div style="font-size:var(--fs-xs);color:var(--red-text);margin-top:4px">MG: ${p.mg}kg</div>
        <div style="font-size:var(--fs-xs);color:var(--text-mid);margin-top:1px">MM: ${p.mm}kg</div>
      </div>`).join('')+`</div>`:'';
    return `
      <div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-3);padding:12px;margin-bottom:12px">
        <div style="font-size:var(--fs-xs);color:var(--text-mid);text-align:center;margin-bottom:6px;text-transform:uppercase;letter-spacing:2px;font-weight:700">% de graisse corporelle</div>
        <canvas id="evo-fat-chart" style="width:100%;display:block"></canvas>
      </div>
      ${formulaNote}${pies}
      ${renderDataTable(
        ['Bilan',...bHeaders],
        [
          {label:'% graisse corporelle',labelBg:'var(--surface-2)',labelColor:'var(--red)',
            values:bfVals.map(b=>{const v=b.bf;return v!==null&&!isNaN(v)?v+'%'+(b.mes?' · '+libMethodeMG({methode:'mesure',type:b.mes.type}):''):null;})},
          {label:'Masse grasse en Kg',labelBg:'var(--surface-2)',labelColor:'var(--red)',
            values:bfVals.map(b=>{const v=b.mg;return v!==null&&!isNaN(v)?String(v):null;})},
          {label:'Masse maigre en Kg',labelBg:'var(--surface-2)',labelColor:'var(--red)',
            values:bfVals.map(b=>{const v=b.mm;return v!==null&&!isNaN(v)?String(v):null;})},
        ],
        {stickyCol0:true,firstColMinWidth:'130px',pad:'5px 6px',dataPad:'4px 6px',mb:'24px',emptyColor:'var(--sub)'}
      )}`;
  };

  // ── Photos évolution ──────────────────────────────────────────────
  const buildPhotos=()=>{
    // N3.14 — DEUX VERSIONS DE LA MEME PHOTO, ET ON DIT LAQUELLE ON REGARDE.
    // addBilanPhoto compresse en 1080x1440 et garde une copie sous
    // rc_photo_<date>_<champ> — une clef LOCALE, qui ne vit que sur l'appareil
    // ou la photo a ete ajoutee. _doPushOne, lui, recompresse toute photo de
    // bilan en 220x300 avant l'envoi : c'est cette version-la que l'athlete
    // voit, et c'est celle qui redescend chez le coach.
    // Le coach jugeait donc une photo de progression sans savoir s'il regardait
    // la haute definition restee sur son appareil ou la version transmise.
    // ON NE RELEVE PAS LA LIMITE DE 220x300 : elle existe pour ne pas saturer
    // le quota, et la bouger sans mesure ferait grossir chaque dossier pousse.
    // On NOMME la version, c'est tout — et le poids du dossier ne change pas
    // d'un octet.
    const getP=(b,t)=>{
      // ⚠ TROIS CAS, ET ON DIT LEQUEL. La reference transmise (une URL chez
      //   l'hebergeur) est visible partout ; le blob local n'existe que sur
      //   l'appareil qui a pris la photo et s'hydrate APRES le rendu ; le
      //   base64 est l'ancien format, encore la tant que la migration n'a pas
      //   tourne. Les trois se ressemblent a l'ecran, et la difference compte
      //   pour qui juge une photo : « version transmise » n'est pas « haute
      //   definition, cet appareil ».
      const ref=photoBilanRef(b,t);
      if(ref&&ref.url) return {src:ref.url,locale:false};
      const src=photoBilanSrc(b,t);
      if(src) return {src:src,locale:!ref};
      if(ref&&ref.cle) return {src:'',cle:ref.cle,locale:true};
      return null;
    };
    const VIEWS=[
      {k:'face',label:'De Face',icon:'user'},
      {k:'back',label:'De Dos',icon:'refresh-cw'},
      {k:'side',label:'De Profil',icon:'↔️'}
    ];
    if(!bilans.length)return'';
    const bilanPhotos=bilans.map((b,i)=>({
      b,i,
      date:dateLocaleDeCle(b.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'2-digit'}),
      photos:{face:getP(b,'face'),back:getP(b,'back'),side:getP(b,'side')}
    }));

    const viewSections=VIEWS.map(v=>{
      const cards=bilanPhotos.map(({b,i,date,photos})=>{
        const _p=photos[v.k];
        const img=_p&&(_p.src||(_p.cle?' ':''));
        const safeCap=(c.fname||'').replace(/'/g,'').replace(/"/g,'')+'  B'+(i+1);
        return img
          ?`<div data-cap="${safeCap}" onclick="openPhotoFull(this.querySelector('img').src,this.dataset.cap)"
              style="flex-shrink:0;cursor:pointer;position:relative;border-radius:var(--r-3);overflow:hidden;background:var(--surface-1);border:1px solid var(--border);width:110px" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
              <div style="position:absolute;top:6px;left:6px;background:#000b;color:var(--text);font-size:var(--fs-xs);font-weight:800;padding:2px 8px;border-radius:var(--r-2);letter-spacing:1px;z-index:1">B${i+1}</div>
              <img src="${srcImageSure(img||'')}"${_p.cle?` data-bil-cle="${escapeHtml(_p.cle)}"`:''} style="width:110px;height:160px;object-fit:cover;display:block;background:var(--surface-1)">
              <div style="padding:6px 6px;font-size:var(--fs-xs);color:var(--sub);font-weight:700;text-align:center">${date}</div>
              <div style="padding:0 6px 6px;font-size:var(--fs-2xs);color:${_p.locale?'var(--orange)':'var(--text-faint)'};text-align:center;line-height:1.3">${_p.locale?'Haute déf., cet appareil':'Version transmise'}</div>
            </div>`
          :`<label style="flex-shrink:0;width:110px;border-radius:var(--r-3);background:var(--surface-2);border:1px dashed var(--red);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;height:180px;cursor:pointer">
              <input type="file" accept="image/*" style="display:none" onchange="addBilanPhoto(${b.date},'${b.type}','${v.k}',this)">
              <div style="font-size:var(--fs-2xl);opacity:.5">${icon('camera',28)}</div>
              <div style="font-size:var(--fs-xs);color:var(--text-mid);font-weight:700">B${i+1}</div>
              <div style="font-size:var(--fs-xs);color:var(--sub)">${date}</div>
              <div style="font-size:var(--fs-xs);color:var(--red-text);text-transform:uppercase;letter-spacing:1px;margin-top:2px">+ Ajouter</div>
            </label>`;
      }).join('');
      return `<div style="margin-bottom:20px">
        <div style="font-size:var(--fs-xs);font-weight:800;color:var(--sub);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;display:flex;align-items:center;gap:6px">
          <span>${icon(v.icon,14)}</span><span>${v.label}</span>
        </div>
        <div style="position:relative"><div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:4px" data-scroll-fade>${cards}</div></div>
      </div>`;
    }).join('');

    return `<div style="margin-top:4px;margin-bottom:28px">
      <div style="font-size:var(--fs-xs);font-weight:800;color:var(--red-text);text-align:center;text-transform:uppercase;letter-spacing:3px;margin-bottom:20px;display:flex;align-items:center;justify-content:center;gap:8px">
        <div style="height:1px;background:color-mix(in srgb,var(--red) 20%,transparent);flex:1"></div>
        FRESQUE ÉVOLUTION
        <div style="height:1px;background:color-mix(in srgb,var(--red) 20%,transparent);flex:1"></div>
      </div>
      ${(()=>{ try{ return htmlBoutonAvantApres(c,'coach'); }catch(e){ return ''; } })()}
      ${viewSections}
    </div>`;
  };

  // ── Assemble HTML ─────────────────────────────────────────────────
  // Deux volets. Jusqu'ici cet écran ne montrait QUE des chiffres : tout ce que
  // l'athlète avait écrit — difficultés, demandes de modification, santé —
  // n'était lisible nulle part côté coach.
  // Le compte des bilans porteurs de réponses est annoncé sur l'onglet : sans
  // lui, rien n'indique qu'il y a quelque chose à lire derrière.
  const _avecRep=(bilans||[]).filter(b=>
    (b.type==='depart'?BILAN_QUESTIONS.depart:BILAN_QUESTIONS.suivi)
      .some(q=>_texteReponse(b[q.k]))).length;
  const html=`<div class="pad" style="padding-bottom:40px">
    <div style="display:flex;gap:8px;margin-bottom:20px">
      <button class="btn btn-red btn-sm" style="flex:1" data-evo-tab="mesures" onclick="evoTab('mesures')">Mesures</button>
      <button class="btn btn-outline btn-sm" style="flex:1" data-evo-tab="reponses" onclick="evoTab('reponses')">Réponses${_avecRep?' ('+_avecRep+')':''}</button>
    </div>
    <div data-evo-pane="mesures">
      ${buildPhotos()}
      <h3 style="margin-bottom:16px;text-align:center">Mensurations</h3>
      ${buildMeasTable()}
      <h3 style="margin-bottom:12px;text-align:center">Évolution par groupe</h3>
      ${buildGroupCharts()}
      ${buildWeightSection()}
      <h3 style="margin-bottom:12px;text-align:center">Composition corporelle</h3>
      ${buildFatSection()}
    </div>
    <div data-evo-pane="reponses" style="display:none">
      ${renderReponsesBilans(bilans,c)}
    </div>
  </div>`;
  document.getElementById('evo-content').innerHTML=html;
  // LES VIGNETTES QUI N'ONT QU'UN BLOB LOCAL S'HYDRATENT APRES LE RENDU : une
  // lecture d'IndexedDB est asynchrone, et ce rendu construit une chaine. Sans
  // cet appel, une photo prise sur CET appareil et pas encore transmise
  // n'apparaitrait pas — elle existe, elle serait juste invisible.
  try{ photoBilanHydrater(document.getElementById('evo-content')); }catch(e){}
  document.querySelectorAll('#evo-content [data-scroll-fade]').forEach(el=>setupScrollFade(el));

  // ── Draw charts after DOM is ready ────────────────────────────────
  requestAnimationFrame(()=>{
    const labels=bilans.map((_,i)=>`${i+1}`);
    // Group charts
    GROUPS.forEach((g,gi)=>{
      const cv=document.getElementById(`evo-chart-${gi}`);
      if(!cv)return;
      const datasets=g.keys.map((k,ki)=>({
        data:bilans.map(b=>getBM(b,k)||0),
        color:g.colors[ki]
      }));
      drawLineChart(cv,datasets,labels);
    });
    // Weight chart
    const wcv=document.getElementById('evo-weight-chart');
    if(wcv) drawLineChart(wcv,[{data:bilans.map(b=>getBW(b)||0),color:'var(--red)'}],labels);
    // Fat chart
    const fcv=document.getElementById('evo-fat-chart');
    if(fcv){
      // DEUX JEUX DE DONNÉES (05/10/2026) : l'estimation US Navy et la mesure,
      // chacun son trait — drawLineChart ne relie que les points d'un même jeu.
      const _u=_dossier(c)||c||null;
      const mes=bilans.map(b=>{ try{ return (_u&&!mgMasquee(_u))?_mgMesureAutour(_u,localISODate(new Date(b.date))):null; }catch(e){ return null; } });
      const bfData=bilans.map((b,i)=>{
        if(mes[i]) return 0;
        const w=getBW(b),waist=getBM(b,'waist'),neck=getBM(b,'neck'),hips=getBM(b,'hips');
        return calcBF(waist,neck,hips,height,gender)||0;
      });
      const ds=[{data:bfData,color:'var(--red)'}];
      if(mes.some(Boolean)) ds.push({data:mes.map(m=>m?m.pct:0),color:'#3b82f6'});
      drawLineChart(fcv,ds,labels);
    }
    // Pie charts
    bilans.forEach((_,i)=>{
      if(!document.getElementById(`evo-pie-${i}`))return;
      const b=bilans[i];
      const w=getBW(b);
      const waist=getBM(b,'waist'),neck=getBM(b,'neck'),hips=getBM(b,'hips');
      const bf=calcBF(waist,neck,hips,height,gender);
      if(bf===null||!w)return;
      const mg=Math.round(w*bf/10)/10;
      const mm=Math.round((w-mg)*10)/10;
      drawPie(`evo-pie-${i}`,[{val:mg,color:'var(--red)'},{val:mm,color:'#444'}]);
    });
  });
}

// ======= COACH PROGRAM EDITOR =======
// ===== PROGRAMME FONDATION — données extraites du PDF =====
const FONDATION_F=[
  {day:'Lundi',name:'SÉANCE A : JAMBES & CUISSES',active:true,photo:null,photo2:null,warmup:'Échauffement 8-12 min : mobilisation articulaire, vélo ou tapis 5 min, quelques squats sans charge.',notes:'Programme Fondation · 8-12 semaines · 3 séances/semaine · 1 jour de repos min entre 2 séances',_foundation:true,exercises:[
    {name:'SQUAT GOBLET',series:4,reps:'10-12',repos:'2 min',description:'Debout, pieds écartés et surélevés avec des steps, un haltère tenu à 2 mains, bras relâchés. Dos droit et faire une flexion des cuisses. Descendre puis faire une extension pour revenir à la position de départ.',videoUrl:'https://youtu.be/lUuPEpfdgrs',videoUrl2:''},
    {name:'PRESSE À CUISSE INCLINÉE PIEDS EN HAUT',series:4,reps:'10-12',repos:'2 min',description:'Installé dos callé sur le dossier pieds en haut de la plateforme suffisamment écartée. Débloquer la sécurité et fléchir les jambes au maximum puis revenir en position de départ.',videoUrl:'https://youtu.be/MYC-woyTDjY',videoUrl2:''},
    {name:'FENTES HALTÈRE',series:3,reps:'10 par jambe',repos:'2 min',description:'Debout, jambes légèrement écartées, bras semis tendus. Effectuer un pas en avant en gardant le dos droit, la cuisse en avant doit se stabiliser à l\'horizontale et le genou opposé à quelques cm du sol. Réaliser ensuite la même chose avec l\'autre jambe.',videoUrl:'https://youtu.be/hvfdPZgQIL8',videoUrl2:''},
    {name:'LEG CURL ASSIS',series:3,reps:'12-15',repos:'1 min 30',description:'Installé dos callé sur le dossier chevilles callées sous le boudin. Faire une flexion des jambes en essayant de ramener les talons le plus en arrière possible puis revenir en position de départ.',videoUrl:'https://youtu.be/RhyYQ8t8wnQ',videoUrl2:''},
    {name:'LEG EXTENSION',series:3,reps:'12-15',repos:'1 min 30',description:'Installé dos callé sur le dossier, chevilles callées sous le boudin pointe de pieds vers soi. Effectuer une extension de jambes jusqu\'à l\'horizontal, marquer 1 seconde puis revenir en position initiale.',videoUrl:'https://youtu.be/6iwU5rNMPyY',videoUrl2:''},
    {name:'MOLLETS À LA SMITH MACHINE',series:3,reps:'15-20',repos:'1 min',description:'Debout, dos droit, l\'avant des pieds sur la cale. Monter le talon le plus haut possible puis descendre le plus bas possible.',videoUrl:'https://youtu.be/lD4CUFENxUw',videoUrl2:''}
  ]},
  {day:'Mardi',name:'',active:false,photo:null,photo2:null,warmup:'',notes:'',_foundation:true,exercises:[]},
  {day:'Mercredi',name:'SÉANCE B : HAUT DU CORPS',active:true,photo:null,photo2:null,warmup:'Échauffement 8-12 min : rotations des épaules, rotations de poignets, quelques pompes légères.',notes:'',_foundation:true,exercises:[
    {name:'TIRAGE POITRINE NEUTRE',series:4,reps:'10-12',repos:'2 min',description:'Prise largeur épaules et mains neutres (pouce vers soi). Effectuer un tirage et emmener le menton au-dessus de la barre puis tendre les bras.',videoUrl:'https://youtu.be/T--lg679EZM',videoUrl2:''},
    {name:'TIRAGE HORIZONTAL SERRÉ',series:3,reps:'12',repos:'2 min',description:'Assis, face à l\'appareil, torse bombé et dos droit. Ramener les coudes le plus en arrière possible et la poignée vers le sternum puis revenir en position de départ.',videoUrl:'https://youtu.be/br_sJJabsoY',videoUrl2:''},
    {name:'DÉVELOPPÉ À LA MACHINE ASSIS',series:3,reps:'10-12',repos:'2 min',description:'La prise des poignées est en pronation (pouces vers l\'intérieur). Dos collé au siège et poitrine en avant. Pousser la pédale avec les jambes pour avancer les prises puis pousser jusqu\'à ce que les bras soient tendus, puis revenir.',videoUrl:'https://youtu.be/T--lg679EZM',videoUrl2:''},
    {name:'ÉLÉVATION LATÉRALE HALTÈRE',series:3,reps:'15',repos:'1 min 30',description:'Prise neutre (paumes vers l\'intérieur). Réaliser une élévation simultanée des deux bras vers l\'extérieur jusqu\'à ce qu\'ils soient parallèles au sol. Les coudes sont légèrement fléchis et ne doivent pas être plus bas que les poignets.',videoUrl:'https://youtu.be/D0cB-ZHzv18',videoUrl2:''},
    {name:'CURL À LA POULIE',series:3,reps:'12-15',repos:'1 min 30',description:'Se tenir droit, dos à la poulie les coudes fixes, monter la charge le plus haut possible sans basculer le dos en arrière puis la redescendre en contrôlant la descente.',videoUrl:'https://youtu.be/vii41RdW4PM',videoUrl2:''},
    {name:'TRICEPS À LA POULIE HAUTE CORDE',series:3,reps:'12-15',repos:'1 min 30',description:'Face à la poulie saisir la corde en prise neutre (pouce vers le haut), effectuer une extension des avant-bras en gardant les coudes près du corps. En fin du mouvement écarter les poignets vers l\'extérieur.',videoUrl:'https://youtu.be/vzfUXQdMKdg',videoUrl2:''}
  ]},
  {day:'Jeudi',name:'',active:false,photo:null,photo2:null,warmup:'',notes:'',_foundation:true,exercises:[]},
  {day:'Vendredi',name:'SÉANCE C : FESSIERS & CUISSES',active:true,photo:null,photo2:null,warmup:'Échauffement 8-12 min : fentes légères, ponts fessiers au sol, mobilisation des hanches.',notes:'',_foundation:true,exercises:[
    {name:'HIP THRUST MACHINE OU À LA BARRE',series:4,reps:'10-12',repos:'2 min',description:'Placer les pieds sur la plateforme, les talons ancrés et les genoux à environ 90°. Positionner la barre sur le bassin, puis pousser avec les talons pour soulever les hanches en contractant les fessiers. Redescendre lentement.',videoUrl:'https://youtu.be/npL42UPPf-w',videoUrl2:'https://youtu.be/33V0XER5Msw'},
    {name:'SQUAT SMITH MACHINE',series:3,reps:'12',repos:'2 min',description:'Debout, pieds légèrement écartés, la barre repose sur les trapèzes. Dos droit et faire une flexion des cuisses. Descendre puis faire une extension pour revenir à la position de départ.',videoUrl:'https://youtu.be/r9S7bn3AQB8',videoUrl2:''},
    {name:'SOULEVÉ DE TERRE ROUMAIN HALTÈRES',series:3,reps:'10-12',repos:'2 min',description:'Se pencher le buste et garder les jambes légèrement fléchies et le dos droit. Prendre les haltères en pronation, puis se redresser en utilisant un mouvement de bassin en gardant les haltères près des jambes.',videoUrl:'https://youtu.be/KZXyPNBJZ1c',videoUrl2:''},
    {name:'SQUAT BULGARE HALTÈRE',series:3,reps:'8-10 par jambe',repos:'1 min 30',description:'Debout, bras semis tendus. Effectuer un pas en avant en gardant le dos droit et le pied arrière sur un banc, la cuisse en avant doit se stabiliser à l\'horizontale et le genou opposé à quelques cm du sol.',videoUrl:'https://youtu.be/QqhYbQ8JV9s',videoUrl2:''},
    {name:'ABDUCTEURS À LA MACHINE',series:3,reps:'15-20',repos:'1 min 30',description:'Assis sur la machine, jambes proches. Écarter les cuisses puis revenir en position de départ en contrôlant le mouvement.',videoUrl:'https://youtu.be/R_1BY8RDQu8',videoUrl2:''},
    {name:'EXTENSION DE HANCHE POULIE BASSE',series:3,reps:'12-15',repos:'1 min 30',description:'Debout, face à l\'appareil, bassin incliné vers l\'avant, une jambe en appui l\'autre reliée à la poulie. Effectuer une extension de hanche en poussant avec le pied vers l\'arrière puis revenir en position de départ.',videoUrl:'https://youtu.be/74GuQRTF9Dg',videoUrl2:''}
  ]},
  {day:'Samedi',name:'',active:false,photo:null,photo2:null,warmup:'',notes:'',_foundation:true,exercises:[]},
  {day:'Dimanche',name:'',active:false,photo:null,photo2:null,warmup:'',notes:'',_foundation:true,exercises:[]}
];
const FONDATION_H=[
  {day:'Lundi',name:'SÉANCE A : PECS, ÉPAULES & TRICEPS',active:true,photo:null,photo2:null,warmup:'Échauffement 8-12 min : rotations des épaules, rotations de poignets, pompes légères, élévations frontales légères.',notes:'Programme Fondation · 8-12 semaines · 3 séances/semaine · 1 jour de repos min entre 2 séances',_foundation:true,exercises:[
    {name:'DÉVELOPPÉ COUCHÉ HALTÈRE',series:4,reps:'8-10',repos:'2 min',description:'La prise des haltères est en pronation (les pouces sont à l\'intérieur). Les pieds servent d\'appuis au sol. Descendre les haltères le plus bas possible puis revenir en position initiale.',videoUrl:'https://youtu.be/eRglSFbnRro',videoUrl2:''},
    {name:'DÉVELOPPÉ MACHINE HAUT DE PECS OU À LA SMITH',series:3,reps:'10-12',repos:'2 min',description:'La prise des poignées est en pronation (pouces vers l\'intérieur). Dos collé au siège et poitrine en avant. Pousser jusqu\'à ce que les bras soient tendus puis revenir à la position de départ.',videoUrl:'https://youtu.be/DVQ6nW2o7K4',videoUrl2:'https://youtu.be/Wku24QRTfIk'},
    {name:'ÉLÉVATION LATÉRALE HALTÈRE',series:4,reps:'12-15',repos:'1 min 30',description:'Prise neutre (paumes vers l\'intérieur). Réaliser une élévation simultanée des deux bras vers l\'extérieur jusqu\'à ce qu\'ils soient parallèles au sol. Les coudes sont légèrement fléchis et ne doivent pas être plus bas que les poignets.',videoUrl:'https://youtu.be/D0cB-ZHzv18',videoUrl2:''},
    {name:'SHOULDER PRESS',series:3,reps:'10-12',repos:'1 min 30',description:'S\'asseoir sur le siège, les pieds ancrés au sol et le dos contre le dossier sans cambrer. Prendre les poignées à hauteur des épaules, les coudes légèrement fléchis. Pousser vers le haut sans verrouiller les coudes, puis redescendre lentement.',videoUrl:'https://youtu.be/SSJHA6FsMrA',videoUrl2:''},
    {name:'TRICEPS À LA POULIE HAUTE CORDE',series:3,reps:'12-15',repos:'1 min 30',description:'Face à la poulie saisir la corde en prise neutre (pouce vers le haut), effectuer une extension des avant-bras en gardant les coudes près du corps. En fin du mouvement écarter les poignets vers l\'extérieur.',videoUrl:'https://youtu.be/vzfUXQdMKdg',videoUrl2:''},
    {name:'DIPS ASSISTÉ',series:2,reps:'MAX',repos:'1 min',description:'Réaliser une flexion de coudes vers l\'arrière jusqu\'à ce que les épaules soient à la même hauteur que les coudes. Tendre les bras sans verrouiller les coudes. Barres assez proches, ne pas trop se pencher en avant.',videoUrl:'https://youtu.be/0cVzj1QY22A',videoUrl2:''}
  ]},
  {day:'Mardi',name:'',active:false,photo:null,photo2:null,warmup:'',notes:'',_foundation:true,exercises:[]},
  {day:'Mercredi',name:'SÉANCE B : DOS & BICEPS',active:true,photo:null,photo2:null,warmup:'Échauffement 8-12 min : mobilisation des épaules, rotations du buste, band pull-aparts ou tractions légères.',notes:'',_foundation:true,exercises:[
    {name:'TIRAGE POITRINE NEUTRE',series:4,reps:'8-10',repos:'2 min',description:'Prise largeur épaules et mains neutres (pouce vers soi). Effectuer un tirage et emmener le menton au-dessus de la barre puis tendre les bras.',videoUrl:'https://youtu.be/T--lg679EZM',videoUrl2:''},
    {name:'TIRAGE HORIZONTAL SERRÉ',series:4,reps:'10-12',repos:'2 min',description:'Assis, face à l\'appareil, torse bombé et dos droit. Ramener les coudes le plus en arrière possible et la poignée vers le sternum puis revenir en position de départ.',videoUrl:'https://youtu.be/br_sJJabsoY',videoUrl2:''},
    {name:'ROWING HALTÈRE UNILATÉRAL SUR BANC',series:3,reps:'10-12',repos:'2 min',description:'La main et le genou opposé en appui sur le banc, dos droit. Monter le coude le plus en arrière possible en le gardant près du corps. Puis revenir dans la position initiale.',videoUrl:'',videoUrl2:''},
    {name:'FACE PULL ASSIS',series:3,reps:'12-15',repos:'1 min 30',description:'Régler la poulie en hauteur, buste droit et poitrine sortie, assis au sol. Saisir la corde par le dessus, la boule de blocage vers le pouce. Tirer l\'épaule vers l\'arrière en rapprochant les omoplates, puis la corde vers le visage en finissant en position de double biceps.',videoUrl:'',videoUrl2:''},
    {name:'CURL BARRE',series:3,reps:'10-12',repos:'1 min 30',description:'Se tenir droit les coudes fixes, monter la charge le plus haut possible sans basculer le dos en arrière puis la redescendre en contrôlant la descente.',videoUrl:'https://youtu.be/6iwU5rNMPyY',videoUrl2:''},
    {name:'CURL LARRY SCOTT MACHINE GUIDÉE OU PUPITRE',series:3,reps:'12-15',repos:'1 min 30',description:'Réaliser une flexion de coudes pour amener les poignées vers les épaules à la force des biceps. L\'écartement des mains est légèrement supérieur à la largeur des épaules.',videoUrl:'https://youtu.be/vzfUXQdMKdg',videoUrl2:''}
  ]},
  {day:'Jeudi',name:'',active:false,photo:null,photo2:null,warmup:'',notes:'',_foundation:true,exercises:[]},
  {day:'Vendredi',name:'SÉANCE C : JAMBES',active:true,photo:null,photo2:null,warmup:'Échauffement 8-12 min : vélo ou tapis 5 min, fentes légères, squats sans charge, mobilisation des hanches.',notes:'',_foundation:true,exercises:[
    {name:'PRESSE À CUISSE INCLINÉE',series:4,reps:'10-12',repos:'2 min',description:'Installé dos callé sur le dossier pieds au centre de la plateforme. Débloquer la sécurité et fléchir les jambes au maximum puis revenir en position de départ.',videoUrl:'https://youtu.be/1GMcszqB5nU',videoUrl2:''},
    {name:'SQUAT SMITH MACHINE',series:3,reps:'10-12',repos:'2 min',description:'Debout, pieds légèrement écartés, la barre repose sur les trapèzes. Dos droit et faire une flexion des cuisses. Descendre puis faire une extension pour revenir à la position de départ.',videoUrl:'https://youtu.be/r9S7bn3AQB8',videoUrl2:''},
    {name:'HIP THRUST MACHINE OU À LA BARRE',series:3,reps:'10-12',repos:'2 min',description:'Placer les pieds sur la plateforme, les talons ancrés et les genoux à environ 90°. Positionner la barre sur le bassin, puis pousser avec les talons pour soulever les hanches en contractant les fessiers. Redescendre lentement.',videoUrl:'https://youtu.be/npL42UPPf-w',videoUrl2:'https://youtu.be/33V0XER5Msw'},
    {name:'LEG CURL ALLONGÉ',series:3,reps:'12-15',repos:'1 min 30',description:'À plat ventre sur la machine, chevilles callées sous le boudin. Faire une flexion des jambes en essayant de toucher les fesses avec les talons puis revenir en position de départ.',videoUrl:'https://youtu.be/E6BljjBe75o',videoUrl2:''},
    {name:'LEG EXTENSION',series:3,reps:'12-15',repos:'1 min 30',description:'Installé dos callé sur le dossier, chevilles callées sous le boudin pointe de pieds vers soi. Effectuer une extension de jambes jusqu\'à l\'horizontal, marquer 1 seconde puis revenir en position initiale.',videoUrl:'https://youtu.be/vii41RdW4PM',videoUrl2:''},
    {name:'MOLLETS À LA SMITH MACHINE',series:3,reps:'15-20',repos:'1 min',description:'Debout, dos droit, l\'avant des pieds sur la cale. Monter le talon le plus haut possible puis descendre le plus bas possible.',videoUrl:'https://youtu.be/lD4CUFENxUw',videoUrl2:''}
  ]},
  {day:'Samedi',name:'',active:false,photo:null,photo2:null,warmup:'',notes:'',_foundation:true,exercises:[]},
  {day:'Dimanche',name:'',active:false,photo:null,photo2:null,warmup:'',notes:'',_foundation:true,exercises:[]}
];
// ===== fin PROGRAMME FONDATION =====
