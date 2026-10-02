// ══════════ L'ESTIMATION DU MAXIMUM NE DÉPEND PLUS D'AUCUNE PHASE ══════════
// L'abattement de 5 % sur l'e1RM inversait le raisonnement : une performance
// diminuée par la phase implique un maxi réel PLUS HAUT, pas plus bas.
// L'ajustement de la charge du jour appartient à getCycleFactor, pas à
// l'estimation du maximum. Ne pas réintroduire.
//
// Il était de surcroît appliqué à l'e1RM, qui remplit ENSUITE toute la table
// reps × RIR : l'abattement contaminait des charges projetées pour des jours
// où la phase n'a plus cours. Et il n'a jamais porté la moindre référence,
// contrairement au reste du produit.
//
// Ce qui le remplace ne touche à AUCUN chiffre : une phrase, qui dit dans
// quel sens lire l'estimation. PURE.
const CALC_PHRASE_DIFFICILE='Tu as indiqué une journée difficile. Cette '
  +'estimation part de ta performance du jour : ton maxi réel est '
  +'probablement un peu plus haut.';
const CALC_PHRASE_PMS='Tu as signalé être sensible au syndrome prémenstruel. '
  +'Cette estimation part de ta performance du jour : ton maxi réel est '
  +'probablement un peu plus haut.';
function phraseCalcCycle(user,dateISO){
  const u=user||currentUser||{};
  // phaseCycle ne regarde QUE user.cycle : elle ne sait rien du genre, et
  // rendait donc « menstrual » pour un dossier masculin portant un cycle
  // configuré. La garde est ici, comme _hormonalApplicable ailleurs.
  if(!isFemale((u._evol_gender||u.gender)||'')) return '';
  // Le RESSENTI déclaré avant la séance prime sur le calendrier : c'est la
  // même hiérarchie que getCycleFactor, et pour la même raison — ce qu'elle
  // dit du jour vaut mieux qu'une date.
  const r=u.currentCycle;
  if(r==='j1_difficile'||r==='j1_supportable') return CALC_PHRASE_DIFFICILE;
  const phase=phaseCycle(u,dateISO||localISODate(new Date()));
  // Périmé, irrégulier, sans cycle ou rien du tout : AUCUNE phrase. On ne
  // commente pas un état qu'on ne connaît pas.
  if(!phaseAgissante(phase)) return '';
  if(phase==='menstrual') return CALC_PHRASE_DIFFICILE;
  if(phase==='luteal_late'&&confCycle(u).sensibilitePms) return CALC_PHRASE_PMS;
  return '';
}
function _renderCalcCycle(){
  const z=document.getElementById('calc-cycle-etat');
  if(!z) return;
  const t=phraseCalcCycle(currentUser);
  z.textContent=t;
  z.style.display=t?'block':'none';
}
function updateCalcTable(){
  // La charge est saisie dans l'unité de l'athlète : le calcul se fait en kilos.
  const pw=afficheVersKg(document.getElementById('calc-pw').value,currentUser)||0;
  const pr=parseFloat(document.getElementById('calc-pr').value)||0;
  const prir=parseFloat(document.getElementById('calc-prir').value)||0;
  // Posée AVANT toute sortie anticipée : elle informe indépendamment de
  // l'estimation, y compris quand celle-ci est refusée.
  _renderCalcCycle();
  if(!pw||!pr){document.getElementById('calc-table-body').innerHTML='<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--sub)">Entre ta charge et tes reps précédentes</td></tr>';document.getElementById('calc-e1rm-display').style.display='none';return;}
  // LE MODÈLE DE L'APP : e1rm() (Epley sur reps + RIR) et sa réciproque
  // chargePourReps(). Plus de table de pourcentages propre à la calculatrice.
  const e=e1rm(pw,pr,prir);
  if(!(e>0)){document.getElementById('calc-table-body').innerHTML='<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--orange)">Entre une charge et au moins une répétition</td></tr>';document.getElementById('calc-e1rm-display').style.display='none';return;}
  const _fiable=e1rmFiable(pr,prir);
  document.getElementById('calc-e1rm-val').textContent=Math.round(kgVersAffiche(e,currentUser))+_unite()+(_fiable?'':' (estimation peu fiable)');
  document.getElementById('calc-e1rm-display').style.display='block';
  const repsRange=[3,4,5,6,7,8,10,12,15];
  const rirRange=[0,1,2,3];
  const tbody=document.getElementById('calc-table-body');
  tbody.innerHTML=repsRange.map(r=>{
    const isTargetReps=r===Math.round(pr);
    return `<tr style="background:${isTargetReps?'#1a0000':''}">
      <td style="padding:8px 6px;font-weight:800;text-align:center;white-space:nowrap;color:${isTargetReps?'var(--red)':'var(--sub)'}">${r} reps</td>
      ${rirRange.map(rir=>{
        // Arrondie comme partout (arrondiCharge), affichée dans l'unité.
        const w=kgVersAffiche(arrondiCharge(chargePourReps(e,r,rir),{user:currentUser,sens:'proche'}),currentUser)||0;
        const isTarget=r===Math.round(pr)&&rir===Math.round(prir);
        // Au-delà de 12 répétitions potentielles : grisé, estimation peu fiable.
        const peuFiable=!e1rmFiable(r,rir);
        return `<td${peuFiable?' class="calc-peu-fiable" title="Estimation peu fiable au-delà de 12 répétitions potentielles"':''} style="padding:8px 6px;text-align:center;background:${isTarget?'var(--red)':''};border-radius:${isTarget?'var(--r-2)':''};font-weight:${isTarget?'800':'600'};box-shadow:${isTarget?'var(--glow-red)':''}">${w>0?w+_unite():'-'}</td>`;
      }).join('')}
    </tr>`;
  }).join('');
}

// ======= OCR AUTOMATIQUE : LECTURE PHOTO PROGRAMME =======

// Prétraitement pour texte coloré (rouge/blanc) sur fond sombre → B&W haute contraste
function preprocessRedOnDark(dataUrl){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      // Limiter à 1200px pour garder sous 900KB
      let w=img.width,h=img.height;
      const mxPx=1200;
      if(w>mxPx||h>mxPx){const r=Math.min(mxPx/w,mxPx/h);w=Math.round(w*r);h=Math.round(h*r);}
      const c=document.createElement('canvas');
      c.width=w;c.height=h;
      const ctx=c.getContext('2d');
      ctx.drawImage(img,0,0,w,h);
      const d=ctx.getImageData(0,0,w,h);
      const px=d.data;
      for(let i=0;i<px.length;i+=4){
        const r=px[i],g=px[i+1],b=px[i+2];
        const brightness=(r+g+b)/3;
        // Texte rouge/orange/rose OU texte clair sur fond sombre → noir
        const isReddish=r>100&&r>g*1.4&&r>b*1.4;
        const isLight=brightness>140;
        px[i]=px[i+1]=px[i+2]=(isReddish||isLight)?0:255;
      }
      ctx.putImageData(d,0,0);
      let q=0.9,out=c.toDataURL('image/jpeg',q);
      while(out.length*0.75>900000&&q>0.4){q-=0.1;out=c.toDataURL('image/jpeg',q);}
      resolve(out);
    };
    img.onerror=()=>resolve(dataUrl);
    img.src=dataUrl;
  });
}

// Redimensionne + compresse pour respecter la limite 1MB d'ocr.space
function resizeForOcr(dataUrl,maxPx=1500){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      let w=img.width,h=img.height;
      if(w>maxPx||h>maxPx){const r=Math.min(maxPx/w,maxPx/h);w=Math.round(w*r);h=Math.round(h*r);}
      const c=document.createElement('canvas');
      c.width=w;c.height=h;
      const ctx=c.getContext('2d');
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality='high';
      ctx.drawImage(img,0,0,w,h);
      let q=0.85,out=c.toDataURL('image/jpeg',q);
      while(out.length*0.75>900000&&q>0.4){q-=0.1;out=c.toDataURL('image/jpeg',q);}
      resolve(out);
    };
    img.onerror=()=>resolve(dataUrl);
    img.src=dataUrl;
  });
}

// ══ LE CHEMIN VERS api.ocr.space EST RETIRE, CLEF COMPRISE ═══════════════
//
// CE QUI ETAIT LA : une requete vers api.ocr.space portant une clef d'API
// ECRITE EN CLAIR dans le fichier. Le drapeau LEGACY_PDF_IMPORT etant a false,
// la garde ci-dessous levait avant la requete et plus rien ne partait — mais
// LA CLEF, ELLE, PARTAIT QUAND MEME : index.html est servi publiquement, et
// n'importe qui ouvrant l'application pouvait la lire dans le source. Un
// verrou sur le chemin d'appel ne verrouille rien du tout quand le secret est
// dans le texte de la page.
//
// ET ELLE ETAIT VIVANTE. Verifie le 02/09/2026 par deux requetes comparees :
// avec cette clef, api.ocr.space repond « E400: No content provided » — donc
// l'authentification est passee ; avec une clef inventee, « E555: API key not
// valid ». Elle a ete revoquee depuis, mais elle ne devait pas etre la.
//
// POURQUOI RETIRER PLUTOT QUE GARDER SOUS DRAPEAU. La fonctionnalite n'est pas
// « en pause » : elle a ete REMPLACEE, et deux fois. L'import de seance passe
// par la banque d'exercices, et la lecture de texte par le moteur Tesseract
// embarque sous ./vendor — un choix pose pour que l'image ne quitte jamais le
// telephone. Rien de tout cela ne revient a un sous-traitant distant. Garder
// une clef publique pour une hypothese, c'est payer tous les jours le prix d'un
// retour qui n'aura pas lieu ; et s'il avait lieu, il faudrait de toute facon
// une clef neuve, celle-ci etant grillee.
//
// LA GARDE RESTE, ET LA FONCTION AUSSI : quinze appels la nomment encore, tous
// derriere le meme drapeau. Elle leve desormais sans rien tenter, ce qui est
// exactement ce qu'elle faisait deja — sans porter de secret.
//
// dataURLtoBlob part avec elle : elle n'existait que pour empaqueter l'image de
// cette requete, et n'avait aucun autre appelant.
//
// LA POLITIQUE DE CONFIDENTIALITE GARDE SA LIGNE OCR.space, mise a jour : le
// sous-traitant a figure dans le produit, le dire reste honnete, et la ligne
// precise maintenant que le code a ete retire et non seulement desactive.
async function _ocrImage(dataUrl,opts={}){
  throw new Error('Reconnaissance de texte désactivée.');
}

// Tente d'associer chaque URL à l'exercice dont le numéro apparaît dans les lignes
// proches dans le texte OCR brut. Retombe sur l'ordre positionnel si aucun numéro trouvé.
function _buildVideoLinksArray(rawText, links, exercises){
  if(!links.length) return [];
  const exNumRe=/^\s*(\d+)\s*[\)\.]/;
  const simpleNumRe=/^\s*(\d+)\s*$/;
  const lines=rawText.split('\n').map(l=>l.trim());
  const numMap={};
  let anyMatched=false;
  for(const url of links){
    // Cherche l'ID vidéo (plus stable que l'URL complète après normalisation OCR)
    const idM=url.match(/(?:youtu\.be\/|watch\?v=|shorts\/)([a-zA-Z0-9_\-]{5,})/i);
    const vid=idM?idM[1]:null;
    let urlLineIdx=-1;
    for(let li=0;li<lines.length;li++){
      const ln=lines[li].replace(/\s+/g,'').toLowerCase();
      if(vid&&ln.includes(vid.toLowerCase())){urlLineIdx=li;break;}
      if(urlLineIdx===-1&&(ln.includes('youtu.be')||ln.includes('youtube.com'))) urlLineIdx=li;
    }
    if(urlLineIdx===-1) continue;
    // Cherche un numéro d'exercice en partant de la ligne de l'URL elle-même, puis en
    // s'écartant ±1, ±2, ±3 — le plus proche gagne (et non le premier trouvé dans l'ordre
    // croissant, qui vole souvent le numéro d'une URL voisine quand plusieurs liens numérotés
    // se suivent de près dans la section vidéos).
    let foundNum=null;
    for(let d=0;d<=3&&foundNum===null;d++){
      const candidates=d===0?[urlLineIdx]:[urlLineIdx-d,urlLineIdx+d];
      for(const li of candidates){
        if(li<0||li>=lines.length) continue;
        const m=lines[li].match(exNumRe);
        if(m){foundNum=parseInt(m[1]);break;}
        const sm=lines[li].match(simpleNumRe);
        if(sm){const n=parseInt(sm[1]);if(n>=1&&n<=exercises.length){foundNum=n;break;}}
      }
    }
    if(foundNum!==null&&foundNum>=1&&foundNum<=exercises.length){
      if(!numMap[foundNum]) numMap[foundNum]=url;
      anyMatched=true;
    }
  }
  if(anyMatched) return exercises.map((_,i)=>numMap[i+1]||'');
  return links; // fallback positionnel inchangé
}

async function analyzePhotoWithClaude(idx){
  if(!_importLegacyOuvert()) return _refusImportLegacy();
  const cfg=currentUser.sessions_config;
  const photo=cfg[idx].photo;
  if(!photo) return;
  const btn=document.getElementById('analyze-btn-'+idx);
  const resetBtn=()=>{if(btn){ btn.disabled=false; btn.classList.remove('arc-attente-bar'); btn.innerHTML=' Lire & importer les exercices'; }};
  if(btn){ btn.disabled=true; btn.classList.add('arc-attente-bar'); btn.innerHTML='Lecture en cours...'; }
  try{
    const rawText=await _ocrImage(photo);
    if(!rawText){toast('Texte illisible. Essaie une photo plus nette et bien cadrée.','var(--orange)');resetBtn();return;}
    const exercises=parseWorkoutSheet(rawText);
    if(!exercises.length){toast('Aucun exercice trouvé. Vérifie que la fiche est bien lisible.','var(--orange)');resetBtn();return;}

    // Le mode "tableau + français" utilisé pour rawText lit très mal les URL (colonnes
    // fusionnées, accents ajoutés sur du texte anglais). On relit la MÊME photo principale
    // avec les réglages qui marchent pour les liens (comme pour photo2 ci-dessous).
    let mainLinkText='';
    try{
      if(btn) btn.innerHTML='Lecture liens vidéos...';
      const m1=await resizeForOcr(photo,1500).catch(()=>photo);
      const m2=await resizeForOcr(photo,800).catch(()=>m1);
      const m3=await preprocessRedOnDark(photo).catch(()=>m1);
      const [mt1,mt2,mt3,mt4]=await Promise.all([
        _ocrImage(m1,{isTable:false,engine:1,language:'eng'}).catch(()=>''),
        _ocrImage(m1,{isTable:false,engine:2,language:'eng'}).catch(()=>''),
        _ocrImage(m2,{isTable:false,engine:2,language:'eng'}).catch(()=>''),
        _ocrImage(m3,{isTable:false,engine:2,language:'eng'}).catch(()=>'')
      ]);
      mainLinkText=mt1+'\n'+mt2+'\n'+mt3+'\n'+mt4;
    }catch{}
    const mainLinks=parseVideoLinks(rawText+'\n'+mainLinkText);

    // Liens depuis photo2 (document séparé) — comportement inchangé
    let photo2Links=[];
    let p2Text='';
    const _p2=cfg[idx].photo2||localStorage.getItem('rc_p2_'+(currentUser?.email||'')+'_'+idx)||null;
    if(_p2){
      try{
        if(btn) btn.innerHTML='Lecture liens vidéos (2)...';
        const p2=_p2;
        const r1=await resizeForOcr(p2,1500).catch(()=>p2);
        const r2=await resizeForOcr(p2,800).catch(()=>r1);
        const r3=await preprocessRedOnDark(p2).catch(()=>r1);
        const [t1,t2,t3,t4]=await Promise.all([
          _ocrImage(r1,{isTable:false,engine:1,language:'eng'}).catch(()=>''),
          _ocrImage(r1,{isTable:false,engine:2,language:'eng'}).catch(()=>''),
          _ocrImage(r2,{isTable:false,engine:2,language:'eng'}).catch(()=>''),
          _ocrImage(r3,{isTable:false,engine:2,language:'eng'}).catch(()=>'')
        ]);
        p2Text=t1+'\n'+t2+'\n'+t3+'\n'+t4;
        photo2Links=parseVideoLinks(p2Text);
      }catch{}
    }

    // Fusion (dédoublonnage) — photo principale d'abord, photo2 en complément
    const allLinks=[...new Set([...mainLinks,...photo2Links])];

    // Matching numéro→exercice : cherche le contexte de chaque URL dans TOUT le texte
    // OCR disponible (tableau + passes liens), pas seulement rawText, pour ne pas rater
    // le numéro d'exercice quand l'URL n'apparaît que dans la passe "liens".
    const combinedText=rawText+'\n'+mainLinkText+'\n'+p2Text;
    const videoLinks=_buildVideoLinksArray(combinedText,allLinks,exercises);

    showOcrReviewModal(exercises,idx,videoLinks);
    resetBtn();
  }catch(e){
    toast('Erreur : '+e.message,'var(--red)');resetBtn();
  }
}

