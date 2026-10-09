/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — accueil, paliers collectifs, saisie rapide, relances ══════
//
// L'écran que le commercial ouvre sur son téléphone : où en est l'équipe,
// saisir en un geste, ce que j'ai à faire aujourd'hui. Le manager y voit en
// plus ce qui demande une action (résiliations, impayés, équipe).

// ── Paliers collectifs ────────────────────────────────────────────────────
// S.paliers[club][mois][kpi] = [{ target, reward }, …] dans l'ordre P1, P2, P3.
const PALIER_DEFAULT = { contrats: [{ target: 100, reward: '' }, { target: 115, reward: '' }, { target: 130, reward: '' }], avis: [{ target: 60, reward: '' }, { target: 80, reward: '' }] };
function paliersFor(clubId, mk) {
  const p = deepGet(S, ['paliers', clubId, mk]);
  if (p) return p;
  // pas encore réglés ce mois-ci : on reprend le dernier mois réglé
  const months = Object.keys(deepGet(S, ['paliers', clubId]) || {}).filter(m => m < mk).sort();
  return months.length ? S.paliers[clubId][months.at(-1)] : PALIER_DEFAULT;
}
function palierState(clubId, mk, kpiId) {
  const tiers = (paliersFor(clubId, mk)[kpiId] || []).filter(t => Number(t.target) > 0);
  if (!tiers.length) return null;
  const real = sumRange(clubId, null, kpiId, mk + '-01', `${mk}-${daysIn(mk)}`);
  const reached = tiers.filter(t => real >= Number(t.target)).length;
  const next = tiers.at(reached) || null;
  const max = Number(tiers.at(-1).target);
  const r = rangeOf('month', mk);
  return { kpiId, tiers, real, reached, next, max, expected: elapsed(r, clubId) };
}
function palierBlock(clubId, mk, kpiId, big) {
  const s = palierState(clubId, mk, kpiId); if (!s) return '';
  const k = S.kpis[kpiId];
  const scale = Math.max(s.max * 1.08, s.real);
  const left = s.next ? Number(s.next.target) - s.real : 0;
  const daysLeft = Math.max(1, daysIn(mk) - Number(today().slice(8)) + 1);
  return `<div class="palier ${big ? 'big' : ''}">
    <div class="row"><span class="palier-k">${kpiIcon(k)} ${esc(k.label)}</span><span class="spacer"></span><b class="palier-n num">${esc(fmtU(s.real, k))}</b></div>
    <div class="palier-track"><i style="width:${clamp(s.real / scale * 100, 0, 100)}%"></i>${s.tiers.map((t, i) => `<span class="palier-mark ${s.real >= t.target ? 'got' : ''}" style="left:${t.target / scale * 100}%"><em>P${i + 1}</em></span>`).join('')}<span class="palier-pace" style="left:${clamp(s.expected * s.max / scale * 100, 0, 100)}%" title="Rythme attendu pour le dernier palier"></span></div>
    <div class="palier-tiers">${s.tiers.map((t, i) => `<span class="${s.real >= t.target ? 'got' : ''}">${palierBadge(i + 1, 24, s.real >= t.target)} P${i + 1} : ${esc(fmtU(t.target, k))}</span>`).join('')}</div>
    <div class="palier-msg">${s.next ? `Encore <b>${esc(fmtU(Math.ceil(left), k))}</b> pour le palier ${s.reached + 1}${s.next.reward ? ` · ${esc(s.next.reward)}` : ''} <span class="muted">· ${k.unit === 'eur' ? fmtE(Math.ceil(left / daysLeft)) : (left / daysLeft).toFixed(1).replace('.', ',') + ' ' + uniteKpi(k, 2)} par jour</span>` : `${palierBadge(s.tiers.length, 24)} <b>${plur(s.tiers.length, 'palier atteint', 'paliers atteints')}</b>`}</div>${big || typeof manqueActions !== 'function' ? '' : manqueActions(clubId, mk, kpiId)}</div>`;
}

