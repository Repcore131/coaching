// Visuels du dossier UNBROKEN (DA des PDF RepCore : noir, rouge, blanc) à glisser dans le canevas Canva.
// Usage : node docs/unbroken/visuels.mjs  → docs/unbroken/visuels/NN-nom.png (1600 px de large)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "visuels");
mkdirSync(out, { recursive: true });
const b64 = (f, t) => `data:${t};base64,` + readFileSync(join(here, f)).toString("base64");
const logo = b64("logo-unbroken-blanc.png", "image/png");
const cover = b64("couverture.jpg", "image/jpeg");
const eur = (n) => Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ") + " €";
const C = { red: "#c8102e", ink: "#1a1a1a", mid: "#6b6b6b", line: "#d9d9d9", soft: "#f3f3f3", dark: "#0b0b0b" };

// ---------- Chiffres (budget validé : ≈ 276 500 €) ----------
const BESOINS = [["Équipement acheté", 116000], ["Travaux et aménagement", 90000], ["Trésorerie de démarrage", 40000],
  ["Dépôt de garantie (2 mois)", 17000], ["Frais d'établissement", 6000], ["Accès badge et caméras", 3000],
  ["Stock shop et bar", 3000], ["Communication de lancement", 1500]];
const besoin = BESOINS.reduce((s, b) => s + b[1], 0);
const apport = 100000, honneur = 30000, pret = besoin - apport - honneur;
const CHARGES = [["Loyer et charges", 9500], ["Rémunération des fondateurs", 4200], ["Énergie", 2500], ["Emprunt bancaire", 2036],
  ["Location du cardio", 1480], ["Entretien et ménage", 1200], ["Marketing et événements", 800], ["Comptable et banque", 600],
  ["Assurances", 500], ["Site, appli, hébergement", 100]];
const fixes = CHARGES.reduce((s, c) => s + c[1], 0);
const contrib = 36, pointMort = Math.ceil(fixes / contrib / 10) * 10;
const RAMP = [350,410,470,520,560,600,640,670,700,730,760,780,800,820,840,860,880,900,920,940,960,970,990,1000];
const cross = RAMP.findIndex((v) => v >= pointMort);

// ---------- Briques ----------
const card = (id, body, cls = "") => ({ id, html: `<div class="card ${cls}" id="${id}">${body}</div>` });
const tag = (t, red) => `<div class="eyebrow${red ? " red" : ""}">${t}</div>`;
const svg = (w, h, inner) => `<svg viewBox="0 0 ${w} ${h}" width="100%">${inner}</svg>`;

function barsH(rows, { w = 720, lw = 250, unit = eur } = {}) {
  const lh = 34, h = rows.length * lh + 4, m = Math.max(...rows.map((r) => r[1])), sc = (v) => (v / m) * (w - lw - 110);
  return svg(w, h, rows.map(([l, v, hi], i) => { const y = i * lh;
    return `<text x="${lw - 12}" y="${y + 20}" text-anchor="end" class="ax">${l}</text><rect x="${lw}" y="${y + 6}" width="${Math.max(sc(v), 3)}" height="20" rx="3" fill="${hi ? C.red : "#fff"}"/><text x="${lw + sc(v) + 10}" y="${y + 21}" class="val w">${unit(v)}</text>`; }).join(""));
}

const CARDS = [];

// 01 Couverture
CARDS.push(card("01-couverture", `<div class="cov"><img class="logo" src="${logo}"><div class="cov-t">Une salle de musculation premium, indépendante et familiale</div><div class="motto">DISCIPLINE · TRAVAIL · RÉSULTAT</div></div>`, "cover"));

// 02 Chiffres clés
CARDS.push(card("02-chiffres-cles", `${tag("Le projet en un coup d'œil", true)}<h2>Les chiffres clés</h2>
<div class="kpis k4">${[["950 m²", "de salle"], ["7j/7", "de 6 h à 22 h, accès badge"], [eur(besoin).replace(" 500 €", " k€").replace("276", "276,5"), "pour lancer le projet"], ["100 k€", "d'apport des fondateurs"],
  ["29", "machines restaurées par nos soins"], [`${pointMort}`, "membres pour couvrir toutes les charges"], ["1 000", "membres visés à 2 ans"], ["Sept. 2027", "ouverture visée"]]
  .map(([v, l]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join("")}</div>`, "dark"));

