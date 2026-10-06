/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — liaison Resamania ════════════════════════════════════════
//
// D'apres l'audit Resamania du 05/10/2026. Deux familles d'exports :
//  - les LISTES (menus Clients, Donnees financieres) : CSV UTF-8, « ; »,
//    dates AAAA-MM-JJ, PLAFONNEES A 2 000 LIGNES (tronquees sans avertissement) ;
//  - les EXPORTS DE GESTION : ZIP, ISO-8859-15, dates JJ/MM/AAAA ou JJ-MM-AAAA,
//    sans plafond, avec commercial actuel ET initial.
// Chaque fichier est reconnu par ses colonnes (jamais par son nom seul).
// Chaque ligne recoit une cle stable : reimporter le meme fichier, ou deux
// exports qui se recouvrent, ne cree jamais de doublon.

// ── Lecture de fichiers : CSV, XLSX, ZIP ──────────────────────────────────
// Bibliotheques hebergees sur le site (vendor/) : SheetJS 0.20.3 (corrige les
// failles CVE-2023-30533 et CVE-2024-22363 de la 0.18.5), JSZip 3.10.1.
const LIBS = {
  jszip: 'vendor/jszip.min.js',
  xlsx: 'vendor/xlsx.full.min.js',
};
const libLoaded = {};
function loadLib(k) {
  if (!libLoaded[k]) libLoaded[k] = new Promise((ok, ko) => { const s = document.createElement('script'); s.src = LIBS[k]; s.onload = ok; s.onerror = () => ko(new Error('Bibliothèque indisponible : ' + k)); document.head.appendChild(s); });
  return libLoaded[k];
}
// UTF-8 d'abord ; UTF-16 si l'en-tete l'annonce (Excel « Texte Unicode ») ;
// sinon Windows-1252 si des octets 0x80-0x9F apparaissent (CSV enregistre par
// Excel sous Windows : « € » = 0x80, « ’ » = 0x92), et ISO-8859-15 pour les
// exports de gestion Resamania (le « € » y vaut 0xA4).
function decodeBytes(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (u8[0] === 0xff && u8[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(u8), encoding: 'UTF-16' };
  if (u8[0] === 0xfe && u8[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(u8), encoding: 'UTF-16' };
  // UTF-16 sans en-tete : un octet nul sur deux
  const n = Math.min(u8.length, 400); let z0 = 0, z1 = 0; for (let i = 0; i < n; i++) if (!u8[i]) { if (i % 2) z1++; else z0++; }
  if (n > 8 && z1 > n / 4 && z0 < n / 40) return { text: new TextDecoder('utf-16le').decode(u8), encoding: 'UTF-16' };
  if (n > 8 && z0 > n / 4 && z1 < n / 40) return { text: new TextDecoder('utf-16be').decode(u8), encoding: 'UTF-16' };
  try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(u8), encoding: 'UTF-8' }; }
  catch (e) {
    for (let i = 0; i < u8.length; i++) if (u8[i] >= 0x80 && u8[i] <= 0x9f) return { text: new TextDecoder('windows-1252').decode(u8), encoding: 'Windows-1252' };
    return { text: new TextDecoder('iso-8859-15').decode(u8), encoding: 'ISO-8859-15' };
  }
}
// Lecture cellule par cellule : une date Excel devient AAAA-MM-JJ d'apres son
// numero de serie (jamais le texte « m/d/yy » que SheetJS affiche, qui
// inversait jour et mois) ; un nombre garde sa valeur exacte, sans format.
async function readXlsx(name, buf) {
  await loadLib('xlsx');
  const wb = XLSX.read(buf, { type: 'array', cellDates: false, cellNF: true, cellFormula: false, cellHTML: false, dense: false });
  const p2 = n => String(n).padStart(2, '0');
  return wb.SheetNames.map(sn => {
    const ws = wb.Sheets[sn];
    if (!ws['!ref']) return tableFromAoa(`${name} › ${sn}`, [], 'XLSX');
    const R = XLSX.utils.decode_range(ws['!ref']); const aoa = [];
    for (let r = R.s.r; r <= R.e.r; r++) {
      const row = [];
      for (let c = R.s.c; c <= R.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (!cell || cell.v == null) { row.push(''); continue; }
        if (cell.t === 'd' && cell.v instanceof Date) row.push(`${cell.v.getFullYear()}-${p2(cell.v.getMonth() + 1)}-${p2(cell.v.getDate())}`);
        else if (cell.t === 'n' && cell.z && XLSX.SSF.is_date(cell.z)) { const d = XLSX.SSF.parse_date_code(cell.v); row.push(d ? `${d.y}-${p2(d.m)}-${p2(d.d)}` : String(cell.v)); }
        else if (cell.t === 'n') row.push(String(cell.v).replace('.', ','));
        else if (cell.t === 'b') row.push(cell.v ? 'VRAI' : 'FAUX');
        else row.push(String(cell.v));
      }
      aoa.push(row);
    }
    return tableFromAoa(`${name} › ${sn}`, aoa, 'XLSX');
  });
}
function tableFromAoa(name, aoa, encoding) {
  const rows = aoa.map(r => r.map(c => String(c ?? '').trim())).filter(r => r.some(Boolean));
  // l'en-tete est la premiere ligne qui a au moins deux cellules remplies
  let h = 0; while (h < rows.length - 1 && rows[h].filter(Boolean).length < 2) h++;
  const headers = rows[h] || [];
  return { name, encoding, headers, rows: rows.slice(h + 1).map(r => headers.map((_, i) => r[i] || '')) };
}
// Extensions ET types MIME : sur Android, un CSV venu de Gmail ou Drive est
// souvent typé « text/comma-separated-values » ou « application/vnd.ms-excel »
// et restait grisé dans le sélecteur quand seules les extensions étaient listées.
const FILE_ACCEPT = '.csv,.tsv,.txt,.zip,.xlsx,.xls,.ods,text/csv,text/plain,text/tab-separated-values,text/comma-separated-values,application/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet,application/zip,application/x-zip-compressed';
const MAX_FICHIER = 20 * 1024 * 1024, MAX_DEZIP = 200 * 1024 * 1024;
async function zipIsSheet(buf) { await loadLib('jszip'); const z = await JSZip.loadAsync(buf); return !!(z.file('[Content_Types].xml') || z.file('mimetype')); }
async function readAnyFile(file) {
  if (file.size > MAX_FICHIER) return [{ name: file.name, skipped: 'Fichier trop lourd (plus de 20 Mo) : ignoré' }];
  const buf = new Uint8Array(await file.arrayBuffer());
  const lower = file.name.toLowerCase();
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b, isOle = buf[0] === 0xd0 && buf[1] === 0xcf;
  // Classeur Excel/LibreOffice reconnu à son contenu (un .csv renommé, un .xlsx sans extension)
  if (/\.(xlsx|xlsm|xls|ods)$/.test(lower) || isOle || (isZip && !lower.endsWith('.zip') && await zipIsSheet(buf))) return readXlsx(file.name, buf);
  if (lower.endsWith('.zip') || isZip) {
    await loadLib('jszip');
    const zip = await JSZip.loadAsync(buf);
    const out = []; let total = 0;
    for (const entry of Object.values(zip.files)) {
      if (entry.dir || /(^|\/)(__MACOSX|\.)/.test(entry.name)) continue;
      const data = await entry.async('uint8array');
      total += data.length;
      if (total > MAX_DEZIP) { out.push({ name: file.name, skipped: 'Archive trop volumineuse une fois décompressée : arrêtée' }); break; }
      const n = `${file.name} › ${entry.name.split('/').pop()}`;
      if (/\.(xlsx|xls|ods)$/i.test(entry.name)) out.push(...await readXlsx(n, data));
      else if (/\.(csv|tsv|txt)$/i.test(entry.name)) { const d = decodeBytes(data); out.push({ name: n, encoding: d.encoding, ...parseCSV(d.text) }); }
      else out.push({ name: n, skipped: 'Fichier non tabulaire (PDF…) : ignoré' });
    }
    return out;
  }
  const d = decodeBytes(buf);
  return [{ name: file.name, encoding: d.encoding, ...parseCSV(d.text) }];
}

