// Les relances automatiques des coachs (lot C3) : règles, plafond, trace, frein.
//   node --test cloudflare/test/relances.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { creerBase } from '../src/base.js';
import { creerMetier, PUSH_TYPES } from '../src/metier.js';
import { minute, travaux } from '../src/planif.js';
import * as RL from '../src/relances.js';
import { fausseBase, appareil } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const PARIS = (iso) => Date.parse(iso + '+02:00');
const J = 864e5;
const T = PARIS('2026-10-06T10:31:00');     // un mardi, après 10 h 30
const tout = (o) => Object.fromEntries(RL.RELANCE_SIGNAUX.map((s) => [s, Object.assign({ actif: true, delai: 0, moyen: 'push' }, o || {})]));

// ── PURES ─────────────────────────────────────────────────────────────────
test('chaque règle choisit ses destinataires, et seulement eux', () => {
  const cas = {
    nostart: { bilans: [], createdAt: T - 5 * J },
    overdue: { bilans: [{ date: T - 20 * J, reponseCoach: 'ok' }] },
    bilan: { bilans: [{ date: T - 3 * J }] },
    expiring: { bilans: [{ date: T - 2 * J, reponseCoach: 'ok' }], status: 'COACHING_SUIVI', echeance: T + 5 * J },
    noprog: { bilans: [{ date: T - 2 * J, type: 'depart', reponseCoach: 'ok' }], programme: false },
    inactif: { bilans: [{ date: T - 13 * J, reponseCoach: 'ok' }], derniereSeance: T - 12 * J },
  };
  for (const s of RL.RELANCE_SIGNAUX) {
    const sig = RL.signauxRelance(cas[s], T);
    assert.ok(sig[s], s + ' levé');
    // La règle de CE signal seule allumée : il part. Les autres seules : rien.
    const seule = { regles: { [s]: { actif: true, delai: 0, moyen: 'push' } } };
    assert.equal(RL.choisirRelance({ cfg: seule, signaux: sig, t: T }).signal, s);
    const autres = { regles: Object.fromEntries(RL.RELANCE_SIGNAUX.filter((x) => x !== s && !sig[x]).map((x) => [x, { actif: true, delai: 0 }])) };
    assert.equal(RL.choisirRelance({ cfg: autres, signaux: sig, t: T }).signal, null, s + ' sans sa règle');
  }
  // Pas encore levés : inscrit depuis deux jours, bilan de dix jours répondu, accès à trois semaines.
  assert.deepEqual(RL.signauxRelance({ bilans: [], createdAt: T - 2 * J }, T), {});
  assert.deepEqual(RL.signauxRelance({ bilans: [{ date: T - 10 * J, reponseCoach: 'x' }], status: 'COACHING_SUIVI', echeance: T + 21 * J }, T), {});
  // Le délai : le bilan en retard depuis un jour ne part pas avec un délai de deux.
  // (Dernier bilan le lundi 21/09, cadence de 2 semaines le dimanche : échéance le 04/10,
  // en retard depuis le 05/10 à minuit, soit un jour et demi à T.)
  const sig = RL.signauxRelance({ bilans: [{ date: T - 15 * J, reponseCoach: 'x' }], cadence: { freq: 2, jour: 0 } }, T);
  assert.deepEqual(RL.choisirRelance({ cfg: { regles: { overdue: { actif: true, delai: 2 } } }, signaux: sig, t: T }), { signal: null, raison: 'delai' });
  assert.equal(RL.choisirRelance({ cfg: { regles: { overdue: { actif: true, delai: 1 } } }, signaux: sig, t: T }).signal, 'overdue');
});

