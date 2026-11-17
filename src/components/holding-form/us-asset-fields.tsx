// Part of the add/edit holding form (src/app/holding/edit.tsx): the fields of a US stock, ETF or coin, priced in dollars. The form keeps all
// state; this component only lays out the fields it is given.

import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { Button, Field } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney, formatTL } from '@/lib/format';
import { closeLabel } from '@/lib/funds';
import type { FeedQuote } from '@/lib/securities';
import type { HoldingKind, LivePrices } from '@/lib/types';

import type { FormErrors, Group } from './form-types';

type Props = {
  kind: HoldingKind;
  name: string;
  setName: (t: string) => void;
  suggestions: { symbol: string; name: string }[];
  tefasEtf: FeedQuote | undefined;
  changeGroup: (g: Group) => void;
  quantity: string;
  setQuantity: (t: string) => void;
  buyDate: string | undefined;
  setBuyDate: (d: string | undefined) => void;
  today: string;
  usdCost: string;
  setUsdCost: (t: string) => void;
  usdNote: string | undefined;
  setUsdNote: (t: string | undefined) => void;
  usdRate: string;
  setUsdRate: (t: string) => void;
  rateNote: string | undefined;
  setRateNote: (t: string | undefined) => void;
  autoQuote: FeedQuote | undefined;
  prices: LivePrices;
  currentUsd: string;
  setCurrentUsd: (t: string) => void;
  lookup: { url: string; site: string } | undefined;
  errors: FormErrors;
  show: (e: string | undefined) => string | undefined;
};

export function UsAssetFields({ kind, name, setName, show, errors, suggestions, tefasEtf, changeGroup, quantity, setQuantity, buyDate, setBuyDate, today, usdCost, setUsdCost, setUsdNote, usdRate, setUsdRate, setRateNote, usdNote, rateNote, autoQuote, prices, currentUsd, setCurrentUsd, lookup }: Props) {
  const theme = useTheme();
  return (
    <>
      <Field
        label={kind === 'crypto' ? 'Kripto para sembolü' : kind === 'etf' ? 'ETF sembolü' : 'Hisse sembolü'}
        placeholder={kind === 'crypto' ? 'ör. BTC' : kind === 'etf' ? 'ör. SPY' : 'ör. AAPL'}
        autoCapitalize="characters"
        autoCorrect={false}
        value={name}
        onChangeText={setName}
        error={show(errors.name)}
      />
      {suggestions.length > 0 && (
        <View style={styles.chips}>
          {suggestions.map((s) => (
            <Button key={s.symbol} title={`${s.symbol} · ${s.name}`} kind="secondary" compact onPress={() => setName(s.symbol)} />
          ))}
        </View>
      )}
      {tefasEtf && (
        <View style={[styles.preview, { backgroundColor: theme.info }]}>
          <ThemedText type="small" style={{ color: theme.infoText }}>
            {name.trim().toUpperCase()} bir Türk borsa yatırım fonu{tefasEtf.name ? ` (${tefasEtf.name})` : ''}. Fiyatı TEFAS’tan
            gelir; “Fon” türüyle ekle.
          </ThemedText>
          <Button
            title="Fon olarak ekle"
            kind="secondary"
            compact
            onPress={() => {
              const code = name.trim().toUpperCase();
              changeGroup('fund');
              setName(code);
            }}
          />
        </View>
      )}
      <Field
        label={kind === 'crypto' ? 'Miktar' : 'Adet'}
        keyboardType="decimal-pad"
        placeholder={kind === 'crypto' ? '0,05' : '10'}
        value={quantity}
        onChangeText={setQuantity}
        error={show(errors.quantity)}
      />
      <DateField label="Alış tarihi" value={buyDate} onChange={setBuyDate} max={today} />
      <View style={styles.pair}>
        <Field
          style={styles.flex}
          label="Birim alış fiyatı"
          prefix="$"
          decimals={6}
          keyboardType="decimal-pad"
          value={usdCost}
          onChangeText={(t) => {
            setUsdCost(t);
            setUsdNote(undefined);
          }}
          error={show(errors.cost)}
        />
        <Field
          style={styles.flex}
          label="O günkü dolar kuru"
          prefix="₺"
          decimals={4}
          keyboardType="decimal-pad"
          value={usdRate}
          onChangeText={(t) => { setUsdRate(t); setRateNote(undefined); }}
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {usdNote ? `${usdNote} ` : ''}
        {rateNote ?? 'Maliyetini TL’ye bu kurdan çeviririz; reel getiri hem TÜFE’ye hem dolara göre hesaplanır.'}
      </ThemedText>
      {autoQuote ? (
        <ThemedText type="small" style={{ color: theme.accent }}>
          Güncel fiyat otomatik: {formatMoney(autoQuote.price, '$', true)}
          {prices.usd ? ` ≈ ${formatTL(autoQuote.price * prices.usd, true)}` : ''} ({autoQuote.source} · {closeLabel(autoQuote.date, today)})
        </ThemedText>
      ) : (
        <Field
          label="Güncel birim fiyat"
          prefix="$"
          decimals={6}
          keyboardType="decimal-pad"
          value={currentUsd}
          onChangeText={setCurrentUsd}
          error={show(errors.current)}
          hint={
            name.trim()
              ? 'Bu sembolün fiyatı veri akışında yok; dolar olarak sen gir, TL’ye günlük kurla çeviririz.'
              : undefined
          }
        />
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
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pair: { flexDirection: 'row', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preview: { borderRadius: 20, padding: 20, gap: 8 },
});
