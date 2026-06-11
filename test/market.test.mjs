import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAdaUsd,
  convertUsdToAda,
  fallbackToken,
  normalizePool,
  orientChange,
  rankTokens,
  sumTransactions,
  validateSnapshot
} from "../lib/market.mjs";

const token = {
  symbol: "PP",
  name: "Price Pulse",
  assetAddress: "asset",
  poolAddress: "pool"
};

const pool = {
  attributes: {
    address: "pool",
    base_token_price_usd: "0.25",
    base_token_price_native_currency: "1.5",
    market_cap_usd: "1000",
    fdv_usd: "2000",
    reserve_in_usd: "500",
    volume_usd: { h24: "100" },
    price_change_percentage: { h1: "1.2", h24: "-3.4" },
    transactions: { h24: { buys: 8, sells: 12 } },
    pool_created_at: "2025-01-01T00:00:00Z"
  },
  relationships: { base_token: { data: { id: "cardano_asset" } } }
};

const marketToken = {
  attributes: {
    address: "asset",
    name: "Price Pulse",
    image_url: "https://example.test/logo.png",
    price_usd: "0.25",
    market_cap_usd: "1000",
    fdv_usd: "2000"
  }
};

test("converts USD values using token prices", () => {
  assert.equal(convertUsdToAda(100, 0.25, 1.5), 600);
  assert.equal(convertUsdToAda(null, 0.25, 1.5), null);
});

test("normalizes provider pool fields", () => {
  const result = normalizePool(token, pool, marketToken);
  assert.equal(result.transactions24h, 20);
  assert.equal(result.volume24h.ada, 600);
  assert.equal(result.marketCap.ada, 6000);
  assert.deepEqual(result.change, { h1: 1.2, h24: -3.4 });
  assert.equal(result.imageUrl, "https://example.test/logo.png");
  assert.equal("category" in result, false);
});

test("calculates market cap from an explicit circulating supply", () => {
  const result = normalizePool(token, pool, marketToken, 100);
  assert.equal(result.marketCap.usd, 25);
  assert.equal(result.marketCap.ada, 150);
});

test("can value FDV using the same minted supply as market cap", () => {
  const result = normalizePool(
    { ...token, fdvEqualsMarketCap: true },
    pool,
    marketToken,
    100
  );
  assert.deepEqual(result.fdv, result.marketCap);
});

test("treats non-positive provider FDV as missing", () => {
  const result = normalizePool(token, pool, {
    attributes: { ...marketToken.attributes, fdv_usd: "0" }
  });
  assert.deepEqual(result.fdv, { usd: null, ada: null });
});

test("uses accurate base-pool fields when token-level data is missing", () => {
  const result = normalizePool(token, pool, null);
  assert.equal(result.price.usd, 0.25);
  assert.equal(result.price.ada, 1.5);
  assert.equal(result.marketCap.usd, 1000);
  assert.equal(result.fdv.usd, 2000);
});

test("does not assign base-token valuation to a tracked quote token", () => {
  const quoteToken = { ...token, assetAddress: "quote" };
  const quotePool = {
    ...pool,
    attributes: {
      ...pool.attributes,
      quote_token_price_usd: "2",
      quote_token_price_native_currency: "12"
    }
  };
  const result = normalizePool(quoteToken, quotePool, null);
  assert.equal(result.price.usd, 2);
  assert.equal(result.price.ada, 12);
  assert.equal(result.marketCap.usd, null);
  assert.equal(result.fdv.usd, null);
});

test("derives ADA/USD and orients quote-side changes", () => {
  assert.equal(calculateAdaUsd(pool.attributes), 1 / 6);
  assert.equal(orientChange(25, true), 25);
  assert.ok(Math.abs(orientChange(25, false) - -20) < 0.000001);
});
test("sums transactions and handles missing periods", () => {
  assert.equal(sumTransactions({ buys: 2, sells: 3 }), 5);
  assert.equal(sumTransactions(null), null);
});

test("ranks known market caps before missing values", () => {
  const ranked = rankTokens([
    { symbol: "B", marketCap: { usd: null } },
    { symbol: "C", marketCap: { usd: 20 } },
    { symbol: "A", marketCap: { usd: 10 } }
  ]);
  assert.deepEqual(ranked.map((item) => item.symbol), ["C", "A", "B"]);
  assert.deepEqual(ranked.map((item) => item.rank), [1, 2, 3]);
});

test("ranks by ADA market cap when both currencies are available", () => {
  const ranked = rankTokens([
    { symbol: "USD-HIGH", marketCap: { usd: 30, ada: 10 } },
    { symbol: "ADA-HIGH", marketCap: { usd: 20, ada: 20 } }
  ]);
  assert.deepEqual(ranked.map((item) => item.symbol), ["ADA-HIGH", "USD-HIGH"]);
});

test("fallback preserves previous data and marks it stale", () => {
  const previous = { symbol: "PP", price: { usd: 1 }, stale: false };
  assert.deepEqual(fallbackToken(token, previous), { ...previous, stale: true });
});

test("new fallback rows do not include category", () => {
  assert.equal("category" in fallbackToken(token, null), false);
});

test("fallback can use a stale ADA price override", () => {
  const result = fallbackToken(
    { ...token, priceAdaOverride: 2, circulatingSupply: 10 },
    null,
    0.25
  );
  assert.deepEqual(result.price, { ada: 2, usd: 0.5 });
  assert.deepEqual(result.marketCap, { ada: 20, usd: 5 });
  assert.equal(result.stale, true);
});

test("validates row count, uniqueness, completeness, and order", () => {
  const tokens = Array.from({ length: 50 }, (_, index) => ({
    symbol: `T${index}`,
    price: { usd: 1 },
    marketCap: { usd: 50 - index }
  }));
  assert.deepEqual(validateSnapshot({ tokens }), []);
  tokens[1].symbol = tokens[0].symbol;
  assert.ok(validateSnapshot({ tokens }).some((error) => error.includes("unique")));
});

test("rejects snapshots below the provider completeness threshold", () => {
  const tokens = Array.from({ length: 50 }, (_, index) => ({
    symbol: `T${index}`,
    price: { usd: index < 29 ? 1 : null },
    marketCap: { usd: index < 29 ? 50 - index : null }
  }));
  assert.ok(validateSnapshot({ tokens }).some((error) => error.includes("29/50")));
});
