/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — la journée du directeur ════════════════════════════════════
//  - « Brief du jour » en tête de l'accueil manager : la veille ouvrée, l'objectif
//    du jour, la fraîcheur des imports, trois actions, un texte à copier.
//  - « Ma journée » (#/journee) : six rendez-vous horodatés, chacun ouvrable en
//    un clic ; celui de l'heure est mis en avant, les passés disent « Fait ».
//  - « Clôture du jour » : le point de 18 h par commercial, la projection de fin
//    de mois en jours ouvrés, le message d'équipe à copier.
// Aucun calcul en double : managerCockpit, dunRows, dunDue, resToHandle,
// monthFigures, sumRange, joursOuvres sont réutilisés tels quels.

const journeeNow = () => new Date(); // remplaçable dans les tests
const sansEmoji = s => String(s).replace(/[–—]/g, ',').replace(/\p{Extended_Pictographic}|️|‍/gu, '').replace(/[ \t]+/g, ' ').trim();
const commerciaux = clubId => clubMembers(clubId).filter(u => u && !u.virtual);
const finDuMois = (iso = today()) => iso.slice(0, 8) + pad(daysIn(iso.slice(0, 7)));
const nomJour = iso => { const j = JOURS[dateOf(iso).getDay()]; return j.charAt(0).toUpperCase() + j.slice(1); };
const kpiCourt = (k, v) => k.unit === 'eur' ? `${fmtE(v)} ${k.label.toLowerCase()}` : plur(v, k.label.toLowerCase(), k.label.toLowerCase());

