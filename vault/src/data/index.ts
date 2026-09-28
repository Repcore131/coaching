import { DexieRepository } from './dexieRepository';
import type { VaultRepository } from './repository';

/** Point unique de choix du stockage. Demain : `new FirebaseRepository(...)`. */
export const repo: VaultRepository = new DexieRepository();
export type { VaultRepository, TransactionInput } from './repository';
