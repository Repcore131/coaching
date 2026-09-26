// ══ LES DÉFIS DU CANAL — LE CALCUL, SANS FIREBASE ══════════════════════════
//
// Module PUR : aucune lecture, aucune écriture. index.js lit la base, appelle
// ces fonctions, et écrit ce qu'elles rendent. C'est ce qui les rend
// éprouvables par le banc (functions/test/defis.test.js) sans rien simuler.
//
// ⚠ LA MÊME RÈGLE VIT CÔTÉ CLIENT (defiValeur, app/rc-core.*.js) pour la jauge
// perso, qui doit bouger dès la fin de séance sans attendre le serveur. Les
// deux bancs rejouent les MÊMES fixtures avec les mêmes résultats attendus :
// si l'une change sans l'autre, un des deux tombe.
//
// Ce n'est PAS un fichier de fonctions : seul index.js est lu par le
// déploiement, et ce module n'exporte aucun déclencheur.
"use strict";

const MESURES = ["seances", "tonnage", "serie", "progressionPct"];
const PALIERS_EQUIPE = [25, 50, 75, 100];
const J = 864e5;

function _liste(x) {
  if (Array.isArray(x)) return x.filter(Boolean);
  if (x && typeof x === "object") return Object.keys(x).map((k) => x[k]).filter(Boolean);
  return [];
}
// Les exercices d'une séance : `data` (nom → {sets}) ou `exercises` (ancienne forme).
function _exos(s) {
  if (s && s.data && typeof s.data === "object" && Object.keys(s.data).length)
    return Object.keys(s.data).map((nm) => ({ nom: String(nm).trim().toUpperCase(), sets: _liste((s.data[nm] || {}).sets) }));
  return _liste(s && s.exercises).filter((e) => e && (e.name || e.nm))
    .map((e) => ({ nom: String(e.name || e.nm).trim().toUpperCase(), sets: _liste(e.sets) }));
}
function tonnageSeance(s) {
  if (Number(s && s.volume) > 0) return Math.round(Number(s.volume));
  let v = 0;
  for (const e of _exos(s)) for (const st of e.sets) {
    if (!st || st.done === false) continue;
    v += (parseFloat(st.weight) || 0) * (parseFloat(st.repsDone != null ? st.repsDone : st.reps) || 0);
  }
  return Math.round(v);
}
// Le lundi (AAAA-MM-JJ) de la semaine d'un instant, À PARIS : une semaine
// validée se lit comme l'athlète la vit, pas en UTC.
function lundiParis(t) {
  const p = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date(t)).forEach((x) => { p[x.type] = x.value; });
  const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
function quota(u) { return Math.max(1, _liste(u && u.sessions_config).filter((s) => s && s.active).length); }
function _dans(defi, t) { return t >= Number(defi.debut) && t <= Number(defi.fin); }

