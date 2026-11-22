// What an import will do to the portfolio: one line per asset, nothing added twice. Lots the app
// already has are recognised; when the file merges several buys of a stock, the separate lines
// already in the app (and an earlier merged line of the same buys) are replaced by the new one.

import { lotKey, mergeLots, sameLot, type ImportRow } from './spreadsheet';
import type { Holding } from './types';

export type ImportPlan = {
  /** rows to show in the preview */
  rows: ImportRow[];
  /** holdings to add */
  add: Holding[];
  /** ids of holdings in the app that the merged lines replace */
  replace: string[];
  /** lines the app already has, left as they are */
  already: number;
};

export function planImport(rows: ImportRow[], existing: Holding[]): ImportPlan {
  const pool = [...existing];
  const take = (h: Holding) => {
    const i = pool.findIndex((x) => sameLot(x, h));
    return i < 0 ? undefined : pool.splice(i, 1)[0];
  };
  // Which of the file's own buys are already saved, each saved lot matched once.
  const saved = new Map<ImportRow, Holding | undefined>();
  for (const r of rows) if (r.holding) saved.set(r, take(r.holding));

  const add: Holding[] = [];
  const replace: string[] = [];
  let already = 0;
  const skip = (r: ImportRow): ImportRow => {
    already += 1;
    return { ...r, holding: undefined, note: `${r.holding!.name}: zaten ekli; tekrar eklenmedi.`, routine: true };
  };

  const out = mergeLots(rows).map((r) => {
    if (!r.holding) return r;
    const h = r.holding;
    const group = h.kind === 'deposit' ? [] : rows.filter((o) => o.holding && o.holding.kind !== 'deposit' && lotKey(o.holding) === lotKey(h));
    if (group.length < 2) {
      const original = rows.find((o) => o.line === r.line);
      if (original && saved.get(original)) return skip(r);
      add.push(h);
      return r;
    }
    // A merged line: the separate buys already in the app, and a merged line saved before, give way.
    const separate = group.map((o) => saved.get(o)?.id).filter((id): id is string => !!id);
    const earlier = take(h);
    if (earlier && separate.length === 0) return skip(r);
    const gone = [...separate, ...(earlier ? [earlier.id] : [])];
    replace.push(...gone);
    add.push(h);
    return gone.length > 0 ? { ...r, note: `${r.note} Uygulamadaki ${gone.length} ayrı satırın yerine geçecek.` } : r;
  });
  return { rows: out, add, replace, already };
}
