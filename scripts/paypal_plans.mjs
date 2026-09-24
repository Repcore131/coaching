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
//  5. Avec --tarifs, il remet les plans EXISTANTS au prix que la table de
//     l'application annonce, puis verifie. A lancer apres tout changement
//     de tarif : sans lui, l'ecran dit un prix et PayPal en preleve un
//     autre. Il ne touche pas aux abonnements deja en cours.
//  6. Avec --verifier, il ne cree RIEN : il va chercher chaque plan chez
//     PayPal et dit lequel est inactif, introuvable, ou ne facture pas le
//     prix que l'application annonce. C'est la commande a lancer quand on
//     se demande « est-ce que les paiements marchent ? ».
//  7. Avec --ecrire, il colle lui-meme les identifiants dans rc-core a
//     la place des chaines vides. Sans, il les affiche et tu les colles.
//
//  IL NE CREE JAMAIS DEUX FOIS LE MEME PLAN : avant d'en creer un, il liste
//  ceux qui existent et reutilise celui qui porte le meme nom. On peut donc le
//  relancer sans rien casser.
// ══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ARGS = new Set(process.argv.slice(2));
const BLANC = ARGS.has('--blanc') || ARGS.has('--dry-run');
const SANDBOX = ARGS.has('--sandbox');
const ECRIRE = ARGS.has('--ecrire');
const VERIFIER = ARGS.has('--verifier');
const TARIFS = ARGS.has('--tarifs');
const API = SANDBOX ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

// ── LE FICHIER DE L'APPLICATION, ET SES PRIX ────────────────────────────
// ⚠ LE CHEMIN SE DEDUIT DU SCRIPT, il ne s'ecrit pas. Il valait
//   « C:/RepCore-web/app » en dur : sur un poste Windows, personne ne le voit ;
//   dans un travail GitHub, readdirSync jette au premier appel et les trois
//   etapes tombent en six secondes, avec une erreur qui parle d'un dossier
//   introuvable et pas de PayPal. Constate le 24/09/2026, execution n°1.
const DOSSIER = fileURLToPath(new URL('../app/', import.meta.url));
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
// LES PALIERS COACH VIVENT DANS UNE AUTRE TABLE, et leurs prix aussi. Meme
// methode : on evalue la table telle quelle, apres avoir pose les constantes
// d'identifiants qu'elle referme dans ses accesseurs `planId`.
function lireCoachPaliers() {
  const i = src.indexOf('const COACH_PALIERS=Object.freeze([');
  if (i < 0) throw new Error('COACH_PALIERS introuvable dans ' + fichierCore);
  const fin = src.indexOf('\n]);', i);
  if (fin < 0) throw new Error('fin de COACH_PALIERS introuvable');
  const bloc = src.slice(i, fin + 4).replace('const COACH_PALIERS=', 'var COACH_PALIERS=');
  // eslint-disable-next-line no-new-func
  return new Function('var PAYPAL_PLAN_ID_COACH="",PAYPAL_PLAN_ID_PRO="";'
    + bloc + ' return COACH_PALIERS;')();
}
const COACH_PALIERS = lireCoachPaliers();
const coachPalier = cle => {
  const p = COACH_PALIERS.find(x => x.cle === cle);
  if (!p) throw new Error('palier coach « ' + cle + ' » introuvable');
  return p;
};
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
  // ══ ET LES DEUX PLANS DU COACH (24/09/2026) ═══════════════════════════
  //
  // ⚠ ILS MANQUAIENT, ET AUCUN COACH NE POUVAIT DONC PAYER. PAYPAL_PLAN_ID_COACH
  //   et PAYPAL_PLAN_ID_PRO etaient vides dans rc-core : souscrireCoach
  //   refusait proprement (« Cette formule n'est pas encore ouverte au
  //   paiement »), ce qui est honnete, mais ferme la seule source de revenus
  //   que le coach apporte.
  //
  //   CE QU'ILS N'OUVRENT PAS : un palier d'acces. Un coach a le sien par son
  //   role, pas par un droit achete — ce plan achete un QUOTA D'ATHLETES, que
  //   coachPlanDe et getCoachQuota lisent dans le dossier. D'ou `config: null`.
  {
    constante: 'PAYPAL_PLAN_ID_COACH',
    nom: 'RepCore Coach, mensuel',
    description: 'Formule Coach : jusqu\'a quinze athletes actifs, facturee chaque mois.',
    cycles: [{ type: 'REGULAR', unite: 'MONTH', prix: eur(coachPalier('coach').prix) }],
    config: null,
  },
  {
    constante: 'PAYPAL_PLAN_ID_PRO',
    nom: 'RepCore Pro, mensuel',
    description: 'Formule Pro : athletes sans limite de nombre, facturee chaque mois.',
    cycles: [{ type: 'REGULAR', unite: 'MONTH', prix: eur(coachPalier('pro').prix) }],
    config: null,
  },
];
// LES PLANS DEJA EN PLACE, que ce script n'a pas crees mais que l'application
// facture : le mensuel Essentielle date d'avant.
//
// ⚠ IL PORTE SES CYCLES, LUI AUSSI (24/09/2026). Sans eux, `--verifier` le
//   regardait sans rien comparer et `--tarifs` le sautait : le plan d'entree,
//   celui que presque tout le monde prendra, serait reste a 9,95 pendant que
//   l'ecran annonce 9,50.
//
// ⚠ ET IL RESTE HORS DE `PLANS` : la boucle de creation y reconnait un plan
//   par son NOM, et celui-ci n'a pas le meme. L'y mettre creerait un DOUBLON
//   chez PayPal au prochain passage.
const DEJA = [{
  constante: 'PAYPAL_PLAN_ID',
  quoi: 'Essentielle, mensuel',
  cycles: [{ type: 'REGULAR', unite: 'MONTH', prix: eur(OFFRES.essentielle.prix) }],
}];

