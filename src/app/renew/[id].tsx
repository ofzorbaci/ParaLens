import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { openPaywall, PremiumGate, usePremium } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { RenewForwardCard, signedTL } from '@/components/renew-forward-card';
import { Button, Card, Choice, Disclaimer, IconButton, Pct, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useMasked } from '@/hooks/use-masked';
import { useTheme } from '@/hooks/use-theme';
import { isTlDeposit } from '@/lib/deposit';
import { formatLongDate, formatPct, todayISO } from '@/lib/format';
import { nextMaturity, RENEW_WINDOWS, renewComparison, type RenewWindow } from '@/lib/renew';
import { liraOutcomes, liraSpread, renewRanking } from '@/lib/renew-forward';
import { payout } from '@/lib/business-day';
import { recordRenewView, setMaturityReminders, updateSettings, useStore } from '@/state/store';

const WINDOW_LABEL: Record<RenewWindow, string> = { 1: 'Son 1 ay', 3: 'Son 3 ay', 12: 'Son 12 ay' };

export default function RenewScreen() {
  const theme = useTheme();
  useMasked();
  const { id } = useLocalSearchParams<{ id: string }>();
  const h = useStore((s) => s.allHoldings.find((x) => x.id === id));
  const settings = useStore((s) => s.calcSettings);
  const notifyMaturity = useStore((s) => s.settings.notifyMaturity ?? false);
  const index = useStore((s) => s.cpi.index);
  const prices = useStore((s) => s.prices);
  const markets = useStore((s) => s.feed.markets);
  const subscribed = usePremium();
  const freeRenew = useStore((s) => s.settings.freeRenew);
  const [chosen, setChosen] = useState<string>('12');
  const today = todayISO();
  const maturityDate = h ? nextMaturity(h, today) : undefined;
  // The first maturity a free user opens is shown in full, once; later ones are Premium.
  // Only a real TL deposit with a maturity uses it: not the example portfolio, not an FX deposit.
  const giftable = !!h && isTlDeposit(h) && !h.sample && !!maturityDate;
  const gift = !subscribed && giftable && (!freeRenew || (freeRenew.id === h?.id && freeRenew.maturity === maturityDate));
  const premium = subscribed || gift;
  useEffect(() => {
    if (gift && !freeRenew && h && maturityDate) updateSettings({ freeRenew: { id: h.id, maturity: maturityDate } });
  }, [gift, freeRenew, h, maturityDate]);
  // Free users see the last month's ranking; the lira amounts and longer windows are Premium.
  const window = (premium ? Number(chosen) : 1) as RenewWindow;
  const result = h ? renewComparison(h, window, today, prices, markets, settings, index) : undefined;
  const maturity = maturityDate;
  const spread = h && result && maturity && premium ? liraSpread(result, h, today) : 0;

  useEffect(() => {
    if (h && maturity && spread > 0) recordRenewView(h.id, maturity, spread);
  }, [h, maturity, spread]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!h || h.kind !== 'deposit' || h.depositCurrency) {
    return (
      <Screen tabs={false}>
        <ThemedText>“Yenilesem mi?” karşılaştırması TL mevduatlar için.</ThemedText>
        <Button title="Geri" kind="secondary" onPress={close} />
      </Screen>
    );
  }

  const daysLeft = maturity ? Math.round((Date.parse(maturity) - Date.parse(today)) / 86_400_000) : undefined;
  // A maturity on a weekend or public holiday is paid on the next business day.
  const paid = maturity ? payout(maturity) : undefined;
  const lira = result ? new Map(liraOutcomes(result, h, today).map((x) => [x.key, x.lira])) : undefined;

  return (
    <Screen tabs={false}>
      <View style={styles.header}>
        <IconButton name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} label="Geri" onPress={close} />
        <View style={styles.flex}>
          <ThemedText style={styles.title}>Yenilesem mi?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {h.name}
            {maturity ? ` · vade ${formatLongDate(maturity)}${daysLeft !== undefined && daysLeft <= 7 ? ` (${daysLeft === 0 ? 'bugün' : `${daysLeft} gün sonra`})` : ''}` : ''}
            {paid?.reason ? ` · ${paid.reason} olduğu için ödeme ${formatLongDate(paid.date)}` : ''}
          </ThemedText>
        </View>
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        Aynı parayı aynı dönemde farklı yerlerde tutsaydın, enflasyondan arındırılmış olarak hangisi daha iyi korurdu?
        Stopaj düşülmüş net faizle hesaplanır.
      </ThemedText>

      <Choice
        options={RENEW_WINDOWS.map((w) => ({ value: String(w), label: premium || w === 1 ? WINDOW_LABEL[w] : `${WINDOW_LABEL[w]} 🔒` }))}
        value={String(window)}
        onChange={(v) => (premium ? setChosen(v) : v !== '1' && openPaywall('renewUnlimited'))}
      />

      {gift && (
        <View style={[styles.locked, { backgroundColor: theme.info }]}>
          <ThemedText type="smallBold" style={{ color: theme.infoText }}>
            İlk vaden bizden: lira farkını ücretsiz görüyorsun
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.infoText }}>
            Bu vadede banka karşılaştırması ve lira farkı açık. Sonraki vadelerde Premium’la.
          </ThemedText>
        </View>
      )}

      {result && premium && lira && (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            {WINDOW_LABEL[window]} · aynı dönemde enflasyon {formatPct(result.inflation, false)}
          </ThemedText>
          {result.options.map((o) => (
            <View key={o.key} style={styles.option}>
              <View style={styles.flex}>
                <ThemedText style={styles.optionLabel}>{o.label}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  TL olarak {formatPct(o.nominal)} · bugünün lirasıyla {signedTL(lira.get(o.key)!)}
                </ThemedText>
              </View>
              <Pct ratio={o.real} size={22} />
            </View>
          ))}
          <ThemedText type="small" themeColor="textSecondary">
            Sağdaki rakam reel getiri: alım gücündeki değişim. Lira farkı, mevduatının bugünkü tutarı üzerinden.
            {!result.options.some((o) => o.key === 'gold') ? ' Bu dönem için altın verisi yok.' : ''}
          </ThemedText>
        </Card>
      )}

      {result && !premium && (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            Son 1 ayda alım gücünü en iyi koruyan:
          </ThemedText>
          {renewRanking(result).map((o, i) => (
            <View key={o.key} style={styles.option}>
              <ThemedText style={[styles.rank, { color: i === 0 ? theme.accent : theme.textSecondary }]}>{i + 1}.</ThemedText>
              <ThemedText style={[styles.optionLabel, styles.flex]}>{o.label}</ThemedText>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => openPaywall('renewUnlimited')}
            style={[styles.locked, { backgroundColor: theme.info }]}>
            <ThemedText type="smallBold" style={{ color: theme.infoText }}>
              🔒 Aradaki fark kaç lira? Son 3 ve 12 ayda ne olurdu?
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.infoText }}>
              Premium ile her seçeneğin bugünün lirasıyla sonucunu gör ›
            </ThemedText>
          </Pressable>
        </Card>
      )}

      {gift ? (
        <RenewForwardCard h={h} />
      ) : (
        <PremiumGate feature="renewForward" pitch="Bankaların teklif ettiği faizleri yan yana yaz; hangisinin 12 ayda bugünün lirasıyla kaç lira fazla kazandıracağını gör. İlk vaden ücretsizdi; sonraki vadeler Premium’la.">
          <RenewForwardCard h={h} />
        </PremiumGate>
      )}

      {Platform.OS !== 'web' && (
        <Card>
          <View style={styles.option}>
            <View style={styles.flex}>
              <ThemedText type="smallBold">Vade gününde hatırlat</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Mevduatların dolmadan 2 gün önce haber verelim.
              </ThemedText>
            </View>
            <Switch value={notifyMaturity} onValueChange={(on) => void setMaturityReminders(on)} trackColor={{ true: theme.accent, false: theme.border }} />
          </View>
        </Card>
      )}

      <Button title="Nasıl hesaplandı?" kind="secondary" onPress={() => router.push('/method')} />
      <Disclaimer text="Geçmişte ne olurdu ve beklenti hesabı gösterir; öneri değildir · Yatırım tavsiyesi değildir" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { fontSize: 26, lineHeight: 32, fontWeight: 800 },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 6 },
  optionLabel: { fontSize: 17, lineHeight: 23, fontWeight: 600 },
  rank: { fontSize: 20, lineHeight: 26, fontWeight: 800, width: 28 },
  locked: { borderRadius: 14, padding: Spacing.three, gap: 4, marginTop: Spacing.one },
});
