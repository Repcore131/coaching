#!/usr/bin/env node
// CHAQUE BLOC <script> EN LIGNE DOIT SE PARSER.
//
// POURQUOI. Le fichier fait quatre millions de caracteres dans un seul bloc :
// une parenthese oubliee n'empeche pas la page de s'ouvrir, elle empeche TOUT
// le JavaScript qui suit de s'executer. L'app s'affiche, et plus rien ne
// repond. new Function() parse sans executer : aucun effet de bord, aucun DOM
// requis.
//
// CE QUE CE SCRIPT NE COUVRE PAS : les erreurs a l'execution. Un fichier qui
// parse peut encore appeler une fonction qui n'existe pas.
//
// ⚠ DEPUIS LE BUILD 1417, LE GROS DU CODE N'EST PLUS EN LIGNE : il est servi
//   a part, dans app/rc-core.<build>.js. Ne verifier que les blocs en ligne
//   aurait laisse ce script annoncer « 0 en erreur » sur quatre petits blocs
//   pendant que les 5,5 Mo du produit ne parsaient plus. On parse donc AUSSI
//   ce que la page demande.
import {readFileSync, existsSync} from 'node:fs';
import {join, dirname} from 'node:path';
const cible=process.argv[2]||'app/index.html';
const html=readFileSync(cible,'utf8');
const externes=[];
for(const m of html.matchAll(/<script src="\.\/(rc-core\.\d+\.js)"><\/script>/g)){
  const p=join(dirname(cible),m[1]);
  if(!existsSync(p)){ console.log('actif demande et absent : '+p); process.exit(1); }
  externes.push([m[1],readFileSync(p,'utf8')]);
}
// LE TYPE COMPTE. <script type="application/ld+json"> porte du JSON — la page
// de vente en a un — et le passer a new Function() echoue sur le premier deux
// points. Seuls les types vides, text/javascript et module sont du script.
const blocs=[...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)]
  .filter(m=>{
    const t=/\btype\s*=\s*["']([^"']+)["']/i.exec(m[1]);
    return !t || /^(?:text\/javascript|module|application\/javascript)$/i.test(t[1].trim());
  })
  .map(m=>m[2]).filter(x=>x.trim());
let ko=0;
blocs.forEach((corps,i)=>{
  try{ new Function(corps); }
  catch(e){ ko++; console.log(`bloc ${i} (${corps.length} car.) : ${e.message}`); }
});
for(const [nom,corps] of externes){
  try{ new Function(corps); }
  catch(e){ ko++; console.log(`${nom} (${corps.length} car.) : ${e.message}`); }
}
console.log(`${blocs.length} bloc(s) en ligne, ${externes.length} actif(s) servi(s) a part, ${ko} en erreur.`);
process.exit(ko?1:0);
