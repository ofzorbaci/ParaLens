// Applying a data feed to the store: hand the parts other modules read (withholding table, prices,
// holidays) to them, and build the store fields that come from the feed.

import { setHolidays } from '@/lib/business-day';
import { rateDecisionDates } from '@/lib/calendar';
import { buildCpiIndex } from '@/lib/cpi';
import { setWithholdingRules } from '@/lib/deposit';
import type { Feed } from '@/lib/feed-types';
import { setSecurityPrices } from '@/lib/securities';

export type FeedOrigin = 'bundled' | 'cached' | 'live';

/** Applies a feed; its CPI replaces the current series unless that one (read straight from TCMB) is newer. */
export function feedPatch(feed: Feed, origin: FeedOrigin, currentCpiMonth = '') {
  setWithholdingRules(feed.withholding);
  setSecurityPrices(feed.securities, feed.usQuotes);
  setHolidays(feed.holidays);
  const rows = feed.cpi.rows;
  return {
    feed,
    feedOrigin: origin,
    rateSchedule: rateDecisionDates(feed.rateDecisions.dates, feed.rateDecisions.time),
    ...(rows.at(-1)!.month >= currentCpiMonth && {
      cpi: { rows, index: buildCpiIndex(rows), live: origin === 'live' },
    }),
  };
}
