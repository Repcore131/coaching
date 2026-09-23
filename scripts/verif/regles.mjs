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
const evts=[...mEvts[1].replace(/\/\/[^\n]*/g,'').matchAll(/'([^']+)'/g)].map(m=>m[1]);
if(evts.length<15){ console.error('RCM_EVENEMENTS : '+evts.length+' nom(s) lu(s), lecture cassee'); process.exit(1); }

const mRegex=regles.match(/\$evenement\.matches\(\/\^\(([^)]*)\)\$\/\)/);
if(!mRegex){ console.error('la liste blanche de /metrics a disparu des regles'); process.exit(1); }
const acceptes=new Set(mRegex[1].split('|').filter(Boolean));

console.log('\ncompteurs ecrits par le code : '+evts.length
  +'   noms acceptes par les regles : '+acceptes.size);
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

// ══ LES CINQ BADGES : LA MEME LISTE, AUX DEUX BOUTS ════════════════════════
//
// « Cinq badges, pas un de plus » est une decision de produit, pas une limite
// technique : une collection qui s'allonge cesse d'etre une reconnaissance.
// Elle est donc ecrite DEUX FOIS — BADGES_ACQUIS dans app/index.html, et le motif de
// cle de /users/$emailKey/badges dans database.rules.json — et ce bloc verifie
// qu'elles disent la meme chose.
//
// Les deux sens comptent ici, contrairement aux compteurs de tunnel :
//  — un badge que le code attribue et que le serveur refuse serait gagne sur
//    l'appareil puis perdu a la premiere synchro, sans le moindre signal ;
//  — un badge accepte par les regles et absent du code est la porte ouverte
//    au sixieme, qu'un lot futur n'aurait plus qu'a pousser.
const mBadges=source.match(/const BADGES_ACQUIS=Object\.freeze\(\[([\s\S]*?)\]\);/);
if(!mBadges){ console.error('BADGES_ACQUIS introuvable dans app/index.html'); process.exit(1); }
const badges=[...mBadges[1].matchAll(/\bid:'([^']+)'/g)].map(m=>m[1]);
if(badges.length!==5){
  console.error('\nBADGES_ACQUIS : '+badges.length+' identifiant(s) lu(s), il en faut CINQ.');
  console.error('Cinq badges, pas un de plus, pas un de moins — c\'est la regle');
  console.error('de produit. Si elle doit changer, elle change ICI aussi, a la main.');
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
if(mEcrit[1].indexOf(mCreateur[1])<0){
  console.error('\nLA REGLE NOMME UN AUTRE VENDEUR QUE LE CODE.');
  console.error('  code   : '+mCreateur[1]);
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
for(const [champ,att] of [['image',420000],['seances',240000]]){
  const m=mBoutique[1].match(new RegExp('"'+champ+'"\\s*:\\s*\\{[^}]*length\\s*<\\s*(\\d+)'));
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
console.log('boutique : un seul vendeur, lecture ouverte, bornes concordantes');

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

console.log('\nRien de bloquant.');
