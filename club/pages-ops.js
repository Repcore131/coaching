/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — résiliations (circuit de traitement) et impayés (tableur) ═
//
// Deux listes de travail qui remplacent les Sheets et Google Docs du club.
// Chaque dossier a un statut, UN responsable et une échéance ; chaque action
// est datée et signée. Les imports Resamania mettent les dossiers à jour sans
// jamais effacer ce que l'équipe y a noté.

// ── Résiliations ──────────────────────────────────────────────────────────
const RES_STATUS = {
  nouvelle: { label: 'Nouvelle', cls: 'warn' },
  traitement: { label: 'En traitement', cls: 'info' },
  sauvee: { label: 'Sauvée', cls: 'ok' },
  resiliee: { label: 'Résiliée', cls: 'bad' },
};
const RES_REASONS = ['Prix', 'Déménagement', 'Santé', 'Manque de temps', 'Insatisfaction', 'Concurrence', 'Autre'];
const RES_OFFERS = ['Suspension', 'Changement de formule', 'Geste commercial', 'Offre fidélité', 'Rendez-vous coach', 'Aucune'];
const RES_CALLS = { noanswer: 'Pas de réponse', message: 'Message laissé', rdv: 'RDV pris', offer: 'Offre proposée', refus: 'Refus' };
// les anciens dossiers n'avaient que « saved » : on en déduit le statut
const resStatus = r => r.status || (r.saved ? 'sauvee' : 'resiliee');
const resOpen = r => ['nouvelle', 'traitement'].includes(resStatus(r));
const daysTo = d => d ? Math.round((dateOf(d) - dateOf(today())) / 86400000) : null;
function resUrgent(r) { const n = daysTo(r.effective); return resOpen(r) && n != null && n <= 7; }
function resList(clubId) { return Object.values(S.resiliations).filter(r => r.clubId === clubId && !r.hidden); }
function resToHandle(clubId) { return resList(clubId).filter(r => resOpen(r)); }