test('le plafond : deux signaux le même jour, un seul part (le retard avant l’accusé de réception)', () => {
  const sig = RL.signauxRelance({ bilans: [{ date: T - 20 * J }] }, T);
  assert.ok(sig.overdue && sig.bilan, 'les deux sont levés');
  const c = RL.choisirRelance({ cfg: { regles: tout() }, signaux: sig, t: T });
  assert.equal(c.signal, 'overdue', 'overdue passe devant bilan');
  // Parti ce matin : plus rien pendant sept jours, quel que soit le signal.
  const journal = { a: { at: T - 3600e3, signal: 'overdue', depuis: c.depuis, statut: 'parti' } };
  assert.deepEqual(RL.choisirRelance({ cfg: { regles: tout() }, signaux: sig, journal, t: T }), { signal: null, raison: 'semaine' });
  assert.equal(RL.choisirRelance({ cfg: { regles: tout() }, signaux: sig, journal, t: T + 6.9 * J }).raison, 'semaine');
  // Sept jours après : le bilan part (overdue, lui, a déjà eu son message pour cet épisode).
  assert.equal(RL.choisirRelance({ cfg: { regles: tout() }, signaux: sig, journal, t: T + 7 * J }).signal, 'bilan');
  // Un refus (pas de notification) ne prend pas la semaine.
  const refus = { a: { at: T - 3600e3, signal: 'overdue', depuis: c.depuis, statut: 'non_parti', raison: 'aucun_abonnement' } };
  assert.equal(RL.choisirRelance({ cfg: { regles: tout() }, signaux: sig, journal: refus, t: T }).signal, 'overdue');
});

test('un athlète exclu, la pause, toutes les règles coupées : rien ne part', () => {
  const sig = RL.signauxRelance({ bilans: [{ date: T - 20 * J }] }, T);
  assert.equal(RL.choisirRelance({ cfg: { regles: tout(), exclus: { 'lea@t,fr': T } }, cleAthlete: 'lea@t,fr', signaux: sig, t: T }).raison, 'exclu');
  assert.equal(RL.choisirRelance({ cfg: { regles: tout(), exclus: { 'autre@t,fr': T } }, cleAthlete: 'lea@t,fr', signaux: sig, t: T }).signal, 'overdue');
  assert.equal(RL.choisirRelance({ cfg: { regles: tout(), pause: true }, signaux: sig, t: T }).raison, 'pause');
  assert.equal(RL.choisirRelance({ cfg: { regles: tout({ actif: false }) }, signaux: sig, t: T }).raison, 'coupe');
  // Coupées PAR DÉFAUT : pas de règles, des règles vides, actif « vrai » en texte.
  for (const cfg of [null, {}, { regles: {} }, { regles: tout({ actif: 'true' }) }, { regles: tout({ actif: 1 }) }])
    assert.equal(RL.choisirRelance({ cfg, signaux: sig, t: T }).signal, null, JSON.stringify(cfg));
  assert.equal(RL.relancesAllumees({ regles: tout(), pause: true }), false);
  // La ligne reportée par le coach dans « À traiter » ne part pas.
  assert.equal(RL.choisirRelance({ cfg: { regles: { overdue: { actif: true, delai: 0 } } }, signaux: sig, reports: { overdue: { until: T + J } }, t: T }).raison, 'reporte');
});

test('la douleur ne peut PAS être automatisée, quelle que soit la configuration', () => {
  const interdits = ['douleur', 'douleurdiff', 'douleurDiffuse', 'decrochage', 'entrainement', 'plateauMuscle', 'drapeau', 'saut_charge', 'calibrage', 'blocfini', 'videos', 'notes', 'rite'];
  const regles = Object.fromEntries(interdits.map((s) => [s, { actif: true, delai: 0, moyen: 'push' }]));
  for (const s of interdits) assert.ok(!RL.RELANCE_SIGNAUX.includes(s), s);
  assert.deepEqual(Object.keys(RL.reglesNormalisees(regles)).sort(), RL.RELANCE_SIGNAUX.slice().sort());
  // Des signaux inventés (tout est levé) et toutes les règles interdites allumées : rien.
  const signaux = Object.fromEntries(interdits.map((s) => [s, { depuis: 0 }]));
  assert.equal(RL.choisirRelance({ cfg: { regles }, signaux, t: T }).signal, null);
  assert.equal(RL.relancesAllumees({ regles }), false);
  // Et aucun texte : il n'existe que pour les six.
  for (const s of interdits) assert.equal(RL.RELANCE_CORPS[s], undefined);
});

