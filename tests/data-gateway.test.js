import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { handleRequest, icaoCountry, marketToday, parseCoinpaprikaTicker, parseDamsSiteCopy, parseOmieElectricity, parseReadsbAircraft, parseSnirhTable, parseYahooChart, parseYahooTtf } from "../worker/src/index.js";

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

test("electricity gateway falls back to the Iberian OMIE file when the Portuguese one is missing", async () => {
  const date = "2026-11-03";
  // Dia com separação de mercados: coluna 5 = PT, coluna 6 = ES.
  const rows = Array.from({ length: 96 }, (_, index) => `2026;11;03;${index + 1};${index + 10};999;`).join("\n");
  const iberian = `MARGINALPDBC;\n${rows}\n*\n`;
  const requested = [];
  globalThis.fetch = async url => {
    const parent = new URL(String(url)).searchParams.get("parents");
    requested.push(parent);
    return parent === "marginalpdbc"
      ? new Response(iberian, { headers: { "Content-Type": "application/octet-stream" } })
      : new Response("<html>Not found</html>", { status: 404 });
  };
  const response = await handleRequest(new Request(`https://dash-data.test/v1/electricity?date=${date}`));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(requested, ["marginalpdbcpt", "marginalpdbc"]);
  assert.equal(payload.periods.length, 96);
  assert.deepEqual(payload.periods[0], { period: 1, priceMwh: 10 });
  assert.equal(payload._meta.source, "OMIE · MARGINALPDBC (coluna PT) · zona portuguesa");
  assert.equal(payload.published, undefined);
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

test("air route converts readsb aircraft to OpenSky-like states and reports adsb.lol failures", async () => {
  assert.equal(icaoCountry("4951c4"), "Portugal");
  assert.equal(icaoCountry("4ca123"), "Irlanda");
  assert.equal(icaoCountry("e80475"), "Chile");
  assert.equal(icaoCountry("511171"), "Estónia");
  assert.equal(icaoCountry("4d2505"), "Malta");
  assert.equal(icaoCountry("zzzzzz"), "");
  const sample = { now: 1795431143.0, ac: [
    { hex: "4951c4", flight: "TAP123  ", lat: 38.77, lon: -9.13, alt_baro: 10000, gs: 400, track: 90, baro_rate: -1000, seen_pos: 1 },
    { hex: "4ca123", flight: "RYR1", lat: 38.78, lon: -9.13, alt_baro: "ground", gs: 5 },
    { hex: "3c0001", lat: 50, lon: 2, alt_baro: 30000 },              // fora da área
    { hex: "3c0002", lat: 39, lon: -8, alt_baro: 30000, seen_pos: 300 }, // posição antiga
  ] };
  const parsed = parseReadsbAircraft(JSON.stringify(sample));
  assert.equal(parsed.ts, 1795431143000);
  assert.equal(parsed.states.length, 2);
  assert.deepEqual(parsed.states[0], ["4951c4", "TAP123", "Portugal", null, null, -9.13, 38.77, 3048, false, 205.8, 90, -5.1]);
  assert.equal(parsed.states[1][8], true);
  assert.equal(parsed.states[1][7], null);

  assert.equal(icaoCountry("e94c88"), "Bolívia");

  const requested = [];
  globalThis.fetch = async url => { requested.push(new URL(String(url)).hostname); return new Response(JSON.stringify(sample)); };
  const response = await handleRequest(new Request("https://dash-data.test/v1/air"));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(requested, ["api.adsb.lol"]);
  assert.equal(payload._meta.source, "adsb.lol (ODbL)");
  assert.equal(payload.states.length, 2);
  assert.match(response.headers.get("Cache-Control"), /s-maxage=180/);

  globalThis.fetch = async () => new Response("slow down", { status: 429 });
  const limited = await handleRequest(new Request("https://dash-data.test/v1/air"));
  assert.equal(limited.status, 502);
  assert.deepEqual((await limited.json()).upstreamFailures, [{ source: "adsb.lol (ODbL)", status: 429 }]);
});

test("Yahoo parser takes the previous daily close, not the close before a multi-day range", () => {
  const body = JSON.stringify({ chart: { result: [{
    meta: { regularMarketPrice: 25030, chartPreviousClose: 26598.64, regularMarketTime: 1795435781 },
    timestamp: [1795392000, 1795478400, 1795564800, 1795651200, 1795910400],
    indicators: { quote: [{ close: [26045.37, 25736.24, null, 24802.78, 25030.03] }] },
  }] } });
  const quote = parseYahooChart(body, { withSeries: true });
  assert.equal(quote.prev, 24802.78);
  assert.equal(quote.series.length, 4, "null closes are dropped");
  assert.deepEqual(quote.series.at(-1), { date: "2026-11-29", value: 25030.03 });
});

test("markets route returns the fixed PSI/European list with the PSI history", async () => {
  const requested = [];
  globalThis.fetch = async url => {
    const symbol = decodeURIComponent(String(url).split("/chart/")[1].split("?")[0]);
    requested.push(String(url));
    if (symbol === "CTT.LS") return new Response("down", { status: 503 });
    return Response.json({ chart: { result: [{
      meta: { symbol, regularMarketPrice: 10, chartPreviousClose: 8, regularMarketTime: 1795435781 },
      timestamp: [1795564800, 1795651200], indicators: { quote: [{ close: [9.5, 10] }] },
    }] } });
  };
  const response = await handleRequest(new Request("https://dash-data.test/v1/markets"));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.quotes.length, 14);
  const psi = payload.quotes.find(q => q.symbol === "PSI20.LS");
  assert.equal(psi.prev, 9.5);
  assert.equal(psi.series.length, 2);
  assert.ok(requested.some(u => u.includes("PSI20.LS?range=3mo")));
  assert.equal(payload.quotes.find(q => q.symbol === "EDP.LS").series, undefined);
  assert.equal(payload.quotes.find(q => q.symbol === "CTT.LS").price, null);
  assert.equal(payload._meta.source, "Yahoo Finance · Euronext Lisboa e índices europeus");
});

test("indicators route returns the fixed VIX/metals/S&P/energy list", async () => {
  const requested = [];
  globalThis.fetch = async url => {
    const symbol = decodeURIComponent(String(url).split("/chart/")[1].split("?")[0]);
    requested.push(symbol);
    return Response.json({ chart: { result: [{
      meta: { symbol, regularMarketPrice: 10, chartPreviousClose: 5, regularMarketTime: 1795435781 },
      timestamp: [1795564800, 1795651200], indicators: { quote: [{ close: [9, 10] }] },
    }] } });
  };
  const response = await handleRequest(new Request("https://dash-data.test/v1/indicators"));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(payload.quotes.map(q => q.symbol), ["^VIX", "GC=F", "SI=F", "^GSPC", "CL=F", "NG=F"]);
  assert.equal(payload.quotes[0].prev, 9);
  assert.ok(payload.quotes.every(q => q.series === undefined));
  assert.deepEqual([...new Set(requested)].length, 6);
});

test("crypto falls back to CoinPaprika in CoinGecko shape, cached for 30 minutes", async () => {
  installMemoryCache();
  const seen = [];
  const prices = { "btc-bitcoin": [51000, 2], "eth-ethereum": [1950, -2.5], "sol-solana": [70, 8], "ada-cardano": [0.14, 6],
    "xrp-xrp": [0.92, 8], "bnb-binance-coin": [524, 3] };
  globalThis.fetch = async url => {
    seen.push(String(url));
    if (/coingecko/.test(String(url))) return new Response("rate limited", { status: 429 });
    assert.match(String(url), /api\.coinpaprika\.com\/v1\/tickers\/[a-z-]+\?quotes=EUR$/);
    const [price, change] = prices[String(url).match(/tickers\/([a-z-]+)/)[1]];
    return Response.json({ quotes: { EUR: { price, percent_change_24h: change } } });
  };
  const env = { DASH_ORIGIN: "https://lcmadeira.github.io" };
  const response = await handleRequest(new Request("https://dash-data.test/v1/crypto", { headers: { Origin: env.DASH_ORIGIN } }), env, { waitUntil() {} });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.bitcoin.eur, 51000);
  assert.equal(payload.bitcoin.eur_24h_change, 2);
  assert.equal(payload.ethereum.eur_24h_change, -2.5);
  assert.match(payload._meta.source, /CoinPaprika/);
  assert.equal(payload._meta.state, "live");
  assert.match(response.headers.get("Cache-Control"), /s-maxage=1800/);
  assert.equal(seen.length, 7);
  assert.equal(parseCoinpaprikaTicker(JSON.stringify({ quotes: { EUR: { price: 0 } } })), null);
});