// 03 Objectifs
CARDS.push(card("03-objectifs", `${tag("Nos trois objectifs", true)}<h2>De l'ouverture à la référence</h2>
<div class="road">${[["Mois 1", "400", "membres, dont 200 membres fondateurs en pré-vente"], [`Mois ${cross + 1}`, `${pointMort}`, "membres : toutes les charges sont couvertes"], ["Mois 24", "1 000", "membres : LA salle de musculation du territoire"]]
  .map(([m, n, t], i) => `<div class="stop${i === 1 ? " hl" : ""}"><div class="dot"></div><div class="eyebrow">${m}</div><b>${n}</b><p>${t}</p></div>`).join("")}</div>`));

// 04 Binôme
CARDS.push(card("04-binome", `${tag("Les porteurs du projet", true)}<h2>Un binôme complémentaire</h2>
<div class="duo"><div class="who"><div class="ini">KG</div><h3>Kevin Guellec</h3><p class="muted">Coach depuis 2020, STAPS, master management du sport, manager à Fitness Park Niort (plus de 1 000 avis Google)</p>
<ul><li>Marketing, réseaux, événements</li><li>Coaching et formation des coachs</li><li>Travaux et restauration des machines</li></ul></div>
<div class="mid"><div class="pill">50 / 50</div><div class="muted c">Direction et stratégie<br>en co-pilotage</div></div>
<div class="who"><div class="ini red">CB</div><h3>Claire Boumard</h3><p class="muted">Dirige depuis 6 ans sa boutique Yves Thuriès à Niort : gestion, achats, vente, fidélisation</p>
<ul><li>Vente, accueil, relation client</li><li>Gestion et finances</li><li>Achats et shop</li></ul></div></div>`));

// 05 Valeurs
CARDS.push(card("05-valeurs", `${tag("Nos valeurs", true)}<h2>Ce qui nous fait avancer</h2>
<div class="g3">${[["Discipline", "On vient même quand c'est dur."], ["Travail", "Chaque progrès se gagne."], ["Résultat", "On mesure, on suit, on célèbre."], ["Convivialité", "On se connaît, on s'encourage."], ["Exigence", "Matériel impeccable, salle propre."], ["Ouverture", "Du débutant au compétiteur."]]
  .map(([t, d], i) => `<div class="val-c${i < 3 ? " r" : ""}"><b>${t}</b><span>${d}</span></div>`).join("")}</div>`, "dark"));

// 06 Parcours membre
CARDS.push(card("06-parcours-membre", `${tag("Le concept en action", true)}<h2>Le parcours d'un nouveau membre</h2>
<div class="steps">${[["Découverte", "Vidéo Instagram, bouche-à-oreille, entreprise"], ["Visite", "Accueil par un fondateur"], ["Inscription", "Badge et kit de bienvenue"], ["Démarrage", "Bilan offert, programme RepCore"], ["Intégration", "Premier événement, groupe membres"], ["Ambassadeur", "Parrainage, avis, compétition"]]
  .map(([t, d], i) => `<div class="step"><b>${i + 1}</b><h4>${t}</h4><span>${d}</span></div>`).join('<div class="arrow">›</div>')}</div>`));

// 07 Positionnement
{
  const w = 720, h = 330, P = (x, y) => [70 + x * 600, 20 + (1 - y) * 250];
  const dots = [["Basic-Fit", 0.1, 0.18, 0], ["Fitness Park", 0.3, 0.42, 0], ["Salles « usine »", 0.36, 0.28, 0], ["Box CrossFit", 0.8, 0.6, 0], ["Studios boutique", 0.9, 0.78, 0], ["UNBROKEN", 0.55, 0.88, 1]];
  CARDS.push(card("07-positionnement", `${tag("Le marché", true)}<h2>Le créneau libre : le premium accessible</h2>
  ${svg(w, h, `<rect x="${P(0.42, 1)[0]}" y="20" width="${P(0.7, 0)[0] - P(0.42, 0)[0]}" height="125" fill="${C.red}" opacity=".08"/>
  <line x1="70" y1="270" x2="${w - 10}" y2="270" stroke="${C.mid}"/><line x1="70" y1="20" x2="70" y2="270" stroke="${C.mid}"/>
  <text x="${w - 10}" y="295" text-anchor="end" class="ax">Prix mensuel →</text><text x="20" y="20" class="ax" transform="rotate(-90 20 20)" text-anchor="end">Matériel, ambiance, communauté →</text>
  ${dots.map(([n, x, y, u]) => { const [cx, cy] = P(x, y); return `<circle cx="${cx}" cy="${cy}" r="${u ? 12 : 8}" fill="${u ? C.red : C.ink}" stroke="#fff" stroke-width="3"/><text x="${cx + 18}" y="${cy + 5}" class="${u ? "val red" : "ax"}">${n}</text>`; }).join("")}`)}
  <div class="g3 sm">${[["≈ 7 M", "d'adhérents en France"], ["9 %", "de pénétration (16 % au Royaume-Uni)"], ["3", "clubs low-cost à Quimper, aucune salle premium"]].map(([v, l]) => `<div class="kpi l"><b>${v}</b><span>${l}</span></div>`).join("")}</div>`));
}

