/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. */
// Plans purs des fonctions planifiées des résiliations : escalade des demandes sans réponse,
// résumé du matin, clôture de nuit. Entrée : l'état /pulse et l'heure ; sortie : les messages à
// envoyer et les écritures, sans réseau (testés avec une horloge simulée).
import { moteurRes } from './appli.js';
import { jourParis } from './ingestCore.js';

export type Canal = 'inbox' | 'push' | 'email' | 'sms';
export interface Envoi { uid: string; clubId: string; title: string; body: string; url: string; channels: Canal[]; groupKey: string; dossiers: string[] }
const H = 3600000;
const plur = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
const actif = (u: any) => u && u.status !== 'archived' && !u.virtual;
const duClub = (u: any, clubId: string) => (u.clubs || []).includes(clubId);
export const managers = (S: any, clubId: string) => Object.values(S.users || {}).filter((u: any) => actif(u) && u.role === 'manager' && duClub(u, clubId)) as any[];
export const createurs = (S: any) => Object.values(S.users || {}).filter((u: any) => actif(u) && u.role === 'createur') as any[];
// Vendeurs du jour : membres actifs du club, non déclarés absents aujourd'hui.
export const vendeursDuJour = (S: any, clubId: string, jour: string) => Object.values(S.users || {}).filter((u: any) => actif(u) && u.role === 'membre' && duClub(u, clubId) && !(((S.absences || {})[u.id] || {})[jour])) as any[];
const smsUrgent = (S: any, uid: string) => !!(((S.prefs || {})[uid] || {}).smsUrgent || ((S.users || {})[uid] || {}).smsUrgent);

// ── Escalade : toutes les 15 minutes ──────────────────────────────────────
// Paliers 4 h (responsable, sinon vendeurs présents), 24 h (managers, push et e-mail), 48 h (managers et
// créateur, push, e-mail, SMS si demandé). Heures calmes 22 h à 7 h : rien n'est envoyé ni noté, le passage
// de 7 h 00 envoie. Un seul message par destinataire et par passage.
export function planEscalade(S: any, maintenant: number): { envois: Envoi[]; maj: Record<string, unknown> } {
  const RES = moteurRes(); const jour = jourParis(maintenant); const maj: Record<string, unknown> = {}; const par = new Map<string, { clubId: string; ids: string[]; noms: string[]; h: number; canaux: Set<Canal> }>();
  if (RES.calme(maintenant)) return { envois: [], maj };
  for (const r of Object.values(S.resiliations || {}) as any[]) {
    if (!r || !RES.compte(r) || RES.phase(r, jour) !== 'attente') continue;
    const dus = RES.paliersDus(r, maintenant); if (!dus.length) continue;
    dus.forEach((p: any) => { maj[`pulse/resiliations/${r.id}/escalation/${p.k}`] = maintenant; });
    const top = dus[dus.length - 1]; let dest: any[] = []; let canaux: Canal[] = ['inbox', 'push'];
    if (top.k === 'h4At') { dest = r.ownerId && (S.users || {})[r.ownerId] ? [(S.users || {})[r.ownerId]] : vendeursDuJour(S, r.clubId, jour); if (!dest.length) dest = managers(S, r.clubId); }
    else if (top.k === 'h24At') { dest = managers(S, r.clubId); canaux = ['inbox', 'push', 'email']; }
    else { dest = [...managers(S, r.clubId), ...createurs(S)]; canaux = ['inbox', 'push', 'email']; }
    for (const u of dest) {
      const x = par.get(u.id) || { clubId: r.clubId, ids: [] as string[], noms: [] as string[], h: 0, canaux: new Set<Canal>() };
      x.ids.push(r.id); x.noms.push(RES.nomCourt(r.client)); x.h = Math.max(x.h, top.h); canaux.forEach(c => x.canaux.add(c));
      if (top.k === 'h48At' && smsUrgent(S, u.id)) x.canaux.add('sms');
      par.set(u.id, x);
    }
  }
  const envois: Envoi[] = [...par.entries()].map(([uid, x]) => ({
    uid, clubId: x.clubId, title: x.ids.length > 1 ? 'Résiliations sans réponse' : 'Résiliation sans réponse',
    body: `${plur(x.ids.length, 'demande', 'demandes')} sans réponse depuis plus de ${x.h} h : ${x.noms.slice(0, 5).join(', ')}${x.noms.length > 5 ? ', …' : ''}`,
    url: '/#/resiliations', channels: [...x.canaux], groupKey: `res_esc_${uid}_${maintenant}`, dossiers: x.ids,
  }));
  return { envois, maj };
}

