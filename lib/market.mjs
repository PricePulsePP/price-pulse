export const NETWORK = "cardano";
export const ADA_ADDRESS = "0x";
export const EXPECTED_TOKEN_COUNT = 50;
export const MINIMUM_COMPLETE_RATIO = 0.6;

export function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function sumTransactions(period) {
  if (!period) return null;
  return (toNumber(period.buys) ?? 0) + (toNumber(period.sells) ?? 0);
}

export function normalizePool(
  token,
  pool,
  marketToken,
  suppliedCirculatingSupply = null
) {
  const attributes = pool?.attributes ?? {};
  const marketAttributes = marketToken?.attributes ?? {};
  const baseId = pool?.relationships?.base_token?.data?.id;
  const trackedId = `cardano_${token.assetAddress}`;
  const trackedIsBase = baseId === trackedId;
  const poolChange = attributes.price_change_percentage ?? {};
  const priceUsd = toNumber(
    marketAttributes.price_usd ??
      (trackedIsBase ? attributes.base_token_price_usd : attributes.quote_token_price_usd)
  );
  const priceAda = toNumber(
    trackedIsBase
      ? attributes.base_token_price_native_currency
      : attributes.quote_token_price_native_currency
  );
  const adaUsd = calculateAdaUsd(attributes);
  const derivedPriceAda =
    priceAda ?? (priceUsd !== null && adaUsd !== null && adaUsd !== 0 ? priceUsd / adaUsd : null);
  const circulatingSupply =
    toNumber(suppliedCirculatingSupply) ?? toNumber(token.circulatingSupply);
  const providerMarketCapUsd = toNumber(
    marketAttributes.market_cap_usd ?? (trackedIsBase ? attributes.market_cap_usd : null)
  );
  const marketCapUsd =
    circulatingSupply !== null && priceUsd !== null
      ? circulatingSupply * priceUsd
      : providerMarketCapUsd;
  const marketCapAda =
    circulatingSupply !== null && derivedPriceAda !== null
      ? circulatingSupply * derivedPriceAda
      : convertUsdToAda(marketCapUsd, priceUsd, derivedPriceAda);
  const providerFdvUsd = toNumber(
    marketAttributes.fdv_usd ?? (trackedIsBase ? attributes.fdv_usd : null)
  );
  const fdvUsd = token.fdvEqualsMarketCap
    ? marketCapUsd
    : providerFdvUsd !== null && providerFdvUsd > 0
      ? providerFdvUsd
      : null;
  const liquidityUsd = toNumber(attributes.reserve_in_usd);

  return {
    symbol: token.symbol,
    name: token.name || marketAttributes.name || token.symbol,
    assetAddress: token.assetAddress || marketAttributes.address || "",
    poolAddress: token.poolAddress || attributes.address || "",
    imageUrl: token.logoOverride || marketAttributes.image_url || null,
    price: { usd: priceUsd, ada: derivedPriceAda },
    change: {
      h1: orientChange(poolChange.h1, trackedIsBase),
      h24: orientChange(poolChange.h24, trackedIsBase)
    },
    transactions24h: sumTransactions(attributes.transactions?.h24),
    volume24h: {
      usd: toNumber(attributes.volume_usd?.h24),
      ada: convertUsdToAda(attributes.volume_usd?.h24, priceUsd, derivedPriceAda)
    },
    liquidity: {
      usd: liquidityUsd,
      ada: convertUsdToAda(liquidityUsd, priceUsd, derivedPriceAda)
    },
    marketCap: {
      usd: marketCapUsd,
      ada: marketCapAda
    },
    fdv: {
      usd: fdvUsd,
      ada: token.fdvEqualsMarketCap
        ? marketCapAda
        : convertUsdToAda(fdvUsd, priceUsd, derivedPriceAda)
    },
    poolCreatedAt: attributes.pool_created_at || null,
    stale: false
  };
}

