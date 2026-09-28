// ══ LES ÉVÉNEMENTS SAISONNIERS (/saisons) — LE CALCUL, SANS BASE ══════════
//
// Module PUR, éprouvé par cloudflare/test/saisons.test.mjs. metier.js lit la
// base, appelle ces fonctions, écrit ce qu'elles rendent.
// (« /evenements » est la file du Worker : les événements saisonniers vivent
// dans /saisons.)
//
// UNE SAISON (créée par Kevin, écran admin) :
//   {nom, debut, fin, mesure, objectifPerso, objectifCollectif, badgeCle,
//    couleurAccent, texteAccueil}
// LA PROGRESSION : chaque app écrit SA valeur (saisons_progres/<id>/<lui>,
// la règle des défis du Canal) ; le Worker, chaque heure, en tire le compteur
// collectif (/stats/saisons/<id>), reconnaît qui a bouclé (valeur ≥ objectif
// perso) et lui écrit son badge « Édition » (/saisons_resultats/<lui>/<id>).
// Il ne relit jamais les séances.
//
// LES PUSH, une fois chacun (saisons_etat/<id>) :
//   lancement     au début, à tous les abonnés ;
//   mi-parcours   à la moitié, aux retardataires (moins de la moitié de
//                 l'objectif perso) ;
//   j2            deux jours avant la fin, à qui n'a pas bouclé ;
//   fin           après la fin : « Tu as bouclé » ou « C'est fini ».

export const SAISON_ID_RE = /^[a-z0-9][a-z0-9-]{2,40}$/;
export const SAISON_MESURES = ['seances', 'tonnage', 'serie', 'progressionPct'];
const J = 864e5;
// Une saison est suivie de son début à deux jours après sa fin (le temps que
// les dernières valeurs arrivent et que la fin soit annoncée).
export const SAISON_TRAINE = 2 * J;

export function saisonValide(s) {
  return !!(s && typeof s === 'object' && s.nom && Number(s.debut) > 0 && Number(s.fin) > Number(s.debut)
    && SAISON_MESURES.indexOf(s.mesure) >= 0 && Number(s.objectifPerso) > 0);
}
export function saisonSuivie(s, t) {
  return saisonValide(s) && t >= Number(s.debut) && t <= Number(s.fin) + SAISON_TRAINE;
}
export function anneeDe(s) {
  return new Date(Number(s && s.debut) || 0).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric' });
}
// Les valeurs écrites par les apps : {cle: valeur} (bornées, jamais négatives).
export function valeurs(progres) {
  const out = {};
  for (const k of Object.keys(progres || {})) {
    const v = Number(progres[k] && progres[k].valeur);
    if (isFinite(v) && v >= 0 && v < 1e9) out[k] = v;
  }
  return out;
}
// LE COMPTEUR COLLECTIF.
export function statsSaison(s, vals, t) {
  const l = Object.keys(vals);
  const total = l.reduce((a, k) => a + vals[k], 0);
  const obj = Number(s.objectifPerso) || 1;
  return { total: Math.round(total * 10) / 10, participants: l.filter((k) => vals[k] > 0).length,
    finis: l.filter((k) => vals[k] >= obj).length, objectifCollectif: Number(s.objectifCollectif) || 0,
    part: Number(s.objectifCollectif) > 0 ? Math.min(1, Math.round(total / Number(s.objectifCollectif) * 1000) / 1000) : 0, maj: t };
}
// Qui vient de boucler (pas encore récompensé), pendant la saison seulement.
export function nouveauxFinis(s, vals, dejaFinis) {
  const obj = Number(s.objectifPerso) || 1;
  const d = dejaFinis || {};
  return Object.keys(vals).filter((k) => vals[k] >= obj && !d[k]);
}
// Le badge « Édition » de quelqu'un.
export function resultatSaison(id, s, t) {
  return { nom: String(s.nom).slice(0, 60), annee: anneeDe(s), badgeCle: String(s.badgeCle || id).slice(0, 40),
    couleur: /^#[0-9a-fA-F]{6}$/.test(String(s.couleurAccent || '')) ? s.couleurAccent : '#E02020', termineLe: t, fin: Number(s.fin) };
}
// LA PROCHAINE ANNONCE à faire, ou null. `etat` : ce qui est déjà parti.
export function annonceSaison(s, etat, t) {
  const e = etat || {};
  const debut = Number(s.debut), fin = Number(s.fin);
  if (t > fin) return e.fin ? null : 'fin';
  if (!e.lancement && t >= debut) return 'lancement';
  if (!e.mi && t >= debut + (fin - debut) / 2 && fin - t > 2 * J) return 'mi';
  if (!e.j2 && fin - t <= 2 * J) return 'j2';
  return null;
}
// À qui l'annonce s'adresse : parmi les abonnés aux push.
export function destinataires(quoi, s, abonnes, vals) {
  const obj = Number(s.objectifPerso) || 1;
  const v = (k) => Number(vals[k]) || 0;
  if (quoi === 'lancement') return abonnes.slice();
  if (quoi === 'mi') return abonnes.filter((k) => v(k) < obj / 2);
  if (quoi === 'j2') return abonnes.filter((k) => v(k) < obj);
  if (quoi === 'fin') return abonnes.filter((k) => k in vals);
  return [];
}
const jourFr = (t) => new Date(Number(t)).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' });
const objTexte = (s) => {
  const n = Number(s.objectifPerso) || 0;
  if (s.mesure === 'tonnage') return n + ' kg soulevés';
  if (s.mesure === 'progressionPct') return '+' + n + ' % de progression';
  if (s.mesure === 'serie') return n + ' semaine' + (n > 1 ? 's' : '') + ' validée' + (n > 1 ? 's' : '');
  return n + ' séance' + (n > 1 ? 's' : '');
};
export function messageSaison(quoi, id, s, cle, vals) {
  const nom = String(s.nom).slice(0, 50);
  const base = { type: 'defi', url: './?saison=' + id, tag: 'saison-' + quoi + '-' + id };
  const obj = Number(s.objectifPerso) || 1, v = Number(vals && vals[cle]) || 0;
  if (quoi === 'lancement') return Object.assign(base, { title: nom + ' commence ⚡',
    body: 'Objectif : ' + objTexte(s) + ' d’ici le ' + jourFr(s.fin) + '. Une édition, un badge, jamais réédité.' });
  if (quoi === 'mi') return Object.assign(base, { title: 'Mi-parcours : ' + nom,
    body: 'Tu en es à ' + Math.round(v * 10) / 10 + ' sur ' + objTexte(s) + '. Il reste la moitié du temps pour le badge.' });
  if (quoi === 'j2') return Object.assign(base, { title: 'Plus que 2 jours : ' + nom,
    body: 'Il te manque ' + Math.max(0, Math.round((obj - v) * 10) / 10) + ' pour ' + objTexte(s) + '. Après, le badge ne revient plus.' });
  if (v >= obj) return Object.assign(base, { title: 'Tu as bouclé ' + nom + ' ⚡', body: 'Ton badge Édition ' + anneeDe(s) + ' est à toi. Partage ta carte.' });
  return Object.assign(base, { title: nom + ' est terminé', body: 'Merci d’avoir participé. La prochaine édition arrive.' });
}