test('les textes PAR DÉFAUT sont ceux de l’app (_waCorpsGroupe, RELANCE_CORPS_INACTIF), précédés du prénom', () => {
  const ici = path.dirname(fileURLToPath(import.meta.url));
  const dossier = path.join(ici, '..', '..', 'app');
  const f = fs.readdirSync(dossier).find((n) => /^rc-core\.\d+\.js$/.test(n));
  const src = fs.readFileSync(path.join(dossier, f), 'utf8');
  const i = src.indexOf('function _waCorpsGroupe(type){');
  assert.ok(i > 0);
  const corps = src.slice(i, src.indexOf('\n}', i));
  for (const s of RL.RELANCE_SIGNAUX.filter((x) => x !== 'inactif')) {
    const m = new RegExp("if\\(type==='" + s + "'\\) return '((?:[^'\\\\]|\\\\.)*)';").exec(corps);
    assert.ok(m, s + ' dans _waCorpsGroupe');
    assert.equal(m[1].replace(/\\'/g, "'"), RL.RELANCE_CORPS[s], s);
  }
  // L'inactivité n'a pas de relance WhatsApp groupée : son défaut vit à part.
  const ina = /const RELANCE_CORPS_INACTIF='((?:[^'\\]|\\.)*)';/.exec(src);
  assert.ok(ina, 'RELANCE_CORPS_INACTIF dans rc-core');
  assert.equal(ina[1].replace(/\\'/g, "'"), RL.RELANCE_CORPS.inactif);
  // La liste de l'app (RELANCE_SIGNAUX) est celle du serveur, dans le même ordre.
  const l = /const RELANCE_SIGNAUX=Object\.freeze\(\[([^\]]*)\]\)/.exec(src);
  assert.ok(l, 'RELANCE_SIGNAUX dans rc-core');
  assert.deepEqual(l[1].split(',').map((x) => x.trim().replace(/'/g, '')), RL.RELANCE_SIGNAUX);
  assert.equal(RL.texteRelance('overdue', 'Léa'), 'Salut Léa, ' + RL.RELANCE_CORPS.overdue);
  assert.equal(RL.texteRelance('overdue', ''), 'Salut ! ' + RL.RELANCE_CORPS.overdue);
  assert.ok(PUSH_TYPES.includes('relance'));
});

// ── DE BOUT EN BOUT : le travail du jour, la file, le journal ─────────────
function monde(initial, t) {
  const F = fausseBase(initial);
  let n = 0;
  const fetchCompte = (u, i) => { n++; return F.fetchImpl(u, i); };
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: fetchCompte });
  let horloge = t;
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: fetchCompte, maintenant: () => horloge });
  // Les autres travaux du jour se taisent : on ne mesure que les relances.
  for (const k of ['coachsEtUsers', 'abonnes', 'coachsAvecCanal', 'duelsActifs', 'reactionsAttente', 'activiteComptes', 'santeComptes'])
    M[k] = async () => [];
  for (const k of ['ambassadeursQuotidien', 'apresHeuresCalmes', 'parcoursJ21', 'saisonsHeure']) M[k] = async () => true;
  M.paypal = null;
  return { F, M, db, avance: (ms) => { horloge += ms; }, get t() { return horloge; },
    minute: () => { n = 0; return minute({ db, M, compteur: () => n, maintenant: () => horloge }); } };
}
const COACH = 'kev@t,fr';
const athlete = (o) => Object.assign({ role: 'athlete', coachEmailKey: COACH, fname: 'Léa', id: 'id-lea', createdAt: T - 60 * J,
  bilans: [{ date: T - 20 * J, reponseCoach: 'vu', type: 'suivi' }] }, o || {});

