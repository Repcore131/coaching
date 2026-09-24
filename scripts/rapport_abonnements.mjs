// ══════════════════════════════════════════════════════════════════════════
//  QUI PAIE, QUI NE PAIE PLUS, QUI EST EN RETARD — LU ABONNEMENT PAR ABONNEMENT
// ══════════════════════════════════════════════════════════════════════════
//
//  POURQUOI CELUI-CI EXISTE A COTE DE rapport_payeur.mjs. Le rapport payeur lit
//  les ENCAISSEMENTS (API Transaction Search) et deduit : pas de transaction ce
//  mois-ci = quelque chose a change. PayPal refuse cette API sur ce compte
//  (403, NOT_AUTHORIZED, debug_id 762baf05de566 le 24/09/2026) : la case
//  « Transaction search » est cochee et enregistree, mais la permission
//  reporting/search/read n'est pas delivree.
//
//  Celui-ci lit les ABONNEMENTS, un par un, avec la permission `subscriptions`
//  — que le jeton porte deja, verifie le meme jour. Et il repond mieux : au
//  lieu de deduire d'une absence, PayPal dit lui-meme l'etat de chaque
//  abonnement, la date et le montant du dernier prelevement, la prochaine
//  echeance, et le nombre d'echecs.
//
//  ⚠ CE QU'IL CROISE, ET C'EST TOUT L'INTERET : l'etat chez PayPal ET l'acces
//    ouvert dans l'application. Les deux ne se parlent pas — il n'y a pas de
//    serveur pour ca. Le rapport dit donc, ligne par ligne, quel bouton de
//    l'ecran « Acces » presser.
//
//  ── CE QU'IL LUI FAUT ──────────────────────────────────────────────────
//  1. Le secret PayPal, demande a l'ecran (jamais un argument, jamais un
//     fichier, jamais l'historique du shell).
//  2. La base, pour connaitre les identifiants d'abonnement. Par defaut il
//     appelle `firebase database:get`, qui utilise la session deja ouverte sur
//     ce poste. On peut aussi lui passer un export JSON.
//
//       node scripts/rapport_abonnements.mjs
//       node scripts/rapport_abonnements.mjs export.json
//       node scripts/rapport_abonnements.mjs --essai      (donnees inventees)
//
//  ⚠ LE RAPPORT NE RENTRE PAS DANS LE DEPOT. Il porte des noms, des adresses
//    et des montants, et ce depot est publie tel quel : `rapport-abonnements.md`
//    est dans .gitignore, comme le rapport payeur.
//
//  ⚠ ET IL NE LIT DE LA BASE QUE CE QU'IL LUI FAUT : l'adresse, le nom, le
//    statut, l'identifiant d'abonnement. Rien de ce qui touche a la sante ne
//    sort de la fonction qui extrait, ni n'atteint le disque.
// ══════════════════════════════════════════════════════════════════════════

import { writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const ARGS = process.argv.slice(2);
const ESSAI = ARGS.includes('--essai');
const FICHIER = ARGS.find(a => !a.startsWith('--')) || '';
const API = 'https://api-m.paypal.com';
const PROJET = 'repcore-sync';
const SORTIE = 'rapport-abonnements.md';

// ── L'IDENTIFIANT CLIENT, LU DANS L'APPLICATION ─────────────────────────
const DOSSIER = fileURLToPath(new URL('../app/', import.meta.url));
const fichierCore = readdirSync(DOSSIER)
  .filter(f => /^rc-core\.\d+\.js$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
  .pop();
const src = readFileSync(DOSSIER + fichierCore, 'utf8');
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID
  || (src.match(/const PAYPAL_CLIENT_ID='([^']+)'/) || [])[1] || '';

// ══ LA BASE ═══════════════════════════════════════════════════════════════
//
// ⚠ ON NE GARDE QUE QUATRE CHAMPS PAR DOSSIER. Le reste — seances, mesures,
//   bilans, sante — traverse la memoire de ce processus et n'en sort jamais.
function extraire(users, droits) {
  const out = [];
  for (const cle of Object.keys(users || {})) {
    const u = users[cle] || {};
    if (u.role === 'coach') continue;
    const d = (droits || {})[cle] || null;
    out.push({
      email: String(u.email || cle.replace(/,/g, '.')),
      nom: ((u.fname || '') + ' ' + (u.lname || '')).trim(),
      statut: String(u.status || 'FREE'),
      paiement: String(u.paymentStatus || ''),
      abo: String(u.paypalSubscriptionId || ''),
      coach: String(u.coachName || ''),
      // L'ACCES TEL QUE L'APPLICATION LE VOIT : le noeud droits/ prime quand il
      // porte quelque chose, sinon c'est le dossier qui decide.
      pose: d ? { palier: String(d.palier || 'aucun'), echeance: Number(d.echeance) || 0 } : null,
      finDossier: Number(u.accessExpiry) || 0,
    });
  }
  return out;
}

// ⚠ « firebase » N'EST PAS TOUJOURS DANS LE PATH QUE NODE HERITE. Constate le
//   24/09/2026 : la commande marche dans un terminal, et le meme appel depuis
//   Node rend « 'firebase' n'est pas reconnu en tant que commande interne ».
//   Le PATH d'une session PowerShell ouverte avant l'installation de npm n'a
//   jamais ete rafraichi, et Node herite celui-la.
//
//   ON CHERCHE DONC LE FICHIER, dans cet ordre : ce que FIREBASE_BIN designe,
//   l'emplacement standard de npm sous Windows, puis le nom nu — qui marchera
//   sur un poste ou le PATH est juste.
//
//   ⚠ ET APPDATA NE SUFFIT PAS NON PLUS. Deuxieme essai, meme poste : le
//     dossier %APPDATA%\npm existe pour un processus et pas pour l'autre —
//     l'application qui heberge ce terminal virtualise une partie de AppData.
//     On ratisse donc : ce que FIREBASE_BIN designe, chaque dossier du PATH
//     avec les extensions que Windows execute, puis les emplacements habituels
//     de npm calcules depuis le dossier personnel.
function chercherFirebase() {
  const essais = [];
  if (process.env.FIREBASE_BIN) essais.push(process.env.FIREBASE_BIN);
  const sep = process.platform === 'win32' ? ';' : ':';
  const exts = process.platform === 'win32' ? ['.cmd', '.exe', '.bat', ''] : [''];
  for (const d of String(process.env.PATH || '').split(sep)) {
    if (!d) continue;
    for (const x of exts) essais.push(path.join(d.replace(/^"|"$/g, ''), 'firebase' + x));
  }
  for (const m of [os.homedir(), process.env.USERPROFILE, process.env.HOME].filter(Boolean)) {
    essais.push(path.join(m, 'AppData', 'Roaming', 'npm', 'firebase.cmd'));
    essais.push(path.join(m, 'AppData', 'Roaming', 'npm', 'firebase'));
  }
  if (process.env.APPDATA) essais.push(path.join(process.env.APPDATA, 'npm', 'firebase.cmd'));
  essais.push('/usr/local/bin/firebase', '/usr/bin/firebase');
  ESSAYES = essais;
  for (const e of essais) { try { if (existsSync(e)) return e; } catch (x) {} }
  return '';
}
let ESSAYES = [];
const FIREBASE = chercherFirebase();

function lireFirebase(chemin) {
  return new Promise((res, rej) => {
    if (!FIREBASE) {
      const ou = ESSAYES.filter(x => /firebase\.cmd$|firebase$/.test(x)).slice(0, 4);
      return rej(new Error('la commande `firebase` est introuvable depuis ce processus.'
        + '\n  Cherchee dans le PATH et dans ' + ou.length + ' emplacements habituels, dont :'
        + '\n    ' + ou.join('\n    ')
        + '\n  Deux sorties, au choix :'
        + '\n    $env:FIREBASE_BIN = (Get-Command firebase).Source'
        + '\n    node scripts/rapport_abonnements.mjs export.json'));
    }
    // UN .cmd NE S'EXECUTE PAS DIRECTEMENT : on passe par cmd.exe, et SANS
    // `shell: true` — Node 24 deprecie les arguments non echappes dans un shell,
    // et l'avertissement au milieu d'un rapport fait croire a une erreur.
    const cmd = /\.cmd$/i.test(FIREBASE);
    const prog = cmd ? (process.env.ComSpec || 'cmd.exe') : FIREBASE;
    const args = ['database:get', chemin, '--project', PROJET];
    execFile(prog, cmd ? ['/c', FIREBASE, ...args] : args,
      { maxBuffer: 512 * 1024 * 1024 },
      (e, out, err) => {
        if (e) return rej(new Error('firebase database:get ' + chemin + ' a echoue : '
          + String(err || e.message).split('\n')[0]
          + '\n  Commande essayee : ' + FIREBASE
          + '\n  Si elle marche dans ton terminal mais pas ici, donne son chemin :'
          + '\n      $env:FIREBASE_BIN = "$env:APPDATA\\npm\\firebase.cmd"'
          + '\n  Ou passe un export JSON de la base en argument :'
          + '\n      node scripts/rapport_abonnements.mjs export.json'));
        try { res(JSON.parse(out || 'null')); }
        catch (x) { rej(new Error('reponse illisible pour ' + chemin)); }
      });
  });
}

// ══ PAYPAL ════════════════════════════════════════════════════════════════
function demanderSecret() {
  if (!process.stdin.isTTY) {
    throw new Error('aucun terminal pour saisir le secret : donne-le par '
      + 'PAYPAL_CLIENT_SECRET.');
  }
  return new Promise(res => {
    process.stdout.write('\n  Colle le secret de l\'application PayPal, puis Entree'
      + '\n  (il n\'est ni enregistre ni affiche ailleurs) : ');
    let t = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', d => {
      t += d;
      const i = t.indexOf('\n');
      if (i >= 0) { process.stdin.pause(); console.log(''); res(t.slice(0, i).trim()); }
    });
    process.stdin.resume();
  });
}

