import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ImportButtons } from '@/components/import-buttons';
import { GoalsCard } from '@/components/goals-card';
import { InflationCard } from '@/components/inflation-card';
import { PowerSection } from '@/components/power-section';
import { PortfoliosCard } from '@/components/portfolios-card';
import { PremiumGate } from '@/components/premium-gate';
import { RemindersCard } from '@/components/reminders-card';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Disclaimer, Screen, ScreenHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { isLaunched } from '@/lib/entitlements';
import { useStore } from '@/state/store';

/** Everything the user acts with — report card, calculators, yardstick, goals, reminders, portfolios. */
export default function ToolsScreen() {
  const hasPortfolios = useStore((s) => (s.settings.portfolios?.length ?? 0) > 0);
  return (
    <Screen>
      <ScreenHeader eyebrow="Ölç, karşılaştır, takip et" title="Araçlar" />

      <PowerSection />

      <ThemedText style={styles.section}>Araçlar ve ayarlar</ThemedText>

      <Card>
        <View style={styles.grid}>
          <Button title="TÜFE karnem" onPress={() => router.push('/karne')} />
          <Button title="Hızlı reel getiri hesabı" kind="secondary" onPress={() => router.push('/tools/calculator')} />
          <ImportButtons />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Karne her ay TÜFE açıklanınca güncellenir; paylaşılabilir görselinde tutarlar yer almaz.
        </ThemedText>
      </Card>

      <InflationCard />

      {isLaunched('goals') && (
        <PremiumGate feature="goals" pitch="“Reel getirim eksiye düşerse haber ver” alarmı ve bugünün lirasıyla bir hedef koy; ulaşınca bildirim gelsin.">
          <GoalsCard />
        </PremiumGate>
      )}

      <RemindersCard />

      {/* Hidden at launch, but anyone who already made portfolios can still rename or delete them. */}
      {(isLaunched('portfolios') || hasPortfolios) && (
        <PremiumGate feature="portfolios" pitch="Senin, eşinin, çocuğunun birikimini ayrı portföylerde izle.">
          <PortfoliosCard />
        </PremiumGate>
      )}

      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 22, lineHeight: 28, fontWeight: 800, marginTop: Spacing.two },
  grid: { gap: Spacing.two },
});