test('le travail du jour : une notification, une ligne au journal, et la semaine est prise', async () => {
  const tel = appareil('https://push.test/lea');
  const w = monde({
    users: { [COACH]: { role: 'coach', relancesAuto: { regles: { overdue: { actif: true, delai: 2, moyen: 'push' } } } },
      'lea@t,fr': athlete(), 'tom@t,fr': athlete({ fname: 'Tom', id: 'id-tom', bilans: [{ date: T - 3 * J, reponseCoach: 'ok' }] }),
      'ailleurs@t,fr': athlete({ coachEmailKey: 'autre@t,fr' }) },
    annuaire_coach: { [COACH]: { 'lea@t,fr': { maj: 1 }, 'tom@t,fr': { maj: 1 }, 'ailleurs@t,fr': { maj: 1 } } },
    push: { 'lea@t,fr': { x: tel.abonnement } },
  }, T);
  assert.ok(travaux(w.M).some((x) => x.nom === 'relances'));
  for (let i = 0; i < 6; i++) { await w.minute(); w.avance(60e3); }
  const j = w.F.lire('relances_auto/' + COACH) || {};
  const lea = RL.journalListe(j['lea@t,fr']);
  assert.equal(lea.length, 1);
  assert.equal(lea[0].signal, 'overdue');
  assert.equal(lea[0].statut, 'parti');
  assert.equal(lea[0].texte, 'Salut Léa, ' + RL.RELANCE_CORPS.overdue);
  assert.equal(w.F.recus.length, 1);
  const msg = tel.lire(w.F.recus[0].init.body);
  assert.equal(msg.type, 'relance');
  assert.equal(msg.body, lea[0].texte);
  assert.equal(j['tom@t,fr'], undefined, 'Tom n’a aucun signal');
  // LOT C7 : la relance partie se compte, anonyme, au jour de Paris.
  assert.equal(w.F.lire('metrics/2026-10-06/coach_relance_auto'), 1);
  assert.equal(j['ailleurs@t,fr'], undefined, 'un athlète passé chez un autre coach');
  // Le lendemain, même signal : rien (la semaine est prise).
  w.avance(J);
  for (let i = 0; i < 6; i++) { await w.minute(); w.avance(60e3); }
  assert.equal(RL.journalListe(w.F.lire('relances_auto/' + COACH + '/lea@t,fr')).length, 1);
  assert.equal(w.F.recus.length, 1);
  assert.equal(w.F.lire('metrics/2026-10-06/coach_relance_auto'), 1, 'rien ne part, rien ne se compte');
});

test('« je reprends la main » coupe aussi les relances déjà en file', async () => {
  const w = monde({
    users: { [COACH]: { role: 'coach', relancesAuto: { regles: { overdue: { actif: true, delai: 0, moyen: 'canal' } } } }, 'lea@t,fr': athlete() },
    annuaire_coach: { [COACH]: { 'lea@t,fr': { maj: 1 } } },
  }, T);
  // Le coach passe : la sous-tâche est déposée, puis il coupe tout avant qu'elle soit traitée.
  await w.M.relancesCoachUn(COACH, T);
  const file = w.F.lire('evenements') || {};
  assert.equal(Object.values(file).filter((e) => e.quoi === 'relance').length, 1);
  await w.db.ref('users/' + COACH + '/relancesAuto/pause').set(true);
  for (const id of Object.keys(file)) assert.equal(await w.M.tache(file[id]), 'pause');
  assert.equal(w.F.lire('relances_auto'), null);
  // Relâché, le moyen « canal » écrit le message privé (aucune notification).
  await w.db.ref('users/' + COACH + '/relancesAuto/pause').set(false);
  for (const id of Object.keys(file)) assert.equal(await w.M.tache(file[id]), 'envoye');
  const l = RL.journalListe(w.F.lire('relances_auto/' + COACH + '/lea@t,fr'));
  assert.equal(l.length, 1);
  assert.equal(l[0].moyen, 'canal');
  // Et rien dans le canal collectif du coach.
  assert.equal(w.F.lire('canaux'), null);
});

