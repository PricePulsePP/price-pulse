import { readFile, writeFile } from "node:fs/promises";

const manifestPath = new URL("../data/tokens.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const unresolvedAssets = manifest.filter((token) => !token.assetAddress);

for (const token of unresolvedAssets) {
  const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(token.symbol)}`;
  const payload = await fetchJson(url);
  const candidates = (payload.pairs ?? [])
    .filter((pair) => pair.chainId === "cardano")
    .flatMap((pair) => [
      { pair, asset: pair.baseToken },
      { pair, asset: pair.quoteToken }
    ])
    .filter(({ asset }) => asset?.address !== "0x" && asset?.symbol?.toLowerCase() === token.symbol.toLowerCase())
    .sort((a, b) => Number(b.pair.liquidity?.usd ?? 0) - Number(a.pair.liquidity?.usd ?? 0));

  if (candidates[0]) {
    token.assetAddress = candidates[0].asset.address;
    console.log(`Resolved asset ${token.symbol}`);
  } else {
    console.warn(`No Cardano asset found for ${token.symbol}`);
  }
}

const unresolvedForGecko = manifest.filter((token) => !token.assetAddress || !token.poolAddress);
for (const [index, token] of unresolvedForGecko.entries()) {
  const url = new URL("https://api.geckoterminal.com/api/v2/search/pools");
  url.searchParams.set("query", token.symbol);
  url.searchParams.set("network", "cardano");
  url.searchParams.set("include", "base_token,quote_token,dex");
  const payload = await fetchJson(url);
  const includedById = new Map((payload.included ?? []).map((item) => [item.id, item]));
  const candidates = (payload.data ?? [])
    .flatMap((pool) => {
      const ids = [
        pool.relationships?.base_token?.data?.id,
        pool.relationships?.quote_token?.data?.id
      ];
      return ids.map((id) => ({ pool, marketToken: includedById.get(id) }));
    })
    .filter(({ marketToken }) =>
      marketToken?.attributes?.symbol?.toLowerCase() === token.symbol.toLowerCase()
    )
    .sort((a, b) =>
      Number(b.pool.attributes?.reserve_in_usd ?? 0) -
      Number(a.pool.attributes?.reserve_in_usd ?? 0)
    );
  const match = candidates[0];
  if (match) {
    token.assetAddress ||= match.marketToken.attributes.address;
    token.poolAddress ||= match.pool.attributes.address;
    console.log(`Resolved Gecko fallback ${token.symbol}`);
  } else {
    console.warn(`No GeckoTerminal match found for ${token.symbol}`);
  }
  if (index < unresolvedForGecko.length - 1) {
    await new Promise((resolve) => setTimeout(resolve, 6500));
  }
}

const resolved = manifest.filter((token) => token.assetAddress);
for (const tokenBatch of chunks(resolved, 25)) {
  const addresses = tokenBatch.map((token) => token.assetAddress).join(",");
  const payload = await fetchJson(
    `https://api.geckoterminal.com/api/v2/networks/cardano/tokens/multi/${addresses}`
  );
  const byAddress = new Map(
    (payload.data ?? []).map((item) => [item.attributes.address, item])
  );
  tokenBatch.forEach((token) => {
    const marketToken = byAddress.get(token.assetAddress);
    const topPoolId = marketToken?.relationships?.top_pools?.data?.[0]?.id;
    if (topPoolId) {
      token.poolAddress = topPoolId.replace(/^cardano_/, "");
      console.log(`Resolved pool ${token.symbol}`);
    } else {
      console.warn(`No GeckoTerminal primary pool found for ${token.symbol}`);
    }
  });
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

async function fetchJson(url, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "price-pulse/1.0" }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  throw lastError;
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}