// ── Outils de lecture ─────────────────────────────────────────────────────
const rsmDate = s => parseDate(s);
const rsmNum = s => toNum(s);
// cle courte et stable a partir d'un texte (FNV-1a sur 2 x 32 bits)
function hkey(str) {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); a = Math.imul(a ^ c, 16777619) >>> 0; b = Math.imul(b ^ c, 2246822519) >>> 0; }
  return a.toString(36) + b.toString(36);
}
const tokensKey = s => norm(s).split(' ').filter(Boolean).sort().join(' ');
// Firebase refuse . # $ / [ ] dans une cle
const safeKey = k => String(k).replace(/[.#$/\[\]]/g, ',');

// ── Annuaire des commerciaux ──────────────────────────────────────────────
// Resamania ecrit le meme vendeur de quatre facons : « NOM Prénom »,
// « Prénom NOM <email> », « Prénom NOM <email> {id} », ou un code trigramme
// (KGUE). Les correspondances validees sont gardees dans S.rsm.aliases :
// cle -> id de membre, 'system' (vente en ligne / automatique) ou 'ignore'.
const SYSTEM_SELLERS = ['traitement automatique', 'automatismes', 'automatique', 'site web fitness park public', 'pso site', 'spso', 'en ligne', 'fitness park backoffice mobile', 'espace membre fitnesspark public', 'qualite de la donnee', 'site', 'web', 'borne'];
function sellerKeys(raw, code) {
  raw = String(raw || '').trim();
  const email = (raw.match(/<([^>]+)>/) || [])[1];
  const uid = (raw.match(/\{(\d+)\}/) || [])[1];
  const name = raw.replace(/<[^>]*>/g, '').replace(/\{[^}]*\}/g, '').trim();
  const keys = [];
  if (email) keys.push('e:' + email.toLowerCase());
  if (uid) keys.push('i:' + uid);
  if (code) keys.push('c:' + String(code).trim().toUpperCase());
  if (name) keys.push('n:' + tokensKey(name));
  return { keys, email, name: name || code || email || '', label: raw || code || '' };
}
function resolveSeller(raw, code) {
  const k = sellerKeys(raw, code);
  if (!k.keys.length) return { status: 'system', label: '(vide)' };
  const nm = norm(k.name);
  if (SYSTEM_SELLERS.includes(nm) || (code && String(code).toUpperCase() === 'SPSO')) return { status: 'system', label: k.label };
  const al = (S.rsm && S.rsm.aliases) || {};
  for (const key of k.keys) {
    const v = al[safeKey(key)];
    if (v === 'system' || v === 'ignore') return { status: v, label: k.label };
    if (v && S.users[v]) return { status: 'user', userId: v, label: k.label };
  }
  const users = Object.values(S.users).filter(u => u.role !== 'createur');
  if (k.email) { const u = users.find(x => (x.email || '').toLowerCase() === k.email.toLowerCase()); if (u) return { status: 'user', userId: u.id, label: k.label }; }
  if (k.name) { const t = tokensKey(k.name); const u = users.find(x => tokensKey(`${x.first} ${x.last}`) === t); if (u) return { status: 'user', userId: u.id, label: k.label }; }
  return { status: 'unknown', key: k.keys[0], keys: k.keys, label: k.label };
}

// ── Classement des regularisations d'impayes par canal ────────────────────
const RECOV_CHANNELS = {
  equipe: { label: 'Équipe du club', hint: 'Encaissé à l’accueil, lien de paiement ou CB à distance par un membre de l’équipe', color: 'var(--d-1)', human: true },
  client: { label: 'Client en ligne', hint: 'Payé par le client lui-même depuis son espace adhérent', color: 'var(--d-2)', human: false },
  auto: { label: 'Prélèvement automatique', hint: '« Traitement automatique » : nouveau prélèvement ou re-présentation', color: 'var(--d-3)', human: false },
  automatismes: { label: 'Automatismes', hint: 'Règle système « Automatismes » (prélèvement CB ou clôture automatique)', color: 'var(--d-4)', human: false },
  tiers: { label: 'Tiers / autre', hint: 'Tiers payeur, huissier ou auteur non identifié', color: 'var(--d-5)', human: false },
};
function recovChannel(author, clientName) {
  const n = norm(String(author || '').replace(/<[^>]*>/g, '').replace(/\{[^}]*\}/g, ''));
  if (!n) return { canal: 'tiers' };
  if (n.includes('traitement automatique')) return { canal: 'auto' };
  if (n.includes('automatisme')) return { canal: 'automatismes' };
  const s = resolveSeller(author);
  if (s.status === 'user') return { canal: 'equipe', seller: s };
  if (clientName && tokensKey(n) === tokensKey(clientName)) return { canal: 'client' };
  if (s.status === 'system') return { canal: 'client' };
  // un e-mail inconnu : membre d'equipe pas encore rattache, ou tiers payeur
  return { canal: 'equipe', seller: s, maybeTiers: true };
}

// ── Definitions des exports ───────────────────────────────────────────────
// sig(has) : reconnaissance par colonnes. parse(c) : lignes -> donnees.
const PRODUCT_EXCLUDE = ['changement d offre', 'acces employe', 'vip', 'reconduction', 'transfert'];
const TECH_MOTIFS = ['changement de formule', 'resiliation pack option', 'transfert', 'erreur de migration'];
const isNutrition = (fam, code, label) => norm(fam).includes('nutrition') || /NUTRI/i.test(code || '') || /nutri/i.test(norm(label));
const isAccessory = code => /(^|_)FPARK$/i.test(String(code || '').trim());