// ── LA CADENCE DES BILANS (30/09/2026) : overdue selon la règle de l'app ──
test('cadence : l’échéance et le retard suivent la cadence du coach, sinon la fréquence de l’athlète et le samedi', () => {
  const lun21 = PARIS('2026-09-21T19:00:00');          // lundi 21 septembre
  // Hebdo le lundi : échéance lundi 28, en retard le mardi 29 à minuit.
  assert.deepEqual(RL.echeanceBilanParis(lun21, { freq: 1, jour: 1 }, 2), { jour: '2026-09-28', freq: 1, jourSem: 1, source: 'coach' });
  assert.equal(RL.retardBilan(lun21, { freq: 1, jour: 1 }, 2, PARIS('2026-09-28T23:30:00')), null, 'le jour même : pas encore');
  assert.equal(RL.retardBilan(lun21, { freq: 1, jour: 1 }, 2, PARIS('2026-09-29T00:10:00')).depuis, PARIS('2026-09-29T00:00:00'));
  // Mensuel le jeudi : 21/09 + 28 j = lundi 19/10 → jeudi le plus proche = 22/10.
  assert.equal(RL.echeanceBilanParis(lun21, { freq: 4, jour: 4 }).jour, '2026-10-22');
  // Sans cadence : la fréquence de l'athlète, le samedi le plus proche.
  assert.equal(RL.echeanceBilanParis(lun21, null, 1).jour, '2026-09-26');
  assert.equal(RL.echeanceBilanParis(lun21, null, undefined).jour, '2026-10-03');
  assert.equal(RL.echeanceBilanParis(lun21, { freq: 3, jour: 9 }, 1).source, 'athlete', 'cadence invalide : repli');
  // Le signal overdue : dix jours après, hebdo = en retard, bimensuel = non.
  const d10 = { bilans: [{ date: T - 10 * J, reponseCoach: 'x' }] };
  assert.ok(RL.signauxRelance(Object.assign({ cadence: { freq: 1, jour: new Date(T - 3 * J).getUTCDay() } }, d10), T).overdue);
  for (let j = 0; j < 7; j++) assert.equal(RL.signauxRelance(Object.assign({ cadence: { freq: 2, jour: j } }, d10), T).overdue, undefined, 'bimensuel jour ' + j);
  // Changement d'heure (25/10) : l'échéance reste un samedi, minuit à Paris.
  const e = RL.retardBilan(PARIS('2026-10-13T10:00:00'), null, 2, Date.parse('2026-11-02T12:00:00+01:00'));
  // Mardi 13 + 14 j = mardi 27 → samedi le plus proche : le 24 ; le lendemain est le jour du changement d'heure.
  assert.equal(e.echeance, '2026-10-24');
  assert.equal(e.depuis, Date.parse('2026-10-25T00:00:00+02:00'));
});

test('le texte de l’app dit la même règle', () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const app = fs.readdirSync(path.join(dir, '../../app')).find((n) => /^rc-core\.\d+\.js$/.test(n));
  const src = fs.readFileSync(path.join(dir, '../../app', app), 'utf8');
  assert.ok(src.indexOf("quand:'le lendemain de l’échéance fixée'") > 0);
  assert.ok(src.indexOf('quatorze jours après le dernier bilan') < 0);
});

test('réponse vocale : un bilan répondu de vive voix ne lève plus le signal « bilan »', () => {
  const d = RL.signauxRelance({ bilans: [{ date: T - 2 * J, reponseAudio: { url: 'https://res.cloudinary.com/x/a.webm', duree: 40, at: T - J } }] }, T);
  assert.equal(d.bilan, undefined);
  assert.ok(RL.signauxRelance({ bilans: [{ date: T - 2 * J, reponseAudio: {} }] }, T).bilan, 'un objet sans adresse ne répond pas');
  assert.equal(RL.signauxRelance({ bilans: [{ date: T - 2 * J, reponseCoach: 'ok' }] }, T).bilan, undefined);
});

