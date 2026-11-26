import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Pct } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useMasked } from '@/hooks/use-masked';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatTL } from '@/lib/format';
import { assetCode } from '@/lib/lookup';
import { fundVsDeposit, isMoneyMarket } from '@/lib/money-market';
import { fundInfo } from '@/lib/securities';
import { useStore } from '@/state/store';

/**
 * "Fonun mu, mevduat mı?" for each money-market fund the user holds: the fund's last month against
 * one month of the average deposit, refreshed with each TEFAS price.
 */
export function MoneyMarketCard() {
  const theme = useTheme();
  useMasked();
  const holdings = useStore((s) => s.holdings);
  const rates = useStore((s) => s.feed.depositRates);
  // The fund book arrives after the first render; re-read when prices change.
  useStore((s) => s.prices);

  const rows = holdings
    .filter((h) => h.kind === 'fund' && !h.sample)
    .map((h) => {
      const code = assetCode(h.name);
      const f = code ? fundInfo(code) : undefined;
      if (!f || !isMoneyMarket(f)) return undefined;
      const r = fundVsDeposit(f, rates, h.quantity * f.price);
      return r && { id: h.id, code: f.code, date: f.date, ...r };
    })
    .filter((x) => x !== undefined);
  if (rows.length === 0 || !rates) return null;

  return (
    <Card>
      <ThemedText style={styles.title}>Bu hafta: fonun mu, mevduat mı?</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Para piyasası fonunun son 1 aylık getirisi, aynı süre ortalama mevduatla (TCMB, 32 gün vade, {formatDate(rates.date)}{' '}
        haftası). İkisi de stopaj öncesi.
      </ThemedText>
      {rows.map((r) => (
        <View key={r.id} style={[styles.row, { borderColor: theme.border }]}>
          <View style={styles.line}>
            <ThemedText type="smallBold" style={styles.flex}>
              {r.code} · son 1 ay
            </ThemedText>
            <Pct ratio={r.fund} size={16} />
          </View>
          <View style={styles.line}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              Ortalama mevduat, 1 ay
            </ThemedText>
            <Pct ratio={r.deposit} size={16} />
          </View>
          <ThemedText type="small" style={{ color: r.gap >= 0 ? theme.positive : theme.negative }}>
            {r.gap >= 0
              ? `Fon önde: bu tutarda ayda yaklaşık ${formatTL(r.lira)} fazla.`
              : `Mevduat önde: bu tutarda ayda yaklaşık ${formatTL(-r.lira)} fazla.`}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Fon fiyatı {formatDate(r.date)}
          </ThemedText>
        </View>
      ))}
      <ThemedText type="small" themeColor="textSecondary">
        Fon parana her gün ulaşmanı sağlar; mevduatta vade dolmadan çekersen faiz yanar. Geçmiş getiri, geleceği
        göstermez · Yatırım tavsiyesi değildir.
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  flex: { flex: 1 },
  row: { borderTopWidth: 1, paddingTop: Spacing.two, gap: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
