// Escalade des demandes sans réponse et résumé du matin, horloge simulée (Europe/Paris, novembre : UTC+1).
import { describe, it, expect } from 'vitest';
import { planEscalade, planMatin, chiffresMatin, texteMatin, planNuit } from '../../src/resPlans.js';
import { notify } from '../../src/notify.js';
import { MemDb } from './memdb.js';

const H = 3600000; const paris = (j: string, h: number, m = 0) => Date.UTC(2026, 10, Number(j), h - 1, m); // 2026-11-j à h:m, heure de Paris
const T = paris('10', 21, 30); // demande reçue le 10 novembre à 21 h 30
const etat = (r: any = {}) => ({
  clubs: { niort: { id: 'niort', mailRules: { slaHours: 24 } } },
  users: { v1: { id: 'v1', first: 'Sam', role: 'membre', clubs: ['niort'], status: 'active' }, m1: { id: 'm1', first: 'Alex', role: 'manager', clubs: ['niort'], status: 'active', email: 'alex@club.fr' }, c1: { id: 'c1', role: 'createur', status: 'active' } },
  resiliations: { r1: { id: 'r1', clubId: 'niort', client: 'Paul Exemple', date: '2026-11-10', status: 'nouvelle', ownerId: 'v1', receivedAt: T, mail: { lastInAt: T, firstInAt: T, awaitingReply: true, inCount: 1, outCount: 0 }, ...r } },
});
// Applique les écritures du plan à l'état (escalation.h4At…).
const appliquer = (S: any, maj: Record<string, unknown>) => { for (const [p, v] of Object.entries(maj)) { const k = p.replace(/^pulse\//, '').split('/'); let o = S; k.slice(0, -1).forEach(x => { o = o[x] = o[x] || {}; }); o[k[k.length - 1]] = v; } };

describe('resEscalate', () => {
  it('reçue à 21 h 30 : H+4 envoyée à 7 h 00, pas à 1 h 30 ; H+24 à 21 h 30 le lendemain', () => {
    const S = etat();
    expect(planEscalade(S, paris('11', 1, 30)).envois).toEqual([]); // heures calmes : rien, rien de noté
    expect(S.resiliations.r1).not.toHaveProperty('escalation');
    const a = planEscalade(S, paris('11', 7, 0)); expect(a.envois.map(e => e.uid)).toEqual(['v1']); appliquer(S, a.maj);
    expect(a.envois[0].body).toBe('1 demande sans réponse depuis plus de 4 h : Paul E.');
    expect(planEscalade(S, paris('11', 7, 15)).envois).toEqual([]);
    expect(planEscalade(S, paris('11', 21, 15)).envois).toEqual([]);
    const b = planEscalade(S, paris('11', 21, 30)); expect(b.envois.map(e => e.uid)).toEqual(['m1']); expect(b.envois[0].channels).toContain('email'); appliquer(S, b.maj);
    const c = planEscalade(S, paris('12', 21, 30)); expect(c.envois.map(e => e.uid).sort()).toEqual(['c1', 'm1']);
  });
  it('une réponse détectée à H+10 empêche toute escalade', () => {
    const S = etat(); appliquer(S, planEscalade(S, paris('11', 7, 0)).maj);
    S.resiliations.r1.mail = { ...S.resiliations.r1.mail, awaitingReply: false, firstReplyAt: T + 10 * H, lastOutAt: T + 10 * H, outCount: 1 };
    expect(planEscalade(S, paris('11', 21, 30)).envois).toEqual([]);
    expect(planEscalade(S, paris('12', 21, 30)).envois).toEqual([]);
  });
  it('une nouvelle relance de l’adhérent relance le compteur', () => {
    const S = etat(); appliquer(S, planEscalade(S, paris('11', 7, 0)).maj);
    const relance = paris('11', 10, 0);
    S.resiliations.r1.mail = { ...S.resiliations.r1.mail, awaitingReply: true, lastInAt: relance, inCount: 2 };
    expect(planEscalade(S, paris('11', 13, 30)).envois).toEqual([]); // 3 h 30 après la relance
    const x = planEscalade(S, paris('11', 14, 0)); expect(x.envois.map(e => e.uid)).toEqual(['v1']); // 4 h après la relance
    appliquer(S, x.maj); expect(planEscalade(S, paris('11', 21, 30)).envois).toEqual([]); // 24 h comptées depuis la relance
  });
  it('regroupement : un seul message par destinataire, texte au pluriel, prénom et initiale', () => {
    const S: any = etat(); S.resiliations.r2 = { ...S.resiliations.r1, id: 'r2', client: 'Marie Dupont' };
    const a = planEscalade(S, paris('11', 7, 0)); expect(a.envois.length).toBe(1);
    expect(a.envois[0].body).toBe('2 demandes sans réponse depuis plus de 4 h : Paul E., Marie D.');
    expect(a.envois[0].title).toBe('Résiliations sans réponse');
  });
  it('notify : boîte de réception, push, e-mail ; rejouer le passage ne renvoie rien', async () => {
    const db = new MemDb({ pulse: { users: { m1: { id: 'm1', email: 'alex@club.fr' } } } }); const sent: string[] = [];
    const T2 = { push: async () => { sent.push('push'); return 1; }, email: async () => { sent.push('email'); } };
    const f = await notify(db, T2, 'm1', { title: 'Résiliations sans réponse', body: '1 demande', url: '/#/resiliations' }, { channels: ['inbox', 'push', 'email'], groupKey: 'k1' });
    expect(f).toEqual(['inbox', 'push', 'email']); expect(await notify(db, T2, 'm1', { title: 'x', body: 'y', url: 'z' }, { channels: ['push'], groupKey: 'k1' })).toEqual([]);
    expect(Object.keys(await db.get('pulse_inbox/m1'))).toEqual(['k1']);
  });
});
describe('resMorning', () => {
  it('texte exact, à l’heure du club, une fois par jour ; rien si a, b, d valent 0', () => {
    const S: any = etat(); const mat = paris('11', 8, 45);
    const k = chiffresMatin(S, 'niort', mat); expect([k.a, k.b, k.c, k.d, k.e]).toEqual([1, 1, 0, 0, 0]);
    expect(texteMatin(k)).toBe('Résiliations ce matin\nNouvelles depuis hier 18 h : 1\nSans réponse : 1, dont 0 depuis plus de 24 h\nEffectives sous 7 jours sans offre : 0\nSauvées hier : 0');
    expect(planMatin(S, paris('11', 8, 30)).envois).toEqual([]);
    const p = planMatin(S, mat); expect(p.envois.map(e => e.uid).sort()).toEqual(['m1', 'v1']); appliquer(S, p.maj);
    expect(planMatin(S, paris('11', 8, 50)).envois).toEqual([]);
    const vide: any = etat({ status: 'sauvee', outcome: 'sauvee', closedAt: T }); expect(planMatin(vide, paris('12', 8, 45)).envois).toEqual([]);
  });
});
describe('resNightly', () => {
  it('Resamania « canceled » : sauvée, action « Sauvetage confirmé par Resamania »', () => {
    const S: any = etat({ rsm: { state: 'canceled' } }); const maj = planNuit(S, paris('12', 2, 0));
    expect(maj['pulse/resiliations/r1/status']).toBe('sauvee'); expect(maj['pulse/resiliations/r1/closedReason']).toBe('resamania');
    expect(Object.entries(maj).find(([k]) => k.includes('/log/'))![1]).toMatchObject({ label: 'Sauvetage confirmé par Resamania' });
  });
});