// ── L'INACTIVITÉ ET LES TEXTES DU COACH (30/09/2026) ─────────────────────
test('inactif : levé à J+10 de la dernière activité, pas avant ; jamais sans séance', () => {
  const d = (o) => Object.assign({ bilans: [{ date: T - 30 * J, reponseCoach: 'ok' }], derniereSeance: T - 10 * J }, o || {});
  const a = RL.signauxRelance(d(), T);
  assert.ok(a.inactif, 'J+10 : levé');
  assert.equal(a.inactif.depuis, T);
  assert.equal(a.inactif.jours, 10);
  assert.equal(RL.signauxRelance(d({ derniereSeance: T - 9 * J }), T).inactif, undefined, 'J+9 : pas encore');
  // Un bilan récent compte comme activité (dernierSigneDeVie de l'app).
  assert.equal(RL.signauxRelance(d({ bilans: [{ date: T - 3 * J, reponseCoach: 'ok' }] }), T).inactif, undefined);
  // Aucune séance : c'est « jamais démarré », pas une inactivité.
  assert.equal(RL.signauxRelance(d({ derniereSeance: 0 }), T).inactif, undefined);
  // Le délai du coach, borné de 7 à 21 (10 par défaut).
  assert.ok(RL.signauxRelance(d({ derniereSeance: T - 7 * J, delaiInactif: 7 }), T).inactif);
  assert.equal(RL.signauxRelance(d({ derniereSeance: T - 20 * J, delaiInactif: 21 }), T).inactif, undefined);
  assert.equal(RL.reglesNormalisees({ inactif: { actif: true, delai: 2 } }).inactif.delai, 7);
  assert.equal(RL.reglesNormalisees({ inactif: { actif: true, delai: 60 } }).inactif.delai, 21);
  assert.equal(RL.reglesNormalisees({}).inactif.delai, 10);
  assert.equal(RL.reglesNormalisees({ overdue: { delai: 60 } }).overdue.delai, 14, 'les autres gardent leurs bornes');
  // Le choix : il part dès qu'il est levé (le délai est dans le signal), avec ses jours.
  const cfg = { regles: { inactif: { actif: true, delai: 10, moyen: 'push' } } };
  assert.deepEqual(RL.choisirRelance({ cfg, signaux: a, t: T }), { signal: 'inactif', moyen: 'push', depuis: T, jours: 10 });
  // Une fois par épisode, puis la semaine ; reporté par le coach, rien.
  const journal = { a: { at: T, signal: 'inactif', depuis: T, statut: 'parti' } };
  assert.equal(RL.choisirRelance({ cfg, signaux: RL.signauxRelance(d(), T + 8 * J), journal, t: T + 8 * J }).raison, 'deja');
  assert.equal(RL.choisirRelance({ cfg, signaux: a, reports: { inactif: { until: T + J } }, t: T }).raison, 'reporte');
  assert.equal(RL.choisirRelance({ cfg: Object.assign({ pause: true }, cfg), signaux: a, t: T }).raison, 'pause');
});

test('ordre : les cinq premiers inchangés, l’inactivité en dernier', () => {
  assert.deepEqual(RL.RELANCE_SIGNAUX, ['nostart', 'overdue', 'expiring', 'noprog', 'bilan', 'inactif']);
  // Bilan en retard ET inactif le même jour : le retard part.
  const sig = RL.signauxRelance({ bilans: [{ date: T - 20 * J, reponseCoach: 'ok' }], derniereSeance: T - 15 * J }, T);
  assert.ok(sig.overdue && sig.inactif);
  assert.equal(RL.choisirRelance({ cfg: { regles: tout() }, signaux: sig, t: T }).signal, 'overdue');
});

