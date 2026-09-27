// Banc de l'attribution : node functions/test/attribution.test.js
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
const ATT = require(path.join(__dirname, "..", "attribution-calcul.js"));
const assert = (c, m) => { if (!c) { console.log("ECHEC:", m); process.exitCode = 1; } else console.log("ok  :", m); };
const T = (iso) => Date.parse(iso);
(async () => {
  assert(ATT.srcArrivee({ src: "Seance" }) === "seance" && ATT.srcArrivee({ amb: "leafit" }) === "amb" && ATT.srcArrivee({ ref: "JULIE7K2" }) === "parrainage"
    && ATT.srcArrivee({}) === "direct" && ATT.srcArrivee({ src: "<script>" }) === "script", "src : normalisé, sinon amb, parrainage, direct");
  const ch = ATT.cheminsArrivee({ src: "rang", ref: "JULIE7K2", amb: "LEAFIT" }, T("2026-10-05T22:30:00Z"));
  assert(ch.join() === "attribution/jours/2026-10-06/src/rang/clic,attribution/jours/2026-10-06/amb/LEAFIT/clic", "jour de Paris ; le code parrain n'est jamais enregistré");
  const RealNow = Date.now; Date.now = () => T("2026-10-06T10:00:00Z");
  set("ambassadeurs/LEAFIT", { nom: "Léa", actif: true });
  const rep = () => { const r = { h: {} }; r.set = (k, v) => { r.h[k] = v; }; r.status = (c) => { r.code = c; return r; }; r.send = () => {}; return r; };
  const r = rep();
  await F.attribArrivee({ query: { src: "seance", amb: "LEAFIT", ref: "JULIE7K2" } }, r);
  const jour = get("attribution/jours/2026-10-06");
  assert(r.code === 204 && !r.h["Set-Cookie"] && jour.src.seance.clic === 1 && jour.amb.LEAFIT.clic === 1 && get("ambassadeurs/LEAFIT/stats/clics") === 1,
    "arrivée : 204, sans cookie, clic par src et par ambassadeur");
  assert(!JSON.stringify(get("attribution")).includes("JULIE"), "aucune trace du code parrain");
  // Premier paiement : l'origine reçoit sa date, le compteur « payant » de son src prend un — une fois.
  set("users/max@t,fr", { origine: { src: "seance", amb: "LEAFIT", inscritLe: 1 } });
  global.fetch = async (url) => (/oauth2/.test(url) ? { ok: true, json: async () => ({ access_token: "tok" }) }
    : { ok: true, json: async () => ({ id: "I-MAX1234567890ABCD", status: "ACTIVE", plan_id: "P-95N51603RD882780YNJKS2QA",
      billing_info: { last_payment: { amount: { value: "9.50" }, time: "2026-10-06T09:59:00Z" } } }) });
  const req = { auth: { token: { email: "max@t.fr" } }, data: { subscriptionId: "I-MAX1234567890ABCD" } };
  await F.verifyPaypalSubscription(req); await F.verifyPaypalSubscription(req);
  const j2 = get("attribution/jours/2026-10-06");
  assert(get("users/max@t,fr/origine/payeLe") === Date.now() && j2.src.seance.payant === 1 && j2.amb.LEAFIT.payant === 1, "payant compté une seule fois, par src et par ambassadeur");
  Date.now = RealNow;
})();
