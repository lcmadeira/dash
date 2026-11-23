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
/* Euribor (médias mensais) no BCE: a API demora 5-15 s por série, por isso fica em cache no gateway. */
const EURIBOR_TENORS = { "1M": "EURIBOR1MD_", "3M": "EURIBOR3MD_", "6M": "EURIBOR6MD_", "12M": "EURIBOR1YD_" };
/* Futuros agrícolas (CBOT/ICE) do cartão "Preços agrícolas"; lista fixa, nunca vinda do cliente. */
const AGRI_SYMBOLS = ["ZW=F", "ZC=F", "ZS=F", "KC=F", "SB=F", "CT=F"];
const SNIRH_PAGE = "https://snirh.apambiente.pt/index.php?idMain=1&idItem=1.3";
const SNIRH_TABLE = "https://snirh.apambiente.pt/snirh/_dadossintese/albufeiras/tabelas/tabelageral.php";
/* Alguns fornecedores recusam pedidos sem User-Agent vindos de servidores. */
const UPSTREAM_UA = "Mozilla/5.0 (compatible; dash-data-gateway/1.1)";
const ELECTRICITY_PATH = "/v1/electricity";

// Tráfego aéreo: Portugal continental (mesma área que o card usava com o OpenSky).
const AIR_BOX = { latMin: 36, latMax: 44, lonMin: -12, lonMax: -5 };
// O adsb.fi recusa a Cloudflare (403) e o adsb.lol limita os IPs partilhados da Cloudflare (429),
// verificado a 23-11-2026: só o adsb.lol, com cache de 3 min para gastar poucos pedidos.
const AIR_UPSTREAMS = [
  { url: "https://api.adsb.lol/v2/lat/40/lon/-8.5/dist/250", source: "adsb.lol (ODbL)" },
];
// Blocos de endereços ICAO 24-bit atribuídos a cada Estado (Anexo 10 da ICAO).
const ICAO_BLOCKS = [
  [0x006000, 0x006fff, "Moçambique"], [0x020000, 0x027fff, "Marrocos"], [0x040000, 0x040fff, "Etiópia"],
  [0x06a000, 0x06a3ff, "Catar"], [0x090000, 0x090fff, "Angola"], [0x096000, 0x0963ff, "Cabo Verde"],
  [0x0a0000, 0x0a7fff, "Argélia"], [0x0d0000, 0x0d7fff, "México"], [0x100000, 0x1fffff, "Rússia"],
  [0x300000, 0x33ffff, "Itália"], [0x340000, 0x37ffff, "Espanha"], [0x380000, 0x3bffff, "França"],
  [0x3c0000, 0x3fffff, "Alemanha"], [0x400000, 0x43ffff, "Reino Unido"], [0x440000, 0x447fff, "Áustria"],
  [0x448000, 0x44ffff, "Bélgica"], [0x450000, 0x457fff, "Bulgária"], [0x458000, 0x45ffff, "Dinamarca"],
  [0x460000, 0x467fff, "Finlândia"], [0x468000, 0x46ffff, "Grécia"], [0x470000, 0x477fff, "Hungria"],
  [0x478000, 0x47ffff, "Noruega"], [0x480000, 0x487fff, "Países Baixos"], [0x488000, 0x48ffff, "Polónia"],
  [0x490000, 0x497fff, "Portugal"], [0x498000, 0x49ffff, "Chéquia"], [0x4a0000, 0x4a7fff, "Roménia"],
  [0x4a8000, 0x4affff, "Suécia"], [0x4b0000, 0x4b7fff, "Suíça"], [0x4b8000, 0x4bffff, "Turquia"],
  [0x4c0000, 0x4c7fff, "Sérvia"], [0x4c8000, 0x4c87ff, "Chipre"], [0x4ca000, 0x4cafff, "Irlanda"],
  [0x4cc000, 0x4ccfff, "Islândia"], [0x4d0000, 0x4d03ff, "Luxemburgo"], [0x4d2000, 0x4d27ff, "Malta"],
  [0x501c00, 0x501fff, "Croácia"], [0x502c00, 0x502fff, "Letónia"], [0x503c00, 0x503fff, "Lituânia"],
  [0x505c00, 0x505fff, "Eslováquia"], [0x506c00, 0x506fff, "Eslovénia"], [0x511000, 0x5113ff, "Estónia"],
  [0x508000, 0x50ffff, "Ucrânia"], [0x710000, 0x717fff, "Arábia Saudita"], [0x738000, 0x73ffff, "Israel"],
  [0x780000, 0x7bffff, "China"], [0x7c0000, 0x7fffff, "Austrália"], [0x840000, 0x87ffff, "Japão"],
  [0x896000, 0x896fff, "Emirados Árabes Unidos"], [0xa00000, 0xafffff, "Estados Unidos"],
  [0xc00000, 0xc3ffff, "Canadá"], [0xe00000, 0xe3ffff, "Argentina"], [0xe40000, 0xe7ffff, "Brasil"],
  [0xe80000, 0xe80fff, "Chile"], [0xe94000, 0xe94fff, "Bolívia"],
];

