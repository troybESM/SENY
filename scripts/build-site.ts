/**
 * Assembles the deployable static site into dist/site/.
 *
 * Layout produced:
 *   dist/site/
 *     index.html                 (from web/)
 *     data/manifest.json         (from data/processed/)
 *     data/securities/<ID>.json
 *
 * The site fetches ./data/manifest.json at runtime, so the processed dataset
 * must ship alongside the HTML. This step is what the GitHub Actions workflow
 * syncs to S3.
 */

import { cp, mkdir, rm, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WEB = join(ROOT, "web");
const DATA = join(ROOT, "data", "processed");
const OUT = join(ROOT, "dist", "site");

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  if (!(await exists(join(DATA, "manifest.json")))) {
    throw new Error(
      `No dataset found at ${DATA}. Run "npm run fetch:data" (needs TIINGO_TOKEN) first.`,
    );
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  // Web assets (index.html, etc.)
  await cp(WEB, OUT, { recursive: true });

  // Processed dataset -> dist/site/data/
  await cp(DATA, join(OUT, "data"), { recursive: true });

  console.log(`Built site -> ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
