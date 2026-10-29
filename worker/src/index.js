const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,cardano,ripple,binancecoin&vs_currencies=eur&include_24hr_change=true";
const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc?query=%28geopolitics%20OR%20conflict%20OR%20war%20OR%20diplomacy%20OR%20sanctions%29&mode=ArtList&format=json&maxrecords=30&sort=DateDesc&timespan=7d";
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

function isValidPayload(path, payload) {
  if (path === "/v1/crypto") {
    return COIN_IDS.some(id => Number.isFinite(payload?.[id]?.eur) && payload[id].eur > 0);
  }
  return path === "/v1/geopolitics" && Array.isArray(payload?.articles);
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

async function getStaleResponse(cache, key, path, headers) {
  const cached = await getCached(cache, key);
  if (!cached) return null;
  try {
    const payload = await cached.json();
    if (!isValidPayload(path, payload)) return null;
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
    return jsonResponse({ service: "dash-data-gateway", routes: ["/v1/crypto", "/v1/geopolitics"] }, 200, headers);
  }

  const upstream = url.pathname === "/v1/crypto" ? COINGECKO_URL
    : url.pathname === "/v1/geopolitics" ? GDELT_URL : null;
  if (!upstream) return jsonResponse({ error: "Rota não encontrada" }, 404, headers);

  const ttl = url.pathname === "/v1/crypto" ? 90 : 600;
  const cacheControl = `public, max-age=30, s-maxage=${ttl}`;
  const cache = globalThis.caches?.default;
  const cacheKey = new Request(`${url.origin}${url.pathname}`, { method: "GET" });
  const staleKey = staleCacheKey(`${url.origin}${url.pathname}`);
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
    const response = await fetch(upstream, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) {
      const stale = cache ? await getStaleResponse(cache, staleKey, url.pathname, headers) : null;
      if (stale) return stale;
      return jsonResponse({ error: "Fornecedor indisponível", upstreamStatus: response.status }, 502, headers);
    }
    const payload = await response.json();
    if (!isValidPayload(url.pathname, payload)) {
      const stale = cache ? await getStaleResponse(cache, staleKey, url.pathname, headers) : null;
      if (stale) return stale;
      return jsonResponse({ error: "Resposta inválida do fornecedor" }, 502, headers);
    }

    const output = url.pathname === "/v1/crypto"
      ? { ...payload, _meta: { source: "CoinGecko", state: "live", checkedAt: Date.now() } }
      : { ...payload, _meta: { source: "GDELT DOC", state: "live", checkedAt: Date.now() } };
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
    const stale = cache ? await getStaleResponse(cache, staleKey, url.pathname, headers) : null;
    if (stale) return stale;
    return jsonResponse({ error: "Não foi possível consultar o fornecedor" }, 502, headers);
  }
}

export default { fetch: handleRequest };