export function icaoCountry(hex) {
  if (typeof hex !== "string" || !/^[0-9a-f]{6}$/i.test(hex)) return "";
  const value = parseInt(hex, 16);
  const block = ICAO_BLOCKS.find(([start, end]) => value >= start && value <= end);
  return block ? block[2] : "";
}

/**
 * Converte a resposta readsb (adsb.lol / adsb.fi) em vetores de estado no formato do OpenSky,
 * que é o que o card já sabe desenhar: [icao24, callsign, país, -, -, lon, lat, alt m,
 * em terra, velocidade m/s, rumo, razão vertical m/s].
 */
export function parseReadsbAircraft(body) {
  const json = typeof body === "string" ? JSON.parse(body) : body;
  const list = Array.isArray(json?.ac) ? json.ac : Array.isArray(json?.aircraft) ? json.aircraft : null;
  if (!list) return null;
  const num = value => (typeof value === "number" && Number.isFinite(value) ? value : null);
  const states = [];
  for (const ac of list) {
    const lat = num(ac?.lat), lon = num(ac?.lon);
    if (lat === null || lon === null || lat < AIR_BOX.latMin || lat > AIR_BOX.latMax
        || lon < AIR_BOX.lonMin || lon > AIR_BOX.lonMax) continue;
    if (num(ac.seen_pos) !== null && ac.seen_pos > 60) continue;
    const hex = String(ac.hex || "").replace(/^~/, "").toLowerCase().slice(0, 6);
    const onGround = ac.alt_baro === "ground";
    const altFt = onGround ? null : num(ac.alt_baro) ?? num(ac.alt_geom);
    const gs = num(ac.gs);
    const rate = num(ac.baro_rate) ?? num(ac.geom_rate);
    states.push([
      hex,
      String(ac.flight || "").trim().slice(0, 8),
      icaoCountry(hex),
      null,
      null,
      Math.round(lon * 1e4) / 1e4,
      Math.round(lat * 1e4) / 1e4,
      altFt === null ? null : Math.round(altFt * 0.3048),
      onGround,
      gs === null ? null : Math.round(gs * 0.514444 * 10) / 10,
      num(ac.track),
      rate === null ? null : Math.round(rate * 0.00508 * 10) / 10,
    ]);
  }
  const now = num(json.now);
  return { ts: now === null ? Date.now() : (now > 1e12 ? now : Math.round(now * 1000)), states };
}

function isValidAir(payload) {
  return Array.isArray(payload?.states) && payload.states.length > 0 && Number.isFinite(payload.ts);
}
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

/** Lê a última cotação de um gráfico Yahoo Finance (/v8/finance/chart). */
export function parseYahooChart(body) {
  const meta = JSON.parse(body)?.chart?.result?.[0]?.meta;
  if (!meta) return null;
  const price = Number(meta.regularMarketPrice);
  const prev = Number(meta.previousClose ?? meta.chartPreviousClose);
  return {
    price, prev,
    hi: Number.isFinite(Number(meta.regularMarketDayHigh)) ? Number(meta.regularMarketDayHigh) : price,
    lo: Number.isFinite(Number(meta.regularMarketDayLow)) ? Number(meta.regularMarketDayLow) : price,
    volume: Number.isFinite(Number(meta.regularMarketVolume)) ? Number(meta.regularMarketVolume) : null,
    currency: meta.currency,
    marketTime: Number.isFinite(Number(meta.regularMarketTime)) ? Number(meta.regularMarketTime) * 1000 : null,
  };
}

