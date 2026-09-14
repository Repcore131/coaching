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

const regles=readFileSync('database.rules.json','utf8');
const source=readFileSync('app/index.html','utf8');

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
console.log('\nRien de bloquant.');
