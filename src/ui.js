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

  function getCacheMeta(k) {
    try {
      const pfx = window.PFX || "dash_v15_";
      const raw = localStorage.getItem(pfx + k);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const ts = Number(parsed?.ts);
      if (!Number.isFinite(ts)) return null;
      const ttl = window.getTTL ? window.getTTL(k) : 0;
      const age = Date.now() - ts;
      return { ts, ttl, age, expired: ttl ? age >= ttl : false };
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
  }

  function refreshCardStatusFromCache(cardId, cacheKey) {
    const current = ensureCardStatusEl(cardId);
    if (current?.dataset?.state === "error") return;

    const meta = cacheKey ? getCacheMeta(cacheKey) : null;
    if (!meta) {
      setCardStatus(cardId, "idle", "—", { title: "Ainda sem dados em cache", force: true });
      return;
    }
    const ageLbl = fmtAgeShort(meta.age);
    const t = new Date(meta.ts);
    const title = `Atualizado há ${ageLbl} · ${t.toLocaleString("pt-PT")}`;
    if (meta.expired) setCardStatus(cardId, "stale", `Stale · há ${ageLbl}`, { title, force: true });
    else setCardStatus(cardId, "cache", `Cache · há ${ageLbl}`, { title, force: true });
  }

  function getWeatherCacheKey() {
    const id = (typeof CFG !== "undefined" && CFG?.IPMA_CITY_ID) ? CFG.IPMA_CITY_ID : 1060300;
    return `ipma_${id}`;
  }

  function getAirQualityCacheKey() {
    const id = (typeof CFG !== "undefined" && CFG?.IPMA_CITY_ID) ? CFG.IPMA_CITY_ID : 1060300;
    return `aq_v3_${id}`;
  }

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
    };

    Object.entries(byId).forEach(([cardId, cacheKey]) => refreshCardStatusFromCache(cardId, cacheKey));
    enhanceRefreshButtonLabels();

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

