import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { clearCrash, crashReportUrl, readCrash, type CrashReport } from '@/lib/crash';

/**
 * After the app closed on an error, asks once whether to e-mail the report. Sending is the user's
 * choice; "Gönderme" forgets it.
 */
export function CrashReportCard() {
  const [report, setReport] = useState<CrashReport>();
  useEffect(() => {
    void readCrash().then(setReport);
  }, []);
  if (!report) return null;
  const done = () => {
    clearCrash();
    setReport(undefined);
  };
  return (
    <Card>
      <ThemedText type="smallBold">ParaLens geçen sefer bir hatayla karşılaştı</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Hata raporunu e-postayla gönderirsen düzeltmemize yardım edersin. Raporda tutar ya da varlık bilgisi yok; göndermeden
        önce e-postada ne yazdığını görebilirsin.
      </ThemedText>
      <View style={styles.row}>
        <Button
          title="Raporu gönder"
          compact
          onPress={() => {
            void Linking.openURL(crashReportUrl(report));
            done();
          }}
        />
        <Button title="Gönderme" kind="secondary" compact onPress={done} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
});
