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
  return loyaltyTasks(CLUB.id).filter(t => t.state === 'todo' && t.type !== 'impaye' && !t.nextDate && !(UI.loyS && UI.loyS.done.includes(t.key))).sort((a, b) => b.valeurEnJeu - a.valeurEnJeu);
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

// ══ Page Rétention ═══════════════════════════════════════════════════════
// Aujourd'hui : une colonne de cartes triées par euros en jeu décroissant. À venir : rappels datés et
// échéances plus lointaines. Résultats : ce qui a été obtenu. Clients perdus : après confirmation.
// Euros en jeu = solde dû pour un impayé ; mensualité (S.tarifs[club][offre]) x mois d'engagement restants
// pour une fin de contrat, un suivi ou un anniversaire ; mensualité inconnue = 0 et « tarif à renseigner ».
const tarifCle = offre => safeKey(norm(offre || ''));
function tarifMensuel(c) { const v = Number(deepGet(S, ['tarifs', c.clubId, tarifCle(c.offer), 'mensuel'])); return v > 0 ? v : 0; }
function retEuros(t) {
  if (t.type === 'impaye') return { v: Math.round((Number(t.client.balance) || 0) * 100) / 100, aRenseigner: false };
  const m = tarifMensuel(t.client); const mois = moisRestants(t.client.end) || (t.type === 'renouvellement' ? 1 : 3);
  return { v: Math.round(m * mois * 100) / 100, aRenseigner: !m, mois, m };
}
const RET_JOURS = 7; // au-delà, une échéance passe dans « À venir »
const retEstAujourdhui = (t, now = Date.now()) => t.state === 'todo' && !(t.nextAt && t.nextAt > now) && !(t.nextDate && t.nextDate > today()) && (t.type === 'impaye' || t.type === 'mandat' || !t.due || t.due <= addDays(today(), RET_JOURS) || t.type === 'renouvellement');
function retMotif(t) {
  const c = t.client;
  if (t.type === 'impaye') return `${fmtE(Number(c.balance))} dus${c.incidents ? `, ${plur(c.incidents, 'incident', 'incidents')}` : ''}`;
  if (t.type === 'renouvellement') return `Fin de contrat le ${dmy(t.due)}${c.offer ? ', ' + c.offer : ''}`;
  if (t.type === 'suivi15' || t.type === 'suivi30') return `Inscrit le ${dmy(c.start)}, appel J+${t.step}`;
  if (t.type === 'anniversaire') return `Anniversaire le ${dm(t.due)}`;
  if (t.type === 'mandat') return 'Abonné sans mandat de prélèvement';
  return LOYALTY_TYPES[t.type] ? LOYALTY_TYPES[t.type].hint : '';
}
// Ancienneté : depuis le plus ancien incident ouvert (impayé), sinon depuis l'ouverture de la tâche.
const retAnciennete = t => t.type === 'impaye' ? incidentDepuis(t.client) : Math.max(0, Math.round((dateOf(today()) - dateOf(t.type === 'renouvellement' ? addDays(t.due, -45) : t.since || t.due)) / 864e5));
// « Pas de réponse hier à 18 h, par Léa »
function retDerniere(t) {
  const a = (t.acts || [])[0]; if (!a) return '';
  const lib = t.type === 'impaye' ? (DUN_OUTCOMES[a.outcome] || {}).label : (OUTCOMES[a.outcome] || {}).label; if (!lib) return '';
  const j = isoOf(new Date(a.at)); const jour = j === today() ? 'aujourd’hui' : j === addDays(today(), -1) ? 'hier' : 'le ' + dm(j);
  const d = new Date(a.at); const h = d.getHours() + ' h' + (d.getMinutes() ? ' ' + pad(d.getMinutes()) : '');
  return `${lib} ${jour} à ${h}, par ${(S.users[a.userId] || {}).first || 'un collègue'}`;
}
function retCarte(t) {
  const E = retEuros(t); const ty = LOYALTY_TYPES[t.type] || LOYALTY_TYPES.suivi15; const tel = clientPhone(t.client); const anc = retAnciennete(t); const der = retDerniere(t);
  const k = `${t.client.id}|${t.type}|${t.step || ''}`;
  return `<div class="card ret-card" data-ret="${esc(t.client.id)}" data-type="${t.type}" data-euros="${E.v}">
    <div class="ret-l1"><span class="kpi-ico">${ico(ty.icon)}</span><div class="spacer"><a href="#" data-act="${t.type === 'impaye' ? 'dunHistOpen' : 'retHist'}" data-id="${esc(t.client.id)}" data-t="${t.type}"><b>${esc(t.client.name)}</b></a><div class="muted small ret-motif">${esc(ty.label)} · ${esc(retMotif(t))}</div></div>
      <div class="ret-euros"><b class="num">${fmtE(E.v)}</b><small>${E.aRenseigner ? '<span class="warn">tarif à renseigner</span>' : 'en jeu'}</small></div></div>
    <div class="muted small ret-l2">${anc != null ? `ouvert depuis ${anc} j` : ''}${der ? ` · ${esc(der)}` : ''}${t.failed ? ` · ${plur(t.failed, 'tentative', 'tentatives')}` : ''}</div>
    <div class="ret-actions">${tel ? `<a class="btn primary ret-call" href="tel:${esc(tel)}" data-act="retAppel" data-id="${esc(t.client.id)}" data-t="${t.type}" data-s="${t.step || ''}">${ico('phone')} Appeler</a>` : `<span class="small warn">Numéro manquant</span>`}
      <button class="btn" data-act="${t.type === 'impaye' ? 'dunSheet' : 'retSheet'}" data-id="${esc(t.client.id)}" data-t="${t.type}" data-s="${t.step || ''}">Noter</button>
      ${t.aConfirmer ? `<button class="btn ghost" data-act="loyPerdre" data-c="${esc(t.client.id)}" data-t="${t.type}" data-s="${t.step || ''}" data-k="${esc(k)}">3 tentatives : classer</button>` : ''}</div></div>`;
}
PAGES.loyalty = {
  title: TXT.pages.loyalty,
  render() {
    const tab = ['today', 'avenir', 'resultats', 'perdus'].includes(UI.loyTab) ? UI.loyTab : 'today';
    const tasks = loyaltyTasks(CLUB.id).map(t => ({ ...t, nextAt: t.acts && t.acts[0] && t.acts[0].nextAt || null }));
    const todo = tasks.filter(t => t.state === 'todo'); const now = Date.now();
    const auj = todo.filter(t => retEstAujourdhui(t, now)).sort((a, b) => retEuros(b).v - retEuros(a).v || (a.due || '').localeCompare(b.due || ''));
    const avenir = todo.filter(t => !retEstAujourdhui(t, now)).sort((a, b) => (a.nextAt || dateOf(a.nextDate || a.due || today()).getTime()) - (b.nextAt || dateOf(b.nextDate || b.due || today()).getTime()));
    const perdus = tasks.filter(t => t.state === 'lost');
    const clients = Object.values(S.clients).filter(c => c.clubId === CLUB.id);
    const alertes = [];
    if (!clients.length) alertes.push('Importez Résumé clients pour générer les suivis J+15 et J+30, les fins de contrat et les anniversaires.');
    else {
      if (!clients.some(c => Number(c.balance) > 0) && !Object.values(S.imports).some(i => i.clubId === CLUB.id && /incident|soldes/.test(i.defId || i.type || '') && i.active !== false)) alertes.push('Importez Solde clients pour voir les euros à récupérer.');
      if (!clients.some(c => c.birth)) alertes.push('Aucune date de naissance en base : ajoutez la colonne au prochain import Résumé clients pour programmer les anniversaires.');
      const sansTarif = [...new Set(auj.filter(t => t.type !== 'impaye' && retEuros(t).aRenseigner).map(t => t.client.offer || 'offre sans nom'))];
      if (sansTarif.length && isManager()) alertes.push(`${plur(sansTarif.length, 'offre sans tarif', 'offres sans tarif')} : ${sansTarif.slice(0, 3).join(', ')}. Renseignez la mensualité dans Membres > Réglages pour chiffrer les euros en jeu.`);
    }
    const enJeu = auj.reduce((s, t) => s + retEuros(t).v, 0);
    const prochain = avenir[0]; const prochainJour = prochain ? (prochain.nextAt ? isoOf(new Date(prochain.nextAt)) : prochain.nextDate || prochain.due) : null;
    const memeJour = prochainJour ? avenir.filter(t => (t.nextAt ? isoOf(new Date(t.nextAt)) : t.nextDate || t.due) === prochainJour) : [];
    const resumeType = L => { const n = {}; L.forEach(t => { const l = t.type === 'renouvellement' ? ['fin de contrat', 'fins de contrat'] : t.type === 'impaye' ? ['impayé', 'impayés'] : t.type === 'anniversaire' ? ['anniversaire', 'anniversaires'] : t.type === 'mandat' ? ['mandat', 'mandats'] : ['suivi', 'suivis']; n[l[1]] = n[l[1]] || [l[0], l[1], 0]; n[l[1]][2]++; }); return Object.values(n).map(([u, p, x]) => plur(x, u, p)).join(', '); };
    const vide = prochain ? `Journée à jour. Prochain appel prévu ${prochainJour === addDays(today(), 1) ? 'demain' : 'le ' + dmy(prochainJour)} : ${resumeType(memeJour)}.` : 'Journée à jour. Aucun appel programmé : le prochain import Résumé clients ajoutera les nouveaux inscrits et les fins de contrat.';
    const transferts = isManager() ? Object.values(S.transferts || {}).filter(x => x && x.clubId === CLUB.id && !x.traiteAt).sort((a, b) => b.at - a.at) : [];
    let body;
    if (tab === 'today') body = auj.length ? `<div class="ret-list">${auj.slice(0, UI.loyMax || 60).map(retCarte).join('')}</div>${auj.length > (UI.loyMax || 60) ? `<button class="btn sm" data-act="ui" data-key="loyMax" data-val="${(UI.loyMax || 60) + 60}">Afficher 60 de plus</button>` : ''}` : `<div class="card">${emptyBox({ art: 'done', title: 'Journée à jour', text: vide })}</div>`;
    else if (tab === 'avenir') body = avenir.length ? `<div class="ret-list">${avenir.slice(0, 100).map(t => retCarte(t).replace('<div class="ret-actions">', `<div class="small ret-quand">${t.nextAt ? 'Rappel le ' + dmy(isoOf(new Date(t.nextAt))) + ' à ' + timeOf(t.nextAt).replace(':', ' h ') : t.nextDate ? 'Prochain essai le ' + dmy(t.nextDate) : 'Échéance le ' + dmy(t.due)}</div><div class="ret-actions">`)).join('')}</div>` : `<div class="card">${emptyBox({ art: 'cal', title: 'Rien de programmé', text: 'Les rappels datés et les échéances à plus de 7 jours apparaissent ici dès qu’un appel est noté.' })}</div>`;
    else if (tab === 'resultats') body = typeof resultatsOnglet === 'function' ? resultatsOnglet('retention') : loyPerf();
    else body = loyLost(perdus);
    return `<div class="page-head"><div><h1>${TXT.pages.loyalty}</h1><p>${esc(nomAffiche())} · ${plur(auj.length, 'appel', 'appels')} aujourd’hui pour ${fmtE(enJeu)} en jeu</p></div><span class="spacer"></span><button class="btn" data-act="loyHistory">${ico('history')} Historique</button>${isManager() ? `<button class="btn" data-act="addClient">${ico('plus')} Client</button>` : ''}</div>
      ${alertes.map(x => `<div class="alert" style="margin-bottom:10px">${ico('info')}<div>${esc(x)}</div></div>`).join('')}
      ${transferts.length ? `<div class="card" style="margin-bottom:12px" data-transferts="${transferts.length}"><h3>Transférés au manager (${transferts.length})</h3>${transferts.map(x => `<div class="row wrap rel-mini"><b>${esc((S.clients[x.clientId] || {}).name || '')}</b><span class="spacer small">${esc(x.libelle)} · motif : ${esc(x.motif || 'non précisé')} · par ${esc((S.users[x.by] || {}).first || '')}, ${ago(x.at)}</span><button class="btn sm" data-act="transfertOk" data-id="${x.id}">Traité</button></div>`).join('')}</div>` : ''}
      ${tabs('loyTab', [['today', `Aujourd’hui (${auj.length})`], ['avenir', `À venir (${avenir.length})`], ['resultats', 'Résultats'], ['perdus', `Clients perdus (${perdus.length})`]], tab)}${body}`;
  },
};
ACTIONS.transfertOk = el => { db.batch([[['transferts', el.dataset.id, 'traiteAt'], Date.now()], [['transferts', el.dataset.id, 'traitePar'], ME.id]]); toast('1 transfert traité'); };
ACTIONS.retHist = el => {
  const c = S.clients[el.dataset.id]; const acts = Object.values(S.loyalty || {}).filter(a => a && a.clientId === c.id).sort((a, b) => b.at - a.at);
  openModal({ title: `Historique · ${c.name}`, drawer: true, body: `<p class="muted small" style="margin-top:0"><a href="#/client/${esc(c.id)}">Fiche client</a></p>${acts.map(a => `<div class="dhist"><b>${esc((LOYALTY_TYPES[a.type] || {}).label || a.type)} : ${esc((OUTCOMES[a.outcome] || {}).label || a.outcome)}</b>${a.note ? `<div class="small">${esc(a.note)}</div>` : ''}<div class="muted small">${esc(fullName(S.users[a.userId]))} · ${dmy(isoOf(new Date(a.at)))} ${timeOf(a.at)}</div></div>`).join('') || '<p class="muted">Aucun appel noté pour ce client.</p>'}` });
};