// ── L'APPEL A PAYPAL ────────────────────────────────────────────────────
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID
  || (src.match(/const PAYPAL_CLIENT_ID='([^']+)'/) || [])[1] || '';
const SECRET = process.env.PAYPAL_CLIENT_SECRET || '';

// LE SECRET, DEMANDE A L'ECRAN. Rien n'est garde : ni fichier, ni variable
// d'environnement, ni historique de shell.
function demanderSecret() {
  // ⚠ PERSONNE POUR TAPER : on le dit, au lieu d'attendre dans le vide.
  //   Sans terminal — un travail GitHub, un script appele par un autre — la
  //   demande partirait dans le neant et le processus rendrait « aucun secret »
  //   sans que rien n'explique pourquoi.
  if (!process.stdin.isTTY) {
    throw new Error('aucun terminal pour saisir le secret : donne-le par '
      + "PAYPAL_CLIENT_SECRET (variable d'environnement, ou secret du depot "
      + 'pour un travail GitHub).');
  }
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
  console.log('\n  Les ' + PLANS.length + ' plans, avec les prix LUS dans ' + fichierCore + ' :\n');
  for (const p of PLANS) {
    const c = p.cycles.map(x =>
      x.type === 'TRIAL'
        ? (x.prix + ' EUR le premier mois')
        : (x.prix + ' EUR ' + (x.unite === 'YEAR' ? 'par an' : 'par mois'))).join(', puis ');
    console.log('   ' + p.nom.padEnd(45) + c);
  }
  console.log('');
}

