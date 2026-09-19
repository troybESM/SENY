/**
 * Canonical dataset schema for the market-history game.
 *
 * DESIGN GOALS
 * ------------
 * 1. Source-agnostic. The game engine only ever sees this canonical shape.
 *    Where the data came from (Stooq now; CRSP, Norgate, etc. later) is an
 *    implementation detail captured in metadata, not in the shape the game
 *    consumes. Adding a new source = writing a new adapter that emits this
 *    same format. Nothing downstream changes.
 *
 * 2. Extensible without breaking. Every level carries a `schemaVersion` and
 *    optional fields are additive. Old datasets keep loading as fields are
 *    added.
 *
 * 3. Split on disk for scalability. A small `manifest.json` lists the roster;
 *    each ticker's bars live in their own file so the game can lazy-load only
 *    what a playthrough touches, and so adding a ticker never rewrites others.
 */

export const SCHEMA_VERSION = 1 as const;

/** ISO date, day-resolution: "YYYY-MM-DD". Trading day the bar belongs to. */
export type IsoDate = string;

/**
 * One daily OHLCV bar. Prices are split/dividend-ADJUSTED close-consistent
 * values unless `adjusted` is false in the series metadata. Volume is share
 * count. Nullable fields tolerate sparse historical records.
 */
export interface DailyBar {
  /** Trading date, "YYYY-MM-DD". */
  d: IsoDate;
  /** Open. */
  o: number;
  /** High. */
  h: number;
  /** Low. */
  l: number;
  /** Close. */
  c: number;
  /** Volume (shares). May be 0/null for very old or illiquid records. */
  v: number | null;
}

/** How prices in a series were adjusted. */
export type AdjustmentKind =
  | "raw" // as-traded prices, no adjustment
  | "split" // adjusted for splits only
  | "split_dividend"; // total-return adjusted (splits + dividends)

/**
 * Identifies where a series came from and how it was processed, so the game
 * (and future you) can reason about quality and reproduce the pull.
 */
export interface SeriesProvenance {
  /** Adapter id that produced this series, e.g. "stooq". */
  source: string;
  /** The symbol as requested from that source, e.g. "aapl.us". */
  sourceSymbol: string;
  /** When this series was fetched/processed (ISO timestamp). */
  fetchedAt: string;
  /** Adjustment applied to the price fields. */
  adjustment: AdjustmentKind;
}

/**
 * A single instrument's full daily history plus everything the game needs to
 * present it as a company you can "live through".
 */
export interface Security {
  schemaVersion: typeof SCHEMA_VERSION;
  /** Canonical, source-independent id used everywhere in the game, e.g. "AAPL". */
  id: string;
  /** Display name, e.g. "Apple Inc.". */
  name: string;
  /** Optional: sector/industry for flavor and filtering. */
  sector?: string;
  /** Optional: primary exchange, e.g. "NASDAQ". */
  exchange?: string;
  /**
   * Optional listing lifecycle. `delisted` powers "living through history"
   * drama (bankruptcies, buyouts). Absent = still trading / unknown.
   */
  listedFrom?: IsoDate;
  delistedOn?: IsoDate;
  /** Why it left the market, if known: "bankruptcy" | "acquired" | "merged" | ... */
  delistReason?: string;
  /** Provenance for the bars below. */
  provenance: SeriesProvenance;
  /** Daily bars, ascending by date, no gaps beyond real market holidays. */
  bars: DailyBar[];
}

/** One roster entry in the manifest (lightweight; no bars). */
export interface ManifestEntry {
  id: string;
  name: string;
  sector?: string;
  exchange?: string;
  /** Relative path to the security's data file, e.g. "securities/AAPL.json". */
  file: string;
  /** First and last dates present, for quick range checks without loading bars. */
  firstDate: IsoDate;
  lastDate: IsoDate;
  barCount: number;
  delistedOn?: IsoDate;
}

/** Top-level dataset index. Small enough to always load up front. */
export interface DatasetManifest {
  schemaVersion: typeof SCHEMA_VERSION;
  /** When the dataset as a whole was generated. */
  generatedAt: string;
  /** Earliest and latest dates across all securities (dataset envelope). */
  coverageStart: IsoDate;
  coverageEnd: IsoDate;
  /** The roster. */
  securities: ManifestEntry[];
}
