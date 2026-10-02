#!/usr/bin/env node
// CE QUE LE CODE ECRIT DOIT ETRE DECLARE DANS LES REGLES, SINON RIEN NE PASSE.
//
// LA PANNE, DEUX FOIS. coach_public/$emailKey se ferme sur
// "$autre": {".validate": false} — une liste blanche. Et pushProfilCoach fait
// un PUT du profil ENTIER, reconstruit depuis CHAMPS_PROFIL_COACH. Un seul
// champ de cette liste absent des regles, et Firebase rejette LA BRANCHE
// COMPLETE : le profil public cesse de se publier — photo, phrase, vitrine,
// signature comprises — et chaque tentative suivante repart avec le meme
// champ fautif. C'est definitif, et silencieux.
//
// C'est arrive avec 'dispo', puis avec 'logo'.
//
// POURQUOI UN SCRIPT, ALORS QUE tests.js PORTE DEJA LA SONDE. Parce que la
// sonde de tests.js lit database.rules.json par fetch, depuis la page. Le
// fichier n'est PAS deploye (voir l'assemblage de _site) : servi autrement
// qu'a la racine du depot, elle ne trouve rien — et elle rend `true`, faute
// de pouvoir conclure. C'est exactement ce qui s'est passe : 'logo' est reste
// casse pendant que la suite etait verte. Ici, les deux fichiers sont lus sur
// le disque : il n'y a rien a servir, et rien qui puisse etre muet.
import {readFileSync} from 'node:fs';
// LE CODE N'EST PLUS DANS index.html (build 1417) : il vit dans
// app/rc-core.<build>.js. sourceProd() rend la page reconstituee, telle que
// _prodSrc() la voit dans la suite. Sans ca, ce controle s'arretait sur
// « CHAMPS_PROFIL_COACH introuvable » — bruyamment, au moins.
import {sourceProd} from './source-prod.mjs';

const regles=readFileSync('database.rules.json','utf8');
const source=sourceProd();

// LE CREATEUR EST RECONNU PAR SON UID ET UNE ADRESSE VERIFIEE (01/10/2026),
// jamais par son adresse seule. La condition exacte, telle que les regles
// doivent l'ecrire, se deduit de l'unique constante CREATEUR_UID.
const srcCreateur=readFileSync('cloudflare/src/createur.js','utf8');
const CREATEUR_UID=(srcCreateur.match(/export const CREATEUR_UID = '([^']*)';/)||[])[1];
const UID_A_POSER=(srcCreateur.match(/export const UID_A_POSER = '([^']*)';/)||[])[1];
if(!CREATEUR_UID){ console.error('CREATEUR_UID introuvable dans cloudflare/src/createur.js'); process.exit(1); }
const CONDITION_CREATEUR="(auth.uid === '"+CREATEUR_UID+"' && auth.token.email_verified === true)";

// ── La liste blanche du code ──────────────────────────────────────────────
// Lue dans la source plutot que recopiee : une copie ici divergerait, et
// divergerait en silence — le defaut meme qu'on cherche a fermer.
const mListe=source.match(/CHAMPS_PROFIL_COACH:\s*\[([\s\S]*?)\]/);
if(!mListe){ console.error('CHAMPS_PROFIL_COACH introuvable dans app/index.html'); process.exit(1); }
// ⚠ LES COMMENTAIRES PARTENT D'ABORD. La liste en porte plusieurs, en
// francais, donc pleins d'apostrophes : « l'athlete », « l'image ». Sans ce
// nettoyage, le releveur de chaines les prend pour des quotes ouvrantes et
// rend des morceaux de phrase a la place des noms de champs.
const champs=[...mListe[1].replace(/\/\/[^\n]*/g,'').matchAll(/'([^']+)'/g)].map(m=>m[1]);
if(champs.length<5){ console.error('CHAMPS_PROFIL_COACH : '+champs.length+' champ(s) lu(s), lecture cassee'); process.exit(1); }

// ── Les clefs declarees dans coach_public/$emailKey ───────────────────────
// De PREMIER NIVEAU seulement : 'mode' sous 'contact' n'est pas un champ de
// profil, et le compter masquerait un vrai manque.
const i=regles.indexOf('"coach_public"');
if(i<0){ console.error('le noeud coach_public a disparu des regles'); process.exit(1); }
const j=regles.indexOf('"$emailKey"',i);
if(j<0){ console.error('coach_public n\'a plus de $emailKey'); process.exit(1); }
const bloc=(()=>{
  const p=regles.indexOf('{',j); let n=0;
  for(let k=p;k<regles.length;k++){
    if(regles[k]==='{') n++;
    else if(regles[k]==='}'){ n--; if(!n) return regles.slice(p,k+1); }
  }
  return '';
})();
if(!bloc){ console.error('bloc $emailKey illisible'); process.exit(1); }

const niveau1=new Set();
{
  let n=0; const re=/"([^"]+)"\s*:/g;
  for(let k=0;k<bloc.length;k++){
    if(bloc[k]==='{') n++;
    else if(bloc[k]==='}') n--;
    else if(bloc[k]==='"'&&n===1){
      re.lastIndex=k; const m=re.exec(bloc);
      if(m&&m.index===k){ niveau1.add(m[1]); k=re.lastIndex-1; }
    }
  }
}
if(niveau1.size<5){ console.error('seulement '+niveau1.size+' clef(s) lue(s) dans les regles : lecture cassee'); process.exit(1); }

// ── La comparaison ────────────────────────────────────────────────────────
const manquants=champs.filter(c=>!niveau1.has(c));
// 'maj' n'est pas dans la liste blanche : pushProfilCoach l'ajoute lui-meme,
// juste avant l'envoi. Il part donc dans le meme PUT, et le "$autre" le
// rejetterait comme les autres.
if(!niveau1.has('maj')) manquants.push('maj (ajoute par pushProfilCoach)');

console.log('champs ecrits par le code : '+champs.length
  +'   clefs declarees dans les regles : '+niveau1.size);
if(manquants.length){
  console.error('\nECRIT PAR LE CODE, ABSENT DES REGLES : '+manquants.join(', '));
  console.error('Firebase rejettera le profil public ENTIER, definitivement.');
  console.error('Ajoute une regle pour chacun dans coach_public/$emailKey.');
  process.exit(1);
}
// L'INVERSE N'EST PAS UNE ERREUR : une regle sans champ qui l'utilise ne casse
// rien. On le dit quand meme — c'est en general un champ retire du code dont
// la regle survit, et le prochain lecteur la croira vivante.
const orphelines=[...niveau1].filter(k=>!k.startsWith('.')&&k!=='$autre'
  &&k!=='maj'&&!champs.includes(k));
