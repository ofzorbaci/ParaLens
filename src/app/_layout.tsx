import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { Sora_700Bold } from '@expo-google-fonts/sora';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Linking, useColorScheme, View } from 'react-native';

import { AppLock } from '@/components/app-lock';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { crashReportUrl, installCrashHandler, makeReport, saveCrash } from '@/lib/crash';
import { onNotificationOpen } from '@/lib/notify';
import { loadBudget } from '@/state/budget';
import { loadStore } from '@/state/store';

SplashScreen.preventAutoHideAsync();
// Uncaught errors are kept on the phone and offered as an e-mail report on the next launch.
installCrashHandler();

/** A screen that throws while rendering: say so, offer to retry and to send the report. */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  const report = makeReport(error, false);
  saveCrash(report);
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
      <ThemedText style={{ fontSize: 22, lineHeight: 28, fontWeight: 800 }}>Bir şeyler ters gitti</ThemedText>
      <ThemedText themeColor="textSecondary">
        Bu ekran açılamadı. Verilerin yerinde; tekrar deneyebilirsin. Hata raporunu gönderirsen düzeltmemize yardım edersin.
      </ThemedText>
      <Button title="Tekrar dene" onPress={() => void retry()} />
      <Button title="Hata raporu gönder" kind="secondary" onPress={() => void Linking.openURL(crashReportUrl(report))} />
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Sora_700Bold,
  });
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    Promise.all([loadStore(), loadBudget()]).finally(() => setDataLoaded(true));
    // A tapped reminder opens the screen it is about, e.g. "Yenilesem mi?" for a maturing deposit.
    return onNotificationOpen((url) => router.push(url as never));
  }, []);

  // A font that fails to load falls back to the system font rather than blocking the app.
  const ready = (fontsLoaded || !!fontError) && dataLoaded;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppLock>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Özet' }} />
        <Stack.Screen name="holding/edit" options={{ headerShown: false }} />
        <Stack.Screen name="holding/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="tools/calculator" options={{ headerShown: false }} />
        <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="renew/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="method" options={{ headerShown: false }} />
        <Stack.Screen name="import" options={{ headerShown: false }} />
        <Stack.Screen name="karne" options={{ headerShown: false }} />
        <Stack.Screen name="budget/transaction" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="budget/account" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="budget/payment" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="budget/payments" options={{ headerShown: false }} />
        <Stack.Screen name="budget/analysis" options={{ headerShown: false }} />
        <Stack.Screen name="budget/statement" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="my-inflation" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="privacy-proof" options={{ headerShown: false }} />
        <Stack.Screen name="prices" options={{ headerShown: false }} />
      </Stack>
      </AppLock>
    </ThemeProvider>
  );
}
