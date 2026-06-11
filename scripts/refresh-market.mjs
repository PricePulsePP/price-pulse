import { readFile, writeFile } from "node:fs/promises";
import {
  EXPECTED_TOKEN_COUNT,
  calculateAdaUsd,
  fallbackToken,
  normalizePool,
  rankTokens,
  validateSnapshot
} from "../lib/market.mjs";
import { fetchJson } from "../lib/provider.mjs";

const manifestPath = new URL("../data/tokens.json", import.meta.url);
const outputPath = new URL("../site/market.json", import.meta.url);
const scriptOutputPath = new URL("../site/market-data.js", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const previous = await readPreviousSnapshot();
const priorBySymbol = new Map((previous?.tokens ?? []).map((token) => [token.symbol, token]));

if (manifest.length !== EXPECTED_TOKEN_COUNT) {
  throw new Error(`Manifest must contain ${EXPECTED_TOKEN_COUNT} tokens.`);
}

const unresolved = manifest.filter((token) => !token.assetAddress);
if (unresolved.length) {
  throw new Error(`Manifest has unresolved asset addresses: ${unresolved.map((token) => token.symbol).join(", ")}`);
}

const currentPools = await fetchPools([...new Set(manifest.map((token) => token.poolAddress).filter(Boolean))]);
const poolByAddress = new Map(currentPools.data.map((pool) => [pool.attributes.address, pool]));
const adaUsd = currentPools.data
  .map((pool) => calculateAdaUsd(pool.attributes))
  .find((value) => value !== null);
await pauseBetweenBatches(0, 2);
const currentTokens = await fetchTokens(manifest.map((token) => token.assetAddress));
const tokenByAddress = new Map(currentTokens.map((token) => [token.attributes.address, token]));
await pauseBetweenBatches(0, 2);
const circulatingSupplyByAddress = await fetchKoiosSupplies(
  manifest.filter((token) => token.marketCapSupplySource === "koios")
);
await pauseBetweenBatches(0, 2);
const normalized = manifest.map((token) => {
  const pool = poolByAddress.get(token.poolAddress);
  const marketToken = tokenByAddress.get(token.assetAddress);
  if (!pool) {
    const previousToken = token.poolAddress ? priorBySymbol.get(token.symbol) : null;
    return fallbackToken(token, previousToken, adaUsd);
  }
  return normalizePool(
    token,
    pool,
    marketToken,
    circulatingSupplyByAddress.get(token.assetAddress)
  );
});

const snapshot = {
  title: "Price Pulse",
  subtitle: "PP Hourly Cardano Token Prices",
  generatedAt: new Date().toISOString(),
  source: "GeckoTerminal",
  sourceUrl: "https://www.geckoterminal.com/cardano/pools",
  metricNote: "Transactions, volume, liquidity, and age describe each token's selected primary pool.",
  tokens: rankTokens(normalized)
};

const errors = validateSnapshot(snapshot);
if (errors.length) {
  const incomplete = snapshot.tokens
    .filter((token) => token.price.usd === null || token.marketCap.usd === null)
    .map((token) => token.symbol);
  console.error(`Incomplete token data: ${incomplete.join(", ")}`);
  throw new Error(`Snapshot validation failed:\n- ${errors.join("\n- ")}`);
}

await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
await writeFile(
  scriptOutputPath,
  `globalThis.__PRICE_PULSE_MARKET__ = ${JSON.stringify(snapshot)};\n`
);
console.log(`Wrote ${snapshot.tokens.length} ranked tokens to site/market.json`);

async function fetchPools(addresses) {
  const data = [];
  const batches = chunks(addresses, 25);
  for (const [index, addressesBatch] of batches.entries()) {
    const path = addressesBatch.map(encodeURIComponent).join(",");
    const url = `https://api.geckoterminal.com/api/v2/networks/cardano/pools/multi/${path}`;
    const payload = await fetchJson(url);
    data.push(...(payload.data ?? []));
    await pauseBetweenBatches(index, batches.length);
  }
  return { data };
}

async function fetchTokens(addresses) {
  const data = [];
  const batches = chunks(addresses, 25);
  for (const [index, addressesBatch] of batches.entries()) {
    const path = addressesBatch.map(encodeURIComponent).join(",");
    const payload = await fetchJson(
      `https://api.geckoterminal.com/api/v2/networks/cardano/tokens/multi/${path}`
    );
    data.push(...(payload.data ?? []));
    await pauseBetweenBatches(index, batches.length);
  }
  return data;
}

async function fetchKoiosSupplies(tokens) {
  const supplies = new Map();
  if (!tokens.length) return supplies;

  try {
    const payload = await fetchJson("https://api.koios.rest/api/v1/asset_info", {
      fetchOptions: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          _asset_list: tokens.map((token) => [
            token.assetAddress.slice(0, 56),
            token.assetAddress.slice(56)
          ])
        })
      }
    });
    for (const asset of payload ?? []) {
      const decimals = Number(asset.token_registry_metadata?.decimals);
      const rawSupply = Number(asset.total_supply);
      if (!Number.isFinite(decimals) || !Number.isFinite(rawSupply)) continue;
      supplies.set(`${asset.policy_id}${asset.asset_name}`, rawSupply / 10 ** decimals);
    }
  } catch (error) {
    console.warn(`Koios supply refresh failed: ${error.message}`);
  }
  return supplies;
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function readPreviousSnapshot() {
  const deployedUrl = process.env.PREVIOUS_MARKET_URL;
  if (deployedUrl) {
    try {
      return await fetchJson(deployedUrl, { attempts: 1 });
    } catch {
      console.warn("Published snapshot unavailable; using the repository snapshot.");
    }
  }
  return readJson(outputPath);
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function pauseBetweenBatches(index, count) {
  if (index < count - 1) {
    await new Promise((resolve) =>
      setTimeout(resolve, Number(process.env.REQUEST_PAUSE_MS ?? 7000))
    );
  }
}
