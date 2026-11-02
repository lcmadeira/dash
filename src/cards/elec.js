/* Eletricidade card: OMIE Portugal + estimate from the user's own contract. */
(function () {
  const TREND_KEY = "elec_pt_omie_spot_day";
  const PREF_KEY = "elec_estimate_v1";
  const MAX_PRICE_MWH = 5000;

  function isValidPeriods(data) {
    return !!data && /^\d{4}-\d{2}-\d{2}$/.test(data.date || "")
      && Array.isArray(data.periods) && [23, 24, 25, 92, 96, 100].includes(data.periods.length)
      && data.periods.every((item, index) => item.period === index + 1
        && Number.isFinite(item.priceMwh) && item.priceMwh >= -500 && item.priceMwh <= MAX_PRICE_MWH);
  }

  function marketDateAt(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date);
    const pick = (type) => parts.find((part) => part.type === type)?.value;
    return `${pick("year")}-${pick("month")}-${pick("day")}`;
  }

  function shiftDate(date, days) {
    const shifted = new Date(`${date}T12:00:00Z`);
    shifted.setUTCDate(shifted.getUTCDate() + days);
    return shifted.toISOString().slice(0, 10);
  }

  function getMarketIndex(date = new Date(), periodCount = 96) {
    if (![24, 96].includes(periodCount)) return null;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
    return periodCount === 96 ? hour * 4 + Math.floor(minute / 15) : hour;
  }

  function marketPeriodTime(periodIndex, periodCount) {
    const slotsPerHour = periodCount >= 90 ? 4 : 1;
    const totalMinutes = periodIndex * (60 / slotsPerHour);
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function average(prices) {
    return prices.length ? prices.reduce((sum, value) => sum + value, 0) / prices.length : null;
  }

  function findCheapestWindow(periods, hours = 3) {
    if (![24, 96].includes(periods.length)) return null;
    const periodsPerHour = periods.length >= 90 ? 4 : 1;
    const width = hours * periodsPerHour;
    if (periods.length < width) return null;
    let best = { start: 0, average: Infinity };
    for (let start = 0; start <= periods.length - width; start++) {
      const value = average(periods.slice(start, start + width).map((item) => item.priceMwh));
      if (value < best.average) best = { start, average: value };
    }
    return { ...best, end: best.start + width, periodsPerHour };
  }

  function parseOmieText(text, date) {
    if (typeof text !== "string" || !/^MARGINALPDBCPT;/.test(text.trimStart())) return null;
    const expected = date.split("-");
    const periods = [];
    for (const line of text.split(/\r?\n/)) {
      const fields = line.split(";");
      if (fields.length < 6 || fields[0] !== expected[0] || fields[1] !== expected[1] || fields[2] !== expected[2]) continue;
      const period = Number(fields[3]);
      const priceMwh = Number(fields[4]);
      if (!Number.isInteger(period) || !Number.isFinite(priceMwh) || priceMwh < -500 || priceMwh > MAX_PRICE_MWH) continue;
      periods.push({ period, priceMwh });
    }
    periods.sort((a, b) => a.period - b.period);
    const result = { date, periods };
    return isValidPeriods(result) ? result : null;
  }

  function estimatePrefs() {
    const defaults = { monthlyKwh: 250, energyRate: "", powerDaily: "" };
    try {
      const value = JSON.parse(localStorage.getItem(PFX + PREF_KEY) || "null");
      if (!value || typeof value !== "object") return defaults;
      return {
        monthlyKwh: Number.isFinite(value.monthlyKwh) && value.monthlyKwh >= 0 && value.monthlyKwh <= 10000 ? value.monthlyKwh : defaults.monthlyKwh,
        energyRate: Number.isFinite(value.energyRate) && value.energyRate >= 0 && value.energyRate <= 10 ? String(value.energyRate) : "",
        powerDaily: Number.isFinite(value.powerDaily) && value.powerDaily >= 0 && value.powerDaily <= 100 ? String(value.powerDaily) : "",
      };
    } catch { return defaults; }
  }

  function setEstimatePrefs() {
    const monthlyKwh = Number(document.getElementById("elecEstimateKwh")?.value);
    const energyRaw = document.getElementById("elecEstimateRate")?.value ?? "";
    const powerRaw = document.getElementById("elecEstimatePower")?.value ?? "";
    const energyRate = energyRaw === "" ? NaN : Number(energyRaw);
    const powerDaily = powerRaw === "" ? NaN : Number(powerRaw);
    if (!Number.isFinite(monthlyKwh) || monthlyKwh < 0 || monthlyKwh > 10000
        || (energyRaw !== "" && (!Number.isFinite(energyRate) || energyRate < 0 || energyRate > 10))
        || (powerRaw !== "" && (!Number.isFinite(powerDaily) || powerDaily < 0 || powerDaily > 100))) return;
    try {
      localStorage.setItem(PFX + PREF_KEY, JSON.stringify({
        monthlyKwh,
        energyRate: energyRaw === "" ? null : energyRate,
        powerDaily: powerRaw === "" ? null : powerDaily,
      }));
    } catch {}
    const result = document.getElementById("elecEstimateResult");
    if (!result) return;
    if (energyRaw === "" && powerRaw === "") {
      result.textContent = "Introduz os preços da tua ficha contratual para calcular a estimativa.";
      return;
    }
    const energyCost = Number.isFinite(energyRate) ? monthlyKwh * energyRate : null;
    const powerCost = Number.isFinite(powerDaily) ? powerDaily * 30 : null;
    const total = (energyCost || 0) + (powerCost || 0);
    result.textContent = `Subtotal indicativo: ${total.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}/mês`
      + (energyCost === null || powerCost === null ? " (parcial: falta um dos preços)." : " antes de IVA e outros encargos.");
  }

  function renderTrend(days) {
    const canvas = document.getElementById("elecTrendCanvas");
    const status = document.getElementById("elecTrendStatus");
    if (!canvas || !status) return;
    const history = getHistory(TREND_KEY, days).filter((item) => Number.isFinite(Number(item.value)));
    const last = history.at(-1);
    status.textContent = history.length
      ? `${history.length} dia${history.length === 1 ? "" : "s"} observado${history.length === 1 ? "" : "s"} neste browser · último: ${Number(last.value).toFixed(1)} €/MWh`
      : "Histórico local começa a acumular com as próximas visitas.";
    if (history.length) renderTrendChart(canvas, history, {
      label: "Média diária OMIE PT", borderColor: "#10B981", backgroundColor: "rgba(16,185,129,.12)", unit: " €/MWh", decimals: 1,
    });
    else if (canvas._chart) { canvas._chart.destroy(); canvas._chart = null; }
  }

  function setTrendDays(days) {
    const safeDays = [7, 30, 90].includes(Number(days)) ? Number(days) : 30;
    try { localStorage.setItem(PFX + "elec_trend_pref_v1", JSON.stringify({ days: safeDays })); } catch {}
    const buttons = document.getElementById("elecTrendDays");
    if (buttons) _setOnByDataAttr(buttons, "data-days", safeDays);
    renderTrend(safeDays);
  }

  function periodDateLabel(date) {
    return new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon", day: "numeric", month: "short" });
  }

  function fetchDay(date, force) {
    const key = `omie_electricity_${date}`;
    const cached = force ? null : lsGet(key);
    if (isValidPeriods(cached)) return Promise.resolve({ ...cached, cache: true });
    const base = String(window.CFG?.DATA_API_BASE || "").replace(/\/$/, "");
    if (!base) return Promise.reject(new Error("Gateway de dados não configurado"));
    const url = `${base}/v1/electricity?date=${encodeURIComponent(date)}`;
    return fetchJsonFirstOk(url, {}, 12000, ["direct", "local"], isValidPeriods)
      .then((payload) => {
        const stale = payload?._meta?.state === "stale";
        lsSet(key, payload, { source: "OMIE · MARGINALPDBCPT · zona portuguesa", state: stale ? "stale" : "live" });
        return { ...payload, cache: false, stale };
      });
  }

  async function loadElec(force = false) {
    const body = $("elec-body");
    if (!body) return;
    body.innerHTML = skeletonKPIs(4);
    try {
      const now = new Date();
      const date = marketDateAt(now);
      const tomorrowDate = shiftDate(date, 1);
      let today;
      let tomorrow = null;
      try { today = await fetchDay(date, force); }
      catch (error) {
        const stale = getStaleCache(`omie_electricity_${date}`);
        if (!isValidPeriods(stale?.d)) throw error;
        today = { ...stale.d, cache: true, stale: true, cacheAge: Date.now() - stale.ts };
      }
      lsSet("elec_v3", today, {
        source: "OMIE · MARGINALPDBCPT · zona portuguesa",
        state: today.stale ? "stale" : "live",
      });
      try { tomorrow = await fetchDay(tomorrowDate, force); } catch {}

      const prices = today.periods.map((item) => item.priceMwh);
      const avg = average(prices);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const periodIndex = today.date === date ? getMarketIndex(now, today.periods.length) : null;
      const current = periodIndex === null ? null : today.periods[periodIndex]?.priceMwh ?? null;
      const cheapest = findCheapestWindow(today.periods);
      const priceTomorrow = tomorrow ? average(tomorrow.periods.map((item) => item.priceMwh)) : null;
      const avgColor = "#3B82F6";

      addToHistory(TREND_KEY, avg);
      let trendDays = 30;
      try {
        const pref = JSON.parse(localStorage.getItem(PFX + "elec_trend_pref_v1") || "null");
        if ([7, 30, 90].includes(pref?.days)) trendDays = pref.days;
      } catch {}
      const staleNotice = today.stale
        ? `<div style="margin-bottom:8px;color:#F59E0B;font-size:.62rem">${Number.isFinite(today.cacheAge) ? `Dados em cache local com ${fmtAgeShort(today.cacheAge)} de idade` : "O gateway serviu um snapshot de contingência"}; OMIE indisponível.</div>`
        : today.cache
          ? `<div style="margin-bottom:8px;color:var(--t3);font-size:.6rem">Cache local · preços do dia de mercado ${periodDateLabel(date)}.</div>`
          : "";

      const currentMarketTime = periodIndex === null ? null : marketPeriodTime(periodIndex, today.periods.length);
      const cheapestStart = cheapest ? marketPeriodTime(cheapest.start, today.periods.length) : null;
      const cheapestEnd = cheapest ? marketPeriodTime(cheapest.end, today.periods.length) : null;
      const priceSeries = today.periods.length >= 90
        ? Array.from({ length: Math.ceil(today.periods.length / 4) }, (_, hour) => average(today.periods.slice(hour * 4, hour * 4 + 4).map((item) => item.priceMwh)))
        : today.periods.map((item) => item.priceMwh);
      const minHourly = Math.min(...priceSeries);
      const maxHourly = Math.max(...priceSeries);
      const hourlyBars = priceSeries.map((value, hour) => {
        const progress = (value - minHourly) / (maxHourly - minHourly || 1);
        const color = progress >= .75 ? "#EF4444" : progress >= .4 ? "#F59E0B" : "#10B981";
        const bestStartHour = cheapest ? Math.floor(cheapest.start / cheapest.periodsPerHour) : -1;
        const bestEndHour = cheapest ? Math.ceil(cheapest.end / cheapest.periodsPerHour) : -1;
        const selected = hour >= bestStartHour && hour < bestEndHour;
        const marketPeriods = today.periods.length >= 90 ? 96 : 24;
        const start = marketPeriodTime(hour * (marketPeriods / 24), today.periods.length);
        return `<div title="${start} hora de mercado: ${value.toFixed(1)} €/MWh · média horária" style="flex:1;height:${Math.max(3, Math.round((value - Math.min(0, minHourly)) / (maxHourly - Math.min(0, minHourly) || 1) * 100))}%;background:${selected ? "#10B981" : color};border-radius:1px 1px 0 0;opacity:.85"></div>`;
      }).join("");

      const prefs = estimatePrefs();
      const sourceState = today.stale ? "stale" : today.cache ? "cache" : "live";
      const statusText = today.stale ? (Number.isFinite(today.cacheAge) ? `Stale · ${fmtAgeShort(today.cacheAge)}` : "Gateway · stale") : today.cache ? "Cache local" : "OMIE · PT";
      body.innerHTML = `
        ${staleNotice}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">
          <div style="background:${avgColor}18;border:1px solid ${avgColor}44;border-radius:10px;padding:10px 12px">
            <div style="font-size:.58rem;color:var(--t3);text-transform:uppercase;letter-spacing:.4px">OMIE · zona portuguesa · dia de mercado ${periodDateLabel(date)}</div>
            <div style="display:flex;align-items:flex-end;gap:5px;margin-top:5px"><strong style="font-size:1.8rem;color:${current === null ? avgColor : avgColor};line-height:1">${(current ?? avg).toFixed(1)}</strong><span style="font-size:.66rem;color:var(--t3);margin-bottom:3px">€/MWh</span></div>
            <div style="font-size:.62rem;color:var(--t2);margin-top:5px">${current === null ? "média diária · hora de mercado" : `período atual · ${currentMarketTime} hora de mercado`}</div>
            <div style="font-size:.58rem;color:var(--t3);margin-top:3px">Média ${avg.toFixed(1)} · mín ${min.toFixed(1)} · máx ${max.toFixed(1)} €/MWh</div>
          </div>
          <div style="background:var(--b2);border-radius:10px;padding:10px 12px">
            <div style="font-size:.58rem;color:var(--t3);text-transform:uppercase;letter-spacing:.4px">Próximo dia de mercado · ${periodDateLabel(tomorrowDate)}</div>
            ${priceTomorrow === null
              ? `<div style="font-size:.82rem;font-weight:700;color:var(--t2);margin-top:8px">Ainda não publicado</div>`
              : `<div style="font-size:1.2rem;font-weight:800;color:#10B981;margin-top:5px">${priceTomorrow.toFixed(1)} €/MWh</div><div style="font-size:.59rem;color:var(--t3)">média dos ${tomorrow.periods.length} períodos</div>`}
            <div style="font-size:.58rem;color:var(--t3);margin-top:8px">Preço grossista; não é o preço final da fatura.</div>
          </div>
        </div>
        ${cheapest ? `<div style="margin-top:8px;padding:7px 9px;border-radius:7px;background:var(--b2);font-size:.64rem;color:var(--t2)">Janela mais barata de 3h: <strong style="color:#10B981">${cheapestStart}–${cheapestEnd} hora de mercado</strong> · média ${cheapest.average.toFixed(1)} €/MWh</div>` : ""}
        <div style="display:flex;align-items:flex-end;gap:1px;height:46px;margin:10px 0 2px">${hourlyBars}</div>
        <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:.5rem;color:var(--t3);margin-bottom:3px"><span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span></div>
        <div style="font-size:.56rem;color:var(--t3)">Preços por hora de mercado · fonte em intervalos OMIE de ${today.periods.length >= 90 ? "15 min" : "1 h"} · zona PT · hora de mercado CET/CEST (Portugal continental: menos 1h)</div>
        <div style="margin-top:10px;background:var(--surface);border:1px solid var(--b);border-radius:var(--rs);padding:8px 10px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px"><div id="elecTrendStatus" style="flex:1;min-width:0;font-size:.59rem;color:var(--t3)"></div><div id="elecTrendDays" style="display:flex;gap:4px"><button class="rbtn ${trendDays === 7 ? "on" : ""}" data-days="7" onclick="setElecTrendDays(7)">7D</button><button class="rbtn ${trendDays === 30 ? "on" : ""}" data-days="30" onclick="setElecTrendDays(30)">30D</button><button class="rbtn ${trendDays === 90 ? "on" : ""}" data-days="90" onclick="setElecTrendDays(90)">90D</button></div></div>
          <div style="height:120px"><canvas id="elecTrendCanvas"></canvas></div>
        </div>
        <details style="margin-top:10px;background:var(--b2);border-radius:8px;padding:8px 10px">
          <summary style="cursor:pointer;font-size:.68rem;font-weight:700;color:var(--t2)">Estimar o meu custo mensal</summary>
          <div style="font-size:.6rem;color:var(--t3);margin:6px 0">Usa os preços da tua ficha contratual. A estimativa não inclui IVA, taxas, serviços ou descontos.</div>
          <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px">
            <label style="font-size:.57rem;color:var(--t3)">Consumo kWh/mês<input id="elecEstimateKwh" type="number" min="0" max="10000" step="1" value="${prefs.monthlyKwh}" onchange="setElecEstimate()" style="display:block;width:100%;margin-top:3px"></label>
            <label style="font-size:.57rem;color:var(--t3)">Energia €/kWh<input id="elecEstimateRate" type="number" min="0" max="10" step="0.0001" value="${prefs.energyRate}" onchange="setElecEstimate()" style="display:block;width:100%;margin-top:3px"></label>
            <label style="font-size:.57rem;color:var(--t3)">Potência €/dia<input id="elecEstimatePower" type="number" min="0" max="100" step="0.0001" value="${prefs.powerDaily}" onchange="setElecEstimate()" style="display:block;width:100%;margin-top:3px"></label>
          </div>
          <div id="elecEstimateResult" aria-live="polite" style="font-size:.64rem;color:var(--t2);margin-top:7px">Introduz os preços da tua ficha contratual para calcular a estimativa.</div>
        </details>
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:7px;font-size:.57rem;color:var(--t3)"><span>Fonte: OMIE · MARGINALPDBCPT · zona portuguesa</span><span data-state="${sourceState}" title="Estado dos dados">${statusText}</span></div>
        <div style="font-size:.57rem;color:var(--t3);margin-top:5px">O spot só afeta diretamente contratos indexados. Em tarifas fixas, consulta o preço contratual. Horários bi/tri-horários dependem do ciclo e da época; <a href="https://www.erse.pt/atividade/regulacao/tarifas-e-precos-eletricidade/" target="_blank" rel="noopener">ver tarifas e períodos na ERSE</a>.</div>
      `;
      renderTrend(trendDays);
      setEstimatePrefs();
    } catch (error) {
      const stale = getStaleCache(`omie_electricity_${marketDateAt(new Date())}`);
      const staleText = stale ? " · sem dados OMIE recentes disponíveis" : "";
      body.innerHTML = `${er(`Preço OMIE Portugal indisponível${staleText}`)}<div style="margin-top:8px;font-size:.63rem;color:var(--t3)">O preço grossista não substitui a tarifa do teu contrato. <a href="https://www.omie.es/pt/market-results/daily/daily-market/day-ahead-price" target="_blank" rel="noopener">Consultar o OMIE</a>.</div>`;
      console.warn("Falha ao carregar preços OMIE Portugal:", error);
    }
  }

  window.loadElec = loadElec;
  window.setElecTrendDays = setTrendDays;
  window.setElecEstimate = setEstimatePrefs;
  window.ELEC_TARIFAS = Object.freeze({ source: "OMIE/MARGINALPDBCPT", zone: "PT" });
  window.ELEC_TEST = Object.freeze({ isValidPeriods, parseOmieText, findCheapestWindow, getMarketIndex, marketPeriodTime, average });
})();
