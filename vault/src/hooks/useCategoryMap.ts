import { useMemo } from 'react';
import type { Category, Kind } from '../domain/types';
import { useVaultData } from './useVaultData';

export function useCategoryMap() {
  const { categories } = useVaultData();
  return useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
}

export function useActiveCategories(kind: Kind): Category[] {
  const { categories } = useVaultData();
  return useMemo(() => categories.filter((c) => c.kind === kind && !c.archived), [categories, kind]);
}
