// Ossature d'ingestion (lot J, points 6, 8 et 10) : file par club, essais, doublons, Drive, réceptions.
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { ingestFile, processIngest, ecrireParLots, rejouerAttentes, nomFile, type Deps, type Moteur, type Tache, type Plan } from '../../src/ingest/core.js';
import { releverDrive, type DriveApi } from '../../src/ingest/drive.js';
import { lireMultipart, fabriquerReceptionScript, fabriquerReceptionMail, annuaire } from '../../src/ingest/reception.js';
import { MemDb } from './memdb.js';

const plan = (o: Partial<Plan> = {}): Plan => ({ ops: [[['entries', 'r1'], { id: 'r1', value: 1 }]], summary: { entries: 1 }, pending: [], lignes: {}, rowsRead: 3, warnings: [], ...o });
function banc(moteur?: Moteur) {
  const db = new MemDb(); const objets = new Map<string, Buffer>(); const taches: Array<{ t: Tache; delai: number }> = []; const alertes: string[] = [];
  const d: Deps = { db, moteur, stockage: { ecrire: async (o, b) => { objets.set(o, b); }, lire: async o => { const b = objets.get(o); if (!b) throw new Error('absent'); return b; } }, file: { pousser: async (t, delai = 0) => { taches.push({ t, delai }); } }, alerte: async (c, x) => { alertes.push(c + ':' + x); }, maintenant: () => 1_000 };
  return { db, d, objets, taches, alertes };
}
const res = () => { const r: any = { code: 0, corps: null, status(c: number) { r.code = c; return r; }, json(x: any) { r.corps = x; return r; }, send() { return r; } }; return r; };

describe('ingestFile et processIngest', () => {
  it('un même fichier déposé deux fois n’est importé qu’une fois ; un PDF est ignoré « non tabulaire »', async () => {
    const { d, taches } = banc();
    const a = await ingestFile(d, 'niort', Buffer.from('a;b\n1;2'), { canal: 'drive', name: 'RSM_ventes.csv' });
    const b = await ingestFile(d, 'niort', Buffer.from('a;b\n1;2'), { canal: 'mail', name: 'copie.csv' });
    expect(a.statut).toBe('queued'); expect(b.statut).toBe('doublon'); expect(taches.length).toBe(1);
    expect(taches[0].t.clubId).toBe('niort'); expect(nomFile('niort')).toBe('ingest-niort');
    expect(await ingestFile(d, 'niort', Buffer.from('%PDF'), { canal: 'drive', name: 'rapport.pdf' })).toEqual({ statut: 'ignoré', raison: 'non tabulaire' });
  });
  it('rapport done ; vendeur inconnu : done_with_pending, ligne en attente, rejouée au rattachement', async () => {
    const lignes = [{ defId: 'ventes', file: 'v.csv', entries: [{ key: 'k1', kpiId: 'contrats', date: '2026-10-01', value: 1 }] }];
    const moteur: Moteur = { planifier: async () => plan({ ops: [], summary: { entries: 0 }, pending: [{ kind: 'seller', label: 'Zoé I', keys: ['zinc'], count: 1 }], lignes: { zinc: lignes } }), rejouer: async (p, uid) => [[['entries', 'rX'], { id: 'rX', userId: uid }]] };
    const { d, db } = banc(moteur);
    const r: any = await ingestFile(d, 'niort', Buffer.from('x'), { canal: 'mail', name: 'v.csv' });
    expect(await processIngest(d, { clubId: 'niort', id: r.id, essai: 1 })).toBe('done_with_pending');
    expect(db.data.pulse).toBeUndefined(); // aucune saisie au nom du vendeur inconnu
    const rep = db.data.ingest.niort.reports[r.id]; expect(rep).toMatchObject({ status: 'done_with_pending', pending: 1, rowsRead: 3, canal: 'mail' });
    expect(Object.values<any>(db.data.ingest.niort.pending)[0].lignes).toEqual(lignes);
    expect(await rejouerAttentes(d, 'niort', 'zinc', 'u7')).toBe(1);
    expect(db.data.pulse.entries.rX.userId).toBe('u7'); expect(Object.keys(db.data.ingest.niort.pending || {}).length).toBe(0);
  });
  it('3 échecs : nouvel essai après 1 min puis 5 min, puis failed et alerte import_failed', async () => {
    const moteur: Moteur = { planifier: async () => { throw new Error('fichier illisible'); } };
    const { d, db, taches, alertes } = banc(moteur);
    const r: any = await ingestFile(d, 'niort', Buffer.from('y'), { canal: 'mail', name: 'x.csv' });
    expect(await processIngest(d, { clubId: 'niort', id: r.id, essai: 1 })).toBe('queued');
    expect(await processIngest(d, { clubId: 'niort', id: r.id, essai: 2 })).toBe('queued');
    expect(await processIngest(d, { clubId: 'niort', id: r.id, essai: 3 })).toBe('failed');
    expect(taches.slice(1).map(x => x.delai)).toEqual([60, 300]);
    expect(db.data.ingest.niort.reports[r.id].status).toBe('failed'); expect(alertes.length).toBe(1);
  });
  it('écritures par lots de 500 chemins', async () => {
    const db = new MemDb(); let n = 0; const up = db.update.bind(db); db.update = async m => { n++; return up(m); };
    await ecrireParLots(db, Array.from({ length: 1201 }, (_, i) => [['entries', 'e' + i], { v: i }] as [string[], unknown]));
    expect(n).toBe(3); expect(Object.keys(db.data.pulse.entries).length).toBe(1201);
  });
  it('deux fichiers du même club ne sont jamais traités en parallèle ; deux clubs, si', async () => {
    // File simulée : une file par club (nomFile), une tâche à la fois par file, comme maxConcurrentDispatches = 1.
    let enCours: Record<string, number> = {}; let maxClub = 0; let maxTotal = 0; let total = 0;
    const moteur: Moteur = { planifier: async c => { enCours[c] = (enCours[c] || 0) + 1; total++; maxClub = Math.max(maxClub, enCours[c]); maxTotal = Math.max(maxTotal, total); await new Promise(r => setTimeout(r, 20)); enCours[c]--; total--; return plan(); } };
    const { d } = banc(moteur); const files: Record<string, Promise<unknown>> = {};
    d.file = { pousser: async t => { const q = nomFile(t.clubId); files[q] = (files[q] || Promise.resolve()).then(() => processIngest(d, t)); } };
    for (const [c, x] of [['niort', 'a'], ['niort', 'b'], ['lyon', 'c'], ['lyon', 'd']]) await ingestFile(d, c, Buffer.from(x), { canal: 'mail', name: x + '.csv' });
    await Promise.all(Object.values(files));
    expect(maxClub).toBe(1); expect(maxTotal).toBe(2);
  });
});

