/* dash fetch/proxy helpers (loaded before index.html inline script) */
(function () {
  const IS_LOCAL_DEV =
    location.protocol === "file:" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

  function localProxyUrl(url) {
    const enc = encodeURIComponent(url);
    if (location.protocol === "file:") {
      const port = Number(window.CFG?.LOCAL_PROXY_PORT || 8000);
      return `http://localhost:${port}/proxy?url=${enc}`;
    }
    return `/proxy?url=${enc}`;
  }

  async function fetchViaLocalProxy(url, options = {}) {
    return fetch(localProxyUrl(url), { ...options, signal: AbortSignal.timeout(12000) });
  }

  function isFetchDebugEnabled() {
    try {
      const qs = new URLSearchParams(location.search || "");
      if (qs.has("debugFetch")) return (qs.get("debugFetch") || "1") !== "0";
      const pfx = window.PFX || "dash_";
      const v = localStorage.getItem(pfx + "debug_fetch");
      return v === "1" || v === "true";
    } catch {
      return false;
    }
  }

  window.setFetchDebug = function setFetchDebug(on = true) {
    try {
      const pfx = window.PFX || "dash_";
      localStorage.setItem(pfx + "debug_fetch", on ? "1" : "0");
    } catch {}
    console.log(`[fetch-debug] ${on ? "ON" : "OFF"} (persistido em localStorage)`);
    return !!on;
  };

  function buildFetchPlan(url, sources) {
    const isCorsHost = (u) => {
      const h = new URL(u).hostname.toLowerCase();
      return h.includes("stooq") || h.includes("apambiente") || h.includes("ecb.europa.eu") || 
             h.includes("eurostat") || h.includes("opensky-network") || h.includes("aishub") || 
             h.includes("ren.pt") || h.includes("usgs.gov") || h.includes("ine.pt") || h.includes("coingecko");
    };

    const out = [];
    const add = (source, u) => {
      if (u && !out.some((x) => x.url === u)) out.push({ source, url: u });
    };

    /* Determinar fontes padrão se não fornecidas */
    const s = new Set(Array.isArray(sources) && sources.length ? sources : ["direct", "local", "allorigins", "corsproxy", "codetabs"]);

    /* 1. Direct (só se local ou se o host permitir CORS nativo ou se for forçado) */
    if (s.has("direct") && (IS_LOCAL_DEV || !isCorsHost(url))) {
      add("direct", url);
    }

    /* 2. Local Proxy (só em dev) */
    if (s.has("local") && IS_LOCAL_DEV) {
      add("localproxy", localProxyUrl(url));
    }

    /* 3. AllOrigins (Muito estável, mas tem rate limits) */
    if (s.has("allorigins")) {
      add("allorigins", `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
    }

    /* 4. CorsProxy.io (Rápido e fiável) */
    if (s.has("corsproxy")) {
      add("corsproxy", `https://corsproxy.io/?url=${encodeURIComponent(url)}`);
    }

    /* 5. CodeTabs (Boa alternativa) */
    if (s.has("codetabs")) {
      add("codetabs", `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`);
    }

    /* 6. Jina (Fallback para conteúdo denso) */
    if (s.has("jina")) {
      const u = url.replace(/^https?:\/\//, "");
      add("jina", `https://r.jina.ai/http://${u}`);
    }

    return out;
  }

  function withTimeoutOpts(options = {}, timeoutMs = 12000) {
    const hasSignal = !!options.signal;
    return { ...options, signal: hasSignal ? options.signal : AbortSignal.timeout(timeoutMs) };
  }

  /* Cache de proxies em "cool down" por 1 minuto se derem 429 */
  const proxyCoolDown = new Map();

  async function fetchFirstOk(url, options = {}, timeoutMs = 12000, sources, validate) {
    const plan = buildFetchPlan(url, sources);
    let lastErr = null;
    const now = Date.now();

    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      
      /* Saltar se estiver em cooldown */
      if (proxyCoolDown.has(step.source) && now < proxyCoolDown.get(step.source)) {
        continue;
      }

      try {
        if (isFetchDebugEnabled()) console.debug(`[fetch] try #${i + 1}/${plan.length} ${step.source}`, url);
        const r = await fetch(step.url, withTimeoutOpts(options, timeoutMs));
        
        if (r.status === 429) {
          proxyCoolDown.set(step.source, now + 60000); // 1 minuto de pausa
          if (isFetchDebugEnabled()) console.warn(`[fetch] 429 rate limit on ${step.source}, cooling down...`);
          continue;
        }

        if (!r.ok) {
          lastErr = new Error(`HTTP ${r.status}`);
          continue;
        }
        
        if (validate && !(await validate(r))) {
          lastErr = new Error("validate");
          continue;
        }
        
        if (isFetchDebugEnabled()) console.info(`[fetch] ok ${step.source}`, url);
        return { r, usedUrl: step.url };
      } catch (e) {
        lastErr = e;
        if (isFetchDebugEnabled()) console.debug(`[fetch] err ${step.source}`, url, e?.message || e);
      }
    }
    throw lastErr || new Error("Fetch indisponível (todos os proxies falharam)");
  }

  async function fetchWithCORS(url, options = {}, timeoutMs = 12000) {
    const { r } = await fetchFirstOk(url, options, timeoutMs);
    return r;
  }

  async function fetchStooqMulti(symbols) {
    if (!Array.isArray(symbols) || !symbols.length) return {};
    const symStr = symbols.map(s => encodeURIComponent(s)).join("+");
    const url = `https://stooq.com/q/l/?s=${symStr}&f=sd2t2ohlcv&h&e=csv&_=${Date.now()}`;

    try {
      const r = await fetchWithCORS(url, { cache: "no-store" }, 10000);
      if (!r.ok) return {};
      const csv = await r.text();
      const lines = csv.trim().split("\n");
      if (lines.length < 2) return {};

      const results = {};
      /* Header: Symbol,Date,Time,Open,High,Low,Close,Volume */
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",");
        if (cols.length < 7) continue;
        const s = cols[0].toLowerCase();
        const open = parseFloat(cols[3]);
        const hi = parseFloat(cols[4]);
        const lo = parseFloat(cols[5]);
        const close = parseFloat(cols[6]);
        const vol = parseFloat(cols[7]) || 0;

        if (!isNaN(close) && close > 0) {
          const prev = (!isNaN(open) && open > 0) ? open : close;
          results[s] = {
            price: close,
            prev,
            hi,
            lo,
            vol,
            chg: prev ? ((close - prev) / prev * 100) : 0,
            live: true,
            src: "stooq"
          };
        }
      }
      return results;
    } catch (e) {
      console.warn("[fetchStooqMulti] failed", e);
      return {};
    }
  }

  async function fetchJsonFirstOk(url, options = {}, timeoutMs = 12000, sources, validateJson) {
    const plan = buildFetchPlan(url, sources);
    let lastErr = null;
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      try {
        if (isFetchDebugEnabled()) console.debug(`[fetch-json] try #${i + 1}/${plan.length} ${step.source}`, url);
        const r = await fetch(step.url, withTimeoutOpts(options, timeoutMs));
        if (!r.ok) {
          lastErr = new Error(`HTTP ${r.status}`);
          if (isFetchDebugEnabled()) console.debug(`[fetch-json] fail ${step.source} HTTP ${r.status}`, url);
          continue;
        }
        const j = await r.json();
        if (validateJson && !validateJson(j)) {
          lastErr = new Error("validateJson");
          continue;
        }
        if (isFetchDebugEnabled()) console.info(`[fetch-json] ok ${step.source}`, url);
        return j;
      } catch (e) {
        lastErr = e;
        if (isFetchDebugEnabled()) console.debug(`[fetch-json] err ${step.source}`, url, e?.message || e);
      }
    }
    throw lastErr || new Error("JSON indisponível");
  }

  async function fetchTextFirstOk(url, options = {}, timeoutMs = 12000, sources, validateText) {
    const plan = buildFetchPlan(url, sources);
    let lastErr = null;
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      try {
        if (isFetchDebugEnabled()) console.debug(`[fetch-text] try #${i + 1}/${plan.length} ${step.source}`, url);
        const r = await fetch(step.url, withTimeoutOpts(options, timeoutMs));
        if (!r.ok) {
          lastErr = new Error(`HTTP ${r.status}`);
          if (isFetchDebugEnabled()) console.debug(`[fetch-text] fail ${step.source} HTTP ${r.status}`, url);
          continue;
        }
        const t = await r.text();
        if (validateText && !validateText(t)) {
          lastErr = new Error("validateText");
          continue;
        }
        if (isFetchDebugEnabled()) console.info(`[fetch-text] ok ${step.source}`, url);
        return t;
      } catch (e) {
        lastErr = e;
        if (isFetchDebugEnabled()) console.debug(`[fetch-text] err ${step.source}`, url, e?.message || e);
      }
    }
    throw lastErr || new Error("Texto indisponível");
  }

  window.IS_LOCAL_DEV = IS_LOCAL_DEV;
  window.localProxyUrl = localProxyUrl;
  window.fetchViaLocalProxy = fetchViaLocalProxy;
  window.withTimeoutOpts = withTimeoutOpts;
  window.buildFetchPlan = buildFetchPlan;
  window.fetchFirstOk = fetchFirstOk;
  window.fetchJsonFirstOk = fetchJsonFirstOk;
  window.fetchTextFirstOk = fetchTextFirstOk;
  window.fetchWithCORS = fetchWithCORS;
  window.fetchStooqMulti = fetchStooqMulti;
})();

