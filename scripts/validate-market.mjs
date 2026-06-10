import { readFile } from "node:fs/promises";
import { validateSnapshot } from "../lib/market.mjs";

const snapshot = JSON.parse(
  await readFile(new URL("../site/market.json", import.meta.url), "utf8")
);
const errors = validateSnapshot(snapshot);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${snapshot.tokens.length} tokens.`);
}
