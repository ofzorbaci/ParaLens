// Broker cash statements ("Hesap Ekstresi" PDF). Built on Osmanlı Yatırım's two layouts and
// tolerant of the usual variants (upper case, Alım/Satım, "Adet x", "@", side first, no trade
// date); other brokers are not verified until we have one of their statements. Every trade is one
// ledger line: "08/01/2026 06/01 SNGYO 1.063x4,61 Satış 0,00 4.900,43 4.835,29" (booking date,
// trade date, ticker, quantity × price, side), or in the newer layout
// "19/09/2026 19/09/2026 Menkul 18/09 ASTOR 5 Adetx255,50 Satış 1.277,50 9.850,05".
// Fees, interest and margin lines are ignored. The trades go through the spreadsheet importer,
// so sells are subtracted the same way (FIFO).

import { parseAmount } from './format';
import { rowsToHoldings, type ImportRow } from './spreadsheet';

// Booking date (dd/mm/yyyy, dd.mm.yyyy or dd-mm-yyyy), then optionally a value date and the line
// type ("Menkul", "Nakit"), then the trade itself, with or without its own dd/mm trade date.
const DATE = String.raw`(\d{2})[./-](\d{2})[./-](\d{4})`;
const LEAD = String.raw`^${DATE}\s+(?:\d{2}[./-]\d{2}[./-]\d{4}\s+)?(?:(?:Menkul|Nakit|MENKUL|NAKİT)\s+)?(?:(\d{2})[./-](\d{2})\s+)?`;
const TICKER = String.raw`([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ0-9]{2,5})`;
// "1.063x4,61", "5 Adetx255,50", "5 Adet x 255,50", "10 Lot x 30,00", "10 @ 30,00"
const QTY_PRICE = String.raw`([\d.,]+)\s*(?:Adet|ADET|Ad\.?|AD|Lot|LOT)?\s*[xX×@]\s*([\d.,]+)`;
const SIDE = String.raw`(Alış|Alım|Satış|Satım|ALIŞ|ALIM|SATIŞ|SATIM|Alis|Satis|ALIS|SATIS|Buy|Sell|BUY|SELL)`;
// The side after the trade ("ASTOR 5 Adetx255,50 Satış") or before it ("ALIŞ ASTOR 5 Adet x 255,50").
const TRADE_AFTER = new RegExp(LEAD + String.raw`${TICKER}\s+${QTY_PRICE}\s+${SIDE}(?=\s|$)`);
const TRADE_BEFORE = new RegExp(LEAD + String.raw`${SIDE}\s+${TICKER}\s+${QTY_PRICE}(?=\s|$)`);
const DIVIDEND = new RegExp(LEAD + String.raw`${TICKER}\s+([\d.,]+)\s+Adet\s+%[\d.,]+\s+Temettü`);

type Trade = { date: string; name: string; quantity: string; price: string; side: 'Alış' | 'Satış' };
type Dividend = { date: string; name: string; quantity: number };

function sideOf(word: string): Trade['side'] {
  return /^(al|buy)/i.test(word) ? 'Alış' : 'Satış';
}

/**
 * The trade date: its own dd/mm when the line has one (a trade on 31/12 booked on 02/01 belongs
 * to the year before), else the booking date.
 */
function tradeDate(bookDay: string, bookMonth: string, bookYear: string, day?: string, month?: string): string {
  if (!day || !month) return `${bookYear}-${bookMonth}-${bookDay}`;
  const year = Number(month) > Number(bookMonth) ? Number(bookYear) - 1 : Number(bookYear);
  return `${year}-${month}-${day}`;
}

function read(lines: string[]): { trades: Trade[]; dividends: Dividend[] } {
  const trades: Trade[] = [];
  const dividends: Dividend[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    const a = TRADE_AFTER.exec(line);
    if (a) {
      trades.push({ date: tradeDate(a[1], a[2], a[3], a[4], a[5]), name: a[6], quantity: a[7], price: a[8], side: sideOf(a[9]) });
      continue;
    }
    const b = TRADE_BEFORE.exec(line);
    if (b) {
      trades.push({ date: tradeDate(b[1], b[2], b[3], b[4], b[5]), name: b[7], quantity: b[8], price: b[9], side: sideOf(b[6]) });
      continue;
    }
    const d = DIVIDEND.exec(line);
    const quantity = d ? parseAmount(d[7]) : undefined;
    if (d && quantity) dividends.push({ date: `${d[3]}-${d[2]}-${d[1]}`, name: d[6], quantity });
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
