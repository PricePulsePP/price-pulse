import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("immediate browser snapshot matches the validated JSON snapshot", async () => {
  const json = JSON.parse(
    await readFile(new URL("../site/market.json", import.meta.url), "utf8")
  );
  const script = await readFile(
    new URL("../site/market-data.js", import.meta.url),
    "utf8"
  );
  const context = { globalThis: {} };
  vm.runInNewContext(script, context);

  assert.deepEqual(
    JSON.parse(JSON.stringify(context.globalThis.__PRICE_PULSE_MARKET__)),
    json
  );
});
