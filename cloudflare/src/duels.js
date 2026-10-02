// ══ LES DUELS — LE CALCUL, SANS BASE ═════════════════════════════════════
//
// Module PUR, éprouvé par cloudflare/test/duels.test.mjs. metier.js lit
// /duels/<id>, appelle ces fonctions et écrit ce qu'elles rendent.
//
// UN DUEL : deux athlètes, une mesure (celles des défis du Canal :
// functions/defis-calcul.js), une durée de 7, 14, 21 ou 28 jours.
//   attente   créé, le lien partagé, personne n'a encore relevé ;
//   accepte   l'invité a rejoint ; le duel démarre à SA première séance ;
//   en_cours  debut → fin ; chaque séance terminée fait écrire à chacun SA
//             valeur (progres/<lui>, comme dans les défis du Canal), et le
//             Worker en tire les scores ;
//   termine   après la fin : le gagnant reçoit le badge CHAMPION ;
//   annule    accepté mais jamais commencé en 30 jours.
// ⚠ LE WORKER NE RELIT JAMAIS LES SÉANCES : dix millisecondes de calcul par
//   exécution. C'est l'app qui calcule sa valeur (defiValeur), comme dans le
//   Canal ; le Worker ne fait que comparer.

export const DUEL_ID_RE = /^d[a-z0-9]{10,24}$/;
export const DUEL_DUREES = [7, 14, 21, 28];
export const DUEL_MESURES = ['seances', 'tonnage', 'serie', 'progressionPct'];
export const DUEL_J = 864e5;
export const DUEL_ANNULE_APRES = 30 * DUEL_J;   // accepté, jamais commencé
export const DUEL_RAPPEL_AVANT = 2 * DUEL_J;    // le push de J-2
// Ce qu'on dit de la mesure : « 14 jours de régularité ».
const MOTS = { seances: 'régularité', serie: 'régularité', tonnage: 'volume', progressionPct: 'progression' };

export function texteDuel(mesure, duree) {
  const d = DUEL_DUREES.indexOf(Number(duree)) >= 0 ? Number(duree) : 14;
  return d + ' jours de ' + (MOTS[mesure] || 'régularité');
}
// La valeur lisible d'un score.
export function texteScore(mesure, v) {
  const n = Number(v) || 0;
  if (mesure === 'tonnage') return (n >= 10000 ? (Math.round(n / 100) / 10).toString().replace('.', ',') + ' t' : Math.round(n) + ' kg');
  if (mesure === 'progressionPct') return (Math.round(n * 10) / 10).toString().replace('.', ',') + ' %';
  if (mesure === 'serie') return Math.round(n) + ' sem.';
  return Math.round(n) + ' séance' + (Math.round(n) > 1 ? 's' : '');
}
// Le prénom de l'autre, vu par `cle`.
export function autreNom(d, cle) {
  if (!d) return '';
  return cle === d.createur ? String(d.inviteNom || 'ton adversaire') : String(d.createurNom || 'ton adversaire');
}
// Les scores, lus dans la progression que chacun a écrite.
export function scoresDe(d) {
  const p = (d && d.progres) || {};
  const v = (k) => { const x = k && p[k]; const n = Number(x && x.valeur); return isFinite(n) && n >= 0 ? n : 0; };
  return { createur: v(d && d.createur), invite: v(d && d.invite) };
}
// 'createur', 'invite' ou 'egalite'.
export function gagnantDe(scores) {
  const a = Number(scores && scores.createur) || 0, b = Number(scores && scores.invite) || 0;
  return a > b ? 'createur' : (b > a ? 'invite' : 'egalite');
}
// Le démarrage : à la première séance de l'invité. Le début recule de 4 h
// (la séance a commencé avant d'être terminée), jamais avant le « oui ».
export function demarrage(d, t, at) {
  const ref = Math.min(Number(t) || 0, Number(at) > 0 ? Number(at) : Number(t) || 0);
  const debut = Math.max(Number(d && d.rejointLe) || 0, ref - 4 * 3600e3);
  const duree = DUEL_DUREES.indexOf(Number(d && d.duree)) >= 0 ? Number(d.duree) : 14;
  return { debut, fin: debut + duree * DUEL_J };
}
// Ce que devient un duel à l'instant t, sans événement (le travail du jour).
//   'cloturer' | 'rappel' | 'annuler' | 'rien'
export function suiteDuel(d, t) {
  if (!d) return 'oublier';
  if (d.statut === 'en_cours') {
    if (t > Number(d.fin)) return 'cloturer';
    if (Number(d.fin) - t <= DUEL_RAPPEL_AVANT && !d.rappel) return 'rappel';
    return 'rien';
  }
  if (d.statut === 'accepte' && t - (Number(d.rejointLe) || 0) > DUEL_ANNULE_APRES) return 'annuler';
  if (d.statut === 'termine' || d.statut === 'annule') return 'oublier';
  return 'rien';
}
const jourFr = (t) => new Date(Number(t)).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' });

