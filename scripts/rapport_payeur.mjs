// ══════════════════════════════════════════════════════════════════════════
//  LE RAPPORT PAYEUR — QUI A PAYE, QUI NE PAIE PLUS
// ══════════════════════════════════════════════════════════════════════════
//
//  POURQUOI CE FICHIER EXISTE. Sans Cloud Function, l'application n'apprend
//  jamais qu'un abonnement a ete resilie ni qu'un prelevement a echoue :
//  l'argent s'arrete, l'acces reste ouvert, et personne ne le voit. Un
//  webhook aurait regle ca ; il demande un serveur, et il n'y en aura pas.
//
//  CE SCRIPT REGARDE A LA SOURCE. Il ne lit ni la base ni les dossiers : il
//  demande a PAYPAL la liste des encaissements de deux mois, et compare. Ceux
//  qui payaient le mois dernier et ne paient plus ce mois-ci, ce sont ceux
//  qu'il faut regarder. C'est la seule verite qui compte, et elle ne peut pas
//  etre trafiquee depuis un navigateur.
//
//  ⚠ IL NE LIT AUCUNE DONNEE DE SANTE, AUCUN DOSSIER, AUCUNE MESURE. Une
//    adresse, un nom, un montant, une date : ce qu'une facture porte deja.
//
//  ── COMMENT IL TOURNE ──────────────────────────────────────────────────
//
//  Tout seul, le 1er de chaque mois, par .github/workflows/rapport-payeur.yml.
//  A la main, pour voir tout de suite :
//
//      node scripts/rapport_payeur.mjs --essai          (donnees inventees)
//      node scripts/rapport_payeur.mjs                  (demande le secret)
//
//  Il ecrit rapport-payeur.md et l'affiche. Le workflow, lui, l'envoie par
//  courriel.
//
//  ⚠ UNE PERMISSION A COCHER UNE FOIS, cote PayPal : l'application doit avoir
//    « Transaction Search » activee (developer.paypal.com > Apps &
//    Credentials > l'application > Features). Sans elle, PayPal repond 403 et
//    le script le dit en toutes lettres.
// ══════════════════════════════════════════════════════════════════════════

import { writeFileSync, readFileSync, readdirSync } from 'node:fs';

const ARGS = new Set(process.argv.slice(2));
const ESSAI = ARGS.has('--essai');
const SANDBOX = ARGS.has('--sandbox');
const API = SANDBOX ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
const SORTIE = 'rapport-payeur.md';

// L'identifiant client vit deja dans l'application : il n'est pas secret.
function clientIdDuCode() {
  try {
    const dossier = 'app';
    const f = readdirSync(dossier).filter(x => /^rc-core\.\d+\.js$/.test(x))
      .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0])).pop();
    const s = readFileSync(dossier + '/' + f, 'utf8');
    return (s.match(/const PAYPAL_CLIENT_ID='([^']+)'/) || [])[1] || '';
  } catch (e) { return ''; }
}
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID || clientIdDuCode();

