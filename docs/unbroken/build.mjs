// Dossier de présentation UNBROKEN : génère dossier-unbroken.html puis le PDF A4.
// Usage : node docs/unbroken/build.mjs   (Playwright + Chromium préinstallés)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const logo = "data:image/png;base64," + readFileSync(join(here, "logo-unbroken-blanc.png")).toString("base64");
let cover = "";
try { cover = "data:image/jpeg;base64," + readFileSync(join(here, "couverture.jpg")).toString("base64"); } catch {}

const eur = (n) => Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ") + " €";
const k = (n) => Math.round(n / 1000).toLocaleString("fr-FR") + " k€";

// ---------- Données ----------
// [nom, qté, bas, haut, retenu, priorité, achat]  achat : "occ" = occasion restaurée, "neuf"
const ZONES = [
  { nom: "Machines guidées et poulies", items: [
    ["Smith machine", 2, 2500, 4500, 3500, "N1", "occ"],
    ["Poulie vis-à-vis (grande)", 1, 4000, 7000, 5500, "N1", "occ"],
    ["Poulie vis-à-vis compacte", 1, 3000, 5500, 4000, "N1", "occ"],
    ["Tirage vertical", 2, 2500, 4500, 3500, "N1", "occ"],
    ["Tirage horizontal (poulie basse)", 1, 2500, 4500, 3200, "N1", "occ"],
    ["Rowing buste appuyé (trapèzes moyens)", 1, 2000, 4000, 2800, "N1", "occ"],
    ["Rowing classique (dorsaux)", 1, 2500, 4500, 3200, "N1", "occ"],
    ["Rowing iso-latéral prise haute", 1, 2500, 4500, 3200, "N1", "occ"],
    ["Développé épaules à poulie", 1, 2500, 4500, 3200, "N1", "occ"],
    ["Développé épaules à charger", 1, 2500, 4500, 3000, "Option", "occ"],
    ["Élévations latérales", 1, 2000, 4000, 2800, "N1", "occ"],
  ]},
  { nom: "Pectoraux et bras", items: [
    ["Chest press allongée", 1, 2500, 5000, 3500, "N1", "occ"],
    ["Chest press inclinée (haut des pecs)", 1, 2500, 5000, 3500, "N1", "occ"],
    ["Chest press assise", 1, 2500, 5000, 3500, "N1", "occ"],
    ["Curl Larry Scott unilatéral", 1, 2000, 4000, 2800, "N1", "occ"],
    ["Dips guidé (triceps)", 1, 2000, 4000, 2800, "N1", "occ"],
  ]},
  { nom: "Jambes et fessiers", items: [
    ["Leg extension", 2, 2500, 4500, 3200, "N1", "occ"],
    ["Presse assise", 1, 3500, 6500, 4500, "N1", "occ"],
    ["Presse allongée", 1, 3500, 7000, 5000, "N1", "occ"],
    ["Hack squat", 1, 3000, 6000, 4000, "N1", "occ"],
    ["Belt squat", 1, 3000, 6000, 4000, "N1", "occ"],
    ["Leg curl allongé", 1, 2500, 4500, 3000, "N1", "occ"],
    ["Leg curl assis", 1, 2500, 4500, 3200, "N1", "occ"],
    ["Abducteurs", 1, 2500, 4500, 3000, "N1", "occ"],
    ["Adducteurs", 1, 2500, 4500, 3000, "N1", "occ"],
    ["Hip thrust convergent", 1, 3000, 6000, 4000, "N1", "occ"],
    ["Hip thrust type Smith", 1, 2000, 4000, 2800, "N1", "occ"],
    ["Pendulum squat", 1, 3500, 7000, 4500, "N2", "occ"],
  ]},
  { nom: "Zone force (powerlifting)", items: [
    ["Cage à squat fixée au sol", 2, 1500, 3500, 2500, "N1", "neuf"],
    ["Banc développé couché (combo rack)", 2, 800, 1800, 1200, "N1", "neuf"],
    ["Barre 20 kg Rogue (moletage power)", 10, 400, 600, 500, "N1", "neuf"],
    ["Barre femme 15 kg Rogue", 2, 350, 550, 450, "N1", "neuf"],
    ["Trap bar", 1, 300, 600, 400, "N1", "neuf"],
    ["Disques classiques (≈ 2,5 t)", 1, 6000, 10000, 8000, "N1", "neuf"],
    ["Disques calibrés (≈ 600 kg)", 1, 5000, 8000, 6000, "N2", "neuf"],
    ["Sol renforcé zone force (≈ 40 m²)", 1, 1600, 2800, 2200, "N1", "neuf"],
    ["Bande parquet soulevé de terre", 2, 250, 600, 400, "Maison", "neuf"],
    ["Crochets squat sur parc à traction", 1, 200, 400, 300, "Option", "neuf"],
  ]},
  { nom: "Haltères, barres et kettlebells", items: [
    ["Haltères 2 à 60 kg (30 paires)", 1, 7500, 13000, 9500, "N1", "neuf"],
    ["Racks à haltères", 2, 600, 1200, 800, "N1", "neuf"],
    ["Haltères chargeables (paires)", 2, 250, 600, 400, "Option", "neuf"],
    ["Barre EZ chargeable", 2, 80, 200, 130, "N1", "neuf"],
    ["Barre droite chargeable", 2, 80, 200, 120, "N1", "neuf"],
    ["Kettlebells 4 à 32 kg, ×2 (≈ 200 kg)", 1, 800, 1400, 1000, "N1", "neuf"],
    ["Rack à kettlebells", 1, 200, 500, 300, "N1", "neuf"],
  ]},
  { nom: "Bancs et poids du corps", items: [
    ["Parc traction / dips / poids du corps", 1, 1500, 4000, 2500, "N1", "neuf"],
    ["Station dips murale soudée", 1, 150, 400, 250, "Maison", "neuf"],
    ["Banc réglable", 6, 400, 900, 600, "N1", "neuf"],
    ["Banc développé incliné", 1, 800, 1800, 1200, "N1", "neuf"],
    ["Banc relevé de buste", 1, 300, 800, 450, "N1", "neuf"],
    ["Chaise romaine", 1, 300, 800, 500, "N1", "neuf"],
    ["Box de saut renforcée", 2, 60, 200, 100, "Maison", "neuf"],
  ]},
  { nom: "Cardio", items: [
    ["Tapis de course", 6, 5000, 9000, 6500, "N1", "neuf"],
    ["Vélo", 3, 1500, 3500, 2200, "N1", "neuf"],
    ["Rameur (type Concept2)", 2, 1000, 1400, 1200, "N1", "neuf"],
    ["Escalier (stepmill)", 2, 6000, 10000, 7500, "N1", "neuf"],
  ]},
  { nom: "Abdos, échauffement et mobilité", items: [
    ["Espaliers", 3, 200, 500, 300, "N1", "neuf"],
    ["Tatami (≈ 20 m²)", 1, 500, 1000, 700, "N1", "neuf"],
    ["Bac accessoires (élastiques, roues, rouleaux)", 1, 400, 900, 600, "N1", "neuf"],
  ]},
];
const OCC = 0.6, RESTAU = 0.12; // −40 % en occasion, +12 % de restauration (peinture, sellerie, câbles)
let neufTot = 0, occTot = 0, optTot = 0, n2Tot = 0, nbMachines = 0;
for (const z of ZONES) {
  z.neuf = 0; z.ouv = 0;
  for (const [, q, , , r, p, a] of z.items) {
    const t = q * r; z.neuf += t;
    if (p === "Option") { optTot += t; continue; }
    if (p === "N2") { n2Tot += t; continue; }
    const c = a === "occ" ? t * OCC * (1 + RESTAU) : t;
    z.ouv += c; if (a === "occ") { occTot += c; nbMachines += q; } else neufTot += t;
  }
}
const equip = Math.round((occTot + neufTot) / 1000) * 1000;
const equipNeuf = ZONES.reduce((s, z) => s + z.neuf, 0) - optTot - n2Tot;

