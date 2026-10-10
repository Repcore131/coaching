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
const boot = { [key('crea')]: 'crea', [key('mgr')]: 'mgr', [key('mem')]: 'mem', [key('mem2')]: 'mem2', [key('mem3')]: 'mem3' };
await fetch(url(''), { method: 'PATCH', headers: owner, body: JSON.stringify({ pulse_boot: boot, pulse: { users: { crea: { id: 'crea', role: 'createur', status: 'active', clubs: ['niort'] }, mgr: { id: 'mgr', role: 'manager', status: 'active', clubs: ['niort'] }, mem: { id: 'mem', role: 'membre', status: 'active', clubs: ['niort'] }, mem2: { id: 'mem2', role: 'membre', status: 'active', clubs: ['niort'] }, mem3: { id: 'mem3', role: 'membre', status: 'active', clubs: ['niort'] } }, clubs: { niort: { id: 'niort', name: 'Niort' } }, audit: { a1: { at: 1, by: 'mgr', action: 'test' } } }, pulse_inbox: { mem: { n1: { title: 't', at: 1 } } }, fitpulse_secret: { vapid: { privateJwk: { d: 'x' } } } }) });

const E = (uid, extra = {}) => ({ id: 'e', userId: uid, clubId: 'niort', kpiId: 'contrats', date: '2026-10-05', value: 1, source: 'manual', at: 1, ...extra });
await check('anonyme ne lit pas /pulse', await req('GET', 'pulse'), false);
await check('membre lit /pulse', await req('GET', 'pulse', undefined, who('mem')), true);
await check('membre saisit pour lui', await req('PUT', 'pulse/entries/e1', E('mem'), who('mem')), true);
await check('membre ne saisit pas pour un collègue', await req('PUT', 'pulse/entries/e2', E('mem2'), who('mem')), false);
await check('saisie invalide refusée (date)', await req('PUT', 'pulse/entries/e3', E('mem', { date: 'hier' }), who('mem')), false);
await check('membre ne valide pas sa saisie', await req('PUT', 'pulse/entries/e1/checkedAt', 123, who('mem')), false);
await check('manager valide une saisie', await req('PUT', 'pulse/entries/e1/checkedAt', 123, who('mgr')), true);
const ckMem = key('code-mem'), ckX = key('code-x');
await check('membre pose sa clé « code seul »', await req('PUT', `pulse_boot/${ckMem}`, key('mem'), who('mem')), true);
await check('membre ne pose pas une clé vers un collègue', await req('PUT', `pulse_boot/${ckX}`, key('mem2'), who('mem')), false);
await check('membre efface sa clé « code seul »', await req('DELETE', `pulse_boot/${ckMem}`, undefined, who('mem')), true);
await check('anonyme lit une clé de connexion', await req('GET', `pulse_boot/${key('mem')}`), true);
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
await check('manager dépose une invitation', await req('PUT', 'fitpulse_mail/x2', { email: 'a@b.fr', first: 'A', last: 'MARTIN', code: 'FP-ABCD-EFGH-JKLM', role: 'membre', club: 'Niort', at: { '.sv': 'timestamp' } }, who('mgr')), true);
await check('le créateur peut tout écrire sous /pulse', await req('PUT', 'pulse/meta/x', 1, who('crea')), true);
await check('créateur écrit le suivi produit', await req('PUT', 'pulse_product/p01', { id: 'p01', label: 'Imports', status: 'devant' }, who('crea')), true);
await check('créateur lit le suivi produit', await req('GET', 'pulse_product', undefined, who('crea')), true);
await check('manager ne lit pas le suivi produit', await req('GET', 'pulse_product', undefined, who('mgr')), false);
await check('membre ne lit pas le suivi produit', await req('GET', 'pulse_product', undefined, who('mem')), false);
await check('manager n’écrit pas le suivi produit', await req('PUT', 'pulse_product/p01/status', 'derriere', who('mgr')), false);
await check('membre change le statut d’une demande reçue', await req('PUT', 'pulse/resRequests/niort/t1/status', 'contacte', who('mem')), true);
await check('anonyme ne lit pas les demandes reçues', await req('GET', 'pulse/resRequests', undefined), false);
await check('manager enregistre une fiche de point', await req('PUT', 'pulse/coaching/mem/2026-10-09', { date: '2026-10-09', by: 'mgr', forces: ['a', 'b'], axes: ['c', 'd'], engagement: { texte: 'x', date: '2026-10-16' } }, who('mgr')), true);
await check('membre n’écrit pas sa fiche de point', await req('PUT', 'pulse/coaching/mem/2026-10-10', { date: '2026-10-10' }, who('mem')), false);
await check('membre coche ses actions de coaching', await req('PUT', 'pulse/coaching/mem/actions/a1/done', true, who('mem')), true);
const BENCH = { v: 1, at: 1, realisation: { contrats: 0.93, avis: 1.1 }, delaiImpaye: 5, sauvetage: 0.2 };
await check('manager envoie les agrégats anonymes', await req('PUT', 'benchmark/2026-09/0123456789abcdef0123456789abcdef', BENCH, who('mgr')), true);
await check('membre n’envoie pas d’agrégats', await req('PUT', 'benchmark/2026-09/fedcba9876543210fedcba9876543210', BENCH, who('mem')), false);
await check('aucun nom dans /benchmark (champ texte refusé)', await req('PUT', 'benchmark/2026-09/0123456789abcdef0123456789abcdef', { ...BENCH, club: 'Niort' }, who('mgr')), false);
await check('aucun nom dans /benchmark (valeur texte refusée)', await req('PUT', 'benchmark/2026-09/0123456789abcdef0123456789abcdef', { ...BENCH, realisation: { contrats: 'Kévin' } }, who('mgr')), false);
await check('empreinte du club obligatoire (pas un nom en clé)', await req('PUT', 'benchmark/2026-09/Niort', BENCH, who('mgr')), false);
await check('membre lit les agrégats', await req('GET', 'benchmark/2026-09', undefined, who('mem')), true);
await check('anonyme ne lit pas les agrégats', await req('GET', 'benchmark', undefined), false);
// Mentions légales publiques (lisibles sans connexion, écrites par un manager)
await check('manager publie les mentions légales', await req('PUT', 'pulse_public/legal', { societe: 'SAS Exemple', email: 'contact@exemple.fr' }, who('mgr')), true);
await check('anonyme lit les mentions légales', await req('GET', 'pulse_public/legal', undefined), true);
await check('membre ne modifie pas les mentions légales', await req('PUT', 'pulse_public/legal/societe', 'X', who('mem')), false);
await check('rien d’autre sous pulse_public', await req('PUT', 'pulse_public/autre', 'X', who('mgr')), false);
await check('membre écrit son usage', await req('PUT', 'pulse/usage/mem/2026-10-09', { opens: 1 }, who('mem')), true);
await check('membre n’écrit pas l’usage d’un autre', await req('PUT', 'pulse/usage/mgr/2026-10-09', { opens: 1 }, who('mem')), false);
// Relève de la boîte accueil : dossiers « ml… » et battement écrits par le seul compte de service.
await fetch(url('pulse/resiliations/ml0123456789abcdef'), { method: 'PUT', headers: owner, body: JSON.stringify({ id: 'ml0123456789abcdef', clubId: 'niort', client: 'A', status: 'nouvelle', receivedAt: 1000, mail: { threadId: 't1', lastInAt: 1000, awaitingReply: true } }) });
await fetch(url('pulse/clubs/niort'), { method: 'PATCH', headers: owner, body: JSON.stringify({ name: 'Club', mailSync: { at: 5000, ok: true } }) });
await check('membre ne crée pas un dossier relevé (ml)', await req('PUT', 'pulse/resiliations/mlfffffffffffffff0', { id: 'x', clubId: 'niort', status: 'nouvelle' }, who('mem')), false);
await check('membre crée un dossier ordinaire', await req('PUT', 'pulse/resiliations/r9', { id: 'r9', clubId: 'niort', status: 'nouvelle' }, who('mem')), true);
await check('membre prend en charge un dossier relevé', await req('PATCH', 'pulse/resiliations/ml0123456789abcdef', { status: 'traitement', ownerId: 'mem' }, who('mem')), true);
await check('membre ne modifie pas le fil e-mail d’un dossier relevé', await req('PUT', 'pulse/resiliations/ml0123456789abcdef/mail/awaitingReply', false, who('mem')), false);
await check('membre ne modifie pas la date de réception d’un dossier relevé', await req('PUT', 'pulse/resiliations/ml0123456789abcdef/receivedAt', 2000, who('mem')), false);
await check('membre ne supprime pas un dossier relevé', await req('DELETE', 'pulse/resiliations/ml0123456789abcdef', undefined, who('mem')), false);
// Données privées des dossiers : manager du club et responsable du dossier seulement.
await fetch(url('pulse/resiliations/rp1'), { method: 'PUT', headers: owner, body: JSON.stringify({ id: 'rp1', clubId: 'niort', client: 'B', status: 'traitement', ownerId: 'mem' }) });
await fetch(url('private/resiliations/niort/rp1'), { method: 'PUT', headers: owner, body: JSON.stringify({ email: 'b@exemple.fr', phone: '06 00 00 00 01' }) });
await check('responsable lit l’e-mail et le téléphone de son dossier', await req('GET', 'private/resiliations/niort/rp1', undefined, who('mem')), true);
await check('vendeur non responsable ne lit pas l’e-mail ni le téléphone', await req('GET', 'private/resiliations/niort/rp1', undefined, who('mem3')), false);
await check('vendeur non responsable ne lit pas le téléphone seul', await req('GET', 'private/resiliations/niort/rp1/phone', undefined, who('mem3')), false);
await check('manager lit les données privées', await req('GET', 'private/resiliations/niort/rp1', undefined, who('mgr')), true);
await check('personne ne liste toutes les données privées', await req('GET', 'private', undefined, who('mem')), false);
await check('vendeur non responsable n’écrit pas le téléphone', await req('PUT', 'private/resiliations/niort/rp1/phone', '06 00 00 00 09', who('mem3')), false);
await check('responsable ajoute un numéro', await req('PUT', 'private/resiliations/niort/rp1/phone', '06 00 00 00 02', who('mem')), true);
await check('champ inconnu refusé', await req('PUT', 'private/resiliations/niort/rp1/note', 'x', who('mgr')), false);
await check('manager ne falsifie pas la dernière relève', await req('PUT', 'pulse/clubs/niort/mailSync', { at: 9999, ok: true }, who('mgr')), false);
await check('manager règle son club sans toucher à la relève', await req('PUT', 'pulse/clubs/niort/name', 'Club Centre', who('mgr')), true);
// Arrivée des exports : forme stricte, aucun secret possible (lot J, point 4).
await check('manager configure la boîte d’import', await req('PUT', 'pulse/ingestConfig/niort/mail', { address: 'niort-ab12@import.fitpulse.app', status: 'actif', rotatedAt: 1 }, who('mgr')), true);
await check('manager active le dépôt manuel', await req('PUT', 'pulse/ingestConfig/niort/manual', true, who('mgr')), true);
await check('aucun jeton dans la configuration (manager)', await req('PUT', 'pulse/ingestConfig/niort/api', { status: 'actif', since: 1, token: 'abc' }, who('mgr')), false);
await check('aucun mot de passe dans la configuration (créateur)', await req('PUT', 'pulse/ingestConfig/niort/mail/password', 'x', who('crea')), false);
await check('état de canal inconnu refusé', await req('PUT', 'pulse/ingestConfig/niort/drive', { folderId: '1AbCdEfGhIjKlMn', status: 'ouvert' }, who('mgr')), false);
await check('membre ne configure pas les canaux', await req('PUT', 'pulse/ingestConfig/niort/manual', true, who('mem')), false);
console.log(fails ? `${fails} échec(s)` : 'Toutes les règles se comportent comme attendu.');
process.exit(fails ? 1 : 0);
