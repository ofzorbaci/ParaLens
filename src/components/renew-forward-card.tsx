import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Field, Pct } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { defaultWithholding, depositValue } from '@/lib/deposit';
import { formatDate, formatMonth, formatRate, formatTL, parseAmount, todayISO } from '@/lib/format';
import { averageRateFor, compoundToSimple, forwardReal, lastTermReal, rankOffers } from '@/lib/renew-forward';
import type { Holding } from '@/lib/types';
import { useStore } from '@/state/store';

const MAX_OFFERS = 4;

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
  const [offers, setOffers] = useState([{ bank: '', rate: '' }]);
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

  return (
    <Card>
      <ThemedText style={styles.cardTitle}>Bankaları karşılaştır</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Bankaların bu vade için teklif ettiği faizleri yaz; hangisinin 12 ayda bugünün lirasıyla ne kazandıracağını
        yan yana gör. Beklenen enflasyon {formatRate(cpi)} (TCMB Piyasa Katılımcıları Anketi,{' '}
        {formatMonth(expectations.month)}). {term} gün vade, {formatRate(withholding)} stopaj.
      </ThemedText>

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
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 6 },
  lineLabel: { fontSize: 16, lineHeight: 22 },
  strong: { fontWeight: 700 },
  right: { alignItems: 'flex-end' },
});
