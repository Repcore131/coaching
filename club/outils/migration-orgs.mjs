/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
// ══ FIT PULSE — migration de /pulse vers /orgs/{org} (multi-salles) ═════════
//
// Copie la base historique dans l'espace d'une société, sans rien effacer :
//   /pulse/clubs        → /orgs/{org}/clubs
//   /pulse/…            → /orgs/{org}/data/…
//   /pulse_boot/{clé}   → /orgs_boot/{clé} = { org, uid } (les pointeurs « code seul » restent)
//   /pulse_product, /pulse_push, /pulse_inbox → /orgs_product, /orgs_push, /orgs_inbox /{org}
// puis VÉRIFIE, avec le code de l'appli, que les totaux du mois de contrôle sont
// exactement les mêmes avant et après (chaque KPI, chaque club, chaque commercial,
// impayés récupérés, ventes boutique). Écart : rien n'est écrit, sortie en erreur.
//
//   node club/outils/migration-orgs.mjs --org fitnessparkniort --nom "FPN Gestion" --mois 2026-09            (essai : rapport seul)
//   node club/outils/migration-orgs.mjs --org fitnessparkniort --nom "FPN Gestion" --mois 2026-09 --ecrire   (écrit, relit, revérifie)
//   --source sauvegarde.json : part d'un export de la base au lieu de la base en ligne.
// Accès : FIREBASE_SERVICE_ACCOUNT (ou le simulateur si FIREBASE_DATABASE_EMULATOR_HOST est défini).
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { chargerAppli } from './fitpulse-rapport.mjs';

const HEX40 = /^[0-9a-f]{40}$/;
export function migrer(src, org, { nom = org, now = Date.now() } = {}) {
  const pulse = JSON.parse(JSON.stringify(src.pulse || {})); const users = pulse.users || {}; // copie : la source n'est jamais modifiée
  const { clubs = {}, ...data } = pulse;
  const up = {
    [`orgs/${org}/info`]: { nom, createdBy: 'migration', creeLe: now, statut: 'actif', abonnement: { offre: 'fondateur' }, securite: { mfa: true }, region: 'europe-west1', migreLe: now },
    [`orgs/${org}/clubs`]: clubs,
    [`orgs/${org}/data`]: data,
  };
  let cles = 0, pointeurs = 0;
  for (const [k, v] of Object.entries(src.pulse_boot || {})) {
    if (typeof v !== 'string') continue;
    if (HEX40.test(v)) { up[`orgs_boot/${k}`] = v; pointeurs++; }
    else { const u = users[v]; up[`orgs_boot/${k}`] = { org, uid: v, ...(u && u.role !== 'membre' ? { privilegie: true } : {}) }; cles++; }
  }
  if (src.pulse_product) up[`orgs_product/${org}`] = src.pulse_product;
  if (src.pulse_push) up[`orgs_push/${org}`] = src.pulse_push;
  if (src.pulse_inbox) up[`orgs_inbox/${org}`] = src.pulse_inbox;
  return { up, rapport: { org, clubs: Object.keys(clubs).length, utilisateurs: Object.keys(users).length, saisies: Object.keys(data.entries || {}).length, cles, pointeurs } };
}
// Arbre lu par l'appli après migration : les données de la société, ses clubs remis à leur place.
export function vueOrg(up, org) { return { ...(up[`orgs/${org}/data`] || {}), clubs: up[`orgs/${org}/clubs`] || {} }; }
// Totaux d'un mois, calculés par le code de l'appli.
export function totaux(S, mois) {
  const run = chargerAppli(JSON.parse(JSON.stringify(S || {})));
  return JSON.parse(run(`JSON.stringify((() => { const mk = ${JSON.stringify(mois)}; const r = { from: mk + '-01', to: mk + '-' + pad(daysIn(mk)) }; const out = {};
    for (const c of Object.keys(S.clubs || {})) { const o = out[c] = { kpi: {}, membres: {} };
      for (const k of Object.keys(S.kpis || {})) { o.kpi[k] = sumRange(c, null, k, r.from, r.to); for (const u of Object.values(S.users || {})) { const v = sumRange(c, u.id, k, r.from, r.to); if (v) o.membres[u.id + '|' + k] = v; } }
      o.recupere = recoveredFor(c, r); o.recupereEquipe = recoveredFor(c, r, 'equipe'); o.boutique = Math.round(caMonth(c, mk) * 100) / 100; }
    return out; })())`));
}
export function ecarts(a, b, chemin = '') {
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return Object.is(a, b) || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9) ? [] : [`${chemin} : ${a} → ${b}`];
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => ecarts(a[k], b[k], chemin ? chemin + '.' + k : k));
}

