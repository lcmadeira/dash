import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { handleRequest, marketToday, parseOmieElectricity, parseSnirhTable, parseYahooTtf } from "../worker/src/index.js";

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
    // RTP e Público indisponíveis: o Google News fica como último recurso.
    if (!requestedUrl.includes("news.google.com")) return new Response("down", { status: 503 });
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

test("OMIE Portugal parser validates dated 15-minute periods and selects the Portuguese file", async () => {
  const date = "2026-11-02";
  const rows = Array.from({ length: 96 }, (_, index) => {
    const period = index + 1;
    return `2026;11;02;${period};${period === 46 ? "12.5" : `${period}.25`};0;`;
  }).join("\n");
  const fixture = `MARGINALPDBCPT;\n${rows}\n*\n`;
  const parsed = parseOmieElectricity(fixture, date);
  assert.equal(parsed.date, date);
  assert.equal(parsed.periods.length, 96);
  assert.deepEqual(parsed.periods[45], { period: 46, priceMwh: 12.5 });
  assert.equal(parseOmieElectricity(fixture, "2026-11-03"), null);

  let requested;
  globalThis.fetch = async url => {
    requested = new URL(String(url));
    return new Response(fixture, { headers: { "Content-Type": "application/octet-stream" } });
  };
  const response = await handleRequest(new Request(`https://dash-data.test/v1/electricity?date=${date}`, {
    headers: { Origin: "https://lcmadeira.github.io" },
  }), { DASH_ORIGIN: "https://lcmadeira.github.io" });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(requested.hostname, "www.omie.es");
  assert.equal(requested.searchParams.get("parents"), "marginalpdbcpt");
  assert.match(requested.searchParams.get("filename"), /marginalpdbcpt_20261102\.1$/);
  assert.equal(payload.periods[45].priceMwh, 12.5);
  assert.equal(payload._meta.source, "OMIE · MARGINALPDBCPT · zona portuguesa");
});

test("electricity gateway rejects arbitrary dates and malformed OMIE series", async () => {
  let upstreamCalls = 0;
  globalThis.fetch = async () => { upstreamCalls++; return new Response("MARGINALPDBCPT;\n*"); };
  const invalidDate = await handleRequest(new Request("https://dash-data.test/v1/electricity?date=2026-02-30"));
  assert.equal(invalidDate.status, 400);
  const invalidSeries = await handleRequest(new Request("https://dash-data.test/v1/electricity?date=2026-11-02"));
  assert.equal(invalidSeries.status, 502);
  assert.equal(upstreamCalls, 1);
});

test("electricity gateway reports a not-yet-published market day without an HTTP error", async () => {
  const tomorrow = new Date(Date.now() + 36 * 3600 * 1000);
  const date = marketToday(tomorrow);
  globalThis.fetch = async () => new Response("<html>Not found</html>", { status: 404 });
  const pending = await handleRequest(new Request(`https://dash-data.test/v1/electricity?date=${date}`));
  assert.equal(pending.status, 200);
  const payload = await pending.json();
  assert.equal(payload.published, false);
  assert.equal(payload.date, date);
  assert.deepEqual(payload.periods, []);
  assert.equal(payload._meta.state, "pending");

  const past = await handleRequest(new Request("https://dash-data.test/v1/electricity?date=2026-01-05"));
  assert.equal(past.status, 502);
});