const BESOINS = [
  ["Équipement (machines restaurées + neuf)", equip],
  ["Travaux et aménagement (950 m²)", 110000],
  ["Contrôle d'accès, vidéo, logiciel, sono", 12000],
  ["Dépôt de garantie du bail (3 mois)", 25500],
  ["Frais d'établissement (juridique, assurances)", 8000],
  ["Marketing de pré-ouverture", 10000],
  ["Stock initial shop et bar", 8000],
  ["Trésorerie de démarrage (≈ 2,5 mois de charges)", 60000],
];
const besoin = BESOINS.reduce((s, b) => s + b[1], 0);
const apport = 100000, honneur = 30000, pret = besoin - apport - honneur;
const r = 0.045 / 12, mens = Math.round(pret * r / (1 - Math.pow(1 + r, -84)));
const CHARGES = [
  ["Loyer et charges locatives", 9500], ["Remboursement d'emprunt (7 ans, 4,5 %)", mens],
  ["Rémunération des 2 fondateurs", 4200], ["Énergie (LED, suivi)", 2500],
  ["Marketing et événements", 1500], ["Entretien, consommables, ménage", 1200],
  ["Expert-comptable, banque", 600], ["Assurances", 500], ["Logiciel, badges, internet", 400],
];
const fixes = CHARGES.reduce((s, c) => s + c[1], 0);
const contrib = 36; // € HT par membre et par mois : abonnement moyen 41 € TTC + marge shop/bar
const pointMort = Math.ceil(fixes / contrib / 10) * 10;
const RAMP = [350,410,470,520,560,600,640,670,700,730,760,780, 800,820,840,860,880,900,920,940,960,970,990,1000];

// ---------- Graphiques SVG ----------
const C = { red: "#c8102e", ink: "#1a1a1a", mid: "#6b6b6b", line: "#d9d9d9", soft: "#f3f3f3", dark: "#0b0b0b" };

function barsH(rows, { w = 640, unit = eur, max } = {}) {
  const lh = 30, lw = 230, h = rows.length * lh + 6, m = max ?? Math.max(...rows.map(r => r[1]));
  const sc = (v) => (v / m) * (w - lw - 90);
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img">${rows.map(([l, v, hi], i) => {
    const y = i * lh + 4;
    return `<text x="${lw - 10}" y="${y + 15}" text-anchor="end" class="ax">${l}</text>
    <rect x="${lw}" y="${y + 3}" width="${Math.max(sc(v), 2)}" height="16" rx="3" fill="${hi ? C.red : C.ink}"/>
    <text x="${lw + sc(v) + 8}" y="${y + 15}" class="val">${unit(v)}</text>`;
  }).join("")}</svg>`;
}

function stack(parts, w = 640) {
  const tot = parts.reduce((s, p) => s + p[1], 0); let x = 0;
  const cols = [C.red, C.ink, "#9a9a9a"];
  return `<svg viewBox="0 0 ${w} 74" width="100%" role="img">${parts.map(([l, v], i) => {
    const pw = (v / tot) * w, s = `<rect x="${x + (i ? 1 : 0)}" y="0" width="${pw - (i ? 1 : 0)}" height="34" fill="${cols[i]}"/>
    <text x="${x + 6}" y="54" class="ax b">${l}</text><text x="${x + 6}" y="70" class="ax">${eur(v)} · ${Math.round(v / tot * 100)} %</text>`;
    x += pw; return s;
  }).join("")}</svg>`;
}

function rampChart() {
  const w = 640, h = 205, l = 46, b = 30, t = 14, mx = 1100;
  const X = (i) => l + (i / (RAMP.length - 1)) * (w - l - 16), Y = (v) => t + (1 - v / mx) * (h - t - b);
  const pts = RAMP.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const grid = [0, 250, 500, 750, 1000].map(v => `<line x1="${l}" x2="${w - 16}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.line}"/><text x="${l - 6}" y="${Y(v) + 4}" text-anchor="end" class="ax">${v}</text>`).join("");
  const months = [0, 5, 11, 17, 23].map(i => `<text x="${X(i)}" y="${h - 10}" text-anchor="middle" class="ax">M${i + 1}</text>`).join("");
  const cross = RAMP.findIndex(v => v >= pointMort);
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img">${grid}${months}
  <rect x="${X(cross)}" y="${t}" width="${w - 16 - X(cross)}" height="${Y(pointMort) - t}" fill="${C.red}" opacity=".06"/>
  <line x1="${l}" x2="${w - 16}" y1="${Y(pointMort)}" y2="${Y(pointMort)}" stroke="${C.red}" stroke-width="2" stroke-dasharray="6 4"/>
  <text x="${w - 18}" y="${Y(pointMort) + 16}" text-anchor="end" class="ax red b">Point mort ≈ ${pointMort} membres</text>
  <polyline points="${pts}" fill="none" stroke="${C.ink}" stroke-width="2.5" stroke-linejoin="round"/>
  ${[0, 11, 23].map(i => `<circle cx="${X(i)}" cy="${Y(RAMP[i])}" r="4.5" fill="${C.ink}" stroke="#fff" stroke-width="2"/><text x="${X(i) + (i === 23 ? -8 : 8)}" y="${Y(RAMP[i]) - 10}" text-anchor="${i === 23 ? "end" : "start"}" class="val">${RAMP[i]}</text>`).join("")}
  <circle cx="${X(cross)}" cy="${Y(RAMP[cross])}" r="6" fill="${C.red}" stroke="#fff" stroke-width="2"/>
  <text x="${X(cross)}" y="${Y(RAMP[cross]) + 22}" text-anchor="middle" class="ax red b">M${cross + 1}</text></svg>`;
}

function planSalle() {
  // 950 m² répartis en blocs à l'échelle (1 m² ≈ 0,62 px² sur 640 × 960 → on travaille en rangées)
  const rows = [
    [["Zone force", 140, 1], ["Poids libres", 160, 1], ["Salle de posing", 24, 1]],
    [["Machines haut du corps", 135, 0], ["Machines bas du corps", 135, 0], ["Coaching fonctionnel", 60, 0]],
    [["Cardio", 72, 0], ["Vestiaires H", 52, 2], ["Vestiaires F", 52, 2], ["Bureau / atelier", 24, 2]],
    [["Accueil et shop", 56, 3], ["Détente et bar", 40, 3]],
  ];
  const W = 640, tot = 950, H = 380; let y = 0; const fills = ["#1a1a1a", "#3a3a3a", "#8c8c8c", C.red];
  const out = [];
  for (const row of rows) {
    const s = row.reduce((a, c) => a + c[1], 0), rh = (s / tot) * H; let x = 0;
    for (const [n, m2, kd] of row) {
      const cw = (m2 / s) * W;
      out.push(`<rect x="${x + 1}" y="${y + 1}" width="${cw - 2}" height="${rh - 2}" fill="${fills[kd]}"/>
      <text x="${x + 8}" y="${y + 18}" class="plan">${n}</text><text x="${x + 8}" y="${y + 33}" class="plan s">${m2} m²</text>`);
      x += cw;
    }
    y += rh;
  }
  return `<svg viewBox="0 0 ${W} ${H + 24}" width="100%" role="img">${out.join("")}
  <text x="0" y="${H + 18}" class="ax">↓ Entrée côté accueil · posing en fond de salle · surfaces proportionnelles à l'échelle</text></svg>`;
}

function positionMap() {
  const w = 640, h = 300, P = (x, y) => [60 + x * 540, 20 + (1 - y) * 240];
  const dots = [
    ["Basic-Fit", 0.12, 0.2, 0], ["Fitness Park", 0.3, 0.42, 0], ["Salles indépendantes « usine »", 0.35, 0.3, 0],
    ["Box CrossFit", 0.82, 0.6, 0], ["Studios boutique", 0.9, 0.75, 0], ["UNBROKEN", 0.55, 0.88, 1],
  ];
  return `<svg viewBox="0 0 ${w} ${h + 30}" width="100%" role="img">
  <line x1="60" y1="${h - 40}" x2="${w - 20}" y2="${h - 40}" stroke="${C.mid}"/><line x1="60" y1="20" x2="60" y2="${h - 40}" stroke="${C.mid}"/>
  <text x="${w - 20}" y="${h - 18}" text-anchor="end" class="ax">Prix mensuel →</text>
  <text x="18" y="24" class="ax" transform="rotate(-90 18 24)" text-anchor="end">Expérience, matériel, communauté →</text>
  ${dots.map(([n, x, y, u]) => { const [cx, cy] = P(x, y); return `<circle cx="${cx}" cy="${cy}" r="${u ? 10 : 7}" fill="${u ? C.red : C.ink}" stroke="#fff" stroke-width="2"/><text x="${cx + 14}" y="${cy + 4}" class="${u ? "val red" : "ax"}">${n}</text>`; }).join("")}
  <text x="${P(0.55, 0.88)[0] + 14}" y="${P(0.55, 0.88)[1] + 20}" class="ax">Premium accessible : le créneau libre</text></svg>`;
}

