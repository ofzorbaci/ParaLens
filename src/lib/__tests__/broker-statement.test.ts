import { describe, expect, it } from 'vitest';

import { isBrokerStatement, parseBrokerStatement } from '../broker-statement';

const today = '2026-11-22';
let n = 0;
const id = () => `id${++n}`;

// Made-up lines in the shape of a broker's "Hesap Ekstresi"; no real account data.
const LINES = [
  'HESAP EKSTRESİ',
  'Tarih Açıklama Borç Alacak Bakiye',
  '02/01/2026 31/12 KCHOL 20x150,00 Alış 3.000,00 0,00 -3.000,00',
  '05/01/2026 05/01 Nema Stopaj (23,32 TL) 4,08 0,00 -60,67',
  '08/01/2026 06/01 BIST Komisyon ve BMV (İşlem Hacmi : 4.900,43) 1,54 0,00 -64,98',
  '08/01/2026 06/01 SNGYO 1.063x4,61 Satış 0,00 4.900,43 4.835,29',
  '21/04/2026 21/04 THYAO 15 Adetx300,00 Alış 4.500,00 0,00 0,00',
  '24/04/2026 24/04 THYAO 5 Adetx320,50 Satış 0,00 1.602,50 0,00',
  '23/07/2026 23/07 FROTO 10 Adetx80,70 Alış 807,00 0,00 0,00',
  '23/07/2026 23/07 FROTO 10 Adetx81,40 Satış 0,00 814,00 0,00',
  '23/07/2026 23/07 FROTO 10 xAlışOrt 80,768 AçSat Tl Kapat 0,00 0,00 0,00',
  '12/06/2026 EREGL 14.156 Adet %46,75 Temettü 0,00 6.617,93 0,00',
  '12/06/2026 14.156,000 Adet EREGL,%46,75 Temettü İşlem Ücreti 5,00 0,00 0,00',
  '15/05/2026 THYAO 10 Adet %100 Temettü 0,00 100,00 0,00',
];

// The newer layout: booking and value dates, the line type, then the trade; newest first.
const NEW_LAYOUT = [
  'Hesap Ekstresi',
  '20/11/2026 20/11/2026 Nakit 20/11 Nema Stopaj (Brüt: 14,53) -2,54 9.686,34',
  '19/10/2026 19/10/2026 Menkul KCHOL 25 Adet %186,2475 Temettü 9,31 9.785,08',
  '19/09/2026 19/09/2026 Menkul 18/09 THYAO 5 Adetx255,50 Satış 1.277,50 9.850,05',
  '18/09/2026 18/09/2026 Menkul 17/09 THYAO 15 Adetx252,50 Alış -3.787,50 9.860,29',
  '14/09/2026 14/09/2026 Menkul 14/09 FROTO 20 xAlışOrt 82,134 AçSat Tl Kapat 1.642,68 14.220,18',
  '01/09/2026 01/09/2026 Nakit Kredilendirme Sonu, Cari Kredi Aktarimi -1.276,78 8.571,38',
];

describe('broker statement PDF', () => {
  it('reads the newer layout with value dates and line types', () => {
    expect(isBrokerStatement(NEW_LAYOUT)).toBe(true);
    const r = parseBrokerStatement(NEW_LAYOUT, today, id);
    expect(r.filter((x) => x.holding).map((x) => x.holding)).toEqual([
      expect.objectContaining({ name: 'THYAO', quantity: 10, unitCost: 252.5, buyDate: '2026-09-17' }),
    ]);
    expect(r.map((x) => x.note).join(' | ')).toMatch(/KCHOL: temettü gününde 25 adetin varmış/);
  });

  it('recognises a statement with trades and nothing else', () => {
    expect(isBrokerStatement(LINES)).toBe(true);
    expect(isBrokerStatement(['Fatura', '01/01/2026 Market 100,00'])).toBe(false);
  });

  it('keeps what is held today and explains the rest', () => {
    const r = parseBrokerStatement(LINES, today, id);
    const held = r.filter((x) => x.holding).map((x) => x.holding!);
    expect(held).toEqual([
      expect.objectContaining({ kind: 'stock', name: 'KCHOL', quantity: 20, unitCost: 150, buyDate: '2025-12-31' }),
      expect.objectContaining({ kind: 'stock', name: 'THYAO', quantity: 10, unitCost: 300, buyDate: '2026-04-21' }),
    ]);
    const notes = r.map((x) => x.note).filter(Boolean).join('\n');
    expect(notes).toMatch(/SNGYO: 1\.063 adet satışın alışı dosyada yok/);
    expect(notes).toMatch(/EREGL: temettü gününde 14\.156 adetin varmış, bu dosyada 14\.156 adetin alışı yok/);
    expect(notes).not.toMatch(/THYAO: temettü/);
    expect(r.every((x) => x.errors.length === 0)).toBe(true);
  });
});

describe('other brokers’ usual wording', () => {
  it('reads upper case, Alım/Satım, "Adet x", "@", the side first and dotted dates', () => {
    const lines = [
      '05.02.2026 THYAO 20 Adet x 300,00 ALIŞ -6.000,00 1.000,00',
      '06.02.2026 06.02.2026 ALIM KCHOL 10 Lot x 150,50 -1.505,00 0,00',
      '07-03-2026 SATIŞ THYAO 5 ADET X 320,00 1.600,00 0,00',
      '08/04/2026 07/04 SISE 100 @ 40,00 Alım -4.000,00 0,00',
      '09/04/2026 SISE 40x45,00 Satım 1.800,00 0,00',
    ];
    const r = parseBrokerStatement(lines, today, id);
    expect(r.filter((x) => x.holding).map((x) => [x.holding!.name, x.holding!.quantity, x.holding!.unitCost, x.holding!.buyDate])).toEqual([
      ['THYAO', 15, 300, '2026-02-05'],
      ['KCHOL', 10, 150.5, '2026-02-06'],
      ['SISE', 60, 40, '2026-04-07'],
    ]);
  });

  it('ignores fee, interest and short-close lines', () => {
    expect(
      isBrokerStatement([
        '14/09/2026 14/09/2026 Menkul 14/09 FROTO 20 xAlışOrt 82,134 AçSat Tl Kapat 1.642,68 14.220,18',
        '08/01/2026 06/01 BIST Komisyon ve BMV (İşlem Hacmi : 4.900,43) 1,54 0,00 -64,98',
        '20/11/2026 20/11/2026 Nakit 20/11 Nema Stopaj (Brüt: 14,53) -2,54 9.686,34',
      ]),
    ).toBe(false);
  });
});
