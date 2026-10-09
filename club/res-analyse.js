/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — chiffres des résiliations ═══════════════════════════════════
// Indicateurs de la page (sans réponse, délai médian de première réponse,
// répondues sous 24 h, taux de sauvetage), onglet Analyse et chiffres du
// récapitulatif. Les faux positifs et les doublons ne comptent nulle part.

// Première réponse : premier contact noté ou première réponse lue dans le fil, en ms depuis la réception.
function resPremiereReponseMs(r) {
  const rec = resReceivedAt(r); if (!rec) return null;
  const c = resContacts(r).map(a => a.at).filter(t => t >= rec); const f = r.mail && r.mail.firstReplyAt >= rec ? r.mail.firstReplyAt : null;
  const t = Math.min(...(f ? [f] : []), ...c); return Number.isFinite(t) ? t - rec : null;
}
const resMoisDe = r => { const rec = resReceivedAt(r); return rec ? isoOf(new Date(rec)).slice(0, 7) : (r.date || '').slice(0, 7); };
const resSauveeMois = (r, mk) => resStatus(r) === 'sauvee' && ((S.entries['sv_' + r.id] || {}).date || (r.closedAt ? isoOf(new Date(r.closedAt)) : r.date) || '').slice(0, 7) === mk;
const resResilieeMois = (r, mk) => resStatus(r) === 'resiliee' && (r.effective || r.date || '').slice(0, 7) === mk;
function resIndicateurs(clubId, mk, list = resList(clubId), maintenant = Date.now()) {
  const L = list.filter(RES_ENGINE.compte);
  const attente = L.filter(r => resPhase(r) === 'attente');
  const ages = attente.map(r => maintenant - RES_ENGINE.depart({ ...r, receivedAt: resReceivedAt(r) }));
  const recues = L.filter(r => resMoisDe(r) === mk && resPhase(r) !== 'verifier');
  const delais = recues.map(resPremiereReponseMs).filter(x => x != null);
  const sauveesL = L.filter(r => resSauveeMois(r, mk)); const resiliees = L.filter(r => resResilieeMois(r, mk)).length;
  return {
    sansReponse: attente.length, plusAncienneMs: ages.length ? Math.max(...ages) : 0,
    recues: recues.length, repondues: delais.length, delaiMedianMs: medianOf(delais),
    repondues24: recues.length ? delais.filter(d => d <= 24 * 3600000).length / recues.length : null,
    sauvees: sauveesL.length, resiliees, tauxSauvetage: sauveesL.length + resiliees ? sauveesL.length / (sauveesL.length + resiliees) : null,
    eurosSauves: Math.round(sauveesL.reduce((s, r) => s + resValeur(r), 0)),
  };
}
const resH = ms => ms == null ? 'n.d.' : ms < 3600000 ? Math.max(1, Math.round(ms / 60000)) + ' min' : (ms / 3600000).toFixed(1).replace('.0', '').replace('.', ',') + ' h';

// ── Onglet Analyse ────────────────────────────────────────────────────────
function resAnalyse(clubId, mk, all) {
  const L = all.filter(RES_ENGINE.compte).filter(r => resMoisDe(r) === mk || resSauveeMois(r, mk) || resResilieeMois(r, mk));
  const taux = (s, n) => fmtP(s + n ? s / (s + n) : null);
  const ligne = cells => `<tr>${cells.map((c, i) => `<td${i ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`;
  const table = (titre, tetes, lignes, vide) => `<div class="card"><h3>${titre}</h3><div class="table-wrap"><table class="t"><thead><tr>${tetes.map((h, i) => `<th${i ? ' class="num"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${lignes.join('') || `<tr><td colspan="${tetes.length}" class="muted">${vide}</td></tr>`}</tbody></table></div></div>`;
  // Par vendeur
  const parV = {}; L.forEach(r => { const k = r.ownerId || '_'; (parV[k] = parV[k] || []).push(r); });
  const vend = Object.entries(parV).filter(([k]) => k !== '_').map(([uid, rs]) => { const s = rs.filter(r => resSauveeMois(r, mk)).length, n = rs.filter(r => resResilieeMois(r, mk)).length;
    const offres = rs.reduce((t, r) => t + resActions(r).filter(a => actOffer(a)).length, 0);
    return [esc(fullName(S.users[uid]) || 'Ancien membre'), rs.length, resH(medianOf(rs.map(resPremiereReponseMs).filter(x => x != null))), offres, s, taux(s, n)]; }).sort((a, b) => b[1] - a[1]);
  // Par motif
  const mot = {}; L.forEach(r => { const k = r.reason || 'Non renseigné'; const m = mot[k] = mot[k] || { n: 0, s: 0, p: 0 }; m.n++; if (resSauveeMois(r, mk)) m.s++; if (resResilieeMois(r, mk)) m.p++; });
  // Par source
  const src = {}; L.forEach(r => RES_ENGINE.sources(r).forEach(k => { const x = src[k] = src[k] || { n: 0, s: 0, p: 0, d: [] }; x.n++; if (resSauveeMois(r, mk)) x.s++; if (resResilieeMois(r, mk)) x.p++; const d = resPremiereReponseMs(r); if (d != null) x.d.push(d); }));
  // Courbe 6 mois
  const months = Array.from({ length: 6 }, (_, i) => addMonths(mk, i - 5)); const K = months.map(m => resIndicateurs(clubId, m, all));
  return `<div class="g12" style="margin-bottom:14px"><div class="card col6"><h3>Délai médian de 1re réponse</h3>${monthBars(months, [{ label: 'Délai médian (h)', color: 'var(--d-1)', values: K.map(k => k.delaiMedianMs == null ? 0 : Math.round(k.delaiMedianMs / 360000) / 10) }], { fmt: v => String(v).replace('.', ',') + ' h' })}</div>
    <div class="card col6"><h3>Taux de sauvetage</h3>${monthBars(months, [{ label: 'Taux de sauvetage', color: 'var(--ok, var(--d-3))', values: K.map(k => Math.round((k.tauxSauvetage || 0) * 100)) }], { fmt: v => v + ' %' })}</div></div>
    <div class="res-analyse">
    ${table('Par vendeur', ['Vendeur', 'Dossiers pris', 'Délai médian', 'Offres proposées', 'Sauvées', 'Taux'], vend.map(ligne), 'Aucun dossier attribué ce mois.')}
    ${resOffersTables(L, resValeur, { motifs: false })}
    ${table('Par motif', ['Motif', 'Demandes', 'Taux de sauvetage'], Object.entries(mot).sort((a, b) => b[1].n - a[1].n).map(([k, m]) => ligne([esc(k), m.n, taux(m.s, m.p)])), 'Aucune demande.')}
    ${table('Par source', ['Source', 'Demandes', 'Délai médian', 'Sauvées', 'Taux'], ['mail', 'appli', 'resamania', 'accueil'].filter(k => src[k]).map(k => ligne([RES_ENGINE.SOURCES[k], src[k].n, resH(medianOf(src[k].d)), src[k].s, taux(src[k].s, src[k].p)])), 'Aucune demande.')}
    <div class="card"><h3>Valeur</h3><p class="small">En jeu sur les dossiers ouverts : <b data-v="${resToHandle(clubId).reduce((s, r) => s + resValeur(r), 0)}">${fmtE(resToHandle(clubId).reduce((s, r) => s + resValeur(r), 0))}</b>. Perdue ce mois : <b>${fmtE(L.filter(r => resResilieeMois(r, mk)).reduce((s, r) => s + resValeur(r), 0))}</b>.</p></div></div>`;
}