describe('relève Drive', () => {
  it('fichiers du dossier seulement, doublon ignoré, PDF non tabulaire, marque appProperties sans suppression', async () => {
    const { d, db } = banc(); const lus: string[] = []; const marques: string[] = []; let requete = '';
    const contenu: Record<string, string> = { f1: 'a;b', f2: 'a;b', f4: 'z' };
    const drive: DriveApi = { lister: async q => { requete = q; return [{ id: 'f1', name: 'v.csv', modifiedTime: '', parents: ['DOSSIER0123'] }, { id: 'f2', name: 'v-copie.csv', modifiedTime: '', parents: ['DOSSIER0123'] }, { id: 'f3', name: 'note.pdf', modifiedTime: '', parents: ['DOSSIER0123'] }, { id: 'f4', name: 'autre.csv', modifiedTime: '', parents: ['AILLEURS000'] }]; },
      telecharger: async id => { lus.push(id); return Buffer.from(contenu[id]); }, marquer: async id => { marques.push(id); } };
    const n = await releverDrive({ ...d, drive }, 'niort', 'DOSSIER0123');
    expect(requete).toContain("'DOSSIER0123' in parents and modifiedTime > "); expect(n).toMatchObject({ importes: 1, doublons: 1, ignores: 1 });
    expect(lus).toEqual(['f1', 'f2']); expect(marques).toEqual(['f1', 'f2']);
    expect(Object.values<any>(db.data.ingest.niort.reports).find(r => r.file === 'note.pdf').warnings).toEqual(['non tabulaire']);
  });
});

