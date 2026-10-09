#!/usr/bin/env node
// LES PRIX AFFICHÉS SONT CEUX DE tarifs.json, PARTOUT.
//
// LA PANNE. La page de vente a déjà annoncé un autre prix, et « sans
// engagement », pendant que l'app et PayPal encaissaient ceux de tarifs.json
// sur douze mois. Rien ne le disait : chaque fichier était juste avec lui-même.
//
// CE QUE CE CONTRÔLE REFUSE :
//   1. un tarifs.json incohérent (annuel ≠ 12 mensualités, demi-tarif faux…) ;
//   2. une copie en retard : le bloc TARIFS de rc-core, un montant lié
//      (data-tarif, data-nb, data-tarif-m/a) de index.html, terms.html ou
//      aide-apk.html qui ne vaut plus ce que dit tarifs.json ;
//   3. un montant en euros ÉCRIT EN DUR dans ces pages, lié à aucune clé
//      (sauf data-hors-tarif : un prix du marché, pas le nôtre) ;
//   4. OFFRES et COACH_PALIERS, évalués tels quels, qui ne rendent pas les
//      prix de tarifs.json ;
//   5. une phrase d'engagement contraire à tarifs.json (« sans engagement »
//      quand il y en a un, « engagement N mois » quand il n'y en a pas) sur
//      la page de vente, /i et l'app ; un « N mois
//      d'essai » qui n'est ni l'essai ni l'essai parrainé (balises meta
//      comprises) ;
//   6. UN MONTANT EN EUROS QUI NE VAUT AUCUN PRIX DE tarifs.json, où qu'il
//      soit dans index.html, i/, c/, app/index.html, terms.html, legal.html,
//      aide-apk.html — texte, attribut, script, JSON-LD (« price ») —, lié ou
//      non, sauf s'il figure dans LISTE_BLANCHE ci-dessous (un exemple, un
//      prix du marché), qui dit pourquoi. Une entrée de la liste blanche qui
//      ne sert plus fait aussi échouer : elle masquerait le prochain écart.
// Et il se prouve : un prix faussé exprès, un prix ajouté en dur, doivent
// être vus.
//   node scripts/verif/tarifs.mjs
import { readFileSync } from 'node:fs';
import { RACINE, PAGES, lireTarifs, valeur, appliquerPage, appliquerApp, fichierCore, incoherences, montantsTarifs, moisOfferts } from '../tarifs.mjs';

const T = lireTarifs();
const erreurs = [];
const e = (m) => erreurs.push(m);

// ── 1. tarifs.json ────────────────────────────────────────────────────────
for (const x of incoherences(T)) e('tarifs.json : ' + x);

