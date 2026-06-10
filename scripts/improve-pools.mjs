import { readFile, writeFile } from "node:fs/promises";
import { fetchJson } from "../lib/provider.mjs";

const manifestPath = new URL("../data/tokens.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const requestedSymbols = new Set(process.argv.slice(2).map((symbol) => symbol.toUpperCase()));
const tokens = requestedSymbols.size
  ? manifest.filter((token) => requestedSymbols.has(token.symbol.toUpperCase()))
  : manifest;
const pauseMs = Number(process.env.REQUEST_PAUSE_MS ?? 6500);

for (const [index, token] of tokens.entries()) {
  const url = new URL("https://api.geckoterminal.com/api/v2/search/pools");
  url.searchParams.set("query", token.symbol);
  url.searchParams.set("network", "cardano");
  const payload = await fetchJson(url);
  const trackedId = `cardano_${token.assetAddress}`;
  const candidates = (payload.data ?? [])
    .filter((pool) => pool.relationships?.base_token?.data?.id === trackedId)
    .filter((pool) => pool.attributes?.market_cap_usd !== null)
    .filter((pool) => Number(pool.attributes?.reserve_in_usd ?? 0) >= 1000)
    .sort(
      (a, b) =>
        Number(b.attributes?.reserve_in_usd ?? 0) - Number(a.attributes?.reserve_in_usd ?? 0)
    );

  if (candidates[0]) {
    token.poolAddress = candidates[0].attributes.address;
    console.log(`Selected base-token pool for ${token.symbol}`);
  } else {
    console.warn(`No valued base-token pool found for ${token.symbol}`);
  }

  if (index < tokens.length - 1) {
    await new Promise((resolve) => setTimeout(resolve, pauseMs));
  }
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
