const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,cardano,ripple,binancecoin&vs_currencies=eur&include_24hr_change=true";
const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc?query=%28geopolitics%20OR%20conflict%20OR%20war%20OR%20diplomacy%20OR%20sanctions%29&mode=ArtList&format=json&maxrecords=30&sort=DateDesc&timespan=7d";
/* Fontes que respondem à Cloudflare primeiro: o Google News recusa (503) pedidos do gateway. */
const NEWS_FEEDS = {
  "/v1/news-pt": [
    { url: "https://www.rtp.pt/noticias/rss", source: "RTP Notícias", item: "RTP" },
    { url: "https://feeds.feedburner.com/PublicoRSS", source: "Público", item: "Público" },
    { url: "https://news.google.com/rss/search?q=portugal+hoje&hl=pt-PT&gl=PT&ceid=PT%3Apt", source: "Google News RSS · Portugal", item: "Google News" },
  ],
  "/v1/news-world": [
    { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC News · World", item: "BBC News" },
    { url: "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US%3Aen", source: "Google News RSS · Mundo", item: "Google News" },
  ],
};
/* Feeds RSS fixos da geopolítica (o cliente escolhe por id; nunca por URL). */
const RSS_FEEDS = {
  icg: { url: "https://www.crisisgroup.org/rss/139", source: "Crisis Group" },
  gpf: { url: "https://geopoliticalfutures.com/feed/", source: "Geopolitical Futures" },
  fa: { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC World" },
};
const YAHOO_TTF = ["query1", "query2"].map(host => `https://${host}.finance.yahoo.com/v8/finance/chart/TTF=F?range=5d&interval=1d`);
const SNIRH_PAGE = "https://snirh.apambiente.pt/index.php?idMain=1&idItem=1.3";
const SNIRH_TABLE = "https://snirh.apambiente.pt/snirh/_dadossintese/albufeiras/tabelas/tabelageral.php";
/* Alguns fornecedores recusam pedidos sem User-Agent vindos de servidores. */
const UPSTREAM_UA = "Mozilla/5.0 (compatible; dash-data-gateway/1.1)";
const ELECTRICITY_PATH = "/v1/electricity";
const LOCAL_ORIGINS = new Set(["http://localhost:8000", "http://127.0.0.1:8000"]);
const COIN_IDS = ["bitcoin", "ethereum", "solana", "cardano", "ripple", "binancecoin"];

function corsHeaders(origin, env) {
  const allowed = new Set(LOCAL_ORIGINS);
  if (typeof env.DASH_ORIGIN === "string" && env.DASH_ORIGIN) allowed.add(env.DASH_ORIGIN);
  const headers = new Headers({ "Vary": "Origin" });
  if (origin && allowed.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function jsonResponse(data, status, headers) {
  const resultHeaders = new Headers(headers);
  resultHeaders.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { status, headers: resultHeaders });
}

function isValidNews(payload) {
  return Array.isArray(payload?.articles) && payload.articles.length > 0
    && payload.articles.every(article => typeof article?.title === "string"
      && article.title.length > 3 && typeof article?.link === "string"
      && /^https:\/\//i.test(article.link));
}

function isValidElectricity(payload) {
  return /^\d{4}-\d{2}-\d{2}$/.test(payload?.date || "")
    && [23, 24, 25, 92, 96, 100].includes(payload?.periods?.length)
    && payload.periods.every((period, index) => period.period === index + 1
      && Number.isFinite(period.priceMwh) && period.priceMwh >= -500 && period.priceMwh <= 5000);
}

function isValidTtf(payload) {
  return Number.isFinite(payload?.price) && payload.price > 0 && payload.price < 500
    && Number.isFinite(payload?.prev) && payload.prev > 0 && payload.currency === "EUR";
}

function isValidDams(payload) {
  return Array.isArray(payload?.basins) && payload.basins.length >= 8
    && payload.basins.every(b => typeof b?.name === "string" && Number.isFinite(b.val) && b.val >= 0 && b.val <= 100)
    && Number.isFinite(payload.totalVal) && /^\d{4}-\d{2}$/.test(payload.period || "");
}

/** Lê o TTF (EUR/MWh) do gráfico Yahoo Finance. */
export function parseYahooTtf(body) {
  const meta = JSON.parse(body)?.chart?.result?.[0]?.meta;
  if (!meta) return null;
  const price = Number(meta.regularMarketPrice);
  const prev = Number(meta.previousClose ?? meta.chartPreviousClose);
  return {
    price, prev,
    hi: Number.isFinite(Number(meta.regularMarketDayHigh)) ? Number(meta.regularMarketDayHigh) : price,
    lo: Number.isFinite(Number(meta.regularMarketDayLow)) ? Number(meta.regularMarketDayLow) : price,
    currency: meta.currency,
    marketTime: Number.isFinite(Number(meta.regularMarketTime)) ? Number(meta.regularMarketTime) * 1000 : null,
  };
}

const SNIRH_MONTHS = ["OUT", "NOV", "DEZ", "JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET"];

function cellText(html) {
  return decodeXml(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function snirhNumber(text) {
  const value = Number(String(text).replace(/\s+/g, "").replace(",", "."));
  return text && !/n\/d/i.test(text) && Number.isFinite(value) ? value : null;
}

function titleCasePt(name) {
  return name.toLowerCase().replace(/(^|[\s/-])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase())
    .replace(/\b(Do|Da|Dos|Das|De|E)\b/g, w => w.toLowerCase());
}

/**
 * Lê a tabela geral de albufeiras do SNIRH (percentagem armazenada por bacia).
 * Usa a linha mais recente com valores e a média histórica desse mês; pondera o total pela capacidade.
 * @param {string} html Página tabelageral.php.
 * @param {number} hydroStartYear Ano de início do ano hidrológico (anohi).
 */
export function parseSnirhTable(html, hydroStartYear) {
  if (typeof html !== "string") return null;
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map(m => [...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => cellText(c[1])));
  const header = rows.find(cells => cells.some(c => /^TEJO$/i.test(c)) && cells.some(c => /^DOURO$/i.test(c)));
  if (!header) return null;
  const names = header.filter(Boolean);
  const capacityRow = rows.find(cells => /^Capacidade/i.test(cells[0] || ""));
  const capacity = capacityRow ? capacityRow.slice(1, 1 + names.length).map(snirhNumber) : [];
  const averages = {};
  let latest = null;
  let section = "";
  for (const cells of rows) {
    let month;
    let values;
    if (/%\)?$/.test(cells[0] || "") && SNIRH_MONTHS.includes(cells[1])) {
      section = cells[0];
      month = cells[1];
      values = cells.slice(2, 2 + names.length);
    } else if (SNIRH_MONTHS.includes(cells[0]) && section) {
      month = cells[0];
      values = cells.slice(1, 1 + names.length);
    } else continue;
    const nums = values.map(snirhNumber);
    if (/^M[ée]dia/i.test(section)) {
      if (nums.some(v => v !== null)) averages[month] = nums;
      continue;
    }
    if (nums.filter(v => v !== null).length >= Math.ceil(names.length * 0.75)) latest = { section, month, nums };
  }
  if (!latest) return null;
  const avg = averages[latest.month] || [];
  const basins = names.map((name, i) => ({
    name: titleCasePt(name), val: latest.nums[i], avg: avg[i] ?? null, capacity: capacity[i] ?? null,
  })).filter(b => Number.isFinite(b.val));
  const weighted = key => {
    const usable = basins.filter(b => Number.isFinite(b[key]) && Number.isFinite(b.capacity) && b.capacity > 0);
    const cap = usable.reduce((sum, b) => sum + b.capacity, 0);
    return cap ? +(usable.reduce((sum, b) => sum + b[key] * b.capacity, 0) / cap).toFixed(1) : null;
  };
  const monthIndex = SNIRH_MONTHS.indexOf(latest.month);
  const year = hydroStartYear + (monthIndex >= 3 ? 1 : 0);
  const calendarMonth = ((monthIndex + 9) % 12) + 1;
  return {
    basins,
    totalVal: weighted("val"),
    totalAvg: weighted("avg"),
    period: `${year}-${String(calendarMonth).padStart(2, "0")}`,
    hydroYear: latest.section.replace(/\s*\(%\)\s*$/, ""),
    month: latest.month,
  };
}

/** Data do mercado ibérico (Europe/Madrid) no formato AAAA-MM-DD. */
export function marketToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function parseOmieElectricity(text, expectedDate) {
  if (typeof text !== "string" || !/^MARGINALPDBCPT;/.test(text.trimStart())) return null;
  const periods = [];
  const [year, month, day] = expectedDate.split("-").map(Number);
  for (const line of text.split(/\r?\n/)) {
    const fields = line.split(";");
    if (fields.length < 6 || Number(fields[0]) !== year
        || Number(fields[1]) !== month || Number(fields[2]) !== day) continue;
    const period = Number(fields[3]);
    const priceMwh = Number(fields[4]);
    if (!Number.isInteger(period) || period < 1 || period > 100
        || !Number.isFinite(priceMwh) || priceMwh < -500 || priceMwh > 5000) continue;
    periods.push({ period, priceMwh });
  }
  periods.sort((a, b) => a.period - b.period);
  if (![23, 24, 25, 92, 96, 100].includes(periods.length)
      || periods.some((item, index) => item.period !== index + 1)) return null;
  return { date: expectedDate, periods };
}

async function readBoundedBody(response, maxBytes, encoding = "utf-8") {
  const declared = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("Resposta do fornecedor excede o limite");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("Resposta do fornecedor excede o limite");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (encoding === "latin1") {
    let text = "";
    for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return text;
  }
  return new TextDecoder().decode(bytes);
}

function decodeXml(value) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, code) => {
      const point = code[0]?.toLowerCase() === "x" ? parseInt(code.slice(1), 16) : parseInt(code, 10);
      return Number.isFinite(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    })
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function rssTag(item, name) {
  const match = new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + name + ">", "i").exec(item);
  return match ? decodeXml(match[1]).replace(/<[^>]*>/g, "").trim() : "";
}

function parseNewsRss(xml, defaultSource = "Google News") {
  if (typeof xml !== "string" || !/<rss\b/i.test(xml) || /<parsererror\b/i.test(xml)) return [];
  const articles = [];
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const item = match[1];
    const title = rssTag(item, "title").replace(/\s+/g, " ").trim().slice(0, 300);
    const link = rssTag(item, "link");
    const pubDate = rssTag(item, "pubDate").slice(0, 100);
    const publishedAt = Date.parse(pubDate);
    let validLink = false;
    try { const parsed = new URL(link); validLink = parsed.protocol === "https:" && !parsed.username && !parsed.password; } catch {}
    if (!title || !validLink || (Number.isFinite(publishedAt) && publishedAt > Date.now() + 5 * 60 * 1000)) continue;
    articles.push({ title, link, source: rssTag(item, "source").slice(0, 80) || defaultSource, pubDate });
    if (articles.length === 12) break;
  }
  return articles;
}

function latestNewsTimestamp(articles) {
  return articles.map(article => Date.parse(article.pubDate || ""))
    .filter(value => Number.isFinite(value) && value <= Date.now() + 5 * 60 * 1000)
    .reduce((latest, value) => Math.max(latest, value), 0) || null;
}

async function getCached(cache, key) {
  try { return await cache.match(key); } catch { return null; }
}

async function putCached(cache, key, response, ctx) {
  try {
    const task = cache.put(key, response.clone());
    if (typeof ctx.waitUntil === "function") ctx.waitUntil(task);
    else await task;
  } catch {}
}

function staleCacheKey(url) {
  const stale = new URL(url);
  stale.searchParams.set("__dash_stale", "1");
  return new Request(stale.toString(), { method: "GET" });
}

async function getStaleResponse(cache, key, route, headers) {
  const cached = await getCached(cache, key);
  if (!cached) return null;
  try {
    const payload = await cached.json();
    if (!route.valid(payload)) return null;
    payload._meta = { ...payload._meta, state: "stale", fallbackAt: Date.now() };
    const staleHeaders = new Headers(cached.headers);
    headers.forEach((value, name) => staleHeaders.set(name, value));
    staleHeaders.set("Cache-Control", "public, max-age=0, s-maxage=0");
    staleHeaders.set("X-Dash-Cache", "STALE");
    staleHeaders.set("Warning", '110 - "Response is stale"');
    return jsonResponse(payload, 200, staleHeaders);
  } catch {
    return null;
  }
}

/** Configuração de cada rota: fornecedores por ordem, validação, cache e cópia de reserva. */
function routeFor(url) {
  const path = url.pathname;
  const day = 86400;
  if (path === "/v1/crypto") {
    return { key: path, ttl: 90, staleTtl: day, maxBytes: 250_000, accept: "application/json", valid: p => COIN_IDS.some(id => Number.isFinite(p?.[id]?.eur) && p[id].eur > 0),
      upstreams: [{ url: COINGECKO_URL, source: "CoinGecko", parse: body => JSON.parse(body) }] };
  }
  if (path === "/v1/geopolitics") {
    return { key: path, ttl: 600, staleTtl: day, maxBytes: 1_500_000, accept: "application/json", valid: p => Array.isArray(p?.articles),
      upstreams: [{ url: GDELT_URL, source: "GDELT DOC", parse: body => JSON.parse(body) }] };
  }
  if (NEWS_FEEDS[path]) {
    return { key: path, ttl: 300, staleTtl: day, maxBytes: 500_000, accept: "application/rss+xml, application/xml, text/xml", valid: isValidNews, news: true,
      upstreams: NEWS_FEEDS[path].map(feed => ({ url: feed.url, source: feed.source, timeout: 5000,
        parse: body => ({ articles: parseNewsRss(body, feed.item) }) })) };
  }
  const feedMatch = /^\/v1\/feed-([a-z]+)$/.exec(path);
  if (feedMatch) {
    const id = feedMatch[1];
    const feed = Object.hasOwn(RSS_FEEDS, id) ? RSS_FEEDS[id] : null;
    if (!feed) return null;
    return { key: path, ttl: 900, staleTtl: 2 * day, maxBytes: 1_000_000, accept: "application/rss+xml, application/xml, text/xml", valid: isValidNews, news: true,
      upstreams: [{ url: feed.url, source: feed.source, parse: body => ({ articles: parseNewsRss(body, feed.source) }) }] };
  }
  if (path === "/v1/ttf") {
    return { key: path, ttl: 900, staleTtl: 7 * day, maxBytes: 250_000, accept: "application/json", valid: isValidTtf,
      observedAt: p => p.marketTime,
      upstreams: YAHOO_TTF.map(u => ({ url: u, source: "Yahoo Finance · TTF=F (ICE Endex)", timeout: 6000, parse: parseYahooTtf })) };
  }
  if (path === "/v1/dams") {
    return { key: path, ttl: 6 * 3600, staleTtl: 45 * day, maxBytes: 200_000, accept: "text/html", valid: isValidDams,
      observedAt: p => Date.parse(`${p.period}-15T12:00:00Z`),
      upstreams: [{ source: "SNIRH · APA (albufeiras)", run: fetchSnirhDams }] };
  }
  return null;
}

async function fetchUpstream(url, accept, timeout) {
  return fetch(url, { headers: { Accept: accept, "User-Agent": UPSTREAM_UA }, signal: AbortSignal.timeout(timeout) });
}

async function fetchSnirhDams(route) {
  const page = await fetchUpstream(SNIRH_PAGE, "text/html", 6000);
  if (!page.ok) return { status: page.status };
  const html = await readBoundedBody(page, 200_000, "latin1");
  const match = /ALBUFBOL_AbreTabelaGeral\('(\d{4})','(\d{1,2})'/.exec(html);
  if (!match) return { invalid: true };
  const tableUrl = `${SNIRH_TABLE}?percOUvolum=0&anohi=${match[1]}&mes=${match[2]}&bacia=&albuf=&albuftblgeralopcao=&zonas=`;
  const table = await fetchUpstream(tableUrl, "text/html", 8000);
  if (!table.ok) return { status: table.status };
  return { payload: parseSnirhTable(await readBoundedBody(table, route.maxBytes, "latin1"), Number(match[1])) };
}

/** Tenta os fornecedores da rota por ordem; devolve o primeiro resultado válido ou o motivo da falha. */
async function fetchFromUpstreams(route) {
  let failure = { error: "Não foi possível consultar o fornecedor" };
  for (const upstream of route.upstreams) {
    try {
      let result;
      if (upstream.run) result = await upstream.run(route);
      else {
        const response = await fetchUpstream(upstream.url, route.accept, upstream.timeout || 9000);
        if (!response.ok) result = { status: response.status };
        else result = { payload: upstream.parse(await readBoundedBody(response, route.maxBytes)) };
      }
      if (result.status) { failure = { error: "Fornecedor indisponível", upstreamStatus: result.status }; continue; }
      if (result.invalid || !route.valid(result.payload)) { failure = { error: "Resposta inválida do fornecedor" }; continue; }
      return { payload: result.payload, source: upstream.source };
    } catch {
      failure = { error: "Não foi possível consultar o fornecedor" };
    }
  }
  return { failure };
}

export async function handleRequest(request, env = {}, ctx = {}) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const headers = corsHeaders(origin, env);
  const allowedOrigins = new Set(LOCAL_ORIGINS);
  if (typeof env.DASH_ORIGIN === "string" && env.DASH_ORIGIN) allowedOrigins.add(env.DASH_ORIGIN);

  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse({ error: "Origem não permitida" }, 403, headers);
  }
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "86400");
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "GET") return jsonResponse({ error: "Método não permitido" }, 405, headers);
  if (url.pathname === "/v1/status") {
    return jsonResponse({ service: "dash-data-gateway", routes: ["/v1/crypto", "/v1/geopolitics", ...Object.keys(NEWS_FEEDS), ...Object.keys(RSS_FEEDS).map(id => `/v1/feed-${id}`), "/v1/ttf", "/v1/dams", ELECTRICITY_PATH] }, 200, headers);
  }

  let electricityDate = null;
  if (url.pathname === ELECTRICITY_PATH) {
    electricityDate = url.searchParams.get("date") || "";
    const parsedDate = new Date(`${electricityDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(electricityDate)
        || !Number.isFinite(parsedDate.getTime())
        || parsedDate.toISOString().slice(0, 10) !== electricityDate) {
      return jsonResponse({ error: "Data inválida" }, 400, headers);
    }
  }

  if (url.pathname === ELECTRICITY_PATH) return handleElectricity(url, electricityDate, headers, ctx);

  const route = routeFor(url);
  if (!route) return jsonResponse({ error: "Rota não encontrada" }, 404, headers);
  return serveRoute(url, route, headers, ctx);
}

async function serveRoute(url, route, headers, ctx) {
  const cache = globalThis.caches?.default;
  const cacheUrl = `${url.origin}${route.key}`;
  const cacheKey = new Request(cacheUrl, { method: "GET" });
  const staleKey = staleCacheKey(cacheUrl);
  if (cache) {
    const cached = await getCached(cache, cacheKey);
    if (cached) {
      const responseHeaders = new Headers(cached.headers);
      headers.forEach((value, key) => responseHeaders.set(key, value));
      responseHeaders.set("X-Dash-Cache", "HIT");
      return new Response(cached.body, { status: cached.status, headers: responseHeaders });
    }
  }
  const result = await fetchFromUpstreams(route);
  if (!result.payload) {
    const stale = cache ? await getStaleResponse(cache, staleKey, route, headers) : null;
    if (stale) return stale;
    return jsonResponse(result.failure, 502, headers);
  }
  const observedAt = route.news ? latestNewsTimestamp(result.payload.articles) : route.observedAt?.(result.payload) || undefined;
  const output = { ...result.payload, _meta: { source: result.source, state: "live", ...(observedAt ? { observedAt } : {}), checkedAt: Date.now() } };
  headers.set("Cache-Control", `public, max-age=30, s-maxage=${route.ttl}`);
  headers.set("X-Dash-Cache", "MISS");
  const response = jsonResponse(output, 200, headers);
  if (cache) {
    await putCached(cache, cacheKey, response, ctx);
    const staleHeaders = new Headers(response.headers);
    staleHeaders.set("Cache-Control", `public, max-age=0, s-maxage=${route.staleTtl}`);
    await putCached(cache, staleKey, new Response(JSON.stringify(output), { status: 200, headers: staleHeaders }), ctx);
  }
  return response;
}

const ELECTRICITY_ROUTE = { valid: isValidElectricity };

async function handleElectricity(url, electricityDate, headers, ctx) {
  const upstream = `https://www.omie.es/en/file-download?parents=marginalpdbcpt&filename=marginalpdbcpt_${electricityDate.replaceAll("-", "")}.1`;
  const cacheControl = "public, max-age=30, s-maxage=300";
  const cache = globalThis.caches?.default;
  const cacheUrl = `${url.origin}${url.pathname}?date=${electricityDate}`;
  const cacheKey = new Request(cacheUrl, { method: "GET" });
  const staleKey = staleCacheKey(cacheUrl);
  if (cache) {
    const cached = await getCached(cache, cacheKey);
    if (cached) {
      const responseHeaders = new Headers(cached.headers);
      headers.forEach((value, key) => responseHeaders.set(key, value));
      responseHeaders.set("X-Dash-Cache", "HIT");
      return new Response(cached.body, { status: cached.status, headers: responseHeaders });
    }
  }

  try {
    const response = await fetchUpstream(upstream, "text/plain, application/octet-stream", 9000);
    if (!response.ok) {
      if (response.status === 404 && electricityDate >= marketToday()) {
        // O OMIE responde 404 enquanto o ficheiro do dia ainda não foi publicado (D+1 sai à tarde).
        // Não é uma falha: responde 200 com published:false para o browser não registar erro.
        const pending = { date: electricityDate, published: false, periods: [],
          _meta: { source: "OMIE · MARGINALPDBCPT · zona portuguesa", state: "pending", checkedAt: Date.now() } };
        headers.set("Cache-Control", "public, max-age=60, s-maxage=300");
        headers.set("X-Dash-Cache", "MISS");
        const result = jsonResponse(pending, 200, headers);
        if (cache) await putCached(cache, cacheKey, result, ctx);
        return result;
      }
      const stale = cache ? await getStaleResponse(cache, staleKey, ELECTRICITY_ROUTE, headers) : null;
      if (stale) return stale;
      return jsonResponse({ error: "Fornecedor indisponível", upstreamStatus: response.status }, 502, headers);
    }
    const payload = parseOmieElectricity(await readBoundedBody(response, 100_000), electricityDate);
    if (!isValidElectricity(payload)) {
      const stale = cache ? await getStaleResponse(cache, staleKey, ELECTRICITY_ROUTE, headers) : null;
      if (stale) return stale;
      return jsonResponse({ error: "Resposta inválida do fornecedor" }, 502, headers);
    }
    const output = { ...payload, _meta: { source: "OMIE · MARGINALPDBCPT · zona portuguesa", state: "live", checkedAt: Date.now() } };
    headers.set("Cache-Control", cacheControl);
    headers.set("X-Dash-Cache", "MISS");
    const result = jsonResponse(output, 200, headers);
    if (cache) {
      await putCached(cache, cacheKey, result, ctx);
      const staleHeaders = new Headers(result.headers);
      staleHeaders.set("Cache-Control", "public, max-age=0, s-maxage=86400");
      await putCached(cache, staleKey, new Response(JSON.stringify(output), { status: 200, headers: staleHeaders }), ctx);
    }
    return result;
  } catch {
    const stale = cache ? await getStaleResponse(cache, staleKey, ELECTRICITY_ROUTE, headers) : null;
    if (stale) return stale;
    return jsonResponse({ error: "Não foi possível consultar o fornecedor" }, 502, headers);
  }
}

export default { fetch: handleRequest };
