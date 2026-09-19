/**
 * The source-adapter seam.
 *
 * Every data source (Tiingo now; CRSP, Norgate, Twelve Data later) implements
 * this one interface. The fetch pipeline only knows about `SourceAdapter`, so
 * adding a source is: write a file here that implements it, and register it.
 * Nothing in the pipeline, schema, or game changes.
 */

import type { AdjustmentKind, DailyBar } from "../../src/data/schema.js";

/** What an adapter returns for one instrument. */
export interface FetchedSeries {
  /** How the price fields were adjusted. */
  adjustment: AdjustmentKind;
  /** Optional metadata the source knows and the roster may not. */
  meta?: {
    name?: string;
    exchange?: string;
    listedFrom?: string;
    delistedOn?: string;
  };
  /** Daily bars, ascending by date. */
  bars: DailyBar[];
}

export interface SourceAdapter {
  /** Stable id, matches the key under a roster entry's `sources`. */
  readonly id: string;
  /**
   * Fetch the full available daily history for a source-specific symbol.
   * Throws on hard failure (network, auth, unknown symbol).
   */
  fetchDaily(sourceSymbol: string): Promise<FetchedSeries>;
}
