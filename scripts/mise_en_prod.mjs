#!/usr/bin/env node
// LA MISE EN PRODUCTION, EN UNE LISTE (série 6, lot 10, 08/10/2026).
//
// Dit, étape par étape, ce qui est FAIT et ce qui reste À FAIRE avant de
// merger la PR : l'UID du créateur, les secrets GitHub, le Worker en ligne,
// la sauvegarde, le rattrapage des droits, la boutique migrée. Rien d'autre
// n'est lu, et RIEN N'EST ÉCRIT par défaut.
//
//   LIRE (par défaut) :
//     node scripts/mise_en_prod.mjs
//   AVEC UNE FAUSSE BASE (tests, répétition) :
//     node scripts/mise_en_prod.mjs --base=chemin/base.json
//   APPLIQUER LES MIGRATIONS (droits, puis boutique) :
//     node scripts/mise_en_prod.mjs --ecrire
//
// Variables (jamais dans le dépôt) : FIREBASE_SERVICE_ACCOUNT (chemin du
// JSON), PAYPAL_CLIENT_SECRET pour --ecrire ; SECRETS_PRESENTS (noms séparés
// par des virgules, posé par le workflow, jamais les valeurs) ;
// SAUVEGARDE_FAITE=1 quand le workflow vient de garder l'archive chiffrée.
// La sortie vaut 0 quand tout est FAIT, 2 sinon (1 : erreur).
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { planMigrationBoutique } from './migrer_boutique.mjs';

