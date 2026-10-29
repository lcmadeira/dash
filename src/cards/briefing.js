/* Small, source-dated Portugal briefing. Only renders observations available in fresh local cache. */
(function () {
  const MAX_CABAZ_AGE_DAYS = 14;
  const MAX_WEATHER_AGE_HOURS = 36;
  const MAX_FUEL_AGE_HOURS = 72;
  const FUEL_ALERT_KEY = (window.PFX || "dash_v15_") + "fuel_alert_v1";
  const BRIEFING_PREF_KEY = (window.PFX || "dash_v15_") + "briefing_preferences_v1";
  const LAST_VISIT_KEY = (window.PFX || "dash_v15_") + "briefing_last_visit_v1";
  const BRIEFING_GROUPS = ["weather", "fuel", "basket", "inflation", "euribor"];
  let briefingPreferencesMemory = null;
  let currentFuelPrice = null;
  let currentFuelObserved = null;
  let lastVisitSnapshot = readVisitSnapshot();
  let currentVisitSnapshot = {};

  function readVisitSnapshot() {
    try {
      const value = JSON.parse(window.localStorage?.getItem(LAST_VISIT_KEY) || "null");
      return value && typeof value === "object" && value.observations && typeof value.observations === "object"
        ? value.observations : null;
    } catch { return null; }
  }

  function saveVisitSnapshot() {
    if (!Object.keys(currentVisitSnapshot).length) return;
    try { window.localStorage?.setItem(LAST_VISIT_KEY, JSON.stringify({ savedAt: Date.now(), observations: currentVisitSnapshot })); } catch {}
  }

  window.addEventListener?.("pagehide", saveVisitSnapshot);

  function renderPortugalBriefing(now = Date.now()) {
    const root = document.getElementById("briefingBody");
    if (!root) return;
    const observations = [];

    const cityId = Number(window.CFG?.IPMA_CITY_ID || 1060300);
    const weather = window.lsGet?.(`ipma_${cityId}`);
    const weatherCache = window.getCacheMeta?.(`ipma_${cityId}`);
    const weatherObserved = Date.parse(weather?.dataUpdate || "");
    const today = weather?.data?.[0];
    const forecastDate = String(today?.forecastDate || "");
    const tempMax = Number(today?.tMax);
    const rain = Number(today?.precipitaProb);
    if (weather && Number.isFinite(weatherObserved) && now >= weatherObserved && now - weatherObserved <= MAX_WEATHER_AGE_HOURS * 3600000 &&
        /^\d{4}-\d{2}-\d{2}$/.test(forecastDate) && Number.isFinite(tempMax)) {
      observations.push({
        group: "weather",
        title: "Meteorologia",
        value: `${Math.round(tempMax)}°C de máxima${Number.isFinite(rain) ? ` · ${Math.round(rain)}% de precipitação` : ""}`,
        detail: `${window.IPMA_CITIES?.[cityId] || "Portugal"} · previsão ${formatDate(forecastDate)} · IPMA atualizada ${formatDateTime(weatherObserved)}`,
        href: "#card-weather",
        snapshot: [Math.round(tempMax), Number.isFinite(rain) ? Math.round(rain) : null],
      });
    } else if (weatherCache?.age > MAX_WEATHER_AGE_HOURS * 3600000) {
      observations.push({ group: "weather", title: "Meteorologia", value: "Previsão desatualizada", detail: `Cache local há ${window.fmtAgeShort?.(weatherCache.age) || "mais de 36h"}`, href: "#card-weather", stale: true });
    }

    const fuel = window.lsGet?.("fuel");
    const fuelEs = window.lsGet?.("fuel_es");
    const fuelCache = window.getCacheMeta?.("fuel");
    const gas95 = Array.isArray(fuel) ? fuel.find(item => item?.fuel_slug === "gasoline_95") : null;
    const fuelObserved = Date.parse(gas95?.updated_at || "");
    const fuelPrice = Number(gas95?.avg_price_eur);
    currentFuelPrice = null;
    currentFuelObserved = null;
    if (gas95 && Number.isFinite(fuelObserved) && now >= fuelObserved && now - fuelObserved <= MAX_FUEL_AGE_HOURS * 3600000 && Number.isFinite(fuelPrice) && fuelPrice > 0) {
      currentFuelPrice = fuelPrice;
      currentFuelObserved = fuelObserved;
      checkFuelAlert(fuelPrice, fuelObserved);
      const esObserved = Number(fuelEs?.ts);
      const esPrice = Number(fuelEs?.items?.gasoline_95?.avg);
      const esIsFresh = Number.isFinite(esObserved) && now >= esObserved && now - esObserved <= MAX_FUEL_AGE_HOURS * 3600000 && Number.isFinite(esPrice) && esPrice > 0;
      const comparison = esIsFresh
        ? ` · ${fuelPrice >= esPrice ? "+" : "−"}€${Math.abs(fuelPrice - esPrice).toFixed(3).replace(".", ",")}/L vs Espanha`
        : "";
      observations.push({
        group: "fuel",
        title: "Combustível",
        value: `Gasolina 95 · ${fuelPrice.toFixed(3).replace(".", ",")} €/L${comparison}`,
        detail: `${Number(gas95.station_count) || 0} postos${esIsFresh ? ` · média espanhola ${esPrice.toFixed(3).replace(".", ",")} €/L (${formatDate(esObserved)})` : ""} · API Aberta · observada ${formatDateTime(fuelObserved)}`,
        href: "#card-fuel",
        snapshot: Math.round(fuelPrice * 1000),
      });
    } else if (fuelCache?.age > MAX_FUEL_AGE_HOURS * 3600000) {
      observations.push({ group: "fuel", title: "Combustível", value: "Preço desatualizado", detail: `Cache local há ${window.fmtAgeShort?.(fuelCache.age) || "mais de 72h"}`, href: "#card-fuel", stale: true });
    }

    const inflation = window.lsGet?.("inflation_eurostat_v2");
    const inflationRows = inflation?.source === "eurostat_live" && Array.isArray(inflation.rows) ? inflation.rows : [];
    const latestInflation = inflationRows[0];
    const inflationPeriod = parseMonthLabel(latestInflation?.m);
    if (inflationPeriod && now >= inflationPeriod && now - inflationPeriod <= 120 * 86400000 &&
        Number.isFinite(latestInflation?.pt) && Number.isFinite(latestInflation?.eu)) {
      const gap = latestInflation.pt - latestInflation.eu;
      const gapText = `${gap > 0 ? "+" : ""}${gap.toFixed(1).replace(".", ",")} pp vs zona euro`;
      const previousInflation = inflationRows[1];
      const previousPeriod = parseMonthLabel(previousInflation?.m);
      const consecutiveMonths = previousPeriod && Math.abs(monthOrdinal(inflationPeriod) - monthOrdinal(previousPeriod)) === 1;
      const monthlyChange = consecutiveMonths && Number.isFinite(previousInflation?.pt)
        ? latestInflation.pt - previousInflation.pt
        : null;
      const monthlyText = Number.isFinite(monthlyChange)
        ? `${monthlyChange > 0 ? "+" : ""}${monthlyChange.toFixed(1).replace(".", ",")} pp face ao mês anterior`
        : "";
      observations.push({
        group: "inflation",
        title: "Inflação · IHPC",
        value: `Portugal ${latestInflation.pt.toFixed(1).replace(".", ",")}% · zona euro ${latestInflation.eu.toFixed(1).replace(".", ",")}%`,
        detail: `${formatDate(inflationPeriod)} · ${gapText}${monthlyText ? ` · ${monthlyText}` : ""} · Eurostat`,
        href: "#card-inf",
        snapshot: [latestInflation.pt, latestInflation.eu],
      });
    }

    const euribor = window.lsGet?.("euribor_live_v1");
    const euriborDate = parseMonthLabel(euribor?.updated);
    const threeMonth = euribor?.rates?.find(rate => rate?.term === "3M")?.val;
    const twelveMonth = euribor?.rates?.find(rate => rate?.term === "12M")?.val;
    if (euribor?._source === "bce_live" && euriborDate && now >= euriborDate && now - euriborDate <= 75 * 86400000 &&
        Number.isFinite(threeMonth) && Number.isFinite(twelveMonth)) {
      observations.push({
        group: "euribor",
        title: "Euribor",
        value: `3M ${threeMonth.toFixed(3).replace(".", ",")}% · 12M ${twelveMonth.toFixed(3).replace(".", ",")}%`,
        detail: `BCE · observação ${formatDate(euriborDate)}`,
        href: "#card-euribor",
        snapshot: [threeMonth, twelveMonth],
      });
    }

    const basket = window.getCabazBriefingData?.();
    if (Array.isArray(basket) && basket.length >= 2) {
      const [previous, latest] = basket.slice(-2);
      const date = Date.parse(`${latest[0]}T00:00:00Z`);
      const currentValue = Number(latest[1]);
      const previousValue = Number(previous[1]);
      if (Number.isFinite(date) && now >= date && now - date <= MAX_CABAZ_AGE_DAYS * 86400000 &&
          Number.isFinite(currentValue) && Number.isFinite(previousValue) && previousValue > 0) {
        const delta = currentValue - previousValue;
        const change = delta > 0 ? `+€${delta.toFixed(2).replace(".", ",")}` : delta < 0 ? `−€${Math.abs(delta).toFixed(2).replace(".", ",")}` : "sem variação";
        observations.push({
          group: "basket",
          title: "Cabaz alimentar",
          value: `€${currentValue.toFixed(2).replace(".", ",")} · ${change} face ao registo anterior`,
          detail: `Observação ${formatDate(latest[0])} · registo do histórico do painel`,
          href: "#card-cabaz",
          snapshot: Math.round(currentValue * 100),
        });
      }
    }

    bindBriefingPreferences(now);
    const selected = readBriefingPreferences();
    const visibleObservations = observations.filter(item => selected.includes(item.group));
    observations.forEach(item => {
      if (item.snapshot !== undefined) currentVisitSnapshot[item.group] = { snapshot: item.snapshot, value: item.value };
    });
    renderVisitChanges(visibleObservations);
    bindBriefingNavigation();
    root.innerHTML = visibleObservations.length
      ? visibleObservations.map(item => `<a class="briefing-item${item.stale ? " is-stale" : ""}" href="${item.href}"><span class="briefing-title">${escapeHTML(item.title)}</span><strong>${escapeHTML(item.value)}</strong><span class="briefing-detail">${escapeHTML(item.detail)}</span></a>`).join("")
      : observations.length
        ? '<p class="briefing-empty">Nenhum indicador recente está selecionado. Altere as preferências do resumo.</p>'
        : '<p class="briefing-empty">Ainda não há observações recentes suficientes. Os cards individuais continuam disponíveis abaixo.</p>';
    const updated = document.getElementById("briefingUpdated");
    if (updated) updated.textContent = `Síntese gerada ${formatDateTime(now)}`;
    updateFuelImpact();
    bindFuelAlert();
  }

  function bindBriefingNavigation() {
    ["briefingBody", "briefingChanges"].forEach(id => {
      const root = document.getElementById(id);
      if (!root || root.dataset.navigationBound) return;
      root.addEventListener("click", event => {
        const link = event.target.closest('a[href^="#card-"]');
        if (!link) return;
        const card = document.getElementById(link.getAttribute("href").slice(1));
        if (!card?.classList.contains("profile-hidden")) return;
        event.preventDefault();
        window.setDashboardProfile?.("all");
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      root.dataset.navigationBound = "true";
    });
  }

  function renderVisitChanges(observations) {
    const root = document.getElementById("briefingChanges");
    if (!root) return;
    const changes = lastVisitSnapshot ? observations.filter(item => {
      const previous = lastVisitSnapshot[item.group];
      return previous && JSON.stringify(previous.snapshot) !== JSON.stringify(item.snapshot);
    }) : [];
    root.innerHTML = changes.length
      ? `<strong>Alterações desde a visita anterior</strong><ul>${changes.map(item => {
        const previous = lastVisitSnapshot[item.group];
        return `<li><a href="${item.href}">${escapeHTML(item.title)}</a>: ${escapeHTML(previous.value)} → ${escapeHTML(item.value)}</li>`;
      }).join("")}</ul>`
      : lastVisitSnapshot
        ? "Sem alterações nos indicadores recentes desde a visita anterior."
        : "As alterações entre visitas aparecem aqui após a próxima visita.";
  }

  function readBriefingPreferences() {
    try {
      const value = JSON.parse(window.localStorage?.getItem(BRIEFING_PREF_KEY) || "null");
      if (Array.isArray(value)) return BRIEFING_GROUPS.filter(group => value.includes(group));
    } catch {}
    return briefingPreferencesMemory ? [...briefingPreferencesMemory] : [...BRIEFING_GROUPS];
  }

  function bindBriefingPreferences(now) {
    const controls = BRIEFING_GROUPS.map(group => document.getElementById(`briefingPref${group[0].toUpperCase()}${group.slice(1)}`));
    if (controls.some(control => !control) || controls[0].dataset.bound) return;
    const selected = readBriefingPreferences();
    controls.forEach((control, index) => {
      const group = BRIEFING_GROUPS[index];
      control.checked = selected.includes(group);
      control.addEventListener("change", () => {
        const next = controls.flatMap((item, index) => item.checked ? [BRIEFING_GROUPS[index]] : []);
        briefingPreferencesMemory = next;
        try { window.localStorage?.setItem(BRIEFING_PREF_KEY, JSON.stringify(next)); } catch {}
        renderPortugalBriefing(now);
      });
      control.dataset.bound = "true";
    });
  }

  function updateFuelImpact() {
    const input = document.getElementById("fuelMonthlyLitres");
    const output = document.getElementById("fuelMonthlyCost");
    if (!input || !output) return;
    if (!input.dataset.bound) {
      input.addEventListener("input", updateFuelImpact);
      input.dataset.bound = "true";
    }
    const litres = Number(input.value);
    if (!Number.isFinite(currentFuelPrice)) {
      output.textContent = "Preço atual indisponível";
    } else if (!Number.isFinite(litres) || litres <= 0 || litres > 5000) {
      output.textContent = "Indique 1–5 000 litros";
    } else {
      output.textContent = `${new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(litres * currentFuelPrice)} / mês`;
    }
  }

  function readFuelAlert() {
    try {
      const value = JSON.parse(window.localStorage?.getItem(FUEL_ALERT_KEY) || "null");
      const threshold = Number(value?.threshold);
      return {
        enabled: value?.enabled === true,
        desktopEnabled: value?.desktopEnabled === true,
        threshold: Number.isFinite(threshold) && threshold >= 0.5 && threshold <= 5 ? threshold : 1.5,
        lastNotifiedAt: Number(value?.lastNotifiedAt) || 0,
      };
    } catch {
      return { enabled: false, threshold: 1.5, lastNotifiedAt: 0 };
    }
  }

  function writeFuelAlert(value) {
    try { window.localStorage?.setItem(FUEL_ALERT_KEY, JSON.stringify(value)); } catch { /* storage can be unavailable */ }
  }

  function bindFuelAlert() {
    const input = document.getElementById("fuelAlertThreshold");
    const button = document.getElementById("fuelAlertToggle");
    const desktopButton = document.getElementById("fuelDesktopToggle");
    if (!input || !button || button.dataset.bound) return;
    const status = document.getElementById("fuelAlertStatus");
    const state = readFuelAlert();
    input.value = state.threshold.toFixed(2);
    const render = () => {
      button.textContent = state.enabled ? "Desativar alerta" : "Ativar alerta";
      button.setAttribute("aria-pressed", String(state.enabled));
      if (desktopButton) {
        desktopButton.textContent = state.desktopEnabled ? "Desativar aviso no computador" : "Ativar aviso no computador";
        desktopButton.setAttribute("aria-pressed", String(state.desktopEnabled));
      }
      if (status) status.textContent = state.enabled
        ? `Ativo: aviso quando o preço observado for ≤ ${state.threshold.toFixed(2).replace(".", ",")} €/L. Guardado apenas neste browser.${state.desktopEnabled ? " O aviso do computador depende da permissão do browser e do dashboard aberto." : ""}`
        : "Desativado. O limite fica guardado apenas neste browser.";
    };
    input.addEventListener("change", () => {
      const threshold = Number(input.value);
      if (Number.isFinite(threshold) && threshold >= 0.5 && threshold <= 5) state.threshold = threshold;
      else input.value = state.threshold.toFixed(2);
      writeFuelAlert(state);
      render();
      if (currentFuelPrice !== null) state.lastNotifiedAt = checkFuelAlert(currentFuelPrice, currentFuelObserved) || state.lastNotifiedAt;
    });
    button.addEventListener("click", () => {
      state.enabled = !state.enabled;
      writeFuelAlert(state);
      render();
      if (state.enabled && currentFuelPrice !== null) state.lastNotifiedAt = checkFuelAlert(currentFuelPrice, currentFuelObserved) || state.lastNotifiedAt;
    });
    button.dataset.bound = "true";
    if (desktopButton && !desktopButton.dataset.bound) {
      desktopButton.addEventListener("click", async () => {
        const NotificationApi = window.Notification;
        if (!NotificationApi) {
          if (status) status.textContent = "Este browser não suporta notificações do sistema.";
          return;
        }
        if (!state.desktopEnabled && NotificationApi.permission !== "granted") {
          try {
            const permission = await NotificationApi.requestPermission();
            if (permission !== "granted") {
              if (status) status.textContent = "Permissão de notificações não concedida; os avisos continuam no dashboard.";
              return;
            }
          } catch {
            if (status) status.textContent = "Não foi possível pedir permissão ao browser.";
            return;
          }
        }
        state.desktopEnabled = !state.desktopEnabled;
        writeFuelAlert(state);
        render();
      });
      desktopButton.dataset.bound = "true";
    }
    render();
  }

  function checkFuelAlert(price, observedAt) {
    if (!Number.isFinite(price) || !Number.isFinite(observedAt)) return 0;
    const state = readFuelAlert();
    if (!state.enabled || price > state.threshold || observedAt <= state.lastNotifiedAt) return 0;
    if (typeof window.addNotification !== "function") return 0;
    const timestamp = new Date(observedAt).toISOString();
    window.addNotification("energy", "Gasolina 95 abaixo do limite", `Preço observado: ${price.toFixed(3).replace(".", ",")} €/L (limite ${state.threshold.toFixed(2).replace(".", ",")} €/L).`, "medium", { source: "API Aberta", observedAt: timestamp });
    if (state.desktopEnabled && window.Notification?.permission === "granted") {
      try {
        new window.Notification("Gasolina 95 abaixo do limite", {
          body: `Preço observado: ${price.toFixed(3).replace(".", ",")} €/L.`,
          tag: "dash-fuel-" + observedAt,
        });
      } catch {}
    }
    state.lastNotifiedAt = observedAt;
    writeFuelAlert(state);
    return observedAt;
  }

  function formatDate(value) {
    const date = typeof value === "number" ? new Date(value) : new Date(`${value}T12:00:00`);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Lisbon" }).format(date) : "data indisponível";
  }
  function parseMonthLabel(value) {
    const match = /^([A-Za-zÀ-ÿ]{3})\.?\s+(?:de\s+)?(\d{4})$/i.exec(String(value || "").trim());
    if (!match) return 0;
    const month = monthIndex(match[1]);
    return month < 0 ? 0 : Date.UTC(Number(match[2]), month, 1);
  }
  function monthIndex(value) {
    const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    return months.indexOf(String(value || "").toLowerCase());
  }
  function monthOrdinal(timestamp) {
    const date = new Date(timestamp);
    return date.getUTCFullYear() * 12 + date.getUTCMonth();
  }
  function formatDateTime(value) {
    return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" }).format(new Date(value));
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  window.renderPortugalBriefing = renderPortugalBriefing;
})();
