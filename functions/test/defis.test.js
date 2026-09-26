// Banc des défis du Canal, Firebase simulé en mémoire : node functions/test/defis.test.js
// Il éprouve le calcul pur (defis-calcul.js) sur les MÊMES fixtures que la
// suite du client (« Défis : … » dans app/tests.js), puis le parcours complet :
// inscription, séances, annonces plafonnées, rappel des 48 h, clôture.
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
const D = require(path.join(__dirname, "..", "defis-calcul.js"));
const assert = (c, m) => { if (!c) { console.log("ECHEC:", m); process.exitCode = 1; } else console.log("ok  :", m); };

// ── LES FIXTURES PARTAGÉES AVEC LA SUITE DU CLIENT ─────────────────────────
// Un athlète, octobre 2026 : deux séances en septembre (avant le défi), quatre
// en octobre, dont deux la semaine du 5 (quota : 2 créneaux actifs).
const T = (iso) => Date.parse(iso);
const DEBUT = T("2026-09-30T22:00:00Z"), FIN = T("2026-10-31T22:59:59Z");
const S = (iso, squat, rowing, volume) => ({ date: T(iso), volume,
  data: { "Squat": { sets: [{ weight: String(squat), reps: "5", done: true }] }, "Rowing barre": { sets: [{ weight: String(rowing), reps: "8", done: true }] } } });
const FIXTURE = { sessions_config: [{ active: true }, { active: true }, { active: false }], sessions: [
  S("2026-09-20T17:00:00Z", 100, 60, 3000), S("2026-09-25T17:00:00Z", 100, 64, 3100),
  S("2026-10-05T17:00:00Z", 105, 64, 3200), S("2026-10-07T17:00:00Z", 110, 66, 3300),
  S("2026-10-14T17:00:00Z", 110, 68, 3400), S("2026-10-28T17:00:00Z", 112, 70, 3500)] };
const DEF = (mesure, objectif, collectif) => ({ id: "m1", type: "defi", titre: "Octobre", mesure, objectif, collectif: !!collectif, debut: DEBUT, fin: FIN });

