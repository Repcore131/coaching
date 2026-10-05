'use strict';
// ══ FIT PULSE — centre Resamania, impayés par canal, correspondances ═════

// ── Routines d'export (audit du 05/10/2026) ───────────────────────────────
const ROUTINE_WEEK = [
  ['ventes', 'Filtres : 30 derniers jours (sert aussi aux appels J+15 / J+30)', 'RSM_ventes-abonnements_J30_AAAA-MM-JJ.csv'],
  ['clients-incident', 'Date de visualisation = ce lundi', 'RSM_impayes-encours_AAAA-MM-JJ.csv'],
  ['sans-mandat', 'Club = votre club', 'RSM_sans-mandat_AAAA-MM-JJ.csv'],
  ['incidents', 'Statut = Régularisé, Date de régularisation = la semaine passée, Club', 'RSM_impayes-regularises_AAAA-Sxx.csv'],
  ['paiements', 'Période = la semaine (vérifier < 2 000 lignes)', 'RSM_paiements_AAAA-Sxx.csv'],
  ['abonnements', 'Fin d’engagement = 30 prochains jours, Masquer les abonnements résiliés', 'RSM_fins-contrat_AAAA-MM-JJ.csv'],
  ['clients', 'Statut = Client', 'RSM_clients_AAAA-MM-JJ.csv'],
];
const ROUTINE_MONTH = [
  ['ventes', '1er → dernier jour du mois', 'RSM_ventes-abonnements_AAAA-MM.csv'],
  ['factures', 'Mois, Entité = FPN GESTION, Club (déposez le ZIP tel quel)', 'RSM_factures-avoirs_AAAA-MM.zip'],
  ['evolution', 'Mois, Club (déposez le ZIP tel quel)', 'RSM_evolution-clients_AAAA-MM.zip'],
  ['tti', 'Mois', 'RSM_tti-commerciaux_AAAA-MM.csv'],
  ['web', 'Mois, Club', 'RSM_web-transactions_AAAA-MM.csv'],
  ['perf', 'Mois, Club (contrôle)', 'RSM_perf-commerciales_AAAA-MM.xlsx'],
  ['incidents', 'Statut = Régularisé, Date de régularisation = le mois', 'RSM_impayes-regularises_AAAA-MM.csv'],
  ['resil', 'Date de création = le mois, tous statuts', 'RSM_resiliations_AAAA-MM.csv'],
  ['prospects', 'Date de création = le mois', 'RSM_prospects_AAAA-MM.csv'],
  ['paiements', 'Période = le mois, découpé en semaines si besoin', 'RSM_paiements_AAAA-MM_S1.csv …'],
];
const defById = id => RSM_DEFS.find(d => d.id === id);
const rsmState = () => S.rsm || {};
const ctrl = (clubId = CLUB.id) => deepGet(S, ['rsm', 'controls', clubId]) || {};

