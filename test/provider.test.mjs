import test from "node:test";
import assert from "node:assert/strict";
import { fetchJson, parseRetryAfter } from "../lib/provider.mjs";

test("retries throttled requests using Retry-After", async () => {
  const waits = [];
  let calls = 0;
  const result = await fetchJson("https://example.test", {
    attempts: 2,
    retryDelayMs: 10,
    sleep: async (milliseconds) => waits.push(milliseconds),
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false,
          status: 429,
          headers: { get: () => "2" }
        };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    }
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(waits, [2000]);
});

test("parses numeric Retry-After values", () => {
  assert.equal(parseRetryAfter("3"), 3000);
  assert.equal(parseRetryAfter(null), 0);
});

test("passes request options while preserving provider headers", async () => {
  let received;
  await fetchJson("https://example.test", {
    fetchOptions: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    },
    fetchImpl: async (_url, options) => {
      received = options;
      return { ok: true, json: async () => ({ ok: true }) };
    }
  });
  assert.equal(received.method, "POST");
  assert.equal(received.headers.accept, "application/json");
  assert.equal(received.headers["content-type"], "application/json");
  assert.equal(received.body, "{}");
});

test("uses a rolling-window cooldown when a throttle response has no header", async () => {
  const waits = [];
  let calls = 0;
  await fetchJson("https://example.test", {
    attempts: 2,
    sleep: async (milliseconds) => waits.push(milliseconds),
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? { ok: false, status: 429, headers: { get: () => null } }
        : { ok: true, json: async () => ({ ok: true }) };
    }
  });
  assert.deepEqual(waits, [65000]);
});