async function jeton(secret) {
  const r = await fetch(API + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(CLIENT_ID + ':' + secret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    throw new Error('PayPal refuse les identifiants (' + r.status + ') : '
      + (j.error_description || j.error || 'reponse inattendue'));
  }
  return j.access_token;
}

// UN ABONNEMENT, TEL QUE PAYPAL LE VOIT. Rend toujours un objet : un identifiant
// inconnu (404) est une reponse en soi, et elle vaut d'etre dite.
async function abonnement(tok, id) {
  const r = await fetch(API + '/v1/billing/subscriptions/' + encodeURIComponent(id),
    { headers: { Authorization: 'Bearer ' + tok } });
  if (r.status === 404) return { introuvable: true };
  const j = await r.json().catch(() => ({}));
  if (r.status === 403) {
    throw new Error('PayPal refuse la lecture des abonnements (403) : '
      + [j.name, j.message, j.debug_id && ('debug_id ' + j.debug_id)].filter(Boolean).join(' / ')
      + '\n  La permission « Subscriptions » n\'est pas accordee a l\'application.');
  }
  if (!r.ok) return { erreur: 'HTTP ' + r.status + ' ' + (j.message || '') };
  const b = j.billing_info || {};
  return {
    etat: String(j.status || '?'),
    depuis: String(j.status_update_time || j.start_time || '').slice(0, 10),
    plan: String(j.plan_id || ''),
    payeur: String((j.subscriber || {}).email_address || ''),
    dernier: b.last_payment ? {
      montant: Number((b.last_payment.amount || {}).value || 0),
      devise: String((b.last_payment.amount || {}).currency_code || 'EUR'),
      le: String(b.last_payment.time || '').slice(0, 10),
    } : null,
    prochain: String(b.next_billing_time || '').slice(0, 10),
    echecs: Number(b.failed_payments_count) || 0,
    du: Number(((b.outstanding_balance) || {}).value) || 0,
  };
}

// ══ CE QUE CA DONNE ═══════════════════════════════════════════════════════
const eur = n => (Math.round(Number(n) * 100) / 100).toFixed(2).replace('.', ',') + ' EUR';
const jour = s => (s ? s.split('-').reverse().join('/') : '');

// PURE. L'acces ouvert dans l'application, en un mot.
function accesOuvert(p) {
  if (p.pose) {
    if (p.pose.palier === 'aucun') return false;
    if (p.pose.echeance > 0 && Date.now() >= p.pose.echeance) return false;
    return true;
  }
  if (p.finDossier > 0 && Date.now() >= p.finDossier) return false;
  if (p.statut === 'COACHING_SUIVI') return true;
  if (p.statut === 'AUTONOMIE_PREMIUM') return p.paiement === 'active';
  return false;
}

// PURE. LE GESTE A FAIRE, quand il y en a un. C'est la seule chose qui compte
// dans ce rapport : le reste est du contexte.
function geste(p, a) {
  const ouvert = accesOuvert(p);
  if (!a || a.introuvable || a.erreur) return null;
  const mort = ['CANCELLED', 'EXPIRED', 'SUSPENDED'].indexOf(a.etat) >= 0;
  if (mort && ouvert) return { quoi: 'FERMER', pourquoi: 'abonnement ' + a.etat.toLowerCase()
    + ' depuis le ' + jour(a.depuis) + ', et son acces est encore ouvert' };
  if (a.etat === 'ACTIVE' && a.echecs > 0) return { quoi: 'RELANCER',
    pourquoi: a.echecs + ' prelevement' + (a.echecs > 1 ? 's' : '') + ' en echec'
      + (a.du > 0 ? (', ' + eur(a.du) + ' du') : '') };
  if (a.etat === 'ACTIVE' && !ouvert) return { quoi: 'ROUVRIR',
    pourquoi: 'il paie (dernier prelevement le ' + jour((a.dernier || {}).le)
      + ') et son acces est ferme' };
  return null;
}

function rapport(lignes) {
  const L = [];
  const mois = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  L.push('# Rapport des abonnements, ' + mois, '');

  const actifs = lignes.filter(x => x.a && x.a.etat === 'ACTIVE');
  const morts = lignes.filter(x => x.a && ['CANCELLED', 'EXPIRED', 'SUSPENDED'].indexOf(x.a.etat) >= 0);
  const gestes = lignes.map(x => ({ ...x, g: geste(x.p, x.a) })).filter(x => x.g);

  L.push('**' + actifs.length + ' abonnement' + (actifs.length > 1 ? 's' : '') + ' actif'
    + (actifs.length > 1 ? 's' : '') + '**, ' + morts.length + ' arrete'
    + (morts.length > 1 ? 's' : '') + '.', '');

  // ── CE QU'IL Y A A FAIRE, EN TETE ────────────────────────────────────
  if (gestes.length) {
    L.push('## A faire : ' + gestes.length + ' geste' + (gestes.length > 1 ? 's' : ''), '');
    L.push('| Qui | Geste | Pourquoi |', '|---|---|---|');
    for (const x of gestes) {
      L.push('| ' + (x.p.nom || x.p.email) + ' (' + x.p.email + ') | **'
        + x.g.quoi + '** | ' + x.g.pourquoi + ' |');
    }
    L.push('', 'Les trois gestes sont dans l\'application : espace coach, Paiements, '
      + 'carte **Acces**. Colle l\'adresse, l\'ecran dit ou elle en est et ouvre, '
      + 'prolonge ou ferme.', '');
  } else {
    L.push('## Rien a faire', '',
      'Aucun ecart entre ce que PayPal preleve et ce que l\'application ouvre.', '');
  }

  // ── QUI PAIE ─────────────────────────────────────────────────────────
  if (actifs.length) {
    L.push('## Qui paie', '', '| Qui | Dernier prelevement | Prochain | Acces |', '|---|---|---|---|');
    for (const x of actifs.sort((a, b) => (a.p.nom || '').localeCompare(b.p.nom || ''))) {
      const d = x.a.dernier;
      L.push('| ' + (x.p.nom || x.p.email) + ' | '
        + (d ? (eur(d.montant) + ' le ' + jour(d.le)) : 'aucun encore') + ' | '
        + (jour(x.a.prochain) || '-') + ' | '
        + (accesOuvert(x.p) ? 'ouvert' : '**ferme**') + ' |');
    }
    L.push('');
  }

  // ── QUI NE PAIE PLUS ─────────────────────────────────────────────────
  if (morts.length) {
    L.push('## Qui ne paie plus', '', '| Qui | Etat | Depuis | Dernier prelevement | Acces |',
      '|---|---|---|---|---|');
    for (const x of morts) {
      const d = x.a.dernier;
      L.push('| ' + (x.p.nom || x.p.email) + ' | ' + x.a.etat + ' | ' + jour(x.a.depuis)
        + ' | ' + (d ? (eur(d.montant) + ' le ' + jour(d.le)) : '-') + ' | '
        + (accesOuvert(x.p) ? '**ouvert**' : 'ferme') + ' |');
    }
    L.push('');
  }

  // ── CE QU'ON N'A PAS PU LIRE ─────────────────────────────────────────
  const rates = lignes.filter(x => x.a && (x.a.introuvable || x.a.erreur));
  if (rates.length) {
    L.push('## Identifiants que PayPal ne reconnait pas', '');
    for (const x of rates) {
      L.push('- ' + (x.p.nom || x.p.email) + ' : `' + x.p.abo + '` '
        + (x.a.introuvable ? '(inconnu chez PayPal)' : ('(' + x.a.erreur + ')')));
    }
    L.push('', 'Un abonnement de bac a sable, ou un identifiant saisi a la main. '
      + 'L\'acces, lui, reste decide par l\'application.', '');
  }

  L.push('---', '',
    'Source : l\'API des abonnements PayPal, abonnement par abonnement, croisee avec '
    + 'l\'acces ouvert dans l\'application. Aucune donnee de sante n\'est lue.');
  return L.join('\n');
}

// ══ L'ESSAI ═══════════════════════════════════════════════════════════════
function jeuDEssai() {
  const j = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  return [
    { p: { email: 'julie@example.com', nom: 'Julie Martin', statut: 'AUTONOMIE_PREMIUM',
      paiement: 'active', abo: 'I-AAA', pose: null, finDossier: 0 },
      a: { etat: 'ACTIVE', depuis: j(200), dernier: { montant: 9.95, devise: 'EUR', le: j(9) },
        prochain: j(-21), echecs: 0, du: 0 } },
    { p: { email: 'karim@example.com', nom: 'Karim Diallo', statut: 'AUTONOMIE_PREMIUM',
      paiement: 'active', abo: 'I-BBB', pose: null, finDossier: 0 },
      a: { etat: 'CANCELLED', depuis: j(12), dernier: { montant: 24.90, devise: 'EUR', le: j(41) },
        prochain: '', echecs: 0, du: 0 } },
    { p: { email: 'sofia@example.com', nom: 'Sofia Ben', statut: 'AUTONOMIE_PREMIUM',
      paiement: 'active', abo: 'I-CCC', pose: null, finDossier: 0 },
      a: { etat: 'ACTIVE', depuis: j(90), dernier: { montant: 24.90, devise: 'EUR', le: j(33) },
        prochain: j(-2), echecs: 2, du: 24.90 } },
    { p: { email: 'marc@example.com', nom: 'Marc Tellier', statut: 'AUTONOMIE_PREMIUM',
      paiement: 'cancelled', abo: 'I-DDD',
      pose: { palier: 'aucun', echeance: 0 }, finDossier: 0 },
      a: { etat: 'ACTIVE', depuis: j(150), dernier: { montant: 9.95, devise: 'EUR', le: j(3) },
        prochain: j(-27), echecs: 0, du: 0 } },
  ];
}

// ══ LA MARCHE ═════════════════════════════════════════════════════════════
async function principal() {
  if (ESSAI) {
    console.log('\n  ESSAI : donnees inventees, ni PayPal ni la base ne sont appeles.\n');
    const t = rapport(jeuDEssai());
    console.log(t);
    writeFileSync(SORTIE, t + '\n', 'utf8');
    console.log('\n  Ecrit dans ' + SORTIE);
    return;
  }
  if (!CLIENT_ID) throw new Error('identifiant client introuvable dans ' + fichierCore);

  // 1. LA BASE.
  let users, droits;
  if (FICHIER) {
    const tout = JSON.parse(readFileSync(FICHIER, 'utf8'));
    users = tout.users || tout;
    droits = tout.droits || {};
    console.log('  Base lue dans ' + FICHIER + '.');
  } else {
    console.log('  Lecture de la base (session firebase de ce poste)...');
    users = await lireFirebase('/users');
    droits = await lireFirebase('/droits');
  }
  const gens = extraire(users, droits);
  const avecAbo = gens.filter(g => g.abo);
  console.log('  ' + gens.length + ' dossier(s), dont ' + avecAbo.length
    + ' avec un abonnement PayPal.');
  if (!avecAbo.length) {
    console.log('\n  Personne n\'a d\'identifiant d\'abonnement : rien a demander a PayPal.\n');
    return;
  }

  // 2. PAYPAL, UN PAR UN.
  const secret = process.env.PAYPAL_CLIENT_SECRET || await demanderSecret();
  if (!secret) { console.log('\n  Aucun secret : rien n\'a ete lu.\n'); process.exitCode = 2; return; }
  const tok = await jeton(secret);
  console.log('  Identifiants acceptes par PayPal.');
  const lignes = [];
  for (const p of avecAbo) {
    process.stdout.write('  ' + p.abo + ' ... ');
    const a = await abonnement(tok, p.abo);
    console.log(a.etat || (a.introuvable ? 'inconnu' : a.erreur));
    lignes.push({ p, a });
  }

  const t = rapport(lignes);
  console.log('\n' + t);
  writeFileSync(SORTIE, t + '\n', 'utf8');
  console.log('\n  Ecrit dans ' + SORTIE + ' (hors depot).');
}

principal().catch(e => {
  console.error('\n  ECHEC : ' + e.message + '\n');
  process.exitCode = 1;
});
