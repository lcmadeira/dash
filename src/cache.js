/* dash cache helpers (loaded before index.html inline script) */
(function () {
  const CACHE_TTL = 15 * 60 * 1000; // Fallback padrão: 15min
  const PFX = "dash_v15_";

  const CACHE_TTL_MAP = {
    weather: 15 * 60 * 1000, // 15 min
    ipma: 15 * 60 * 1000,
    aq_: 30 * 60 * 1000, // 30 min (air quality)
    rss: 10 * 60 * 1000, // 10 min (notícias)
    news: 10 * 60 * 1000,
    finance: 5 * 60 * 1000, // 5 min (bolsa)
    psi: 5 * 60 * 1000,
    crypto: 2 * 60 * 1000, // 2 min (cripto)
    btc: 2 * 60 * 1000,
    fx: 5 * 60 * 1000, // 5 min (câmbios)
    euribor: 24 * 60 * 60 * 1000, // 24h (taxas)
    fuel_es: 12 * 60 * 60 * 1000, // 12h (combustíveis ES)
    fuel: 24 * 60 * 60 * 1000, // 24h (combustíveis)
    co2: 60 * 60 * 1000, // 1h (emissões)
    hist: 6 * 60 * 60 * 1000, // 6h (históricos / séries)
    static: 7 * 24 * 60 * 60 * 1000, // 7 dias (dados estáticos)
  };

  function getTTL(key) {
    const lower = String(key || "").toLowerCase();
    for (const [prefix, ttl] of Object.entries(CACHE_TTL_MAP)) {
      if (lower.includes(prefix)) return ttl;
    }
    return CACHE_TTL;
  }

  function getStaleCache(key) {
    try {
      const raw = localStorage.getItem(PFX + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.d) return parsed;
    } catch {}
    return null;
  }

  function cleanOldCacheSync() {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    let removed = 0;

    keys.forEach((key) => {
      if (!key.startsWith(PFX)) return;
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data && data.ts) {
          const ttl = getTTL(key);
          if (now - data.ts > ttl) {
            localStorage.removeItem(key);
            removed++;
          }
        }
      } catch {
        localStorage.removeItem(key);
        removed++;
      }
    });

    if (removed > 0) console.log(`🧹 ${removed} itens de cache removidos`);
  }

  function lsGet(k) {
    try {
      const raw = localStorage.getItem(PFX + k);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const ts = Number(parsed?.ts);
      const d = parsed?.d;
      if (!Number.isFinite(ts)) return null;
      const age = Date.now() - ts;
      const ttl = getTTL(k);
      if (age >= ttl) return null;
      return d;
    } catch {
      return null;
    }
  }

  function lsSet(k, d) {
    const payload = JSON.stringify({ d, ts: Date.now() });
    try {
      localStorage.setItem(PFX + k, payload);
      return true;
    } catch {
      console.warn("LocalStorage cheio, limpando cache antigo...");
      try {
        cleanOldCacheSync();
        localStorage.setItem(PFX + k, payload);
        return true;
      } catch {
        console.error("Não foi possível salvar no cache");
        return false;
      }
    }
  }

  // Expor globals para o script inline actual (sem build step).
  window.CACHE_TTL = CACHE_TTL;
  window.PFX = PFX;
  window.CACHE_TTL_MAP = CACHE_TTL_MAP;
  window.getTTL = getTTL;
  window.getStaleCache = getStaleCache;
  window.cleanOldCacheSync = cleanOldCacheSync;
  window.lsGet = lsGet;
  window.lsSet = lsSet;
})();

