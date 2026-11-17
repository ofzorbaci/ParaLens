// Shared pieces of the add/edit holding form (src/app/holding/edit.tsx).

import { isCurrencyKind, type HoldingKind } from '@/lib/types';

/** The asset-type chips: currencies share one chip ("Döviz"). */
export type Group = 'deposit' | 'fx' | 'gold' | 'fund' | 'stock' | 'usStock' | 'etf' | 'crypto' | 'other';

export const GROUPS: { value: Group; label: string }[] = [
  { value: 'deposit', label: 'Mevduat' },
  { value: 'fx', label: 'Döviz' },
  { value: 'gold', label: 'Altın' },
  { value: 'fund', label: 'Fon' },
  { value: 'stock', label: 'Hisse' },
  { value: 'usStock', label: 'ABD hisse' },
  { value: 'etf', label: 'ETF' },
  { value: 'crypto', label: 'Kripto' },
  { value: 'other', label: 'Diğer' },
];

export function groupOf(kind: HoldingKind): Group {
  return isCurrencyKind(kind) ? 'fx' : kind;
}

/** 38.25 → "38,25" for a text field; undefined → "". */
export function numText(n: number | undefined): string {
  return n === undefined ? '' : String(n).replace('.', ',');
}

/** Field errors, by field; shown once the user has tried to save. */
export type FormErrors = Partial<Record<string, string | undefined>>;