const RSM_DEFS = [
  {
    id: 'ventes', label: 'Vente d’abonnements', family: 'gestion', feeds: 'Contrats signés (commercial initial) · nouveaux adhérents J+15 / J+30',
    path: 'Exports de gestion > Exporter > Membres & Ventes > Vente d’abonnements', filters: 'Date de début = 1er du mois (ou J-30), Date de fin = dernier jour', file: 'RSM_ventes-abonnements_AAAA-MM.csv',
    sig: has => has('numero du client') && has('nom du produit') && has('echeancier'),
    parse(c) {
      const iNum = c.col('numero du client'), iProd = c.col('nom du produit'), iDate = c.col('date de creation'), iOffre = c.col('nom de l offre'), iEtat = c.col('etat'), iCanal = c.col('canal'), iPrix = c.col('prix toutes taxes'), iHT = c.col('prix hors taxes'), iPass = c.find(h => h.includes('dernier passage')), iPre = c.colAt(2, 'prenom'), iNom = c.colAt(3, 'nom');
      const iCode = c.find(h => h.includes('code') && h.includes('initial')), iCN = c.find(h => h.includes('nom') && h.includes('initial') && !h.includes('prenom')), iCP = c.find(h => h.includes('prenom') && h.includes('initial'));
      // repli positionnel (colonnes 21-23) si les en-tetes du commercial sont muets
      const pos = k => (k >= 0 ? k : -1);
      const gCode = r => r[pos(iCode)] ?? r[22] ?? '', gName = r => [r[pos(iCP)] ?? r[21] ?? '', r[pos(iCN)] ?? r[20] ?? ''].join(' ').trim();
      for (const r of c.rows) {
        const date = rsmDate(r[iDate]); if (!date) { c.skip('date illisible'); continue; }
        const prod = `${r[iProd] || ''} ${r[iOffre] || ''}`; const etat = norm(r[iEtat]);
        if (etat && /(annul|panier|conserv|brouillon)/.test(etat)) { c.skip('panier ou vente annulée'); continue; }
        const num = r[iNum];
        // Changement d'offre : une montée en gamme (écart de prix mensuel), jamais un contrat.
        if (norm(prod).includes('changement d offre')) {
          const old = num ? Object.values(S.clients || {}).find(x => x.clubId === c.clubId && String(x.num || '') === String(num)) : null;
          const np = rsmNum(r[iPrix]); const op = old ? Number(old.price) || 0 : 0; const diff = np > 0 && op > 0 ? Math.round((np - op) * 100) / 100 : 0;
          c.entry({ key: `up:${num}:${date}`, kpiId: 'upsell', date, value: Math.max(0, diff), seller: resolveSeller(gName(r), gCode(r)), down: diff < 0 });
          if (diff < 0) c.count('descentes'); else if (diff > 0) c.count('montees');
          if (num) c.client(num, { num, offer: r[iOffre] || r[iProd] || '', price: np || null, upgradedAt: diff > 0 ? date : null });
          continue;
        }
        if (PRODUCT_EXCLUDE.some(x => norm(prod).includes(x))) { c.skip('accès employé, VIP, transfert ou reconduction'); continue; }
        const sel = resolveSeller(gName(r), gCode(r));
        // offre et vente en ligne : utilisées par le KPI du matin (Ultimate / Access+, inscriptions en ligne)
        c.entry({ key: `sub:${num}:${date}:${norm(r[iProd])}`, kpiId: 'contrats', date, value: 1, seller: sel, offer: prod.trim(), online: sel.status === 'system' || KM_ONLINE_CANAL.test(r[iCanal] || ''), priceHT: iHT >= 0 ? rsmNum(r[iHT]) || 0 : null, engaged: engagementOf(prod), option: OPTION_RE.test(prod) });
        const parrain = /parrain/.test(norm(`${prod} ${r[iCanal] || ''}`));
        if (num) c.client(num, { num, ...(iPass >= 0 && rsmDate(r[iPass]) ? { lastVisit: rsmDate(r[iPass]) } : {}), name: `${r[iPre] || ''} ${r[iNom] || ''}`.trim(), start: date, offer: r[iOffre] || r[iProd] || '', canal: r[iCanal] || '', price: rsmNum(r[iPrix]), sellerObj: resolveSeller(gName(r), gCode(r)), source: parrain ? 'parrainage' : null, status: 'Client', ...c.contact(r) });
      }
    },
  },
  {
    id: 'factures', label: 'Factures & avoirs (DetailLignesFacture&AvoirsV2)', family: 'gestion', feeds: 'Nutrition · Accessoires · Contrat B2B (société du client)',
    path: 'Exports de gestion > Exporter > Finance > Factures & avoirs', filters: 'Dates du mois, Entité = FPN GESTION, Club', file: 'RSM_factures-avoirs_AAAA-MM.zip',
    sig: has => has('nature') && has('code du produit') && has('famille de produit niveau 1'),
    parse(c) {
      const iDate = c.col('date de creation de la facture'), iNum = c.col('numero de la facture'), iNat = c.col('nature'), iEtat = c.col('etat'), iProd = c.col('nom du produit'), iCode = c.col('code du produit'), iFam = c.col('famille de produit niveau 1'), iAut = c.col('auteur'), iSoc = c.col('societe du client'), iCli = c.find(h => /num(ero)? (du )?client/.test(h));
      const ttc = c.H.map((h, i) => [h, i]).filter(([h]) => h.includes('ttc')).map(([, i]) => i);
      const iTtc = c.find(h => h.includes('ttc') && h.includes('ligne')) >= 0 ? c.find(h => h.includes('ttc') && h.includes('ligne')) : (ttc[1] ?? ttc[0]);
      const iCI = c.find(h => h.includes('code') && h.includes('initial')), iNI = c.find(h => h.includes('nom') && h.includes('initial') && !h.includes('prenom')), iPI = c.find(h => h.includes('prenom') && h.includes('initial'));
      const seen = {}; const b2b = new Set();
      // Chiffre d'affaires HT du mois (plan T4) : toutes les lignes, reconductions comprises, avoirs déduits.
      const iHtl = c.find(h => h.includes('ht') && h.includes('ligne')); const ca = {};
      for (const r of c.rows) {
        const date = rsmDate(r[iDate]); if (!date || /annul/.test(norm(r[iEtat]))) continue;
        let ht = iHtl >= 0 ? parseMontant(r[iHtl]) : NaN; if (Number.isNaN(ht)) continue; if (/avoir/.test(norm(r[iNat])) && ht > 0) ht = -ht;
        const m = date.slice(0, 7); const o = ca[m] = ca[m] || { total: 0, abo: 0, options: 0, boutique: 0 }; o.total += ht;
        const fam = `${r[iFam] || ''} ${r[iProd] || ''}`;
        if (isNutrition(r[iFam], r[iCode], r[iProd]) || isAccessory(r[iCode])) o.boutique += ht; else if (OPTION_RE.test(fam)) o.options += ht; else if (/abonnement|adhesion|cotisation|reconduction|frais/.test(norm(fam))) o.abo += ht;
      }
      Object.entries(ca).forEach(([m, o]) => c.control('ca', { month: m, total: Math.round(o.total * 100) / 100, abo: Math.round(o.abo * 100) / 100, options: Math.round(o.options * 100) / 100, boutique: Math.round(o.boutique * 100) / 100 }));
      for (const r of c.rows) {
        const date = rsmDate(r[iDate]); if (!date) { c.skip('date illisible'); continue; }
        if (/annul/.test(norm(r[iEtat]))) { c.skip('pièce annulée'); continue; }
        if (/reconduction/.test(norm(r[iProd]))) { c.skip('reconduction mensuelle'); continue; }
        const avoir = /avoir/.test(norm(r[iNat]));
        const vm = parseMontant(r[iTtc]); let v = Number.isNaN(vm) ? 0 : vm; if (avoir && v > 0) v = -v;
        const kpi = isNutrition(r[iFam], r[iCode], r[iProd]) ? 'nutrition' : isAccessory(r[iCode]) ? 'accessoires' : null;
        if (kpi && Number.isNaN(vm)) { c.skip('montant illisible'); continue; }
        const base = `fl:${r[iNum]}:${String(r[iCode]).trim()}:${norm(r[iProd])}:${v}`; seen[base] = (seen[base] || 0) + 1;
        if (kpi && v) c.entry({ key: `${base}:${seen[base]}`, kpiId: kpi, date, value: Math.round(v * 100) / 100, seller: resolveSeller(r[iAut]), clientNum: iCli >= 0 ? String(r[iCli] || '').trim() : '' });
        if (kpi && iCli < 0) c.flag('sansNumClient');
        const soc = (r[iSoc] || '').trim(); if (soc && !kpi && !avoir) c.company(soc, iCli >= 0 ? String(r[iCli] || '').trim() : '');
        // B2B : une entreprise compte une fois, a sa premiere facture
        // d'abonnement (trois factures d'une meme societe = une entreprise).
        const bk = `b2b:${norm(r[iSoc] || '')}`;
        // L'entrée est toujours émise (id stable par club) : un réimport la garde, une annulation puis un réimport la rétablit.
        if (!avoir && !kpi && (r[iSoc] || '').trim() && !b2b.has(bk)) {
          b2b.add(bk);
          const seller = (iCI >= 0 || iNI >= 0) ? resolveSeller(`${r[iPI] || ''} ${r[iNI] || ''}`.trim(), r[iCI]) : resolveSeller(r[iAut]);
          c.entry({ key: bk, kpiId: 'b2b', date, value: 1, seller });
        }
        if (!kpi) c.skip('ligne hors nutrition / accessoires');
      }
      const b2bNew = [...b2b].filter(k => !Object.values(S.entries || {}).some(e => e.rowKey === k && e.kpiId === 'b2b' && e.clubId === c.clubId && entryCounts(e))).length;
      if (b2bNew) c.warn(`${plur(b2bNew, 'nouvelle entreprise', 'nouvelles entreprises')} (« Société du client ») comptées en Contrat B2B : à vérifier.`);
    },
  },
  {
    id: 'lignes-factures', label: 'Lignes de factures (liste)', family: 'liste', feeds: 'Nutrition · Accessoires (vendeur)',
    path: 'Données financières > Lignes de factures > FILTRER (période) > ⋮ > Exporter', filters: 'Période d’une semaine maximum (plafond 2 000 lignes)', file: 'invoice_lines.csv',
    sig: has => has('num facture') && has('code du produit') && has('vendeur'),
    parse(c) { linesParse(c, false); },
  },
  {
    id: 'lignes-avoirs', label: 'Lignes d’avoirs (liste)', family: 'liste', feeds: 'Retours nutrition / accessoires (déduits)',
    path: 'Données financières > Lignes d’avoirs > FILTRER > ⋮ > Exporter', filters: 'Période', file: 'credit_note_lines.csv',
    sig: has => has('num avoir') && has('code du produit'),
    parse(c) { linesParse(c, true); },
  },
  {
    id: 'incidents', label: 'Incidents (liste)', family: 'liste', feeds: 'Impayés récupérés PAR CANAL (équipe, client en ligne, prélèvement, automatismes) · impayés en cours',
    path: 'Données financières > Incidents > FILTRER (Statut, Date de régularisation, Club) > ⋮ > Exporter', filters: 'Récupérés : Statut = Régularisé + Date de régularisation = la période. En cours : Statut = En cours', file: 'RSM_impayes-regularises_AAAA-MM.csv',
    sig: has => has('auteur de la regularisation') && has('date de regularisation'),
    parse(c) {
      const iDI = c.col('date de l incident'), iType = c.col('type d incident'), iPre = c.col('prenom'), iNom = c.colExact('nom'), iNum = c.col('num client'), iMoy = c.col('moyen de paiement'), iNP = c.col('numero du paiement'), iMt = c.col('montant du paiement'), iSt = c.col('statut'), iDR = c.col('date de regularisation'), iAR = c.col('auteur de la regularisation');
      const open = {}; const occ = {}; let weak = 0;
      for (const r of c.rows) {
        const st = norm(r[iSt]); const amount = Math.abs(rsmNum(r[iMt])); const client = `${r[iPre] || ''} ${r[iNom] || ''}`.trim();
        // Cle : paiement, date, client, montant, type, et rang d'occurrence (deux
        // rejets le meme jour sans numero de paiement ne s'ecrasent plus).
        const kb = `inc:${r[iNP] || ''}:${rsmDate(r[iDI]) || r[iDI]}:${r[iNum]}:${amount}:${norm(r[iType] || '')}`; occ[kb] = (occ[kb] || 0) + 1;
        const key = occ[kb] > 1 ? `${kb}:${occ[kb]}` : kb;
        const legacyKey = occ[kb] > 1 ? null : `inc:${r[iNP] || ''}:${rsmDate(r[iDI]) || r[iDI]}:${r[iNum]}`; // cle des imports d'avant : pas de doublon au reimport
        if (!r[iNP]) weak++;
        if (/annul|cancel/.test(st)) { c.recov({ key, legacyKey, date: rsmDate(r[iDR]) || rsmDate(r[iDI]), amount, canal: 'annule', type: r[iType], clientNum: r[iNum], author: r[iAR] }); continue; }
        const dr = rsmDate(r[iDR]);
        if (/closed|regularis|clos/.test(st) && dr) {
          const ch = recovChannel(r[iAR], client);
          c.recov({ key, legacyKey, date: dr, amount, canal: ch.canal, type: r[iType], clientNum: r[iNum], author: r[iAR], seller: ch.seller || null, moyen: r[iMoy], incidentDate: rsmDate(r[iDI]) || null });
          if (ch.canal === 'equipe') c.entry({ key, legacyKey, kpiId: 'impayes', date: dr, value: amount, seller: ch.seller, clientNum: r[iNum] || '' });
          continue;
        }
        if ((/open|en cours/.test(st) || !dr) && !String(r[iNum] || '').trim()) { c.skip('incident en cours sans numéro client'); continue; }
        if (/open|en cours/.test(st) || !dr) { const o = open[r[iNum]] = open[r[iNum]] || { num: r[iNum], name: client, amount: 0, count: 0, oldest: null }; o.amount += amount; o.count++; const di = rsmDate(r[iDI]); if (di && (!o.oldest || di < o.oldest)) o.oldest = di; }
      }
      if (weak) c.warn(`${plur(weak, 'incident', 'incidents')} sans numéro de paiement : clé plus faible (montant et type ajoutés).`);
      const list = Object.values(open);
      if (list.length) { c.balances(list, 'incidents'); }
    },
  },
  {
    id: 'clients-incident', label: 'Clients en incident', family: 'gestion', feeds: 'Impayés en cours : solde par client à une date',
    path: 'Exports de gestion > Exporter > Points d’attention > Clients en incident', filters: 'Date de visualisation = aujourd’hui, Club', file: 'RSM_impayes-encours_AAAA-MM-JJ.csv',
    sig: has => has('nombre d incidents') && has('numero du client'),
    parse(c) {
      const iNum = c.col('numero du client'), iPre = c.col('prenom'), iNom = c.colExact('nom'), iMt = c.col('montant de l incident'), iN = c.col('nombre d incidents');
      c.balances(c.rows.map(r => ({ num: r[iNum], name: `${r[iPre] || ''} ${r[iNom] || ''}`.trim(), amount: Math.abs(rsmNum(r[iMt])), count: rsmNum(r[iN]), ...c.contact(r) })).filter(x => x.num), 'clients-incident');
    },
  },
  {
    id: 'sans-mandat', label: 'Clients abonnés sans prélèvement', family: 'gestion', feeds: 'Adhérents sans mandat (tâche de relance)',
    path: 'Exports de gestion > Exporter > Points d’attention > Clients abonnés sans prélèvement', filters: 'Club', file: 'RSM_sans-mandat_AAAA-MM-JJ.csv',
    sig: has => has('prochaine facturation') && has('numero du client'),
    parse(c) {
      const iNum = c.col('numero du client'), iPre = c.col('prenom'), iNom = c.colExact('nom'), iAb = c.col('nom de l abonnement');
      c.noMandate(c.rows.map(r => ({ num: r[iNum], name: `${r[iPre] || ''} ${r[iNom] || ''}`.trim(), offer: r[iAb], ...c.contact(r) })).filter(x => x.num));
    },
  },
  {
    id: 'clients', label: 'Clients club (liste)', family: 'liste', feeds: 'Base clients : anniversaires, statut, commercial',
    path: 'Clients > Clients club > FILTRER (Statut = Client) > ⋮ > Exporter', filters: 'Statut = Client (plafond 2 000 lignes : filtrer « Anniversaire ce jour » ou par lettre si besoin)', file: 'RSM_clients_AAAA-MM-JJ.csv',
    sig: has => has('date d anniversaire') && has('numero'),
    parse(c) {
      const iNum = c.col('numero'), iBd = c.col('date d anniversaire'), iNom = c.colExact('nom'), iPre = c.col('prenom'), iEtat = c.col('etat'), iCom = c.col('commercial');
      const iPass = c.find(h => h.includes('dernier passage') || h.includes('derniere visite') || h.includes('derniere entree'));
      for (const r of c.rows) { if (!r[iNum]) continue; c.client(r[iNum], { num: r[iNum], ...(iPass >= 0 && rsmDate(r[iPass]) ? { lastVisit: rsmDate(r[iPass]) } : {}), name: `${r[iPre] || ''} ${r[iNom] || ''}`.trim(), birth: (rsmDate(r[iBd]) || '').slice(5) || null, status: r[iEtat] || '', seller: r[iCom] || '', ...c.contact(r) }); }
    },
  },
  {
    id: 'abonnements', label: 'Abonnements (liste)', family: 'liste', feeds: 'Fins de contrat (relances de renouvellement)',
    path: 'Clients > Abonnements > FILTRER (Fin d’engagement = 30 prochains jours, Masquer les résiliés) > ⋮ > Exporter', filters: 'Fin d’engagement = période à venir', file: 'RSM_fins-contrat_AAAA-MM-JJ.csv',
    sig: has => has('fin d engagement') && has('libelle') && has('contact'),
    parse(c) {
      const iC = c.col('contact'), iL = c.col('libelle'), iFE = c.col('fin d engagement'), iFV = c.col('fin de validite'), iDeb = c.col('debut de validite');
      for (const r of c.rows) { const end = rsmDate(r[iFE]) || rsmDate(r[iFV]); const name = cleanContact(r[iC]); if (!name || !end) continue; c.clientByName(name, { end, offer: r[iL] || '', start: rsmDate(r[iDeb]), strict: true, ...c.contact(r), ...contactFromText(r[iC]) }); }
    },
  },
  {
    id: 'prospects', label: 'Prospects', family: 'liste', feeds: 'Prospects créés par commercial',
    path: 'Clients > Prospects > FILTRER (Date de création) > ⋮ > Exporter ou Exports de gestion > Membres & Ventes > Prospects (S)', filters: 'Date de création = la période', file: 'RSM_prospects_AAAA-MM.csv',
    sig: has => (has('valeur du prospect') || has('statut de prospection')) && has('date de creation'),
    parse(c) {
      const iN = c.colExact('nom'), iP = c.col('prenom'), iD = c.col('date de creation');
      const iCom = c.find(h => h === 'commercial initial') >= 0 ? c.find(h => h === 'commercial initial') : c.find(h => h === 'commercial' || h.startsWith('commercial'));
      const iSt = c.col('statut de prospection'), iVal = c.col('valeur du prospect'), iSrc = c.find(h => /provenance|origine|source/.test(h));
      if (iSrc < 0) c.flag('sansProvenance');
      for (const r of c.rows) {
        const d = rsmDate(r[iD]); if (!d) { c.skip('date illisible'); continue; }
        const key = `pr:${tokensKey(`${r[iN]} ${r[iP]}`)}:${d}`; const seller = resolveSeller(r[iCom]);
        c.entry({ key, kpiId: 'prospects', date: d, value: 1, seller });
        c.prospect({ key, nom: r[iN] || '', prenom: r[iP] || '', creeLe: d, seller, statut: iSt >= 0 ? r[iSt] || '' : '', valeur: iVal >= 0 ? rsmNum(r[iVal]) || 0 : 0, valeurTxt: iVal >= 0 ? String(r[iVal] || '').slice(0, 40) : '', provenance: iSrc >= 0 ? r[iSrc] || '' : '', ...c.contact(r) });
      }
    },
  },
  {
    id: 'resil', label: 'Résiliations', family: 'liste', feeds: 'Demandes à arbitrer (à traiter) · acceptées/rejetées/annulées (historique) · motifs techniques écartés',
    path: 'Clients > Résiliations > FILTRER (Date de création = le mois) > ⋮ > Exporter', filters: 'Date de création = le mois, TOUS les statuts (À arbitrer, Acceptée, Rejetée, Annulée)', file: 'RSM_resiliations_AAAA-MM.csv',
    sig: has => has('motif') && (has('createur') || has('commercial actuel')) && (has('etat') || has('statut')),
    parse(c) {
      const iD = c.find(h => h === 'date creation' || h === 'date de creation') >= 0 ? c.find(h => h === 'date creation' || h === 'date de creation') : c.find(h => h === 'date' || h.startsWith('date'));
      const iE = c.find(h => h === 'etat' || h === 'statut'), iCr = c.col('createur'), iT = c.colExact('type'), iM = c.col('motif'), iCt = c.find(h => h === 'contact' || h === 'nom de l abonnement');
      const iCN = c.find(h => h === 'nom'), iCP = c.find(h => h === 'prenom'), iEff = c.find(h => h === 'date resiliation' || h === 'date effective' || h === 'date de resiliation');
      let tech = 0;
      for (const r of c.rows) {
        const d = rsmDate(r[iD]); if (!d) { c.skip('date illisible'); continue; }
        const motif = r[iM] || ''; if (TECH_MOTIFS.some(t => norm(motif).includes(t))) { tech++; c.skip('motif technique (changement de formule, pack option, transfert, migration)'); continue; }
        // Statut d'arbitrage Resamania : seules les demandes « À arbitrer » sont à traiter.
        // Acceptée = départ validé (préavis en cours) · Rejetée/Annulée = la personne reste · tout le reste = historique.
        const etat = norm(r[iE]);
        const arb = /arbitr|soumis|submit|pending|attente|a traiter/.test(etat) ? 'submitted'
          : /accept|valid/.test(etat) ? 'accepted'
            : /rejet|reject|refus/.test(etat) ? 'rejected'
              : /annul|cancel/.test(etat) ? 'canceled' : null;
        const saved = arb === 'canceled';
        const client = (iCN >= 0 ? `${r[iCP] || ''} ${r[iCN] || ''}`.trim() : '') || r[iCt] || '';
        const seller = resolveSeller(r[iCr]);
        c.resil({ key: `rs:${tokensKey(client)}:${d}:${norm(motif)}`, nature: OPTION_RE.test(`${r[iT] || ''} ${motif} ${iCt >= 0 ? r[iCt] || '' : ''}`) ? 'option' : 'abonnement', client, date: d, effective: iEff >= 0 ? rsmDate(r[iEff]) : null, reason: motif, type: r[iT] || '', saved, arb, seller });
      }
      if (tech) c.warn(`${plur(tech, 'résiliation technique écartée', 'résiliations techniques écartées')} : elles gonfleraient le churn.`);
    },
  },
  {
    id: 'tti', label: 'Taux de transformation par commerciaux', family: 'gestion', feeds: 'Taux de transformation des prospects (contrôle, par commercial)', monthly: true,
    path: 'Exports de gestion > Exporter > Membres & Ventes > Taux de transformation par commerciaux', filters: 'Dates du mois', file: 'RSM_tti-commerciaux_AAAA-MM.csv',
    sig: has => has('nombre de creations'),
    parse(c) {
      const iC = c.col('commercial'), iCr = c.col('nombre de creations'), iTr = c.col('nombre de contacts transformes');
      for (const r of c.rows) { const s = resolveSeller(r[iC]); c.control('tti', { seller: s, created: rsmNum(r[iCr]), transformed: rsmNum(r[iTr]) }); }
    },
  },
  {
    id: 'web', label: 'Rapport détaillé des transactions Web', family: 'gestion', feeds: 'Contrôle : impayés réglés en ligne (Recouvrement = 1)',
    path: 'Exports de gestion > Exporter > Finance > Rapport détaillé des transactions Web', filters: 'Mois, Club', file: 'RSM_web-transactions_AAAA-MM.csv',
    sig: has => has('recouvrement') && has('psp'),
    parse(c) {
      const iD = c.col('date de la transaction'), iM = c.colExact('montant'), iR = c.col('recouvrement'), iS = c.col('statut');
      for (const r of c.rows) { const d = rsmDate(r[iD]); if (!d || String(r[iR]).trim() !== '1' || /refus|echec|fail|annul/.test(norm(r[iS]))) continue; c.control('web', { date: d, amount: rsmNum(r[iM]) }); }
    },
  },
  {
    id: 'paiements', label: 'Paiements (liste)', family: 'liste', feeds: 'Contrôle : encaissements par moyen de paiement et par auteur',
    path: 'Données financières > Paiements > FILTRER (Période) > ⋮ > Exporter', filters: 'Période d’une semaine (≈ 2 000 paiements par mois)', file: 'RSM_paiements_AAAA-Sxx.csv',
    sig: has => has('moyen de paiement') && has('numero de paiement') && has('auteur') && !has('date de regularisation'),
    parse(c) {
      const iD = c.col('date du paiement'), iM = c.col('moyen de paiement'), iMt = c.colExact('montant'), iSt = c.col('statut');
      for (const r of c.rows) { const d = rsmDate(r[iD]); if (!d || !/valid/.test(norm(r[iSt]))) continue; c.control('payments', { date: d, moyen: r[iM] || 'Autre', amount: rsmNum(r[iMt]) }); }
    },
  },
  {
    id: 'perf', label: 'Export des performances commerciales', family: 'gestion', feeds: 'Contrôle : contrats par commercial (Page 1)', monthly: true,
    path: 'Exports de gestion > Exporter > Spécifiques > Export des performances commerciales', filters: 'Mois, Club', file: 'RSM_perf-commerciales_AAAA-MM.xlsx',
    sig: has => has('cdd1') || has('cdi') && has('cdd12'),
    parse(c) {
      const cols = c.H.map((h, i) => [h, i]).filter(([h]) => /^(cdd|cdi)/.test(h)).map(([, i]) => i);
      for (const r of c.rows) { if (!r[0] || /total/i.test(r[0])) continue; c.control('perf', { seller: resolveSeller(r[0]), contrats: cols.reduce((s, i) => s + rsmNum(r[i]), 0) }); }
    },
  },
  {
    id: 'evolution', label: 'Évolution clients (detail-gain / detail-perte)', family: 'gestion', feeds: 'Base adhérents : entrées et sortants du mois', monthly: true,
    path: 'Exports de gestion > Exporter > Membres & Ventes > Évolution clients', filters: 'Dates du mois, Club', file: 'RSM_evolution-clients_AAAA-MM.zip',
    sig: (has, name) => /detail-(gain|perte)/i.test(name) && has('nom de l abonnement'),
    parse(c) {
      const lost = /perte/i.test(c.fileName); c.control(lost ? 'lost' : 'gained', { count: c.rows.length });
      if (!lost) return;
      const iNum = c.find(h => /^num(ero)?( du)?( client)?$/.test(h)), iN = c.colExact('nom'), iP = c.col('prenom'), iAb = c.col('nom de l abonnement'), iD = c.find(h => h.includes('date') && /(fin|sortie|resil|perte)/.test(h)) >= 0 ? c.find(h => h.includes('date') && /(fin|sortie|resil|perte)/.test(h)) : c.find(h => h.includes('date'));
      for (const r of c.rows) {
        const name = `${iP >= 0 ? r[iP] || '' : ''} ${iN >= 0 ? r[iN] || '' : ''}`.trim(); if (!name) continue;
        const o = { name, status: 'Ancien client', endDate: iD >= 0 ? rsmDate(r[iD]) : null, offer: iAb >= 0 ? r[iAb] || '' : '', ...c.contact(r) };
        if (iNum >= 0 && r[iNum]) c.client(r[iNum], { num: r[iNum], ...o }); else c.clientByName(name, o);
      }
    },
  },
  {
    id: 'ignored', label: 'Export reconnu, non utilisé', family: 'gestion', feeds: '', silent: true,
    sig: (has, name) => has('situation des incidents') || has('montant ttc restant a ventiler') || /repartition|synthese|regroupement|tbo-|controle-/i.test(name) || has('contient representation') || has('cumul client actif'),
    parse(c) { c.warn('Fichier de contrôle ou d’agrégat : rien à importer.'); },
  },
];
// Prompt « tout récupérer » pour Claude dans Chrome, à côté de la page Resamania :
// la liste exacte des exports à télécharger pour un import mensuel complet.
function rsmImportPrompt() {
  const mk = typeof curMonth === 'function' ? curMonth() : new Date().toISOString().slice(0, 7);
  const [yy, mm] = mk.split('-'); const dImax = typeof daysIn === 'function' ? daysIn(mk) : 31;
  const moisLabel = typeof monthLabel === 'function' ? monthLabel(mk) : mk;
  const auj = typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10);
  const fr = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '';
  const debut = fr(`${mk}-01`), fin = fr(`${mk}-${String(dImax).padStart(2, '0')}`), ajd = fr(auj);
  const defs = RSM_DEFS.filter(d => d.path && !d.silent);
  const lignes = defs.map((d, i) => `${i + 1}. ${d.label}\n   Chemin : ${d.path}\n   Filtres : ${(d.filters || '').replace(/AAAA-MM-JJ|AAAA-MM/g, '')} → période du ${debut} au ${fin}${/incident|abonnement|sans.?mandat|clients club/i.test(d.label) ? ` (ou situation au ${ajd})` : ''}\n   Puis : ⋮ / Exporter → télécharger le fichier.`);
  return `Tu es dans l'espace de gestion Resamania de Fitness Park Niort, dans l'onglet à côté. Objectif : télécharger TOUS les exports ci-dessous pour ${moisLabel}, afin de les importer d'un coup dans Fit Pulse. Pour chacun : ouvre le chemin indiqué, applique les filtres (période du ${debut} au ${fin} ; pour les listes « à l'instant T », prends la situation du ${ajd}), lance l'export puis télécharge le fichier (CSV, ZIP ou Excel selon le cas). Ne modifie aucune donnée dans Resamania, ne fais que consulter et exporter. Si un export dépasse 2 000 lignes, découpe par semaine ou par lettre et télécharge chaque partie. À la fin, laisse tous les fichiers dans les téléchargements et liste ce que tu as récupéré.\n\nExports à télécharger :\n\n${lignes.join('\n\n')}\n\nQuand tout est téléchargé, je dépose les fichiers dans Fit Pulse (page Imports) : l'appli les reconnaît et met la base à jour.`;
}
function linesParse(c, avoir) {
  const iNum = c.find(h => h.startsWith('num facture') || h.startsWith('num avoir')), iDate = c.find(h => h.startsWith('date de')), iProd = c.col('nom du produit'), iCode = c.col('code du produit'), iV = c.col('vendeur'), iSt = c.find(h => h.startsWith('statut'));
  const iTtc = c.find(h => h.includes('ttc') && h.includes('ligne')) >= 0 ? c.find(h => h.includes('ttc') && h.includes('ligne')) : c.find(h => h.includes('ttc'));
  const seen = {};
  for (const r of c.rows) {
    const date = rsmDate(r[iDate]); if (!date) { c.skip('date illisible'); continue; }
    if (/annul/.test(norm(r[iSt]))) { c.skip('pièce annulée'); continue; }
    if (/reconduction/.test(norm(r[iProd]))) { c.skip('reconduction mensuelle'); continue; }
    const kpi = isNutrition('', r[iCode], r[iProd]) ? 'nutrition' : isAccessory(r[iCode]) ? 'accessoires' : null;
    if (!kpi) { c.skip('ligne hors nutrition / accessoires'); continue; }
    const vm = parseMontant(r[iTtc]); if (Number.isNaN(vm)) { c.skip('montant illisible'); continue; }
    let v = vm; if (avoir && v > 0) v = -v; if (!v) continue;
    const base = `fl:${r[iNum]}:${String(r[iCode]).trim()}:${norm(r[iProd])}:${v}`; seen[base] = (seen[base] || 0) + 1;
    c.entry({ key: `${base}:${seen[base]}`, kpiId: kpi, date, value: Math.round(v * 100) / 100, seller: resolveSeller(r[iV]) });
  }
}