// ── Ligne de commande ─────────────────────────────────────────────────────
// Lus à chaque appel (le simulateur et son espace de noms peuvent être réglés après le chargement du module).
const EMU = () => process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const base = () => EMU() ? `http://${EMU()}` : (process.env.FIREBASE_DB_URL || 'https://repcore-sync-default-rtdb.firebaseio.com').replace(/\/$/, '');
const ns = () => EMU() ? `?ns=${process.env.FIREBASE_NS || 'fitpulse-test'}` : '';
async function jeton() {
  if (EMU()) return 'owner';
  const c = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}'); if (!c.client_email) throw new Error('FIREBASE_SERVICE_ACCOUNT absent');
  const b = s => Buffer.from(s).toString('base64url'); const iat = Math.floor(Date.now() / 1000);
  const t = b(JSON.stringify({ alg: 'RS256', typ: 'JWT' })), p = b(JSON.stringify({ iss: c.client_email, scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 }));
  const sig = crypto.createSign('RSA-SHA256').update(`${t}.${p}`).sign(c.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${t}.${p}.${sig}` });
  return (await r.json()).access_token;
}
const lire = async (tk, chemin) => { const r = await fetch(`${base()}/${chemin}.json${ns()}`, { headers: { authorization: `Bearer ${tk}` } }); if (!r.ok) throw new Error(`lecture ${chemin} : ${r.status}`); return r.json(); };
async function ecrire(tk, up) {
  // Chaque chemin est écrit entier (PUT) : un nœud volumineux part seul.
  for (const [k, v] of Object.entries(up)) { const r = await fetch(`${base()}/${k}.json${ns()}`, { method: 'PUT', headers: { authorization: `Bearer ${tk}`, 'content-type': 'application/json' }, body: JSON.stringify(v) }); if (!r.ok) throw new Error(`écriture ${k} : ${r.status} ${await r.text()}`); }
}
export async function main(argv = process.argv.slice(2)) {
  const opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
  const org = opt('org') || 'fitnessparkniort'; const nom = opt('nom') || 'FPN Gestion'; const mois = opt('mois') || '2026-09'; const ecrit = argv.includes('--ecrire');
  if (!/^[a-z0-9-]{3,40}$/.test(org)) throw new Error('identifiant de société invalide (a-z, 0-9, tiret)');
  const tk = await jeton();
  const src = opt('source') ? JSON.parse(readFileSync(opt('source'), 'utf8')) : { pulse: await lire(tk, 'pulse'), pulse_boot: await lire(tk, 'pulse_boot'), pulse_product: await lire(tk, 'pulse_product'), pulse_push: await lire(tk, 'pulse_push'), pulse_inbox: await lire(tk, 'pulse_inbox') };
  if (!src.pulse || !Object.keys(src.pulse).length) throw new Error('base source vide : rien à migrer');
  const { up, rapport } = migrer(src, org, { nom });
  const avant = totaux(src.pulse, mois), apres = totaux(vueOrg(up, org), mois); const diff = ecarts(avant, apres);
  console.log('Migration', JSON.stringify(rapport)); console.log(`Totaux de ${mois} : ${diff.length ? diff.length + ' écart(s)' : 'identiques'}`);
  if (diff.length) { diff.slice(0, 20).forEach(d => console.log('  ' + d)); throw new Error('totaux différents : rien n’est écrit'); }
  if (!ecrit) { console.log('Essai : rien n’est écrit (ajoutez --ecrire).'); return { rapport, avant, apres }; }
  if (await lire(tk, `orgs/${org}/info`)) throw new Error(`l’espace ${org} existe déjà : rien n’est écrit`);
  await ecrire(tk, up);
  // Relecture depuis la base et nouvelle vérification.
  const relu = { ...(await lire(tk, `orgs/${org}/data`)), clubs: await lire(tk, `orgs/${org}/clubs`) };
  const diff2 = ecarts(avant, totaux(relu, mois));
  if (diff2.length) throw new Error(`relecture : ${diff2.length} écart(s), par exemple ${diff2[0]}`);
  console.log(`Écrit et relu : totaux de ${mois} identiques. /pulse n’est pas modifié.`);
  return { rapport, avant, apres };
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch(e => { console.error('ÉCHEC :', e.message); process.exit(1); });
