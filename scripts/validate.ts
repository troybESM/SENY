/**
 * Dataset validation. Runs on every fetched series before it's written, so bad
 * data never silently enters the game. Returns human-readable issues; the
 * fetch script decides whether to warn or hard-fail.
 */

import type { DailyBar } from "../src/data/schema.js";

export interface ValidationResult {
  errors: string[]; // disqualifying: series should not be written
  warnings: string[]; // suspicious but tolerable
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateBars(id: string, bars: DailyBar[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (bars.length === 0) {
    errors.push(`${id}: no bars returned`);
    return { errors, warnings };
  }

  let prevDate = "";
  let nonMonotonic = 0;
  let badOhlc = 0;
  let nonPositive = 0;
  let zeroVol = 0;

  for (const b of bars) {
    if (!ISO_DATE.test(b.d)) {
      errors.push(`${id}: bad date format "${b.d}"`);
      break;
    }
    if (b.d <= prevDate) nonMonotonic++;
    prevDate = b.d;

    if (![b.o, b.h, b.l, b.c].every((n) => Number.isFinite(n))) {
      errors.push(`${id}: non-finite price on ${b.d}`);
      break;
    }
    if (b.o <= 0 || b.h <= 0 || b.l <= 0 || b.c <= 0) nonPositive++;
    // High should be the max and low the min of the bar.
    if (b.h < Math.max(b.o, b.c, b.l) || b.l > Math.min(b.o, b.c, b.h)) badOhlc++;
    if (b.v === 0) zeroVol++;
  }

  if (nonMonotonic > 0) errors.push(`${id}: ${nonMonotonic} out-of-order/duplicate dates`);
  if (nonPositive > 0) errors.push(`${id}: ${nonPositive} bars with non-positive prices`);
  if (badOhlc > 0) warnings.push(`${id}: ${badOhlc} bars where high/low don't bound open/close`);
  if (zeroVol > 0) warnings.push(`${id}: ${zeroVol} bars with zero volume (common for old data)`);

  return { errors, warnings };
}