test('texte du coach : variables remplacées ; vide ou trop long, le défaut ; nettoyé et tronqué', () => {
  assert.equal(RL.texteRelance('inactif', 'Léa', 'Hé {prénom}, {jours} jours sans te voir !', { jours: 12 }), 'Salut Léa, Hé Léa, 12 jours sans te voir !');
  assert.equal(RL.texteRelance('inactif', 'Léa', 'on se reprend {prenom} ?', {}), 'Salut Léa, on se reprend Léa ?');
  assert.equal(RL.texteRelance('inactif', 'Léa', undefined, { jours: 11 }), 'Salut Léa, ' + RL.RELANCE_CORPS.inactif.replace('{jours}', '11'));
  for (const vide of ['', '   ', null, 42, 'x'.repeat(281)])
    assert.equal(RL.texteRelance('overdue', 'Léa', vide), 'Salut Léa, ' + RL.RELANCE_CORPS.overdue, JSON.stringify(vide));
  assert.equal(RL.texteRelance('overdue', 'Léa', 'x'.repeat(280)), 'Salut Léa, ' + 'x'.repeat(280), '280 : accepté');
  assert.equal(RL.texteRelance('overdue', 'Léa', '<b>viens</b>\n\tvite'), 'Salut Léa, b viens /b vite');
  // Une variable qui fait déborder : tronqué, jamais plus de 280.
  const nom = 'A'.repeat(30), long = RL.texteRelance('overdue', nom, '{prénom}'.repeat(35));
  assert.ok(long.length === ('Salut ' + nom + ', ').length + 280 && long.endsWith('…'), long.length);
  assert.deepEqual(RL.textesNormalises({ inactif: 'ok', douleur: 'non', overdue: '  ', bilan: 3 }), { inactif: 'ok' });
});

test('l’app et le Worker composent exactement le même texte (aperçu = envoi)', () => {
  const ici = path.dirname(fileURLToPath(import.meta.url));
  const dossier = path.join(ici, '..', '..', 'app');
  const src = fs.readFileSync(path.join(dossier, fs.readdirSync(dossier).find((n) => /^rc-core\.\d+\.js$/.test(n))), 'utf8');
  const a = src.indexOf('// ── relanceTexte:debut'), b = src.indexOf('// ── relanceTexte:fin');
  assert.ok(a > 0 && b > a, 'les marqueurs de l’app ont disparu');
  const app = new Function(src.slice(a, b) + '\nreturn relanceComposer;')();
  const cas = [['Léa', 'Hé {prénom}, {jours} j', { jours: 9 }], ['', '', {}], ['  Tom  ', 'x'.repeat(281), { jours: 3 }],
    ['Zoé', '{prénom} '.repeat(40), {}], ['Ana', '<i>a</i>\u0007b', { jours: 'x' }], ['Léa', null, { jours: 14 }]];
  for (const [p, perso, v] of cas)
    assert.equal(app(RL.RELANCE_CORPS.inactif, p, perso, v), RL.relanceComposer(RL.RELANCE_CORPS.inactif, p, perso, v), JSON.stringify([p, perso]));
});

test('de bout en bout : le coach écrit sa relance d’inactivité, elle part une fois, et le journal la garde', async () => {
  const tel = appareil('https://push.test/lea');
  const perso = '{prénom}, {jours} jours sans séance : on cale un créneau cette semaine ?';
  const w = monde({
    users: { [COACH]: { role: 'coach', relancesAuto: { regles: { inactif: { actif: true, delai: 10, moyen: 'push' } }, textes: { inactif: perso } } },
      'lea@t,fr': athlete({ lastSession: T - 11 * J, sessions: [{ date: T - 11 * J }] }),
      'tom@t,fr': athlete({ fname: 'Tom', id: 'id-tom', lastSession: T - 4 * J }),
      'zoe@t,fr': athlete({ fname: 'Zoé', id: 'id-zoe', sessions: [{ date: T - 13 * J }] }) },
    annuaire_coach: { [COACH]: { 'lea@t,fr': { maj: 1 }, 'tom@t,fr': { maj: 1 }, 'zoe@t,fr': { maj: 1 } } },
    push: { 'lea@t,fr': { x: tel.abonnement } },
  }, T);
  for (let i = 0; i < 6; i++) { await w.minute(); w.avance(60e3); }
  const j = w.F.lire('relances_auto/' + COACH) || {};
  const lea = RL.journalListe(j['lea@t,fr']);
  assert.equal(lea.length, 1);
  assert.equal(lea[0].signal, 'inactif');
  assert.equal(lea[0].statut, 'parti');
  assert.equal(lea[0].texte, 'Salut Léa, Léa, 11 jours sans séance : on cale un créneau cette semaine ?');
  assert.equal(tel.lire(w.F.recus[0].init.body).body, lea[0].texte);
  assert.equal(j['tom@t,fr'], undefined, 'Tom s’est entraîné il y a quatre jours');
  // Sans lastSession, la dernière entrée de sessions fait foi ; Zoé n'a pas de notification.
  const zoe = RL.journalListe(j['zoe@t,fr']);
  assert.equal(zoe.length, 1);
  assert.equal(zoe[0].statut, 'non_parti');
  // Le lendemain puis la semaine d'après : rien de plus pour Léa (un par épisode).
  for (const pas of [J, 8 * J]) {
    w.avance(pas);
    for (let i = 0; i < 6; i++) { await w.minute(); w.avance(60e3); }
  }
  assert.equal(RL.journalListe(w.F.lire('relances_auto/' + COACH + '/lea@t,fr')).filter((e) => e.statut === 'parti').length, 1);
  assert.equal(w.F.recus.length, 1);
});

