import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { DepositFields } from '@/components/holding-form/deposit-fields';
import { FormSummary } from '@/components/holding-form/form-summary';
import { GROUPS, groupOf, numText, type Group } from '@/components/holding-form/form-types';
import { UsAssetFields } from '@/components/holding-form/us-asset-fields';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Choice, Field, IconButton, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { defaultWithholding } from '@/lib/deposit';
import { formatLongDate, formatTL, parseAmount, todayISO } from '@/lib/format';
import { FEED_URL } from '@/lib/feed-url';
import { fetchTryRate } from '@/lib/fx';
import { priceLookup } from '@/lib/lookup';
import { fundPriceOn, usPriceOn } from '@/lib/fund-service';
import { closeLabel } from '@/lib/funds';
import { feedQuote, knownSymbols, usSymbol } from '@/lib/securities';
import { analyzeHolding } from '@/lib/returns';
import { CURRENCY_SYMBOL, GOLD_LABELS, isCurrencyKind, isUsdPriced, KIND_LABELS, type CurrencyKind, type GoldType, type Holding, type HoldingKind } from '@/lib/types';
import { plausibilityWarnings } from '@/lib/validate';
import { newId } from '@/lib/ids';
import { saveHolding, useStore } from '@/state/store';

export default function EditHoldingScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useStore((s) => s.allHoldings.find((h) => h.id === id));
  const settings = useStore((s) => s.calcSettings);
  const index = useStore((s) => s.cpi.index);
  const prices = useStore((s) => s.prices);
  const today = todayISO();

  const [group, setGroup] = useState<Group>(existing ? groupOf(existing.kind) : 'deposit');
  const [currency, setCurrency] = useState<CurrencyKind>(existing && isCurrencyKind(existing.kind) ? existing.kind : 'usd');
  // A deposit's currency: 'try' or a foreign currency (then the principal is in that currency).
  const [depositCurrency, setDepositCurrency] = useState<'try' | 'usd' | 'eur'>(existing?.depositCurrency ?? 'try');
  const [name, setName] = useState(existing?.name ?? '');
  const [buyDate, setBuyDate] = useState<string | undefined>(existing?.buyDate);
  const [quantity, setQuantity] = useState(numText(existing?.quantity));
  const [unitCost, setUnitCost] = useState(numText(existing?.unitCost));
  const [principal, setPrincipal] = useState(
    existing?.kind === 'deposit' ? numText(existing.depositCurrency ? existing.quantity : existing.unitCost) : '',
  );
  const [gross, setGross] = useState(numText(existing?.grossRate ?? existing?.depositRate));
  const [term, setTerm] = useState(numText(existing?.termDays ?? 32));
  const [withholding, setWithholding] = useState(numText(existing?.withholding));
  const [current, setCurrent] = useState(numText(existing?.currentPrice));
  // US stocks, ETFs and crypto: prices in dollars and the USD/TRY of the purchase day.
  const [usdCost, setUsdCost] = useState(numText(existing?.usdUnitCost));
  const [usdRate, setUsdRate] = useState(
    numText(existing?.usdUnitCost ? Number((existing.unitCost / existing.usdUnitCost).toFixed(4)) : undefined),
  );
  const [currentUsd, setCurrentUsd] = useState(numText(existing?.currentPriceUsd));
  const [goldType, setGoldType] = useState<GoldType>(existing?.goldType ?? 'gram');
  const [rateNote, setRateNote] = useState<string>();
  // the unit cost we filled from TEFAS, so a later date or code may replace it (a typed one stays)
  const [autoCost, setAutoCost] = useState<string>();
  // the same for the dollar price of a US stock, ETF or coin, with the note under it
  const [autoUsd, setAutoUsd] = useState<string>();
  const [usdNote, setUsdNote] = useState<string>();
  const [refRate, setRefRate] = useState<number>();
  const [tried, setTried] = useState(false);
  const [acknowledged, setAcknowledged] = useState<string>();

  // Another asset type is another asset: start its fields empty (the purchase date stays).
  const changeGroup = (g: Group) => {
    if (g === group) return;
    setGroup(g);
    setName('');
    setQuantity('');
    setUnitCost('');
    setAutoCost(undefined);
    setAutoUsd(undefined);
    setUsdNote(undefined);
    setCurrent('');
    setPrincipal('');
    setGross('');
    setTerm('32');
    setWithholding('');
    setUsdCost('');
    setUsdRate('');
    setCurrentUsd('');
    setGoldType('gram');
    setDepositCurrency('try');
    setRateNote(undefined);
    setRefRate(undefined);
    setTried(false);
    setAcknowledged(undefined);
  };

  const kind: HoldingKind = group === 'fx' ? currency : group;
  const isDeposit = kind === 'deposit';
  const usdKind = isUsdPriced(kind);
  const isFx = group === 'fx';
  const fxDeposit = isDeposit && depositCurrency !== 'try' ? depositCurrency : undefined;
  // Which currency's rate on the purchase day to look up: cash or a foreign-currency deposit.
  const rateCurrency: CurrencyKind | undefined = isFx ? currency : (fxDeposit ?? (usdKind ? 'usd' : undefined));
  const isGold = kind === 'gold';
  // A fund or stock whose code the feed lists is priced automatically.
  const autoQuote = feedQuote({ kind, name });
  const manualPrice = !isDeposit && !isFx && !isGold && !autoQuote;
  const lookup = priceLookup(kind, name);
  // Symbols the feed prices, filtered by what is typed: one tap fills the symbol.
  const typed = name.trim().toUpperCase();
  // Funds: ~2.400 TEFAS codes, so only once something is typed.
  const suggestions =
    usdKind || (kind === 'fund' && typed.length >= 2)
      ? knownSymbols(kind)
          .filter(
            (s) =>
              s.symbol !== typed &&
              (!typed || s.symbol.startsWith(typed) || s.name.toLocaleUpperCase('tr-TR').includes(name.trim().toLocaleUpperCase('tr-TR'))),
          )
          .slice(0, 6)
      : [];
  const codeField = kind === 'fund' || kind === 'stock' || kind === 'other';

  // The ECB rate of the purchase day: pre-fills the cost and is the reference for the plausibility check.
  useEffect(() => {
    if (!rateCurrency || !buyDate) return;
    let cancelled = false;
    fetchTryRate(rateCurrency, buyDate)
      .then((r) => {
        if (cancelled) return;
        setRefRate(r);
        if (usdKind) {
          if (usdRate) return;
          setUsdRate(numText(Number(r.toFixed(4))));
          setRateNote('O günün Avrupa Merkez Bankası dolar kuru. Kendi alış kurunla değiştirebilirsin.');
          return;
        }
        if (unitCost) return;
        setUnitCost(numText(Number(r.toFixed(4))));
        setRateNote('O günün Avrupa Merkez Bankası kuru. Kendi alış kurunla değiştirebilirsin.');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateCurrency, buyDate]);

  // A TEFAS fund: its price on the purchase day becomes the unit cost, as long as the user has
  // not typed their own (a cost we filled ourselves is replaced when the date or code changes).
  const fundCode = kind === 'fund' && autoQuote?.source === 'TEFAS' ? autoQuote && name.trim().toUpperCase() : undefined;
  useEffect(() => {
    if (!fundCode || !buyDate || !FEED_URL || existing) return;
    if (unitCost && unitCost !== autoCost) return;
    let cancelled = false;
    fundPriceOn(FEED_URL, fundCode, buyDate, today)
      .then((p) => {
        if (cancelled || !p) return;
        const text = numText(p.price);
        setUnitCost(text);
        setAutoCost(text);
        setRateNote(
          p.date === buyDate
            ? `${formatLongDate(p.date)} TEFAS fiyatı. Talimat saatine göre fon bir sonraki günün fiyatıyla alınmış olabilir; farklıysa kendi fiyatınla değiştir.`
            : `${formatLongDate(buyDate)} işlem günü değil; önceki işlem günü (${formatLongDate(p.date)}) TEFAS fiyatı. Farklıysa kendi fiyatınla değiştir.`,
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fundCode, buyDate]);

  // A listed US stock, ETF or coin: its USD close on the purchase day becomes the unit price.
  const usCode = usdKind && autoQuote ? usSymbol(name) : undefined;
  useEffect(() => {
    if (!usCode || !buyDate || !FEED_URL || existing) return;
    if (usdCost && usdCost !== autoUsd) return;
    let cancelled = false;
    usPriceOn(FEED_URL, usCode, kind === 'crypto', buyDate, today)
      .then((p) => {
        if (cancelled) return;
        if (!p) {
          setUsdNote('Bu tarih için kapanış henüz yüklenmedi; alış fiyatını dolar olarak gir.');
          return;
        }
        const text = numText(p.price);
        setUsdCost(text);
        setAutoUsd(text);
        setUsdNote(
          p.date === buyDate
            ? `${formatLongDate(p.date)} kapanışı (ABD saati). Farklı fiyattan aldıysan değiştir.`
            : `${formatLongDate(buyDate)} işlem günü değil; ${formatLongDate(p.date)} kapanışı. Farklı fiyattan aldıysan değiştir.`,
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usCode, buyDate]);

  // A Turkish exchange-traded fund typed under "ETF": it is priced by TEFAS, under "Fon".
  const tefasEtf = kind === 'etf' && !autoQuote && name.trim().length >= 3 ? feedQuote({ kind: 'fund', name }) : undefined;

  const termDays = parseAmount(term);
  const autoWithholding = defaultWithholding(termDays && termDays > 0 ? termDays : 32, fxDeposit);
  const usdUnitCost = parseAmount(usdCost);
  const usdRateValue = parseAmount(usdRate);
  const draft: Partial<Holding> = usdKind
    ? {
        quantity: parseAmount(quantity),
        usdUnitCost,
        unitCost: usdUnitCost && usdRateValue ? usdUnitCost * usdRateValue : undefined,
        currentPriceUsd: manualPrice && currentUsd.trim() ? parseAmount(currentUsd) : undefined,
      }
    : isDeposit
    ? {
        // TRY: one unit worth the principal. Foreign currency: the principal in units, at the deposit-day rate.
        quantity: fxDeposit ? parseAmount(principal) : 1,
        unitCost: fxDeposit ? parseAmount(unitCost) : parseAmount(principal),
        grossRate: parseAmount(gross),
        termDays: termDays ? Math.round(termDays) : undefined,
        withholding: withholding.trim() ? parseAmount(withholding) : autoWithholding,
      }
    : {
        quantity: parseAmount(quantity),
        unitCost: parseAmount(unitCost),
        currentPrice: manualPrice && current.trim() ? parseAmount(current) : undefined,
      };

  const errors = {
    date: !buyDate ? 'Tarih seç' : undefined,
    quantity: (!isDeposit || fxDeposit) && !(draft.quantity && draft.quantity > 0) ? 'Sıfırdan büyük bir miktar gir' : undefined,
    name: usdKind && !usSymbol(name) ? `Sembolü gir (ör. ${kind === 'crypto' ? 'BTC' : kind === 'etf' ? 'SPY' : 'AAPL'})` : undefined,
    cost: usdKind
      ? !(usdUnitCost && usdUnitCost > 0)
        ? 'Birim alış fiyatını dolar olarak gir'
        : !(usdRateValue && usdRateValue > 0)
          ? 'Aldığın günkü dolar kurunu gir'
          : undefined
      : !(draft.unitCost && draft.unitCost > 0)
        ? fxDeposit
          ? 'Yatırdığın günkü kuru gir'
          : 'Sıfırdan büyük bir tutar gir'
        : undefined,
    gross: isDeposit && draft.grossRate === undefined ? `Yıllık brüt faizi gir (ör. ${fxDeposit ? '2' : '40'})` : undefined,
    term: isDeposit && !(draft.termDays && draft.termDays > 0) ? 'Vadeyi gün olarak gir' : undefined,
    withholding: isDeposit && (draft.withholding === undefined || draft.withholding >= 100) ? 'Geçerli bir oran gir' : undefined,
    current: usdKind
      ? manualPrice && currentUsd.trim() && draft.currentPriceUsd === undefined
        ? 'Geçerli bir fiyat gir'
        : undefined
      : manualPrice && current.trim() && draft.currentPrice === undefined
        ? 'Geçerli bir fiyat gir'
        : undefined,
  };
  const valid = !Object.values(errors).some(Boolean);
  const show = (e: string | undefined) => (tried ? e : undefined);

  const holding: Holding | undefined = valid
    ? {
        id: existing?.id ?? newId(),
        kind,
        name: usdKind
          ? usSymbol(name)!
          : name.trim() ||
          (isGold ? GOLD_LABELS[goldType] : fxDeposit ? `${fxDeposit === 'usd' ? 'Dolar' : 'Euro'} mevduat` : isDeposit ? 'TL mevduat' : KIND_LABELS[kind]),
        goldType: isGold ? goldType : undefined,
        buyDate: buyDate!,
        quantity: draft.quantity!,
        unitCost: draft.unitCost!,
        currentPrice: draft.currentPrice,
        usdUnitCost: draft.usdUnitCost,
        currentPriceUsd: draft.currentPriceUsd,
        priceUpdatedAt: (usdKind ? draft.currentPriceUsd !== existing?.currentPriceUsd : draft.currentPrice !== existing?.currentPrice)
          ? new Date().toISOString()
          : existing?.priceUpdatedAt,
        grossRate: draft.grossRate,
        termDays: draft.termDays,
        withholding: draft.withholding,
        depositCurrency: fxDeposit,
      }
    : undefined;
  const preview = holding ? analyzeHolding(holding, today, prices, settings, index) : undefined;

  const warnings = holding ? plausibilityWarnings(holding, { referenceRate: rateCurrency ? refRate : undefined, prices }) : [];
  const warningKey = warnings.map((w) => w.message).join('|');
  const needsConfirm = warnings.length > 0 && acknowledged !== warningKey;

  const onSave = () => {
    setTried(true);
    if (!holding) return;
    // First tap shows the warnings; a second tap on "Yine de kaydet" saves.
    if (needsConfirm) return setAcknowledged(warningKey);
    saveHolding(holding);
    router.back();
  };

  return (
    <Screen tabs={false}>
      <View style={styles.header}>
        <IconButton
          name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
          label="Geri"
          onPress={() => router.back()}
        />
        <ThemedText style={styles.title}>{existing ? 'Varlığı düzenle' : 'Varlık ekle'}</ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="small" themeColor="textSecondary">
          Varlık türü
        </ThemedText>
        <Choice options={GROUPS} value={group} onChange={changeGroup} />
        {isFx && (
          <Choice
            options={[
              { value: 'usd', label: 'Dolar ($)' },
              { value: 'eur', label: 'Euro (€)' },
              { value: 'gbp', label: 'Sterlin (£)' },
            ]}
            value={currency}
            onChange={(c) => { setCurrency(c); setUnitCost(''); setRateNote(undefined); }}
          />
        )}
        {isDeposit && (
          <Choice<'try' | 'usd' | 'eur'>
            options={[
              { value: 'try', label: 'TL (₺)' },
              { value: 'usd', label: 'Dolar ($)' },
              { value: 'eur', label: 'Euro (€)' },
            ]}
            value={depositCurrency}
            onChange={(c) => { setDepositCurrency(c); setUnitCost(''); setRateNote(undefined); }}
          />
        )}
        {isGold && (
          <Choice
            options={(Object.keys(GOLD_LABELS) as GoldType[]).map((g) => ({
              value: g,
              label: g === 'gram' ? 'Gram' : GOLD_LABELS[g].split(' ')[0],
            }))}
            value={goldType}
            onChange={setGoldType}
          />
        )}
      </View>

      <Card style={styles.form}>
        {isDeposit ? (
          <DepositFields
            fxDeposit={fxDeposit}
            principal={principal}
            setPrincipal={setPrincipal}
            show={show}
            errors={errors}
            gross={gross}
            setGross={setGross}
            term={term}
            setTerm={setTerm}
            autoWithholding={autoWithholding}
            withholding={withholding}
            setWithholding={setWithholding}
            buyDate={buyDate}
            setBuyDate={setBuyDate}
            today={today}
            unitCost={unitCost}
            setUnitCost={setUnitCost}
            setRateNote={setRateNote}
            rateNote={rateNote}
          />
        ) : usdKind ? (
          <UsAssetFields
            kind={kind}
            name={name}
            setName={setName}
            show={show}
            errors={errors}
            suggestions={suggestions}
            tefasEtf={tefasEtf}
            changeGroup={changeGroup}
            quantity={quantity}
            setQuantity={setQuantity}
            buyDate={buyDate}
            setBuyDate={setBuyDate}
            today={today}
            usdCost={usdCost}
            setUsdCost={setUsdCost}
            setUsdNote={setUsdNote}
            usdRate={usdRate}
            setUsdRate={setUsdRate}
            setRateNote={setRateNote}
            usdNote={usdNote}
            rateNote={rateNote}
            autoQuote={autoQuote}
            prices={prices}
            currentUsd={currentUsd}
            setCurrentUsd={setCurrentUsd}
            lookup={lookup}
          />
        ) : (
          <>
            {/* Stays on screen once the code matches a priced fund, so it can still be corrected. */}
            {codeField && (
              <Field
                label={kind === 'fund' ? 'Fon kodu / adı' : kind === 'stock' ? 'Hisse kodu' : 'İsim'}
                placeholder={kind === 'fund' ? 'ör. TTE' : kind === 'stock' ? 'ör. THYAO' : KIND_LABELS[kind]}
                autoCapitalize="characters"
                autoCorrect={false}
                value={name}
                onChangeText={setName}
              />
            )}
            {kind === 'fund' && suggestions.length > 0 && (
              <View style={styles.chips}>
                {suggestions.map((s) => (
                  <Button key={s.symbol} title={`${s.symbol} · ${s.name}`} kind="secondary" compact onPress={() => setName(s.symbol)} />
                ))}
              </View>
            )}
            <Field
              label={isFx || (isGold && goldType === 'gram') ? 'Miktar' : 'Adet'}
              prefix={isFx ? CURRENCY_SYMBOL[currency] : undefined}
              suffix={isGold && goldType === 'gram' ? 'gr' : undefined}
              keyboardType="decimal-pad"
              value={quantity}
              onChangeText={setQuantity}
              error={show(errors.quantity)}
            />
            <DateField label="Alış tarihi" value={buyDate} onChange={setBuyDate} max={today} />
            <Field
              label={isFx ? 'Alış kuru' : isGold ? (goldType === 'gram' ? 'Gram alış fiyatı' : 'Adet alış fiyatı') : 'Birim alış fiyatı'}
              prefix="₺"
              decimals={isFx ? 4 : isGold ? 2 : 6}
              keyboardType="decimal-pad"
              value={unitCost}
              onChangeText={(t) => { setUnitCost(t); setRateNote(undefined); }}
              error={show(errors.cost)}
              hint={rateNote}
            />
            {manualPrice ? (
              <Field
                label="Güncel birim fiyat"
                prefix="₺"
                decimals={6}
                keyboardType="decimal-pad"
                value={current}
                onChangeText={setCurrent}
                error={show(errors.current)}
                hint="Bu varlığın fiyatını şimdilik sen güncelliyorsun."
              />
            ) : null}
            {autoQuote && (
              <ThemedText type="small" style={{ color: theme.accent }}>
                {autoQuote.name ? `${autoQuote.name}\n` : ''}Güncel fiyat otomatik: {formatTL(autoQuote.price, true)} ({autoQuote.source} · {closeLabel(autoQuote.date, today)})
              </ThemedText>
            )}
            {lookup && !autoQuote && (
              <Button
                title={`Güncel fiyata bak · ${lookup.site}`}
                kind="secondary"
                compact
                icon={{ ios: 'arrow.up.right.square', android: 'open_in_new', web: 'open_in_new' }}
                onPress={() => WebBrowser.openBrowserAsync(lookup.url)}
              />
            )}
            {manualPrice || autoQuote ? null : (
              <ThemedText type="small" themeColor="textSecondary">
                {isGold && goldType !== 'gram'
                  ? 'Güncel değer, içindeki saf altından otomatik hesaplanır. Kuyumcu fiyatına işçilik eklendiği için biraz düşük görünebilir.'
                  : `Güncel ${isGold ? 'gram altın fiyatı' : 'kur'} otomatik alınır.`}
              </ThemedText>
            )}
          </>
        )}
      </Card>

      <FormSummary
        preview={preview}
        tlDeposit={isDeposit && !fxDeposit}
        netRate={isDeposit && draft.grossRate !== undefined && draft.withholding !== undefined ? draft.grossRate * (1 - draft.withholding / 100) : undefined}
        warnings={warnings}
        showWarnings={!needsConfirm}
      />
      <Button title={warnings.length > 0 && !needsConfirm ? 'Yine de kaydet' : 'Kaydet'} onPress={onSave} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { fontSize: 26, lineHeight: 32, fontWeight: 800 },
  section: { gap: Spacing.two },
  form: { gap: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
