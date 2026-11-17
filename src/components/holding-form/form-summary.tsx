// Part of the add/edit holding form (src/app/holding/edit.tsx): the live result under the fields,
// the privacy note and the "are you sure?" warnings.

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, Pct, Row } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatPct, formatRate } from '@/lib/format';
import type { HoldingAnalysis } from '@/lib/returns';
import type { Warning } from '@/lib/validate';

type Props = {
  preview: HoldingAnalysis | undefined;
  /** a TRY deposit: the result is after withholding */
  tlDeposit: boolean;
  /** deposits: the yearly net rate under the result */
  netRate: number | undefined;
  warnings: Warning[];
  showWarnings: boolean;
};

export function FormSummary({ preview, tlDeposit, netRate, warnings, showWarnings }: Props) {
  const theme = useTheme();
  return (
    <>
      {preview && preview.real !== undefined && (
        <View style={[styles.preview, { backgroundColor: theme.info }]}>
          <ThemedText type="smallBold" style={{ color: theme.infoText }}>
            Anlık hesap
          </ThemedText>
          <Row label={tlDeposit ? 'Stopaj sonrası net getiri' : 'TL getiri'} value={formatPct(preview.nominal!, false)} strong />
          <Row label="Aynı dönem enflasyon" value={formatPct(preview.inflation.factor - 1, false)} strong />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.total}>
            <ThemedText style={[styles.totalLabel, { color: theme.infoText }]}>Reel getirin</ThemedText>
            <Pct ratio={preview.real} size={28} />
          </View>
          {netRate !== undefined && (
            <ThemedText type="small" themeColor="textSecondary">
              Yıllık net faiz {formatRate(netRate)}
            </ThemedText>
          )}
        </View>
      )}

      <View style={styles.lock}>
        <Icon name={{ ios: 'lock', android: 'lock', web: 'lock' }} size={16} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary">
          Verilerin yalnızca telefonunda saklanır
        </ThemedText>
      </View>
      {showWarnings && warnings.length > 0 && (
        <View style={[styles.warn, { backgroundColor: theme.negativeSoft, borderColor: theme.negativeBorder }]}>
          <ThemedText type="smallBold" style={{ color: theme.negative }}>
            Emin misin?
          </ThemedText>
          {warnings.map((w) => (
            <ThemedText key={w.field} type="small" style={{ color: theme.negative }}>
              • {w.message}
            </ThemedText>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  preview: { borderRadius: 20, padding: 20, gap: Spacing.two },
  divider: { height: 1, marginVertical: Spacing.one },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 18, fontWeight: 700 },
  warn: { borderWidth: 1, borderRadius: 16, padding: Spacing.three, gap: 4 },
  lock: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
});
