// Crash reports without a third-party service: an uncaught error is written to a small file on the
// phone; on the next launch the app asks whether to e-mail it. Nothing leaves the phone unless the
// user sends that e-mail, and the report holds no amounts or holdings, only the error and the
// app/device versions.

import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { SUPPORT_EMAIL } from './support';

export type CrashReport = { at: string; message: string; stack: string; appVersion: string; platform: string; fatal: boolean };

const NAME = 'paralens-son-hata.json';
const WEB_KEY = 'gg.lastCrash.v1';
/** Enough of the stack to find the line, short enough for a mail link. */
const STACK_LINES = 12;

export function makeReport(error: unknown, fatal: boolean, now = new Date()): CrashReport {
  const e = error instanceof Error ? error : new Error(String(error));
  return {
    at: now.toISOString(),
    message: e.message.slice(0, 300),
    stack: (e.stack ?? '').split('\n').slice(0, STACK_LINES).join('\n'),
    appVersion: Constants.expoConfig?.version ?? '?',
    platform: `${Platform.OS} ${Platform.Version ?? ''}`.trim(),
    fatal,
  };
}

/** The e-mail draft the user may send; they see and can edit every line before sending. */
export function crashReportUrl(r: CrashReport): string {
  const body = [
    'Ne yaparken oldu? (isteğe bağlı)',
    '',
    '',
    '— Otomatik eklenen hata bilgisi (tutar ya da varlık bilgisi içermez) —',
    `Zaman: ${r.at}`,
    `Uygulama: ${r.appVersion} · ${r.platform}${r.fatal ? ' · uygulama kapandı' : ''}`,
    `Hata: ${r.message}`,
    r.stack,
  ].join('\n');
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Hata raporu · ParaLens ${r.appVersion}`)}&body=${encodeURIComponent(body)}`;
}

function file(): File {
  return new File(new Directory(Paths.document), NAME);
}

/** Synchronous on the phone, so it lands even when the app is about to close. */
export function saveCrash(r: CrashReport) {
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(WEB_KEY, JSON.stringify(r));
      return;
    }
    const f = file();
    f.create({ overwrite: true });
    f.write(JSON.stringify(r));
  } catch {
    /* a crash report must never cause another crash */
  }
}

export async function readCrash(): Promise<CrashReport | undefined> {
  try {
    if (Platform.OS === 'web') {
      const raw = globalThis.localStorage?.getItem(WEB_KEY);
      return raw ? (JSON.parse(raw) as CrashReport) : undefined;
    }
    const f = file();
    return f.exists ? (JSON.parse(await f.text()) as CrashReport) : undefined;
  } catch {
    return undefined;
  }
}

export function clearCrash() {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(WEB_KEY);
    else if (file().exists) file().delete();
  } catch {
    /* nothing to clear */
  }
}

type ErrorUtilsLike = {
  getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler: (h: (error: unknown, isFatal?: boolean) => void) => void;
};

let installed = false;

/** Records uncaught errors, then hands them to React Native's own handler as before. */
export function installCrashHandler() {
  const utils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (installed || !utils) return;
  installed = true;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    saveCrash(makeReport(error, !!isFatal));
    previous(error, isFatal);
  });
}
