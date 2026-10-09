/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — adoption par l'équipe ══════════════════════════════════════
//  - Usage léger : S.usage[uid][date] = { opens, pages: { route: n }, lastAt },
//    compté à la connexion et à chaque changement de page, écrit une fois par
//    minute au plus (le reste attend en mémoire).
//  - Onglet « Adoption » (Équipe et paliers) : 4 semaines par membre.
//  - Parcours de démarrage d'un nouveau membre : 4 étapes cochées toutes seules.
//  - Taux d'adoption : membres actifs au moins 4 jours sur 6 cette semaine.

const USAGE_PAS = 60000; // une écriture par minute au plus
const USAGE = { buf: null, last: 0, timer: null, ecritures: 0 };
function usageNote(route, ouverture = false) {
  if (!ME || !S || ME.virtual) return;
  const b = USAGE.buf = USAGE.buf || { opens: 0, pages: {} };
  if (ouverture) b.opens++;
  if (route) b.pages[route] = (b.pages[route] || 0) + 1;
  const attente = USAGE.last + USAGE_PAS - Date.now();
  if (attente <= 0) usageEcrire(); else if (!USAGE.timer) USAGE.timer = setTimeout(usageEcrire, attente);
}
function usageEcrire() {
  clearTimeout(USAGE.timer); USAGE.timer = null; const b = USAGE.buf; if (!b || !ME) return; USAGE.buf = null; USAGE.last = Date.now();
  const d = today(); const cur = deepGet(S, ['usage', ME.id, d]) || {}; const pages = { ...(cur.pages || {}) };
  Object.entries(b.pages).forEach(([r, n]) => { const k = safeKey(r) || 'home'; pages[k] = (pages[k] || 0) + n; });
  USAGE.ecritures++; db.set(['usage', ME.id, d], { opens: (cur.opens || 0) + b.opens, pages, lastAt: Date.now() });
}

