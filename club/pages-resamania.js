/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
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
  ['factures', 'Mois, Entité = votre société d’exploitation, Club (déposez le ZIP tel quel)', 'RSM_factures-avoirs_AAAA-MM.zip'],
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
// Contrôle de la semaine : chaque export de la routine est Reçu, Manquant ou Suspect.
// Suspect : exactement 2 000 lignes (liste tronquée par Resamania), ou moins de la
// moitié des lignes du dernier import des semaines précédentes (S.rsm.rowsHistory).
const RSM_LIMITE = 2000;
function rsmEtat(clubId, defId, t = today()) {
  const since = dateOf(weekStart(t)).getTime(); const ts = Number(deepGet(S, ['rsm', 'routine', clubId, defId])) || 0;
  if (!ts || ts < since) return { etat: 'Manquant', ts: ts || null };
  const H = deepGet(S, ['rsm', 'rowsHistory', clubId, defId]) || []; const der = H[H.length - 1];
  const rows = der ? der.rows : Number((Object.values(S.imports || {}).filter(i => i.clubId === clubId && i.defId === defId).sort((a, b) => b.at - a.at)[0] || {}).rows) || null;
  const avant = H.filter(x => x.at < since).pop();
  if (rows === RSM_LIMITE) return { etat: 'Suspect', ts, rows, message: 'Liste tronquée par Resamania : refaites l’export en deux fois' };
  if (avant && rows != null && avant.rows > 0 && rows < avant.rows * 0.5) return { etat: 'Suspect', ts, rows, message: `${fmtN(rows)} lignes contre ${fmtN(avant.rows)} la semaine précédente : vérifiez les filtres de l’export` };
  return { etat: 'Reçu', ts, rows };
}
function routineSemaine(clubId, t = today()) {
  const L = ROUTINE_WEEK.map(([id]) => ({ id, label: (defById(id) || { label: id }).label, ...rsmEtat(clubId, id, t) }));
  return { liste: L, total: L.length, recus: L.filter(x => x.etat !== 'Manquant').length, suspects: L.filter(x => x.etat === 'Suspect').length, manquants: L.filter(x => x.etat === 'Manquant').map(x => x.label) };
}
const rsmState = () => S.rsm || {};
const ctrl = (clubId = CLUB.id) => deepGet(S, ['rsm', 'controls', clubId]) || {};

