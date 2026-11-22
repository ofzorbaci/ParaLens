import { describe, expect, it } from 'vitest';

import { planImport } from '../import-plan';
import { rowsToHoldings } from '../spreadsheet';
import type { Holding } from '../types';

const today = '2026-11-22';
let n = 0;
const id = () => `id${++n}`;

const FILE = [
  ['Sembol', 'İşlem Tipi', 'Adet', 'Alış Fiyatı', 'Tarih'],
  ['HLGYO', 'Alış', 11, 6.1, '06.05.2026'],
  ['HLGYO', 'Alış', 500, 6.3, '03.06.2026'],
  ['BIMAS', 'Alış', 10, 376.5, '03.06.2026'],
];
const lot = (name: string, quantity: number, unitCost: number, buyDate: string): Holding => ({
  id: id(),
  kind: 'stock',
  name,
  quantity,
  unitCost,
  buyDate,
});

describe('planning an import', () => {
  it('adds one line per stock into an empty portfolio', () => {
    const p = planImport(rowsToHoldings(FILE, today, id), []);
    expect(p.add.map((h) => [h.name, h.quantity])).toEqual([
      ['HLGYO', 511],
      ['BIMAS', 10],
    ]);
    expect(p.replace).toEqual([]);
  });

  it('replaces the separate lines an earlier import left behind', () => {
    const old = [lot('HLGYO', 11, 6.1, '2026-05-06'), lot('HLGYO', 500, 6.3, '2026-06-03'), lot('BIMAS', 10, 376.5, '2026-06-03')];
    const p = planImport(rowsToHoldings(FILE, today, id), old);
    expect(p.add.map((h) => [h.name, h.quantity])).toEqual([['HLGYO', 511]]);
    expect(p.replace).toEqual([old[0].id, old[1].id]);
    expect(p.already).toBe(1);
    expect(p.rows.find((r) => r.holding)?.note).toMatch(/2 ayrı satırın yerine geçecek/);
  });

  it('also replaces a merged line saved next to the old separate lines', () => {
    const first = planImport(rowsToHoldings(FILE, today, id), []).add[0];
    const old = [lot('HLGYO', 11, 6.1, '2026-05-06'), lot('HLGYO', 500, 6.3, '2026-06-03'), { ...first, id: id() }];
    const p = planImport(rowsToHoldings(FILE, today, id), old);
    expect(p.replace).toEqual([old[0].id, old[1].id, old[2].id]);
    expect(p.add.filter((h) => h.name === 'HLGYO')).toHaveLength(1);
  });

  it('adds nothing when the same file is imported again', () => {
    const saved = planImport(rowsToHoldings(FILE, today, id), []).add.map((h) => ({ ...h, id: id() }));
    const p = planImport(rowsToHoldings(FILE, today, id), saved);
    expect(p.add).toEqual([]);
    expect(p.replace).toEqual([]);
    expect(p.already).toBe(2);
  });

  it('leaves a hand-entered lot with another date alone', () => {
    const own = lot('HLGYO', 100, 5, '2025-01-10');
    const p = planImport(rowsToHoldings(FILE, today, id), [own]);
    expect(p.replace).toEqual([]);
    expect(p.add.find((h) => h.name === 'HLGYO')?.quantity).toBe(511);
  });
});
