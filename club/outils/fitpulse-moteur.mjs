/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
// Moteur d'import côté serveur : le VRAI code de l'appli (resamania-core.js et ses lecteurs),
// chargé sans navigateur par chargerAppli. Même analyse, même plan, mêmes clés de saisie
// qu'un dépôt à la main dans l'écran Imports.
import { chargerAppli } from './fitpulse-rapport.mjs';

export function creerMoteur({ lireEtat, maintenant = () => Date.now() }) {
  return {
    async planifier(clubId, bytes, name, by) {
      const S = await lireEtat(); const run = chargerAppli(S, { libs: true }); run.ctx.__fpBuf = new Uint8Array(bytes);
      return JSON.parse(await run(`(async () => {
        const B = await analyzeFile(__fpBuf, ${JSON.stringify(name)}, { clubId: ${JSON.stringify(clubId)}, state: S });
        const P = planImport(B, S, {}, { club: ${JSON.stringify(clubId)}, by: ${JSON.stringify(by)}, now: ${Number(maintenant())} });
        const lignes = {}; P.pending.filter(p => p.kind === 'seller').forEach(p => { lignes[p.keys[0]] = lignesVendeur(B, p.keys); });
        return JSON.stringify({ ops: P.ops, summary: P.summary, pending: P.pending, lignes, rowsRead: B.reduce((s, r) => s + (r.rowsCount || 0), 0), warnings: B.flatMap(r => (r.warnings || []).map(w => r.name + ' : ' + w)).slice(0, 20) });
      })()`));
    },
    async rejouer(attente, uid, clubId, by) {
      const S = await lireEtat(); const run = chargerAppli(S);
      return JSON.parse(run(`JSON.stringify(rejouerOps(${JSON.stringify(attente)}, ${JSON.stringify(uid)}, { club: ${JSON.stringify(clubId)}, by: ${JSON.stringify(by)}, now: ${Number(maintenant())}, state: S }))`));
    },
  };
}