// 08 Cibles
CARDS.push(card("08-cibles", `${tag("La clientèle", true)}<h2>Pour qui ?</h2>
<div class="g4">${[["45 %", "Le passionné connecté", "18–30 ans, 4 à 6 séances / semaine"], ["30 %", "L'actif qui se vide la tête", "25–50 ans, 1 à 2 fois / semaine"], ["15 %", "Santé et famille", "Parents, femmes, seniors, débutants"], ["10 %", "Le compétiteur", "Bodybuilding, force"]]
  .map(([p, t, d], i) => `<div class="pers${i === 0 ? " hl" : ""}"><b>${p}</b><h4>${t}</h4><span>${d}</span></div>`).join("")}</div>
<div class="bar">${[[45, C.red], [30, C.ink], [15, "#8c8c8c"], [10, "#c9c9c9"]].map(([p, c]) => `<div style="width:${p}%;background:${c}"></div>`).join("")}</div>
<p class="muted">+ une clientèle entreprises : 10 entreprises partenaires visées la première année.</p>`));

// 09 Zone de chalandise
CARDS.push(card("09-chalandise", `${tag("L'implantation", true)}<h2>Zone de chalandise</h2>
<div class="duo2">${svg(340, 340, `<circle cx="170" cy="170" r="160" fill="${C.soft}"/><circle cx="170" cy="170" r="108" fill="#e4e4e4"/><circle cx="170" cy="170" r="56" fill="${C.red}" opacity=".2"/><circle cx="170" cy="170" r="10" fill="${C.red}"/><text x="170" y="150" text-anchor="middle" class="val">UNBROKEN</text><text x="170" y="100" text-anchor="middle" class="ax">10 min</text><text x="170" y="48" text-anchor="middle" class="ax">20 min</text><text x="170" y="24" text-anchor="middle" class="ax">30 min</text>`)}
<div><div class="leg"><i style="background:${C.red};opacity:.5"></i><b>10 min</b> zone principale : la majorité des membres</div><div class="leg"><i style="background:#cfcfcf"></i><b>20 min</b> zone secondaire : actifs et familles</div><div class="leg"><i style="background:${C.soft};border:1px solid #ccc"></i><b>30 min</b> passionnés et compétiteurs</div>
<div class="note">Critères du local : 900 à 1 000 m², 4 m sous plafond, dalle béton, 60 places de parking, zone commerciale passante.</div></div></div>`));

// 10 Plan de la salle
{
  const rows = [[["Zone force", 140, 1], ["Poids libres", 160, 1]], [["Machines haut du corps", 135, 0], ["Machines bas du corps", 135, 0]],
    [["Cardio", 72, 0], ["Coaching fonctionnel", 60, 0], ["Vestiaires H", 52, 2], ["Vestiaires F", 52, 2]],
    [["Accueil et shop", 56, 3], ["Détente et bar", 40, 3], ["Salle de posing", 24, 1], ["Bureau / atelier", 24, 2]]];
  const W = 720, H = 400, fills = ["#1a1a1a", "#3a3a3a", "#8c8c8c", C.red]; let y = 0; const o = [];
  for (const row of rows) { const s = row.reduce((a, c) => a + c[1], 0), rh = (s / 950) * H; let x = 0;
    for (const [n, m2, kd] of row) { const cw = (m2 / s) * W; o.push(`<rect x="${x + 2}" y="${y + 2}" width="${cw - 4}" height="${rh - 4}" fill="${fills[kd]}"/><text x="${x + 12}" y="${y + 24}" class="plan">${n}</text><text x="${x + 12}" y="${y + 42}" class="plan s">${m2} m²</text>`); x += cw; }
    y += rh; }
  CARDS.push(card("10-plan-salle", `${tag("L'aménagement", true)}<h2>950 m², deux tiers pour s'entraîner</h2>${svg(W, H, o.join(""))}
  <div class="legs">${[["Force et poids libres", fills[1]], ["Machines et cardio", fills[0]], ["Vestiaires et bureau", fills[2]], ["Accueil, shop, bar", fills[3]]].map(([t, c]) => `<span><i style="background:${c}"></i>${t}</span>`).join("")}</div>`));
}

