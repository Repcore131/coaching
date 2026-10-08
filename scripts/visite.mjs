#!/usr/bin/env node
// LES DONNÉES DE LA VISITE (série 6, lot 13, 08/10/2026).
//
// Fabrique app/data/visite.json : un athlète et un coach FICTIFS, avec quatre
// semaines de séances, de pesées, de pas et de sommeil, trois bilans et un
// programme. Rien n'est tiré d'un vrai compte. Les dates sont écrites
// RELATIVES à `genere` : l'app les recale sur le jour de la visite
// (visiteRecaler), pour que la visite ait toujours l'air d'aujourd'hui.
//
//   node scripts/visite.mjs            (écrit le fichier)
//   node scripts/visite.mjs --verifier (rouge si le fichier n'est pas à jour)
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const GENERE = Date.UTC(2026, 9, 1, 10, 0, 0);
const J = 864e5;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
// Pseudo-hasard reproductible : la même graine, le même fichier.
let graine = 1931;
const hasard = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };

const PROGRAMME = [
  { day: 'Lundi', active: true, name: 'Haut du corps', exercises: [
    { name: 'DÉVELOPPÉ COUCHÉ', series: 4, reps: '8-10', repos: '2 min', rir: '2' },
    { name: 'ROWING BARRE', series: 4, reps: '8-10', repos: '2 min', rir: '2' },
    { name: 'DÉVELOPPÉ MILITAIRE', series: 3, reps: '10', repos: '1 min 30', rir: '2' },
    { name: 'CURL HALTÈRES', series: 3, reps: '12', repos: '1 min', rir: '1' }] },
  { day: 'Mercredi', active: true, name: 'Bas du corps', exercises: [
    { name: 'SQUAT', series: 4, reps: '6-8', repos: '2 min 30', rir: '2' },
    { name: 'SOULEVÉ DE TERRE ROUMAIN', series: 3, reps: '10', repos: '2 min', rir: '2' },
    { name: 'FENTES MARCHÉES', series: 3, reps: '12', repos: '1 min 30', rir: '2' },
    { name: 'MOLLETS DEBOUT', series: 3, reps: '15', repos: '1 min', rir: '1' }] },
  { day: 'Vendredi', active: true, name: 'Corps entier', exercises: [
    { name: 'TRACTIONS', series: 4, reps: '6-8', repos: '2 min', rir: '2' },
    { name: 'PRESSE À CUISSES', series: 3, reps: '12', repos: '1 min 30', rir: '2' },
    { name: 'DIPS', series: 3, reps: '10', repos: '1 min 30', rir: '2' }] },
];
const CHARGES = { 'DÉVELOPPÉ COUCHÉ': 47.5, 'ROWING BARRE': 42.5, 'DÉVELOPPÉ MILITAIRE': 27.5, 'CURL HALTÈRES': 10, 'SQUAT': 70,
  'SOULEVÉ DE TERRE ROUMAIN': 60, 'FENTES MARCHÉES': 14, 'MOLLETS DEBOUT': 40, 'TRACTIONS': 0, 'PRESSE À CUISSES': 120, 'DIPS': 0 };

function seances() {
  const l = [];
  for (let s = 4; s >= 1; s--) {
    PROGRAMME.forEach((jour, i) => {
      const date = GENERE - (s * 7 - i * 2) * J + 18 * 3600e3;
      if (date > GENERE) return;
      const data = {};
      for (const ex of jour.exercises) {
        const kg = CHARGES[ex.name] + (4 - s) * 2.5;
        const reps = parseInt(ex.reps, 10);
        data[ex.name] = { sets: Array.from({ length: ex.series }, () => ({ weight: String(kg), repsDone: String(reps), reps: String(reps), rir: ex.rir, done: true })) };
      }
      l.push({ id: 'v' + s + i, date, name: jour.name, complete: true, duree: 55 * 60, data });
    });
  }
  return l;
}
function journal(n, f) { return Array.from({ length: n }, (_, i) => f(GENERE - (n - 1 - i) * J, i)); }

