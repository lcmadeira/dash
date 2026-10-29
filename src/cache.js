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

  /* Limites de observação: separados do TTL local para detetar payloads antigos recém-consultados. */
  const LEGACY_OBSERVATION_MAX_AGE = {
    ipma: 36 * 60 * 60 * 1000,
    fuel: 72 * 60 * 60 * 1000,
    fuel_es: 72 * 60 * 60 * 1000,
    fx: 4 * 24 * 60 * 60 * 1000,
    euribor_live_v1: 75 * 24 * 60 * 60 * 1000,
    inflation_eurostat_v2: 120 * 24 * 60 * 60 * 1000,
  };

  /**
   * Devolve o tempo de vida configurado para uma chave de cache.
   * @param {string} key Chave lógica, sem o prefixo interno.
   * @returns {number} TTL em milissegundos.
   */
  function getTTL(key) {
    const lower = String(key || "").toLowerCase();
    for (const [prefix, ttl] of Object.entries(CACHE_TTL_MAP)) {
      if (lower.includes(prefix)) return ttl;
    }
    return CACHE_TTL;
  }

  /** Limite de idade da observação do fornecedor, distinto da idade de gravação local. */
  function getMaxObservationAge(key) {
    const id = String(key || "").toLowerCase();
    const contracts = Object.values(window.DATA_SOURCE_CONTRACTS || {});
    const contract = contracts.find(item => item.cacheKey === id || (item.keyPrefix && id.startsWith(item.keyPrefix)));
    if (contract) return contract.maxObservationAgeMs;
    if (id.startsWith("ipma_")) return LEGACY_OBSERVATION_MAX_AGE.ipma;
    return LEGACY_OBSERVATION_MAX_AGE[id] || null;
  }

  function getObservationFreshness(key, observedAt, now = Date.now()) {
    const maxAge = getMaxObservationAge(key);
    const timestamp = typeof observedAt === "number" ? observedAt : Date.parse(String(observedAt || ""));
    if (!maxAge || !Number.isFinite(timestamp) || timestamp <= 0 || timestamp > now) return null;
    const age = now - timestamp;
    return { age, maxAge, stale: age >= maxAge };
  }

  function getReferenceFreshness(observedAt, maxAgeDays, now = Date.now()) {
    const timestamp = typeof observedAt === "number" ? observedAt : Date.parse(String(observedAt || ""));
    const maxAge = Number(maxAgeDays) * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > now || !Number.isFinite(maxAge) || maxAge <= 0) return null;
    const age = now - timestamp;
    return { age, maxAge, stale: age >= maxAge };
  }

  /**
   * Valida o formato e o timestamp de um registo de cache.
   * @param {*} value Registo descodificado de localStorage.
   * @param {number} now Timestamp atual em milissegundos.
   * @returns {boolean} Indica se o envelope pode ser usado.
   */
  function isValidEnvelope(value, now = Date.now()) {
    const ts = typeof value?.ts === "number" ? value.ts
      : typeof value?.ts === "string" && value.ts.trim() ? Number(value.ts) : NaN;
    return !!value && typeof value === "object" && !Array.isArray(value)
      && Object.prototype.hasOwnProperty.call(value, "d")
      && Number.isFinite(ts) && ts >= 0 && ts <= now;
  }

  /** Normaliza a proveniência opcional guardada com cada resposta de fornecedor. */
  function normalizeCacheMeta(meta) {
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
    const allowedStates = new Set(["live", "partial", "stale", "static", "fallback"]);
    const state = allowedStates.has(meta.state) ? meta.state : null;
    const toTimestamp = (value) => {
      if (typeof value === "number" && Number.isFinite(value) && value > 0 && value <= Date.now()) return value;
      if (typeof value === "string") {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed) && parsed > 0 && parsed <= Date.now()) return parsed;
      }
      return null;
    };
    const normalized = {
      source: typeof meta.source === "string" ? meta.source.trim().slice(0, 120) : "",
      state,
      observedAt: toTimestamp(meta.observedAt),
      reason: typeof meta.reason === "string" ? meta.reason.trim().slice(0, 180) : "",
    };
    if (!normalized.source && !normalized.state && !normalized.observedAt && !normalized.reason) return null;
    return normalized;
  }

  /**
   * Lê o registo guardado sem aplicar o TTL, para permitir recuperação de dados antigos.
   * @param {string} key Chave lógica, sem o prefixo interno.
   * @returns {{d: *, ts: number}|null} Dados e timestamp, ou null se não existirem/forem inválidos.
   */
  function getStaleCache(key) {
    try {
      const raw = localStorage.getItem(PFX + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (isValidEnvelope(parsed)) return { ...parsed, meta: normalizeCacheMeta(parsed.meta) };
    } catch {}
    return null;
  }

  /** Remove sincronamente entradas expiradas ou inválidas do localStorage. */
  function cleanOldCacheSync() {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    let removed = 0;

    keys.forEach((key) => {
      if (!key.startsWith(PFX)) return;
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (!isValidEnvelope(data, now) || now - Number(data.ts) >= getTTL(key)) {
          localStorage.removeItem(key);
          removed++;
        }
      } catch {
        localStorage.removeItem(key);
        removed++;
      }
    });

    if (removed > 0) console.log(`🧹 ${removed} itens de cache removidos`);
  }

  /**
   * Lê dados do cache apenas quando a entrada ainda está dentro do TTL.
   * @param {string} k Chave lógica, sem o prefixo interno.
   * @returns {*} Dados guardados, ou null se ausentes, expirados ou inválidos.
   */
  function lsGet(k) {
    try {
      const raw = localStorage.getItem(PFX + k);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!isValidEnvelope(parsed)) return null;
      const age = Date.now() - Number(parsed.ts);
      const ttl = getTTL(k);
      if (age >= ttl) return null;
      return parsed.d;
    } catch {
      return null;
    }
  }

  /**
   * Guarda dados com timestamp e tenta limpar entradas antigas se o armazenamento estiver cheio.
   * @param {string} k Chave lógica, sem o prefixo interno.
   * @param {*} d Dados serializáveis a guardar.
   * @param {{source?: string, state?: "live"|"partial"|"stale"|"static"|"fallback", observedAt?: string|number, reason?: string}} [meta] Proveniência e estado da resposta.
   * @returns {boolean} Indica se a gravação foi concluída.
   */
  function lsSet(k, d, meta) {
    const envelope = { d, ts: Date.now() };
    const normalizedMeta = normalizeCacheMeta(meta);
    if (normalizedMeta) envelope.meta = normalizedMeta;
    const payload = JSON.stringify(envelope);
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
  window.getMaxObservationAge = getMaxObservationAge;
  window.getObservationFreshness = getObservationFreshness;
  window.getReferenceFreshness = getReferenceFreshness;
  window.getStaleCache = getStaleCache;
  window.normalizeCacheMeta = normalizeCacheMeta;
  window.cleanOldCacheSync = cleanOldCacheSync;
  window.lsGet = lsGet;
  window.lsSet = lsSet;
})();