if(orphelines.length) console.log('regle(s) sans champ correspondant : '+orphelines.join(', '));

// ══ LES COMPTEURS DE TUNNEL : MEME PANNE, MEME REMEDE ═══════════════════
//
// /metrics/$jour/$evenement se ferme sur une liste blanche ecrite dans une
// expression reguliere. Le 15/09/2026, index.html declarait TRENTE noms
// d'evenements et cette expression en acceptait QUINZE : tout le tunnel
// d'installation, tout le trafic des navigateurs integres, lancement_autonome
// et nav_samsung etaient ecrits par l'app et rejetes par le serveur.
//
// RIEN NE POUVAIT LE SIGNALER. rcm() envoie et n'attend aucune reponse — c'est
// voulu, la mesure ne doit rien couter a l'ecran — donc un rejet ne produit ni
// erreur, ni console, ni compteur a zero qu'on distinguerait d'un compteur
// jamais atteint. L'ecran affichait « Pas encore mesurable » depuis huit
// jours, et son commentaire l'expliquait par un deploiement en retard.
//
// Le commentaire de RCM_EVENEMENTS affirmait pourtant, noir sur blanc, que
// « les noms sont figes ici ET dans database.rules.json ». Un commentaire ne
// verifie rien ; ceci, si.
const mEvts=source.match(/const RCM_EVENEMENTS=\[([\s\S]*?)\];/);
if(!mEvts){ console.error('RCM_EVENEMENTS introuvable dans app/index.html'); process.exit(1); }
let evts=[...mEvts[1].replace(/\/\/[^\n]*/g,'').matchAll(/'([^']+)'/g)].map(m=>m[1]);
if(evts.length<15){ console.error('RCM_EVENEMENTS : '+evts.length+' nom(s) lu(s), lecture cassee'); process.exit(1); }

// ⚠ DEUX FAMILLES DE COMPTEURS DEPUIS LE BUILD 1422, ET LA MEME LISTE BLANCHE.
// RCM_EVENEMENTS compte les etapes du tunnel ; RCQ_NOMS compte la CAPACITE
// (kilo-octets echanges avec la base, envois et octets chez l'hebergeur de
// medias). Les deux passent par le meme noeud, donc par le meme `.validate` —
// et un nom absent est rejete SANS AUCUN SIGNAL. Ne verifier que la premiere
// famille aurait laisse la carte « Capacite » afficher zero pendant des
// semaines, ce qui est precisement le defaut que ce controle existe pour
// empecher.
// ⚠ PAS DE `[^]]` ICI : en JavaScript, `[^]` vaut « n'importe quel
//   caractere » et non « tout sauf ] » — le motif ne lisait rien, et le
//   controle annoncait poliment qu'il ne verifiait pas.
const mQ=source.match(/const RCQ_NOMS=Object\.freeze\(\[([\s\S]*?)\]\)/);
const qs=mQ?[...mQ[1].matchAll(/'([^']+)'/g)].map(m=>m[1]):[];
if(mQ&&qs.length<4){ console.error('RCQ_NOMS : '+qs.length+' nom(s) lu(s), lecture cassee'); process.exit(1); }
if(!mQ) console.log('RCQ_NOMS introuvable : les compteurs de capacite ne sont pas verifies');
for(const q of qs) evts.push(q);

// ⚠ DEUX LISTES DANS LA REGLE DEPUIS LE 01/10/2026 : une etape de tunnel
// n'avance que de UN par ecriture, un compteur de capacite d'au plus un
// million. La premiere `$evenement.matches` est le tunnel, la seconde la
// capacite ; chaque famille doit etre dans SA liste, sinon la borne serait
// la mauvaise (un paquet de capacite refuse, ou un +5 accepte au tunnel).
const mRegexes=[...regles.matchAll(/\$evenement\.matches\(\/\^\(([^)]*)\)\$\/\)/g)].map(m=>m[1].split('|').filter(Boolean));
if(mRegexes.length!==2){ console.error('/metrics : deux listes blanches attendues (tunnel, capacite), '+mRegexes.length+' trouvee(s)'); process.exit(1); }
const [tunnelRegle,capaRegle]=mRegexes;
const acceptes=new Set([...tunnelRegle,...capaRegle]);
const tunnelCode=evts.filter(n=>!qs.includes(n));
const malRanges=[...tunnelCode.filter(n=>capaRegle.includes(n)),...qs.filter(n=>tunnelRegle.includes(n))];
if(malRanges.length){ console.error('\n/metrics : nom(s) dans la mauvaise liste (mauvaise borne) : '+malRanges.join(', ')); process.exit(1); }
if(qs.length&&(qs.length!==capaRegle.length||qs.some(n=>!capaRegle.includes(n)))){
  console.error('\n/metrics : la liste de capacite de la regle ('+capaRegle.join(',')+') differe de RCQ_NOMS ('+qs.join(',')+')'); process.exit(1);
}

console.log('\ncompteurs ecrits par le code : '+evts.length
  +'   noms acceptes par les regles : '+acceptes.size+' ('+tunnelRegle.length+' a +1, '+capaRegle.length+' par paquets)');
const refuses=evts.filter(n=>!acceptes.has(n));
if(refuses.length){
  console.error('\nCOMPTE PAR L\'APP, REFUSE PAR LE SERVEUR : '+refuses.join(', '));
  console.error('Ces incrementations partent et sont rejetees SANS AUCUN SIGNAL :');
  console.error('l\'ecran « Tunnel : 7 jours » affichera zero sans dire pourquoi.');
  console.error('Ajoute chaque nom a $evenement.matches dans database.rules.json.');
  process.exit(1);
}
// Un nom accepte que plus personne n'ecrit n'est pas dangereux — mais il
// laisse croire qu'une mesure existe.
const inutiles=[...acceptes].filter(n=>!evts.includes(n));
if(inutiles.length) console.log('nom(s) accepte(s) que le code n\'ecrit plus : '+inutiles.join(', '));