function demanderSecret() {
  // Pas de terminal (integration continue) : on ne demande pas, on echoue.
  // Une attente de saisie dans un travail programme dure jusqu'a l'expiration
  // du travail, et personne ne recoit rien ce mois-la.
  if (!process.stdin.isTTY) {
    throw new Error('PAYPAL_CLIENT_SECRET manquant, et aucun terminal pour le demander.');
  }
  return new Promise(res => {
    process.stdout.write('\n  Colle le secret de l\'application PayPal, puis Entree : ');
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

// ── LES ENCAISSEMENTS D'UNE PERIODE ─────────────────────────────────────
//
// ⚠ TRENTE ET UN JOURS PAR APPEL, C'EST LA LIMITE DE PAYPAL. On decoupe, et
//   on pagine : un mois a quarante abonnes tient sur une page, mais le jour
//   ou il y en a deux cents, ce serait une moitie de rapport, en silence.
function iso(d) { return new Date(d).toISOString().replace(/\.\d{3}Z$/, '-0000'); }

async function encaissements(tok, debut, fin) {
  const out = [];
  let curseur = new Date(debut);
  while (curseur < fin) {
    const bout = new Date(Math.min(fin.getTime(), curseur.getTime() + 30 * 86400000));
    let page = 1;
    for (;;) {
      const u = API + '/v1/reporting/transactions?fields=transaction_info,payer_info'
        + '&start_date=' + encodeURIComponent(iso(curseur))
        + '&end_date=' + encodeURIComponent(iso(bout))
        + '&page_size=100&page=' + page;
      const r = await fetch(u, { headers: { Authorization: 'Bearer ' + tok } });
      if (r.status === 403) {
        throw new Error('PayPal refuse la recherche de transactions (403). Active '
          + '« Transaction Search » sur l\'application : developer.paypal.com > Apps & '
          + 'Credentials > ton application > Features.');
      }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error('PayPal a repondu ' + r.status + ' : ' + (j.message || ''));
      for (const t of (j.transaction_details || [])) out.push(t);
      const total = Number(j.total_pages || 1);
      if (page >= total) break;
      page++;
    }
    curseur = new Date(bout.getTime() + 1000);
  }
  return out;
}

// ── CE QU'ON EN TIRE ────────────────────────────────────────────────────
//
// UN PAYEUR, PAS UNE TRANSACTION. Quelqu'un qui paie un abonnement et un
// programme le meme mois est UNE personne, avec deux lignes d'encaissement.
function parPayeur(transactions) {
  const m = new Map();
  for (const t of transactions) {
    const i = t.transaction_info || {};
    const p = t.payer_info || {};
    const montant = Number((i.transaction_amount || {}).value || 0);
    // Les montants NEGATIFS sont des remboursements ou des frais : ils ne
    // disent pas qu'on a encaisse, et les compter ferait un total faux.
    if (!(montant > 0)) continue;
    if (i.transaction_status && i.transaction_status !== 'S') continue;   // S = succes
    const cle = String(p.email_address || i.payer_name || 'inconnu').toLowerCase();
    const nom = ((p.payer_name || {}).alternate_full_name)
      || [((p.payer_name || {}).given_name), ((p.payer_name || {}).surname)].filter(Boolean).join(' ')
      || cle;
    const d = m.get(cle) || { cle, nom, total: 0, fois: 0, dernier: '', quoi: new Set() };
    d.total += montant;
    d.fois++;
    const date = String(i.transaction_initiation_date || '').slice(0, 10);
    if (date > d.dernier) d.dernier = date;
    if (i.transaction_subject) d.quoi.add(String(i.transaction_subject).slice(0, 40));
    m.set(cle, d);
  }
  return m;
}

const euros = n => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',') + ' EUR';
const mois = d => d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

function rapport(ceMois, moisAvant, bornes) {
  const L = [];
  const W = x => L.push(x);
  const aPaye = [...ceMois.values()].sort((a, b) => b.total - a.total);
  const manquants = [...moisAvant.values()].filter(x => !ceMois.has(x.cle))
    .sort((a, b) => b.total - a.total);
  const nouveaux = aPaye.filter(x => !moisAvant.has(x.cle));
  const totalMois = aPaye.reduce((s, x) => s + x.total, 0);
  const totalAvant = [...moisAvant.values()].reduce((s, x) => s + x.total, 0);
  const ecart = totalMois - totalAvant;

  W('# Rapport payeur, ' + bornes.libelleMois);
  W('');
  W('**' + euros(totalMois) + ' encaisses**, ' + aPaye.length + ' payeur'
    + (aPaye.length > 1 ? 's' : '') + '.'
    + (totalAvant ? ('  Mois precedent : ' + euros(totalAvant)
      + ' (' + (ecart >= 0 ? '+' : '') + euros(ecart) + ').') : ''));
  W('');

  // ── CE QUI DEMANDE UN GESTE, EN PREMIER ───────────────────────────────
  if (manquants.length) {
    W('## A verifier : ' + manquants.length + ' personne'
      + (manquants.length > 1 ? 's' : '') + ' qui payai' + (manquants.length > 1 ? 'ent' : 't')
      + ' et ne paie' + (manquants.length > 1 ? 'nt' : '') + ' plus');
    W('');
    W('| Qui | Payait | Dernier paiement |');
    W('|---|---|---|');
    for (const x of manquants) W('| ' + x.nom + ' (' + x.cle + ') | ' + euros(x.total) + ' | ' + x.dernier + ' |');
    W('');
    W('Resiliation, carte expiree, ou simple decalage de date : regarde '
      + 'l\'abonnement dans PayPal, puis suspends l\'acces dans l\'app si besoin.');
    W('');
  } else {
    W('## A verifier : personne');
    W('');
    W('Tous ceux qui payaient le mois dernier ont paye ce mois-ci.');
    W('');
  }

  // ── QUI A PAYE ────────────────────────────────────────────────────────
  W('## Ont paye ce mois-ci');
  W('');
  if (!aPaye.length) {
    W('Aucun encaissement sur la periode.');
  } else {
    W('| Qui | Montant | Fois | Dernier | Nouveau |');
    W('|---|---|---|---|---|');
    for (const x of aPaye) {
      W('| ' + x.nom + ' (' + x.cle + ') | ' + euros(x.total) + ' | ' + x.fois
        + ' | ' + x.dernier + ' | ' + (moisAvant.has(x.cle) ? '' : 'oui') + ' |');
    }
  }
  W('');
  if (nouveaux.length) {
    W('**' + nouveaux.length + ' nouveau' + (nouveaux.length > 1 ? 'x' : '') + ' ce mois-ci.**');
    W('');
  }
  W('---');
  W('');
  W('Periode lue : du ' + bornes.debut.slice(0, 10) + ' au ' + bornes.fin.slice(0, 10)
    + ', comparee au mois precedent.');
  W('Source : les encaissements PayPal. Ni la base, ni les dossiers, ni aucune donnee de sante.');
  return L.join('\n') + '\n';
}

// ── DES DONNEES INVENTEES, POUR VOIR LE RAPPORT SANS IDENTIFIANTS ───────
function jeuDEssai() {
  const j = n => new Date(Date.now() - n * 86400000).toISOString();
  const t = (mail, nom, val, date) => ({
    transaction_info: { transaction_amount: { value: String(val), currency_code: 'EUR' },
      transaction_status: 'S', transaction_initiation_date: date, transaction_subject: 'RepCore' },
    payer_info: { email_address: mail, payer_name: { alternate_full_name: nom } },
  });
  return {
    ceMois: [t('julie@example.com', 'Julie Martin', 24.90, j(9)),
             t('marc@example.com', 'Marc Tellier', 9.95, j(14)),
             t('sofia@example.com', 'Sofia Ben', 249.00, j(3))],
    avant:  [t('julie@example.com', 'Julie Martin', 24.90, j(39)),
             t('marc@example.com', 'Marc Tellier', 9.95, j(44)),
             t('karim@example.com', 'Karim Diallo', 24.90, j(41))],
  };
}

async function principal() {
  const fin = new Date();
  const debut = new Date(fin.getTime() - 30 * 86400000);
  const finAvant = new Date(debut.getTime() - 1000);
  const debutAvant = new Date(finAvant.getTime() - 30 * 86400000);
  const bornes = { debut: debut.toISOString(), fin: fin.toISOString(), libelleMois: mois(fin) };

  let brutMois, brutAvant;
  if (ESSAI) {
    const j = jeuDEssai();
    brutMois = j.ceMois; brutAvant = j.avant;
    console.log('\n  ESSAI : donnees inventees, PayPal n\'est pas appele.\n');
  } else {
    if (!CLIENT_ID) throw new Error('Aucun identifiant client : donne PAYPAL_CLIENT_ID.');
    const secret = process.env.PAYPAL_CLIENT_SECRET || await demanderSecret();
    if (!secret) throw new Error('Aucun secret : rien n\'a ete lu.');
    const tok = await jeton(secret);
    brutMois = await encaissements(tok, debut, fin);
    brutAvant = await encaissements(tok, debutAvant, finAvant);
  }

  const texte = rapport(parPayeur(brutMois), parPayeur(brutAvant), bornes);
  writeFileSync(SORTIE, texte, 'utf8');
  console.log(texte);
  console.log('  Ecrit dans ' + SORTIE + '\n');
}

principal().catch(e => {
  console.error('\n  ECHEC : ' + e.message + '\n');
  process.exitCode = 1;
});
