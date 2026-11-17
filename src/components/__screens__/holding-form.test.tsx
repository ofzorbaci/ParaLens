/// <reference types="jest" />
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DepositFields } from '@/components/holding-form/deposit-fields';
import { FormSummary } from '@/components/holding-form/form-summary';
import { UsAssetFields } from '@/components/holding-form/us-asset-fields';
import type { HoldingAnalysis } from '@/lib/returns';

const noop = () => {};

describe('add holding form: deposit fields', () => {
  const base = {
    principal: '',
    setPrincipal: noop,
    gross: '',
    setGross: noop,
    term: '32',
    setTerm: noop,
    withholding: '',
    setWithholding: noop,
    autoWithholding: 17.5,
    buyDate: undefined,
    setBuyDate: noop,
    today: '2026-11-18',
    unitCost: '',
    setUnitCost: noop,
    rateNote: undefined,
    setRateNote: noop,
    errors: {},
    show: (e: string | undefined) => e,
  };

  it('asks for the TRY principal and explains the default withholding', async () => {
    const setPrincipal = jest.fn();
    await render(<DepositFields {...base} fxDeposit={undefined} setPrincipal={setPrincipal} />);
    expect(screen.getByText('Yatırdığın tutar')).toBeTruthy();
    expect(screen.getByText('Boş bırakırsan vadeye göre %17,5 uygulanır.')).toBeTruthy();
    expect(screen.queryByText('Yatırdığın günkü kur')).toBeNull();
    await fireEvent.changeText(screen.getByPlaceholderText('100.000'), '250000');
    expect(setPrincipal).toHaveBeenCalledWith('250.000');
  });

  it('adds the deposit-day rate for a dollar deposit', async () => {
    await render(<DepositFields {...base} fxDeposit="usd" autoWithholding={25} />);
    expect(screen.getByText('Yatırdığın günkü kur')).toBeTruthy();
    expect(screen.getByText('Döviz mevduatında stopaj %25; boş bırakırsan bu uygulanır.')).toBeTruthy();
  });
});

describe('add holding form: US stock, ETF, crypto fields', () => {
  const base = {
    kind: 'etf' as const,
    name: 'GLDTR',
    setName: noop,
    suggestions: [],
    tefasEtf: undefined,
    changeGroup: noop,
    quantity: '',
    setQuantity: noop,
    buyDate: undefined,
    setBuyDate: noop,
    today: '2026-11-18',
    usdCost: '',
    setUsdCost: noop,
    usdNote: undefined,
    setUsdNote: noop,
    usdRate: '',
    setUsdRate: noop,
    rateNote: undefined,
    setRateNote: noop,
    autoQuote: undefined,
    prices: {},
    currentUsd: '',
    setCurrentUsd: noop,
    lookup: undefined,
    errors: {},
    show: (e: string | undefined) => e,
  };

  it('sends a Turkish exchange-traded fund to the Fon type', async () => {
    const changeGroup = jest.fn();
    const setName = jest.fn();
    await render(
      <UsAssetFields
        {...base}
        changeGroup={changeGroup}
        setName={setName}
        tefasEtf={{ price: 12.5, date: '2026-11-17', source: 'TEFAS', name: 'QNB ALTIN BORSA YATIRIM FONU' }}
      />,
    );
    expect(screen.getByText(/bir Türk borsa yatırım fonu/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Fon olarak ekle'));
    expect(changeGroup).toHaveBeenCalledWith('fund');
    expect(setName).toHaveBeenCalledWith('GLDTR');
  });

  it('shows the automatic dollar price with its source instead of a price field', async () => {
    await render(<UsAssetFields {...base} name="SPY" autoQuote={{ price: 700, date: '2026-11-17', source: 'Finnhub', currency: 'USD' }} prices={{ usd: 42 }} />);
    expect(screen.getByText(/Güncel fiyat otomatik: \$700/)).toBeTruthy();
    expect(screen.getByText(/Finnhub/)).toBeTruthy();
    expect(screen.queryByText('Güncel birim fiyat')).toBeNull();
  });
});

describe('add holding form: result and warnings', () => {
  const preview = {
    cost: 100_000,
    value: 140_000,
    inflation: { factor: 1.3, fromMonth: '2025-11', toMonth: '2026-10', complete: true },
    breakEven: 130_000,
    nominal: 0.4,
    real: 0.0769,
    realGain: 10_000,
  } satisfies HoldingAnalysis;

  it('shows the real return and asks "are you sure?" for odd numbers', async () => {
    await render(
      <FormSummary
        preview={preview}
        tlDeposit
        netRate={33}
        warnings={[{ field: 'gross', message: 'Yıllık %400 faiz alışılmadık.' }]}
        showWarnings
      />,
    );
    expect(screen.getByText('Reel getirin')).toBeTruthy();
    expect(screen.getByText('Stopaj sonrası net getiri')).toBeTruthy();
    expect(screen.getByText('Yıllık net faiz %33,0')).toBeTruthy();
    expect(screen.getByText('Emin misin?')).toBeTruthy();
    expect(screen.getByText('• Yıllık %400 faiz alışılmadık.')).toBeTruthy();
  });

  it('hides the warnings once the user confirmed them', async () => {
    await render(<FormSummary preview={preview} tlDeposit={false} netRate={undefined} warnings={[{ field: 'gross', message: 'x' }]} showWarnings={false} />);
    expect(screen.queryByText('Emin misin?')).toBeNull();
    expect(screen.getByText('TL getiri')).toBeTruthy();
  });
});