// ── Membres > Réglages : tarifs (mensualité par offre) ─────────────────────
function tarifsCard() {
  const offres = {}; Object.values(S.clients).filter(c => c.clubId === CLUB.id && c.offer).forEach(c => { const k = tarifCle(c.offer); const o = offres[k] = offres[k] || { label: c.offer, n: 0, prix: [] }; o.n++; if (Number(c.price) > 0) o.prix.push(Number(c.price)); });
  const L = Object.entries(offres).sort((a, b) => b[1].n - a[1].n);
  const T = deepGet(S, ['tarifs', CLUB.id]) || {};
  return `<div class="card" id="tarifs"><div class="card-head"><h3>Tarifs</h3><span class="spacer"></span>${L.some(([, o]) => o.prix.length) ? '<button class="btn sm" data-act="tarifsResamania">Reprendre les prix Resamania</button>' : ''}</div>
    <p class="muted small">Une ligne par offre trouvée dans la base clients. La mensualité chiffre les euros en jeu des fins de contrat et des suivis (Rétention) et la valeur des renouvellements.</p>
    ${L.length ? `<form id="tarf"><div class="table-wrap"><table class="t"><thead><tr><th>Offre</th><th class="num">Adhérents</th><th class="num">Mensualité (€)</th></tr></thead><tbody>${L.map(([k, o]) => `<tr><td>${esc(o.label)}</td><td class="num">${o.n}</td><td class="num"><input class="input sm" style="width:100px;text-align:right" name="t_${esc(k)}" inputmode="decimal" value="${T[k] && T[k].mensuel ? String(T[k].mensuel).replace('.', ',') : ''}" placeholder="${o.prix.length ? String(medianOf(o.prix)).replace('.', ',') : 'à renseigner'}"></td></tr>`).join('')}</tbody></table></div>
    <button class="btn primary sm" type="button" data-act="tarifsSave" style="margin-top:8px">Enregistrer les tarifs</button></form>` : '<p class="muted small">Aucune offre en base : importez Résumé clients.</p>'}</div>`;
}
ACTIONS.tarifsSave = () => {
  const f = formData($('#tarf')); const ops = []; const labels = {}; Object.values(S.clients).filter(c => c.clubId === CLUB.id && c.offer).forEach(c => { labels[tarifCle(c.offer)] = c.offer; });
  Object.entries(f).forEach(([n, v]) => { const k = n.slice(2); const x = parseMontant(v); ops.push([['tarifs', CLUB.id, k], Number.isFinite(x) && x > 0 ? { offre: labels[k] || k, mensuel: Math.round(x * 100) / 100, at: Date.now(), by: ME.id } : null]); });
  db.batch(ops); toast(`${plur(ops.filter(o => o[1]).length, 'tarif enregistré', 'tarifs enregistrés')}`);
};
ACTIONS.tarifsResamania = () => {
  const offres = {}; Object.values(S.clients).filter(c => c.clubId === CLUB.id && c.offer && Number(c.price) > 0).forEach(c => { const k = tarifCle(c.offer); (offres[k] = offres[k] || { label: c.offer, p: [] }).p.push(Number(c.price)); });
  const T = deepGet(S, ['tarifs', CLUB.id]) || {}; const ops = Object.entries(offres).filter(([k]) => !(T[k] && T[k].mensuel)).map(([k, o]) => [['tarifs', CLUB.id, k], { offre: o.label, mensuel: Math.round(medianOf(o.p) * 100) / 100, at: Date.now(), by: ME.id, source: 'resamania' }]);
  db.batch(ops); toast(`${plur(ops.length, 'tarif repris', 'tarifs repris')} des prix Resamania`);
};