// 11 Budget équipement
CARDS.push(card("11-equipement", `${tag("L'équipement", true)}<h2>116 k€ d'équipement acheté</h2>
${barsH([["Jambes et fessiers", 28157, 1], ["Machines guidées et poulies", 28829, 1], ["Zone force", 24700], ["Haltères et kettlebells", 12900], ["Pectoraux et bras", 10819, 1], ["Bancs et poids du corps", 8700], ["Mobilité et abdos", 2200]].sort((a, b) => b[1] - a[1]))}
<div class="legs"><span><i style="background:${C.red}"></i>Machines d'occasion restaurées</span><span><i style="background:#fff"></i>Matériel neuf</span><span><i style="background:#555"></i>Cardio (≈ 63 k€) en location sur 48 mois</span></div>`, "dark"));

// 12 Restauration
CARDS.push(card("12-restauration", `${tag("Notre savoir-faire", true)}<h2>Des machines d'exception, restaurées par nos soins</h2>
<div class="steps">${[["Sourcing", "Salons, revendeurs, salles qui ferment"], ["Diagnostic", "Structure, soudures, câbles"], ["Mécanique", "Roulements, câbles, axes"], ["Peinture", "Aux couleurs UNBROKEN"], ["Sellerie", "Mousses et skaï à neuf"], ["Contrôle", "Essais en charge, fiche sécurité"]]
  .map(([t, d], i) => `<div class="step"><b>${i + 1}</b><h4>${t}</h4><span>${d}</span></div>`).join('<div class="arrow">›</div>')}</div>
<div class="kpis k3">${[["−40 %", "par rapport au prix neuf"], ["29", "machines guidées restaurées"], ["+ contenu", "chaque restauration devient une vidéo"]].map(([v, l]) => `<div class="kpi l"><b>${v}</b><span>${l}</span></div>`).join("")}</div>`));

// 13 Tarifs
CARDS.push(card("13-tarifs", `${tag("L'offre", true)}<h2>Premium, mais accessible</h2>
<div class="g3">${[["Sans engagement", "54,90 €", "par mois"], ["Engagement 12 mois", "44,90 €", "par mois, le plus choisi"], ["Étudiants, −25 ans", "37,90 €", "par mois, 12 mois"]]
  .map(([t, p, s], i) => `<div class="price${i === 1 ? " hl" : ""}"><div class="eyebrow${i === 1 ? " red" : ""}">${t}</div><b>${p}</b><span>${s}</span></div>`).join("")}</div>
<div class="g3" style="margin-top:12px">${[["Membre fondateur", "34,90 €", "à vie, 200 places en pré-vente"], ["Séance", "12 €", "ou 99 € les 10"], ["Entreprises", "dès 35 €", "par collaborateur"]]
  .map(([t, p, s]) => `<div class="price"><div class="eyebrow">${t}</div><b>${p}</b><span>${s}</span></div>`).join("")}</div>`));

// 14 Journée type
{ const w = 720, l = 20, sc = (h) => l + ((h - 6) / 16) * (w - l - 20);
  CARDS.push(card("14-journee", `${tag("Organisation", true)}<h2>Ouvert 7j/7, de 6 h à 22 h</h2>
  ${svg(w, 110, `<rect x="${sc(6)}" y="10" width="${sc(22) - sc(6)}" height="34" fill="${C.ink}"/><rect x="${sc(9)}" y="10" width="${sc(13) - sc(9)}" height="34" fill="${C.red}"/><rect x="${sc(16)}" y="10" width="${sc(21) - sc(16)}" height="34" fill="${C.red}"/>
  ${[6, 9, 13, 16, 21, 22].map((h) => `<text x="${sc(h)}" y="66" text-anchor="middle" class="ax">${h} h</text>`).join("")}
  <rect x="${l}" y="84" width="14" height="14" fill="${C.ink}"/><text x="${l + 22}" y="96" class="ax">Accès libre par badge</text><rect x="${l + 250}" y="84" width="14" height="14" fill="${C.red}"/><text x="${l + 272}" y="96" class="ax">Plateau animé : fondateurs + coach présents</text>`)}
  <div class="g3">${[["Année 1", "2 fondateurs + 1 coach partenaire"], ["Année 2", "+ 1 alternant (accueil, réseaux)"], ["Année 3", "+ 1 salarié, 2e coach"]].map(([t, d]) => `<div class="kpi l"><b>${t}</b><span>${d}</span></div>`).join("")}</div>`));
}

