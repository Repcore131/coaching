#!/usr/bin/env node
// LA BOUTIQUE : LES SEANCES QUITTENT LA FICHE PUBLIQUE (01/10/2026). Une fois.
//
// boutique/<id> est lu par tout compte connecte ; il portait les seances, le
// contenu meme qu'on vend. Elles passent dans boutique_contenu/<id>, que les
// regles n'ouvrent qu'a l'acheteur (droits/<cle>/programmes/<id>) et au
// createur. Pour chaque fiche qui porte encore `seances` :
//   1. boutique_contenu/<id> = {seances, maj}   (le contenu D'ABORD)
//   2. boutique/<id>/seances = null, aContenu = true
// Dans cet ordre : interrompu entre les deux, rien n'est perdu.
//
// ⚠ AVANT : lancer cloudflare/scripts/remplir-droits.mjs --ecrire, qui pose
//   droits/<cle>/programmes/<id> pour les achats verifies chez PayPal. Sans
//   lui, un acheteur d'avant ne relirait plus le contenu de son programme
//   (celui deja applique a ses seances, lui, ne bouge pas).
//
//   SIMULATION (par defaut) : lit tout, n'ecrit rien, dit ce qui bougerait.
//     node scripts/migrer_boutique.mjs
//   POUR DE VRAI :
//     node scripts/migrer_boutique.mjs --ecrire
//
// FIREBASE_SERVICE_ACCOUNT : chemin du JSON du compte de service (jamais dans
// le depot). FIREBASE_DB_URL : celui de cloudflare/wrangler.toml par defaut.
import { readFileSync } from 'node:fs';
import { creerBase } from '../cloudflare/src/base.js';
import { lireCompteService, jetonCompteService } from '../cloudflare/src/google.js';

export function planMigrationBoutique(boutique, contenus, maintenant) {
  const t = maintenant || Date.now();
  const maj = {}, rapport = { fiches: 0, deplacees: 0, dejaFaites: 0, octets: 0 };
  for (const [id, f] of Object.entries(boutique || {})) {
    if (!f || typeof f !== 'object') continue;
    rapport.fiches++;
    if (typeof f.seances !== 'string' || !f.seances) continue;
    const c = (contenus || {})[id];
    // Un contenu deja la, et plus recent : on ne l'ecrase pas.
    if (!(c && typeof c.seances === 'string' && Number(c.maj) >= Number(f.maj || 0))) {
      maj['boutique_contenu/' + id] = { seances: f.seances, maj: Number(f.maj) || t };
    } else rapport.dejaFaites++;
    rapport.deplacees++;
    rapport.octets += f.seances.length;
  }
  // Deuxieme vague, a part : la fiche ne se vide qu'une fois le contenu ecrit.
  const vider = {};
  for (const [id, f] of Object.entries(boutique || {}))
    if (f && typeof f === 'object' && typeof f.seances === 'string' && f.seances) {
      vider['boutique/' + id + '/seances'] = null;
      vider['boutique/' + id + '/aContenu'] = true;
    }
  return { maj, vider, rapport };
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const toml = readFileSync(new URL('../cloudflare/wrangler.toml', import.meta.url), 'utf8');
  const url = process.env.FIREBASE_DB_URL || (toml.match(/^FIREBASE_DB_URL\s*=\s*"([^"]+)"/m) || [])[1];
  const chemin = process.env.FIREBASE_SERVICE_ACCOUNT;
  const compte = chemin ? lireCompteService(readFileSync(chemin, 'utf8')) : null;
  if (!compte) { console.error('FIREBASE_SERVICE_ACCOUNT : chemin du JSON du compte de service, requis.'); process.exit(1); }
  const db = creerBase({ url, jeton: () => jetonCompteService(compte) });
  const ecrire = process.argv.includes('--ecrire');
  const [boutique, contenus] = await Promise.all([db.ref('boutique').get(), db.ref('boutique_contenu').get()]).then((r) => r.map((x) => x.val()));
  const { maj, vider, rapport } = planMigrationBoutique(boutique, contenus);
  for (const k of Object.keys(maj)) console.log((ecrire ? 'écrit    ' : 'écrirait ') + k + ' (' + maj[k].seances.length + ' caractères)');
  for (const k of Object.keys(vider)) console.log((ecrire ? 'vidé     ' : 'viderait ') + k + ' = ' + JSON.stringify(vider[k]));
  console.log('\n' + rapport.fiches + ' fiches · ' + rapport.deplacees + ' à déplacer (' + rapport.octets + ' caractères) · '
    + rapport.dejaFaites + ' contenus déjà en place');
  if (ecrire) {
    if (Object.keys(maj).length) await db.ref().update(maj);
    if (Object.keys(vider).length) await db.ref().update(vider);
    console.log('\nÉcrit : les séances ne sont plus dans la fiche publique.');
  } else console.log('\nSimulation : rien n\'a été écrit. Relancer avec --ecrire pour appliquer.');
}
