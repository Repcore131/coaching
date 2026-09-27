// LE RATTRAPAGE DES ABONNÉS D'AVANT, une fois (voir src/migration.js).
//
//   À BLANC (par défaut) : lit tout, n'écrit rien, affiche ce qui serait écrit.
//     node cloudflare/scripts/remplir-paiements.mjs
//   POUR DE VRAI :
//     node cloudflare/scripts/remplir-paiements.mjs --ecrire
//
// Variables d'environnement (jamais dans le dépôt) :
//   FIREBASE_SERVICE_ACCOUNT   chemin du JSON du compte de service
//                              (C:\Users\kevin\RepCore-secrets\compte-service.json)
//   PAYPAL_CLIENT_SECRET       le secret de l'application PayPal
//   FIREBASE_DB_URL, PAYPAL_CLIENT_ID : ceux de wrangler.toml par défaut.
import { readFileSync } from 'node:fs';
import { creerBase } from '../src/base.js';
import { lireCompteService, jetonCompteService } from '../src/google.js';
import { planifierMigration } from '../src/migration.js';

const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
const val = (k) => process.env[k] || ((toml.match(new RegExp('^' + k + '\\s*=\\s*"([^"]+)"', 'm')) || [])[1]);
const chemin = process.env.FIREBASE_SERVICE_ACCOUNT;
const compte = chemin ? lireCompteService(readFileSync(chemin, 'utf8')) : null;
if (!compte) { console.error('FIREBASE_SERVICE_ACCOUNT : chemin du JSON du compte de service, requis.'); process.exit(1); }
if (!process.env.PAYPAL_CLIENT_SECRET) { console.error('PAYPAL_CLIENT_SECRET requis.'); process.exit(1); }
const env = { PAYPAL_CLIENT_ID: val('PAYPAL_CLIENT_ID'), PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET };
const db = creerBase({ url: val('FIREBASE_DB_URL'), jeton: () => jetonCompteService(compte) });
const ecrire = process.argv.includes('--ecrire');

const { maj, rapport } = await planifierMigration({ db, env, journal: (c) => process.stdout.write('.') });
console.log('\n');
for (const [k, v] of Object.entries(maj)) console.log((ecrire ? 'écrit   ' : 'écrirait ') + k + ' = ' + JSON.stringify(v));
console.log('\n' + rapport.comptes + ' comptes avec un paiement PayPal · ' + rapport.premiers + ' premiers paiements · '
  + rapport.droits + ' nœuds droits/ · ' + rapport.index + ' index · ' + rapport.programmes + ' programmes');
for (const r of rapport.refuses) console.log('  refusé : ' + r);
if (ecrire && Object.keys(maj).length) { await db.ref().update(maj); console.log('\nÉcrit.'); }
else if (!ecrire) console.log('\nÀ blanc : rien n\'a été écrit. Relancer avec --ecrire pour appliquer.');