test("market day follows the Madrid calendar", () => {
  assert.equal(marketToday(new Date("2026-11-20T22:30:00Z")), "2026-11-20");
  assert.equal(marketToday(new Date("2026-11-20T23:30:00Z")), "2026-11-21");
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

test("news route falls back to the next fixed feed and identifies the server", async () => {
  const fixture = await readFile(new URL("./fixtures/google-news-pt.xml", import.meta.url), "utf8");
  const requested = [];
  globalThis.fetch = async (url, init) => {
    requested.push(String(url));
    assert.match(init.headers["User-Agent"], /dash-data-gateway/);
    if (String(url).includes("rtp.pt")) return new Response("blocked", { status: 503 });
    return new Response(fixture.replace(/<source[^>]*>[^<]*<\/source>/g, ""), { headers: { "Content-Type": "application/rss+xml" } });
  };
  const response = await handleRequest(new Request("https://dash-data.test/v1/news-pt"));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(requested.length, 2);
  assert.match(requested[0], /rtp\.pt/);
  assert.match(requested[1], /PublicoRSS/);
  assert.equal(payload._meta.source, "Público");
  assert.equal(payload.articles[0].source, "Público");
});

test("feed routes only serve whitelisted RSS feeds", async () => {
  const fixture = await readFile(new URL("./fixtures/google-news-pt.xml", import.meta.url), "utf8");
  const requested = [];
  globalThis.fetch = async url => { requested.push(String(url)); return new Response(fixture); };
  const unknown = await handleRequest(new Request("https://dash-data.test/v1/feed-attacker?url=https://attacker.test"));
  assert.equal(unknown.status, 404);
  assert.equal(requested.length, 0);
  const icg = await handleRequest(new Request("https://dash-data.test/v1/feed-icg"));
  assert.equal(icg.status, 200);
  assert.match(requested[0], /^https:\/\/www\.crisisgroup\.org\//);
  assert.equal((await icg.json())._meta.source, "Crisis Group");
});

test("TTF route reads Yahoo Finance EUR quotes and rejects other currencies", async () => {
  const chart = currency => JSON.stringify({ chart: { result: [{ meta: {
    currency, regularMarketPrice: 86.765, chartPreviousClose: 84.749, regularMarketDayHigh: 87, regularMarketDayLow: 85.5, regularMarketTime: 1795174019,
  } }] } });
  assert.equal(parseYahooTtf(chart("EUR")).price, 86.765);
  globalThis.fetch = async () => new Response(chart("EUR"), { headers: { "Content-Type": "application/json" } });
  const ok = await (await handleRequest(new Request("https://dash-data.test/v1/ttf"))).json();
  assert.equal(ok.prev, 84.749);
  assert.equal(ok._meta.observedAt, 1795174019000);
  globalThis.fetch = async () => new Response(chart("USD"));
  assert.equal((await handleRequest(new Request("https://dash-data.test/v1/ttf"))).status, 502);
});

test("SNIRH general table yields the latest month per basin with capacity-weighted totals", async () => {
  const html = await readFile(new URL("./fixtures/snirh-tabelageral.html", import.meta.url), "latin1");
  const parsed = parseSnirhTable(html, 2026);
  assert.equal(parsed.period, "2026-10");
  assert.equal(parsed.hydroYear, "2026/27");
  assert.equal(parsed.basins.length, 12);
  const tejo = parsed.basins.find(b => b.name === "Tejo");
  assert.deepEqual([tejo.val, tejo.avg, tejo.capacity], [64.2, 62.4, 2546.4]);
  assert.equal(parsed.basins.find(b => b.name.startsWith("Cávado")).name, "Cávado/Ribeiras Costeiras");
  assert.equal(parsed.totalVal, 67.4);
  assert.equal(parseSnirhTable("<table></table>", 2026), null);

  const page = "<a href=\"javascript:ALBUFBOL_AbreTabelaGeral('2026','10','','','','')\">";
  const requested = [];
  globalThis.fetch = async url => {
    requested.push(String(url));
    return new Response(String(url).includes("tabelageral") ? html : page, { headers: { "Content-Type": "text/html" } });
  };
  const response = await handleRequest(new Request("https://dash-data.test/v1/dams"));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.match(requested[1], /anohi=2026&mes=10/);
  assert.equal(payload.basins.length, 12);
  assert.equal(payload._meta.source, "SNIRH · APA (albufeiras)");
});

test("committed dams snapshot is valid for the dashboard card", async () => {
  const data = JSON.parse(await readFile(new URL("../data/dams.json", import.meta.url), "utf8"));
  assert.ok(data.basins.length >= 8);
  assert.ok(data.basins.every(b => typeof b.name === "string" && b.val >= 0 && b.val <= 100));
  assert.ok(Number.isFinite(data.totalVal));
  assert.match(data.period, /^\d{4}-\d{2}$/);
  assert.equal(data._meta.observedAt, Date.parse(`${data.period}-15T12:00:00Z`));
});

test("agri route reads the fixed futures list and tolerates one missing quote", async () => {
  const requested = [];
  globalThis.fetch = async url => {
    requested.push(String(url));
    if (String(url).includes("CT%3DF")) return new Response("down", { status: 503 });
    const symbol = decodeURIComponent(String(url).split("/chart/")[1].split("?")[0]);
    return Response.json({ chart: { result: [{ meta: {
      symbol, currency: "USX", regularMarketPrice: 500, chartPreviousClose: 490, regularMarketVolume: 1000, regularMarketTime: 1795174019,
    } }] } });
  };
  const response = await handleRequest(new Request("https://dash-data.test/v1/agri"));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.quotes.length, 6);
  assert.equal(payload.quotes.find(q => q.symbol === "ZW=F").price, 500);
  assert.equal(payload.quotes.find(q => q.symbol === "CT=F").price, null);
  assert.equal(requested.filter(u => u.includes("CT%3DF")).length, 2, "tries query1 then query2");
  assert.equal(payload._meta.source, "Yahoo Finance · futuros CBOT/ICE");
});

test("euribor route returns the ECB monthly series per tenor", async () => {
  const requested = [];
  globalThis.fetch = async url => {
    requested.push(String(url));
    if (String(url).includes("EURIBOR1MD_")) return new Response("{}", { status: 404 });
    return Response.json({
      structure: { dimensions: { observation: [{ values: [{ id: "2026-09" }, { id: "2026-10" }] }] } },
      dataSets: [{ series: { "0:0:0:0:0:0": { observations: { 1: [2.6346818], 0: [2.6350455] } } } }],
    });
  };
  const response = await handleRequest(new Request("https://dash-data.test/v1/euribor"));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(requested.length, 4);
  assert.ok(requested.every(u => u.includes(".RT.MM.")));
  assert.equal(JSON.stringify(payload.series["3M"].map(r => r.period)), JSON.stringify(["2026-09", "2026-10"]));
  assert.equal(payload.series["1M"].length, 0);
  assert.equal(payload._meta.observedAt, Date.parse("2026-10-15T12:00:00Z"));
});