// ── SÉRIE 6 : LE DÉFAUT DE BILAN DU COACH ─────────────────────────────────
test('défaut du coach : priorité dossier > coach > RepCore, et le retard suit', () => {
  const coach = { defautsCoach: { bilan: { freq: 1, jour: 1, questions: ['a'] } } };
  assert.deepEqual(RL.cadenceEffective({ freq: 4, jour: 3 }, 2, coach), { freq: 4, jour: 3, source: 'athlete' });
  assert.deepEqual(RL.cadenceEffective(null, 2, coach), { freq: 1, jour: 1, source: 'coach' });
  assert.deepEqual(RL.cadenceEffective(null, 4, {}), { freq: 4, jour: 6, source: 'repcore' });
  assert.deepEqual(RL.cadenceEffective(null, 2, { reglagesCoach: { cadence: { freq: 2, jour: 0 } } }), { freq: 2, jour: 0, source: 'coach' });
  assert.deepEqual(RL.cadenceEffective(null, 2, { defautsCoach: { bilan: { freq: 3, jour: 9 } } }), { freq: 2, jour: 6, source: 'repcore' }, 'défaut invalide ignoré');
  // Bilan il y a 10 jours : hebdomadaire par défaut du coach → en retard ; sans défaut (2 sem.) → non.
  const sig = (c) => RL.signauxRelance({ bilans: [{ date: T - 10 * J, reponseCoach: 'ok' }], coach: c }, T);
  assert.ok(sig(coach).overdue, 'le défaut hebdomadaire lève le retard');
  assert.equal(sig({}).overdue, undefined);
});

test('l’app et le Worker résolvent la même cadence (cadenceEffective)', () => {
  const ici = path.dirname(fileURLToPath(import.meta.url));
  const dossier = path.join(ici, '..', '..', 'app');
  const src = fs.readFileSync(path.join(dossier, fs.readdirSync(dossier).find((n) => /^rc-core\.\d+\.js$/.test(n))), 'utf8');
  const a = src.indexOf('// ── cadenceEffective:debut'), b = src.indexOf('// ── cadenceEffective:fin');
  assert.ok(a > 0 && b > a, 'bloc cadenceEffective dans rc-core');
  const app = new Function(src.slice(a, b) + '\nreturn { cadenceEffective, defautBilanCoach };')();
  const coachs = [{}, { defautsCoach: { bilan: { freq: 1, jour: 1 } } }, { defautsCoach: { bilan: { freq: 4, jour: 0, questions: ['q'] } } },
    { reglagesCoach: { cadence: { freq: 2, jour: 3 } } }, { defautsCoach: { bilan: { freq: 5, jour: 1 } } }];
  const dossiers = [{}, { bilanCadence: { freq: 2, jour: 5 } }, { _bilanFreq: 4 }, { bilanCadence: { freq: 9, jour: 1 }, _bilanFreq: 1 }];
  for (const c of coachs) for (const d of dossiers) {
    const x = app.cadenceEffective(d, c);
    const y = RL.cadenceEffective(d.bilanCadence, d._bilanFreq, c);
    assert.deepEqual({ freq: x.freq, jour: x.jour, source: x.source }, y, JSON.stringify({ c, d }));
  }
});