// ======= PARSEUR INTELLIGENT FICHE PROGRAMME =======
function parseWorkoutSheet(text){
  const lines=text.split('\n').map(l=>l.trim()).filter(l=>l.length>0);
  const exercises=[];
  let current=null;
  let descLines=[];

  // Patterns
  const exNumRe=/^\s*(\d+)\s*[\)\.]\s*(.+)/;        // "1) ABDUCTIONS..." ou "1. NOM"
  const reposRe=/repos\s*:?\s*(\d+\s*(?:min|sec))/i; // "Repos : 01 min"
  const pureNumRe=/^\s*(\d+)\s*$/;                    // ligne = juste un chiffre (séries ou reps isolé)
  const puisRe=/\b(\d+)\s*PUIS\s*(\d+)\b/i;          // "10 PUIS 20" dans la ligne
  const parJambeRe=/\b(\d+)\s*(par\s*(?:jambe|bras|c[oô]t[eé]))\b/i; // "15 Par Jambe"
  const rangeRe=/\b(\d+)\s*[-–]\s*(\d+)\b/;          // "6-8"
  const seriesColRe=/\b([2-6])\s*$/;                  // chiffre en fin de ligne = séries (2-6)

  // On collecte les blocs par exercice numéroté
  // Une fois la section "vidéos" atteinte, on arrête : sinon chaque ligne "1) https://..."
  // de cette section est prise pour un nouvel exercice (nom = l'URL elle-même).
  const videoSectionRe=/VID[EÉ]OS?|M[EÉ]THODES?\s*ET\s*EX[EÉ]CUTIONS?|LIENS?\s*YOUTUBE/i;
  const bareUrlLineRe=/^\s*(?:\d+\s*[\)\.]\s*)?(?:https?:\/\/|www\.)/i;
  const blocks=[];
  let curBlock=null;
  for(const line of lines){
    if(videoSectionRe.test(line)||bareUrlLineRe.test(line)) break;
    const nm=line.match(exNumRe);
    if(nm){
      if(curBlock) blocks.push(curBlock);
      curBlock={num:parseInt(nm[1]),nameLine:nm[2].trim(),rest:[]};
    } else if(curBlock){
      // Ignore lignes d'en-tête ou lignes parasites
      if(/EXERCICES|MATERIELS|IMAGES|SERIES|REPS|ECHAUFFEMENT|SÉANCE|SEANCE/i.test(line)) continue;
      curBlock.rest.push(line);
    }
  }
  if(curBlock) blocks.push(curBlock);

  for(const block of blocks){
    // Extraire le NOM (première ligne du bloc)
    let name=block.nameLine.toUpperCase().replace(/\s+/g,' ').trim();
    // Supprimer les chiffres isolés en fin de nom (artefact OCR de la colonne SERIES)
    name=name.replace(/\s+\d+\s*$/, '').trim();

    let series=3, reps='10', repos='90 sec', descParts=[];
    let collectedNums=[];

    for(const line of block.rest){
      // Repos — mot "repos" suivi d'un temps
      const rm=line.match(reposRe);
      if(rm){repos=rm[1].trim();continue;}
      // Repos — ligne = uniquement un temps ("01 min", "1 min 30", "2 min", "90 sec")
      const rtmMin=line.match(/^\s*0?(\d{1,2})\s*min(?:utes?)?\s*(?:0?(\d{1,2})\s*(?:sec(?:ondes?)?)?)?\s*$/i);
      if(rtmMin){repos=rtmMin[1]+' min'+(rtmMin[2]?' '+rtmMin[2]:'');continue;}
      const rtmSec=line.match(/^\s*(\d{1,3})\s*sec(?:ondes?)?\s*$/i);
      if(rtmSec){repos=rtmSec[1]+' sec';continue;}

      // Détection PUIS (dégressive)
      const pm=line.match(puisRe);
      if(pm){reps=pm[1];continue;}

      // Dropset slashes : "12/10/8" → premier chiffre
      const dsm=line.match(/\b(\d+)\s*\/\s*\d+/);
      if(dsm){reps=dsm[1];continue;}

      // Dégressive 3+ nombres "15-12-10" → premier chiffre
      const dg3m=line.match(/\b(\d+)\s*[-–]\s*\d+\s*[-–]\s*\d+/);
      if(dg3m){reps=dg3m[1];continue;}

      // Détection Par Jambe/Bras
      const pjm=line.match(parJambeRe);
      if(pjm){reps=pjm[1]+' Par '+pjm[2].replace(/\s+/g,' ').trim().replace(/^\w/,c=>c.toUpperCase());continue;}

      // Détection plage 6-8
      const rgm=line.match(rangeRe);
      if(rgm&&line.replace(/\s/g,'').length<10){reps=rgm[1]+'-'+rgm[2];continue;}

      // Lignes ne contenant que des chiffres (colonnes SERIES / REPS dans tableau)
      if(pureNumRe.test(line)){collectedNums.push(parseInt(line.trim()));continue;}

      // Ligne terminant par un chiffre isolé 2-6 (colonne SERIES)
      const scm=line.match(seriesColRe);
      if(scm&&line.replace(/\s/g,'').length<15){collectedNums.push(parseInt(scm[1]));descParts.push(line.replace(/\s+\d+\s*$/,'').trim());continue;}

      // Sinon : description
      if(line.length>3&&!/^[IVX]+$/.test(line)) descParts.push(line);
    }

    // Affecter séries / reps depuis les chiffres collectés
    // Convention : premier chiffre ≥2 et ≤6 = séries, suivant ou plus grand = reps
    if(collectedNums.length){
      const small=collectedNums.filter(n=>n>=2&&n<=6);
      const big=collectedNums.filter(n=>n>6||!small.includes(n));
      if(small.length) series=small[0];
      if(big.length&&reps==='10') reps=String(Math.min(...big));
    }

    // Technique dégressive : "Faire 8 répétitions...puis...faire 20..." dans la description
    // → override même si collectedNums a déjà mis "20"
    const descText=descParts.join(' ');
    const puisDescRe=/\b(\d+)\s+r[eé]p[eé]titions?[^.]*?puis[^.]*?(\d+)/i;
    const pm2=descText.match(puisDescRe);
    if(pm2) reps=pm2[1];

    // Si pas encore de reps trouvés : chercher dans la description un nombre final
    if(reps==='10'){
      const lastNum=descText.match(/\b(\d+)\b\s*(?:reps?|répétitions?)?$/i);
      if(lastNum) reps=lastNum[1];
    }

    // Fallback repos : si toujours "90 sec" (défaut), chercher TOUT temps dans le bloc
    if(repos==='90 sec'){
      const allBlockText=block.rest.join(' ');
      // Chercher pattern "X min" ou "X min Y" n'importe où dans le bloc
      const tMin=[...allBlockText.matchAll(/\b0?(\d{1,2})\s*min(?:utes?)?\s*(?:0?(\d{1,2}))?/gi)];
      if(tMin.length){const m=tMin[tMin.length-1];repos=m[1]+' min'+(m[2]?' '+m[2]:'');}
      else{
        const tSec=[...allBlockText.matchAll(/\b(\d{1,3})\s*sec(?:ondes?)?\b/gi)];
        if(tSec.length){const s=tSec[tSec.length-1];repos=s[1]+' sec';}
      }
    }

    const description=descParts.filter(l=>l.length>4).join(' ').replace(/\s+/g,' ').trim();

    // Une ligne numérotée peut porter DEUX exercices enchaînés. On les sépare
    // en deux exercices, le second marqué ss, pour qu'ils s'affichent ensemble
    // à la séance. La détection reste volontairement stricte : un découpage à
    // tort fabrique un exercice fantôme, alors qu'un superset manqué se
    // rattrape d'une case à cocher dans l'écran de relecture.
    const _noms=_ocrDecouperSS(name);
    _noms.forEach((nm,k)=>{
      exercises.push({name:nm,series,reps,repos,description,image:null,ss:k>0});
    });
  }
  return exercises;
}

// ======= MODAL DE RÉVISION AVANT IMPORT =======
// Découpe le nom lu sur une ligne de fiche quand elle porte un superset.
// Rend toujours au moins un nom : en cas de doute, on ne découpe pas.
function _ocrDecouperSS(nom){
  let n=String(nom||'').trim();
  if(!n) return [n];
  // Marqueur explicite écrit par le coach : « SUPERSET : A + B », « SS A / B ».
  // Ancré en tête : c'est là qu'il s'écrit sur une fiche, et « SS » au milieu
  // d'un nom serait plus probablement un artefact de lecture qu'un marqueur.
  const marque=/^\s*(SUPERSETS?|SUPER\s?SETS?|BI\s?-?SETS?|SS)\b\s*[:.\-]?\s*/i;
  const avaitMarque=marque.test(n);
  if(avaitMarque) n=n.replace(marque,'').trim();
  // Repères A1/A2 en tête de chaque nom : « A1 DEVELOPPE A2 ECARTE ».
  const parLettres=n.split(/\s*\b[A-D][1-4][\s.):-]+/).map(s=>s.trim()).filter(Boolean);
  if(parLettres.length>1&&parLettres.every(s=>s.length>=4)) return parLettres;
  // Sinon, un séparateur franc. Le « / » n'est accepté qu'avec le marqueur :
  // « TIRAGE POITRINE/NUQUE » est un seul exercice, pas deux.
  const sep=avaitMarque?/\s+[+\/]\s+|\s*\+\s*/:/\s+\+\s+/;
  const morceaux=n.split(sep).map(s=>s.trim()).filter(Boolean);
  if(morceaux.length>1&&morceaux.length<=3&&morceaux.every(s=>s.length>=5&&/[A-ZÀ-Ÿ]{3}/i.test(s)))
    return morceaux;
  return [n];
}

