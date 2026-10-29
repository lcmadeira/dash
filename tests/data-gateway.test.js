import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { handleRequest } from "../worker/src/index.js";

const originalFetch = globalThis.fetch;
const originalCaches = globalThis.caches;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalCaches === undefined) delete globalThis.caches;
  else globalThis.caches = originalCaches;
});

function installMemoryCache() {
  const entries = new Map();
  globalThis.caches = { default: {
    match: async request => entries.get(request.url)?.clone() || null,
    put: async (request, response) => entries.set(request.url, response.clone()),
  } };
  return entries;
}

test("gateway serves validated CoinGecko data with CORS and edge cache", async () => {
  installMemoryCache();
  let upstreamCalls = 0;
  globalThis.fetch = async url => {
    upstreamCalls++;
    assert.match(String(url), /api\.coingecko\.com/);
    return Response.json({ bitcoin: { eur: 60000 } });
  };
  const env = { DASH_ORIGIN: "https://lcmadeira.github.io" };
  const ctx = { waitUntil(promise) { this.pending = promise; } };
  const request = () => new Request("https://dash-data.test/v1/crypto", {
    headers: { Origin: env.DASH_ORIGIN },
  });

  const first = await handleRequest(request(), env, ctx);
  await ctx.pending;
  const payload = await first.json();
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("Access-Control-Allow-Origin"), env.DASH_ORIGIN);
  assert.equal(first.headers.get("X-Dash-Cache"), "MISS");
  assert.equal(payload.bitcoin.eur, 60000);
  assert.equal(payload._meta.source, "CoinGecko");

  const second = await handleRequest(request(), env, ctx);
  assert.equal(second.headers.get("X-Dash-Cache"), "HIT");
  assert.equal(upstreamCalls, 1);
});

test("gateway serves a visibly stale snapshot when the upstream is unavailable", async () => {
  const entries = installMemoryCache();
  globalThis.fetch = async () => Response.json({ bitcoin: { eur: 61000 } });
  const env = { DASH_ORIGIN: "https://lcmadeira.github.io" };
  const request = () => new Request("https://dash-data.test/v1/crypto", {
    headers: { Origin: env.DASH_ORIGIN },
  });
  const first = await handleRequest(request(), env);
  assert.equal(first.status, 200);
  await new Promise(resolve => setTimeout(resolve, 0));
  entries.delete("https://dash-data.test/v1/crypto");

  globalThis.fetch = async () => { throw new Error("upstream offline"); };
  const fallback = await handleRequest(request(), env);
  const payload = await fallback.json();
  assert.equal(fallback.status, 200);
  assert.equal(fallback.headers.get("X-Dash-Cache"), "STALE");
  assert.equal(payload.bitcoin.eur, 61000);
  assert.equal(payload._meta.state, "stale");
  assert.ok(Number.isFinite(payload._meta.fallbackAt));
});

test("gateway returns recent GDELT JSON and rejects unapproved origins", async () => {
  let upstreamCalls = 0;
  globalThis.fetch = async url => {
    upstreamCalls++;
    assert.match(String(url), /api\.gdeltproject\.org/);
    return Response.json({ articles: [{ title: "Diplomatic talks", url: "https://news.example/item" }] });
  };
  const env = { DASH_ORIGIN: "https://lcmadeira.github.io" };
  const denied = await handleRequest(new Request("https://dash-data.test/v1/geopolitics", {
    headers: { Origin: "https://untrusted.example" },
  }), env);
  assert.equal(denied.status, 403);
  assert.equal(upstreamCalls, 0);

  const allowed = await handleRequest(new Request("https://dash-data.test/v1/geopolitics", {
    headers: { Origin: env.DASH_ORIGIN },
  }), env);
  const payload = await allowed.json();
  assert.equal(allowed.status, 200);
  assert.equal(payload.articles[0].title, "Diplomatic talks");
  assert.equal(payload._meta.source, "GDELT DOC");
  assert.equal(upstreamCalls, 1);
});