(async () => {
  // 1. Le calcul pur — valeurs attendues identiques côté client.
  assert(D.valeurDefi(FIXTURE, DEF("seances", 12)) === 4, "séances : 4 dans la fenêtre");
  assert(D.valeurDefi(FIXTURE, DEF("tonnage", 100000)) === 13400, "tonnage : 13 400 kg dans la fenêtre");
  assert(D.valeurDefi(FIXTURE, DEF("serie", 4)) === 1, "série : 1 semaine validée (quota 2)");
  // Squat 100 → 112 (+12 %), rowing 64 → 70 (+9,375 %) : moyenne 10,7 %.
  assert(D.valeurDefi(FIXTURE, DEF("progressionPct", 5)) === 10.7, "progression : +10,7 %");
  assert(D.metriqueClassement(DEF("tonnage", 1), FIXTURE).unite === "séances", "tonnage : classé à la régularité, jamais aux kilos");
  assert(D.partEquipe(DEF("seances", 20, true), [4, 6]) === 0.5 && D.partEquipe(DEF("serie", 4, true), [4, 2]) === 0.75,
    "équipe : somme pour les séances, moyenne des parts pour la série");
  assert(D.aTermine(DEF("seances", 20, true), 3, 1) && !D.aTermine(DEF("seances", 20, true), 0, 1) && D.aTermine(DEF("seances", 4), 4, 0),
    "fini : en équipe à 100 % avec une contribution ; seul à l'objectif");
  const e1 = D.annonceSuivante(DEF("seances", 20, true), {}, [], 0.52, "2026-10-10");
  assert(e1 && /50 %/.test(e1.texte) && e1.etat.paliers[25] && e1.etat.paliers[50], "palier 50 % annoncé (25 % considéré dit)");
  assert(D.annonceSuivante(DEF("seances", 20, true), e1.etat, [], 0.8, "2026-10-10") === null, "un message système par jour et par défi");
  const anon = D.annonceSuivante(DEF("seances", 4), {}, [{ cle: "a", nom: "Léa", classement: false, termine: true }], 0.3, "2026-10-11");
  assert(anon && /Un athlète a bouclé/.test(anon.texte) && !/Léa/.test(anon.texte), "un athlète hors classement reste anonyme");
  const pub = D.resumePublic(DEF("seances", 4), [{ cle: "lea,t", nom: "Léa", classement: true, valeur: 4, metrique: 4, termine: true },
    { cle: "tom,t", nom: "Tom", classement: false, valeur: 2, metrique: 2 }]);
  assert(pub.n === 2 && pub.classement.length === 1 && !JSON.stringify(pub).includes(",t"), "résumé public : aucune clé, seul l'opt-in est nommé");

  // 2. Le parcours complet.
  const RealNow = Date.now;
  const a = (iso) => { Date.now = () => T(iso); };
  const coach = "kev,t";
  set("canaux/" + coach + "/messages/m1", { at: DEBUT, type: "defi", titre: "12 séances ce mois", mesure: "seances", objectif: 3, collectif: false, debut: DEBUT, fin: FIN });
  set("canaux/" + coach + "/messages/x", { at: DEBUT, titre: "Info", texte: "ordinaire" });
  set("users/lea,t", { fname: "Léa", coachEmailKey: coach, sessions: [], sessions_config: [{ active: true }] });
  set("users/tom,t", { fname: "Tom", coachEmailKey: coach, sessions: [], sessions_config: [{ active: true }] });
  set("push/lea,t/p1", { endpoint: "https://p/lea", keys: { p256dh: "x", auth: "y" } });
  set("push/tom,t/p2", { endpoint: "https://p/tom", keys: { p256dh: "x", auth: "y" } });
  const ins = async (uid, o) => {
    set("canaux/" + coach + "/defis/m1/participants/" + uid + "/inscription", o);
    await F.defiInscription({ params: { coach, id: "m1", uid }, data: { after: { val: () => o } } });
  };
  const seance = async (uid, iso) => {
    const s = get("users/" + uid + "/sessions") || [];
    set("users/" + uid + "/sessions", s.concat([{ date: T(iso), volume: 3000 }]));
    await F.defiApresSeance({ params: { uid }, data: {} });
  };
  a("2026-10-02T12:00:00Z");
  await ins("lea,t", { le: Date.now(), classement: true, pseudo: "LéaFit" });
  await ins("tom,t", { le: Date.now(), classement: false });
  assert(get("canaux/" + coach + "/defis/m1/public/n") === 2, "deux inscrits au résumé public");
  a("2026-10-03T12:00:00Z"); await seance("lea,t", "2026-10-03T11:00:00Z");
  a("2026-10-04T12:00:00Z"); await seance("lea,t", "2026-10-04T11:00:00Z");
  assert(get("canaux/" + coach + "/defis/m1/participants/lea,t/valeur") === 2, "la séance met à jour la progression");
  const sys = () => Object.values(get("canaux/" + coach + "/messages")).filter((m) => m.type === "systeme");
  assert(sys().length === 1 && /33|25 %/.test(sys()[0].texte), "palier d'équipe annoncé dans le Canal");
  a("2026-10-05T10:00:00Z"); await seance("lea,t", "2026-10-05T09:00:00Z");
  assert(get("canaux/" + coach + "/defis/m1/participants/lea,t/termine") === true, "Léa a bouclé le défi");
  assert(sys().length === 2 && /LéaFit a bouclé/.test(sys()[1].texte), "annonce du finisseur, sous son pseudo");
  a("2026-10-05T11:00:00Z"); await seance("tom,t", "2026-10-05T10:30:00Z");
  assert(sys().length === 2, "pas de second message système le même jour");
  assert(get("coach_public/" + coach + "/canalDernier") > 0, "la pastille du Canal est rallumée");
  // Rappel des 48 h : Tom seulement (Léa a fini).
  a("2026-10-30T07:00:00Z");
  await F.defisQuotidien();
  assert(envoyes.length === 1 && envoyes[0][0] === "https://p/tom" && /48 h/.test(envoyes[0][1].title), "rappel des 48 h à qui n'a pas fini");
  await F.defisQuotidien();
  assert(envoyes.length === 1, "le rappel des 48 h ne part qu'une fois");
  // Clôture.
  a("2026-11-01T08:00:00Z");
  await F.defisQuotidien();
  const pod = sys().find((m) => /Défi terminé/.test(m.texte));
  assert(pod && /🥇 LéaFit/.test(pod.texte) && !/Tom/.test(pod.texte), "podium : l'opt-in nommé, l'autre non");
  const r = get("defis_resultats/lea,t/m1");
  assert(r && r.champion === true && r.fin === FIN, "Léa : défi relevé et CHAMPION");
  assert(!get("defis_resultats/tom,t/m1"), "Tom n'a pas fini : pas de résultat");
  assert(get("canaux/" + coach + "/defis/m1/etat/clos") === true, "défi clos");
  const n = sys().length; await F.defisQuotidien();
  assert(sys().length === n, "un défi clos ne republie rien");
  Date.now = RealNow;
})();