// ══ L'ATTRIBUTION : TROIS LISTES DE src, UNE SEULE VERITE ══════════════════
// La regle de /attribution/jours/$jour/src/$s n'accepte qu'une liste fermee.
// L'app (ATTR_SRC_CONNUS) et le Worker (SRC_CONNUS, functions/attribution-calcul.js)
// ramenent tout src inconnu a 'autre'. Un nom que l'app ecrit et que la regle
// refuse serait perdu sans un mot ; un nom que la regle accepte et que l'app
// ne connait pas n'arriverait jamais. Les trois doivent etre identiques.
{
  const mApp=source.match(/const ATTR_SRC_CONNUS=Object\.freeze\(\[([\s\S]*?)\]\)/);
  const attribCalc=readFileSync('functions/attribution-calcul.js','utf8');
  const mW=attribCalc.match(/const SRC_CONNUS = Object\.freeze\(\[([\s\S]*?)\]\)/);
  const mR=regles.match(/"\$s":\s*\{[\s\S]*?\$s\.matches\(\/\^\(([^)]*)\)\$\/\)/);
  if(!mApp||!mW||!mR){ console.error('attribution : liste de src introuvable (app '+!!mApp+', Worker '+!!mW+', regles '+!!mR+')'); process.exit(1); }
  const app=[...mApp[1].matchAll(/'([^']+)'/g)].map(m=>m[1]).sort();
  const w=[...mW[1].matchAll(/"([^"]+)"/g)].map(m=>m[1]).sort();
  const r=mR[1].split('|').sort();
  if(app.join()!==w.join()||app.join()!==r.join()){
    console.error('\nATTRIBUTION : les listes de src divergent');
    console.error('  app    : '+app.join(','));
    console.error('  Worker : '+w.join(','));
    console.error('  regles : '+r.join(','));
    process.exit(1);
  }
  if(!app.includes('autre')||!app.includes('direct')){ console.error('attribution : autre et direct doivent etre dans la liste'); process.exit(1); }
  console.log('attribution : '+app.length+' src, identiques dans l\'app, le Worker et les regles');
}

