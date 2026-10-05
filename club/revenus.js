'use strict';
// ══ FIT PULSE — revenus : entonnoir, invités, opportunités classées en euros ══
// S'appuie sur le socle valeur (value.js : mensualite, prixMoyen, dureeVieMois,
// valeurEnJeu). Tout est calculé à la volée et mis en cache par révision (memo).

const dayDiff = (a, b) => Math.round((dateOf(b) - dateOf(a)) / 86400000);
const ageDays = d => (d ? dayDiff(d, today()) : null);
const fmtTaux = v => (v == null ? 'n.d.' : fmtP(v));

// Index de rapprochement des clients d'un club : nom (jetons triés) et téléphone.
function clientIndex(clubId) {
  return memo(`cidx|${clubId}`, () => {
    const byName = {}, byPhone = {}, byNum = {};
    clubClients(clubId).forEach(c => { const t = tokensKey(c.name || ''); if (t) (byName[t] = byName[t] || []).push(c); const p = phoneE164(c.phone); if (p) (byPhone[p] = byPhone[p] || []).push(c); if (c.num) byNum[String(c.num)] = c; });
    return { byName, byPhone, byNum };
  });
}
// Premier client du club qui correspond (nom ou téléphone) et a démarré dans la fenêtre [from, from + jours].
function matchClient(clubId, name, phone, from, jours) {
  const I = clientIndex(clubId); const to = addDays(from, jours);
  const cands = [...(I.byName[tokensKey(name || '')] || []), ...(I.byPhone[phoneE164(phone)] || [])];
  return cands.filter(c => c.start && c.start >= from && c.start <= to).sort((a, b) => a.start.localeCompare(b.start))[0] || null;
}

// ── Prospects et entonnoir par cohorte ────────────────────────────────────
const prospectsOf = clubId => Object.values(S.prospects || {}).filter(p => p && p.clubId === clubId);
const pName = p => `${p.prenom || ''} ${p.nom || ''}`.trim();
function prospectConv(p) {
  return memo(`pconv|${p.id}`, () => { const c = matchClient(p.clubId, pName(p), p.phone, p.creeLe, 60); return c ? { client: c, delai: dayDiff(p.creeLe, c.start) } : null; });
}
const touchesOfProspect = id => Object.values(S.touches || {}).filter(t => t.prospectId === id);
function prospectStage(p) {
  const st = norm(p.statut || ''); const conv = prospectConv(p);
  const guest = Object.values(S.guests || {}).some(g => g.clubId === p.clubId && tokensKey(g.nom || '') === tokensKey(pName(p)));
  const visite = !!conv || guest || /visite|essai|honor/.test(st);
  const contacte = visite || /contact|rdv|visite|essai/.test(st) || touchesOfProspect(p.id).length > 0;
  return { contacte, visite, contrat: !!conv, conv };
}
// Cohorte : prospects créés dans le mois mk. En cours tant que mk + 60 jours n'est pas passé.
function funnel(clubId, mk, userId = null) {
  return memo(`fun|${clubId}|${mk}|${userId}`, () => {
    const r = rangeOf('month', mk); const L = prospectsOf(clubId).filter(p => p.creeLe >= r.from && p.creeLe <= r.to && (!userId || p.commercialId === userId));
    const rows = L.map(p => ({ p, ...prospectStage(p) }));
    const n = k => rows.filter(x => x[k]).length;
    const conv = rows.filter(x => x.contrat);
    return { rows, crees: rows.length, contactes: n('contacte'), visites: n('visite'), contrats: conv.length, taux: rows.length ? conv.length / rows.length : null, enCours: addDays(r.to, 60) > today(),
      delai: median(conv.map(x => x.conv.delai).map(d => d || 0.5)), euros: Math.round(conv.reduce((s, x) => s + mensualite(x.conv.client) * 12, 0)) };
  });
}
// Taux de transformation de référence : 3 derniers mois de cohortes, club ou commercial.
function tauxCohorte(clubId, userId = null) {
  return memo(`tcoh|${clubId}|${userId}`, () => {
    let c = 0, n = 0; for (let i = 1; i <= 3; i++) { const f = funnel(clubId, addMonths(curMonth(), -i), userId); c += f.contrats; n += f.crees; }
    return n >= 5 ? c / n : null;
  });
}
const STAGES = [['crees', 'Créés'], ['contactes', 'Contactés'], ['visites', 'Visite ou essai'], ['contrats', 'Contrat']];
function fuitePhrase(f, fc, who) {
  let worst = null;
  for (let i = 1; i < STAGES.length; i++) { const a = f[STAGES[i - 1][0]], b = f[STAGES[i][0]]; if (a >= 3) { const loss = 1 - b / a; if (!worst || loss > worst.loss) worst = { i, loss }; } }
  if (!worst) return '';
  const a = fc[STAGES[worst.i - 1][0]], b = fc[STAGES[worst.i][0]]; const lc = a ? 1 - b / a : null;
  return `Le passage ${STAGES[worst.i - 1][1].toLowerCase()} vers ${STAGES[worst.i][1].toLowerCase()} perd ${fmtP(worst.loss)} des prospects${who ? ' de ' + esc(who) : ''}${lc != null && who ? `, contre ${fmtP(lc)} pour le club` : ''}.`;
}
function funnelView(mk, userId) {
  const clubId = CLUB.id;
  if (!prospectsOf(clubId).length) return `<div class="card">${emptyBox({ art: 'target', title: 'Entonnoir vide', text: 'Déposez l’export Prospects de Resamania (Clients > Prospects > Exporter) dans Imports > Resamania : chaque prospect sera suivi jusqu’au contrat.', cta: isManager() ? '<a class="btn primary sm" href="#/imports">Ouvrir les imports</a>' : '' })}</div>`;
  const f = funnel(clubId, mk, userId), fc = funnel(clubId, mk, null); const who = userId ? (S.users[userId] || {}).first : '';
  const max = Math.max(1, f.crees);
  const bars = STAGES.map(([k, l], i) => `<div class="fn-row"><span>${l}</span><div class="fn-bar"><i style="width:${Math.round(f[k] / max * 100)}%"></i></div><b>${fmtN(f[k])}</b><small>${i ? fmtTaux(f[STAGES[i - 1][0]] ? f[k] / f[STAGES[i - 1][0]] : null) : ''}</small></div>`).join('');
  const members = perimeterMembers(clubId, rangeOf('month', mk).from, rangeOf('month', mk).to);
  const byUser = members.map(u => ({ u, f: funnel(clubId, mk, u.id) })).filter(x => x.f.crees);
  const flag = deepGet(S, ['rsm', 'flags', clubId, 'prospects']) || {};
  const prov = {}; f.rows.forEach(x => { const k = x.p.provenance || ''; const o = prov[k] = prov[k] || { n: 0, c: 0, d: [], e: 0 }; o.n++; if (x.contrat) { o.c++; o.d.push(x.conv.delai); o.e += mensualite(x.conv.client) * 12; } });
  const hot = prospectsOf(clubId).filter(p => (!userId || p.commercialId === userId) && ageDays(p.creeLe) >= 2 && ageDays(p.creeLe) <= 21 && !prospectConv(p)).sort((a, b) => (Number(b.valeur) || 0) - (Number(a.valeur) || 0) || b.creeLe.localeCompare(a.creeLe));
  return `<div class="g12">
    <div class="card col7"><div class="card-head"><h3>Cohorte de ${monthLabel(mk).toLowerCase()}</h3><span class="spacer"></span>${f.enCours ? '<span class="tag is-info">en cours</span>' : ''}</div>
      ${bars}<p class="small" style="margin:10px 0 0">Transformation à 60 jours : <b>${fmtTaux(f.taux)}</b>${f.delai != null ? ` · délai médian ${plur(Math.round(f.delai), 'jour', 'jours')}` : ''} · signés : <b>${fmtE(f.euros)}</b> sur 12 mois</p>
     ${fuitePhrase(f, fc, who) ? `<p class="alert" style="margin-top:10px">${ico('alert')}<span>${fuitePhrase(f, fc, who)}</span></p>` : ''}</div>
    <div class="card col5"><div class="card-head"><h3>Prospects chauds non convertis</h3><span class="spacer"></span><button class="btn sm" data-act="guestNew">${ico('plus')} Invité</button></div>
      ${hot.slice(0, 8).map(p => `<div class="row opp-mini"><div class="spacer"><b>${esc(pName(p))}</b><div class="muted small">créé le ${dm(p.creeLe)}${p.statut ? ' · ' + esc(p.statut) : ''}${p.commercialId && S.users[p.commercialId] ? ' · ' + esc(S.users[p.commercialId].first) : ''}</div></div>${p.phone ? `<a class="btn sm" href="tel:${esc(p.phone)}">${ico('phone')}</a>` : ''}<button class="btn sm ghost" data-act="prospectNote" data-id="${p.id}">Noter</button></div>`).join('') || '<p class="muted small">Aucun prospect chaud en attente.</p>'}</div>
    ${isManager() && !userId ? `<div class="card col7"><h3>Par commercial</h3><div class="table-wrap"><table class="t"><thead><tr><th>Commercial</th><th class="num">Créés</th><th class="num">Convertis</th><th class="num">Taux</th><th class="num">Délai médian</th><th class="num">Signés (12 mois)</th></tr></thead><tbody>
      ${byUser.map(x => `<tr><td>${esc(fullName(x.u))}</td><td class="num">${x.f.crees}</td><td class="num">${x.f.contrats}</td><td class="num">${fmtTaux(x.f.taux)}</td><td class="num">${x.f.delai == null ? 'n.d.' : plur(Math.round(x.f.delai), 'j', 'j')}</td><td class="num">${fmtE(x.f.euros)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Aucun prospect attribué.</td></tr>'}</tbody></table></div></div>` : ''}
    <div class="card ${isManager() && !userId ? 'col5' : 'col12'}"><h3>Par provenance</h3>${flag.sansProvenance && !Object.keys(prov).some(Boolean) ? '<p class="muted small">Provenance non renseignée dans l’export.</p>' : `<div class="table-wrap"><table class="t"><thead><tr><th>Provenance</th><th class="num">Créés</th><th class="num">Convertis</th><th class="num">Taux</th><th class="num">Signés</th></tr></thead><tbody>
      ${Object.entries(prov).sort((a, b) => b[1].n - a[1].n).map(([k, o]) => `<tr><td>${esc(k || 'Non renseignée')}</td><td class="num">${o.n}</td><td class="num">${o.c}</td><td class="num">${fmtTaux(o.n ? o.c / o.n : null)}</td><td class="num">${fmtE(Math.round(o.e))}</td></tr>`).join('')}</tbody></table></div>`}</div>
 
    <div class="col12">${shopCard(mk, userId)}</div>
  </div>`;
}
ACTIONS.prospectNote = el => {
  const p = S.prospects[el.dataset.id];
  openModal({ title: `Appel · ${pName(p)}`, body: `<form id="pnf" class="grid"><div class="chips">${[['ok', 'Joint'], ['noanswer', 'Pas de réponse'], ['rdv', 'RDV pris'], ['refus', 'Pas intéressé']].map(([v, l], i) => `<label class="chip-radio"><input type="radio" name="o" value="${v}" ${i ? '' : 'checked'}><span>${l}</span></label>`).join('')}</div><input class="input" name="note" maxlength="200" placeholder="Note (facultatif)"></form>`,
    foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="prospectNoteSave" data-id="${p.id}">Enregistrer</button>` });
};
ACTIONS.prospectNoteSave = el => { const f = formData($('#pnf')); const id = newId(); db.set(['touches', id], { id, clubId: CLUB.id, prospectId: el.dataset.id, at: Date.now(), by: ME.id, channel: 'call', outcome: f.o === 'refus' ? 'refus' : f.o === 'noanswer' ? 'noanswer' : 'ok', note: (f.note || '').slice(0, 200) + (f.o === 'rdv' ? ' (RDV pris)' : '') }); closeModal(); toast('Appel noté'); };

