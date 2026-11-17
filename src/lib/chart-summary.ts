// What a screen reader says for a chart: the same conclusion a sighted user reads off the lines.

import { formatMonth, formatPct, formatTL } from './format';

/** "Son 12 ay, bugünün lirasıyla: Altın +%12,4, Dolar −%3,1. 100’ün üstü enflasyonu yendi." */
export function compareSummary(period: string, lines: { label: string; real: number }[]): string {
  if (lines.length === 0) return `${period}: gösterilecek çizgi yok.`;
  const ranked = [...lines].sort((a, b) => b.real - a.real);
  const parts = ranked.map((l) => `${l.label} ${formatPct(l.real)}`).join(', ');
  const best = ranked[0];
  return `${period}, enflasyondan arındırılmış getiri: ${parts}. En iyisi ${best.label}.`;
}

/** "Ekim 2025’ten Kasım 2026’ya görünen değer ₺100.000’den ₺140.000’e çıktı; alım gücü ₺108.000, yani +%8,0." */
export function powerSummary(points: { month: string; nominal: number; real: number }[]): string {
  if (points.length === 0) return 'Grafik için veri yok.';
  const first = points[0];
  const last = points[points.length - 1];
  const change = first.nominal > 0 ? last.real / first.nominal - 1 : 0;
  return (
    `${formatMonth(first.month)} ile ${formatMonth(last.month)} arası: görünen değer ${formatTL(first.nominal)} → ${formatTL(last.nominal)}, ` +
    `başlangıç fiyatlarıyla alım gücü ${formatTL(last.real)}. Alım gücün ${change >= 0 ? 'arttı' : 'azaldı'}: ${formatPct(change)}.`
  );
}
