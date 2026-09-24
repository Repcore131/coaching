// ══════════════════════════════════════════════════════════════════════════
//  LES QUATRE PLANS PAYPAL QUI MANQUENT
// ══════════════════════════════════════════════════════════════════════════
//
//  POURQUOI CE SCRIPT EXISTE. Quatre constantes de rc-core sont vides, et tant
//  qu'elles le sont, l'offre correspondante n'est PAS proposee dans
//  l'application : Essentielle annuel, Ultime mensuel, Ultime annuel, et le
//  premier mois d'Ultime a moitie prix apres un pack. Les creer a la main dans
//  le tableau de bord PayPal, c'est quatre formulaires, deux cycles de
//  facturation a regler sur le dernier, et une occasion de se tromper d'un
//  centime. Ici, c'est une commande.
//
//  ⚠ LES PRIX NE SONT PAS ECRITS ICI. Ils sont LUS dans OFFRES, la table de
//    rc-core, exactement comme les ecrans les lisent. Un prix recopie dans ce
//    script aurait diverge de celui qu'on affiche, et c'est precisement le
//    defaut que le lot 1 a ferme.
//
//  ⚠ TON SECRET NE QUITTE PAS TON SHELL. Il est lu dans une variable
//    d'environnement, il n'est jamais ecrit sur le disque, jamais affiche,
//    jamais envoye ailleurs qu'a api.paypal.com (ou api.sandbox.paypal.com).
//
//  ── COMMENT S'EN SERVIR ────────────────────────────────────────────────
//
//  1. Recupere ton secret : developer.paypal.com → Apps & Credentials →
//     l'application dont l'identifiant client est celui de rc-core → Secret.
//
//  2. Un essai a blanc, qui ne cree RIEN et qui dit ce qu'il ferait :
//
//       node scripts/paypal_plans.mjs --blanc
//
//  3. En bac a sable d'abord, pour voir les quatre plans naitre sans risque :
//
//       PAYPAL_CLIENT_ID=...sandbox... PAYPAL_CLIENT_SECRET=...sandbox... \
//         node scripts/paypal_plans.mjs --sandbox
//
//  4. Puis en vrai. L'identifiant client vient de rc-core si tu ne le donnes
//     pas ; seul le secret est obligatoire :
//
//       PAYPAL_CLIENT_SECRET=...  node scripts/paypal_plans.mjs
//
//  5. Avec --ecrire, il colle lui-meme les quatre identifiants dans rc-core a
//     la place des chaines vides. Sans, il les affiche et tu les colles.
//
//  IL NE CREE JAMAIS DEUX FOIS LE MEME PLAN : avant d'en creer un, il liste
//  ceux qui existent et reutilise celui qui porte le meme nom. On peut donc le
//  relancer sans rien casser.
// ══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const ARGS = new Set(process.argv.slice(2));
const BLANC = ARGS.has('--blanc') || ARGS.has('--dry-run');
const SANDBOX = ARGS.has('--sandbox');
const ECRIRE = ARGS.has('--ecrire');
const API = SANDBOX ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