// ── Onglet Resamania de la page Imports ───────────────────────────────────
function impRsm() {
  if (UI.rsmBusy) return `<div class="card empty"><div class="title">Lecture des fichiers…</div><p>Décompression et reconnaissance des exports Resamania.</p></div>`;
  if (UI.rsmBatch) return rsmReview();
  const fail = WRITE_FAILS.n ? `<div class="alert" style="margin-bottom:14px">${ico('alert')}<div><b>${plur(WRITE_FAILS.n, 'écriture refusée', 'écritures refusées')} par la base partagée</b>${esc(WRITE_FAILS.last.msg)}${WRITE_FAILS.last.path ? ' (' + esc(WRITE_FAILS.last.path.split('/').slice(0, 2).join('/')) + ')' : ''}. Le reste de l’import est enregistré. Rechargez la page pour voir ce qui a été gardé.</div></div>` : '';
  const done = fail + (UI.rsmDone ? rsmDoneCard() : '') + rsmPending();
  const routine = deepGet(S, ['rsm', 'routine', CLUB.id]) || {};
  const wk = dateOf(weekStart(today())).getTime(), mo = dateOf(curMonth() + '-01').getTime();
  const item = ([id, filt, file], since) => {
    const d = defById(id); const ts = routine[id]; const ok = ts && ts >= since;
    return `<details class="rsm-item"><summary class="row"><span class="badge ${ok ? 'ok' : ''}" style="min-width:26px;justify-content:center">${ok ? ico('check', 'ico ico-xs') : '·'}</span><b class="spacer">${esc(d.label)}</b><span class="muted small">${ts ? 'importé le ' + dm(isoOf(new Date(ts))) : 'jamais importé'}</span></summary>
      <div class="small" style="padding:8px 0 4px 36px;display:grid;gap:4px"><div><span class="muted">Où :</span> ${esc(d.path)}</div><div><span class="muted">Filtres :</span> ${esc(filt.replace('Entité = votre société d’exploitation', entiteTexte()))}</div><div><span class="muted">Nom à donner :</span> <code>${esc(file)}</code></div><div><span class="muted">Alimente :</span> ${esc(d.feeds)}</div></div></details>`;
  };
  const cnt = (list, since) => list.filter(([id]) => (routine[id] || 0) >= since).length;
  return `${done}
    ${rsmControleSemaine(CLUB.id)}
    <div class="card" style="margin-bottom:14px"><div class="drop drop-dossier" id="rsm-dir-drop">${ico('upload')}<div class="title t-18" style="margin-top:8px">Déposer tout le dossier</div>
      <div class="muted small">Le dossier de la semaine entier, ou un ZIP qui contient plusieurs exports : chaque fichier est lu et reconnu, la revue porte sur tous à la fois.</div>
      <div class="row wrap" style="gap:8px;justify-content:center;margin-top:8px"><button class="btn sm" type="button" data-pick="rsm-dir">Choisir un dossier</button><button class="btn sm" type="button" data-pick="rsm-file">Choisir des fichiers ou un ZIP</button></div></div>
      <input type="file" id="rsm-dir" webkitdirectory directory multiple hidden></div>
    <div class="card" style="margin-bottom:14px"><div class="drop" id="rsm-drop">${ico('upload')}<div class="title t-18" style="margin-top:8px">Déposez vos exports Resamania</div>
      <div class="muted small">Plusieurs fichiers à la fois : CSV des listes, ZIP des exports de gestion (sans les décompresser), XLSX. Chaque fichier est reconnu par ses colonnes.</div></div>
      <input type="file" id="rsm-file" multiple accept="${FILE_ACCEPT}" hidden></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(340px, 100%), 1fr));margin-bottom:14px">
      <div class="card"><div class="card-head">${ico('cal')}<h3>Chaque lundi</h3><span class="spacer"></span><span class="badge ${cnt(ROUTINE_WEEK, wk) === ROUTINE_WEEK.length ? 'ok' : 'warn'}">${cnt(ROUTINE_WEEK, wk)}/${ROUTINE_WEEK.length} cette semaine</span></div>
        <p class="muted small" style="margin-top:-6px">≈ 15 minutes. Lancez d’abord les exports de gestion (ils se préparent en fond, lien par e-mail), puis les listes.</p>${ROUTINE_WEEK.map(x => item(x, wk)).join('')}</div>
      <div class="card"><div class="card-head">${ico('cal')}<h3>Le 2 de chaque mois</h3><span class="spacer"></span><span class="badge ${cnt(ROUTINE_MONTH, mo) === ROUTINE_MONTH.length ? 'ok' : 'warn'}">${cnt(ROUTINE_MONTH, mo)}/${ROUTINE_MONTH.length} ce mois-ci</span></div>
        <p class="muted small" style="margin-top:-6px">Pour le mois clos. Les exports marqués (S) dans Resamania demandent un code reçu par e-mail.</p>${ROUTINE_MONTH.map(x => item(x, mo)).join('')}</div></div>
    <div class="card"><h3>Où trouver quoi dans Resamania</h3><p class="muted small">Une seule source de vérité par KPI : on n’additionne jamais deux exports pour le même chiffre.</p>
      <div class="table-wrap"><table class="t"><thead><tr><th>KPI Fit Pulse</th><th>Source Resamania</th><th>Rattachement au commercial</th></tr></thead><tbody>
      ${[['Contrats signés', 'Exports de gestion > Membres & Ventes > Vente d’abonnements', 'Commercial initial (code ABCD…)'],
         ['Nutrition', 'Exports de gestion > Finance > Factures & avoirs (DetailLignes) ou liste Lignes de factures', 'Auteur / Vendeur'],
         ['Accessoires', 'Idem, codes produit FPARK / NO_FPARK', 'Auteur / Vendeur'],
         ['Impayés récupérés', 'Données financières > Incidents (Statut = Régularisé)', 'Auteur de la régularisation → canal'],
         ['Contrat B2B', 'Factures & avoirs : « Société du client » renseignée', 'Commercial initial'],
         ['Prospects', 'Clients > Prospects (liste) ou Prospects (S)', 'Commercial (initial)'],
         ['Taux de transformation', 'Exports de gestion > Taux de transformation par commerciaux', 'Commercial'],
         ['Résiliations / sauvetages', 'Clients > Résiliations (Etat canceled = sauvetage)', 'Créateur'],
         ['Impayés en cours', 'Points d’attention > Clients en incident', 'n.d.'],
         ['Sans mandat', 'Points d’attention > Clients abonnés sans prélèvement', 'n.d.'],
         ['Anniversaires', 'Clients > Clients club (Statut = Client)', 'n.d.'],
         ['Fins de contrat', 'Clients > Abonnements (Fin d’engagement)', 'n.d.'],
         [TXT.kpi.invites, 'Pas d’export dans Resamania (liste Invitations) : saisie manuelle', 'n.d.']]
        .map(([k, s2, r]) => `<tr><td><b>${k}</b></td><td>${s2}</td><td class="muted">${r}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function mountRsm() {
  const drop = $('#rsm-drop'); if (!drop) return;
  const input = $('#rsm-file');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', async e => { e.preventDefault(); drop.classList.remove('over'); rsmRead(await fichiersDuDepot(e.dataTransfer)); });
  input.addEventListener('change', () => { const f = [...input.files]; input.value = ''; rsmRead(f); });
  // Dépôt d'un dossier entier (glissé ou choisi), ou d'un ZIP de plusieurs exports.
  const dd = $('#rsm-dir-drop'), dir = $('#rsm-dir'); if (!dd || !dir) return;
  $$('[data-pick]', dd).forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); $('#' + b.dataset.pick).click(); }));
  dd.addEventListener('dragover', e => { e.preventDefault(); dd.classList.add('over'); });
  dd.addEventListener('dragleave', () => dd.classList.remove('over'));
  dd.addEventListener('drop', async e => { e.preventDefault(); dd.classList.remove('over'); rsmRead(await fichiersDuDepot(e.dataTransfer)); });
  dir.addEventListener('change', () => { const f = [...dir.files].filter(x => !/(^|\/)(__MACOSX|\.)/.test(x.webkitRelativePath || x.name)); dir.value = ''; rsmRead(f); });
}
// Fichiers d'un dépôt : les dossiers glissés sont parcourus (sous-dossiers compris).
async function fichiersDuDepot(dt) {
  const items = [...(dt.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (!items.length || items.every(x => x.isFile)) return [...dt.files];
  const out = []; const lire = e => new Promise(res => {
    if (e.isFile) { e.file(f => { if (!/^(\.|__MACOSX)/.test(f.name)) out.push(f); res(); }, () => res()); return; }
    const r = e.createReader(); const tout = []; const lot = () => r.readEntries(async L => { if (!L.length) { for (const x of tout) await lire(x); res(); } else { tout.push(...L); lot(); } }, () => res()); lot();
  });
  for (const e of items) await lire(e);
  return out;
}
function rsmControleSemaine(clubId) {
  const R = routineSemaine(clubId); const cls = { 'Reçu': 'ok', 'Manquant': 'bad', 'Suspect': 'warn' };
  return `<div class="card rsm-controle" style="margin-bottom:14px"><div class="card-head"><h3>Contrôle de la semaine</h3><span class="spacer"></span><span class="badge ${R.recus === R.total && !R.suspects ? 'ok' : 'warn'}" data-recus="${R.recus}">${R.recus} sur ${R.total} reçus${R.suspects ? `, ${R.suspects} suspect${R.suspects > 1 ? 's' : ''}` : ''}</span></div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Export</th><th>État</th><th>Reçu le</th><th class="num">Lignes</th><th>À faire</th></tr></thead><tbody>
    ${R.liste.map(x => `<tr data-def="${x.id}" data-etat="${x.etat}"><td>${esc(x.label)}</td><td><span class="badge ${cls[x.etat]}">${x.etat}</span></td><td class="small">${x.ts ? esc(dm(isoOf(new Date(x.ts)))) : ''}</td><td class="num">${x.rows != null ? fmtN(x.rows) : ''}</td><td class="small">${x.message ? esc(x.message) : x.etat === 'Manquant' ? 'À déposer cette semaine' : ''}</td></tr>`).join('')}</tbody></table></div></div>`;
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
function rsmWhy(t) {
  if (!t || !t.headers) return '';
  const near = closestDef(t); const sepName = { ';': 'point-virgule', ',': 'virgule', '\t': 'tabulation', '|': 'barre verticale' }[t.sep] || '';
  return `<details style="margin-top:8px"><summary class="small">Pourquoi ?</summary><div class="small" style="padding-top:6px;display:grid;gap:4px">
    <div><span class="muted">Colonnes lues${sepName ? ' (séparateur ' + sepName + ')' : ''} :</span> ${t.headers.slice(0, 25).map(h => `<code>${esc(h || '(vide)')}</code>`).join(' ')}${t.headers.length > 25 ? ' …' : ''}</div>
    ${near && near.score >= 0.5 ? `<div><span class="muted">Ressemble à :</span> <b>${esc(near.def.label)}</b>. Colonne${near.missing.length > 1 ? 's' : ''} attendue${near.missing.length > 1 ? 's' : ''} absente${near.missing.length > 1 ? 's' : ''} : ${near.missing.map(m => `<code>${esc(m)}</code>`).join(' ')}. Refaites l’export depuis ${esc(near.def.path || 'Resamania')} sans masquer de colonne ni ouvrir le fichier dans Excel avant l’import.</div>` : t.headers.length <= 1 ? '<div>Une seule colonne lue : le fichier n’est sans doute pas un tableau (PDF, page web enregistrée) ou son séparateur est inhabituel.</div>' : '<div>Aucun export Resamania connu n’a ces colonnes. Utilisez « Ouvrir dans l’import libre » pour choisir les colonnes à la main.</div>'}</div></details>`;
}
function rsmReview() {
  const B = UI.rsmBatch;
  const unk = unknownSellers(B);
  const members = clubMembers(CLUB.id, { all: true });
  const card = (r, i) => {
    if (!r.def) return `<div class="card"><div class="row wrap">${ico('info')}<b class="spacer">${esc(r.name)}</b><span class="badge ${r.warnings.length ? '' : 'warn'}">${r.warnings.length ? 'Ignoré' : 'Non reconnu'}</span></div>
      <p class="muted small" style="margin-bottom:0">${r.warnings.length ? esc(r.warnings.join(' ')) : `${plur(r.rowsCount, 'ligne lue', 'lignes lues')}${r.encoding ? ' · ' + esc(r.encoding) : ''}. Ce n’est pas un export Resamania connu : vous pouvez l’importer à la main.`}</p>
      ${!r.warnings.length ? rsmWhy(UI.rsmTables && UI.rsmTables[i]) : ''}
      ${!r.warnings.length && r.rowsCount ? `<button class="btn sm" style="margin-top:8px" data-act="rsmFree" data-i="${i}">Ouvrir dans l’import libre</button>` : ''}</div>`;
    if (r.def.silent) return `<div class="card"><div class="row wrap">${ico('list')}<b class="spacer">${esc(r.name)}</b><span class="badge">Non utilisé</span></div><p class="muted small" style="margin-bottom:0">${esc(r.warnings.join(' '))}</p></div>`;
    const byK = {}; r.entries.forEach(e => { const k = byK[e.kpiId] = byK[e.kpiId] || { v: 0, n: 0 }; k.v += e.value; k.n++; });
    const byC = {}; r.recov.forEach(x => { const k = byC[x.canal] = byC[x.canal] || { v: 0, n: 0 }; k.v += x.amount; k.n++; });
    const nClients = Object.keys(r.clients).length + r.clientsByName.length;
    const lines = [
      ...Object.entries(byK).map(([k, x]) => `<div class="row small"><span>${S.kpis[k] ? kpiIcon(S.kpis[k], 'ico ico-xs') + ' ' + esc(S.kpis[k].label) : esc(k)}</span><span class="spacer"></span><b>${fmtV(x.v, S.kpis[k] ? S.kpis[k].unit : 'qty')}</b><span class="muted">${plur(x.n, 'ligne', 'lignes')}</span></div>`),
      ...Object.entries(byC).map(([k, x]) => `<div class="row small"><span>${ico('coins', 'ico ico-xs')} Récupéré · ${esc(k === 'annule' ? 'annulé / avoir (pas d’argent encaissé)' : RECOV_CHANNELS[k].label)}</span><span class="spacer"></span><b>${fmtE(x.v)}</b><span class="muted">${x.n}</span></div>`),
      nClients ? `<div class="row small"><span>${ico('users', 'ico ico-xs')} Fiches clients mises à jour</span><span class="spacer"></span><b>${nClients}</b></div>` : '',
      r.balances ? `<div class="row small"><span>${ico('alert', 'ico ico-xs')} Impayés en cours (photo du jour)</span><span class="spacer"></span><b>${fmtE(r.balances.list.reduce((s, x) => s + x.amount, 0))}</b><span class="muted">${plur(r.balances.list.length, 'client', 'clients')}</span></div>` : '',
      r.noMandate ? `<div class="row small"><span>${ico('bank', 'ico ico-xs')} Adhérents sans mandat</span><span class="spacer"></span><b>${r.noMandate.length}</b></div>` : '',
      r.resil.length ? `<div class="row small"><span>${ico('door', 'ico ico-xs')} Résiliations</span><span class="spacer"></span><b>${r.resil.length}</b><span class="muted">dont ${plur(r.resil.filter(x => x.saved).length, 'sauvetage', 'sauvetages')}</span></div>` : '',
      r.controls.length ? `<div class="row small"><span>${ico('search', 'ico ico-xs')} Données de contrôle</span><span class="spacer"></span><b>${r.controls.length}</b>${r.def.monthly ? `<span class="muted">mois ${esc(r.month)}</span>` : ''}</div>` : '',
    ].filter(Boolean).join('');
    const skipped = Object.entries(r.skipped);
    return `<div class="card"><div class="row wrap">${ico('check')}<div class="spacer"><b>${esc(r.def.label)}</b><div class="muted small">${esc(r.name)} · ${plur(r.rowsCount, 'ligne', 'lignes')} · ${esc(r.encoding || '')}${r.from ? ` · ${dmy(r.from)} → ${dmy(r.to)}` : ''}</div></div><span class="badge ${r.def.family === 'liste' ? 'info' : 'fp'}">${r.def.family === 'liste' ? 'Liste' : 'Export de gestion'}</span></div>
      <div style="margin-top:10px;display:grid;gap:5px">${lines || '<span class="muted small">Rien à importer dans ce fichier.</span>'}</div>
      ${r.warnings.map(w => `<div class="alert" style="margin-top:8px;padding:8px 12px"><span class="small">${esc(w)}</span></div>`).join('')}
      ${skipped.length ? `<details style="margin-top:8px" ${lines ? '' : 'open'}><summary class="muted small">${plur(skipped.reduce((s, [, n]) => s + n, 0), 'ligne écartée', 'lignes écartées')}</summary><div class="small muted" style="padding-top:6px">${skipped.map(([w, n]) => `${n} × ${esc(w)}`).join('<br>')}</div></details>` : ''}</div>`;
  };
  const opt = (k, cur) => `<option value="">Choisir…</option>${members.map(u => `<option value="${u.id}" ${cur === u.id ? 'selected' : ''}>${esc(fullName(u))}</option>`).join('')}<option value="system" ${cur === 'system' ? 'selected' : ''}>Vente en ligne / système (personne)</option><option value="ignore" ${cur === 'ignore' ? 'selected' : ''}>Ignorer</option>`;
  const usable = B.filter(r => r.def && !r.def.silent).length;
  return `<div class="row wrap" style="margin-bottom:12px"><h2 class="spacer">${plur(B.length, 'fichier analysé', 'fichiers analysés')}</h2><button class="btn" data-act="rsmCancel">Annuler</button><button class="btn primary" data-act="rsmCommit" ${usable ? '' : 'disabled'}>Importer ${plur(usable, 'fichier', 'fichiers')} dans ${esc(CLUB.name)}</button></div>
    ${unk.length ? `<div class="card" style="margin-bottom:14px;border-color:var(--fp)"><h3>Qui est qui ? ${plur(unk.length, 'nom', 'noms')} Resamania à rattacher</h3><p class="muted small">Resamania écrit un vendeur sous plusieurs formes (NOM Prénom, e-mail, code). Votre choix est retenu pour les prochains imports. Sans choix, la ligne n’est attribuée à personne.</p>
      <div class="table-wrap"><table class="t"><tbody>${unk.map(u => `<tr><td><b>${esc(u.label)}</b><div class="muted small">${plur(u.count, 'ligne', 'lignes')}</div></td><td style="width:280px"><select class="input sm" data-change="rsmChoice" data-k="${esc(u.key)}">${opt(u.key, UI.rsmChoices[u.key])}</select></td></tr>`).join('')}</tbody></table></div></div>` : ''}
    <div class="grid">${B.map(card).join('')}</div>`;
}
ACTIONS.rsmChoice = el => { UI.rsmChoices[el.dataset.k] = el.value; };
ACTIONS.rsmCancel = () => { UI.rsmBatch = null; render(); };
ACTIONS.rsmFree = el => { const t = UI.rsmTables[Number(el.dataset.i)]; UI.rsmBatch = null; startWizardTable(t.name, { headers: t.headers, rows: t.rows }); };

// ── Enregistrement ────────────────────────────────────────────────────────
// Plan d'écriture d'un dépôt Resamania (fonction pure : même code dans l'appli et sur le serveur,
// voir outils/fitpulse-autoimport.mjs). B = analyses (analyzeTable), choices = correspondances choisies.
function rsmCommitPlan(B, { club, choices = {}, by, now = Date.now() }) {
  const ops = [];
  const unk = unknownSellers(B);
  // 1. memoriser les correspondances choisies
  unk.forEach(u => { const ch = choices[u.key]; if (ch) u.keys.forEach(k => ops.push([['rsm', 'aliases', safeKey(k)], ch])); });
  const pick = s => { if (!s) return null; if (s.status === 'user') return s.userId; if (s.status === 'unknown') { const ch = choiceFor(s, choices, unk); return ch && ch !== 'system' && ch !== 'ignore' ? ch : null; } return null; };
  const written = new Set(); const batchImp = {};
  const clientIdx = {}; Object.values(S.clients).filter(c => c.clubId === club).forEach(c => { if (c.num) clientIdx['n:' + c.num] = c; clientIdx['t:' + tokensKey(c.name || '')] = clientIdx['t:' + tokensKey(c.name || '')] || c; });
  const pendingClients = {};
  // Un telephone saisi a la main n'est jamais remplace par celui d'un import.
  const upClient = (c0, patch) => { const id = c0.id; const cur = pendingClients[id] || c0; if (cur.phoneSrc === 'manual' && patch.phone) { patch = { ...patch }; delete patch.phone; delete patch.phoneSrc; } pendingClients[id] = { ...cur, ...patch }; };
  const summary = { files: 0, entries: 0, updated: 0, recov: 0, clients: 0, resil: 0, kpis: {} };
  for (const r of B) {
    if (!r.def || r.def.silent) continue;
    summary.files++;
    const impId = 'rsm_' + newId();
    const type = r.def.id === 'resil' ? 'resil' : r.entries.length ? 'kpi' : (r.balances || r.noMandate || Object.keys(r.clients).length || r.clientsByName.length) ? 'clients' : 'control';
    ops.push([['imports', impId], { id: impId, name: r.name, type, defId: r.def.id, source: 'resamania', clubId: club, at: now, rows: r.rowsCount, count: r.entries.length + r.recov.length + r.resil.length, from: r.from, to: r.to, active: true, by: by }]);
    ops.push([['rsm', 'routine', club, r.def.id], now]);
    ops.push([['rsm', 'rowsHistory', club, r.def.id], [...(deepGet(S, ['rsm', 'rowsHistory', club, r.def.id]) || []), { at: now, rows: Number(r.rowsCount) || 0 }].slice(-8)]);
    // KPI : identifiant derive de la cle de ligne -> reimport sans doublon
    for (const e of r.entries) {
      // Ventes/prospects du web ou de l'appli, non attribués : au membre virtuel PSO.
      const uid = pick(e.seller) || (e.seller && e.seller.status === 'system' ? 'pso' : null); if (!uid) continue;
      let id = 'r' + hkey(club + '|' + e.key);
      if (e.legacyKey && S.entries['r' + hkey(club + '|' + e.legacyKey)]) id = 'r' + hkey(club + '|' + e.legacyKey);
      if (S.entries[id] || written.has(id)) summary.updated++; else summary.entries++;
      written.add(id);
      summary.kpis[e.kpiId] = (summary.kpis[e.kpiId] || 0) + e.value;
      // La saisie garde la liste de TOUS les imports qui la contiennent : annuler
      // le dernier ne fait pas disparaitre une vente qu'un import precedent porte.
      // Impaye deja saisi a la main (Recupere / Regle) pour le meme client et le
      // meme montant a 7 jours pres : on garde la saisie, on ne recompte pas.
      if (e.kpiId === 'impayes' && e.clientNum) {
        const cl = Object.values(S.clients).find(x => x.clubId === club && String(x.num || '') === String(e.clientNum));
        const lo = addDays(e.date, -7), hi = addDays(e.date, 7);
        const man = cl && Object.values(S.entries).find(m => m.kpiId === 'impayes' && !isImported(m) && m.clientId === cl.id && m.date >= lo && m.date <= hi && Math.abs(Number(m.value) - Number(e.value)) <= 0.01);
        if (man) { summary.matched = (summary.matched || 0) + 1; if (!man.matchedKey) ops.push([['entries', man.id, 'matchedKey'], e.key]); written.add(id); continue; }
      }
      const old = S.entries[id];
      // deux fichiers du même dépôt qui portent la même vente : les deux imports sont retenus
      const importIds = { ...((old && old.importIds) || (old && old.importId ? { [old.importId]: true } : {})), ...(batchImp[id] || {}), [impId]: true }; batchImp[id] = importIds;
      // B2B : l'entreprise reste comptée à sa première facture, chez le commercial d'origine.
      const keepFirst = e.kpiId === 'b2b' && old && old.date && old.date <= e.date;
      ops.push([['entries', id], { id, userId: keepFirst ? old.userId || uid : uid, clubId: club, kpiId: e.kpiId, date: keepFirst ? old.date : e.date, value: e.value, source: 'import', importId: impId, importIds, rowKey: e.key, at: now, ...(e.line ? { line: e.line } : {}), ...(e.clientNum ? { clientNum: String(e.clientNum) } : {}), ...(e.down ? { down: true } : {}), ...(e.offer ? { offer: String(e.offer).slice(0, 80) } : {}), ...(e.priceHT != null ? { priceHT: e.priceHT } : {}), ...(e.engaged != null ? { engaged: e.engaged } : {}), ...(e.option ? { option: true } : {}) }]);
    }
    // Export de gestion qui couvre une periode complete : Resamania fait foi sur
    // cette periode. Une vente deja importee absente du nouveau fichier (annulee
    // dans Resamania), ET une saisie manuelle de la meme famille de KPI absente
    // du fichier (erreur de saisie), ne comptent plus. L'historique (relances,
    // contacts) n'est pas touche. Annuler ce nouvel import les fait revenir.
    const RSM_KPIS = { ventes: ['contrats'], factures: ['nutrition', 'accessoires'], 'lignes-factures': ['nutrition', 'accessoires'] };
    if (RSM_KPIS[r.def.id] && r.entries.length) {
      const ds = r.entries.map(e => e.date).sort(); const from = ds[0], to = ds[ds.length - 1];
      const kset = new Set(RSM_KPIS[r.def.id]);
      summary.removed = 0;
      for (const e of Object.values(S.entries)) {
        if (e.clubId !== club || written.has(e.id) || e.date < from || e.date > to || !entryCounts(e)) continue;
        if (e.source === 'import') { const ids = Object.keys(e.importIds || (e.importId ? { [e.importId]: 1 } : {})); if (!ids.some(i => S.imports[i] && S.imports[i].defId === r.def.id)) continue; }
        else if (e.source === 'manual' && kset.has(e.kpiId) && !e.adjust) { /* saisie manuelle de la periode non confirmee par l'import */ }
        else continue;
        ops.push([['entries', e.id, 'removedBy'], impId]); summary.removed++;
      }
    }
    for (const x of r.recov) {
      let canal = x.canal, uid = null;
      if (canal === 'equipe') { uid = pick(x.seller); if (!uid) { const ch = choiceFor(x.seller, choices, unk); canal = ch === 'system' ? 'client' : ch === 'ignore' ? 'tiers' : 'equipe'; } }
      let id = 'v' + hkey(club + '|' + x.key);
      if (x.legacyKey && (S.recov || {})['v' + hkey(club + '|' + x.legacyKey)]) id = 'v' + hkey(club + '|' + x.legacyKey);
      const rvOld = (S.recov || {})[id]; const rvImp = { ...((rvOld && rvOld.importIds) || (rvOld && rvOld.importId ? { [rvOld.importId]: true } : {})), [impId]: true };
      ops.push([['recov', id], { importIds: rvImp, id, clubId: club, date: x.date, amount: x.amount, canal, userId: uid, type: x.type || '', moyen: x.moyen || '', clientNum: x.clientNum || '', author: x.author || '', incidentDate: x.incidentDate || null, importId: impId, at: now, ...(x.line ? { line: x.line } : {}) }]);
      summary.recov++;
    }
    const wasErased = typeof erasedNums === 'function' ? erasedNums(club) : () => false; const back = Object.keys(r.clients).filter(wasErased);
    if (back.length) summary.erased = (summary.erased || 0) + back.length;
    for (const [num, o0] of Object.entries(r.clients)) {
      const { sellerObj, ...o } = o0; if (sellerObj) { const sid = pick(sellerObj); if (sid) o.sellerId = sid; }
      const c0 = clientIdx['n:' + num] || { id: 'c' + hkey(club + '|n:' + num), clubId: club, num };
      const cur = pendingClients[c0.id] || c0;
      // Ancien membre qui re-signe : on garde la trace du retour (réactivation).
      if (o.start && /ancien|perdu/.test(norm(cur.status || '')) && o.start > (cur.endDate || '')) o.returnedAt = o.start;
      // Un sortant importé n'écrase pas un client redevenu actif depuis.
      if (o.status === 'Ancien client' && cur.start && o.endDate && cur.start > o.endDate) { delete o.status; delete o.endDate; }
      // Renouvellement : nouvelle vente proche de la fin d'engagement, la relance de fin de contrat est gagnée.
      if (r.def.id === 'ventes' && o.start && cur.end && cur.start && o.start > cur.start && o.start >= addDays(cur.end, -45)) { const k = relKey('fincontrat', c0.id, cur.end); ops.push([['relances', k, 'status'], 'gagne'], [['relances', k, 'result'], 'renouvele'], [['relances', k, 'closedAt'], now], [['relances', k, 'kind'], 'fincontrat'], [['relances', k, 'clubId'], club]); o.renewedAt = o.start; o.end = null; }
      clientIdx['n:' + num] = c0; upClient(c0, o); summary.clients++;
    }
    for (const o of r.clientsByName) {
      const t = tokensKey(o.name); const { name, strict, ...rest } = o; const patch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v));
      if (strict) {
        // Fins de contrat sans numéro : un seul candidat sûr, sinon file « À rapprocher ». Jamais de fiche créée.
        const linked = deepGet(S, ['rsm', 'nameLinks', club, safeKey(t)]);
        let cands = Object.values(S.clients).filter(c => c.clubId === club && tokensKey(c.name || '') === t);
        if (linked && S.clients[linked]) cands = [S.clients[linked]];
        else if (cands.length > 1 && o.offer) { const by = cands.filter(c => c.offer && norm(o.offer).includes(norm(c.offer))); if (by.length) cands = by; }
        if (cands.length > 1 && o.start) { const by = cands.filter(c => c.start && Math.abs(dateOf(c.start) - dateOf(o.start)) <= 3 * 864e5); if (by.length) cands = by; }
        if (cands.length === 1) { upClient(cands[0], patch); summary.matched2 = (summary.matched2 || 0) + 1; }
        else { ops.push([['rsm', 'pendingMatches', club, safeKey(t + '|' + (o.end || ''))], { name, end: o.end || null, offer: o.offer || '', start: o.start || null, candidates: Object.values(S.clients).filter(c => c.clubId === club && tokensKey(c.name || '') === t).map(c => c.id), at: now }]); if (cands.length) summary.doubt = (summary.doubt || 0) + 1; else summary.nomatch = (summary.nomatch || 0) + 1; }
        continue;
      }
      const c0 = clientIdx['t:' + t] || { id: 'c' + hkey(club + '|t:' + t), clubId: club, name: o.name };
      clientIdx['t:' + t] = c0; upClient(c0, patch); summary.clients++;
    }
    if (r.balances) {
      const listed = new Set();
      r.balances.list.forEach(b0 => { const b = { ...b0, amount: Math.round(b0.amount * 100) / 100 }; const c0 = clientIdx['n:' + b.num] || { id: 'c' + hkey(club + '|n:' + b.num), clubId: club, num: b.num, name: b.name }; clientIdx['n:' + b.num] = c0; listed.add(c0.id); upClient(c0, { ...(b.phone ? { phone: b.phone, phoneSrc: 'rsm' } : {}), ...(b.email ? { email: b.email } : {}), ...(b.oldest ? { oldestIncident: b.oldest } : {}), balance: Math.round(b.amount * 100) / 100, incidents: b.count, balanceAt: Math.abs(Number((pendingClients[c0.id] || c0).balance) - b.amount) < 0.005 ? ((pendingClients[c0.id] || c0).balanceAt || today()) : today(), name: c0.name || b.name }); });
      // photo complete des impayes en cours : un client absent n'a plus d'impaye.
      // La photo « Clients en incident » ET la liste des incidents « en cours »
      // sont toutes deux completes (elles listent qui doit aujourd'hui) : un
      // client reglé en disparaît, on remet donc son solde a 0 pour ne plus
      // l'appeler. Avec regularisation correspondante le dossier passe
      // « récupéré », sinon « à vérifier ».
      if (['clients-incident', 'incidents'].includes(r.balances.src) && r.balances.list.length) Object.values(S.clients).filter(c => c.clubId === club && Number(c.balance) > 0 && !listed.has(c.id)).forEach(c => {
        const rv = lastRecov(club, c.num, B);
        upClient(c, { balance: 0, incidents: 0, dunning: { ...(c.dunning || {}), status: rv ? 'recupere' : 'a_verifier', recoveredAt: rv ? rv.date : today(), amount: Number(c.balance), canal: rv ? rv.canal : null, by: rv ? (rv.userId || null) : null, auto: true } });
      });
    }
    if (r.balances) ops.push([['rsm', 'controls', club, 'du', today()], Math.round(r.balances.list.reduce((s2, b) => s2 + b.amount, 0) * 100) / 100]);
    if (r.noMandate) {
      const listed = new Set();
      r.noMandate.forEach(b => { const c0 = clientIdx['n:' + b.num] || { id: 'c' + hkey(club + '|n:' + b.num), clubId: club, num: b.num, name: b.name }; clientIdx['n:' + b.num] = c0; listed.add(c0.id); upClient(c0, { ...(b.phone ? { phone: b.phone, phoneSrc: 'rsm' } : {}), noMandate: true, noMandateAt: (pendingClients[c0.id] || c0).noMandate ? ((pendingClients[c0.id] || c0).noMandateAt || today()) : today(), offer: (pendingClients[c0.id] || c0).offer || b.offer, name: c0.name || b.name }); });
      Object.values(S.clients).filter(c => c.clubId === club && c.noMandate && !listed.has(c.id)).forEach(c => upClient(c, { noMandate: false }));
    }
    for (const x of r.resil) {
      const id = 'rs' + hkey(club + '|' + x.key);
      const old = S.resiliations[id];
      const owner = old && old.ownerId ? old.ownerId : pick(x.seller);
      // L'arbitrage Resamania fait foi : à arbitrer => à traiter, acceptée => départ, rejetée/annulée => historique.
      const arbMap = { submitted: 'nouvelle', accepted: 'resiliee', rejected: 'rejetee', canceled: 'sauvee' };
      const imported = x.arb ? arbMap[x.arb] : (x.saved ? 'sauvee' : (x.effective || x.date) >= today() ? 'nouvelle' : 'resiliee');
      // Une issue déjà tranchée dans Fit Pulse (sauvée ou résiliée) n'est jamais écrasée ; sinon l'import fait foi.
      const status = old && (old.status === 'sauvee' || old.status === 'resiliee') ? old.status : imported;
      // Un dossier garde la liste de ses imports : annuler l'un ne cache pas ce qu'un autre porte, réimporter le fait réapparaître.
      const { hidden: _h, ...prev } = old || {}; const resImp = { ...(prev.importIds || (prev.importId ? { [prev.importId]: true } : {})), [impId]: true };
      const sameDay = prev.sameDay || (x.nature === 'option' && Object.values(S.clients).some(cc => cc.clubId === club && cc.start === x.date && tokensKey(cc.name || '') === tokensKey(x.client || '')));
      ops.push([['resiliations', id], { ...prev, importIds: resImp, nature: prev.nature || x.nature || 'abonnement', sameDay, id, clubId: club, client: x.client, date: x.date, effective: x.effective || (old && old.effective) || null, reason: x.reason, type: x.type, status, saved: status === 'sauvee', ownerId: owner || null, userId: owner || null, importId: impId, source: 'resamania', at: (old && old.at) || now }]);
      if (status === 'sauvee' && owner && !S.entries['sv_' + id]) ops.push([['entries', 'sv_' + id], { id: 'sv_' + id, userId: owner, clubId: club, kpiId: 'sauvetage', date: x.date, value: 1, source: 'import', importId: impId, at: now }]);
      summary.resil++;
    }
    // Prospects nominatifs : id stable, reimport sans doublon, suivi Fit Pulse conserve.
    for (const p of r.prospects) {
      const id = 'p' + hkey(club + '|' + p.key); const old = (S.prospects || {})[id] || {};
      const { key, seller, ...rest } = p; const uid = pick(seller) || (seller && seller.status === 'system' ? 'pso' : null);
      ops.push([['prospects', id], { ...old, ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== '' && v != null)), id, clubId: club, commercialId: uid || old.commercialId || null, importId: impId, at: old.at || now }]);
    }
    if (r.prospects.length) summary.prospects = (summary.prospects || 0) + r.prospects.length;
    // Entreprises clientes (Société du client) : créées ou mises à jour, statut signé.
    for (const co of Object.values(r.companies)) {
      const id = 'co' + hkey(club + '|' + norm(co.nom)); const old = (S.companies || {})[id] || {};
      ops.push([['companies', id], { ...old, id, clubId: club, nom: old.nom || co.nom, statut: 'signe', signeLe: old.signeLe || r.from || today(), adherents: co.nums.length || old.adherents || 0, nums: co.nums.length ? co.nums : (old.nums || []), hist: { ...(old.hist || {}), [(r.from || today()).slice(0, 7)]: co.nums.length }, at: old.at || now }]);
      co.nums.forEach(num => { const c0 = clientIdx['n:' + num]; if (c0) upClient(c0, { company: co.nom }); });
    }
    if (Object.keys(r.flags).length) ops.push([['rsm', 'flags', club, r.def.id], r.flags]);
    if (r.counts.descentes) summary.descentes = (summary.descentes || 0) + r.counts.descentes;
    // controles
    const mk = r.month || (r.from || today()).slice(0, 7);
    const agg = {};
    for (const [k, v] of r.controls) {
      if (k === 'tti' || k === 'perf') { const uid = pick(v.seller) || 'x:' + safeKey(norm(v.seller.label)); ops.push([['rsm', 'controls', club, k, mk, uid], k === 'tti' ? { created: v.created, transformed: v.transformed } : v.contrats]); }
      else if (k === 'web') agg['web|' + v.date] = (agg['web|' + v.date] || 0) + v.amount;
      else if (k === 'payments') agg['payments|' + v.date + '|' + safeKey(v.moyen)] = (agg['payments|' + v.date + '|' + safeKey(v.moyen)] || 0) + v.amount;
      else if (k === 'ca') ops.push([['rsm', 'controls', club, 'ca', v.month], { total: v.total, abo: v.abo, options: v.options, boutique: v.boutique, at: now }]);
      else if (k === 'lost' || k === 'gained') { ops.push([['rsm', 'controls', club, 'evo', mk, k], v.count]); if (k === 'lost') ops.push([['base', club, mk, 'sortants'], v.count]); }
    }
    Object.entries(agg).forEach(([k, v]) => ops.push([['rsm', 'controls', club, ...k.split('|')], Math.round(v * 100) / 100]));
  }
  Object.values(pendingClients).forEach(c => ops.push([['clients', c.id], c]));
  return { ops, summary };
}
ACTIONS.rsmCommit = () => {
  const { ops, summary } = rsmCommitPlan(UI.rsmBatch, { club: CLUB.id, choices: UI.rsmChoices || {}, by: ME.id });
  db.batch(ops);
  UI.rsmBatch = null; UI.rsmDone = summary; render();
  toast(`Import Resamania terminé : ${plur(summary.files, 'fichier', 'fichiers')}`);
};
function rsmDoneCard() {
  const s = UI.rsmDone; const mk = addMonths(curMonth(), -1);
  // controle : contrats Fit Pulse vs Page 1 des performances commerciales
  const perf = deepGet(ctrl(), ['perf', mk]); const ppC = sumRange(CLUB.id, null, 'contrats', mk + '-01', `${mk}-${daysIn(mk)}`);
  const perfTot = perf ? Object.values(perf).reduce((a, b) => a + Number(b || 0), 0) : null;
  return `<div class="card" style="margin-bottom:14px;border-color:var(--ok)"><div class="card-head">${ico('check')}<h3>Import terminé</h3><span class="spacer"></span><button class="btn ghost sm" data-act="ui" data-key="rsmDone" data-val="">${ico('x')}</button></div>
    <div class="row wrap" style="gap:22px"><div><div class="muted small">Fichiers</div><b class="title t-20">${s.files}</b></div><div><div class="muted small">Saisies créées</div><b class="title t-20">${s.entries}</b></div><div><div class="muted small">Déjà connues (mises à jour, pas de doublon)</div><b class="title t-20">${s.updated}</b></div><div><div class="muted small">Régularisations d’impayés</div><b class="title t-20">${s.recov}</b></div><div><div class="muted small">Fiches clients</div><b class="title t-20">${s.clients}</b></div><div><div class="muted small">Résiliations</div><b class="title t-20">${s.resil}</b></div></div>
    ${perfTot != null ? `<div class="alert ${Math.abs(perfTot - ppC) <= Math.max(1, perfTot * 0.03) ? 'info' : ''}" style="margin-top:12px">${ico('target')}<div><b>Contrôle ${monthLabel(mk)} : ${fmtN(ppC)} contrats dans Fit Pulse, ${fmtN(perfTot)} dans les performances commerciales Resamania</b>${Math.abs(perfTot - ppC) <= Math.max(1, perfTot * 0.03) ? 'Les deux sources concordent.' : 'Écart à vérifier : vente d’abonnements incomplète, ou changements d’offre comptés d’un côté seulement.'}</div></div>` : ''}
    ${s.erased ? `<div class="alert" style="margin-top:12px">${ico('alert')}<div><b>${plur(s.erased, 'adhérent effacé revient', 'adhérents effacés reviennent')} dans cet import</b>Vérifiez qu’ils ont bien un nouveau contrat ; sinon, effacez de nouveau la fiche.</div></div>` : ''}
    ${s.matched2 || s.doubt || s.nomatch ? `<p class="small" style="margin:12px 0 0">Fins de contrat : <b>${s.matched2 || 0}</b> rattachées, <b>${s.doubt || 0}</b> à vérifier, <b>${s.nomatch || 0}</b> sans correspondance.</p>` : ''}
    ${s.recov ? `<div style="margin-top:12px"><a class="btn sm primary" href="#/impayes">Voir les impayés par canal ${ico('chevR')}</a></div>` : ''}</div>`;
}
// « À rapprocher » : lignes Abonnements sans fiche sûre. Le choix est retenu pour les imports suivants.
function rsmPending() {
  const P = Object.entries(deepGet(S, ['rsm', 'pendingMatches', CLUB.id]) || {}); if (!P.length) return '';
  return `<div class="card" style="margin-bottom:14px"><div class="card-head">${ico('alert')}<h3>À rapprocher (${P.length})</h3></div><p class="muted small">Fins de contrat dont le nom correspond à plusieurs fiches, ou à aucune. Aucune date n’est écrite tant que vous n’avez pas choisi.</p>
    ${P.slice(0, 30).map(([k, x]) => `<div class="row wrap opp-mini"><div class="spacer"><b>${esc(x.name)}</b><div class="muted small">${esc(x.offer || 'offre inconnue')} · fin le ${x.end ? dmy(x.end) : 'n.d.'}</div></div>
      <select class="input sm" style="width:auto" data-change="pmPick" data-k="${esc(k)}"><option value="">${(x.candidates || []).length ? 'Choisir la fiche' : 'Aucune fiche à ce nom'}</option>${((x.candidates || [])).map(id => S.clients[id]).filter(Boolean).map(c => `<option value="${c.id}">${esc(c.name)}${c.num ? ' · n° ' + esc(c.num) : ''}${c.offer ? ' · ' + esc(c.offer) : ''}</option>`).join('')}</select>
      <button class="btn sm ghost" data-act="pmIgnore" data-k="${esc(k)}">Ignorer</button></div>`).join('')}</div>`;
}
ACTIONS.pmPick = el => {
  const k = el.dataset.k; const x = deepGet(S, ['rsm', 'pendingMatches', CLUB.id, k]); const c = S.clients[el.value]; if (!x || !c) return;
  db.batch([[['clients', c.id, 'end'], x.end], ...(x.offer ? [[['clients', c.id, 'offer'], c.offer || x.offer]] : []), [['rsm', 'nameLinks', CLUB.id, safeKey(tokensKey(x.name))], c.id], [['rsm', 'pendingMatches', CLUB.id, k], null]]);
  toast('Rattaché, et retenu pour les prochains imports');
};
ACTIONS.pmIgnore = el => db.set(['rsm', 'pendingMatches', CLUB.id, el.dataset.k], null);