test("CoinPaprika retries only the missing coins and keeps a partial answer for 5 minutes", async () => {
  installMemoryCache();
  const calls = {};
  globalThis.fetch = async url => {
    if (/coingecko/.test(String(url))) return new Response("rate limited", { status: 429 });
    const id = String(url).match(/tickers\/([a-z-]+)/)[1];
    calls[id] = (calls[id] || 0) + 1;
    if (id === "ada-cardano" && calls[id] === 1) return new Response("too many", { status: 429 }); // recovers on retry
    if (id === "xrp-xrp") return new Response("too many", { status: 429 }); // stays missing
    return Response.json({ quotes: { EUR: { price: 10, percent_change_24h: 1 } } });
  };
  const env = { DASH_ORIGIN: "https://lcmadeira.github.io" };
  const response = await handleRequest(new Request("https://dash-data.test/v1/crypto", { headers: { Origin: env.DASH_ORIGIN } }), env, { waitUntil() {} });
  const payload = await response.json();
  assert.equal(payload.cardano.eur, 10, "recovered on the second attempt");
  assert.equal(payload.ripple, undefined);
  assert.equal(calls["ada-cardano"], 2);
  assert.equal(calls["btc-bitcoin"], 1, "coins that worked are not asked again");
  assert.equal(payload._meta.state, "partial");
  assert.match(response.headers.get("Cache-Control"), /s-maxage=300/);
});

