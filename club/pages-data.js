'use strict';
// ══ FIT PULSE — imports Resamania, retention, resiliations, clubs ════════

// ── Lecture CSV / TSV ─────────────────────────────────────────────────────
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const sep = ['\t', ';', ','].map(s => [s, first.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter(r => r.some(x => x.trim()));
  const headers = (clean.shift() || []).map(h => h.trim());
  return { headers, rows: clean.map(r => headers.map((_, i) => (r[i] || '').trim())) };
}
const toNum = s => { if (s == null) return 0; const t = String(s).replace(/\s|€/g, '').replace(/ /g, ''); const n = parseFloat(t.includes(',') && !t.includes('.') ? t.replace(',', '.') : t.replace(/,(?=\d{3}\b)/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
function toDate(s) {
  if (!s) return null; s = String(s).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/); if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${pad(m[2])}-${pad(m[1])}`; }
  return null;
}

// Exports Resamania reconnus par leurs en-tetes. Chaque profil propose le
// type d'import et des colonnes par defaut, toutes modifiables a l'etape 2.
const IMPORT_PROFILES = [
  { id: 'ventes', label: 'Gestion des ventes d’abonnements', feeds: 'Contrats signés (une ligne = un contrat)', type: 'kpi', kpi: 'contrats', mode: 'count', keys: ['abonnement', 'contrat', 'formule'] },
  { id: 'factures', label: 'Factures & avoirs', feeds: 'Nutrition & accessoires (selon le code produit)', type: 'kpi', kpi: 'nutrition', mode: 'sum', keys: ['facture', 'avoir', 'produit', 'article'] },
  { id: 'incidents', label: 'Incidents', feeds: 'Impayés récupérés (montant réglé)', type: 'kpi', kpi: 'impayes', mode: 'sum', keys: ['incident', 'regularis', 'recouvr'] },
  { id: 'prospects', label: 'Gestion des prospects', feeds: 'Prospects créés', type: 'kpi', kpi: 'prospects', mode: 'count', keys: ['prospect', 'lead', 'origine'] },
  { id: 'clients', label: 'Résumé clients', feeds: 'Base clients : relances de suivi, anniversaires, renouvellements', type: 'clients', keys: ['naissance', 'fin de contrat', 'date de fin', 'adherent', 'client'] },
  { id: 'soldes', label: 'Solde clients', feeds: 'Impayés en cours (un solde par client débiteur)', type: 'soldes', keys: ['solde', 'debit', 'du'] },
  { id: 'resil', label: 'Résiliations', feeds: 'Liste des résiliations du mois', type: 'resil', keys: ['resiliation', 'motif'] },
];
function guessProfile(name, headers) {
  const h = norm(name + ' ' + headers.join(' '));
  let best = IMPORT_PROFILES[0], score = -1;
  for (const p of IMPORT_PROFILES) { const s = p.keys.reduce((a, k) => a + (h.includes(norm(k)) ? 1 : 0), 0); if (s > score) { score = s; best = p; } }
  return best;
}
const guessCol = (headers, words) => { const i = headers.findIndex(h => words.some(w => norm(h).includes(w))); return i < 0 ? '' : String(i); };

PAGES.imports = {
  title: 'Imports',
  manager: true,
  render() {
    const tab = UI.impTab || 'rsm';
    const body = { rsm: impRsm, new: impNew, history: impHistory, manual: impManual }[tab]();
    return `<div class="page-head"><div><h1>Imports</h1><p>Déposez vos exports Resamania : Fit Pulse les reconnaît et alimente les KPI, la rétention et les impayés.</p></div></div>
      ${tabs('impTab', [['rsm', 'Resamania'], ['new', 'Import libre'], ['history', 'Historique'], ['manual', 'Saisie manuelle mensuelle']], tab)}${body}`;
  },
  mount() {
    if ((UI.impTab || 'rsm') === 'rsm') { mountRsm(); return; }
    const drop = $('#drop'); if (!drop) return;
    const input = $('#file');
    drop.addEventListener('click', () => input.click());
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) readImport(e.dataTransfer.files[0]); });
    input.addEventListener('change', () => { if (input.files[0]) readImport(input.files[0]); });
  },
};
function readImport(file) {
  const fr = new FileReader();
  fr.onload = () => {
    let text = fr.result;
    if (text.includes('\uFFFD')) { const fr2 = new FileReader(); fr2.onload = () => startWizard(file.name, fr2.result); fr2.readAsText(file, 'windows-1252'); return; }
    startWizard(file.name, text);
  };
  fr.readAsText(file, 'utf-8');
}
function startWizard(name, text) { startWizardTable(name, parseCSV(text)); }
function startWizardTable(name, p) {
  if (!p.headers.length || !p.rows.length) { toast('Fichier vide ou illisible.'); return; }
  const prof = guessProfile(name, p.headers);
  const H = p.headers;
  UI.wiz = { step: 2, name, ...p, profile: prof.id, type: prof.type, kpi: prof.kpi || 'contrats', mode: prof.mode || 'count',
    col: { date: guessCol(H, ['date de vente', 'date de creation', 'date facture', 'date', 'creation']), user: guessCol(H, ['vendeur', 'commercial', 'conseiller', 'createur', 'auteur', 'utilisateur']), amount: guessCol(H, ['montant ttc', 'total ttc', 'ttc', 'montant', 'regle', 'total']), cat: guessCol(H, ['famille', 'categorie', 'code produit', 'produit', 'article']),
      name: guessCol(H, ['nom complet', 'client', 'adherent', 'nom']), first: guessCol(H, ['prenom']), phone: guessCol(H, ['portable', 'mobile', 'telephone', 'tel']), email: guessCol(H, ['mail']), birth: guessCol(H, ['naissance']), start: guessCol(H, ['debut', 'souscription', 'inscription']), end: guessCol(H, ['fin de contrat', 'date de fin', 'echeance', 'fin']), balance: guessCol(H, ['solde', 'montant du', 'reste du', 'debit']), offer: guessCol(H, ['offre', 'formule', 'abonnement']), reason: guessCol(H, ['motif', 'raison']) },
    catMap: {}, userMap: {} };
  UI.impTab = 'new';
  render();
}
function impNew() {
  const w = UI.wiz;
  const steps = s => `<div class="steps">${['Document', 'Matching', 'Validation'].map((l, i) => `<span class="${s >= i + 1 ? 'on' : ''}"><i>${i + 1}</i>${l}</span>`).join('')}</div>`;
  if (!w) {
    return `<div class="card">${steps(1)}<div class="drop" id="drop">${ico('upload')}<div class="title" style="font-size:18px;margin-top:8px">Déposer un fichier CSV ou cliquer pour sélectionner</div><div class="muted small">.csv ou .tsv (séparateur ; , ou tabulation), tel qu’exporté de Resamania</div></div><input type="file" id="file" accept=".csv,.tsv,.txt" hidden>
      <h3 style="margin:20px 0 8px">Les fichiers que vous pouvez importer</h3><p class="muted small" style="margin-top:0">Le type est reconnu automatiquement par le nom et les colonnes ; vous confirmez à l’étape suivante.</p>
      <div class="table-wrap"><table class="t"><thead><tr><th>Export Resamania</th><th>Alimente</th></tr></thead><tbody>${IMPORT_PROFILES.map(p => `<tr><td><b>${esc(p.label)}</b></td><td>${esc(p.feeds)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  const H = w.headers;
  const colSel = (key, label, opt = false) => `<label class="field"><span>${label}</span><select class="input sm" data-change="wizCol" data-k="${key}"><option value="">${opt ? '— aucune —' : '— choisir —'}</option>${H.map((h, i) => `<option value="${i}" ${w.col[key] === String(i) ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label>`;
  if (w.step === 2) {
    let mapping = '';
    if (w.type === 'kpi') {
      const users = clubMembers(CLUB.id, { all: true });
      const names = w.col.user !== '' ? [...new Set(w.rows.map(r => r[w.col.user]).filter(Boolean))] : [];
      names.forEach(n => { if (w.userMap[n] === undefined) { const m = users.find(u => norm(fullName(u)) === norm(n) || norm(`${u.last} ${u.first}`) === norm(n) || (u.email && norm(u.email) === norm(n))); w.userMap[n] = m ? m.id : (users.find(u => norm(n).includes(norm(u.first)) && norm(n).includes(norm(u.last))) || {}).id || ''; } });
      const cats = w.col.cat !== '' ? [...new Set(w.rows.map(r => r[w.col.cat]).filter(Boolean))].slice(0, 40) : [];
      mapping = `<div class="form-grid">${colSel('date', 'Colonne date')}${colSel('user', 'Colonne commercial')}
        <label class="field"><span>Calcul</span><select class="input sm" data-change="wizSet" data-k="mode"><option value="count" ${w.mode === 'count' ? 'selected' : ''}>Compter les lignes (1 ligne = 1)</option><option value="sum" ${w.mode === 'sum' ? 'selected' : ''}>Additionner un montant</option></select></label>
        ${w.mode === 'sum' ? colSel('amount', 'Colonne montant (TTC)') : '<div></div>'}
        <label class="field"><span>KPI alimenté</span><select class="input sm" data-change="wizSet" data-k="kpi">${kpiList().map(k => `<option value="${k.id}" ${w.kpi === k.id ? 'selected' : ''}>${esc(k.label)}</option>`).join('')}<option value="_cat" ${w.kpi === '_cat' ? 'selected' : ''}>Selon une colonne (code produit…)</option></select></label>
        ${w.kpi === '_cat' ? colSel('cat', 'Colonne catégorie / code produit') : '<div></div>'}</div>
        ${w.kpi === '_cat' && cats.length ? `<h3 style="margin:16px 0 6px">Codes produit → KPI</h3><div class="table-wrap"><table class="t"><tbody>${cats.map(c => `<tr><td>${esc(c)}</td><td><select class="input sm" data-change="wizCat" data-c="${esc(c)}"><option value="">Ignorer</option>${kpiList().map(k => `<option value="${k.id}" ${w.catMap[c] === k.id ? 'selected' : ''}>${esc(k.label)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>` : ''}
        ${names.length ? `<h3 style="margin:16px 0 6px">Commerciaux du fichier → membres</h3><p class="muted small" style="margin-top:0">Les lignes d’un nom « Ignorer » ne sont pas importées (ex. ventes en ligne, automates).</p><div class="table-wrap"><table class="t"><tbody>${names.map(n => `<tr><td>${esc(n)}</td><td><select class="input sm" data-change="wizUser" data-n="${esc(n)}"><option value="">Ignorer</option>${users.map(u => `<option value="${u.id}" ${w.userMap[n] === u.id ? 'selected' : ''}>${esc(fullName(u))}${u.status !== 'active' ? ' (' + (u.status === 'archived' ? 'archivé' : 'en attente') + ')' : ''}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>` : ''}`;
    } else if (w.type === 'clients') {
      mapping = `<div class="form-grid">${colSel('name', 'Nom (ou nom complet)')}${colSel('first', 'Prénom', true)}${colSel('phone', 'Téléphone', true)}${colSel('email', 'E-mail', true)}${colSel('birth', 'Date de naissance', true)}${colSel('start', 'Début de contrat', true)}${colSel('end', 'Fin de contrat', true)}${colSel('offer', 'Offre', true)}</div>`;
    } else if (w.type === 'soldes') {
      mapping = `<div class="form-grid">${colSel('name', 'Nom (ou nom complet)')}${colSel('first', 'Prénom', true)}${colSel('balance', 'Solde dû')}${colSel('phone', 'Téléphone', true)}</div><p class="muted small">Les clients absents du fichier repassent à un solde nul. Un client inconnu est ajouté à la base.</p>`;
    } else {
      mapping = `<div class="form-grid">${colSel('name', 'Client')}${colSel('first', 'Prénom', true)}${colSel('date', 'Date de résiliation')}${colSel('reason', 'Motif', true)}</div>`;
    }
    return `<div class="card">${steps(2)}<div class="row wrap" style="margin-bottom:14px">${ico('list')}<b>${esc(w.name)}</b><span class="muted">${w.rows.length} lignes · ${H.length} colonnes</span><span class="spacer"></span>
      <label class="field" style="min-width:260px"><span>Type de fichier</span><select class="input sm" data-change="wizProfile">${IMPORT_PROFILES.map(p => `<option value="${p.id}" ${w.profile === p.id ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select></label></div>
      ${mapping}
      <h3 style="margin:18px 0 6px">Aperçu</h3><div class="table-wrap"><table class="t"><thead><tr>${H.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${w.rows.slice(0, 5).map(r => `<tr>${r.map(c => `<td class="nowrap">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="row" style="margin-top:16px"><button class="btn" data-act="wizCancel">Annuler</button><span class="spacer"></span><button class="btn primary" data-act="wizNext">Vérifier ${ico('chevR')}</button></div></div>`;
  }
  // etape 3 : validation
  const plan = w.plan;
  return `<div class="card">${steps(3)}
    ${plan.type === 'kpi' ? `<div class="row wrap" style="gap:22px;margin-bottom:12px"><div><div class="muted small">Saisies à créer</div><b class="title" style="font-size:24px">${plan.entries.length}</b></div><div><div class="muted small">Période</div><b>${plan.entries.length ? `${dmy(plan.from)} → ${dmy(plan.to)}` : '—'}</b></div><div><div class="muted small">Doublons ignorés</div><b class="${plan.dups ? 'warn' : ''}">${plan.dups}</b></div><div><div class="muted small">Lignes ignorées</div><b>${plan.skipped}</b></div></div>
      ${plan.dups ? `<div class="alert" style="margin-bottom:12px">${plan.dups} ligne(s) existent déjà dans un import actif (même commercial, KPI, jour et montant) : elles ne seront pas comptées deux fois.</div>` : ''}
      <div class="table-wrap"><table class="t"><thead><tr><th>Membre</th><th>KPI</th><th class="num">Total importé</th><th class="num">Lignes</th></tr></thead><tbody>${plan.summary.map(s => `<tr><td>${esc(fullName(S.users[s.userId]))}</td><td>${esc(S.kpis[s.kpiId].label)}</td><td class="num">${fmtV(s.value, S.kpis[s.kpiId].unit)}</td><td class="num">${s.n}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Aucune ligne exploitable.</td></tr>'}</tbody></table></div>`
      : `<div class="row wrap" style="gap:22px;margin-bottom:12px"><div><div class="muted small">${plan.type === 'resil' ? 'Résiliations' : 'Clients'} à créer</div><b class="title" style="font-size:24px">${plan.created}</b></div><div><div class="muted small">À mettre à jour</div><b class="title" style="font-size:24px">${plan.updated}</b></div><div><div class="muted small">Lignes ignorées</div><b>${plan.skipped}</b></div></div>`}
    <div class="row" style="margin-top:16px"><button class="btn" data-act="wizBack">${ico('chevL')} Retour</button><button class="btn ghost" data-act="wizCancel">Annuler</button><span class="spacer"></span><button class="btn primary" data-act="wizCommit" ${plan.empty ? 'disabled' : ''}>Importer dans ${esc(CLUB.name)}</button></div></div>`;
}
ACTIONS.wizCol = el => { UI.wiz.col[el.dataset.k] = el.value; if (el.dataset.k === 'user') UI.wiz.userMap = {}; render(); };
ACTIONS.wizSet = el => { UI.wiz[el.dataset.k] = el.value; render(); };
ACTIONS.wizCat = el => { UI.wiz.catMap[el.dataset.c] = el.value; };
ACTIONS.wizUser = el => { UI.wiz.userMap[el.dataset.n] = el.value; };
ACTIONS.wizProfile = el => { const p = IMPORT_PROFILES.find(x => x.id === el.value); Object.assign(UI.wiz, { profile: p.id, type: p.type, kpi: p.kpi || UI.wiz.kpi, mode: p.mode || UI.wiz.mode }); render(); };
ACTIONS.wizCancel = () => { UI.wiz = null; render(); };
ACTIONS.wizBack = () => { UI.wiz.step = 2; render(); };
ACTIONS.wizNext = () => {
  const w = UI.wiz; const c = w.col; const get = (r, k) => c[k] === '' ? '' : r[Number(c[k])];
  const plan = { type: w.type, skipped: 0 };
  if (w.type === 'kpi') {
    if (c.date === '' || c.user === '' || (w.mode === 'sum' && c.amount === '') || (w.kpi === '_cat' && c.cat === '')) { toast('Choisissez les colonnes obligatoires.'); return; }
    // empreinte des saisies deja importees et actives, pour ignorer les doublons
    // On compte les occurrences : deux ventes identiques dans le MEME fichier
    // sont deux ventes ; ce qui est en trop, c'est ce qu'un import actif a deja.
    const seen = new Map();
    Object.values(S.entries).filter(e => e.importId && S.imports[e.importId] && S.imports[e.importId].active !== false)
      .forEach(e => { const k = `${e.userId}|${e.kpiId}|${e.date}|${e.value}|${e.rowKey || ''}`; seen.set(k, (seen.get(k) || 0) + 1); });
    const inFile = new Map();
    const entries = []; const sum = {}; let dups = 0; let from = '9999', to = '0000';
    w.rows.forEach(r => {
      const date = toDate(get(r, 'date')); const uid = w.userMap[get(r, 'user')]; const kpiId = w.kpi === '_cat' ? w.catMap[get(r, 'cat')] : w.kpi;
      const value = w.mode === 'sum' ? Math.round(toNum(get(r, 'amount')) * 100) / 100 : 1;
      if (!date || !uid || !kpiId || !value) { plan.skipped++; return; }
      const rowKey = norm(r.join('|')).slice(0, 80);
      const key = `${uid}|${kpiId}|${date}|${value}|${rowKey}`;
      const n = (inFile.get(key) || 0) + 1; inFile.set(key, n);
      if (n <= (seen.get(key) || 0)) { dups++; return; }
      entries.push({ userId: uid, kpiId, date, value, rowKey });
      if (date < from) from = date; if (date > to) to = date;
      const sk = uid + '|' + kpiId; (sum[sk] = sum[sk] || { userId: uid, kpiId, value: 0, n: 0 }); sum[sk].value += value; sum[sk].n++;
    });
    Object.assign(plan, { entries, dups, from, to, summary: Object.values(sum).sort((a, b) => fullName(S.users[a.userId]).localeCompare(fullName(S.users[b.userId]))), empty: !entries.length });
  } else {
    if (c.name === '' || (w.type === 'soldes' && c.balance === '') || (w.type === 'resil' && c.date === '')) { toast('Choisissez les colonnes obligatoires.'); return; }
    const existing = Object.values(w.type === 'resil' ? S.resiliations : S.clients).filter(x => x.clubId === CLUB.id);
    const findC = (name, email, birth) => existing.find(x => (email && x.email && norm(x.email) === norm(email)) || (norm(x.name || x.client) === norm(name) && (!birth || !x.birth || x.birth === birth)));
    const items = []; let created = 0, updated = 0;
    w.rows.forEach(r => {
      const name = [get(r, 'first'), get(r, 'name')].filter(Boolean).join(' ').trim();
      if (!name) { plan.skipped++; return; }
      if (w.type === 'resil') {
        const date = toDate(get(r, 'date')); if (!date) { plan.skipped++; return; }
        const old = existing.find(x => norm(x.client) === norm(name) && x.date === date);
        if (old) { updated++; return; }
        created++; items.push({ client: name, date, reason: get(r, 'reason') || '' }); return;
      }
      const rec = { name, phone: get(r, 'phone') || '', email: get(r, 'email') || '', birth: toDate(get(r, 'birth')), start: toDate(get(r, 'start')), end: toDate(get(r, 'end')), offer: get(r, 'offer') || '' };
      if (w.type === 'soldes') rec.balance = Math.round(toNum(get(r, 'balance')) * 100) / 100;
      const old = findC(name, rec.email, rec.birth);
      if (old) updated++; else created++;
      items.push({ old: old ? old.id : null, rec });
    });
    Object.assign(plan, { items, created, updated, empty: !items.length });
  }
  w.plan = plan; w.step = 3; render();
};
ACTIONS.wizCommit = () => {
  const w = UI.wiz; const plan = w.plan; const impId = newId(); const ops = [];
  const meta = { id: impId, name: w.name, type: w.type, profile: w.profile, clubId: CLUB.id, at: Date.now(), rows: w.rows.length, active: true, by: ME.id };
  if (plan.type === 'kpi') {
    plan.entries.forEach(e => { const id = newId(); ops.push([['entries', id], { id, ...e, clubId: CLUB.id, source: 'import', importId: impId, at: Date.now() }]); });
    Object.assign(meta, { from: plan.from, to: plan.to, count: plan.entries.length });
  } else if (plan.type === 'resil') {
    plan.items.forEach(x => { const id = newId(); ops.push([['resiliations', id], { id, clubId: CLUB.id, ...x, saved: false, importId: impId, at: Date.now() }]); });
    meta.count = plan.items.length;
  } else {
    const touched = new Set();
    plan.items.forEach(({ old, rec }) => {
      const id = old || newId(); touched.add(id);
      const base = old ? S.clients[old] : { id, clubId: CLUB.id };
      const merged = { ...base };
      Object.entries(rec).forEach(([k, v]) => { if (v !== '' && v != null) merged[k] = v; });
      if (plan.type === 'soldes' && (Number(base.balance) || 0) !== rec.balance) merged.balanceAt = today();
      ops.push([['clients', id], merged]);
    });
    if (plan.type === 'soldes') Object.values(S.clients).filter(c => c.clubId === CLUB.id && !touched.has(c.id) && Number(c.balance) > 0).forEach(c => ops.push([['clients', c.id, 'balance'], 0]));
    meta.count = plan.items.length;
  }
  ops.push([['imports', impId], meta]);
  db.batch(ops); UI.wiz = null; UI.impTab = 'history'; render(); toast('Import terminé ✅');
};

function impHistory() {
  const f = UI.impFilter || 'all';
  const all = Object.values(S.imports).filter(i => i.clubId === CLUB.id).sort((a, b) => b.at - a.at);
  const cnt = t => all.filter(i => t === 'all' || i.type === t || (t === 'clients' && i.type === 'soldes')).length;
  const list = all.filter(i => f === 'all' || i.type === f || (f === 'clients' && i.type === 'soldes'));
  const shown = UI.impMore ? list : list.slice(0, 10);
  const label = { kpi: 'KPI', clients: 'Base client', soldes: 'Solde clients', resil: 'Résiliations', control: 'Contrôle' };
  return `<div class="row wrap" style="margin-bottom:12px">${seg('impFilter', [['all', `Tous ${cnt('all')}`], ['kpi', `KPI ${cnt('kpi')}`], ['clients', `Base client ${cnt('clients')}`], ['resil', `Résiliations ${cnt('resil')}`]], f)}</div>
    <div class="card" style="padding:6px 16px">${shown.map(i => `<div class="row wrap" style="padding:12px 0;border-bottom:1px solid var(--line)">${ico('list')}<div class="spacer"><b>${esc(i.name)}</b> <span class="badge ${i.active === false ? '' : 'ok'}">${i.active === false ? 'Annulé' : 'Actif'}</span> <span class="badge">${label[i.type] || i.type}</span>${i.source === 'resamania' ? ' <span class="badge fp">Resamania</span>' : ''}
      <div class="muted small">${i.from ? `${dmy(i.from)} → ${dmy(i.to)} · ` : ''}${i.count ?? i.rows} ligne(s) importée(s) sur ${i.rows} · ${dmy(isoOf(new Date(i.at)))} par ${esc(fullName(S.users[i.by]))}</div></div>
      ${i.type === 'kpi' ? `<button class="btn sm" data-act="impDetail" data-id="${i.id}">Détail ${ico('chevR')}</button>` : ''}
      ${i.active === false ? `<button class="btn sm" data-act="impRestore" data-id="${i.id}">${ico('undo')} Rétablir</button>` : `<button class="btn sm danger" data-act="impCancel" data-id="${i.id}">Annuler l’import</button>`}</div>`).join('') || '<div class="empty">Aucun import.</div>'}
    ${list.length > 10 && !UI.impMore ? `<div style="padding:12px 0"><button class="btn sm" data-act="ui" data-key="impMore" data-val="1">Voir les ${list.length - 10} imports plus anciens</button></div>` : ''}</div>`;
}
ACTIONS.impCancel = async el => {
  const i = S.imports[el.dataset.id];
  const extra = i.type === 'kpi' ? 'Ses saisies ne compteront plus dans les tableaux de bord ni le classement.' : i.type === 'resil' ? 'Les résiliations créées par cet import seront retirées.' : 'Les fiches clients restent en place (elles ont pu être complétées depuis).';
  if (!await confirmDlg(`Annuler l’import « ${esc(i.name)} » ? ${extra} Vous pourrez le rétablir.`, { ok: 'Annuler l’import', danger: true })) return;
  const ops = [[['imports', i.id, 'active'], false]];
  if (i.type === 'resil') Object.values(S.resiliations).filter(r => r.importId === i.id).forEach(r => ops.push([['resiliations', r.id, 'hidden'], true]));
  db.batch(ops); toast('Import annulé.');
};
ACTIONS.impRestore = el => { const i = S.imports[el.dataset.id]; const ops = [[['imports', i.id, 'active'], true]]; Object.values(S.resiliations).filter(r => r.importId === i.id).forEach(r => ops.push([['resiliations', r.id, 'hidden'], null])); db.batch(ops); toast('Import rétabli.'); };
ACTIONS.impDetail = el => {
  const i = S.imports[el.dataset.id];
  const rows = Object.values(S.entries).filter(e => e.importId === i.id).sort((a, b) => a.date.localeCompare(b.date));
  openModal({ title: i.name, drawer: true, body: `<div class="table-wrap"><table class="t"><thead><tr><th>Membre</th><th>Date</th><th>KPI</th><th class="num">Valeur</th><th></th></tr></thead><tbody>
    ${rows.map(e => `<tr><td>${esc(fullName(S.users[e.userId]))}</td><td>${dm(e.date)}</td><td>${esc(S.kpis[e.kpiId] ? S.kpis[e.kpiId].label : '')}</td><td class="num">${fmtV(e.value, S.kpis[e.kpiId] ? S.kpis[e.kpiId].unit : 'qty')}</td><td><button class="btn ghost icon sm" data-delimp="${e.id}" title="Retirer cette ligne">${ico('trash')}</button></td></tr>`).join('')}</tbody></table></div>
    <p class="muted small">${rows.length} ligne(s) active(s) sur ${i.rows}.</p>`,
    onMount: m => m.addEventListener('click', async e => { const b = e.target.closest('[data-delimp]'); if (b && await confirmDlg('Retirer cette ligne de l’import ?', { ok: 'Retirer', danger: true })) { db.set(['entries', b.dataset.delimp], null); } }) });
};

// Saisie manuelle : l'historique mensuel du club, pour la comparaison
// annuelle (utile pour les mois d'avant Fit Pulse).
const MANUAL_FIELDS = [['contrats', 'Contrats signés', 'qty'], ['visiteurs', 'Visiteurs', 'qty'], ['complements', 'Compléments (nutrition) €', 'eur'], ['goodies', 'Goodies (accessoires) €', 'eur'], ['impayes', 'Impayés récupérés €', 'eur'], ['caPack', 'CA Pack €', 'eur']];
function impManual() {
  const y = Number(UI.manYear || curMonth().slice(0, 4));
  const cm = curMonth();
  const data = S.monthly[CLUB.id] || {};
  const warn = [];
  for (let m = 1; m <= 12; m++) { const v = data[`${y}-${pad(m)}`]; if (v && Number(v.impayes) > 3 * (Number(v.caPack) || 0) && Number(v.caPack) > 0) warn.push(MOIS[m - 1]); }
  return `<div class="row wrap" style="margin-bottom:12px"><div class="row" style="gap:4px"><button class="btn icon sm" data-act="ui" data-key="manYear" data-val="${y - 1}">${ico('chevL')}</button><b style="min-width:60px;text-align:center">${y}</b><button class="btn icon sm" data-act="ui" data-key="manYear" data-val="${y + 1}">${ico('chevR')}</button></div><span class="badge ok">Enregistrement automatique</span><span class="spacer"></span><span class="muted small">${esc(CLUB.name)}</span></div>
    ${warn.length ? `<div class="alert" style="margin-bottom:12px"><div><b>À vérifier : ${warn.join(', ')}</b>Les impayés y dépassent largement le CA Pack : deux colonnes ont peut-être été inversées.</div></div>` : ''}
    <div class="table-wrap"><table class="t"><thead><tr><th>Mois ${y}</th>${MANUAL_FIELDS.map(f => `<th class="num">${f[1]}</th>`).join('')}</tr></thead><tbody>
    ${MOIS.map((ml, i) => { const mk = `${y}-${pad(i + 1)}`; const dis = mk >= cm; return `<tr><td>${ml}${mk === cm ? ' <span class="badge">en cours</span>' : ''}</td>${MANUAL_FIELDS.map(([k, , u]) => `<td class="num"><input class="cell" type="number" step="${u === 'eur' ? '0.01' : '1'}" min="0" value="${deepGet(data, [mk, k]) ?? ''}" data-change="manCell" data-mk="${mk}" data-k="${k}" ${dis ? 'disabled title="Seuls les mois terminés sont modifiables"' : ''}></td>`).join('')}</tr>`; }).join('')}</tbody></table></div>
    <p class="muted small">Seuls les mois terminés sont modifiables. Une valeur remplace les saisies du mois dans la comparaison annuelle du tableau de bord ; vider une cellule revient aux saisies. Ces chiffres n’entrent ni dans les scores ni dans le classement.</p>`;
}
ACTIONS.manCell = el => { const v = el.value === '' ? null : toNum(el.value); db.set(['monthly', CLUB.id, el.dataset.mk, el.dataset.k], v); toast('Enregistré'); };

// ── Action Retention ──────────────────────────────────────────────────────
PAGES.loyalty = {
  title: 'Action Rétention',
  render() {
    const tab = UI.loyTab || 'tasks';
    const tasks = loyaltyTasks(CLUB.id);
    const todo = tasks.filter(t => t.state === 'todo');
    const clients = Object.values(S.clients).filter(c => c.clubId === CLUB.id);
    const alerts = [];
    if (!clients.length) alerts.push(['Aucune base client importée', 'Importez l’export Resamania « Résumé clients » (Imports CSV) pour générer les appels de suivi, anniversaires et renouvellements.']);
    else {
      if (!clients.some(c => c.birth)) alerts.push(['Aucune date de naissance', 'Les anniversaires ne remonteront pas : vérifiez la colonne date de naissance de l’export « Résumé clients ».']);
      if (!Object.values(S.imports).some(i => i.clubId === CLUB.id && i.type === 'soldes' && i.active !== false) && !clients.some(c => Number(c.balance) > 0)) alerts.push(['Aucun solde importé', 'Les impayés n’apparaîtront pas tant que l’export « Solde clients » n’est pas importé.']);
    }
    const body = tab === 'tasks' ? loyTasks(todo) : tab === 'perf' ? loyPerf() : loyLost(tasks.filter(t => t.state === 'lost'));
    return `<div class="page-head"><div><h1>Action Rétention</h1><p>${esc(CLUB.name)} · ${todo.length} tâche(s) à traiter · ${clients.length} client(s) en base</p></div><span class="spacer"></span><button class="btn" data-act="loyHistory">${ico('history')} Historique</button>${isManager() ? `<button class="btn" data-act="addClient">${ico('plus')} Client</button>` : ''}</div>
      ${alerts.map(([t, d]) => `<div class="alert" style="margin-bottom:10px">${ico('info')}<div><b>${t}</b>${d}</div></div>`).join('')}
      ${tabs('loyTab', [['tasks', `Tâches (${todo.length})`], ['perf', 'Performance'], ['lost', 'Perdus']], tab)}${body}`;
  },
};
function loyTasks(todo) {
  const f = UI.loyType || 'all';
  const q = norm(UI.loyQ || '');
  const sort = UI.loySort || 'due';
  let list = todo.filter(t => (f === 'all' || t.type === f) && (!q || norm(t.client.name).includes(q)));
  const prio = { impaye: 0, mandat: 1, renouvellement: 2, suivi: 3, anniversaire: 4 };
  list.sort((a, b) => sort === 'amount' ? (b.amount || 0) - (a.amount || 0) : sort === 'prio' ? prio[a.type] - prio[b.type] || a.due.localeCompare(b.due) : a.due.localeCompare(b.due));
  const cnt = t => todo.filter(x => t === 'all' || x.type === t).length;
  return `<div class="row wrap" style="margin-bottom:12px">${seg('loyType', [['all', `Tous ${cnt('all')}`], ...Object.entries(LOYALTY_TYPES).map(([k, v]) => [k, `${v.icon} ${v.label} ${cnt(k)}`])], f)}<span class="spacer"></span>
    <input class="input sm" style="width:180px" placeholder="Rechercher un client" data-input="loyQ" data-focus="loyQ" value="${esc(UI.loyQ || '')}">
    <select class="input sm" style="width:auto" data-change="loySort"><option value="due" ${sort === 'due' ? 'selected' : ''}>Tri : échéance</option><option value="prio" ${sort === 'prio' ? 'selected' : ''}>Tri : pertinence</option><option value="amount" ${sort === 'amount' ? 'selected' : ''}>Tri : montant</option></select></div>
    ${list.length ? `<div class="grid">${list.map(t => { const ty = LOYALTY_TYPES[t.type]; return `<div class="card row wrap" style="padding:12px 14px"><span style="font-size:22px">${ty.icon}</span><div class="spacer"><b>${esc(t.client.name)}</b> <span class="badge">${ty.label}</span>${t.failed ? ` <span class="badge warn">${t.failed}/${MAX_ATTEMPTS} tentative(s)</span>` : ''}
      <div class="muted small">${ico('phone')} ${esc(t.client.phone || 'pas de téléphone')} · ${t.type === 'impaye' ? `<b class="bad">${fmtE(t.amount)} dus</b>${t.client.incidents ? ` · ${t.client.incidents} incident(s)` : ''}` : t.type === 'mandat' ? 'abonné sans mandat de prélèvement : faire signer le mandat' : t.type === 'anniversaire' ? `anniversaire le ${dm(t.due)}` : t.type === 'renouvellement' ? `fin de contrat le ${dmy(t.due)}` : `adhérent depuis le ${dmy(t.client.start)}`}${t.client.offer ? ' · ' + esc(t.client.offer) : ''}</div></div>
      <div class="row wrap" style="gap:6px">${Object.entries(OUTCOMES).filter(([k]) => t.type === 'impaye' || k !== 'paid').map(([k, o]) => `<button class="btn sm" data-act="loyAct" data-c="${t.client.id}" data-t="${t.type}" data-o="${k}">${o.label}</button>`).join('')}</div></div>`; }).join('')}</div>`
      : '<div class="card empty"><div class="title">Aucune tâche</div><p>Rien à traiter sur cette vue pour le moment.</p></div>'}`;
}
ACTIONS.loyQ = el => { UI.loyQ = el.value; render(); };
ACTIONS.loySort = el => { UI.loySort = el.value; render(); };
ACTIONS.loyAct = el => {
  const { c, t, o } = el.dataset;
  const save = (note = '') => {
    const id = newId(); const ops = [[['loyalty', id], { id, clientId: c, type: t, outcome: o, userId: ME.id, note, at: Date.now() }]];
    if (o === 'paid') { const amt = Number(S.clients[c].balance) || 0; ops.push([['clients', c, 'balance'], 0]); if (amt > 0) { const eid = newId(); ops.push([['entries', eid], { id: eid, userId: ME.id, clubId: CLUB.id, kpiId: 'impayes', date: today(), value: amt, source: 'manual', at: Date.now(), by: ME.id, from: 'retention' }]); } }
    db.batch(ops); toast(o === 'paid' ? 'Réglé : ajouté à vos impayés récupérés 💶' : 'Action enregistrée');
  };
  if (o === 'lost' || o === 'rdv') {
    openModal({ title: OUTCOMES[o].label, body: `<label class="field"><span>Note (facultatif)</span><textarea class="input" id="ln" placeholder="${o === 'lost' ? 'Motif du refus…' : 'Date et heure du RDV…'}"></textarea></label>`,
      foot: '<button class="btn" data-close>Annuler</button><button class="btn primary" id="lok">Enregistrer</button>', onMount: m => $('#lok', m).addEventListener('click', () => { const n = $('#ln').value; closeModal(); save(n); }) });
  } else save();
};
function loyPerf() {
  const mk = UI.loyMonth || curMonth();
  const from = dateOf(mk + '-01').getTime(), to = dateOf(addMonths(mk, 1) + '-01').getTime();
  const clientIds = new Set(Object.values(S.clients).filter(c => c.clubId === CLUB.id).map(c => c.id));
  const acts = Object.values(S.loyalty).filter(a => a.at >= from && a.at < to && clientIds.has(a.clientId));
  const by = {}; acts.forEach(a => { const x = by[a.userId] = by[a.userId] || { n: 0, ok: 0 }; x.n++; if (OUTCOMES[a.outcome] && OUTCOMES[a.outcome].done && !OUTCOMES[a.outcome].lost) x.ok++; });
  const rows = Object.entries(by).sort((a, b) => b[1].n - a[1].n);
  return `<div class="row" style="margin-bottom:12px">${monthNav('loyMonth', mk)}</div>
    ${rows.length ? `<div class="card">${rows.map(([uid, x], i) => `<div class="rank-row"><div class="rank-n">${i + 1}</div><div class="row">${avatar(S.users[uid])}<b>${esc(fullName(S.users[uid]))}</b></div><div>${progressBar(x.n ? x.ok / x.n : 0, { ticks: false })}<span class="muted small">${fmtP(x.n ? x.ok / x.n : 0)} de succès</span></div><b class="num">${x.n} action(s)</b></div>`).join('')}</div>`
      : '<div class="card empty"><div class="title">Aucune action ce mois-ci</div><p>Le classement démarre au premier appel.</p></div>'}`;
}
function loyLost(list) {
  return list.length ? `<div class="grid">${list.map(t => `<div class="card row wrap" style="padding:12px 14px"><span style="font-size:20px">${LOYALTY_TYPES[t.type].icon}</span><div class="spacer"><b>${esc(t.client.name)}</b> <span class="badge bad">${LOYALTY_TYPES[t.type].label}</span><div class="muted small">${t.acts.length} tentative(s) · dernière : ${t.acts[0] ? esc(OUTCOMES[t.acts[0].outcome].label) + ' par ' + esc(fullName(S.users[t.acts[0].userId])) + ', ' + ago(t.acts[0].at) : '—'}${t.acts[0] && t.acts[0].note ? ' · « ' + esc(t.acts[0].note) + ' »' : ''}</div></div><button class="btn sm" data-act="loyRetry" data-c="${t.client.id}" data-t="${t.type}">Relancer</button></div>`).join('')}</div>`
    : '<div class="card empty"><div class="title">Aucun client perdu</div><p>Les relances épuisées (3 tentatives) ou abandonnées apparaîtront ici.</p></div>';
}
ACTIONS.loyRetry = el => { const id = newId(); db.set(['loyalty', id], { id, clientId: el.dataset.c, type: el.dataset.t, outcome: 'reopen', userId: ME.id, at: Date.now() }); toast('Remis dans les tâches'); };
ACTIONS.loyHistory = () => {
  const clientIds = new Set(Object.values(S.clients).filter(c => c.clubId === CLUB.id).map(c => c.id));
  const acts = Object.values(S.loyalty).filter(a => clientIds.has(a.clientId)).sort((a, b) => b.at - a.at).slice(0, 100);
  openModal({ title: 'Historique des actions', drawer: true, body: `<p class="muted small" style="margin-top:0">Les dernières actions réalisées par le club.</p>${acts.map(a => `<div style="padding:9px 0;border-bottom:1px solid var(--line)"><div class="row small"><b>${esc(S.clients[a.clientId] ? S.clients[a.clientId].name : '?')}</b><span class="badge">${LOYALTY_TYPES[a.type] ? LOYALTY_TYPES[a.type].label : a.type}</span><span class="spacer"></span><span class="muted">${ago(a.at)}</span></div><div class="small"><span class="${OUTCOMES[a.outcome] ? OUTCOMES[a.outcome].cls : ''}">${OUTCOMES[a.outcome] ? OUTCOMES[a.outcome].label : 'Relancé'}</span> · ${esc(fullName(S.users[a.userId]))}${a.note ? ` · « ${esc(a.note)} »` : ''}</div></div>`).join('') || '<div class="empty">Aucune action réalisée pour le moment.</div>'}` });
};
ACTIONS.addClient = () => openModal({ title: 'Ajouter un client', body: `<form id="cf" class="form-grid"><label class="field full"><span>Nom complet</span><input class="input" name="name" required></label><label class="field"><span>Téléphone</span><input class="input" name="phone"></label><label class="field"><span>E-mail</span><input class="input" name="email"></label><label class="field"><span>Date de naissance</span><input class="input" type="date" name="birth"></label><label class="field"><span>Début de contrat</span><input class="input" type="date" name="start"></label><label class="field"><span>Fin de contrat</span><input class="input" type="date" name="end"></label><label class="field"><span>Solde dû (€)</span><input class="input" type="number" step="0.01" name="balance"></label></form>`,
  foot: '<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="saveClient">Ajouter</button>' });
ACTIONS.saveClient = () => { const f = formData($('#cf')); if (!f.name.trim()) return; const id = newId(); db.set(['clients', id], { id, clubId: CLUB.id, name: f.name.trim(), phone: f.phone, email: f.email, birth: f.birth || null, start: f.start || null, end: f.end || null, balance: toNum(f.balance), balanceAt: today() }); closeModal(); toast('Client ajouté.'); };

// ── Mes clubs ─────────────────────────────────────────────────────────────
PAGES.clubs = {
  title: 'Mes clubs',
  manager: true,
  render() {
    const tab = UI.clubTab || 'clubs';
    return `<div class="page-head"><div><h1>Mes clubs</h1><p>Uniquement nos clubs Fitness Park. Aucun autre club ne voit ces données.</p></div><span class="spacer"></span>${tab === 'clubs' && isCreator() ? `<button class="btn primary" data-act="clubForm">${ico('plus')} Ajouter un club</button>` : ''}</div>
      ${tabs('clubTab', [['clubs', 'Nos clubs'], ['base', 'Adhérents'], ...(isCreator() ? [['settings', 'Réglages']] : [])], tab)}${{ clubs: clubList, base: clubBase, settings: isCreator() ? clubSettings : clubList }[tab]()}`;
  },
};
function clubList() {
  const clubs = myClubs().sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(300px, 100%), 1fr))">${clubs.map(c => {
    const r = rangeOf('month', curMonth()); const st = statsFor(c.id, null, r);
    return `<div class="card"><div class="card-head">${ico('building')}<div class="spacer"><h3>${esc(c.name)}</h3><div class="muted small">${esc([c.address, c.city].filter(Boolean).join(', ') || 'Adresse non renseignée')}</div></div>${isCreator() ? `<button class="btn ghost icon sm" data-act="clubForm" data-id="${c.id}">${ico('edit')}</button>` : ''}</div>
      <div class="row small"><span>${clubMembers(c.id).length} membre(s) actif(s)</span><span class="spacer"></span><b>${fmtP(st.max ? st.earned / st.max : null)}</b> <span class="muted">du mois</span></div>${progressBar(st.max ? st.earned / st.max : 0, { pace: st.expected })}
      ${c.address || c.city ? `<a class="btn sm" style="margin-top:12px" target="_blank" rel="noopener" href="https://www.openstreetmap.org/search?query=${encodeURIComponent([c.address, c.city].join(' '))}">${ico('map')} Voir sur la carte</a>` : ''}</div>`;
  }).join('')}</div>`;
}
ACTIONS.clubForm = el => {
  const c = el.dataset.id ? S.clubs[el.dataset.id] : null;
  openModal({ title: c ? 'Modifier le club' : 'Ajouter un club', body: `<form id="clf" class="grid"><label class="field"><span>Nom</span><input class="input" name="name" value="${esc(c ? c.name : 'Fitness Park ')}" required></label><label class="field"><span>Adresse</span><input class="input" name="address" value="${esc(c ? c.address : '')}"></label><label class="field"><span>Code postal et ville</span><input class="input" name="city" value="${esc(c ? c.city : '')}"></label></form>`,
    foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="clubSave" data-id="${c ? c.id : ''}">Enregistrer</button>` });
};
ACTIONS.clubSave = el => {
  const f = formData($('#clf')); if (!f.name.trim()) return;
  let id = el.dataset.id;
  if (!id) { id = norm(f.name).replace(/ /g, '-').slice(0, 30) || newId(); if (S.clubs[id]) id += '-' + newId().slice(-4); }
  const ops = [[['clubs', id], { ...(S.clubs[id] || { id, createdAt: Date.now() }), name: f.name.trim(), address: f.address.trim(), city: f.city.trim() }]];
  if (!el.dataset.id) ops.push([['users', ME.id, 'clubs'], [...(ME.clubs || []), id]]);
  db.batch(ops); closeModal(); toast('Club enregistré.');
};
function clubBase() {
  const y = Number(UI.baseYear || curMonth().slice(0, 4));
  const cm = curMonth(); const data = S.base[CLUB.id] || {};
  return `<div class="row wrap" style="margin-bottom:12px"><div class="row" style="gap:4px"><button class="btn icon sm" data-act="ui" data-key="baseYear" data-val="${y - 1}">${ico('chevL')}</button><b style="min-width:60px;text-align:center">${y}</b><button class="btn icon sm" data-act="ui" data-key="baseYear" data-val="${y + 1}">${ico('chevR')}</button></div><span class="muted small">${esc(CLUB.name)}</span></div>
    <div class="alert info" style="margin-bottom:12px">${ico('info')}<div>La base nette = clients actifs nets − sortants du mois. « Contrats à signer » = objectif de fin de mois − base nette : comparez-le à la somme des objectifs « Contrats signés » de l’équipe.</div></div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Mois</th><th class="num">Clients actifs nets</th><th class="num">Sortants</th><th class="num">Base nette</th><th class="num">Objectif fin de mois</th><th class="num">Contrats à signer</th><th class="num">Objectifs équipe</th></tr></thead><tbody>
    ${MOIS.map((ml, i) => { const mk = `${y}-${pad(i + 1)}`; const v = data[mk] || {}; const net = (Number(v.actifs) || 0) - (Number(v.sortants) || 0); const toSign = v.objectif ? Number(v.objectif) - net : null; const team = clubMonthTarget(mk, CLUB.id, 'contrats');
      return `<tr><td>${ml}${mk === cm ? ' <span class="badge">en cours</span>' : ''}</td>${['actifs', 'sortants'].map(k => `<td class="num"><input class="cell" type="number" min="0" value="${v[k] ?? ''}" data-change="baseCell" data-mk="${mk}" data-k="${k}"></td>`).join('')}<td class="num">${v.actifs ? fmtN(net) : '—'}</td><td class="num"><input class="cell" type="number" min="0" value="${v.objectif ?? ''}" data-change="baseCell" data-mk="${mk}" data-k="objectif"></td><td class="num">${toSign != null ? `<b>${fmtN(toSign)}</b>` : '—'}</td><td class="num ${toSign != null && team && team < toSign ? 'bad' : ''}">${team ? fmtN(team) : '—'}</td></tr>`; }).join('')}</tbody></table></div>`;
}
ACTIONS.baseCell = el => { db.set(['base', CLUB.id, el.dataset.mk, el.dataset.k], el.value === '' ? null : toNum(el.value)); toast('Enregistré'); };
function clubSettings() {
  return `<div class="grid">
    <div class="card"><h3>KPI suivis</h3><p class="muted small">Points = valeur du KPI à 100 % de l’objectif. 👑 Obligatoire = compte dans le classement global.</p>
      <div class="table-wrap"><table class="t"><thead><tr><th>Actif</th><th>KPI</th><th>Unité</th><th class="num">Points</th><th>👑 Obligatoire</th><th>Ordre</th></tr></thead><tbody>
      ${Object.values(S.kpis).sort((a, b) => a.order - b.order).map(k => `<tr><td><input type="checkbox" data-change="kpiSet" data-id="${k.id}" data-k="enabled" ${k.enabled ? 'checked' : ''}></td><td><input class="input sm" style="width:200px" value="${esc(k.label)}" data-change="kpiSet" data-id="${k.id}" data-k="label"></td><td>${k.unit === 'eur' ? '€' : 'Quantité'}</td><td class="num"><input class="cell" type="number" min="0" step="50" value="${k.points}" data-change="kpiSet" data-id="${k.id}" data-k="points"></td><td><input type="checkbox" data-change="kpiSet" data-id="${k.id}" data-k="required" ${k.required ? 'checked' : ''}></td><td><input class="cell" style="width:50px" type="number" value="${k.order}" data-change="kpiSet" data-id="${k.id}" data-k="order"></td></tr>`).join('')}</tbody></table></div>
      <button class="btn sm" style="margin-top:10px" data-act="kpiNew">${ico('plus')} Ajouter un KPI</button></div>
    <div class="card"><h3>Confidentialité</h3><p class="small">Fit Pulse ne connaît que nos clubs : pas de réseau, pas de classement inter-enseignes, pas de fil ou de chat partagé avec l’extérieur. ${backend.mode === 'firebase' ? 'En mode partagé, seules les adresses de l’équipe (Membres) peuvent lire la base, grâce aux règles Firebase.' : 'En mode local, les données ne quittent pas ce navigateur.'}</p></div>
    <div class="card"><h3>Sauvegarde</h3><p class="muted small">Exportez toutes les données (clubs, équipe, saisies, imports, clients) dans un fichier, pour les archiver ou les déplacer sur un autre appareil.</p>
      <div class="row wrap"><button class="btn" data-act="exportAll">${ico('download')} Exporter la sauvegarde</button><label class="btn">${ico('upload')} Restaurer une sauvegarde<input type="file" accept=".json" hidden data-change="importAll"></label><button class="btn" data-act="askDemo">Charger la démo</button><span class="spacer"></span><button class="btn danger" data-act="resetAll">Tout effacer</button></div></div></div>`;
}
ACTIONS.kpiSet = el => { const k = el.dataset.k; const v = el.type === 'checkbox' ? el.checked : (k === 'points' || k === 'order') ? toNum(el.value) : el.value.trim(); db.set(['kpis', el.dataset.id, k], v); };
ACTIONS.kpiNew = () => openModal({ title: 'Nouveau KPI', body: `<form id="kf" class="form-grid"><label class="field full"><span>Nom</span><input class="input" name="label" required></label><label class="field"><span>Unité</span><select class="input" name="unit"><option value="qty">Quantité</option><option value="eur">Euros</option></select></label><label class="field"><span>Points à 100 %</span><input class="input" type="number" name="points" value="300"></label><label class="field"><span>Emoji</span><input class="input" name="emoji" value="🎯"></label></form>`,
  foot: '<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="kpiCreate">Créer</button>' });
ACTIONS.kpiCreate = () => { const f = formData($('#kf')); if (!f.label.trim()) return; const id = 'k' + newId(); db.set(['kpis', id], { id, label: f.label.trim(), unit: f.unit, points: toNum(f.points), required: false, enabled: true, order: Object.keys(S.kpis).length + 1, emoji: f.emoji }); closeModal(); };
ACTIONS.exportAll = () => downloadFile(`fit-pulse-sauvegarde-${today()}.json`, JSON.stringify(S), 'application/json');
ACTIONS.importAll = el => {
  const file = el.files[0]; if (!file) return;
  const fr = new FileReader();
  fr.onload = async () => {
    let data; try { data = JSON.parse(fr.result); } catch (e) { toast('Fichier invalide.'); return; }
    if (!data.users || !data.clubs) { toast('Ce n’est pas une sauvegarde Fit Pulse.'); return; }
    if (!await confirmDlg('Remplacer toutes les données actuelles par cette sauvegarde ?', { ok: 'Restaurer', danger: true })) return;
    db.replace(data); toast('Sauvegarde restaurée.');
  };
  fr.readAsText(file);
};
ACTIONS.askDemo = async () => { if (await confirmDlg('Remplacer toutes les données par des données de démonstration fictives ? Vos accès Créateur et Manager sont conservés.', { ok: 'Charger la démo', danger: true })) ACTIONS.loadDemo(); };