// ── Feuille de résultat d'un appel de rétention (Rétention, accueil, Relances) ─
// Issues par type ; troisième tap : créneau (RDV, À rappeler), motif puis transfert (Part, Insatisfait),
// SMS prêt (Pas de réponse). Renouvelle : saisie « sauvetage » valant mensualité x 12.
const RET_ISSUES = {
  suivi: [['ok', 'Tout va bien'], ['rdv', 'RDV coach'], ['rappel', 'À rappeler'], ['noanswer', 'Pas de réponse'], ['insatisfait', 'Insatisfait']],
  renouvellement: [['renouvelle', 'Renouvelle'], ['rdv', 'RDV'], ['rappel', 'À rappeler'], ['noanswer', 'Pas de réponse'], ['part', 'Part']],
  anniversaire: [['envoye', 'Message envoyé']],
  mandat: [['ok', 'Mandat signé'], ['rdv', 'RDV'], ['rappel', 'À rappeler'], ['noanswer', 'Pas de réponse']],
};
const retIssues = type => RET_ISSUES[/^suivi/.test(type) ? 'suivi' : type] || RET_ISSUES.suivi;
const RET_CRENEAUX = () => { const d = new Date(); const j = (n, h) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, h).getTime(); const lundi = ((8 - d.getDay()) % 7) || 7;
  return [...(d.getHours() < 17 ? [['Ce soir 18 h', j(0, 18)]] : []), ['Demain 10 h', j(1, 10)], ['Demain 18 h', j(1, 18)], ['Lundi 10 h', j(lundi, 10)]]; };
