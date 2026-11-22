import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Disclaimer, IconButton, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatTL, todayISO } from '@/lib/format';
import { isBrokerStatement, parseBrokerStatement } from '@/lib/broker-statement';
import { pdfLines, PdfTimeout } from '@/lib/budget/statement-pdf';
import { parseSpreadsheet, templateWorkbook, type ImportRow } from '@/lib/spreadsheet';
import { pickSpreadsheet, shareWorkbook } from '@/lib/spreadsheet-file';
import { KIND_LABELS } from '@/lib/types';
import { plausibilityWarnings } from '@/lib/validate';
import { newId } from '@/lib/ids';
import { addHoldings, useStore } from '@/state/store';

/** Bulk import from Excel/CSV with a preview: nothing is written until the user confirms. */
export default function ImportScreen() {
  const theme = useTheme();
  const prices = useStore((s) => s.prices);
  const [file, setFile] = useState<string>();
  const [rows, setRows] = useState<ImportRow[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState<string>();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const valid = rows?.filter((r) => r.holding) ?? [];
  const invalid = rows?.filter((r) => r.errors.length > 0) ?? [];
  const notes = rows?.filter((r) => r.note && r.errors.length === 0 && !r.routine) ?? [];
  const routine = rows?.filter((r) => r.routine).length ?? 0;

  const pick = async () => {
    setError(undefined);
    setBusy(true);
    try {
      const picked = await pickSpreadsheet();
      if (!picked) return;
      setFile(picked.name);
      // A broker's PDF statement ("Hesap Ekstresi"): its trade lines go through the same importer.
      if (/\.pdf$/i.test(picked.name) && typeof picked.data !== 'string') {
        setProgress('PDF açılıyor…');
        const lines = await pdfLines(picked.data, (done, total) => setProgress(`Ekstre okunuyor: ${done} / ${total} sayfa`));
        if (!isBrokerStatement(lines)) {
          setRows(undefined);
          setError('Bu PDF’te hisse alış ya da satış satırı bulunamadı. Aracı kurumunun hesap ekstresini seç.');
          return;
        }
        setRows(parseBrokerStatement(lines, todayISO(), newId));
        return;
      }
      const parsed = parseSpreadsheet(picked.data, todayISO(), newId);
      setRows(parsed);
      if (parsed.length === 0) setError('Dosyada okunacak satır bulunamadı.');
    } catch (e) {
      if (e instanceof PdfTimeout) {
        setError(`${e.message}: okuma çok uzun sürdü. Uygulamayı kapatıp yeniden dene; sürerse bize bildir.`);
        return;
      }
      setError('Dosya okunamadı. Excel (.xlsx, .xls), CSV ya da aracı kurum PDF ekstresi olduğundan emin ol.');
    } finally {
      setProgress(undefined);
      setBusy(false);
    }
  };

  return (
    <Screen tabs={false}>
      <View style={styles.header}>
        <IconButton name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} label="Geri" onPress={close} />
        <ThemedText style={styles.title}>İçe aktar</ThemedText>
      </View>

      <Card>
        <ThemedText type="smallBold">1. Şablonu indir ve doldur</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          “İşlemler” sayfasına her varlığı bir satır olarak yaz; tarih yyyy-aa-gg biçiminde. “Varlık Tipleri” sayfası
          hangi sütunun ne istediğini anlatıyor.
        </ThemedText>
        <Button title="Excel şablonunu indir" kind="secondary" onPress={() => shareWorkbook(templateWorkbook(), 'paralens-sablon.xlsx')} />
      </Card>

      <Card>
        <ThemedText type="smallBold">2. Dosyanı seç</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Başka portföy uygulamalarından ya da aracı kurumundan aldığın Excel/CSV dosyasını ya da PDF hesap ekstresini de
          seçebilirsin; yaygın sütunları tanırız (Sembol, Adet, Alış Fiyatı, İşlem Tutarı, Tarih…). İşlem geçmişindeki
          satışlar en eski alışlardan düşülür, temettü satırları atlanır; elinde kalan varlıklar eklenir. Ekstre yalnızca
          seçtiğin tarih aralığını kapsar: daha önce aldığın hisseler için not düşeriz.
        </ThemedText>
        <Button title="Excel, CSV ya da PDF seç" onPress={pick} disabled={busy} />
        {busy && <ActivityIndicator />}
        {progress && (
          <ThemedText type="small" themeColor="textSecondary">
            {progress}
          </ThemedText>
        )}
        {error && <ThemedText type="small" style={{ color: theme.negative }}>{error}</ThemedText>}
      </Card>

      {rows && rows.length > 0 && (
        <Card>
          <ThemedText type="smallBold">3. Kontrol et</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {file} · {valid.length} varlık okundu{invalid.length ? `, ${invalid.length} satır okunamadı` : ''}. Onaylamadan
            hiçbir kayıt yazılmaz.
          </ThemedText>
          {valid.map((r) => {
            const h = r.holding!;
            const warn = plausibilityWarnings(h, { prices })[0];
            return (
              <View key={r.line} style={[styles.row, { borderColor: theme.border }]}>
                <ThemedText type="smallBold">
                  {h.name} · {KIND_LABELS[h.kind]}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDate(h.buyDate)} · {h.kind === 'deposit' ? formatTL(h.unitCost) : `${h.quantity} × ${formatTL(h.unitCost, true)}`}
                  {h.grossRate !== undefined ? ` · brüt %${h.grossRate}` : ''}
                </ThemedText>
                {warn && (
                  <ThemedText type="small" style={{ color: theme.negative }}>
                    Kontrol et: {warn.message}
                  </ThemedText>
                )}
              </View>
            );
          })}
          {routine > 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              {routine} satış ve kapanan alış eşleştirildi; elinde kalan adetler hesaplandı.
            </ThemedText>
          )}
          {notes.map((r) => (
            <ThemedText key={`n${r.line}`} type="small" themeColor="textSecondary">
              Satır {r.line}: {r.note}
            </ThemedText>
          ))}
          {invalid.map((r) => (
            <View key={r.line} style={[styles.row, { borderColor: theme.negativeBorder }]}>
              <ThemedText type="smallBold" style={{ color: theme.negative }}>
                Satır {r.line} okunamadı
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.negative }}>
                {r.errors.join(' · ')}
              </ThemedText>
            </View>
          ))}
          <Button
            title={`${valid.length} varlığı ekle`}
            disabled={valid.length === 0}
            onPress={() => {
              addHoldings(valid.map((r) => r.holding!));
              router.replace('/holdings');
            }}
          />
        </Card>
      )}

      <Disclaimer text="Dosyan telefonunda okunur; hiçbir sunucuya gönderilmez." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { fontSize: 26, lineHeight: 32, fontWeight: 800, flex: 1 },
  row: { borderTopWidth: 1, paddingTop: Spacing.two, gap: 2 },
});