// ── Brief du jour ─────────────────────────────────────────────────────────
const BRIEF_KPIS = ['contrats', 'nutrition', 'accessoires', 'impayes'];
const FRAICHEUR = [
  { cle: 'ventes', label: 'Ventes', defs: ['ventes'], types: ['kpi'] },
  { cle: 'incidents', label: 'Impayés', defs: ['incidents', 'clients-incident'], types: ['soldes'] },
  { cle: 'clients', label: 'Clients', defs: ['clients', 'abonnements'], types: ['clients'] },
];
// Dernier import actif d'une famille (S.imports et S.rsm.routine), en jours.
function fraicheur(clubId, t = today()) {
  const routine = deepGet(S, ['rsm', 'routine', clubId]) || {};
  return FRAICHEUR.map(f => {
    const ts = [...f.defs.map(d => Number(routine[d]) || 0), ...Object.values(S.imports || {}).filter(i => i && i.clubId === clubId && i.active !== false && (f.defs.includes(i.defId) || f.types.includes(i.type))).map(i => Number(i.at) || 0)];
    const at = Math.max(0, ...ts); const jours = at ? Math.max(0, Math.round((dateOf(t) - dateOf(isoOf(new Date(at)))) / 864e5)) : null;
    return { ...f, at: at || null, jours, niveau: jours == null || jours > 15 ? 'rouge' : jours > 8 ? 'orange' : 'ok' };
  });
}
function briefJour(clubId, t = today()) {
  const veille = veilleOuvree(t); const libVeille = veille === addDays(t, -1) ? 'Hier' : nomJour(veille);
  const kpis = BRIEF_KPIS.map(id => S.kpis[id]).filter(k => k && k.enabled !== false);
  const equipe = commerciaux(clubId);
  const hier = kpis.map(k => ({ k, total: sumRange(clubId, null, k.id, veille, veille), parCommercial: equipe.map(u => ({ u, v: sumRange(clubId, u.id, k.id, veille, veille) })).filter(x => x.v) }));
  // Objectif du jour : (objectif club du mois moins réalisé) / jours ouvrés restants, aujourd'hui compris.
  const mk = t.slice(0, 7); const restants = Math.max(1, joursOuvres(t, finDuMois(t)));
  const objectif = kpiList().filter(k => k.required).map(k => {
    const cible = clubMonthTarget(mk, clubId, k.id); const fait = sumRange(clubId, null, k.id, mk + '-01', addDays(t, -1)); const reste = Math.max(0, cible - fait);
    return { k, cible, fait, parJour: cible ? (k.unit === 'eur' ? Math.ceil(reste / restants) : Math.ceil(reste / restants)) : null };
  }).filter(x => x.cible > 0);
  // Trois actions
  const res = resToHandle(clubId).slice().sort((a, b) => (a.effective || '9999').localeCompare(b.effective || '9999') || resValeur(b) - resValeur(a))[0] || null;
  const dun = dunRows(clubId).filter(c => Number(c.balance) > 0 && !dunOf(c).ownerId && dunStatus(c) !== 'perdu').sort((a, b) => Number(b.balance) - Number(a.balance))[0] || null;
  const r = rangeOf('month', mk);
  const retard = equipe.map(u => { const st = statsFor(clubId, u.id, r, { requiredOnly: true }); return { u, ratio: st.progress != null && st.expected ? st.progress / st.expected : null, ecart: st.progress != null ? st.expected - st.progress : null }; })
    .filter(x => x.ratio != null && x.ratio < 1).sort((a, b) => a.ratio - b.ratio)[0] || null;
  return { veille, libVeille, hier, objectif, restants, fraicheur: fraicheur(clubId, t), actions: { res, dun, retard } };
}
function briefTexte(B, clubName) {
  const hier = B.hier.map(x => kpiCourt(x.k, x.total)).join(', ');
  const obj = B.objectif.map(x => kpiCourt(x.k, x.parJour)).join(', ');
  const a = B.actions; const L = [
    `Brief du ${dayLabel(today())}, ${clubName}`,
    `${B.libVeille} (${dm(B.veille)}) : ${hier || 'aucune saisie'}`,
    `Objectif du jour : ${obj || 'pas d’objectif fixé'}`,
    a.res ? `Résiliation : ${a.res.client}${a.res.effective ? ', échéance le ' + dm(a.res.effective) : ''}, ${fmtE(resValeur(a.res))} en jeu` : '',
    a.dun ? `Impayé sans responsable : ${a.dun.name}, ${fmtE(Number(a.dun.balance))}` : '',
    a.retard ? `À accompagner : ${a.retard.u.first}, ${fmtP(a.retard.ratio)} du rythme` : '',
  ].filter(Boolean).slice(0, 6);
  return L.map(sansEmoji).join('\n');
}
function briefDuJourCard() {
  if (!isManager()) return '';
  const B = briefJour(CLUB.id); const a = B.actions;
  const col = n => n === 'rouge' ? 'var(--bad)' : n === 'orange' ? 'var(--warn)' : 'var(--ok)';
  return `<div class="card brief-jour" id="brief-jour"><div class="race-h"><div><div class="eyebrow">${esc(dayLabel(today()))}</div><h3>Brief du jour</h3></div><span class="spacer"></span><button class="btn sm primary" data-act="briefJourCopier">${ico('copy')} Copier pour le groupe WhatsApp</button></div>
    <div class="bj-grid">
      <div class="bj-bloc" data-bloc="hier"><h4 data-veille="${B.veille}">${esc(B.libVeille)} <span class="muted small">${esc(dm(B.veille))}</span></h4>
        ${B.hier.map(x => `<div class="row small" data-k="${x.k.id}" data-total="${x.total}"><span class="spacer">${esc(x.k.label)}</span><b>${fmtV(x.total, x.k.unit)}</b></div>${x.parCommercial.length ? `<div class="muted small bj-det">${x.parCommercial.map(p => `${esc(p.u.first)} ${fmtV(p.v, x.k.unit)}`).join(', ')}</div>` : ''}`).join('') || '<p class="muted small">Aucun KPI suivi.</p>'}</div>
      <div class="bj-bloc" data-bloc="objectif"><h4>Objectif du jour <span class="muted small">${plur(B.restants, 'jour ouvré restant', 'jours ouvrés restants')}</span></h4>
        ${B.objectif.map(x => `<div class="row small" data-k="${x.k.id}"><span class="spacer">${esc(x.k.label)}</span><b>${fmtV(x.parJour, x.k.unit)}</b></div>`).join('') || '<p class="muted small">Aucun objectif fixé ce mois-ci.</p>'}</div>
      <div class="bj-bloc" data-bloc="fraicheur"><h4>Fraîcheur des données</h4>
        ${B.fraicheur.map(f => `<div class="row small" data-famille="${f.cle}" data-niveau="${f.niveau}"><i class="hdot" style="background:${col(f.niveau)}"></i><span class="spacer">${f.label}</span><b style="color:${f.niveau === 'ok' ? 'inherit' : col(f.niveau)}">${f.at ? `${dm(isoOf(new Date(f.at)))}, il y a ${plur(f.jours, 'jour', 'jours')}` : 'aucun import'}</b></div>`).join('')}
        <a class="small" href="#/imports">Déposer les exports</a></div>
      <div class="bj-bloc" data-bloc="actions"><h4>Trois actions ce matin</h4><ol class="bj-actions">
        <li>${a.res ? `<a href="#/resiliations">Résiliation de ${esc(a.res.client)}</a> <span class="muted small">${a.res.effective ? 'échéance ' + esc(dm(a.res.effective)) + ' · ' : ''}${fmtE(resValeur(a.res))} en jeu</span>` : '<span class="muted">Aucune résiliation à traiter</span>'}</li>
        <li>${a.dun ? `<a href="#/client/${esc(a.dun.id)}">Impayé de ${esc(a.dun.name || 'Sans nom')}</a> <span class="muted small">${fmtE(Number(a.dun.balance))}, sans responsable</span>` : '<span class="muted">Chaque impayé a un responsable</span>'}</li>
        <li>${a.retard ? `<a href="#/coaching/${esc(a.retard.u.id)}">Point avec ${esc(fullName(a.retard.u))}</a> <span class="muted small">${fmtP(a.retard.ratio)} du rythme attendu</span>` : '<span class="muted">Toute l’équipe est dans le rythme</span>'}</li></ol></div>
    </div></div>`;
}
async function copierTexte(t, ok) {
  try { await navigator.clipboard.writeText(t); toast(ok); } catch (e) { openModal({ title: 'Texte à copier', body: `<textarea class="input" rows="7" readonly onclick="this.select()">${esc(t)}</textarea>`, foot: '<button class="btn" data-close>Fermer</button>' }); }
}
ACTIONS.briefJourCopier = () => { journeeMarque('brief'); copierTexte(briefTexte(briefJour(CLUB.id), CLUB.name), 'Brief copié'); };

