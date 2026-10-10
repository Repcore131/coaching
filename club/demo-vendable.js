/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — démo vendable : impayés et rétention en 4 minutes (?demo=1) ══
// seedDemo(clubId) : « Club Démo Centre », 5 commerciaux fictifs aux prénoms neutres, 420 clients,
// aucun nom réel. Impayés : 38 dossiers ouverts pour 4 120 €, âges de 1 à 75 jours, 9 sans
// responsable, 6 promesses ; régularisations sur 6 mois par les 5 canaux, part de l'équipe entre
// 35 et 45 %, Transactions Web concordantes. Rétention : 14 appels J+15, 9 J+30, 11 fins de contrat
// à 30 jours, 6 anniversaires. Résiliations : 5 en cours, 2 sauvées ce mois.
// Distinct du jeu d'essai demoState (Club Horizon) ; graine fixe : la même démo à chaque chargement.
const DEMO_VENDABLE_GRAINE = 20261109;
const DEMO_VENDEURS = [['v1', 'Camille', 'Roux', 'f1'], ['v2', 'Alex', 'Garnier', 'h1'], ['v3', 'Sacha', 'Perrin', 'h2'], ['v4', 'Morgan', 'Faure', 'f2'], ['v5', 'Charlie', 'Rolland', 'h1']];
function seedDemo(clubId = 'demo') {
  if (CFG.capture) return captureState();
  const st = emptyState(); const R = rng(DEMO_VENDABLE_GRAINE); const C = clubId;
  const pick = a => a[Math.floor(R() * a.length)]; const t = today(); const cm = curMonth();
  const ts = (iso, h = 10, m = 0) => dateOf(iso).getTime() + h * 3600000 + m * 60000; const T0 = ts(t, 9);
  st.meta.demo = true; st.meta.demoSeed = DEMO_VENDABLE_GRAINE; st.meta.createdAt = ts(addDays(t, -2 * 365)); st.meta.demoT0 = T0;
  st.clubs[C] = { id: C, name: 'Club Démo Centre', city: 'Centre-ville', address: '1 place du Marché', createdAt: ts(addDays(t, -2 * 365)), openDays: [1, 2, 3, 4, 5, 6], mailSync: { at: T0 - 12 * 60000, ok: true, scanned: 9, found: 3, error: null } };
  st.tenant = { name: 'Club Démo Centre', brand: null, logo: null, colors: null, entity: 'SAS Démo Centre', panierMoyen: null, legal: { societe: 'SAS Démo Centre', club: 'Club Démo Centre', etablissement: '1 place du Marché, Centre-ville', email: 'contact@example.com' } };
  st.settings = { panierMoyen: 32 }; st.billing = { price: 149 };
  // ── Équipe : un directeur et 5 commerciaux ──
  st.users.u1 = { id: 'u1', first: 'Directeur', last: 'Démo', role: 'manager', clubs: [C], avatar: 'h1', status: 'active', email: 'directeur.demo@example.com', createdAt: ts(addDays(t, -700)) };
  DEMO_VENDEURS.forEach(([id, first, last, avatar], i) => { st.users[id] = { id, first, last, role: 'membre', clubs: [C], avatar, status: 'active', email: `${norm(first)}.${norm(last)}@example.com`, createdAt: ts(addDays(t, -400 + i * 40)) }; });
  const V = DEMO_VENDEURS.map(x => x[0]);
  ['contrats', 'avis', 'impayes', 'sauvetage', 'nutrition'].forEach(k => { if (st.kpis[k]) st.kpis[k].enabled = true; });
  // Ventes et avis des 6 derniers mois (classement des ventes, récapitulatif).
  let ne = 0;
  for (let i = 5; i >= 0; i--) {
    const mk = addMonths(cm, -i); const fin = mk === cm ? addDays(t, -1) : `${mk}-${pad(daysIn(mk))}`; st.targets[mk] = {};
    V.forEach((uid, j) => { st.targets[mk][uid] = { contrats: 16, avis: 12, impayes: 300, sauvetage: 2 };
      for (let d = mk + '-01'; d <= fin; d = addDays(d, 1)) { if (!estOuvre(d)) continue; [['contrats', 0.8], ['avis', 0.55]].forEach(([k, p]) => { if (R() < p * (0.8 + j * 0.06)) { const id = 'e' + (++ne); st.entries[id] = { id, userId: uid, clubId: C, kpiId: k, date: d, value: 1, source: 'manual', at: ts(d, 11, ne % 60) }; } }); } });
  }
  // ── 420 clients ──
  const P = ['Lou', 'Noé', 'Eden', 'Maël', 'Sasha', 'Andréa', 'Ange', 'Elie', 'Loan', 'Ilan', 'Lilou', 'Nael', 'Jade', 'Lino', 'Alix', 'Robin', 'Swann', 'Gaël', 'Marley', 'Ayden', 'Céleste', 'Joan', 'Kenzo', 'Mila', 'Nils', 'Ambre', 'Timéo', 'Léonie', 'Aure', 'Sohan'];
  const N = ['Aubry', 'Barre', 'Collet', 'Delmas', 'Esnault', 'Ferrand', 'Gauthier', 'Hamon', 'Imbert', 'Jacquet', 'Lebon', 'Marchal', 'Noël', 'Olivier', 'Pasquier', 'Quentin', 'Renaud', 'Sauvage', 'Tessier', 'Vallet', 'Weber', 'Arnoux', 'Brunet', 'Carré', 'Daniel'];
  const OFFRES = [['Essentiel', 24.9, 0.3], ['Confort', 32.9, 0.45], ['Intégral', 39.9, 0.25]];
  const offre = () => { const x = R(); let a = 0; for (const o of OFFRES) { a += o[2]; if (x < a) return o; } return OFFRES[1]; };
  const birthHors7 = () => { let b; do { b = `${pad(1 + Math.floor(R() * 12))}-${pad(1 + Math.floor(R() * 28))}`; } while ((() => { for (let k = 0; k <= 8; k++) if (addDays(t, k).slice(5) === b) return true; return false; })()); return b; };
  const clients = [];
  for (let i = 0; i < 420; i++) {
    const id = 'd' + (i + 1); const pr = pick(P), nm = pick(N); const [of, prix] = offre();
    const start = addDays(t, -(70 + Math.floor(R() * 900)));
    let end = addDays(t, 75 + Math.floor(R() * 280));
    clients.push(st.clients[id] = { id, clubId: C, num: String(520000 + i), name: `${pr} ${nm}`, phone: `06 39 97 ${pad(Math.floor(i / 100))} ${pad(i % 100)}`, email: `${norm(pr)}.${norm(nm)}${i}@example.com`.replace(/ /g, ''),
      offer: of, price: prix, status: 'Client', start, end, sellerId: V[i % V.length], birth: birthHors7() });
  }
  st.tarifs[C] = Object.fromEntries(OFFRES.map(([o, p]) => [tarifCle(o), { offre: o, mensuel: p, at: T0, by: 'u1' }]));
  // ── Rétention : 14 J+15, 9 J+30, 11 fins de contrat à 30 jours, 6 anniversaires (clients distincts) ──
  const lot = (a, n) => clients.slice(a, a + n);
  lot(0, 14).forEach((c, i) => { c.start = addDays(t, -(13 + (i % 8))); c.end = addDays(c.start, 365); });
  lot(14, 9).forEach((c, i) => { c.start = addDays(t, -(28 + i)); c.end = addDays(c.start, 365); });
  lot(23, 11).forEach((c, i) => { c.end = addDays(t, 3 + Math.floor(i * 2.5)); });
  lot(34, 6).forEach((c, i) => { c.birth = addDays(t, i).slice(5); });
  // Actions de rétention déjà notées ce mois (Résultats), sur d'autres clients.
  lot(300, 10).forEach((c, i) => { const id = 'lv' + i; st.loyalty[id] = { id, clubId: C, clientId: c.id, type: i % 2 ? 'suivi30' : 'suivi15', step: i % 2 ? 30 : 15, outcome: 'ok', userId: V[i % 5], at: ts(addDays(t, -(1 + i)), 15), value: 0 }; });
  // ── Impayés : 38 dossiers, 4 120 € au total, âges de 1 à 75 jours ──
  const deb = lot(40, 38); const bruts = deb.map(() => 40 + Math.round(R() * 140)); const k = 4120 / bruts.reduce((s, x) => s + x, 0);
  const montants = bruts.map(x => Math.round(x * k * 100) / 100); montants[37] = Math.round((4120 - montants.slice(0, 37).reduce((s, x) => s + x, 0)) * 100) / 100;
  deb.forEach((c, i) => {
    const age = 1 + Math.round(i * 74 / 37); const f = addDays(t, -age);
    c.balance = montants[i]; c.balanceAt = f; c.firstIncidentAt = f; c.oldestIncident = f; c.incidents = 1 + (i % 3);
    const owner = i < 9 ? null : V[i % 5];
    const d = { status: owner ? 'relance' : 'arelancer', ...(owner ? { ownerId: owner } : {}), history: [] };
    if (owner && i % 3 === 0) d.history.push({ at: ts(addDays(t, -Math.min(age, 3)), 10, 12), by: owner, label: 'Pas de réponse', outcome: 'pasreponse' });
    if (i >= 9 && i < 15) { const pd = addDays(t, 1 + (i % 6)); Object.assign(d, { status: 'promesse', promiseDate: pd, promiseAmount: c.balance, promiseBase: c.balance, next: addDays(pd, 1) }); d.history.push({ at: ts(addDays(t, -1), 17, 40), by: owner, label: `Promesse : ${fmtE(c.balance)} le ${dm(pd)}`, outcome: 'promesse' }); }
    c.dunning = d;
  });
  // ── Régularisations sur 6 mois : 5 canaux, part de l'équipe de 35 à 45 %, Transactions Web concordantes ──
  st.rsm.controls = { [C]: { web: {} } }; let nv = 0;
  for (let i = 5; i >= 0; i--) {
    const mk = addMonths(cm, -i); const fin = mk === cm ? addDays(t, -1) : `${mk}-${pad(daysIn(mk))}`; const jours = Math.max(1, Number(fin.slice(8)));
    const impId = 'imp_inc_' + mk; st.imports[impId] = { id: impId, clubId: C, defId: 'incidents', name: `RSM_impayes-regularises_${mk}.csv`, type: 'kpi', source: 'resamania', active: true, auto: true, at: ts(fin, 21), from: mk + '-01', to: fin, rows: 0 };
    const partEquipe = 0.36 + R() * 0.08; const total = 1800 + Math.round(R() * 900); const equipe = Math.round(total * partEquipe);
    const autres = total - equipe; const repart = { client: 0.4, auto: 0.35, automatismes: 0.15, tiers: 0.1 };
    const lignes = [];
    // équipe : 6 à 9 régularisations, créditées aux commerciaux (KPI Impayés récupérés)
    const ne2 = 6 + Math.floor(R() * 4); let reste = equipe;
    for (let j = 0; j < ne2; j++) { const a = j === ne2 - 1 ? reste : Math.round(equipe / ne2 * (0.7 + R() * 0.6)); reste -= a; lignes.push(['equipe', a, V[(j + i) % 5]]); }
    Object.entries(repart).forEach(([canal, p]) => { const n = canal === 'tiers' ? 1 : 3; const v = Math.round(autres * p); for (let j = 0; j < n; j++) lignes.push([canal, Math.round(v / n * 100) / 100, null]); });
    lignes.forEach(([canal, a, uid], j) => {
      const d = `${mk}-${pad(1 + Math.floor((j * 7 + i * 3) % jours))}`; const c = clients[100 + ((nv * 7) % 190)]; const id = 'rv' + (++nv);
      st.recov[id] = { id, clubId: C, date: d, amount: a, canal, userId: uid, type: 'Rejet de prélèvement', moyen: canal === 'client' ? 'CB en ligne' : 'Prélèvement', clientNum: c.num, author: uid ? `${st.users[uid].first} ${st.users[uid].last}` : canal, incidentDate: addDays(d, -(6 + (j * 5) % 30)), importId: impId, importIds: { [impId]: true }, at: ts(fin, 21) };
      if (canal === 'equipe') { const eid = 'ri' + nv; st.entries[eid] = { id: eid, userId: uid, clubId: C, kpiId: 'impayes', date: d, value: a, source: 'import', importId: impId, importIds: { [impId]: true }, clientNum: c.num, at: ts(fin, 21) };
        // une relance notée avant la régularisation : encaissement « grâce à Fit Pulse »
        if (j % 2 === 0) { c.dunning = c.dunning || { history: [] }; c.dunning.history = [...(c.dunning.history || []), { at: ts(addDays(d, -3), 11), by: uid, label: 'Message laissé', outcome: 'message' }]; } }
      if (canal === 'client') st.rsm.controls[C].web[d] = Math.round(((st.rsm.controls[C].web[d] || 0) + a) * 100) / 100;
    });
  }
  // ── Résiliations : 5 en cours (3 en attente de réponse, 2 en cours), 2 sauvées ce mois ──
  const H = 3600000; const mailDe = (at, o = {}) => ({ threadId: 'demo-' + at, link: '#demo', subject: 'Résiliation de mon abonnement', firstInAt: at, lastInAt: at, inCount: 1, outCount: 0, firstReplyAt: null, lastOutAt: null, awaitingReply: true, kind: 'adherent', score: 7, ...o });
  const dos = (id, o) => { st.resiliations[id] = { id, clubId: C, date: isoOf(new Date(o.receivedAt)), status: 'nouvelle', saved: false, ownerId: null, userId: null, type: 'resiliation', at: o.receivedAt, dueAt: o.receivedAt + 24 * H, actions: [{ at: o.receivedAt, by: 'system', label: o.mail ? 'Demande reçue par e-mail' : 'Demande enregistrée' }], ...o }; };
  const prive = (id, phone) => { (st.private.resiliations = st.private.resiliations || {})[C] = { ...((st.private.resiliations || {})[C] || {}), [id]: { phone } }; };
  dos('r1', { client: 'Lou Exemple', reason: 'Déménagement', source: 'mail', receivedAt: T0 - 2 * H, mail: mailDe(T0 - 2 * H) }); prive('r1', '06 00 00 00 01');
  dos('r2', { client: 'Noé Exemple', reason: 'Prix', source: 'mail', receivedAt: T0 - 9 * H, mail: mailDe(T0 - 9 * H), ownerId: 'v2', userId: 'v2' }); prive('r2', '06 00 00 00 02');
  dos('r3', { client: 'Eden Exemple', reason: 'Manque de temps', source: 'mail', receivedAt: T0 - 27 * H, effective: addDays(t, 20), mail: mailDe(T0 - 27 * H) });
  dos('r4', { client: 'Maël Exemple', reason: 'Santé', source: 'appli', channel: 'Appli adhérents', receivedAt: T0 - 50 * H, effective: addDays(t, 12), rsm: { state: 'accepted', at: T0 - 26 * H }, ownerId: 'v3', userId: 'v3', status: 'traitement', log: { o1: { at: T0 - 20 * H, by: 'v3', label: 'Offre proposée : Suspension', offer: 'Suspension', out: 'offer' } } }); prive('r4', '06 00 00 00 04');
  dos('r5', { client: 'Sasha Exemple', reason: 'Concurrence', source: 'resamania', receivedAt: T0 - 72 * H, effective: addDays(t, 25), rsm: { state: 'submitted', at: T0 - 70 * H }, ownerId: 'v4', userId: 'v4', status: 'traitement', log: { o1: { at: T0 - 24 * H, by: 'v4', label: 'Réponse envoyée par e-mail' } } }); prive('r5', '06 00 00 00 05');
  [['r6', 'Andréa Exemple', 'v1', 'resamania'], ['r7', 'Elie Exemple', 'v5', 'declaratif']].forEach(([id, nom, uid, proof], j) => {
    const at = T0 - (j + 1) * 30 * 60000; // ce matin : sauvées ce mois quel que soit le jour
    dos(id, { client: nom, reason: 'Prix', source: 'resamania', receivedAt: at - 48 * H, ownerId: uid, userId: uid, status: 'sauvee', saved: true, outcome: 'sauvee', closedAt: at, closedBy: proof === 'resamania' ? 'resamania' : uid, closedReason: proof === 'resamania' ? 'resamania' : 'fitpulse', valeur: 395 - j * 60, rsm: { state: proof === 'resamania' ? 'canceled' : 'submitted', at },
      log: { o1: { at: at - 24 * H, by: uid, label: 'Offre proposée : Changement de formule', offer: 'Changement de formule', out: 'offer' }, o2: { at, by: proof === 'resamania' ? 'system' : uid, label: proof === 'resamania' ? 'Sauvetage confirmé par Resamania' : 'Sauvée · Changement de formule' } } });
    st.entries['sv_' + id] = { id: 'sv_' + id, userId: uid, clubId: C, kpiId: 'sauvetage', date: isoOf(new Date(at)), value: 1, source: 'manual', at, proof, offer: 'Changement de formule' };
  });
  // ── Réseau de démonstration (lot I) : 2 clubs voisins, 3 commerciaux chacun, une ligue de 11,
  // un duel en cours, une félicitation, un bilan partagé et un commentaire. Graine à part : le reste
  // de la démo est inchangé.
  const R2 = rng(DEMO_VENDABLE_GRAINE + 7);
  [['nord', 'Club Démo Nord', [['n1', 'Lison', 'Marin'], ['n2', 'Tom', 'Berger'], ['n3', 'Inès', 'Carré']]], ['sud', 'Club Démo Sud', [['s1', 'Hugo', 'Lemaire'], ['s2', 'Nina', 'Royer'], ['s3', 'Yanis', 'Perret']]]].forEach(([cid, nom, vend]) => {
    st.clubs[cid] = { id: cid, name: nom, city: 'Réseau démo', createdAt: ts(addDays(t, -400)), openDays: [1, 2, 3, 4, 5, 6] };
    vend.forEach(([id, first, last]) => { st.users[id] = { id, first, last, role: 'membre', clubs: [cid], status: 'active', email: `${norm(first)}.${norm(last)}@example.com`, createdAt: ts(addDays(t, -300)) }; });
    for (let i = 2; i >= 0; i--) { const mk = addMonths(cm, -i); const fin = mk === cm ? addDays(t, -1) : `${mk}-${pad(daysIn(mk))}`; st.targets[mk] = st.targets[mk] || {};
      vend.forEach(([uid], j) => { st.targets[mk][uid] = { contrats: 16, avis: 12, impayes: 300, sauvetage: 2 };
        for (let d = mk + '-01'; d <= fin; d = addDays(d, 1)) { if (!estOuvre(d)) continue; [['contrats', 0.75], ['avis', 0.5]].forEach(([k, pp]) => { if (R2() < pp * (0.8 + j * 0.08)) { const id = 'e' + (++ne); st.entries[id] = { id, userId: uid, clubId: cid, kpiId: k, date: d, value: 1, source: 'manual', at: ts(d, 11 + Math.floor(R2() * 7), Math.floor(R2() * 60)) }; } }); } });
    }
  });
  st.duels.dd1 = { id: 'dd1', clubs: [C, 'nord'], kpiId: 'contrats', start: T0 - 3 * 864e5, end: T0 + 4 * 864e5, reward: 'Petit déjeuner offert par le club perdant', createdBy: 'u1', acceptedBy: 'u1', at: T0 - 3 * 864e5 - 36e5, status: 'live' };
  st.kudos.kd1 = { id: 'kd1', from: 'u1', to: 'v2', clubId: C, at: T0 - 20 * 36e5, reason: 'relance', text: 'Trois promesses de paiement tenues hier.', pinned: false };
  st.chat.wr1 = { id: 'wr1', channel: C, userId: 'v1', at: T0 - 26 * 36e5, text: '', wrap: { mk: addMonths(cm, -1), score: 104, rang: 1, sur: 6, best: { kpiId: 'avis', label: 'Avis Google', pct: 125 }, trophees: 3, relances: 18, sauves: 2 } };
  st.comments['c' + graineTexte('wr_wr1').toString(36)] = { cm1: { id: 'cm1', evId: 'wr_wr1', by: 'v3', to: 'v1', text: 'Bravo pour les avis.', at: T0 - 24 * 36e5 } };
  return st;
}
