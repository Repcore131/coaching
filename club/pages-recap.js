/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — récapitulatif du mois (directeur et managers) ═════════════
//
// Une page, lisible en deux minutes : chaque chiffre est comparé au mois
// précédent, avec une flèche colorée (vert = mieux, rouge = moins bien, en
// tenant compte du sens : moins de résiliations, c'est mieux).

// Photo du total dû : enregistrée à chaque import des impayés en cours.
function duSnapshot(clubId) { return deepGet(S, ['rsm', 'controls', clubId, 'du']) || {}; }
function duAt(clubId, mk) {
  if (mk === curMonth()) return dunRows(clubId).filter(c => Number(c.balance) > 0).reduce((s, c) => s + Number(c.balance), 0);
  const snaps = Object.entries(duSnapshot(clubId)).filter(([d]) => d.slice(0, 7) === mk).sort(([a], [b]) => a.localeCompare(b));
  return snaps.length ? Number(snaps.at(-1)[1]) : null;
}
function monthFigures(clubId, mk) {
  const from = mk + '-01', to = `${mk}-${daysIn(mk)}`;
  const sum = (k, u = null) => sumRange(clubId, u, k, from, to);
  const res = resList(clubId);
  const demandes = res.filter(r => r.date.slice(0, 7) === mk).length;
  const resiliees = res.filter(r => resStatus(r) === 'resiliee' && (r.effective || r.date).slice(0, 7) === mk).length;
  const sauvees = res.filter(r => resStatus(r) === 'sauvee' && ((S.entries['sv_' + r.id] || {}).date || r.date).slice(0, 7) === mk).length;
  const base = deepGet(S, ['base', clubId, mk]) || {};
  const evo = deepGet(S, ['rsm', 'controls', clubId, 'evo', mk]) || {};
  const recBy = recoveredParts(clubId, { from, to });
  const actifs = Number(base.actifs) || null;
  return {
    mk,
    contrats: sum('contrats'),
    entrants: evo.gained != null ? Number(evo.gained) : sum('contrats'),
    entrantsSrc: evo.gained != null ? 'Resamania (Évolution clients)' : 'contrats signés',
    sorties: evo.lost != null ? Number(evo.lost) : null,
    resiliees, demandes, sauvees,
    tauxResil: actifs ? resiliees / actifs : null,
    tauxSauvetage: resiliees + sauvees ? sauvees / (resiliees + sauvees) : null,
    actifs,
    du: duAt(clubId, mk),
    recupere: recoveredFor(clubId, { from, to }),
    recEquipe: recoveredFor(clubId, { from, to }, 'equipe'), recBy,
    // Impayes recuperes PAR L'EQUIPE : la meme valeur que le KPI du tableau de bord
    // et du classement (saisies + import canal equipe, sans double compte).
    impayesEquipe: sum('impayes'),
    avis: sum('avis'),
    nutrition: sum('nutrition'), accessoires: sum('accessoires'),
    boutique: sum('nutrition') + sum('accessoires'),
    b2b: sum('b2b'),
  };
}
// variation colorée : up = true si une hausse est une bonne nouvelle
function delta(cur, prev, { up = true, unit = 'qty', pct = false } = {}) {
  if (cur == null || prev == null) return '<span class="dl dl-none">n.d.</span>';
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return '<span class="dl dl-flat">= stable</span>';
  const good = (d > 0) === up;
  const txt = pct ? `${d > 0 ? '+' : ''}${(d * 100).toFixed(1).replace('.', ',')} pt` : `${d > 0 ? '+' : '−'}${unit === 'eur' ? fmtE(Math.abs(d)) : fmtN(Math.abs(d))}${prev ? ` (${d > 0 ? '+' : '−'}${Math.round(Math.abs(d) / Math.abs(prev) * 100)} %)` : ''}`;
  return `<span class="dl ${good ? 'dl-good' : 'dl-bad'}">${d > 0 ? '▲' : '▼'} ${txt}</span>`;
}
// barres verticales mois par mois (une ou deux séries)
function monthBars(months, series, { fmt = fmtN, height = 190, width = 560 } = {}) {
  const W = width, H = height, L = 8, B = 26, T = 22;
  const max = Math.max(1, ...series.flatMap(s => s.values.map(v => v || 0))) * 1.12;
  const gw = (W - L * 2) / months.length; const bw = Math.min(30, (gw - 14) / series.length);
  let g = `<line x1="${L}" x2="${W - L}" y1="${H - B}" y2="${H - B}" class="c-grid"/>`;
  months.forEach((m, i) => {
    const x0 = L + i * gw + (gw - bw * series.length) / 2; const last = i === months.length - 1;
    series.forEach((s, j) => { const v = s.values[i] || 0; const h = (H - B - T) * v / max; const x = x0 + j * bw;
      g += `<rect x="${x + 1}" y="${H - B - h}" width="${bw - 3}" height="${Math.max(0, h)}" rx="4" style="fill:${s.color};opacity:${last ? 1 : .55}"><title>${esc(s.label)} · ${esc(monthLabel(m))} : ${fmt(v)}</title></rect>`;
      if (last && series.length === 1) g += `<text x="${x + bw / 2}" y="${H - B - h - 7}" text-anchor="middle" class="c-now">${fmt(v)}</text>`; });
    g += `<text x="${L + i * gw + gw / 2}" y="${H - 8}" text-anchor="middle" class="c-tick" style="${last ? 'font-weight:700;fill:var(--text)' : ''}">${MOIS_C[Number(m.slice(5)) - 1]}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}">${g}</svg></div>${series.length > 1 ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join('')}</div>` : ''}`;
}

PAGES.recap = {
  title: 'Récapitulatif du mois',
  manager: true,
  render() {
    const mk = UI.recapMonth || addMonths(curMonth(), -1);
    const pm = addMonths(mk, -1);
    const F = monthFigures(CLUB.id, mk), P = monthFigures(CLUB.id, pm);
    const months = []; for (let i = 5; i >= 0; i--) months.push(addMonths(mk, -i));
    const H6 = months.map(m => monthFigures(CLUB.id, m));
    const tile = (label, value, d, sub = '') => `<div class="rc-tile"><span>${label}</span><b>${value}</b>${d}${sub ? `<small>${sub}</small>` : ''}</div>`;
    const ongoing = mk === curMonth();
    // par commercial
    const team = clubMembers(CLUB.id, { all: true }).filter(u => u.status !== 'pending');
    const from = mk + '-01', to = `${mk}-${daysIn(mk)}`, pfrom = pm + '-01', pto = `${pm}-${daysIn(pm)}`;
    const cols = [['contrats', 'Ventes (contrats)', 'qty'], ['avis', 'Avis Google', 'qty'], ['boutique', 'Boutique', 'eur'], ['impayes', 'Impayés récupérés', 'eur'], ['sauvetage', 'Sauvetages', 'qty']];
    const val = (k, u, f, t) => k === 'boutique' ? sumRange(CLUB.id, u, 'nutrition', f, t) + sumRange(CLUB.id, u, 'accessoires', f, t) : sumRange(CLUB.id, u, k, f, t);
    const rows = team.map(u => ({ u, cur: Object.fromEntries(cols.map(([k]) => [k, val(k, u.id, from, to)])), prev: Object.fromEntries(cols.map(([k]) => [k, val(k, u.id, pfrom, pto)])) }))
      .filter(r => cols.some(([k]) => r.cur[k] || r.prev[k])).sort((a, b) => b.cur.contrats - a.cur.contrats || b.cur.boutique - a.cur.boutique);
    const maxOf = k => Math.max(1, ...rows.map(r => r.cur[k]));
    const salesMax = Math.max(1, ...rows.map(r => Math.max(r.cur.contrats, r.prev.contrats)));
    return `<div class="recap">
      <div class="recap-head"><div><div class="eyebrow">${esc(CLUB.name)}</div><h1>Récapitulatif · ${monthLabel(mk)}</h1><p class="muted">Comparé à ${monthLabel(pm).toLowerCase()}${ongoing ? ' · mois en cours, chiffres provisoires' : ''}</p></div><span class="spacer"></span>
        <div class="row wrap no-print">${monthNav('recapMonth', mk)}<button class="btn" data-act="recapCsv">${ico('download')} CSV</button><button class="btn" data-act="recapMail">${ico('mail')} Envoyer au directeur</button><button class="btn primary" data-act="recapPrint">${ico('download')} Imprimer / PDF</button></div></div>

      ${recapSynthese(mk)}
      <div class="rc-grid">
        ${tile('Ventes réelles (contrats)', fmtN(F.contrats), delta(F.contrats, P.contrats))}
        ${tile('Nouveaux entrants', fmtN(F.entrants), delta(F.entrants, P.entrants), F.entrantsSrc)}
        ${tile('Résiliations', fmtN(F.resiliees), delta(F.resiliees, P.resiliees, { up: false }), `${plur(F.demandes, 'demande', 'demandes')} · ${plur(F.sauvees, 'sauvée', 'sauvées')}`)}
        ${tile('Taux de résiliation', F.tauxResil == null ? 'n.d.' : (F.tauxResil * 100).toFixed(1).replace('.', ',') + ' %', delta(F.tauxResil, P.tauxResil, { up: false, pct: true }), F.actifs ? `sur ${fmtN(F.actifs)} adhérents actifs` : 'base adhérents à renseigner')}
        ${tile('Impayés en cours', F.du == null ? 'n.d.' : fmtE(F.du), delta(F.du, P.du, { up: false, unit: 'eur' }), 'total dû en fin de mois')}
        ${tile('Impayés récupérés par l’équipe', `<span class="trace-n"${traceAttr({ t: 'recov', canal: 'equipe', club: CLUB.id, from: mk + '-01', to: `${mk}-${daysIn(mk)}`, v: F.impayesEquipe })}>${fmtE(F.impayesEquipe)}</span>`, delta(F.impayesEquipe, P.impayesEquipe, { unit: 'eur' }), `tous canaux : ${fmtE(F.recupere)}`)}
        ${tile('Avis Google', fmtN(F.avis), delta(F.avis, P.avis))}
        ${tile('Ventes boutique', `<span class="trace-n"${traceAttr({ t: 'ca', club: CLUB.id, from: mk + '-01', to: `${mk}-${daysIn(mk)}`, v: F.boutique })}>${fmtE(F.boutique)}</span>`, delta(F.boutique, P.boutique, { unit: 'eur' }), `nutrition ${fmtE(F.nutrition)} · accessoires ${fmtE(F.accessoires)}`)}
      </div>
      <div class="rc-grid rc-value">
        ${(() => { const enc = encaisseMois(CLUB.id, mk), encP = encaisseMois(CLUB.id, pm), ch = churnEuros(CLUB.id, mk), chP = churnEuros(CLUB.id, pm); return `
        ${tile('Revenu récurrent mensuel', fmtE(mrrClub(CLUB.id)), '', 'abonnés actifs × prix de leur offre (aujourd’hui)')}
        ${tile('Encaissé réel', enc == null ? 'non importé' : fmtE(enc), enc == null ? '' : delta(enc, encP, { unit: 'eur' }), enc == null ? 'export Paiements à déposer' : 'source : export Paiements')}
        ${tile('Churn en euros', ch == null ? 'n.d.' : fmtE(ch), ch == null ? '' : delta(ch, chP, { up: false, unit: 'eur' }), 'mensualités perdues par les résiliations du mois')}
        ${tile('Valeur d’un adhérent', fmtE(Math.round(prixMoyen(CLUB.id) * dureeVieMois(CLUB.id))), '', `${plur(dureeVieMois(CLUB.id), 'mois', 'mois')} de durée de vie moyenne`)}`; })()}
      </div>
      ${(() => { const RR = resRecap(CLUB.id, mk); return `<div class="card rc-res" style="margin-bottom:18px"><div class="race-h"><div><div class="eyebrow">${esc(monthLabel(mk))}</div><h3>Résiliations</h3></div><span class="spacer"></span>${isManager() ? `<label class="small row" style="gap:6px">Préavis minimum <input class="input sm" style="width:64px" type="number" min="0" max="120" value="${RR.seuil}" data-change="preavisSet"> jours</label>` : `<span class="muted small">préavis minimum ${RR.seuil} jours</span>`}</div>
        <div class="rc-grid">
          ${tile('Préavis non respecté', `${RR.nonRespecte.length}<small> / ${RR.avecDate.length}</small>`, '', `demandes du mois avec moins de ${RR.seuil} jours entre réception et date d’effet`)}
          ${tile('Sans date de réception', String(RR.sansDate.length), '', 'comptées à part, exclues du calcul du préavis')}
          ${tile('Durée de vie médiane', RR.dureeMediane == null ? 'n.d.' : plur(RR.dureeMediane, 'mois', 'mois'), '', `de l’inscription à la résiliation (${plur(RR.durees.length, 'adhérent', 'adhérents')} parti${RR.durees.length > 1 ? 's' : ''} ce mois)`)}
          ${tile('Taux de sauvetage', fmtP(F.tauxSauvetage), '', `${plur(F.sauvees, 'sauvée', 'sauvées')} sur ${F.sauvees + F.resiliees} issues`)}
        </div>${RR.nonRespecte.length ? `<details style="margin-top:8px"><summary class="small">Voir les ${RR.nonRespecte.length} dossiers</summary><div class="small">${RR.nonRespecte.map(r => `${esc(r.client || 'Adhérent')} : reçue le ${esc(dmy(r.date))}, effet le ${esc(dmy(r.effective))} (${r.preavis} j)`).join('<br>')}</div></details>` : ''}</div>`; })()}

      <div class="g12">
        <div class="card col6"><div class="race-h"><div><div class="eyebrow">6 derniers mois</div><h3>Entrées et sorties</h3></div><span class="spacer"></span><span class="muted small">solde</span> ${(() => { const out = x => x.sorties ?? x.resiliees; return delta(F.entrants - out(F), P.entrants - out(P)); })()}</div>
          ${monthBars(months, [{ label: 'Nouveaux entrants', color: 'var(--fp)', values: H6.map(x => x.entrants) }, { label: F.sorties != null ? 'Sorties (Resamania)' : 'Résiliations', color: 'var(--bad)', values: H6.map(x => x.sorties ?? x.resiliees) }])}
          ${(() => { const net = F.entrants - (F.sorties ?? F.resiliees); return `<p class="muted small">Solde du mois : <b style="color:${net >= 0 ? 'var(--ok)' : 'var(--bad)'}">${net >= 0 ? '+' : ''}${fmtN(net)} adhérents</b>${F.sorties != null ? ` · dont ${plur(F.resiliees, 'résiliation suivie', 'résiliations suivies')} dans Fit Pulse` : ''}</p>`; })()}</div>
        <div class="card col6"><div class="race-h"><div><div class="eyebrow">6 derniers mois</div><h3>Impayés : dû et récupéré</h3></div></div>
          ${monthBars(months, [{ label: 'Total dû en fin de mois', color: 'var(--bad)', values: H6.map(x => x.du || 0) }, { label: 'Récupéré dans le mois', color: 'var(--ok)', values: H6.map(x => x.recupere) }], { fmt: fmtE })}
          <div class="rc-split">${Object.entries(RECOV_CHANNELS).filter(([k]) => F.recBy[k]).map(([k, c]) => `<span><i style="background:${c.color}"></i>${c.label} <b>${fmtE(F.recBy[k])}</b></span>`).join('') || '<span class="muted small">Aucune régularisation importée pour ce mois.</span>'}</div></div>
        <div class="card col4"><div class="race-h"><div><div class="eyebrow">6 derniers mois</div><h3>Ventes réelles</h3></div></div>${monthBars(months, [{ label: 'Contrats', color: 'var(--fp)', values: H6.map(x => x.contrats) }], { width: 340 })}</div>
        <div class="card col4"><div class="race-h"><div><div class="eyebrow">6 derniers mois</div><h3>Avis Google</h3></div></div>${monthBars(months, [{ label: 'Avis', color: 'var(--d-1)', values: H6.map(x => x.avis) }], { width: 340 })}</div>
        <div class="card col4"><div class="race-h"><div><div class="eyebrow">6 derniers mois</div><h3>Boutique</h3></div></div>${monthBars(months, [{ label: 'Boutique', color: 'var(--text)', values: H6.map(x => x.boutique) }], { fmt: v => fmtN(v) + ' €', width: 340 })}</div>
      </div>

      ${recapRevenus(mk)}
      <div class="card" style="margin-top:18px"><div class="race-h"><div><div class="eyebrow">Par commercial · ${monthLabel(mk)} comparé à ${MOIS[Number(pm.slice(5)) - 1].toLowerCase()}</div><h3>L’équipe</h3></div></div>
        ${rows.length ? `<div class="rc-sales">${rows.map(r => `<div class="rc-sale"><span>${esc(fullName(r.u))}</span><div class="rc-bars"><i class="prev" style="width:${r.prev.contrats / salesMax * 100}%"></i><i class="cur" style="width:${r.cur.contrats / salesMax * 100}%"></i></div><b>${fmtN(r.cur.contrats)}</b><small>${delta(r.cur.contrats, r.prev.contrats)}</small></div>`).join('')}</div>
          <div class="legend" style="margin:6px 0 16px"><span><i style="background:var(--fp)"></i>Contrats ${MOIS[Number(mk.slice(5)) - 1].toLowerCase()}</span><span><i style="background:var(--surface-2);border:1px solid var(--muted)"></i>${MOIS[Number(pm.slice(5)) - 1].toLowerCase()}</span></div>
          <div class="table-wrap"><table class="t rc-table"><thead><tr><th>Commercial</th>${cols.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>
          ${rows.map(r => `<tr><td><b>${esc(fullName(r.u))}</b>${r.u.status === 'archived' ? ' <span class="badge">archivé</span>' : ''}</td>${cols.map(([k, , unit]) => `<td><div class="rc-cell"><b>${fmtV(r.cur[k], unit)}</b><i style="width:${r.cur[k] / maxOf(k) * 100}%"></i></div>${delta(r.cur[k], r.prev[k], { unit })}</td>`).join('')}</tr>`).join('')}
          <tr class="total"><td>Équipe</td>${cols.map(([k, , unit]) => { const c = rows.reduce((s, r) => s + r.cur[k], 0), p = rows.reduce((s, r) => s + r.prev[k], 0); return `<td><b>${fmtV(c, unit)}</b><br>${delta(c, p, { unit })}</td>`; }).join('')}</tr></tbody></table></div>` : '<p class="muted">Aucune saisie ce mois-ci.</p>'}</div>
      <p class="muted small">Sources : saisies et imports Resamania de Fit Pulse. Impayés récupérés = liste Incidents (tous canaux) ; total dû = dernier import « Clients en incident » du mois ; taux de résiliation = résiliations effectives du mois / adhérents actifs (Mes clubs > Adhérents).</p>
    </div>`;
  },
};
ACTIONS.recapPrint = () => { document.body.classList.add('printing'); setTimeout(() => { window.print(); document.body.classList.remove('printing'); }, 50); };

// Bloc Résiliations du récap : préavis (seuil réglable), dossiers sans date de réception
// comptés à part, durée de vie médiane d'un abonné parti, taux de sauvetage (monthFigures).
function resRecap(clubId, mk) {
  const seuil = Number(deepGet(S, ['clubs', clubId, 'preavisJours'])) || 30;
  const L = resList(clubId).filter(r => r.date ? r.date.slice(0, 7) === mk : (r.effective || '').slice(0, 7) === mk);
  const sansDate = L.filter(r => !r.date);
  const avecDate = L.filter(r => r.date && r.effective).map(r => ({ ...r, preavis: Math.round((dateOf(r.effective) - dateOf(r.date)) / 864e5) }));
  const nonRespecte = avecDate.filter(r => r.preavis < seuil);
  const byName = {}; clubClients(clubId).forEach(c => { byName[tokensKey(c.name || '')] = c; });
  const durees = resList(clubId).filter(r => resStatus(r) === 'resiliee' && (r.effective || r.date || '').slice(0, 7) === mk).map(r => { const c = (r.clientId && S.clients[r.clientId]) || byName[tokensKey(r.client || '')]; const fin = r.effective || r.date; if (!c || !c.start || !fin || fin < c.start) return null; return Math.round((dateOf(fin) - dateOf(c.start)) / (30.44 * 864e5) * 10) / 10; }).filter(x => x != null);
  const t = durees.slice().sort((a, b) => a - b); const m = Math.floor(t.length / 2); const dureeMediane = t.length ? Math.round(t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2) : null;
  return { seuil, demandes: L, sansDate, avecDate, nonRespecte, durees, dureeMediane };
}
ACTIONS.preavisSet = el => { const v = Math.max(0, Math.min(120, Math.round(Number(el.value) || 0))); db.set(['clubs', CLUB.id, 'preavisJours'], v || null); };