// ── Résumé du matin : à l'heure choisie par le club (8 h 00 à 10 h 00) ─────
const hmParis = (ms: number) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));
const minuitParis = (jour: string) => { const midi = Date.parse(jour + 'T12:00:00Z'); const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(new Date(midi))); return Date.parse(jour + 'T00:00:00Z') - (h - 12) * H; };
export function chiffresMatin(S: any, clubId: string, maintenant: number) {
  const RES = moteurRes(); const jour = jourParis(maintenant); const hier = RES.moinsJours(jour, 1); const hier18 = minuitParis(hier) + 18 * H; const debHier = minuitParis(hier), finHier = minuitParis(jour);
  const L = (Object.values(S.resiliations || {}) as any[]).filter(r => r && r.clubId === clubId && RES.compte(r));
  const attente = L.filter(r => RES.phase(r, jour) === 'attente');
  const offre = (r: any) => RES.actions(r).some((a: any) => a.offer || /^Offre propos/.test(a.label || ''));
  const dans7 = RES.moinsJours(jour, -7);
  return {
    a: L.filter(r => RES.reception(r) >= hier18 && RES.phase(r, jour) !== 'verifier').length,
    b: attente.length, c: attente.filter(r => maintenant - RES.depart(r) > 24 * H).length,
    d: L.filter(r => RES.ouvert(r, jour) && r.effective && r.effective >= jour && r.effective <= dans7 && !offre(r)).length,
    e: L.filter(r => (r.outcome === 'sauvee' || (r.status === 'sauvee' && !r.outcome)) && r.closedAt >= debHier && r.closedAt < finHier).length,
    conformite: RES.conformite(S.resiliations, clubId, maintenant),
  };
}
export function texteMatin(k: { a: number; b: number; c: number; d: number; e: number; conformite: { manquantes: number } }): string {
  return `Résiliations ce matin\nNouvelles depuis hier 18 h : ${k.a}\nSans réponse : ${k.b}, dont ${k.c} depuis plus de 24 h\nEffectives sous 7 jours sans offre : ${k.d}\nSauvées hier : ${k.e}`
    + (k.conformite.manquantes ? `\n${k.conformite.manquantes} résiliation(s) validée(s) sans confirmation écrite` : '');
}
export function planMatin(S: any, maintenant: number): { envois: Envoi[]; maj: Record<string, unknown> } {
  const jour = jourParis(maintenant); const hm = hmParis(maintenant); const q = hm.slice(0, 3) + String(Math.floor(Number(hm.slice(3)) / 15) * 15).padStart(2, '0');
  const envois: Envoi[] = []; const maj: Record<string, unknown> = {};
  for (const [clubId, club] of Object.entries(S.clubs || {}) as [string, any][]) {
    const heure = (club.mailRules && club.mailRules.resumeHeure) || '08:45';
    if (heure !== q || club.resumeMatinJour === jour) continue;
    maj[`pulse/clubs/${clubId}/resumeMatinJour`] = jour;
    const k = chiffresMatin(S, clubId, maintenant); if (!k.a && !k.b && !k.d) continue;
    const txt = texteMatin(k); const [title, ...lignes] = txt.split('\n');
    const dest = [...managers(S, clubId), ...vendeursDuJour(S, clubId, jour)];
    dest.forEach(u => envois.push({ uid: u.id, clubId, title, body: lignes.join('\n'), url: '/#/resiliations', channels: u.role === 'manager' ? ['inbox', 'push', 'email'] : ['inbox', 'push'], groupKey: `res_matin_${clubId}_${jour}_${u.id}`, dossiers: [] }));
  }
  return { envois, maj };
}

// ── Nuit (2 h) : clôture automatique et doublons, mêmes règles que l'appli ─
export function planNuit(S: any, maintenant: number): Record<string, unknown> {
  const RES = moteurRes(); const jour = jourParis(maintenant); const maj: Record<string, unknown> = {};
  for (const clubId of Object.keys(S.clubs || {})) {
    for (const p of RES.dedupePlan(S.resiliations, clubId, jour, maintenant)) { Object.entries(p.set || {}).forEach(([k, v]) => { maj[`pulse/resiliations/${p.id}/${k}`] = v; }); if (p.action) maj[`pulse/resiliations/${p.id}/log/fu${p.action.fusion}`] = p.action; }
    for (const p of RES.autoClosePlan(S.resiliations, clubId, jour, maintenant)) {
      Object.entries(p.set).forEach(([k, v]) => { maj[`pulse/resiliations/${p.id}/${k}`] = v; });
      maj[`pulse/resiliations/${p.id}/log/nuit${jour.replace(/-/g, '')}`] = p.action;
      if (p.proof) { const sv = (S.entries || {})['sv_' + p.id]; const r = S.resiliations[p.id];
        if (sv) { maj[`pulse/entries/sv_${p.id}/proof`] = 'resamania'; maj[`pulse/entries/sv_${p.id}/proofAt`] = maintenant; }
        else if (r.ownerId) maj[`pulse/entries/sv_${p.id}`] = { id: 'sv_' + p.id, userId: r.ownerId, clubId, kpiId: 'sauvetage', date: jour, value: 1, source: 'import', at: maintenant, proof: 'resamania' }; }
    }
  }
  return maj;
}
