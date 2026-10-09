/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — rétention : valeur protégée et session d'appels ══════════
// Chaque action de rétention garde la valeur en jeu de sa tâche au moment de
// l'appel (valueAtStake, calc.js) : la « Valeur protégée ce mois » est la somme
// exacte des tâches marquées Joint OK ou RDV, sans recalcul a posteriori.

const LOY_WIN = ['ok', 'rdv'];
// Une action de rétention (S.loyalty) : étape J+15 / J+30, valeur, prochaine action datée.
function loyActRecord({ id, clientId, type, step, outcome, note = '', value, next = null }) {
  const c = S.clients[clientId]; const st = Number(step) || null;
  const v = value != null && value !== '' ? Number(value) : valueAtStake({ type, client: c, amount: c && c.balance });
  return { id, clubId: c ? c.clubId : CLUB.id, clientId, type, ...(st ? { step: st } : {}), outcome, userId: ME.id, note, at: Date.now(), value: Math.round((Number(v) || 0) * 100) / 100, ...(next ? { next } : {}) };
}
// Valeur protégée : tâches réussies du mois (une par client et par tâche, la dernière issue fait foi).
function loyProtected(clubId, mk) {
  const from = dateOf(mk + '-01').getTime(), to = dateOf(addMonths(mk, 1) + '-01').getTime();
  const last = {};
  Object.values(S.loyalty || {}).forEach(a => {
    if (!a || a.at < from || a.at >= to || a.outcome === 'reopen') return; const c = S.clients[a.clientId]; if (!c || c.clubId !== clubId) return;
    const k = `${a.clientId}|${a.type}|${a.step || ''}`; if (!last[k] || last[k].at < a.at) last[k] = a;
  });
  const wins = Object.values(last).filter(a => LOY_WIN.includes(a.outcome));
  const val = a => a.value != null ? Number(a.value) : valueAtStake({ type: a.type, client: S.clients[a.clientId] });
  return { n: wins.length, total: Math.round(wins.reduce((s, a) => s + val(a), 0) * 100) / 100, wins };
}

// ── Session d'appels : les tâches une par une, plus forte valeur d'abord ──
const SESSION_OUT = [['ok', 'Joint OK', 0], ['rdv', 'RDV', 3], ['noanswer', 'Pas de réponse', 1], ['message', 'Message', 2], ['lost', 'Refus', 0]];
function loySessionQueue() {
  return loyaltyTasks(CLUB.id).filter(t => t.state === 'todo' && !t.nextDate && !(UI.loyS && UI.loyS.done.includes(t.key))).sort((a, b) => b.valeurEnJeu - a.valeurEnJeu);
}
function loySessionBody() {
  const q = loySessionQueue(); const s = UI.loyS;
  if (!q.length) return `<div class="loy-sess-end"><h3>Session terminée</h3><p>${plur(s.done.length, 'appel noté', 'appels notés')} · ${fmtE(s.won)} protégés pendant la session.</p></div>`;
  const t = q[0]; const ty = LOYALTY_TYPES[t.type]; const tel = t.client.phone ? String(t.client.phone).replace(/[^\d+]/g, '') : '';
  return `<div class="loy-sess" data-key="${esc(t.key)}"><div class="muted small">${plur(q.length, 'appel restant', 'appels restants')} · ${fmtE(s.won)} protégés</div>
    <h2 style="margin:6px 0">${esc(t.client.name)}</h2>
    <div class="row wrap" style="gap:6px"><span class="badge">${esc(ty.label)}${t.step ? ' J+' + t.step : ''}</span><span class="badge ok">${fmtE(t.valeurEnJeu)} en jeu</span>${t.client.offer ? `<span class="badge">${esc(t.client.offer)}</span>` : ''}</div>
    <p class="small">${t.type === 'impaye' ? `${fmtE(t.amount)} dus` : t.client.end ? `fin d’engagement le ${dmy(t.client.end)}` : esc(ty.hint)}</p>
    ${tel ? `<a class="btn primary" href="tel:${esc(tel)}">${ico('phone')} Appeler ${esc(t.client.phone)}</a>` : '<p class="muted small">Pas de téléphone en fiche.</p>'}
    <label class="field" style="margin-top:12px"><span>Prochaine action le</span><input class="input" type="date" id="loy-next" value="${addDays(today(), 2)}"></label>
    <div class="loy-sess-out">${SESSION_OUT.map(([k, l]) => `<button class="btn ${LOY_WIN.includes(k) ? 'ok-btn' : ''}" data-act="loySessOut" data-o="${k}">${l}</button>`).join('')}</div>
    <button class="btn ghost sm" data-act="loySessSkip" style="margin-top:8px">Passer</button></div>`;
}
const loySessionRedraw = () => { const b = $('#loy-sess-body'); if (b) b.innerHTML = loySessionBody(); };
ACTIONS.loySession = () => { UI.loyS = { done: [], won: 0 }; openModal({ title: 'Mes appels', body: `<div id="loy-sess-body">${loySessionBody()}</div>`, foot: '<button class="btn" data-close>Terminer</button>' }); };
ACTIONS.loySessSkip = () => { const k = $('.loy-sess') && $('.loy-sess').dataset.key; if (k) UI.loyS.done.push(k); loySessionRedraw(); };
ACTIONS.loySessOut = el => {
  const t = loySessionQueue()[0]; if (!t) return; const o = el.dataset.o;
  const nx = $('#loy-next') && $('#loy-next').value;
  // Joint OK et Refus closent la tâche ; RDV, Pas de réponse et Message gardent une prochaine action datée.
  const next = o === 'ok' || o === 'lost' ? null : (nx && nx > today() ? nx : addDays(today(), SESSION_OUT.find(x => x[0] === o)[2] || 1));
  const id = newId(); const ops = [[['loyalty', id], loyActRecord({ id, clientId: t.client.id, type: t.type, step: t.step, outcome: o, value: t.valeurEnJeu, next })]];
  if (o === 'ok' && t.type === 'renouvellement') ops.push([['clients', t.client.id, 'renewedAt'], today()]);
  UI.loyS.done.push(t.key); if (LOY_WIN.includes(o)) UI.loyS.won += t.valeurEnJeu;
  db.batch(ops); loySessionRedraw();
};