/** Lê o TTF (EUR/MWh) do gráfico Yahoo Finance. */
export const parseYahooTtf = parseYahooChart;

function isValidQuote(q) {
  return Number.isFinite(q?.price) && q.price > 0 && Number.isFinite(q?.prev) && q.prev > 0;
}

function isValidAgri(payload) {
  return Array.isArray(payload?.quotes) && payload.quotes.length === AGRI_SYMBOLS.length
    && payload.quotes.filter(q => isValidQuote(q)).length >= 4;
}

/** Série SDMX-JSON do BCE → [{period, value}] por ordem cronológica. */
export function parseEcbSeries(body) {
  const json = JSON.parse(body);
  const periods = json?.structure?.dimensions?.observation?.[0]?.values || [];
  const series = Object.values(json?.dataSets?.[0]?.series || {})[0];
  if (!series) return [];
  return Object.entries(series.observations || {})
    .map(([index, values]) => ({ period: periods[Number(index)]?.id, value: Number(values?.[0]) }))
    .filter(row => /^\d{4}-\d{2}$/.test(row.period || "") && Number.isFinite(row.value))
    .sort((a, b) => a.period.localeCompare(b.period));
}

function isValidEuribor(payload) {
  const ok = term => Array.isArray(payload?.series?.[term]) && payload.series[term].length >= 2;
  return ok("3M") && ok("12M");
}

async function fetchEuriborSeries(route) {
  const entries = await Promise.all(Object.entries(EURIBOR_TENORS).map(async ([term, code]) => {
    try {
      const url = `https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.${code}.HSTA?format=jsondata&lastNObservations=9`;
      const response = await fetchUpstream(url, "application/json", 20000);
      if (!response.ok) return [term, []];
      return [term, parseEcbSeries(await readBoundedBody(response, route.maxBytes))];
    } catch {
      return [term, []];
    }
  }));
  return { payload: { series: Object.fromEntries(entries) } };
}