// ── Onglet Resamania de la page Imports ───────────────────────────────────
function impRsm() {
  if (UI.rsmBusy) return `<div class="card empty"><div class="title">Lecture des fichiers…</div><p>Décompression et reconnaissance des exports Resamania.</p></div>`;
  if (UI.rsmBatch) return rsmReview();
  const done = UI.rsmDone ? rsmDoneCard() : '';
  const routine = deepGet(S, ['rsm', 'routine', CLUB.id]) || {};
  const wk = dateOf(weekStart(today())).getTime(), mo = dateOf(curMonth() + '-01').getTime();
  const item = ([id, filt, file], since) => {
    const d = defById(id); const ts = routine[id]; const ok = ts && ts >= since;
    return `<details class="rsm-item"><summary class="row"><span class="badge ${ok ? 'ok' : ''}" style="min-width:26px;justify-content:center">${ok ? '✓' : '·'}</span><b class="spacer">${esc(d.label)}</b><span class="muted small">${ts ? 'importé le ' + dm(isoOf(new Date(ts))) : 'jamais importé'}</span></summary>
      <div class="small" style="padding:8px 0 4px 36px;display:grid;gap:4px"><div><span class="muted">Où :</span> ${esc(d.path)}</div><div><span class="muted">Filtres :</span> ${esc(filt)}</div><div><span class="muted">Nom à donner :</span> <code>${esc(file)}</code></div><div><span class="muted">Alimente :</span> ${esc(d.feeds)}</div></div></details>`;
  };
  const cnt = (list, since) => list.filter(([id]) => (routine[id] || 0) >= since).length;
  return `${done}
    <div class="card" style="margin-bottom:14px"><div class="drop" id="rsm-drop">${ico('upload')}<div class="title" style="font-size:19px;margin-top:8px">Déposez vos exports Resamania</div>
      <div class="muted small">Plusieurs fichiers à la fois : CSV des listes, ZIP des exports de gestion (sans les décompresser), XLSX. Chaque fichier est reconnu par ses colonnes.</div></div>
      <input type="file" id="rsm-file" multiple accept=".csv,.tsv,.txt,.zip,.xlsx" hidden></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr));margin-bottom:14px">
      <div class="card"><div class="card-head">${ico('cal')}<h3>Chaque lundi</h3><span class="spacer"></span><span class="badge ${cnt(ROUTINE_WEEK, wk) === ROUTINE_WEEK.length ? 'ok' : 'warn'}">${cnt(ROUTINE_WEEK, wk)}/${ROUTINE_WEEK.length} cette semaine</span></div>
        <p class="muted small" style="margin-top:-6px">≈ 15 minutes. Lancez d’abord les exports de gestion (ils se préparent en fond, lien par e-mail), puis les listes.</p>${ROUTINE_WEEK.map(x => item(x, wk)).join('')}</div>
      <div class="card"><div class="card-head">${ico('cal')}<h3>Le 2 de chaque mois</h3><span class="spacer"></span><span class="badge ${cnt(ROUTINE_MONTH, mo) === ROUTINE_MONTH.length ? 'ok' : 'warn'}">${cnt(ROUTINE_MONTH, mo)}/${ROUTINE_MONTH.length} ce mois-ci</span></div>
        <p class="muted small" style="margin-top:-6px">Pour le mois clos. Les exports marqués (S) dans Resamania demandent un code reçu par e-mail.</p>${ROUTINE_MONTH.map(x => item(x, mo)).join('')}</div></div>
    <div class="card"><h3>Où trouver quoi dans Resamania</h3><p class="muted small">Une seule source de vérité par KPI : on n’additionne jamais deux exports pour le même chiffre.</p>
      <div class="table-wrap"><table class="t"><thead><tr><th>KPI Fit Pulse</th><th>Source Resamania</th><th>Rattachement au commercial</th></tr></thead><tbody>
      ${[['Contrats signés', 'Exports de gestion > Membres & Ventes > Vente d’abonnements', 'Commercial initial (code KGUE, AREA…)'],
         ['Nutrition', 'Exports de gestion > Finance > Factures & avoirs (DetailLignes) — ou liste Lignes de factures', 'Auteur / Vendeur'],
         ['Accessoires', 'Idem, codes produit FPARK / NO_FPARK', 'Auteur / Vendeur'],
         ['Impayés récupérés', 'Données financières > Incidents (Statut = Régularisé)', 'Auteur de la régularisation → canal'],
         ['Contrat B2B', 'Factures & avoirs : « Société du client » renseignée', 'Commercial initial'],
         ['Prospects', 'Clients > Prospects (liste) ou Prospects (S)', 'Commercial (initial)'],
         ['Taux de transformation', 'Exports de gestion > Taux de transformation par commerciaux', 'Commercial'],
         ['Résiliations / sauvetages', 'Clients > Résiliations (Etat canceled = sauvetage)', 'Créateur'],
         ['Impayés en cours', 'Points d’attention > Clients en incident', '—'],
         ['Sans mandat', 'Points d’attention > Clients abonnés sans prélèvement', '—'],
         ['Anniversaires', 'Clients > Clients club (Statut = Client)', '—'],
         ['Fins de contrat', 'Clients > Abonnements (Fin d’engagement)', '—'],
         ['Invités > Contrats', 'Pas d’export dans Resamania (liste Invitations) : saisie manuelle', '—']]
        .map(([k, s2, r]) => `<tr><td><b>${k}</b></td><td>${s2}</td><td class="muted">${r}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function mountRsm() {
  const drop = $('#rsm-drop'); if (!drop) return;
  const input = $('#rsm-file');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); rsmRead([...e.dataTransfer.files]); });
  input.addEventListener('change', () => rsmRead([...input.files]));
}
async function rsmRead(files) {
  if (!files.length) return;
  UI.rsmBusy = true; UI.rsmDone = null; render();
  const tables = [];
  for (const f of files) {
    try { tables.push(...await readAnyFile(f)); }
    catch (e) { tables.push({ name: f.name, skipped: 'Lecture impossible : ' + e.message }); }
  }
  const month = addMonths(curMonth(), -1);
  UI.rsmTables = tables;
  UI.rsmBatch = tables.map(t => { try { return analyzeTable(t, { clubId: CLUB.id, month }); } catch (e) { return { name: t.name, def: null, rowsCount: 0, entries: [], recov: [], clients: {}, clientsByName: [], resil: [], controls: [], warnings: ['Lecture impossible : ' + e.message], skipped: {} }; } });
  UI.rsmChoices = {};
  UI.rsmBusy = false; render();
}

