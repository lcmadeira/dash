/* dash fetch/proxy helpers (loaded before index.html inline script) */
(function () {
  const IS_LOCAL_DEV =
    location.protocol === "file:" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

  /**
   * Constrói a URL do proxy local, incluindo o porto configurado em modo file://.
   * @param {string} url URL de destino.
   * @returns {string} URL local que encaminha o pedido.
   */
  function localProxyUrl(url) {
    const enc = encodeURIComponent(url);
    if (location.protocol === "file:") {
      const port = Number(window.CFG?.LOCAL_PROXY_PORT || 8000);
      return `http://localhost:${port}/proxy?url=${enc}`;
    }
    return `/proxy?url=${enc}`;
  }

  /** Envia um pedido diretamente ao proxy de desenvolvimento, com timeout de 12 segundos.
   * @param {string} url URL de destino.
   * @param {RequestInit} [options] Opções Fetch adicionais.
   * @returns {Promise<Response>} Resposta do proxy.
   */
  async function fetchViaLocalProxy(url, options = {}) {
    return fetch(localProxyUrl(url), withTimeoutOpts(options, 12000));
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

  /** Devolve uma rota do gateway opcional, sem aceitar URLs arbitrários. */
  function dataApiUrl(path) {
    const base = String(window.CFG?.DATA_API_BASE || "").trim();
    const route = String(path || "").replace(/^\/+/, "");
    if (!base || !/^v1\/[a-z-]+$/.test(route)) return null;
    try {
      const parsed = new URL(base);
      if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
      if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) return null;
      return `${base.replace(/\/+$/, "")}/${route}`;
    } catch {
      return null;
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

  /**
   * Cria a lista ordenada de tentativas diretas e proxies para um URL.
   * @param {string} url URL original.
   * @param {string[]} [sources] Fontes permitidas; por omissão usa a cadeia padrão.
   * @returns {{source: string, url: string}[]} Tentativas sem URLs duplicados.
   */
  function buildFetchPlan(url, sources) {
    const isCorsHost = (u) => {
      const h = new URL(u).hostname.toLowerCase();
      return h.includes("stooq") || h.includes("news.google.com") || h.includes("apambiente") || h.includes("ecb.europa.eu") ||
             h.includes("eurostat") || h.includes("opensky-network") || h.includes("aishub") ||
             h.includes("ren.pt") || h.includes("usgs.gov") || h.includes("ine.pt") ||
             h.endsWith("finance.yahoo.com");
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

  function isDefinitiveHttpError(status) {
    return status === 400 || status === 404;
  }

  /** Acrescenta um AbortSignal com timeout, mantendo o signal fornecido pelo chamador.
   * @param {RequestInit} [options] Opções Fetch originais.
   * @param {number} [timeoutMs=12000] Limite em milissegundos.
   * @returns {RequestInit} Opções com signal.
   */
  function withTimeoutOpts(options = {}, timeoutMs = 12000) {
    const hasSignal = !!options.signal;
    return { ...options, signal: hasSignal ? options.signal : AbortSignal.timeout(timeoutMs) };
  }

  function throwIfCallerAborted(signal) {
    if (!signal?.aborted) return;
    if (signal.reason !== undefined) throw signal.reason;
    const error = new Error("Pedido cancelado pelo chamador");
    error.name = "AbortError";
    throw error;
  }

  /* Backoff partilhado por proxy e persistido durante a sessão da tab. */
  const proxyCoolDown = new Map();
  const proxyInFlight = new Map();
  function isProxyCoolingDown(source) {
    let until = proxyCoolDown.get(source) || 0;
    try {
      const saved = Number(sessionStorage.getItem(`dash_proxy_cooldown_${source}`));
      if (Number.isFinite(saved)) until = Math.max(until, saved);
    } catch {}
    return Date.now() < until;
  }
  function coolDownProxy(source, status = 0) {
    if (source === "direct" || source === "localproxy") return;
    const duration = status === 401 || status === 403 ? 30 * 60 * 1000
      : status === 429 ? 5 * 60 * 1000
      : status === 408 || status >= 500 ? 60 * 1000
      : 60 * 1000;
    const until = Date.now() + duration;
    proxyCoolDown.set(source, until);
    try { sessionStorage.setItem(`dash_proxy_cooldown_${source}`, String(until)); } catch {}
  }
  function recordProxyHttpFailure(source, status) {
    if ([401, 403, 408, 429].includes(status) || status >= 500) coolDownProxy(source, status);
  }
  function recordProxyNetworkFailure(source) {
    if (source !== "direct" && source !== "localproxy") coolDownProxy(source);
  }

  async function acquireProxySlot(source) {
    if (source === "direct" || source === "localproxy") return () => {};
    let state = proxyInFlight.get(source);
    if (!state) {
      state = { active: 0, waiting: [] };
      proxyInFlight.set(source, state);
    }
    if (state.active >= 2) await new Promise(resolve => state.waiting.push(resolve));
    else state.active++;
    return () => {
      const next = state.waiting.shift();
      if (next) next();
      else state.active--;
    };
  }

  async function fetchStep(step, options, timeoutMs) {
    const release = await acquireProxySlot(step.source);
    try {
      /* Outro pedido pode ter aberto o cooldown enquanto este aguardava vaga. */
      if (isProxyCoolingDown(step.source)) return null;
      const response = await fetch(step.url, withTimeoutOpts(options, timeoutMs));
      if (!response.ok) recordProxyHttpFailure(step.source, response.status);
      return response;
    } catch (error) {
      if (!options.signal?.aborted) recordProxyNetworkFailure(step.source);
      throw error;
    } finally {
      release();
    }
  }

  /**
   * Tenta cada fonte até obter resposta HTTP válida e aprovada pelo validador opcional.
   * @param {string} url URL original.
   * @param {RequestInit} [options] Opções Fetch.
   * @param {number} [timeoutMs=12000] Timeout por tentativa, em milissegundos.
   * @param {string[]} [sources] Fontes usadas para construir o plano.
   * @param {(response: Response) => boolean|Promise<boolean>} [validate] Validador da resposta.
   * @returns {Promise<{r: Response, usedUrl: string}>} Resposta e URL que funcionou.
   * @throws {Error} O último erro encontrado se todas as tentativas falharem.
   */
  async function fetchFirstOk(url, options = {}, timeoutMs = 12000, sources, validate) {
    const plan = buildFetchPlan(url, sources);
    let lastErr = null;

    for (let i = 0; i < plan.length; i++) {
      throwIfCallerAborted(options.signal);
      const step = plan[i];
      
      /* Saltar se estiver em cooldown */
      if (isProxyCoolingDown(step.source)) {
        continue;
      }

      try {
        if (isFetchDebugEnabled()) console.debug(`[fetch] try #${i + 1}/${plan.length} ${step.source}`, url);
        const r = await fetchStep(step, options, timeoutMs);
        if (!r) continue;
        
        if (r.status === 429) {
          if (isFetchDebugEnabled()) console.warn(`[fetch] 429 rate limit on ${step.source}, cooling down...`);
          continue;
        }

        if (!r.ok) {
          lastErr = new Error(`HTTP ${r.status}`);
          if ((step.source === "direct" || step.source === "localproxy") && isDefinitiveHttpError(r.status)) break;
          continue;
        }
        
        if (validate && !(await validate(r))) {
          lastErr = new Error("validate");
          continue;
        }
        
        if (isFetchDebugEnabled()) console.info(`[fetch] ok ${step.source}`, url);
        return { r, usedUrl: step.url };
      } catch (e) {
        if (options.signal?.aborted) throw options.signal.reason || e;
        lastErr = e;
        if (isFetchDebugEnabled()) console.debug(`[fetch] err ${step.source}`, url, e?.message || e);
      }
    }
    throw lastErr || new Error("Fetch indisponível (todos os proxies falharam)");
  }

  /** Devolve a primeira resposta válida usando a cadeia padrão de fontes CORS.
   * @param {string} url URL original.
   * @param {RequestInit} [options] Opções Fetch.
   * @param {number} [timeoutMs=12000] Timeout por tentativa, em milissegundos.
   * @returns {Promise<Response>} Resposta válida.
   * @throws {Error} Propaga o cancelamento do chamador sem tentar os proxies restantes.
   */
  async function fetchWithCORS(url, options = {}, timeoutMs = 12000) {
    const { r } = await fetchFirstOk(url, options, timeoutMs);
    return r;
  }

  /**
   * Obtém cotações CSV da Stooq num único pedido para vários símbolos.
   * @param {string[]} symbols Símbolos reconhecidos pela Stooq.
   * @returns {Promise<Record<string, {price: number, prev: number, hi: number, lo: number, vol: number, chg: number, live: boolean, src: string}>>} Cotações indexadas por símbolo minúsculo; objeto vazio em caso de falha.
   */
  async function fetchStooqMulti(symbols) {
    if (!Array.isArray(symbols) || !symbols.length) return {};
    const symStr = symbols.map(s => encodeURIComponent(s)).join("+");
    const url = `https://stooq.com/q/l/?s=${symStr}&f=sd2t2ohlcv&h&e=csv&_=${Date.now()}`;

    try {
      const { r } = await fetchFirstOk(
        url,
        { cache: "no-store" },
        10000,
        ["local", "allorigins", "corsproxy", "codetabs"],
        async (res) => {
          const text = await res.clone().text();
          return text.includes("Symbol,Date,Time") && !text.includes("<!DOCTYPE html>");
        },
      );
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
      if (isFetchDebugEnabled()) console.warn("[fetchStooqMulti] failed", e);
      return {};
    }
  }

  /**
   * Percorre as fontes configuradas e devolve o primeiro corpo JSON válido.
   * @param {string} url URL original.
   * @param {RequestInit} [options] Opções Fetch.
   * @param {number} [timeoutMs=12000] Timeout por tentativa, em milissegundos.
   * @param {string[]} [sources] Fontes usadas para construir o plano.
   * @param {(value: *) => boolean} [validateJson] Validador do objeto descodificado.
   * @returns {Promise<*>} Primeiro JSON aceite.
   * @throws {Error} O último erro encontrado se todas as tentativas falharem.
   */
  async function fetchJsonFirstOk(url, options = {}, timeoutMs = 12000, sources, validateJson) {
    const plan = buildFetchPlan(url, sources);
    let lastErr = null;
    for (let i = 0; i < plan.length; i++) {
      throwIfCallerAborted(options.signal);
      const step = plan[i];
      if (isProxyCoolingDown(step.source)) {
        if (isFetchDebugEnabled()) console.debug(`[fetch-json] skip ${step.source} (cooldown)`, url);
        continue;
      }
      try {
        if (isFetchDebugEnabled()) console.debug(`[fetch-json] try #${i + 1}/${plan.length} ${step.source}`, url);
        const r = await fetchStep(step, options, timeoutMs);
        if (!r) continue;
        if (r.status === 429) {
          if (isFetchDebugEnabled()) console.warn(`[fetch-json] 429 rate limit on ${step.source}, cooling down...`);
          continue;
        }
        if (!r.ok) {
          lastErr = new Error(`HTTP ${r.status}`);
          if (isFetchDebugEnabled()) console.debug(`[fetch-json] fail ${step.source} HTTP ${r.status}`, url);
          if ((step.source === "direct" || step.source === "localproxy") && isDefinitiveHttpError(r.status)) break;
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
        if (options.signal?.aborted) throw options.signal.reason || e;
        lastErr = e;
        if (isFetchDebugEnabled()) console.debug(`[fetch-json] err ${step.source}`, url, e?.message || e);
      }
    }
    throw lastErr || new Error("JSON indisponível");
  }

  /**
   * Percorre as fontes configuradas e devolve o primeiro corpo textual válido.
   * @param {string} url URL original.
   * @param {RequestInit} [options] Opções Fetch.
   * @param {number} [timeoutMs=12000] Timeout por tentativa, em milissegundos.
   * @param {string[]} [sources] Fontes usadas para construir o plano.
   * @param {(value: string) => boolean} [validateText] Validador do texto recebido.
   * @returns {Promise<string>} Primeiro texto aceite.
   * @throws {Error} O último erro encontrado se todas as tentativas falharem.
   */
  async function fetchTextFirstOk(url, options = {}, timeoutMs = 12000, sources, validateText) {
    const plan = buildFetchPlan(url, sources);
    let lastErr = null;
    for (let i = 0; i < plan.length; i++) {
      throwIfCallerAborted(options.signal);
      const step = plan[i];
      if (isProxyCoolingDown(step.source)) {
        if (isFetchDebugEnabled()) console.debug(`[fetch-text] skip ${step.source} (cooldown)`, url);
        continue;
      }
      try {
        if (isFetchDebugEnabled()) console.debug(`[fetch-text] try #${i + 1}/${plan.length} ${step.source}`, url);
        const r = await fetchStep(step, options, timeoutMs);
        if (!r) continue;
        if (r.status === 429) {
          if (isFetchDebugEnabled()) console.warn(`[fetch-text] 429 rate limit on ${step.source}, cooling down...`);
          continue;
        }
        if (!r.ok) {
          lastErr = new Error(`HTTP ${r.status}`);
          if (isFetchDebugEnabled()) console.debug(`[fetch-text] fail ${step.source} HTTP ${r.status}`, url);
          if ((step.source === "direct" || step.source === "localproxy") && isDefinitiveHttpError(r.status)) break;
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
        if (options.signal?.aborted) throw options.signal.reason || e;
        lastErr = e;
        if (isFetchDebugEnabled()) console.debug(`[fetch-text] err ${step.source}`, url, e?.message || e);
      }
    }
    throw lastErr || new Error("Texto indisponível");
  }

  window.IS_LOCAL_DEV = IS_LOCAL_DEV;
  window.localProxyUrl = localProxyUrl;
  window.fetchViaLocalProxy = fetchViaLocalProxy;
  window.dataApiUrl = dataApiUrl;
  window.withTimeoutOpts = withTimeoutOpts;
  window.buildFetchPlan = buildFetchPlan;
  window.fetchFirstOk = fetchFirstOk;
  window.fetchJsonFirstOk = fetchJsonFirstOk;
  window.fetchTextFirstOk = fetchTextFirstOk;
  window.fetchWithCORS = fetchWithCORS;
  window.fetchStooqMulti = fetchStooqMulti;
})();