// ── Mesures par membre ────────────────────────────────────────────────────
const joursUsage = uid => Object.keys(deepGet(S, ['usage', uid]) || {});
function joursActifs(clubId, uid, from, to) {
  const J = new Set(joursUsage(uid).filter(d => d >= from && d <= to));
  Object.values(S.entries).forEach(e => { if (e.userId === uid && e.clubId === clubId && e.source === 'manual' && e.date >= from && e.date <= to) J.add(e.date); });
  return J;
}
function adoptionSemaine(clubId, uid, lundi) {
  const fin = addDays(lundi, 6); const at = d => isoOf(new Date(d));
  const dans = d => d >= lundi && d <= fin;
  return {
    jours: [...joursActifs(clubId, uid, lundi, addDays(lundi, 5))].length,
    saisies: Object.values(S.entries).filter(e => e.userId === uid && e.clubId === clubId && e.source === 'manual' && dans(e.date)).length,
    relances: Object.values(S.loyalty || {}).filter(l => l.userId === uid && l.at && dans(at(l.at))).length + Object.values(S.touches || {}).filter(x => x.by === uid && x.at && dans(at(x.at))).length,
    impayes: dunRows(clubId).filter(c => (dunOf(c).history || []).some(h => h.by === uid && h.label === 'Prise en charge' && h.at && dans(at(h.at)))).length,
  };
}
const niveauJours = n => n < 3 ? 'rouge' : n < 4 ? 'orange' : 'vert';
function derniereConnexion(uid) { const U = deepGet(S, ['usage', uid]) || {}; return Math.max(0, ...Object.values(U).map(x => Number(x && x.lastAt) || 0)) || null; }
// Taux d'adoption : membres actifs au moins 4 jours sur les 6 (lundi à samedi) de cette semaine.
function tauxAdoption(clubId, t = today()) {
  const L = commerciaux(clubId); if (!L.length) return null; const lundi = weekStart(t);
  const actifs = L.filter(u => joursActifs(clubId, u.id, lundi, addDays(lundi, 5)).size >= 4).length;
  return { actifs, total: L.length, taux: actifs / L.length };
}
function memAdoption() {
  const lundis = [3, 2, 1, 0].map(i => addDays(weekStart(today()), -7 * i));
  const L = commerciaux(CLUB.id); const col = { rouge: 'var(--bad)', orange: 'var(--warn)', vert: 'var(--ok)' };
  return `<div class="card"><div class="card-head"><h3>Adoption sur 4 semaines</h3><span class="spacer"></span>${(() => { const a = tauxAdoption(CLUB.id); return a ? `<span class="badge">${fmtP(a.taux)} d’adoption cette semaine</span>` : ''; })()}</div>
    <div class="table-wrap"><table class="t adoption"><thead><tr><th>Membre</th>${lundis.map(l => `<th class="num">Sem. du ${esc(dm(l))}</th>`).join('')}<th class="num">Saisies</th><th class="num">Relances</th><th class="num">Impayés pris</th><th>Dernière connexion</th></tr></thead><tbody>
    ${L.map(u => { const W = lundis.map(l => adoptionSemaine(CLUB.id, u.id, l)); const dc = derniereConnexion(u.id); const tot = k => W.reduce((s, w) => s + w[k], 0);
      return `<tr data-u="${u.id}"><td class="nowrap"><b>${esc(fullName(u))}</b></td>${W.map(w => `<td class="num" data-jours="${w.jours}" data-niveau="${niveauJours(w.jours)}"><i class="hdot" style="background:${col[niveauJours(w.jours)]}"></i> ${plur(w.jours, 'jour', 'jours')}</td>`).join('')}
        <td class="num">${tot('saisies')}</td><td class="num">${tot('relances')}</td><td class="num">${tot('impayes')}</td><td class="small">${dc ? esc(ago(dc)) : '<span class="muted">jamais</span>'}</td></tr>`; }).join('')}</tbody></table></div>
    <p class="muted small">Jour actif : au moins une ouverture de Fit Pulse ou une saisie ce jour-là, du lundi au samedi. Pastille rouge sous 3 jours actifs dans la semaine, orange à 3, verte à partir de 4.</p></div>`;
}

// ── Parcours de démarrage ─────────────────────────────────────────────────
function parcoursEtapes(uid) {
  const prise = h => h && h.by === uid && h.label === 'Prise en charge';
  return [
    { cle: 'connexion', label: 'Première connexion', fait: joursUsage(uid).length > 0 || (ME && ME.id === uid) },
    { cle: 'saisie', label: 'Première saisie', fait: Object.values(S.entries).some(e => e.userId === uid && e.source === 'manual') },
    { cle: 'relance', label: 'Première relance notée', fait: Object.values(S.loyalty || {}).some(l => l.userId === uid) || Object.values(S.touches || {}).some(x => x.by === uid) },
    { cle: 'prise', label: 'Premier « Je m’en occupe »', fait: Object.values(S.clients || {}).some(c => (dunOf(c).history || []).some(prise)) || Object.values(S.resiliations || {}).some(r => resActions(r).some(prise)) },
  ];
}
function parcoursCard() {
  if (!ME || isManager() || pref('parcoursMasque', false)) return '';
  const E = parcoursEtapes(ME.id); const n = E.filter(e => e.fait).length; if (n === E.length) return '';
  return `<div class="card parcours" data-faites="${n}"><div class="row"><b class="spacer">Bien démarrer : ${n} sur ${E.length}</b><button class="btn ghost sm" data-act="parcoursMasquer">Masquer</button></div>
    <ol class="parcours-l">${E.map(e => `<li class="${e.fait ? 'fait' : ''}" data-etape="${e.cle}">${e.fait ? ico('check', 'ico ico-xs') : '<i class="pc-rond"></i>'} ${esc(e.label)}</li>`).join('')}</ol></div>`;
}
ACTIONS.parcoursMasquer = () => setPref('parcoursMasque', true);
