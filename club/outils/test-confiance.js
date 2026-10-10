/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
// ══ FIT PULSE : test du lot Confiance (impayés et rétention) ═══════════════
// À coller dans la console du navigateur, appli ouverte et connectée.
// Le script remplace l'état par un club de test en mémoire, coupe toute
// écriture vers la base (db.set et db.batch n'écrivent que dans la copie),
// vérifie les critères des points 3, 4, 6 et 7 et le total « Impayés
// récupérés » sur l'accueil, la page Impayés, le classement et le récap,
// puis remet l'état d'origine. Une ligne OK ou KO par critère.
// Aussi lancé par club/tests/confiance.test.mjs (même code, sans navigateur).
function testConfiance() {
  const lignes = [];
  const verif = (nom, cond, detail) => { lignes.push(`${cond ? 'OK' : 'KO'} ${nom}${!cond && detail !== undefined ? ' : ' + JSON.stringify(detail) : ''}`); };
  const garde = { S, CLUB, ME, set: db.set, batch: db.batch, toast, openModal, closeModal, UI: Object.assign({}, UI) };
  const K = 'test-confiance';
  try {
    // ── Le club de test, en mémoire seulement ──
    db.set = (path, value) => { setPath(S, path, value); REV++; };
    db.batch = ops => { ops.forEach(([p, v]) => setPath(S, p, v)); REV++; };
    let MSG = '', OUV = null;
    toast = m => { MSG = String(m); }; openModal = o => { OUV = o; }; closeModal = () => { OUV = null; };
    const at10 = d => dateOf(d).getTime() + 36e6;
    const client = (id, o = {}) => ({ id, clubId: K, name: 'Client ' + id, num: id.replace(/\D/g, ''), phone: '0611223344', balance: 80, balanceAt: today(), ...o });
    S = normalizeState({
      clubs: { [K]: { id: K, name: 'Club de test' } },
      kpis: { impayes: { id: 'impayes', label: 'Impayés récupérés', unit: 'eur', enabled: true, required: true, points: 750, order: 1 } },
      users: { tu: { id: 'tu', first: 'Test', last: 'Manager', role: 'manager', status: 'active', clubs: [K] }, tv: { id: 'tv', first: 'Test', last: 'Vendeur', role: 'membre', status: 'active', clubs: [K] } },
      clients: {
        c1: client('c1'), c2: client('c2', { dunning: { ownerId: 'tv' } }), c3: client('c3', { balance: 50 }),
        c4: client('c4', { balance: 120 }), c5: client('c5', { balance: 120 }), c6: client('c6', { balance: 120 }),
        c7: client('c7', { balance: 40 }), c8: client('c8'),
        n1: client('n1', { balance: 0, start: addDays(today(), -30) }), n2: client('n2', { balance: 0, start: addDays(today(), -16) }), n3: client('n3', { balance: 0, start: addDays(today(), -16) }),
      },
      loyalty: {
        l1: { id: 'l1', clientId: 'c8', type: 'impaye', outcome: 'noanswer', userId: 'tv', at: 1000 },
        a1: { id: 'a1', clientId: 'n1', type: 'suivi15', step: 15, outcome: 'ok', userId: 'tv', at: at10(addDays(today(), -15)) },
      },
    });
    CLUB = S.clubs[K]; ME = S.users.tu; REV++;
    const ent = id => Object.values(S.entries).filter(e => e.kpiId === 'impayes' && e.clientId === id);

    // ── Point 3 : une saisie, un crédit ──
    db.batch(markPaid(S.clients.c1, 80, { author: 'tu', from: 'retention' }));
    db.batch(markPaid(S.clients.c1, 80, { author: 'tu', from: 'impayes' }));
    verif('point 3 : 80 € notés depuis Rétention puis Impayés le même jour donnent une seule saisie de 80 €', ent('c1').length === 1 && ent('c1')[0].value === 80, ent('c1'));
    db.batch(markPaid(S.clients.c2, 80, { author: 'tu' })); db.batch(markPaid(S.clients.c3, 50, { author: 'tu' }));
    verif('point 3 : crédit au responsable du dossier', (ent('c2')[0] || {}).userId === 'tv', ent('c2'));
    verif('point 3 : sans responsable, crédit à l’auteur', (ent('c3')[0] || {}).userId === 'tu', ent('c3'));
    verif('point 3 : le pavé rapide ne propose plus Impayés', !JSON.stringify(QUICK_EUR).includes('impayes'));
    verif('point 3 : la saisie détaillée d’un impayé exige un client', /obligatoire/.test(saisieClientImpaye()) && saisieClientTrouve('') === null && (saisieClientTrouve('3') || {}).id === 'c3');
    S.entries.m1 = { id: 'm1', userId: 'tv', clubId: K, kpiId: 'impayes', date: today(), value: 25, source: 'manual', at: Date.now() }; REV++;
    verif('point 3 : Membres > Contrôles liste la saisie sans client', ctlImpayes(K, curMonth()).sansClient.some(x => x.e.id === 'm1' || x.id === 'm1'), ctlImpayes(K, curMonth()).sansClient);

    // ── Point 4 : acomptes ──
    db.batch(markPaid(S.clients.c4, 50, { author: 'tu' }));
    const c4 = S.clients.c4, h4 = (c4.dunning.history || []).slice(-1)[0] || {};
    verif('point 4 : 120 € dus, acompte de 50 € : reste 70 €', c4.balance === 70 && c4.dunning.paid === 50, { balance: c4.balance, paid: c4.dunning.paid });
    verif('point 4 : statut « Acompte reçu » et ligne d’historique', dunStatus(c4) === 'partiel' && DUN_STATUS.partiel.label === 'Acompte reçu' && h4.label === `Acompte ${fmtEc(50)}, reste ${fmtEc(70)}`, h4);
    db.batch(markPaid(S.clients.c5, 30, { author: 'tu' })); db.batch(markPaid(S.clients.c5, 30, { author: 'tu' }));
    const ids5 = ent('c5').map(e => e.id);
    verif('point 4 : deux acomptes de 30 € le même jour : deux saisies distinctes', ids5.length === 2 && ids5[0] !== ids5[1] && S.clients.c5.balance === 60, ids5);
    db.batch(markPaid(S.clients.c6, 120, { author: 'tu' }));
    verif('point 4 : 120 € réglés soldent le dossier', S.clients.c6.balance === 0 && dunStatus(S.clients.c6) === 'recupere', S.clients.c6.dunning);

    // ── Point 6 : un dossier, une histoire ──
    db.batch(dunIssueOps(S.clients.c7, 'pasreponse'));
    const h7 = (S.clients.c7.dunning.history || []).slice(-1)[0] || {};
    verif('point 6 : « Pas de réponse » rangé dans l’historique du dossier, auteur et heure', h7.outcome === 'pasreponse' && h7.by === 'tu' && !!h7.at, h7);
    const t7 = loyaltyTasks(K).find(t => t.type === 'impaye' && t.client.id === 'c7');
    verif('point 6 : la Rétention lit le même historique', !!t7 && (t7.acts[0] || {}).outcome === 'pasreponse', t7 && t7.acts);
    verif('point 6 : aucune issue « Joint, OK » ni « RDV » pour un impayé', !DUN_OUT_ORDRE.some(k => /joint|rdv/i.test(k)));
    verif('point 6 : même nombre de dossiers à traiter des deux côtés', loyaltyTasks(K).filter(t => t.type === 'impaye' && t.state === 'todo').length === dunRows(K).filter(c => Number(c.balance) > 0 && dunStatus(c) !== 'perdu').length);
    db.batch(migrerLoyaltyImpayes());
    const deux = migrerLoyaltyImpayes().length;
    verif('point 6 : migration des anciennes actions impayé, drapeau posé, rejouée sans effet', S.clients.c8.dunning.migratedLoyalty === true && (S.clients.c8.dunning.history || []).filter(h => h.outcome === 'pasreponse').length === 1 && deux === 0, { hist: S.clients.c8.dunning.history, deux });

    // ── Point 7 : cadences, 4 h, Perdus ──
    const T1 = loyaltyTasks(K).filter(t => t.client.id === 'n1').map(t => t.type + ':' + t.state);
    verif('point 7 : inscrit il y a 30 jours, J+15 joint : un J+30 à faire', T1.join() === 'suivi30:todo', T1);
    const t0 = Date.now() - 120000; [0, 60000, 120000].forEach((d, i) => { S.loyalty['p' + i] = { id: 'p' + i, clientId: 'n2', type: 'suivi15', step: 15, outcome: 'noanswer', userId: 'tv', at: t0 + d }; }); REV++;
    const t2 = loyaltyTasks(K).find(t => t.client.id === 'n2') || {};
    verif('point 7 : trois « Pas de réponse » en 2 minutes comptent pour une tentative', t2.failed === 1 && t2.state === 'todo' && !t2.aConfirmer, { failed: t2.failed, state: t2.state });
    const avant = Object.keys(S.loyalty).length; MSG = '';
    ACTIONS.loyAct({ dataset: { c: 'n2', t: 'suivi15', s: '15', o: 'noanswer', v: 0 } });
    verif('point 7 : nouvel essai avant 4 h refusé, « Déjà tenté à »', /^Déjà tenté à \d\d h \d\d$/.test(MSG) && Object.keys(S.loyalty).length === avant, MSG);
    [3, 2, 1].forEach((d, i) => { S.loyalty['q' + i] = { id: 'q' + i, clientId: 'n3', type: 'suivi15', step: 15, outcome: 'noanswer', userId: 'tv', at: at10(addDays(today(), -d)) }; }); REV++;
    OUV = null; ACTIONS.loyAct({ dataset: { c: 'n3', t: 'suivi15', s: '15', o: 'lost', v: 0 } });
    const t3 = loyaltyTasks(K).find(t => t.client.id === 'n3') || {};
    verif('point 7 : Perdus passe par la fenêtre de confirmation', t3.state === 'todo' && !!OUV && /Classer perdu/.test(OUV.body + OUV.foot) && /Programmer un SMS/.test(OUV.body + OUV.foot), t3.state);
    ACTIONS.loyPerdreOk({ dataset: { c: 'n3', t: 'suivi15', s: '15' } });
    verif('point 7 : confirmé, le client passe en Perdus', (loyaltyTasks(K).find(t => t.client.id === 'n3') || {}).state === 'lost');
    verif('point 7 : le J+15 réalisé est compté dans Résultats', suivisRealises(K, curMonth()).j15 + suivisRealises(K, addMonths(curMonth(), -1)).j15 >= 1, suivisRealises(K, curMonth()));

    // ── Total « Impayés récupérés » identique partout ──
    const mk = curMonth(), r = rangeOf('month', mk);
    const accueil = recoveredFor(K, r, 'equipe');
    const impayes = recoveredParts(K, r).equipe || 0;
    const classement = Math.round(ranking(K, r, 'impayes').reduce((s, x) => s + (Number(x.real) || 0), 0) * 100) / 100;
    const recap = Math.round(monthFigures(K, mk).impayesEquipe * 100) / 100;
    const attendu = Math.round(Object.values(S.entries).filter(e => e.kpiId === 'impayes' && e.date >= r.from && e.date <= r.to).reduce((s, e) => s + Number(e.value), 0) * 100) / 100;
    verif(`total Impayés récupérés identique : accueil, Impayés, classement, récap (${fmtEc(attendu)})`, [accueil, impayes, classement, recap].every(v => v === attendu), { accueil, impayes, classement, recap, attendu });
  } catch (e) {
    lignes.push('KO erreur : ' + (e && e.message || e));
  } finally {
    S = garde.S; CLUB = garde.CLUB; ME = garde.ME; db.set = garde.set; db.batch = garde.batch; toast = garde.toast; openModal = garde.openModal; closeModal = garde.closeModal;
    for (const k of Object.keys(UI)) delete UI[k]; Object.assign(UI, garde.UI); REV++;
    if (typeof render === 'function' && typeof document !== 'undefined' && document.getElementById && document.getElementById('app')) try { render(); } catch (e) { /* écran inchangé */ }
  }
  const ko = lignes.filter(l => l.startsWith('KO')).length;
  lignes.push(ko ? `${ko} critère(s) en échec sur ${lignes.length}` : `tout est bon : ${lignes.length} critères`);
  lignes.forEach(l => console.log(l));
  return { ok: lignes.length - 1 - ko, ko, lignes };
}
testConfiance();
