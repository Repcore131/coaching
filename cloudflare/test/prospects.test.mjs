// Le parcours du prospect (lot C6) : le « Ça m'intéresse » de la vitrine, la relance du coach à 48 h.
//   node --test cloudflare/test/prospects.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { creerBase } from '../src/base.js';
import { creerMetier, PUSH_TYPES } from '../src/metier.js';
import { travaux } from '../src/planif.js';
import * as PR from '../src/prospects.js';
import { fausseBase, appareil } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const H = 3600e3, J = 864e5;
const T = Date.parse('2026-10-06T10:15:00+02:00');
const V = { nom: 'Kévin Guellec', formules: ['coaching_essentiel', 'programme_perso'] };
const F = (o) => Object.assign({ prenom: 'Léa', contact: '06 12 34 56 78', formule: 'coaching_essentiel', site: '' }, o || {});

// ── PURES ─────────────────────────────────────────────────────────────────
test('la création d’un prospect : prénom et contact seulement, contact normalisé', () => {
  const r = PR.prospectDepuisFormulaire(F(), V, {}, T);
  assert.equal(r.ok, true);
  assert.deepEqual(r.prospect, { at: T, prenom: 'Léa', contact: '+33612345678', canal: 'tel', formule: 'coaching_essentiel', statut: 'nouveau' });
  assert.equal(PR.prospectDepuisFormulaire(F({ contact: 'Lea.M@Exemple.FR ' }), V, {}, T).prospect.contact, 'lea.m@exemple.fr');
  assert.equal(PR.contactNet('+44 7700 900123').valeur, '+447700900123');
  assert.equal(PR.contactNet('0033612345678').valeur, '+33612345678');
});

test('contact invalide, prénom absent, formule non proposée, robot : refusés', () => {
  for (const c of ['', '12', 'lea@', 'lea@exemple', '06 12 34', 'pas un contact', '+0612345678', 'a@b.c'])
    assert.equal(PR.prospectDepuisFormulaire(F({ contact: c }), V, {}, T).raison, 'contact', JSON.stringify(c));
  for (const p of ['', '   ', '1234', '<script>', 'x'.repeat(31)])
    assert.equal(PR.prospectDepuisFormulaire(F({ prenom: p }), V, {}, T).raison, 'prenom', JSON.stringify(p));
  assert.equal(PR.prospectDepuisFormulaire(F({ formule: 'coaching_evolution' }), V, {}, T).raison, 'formule');
  assert.equal(PR.prospectDepuisFormulaire(F({ formule: 'boutique_prog' }), { formules: ['boutique_prog'] }, {}, T).raison, 'formule');
  assert.equal(PR.prospectDepuisFormulaire(F({ site: 'http://spam' }), V, {}, T).raison, 'robot');
});

test('le doublon : le même contact dans les trente jours, même formulé autrement', () => {
  const ex = { a: { at: T - 5 * J, contact: '+33612345678', statut: 'nouveau' } };
  assert.equal(PR.prospectDepuisFormulaire(F({ contact: '+33 6 12 34 56 78', formule: 'programme_perso' }), V, ex, T).raison, 'doublon');
  assert.equal(PR.prospectDepuisFormulaire(F(), V, { a: Object.assign({}, ex.a, { at: T - 31 * J }) }, T).ok, true);
  // Le plafond du jour, par coach.
  const plein = {};
  for (let i = 0; i < PR.PROSPECTS_JOUR_MAX; i++) plein['p' + i] = { at: T - H, contact: '+3361234' + String(1000 + i), statut: 'nouveau' };
  assert.equal(PR.prospectDepuisFormulaire(F(), V, plein, T).raison, 'plafond');
});

test('la relance à 48 h : au coach, une fois ; déjà répondu, rien ne part', () => {
  const l = { a: { at: T - 49 * H, prenom: 'Léa', statut: 'nouveau' }, b: { at: T - 47 * H, prenom: 'Tom', statut: 'nouveau' },
    c: { at: T - 60 * H, prenom: 'Inès', statut: 'repondu' }, d: { at: T - 60 * H, prenom: 'Nora', statut: 'nouveau', relanceLe: T - H },
    e: { at: T - 70 * H, prenom: 'Karim', statut: 'athlete' } };
  assert.deepEqual(PR.prospectsARelancer(l, T).map((p) => p.id), ['a']);
  const m = PR.messageRelanceCoach(PR.prospectsARelancer(l, T));
  assert.equal(m.type, 'prospect');
  assert.match(m.title, /^Léa attend ta réponse$/);
  assert.ok(PUSH_TYPES.includes('prospect'));
});

test('aucun paiement dans le parcours : ni PayPal, ni lien d’achat, ni prix écrit sur la vitrine', () => {
  const ici = path.dirname(fileURLToPath(import.meta.url));
  const page = fs.readFileSync(path.join(ici, '..', '..', 'c', 'index.html'), 'utf8');
  const i = page.indexOf('<h2>Mes formules</h2>');
  assert.ok(i > 0, 'la section des formules existe');
  const src = fs.readFileSync(path.join(ici, '..', 'src', 'prospects.js'), 'utf8');
  assert.doesNotMatch(src.replace(/\/\/.*$/gm, ''), /paypal|paiement|checkout|stripe/i);
  // Les prix viennent du tableau des offres : aucun montant dans la page.
  assert.doesNotMatch(page, /\d\s?€/);
  assert.match(page, /tarifs\.json/);
  assert.match(page, /C\[k\]\.prix|f\.prix/);
});