// ══ CE QUI EST BORNE, ET CE QUI NE PEUT PAS L'ETRE (01/10/2026) ════════════
//
// ECRITURES ANONYMES (sans compte) — toutes bornees par ecriture :
//   /metrics/$jour/$evenement     tunnel : +1 exactement (ou 1) ; capacite
//                                 (RCQ_NOMS) : +1 000 000 au plus ; < 10 000 000.
//   /attribution/jours/$jour/src/$s/$m   +1 ; $s en liste blanche ; $m ferme.
//   /attribution/jours/$jour/amb/$c/$m   +1 ; $c doit exister sous /ambassadeurs.
//   /attribution/semaines/$lundi/actifs  +1.
//   $jour, $lundi : une date plausible (2020-2099, mois 01-12, jour 01-31).
//   PROFONDEUR FIXE : chaque niveau est nomme ou motif ; "$autre": false au jour.
//
// CE QUE LES REGLES NE SAVENT PAS EXPRIMER, et ce qui le remplace :
//   · « aujourd'hui a un jour pres » pour une clef de date : aucune fonction
//     de date, et `now` (un nombre) ne se compare pas a une clef texte. Le
//     Worker efface chaque nuit les jours poses dans le futur (pouls.js).
//   · un plafond de debit (N ecritures par minute) : pas d'etat entre deux
//     ecritures. Une ecriture anonyme reste donc REPETABLE ; elle n'avance que
//     d'un pas borne, et le compteur plafonne a dix millions.
//   · une taille TOTALE de users/$emailKey : `.validate` ne mesure pas un
//     noeud. On borne les champs, un par un.
//
// users/$emailKey — ce qui est borne (le reste est libre, ecrit par son seul
// titulaire ou son coach, jamais anonyme) :
//   texte <= 4 000 : bio, catchphrase, vision, traitementDetail,
//                    sessions/$i/notes, videos/$i/feedback, bilans/$i/<texte>
//                    (hors clefs « -photo- », base64 en migration),
//                    msgTemplates/$i/corps, quickComments/$i/text ;
//   schema FERME ("$autre": false) : msgTemplates/$i, quickComments/$i,
//                    notesExo/$exKey, motCoach, bilanCadence, rgpd, abonnement,
//                    coachNotes/$a/$i, badges/$b, etiquettes/$id ;
//   plus courts : coachNotes texte 600, motCoach 600, noteAthlete 280,
//                    notesExo 140, questionsCoach 120, relancesAuto 280.
// L'app rogne avant chaque PUT (_textesBornes) : un depassement ne fait
// jamais rejeter le dossier.
{
  const borne=(chemin,motif)=>{ if(!motif.test(regles)){ console.error('BORNE DISPARUE : '+chemin); process.exit(1); } };
  borne('users bio <= 4000',/"bio":\s*\{ "\.validate": "newData\.isString\(\) && newData\.val\(\)\.length <= 4000"/);
  borne('users bilans <= 4000',/"bilans":\s*\{\s*"\$i":\s*\{\s*"\$champ":\s*\{ "\.validate": "!newData\.isString\(\) \|\| \$champ\.matches\(\/-photo-\/\) \|\| newData\.val\(\)\.length <= 4000"/);
  borne('users msgTemplates ferme',/"msgTemplates":[\s\S]{0,800}?"corps":[^\n]*4000[\s\S]{0,200}?"\$autre": \{ "\.validate": false \}/);
  borne('users quickComments ferme',/"quickComments":[\s\S]{0,600}?"text":[^\n]*4000[\s\S]{0,200}?"\$autre": \{ "\.validate": false \}/);
  borne('metrics +1',/newData\.val\(\) === data\.val\(\) \+ 1\)\)\) \|\| \(\$evenement\.matches/);
  borne('metrics pas de capacite',/newData\.val\(\) - data\.val\(\) <= 1000000/);
  borne('attribution amb existe',/root\.child\('ambassadeurs'\)\.child\(\$c\)\.exists\(\)/);
  console.log('bornes des ecritures : presentes (users, metrics, attribution)');
}

// ══ LES BADGES : LA MEME LISTE, AUX DEUX BOUTS ═════════════════════════════
//
// La collection est FERMEE : cinquante identifiants depuis le 26/09/2026 (ils
// etaient cinq). Elle est ecrite DEUX FOIS — BADGES_ACQUIS dans le code, et le
// motif de cle de /users/$emailKey/badges dans database.rules.json — et ce
// bloc verifie qu'elles disent la meme chose.
//
// Les deux sens comptent ici, contrairement aux compteurs de tunnel :
//  — un badge que le code attribue et que le serveur refuse serait gagne sur
//    l'appareil puis perdu a la premiere synchro, sans le moindre signal ;
//  — un badge accepte par les regles et absent du code est une place libre
//    qu'un lot futur n'aurait plus qu'a remplir sans le dire.
const mBadges=source.match(/const BADGES_ACQUIS=Object\.freeze\(\[([\s\S]*?)\n\]\.map/);
if(!mBadges){ console.error('BADGES_ACQUIS introuvable dans le code'); process.exit(1); }
const badges=[...mBadges[1].matchAll(/\bid:'([^']+)'/g)].map(m=>m[1]);
if(new Set(badges).size!==badges.length){
  console.error('\nBADGES_ACQUIS : deux badges portent le meme identifiant.');
  process.exit(1);
}
const mBadgeRegex=regles.match(/\$badge\.matches\(\/\^\(([^)]*)\)\$\/\)/);
if(!mBadgeRegex){ console.error('la liste blanche des badges a disparu des regles'); process.exit(1); }
const badgesAcceptes=new Set(mBadgeRegex[1].split('|').filter(Boolean));

console.log('\nbadges declares par le code : '+badges.length
  +'   identifiants acceptes par les regles : '+badgesAcceptes.size);
const badgesRefuses=badges.filter(n=>!badgesAcceptes.has(n));
const badgesOrphelins=[...badgesAcceptes].filter(n=>!badges.includes(n));
if(badgesRefuses.length||badgesOrphelins.length){
  if(badgesRefuses.length){
    console.error('\nATTRIBUE PAR L\'APP, REFUSE PAR LE SERVEUR : '+badgesRefuses.join(', '));
    console.error('Le badge serait gagne sur l\'appareil puis efface a la synchro.');
  }
  if(badgesOrphelins.length){
    console.error('\nACCEPTE PAR LES REGLES, INCONNU DU CODE : '+badgesOrphelins.join(', '));
    console.error('Une place libre pour un sixieme badge. Retire-la.');
  }
  console.error('Les deux listes doivent etre identiques : BADGES_ACQUIS dans');
  console.error('app/index.html, $badge.matches dans database.rules.json.');
  process.exit(1);
}

// ══ LA BOUTIQUE : UN SEUL VENDEUR, ECRIT DANS DEUX FICHIERS ═══════════════
//
// L'adresse du createur vit dans app/index.html (CREATOR_EMAIL) ET dans la
// regle d'ecriture de /boutique. Changer l'une sans l'autre donnerait soit un
// vendeur qui ne peut plus rien publier, soit — bien pire — une boutique que
// PERSONNE ne garde : n'importe quel compte connecte pourrait y poser un
// programme, un prix, une image.
//
// ⚠ ET CE CONTROLE NE PEUT PAS VIVRE DANS tests.js. Il y a ete ecrit une fois,
// en `async` : `ok` ne regarde que la veracite de son second argument, et une
// promesse est toujours vraie — l'assertion passait au vert quoi qu'il arrive.
// Meme synchrone elle ne vaudrait rien, puisque database.rules.json n'est pas
// deploye et qu'un fetch depuis la page conclurait « tout va bien » sur un
// fichier absent. C'est exactement ainsi que 'logo' est reste casse.
const mCreateur=source.match(/const CREATOR_EMAIL='([^']+)'/);
if(!mCreateur){ console.error('CREATOR_EMAIL introuvable dans app/index.html'); process.exit(1); }
const mBoutique=regles.match(/"boutique"\s*:\s*\{([\s\S]*?)\n  \}/);
if(!mBoutique){ console.error('le noeud boutique est absent de database.rules.json'); process.exit(1); }
const mEcrit=mBoutique[1].match(/"\.write"\s*:\s*"([^"]+)"/);
const mLit=mBoutique[1].match(/"\.read"\s*:\s*"([^"]+)"/);
if(!mEcrit||!mLit){ console.error('le noeud boutique n\'a pas ses deux regles'); process.exit(1); }
console.log('\nvendeur declare par le code : '+mCreateur[1]);
if(mEcrit[1].indexOf(CONDITION_CREATEUR)<0){
  console.error('\nLA REGLE NOMME UN AUTRE VENDEUR QUE LE CODE.');
  console.error('  code   : '+CONDITION_CREATEUR);
  console.error('  regles : '+mEcrit[1]);
  console.error('Soit le createur ne peut plus publier, soit n\'importe qui le peut.');
  process.exit(1);
}
if(mEcrit[1].indexOf('auth != null')<0){
  console.error('\nLA BOUTIQUE S\'ECRIT SANS COMPTE : '+mEcrit[1]);
  process.exit(1);
}
if(mLit[1].indexOf('auth != null')<0){
  console.error('\nLA BOUTIQUE NE SE LIT PLUS : '+mLit[1]);
  console.error('C\'est pourtant sa raison d\'etre : l\'athlete doit voir le prix pose.');
  process.exit(1);
}
// Les bornes de taille, des deux cotes. Une borne cote client plus large que
// celle du serveur donnerait un echec de publication muet.
// ⚠ LES SEANCES VIVENT DANS boutique_contenu DEPUIS LE 01/10/2026 : la fiche
//   publique ne doit plus les porter, et le contenu doit rester ferme a qui
//   n'a pas achete (droits/<cle>/programmes/<id>) — sinon la boutique donne
//   ce qu'elle vend a tout compte connecte.
const mContenu=regles.match(/"boutique_contenu"\s*:\s*\{([\s\S]*?)\n  \}/);
if(!mContenu){ console.error('\nle noeud boutique_contenu est absent : les seances vendues n\'ont plus de place fermee'); process.exit(1); }
if(/"seances"\s*:/.test(mBoutique[1])){ console.error('\nLA FICHE PUBLIQUE (boutique) ACCEPTE ENCORE DES SEANCES : tout compte connecte les lirait.'); process.exit(1); }
const mLitC=mContenu[1].match(/"\.read"\s*:\s*"([^"]+)"/), mEcC=mContenu[1].match(/"\.write"\s*:\s*"([^"]+)"/);
if(!mLitC||mLitC[1].indexOf("child('programmes').child($progId).exists()")<0){ console.error('\nboutique_contenu ne se lit plus sur la preuve d\'achat (droits/<cle>/programmes/<id>)'); process.exit(1); }
if(!mEcC||mEcC[1].indexOf(CONDITION_CREATEUR)<0){ console.error('\nboutique_contenu s\'ecrit par un autre que le createur'); process.exit(1); }
for(const [champ,att,bloc] of [['image',420000,mBoutique[1]],['seances',240000,mContenu[1]]]){
  const m=bloc.match(new RegExp('"'+champ+'"\\s*:\\s*\\{[^}]*length\\s*<\\s*(\\d+)'));
  if(!m){ console.error('\nle champ '+champ+' n\'est pas borne dans les regles'); process.exit(1); }
  if(Number(m[1])!==att){
    console.error('\nBORNE INCOHERENTE sur '+champ+' : regles '+m[1]+', code '+att);
    console.error('Le client laisserait passer ce que le serveur refuse, sans un mot.');
    process.exit(1);
  }
  if(source.indexOf(String(att))<0){
    console.error('\nla borne de '+champ+' ('+att+') n\'est plus verifiee cote client');
    process.exit(1);
  }
}
console.log('boutique : un seul vendeur, fiche ouverte sans seances, contenu a l\'acheteur, bornes concordantes');

// ══ LE LANGAGE DES REGLES N'EST PAS DU JAVASCRIPT ═════════════════════════
//
// Ecrire `newData.val().toFixed(0)` dans une regle passe la relecture humaine
// et la validation JSON, puis fait echouer le DEPLOIEMENT COMPLET :
// « Error: Syntax error in database rules: No such method/property 'toFixed' ».
// Et il echoue AVANT d'envoyer l'hebergement : une faute d'un mot dans ce
// fichier bloque la mise en ligne de toute l'application.
//
// Le langage n'a ni toFixed, ni toString, ni parseInt, ni Math, ni JSON, ni
// indexOf. Il a `%` pour dire « entier », `.length` sur les chaines,
// `.matches()` pour les expressions rationnelles, et `.replace()`.
// C'est arrive le 16/09/2026, sur prixCts.
// ⚠ DES MOTIFS, PAS DES SOUS-CHAINES. La premiere version cherchait
// « Number( » et trouvait « isNumber( » — qui est, lui, le coeur meme du
// langage : elle accusait quarante regles parfaitement valides. Une sonde qui
// crie au loup partout ne se lit plus.
const INTERDITS=[
  [/\.toFixed\s*\(/,'toFixed'], [/\.toString\s*\(/,'toString'],
  [/\bparseInt\s*\(/,'parseInt'], [/\bparseFloat\s*\(/,'parseFloat'],
  [/\bMath\./,'Math.'], [/\bJSON\./,'JSON.'],
  [/\.indexOf\s*\(/,'indexOf'], [/\.substring\s*\(/,'substring'],
  [/\.slice\s*\(/,'slice'], [/\.toUpperCase\s*\(/,'toUpperCase'],
  [/\.toLowerCase\s*\(/,'toLowerCase'], [/\bisNaN\s*\(/,'isNaN'],
  [/(^|[^A-Za-z])Number\s*\(/,'Number()'], [/\.push\s*\(/,'push'],
  [/\bfor\s*\(/,'for'], [/=>/,'=>']
];
const fautes=[];
regles.split('\n').forEach((ligne,i)=>{
  if(/^\s*\/\//.test(ligne)) return;            // un commentaire peut les nommer
  for(const [re_,nom] of INTERDITS)
    if(re_.test(ligne)) fautes.push('  ligne '+(i+1)+' : '+nom+'   '+ligne.trim().slice(0,90));
});
if(fautes.length){
  console.error('\nDU JAVASCRIPT DANS LES REGLES — le deploiement le refusera,');
  console.error('et il refusera AUSSI l\'hebergement : tout reste en ligne dans');
  console.error('sa version precedente, sans que rien ne le dise.');
  fautes.forEach(f=>console.error(f));
  process.exit(1);
}
console.log('regles : aucun appel JavaScript inconnu du langage');

// ══ LE NOEUD droits/ : LU PAR DEUX, ECRIT PAR UN SEUL COMPTE ═════════════
//
// ⚠ CE TEST A CHANGE DE CONTRAT LE 24/09/2026, ET VOICI POURQUOI. Il exigeait
//   « ".write": false » : le noeud devait etre rempli par une Cloud Function,
//   donc par personne depuis un navigateur. Kevin ne prend pas le plan Blaze,
//   il n y aura donc pas de fonction — et un noeud que PERSONNE n ecrit jamais
//   ne sert a rien. L ecriture est maintenant accordee a UNE adresse, celle du
//   createur, et c est exactement ce que ce test verifie desormais : la regle
//   NOMME une adresse, et le code qui ecrit verifie la meme de son cote.
//
//   CE QUI RESTE FERME, et qui est tout l interet du noeud : le titulaire du
//   dossier n y touche pas. Un dossier se trafique depuis une console de
//   navigateur ; droits/ non.
{
  const i=regles.indexOf('"droits"');
  const bloc=i<0?'':regles.slice(i,regles.indexOf('\n  },',i)+5);
  if(!bloc){
    console.error('\ndroits/ ABSENT de database.rules.json : le palier serveur ne peut pas etre lu.');
    process.exit(1);
  }
  const w=bloc.match(/"\.write"\s*:\s*("(?:[^"\\]|\\.)*"|true|false)/);
  if(!w){
    console.error('\ndroits/ n\'a plus de regle d\'ecriture du tout.');
    process.exit(1);
  }
  if(w[1]==='true'||/^"\s*auth\s*!=\s*null\s*"$/.test(w[1])){
    console.error('\ndroits/ est ouvert a tout compte connecte : n\'importe qui pourrait se poser un palier.');
    process.exit(1);
  }
  // LE CREATEUR DOIT Y ETRE NOMME EN CLAIR (UID + adresse verifiee depuis le
  // 01/10/2026). Une condition qui passerait par le dossier (« role ===
  // coach », par exemple) rendrait la serrure aussi trafiquable que le
  // dossier lui-meme.
  if(w[1]!=='false'&&w[1].indexOf(CONDITION_CREATEUR)<0){
    console.error('\ndroits/ s\'ecrit sans nommer le createur (UID + adresse verifiee) : '+w[1].slice(0,90));
    process.exit(1);
  }
  if(!/"\.read"\s*:/.test(bloc)){
    console.error('\ndroits/ n\'est pas lisible : l\'application ne pourra jamais lire le palier.');
    process.exit(1);
  }
  // LES CHAMPS SONT ENUMERES. Sans « $autre : false », une faute de frappe
  // ecrirait « palie » a cote de « palier » sans que rien ne bronche.
  if(!/"\$autre"\s*:\s*\{\s*"\.validate"\s*:\s*false/.test(bloc)){
    console.error('\ndroits/ accepte des champs non prevus : une faute de frappe y passerait.');
    process.exit(1);
  }
  // ── ET LE CODE QUI ECRIT VERIFIE L'ADRESSE, LUI AUSSI ─────────────────
  // Defense en profondeur : la regle refuserait l'ecriture d'un autre compte,
  // mais le refus arriverait APRES le geste, sous forme d'un echec reseau
  // illisible. La garde locale dit non tout de suite, et dit pourquoi.
  const iw=source.indexOf('async poserDroits(');
  if(iw<0){
    console.error('\nposerDroits a disparu : plus rien dans l\'application ne peut ouvrir ni fermer un acces.');
    process.exit(1);
  }
  if(source.slice(iw,iw+1800).indexOf('CREATOR_EMAIL')<0){
    console.error('\nposerDroits ecrit dans droits/ sans verifier l\'adresse du createur.');
    process.exit(1);
  }
  // ET IL N'Y A QUE DEUX CHEMINS VERS CE NOEUD : la lecture et cette ecriture.
  // Un troisieme est peut-etre legitime — mais il doit passer par la meme
  // garde, donc par poserDroits, et ce compte le dira.
  const chemins=(source.match(/'droits\/'/g)||[]).length;
  if(chemins!==2){
    console.error('\n'+chemins+' endroits construisent une adresse droits/ au lieu de 2 '
      +'(la lecture et poserDroits). Toute ecriture doit passer par poserDroits.');
    process.exit(1);
  }
  console.log('droits : lisible par le titulaire, son coach et le createur ; ecrit par le createur seul');
  // ── RIEN D'AUTRE NE L'OUVRE (27/09/2026) ──────────────────────────────
  // Une regle posee AU-DESSUS (la racine) s'ajouterait a celle de droits/ :
  // Firebase accorde des qu'un ancetre accorde. Et aucune autre regle ne doit
  // ouvrir un contenu paye sur la foi du DOSSIER, que son titulaire ecrit.
  {
    const sansCommentaires=regles.split('\n').map((l)=>{ let q=false,o='';
      for(let i=0;i<l.length;i++){ const c=l[i]; if(c==='"'&&l[i-1]!=='\\') q=!q; if(!q&&c==='/'&&l[i+1]==='/') break; o+=c; }
      return o; }).join('\n');
    const R=JSON.parse(sansCommentaires).rules;
    if(R['.write']!==undefined||R['.read']!==undefined){
      console.error('\nUne regle a la racine s\'ajoute a celle de droits/ : '+JSON.stringify(R['.write']||R['.read']).slice(0,90));
      process.exit(1);
    }
    const lecture=String((R.exercices||{})['.read']||'');
    // La branche « dossier » n'est admise que gardée par l'interrupteur de la
    // bascule : elle s'éteint quand reglages_publics/droitsServeur existe.
    const garde="!root.child('reglages_publics').child('droitsServeur').exists() &&";
    const sansGarde=lecture.split('||').filter((b)=>/child\('(status|paymentStatus|abonnement|accessExpiry|programmesAchetes)'\)/.test(b)&&b.indexOf(garde)<0);
    if(sansGarde.length){
      console.error('\nLe catalogue d\'exercices s\'ouvre encore sur la foi du dossier (status, paymentStatus, abonnement) sans l\'interrupteur de la bascule : son titulaire l\'ecrit.');
      process.exit(1);
    }
    console.log('droits : aucune regle au-dessus ne l\'ouvre ; le catalogue ne lit le dossier que jusqu\'a la bascule');
  }
}

// ── LES TYPES D'EVENEMENTS (lot M2, 30/09/2026) ─────────────────────────
// /evenements/$id/type se ferme sur une liste blanche. Un type depose par
// l'app (deposerEvenement({type:'...'})) et absent de cette liste est refuse
// par Firebase : la notification ne part jamais, et l'app n'en dit rien.
{
  const deposes=[...new Set([...source.matchAll(/deposerEvenement\(\{\s*type\s*:\s*'([a-z_]+)'/g)].map((m)=>m[1]))];
  const mT=regles.match(/"type":\s*\{\s*"\.validate":\s*"newData\.isString\(\) && newData\.val\(\)\.matches\(\/\^\(([a-z_|]+)\)\$\/\)"/);
  if(!mT){ console.error('la liste blanche des types de /evenements a disparu des regles'); process.exit(1); }
  const admis=new Set(mT[1].split('|'));
  if(deposes.length<5){ console.error('deposerEvenement : '+deposes.length+' type(s) lu(s), lecture cassee'); process.exit(1); }
  const refuses=deposes.filter((t)=>!admis.has(t));
  if(refuses.length){
    console.error('\nDEPOSES PAR L\'APP, REFUSES PAR LES REGLES : '+refuses.join(', '));
    console.error('Ajoute-les a /evenements/$id/type (et leur clause de « cible »).');
    process.exit(1);
  }
  console.log('evenements : '+deposes.length+' type(s) deposes par l\'app, tous admis par les regles');
}

// ── LES CHAMPS DE DROITS GELES (30/09/2026) ─────────────────────────────
// status, role, coachPlan… se lisaient dans un dossier que son titulaire
// ecrit : un PUT status:'COACHING_SUIVI' ouvrait tout. Ils sont geles sous
// users/$emailKey ; retirer un seul de ces gels rouvre la faille sans bruit.
// Et le code de l'app doit les recopier du serveur avant chaque PUT
// (CHAMPS_GELES), sinon c'est le dossier ENTIER que Firebase rejette.
{
  const sansCom=regles.split('\n').map((l)=>{ let q=false,o='';
    for(let i=0;i<l.length;i++){ const c=l[i]; if(c==='"'&&l[i-1]!=='\\') q=!q; if(!q&&c==='/'&&l[i+1]==='/') break; o+=c; }
    return o; }).join('\n');
  const R=JSON.parse(sansCom).rules;
  const U=((R.users||{})['$emailKey'])||{};
  const CREA=CONDITION_CREATEUR;
  const gele=(v)=>typeof v==='string'&&v.indexOf('newData.val() === data.val()')>=0&&v.indexOf(CREA)>=0;
  const fautes=[];
  for(const k of ['status','paymentStatus','accessExpiry','coachPlan','coachSubActive','role'])
    if(!gele((U[k]||{})['.validate'])) fautes.push('users/$emailKey/'+k);
  const pa=((((U.programmesAchetes||{})['$prog'])||{})['$champ'])||{};
  if(!gele(pa['.validate'])) fautes.push('users/$emailKey/programmesAchetes/$prog/$champ');
  for(const k of ['formule','statutPaypal','finAccesPaypal','dernierPaiementLe'])
    if(!gele(((U.abonnement||{})[k]||{})['.validate'])) fautes.push('users/$emailKey/abonnement/'+k);
  if(((U.role||{})['.validate']||'').indexOf("newData.val() === 'athlete'")<0) fautes.push('role : la premiere pose doit se limiter a athlete');
  const reg=((R.coachs_registre||{})['$k'])||{};
  if(reg['.write']!==false) fautes.push('coachs_registre : .write doit valoir false');
  const ecr=String((((R.rc_codes||{})['$code'])||{})['.write']||'');
  if(ecr.indexOf("!data.exists() && (root.child('coachs_registre')")<0) fautes.push('rc_codes : la creation n exige plus le registre des coachs');
  if(/newData\.child\('redeemed'\)\.val\(\) === true/.test(ecr)) fautes.push('rc_codes : un tiers peut encore passer redeemed a true');
  // Le code : la meme liste, recopiee avant le PUT.
  const mG=source.match(/const CHAMPS_GELES=Object\.freeze\(\[([^\]]*)\]\)/);
  const cote=mG?[...mG[1].matchAll(/'([^']+)'/g)].map((m)=>m[1]):[];
  for(const k of ['status','paymentStatus','accessExpiry','coachPlan','coachSubActive','programmesAchetes','role'])
    if(cote.indexOf(k)<0) fautes.push('CHAMPS_GELES (app) : '+k+' manque — le PUT du dossier serait rejete');
  if(fautes.length){
    console.error('\nGEL DES DROITS INCOMPLET :\n  '+fautes.join('\n  '));
    process.exit(1);
  }
  console.log('droits geles : 11 champs de users/ figes, coachs_registre ferme, rc_codes reserve aux coachs enregistres');
}

// ══ LES SCORES : ÉCRITS PAR LE WORKER SEUL (01/10/2026) ═══════════════════
// Les valeurs des défis du Canal, des duels et des saisons se tirent des
// séances, côté Worker (cloudflare/src/xp.js, valeurServeur). Une écriture
// client rouverte ici rendrait à n'importe quelle console le pouvoir de
// s'inscrire 999 — et l'app, qui ne les écrit plus, ne s'en plaindrait pas.
{
  const arbre=JSON.parse(regles.replace(/^\s*\/\/.*$/gm,''));
  const chemins=[
    ['duels','$id','progres','$k'],
    ['saisons_progres','$id','$k'],
    ['canaux','$coachKey','defis','$msgId','participants','$athleteKey','valeur'],
    ['canaux','$coachKey','defis','$msgId','participants','$athleteKey','metrique'],
    ['canaux','$coachKey','defis','$msgId','participants','$athleteKey','maj'],
    // LES LIGUES (01/10/2026) : classement, groupes, résultats, tout vient du Worker.
    ['ligues','$lundi','$g'],
    ['ligues_public','$lundi','$g'],
    ['ligues_membres','$k'],
    ['ligues_resultats','$k'],
  ];
  const fautes=[];
  for(const c of chemins){
    let n=arbre.rules;
    for(const k of c){ n=n&&n[k]; }
    if(!n){ fautes.push(c.join('/')+' : absent des regles'); continue; }
    // Ni sur le noeud, ni sur l'un de ses ancetres (Firebase accorde des qu'un ancetre accorde).
    // Un ancetre ouvert (la creation d'un duel par son createur) n'est admis
    // que si un noeud plus bas, jusqu'a la cible, refuse tout : ".validate": false.
    const noeuds=[]; { let a=arbre.rules; for(const k of c){ a=a&&a[k]; noeuds.push(a); } }
    for(let i=0;i<noeuds.length;i++){
      const w=noeuds[i]&&noeuds[i]['.write'];
      if(w===undefined||w===false) continue;
      const barre=noeuds.slice(i+1).some((x)=>x&&(x['.validate']===false||x['.validate']==='false'));
      if(!barre){ fautes.push(c.slice(0,i+1).join('/')+' : .write client ('+String(w).slice(0,60)+')'); break; }
    }
    // Rien en dessous non plus.
    const sous=JSON.stringify(n);
    if(/"\.write"\s*:\s*(?!false)/.test(sous)) fautes.push(c.join('/')+' : une sous-cle accorde .write');
  }
  // L'APP N'ECRIT PLUS CES CHEMINS : la jauge reste calculee localement
  // (defiValeur), l'ecriture a disparu.
  if(/duels\/'\+id\+'\/progres\//.test(source)) fautes.push("l'app ecrit encore duels/<id>/progres");
  // La relecture de sa valeur de saison (GET) reste permise ; une ecriture non.
  for(const m of source.matchAll(/saisons_progres\/'\+/g)){
    if(/method:\s*'(PUT|PATCH|POST)'/.test(source.slice(m.index,m.index+260))) fautes.push("l'app ecrit encore saisons_progres");
  }
  if(/participants\/'\+moi,\s*\{valeur/.test(source)) fautes.push("l'app ecrit encore participants/<moi>/valeur");
  for(const m of source.matchAll(/'ligues(?:_public|_membres|_resultats)?\/'\+/g)){
    if(/method:\s*'(PUT|PATCH|POST)'|,'(PUT|PATCH|POST)'/.test(source.slice(m.index,m.index+200))) fautes.push("l'app ecrit dans les ligues");
  }
  if(fautes.length){
    console.error('\nSCORES ECRITS PAR UN CLIENT :\n  '+fautes.join('\n  '));
    process.exit(1);
  }
  console.log('scores (defis du Canal, duels, saisons, ligues) : aucune ecriture client ; le Worker seul');
}

// ══ LE FUSEAU : UN MOTIF, TROIS COPIES (01/10/2026) ═══════════════════════
// users/$emailKey/tz est validé par la règle ; l'app (TZ_RE, rc-core) ne
// l'écrit que s'il passe le même motif, et le Worker (metier.js) le relit
// avec lui. Une règle plus stricte que l'app ferait rejeter le dossier ENTIER.
{
  const norm=(x)=>String(x||'').replace(/\\\//g,'/').replace(/\(\?:/g,'(');
  const app=(source.match(/const TZ_RE=\/(.*)\/;/)||[])[1];
  const w=(readFileSync('cloudflare/src/metier.js','utf8').match(/export const TZ_RE = \/(.*)\/;/)||[])[1];
  const r=(regles.match(/"tz":\s*\{[^}]*matches\(\/(.*?)\/\)/)||[])[1];
  if(!app||!w||!r){ console.error('\nfuseau : motif introuvable (app '+!!app+', Worker '+!!w+', regles '+!!r+')'); process.exit(1); }
  if(norm(app)!==norm(w)||norm(app)!==norm(r.replace(/\\\\/g,'\\'))){
    console.error('\nFUSEAU : les motifs divergent\n  app    : '+app+'\n  Worker : '+w+'\n  regles : '+r); process.exit(1);
  }
  console.log('fuseau : le meme motif dans l\'app, le Worker et les regles');
}

// ══ LES INDICATEURS : LUS PAR LE CREATEUR SEUL, ECRITS PAR PERSONNE (02/10/2026) ══
// Le MRR, les abonnes, le churn : les chiffres de l'entreprise. Le Worker les
// ecrit (Admin, hors regles) ; une regle trop large les montrerait a tout
// compte connecte.
{
  const m=regles.match(/"indicateurs"\s*:\s*\{([\s\S]*?)\n    \}/);
  if(!m){ console.error('\nindicateurs/ n\'est pas declare dans database.rules.json'); process.exit(1); }
  const lit=(m[1].match(/"\.read"\s*:\s*"([^"]+)"/)||[])[1]||'';
  const ecrit=(m[1].match(/"\.write"\s*:\s*([^,\n]+)/)||[])[1]||'';
  if(lit!=='auth != null && '+CONDITION_CREATEUR){ console.error('\nindicateurs/ : lecture « '+lit+' » — attendu : auth != null && '+CONDITION_CREATEUR); process.exit(1); }
  if(ecrit.trim()!=='false'){ console.error('\nindicateurs/ : ecriture « '+ecrit.trim()+' » — attendu : false (le serveur ecrit en Admin)'); process.exit(1); }
  if(/"\$[a-zA-Z]+"\s*:/.test(m[1])){ console.error('\nindicateurs/ : une sous-regle pourrait ouvrir un jour a un autre compte'); process.exit(1); }
  // Le controle se prouve : une lecture ouverte a tous serait vue.
  const faux=m[1].replace(/"\.read"\s*:\s*"[^"]+"/,'".read": "auth != null"');
  const litFaux=(faux.match(/"\.read"\s*:\s*"([^"]+)"/)||[])[1]||'';
  if(litFaux==='auth != null && '+CONDITION_CREATEUR){ console.error('\nauto-controle indicateurs : une lecture ouverte n\'est pas vue'); process.exit(1); }
  console.log('indicateurs : lus par le createur seul, ecrits par le serveur seul');
}

// ══ AUCUNE REGLE D'ADMINISTRATION FONDEE SUR L'ADRESSE SEULE (01/10/2026) ══
//
// Une adresse e-mail n'est pas une identite : un compte Google, Apple ou lie
// peut porter l'adresse du createur sous un autre UID. Toute condition
// d'acces qui compare le jeton a l'adresse (ou a sa cle) du createur est donc
// refusee ici ; la seule forme admise est CONDITION_CREATEUR, UID + adresse
// verifiee. Les commentaires ne comptent pas ; une comparaison de CHEMIN
// ($coachKey === 'guellec,…' : la marque du createur) non plus, elle ne dit
// rien de qui appelle.
{
  const sansCom=regles.split('\n').map((l)=>{ let q=false,o='';
    for(let i=0;i<l.length;i++){ const c=l[i]; if(c==='"'&&l[i-1]!=='\\') q=!q; if(!q&&c==='/'&&l[i+1]==='/') break; o+=c; }
    return o; }).join('\n');
  const adresse=mCreateur[1], cle=adresse.replace(/\./g,',');
  const esc=(x)=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const fautes=[];
  // auth.token.email === '<adresse>' (ou ==, ou dans l'autre sens) ;
  // auth.token.email.replace('.', ',') === '<cle>'.
  const motifs=[
    new RegExp("auth\\.token\\.email\\s*===?\\s*'"+esc(adresse)+"'",'g'),
    new RegExp("'"+esc(adresse)+"'\\s*===?\\s*auth\\.token\\.email",'g'),
    new RegExp("auth\\.token\\.email\\.replace\\([^)]*\\)\\s*===?\\s*'"+esc(cle)+"'",'g'),
    new RegExp("'"+esc(cle)+"'\\s*===?\\s*auth\\.token\\.email",'g'),
  ];
  for(const m of motifs) for(const x of sansCom.matchAll(m)) fautes.push(x[0]);
  if(fautes.length){
    console.error('\nL\'ADRESSE DU CREATEUR SERT ENCORE DE CONDITION D\'ACCES ('+fautes.length+') :\n  '+fautes.slice(0,5).join('\n  '));
    console.error('Remplacer par '+CONDITION_CREATEUR);
    process.exit(1);
  }
  // Chaque auth.uid compare doit etre CELUI de la constante, et toujours
  // accompagne de l'adresse verifiee.
  const uids=[...sansCom.matchAll(/auth\.uid === '([^']*)'/g)].map((m)=>m[1]);
  const autres=uids.filter((u)=>u!==CREATEUR_UID);
  if(autres.length){ console.error('\nUID DIVERGENT dans les regles : '+[...new Set(autres)].join(', ')+' (createur.js : '+CREATEUR_UID+')'); console.error('node scripts/poser_uid_createur.mjs les realigne.'); process.exit(1); }
  const nus=uids.length-sansCom.split(CONDITION_CREATEUR).length+1;
  if(nus>0){ console.error('\n'+nus+' condition(s) auth.uid sans auth.token.email_verified === true'); process.exit(1); }
  if(uids.length<20){ console.error('\nseulement '+uids.length+' condition(s) createur dans les regles : lecture cassee ?'); process.exit(1); }
  console.log('createur : '+uids.length+' condition(s), toutes sur l\'UID et une adresse verifiee ; aucune sur l\'adresse seule');
  // ⚠ EN DERNIER, ET BLOQUANT : des regles deployees avec le texte de
  //   remplacement ne reconnaitraient PLUS PERSONNE comme createur.
  if(CREATEUR_UID===UID_A_POSER){
    console.error('\nCREATEUR_UID N\'EST PAS POSE (cloudflare/src/createur.js vaut encore '+UID_A_POSER+').');
    console.error('Console Firebase > Authentication > colonne « UID utilisateur » du compte createur,');
    console.error('puis : node scripts/poser_uid_createur.mjs. Ne PAS deployer ces regles avant.');
    process.exit(1);
  }
}

console.log('\nRien de bloquant.');
