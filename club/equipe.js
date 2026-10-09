/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — page Équipe du manager (#/equipe) ════════════════════════
// Matrice commerciaux x KPI : réalisé, objectif, écart au rythme en jours
// ouvrés, niveau sur trois couleurs TOUJOURS doublées d'un libellé. Activité
// des 7 derniers jours, signal de décrochage, et « Préparer le point » : fiche
// (2 forces, 2 axes, 1 engagement daté) gardée dans /pulse/coaching/{id}/{date},
// relisible les mois suivants. Les commerciaux gardent leur page Équipe (fil).

const EQ_SEUILS = { surveiller: -0.5, retard: -2 }; // écart en jours ouvrés
const EQ_DECROCHAGE = 0.4; // baisse de plus de 40 % sur 7 jours contre la moyenne des 28 jours précédents

// Écart au rythme d'un KPI, en jours ouvrés (positif : en avance). Jamais « en retard » si réalisé >= attendu.
function eqCell(clubId, uid, k, mk = curMonth(), jour = today()) {
  const debut = mk + '-01', fin = `${mk}-${pad(daysIn(mk))}`;
  const total = joursOuvres(debut, fin); const hier = addDays(jour, -1); const ecoules = hier >= debut ? joursOuvres(debut, hier < fin ? hier : fin) : 0;
  const objectif = monthTarget(mk, uid, k.id); const realise = sumRange(clubId, uid, k.id, debut, fin);
  if (!objectif) return { realise, objectif: 0, ecart: null, niveau: 'none', libelle: 'Sans objectif' };
  const parJour = objectif / (total || 1); const attendu = parJour * ecoules; const ecart = (realise - attendu) / parJour;
  let niveau, libelle;
  if (realise >= objectif) { niveau = 'ok'; libelle = 'Atteint'; }
  else if (realise >= attendu) { niveau = 'ok'; libelle = ecart >= 1 ? 'En avance' : 'Dans le rythme'; }
  else if (ecart >= EQ_SEUILS.retard) { niveau = ecart >= EQ_SEUILS.surveiller ? 'ok' : 'warn'; libelle = ecart >= EQ_SEUILS.surveiller ? 'Dans le rythme' : 'À surveiller'; }
  else { niveau = 'bad'; libelle = 'En retard'; }
  return { realise, objectif, ecart: Math.round(ecart * 10) / 10, niveau, libelle, pct: realise / objectif };
}
// Activité d'un membre sur une période : relances notées, saisies, jours de connexion.
function eqActivite(uid, from, to) {
  const t0 = dateOf(from).getTime(), t1 = dateOf(to).getTime() + 864e5; const inR = at => at >= t0 && at < t1;
  const relances = Object.values(S.touches || {}).filter(x => x && x.by === uid && inR(x.at) && x.channel !== 'note').length + Object.values(S.loyalty || {}).filter(a => a && a.userId === uid && inR(a.at) && a.outcome !== 'reopen').length;
  const saisies = Object.values(S.entries || {}).filter(e => e && e.userId === uid && e.source === 'manual' && inR(e.at || 0)).length;
  const connexions = Object.keys(deepGet(S, ['prefs', uid, 'seenDays']) || {}).filter(d => d >= from && d <= to).length;
  return { relances, saisies, connexions, total: relances + saisies };
}
// Décrochage : 7 derniers jours contre la moyenne hebdomadaire des 28 jours d'avant.
function eqDecrochage(uid, jour = today()) {
  const a7 = eqActivite(uid, addDays(jour, -6), jour); const a28 = eqActivite(uid, addDays(jour, -34), addDays(jour, -7));
  const avant = a28.total / 4; if (avant < 3) return null; // trop peu d'historique pour juger
  const baisse = 1 - a7.total / avant; return baisse > EQ_DECROCHAGE ? { baisse, a7: a7.total, avant: Math.round(avant * 10) / 10 } : null;
}
const eqKpis = mk => kpiList().filter(k => humanMembers(CLUB.id).some(u => monthTarget(mk, u.id, k.id) > 0)).slice(0, 8);
const EQ_MARK = { ok: '●', warn: '▲', bad: '■', none: '' }; // forme en plus de la couleur
function equipeMatrix() {
  const mk = curMonth(); const ks = eqKpis(mk); const team = humanMembers(CLUB.id); const j7 = addDays(today(), -6);
  const sign = n => n == null ? '' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${String(Math.abs(n)).replace('.', ',')}\u00a0j`;
  const fv = (v, k) => k.unit === 'eur' ? fmtN(v) + ' €' : fmtN(v);
  return `<div class="page-head"><div><h1>Équipe</h1><p>${esc(CLUB.name)} · ${monthLabel(mk)} · écart au rythme en jours ouvrés (lundi au samedi, hors fériés)</p></div></div>
    <div class="eq-legend small"><span class="eq-l ok">${EQ_MARK.ok} Dans le rythme, en avance ou atteint</span><span class="eq-l warn">${EQ_MARK.warn} À surveiller (jusqu’à 2 jours de retard)</span><span class="eq-l bad">${EQ_MARK.bad} En retard (plus de 2 jours)</span></div>
    ${team.length ? `<div class="card eq-wrap"><table class="eq-m"><thead><tr><th class="eq-name">Commercial</th>${ks.map(k => `<th title="${esc(k.label)}">${esc(k.label)}</th>`).join('')}<th>Activité 7 jours</th><th></th></tr></thead><tbody>
      ${team.map(u => { const A = eqActivite(u.id, j7, today()); const d = eqDecrochage(u.id);
        return `<tr data-u="${esc(u.id)}"><td class="eq-name"><a href="#/coach/${esc(u.id)}">${avatar(u, 'xs')} <b>${esc(u.first)}</b> ${esc((u.last || '').slice(0, 1))}.</a>${d ? `<div class="eq-drop" title="Activité des 7 derniers jours : ${d.a7}, moyenne des 4 semaines d’avant : ${String(d.avant).replace('.', ',')}">Décrochage : activité −${Math.round(d.baisse * 100)} %</div>` : ''}</td>
          ${ks.map(k => { const c = eqCell(CLUB.id, u.id, k, mk); return c.niveau === 'none' ? '<td class="eq-c none"><span class="muted small">sans objectif</span></td>' : `<td class="eq-c ${c.niveau}" data-k="${k.id}" data-niveau="${c.niveau}" title="${esc(k.label)} : ${esc(c.libelle)}"><b>${fv(c.realise, k)}</b><span class="eq-obj">/ ${fv(c.objectif, k)}</span><span class="eq-st">${EQ_MARK[c.niveau]}\u00a0${esc(c.libelle)} ${c.libelle === 'Atteint' ? '' : sign(c.ecart)}</span></td>`; }).join('')}
          <td class="eq-act small"><span>${plur(A.relances, 'relance', 'relances')}</span><span>${plur(A.saisies, 'saisie', 'saisies')}</span><span>${plur(A.connexions, 'jour connecté', 'jours connectés')}</span></td>
          <td><button class="btn sm" data-act="eqPoint" data-u="${esc(u.id)}">Préparer le point</button></td></tr>`; }).join('')}
    </tbody></table></div>` : `<div class="card">${emptyBox({ art: 'todo', title: 'Aucun commercial', text: 'Ajoutez votre équipe dans Pilotage équipe.' })}</div>`}`;
}
// Fiche « Préparer le point » : propositions tirées des chiffres, modifiables.
function eqSuggest(uid) {
  const mk = curMonth(); const L = eqKpis(mk).map(k => ({ k, c: eqCell(CLUB.id, uid, k, mk) })).filter(x => x.c.niveau !== 'none').sort((a, b) => (b.c.ecart ?? 0) - (a.c.ecart ?? 0));
  const f = L.slice(0, 2).map(x => `${x.k.label} : ${x.c.libelle.toLowerCase()} (${fmtP(x.c.pct)} de l’objectif)`);
  const a = L.slice(-2).reverse().filter(x => !f.includes(`${x.k.label} : ${x.c.libelle.toLowerCase()} (${fmtP(x.c.pct)} de l’objectif)`)).map(x => `${x.k.label} : ${fmtP(x.c.pct)} de l’objectif, ${x.c.libelle.toLowerCase()}`);
  return { forces: [f[0] || '', f[1] || ''], axes: [a[0] || '', a[1] || ''] };
}
const eqPoints = uid => Object.entries(deepGet(S, ['coaching', uid]) || {}).filter(([k, v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && v).map(([date, v]) => ({ date, ...v })).sort((a, b) => b.date.localeCompare(a.date));
ACTIONS.eqPoint = el => {
  const uid = el.dataset.u; const u = S.users[uid]; if (!u) return; const cur = deepGet(S, ['coaching', uid, today()]); const sg = cur || eqSuggest(uid); const prev = eqPoints(uid).filter(p => p.date !== today());
  const ta = (n, v) => `<textarea class="input" name="${n}" rows="2" maxlength="300">${esc(v || '')}</textarea>`;
  openModal({ title: `Préparer le point · ${fullName(u)}`, body: `<form id="eqf" class="grid">
    <div class="form-grid"><label class="field"><span>Force 1</span>${ta('f1', sg.forces[0])}</label><label class="field"><span>Force 2</span>${ta('f2', sg.forces[1])}</label>
    <label class="field"><span>Axe de progrès 1</span>${ta('a1', sg.axes[0])}</label><label class="field"><span>Axe de progrès 2</span>${ta('a2', sg.axes[1])}</label></div>
    <div class="form-grid"><label class="field full"><span>Engagement</span><input class="input" name="eng" maxlength="200" required value="${esc(cur ? cur.engagement.texte : '')}" placeholder="Ex. 10 appels de relance par jour cette semaine"></label>
    <label class="field"><span>Pour le</span><input class="input" type="date" name="engDate" required value="${esc(cur ? cur.engagement.date : addDays(today(), 7))}"></label></div></form>
    ${prev.length ? `<details class="eq-prev"><summary>Points précédents (${prev.length})</summary>${prev.slice(0, 12).map(p => `<div class="eq-prev-i"><b>${esc(dmy(p.date))}</b> · par ${esc(fullName(S.users[p.by]))}<div class="small"><b>Forces :</b> ${(p.forces || []).filter(Boolean).map(esc).join(' ; ')}</div><div class="small"><b>Axes :</b> ${(p.axes || []).filter(Boolean).map(esc).join(' ; ')}</div><div class="small"><b>Engagement :</b> ${esc((p.engagement || {}).texte || '')} pour le ${esc(dmy((p.engagement || {}).date || ''))}</div></div>`).join('')}</details>` : ''}`,
  foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="eqPointOk" data-u="${esc(uid)}">Enregistrer la fiche</button>` });
};
ACTIONS.eqPointOk = el => {
  const uid = el.dataset.u; const f = formData($('#eqf')); if (!f.eng.trim() || !f.engDate) { toast('Indiquez l’engagement et sa date.'); return; }
  const mk = curMonth(); const snap = {}; eqKpis(mk).forEach(k => { const c = eqCell(CLUB.id, uid, k, mk); if (c.niveau !== 'none') snap[k.id] = { realise: c.realise, objectif: c.objectif, ecart: c.ecart }; });
  db.set(['coaching', uid, today()], { date: today(), by: ME.id, at: Date.now(), clubId: CLUB.id, mk, forces: [f.f1.trim(), f.f2.trim()], axes: [f.a1.trim(), f.a2.trim()], engagement: { texte: f.eng.trim(), date: f.engDate }, kpis: snap });
  closeModal(); toast('Fiche enregistrée');
};
// #/equipe : la matrice pour un manager, le fil d'équipe pour un commercial.
const EQUIPE_MEMBRE = PAGES.equipe;
PAGES.equipe = { title: 'Équipe', render(a) { return isManager() ? equipeMatrix() : EQUIPE_MEMBRE.render(a); }, mount(a) { if (!isManager() && EQUIPE_MEMBRE.mount) EQUIPE_MEMBRE.mount(a); } };
