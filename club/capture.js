/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — mode capture (?capture=1) ═══════════════════════════════════
// Pour les visuels commerciaux : ?capture=1&scene=home|resiliations|impayes|retention|imports|themes
// &theme=light|dark&accent=RRGGBB&club=Nom. Date figée au mardi 13 octobre 2026, 9 h 12 (config.js),
// ni toast ni animation, curseur et barres de défilement masqués, aucune donnée réelle.
// Jeu captureState() : 1 club « Club Démo Centre », 6 commerciaux fictifs, 40 adhérents, impayés de
// 29 à 240 €, 7 résiliations en cours dont 2 à échéance de 7 jours au plus, 23 relances du jour.
// scene=themes : l'accueil trois fois côte à côte, accents FFD600, D6004C et 0066B3 (Club Démo Nord, Sud, Ouest).

const CAPTURE = CFG.capture || null;
const CAPTURE_SCENES = { home: '#/home', resiliations: '#/resiliations', impayes: '#/impayes', retention: '#/loyalty', imports: '#/imports' };
const CAPTURE_RELANCES = 23;

function captureState() {
  const st = demoState(); const t = today(); const C = DEMO_CLUB.id; const R = rng(20261013);
  const pick = a => a[Math.floor(R() * a.length)];
  st.meta.capture = true;
  const nom = 'Club Démo Centre';
  st.clubs[C] = { ...st.clubs[C], name: nom, city: 'Centre-ville', address: '1 place du Marché' };
  st.tenant = { ...st.tenant, name: nom, entity: 'SAS Démo Centre', legal: { ...(st.tenant.legal || {}), societe: 'SAS Démo Centre', club: nom, etablissement: '1 place du Marché, Centre-ville', email: 'contact@example.com' } };
  // Équipe : une directrice et six commerciaux aux noms fictifs variés.
  const NOMS = { u1: ['Claire', 'Vasseur'], u3: ['Inès', 'Benali'], u4: ['Lucas', 'Ferreira'], u5: ['Awa', 'Diallo'], u6: ['Théo', 'Nguyen'], u7: ['Margaux', 'Lemaire'], u8: ['Karim', 'Haddad'] };
  for (const [id, [first, last]] of Object.entries(NOMS)) Object.assign(st.users[id], { first, last, email: `${norm(first)}.${norm(last)}@example.com` });
  delete st.users.u2; Object.values(st.challenges).forEach(ch => { if (ch.by === 'u2') ch.by = 'u1'; });
  st.rsm.aliases = { 'c:IBEN': 'u3', 'c:LFER': 'u4', 'c:ADIA': 'u5', 'c:TNGU': 'u6', 'c:MLEM': 'u7', 'c:KHAD': 'u8' };
  st.chat.m3.text = 'Deuxième semaine : merci pour l’accueil.';
  // 40 adhérents fictifs, à la place des 2 000 de la démo.
  const P = ['Emma', 'Louis', 'Chloé', 'Jules', 'Manon', 'Arthur', 'Zoé', 'Gabriel', 'Lina', 'Raphaël', 'Jade', 'Adam', 'Alice', 'Léo', 'Rose', 'Noah', 'Anna', 'Paul', 'Mila', 'Ethan', 'Nina', 'Yanis', 'Sarah', 'Mehdi', 'Léna', 'Nathan', 'Eva', 'Tom', 'Aïcha', 'Victor'];
  const N = ['Martin', 'Dubois', 'Robert', 'Richard', 'Durand', 'Simon', 'Laurent', 'Garcia', 'Fontaine', 'Mercier', 'Blanc', 'Guérin', 'Lambert', 'Bonnet', 'Rousseau', 'Moreau', 'Perrin', 'Morin', 'Mathieu', 'Clément', 'Gauthier', 'Dumont', 'Lopez', 'Fabre', 'Marchand', 'Brun', 'Gautier', 'Roche', 'Boyer', 'Meunier'];
  const vendeurs = ['u3', 'u4', 'u5', 'u6', 'u7', 'u8'];
  st.clients = {}; const L = [];
  for (let i = 0; i < 40; i++) {
    const id = 'k' + (i + 1); const [of, prix] = DEMO_OFFRES[i % DEMO_OFFRES.length];
    // départs : 4 à J-15, 3 à J-30, les autres de 2 mois à 3 ans
    const age = i < 4 ? 15 + (i % 3) : i < 7 ? 30 + i % 3 : 60 + Math.floor(R() * 1000);
    const start = addDays(t, -age); let end = start; while (end <= t) end = addMonths(end.slice(0, 7), 12) + end.slice(7); if (end.slice(8) > pad(daysIn(end.slice(0, 7)))) end = end.slice(0, 8) + pad(daysIn(end.slice(0, 7)));
    const c = { id, clubId: C, num: String(520000 + i), name: `${P[i % P.length]} ${N[(i * 7) % N.length]}`, phone: `06 50 00 ${pad(Math.floor(i / 10))} ${pad(i)}`, email: `client${i + 1}@example.com`, offer: of, price: prix, status: 'Client', start, end, sellerId: vendeurs[i % vendeurs.length], birth: `${pad(1 + (i * 5) % 12)}-${pad(1 + (i * 11) % 28)}` };
    if (i >= 7 && i < 10) c.end = addDays(t, 5 + (i - 7) * 5); // trois fins d'engagement dans le mois
    st.clients[id] = c; L.push(c);
  }
  // Impayés : 12 dossiers de 29 à 240 €, anciennetés étalées, deux promesses.
  const MONTANTS = [29, 35, 42, 58, 64, 79, 96, 112, 138, 165, 199, 240];
  MONTANTS.forEach((m, j) => { const c = L[12 + j]; const ageJ = [3, 8, 12, 18, 22, 27, 33, 41, 52, 66, 80, 95][j]; c.balance = m; c.balanceAt = addDays(t, -ageJ); c.oldestIncident = c.balanceAt; c.incidents = 1 + j % 3;
    if (j < 2) c.dunning = { status: 'promesse', ownerId: vendeurs[j], promiseDate: addDays(t, j ? 2 : -1), next: addDays(t, j ? 2 : -1), note: 'Règlement promis' };
    else if (j % 3 === 1) c.dunning = { status: 'relance', ownerId: vendeurs[j % vendeurs.length], next: addDays(t, j % 2), note: '' }; });
  // Résiliations : 7 demandes en cours, dont 2 à échéance de 7 jours au plus.
  Object.keys(st.resiliations).filter(id => /^r\d+$/.test(id)).forEach(id => delete st.resiliations[id]);
  const RES = [['Prix', 'nouvelle', 4, null], ['Déménagement', 'traitement', 6, 'u3'], ['Manque de temps', 'traitement', 12, 'u4'], ['Santé', 'traitement', 21, 'u5'], ['Prix', 'nouvelle', 15, null], ['Concurrence', 'traitement', 27, 'u6'], ['Insatisfaction', 'traitement', 18, 'u7']];
  RES.forEach(([reason, status, eff, owner], i) => {
    const c = L[26 + i]; const date = addDays(t, -(1 + i % 5)); const at = dateOf(date).getTime() + 11 * 3600000; const id = 'r' + (i + 1);
    c.end = addMonths(t.slice(0, 7), 6 + i) + '-15';
    st.resiliations[id] = { id, clubId: C, client: c.name, clientId: c.id, num: c.num, date, effective: addDays(t, eff), reason, status, saved: false, ownerId: owner, userId: owner, at, source: i % 3 ? 'resamania' : 'mail',
      log: { a: { at, by: 'u1', label: 'Demande enregistrée' }, ...(owner ? { b: { at: at + 4 * 3600000, by: owner, label: 'Message laissé', note: 'Rappeler en fin de semaine' } } : {}) } };
  });
  // Relances notées : sur les 40 adhérents seulement.
  st.loyalty = {}; for (let i = 0; i < 18; i++) { const c = L[i % 40]; const d = addDays(t, -(1 + i % 10)); st.loyalty['l' + i] = { id: 'l' + i, clientId: c.id, type: i % 3 ? 'suivi' : 'renouvellement', step: i % 2 ? 15 : 30, userId: vendeurs[i % 6], outcome: pick(['ok', 'message', 'rappel', 'ok']), at: dateOf(d).getTime() + (9 + i % 8) * 3600000, note: '' }; }
  st.rsm.rowsHistory[C] = { clients: [{ at: dateOf(weekStart(t)).getTime() - 7 * 864e5, rows: 39 }, { at: dateOf(weekStart(t)).getTime() + 9 * 3600000, rows: 40 }], ventes: [{ at: dateOf(weekStart(t)).getTime() - 7 * 864e5, rows: 21 }, { at: dateOf(weekStart(t)).getTime() + 9 * 3600000, rows: 24 }] };
  if (st.imports.imp2) st.imports.imp2.rows = 40;
  if (st.base[C]) for (const mk of Object.keys(st.base[C])) st.base[C][mk] = { actifs: 40, sortants: 1 + (Number(mk.slice(5)) % 3), objectif: 44 };
  return st;
}
// Ajuste les prospects du jour pour que la file des relances compte exactement 23 lignes « maintenant ».
function captureCalibrer() {
  const C = DEMO_CLUB.id; const n = () => { REV++; return relQueue(C, 'all').now.length; };
  const ids = Object.keys(S.prospects).sort();
  for (let i = 0; i < 80 && n() > CAPTURE_RELANCES && ids.length; i++) delete S.prospects[ids.pop()];
  for (let i = 0; i < 80 && n() < CAPTURE_RELANCES; i++) { const id = 'pc' + i; S.prospects[id] = { id, clubId: C, nom: 'Prospect', prenom: ['Yasmine', 'Bastien', 'Clara', 'Malik', 'Océane', 'Romain'][i % 6] + ' ' + String.fromCharCode(65 + i % 26) + '.', creeLe: addDays(today(), -2), commercialId: ['u3', 'u4', 'u5', 'u6', 'u7', 'u8'][i % 6], statut: 'Nouveau', phone: `06 51 00 00 ${pad(i)}` }; }
  backend.replaceAll(); REV++;
}
function captureAppliquer() {
  if (!CAPTURE) return; const C = DEMO_CLUB.id;
  if (CAPTURE.theme === 'dark' || CAPTURE.theme === 'light') document.documentElement.dataset.theme = CAPTURE.theme;
  const th = {}; if (/^[0-9a-f]{6}$/i.test(CAPTURE.accent || '')) th.accent = '#' + CAPTURE.accent.toUpperCase();
  if (CAPTURE.club) th.displayName = String(CAPTURE.club).slice(0, 40);
  if (Object.keys(th).length) S.clubs[C].theme = th;
  try { captureCalibrer(); } catch (e) { console.warn('calibrage des relances', e); }
  safeLS.set('fitpulse.club', C);
  location.hash = CAPTURE_SCENES[CAPTURE.scene] || '#/home';
}
// scene=themes : trois accueils côte à côte (cadres), chacun avec son accent et son nom.
function captureThemes() {
  const T = CAPTURE.theme === 'dark' ? 'dark' : 'light';
  const L = [['FFD600', 'Club Démo Nord'], ['D6004C', 'Club Démo Sud'], ['0066B3', 'Club Démo Ouest']];
  document.documentElement.dataset.theme = T;
  document.body.innerHTML = `<div class="capture-themes">${L.map(([a, n]) => `<figure><iframe title="${esc(n)}" src="?capture=1&scene=home&theme=${T}&accent=${a}&club=${encodeURIComponent(n)}" width="1280" height="2300" loading="eager"></iframe><figcaption>${esc(n)} · accent #${a}</figcaption></figure>`).join('')}</div>`;
}
