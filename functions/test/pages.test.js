// Banc des pages publiques (aperçu Open Graph) : node functions/test/pages.test.js
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
const OG = require(path.join(__dirname, "..", "pages-og.js"));
const fs = require("fs");
const assert = (c, m) => { if (!c) { console.log("ECHEC:", m); process.exitCode = 1; } else console.log("ok  :", m); };
(async () => {
  assert(JSON.stringify(OG.analyserChemin("/@julie.fit")) === '{"type":"athlete","cle":"julie.fit"}', "chemin /@pseudo");
  assert(JSON.stringify(OG.analyserChemin("/coach/kevin-guellec")) === '{"type":"coach","cle":"kevin-guellec"}', "chemin /coach/slug");
  assert(OG.analyserChemin("/@a") === null && OG.analyserChemin("/@../etc") === null && OG.analyserChemin("/app/") === null, "chemins invalides refusés");
  const a = OG.ogAthlete("julie", { prenom: "Julie", rang: { n: 9, nom: "TITAN" }, seances: 212, serie: 14 });
  assert(a.image === "https://repcore-sync.web.app/app/img/rangs/rang_9-og.jpg" && /TITAN · 212 séances · 14 semaines/.test(a.description), "aperçu athlète : rang, séances, emblème");
  assert(OG.ogCoach("k", { nom: "Kevin G", photo: "data:image/png;base64,xx" }).image === OG.IMAGE_DEFAUT, "photo non https : image par défaut");
  const x = OG.injecterOg('<title>RepCore</title><!--og:debut-->\n<meta property="og:title" content="défaut">\n<!--og:fin--><p>corps</p>',
    { titre: 'Julie <script>', description: "d", image: "i", url: "u" });
  assert(/og:title" content="Julie &lt;script&gt;"/.test(x) && !/défaut/.test(x) && /<p>corps<\/p>/.test(x) && /<title>Julie &lt;script&gt;<\/title>/.test(x),
    "injection : aperçu remplacé et échappé, page intacte");
  // La fonction, sur les vraies pages du dépôt.
  const pages = { "/p/index.html": fs.readFileSync(path.join(__dirname, "..", "..", "p", "index.html"), "utf8"),
    "/c/index.html": fs.readFileSync(path.join(__dirname, "..", "..", "c", "index.html"), "utf8") };
  global.fetch = async (u) => { const k = String(u).replace(OG.ORIGINE, ""); return pages[k] ? { ok: true, text: async () => pages[k] } : { ok: false, status: 404 }; };
  set("profils_publics/julie", { prenom: "Julie", rang: { n: 7, nom: "MONSTRE" }, seances: 80 });
  set("vitrines/kevin-guellec", { nom: "Kevin Guellec", phrase: "La force, ça se construit.", photo: "https://res.cloudinary.com/x/k.jpg" });
  const rep = () => { const r = { h: {}, code: 0, corps: "" }; r.set = (k, v) => { r.h[k] = v; }; r.status = (c) => { r.code = c; return r; };
    r.send = (b) => { r.corps = b; }; r.redirect = (c, u) => { r.code = c; r.corps = u; }; return r; };
  let r = rep(); await F.pagePublique({ path: "/@julie" }, r);
  assert(r.code === 200 && /og:title" content="Julie sur RepCore"/.test(r.corps) && /rang_7-og\.jpg/.test(r.corps) && /profils_publics/.test(r.corps),
    "/@julie : la page athlète, avec son aperçu");
  r = rep(); await F.pagePublique({ path: "/coach/kevin-guellec" }, r);
  assert(/og:image" content="https:\/\/res\.cloudinary\.com\/x\/k\.jpg"/.test(r.corps) && /\/vitrines\//.test(r.corps), "/coach/slug : la vitrine, avec la photo du coach");
  r = rep(); await F.pagePublique({ path: "/@inconnu" }, r);
  assert(r.code === 200 && /Rejoins-moi sur RepCore/.test(r.corps), "pseudo inconnu : la page, aperçu par défaut");
})();
