// Base en mémoire (get / update multi-chemins), pour les tests sans émulateur.
import type { Db } from '../../src/ingestCore.js';
export class MemDb implements Db {
  data: any = {};
  constructor(init: any = {}) { this.data = JSON.parse(JSON.stringify(init)); }
  async get(p: string) { let o = this.data; for (const k of p.split('/').filter(Boolean)) { if (o == null) return null; o = o[k]; } return o === undefined ? null : JSON.parse(JSON.stringify(o)); }
  async update(m: Record<string, unknown>) {
    for (const [p, v] of Object.entries(m)) {
      const ks = p.split('/').filter(Boolean); let o = this.data;
      for (const k of ks.slice(0, -1)) { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }
      const last = ks[ks.length - 1]; if (v === null || v === undefined) delete o[last]; else o[last] = JSON.parse(JSON.stringify(v));
    }
  }
}
