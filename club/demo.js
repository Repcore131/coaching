/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — mode démonstration (?demo=1) ═════════════════════════════
//
// Pour montrer l'appli a un prospect sans donnees reelles ni marque :
//  - aucune base Firebase (config.js laisse PARKPULSE_FIREBASE a null) ;
//  - tout ce que l'appli range dans le navigateur passe par UNE seule cle,
//    fp_demo : les vraies cles (parkpulse.v1, session, theme…) ne sont ni lues
//    ni modifiees ;
//  - jeu de donnees fictif genere par seedDemo(), connexion d'office ;
//  - bandeau fixe « Donnees fictives de demonstration » et bouton pour sortir ;
//  - ni logo ni nom de l'enseigne a l'ecran.
// L'adresse garde ?demo=1 : recharger la page reste en demonstration.

const DEMO = !!window.PARKPULSE_DEMO;
const DEMO_KEY = 'fp_demo';
const DEMO_USER = 'd1';

if (DEMO) {
  // Stockage cloisonne : un objet { cle: valeur } serialise sous fp_demo.
  let mem = null;
  const load = () => { if (mem) return mem; try { mem = JSON.parse(localStorage.getItem(DEMO_KEY) || '{}') || {}; } catch (e) { mem = {}; } return mem; };
  const save = () => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(mem)); return true; } catch (e) { return false; } };
  safeLS.get = k => { const v = load()[k]; return v == null ? null : v; };
  safeLS.set = (k, v) => { load()[k] = String(v); return save(); };
  safeLS.del = k => { if (k in load()) { delete mem[k]; save(); } };
  APP.tagline = 'Le pouls commercial de votre club';
  document.documentElement.classList.add('is-demo');
}

// Sortie : la copie de demonstration est effacee, l'adresse perd ?demo=1.
function demoQuit() {
  try { localStorage.removeItem(DEMO_KEY); } catch (e) { /* rien */ }
  const q = new URLSearchParams(location.search); q.delete('demo');
  location.replace(location.pathname + (q.toString() ? '?' + q : ''));
}