// ── Invités (et parrainage) ───────────────────────────────────────────────
const guestsOf = clubId => Object.values(S.guests || {}).filter(g => g && g.clubId === clubId);
const guestConv = g => memo(`gconv|${g.id}`, () => matchClient(g.clubId, g.nom, g.phone, g.date, 30));
ACTIONS.guestNew = () => {
  const cl = activeClients(CLUB.id).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  openModal({ title: 'Nouvel invité', body: `<form id="gstf" class="grid"><label class="field"><span>Nom et prénom</span><input class="input" name="nom" required maxlength="80"></label><div class="form-grid"><label class="field"><span>Téléphone</span><input class="input" name="tel" type="tel"></label><label class="field"><span>Date de passage</span><input class="input" type="date" name="date" value="${today()}" max="${today()}"></label></div>
    <label class="field"><span>Invité par (adhérent, facultatif)</span><input class="input" name="parrain" list="gst-cl" placeholder="Rechercher un adhérent"><datalist id="gst-cl">${cl.map(c => `<option value="${esc(c.name || '')}${c.num ? ' · ' + esc(c.num) : ''}"></option>`).join('')}</datalist></label></form>`,
    foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="guestSave">Enregistrer</button>` });
};
ACTIONS.guestSave = () => {
  const f = formData($('#gstf')); if (!f.nom.trim()) { toast('Indiquez le nom de l’invité.'); return; }
  const tel = f.tel ? phoneE164(f.tel) : null; if (f.tel && !tel) { toast('Téléphone invalide.'); return; }
  const num = (f.parrain.match(/· (\S+)$/) || [])[1]; const par = f.parrain ? activeClients(CLUB.id).find(c => (num && String(c.num) === num) || tokensKey(c.name || '') === tokensKey(f.parrain)) : null;
  const id = newId(); db.set(['guests', id], { id, clubId: CLUB.id, nom: f.nom.trim().slice(0, 80), phone: tel, date: f.date || today(), parrainId: par ? par.id : null, by: ME.id, at: Date.now() });
  closeModal(); toast(par ? `Invité enregistré, parrain : ${par.name}` : 'Invité enregistré');
};
// Parrain d'un client : invité converti dans les 30 jours, sinon offre ou canal « parrainage ».
function parrainOf(c) {
  const g = guestsOf(c.clubId).find(x => x.parrainId && guestConv(x) && guestConv(x).id === c.id);
  return g ? g.parrainId : null;
}
const isParrainage = c => !!parrainOf(c) || c.source === 'parrainage' || /parrain/.test(norm(`${c.offer || ''} ${c.canal || ''}`));

// ── Opportunités : quoi faire maintenant pour gagner le plus ──────────────
const DUN_AGE = [[7, 0.7, '0 à 7 j', 'age-1'], [30, 0.5, '8 à 30 j', 'age-2'], [60, 0.3, '31 à 60 j', 'age-3'], [Infinity, 0.1, 'plus de 60 j', 'age-4']];
const dunAge = c => ageDays(c.oldestIncident || c.balanceAt) ?? 0;
const dunTranche = c => { const a = dunAge(c); return DUN_AGE.findIndex(t => a <= t[0]); };
const dunAttendu = c => Math.round(Number(c.balance) * DUN_AGE[dunTranche(c)][1] * 100) / 100;
function tauxSauvetage(clubId) {
  return memo(`tsauv|${clubId}`, () => { const from = addDays(today(), -92); const L = resList(clubId).filter(r => (r.date || '') >= from && ['sauvee', 'resiliee'].includes(resStatus(r))); return L.length >= 5 ? L.filter(r => resStatus(r) === 'sauvee').length / L.length : 0.25; });
}
function panierNutrition(clubId) {
  return memo(`pan|${clubId}`, () => { const L = Object.values(S.entries).filter(e => e.clubId === clubId && e.kpiId === 'nutrition' && Number(e.value) > 0 && e.date >= addDays(today(), -90) && entryCounts(e)); return L.length >= 5 ? L.reduce((s, e) => s + Number(e.value), 0) / L.length : 35; });
}
const prixGamme = (clubId, g) => memo(`pg|${clubId}|${g}`, () => { const L = activeClients(clubId).filter(c => gammeOf(c.offer) === g).map(c => mensualite(c, true)).filter(x => x > 0); return L.length ? median(L) : null; });
// Achats boutique par numéro client (index construit une fois par révision).
const shopIndex = () => memo('shopidx', () => { const m = {}; Object.values(S.entries).forEach(e => { if (e.clientNum && ['nutrition', 'accessoires'].includes(e.kpiId) && entryCounts(e)) (m[String(e.clientNum)] = m[String(e.clientNum)] || []).push(e.date); }); return m; });
const hasShop = c => !!c.num && (shopIndex()[String(c.num)] || []).some(d => d >= c.start);
const OPP_TYPES = {
  resiliation: { label: 'Résiliation', icon: 'door' }, impaye: { label: 'Impayé', icon: 'coins' }, prospect: { label: 'Prospect chaud', icon: 'magnet' }, invite: { label: 'Invité', icon: 'ticket' },
  fin: { label: 'Fin d’engagement', icon: 'calcheck' }, upsell: { label: 'Montée en gamme', icon: 'sparkle' }, nutrition: { label: 'Boutique J+15', icon: 'cup' }, ancien: { label: 'Ancien membre', icon: 'repeat' },
  mandat: { label: 'Sans mandat', icon: 'bank' }, parrainage: { label: 'Parrainage', icon: 'users' },
};
function opportunites(clubId) {
  return memo(`opp|${clubId}|${today()}`, () => {
    const out = []; const t = today(); const dvm = dureeVieMois(clubId), pm = prixMoyen(clubId);
    const add = o => { o.eurosAttendus = Math.round(o.eurosPotentiels * Math.min(1, o.probabilite)); if (o.eurosAttendus > 0) out.push(o); };
    const ts = tauxSauvetage(clubId);
    resToHandle(clubId).forEach(r => { const v = valeurEnJeu(r); const urg = resUrgent(r); const c = clubClients(clubId).find(x => tokensKey(x.name || '') === tokensKey(r.client || ''));
      add({ key: 'res_' + r.id, type: 'resiliation', titre: urg ? `Résiliation à J-${Math.max(0, daysTo(r.effective))}` : 'Demande de résiliation', client: r.client, clientId: c ? c.id : null, phone: c ? clientPhone(c) : null, eurosPotentiels: v.euros, probabilite: ts * (urg ? 1.5 : 1), echeance: r.effective, ownerId: r.ownerId || null, href: '#/resiliations', sous: `${r.reason || 'Motif non précisé'} · en jeu ${fmtE(v.euros)}${v.estimee ? ' (estimé)' : ''}` }); });
    dunRows(clubId).filter(c => Number(c.balance) > 0).forEach(c => { const tr = DUN_AGE[dunTranche(c)];
      add({ key: 'dun_' + c.id, type: 'impaye', titre: `Impayé de ${fmtE(Number(c.balance))}`, client: c.name, clientId: c.id, phone: clientPhone(c), eurosPotentiels: Number(c.balance), probabilite: tr[1], echeance: dunOf(c).next || t, ownerId: dunOf(c).ownerId || null, href: '#/impayes', sous: `âge ${plur(dunAge(c), 'jour', 'jours')}` }); });
    prospectsOf(clubId).forEach(p => { const a = ageDays(p.creeLe); if (a < 2 || a > 21 || prospectConv(p)) return; const tx = tauxCohorte(clubId, p.commercialId) ?? 0.3;
      add({ key: 'pro_' + p.id, type: 'prospect', titre: 'Prospect à convertir', client: pName(p), phone: p.phone || null, prospectId: p.id, eurosPotentiels: pm * dvm, probabilite: a > 10 ? tx / 2 : tx, echeance: addDays(p.creeLe, 21), ownerId: p.commercialId || null, href: '#/opportunites', sous: `créé il y a ${plur(a, 'jour', 'jours')}${p.statut ? ' · ' + p.statut : ''}` }); });
    guestsOf(clubId).forEach(g => { const a = ageDays(g.date); if (a > 10 || guestConv(g)) return;
      add({ key: 'gst_' + g.id, type: 'invite', titre: 'Invité à rappeler', client: g.nom, phone: g.phone, eurosPotentiels: pm * dvm, probabilite: 0.35, echeance: addDays(g.date, 10), ownerId: g.by || null, href: '#/opportunites', sous: `passé le ${dm(g.date)}` }); });
    activeClients(clubId).forEach(c => {
      const bal = Number(c.balance) > 0; const since = c.start ? ageDays(c.start) : null;
      if (c.end && c.end >= t && c.end <= addDays(t, 45)) add({ key: 'fin_' + c.id + '_' + c.end, type: 'fin', titre: `Fin d’engagement le ${dm(c.end)}`, client: c.name, clientId: c.id, phone: clientPhone(c), eurosPotentiels: mensualite(c) * dvm, probabilite: 0.15, echeance: c.end, ownerId: c.sellerId || null, href: '#/loyalty', sous: c.offer || '' });
      if (!bal && gammeOf(c.offer) === 'basic' && since >= 60 && since <= 400) { const up = prixGamme(clubId, 'premium'); const gap = up ? up - mensualite(c) : 0; if (gap > 0) add({ key: 'up_' + c.id, type: 'upsell', titre: 'Proposer Premium', client: c.name, clientId: c.id, phone: clientPhone(c), eurosPotentiels: gap * 12, probabilite: 0.05, echeance: null, ownerId: c.sellerId || null, href: '#/loyalty', sous: `+${fmtE(gap)} par mois` }); }
      if (since >= 12 && since <= 20 && !hasShop(c)) add({ key: 'nut_' + c.id, type: 'nutrition', titre: 'Aucun achat boutique depuis l’inscription', client: c.name, clientId: c.id, phone: clientPhone(c), eurosPotentiels: panierNutrition(clubId), probabilite: 0.2, echeance: addDays(c.start, 20), ownerId: c.sellerId || null, href: '#/loyalty', sous: `inscrit le ${dm(c.start)}` });
      if (c.noMandate) add({ key: 'man_' + c.id, type: 'mandat', titre: 'Abonné sans prélèvement', client: c.name, clientId: c.id, phone: clientPhone(c), eurosPotentiels: mensualite(c) * 2, probabilite: 0.5, echeance: null, ownerId: c.sellerId || null, href: '#/loyalty', sous: c.offer || '' });
    });
    reactivables(clubId).slice(0, 15).forEach(x => add({ key: 'anc_' + x.c.id, type: 'ancien', titre: 'Ancien membre à réactiver', client: x.c.name, clientId: x.c.id, phone: clientPhone(x.c), eurosPotentiels: pm * 6, probabilite: 0.04, echeance: null, ownerId: null, href: '#/loyalty', sous: `sorti il y a ${plur(x.mois, 'mois', 'mois')}` }));
    parrainCandidats(clubId).forEach(c => add({ key: 'par_' + c.id + '_' + t.slice(0, 7), type: 'parrainage', titre: 'Solliciter un parrainage', client: c.name, clientId: c.id, phone: clientPhone(c), eurosPotentiels: pm * dvm, probabilite: 0.03, echeance: null, ownerId: c.sellerId || null, href: '#/opportunites', sous: `adhérent depuis ${plur(Math.round(ageDays(c.start) / 30.44), 'mois', 'mois')}` }));
    return out.sort((a, b) => b.eurosAttendus - a.eurosAttendus);
  });
}
// Anciens membres réactivables : sortis il y a 3 à 24 mois, sans impayé, pas revenus.
function reactivables(clubId) {
  return memo(`react|${clubId}`, () => {
    const I = clientIndex(clubId);
    return clubClients(clubId).filter(c => /ancien|perdu/.test(norm(c.status || '')) && c.endDate && !(Number(c.balance) > 0)).map(c => {
      const mois = Math.round(ageDays(c.endDate) / 30.44);
      const again = (I.byName[tokensKey(c.name || '')] || []).some(o => o.id !== c.id && o.start && o.start > c.endDate && !/ancien|perdu/.test(norm(o.status || '')));
      return { c, mois, again, prio: mensualite(c) * (mois <= 6 ? 1 : mois <= 12 ? 0.6 : 0.3), seg: mois <= 6 ? '3-6' : mois <= 12 ? '6-12' : '12-24' };
    }).filter(x => x.mois >= 3 && x.mois <= 24 && !x.again && !x.c.returnedAt).sort((a, b) => b.prio - a.prio);
  });
}
// Adhérents à solliciter pour un parrainage : plus de 6 mois, sans impayé, 5 par jour au plus.
function parrainCandidats(clubId) {
  const L = activeClients(clubId).filter(c => c.start && ageDays(c.start) >= 183 && !(Number(c.balance) > 0) && clientPhone(c));
  const seed = Number(today().replace(/-/g, '')); return L.sort((a, b) => ((hkeyN(a.id) + seed) % 997) - ((hkeyN(b.id) + seed) % 997)).slice(0, 5);
}
const hkeyN = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

const oppState = key => (S.opps || {})[safeKey(key)] || {};
function oppsFor(clubId, scope = 'mine') {
  const now = Date.now();
  return opportunites(clubId).map(o => { const st = oppState(o.key); return { ...o, ownerId: st.ownerId || o.ownerId, st }; })
    .filter(o => !o.st.doneAt && !(o.st.snoozeUntil > now))
    .filter(o => scope === 'all' || o.ownerId === ME.id || !o.ownerId);
}
function oppsDoneToday(clubId, uid) { const d0 = dateOf(today()).getTime(); return Object.values(S.opps || {}).filter(x => x.clubId === clubId && x.doneAt >= d0 && (!uid || x.doneBy === uid)); }
function oppRow(o, mgr) {
  const T = OPP_TYPES[o.type]; const owner = o.ownerId && S.users[o.ownerId];
  return `<div class="opp-row" data-type="${o.type}"><span class="opp-ico">${ico(T.icon)}</span><div class="spacer"><div class="row wrap" style="gap:6px"><b>${esc(o.titre)}</b><span class="tag">${T.label}</span>${owner ? `<span class="muted small">${esc(owner.first)}</span>` : ''}</div>
    <div class="small">${esc(o.client || '')}${o.sous ? ' · <span class="muted">' + esc(o.sous) + '</span>' : ''}${o.echeance ? ' · <span class="muted">échéance ' + dm(o.echeance) + '</span>' : ''}</div></div>
    <div class="opp-eur"><b>${fmtE(o.eurosAttendus)}</b><small>attendus</small></div>
    <div class="opp-act">${o.phone ? `<a class="btn sm icon" href="tel:${esc(o.phone)}" aria-label="Appeler">${ico('phone')}</a>` : ''}${!o.ownerId ? `<button class="btn sm" data-act="oppTake" data-key="${esc(o.key)}">Je m’en occupe</button>` : ''}${mgr ? `<select class="input sm" data-change="oppAssign" data-key="${esc(o.key)}" aria-label="Attribuer"><option value="">Attribuer</option>${clubMembers(CLUB.id).map(u => `<option value="${u.id}" ${u.id === o.ownerId ? 'selected' : ''}>${esc(u.first)}</option>`).join('')}</select>` : ''}<button class="btn sm primary" data-act="oppDone" data-key="${esc(o.key)}">Fait</button><button class="btn sm ghost" data-act="oppLater" data-key="${esc(o.key)}">Pas maintenant</button></div></div>`;
}
PAGES.opportunites = {
  title: 'Opportunités',
  render() {
    const mgr = isManager(); const scope = mgr ? (UI.oppScope || 'all') : 'mine';
    const all = oppsFor(CLUB.id, scope); const f = UI.oppType || 'all'; const L = all.filter(o => f === 'all' || o.type === f);
    const top = L.slice(0, 12); const tot = top.reduce((s, o) => s + o.eurosAttendus, 0);
    const done = oppsDoneToday(CLUB.id, mgr && scope === 'all' ? null : ME.id); const doneE = done.reduce((s, x) => s + (Number(x.euros) || 0), 0);
    const counts = {}; all.forEach(o => { counts[o.type] = (counts[o.type] || 0) + 1; });
    const hasData = clubClients(CLUB.id).length || prospectsOf(CLUB.id).length;
    if (!hasData) return `<div class="page-head"><div><h1>Opportunités</h1></div></div><div class="card">${emptyBox({ art: 'target', title: 'Rien à classer pour l’instant', text: 'Déposez dans Imports > Resamania : Vente d’abonnements, Clients club, Clients en incident, Prospects, Résiliations et Évolution clients. Les actions les plus rentables apparaîtront ici, classées en euros.' })}</div>`;
    return `<div class="page-head"><div><h1>Opportunités</h1><p>Les actions qui rapportent le plus, classées par euros attendus.</p></div><span class="spacer"></span><button class="btn" data-act="guestNew">${ico('plus')} Invité</button></div>
      <div class="opp-hero"><b>Aujourd’hui, ${fmtE(tot)} attendus si vous traitez ces ${plur(top.length, 'action', 'actions')}.</b>${palierManque()}</div>
      <div class="row wrap" style="gap:8px;margin:12px 0">${mgr ? seg('oppScope', [['all', 'Tout le club'], ['mine', 'Les miennes']], scope) : ''}<select class="input sm" style="width:auto" data-change="oppType"><option value="all">Tous les types · ${all.length}</option>${Object.entries(OPP_TYPES).filter(([k]) => counts[k]).map(([k, T]) => `<option value="${k}" ${f === k ? 'selected' : ''}>${T.label} · ${counts[k]}</option>`).join('')}</select></div>
      <div class="card opp-list">${L.length ? L.slice(0, UI.oppAll ? 200 : 25).map(o => oppRow(o, mgr)).join('') : emptyBox({ art: 'done', title: 'Tout est traité', text: 'Aucune opportunité ouverte pour ce filtre.' })}
      ${L.length > 25 && !UI.oppAll ? `<button class="btn sm" style="margin-top:10px" data-act="ui" data-key="oppAll" data-val="1">Voir les ${L.length - 25} suivantes</button>` : ''}</div>
      <p class="opp-foot">Réalisé aujourd’hui : <b>${plur(done.length, 'action', 'actions')}</b>, <b>${fmtE(doneE)}</b> sécurisés.</p>
      <p class="muted small">Probabilités : résiliation au taux de sauvetage des 3 derniers mois (${fmtP(tauxSauvetage(CLUB.id))}), impayé selon l’âge (70 %, 50 %, 30 %, 10 %), prospect au taux de transformation du commercial, invité 35 %, fin d’engagement 15 %, montée en gamme 5 %, boutique 20 %, ancien membre 4 %, sans mandat 50 %.</p>`;
  },
};
ACTIONS.oppType = el => { UI.oppType = el.value; UI.oppAll = null; render(); };
const oppFind = key => opportunites(CLUB.id).find(o => o.key === key);
const oppPath = key => ['opps', safeKey(key)];
ACTIONS.oppTake = el => oppClaim(el.dataset.key, ME.id);
ACTIONS.oppAssign = el => oppClaim(el.dataset.key, el.value || null);
function oppClaim(key, uid) {
  const o = oppFind(key); if (!o) return;
  if (o.type === 'resiliation') db.set(['resiliations', key.slice(4), 'ownerId'], uid);
  else if (o.type === 'impaye') db.set(['clients', key.slice(4), 'dunning', 'ownerId'], uid);
  else db.batch([[[...oppPath(key), 'ownerId'], uid], [[...oppPath(key), 'clubId'], CLUB.id]]);
  toast(uid === ME.id ? 'C’est noté, à vous de jouer' : 'Attribué');
}
ACTIONS.oppDone = el => {
  const o = oppFind(el.dataset.key); if (!o) return; const ops = [[oppPath(o.key), { ...oppState(o.key), clubId: CLUB.id, doneAt: Date.now(), doneBy: ME.id, euros: o.eurosAttendus, type: o.type }]];
  if (o.clientId) { const id = newId(); ops.push([['touches', id], { id, clubId: CLUB.id, clientId: o.clientId, at: Date.now(), by: ME.id, channel: 'note', outcome: 'ok', note: `Opportunité traitée : ${o.titre}` }]); }
  db.batch(ops); celebrate('Action faite', `${fmtE(o.eurosAttendus)} sécurisés`, { kind: 'win' });
};
ACTIONS.oppLater = el => { const k = el.dataset.key; db.batch([[[...oppPath(k), 'snoozeUntil'], Date.now() + 3 * 864e5], [[...oppPath(k), 'clubId'], CLUB.id]]); toast('Masquée 3 jours'); };
// Accueil : les 5 premières opportunités de l'utilisateur.
function oppHomeList(n = 5) {
  const L = oppsFor(CLUB.id, 'mine').slice(0, n);
  if (!L.length) return todoList(3);
  return `<div class="opp-home">${L.map(o => `<a class="row opp-mini" href="#/opportunites"><span class="opp-ico">${ico(OPP_TYPES[o.type].icon)}</span><span class="spacer"><b>${esc(o.titre)}</b><span class="muted small">${esc(o.client || '')}</span></span><b>${fmtE(o.eurosAttendus)}</b></a>`).join('')}</div>`;
}
// « Il manque X pour le prochain palier » (repris de la prévision).
function palierManque() {
  const mk = curMonth(); const k = Object.keys(paliersFor(CLUB.id, mk))[0]; if (!k) return '';
  const s = palierState(CLUB.id, mk, k); if (!s || !s.next) return '';
  return `<span>Il manque ${fmtV(Math.ceil(s.next.target - s.real), S.kpis[k].unit)} ${S.kpis[k].label.toLowerCase()} pour le palier ${s.reached + 1}.</span>`;
}

// ── Impayés : vitesse de récupération ─────────────────────────────────────
function dunSpeed(mk) {
  const r = rangeOf('month', mk); const L = recovList(CLUB.id, r.from, r.to).filter(x => x.incidentDate);
  const byC = {}; L.forEach(x => { (byC[x.canal] = byC[x.canal] || []).push(Math.max(0, dayDiff(x.incidentDate, x.date))); });
  const six = recovList(CLUB.id, addMonths(mk, -5) + '-01', r.to).filter(x => x.incidentDate); const tot6 = six.reduce((s, x) => s + x.amount, 0);
  const curve = [7, 15, 30, 60].map(j => ({ j, p: tot6 ? six.filter(x => dayDiff(x.incidentDate, x.date) <= j).reduce((s, x) => s + x.amount, 0) / tot6 : null }));
  const mins = Number((S.clubs[CLUB.id] || {}).minutesAppel) || 4;
  const relances = clubClients(CLUB.id).reduce((n, c) => n + ((dunOf(c).history || []).filter(h => h.at >= dateOf(r.from).getTime() && h.at < dateOf(r.to).getTime() + 864e5 && !/^Statut|^Responsable|^Prise en charge/.test(h.label || '')).length), 0);
  const team = recovList(CLUB.id, r.from, r.to).filter(x => x.canal === 'equipe').reduce((s, x) => s + x.amount, 0);
  const heures = relances * mins / 60;
  return `<div class="card" style="margin-top:14px"><h3>Vitesse de récupération</h3>
    ${L.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Canal</th><th class="num">Régularisations</th><th class="num">Délai médian</th></tr></thead><tbody>${Object.entries(byC).map(([k, d]) => `<tr><td>${esc((RECOV_CHANNELS[k] || {}).label || k)}</td><td class="num">${d.length}</td><td class="num">${plur(Math.round(median(d.map(x => x || 0.5)) || 0), 'jour', 'jours')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">Délai inconnu : réimportez la liste Incidents (la date de l’incident est maintenant gardée).</p>'}
    <div class="row wrap" style="gap:10px;margin-top:12px">${curve.map(x => `<div class="stat"><span>Récupéré à J+${x.j}</span><b>${fmtP(x.p)}</b><small>des euros, 6 derniers mois</small></div>`).join('')}</div>
    <p class="small" style="margin:12px 0 4px">${relances ? `1 relance = <b>${fmtE(team / relances)}</b> récupérés en moyenne · <b>${fmtE(heures ? team / heures : 0)}</b> par heure d’appel` : 'Aucune relance notée ce mois-ci.'}</p>
    <label class="row small" style="gap:8px">Minutes par appel <input class="input sm" style="width:70px" type="number" min="1" max="30" value="${mins}" data-change="minutesAppel" ${isManager() ? '' : 'disabled'}></label></div>`;
}
ACTIONS.minutesAppel = el => { const v = Math.max(1, Math.min(30, Number(el.value) || 4)); db.set(['clubs', CLUB.id, 'minutesAppel'], v); };
ACTIONS.clubCfg = el => { const k = el.dataset.k; let v = el.value.trim(); if (k !== 'parrainReward') { const n = parseMontant(v); v = Number.isNaN(n) ? null : el.dataset.pct ? n / 100 : n; } db.set(['clubs', CLUB.id, k], v || null); toast('Enregistré'); };
ACTIONS.dunSmsSet = el => { db.set(['clubs', CLUB.id, 'dunSms'], el.value.trim() || null); toast('Message enregistré'); };

// ── Montée en gamme et anciens membres (onglets d'Action Rétention) ───────
const REV_OUT = { propose: 'Montée proposée', accepte: 'Montée acceptée', appele: 'Appelé', offre: 'Offre de retour envoyée', revenu: 'Revenu au club', refus: 'Pas intéressé' };
const lastRev = (cid, type) => Object.values(S.loyalty || {}).filter(a => a.clientId === cid && a.type === type).sort((a, b) => b.at - a.at)[0] || null;
function upsellTargets(clubId) {
  const up = prixGamme(clubId, 'premium'), ul = prixGamme(clubId, 'ultimate');
  return activeClients(clubId).filter(c => !(Number(c.balance) > 0) && c.start && ageDays(c.start) >= 60 && ageDays(c.start) <= 400 && ['basic', 'premium'].includes(gammeOf(c.offer)))
    .map(c => { const next = gammeOf(c.offer) === 'basic' ? ['Premium', up] : ['Ultimate', ul]; const gap = next[1] ? Math.round((next[1] - mensualite(c)) * 100) / 100 : 0; return { c, vers: next[0], gap, last: lastRev(c.id, 'upsell') }; })
    .filter(x => x.gap > 0 && !(x.last && ['accepte', 'refus'].includes(x.last.outcome))).sort((a, b) => a.c.start.localeCompare(b.c.start));
}
function loyUpsell() {
  const L = upsellTargets(CLUB.id);
  return `<p class="muted small">Adhérents en Basic ou Premium depuis 60 à 400 jours, sans impayé, du plus ancien au plus récent. Gain affiché sur 12 mois.</p>
    ${L.length ? `<div class="card">${L.slice(0, 60).map(x => `<div class="row wrap opp-mini"><span class="opp-ico">${ico('sparkle')}</span><div class="spacer"><b>${esc(x.c.name || '')}</b><div class="muted small">${esc(x.c.offer || '')} depuis le ${dmy(x.c.start)} · vers ${x.vers} : +${fmtE(x.gap)} par mois, ${fmtE(x.gap * 12)} sur 12 mois${x.last ? ' · ' + REV_OUT[x.last.outcome].toLowerCase() + ' ' + ago(x.last.at) : ''}</div></div>${clientPhone(x.c) ? `<a class="btn sm icon" href="tel:${esc(clientPhone(x.c))}">${ico('phone')}</a>` : ''}<button class="btn sm" data-act="revAct" data-c="${x.c.id}" data-t="upsell" data-o="propose">Proposé</button><button class="btn sm primary" data-act="revAct" data-c="${x.c.id}" data-t="upsell" data-o="accepte">Accepté</button><button class="btn sm ghost" data-act="revAct" data-c="${x.c.id}" data-t="upsell" data-o="refus">Pas intéressé</button></div>`).join('')}</div>`
      : `<div class="card">${emptyBox({ art: 'done', title: 'Aucune cible de montée en gamme', text: 'Il faut des offres classées par gamme (Mes clubs > Réglages > Offres et prix) et l’export Vente d’abonnements.' })}</div>`}`;
}
const seasonWindow = (d = today()) => { const md = d.slice(5); return (md >= '12-20' || md <= '01-31') || (md >= '08-20' && md <= '09-30'); };
function loyAnciens() {
  const seg = UI.ancSeg || 'all'; const all = reactivables(CLUB.id); const L = all.filter(x => seg === 'all' || x.seg === seg);
  const n = s => all.filter(x => x.seg === s).length;
  return `${seasonWindow() ? `<div class="alert" style="margin-bottom:12px">${ico('flag')}<div><b>Fenêtre forte : campagne de retour conseillée</b>Fin décembre à fin janvier et fin août à fin septembre, les anciens reviennent plus facilement.</div></div>` : ''}
    <div class="row wrap" style="margin-bottom:10px">${segm('ancSeg', [['all', `Tous ${all.length}`], ['3-6', `3 à 6 mois ${n('3-6')}`], ['6-12', `6 à 12 mois ${n('6-12')}`], ['12-24', `12 à 24 mois ${n('12-24')}`]], seg)}<span class="spacer"></span><button class="btn sm" data-act="ancCsv">${ico('download')} CSV du segment</button></div>
    ${L.length ? `<div class="card">${L.slice(0, 80).map(x => { const last = lastRev(x.c.id, 'reactivation'); return `<div class="row wrap opp-mini"><span class="opp-ico">${ico('repeat')}</span><div class="spacer"><b>${esc(x.c.name || '')}</b><div class="muted small">${esc(x.c.offer || 'offre inconnue')} · ${fmtE(mensualite(x.c))} par mois · sorti le ${dmy(x.c.endDate)}${last ? ' · ' + REV_OUT[last.outcome].toLowerCase() + ' ' + ago(last.at) : ''}</div></div>${clientPhone(x.c) ? `<a class="btn sm icon" href="tel:${esc(clientPhone(x.c))}">${ico('phone')}</a>` : ''}${['appele', 'offre', 'revenu', 'refus'].map(o => `<button class="btn sm ${o === 'revenu' ? 'primary' : o === 'refus' ? 'ghost' : ''}" data-act="revAct" data-c="${x.c.id}" data-t="reactivation" data-o="${o}">${{ appele: 'Appelé', offre: 'Offre envoyée', revenu: 'Revenu', refus: 'Pas intéressé' }[o]}</button>`).join('')}</div>`; }).join('')}</div>`
      : `<div class="card">${emptyBox({ art: 'done', title: 'Aucun ancien membre à recontacter', text: 'Déposez l’export Évolution clients (detail-perte) : chaque sortant devient une fiche, à recontacter 3 à 24 mois après sa sortie.' })}</div>`}`;
}
const segm = (k, o, cur) => seg(k, o, cur);
ACTIONS.revAct = el => {
  const id = newId(); const c = S.clients[el.dataset.c]; const ops = [[['loyalty', id], { id, clientId: c.id, type: el.dataset.t, outcome: el.dataset.o, userId: ME.id, at: Date.now() }]];
  if (el.dataset.o === 'refus' && el.dataset.t === 'reactivation') ops.push([['clients', c.id, 'noReactivation'], true]);
  db.batch(ops); toast(REV_OUT[el.dataset.o]);
  if (el.dataset.o === 'accepte' || el.dataset.o === 'revenu') celebrate(REV_OUT[el.dataset.o], c.name || '', { kind: 'win' });
};
ACTIONS.ancCsv = () => {
  const seg0 = UI.ancSeg || 'all'; const L = reactivables(CLUB.id).filter(x => seg0 === 'all' || x.seg === seg0);
  downloadFile(`fitpulse-anciens-${seg0}-${today()}-CONFIDENTIEL.csv`, toCsv(['Nom', 'Téléphone', 'E-mail', 'Ancienne offre', 'Date de sortie'], L.map(x => [x.c.name || '', clientPhone(x.c) || '', x.c.email || '', x.c.offer || '', x.c.endDate ? dmy(x.c.endDate) : ''])), 'text/csv;charset=utf-8');
  db.set(['audit', newId()], { at: Date.now(), by: ME.id, action: 'export_csv', club: CLUB.id, type: 'anciens', lignes: L.length });
};
// Revenus des anciens : retour constaté (contrat importé) dans les 90 jours suivant la première action.
function anciensRevenus(clubId, mk) {
  return clubClients(clubId).filter(c => c.returnedAt && c.returnedAt.slice(0, 7) === mk).map(c => { const first = Object.values(S.loyalty || {}).filter(a => a.clientId === c.id && a.type === 'reactivation').sort((a, b) => a.at - b.at)[0]; return { c, suivi: !!first && dateOf(c.returnedAt) - first.at <= 90 * 864e5 }; });
}

// ── Boutique : attachement à la signature et à J+15 ───────────────────────
function shopAttach(clubId, mk, userId = null) {
  return memo(`shop|${clubId}|${mk}|${userId}`, () => {
    const r = rangeOf('month', mk); const news = clubClients(clubId).filter(c => c.start && c.start >= r.from && c.start <= r.to && c.num && (!userId || c.sellerId === userId));
    const buys = {}; Object.values(S.entries).forEach(e => { if (e.clientNum && e.clubId === clubId && ['nutrition', 'accessoires'].includes(e.kpiId) && entryCounts(e)) (buys[String(e.clientNum)] = buys[String(e.clientNum)] || []).push(e); });
    const at = c => (buys[String(c.num)] || []); const inWin = (c, a, b) => at(c).some(e => e.date >= addDays(c.start, a) && e.date <= addDays(c.start, b));
    const sig = news.filter(c => inWin(c, 0, 1)).length; const mature = news.filter(c => addDays(c.start, 30) <= today()); const j15 = mature.filter(c => inWin(c, 2, 30)).length;
    const buyers = Object.values(buys).filter(L => L.some(e => e.date >= r.from && e.date <= r.to)); const spent = buyers.reduce((s, L) => s + L.filter(e => e.date >= r.from && e.date <= r.to).reduce((t, e) => t + Number(e.value), 0), 0);
    return { n: news.length, sig: news.length ? sig / news.length : null, j15: mature.length ? j15 / mature.length : null, panier: buyers.length ? spent / buyers.length : null, parActif: activeClients(clubId).length ? spent / activeClients(clubId).length : null, sansNum: !!(deepGet(S, ['rsm', 'flags', clubId, 'factures']) || {}).sansNumClient && !Object.keys(buys).length };
  });
}
function shopCard(mk, userId = null) {
  const s = shopAttach(CLUB.id, mk, userId), c = userId ? shopAttach(CLUB.id, mk, null) : null;
  if (s.sansNum) return `<div class="card"><h3>Boutique et nouveaux adhérents</h3><p class="muted small">Export sans numéro client : utilisez Factures & avoirs (gestion).</p></div>`;
  const line = (l, v, ref) => `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)"><span class="spacer">${l}</span><b>${v}</b>${ref != null ? `<span class="muted small" style="margin-left:8px">club ${ref}</span>` : ''}</div>`;
  return `<div class="card"><h3>Boutique et nouveaux adhérents</h3><p class="muted small">${plur(s.n, 'nouvel adhérent', 'nouveaux adhérents')} ce mois-ci.</p>
    ${(() => { const goal = Number((S.clubs[CLUB.id] || {}).attachTarget) || 0.25; const v = s.sig == null && s.j15 == null ? null : Math.max(s.sig || 0, s.j15 || 0); return `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)"><span class="spacer">Objectif d’attachement nutrition</span><b>${fmtP(goal)}</b>${v != null ? `<span class="tag ${v >= goal ? 'is-ok' : 'is-warn'}" style="margin-left:8px">${v >= goal ? 'atteint' : 'à travailler'}</span>` : ''}</div>`; })()}
    ${line('Achat le jour de la signature', fmtTaux(s.sig), c ? fmtTaux(c.sig) : null)}${line('Achat entre J+2 et J+30', fmtTaux(s.j15), c ? fmtTaux(c.j15) : null)}${line('Panier moyen par acheteur', s.panier == null ? 'n.d.' : fmtE(s.panier), c && c.panier != null ? fmtE(c.panier) : null)}${userId ? '' : line('Boutique par adhérent actif', s.parActif == null ? 'n.d.' : fmtE(s.parActif), null)}</div>`;
}

// ── Parrainage ────────────────────────────────────────────────────────────
function parrainageStats(clubId, mk) {
  const r = rangeOf('month', mk); const news = clubClients(clubId).filter(c => c.start && c.start >= r.from && c.start <= r.to);
  const par = news.filter(isParrainage); const y = addDays(today(), -365);
  const tops = {}; clubClients(clubId).filter(c => c.start >= y).forEach(c => { const p = parrainOf(c); if (p) tops[p] = (tops[p] || 0) + 1; });
  return { n: par.length, part: news.length ? par.length / news.length : null, valeur: Math.round(par.reduce((s, c) => s + mensualite(c) * dureeVieMois(clubId), 0)), tops: Object.entries(tops).filter(([, n]) => n >= 2).map(([id, n]) => ({ c: S.clients[id], n })).filter(x => x.c).sort((a, b) => b.n - a.n) };
}

// ── Bloc « Revenus » du récapitulatif ─────────────────────────────────────
function recapRevenus(mk) {
  const clubId = CLUB.id; const act = activeClients(clubId); const G = ['basic', 'premium', 'ultimate', 'autre'];
  const mix = G.map(g => { const L = act.filter(c => gammeOf(c.offer) === g); return { g, n: L.length, mrr: L.reduce((s, c) => s + mensualite(c), 0) }; });
  const nT = act.length || 1, mT = mix.reduce((s, x) => s + x.mrr, 0) || 1;
  const signed = m => { const r = rangeOf('month', m); return clubClients(clubId).filter(c => c.start && c.start >= r.from && c.start <= r.to); };
  const prem = m => { const L = signed(m); return L.length ? L.filter(c => ['premium', 'ultimate'].includes(gammeOf(c.offer))).length / L.length : null; };
  const r = rangeOf('month', mk); const ups = Object.values(S.entries).filter(e => e.clubId === clubId && e.kpiId === 'upsell' && e.date >= r.from && e.date <= r.to && entryCounts(e));
  const sellers = {}; signed(mk).forEach(c => { if (!c.sellerId) return; const o = sellers[c.sellerId] = sellers[c.sellerId] || { n: 0, p: 0 }; o.n++; if (['premium', 'ultimate'].includes(gammeOf(c.offer))) o.p++; });
  const anc = anciensRevenus(clubId, mk); const par = parrainageStats(clubId, mk); const reward = (S.clubs[clubId] || {}).parrainReward;
  const b2b = act.filter(c => c.company); const mrrB2b = b2b.reduce((s, c) => s + mensualite(c), 0);
  return `<div class="g12" style="margin-top:18px">
    <div class="card col6"><h3>Mix des abonnements</h3><div class="table-wrap"><table class="t"><thead><tr><th>Gamme</th><th class="num">Adhérents</th><th class="num">Part</th><th class="num">Revenu mensuel</th><th class="num">Part</th></tr></thead><tbody>
      ${mix.map(x => `<tr><td>${{ basic: 'Basic', premium: 'Premium', ultimate: 'Ultimate', autre: 'Autre' }[x.g]}</td><td class="num">${fmtN(x.n)}</td><td class="num">${fmtP(x.n / nT)}</td><td class="num">${fmtE(x.mrr)}</td><td class="num">${fmtP(x.mrr / mT)}</td></tr>`).join('')}</tbody></table></div>
      <p class="small" style="margin:10px 0 0">Premium et plus dans les contrats signés : ${[2, 1, 0].map(i => `${MOIS_C[Number(addMonths(mk, -i).slice(5)) - 1]} <b>${fmtTaux(prem(addMonths(mk, -i)))}</b>`).join(' · ')}</p>
      <p class="small" style="margin:6px 0 0">Montées en gamme : <b>${ups.filter(e => !e.down).length}</b> (${fmtE(ups.reduce((s, e) => s + Number(e.value), 0))} de revenu mensuel en plus) · descentes de gamme : <b>${ups.filter(e => e.down).length}</b></p>
      ${Object.keys(sellers).length ? `<p class="muted small" style="margin:6px 0 0">Par commercial : ${Object.entries(sellers).map(([u, o]) => `${esc((S.users[u] || {}).first || '?')} ${fmtP(o.p / o.n)}`).join(' · ')}</p>` : ''}</div>
    <div class="col6" style="display:grid;gap:18px">${shopCard(mk)}
      <div class="card"><h3>Retours et parrainage</h3>
        <div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)"><span class="spacer">Anciens revenus ce mois</span><b>${anc.length}</b><span class="muted small" style="margin-left:8px">${fmtE(Math.round(anc.reduce((s, x) => s + mensualite(x.c) * dureeVieMois(clubId), 0)))} de valeur vie</span></div>
        <div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)"><span class="spacer">Contrats issus du parrainage</span><b>${par.n}</b><span class="muted small" style="margin-left:8px">${fmtTaux(par.part)} des contrats · ${fmtE(par.valeur)} de valeur vie</span></div>
        <div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)"><span class="spacer">Revenu mensuel B2B</span><b>${fmtE(mrrB2b)}</b><span class="muted small" style="margin-left:8px">${plur(b2b.length, 'adhérent', 'adhérents')} d’entreprise</span></div>
        ${par.tops.length ? `<p class="small" style="margin:8px 0 0"><b>Top parrains</b> (2 contrats ou plus sur 12 mois) : ${par.tops.map(x => `${esc(x.c.name || '')} (${x.n})`).join(', ')}${reward ? `. Récompense à remettre : ${esc(reward)}.` : '.'}</p>` : ''}</div></div>
  </div>`;
}

// ── Entreprises (B2B) ─────────────────────────────────────────────────────
const CO_STATUS = { a_contacter: 'À contacter', contacte: 'Contacté', rdv: 'Rendez-vous', proposition: 'Proposition', signe: 'Signé', perdu: 'Perdu' };
const CO_WEIGHT = { rdv: 0.2, proposition: 0.4 };
const companiesOf = clubId => Object.values(S.companies || {}).filter(c => c && c.clubId === clubId);
function coPotentiel(co) { if (!(Number(co.effectif) > 0)) return null; const cfg = S.clubs[co.clubId] || {}; const taux = Number(cfg.b2bTaux) || 0.08; const prix = Number(cfg.b2bPrix) || prixMoyen(co.clubId); return Math.round(Number(co.effectif) * taux * prix * 12); }
function coMrr(co) { const I = clientIndex(co.clubId); return Math.round((co.nums || []).map(n => I.byNum[String(n)]).filter(c => c && !CLIENT_INACTIF.test(norm(c.status || ''))).reduce((s, c) => s + mensualite(c), 0) * 100) / 100; }
PAGES.b2b = {
  title: 'Entreprises',
  render() {
    const L = companiesOf(CLUB.id); const pond = L.reduce((s, co) => s + (CO_WEIGHT[co.statut] && coPotentiel(co) ? coPotentiel(co) * CO_WEIGHT[co.statut] : 0), 0);
    const clients = L.filter(co => co.statut === 'signe').sort((a, b) => coMrr(b) - coMrr(a));
    const losing = clients.filter(co => { const h = co.hist || {}; const old = h[addMonths(curMonth(), -3)]; return old && (co.nums || []).length < old * 0.8; });
    return `<div class="page-head"><div><h1>Entreprises</h1><p>Conventions d’entreprise : du premier contact à la signature.</p></div><span class="spacer"></span><button class="btn primary" data-act="coEdit">${ico('plus')} Entreprise</button></div>
      <div class="stat-row"><div class="stat"><span>Pipeline pondéré</span><b>${fmtE(Math.round(pond))}</b><small>rendez-vous 20 %, proposition 40 %</small></div><div class="stat"><span>Entreprises clientes</span><b>${clients.length}</b><small>${fmtE(clients.reduce((s, co) => s + coMrr(co), 0))} de revenu mensuel</small></div><div class="stat"><span>En cours</span><b>${L.filter(co => !['signe', 'perdu'].includes(co.statut)).length}</b><small>à faire avancer</small></div></div>
      ${losing.length ? `<div class="alert" style="margin-bottom:12px">${ico('alert')}<div><b>Adhérents en baisse</b>${losing.map(co => esc(co.nom)).join(', ')} : plus de 20 % d’adhérents perdus en 3 mois.</div></div>` : ''}
      <div class="kanban">${Object.entries(CO_STATUS).map(([k, l]) => { const col = L.filter(co => (co.statut || 'a_contacter') === k); return `<div class="kb-col"><div class="kb-h"><b>${l}</b><span class="muted small">${col.length}</span></div>${col.map(co => { const p = coPotentiel(co); return `<button class="kb-card" data-act="coEdit" data-id="${co.id}"><b>${esc(co.nom)}</b><span class="small">${p == null ? 'Effectif inconnu' : `${fmtN(co.effectif)} salariés · potentiel ${fmtE(p)}`}</span>${co.statut === 'signe' ? `<span class="small">${plur((co.nums || []).length || co.adherents || 0, 'adhérent', 'adhérents')} · ${fmtE(coMrr(co))} par mois</span>` : ''}${co.prochaineAction ? `<span class="muted small">Prochaine action : ${dm(co.prochaineAction)}</span>` : ''}${co.ownerId && S.users[co.ownerId] ? `<span class="muted small">${esc(S.users[co.ownerId].first)}</span>` : ''}</button>`; }).join('')}</div>`; }).join('')}</div>
      <p class="muted small">Potentiel = effectif × taux d’adhésion attendu (${fmtP(Number((S.clubs[CLUB.id] || {}).b2bTaux) || 0.08)}) × prix moyen × 12. Les entreprises signées sont créées automatiquement à l’import Factures & avoirs (Société du client).</p>`;
  },
};
ACTIONS.coEdit = el => {
  const co = (el.dataset.id && S.companies[el.dataset.id]) || { statut: 'a_contacter', ownerId: ME.id };
  openModal({ title: co.id ? co.nom : 'Nouvelle entreprise', body: `<form id="cof" class="form-grid"><label class="field full"><span>Nom</span><input class="input" name="nom" value="${esc(co.nom || '')}" required></label>
    <label class="field"><span>Secteur</span><input class="input" name="secteur" value="${esc(co.secteur || '')}"></label><label class="field"><span>Effectif</span><input class="input" name="effectif" inputmode="numeric" value="${co.effectif || ''}"></label>
    <label class="field"><span>Contact</span><input class="input" name="contact" value="${esc(co.contact || '')}"></label><label class="field"><span>Téléphone</span><input class="input" name="tel" type="tel" value="${esc(co.tel || '')}"></label>
    <label class="field"><span>Statut</span><select class="input" name="statut">${Object.entries(CO_STATUS).map(([k, l]) => `<option value="${k}" ${co.statut === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="field"><span>Responsable</span><select class="input" name="ownerId">${clubMembers(CLUB.id).map(u => `<option value="${u.id}" ${co.ownerId === u.id ? 'selected' : ''}>${esc(fullName(u))}</option>`).join('')}</select></label>
    <label class="field"><span>Prochaine action</span><input class="input" type="date" name="prochaineAction" value="${co.prochaineAction || ''}"></label><label class="field"><span>Offre</span><input class="input" name="offre" value="${esc(co.offre || '')}"></label>
    <label class="field full"><span>Notes</span><textarea class="input" name="notes" rows="3">${esc(co.notes || '')}</textarea></label></form>`,
    foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="coSave" data-id="${co.id || ''}">Enregistrer</button>` });
};
ACTIONS.coSave = el => {
  const f = formData($('#cof')); if (!f.nom.trim()) { toast('Indiquez le nom de l’entreprise.'); return; }
  const id = el.dataset.id || 'co' + newId(); const old = S.companies[id] || {}; const eff = parseInt(f.effectif, 10);
  const co = { ...old, id, clubId: CLUB.id, nom: f.nom.trim().slice(0, 100), secteur: f.secteur.trim(), effectif: eff > 0 ? eff : null, contact: f.contact.trim(), tel: phoneE164(f.tel) || f.tel.trim(), statut: f.statut, ownerId: f.ownerId || null, prochaineAction: f.prochaineAction || null, offre: f.offre.trim(), notes: f.notes.trim().slice(0, 2000), at: old.at || Date.now() };
  const ops = [[['companies', id], co]];
  // Une entreprise passée « Signé » dans le mois compte une fois dans le KPI Contrat B2B de son responsable.
  if (f.statut === 'signe' && old.statut !== 'signe' && co.ownerId) { co.signeLe = today(); ops.push([['entries', 'b2b_' + id], { id: 'b2b_' + id, userId: co.ownerId, clubId: CLUB.id, kpiId: 'b2b', date: today(), value: 1, source: 'manual', at: Date.now(), by: ME.id }]); }
  db.batch(ops); closeModal(); toast(f.statut === 'signe' && old.statut !== 'signe' ? 'Entreprise signée' : 'Enregistré');
};