function gantt() {
  const months = ["oct.", "nov.", "déc.", "janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct."];
  const tasks = [
    ["Dossier, étude de marché, prévisionnel", 0, 2], ["Recherche du local, visites", 1, 4], ["Rendez-vous banques, prêts d'honneur", 2, 5],
    ["Création de la SAS, signature du bail", 4, 6], ["Sourcing et restauration des machines", 4, 10], ["Travaux et aménagement", 6, 10],
    ["Pré-ventes « membres fondateurs »", 7, 11], ["Livraison, montage, contrôles sécurité", 9, 11], ["Ouverture et inauguration", 11, 12],
  ];
  const l = 230, w = 660, cw = (w - l) / months.length, rh = 26;
  return `<svg viewBox="0 0 ${w} ${tasks.length * rh + 34}" width="100%" role="img">
  ${months.map((m, i) => `<text x="${l + i * cw + cw / 2}" y="12" text-anchor="middle" class="ax">${m}</text>${i ? `<line x1="${l + i * cw}" x2="${l + i * cw}" y1="18" y2="${tasks.length * rh + 24}" stroke="${C.line}"/>` : ""}`).join("")}
  <text x="${l}" y="${tasks.length * rh + 34}" class="ax">2026</text><text x="${l + 3 * cw}" y="${tasks.length * rh + 34}" class="ax">2027</text>
  ${tasks.map(([n, a, b], i) => `<text x="${l - 10}" y="${24 + i * rh + 14}" text-anchor="end" class="ax">${n}</text><rect x="${l + a * cw + 2}" y="${24 + i * rh + 3}" width="${(b - a) * cw - 4}" height="16" rx="3" fill="${i === tasks.length - 1 ? C.red : C.ink}"/>`).join("")}</svg>`;
}

function riskMatrix() {
  const R = [["Montée en charge lente", 0.6, 0.85], ["Dépassement budget travaux", 0.55, 0.6], ["Concurrence low-cost", 0.8, 0.4],
    ["Panne machine d'occasion", 0.5, 0.3], ["Départ du coach", 0.3, 0.35], ["Incident hors présence", 0.2, 0.7], ["Hausse énergie", 0.6, 0.2]];
  const w = 640, h = 300, x0 = 70, y0 = 10, s = 260, sw = 540;
  return `<svg viewBox="0 0 ${w} ${h + 30}" width="100%" role="img">
  <rect x="${x0}" y="${y0}" width="${sw / 2}" height="${s / 2}" fill="${C.soft}"/><rect x="${x0 + sw / 2}" y="${y0}" width="${sw / 2}" height="${s / 2}" fill="${C.red}" opacity=".12"/>
  <rect x="${x0}" y="${y0 + s / 2}" width="${sw / 2}" height="${s / 2}" fill="#fafafa"/><rect x="${x0 + sw / 2}" y="${y0 + s / 2}" width="${sw / 2}" height="${s / 2}" fill="${C.soft}"/>
  <text x="${x0 + sw - 8}" y="${y0 + 18}" text-anchor="end" class="ax red b">À surveiller de près</text>
  <text x="${x0 + sw}" y="${y0 + s + 22}" text-anchor="end" class="ax">Probabilité →</text>
  <text x="${x0 - 12}" y="${y0}" class="ax" transform="rotate(-90 ${x0 - 12} ${y0})" text-anchor="end">Impact →</text>
  ${R.map(([n, p, i]) => { const cx = x0 + p * sw, cy = y0 + (1 - i) * s; const hot = p > 0.5 && i > 0.5;
    return `<circle cx="${cx}" cy="${cy}" r="7" fill="${hot ? C.red : C.ink}" stroke="#fff" stroke-width="2"/><text x="${cx + (p > 0.7 ? -12 : 12)}" y="${cy + 4}" text-anchor="${p > 0.7 ? "end" : "start"}" class="ax">${n}</text>`; }).join("")}</svg>`;
}

function hours() {
  const w = 640, l = 30, sc = (h) => l + ((h - 6) / 16) * (w - l - 20);
  return `<svg viewBox="0 0 ${w} 86" width="100%" role="img">
  <rect x="${sc(6)}" y="10" width="${sc(22) - sc(6)}" height="22" fill="${C.ink}"/>
  <rect x="${sc(9)}" y="10" width="${sc(13) - sc(9)}" height="22" fill="${C.red}"/><rect x="${sc(16)}" y="10" width="${sc(21) - sc(16)}" height="22" fill="${C.red}"/>
  ${[6, 9, 13, 16, 21, 22].map(h => `<text x="${sc(h)}" y="48" text-anchor="middle" class="ax">${h} h</text>`).join("")}
  <rect x="${l}" y="62" width="12" height="12" fill="${C.ink}"/><text x="${l + 18}" y="72" class="ax">Accès libre par badge, 7 j/7</text>
  <rect x="${l + 230}" y="62" width="12" height="12" fill="${C.red}"/><text x="${l + 248}" y="72" class="ax">Plateau animé : fondateurs + coach présents</text></svg>`;
}

function planning3() {
  const ph = [["Avant l'ouverture", "J−6 mois → J", ["Coulisses des travaux et de la restauration", "Pré-ventes « membres fondateurs »", "Prospection des entreprises", "Liste d'attente en ligne"]],
    ["Lancement", "J → J+3 mois", ["Inauguration avec élus et partenaires", "Semaine portes ouvertes", "Première compétition interne", "Parrainage : 1 mois offert"]],
    ["Fidélisation", "Toute l'année", ["Un événement par mois", "Défis et classements sur RepCore", "Collecte d'avis Google", "Nouvelles collections textile"]]];
  return `<div class="phases">${ph.map(([t, d, l], i) => `<div class="phase"><div class="ph-n">${i + 1}</div><h4>${t}</h4><div class="eyebrow">${d}</div><ul>${l.map(x => `<li>${x}</li>`).join("")}</ul></div>`).join("")}</div>`;
}

// ---------- Pages ----------
let pageNo = 1;
const page = (cls, body, { num = true } = {}) => {
  pageNo++;
  return `<section class="page ${cls}">${body}${num ? `<footer><span>UNBROKEN · Dossier de présentation</span><span>${pageNo}</span></footer>` : ""}</section>`;
};
const head = (n, t, lead) => `<div class="sec-head"><div class="sec-n">${n}</div><h2>${t}</h2>${lead ? `<p class="lead">${lead}</p>` : ""}</div>`;
const kpis = (arr) => `<div class="kpis">${arr.map(([v, l]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join("")}</div>`;
const box = (t, b, cls = "") => `<div class="box ${cls}"><div class="eyebrow red">${t}</div>${b}</div>`;