// ── Jeu de donnees fictif ─────────────────────────────────────────────────
// Un club, 6 commerciaux, 3 mois d'historique (plus le mois en cours),
// 40 relances ouvertes, 12 impayes, 8 resiliations en cours, 2 defis.
// Graine fixe : la meme demo a chaque fois.
function seedDemo() {
  const st = emptyState();
  const R = rng(20261009);
  const pick = a => a[Math.floor(R() * a.length)];
  const t = today(), cm = curMonth(), now = Date.now(), DAY = 864e5;
  const club = { ...(window.PARKPULSE_CLUB || {}), id: 'demo-centre', name: 'Club Démo Centre' };
  const C = club.id;
  st.meta.demo = true; st.meta.demoSeed = 1;
  st.clubs[C] = { ...club, createdAt: now - 400 * DAY };

  // Six commerciaux, prenoms neutres ; le premier anime l'equipe (manager).
  const team = [
    ['d1', 'Camille', 'Laurent', 'manager', 'f1', 1.08],
    ['d2', 'Charlie', 'Moreau', 'membre', 'h1', 1.02],
    ['d3', 'Sacha', 'Petit', 'membre', 'f2', .9],
    ['d4', 'Morgan', 'Roux', 'membre', 'h2', .8],
    ['d5', 'Lou', 'Garnier', 'membre', 'f1', .72],
    ['d6', 'Eden', 'Fabre', 'membre', 'h1', .62],
  ];
  const skill = {};
  team.forEach(([id, first, last, role, av, sk], i) => {
    skill[id] = sk;
    st.users[id] = { id, first, last, role, clubs: [C], avatar: av, status: 'active', email: `${norm(first)}.${norm(last)}@exemple.fr`, createdAt: now - (300 - i * 20) * DAY };
  });
  const sellers = team.map(x => x[0]);
  const seller = i => sellers[i % sellers.length];

  // Objectifs et saisies : 3 mois complets + le mois en cours jusqu'a hier.
  const months = [addMonths(cm, -3), addMonths(cm, -2), addMonths(cm, -1), cm];
  const baseT = { avis: 20, nutrition: 300, contrats: 22, accessoires: 150, impayes: 250, b2b: 2, invites: 3, sauvetage: 2, prospects: 40 };
  let eid = 0;
  const addE = o => { const id = 'e' + (++eid); st.entries[id] = { id, clubId: C, at: dateOf(o.date).getTime() + 9 * 3600000 + Math.floor(R() * 9 * 3600000), source: 'manual', ...o }; };
  months.forEach(mk => {
    st.targets[mk] = {};
    sellers.forEach(uid => {
      st.targets[mk][uid] = { ...baseT };
      const days = mk === cm ? Math.max(0, Number(t.slice(8)) - 1) : daysIn(mk);
      for (let d = 1; d <= days; d++) {
        const date = `${mk}-${pad(d)}`;
        if (dateOf(date).getDay() === 0) continue;
        const k = skill[uid] * (0.75 + R() * 0.5), per = 1.15 / daysIn(mk);
        Object.entries(baseT).forEach(([kpi, tv]) => {
          let v = tv * per * k * (0.4 + R() * 1.2);
          if (st.kpis[kpi].unit === 'qty') { v = R() < (v % 1) ? Math.ceil(v) : Math.floor(v); if (!v) return; }
          else { if (R() < .45) return; v = Math.round(v * 1.8 * 100) / 100; }
          addE({ userId: uid, kpiId: kpi, date, value: v });
        });
      }
    });
  });
  // Chiffres mensuels du club et base adherents, sur les 3 mois d'historique.
  st.monthly[C] = {}; st.base[C] = {};
  months.slice(0, 3).forEach((mk, i) => {
    const f = 0.9 + i * 0.06 + R() * 0.1;
    st.monthly[C][mk] = { contrats: Math.round(118 * f), visiteurs: Math.round(190 * f), complements: Math.round(1600 * f * 100) / 100, goodies: Math.round(430 * f * 100) / 100, impayes: Math.round(950 * f), caPack: Math.round(7900 * f) };
  });
  months.forEach((mk, i) => { const actifs = 1520 + i * 14 + Math.round(R() * 10); st.base[C][mk] = { actifs, sortants: Math.round(70 + R() * 25), objectif: actifs + 40 }; });

  // ── Adherents ──
  const P = ['Emma', 'Louis', 'Chloé', 'Jules', 'Manon', 'Arthur', 'Zoé', 'Gabriel', 'Lina', 'Raphaël', 'Jade', 'Adam', 'Alice', 'Léo', 'Rose', 'Noah', 'Anna', 'Paul', 'Mila', 'Ethan', 'Nina', 'Tom', 'Inès', 'Hugo'];
  const N = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Durand', 'Leroy', 'Simon', 'Michel', 'Garcia', 'David', 'Bertrand', 'Morel', 'Fournier', 'Mercier', 'Blanc', 'Guérin', 'Muller', 'Lemoine'];
  // noms distincts pour les demandes de resiliation : aucune ne se rattache a une fiche adherent
  const N2 = ['Roche', 'Vidal', 'Perrot', 'Colin', 'Marchal', 'Brun', 'Royer', 'Gauthier', 'Picard', 'Arnaud'];
  const OFFERS = { Basic: 24.99, Premium: 29.99, Ultimate: 39.99 };
  let cn = 0;
  // Par defaut un adherent ne declenche aucune relance (inscrit depuis longtemps,
  // contrat loin de son terme, anniversaire hors de la semaine, rien du).
  const addClient = (o = {}) => {
    const id = 'c' + (++cn), offer = pick(Object.keys(OFFERS));
    st.clients[id] = { id, clubId: C, num: String(500100 + cn), name: `${pick(P)} ${pick(N)}`, phone: `06 00 ${pad(10 + Math.floor(R() * 89))} ${pad(10 + Math.floor(R() * 89))} ${pad(10 + Math.floor(R() * 89))}`,
      birth: `${pad(1 + (Number(cm.slice(5)) + 3 + Math.floor(R() * 6)) % 12)}-${pad(1 + Math.floor(R() * 28))}`, start: addDays(t, -(90 + Math.floor(R() * 600))), end: addDays(t, 120 + Math.floor(R() * 240)),
      balance: 0, offer, price: OFFERS[offer], status: 'Client', sellerId: seller(cn), ...o };
    return st.clients[id];
  };
  for (let i = 0; i < 30; i++) addClient();
  // 12 impayes : montant du, date du premier incident, quelques dossiers deja suivis.
  const impayes = [];
  for (let i = 0; i < 12; i++) {
    const at = addDays(t, -[3, 5, 8, 12, 16, 21, 27, 33, 40, 48, 60, 75][i]);
    const c = addClient({ balance: Math.round((29.99 + R() * 140) * 100) / 100, balanceAt: at, oldestIncident: at, incidents: 1 + (i % 3) });
    if (i % 3 === 1) c.dunning = { status: 'relance', ownerId: seller(i), next: addDays(t, i % 2 ? 0 : 2), note: i % 2 ? 'Carte expirée, rappel prévu' : '' };
    if (i % 3 === 2) c.dunning = { status: 'relance', ownerId: 'd1', next: addDays(t, 4), note: 'Règlement annoncé en fin de semaine' };
    impayes.push(c);
  }
  // Relances de suivi : 6 J+15, 5 J+30, 5 fins de contrat, 4 sans mandat.
  const suivis = [];
  for (let i = 0; i < 6; i++) suivis.push(['suivi15', addClient({ start: addDays(t, -(13 + i)) })]);
  for (let i = 0; i < 5; i++) suivis.push(['suivi30', addClient({ start: addDays(t, -(29 + i * 2)) })]);
  for (let i = 0; i < 5; i++) suivis.push(['fincontrat', addClient({ end: addDays(t, 6 + i * 7) })]);
  for (let i = 0; i < 4; i++) suivis.push(['mandat', addClient({ noMandate: true, noMandateAt: addDays(t, -(2 + i * 3)) })]);
  // Anciens adherents (base de reconquete), sans relance.
  for (let i = 0; i < 8; i++) { const c = addClient({ status: 'Ancien client' }); c.endDate = addDays(t, -(95 + i * 40)); c.end = c.endDate; }

  // ── Resiliations : 8 en cours, et l'historique des 3 mois ──
  const RES = [['Prix', 'nouvelle', 4], ['Déménagement', 'nouvelle', 9], ['Manque de temps', 'traitement', 6], ['Santé', 'traitement', 21],
    ['Prix', 'traitement', 14], ['Insatisfaction', 'nouvelle', 27], ['Concurrence', 'traitement', 3], ['Manque de temps', 'nouvelle', 30]];
  const resOpenList = [];
  RES.forEach(([reason, status, eff], i) => {
    const id = 'r' + (i + 1), ago = 1 + (i * 2) % 9, at = now - ago * DAY, owner = status === 'traitement' ? seller(i + 1) : null;
    st.resiliations[id] = { id, clubId: C, client: `${pick(P)} ${N2[i]}`, date: addDays(t, -ago), effective: addDays(t, eff), reason, status, saved: false, ownerId: owner, userId: owner, at,
      actions: [{ at, by: 'd1', label: 'Demande enregistrée' }, ...(owner ? [{ at: at + DAY / 2, by: owner, label: 'Message laissé', note: 'Rappeler en fin de semaine' }] : [])] };
    resOpenList.push(st.resiliations[id]);
  });
  months.slice(0, 3).forEach((mk, mi) => {
    for (let j = 0; j < 4; j++) {
      const id = `rh${mi}_${j}`, status = j % 3 === 0 ? 'sauvee' : 'resiliee', date = `${mk}-${pad(3 + j * 6)}`, owner = seller(j + mi);
      st.resiliations[id] = { id, clubId: C, client: `${pick(P)} ${pick(N)}`, date, effective: addDays(date, 30), reason: pick(RES_REASONS), status, saved: status === 'sauvee', ownerId: owner, userId: owner, at: dateOf(date).getTime() };
      if (status === 'sauvee') st.entries['sv_' + id] = { id: 'sv_' + id, userId: owner, clubId: C, kpiId: 'sauvetage', date: addDays(date, 2), value: 1, source: 'manual', at: dateOf(date).getTime() + 2 * DAY };
    }
  });

  // ── 40 relances ouvertes : 12 impayes + 8 resiliations + 20 suivis ──
  // Etat de suivi (responsable, tentatives, prochaine action) et echanges notes.
  const rels = [
    ...impayes.map(c => ['impaye', c.id, null, c.balanceAt, (c.dunning || {}).ownerId || null]),
    ...resOpenList.map(r => ['resiliation', null, r.id, r.date, r.ownerId]),
    ...suivis.map(([kind, c]) => [kind, c.id, null, { suivi15: c.start, suivi30: c.start, fincontrat: c.end, mandat: c.noMandateAt }[kind], c.sellerId]),
  ];
  let tn = 0;
  rels.forEach(([kind, clientId, refId, anchor, owner], i) => {
    const key = relKey(kind, clientId || refId, anchor);
    const ownerId = owner || (i % 5 === 4 ? null : seller(i));
    const rec = { kind, clubId: C, status: 'todo', ownerId };
    if (i % 4 === 1) {
      // deja tente une fois, sans reponse : a rappeler
      rec.status = 'attente'; rec.attempts = 1; rec.step = 1; rec.nextAt = now - (i % 3) * 3600000;
      const id = 'tc' + (++tn);
      st.touches[id] = { id, clubId: C, clientId, refId, relKey: key, kind, at: now - (1 + i % 3) * DAY, by: ownerId || 'd1', channel: 'call', outcome: i % 2 ? 'messagerie' : 'pasreponse', note: '' };
    }
    st.relances[key] = rec;
  });

  // ── Impayes recuperes (canal equipe et automatiques) ──
  let rv = 0;
  Object.values(st.entries).filter(e => e.kpiId === 'impayes').forEach(e => { const id = 'v' + (++rv); st.recov[id] = { id, clubId: C, date: e.date, incidentDate: addDays(e.date, -(3 + rv % 20)), amount: e.value, canal: 'equipe', userId: e.userId, type: 'Prélèvements rejetés', at: e.at }; });
  months.forEach(mk => {
    const days = mk === cm ? Math.max(1, Number(t.slice(8)) - 1) : daysIn(mk);
    [['auto', 30, 42], ['client', 9, 38], ['automatismes', 6, 30]].forEach(([canal, n, avg]) => {
      for (let i = 0; i < Math.round(n * days / daysIn(mk)); i++) { const id = 'v' + (++rv), date = `${mk}-${pad(1 + Math.floor(R() * days))}`; st.recov[id] = { id, clubId: C, date, incidentDate: addDays(date, -(3 + i % 15)), amount: Math.round(avg * (0.5 + R()) * 100) / 100, canal, userId: null, type: 'Prélèvements rejetés', at: dateOf(date).getTime() }; }
    });
  });

  // ── Prospects (plus de 3 semaines : hors file de relances) et entreprises ──
  for (let i = 0; i < 24; i++) {
    const d = addDays(t, -(25 + Math.floor(R() * 65)));
    st.prospects['p' + i] = { id: 'p' + i, clubId: C, nom: pick(N), prenom: pick(P), creeLe: d, commercialId: seller(i), statut: pick(['Contacté', 'RDV pris', 'Essai', 'Visite effectuée', 'Injoignable']), provenance: pick(['Site web', 'Passage', 'Parrainage', 'Réseaux sociaux']), valeur: Math.round(R() * 5), phone: `06 00 ${pad(20 + i)} ${pad(10 + Math.floor(R() * 89))} ${pad(10 + Math.floor(R() * 89))}`, at: dateOf(d).getTime() };
  }
  [['co1', 'Société Alpha Services', 'signe', 80], ['co2', 'Cabinet Bêta Conseil', 'proposition', 35], ['co3', 'Atelier Gamma', 'rdv', 20]].forEach(([id, nom, statut, effectif]) => {
    st.companies[id] = { id, clubId: C, nom, statut, effectif, ownerId: 'd2', adherents: statut === 'signe' ? 4 : 0, nums: [], signeLe: statut === 'signe' ? addDays(t, -40) : null, at: now };
  });

  // ── 2 defis : un en cours, un termine ──
  st.challenges.ch1 = { id: 'ch1', clubId: C, title: 'Sprint contrats', desc: 'Le plus de contrats signés en 48 h, rapporté à l’objectif de chacun.', kpiId: 'contrats', start: now - 20 * 3600000, end: now + 28 * 3600000, by: 'd1' };
  st.challenges.ch2 = { id: 'ch2', clubId: C, title: 'Semaine nutrition', desc: 'Ventes nutrition sur 72 h, rapportées à l’objectif.', kpiId: 'nutrition', start: now - 24 * DAY, end: now - 21 * DAY, by: 'd1' };

  // ── Vie d'equipe ──
  st.chat.m1 = { id: 'm1', channel: C, userId: 'd1', text: 'Beau mois dernier, merci à tous. Objectif du mois : garder le rythme sur les contrats.', at: now - 2 * DAY };
  st.chat.m2 = { id: 'm2', channel: C, userId: 'd3', text: 'Je prends les relances J+15 cette semaine.', at: now - DAY, parentId: 'm1' };
  st.chat.m3 = { id: 'm3', channel: C, userId: 'd2', text: 'Sprint contrats lancé, à vous de jouer.', at: now - 19 * 3600000 };
  st.paliers = { [C]: { [cm]: { contrats: [{ target: 100, reward: 'Prime 50 € chacun' }, { target: 130, reward: 'Prime 100 € chacun' }], avis: [{ target: 100, reward: 'Petit-déjeuner d’équipe' }] } } };
  const libIds = Object.keys(st.tasks.library);
  st.tasks.plan[C] = {};
  [[7, 0], [9, 6], [11, 9], [14, 10], [17, 14], [20, 31]].forEach(([h, k], i) => { st.tasks.plan[C]['p' + i] = { id: 'p' + i, taskId: libIds[k], hour: h }; });
  return st;
}

