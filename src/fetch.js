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

  function buildFetchPlan(url, sources = ["direct", "local", "allorigins", "jina", "corsproxy"]) {
    const src =
      Array.isArray(sources) && sources.length
        ? sources
        : ["direct", "local", "allorigins", "jina", "corsproxy"];
    const s = new Set(src);
    const out = [];
    const add = (source, u) => {
      if (u && !out.some((x) => x.url === u)) out.push({ source, url: u });
    };
    if (s.has("direct")) add("direct", url);
    if (s.has("local") && IS_LOCAL_DEV) add("localproxy", localProxyUrl(url));
    if (s.has("allorigins")) add("allorigins", `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
    if (s.has("jina")) add("jina", `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`);
    if (s.has("corsproxy")) {
      const enc = encodeURIComponent(url);
      add("corsproxy", `https://corsproxy.io/?${enc}`);
      add("corsproxy", `https://corsproxy.io/?url=${enc}`);
    }
    return out;
  }

  function withTimeoutOpts(options = {}, timeoutMs = 12000) {
    const hasSignal = !!options.signal;
    return { ...options, signal: hasSignal ? options.signal : AbortSignal.timeout(timeoutMs) };
  }

  async function fetchFirstOk(url, options = {}, timeoutMs = 12000, sources, validate) {
    const plan = buildFetchPlan(url, sources);
    let lastErr = null;
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      try {
        if (isFetchDebugEnabled()) console.debug(`[fetch] try #${i + 1}/${plan.length} ${step.source}`, url);
        const r = await fetch(step.url, withTimeoutOpts(options, timeoutMs));
        if (!r.ok) {
          lastErr = new Error(`HTTP ${r.status}`);
          if (isFetchDebugEnabled()) console.debug(`[fetch] fail ${step.source} HTTP ${r.status}`, url);
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
    throw lastErr || new Error("Fetch indisponível");
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
})();

