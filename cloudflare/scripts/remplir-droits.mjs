// LE RATTRAPAGE DES DROITS, AVANT LA BASCULE (30/09/2026). Une fois.
//
// Remplit, avec le compte de service :
//   · droits/ pour les abonnés PayPal ACTIVE, relus chez PayPal
//     (planifierMigration, le même que remplir-paiements.mjs) ;
//   · droits/ 'suivi' pour les athlètes suivis dont le code existe ;
//   · coachs_registre/ pour les coachs réels ;
//   · les essais ouverts par l'app (users/<clé>/essai), bornés à 60 jours ;
// puis pose reglages_publics/droitsServeur {le, v:2}. À partir de là, l'app ne
// lit plus le palier que dans droits/, et le rôle et le plan d'un coach que
// dans coachs_registre/ (voir droitsV2Actif dans l'app).
//
//   À BLANC (par défaut) : lit tout, n'écrit rien, affiche ce qui serait écrit.
//     node cloudflare/scripts/remplir-droits.mjs
//   POUR DE VRAI :
//     node cloudflare/scripts/remplir-droits.mjs --ecrire
//   Tous les dossiers role:'coach', même sans athlète ni code émis :
//     … --tous-coachs
//
// Variables d'environnement (jamais dans le dépôt) : les mêmes que
// remplir-paiements.mjs — FIREBASE_SERVICE_ACCOUNT (chemin du JSON),
// PAYPAL_CLIENT_SECRET ; FIREBASE_DB_URL et PAYPAL_CLIENT_ID viennent de
// wrangler.toml.
import { readFileSync } from 'node:fs';
import { creerBase } from '../src/base.js';
import { lireCompteService, jetonCompteService } from '../src/google.js';
import { planifierMigration, planifierDroitsCoachs } from '../src/migration.js';

const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
const val = (k) => process.env[k] || ((toml.match(new RegExp('^' + k + '\\s*=\\s*"([^"]+)"', 'm')) || [])[1]);
const chemin = process.env.FIREBASE_SERVICE_ACCOUNT;
const compte = chemin ? lireCompteService(readFileSync(chemin, 'utf8')) : null;
if (!compte) { console.error('FIREBASE_SERVICE_ACCOUNT : chemin du JSON du compte de service, requis.'); process.exit(1); }
if (!process.env.PAYPAL_CLIENT_SECRET) { console.error('PAYPAL_CLIENT_SECRET requis.'); process.exit(1); }
const env = { PAYPAL_CLIENT_ID: val('PAYPAL_CLIENT_ID'), PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET };
const db = creerBase({ url: val('FIREBASE_DB_URL'), jeton: () => jetonCompteService(compte) });
const ecrire = process.argv.includes('--ecrire');
const tousCoachs = process.argv.includes('--tous-coachs');
const point = () => process.stdout.write('.');

const A = await planifierMigration({ db, env, journal: point });
// Les droits/ que l'étape PayPal va poser comptent déjà pour l'étape suivante.
const droitsDeja = {};
for (const [k, v] of Object.entries(A.maj)) if (k.startsWith('droits/')) droitsDeja[k.slice(7)] = v;
const B = await planifierDroitsCoachs({ db, env, journal: point, tousCoachs, droitsDeja });
const maj = Object.assign({}, A.maj, B.maj);
console.log('\n');
for (const [k, v] of Object.entries(maj)) console.log((ecrire ? 'écrit   ' : 'écrirait ') + k + ' = ' + JSON.stringify(v));
console.log('\nPayPal : ' + A.rapport.comptes + ' comptes · ' + A.rapport.droits + ' nœuds droits/ · ' + A.rapport.programmes + ' programmes');
console.log('Coachs : ' + B.rapport.coachs + ' au registre (' + B.rapport.coachsPayants + ' payants) · ' + B.rapport.coachsEcartes.length + ' écartés (ni athlète ni code)');
console.log('Suivis : ' + B.rapport.suivis + ' athlètes · ' + B.rapport.suivisSansCode.length + ' sans code consommé retrouvé');
console.log('Essais : ' + B.rapport.essais + ' reportés dans droits/');
for (const r of A.rapport.refuses.concat(B.rapport.refuses)) console.log('  refusé : ' + r);
for (const c of B.rapport.coachsEcartes) console.log('  coach écarté : ' + c + ' (relancer avec --tous-coachs pour l’inclure)');
for (const c of B.rapport.suivisSansCode) console.log('  suivi sans code : ' + c + ' (à ouvrir à la main dans l’écran Accès si c’est légitime)');
if (ecrire) {
  // LA BASCULE EN DERNIER : v = 2 ne se pose qu'une fois tout le reste écrit.
  await db.ref().update(maj);
  await db.ref().update({ 'reglages_publics/droitsServeur': { le: Date.now(), v: 2 } });
  console.log('\nÉcrit, et la bascule est activée (reglages_publics/droitsServeur/v = 2).');
} else console.log('\nÀ blanc : rien n\'a été écrit. Relancer avec --ecrire pour appliquer.');
