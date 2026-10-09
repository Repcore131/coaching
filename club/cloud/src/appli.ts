/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. */
// Modules purs de l'appli partagés avec le serveur (moteur-mail.js, res-moteur.js) : copiés dans
// lib/app au déploiement, lus à leur place d'origine en test.
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';

const caches = new Map<string, any>();
export function charger(fichier: string): any {
  if (caches.has(fichier)) return caches.get(fichier);
  const req = createRequire(import.meta.url);
  for (const p of ['../app/', '../../', '../../../']) { const u = new URL(p + fichier, import.meta.url); if (existsSync(u)) { const m = req(u.pathname); caches.set(fichier, m); return m; } }
  throw new Error(fichier + ' introuvable');
}
export const moteurMail = () => charger('moteur-mail.js');
export const moteurRes = () => charger('res-moteur.js');
