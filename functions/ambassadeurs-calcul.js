// ══ LES AMBASSADEURS — LES COMMISSIONS, SANS FIREBASE ══════════════════════
//
// Module PUR, éprouvé par functions/test/ambassadeurs.test.js ; la même règle
// de « due » est lue par le tableau de bord admin (app/rc-core.*.js,
// ambCommissionEtat) et par la page secrète de l'ambassadeur (a/index.html).
"use strict";

const CODE_AMB_RE = /^[A-Z0-9]{3,16}$/;
const DELAI_DUE_MS = 30 * 864e5;            // une commission n'est due que 30 jours après le paiement
const DEFAUTS = Object.freeze({ commissionPct: 20, palierPct: 25, palierSeuil: 50, dureeMois: 12 });

function config(a) {
  const x = a || {};
  const n = (v, d, min, max) => { const k = Number(v); return isFinite(k) && k >= min && k <= max ? k : d; };
  return {
    commissionPct: n(x.commissionPct, DEFAUTS.commissionPct, 0, 100),
    palierPct: n(x.palierPct, DEFAUTS.palierPct, 0, 100),
    palierSeuil: n(x.palierSeuil, DEFAUTS.palierSeuil, 1, 100000),
    dureeMois: n(x.dureeMois, DEFAUTS.dureeMois, 1, 120),
    actif: x.actif !== false
  };
}
// Le mois (AAAA-MM) d'un instant, à Paris.
function moisParis(t) {
  const p = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" })
    .formatToParts(new Date(t)).forEach((x) => { p[x.type] = x.value; });
  return p.year + "-" + p.month;
}
// La fin de la période de commission : `dureeMois` mois CALENDAIRES après le
// premier paiement (le 15 mars + 12 mois = le 15 mars suivant).
function finPeriode(premier, dureeMois) {
  const d = new Date(Number(premier));
  d.setUTCMonth(d.getUTCMonth() + Number(dureeMois || 12));
  return d.getTime();
}
// Le taux applicable : le taux de base, puis le taux de palier AU-DELÀ du
// seuil de filleuls payants (le 51e et les suivants, avec le seuil par défaut).
function tauxPour(cfg, payants) {
  const c = config(cfg);
  return Number(payants) > c.palierSeuil ? c.palierPct : c.commissionPct;
}
// L'identifiant d'un paiement. Un abonnement arrive DEUX fois pour un même
// encaissement — l'appel du client (verifyPaypalSubscription) et le webhook
// (PAYMENT.SALE.COMPLETED) — sous des identifiants différents : on les ramène
// au même, abonnement + jour + montant en centimes.
function idPaiement(o) {
  const net = (s) => String(s || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
  if (o && o.abonnement) {
    const jour = new Date(Number(o.le) || Date.now()).toISOString().slice(0, 10);
    return net(o.abonnement) + "_" + jour + "_" + Math.round(Number(o.montant) * 100);
  }
  return net((o && o.id) || ("p" + Date.now()));
}
/**
 * LA COMMISSION D'UN PAIEMENT, ou null.
 *   cfg       la fiche de l'ambassadeur
 *   filleul   {premierPaiement?} — sa ligne chez l'ambassadeur
 *   payants   le nombre de filleuls payants, CE paiement compris
 *   p         {montant (euros encaissés), le (ms)}
 * Rend {montant, pct, commission, payeLe, dueLe, mois, premier} — `premier` :
 * la date du premier paiement à poser si elle manquait.
 */
function commissionPour(cfg, filleul, payants, p) {
  const c = config(cfg);
  const montant = Math.round(Number(p && p.montant) * 100) / 100;
  if (!(montant > 0) || !c.actif) return null;
  const le = Number(p.le) || Date.now();
  const premier = Number(filleul && filleul.premierPaiement) || le;
  if (le >= finPeriode(premier, c.dureeMois)) return null;         // hors période
  const pct = tauxPour(c, payants);
  return { montant, pct, commission: Math.round(montant * pct) / 100, payeLe: le, dueLe: le + DELAI_DUE_MS,
    mois: moisParis(le), premier };
}
// L'état d'une commission, à l'instant t : 'rembourse' | 'payee' | 'due' | 'attente'.
function etatCommission(x, t) {
  if (!x) return "attente";
  if (x.statut === "rembourse") return "rembourse";
  if (x.statut === "payee") return "payee";
  return Number(t) >= Number(x.dueLe) ? "due" : "attente";
}
// LE RÉSUMÉ d'un ambassadeur : l'entonnoir, le chiffre d'affaires, et les
// commissions par état et par mois. C'est aussi, tel quel, sa page secrète.
function resume(code, a, t) {
  const s = (a && a.stats) || {};
  const out = { code, nom: String((a && a.nom) || "").slice(0, 80), clics: Number(s.clics) || 0, inscrits: Number(s.inscrits) || 0,
    payants: Number(s.payants) || 0, ca: 0, due: 0, payee: 0, attente: 0, rembourse: 0, mois: {} };
  const com = (a && a.commissions) || {};
  for (const m of Object.keys(com).sort()) {
    const lm = { ca: 0, due: 0, payee: 0, attente: 0 };
    for (const id of Object.keys(com[m] || {})) {
      const x = com[m][id]; if (!x) continue;
      const e = etatCommission(x, t);
      if (e === "rembourse") { out.rembourse += Number(x.commission) || 0; continue; }
      lm.ca += Number(x.montant) || 0; out.ca += Number(x.montant) || 0;
      lm[e] += Number(x.commission) || 0; out[e] += Number(x.commission) || 0;
    }
    for (const k of Object.keys(lm)) lm[k] = Math.round(lm[k] * 100) / 100;
    out.mois[m] = lm;
  }
  // LE CHIFFRE D'AFFAIRES : tout ce qui a été encaissé (stats.ca), y compris
  // hors période de commission ; à défaut, la somme des paiements commissionnés.
  if (Number(s.ca) > 0) out.ca = Number(s.ca);
  for (const k of ["ca", "due", "payee", "attente", "rembourse"]) out[k] = Math.round(out[k] * 100) / 100;
  return out;
}
// L'EXPORT DU MOIS : une ligne par commission DUE (ni en attente, ni payée,
// ni remboursée). Séparateur « ; » et virgule décimale : Excel en français.
function csvDues(code, a, mois, t) {
  const l = [["code", "ambassadeur", "mois", "paiement", "date_paiement", "montant_encaisse", "taux_pct", "commission", "due_le"].join(";")];
  const com = ((a && a.commissions) || {})[mois] || {};
  const d = (ms) => { const x = new Date(Number(ms)); return isNaN(x.getTime()) ? "" : x.toISOString().slice(0, 10); };
  const e = (v) => String(v).replace(".", ",");
  const q = (s) => '"' + String(s || "").replace(/"/g, '""') + '"';
  for (const id of Object.keys(com).sort()) {
    const x = com[id];
    if (etatCommission(x, t) !== "due") continue;
    l.push([code, q(a && a.nom), mois, id, d(x.payeLe), e(x.montant), x.pct, e(x.commission), d(x.dueLe)].join(";"));
  }
  return l.join("\n") + "\n";
}

module.exports = { CODE_AMB_RE, DELAI_DUE_MS, DEFAUTS, config, moisParis, finPeriode, tauxPour, idPaiement,
  commissionPour, etatCommission, resume, csvDues };
