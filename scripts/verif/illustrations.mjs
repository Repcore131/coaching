#!/usr/bin/env node
// CE QUE L'INDEX ANNONCE DOIT EXISTER, ET A LA TAILLE QU'IL ANNONCE.
//
// POURQUOI. L'index dit quelles illustrations existent et quelles dimensions
// elles ont ; l'app en deduit deux chemins par exercice — la fiche et la
// vignette — et reserve la place de l'image d'apres les dimensions. Rien ne
// verifiait ni les fichiers ni les chiffres : une image absente ne leve aucune
// erreur, elle laisse un cadre vide, et une dimension fausse etire le dessin.
//
// LE 14/09/2026, ce script a trouve DEUX choses :
//   — le dossier vignettes/ entierement absent du depot alors que l'index le
//     declarait ; toutes les listes affichaient donc un vide.
//   — AUCUNE des 436 illustrations n'atteint les 900 px que le code annoncait.
//     La mediane est de 248 px. La fiche, posee en width:100% dans une modale
//     de 480 px, les etirait a deux fois leur taille : c'est le « images de
//     mauvaise qualite » rapporte par Kevin.
// Les deux sont corriges dans l'app ; ce script est ce qui empeche leur retour.
import {readFileSync,existsSync,statSync,readdirSync} from 'node:fs';
import {join} from 'node:path';

const RACINE='app/exercices';
const idx=JSON.parse(readFileSync(join(RACINE,'index.json'),'utf8'));
// Les DEUX formats, comme _lireIndexIllustrations dans l'app : un tableau plat
// de slugs (ancien), ou {format:2, fiches:{slug:[l,h]}}.
const table=Array.isArray(idx)
  ? new Map(idx.map(x=>[typeof x==='string'?x:(x&&(x.slug||x.s||x.nom)),null])
              .filter(e=>e[0]))
  : new Map(Object.entries((idx&&idx.fiches)||{}));
const slugs=[...table.keys()];

// Largeur et hauteur d'un .webp, lues dans l'en-tete. Les trois variantes du
// format portent leurs dimensions a des offsets differents.
function dimsWebp(p){
  const b=readFileSync(p);
  if(b.length<30||b.toString('latin1',0,4)!=='RIFF'
     ||b.toString('latin1',8,12)!=='WEBP') return null;
  const t=b.toString('latin1',12,16);
  if(t==='VP8X') return [b.readUIntLE(24,3)+1,b.readUIntLE(27,3)+1];
  if(t==='VP8L'){ const n=b.readUInt32LE(21);
    return [(n&0x3FFF)+1,((n>>>14)&0x3FFF)+1]; }
  if(t==='VP8 ') return [b.readUInt16LE(26)&0x3FFF,b.readUInt16LE(28)&0x3FFF];
  return null;
}

// 200 px : en dessous, un dessin au trait pose dans une modale de 480 px est
// illisible quoi qu'on fasse. C'est la largeur REELLE qui compte, pas le poids
// du fichier : une .webp de 250 px pese legitimement 3 Ko.
const LARGEUR_MINI=200;

let fiches=0,vignettes=0;
const sansFiche=[],sansVignette=[],illisibles=[],etroites=[],fausses=[];
for(const s of slugs){
  const f=join(RACINE,s+'.webp'), v=join(RACINE,'vignettes',s+'.webp');
  if(existsSync(f)){
    fiches++;
    const d=dimsWebp(f);
    if(!d) illisibles.push(s+' ('+statSync(f).size+' o)');
    else{
      if(d[0]<LARGEUR_MINI) etroites.push(s+' ('+d[0]+'x'+d[1]+')');
      const a=table.get(s);
      // Une dimension annoncee qui ne correspond pas au fichier est PIRE
      // qu'une dimension absente : l'app borne la fiche sur un chiffre faux.
      if(Array.isArray(a)&&(a[0]!==d[0]||a[1]!==d[1]))
        fausses.push(s+' : index '+a.join('x')+', fichier '+d.join('x'));
    }
  } else sansFiche.push(s);
  if(existsSync(v)) vignettes++; else sansVignette.push(s);
}
const surDisque=existsSync(RACINE)
  ? readdirSync(RACINE).filter(f=>f.endsWith('.webp')).length : 0;
const lot=(t,l,n)=>{ if(!l.length) return;
  console.log('\n'+t+' : '+l.length);
  for(const x of l.slice(0,n)) console.log('   '+x);
  if(l.length>n) console.log('   … et '+(l.length-n)+' autres'); };

console.log(`index : ${slugs.length} exercices illustres`
  +(Array.isArray(idx)?'   (ancien format, sans dimensions)':''));
console.log(`fiches  : ${fiches}/${slugs.length}   (fichiers .webp sur le disque : ${surDisque})`);
console.log(`vignettes : ${vignettes}/${slugs.length}`);
lot('FICHES MANQUANTES',sansFiche,20);
lot('FICHIERS ILLISIBLES',illisibles,20);
lot('DIMENSIONS FAUSSES DANS L’INDEX',fausses,20);
lot('TROP ETROITES POUR UNE FICHE (< '+LARGEUR_MINI+' px)',etroites,20);
// Les vignettes manquantes ne font PAS echouer : l'app retombe seule sur la
// fiche depuis le 14/09/2026, au prix d'une requete. C'est un manque a
// combler, pas une panne — et bloquer le deploiement la-dessus retirerait du
// site les 436 fiches pour reparer 436 miniatures.
lot('vignettes manquantes (repli automatique en place)',sansVignette,10);
const bloquant=sansFiche.length+illisibles.length+fausses.length;
if(!bloquant&&!etroites.length&&!sansVignette.length) console.log('\nTout est en place.');
else if(!bloquant) console.log('\nRien de bloquant.');
process.exit(bloquant?1:0);