export function calculateAdaUsd(poolAttributes) {
  const priceUsd = toNumber(poolAttributes?.base_token_price_usd);
  const priceAda = toNumber(poolAttributes?.base_token_price_native_currency);
  if (priceUsd === null || priceAda === null || priceAda === 0) return null;
  return priceUsd / priceAda;
}

export function orientChange(value, trackedIsBase) {
  const change = toNumber(value);
  if (change === null || trackedIsBase) return change;
  const ratio = 1 + change / 100;
  if (ratio === 0) return null;
  return ((1 / ratio) - 1) * 100;
}

export function convertUsdToAda(valueUsd, tokenPriceUsd, tokenPriceAda) {
  const value = toNumber(valueUsd);
  const usd = toNumber(tokenPriceUsd);
  const ada = toNumber(tokenPriceAda);
  if (value === null || usd === null || ada === null || usd === 0) return null;
  return value * (ada / usd);
}

export function rankTokens(tokens) {
  return [...tokens]
    .sort((a, b) => {
      const aCap = a.marketCap?.ada ?? a.marketCap?.usd;
      const bCap = b.marketCap?.ada ?? b.marketCap?.usd;
      if (aCap === null || aCap === undefined) return 1;
      if (bCap === null || bCap === undefined) return -1;
      return bCap - aCap;
    })
    .map((token, index) => ({ ...token, rank: index + 1 }));
}

export function validateSnapshot(snapshot, expectedCount = EXPECTED_TOKEN_COUNT) {
  const errors = [];
  if (!snapshot || !Array.isArray(snapshot.tokens)) {
    return ["Snapshot must include a tokens array."];
  }
  if (snapshot.tokens.length !== expectedCount) {
    errors.push(`Expected ${expectedCount} tokens, received ${snapshot.tokens.length}.`);
  }
  const symbols = snapshot.tokens.map((token) => token.symbol);
  if (new Set(symbols).size !== symbols.length) {
    errors.push("Token symbols must be unique.");
  }
  const complete = snapshot.tokens.filter(
    (token) => token.price?.usd !== null && token.marketCap?.usd !== null
  ).length;
  if (complete < Math.ceil(expectedCount * MINIMUM_COMPLETE_RATIO)) {
    errors.push(`Only ${complete}/${expectedCount} tokens have price and market-cap data.`);
  }
  for (let index = 1; index < snapshot.tokens.length; index += 1) {
    const previous =
      snapshot.tokens[index - 1].marketCap?.ada ?? snapshot.tokens[index - 1].marketCap?.usd;
    const current = snapshot.tokens[index].marketCap?.ada ?? snapshot.tokens[index].marketCap?.usd;
    if (previous !== null && current !== null && current > previous) {
      errors.push("Tokens are not sorted by descending market cap.");
      break;
    }
  }
  return errors;
}

export function fallbackToken(token, previousToken, adaUsd = null) {
  if (previousToken && previousToken.price?.ada !== null) {
    return { ...previousToken, stale: true };
  }
  const priceAda = toNumber(token.priceAdaOverride);
  const circulatingSupply = toNumber(token.circulatingSupply);
  const priceUsd = priceAda !== null && adaUsd !== null ? priceAda * adaUsd : null;
  const marketCapAda =
    priceAda !== null && circulatingSupply !== null ? priceAda * circulatingSupply : null;
  const marketCapUsd =
    marketCapAda !== null && adaUsd !== null ? marketCapAda * adaUsd : null;
  return {
    rank: null,
    symbol: token.symbol,
    name: token.name,
    assetAddress: token.assetAddress,
    poolAddress: token.poolAddress,
    imageUrl: token.logoOverride || null,
    price: { usd: priceUsd, ada: priceAda },
    change: { h1: null, h24: null },
    transactions24h: null,
    volume24h: { usd: null, ada: null },
    liquidity: { usd: null, ada: null },
    marketCap: { usd: marketCapUsd, ada: marketCapAda },
    fdv: { usd: null, ada: null },
    poolCreatedAt: null,
    stale: true
  };
}