// 15 Marketing
CARDS.push(card("15-marketing", `${tag("Marketing et communication", true)}<h2>Une salle dont on parle se remplit plus vite</h2>
<div class="g3">${[["Avant l'ouverture", ["Coulisses des travaux et des restaurations", "200 membres fondateurs en pré-vente", "Partenariats locaux"]], ["Lancement", ["Inauguration avec élus et partenaires", "Semaine portes ouvertes", "Première compétition interne"]], ["Fidélisation", ["Un événement par mois", "Défis et classements sur RepCore", "Avis Google, collections textile"]]]
  .map(([t, l], i) => `<div class="phase${i === 1 ? " hl" : ""}"><b>${i + 1}</b><h4>${t}</h4><ul>${l.map((x) => `<li>${x}</li>`).join("")}</ul></div>`).join("")}</div>
<div class="kpis k4">${[["15 000", "abonnés Instagram à 2 ans"], ["600", "avis Google (≥ 4,8)"], ["20", "entreprises partenaires"], ["1,5 k€", "de budget com : contenu fait maison"]].map(([v, l]) => `<div class="kpi l"><b>${v}</b><span>${l}</span></div>`).join("")}</div>`));

// 16 Financement
{ const w = 720, parts = [["Apport des fondateurs", apport, C.red], ["Prêts d'honneur", honneur, "#8c8c8c"], ["Emprunt bancaire 7 ans", pret, "#fff"]]; let x = 0;
  const bar = parts.map(([l, v, c], i) => { const pw = (v / besoin) * w, s = `<rect x="${x + (i ? 2 : 0)}" y="0" width="${pw - (i ? 2 : 0)}" height="44" fill="${c}"/><rect x="${i * 240}" y="62" width="14" height="14" fill="${c}"/><text x="${i * 240 + 22}" y="74" class="ax w b">${l}</text><text x="${i * 240 + 22}" y="94" class="ax w">${eur(v)} · ${Math.round((v / besoin) * 100)} %</text>`; x += pw; return s; }).join("");
  CARDS.push(card("16-financement", `${tag("Plan de financement", true)}<h2>${eur(besoin)} pour lancer UNBROKEN</h2>
  ${barsH(BESOINS.map(([l, v], i) => [l, v, i < 2]), { lw: 260 })}
  <div class="eyebrow" style="margin:22px 0 10px">Origine des fonds</div>${svg(w, 100, bar)}
  <p class="muted w">Emprunt ≈ 2 040 € par mois. Cardio loué ≈ 1 480 € par mois sur 48 mois. Plomberie et électricité par des artisans, le reste fait par les fondateurs.</p>`, "dark"));
}

// 17 Point mort
{ const w = 720, h = 260, l = 50, b = 30, t = 16, mx = 1100, X = (i) => l + (i / 23) * (w - l - 20), Y = (v) => t + (1 - v / mx) * (h - t - b);
  const grid = [0, 250, 500, 750, 1000].map((v) => `<line x1="${l}" x2="${w - 20}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.line}"/><text x="${l - 8}" y="${Y(v) + 4}" text-anchor="end" class="ax">${v}</text>`).join("");
  CARDS.push(card("17-point-mort", `${tag("Rentabilité", true)}<h2>Le point mort dès le ${cross + 1}e mois</h2>
  <div class="calc">${eur(fixes)} de charges par mois <span>÷</span> ${contrib} € par membre <span>=</span> <b class="red">${pointMort} membres</b></div>
  ${svg(w, h, `${grid}${[0, 5, 11, 17, 23].map((i) => `<text x="${X(i)}" y="${h - 8}" text-anchor="middle" class="ax">M${i + 1}</text>`).join("")}
  <rect x="${X(cross)}" y="${t}" width="${w - 20 - X(cross)}" height="${Y(pointMort) - t}" fill="${C.red}" opacity=".07"/>
  <line x1="${l}" x2="${w - 20}" y1="${Y(pointMort)}" y2="${Y(pointMort)}" stroke="${C.red}" stroke-width="2" stroke-dasharray="7 5"/>
  <text x="${w - 22}" y="${Y(pointMort) + 20}" text-anchor="end" class="ax red b">Point mort : ${pointMort} membres</text>
  <polyline points="${RAMP.map((v, i) => `${X(i)},${Y(v)}`).join(" ")}" fill="none" stroke="${C.ink}" stroke-width="3"/>
  ${[0, 11, 23].map((i) => `<circle cx="${X(i)}" cy="${Y(RAMP[i])}" r="6" fill="${C.ink}" stroke="#fff" stroke-width="2"/><text x="${X(i) + (i === 23 ? -10 : 10)}" y="${Y(RAMP[i]) - 12}" text-anchor="${i === 23 ? "end" : "start"}" class="val">${RAMP[i]}</text>`).join("")}
  <circle cx="${X(cross)}" cy="${Y(RAMP[cross])}" r="8" fill="${C.red}" stroke="#fff" stroke-width="3"/>`)}
  <div class="kpis k3">${[["≈ 300 k€", "CA année 1 · trésorerie +25 k€"], ["≈ 414 k€", "CA année 2 · trésorerie +115 k€"], ["≈ 497 k€", "CA année 3 · trésorerie +173 k€"]].map(([v, l]) => `<div class="kpi l"><b>${v}</b><span>${l}</span></div>`).join("")}</div>`));
}