// Nom de contact sans civilité, parenthèses ni e-mail entre chevrons.
const KM_ONLINE_CANAL = /web|en ligne|internet|site|online/i;
// Options vendues (plan T4) : ULTIMATE, ACCESS+, Yanga.
const OPTION_RE = /ultimate|acc?es+\s*\+|acc?es+\s*plus|yanga/i;
// Engagement : CDD (6, 12, 24 mois) = engagé ; CDI ou « sans engagement » = libre ; sinon inconnu.
function engagementOf(s) { const t = norm(s); if (/sans engagement|\bcdi\b|liberte|flex/.test(t)) return false; if (/\bcdd ?(3|6|12|24)\b|\b(12|24) mois\b|engag/.test(t)) return true; return null; }
const cleanContact = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/^\s*(m\.|mme|mlle|monsieur|madame|mademoiselle)\s+/i, '').replace(/\s+/g, ' ').trim();
// Téléphone / e-mail cachés dans un champ « contact » combiné (nom + coordonnées).
function contactFromText(s) { const t = String(s || ''); const o = {}; const m = t.match(/[^\s@<>"']+@[^\s@<>"']+/); if (m) o.email = m[0].trim().toLowerCase(); const pm = t.match(/\+?\d[\d .\-()/]{7,}\d/); if (pm) { const p = phoneE164(pm[0]); if (p) { o.phone = p; o.phoneSrc = 'rsm'; } } return o; }
// Fichier non reconnu : l'export connu le plus proche et les colonnes qui
// manquent, pour corriger l'export (mauvais menu, colonnes masquées, fichier
// retouché dans Excel) sans deviner.
function closestDef(t) {
  const H = (t.headers || []).map(norm); let best = null;
  for (const d of RSM_DEFS) {
    if (d.silent) continue;
    const need = [...new Set([...d.sig.toString().matchAll(/has\('([^']+)'\)/g)].map(m => m[1]))]; if (!need.length) continue;
    const ok = need.filter(p => { const n = norm(p); return H.some(h => h === n || h.includes(n)); });
    const sc = ok.length / need.length;
    if (ok.length && (!best || sc > best.score)) best = { def: d, score: sc, missing: need.filter(p => !ok.includes(p)) };
  }
  return best;
}
function detectDef(t) {
  const H = t.headers.map(norm);
  const has = p => { const n = norm(p); return H.some(h => h === n || h.includes(n)); };
  return RSM_DEFS.find(d => d.sig(has, t.name)) || null;
}

// ── Analyse : fichier -> plan d'import ────────────────────────────────────
function analyzeTable(t, { clubId, month }) {
  const def = t.skipped || !t.headers ? null : detectDef(t);
  const res = { name: t.name, encoding: t.encoding, rowsCount: (t.rows || []).length, def, entries: [], recov: [], clients: {}, clientsByName: [], resil: [], controls: [], balances: null, noMandate: null, prospects: [], companies: {}, flags: {}, counts: {}, warnings: [], skipped: {}, from: null, to: null };
  if (t.skipped) { res.warnings.push(t.skipped); return res; }
  if (!def) return res;
  const H = t.headers.map(norm);
  const find = f => H.findIndex(f);
  const c = {
    H, rows: t.rows, fileName: t.name, clubId, month,
    find,
    col: p => { const n = norm(p); const e = H.indexOf(n); return e >= 0 ? e : H.findIndex(h => h.includes(n)); },
    colExact: p => H.indexOf(norm(p)),
    // Coordonnees si l'export les porte (colonne Telephone / Portable / Mobile, E-mail).
    contact: r => { if (c._ip === undefined) { c._ip = H.findIndex(h => /portable|mobile|telephone|^tel\b/.test(h)); c._ie = H.findIndex(h => /mail/.test(h)); } const o = {}; if (c._ip >= 0 && r[c._ip]) { const p = phoneE164(r[c._ip]); if (p) { o.phone = p; o.phoneSrc = 'rsm'; } } if (c._ie >= 0 && /^[^\s@<>"']+@[^\s@<>"']+$/.test(String(r[c._ie] || '').trim())) o.email = String(r[c._ie]).trim().toLowerCase(); return o; },
    colAt: (pos, p) => (norm(H[pos] || '') === norm(p) ? pos : H.indexOf(norm(p))),
    skip: why => { res.skipped[why] = (res.skipped[why] || 0) + 1; },
    warn: w => res.warnings.push(w),
    entry: e => { res.entries.push(e); if (!res.from || e.date < res.from) res.from = e.date; if (!res.to || e.date > res.to) res.to = e.date; },
    recov: x => { res.recov.push(x); if (x.date && (!res.from || x.date < res.from)) res.from = x.date; if (x.date && (!res.to || x.date > res.to)) res.to = x.date; },
    client: (num, o) => { res.clients[num] = { ...(res.clients[num] || {}), ...Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== '')) }; },
    clientByName: (name, o) => res.clientsByName.push({ name, ...o }),
    resil: x => res.resil.push(x),
    control: (k, v) => res.controls.push([k, v]),
    balances: (list, src) => { res.balances = { list, src }; },
    noMandate: list => { res.noMandate = list; },
    prospect: p => res.prospects.push(p),
    company: (nom, num) => { const k = norm(nom); const o = res.companies[k] = res.companies[k] || { nom, nums: [] }; if (num && !o.nums.includes(num)) o.nums.push(num); },
    flag: k => { res.flags[k] = true; },
    count: k => { res.counts[k] = (res.counts[k] || 0) + 1; },
  };
  def.parse(c);
  if (def.family === 'liste' && t.rows.length === 2000) res.warnings.unshift('Exactement 2 000 lignes : la liste est TRONQUÉE par Resamania. Refaites l’export sur une période plus courte (ex. une semaine).');
  if (t.encoding === 'ISO-8859-15' || t.encoding === 'Windows-1252') res.warnings.push(`Encodage ${t.encoding} : accents et « € » corrigés automatiquement.`);
  if (def.monthly) res.month = (t.name.match(/(\d{4})-(\d{2})(?!-\d)/) || [])[0] || month;
  return res;
}
// vendeurs inconnus, tous fichiers confondus. Deux libelles qui partagent une
// cle (meme e-mail, meme code, memes nom et prenom dans un autre ordre) sont
// une seule personne : on ne la propose qu'une fois.
function unknownSellers(results) {
  const groups = []; const byKey = {};
  const visit = s => {
    if (!s || s.status !== 'unknown') return;
    let g = s.keys.map(k => byKey[k]).find(Boolean);
    if (!g) { g = { key: s.key, keys: [], labels: new Set(), count: 0 }; groups.push(g); }
    s.keys.forEach(k => { if (!g.keys.includes(k)) g.keys.push(k); byKey[k] = g; });
    g.labels.add(s.label); g.count++;
  };
  results.forEach(r => { r.entries.forEach(e => visit(e.seller)); r.resil.forEach(e => visit(e.seller)); r.recov.forEach(e => visit(e.seller)); r.controls.forEach(([, v]) => visit(v.seller)); });
  return groups.map(g => ({ key: g.key, keys: g.keys, label: [...g.labels].join(' · '), count: g.count })).sort((a, b) => b.count - a.count);
}
// choix fait pour un groupe -> valable pour toutes ses cles
function choiceFor(s, choices, groups) {
  if (!s || s.status !== 'unknown') return null;
  const g = groups.find(x => x.keys.some(k => s.keys.includes(k)));
  return g ? choices[g.key] || null : null;
}
