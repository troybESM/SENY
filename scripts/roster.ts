/**
 * The curated roster.
 *
 * THIS IS THE FILE YOU EDIT TO ADD STOCKS. Each entry maps a canonical,
 * source-independent game id (e.g. "AAPL") to the metadata the game shows and
 * to per-source symbols (e.g. Stooq wants "aapl.us"). To add a new data source
 * later, add another key under `sources` — nothing else changes.
 */

export interface RosterEntry {
  /** Canonical id used throughout the game. */
  id: string;
  name: string;
  sector?: string;
  exchange?: string;
  /** Per-source symbols. Key = adapter id, value = that source's symbol. */
  sources: {
    tiingo?: string;
    // crsp?: string;    // future
    // norgate?: string; // future
  };
}

/**
 * A small starter set of storied US companies with long, free daily history.
 * Deliberately mixes survivors (still trading) so the spike returns real data
 * we can eyeball. Expand freely — the fetcher iterates this list.
 */
export const ROSTER: RosterEntry[] = [
  { id: "IBM", name: "International Business Machines", sector: "Technology", exchange: "NYSE", sources: { tiingo: "IBM" } },
  { id: "GE", name: "General Electric", sector: "Industrials", exchange: "NYSE", sources: { tiingo: "GE" } },
  { id: "KO", name: "The Coca-Cola Company", sector: "Consumer Staples", exchange: "NYSE", sources: { tiingo: "KO" } },
  { id: "GM", name: "General Motors", sector: "Consumer Discretionary", exchange: "NYSE", sources: { tiingo: "GM" } },
  { id: "XOM", name: "Exxon Mobil", sector: "Energy", exchange: "NYSE", sources: { tiingo: "XOM" } },
  { id: "PG", name: "Procter & Gamble", sector: "Consumer Staples", exchange: "NYSE", sources: { tiingo: "PG" } },
  { id: "AAPL", name: "Apple Inc.", sector: "Technology", exchange: "NASDAQ", sources: { tiingo: "AAPL" } },
];
