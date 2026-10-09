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
ACTIONS.ctlClientOk = el => { const c = saisieClientTrouve(formData($('#ctf')).impClient); if (!c) { toast('Choisissez le client dans la liste.'); return; } db.batch([[['entries', el.dataset.id, 'clientId'], c.id], [['entries', el.dataset.id, 'clientNum'], c.num || '']]); closeModal(); toast(`Saisie rattachée à ${c.name}`); };
