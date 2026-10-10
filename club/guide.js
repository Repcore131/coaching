/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — démo guidée (7 minutes) ════════════════════════════════════
// « Démo guidée, 7 minutes » (écran de connexion ou de création) ouvre
// ?demo=1&guide=1 : la démo vendeur se charge, Directeur Démo est connecté et
// huit bulles s'enchaînent, chacune ancrée sur un élément réel de l'écran.
// Précédent, Suivant, Quitter ; barre de progression et minuteur. La dernière
// étape récapitule trois chiffres et propose « Créer mon club » (la démo est effacée).
// Trois exports d'exemple au format Resamania (ventes, clients en incident,
// résiliations) sont générés à la volée depuis les données de la démo.

const GUIDE_ON = typeof DEMO !== 'undefined' && DEMO && new URLSearchParams(location.search).get('guide') === '1';
const GUIDE_DUREE = 4 * 60; // secondes annoncées
const GUIDE = { i: 0, debut: 0, timer: null };
const GUIDE_ETAPES = [
  { route: 'impayes', avant: () => { UI.impTab2 = 'suivi'; UI.dunFilter = 'todo'; }, cible: '.dette-bar', titre: 'Les impayés du club', texte: 'Tous les dossiers ouverts, classés par ancienneté de la dette. Un clic sur une tranche filtre la liste.' },
  { route: 'impayes', avant: () => { UI.impTab2 = 'canaux'; UI.impMonth = curMonth(); }, cible: '#canaux-cartes', titre: 'Récupéré par canal', texte: 'Chaque euro régularisé est rangé par canal : équipe, client en ligne, prélèvement, automatismes, tiers. La part de l’équipe se lit d’un coup d’œil.' },
  { route: 'impayes', avant: () => { UI.impTab2 = 'canaux'; }, cible: '#ctl-web', titre: 'Les contrôles', texte: 'Le paiement en ligne est comparé aux Transactions Web de Resamania. Concordant : les chiffres sont fiables.' },
  { route: 'impayes', avant: () => { UI.impTab2 = 'suivi'; UI.dunFilter = 'nobody'; }, cible: '[data-act=dunTake]', titre: 'Je m’en occupe', texte: 'Un dossier sans responsable se prend en un clic. Il entre dans les relances du commercial.' },
  { route: 'impayes', avant: () => { UI.impTab2 = 'suivi'; UI.dunFilter = 'todo'; }, cible: '[data-act=dunPaid]', titre: 'Marquer récupéré', texte: 'L’adhérent a payé : le dossier passe en Récupéré et le montant est crédité au commercial. Essayez sur un dossier.' },
  { route: 'recap', avant: () => { UI.recapTab = 'recap'; UI.recapMonth = curMonth(); }, cible: '[data-act=recapPrint]', titre: 'Le récapitulatif du mois', texte: 'Tous les chiffres du mois sur une page pour le gérant. Imprimez-le ou enregistrez-le en PDF.', fin: true },
];