// ── Page Impayés : tous les canaux ────────────────────────────────────────
const recovLive = x => { const ids = x.importIds ? Object.keys(x.importIds) : x.importId ? [x.importId] : []; return !ids.length || ids.some(impActive); };
function recovList(clubId, from, to) {
  return Object.values(S.recov || {}).filter(x => x.clubId === clubId && x.date >= from && x.date <= to && x.canal !== 'annule' && recovLive(x));
}
const impayesAnalyse = {
  render() {
    const mk = UI.impMonth || curMonth();
    const r = rangeOf('month', mk);
    const list = recovList(CLUB.id, r.from, r.to);
    // Montants : le calcul unique recoveredFor (Réglé à la main compris) ; nombres : régularisations importées.
    const total = recoveredFor(CLUB.id, r); const parts = recoveredParts(CLUB.id, r);
    const by = {}; Object.keys(RECOV_CHANNELS).forEach(k => { by[k] = { v: parts[k] || 0, n: 0 }; }); list.forEach(x => { const b = by[x.canal === 'equipe' && !x.userId ? 'equipe_na' : x.canal] || by.tiers; b.n++; });
    const team = {}; list.filter(x => x.canal === 'equipe').forEach(x => { const k = x.userId || '_'; const t = team[k] = team[k] || { v: 0, n: 0 }; t.v += x.amount; t.n++; });
    const clients = Object.values(S.clients).filter(c => c.clubId === CLUB.id && Number(c.balance) > 0).sort((a, b) => b.balance - a.balance);
    const enCours = clients.reduce((s, c) => s + Number(c.balance), 0);
    const balAt = clients.reduce((m, c) => (c.balanceAt && c.balanceAt > m ? c.balanceAt : m), '');
    const web = Object.entries(ctrl().web || {}).filter(([d]) => d >= r.from && d <= r.to).reduce((s, [, v]) => s + Number(v), 0);
    // 6 derniers mois, barres empilees par canal
    const months = []; for (let i = 5; i >= 0; i--) months.push(addMonths(mk, -i));
    const mt = months.map(m => { const rg = { from: m + '-01', to: `${m}-${daysIn(m)}` }; return { m, o: recoveredParts(CLUB.id, rg), t: recoveredFor(CLUB.id, rg) }; });
    const max = Math.max(1, ...mt.map(x => x.t));
    const empty = !Object.keys(S.recov || {}).some(id => S.recov[id].clubId === CLUB.id);
    return `<div class="row wrap" style="margin-bottom:14px"><p class="muted spacer" style="margin:0">Tous les canaux, d’après la liste Incidents de Resamania (Auteur de la régularisation). ${esc(CLUB.name)}</p>${monthNav('impMonth', mk)}</div>
      ${empty ? `<div class="alert info" style="margin-bottom:14px">${ico('info')}<div><b>Aucune régularisation importée</b>Dans Resamania : Données financières > Incidents > FILTRER (Statut = Régularisé, Date de régularisation = le mois, Club) > ⋮ > Exporter. Déposez le fichier dans Imports > Resamania.</div></div>` : ''}
      <div class="grid" style="grid-template-columns:1.2fr 1fr;margin-bottom:14px">
        <div class="card hero" style="grid-template-columns:1fr"><div><div class="muted small">Récupéré en ${monthLabel(mk)}, tous canaux</div><div class="big">${fmtE(total)}</div>
          <div class="muted small" style="margin-top:4px">${plur(list.length, 'régularisation', 'régularisations')} · dont équipe ${fmtE(by.equipe.v)} (${fmtP(total ? by.equipe.v / total : null)})</div>
          <div style="display:flex;height:14px;border-radius:99px;overflow:hidden;margin-top:14px;background:#26262a">${Object.entries(RECOV_CHANNELS).map(([k, c]) => by[k].v ? `<i style="width:${by[k].v / total * 100}%;background:${c.color}" title="${esc(c.label)} : ${fmtE(by[k].v)}"></i>` : '').join('')}</div></div></div>
        <div class="card"><div class="muted small">Impayés en cours</div><div class="title t-32">${fmtE(enCours)}</div><div class="muted small">${plur(clients.length, 'client débiteur', 'clients débiteurs')}${balAt ? ` · photo du ${dmy(balAt)}` : ''}</div>
          <a class="btn sm" style="margin-top:10px" href="#/loyalty" data-act="loyImpaye">${TXT.garder.relancer} ${ico('chevR')}</a></div></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(200px, 100%), 1fr));margin-bottom:14px">
        ${Object.entries(RECOV_CHANNELS).map(([k, c]) => `<div class="card"><div class="row"><i style="width:10px;height:10px;border-radius:3px;background:${c.color};flex:none"></i><b class="small">${c.label}</b></div><span class="badge" style="margin-top:6px">${c.human ? 'action de l’équipe' : 'sans action du club'}</span><div class="title t-24" style="margin-top:6px">${fmtE(by[k].v)}</div><div class="muted small">${by[k].n} régul. · ${fmtP(total ? by[k].v / total : null)}</div><div class="muted small" style="margin-top:6px">${c.hint}</div></div>`).join('')}</div>
      <div class="grid" style="grid-template-columns:1fr 1fr">
        <div class="card"><h3>Part de l’équipe (prime impayés)</h3><p class="muted small">Seul le canal « Équipe du club » compte pour le KPI Impayés récupérés et le classement.</p>
          ${Object.entries(team).sort((a, b) => b[1].v - a[1].v).map(([uid, t]) => `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)">${uid === '_' ? '<span class="avatar xs">?</span><span class="spacer">Non rattaché <a href="#/members" data-act="goAliases" class="small">rattacher</a></span>' : `${avatar(S.users[uid], 'xs')}<span class="spacer">${esc(fullName(S.users[uid]))}</span>`}<span class="muted small">${t.n}</span><b>${fmtE(t.v)}</b></div>`).join('') || '<p class="muted">Aucune régularisation par l’équipe ce mois-ci.</p>'}</div>
        <div class="card"><h3>6 derniers mois</h3><div style="display:grid;gap:8px;margin-top:10px">${mt.map(x => `<div style="display:grid;grid-template-columns:62px 1fr 80px;gap:10px;align-items:center"><span class="small">${MOIS_C[Number(x.m.slice(5)) - 1]} ${x.m.slice(2, 4)}</span><div style="display:flex;height:14px;border-radius:4px;overflow:hidden;background:var(--surface-2)">${Object.entries(RECOV_CHANNELS).map(([k, c]) => x.o[k] ? `<i style="width:${x.o[k] / max * 100}%;background:${c.color}" title="${esc(c.label)} : ${fmtE(x.o[k])}"></i>` : '').join('')}</div><b class="small" style="text-align:right">${fmtE(x.t)}</b></div>`).join('')}</div>
          <div class="legend" style="margin-top:10px">${Object.values(RECOV_CHANNELS).map(c => `<span><i style="background:${c.color}"></i>${c.label}</span>`).join('')}</div></div></div>
      <div class="card" style="margin-top:14px"><h3>Contrôles</h3><div class="small" style="display:grid;gap:6px;margin-top:8px">
        <div>Client en ligne (Incidents) : <b>${fmtE(by.client.v)}</b> · Transactions Web avec Recouvrement = 1 : <b>${web ? fmtE(web) : 'non importé'}</b>${web ? (Math.abs(web - by.client.v) <= Math.max(5, web * 0.05) ? ' <span class="badge ok">concordant</span>' : ' <span class="badge warn">écart</span>') : ''}</div>
        <div>Comparez le total avec Resamania : Tableaux de bord > Vos prélèvements > graphique <b>Recouvrements</b> (barre du mois). La tuile « Total des montants recouverts » est un cumul depuis le démarrage : ne pas l’utiliser pour un mois.</div>
        <div class="muted">Le montant compté est celui du paiement rejeté régularisé (pas forcément l’encaissement si le client a payé en plusieurs fois). Les incidents clos par avoir ne sont pas de l’argent encaissé : ils sont exclus.</div></div></div>${dunSpeed(mk)}`;
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
  return `<div class="card" style="margin-bottom:14px"><h3>Correspondances Resamania</h3><p class="muted small">Resamania écrit un même commercial de plusieurs façons : « NOM Prénom », « Prénom NOM &lt;e-mail&gt; {id} » ou un code (ABCD). Le nom et l’e-mail du membre sont reconnus d’office, dans n’importe quel ordre et casse. Ajoutez ici les codes trigrammes et les autres formes.</p>
    <form id="alf" class="row wrap" style="margin-top:10px"><input class="input sm" style="width:260px" name="v" placeholder="Code (ABCD), e-mail ou NOM Prénom"><select class="input sm" style="width:auto" name="u">${members.map(u => `<option value="${u.id}">${esc(fullName(u))}</option>`).join('')}<option value="system">Vente en ligne / système</option><option value="ignore">Ignorer</option></select><button class="btn sm primary" type="button" data-act="aliasAdd">${ico('plus')} Ajouter</button></form></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(300px, 100%), 1fr))">
    ${members.map(u => `<div class="card"><div class="row">${avatar(u, 'xs')}<b class="spacer">${esc(fullName(u))}</b></div><div class="muted small" style="margin:6px 0">Reconnu d’office : ${esc(fullName(u))}${u.email ? ' · ' + esc(u.email) : ''}</div>${(byUser[u.id] || []).map(k => `<div class="row small" style="padding:3px 0">${pretty(k)}<span class="spacer"></span><button class="btn ghost icon sm" data-act="aliasDel" data-k="${esc(k)}" title="Retirer">${ico('x')}</button></div>`).join('') || '<div class="muted small">Aucune autre forme enregistrée.</div>'}</div>`).join('')}
    ${['system', 'ignore'].map(t => `<div class="card"><b>${t === 'system' ? 'Vente en ligne / système' : 'Ignorés'}</b><div class="muted small" style="margin:6px 0">${t === 'system' ? 'Jamais attribué à un commercial. Toujours reconnus : Traitement automatique, Automatismes, Site web de l’enseigne, PSO Site (SPSO), En ligne, BackOffice Mobile, Espace membre.' : 'Lignes non importées.'}</div>${(byUser[t] || []).map(k => `<div class="row small" style="padding:3px 0">${pretty(k)}<span class="spacer"></span><button class="btn ghost icon sm" data-act="aliasDel" data-k="${esc(k)}">${ico('x')}</button></div>`).join('')}</div>`).join('')}</div>`;
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
