# Price Pulse

**PP Hourly Cardano Token Prices**

Website: https://pricepulsepp.github.io/price-pulse/

Price Pulse is a static Cardano native-token market board. It publishes a
curated set of 50 tokens ranked by market cap and refreshes the market dataset
hourly.

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
header. Replace the temporary GitHub homepage link in `site/index.html` with
the public repository URL when publishing.