// ── Exports d'exemple (format Resamania) ──────────────────────────────────
const csvLigne = a => a.map(v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';');
const frDate = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
function demoCsv(type) {
  const C = DEMO_CLUB.id; const cl = Object.values(S.clients).filter(c => c.clubId === C);
  const vend = id => S.users[id] || {}; const code = u => ((u.first || '')[0] + (u.last || '').slice(0, 3)).toUpperCase();
  if (type === 'ventes') {
    const L = cl.filter(c => c.start >= addDays(today(), -30) && c.status === 'Client').slice(0, 40);
    return [csvLigne(['Numéro du client', 'Date de création', 'Prénom', 'Nom', 'Nom du produit', 'Nom de l’offre', 'Échéancier', 'État', 'Canal', 'Prix toutes taxes', 'Prénom du commercial initial', 'Nom du commercial initial', 'Code du commercial initial']),
      ...L.map(c => { const [p, ...n] = c.name.split(' '); const u = vend(c.sellerId); return csvLigne([c.num, frDate(c.start), p, n.join(' '), `Abonnement ${c.offer}`, c.offer, 'Mensuel', 'Validé', 'Club', String(c.price).replace('.', ','), u.first, u.last, code(u)]); })].join('\r\n');
  }
  if (type === 'incidents') {
    const L = cl.filter(c => Number(c.balance) > 0);
    return [csvLigne(['Numéro du client', 'Prénom', 'Nom', 'Montant de l’incident', 'Nombre d’incidents', 'Téléphone', 'Email']),
      ...L.map(c => { const [p, ...n] = c.name.split(' '); return csvLigne([c.num, p, n.join(' '), String(c.balance).replace('.', ','), c.incidents || 1, c.phone, c.email]); })].join('\r\n');
  }
  const L = Object.values(S.resiliations).filter(r => r.clubId === C && resOpen(r));
  return [csvLigne(['Date de création', 'Prénom', 'Nom', 'Motif', 'Type', 'État', 'Créateur', 'Date de résiliation']),
    ...L.map(r => { const [p, ...n] = String(r.client).split(' '); const u = vend(r.ownerId || 'u1'); return csvLigne([frDate(r.date), p, n.join(' '), r.reason, 'Abonnement', 'À arbitrer', `${u.first} ${u.last}`, r.effective ? frDate(r.effective) : '']); })].join('\r\n');
}
const DEMO_CSV = { ventes: 'RSM_ventes-abonnements_exemple.csv', incidents: 'RSM_clients-en-incident_exemple.csv', resiliations: 'RSM_resiliations_exemple.csv' };
ACTIONS.demoCsv = el => downloadFile(DEMO_CSV[el.dataset.t], '﻿' + demoCsv(el.dataset.t), 'text/csv;charset=utf-8');

// ── Chiffres clés de la fin ───────────────────────────────────────────────
function guideChiffres() {
  const C = CLUB.id; const res = resToHandle(C); const dun = dunRows(C).filter(c => Number(c.balance) > 0);
  return [[fmtE(res.reduce((s, r) => s + resValeur(r), 0)), `en jeu sur ${plur(res.length, 'résiliation ouverte', 'résiliations ouvertes')}`],
    [fmtE(dun.reduce((s, c) => s + Number(c.balance), 0)), `d’impayés à récupérer (${plur(dun.length, 'dossier', 'dossiers')})`],
    [fmtE(rapporteCompteurData(C).total), 'rapportés par Fit Pulse ce mois']];
}