PAGES.resiliations = {
  title: 'Résiliations',
  render() {
    const tab = UI.resTab || 'todo';
    const all = resList(CLUB.id);
    const open = all.filter(resOpen).sort((a, b) => (resUrgent(b) - resUrgent(a)) || (valeurEnJeu(b).euros - valeurEnJeu(a).euros) || (a.effective || a.date).localeCompare(b.effective || b.date));
    const mk = UI.resMonth || curMonth();
    const month = all.filter(r => r.date.slice(0, 7) === mk);
    // sauvé = date du sauvetage ; résilié = date effective (à défaut, date de la demande)
    const saved = all.filter(r => resStatus(r) === 'sauvee' && ((S.entries['sv_' + r.id] || {}).date || r.date).slice(0, 7) === mk).length;
    const lost = all.filter(r => resStatus(r) === 'resiliee' && (r.effective || r.date).slice(0, 7) === mk).length;
    const handledTimes = month.map(r => { const a = resActions(r).find(x => x.label !== 'Demande enregistrée'); return a && r.at ? (a.at - r.at) / 86400000 : null; }).filter(x => x != null && x >= 0);
    const reasons = {}; month.forEach(r => { const k = r.reason || 'Non renseigné'; reasons[k] = (reasons[k] || 0) + 1; });
    const noOwner = open.filter(r => !r.ownerId).length, urgent = open.filter(resUrgent).length;
    const enJeu = r => Number(r.enJeu) || valeurEnJeu(r).euros;
    const vSaved = all.filter(r => resStatus(r) === 'sauvee' && ((S.entries['sv_' + r.id] || {}).date || r.date).slice(0, 7) === mk).reduce((s, r) => s + enJeu(r), 0);
    const vLost = all.filter(r => resStatus(r) === 'resiliee' && (r.effective || r.date).slice(0, 7) === mk).reduce((s, r) => s + enJeu(r), 0);
    const head = `<div class="page-head"><div><h1>Résiliations</h1><p>${esc(CLUB.name)} · chaque demande a un responsable, une échéance et une issue.</p></div><span class="spacer"></span><button class="btn" data-act="resExport">${ico('download')} Exporter</button><button class="btn primary" data-act="resNew">${ico('plus')} Nouvelle demande</button></div>`;
    const kpis = `<div class="stat-row">
      <div class="stat ${open.length ? 'hot' : ''}"><span>À traiter</span><b>${open.length}</b><small>${noOwner} sans responsable</small></div>
      <div class="stat ${urgent ? 'alarm' : ''}"><span>Échéance ≤ 7 jours</span><b>${urgent}</b><small>à appeler en priorité</small></div>
      <div class="stat"><span>Sauvées · ${MOIS[Number(mk.slice(5)) - 1].toLowerCase()}</span><b class="ok">${saved}</b><small>taux de sauvetage ${fmtP(saved + lost ? saved / (saved + lost) : null)}</small></div>
      <div class="stat"><span>Valeur sauvée ce mois</span><b class="ok">${fmtE(vSaved)}</b><small>mensualités gardées</small></div>
      <div class="stat"><span>Valeur perdue ce mois</span><b class="bad">${fmtE(vLost)}</b><small>résiliations effectives</small></div>
      <div class="stat"><span>Prise en charge</span><b>${handledTimes.length ? (handledTimes.reduce((a, b) => a + b, 0) / handledTimes.length).toFixed(1).replace('.', ',') + ' j' : 'n.d.'}</b><small>délai moyen avant le 1er appel</small></div></div>`;
    let body;
    if (tab === 'todo') {
      body = open.length ? `<div class="grid">${open.map(resCard).join('')}</div>` : `<div class="card">${emptyBox({ art: 'done', title: 'Aucune demande à traiter', text: 'Les nouvelles demandes, saisies ou importées de Resamania, arrivent ici.' })}</div>`;
    } else {
      body = `<div class="row wrap" style="margin-bottom:12px">${monthNav('resMonth', mk)}</div>${resOffersTables(month, enJeu)}
        ${month.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Demande</th><th>Client</th><th>Motif</th><th>Effective</th><th>Responsable</th><th>Statut</th></tr></thead><tbody>${month.sort((a, b) => b.date.localeCompare(a.date)).map(r => `<tr class="click" data-act="resOpen" data-id="${r.id}"><td>${dmy(r.date)}</td><td><b>${esc(r.client)}</b></td><td>${esc(r.reason || 'Non précisé')}</td><td>${r.effective ? dmy(r.effective) : 'n.d.'}</td><td>${r.ownerId ? esc(fullName(S.users[r.ownerId])) : '<span class="muted">n.d.</span>'}</td><td><span class="badge ${RES_STATUS[resStatus(r)].cls}">${RES_STATUS[resStatus(r)].label}</span></td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty">Aucune demande ce mois-ci.</div>'}`;
    }
    return head + kpis + tabs('resTab', [['todo', `À traiter (${open.length})`], ['all', 'Historique du mois']], tab) + body;
  },
};
function resCard(r) {
  const n = daysTo(r.effective); const st = resStatus(r); const last = resActions(r).slice(-1)[0];
  const mine = r.ownerId === ME.id;
  return `<div class="card dossier ${resUrgent(r) ? 'urgent' : ''}">
    <div class="row wrap"><div class="spacer" style="min-width:180px"><b class="t-14">${esc(r.client)}</b><div class="muted small">${esc(r.reason || 'Motif non renseigné')} · demande du ${dmy(r.date)}${r.source === 'resamania' ? ' · Resamania' : ''}</div></div>
      ${r.effective ? `<span class="badge ${n <= 7 ? 'bad' : n <= 15 ? 'warn' : ''}">${n < 0 ? 'effective depuis ' + (-n) + ' j' : n === 0 ? 'effective aujourd’hui' : 'J-' + n}</span>` : '<span class="badge">date effective ?</span>'}
      <span class="badge ${RES_STATUS[st].cls}">${RES_STATUS[st].label}</span></div>
    ${(() => { const v = valeurEnJeu(r); const c = clubClients(r.clubId).find(x => tokensKey(x.name || '') === tokensKey(r.client || '')); return `<div class="res-val"><b>En jeu : ${fmtE(v.euros)}</b>${v.estimee ? ' <span class="muted small">valeur estimée</span>' : ''}${c && c.offer ? ` <span class="muted small">· ${esc(c.offer)}</span>` : ''}</div>`; })()}
    ${last ? `<div class="small" style="margin-top:8px"><span class="muted">Dernière action :</span> ${esc(last.label)}${last.note ? '<br><span class="muted">« ' + esc(last.note) + ' »</span>' : ''} <span class="muted">· ${esc(fullName(S.users[last.by]))}, ${ago(last.at)}</span></div>` : ''}
    <div class="row wrap" style="margin-top:10px;gap:6px">
      ${r.ownerId ? `<span class="small">${avatar(S.users[r.ownerId], 'xs')}</span><span class="small spacer">${mine ? '<b>Vous</b>' : esc(fullName(S.users[r.ownerId]))}</span>` : `<button class="btn sm primary" data-act="resTake" data-id="${r.id}">Je m’en occupe</button><span class="spacer"></span>`}
      <button class="btn sm" data-act="resCall" data-id="${r.id}">${ico('phone')} Noter un appel</button>
      <button class="btn sm ok-btn" data-act="resSaveIt" data-id="${r.id}">Sauvée</button>
      <button class="btn sm" data-act="resLose" data-id="${r.id}">Résiliée</button>
      <button class="btn ghost icon sm" data-act="resOpen" data-id="${r.id}" title="Détail">${ico('chevR')}</button></div></div>`;
}
// Historique en ajout seul : chaque action est une cle a part (log/<id>), deux
// commerciaux qui notent en meme temps ne s'ecrasent plus. L'ancien tableau
// « actions » reste lu.
function resLogOp(r, label, extra = {}) { const id = newId(); return [['resiliations', r.id, 'log', id], { at: Date.now(), by: ME.id, label, ...extra }]; }
// Offre proposée (champ structuré, ou ancien libellé « … · Offre »).
const actOffer = a => a.offer || RES_OFFERS.find(o => o !== 'Aucune' && (a.label || '').endsWith(' · ' + o)) || null;
function resOffersTables(month, enJeu) {
  const offers = {}; RES_OFFERS.filter(o => o !== 'Aucune').forEach(o => { offers[o] = { n: 0, ok: 0, v: 0 }; });
  const motifs = {};
  month.forEach(r => {
    const acts = resActions(r); acts.forEach(a => { const o = actOffer(a); if (o && offers[o]) offers[o].n++; });
    const lastO = acts.map(actOffer).filter(Boolean).pop();
    if (resStatus(r) === 'sauvee' && lastO && offers[lastO]) { offers[lastO].ok++; offers[lastO].v += enJeu(r); }
    const k = r.reason || 'Non renseigné'; const m = motifs[k] = motifs[k] || { n: 0, s: 0 }; m.n++; if (resStatus(r) === 'sauvee') m.s++;
  });
  return `<div class="g12" style="margin-bottom:14px"><div class="card col7"><h3>Offre proposée</h3><div class="table-wrap"><table class="t"><thead><tr><th>Offre</th><th class="num">Proposée</th><th class="num">Acceptée</th><th class="num">Taux</th><th class="num">Valeur sauvée</th></tr></thead><tbody>
    ${Object.entries(offers).map(([o, x]) => `<tr><td>${esc(o)}</td><td class="num">${x.n}</td><td class="num">${x.ok}</td><td class="num">${fmtP(x.n ? x.ok / x.n : null)}</td><td class="num">${fmtE(x.v)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card col5"><h3>Par motif</h3><div class="table-wrap"><table class="t"><thead><tr><th>Motif</th><th class="num">Demandes</th><th class="num">Sauvées</th><th class="num">Taux</th></tr></thead><tbody>
    ${Object.entries(motifs).sort((a, b) => b[1].n - a[1].n).map(([k, m]) => `<tr><td>${esc(k)}</td><td class="num">${m.n}</td><td class="num">${m.s}</td><td class="num">${fmtP(m.n ? m.s / m.n : null)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Aucune demande.</td></tr>'}</tbody></table></div></div></div>`;
}
const resActions = r => [...(r.actions || []), ...Object.values(r.log || {})].sort((a, b) => (a.at || 0) - (b.at || 0));
ACTIONS.resTake = el => { const r = S.resiliations[el.dataset.id]; db.batch([[['resiliations', r.id, 'ownerId'], ME.id], [['resiliations', r.id, 'status'], 'traitement'], resLogOp(r, 'Prise en charge')]); toast('Dossier ajouté à vos relances'); };
ACTIONS.resCall = el => {
  const r = S.resiliations[el.dataset.id];
  openModal({ title: `Appel · ${r.client}`, body: `<form id="rcf" class="grid">
    <div class="field"><span>Issue</span><div class="chips">${Object.entries(RES_CALLS).map(([k, l], i) => `<label class="chip-radio"><input type="radio" name="out" value="${k}" ${i === 0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
    <label class="field"><span>Solution proposée</span><select class="input" name="offer">${RES_OFFERS.map(o => `<option>${o}</option>`).join('')}</select></label>
    <label class="field"><span>Note</span><textarea class="input" name="note" placeholder="Rappeler jeudi, intéressé par une suspension…"></textarea></label></form>`,
    foot: '<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="resCallSave">Enregistrer</button>', onMount: m => { m.dataset.id = r.id; } });
};
ACTIONS.resCallSave = () => {
  const r = S.resiliations[$('.modal').dataset.id]; const f = formData($('#rcf'));
  const out = $('#rcf input[name=out]:checked').value;
  db.batch([resLogOp(r, RES_CALLS[out] + (f.offer && f.offer !== 'Aucune' ? ' · ' + f.offer : ''), { note: f.note.trim(), out, offer: f.offer && f.offer !== 'Aucune' ? f.offer : null }), [['resiliations', r.id, 'status'], 'traitement'], [['resiliations', r.id, 'ownerId'], r.ownerId || ME.id]]);
  closeModal(); toast('Appel noté');
};
ACTIONS.resSaveIt = el => {
  const r = S.resiliations[el.dataset.id]; const owner = r.ownerId || ME.id;
  db.batch([[['resiliations', r.id, 'status'], 'sauvee'], [['resiliations', r.id, 'saved'], true], [['resiliations', r.id, 'enJeu'], valeurEnJeu(r).euros], [['resiliations', r.id, 'ownerId'], owner], [['resiliations', r.id, 'userId'], owner], resLogOp(r, 'Client sauvé'),
    [['entries', 'sv_' + r.id], { id: 'sv_' + r.id, userId: owner, clubId: CLUB.id, kpiId: 'sauvetage', date: today(), value: 1, source: 'manual', at: Date.now(), by: ME.id }]]);
  celebrate('Client sauvé', `${r.client} reste au club`, { kind: 'win' });
};
ACTIONS.resLose = async el => {
  const r = S.resiliations[el.dataset.id];
  if (!await confirmDlg(`Confirmer la résiliation de ${esc(r.client)} ?`, { ok: 'Confirmer', danger: true })) return;
  db.batch([[['resiliations', r.id, 'status'], 'resiliee'], [['resiliations', r.id, 'saved'], false], resLogOp(r, 'Résiliation confirmée'), [['entries', 'sv_' + r.id], null]]);
};
ACTIONS.resOpen = el => {
  const r = S.resiliations[el.dataset.id]; const members = clubMembers(CLUB.id);
  openModal({ title: r.client, drawer: true, body: `<form id="rdf" class="grid">
    <div class="form-grid"><label class="field"><span>Statut</span><select class="input" name="status">${Object.entries(RES_STATUS).map(([k, v]) => `<option value="${k}" ${resStatus(r) === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
    <label class="field"><span>Responsable</span><select class="input" name="owner"><option value="">Aucun</option>${members.map(u => `<option value="${u.id}" ${r.ownerId === u.id ? 'selected' : ''}>${esc(fullName(u))}</option>`).join('')}</select></label>
    <label class="field"><span>Date de la demande</span><input class="input" type="date" name="date" value="${r.date}"></label>
    <label class="field"><span>Date effective</span><input class="input" type="date" name="effective" value="${r.effective || ''}"></label>
    <label class="field full"><span>Motif</span><select class="input" name="reason">${[...new Set([...(r.reason ? [r.reason] : []), ...RES_REASONS])].map(o => `<option ${o === r.reason ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label></div>
    <button class="btn primary" type="button" data-act="resDetailSave" data-id="${r.id}">Enregistrer</button></form>
    <h3 style="margin:20px 0 8px">Historique</h3>${resActions(r).slice().reverse().map(a => `<div style="padding:8px 0;border-bottom:1px solid var(--line)" class="small"><b>${esc(a.label)}</b>${a.note ? '<br><span class="muted">« ' + esc(a.note) + ' »</span>' : ''}<div class="muted">${esc(fullName(S.users[a.by]))} · ${dmy(isoOf(new Date(a.at)))} ${timeOf(a.at)}</div></div>`).join('') || '<p class="muted small">Aucune action pour l’instant.</p>'}
    ${isManager() ? `<button class="btn sm danger" style="margin-top:16px" data-act="resDel" data-id="${r.id}">Supprimer la demande</button>` : ''}` });
};
ACTIONS.resDetailSave = el => {
  const r = S.resiliations[el.dataset.id]; const f = formData($('#rdf'));
  // Champ par champ (jamais l'objet entier) : l'historique d'un collegue n'est pas ecrase.
  const P = k => ['resiliations', r.id, k];
  const ops = [[P('status'), f.status], [P('saved'), f.status === 'sauvee'], [P('ownerId'), f.owner || null], [P('userId'), f.owner || null], [P('date'), f.date || r.date], [P('effective'), f.effective || null], [P('reason'), f.reason]];
  if (f.status !== resStatus(r)) ops.push(resLogOp(r, 'Statut : ' + RES_STATUS[f.status].label));
  // Déjà sauvé : le point garde sa date (corriger le motif ne déplace pas le sauvetage d'un mois à l'autre).
  const svOld = S.entries['sv_' + r.id]; const keep = resStatus(r) === 'sauvee' && svOld;
  if (f.status === 'sauvee' && (f.owner || ME.id)) ops.push([['entries', 'sv_' + r.id], { ...(keep ? svOld : {}), id: 'sv_' + r.id, userId: f.owner || ME.id, clubId: CLUB.id, kpiId: 'sauvetage', date: keep ? svOld.date : today(), value: 1, source: keep ? svOld.source || 'manual' : 'manual', at: keep ? svOld.at || Date.now() : Date.now(), by: ME.id }]);
  if (f.status !== 'sauvee') ops.push([['entries', 'sv_' + r.id], null]);
  db.batch(ops); closeModal(); toast('Dossier enregistré');
};
ACTIONS.resNew = () => openModal({ title: 'Nouvelle demande de résiliation', body: `<form id="rf" class="form-grid"><label class="field full"><span>Client (prénom et nom)</span><input class="input" name="client" required></label><label class="field"><span>Date de la demande</span><input class="input" type="date" name="date" value="${today()}"></label><label class="field"><span>Date effective</span><input class="input" type="date" name="effective" value="${addDays(today(), 30)}"></label><label class="field full"><span>Motif</span><select class="input" name="reason">${RES_REASONS.map(r => `<option>${r}</option>`).join('')}</select></label><label class="row full small"><input type="checkbox" name="mine" checked> Je m’en occupe</label></form>`,
  foot: '<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="resCreate">Créer le dossier</button>' });
ACTIONS.resCreate = () => {
  const f = formData($('#rf')); if (!f.client.trim()) { toast('Indiquez le nom du client.'); return; }
  const id = newId();
  db.set(['resiliations', id], { id, clubId: CLUB.id, client: f.client.trim(), date: f.date || today(), effective: f.effective || null, reason: f.reason, status: f.mine ? 'traitement' : 'nouvelle', saved: false, ownerId: f.mine ? ME.id : null, userId: f.mine ? ME.id : null, actions: [{ at: Date.now(), by: ME.id, label: 'Demande enregistrée' }], at: Date.now() });
  closeModal(); toast('Dossier créé');
};
ACTIONS.resDel = async el => { if (await confirmDlg('Supprimer définitivement cette demande ?', { ok: 'Supprimer', danger: true })) { db.batch([[['resiliations', el.dataset.id], null], [['entries', 'sv_' + el.dataset.id], null]]); closeModal(); } };
ACTIONS.resExport = () => {
  const list = resList(CLUB.id).sort((a, b) => a.date.localeCompare(b.date));
  const csv = ['Demande;Effective;Client;Motif;Statut;Responsable;Dernière action', ...list.map(r => [dmy(r.date), r.effective ? dmy(r.effective) : '', r.client, r.reason || '', RES_STATUS[resStatus(r)].label, r.ownerId ? fullName(S.users[r.ownerId]) : '', (resActions(r).slice(-1)[0] || {}).label || ''])];
  downloadFile(`resiliations-${norm(CLUB.name).replace(/ /g, '-')}-CONFIDENTIEL.csv`, toCsv(csv[0].split(';'), csv.slice(1)), 'text/csv;charset=utf-8');
  db.set(['audit', newId()], { at: Date.now(), by: ME.id, action: 'export_csv', club: CLUB.id, type: 'resiliations', lignes: list.length });
};

// ── Impayés : le tableur de suivi ─────────────────────────────────────────
const DUN_STATUS = {
  arelancer: { label: 'À relancer', cls: 'warn' },
  relance: { label: 'Relancé', cls: 'info' },
  promesse: { label: 'Promesse de paiement', cls: 'info' },
  recupere: { label: 'Récupéré', cls: 'ok' },
  a_verifier: { label: 'Soldé, à vérifier', cls: 'warn' },
  perdu: { label: 'Huissier / perdu', cls: 'bad' },
};
const dunOf = c => c.dunning || {};
const dunStatus = c => Number(c.balance) > 0 ? (dunOf(c).status && !['recupere', 'a_verifier'].includes(dunOf(c).status) ? dunOf(c).status : 'arelancer') : (['recupere', 'a_verifier'].includes(dunOf(c).status) ? dunOf(c).status : null);
function dunRows(clubId) {
  return Object.values(S.clients).filter(c => c.clubId === clubId && (Number(c.balance) > 0 || ['recupere', 'a_verifier'].includes(dunOf(c).status)));
}
function dunDue(c) { const n = dunOf(c).next; return Number(c.balance) > 0 && (!n || n <= today()); }

PAGES.impayes = {
  title: 'Impayés',
  render() {
    const tab = isManager() ? (UI.impTab2 || 'suivi') : 'suivi';
    const head = `<div class="page-head"><div><h1>Impayés</h1><p>${esc(CLUB.name)} · le suivi de chaque dossier, alimenté par les imports Resamania.</p></div><span class="spacer"></span><button class="btn" data-act="dunExport">${ico('download')} Exporter</button>${isManager() ? `<button class="btn primary" data-act="dunNew">${ico('plus')} Ajouter un impayé</button>` : ''}</div>`;
    return head + (isManager() ? tabs('impTab2', [['suivi', 'Suivi des dossiers'], ['canaux', 'Récupéré par canal']], tab) : '') + (tab === 'suivi' ? dunTable() : impayesAnalyse.render());
  },
};
function dunTable() {
  const f = UI.dunFilter || 'todo';
  const rows = dunRows(CLUB.id);
  const open = rows.filter(c => Number(c.balance) > 0);
  const mk = curMonth();
  const recMonth = rows.filter(c => dunOf(c).status === 'recupere' && (dunOf(c).recoveredAt || '').slice(0, 7) === mk);
  const total = open.reduce((s, c) => s + Number(c.balance), 0);
  const recov = typeof recovList === 'function' ? recovList(CLUB.id, mk + '-01', `${mk}-${daysIn(mk)}`) : [];
  const recTot = recov.reduce((s, x) => s + x.amount, 0), recTeam = recov.filter(x => x.canal === 'equipe').reduce((s, x) => s + x.amount, 0);
  const pick = {
    todo: c => Number(c.balance) > 0 && dunStatus(c) !== 'perdu',
    due: c => dunDue(c) && dunStatus(c) !== 'perdu',
    mine: c => Number(c.balance) > 0 && dunOf(c).ownerId === ME.id,
    nobody: c => Number(c.balance) > 0 && !dunOf(c).ownerId,
    promesse: c => dunStatus(c) === 'promesse',
    recupere: c => ['recupere', 'a_verifier'].includes(dunOf(c).status) && (dunOf(c).recoveredAt || '').slice(0, 7) === mk,
    perdu: c => dunStatus(c) === 'perdu',
  };
  const q = norm(UI.dunQ || '');
  const list = rows.filter(pick[f]).filter(c => !q || norm(c.name).includes(q) || String(c.num || '').includes(q))
    .sort((a, b) => (Number(b.balance) > 0 && Number(a.balance) > 0 ? dunAttendu(b) - dunAttendu(a) : 0) || (Number(b.balance) - Number(a.balance)) || (dunOf(b).recoveredAt || '').localeCompare(dunOf(a).recoveredAt || ''));
  const tranches = DUN_AGE.map((t, i) => { const L = open.filter(c => dunTranche(c) === i); return { t, n: L.length, v: L.reduce((s, c) => s + Number(c.balance), 0) }; });
  const late30 = open.filter(c => dunAge(c) > 30 && !dunOf(c).ownerId);
  const members = clubMembers(CLUB.id);
  const cnt = k => rows.filter(pick[k]).length;
  const empty = !rows.length;
  return `<div class="stat-row">
      <div class="stat hot"><span>Total dû</span><b>${fmtE(total)}</b><small>${plur(open.length, 'dossier ouvert', 'dossiers ouverts')}</small></div>
      <div class="stat ${cnt('due') ? 'alarm' : ''}"><span>À relancer aujourd’hui</span><b>${cnt('due')}</b><small>${cnt('nobody')} sans responsable</small></div>
      <div class="stat"><span>Récupéré en ${MOIS[Number(mk.slice(5)) - 1].toLowerCase()}</span><b class="ok">${fmtE(recTot)}</b><small>tous canaux · dont équipe ${fmtE(recTeam)}</small></div>
      <div class="stat"><span>Dossiers soldés ce mois</span><b>${recMonth.length}</b><small>passés en « Récupéré »</small></div></div>
    ${open.length ? `<div class="age-tiles">${tranches.map(x => `<div class="age-tile ${x.t[3]}"><span>${x.t[2]}</span><b>${fmtE(x.v)}</b><small>${plur(x.n, 'dossier', 'dossiers')} · attendu ${fmtP(x.t[1])}</small></div>`).join('')}</div>` : ''}
    ${late30.length ? `<div class="alert" style="margin-bottom:12px">${ico('alert')}<div><b>${plur(late30.length, 'dossier a passé', 'dossiers ont passé')} 30 jours sans responsable</b>${late30.slice(0, 4).map(c => esc(c.name || '')).join(', ')}. Chaque semaine perdue fait baisser la chance de récupérer.</div></div>` : ''}
    ${empty ? `<div class="alert info" style="margin-bottom:14px">${ico('info')}<div><b>Aucun impayé pour l’instant</b>Dans Imports Resamania, déposez « Clients en incident » (Points d’attention) et la liste Incidents : chaque client débiteur devient une ligne ici.</div></div>` : ''}
    <div class="row wrap" style="margin-bottom:10px">${seg('dunFilter', [['todo', `En cours ${cnt('todo')}`], ['due', `À relancer ${cnt('due')}`], ['mine', `Mes dossiers ${cnt('mine')}`], ['nobody', `Sans responsable ${cnt('nobody')}`], ['promesse', `Promesses ${cnt('promesse')}`], ['recupere', `Récupérés ${cnt('recupere')}`], ['perdu', `Perdus ${cnt('perdu')}`]], f)}<span class="spacer"></span><input class="input sm" style="width:190px" placeholder="Nom ou n° client" data-input="dunQ" data-focus="dunQ" value="${esc(UI.dunQ || '')}"></div>
    ${list.length ? `<div class="table-wrap sheet"><table class="t"><thead><tr><th>Client</th><th class="num">Montant</th><th>Âge</th><th class="num">Attendu</th><th>Statut</th><th>Responsable</th><th>Prochaine relance</th><th>Note</th><th></th></tr></thead><tbody>
    ${list.slice(0, Number(UI.dunMax || 100)).map(c => { const d = dunOf(c); const st = dunStatus(c); const rec = st === 'recupere';
      return `<tr class="${dunDue(c) ? 'due' : ''}"><td><a href="#/client/${esc(c.id)}"><b>${esc(c.name || 'Sans nom')}</b></a><div class="muted small">${c.num ? 'n° ' + esc(c.num) : ''}${c.phone ? ' · ' + esc(c.phone) : ''}${c.incidents ? ' · ' + plur(c.incidents, 'incident', 'incidents') : ''}</div></td>
        <td class="num"><b>${fmtE(rec ? d.amount || 0 : Number(c.balance))}</b></td>
        <td class="small nowrap">${rec ? 'soldé le ' + dm(d.recoveredAt) : `<span class="age-b ${DUN_AGE[dunTranche(c)][3]}">${plur(dunAge(c), 'jour', 'jours')}</span>`}</td>
        <td class="num">${rec ? '' : fmtE(dunAttendu(c))}</td>
        <td>${rec ? `<span class="badge ok">Récupéré${d.canal && RECOV_CHANNELS[d.canal] ? ' · ' + RECOV_CHANNELS[d.canal].label.toLowerCase() : ''}</span>${d.by ? `<div class="muted small">par ${esc(fullName(S.users[d.by]))}</div>` : ''}` : `<select class="input sm" data-change="dunSet" data-id="${c.id}" data-k="status">${Object.entries(DUN_STATUS).filter(([k]) => k !== 'recupere').map(([k, v]) => `<option value="${k}" ${st === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>`}</td>
        <td>${rec ? '' : d.ownerId ? `<select class="input sm" data-change="dunSet" data-id="${c.id}" data-k="ownerId"><option value="">Aucun</option>${members.map(u => `<option value="${u.id}" ${d.ownerId === u.id ? 'selected' : ''}>${esc(fullName(u))}</option>`).join('')}</select>` : `<button class="btn sm primary" data-act="dunTake" data-id="${c.id}">Je m’en occupe</button>`}</td>
        <td>${rec ? '' : `<input class="input sm" type="date" value="${d.next || ''}" data-change="dunSet" data-id="${c.id}" data-k="next">`}</td>
        <td><input class="input sm note" value="${esc(d.note || '')}" placeholder="Ajouter une note" data-change="dunSet" data-id="${c.id}" data-k="note"></td>
        <td class="nowrap">${rec ? '' : `<button class="btn sm" data-act="dunLink" data-id="${c.id}" title="Copier un SMS avec le lien de paiement">Lien de paiement</button> <button class="btn sm ok-btn" data-act="dunPaid" data-id="${c.id}">Récupéré</button>`}</td></tr>`; }).join('')}</tbody></table></div>${list.length > Number(Number(UI.dunMax || 100)) ? `<button class="btn sm" style="margin-top:8px" data-act="ui" data-key="dunMax" data-val="${Number(UI.dunMax || 100) + 100}">Afficher 100 de plus (${list.length - Number(UI.dunMax || 100)} restants)</button>` : ''}`
      : `<div class="card">${emptyBox({ art: 'done', title: f === 'mine' ? 'Aucun dossier à votre nom' : 'Rien dans cette vue', text: f === 'mine' ? 'Prenez un dossier sans responsable avec « Je m’en occupe ».' : 'Changez de filtre pour voir les autres dossiers.', cta: f === 'mine' ? '<button class="btn primary sm" data-act="ui" data-key="dunFilter" data-val="nobody">Voir les dossiers sans responsable</button>' : '' })}</div>`}
    <p class="muted small">Un client absent du prochain export « Clients en incident » passe automatiquement en « Récupéré », avec le canal lu dans la liste Incidents (équipe, client en ligne, prélèvement…). Les notes, responsables et dates restent d’un import à l’autre.</p>`;
}
// Message de paiement prêt à envoyer (modifiable dans Réglages), noté dans l'historique.
const DUN_SMS = 'Bonjour {prenom}, il reste {montant} à régler sur votre abonnement Fitness Park. Vous pouvez payer en ligne depuis votre espace adhérent ou à l’accueil. Merci, l’équipe du club.';
ACTIONS.dunLink = el => {
  const c = S.clients[el.dataset.id]; const tpl = (S.clubs[CLUB.id] || {}).dunSms || DUN_SMS;
  const txt = tpl.replace(/\{prenom\}/g, (c.name || '').split(' ')[0]).replace(/\{montant\}/g, fmtE(Number(c.balance)));
  const done = () => { db.batch([dunPatch(c, {}, 'Lien de paiement envoyé')]); toast('Message copié : collez-le dans un SMS'); };
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(done, () => { openModal({ title: 'Message de paiement', body: `<textarea class="input" rows="5" readonly>${esc(txt)}</textarea>`, foot: '<button class="btn" data-close>Fermer</button>' }); done(); });
};
ACTIONS.dunQ = el => { UI.dunQ = el.value; render(); };
function dunPatch(c, patch, label) {
  const d = { ...dunOf(c), ...patch };
  if (label) d.history = [...(dunOf(c).history || []), { at: Date.now(), by: ME.id, label }];
  return [['clients', c.id, 'dunning'], d];
}
ACTIONS.dunSet = el => {
  const c = S.clients[el.dataset.id]; const k = el.dataset.k; const v = el.value;
  const label = k === 'status' ? 'Statut : ' + DUN_STATUS[v].label : k === 'ownerId' ? 'Responsable : ' + (v ? fullName(S.users[v]) : 'aucun') : null;
  db.batch([dunPatch(c, { [k]: v || null }, label)]);
  if (k !== 'note') toast('Enregistré');
};
ACTIONS.dunTake = el => { const c = S.clients[el.dataset.id]; db.batch([dunPatch(c, { ownerId: ME.id, status: dunStatus(c) === 'arelancer' ? 'relance' : dunStatus(c) }, 'Prise en charge')]); toast('Dossier ajouté à vos relances'); };
ACTIONS.dunPaid = el => {
  const c = S.clients[el.dataset.id];
  openModal({ title: `Récupéré · ${c.name}`, body: `<form id="dpf" class="grid"><label class="field"><span>Montant encaissé (€)</span><input class="input" type="number" step="0.01" name="amount" value="${Number(c.balance) || ''}"></label>
    <div class="field"><span>Comment ?</span><div class="chips">${[['equipe', 'Encaissé par l’équipe'], ['client', 'Payé en ligne par le client'], ['auto', 'Prélèvement']].map(([k, l], i) => `<label class="chip-radio"><input type="radio" name="canal" value="${k}" ${i === 0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
    <p class="muted small" style="margin:0">Encaissé par l’équipe : le montant s’ajoute aux impayés récupérés de ${esc(fullName(S.users[dunOf(c).ownerId || ME.id]))} (KPI et prime).</p></form>`,
    foot: '<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="dunPaidSave">Valider</button>', onMount: m => { m.dataset.id = c.id; } });
};
ACTIONS.dunPaidSave = () => {
  const c = S.clients[$('.modal').dataset.id]; const f = formData($('#dpf')); const canal = $('#dpf input[name=canal]:checked').value;
  const amount = Math.round(toNum(f.amount) * 100) / 100;
  db.batch(markPaidOps(c, amount, canal, dunOf(c).ownerId || ME.id, 'impayes')); closeModal(); celebrate('Impayé récupéré', `${fmtE(amount)}, ${c.name}`, { kind: 'win' });
};
// Un seul chemin pour « payé » (Impayés, Rétention) : dossier en Récupéré, solde
// a 0, et UNE saisie d'id fixe dn_<client>_<jour> (deux clics = une saisie).
// La saisie porte clientId et clientNum : l'import Incidents la reconnait et ne
// recompte pas le meme paiement.
function markPaidOps(c, amount, canal, by, from) {
  const ops = [[['clients', c.id, 'balance'], 0], dunPatch(c, { status: 'recupere', recoveredAt: today(), amount, canal, by: canal === 'equipe' ? by : null }, `Récupéré (${fmtE(amount)})`)];
  if (canal === 'equipe' && amount > 0) { const id = 'dn_' + c.id + '_' + today(); ops.push([['entries', id], { id, userId: by, clubId: c.clubId || CLUB.id, kpiId: 'impayes', date: today(), value: amount, source: 'manual', at: Date.now(), by: ME.id, from, clientId: c.id, clientNum: c.num || '', ...(from === 'retention' ? { needsCheck: true } : {}) }]); }
  return ops;
}
ACTIONS.dunNew = () => openModal({ title: 'Ajouter un impayé', body: `<form id="dnf" class="form-grid"><label class="field full"><span>Client (prénom et nom)</span><input class="input" name="name" required></label><label class="field"><span>N° client Resamania</span><input class="input" name="num"></label><label class="field"><span>Montant dû (€)</span><input class="input" type="number" step="0.01" name="amount" required></label><label class="field full"><span>Téléphone</span><input class="input" name="phone"></label></form>`,
  foot: '<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="dunCreate">Ajouter</button>' });
ACTIONS.dunCreate = () => {
  const f = formData($('#dnf')); if (!f.name.trim() || !toNum(f.amount)) { toast('Nom et montant obligatoires.'); return; }
  const existing = f.num && Object.values(S.clients).find(c => c.clubId === CLUB.id && c.num === f.num.trim());
  const id = existing ? existing.id : newId();
  db.set(['clients', id], { ...(existing || { id, clubId: CLUB.id }), name: f.name.trim(), num: f.num.trim() || (existing || {}).num || '', phone: f.phone || (existing || {}).phone || '', balance: toNum(f.amount), balanceAt: today(), dunning: { status: 'arelancer', history: [{ at: Date.now(), by: ME.id, label: 'Ajouté à la main' }] } });
  closeModal(); toast('Impayé ajouté');
};
ACTIONS.dunExport = () => {
  const rows = dunRows(CLUB.id);
  const csv = ['Client;N° client;Téléphone;Montant;Depuis;Statut;Responsable;Prochaine relance;Note;Récupéré le;Canal', ...rows.map(c => { const d = dunOf(c); const st = dunStatus(c);
    return [c.name, c.num || '', c.phone || '', String(st === 'recupere' ? d.amount || 0 : c.balance).replace('.', ','), c.balanceAt ? dmy(c.balanceAt) : '', st ? DUN_STATUS[st].label : '', d.ownerId ? fullName(S.users[d.ownerId]) : '', d.next ? dmy(d.next) : '', d.note || '', d.recoveredAt ? dmy(d.recoveredAt) : '', d.canal && RECOV_CHANNELS[d.canal] ? RECOV_CHANNELS[d.canal].label : '']; })];
  downloadFile(`impayes-${norm(CLUB.name).replace(/ /g, '-')}-${today()}-CONFIDENTIEL.csv`, toCsv(csv[0].split(';'), csv.slice(1)), 'text/csv;charset=utf-8');
  db.set(['audit', newId()], { at: Date.now(), by: ME.id, action: 'export_csv', club: CLUB.id, type: 'impayes', lignes: rows.length });
};