// 18 Calendrier
{ const months = ["oct.", "nov.", "déc.", "janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept."];
  const tasks = [["Dossier et étude de marché", 0, 2], ["Recherche du local", 1, 4], ["Banques et prêts d'honneur", 2, 5], ["Société créée, bail signé", 4, 6], ["Sourcing et restauration", 4, 10], ["Travaux et aménagement", 6, 10], ["Pré-ventes membres fondateurs", 7, 11], ["Montage et contrôles", 9, 11], ["Ouverture", 11, 12]];
  const l = 240, w = 720, cw = (w - l) / 12, rh = 30;
  CARDS.push(card("18-calendrier", `${tag("Calendrier", true)}<h2>12 mois jusqu'à l'ouverture</h2>
  ${svg(w, tasks.length * rh + 46, `${months.map((m, i) => `<text x="${l + i * cw + cw / 2}" y="14" text-anchor="middle" class="ax">${m}</text>${i ? `<line x1="${l + i * cw}" x2="${l + i * cw}" y1="22" y2="${tasks.length * rh + 26}" stroke="#2a2a2a"/>` : ""}`).join("")}
  ${tasks.map(([n, a, z], i) => `<text x="${l - 12}" y="${30 + i * rh + 14}" text-anchor="end" class="ax w">${n}</text><rect x="${l + a * cw + 3}" y="${30 + i * rh + 2}" width="${(z - a) * cw - 6}" height="18" rx="3" fill="${i === tasks.length - 1 ? C.red : "#fff"}"/>`).join("")}
  <text x="${l}" y="${tasks.length * rh + 44}" class="ax">2026</text><text x="${l + 3 * cw}" y="${tasks.length * rh + 44}" class="ax">2027</text>`)}`, "dark"));
}

// 19 Risques
{ const R = [["Montée en charge lente", 0.6, 0.85], ["Budget travaux", 0.55, 0.62], ["Concurrence low-cost", 0.82, 0.38], ["Panne machine", 0.5, 0.28], ["Départ du coach", 0.28, 0.36], ["Incident hors présence", 0.2, 0.7], ["Hausse énergie", 0.62, 0.18]];
  const x0 = 60, y0 = 10, sw = 640, s = 270;
  CARDS.push(card("19-risques", `${tag("Risques et parades", true)}<h2>Chaque risque a sa parade</h2>
  ${svg(720, 320, `<rect x="${x0}" y="${y0}" width="${sw / 2}" height="${s / 2}" fill="${C.soft}"/><rect x="${x0 + sw / 2}" y="${y0}" width="${sw / 2}" height="${s / 2}" fill="${C.red}" opacity=".12"/><rect x="${x0}" y="${y0 + s / 2}" width="${sw / 2}" height="${s / 2}" fill="#fafafa"/><rect x="${x0 + sw / 2}" y="${y0 + s / 2}" width="${sw / 2}" height="${s / 2}" fill="${C.soft}"/>
  <text x="${x0 + sw - 10}" y="${y0 + 22}" text-anchor="end" class="ax red b">À surveiller de près</text><text x="${x0 + sw}" y="${y0 + s + 26}" text-anchor="end" class="ax">Probabilité →</text><text x="${x0 - 14}" y="${y0}" class="ax" transform="rotate(-90 ${x0 - 14} ${y0})" text-anchor="end">Impact →</text>
  ${R.map(([n, p, i]) => { const cx = x0 + p * sw, cy = y0 + (1 - i) * s, hot = p > 0.5 && i > 0.5; return `<circle cx="${cx}" cy="${cy}" r="8" fill="${hot ? C.red : C.ink}" stroke="#fff" stroke-width="2"/><text x="${cx + (p > 0.7 ? -14 : 14)}" y="${cy + 5}" text-anchor="${p > 0.7 ? "end" : "start"}" class="ax">${n}</text>`; }).join("")}`)}
  <div class="g2">${[["Montée en charge lente", "Pré-ventes, entreprises, parrainage, 40 k€ de trésorerie"], ["Budget travaux", "Devis multiples, artisans pour plomberie et électricité, le reste par nous"]].map(([t, d]) => `<div class="kpi l"><b class="red sm">${t}</b><span>${d}</span></div>`).join("")}</div>`));
}

