// Premium: several portfolios. Holdings carry a `portfolioId`; undefined is the main portfolio.

import type { Portfolio } from '@/lib/types';
import { newId } from '@/lib/ids';
import { replaceData, storeSnapshot, updateSettings } from '@/state/store';

/** Shows another portfolio on the summary; undefined is the main one. */
export function selectPortfolio(id: string | undefined) {
  updateSettings({ activePortfolio: id });
}

/** A new, empty portfolio, selected right away. */
export function addPortfolio(name: string): Portfolio {
  const p = { id: newId(), name: name.trim() || 'Yeni portföy' };
  updateSettings({ portfolios: [...(storeSnapshot().settings.portfolios ?? []), p], activePortfolio: p.id });
  return p;
}

export function renamePortfolio(id: string, name: string) {
  const portfolios = storeSnapshot().settings.portfolios ?? [];
  updateSettings({ portfolios: portfolios.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)) });
}

/** Removes a portfolio together with its holdings. */
export function deletePortfolio(id: string) {
  const { allHoldings, settings } = storeSnapshot();
  replaceData(
    allHoldings.filter((h) => h.portfolioId !== id),
    {
      ...settings,
      portfolios: (settings.portfolios ?? []).filter((p) => p.id !== id),
      activePortfolio: settings.activePortfolio === id ? undefined : settings.activePortfolio,
    },
  );
}
