# Price Pulse

Website: https://pricepulsepp.github.io/price-pulse/

Price Pulse is a dynamic Cardano native-token market board. It publishes prices
and market data for 50 leading Cardano tokens, ranks them by market cap, and
refreshes the market dataset hourly.

## No-cost infrastructure

Price Pulse runs entirely on services that do not require paid infrastructure:

- GeckoTerminal provides prices and primary-pool market metrics without an API key.
- Koios provides selected on-chain token-supply data.
- GitHub Actions refreshes, validates, and deploys the market dataset hourly.
- GitHub Pages hosts the public website.

No paid hosting, market-data subscription, API key, or repository secret is
required.

## Local use

```bash
npm test
npm run refresh
python3 -m http.server 8000 --directory site
```

Open `http://localhost:8000`.

## Data model

- `data/tokens.json` is the curated token manifest.
- `site/market.json` is the generated, publishable market snapshot.
- `site/market-data.js` provides the same snapshot for immediate browser rendering.
- `scripts/refresh-market.mjs` refreshes pool data and calculates 7-day change.

Prices and pool metrics are sourced from the GeckoTerminal API. Market cap is
calculated as token price multiplied by the circulating supply recorded in the
manifest. Assets marked with `marketCapSupplySource: "koios"` refresh their
on-chain supply from Koios each hour; other circulating-supply values are
curated manifest overrides.

Transaction count, volume, liquidity, and age describe each token's selected
primary pool. Tokens without a usable provider pool may use an explicitly
marked stale price fallback until a public source becomes available.

The hourly deployment refreshes prices and pool metrics while preserving the
last successful 7-day changes to avoid rate-limited per-token history calls.
A manual local refresh without `SKIP_OHLCV=1` recalculates 7-day changes.

## Publishing

The `refresh-and-deploy` workflow refreshes and validates the dataset before
deploying the `site` directory to GitHub Pages. Configure Pages to use GitHub
Actions as its source.

Use a dedicated project-only GitHub account with a verified project email,
an empty public profile, and GitHub's private `noreply` commit address. Keep
passwords, recovery codes, and email credentials outside the repository and
authorize publishing only through GitHub's browser or device-code flow.

The workflow uses GitHub's automatically generated short-lived token. It does
not require market-data API keys or repository secrets.

## Brand asset

The supplied Price Pulse artwork is optimized at
`site/assets/price-pulse-header.jpg` and displayed as the responsive site
header. The social link preview is available at
`site/assets/social-preview.jpg`.