// ══ `--verifier` : CE QUE PAYPAL FACTURE VRAIMENT ════════════════════════
//
// Un plan peut exister et etre INACTIF, ou porter un prix qui n'est plus celui
// que l'ecran annonce. Les deux se voient le jour d'un paiement, et pas avant :
// le premier refuse le client, le second le debite du mauvais montant. Ce mode
// va chercher chaque plan chez PayPal et compare, ligne a ligne.
//
// IL N'ECRIT RIEN, ni chez PayPal, ni dans le fichier.
function prixAnnonce(p) {
  const reg = p.cycles.find(c => c.type === 'REGULAR') || p.cycles[0];
  return { prix: reg.prix, unite: reg.unite };
}
// PURE. Deux montants sont-ils le meme ? EN CENTIMES ENTIERS, jamais en
// chaines : PayPal rend « 114.0 » la ou la table dit « 114.00 », et « 24.9 »
// la ou elle dit « 24.90 ». Compare comme du texte, chaque plan juste etait
// signale comme faux — sept alertes sur sept plans corrects, le 24/09/2026.
// Un rapport qui crie au loup a chaque ligne ne se lit plus.
function memeMontant(a, b) {
  const x = Math.round(Number(a) * 100), y = Math.round(Number(b) * 100);
  return Number.isFinite(x) && Number.isFinite(y) && x === y;
}
function prixFacture(plan) {
  const cy = (plan.billing_cycles || []).find(c => c.tenure_type === 'REGULAR')
    || (plan.billing_cycles || [])[0] || {};
  const m = (cy.pricing_scheme || {}).fixed_price || {};
  return { prix: m.value || '?', devise: m.currency_code || '?',
    unite: ((cy.frequency || {}).interval_unit) || '?' };
}
async function verifier(tok) {
  const attendus = PLANS.map(p => ({ constante: p.constante, nom: p.nom, ...prixAnnonce(p) }));
  for (const d of DEJA) attendus.push({ constante: d.constante, nom: d.quoi,
    ...prixAnnonce(d) });
  let souci = 0;
  console.log('\n── L\'ETAT REEL DE CHAQUE PLAN ────────────────────────────\n');
  for (const a of attendus) {
    const id = (src.match(new RegExp('const ' + a.constante + "='([^']*)'")) || [])[1] || '';
    if (!id) {
      souci++;
      console.log('  ' + a.constante.padEnd(30) + 'VIDE dans ' + fichierCore
        + ' — personne ne peut payer « ' + a.nom + ' »');
      continue;
    }
    let plan = null;
    try { plan = await pp(tok, 'GET', '/v1/billing/plans/' + id); }
    catch (e) {
      souci++;
      console.log('  ' + a.constante.padEnd(30) + id + '  INTROUVABLE (' + e.message.slice(0, 60) + ')');
      continue;
    }
    const f = prixFacture(plan);
    const etat = String(plan.status || '?');
    const ligne = etat.padEnd(9) + f.prix + ' ' + f.devise + ' / '
      + (f.unite === 'YEAR' ? 'an' : (f.unite === 'MONTH' ? 'mois' : f.unite));
    const ecarts = [];
    if (etat !== 'ACTIVE') ecarts.push('plan ' + etat);
    if (f.devise !== 'EUR') ecarts.push('facture en ' + f.devise);
    if (a.prix && !memeMontant(f.prix, a.prix)) ecarts.push('l\'app annonce ' + a.prix + ' EUR');
    if (a.unite && f.unite !== a.unite) ecarts.push('l\'app annonce un cycle ' + a.unite);
    if (ecarts.length) souci++;
    console.log('  ' + a.constante.padEnd(30) + ligne
      + (ecarts.length ? ('   ⚠ ' + ecarts.join(' ; ')) : '   ok'));
  }
  console.log('');
  if (souci) {
    console.log('  ' + souci + ' plan(s) a regarder de pres : tant qu\'ils sont dans cet etat,');
    console.log('  ce chemin de paiement ne rapporte rien ou ne facture pas le bon prix.\n');
    process.exitCode = 1;
  } else {
    console.log('  Tous les plans sont actifs, en euros, au prix que l\'application annonce.\n');
  }
}