// LA VALEUR D'UN ATHLÈTE POUR UN DÉFI, entre debut et fin :
//   seances         nombre de séances terminées ;
//   tonnage         kilos soulevés (la somme des séances) ;
//   serie           semaines validées (le quota de séances atteint) ;
//   progressionPct  progression moyenne, en %, de la meilleure charge par
//                   exercice : dans la fenêtre contre avant le début. Relative
//                   par construction — aucun kilo n'en sort.
function valeurDefi(u, defi) {
  const ses = _liste(u && u.sessions).filter((s) => Number(s.date) > 0);
  const dedans = ses.filter((s) => _dans(defi, Number(s.date)));
  switch (defi && defi.mesure) {
    case "seances": return dedans.length;
    case "tonnage": return dedans.reduce((a, s) => a + tonnageSeance(s), 0);
    case "serie": {
      const q = quota(u), n = {};
      for (const s of dedans) { const l = lundiParis(Number(s.date)); n[l] = (n[l] || 0) + 1; }
      return Object.keys(n).filter((l) => n[l] >= q).length;
    }
    case "progressionPct": {
      const avant = {}, pendant = {};
      for (const s of ses) {
        const t = Number(s.date);
        const cible = t < Number(defi.debut) ? avant : (_dans(defi, t) ? pendant : null);
        if (!cible) continue;
        for (const e of _exos(s)) for (const st of e.sets) {
          if (!st || st.done === false) continue;
          const w = parseFloat(st.weight) || 0;
          if (w > (cible[e.nom] || 0)) cible[e.nom] = w;
        }
      }
      const pcts = Object.keys(pendant).filter((k) => avant[k] > 0).map((k) => (pendant[k] / avant[k] - 1) * 100);
      if (!pcts.length) return 0;
      return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length * 10) / 10;
    }
    default: return 0;
  }
}
// Une mesure « à additionner » : en équipe, les valeurs s'ajoutent (séances,
// kilos). Les deux autres ne s'additionnent pas — deux athlètes à 4 semaines ne
// font pas 8 semaines —, l'équipe y avance à la MOYENNE des parts.
function _somme(defi) { return defi.mesure === "seances" || defi.mesure === "tonnage"; }
function partEquipe(defi, valeurs) {
  const obj = Number(defi.objectif) || 0;
  const v = valeurs.map((x) => Math.max(0, Number(x) || 0));
  if (!obj || !v.length) return 0;
  if (defi.collectif && _somme(defi)) return Math.min(1, v.reduce((a, b) => a + b, 0) / obj);
  return v.reduce((a, x) => a + Math.min(1, x / obj), 0) / v.length;
}
// La part d'UN athlète : sa valeur sur l'objectif ; en équipe additive, sur SA
// part de l'objectif (l'objectif divisé par le nombre de participants).
function partPerso(defi, v, n) {
  const obj = Number(defi.objectif) || 0;
  if (!obj) return 0;
  const cible = (defi.collectif && _somme(defi)) ? obj / Math.max(1, n) : obj;
  return Math.max(0, Math.min(1, (Number(v) || 0) / cible));
}
// A-t-il bouclé le défi ? Seul : l'objectif atteint. En équipe additive :
// l'équipe à 100 % et une contribution. En équipe « personne ne lâche »
// (série, progression) : chacun son objectif.
function aTermine(defi, v, equipe) {
  const obj = Number(defi.objectif) || 0;
  if (!obj) return false;
  if (defi.collectif && _somme(defi)) return equipe >= 1 && (Number(v) || 0) > 0;
  return (Number(v) || 0) >= obj;
}
// LE CLASSEMENT NE PORTE JAMAIS SUR LES CHARGES. La progression en % se classe
// telle quelle ; tout le reste se classe à la RÉGULARITÉ — séances, ou semaines
// validées pour un défi de série. Un défi de tonnage se classe donc aux
// séances, pas aux kilos.
function metriqueClassement(defi, u) {
  if (defi.mesure === "progressionPct") return { valeur: valeurDefi(u, defi), unite: "%" };
  if (defi.mesure === "serie") return { valeur: valeurDefi(u, defi), unite: "semaines" };
  return { valeur: valeurDefi(u, Object.assign({}, defi, { mesure: "seances" })), unite: "séances" };
}
function initiales(nom) {
  const m = String(nom || "").trim().split(/\s+/).filter(Boolean);
  return ((m[0] || "?")[0] + (m[1] ? m[1][0] : "")).toUpperCase();
}
// LE RÉSUMÉ PUBLIC, le seul que les athlètes lisent. Aucune clé, aucun e-mail :
// un athlète n'apprend l'existence d'un autre que si celui-ci a choisi le
// classement (opt-in), et alors sous le nom qu'il a choisi (pseudo ou prénom).
// parts : [{cle, nom, classement, valeur, metrique, termine, termineLe}]
function resumePublic(defi, parts) {
  const inscrits = parts.filter(Boolean);
  const equipe = partEquipe(defi, inscrits.map((p) => p.valeur));
  const visibles = inscrits.filter((p) => p.classement);
  const tri = (a, b) => (b.metrique - a.metrique) || ((a.termineLe || Infinity) - (b.termineLe || Infinity));
  const classement = visibles.slice().sort(tri).slice(0, 10)
    .map((p) => ({ nom: String(p.nom || "").slice(0, 24), valeur: p.metrique, termine: !!p.termine }));
  const somme = inscrits.reduce((a, p) => a + Math.max(0, Number(p.valeur) || 0), 0);
  return {
    n: inscrits.length,
    termines: inscrits.filter((p) => p.termine).length,
    equipe: { part: Math.round(equipe * 1000) / 1000, valeur: _somme(defi) ? somme : null },
    classement,
    visibles: visibles.slice(0, 12).map((p) => ({ nom: String(p.nom || "").slice(0, 24), ini: initiales(p.nom) }))
  };
}
// Les places, pour chaque participant (la sienne est écrite dans son nœud :
// il se retrouve au classement sans que les autres y lisent sa clé).
function places(parts) {
  const tri = parts.filter(Boolean).slice().sort((a, b) =>
    (b.metrique - a.metrique) || ((a.termineLe || Infinity) - (b.termineLe || Infinity)));
  const out = {};
  tri.forEach((p, i) => { out[p.cle] = i + 1; });
  return out;
}
// LE GAGNANT : la meilleure métrique de classement (régularité ou %), à
// égalité le premier à avoir fini. Il faut avoir bouclé le défi.
function gagnant(parts) {
  const f = parts.filter((p) => p && p.termine && p.metrique > 0);
  if (!f.length) return null;
  return f.sort((a, b) => (b.metrique - a.metrique) || ((a.termineLe || Infinity) - (b.termineLe || Infinity)))[0];
}
function _nomPublic(p) { return p && p.classement ? String(p.nom || "").slice(0, 24) : null; }
function _liste3(noms, reste) {
  const n = noms.slice(0, 3);
  const r = reste + (noms.length - n.length);
  let t = n.length > 1 ? n.slice(0, -1).join(", ") + " et " + n[n.length - 1] : (n[0] || "");
  if (r > 0) t += (t ? " et " : "") + r + " autre" + (r > 1 ? "s" : "");
  return t;
}
// LE MESSAGE SYSTÈME SUIVANT, ou null. UN PAR JOUR ET PAR DÉFI : si l'un est
// déjà parti aujourd'hui, rien — ce qui attend partira au prochain passage (la
// prochaine séance, ou la tâche du matin). Priorité : 100 % d'équipe, puis les
// athlètes qui ont bouclé le défi (tous ceux en attente, en un seul message),
// puis le plus haut palier d'équipe (les plus bas sont alors considérés dits).
// Rend {texte, etat} — etat, le nouvel état à écrire.
function annonceSuivante(defi, etat, parts, equipe, jour) {
  const e = Object.assign({ paliers: {}, finis: {} }, etat || {});
  e.paliers = Object.assign({}, e.paliers); e.finis = Object.assign({}, e.finis);
  if (e.dernierSysteme === jour || e.clos) return null;
  const pct = Math.floor(equipe * 100 + 1e-9);
  const enAttente = PALIERS_EQUIPE.filter((p) => pct >= p && !e.paliers[p]);
  const finisseurs = parts.filter((p) => p && p.termine && !e.finis[p.cle]);
  const titre = String(defi.titre || "le défi");
  let texte = null;
  if (enAttente.indexOf(100) >= 0 && defi.collectif) {
    texte = "🏁 L'équipe a atteint 100 % : « " + titre + " » est relevé !";
    PALIERS_EQUIPE.forEach((p) => { e.paliers[p] = true; });
    finisseurs.forEach((p) => { e.finis[p.cle] = true; });
  } else if (finisseurs.length && !defi.collectif) {
    const noms = finisseurs.map(_nomPublic).filter(Boolean);
    const anonymes = finisseurs.length - noms.length;
    const qui = _liste3(noms, anonymes);
    const pluriel = finisseurs.length > 1;
    texte = (noms.length ? qui : (pluriel ? finisseurs.length + " athlètes" : "Un athlète"))
      + (pluriel ? " ont bouclé" : " a bouclé") + " « " + titre + " » !";
    finisseurs.forEach((p) => { e.finis[p.cle] = true; });
  } else if (enAttente.length) {
    const p = Math.max.apply(null, enAttente);
    texte = p === 100 ? "🏁 100 % : tout le monde a bouclé « " + titre + " » !"
      : "📈 L'équipe a atteint " + p + " % de « " + titre + " ».";
    PALIERS_EQUIPE.forEach((x) => { if (x <= p) e.paliers[x] = true; });
    if (defi.collectif) finisseurs.forEach((f) => { e.finis[f.cle] = true; });
  }
  if (!texte) return null;
  e.dernierSysteme = jour;
  return { texte, etat: e };
}
// LE PODIUM, à la clôture : les trois premiers du classement qui ont choisi
// d'y figurer ; le champion anonyme reste anonyme.
function textePodium(defi, parts) {
  const titre = String(defi.titre || "le défi");
  const g = gagnant(parts);
  const vis = parts.filter((p) => p && p.classement && p.metrique > 0)
    .sort((a, b) => (b.metrique - a.metrique) || ((a.termineLe || Infinity) - (b.termineLe || Infinity))).slice(0, 3);
  const unite = defi.mesure === "progressionPct" ? " %" : (defi.mesure === "serie" ? " sem." : " séances");
  const med = ["🥇", "🥈", "🥉"];
  const lignes = vis.map((p, i) => med[i] + " " + p.nom + " — " + String(p.metrique).replace(".", ",") + unite);
  const fin = parts.filter((p) => p && p.termine).length;
  let t = "🏆 Défi terminé : « " + titre + " ». ";
  t += fin ? fin + " athlète" + (fin > 1 ? "s ont" : " a") + " relevé le défi." : "Personne ne l'a bouclé cette fois.";
  if (lignes.length) t += "\n" + lignes.join("\n");
  if (g && !g.classement) t += "\nLe champion a choisi de rester discret.";
  return t.slice(0, 1000);
}

// « 12 séances », « 100 000 kg », « 4 semaines validées », « +5 % ».
function texteObjectif(defi) {
  const o = Number(defi && defi.objectif) || 0;
  const n = o.toLocaleString("fr-FR").replace(/\u202f/g, " ");
  switch (defi && defi.mesure) {
    case "seances": return n + " séance" + (o > 1 ? "s" : "");
    case "tonnage": return n + " kg";
    case "serie": return n + " semaine" + (o > 1 ? "s" : "") + " validée" + (o > 1 ? "s" : "");
    case "progressionPct": return "+" + n + " %";
    default: return n;
  }
}

module.exports = {
  texteObjectif,
  MESURES, PALIERS_EQUIPE, J, tonnageSeance, lundiParis, quota, valeurDefi, partEquipe, partPerso,
  aTermine, metriqueClassement, initiales, resumePublic, places, gagnant, annonceSuivante, textePodium
};