// ── 2 et 3. Les pages ─────────────────────────────────────────────────────
// Ce qui reste d'une page une fois retirés les montants liés et les prix du
// marché : il ne doit plus y avoir un seul euro.
function montantsLibres(html) {
  let s = html
    .replace(/<(input|img|meta)\b[^>]*\bdata-hors-tarif\b[^>]*>/gi, ' ')
    .replace(/<([a-z0-9]+)\b[^>]*\bdata-(tarif|nb|hors-tarif)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[a-z0-9]+\b[^>]*\bdata-tarif-[ma]="[^"]*"[^>]*>/gi, (b) => b.replace(/\bdata-[ma]="[^"]*"/g, ''));
  const trouves = [];
  const re = /\d[\d  .,]*(?:&nbsp;|\s| )?€/g;
  let m;
  while ((m = re.exec(s))) {
    const ligne = s.slice(0, m.index).split('\n').length;
    trouves.push(m[0].replace(/&nbsp;| /g, ' ').trim() + ' (vers la ligne ' + ligne + ')');
  }
  return trouves;
}
const texteVisible = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ');
function controlerPage(nom, html) {
  const err = [];
  if (appliquerPage(html, T) !== html) err.push(nom + ' : un montant lié ne vaut plus ce que dit tarifs.json — lance node scripts/tarifs.mjs');
  for (const x of montantsLibres(html)) err.push(nom + ' : prix écrit en dur, lié à aucune clé de tarifs.json : ' + x);
  // L'ENGAGEMENT SUIT tarifs.json, DANS LES DEUX SENS. Avec un engagement,
  // « sans engagement » est une promesse fausse ; sans engagement, un
  // « engagement N mois » l'est aussi — sauf celui des contrats déjà engagés
  // (data-nb="contrats_engages.…"), qui restent vrais pour ceux qui les ont.
  if (['index.html', 'i/index.html', 'app/index.html', 'terms.html'].includes(nom)) {
    const sansAnciens = html.replace(/<span data-nb="contrats_engages\.[^"]+">[^<]*<\/span>/g, 'N');
    const vis = texteVisible(sansAnciens.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script\b[\s\S]*?<\/script>/gi, ' '));
    if (T.engagementMois > 0 && /sans engagement/i.test(vis))
      err.push(nom + ' : « sans engagement » — l’abonnement engage pour ' + T.engagementMois + ' mois (tarifs.json)');
    if (T.engagementMois === 0)
      for (const m of vis.matchAll(/engag\w*\s+(?:de\s+|pour\s+|sur\s+)?(\d+)\s*mois|(\w+|\d+)\s+mois\s+d'engagement/gi))
        err.push(nom + ' : « ' + m[0] + ' » — tarifs.json dit sans engagement (engagementMois : 0)');
  }
  if (nom === 'index.html') {
    // Les balises meta (description, og, twitter) ne portent pas de data-nb :
    // leur « N mois d'essai » est lu ici comme le texte visible.
    const attributs = [...html.matchAll(/\b(?:content|alt|aria-label)="([^"]*)"/g)].map((m) => m[1]).join(' · ');
    for (const m of attributs.replace(/&nbsp;/g, ' ').matchAll(/(\d+) mois d'essai|(\d+) mois offert/g))
      if (Number(m[1] || m[2]) !== T.essai.mois) err.push('index.html (balise meta) : « ' + m[0] + ' » — l’essai dure ' + T.essai.mois + ' mois');
    // Les mois offerts de l'ANNUEL (liés à tarifs.json) ne sont pas ceux de l'essai.
    const vis = texteVisible(html.replace(/<([a-z0-9]+)\b[^>]*\bdata-(?:nb="[a-z_]+\.moisOfferts"|texte="[a-z_]+\.offreAn")[^>]*>[^<]*<\/\1>/gi, ' '));
    const permis = [T.essai.mois, valeur(T, 'essai.moisParraine')];
    for (const m of vis.matchAll(/(\d+) mois d'essai/g))
      if (!permis.includes(Number(m[1]))) err.push('index.html : « ' + m[0] + ' » — l’essai dure ' + permis.join(' ou ') + ' mois');
    // Les boutons disent « 1 mois » en clair (un <span> dans un bouton le coupe en colonnes).
    for (const m of vis.matchAll(/Essayer (?:gratuitement )?(\d+) mois|(\d+) mois offert/g))
      if (Number(m[1] || m[2]) !== T.essai.mois) err.push('index.html : « ' + m[0] + ' » — l’essai dure ' + T.essai.mois + ' mois');
    for (const m of vis.matchAll(/(\d+) mois si un ami/g))
      if (Number(m[1]) !== permis[1]) err.push('index.html : « ' + m[0] + ' » — l’essai parrainé dure ' + permis[1] + ' mois');
    // La grille dit l'engagement et les mois offerts de l'annuel par tarifs.json.
    for (const t of ['engagement', 'essentielle.offreAn', 'ultime.offreAn'])
      if (!html.includes('data-texte="' + t + '"')) err.push('index.html : la grille ne lie plus « ' + t + ' » (data-texte)');
  }
  return err;
}
for (const p of PAGES) {
  let html;
  try { html = readFileSync(RACINE + p, 'utf8'); } catch (x) { e(p + ' illisible'); continue; }
  erreurs.push(...controlerPage(p, html));
}
// ── 6. Chaque euro affiché vaut un prix de tarifs.json ─────────────────────
// LA LISTE BLANCHE, EXPLICITE : fichier, montants, et pourquoi ils ne sont pas
// les nôtres. Rien d'autre n'y entre sans une raison écrite.
const LISTE_BLANCHE = Object.freeze([
  Object.freeze({ fichier: 'index.html', montants: [400, 640], pourquoi: 'prix du marché : coach en salle, 2 séances par semaine (comparatif)' }),
  Object.freeze({ fichier: 'app/index.html', montants: [50, 80, 400, 640], pourquoi: 'ancrage : un coach en salle, 50 à 80 € la séance, 400 à 640 € par mois' }),
  Object.freeze({ fichier: 'app/index.html', montants: [49, 20], pourquoi: 'exemple dans le champ de saisie du prix d’un programme vendu par un coach (placeholder)' }),
]);
export const FICHIERS_MONTANTS = ['index.html', 'i/index.html', 'c/index.html', 'app/index.html', 'terms.html', 'legal.html', 'aide-apk.html'];
const NB = '(\\d+(?:[.,]\\d+)?)', SEP = '(?:\\s|&nbsp;|\\u00a0|\\u202f)*';
const RE_EUROS = new RegExp(NB + '(?:' + SEP + '(?:à|et)' + SEP + NB + ')?' + SEP + '(?:€|&euro;|EUR\\b)', 'g');
const lireNb = (x) => Number(String(x).replace(',', '.'));
// Les montants d'une page : [{montant, ligne, extrait}].
function montantsPage(html) {
  const l = [];
  const ajouter = (n, i, extrait) => l.push({ montant: lireNb(n), ligne: html.slice(0, i).split('\n').length, extrait });
  for (const m of html.matchAll(RE_EUROS)) {
    ajouter(m[1], m.index, m[0]);
    if (m[2]) ajouter(m[2], m.index, m[0]);
  }
  for (const m of html.matchAll(/"price"\s*:\s*"?(\d+(?:\.\d+)?)"?/g)) ajouter(m[1], m.index, m[0]);
  return l;
}
function montantsInconnus(nom, html, T, blanche) {
  const permis = new Set(montantsTarifs(T).map((n) => Math.round(n * 100)));
  const err = [];
  for (const x of montantsPage(html)) {
    const c = Math.round(x.montant * 100);
    if (permis.has(c)) continue;
    const b = blanche.find((w) => w.fichier === nom && w.montants.some((n) => Math.round(n * 100) === c));
    if (b) { b.servi = true; continue; }
    err.push(nom + ' : ' + String(x.montant).replace('.', ',') + ' € (vers la ligne ' + x.ligne + ', « ' + x.extrait.replace(/&nbsp;/g, ' ') + ' ») ne vaut aucun prix de tarifs.json, et n’est pas dans la liste blanche');
  }
  return err;
}
{
  // Une entrée par montant : chacune doit servir.
  const blanche = LISTE_BLANCHE.flatMap((w) => w.montants.map((n) => ({ fichier: w.fichier, montants: [n], pourquoi: w.pourquoi, servi: false })));
  for (const f of FICHIERS_MONTANTS) {
    let html;
    try { html = readFileSync(RACINE + f, 'utf8'); } catch (x) { e(f + ' illisible'); continue; }
    erreurs.push(...montantsInconnus(f, html, T, blanche));
  }
  for (const w of blanche) if (!w.servi) e('liste blanche : ' + w.montants[0] + ' € dans ' + w.fichier + ' (« ' + w.pourquoi + ' ») ne sert plus — retire-le');
  // Le contrôle se prouve : un montant faux, même rangé dans un data-hors-tarif ou
  // dans le JSON-LD, est vu ; un prix de tarifs.json passe.
  const html = readFileSync(RACINE + 'index.html', 'utf8');
  const vide = () => [];
  if (!montantsInconnus('index.html', html.replace('</body>', '<p data-hors-tarif>12,34&nbsp;€</p></body>'), T, vide()).some((x) => /12,34/.test(x)))
    e('auto-contrôle : un montant inconnu dans un data-hors-tarif n’est pas vu');
  if (!montantsInconnus('index.html', html.replace(/("name": "Essentielle", "price": ")[^"]*/, '$19.95'), T, vide()).some((x) => /9,95/.test(x)))
    e('auto-contrôle : un « price » faux dans le JSON-LD n’est pas vu');
  if (!montantsInconnus('i/index.html', '<p>puis 24,90&nbsp;€ ou 7 à 8 € par mois</p>', T, vide()).some((x) => /\b7 €/.test(x)))
    e('auto-contrôle : le premier nombre d’une fourchette « 7 à 8 € » n’est pas vu');
  if (montantsInconnus('i/index.html', '<p>' + valeur(T, 'ultime.mois') + ' €</p>', T, vide()).length)
    e('auto-contrôle : un prix de tarifs.json est refusé');
}

// Les deux montants de la grille, et l'annuel, y sont bien.
{
  const html = readFileSync(RACINE + 'index.html', 'utf8');
  for (const cle of ['essentielle.mois', 'ultime.mois'])
    if (!new RegExp('data-tarif="' + cle.replace('.', '\\.') + '"').test(html)) e('index.html : la grille ne montre plus ' + cle);
  for (const cle of ['essentielle.an', 'ultime.an'])
    if (!new RegExp('data-tarif-a="' + cle.replace('.', '\\.') + '"').test(html)) e('index.html : la bascule ne montre plus ' + cle);
}

// ── Le contrôle se prouve ─────────────────────────────────────────────────
{
  const html = readFileSync(RACINE + 'index.html', 'utf8');
  const fausse = html.replace('<span data-tarif="essentielle.mois">9,50&nbsp;€</span>', '<span data-tarif="essentielle.mois">9,95&nbsp;€</span>');
  if (fausse === html) e('auto-contrôle : le prix d’Essentielle n’est plus lié dans la grille');
  else if (!controlerPage('index.html', fausse).some((x) => /ne vaut plus/.test(x))) e('auto-contrôle : un prix faussé n’est pas vu');
  const enDur = html.replace('</main>', '<p>Offre : 49&nbsp;€ par mois</p></main>');
  const enDur2 = enDur === html ? html.replace('</body>', '<p>Offre : 49&nbsp;€ par mois</p></body>') : enDur;
  if (!controlerPage('index.html', enDur2).some((x) => /49 €/.test(x))) e('auto-contrôle : un prix écrit en dur n’est pas vu');
  // La FAQ des données structurées suit la FAQ visible : une réponse changée
  // à l'écran et pas dans le JSON-LD est vue.
  const k = html.lastIndexOf('ton accès reste ouvert jusque-là');   // la dernière : celle de <section id="faq">
  const faqChangee = k < 0 ? html : html.slice(0, k) + 'ton accès reste ouvert jusqu’au bout' + html.slice(k + 'ton accès reste ouvert jusque-là'.length);
  if (faqChangee === html) e('auto-contrôle : la réponse « Puis-je annuler ? » a changé — adapter ce contrôle');
  else if (!controlerPage('index.html', faqChangee).some((x) => /ne vaut plus/.test(x))) e('auto-contrôle : une FAQ JSON-LD en retard sur la FAQ visible n’est pas vue');
  const contraire = T.engagementMois > 0 ? '<p>sans engagement</p>' : '<p>Engagement de 12&nbsp;mois</p>';
  if (!controlerPage('index.html', html.replace('</body>', contraire + '</body>')).some((x) => /engagement/i.test(x)))
    e('auto-contrôle : une phrase d’engagement contraire à tarifs.json n’est pas vue');
  if (!controlerPage('app/index.html', '<p>coûte ensuite 9,50&nbsp;€, sur douze mois d\'engagement.</p>').some((x) => /engagement/.test(x)) && T.engagementMois === 0)
    e('auto-contrôle : « douze mois d’engagement » en toutes lettres n’est pas vu');
}

// ── 2 et 4. L'app ─────────────────────────────────────────────────────────
{
  const chemin = fichierCore();
  const code = readFileSync(chemin, 'utf8');
  const nom = chemin.slice(RACINE.length);
  let ok = true;
  try { if (appliquerApp(code, T) !== code) { ok = false; e(nom + ' : le bloc TARIFS n’est pas la copie de tarifs.json — lance node scripts/tarifs.mjs'); } }
  catch (x) { ok = false; e(nom + ' : ' + x.message); }
  if (ok) {
    // Évalués tels quels : le bloc TARIFS, OFFRES, COACH_PALIERS, ESSAI_JOURS.
    const bloc = (debut, fin) => {
      const i = code.indexOf(debut); if (i < 0) throw new Error(debut + ' introuvable');
      const j = code.indexOf(fin, i); if (j < 0) throw new Error('fin de ' + debut + ' introuvable');
      return code.slice(i, j + fin.length);
    };
    try {
      const src = [bloc('/* TARIFS:DEBUT */', '/* TARIFS:FIN */'), bloc('const _TC=', ';'),
        bloc('const OFFRES=Object.freeze({', '\n});'), 'var PAYPAL_PLAN_ID_COACH="",PAYPAL_PLAN_ID_PRO="";',
        bloc('const COACH_PLANS=', ';'), bloc('const QUOTAS_COACH=(function(){', '})();'),
        bloc('const COACH_PALIERS=Object.freeze([', '\n]);'), bloc('const ESSAI_JOURS=', ';')].join('\n');
      // eslint-disable-next-line no-new-func
      const r = new Function(src + '\nreturn {OFFRES, COACH_PALIERS, ESSAI_JOURS, QUOTAS_COACH};')();
      const attendu = [
        ['OFFRES.essentielle.prix', r.OFFRES.essentielle.prix, T.essentielle.mois],
        ['OFFRES.essentielle.prixAn', r.OFFRES.essentielle.prixAn, T.essentielle.an],
        ['OFFRES.ultime.prix', r.OFFRES.ultime.prix, T.ultime.mois],
        ['OFFRES.ultime.prixAn', r.OFFRES.ultime.prixAn, T.ultime.an],
        ['OFFRES.ultime_demi.prix', r.OFFRES.ultime_demi.prix, T.ultime_demi.premierMois],
        ['OFFRES.essai.mois', r.OFFRES.essai.mois, T.essai.mois],
        ['OFFRES.essai_parrainage.mois', r.OFFRES.essai_parrainage.mois, T.essai_parrainage.moisEnPlus],
        ['ESSAI_JOURS', r.ESSAI_JOURS, T.essai.jours],
        ...['libre', 'coach', 'pro'].map((k) => ['COACH_PALIERS.' + k, (r.COACH_PALIERS.find((p) => p.cle === k) || {}).prix, T.coach[k]]),
        ...Object.keys(T.coaching).map((k) => ['OFFRES.' + k, r.OFFRES[k] && r.OFFRES[k].prix, T.coaching[k].prix]),
        // LES QUOTAS COACH : null dans le JSON, Infinity dans l'app.
        ...['libre', 'coach', 'pro'].flatMap((k) => {
          const q = T.quotas_coach[k], a = q.athletes === null ? Infinity : q.athletes;
          return [['QUOTAS_COACH.' + k + '.athletes', r.QUOTAS_COACH[k].athletes, a],
            ['QUOTAS_COACH.' + k + '.moisCode', r.QUOTAS_COACH[k].moisCode, q.moisCode],
            ['COACH_PALIERS.' + k + '.quota', (r.COACH_PALIERS.find((p) => p.cle === k) || {}).quota, a]];
        }),
      ];
      for (const [quoi, vu, voulu] of attendu) if (vu !== voulu) e(nom + ' : ' + quoi + ' vaut ' + vu + ', tarifs.json dit ' + voulu);
    } catch (x) { e(nom + ' : OFFRES illisible (' + x.message + ')'); }
    // LES MOIS OFFERTS DE L'ANNUEL : l'app (moisOffertsDe) et la page de vente
    // (moisOfferts de scripts/tarifs.mjs) font le MÊME calcul.
    try {
      // eslint-disable-next-line no-new-func
      const appli = new Function(bloc('function moisOffertsDe(', '\n}') + '\nreturn moisOffertsDe;')();
      for (const [m, a] of [[9.5, 95], [24.9, 249], [24.9, 298.8], [10, 110], [10, 106], [10, 130], [10, 0], [T.essentielle.mois, T.essentielle.an], [T.ultime.mois, T.ultime.an]])
        if (appli(m, a) !== moisOfferts(m, a)) e(nom + ' : moisOffertsDe(' + m + ', ' + a + ') = ' + appli(m, a) + ', la page de vente calcule ' + moisOfferts(m, a));
    } catch (x) { e(nom + ' : moisOffertsDe illisible (' + x.message + ')'); }
    // Aucun prix d'abonnement en dur dans OFFRES.
    const offres = code.slice(code.indexOf('const OFFRES=Object.freeze({'), code.indexOf('\n});', code.indexOf('const OFFRES=Object.freeze({')));
    if (/\bprix(An)?:\s*[1-9][0-9.]*/.test(offres)) e(nom + ' : un prix écrit en dur dans OFFRES — il doit venir de TARIFS');
    if (/moisApres\(Date\.now\(\),\s*12\)/.test(code)) e(nom + ' : la fin d’engagement est écrite en dur (12) au lieu de TARIFS.engagementMois');
  }
}

// ── 7. La durée des codes, tenue AUSSI par le serveur ───────────────────────
// database.rules.json refuse un code plus long que la formule du coach
// (rc_codes/$code/months, lu sur coach_paliers/). Les valeurs doivent être
// celles de tarifs.json → quotas_coach.
{
  const regles = readFileSync(RACINE + 'database.rules.json', 'utf8');
  const m = regles.match(/"months":\s*\{\s*"\.validate":\s*"([^"]*)"/);
  if (!m) e('database.rules.json : rc_codes/$code/months n’a plus de .validate');
  else {
    const v = m[1];
    const Q = T.quotas_coach;
    if (!v.includes('newData.val() <= ' + Q.libre.moisCode + ' ||')) e('database.rules.json : la durée Libre (' + Q.libre.moisCode + ' mois) n’est pas celle de tarifs.json');
    for (const k of ['coach', 'pro'])
      if (!v.includes('newData.val() <= ' + Q[k].moisCode + " && root.child('coach_paliers').child(auth.token.email.replace('.', ',')).child('palier').val() === '" + k + "'"))
        e('database.rules.json : la durée ' + k + ' (' + Q[k].moisCode + ' mois) n’est pas celle de tarifs.json');
  }
}

if (erreurs.length) {
  console.error('PRIX INCOHÉRENTS (' + erreurs.length + ') :\n  ' + erreurs.join('\n  '));
  process.exit(1);
}
console.log('Prix : l’app, ' + PAGES.join(', ') + ' suivent tarifs.json (Essentielle ' + T.essentielle.mois + ' / ' + T.essentielle.an
  + ', Ultime ' + T.ultime.mois + ' / ' + T.ultime.an + ', essai ' + T.essai.mois + ' mois, parrainé ' + valeur(T, 'essai.moisParraine') + '). Chaque euro de '
  + FICHIERS_MONTANTS.join(', ') + ' vaut un prix de tarifs.json ou figure dans la liste blanche (' + LISTE_BLANCHE.length + ' entrées). Le contrôle voit un prix faussé, un prix en dur et un montant inconnu.');
