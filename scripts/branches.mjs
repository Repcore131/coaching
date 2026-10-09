#!/usr/bin/env node
// LE MÉNAGE DES BRANCHES (série 6, lot 19, 08/10/2026).
//
// LECTURE SEULE PAR DÉFAUT : liste les branches distantes, dit lesquelles sont
// fusionnées dans main, sans PR ouverte, et plus vieilles que 14 jours — les
// seules qui PEUVENT partir. Rien n'est supprimé sans --supprimer.
//   node scripts/branches.mjs
//   node scripts/branches.mjs --supprimer          (git push origin --delete, une par une)
//   GITHUB_TOKEN + GITHUB_REPOSITORY : les PR ouvertes sont lues (sinon, rien n'est supprimable :
//   une branche dont on ne sait pas si une PR la porte reste).
import { execFileSync } from 'node:child_process';

export const PROTEGEES = ['main', 'master', 'gh-pages', 'claude/eloquent-lamport-0qxwdd'];
export const JOURS_MIN = 14;
// PURE. branches : [{nom, date (ms)}] ; fusionnees, ouvertes : noms ; ouvertes null = inconnues.
export function planBranches(branches, o) {
  const x = o || {}, t = Number(x.maintenant) || Date.now();
  const fus = new Set(x.fusionnees || []), ouv = x.ouvertes ? new Set(x.ouvertes) : null;
  return (branches || []).map((b) => {
    const age = Math.floor((t - Number(b.date)) / 864e5);
    let etat = 'garder', raison = '';
    if (PROTEGEES.includes(b.nom)) raison = 'protégée';
    else if (!fus.has(b.nom)) raison = 'pas fusionnée dans main';
    else if (!ouv) raison = 'PR ouvertes inconnues';
    else if (ouv.has(b.nom)) raison = 'PR ouverte';
    else if (age < (x.joursMin || JOURS_MIN)) raison = 'récente (' + age + ' j)';
    else { etat = 'supprimable'; raison = 'fusionnée, sans PR, ' + age + ' j'; }
    return { nom: b.nom, age, etat, raison };
  }).sort((a, b) => (a.etat === b.etat ? a.nom.localeCompare(b.nom) : a.etat === 'supprimable' ? -1 : 1));
}

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
async function prOuvertes() {
  const tok = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPOSITORY;
  if (!tok || !repo) return null;
  const r = await fetch('https://api.github.com/repos/' + repo + '/pulls?state=open&per_page=100', { headers: { authorization: 'Bearer ' + tok, accept: 'application/vnd.github+json' } });
  if (!r.ok) return null;
  return (await r.json()).map((p) => p.head && p.head.ref).filter(Boolean);
}
if (import.meta.url === 'file://' + process.argv[1]) {
  try { git('fetch', '-q', '--prune', 'origin'); } catch (e) { console.warn('fetch impossible : liste locale des branches distantes.'); }
  const branches = git('for-each-ref', 'refs/remotes/origin', '--format=%(refname:short)|%(committerdate:unix)').split('\n').filter(Boolean)
    .map((l) => { const [r, d] = l.split('|'); return { nom: r.replace(/^origin\//, ''), date: Number(d) * 1000 }; }).filter((b) => b.nom !== 'HEAD' && b.nom !== 'origin');
  const fusionnees = git('branch', '-r', '--merged', 'origin/main').split('\n').map((s) => s.trim().replace(/^origin\//, '')).filter(Boolean);
  const plan = planBranches(branches, { fusionnees, ouvertes: await prOuvertes() });
  for (const p of plan) console.log((p.etat === 'supprimable' ? 'SUPPRIMABLE ' : 'garder      ') + p.nom + '  — ' + p.raison);
  const sup = plan.filter((p) => p.etat === 'supprimable');
  if (!process.argv.includes('--supprimer')) { console.log('\n' + sup.length + ' supprimable(s). Lecture seule : rien n’a été supprimé (--supprimer pour le faire).'); process.exit(0); }
  for (const p of sup) { git('push', 'origin', '--delete', p.nom); console.log('supprimée : ' + p.nom); }
}
