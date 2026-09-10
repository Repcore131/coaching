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
import {readFileSync} from 'node:fs';
const cible=process.argv[2]||'app/index.html';
const html=readFileSync(cible,'utf8');
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
console.log(`${blocs.length} bloc(s) en ligne, ${ko} en erreur.`);
process.exit(ko?1:0);
