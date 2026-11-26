// "Fonun mu, mevduat mı?": a money-market fund's last month against the average 1-month deposit.
// Many savers keep their cash in a money-market fund instead of a term deposit, so the
// maturity-day comparison means nothing to them; this one updates with every TEFAS price.
// Both sides are before withholding: the fund's price change and the deposit's gross rate.

import type { Feed } from './feed-types';
import type { FundInfo } from './funds';
import { averageRateFor } from './renew-forward';

const MONTH_DAYS = 30.4;

export function isMoneyMarket(f: Pick<FundInfo, 'name'>): boolean {
  const name = f.name.toLocaleUpperCase('tr-TR');
  return name.includes('PARA PİYASASI') || name.includes('PARA PIYASASI');
}

export type FundVsDeposit = {
  /** the fund's price change over the last month, ratio */
  fund: number;
  /** the average 1-month deposit over the same length, before withholding, ratio */
  deposit: number;
  /** fund − deposit, ratio points; positive when the fund did better */
  gap: number;
  /** the gap in lira on `value` */
  lira: number;
};

/**
 * Undefined when there is no deposit average or the fund's monthly figure is missing or
 * implausible (a money-market fund does not move 20% in a month; the feed has a few broken rows).
 */
export function fundVsDeposit(f: Pick<FundInfo, 'returns'>, rates: Feed['depositRates'], value: number): FundVsDeposit | undefined {
  const fund = f.returns.m1;
  const compound = averageRateFor(rates, 32);
  if (fund === undefined || fund === null || compound === undefined || Math.abs(fund) > 0.2) return undefined;
  // TCMB publishes a yearly compound rate: one month of it.
  const deposit = Math.pow(1 + compound / 100, MONTH_DAYS / 365) - 1;
  const gap = fund - deposit;
  return { fund, deposit, gap, lira: gap * value };
}
