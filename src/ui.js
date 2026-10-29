/* dash UI/status helpers (loaded before index.html inline script) */
(function () {
  const CARD_LABELS = {
    weather: "Meteorologia",
    fuel: "Combustíveis",
    cabaz: "Cabaz alimentar",
    "gas-eu": "Gás natural Europa",
    "gas-pt": "Gás natural Portugal",
    elec: "Eletricidade",
    airquality: "Qualidade do ar",
    euribor: "Euribor",
    imob: "Imobiliário",
    fng: "Fear & Greed",
    rec: "Curva de rendimentos",
    agri: "Agro commodities",
    air: "Tráfego aéreo",
    seis: "Sismos",
    ormuz: "Estreito de Ormuz",
    smn: "Mobilidade",
    transp: "Transportes",
    psi20: "PSI20",
    fx: "Câmbio",
    crypto: "Criptomoedas",
    inf: "Inflação",
    mstats: "Market stats",
    cal: "Calendário",
    geo: "Geopolítica",
    co2: "Emissões CO2",
    press: "Liberdade de imprensa",
    "news-pt": "Notícias Portugal",
    "news-world": "Notícias mundo",
  };
  function fmtAgeShort(ms) {
    if (!Number.isFinite(ms) || ms < 0) return "—";
    const s = Math.floor(ms / 1000);
    if (s < 20) return "agora";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 48) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  }

  function getSourceTimestamp(key, data) {
    let candidates = [];
    if (String(key).startsWith("ipma_") && typeof data?.dataUpdate === "string") {
      candidates = [data.dataUpdate];
    } else if (key === "fuel" && Array.isArray(data)) {
      candidates = data.map((item) => item?.updated_at).filter((value) => typeof value === "string");
    }
    const timestamps = candidates.map((value) => Date.parse(value)).filter((ts) =>
      Number.isFinite(ts) && ts >= 0 && ts <= Date.now(),
    );
    return timestamps.length ? Math.max(...timestamps) : null;
  }

  function getCacheMeta(k) {
    try {
      const pfx = window.PFX || "dash_v15_";
      const raw = localStorage.getItem(pfx + k);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const ts = Number(parsed?.ts);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)
        || !Object.prototype.hasOwnProperty.call(parsed, "d")
        || !Number.isFinite(ts) || ts < 0 || ts > Date.now()) return null;
      const ttl = window.getTTL ? window.getTTL(k) : 0;
      const age = Date.now() - ts;
      const dataMeta = window.normalizeCacheMeta ? window.normalizeCacheMeta(parsed.meta) : null;
      const sourceTs = dataMeta?.observedAt || getSourceTimestamp(k, parsed.d);
      return { ts, ttl, age, expired: ttl ? age >= ttl : false, sourceTs, dataMeta };
    } catch {
      return null;
    }
  }

  function getCardElById(cardId) {
    return document.querySelector(`[data-card-id="${cardId}"]`);
  }

  function ensureCardStatusEl(cardId) {
    const card = getCardElById(cardId);
    if (!card) return null;
    const ch = card.querySelector(".ch");
    if (!ch) return null;
    let right = ch.querySelector(".ch-r");
    if (!right) {
      right = document.createElement("div");
      right.className = "ch-r";
      ch.appendChild(right);
    }
    let el = right.querySelector(`.card-status[data-status-for="${cardId}"]`);
    if (el) return el;

    el = document.createElement("span");
    el.className = "badge card-status";
    el.dataset.statusFor = cardId;
    el.dataset.state = "idle";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-atomic", "true");
    el.textContent = "—";
    right.prepend(el);
    return el;
  }

  function getCardRefreshBtn(cardId) {
    const card = getCardElById(cardId);
    if (!card) return null;
    return card.querySelector('.ch .ch-r button[aria-label="Atualizar"], .ch .ch-r button[aria-label^="Atualizar "], .ch .ch-r button[title="Atualizar"]');
  }

  function setInlineRetryButton(cardId, show) {
    const card = getCardElById(cardId);
    if (!card) return;
    const right = card.querySelector(".ch .ch-r");
    if (!right) return;

    let btn = right.querySelector(`.card-inline-retry[data-retry-for="${cardId}"]`);
    if (!show) {
      if (btn) btn.remove();
      return;
    }

    if (btn) return;
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rbtn card-inline-retry";
    btn.dataset.retryFor = cardId;
    btn.textContent = "Tentar novamente";
    btn.title = "Voltar a tentar atualizar este card";
    btn.setAttribute("aria-label", "Tentar novamente atualizar este card");
    btn.onclick = () => {
      const refreshBtn = getCardRefreshBtn(cardId);
      if (refreshBtn) refreshBtn.click();
      else console.warn(`Sem botão de refresh para ${cardId}`);
    };
    right.appendChild(btn);
  }

  function getStatusAssistiveText(cardId, state, text) {
    const label = CARD_LABELS[cardId] || cardId || "card";
    const visible = text || "sem estado";
    if (state === "error") return `Erro ao atualizar dados do card ${label}. ${visible}.`;
    if (state === "loading") return `A atualizar dados do card ${label}.`;
    if (state === "stale") return `Dados desatualizados no card ${label}. ${visible}.`;
    if (state === "cache") return `Dados em cache no card ${label}. ${visible}.`;
    if (state === "live") return `Dados live no card ${label}.`;
    if (state === "static") return `Dados estáticos no card ${label}.`;
    return `Estado do card ${label}: ${visible}.`;
  }

  function enhanceRefreshButtonLabels() {
    document.querySelectorAll('[data-card-id]').forEach((card) => {
      const cardId = card.getAttribute("data-card-id");
      const label = CARD_LABELS[cardId] || cardId || "card";
      const refreshBtn = card.querySelector('.ch .ch-r button[aria-label="Atualizar"], .ch .ch-r button[title="Atualizar"]');
      if (!refreshBtn) return;
      refreshBtn.setAttribute("aria-label", `Atualizar ${label}`);
      refreshBtn.removeAttribute("title");
    });
  }

  /**
   * Atualiza o estado visível e acessível de um card e gere a ação de nova tentativa.
   * @param {string} cardId Identificador do card no atributo data-card-id.
   * @param {"idle"|"loading"|"error"|"stale"|"cache"|"live"|"static"} state Estado apresentado.
   * @param {string} text Texto curto mostrado no badge.
   * @param {{title?: string, force?: boolean}} [meta] Texto auxiliar e opção para substituir um estado loading.
   */
  function setCardStatus(cardId, state, text, meta = {}) {
    const el = ensureCardStatusEl(cardId);
    if (!el) return;
    if (el.dataset.state === "loading" && state !== "loading" && !meta.force) return;
    el.dataset.state = state || "idle";
    const visibleText = text || "—";
    el.textContent = visibleText;
    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = ` ${getStatusAssistiveText(cardId, state || "idle", visibleText)}`;
    el.appendChild(sr);
    el.setAttribute("aria-label", getStatusAssistiveText(cardId, state || "idle", visibleText));
    if (meta?.title) el.title = meta.title;
    setInlineRetryButton(cardId, state === "error");
    updateDataOverview();
  }

  function updateDataOverview() {
    const panel = document.getElementById("dataOverview");
    if (!panel) return;
    const counts = { live: 0, cache: 0, stale: 0, static: 0, error: 0, loading: 0, idle: 0 };
    const issues = [];
    document.querySelectorAll(".card-status[data-status-for]").forEach((el) => {
      const state = Object.prototype.hasOwnProperty.call(counts, el.dataset.state) ? el.dataset.state : "idle";
      counts[state]++;
      if (["error", "stale", "static"].includes(state)) {
        const tooltip = el.title || "";
        const source = /Fonte: (.+?)(?= · Observado:| · Idade baseada|$)/.exec(tooltip)?.[1]
          || /^(.+?) · referência de /.exec(tooltip)?.[1] || "";
        const observed = /Observado: ([^·]+)/.exec(tooltip)?.[1]?.trim()
          || /referência de ([^·]+)/.exec(tooltip)?.[1]?.trim() || "";
        const detail = [source ? "Fonte: " + source : "", observed ? "Observado: " + observed : ""].filter(Boolean).join(" · ");
        issues.push({ id: el.dataset.statusFor, label: CARD_LABELS[el.dataset.statusFor] || el.dataset.statusFor, state, text: el.childNodes[0]?.textContent?.trim() || state, detail, tooltip });
      }
    });
    const available = counts.live + counts.cache;
    const attention = counts.error + counts.stale + counts.static;
    const setCount = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value); };
    setCount("dataCountAvailable", available);
    setCount("dataCountAttention", attention);
    setCount("dataCountLoading", counts.loading + counts.idle);
    const items = document.getElementById("dataOverviewItems");
    if (!items) return;
    const visibleIssues = issues.slice(0, 5);
    items.innerHTML = visibleIssues.length
      ? visibleIssues.map((item) => {
        const statusText = item.state === "error" ? "erro" : item.state === "stale" ? "desatualizado/parcial" : "referência";
        const detail = item.detail ? `<small>${escapeHTML(item.detail)}</small>` : "";
        return `<button type="button" class="data-overview-item" data-summary-target="${escapeAttribute(item.id)}" data-state="${item.state}" title="${escapeAttribute(item.tooltip || item.text)}" aria-label="${escapeAttribute(item.label + ", " + statusText + (item.detail ? ", " + item.detail : ""))}"><span>${escapeHTML(item.label)} · ${statusText}</span>${detail}</button>`;
      }).join("") + (issues.length > visibleIssues.length ? `<span>+${issues.length - visibleIssues.length} outros</span>` : "")
      : (available ? "Sem alertas de atualidade nos cards monitorizados." : "A recolher estado dos cards…");
    if (!items.dataset.bound) {
      items.addEventListener("click", (event) => {
        const button = event.target.closest("[data-summary-target]");
        if (!button) return;
        const card = getCardElById(button.dataset.summaryTarget);
        card?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      items.dataset.bound = "true";
    }
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  function escapeAttribute(value) { return escapeHTML(value).replace(/`/g, "&#96;"); }

  /** Deriva o badge do card a partir da idade e do TTL da entrada de cache.
   * @param {string} cardId Identificador do card.
   * @param {string} cacheKey Chave lógica de cache.
   */
  function refreshCardStatusFromCache(cardId, cacheKey) {
    const current = ensureCardStatusEl(cardId);
    if (current?.dataset?.state === "error") return;

    const meta = cacheKey ? getCacheMeta(cacheKey) : null;
    if (!meta) {
      const reference = window.STATIC_REFERENCE_POLICY?.[cardId];
      if (reference) {
        const freshness = window.getReferenceFreshness?.(reference.observedAt, reference.maxAgeDays);
        const referenceDate = new Date(`${reference.observedAt}T12:00:00Z`).toLocaleDateString("pt-PT");
        const state = freshness?.stale || !freshness ? "stale" : "static";
        const label = state === "stale"
          ? `Referência antiga · há ${freshness ? fmtAgeShort(freshness.age) : "data inválida"}`
          : `Referência · ${reference.source}`;
        setCardStatus(cardId, state, label, {
          title: `${reference.source} · referência de ${referenceDate} · limite ${reference.maxAgeDays} dias`,
          force: true,
        });
        return;
      }
      setCardStatus(cardId, "idle", "—", { title: "Ainda sem dados em cache", force: true });
      return;
    }
    const ageLbl = fmtAgeShort(meta.age);
    const t = new Date(meta.ts);
    const sourceTs = meta.sourceTs ? new Date(meta.sourceTs) : null;
    const sourceInfo = sourceTs
      ? ` · Fonte: ${sourceTs.toLocaleString("pt-PT")} (há ${fmtAgeShort(Date.now() - meta.sourceTs)})`
      : " · Idade baseada na gravação local; a fonte não forneceu timestamp reconhecível";
    const dataMeta = meta.dataMeta;
    const observationFreshness = window.getObservationFreshness?.(cacheKey, meta.sourceTs);
    const provider = dataMeta?.source ? ` · Fonte: ${dataMeta.source}` : "";
    const reason = dataMeta?.reason ? ` · ${dataMeta.reason}` : "";
    const observed = meta.sourceTs
      ? ` · Observado: ${new Date(meta.sourceTs).toLocaleString("pt-PT")} (há ${fmtAgeShort(Date.now() - meta.sourceTs)})`
      : "";
    const title = `Cache local gravada há ${ageLbl} · ${t.toLocaleString("pt-PT")}${provider}${observed}${sourceInfo}${reason}`;
    if (dataMeta?.state === "static" || dataMeta?.state === "fallback") {
      setCardStatus(cardId, "static", `Referência${provider}`, { title, force: true });
    } else if (dataMeta?.state === "stale") {
      setCardStatus(cardId, "stale", `Gateway · há ${ageLbl}`, { title, force: true });
    } else if (dataMeta?.state === "partial") {
      setCardStatus(cardId, "stale", `Parcial · há ${ageLbl}`, { title, force: true });
    } else if (observationFreshness?.stale) {
      setCardStatus(cardId, "stale", `Fonte antiga · há ${fmtAgeShort(observationFreshness.age)}`, { title, force: true });
    } else if (meta.expired) setCardStatus(cardId, "stale", `Stale · há ${ageLbl}`, { title, force: true });
    else setCardStatus(cardId, "cache", `Cache${provider} · há ${ageLbl}`, { title, force: true });
  }

  function getWeatherCacheKey() {
    const id = (typeof CFG !== "undefined" && CFG?.IPMA_CITY_ID) ? CFG.IPMA_CITY_ID : 1060300;
    return `ipma_${id}`;
  }

  function getAirQualityCacheKey() {
    const id = (typeof CFG !== "undefined" && CFG?.IPMA_CITY_ID) ? CFG.IPMA_CITY_ID : 1060300;
    return `aq_v3_${id}`;
  }

  /**
   * Executa a atualização manual de um card e sincroniza botão, erros e badge de estado.
   * @param {string} cardId Identificador do card.
   * @param {string|(() => string)} cacheKeyOrFn Chave de cache ou função que a resolve antes/depois da atualização.
   * @param {HTMLElement|null} btn Botão cuja apresentação de loading será controlada.
   * @param {(...args: *) => (void|Promise<void>)} fn Função de atualização do card.
   * @param {...*} args Argumentos entregues à função de atualização.
   * @returns {Promise<void>}
   */
  async function refreshCard(cardId, cacheKeyOrFn, btn, fn, ...args) {
    const getKey = () => (typeof cacheKeyOrFn === "function" ? cacheKeyOrFn() : cacheKeyOrFn);
    const keyBefore = getKey();

    if (btn && btn.classList && btn.classList.contains("loading")) return;
    if (btn && btn.classList) {
      btn.classList.add("loading");
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
    }

    setCardStatus(cardId, "loading", "A atualizar…", { title: "A atualizar…" });

    let threw = false;
    try {
      await Promise.resolve(fn(...args));
    } catch (e) {
      threw = true;
      setCardStatus(cardId, "error", "Erro", { title: e?.message ? e.message : "Erro ao atualizar" });
      if (typeof window.notifyNonCriticalError === "function") {
        window.notifyNonCriticalError(`Atualização do card '${cardId}'`, e);
      }
      console.warn(`Refresh falhou (${cardId})`, e);
    } finally {
      if (btn && btn.classList) {
        btn.classList.remove("loading");
        btn.disabled = false;
        btn.removeAttribute("aria-disabled");
      }

      const keyAfter = getKey() || keyBefore;
      if (threw) return;

      if (keyAfter) refreshCardStatusFromCache(cardId, keyAfter);
      else {
        setCardStatus(cardId, "idle", "—", { force: true });
        refreshAllCardStatuses();
      }
    }
  }

  function getCabazMeta() {
    try {
      if (typeof CABAZ_CK === "undefined") return null;
      let extra = [];
      const s = localStorage.getItem(CABAZ_CK);
      if (s) extra = JSON.parse(s) || [];
      const lastBase =
        (typeof CABAZ_HIST_BASE !== "undefined" && Array.isArray(CABAZ_HIST_BASE) && CABAZ_HIST_BASE.length)
          ? CABAZ_HIST_BASE[CABAZ_HIST_BASE.length - 1]?.[0]
          : null;
      const lastExtra = extra?.length
        ? extra.sort((a, b) => (a?.[0] > b?.[0] ? 1 : -1))[extra.length - 1]?.[0]
        : null;
      const last = lastExtra && lastBase ? (lastExtra > lastBase ? lastExtra : lastBase) : lastExtra || lastBase;
      if (!last) return null;
      const ts = new Date(`${last}T12:00:00`).getTime();
      if (!Number.isFinite(ts)) return null;
      const age = Date.now() - ts;
      return { ts, age, label: last };
    } catch {
      return null;
    }
  }

  function refreshAllCardStatuses() {
    try {
      const list =
        (typeof currentConfig !== "undefined" && Array.isArray(currentConfig?.cards))
          ? currentConfig.cards
          : ((typeof DEFAULT_CONFIG !== "undefined" && Array.isArray(DEFAULT_CONFIG?.cards)) ? DEFAULT_CONFIG.cards : []);
      list.forEach((c) => ensureCardStatusEl(c.id));
    } catch {}

    ["oil", "finance", "heatmap"].forEach((id) => setCardStatus(id, "live", "Live", { title: "Widget live" }));
    ["smn", "transp", "press"].forEach((id) =>
      setCardStatus(id, "static", "Estático", { title: "Dados estáticos (sem fetch)" }),
    );

    const cityId = (typeof CFG !== "undefined" && CFG?.IPMA_CITY_ID) ? CFG.IPMA_CITY_ID : 1060300;
    const byId = {
      weather: `ipma_${cityId}`,
      airquality: `aq_v3_${cityId}`,
      fuel: "fuel",
      dams: "dams_v1",
      "gas-eu": "ttf_live_v1",
      "gas-pt": "ttf_live_v1",
      elec: "elec_v3",
      euribor: "euribor_live_v1",
      imob: "imob_ine_v1",
      fng: "fng_v4",
      rec: "rec_v5",
      agri: "agri_v3",
      air: "air_v8",
      seis: "seis_v10",
      ormuz: "ormuz_v2",
      psi20: "psi20_v2",
      mstats: "mstats_v3",
      fx: "fx",
      crypto: "cg",
      geo: "geo_v10",
      "news-pt": "rss_pt",
      "news-world": "rss_world",
      co2: "co2_ren_v1",
      inf: "inflation_eurostat_v2",
    };

    Object.entries(byId).forEach(([cardId, cacheKey]) => refreshCardStatusFromCache(cardId, cacheKey));
    enhanceRefreshButtonLabels();
    window.renderPortugalBriefing?.();

    const cm = getCabazMeta();
    if (cm) {
      const ageLbl = fmtAgeShort(cm.age);
      const t = new Date(cm.ts);
      setCardStatus("cabaz", "static", `Manual · há ${ageLbl}`, {
        title: `Última entrada: ${cm.label} · ${t.toLocaleDateString("pt-PT")}`,
      });
    } else {
      setCardStatus("cabaz", "static", "Manual", { title: "Atualização manual" });
    }
  }

  function applyStickyScrollCards() {
    ["news-pt", "news-world", "geo"].forEach((id) => {
      const el = getCardElById(id);
      if (el) el.classList.add("sticky-scroll");
    });
  }

  window.fmtAgeShort = fmtAgeShort;
  window.getCacheMeta = getCacheMeta;
  window.getCardElById = getCardElById;
  window.ensureCardStatusEl = ensureCardStatusEl;
  window.setCardStatus = setCardStatus;
  window.refreshCardStatusFromCache = refreshCardStatusFromCache;
  window.getWeatherCacheKey = getWeatherCacheKey;
  window.getAirQualityCacheKey = getAirQualityCacheKey;
  window.refreshCard = refreshCard;
  window.getCabazMeta = getCabazMeta;
  window.refreshAllCardStatuses = refreshAllCardStatuses;
  window.applyStickyScrollCards = applyStickyScrollCards;
  window.enhanceRefreshButtonLabels = enhanceRefreshButtonLabels;
})();