// ══ `--tarifs` : REMETTRE LES PLANS AU PRIX DE L'APPLICATION ════════════
//
// ⚠ UN PLAN PAYPAL NE SUIT PAS LA TABLE DES PRIX. Le 24/09/2026, l'abonnement
//   est passe a 9,50 par mois et 114 l'an ; les plans, eux, facturaient encore
//   9,95 et 99. L'application annoncait un prix, PayPal en prelevait un autre —
//   la faute la plus chere possible, et la plus silencieuse.
//
// ⚠ CE QUE CETTE COMMANDE NE FAIT PAS : changer ce que paient les abonnes
//   DEJA en cours. PayPal applique le nouveau tarif aux souscriptions a venir ;
//   les existantes gardent le leur jusqu'a ce qu'on leur propose le changement,
//   ce qui est un autre geste, avec un preavis. Au 24/09/2026 il n'y a aucun
//   abonne, donc la question ne se pose pas — mais elle se posera.
async function majTarifs(tok) {
  let bouge = 0, deja = 0;
  console.log('\n── LES PRIX, REMIS A CEUX DE L\'APPLICATION ───────────────\n');
  for (const p of PLANS.concat(DEJA)) {
    const id = (src.match(new RegExp('const ' + p.constante + "='([^']*)'")) || [])[1] || '';
    if (!id) { console.log('  ' + p.constante.padEnd(30) + 'vide, rien a mettre a jour'); continue; }
    let plan = null;
    try { plan = await pp(tok, 'GET', '/v1/billing/plans/' + id); }
    catch (e) { console.log('  ' + p.constante.padEnd(30) + 'INTROUVABLE'); continue; }
    // UN CYCLE ATTENDU, UN CYCLE CHEZ PAYPAL, DANS LE MEME ORDRE. On compare en
    // CENTIMES ENTIERS : 24,90 × 12 ne vaut pas 298,80 en virgule flottante.
    const chez = (plan.billing_cycles || []);
    const schemas = [];
    const dits = [];
    p.cycles.forEach((c, i) => {
      const seq = i + 1;
      const actuel = ((chez[i] || {}).pricing_scheme || {}).fixed_price || {};
      const a = Math.round(Number(actuel.value || 0) * 100);
      const veut = Math.round(Number(c.prix) * 100);
      if (a === veut && String(actuel.currency_code || '') === 'EUR') return;
      dits.push((actuel.value || '?') + ' → ' + c.prix);
      schemas.push({ billing_cycle_sequence: seq,
        pricing_scheme: { fixed_price: { value: c.prix, currency_code: 'EUR' } } });
    });
    if (!schemas.length) { deja++; console.log('  ' + p.constante.padEnd(30) + 'deja au bon prix'); continue; }
    await pp(tok, 'POST', '/v1/billing/plans/' + id + '/update-pricing-schemes',
      { pricing_schemes: schemas });
    bouge++;
    console.log('  ' + p.constante.padEnd(30) + dits.join(', ') + '  (mis a jour)');
  }
  console.log('\n  ' + bouge + ' plan(s) remis au tarif, ' + deja + ' deja juste(s).\n');
}

async function principal() {
  console.log('\n══ LES PLANS PAYPAL ' + (SANDBOX ? '(BAC A SABLE)' : '(COMPTE REEL)') + ' ══');
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
  if (VERIFIER) { await verifier(tok); return; }
  if (TARIFS) { await majTarifs(tok); await verifier(tok); return; }
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

  // ⚠ PLUS RIEN A DECLARER DANS config/plans (24/09/2026). Cette section
  //   servait une Cloud Function qui lisait le plan facture pour ouvrir le
  //   palier correspondant. Kevin ne prend pas le plan Blaze : la fonction
  //   n'existera pas. C'est `formuleDuPlan`, dans rc-core, qui lit desormais
  //   l'identifiant du plan facture — d'ou l'importance de la ligne du dessus.
  const aConfigurer = faits.filter(f => f.config);
  if (aConfigurer.length) {
    console.log('\n── POUR MEMOIRE, ce que chaque plan ouvre ──────────────────');
    for (const f of aConfigurer)
      console.log('   ' + f.id + '  ' + JSON.stringify(f.config));
    console.log('\n  ⚠ A RECOPIER DANS formuleDuPlan (rc-core) si un plan neuf');
    console.log('    n\'y figure pas : un plan inconnu ne dit pas quelle formule');
    console.log('    a ete payee, et le dossier retombe sur Essentielle.\n');
  }

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
