/**
 * Data spike / build step.
 *
 * Pipeline:  ROSTER  ->  SourceAdapter.fetchDaily  ->  validate  ->  emit
 *
 * Emits the canonical dataset under data/processed/:
 *   - manifest.json                (roster index, no bars)
 *   - securities/<ID>.json         (one Security per ticker, with bars)
 *
 * Run:  TIINGO_TOKEN=xxxx npm run fetch:data
 *
 * To add stocks: edit scripts/roster.ts.
 * To add a source: implement SourceAdapter, register it in ADAPTERS below.
 */

import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SCHEMA_VERSION,
  type DatasetManifest,
  type ManifestEntry,
  type Security,
} from "../src/data/schema.js";
import { ROSTER, type RosterEntry } from "./roster.js";
import type { SourceAdapter } from "./sources/adapter.js";
import { TiingoAdapter } from "./sources/tiingo.js";
import { validateBars } from "./validate.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "data", "processed");
const SEC_DIR = join(OUT_DIR, "securities");

/** Registered adapters, keyed by id. Add new sources here. */
const ADAPTERS: Record<string, SourceAdapter> = {
  tiingo: new TiingoAdapter(),
};

/** Which source to use, in priority order, given what a roster entry offers. */
const SOURCE_PRIORITY = ["tiingo"] as const;

function pickSource(entry: RosterEntry): { adapter: SourceAdapter; symbol: string } | null {
  for (const key of SOURCE_PRIORITY) {
    const symbol = entry.sources[key as keyof typeof entry.sources];
    if (symbol && ADAPTERS[key]) return { adapter: ADAPTERS[key], symbol };
  }
  return null;
}

async function main(): Promise<void> {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(SEC_DIR, { recursive: true });

  const manifestEntries: ManifestEntry[] = [];
  let coverageStart = "9999-99-99";
  let coverageEnd = "0000-00-00";
  let ok = 0;
  let failed = 0;

  for (const entry of ROSTER) {
    const picked = pickSource(entry);
    if (!picked) {
      console.warn(`SKIP ${entry.id}: no registered source available`);
      failed++;
      continue;
    }
    const { adapter, symbol } = picked;

    try {
      process.stdout.write(`Fetching ${entry.id} via ${adapter.id} (${symbol}) ... `);
      const series = await adapter.fetchDaily(symbol);

      const { errors, warnings } = validateBars(entry.id, series.bars);
      if (errors.length) {
        console.log("INVALID");
        errors.forEach((e) => console.warn(`  ERROR: ${e}`));
        failed++;
        continue;
      }
      warnings.forEach((w) => console.warn(`\n  warn: ${w}`));

      const firstDate = series.bars[0]!.d;
      const lastDate = series.bars[series.bars.length - 1]!.d;

      const security: Security = {
        schemaVersion: SCHEMA_VERSION,
        id: entry.id,
        name: entry.name ?? series.meta?.name ?? entry.id,
        sector: entry.sector,
        exchange: entry.exchange ?? series.meta?.exchange,
        listedFrom: series.meta?.listedFrom,
        delistedOn: series.meta?.delistedOn,
        provenance: {
          source: adapter.id,
          sourceSymbol: symbol,
          fetchedAt: new Date().toISOString(),
          adjustment: series.adjustment,
        },
        bars: series.bars,
      };

      const file = join("securities", `${entry.id}.json`);
      await writeFile(join(OUT_DIR, file), JSON.stringify(security), "utf8");

      manifestEntries.push({
        id: security.id,
        name: security.name,
        sector: security.sector,
        exchange: security.exchange,
        file,
        firstDate,
        lastDate,
        barCount: series.bars.length,
        delistedOn: security.delistedOn,
      });

      if (firstDate < coverageStart) coverageStart = firstDate;
      if (lastDate > coverageEnd) coverageEnd = lastDate;

      console.log(`OK  ${series.bars.length} bars  ${firstDate} -> ${lastDate}`);
      ok++;
    } catch (err) {
      console.log("FAILED");
      console.warn(`  ${(err as Error).message}`);
      failed++;
    }
  }

  if (manifestEntries.length === 0) {
    throw new Error("No securities were fetched; refusing to write an empty manifest.");
  }

  const manifest: DatasetManifest = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    coverageStart,
    coverageEnd,
    securities: manifestEntries.sort((a, b) => a.id.localeCompare(b.id)),
  };
  await writeFile(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  console.log(
    `\nDone. ${ok} ok, ${failed} failed. Coverage ${coverageStart} -> ${coverageEnd}. ` +
      `Wrote ${OUT_DIR}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
