# Price Pulse

Website: https://pricepulsepp.github.io/price-pulse/

Price Pulse is a dynamic Cardano native-token market board. It publishes prices
and market data for 50 leading Cardano tokens, ranks them by market cap, and
refreshes the market dataset hourly.

## No-cost infrastructure

Price Pulse runs entirely on services that do not require paid infrastructure:

- GeckoTerminal provides prices and primary-pool market metrics without an API key.
- Koios provides selected on-chain token-supply data.
- GitHub Actions uses staggered schedule opportunities to refresh, validate,
  and deploy the market dataset at least hourly.
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
- `scripts/refresh-market.mjs` refreshes pool data and calculates ADA-denominated
  7-day change.

Prices and pool metrics are sourced from the GeckoTerminal API. Market cap is
calculated as token price multiplied by the circulating supply recorded in the
manifest. Assets marked with `marketCapSupplySource: "koios"` refresh their
on-chain supply from Koios each hour; other circulating-supply values are
curated manifest overrides.

Transaction count, volume, liquidity, and age describe each token's selected
primary pool. Tokens without a usable provider pool may use an explicitly
marked stale price fallback until a public source becomes available.

The deployment workflow has multiple staggered schedule opportunities each
hour so a delayed scheduler event does not leave the dataset stale. It
refreshes prices and pool metrics frequently. Paced daily and manual runs
refresh 7-day changes without delaying the frequent market updates or
exceeding provider limits.

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