// PURE. La methode d'intensification nommee dans un texte, ou ''.
//
// LA FICHE PAPIER N'A PAS DE CHAMP « METHODE » : le coach l'ecrit dans la
// colonne technique, en toutes lettres — « Dropset type 1 », « Rest in
// pause ». C'est la seule facon de proposer la video de methode a la relecture
// d'une photo, et le coach corrige d'un tap si on se trompe.
//
// ⚠ TROIS NOMS SONT ECARTES, ET C'EST DELIBERE. « Maximum », « Unilatérale »
// et « Bulgare » sont des mots ORDINAIRES d'une description d'exercice —
// « fléchir les jambes au maximum », « SQUAT BULGARE HALTÈRE ». Les detecter
// mettrait une video de methode sur un exercice qui n'en porte aucune, ce qui
// est pire que de n'en proposer aucune : le coach ne relit pas un champ
// pre-rempli avec la meme attention qu'un champ vide.
//
// LE NOM LE PLUS LONG GAGNE : « Méthode isométrie type 1 » contient
// « Isométrie », et c'est le premier qui est vise.
const OCR_METHODES_AMBIGUES=Object.freeze(['maximum','unilaterale','bulgare']);
function _methodeDansTexte(txt){
  const t=_normRech(txt);
  if(!t) return '';
  let trouve='', long=0;
  for(const k in TECHNIQUES){
    if(OCR_METHODES_AMBIGUES.indexOf(k)>=0) continue;
    const n=_normRech(TECHNIQUES[k].nom);
    if(n.length>2&&n.length>long&&(' '+t+' ').indexOf(' '+n+' ')>=0){ trouve=k; long=n.length; }
  }
  return trouve;
}
function showOcrReviewModal(exercises,idx,videoLinks=[]){
  // videoLinks : 1 URL par exercice en ordre (une ligne tableau = un exo)
  const rows=exercises.map((ex,i)=>{
    // Vidéos du guide, proposées quand la fiche papier n'en portait aucune.
    // Un lien lu sur la photo l'emporte toujours : il vient du coach, pas
    // d'une correspondance de nom.
    // ⚠ _vg[1] N'EST PAS LA « VIDEO 2 ». C'est une AUTRE PRISE DE VUE du meme
    // exercice — « prise serrée » contre « large ». La mettre en second champ
    // remplissait la case de la methode avec une demo d'exercice, et le coach
    // se retrouvait avec deux fois le meme mouvement au lieu de la technique
    // qu'il avait prescrite. Les variantes restantes sont proposees en un tap
    // par _autres, qui ecrit dans v1 — c'est deja le comportement voulu.
    const _vg=videosPour(ex.name);
    const v1=videoLinks[i]||(_vg[0]?_vg[0].url:'');
    // LE SECOND CHAMP EST CELUI DE LA METHODE. Elle vient du champ s'il existe
    // deja, sinon du nom lu dans la colonne technique de la fiche papier.
    const _cleM=(ex.methode&&TECHNIQUES[ex.methode])?ex.methode:_methodeDansTexte(ex.description);
    const v2=(_cleM&&TECHNIQUES[_cleM])?videoTechnique(TECHNIQUES[_cleM]):'';
    const _propose=!videoLinks[i]&&_vg.length>0;
    // Les variantes restantes sont offertes en un tap : le guide distingue
    // « prise serrée » de « large », et la fiche papier ne le dit pas.
    const _autres=_propose&&_vg.length>1
      ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">`
        +_vg.map(v=>`<button onclick="_ocrChoisirVideo(${i},'${v.id}')" style="background:var(--surface-0);border:1px solid var(--border);color:var(--sub);border-radius:var(--r-2);padding:4px 10px;font-family:Montserrat,sans-serif;font-size:var(--fs-2xs);font-weight:700;cursor:pointer">${escapeHtml(v.lbl||'version par défaut')}</button>`).join('')
        +`</div>` : '';
    const _mention=_propose
      ? `<div style="font-size:var(--fs-xs);color:var(--text-dim);margin-bottom:4px">Proposé depuis ton guide</div>` : '';
    const desc=(ex.description||'').replace(/"/g,'&quot;');
    return`
    <div style="background:var(--surface-2);border-radius:var(--r-3);padding:12px;margin-bottom:10px;border:1px solid ${ex.ss?'var(--orange)':'var(--border)'}" id="ocr-ex-${i}">
      ${i===0?'':`<label style="display:flex;align-items:center;gap:8px;margin:-4px 0 10px;cursor:pointer">
        <input type="checkbox" id="ocr-ss-${i}" ${ex.ss?'checked':''} style="width:15px;height:15px;margin:0;accent-color:var(--orange);flex-shrink:0;cursor:pointer">
        <span style="font-size:var(--fs-2xs);font-weight:800;letter-spacing:1px;color:${ex.ss?'var(--orange)':'var(--sub)'};text-transform:none">${icon('echange',12)} EN SUPERSET AVEC LE PRÉCÉDENT</span>
      </label>`}
      <div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:8px">
        <span style="background:var(--red);color:var(--text);border-radius:var(--r-2);padding:2px 8px;font-size:var(--fs-xs);font-weight:800;flex-shrink:0">${i+1}</span>
        <input value="${ex.name.replace(/"/g,'&quot;')}" id="ocr-name-${i}" style="font-weight:700;font-size:var(--fs-md);text-transform:uppercase;flex:1" placeholder="Nom exercice">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px">
        <div>
          <div style="font-size:var(--fs-xs);color:var(--sub);margin-bottom:4px;font-weight:700">SÉRIES</div>
          <input type="number" value="${ex.series}" id="ocr-series-${i}" style="text-align:center;padding:8px" min="1" max="10">
        </div>
        <div>
          <div style="font-size:var(--fs-xs);color:var(--sub);margin-bottom:4px;font-weight:700">REPS</div>
          <input value="${ex.reps}" id="ocr-reps-${i}" style="text-align:center;padding:8px" placeholder="10 ou 10 PUIS 20">
        </div>
        <div>
          <div style="font-size:var(--fs-xs);color:var(--sub);margin-bottom:4px;font-weight:700">REPOS</div>
          <input value="${ex.repos}" id="ocr-repos-${i}" style="text-align:center;padding:8px" placeholder="01 min">
        </div>
      </div>
      <div style="margin-bottom:8px">
        <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1px;font-weight:700;margin-bottom:4px">DESCRIPTION / TECHNIQUE</div>
        <textarea id="ocr-desc-${i}" rows="2" style="font-size:var(--fs-xs);padding:8px 10px;line-height:1.5;resize:vertical" placeholder="Technique d'exécution...">${desc}</textarea>
      </div>
      <div style="margin-bottom:4px">
        <div style="font-size:var(--fs-xs);color:var(--green);letter-spacing:1px;font-weight:700;margin-bottom:4px"> VIDÉO 1</div>
        ${_mention}
        <input value="${v1}" id="ocr-v1-${i}" placeholder="https://youtu.be/..." style="font-size:var(--fs-xs);padding:8px 10px;margin-bottom:6px">
        <div style="font-size:var(--fs-xs);color:var(--orange);letter-spacing:1px;font-weight:700;margin-bottom:4px"> VIDÉO DE LA MÉTHODE (optionnel)${_cleM&&TECHNIQUES[_cleM]?' · '+escapeHtml(TECHNIQUES[_cleM].nom):''}</div>
        <input value="${v2}" id="ocr-v2-${i}" placeholder="https://youtu.be/..." style="font-size:var(--fs-xs);padding:8px 10px">
        ${_autres}
      </div>
      <button onclick="this.closest('#ocr-ex-${i}').remove()" style="margin-top:8px;background:none;border:none;color:var(--red-light);font-size:var(--fs-xs);cursor:pointer;font-family:Montserrat,sans-serif"> Supprimer</button>
    </div>`;}).join('');

  const html=`<div id="modal-overlay" onclick="" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:24px 20px;width:100%;max-width:480px;animation:fadeIn var(--t-3) var(--c-out);max-height:90vh;overflow-y:auto">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <h2> ${exercises.length} exercices lus</h2>
      <button onclick="closeModal()" aria-label="Fermer" style="background:none;border:none;color:var(--sub);font-size:var(--fs-xl);cursor:pointer;min-width:44px;min-height:44px;line-height:1">${icon('croix',14)}</button>
    </div>
    <p class="sub" style="font-size:var(--fs-sm);margin-bottom:16px;line-height:1.6">Vérifie et corrige si besoin, puis importe. <span style="color:var(--green);font-size:var(--fs-xs)">v233</span></p>
    <div id="ocr-rows">${rows}</div>
    <button class="btn btn-red" style="margin-top:4px" onclick="importOcrExercises(${idx===null||idx===undefined?'null':idx},${exercises.length})"> ${currentUser?.role==='coach'?"Importer dans l'éditeur":'Importer dans la séance'}</button>
    <button class="btn btn-outline" style="margin-top:10px" onclick="closeModal()">Annuler</button>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}

// Une variante choisie prend la place de la vidéo 1 ; celle qu'elle remplace
// bascule en vidéo 2 plutôt que d'être perdue, les deux emplacements existant.
// Si la variante demandée occupe déjà la vidéo 2, on ÉCHANGE les deux : la
// recopier telle quelle laissait la même URL dans les deux champs.
function _ocrChoisirVideo(i,id){
  const a=document.getElementById('ocr-v1-'+i), b=document.getElementById('ocr-v2-'+i);
  if(!a) return;
  const url='https://youtu.be/'+id;
  if(a.value===url) return;
  if(b&&b.value===url){ b.value=a.value; a.value=url; return; }
  if(b&&!b.value&&a.value) b.value=a.value;
  a.value=url;
}
function importOcrExercises(idx,maxN){
  const result=[];
  for(let i=0;i<maxN;i++){
    const nameEl=document.getElementById('ocr-name-'+i);
    if(!nameEl||!nameEl.closest('#ocr-ex-'+i)) continue; // supprimé
    const name=(nameEl.value||'').toUpperCase().trim();
    const series=Math.max(1,parseInt(document.getElementById('ocr-series-'+i)?.value)||3);
    const reps=(document.getElementById('ocr-reps-'+i)?.value||'10').trim();
    const repos=(document.getElementById('ocr-repos-'+i)?.value||'90 sec').trim();
    const description=(document.getElementById('ocr-desc-'+i)?.value||'').trim();
    // Une fiche papier porte rarement le « https:// » : sans normalisation,
    // les liens lus par OCR arrivaient morts dans le programme.
    const videoUrl=normaliserUrlVideo(document.getElementById('ocr-v1-'+i)?.value);
    const videoUrl2=normaliserUrlVideo(document.getElementById('ocr-v2-'+i)?.value);
    // La case n'existe pas sur la première carte, et une carte supprimée
    // décale ce qui suit : un exercice ne peut pas rester enchaîné avec un
    // précédent qui n'est plus là.
    const ss=!!document.getElementById('ocr-ss-'+i)?.checked&&result.length>0;
    if(name) result.push({name,series,reps,repos,description,image:null,videoUrl,videoUrl2,ss});
  }
  if(!result.length){toast('Aucun exercice à importer.','var(--orange)');return;}
  _normaliserSS(result);

  // ── Coach : l'import alimente l'éditeur d'exercices partagé ───────────────
  // progEx est la source de vérité de cet écran, et saveProgram() sait déjà
  // router vers les trois destinations (modèle H/F, séance d'un athlète,
  // programme client) selon _progEditorCtx. On ne touche donc JAMAIS à
  // currentUser.sessions_config, qui est la configuration du coach lui-même.
  // Avant ce correctif, _athleteSessionIdx() valant null hors mode athlète,
  // la ligne currentUser.sessions_config[null] levait une TypeError : l'import
  // OCR était purement et simplement inopérant côté coach.
  if(currentUser?.role==='coach'){
    progEx=result;
    _progExDirty=true;
    renderProgEx();
    closeModal();
    toast(result.length+' exercices importés : pense à enregistrer.');
    return;
  }

  // ── Athlète : écriture directe dans sa propre séance, comportement inchangé ─
  if(!currentUser.sessions_config) initSessionsConfig();
  const cible=typeof idx==='number'?currentUser.sessions_config?.[idx]:null;
  if(!cible){toast('Séance introuvable : rouvre-la puis réessaie.','var(--orange)');return;}
  _personnaliserSeance(idx);
  cible.exercises=result;
  const ok=saveUser();closeModal();
  toastEcriture(ok,' '+result.length+' exercices importés !','les exercices sont');
  loadSessionManager();
}

// ======= LECTURE PDF → SÉANCES =======
let _pendingPdfSeances=null, _pendingPdfTarget=null;

// pdf.js 3.11.174, RAPATRIE dans app/vendor/. Il etait charge depuis un CDN,
// qui recevait donc l adresse IP de chaque athlete ouvrant sa fiche programme.
// Chargement toujours DYNAMIQUE : 312 Ko ne doivent pas peser sur le demarrage
// de qui n ouvre jamais de PDF.
//
// LE WORKER N EST PAS RAPATRIE, et c est un arbitrage : il pese 1 061 Ko a lui
// seul, contre 312 pour la bibliotheque. workerSrc laisse VIDE fait basculer
// pdf.js en mode « fake worker » — le meme code tourne dans le fil principal.
// Contrepartie assumee : le rendu d un gros PDF peut figer l ecran une seconde.
// Deux appels d API sont utilises en tout, getDocument et workerSrc ; ce n est
// pas le genre d usage qui justifie un megaoctet de plus dans le depot.
async function _loadPdfJs(){
  if(window.pdfjsLib) return;
  await new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='./vendor/pdf.min.js';
    s.onload=res;s.onerror=rej;document.head.appendChild(s);
  });
  // Chaine VIDE et non une URL : pdf.js sait tourner sans worker, mais il faut
  // le lui dire explicitement. Laisser la valeur par defaut le ferait chercher
  // un fichier absent et echouer.
  window.pdfjsLib.GlobalWorkerOptions.workerSrc='';
}

async function _pdfPageToText(page){
  const content=await page.getTextContent({normalizeWhitespace:true});
  if(!content.items.length) return '';
  // Regrouper les items par ligne (même Y à 3pt près), de haut en bas
  const sorted=[...content.items].sort((a,b)=>{
    const dy=b.transform[5]-a.transform[5];
    return Math.abs(dy)>3?dy:a.transform[4]-b.transform[4];
  });
  const lines=[];let cur=null;
  for(const it of sorted){
    const y=Math.round(it.transform[5]);
    if(!cur||Math.abs(cur.y-y)>3){cur={y,text:it.str};lines.push(cur);}
    else cur.text+=' '+it.str;
  }
  return lines.map(l=>l.text.trim()).filter(l=>l).join('\n');
}

function _isDriveLink(s){
  return typeof s==='string'&&(s.includes('drive.google.com')||s.includes('docs.google.com')||s.includes('dropbox.com'));
}
function _driveOpenUrl(s){
  // Transforme n'importe quel lien Drive/Dropbox en lien d'ouverture direct
  if(s.includes('drive.google.com')){
    const m=s.match(/\/d\/([a-zA-Z0-9_-]{15,})/)||s.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
    if(m) return'https://drive.google.com/file/d/'+m[1]+'/view';
  }
  return s;
}

async function parsePdfProgramme(source){
  if(!_importLegacyOuvert()) throw new Error('Import PDF désactivé.');
  // Drive/Dropbox : détection immédiate avant tout chargement CDN
  if(typeof source==='string'&&_isDriveLink(source)) throw new Error('DRIVE_CORS:'+source);
  await _loadPdfJs();
  let data;
  if(source instanceof File||source instanceof Blob){
    data=await source.arrayBuffer();
  } else if(typeof source==='string'&&source.startsWith('data:')){
    const b64=source.split(',')[1];
    const bin=atob(b64),bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    data=bytes.buffer;
  } else {
    const r=await fetch(source);
    if(!r.ok) throw new Error('Impossible de télécharger le PDF ('+r.status+').');
    data=await r.arrayBuffer();
  }
  const pdf=await pdfjsLib.getDocument({data}).promise;
  const seances=[];
  for(let p=1;p<=pdf.numPages;p++){
    const text=await _pdfPageToText(await pdf.getPage(p));
    const m=text.match(/S[ÉE]ANCE\s+(\d+)\s*[:\-–]\s*([^\n]+)/i);
    if(m){
      const exercises=parseWorkoutSheet(text);
      seances.push({name:'SÉANCE '+m[1]+' : '+m[2].trim().toUpperCase(),exercises});
    }
  }
  return seances;
}

async function triggerPdfProgrammeImport(email){
  if(!_importLegacyOuvert()) return _refusImportLegacy();
  const users=DB.get('users')||{};
  const c=users[email]||Object.values(users).find(u=>u.email===email);
  if(!c){toast('Athlète introuvable.','var(--orange)');return;}
  const source=c.programPdfStorageUrl||c.programPdfLink||c.programPdf;
  if(!source){toast('Aucun PDF lié à cet athlète.','var(--orange)');return;}
  toast('Lecture du PDF en cours…');
  try{
    const seances=await parsePdfProgramme(source);
    if(!seances.length){toast('Aucune séance "SÉANCE X :" trouvée dans ce PDF.','var(--orange)');return;}
    showPdfSeancesModal(seances,email);
  }catch(e){
    if(e.message?.startsWith('DRIVE_CORS:')){showDrivePdfModal(e.message.slice(11),email);}
    else toast('Erreur lecture PDF : '+(e.message||'Réessaie.'),'var(--red)');
  }
}

async function triggerAthletePdfParse(){
  const users=DB.get('users')||{};
  const freshU=users[currentUser.email]||currentUser;
  const source=freshU.programPdfStorageUrl||freshU.programPdfLink||freshU.programPdf;
  if(!source){toast('Aucun PDF disponible.','var(--orange)');return;}
  toast('Lecture du PDF en cours…');
  try{
    const seances=await parsePdfProgramme(source);
    if(!seances.length){toast('Aucune séance "SÉANCE X :" trouvée dans ce PDF.','var(--orange)');return;}
    showPdfSeancesModal(seances,currentUser.email);
  }catch(e){
    if(e.message?.startsWith('DRIVE_CORS:')){showDrivePdfModal(e.message.slice(11),currentUser.email);}
    else toast('Erreur lecture PDF : '+(e.message||'Réessaie.'),'var(--red)');
  }
}

function showPdfSeancesModal(seances,targetEmail){
  _pendingPdfSeances=seances;_pendingPdfTarget=targetEmail;
  const rows=seances.map((s,si)=>`
    <div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);margin-bottom:10px;overflow:hidden">
      <div style="padding:12px 14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
        <div>
          <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:.5px">${escapeHtml(s.name)}</div>
          <div style="font-size:var(--fs-xs);color:var(--sub);margin-top:2px">${s.exercises.length} exercice${s.exercises.length>1?'s':''} détecté${s.exercises.length>1?'s':''}</div>
        </div>
        <div style="color:var(--text-dim);font-size:var(--fs-md);flex-shrink:0">▸</div>
      </div>
      <div style="display:none;border-top:1px solid var(--surface-2);padding:8px 14px 12px">
        ${s.exercises.map((ex,ei)=>`
          <div style="padding:6px 0;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--surface-2)">
            <div style="width:20px;height:20px;background:var(--red);border-radius:var(--r-1);display:flex;align-items:center;justify-content:center;font-size:var(--fs-xs);font-weight:900;color:var(--text);flex-shrink:0">${ei+1}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:var(--fs-xs);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(ex.name)}</div>
              <div style="font-size:var(--fs-xs);color:var(--sub)">${ex.series} × ${escapeHtml(String(ex.reps))} · repos ${escapeHtml(ex.repos)}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`).join('');
  document.getElementById('modal-overlay')?.remove();
  const html=`<div id="modal-overlay" onclick="" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:24px 20px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <h2>${seances.length} séance${seances.length>1?'s':''} détectée${seances.length>1?'s':''}</h2>
      <button onclick="closeModal()" style="background:none;border:none;color:var(--sub);font-size:var(--fs-xl);cursor:pointer">${icon('croix',14)}</button>
    </div>
    <p class="sub" style="font-size:var(--fs-sm);margin-bottom:16px;line-height:1.6">Clique sur une séance pour voir les exercices. Les jours de pratique seront à définir ensuite dans le programme.</p>
    ${rows}
    <button class="btn btn-red" style="margin-top:4px" onclick="importPdfSeances()">Importer les ${seances.length} séance${seances.length>1?'s':''}</button>
    <button class="btn btn-outline" style="margin-top:10px" onclick="closeModal()">Annuler</button>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}

function showDrivePdfModal(driveUrl,targetEmail){
  _pendingPdfTarget=targetEmail;
  document.getElementById('modal-overlay')?.remove();
  const openUrl=_driveOpenUrl(driveUrl);
  const html=`<div id="modal-overlay" onclick="" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:24px 20px;width:100%;max-width:480px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <h2 style="font-size:var(--fs-lg)"> PDF Google Drive</h2>
      <button onclick="closeModal()" style="background:none;border:none;color:var(--sub);font-size:var(--fs-xl);cursor:pointer">${icon('croix',14)}</button>
    </div>
    <p style="font-size:var(--fs-sm);color:var(--sub);line-height:1.8;margin-bottom:20px">Google Drive bloque la lecture directe depuis l'app (restriction navigateur).<br>
    <span style="color:var(--text);font-weight:700">Étape 1 : </span> Ouvre le PDF sur Drive ↓<br>
    <span style="color:var(--text);font-weight:700">Étape 2 : </span> Télécharge-le (icône ↓ en haut à droite de Drive)<br>
    <span style="color:var(--text);font-weight:700">Étape 3 : </span> Sélectionne le fichier téléchargé ↓</p>
    <a href="${safeUrl(openUrl)}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;text-align:center;background:linear-gradient(180deg,#0a2a1a,#061508);border:1px solid #1a4a2a;border-radius:var(--r-2);color:var(--green);font-size:var(--fs-xs);font-weight:800;text-decoration:none;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">
       Ouvrir sur Google Drive
    </a>
    <label style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;background:var(--red);border:none;border-radius:var(--r-2);color:var(--text);font-size:var(--fs-xs);font-weight:800;cursor:pointer;letter-spacing:1.5px;text-transform:uppercase">
       Sélectionner le fichier téléchargé
      <input type="file" accept=".pdf" style="display:none" onchange="_parsePdfFromDriveFile(this)">
    </label>
    <button onclick="closeModal()" style="display:block;width:100%;padding:12px;background:none;border:1px solid var(--border);border-radius:var(--r-2);color:var(--sub);font-size:var(--fs-sm);margin-top:10px;cursor:pointer;font-family:Montserrat,sans-serif">Annuler</button>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}

async function _parsePdfFromDriveFile(input){
  if(!_importLegacyOuvert()) return _refusImportLegacy();
  const f=input.files[0];if(!f) return;
  const targetEmail=_pendingPdfTarget;
  closeModal();
  toast('Lecture du PDF en cours…');
  try{
    const seances=await parsePdfProgramme(f);
    if(!seances.length){toast('Aucune séance "SÉANCE X :" trouvée dans ce PDF.','var(--orange)');return;}
    showPdfSeancesModal(seances,targetEmail);
  }catch(e){toast('Erreur lecture PDF : '+(e.message||'Réessaie.'),'var(--red)');}
}

function importPdfSeances(){
  const seances=_pendingPdfSeances;
  const email=_pendingPdfTarget;
  if(!seances?.length||!email) return;
  const users=DB.get('users')||{};
  const u=users[email];
  if(!u){toast('Athlète introuvable.','var(--red)');return;}
  // Contrôle d'appartenance : soi-même ou un élève de son propre coaching uniquement
  if(u.email!==currentUser?.email&&u.coachId!==currentUser?.id){toast('Élève introuvable ou non autorisé','var(--orange)');return;}
  if(!u.sessions_config) u.sessions_config=Array.from({length:7},(_,i)=>({day:DAYS[i],name:'',exercises:[],active:false,notes:''}));
  // B1.8 — LA CONFIGURATION EST NORMALISEE AVANT D'ETRE INDEXEE.
  //
  // Firebase rend sessions_config sous forme d'OBJET des qu'un creneau manque :
  // {0:…, 3:…}. `.length` vaut alors undefined, `i < undefined` est faux, et la
  // boucle ci-dessous ignorait TOUTES les seances — sans erreur, sans message,
  // sans rien. Le coach importait un programme et repartait en croyant l'avoir
  // publie. Le fichier dispose deja de _normaliserSessionsConfig, utilise a
  // quatre endroits pour exactement ce risque : c'est le cinquieme.
  try{ _normaliserSessionsConfig(u); }catch(e){}
  let _ecrites=0;
  seances.forEach((s,i)=>{
    if(i<u.sessions_config.length){
      u.sessions_config[i].name=s.name;
      u.sessions_config[i].exercises=s.exercises;
      u.sessions_config[i].active=true;
      // Séance issue du PDF du coach : publiée, donc plus un exemple.
      delete u.sessions_config[i]._essai;delete u.sessions_config[i]._foundation;
      _ecrites++;
    }
  });
  // ET UN IMPORT QUI N'ECRIT RIEN LE DIT. Se taire etait le vrai defaut : la
  // normalisation ci-dessus couvre le cas connu, elle ne couvre pas celui
  // qu'on n'a pas vu.
  if(!_ecrites){
    toast('Aucune séance importée : la configuration de cet athlète n’a pas pu être lue.','var(--red)');
    return;
  }
  u.updatedAt=Date.now();
  users[email]=u;
  let ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(email,u);
  if(email===currentUser?.email){
    currentUser.sessions_config=u.sessions_config;
    // Les deux écritures comptent : ok=DB.set(...)&&ok court-circuiterait la
    // seconde si la première a échoué.
    ok=DB.set('session',currentUser)&&ok;
  }
  closeModal();
  toastSync(ok,envoi,seances.length+' séances importées dans le programme  !','les séances sont');
  if(email===currentUser?.email) loadSessionManager();
}

// ======= COACH: AJOUTER ATHLÈTE DIRECTEMENT =======
function openAddAthlete(){
  // Les deux accordent l'accès depuis R-03. La phrase diffère seulement
  // parce que l'affilié est plafonné à 12 mois par code et le créateur non :
  // annoncer la même durée aux deux serait faux pour l'un des deux.
  const estCreateur=currentUser?.email===CREATOR_EMAIL;
  const html=`<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 20px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto">
    <h2 style="margin-bottom:6px">Ajouter un athlète</h2>
    <p class="sub" style="margin-bottom:8px;font-size:var(--fs-sm)">${estCreateur
      ?'Crée le compte et active l\'accès en une seule étape. Ton élève se connectera avec l\'email et le mot de passe que tu saisis ici.'
      :'Crée le compte de ton élève : il se connectera avec l\'email et le mot de passe que tu saisis ici. Son accès est ouvert pour la durée choisie ci-dessous.'}</p>
    <div><label style="margin-top:10px" for="aa-fname">Prénom</label><input id="aa-fname" placeholder="Prénom de l'athlète"></div>
    <div><label style="margin-top:10px" for="aa-lname">Nom</label><input id="aa-lname" placeholder="Nom de l'athlète"></div>
    <div><label style="margin-top:10px" for="aa-email">Email</label><input type="email" id="aa-email" placeholder="email@exemple.com"></div>
    <div><label style="margin-top:10px" for="aa-pwd">Mot de passe (provisoire, 6 caractères minimum)</label><input type="text" id="aa-pwd" placeholder="Ex: repcore123"></div>
    <div><label style="margin-top:10px" for="aa-phone">Numéro WhatsApp <span style="color:var(--sub);font-weight:400">(facultatif)</span></label><input type="tel" id="aa-phone" placeholder="+33612345678" inputmode="tel"><div class="sub" style="font-size:var(--fs-xs);margin-top:4px">Avec l'indicatif pays. Sert à ouvrir WhatsApp pré-rempli depuis sa fiche.</div></div>
    <div><label style="margin-top:10px" for="aa-gender">Genre</label><select id="aa-gender"><option value="H">Homme</option><option value="F">Femme</option></select></div>
    ${`<div><label style="margin-top:10px" for="aa-duration">Durée d'accès</label><select id="aa-duration" style="width:100%;background:var(--surface-2);border:1px solid var(--border);color:var(--text);padding:12px 14px;border-radius:var(--r-3);font-family:Montserrat,sans-serif;font-size:var(--fs-md);cursor:pointer">
      <option value="1">1 mois</option>
      <option value="3" selected>3 mois (recommandé)</option>
      <option value="6">6 mois</option>
      <option value="12">12 mois</option>
    </select></div>`}
    <div id="aa-err" style="color:var(--red-light);font-size:var(--fs-sm);margin-top:8px;display:none"></div>
    <div style="position:sticky;bottom:0;height:36px;background:linear-gradient(transparent,var(--surface-2));pointer-events:none;margin-top:-40px"></div>
    <button class="btn btn-red" style="margin-top:10px" onclick="createAthlete()">${estCreateur?'Créer et activer l\'accès':'Créer le compte'}</button>
    <button class="btn btn-outline" style="margin-top:10px" onclick="closeModal()">Annuler</button>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
// Échap ferme la modale, quand le fond la ferme deja au clic. Le balisage
// porte l'intention : `onclick="closeModal()"` sur l'overlay signifie
// « renvoyable », `onclick=""` signifie « il faut trancher ». On ne cree
// donc aucune politique nouvelle, on rend la meme accessible au clavier.
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape') return;
  // LE LEXIQUE D'ABORD : il peut s'ouvrir PAR-DESSUS une modale, et Echap
  // defait le dernier geste, pas l'avant-dernier. C'est la troisieme sortie
  // demandee, avec le voile et « J'ai compris ».
  // L'ACHAT D'ABORD : c'est la feuille la plus recente a l'ecran, et Echap
  // defait le dernier geste. Un paiement qu'on n'arrive pas a fermer est la
  // pire des impasses.
  const ah=document.getElementById('rc-achat');
  if(ah&&ah.style.display==='flex'&&!ah.dataset.sortie){
    e.preventDefault(); try{ fermerAchatProgramme(); }catch(x){} return;
  }
  // La fiche de vente d'un programme du coach : meme rang que les autres
  // feuilles statiques, et Echap doit la fermer comme le voile et la croix.
  const pv=document.getElementById('rc-progvente');
  if(pv&&pv.style.display==='flex'&&!pv.dataset.sortie){
    e.preventDefault(); try{ fermerVenteProgramme(); }catch(x){} return;
  }
  const ct=document.getElementById('rc-contact');
  if(ct&&ct.style.display==='flex'&&!ct.dataset.sortie){
    e.preventDefault(); try{ fermerContactCoach(); }catch(x){} return;
  }
  const lx=document.getElementById('rc-lexique');
  if(lx&&lx.style.display==='flex'&&!lx.dataset.sortie){
    e.preventDefault(); try{ rcInfoFermer(); }catch(x){} return;
  }
  const hx=document.getElementById('rc-histo');
  if(hx&&hx.style.display==='flex'&&!hx.dataset.sortie){
    e.preventDefault(); try{ fermerHistoriqueExo(); }catch(x){} return;
  }
  // R27 — la fiche de la boutique, APRES le lexique : il peut s'ouvrir
  // par-dessus elle, et Echap defait le dernier geste.
  const vb=document.getElementById('rc-vente');
  if(vb&&vb.style.display==='flex'&&!vb.dataset.sortie){
    e.preventDefault(); try{ fermerFicheVente(); }catch(x){} return;
  }
  // R26 — « Mon approche ». Aucun lexique ne s'ouvre depuis elle : l'ordre
  // avec lui est indifferent.
  const dc=document.getElementById('rc-diete');
  if(dc&&dc.style.display==='flex'&&!dc.dataset.sortie){
    e.preventDefault(); try{ fermerChoixDiete(); }catch(x){} return;
  }
  const ov=document.getElementById('modal-overlay');
  if(!ov) return;
  const oc=ov.getAttribute('onclick')||'';
  if(oc.indexOf('closeModal')<0&&oc.indexOf('this.remove')<0) return;
  e.preventDefault();
  try{ closeModal(); }catch(x){ ov.remove(); }
});
// LA FERMETURE DES TROIS CALQUES STATIQUES. Meme discipline que closeModal :
// pointer-events coupes tout de suite, le noeud reste 140 ms, puis display:none.
// `tout_de_suite` sert a go() : une feuille qui sortirait en fondu par-dessus
// le nouvel ecran serait pire que le clignotement d'avant.
function _feuilleFermer(id,tout_de_suite){
  const z=document.getElementById(id);
  if(!z||z.style.display!=='flex') return;
  z.classList.remove('arc-entree');
  if(tout_de_suite||arcReduit()||!z.animate){
    z.classList.remove('arc-sortie'); delete z.dataset.sortie;
    z.style.display='none'; return;
  }
  z.dataset.sortie='1';
  z.classList.add('arc-sortie');
  setTimeout(()=>{
    try{ z.classList.remove('arc-sortie'); delete z.dataset.sortie; z.style.display='none'; }catch(e){}
  },ARC.strike);
}
// L'ouverture, en pendant : une animation CSS repart d'elle-meme quand un
// element passe de display:none a affiche, il n'y a rien a relancer.
function _feuilleOuvrir(id){
  const z=document.getElementById(id);
  if(!z) return null;
  z.classList.remove('arc-sortie'); delete z.dataset.sortie;
  z.style.display='flex';
  z.classList.add('arc-entree');
  return z;
}
function closeModal(){
  // Le temps du coach, relu une fois la feuille retirée (micro-tâche : après le retrait de l'identifiant).
  try{ Promise.resolve().then(_chronoTick); }catch(e){}
  if(typeof _audioMediaRecorder!=='undefined'&&_audioMediaRecorder&&_audioMediaRecorder.state==='recording') cancelAudioAnnotation();
  const o=document.getElementById('modal-overlay');
  if(!o) return;
  // ── ANIMATION 8 : LA SORTIE ─────────────────────────────────────────────
  // L'IDENTIFIANT PART TOUT DE SUITE, le nœud 140 ms plus tard. C'est ce qui
  // rend la sortie animée sans effet de bord : dès cette ligne,
  // getElementById('modal-overlay') ne trouve plus rien, et une feuille
  // ouverte dans la foulée est la SEULE que le reste du code puisse voir.
  // Sans cette précaution, fermer puis rouvrir aurait fait pointer tout le
  // monde sur la feuille en train de mourir — un bogue invisible en lecture,
  // et parfaitement reproductible au doigt.
  o.removeAttribute('id');
  // ET TOUS LES IDENTIFIANTS DE SES ENFANTS. Retirer le seul « modal-overlay »
  // ne suffisait pas, et trois assertions existantes l'ont dit tout de suite :
  // le contenu de la feuille porte ses propres identifiants (« rc-pkg-modal »
  // et ses voisins), qui restaient trouvables pendant les 140 ms de la sortie.
  // Du code qui vérifie « la feuille est-elle partie ? » juste après un
  // closeModal() lisait donc « non ». Ce n'était pas un artefact de test :
  // c'était le mécanisme de refus d'import qui se croyait rouvert.
  try{ o.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id')); }catch(e){}
  o.setAttribute('aria-hidden','true');
  if(arcReduit()||!o.animate){ o.remove(); return; }
  o.classList.add('arc-sortie');
  // Filet : si l'onglet passe en arrière-plan pendant la sortie, aucune frame
  // n'est produite et l'événement d'animation n'arrive jamais. Le minuteur,
  // lui, finit par tomber — la feuille ne peut pas rester coincée à l'écran.
  setTimeout(()=>{ try{ o.remove(); }catch(e){} },ARC.strike);
}
async function createAthlete(){
  const fn=document.getElementById('aa-fname').value.trim();
  const ln=document.getElementById('aa-lname').value.trim();
  const em=document.getElementById('aa-email').value.trim().toLowerCase();
  const pw=document.getElementById('aa-pwd').value.trim();
  const gn=document.getElementById('aa-gender').value;
  // Le sélecteur existe pour tous depuis R-03 : la durée choisie par un
  // affilié est désormais celle de l'accès qu'il accorde. Le repli à 3 mois
  // couvre le cas où le sélecteur n'est pas rendu.
  const months=parseInt(document.getElementById('aa-duration')?.value)||3;
  const estCreateur=currentUser.email===CREATOR_EMAIL;
  const _err=m=>{const e=document.getElementById('aa-err');e.textContent=m;e.style.display='block';};
  if(!fn||!ln||!em||!pw){_err('Tous les champs sont obligatoires.');return;}
  if(pw.length<6){_err('Le mot de passe doit faire au moins 6 caractères.');return;}
  const users=DB.get('users')||{};
  // ══ ICI LA GARDE RESTE, MAIS ELLE DOIT DIRE CE QU'ELLE A TROUVÉ ════════
  //
  // ⚠ L'ANCRE D'ÉCRITURE N'EST PAS RECOPIÉE ICI : une sonde voisine repère la
  // ligne qui pose la fiche pour vérifier qu'elle vient APRÈS la création du
  // compte Auth, et elle retrouvait l'ancre dans ce commentaire même.
  //
  // Contrairement à l'inscription, ce chemin-ci pose la fiche de l'athlète
  // sous cette adresse sans rien adopter : le lever écraserait le dossier qui
  // porte déjà l'adresse — au pire celui du coach lui-même. La garde tient
  // donc.
  //
  // Ce qui ne tenait pas, c'est « Email déjà utilisé. » : trois situations
  // très différentes sortaient sous la même phrase, et aucune ne disait quoi
  // faire. Le coach qui essaie SA PROPRE adresse pour s'ajouter comme
  // athlète — le cas le plus courant — lisait un refus qui ressemblait à un
  // bug, puisque cette adresse est « la sienne », pas une adresse « déjà
  // utilisée » par quelqu'un d'autre.
  if(users[em]){
    const _d=users[em]||{};
    const _nom=((_d.fname||'')+' '+(_d.lname||'')).trim();
    let _msg;
    // DÉJÀ SON ATHLÈTE : rien à proposer. Le coach vient de le retrouver, pas
    // de buter sur une adresse — lui offrir une adresse de rechange ferait
    // passer un rappel pour un obstacle.
    let _sansSortie=false;
    if(currentUser&&em===String(currentUser.email||'').toLowerCase())
      _msg='C\'est ton adresse de coach : elle porte déjà ton compte.';
    else if(_estMonAthlete(_d,currentUser)){
      _msg=(_nom||em)+' est déjà dans tes athlètes : sa fiche est sur ton tableau de bord.';
      _sansSortie=true;
    } else
      _msg='Cette adresse porte déjà un dossier sur cet appareil'+(_nom?' ('+_nom+')':'')+'.';
    // LA SORTIE, quand le fournisseur la permet : le sous-adressage donne au
    // coach son compte athlète sans seconde boîte mail. Hors liste blanche,
    // on ne promet rien — voir _aliasSecondCompte.
    const _alias=_sansSortie?null:_aliasSecondCompte(em,'athlete',users);
    const _e=document.getElementById('aa-err');
    if(_alias&&_e){
      _e.innerHTML=escapeHtml(_msg)
        +' Pour un compte athlète EN PLUS sur la même boîte mail, utilise '
        +'<b style="color:var(--text);word-break:break-all">'+escapeHtml(_alias)+'</b>.'
        +'<button type="button" id="aa-alias-btn" class="btn btn-outline btn-sm"'
        +' style="width:100%;margin-top:10px;letter-spacing:1px;font-size:var(--fs-xs)">'
        +'Utiliser cette adresse</button>';
      _e.style.display='block';
      // Le gestionnaire est POSÉ EN JS, jamais écrit dans l'attribut : une
      // adresse peut contenir une apostrophe, et elle casserait le onclick.
      const _bt=document.getElementById('aa-alias-btn');
      if(_bt) _bt.onclick=()=>{
        const _i=document.getElementById('aa-email');
        if(_i){ _i.value=_alias; try{ _i.focus(); }catch(e){} }
        _e.style.display='none';
      };
    } else {
      _err(_sansSortie?_msg
        :_msg+' Pour un compte athlète en plus, il te faut une autre adresse email.');
    }
    return;
  }

  // Le compte Firebase Auth est créé AVANT d'écrire l'athlète : sans lui, la
  // fiche existait dans la base mais le mot de passe annoncé au coach n'ouvrait
  // rien. Pire, l'email restant inconnu de Firebase Auth, le repli signUp de
  // CLOUD.signIn laissait n'importe qui prendre le compte avec le mot de passe
  // de son choix. createAuthAccount ne touche pas à la session du coach.
  let motDePasseActif=true;
  const auth=await CLOUD.createAuthAccount(em,pw);
  if(!auth.ok){
    if(auth.err==='exists'){
      // L'élève possède déjà un compte : on le rattache, mais son mot de passe
      // actuel reste le sien — on ne peut pas le remplacer sans le connaître.
      motDePasseActif=false;
    } else {
      _err(
        auth.err==='weak'    ? 'Mot de passe trop faible : 6 caractères minimum.' :
        auth.err==='email'   ? 'Adresse email invalide.' :
        auth.err==='network' ? 'Pas de connexion : impossible de créer le compte maintenant.' :
        auth.err==='config'  ? 'Synchronisation non configurée : impossible de créer le compte.' :
                               'Création du compte impossible. Réessaie.'
      );
      return;
    }
  }
  const uid='u_'+Date.now();
  let gen;
  try{
    gen=await _genAccessCode(fn+' '+ln,months);
  }catch(e){
    document.getElementById('aa-err').textContent=e.message||'Impossible de générer le code d\'accès : réessaie.';
    document.getElementById('aa-err').style.display='block';
    return;
  }
  const {token,payload}=gen;
  const expiry=payload.expiry;
  const athlete={id:uid,fname:fn,lname:ln,email:em,role:'athlete',gender:gn,
    createdAt:Date.now(),streak:0,lastSession:null,sessions:[],bilans:[],nutrition:{},videos:[],
    coachId:currentUser.id,coachName:currentUser.fname+' '+currentUser.lname,
    questionnaireComplete:false};
  // Facultatif : la fiche reste utilisable sans, WhatsApp demandera le contact.
  // Mais un numéro SAISI doit être exploitable, sinon le coach croira pouvoir
  // écrire et tombera sur « numéro invalide ».
  const tel=(document.getElementById('aa-phone')?.value||'').trim();
  if(tel&&_numWa(tel).length<8){
    _err('Numéro inutilisable : mets l\'indicatif pays sans le 0, ex : +33612345678');
    return;
  }
  if(tel) athlete.phone=tel;
  // R-03 : un affilié accorde l'accès comme le créateur. L'ancien code posait
  // FREE ici, ce qui envoyait l'athlète sur s-client-code — le défaut même
  // que ce lot corrige. Le plafond a déjà été appliqué par _genAccessCode,
  // qui refuse au-delà : expiry est donc dans les clous.
  athlete.status='COACHING_SUIVI';
  athlete.accessExpiry=expiry;
  if(!currentUser.studentCodes) currentUser.studentCodes=[];
  currentUser.studentCodes.push({...payload,token,usedBy:fn+' '+ln,athleteEmail:em,active:true,redeemed:true,createdAt:Date.now(),etat:'cree',creeLe:new Date().toISOString()});
  if(!currentUser.clients) currentUser.clients=[];
  currentUser.clients.push(uid);
  athlete.updatedAt=Date.now();users[em]=athlete;
  users[currentUser.email]=currentUser;
  const okU=DB.set('users',users);
  // AUCUN envoi du dossier de l’athlète. La règle .write de /users exige
  // data.child('coachEmailKey') NON NULL : sur un nœud qui n’existe pas
  // encore, `data` est null et l’écriture est refusée. Le coach ne PEUT pas
  // créer le dossier distant de son athlète — et c’est voulu, un coach n’a
  // pas à fabriquer un dossier de données personnelles pour quelqu’un qui
  // n’a encore rien accepté.
  //
  // Le push a donc été retiré, et pas seulement le message : un envoi rejeté
  // passe par _enfiler + _queueRetry, donc était rejoué à chaque démarrage
  // pour être refusé à chaque fois. Chaque athlète créé laissait une entrée
  // morte dans la file de reprise.
  //
  // Le dossier naît chez l’athlète : il se connecte, saisit son code, et
  // _appliquerPayloadCode pose coachId, coachEmailKey, status et accessExpiry
  // sur SON dossier, qu’il a le droit d’écrire. Le coach, lui, part bien —
  // DB.set('users') pousse son propre document, qui porte studentCodes.
  const okS=DB.set('session',currentUser);
  closeModal();
  // Copy token to clipboard for convenience
  try{navigator.clipboard?.writeText(token);}catch{}
  const exp=new Date(expiry).toLocaleDateString('fr-FR');
  // CE QUI EST VRAI, ET CE QUI RESTE À FAIRE.
  //
  // Le compte Firebase Auth, lui, existe : « il peut se connecter » est exact.
  // Ce qui ne l’était pas, c’est le sous-entendu que tout était fini. Tant que
  // l’athlète n’a pas saisi son code, il n’est rattaché à personne côté
  // serveur, et sa fiche reste l’ébauche issue du code.
  //
  // Le message ne distingue pas créateur et affilié : les deux accordent
  // l'accès, et annoncer autre chose serait faux.
  const _aFaire=" Envoie-lui le CODE (copié) : tant qu'il ne l'a pas saisi à sa première connexion, sa fiche reste vide chez toi.";
  // « IL PEUT SE CONNECTER », et non « il se connecte » : c'est le mot que le
  // commentaire ci-dessus defend, et il porte tout le sens. Le compte
  // d'authentification existe — la possibilite est donc exacte — mais rien n'est
  // fait tant que l'athlete n'a pas saisi son code, ce que la phrase suivante
  // dit. « Il se connecte » se lisait comme un fait accompli, soit exactement le
  // sous-entendu que ce commentaire existe pour ecarter.
  //
  // ET RIEN NE S'INTERCALE ENTRE `motDePasseActif` ET SON `?` : une sonde de la
  // suite lit ce ternaire d'un bloc pour verifier que les deux cas restent
  // distingues, et un commentaire pose au milieu suffit a la rendre aveugle.
  const messageFinal=(motDePasseActif
    ? ICO.coche+' '+fn+' créé : il peut se connecter avec cet email et ce mot de passe.'
    : ICO.coche+' '+fn+' rattaché : il avait déjà un compte, il garde SON mot de passe.')
    +_aFaire+' Accès jusqu\'au '+exp;
  toastEcriture(okU&&okS,messageFinal,'le compte est');
  loadCoachHome();
}

// ══════════════ L'ÉCRAN D'INSTALLATION : QUI VOIT QUOI ══════════════════
//
// Cinq situations, cinq messages, et JAMAIS DEUX À LA FOIS. La règle
// d'exclusion n'est pas décorative : un téléphone Android dans le navigateur
// d'Instagram satisfait à la fois « Chromium » et « navigateur intégré », et
// lui montrer un bouton d'installation qui ne peut pas aboutir est pire que
// de ne rien lui montrer. On éteint donc tout, puis on rallume UN bloc.
//
// L'ORDRE DES TESTS EST LA DÉCISION. Il se lit du plus contraignant au plus
// permissif : déjà installé, puis prisonnier d'un navigateur intégré, puis
// devant un ordinateur, puis les deux chemins qui installent vraiment.
//
// ⚠ L'ORDINATEUR PASSE AVANT LE BOUTON D'INSTALLATION, contrairement à l'ordre
// de la demande, et c'est délibéré : Chrome de bureau déclenche
// beforeinstallprompt lui aussi, et RepCore s'utilise en salle, pas au bureau.
// Sur un ordinateur, le geste utile est de faire passer l'adresse au téléphone.
// L'installation locale reste offerte, en second rang, quand le navigateur la
// propose — on ne retire pas une capacité, on choisit ce qu'on met devant.
// L'INVITATION N'EST PLUS CAPTUREE ICI. Elle l'est dans le <head>, avant tout
// le reste : ce bloc-ci est analyse apres quatre megaoctets de code, et
// l'evenement etait souvent deja passe. On CONSOMME ce que la tete a retenu.
//
// UN SEUL ECOUTEUR SUR beforeinstallprompt, celui de la tete. Deux ecouteurs
// sur le meme evenement, c'etait deux verites sur l'etat d'installabilite, et
// celle du bas gagnait — donc la plus tardive, donc la plus souvent vide.
Object.defineProperty(window,'deferredPrompt',{
  get(){ return window.__rcInstallEvt; },
  set(v){ window.__rcInstallEvt=v; },
  configurable:true
});

// ══════════ LES NAVIGATEURS INTÉGRÉS ═══════════════════════════════════
//
// LE LIEN DE L'APPLICATION SE DIFFUSE DEPUIS INSTAGRAM, et un lien ouvert
// depuis Instagram, Messenger, TikTok ou LinkedIn ne s'ouvre pas dans le
// navigateur du téléphone : il s'ouvre dans le navigateur MAISON de ces
// applications. Là, l'installation est strictement impossible —
// beforeinstallprompt ne se déclenche jamais sur Android, et le menu
// « Partager → Sur l'écran d'accueil » n'existe pas sur iOS.
//
// ON FAIT DONC SORTIR, ON NE PROPOSE PAS D'INSTALLER. Un bouton qui ne peut
// pas aboutir se lit comme un bug de l'application, pas comme une limite du
// navigateur — et c'est RepCore qu'on accuse.
//
// ⚠ CES CHAÎNES CHANGENT AVEC LES VERSIONS. Chacune est commentée avec ce
// qu'elle vise et un exemple réel relevé le 02/09/2026, pour que le prochain
// qui les relit sache ce qu'il tient. La détection d'agent utilisateur est
// approximative par nature : c'est pourquoi rien ici ne BLOQUE — l'écran
// garde toujours sa sortie vers l'accueil.
//
// Rend le NOM de l'application, ou null. Un nom plutôt qu'un booléen parce
// que l'instruction à donner en dépend : le menu n'est pas au même endroit
// dans Instagram et dans Messenger.
const RC_IAB=[
  // « Instagram 309.0.0.40.113 Android (34/14; …) » côté Android, et
  // « … Mobile/15E148 Instagram 147.0.0.30.121 (iPhone9,3; …) » côté iOS :
  // le nom est écrit en clair dans les deux.
  {cle:'instagram', nom:'Instagram', re:/Instagram/i},
  // FBAN = Facebook App, FBAV = Facebook App Version, FB_IAB = Facebook
  // In-App Browser. Messenger se présente sous « FB_IAB/MESSENGER » et
  // « FB_IAB/Orca-Android », le Facebook iOS sous « FBAN/FBIOS ».
  {cle:'facebook',  nom:'Messenger', re:/FBAN|FBAV|FB_IAB|Messenger/i},
  // BytedanceWebview est le moteur de TikTok ; musical_ly est l'ancien nom de
  // l'application, encore présent dans des versions en circulation.
  {cle:'tiktok',    nom:'TikTok',    re:/BytedanceWebview|TikTok|musical_ly/i},
  {cle:'linkedin',  nom:'LinkedIn',  re:/LinkedInApp/i},
  {cle:'snapchat',  nom:'Snapchat',  re:/Snapchat/i},
  // X n'a pas renommé son jeton : il s'annonce toujours « Twitter ».
  {cle:'twitter',   nom:'X',         re:/Twitter/i}
];
function rcNavigateurIntegre(){
  try{
    const u=String(navigator.userAgent||'');
    for(const a of RC_IAB) if(a.re.test(u)) return a.nom;
    // ── LE FILET GÉNÉRIQUE, iOS SEULEMENT ──────────────────────────────
    //
    // Toute vue web iOS embarquée passe par WebKit et n'a PAS le jeton
    // « Safari » que le vrai Safari écrit en fin d'agent. C'est ce qui
    // attrape les applications qu'on n'a pas nommées.
    //
    // navigator.standalone DÉPARTAGE LES DEUX CAS QUI RESTENT : Safari le
    // pose à false, une application installée à true, et une vue embarquée
    // ne le pose PAS DU TOUT. Sans lui, l'application déjà installée serait
    // prise pour un navigateur intégré — et se verrait proposer d'en sortir.
    if(/iPhone|iPad|iPod/i.test(u)&&/AppleWebKit/i.test(u)
       &&!/Safari/i.test(u)&&navigator.standalone===undefined) return 'une application';
  }catch(e){}
  return null;
}
// ══════════ SAMSUNG INTERNET : LE NAVIGATEUR QUI INSTALLE MAL ══════════
//
// CE N'EST PAS UN NAVIGATEUR INTEGRE, et les confondre serait faux : Samsung
// Internet est le navigateur par defaut de tous les telephones Samsung, il
// declenche bien beforeinstallprompt, et il SAIT installer. Le probleme est
// ailleurs, et il est entier.
//
// UNE PWA NE S'INSTALLE PAS TOUTE SEULE SUR ANDROID : le navigateur envoie le
// manifeste a un serveur qui FABRIQUE une vraie APK — une « WebAPK » — et la
// renvoie signee. Celui de Chrome la fabrique avec targetSdkVersion ≥ 34.
// Celui de Samsung la fabrique EN DESSOUS, et Android 14 et suivants refusent
// alors l'installation : « conçue pour une version plus ancienne d'Android,
// n'inclut pas les derniers dispositifs de protection ».
//
// AUCUN CHAMP DU MANIFESTE NE CHANGE CA. Le manifeste de RepCore est valide —
// Page.getAppManifest, c'est-a-dire l'analyseur de Chrome lui-meme, ne rend
// aucune erreur dessus — et la meme PWA s'installe sans un mot depuis Chrome.
// Le defaut est chez Samsung ; la seule chose que RepCore puisse faire est de
// ne pas y envoyer les gens. Signale le 02/09/2026 par Kevin sur son propre
// telephone, Android 15.
//
// PURE. Rend la version de Samsung Internet, ou null.
function rcNavigateurSamsung(){
  try{
    const m=String(navigator.userAgent||'')
      .match(/SamsungBrowser\/([0-9]+(?:\.[0-9]+)?)/i);
    return m?m[1]:null;
  }catch(e){ return null; }
}
// ⚠ LA CONDITION « ANDROID 14 OU PLUS » A ETE RETIREE, ET C'ETAIT LA MIENNE.
// Je l'avais deduite d'un rapport de bogue qui parlait d'Android 14+, puis
// posee comme une VERIFICATION alors que je n'avais aucun moyen de connaitre
// la version du telephone de Kevin. Sur un Android 13, rcNavigateurSamsung
// rendait null, la branche S ne se levait pas, la branche C offrait son bouton
// d'installation — et le refus tombait exactement comme avant. Trois lots
// livres, trois fois « ca persiste », et la cause etait une condition que
// j'avais inventee.
//
// LE COUT DES DEUX ERREURS N'EST PAS LE MEME. Detourner un Samsung qui aurait
// pu installer coute un geste de menu en plus. Ne PAS le detourner coute une
// installation impossible et une personne qui abandonne. On detourne.
//
// PURE. Rend la raison pour laquelle l'invitation du navigateur ne doit pas
// etre demandee ici, ou null.
//
// LISTE BLANCHE, ET NON LISTE NOIRE. Les seuls navigateurs Android dont on
// SAIT qu'ils fabriquent une WebAPK acceptee sont Chrome et Edge. Tout le
// reste part sur le chemin manuel — qui, lui, marche partout, puisqu'il
// n'installe aucun paquet. Une liste noire aurait laisse passer le prochain
// navigateur inconnu ; celle-ci ne laisse passer que ce qui est verifie.
const RC_ANDROID_SAIT_INSTALLER=/Chrome\/[0-9]/i;
const RC_ANDROID_PAS_CHROME=/SamsungBrowser|OPR\/|OPX\/|UCBrowser|MiuiBrowser|HeyTapBrowser|VivoBrowser|OppoBrowser|QuarkBrowser|Whale|YaBrowser|DuckDuckGo|Brave|Ecosia|Instagram|FBAN|FBAV|FB_IAB/i;
// LE MODE DEBOGAGE : ?debug=1 dans l'adresse, ou localStorage rc_debug = '1'
// (pour le garder d'une ouverture a l'autre). Il montre les reperes techniques
// que l'utilisateur n'a pas a voir (numero de build de s-install).
function rcModeDebug(){
  try{ if(/[?&]debug=1(&|$)/.test(location.search||'')) return true; }catch(e){}
  try{ return localStorage.getItem('rc_debug')==='1'; }catch(e){ return false; }
}
function rcInstallBloquePar(){
  try{
    const u=String(navigator.userAgent||'');
    // iOS et ordinateur ne passent pas par une WebAPK : rien a bloquer.
    if(!/Android/i.test(u)) return null;
    if(/SamsungBrowser/i.test(u)) return 'samsung';
    const edge=/EdgA\//i.test(u);
    if(edge) return null;
    if(RC_ANDROID_SAIT_INSTALLER.test(u)&&!RC_ANDROID_PAS_CHROME.test(u)) return null;
    return 'autre';
  }catch(e){ return null; }
}
// La CLÉ de compteur associée au nom rendu ci-dessus. Séparée du nom affiché :
// l'un se lit à l'écran, l'autre part dans /metrics et doit rester stable.
function _rcIabCle(nom){
  for(const a of RC_IAB) if(a.nom===nom) return 'iab_'+a.cle;
  return 'iab_autre';
}
// ══════════ LA SORTIE ══════════════════════════════════════════════════
// `opts.sansRepli` — SANS S.browser_fallback_url.
//
// ⚠ LE REPLI RENVOIE DANS LE NAVIGATEUR PAR DEFAUT, ET C'EST UNE BOUCLE quand
// c'est LUI qu'on essaie de quitter. Signale par Kevin le 02/09/2026 :
// « ça persiste et envoie sur le navigateur samsung ». Le format intent prevoit
// S.browser_fallback_url pour le cas ou le paquet nomme n'est pas installe —
// Android ouvre alors cette adresse dans le navigateur par defaut. Depuis une
// vue embarquee, ce navigateur est un VRAI navigateur : c'est exactement la
// sortie qu'on cherche. Depuis Samsung Internet, le navigateur par defaut EST
// Samsung Internet : on revient d'ou l'on part, et la page se recharge, ce qui
// tue au passage le minuteur de 1,5 s qui aurait montre les instructions.
// Sans repli, l'intent echoue franchement, le minuteur tire, et on explique.
function rcOuvrirDansNavigateur(opts){
  const u=(()=>{ try{ return location.href; }catch(e){ return ''; } })();
  const nom=rcNavigateurIntegre()||(rcNavigateurSamsung()?'Samsung Internet':'cette application');
  const est_iOS=(()=>{ try{ return /iPhone|iPad|iPod/i.test(navigator.userAgent||''); }catch(e){ return false; } })();
  // ── ANDROID : l'URL intent, qui existe pour exactement ça ────────────
  //
  // Elle demande au système d'ouvrir l'adresse dans Chrome plutôt que dans
  // la vue embarquée. S.browser_fallback_url est la porte de secours prévue
  // par le format lui-même quand le paquet nommé n'est pas installé.
  if(!est_iOS){
    try{
      const a=document.createElement('a'); a.href=u;
      const cible='intent://'+a.host+a.pathname+a.search
        +'#Intent;scheme=https;package=com.android.chrome;'
        +((opts&&opts.sansRepli)?'':'S.browser_fallback_url='+encodeURIComponent(u)+';')
        +'end';
      // SI RIEN NE SE PASSE, ON NE LAISSE PAS L'ÉCRAN MUET. Chrome peut ne
      // pas être installé, et certaines vues embarquées refusent purement et
      // simplement le schéma intent — sans erreur, sans rien. Une seconde et
      // demie plus tard, on retombe sur la sortie manuelle, qui marche
      // partout.
      let parti=false;
      try{ document.addEventListener('visibilitychange',()=>{ if(document.hidden) parti=true; },{once:true}); }catch(e){}
      setTimeout(()=>{ if(!parti) _rcSortieManuelle(nom,u); },1500);
      window.location.href=cible;
      return true;
    }catch(e){ /* on retombe sur la sortie manuelle */ }
  }
  // ── iOS : AUCUN ÉQUIVALENT N'EXISTE ──────────────────────────────────
  // Pas d'URL intent, pas d'API pour changer de navigateur. Tout ce qu'on
  // peut faire, c'est mettre l'adresse dans le presse-papier et dire où
  // toucher. C'est peu, et c'est tout ce qu'il y a.
  _rcSortieManuelle(nom,u);
  return true;
}
// La copie, avec son repli. navigator.clipboard n'existe pas avant iOS 13.4
// et exige un contexte sécurisé ; execCommand('copy') sur un champ caché
// marche depuis toujours, et c'est le seul filet pour les vieux Safari.
function _rcCopier(txt){
  return new Promise(res=>{
    try{
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(txt).then(()=>res(true),()=>res(_rcCopierVieux(txt)));
        return;
      }
    }catch(e){}
    res(_rcCopierVieux(txt));
  });
}
function _rcCopierVieux(txt){
  try{
    const i=document.createElement('textarea');
    i.value=txt;
    // HORS DE L'ÉCRAN MAIS PAS display:none : un champ non rendu n'est pas
    // sélectionnable, et la copie échoue en silence.
    i.style.cssText='position:fixed;top:-1000px;left:-1000px;opacity:0';
    i.setAttribute('readonly','');
    document.body.appendChild(i);
    i.select(); i.setSelectionRange(0,txt.length);
    const ok=document.execCommand('copy');
    i.remove();
    return !!ok;
  }catch(e){ return false; }
}
// Ce qu'on montre quand aucune sortie automatique n'est possible. Le bloc vit
// dans l'écran d'installation, il est rempli ici.
function _rcSortieManuelle(nom,u){
  const z=document.getElementById('rc-inst-sortie');
  const adr=document.getElementById('rc-inst-lien');
  if(adr) adr.textContent=u;
  // L'INSTRUCTION DÉPEND DE L'APPLICATION : le menu n'est pas au même endroit,
  // et « touche le menu » sans dire où ne sert à personne.
  const où=nom==='Instagram'
      ? 'Touche le menu <b>en haut à droite</b>, puis « Ouvrir dans le navigateur ».'
    : nom==='Messenger'
      ? 'Touche le menu <b>en bas à droite</b>, puis « Ouvrir dans Safari ».'
    // SAMSUNG INTERNET N'EST PAS UNE VUE EMBARQUEE : il n'a pas de « ouvrir
    // dans le navigateur », puisqu'il EST le navigateur. Le seul geste qui
    // reste est d'ouvrir Chrome et d'y coller l'adresse — deja copiee.
    // Sans ce cas, un Android lisait « ouvre Safari ».
    : nom==='Samsung Internet'
      ? 'Ouvre <b>Chrome</b> et colle le lien dans sa barre d\'adresse. Si Chrome n\'est pas installé, prends-le sur le Play Store.'
      : 'Ouvre Safari et colle le lien.';
  const q=document.getElementById('rc-inst-quoi');
  if(q) q.innerHTML=où;
  if(z) z.style.display='block';
  _rcCopier(u).then(ok=>{
    const c=document.getElementById('rc-inst-copie');
    if(c){
      // ON NE DIT « COPIÉ » QUE SI ÇA L'EST. Un accusé de réception faux fait
      // coller dans le vide, et c'est pire que pas d'accusé du tout.
      _texteIco(c,ok?ICO.coche+' Lien copié':'Sélectionne l’adresse ci-dessous et copie-la.');
      c.style.color=ok?'var(--green)':'var(--orange)';
      c.style.display='block';
    }
  });
  return true;
}
// L'ÉCRAN DE DÉPART. Trois cas rendent la proposition d'installation inutile
// ou insistante, et dans ces trois cas on entre comme avant :
//   • l'application tourne DÉJÀ en autonome — il n'y a plus rien à installer ;
//   • deux refus ont été comptés — la troisième fois, c'est du harcèlement ;
//   • une session est ouverte — quelqu'un qui revient veut son écran, pas une
//     offre. Il installera par le bouton de l'accueil, qui n'a pas bougé.
//
// LE FRAGMENT #install FORCE L'ÉCRAN, et c'est le lien de la page de vente :
// « INSTALLER L'APPLICATION » pointe sur app/#install. Il passe devant le
// compteur de refus — on vient de demander à installer, ce n'est pas le moment
// de faire valoir un refus d'hier.
// `frag` EST UN PARAMETRE, et il vaut le fragment courant par defaut. Sans lui,
// eprouver la regle du #install obligeait a ECRIRE dans location.hash — une
// ecriture qui survit a l'assertion, change l'URL de la page pour tout ce qui
// suit, et rend la suite non rejouable. Mesure : la sonde passait au premier
// tour et tombait aux suivants. Un parametre ne laisse rien derriere lui.
function rcEcranDeDepart(frag){
  const _h=(frag===undefined?(function(){ try{ return location.hash; }catch(e){ return ''; } })():frag);
  try{ if(String(_h||'').toLowerCase()==='#install'&&!rcInstallAutonome()) return 's-install'; }catch(e){}
  if(rcInstallAutonome()) return 's-welcome';
  try{ if((parseInt(localStorage.getItem(RC_INST_REFUS),10)||0)>=2) return 's-welcome'; }catch(e){}
  try{ if(localStorage.getItem('rc_session')) return 's-welcome'; }catch(e){}
  return 's-install';
}
// L'INVITATION DU NAVIGATEUR, LUE PAR UNE FONCTION et non directement.
// Elle vit desormais dans le <head>, sous window.__rcInstallEvt, et
// `deferredPrompt` n'est plus qu'un accesseur qui pointe dessus — la capture
// tardive d'ici ne servait a rien.
// LA FONCTION RESTE, et c'est delibere : c'est la couture par laquelle la
// suite eprouve la branche F. Sans elle, un Chrome qui offre vraiment
// l'installation prendrait toujours la branche C, et le repli resterait a
// jamais non verifie.
function rcInstallInvite(){ return window.deferredPrompt; }
// ══════════ LE QR, DESSINE ICI ET NULLE PART AILLEURS ══════════════════
//
// AUCUN APPEL RESEAU. L'encodeur vit dans vendor/qr.js, embarque depuis le lot
// qui a retire le service tiers — celui-ci recevait l'adresse IP de chaque
// personne ouvrant la fenetre de synchronisation, pour dessiner des carres
// noirs. Un generateur en ligne ajouterait un sous-traitant a privacy.html, et
// certains transforment le lien en redirection qu'ils controlent.
//
// NOIR SUR BLANC, SANS COULEUR DE MARQUE. Le contraste conditionne la lecture,
// et un QR rouge sur fond carbone se lit mal ou pas du tout. La marge de
// quatre modules est imposee par la norme et versCanvas la pose deja.
//
// 240 PIXELS AU MINIMUM, et on le VERIFIE plutot que de l'esperer : versCanvas
// arrondit la taille d'un module a l'entier inferieur, donc la toile rendue est
// TOUJOURS plus petite que la taille demandee, et de combien depend du nombre
// de modules — lui-meme fonction de la longueur de l'adresse. On redemande donc
// jusqu'a depasser le plancher, plutot que d'etirer une image en CSS : un QR
// etire perd la nettete de ses bords, qui est exactement ce que le lecteur
// cherche.
function _rcQrDessiner(){
  const z=document.getElementById('rc-qr');
  if(!z) return false;
  z.innerHTML='';
  let cv=null;
  try{
    if(window.RepCoreQR&&RepCoreQR.versCanvas){
      for(let t=260;t<=460&&(!cv||cv.width<240);t+=40) cv=RepCoreQR.versCanvas(RC_LIEN_COURT,t);
    }
  }catch(e){ cv=null; }
  if(cv&&cv.width>=240){
    cv.style.display='block';
    z.style.width=z.style.height=cv.width+'px';
    z.appendChild(cv);
    return true;
  }
  // L'ENCODEUR MANQUE OU A ECHOUE : on ne laisse pas un carre blanc. L'adresse
  // est deja sous le code, en toutes lettres — on le dit, et on s'efface.
  z.style.display='none';
  return false;
}
// PURE. Déjà installé : la question ne se pose plus.
function rcInstallAutonome(){
  try{
    if(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches) return true;
  }catch(e){}
  return navigator.standalone===true;
}
// PURE. Un ordinateur : pas de pointeur grossier, et de la largeur.
function rcInstallBureau(){
  try{
    const grossier=window.matchMedia&&window.matchMedia('(pointer: coarse)').matches;
    return !grossier&&window.innerWidth>900;
  }catch(e){ return false; }
}
// PURE. iOS, quel que soit le navigateur — aucun n'y déclenche
// beforeinstallprompt, tous passent par « Sur l'écran d'accueil ».
function rcInstalliOS(){
  const u=String(navigator.userAgent||'');
  if(/iphone|ipad|ipod/i.test(u)) return true;
  // iPadOS 13+ se déclare « Macintosh » : le tactile le trahit.
  return /Macintosh/.test(u)&&navigator.maxTouchPoints>1;
}
// Le geste du bouton principal. Il change de sens selon la branche, et c'est
// rcInstallDecider qui l'a posé — pas ce lecteur-ci.
let _rcInstGeste=null;
function rcInstallAgir(){ try{ if(_rcInstGeste) _rcInstGeste(); }catch(e){} return true; }
// L'installation par le navigateur. __rcInstall appartient au lot suivant ;
// tant qu'elle n'existe pas, installApp() fait exactement le même geste.
function rcInstallLocal(){
  // MEME GARDE QUE installApp : voir _rcInstallDetourner.
  try{ if(_rcInstallDetourner()) return true; }catch(e){}
  try{
    if(typeof window.__rcInstall==='function'){
      // L'INVITE EST COMPTEE AVANT D'ETRE DEMANDEE, et seulement s'il y a
      // vraiment quelque chose a montrer : __rcInstall CONSOMME l'evenement
      // des sa premiere ligne, donc apres l'appel il n'y a plus rien a lire.
      // La compter apres coup donnerait zero a chaque fois.
      try{ if(window.__rcInstallEvt) rcm('install_invite_montree'); }catch(err){}
      // TROIS ISSUES, DEUX COMPTEURS — voir RCM_EVENEMENTS. La promesse est
      // enveloppee : __rcInstall en rend une, mais un doublon de test peut
      // rendre une chaine nue, et .then() leverait alors.
      Promise.resolve(window.__rcInstall()).then(c=>{
        if(c==='accepted') rcm('install_accepte');
        else if(c==='dismissed') rcm('install_refuse');
      }).catch(()=>{});
      return true;
    }
  }catch(e){}
  try{ installApp(); }catch(e){}
  return true;
}
// LE REFUS EST COMPTÉ. Au deuxième, l'écran ne se remet plus devant : insister
// une troisième fois ne convainc personne, ça agace. Le compteur vit dans le
// stockage local, protégé — un stockage plein ne doit pas empêcher de passer.
const RC_INST_REFUS='rc_install_refus';
// ══════ LA RELANCE : UNE BANNIERE, UNE FOIS, AU BON MOMENT ═════════════
//
// PRESQUE PERSONNE N'INSTALLE AU PREMIER CONTACT. On installe ce qu'on a
// deja utilise. L'ecran s-install s'adresse a quelqu'un qui ne connait pas
// encore l'application : la plupart le traversent, et ils ont raison.
//
// LE MOMENT EST LE FOND DU SUJET, PAS LA BANNIERE. « Juste apres une seance
// enregistree » est le seul instant ou l'installation se comprend sans
// explication : l'outil vient de servir, et le geste suivant est de le
// retrouver demain. Ailleurs, c'est de la publicite.
//
// AUCUN REARMEMENT. Deux fermetures valent un non definitif : ni delai qui
// le perime, ni compteur remis a zero, ni « une derniere fois ». Un non
// n'est pas une etape de negociation.
//
// LE COMPTEUR EST PARTAGE AVEC L'ECRAN. rc_install_refus est deja
// incremente par « Continuer sans installer » : passer l'ecran une fois PUIS
// fermer la banniere une fois suffit donc a eteindre les deux pour de bon.
// C'est voulu — ce sont deux refus de la meme proposition.
const RC_INST_VUE='rc_install_vue';
const RC_INST_REPOS_MS=72*3600*1000;
// Rend 'ok', ou la RAISON du refus. Une chaine et non un booleen, pour la
// meme raison que rcInstallDecider rend une lettre : la decision devient
// lisible depuis la console et depuis la suite, sans avoir a reconstituer
// cinq etats pour comprendre pourquoi rien ne s'affiche.
function rcBanniereInstallRaison(){
  // 1. DEJA INSTALLEE : il n'y a plus rien a proposer.
  try{ if(rcInstallAutonome()) return 'autonome'; }catch(e){}
  // 2. NAVIGATEUR INTEGRE : le bouton serait mort. s-install a une branche
  //    entiere pour ce cas ; la banniere n'a pas a la refaire en petit.
  try{ if(rcNavigateurIntegre()) return 'integre'; }catch(e){}
  // 3. PREMIER LANCEMENT : l'ecran a deja pose la question dans cette visite.
  try{ if(sessionStorage.getItem('rc_inst_ecran')) return 'ecran-deja-vu'; }catch(e){}
  // 4. UNE SEULE FOIS PAR VISITE.
  try{ if(sessionStorage.getItem('rc_ban_vue')) return 'deja-vue'; }catch(e){}
  // 5. DEUX REFUS, ET C'EST UN NON. Aucun code au-dela de cette ligne ne
  //    peut rallumer la banniere.
  try{ if((parseInt(localStorage.getItem(RC_INST_REFUS),10)||0)>=2) return 'refus'; }catch(e){}
  // 6. SOIXANTE-DOUZE HEURES DE REPOS entre deux propositions.
  try{
    const t=parseInt(localStorage.getItem(RC_INST_VUE),10)||0;
    if(t>0&&Date.now()-t<RC_INST_REPOS_MS) return 'repos';
  }catch(e){}
  return 'ok';
}
// Hauteur mesuree et non devinee — meme raison que _majHauteurTabbar : sous
// 380px le texte passe sur deux lignes et la bande grandit de 17px. Une
// constante en dur cacherait le dernier element de l'ecran.
function _majHauteurBanniere(){
  const b=document.getElementById('rc-ban-install');
  if(!b) return;
  const h=b.classList.contains('show')?b.offsetHeight:0;
  try{ document.documentElement.style.setProperty('--rc-ban-h',(h>0?h:0)+'px'); }catch(e){}
}
function rcBanniereInstallCacher(){
  const b=document.getElementById('rc-ban-install');
  if(b) b.classList.remove('show');
  try{ document.body.classList.remove('rc-ban'); }catch(e){}
  _majHauteurBanniere();
  return true;
}
// NE LEVE JAMAIS. Elle est appelee depuis la fin de seance : une banniere
// qui echoue ne doit pas emporter l'enregistrement de la seance.
function rcBanniereInstallMontrer(){
  try{
    if(rcBanniereInstallRaison()!=='ok') return false;
    const b=document.getElementById('rc-ban-install');
    if(!b) return false;
    b.classList.add('show');
    document.body.classList.add('rc-ban');
    _majHauteurBanniere();
    // DEUX ECRITURES, DEUX try/catch SEPARES, ET APRES L'AFFICHAGE. Le
    // stockage local est sature a 81 % par des images en base64 : setItem
    // LEVE quand le quota est plein. Groupees, la premiere qui leve
    // emporterait la seconde ; avant l'affichage, elles emporteraient la
    // banniere. On n'evince rien pour faire de la place — c'est interdit
    // dans ce projet, et une photo d'athlete vaut mieux qu'une banniere.
    //
    // QUOTA PLEIN, CONSEQUENCE ASSUMEE : l'horodatage n'est pas ecrit, donc
    // les 72 heures ne courent pas et la proposition pourra revenir a la
    // prochaine visite. C'est le moins mauvais des deux : l'autre serait de
    // supprimer quelque chose qui appartient a l'utilisateur.
    try{ sessionStorage.setItem('rc_ban_vue','1'); }catch(e){}
    try{ localStorage.setItem(RC_INST_VUE,String(Date.now())); }catch(e){}
    return true;
  }catch(e){ return false; }
}
// LA FERMETURE : ON CACHE D'ABORD, ON COMPTE ENSUITE. Si le quota est plein,
// setItem leve — et la banniere doit disparaitre quand meme. L'ordre inverse
// laisserait a l'ecran une banniere qu'on vient de refuser.
function rcBanniereInstallFermer(){
  rcBanniereInstallCacher();
  try{
    const n=(parseInt(localStorage.getItem(RC_INST_REFUS),10)||0)+1;
    localStorage.setItem(RC_INST_REFUS,String(n));
  }catch(e){}
  return true;
}
// LE GESTE. Il n'incremente RIEN : accepter n'est pas refuser, et refermer
// l'invitation du navigateur non plus — ce refus-la a son propre compteur de
// mesure, pas celui qui eteint la banniere.
function rcBanniereInstallAgir(){
  rcBanniereInstallCacher();
  // iOS N'A PAS D'INVITATION A DEMANDER : aucun navigateur n'y declenche
  // beforeinstallprompt. Le guide explique les deux gestes de Safari.
  try{ if(rcInstalliOS()){ showIosInstallGuide(); return true; } }catch(e){}
  try{ if(rcInstallInvite()){ rcInstallLocal(); return true; } }catch(e){}
  // NI iOS NI INVITATION — Firefox Android, navigateurs exotiques. Le bouton
  // n'aurait rien a declencher ici, et un bouton qui ne fait rien est pire
  // que pas de bouton. L'ecran d'installation a une branche pour chaque cas,
  // dont celle qui explique le menu du navigateur : on y renvoie.
  try{ go('s-install'); }catch(e){}
  return true;
}
function rcInstallPasser(){
  try{
    const n=(parseInt(localStorage.getItem(RC_INST_REFUS),10)||0)+1;
    localStorage.setItem(RC_INST_REFUS,String(n));
  }catch(e){}
  go('s-welcome');
  return true;
}
// ══════════ LA PREUVE : L'APPLICATION EST LANCEE DEPUIS SON ICONE ══════
//
// SEPTIEME COMPTEUR, ET IL N'EST PAS UNE ETAPE. Les six autres decrivent le
// chemin vers l'installation ; celui-ci dit si elle sert. Une icone posee
// puis jamais touchee est un echec que le tunnel seul montrerait comme une
// reussite.
//
// AU CHARGEMENT ET NON DANS go() : ce n'est pas un ecran, c'est le mode
// d'affichage de la fenetre, connu des la premiere image. rcmVue le borne a
// une fois par session — sans quoi une journee d'usage normal compterait
// vingt lancements pour une seule personne.
try{ if(rcInstallAutonome()) rcmVue('lancement_autonome'); }catch(e){}

// L'AIGUILLAGE. Rend la lettre de la branche retenue — 'A' à 'F' — ce qui rend
// la décision observable depuis la console et depuis la suite de tests.
// ══════════ LA GARDE EST SUR LE GESTE, PAS SUR L'ECRAN ═════════════════
//
// ⚠ LE DEFAUT QUE CE BLOC CORRIGE, ET IL ETAIT LE MIEN. La branche S de
// rcInstallDecider detournait bien l'ecran d'installation — mais l'ecran
// SUIVANT, s-welcome, porte son propre bouton « ⬇ Installer l'app sur ce
// telephone » qui appelle installApp() en direct. Aucune garde dessus. Kevin
// passait l'ecran d'installation, arrivait sur l'accueil, touchait CE
// bouton-la, et Samsung ouvrait « Ajouter ce site a l'ecran Applis » — donc
// la fabrication de WebAPK, donc le refus d'Android. Trois lots pour rien :
// je gardais une porte pendant qu'une autre restait ouverte a cote.
//
// UNE SEULE PORTE DESORMAIS. Tout ce qui declenche l'invitation du navigateur
// passe par ici : installApp (bouton de l'accueil), rcInstallLocal (ecran
// d'installation, branche C et bureau). Ajouter un troisieme appelant sans
// garde redeviendrait possible, mais il faudrait pour cela appeler
// window.__rcInstall directement — et une sonde l'interdit.
//
// Rend true quand elle a pris la main — l'appelant s'arrete alors la.
function _rcInstallDetourner(){
  const r=rcInstallBloquePar();
  if(!r) return false;
  // ON NE DEMANDE PAS L'INVITATION. Sur ce navigateur et a partir d'Android
  // 14, ce que le serveur de Samsung fabrique est refuse par le telephone :
  // appeler prompt() ici, c'est promener quelqu'un jusqu'a un mur.
  try{
    go('s-install');
    rcInstallDecider();
    // LE GUIDE N'EST OUVERT QUE QUAND ON SAIT QUOI DIRE. Pour un navigateur
    // qu'on ne connait pas, la branche F explique deja d'ouvrir son menu —
    // inventer un chemin precis serait envoyer quelqu'un chercher une entree
    // qui n'existe peut-etre pas chez lui.
    if(r==='samsung') rcGuideSamsung();
  }catch(e){}
  try{ toast(r==='samsung'
    ? 'Sur Samsung Internet, passe par « Ajouter la page à '+String.fromCharCode(8594)+' Écran d'+"\u2019"+'accueil ».'
    : 'Ton navigateur installe depuis son propre menu.','var(--orange)'); }catch(e){}
  return true;
}
// Le guide du raccourci. Il ne NAVIGUE nulle part : tout se passe dans le
// menu du navigateur, et l'application n'a aucun moyen de l'ouvrir a la place
// de l'utilisateur. Tout ce qu'elle peut faire est de dire ou toucher.
function rcGuideSamsung(){
  const g=document.getElementById('rc-inst-sam-guide');
  if(!g) return false;
  g.style.display='block';
  const p=document.getElementById('rc-inst-principal');
  // LE BOUTON A FAIT SON TRAVAIL : il s'efface. Le laisser inviterait a le
  // retoucher, et un second appui ne ferait rien de plus.
  if(p) p.style.display='none';
  try{ g.scrollIntoView({block:'nearest',behavior:arcReduit()?'auto':'smooth'}); }catch(e){}
  return true;
}
function rcInstallDecider(){
  const ecran=document.getElementById('s-install');
  if(!ecran) return 'A';
  const sous=document.getElementById('rc-inst-sous');
  const principal=document.getElementById('rc-inst-principal');
  const ici=document.getElementById('rc-inst-ici');
  // TOUT S'ÉTEINT D'ABORD. C'est ce qui garantit l'exclusivité, quelle que
  // soit la branche prise et quel que soit l'état laissé par un appel
  // précédent — beforeinstallprompt peut arriver après le premier passage.
  ecran.querySelectorAll('.rc-inst-bloc').forEach(b=>{ b.style.display='none'; });
  // LE LIBELLÉ PART AVEC L'AFFICHAGE : un bouton caché qui garde le texte de la
  // branche précédente le montrerait le temps d'une image si une branche future
  // l'affichait avant de le nommer.
  if(principal){ principal.style.display='none'; principal.textContent=''; }
  // LE LIBELLE DU BOUTON LOCAL REPART LUI AUSSI. La branche S le renomme
  // « Installer ici quand même » ; sans cette remise, un ordinateur visite
  // ensuite garderait ce texte-la sous un QR code.
  if(ici){ ici.style.display='none'; ici.textContent='Installer sur cet ordinateur'; }
  // ET LE MESSAGE DU BLOC PARTAGE. Deux branches l'ecrivent ; sans remise, la
  // seconde afficherait la phrase de la premiere.
  const _msg=document.getElementById('rc-inst-msg');
  if(_msg) _msg.innerHTML='Tu es dans le navigateur intégré de <b id="rc-inst-app" style="color:var(--text)">cette application</b>.<br><b style="color:var(--text)">Il ne sait pas installer RepCore.</b>';
  // Le libellé de la sortie est REPOSÉ à chaque décision : la branche B le
  // change, et un second passage sur une autre branche le garderait sinon.
  const _sortie=document.getElementById('rc-inst-passer');
  if(_sortie) _sortie.textContent='Continuer sans installer';
  const _sm=document.getElementById('rc-inst-sortie');
  if(_sm) _sm.style.display='none';
  // LE LIEN APK REPART CACHE A CHAQUE DECISION. Une seule branche le rallume :
  // proposer un fichier Android sur un iPhone ou dans un navigateur integre
  // serait au mieux inutile, au pire un cul-de-sac de plus.
  const _apk=document.getElementById('rc-inst-apk');
  if(_apk) _apk.style.display='none';
  // LE GUIDE ET LE LIEN CHROME REPARTENT CACHES, comme tout le reste : une
  // seule branche les rallume, et un second passage sur une autre branche les
  // laisserait sinon a l'ecran.
  const _sg=document.getElementById('rc-inst-sam-guide');
  if(_sg) _sg.style.display='none';
  const _lc=document.getElementById('rc-inst-chrome');
  if(_lc) _lc.style.display='none';
  _rcInstGeste=null;
  // LE REPERE, POSE A CHAQUE DECISION. Il porte la branche retenue et la
  // version du cache : deux chiffres qui disent en un coup d'oeil si le
  // telephone tourne sur le code livre, et quel chemin il a pris.
  try{
    const _v=document.getElementById('rc-inst-version');
    // PAS DE LETTRE DE BRANCHE ICI : le repère se pose en TÊTE du décideur,
    // avant que la branche ne soit choisie. Ce qu'il porte suffit — le numéro
    // de build dit si le téléphone tourne sur le code livré, et la raison de
    // blocage dit si la garde s'est levée.
    // RESERVE AU DEBOGAGE (01/10/2026) : un athlete n'a que faire d'un numero
    // de build sous le bouton d'installation. Le repere ne s'ecrit qu'avec
    // ?debug=1 dans l'adresse, ou localStorage rc_debug = '1' ; sinon
    // l'element reste vide et cache aux lecteurs d'ecran.
    if(_v){
      if(rcModeDebug()){
        _v.textContent='build '+(window.RC_BUILD||'?')
          +' · '+(rcInstallBloquePar()||'invitation ok')
          +(rcNavigateurSamsung()?' · SI '+rcNavigateurSamsung():'');
        _v.removeAttribute('aria-hidden');
      } else { _v.textContent=''; _v.setAttribute('aria-hidden','true'); }
    }
  }catch(e){}
  const dire=(t)=>{ if(sous) sous.textContent=t||''; };
  const montrer=(id)=>{ const b=document.getElementById(id); if(b) b.style.display='block'; };

  // A — déjà installé : on ne propose pas ce qui est fait.
  if(rcInstallAutonome()) return 'A';

  // B — navigateur intégré. PRIORITAIRE SUR TOUT LE RESTE, et c'est le sens
  // même de cette branche : un Android dans Instagram satisfait aussi les
  // conditions de la branche C, et un bouton d'installation y serait un
  // bouton mort. AUCUN bouton d'installation ici — le seul geste offert est
  // la SORTIE.
  const _app=rcNavigateurIntegre();
  if(_app){
    montrer('rc-inst-integre');
    const _n=document.getElementById('rc-inst-app');
    if(_n) _n.textContent=_app;
    dire('Ouvre RepCore dans ton navigateur : c\'est de là que l\'installation se fait.');
    if(principal){
      principal.textContent='OUVRIR DANS LE NAVIGATEUR';
      principal.style.display='block';
      _rcInstGeste=()=>{ rcOuvrirDansNavigateur(); };
    }
    // ET LA SORTIE DE SECOURS CHANGE DE MOT. « Continuer sans installer » ne
    // veut rien dire ici : personne n'a le choix d'installer. « Continuer
    // quand même » dit ce que c'est — un passage en force, prévu pour le jour
    // où la détection se trompe. Une détection d'agent utilisateur se trompe.
    const _p=document.getElementById('rc-inst-passer');
    if(_p) _p.textContent='Continuer quand même';
    // LE COMPTEUR. Il dira quelle part du trafic arrive par ce chemin — et
    // cette part décide si le lien doit changer de forme sur Instagram.
    // Une seule fois par session : rejouer la décision à l'arrivée de
    // beforeinstallprompt ne doit pas compter deux fois le même visiteur.
    try{
      if(!window._rcIabCompte){ window._rcIabCompte=true; rcm(_rcIabCle(_app)); }
    }catch(e){}
    return 'B';
  }

  // S — SAMSUNG INTERNET SUR ANDROID 14+, ET AVANT LA BRANCHE C : c'est tout
  // le correctif. Samsung Internet declenche beforeinstallprompt, donc la
  // branche C s'allumait, offrait « INSTALLER REPCORE », et le telephone
  // refusait le paquet fabrique. Le bouton marchait, l'installation non — et
  // rien a l'ecran ne disait pourquoi.
  const _sam=rcNavigateurSamsung();
  if(_sam){
    montrer('rc-inst-integre');
    if(_msg) _msg.innerHTML='Tu es dans <b style="color:var(--text)">Samsung Internet</b>.<br>'
      +'<b style="color:var(--text)">Android refuse ce qu\'il installe.</b><br>'
      +'<span style="font-size:var(--fs-xs);color:#bbb">Ce n\'est pas RepCore : Samsung Internet fabrique un paquet qu\'Android juge trop ancien. Depuis Chrome, l\'installation se fait sans un mot.</span>';
    dire('Trois gestes depuis le menu de ton navigateur, et RepCore est sur ton écran d\'accueil.');
    if(principal){
      // ⚠ LE GESTE PRINCIPAL NE SUPPOSE PLUS CHROME INSTALLE. La premiere
      // version envoyait vers Chrome ; sur un telephone qui ne l'a pas — le
      // cas de Kevin — l'intent retombait dans Samsung Internet et la boucle
      // etait complete. Le raccourci d'ecran d'accueil, lui, ne depend de
      // RIEN : ni de Chrome, ni du serveur de Samsung. Aucun paquet n'est
      // fabrique, donc Android n'a rien a refuser.
      principal.textContent='AJOUTER À L\'ÉCRAN D\'ACCUEIL';
      principal.style.display='block';
      _rcInstGeste=()=>{ rcGuideSamsung(); };
    }
    // ET CHROME EN SECOND, POUR CEUX QUI L'ONT. `sansRepli` : voir
    // rcOuvrirDansNavigateur — avec le repli, un telephone sans Chrome
    // revenait ici meme.
    const _ch=document.getElementById('rc-inst-chrome');
    if(_ch) _ch.style.display='block';
    // ⚠ PLUS D'« INSTALLER ICI QUAND MEME ». Je l'avais garde par principe —
    // « on ne retire pas une capacite, on choisit ce qu'on met devant » — et
    // c'etait une erreur de jugement : sur ce navigateur et a partir
    // d'Android 14, cette capacite N'EN EST PAS UNE. Elle mene a « Ajouter ce
    // site a l'ecran Applis », puis au refus du telephone. Offrir un bouton
    // dont on SAIT qu'il finit sur un mur, c'est fabriquer l'echec qu'on
    // pretend eviter — et le libelle, en le presentant comme le vrai chemin,
    // aggravait le piege.
    //
    // LE JOUR OU SAMSUNG CORRIGE SON SERVEUR, une seule constante bouge :
    // RC_SAMSUNG_ANDROID_MINI. Rien d'autre n'est a defaire.
    // Le compteur dira quelle part du trafic arrive par la, donc ce que ce
    // detour coute en abandons. Une seule fois par session.
    try{
      if(!window._rcSamCompte){ window._rcSamCompte=true; rcm('nav_samsung'); }
    }catch(e){}
    return 'S';
  }

  // E — ordinateur : le téléphone est ailleurs, on lui passe l'adresse.
  if(rcInstallBureau()){
    montrer('rc-inst-bureau');
    dire('Scanne avec ton téléphone pour installer.');
    const a=document.getElementById('rc-inst-adresse');
    // L'ADRESSE EN TOUTES LETTRES SOUS LE CODE, et selectionnable : un QR ne
    // se copie pas, et certains preferent taper. C'est aussi le seul repli si
    // l'encodeur manque.
    if(a) a.textContent=RC_LIEN_COURT.replace(/^https?:\/\//,'');
    _rcQrDessiner();
    // Le bouton local n'apparaît que si le navigateur a vraiment de quoi
    // installer : un bouton qui ne ferait rien vaut moins que pas de bouton.
    if(ici&&rcInstallInvite()) ici.style.display='block';
    return 'E';
  }

  // D — iOS : aucun navigateur n'y déclenche beforeinstallprompt. La modale
  // qui explique le geste existe déjà, on la réutilise telle quelle.
  if(rcInstalliOS()){
    dire('Deux gestes dans Safari, et RepCore est sur ton écran d\'accueil.');
    if(principal){
      principal.textContent='AJOUTER À L\'ÉCRAN D\'ACCUEIL';
      principal.style.display='block';
      _rcInstGeste=()=>{ try{ showIosInstallGuide(); }catch(e){} };
    }
    return 'D';
  }

  // C — le navigateur a de quoi installer, et il nous l'a dit.
  if(rcInstallInvite()){
    dire('Installation directe, sans passer par un magasin d\'applications.');
    if(principal){
      principal.textContent='INSTALLER REPCORE';
      principal.style.display='block';
      _rcInstGeste=()=>{ rcInstallLocal(); };
    }
    // ET LE FICHIER APK EN TROISIEME RANG, sur Android uniquement. Le test
    // porte sur le systeme et non sur la presence de l'invitation : un
    // Chromebook peut installer sans etre un telephone Android.
    try{
      // TROIS CONDITIONS, ET LA PREMIERE EST QU'IL Y AIT QUELQUE CHOSE AU BOUT.
      // Un lien de telechargement vers un fichier qui n'est pas heberge est un
      // 404 promis : mieux vaut ne rien proposer.
      if(_apk&&RC_APK_URL&&/Android/i.test(navigator.userAgent||'')){
        const _l=document.getElementById('rc-apk-lien');
        if(_l) _l.href=RC_APK_URL;
        _apk.style.display='block';
      }
    }catch(e){}
    return 'C';
  }

  // F — tout le reste : Firefox Android, navigateurs exotiques. Ils installent
  // tous, mais chacun par son menu, et aucun ne nous prévient.
  montrer('rc-inst-menu');
  dire('Ton navigateur installe RepCore depuis son menu.');
  return 'F';
}
// CE QUE L'ON FAIT QUAND L'INVITATION EST LA — appele DEUX FOIS, et il le faut :
// une fois tout de suite au cas ou la tete l'aurait deja retenue, une fois sur
// notre propre evenement au cas ou elle arriverait plus tard. Le navigateur ne
// declenche beforeinstallprompt qu'une fois SES criteres reunis, ce qui peut
// tomber avant comme apres l'analyse de ce bloc.
function _rcInviteArrivee(){
  const b=document.getElementById('install-btn');
  if(b) b.style.display='flex';
  // LE LIBELLE DIT CE QUE LE BOUTON FAIT VRAIMENT. Sur Samsung Internet il ne
  // demande plus l'invitation du navigateur — il mene au guide du raccourci.
  // Le laisser promettre « Installer l'app » serait reconduire le meme piege
  // d'un cran plus loin : la personne toucherait en croyant installer.
  try{
    if(b&&rcInstallBloquePar()==='samsung')
      _texteIco(b,ICO.download+' Ajouter RepCore à l\'écran d\'accueil');
  }catch(e){}
  // Sans ce second passage, un Android eligible restait sur la branche F de
  // l'ecran d'installation et se voyait expliquer un menu alors qu'un bouton
  // suffisait.
  try{
    if(document.getElementById('s-install')?.classList.contains('active')) rcInstallDecider();
  }catch(err){}
}
// DEJA LA ? On ne l'attend pas : c'est le cas normal desormais, la tete est
// analysee bien avant ce bloc.
try{ if(window.__rcInstallEvt) _rcInviteArrivee(); }catch(e){}
window.addEventListener('rc-install-dispo',_rcInviteArrivee);
// MEME REGLE POUR L'INSTALLATION FAITE : la tete pose le drapeau et previent,
// on se contente d'ecouter. `document.getElementById(...).style` levait quand
// le bouton n'existe pas encore — l'evenement peut arriver avant le DOM.
window.addEventListener('rc-install-fait',()=>{
  // LE SEUL COMPTEUR QUI COMPTE VRAIMENT. Il ne vient pas de nous : c'est le
  // navigateur qui tire `appinstalled`, une fois, quand l'icone est posee.
  // Un accord a l'invite n'est pas une installation — l'un se clique, l'autre
  // se termine, et l'ecart entre les deux est exactement ce qu'on cherche.
  try{ rcm('install_fait'); }catch(e){}
  // ⚠ CE COMPTEUR EST LE JUMEAU DU PRECEDENT, et il faut le savoir : les deux
  // sont incrementes par le meme evenement `appinstalled`, au meme instant, et
  // afficheront donc TOUJOURS le meme entier. `install_fait` ferme le tunnel
  // d'acquisition, `pwa_installed` ouvre le groupe de retention — demande de
  // Kevin, 15/09/2026. Si l'un des deux doit disparaitre un jour, c'est un
  // choix de lecture, pas une correction de bug.
  //
  // ICI ET NON SUR window.addEventListener('appinstalled'), qui vit dans la
  // tete du document : rcm() n'y est pas encore declaree. La tete pose le
  // drapeau et previent par `rc-install-fait` ; ce bloc est l'ecouteur de cet
  // evenement, donc l'ecouteur d'`appinstalled` a un relais pres. C'est la
  // regle que ce fichier applique deja pour `install_fait` juste au-dessus.
  try{ rcm('pwa_installed'); }catch(e){}
  const b=document.getElementById('install-btn');
  if(b) b.style.display='none';
  // LA BANNIERE N'A PLUS RIEN A PROPOSER. Sans ca elle resterait affichee
  // sous une application qui vient d'etre installee.
  try{ rcBanniereInstallCacher(); }catch(e){}
  // LE MESSAGE DIT QUOI FAIRE ENSUITE, et c'est tout son interet. « Installé
  // ✓ » constate ; les gens restent alors dans l'onglet du navigateur et
  // n'ouvrent jamais l'icone — l'installation ne sert a rien. La phrase
  // nomme les deux gestes suivants.
  try{ toast('RepCore est sur ton écran d\'accueil : tu peux fermer cet onglet et lancer l\'app depuis l\'icône'); }catch(e){}
  // L'ECRAN D'INSTALLATION N'A PLUS RIEN A PROPOSER : il repasse en branche A.
  try{ if(document.getElementById('s-install')?.classList.contains('active')) go('s-welcome'); }catch(e){}
});
// LE GESTE, EN UN SEUL ENDROIT. __rcInstall vit dans la tete et connait les
// trois issues ; installApp n'est plus qu'un nom conserve pour ses appelants.
function installApp(){
  // ⚠ LE BOUTON DE L'ACCUEIL PASSE PAR ICI, et c'est par lui que le defaut
  // arrivait : « ⬇ Installer l'app sur ce telephone », sur s-welcome, sans
  // aucun rapport avec l'ecran d'installation et sa branche Samsung.
  try{ if(_rcInstallDetourner()) return Promise.resolve('detourne'); }catch(e){}
  try{
    return window.__rcInstall().then(r=>{
      // « dismissed » n'est pas un echec : quelqu'un a dit non, et le lui
      // redire serait insister. On ne dit rien.
      if(r==='indisponible') toast('Ton navigateur ne propose pas l\'installation ici.','var(--orange)');
      return r;
    });
  }catch(e){ return Promise.resolve('indisponible'); }
}
// iOS : beforeinstallprompt ne se déclenche jamais — guide manuel
(function(){
  const isIos=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone=window.navigator.standalone===true;
  if(!isIos||isStandalone) return;
  const btn=document.getElementById('ios-install-btn');
  if(btn) btn.style.display='flex';
  // Si pas dans Safari : laisser l'étape 1 visible ; si déjà dans Safari : la masquer
  const notSafari=/CriOS|FxiOS|OPiOS|EdgiOS/i.test(navigator.userAgent);
  if(!notSafari){
    const s=document.getElementById('ios-step-safari');
    if(s) s.style.display='none';
    const n2=document.getElementById('ios-step2-num');if(n2) n2.textContent='1';
    const n3=document.getElementById('ios-step3-num');if(n3) n3.textContent='2';
  }
})();
function showIosInstallGuide(){
  // COMPTE ICI ET NON DANS LA BRANCHE D : cette modale s'ouvre aussi depuis
  // le bouton #ios-install-btn de l'accueil. N'instrumenter qu'un des deux
  // chemins donnerait un tunnel faux sans que ca se voie.
  // rcmVue et non rcm : rouvrir le guide n'est pas un second iPhone.
  try{ rcmVue('install_guide_ios'); }catch(e){}
  const m=document.getElementById('ios-install-modal');
  if(m){m.style.display='flex';}
}
function closeIosInstallGuide(){
  const m=document.getElementById('ios-install-modal');
  if(m){m.style.display='none';}
}

function initLogos(){
  // Logos are now pure HTML/CSS - no image loading needed
  const ph=document.getElementById('welcome-photo');if(ph)ph.src=COACH_PHOTO;
}
document.addEventListener('DOMContentLoaded',initLogos);
// LE RESSENTI DE FIN DE SEANCE EXISTE DES LE CHARGEMENT.
// Il est rendu par du code plutot qu'ecrit a la main dans le gabarit — une
// seule source, RCF_QUESTIONS — mais il doit etre dans le document AVANT
// qu'une seance se termine : savePostSession lit ses champs, et un ecran
// atteint autrement que par finishWorkout les trouvait vides.
document.addEventListener('DOMContentLoaded',function(){
  try{ rcfPoserRessenti(); }catch(e){}
  // UN ENVOI INTERROMPU SE PROPOSE, IL NE SE REPREND PAS TOUT SEUL. Trois
  // secondes de retard : l’ouverture de l’app passe d’abord, et un carton
  // qui arrive pendant le premier rendu n’est pas lu.
  setTimeout(function(){ try{ proposerRepriseEnvoi(); }catch(e){} },3000);
});
// ═══════════════════════════════════════════════════
// MONETISATION — Coach tabs
// ═══════════════════════════════════════════════════
// ── Tableau de bord du tunnel ───────────────────────────────────────────────
// Ordre d'affichage = ordre du parcours réel. Une étape peut regrouper
// plusieurs compteurs (le rôle en a deux) : `cles` est donc toujours un tableau.
// FIREBASE REND LES TABLEAUX SOUS FORME D'OBJETS DES QU'UNE CLE MANQUE — et
// la reciproque mord ici : si TOUTES les cles d'une journee etaient
// numeriques, la base rendrait un TABLEAU, et `parJour[j][nom]` vaudrait
// undefined pour chaque compteur. Zero partout, sans une seule erreur.
// Aucun nom d'evenement n'est numerique aujourd'hui, donc le cas ne se
// produit pas ; ce garde existe pour qu'il ne PUISSE pas se produire, et
// parce qu'il coute une ligne. Il rend aussi {} sur null, ce que faisait
// deja le `||{}` qu'il remplace.
const _rcmObjet=v=>(v&&typeof v==='object'&&!Array.isArray(v))?v:{};
const RCM_TUNNEL=[
  // DEUX PAGES DE VENTE (02/10/2026) : index.html pour l'athlète, coachs.html
  // pour le coach. Une seule étape, détaillée : l'entrée du tunnel reste le
  // total des deux, et le détail dit d'où vient le coach qui crée son espace.
  {cles:['landing_view','coach_landing_view'],lib:'Page de vente vue',detail:['landing_view','athlète','coach_landing_view','coach']},
  // ── L'INSTALLATION, EN AMONT DE TOUT LE RESTE ───────────────────────
  // Dans l'ordre reel du parcours : on voit l'ecran, le navigateur propose,
  // on accepte, l'icone se pose. Trois lignes sortent de la chaine — voir
  // `horsTunnel` et `neutre` plus bas.
  {cles:['install_ecran_vu'],lib:'Écran d\'installation vu'},
  // UNE FUITE, PAS UNE ETAPE : ces gens doivent changer de navigateur avant de
  // pouvoir installer, et une partie ne le fera pas. Orange, comme le refus.
  {cles:['nav_samsung'],lib:'Arrive par Samsung Internet',horsTunnel:true},
  {cles:['install_invite_montree'],lib:'Invitation du navigateur montrée'},
  {cles:['install_accepte'],lib:'Installation acceptée'},
  // UN VRAI DEPART : celui-la ne reviendra probablement pas.
  {cles:['install_refuse'],lib:'Installation refusée',horsTunnel:true},
  // PAS UNE FUITE, UNE AUTRE ROUTE. iOS ne declenche jamais l'invitation du
  // navigateur : ces gens passent de l'ecran au guide, puis a l'icone, sans
  // jamais toucher « accepte ». Hors chaine pour ne pas fausser le taux qui
  // suit, mais `neutre` pour ne pas etre peint comme un echec.
  {cles:['install_guide_ios'],lib:'Guide iOS ouvert',horsTunnel:true,neutre:true},
  {cles:['install_fait'],lib:'Application installée'},
  // LA PREUVE PLUTOT QUE L'ETAPE : voir le septieme compteur.
  {cles:['lancement_autonome'],lib:'Lancée depuis l\'écran d\'accueil',horsTunnel:true,neutre:true},
  {cles:['welcome_view'],lib:'Application ouverte'},
  {cles:['role_selected_coach','role_selected_athlete'],lib:'Rôle choisi',detail:['role_selected_athlete','athlète','role_selected_coach','coach']},
  {cles:['code_entered'],lib:'Code saisi'},
  {cles:['code_valid'],lib:'Code valide'},
  {cles:['code_invalid'],lib:'Code refusé',horsTunnel:true},
  {cles:['register_started'],lib:'Inscription commencée'},
  {cles:['register_completed'],lib:'Compte créé'},
  {cles:['subscribe_viewed'],lib:'Écran abonnement vu'},
  {cles:['paypal_clicked'],lib:'PayPal cliqué'},
  {cles:['subscription_activated'],lib:'Abonnement activé'},
  {cles:['first_workout_started'],lib:'1re séance lancée'},
  {cles:['first_workout_completed'],lib:'1re séance terminée'},
  {cles:['first_bilan_completed'],lib:'1er bilan rempli'},
  // ── LA RETENTION ────────────────────────────────────────────────────
  // Tout ce qui precede mesure l'ACQUISITION et s'arrete au premier bilan.
  // Ces quatre lignes disent ce qu'il advient apres, et elles se lisent en
  // volumes du jour, jamais en parcours d'une personne.
  //
  // TROIS SONT HORS CHAINE, et `neutre` : ce ne sont ni des etapes ni des
  // fuites. Elles se produisent a n'importe quel moment de la vie d'un compte
  // — on accorde les notifications le troisieme jour, on revient le
  // quinzieme — et les inserer dans la chaine ferait calculer un taux entre
  // deux choses qui ne se suivent pas.
  {cles:['notif_granted'],lib:'Notifications autorisées',horsTunnel:true,neutre:true},
  // ⚠ CE CHIFFRE EST LE JUMEAU DE « Application installée » : meme evenement
  // navigateur, meme instant, donc toujours le meme entier. Il est ici parce
  // qu'une installation est le premier acte de retention, et la-haut parce
  // qu'elle ferme le tunnel d'acquisition.
  {cles:['pwa_installed'],lib:'Application posée sur l\'écran d\'accueil',horsTunnel:true,neutre:true},
  {cles:['retour_j1'],lib:'Revenu un jour après son inscription',horsTunnel:true,neutre:true},
  // ⚠ CELUI-CI RESTE DANS LA CHAINE, comme demande — et il faut savoir ce que
  // ca produit : le taux affiche a sa droite le compare a « 1er bilan
  // rempli », deux volumes qui ne se suivent pas. Le nombre, lui, est juste.
  {cles:['jamais_demarre_7j'],lib:'Athlète : 7 jours sans une seule séance'},
  // HORS TUNNEL : ce n'est pas une etape, c'est une fuite. Ces visiteurs ne
  // peuvent PAS installer, et la plupart ne reviendront pas par un autre
  // chemin. Le detail nomme l'application pour que le chiffre soit
  // actionnable.
  {cles:['iab_instagram','iab_facebook','iab_tiktok','iab_linkedin','iab_snapchat','iab_twitter','iab_autre'],
   lib:'Arrive par un navigateur integre',horsTunnel:true,
   detail:['iab_instagram','Instagram','iab_facebook','Messenger','iab_tiktok','TikTok',
           'iab_linkedin','LinkedIn','iab_snapchat','Snapchat','iab_twitter','X','iab_autre','autre']},
  // ══ VENTE ════════════════════════════════════════════════════════════
  //
  // UNE SECONDE CHAINE, ET NON LA SUITE DE LA PREMIERE. Tout ce qui precede
  // mesure l'acquisition d'un COMPTE ; ces quatre lignes mesurent la vie d'une
  // OFFRE, et les deux ne se suivent pas — on ouvre la vitrine de son coach le
  // trentieme jour, pas juste apres son premier bilan. Les enchainer ferait
  // calculer un taux entre deux volumes sans rapport, et ce taux serait lu.
  //
  // `section` est porte par la PREMIERE entree du groupe, et non par un objet
  // separe : les trois boucles qui parcourent RCM_TUNNEL lisent toutes `cles`
  // et `lib`, et une entree sans elles les casserait toutes les trois. Le
  // rendu remet son denominateur a zero en voyant ce marqueur, et repart de
  // « Vitrine ouverte ».
  {cles:['vitrine_vue'],lib:'Vitrine d\'un coach ouverte',section:'Vente'},
  {cles:['programme_vu'],lib:'Programme en vente affiché'},
  // ⚠ UN DEPART, PAS UNE VENTE. Le paiement se fait sur la page du coach, hors
  // de RepCore : ce chiffre dit combien de gens sont partis payer, jamais
  // combien ont paye. Le nommer « ventes » serait un mensonge confortable.
  {cles:['programme_clic_achat'],lib:'Parti vers la page de paiement du coach'},
  // HORS CHAINE ET NEUTRE : le partage a lieu chez l'athlete, AVANT que
  // quiconque ouvre une vitrine. C'est ce qui alimente la chaine, pas une de
  // ses etapes — et ce n'est certainement pas une fuite.
  {cles:['story_partagee'],lib:'Carte de séance partagée',horsTunnel:true,neutre:true}
];
// ══ LOT C7 : LA LIGNE DES GESTES DU COACH, DANS L'ÉCRAN DE MESURE ═════════
// Six chiffres du mois, et le mois précédent à côté. Rien d'autre : pas de
// courbe, pas de détail par jour. UNE lecture, bornée par orderBy="$key" (le
// créateur lit tout le nœud, comme pour la carte « Capacité »).
const RCM_COACH_LIB=Object.freeze({coach_message_envoye:'Messages envoyés',coach_programme_assigne:'Programmes assignés',
  coach_fiche_ouverte:'Fiches ouvertes',coach_bilan_repondu:'Bilans répondus',coach_canal_publie:'Publications au canal',
  coach_relance_auto:'Relances automatiques'});
// PURE. Les deux mois ('AAAA-MM'), celui de `t` et le précédent.
function rcmMoisCoach(maintenant){
  const d=new Date((typeof maintenant==='number')?maintenant:Date.now());
  const m=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  const p=new Date(d.getFullYear(),d.getMonth()-1,1);
  return {mois:m,precedent:p.getFullYear()+'-'+String(p.getMonth()+1).padStart(2,'0')};
}
// PURE. Les six sommes pour chaque mois, depuis /metrics lu par jour.
function rcmSommesCoach(parJour,maintenant){
  const {mois,precedent}=rcmMoisCoach(maintenant);
  const out={mois:{},precedent:{}};
  for(const k of RCM_COACH){ out.mois[k]=0; out.precedent[k]=0; }
  const o=(parJour&&typeof parJour==='object')?parJour:{};
  for(const j of Object.keys(o)){
    const cote=j.slice(0,7)===mois?'mois':(j.slice(0,7)===precedent?'precedent':null);
    if(!cote||!o[j]||typeof o[j]!=='object') continue;
    for(const k of RCM_COACH) out[cote][k]+=Math.max(0,parseInt(o[j][k],10)||0);
  }
  return out;
}
function htmlGestesCoach(s,maintenant){
  const {mois,precedent}=rcmMoisCoach(maintenant);
  const nomMois=m=>{ try{ return new Date(+m.slice(0,4),+m.slice(5,7)-1,1).toLocaleDateString('fr-FR',{month:'long'}); }catch(e){ return m; } };
  return '<div class="gc"><div class="gc-t">Les gestes des coachs · '+escapeHtml(nomMois(mois))+' <span>('+escapeHtml(nomMois(precedent))+')</span></div>'
    +'<div class="gc-l">'+RCM_COACH.map(k=>'<div class="gc-c"><b>'+(s.mois[k]||0)+'</b><span class="gc-p">'+(s.precedent[k]||0)+'</span><span class="gc-n">'+escapeHtml(RCM_COACH_LIB[k])+'</span></div>').join('')+'</div></div>';
}
async function _rendreGestesCoach(corps){
  try{
    if(!corps||!currentUser||currentUser.email!==CREATOR_EMAIL) return false;
    const jeton=await CLOUD._getToken();
    if(!jeton) return false;
    const {mois,precedent}=rcmMoisCoach();
    const r=await fetch(RCM_BASE+'.json?orderBy="$key"&startAt="'+precedent+'-01"&endAt="'+mois+'-31"&auth='+encodeURIComponent(jeton));
    if(!r.ok) return false;
    const z=document.createElement('div');
    z.innerHTML=htmlGestesCoach(rcmSommesCoach(await r.json()));
    corps.insertBefore(z.firstChild,corps.firstChild);
    return true;
  }catch(e){ return false; }
}
async function loadMetrics(){
  // Même garde que la génération de codes gratuits : ce sont les chiffres du
  // produit, pas ceux d'un coach. Contrôle d'affichage ET d'entrée.
  if(currentUser?.email!==CREATOR_EMAIL){
    toast('Réservé à l\'administrateur RepCore.','var(--red)');
    return;
  }
  go('s-metrics');
  _renderCapacite();
  const corps=document.getElementById('mt-corps');
  if(!corps) return;
  corps.innerHTML='<div class="skeleton fx-loop" style="height:120px;border-radius:var(--r-2)"></div>';
  const tok=await CLOUD._getToken().catch(()=>null);
  // 7 jours glissants, aujourd'hui inclus.
  const jours=[];
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);jours.push(localISODate(d));}
  const parJour={};
  await Promise.all(jours.map(async j=>{
    try{
      const r=await fetch(RCM_BASE+'/'+j+'.json'+(tok?'?auth='+tok:''));
      parJour[j]=_rcmObjet(r.ok?await r.json():null);
    }catch(e){parJour[j]={};}
  }));
  const total=cle=>jours.reduce((n,j)=>n+(parseInt(parJour[j][cle],10)||0),0);
  const totalEtape=e=>e.cles.reduce((n,c)=>n+total(c),0);
  // LA REFERENCE EST LA PREMIERE ETAPE NON VIDE, ET NON RCM_TUNNEL[0].
  // Elle se lisait par INDICE — [0] sinon [1] — ce qui revenait a nommer
  // « page de vente » et « application ouverte » par leur POSITION dans le
  // tableau. Inserer les sept etapes d'installation devant a decale ces
  // indices : la reference serait devenue « ecran d'installation vu », et
  // toutes les barres auraient ete mesurees contre le mauvais denominateur,
  // sans qu'aucune erreur ne le signale. Par parcours, l'ordre peut bouger.
  // LA REFERENCE SE RECALCULE A CHAQUE SECTION. Sans cela, les trois etapes de
  // vente auraient ete mesurees contre « page de vente vue » — un denominateur
  // cent fois plus grand, donc trois barres a 2 px qu'on aurait lues comme un
  // echec alors qu'elles racontent leur propre histoire.
  const _refDepuis=(depart)=>{
    for(let i=depart;i<RCM_TUNNEL.length;i++){
      if(i>depart&&RCM_TUNNEL[i].section) break;   // la section suivante a la sienne
      if(RCM_TUNNEL[i].horsTunnel) continue;
      const n=totalEtape(RCM_TUNNEL[i]);
      if(n>0) return n;
    }
    return 0;
  };
  let reference=_refDepuis(0);
  // DEUX TEINTES POUR CE QUI SORT DE LA CHAINE, parce que sortir de la chaine
  // recouvre deux choses opposees : un refus est une fuite et se lit en
  // orange ; un guide iOS ou un lancement depuis l'icone n'est pas un echec —
  // il ne casse simplement pas le taux de l'etape suivante.
  const teinte=(e,def)=>e.horsTunnel?(e.neutre?'var(--sub)':'var(--orange)'):def;
  // ── LA SYNTHESE, EN TETE ────────────────────────────────────────────
  // UN SEUL CHIFFRE DECIDE DE TOUS LES AUTRES : combien de gens a qui on a
  // propose d'installer l'ont fait. Tout le tunnel est en aval — personne ne
  // revient une deuxieme fois sans icone sur son ecran d'accueil.
  //
  // DIVISION PAR ZERO : le denominateur est nul tant que personne n'a vu
  // l'ecran — le premier jour, et apres chaque redeploiement des regles. On
  // ne rend PAS « 0 % », qui se lirait comme un echec cuisant alors qu'il
  // n'y a rien a lire ; on dit qu'il n'y a rien a lire.
  const _instVus=total('install_ecran_vu');
  const _instFaits=total('install_fait');
  const _tauxInst=_instVus>0?Math.round(_instFaits/_instVus*100):null;
  let precedent=null;
  // data-num REECRIT TOUT LE CONTENU de l'element qu'il anime — son format
  // rend le nombre et rien d'autre. Le « % » vit donc dans un frere, sinon il
  // disparaitrait a la premiere image de l'animation.
  let html='<div style="background:var(--surface-2);border-radius:var(--r-2);padding:12px 14px;margin-bottom:20px">'
    +'<div style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:.08em;text-transform:uppercase;font-weight:700;margin-bottom:4px">Taux d\'installation</div>'
    +(_tauxInst===null
      ? '<div style="font-size:var(--fs-sm);color:var(--sub);line-height:1.5">Pas encore mesurable : personne n\'a vu l\'écran d\'installation sur les 7 derniers jours.</div>'
      : '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">'
        +'<span style="white-space:nowrap"><strong data-num="'+_tauxInst+'" data-num-duree="520" style="font-size:var(--fs-2xl);color:var(--text-strong);font-variant-numeric:tabular-nums">'+_tauxInst+'</strong>'
        +'<span style="font-size:var(--fs-xl);color:var(--text-strong)"> %</span></span>'
        +'<span style="font-size:var(--fs-sm);color:var(--sub)">'+_instFaits+' installation'+(_instFaits>1?'s':'')+' pour '+_instVus+' écran'+(_instVus>1?'s':'')+' vu'+(_instVus>1?'s':'')+'</span>'
        +'</div>')
    +'</div>';
  for(let _i=0;_i<RCM_TUNNEL.length;_i++){
    const e=RCM_TUNNEL[_i];
    // UNE NOUVELLE SECTION REMET LES DEUX COMPTEURS A ZERO : son propre
    // denominateur, et la chaine des taux. Le titre le dit a l'ecran, sans
    // quoi deux series de barres se liraient comme une seule.
    if(e.section){
      reference=_refDepuis(_i);
      precedent=null;
      html+='<div style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:.14em;'
        +'text-transform:uppercase;font-weight:800;margin:28px 0 12px;padding-top:14px;'
        +'border-top:1px solid var(--border)">'+escapeHtml(e.section)+'</div>';
    }
    const n=totalEtape(e);
    const largeur=reference>0?Math.max(2,Math.round(n/reference*100)):0;
    // Le taux compare à l'étape précédente du tunnel ; les étapes marquées
    // horsTunnel (les échecs) ne cassent pas la chaîne pour les suivantes.
    const taux=(!e.horsTunnel&&precedent!==null&&precedent>0)?Math.round(n/precedent*100)+' %':'';
    let detail='';
    if(e.detail&&n>0){
      const parts=[];
      for(let i=0;i<e.detail.length;i+=2) parts.push(total(e.detail[i])+' '+e.detail[i+1]);
      detail=' · '+parts.join(' / ');
    }
    html+='<div style="margin-bottom:12px">'
      +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:6px">'
      +'<span style="font-size:var(--fs-sm);font-weight:700;color:'+teinte(e,'var(--text)')+'">'+escapeHtml(e.lib)+'</span>'
      +'<span style="font-size:var(--fs-sm);color:var(--sub);white-space:nowrap"><strong data-num="'+n+'" data-num-duree="520" style="color:var(--text);font-size:var(--fs-md);font-variant-numeric:tabular-nums">'+n+'</strong>'
      +(taux?' <span style="color:var(--sub)">('+taux+')</span>':'')+'</span>'
      +'</div>'
      +'<div style="height:6px;background:var(--surface-2);border-radius:var(--r-1);overflow:hidden">'
      +'<div class="rc-barre" data-bar-w="'+largeur+'" style="height:100%;width:0;background:'+teinte(e,'var(--red)')+';transition:width 520ms var(--c-out) var(--rcf-d,0ms)"></div>'
      +'</div>'
      +(detail?'<div class="sub" style="font-size:var(--fs-2xs);margin-top:4px">'+escapeHtml(detail.slice(3))+'</div>':'')
      +'</div>';
    if(!e.horsTunnel) precedent=n;
  }
  // Détail jour par jour : une conversion qui s'effondre se voit ici avant de
  // se voir dans le total sur 7 jours.
  let tbl='<div style="overflow-x:auto;margin-top:24px"><table style="border-collapse:collapse;font-size:var(--fs-xs);white-space:nowrap">'
    +'<tr><th style="text-align:left;padding:4px 8px 4px 0;color:var(--sub);font-weight:700">Étape</th>';
  for(const j of jours) tbl+='<th style="padding:4px 6px;color:var(--sub);font-weight:700">'+j.slice(8)+'/'+j.slice(5,7)+'</th>';
  tbl+='</tr>';
  for(const e of RCM_TUNNEL){
    tbl+='<tr><td style="padding:4px 8px 4px 0;color:'+teinte(e,'var(--text-strong)')+'">'+escapeHtml(e.lib)+'</td>';
    for(const j of jours){
      const n=e.cles.reduce((s,c)=>s+(parseInt(parJour[j][c],10)||0),0);
      tbl+='<td style="padding:4px 6px;text-align:center;color:'+(n?'var(--text)':'#444')+'">'+(n||'-')+'</td>';
    }
    tbl+='</tr>';
  }
  tbl+='</table></div>';
  const totalTout=RCM_TUNNEL.reduce((n,e)=>n+totalEtape(e),0);
  corps.innerHTML=totalTout===0
    ? '<div class="sub" style="font-size:var(--fs-sm);line-height:1.6">Aucune mesure sur les 7 derniers jours.<br><br>C\'est normal tant que les règles de la base n\'ont pas été redéployées, ou tant que personne n\'a ouvert l\'application depuis la mise en ligne.</div>'
    : html+tbl;
  // LOT C7 : la ligne des gestes du coach, en tête.
  _rendreGestesCoach(corps);
  // UN ENTONNOIR SE LIT DE HAUT EN BAS : chaque etage se remplit apres le
  // precedent, c'est la forme meme de la donnee. Ecran rare, ecran
  // administrateur, aucune action bloquee — c'est le bon endroit pour etre
  // long. Rien n'est anime sur la sortie anticipee : elle rend un texte, pas
  // des barres. Le tableau jour par jour reste immobile, c'est une grille de
  // lecture, pas une mesure a ressentir.
  if(totalTout!==0){
    try{
      corps.querySelectorAll('.rc-barre').forEach((b,i)=>b.style.setProperty('--rcf-d',i*70+'ms'));
      _animerJauges(corps);
    }catch(e){}
  }
}
// LES ONGLETS DE LA BARRE LATERALE RAMENENT AU TABLEAU DE BORD.
// Signale par Kevin, 26/08/2026 : depuis « Charges articulaires », cliquer sur
// PROFIL, CODES ACCES ou PAIEMENTS ne faisait RIEN.
//
// La cause : ces quatre panneaux — #ct-dashboard, #ct-codes, #ct-monetisation,
// #ct-profil — vivent A L'INTERIEUR de #s-coach-home. Tant que la barre
// laterale n'etait allumee que sur le tableau de bord, basculer un panneau
// suffisait. Depuis N1.15 elle accompagne les vingt-deux ecrans coach : depuis
// l'un des vingt et un autres, coachTab changeait bien le panneau — mais un
// panneau qu'aucun ecran visible ne portait. Le coach cliquait dans le vide, et
// rien ne le lui disait.
//
// ON NAVIGUE D'ABORD, ON BASCULE ENSUITE. L'ordre compte : go() ne touche pas
// aux panneaux, mais le faire apres garantit que l'affichage pose ici est le
// dernier mot.
//
// ET ON NE RECHARGE PAS LE TABLEAU DE BORD QUAND ON Y EST DEJA : coachTab est
// appele par la barre d'onglets du telephone a chaque bascule, et
// loadCoachHome y refait tout le rendu de la liste pour rien.
// B2.1 — EXACTEMENT UN ELEMENT COURANT DANS LA BARRE, TOUJOURS.
//
// L'etat etait pose par coachTab, qui ne connait que les quatre onglets du
// tableau de bord : les cinq destinations de travail n'en recevaient jamais, et
// le dernier onglet visite restait allume par-dessus l'ecran ouvert.
//
// LE CRITERE EST L'ECRAN REELLEMENT ACTIF, comme pour la mise en page : `.active`
// est pose par go() a chaque navigation, quel que soit le chemin — un lien, un
// retour arriere, un rechargement. Aucun appelant n'a a se souvenir de
// prevenir la barre.
//
// SUR s-coach-home, C'EST L'ONGLET QUI COMMANDE : les cinq liens s'eteignent et
// coachTab garde la main sur les quatre sb-tab-*. Ailleurs, l'inverse — le lien
// de l'ecran s'allume et les quatre onglets s'eteignent, y compris celui que le
// coach regardait avant de partir.
function _majBarreCoach(){
  try{
    const act=document.querySelector('.screen.active');
    const id=act?act.id:'';
    const home=(id==='s-coach-home');
    document.querySelectorAll('#ch-sidebar .sb-lien[data-ecran]').forEach(b=>{
      if(!home&&b.dataset.ecran===id) b.setAttribute('aria-current','page');
      else b.removeAttribute('aria-current');
    });
    if(!home) ['dashboard','codes','monetisation','profil'].forEach(k=>{
      const sb=document.getElementById('sb-tab-'+k);
      if(!sb) return;
      sb.style.background='none';
      sb.style.color='var(--sub)';
      sb.style.boxShadow='none';
      sb.removeAttribute('aria-current');
    });
  }catch(e){}
}
function coachTab(tab){
  try{
    const act=document.querySelector('.screen.active');
    if(!act||act.id!=='s-coach-home'){
      go('s-coach-home');
      // Le meme geste que le bouton de retour de ces ecrans : on revient sur
      // une liste a jour, pas sur celle d'il y a dix minutes.
      try{ loadCoachHome(); }catch(e){}
    }
  }catch(e){}
  ['dashboard','codes','monetisation','profil'].forEach(function(id){
    var p=document.getElementById('ct-'+id);
    if(p){
      if(id===tab){
        p.style.setProperty('display','flex','important');
      } else {
        p.style.setProperty('display','none','important');
      }
    }
    var b=document.getElementById('ct-tab-'+id);
    if(b){
      b.style.borderBottom=(id===tab)?('2px solid '+ROUGE_MARQUE):'2px solid transparent';
      b.style.color=(id===tab)?'var(--text)':'var(--text-faint)';
    }
    // LE PANNEAU LATERAL DU BUREAU. Il n'etait pas touche : ses boutons
    // gardaient le style ecrit dans le gabarit, et « ATHLETES » restait allume
    // meme en lisant PAIEMENTS. Une surbrillance qui ment sur la page ouverte
    // est pire que pas de surbrillance du tout.
    var sb=document.getElementById('sb-tab-'+id);
    if(sb){
      sb.style.background=(id===tab)?'var(--surface-1)':'none';
      sb.style.color=(id===tab)?'var(--text)':'var(--sub)';
      sb.style.boxShadow=(id===tab)?'inset 3px 0 0 var(--red)':'none';
      if(id===tab) sb.setAttribute('aria-current','page'); else sb.removeAttribute('aria-current');
    }
  });
  if(tab==='codes')try{loadStudentCodes();}catch(e){console.error(e);}
  // LES DEUX ONGLETS appellent la meme fonction : elle remplit a la fois les
  // champs du profil et ceux des paiements, et cherche ses elements par
  // identifiant. La scinder aurait demande de trancher, pour chacune de ses
  // trente lectures, de quel cote elle tombe — et une erreur y serait un
  // champ vide, silencieux.
  if(tab==='monetisation'||tab==='profil')try{loadMonetisationTab();}catch(e){console.error(e);}
  if(tab==='profil')try{rendrePrefsAide();}catch(e){console.error(e);}
}

function updateCloudStatus(){
  _renderVersionSW();
  const el=document.getElementById('cloud-status');
  const qrBtn=document.getElementById('cloud-qr-btn');
  if(!el) return;
  if(CLOUD.canWrite()){
    el.textContent='Sync active (lecture + écriture)';
    el.style.color='var(--green)';
    if(qrBtn) qrBtn.style.display='block';
  } else {
    el.textContent='Lecture seule (sync automatique au démarrage)';
    el.style.color='#4a9eff';
    if(qrBtn) qrBtn.style.display='none';
  }
}
// Le mode. Passer à 'aucun' RÉVOQUE : le consentement tombe avec lui, sinon
// un retour à 'whatsapp' republierait le numéro sans que personne ait
// redit oui.
function _contactCourant(){
  const c=currentUser&&currentUser.contact;
  return (c&&typeof c==='object')?c:{mode:'aucun',consentAt:null,horaires:''};
}
function setModeContact(mode){
  if(CONTACT_MODES.indexOf(mode)<0) return false;
  const c=_contactCourant();
  const avant=c.mode;
  currentUser.contact={mode:mode,
    consentAt:(mode==='aucun')?null:c.consentAt||null,
    horaires:c.horaires||''};
  saveUser();
  // Une révocation se DIT, et se dit honnêtement : elle empêche les futurs
  // accès, elle ne rappelle pas ce qui a déjà été communiqué.
  if(avant!=='aucun'&&mode==='aucun') toast(CONTACT_REVOCATION,'var(--sub)');
  _renderContactCoach();
  return true;
}
// Le consentement, d'un geste dans chaque sens. RGPD art. 7.3 : retirer doit
// être aussi simple qu'accorder — une case, pas un formulaire.
function basculerConsentContact(v){
  const c=_contactCourant();
  if(c.mode==='aucun'){ _renderContactCoach(); return false; }
  currentUser.contact={mode:c.mode,
    consentAt:v?new Date().toISOString():null,
    horaires:c.horaires||''};
  saveUser();
  if(!v) toast(CONTACT_REVOCATION,'var(--sub)');
  _renderContactCoach();
  return true;
}
function saveHorairesContact(v){
  const c=_contactCourant();
  currentUser.contact={mode:c.mode,consentAt:c.consentAt||null,
    horaires:String(v||'').slice(0,200)};
  saveUser();
  return true;
}
const CONTACT_LIB={aucun:'Aucun contact direct',whatsapp:'WhatsApp',email:'E-mail'};
function _renderContactCoach(){
  const z=document.getElementById('coach-contact-modes');
  if(!z) return;
  const c=_contactCourant();
  const mode=CONTACT_MODES.indexOf(c.mode)>=0?c.mode:'aucun';
  z.innerHTML=CONTACT_MODES.map(m=>
    `<div class="obj-opt${mode===m?' sel':''}" onclick="setModeContact('${m}')"
      role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
      <div style="font-weight:800">${escapeHtml(CONTACT_LIB[m])}</div>
    </div>`).join('');
  const wa=document.getElementById('coach-contact-wa');
  if(wa) wa.style.display=(mode==='whatsapp')?'block':'none';
  const cb=document.getElementById('coach-contact-consent');
  if(cb) cb.checked=!!c.consentAt;
  const ho=document.getElementById('coach-contact-horaires');
  if(ho&&document.activeElement!==ho) ho.value=c.horaires||'';
  const et=document.getElementById('coach-contact-etat');
  if(et){
    // Le numéro n'est publié QUE si les deux conditions tiennent. L'écran le
    // dit, plutôt que de laisser deviner.
    const publie=!!contactNumero(currentUser);
    et.textContent=publie
      ? 'Publié depuis le '+new Date(c.consentAt).toLocaleDateString('fr-FR')
        +'. Décoche pour révoquer.'
      : (c.consentAt?'Numéro inexploitable par WhatsApp : rien n\'est publié.'
                    :'Non publié : coche la case pour l\'autoriser.');
  }
}
function saveCoachPhone(){
  const raw=(document.getElementById('coach-phone-input').value||'').trim();
  // Même règle que pour les athlètes : wa.me refuse un numéro national.
  if(_numWa(raw).length<8){toast('Numéro inutilisable : mets l\'indicatif pays sans le 0, ex : +33612345678','var(--orange)');return;}
  currentUser.phone=raw;
  toastEcriture(saveUser(),'Numéro WhatsApp enregistré '+ICO.coche,'le numéro est');
  _renderCoachPhonePreview(raw);
  _renderContactCoach();
}
