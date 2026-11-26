// One free rule: "İlk 30 gün her şey açık, sonra ParaLens Premium." For the first 30 days after
// the app is first opened every Premium feature works, no card or store trial needed. It replaces
// the 14-day personal-inflation taste, the free first maturity and the free first month of the
// dollar-based return, which were three rules for one idea.

export const TASTE_DAYS = 30;

/** Whole days of the free month left on `now`; 0 once it is over or before the first open is known. */
export function tasteDaysLeft(firstOpenAt: string | undefined, now: Date): number {
  if (!firstOpenAt) return 0;
  const end = Date.parse(firstOpenAt) + TASTE_DAYS * 86_400_000;
  return Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000));
}

/** Premium features are open: a subscription, or the first 30 days. */
export function premiumOpen(subscribed: boolean, firstOpenAt: string | undefined, now: Date = new Date()): boolean {
  return subscribed || tasteDaysLeft(firstOpenAt, now) > 0;
}