const retRel = (cid, type) => (typeof relancesFor === 'function' ? relancesFor(CLUB.id) : []).find(x => x.clientId === cid && x.kind === (LOY_REL[type] || type)) || null;
const retTexteSms = (c, type) => fillTemplate(tplFor(LOY_REL[type] || type, 'sms'), { prenom: String(c.name || '').split(' ')[0], nom: c.name || '', club: nomAffiche(), commercial: ME.first || '', date_fin: c.end ? dmy(c.end) : '', offre: c.offer || '', montant: '' }).text;
function retSheet(cid, type, step) {
  if (type === 'impaye') return dunSheet(cid);
  const c = S.clients[cid]; if (!c) return; const task = loyTache(cid, type, step); const ty = LOYALTY_TYPES[type] || {};
  const rec = task ? tentativeRecente(loyEssais(task)) : null; const sc = (tplFor(LOY_REL[type] || type, 'script') || []).filter(Boolean)[0] || '';
  const ctx = { prenom: String(c.name || '').split(' ')[0], club: nomAffiche(), commercial: ME.first || '', date_fin: c.end ? dmy(c.end) : '', offre: c.offer || '' };
  openModal({ title: `${c.name} · ${ty.label || ''}`, drawer: true, body: `<div class="dsheet" data-id="${esc(cid)}" data-type="${type}">
    <div class="small muted">${esc(task ? retMotif(task) : '')}${task ? ` · ${fmtE(retEuros(task).v)} en jeu` : ''}</div>
    ${sc ? `<details class="dsheet-script"><summary>${esc(fillTemplate(sc, ctx).text)}</summary><p>${esc(fillTemplate(sc, ctx).text)}</p></details>` : ''}
    <div class="dsheet-outs">${retIssues(type).map(([o, l]) => { const off = rec && o === 'noanswer'; return `<button class="btn dsheet-out" data-act="retOut" data-o="${o}" data-id="${esc(cid)}" data-t="${type}" data-s="${step || ''}" ${off ? 'disabled' : ''}>${off ? dejaTente(rec) : l}</button>`; }).join('')}</div>
    <div id="dsheet-suite"></div></div>` });
}
ACTIONS.retSheet = el => retSheet(el.dataset.id, el.dataset.t, el.dataset.s);
function retEnregistrer(cid, type, step, o, { nextAt = null, motif = null, note = '' } = {}) {
  const c = S.clients[cid]; const task = loyTache(cid, type, step); const rl = retRel(cid, type); const ops = [];
  const code = o === 'renouvelle' ? 'ok' : o === 'part' ? 'lost' : o;
  let next = nextAt ? isoOf(new Date(nextAt)) : null;
  if (o === 'noanswer') { const at = nextStepAt({ kind: LOY_REL[type] || type, clubId: CLUB.id }, ((task && task.failed) || 0) + 1); nextAt = at; next = at ? isoOf(new Date(at)) : null; }
  const id = newId(); const rec = loyActRecord({ id, clientId: cid, type, step, outcome: code, note: [motif ? 'Motif : ' + motif : '', note].filter(Boolean).join(' · '), value: task ? retEuros(task).v : null, next });
  ops.push([['loyalty', id], { ...rec, ...(nextAt ? { nextAt } : {}), ...(o === 'rdv' && nextAt ? { rdvAt: nextAt } : {}) }]);
  if (o === 'renouvelle') {
    const m = tarifMensuel(c); const k = 'rn_' + cid + '_' + curMonth();
    ops.push([['clients', cid, 'renewedAt'], today()], [['entries', k], { id: k, userId: ME.id, clubId: CLUB.id, kpiId: 'sauvetage', date: today(), value: 1, saved_eur: Math.round(m * 12 * 100) / 100, source: 'manual', at: Date.now(), by: ME.id, from: 'renouvellement', clientId: cid }]);
  }
  if (o === 'part' || o === 'insatisfait') { const tid = newId(); ops.push([['transferts', tid], { id: tid, clubId: CLUB.id, clientId: cid, type, issue: o, libelle: o === 'part' ? 'Ne renouvelle pas' : 'Adhérent insatisfait', motif: motif || null, at: Date.now(), by: ME.id }]); }
  if (rl) {
    const st = ['ok', 'renouvelle', 'envoye', 'rdv'].includes(o) ? 'gagne' : o === 'part' ? 'perdu' : 'attente';
    ops.push(...relPatch(rl, { status: st, nextAt: st === 'attente' ? nextAt : null, ownerId: rl.ownerId || ME.id, claimedBy: null, claimedUntil: null, ...(st !== 'attente' ? { closedAt: Date.now(), closedBy: ME.id } : {}) }));
    ops.push(touchOp(rl, { channel: 'call', outcome: { ok: 'ok', renouvelle: 'ok', envoye: 'envoye', rdv: 'rdv', rappel: 'rappeler', noanswer: 'pasreponse', part: 'refus', insatisfait: 'joint' }[o] || 'joint', ...(motif ? { reason: motif } : {}), ...(nextAt ? { callbackAt: nextAt } : {}) }));
  }
  db.batch(ops);
}
ACTIONS.retOut = el => {
  const { id: cid, t: type, s: step, o } = el.dataset; const c = S.clients[cid]; const box = $('#dsheet-suite');
  if (o === 'rdv' || o === 'rappel') { box.innerHTML = `<div class="dsheet-step"><div class="dsheet-chips">${RET_CRENEAUX().map(([l, at]) => `<button type="button" class="btn" data-act="retCreneau" data-o="${o}" data-at="${at}" data-id="${esc(cid)}" data-t="${type}" data-s="${step || ''}">${l}</button>`).join('')}</div></div>`; return; }
  if (o === 'part' || o === 'insatisfait') { box.innerHTML = `<div class="dsheet-step"><div class="chips">${RES_REASONS.map(m => `<label class="chip-radio"><input type="radio" name="retmotif" value="${esc(m)}"><span>${esc(m)}</span></label>`).join('')}</div><button class="btn primary dsheet-ok" data-act="retTransfert" data-o="${o}" data-id="${esc(cid)}" data-t="${type}" data-s="${step || ''}">Transférer au manager</button></div>`; return; }
  if (o === 'noanswer') {
    const task = loyTache(cid, type, step); const r = task && tentativeRecente(loyEssais(task)); if (r) { toast(dejaTente(r)); return; }
    retEnregistrer(cid, type, step, o); const tel = clientPhone(c);
    box.innerHTML = `<div class="dsheet-step"><p class="small">Pas de réponse noté.</p>${tel ? `<a class="btn primary dsheet-ok" href="sms:${esc(tel)}?&body=${encodeURIComponent(retTexteSms(c, type))}" data-sms="1">Envoyer le SMS</a>` : ''}<button class="btn dsheet-ok" data-act="dunSuivant">Appel suivant</button></div>`; $$('.dsheet-out').forEach(b => { b.disabled = true; }); return;
  }
  retEnregistrer(cid, type, step, o); closeModal(); render();
  toast(o === 'renouvelle' ? `${c.name} renouvelle : ${fmtE(tarifMensuel(c) * 12)} sauvés` : o === 'envoye' ? `1 message noté pour ${c.name}` : `1 appel noté pour ${c.name}`);
};
ACTIONS.retCreneau = el => { const { id: cid, t: type, s: step, o } = el.dataset; const at = Number(el.dataset.at); retEnregistrer(cid, type, step, o, { nextAt: at }); closeModal(); render(); toast(`${o === 'rdv' ? 'RDV' : 'Rappel'} noté le ${dmy(isoOf(new Date(at)))} à ${timeOf(at).replace(':', ' h ')}`); };
ACTIONS.retTransfert = el => { const { id: cid, t: type, s: step, o } = el.dataset; const m = ($('input[name=retmotif]:checked') || {}).value || null; retEnregistrer(cid, type, step, o, { motif: m }); closeModal(); render(); toast(`${S.clients[cid].name} transféré au manager${m ? ' : ' + m : ''}`); };

// ── Appel depuis une carte : tel:, puis la feuille de résultat au retour dans l'appli ──
ACTIONS.retAppel = el => {
  const { id: cid, t: type, s: step } = el.dataset; const c = S.clients[cid]; const tel = clientPhone(c); if (!tel) return;
  UI.pendingCall = { clientId: cid, kind: type, step: step || null, startedAt: Date.now() };
  const a = document.createElement('a'); a.href = 'tel:' + tel; a.style.display = 'none'; document.body.appendChild(a); try { a.click(); } catch (e) { /* pas de téléphone */ } a.remove();
  clearTimeout(retRetour.t); retRetour.t = setTimeout(retRetour, 2500);
};
function retRetour() {
  const p = UI.pendingCall; if (!p || !p.clientId || document.hidden) return;
  UI.pendingCall = null; clearTimeout(retRetour.t); if (Date.now() - p.startedAt > 2 * 3600000) return;
  setTimeout(() => (p.kind === 'impaye' ? dunSheet(p.clientId) : retSheet(p.clientId, p.kind, p.step)), 150);
}
document.addEventListener('visibilitychange', retRetour);