test("dams use the site copy when SNIRH refuses Cloudflare", async () => {
  installMemoryCache();
  const basins = ["Arade", "Ave", "Cávado", "Douro", "Guadiana", "Lima", "Mondego", "Tejo"].map((name, i) => ({ name, val: 50 + i, avg: 40 }));
  const copy = { basins, totalVal: 60.1, totalAvg: 55, period: "2026-10", hydroYear: "2026/27", month: "OUT", _meta: { source: "x" } };
  globalThis.fetch = async url => {
    if (/snirh\.apambiente\.pt/.test(String(url))) return new Response("", { status: 520 });
    assert.equal(String(url), "https://lcmadeira.github.io/dash/data/dams.json");
    return Response.json(copy);
  };
  const env = { DASH_ORIGIN: "https://lcmadeira.github.io" };
  const response = await handleRequest(new Request("https://dash-data.test/v1/dams", { headers: { Origin: env.DASH_ORIGIN } }), env, { waitUntil() {} });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.period, "2026-10");
  assert.match(payload._meta.source, /cópia do site/);
  assert.equal(parseDamsSiteCopy(JSON.stringify(copy))._meta, undefined);
});

test("slow monthly routes answer from the stored copy and refresh in the background", async () => {
  const entries = installMemoryCache();
  const series = [{ period: "2026-09", value: 2.1 }, { period: "2026-10", value: 2.2 }];
  const ecbBody = periods => JSON.stringify({
    dataSets: [{ series: { "0": { observations: Object.fromEntries(periods.map((p, i) => [String(i), [p.value]])) } } }],
    structure: { dimensions: { observation: [{ values: periods.map(p => ({ id: p.period })) }] } },
  });
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(ecbBody(series), { headers: { "Content-Type": "application/json" } }); };
  const env = { DASH_ORIGIN: "https://lcmadeira.github.io" };
  const request = () => new Request("https://dash-data.test/v1/euribor", { headers: { Origin: env.DASH_ORIGIN } });
  const pending = [];
  const ctx = { waitUntil(p) { pending.push(p); } };

  const first = await handleRequest(request(), env, ctx);
  await Promise.all(pending.splice(0));
  assert.equal(first.headers.get("X-Dash-Cache"), "MISS");
  assert.equal(calls, 4, "one request per tenor");

  // Fresh copy expired; the stored copy is recent, so it is served at once and refreshed in the background.
  entries.delete("https://dash-data.test/v1/euribor");
  let release;
  globalThis.fetch = () => new Promise(resolve => { release = () => resolve(new Response(ecbBody([...series, { period: "2026-11", value: 2.3 }]))); calls++; });
  const second = await handleRequest(request(), env, ctx);
  assert.equal(second.headers.get("X-Dash-Cache"), "REVALIDATE");
  assert.equal((await second.json()).series["3M"].at(-1).period, "2026-10");
  assert.equal(pending.length, 1, "refresh scheduled with waitUntil");
  release?.();
});

test("TTF route keeps three months of daily closes for the trend charts", () => {
  const body = JSON.stringify({ chart: { result: [{
    meta: { regularMarketPrice: 31, currency: "EUR", regularMarketTime: 1795400000 },
    timestamp: [1795000000, 1795086400, 1795172800],
    indicators: { quote: [{ close: [29.5, 30.25, 31] }] },
  }] } });
  const q = parseYahooTtf(body);
  assert.equal(q.prev, 30.25);
  assert.equal(q.series.length, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(q.series[0])), { date: new Date(1795000000 * 1000).toISOString().slice(0, 10), value: 29.5 });
});
