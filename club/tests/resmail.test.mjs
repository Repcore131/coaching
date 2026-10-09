// Relève des demandes de résiliation : logique serveur sans réseau (Gmail simulé).
//   node club/tests/resmail.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { requeteGmail, analyserFil, rapprocher, passageResiliations, aPurger, SNIPPET_MAX } from '../outils/fitpulse-resmail.mjs';

const H = 3600000, NOW = Date.UTC(2026, 9, 9, 12);
const msg = (id, at, from, { sent = false, subject = 'Résiliation', snippet = 'Bonjour, je souhaite résilier mon abonnement.' } = {}) => ({ id, threadId: 't1', internalDate: String(at), labelIds: sent ? ['SENT'] : ['INBOX'], snippet, payload: { headers: [{ name: 'From', value: from }, { name: 'Subject', value: subject }] } });
function fauxGmail(fils) { return { profil: async () => ({ emailAddress: 'accueil@club.fr' }), fils: async () => Object.keys(fils), fil: async id => ({ id, messages: fils[id] }) }; }
function fausseBase(S) {
  const ecrits = [];
  const api = async (tk, chemin, opts = {}) => {
    const body = opts.body ? JSON.parse(opts.body) : null; ecrits.push({ chemin, method: opts.method, body });
    // chemin sans « pulse/ »
    const p = chemin.replace(/\.json$/, '').split('/').slice(1); let o = S; for (const k of p.slice(0, -1)) o = o[k] = o[k] || {};
    const k = p[p.length - 1]; if (opts.method === 'PATCH') o[k] = { ...(o[k] || {}), ...body }; else if (opts.method === 'PUT') o[k] = body;
    return { ok: true, json: async () => null };
  };
  return { api, ecrits };
}
const base = () => ({ clubs: { niort: { id: 'niort', mailSources: { inbox: 'accueil@club.fr', appli: 'no-reply@appli.fr' } } }, clients: { c1: { id: 'c1', clubId: 'niort', name: 'Julie Perrin', email: 'julie@exemple.fr' } } });
const comptes = { niort: { clientId: 'x', clientSecret: 'y', refreshToken: 'z' } };

test('requête : mots-clés, 30 jours, expéditeur de l’appli', () => {
  const q = requeteGmail({ appli: 'no-reply@appli.fr' });
  assert.match(q, /newer_than:30d/); assert.match(q, /résilier/); assert.match(q, /"arrêter mon abonnement"/); assert.match(q, /from:no-reply@appli\.fr/);
});

test('mail test « Je souhaite résilier mon abonnement » : une demande à traiter', async () => {
  const S = base(); const { api } = fausseBase(S);
  const fils = { t1: [msg('m1', NOW - 2 * H, 'Julie Perrin <julie@exemple.fr>', { snippet: 'Je souhaite résilier mon abonnement' })] };
  const res = await passageResiliations(api, 'tk', S, { gmailPour: async () => fauxGmail(fils), comptes, now: NOW, log: null });
  assert.doesNotMatch(res, /échec/, res);
  const r = S.resRequests.niort.t1;
  assert.equal(r.status, 'a_traiter'); assert.equal(r.channel, 'mail'); assert.equal(r.clientId, 'c1');
  assert.equal(r.snippet, 'Je souhaite résilier mon abonnement'); assert.equal(r.receivedAt, NOW - 2 * H);
  assert.match(r.gmailLink, /^https:\/\/mail\.google\.com\/mail\/\?authuser=accueil%40club\.fr#all\/t1$/);
  assert.equal(S.resRequestsMeta.niort.lastRunAt, NOW);
});

test('relire deux fois le même fil : aucun doublon, le travail de l’équipe est gardé', async () => {
  const S = base(); const { api } = fausseBase(S);
  const fils = { t1: [msg('m1', NOW - 2 * H, 'julie@exemple.fr')] };
  await passageResiliations(api, 'tk', S, { gmailPour: async () => fauxGmail(fils), comptes, now: NOW, log: null });
  S.resRequests.niort.t1.status = 'contacte'; S.resRequests.niort.t1.ownerId = 'u3';
  await passageResiliations(api, 'tk', S, { gmailPour: async () => fauxGmail(fils), comptes, now: NOW + 2 * H, log: null });
  assert.deepEqual(Object.keys(S.resRequests.niort), ['t1']);
  assert.equal(S.resRequests.niort.t1.status, 'contacte'); assert.equal(S.resRequests.niort.t1.ownerId, 'u3');
});

test('une relève par heure au plus', async () => {
  const S = base(); S.resRequestsMeta = { niort: { lastRunAt: NOW - 20 * 60000 } }; const { api, ecrits } = fausseBase(S);
  const r = await passageResiliations(api, 'tk', S, { gmailPour: async () => { throw new Error('ne doit pas être appelé'); }, comptes, now: NOW, log: null });
  assert.match(r, /déjà relevé/); assert.equal(ecrits.length, 0);
});

test('réponse de l’accueil dans le fil : lastReplyAt', () => {
  const d = analyserFil({ messages: [msg('m1', NOW - 50 * H, 'a@b.fr'), msg('m2', NOW - 3 * H, 'Accueil <accueil@club.fr>', { sent: true })] }, { boite: 'accueil@club.fr' });
  assert.equal(d.lastReplyAt, NOW - 3 * H); assert.equal(d.lastInboundAt, NOW - 50 * H);
});

test('fil sans message reçu (envoi de l’accueil seul) : ignoré', () => {
  assert.equal(analyserFil({ messages: [msg('m1', NOW, 'accueil@club.fr', { sent: true })] }, { boite: 'accueil@club.fr' }), null);
});

test('appli adhérents : canal appli, rapprochement par le nom dans le corps', () => {
  const d = analyserFil({ messages: [msg('m1', NOW, 'Appli <no-reply@appli.fr>', { snippet: 'Demande de résiliation. Nom : Julie Perrin. Motif : déménagement' })] }, { boite: 'accueil@club.fr', sources: { appli: 'no-reply@appli.fr' } });
  assert.equal(d.channel, 'appli'); assert.equal(rapprocher(base().clients, 'niort', d), 'c1');
});

test('extrait limité à 200 caractères, entités décodées', () => {
  const d = analyserFil({ messages: [msg('m1', NOW, 'a@b.fr', { snippet: 'L&#39;abonnement ' + 'x'.repeat(400) })] }, { boite: 'accueil@club.fr' });
  assert.equal(d.snippet.length, SNIPPET_MAX); assert.ok(d.snippet.startsWith('L\'abonnement'));
});

test('RGPD : extrait purgé 90 jours après traitement, jamais avant', () => {
  assert.equal(aPurger({ snippet: 'x', status: 'sauve', treatedAt: NOW - 91 * 24 * H }, NOW), true);
  assert.equal(aPurger({ snippet: 'x', status: 'sauve', treatedAt: NOW - 89 * 24 * H }, NOW), false);
  assert.equal(aPurger({ snippet: 'x', status: 'a_traiter' }, NOW), false);
});

test('aucun jeton OAuth dans le code client', () => {
  const dir = new URL('../', import.meta.url);
  for (const f of readdirSync(dir).filter(f => /\.(js|html)$/.test(f))) assert.doesNotMatch(readFileSync(new URL(f, dir), 'utf8'), /refresh_token|GMAIL_(CLIENT|TOKENS|REFRESH)|ya29\.|client_secret/i, f);
});