// Célébration : réservée au palier d'équipe atteint, une fois par palier et par mois
// (S.celebrated[club][mois][kpi] garde le dernier palier fêté). Tout autre résultat
// (client sauvé, impayé récupéré, action faite) devient un toast chiffré.
function celebrate(title, sub, { kind = 'team', art = '', cle = null } = {}) {
  if (kind !== 'team' || !cle) { toast(sub ? `${title} : ${sub}` : title); return; }
  const [club, mk, kpi, n] = cle; const deja = Number(deepGet(S, ['celebrated', club, mk, kpi])) || 0;
  if (deja >= n) return;
  db.set(['celebrated', club, mk, kpi], n);
  const el = document.createElement('div'); el.className = 'celebrate'; el.setAttribute('role', 'status');
  el.innerHTML = `<div class="celebrate-in card">${art ? `<div class="cel-art">${art}</div>` : ''}<div class="celebrate-t">${esc(title)}</div><div class="celebrate-s">${esc(sub || '')}</div><div class="row" style="justify-content:center;gap:8px;margin-top:12px"><button class="btn sm cel-share" data-act="celShare">Partager au fil</button><button class="btn sm primary">Fermer</button></div></div>`;
  el.dataset.title = title; el.dataset.sub = sub || '';
  document.body.appendChild(el); el.addEventListener('click', e => { if (!e.target.closest('.cel-share')) el.remove(); }); setTimeout(() => el.remove(), 6000);
}
// palier franchi par cette saisie ? (comparaison avant / après)
ACTIONS.celShare = el => { const c = el.closest('.celebrate'); sendChat({ text: `${c.dataset.title} : ${c.dataset.sub}` }); c.remove(); toast('1 message partagé dans le chat de l’équipe'); };
function palierSnapshot() { const mk = curMonth(); return Object.keys(paliersFor(CLUB.id, mk)).map(k => { const s = palierState(CLUB.id, mk, k); return s ? s.reached : 0; }); }
function checkPalierCrossed(before) {
  const mk = curMonth(); const keys = Object.keys(paliersFor(CLUB.id, mk));
  keys.forEach((k, i) => { const s = palierState(CLUB.id, mk, k); if (s && s.reached > (before[i] || 0)) setTimeout(() => celebrate(`Palier ${s.reached} atteint`, `${S.kpis[k].label} : ${fmtU(s.real, S.kpis[k])} pour l’équipe${s.tiers.at(s.reached - 1).reward ? '. ' + s.tiers.at(s.reached - 1).reward : ''}`, { kind: 'team', art: palierBadge(s.reached, 96), cle: [CLUB.id, mk, k, s.reached] }), 300); });
}

// ── Saisie rapide : un geste = une saisie, annulable 5 s ──────────────────
// Le retour dit ce que la vente vient de changer : realise, ecart a l'etape,
// rang. Une etape franchie = bandeau ; 100 % = celebration.
function quickAdd(kpiId, value, userId = ME.id) {
  const before = palierSnapshot();
  const r = rangeOf('month', curMonth());
  const row0 = (statsFor(CLUB.id, userId, r, { kpiIds: [kpiId] }).rows[0]) || null;
  const rk0 = ranking(CLUB.id, r).find(x => x.u.id === userId);
  const id = newId();
  db.set(['entries', id], { id, userId, clubId: CLUB.id, kpiId, date: today(), value, source: 'manual', at: Date.now(), by: ME.id });
  const k = S.kpis[kpiId];
  const row = (statsFor(CLUB.id, userId, r, { kpiIds: [kpiId] }).rows[0]) || null;
  const rk = ranking(CLUB.id, r).find(x => x.u.id === userId);
  const parts = [`${k.label} : +${fmtU(value, k)}`];
  let tierHit = null;
  if (row && row.target > 0) {
    parts.push(`${fmtU(row.real, k)} sur ${fmtU(row.target, k)}`);
    const next = TIERS.find(t => row.pct < t - 1e-9);
    if (next) { const need = next * row.target - row.real; parts.push(`encore ${fmtU(k.unit === 'qty' ? Math.ceil(need) : Math.round(need), k)} pour ${next * 100} % de l’objectif`); }
    tierHit = TIERS.filter(t => row0 && row0.pct < t - 1e-9 && row.pct >= t - 1e-9).pop() || null;
  }
  if (rk0 && rk && rk.rank < rk0.rank) parts.push(`vous passez ${rk.rank}${rk.rank === 1 ? 'er' : 'e'}`);
  let pending = null;
  if (tierHit) pending = setTimeout(() => stepBanner(`${k.label} : ${tierHit * 100} % de l’objectif, ${fmtU(row.real, k)}`), 300);
  if (navigator.vibrate && pref('vibrate', true)) navigator.vibrate(tierHit ? [30, 40, 30, 40, 30] : 15);
  toastUndo(parts.join('. '), () => { clearTimeout(pending); db.set(['entries', id], null); });
  checkPalierCrossed(before);
}
function stepBanner(t) { const el = document.createElement('div'); el.className = 'step-banner'; el.setAttribute('role', 'status'); el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 1600); }
function toastUndo(msg, undo) {
  if (CFG.capture) return;
  const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = `<span>${esc(msg)}</span><button>Annuler</button>`;
  el.style.pointerEvents = 'auto';
  $('button', el).addEventListener('click', () => { undo(); el.remove(); toast('1 saisie annulée'); });
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), 5000);
}
// Prospects en dernier (0 point) ; les impayes recuperes passent par les relances.
const QUICK_QTY = ['contrats', 'avis', 'b2b', 'invites', 'prospects'];
const QUICK_EUR = ['nutrition', 'accessoires'];
function quickOrder(list) {
  if (pref('padFixed', false)) return list;
  const st = statsFor(CLUB.id, ME.id, rangeOf('month', curMonth()));
  const lag = id => { const x = st.rows.find(rr => rr.k.id === id); return x && x.target > 0 ? (x.pct || 0) - st.expected : 9; };
  return list.slice().sort((a, b) => (a === 'prospects') - (b === 'prospects') || lag(a) - lag(b));
}
function quickPad() {
  const qty = quickOrder(QUICK_QTY.filter(k => S.kpis[k] && S.kpis[k].enabled));
  const eur = quickOrder(QUICK_EUR.filter(k => S.kpis[k] && S.kpis[k].enabled));
  const mine = id => sumRange(CLUB.id, ME.id, id, today(), today());
  return `<div class="quick">${qty.map(k => `<div class="quick-cell"><button class="quick-btn ${k === 'prospects' ? 'second' : ''}" data-act="qAdd" data-k="${k}"><span class="quick-plus">+1</span><span class="quick-l">${esc(S.kpis[k].label)}</span>${mine(k) ? `<span class="quick-today">${fmtN(mine(k))} auj.</span>` : ''}</button><button class="quick-more" data-act="qMore" data-k="${k}" aria-label="Plusieurs ${esc(S.kpis[k].label)}">+N</button></div>`).join('')}
    ${eur.map(k => `<button class="quick-btn eur" data-act="qEur" data-k="${k}"><span class="quick-plus">€</span><span class="quick-l">${esc(S.kpis[k].label)}</span>${mine(k) ? `<span class="quick-today">${fmtE(mine(k))} auj.</span>` : ''}</button>`).join('')}</div>
    <p class="muted small" style="margin:8px 0 0">Impayé récupéré : passez par <a href="#/relances">vos relances</a>.</p>`;
}
ACTIONS.qAdd = el => { closeModal(); quickAdd(el.dataset.k, 1); };
ACTIONS.qMore = el => {
  const k = S.kpis[el.dataset.k];
  openModal({ title: `Combien de ${k.label.toLowerCase()} ?`, body: `<div class="qn">${[2, 3, 4, 5].map(n => `<button class="quick-btn" data-act="qN" data-k="${k.id}" data-n="${n}"><span class="quick-plus">+${n}</span></button>`).join('')}</div>` });
};
ACTIONS.qN = el => { closeModal(); quickAdd(el.dataset.k, Number(el.dataset.n)); };
ACTIONS.qEur = el => {
  const k = S.kpis[el.dataset.k];
  openModal({ title: k.label, body: `<div class="pad-display" id="pad-v">0</div><div class="pad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'].map(x => `<button type="button" data-p="${x}">${x}</button>`).join('')}</div><div class="row wrap" style="gap:6px;margin-top:10px">${[5, 10, 20, 30, 50].map(v => `<button type="button" class="btn sm" data-q="${v}">${v} €</button>`).join('')}</div>`,
    foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" id="pad-ok">Enregistrer</button>`,
    onMount: m => {
      let s = '';
      const show = () => { $('#pad-v', m).textContent = (s || '0') + ' €'; };
      m.addEventListener('click', e => {
        const b = e.target.closest('[data-p]'); const q = e.target.closest('[data-q]');
        if (b) { const x = b.dataset.p; if (x === '⌫') s = s.slice(0, -1); else if (x === ',') { if (!s.includes(',')) s = (s || '0') + ','; } else if (!/,\d\d$/.test(s)) s += x; show(); }
        if (q) { s = q.dataset.q; show(); }
      });
      $('#pad-ok', m).addEventListener('click', () => { const v = Math.round(toNum(s) * 100) / 100; if (!v) { toast('Saisissez un montant.'); return; } closeModal(); quickAdd(el.dataset.k, v); });
    } });
};