/** Cotações dos futuros agrícolas, cada uma com alternativa query1 → query2. */
async function fetchAgriQuotes(route) {
  const quotes = await Promise.all(AGRI_SYMBOLS.map(async symbol => {
    for (const host of ["query1", "query2"]) {
      try {
        const response = await fetchUpstream(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`, route.accept, 6000);
        if (!response.ok) continue;
        const quote = parseYahooChart(await readBoundedBody(response, route.maxBytes));
        if (isValidQuote(quote)) return { symbol, ...quote };
      } catch { /* tenta o anfitrião seguinte */ }
    }
    return { symbol, price: null, prev: null };
  }));
  return { payload: { quotes } };
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
  // MARGINALPDBCPT (só Portugal) e MARGINALPDBC (ibérico) têm o mesmo formato:
  // ano;mês;dia;período;preço PT;preço ES. A coluna 5 é sempre a zona portuguesa.
  if (typeof text !== "string" || !/^MARGINALPDBC(PT)?;/.test(text.trimStart())) return null;
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

async function getStaleResponse(cache, key, route, headers, upstreamFailures) {
  const cached = await getCached(cache, key);
  if (!cached) return null;
  try {
    const payload = await cached.json();
    if (!route.valid(payload)) return null;
    payload._meta = { ...payload._meta, state: "stale", fallbackAt: Date.now(),
      ...(upstreamFailures?.length ? { upstreamFailures } : {}) };
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
  if (path === "/v1/euribor") {
    return { key: path, ttl: 12 * 3600, staleTtl: 45 * day, maxBytes: 200_000, accept: "application/json", valid: isValidEuribor,
      observedAt: p => Date.parse(`${p.series["3M"].at(-1).period}-15T12:00:00Z`),
      upstreams: [{ source: "BCE · Euribor (médias mensais)", run: fetchEuriborSeries }] };
  }
  if (path === "/v1/agri") {
    return { key: path, ttl: 900, staleTtl: 7 * day, maxBytes: 250_000, accept: "application/json", valid: isValidAgri,
      observedAt: p => Math.max(...p.quotes.map(q => q.marketTime || 0)) || undefined,
      upstreams: [{ source: "Yahoo Finance · futuros CBOT/ICE", run: fetchAgriQuotes }] };
  }
  if (path === "/v1/air") {
    // Dados em tempo real: cache de 3 min (limite do adsb.lol) e cópia de reserva de no máximo 15 min.
    return { key: path, ttl: 180, staleTtl: 900, maxBytes: 3_000_000, accept: "application/json", valid: isValidAir,
      observedAt: p => p.ts,
      upstreams: AIR_UPSTREAMS.map(u => ({ url: u.url, source: u.source, timeout: 7000, parse: parseReadsbAircraft })) };
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
  // Motivo por fornecedor (código HTTP ou tipo de erro), para diagnóstico quando se serve a cópia de reserva.
  const failures = [];
  for (const upstream of route.upstreams) {
    try {
      let result;
      if (upstream.run) result = await upstream.run(route);
      else {
        const response = await fetchUpstream(upstream.url, route.accept, upstream.timeout || 9000);
        if (!response.ok) result = { status: response.status };
        else result = { payload: upstream.parse(await readBoundedBody(response, route.maxBytes)) };
      }
      if (result.status) {
        failure = { error: "Fornecedor indisponível", upstreamStatus: result.status };
        failures.push({ source: upstream.source, status: result.status });
        continue;
      }
      if (result.invalid || !route.valid(result.payload)) {
        failure = { error: "Resposta inválida do fornecedor" };
        failures.push({ source: upstream.source, error: "invalid" });
        continue;
      }
      return { payload: result.payload, source: upstream.source };
    } catch (error) {
      failure = { error: "Não foi possível consultar o fornecedor" };
      failures.push({ source: upstream.source, error: error?.name === "TimeoutError" ? "timeout" : String(error?.name || "error").slice(0, 40) });
    }
  }
  failure.upstreamFailures = failures;
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
    return jsonResponse({ service: "dash-data-gateway", routes: ["/v1/crypto", "/v1/geopolitics", ...Object.keys(NEWS_FEEDS), ...Object.keys(RSS_FEEDS).map(id => `/v1/feed-${id}`), "/v1/ttf", "/v1/agri", "/v1/euribor", "/v1/dams", "/v1/air", ELECTRICITY_PATH] }, 200, headers);
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
    const stale = cache ? await getStaleResponse(cache, staleKey, route, headers, result.failure.upstreamFailures) : null;
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

const OMIE_PT_SOURCE = "OMIE · MARGINALPDBCPT · zona portuguesa";
const OMIE_IBERIAN_SOURCE = "OMIE · MARGINALPDBC (coluna PT) · zona portuguesa";

function omieFileUrl(parent, electricityDate) {
  return `https://www.omie.es/en/file-download?parents=${parent}&filename=${parent}_${electricityDate.replaceAll("-", "")}.1`;
}

async function handleElectricity(url, electricityDate, headers, ctx) {
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
    const accept = "text/plain, application/octet-stream";
    let source = OMIE_PT_SOURCE;
    let response = await fetchUpstream(omieFileUrl("marginalpdbcpt", electricityDate), accept, 9000);
    if (response.status === 404) {
      // O OMIE às vezes não publica o ficheiro só de Portugal (ex.: 21 e 23-11-2026),
      // mas o ficheiro ibérico do mesmo dia existe e traz o preço PT na coluna 5.
      const iberian = await fetchUpstream(omieFileUrl("marginalpdbc", electricityDate), accept, 9000);
      if (iberian.ok) { response = iberian; source = OMIE_IBERIAN_SOURCE; }
    }
    if (!response.ok) {
      if (response.status === 404 && electricityDate >= marketToday()) {
        // O OMIE responde 404 enquanto o ficheiro do dia ainda não foi publicado (D+1 sai à tarde).
        // Não é uma falha: responde 200 com published:false para o browser não registar erro.
        const pending = { date: electricityDate, published: false, periods: [],
          _meta: { source: OMIE_PT_SOURCE, state: "pending", checkedAt: Date.now() } };
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
    const output = { ...payload, _meta: { source, state: "live", checkedAt: Date.now() } };
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