const equipTable = (zs) => zs.map(z => `<table class="eq"><thead><tr><th>${z.nom}</th><th class="n">Qté</th><th class="n">Prix unitaire neuf</th><th class="n">Total neuf</th><th>Achat</th></tr></thead><tbody>
${z.items.map(([n, q, b, h, r, p, a]) => `<tr><td>${n}${p !== "N1" ? ` <span class="tag t-${p}">${p}</span>` : ""}</td><td class="n">${q}</td><td class="n">${eur(b)} – ${eur(h)}</td><td class="n">${eur(q * r)}</td><td class="muted">${p === "Maison" ? "Fait maison" : a === "occ" ? "Occasion" : "Neuf"}</td></tr>`).join("")}
</tbody></table>`).join("");

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Dossier UNBROKEN</title>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:0}
:root{--red:${C.red};--ink:${C.ink};--mid:${C.mid};--line:${C.line};--soft:${C.soft};--dark:${C.dark};
--display:"Oswald","Arial Narrow",sans-serif;--body:"Inter","Liberation Sans",Arial,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--body);color:var(--ink);font-size:10.2pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;padding:20mm 18mm 22mm;page-break-after:always;background:#fff}
.page::before{content:"";position:absolute;top:0;left:0;right:0;height:4mm;background:var(--red)}
.dark{background:var(--dark);color:#fff}
h1,h2,h3,h4{font-family:var(--display);text-transform:uppercase;letter-spacing:.01em;line-height:1.05}
h2{font-size:30pt;margin:2mm 0 0}
h3{font-size:14pt;margin:5.5mm 0 2.5mm}
h4{font-size:11.5pt;margin-bottom:1mm}
p{margin:0 0 3mm}
.eyebrow{font-size:7.5pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--mid)}
.red{color:var(--red);fill:var(--red)}
.muted{color:var(--mid)}
.sec-head{margin-bottom:7mm}
.sec-n{font-family:var(--display);font-size:12pt;color:var(--red);font-weight:600;letter-spacing:.08em}
.lead{font-size:11pt;color:#333;margin-top:4mm;max-width:155mm}
footer{position:absolute;bottom:10mm;left:18mm;right:18mm;display:flex;justify-content:space-between;font-size:7.5pt;color:var(--mid);border-top:1px solid var(--line);padding-top:2.5mm}
.dark footer{border-color:#333}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:5mm 0}
.kpi{background:var(--soft);padding:4mm;border-top:3px solid var(--red)}
.dark .kpi{background:#1a1a1a}
.kpi b{display:block;font-family:var(--display);font-size:19pt;line-height:1.1}
.kpi span{font-size:8pt;color:var(--mid)}
.box{background:var(--soft);padding:5mm 6mm;margin:4mm 0}
.box.black{background:var(--dark);color:#fff}
.box.line{background:none;border-left:3px solid var(--red);padding:1mm 0 1mm 5mm}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:5mm}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
.card{border:1px solid var(--line);padding:4.5mm 5mm}
.card .eyebrow{margin-bottom:1.5mm}
ul{padding-left:4.5mm;margin:1mm 0 2mm}
li{margin-bottom:1mm}
li::marker{color:var(--red)}
.big-quote{font-family:var(--display);font-size:22pt;text-transform:uppercase;line-height:1.15}
table{width:100%;border-collapse:collapse;font-size:8.6pt;margin-bottom:4mm}
th{background:var(--dark);color:#fff;text-align:left;padding:2mm 2.5mm;font-weight:600;font-size:7.8pt;letter-spacing:.04em;text-transform:uppercase}
td{padding:1.6mm 2.5mm;border-bottom:1px solid var(--line);vertical-align:top}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tr.tot td{font-weight:700;border-top:2px solid var(--ink);border-bottom:0}
table.eq{font-size:8pt;margin-bottom:3mm;table-layout:fixed}
table.eq th:nth-child(1){width:42%}table.eq th:nth-child(2){width:6%}table.eq th:nth-child(3){width:24%}table.eq th:nth-child(4){width:15%}table.eq th:nth-child(5){width:13%}
table.eq td{padding:1.1mm 2.5mm}
.tag{font-size:6.5pt;font-weight:700;padding:0 1.5mm;border-radius:2mm;color:#fff;vertical-align:1px}
.t-Option{background:#9a9a9a}.t-N2{background:var(--ink)}.t-Maison{background:var(--red)}
svg text{font-family:var(--body)}
svg .ax{font-size:10.5px;fill:#555}
svg .val{font-size:11px;font-weight:700;fill:var(--ink)}
svg .val.red,svg .red{fill:var(--red)}
svg .b{font-weight:700}
svg .plan{font-size:11px;font-weight:700;fill:#fff}
svg .plan.s{font-weight:400;opacity:.85}
.fig{margin:3mm 0 5mm}
.fig .eyebrow{margin-bottom:2mm}
.phases{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin:4mm 0}
.phase{border-top:3px solid var(--ink);padding-top:3mm}
.phase:nth-child(2){border-color:var(--red)}
.ph-n{font-family:var(--display);font-size:26pt;color:var(--red);line-height:1}
.price{border:1px solid var(--line);padding:5mm;display:flex;flex-direction:column;gap:1mm}
.price.hl{border:2px solid var(--red)}
.price b{font-family:var(--display);font-size:24pt;line-height:1}
.price small{color:var(--mid)}
.steps{display:grid;grid-template-columns:repeat(6,1fr);gap:2mm;margin:3mm 0}
.step{background:var(--dark);color:#fff;padding:3mm;font-size:8.2pt;min-height:24mm}
.step b{display:block;font-family:var(--display);color:var(--red);font-size:15pt}
.toc{columns:2;column-gap:10mm;margin-top:6mm}
.toc div{display:flex;gap:4mm;padding:2.2mm 0;border-bottom:1px solid #2a2a2a;break-inside:avoid;font-family:var(--display);text-transform:uppercase;font-size:11pt}
.toc span{color:var(--red);width:8mm}
.hyp{font-size:7.8pt;color:var(--mid);font-style:italic}
/* Couverture */
.cover{padding:0;background:var(--dark);color:#fff}
.cover .art{position:absolute;inset:0;background:${cover ? `url(${cover}) center top/cover` : `radial-gradient(circle at 75% 35%,#3a0a12 0,#160507 35%,#0b0b0b 70%)`}}
.cover .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,11,11,0) 0%,rgba(11,11,11,0) 50%,rgba(11,11,11,.75) 66%,#0b0b0b 84%)}
.cover .in{position:absolute;left:18mm;right:18mm;bottom:16mm}
.cover img{width:125mm;display:block;margin-bottom:7mm}
.cover h1{font-size:28pt;max-width:165mm}
.cover .motto{font-family:var(--display);color:var(--red);font-size:13pt;letter-spacing:.18em;margin:4mm 0 8mm}
.cover .by{display:flex;justify-content:space-between;font-size:9pt;color:#bbb;border-top:1px solid #333;padding-top:4mm}
${cover ? "" : `.cover .ring{position:absolute;right:-40mm;top:30mm;width:170mm;height:170mm;border-radius:50%;border:14mm solid #1d0a0d;box-shadow:inset 0 0 0 22mm #120708}`}
.end{display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
</style></head><body>

<section class="page cover"><div class="art"></div>${cover ? "" : `<div class="ring"></div>`}<div class="shade"></div>
<div class="in"><div class="eyebrow red">Dossier de présentation · Projet de création · 2026</div><br>
<img src="${logo}" alt="UNBROKEN">
<h1>Une salle de musculation premium, indépendante et familiale</h1>
<div class="motto">DISCIPLINE · TRAVAIL · RÉSULTAT</div>
<div class="by"><span>Kevin Guellec &amp; Claire Boumard · associés 50/50</span><span>Version de travail · octobre 2026</span></div></div></section>

${page("dark", `<div class="sec-n">Sommaire</div><h2>Le projet en 18 chapitres</h2>
<div class="toc">${["Synthèse du projet","Les porteurs du projet","Genèse, vision et valeurs","Le concept UNBROKEN","Le marché et la concurrence","La clientèle cible","L'implantation","L'aménagement","L'équipement","L'offre et les tarifs","Organisation et équipe","Marketing et communication","Ancrage local et impact","Plan de financement","Rentabilité et point mort","Calendrier de réalisation","Risques et parades","Nos attentes et conclusion"].map((t, i) => `<div><span>${String(i + 1).padStart(2, "0")}</span>${t}</div>`).join("")}</div>
<h3 style="margin-top:12mm">Les chiffres clés</h3>
${kpis([["950 m²", "surface visée (900 à 1 000 m²)"], ["7j/7", "de 6 h à 22 h, accès badge"], [k(besoin), "besoin de financement total"], [k(apport), "d'apport personnel des fondateurs"]])}
${kpis([[`${nbMachines}`, "machines guidées restaurées"], [`${pointMort}`, "membres pour atteindre le point mort"], ["1 000", "membres visés à 24 mois"], ["Sept. 2027", "ouverture visée"]])}`)}

${page("", `${head("01", "Synthèse du projet", "UNBROKEN est une salle de musculation indépendante et premium de 900 à 1 000 m², portée à parts égales par Kevin Guellec et Claire Boumard. Une salle « avec une âme », où la qualité du matériel, l'ambiance et la communauté passent avant le volume.")}
<div class="grid2">
${box("Le constat", `<p>Près de 7 millions d'adhérents en France, mais une offre dominée par des enseignes low-cost standardisées.</p><p style="margin:0">Les passionnés, surtout les 18–30 ans, cherchent du matériel d'exception, une identité, une communauté.</p>`)}
${box("Notre réponse", `<ul><li>Des machines haut de gamme et rares, restaurées par nos soins</li><li>Une culture bodybuilding : salle de posing, compétitions internes</li><li>Une marque : shop textile, identité forte, réseaux sociaux</li><li>Une salle familiale, accessible à tous les niveaux</li></ul>`)}
</div>
<h3>Nos trois objectifs</h3>
<div class="grid3">
<div class="card"><div class="eyebrow red">Objectif 1 · ouverture</div><h4>400 membres le premier mois</h4><p class="muted">Dont 200 « membres fondateurs » en pré-vente avant l'ouverture.</p></div>
<div class="card"><div class="eyebrow red">Objectif 2 · équilibre</div><h4>Point mort dès le 9e mois</h4><p class="muted">≈ ${pointMort} membres couvrent toutes les charges, emprunt compris.</p></div>
<div class="card"><div class="eyebrow red">Objectif 3 · référence</div><h4>1 000 membres à 24 mois</h4><p class="muted">Devenir LA salle de musculation de référence du territoire.</p></div>
</div>
<h3>Nos points forts</h3>
<div class="grid2">
<div class="box line"><h4>Des porteurs expérimentés</h4><p>Gestion de club, coaching, marketing, commerce : les deux fondateurs ont déjà fait leurs preuves sur le terrain.</p></div>
<div class="box line"><h4>Des coûts maîtrisés</h4><p>Pas de salarié au démarrage, travaux et restauration des machines réalisés par les fondateurs.</p></div>
<div class="box line"><h4>Un concept différenciant</h4><p>Le seul positionnement « premium accessible » du territoire, entre low-cost et studios boutique.</p></div>
<div class="box line"><h4>Un ancrage local</h4><p>Deux entrepreneurs qui s'installent, emploient localement et animent la vie du territoire.</p></div>
</div>`)}

${page("", `${head("02", "Les porteurs du projet", "Un binôme complémentaire, associé à 50/50 et à temps plein sur le projet.")}
<div class="grid2">
<div class="card"><div class="eyebrow red">Co-fondateur · direction, marketing, coaching</div><h3 style="margin-top:1mm">Kevin Guellec</h3>
<ul><li>Licence STAPS, coach depuis 2020</li><li>Master Management &amp; Marketing du sport (Brest)</li><li>2 ans manager d'un établissement de loisirs : équipes, stocks, réseaux, tarifs, travaux</li><li>Plus d'un an en box CrossFit, une saison en association de powerlifting</li><li>Manager à Fitness Park Niort : événements, compétitions, <b>plus de 1 000 avis Google</b>, parmi les meilleurs clubs du réseau</li><li>Co-créateur de l'application de coaching RepCore</li></ul></div>
<div class="card"><div class="eyebrow red">Co-fondatrice · gestion, vente, relation client</div><h3 style="margin-top:1mm">Claire Boumard</h3>
<ul><li>Dirige depuis 6 ans sa boutique Yves Thuriès à Niort</li><li>Gestion, achats, stocks, vente, fidélisation</li><li>Exigence de service et sens du contact</li><li>Issue d'une famille d'entrepreneurs : culture du travail et de la persévérance</li><li>Passionnée de musculation, elle cède son commerce pour se consacrer à UNBROKEN</li></ul></div>
</div>
<h3>Qui fait quoi</h3>
<table><thead><tr><th>Domaine</th><th>Kevin</th><th>Claire</th></tr></thead><tbody>
<tr><td>Direction et stratégie</td><td>● Co-pilote</td><td>● Co-pilote</td></tr>
<tr><td>Marketing, réseaux sociaux, événements</td><td><b class="red">● Responsable</b></td><td>○ Appui</td></tr>
<tr><td>Coaching, formation des coachs, plateau</td><td><b class="red">● Responsable</b></td><td>○ Appui</td></tr>
<tr><td>Travaux, restauration et entretien des machines</td><td><b class="red">● Responsable</b></td><td>○ Appui</td></tr>
<tr><td>Vente, accueil, relation client</td><td>○ Appui</td><td><b class="red">● Responsable</b></td></tr>
<tr><td>Gestion, finances, achats, shop</td><td>○ Appui</td><td><b class="red">● Responsable</b></td></tr>
</tbody></table>
<div class="box black"><div class="big-quote">Deux profils, un même terrain :<br><span class="red">le service et la salle.</span></div></div>`)}

${page("", `${head("03", "Genèse, vision et valeurs", "UNBROKEN naît d'un constat vécu de l'intérieur : les salles commerciales sont efficaces mais standardisées, avec des décisions prises loin du terrain et un matériel choisi d'abord pour son coût.")}
<div class="box black"><div class="eyebrow red">Notre mission</div><p style="font-size:13pt;margin-top:2mm">Offrir à tous, du débutant au compétiteur, un environnement d'entraînement d'exception, un accompagnement humain et une communauté qui donne envie de revenir.</p></div>
<div class="grid2" style="margin-top:6mm"><div><h3 style="margin-top:0">Pourquoi « Unbroken »</h3><p>Unbroken signifie « incassable » : la force, la persévérance, la capacité à se relever. C'est ce que vit chaque pratiquant qui revient s'entraîner, séance après séance.</p><p>La devise, affichée en grand et en rouge dans la salle : <b class="red">DISCIPLINE · TRAVAIL · RÉSULTAT</b>.</p></div>
<div><h3 style="margin-top:0">Notre vision à 5 ans</h3><ul><li>Une salle pleine, reconnue bien au-delà de la ville</li><li>Une marque UNBROKEN qui existe aussi hors des murs (textile, événements, application)</li><li>Une deuxième salle si le modèle est validé</li></ul></div></div>
<h3>Nos six valeurs</h3>
<div class="grid3">${[["Discipline", "On vient même quand c'est dur. La régularité avant tout."], ["Travail", "Rien n'est donné : chaque progrès se gagne."], ["Résultat", "On mesure, on suit, on célèbre les progrès."], ["Convivialité", "On se connaît, on se salue, on s'encourage."], ["Exigence", "Matériel impeccable, salle propre, service soigné."], ["Ouverture", "Débutant, senior ou compétiteur : tout le monde a sa place."]].map(([t, d]) => `<div class="card"><h4>${t}</h4><p class="muted" style="margin:0">${d}</p></div>`).join("")}</div>`)}

${page("", `${head("04", "Le concept UNBROKEN", "Une salle de musculation premium, à forte culture bodybuilding, pensée comme une marque et accessible à tous.")}
<h3 style="margin-top:0">Cinq piliers</h3>
<table><tbody>${[["Un matériel d'exception", "Des machines haut de gamme et rares en France, restaurées aux couleurs de la salle."], ["Une culture bodybuilding assumée", "Salle de posing éclairée pour la photo et la vidéo, compétitions internes."], ["Une marque", "Shop textile et goodies, identité visuelle forte, contenu sur les réseaux."], ["Une communauté familiale", "Tous âges, tous niveaux, entraide sur le plateau."], ["Un accompagnement humain", "Fondateurs et coach partenaire présents chaque jour sur le plateau."]].map(([t, d], i) => `<tr><td style="width:12mm;font-family:var(--display);font-size:18pt;color:var(--red)">${i + 1}</td><td style="width:62mm"><h4 style="margin:1.5mm 0 0">${t}</h4></td><td>${d}</td></tr>`).join("")}</tbody></table>
<h3>Le parcours d'un nouveau membre</h3>
<div class="steps">${[["Découverte", "Vidéo Instagram, bouche-à-oreille, entreprise"], ["Visite", "Accueil par un fondateur, tour de la salle"], ["Inscription", "Badge et kit de bienvenue"], ["Démarrage", "Bilan offert et programme sur RepCore"], ["Intégration", "Premier événement, groupe membres"], ["Ambassadeur", "Parrainage, avis Google, compétition"]].map(([t, d], i) => `<div class="step"><b>${i + 1}</b><div style="font-weight:700;margin-bottom:1mm">${t}</div>${d}</div>`).join("")}</div>
<div class="box line"><p><b>Source d'inspiration :</b> le Corona Gym à Bordeaux, référence française de la salle indépendante à forte identité bodybuilding.</p></div>`)}

${page("", `${head("05", "Le marché et la concurrence", "Le marché se polarise entre réseaux low-cost standardisés et salles indépendantes à forte identité. UNBROKEN se place sur ce second segment, peu représenté localement.")}
${kpis([["≈ 7 M", "d'adhérents en France (record 2025)"], ["6 000+", "établissements"], ["≈ 2,5 Md€", "de chiffre d'affaires"], ["9 %", "de pénétration, contre 16 % au Royaume-Uni"]])}
<div class="fig"><div class="eyebrow">Carte de positionnement (lecture qualitative)</div>${positionMap()}</div>
<h3>Concurrence locale</h3>
<table><thead><tr><th>Acteur</th><th>Modèle</th><th>Forces</th><th>Ce qu'UNBROKEN fait mieux</th></tr></thead><tbody>
<tr><td>Basic-Fit (2 clubs)</td><td>Low-cost</td><td>Prix, amplitude horaire</td><td>Matériel, ambiance, accompagnement</td></tr>
<tr><td>Fitness Park (1 club)</td><td>Low-cost premium</td><td>Notoriété, surface</td><td>Identité, machines rares, communauté</td></tr>
<tr><td>Salles indépendantes</td><td>Variable</td><td>Proximité</td><td><span class="muted">Étude terrain à compléter</span></td></tr>
</tbody></table>
<p class="hyp">Chiffres marché : sources sectorielles 2025 reprises du dossier initial. Étude des salles indépendantes locales à réaliser avant la version finale.</p>`)}

${page("", `${head("06", "La clientèle cible", "Cœur de cible : les jeunes adultes passionnés de musculation, très présents sur les réseaux et les plus prescripteurs. Mais un concept familial et inclusif : tous âges, genres et niveaux.")}
<div class="grid2">${[["Le passionné connecté", "18–30 ans · 4 à 6 séances / semaine", "Veut du matériel rare, filme ses séances, suit les athlètes. Notre premier ambassadeur.", "45 %"], ["Le compétiteur", "Bodybuilding, force", "Cherche une salle sérieuse, des barres et des cages de qualité, une salle de posing.", "10 %"], ["L'actif qui se vide la tête", "25–50 ans · 1 à 2 fois / semaine", "Veut une salle propre, accueillante, accessible tôt et tard.", "30 %"], ["Santé et famille", "Parents, femmes, seniors, débutants", "A besoin d'être accompagné et de se sentir à sa place.", "15 %"]].map(([t, s, d, p]) => `<div class="card"><div class="eyebrow red">${s}</div><h4>${t}</h4><p class="muted">${d}</p><div style="font-family:var(--display);font-size:20pt">${p}<span class="muted" style="font-size:9pt;font-family:var(--body)"> des membres visés</span></div></div>`).join("")}</div>
<div class="fig"><div class="eyebrow">Répartition visée des membres</div>${stack([["Passionnés + compétiteurs", 55], ["Actifs", 30], ["Santé et famille", 15]]).replace(/ €/g, " %").replace(/(\d+) % · \d+ %/g, "$1 %")}</div>
${box("Clientèle entreprises", `<p>Abonnements collaborateurs à tarif négocié, challenges inter-entreprises, séances de cohésion. Objectif : <b>10 entreprises partenaires</b> la première année.</p>`)}`)}

${page("", `${head("07", "L'implantation", "Le choix du local conditionne tout le reste : visibilité, stationnement, loyer et travaux. Voici nos critères et la zone étudiée.")}
<div class="grid2"><div>
<h3 style="margin-top:0">Critères du local</h3>
<table><tbody>${[["Surface", "900 à 1 000 m², plain-pied de préférence"], ["Hauteur sous plafond", "4 m minimum (cages, poulies)"], ["Sol", "Dalle béton capable de supporter les charges lourdes"], ["Stationnement", "60 places ou plus, accès facile"], ["Visibilité", "Zone commerciale passante, signalétique possible"], ["Loyer", "≤ 10 € HT / m² / mois"], ["Conformité", "ERP, accessibilité PMR, possibilité de vestiaires et douches"]].map(([a, b]) => `<tr><td><b>${a}</b></td><td>${b}</td></tr>`).join("")}</tbody></table></div>
<div><h3 style="margin-top:0">Zone de chalandise</h3>
<svg viewBox="0 0 300 300" width="100%" role="img"><circle cx="150" cy="150" r="140" fill="${C.soft}"/><circle cx="150" cy="150" r="95" fill="#e6e6e6"/><circle cx="150" cy="150" r="50" fill="${C.red}" opacity=".18"/><circle cx="150" cy="150" r="9" fill="${C.red}"/>
<text x="150" y="132" text-anchor="middle" class="val">UNBROKEN</text><text x="150" y="85" text-anchor="middle" class="ax">10 min : zone principale</text><text x="150" y="40" text-anchor="middle" class="ax">20 min : zone secondaire</text><text x="150" y="20" text-anchor="middle" class="ax">30 min : passionnés et compétiteurs</text></svg></div></div>
${box("Zone étudiée : Quimper et son agglomération", `<p>La concurrence identifiée (deux Basic-Fit, un Fitness Park) confirme la demande, sans offre premium indépendante. La recherche de local et l'étude de terrain restent à mener.</p>`)}
<p class="hyp">Section à compléter : adresse retenue, plan du local, loyer négocié, données démographiques de la zone (INSEE).</p>`)}

${page("", `${head("08", "L'aménagement", "Zonage de principe pour environ 950 m², à adapter au local retenu. Les grands plateaux d'entraînement occupent près des deux tiers de la surface.")}
<div class="fig">${planSalle()}</div>
<div class="grid2">${box("Le parcours", `<ul><li>Accueil et shop à l'entrée, bar et espace détente visibles depuis la rue</li><li>Vestiaires accessibles sans traverser les plateaux</li><li>Zone force et poids libres au cœur de la salle</li><li>Salle de posing en fond de salle, éclairée pour la photo et la vidéo</li></ul>`)}
${box("Les choix d'aménagement", `<ul><li>Sol caoutchouc renforcé en zone force, parquet pour le soulevé de terre</li><li>Éclairage LED, ambiance sombre et accents rouges</li><li>Murs aux couleurs UNBROKEN : devise et visuels de la communauté</li><li>Coin abdos et mobilité : tatami, espaliers, accessoires</li></ul>`)}</div>`)}

${page("", `${head("09", "L'équipement", "Un mix assumé : du neuf pour tout ce qui s'use ou se charge (racks, barres, haltères, bancs, cardio, sols) et des machines d'occasion haut de gamme, restaurées par nos soins aux couleurs d'UNBROKEN.")}
${kpis([[k(equip), "budget équipement à l'ouverture"], [k(equipNeuf), "si tout était acheté neuf"], [`−${k(equipNeuf - equip)}`, "économisés grâce à la restauration"], [`${nbMachines}`, "machines guidées restaurées"]])}
<div class="fig"><div class="eyebrow">Budget d'ouverture par zone (machines restaurées, reste neuf)</div>${barsH(ZONES.map(z => [z.nom, z.ouv, z.nom === "Cardio"]).sort((a, b) => b[1] - a[1]))}</div>
<h3>La restauration, notre savoir-faire</h3>
<div class="steps">${[["Sourcing", "Salons pros, revendeurs, salles qui ferment"], ["Diagnostic", "Structure, soudures, câbles, poulies"], ["Mécanique", "Roulements, câbles et axes remplacés"], ["Peinture", "Décapage, peinture aux couleurs UNBROKEN"], ["Sellerie", "Mousses et skaï refaits à neuf"], ["Contrôle", "Essais en charge, fiche sécurité"]].map(([t, d], i) => `<div class="step"><b>${i + 1}</b><div style="font-weight:700;margin-bottom:1mm">${t}</div>${d}</div>`).join("")}</div>
<div class="box line"><p><b>Le cardio est le premier poste.</b> Six tapis et deux escaliers pèsent ${k(ZONES.find(z => z.nom === "Cardio").ouv)}. Le location-vente ou le reconditionné peuvent alléger l'investissement de départ d'environ 20 k€. La restauration devient aussi un contenu fort pour les réseaux.</p></div>`)}

${page("", `<div class="sec-n">09 · Annexe 1/3</div><h2 style="font-size:20pt;margin-bottom:5mm">Liste complète de l'équipement</h2>${equipTable(ZONES.slice(0, 2))}`)}
${page("", `<div class="sec-n">09 · Annexe 2/3</div><h2 style="font-size:20pt;margin-bottom:5mm">Liste complète de l'équipement</h2>${equipTable(ZONES.slice(2, 4))}`)}
${page("", `<div class="sec-n">09 · Annexe 3/3</div><h2 style="font-size:20pt;margin-bottom:5mm">Liste complète de l'équipement</h2>${equipTable(ZONES.slice(4))}
<table><tbody><tr class="tot"><td>Total ouverture (machines restaurées, reste neuf)</td><td class="n">${eur(equip)}</td></tr>
<tr><td>Même liste entièrement en neuf</td><td class="n">${eur(equipNeuf)}</td></tr>
<tr><td>Options (2e développé épaules, haltères chargeables, crochets)</td><td class="n">${eur(optTot)}</td></tr>
<tr><td>Deuxième vague N2 (pendulum, disques calibrés)</td><td class="n">${eur(n2Tot)}</td></tr></tbody></table>
<p class="hyp">Prix HT estimés pour du matériel professionnel, hors livraison et montage. Occasion restaurée : −40 % sur le prix neuf, +12 % de restauration. Devis à obtenir sur les salons professionnels du fitness à Paris.</p>`)}

${page("", `${head("10", "L'offre et les tarifs", "Un positionnement premium mais accessible : plus cher qu'un low-cost, nettement moins qu'un studio boutique, et justifié chaque jour par le matériel et l'accueil.")}
<div class="grid3">
<div class="price"><div class="eyebrow">Sans engagement</div><b>54,90 €</b><small>par mois</small><p class="muted" style="margin-top:2mm">Liberté totale, résiliable à tout moment.</p></div>
<div class="price hl"><div class="eyebrow red">Le plus choisi · 12 mois</div><b>44,90 €</b><small>par mois</small><p class="muted" style="margin-top:2mm">Accès 7j/7 de 6 h à 22 h, bilan offert, application RepCore.</p></div>
<div class="price"><div class="eyebrow">Étudiants et −25 ans</div><b>37,90 €</b><small>par mois, 12 mois</small><p class="muted" style="margin-top:2mm">Sur justificatif.</p></div></div>
<div class="grid3" style="margin-top:4mm">
<div class="price"><div class="eyebrow red">Membre fondateur</div><b>34,90 €</b><small>à vie, 200 places en pré-vente</small></div>
<div class="price"><div class="eyebrow">Séance / carnet</div><b>12 €</b><small>la séance · 99 € les 10</small></div>
<div class="price"><div class="eyebrow">Entreprises</div><b>dès 35 €</b><small>par collaborateur, selon volume</small></div></div>
<h3>Les revenus complémentaires</h3>
<table><thead><tr><th>Source</th><th>Contenu</th><th class="n">Hypothèse</th></tr></thead><tbody>
<tr><td>Frais d'inscription</td><td>Badge et kit de bienvenue</td><td class="n">49 € TTC</td></tr>
<tr><td>Shop UNBROKEN</td><td>Textile, shakers, accessoires</td><td class="n">≈ 1,5 € de marge / membre / mois</td></tr>
<tr><td>Bar</td><td>Boissons, compléments, snacks protéinés</td><td class="n">≈ 1 € de marge / membre / mois</td></tr>
<tr><td>Événements</td><td>Compétitions, masterclass</td><td class="n">Autofinancés</td></tr>
</tbody></table>
<p class="hyp">Grille de travail à valider après l'étude des prix locaux. Panier moyen retenu dans le prévisionnel : 41 € TTC par membre et par mois.</p>`)}

${page("", `${head("11", "Organisation et équipe", "Ouverture 7j/7 de 6 h à 22 h par badge, avec vidéosurveillance. Pas de salarié au démarrage : les deux fondateurs assurent la direction, l'accueil, la vente, l'animation et l'entretien.")}
<div class="fig"><div class="eyebrow">Une journée type</div>${hours()}</div>
<div class="grid2">${box("Le coach partenaire", `<ul><li>Coach indépendant dès la première année, sans loyer</li><li>Présent au quotidien, impliqué dans la communication et les événements</li><li>Formé par Kevin à la méthode UNBROKEN</li><li>Convention écrite : indépendance garantie, conditions prévues après la première année</li><li>Deux coachs maximum ensuite</li></ul>`)}
${box("La montée en puissance", `<table><tbody><tr><td><b>Année 1</b></td><td>2 fondateurs + 1 coach partenaire</td></tr><tr><td><b>Année 2</b></td><td>+ 1 alternant (accueil, réseaux)</td></tr><tr><td><b>Année 3</b></td><td>+ 1 salarié accueil et ménage, 2e coach</td></tr></tbody></table>`)}</div>
<h3>Sécurité et accès</h3>
<div class="grid3"><div class="card"><h4>Badge</h4><p class="muted" style="margin:0">Accès nominatif, historique des passages, blocage à distance.</p></div><div class="card"><h4>Vidéo</h4><p class="muted" style="margin:0">Caméras sur les plateaux et l'entrée, conformes au RGPD.</p></div><div class="card"><h4>Alerte</h4><p class="muted" style="margin:0">Bouton d'urgence, défibrillateur, règlement intérieur affiché.</p></div></div>`)}

${page("", `${head("12", "Marketing et communication", "Une salle dont on parle, que l'on filme et que l'on recommande se remplit plus vite. Instagram et TikTok sont prioritaires.")}
${planning3()}
<h3>Nos objectifs chiffrés</h3>
<table><thead><tr><th>Indicateur</th><th class="n">À l'ouverture</th><th class="n">À 12 mois</th><th class="n">À 24 mois</th></tr></thead><tbody>
<tr><td>Membres actifs</td><td class="n">350–400</td><td class="n">780</td><td class="n">1 000</td></tr>
<tr><td>Membres fondateurs (pré-vente)</td><td class="n">200</td><td class="n">–</td><td class="n">–</td></tr>
<tr><td>Abonnés Instagram</td><td class="n">3 000</td><td class="n">8 000</td><td class="n">15 000</td></tr>
<tr><td>Avis Google (note ≥ 4,8)</td><td class="n">50</td><td class="n">300</td><td class="n">600</td></tr>
<tr><td>Entreprises partenaires</td><td class="n">3</td><td class="n">10</td><td class="n">20</td></tr>
<tr><td>Événements organisés</td><td class="n">1</td><td class="n">12</td><td class="n">24</td></tr>
</tbody></table>
${box("Les événements récurrents", `<p>Compétitions internes, Octobre Rose, masterclass, soirées communauté, challenges inter-entreprises. À terme, l'application RepCore avec des QR codes sur chaque machine (tutoriel, charge suggérée, classement).</p>`)}`)}

${page("", `${head("13", "Ancrage local et impact pour le territoire", "Deux entrepreneurs qui s'installent et vivent sur le territoire, avec un projet utile au-delà de la salle.")}
<div class="grid2">${[["Dynamisme économique", ["Création d'emplois dès la deuxième année", "Artisans et fournisseurs locaux pour les travaux", "Animation d'une zone commerciale"]], ["Santé publique", ["Rendre la musculation accessible aux seniors", "Accueillir les débutants et les personnes en reprise", "Partenariats possibles avec kinés et médecins"]], ["Vie associative et jeunesse", ["Préparation physique des clubs sportifs locaux", "Partenariats avec les écoles et le STAPS", "Tarif jeune"]], ["Solidarité", ["Événements caritatifs réguliers (Octobre Rose…)", "Collectes au profit d'associations locales", "Séances découvertes offertes"]]].map(([t, l]) => `<div class="card"><h4 class="red">${t}</h4><ul>${l.map(x => `<li>${x}</li>`).join("")}</ul></div>`).join("")}</div>
<div class="box black" style="margin-top:8mm"><div class="big-quote">Une salle qui fait vivre<br><span class="red">son territoire.</span></div></div>`)}

${page("", `${head("14", "Plan de financement", `Besoin total estimé : ${eur(besoin)}. Les fondateurs apportent ${eur(apport)}, soit ${Math.round(apport / besoin * 100)} % du projet.`)}
<div class="grid2"><div><h3 style="margin-top:0">Besoins</h3><table><tbody>${BESOINS.map(([a, b]) => `<tr><td>${a}</td><td class="n">${eur(b)}</td></tr>`).join("")}<tr class="tot"><td>Total</td><td class="n">${eur(besoin)}</td></tr></tbody></table></div>
<div><h3 style="margin-top:0">Ressources</h3><table><tbody><tr><td>Apport personnel des fondateurs</td><td class="n">${eur(apport)}</td></tr><tr><td>Prêts d'honneur (2 × 15 000 €)</td><td class="n">${eur(honneur)}</td></tr><tr><td>Emprunt bancaire (7 ans, 4,5 %)</td><td class="n">${eur(pret)}</td></tr><tr class="tot"><td>Total</td><td class="n">${eur(besoin)}</td></tr></tbody></table>
<p class="muted">Mensualité estimée : <b>${eur(mens)}</b>. Garantie Bpifrance à solliciter.</p></div></div>
<div class="fig"><div class="eyebrow">Origine des fonds</div>${stack([["Apport", apport], ["Prêts d'honneur", honneur], ["Emprunt bancaire", pret]])}</div>
<div class="box line"><p><b>Leviers pour réduire le besoin :</b> location-vente du cardio (≈ −20 k€ à l'ouverture), franchise de loyer pendant les travaux, pré-ventes encaissées avant l'ouverture (200 × 34,90 € × 3 mois ≈ 21 k€).</p></div>
<p class="hyp">Hypothèses à valider : montant des travaux après visite du local, loyer réel, conditions bancaires.</p>`)}

${page("", `${head("15", "Rentabilité et point mort", `Avec ${eur(fixes)} de charges fixes par mois et ${contrib} € HT de contribution par membre, UNBROKEN couvre toutes ses charges à partir d'environ ${pointMort} membres.`)}
<div class="grid2"><div><h3 style="margin-top:0">Charges mensuelles</h3><table><tbody>${CHARGES.map(([a, b]) => `<tr><td>${a}</td><td class="n">${eur(b)}</td></tr>`).join("")}<tr class="tot"><td>Total</td><td class="n">${eur(fixes)}</td></tr></tbody></table></div>
<div><h3 style="margin-top:0">Le calcul</h3>${box("Point mort", `<p style="font-family:var(--display);font-size:15pt;line-height:1.3">${eur(fixes)} ÷ ${contrib} € ≈ <span class="red">${pointMort} membres</span></p><p class="muted" style="margin:0">Contribution = abonnement moyen 41 € TTC (34,2 € HT) + marge shop et bar.</p>`)}
${kpis([["M9", "point mort atteint"], ["780", "membres à 12 mois"]]).replace("repeat(4,1fr)", "repeat(2,1fr)")}</div></div>
<div class="fig" style="margin:0 0 3mm"><div class="eyebrow">Membres actifs sur 24 mois et point mort</div>${rampChart()}</div>
<table><thead><tr><th>Prévisionnel simplifié</th><th class="n">Année 1</th><th class="n">Année 2</th><th class="n">Année 3</th></tr></thead><tbody>
<tr><td>Membres moyens</td><td class="n">590</td><td class="n">950</td><td class="n">1 120</td></tr>
<tr><td>Chiffre d'affaires HT</td><td class="n">300 k€</td><td class="n">433 k€</td><td class="n">506 k€</td></tr>
<tr><td>Charges décaissées (emprunt compris)</td><td class="n">292 k€</td><td class="n">316 k€</td><td class="n">336 k€</td></tr>
<tr class="tot"><td>Trésorerie dégagée avant impôt</td><td class="n">+8 k€</td><td class="n">+117 k€</td><td class="n">+170 k€</td></tr></tbody></table>`)}

${page("", `${head("16", "Calendrier de réalisation", "Douze mois entre ce dossier et l'ouverture, avec une ouverture visée à la rentrée de septembre 2027, période la plus forte pour les inscriptions avec janvier.")}
<div class="fig">${gantt()}</div>
<h3>Les jalons</h3>
<div class="grid3">${[["Décembre 2026", "Dossier finalisé, local présélectionné"], ["Mars 2027", "Financement obtenu, SAS créée, bail signé"], ["Avril 2027", "Début des travaux et de la restauration"], ["Mai 2027", "Lancement des pré-ventes « membres fondateurs »"], ["Août 2027", "Salle équipée, contrôles sécurité"], ["Septembre 2027", "Ouverture et inauguration"]].map(([d, t]) => `<div class="card"><div class="eyebrow red">${d}</div><p style="margin:1mm 0 0">${t}</p></div>`).join("")}</div>`)}

${page("", `${head("17", "Risques et parades", "Chaque risque identifié a sa parade. Les deux plus sensibles sont la vitesse de remplissage et le budget travaux.")}
<div class="fig">${riskMatrix()}</div>
<table><thead><tr><th>Risque</th><th>Parade</th></tr></thead><tbody>
<tr><td><b>Montée en charge lente</b></td><td>Pré-ventes, offre entreprises, parrainage, trésorerie de sécurité de 60 k€</td></tr>
<tr><td><b>Dépassement de budget ou retard</b></td><td>Devis multiples, travaux réalisés par les fondateurs, marge de 10 % sur les travaux</td></tr>
<tr><td><b>Concurrence low-cost</b></td><td>Positionnement différent : on ne cherche pas à être les moins chers</td></tr>
<tr><td><b>Sécurité hors présence</b></td><td>Badge nominatif, vidéo, règlement, bouton d'alerte, défibrillateur</td></tr>
<tr><td><b>Matériel d'occasion</b></td><td>Restauration complète, contrôles en charge, stock de pièces</td></tr>
<tr><td><b>Départ du coach</b></td><td>Convention écrite, réseau de coachs de Kevin</td></tr>
<tr><td><b>Énergie</b></td><td>Éclairage LED, suivi mensuel des consommations</td></tr>
</tbody></table>`)}

${page("dark end", `<div class="sec-n">18</div><h2>Nos attentes</h2>
<p class="lead" style="color:#ccc">Pour concrétiser UNBROKEN, nous recherchons :</p>
<div class="grid2" style="margin-top:6mm;width:100%">${[["Banques", `Un emprunt de ${k(pret)} sur 7 ans, avec garantie Bpifrance.`], ["Réseaux d'accompagnement", "Deux prêts d'honneur (Initiative, Réseau Entreprendre) et un parrainage."], ["Collectivités", "Un appui pour trouver le local et faire connaître le projet."], ["Partenaires", "Entreprises, clubs sportifs, fournisseurs prêts à grandir avec nous."]].map(([t, d]) => `<div class="kpi" style="border-color:var(--red)"><h4>${t}</h4><p style="color:#ccc;margin:1mm 0 0">${d}</p></div>`).join("")}</div>
<div style="margin-top:16mm"><img src="${logo}" alt="UNBROKEN" style="width:110mm"><div class="big-quote" style="margin-top:6mm">Discipline · Travail · <span class="red">Résultat</span></div>
<p style="color:#bbb;margin-top:6mm">Kevin Guellec &amp; Claire Boumard · co-fondateurs</p></div>`)}

</body></html>`;

writeFileSync(join(here, "dossier-unbroken.html"), html);
const { createRequire } = await import("node:module");
const { chromium } = createRequire(import.meta.url)("/opt/node22/lib/node_modules/playwright");
const b = await chromium.launch();
const p = await b.newPage();
await p.goto("file://" + join(here, "dossier-unbroken.html"), { waitUntil: "networkidle" });
await p.pdf({ path: join(here, "Dossier-UNBROKEN.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true });
await b.close();
console.log("OK", { besoin, pret, mens, fixes, pointMort, equip, equipNeuf, nbMachines, pages: pageNo });
