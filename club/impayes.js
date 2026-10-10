/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — impayés : contrôles des saisies, acomptes, historique ══════
// Membres > Contrôles : saisies « impayés récupérés » du mois sans client, ou
// rapprochées d'une régularisation importée, à fusionner.

function ctlImpayes(clubId, mk) {
  const from = mk + '-01', to = `${mk}-${daysIn(mk)}`;
  const E = Object.values(S.entries).filter(e => e && e.clubId === clubId && e.kpiId === 'impayes' && e.date >= from && e.date <= to && entryCounts(e));
  const imp = E.filter(isImported);
  const sansClient = E.filter(e => !isImported(e) && !e.clientId).map(e => ({ e, cand: imp.filter(i => Math.abs(Number(i.value) - Number(e.value)) <= 0.01 && i.date >= addDays(e.date, -7) && i.date <= addDays(e.date, 7)) }));
  const rapprochees = E.filter(e => !isImported(e) && e.matchedKey && !e.matchedOk);
  return { sansClient, rapprochees };
}
function memControles() {
  const mk = UI.ctlMonth || curMonth(); const K = ctlImpayes(CLUB.id, mk);
  const ligne = (e, act) => `<tr data-ctl="${e.id}"><td>${dm(e.date)}</td><td>${esc(fullName(S.users[e.userId]) || 'n.d.')}</td><td class="num"><b>${fmtE(Number(e.value))}</b></td><td>${e.clientId && S.clients[e.clientId] ? esc(S.clients[e.clientId].name) : '<span class="muted">sans client</span>'}</td><td class="nowrap">${act}</td></tr>`;
  const tete = '<thead><tr><th>Date</th><th>Commercial</th><th class="num">Montant</th><th>Client</th><th></th></tr></thead>';
  return `<div class="row wrap" style="margin-bottom:12px">${monthNav('ctlMonth', mk)}<span class="spacer"></span><span class="muted small">Un euro récupéré se saisit depuis un dossier client : ces lignes viennent d’anciennes saisies ou d’un import.</span></div>
    <div class="card" style="margin-bottom:14px"><h3>Saisies sans client (${K.sansClient.length})</h3>${K.sansClient.length ? `<div class="table-wrap"><table class="t">${tete}<tbody>${K.sansClient.map(({ e, cand }) => ligne(e, `${cand.length ? `<button class="btn sm primary" data-act="ctlFusion" data-id="${e.id}" data-imp="${cand[0].id}">Fusionner avec l’import du ${dm(cand[0].date)}</button> ` : ''}<button class="btn sm" data-act="ctlClient" data-id="${e.id}">Rattacher un client</button>`)).join('')}</tbody></table></div>` : '<p class="muted small">Toutes les saisies du mois portent un client.</p>'}</div>
    <div class="card"><h3>Saisies rapprochées d’un import (${K.rapprochees.length})</h3><p class="muted small">L’import Incidents a reconnu ces encaissements (même client, même montant à 7 jours près) : ils ne sont comptés qu’une fois.</p>${K.rapprochees.length ? `<div class="table-wrap"><table class="t">${tete}<tbody>${K.rapprochees.map(e => ligne(e, `<button class="btn sm" data-act="ctlOk" data-id="${e.id}">Fusionner</button>`)).join('')}</tbody></table></div>` : '<p class="muted small">Aucun rapprochement à confirmer.</p>'}</div>`;
}
// Fusion : la saisie manuelle s'efface derrière la ligne importée (Resamania fait foi), tracée dans l'audit.
ACTIONS.ctlFusion = el => { const e = S.entries[el.dataset.id]; if (!e) return; db.batch([[['entries', e.id, 'suppressed'], true], [['entries', e.id, 'mergedInto'], el.dataset.imp], [['audit', newId()], { at: Date.now(), by: ME.id, action: 'fusion_saisie', club: CLUB.id, entry: e.id, into: el.dataset.imp }]]); toast(`1 saisie de ${fmtE(Number(e.value))} fusionnée avec l’import`); };
ACTIONS.ctlOk = el => { const e = S.entries[el.dataset.id]; if (!e) return; db.batch([[['entries', e.id, 'matchedOk'], Date.now()], [['entries', e.id, 'matchedBy'], ME.id]]); toast(`1 rapprochement de ${fmtE(Number(e.value))} confirmé`); };
ACTIONS.ctlClient = el => {
  const e = S.entries[el.dataset.id];
  openModal({ title: `Rattacher · ${fmtE(Number(e.value))} du ${dm(e.date)}`, body: `<form id="ctf">${saisieClientImpaye()}</form>`, foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="ctlClientOk" data-id="${e.id}">Rattacher</button>` });
};
ACTIONS.ctlClientOk = el => { const c = saisieClientTrouve(formData($('#ctf')).impClient); if (!c) { fx.error('Choisissez le client dans la liste.'); return; } db.batch([[['entries', el.dataset.id, 'clientId'], c.id], [['entries', el.dataset.id, 'clientNum'], c.num || '']]); closeModal(); toast(`Saisie rattachée à ${c.name}`); };

// ── Feuille de résultat d'un impayé (Impayés, Rétention, Relances, accueil) ──
// Issues : Payé, Acompte, Promesse, Pas de réponse, Message laissé, Refus. Chacune écrit une ligne
// dans dunning.history { at, by, outcome, note } et met à jour dunning.status et dunning.next.
// « Joint, OK » et « RDV pris » n'existent pas pour un impayé : seuls Payé, Acompte ou la disparition
// du solde à l'import ferment le dossier.
const DUN_OUTCOMES = {
  paye: { label: 'Payé' }, acompte: { label: 'Acompte' }, promesse: { label: 'Promesse' },
  pasreponse: { label: 'Pas de réponse', tentative: true }, message: { label: 'Message laissé', tentative: true }, refus: { label: 'Refus' },
  // anciennes issues (Rétention, Relances) migrées dans l'historique
  joint: { label: 'Joint' }, envoye: { label: 'Message envoyé' },
};
const DUN_OUT_ORDRE = ['paye', 'acompte', 'promesse', 'pasreponse', 'message'];
const dunHist = c => (dunOf(c).history || []).filter(Boolean);
// Tentatives comptées : un essai sans contact compte s'il a lieu un autre jour ou 4 h après le précédent compté.
const QUATRE_H = 4 * 3600000;
function tentativesComptees(liste) {
  const L = liste.filter(x => x && x.at).sort((a, b) => a.at - b.at); const out = [];
  for (const x of L) { const p = out[out.length - 1]; if (!p || x.at - p.at >= QUATRE_H || isoOf(new Date(x.at)) !== isoOf(new Date(p.at))) out.push(x); }
  return out;
}
const dunTentatives = c => tentativesComptees(dunHist(c).filter(h => (DUN_OUTCOMES[h.outcome] || {}).tentative));
// Dernière tentative trop récente (moins de 4 h, même jour) : le bouton affiche « Déjà tenté à 10 h 12 ».
function tentativeRecente(liste, maintenant = Date.now()) {
  const der = liste.filter(x => x && x.at).sort((a, b) => b.at - a.at)[0];
  return der && maintenant - der.at < QUATRE_H && isoOf(new Date(der.at)) === isoOf(new Date(maintenant)) ? der : null;
}
const dejaTente = x => `Déjà tenté à ${timeOf(x.at).replace(':', ' h ')}`;
// Relance (file d'appels) d'un dossier impayé : même clé que relancesFor.
const dunRelKey = c => relKey('impaye', c.id, c.balanceAt || 'x');
const dunRel = c => ({ key: dunRelKey(c), kind: 'impaye', clubId: c.clubId, clientId: c.id });
const dunScript = c => fillTemplate((tplFor('impaye', 'script') || []).filter(Boolean).join(' '), { prenom: String(c.name || '').split(' ')[0], club: nomAffiche(), commercial: ME.first || '', montant: fmtE(Number(c.balance)) }).text;

function dunSheet(clientId) {
  const c = S.clients[clientId]; if (!c) return;
  const rec = tentativeRecente(dunHist(c).filter(h => (DUN_OUTCOMES[h.outcome] || {}).tentative)); const n = dunTentatives(c).length;
  openModal({ title: `${c.name || 'Client'} · ${fmtE(Number(c.balance))}`, drawer: true, body: `<div class="dsheet" data-id="${c.id}">
    <div class="small muted">${incidentDepuis(c) != null ? `En incident depuis ${incidentDepuis(c)} j · ` : ''}relance n° ${n + 1}${dunOf(c).ownerId ? ' · ' + esc(fullName(S.users[dunOf(c).ownerId])) : ''}</div>
    <details class="dsheet-script"><summary>${esc(dunScript(c))}</summary><p>${esc(dunScript(c))}</p></details>
    <div class="dsheet-outs">${DUN_OUT_ORDRE.map(o => { const off = rec && DUN_OUTCOMES[o].tentative; return `<button class="btn dsheet-out ${o === 'paye' ? 'primary' : ''}" data-act="dunOut" data-o="${o}" data-id="${c.id}" ${off ? 'disabled' : ''}>${off ? dejaTente(rec) : DUN_OUTCOMES[o].label}</button>`; }).join('')}</div>
    <div id="dsheet-suite"></div>
    <div class="row" style="justify-content:space-between;margin-top:6px"><button class="btn ghost sm" data-act="dunOut" data-o="refus" data-id="${c.id}">Refus</button><button class="btn ghost sm" data-act="dunHistOpen" data-id="${c.id}">Historique</button></div></div>` });
}
ACTIONS.dunSheet = el => dunSheet(el.dataset.id);
// Prochaine relance : cadence des impayés (CADENCES.impaye), 4 h au moins entre deux appels.
function dunProchaine(c, tentatives) { const at = nextStepAt(dunRel(c), tentatives); return at ? { at, iso: isoOf(new Date(at)) } : null; }
function dunIssueOps(c, o, extra = {}) {
  const d = dunOf(c); const owner = d.ownerId || ME.id; const note = (extra.note || '').trim().slice(0, 280);
  const T = DUN_OUTCOMES[o]; let patch = { ownerId: owner }; let label = T.label; let nextAt = null;
  if (T.tentative) {
    const compte = !tentativeRecente(dunHist(c).filter(h => (DUN_OUTCOMES[h.outcome] || {}).tentative));
    const n = dunTentatives(c).length + (compte ? 1 : 0); const nx = dunProchaine(c, n);
    patch = { ...patch, status: 'relance', next: nx ? nx.iso : null }; nextAt = nx ? nx.at : null;
  } else if (o === 'promesse') {
    patch = { ...patch, status: 'promesse', promiseBase: Number(c.balance) || 0, promiseAmount: extra.amount || Number(c.balance) || 0, promiseDate: extra.date, next: addDays(extra.date, 1) };
    label = `Promesse : ${fmtE(patch.promiseAmount)} le ${dm(extra.date)}`; nextAt = dateOf(addDays(extra.date, 1)).getTime() + 10 * 3600000;
  } else if (o === 'refus') { patch = { ...patch, status: 'relance', next: addDays(today(), 7) }; nextAt = dateOf(addDays(today(), 7)).getTime() + 10 * 3600000; }
  const rk = dunRelKey(c);
  return [dunPatch(c, patch, label + (note ? ' : ' + note : ''), { outcome: o, ...(note ? { note } : {}), tplId: tplIdFor('impaye') }),
    [['relances', rk, 'nextAt'], nextAt], [['relances', rk, 'kind'], 'impaye'], [['relances', rk, 'clubId'], c.clubId], [['relances', rk, 'status'], 'attente'], [['relances', rk, 'ownerId'], owner]];
}
// Après une issue : la feuille se ferme, la carte suivante de la file apparaît.
function dunApres(c, msg) { closeModal(); toast(msg); render(); }
ACTIONS.dunOut = el => {
  const c = S.clients[el.dataset.id]; const o = el.dataset.o; const box = $('#dsheet-suite'); const solde = Number(c.balance) || 0;
  if (o === 'paye') { box.innerHTML = `<div class="dsheet-step"><label class="field"><span>Montant encaissé (€)</span><input class="input" id="dpay" inputmode="decimal" value="${String(solde).replace('.', ',')}"></label><button class="btn primary dsheet-ok" data-act="dunPayOk" data-id="${c.id}">Valider</button></div>`; return; }
  if (o === 'acompte') { box.innerHTML = `<div class="dsheet-step"><div class="pad-display" id="pad-v">0 €</div><div class="pad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'effacer'].map(x => `<button type="button" data-act="dunPad" data-p="${x}">${x === 'effacer' ? '⌫' : x}</button>`).join('')}</div><button class="btn primary dsheet-ok" data-act="dunAcompteOk" data-id="${c.id}">Valider l’acompte</button></div>`; UI.dunPad = ''; return; }
  if (o === 'promesse') {
    const t = today(); const dow = dateOf(t).getDay(); const ven = addDays(t, ((5 - dow + 7) % 7) || 7); const le5 = t.slice(8) < '05' ? t.slice(0, 8) + '05' : addMonths(t.slice(0, 7), 1) + '-05';
    box.innerHTML = `<div class="dsheet-step"><div class="chips dsheet-chips">${[['Demain', addDays(t, 1)], ['Vendredi', ven], ['Le 5 du mois', le5]].map(([l, d]) => `<button type="button" class="btn" data-act="dunPromOk" data-id="${c.id}" data-d="${d}">${l}</button>`).join('')}<label class="btn"><span>Autre date</span><input type="date" min="${addDays(t, 1)}" data-change="dunPromDate" data-id="${c.id}" style="margin-left:6px"></label></div></div>`; return;
  }
  if (o === 'refus') { db.batch(dunIssueOps(c, 'refus')); dunApres(c, `Refus noté : ${c.name}, relance dans 7 jours`); return; }
  // Pas de réponse, Message laissé : notés tout de suite, puis le SMS prêt à partir.
  db.batch(dunIssueOps(c, o));
  const tel = clientPhone(c); const txt = fillTemplate(tplFor('impaye', 'sms'), { prenom: String(c.name || '').split(' ')[0], club: nomAffiche(), commercial: ME.first || '', montant: fmtE(solde) }).text;
  box.innerHTML = `<div class="dsheet-step"><p class="small">${esc(DUN_OUTCOMES[o].label)} noté. Prochaine relance : ${dunOf(S.clients[c.id]).next ? dmy(dunOf(S.clients[c.id]).next) : 'à définir'}.</p>${tel ? `<a class="btn primary dsheet-ok" href="sms:${esc(tel)}?&body=${encodeURIComponent(txt)}" data-sms="1">Envoyer le SMS</a>` : ''}<button class="btn dsheet-ok" data-act="dunSuivant">Dossier suivant</button></div>`;
  $$('.dsheet-out').forEach(b => { b.disabled = true; });
};
ACTIONS.dunPad = el => { const x = el.dataset.p; let v = UI.dunPad || ''; if (x === 'effacer') v = v.slice(0, -1); else if (x === ',') { if (!v.includes(',')) v = (v || '0') + ','; } else if (!/,\d\d$/.test(v)) v += x; UI.dunPad = v; $('#pad-v').textContent = (v || '0') + ' €'; };
ACTIONS.dunPayOk = el => { const c = S.clients[el.dataset.id]; const a = parseMontant($('#dpay').value); if (!(a > 0)) { fx.error('Saisissez le montant encaissé.'); return; } const ops = markPaid(c, a, { author: ME.id, from: 'impayes', tplId: tplIdFor('impaye') }); if (!ops.length) { dunApres(c, `${c.name} : dossier déjà soldé`); return; } db.batch(ops); dunApres(c, Number(S.clients[c.id].balance) > 0 ? `Acompte de ${fmtE(a)} noté, reste ${fmtE(Number(S.clients[c.id].balance))}` : `Impayé récupéré : ${fmtE(a)}, ${c.name}`); if (!(Number(S.clients[c.id].balance) > 0) && typeof celebrate === 'function') celebrate('Impayé récupéré', `${fmtE(a)} : ${c.name}`, { kind: 'perso' }); };
ACTIONS.dunAcompteOk = el => { const c = S.clients[el.dataset.id]; const a = toNum(UI.dunPad || ''); if (!(a > 0)) { fx.error('Saisissez le montant de l’acompte.'); return; } db.batch(markPaid(c, a, { author: ME.id, from: 'impayes', tplId: tplIdFor('impaye') })); dunApres(c, Number(S.clients[c.id].balance) > 0 ? `Acompte de ${fmtE(a)} noté, reste ${fmtE(Number(S.clients[c.id].balance))}` : `Impayé récupéré : ${fmtE(a)}, ${c.name}`); };
ACTIONS.dunPromOk = el => { const c = S.clients[el.dataset.id]; db.batch(dunIssueOps(c, 'promesse', { date: el.dataset.d })); dunApres(c, `Promesse notée pour le ${dmy(el.dataset.d)} : ${c.name}`); };
ACTIONS.dunPromDate = el => { if (el.value) ACTIONS.dunPromOk({ dataset: { id: el.dataset.id, d: el.value } }); };
ACTIONS.dunSuivant = () => { closeModal(); render(); };

// ── Historique du dossier (tiroir, au clic sur le nom) ─────────────────────
ACTIONS.dunHistOpen = el => {
  const c = S.clients[el.dataset.id]; if (!c) return; const H = dunHist(c).slice().reverse();
  openModal({ title: `Historique · ${c.name}`, drawer: true, body: `<p class="muted small" style="margin-top:0">${Number(c.balance) > 0 ? `${fmtE(Number(c.balance))} dus` : 'Dossier soldé'}${incidentDepuis(c) != null ? ` · en incident depuis ${incidentDepuis(c)} j` : ''} · <a href="#/client/${esc(c.id)}">Fiche client</a></p>
    ${H.map(h => `<div class="dhist" data-outcome="${esc(h.outcome || '')}"><b>${esc(h.label || (DUN_OUTCOMES[h.outcome] || {}).label || '')}</b>${h.note && !(h.label || '').includes(h.note) ? `<div class="small">${esc(h.note)}</div>` : ''}<div class="muted small">${esc(fullName(S.users[h.by]) || 'Import')} · ${dmy(isoOf(new Date(h.at)))} ${timeOf(h.at)}</div></div>`).join('') || '<p class="muted">Aucune action sur ce dossier pour l’instant.</p>'}` });
};

// ── Migration unique : anciennes actions Rétention de type impayé vers dunning.history ──
const LOY_VERS_DUN = { noanswer: 'pasreponse', message: 'message', paid: 'paye', lost: 'refus', ok: 'joint', rdv: 'joint', maintien: 'joint' };
function migrerLoyaltyImpayes() {
  const par = {}; Object.values(S.loyalty || {}).filter(a => a && a.type === 'impaye' && a.clientId).forEach(a => { (par[a.clientId] = par[a.clientId] || []).push(a); });
  const ops = [];
  for (const [cid, acts] of Object.entries(par)) {
    const c = S.clients[cid]; if (!c || dunOf(c).migratedLoyalty) continue;
    const vus = new Set(dunHist(c).map(h => h.at + '|' + (h.outcome || '')));
    const ajout = acts.map(a => ({ at: a.at, by: a.userId, outcome: LOY_VERS_DUN[a.outcome] || 'joint', label: (DUN_OUTCOMES[LOY_VERS_DUN[a.outcome] || 'joint'] || {}).label || 'Relance', ...(a.note ? { note: a.note } : {}), migre: true })).filter(h => !vus.has(h.at + '|' + h.outcome));
    ops.push([['clients', cid, 'dunning'], { ...dunOf(c), history: [...dunHist(c), ...ajout].sort((x, y) => x.at - y.at), migratedLoyalty: true }]);
  }
  return ops;
}
// Retour d'appel d'un impayé : retRetour (retention.js) ouvre la feuille du dossier.