export function donneesVisite() {
  graine = 1931;
  const athlete = {
    id: 'visite_a', email: 'lea@visite.repcore', fname: 'Léa', lname: 'Exemple', role: 'athlete', gender: 'F',
    birthdate: '1995-03-14', age: 31, height: 166, objective: 'Prendre du muscle sans prendre de gras',
    status: 'COACHING_SUIVI', accessExpiry: GENERE + 90 * J, createdAt: GENERE - 35 * J, updatedAt: GENERE,
    coachId: 'visite_c', coachName: 'Alex Coach', coachEmailKey: 'alex@visite,repcore', rattacheLe: GENERE - 34 * J,
    consent: { health: true, cgu: true, policyVersion: 'VISITE' }, questionnaireComplete: true,
    sessions_config: PROGRAMME, sessions: seances(),
    weightLog: journal(28, (t, i) => ({ date: iso(t), kg: Math.round((61.8 + i * 0.03 + (hasard() - 0.5) * 0.6) * 10) / 10 })),
    stepsLog: journal(28, (t) => ({ date: iso(t), count: Math.round(6500 + hasard() * 5000) })),
    sleepLog: journal(28, (t) => ({ date: iso(t), duration: Math.round(400 + hasard() * 80) })),
    bilans: [21, 14, 7].map((j, i) => ({ type: 'coaching', date: GENERE - j * J, 'bil-weight': String(61.6 + i * 0.3), 'bil-energie': String(3 + (i % 2)), 'bil-notes': ['Bonne semaine, un peu fatiguée jeudi.', 'Les séances passent mieux.', 'Squat plus facile, je dors mieux.'][i] })),
    nutrition: { dietType: 'flexible', macros: { on: { kcal: 2050, p: 120, g: 240, l: 65 }, off: { kcal: 1850, p: 120, g: 190, l: 65 } }, log: {} },
    exAlias: {}, exMuscles: {}, videos: [], programs: {}, supplements: [],
  };
  const clients = [athlete,
    Object.assign({}, athlete, { id: 'visite_b', email: 'sam@visite.repcore', fname: 'Sam', lname: 'Martin', gender: 'H', birthdate: '1990-07-02', age: 36,
      sessions: athlete.sessions.slice(0, 7), bilans: athlete.bilans.slice(0, 1), weightLog: athlete.weightLog.map((x) => ({ date: x.date, kg: Math.round((x.kg + 16) * 10) / 10 })) }),
    Object.assign({}, athlete, { id: 'visite_d', email: 'ines@visite.repcore', fname: 'Inès', lname: 'Durand', sessions: [], bilans: [], createdAt: GENERE - 3 * J, rattacheLe: GENERE - 3 * J }),
  ];
  const coach = {
    id: 'visite_c', email: 'alex@visite.repcore', fname: 'Alex', lname: 'Coach', role: 'coach', palier: 'pro', coachPlan: 'pro',
    teamName: 'Team Exemple', catchphrase: 'Des séances simples, des progrès visibles.', createdAt: GENERE - 120 * J, updatedAt: GENERE,
    consent: { health: true, cgu: true, policyVersion: 'VISITE' }, clients: clients.map((c) => c.id), studentCodes: [],
  };
  return { v: 1, genere: GENERE, athlete: athlete.email, coach: coach.email, users: Object.fromEntries([coach, ...clients].map((u) => [u.email, u])) };
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const f = new URL('../app/data/visite.json', import.meta.url);
  const texte = JSON.stringify(donneesVisite()) + '\n';
  if (process.argv.includes('--verifier')) {
    const ok = existsSync(f) && readFileSync(f, 'utf8') === texte;
    console.log(ok ? 'visite.json à jour' : 'visite.json PAS à jour : node scripts/visite.mjs');
    process.exit(ok ? 0 : 1);
  }
  writeFileSync(f, texte);
  console.log('app/data/visite.json écrit (' + texte.length + ' caractères)');
}