// ── Ma journée ────────────────────────────────────────────────────────────
const journeeFait = () => deepGet(S, ['prefs', ME.id, 'journee', today()]) || {};
function journeeMarque(cle) {
  if (journeeFait()[cle]) return;
  const tout = deepGet(S, ['prefs', ME.id, 'journee']) || {}; const garde = Object.keys(tout).filter(d => d >= addDays(today(), -6));
  const ops = Object.keys(tout).filter(d => !garde.includes(d)).map(d => [['prefs', ME.id, 'journee', d], null]);
  ops.push([['prefs', ME.id, 'journee', today(), cle], Date.now()]); db.batch(ops);
}
function journeeBlocs(clubId, now = journeeNow()) {
  const t = today(); const jour = now.getDay(); const quantieme = now.getDate(); const h = now.getHours() + now.getMinutes() / 60;
  const hB = Number(reglage('heureBrief', 8)) || 8, hS = Number(reglage('heureBilan', 18)) || 18;
  const B = briefJour(clubId, t); const contratsHier = (B.hier.find(x => x.k.id === 'contrats') || {}).total || 0;
  const dun = dunRows(clubId).filter(c => Number(c.balance) > 0); const dus = dun.filter(dunDue);
  const res = resToHandle(clubId); const urg = res.filter(resUrgent).length; const enJeu = res.reduce((s, r) => s + resValeur(r), 0);
  const saisies = Object.values(S.entries).filter(e => e.clubId === clubId && e.date === t && e.source === 'manual' && entryCounts(e));
  const silencieux = sansSaisie(clubId, t);
  const blocs = [
    { cle: 'brief', titre: `Brief ${hB} h`, de: 0, a: 11, chiffre: fmtN(contratsHier), unite: plur(contratsHier, 'contrat', 'contrats', false) + ' ' + (B.libVeille === 'Hier' ? 'hier' : 'le ' + B.libVeille.toLowerCase()),
      phrase: `Objectif du jour : ${B.objectif.map(x => kpiCourt(x.k, x.parJour)).join(', ') || 'pas d’objectif fixé'}.`, href: '#/home', bouton: 'Ouvrir le brief' },
    { cle: 'impayes', titre: 'Impayés 11 h', de: 11, a: 14, chiffre: fmtN(dus.length), unite: plur(dus.length, 'dossier à relancer', 'dossiers à relancer', false),
      phrase: `${fmtE(dun.reduce((s, c) => s + Number(c.balance), 0))} dus au total, ${plur(dun.filter(c => !dunOf(c).ownerId).length, 'dossier', 'dossiers')} sans responsable.`, href: '#/impayes', bouton: 'Relancer les impayés' },
    { cle: 'resiliations', titre: 'Résiliations 14 h', de: 14, a: hS, chiffre: fmtN(res.length), unite: plur(res.length, 'demande à arbitrer', 'demandes à arbitrer', false),
      phrase: `${fmtE(enJeu)} en jeu, ${plur(urg, 'échéance', 'échéances')} sous 7 jours.`, href: '#/resiliations', bouton: 'Traiter les résiliations' },
    { cle: 'bilan', titre: `Bilan ${hS} h`, de: hS, a: 24, chiffre: fmtN(saisies.length), unite: plur(saisies.length, 'saisie aujourd’hui', 'saisies aujourd’hui', false),
      phrase: silencieux.length ? `Sans saisie : ${silencieux.slice(0, 3).map(u => u.first).join(', ')}${silencieux.length > 3 ? ` et ${silencieux.length - 3} autres` : ''}.` : 'Toute l’équipe présente a saisi.', act: 'clotureJour', bouton: TXT.cloture.bouton },
  ];
  if (jour === 1) { const rt = routineSemaine(clubId); blocs.push({ cle: 'routine', titre: 'Routine du lundi', chiffre: `${rt.recus} sur ${rt.total}`, unite: 'exports reçus', phrase: rt.manquants.length ? `Manquent : ${rt.manquants.slice(0, 3).join(', ')}${rt.manquants.length > 3 ? '…' : ''}.` : 'Tous les exports de la semaine sont là.', href: '#/imports', bouton: 'Déposer les exports' }); }
  if (quantieme <= 5) { const pm = addMonths(t.slice(0, 7), -1); const F = monthFigures(clubId, pm); blocs.push({ cle: 'mois', titre: 'Clôture du mois', chiffre: fmtN(F.contrats), unite: `contrats en ${MOIS[Number(pm.slice(5)) - 1].toLowerCase()}`, phrase: `Récapitulatif prêt : ${plur(F.resiliees, 'résiliation', 'résiliations')}, ${plur(F.sauvees, 'sauvetage', 'sauvetages')}. À envoyer avant le 5.`, href: '#/recap', bouton: 'Ouvrir le récap' }); }
  const fait = journeeFait();
  return blocs.map(b => ({ ...b, courant: b.de != null && h >= b.de && h < b.a, passe: b.a != null && h >= b.a, fait: !!fait[b.cle] }));
}
// Sans saisie aujourd'hui : membres présents (les absents du jour ne comptent pas).
function sansSaisie(clubId, t = today()) {
  return commerciaux(clubId).filter(u => !deepGet(S, ['absences', u.id, t]) && !Object.values(S.entries).some(e => e.userId === u.id && e.date === t && e.source === 'manual'));
}
PAGES.journee = {
  title: 'Ma journée',
  manager: true,
  render() {
    const blocs = journeeBlocs(CLUB.id);
    return `<div class="page-head"><div><h1>Ma journée</h1><p>${esc(nomAffiche())} · ${esc(dayLabel(today()))}. Six rendez-vous, un clic chacun.</p></div></div>
      ${typeof rapporteCompteur === 'function' ? rapporteCompteur(CLUB.id) : ''}
      <div class="journee">${blocs.map(b => `<div class="card jr-bloc${b.courant ? ' courant' : ''}${b.passe ? ' passe' : ''}" data-bloc="${b.cle}">
        <div class="row"><b class="jr-t">${esc(b.titre)}</b><span class="spacer"></span>${b.courant ? '<span class="badge ok">Maintenant</span>' : ''}${b.fait ? `<span class="badge ok" data-fait="1">${ico('check', 'ico ico-xs')} Fait</span>` : b.passe ? '<span class="badge">Pas ouvert</span>' : ''}</div>
        <div class="jr-n"><b data-chiffre="${esc(String(b.chiffre))}">${esc(String(b.chiffre))}</b> <span>${esc(b.unite)}</span></div>
        <p class="muted small">${esc(b.phrase)}</p>
        <button class="btn sm ${b.courant ? 'primary' : ''}" data-act="journeeOuvrir" data-cle="${b.cle}" ${b.href ? `data-href="${b.href}"` : ''} ${b.act ? `data-go="${b.act}"` : ''}>${esc(b.bouton)} ${ico('chevR')}</button></div>`).join('')}</div>`;
  },
};
ACTIONS.journeeOuvrir = el => {
  journeeMarque(el.dataset.cle);
  if (el.dataset.cle === 'routine') UI.impTab = 'rsm';
  if (el.dataset.go && ACTIONS[el.dataset.go]) ACTIONS[el.dataset.go](el); else if (el.dataset.href) location.hash = el.dataset.href;
};

