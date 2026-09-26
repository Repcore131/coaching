// Banc des ambassadeurs, Firebase et PayPal simulés : node functions/test/ambassadeurs.test.js
const Module = require("module");
const path = require("path");
const store = {};
const parts = (p) => p.split("/").filter(Boolean);
const get = (p) => parts(p).reduce((o, k) => (o == null ? undefined : o[k]), store);
const set = (p, v) => {
  const ks = parts(p); let o = store;
  for (let i = 0; i < ks.length - 1; i++) { o[ks[i]] = o[ks[i]] || {}; o = o[ks[i]]; }
  if (v === null || v === undefined) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v));
};
const snap = (v, key) => ({ key, val: () => (v === undefined ? null : v), exists: () => v != null,
  forEach(fn) { if (v && typeof v === "object") Object.keys(v).forEach((k) => fn(snap(v[k], k))); } });
const ref = (p = "", filtre) => ({
  get: async () => {
    let v = get(p);
    if (filtre && v && typeof v === "object") {
      const o = {}; Object.keys(v).forEach((k) => { if (v[k] && v[k][filtre.k] === filtre.v) o[k] = v[k]; }); v = o;
    }
    return snap(v, parts(p).pop());
  },
  set: async (v) => set(p, v), remove: async () => set(p, null),
  update: async (v) => { for (const k in v) set(p + "/" + k, v[k]); },
  transaction: async (fn) => { const r = fn(get(p)); if (r === undefined) return { committed: false }; set(p, r); return { committed: true }; },
  orderByChild(k) { return { equalTo: (v) => ref(p, { k, v }) }; },
  toString: () => "https://x.firebaseio.com/" + p
});
const envoyes = [];
const mocks = {
  "firebase-admin": { initializeApp() {}, database: () => ({ ref }), credential: { applicationDefault: () => ({ getAccessToken: async () => ({ access_token: "t" }) }) } },
  "firebase-functions/v2/https": { onCall: (o, f) => f || o, onRequest: (o, f) => f || o, HttpsError: class extends Error {} },
  "firebase-functions/params": { defineSecret: (n) => ({ value: () => "secret-" + n }) },
  "firebase-functions/v2": { setGlobalOptions() {} },
  "firebase-functions/v2/scheduler": { onSchedule: (o, f) => f },
  "firebase-functions/v2/database": { onValueCreated: (o, f) => f, onValueWritten: (o, f) => f },
  "web-push": { setVapidDetails() {}, async sendNotification(sub, charge) { envoyes.push([sub.endpoint, JSON.parse(charge)]); } }
};
const orig = Module._load;
Module._load = function (req, ...a) { if (mocks[req]) return mocks[req]; return orig.call(this, req, ...a); };
global.fetch = async () => ({ ok: false });
const F = require(path.join(__dirname, "..", "index.js"));
const A = require(path.join(__dirname, "..", "ambassadeurs-calcul.js"));
const assert = (c, m) => { if (!c) { console.log("ECHEC:", m); process.exitCode = 1; } else console.log("ok  :", m); };
const T = (iso) => Date.parse(iso);
(async () => {
  // 1. Les règles pures.
  assert(A.tauxPour({}, 50) === 20 && A.tauxPour({}, 51) === 25, "20 %, puis 25 % au-delà de 50 payants");
  assert(A.finPeriode(T("2026-03-15T12:00:00Z"), 12) === T("2027-03-15T12:00:00Z"), "12 mois calendaires");
  const c1 = A.commissionPour({}, {}, 1, { montant: 24.9, le: T("2026-10-05T10:00:00Z") });
  assert(c1 && c1.commission === 4.98 && c1.mois === "2026-10" && c1.dueLe === T("2026-11-04T10:00:00Z"), "commission = 20 % de 24,90 = 4,98, due 30 jours après");
  assert(A.commissionPour({}, { premierPaiement: T("2025-10-01T00:00:00Z") }, 1, { montant: 10, le: T("2026-10-02T00:00:00Z") }) === null, "après 12 mois : plus rien");
  assert(A.commissionPour({ actif: false }, {}, 1, { montant: 10, le: 1 }) === null, "ambassadeur éteint : rien");
  assert(A.idPaiement({ abonnement: "I-ABC", le: T("2026-10-05T10:00:00Z"), montant: 9.5 }) === A.idPaiement({ abonnement: "I-ABC", le: T("2026-10-05T10:00:07Z"), montant: "9.50" }),
    "un même encaissement vu par le client et par le webhook a le même identifiant");
  const fiche = { nom: "Léa", commissions: { "2026-10": { a: { montant: 20, commission: 4, dueLe: 100 }, b: { montant: 20, commission: 4, dueLe: 900 },
    c: { montant: 20, commission: 4, dueLe: 100, statut: "payee" }, d: { montant: 20, commission: 4, dueLe: 100, statut: "rembourse" } } } };
  const r = A.resume("LEA", fiche, 500);
  assert(r.due === 4 && r.attente === 4 && r.payee === 4 && r.rembourse === 4 && r.ca === 60, "résumé : due / en attente / payée / remboursée");
  const csv = A.csvDues("LEA", fiche, "2026-10", 500);
  assert(csv.split("\n").filter(Boolean).length === 2 && /^LEA;"Léa";2026-10;a;/m.test(csv) && /;4;/.test(csv), "CSV : les seules commissions dues (en-tête + 1 ligne)");

  // 2. Le parcours.
  const RealNow = Date.now;
  const a = (iso) => { Date.now = () => T(iso); };
  a("2026-10-01T10:00:00Z");
  set("ambassadeurs/LEAFIT", { nom: "Léa", instagram: "leafit", avantage: "essai+1mois", commissionPct: 20, palierPct: 25, dureeMois: 12, actif: true, secret: "abcdefghijklmnopqrstuvwx" });
  set("ambassadeurs_publics/LEAFIT", { nom: "Léa", avantage: "essai+1mois", actif: true });
  const rep = () => { const r = { code: 0, h: {} }; r.set = (k, v) => { r.h[k] = v; }; r.status = (c) => { r.code = c; return r; }; r.send = () => {}; return r; };
  await F.ambClic({ query: { c: "leafit" } }, rep()); await F.ambClic({ query: { c: "LEAFIT" } }, rep()); await F.ambClic({ query: { c: "INCONNU" } }, rep());
  assert(get("ambassadeurs/LEAFIT/stats/clics") === 2 && !get("ambassadeurs/INCONNU"), "clics comptés, code inconnu ignoré");
  set("users/max@t,fr", { fname: "Max", createdAt: Date.now() - 3600e3 });
  set("droits/max@t,fr", { palier: "ultime", echeance: Date.now() + 30 * 864e5, essaiOuvertLe: Date.now(), essaiFinit: Date.now() + 30 * 864e5, source: "essai" });
  const d = { code: "LEAFIT", le: Date.now(), appareil: "appmax12345678" };
  set("ambassadeurs_demandes/max@t,fr", d);
  await F.ambassadeurDemande({ params: { uid: "max@t,fr" }, data: { val: () => d } });
  assert(get("ambassadeurs_demandes/max@t,fr/etat") === "accepte" && get("ambassadeurs/LEAFIT/stats/inscrits") === 1, "inscription attribuée à Léa");
  assert(get("droits/max@t,fr/essaiFinit") === Date.now() + 60 * 864e5, "avantage : un mois d'essai en plus");
  // Max, venu par un ambassadeur, ne peut plus devenir filleul d'un parrain.
  set("parrainage/codes/KEVIN7K2", "kev@t,fr");
  const dp = { code: "KEVIN7K2", le: Date.now(), appareil: "appmax12345678" };
  set("parrainage/demandes/max@t,fr", dp);
  await F.parrainageDemande({ params: { uid: "max@t,fr" }, data: { val: () => dp } });
  assert(get("parrainage/demandes/max@t,fr/raison") === "ambassadeur", "un seul avantage : pas de parrain en plus");
  // Premier paiement, par l'appel du client…
  a("2026-10-05T10:00:00Z");
  global.fetch = async (url) => {
    if (/oauth2/.test(url)) return { ok: true, json: async () => ({ access_token: "tok" }) };
    if (/verify-webhook-signature/.test(url)) return { ok: true, json: async () => ({ verification_status: "SUCCESS" }) };
    return { ok: true, json: async () => ({ id: "I-MAX1234567890ABCD", status: "ACTIVE", plan_id: "P-95N51603RD882780YNJKS2QA",
      billing_info: { last_payment: { amount: { value: "24.90" }, time: "2026-10-05T09:59:50Z" } } }) };
  };
  await F.verifyPaypalSubscription({ auth: { token: { email: "max@t.fr" } }, data: { subscriptionId: "I-MAX1234567890ABCD" } });
  const com = () => get("ambassadeurs/LEAFIT/commissions/2026-10") || {};
  assert(Object.keys(com()).length === 1 && Object.values(com())[0].commission === 4.98, "premier paiement : 4,98 € de commission");
  assert(get("ambassadeurs/LEAFIT/stats/payants") === 1 && get("ambassadeurs/LEAFIT/stats/ca") === 24.9, "un payant, 24,90 € de chiffre d'affaires");
  // … puis le même, par le webhook (vente sans adresse : retrouvée par l'abonnement).
  const hook = async (corps) => { const r = rep(); await F.paypalWebhook({ method: "POST", headers: {}, body: corps }, r); return r; };
  await hook({ event_type: "PAYMENT.SALE.COMPLETED", resource: { id: "SALE1", billing_agreement_id: "I-MAX1234567890ABCD",
    amount: { total: "24.90" }, create_time: "2026-10-05T10:00:03Z" } });
  assert(Object.keys(com()).length === 1 && get("ambassadeurs/LEAFIT/stats/ca") === 24.9, "le même encaissement n'est pas compté deux fois");
  // Le mois suivant : une nouvelle commission, remboursée ensuite.
  a("2026-11-05T10:00:00Z");
  await hook({ event_type: "PAYMENT.SALE.COMPLETED", resource: { id: "SALE2", billing_agreement_id: "I-MAX1234567890ABCD",
    amount: { total: "24.90" }, create_time: "2026-11-05T10:00:00Z" } });
  const nov = get("ambassadeurs/LEAFIT/commissions/2026-11") || {};
  assert(Object.keys(nov).length === 1 && get("ambassadeurs/LEAFIT/stats/payants") === 1, "renouvellement : commission du mois, pas de nouveau payant");
  await hook({ event_type: "PAYMENT.SALE.REFUNDED", resource: { id: "R1", sale_id: "SALE2" } });
  assert(Object.values(get("ambassadeurs/LEAFIT/commissions/2026-11"))[0].statut === "rembourse", "remboursement : commission annulée");
  const vue = get("ambassadeurs_vue/abcdefghijklmnopqrstuvwx");
  assert(vue && vue.clics === 2 && vue.inscrits === 1 && vue.payants === 1 && vue.due === 4.98 && vue.rembourse === 4.98, "la page secrète : entonnoir, commission due (octobre, à 30 jours), remboursée");
  Date.now = RealNow;
})();
