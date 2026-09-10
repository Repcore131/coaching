#!/usr/bin/env node
// VERIFIE QUE CHAQUE FICHIER REFERENCE PAR L'APP EXISTE VRAIMENT.
//
// POURQUOI. Le 10/09/2026, l'app entiere a ete televersee A LA RACINE du depot
// au lieu de app/. Ses references, elles, restaient relatives a app/ : la page
// s'ouvrait, et tout ce qu'elle appelait — icones, polices, base Ciqual —
// repondait 404 sans un mot. Un fichier au mauvais endroit ne se voit pas a
// l'oeil ; il se voit ici.
//
// CE QUE CE SCRIPT NE COUVRE PAS : les chemins construits en JavaScript
// (concatenations, gabarits `${...}`). Ils sont ecartes faute de pouvoir les
// evaluer sans executer la page. Il ne remplace donc pas un essai reel.
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';

const cible=process.argv[2]||'app/index.html';
const base=dirname(resolve(cible));
const html=readFileSync(cible,'utf8');

// INACCESSIBLES PAR CONSTRUCTION, et c'est voulu : RC_APK_URL vaut '' tant
// qu'aucun APK n'est publie, et le bloc qui porte ces deux liens reste cache.
// Les inscrire ici plutot que de les ignorer en silence : le jour ou l'APK
// existe, cette liste rappelle quoi ajouter au depot.
const TOLERES=new Set(['/download/RepCore.apk','/aide-apk.html']);

const refs=new Set();
for(const m of html.matchAll(/\b(?:src|href)\s*=\s*"([^"]+)"/g)) refs.add(m[1]);
for(const m of html.matchAll(/\b(?:src|href)\s*=\s*'([^']+)'/g)) refs.add(m[1]);

const ignore=r=>!r
  || /^(?:https?:|data:|mailto:|tel:|blob:|javascript:|#)/i.test(r)
  || r.includes('${')            // gabarit JS, non evaluable ici
  || r.includes('"+')||r.includes("'+");  // concatenation

let manquants=[],verifies=0,tolere=0;
for(const r of refs){
  if(ignore(r)) continue;
  const propre=r.split('?')[0].split('#')[0];
  if(!propre) continue;
  if(TOLERES.has(propre)){ tolere++; continue; }
  // Un chemin absolu se resout depuis la RACINE DU SITE, pas depuis app/ :
  // c'est precisement la confusion qui a coute le deploiement du 10/09.
  const chemin=propre.startsWith('/')
    ? join(resolve(base,'..'),propre.slice(1))
    : resolve(base,propre);
  verifies++;
  if(!existsSync(chemin)) manquants.push(propre);
}
console.log(`references verifiees : ${verifies}   tolerees : ${tolere}`);
if(manquants.length){
  console.log(`MANQUANTS : ${manquants.length}`);
  for(const m of manquants.sort()) console.log('   '+m);
  process.exit(1);
}
console.log('0 manquant.');