// ── Clôture du jour (le point de 18 h) ────────────────────────────────────
// Projection de fin de mois : réalisé / jours ouvrés écoulés x jours ouvrés du mois.
function projectionMois(clubId, mk, t = today()) {
  const from = mk + '-01', fin = `${mk}-${pad(daysIn(mk))}`; const ecoules = Math.max(1, joursOuvres(from, t < fin ? t : fin)); const total = joursOuvres(from, fin);
  return kpiList().filter(k => k.required).map(k => {
    const fait = sumRange(clubId, null, k.id, from, t); const cible = clubMonthTarget(mk, clubId, k.id);
    const proj = k.unit === 'eur' ? Math.round(fait / ecoules * total) : Math.round(fait / ecoules * total * 10) / 10;
    const ratio = cible ? proj / cible : null;
    const verdict = cible ? (ratio >= 1 ? 'Atteint' : ratio >= 0.9 ? 'Juste' : `Manque ${fmtV(k.unit === 'eur' ? Math.ceil(cible - proj) : Math.ceil(cible - proj), k.unit)}`) : 'Sans objectif';
    return { k, fait, cible, proj, ratio, verdict, ecoules, total };
  });
}
function clotureLignes(clubId, t = today()) {
  const kpis = kpiList().filter(k => k.enabled !== false);
  return commerciaux(clubId).map(u => {
    const absent = !!deepGet(S, ['absences', u.id, t]);
    const saisies = kpis.map(k => ({ k, v: Object.values(S.entries).filter(e => e.userId === u.id && e.clubId === clubId && e.kpiId === k.id && e.date === t && e.source === 'manual' && entryCounts(e)).reduce((s, e) => s + Number(e.value || 0), 0) })).filter(x => x.v);
    const relances = Object.values(S.loyalty || {}).filter(l => l.userId === u.id && l.at && isoOf(new Date(l.at)) === t).length;
    const impayes = dunRows(clubId).filter(c => (dunOf(c).history || []).some(h => h.by === u.id && h.label === 'Prise en charge' && isoOf(new Date(h.at)) === t)).length;
    const resil = resList(clubId).filter(r => resActions(r).some(a => a.by === u.id && a.at && isoOf(new Date(a.at)) === t)).length;
    const n = Object.values(S.entries).filter(e => e.userId === u.id && e.date === t && e.source === 'manual').length;
    return { u, absent, saisies, relances, impayes, resil, contribution: n + relances + impayes + resil };
  });
}
function clotureTexte(clubId, t = today()) {
  const L = clotureLignes(clubId, t).filter(x => !x.absent); const top = L.slice().sort((a, b) => b.contribution - a.contribution)[0];
  const P = projectionMois(clubId, t.slice(0, 7), t).filter(p => p.cible);
  const tot = kpiList().filter(k => k.enabled !== false).map(k => ({ k, v: sumRange(clubId, null, k.id, t, t) })).filter(x => x.v);
  const lignes = [
    `Merci à toute l’équipe pour ce ${dayLabel(t)}.`,
    top && top.contribution ? remplirMessage(reglage('messageEquipe', MSG_DEFAUTS.messageEquipe), { prenom: top.u.first, club: S.clubs[clubId] ? S.clubs[clubId].name : '', montant: '' }) : 'Demain, chaque saisie compte.',
    tot.length ? `Aujourd’hui : ${tot.map(x => kpiCourt(x.k, x.v)).join(', ')}.` : '',
    P.length ? `Projection du mois : ${P.map(p => `${p.k.label.toLowerCase()} ${p.verdict === 'Atteint' ? 'atteint' : p.verdict === 'Juste' ? 'juste' : p.verdict.toLowerCase()}`).join(', ')}.` : '',
    'On garde le rythme demain.',
  ].filter(Boolean).slice(0, 5);
  return lignes.map(sansEmoji).join('\n');
}
function clotureBody(clubId, t = today()) {
  const L = clotureLignes(clubId, t); const P = projectionMois(clubId, t.slice(0, 7), t);
  return `<div class="table-wrap"><table class="t cloture"><thead><tr><th>Commercial</th><th>Saisies du jour</th><th class="num">Relances</th><th class="num">Impayés pris</th><th class="num">Résiliations</th><th>Absent</th></tr></thead><tbody>
    ${L.map(x => `<tr data-u="${x.u.id}" class="${x.absent ? 'muted' : ''}"><td class="nowrap"><b>${esc(fullName(x.u))}</b></td><td class="small">${x.absent ? 'Absent' : x.saisies.map(s => `${esc(s.k.label)} ${fmtV(s.v, s.k.unit)}`).join(', ') || '<span class="muted">aucune</span>'}</td><td class="num">${x.relances}</td><td class="num">${x.impayes}</td><td class="num">${x.resil}</td>
      <td><label class="chk"><input type="checkbox" data-change="absentJour" data-u="${x.u.id}" ${x.absent ? 'checked' : ''}> Absent</label></td></tr>`).join('')}</tbody></table></div>
    <h3 style="margin-top:14px">Projection de fin de mois</h3><p class="muted small" style="margin-top:-6px">Réalisé divisé par ${plur(P[0] ? P[0].ecoules : 0, 'jour ouvré écoulé', 'jours ouvrés écoulés')}, multiplié par les ${P[0] ? P[0].total : 0} jours ouvrés du mois.</p>
    <div class="table-wrap"><table class="t"><thead><tr><th>KPI</th><th class="num">Réalisé</th><th class="num">Projection</th><th class="num">Objectif</th><th></th></tr></thead><tbody>
    ${P.map(p => `<tr data-k="${p.k.id}"><td>${esc(p.k.label)}</td><td class="num">${fmtV(p.fait, p.k.unit)}</td><td class="num" data-proj="${p.proj}">${fmtV(p.proj, p.k.unit)}</td><td class="num">${p.cible ? fmtV(p.cible, p.k.unit) : 'n.d.'}</td><td><span class="badge ${p.verdict === 'Atteint' ? 'ok' : p.verdict === 'Juste' ? 'warn' : p.cible ? 'bad' : ''}">${esc(p.verdict)}</span></td></tr>`).join('')}</tbody></table></div>`;
}
ACTIONS.clotureJour = () => {
  journeeMarque('bilan');
  openModal({ title: TXT.cloture.bouton, wide: true, body: `<div id="cloture-b">${clotureBody(CLUB.id)}</div>`, foot: '<button class="btn" data-close>Fermer</button><button class="btn primary" data-act="clotureCopier">Copier le message d’équipe</button>' });
};
ACTIONS.clotureCopier = () => copierTexte(clotureTexte(CLUB.id), 'Message copié');
ACTIONS.absentJour = el => { db.set(['absences', el.dataset.u, today()], el.checked ? true : null); setTimeout(() => { const b = $('#cloture-b'); if (b) b.innerHTML = clotureBody(CLUB.id); }, 0); };
