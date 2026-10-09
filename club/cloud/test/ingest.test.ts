// Ingestion des relèves (ingestResiliations) et source Microsoft 365 (graphPoll), contre l'émulateur de la base.
//   npm run test:emul   (lance l'émulateur puis Vitest)
import { describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { fabriquerIngestion } from '../src/ingestResiliations.js';
import { idDossier, type Db } from '../src/ingestCore.js';
import { passageGraph } from '../src/graphPoll.js';
// @ts-ignore : module JavaScript de l'appli (chargerAppli), pour lire la phase calculée par Fit Pulse
import { chargerAppli } from '../../outils/fitpulse-rapport.mjs';

if (!process.env.FIREBASE_DATABASE_EMULATOR_HOST) throw new Error('Lancer avec l’émulateur : npm run test:emul');
if (!getApps().length) initializeApp({ projectId: 'fitpulse-test', databaseURL: 'https://fitpulse-test.firebaseio.com' });
const rtdb = getDatabase();
const db: Db = { get: async p => (await rtdb.ref(p).get()).val(), update: async m => { await rtdb.ref().update(m); } };
const SECRET = 'a'.repeat(64); const T = Date.UTC(2026, 9, 12, 8);
const ingestion = fabriquerIngestion({ secret: async c => (c === 'niort' ? SECRET : null), db, maintenant: () => T + 3600000, journal: () => {} });

const fil = (o: Record<string, unknown> = {}) => ({ threadId: 't-1', link: 'https://mail.google.com/mail/#all/t-1', subject: 'Résiliation', kind: 'adherent', type: 'resiliation', score: 7, signals: ['resili'], fromName: 'Paul Exemple', fromEmail: 'paul@exemple.fr',
  name: 'Paul Exemple', clientNum: null, phone: '06 12 34 56 78', motif: 'Déménagement', effective: null, requestedAt: T, firstInAt: T, lastInAt: T, inCount: 1, firstReplyAt: null, lastOutAt: null, outCount: 0, awaitingReply: true, excerpt: null, ...o });
const corps = (threads: unknown[]) => JSON.stringify({ clubId: 'niort', mailbox: 'accueil@club.fr', runAt: new Date(T).toISOString(), version: 1, scanned: threads.length, threads });
async function appel(body: string, { secret = SECRET, temps = String(T + 3600000), club = 'niort', method = 'POST' } = {}) {
  const sig = createHmac('sha256', secret).update(temps + '.' + body).digest('hex'); let code = 0; let sortie: unknown = null;
  const res: any = { status(c: number) { code = c; return res; }, json(o: unknown) { sortie = o; }, send() {} };
  await ingestion({ method, headers: { 'x-fp-club': club, 'x-fp-time': temps, 'x-fp-signature': sig }, rawBody: Buffer.from(body) }, res);
  return { code, sortie };
}
const ID = idDossier('niort', 't-1');
beforeEach(async () => { await rtdb.ref().set({ pulse: { clubs: { niort: { id: 'niort', name: 'Club', mailRules: { slaHours: 24 } } }, clients: { c1: { id: 'c1', clubId: 'niort', name: 'Paul Exemple', num: '520001' } } } }); });

describe('ingestResiliations', () => {
  it('signature invalide : 401, aucune écriture', async () => {
    const r = await appel(corps([fil()]), { secret: 'b'.repeat(64) });
    expect(r.code).toBe(401);
    expect(await db.get('pulse/resiliations')).toBeNull(); expect(await db.get('pulse/clubs/niort/mailSync')).toBeNull();
    expect((await appel(corps([fil()]), { temps: String(T - 3600000) })).code).toBe(401); // horloge décalée de plus de 10 min
    expect((await appel(corps([fil()]), { method: 'GET' })).code).toBe(405);
  });
  it('même fil envoyé deux fois : un seul dossier, rapproché du client', async () => {
    expect((await appel(corps([fil()]))).sortie).toEqual({ created: 1, updated: 0, ignored: 0 });
    expect((await appel(corps([fil()]))).sortie).toEqual({ created: 0, updated: 1, ignored: 0 });
    const R = await db.get('pulse/resiliations'); expect(Object.keys(R)).toEqual([ID]);
    const d = R[ID]; expect(d.status).toBe('nouvelle'); expect(d.source).toBe('mail'); expect(d.clientId).toBe('c1'); expect(d.receivedAt).toBe(T); expect(d.dueAt).toBe(T + 24 * 3600000);
    expect(d.actions).toEqual([{ at: T, by: 'system', label: 'Demande reçue par e-mail' }]);
    const ms = await db.get('pulse/clubs/niort/mailSync'); expect(ms.ok).toBe(true); expect(ms.found).toBe(1);
  });
  it('un dossier passé en traitement garde son statut et son responsable après une nouvelle relève', async () => {
    await appel(corps([fil()]));
    await rtdb.ref(`pulse/resiliations/${ID}`).update({ status: 'traitement', ownerId: 'u3', outcome: null });
    await appel(corps([fil({ awaitingReply: false, firstReplyAt: T + 1800000, lastOutAt: T + 1800000, outCount: 1 })]));
    const d = await db.get(`pulse/resiliations/${ID}`);
    expect(d.status).toBe('traitement'); expect(d.ownerId).toBe('u3'); expect(d.mail.awaitingReply).toBe(false);
    expect(Object.values(d.log || {}).map((a: any) => a.label)).toEqual(['Réponse envoyée depuis la boîte accueil']);
  });
  it('un nouveau message entrant ajoute exactement une action', async () => {
    await appel(corps([fil()]));
    const nouveau = fil({ lastInAt: T + 7200000, inCount: 2 });
    await appel(corps([nouveau])); await appel(corps([nouveau]));
    const d = await db.get(`pulse/resiliations/${ID}`);
    expect(Object.values(d.log || {}).filter((a: any) => a.label === 'Nouveau message de l\'adhérent')).toHaveLength(1);
    expect(d.mail.lastInAt).toBe(T + 7200000);
  });
});

describe('ingestion : À vérifier, motif, rattachement, données privées, doublons', () => {
  it('e-mail et téléphone dans /private seulement ; e-mail du client : lien automatique', async () => {
    await rtdb.ref('pulse/clients/c2').set({ id: 'c2', clubId: 'niort', name: 'P Exemple', email: 'paul.exemple@mail.fr', phone: '06 00 00 00 07' });
    await appel(corps([fil({ threadId: 't-9', fromEmail: 'paul.exemple@mail.fr', name: 'Paul X', phone: null })]));
    const id = idDossier('niort', 't-9'); const d = await db.get(`pulse/resiliations/${id}`);
    expect(d.clientId).toBe('c2'); expect(d.clientConfidence).toBe('forte'); expect(d).not.toHaveProperty('email'); expect(d).not.toHaveProperty('phone');
    expect(await db.get(`private/resiliations/niort/${id}`)).toMatchObject({ email: 'paul.exemple@mail.fr', phone: '06 00 00 00 07' });
  });
  it('score 2 (review) : statut À vérifier ; motif hors liste : Autre', async () => {
    await appel(corps([fil({ threadId: 't-r', review: true, score: 2, motif: 'Problème de genou' })]));
    const d = await db.get(`pulse/resiliations/${idDossier('niort', 't-r')}`); expect(d.status).toBe('averifier'); expect(d.reason).toBe('Autre');
  });
  it('deux clients « Martin Durand » : aucun lien automatique', async () => {
    await rtdb.ref('pulse/clients').update({ d1: { id: 'd1', clubId: 'niort', name: 'Martin Durand' }, d2: { id: 'd2', clubId: 'niort', name: 'Durand Martin' } });
    await appel(corps([fil({ threadId: 't-md', name: 'Martin Durand', fromEmail: 'md@exemple.fr' })]));
    expect((await db.get(`pulse/resiliations/${idDossier('niort', 't-md')}`)).clientId ?? null).toBeNull();
  });
  it('même client déjà suivi (dossier ouvert) : fusion dans le plus ancien', async () => {
    await rtdb.ref('pulse/resiliations/rs1').set({ id: 'rs1', clubId: 'niort', client: 'Paul Exemple', clientId: 'c1', status: 'nouvelle', receivedAt: T - 5 * 864e5, date: '2026-10-07', rsm: { state: 'submitted' }, source: 'resamania' });
    await appel(corps([fil()]));
    const n = await db.get(`pulse/resiliations/${ID}`); const o = await db.get('pulse/resiliations/rs1');
    expect(n.outcome).toBe('doublon'); expect(n.hidden).toBe(true); expect(o.mail.threadId).toBe('t-1');
    expect(Object.values(o.log || {}).map((a: any) => a.label)).toContain('Dossier fusionné (source : E-mail)');
  });
});

describe('graphPoll (Microsoft 365)', () => {
  it('une demande puis la réponse de l’accueil : dossier en phase « encours »', async () => {
    await rtdb.ref('pulse/clubs/niort').update({ mailProvider: 'm365', m365Mailbox: 'accueil@club.fr' });
    const msgs = [
      { id: 'a', conversationId: 'conv-1', receivedDateTime: new Date(T).toISOString(), from: { emailAddress: { name: 'Lea Martin', address: 'lea@exemple.fr' } }, subject: 'Abonnement', body: { content: 'Bonjour, je souhaite résilier mon abonnement.\nLea Martin' }, webLink: 'https://outlook.office365.com/owa/?ItemID=a' },
      { id: 'b', conversationId: 'conv-1', receivedDateTime: new Date(T + 5400000).toISOString(), from: { emailAddress: { name: 'Accueil', address: 'accueil@club.fr' } }, subject: 'RE: Abonnement', body: { content: 'Bonjour, nous vous appelons demain.' }, webLink: 'https://outlook.office365.com/owa/?ItemID=b' },
    ];
    const faux: any = async (url: string) => ({ ok: true, status: 200, json: async () => (url.includes('oauth2') ? { access_token: 'jeton' } : url.includes('$search') ? { value: [msgs[0]] } : { value: msgs }) });
    await passageGraph(db, faux, { tenant: 't', id: 'i', secret: 's' }, T + 3 * 3600000);
    const d = await db.get(`pulse/resiliations/${idDossier('niort', 'conv-1')}`);
    expect(d.mail.awaitingReply).toBe(false); expect(d.mail.firstReplyAt).toBe(T + 5400000);
    const run = chargerAppli({ clubs: { niort: { id: 'niort', name: 'Club' } }, users: {}, resiliations: { [d.id]: d } });
    expect(run(`resPhase(S.resiliations['${d.id}'])`)).toBe('encours');
  });
});
