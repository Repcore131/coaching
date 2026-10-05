// Base de test volumineuse pour mesurer Fit Pulse : 10 clubs, 50 000 saisies, 30 000 clients,
// 5 000 relances notées, 2 000 messages. Produit un fichier de sauvegarde à restaurer en mode
// local (Mes clubs > Réglages > Restaurer une sauvegarde), puis ouvrir l'appli avec ?perf.
//   node club/outils/seed-large.mjs fitpulse-charge.json
import { writeFileSync } from 'node:fs';
let seed = 20261005; const R = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = a => a[Math.floor(R() * a.length)]; const day = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const S = { meta: { demo: true }, clubs: {}, users: {}, entries: {}, clients: {}, touches: {}, chat: {}, kpis: {}, targets: {}, prefs: {}, imports: {}, resiliations: {}, challenges: {}, loyalty: {}, reactions: {}, tasks: { library: {}, plan: {}, done: {} }, paliers: {}, monthly: {}, base: {} };
const KP = ['contrats', 'avis', 'nutrition', 'accessoires', 'impayes'];
for (let c = 0; c < 10; c++) S.clubs['c' + c] = { id: 'c' + c, name: `Club ${c + 1}` };
S.users.crea = { id: 'crea', first: 'Admin', last: 'Test', role: 'createur', clubs: Object.keys(S.clubs), status: 'active', email: 'admin@test.fr' };
for (let u = 0; u < 80; u++) S.users['u' + u] = { id: 'u' + u, first: `Vendeur${u}`, last: 'Test', role: u % 8 ? 'membre' : 'manager', clubs: ['c' + (u % 10)], status: 'active', email: `v${u}@test.fr` };
for (let i = 0; i < 50000; i++) { const u = 'u' + Math.floor(R() * 80); const k = pick(KP); S.entries['e' + i] = { id: 'e' + i, userId: u, clubId: S.users[u].clubs[0], kpiId: k, date: day(Math.floor(R() * 400)), value: k === 'nutrition' || k === 'accessoires' || k === 'impayes' ? Math.round(R() * 8000) / 100 : 1, source: 'manual', at: Date.now() - Math.floor(R() * 400) * 864e5 }; }
for (let i = 0; i < 30000; i++) S.clients['k' + i] = { id: 'k' + i, clubId: 'c' + (i % 10), num: String(500000 + i), name: `Client ${i}`, phone: '+336' + String(10000000 + i).slice(0, 8), start: day(Math.floor(R() * 700)), end: day(-Math.floor(R() * 200)), offer: pick(['Basic', 'Premium', 'Ultimate']), price: pick([24.99, 29.99, 39.99]), balance: R() < 0.05 ? Math.round(R() * 20000) / 100 : 0, status: 'Client' };
for (let i = 0; i < 5000; i++) S.touches['t' + i] = { id: 't' + i, clubId: 'c' + (i % 10), clientId: 'k' + Math.floor(R() * 30000), at: Date.now() - Math.floor(R() * 90) * 864e5, by: 'u' + Math.floor(R() * 80), channel: 'call', outcome: pick(['joint', 'pasreponse', 'messagerie']) };
for (let i = 0; i < 2000; i++) S.chat['m' + i] = { id: 'm' + i, channel: 'c' + (i % 10), userId: 'u' + Math.floor(R() * 80), text: 'Message de test ' + i, at: Date.now() - i * 3600000 };
writeFileSync(process.argv[2] || 'fitpulse-charge.json', JSON.stringify(S));
console.log('Base de charge écrite :', (JSON.stringify(S).length / 1e6).toFixed(1), 'Mo');
