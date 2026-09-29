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
  const sig = RL.signauxRelance({ bilans: [{ date: T - 15 * J, reponseCoach: 'x' }] }, T);
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
  // Et aucun texte : il n'existe que pour les cinq.
  for (const s of interdits) assert.equal(RL.RELANCE_CORPS[s], undefined);
});

test('le texte est celui de l’app (_waCorpsGroupe), précédé du prénom', () => {
  const ici = path.dirname(fileURLToPath(import.meta.url));
  const dossier = path.join(ici, '..', '..', 'app');
  const f = fs.readdirSync(dossier).find((n) => /^rc-core\.\d+\.js$/.test(n));
  const src = fs.readFileSync(path.join(dossier, f), 'utf8');
  const i = src.indexOf('function _waCorpsGroupe(type){');
  assert.ok(i > 0);
  const corps = src.slice(i, src.indexOf('\n}', i));
  for (const s of RL.RELANCE_SIGNAUX) {
    const m = new RegExp("if\\(type==='" + s + "'\\) return '((?:[^'\\\\]|\\\\.)*)';").exec(corps);
    assert.ok(m, s + ' dans _waCorpsGroupe');
    assert.equal(m[1].replace(/\\'/g, "'"), RL.RELANCE_CORPS[s], s);
  }
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
  assert.equal(j['ailleurs@t,fr'], undefined, 'un athlète passé chez un autre coach');
  // Le lendemain, même signal : rien (la semaine est prise).
  w.avance(J);
  for (let i = 0; i < 6; i++) { await w.minute(); w.avance(60e3); }
  assert.equal(RL.journalListe(w.F.lire('relances_auto/' + COACH + '/lea@t,fr')).length, 1);
  assert.equal(w.F.recus.length, 1);
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