// ── Les messages ─────────────────────────────────────────────────────────
// `cle` : à qui l'on écrit. Un titre court, un corps qui dit quoi faire.
// `prio` (metier.js, PUSH_PRIORITE) : le J-2 (80) et le résultat (90) passent
// en second push du jour ; les autres messages de duel gardent celle du type.
export function pushRejoint(d) {
  return { type: 'defi', url: './?duels=1', tag: 'duel-rejoint-' + d.id,
    title: String(d.inviteNom || 'Ton pote').slice(0, 24) + ' relève ton duel ⚡',
    body: texteDuel(d.mesure, d.duree) + '. Le duel commence à sa première séance.' };
}
// LA REVANCHE (lot B, 29/09/2026) : un duel né « accepte » entre amis. Rien à
// accepter : la première séance de l'invité lance le compte.
export function pushRevanche(d) {
  return { type: 'defi', url: './?duels=1', tag: 'duel-revanche-' + d.id,
    title: String(d.createurNom || 'Ton pote').slice(0, 24) + ' te défie en revanche ⚡',
    body: texteDuel(d.mesure, d.duree) + '. Ta prochaine séance lance le compte.' };
}
// PURE. Un duel créé entre amis, prêt à être rattaché à son invité ?
//   'ok' | une raison de refus.
export function revancheValide(d, par) {
  if (!d) return 'duel_inconnu';
  if (par !== d.createur) return 'pas_createur';
  if (d.statut !== 'accepte') return 'deja_' + d.statut;
  if (d.invite) return 'deja_rattache';
  const re = /^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/;
  if (!re.test(String(d.invitePseudo || '')) || !re.test(String(d.createurPseudo || ''))) return 'sans_pseudo';
  return 'ok';
}
export function pushDebut(d, cle) {
  return { type: 'defi', url: './?duels=1', tag: 'duel-debut-' + d.id,
    title: 'Le duel commence ⚡',
    body: texteDuel(d.mesure, d.duree) + ' contre ' + autreNom(d, cle) + '. Fin ' + jourFr(d.fin) + '.' };
}
export function pushRappel(d, cle) {
  const s = scoresDe(d);
  const moi = cle === d.createur ? s.createur : s.invite, lui = cle === d.createur ? s.invite : s.createur;
  const etat = moi > lui ? 'Tu mènes' : (moi < lui ? 'Tu es mené' : 'Égalité');
  return { type: 'defi', prio: 'duel_j2', url: './?duels=1', tag: 'duel-j2-' + d.id,
    title: 'Plus que 2 jours contre ' + autreNom(d, cle).slice(0, 24),
    body: etat + ' : ' + texteScore(d.mesure, moi) + ' contre ' + texteScore(d.mesure, lui) + '. Une séance peut tout changer.' };
}
export function pushResultat(d, cle, gagnant) {
  const s = d.scores || scoresDe(d);
  const moi = cle === d.createur ? s.createur : s.invite, lui = cle === d.createur ? s.invite : s.createur;
  const score = texteScore(d.mesure, moi) + ' contre ' + texteScore(d.mesure, lui);
  const role = cle === d.createur ? 'createur' : 'invite';
  if (gagnant === 'egalite') return { type: 'defi', prio: 'duel_fin', url: './?duels=1', tag: 'duel-fin-' + d.id,
    title: 'Égalité contre ' + autreNom(d, cle).slice(0, 24), body: score + '. Revanche ?' };
  if (gagnant === role) return { type: 'defi', prio: 'duel_fin', url: './?duels=1', tag: 'duel-fin-' + d.id,
    title: 'Tu as gagné ton duel ⚡', body: score + ' contre ' + autreNom(d, cle).slice(0, 24) + '. Badge CHAMPION débloqué.' };
  return { type: 'defi', prio: 'duel_fin', url: './?duels=1', tag: 'duel-fin-' + d.id,
    title: autreNom(d, cle).slice(0, 24) + ' remporte le duel', body: score + '. Revanche ?' };
}
// Ce que la clôture écrit dans /defis_resultats/<cle>/<id> : la même forme
// que les défis du Canal (l'app en tire le badge CHAMPION), et `duel`.
export function resultatPour(d, cle, gagnant, t) {
  const role = cle === d.createur ? 'createur' : 'invite';
  return { titre: ('Duel contre ' + autreNom(d, cle)).slice(0, 80), mesure: DUEL_MESURES.indexOf(d.mesure) >= 0 ? d.mesure : 'seances',
    collectif: false, fin: Number(d.fin) || t, termineLe: t, champion: gagnant === role, duel: true };
}
