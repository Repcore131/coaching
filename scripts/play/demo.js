// LE COMPTE DE DÉMONSTRATION DES CAPTURES GOOGLE PLAY (10/10/2026).
// Chargé dans la page par scripts/play/captures.mjs. Tout est FICTIF et reste
// dans cette page : rien n'est envoyé (CLOUD coupé), rien n'est écrit en base.
/* global currentUser, CLOUD, DB, go, woState, renderWoEx, localISODate */
(function () {
  const J = 864e5, maintenant = Date.now();
  try { CLOUD.ok = () => false; CLOUD.canWrite = () => false; } catch (e) {}
  const serie = (poids, reps) => ({ done: true, weight: String(poids), reps: String(reps), rir: '2' });
  const PROG = [
    { name: 'SQUAT', series: 4, reps: '8', repos: '02 min 30', p: 60 },
    { name: 'HIP THRUST MACHINE', series: 4, reps: '10', repos: '02 min', p: 80 },
    { name: 'FENTES AVANT HALTERES', series: 3, reps: '10', repos: '01 min 30', p: 14 },
    { name: 'TIRAGE VERTICAL', series: 3, reps: '10', repos: '01 min 30', p: 40 },
  ];
  // Huit semaines de séances, la charge monte doucement.
  const sessions = [];
  for (let k = 24; k >= 1; k--) {
    const date = maintenant - k * 2.3 * J;
    const data = {};
    PROG.forEach((e) => { data[e.name] = { sets: Array.from({ length: e.series }, () => serie(Math.round((e.p - k * 0.5) * 2) / 2, e.reps)) }; });
    sessions.push({ id: 'demo' + k, date, slot: (k % 3) + 1, name: 'Bas du corps', data, duree: 55 * 60 });
  }
  const jour = (d) => localISODate(new Date(maintenant - d * J));
  const sessionsConfig = [1, 2, 3, 4, 5, 6, 7].map((n) => (n === 1 || n === 3 || n === 5)
    ? { active: true, name: n === 3 ? 'Haut du corps' : 'Bas du corps', exercises: PROG.map((e) => ({ name: e.name, series: e.series, reps: e.reps, repos: e.repos, description: '' })) }
    : { active: false, name: '', exercises: [] });
  const athlete = {
    id: 'demo-camille', email: 'camille@demo.repcore.invalid', fname: 'Camille', lname: 'Démo', role: 'athlete', gender: 'femme',
    status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active', createdAt: maintenant - 70 * J, birthdate: '1996-04-12', height: 168, profileWeight: 62.6,
    sessions, sessions_config: sessionsConfig, streak: 6, streakWeek: null, lastSession: sessions[sessions.length - 1].date,
    cycle: { enabled: true, suivi: 'actif', lastPeriodDate: jour(9), cycleLength: 28 }, cycleSuivi: 'actif',
    checkin: {}, nutrition: { dietType: 'flexible', objectifKcal: 2100, log: {} }, programs: {}, bilans: [], exAlias: {}, exMuscles: {},
    parcours: { fini: maintenant - 50 * J },
    // Consentement santé (art. 9 RGPD) déjà donné, et le bilan de 4 semaines
    // déjà fait : sinon ces deux écrans passent devant tout.
    consent: { health: true, policyVersion: (typeof POLICY_VERSION !== 'undefined' ? POLICY_VERSION : 1), le: maintenant - 70 * J },
    rites: [1, 2, 3, 4].map((c) => ({ cycle: c, le: maintenant - (70 - 28 * c) * J })),
    weightLog: Array.from({ length: 10 }, (_, i) => ({ date: localISODate(new Date(maintenant - (63 - i * 7) * J)), kg: Math.round((64.8 - i * 0.25) * 10) / 10 })),
  };
  const coach = {
    id: 'demo-coach', email: 'coach@demo.repcore.invalid', fname: 'Alex', lname: 'Coach', role: 'coach', coachPlan: 'coach', coachSubActive: true,
    createdAt: maintenant - 200 * J, clients: ['camille@demo.repcore.invalid', 'lea@demo.repcore.invalid', 'nora@demo.repcore.invalid'],
  };
  const autres = ['lea', 'nora'].map((n, i) => Object.assign({}, athlete, { id: 'demo-' + n, email: n + '@demo.repcore.invalid', fname: n === 'lea' ? 'Léa' : 'Nora',
    coachEmailKey: 'coach@demo,repcore,invalid', sessions: sessions.slice(i * 6) }));
  athlete.coachEmailKey = undefined;
  window.demoConnecter = function (role) {
    const users = DB.get('users') || {};
    [athlete, coach].concat(autres).forEach((u) => { users[u.email] = u; });
    try { DB.set('users', users); } catch (e) { try { localStorage.setItem('rc_users', JSON.stringify(users)); } catch (_e) {} }
    window.currentUser = role === 'coach' ? coach : athlete;
    try { currentUser = window.currentUser; } catch (e) {}
    try { DB.set('session', window.currentUser); } catch (e) {}
  };
  window.demoSeance = function () {
    window.demoConnecter('athlete');
    woState = { exercises: PROG.map((e) => ({ name: e.name, series: e.series, reps: e.reps, repos: e.repos, description: '' })),
      currentEx: 0, startTime: maintenant - 12 * 60000, timerInterval: null,
      sessionData: { SQUAT: { sets: [serie(57.5, 8), serie(57.5, 8)] } }, progName: 'Bas du corps', slot: 1, warmup: '', cooldown: '' };
    go('s-workout'); renderWoEx();
  };
  window.demoCycle = function () {
    const z = document.querySelector('[id*="cycle"]');
    if (z && z.scrollIntoView) z.scrollIntoView({ block: 'center' });
  };
})();
