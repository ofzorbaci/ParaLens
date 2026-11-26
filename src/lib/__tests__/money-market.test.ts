import { describe, expect, it } from 'vitest';

import { fundVsDeposit, isMoneyMarket } from '../money-market';

const rates = { date: '2026-11-13', source: 'TCMB', byTerm: [{ maxDays: 90, rate: 42.5 }, { maxDays: null, rate: 40 }] };

describe('fonun mu, mevduat mı?', () => {
  it('spots money-market funds by name', () => {
    expect(isMoneyMarket({ name: 'ATA PORTFÖY PARA PİYASASI (TL) FONU' })).toBe(true);
    expect(isMoneyMarket({ name: 'İş Portföy Para Piyasası Fonu' })).toBe(true);
    expect(isMoneyMarket({ name: 'QNB ALTIN BORSA YATIRIM FONU' })).toBe(false);
  });

  it('compares the last month with one month of the average deposit', () => {
    const r = fundVsDeposit({ returns: { m1: 0.025 } }, rates, 100_000)!;
    // 42,5% a year compounded is about 2,99% over a month.
    expect(r.deposit).toBeCloseTo(Math.pow(1.425, 30.4 / 365) - 1, 10);
    expect(r.gap).toBeCloseTo(0.025 - r.deposit, 10);
    expect(r.lira).toBeCloseTo(100_000 * r.gap, 6);
    expect(r.lira).toBeLessThan(0);
  });

  it('says nothing on a missing or broken figure', () => {
    expect(fundVsDeposit({ returns: {} }, rates, 1)).toBeUndefined();
    expect(fundVsDeposit({ returns: { m1: -0.99 } }, rates, 1)).toBeUndefined();
    expect(fundVsDeposit({ returns: { m1: 0.02 } }, undefined, 1)).toBeUndefined();
  });
});
