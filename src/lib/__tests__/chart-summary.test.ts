import { describe, expect, it } from 'vitest';

import { compareSummary, powerSummary } from '../chart-summary';

describe('chart summaries for screen readers', () => {
  it('ranks the comparison lines and names the best', () => {
    const s = compareSummary('Son 12 ay', [
      { label: 'Dolar', real: -0.031 },
      { label: 'Altın', real: 0.124 },
    ]);
    expect(s).toBe('Son 12 ay, enflasyondan arındırılmış getiri: Altın +%12,4, Dolar −%3,1. En iyisi Altın.');
    expect(compareSummary('Son 3 ay', [])).toBe('Son 3 ay: gösterilecek çizgi yok.');
  });

  it('describes the purchasing-power chart from first to last month', () => {
    const s = powerSummary([
      { month: '2025-10', nominal: 100_000, real: 100_000 },
      { month: '2026-10', nominal: 140_000, real: 108_000 },
    ]);
    expect(s).toBe(
      'Ekim 2025 ile Ekim 2026 arası: görünen değer ₺100.000 → ₺140.000, başlangıç fiyatlarıyla alım gücü ₺108.000. Alım gücün arttı: +%8,0.',
    );
  });
});
