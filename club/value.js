/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — socle « valeur » : revenu recurrent, valeur adherent, churn en euros ══
// Les abonnements font plus de 90 % du revenu : on les met en euros a partir
// des offres et prix deja importes (Vente d'abonnements : offre, prix TTC).
// Bareme par club : S.offers[clubId][cle] = { libelle, gamme, prixMensuelTTC, fraisInscription }.

const CLIENT_INACTIF = /(ancien|perdu|prospect|exclu|temporaire|resili)/;
const clubClients = clubId => Object.values(S.clients || {}).filter(c => c && c.clubId === clubId);
const activeClients = clubId => clubClients(clubId).filter(c => !CLIENT_INACTIF.test(norm(c.status || '')));
const offerKey = lib => safeKey(norm(lib || '').slice(0, 60)) || 'autre';
const gammeOf = lib => { const n = norm(lib || ''); return /ultimate/.test(n) ? 'ultimate' : /premium/.test(n) ? 'premium' : /basic|base/.test(n) ? 'basic' : 'autre'; };
const median = a => { const b = a.filter(x => x > 0).sort((x, y) => x - y); if (!b.length) return null; const m = Math.floor(b.length / 2); return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };

// Offres vues dans les fiches clients du club, avec un prix propose (mediane des prix importes).
function offersSeen(clubId) {
  const by = {};
  clubClients(clubId).forEach(c => { if (!c.offer) return; const k = offerKey(c.offer); (by[k] = by[k] || { key: k, libelle: c.offer, prices: [], n: 0 }); by[k].n++; if (Number(c.price) > 0) by[k].prices.push(Number(c.price)); });
  return Object.values(by).map(o => ({ ...o, gamme: gammeOf(o.libelle), prix: median(o.prices) })).sort((a, b) => b.n - a.n);
}
function offerOf(client) { const o = deepGet(S, ['offers', client.clubId, offerKey(client.offer)]); return o || null; }
function prixMoyen(clubId) { return memo(`pmoy|${clubId}`, () => { const L = activeClients(clubId).map(c => mensualite(c, true)).filter(x => x > 0); return L.length ? L.reduce((s, x) => s + x, 0) / L.length : 29.99; }); }
// Mensualite : bareme du club, sinon prix importe, sinon prix moyen du club.
function mensualite(client, noFallback = false) {
  const o = offerOf(client); if (o && Number(o.prixMensuelTTC) > 0) return Number(o.prixMensuelTTC);
  if (Number(client.price) > 0) return Number(client.price);
  return noFallback ? 0 : prixMoyen(client.clubId);
}
function mrrClub(clubId) { return Math.round(activeClients(clubId).reduce((s, c) => s + mensualite(c), 0) * 100) / 100; }
// Duree de vie moyenne = 1 / taux de resiliation mensuel moyen (6 derniers mois
// termines), bornee entre 6 et 36 mois ; 14 mois sans donnee.
function dureeVieMois(clubId) {
  return memo(`dvm|${clubId}`, () => {
    if (typeof monthFigures !== 'function') return 14;
    const cm = curMonth(); const taux = [];
    for (let i = 1; i <= 6; i++) { const F = monthFigures(clubId, addMonths(cm, -i)); if (F.tauxResil != null && F.tauxResil > 0) taux.push(F.tauxResil); }
    if (!taux.length) return 14;
    const t = taux.reduce((s, x) => s + x, 0) / taux.length;
    return Math.max(6, Math.min(36, Math.round(1 / t)));
  });
}
const valeurAdherent = client => Math.round(mensualite(client) * dureeVieMois(client.clubId));
// Churn en euros : mensualites des resiliations effectives du mois.
function churnEuros(clubId, mk) {
  if (typeof resList !== 'function') return null;
  const byName = {}; clubClients(clubId).forEach(c => { byName[tokensKey(c.name || '')] = c; });
  return Math.round(resList(clubId).filter(r => resStatus(r) === 'resiliee' && (r.effective || r.date).slice(0, 7) === mk)
    .reduce((s, r) => { const c = byName[tokensKey(r.client || '')]; return s + (c ? mensualite(c) : prixMoyen(clubId)); }, 0));
}
// Encaisse reel (export Paiements, statut valide) ; null si jamais importe.
function encaisseMois(clubId, mk) {
  const p = deepGet(S, ['rsm', 'controls', clubId, 'payments']); if (!p) return null;
  let s = 0, seen = false; Object.entries(p).forEach(([d, byM]) => { if (d.slice(0, 7) !== mk) return; seen = true; Object.values(byM || {}).forEach(v => { s += Number(v) || 0; }); });
  return seen ? Math.round(s * 100) / 100 : null;
}
// Valeur en jeu d'une demande de resiliation : mensualite x mois restants.
function valeurEnJeu(r) {
  const c = clubClients(r.clubId).find(x => tokensKey(x.name || '') === tokensKey(r.client || ''));
  const m = c ? mensualite(c) : prixMoyen(r.clubId);
  let mois = dureeVieMois(r.clubId) / 2;
  if (c && c.end && c.end > today()) mois = Math.max(1, (dateOf(c.end) - dateOf(today())) / (30.44 * 86400000));
  return { euros: Math.round(m * Math.max(1, mois)), estimee: !c };
}