export const SECRETS_REQUIS = ['FIREBASE_SERVICE_ACCOUNT', 'SAUVEGARDE_CLE', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'];
export const UID_ABSENT = 'UID_CREATEUR_A_POSER';

// PURE. Les étapes, dans l'ordre où elles se font.
//   ctx = {uid, secrets:[noms], sante:{ok}|null, sauvegarde:bool,
//          base:{droitsServeur, boutique, boutique_contenu}|null}
export function etatMiseEnProd(ctx) {
  const c = ctx || {}, b = c.base || null, l = [];
  const pose = (cle, lib, fait, detail, geste) => l.push({ cle, lib, etat: fait === null ? 'INCONNU' : (fait ? 'FAIT' : 'A_FAIRE'), detail: detail || '', geste: fait ? '' : (geste || '') });
  const uid = String(c.uid || '');
  pose('uid', 'UID du créateur', !!uid && uid !== UID_ABSENT, uid && uid !== UID_ABSENT ? 'posé' : 'encore « ' + UID_ABSENT + ' »',
    'Copier l’UID de guellec.coachingpro@gmail.com (Firebase > Authentication) dans cloudflare/src/createur.js, puis node scripts/poser_uid_createur.mjs');
  const vus = Array.isArray(c.secrets) ? c.secrets : null;
  const manquent = vus ? SECRETS_REQUIS.filter((s) => vus.indexOf(s) < 0) : null;
  pose('secrets', 'Secrets GitHub', vus ? !manquent.length : null, vus ? (manquent.length ? 'manquent : ' + manquent.join(', ') : 'les ' + SECRETS_REQUIS.length + ' sont posés') : 'non vérifiable ici (lancer le workflow)',
    'Settings > Secrets and variables > Actions : ' + (manquent && manquent.length ? manquent.join(', ') : SECRETS_REQUIS.join(', ')));
  pose('sauvegarde', 'Sauvegarde avant migrations', c.sauvegarde === true ? true : null, c.sauvegarde === true ? 'archive chiffrée gardée par ce travail' : 'à faire par le workflow (artefact chiffré)',
    'Lancer « Préparer la mise en production » : il sauvegarde avant toute écriture');
  const ds = b && b.droitsServeur;
  pose('droits', 'Rattrapage des droits', b ? !!(ds && Number(ds.v) >= 2) : null, ds ? 'reglages_publics/droitsServeur v' + ds.v : 'reglages_publics/droitsServeur absent',
    'node cloudflare/scripts/remplir-droits.mjs (à blanc) puis --ecrire');
  let bt = null;
  if (b) { const p = planMigrationBoutique(b.boutique || {}, b.boutique_contenu || {}); bt = p.rapport; }
  pose('boutique', 'Boutique migrée', bt ? bt.deplacees === 0 : null, bt ? (bt.deplacees ? bt.deplacees + ' fiche(s) portent encore leurs séances' : bt.fiches + ' fiche(s), aucune séance publique') : '',
    'node scripts/migrer_boutique.mjs (simulation) puis --ecrire');
  pose('worker', 'Worker en ligne', c.sante ? c.sante.ok === true : null, c.sante ? (c.sante.ok ? '/sante répond, pouls frais' : '/sante : ' + (c.sante.raison || 'en panne')) : '/sante injoignable d’ici',
    'Déployer le Worker (workflow avec ecrire=oui, ou cd cloudflare && npx wrangler@4 deploy)');
  return l;
}
// PURE. Le texte affiché (et posé dans le résumé du workflow).
export function texteMiseEnProd(l) {
  const sym = { FAIT: 'FAIT    ', A_FAIRE: 'À FAIRE ', INCONNU: '?       ' };
  const lignes = l.map((e) => sym[e.etat] + e.lib + (e.detail ? ' — ' + e.detail : '') + (e.geste ? '\n         → ' + e.geste : ''));
  const reste = l.filter((e) => e.etat !== 'FAIT').length;
  return lignes.join('\n') + '\n\n' + (reste ? reste + ' étape(s) restent avant de merger.' : 'Tout est fait : la PR peut être mergée.');
}
export function uidDuDepot(src) {
  return ((String(src || '').match(/export const CREATEUR_UID\s*=\s*'([^']*)'/) || [])[1]) || '';
}

async function lireBaseReelle() {
  const { creerBase } = await import('../cloudflare/src/base.js');
  const { lireCompteService, jetonCompteService } = await import('../cloudflare/src/google.js');
  const toml = readFileSync(new URL('../cloudflare/wrangler.toml', import.meta.url), 'utf8');
  const url = process.env.FIREBASE_DB_URL || (toml.match(/^FIREBASE_DB_URL\s*=\s*"([^"]+)"/m) || [])[1];
  const chemin = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!chemin) return null;
  const compte = lireCompteService(readFileSync(chemin, 'utf8'));
  const db = creerBase({ url, jeton: () => jetonCompteService(compte) });
  const [droitsServeur, boutique, boutique_contenu] = await Promise.all(['reglages_publics/droitsServeur', 'boutique', 'boutique_contenu'].map((k) => db.ref(k).get().then((s) => s.val())));
  return { droitsServeur, boutique, boutique_contenu };
}
async function sante() {
  try {
    const r = await fetch('https://repcore-serveur.repcore.workers.dev/sante', { signal: AbortSignal.timeout(8000) });
    return await r.json();
  } catch (e) { return null; }
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const arg = (k) => (process.argv.find((a) => a.startsWith('--' + k + '=')) || '').slice(k.length + 3);
  const ecrire = process.argv.includes('--ecrire');
  try {
    const fausse = arg('base');
    const base = fausse ? JSON.parse(readFileSync(fausse, 'utf8')) : await lireBaseReelle();
    if (ecrire) {
      if (fausse) { console.error('--ecrire refuse une fausse base.'); process.exit(1); }
      for (const cmd of [['cloudflare/scripts/remplir-droits.mjs', '--ecrire'], ['scripts/migrer_boutique.mjs', '--ecrire']]) {
        console.log('\n▶ node ' + cmd.join(' '));
        const r = spawnSync(process.execPath, cmd, { stdio: 'inherit' });
        if (r.status !== 0) { console.error('Arrêt : ' + cmd[0] + ' a échoué.'); process.exit(1); }
      }
    }
    const l = etatMiseEnProd({
      uid: uidDuDepot(readFileSync(new URL('../cloudflare/src/createur.js', import.meta.url), 'utf8')),
      secrets: process.env.SECRETS_PRESENTS != null ? process.env.SECRETS_PRESENTS.split(',').map((s) => s.trim()).filter(Boolean) : null,
      sauvegarde: process.env.SAUVEGARDE_FAITE === '1',
      sante: fausse ? (base && base._sante) || null : await sante(),
      base: ecrire ? await lireBaseReelle() : base,
    });
    console.log(texteMiseEnProd(l));
    process.exit(l.every((e) => e.etat === 'FAIT') ? 0 : 2);
  } catch (e) {
    console.error('Erreur : ' + (e && e.message || e));
    process.exit(1);
  }
}