describe('réceptions', () => {
  const corpsMultipart = (gmailId: string, nom: string, contenu: string) => { const b = 'XyZ'; return { type: `multipart/form-data; boundary=${b}`, corps: Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="gmailId"\r\n\r\n${gmailId}\r\n--${b}\r\nContent-Disposition: form-data; name="file"; filename="${nom}"\r\nContent-Type: text/csv\r\n\r\n${contenu}\r\n--${b}--\r\n`) }; };
  it('script Gmail : multipart lu, mauvais jeton 401, un même message traité deux fois ne crée qu’un import', async () => {
    const { d, taches } = banc(); const h = fabriquerReceptionScript({ deps: d, jeton: async c => (c === 'niort' ? 'JETON' : null) });
    const m = corpsMultipart('18c2abc', 'RSM_clients.csv', 'a;b\n1;2'); expect(lireMultipart(m.corps, m.type).map(p => p.filename || p.name)).toEqual(['gmailId', 'RSM_clients.csv']);
    const r0 = res(); await h({ method: 'POST', headers: { 'x-club-id': 'niort', 'x-club-token': 'FAUX!', 'content-type': m.type }, rawBody: m.corps }, r0); expect(r0.code).toBe(401);
    const r1 = res(); await h({ method: 'POST', headers: { 'x-club-id': 'niort', 'x-club-token': 'JETON', 'content-type': m.type }, rawBody: m.corps }, r1); expect(r1.code).toBe(200);
    const m2 = corpsMultipart('18c2abc', 'RSM_clients.csv', 'a;b\n1;2;modifié'); const r2 = res();
    await h({ method: 'POST', headers: { 'x-club-id': 'niort', 'x-club-token': 'JETON', 'content-type': m2.type }, rawBody: m2.corps }, r2); expect(r2.code).toBe(409);
    expect(taches.length).toBe(1);
  });
  it('adresse d’import : expéditeur hors liste blanche en quarantaine ; adresse régénérée refusée sous 1 minute ; 25 Mo et SPF/DKIM', async () => {
    const { d, db, taches } = banc(); let t = 1_700_000_000_000; d.maintenant = () => t;
    await db.update({ 'pulse/ingestConfig/niort/mail': { address: 'club-niort-ab12@import.fitpulse.app', status: 'actif', allow: { 0: 'exports@resamania.example', 1: '@club.example' } } });
    const h = fabriquerReceptionMail({ deps: d, secret: async () => 'SEC', clubDe: annuaire(db, () => t) });
    const envoi = async (m: any) => { const corps = Buffer.from(JSON.stringify(m)); const ts = String(t); const r = res(); await h({ method: 'POST', headers: { 'x-fp-time': ts, 'x-fp-signature': createHmac('sha256', 'SEC').update(ts + '.').update(corps).digest('hex') }, rawBody: corps }, r); return r; };
    const base = { to: 'club-niort-ab12@import.fitpulse.app', from: 'transfert@club.example', spf: 'pass', dkim: 'pass', messageId: 'm1', size: 100, attachments: [{ name: 'RSM_ventes.csv', b64: Buffer.from('a;b').toString('base64') }] };
    const q = await envoi({ ...base, origFrom: 'Inconnu <pirate@example.org>' }); expect(q.code).toBe(202); expect(taches.length).toBe(0);
    expect(Object.values<any>(db.data.ingest.niort.quarantine)[0]).toMatchObject({ from: 'pirate@example.org', raison: 'expéditeur hors liste blanche' });
    const ok = await envoi({ ...base, origFrom: 'Resamania <exports@resamania.example>' }); expect(ok.code).toBe(200); expect(taches.length).toBe(1);
    expect((await envoi({ ...base, origFrom: 'gerant@club.example', messageId: 'm2', attachments: [{ name: 'b.csv', b64: Buffer.from('c').toString('base64') }] })).code).toBe(200);
    expect((await envoi({ ...base, origFrom: 'exports@resamania.example', size: 26 * 1024 * 1024 })).code).toBe(413);
    expect((await envoi({ ...base, origFrom: 'exports@resamania.example', spf: 'fail', dkim: 'fail' })).code).toBe(403);
    // Régénération : l'ancienne adresse est refusée au plus tard 60 s après.
    await db.update({ 'pulse/ingestConfig/niort/mail/address': 'club-niort-zz99@import.fitpulse.app' });
    t += 60_000; expect((await envoi({ ...base, origFrom: 'exports@resamania.example', messageId: 'm3' })).code).toBe(404);
    expect((await envoi({ ...base, to: 'club-niort-zz99@import.fitpulse.app', origFrom: 'exports@resamania.example', messageId: 'm4', attachments: [{ name: 'c.csv', b64: Buffer.from('d').toString('base64') }] })).code).toBe(200);
  });
});
