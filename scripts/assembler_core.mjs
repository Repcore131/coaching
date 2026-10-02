#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════
//  ASSEMBLER rc-core A PARTIR DE src/core/ (01/10/2026)
// ══════════════════════════════════════════════════════════════════════════
//
// src/core/NNN-*.js est la SOURCE ; app/rc-core.<build>.js en est le produit,
// committe lui aussi pendant la transition (voir src/core/LISEZMOI.md). Ce
// script recolle les morceaux dans l'ordre de leur numero : chacun perd son
// saut de ligne final, ils sont joints par un saut de ligne, et un saut de
// ligne termine le tout. C'est l'inverse exact de scripts/decouper_core.mjs.
//
// LE FICHIER ECRIT : le seul app/rc-core.*.js present (versionner_actifs.py
// le renomme ensuite au nouveau build) ; s'il n'y en a aucun, celui du
// window.RC_BUILD d'app/index.html.
//
// Usage :
//   node scripts/assembler_core.mjs             ecrit rc-core (rien si identique)
//   node scripts/assembler_core.mjs --verifier  n'ecrit rien ; sort en 1 si rc-core
//                                               differe de l'assemblage
//   node scripts/assembler_core.mjs --forcer    ecrit meme si rc-core a ete modifie a la main
//
// ⚠ RC-CORE MODIFIE A LA MAIN. Si rc-core differe de l'assemblage ET qu'il est
//   plus recent que tous les morceaux, quelqu'un l'a edite directement :
//   l'ecraser perdrait ce travail. Le script refuse alors (sortie 1) et dit
//   quoi faire : reporter la modification dans src/core/ (ou relancer
//   `node scripts/decouper_core.mjs --forcer`), ou --forcer pour l'abandonner.
import {readFileSync, writeFileSync, readdirSync, existsSync, statSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const APP = join(RACINE, 'app');
export const SRC = join(RACINE, 'src', 'core');

export function morceaux() {
  if (!existsSync(SRC)) return [];
  return readdirSync(SRC).filter((f) => /^\d{3}-[^/]*\.js$/.test(f)).sort();
}

export function assembler() {
  const m = morceaux();
  if (!m.length) throw new Error('aucun morceau dans src/core/');
  return m.map((f) => {
    const t = readFileSync(join(SRC, f), 'utf8');
    return t.endsWith('\n') ? t.slice(0, -1) : t;
  }).join('\n') + '\n';
}

export function fichierCore() {
  const l = readdirSync(APP).filter((f) => /^rc-core\.\d+\.js$/.test(f));
  if (l.length > 1) throw new Error('plusieurs app/rc-core.*.js : ' + l.join(', '));
  if (l.length) return join(APP, l[0]);
  const b = /window\.RC_BUILD\s*=\s*'(\d+)'/.exec(readFileSync(join(APP, 'index.html'), 'utf8'));
  if (!b) throw new Error('ni rc-core.*.js ni window.RC_BUILD dans app/index.html');
  return join(APP, 'rc-core.' + b[1] + '.js');
}

const direct = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (direct) {
  const verifier = process.argv.includes('--verifier');
  const forcer = process.argv.includes('--forcer');
  let sortie, cible;
  try { sortie = assembler(); cible = fichierCore(); } catch (e) { console.error(e.message); process.exit(1); }
  const nom = cible.replace(RACINE + '/', '');
  const actuel = existsSync(cible) ? readFileSync(cible, 'utf8') : null;
  const n = morceaux().length;
  if (actuel === sortie) {
    console.log(nom + ' = assemblage de ' + n + ' morceaux de src/core/, octet pour octet.');
    process.exit(0);
  }
  if (verifier) {
    // La premiere ligne qui differe : de quoi retrouver le morceau en cause.
    const a = (actuel || '').split('\n'), b = sortie.split('\n');
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    console.error('ECHEC : ' + nom + ' differe de l\'assemblage de src/core/ (premiere difference ligne ' + (i + 1) + ').\n'
      + '  Modifier src/core/ puis lancer `node scripts/assembler_core.mjs`, et committer les deux.');
    process.exit(1);
  }
  if (actuel != null && !forcer) {
    const tCore = statSync(cible).mtimeMs;
    const tSrc = Math.max(...morceaux().map((f) => statSync(join(SRC, f)).mtimeMs));
    if (tCore > tSrc) {
      console.error('REFUS : ' + nom + ' a ete modifie apres src/core/ et differe de l\'assemblage.\n'
        + '  Reporter la modification dans src/core/ (ou `node scripts/decouper_core.mjs --forcer` pour recouper\n'
        + '  depuis rc-core), ou relancer avec --forcer pour l\'ecraser.');
      process.exit(1);
    }
  }
  writeFileSync(cible, sortie);
  console.log(nom + ' reecrit depuis ' + n + ' morceaux de src/core/.');
}