// ── Revue avant import ────────────────────────────────────────────────────
function rsmReview() {
  const B = UI.rsmBatch;
  const unk = unknownSellers(B);
  const members = clubMembers(CLUB.id, { all: true });
  const card = (r, i) => {
    if (!r.def) return `<div class="card"><div class="row wrap">${ico('info')}<b class="spacer">${esc(r.name)}</b><span class="badge ${r.warnings.length ? '' : 'warn'}">${r.warnings.length ? 'Ignoré' : 'Non reconnu'}</span></div>
      <p class="muted small" style="margin-bottom:0">${r.warnings.length ? esc(r.warnings.join(' ')) : `${r.rowsCount} lignes. Ce n’est pas un export Resamania connu : vous pouvez l’importer à la main.`}</p>
      ${!r.warnings.length && r.rowsCount ? `<button class="btn sm" style="margin-top:8px" data-act="rsmFree" data-i="${i}">Ouvrir dans l’import libre</button>` : ''}</div>`;
    if (r.def.silent) return `<div class="card"><div class="row wrap">${ico('list')}<b class="spacer">${esc(r.name)}</b><span class="badge">Non utilisé</span></div><p class="muted small" style="margin-bottom:0">${esc(r.warnings.join(' '))}</p></div>`;
    const byK = {}; r.entries.forEach(e => { const k = byK[e.kpiId] = byK[e.kpiId] || { v: 0, n: 0 }; k.v += e.value; k.n++; });
    const byC = {}; r.recov.forEach(x => { const k = byC[x.canal] = byC[x.canal] || { v: 0, n: 0 }; k.v += x.amount; k.n++; });
    const nClients = Object.keys(r.clients).length + r.clientsByName.length;
    const lines = [
      ...Object.entries(byK).map(([k, x]) => `<div class="row small"><span>${S.kpis[k] ? (S.kpis[k].emoji || '') + ' ' + esc(S.kpis[k].label) : k}</span><span class="spacer"></span><b>${fmtV(x.v, S.kpis[k] ? S.kpis[k].unit : 'qty')}</b><span class="muted">${x.n} ligne(s)</span></div>`),
      ...Object.entries(byC).map(([k, x]) => `<div class="row small"><span>💶 Récupéré · ${esc(k === 'annule' ? 'annulé / avoir (pas d’argent encaissé)' : RECOV_CHANNELS[k].label)}</span><span class="spacer"></span><b>${fmtE(x.v)}</b><span class="muted">${x.n}</span></div>`),
      nClients ? `<div class="row small"><span>👥 Fiches clients mises à jour</span><span class="spacer"></span><b>${nClients}</b></div>` : '',
      r.balances ? `<div class="row small"><span>⚠️ Impayés en cours (photo du jour)</span><span class="spacer"></span><b>${fmtE(r.balances.list.reduce((s, x) => s + x.amount, 0))}</b><span class="muted">${r.balances.list.length} client(s)</span></div>` : '',
      r.noMandate ? `<div class="row small"><span>🏦 Adhérents sans mandat</span><span class="spacer"></span><b>${r.noMandate.length}</b></div>` : '',
      r.resil.length ? `<div class="row small"><span>🚪 Résiliations</span><span class="spacer"></span><b>${r.resil.length}</b><span class="muted">dont ${r.resil.filter(x => x.saved).length} sauvetage(s)</span></div>` : '',
      r.controls.length ? `<div class="row small"><span>🔎 Données de contrôle</span><span class="spacer"></span><b>${r.controls.length}</b>${r.def.monthly ? `<span class="muted">mois ${esc(r.month)}</span>` : ''}</div>` : '',
    ].filter(Boolean).join('');
    const skipped = Object.entries(r.skipped);
    return `<div class="card"><div class="row wrap">${ico('check')}<div class="spacer"><b>${esc(r.def.label)}</b><div class="muted small">${esc(r.name)} · ${r.rowsCount} ligne(s) · ${esc(r.encoding || '')}${r.from ? ` · ${dmy(r.from)} → ${dmy(r.to)}` : ''}</div></div><span class="badge ${r.def.family === 'liste' ? 'info' : 'fp'}">${r.def.family === 'liste' ? 'Liste' : 'Export de gestion'}</span></div>
      <div style="margin-top:10px;display:grid;gap:5px">${lines || '<span class="muted small">Rien à importer dans ce fichier.</span>'}</div>
      ${r.warnings.map(w => `<div class="alert" style="margin-top:8px;padding:8px 12px"><span class="small">${esc(w)}</span></div>`).join('')}
      ${skipped.length ? `<details style="margin-top:8px"><summary class="muted small">${skipped.reduce((s, [, n]) => s + n, 0)} ligne(s) écartée(s)</summary><div class="small muted" style="padding-top:6px">${skipped.map(([w, n]) => `${n} × ${esc(w)}`).join('<br>')}</div></details>` : ''}</div>`;
  };
  const opt = (k, cur) => `<option value="">— choisir —</option>${members.map(u => `<option value="${u.id}" ${cur === u.id ? 'selected' : ''}>${esc(fullName(u))}</option>`).join('')}<option value="system" ${cur === 'system' ? 'selected' : ''}>Vente en ligne / système (personne)</option><option value="ignore" ${cur === 'ignore' ? 'selected' : ''}>Ignorer</option>`;
  const usable = B.filter(r => r.def && !r.def.silent).length;
  return `<div class="row wrap" style="margin-bottom:12px"><h2 class="spacer">${B.length} fichier(s) analysé(s)</h2><button class="btn" data-act="rsmCancel">Annuler</button><button class="btn primary" data-act="rsmCommit" ${usable ? '' : 'disabled'}>Importer ${usable} fichier(s) dans ${esc(CLUB.name)}</button></div>
    ${unk.length ? `<div class="card" style="margin-bottom:14px;border-color:var(--fp)"><h3>Qui est qui ? ${unk.length} nom(s) Resamania à rattacher</h3><p class="muted small">Resamania écrit un vendeur sous plusieurs formes (NOM Prénom, e-mail, code). Votre choix est retenu pour les prochains imports. Sans choix, la ligne n’est attribuée à personne.</p>
      <div class="table-wrap"><table class="t"><tbody>${unk.map(u => `<tr><td><b>${esc(u.label)}</b><div class="muted small">${u.count} ligne(s)</div></td><td style="width:280px"><select class="input sm" data-change="rsmChoice" data-k="${esc(u.key)}">${opt(u.key, UI.rsmChoices[u.key])}</select></td></tr>`).join('')}</tbody></table></div></div>` : ''}
    <div class="grid">${B.map(card).join('')}</div>`;
}
ACTIONS.rsmChoice = el => { UI.rsmChoices[el.dataset.k] = el.value; };
ACTIONS.rsmCancel = () => { UI.rsmBatch = null; render(); };
ACTIONS.rsmFree = el => { const t = UI.rsmTables[Number(el.dataset.i)]; UI.rsmBatch = null; startWizardTable(t.name, { headers: t.headers, rows: t.rows }); };