// ── Mes relances : ce dont je suis responsable, et ce qui tombe aujourd'hui ─
function myToDo() {
  const res = resToHandle(CLUB.id).filter(r => r.ownerId === ME.id).sort((a, b) => (a.effective || '9').localeCompare(b.effective || '9'));
  const dun = dunRows(CLUB.id).filter(c => Number(c.balance) > 0 && dunOf(c).ownerId === ME.id).sort((a, b) => (dunDue(b) - dunDue(a)) || Number(b.balance) - Number(a.balance));
  const loy = loyaltyTasks(CLUB.id).filter(t => t.state === 'todo' && ['anniversaire', 'suivi', 'renouvellement'].includes(t.type)).sort((a, b) => a.due.localeCompare(b.due));
  return { res, dun, loy };
}
// Mes prochaines actions : la tete de MA file de relances (appeler d'abord).
function todoList(limit = 6) {
  const Q = relQueue(CLUB.id, 'mine'); const rows = Q.now.concat(Q.nophone).slice(0, limit);
  if (!rows.length) return emptyBox({ art: 'done', title: 'Aucune relance à votre nom', text: 'Prenez une relance non attribuée dans Relances.', cta: '<a class="btn primary sm" href="#/relances" data-act="relNobody">Prendre une relance</a>' });
  return rows.map(r => { const rl = r.top; const L = contactLinks(rl); return `<div class="todo ${rl.kind === 'resiliation' || rl.kind === 'impaye' ? 'hot' : ''}"><span class="todo-i">${ico(REL_KINDS[rl.kind].icon)}</span><div class="spacer"><b>${esc(r.name)}</b><div class="muted small">${REL_KINDS[rl.kind].label} · ${esc(rl.reason)}</div></div>${r.phone ? `<a class="btn sm primary" href="${esc(L.tel)}" data-act="relCall" data-key="${rl.key}">${ico('phone', 'ico ico-xs')} Appeler</a>` : `<button class="btn sm" data-act="relNote" data-key="${rl.key}">Noter</button>`}</div>`; }).join('') + (Q.now.length + Q.nophone.length > limit ? `<a class="btn ghost sm" href="#/relances" style="margin-top:6px">Voir tout (${Q.now.length + Q.nophone.length})</a>` : '');
}
ACTIONS.relNobody = () => { UI.relScope = 'nobody'; UI.relSeg = 'file'; location.hash = '#/relances'; };