// ── DE BOUT EN BOUT ───────────────────────────────────────────────────────
const COACH = 'kev@t,fr';
function monde(initial, t) {
  const Fb = fausseBase(initial);
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: Fb.fetchImpl });
  let h = t;
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: Fb.fetchImpl, maintenant: () => h });
  return { F: Fb, M, db, avance: (ms) => { h += ms; }, get t() { return h; } };
}

test('le formulaire crée le prospect chez le coach et le prévient ; la relance part à 48 h, une seule fois', async () => {
  const tel = appareil('https://push.test/kev');
  const w = monde({ slugs: { 'kevin-guellec': COACH }, vitrines: { 'kevin-guellec': V }, push: { [COACH]: { x: tel.abonnement } } }, T);
  assert.deepEqual(await w.M.prospectRecevoir(Object.assign({ slug: 'kevin-guellec' }, F()), T), { ok: true });
  const l = w.F.lire('prospects/' + COACH);
  assert.equal(Object.keys(l).length, 1);
  assert.equal(Object.values(l)[0].contact, '+33612345678');
  assert.equal(w.F.recus.length, 1);
  assert.match(tel.lire(w.F.recus[0].init.body).title, /Nouveau contact : Léa/);
  // Deux fois le même contact : aucun second prospect, la personne est rassurée.
  assert.deepEqual(await w.M.prospectRecevoir(Object.assign({ slug: 'kevin-guellec' }, F({ formule: 'programme_perso' })), T + 60e3), { ok: true, deja: true });
  assert.equal(Object.keys(w.F.lire('prospects/' + COACH)).length, 1);
  // Une page qui n'existe pas.
  assert.equal((await w.M.prospectRecevoir(Object.assign({ slug: 'personne' }, F()), T)).raison, 'page');
  // 47 h : rien. 49 h, le lendemain : une relance, notée.
  w.F.lire('push_log/' + COACH);
  await w.db.ref('push_log/' + COACH).remove();
  assert.equal(await w.M.prospectsRelanceHeure(T + 47 * H), true);
  assert.equal(w.F.recus.length, 1);
  assert.equal(await w.M.prospectsRelanceHeure(T + 49 * H), true);
  assert.equal(w.F.recus.length, 2);
  assert.match(tel.lire(w.F.recus[1].init.body).title, /Léa attend ta réponse/);
  assert.equal(Object.values(w.F.lire('prospects/' + COACH))[0].relanceLe, T + 49 * H);
  await w.db.ref('push_log/' + COACH).remove();
  await w.M.prospectsRelanceHeure(T + 50 * H);
  assert.equal(w.F.recus.length, 2, 'pas deux relances pour le même prospect');
});

test('le coach a répondu avant 48 h : rien ne part', async () => {
  const w = monde({ prospects: { [COACH]: { a: { at: T - 50 * H, prenom: 'Léa', contact: '+33612345678', canal: 'tel', formule: 'coaching_essentiel', statut: 'repondu', reponduLe: T - 40 * H } } },
    push: { [COACH]: { x: appareil('https://push.test/kev').abonnement } } }, T);
  await w.M.prospectsRelanceHeure(T);
  assert.equal(w.F.recus.length, 0);
  assert.equal(w.F.lire('prospects/' + COACH + '/a/relanceLe'), null);
});

test('les visites se comptent par jour, pour une page qui existe seulement', async () => {
  const w = monde({ slugs: { 'kevin-guellec': COACH } }, T);
  assert.equal(await w.M.vitrineVue('kevin-guellec', T), true);
  assert.equal(await w.M.vitrineVue('kevin-guellec', T + H), true);
  assert.equal(await w.M.vitrineVue('personne', T), false);
  assert.equal(await w.M.vitrineVue('../users', T), false);
  assert.deepEqual(w.F.lire('vitrines_stats'), { 'kevin-guellec': { '2026-10-06': 2 } });
  assert.ok(travaux({ planifies: {} }).some((x) => x.nom === 'prospects' && x.heure));
});

test('série 6 (lot 9) : la formule libre du coach est acceptée quand elle est complète, et nommée', () => {
  const v = { formules: ['coaching_essentiel'], libre: { lib: 'Pack été', prix: 0, mois: 2, inclus: 'Deux appels' }, prixPerso: { coaching_essentiel: { lib: 'Mon suivi', prix: 59 } } };
  assert.deepEqual(PR.formulesVitrine(v), ['coaching_essentiel', 'libre']);
  assert.equal(PR.libFormuleVitrine(v, 'libre'), 'ta formule « Pack été »');
  assert.equal(PR.libFormuleVitrine(v, 'coaching_essentiel'), 'ta formule « Mon suivi »');
  assert.equal(PR.libFormuleVitrine({ formules: ['coaching_essentiel'] }, 'coaching_essentiel'), '');
  assert.deepEqual(PR.formulesVitrine({ formules: [], libre: { lib: 'Sans prix', mois: 2 } }), []);
  assert.deepEqual(PR.formulesVitrine({ formules: [], libre: { lib: 'x', prix: 9000, mois: 2 } }), []);
  const r = PR.prospectDepuisFormulaire({ prenom: 'Léa', contact: '+33612345678', formule: 'libre', site: '' }, v, {}, Date.UTC(2026, 9, 8));
  assert.equal(r.ok, true);
  assert.equal(r.prospect.formule, 'libre');
});