// ── Bulles ────────────────────────────────────────────────────────────────
function guideDemarrer() {
  if (!GUIDE_ON || !ME) return; GUIDE.i = 0; GUIDE.debut = Date.now();
  clearInterval(GUIDE.timer); GUIDE.timer = setInterval(guideMinuteur, 1000); guideAller(0);
}
function guideFermer() { clearInterval(GUIDE.timer); GUIDE.timer = null; const b = $('#guide'); if (b) b.remove(); $$('.guide-cible').forEach(x => x.classList.remove('guide-cible')); const q = new URLSearchParams(location.search); if (q.has('guide')) { q.delete('guide'); history.replaceState(null, '', location.pathname + '?' + q + location.hash); } }
function guideMinuteur() { const el = $('#guide-temps'); if (!el) return; const s = Math.floor((Date.now() - GUIDE.debut) / 1000); el.textContent = `${Math.floor(s / 60)}:${pad(s % 60)} sur ${GUIDE_DUREE / 60} min`; }
async function guideAller(i) {
  GUIDE.i = Math.max(0, Math.min(GUIDE_ETAPES.length - 1, i)); const E = GUIDE_ETAPES[GUIDE.i];
  if (E.avant) E.avant();
  if (location.hash !== '#/' + E.route) location.hash = '#/' + E.route; else render();
  let cible = null;
  if (E.cible) for (let k = 0; k < 40 && !cible; k++) { await new Promise(r => setTimeout(r, 50)); cible = document.querySelector(E.cible); }
  else await new Promise(r => setTimeout(r, 120));
  guideBulle(E, cible);
}
function guideBulle(E, cible) {
  $$('.guide-cible').forEach(x => x.classList.remove('guide-cible'));
  let b = $('#guide'); if (!b) { b = document.createElement('div'); b.id = 'guide'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-live', 'polite'); document.body.appendChild(b); }
  const n = GUIDE_ETAPES.length, i = GUIDE.i;
  b.className = 'guide-bulle' + (E.fin ? ' fin' : '');
  b.setAttribute('aria-label', E.titre);
  b.innerHTML = `<div class="guide-haut"><span class="muted small">Étape ${i + 1} sur ${n}</span><span class="spacer"></span><span class="muted small" id="guide-temps"></span></div>
    <div class="guide-prog"><i style="width:${Math.round((i + 1) / n * 100)}%"></i></div>
    <h3>${esc(E.titre)}</h3><p>${esc(E.texte)}</p>
    ${E.csv ? `<div class="row wrap" style="gap:6px;margin-bottom:8px">${Object.keys(DEMO_CSV).map(t => `<button class="btn sm" data-act="demoCsv" data-t="${t}">${ico('download')} ${t === 'ventes' ? 'Ventes' : t === 'incidents' ? 'Clients en incident' : 'Résiliations'}</button>`).join('')}</div>` : ''}
    ${E.fin ? `<div class="guide-chiffres">${guideChiffres().map(([v, l]) => `<div><b>${v}</b><span>${esc(l)}</span></div>`).join('')}</div><button class="btn primary" style="width:100%;margin-bottom:8px" data-guide="creer">Créer mon club</button>` : ''}
    <div class="row" style="gap:6px"><button class="btn sm ghost" data-guide="quitter">Quitter</button><span class="spacer"></span><button class="btn sm" data-guide="precedent" ${i === 0 ? 'disabled' : ''}>Précédent</button><button class="btn sm primary" data-guide="suivant">${E.fin ? 'Terminer' : 'Suivant'}</button></div>`;
  guideMinuteur();
  if (cible) { cible.classList.add('guide-cible'); cible.scrollIntoView({ block: 'center', behavior: 'instant' }); }
  guidePlacer(b, cible);
}
// Ordinateur : à côté de la cible, sans sortir de l'écran ; téléphone : en bas, pleine largeur.
function guidePlacer(b, cible) {
  b.style.left = b.style.top = b.style.right = b.style.bottom = '';
  const W = innerWidth, H = innerHeight;
  if (W <= 560 || !cible) { b.classList.add('ancre-bas'); if (!cible && W > 560) { b.classList.remove('ancre-bas'); b.style.left = Math.max(8, (W - b.offsetWidth) / 2) + 'px'; b.style.top = Math.max(8, (H - b.offsetHeight) / 2) + 'px'; } return; }
  b.classList.remove('ancre-bas');
  const r = cible.getBoundingClientRect(); const bw = b.offsetWidth, bh = b.offsetHeight;
  let top = r.bottom + 12; if (top + bh > H - 8) top = r.top - bh - 12; if (top < 8) top = Math.min(H - bh - 8, Math.max(8, r.top + 12));
  const left = Math.min(W - bw - 8, Math.max(8, r.left));
  b.style.left = left + 'px'; b.style.top = top + 'px';
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-guide]'); if (!el) return; e.preventDefault();
  const a = el.dataset.guide;
  if (a === 'suivant') { if (GUIDE_ETAPES[GUIDE.i].fin) guideFermer(); else guideAller(GUIDE.i + 1); }
  else if (a === 'precedent') guideAller(GUIDE.i - 1);
  else if (a === 'quitter') guideFermer();
  else if (a === 'creer') { guideFermer(); demoQuit(); }
});
// Après un nouveau rendu de la page, la cible est un nouvel élément : surbrillance et position reprises.
function guideReancrer() { const b = $('#guide'); if (!b || !GUIDE.timer) return; const E = GUIDE_ETAPES[GUIDE.i]; const c = E.cible ? document.querySelector(E.cible) : null; if (c && !c.classList.contains('guide-cible')) { c.classList.add('guide-cible'); setTimeout(() => guidePlacer(b, c), 0); } }
addEventListener('resize', () => { const b = $('#guide'); if (b) guidePlacer(b, document.querySelector('.guide-cible')); });
// Lancement : après le premier affichage de la démo, Directeur Démo connecté.
if (GUIDE_ON) addEventListener('load', () => { let n = 0; const go = () => { if (!S || !S.users[DEMO_USER]) { if (++n < 100) setTimeout(go, 100); return; } if (!ME || ME.id !== DEMO_USER) login(S.users[DEMO_USER]); setTimeout(guideDemarrer, 300); }; setTimeout(go, 200); });