// ── Reglages : bareme des offres ──────────────────────────────────────────
function offersCard() {
  const seen = offersSeen(CLUB.id); const saved = deepGet(S, ['offers', CLUB.id]) || {};
  const rows = [...seen.map(o => ({ ...o, ...(saved[o.key] || {}) })), ...Object.entries(saved).filter(([k]) => !seen.some(o => o.key === k)).map(([k, v]) => ({ key: k, n: 0, ...v }))];
  return `<div class="card"><h3>Offres et prix</h3><p class="muted small">Prix mensuel TTC de chaque offre : il sert au revenu récurrent, à la valeur d’un adhérent et aux euros en jeu sur une résiliation. Prix proposé : la médiane des prix importés depuis Resamania.</p>
    ${rows.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Offre</th><th>Gamme</th><th class="num">Adhérents</th><th class="num">Prix mensuel TTC</th></tr></thead><tbody>
    ${rows.map(o => `<tr><td>${esc(o.libelle || o.key)}</td><td><select class="input sm" data-change="offerSet" data-key="${esc(o.key)}" data-lib="${esc(o.libelle || '')}" data-k="gamme">${['basic', 'premium', 'ultimate', 'autre'].map(g => `<option value="${g}" ${(o.gamme || 'autre') === g ? 'selected' : ''}>${g[0].toUpperCase() + g.slice(1)}</option>`).join('')}</select></td><td class="num">${fmtN(o.n || 0)}</td><td class="num"><input class="input sm" style="width:100px;text-align:right" inputmode="decimal" value="${o.prixMensuelTTC != null ? String(o.prixMensuelTTC).replace('.', ',') : o.prix != null ? String(Math.round(o.prix * 100) / 100).replace('.', ',') : ''}" placeholder="29,99" data-change="offerSet" data-key="${esc(o.key)}" data-lib="${esc(o.libelle || '')}" data-k="prixMensuelTTC"></td></tr>`).join('')}</tbody></table></div>`
    : '<p class="muted small">Aucune offre importée : déposez l’export « Vente d’abonnements » dans Imports > Resamania.</p>'}
    <div class="row wrap" style="margin-top:10px;gap:16px"><span class="small">Revenu récurrent mensuel : <b>${fmtE(mrrClub(CLUB.id))}</b></span><span class="small">Durée de vie moyenne : <b>${plur(dureeVieMois(CLUB.id), 'mois', 'mois')}</b></span><span class="small">Valeur d’un adhérent : <b>${fmtE(Math.round(prixMoyen(CLUB.id) * dureeVieMois(CLUB.id)))}</b></span></div></div>`;
}
ACTIONS.offerSet = el => {
  const k = el.dataset.k; const v = k === 'prixMensuelTTC' ? (Number.isNaN(parseMontant(el.value)) ? null : Math.round(parseMontant(el.value) * 100) / 100) : el.value;
  db.batch([[['offers', CLUB.id, el.dataset.key, 'libelle'], el.dataset.lib || el.dataset.key], [['offers', CLUB.id, el.dataset.key, k], v]]);
  toast('Enregistré');
};
