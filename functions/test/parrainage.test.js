// Banc du parrainage, Firebase simulé en mémoire : node functions/test/parrainage.test.js
// Les règles pures (parrainage-calcul.js), puis le parcours : demande, refus
// (soi-même, alias, appareil, deuxième parrain), mois d'essai en plus, premier
// paiement (et lui seul), palier des 10.
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
const P = require(path.join(__dirname, "..", "parrainage-calcul.js"));
const assert = (c, m) => { if (!c) { console.log("ECHEC:", m); process.exitCode = 1; } else console.log("ok  :", m); };
(async () => {
  // 1. Les règles pures.
  assert(P.emailNormalise("J.Dupont+rc@GoogleMail.com") === "jdupont@gmail.com" && P.emailNormalise("j.dupont+x@free.fr") === "j.dupont@free.fr",
    "adresse normalisée : alias et points Gmail retirés");
  assert(/^f[a-z0-9]+$/.test(P.idFilleul("julie@t,fr")) && P.idFilleul("a") !== P.idFilleul("b"), "l'identifiant du filleul n'est pas son adresse");
  const ctx = { filleul: "julie@t,fr", filleulEmail: "julie@t.fr", parrain: "kev@t,fr", parrainEmail: "kev@t.fr", maintenant: 10, creeLe: 5 };
  assert(P.deciderRattachement({ code: "KEVIN7K2" }, ctx).ok, "rattachement accepté");
  assert(P.deciderRattachement({ code: "KEVIN7K2" }, Object.assign({}, ctx, { parrain: "julie@t,fr" })).raison === "soi_meme", "pas d'auto-parrainage");
  assert(P.deciderRattachement({ code: "KEVIN7K2" }, Object.assign({}, ctx, { filleulEmail: "k.e.v+2@gmail.com", parrainEmail: "kev@gmail.com" })).raison === "meme_personne", "pas d'alias de soi-même");
  assert(P.deciderRattachement({ code: "KEVIN7K2", appareil: "abc" }, Object.assign({}, ctx, { appareilsParrain: { abc: true } })).raison === "meme_appareil", "pas depuis l'appareil du parrain");
  assert(P.deciderRattachement({ code: "KEVIN7K2" }, Object.assign({}, ctx, { creeLe: 1, maintenant: 1 + 8 * 864e5 })).raison === "compte_ancien", "un ancien compte ne se déclare plus filleul");
  assert(P.deciderRattachement({ code: "kevin" }, ctx).raison === "code_invalide", "code mal formé refusé");
  const c0 = { filleuls: { a: { statut: "inscrit", prenom: "Julie" } }, moisGagnes: 2 };
  const p1 = P.premierPaiement(c0, "a", 9);
  assert(p1 && p1.moisGagnes === 3 && p1.payants === 1 && !p1.mentor, "premier paiement : +1 mois");
  assert(P.premierPaiement({ filleuls: { a: { statut: "payant" } } }, "a", 9) === null, "renouvellement : rien");
  const neuf = {}; for (let i = 0; i < 9; i++) neuf["x" + i] = { statut: "payant" }; neuf.a = { statut: "inscrit" };
  assert(P.premierPaiement({ filleuls: neuf }, "a", 9).mentor === true, "10e filleul payant : palier MENTOR");
  assert(P.premierPaiement({ filleuls: neuf, mentorLe: 5 }, "a", 9).mentor === false, "le palier des 10 ne se gagne qu'une fois");

  // 2. Le parcours.
  const RealNow = Date.now;
  const a = (iso) => { Date.now = () => Date.parse(iso); };
  a("2026-10-01T12:00:00Z");
  const t0 = Date.now();
  set("parrainage/codes/KEVIN7K2", "kev@t,fr");
  set("parrainage/appareils/appkevin1234", "kev@t,fr");
  set("users/kev@t,fr", { fname: "Kevin" });
  set("droits/kev@t,fr", { palier: "essentielle", echeance: Date.parse("2026-10-20T00:00:00Z"), source: "paypal" });
  set("push/kev@t,fr/p1", { endpoint: "https://p/kev", keys: { p256dh: "x", auth: "y" } });
  set("users/julie@t,fr", { fname: "Julie", createdAt: t0 - 3600e3 });
  set("droits/julie@t,fr", { palier: "ultime", echeance: t0 + 30 * 864e5, essaiOuvertLe: t0, essaiFinit: t0 + 30 * 864e5, source: "essai" });
  const demande = async (uid, d) => { set("parrainage/demandes/" + uid, d); await F.parrainageDemande({ params: { uid }, data: { val: () => d } }); };
  await demande("julie@t,fr", { code: "KEVIN7K2", le: t0, appareil: "appjulie1234" });
  assert(get("parrainage/demandes/julie@t,fr/etat") === "accepte", "demande de Julie acceptée");
  const id = P.idFilleul("julie@t,fr");
  assert(get("parrainage/comptes/kev@t,fr/filleuls/" + id + "/statut") === "inscrit" && !JSON.stringify(get("parrainage/comptes/kev@t,fr")).includes("julie@"),
    "Kevin voit Julie « inscrite », sans son adresse");
  assert(get("droits/julie@t,fr/essaiFinit") === t0 + 60 * 864e5 && get("droits/julie@t,fr/echeance") === t0 + 60 * 864e5, "Julie : un mois d'essai en plus");
  // Refus : même appareil que le parrain ; alias ; deuxième demande.
  set("users/tom@t,fr", { fname: "Tom", createdAt: t0 });
  await demande("tom@t,fr", { code: "KEVIN7K2", le: t0, appareil: "appkevin1234" });
  assert(get("parrainage/demandes/tom@t,fr/etat") === "refuse" && get("parrainage/demandes/tom@t,fr/raison") === "meme_appareil", "refus : appareil du parrain");
  set("users/kev+2@t,fr", { fname: "K", createdAt: t0 });
  await demande("kev+2@t,fr", { code: "KEVIN7K2", le: t0, appareil: "autre12345678" });
  assert(get("parrainage/demandes/kev+2@t,fr/raison") === "meme_personne", "refus : alias du parrain");
  // Pas un sou tant que Julie n'a pas payé.
  const echAvant = get("droits/kev@t,fr/echeance");
  assert(echAvant === Date.parse("2026-10-20T00:00:00Z") && !get("parrainage/comptes/kev@t,fr/moisGagnes"), "rien pour le parrain à l'inscription");
  // Le premier paiement de Julie, puis un renouvellement.
  a("2026-11-05T12:00:00Z");
  set("push_log/kev@t,fr", null);
  // Kevin a expiré entre-temps : le mois offert part de maintenant, en Essentielle.
  // Le webhook demande une signature PayPal : on passe par l'appel du client
  // (verifyPaypalSubscription), qui mène au même utilitaire.
  global.fetch = async (url) => {
    if (/oauth2/.test(url)) return { ok: true, json: async () => ({ access_token: "tok" }) };
    return { ok: true, json: async () => ({ status: "ACTIVE", plan_id: "P-95N51603RD882780YNJKS2QA",
      billing_info: { last_payment: { amount: { value: "9.50" } } } }) };
  };
  const req = { auth: { token: { email: "julie@t.fr" } }, data: { subscriptionId: "I-JULIE1234567890AB" } };
  await F.verifyPaypalSubscription(req);
  const compte = get("parrainage/comptes/kev@t,fr");
  assert(compte.filleuls[id].statut === "payant" && compte.moisGagnes === 1, "premier paiement : Julie « payante », 1 mois gagné");
  const ech = get("droits/kev@t,fr/echeance");
  assert(ech === Date.now() + 30 * 864e5 && get("droits/kev@t,fr/palier") === "essentielle", "droits du parrain prolongés d'un mois");
  assert(envoyes.some((x) => x[0] === "https://p/kev" && x[1].title === "Julie vient de s’abonner : 1 mois offert"), "le parrain est prévenu");
  assert(Object.values(get("parrainage/evenements/kev@t,fr") || {}).some((e) => e.type === "paiement" && e.prenom === "Julie"), "événement écrit");
  await F.verifyPaypalSubscription(req);
  assert(get("parrainage/comptes/kev@t,fr/moisGagnes") === 1 && get("droits/kev@t,fr/echeance") === ech, "renouvellement : aucun mois de plus");
  // Un abonnement ACTIVE sans argent passé (essai PayPal) : rien.
  set("users/lou@t,fr", { fname: "Lou", createdAt: Date.now() });
  await demande("lou@t,fr", { code: "KEVIN7K2", le: Date.now(), appareil: "applou1234567" });
  global.fetch = async (url) => (/oauth2/.test(url) ? { ok: true, json: async () => ({ access_token: "tok" }) }
    : { ok: true, json: async () => ({ status: "ACTIVE", plan_id: "P-95N51603RD882780YNJKS2QA", billing_info: {} }) });
  await F.verifyPaypalSubscription({ auth: { token: { email: "lou@t.fr" } }, data: { subscriptionId: "I-LOU1234567890ABCD" } });
  assert(get("parrainage/comptes/kev@t,fr/moisGagnes") === 1, "abonnement sans paiement encaissé : rien pour le parrain");
  Date.now = RealNow;
})();