// ── Enregistrement ────────────────────────────────────────────────────────
ACTIONS.rsmCommit = () => {
  const B = UI.rsmBatch, choices = UI.rsmChoices || {}, club = CLUB.id, ops = [], now = Date.now();
  const unk = unknownSellers(B);
  // 1. memoriser les correspondances choisies
  unk.forEach(u => { const ch = choices[u.key]; if (ch) u.keys.forEach(k => ops.push([['rsm', 'aliases', safeKey(k)], ch])); });
  const pick = s => { if (!s) return null; if (s.status === 'user') return s.userId; if (s.status === 'unknown') { const ch = choiceFor(s, choices, unk); return ch && ch !== 'system' && ch !== 'ignore' ? ch : null; } return null; };
  const written = new Set();
  const clientIdx = {}; Object.values(S.clients).filter(c => c.clubId === club).forEach(c => { if (c.num) clientIdx['n:' + c.num] = c; clientIdx['t:' + tokensKey(c.name || '')] = clientIdx['t:' + tokensKey(c.name || '')] || c; });
  const pendingClients = {};
  const upClient = (c0, patch) => { const id = c0.id; pendingClients[id] = { ...(pendingClients[id] || c0), ...patch }; };
  const summary = { files: 0, entries: 0, updated: 0, recov: 0, clients: 0, resil: 0, kpis: {} };
  for (const r of B) {
    if (!r.def || r.def.silent) continue;
    summary.files++;
    const impId = 'rsm_' + newId();
    const type = r.def.id === 'resil' ? 'resil' : r.entries.length ? 'kpi' : (r.balances || r.noMandate || Object.keys(r.clients).length || r.clientsByName.length) ? 'clients' : 'control';
    ops.push([['imports', impId], { id: impId, name: r.name, type, defId: r.def.id, source: 'resamania', clubId: club, at: now, rows: r.rowsCount, count: r.entries.length + r.recov.length + r.resil.length, from: r.from, to: r.to, active: true, by: ME.id }]);
    ops.push([['rsm', 'routine', club, r.def.id], now]);
    // KPI : identifiant derive de la cle de ligne -> reimport sans doublon
    for (const e of r.entries) {
      const uid = pick(e.seller); if (!uid) continue;
      const id = 'r' + hkey(club + '|' + e.key);
      if (S.entries[id] || written.has(id)) summary.updated++; else summary.entries++;
      written.add(id);
      summary.kpis[e.kpiId] = (summary.kpis[e.kpiId] || 0) + e.value;
      ops.push([['entries', id], { id, userId: uid, clubId: club, kpiId: e.kpiId, date: e.date, value: e.value, source: 'import', importId: impId, rowKey: e.key, at: now }]);
    }
    for (const x of r.recov) {
      let canal = x.canal, uid = null;
      if (canal === 'equipe') { uid = pick(x.seller); if (!uid) { const ch = choiceFor(x.seller, choices, unk); canal = ch === 'system' ? 'client' : ch === 'ignore' ? 'tiers' : 'equipe'; } }
      const id = 'v' + hkey(club + '|' + x.key);
      ops.push([['recov', id], { id, clubId: club, date: x.date, amount: x.amount, canal, userId: uid, type: x.type || '', moyen: x.moyen || '', clientNum: x.clientNum || '', author: x.author || '', importId: impId, at: now }]);
      summary.recov++;
    }
    for (const [num, o] of Object.entries(r.clients)) {
      const c0 = clientIdx['n:' + num] || { id: 'c' + hkey(club + '|n:' + num), clubId: club, num };
      clientIdx['n:' + num] = c0; upClient(c0, o); summary.clients++;
    }
    for (const o of r.clientsByName) {
      const t = tokensKey(o.name); const c0 = clientIdx['t:' + t] || { id: 'c' + hkey(club + '|t:' + t), clubId: club, name: o.name };
      clientIdx['t:' + t] = c0; const { name, ...rest } = o; upClient(c0, Object.fromEntries(Object.entries(rest).filter(([, v]) => v))); summary.clients++;
    }
    if (r.balances) {
      const listed = new Set();
      r.balances.list.forEach(b => { const c0 = clientIdx['n:' + b.num] || { id: 'c' + hkey(club + '|n:' + b.num), clubId: club, num: b.num, name: b.name }; clientIdx['n:' + b.num] = c0; listed.add(c0.id); upClient(c0, { balance: Math.round(b.amount * 100) / 100, incidents: b.count, balanceAt: (pendingClients[c0.id] || c0).balance === b.amount ? ((pendingClients[c0.id] || c0).balanceAt || today()) : today(), name: c0.name || b.name }); });
      // photo complete : un client absent du fichier n'a plus d'impaye
      if (r.balances.src === 'clients-incident' || r.balances.list.length) Object.values(S.clients).filter(c => c.clubId === club && Number(c.balance) > 0 && !listed.has(c.id)).forEach(c => {
        const rv = lastRecov(club, c.num, B);
        upClient(c, { balance: 0, incidents: 0, dunning: { ...(c.dunning || {}), status: 'recupere', recoveredAt: rv ? rv.date : today(), amount: Number(c.balance), canal: rv ? rv.canal : null, by: rv ? (rv.userId || null) : null, auto: true } });
      });
    }
    if (r.noMandate) {
      const listed = new Set();
      r.noMandate.forEach(b => { const c0 = clientIdx['n:' + b.num] || { id: 'c' + hkey(club + '|n:' + b.num), clubId: club, num: b.num, name: b.name }; clientIdx['n:' + b.num] = c0; listed.add(c0.id); upClient(c0, { noMandate: true, noMandateAt: (pendingClients[c0.id] || c0).noMandate ? ((pendingClients[c0.id] || c0).noMandateAt || today()) : today(), offer: (pendingClients[c0.id] || c0).offer || b.offer, name: c0.name || b.name }); });
      Object.values(S.clients).filter(c => c.clubId === club && c.noMandate && !listed.has(c.id)).forEach(c => upClient(c, { noMandate: false }));
    }
    for (const x of r.resil) {
      const id = 'rs' + hkey(club + '|' + x.key);
      const old = S.resiliations[id];
      const owner = old && old.ownerId ? old.ownerId : pick(x.seller);
      // le suivi fait dans Fit Pulse (statut, responsable, actions) n'est jamais ecrase
      const status = x.saved ? 'sauvee' : old && old.status ? old.status : (x.effective || x.date) >= today() ? 'nouvelle' : 'resiliee';
      ops.push([['resiliations', id], { ...(old || {}), id, clubId: club, client: x.client, date: x.date, effective: x.effective || (old && old.effective) || null, reason: x.reason, type: x.type, status, saved: status === 'sauvee', ownerId: owner || null, userId: owner || null, importId: impId, source: 'resamania', at: (old && old.at) || now }]);
      if (status === 'sauvee' && owner && !S.entries['sv_' + id]) ops.push([['entries', 'sv_' + id], { id: 'sv_' + id, userId: owner, clubId: club, kpiId: 'sauvetage', date: x.date, value: 1, source: 'import', importId: impId, at: now }]);
      summary.resil++;
    }
    // controles
    const mk = r.month || (r.from || today()).slice(0, 7);
    const agg = {};
    for (const [k, v] of r.controls) {
      if (k === 'tti' || k === 'perf') { const uid = pick(v.seller) || 'x:' + safeKey(norm(v.seller.label)); ops.push([['rsm', 'controls', club, k, mk, uid], k === 'tti' ? { created: v.created, transformed: v.transformed } : v.contrats]); }
      else if (k === 'web') agg['web|' + v.date] = (agg['web|' + v.date] || 0) + v.amount;
      else if (k === 'payments') agg['payments|' + v.date + '|' + safeKey(v.moyen)] = (agg['payments|' + v.date + '|' + safeKey(v.moyen)] || 0) + v.amount;
      else if (k === 'lost' || k === 'gained') { ops.push([['rsm', 'controls', club, 'evo', mk, k], v.count]); if (k === 'lost') ops.push([['base', club, mk, 'sortants'], v.count]); }
    }
    Object.entries(agg).forEach(([k, v]) => ops.push([['rsm', 'controls', club, ...k.split('|')], Math.round(v * 100) / 100]));
  }
  Object.values(pendingClients).forEach(c => ops.push([['clients', c.id], c]));
  db.batch(ops);
  UI.rsmBatch = null; UI.rsmDone = summary; render();
  toast(`Import Resamania terminé : ${summary.files} fichier(s) ✅`);
};
function rsmDoneCard() {
  const s = UI.rsmDone; const mk = addMonths(curMonth(), -1);
  // controle : contrats Fit Pulse vs Page 1 des performances commerciales
  const perf = deepGet(ctrl(), ['perf', mk]); const ppC = sumRange(CLUB.id, null, 'contrats', mk + '-01', `${mk}-${daysIn(mk)}`);
  const perfTot = perf ? Object.values(perf).reduce((a, b) => a + Number(b || 0), 0) : null;
  return `<div class="card" style="margin-bottom:14px;border-color:var(--ok)"><div class="card-head">${ico('check')}<h3>Import terminé</h3><span class="spacer"></span><button class="btn ghost sm" data-act="ui" data-key="rsmDone" data-val="">${ico('x')}</button></div>
    <div class="row wrap" style="gap:22px"><div><div class="muted small">Fichiers</div><b class="title" style="font-size:22px">${s.files}</b></div><div><div class="muted small">Saisies créées</div><b class="title" style="font-size:22px">${s.entries}</b></div><div><div class="muted small">Déjà connues (mises à jour, pas de doublon)</div><b class="title" style="font-size:22px">${s.updated}</b></div><div><div class="muted small">Régularisations d’impayés</div><b class="title" style="font-size:22px">${s.recov}</b></div><div><div class="muted small">Fiches clients</div><b class="title" style="font-size:22px">${s.clients}</b></div><div><div class="muted small">Résiliations</div><b class="title" style="font-size:22px">${s.resil}</b></div></div>
    ${perfTot != null ? `<div class="alert ${Math.abs(perfTot - ppC) <= Math.max(1, perfTot * 0.03) ? 'info' : ''}" style="margin-top:12px">${ico('target')}<div><b>Contrôle ${monthLabel(mk)} : ${fmtN(ppC)} contrats dans Fit Pulse, ${fmtN(perfTot)} dans les performances commerciales Resamania</b>${Math.abs(perfTot - ppC) <= Math.max(1, perfTot * 0.03) ? 'Les deux sources concordent.' : 'Écart à vérifier : vente d’abonnements incomplète, ou changements d’offre comptés d’un côté seulement.'}</div></div>` : ''}
    ${s.recov ? `<div style="margin-top:12px"><a class="btn sm primary" href="#/impayes">Voir les impayés par canal ${ico('chevR')}</a></div>` : ''}</div>`;
}