// 20 Attentes
CARDS.push(card("20-attentes", `<img class="logo sm" src="${logo}">${tag("Nos attentes", true)}<h2>Ce que nous recherchons</h2>
<div class="g2">${[["Banques", `Un emprunt de ${eur(pret)} sur 7 ans, avec garantie Bpifrance`], ["Réseaux d'accompagnement", "Deux prêts d'honneur (Initiative, Réseau Entreprendre)"], ["Collectivités", "Un appui pour trouver le local et faire connaître le projet"], ["Partenaires locaux", "Entreprises, clubs, commerçants qui grandissent avec nous"]]
  .map(([t, d]) => `<div class="kpi"><b class="sm">${t}</b><span>${d}</span></div>`).join("")}</div>
<div class="motto big">DISCIPLINE · TRAVAIL · <span class="red">RÉSULTAT</span></div>`, "dark"));

// ---------- Page ----------
const css = `
*{box-sizing:border-box;margin:0;padding:0}
body{background:#ddd;font-family:"Inter","Liberation Sans",Arial,sans-serif;color:${C.ink};padding:20px}
.card{width:800px;padding:44px 40px 40px;background:#fff;margin-bottom:20px;position:relative;border-top:8px solid ${C.red}}
.dark{background:${C.dark};color:#fff}
h2{font-family:"Oswald","Arial Narrow",sans-serif;text-transform:uppercase;font-size:34px;line-height:1.05;margin:6px 0 24px}
h3{font-family:"Oswald",sans-serif;text-transform:uppercase;font-size:22px;margin:8px 0 6px}
h4{font-family:"Oswald",sans-serif;text-transform:uppercase;font-size:15px;margin:4px 0 4px;letter-spacing:.02em}
.eyebrow{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${C.mid}}
.red{color:${C.red};fill:${C.red}}
.muted{color:${C.mid};font-size:13px;line-height:1.45}.muted.w{color:#aaa;margin-top:14px}.c{text-align:center}
.kpis{display:grid;gap:12px;margin-top:18px}.k4{grid-template-columns:repeat(4,1fr)}.k3{grid-template-columns:repeat(3,1fr)}
.kpi{background:#1b1b1b;padding:16px;border-top:3px solid ${C.red}}
.kpi b{display:block;font-family:"Oswald",sans-serif;font-size:30px;line-height:1.1}.kpi b.sm{font-size:18px;margin-bottom:4px}
.kpi span{font-size:12.5px;color:#aaa;line-height:1.4;display:block}
.kpi.l{background:${C.soft}}.kpi.l span{color:${C.mid}}.dark .kpi.l{background:#1b1b1b}.dark .kpi.l span{color:#aaa}
.road{display:grid;grid-template-columns:repeat(3,1fr);gap:0;position:relative;margin-top:10px}
.road::before{content:"";position:absolute;left:8%;right:8%;top:9px;height:4px;background:${C.ink}}
.stop{position:relative;padding:34px 14px 0;text-align:center}
.stop .dot{position:absolute;top:0;left:50%;margin-left:-11px;width:22px;height:22px;border-radius:50%;background:${C.ink};border:4px solid #fff;box-shadow:0 0 0 2px ${C.ink}}
.stop.hl .dot{background:${C.red};box-shadow:0 0 0 2px ${C.red}}
.stop b{display:block;font-family:"Oswald",sans-serif;font-size:52px;line-height:1;margin:6px 0}.stop.hl b{color:${C.red}}
.stop p{font-size:13px;color:${C.mid};line-height:1.4}
.duo{display:grid;grid-template-columns:1fr 120px 1fr;gap:16px;align-items:center}
.who{background:${C.soft};padding:20px;height:100%}.who ul{padding-left:18px;font-size:13px;margin-top:8px}.who li{margin-bottom:4px}.who li::marker{color:${C.red}}
.ini{width:52px;height:52px;border-radius:50%;background:${C.ink};color:#fff;font-family:"Oswald",sans-serif;font-size:20px;display:flex;align-items:center;justify-content:center}.ini.red{background:${C.red}}
.mid{text-align:center}.pill{background:${C.ink};color:#fff;font-family:"Oswald",sans-serif;font-size:22px;padding:10px 0;margin-bottom:8px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.g3.sm{margin-top:10px}.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.val-c{border:1px solid #2c2c2c;padding:18px}.val-c.r{border-color:${C.red}}.val-c b{display:block;font-family:"Oswald",sans-serif;text-transform:uppercase;font-size:22px;margin-bottom:4px}.val-c span{font-size:13px;color:#aaa}
.steps{display:flex;align-items:stretch;gap:4px}.step{flex:1;background:${C.dark};color:#fff;padding:12px 10px;min-height:150px}.step b{font-family:"Oswald",sans-serif;font-size:30px;color:${C.red};line-height:1}.step span{font-size:11.5px;color:#bbb;line-height:1.35;display:block}
.arrow{display:flex;align-items:center;font-size:26px;color:${C.red};font-weight:700}
.pers{background:${C.soft};padding:16px}.pers.hl{background:${C.dark};color:#fff}.pers b{font-family:"Oswald",sans-serif;font-size:36px;color:${C.red};line-height:1}.pers span{font-size:12px;color:${C.mid}}.pers.hl span{color:#bbb}
.bar{display:flex;height:16px;margin:18px 0 10px;gap:3px}
.duo2{display:grid;grid-template-columns:340px 1fr;gap:26px;align-items:center}
.leg{font-size:14px;margin-bottom:12px;display:flex;gap:10px;align-items:center}.leg b{white-space:nowrap}.leg i{width:18px;height:18px;border-radius:50%;display:inline-block;flex:none}
.note{background:${C.soft};padding:14px;font-size:13px;margin-top:10px;border-left:3px solid ${C.red}}
.legs{display:flex;flex-wrap:wrap;gap:18px;margin-top:14px;font-size:12.5px}.legs i{display:inline-block;width:12px;height:12px;margin-right:6px;vertical-align:-1px}.dark .legs{color:#ccc}
.price{border:1px solid ${C.line};padding:18px;display:flex;flex-direction:column;gap:4px}.price.hl{border:3px solid ${C.red}}.price b{font-family:"Oswald",sans-serif;font-size:36px;line-height:1}.price span{font-size:12px;color:${C.mid}}
.phase{border-top:4px solid ${C.ink};padding-top:10px}.phase.hl{border-color:${C.red}}.phase b{font-family:"Oswald",sans-serif;font-size:40px;color:${C.red};line-height:1}.phase ul{padding-left:18px;font-size:13px}.phase li{margin-bottom:4px}.phase li::marker{color:${C.red}}
.calc{font-family:"Oswald",sans-serif;font-size:24px;background:${C.soft};padding:14px 18px;margin-bottom:16px}.calc span{color:${C.mid};margin:0 6px}
svg text{font-family:"Inter",Arial,sans-serif}svg .ax{font-size:12.5px;fill:#555}.dark svg .ax{fill:#bbb}svg .ax.w{fill:#ddd}svg .val{font-size:13px;font-weight:700;fill:${C.ink}}svg .val.w{fill:#fff}svg .val.red,svg .red{fill:${C.red}}svg .b{font-weight:700}
svg .plan{font-size:13px;font-weight:700;fill:#fff}svg .plan.s{font-weight:400;opacity:.85}
.cover{padding:0;height:1000px;background:url(${cover}) center top/cover;border:0}
.cover::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,11,11,0) 45%,rgba(11,11,11,.8) 66%,#0b0b0b 86%)}
.cov{position:absolute;left:44px;right:44px;bottom:50px;z-index:1;color:#fff}.logo{width:480px;display:block}.logo.sm{width:240px;margin-bottom:18px}
.cov-t{font-family:"Oswald",sans-serif;text-transform:uppercase;font-size:38px;line-height:1.1;margin:22px 0 12px}
.motto{font-family:"Oswald",sans-serif;color:${C.red};font-size:18px;letter-spacing:.2em}.motto.big{color:#fff;font-size:26px;margin-top:28px;letter-spacing:.12em}
`;
const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&display=swap" rel="stylesheet"><style>${css}</style></head><body>${CARDS.map((c) => c.html).join("")}</body></html>`;
writeFileSync(join(here, "visuels.html"), html);

const { chromium } = createRequire(import.meta.url)("/opt/node22/lib/node_modules/playwright");
const br = await chromium.launch();
const p = await br.newPage({ deviceScaleFactor: 2, viewport: { width: 860, height: 1200 } });
await p.goto("file://" + join(here, "visuels.html"), { waitUntil: "networkidle" });
for (const c of CARDS) await (await p.$(`[id="${c.id}"]`)).screenshot({ path: join(out, c.id + ".png") });
await br.close();
console.log({ besoin, pret, fixes, pointMort, mois: cross + 1, n: CARDS.length });
