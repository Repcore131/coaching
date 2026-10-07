// Le support du créateur (build 1876) : réservé, journalisé, réversible.
//   node cloudflare/test/support.test.mjs
import assert from 'node:assert/strict';
import { creerBase } from '../src/base.js';
import { fausseBase } from './fausse-base.mjs';
import { creerSupport, estAdminSupport, idBilan, resumeDossier } from '../src/support.js';
import { reconnaitCreateur } from '../src/createur.js';
import { CREATOR_EMAIL } from '../src/metier.js';
import { ErreurAppel } from '../src/appels.js';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const KEV = { email: CREATOR_EMAIL, uid: 'uidKevin', emailVerifie: true };
const admin = (auth) => reconnaitCreateur('uidKevin')(auth) && auth.email === CREATOR_EMAIL;
const LEA = 'lea@t,fr';

function monde(t) {
  const F = fausseBase({
    users: {
      [LEA]: { id: 'uL', email: 'lea@t.fr', fname: 'Léa', role: 'athlete', coachEmailKey: null,
        bilans: [{ date: 100, type: 'coaching', photos: { face: 'https://x/f.jpg' } }, { date: 200, type: 'coaching' }, { date: 201, type: 'coaching' }],
        sessions_config: [{ day: 'Lundi', name: 'Aujourd’hui' }],
        sessions_config_history: [{ ts: 50, motif: 'publication', sessions_config: [{ day: 'Lundi', name: 'Hier' }] }] },
      'kevin@t,fr': { id: 'cK', role: 'coach', fname: 'Kevin' },
    },
    droits: { [LEA]: { palier: 'suivi' } },
  });
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: F.fetchImpl });
  const S = creerSupport({ db, maintenant: () => t || 1000, estAdmin: admin });
  return { F, S };
}
const journal = (F) => Object.values(F.lire('support_log') || {});

await test('refusé sans jeton, et à toute autre adresse que celle du créateur', async () => {
  const { S, F } = monde();
  for (const auth of [null, { email: 'lea@t.fr', uid: 'uidKevin', emailVerifie: true }, { email: CREATOR_EMAIL, uid: 'autre', emailVerifie: true },
    { email: CREATOR_EMAIL, uid: 'uidKevin', emailVerifie: false }])
    await assert.rejects(() => S.support({ auth, data: { action: 'lire', email: 'lea@t.fr' } }), (e) => e instanceof ErreurAppel && e.statut === 403);
  assert.equal(F.lire('support_log'), null, 'rien n’est journalisé pour un refus');
  // La règle par défaut : l'UID tant qu'il n'est pas posé ne reconnaît personne.
  assert.equal(estAdminSupport(KEV), false);
});

await test('lire : le dossier allégé (bilans résumés, historique daté), et une ligne de journal', async () => {
  const { S, F } = monde();
  const r = await S.support({ auth: KEV, data: { action: 'lire', email: 'Lea@T.fr' } });
  assert.equal(r.fname, 'Léa');
  assert.equal(r.bilans.length, 3);
  assert.equal(r.bilans[0].photos, 1);
  assert.deepEqual(r.historique, [{ index: 0, ts: 50, motif: 'publication' }]);
  assert.equal(r.droits.palier, 'suivi');
  assert.ok(!JSON.stringify(r).includes('https://x/f.jpg'), 'aucune photo');
  assert.equal(journal(F).length, 1);
});

await test('chaque action écrit support_log ; rouvrirBilan pose aCompleter', async () => {
  const { S, F } = monde(5000);
  await S.support({ auth: KEV, data: { action: 'rouvrirBilan', email: 'lea@t.fr', bilanId: 'bil_200', vues: ['face', 'back', 'xx'] } });
  assert.deepEqual(F.lire('users/' + LEA + '/bilans/1/aCompleter/vues'), ['face', 'back']);
  assert.equal(F.lire('users/' + LEA + '/updatedAt'), 5000);
  await S.support({ auth: KEV, data: { action: 'rattacher', email: 'lea@t.fr', coachEmail: 'kevin@t.fr' } });
  assert.equal(F.lire('users/' + LEA + '/coachEmailKey'), 'kevin@t,fr');
  assert.equal(F.lire('users/' + LEA + '/coachId'), 'cK');
  await S.support({ auth: KEV, data: { action: 'exporter', email: 'lea@t.fr' } });
  const l = journal(F).map((x) => x.action).sort();
  assert.deepEqual(l, ['exporter', 'rattacher', 'rouvrirBilan']);
  assert.ok(journal(F).every((x) => x.le === 5000 && x.email === LEA));
});

await test('restaurerProgramme garde l’état courant dans l’historique (« restauration »)', async () => {
  const { S, F } = monde(7000);
  await S.support({ auth: KEV, data: { action: 'restaurerProgramme', email: 'lea@t.fr', index: 0 } });
  assert.equal(F.lire('users/' + LEA + '/sessions_config/0/name'), 'Hier');
  const h = F.lire('users/' + LEA + '/sessions_config_history');
  assert.equal(h[0].motif, 'restauration');
  assert.equal(h[0].sessions_config[0].name, 'Aujourd’hui');
  assert.equal(h.length, 2);
  assert.equal(journal(F)[0].action, 'restaurerProgramme');
});

await test('retirerDoublonBilan : pierre tombale, bilan gardé 30 jours dans support_corbeille', async () => {
  const { S, F } = monde(9000);
  await S.support({ auth: KEV, data: { action: 'retirerDoublonBilan', email: 'lea@t.fr', bilanId: idBilan({ date: 201 }) } });
  const b = Object.values(F.lire('users/' + LEA + '/bilans'));
  assert.equal(b.length, 2);
  assert.equal(F.lire('users/' + LEA + '/supprimes/bilans/201|coaching'), 9000);
  const c = F.lire('support_corbeille/' + LEA + '/bil_201');
  assert.equal(c.bilan.date, 201);
  assert.equal(c.expire, 9000 + 30 * 864e5);
});

await test('signalerProbleme : un ticket par minute, diagnostic borné', async () => {
  const { S, F } = monde(1000);
  const auth = { email: 'lea@t.fr', uid: 'u', emailVerifie: true };
  await S.signalerProbleme({ auth, data: { texte: 'Mon bilan ne part pas', diag: { build: 1876, ecran: 's-bilan' } } });
  await assert.rejects(() => S.signalerProbleme({ auth, data: { texte: 'encore' } }), (e) => e.statut === 429);
  await assert.rejects(() => S.signalerProbleme({ auth, data: { texte: '  ' } }), (e) => e.statut === 400);
  const t = Object.values(F.lire('support_tickets'));
  assert.equal(t.length, 1);
  assert.equal(t[0].email, LEA);
  assert.equal(t[0].diag.build, 1876);
  const { S: S2, F: F2 } = monde(1000);
  await S2.signalerProbleme({ auth, data: { texte: 'x', diag: { e: 'y'.repeat(9000) } } });
  assert.deepEqual(Object.values(F2.lire('support_tickets'))[0].diag, { tronque: true });
  // Et le créateur les relit.
  const l = await S.support({ auth: KEV, data: { action: 'tickets' } });
  assert.equal(l.length, 1);
});

await test('resumeDossier ne porte ni photo ni réponse en clair', async () => {
  const r = resumeDossier({ bilans: [{ date: 1, reponseCoach: 'Texte privé', 'bil-photo-face': 'data:image/png;base64,AAAA' }] }, 'x');
  assert.ok(!/Texte privé|base64/.test(JSON.stringify(r)));
  assert.equal(r.bilans[0].repondu, true);
});

console.log(ok + ' tests passés');