// ── Page Impayés : tous les canaux ────────────────────────────────────────
function recovList(clubId, from, to) {
  return Object.values(S.recov || {}).filter(x => x.clubId === clubId && x.date >= from && x.date <= to && x.canal !== 'annule' && !(x.importId && S.imports[x.importId] && S.imports[x.importId].active === false));
}
const impayesAnalyse = {
  render() {
    const mk = UI.impMonth || curMonth();
    const r = rangeOf('month', mk);
    const list = recovList(CLUB.id, r.from, r.to);
    const total = list.reduce((s, x) => s + x.amount, 0);
    const by = {}; Object.keys(RECOV_CHANNELS).forEach(k => { by[k] = { v: 0, n: 0 }; }); list.forEach(x => { const b = by[x.canal] || by.tiers; b.v += x.amount; b.n++; });
    const team = {}; list.filter(x => x.canal === 'equipe').forEach(x => { const k = x.userId || '_'; const t = team[k] = team[k] || { v: 0, n: 0 }; t.v += x.amount; t.n++; });
    const clients = Object.values(S.clients).filter(c => c.clubId === CLUB.id && Number(c.balance) > 0).sort((a, b) => b.balance - a.balance);
    const enCours = clients.reduce((s, c) => s + Number(c.balance), 0);
    const balAt = clients.reduce((m, c) => (c.balanceAt && c.balanceAt > m ? c.balanceAt : m), '');
    const web = Object.entries(ctrl().web || {}).filter(([d]) => d >= r.from && d <= r.to).reduce((s, [, v]) => s + Number(v), 0);
    // 6 derniers mois, barres empilees par canal
    const months = []; for (let i = 5; i >= 0; i--) months.push(addMonths(mk, -i));
    const mt = months.map(m => { const L = recovList(CLUB.id, m + '-01', `${m}-${daysIn(m)}`); const o = {}; L.forEach(x => { o[x.canal] = (o[x.canal] || 0) + x.amount; }); return { m, o, t: L.reduce((s, x) => s + x.amount, 0) }; });
    const max = Math.max(1, ...mt.map(x => x.t));
    const empty = !Object.keys(S.recov || {}).some(id => S.recov[id].clubId === CLUB.id);
    return `<div class="row wrap" style="margin-bottom:14px"><p class="muted spacer" style="margin:0">Tous les canaux, d’après la liste Incidents de Resamania (Auteur de la régularisation). ${esc(CLUB.name)}</p>${monthNav('impMonth', mk)}</div>
      ${empty ? `<div class="alert info" style="margin-bottom:14px">${ico('info')}<div><b>Aucune régularisation importée</b>Dans Resamania : Données financières > Incidents > FILTRER (Statut = Régularisé, Date de régularisation = le mois, Club) > ⋮ > Exporter. Déposez le fichier dans Imports > Resamania.</div></div>` : ''}
      <div class="grid" style="grid-template-columns:1.2fr 1fr;margin-bottom:14px">
        <div class="card hero" style="grid-template-columns:1fr"><div><div class="muted small">Récupéré en ${monthLabel(mk)}, tous canaux</div><div class="big">${fmtE(total)}</div>
          <div class="muted small" style="margin-top:4px">${list.length} régularisation(s) · dont équipe ${fmtE(by.equipe.v)} (${fmtP(total ? by.equipe.v / total : null)})</div>
          <div style="display:flex;height:14px;border-radius:99px;overflow:hidden;margin-top:14px;background:#26262a">${Object.entries(RECOV_CHANNELS).map(([k, c]) => by[k].v ? `<i style="width:${by[k].v / total * 100}%;background:${c.color}" title="${esc(c.label)} : ${fmtE(by[k].v)}"></i>` : '').join('')}</div></div></div>
        <div class="card"><div class="muted small">Impayés en cours</div><div class="title" style="font-size:34px">${fmtE(enCours)}</div><div class="muted small">${clients.length} client(s) débiteur(s)${balAt ? ` · photo du ${dmy(balAt)}` : ''}</div>
          <a class="btn sm" style="margin-top:10px" href="#/loyalty" data-act="loyImpaye">Relancer dans Action Rétention ${ico('chevR')}</a></div></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:14px">
        ${Object.entries(RECOV_CHANNELS).map(([k, c]) => `<div class="card"><div class="row"><i style="width:10px;height:10px;border-radius:3px;background:${c.color};flex:none"></i><b class="small">${c.label}</b></div><span class="badge" style="margin-top:6px">${c.human ? 'action de l’équipe' : 'sans action du club'}</span><div class="title" style="font-size:26px;margin-top:6px">${fmtE(by[k].v)}</div><div class="muted small">${by[k].n} régul. · ${fmtP(total ? by[k].v / total : null)}</div><div class="muted small" style="margin-top:6px">${c.hint}</div></div>`).join('')}</div>
      <div class="grid" style="grid-template-columns:1fr 1fr">
        <div class="card"><h3>Part de l’équipe (prime impayés)</h3><p class="muted small">Seul le canal « Équipe du club » compte pour le KPI Impayés récupérés et le classement.</p>
          ${Object.entries(team).sort((a, b) => b[1].v - a[1].v).map(([uid, t]) => `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)">${uid === '_' ? '<span class="avatar xs">?</span><span class="spacer">Non rattaché <a href="#/members" data-act="goAliases" class="small">rattacher</a></span>' : `${avatar(S.users[uid], 'xs')}<span class="spacer">${esc(fullName(S.users[uid]))}</span>`}<span class="muted small">${t.n}</span><b>${fmtE(t.v)}</b></div>`).join('') || '<p class="muted">Aucune régularisation par l’équipe ce mois-ci.</p>'}</div>
        <div class="card"><h3>6 derniers mois</h3><div style="display:grid;gap:8px;margin-top:10px">${mt.map(x => `<div style="display:grid;grid-template-columns:62px 1fr 80px;gap:10px;align-items:center"><span class="small">${MOIS_C[Number(x.m.slice(5)) - 1]} ${x.m.slice(2, 4)}</span><div style="display:flex;height:14px;border-radius:4px;overflow:hidden;background:var(--surface-2)">${Object.entries(RECOV_CHANNELS).map(([k, c]) => x.o[k] ? `<i style="width:${x.o[k] / max * 100}%;background:${c.color}" title="${esc(c.label)} : ${fmtE(x.o[k])}"></i>` : '').join('')}</div><b class="small" style="text-align:right">${fmtE(x.t)}</b></div>`).join('')}</div>
          <div class="legend" style="margin-top:10px">${Object.values(RECOV_CHANNELS).map(c => `<span><i style="background:${c.color}"></i>${c.label}</span>`).join('')}</div></div></div>
      <div class="card" style="margin-top:14px"><h3>Contrôles</h3><div class="small" style="display:grid;gap:6px;margin-top:8px">
        <div>Client en ligne (Incidents) : <b>${fmtE(by.client.v)}</b> · Transactions Web avec Recouvrement = 1 : <b>${web ? fmtE(web) : 'non importé'}</b>${web ? (Math.abs(web - by.client.v) <= Math.max(5, web * 0.05) ? ' <span class="badge ok">concordant</span>' : ' <span class="badge warn">écart</span>') : ''}</div>
        <div>Comparez le total avec Resamania : Tableaux de bord > Vos prélèvements > graphique <b>Recouvrements</b> (barre du mois). La tuile « Total des montants recouverts » est un cumul depuis le démarrage : ne pas l’utiliser pour un mois.</div>
        <div class="muted">Le montant compté est celui du paiement rejeté régularisé (pas forcément l’encaissement si le client a payé en plusieurs fois). Les incidents clos par avoir ne sont pas de l’argent encaissé : ils sont exclus.</div></div></div>`;
  },
};
ACTIONS.loyImpaye = () => { UI.loyType = 'impaye'; UI.loyTab = 'tasks'; location.hash = '#/loyalty'; };
ACTIONS.goAliases = () => { UI.memTab = 'aliases'; location.hash = '#/members'; };

// ── Membres > Correspondances Resamania ───────────────────────────────────
function memAliases() {
  const al = rsmState().aliases || {};
  const members = clubMembers(CLUB.id, { all: true });
  const byUser = {}; Object.entries(al).forEach(([k, v]) => { (byUser[v] = byUser[v] || []).push(k); });
  const pretty = k => { const [t, ...r] = k.split(':'); const v = r.join(':').replace(/,/g, '.'); return `<span class="badge">${{ e: 'e-mail', i: 'id', c: 'code', n: 'nom' }[t] || t}</span> ${esc(v)}`; };
  return `<div class="card" style="margin-bottom:14px"><h3>Correspondances Resamania</h3><p class="muted small">Resamania écrit un même commercial de plusieurs façons : « NOM Prénom », « Prénom NOM &lt;e-mail&gt; {id} » ou un code (KGUE). Le nom et l’e-mail du membre sont reconnus d’office, dans n’importe quel ordre et casse. Ajoutez ici les codes trigrammes et les autres formes.</p>
    <form id="alf" class="row wrap" style="margin-top:10px"><input class="input sm" style="width:260px" name="v" placeholder="Code (KGUE), e-mail ou NOM Prénom"><select class="input sm" style="width:auto" name="u">${members.map(u => `<option value="${u.id}">${esc(fullName(u))}</option>`).join('')}<option value="system">Vente en ligne / système</option><option value="ignore">Ignorer</option></select><button class="btn sm primary" type="button" data-act="aliasAdd">${ico('plus')} Ajouter</button></form></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">
    ${members.map(u => `<div class="card"><div class="row">${avatar(u, 'xs')}<b class="spacer">${esc(fullName(u))}</b></div><div class="muted small" style="margin:6px 0">Reconnu d’office : ${esc(fullName(u))}${u.email ? ' · ' + esc(u.email) : ''}</div>${(byUser[u.id] || []).map(k => `<div class="row small" style="padding:3px 0">${pretty(k)}<span class="spacer"></span><button class="btn ghost icon sm" data-act="aliasDel" data-k="${esc(k)}" title="Retirer">${ico('x')}</button></div>`).join('') || '<div class="muted small">Aucune autre forme enregistrée.</div>'}</div>`).join('')}
    ${['system', 'ignore'].map(t => `<div class="card"><b>${t === 'system' ? 'Vente en ligne / système' : 'Ignorés'}</b><div class="muted small" style="margin:6px 0">${t === 'system' ? 'Jamais attribué à un commercial. Toujours reconnus : Traitement automatique, Automatismes, Site web Fitness Park Public, PSO Site (SPSO), En ligne, BackOffice Mobile, Espace membre.' : 'Lignes non importées.'}</div>${(byUser[t] || []).map(k => `<div class="row small" style="padding:3px 0">${pretty(k)}<span class="spacer"></span><button class="btn ghost icon sm" data-act="aliasDel" data-k="${esc(k)}">${ico('x')}</button></div>`).join('')}</div>`).join('')}</div>`;
}
ACTIONS.aliasAdd = () => {
  const f = formData($('#alf')); const v = f.v.trim(); if (!v) return;
  const key = v.includes('@') ? 'e:' + v.toLowerCase() : /^[A-Za-z]{3,5}$/.test(v) && v === v.toUpperCase() ? 'c:' + v : 'n:' + tokensKey(v);
  db.set(['rsm', 'aliases', safeKey(key)], f.u); toast('Correspondance ajoutée.');
};
ACTIONS.aliasDel = el => db.set(['rsm', 'aliases', el.dataset.k], null);

// derniere regularisation connue d'un client (lot en cours d'abord, puis base)
function lastRecov(club, num, batch) {
  if (!num) return null;
  const fromBatch = batch.flatMap(r => r.recov).filter(x => x.clientNum === num && x.canal !== 'annule').map(x => ({ date: x.date, canal: x.canal, userId: x.seller && x.seller.status === 'user' ? x.seller.userId : null }));
  const fromBase = Object.values(S.recov || {}).filter(x => x.clubId === club && x.clientNum === num && x.canal !== 'annule');
  return [...fromBatch, ...fromBase].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0] || null;
}
