/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — fiche client : qui est-ce, ce qui a été dit, par qui ═══════
PAGES.client = {
  title: 'Fiche client',
  render(args) {
    const c = S.clients[(args || [])[0]];
    if (!c || c.clubId !== CLUB.id) return `<div class="card">${emptyBox({ art: 'done', title: 'Fiche introuvable', text: 'Ce client n’existe pas dans ce club.', cta: '<a class="btn sm" href="#/relances">Retour aux relances</a>' })}</div>`;
    const p = clientPhone(c); const L = contactLinks({ client: c, clientId: c.id }, '');
    const rels = relancesFor(CLUB.id).filter(rl => rl.clientId === c.id);
    const since = c.start ? Math.max(0, Math.round((dateOf(today()) - dateOf(c.start)) / (30.44 * 86400000))) : null;
    const f = UI.cliF || 'all';
    const tl = clientTimeline(c).filter(x => f === 'all' || x.type === f);
    const owner = rels.find(rl => rl.ownerId);
    return `<div class="page-head"><div><h1>${esc(c.name || 'Client')}</h1><p>${c.num ? 'N° ' + esc(c.num) + ' · ' : ''}${c.offer ? esc(c.offer) + ' · ' : ''}${since != null ? 'adhérent depuis ' + plur(since, 'mois', 'mois') : ''}${c.end ? ' · fin le ' + dmy(c.end) : ''}</p></div></div>
      <div class="card cli-head">
        <div class="row wrap" style="gap:6px">${Number(c.balance) > 0 ? `<span class="tag is-bad">${fmtE(Number(c.balance))} dus</span>` : ''}${c.noMandate ? '<span class="tag is-warn">Sans mandat</span>' : ''}${c.optOutSms ? '<span class="tag">Opposé aux SMS</span>' : ''}${c.optOutCall ? '<span class="tag">Opposé aux appels</span>' : ''}${owner ? `<span class="tag is-info">Responsable : ${esc((S.users[owner.ownerId] || {}).first || '')}</span>` : ''}</div>
        <div class="row wrap" style="gap:8px;margin-top:12px">${p && !c.optOutCall ? `<a class="btn primary" href="${esc(L.tel)}">${ico('phone')} ${esc(phoneFmt(p))}</a>` : '<span class="muted">Pas de numéro</span>'}${c.email ? `<a class="btn" href="${esc(L.mail)}">${ico('mail')} E-mail</a>` : ''}<button class="btn" data-act="cliEdit" data-id="${c.id}">${ico('edit')} Coordonnées</button><button class="btn ghost" data-act="cliExport" data-id="${c.id}">${ico('download')} Exporter</button>${isManager() ? `<button class="btn ghost danger" data-act="cliErase" data-id="${c.id}">${ico('trash')} Effacer cet adhérent</button>` : ''}</div>
      </div>
      ${rels.length ? `<div class="card"><h3>Relances ouvertes</h3>${rels.map(rl => `<div class="row wrap rel-mini"><span class="tag is-warn">${REL_KINDS[rl.kind].label}</span><span class="spacer small">${esc(rl.reason)}${rl.nextAt ? ' · prochaine action ' + dmy(isoOf(new Date(rl.nextAt))) : ''}</span><button class="btn sm" data-act="relNote" data-key="${rl.key}">Noter</button></div>`).join('')}</div>` : ''}
      <div class="card"><div class="card-head"><h3>Historique</h3><span class="spacer"></span>${seg('cliF', [['all', 'Tout'], ['appel', 'Appels'], ['message', 'Messages'], ['paiement', 'Paiements'], ['resiliation', 'Résiliation']], f)}</div>
        <form id="cnf" class="row" style="gap:8px;margin-bottom:10px"><input class="input" name="note" maxlength="280" placeholder="Ajouter une note"><button class="btn primary sm" type="submit">Ajouter</button></form>
        ${tl.length ? tl.map(x => `<div class="tl-row"><span class="tl-ico">${ico(x.icon)}</span><div class="spacer"><b>${esc(x.label)}</b>${x.note ? `<div class="small">${esc(x.note)}</div>` : ''}<div class="muted small">${dmy(isoOf(new Date(x.at)))} ${new Date(x.at).toTimeString().slice(0, 5)}${x.by && S.users[x.by] ? ' · ' + esc(fullName(S.users[x.by])) : ''}</div></div></div>`).join('') : '<p class="muted">Aucun échange enregistré.</p>'}
      </div>`;
  },
  mount(args) { const fm = $('#cnf'); if (fm) fm.addEventListener('submit', e => { e.preventDefault(); const t = formData(fm).note.trim(); if (!t) return; const id = newId(); db.set(['touches', id], { id, clubId: CLUB.id, clientId: args[0], at: Date.now(), by: ME.id, channel: 'note', outcome: 'ok', note: t.slice(0, 280) }); }); },
};
function clientTimeline(c) {
  const out = [];
  Object.values(S.touches || {}).filter(x => x.clientId === c.id).forEach(x => out.push({ at: x.at, by: x.by, type: x.channel === 'call' ? 'appel' : x.channel === 'note' ? 'all' : 'message', icon: x.channel === 'call' ? 'phone' : x.channel === 'note' ? 'edit' : 'chat', label: x.channel === 'note' ? 'Note' : `${{ call: 'Appel', sms: 'SMS', whatsapp: 'WhatsApp', email: 'E-mail', visite: 'Visite' }[x.channel] || ''} : ${(TOUCH_OUTCOMES[x.outcome] || {}).label || ''}`, note: x.note || x.text || '' }));
  Object.values(S.loyalty || {}).filter(x => x.clientId === c.id).forEach(x => out.push({ at: x.at, by: x.userId, type: 'appel', icon: 'phone', label: `${(LOYALTY_TYPES[x.type] || {}).label || { upsell: 'Montée en gamme', reactivation: 'Réactivation' }[x.type] || 'Relance'} : ${(OUTCOMES[x.outcome] || {}).label || REV_OUT[x.outcome] || x.outcome}`, note: x.note }));
  ((c.dunning || {}).history || []).forEach(h => out.push({ at: h.at, by: h.by, type: 'paiement', icon: 'coins', label: h.label }));
  Object.values(S.recov || {}).filter(x => x.clubId === c.clubId && c.num && String(x.clientNum) === String(c.num) && x.canal !== 'annule').forEach(x => out.push({ at: dateOf(x.date).getTime() + 12 * 3600000, type: 'paiement', icon: 'coins', label: `Régularisation ${fmtE(x.amount)} · ${(RECOV_CHANNELS[x.canal] || {}).label || x.canal}` }));
  resList(c.clubId).filter(r => r.clientId === c.id || tokensKey(r.client || '') === tokensKey(c.name || '')).forEach(r => resActions(r).forEach(a => out.push({ at: a.at, by: a.by, type: 'resiliation', icon: 'door', label: `Résiliation : ${a.label}`, note: a.note })));
  // Avant l'inscription : appels du prospect ou de l'invité devenu ce client, et parrainages.
  if (typeof prospectsOf === 'function') {
    prospectsOf(c.clubId).filter(p => { const v = prospectConv(p); return v && v.client.id === c.id; }).forEach(p => { out.push({ at: dateOf(p.creeLe).getTime() + 9 * 3600000, type: 'all', icon: 'magnet', label: `Prospect créé${p.provenance ? ' (' + p.provenance + ')' : ''}` }); Object.values(S.touches || {}).filter(t => t.prospectId === p.id).forEach(t => out.push({ at: t.at, by: t.by, type: t.channel === 'call' ? 'appel' : 'message', icon: 'phone', label: `Prospect : ${(TOUCH_OUTCOMES[t.outcome] || {}).label || t.outcome || 'contact'}`, note: t.note || '' })); });
    guestsOf(c.clubId).filter(g => { const v = guestConv(g); return v && v.id === c.id; }).forEach(g => { out.push({ at: dateOf(g.date).getTime() + 12 * 3600000, by: g.by, type: 'all', icon: 'ticket', label: `Séance découverte${g.parrainId && S.clients[g.parrainId] ? ', invité par ' + S.clients[g.parrainId].name : ''}` }); Object.values(S.touches || {}).filter(t => t.guestId === g.id).forEach(t => out.push({ at: t.at, by: t.by, type: 'appel', icon: 'phone', label: `Invité : ${(TOUCH_OUTCOMES[t.outcome] || {}).label || t.outcome || 'contact'}`, note: t.note || '' })); });
    guestsOf(c.clubId).filter(g => g.parrainId === c.id).forEach(g => { const v = guestConv(g); out.push({ at: dateOf(g.date).getTime() + 12 * 3600000, type: 'all', icon: 'users', label: v ? `A parrainé ${v.name}, inscrit le ${dm(v.start)}` : `A invité ${g.nom}` }); });
  }
  return out.filter(x => x.at).sort((a, b) => b.at - a.at);
}
ACTIONS.cliEdit = el => {
  const c = S.clients[el.dataset.id];
  openModal({ title: `Coordonnées · ${c.name}`, body: `<form id="cef" class="form-grid"><label class="field"><span>Téléphone</span><input class="input" name="phone" type="tel" value="${esc(phoneFmt(phoneE164(c.phone)) || c.phone || '')}"></label><label class="field"><span>Téléphone 2</span><input class="input" name="phone2" type="tel" value="${esc(c.phone2 || '')}"></label><label class="field full"><span>E-mail</span><input class="input" name="email" type="email" value="${esc(c.email || '')}"></label>
    <label class="row small full"><input type="checkbox" name="optOutSms" ${c.optOutSms ? 'checked' : ''}> Opposé aux SMS et WhatsApp</label><label class="row small full"><input type="checkbox" name="optOutCall" ${c.optOutCall ? 'checked' : ''}> Opposé aux appels</label></form>`,
    foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="cliSave" data-id="${c.id}">Enregistrer</button>` });
};
ACTIONS.cliSave = el => {
  const c = S.clients[el.dataset.id]; const f = formData($('#cef'));
  const ph = f.phone ? phoneE164(f.phone) : null; if (f.phone && !ph) { toast('Téléphone invalide.'); return; }
  if ((f.email || '').trim() && !/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(f.email.trim())) { toast('E-mail invalide.'); return; }
  const P = k => ['clients', c.id, k]; const id = newId();
  db.batch([[P('phone'), ph], [P('phoneSrc'), 'manual'], [P('phoneBad'), null], [P('phone2'), phoneE164(f.phone2) || null], [P('email'), (f.email || '').trim() || null], [P('optOutSms'), !!f.optOutSms], [P('optOutCall'), !!f.optOutCall],
    [['touches', id], { id, clubId: c.clubId, clientId: c.id, at: Date.now(), by: ME.id, channel: 'note', outcome: 'ok', note: 'Coordonnées modifiées' }]]);
  closeModal(); toast('1 fiche enregistrée');
};
// Droit d'accès : tout ce que le club détient sur ce client, en CSV.
ACTIONS.cliExport = el => {
  const c = S.clients[el.dataset.id];
  const rows = clientTimeline(c).map(x => [dmy(isoOf(new Date(x.at))), x.by && S.users[x.by] ? fullName(S.users[x.by]) : '', x.label, x.note || '']);
  downloadFile(`fitpulse-client-${norm(c.name || 'client').replace(/ /g, '-')}-CONFIDENTIEL.csv`, toCsv(['Date', 'Par', 'Événement', 'Note'], [['Fiche', '', `${c.name || ''} · ${c.num || ''} · ${c.phone || ''} · ${c.email || ''}`, ''], ...rows]), 'text/csv;charset=utf-8');
  db.set(['audit', newId()], { at: Date.now(), by: ME.id, action: 'export_csv', club: CLUB.id, type: 'client', lignes: rows.length });
};
