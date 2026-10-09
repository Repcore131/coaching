/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. */
// Moteur de détection des demandes de résiliation (moteur-mail.js) : 12 e-mails anonymisés.
// Lancement : cd club/cloud && npm run test:moteur (Vitest, globals).
/* global describe, test, expect */
import { createRequire } from 'node:module';
const M = createRequire(import.meta.url)('../moteur-mail.js');

const VRAIES = {
  'mail libre': 'De : Claire Exemple <claire.exemple@mail.fr>\nObjet : Résiliation\nBonjour, je souhaite résilier mon abonnement car je pars vivre à Bordeaux, je déménage le mois prochain.\nCordialement\nClaire Exemple',
  'notification avec champs': 'De : Logiciel <noreply@resamania.com>\nObjet : Nouvelle demande de résiliation\nUne demande de résiliation a été saisie.\nPrénom : Marc\nNom : Exemple\nNuméro client : 778899\nCanal de saisie : Application',
  'formulaire du site': 'De : Site du club <contact@site-club.fr>\nObjet : Message de contact via le site\nNom : Exemple\nPrénom : Lea\nEmail : lea.exemple@mail.fr\nMessage : je voudrais arrêter mon abonnement, c est devenu trop cher pour moi.',
  'demande de suspension': 'De : Hugo Exemple <hugo.exemple@mail.fr>\nObjet : Pause\nBonjour, suite à une blessure au genou je voudrais suspendre mon abonnement pendant deux mois.\nHugo Exemple',
  'demande en anglais': 'From : Sam Example <sam.example@mail.com>\nSubject : Membership\nHello, I would like to cancel my membership, I am moving abroad next month.\nSam Example',
  'date à compter du': 'De : Nina Exemple <nina.exemple@mail.fr>\nObjet : Fin de contrat\nBonjour, merci de résilier mon abonnement à compter du 1er décembre. Mon numéro adhérent est 554433.\nNina Exemple',
};
const FAUSSES = {
  newsletter: 'De : Lettre du club <news@marque.fr>\nObjet : Newsletter d octobre\nNos conseils pour ne jamais résilier votre motivation. Offre spéciale ce mois-ci. Pour vous désabonner : se désabonner.',
  'facture fournisseur': 'De : Compta <factures@fournisseur-materiel.fr>\nObjet : Facture 2026-1042\nVeuillez trouver la facture de votre abonnement de maintenance. Montant HT : 420 euros. Conditions de résiliation au verso.',
  'alerte technique': 'De : Supervision <alerte@hebergeur.fr>\nObjet : Alerte serveur\nIncident technique : échec de synchronisation du module résiliation, erreur 502 sur le webhook.',
  candidature: 'De : Julie Exemple <julie.exemple@mail.fr>\nObjet : Candidature\nBonjour, je vous adresse ma candidature pour le poste de coach, vous trouverez mon CV en pièce jointe.',
  'mail interne': 'De : Direction <direction@club.fr>\nObjet : Réunion lundi\nOrdre du jour : chiffres du mois, taux de résiliation et planning des cours.',
  'contrat d assurance du club': 'De : Cabinet Exemple <contact@courtier-exemple.fr>\nObjet : Votre contrat multirisque\nNous accusons réception de la résiliation de votre contrat d assurance multirisque du local, effective à l échéance.',
};
const prochain1erDecembre = (d = new Date()) => { let y = d.getFullYear(); if (new Date(y, 11, 1) < d) y++; return `${y}-12-01`; };

describe('MAIL_ENGINE', () => {
  test.each(Object.entries(VRAIES))('demande réelle détectée : %s', (nom, txt) => {
    const r = M.testMailRules(txt); expect(r.retenu, `${nom} : score ${r.score}`).toBe(true);
    expect(M.RAISONS).toContain(r.motif);
  });
  test.each(Object.entries(FAUSSES))('faux positif sous le seuil : %s', (nom, txt) => {
    const r = M.testMailRules(txt); expect(r.score, `${nom} : ${r.signals.join(', ')}`).toBeLessThan(r.seuil);
  });
  test('6 sur 6 détectées, 0 faux positif au-dessus du seuil', () => {
    expect(Object.values(VRAIES).filter(t => M.testMailRules(t).retenu).length).toBe(6);
    expect(Object.values(FAUSSES).filter(t => M.testMailRules(t).retenu).length).toBe(0);
  });
  test('champs extraits', () => {
    const n = M.testMailRules(VRAIES['notification avec champs']); expect(n.kind).toBe('notification'); expect(n.clientNum).toBe('778899'); expect(n.name).toBe('Marc Exemple');
    expect(M.testMailRules(VRAIES['formulaire du site']).kind).toBe('formulaire');
    expect(M.testMailRules(VRAIES['formulaire du site']).motif).toBe('Prix');
    const s = M.testMailRules(VRAIES['demande de suspension']); expect(s.type).toBe('suspension'); expect(s.motif).toBe('Santé');
    expect(M.testMailRules(VRAIES['demande en anglais']).motif).toBe('Déménagement');
    expect(M.testMailRules(VRAIES['mail libre']).name).toBe('Claire Exemple');
  });
  test('« à compter du 1er décembre » : prochain 1er décembre, AAAA-MM-JJ', () => {
    const d = M.testMailRules(VRAIES['date à compter du']).effective; expect(d).toBe(prochain1erDecembre()); expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(M.dateEffet('a compter du 1er decembre', new Date(2026, 11, 15))).toBe('2027-12-01');
  });
  test('motif hors liste : Autre ; santé sans détail', () => {
    expect(M.motif('je souhaite resilier')).toBe('Autre'); expect(M.motifValide('Problème de genou')).toBe('Autre');
    expect(M.motif('je suis enceinte, je dois resilier')).toBe('Santé');
  });
  test('score 2 : fil transmis à vérifier (review)', () => {
    const C = M.compile({ keywords: [{ re: 'question sur mon contrat', w: 2, tag: 'question' }], negatives: [] });
    const f = M.analyseFil('t1', [{ at: 1, out: false, from: { name: 'A Exemple', email: 'a@mail.fr' }, subject: 'Question sur mon contrat', body: 'Bonjour, une question sur mon contrat.' }], 'accueil@club.fr', C);
    expect(f.review).toBe(true); expect(f.score).toBe(2);
    const g = M.analyseFil('t2', [{ at: 1, out: false, from: { name: 'A Exemple', email: 'a@mail.fr' }, subject: 'Bonjour', body: 'Rien à signaler.' }], 'accueil@club.fr', C);
    expect(g).toBe(null);
  });
});