// Demarrage en demonstration : donnees fictives si besoin, connexion d'office.
function demoStart() {
  if (!S || !S.meta || !S.meta.demoSeed) { S = normalizeState(seedDemo()); backend.replaceAll(); }
  if (!safeLS.get(SESSION_KEY) || !S.users[safeLS.get(SESSION_KEY)]) safeLS.set(SESSION_KEY, DEMO_USER);
}

// ── Bandeau fixe ──────────────────────────────────────────────────────────
if (DEMO) {
  const bar = document.createElement('div');
  bar.id = 'demo-bar'; bar.setAttribute('role', 'status');
  bar.innerHTML = '<b>Données fictives de démonstration</b><button type="button" class="btn sm">Quitter la démo</button>';
  bar.querySelector('button').addEventListener('click', demoQuit);
  document.body.prepend(bar);
}

// ── Sans marque ───────────────────────────────────────────────────────────
// Les textes de l'appli (scripts d'appel, SMS, mentions) citent l'enseigne :
// en demonstration, tout ce qui s'affiche en est nettoye au vol.
const DEMO_BRAND = [
  [/«\s*Fitness Park\s*» est une marque[^.]*\.\s*/gi, ''],
  [/,? il n’est ni édité ni approuvé par le réseau Fitness Park/gi, ''],
  [/\s*\(Fitness Park[^)]*\)/gi, ''],
  [/(clubs?) Fitness Park(?: Niort)?/gi, '$1'],
  [/abonnement Fitness Park/gi, 'abonnement'],
  [/Fitness Park Niort/gi, 'Club Démo Centre'],
  [/Fitness Park\s+/gi, ''],
  [/Fitness Park/gi, 'votre club'],
  [/Fitness%20Park%20/gi, ''],
  [/Fitness%20Park/gi, 'votre%20club'],
];
const demoUnbrand = s => DEMO_BRAND.reduce((a, [re, to]) => a.replace(re, to), s);
const DEMO_ATTRS = ['value', 'placeholder', 'title', 'alt', 'aria-label', 'href', 'content'];
function demoScrub(root) {
  if (root.nodeType === 3) { if (/Fitness.Park/i.test(root.nodeValue)) root.nodeValue = demoUnbrand(root.nodeValue); return; }
  if (root.nodeType !== 1) return;
  const els = [root, ...root.querySelectorAll('*')];
  for (const el of els) for (const a of DEMO_ATTRS) { const v = el.getAttribute(a); if (v && /Fitness.Park/i.test(v)) el.setAttribute(a, demoUnbrand(v)); }
  for (const el of els) if (el.tagName === 'TEXTAREA' && /Fitness.Park/i.test(el.value)) el.value = demoUnbrand(el.value);
  const w = document.createTreeWalker(root, 4) /* texte seulement */; let n;
  while ((n = w.nextNode())) if (/Fitness.Park/i.test(n.nodeValue)) n.nodeValue = demoUnbrand(n.nodeValue);
}
if (DEMO) {
  document.title = 'Fit Pulse · démonstration';
  const meta = document.querySelector('meta[name=description]'); if (meta) meta.setAttribute('content', 'Fit Pulse : le pouls commercial de votre club.');
  new window.MutationObserver(list => { for (const m of list) { if (m.type === 'characterData') demoScrub(m.target); else m.addedNodes.forEach(demoScrub); } })
    .observe(document.body, { childList: true, subtree: true, characterData: true });
}
