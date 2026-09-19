/**
 * Tiingo adapter. Free daily EOD history for US equities back to ~1962.
 *
 * Token is read from the TIINGO_TOKEN env var — never hardcoded, never
 * committed. Get a free token at https://www.tiingo.com/ (account -> API token).
 *
 * We use Tiingo's split/dividend-ADJUSTED fields (adjOpen/adjHigh/adjLow/
 * adjClose/adjVolume) as the canonical prices, so a long price series is
 * continuous through splits — which is what a "living through history" chart
 * should show.
 */

import type { DailyBar } from "../../src/data/schema.js";
import type { FetchedSeries, SourceAdapter } from "./adapter.js";

const BASE = "https://api.tiingo.com/tiingo/daily";

interface TiingoMeta {
  ticker: string;
  name?: string;
  exchangeCode?: string;
  startDate?: string;
  endDate?: string;
}

interface TiingoPrice {
  date: string;
  adjOpen: number;
  adjHigh: number;
  adjLow: number;
  adjClose: number;
  adjVolume: number;
}

function requireToken(): string {
  const token = process.env.TIINGO_TOKEN;
  if (!token) {
    throw new Error(
      "TIINGO_TOKEN env var is not set. Get a free token at https://www.tiingo.com/ " +
        "and run: TIINGO_TOKEN=xxxx npm run fetch:data",
    );
  }
  return token;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Tiingo request failed ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export class TiingoAdapter implements SourceAdapter {
  readonly id = "tiingo";

  async fetchDaily(sourceSymbol: string): Promise<FetchedSeries> {
    const token = requireToken();
    const sym = encodeURIComponent(sourceSymbol);

    const meta = await getJson<TiingoMeta>(`${BASE}/${sym}?token=${token}`);

    // No startDate => Tiingo returns the maximum available history for the ticker.
    const prices = await getJson<TiingoPrice[]>(
      `${BASE}/${sym}/prices?startDate=1900-01-01&token=${token}`,
    );

    const bars: DailyBar[] = prices
      .map((p) => ({
        d: p.date.slice(0, 10), // "YYYY-MM-DD"
        o: p.adjOpen,
        h: p.adjHigh,
        l: p.adjLow,
        c: p.adjClose,
        v: Number.isFinite(p.adjVolume) ? p.adjVolume : null,
      }))
      .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));

    return {
      adjustment: "split_dividend",
      meta: {
        name: meta.name,
        exchange: meta.exchangeCode,
        listedFrom: meta.startDate?.slice(0, 10),
      },
      bars,
    };
  }
}
