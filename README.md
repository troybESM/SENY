# market-history-game

A persistent, browser-based game where you **live through stock-market history** using
real daily market data. Deployable as a static site (S3/CloudFront). Local save now;
multiplayer planned.

This repo currently contains the **data spike**: a small, source-agnostic pipeline that
pulls real free daily OHLCV for a curated roster of stocks and emits a clean, extensible
dataset the game engine will consume.

## Status

- ✅ Canonical, source-independent dataset format (`src/data/schema.ts`)
- ✅ Source-adapter seam + Tiingo adapter (free daily EOD, US equities back to ~1962)
- ✅ Fetch → validate → emit pipeline
- ⬜ Game engine (SimClock, PriceEngine w/ deterministic synthetic intraday, Portfolio)
- ⬜ Persistence provider (LocalStorage now → remote later)
- ⬜ Static-site + CloudFormation deploy

## Data source & coverage

Data comes from [Tiingo](https://www.tiingo.com/) (free API token). Individual-stock daily
history reaches back to **1962** — the practical floor for free per-stock data.

> True 1926 *individual-stock* data exists only in CRSP (academic license). The format here
> is deliberately source-agnostic so a CRSP adapter can be added later without touching the
> game. See the design notes in `src/data/schema.ts`.

Prices are stored **split/dividend-adjusted** so long charts are continuous.

## Setup

```bash
npm install
```

Get a free Tiingo token (account → API token), then generate the dataset:

```bash
TIINGO_TOKEN=your_token_here npm run fetch:data
```

The token is read only from the `TIINGO_TOKEN` environment variable — it is never written
to a file and never committed.

Output lands in `data/processed/`:

```
data/processed/
  manifest.json            # roster index (no bars) — always load this first
  securities/<ID>.json     # one Security per ticker, with daily bars
```

## How to add a stock

Edit **`scripts/roster.ts`** — this is the only file you touch. Add an entry mapping a
canonical game id to display metadata and the per-source symbol, then re-run
`npm run fetch:data`:

```ts
{ id: "T", name: "AT&T", sector: "Communication Services", exchange: "NYSE",
  sources: { tiingo: "T" } },
```

- `id` is the canonical id used everywhere in the game (keep it stable).
- `sources.tiingo` is the symbol Tiingo expects (usually the ticker).

## How to add a data source

The pipeline only knows the `SourceAdapter` interface, so adding a source never touches the
schema or the game:

1. Create `scripts/sources/<name>.ts` implementing `SourceAdapter`
   (see `scripts/sources/tiingo.ts` as the reference).
2. Register it in `scripts/fetch-data.ts` under `ADAPTERS`, and add its id to
   `SOURCE_PRIORITY`.
3. Add a `sources.<name>` symbol to roster entries you want it to serve.

The adapter's job is to return `{ adjustment, meta?, bars[] }`; the pipeline validates and
writes the canonical format for you.

## Dataset format

Defined in `src/data/schema.ts` (`schemaVersion: 1`). Highlights:

- **Split on disk**: small `manifest.json` + one file per security → lazy-load only what a
  playthrough touches; adding a ticker never rewrites others.
- **Provenance** on every series (source, source symbol, fetch time, adjustment kind).
- **Listing lifecycle** fields (`listedFrom` / `delistedOn` / `delistReason`) to power
  "living through history" drama (bankruptcies, buyouts). Note: a delisting like GM's 2009
  bankruptcy shows up as a real gap — GM data resumes at the 2010 relisting.
- Compact bar keys (`d/o/h/l/c/v`) to keep JSON small.

## Scripts

| Command | What it does |
|---|---|
| `npm run fetch:data` | Fetch roster → validate → emit `data/processed/` (needs `TIINGO_TOKEN`) |
| `npm run build:site` | Assemble the deployable site into `dist/site/` (site + dataset) |
| `npm run typecheck` | Type-check the TypeScript |
| `npm run build` | Compile TypeScript to `dist/` |

## Deployment (S3 + CloudFront)

Hosting is a **private S3 bucket served through CloudFront** using Origin Access
Control — the bucket is never public and all traffic is HTTPS. Infrastructure is
defined in `infra/static-site.yaml` (CloudFormation) and deployed by the
`Build & Deploy to S3` GitHub Actions workflow on every push to `main`.

The workflow: deploy/update the CFN stack → build the site → sync to S3 →
invalidate the CloudFront cache.

### One-time AWS setup

The workflow authenticates with **GitHub OIDC** (no long-lived AWS keys stored in
the repo). You need, in your AWS account:

1. A **GitHub OIDC identity provider** (`token.actions.githubusercontent.com`).
2. An **IAM role** the workflow can assume, trusting this repo, with permissions
   for CloudFormation, S3, CloudFront, and IAM (the stack manages a bucket policy).

Then set two **repository variables** (Settings → Secrets and variables → Actions
→ Variables):

| Variable | Example |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::123456789012:role/seny-deploy` |
| `AWS_REGION` | `us-east-1` |

> The dataset under `data/processed/` is committed, so the workflow can build the
> site without a Tiingo token. Regenerate it locally with `npm run fetch:data`
> when you add tickers.