// ── LE FICHIER DE L'APPLICATION, ET SES PRIX ────────────────────────────
const DOSSIER = 'C:/RepCore-web/app';
const fichierCore = readdirSync(DOSSIER)
  .filter(f => /^rc-core\.\d+\.js$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
  .pop();
const CHEMIN = DOSSIER + '/' + fichierCore;
const src = readFileSync(CHEMIN, 'utf8');

// OFFRES est un objet gele dont une entree porte un accesseur (`get prix()`)
// qui lit OFFRES lui-meme : on l'evalue tel quel, sous son propre nom.
function lireOffres() {
  const i = src.indexOf('const OFFRES=Object.freeze({');
  if (i < 0) throw new Error('OFFRES introuvable dans ' + fichierCore);
  const fin = src.indexOf('\n});', i);
  if (fin < 0) throw new Error('fin d\'OFFRES introuvable');
  const bloc = src.slice(i, fin + 4).replace('const OFFRES=', 'var OFFRES=');
  // eslint-disable-next-line no-new-func
  return new Function(bloc + ' return OFFRES;')();
}
const OFFRES = lireOffres();
const eur = n => (Math.round(Number(n) * 100) / 100).toFixed(2);

// ── CE QU'ON CREE, ET CE QUE CHAQUE PLAN OUVRE ──────────────────────────
//
// `constante` est le nom dans rc-core ; `config` est ce qu'il faut declarer
// dans config/plans (RTDB) pour que la Cloud Function sache quoi ouvrir.
const PRODUIT_NOM = 'RepCore';
const PLANS = [
  {
    constante: 'PAYPAL_PLAN_ID_ANNUEL',
    nom: 'RepCore Essentielle, annuel',
    description: 'Acces Essentielle a RepCore, facture une fois par an.',
    cycles: [{ type: 'REGULAR', unite: 'YEAR', prix: eur(OFFRES.essentielle.prixAn) }],
    config: { palier: 'essentielle', mois: 12 },
  },
  {
    constante: 'PAYPAL_PLAN_ID_ULTIME',
    nom: 'RepCore Ultime, mensuel',
    description: 'Acces Ultime a RepCore, facture chaque mois.',
    cycles: [{ type: 'REGULAR', unite: 'MONTH', prix: eur(OFFRES.ultime.prix) }],
    config: { palier: 'ultime', mois: 1 },
  },
  {
    constante: 'PAYPAL_PLAN_ID_ULTIME_ANNUEL',
    nom: 'RepCore Ultime, annuel',
    description: 'Acces Ultime a RepCore, facture une fois par an.',
    cycles: [{ type: 'REGULAR', unite: 'YEAR', prix: eur(OFFRES.ultime.prixAn) }],
    config: { palier: 'ultime', mois: 12 },
  },
  {
    // ⚠ DEUX CYCLES, ET C'EST TOUT L'INTERET DE CE PLAN : le premier mois a
    //   moitie prix, une seule fois, puis le tarif normal. PayPal appelle le
    //   premier cycle TRIAL meme quand il est payant.
    constante: 'PAYPAL_PLAN_ID_ULTIME_DEMI',
    nom: 'RepCore Ultime, premier mois apres un pack',
    description: 'Premier mois d\'Ultime a moitie prix apres un suivi, puis tarif normal.',
    cycles: [
      { type: 'TRIAL', unite: 'MONTH', prix: eur(OFFRES.ultime_demi.prix), fois: 1 },
      { type: 'REGULAR', unite: 'MONTH', prix: eur(OFFRES.ultime.prix) },
    ],
    config: { palier: 'ultime', mois: 1, demi: true },
  },
];

// ── L'APPEL A PAYPAL ────────────────────────────────────────────────────
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID
  || (src.match(/const PAYPAL_CLIENT_ID='([^']+)'/) || [])[1] || '';
const SECRET = process.env.PAYPAL_CLIENT_SECRET || '';

// LE SECRET, DEMANDE A L'ECRAN. Rien n'est garde : ni fichier, ni variable
// d'environnement, ni historique de shell.
function demanderSecret() {
  return new Promise(res => {
    process.stdout.write('\n  Colle le secret de l\'application PayPal, puis Entree\n  (il n\'est ni enregistre ni affiche ailleurs) : ');
    let t = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', d => {
      t += d;
      const i = t.indexOf('\n');
      if (i >= 0) {
        process.stdin.pause();
        console.log('');
        res(t.slice(0, i).trim());
      }
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
async function pp(tok, methode, chemin, corps) {
  const r = await fetch(API + chemin, {
    method: methode,
    headers: {
      Authorization: 'Bearer ' + tok,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const t = await r.text();
  let j = null;
  try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
  if (!r.ok) {
    const d = (j && (j.details || [])).map(x => x.issue + ' ' + (x.description || '')).join(' | ');
    throw new Error(methode + ' ' + chemin + ' → ' + r.status + ' ' + ((j && j.message) || '') + (d ? ' [' + d + ']' : ''));
  }
  return j;
}

// Le PRODUIT porte les plans. Un seul suffit pour les quatre.
async function produit(tok) {
  const l = await pp(tok, 'GET', '/v1/catalogs/products?page_size=20');
  const deja = (l.products || []).find(p => p.name === PRODUIT_NOM);
  if (deja) return { id: deja.id, neuf: false };
  const p = await pp(tok, 'POST', '/v1/catalogs/products', {
    name: PRODUIT_NOM,
    description: 'Application d\'entrainement et de suivi RepCore.',
    type: 'SERVICE',
    category: 'SOFTWARE',
  });
  return { id: p.id, neuf: true };
}

function corpsDuPlan(produitId, p) {
  return {
    product_id: produitId,
    name: p.nom,
    description: p.description,
    status: 'ACTIVE',
    billing_cycles: p.cycles.map((c, i) => ({
      frequency: { interval_unit: c.unite, interval_count: 1 },
      tenure_type: c.type,
      sequence: i + 1,
      // 0 = sans fin. Le cycle d'essai, lui, ne passe qu'une fois.
      total_cycles: c.type === 'TRIAL' ? (c.fois || 1) : 0,
      pricing_scheme: { fixed_price: { value: c.prix, currency_code: 'EUR' } },
    })),
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: { value: '0', currency_code: 'EUR' },
      setup_fee_failure_action: 'CONTINUE',
      payment_failure_threshold: 3,
    },
  };
}

async function planExistant(tok, produitId, nom) {
  let page = 1;
  for (;;) {
    const l = await pp(tok, 'GET',
      '/v1/billing/plans?product_id=' + encodeURIComponent(produitId)
      + '&page_size=20&page=' + page + '&total_required=true');
    const t = (l.plans || []).find(x => x.name === nom);
    if (t) return t;
    const total = Number(l.total_pages || 1);
    if (page >= total) return null;
    page++;
  }
}

// ── CE QU'ON MONTRE ─────────────────────────────────────────────────────
function tableau() {
  console.log('\n  Les quatre plans, avec les prix LUS dans ' + fichierCore + ' :\n');
  for (const p of PLANS) {
    const c = p.cycles.map(x =>
      x.type === 'TRIAL'
        ? (x.prix + ' EUR le premier mois')
        : (x.prix + ' EUR ' + (x.unite === 'YEAR' ? 'par an' : 'par mois'))).join(', puis ');
    console.log('   ' + p.nom.padEnd(45) + c);
  }
  console.log('');
}

async function principal() {
  console.log('\n══ LES QUATRE PLANS PAYPAL ' + (SANDBOX ? '(BAC A SABLE)' : '(COMPTE REEL)') + ' ══');
  tableau();

  if (BLANC) {
    console.log('  Essai a blanc : rien n\'a ete cree.');
    console.log('  Pour de vrai :  node scripts/paypal_plans.mjs --ecrire'
      + (SANDBOX ? ' --sandbox' : '') + '   (il demandera le secret)\n');
    return;
  }
  if (!CLIENT_ID) throw new Error('Aucun identifiant client : donne PAYPAL_CLIENT_ID.');
  // ⚠ LE BAC A SABLE A SES PROPRES IDENTIFIANTS. Celui de rc-core est celui du
  //   compte reel : l'envoyer au bac a sable donne un refus qui ne dit pas
  //   pourquoi. On le dit ici, avant l'appel.
  if (SANDBOX && !process.env.PAYPAL_CLIENT_ID) {
    console.log('\n  ⚠ Tu es en bac a sable avec l\'identifiant client du compte REEL');
    console.log('    (celui de rc-core). Le bac a sable a les siens :');
    console.log('    developer.paypal.com → Apps & Credentials → onglet Sandbox.');
    console.log('    Donne-les tous les deux : PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=...\n');
  }
  // ⚠ LE SECRET SE DEMANDE ICI, ET NON SUR LA LIGNE DE COMMANDE. Un secret
  //   tape en argument ou en variable d'environnement reste dans l'historique
  //   du shell, et dans la liste des processus le temps de l'appel. Colle-le
  //   quand il le demande : il ne va nulle part ailleurs que dans la memoire
  //   de ce processus, et le processus meurt a la fin de la commande.
  const secret = SECRET || await demanderSecret();
  if (!secret) {
    console.log('\n  Aucun secret : rien n\'a ete cree.\n');
    process.exitCode = 2;
    return;
  }

  const tok = await jeton(secret);
  console.log('  Identifiants acceptes par PayPal.');
  const pr = await produit(tok);
  console.log('  Produit « ' + PRODUIT_NOM +' » : ' + pr.id + (pr.neuf ? ' (cree)' : ' (deja la)'));

  const faits = [];
  for (const p of PLANS) {
    const deja = await planExistant(tok, pr.id, p.nom);
    if (deja) {
      faits.push({ ...p, id: deja.id, neuf: false });
      console.log('  ' + p.constante.padEnd(30) + deja.id + '  (deja la)');
      continue;
    }
    const cree = await pp(tok, 'POST', '/v1/billing/plans', corpsDuPlan(pr.id, p));
    faits.push({ ...p, id: cree.id, neuf: true });
    console.log('  ' + p.constante.padEnd(30) + cree.id + '  (cree)');
  }

  // ── CE QU'IL RESTE A POSER ────────────────────────────────────────────
  console.log('\n── A COLLER DANS ' + fichierCore + ' ───────────────────────────');
  for (const f of faits) console.log("const " + f.constante + "='" + f.id + "';");

  console.log('\n── A DECLARER DANS config/plans (console Firebase) ─────────');
  const conf = {};
  for (const f of faits) conf[f.id] = f.config;
  console.log(JSON.stringify(conf, null, 2));
  console.log('\n  Sans cette declaration, la Cloud Function ouvre Essentielle un mois');
  console.log('  pour tout plan qu\'elle ne reconnait pas : le repli est le palier le');
  console.log('  plus bas, jamais le plus haut.\n');

  if (ECRIRE) {
    let s = readFileSync(CHEMIN, 'utf8');
    let n = 0;
    for (const f of faits) {
      const vide = "const " + f.constante + "='';";
      if (s.includes(vide)) {
        s = s.replace(vide, "const " + f.constante + "='" + f.id + "';");
        n++;
      } else {
        console.log('  ⚠ ' + f.constante + ' n\'etait pas vide : laissee telle quelle.');
      }
    }
    if (n) {
      writeFileSync(CHEMIN, s);
      console.log('  ' + n + ' constante(s) ecrite(s) dans ' + fichierCore + '.');
      console.log('  ⚠ Il reste a monter RC_BUILD et CACHE, puis :');
      console.log('      python scripts/versionner_actifs.py');
      console.log('      node scripts/verif/syntaxe.mjs\n');
    }
  }
}

principal().catch(e => {
  console.error('\n  ECHEC : ' + e.message + '\n');
  process.exitCode = 1;
});
