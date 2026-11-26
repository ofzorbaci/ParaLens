import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Field, Pct } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { defaultWithholding, depositValue } from '@/lib/deposit';
import { formatDate, formatMonth, formatRate, formatTL, parseAmount, todayISO } from '@/lib/format';
import { loadPlans, type Plan } from '@/lib/purchases';
import { averageRateFor, compoundToSimple, forwardReal, lastTermReal, priceMultiple, rankOffers } from '@/lib/renew-forward';
import type { Holding } from '@/lib/types';
import { updateSettings, useStore } from '@/state/store';

const MAX_OFFERS = 4;

/** The yearly plan's store price, when the store sells it in lira; undefined otherwise. */
function useYearlyPrice(): Plan | undefined {
  const [plan, setPlan] = useState<Plan>();
  useEffect(() => {
    let alive = true;
    loadPlans()
      .then((ps) => alive && setPlan(ps.find((p) => p.period === 'yearly' && p.currencyCode === 'TRY')))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return plan;
}

export function signedTL(v: number): string {
  return `${v >= 0 ? '+' : '−'}${formatTL(Math.abs(v))}`;
}

/**
 * Maturity day, looking forward: the average rate, the current rate and the banks' offers side by
 * side, each as the expected real gain over 12 months in today's lira.
 */
export function RenewForwardCard({ h }: { h: Holding }) {
  const theme = useTheme();
  const settings = useStore((s) => s.calcSettings);
  const index = useStore((s) => s.cpi.index);
  const depositRates = useStore((s) => s.feed.depositRates);
  const expectations = useStore((s) => s.feed.expectations);
  // Last maturity's offers come back filled in; the user only changes what moved.
  const saved = useStore((s) => s.settings.bankOffers);
  const [offers, setOffers] = useState(() =>
    saved?.length ? saved.map((o) => ({ bank: o.bank, rate: String(o.rate).replace('.', ',') })) : [{ bank: '', rate: '' }],
  );
  // The day of the offers that were filled in when the screen opened, not of what is typed now.
  const [filledFrom] = useState(() => (saved?.length ? saved[0].date : undefined));
  const yearlyPrice = useYearlyPrice();
  const term = h.termDays ?? 32;
  const withholding = h.withholding ?? defaultWithholding(term);
  const cpi = expectations.next12m.market;
  // TCMB publishes compound rates; the bank quotes simple ones, and the user's own rate is simple too.
  const averageCompound = averageRateFor(depositRates, term);
  const average = averageCompound === undefined ? undefined : compoundToSimple(averageCompound, term);
  const previous = lastTermReal(h, todayISO(), settings, index);
  // Real gain over 12 months on today's balance, in today's lira.
  const amount = depositValue(h, todayISO());
  const lira = (ratio: number) => amount * ratio;
  const current = h.grossRate !== undefined ? forwardReal(h.grossRate, term, withholding, cpi) : undefined;

  const entered = offers.map((o, i) => ({ bank: o.bank.trim() || `${i + 1}. banka`, rate: parseAmount(o.rate) ?? Number.NaN }));
  const ranked = rankOffers(entered, term, withholding, cpi, amount);
  const set = (i: number, patch: Partial<{ bank: string; rate: string }>) =>
    setOffers((xs) => xs.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  // What was typed is kept, with the day, for the next maturity.
  const typedKey = JSON.stringify(
    offers
      .map((o) => ({ bank: o.bank.trim(), rate: parseAmount(o.rate) }))
      .filter((o) => o.rate !== undefined && o.rate > 0),
  );
  const savedKey = JSON.stringify((saved ?? []).map(({ bank, rate }) => ({ bank, rate })));
  useEffect(() => {
    const typed = JSON.parse(typedKey) as { bank: string; rate: number }[];
    if (typed.length === 0 || typedKey === savedKey) return;
    updateSettings({ bankOffers: typed.map((o) => ({ ...o, date: todayISO() })) });
  }, [typedKey, savedKey]);

  // The headline: how many lira a year the best offer adds over the current rate (or the lowest offer).
  const best = ranked[0];
  const baseline = current !== undefined ? lira(current) : ranked.length > 1 ? ranked[ranked.length - 1].lira : undefined;
  const yearlyGain = best && baseline !== undefined ? best.lira - baseline : 0;

  return (
    <Card>
      <ThemedText style={styles.cardTitle}>Bankaları karşılaştır</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Bankaların bu vade için teklif ettiği faizleri yaz; hangisinin 12 ayda bugünün lirasıyla ne kazandıracağını
        yan yana gör. Beklenen enflasyon {formatRate(cpi)} (TCMB Piyasa Katılımcıları Anketi,{' '}
        {formatMonth(expectations.month)}). {term} gün vade, {formatRate(withholding)} stopaj.
      </ThemedText>

      {filledFrom && (
        <ThemedText type="small" themeColor="textSecondary">
          {formatDate(filledFrom)} tarihinde yazdığın teklifler dolduruldu; yalnızca değişenleri güncelle.
        </ThemedText>
      )}
      {offers.map((o, i) => (
        <View key={i} style={styles.pair}>
          <Field style={styles.bank} label="Banka" placeholder={`${i + 1}. banka`} value={o.bank} onChangeText={(t) => set(i, { bank: t })} />
          <Field
            style={styles.rate}
            label="Yıllık brüt faiz"
            prefix="%"
            keyboardType="decimal-pad"
            placeholder="ör. 42"
            value={o.rate}
            onChangeText={(t) => set(i, { rate: t })}
          />
        </View>
      ))}
      {offers.length < MAX_OFFERS && (
        <Button title="Banka ekle" kind="secondary" compact onPress={() => setOffers((xs) => [...xs, { bank: '', rate: '' }])} />
      )}

      {ranked.length > 0 && (
        <View style={[styles.ranking, { borderColor: theme.border }]}>
          {ranked.map((o, i) => (
            <Line
              key={`${o.bank}${i}`}
              label={`${o.bank} · ${formatRate(o.rate)}`}
              ratio={o.real}
              lira={o.lira}
              detail={
                i === 0
                  ? ranked.length > 1
                    ? 'En iyi teklif'
                    : undefined
                  : `En iyi tekliften 12 ayda ${formatTL(o.vsBest)} daha az`
              }
              strong={i === 0}
            />
          ))}
        </View>
      )}

      {yearlyGain > 0 && (
        <View style={[styles.gain, { backgroundColor: theme.info }]}>
          <ThemedText type="small" style={{ color: theme.infoText }}>
            {best.bank} ile 12 ayda, {current !== undefined ? 'şu anki faizine göre' : 'en düşük teklife göre'}
          </ThemedText>
          <ThemedText style={[styles.gainAmount, { color: theme.infoText }]}>+{formatTL(yearlyGain)}</ThemedText>
          <ThemedText type="small" style={{ color: theme.infoText }}>
            bugünün lirasıyla yıllık fark
            {yearlyPrice && priceMultiple(yearlyGain, yearlyPrice.price) >= 1
              ? ` · yıllık ParaLens Premium ücretinin (${yearlyPrice.priceString}) ${priceMultiple(yearlyGain, yearlyPrice.price)} katı`
              : ''}
          </ThemedText>
        </View>
      )}

      <ThemedText type="smallBold">Kıyas için</ThemedText>
      {average !== undefined && depositRates ? (
        <Line
          label={`Ortalama mevduat faiziyle (yıllık basit ${formatRate(average)})`}
          detail={`TCMB, ${formatDate(depositRates.date)} haftası · TCMB’nin yayımladığı yıllık bileşik oran ${formatRate(averageCompound!)}`}
          ratio={forwardReal(average, term, withholding, cpi)}
          lira={lira(forwardReal(average, term, withholding, cpi))}
        />
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Ortalama mevduat faizi verisi bekleniyor.
        </ThemedText>
      )}
      {h.grossRate !== undefined && <Line label={`Şu anki faizinle (${formatRate(h.grossRate)})`} ratio={current!} lira={lira(current!)} />}
      {previous !== undefined && <Line label="Geçen vadede gerçekleşen" ratio={previous} />}
      <ThemedText type="small" themeColor="textSecondary">
        Sağdaki lira, bugünkü bakiyenin 12 ayda bugünün lirasıyla kazanacağı ya da kaybedeceği alım gücü. Beklenti
        hesabıdır; enflasyon farklı gelirse sonuç değişir. Faizleri sen yazarsın; banka adına bir teklif değildir.
        Yatırım tavsiyesi değildir.
      </ThemedText>
    </Card>
  );
}

function Line({ label, detail, ratio, lira, strong }: { label: string; detail?: string; ratio: number; lira?: number; strong?: boolean }) {
  return (
    <View style={styles.option}>
      <View style={styles.flex}>
        <ThemedText style={[styles.lineLabel, strong && styles.strong]}>{label}</ThemedText>
        {detail && (
          <ThemedText type="small" themeColor="textSecondary">
            {detail}
          </ThemedText>
        )}
      </View>
      <View style={styles.right}>
        <Pct ratio={ratio} size={20} />
        {lira !== undefined && (
          <ThemedText type="small" themeColor="textSecondary">
            {signedTL(lira)}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cardTitle: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  pair: { flexDirection: 'row', gap: 12 },
  bank: { flex: 3 },
  rate: { flex: 2 },
  ranking: { borderTopWidth: 1, paddingTop: Spacing.two },
  gain: { borderRadius: 14, padding: Spacing.three, gap: 2 },
  gainAmount: { fontSize: 30, lineHeight: 38, fontWeight: 800 },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 6 },
  lineLabel: { fontSize: 16, lineHeight: 22 },
  strong: { fontWeight: 700 },
  right: { alignItems: 'flex-end' },
});
