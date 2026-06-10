import test from "node:test";
import assert from "node:assert/strict";
import {
  changeClass,
  formatAge,
  formatMoney,
  formatPercent,
  formatPrice,
  isSnapshotStale
} from "../site/format.mjs";

test("formats ADA and USD consistently", () => {
  assert.equal(formatMoney(1500, "ada"), "1.5K ₳");
  assert.equal(formatMoney(1500, "usd"), "$1.5K");
  assert.equal(formatPrice(0.00123456, "ada"), "0.0012346 ₳");
  assert.equal(formatPrice(null, "usd"), "—");
});

test("formats percentages and classes", () => {
  assert.equal(formatPercent(1.234), "+1.23%");
  assert.equal(formatPercent(-2), "-2.00%");
  assert.equal(changeClass(1), "positive");
  assert.equal(changeClass(-1), "negative");
  assert.equal(changeClass(null), "neutral");
});

test("formats pool ages", () => {
  const now = new Date("2026-06-09T00:00:00Z").getTime();
  assert.equal(formatAge("2026-06-08T00:00:00Z", now), "1d");
  assert.equal(formatAge("2025-06-01T00:00:00Z", now), "1y");
});

test("marks snapshots stale after two hours", () => {
  const now = new Date("2026-06-09T03:00:00Z").getTime();
  assert.equal(isSnapshotStale("2026-06-09T02:00:00Z", now), false);
  assert.equal(isSnapshotStale("2026-06-09T00:00:00Z", now), true);
});
