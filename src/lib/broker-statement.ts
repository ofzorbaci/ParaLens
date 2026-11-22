// Broker cash statements ("Hesap Ekstresi" PDF), e.g. Osmanlı Yatırım. Every stock trade is one
// ledger line: "08/01/2026 06/01 SNGYO 1.063x4,61 Satış 0,00 4.900,43 4.835,29" (booking date,
// trade date, ticker, quantity × price, side). Fees, interest and margin lines are ignored. The
// trades go through the spreadsheet importer, so sells are subtracted the same way (FIFO).

import { parseAmount } from './format';
import { rowsToHoldings, type ImportRow } from './spreadsheet';

const TRADE = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2})\/(\d{2})\s+([A-ZÇĞİÖŞÜ0-9]{3,6})\s+([\d.,]+)\s*(?:Adet\s*)?x\s*([\d.,]+)\s+(Alış|Satış)(?=\s|$)/;
const DIVIDEND = /^(\d{2})\/(\d{2})\/(\d{4})\s+(?:\d{2}\/\d{2}\s+)?([A-ZÇĞİÖŞÜ0-9]{3,6})\s+([\d.,]+)\s+Adet\s+%[\d.,]+\s+Temettü/;

type Trade = { date: string; name: string; quantity: string; price: string; side: 'Alış' | 'Satış' };
type Dividend = { date: string; name: string; quantity: number };

/** The trade date's year: a trade on 31/12 booked on 02/01 belongs to the year before. */
function tradeDate(bookDay: string, bookMonth: string, bookYear: string, day: string, month: string): string {
  const year = Number(month) > Number(bookMonth) ? Number(bookYear) - 1 : Number(bookYear);
  return `${year}-${month}-${day}`;
}

function read(lines: string[]): { trades: Trade[]; dividends: Dividend[] } {
  const trades: Trade[] = [];
  const dividends: Dividend[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    const t = TRADE.exec(line);
    if (t) {
      trades.push({ date: tradeDate(t[1], t[2], t[3], t[4], t[5]), name: t[6], quantity: t[7], price: t[8], side: t[9] as Trade['side'] });
      continue;
    }
    const d = DIVIDEND.exec(line);
    const quantity = d ? parseAmount(d[5]) : undefined;
    if (d && quantity) dividends.push({ date: `${d[3]}-${d[2]}-${d[1]}`, name: d[4], quantity });
  }
  return { trades, dividends };
}

/** True when the PDF looks like a broker statement with at least one stock trade. */
export function isBrokerStatement(lines: string[]): boolean {
  return read(lines).trades.length > 0;
}

/**
 * Stocks held today from a broker statement. A statement covers a date range, so shares bought
 * before it start show up only as sells or dividends; those get a note asking the user to add
 * them with their own cost instead of being guessed.
 */
export function parseBrokerStatement(lines: string[], today: string, id: () => string): ImportRow[] {
  const { trades, dividends } = read(lines);
  const rows: unknown[][] = [['Tarih', 'Sembol', 'İşlem', 'Adet', 'Fiyat'], ...trades.map((t) => [t.date, t.name, t.side, t.quantity, t.price])];
  const out = rowsToHoldings(rows, today, id);

  // A dividend on more shares than the statement had bought by then: the rest predates the file.
  const seen = new Set<string>();
  let line = rows.length + 1;
  for (const d of [...dividends].sort((a, b) => b.date.localeCompare(a.date))) {
    if (seen.has(d.name)) continue;
    seen.add(d.name);
    const net = trades
      .filter((t) => t.name === d.name && t.date <= d.date)
      .reduce((sum, t) => sum + (parseAmount(t.quantity) ?? 0) * (t.side === 'Alış' ? 1 : -1), 0);
    const missing = d.quantity - Math.max(0, net);
    if (missing > 1e-9) {
      line += 1;
      out.push({
        line,
        errors: [],
        note: `${d.name}: temettü gününde ${fmt(d.quantity)} adetin varmış, bu dosyada ${fmt(missing)} adetin alışı yok. Elindeyse alış tarihi ve maliyetiyle ayrıca ekle.`,
      });
    }
  }
  return out;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 }).format(n);
}
