// Tests des règles d'accès Fit Pulse sur le simulateur Firebase (base temps réel).
// Lancer : cd club/tests/emul && npx firebase-tools emulators:exec --only database --project fitpulse-test "node ../regles.emul.mjs"
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { avecRegle } from '../outils/fitpulse-serveur.mjs';

const HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000';
const NS = 'fitpulse-test';
const url = (p, extra = '') => `http://${HOST}/${p}.json?ns=${NS}${extra}`;
// Utilisateur simulé : en-tête administrateur + auth_variable_override (méthode documentée du simulateur).
const owner = { authorization: 'Bearer owner' };
const key = id => crypto.createHash('sha256').update(id).digest('hex').slice(0, 40);
const who = id => ({ as: JSON.stringify({ uid: 'uid_' + id, token: { email: `fp-${key(id)}@fitpulse-niort.web.app`, email_verified: false } }) });
const req = async (method, p, body, w = null) => (await fetch(url(p, `&auth_variable_override=${encodeURIComponent(w ? w.as : 'null')}`), { method, headers: { 'content-type': 'application/json', ...owner }, body: body === undefined ? undefined : JSON.stringify(body) })).status;

let fails = 0; const check = async (label, got, ok) => { const pass = ok ? got === 200 : got !== 200; console.log(`${pass ? 'OK ' : 'KO '} ${label} (${got})`); if (!pass) fails++; };

// 1. Règles : uniquement le bloc Fit Pulse, comme en production.
const rules = avecRegle('{\n  "rules": {\n  }\n}');
let r = await fetch(`http://${HOST}/.settings/rules.json?ns=${NS}`, { method: 'PUT', headers: owner, body: rules });
assert.equal(r.status, 200, 'règles refusées par le simulateur : ' + await r.text());
// 2. Données de départ (compte de service).
const boot = { [key('crea')]: 'crea', [key('mgr')]: 'mgr', [key('mem')]: 'mem', [key('mem2')]: 'mem2' };
await fetch(url(''), { method: 'PATCH', headers: owner, body: JSON.stringify({ pulse_boot: boot, pulse: { users: { crea: { id: 'crea', role: 'createur', status: 'active', clubs: ['niort'] }, mgr: { id: 'mgr', role: 'manager', status: 'active', clubs: ['niort'] }, mem: { id: 'mem', role: 'membre', status: 'active', clubs: ['niort'] }, mem2: { id: 'mem2', role: 'membre', status: 'active', clubs: ['niort'] } }, clubs: { niort: { id: 'niort', name: 'Niort' } }, audit: { a1: { at: 1, by: 'mgr', action: 'test' } } }, pulse_inbox: { mem: { n1: { title: 't', at: 1 } } }, fitpulse_secret: { vapid: { privateJwk: { d: 'x' } } } }) });

const E = (uid, extra = {}) => ({ id: 'e', userId: uid, clubId: 'niort', kpiId: 'contrats', date: '2026-10-05', value: 1, source: 'manual', at: 1, ...extra });
await check('anonyme ne lit pas /pulse', await req('GET', 'pulse'), false);
await check('membre lit /pulse', await req('GET', 'pulse', undefined, who('mem')), true);
await check('membre saisit pour lui', await req('PUT', 'pulse/entries/e1', E('mem'), who('mem')), true);
await check('membre ne saisit pas pour un collègue', await req('PUT', 'pulse/entries/e2', E('mem2'), who('mem')), false);
await check('saisie invalide refusée (date)', await req('PUT', 'pulse/entries/e3', E('mem', { date: 'hier' }), who('mem')), false);
await check('membre ne valide pas sa saisie', await req('PUT', 'pulse/entries/e1/checkedAt', 123, who('mem')), false);
await check('manager valide une saisie', await req('PUT', 'pulse/entries/e1/checkedAt', 123, who('mgr')), true);
await check('membre ne change pas de rôle', await req('PUT', 'pulse/users/mem/role', 'manager', who('mem')), false);
await check('membre crée et relance un prospect', await req('PUT', 'pulse/prospects/pm1', { id: 'pm1', clubId: 'niort', prenom: 'Julie', temp: 'chaud' }, who('mem')), true);
await check('membre planifie une relance', await req('PATCH', 'pulse/relances/prospect_pm1_x', { ownerId: 'mem', nextAt: 1, kind: 'prospect' }, who('mem')), true);
await check('membre ne modifie pas un club', await req('PUT', 'pulse/clubs/niort/name', 'X', who('mem')), false);
await check('manager modifie un club', await req('PUT', 'pulse/clubs/niort/lockDay', 5, who('mgr')), true);
await check('manager ne nomme pas un manager', await req('PUT', 'pulse/users/mem2/role', 'manager', who('mgr')), false);
await check('créateur nomme un manager', await req('PUT', 'pulse/users/mem2/role', 'manager', who('crea')), true);
await check('membre écrit dans l’audit (création)', await req('PUT', 'pulse/audit/a2', { at: 2, by: 'mem', action: 'export_csv' }, who('mem')), true);
await check('membre n’efface pas l’audit', await req('DELETE', 'pulse/audit/a1', undefined, who('mem')), false);
await check('manager n’efface pas l’audit', await req('DELETE', 'pulse/audit/a1', undefined, who('mgr')), false);
await check('membre abonne son appareil', await req('PUT', 'pulse_push/mem/h1', { endpoint: 'https://push.example/x', keys: { p256dh: 'a', auth: 'b' }, at: 1 }, who('mem')), true);
await check('membre n’abonne pas un collègue', await req('PUT', 'pulse_push/mem2/h1', { endpoint: 'https://push.example/x', keys: { p256dh: 'a', auth: 'b' }, at: 1 }, who('mem')), false);
await check('personne ne lit les abonnements', await req('GET', 'pulse_push/mem', undefined, who('mem')), false);
await check('membre lit sa boîte de réception', await req('GET', 'pulse_inbox/mem', undefined, who('mem')), true);
await check('membre ne lit pas la boîte d’un collègue', await req('GET', 'pulse_inbox/mem', undefined, who('mem2')), false);
await check('membre marque une notification lue', await req('PUT', 'pulse_inbox/mem/n1/readAt', 5, who('mem')), true);
await check('clé secrète illisible (créateur)', await req('GET', 'fitpulse_secret', undefined, who('crea')), false);
await check('membre ne dépose pas d’invitation', await req('PUT', 'fitpulse_mail/x1', { email: 'a@b.fr', first: 'A', code: 'FP-ABCD-EFGH-JKLM', role: 'membre', club: 'Niort', at: { '.sv': 'timestamp' } }, who('mem')), false);
await check('manager dépose une invitation', await req('PUT', 'fitpulse_mail/x2', { email: 'a@b.fr', first: 'A', code: 'FP-ABCD-EFGH-JKLM', role: 'membre', club: 'Niort', at: { '.sv': 'timestamp' } }, who('mgr')), true);
await check('le créateur peut tout écrire sous /pulse', await req('PUT', 'pulse/meta/x', 1, who('crea')), true);
console.log(fails ? `${fails} échec(s)` : 'Toutes les règles se comportent comme attendu.');
process.exit(fails ? 1 : 0);
