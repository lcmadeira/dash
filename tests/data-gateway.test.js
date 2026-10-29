import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { readFile } from "node:fs/promises";
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

test("gateway parses fixed Google News feeds, drops unsafe links, and stamps source time", async () => {
  const fixture = await readFile(new URL("./fixtures/google-news-pt.xml", import.meta.url), "utf8");
  let requestedUrl = "";
  globalThis.fetch = async url => {
    requestedUrl = String(url);
    return new Response(fixture, { headers: { "Content-Type": "application/rss+xml" } });
  };
  const env = { DASH_ORIGIN: "https://lcmadeira.github.io" };
  const response = await handleRequest(new Request("https://dash-data.test/v1/news-pt", {
    headers: { Origin: env.DASH_ORIGIN },
  }), env);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.match(requestedUrl, /^https:\/\/news\.google\.com\/rss\/search\?/);
  assert.equal(payload.articles.length, 2);
  assert.equal(payload.articles[0].title, "Notícia de teste & verificação");
  assert.equal(payload.articles[1].title, "Outro título codificado");
  assert.equal(payload.articles[0].source, "Jornal de Teste");
  assert.equal(payload._meta.source, "Google News RSS · Portugal");
  assert.equal(payload._meta.observedAt, Date.parse("Thu, 29 Oct 2026 10:00:00 GMT"));

  const status = await handleRequest(new Request("https://dash-data.test/v1/status"), env);
  const statusPayload = await status.json();
  assert.ok(statusPayload.routes.includes("/v1/news-pt"));
  assert.ok(statusPayload.routes.includes("/v1/news-world"));
});

test("gateway never proxies caller supplied news URLs", async () => {
  let upstreamCalls = 0;
  globalThis.fetch = async () => { upstreamCalls++; return Response.json({}); };
  const response = await handleRequest(new Request("https://dash-data.test/v1/news?url=https://attacker.test"));
  assert.equal(response.status, 404);
  assert.equal(upstreamCalls, 0);
});

test("gateway rejects oversized upstream bodies before parsing or caching", async () => {
  installMemoryCache();
  const body = JSON.stringify({ bitcoin: { eur: 60000 }, padding: "x".repeat(250_001) });
  globalThis.fetch = async () => new Response(body, { headers: { "Content-Type": "application/json" } });
  const response = await handleRequest(new Request("https://dash-data.test/v1/crypto", {
    headers: { Origin: "https://lcmadeira.github.io" },
  }), { DASH_ORIGIN: "https://lcmadeira.github.io" });
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error, "Não foi possível consultar o fornecedor");
});