// ── Accueil ───────────────────────────────────────────────────────────────
const ASSET = k => (CFG.assets || {})[k] || null;
function clubWeather(mk) {
  // Projection des paliers : la pire projection des paliers collectifs, à partir du 5 du mois.
  const keys = Object.keys(paliersFor(CLUB.id, mk)); if (!keys.length) return HEALTH.none;
  if (mk === curMonth() && Number(today().slice(8)) < PROJ_JOUR_MIN) return null;
  let worst = HEALTH.good;
  keys.forEach(k => { const s = palierState(CLUB.id, mk, k); if (!s) return; const dayNow = Number(today().slice(8)); const proj = s.real / Math.max(1, dayNow) * daysIn(mk); const t = s.tiers.filter(x => proj >= x.target).length; const h = t === s.tiers.length ? HEALTH.good : t ? HEALTH.watch : HEALTH.alert; if (h === HEALTH.alert || (h === HEALTH.watch && worst === HEALTH.good)) worst = h; });
  return worst;
}
PAGES.home = {
  title: 'Accueil',
  mount() { if (!CFG.capture) setTimeout(() => { if (typeof tourMaybe === 'function') tourMaybe(); }, 400); },
  render() {
    const mk = curMonth(); const r = rangeOf('month', mk);
    const st = statsFor(CLUB.id, ME.id, r);
    const rk = ranking(CLUB.id, r); const me = rk.find(x => x.u.id === ME.id);
    const acc = accomplishments(ME.id);
    const hour = new Date().getHours();
    const hello = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    const daysLeft = Math.max(1, daysIn(mk) - Number(today().slice(8)) + 1);
    const mission = st.rows.filter(x => x.target > 0 && x.real < x.target && ['contrats', 'avis', 'nutrition', 'accessoires'].includes(x.k.id)).map(x => {
      const per = (x.target - x.real) / daysLeft; const doneToday = sumRange(CLUB.id, ME.id, x.k.id, today(), today());
      return { k: x.k, per: x.k.unit === 'qty' ? Math.max(1, Math.ceil(per)) : Math.ceil(per), done: doneToday };
    });
    const palierKeys = Object.keys(paliersFor(CLUB.id, mk));
    const weather = clubWeather(mk);
    // Un seul chiffre « où j'en suis » : le score du mois (celui du classement).
    // La couleur compare l'avancement continu au rythme attendu.
    const stR = statsFor(CLUB.id, ME.id, r, { requiredOnly: true });
    const myPct = stR.score;
    const myHealth = healthOf(stR.progress != null && stR.expected ? stR.progress / stR.expected : null);
    const bigKpis = palierKeys.slice(0, 2).map(k => { const s = palierState(CLUB.id, mk, k); if (!s) return ''; const kk = S.kpis[k]; return `<div class="bk"><span>${esc(kk.label)} · équipe</span><b>${esc(fmtU(s.real, kk))}</b><small>${s.next ? `P${s.reached + 1} : ${esc(fmtU(s.next.target, kk))}, encore ${esc(fmtU(Math.ceil(s.next.target - s.real), kk))}` : plur(s.tiers.length, 'palier atteint', 'paliers atteints')}</small></div>`; }).join('');
    const top5 = rk.filter(x => x.score != null).slice(0, 5);
    const manager = isManager();
    const recovRows = manager && typeof recovList === 'function' ? (() => { const out = []; for (let i = 3; i >= 0; i--) { const m = addMonths(mk, -i); const rg = { from: m + '-01', to: `${m}-${daysIn(m)}` }; const parts = recoveredParts(CLUB.id, rg); if (parts.equipe_na) { parts.equipe += parts.equipe_na; delete parts.equipe_na; } out.push({ label: MOIS_C[Number(m.slice(5)) - 1], parts, total: recoveredFor(CLUB.id, rg) }); } return out; })() : [];
    return `<div class="home2">${manager ? miseEnRouteCard() : ''}
      <section class="banner">
        <div class="banner-in"><div class="eyebrow light">${esc(nomAffiche())} · ${monthLabel(mk)}</div>
          <h1 class="banner-t">${hello} <span>${esc(ME.first)}</span></h1>
          <div class="row wrap banner-meta"><span class="jtag" title="${esc(compteRebours().titre)}">${esc(compteRebours().texte)}</span>${weather ? `${healthChip(weather)}<span class="muted-l">Projection des paliers</span>` : `<span class="muted-l">Projection disponible le ${PROJ_JOUR_MIN}</span>`}</div>
          <div class="banner-kpis">${bigKpis}${me && me.score != null ? `<a class="bk link" href="#/leaderboard"><span>Mon rang</span><b>${me.rank}<sup>${me.rank === 1 ? 'er' : 'e'}</sup> sur ${rk.length}</b><small>Série : ${plur(acc.streak, 'jour', 'jours')}</small></a>` : ''}</div></div></section>
      ${typeof planHomeCard === 'function' ? planHomeCard() : ''}
      ${weekDigestCard()}
      ${manager ? saisonBanner() : ''}
      ${wrapBanner()}
      ${manager ? '' : parcoursCard()}
      ${manager ? '' : myPlanCard()}
      ${manager ? '' : primeCard()}
      <div class="g12 home-now">
        <div class="card col6 ma-journee"><div class="race-h"><div><div class="eyebrow">${dayLabel(today())}</div><h3>Ma journée</h3></div></div>
          <div class="mj-top"><div><b class="num-l">${fmtP(myPct)}</b><span>score du mois</span></div><div><b class="num-l">${me ? me.rank + '<sup>' + (me.rank === 1 ? 'er' : 'e') + '</sup>' : 'n.d.'}</b><span>sur ${plur(rk.length, 'commercial', 'commerciaux')}</span></div><div title="${esc(compteRebours().titre)}"><b class="num-l">${compteRebours().ouvres} j</b><span>${compteRebours().ouvres > 1 ? 'ouvrés restants' : 'ouvré restant'}</span></div>${healthChip(myHealth)}</div>
          ${mission.length ? `<div class="mini-mission">${mission.map(m => `<div class="${m.done >= m.per ? 'done' : ''}"><span>${esc(m.k.label)}</span><b>${m.done >= m.per ? ico('check', 'ico ico-xs') : esc(fmtU(m.per, m.k)) + ' aujourd’hui'}</b></div>`).join('')}</div>` : '<p class="muted small">Objectifs du mois tenus.</p>'}
          ${(() => { const a = weekActions(ME.id); return `<p class="muted small" style="margin:8px 0 0">Actions de la semaine : ${plur(a.calls, 'relance', 'relances')}, ${plur(a.good, 'issue positive', 'issues positives')}.</p>`; })()}</div>
        <div class="card col6"><div class="race-h"><div><div class="eyebrow">Classé en euros attendus</div><h3>Vos 5 actions les plus rentables aujourd’hui</h3></div><span class="spacer"></span><a class="btn ghost sm" href="#/opportunites">Tout voir</a></div>${oppHomeList(5)}</div>
      </div>
      ${manager && Number(today().slice(8)) <= 5 ? `<a class="recap-ready" href="#/recap">${ico('chart')}<div><b>Le récapitulatif de ${MOIS[Number(addMonths(mk, -1).slice(5)) - 1].toLowerCase()} est prêt</b><span>Ventes, résiliations, impayés, avis, boutique : comparés au mois d’avant.</span></div>${ico('chevR')}</a>` : ''}
      ${manager ? localTransferCard() : ''}
      ${manager ? badgeVerifies(CLUB.id) : ''}
      ${manager ? briefDuJourCard() : ''}
      ${manager ? managerCockpit() : ''}
      <div class="g12">
        <div class="card col8"><details class="race-det" ${innerWidth > 860 ? 'open' : ''}><summary>Voir la projection des paliers</summary>${palierKeys.includes('contrats') ? palierRace(CLUB.id, mk, 'contrats') : palierKeys[0] ? palierRace(CLUB.id, mk, palierKeys[0]) : '<p class="muted">Aucun palier ce mois-ci.</p>'}</details></div>
        <div class="card col4 paliers"><div class="race-h"><div><div class="eyebrow light">Prime d’équipe</div><h3>Paliers du mois</h3></div><span class="spacer"></span>${manager ? '<a class="btn ghost sm light" href="#/members" data-act="goPaliers">Régler</a>' : ''}</div>${palierKeys.map(k => palierBlock(CLUB.id, mk, k, false)).join('') || '<p class="muted">Aucun palier collectif.</p>'}</div>
        <div class="card col5"><div class="race-h"><div><div class="eyebrow">Saisie rapide</div><h3>Saisir</h3></div></div>${quickPad()}</div>
        <div class="card col3"><div class="race-h"><div><div class="eyebrow">Mes objectifs</div><h3>Ma progression</h3></div></div>
          <div class="center">${ring(myPct == null ? null : Math.min(myPct, 1), { label: fmtP(myPct), sub: 'score du mois', color: myHealth.color })}${healthChip(myHealth)}</div>
          ${mission.length ? `<div class="mini-mission">${mission.map(m => `<div class="${m.done >= m.per ? 'done' : ''}"><span>${esc(m.k.label)}</span><b>${m.done >= m.per ? ico('check', 'ico ico-xs') : esc(fmtU(m.per, m.k)) + ' aujourd’hui'}</b></div>`).join('')}</div>` : '<p class="muted small center">Objectifs du mois tenus</p>'}</div>
        <div class="card col4"><div class="race-h"><div><div class="eyebrow">Ce mois-ci</div><h3>Les 5 premiers</h3></div><span class="spacer"></span><a class="btn ghost sm" href="#/leaderboard">Classement</a></div>
          ${top5.map(x => { const h = healthOf(x.score != null && x.st.expected ? x.score / x.st.expected : null); return `<div class="top-r ${x.u.id === ME.id ? 'me' : ''}"><b class="top-n">${x.rank}</b>${avatar(x.u, 'xs')}<span class="spacer">${esc(fullName(x.u))}</span>${manager || x.u.id === ME.id ? `<i class="hdot ${h.cls}" title="${h.label}"></i>` : ''}<b>${fmtP(x.score)}</b></div>`; }).join('') || '<p class="muted small">Pas encore de classement.</p>'}</div>
        ${manager ? `<div class="card col3"><div class="race-h"><div><div class="eyebrow">${MOIS[Number(mk.slice(5)) - 1]}</div><h3>Résiliations</h3></div></div>${resFunnel(CLUB.id, mk)}</div>
        <div class="card col3"><div class="race-h"><div><div class="eyebrow">Tous canaux</div><h3>Impayés récupérés</h3></div></div>${stackRows(recovRows, Object.entries(RECOV_CHANNELS).map(([key, c]) => ({ key, label: c.label, color: c.color })))}</div>` : ''}
      </div></div>`;
  },
};
// Donnees saisies sur cet appareil AVANT le mode partage (ancien mode local) :
// on propose de les verser dans la base de l'equipe, sans rien ecraser.
function localData() {
  if (backend.mode !== 'firebase' || safeLS.get('fitpulse.transferred')) return null;
  try { const st = JSON.parse(safeLS.get(LOCAL_KEY) || 'null'); if (!st || (st.meta && st.meta.demo)) return null; return st; } catch (e) { return null; }
}
function localTransferPlan(st) {
  const ops = []; let users = 0, items = 0;
  for (const [coll, val] of Object.entries(st)) {
    if (!val || typeof val !== 'object' || Array.isArray(val) || ['team', 'meta'].includes(coll)) continue;
    const remote = S[coll] || {};
    for (const [k, v] of Object.entries(val)) {
      if (remote[k] !== undefined) continue;
      if (coll === 'users') { const { salt, codeHash, bootKey, ...rest } = v; ops.push([[coll, k], rest]); users++; }
      else { ops.push([[coll, k], v]); items++; }
    }
  }
  return { ops, users, items };
}
function localTransferCard() {
  const st = localData(); if (!st) return '';
  const p = localTransferPlan(st); if (!p.ops.length) return '';
  return `<div class="recap-ready" style="cursor:default">${ico('upload')}<div><b>Données trouvées sur cet appareil</b><span>${plur(p.users, 'membre', 'membres')} et ${plur(p.items, 'élément', 'éléments')} saisis avant la base partagée. Transférez-les pour que toute l’équipe les voie. Les membres transférés auront besoin d’un nouveau code (envoyé par e-mail).</span></div>
    <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn primary sm" data-act="localTransfer">Transférer</button><button class="btn ghost sm" data-act="localTransferSkip">Ignorer</button></div></div>`;
}
ACTIONS.localTransfer = () => {
  const st = localData(); if (!st) return;
  const p = localTransferPlan(st);
  for (let i = 0; i < p.ops.length; i += 400) db.batch(p.ops.slice(i, i + 400));
  safeLS.set('fitpulse.transferred', '1');
  toast(`Transféré : ${plur(p.users, 'membre', 'membres')}, ${plur(p.items, 'élément', 'éléments')}. Générez maintenant leurs codes dans Équipe.`);
  render();
};
ACTIONS.localTransferSkip = () => { safeLS.set('fitpulse.transferred', '1'); render(); };
ACTIONS.goPaliers = () => { UI.memTab = 'paliers'; location.hash = '#/members'; };
function managerCockpit() {
  const res = resToHandle(CLUB.id); const urgent = res.filter(resUrgent).length; const noOwner = res.filter(r => !r.ownerId).length;
  const dun = dunRows(CLUB.id).filter(c => Number(c.balance) > 0); const dunTot = dun.reduce((s, c) => s + Number(c.balance), 0); const dunNobody = dun.filter(c => !dunOf(c).ownerId).length; const dunDueN = dun.filter(dunDue).length;
  const team = clubMembers(CLUB.id);
  const silent = sansSaisie(CLUB.id); const presents = team.filter(u => !u.virtual && !deepGet(S, ['absences', u.id, today()]));
  const lvl = (bad, warn) => bad ? 'h-alert' : warn ? 'h-watch' : 'h-good';
  const tile = (href, l, cls, label, value, sub) => `<a class="ck2 ${cls}" href="${href}"><div class="ck2-h"><span>${label}</span><i class="hdot ${cls}"></i></div><b>${value}</b><small>${sub}</small><em>${l}</em></a>`;
  return `<div class="row wrap ck-rit"><button class="btn primary sm" data-act="ritual">${ico('sun')} Brief du matin</button><a class="btn sm" href="#/journee">${ico('cal')} ${TXT.nav.journee}</a><button class="btn sm" data-act="clotureJour">${ico('check')} ${TXT.cloture.bouton}</button><a class="btn sm" href="#/team">${ico('users')} Pilotage équipe</a>${new Date().getDay() === 1 ? (() => { const rt = routineSemaine(CLUB.id); return `<a class="btn sm ${rt.recus < rt.total || rt.suspects ? 'warn-btn' : ''}" href="#/imports" data-act="ui" data-key="impTab" data-val="rsm" data-routine="${rt.recus}">Routine : ${rt.recus} sur ${rt.total} reçus${rt.suspects ? `, ${rt.suspects} à vérifier` : ''}</a>`; })() : ''}</div><div class="cockpit2">
    ${(() => { const k = resCompteurs(CLUB.id); return tile('#/resiliations', 'Traiter', lvl(k.attente, k.encours || noOwner), 'Résiliations en attente de réponse', plur(k.attente, 'demande', 'demandes'), `${k.encours} en cours · ${urgent} à J-7 · ${noOwner} sans responsable`).replace('class="ck2 ', `data-tuile="res-attente" data-attente="${k.attente}" data-encours="${k.encours}" class="ck2 `); })()}
    ${(() => { const q = rrqCounts(CLUB.id); return q.open || deepGet(S, ['resRequestsMeta', CLUB.id, 'lastRunAt']) ? tile('#/resiliations', 'Ouvrir', lvl(q.late, q.open), 'Demandes reçues par e-mail', plur(q.open, 'demande', 'demandes'), `${q.late ? `dont ${q.late} sans réponse depuis 48 h` : 'toutes ont une réponse'} · ${esc(rrqRunLabel(CLUB.id))}`) : ''; })()}
    ${tile('#/impayes', 'Relancer', lvl(dunNobody > 2, dunNobody || dunDueN), 'Impayés en cours', fmtE(dunTot), `${dun.length} dossiers · ${dunDueN} à relancer aujourd’hui`)}
    ${(() => { const v60 = dun.filter(c => detteTranche(c) === 3).reduce((s, c) => s + Number(c.balance), 0); const rouge = dunTot > 0 && v60 > 0.2 * dunTot;
      return tile('#/impayes', 'Voir', rouge ? 'h-alert' : v60 ? 'h-watch' : 'h-good', 'Dette de plus de 60 jours', fmtE(v60), `${fmtP(dunTot ? v60 / dunTot : 0)} du total dû${rouge ? ', au-delà de 20 %' : ''}`).replace('class="ck2 ', `data-tuile="dette60" data-rouge="${rouge}" class="ck2 `); })()}
    ${(() => { const a = tauxAdoption(CLUB.id); return a ? tile('#/members', 'Voir', a.taux >= 0.75 ? 'h-good' : a.taux >= 0.5 ? 'h-watch' : 'h-alert', 'Taux d’adoption', fmtP(a.taux), `${a.actifs} sur ${a.total} actifs au moins 4 jours sur 6 cette semaine`).replace('class="ck2 ', 'data-tuile="adoption" class="ck2 ').replace('href="#/members"', 'href="#/members" data-act="ui" data-key="memTab" data-val="adoption"') : ''; })()}
    ${tile('#/members', 'Voir', lvl(silent.length > team.length / 2 && new Date().getHours() >= 15, silent.length), 'Sans saisie aujourd’hui', `${silent.length}/${presents.length}`, silent.slice(0, 3).map(u => esc(u.first)).join(', ') || 'toute l’équipe a saisi')}
  </div>`;
}

// ── Relances (onglet du téléphone) ────────────────────────────────────────
PAGES.relances = {
  title: 'Mes relances',
  render() {
    const { res, dun, loy } = myToDo();
    return `<div class="page-head"><div><h1>Mes relances</h1><p>Les dossiers dont vous êtes responsable, et les appels du jour.</p></div></div>
      <div class="card" style="padding:6px 14px;margin-bottom:14px">${todoList(99)}</div>
      <div class="row wrap"><a class="btn" href="#/resiliations">${ico('door')} Toutes les résiliations</a><a class="btn" href="#/impayes">${ico('euro')} Tous les impayés</a><a class="btn" href="#/loyalty">${ico('heart')} ${TXT.nav.loyalty}</a></div>
      <p class="muted small">${plur(res.length, 'résiliation', 'résiliations')}, ${plur(dun.length, 'impayé', 'impayés')} à votre nom · ${plur(loy.length, 'appel', 'appels')} de fidélisation en attente pour le club.</p>`;
  },
};

// ── Membres > Paliers collectifs ──────────────────────────────────────────
function memPaliers() {
  const mk = UI.palMonth || curMonth();
  const p = paliersFor(CLUB.id, mk); const saved = !!deepGet(S, ['paliers', CLUB.id, mk]);
  const kpis = kpiList().filter(k => k.unit === 'qty' && k.points > 0);
  const rows = Object.keys(p);
  return `<div class="row wrap" style="margin-bottom:12px">${monthNav('palMonth', mk)}<span class="spacer"></span><button class="btn sm" data-act="palPropose">Proposer d’après les objectifs</button>${saved ? '<span class="badge ok">Réglés pour ce mois</span>' : '<span class="badge warn">Repris du mois précédent : enregistrez pour les figer</span>'}</div>
    <p class="muted small">Objectifs COLLECTIFS du club : chaque saisie de l’équipe fait avancer la barre, visible sur l’accueil de tous. Laissez un seuil vide pour retirer un palier.</p>
    <div class="grid">${rows.map(k => `<div class="card"><div class="card-head"><h3>${esc(S.kpis[k] ? S.kpis[k].label : k)}</h3><span class="spacer"></span><button class="btn ghost sm danger" data-act="palDel" data-k="${k}">Retirer</button></div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Palier</th><th class="num">Seuil (équipe)</th><th class="num">€ par personne</th><th>Récompense</th></tr></thead><tbody>${[0, 1, 2].map(i => { const t = (p[k] || [])[i] || {}; return `<tr><td><b>P${i + 1}</b></td><td class="num"><input class="cell" type="number" min="0" value="${t.target || ''}" data-pal="${k}" data-i="${i}" data-f="target"></td><td class="num"><input class="cell" type="number" min="0" value="${t.amount || ''}" data-pal="${k}" data-i="${i}" data-f="amount"></td><td><input class="input sm" value="${esc(t.reward || '')}" placeholder="ex. Prime 100 € chacun" data-pal="${k}" data-i="${i}" data-f="reward"></td></tr>`; }).join('')}</tbody></table></div></div>`).join('')}</div>
    <div class="row wrap" style="margin-top:12px"><select class="input sm" style="width:auto" id="pal-add">${kpis.filter(k => !rows.includes(k.id)).map(k => `<option value="${k.id}">${esc(k.label)}</option>`).join('')}</select><button class="btn sm" data-act="palAdd">${ico('plus')} Ajouter un objectif collectif</button><span class="spacer"></span><button class="btn primary" data-act="palSave" data-mk="${mk}">Enregistrer les paliers de ${monthLabel(mk)}</button></div>`;
}
function palRead(mk) {
  const p = JSON.parse(JSON.stringify(paliersFor(CLUB.id, mk)));
  $$('[data-pal]').forEach(el => { const k = el.dataset.pal, i = Number(el.dataset.i); p[k] = p[k] || []; while (p[k].length <= i) p[k].push({ target: 0, reward: '' }); p[k][i][el.dataset.f] = el.dataset.f === 'target' || el.dataset.f === 'amount' ? toNum(el.value) : el.value.trim(); });
  Object.keys(p).forEach(k => { p[k] = p[k].filter(t => Number(t.target) > 0).sort((a, b) => a.target - b.target); });
  return p;
}
ACTIONS.palSave = el => { db.set(['paliers', CLUB.id, el.dataset.mk], palRead(el.dataset.mk)); toast('1 grille de paliers enregistrée'); };
ACTIONS.palAdd = () => { const k = $('#pal-add').value; if (!k) return; const mk = UI.palMonth || curMonth(); const p = palRead(mk); p[k] = [{ target: 10, reward: '' }]; db.set(['paliers', CLUB.id, mk], p); };
ACTIONS.palDel = el => { const mk = UI.palMonth || curMonth(); const p = palRead(mk); delete p[el.dataset.k]; db.set(['paliers', CLUB.id, mk], p); };

// ── Barre d'onglets du téléphone ──────────────────────────────────────────
function tabBar(route) {
  // Accueil, Relances, [Saisir], Classement, Equipe (managers : Plus pour le menu complet).
  const t = [['home', 'Accueil', 'home'], ['relances', 'Relances', 'callback'], ['saisir', 'Nouvelle saisie', 'plus'], ['leaderboard', 'Classement', 'ranking'], isManager() ? ['more', 'Plus', 'menu'] : ['equipe', 'Équipe', 'team']];
  const n = relBadge();
  return `<nav class="tabbar">${t.map(([id, l, i]) => id === 'saisir' ? `<button class="tb-main" data-act="tbSaisir" aria-label="Nouvelle saisie">${ico('plus')}</button>` : id === 'more' ? `<button class="tb" data-act="burger">${ico(i)}<span>${l}</span></button>` : `<a class="tb ${route === id ? 'on' : ''}" href="#/${id}">${ico(i)}<span>${l}</span>${id === 'relances' && n ? `<em>${n}</em>` : id === 'equipe' && (unseenPouls() + unseenChat()) ? `<em>${Math.min(99, unseenPouls() + unseenChat())}</em>` : ''}</a>`).join('')}</nav>`;
}
ACTIONS.tbSaisir = () => {
  openModal({ title: 'Saisir', body: `${quickPad()}<p class="muted small" style="margin-bottom:0">Pour une autre date ou un autre membre : <a href="javascript:void 0" data-act="openSaisiesFromPad">saisie détaillée</a>.</p>` });
};
ACTIONS.openSaisiesFromPad = () => { closeModal(); ACTIONS.openSaisies(); };
ACTIONS.goTargets = () => { UI.memTab = 'targets'; location.hash = '#/members'; };

// Bandeau du sprint en cours : visible sans defiler, avec mon rang.
// Actions de la semaine (relances notees et issues positives).
function weekActions(uid) {
  const from = dateOf(weekStart(today())).getTime();
  const T = Object.values(S.touches || {}).filter(x => x.by === uid && x.at >= from);
  const L = Object.values(S.loyalty || {}).filter(x => x.userId === uid && x.at >= from && !T.some(t => Math.abs(t.at - x.at) < 2000));
  return { calls: T.length + L.length, good: T.filter(x => (TOUCH_OUTCOMES[x.outcome] || {}).reached).length + L.filter(x => OUTCOMES[x.outcome] && OUTCOMES[x.outcome].done && !OUTCOMES[x.outcome].lost).length };
}
