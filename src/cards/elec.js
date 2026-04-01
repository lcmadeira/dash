/* Eletricidade card (moved out of index.html) */
(function () {
  /* ── Eletricidade ── */
  /* ── Eletricidade — API REE/REData (apidatos.ree.es) CORS nativo ── */
  const ELEC_TARIFAS = {
    simples: 0.2134,
    /* Bi-horária */
    vazio: 0.1423,
    fvazio: 0.2567,
    /* Tri-horária ERSE 2025-2026 */
    /* Ponta: 09-12h e 18-21h dias úteis */
    /* Cheia: 07-09h, 12-18h, 21-24h dias úteis + 09-22h fim-de-semana */
    /* Vazio: 00-07h todos os dias */
    triVazio: 0.1243,
    triCheia: 0.1987,
    triPonta: 0.2834,
    /* Custo estimado mensal consumidor médio 250kWh/mês */
    custoMedSimples: 53.35,
    custoMedBi: 48.2,
    custoMedTri: 46.8,
  };
  window.ELEC_TARIFAS = ELEC_TARIFAS;

  /* Tarifas Gás Natural ERSE 2025-2026 (€/kWh c/ redes, s/ IVA)
     Fonte: ERSE Deliberação Tarifária Outubro 2025
     Comercializador de último recurso (CUR) - EDP Comercial / Galp */
  window.GAS_TARIFAS = {
    /* Tarifa energia por escalão (kWh) */
    esc1: { label: "Esc. 1 (≤10 GJ/a)", kwh: 0.0974, desc: "Baixo consumo" },
    esc2: { label: "Esc. 2 (10-4000 GJ/a)", kwh: 0.0716, desc: "Consumo normal" },
    /* Tarifa de acesso às redes (BTN) */
    redes: 0.0821,
    /* Custo total estimado BTN c/ IVA 6% */
    totalEsc1: 0.1694 /* (0.0974+0.0821)*1.06 */,
    totalEsc2: 0.1527 /* (0.0716+0.0821)*1.06 */,
    /* Termo fixo mensal (capacidade) */
    termoFixo: 3.42 /* €/mês */,
    /* Ref MIBGAS spot Mar 2026 */
    mibgasSpot: 57.3,
    mibgasPrev: 46.2,
    mibgas7d: [36.8, 38.2, 46.1, 54.8, 58.2, 56.4, 57.3],
    /* TTF Day-ahead ref Mar 2026 */
    ttfSpot: 48.2,
    ttfPrev: 40.2,
    /* Spread MIBGAS-TTF */
    spread: 57.3 - 48.2,
  };

  const ELEC_TREND_PREF_KEY = "elec_trend_pref_v1";
  function getElecTrendPref() {
    try {
      const raw = localStorage.getItem(PFX + ELEC_TREND_PREF_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const days = [7, 30, 90].includes(parsed?.days) ? parsed.days : 30;
      return { days };
    } catch {
      return { days: 30 };
    }
  }
  function setElecTrendPref(patch) {
    const cur = getElecTrendPref();
    const next = { ...cur, ...patch };
    try {
      localStorage.setItem(PFX + ELEC_TREND_PREF_KEY, JSON.stringify(next));
    } catch {}
    return next;
  }
  function setElecTrendDays(days) {
    setElecTrendPref({ days });
    loadElecTrend(false).catch(() => {});
  }

  async function loadElecTrend(force = false) {
    const canvas = document.getElementById("elecTrendCanvas");
    const statusEl = document.getElementById("elecTrendStatus");
    const daysEl = document.getElementById("elecTrendDays");
    if (!canvas || !statusEl || !daysEl) return;

    const pref = getElecTrendPref();
    _setOnByDataAttr(daysEl, "data-days", pref.days);
    statusEl.textContent = "A carregar tendência...";

    const cacheKey = "hist_elec_spot_90";
    try {
      let series = !force ? lsGet(cacheKey) : null;
      if (!series) {
        const base = "https://apidatos.ree.es";
        async function fetchREEChunk(startStr, endStr) {
          const basePath = `/en/datos/mercados/precios-mercados-tiempo-real`;
          const mkUrl = (trunc) =>
            `${base}${basePath}?start_date=${startStr}T00:00&end_date=${endStr}T23:59&time_trunc=${trunc}`;
          const fullDay = mkUrl("day");
          const fullHour = mkUrl("hour");

          async function fetchJson(full) {
            try {
              return await fetchJsonFirstOk(
                full,
                {},
                11000,
                ["direct", "local", "allorigins", "corsproxy"],
                (j) => !!(j && (j.included || j.data)),
              );
            } catch {
              return null;
            }
          }

          const jDay = await fetchJson(fullDay);
          if (jDay) return { mode: "day", json: jDay };

          const jHour = await fetchJson(fullHour);
          if (jHour) return { mode: "hour", json: jHour };

          return null;
        }

        const end = new Date();
        const byDate = {};

        const chunkDays = 30;
        for (let offset = 90 - chunkDays; offset >= 0; offset -= chunkDays) {
          const chunkEnd = new Date(end.getTime() - offset * 864e5);
          const chunkStart = new Date(chunkEnd.getTime() - (chunkDays - 1) * 864e5);
          const s = chunkStart.toISOString().slice(0, 10);
          const e = chunkEnd.toISOString().slice(0, 10);
          const res = await fetchREEChunk(s, e);
          if (!res) continue;

          const inc = res.json.included || [];
          const PREFER = ["spot", "omie", "mercado diário", "mercado diario", "precio mercado"];
          const EXCLUDE = ["pvpc", "término", "termino", "componente", "peaje", "cargo"];
          let spot = inc.find((sx) => {
            const t = (sx.attributes?.title || sx.attributes?.type || "").toLowerCase();
            const hasPrefer = PREFER.some((p) => t.includes(p));
            const hasExclude = EXCLUDE.some((p) => t.includes(p));
            return hasPrefer && !hasExclude;
          });
          if (!spot) spot = inc.find((sx) => (sx.attributes?.title || "").toLowerCase().includes("spot"));
          if (!spot) spot = inc[0];
          const vals = spot?.attributes?.values || [];

          if (res.mode === "day") {
            for (const v of vals) {
              const date = (v?.datetime ? new Date(v.datetime) : new Date()).toISOString().slice(0, 10);
              const value = Number(v?.value);
              if (!Number.isFinite(value)) continue;
              byDate[date] = { date, timestamp: Date.parse(date), value };
            }
          } else if (res.mode === "hour") {
            const sums = {};
            const counts = {};
            for (const v of vals) {
              const date = (v?.datetime ? new Date(v.datetime) : new Date()).toISOString().slice(0, 10);
              const value = Number(v?.value);
              if (!Number.isFinite(value) || value < 0 || value > 500) continue;
              sums[date] = (sums[date] || 0) + value;
              counts[date] = (counts[date] || 0) + 1;
            }
            for (const date of Object.keys(sums)) {
              const avg = sums[date] / (counts[date] || 1);
              byDate[date] = { date, timestamp: Date.parse(date), value: avg };
            }
          }
        }

        series = Object.values(byDate).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        if (series.length >= 10) lsSet(cacheKey, series);
      }

      let usedLocal = false;
      if (!Array.isArray(series) || series.length < 2) {
        const local = getHistory("elec_spot_day", 90)
          .map((h) => ({ date: h.date, timestamp: h.timestamp || Date.parse(h.date), value: Number(h.value) }))
          .filter((x) => x.date && Number.isFinite(x.value))
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        if (local.length >= 10) {
          series = local;
          usedLocal = true;
        }
      }
      if ((!Array.isArray(series) || series.length < 2) && pref.days <= 7) {
        const N = pref.days;
        const end = new Date();
        const days = Array.from({ length: N }, (_, i) => new Date(end.getTime() - (N - 1 - i) * 864e5)).map((d) =>
          d.toISOString().slice(0, 10),
        );

        async function fetchREEHours(d) {
          const full = `${base}/en/datos/mercados/precios-mercados-tiempo-real?start_date=${d}T00:00&end_date=${d}T23:59&time_trunc=hour`;
          try {
            return await fetchJsonFirstOk(
              full,
              {},
              11000,
              ["direct", "local", "allorigins", "corsproxy"],
              (j) => !!(j && (j.included || j.data)),
            );
          } catch {
            return null;
          }
        }

        function pickSpotValues(json) {
          const inc = json?.included || [];
          const PREFER = ["spot", "omie", "mercado diário", "mercado diario", "precio mercado"];
          const EXCLUDE = ["pvpc", "término", "termino", "componente", "peaje", "cargo"];
          let spot = inc.find((sx) => {
            const t = (sx.attributes?.title || sx.attributes?.type || "").toLowerCase();
            const hasPrefer = PREFER.some((p) => t.includes(p));
            const hasExclude = EXCLUDE.some((p) => t.includes(p));
            return hasPrefer && !hasExclude;
          });
          if (!spot) spot = inc.find((sx) => (sx.attributes?.title || "").toLowerCase().includes("spot"));
          if (!spot) spot = inc[0];
          const vals = spot?.attributes?.values || [];
          return vals.map((v) => Number(v?.value)).filter((v) => Number.isFinite(v) && v >= 0 && v <= 500);
        }

        const out = [];
        for (const d of days) {
          const json = await fetchREEHours(d);
          if (!json) continue;
          const vals = pickSpotValues(json);
          if (vals.length < 6) continue;
          const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
          out.push({ date: d, timestamp: Date.parse(d), value: avg });
        }
        if (out.length >= 2) {
          series = out;
          usedLocal = true;
        }
      }

      if (!Array.isArray(series) || series.length < 2) throw new Error("Histórico MIBEL indisponível");

      const view = _lastN(series, pref.days);
      if (view.length < 2) throw new Error("Histórico insuficiente");

      const first = view[0]?.value || 0;
      const last = view[view.length - 1]?.value || 0;
      const pct = first > 0 ? ((last - first) / first) * 100 : 0;
      const sign = pct > 0 ? "+" : "";

      renderTrendChart(canvas, view, {
        label: "Spot MIBEL",
        borderColor: "#10B981",
        backgroundColor: "rgba(16,185,129,0.10)",
        unit: " €/MWh",
        decimals: 0,
      });

      statusEl.innerHTML = `
        <span style="font-family:var(--mono);font-size:.56rem;color:var(--t3);text-transform:uppercase;letter-spacing:.5px">
          ${pref.days}D · tendência${usedLocal ? " · local" : ""}
        </span>
        <span style="font-family:var(--mono);font-size:.56rem;color:${pct >= 0 ? "var(--green)" : "var(--red)"};margin-left:8px">
          ${sign}${pct.toFixed(1)}%
        </span>
        <span style="font-family:var(--mono);font-size:.56rem;color:var(--t3);margin-left:8px">
          último: ${last.toFixed(0)} €/MWh
        </span>`;
    } catch (e) {
      statusEl.textContent = e && e.message ? e.message : "Tendência indisponível";
    }
  }

  async function loadElec(force = false) {
    $("elec-body").innerHTML = skeletonKPIs(4);
    try {
      const T = ELEC_TARIFAS;
      const trendPref = getElecTrendPref();
      const today = new Date(),
        hh = today.getHours();
      const todayStr = today.toISOString().slice(0, 10);
      const yesterStr = new Date(today - 864e5).toISOString().slice(0, 10);
      const ck = "elec_v3"; /* v3: corrigido endpoint /pt/ MIBEL Portugal */
      let cached = force ? null : lsGet(ck);

      if (!cached) {
        async function fetchREE(path) {
          const base = "https://apidatos.ree.es";
          const full = base + path;
          try {
            return await fetchJsonFirstOk(
              full,
              {},
              10000,
              ["direct", "local", "allorigins", "corsproxy"],
              (j) => !!(j && (j.included || j.data)),
            );
          } catch {
            return null;
          }
        }

        const dates = [todayStr, yesterStr, new Date(today.getTime() + 864e5).toISOString().slice(0, 10)];
        const fetches = dates.map((d) =>
          fetchREE(
            `/en/datos/mercados/precios-mercados-tiempo-real` +
              `?start_date=${d}T00:00&end_date=${d}T23:59&time_trunc=hour`,
          ),
        );
        const mixFetch = fetchREE(
          `/en/datos/generacion/estructura-generacion` +
            `?start_date=${todayStr}T00:00&end_date=${todayStr}T23:59&time_trunc=hour`,
        );

        const [todayData, yesterData, tomorrowData, mixData] = await Promise.all([...fetches, mixFetch]);

        const parseVals = (j) => {
          if (!j) return null;
          const inc = j.included || [];
          if (!inc.length) return null;
          const PREFER = ["spot", "omie", "mercado diário", "mercado diario", "precio mercado"];
          const EXCLUDE = ["pvpc", "término", "termino", "componente", "peaje", "cargo"];
          let spot = inc.find((s) => {
            const t = (s.attributes?.title || s.attributes?.type || "").toLowerCase();
            const hasPrefer = PREFER.some((p) => t.includes(p));
            const hasExclude = EXCLUDE.some((p) => t.includes(p));
            return hasPrefer && !hasExclude;
          });
          if (!spot)
            spot = inc.find((s) => (s.attributes?.title || "").toLowerCase().includes("spot"));
          if (!spot) {
            spot =
              inc.find((s) => {
                const vals = s.attributes?.values || [];
                if (!vals.length) return false;
                const v = parseFloat(vals[Math.floor(vals.length / 2)]?.value);
                return !isNaN(v) && v >= 0 && v <= 500;
              }) || inc[0];
          }
          const raw = spot?.attributes?.values || null;
          if (!raw) return null;
          const sane = raw.filter((v) => parseFloat(v.value) >= 0 && parseFloat(v.value) <= 500);
          return sane.length >= 12 ? sane : raw;
        };

        const todayVals = parseVals(todayData);
        const yesterVals = parseVals(yesterData);
        const tomorrowVals = parseVals(tomorrowData);

        let mix = null;
        if (mixData?.included) {
          mix = {};
          mixData.included.forEach((src) => {
            const title = (src.attributes?.title || "").toLowerCase();
            const vals = src.attributes?.values || [];
            const cur = vals[Math.min(hh, vals.length - 1)];
            if (!cur) return;
            const mw = parseFloat(cur.value) || 0;
            if (title.includes("hidráulic") || title.includes("hydraulic")) mix.hidro = (mix.hidro || 0) + mw;
            else if (title.includes("eólica") || title.includes("wind")) mix.eolica = (mix.eolica || 0) + mw;
            else if (title.includes("solar fotovoltaica") || title.includes("photovoltaic"))
              mix.solar = (mix.solar || 0) + mw;
            else if (title.includes("ciclo combinado") || title.includes("combined")) mix.gas = (mix.gas || 0) + mw;
            else if (title.includes("nuclear")) mix.nuclear = (mix.nuclear || 0) + mw;
            else if (title.includes("carbón") || title.includes("coal")) mix.carvao = (mix.carvao || 0) + mw;
            else if (title.includes("otras renovables") || title.includes("other renew")) mix.outras = (mix.outras || 0) + mw;
          });
        }

        cached = { todayVals, yesterVals, tomorrowVals, mix, date: todayStr };
        lsSet(ck, cached);

        if (notificationSettings.energy.enabled && cached.todayVals) {
          const prices = (cached.todayVals || [])
            .map((v) => parseFloat(v.value))
            .filter((v) => !isNaN(v) && v >= 0);
          if (prices.length > 0) {
            const avg = prices.reduce((a, b) => a + b) / prices.length;
            const now = prices[Math.min(hh, prices.length - 1)] ?? avg;
            const percentAbove = ((now - avg) / avg) * 100;

            if (percentAbove >= notificationSettings.energy.threshold) {
              const notifId = `energy-peak-${todayStr}`;
              const exists = notifications.find((n) => n.data?.notifId === notifId);

              if (!exists) {
                const severity = percentAbove >= 40 ? "high" : percentAbove >= 30 ? "medium" : "low";

                addNotification(
                  "energy",
                  `Energia ${percentAbove.toFixed(0)}% acima da média hoje`,
                  `Agora: ${now.toFixed(2)} €/MWh • Média: ${avg.toFixed(2)} €/MWh`,
                  severity,
                  { notifId, current: now, average: avg, percentAbove },
                );

                console.log(`⚡ Notificação: Energia ${percentAbove.toFixed(0)}% acima da média`);
              }
            }
          }
        }
      }

      const prices = (cached.todayVals || []).map((v) => parseFloat(v.value)).filter((v) => !isNaN(v) && v >= 0);
      const yesterPrices = (cached.yesterVals || []).map((v) => parseFloat(v.value)).filter((v) => !isNaN(v) && v >= 0);
      const tomPrices = (cached.tomorrowVals || []).map((v) => parseFloat(v.value)).filter((v) => !isNaN(v) && v >= 0);

      if (!prices.length) {
        const stale = getStaleCache(ck) || getStaleCache("elec_v2") || getStaleCache("elec_v1");
        if (stale) {
          const sp = (stale.d?.todayVals || []).map((v) => parseFloat(v.value)).filter((v) => !isNaN(v) && v >= 0);
          if (sp.length) {
            cached = stale.d;
            const age = Math.round((Date.now() - (stale.ts || 0)) / 60000);
            const warn = document.createElement("div");
            warn.style.cssText =
              "background:#F59E0B12;border:1px solid #F59E0B44;border-radius:6px;padding:5px 10px;font-size:.6rem;color:#F59E0B;margin-bottom:8px";
            warn.textContent = "⚠ Dados em cache (há " + age + "min) · API REE temporariamente inacessível";
            const eb = $("elec-body");
            if (eb.firstChild) eb.insertBefore(warn, eb.firstChild);
          }
        }
        if (!(cached?.todayVals?.length)) throw new Error("Sem dados MIBEL · API REE inacessível");
      }

      const avg = prices.reduce((a, b) => a + b) / prices.length;
      const min = Math.min(...prices),
        max = Math.max(...prices);
      const now = prices[Math.min(hh, prices.length - 1)] ?? avg;
      const yesterAvg = yesterPrices.length ? yesterPrices.reduce((a, b) => a + b) / yesterPrices.length : null;
      const yoyChg = yesterAvg ? ((avg - yesterAvg) / yesterAvg) * 100 : null;
      try {
        addToHistory("elec_spot_day", avg);
      } catch {}

      const pct = (now - min) / (max - min || 1);
      const ctx =
        pct > 0.75
          ? { lbl: "CARO", col: "#EF4444", bg: "#EF444418", ico: "🔴" }
          : pct > 0.4
            ? { lbl: "MÉDIO", col: "#F59E0B", bg: "#F59E0B18", ico: "🟡" }
            : { lbl: "BARATO", col: "#10B981", bg: "#10B98118", ico: "🟢" };

      let bestStart = 0,
        bestSum = Infinity;
      for (let i = 0; i <= prices.length - 3; i++) {
        const s = prices[i] + prices[i + 1] + prices[i + 2];
        if (s < bestSum) {
          bestSum = s;
          bestStart = i;
        }
      }
      const bestAvg = (bestSum / 3).toFixed(1);
      const bestEnd = bestStart + 2;

      const dow = today.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const triPeriod = () => {
        if (isWeekend) return hh >= 0 && hh < 7 ? "Vazio" : hh >= 22 ? "Vazio" : "Cheia";
        if (hh >= 0 && hh < 7) return "Vazio";
        if ((hh >= 9 && hh < 12) || (hh >= 18 && hh < 21)) return "Ponta";
        return "Cheia";
      };
      const triCur = triPeriod();
      const triCol = { Vazio: "#10B981", Cheia: "#F59E0B", Ponta: "#EF4444" };

      const biPeriod = hh >= 22 || hh < 8 ? "Vazio" : "Fora Vazio";
      const biCol = biPeriod === "Vazio" ? "#10B981" : "#F59E0B";

      let co2 = null;
      if (cached.mix) {
        const m = cached.mix;
        const total = (m.hidro || 0) + (m.eolica || 0) + (m.solar || 0) + (m.gas || 0) + (m.nuclear || 0) + (m.carvao || 0) + (m.outras || 0);
        if (total > 0) {
          co2 = Math.round(((m.hidro || 0) * 4 + (m.eolica || 0) * 11 + (m.solar || 0) * 45 + (m.gas || 0) * 490 + (m.nuclear || 0) * 12 + (m.carvao || 0) * 820 + (m.outras || 0) * 30) / total);
        }
      }

      const chartPrices = tomPrices.length >= 20 ? tomPrices : prices;
      const chartLabel = tomPrices.length >= 20 ? "amanhã (D+1)" : "hoje";
      const cMax = Math.max(...chartPrices) || 1;
      const bars = chartPrices
        .map((v, i) => {
          const cp = (v - Math.min(...chartPrices)) / (cMax - Math.min(...chartPrices) || 1);
          const barCol = cp > 0.75 ? "#EF4444" : cp > 0.4 ? "#F59E0B" : "#10B981";
          const isNow = i === hh && chartLabel === "hoje";
          const isBest = i >= bestStart && i <= bestEnd && chartLabel === "hoje";
          return `<div title="${i}h: ${v.toFixed(1)}€/MWh"
            style="flex:1;height:${Math.round((v / cMax) * 95) + 2}%;
            background:${isNow ? "var(--accent)" : isBest ? "#10B98188" : barCol};
            border-radius:1px 1px 0 0;
            ${isNow ? "outline:1px solid var(--accent);" : ""}
            opacity:${isNow ? 1 : 0.75}"></div>`;
        })
        .join("");

      const mixHtml = () => {
        if (!cached.mix) return "";
        const m = cached.mix;
        const total = (m.hidro || 0) + (m.eolica || 0) + (m.solar || 0) + (m.gas || 0) + (m.nuclear || 0) + (m.carvao || 0) + (m.outras || 0);
        if (!total) return "";
        const srcs = [
          { k: "hidro", lbl: "Hídrica", ico: "💧", col: "#3B82F6" },
          { k: "eolica", lbl: "Eólica", ico: "💨", col: "#10B981" },
          { k: "solar", lbl: "Solar", ico: "☀️", col: "#F59E0B" },
          { k: "gas", lbl: "Gás CC", ico: "🔥", col: "#F97316" },
          { k: "nuclear", lbl: "Nuclear", ico: "⚛️", col: "#8B5CF6" },
          { k: "carvao", lbl: "Carvão", ico: "🪨", col: "#6B7280" },
          { k: "outras", lbl: "Outras REN", ico: "🌿", col: "#84CC16" },
        ].filter((s) => m[s.k] > 0);
        const renPct = Math.round(((m.hidro || 0) + (m.eolica || 0) + (m.solar || 0) + (m.outras || 0)) / total * 100);
        const segments = srcs
          .map((s) => `<div title="${s.lbl}: ${Math.round(m[s.k] / total * 100)}%"
            style="flex:${m[s.k]};background:${s.col};height:100%"></div>`)
          .join("");
        const labels = srcs
          .map((s) => {
            const p = Math.round(m[s.k] / total * 100);
            if (p < 5) return "";
            return `<div style="text-align:center;flex:${m[s.k]}">
              <div style="font-size:.55rem;color:${s.col}">${s.ico}</div>
              <div style="font-size:.52rem;color:var(--t3)">${p}%</div>
            </div>`;
          })
          .join("");
        return `
        <div style="margin:10px 0 8px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div style="font-size:.63rem;font-weight:700;color:var(--t2)">⚡ Mix energético · hora ${hh}h</div>
            <div style="font-size:.63rem;color:#10B981;font-weight:600">${renPct}% renovável
              ${co2 !== null ? `<span style="color:var(--t3);font-weight:400"> · ${co2} gCO₂/kWh</span>` : ""}
            </div>
          </div>
          <div style="display:flex;height:10px;border-radius:5px;overflow:hidden;gap:1px">${segments}</div>
          <div style="display:flex;margin-top:3px">${labels}</div>
        </div>`;
      };

      const dl = new Date((cached.date || todayStr) + "T12:00:00").toLocaleDateString("pt-PT", { day: "numeric", month: "short" });

      $("elec-body").innerHTML = `
      <!-- Top: Spot + contexto -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">
        <!-- Spot actual -->
        <div style="background:${ctx.bg};border:1px solid ${ctx.col}33;
             border-radius:10px;padding:10px 12px">
          <div style="font-size:.58rem;color:var(--t3);text-transform:uppercase;
               letter-spacing:.5px;margin-bottom:2px">
            Spot MIBEL PT · ${dl}
            <span style="font-size:.48rem;background:#3B82F622;color:#3B82F6;border-radius:3px;padding:1px 4px;margin-left:3px">apidatos.ree.es/pt</span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:5px">
            <div style="font-size:2rem;font-weight:900;color:${ctx.col};
                 line-height:1">${now.toFixed(1)}</div>
            <div style="font-size:.68rem;color:var(--t3);margin-bottom:3px">€/MWh · ${hh}h</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:3px">
            <span style="font-size:.72rem;font-weight:700;color:${ctx.col};
                  background:${ctx.bg};border:1px solid ${ctx.col}44;
                  border-radius:4px;padding:1px 6px">${ctx.ico} ${ctx.lbl}</span>
            ${
              yoyChg !== null
                ? `<span style="font-size:.65rem;color:${yoyChg > 0 ? "#EF4444" : "#10B981"};
                  font-weight:600">${yoyChg > 0 ? "▲" : "▼"}${Math.abs(yoyChg).toFixed(1)}% vs ontem</span>`
                : ""
            }
          </div>
          <div style="font-size:.6rem;color:var(--t3);margin-top:3px">
            méd ${avg.toFixed(1)} · mín ${min.toFixed(1)} · máx ${max.toFixed(1)}
          </div>
        </div>
        <!-- Melhor janela + tarifa -->
        <div style="background:var(--b2);border-radius:10px;padding:10px 12px">
          <div style="font-size:.58rem;color:var(--t3);text-transform:uppercase;
               letter-spacing:.5px;margin-bottom:4px">💡 Melhor janela ${chartLabel}</div>
          <div style="font-size:1.1rem;font-weight:800;color:#10B981">
            ${bestStart}h – ${bestEnd + 1}h</div>
          <div style="font-size:.63rem;color:#10B981;margin-top:1px">
            média ${bestAvg} €/MWh
          </div>
          <div style="font-size:.58rem;color:var(--t3);margin-top:4px;line-height:1.4">
            Ideal para: máquina lavar,<br>dishwasher, carregar EV
          </div>
          <div style="margin-top:6px;font-size:.6rem;color:var(--t3)">Período actual:</div>
          <div style="display:flex;gap:4px;margin-top:2px">
            <span style="font-size:.65rem;font-weight:700;color:${biCol};
                  background:${biCol}18;border-radius:4px;padding:2px 6px">
              Bi: ${biPeriod}</span>
            <span style="font-size:.65rem;font-weight:700;color:${triCol[triCur]};
                  background:${triCol[triCur]}18;border-radius:4px;padding:2px 6px">
              Tri: ${triCur}</span>
          </div>
        </div>
      </div>

      <!-- Gráfico de barras -->
      <div style="display:flex;align-items:flex-end;gap:1px;height:46px;margin:10px 0 2px">
        ${bars}
      </div>
      <div style="display:flex;justify-content:space-between;
           font-family:var(--mono);font-size:.5rem;color:var(--t3);margin-bottom:2px">
        <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span>
      </div>
      <div style="font-size:.57rem;color:var(--t3);margin-bottom:4px">
        Preços ${chartLabel} · 
        <span style="color:#10B981">▬</span> barato · 
        <span style="color:#F59E0B">▬</span> médio · 
        <span style="color:#EF4444">▬</span> caro · 
        <span style="color:var(--accent)">▬</span> hora actual
        ${chartLabel === "hoje" ? `· <span style="color:#10B98188">▬</span> melhor janela` : ""}
      </div>

      <div style="margin-top:10px;background:var(--surface);border:1px solid var(--b);border-radius:var(--rs);padding:8px 10px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px">
          <div id="elecTrendStatus" style="flex:1;min-width:0"></div>
          <div id="elecTrendDays" style="display:flex;gap:4px;flex-shrink:0">
            <button class="rbtn ${trendPref.days === 7 ? "on" : ""}"  data-days="7"  onclick="setElecTrendDays(7)">7D</button>
            <button class="rbtn ${trendPref.days === 30 ? "on" : ""}" data-days="30" onclick="setElecTrendDays(30)">30D</button>
            <button class="rbtn ${trendPref.days === 90 ? "on" : ""}" data-days="90" onclick="setElecTrendDays(90)">90D</button>
          </div>
        </div>
        <div style="height:120px">
          <canvas id="elecTrendCanvas"></canvas>
        </div>
      </div>

      ${mixHtml()}

      <!-- Tarifas ERSE 2026 -->
      <div>
        <div style="font-size:.63rem;font-weight:700;color:var(--t2);margin-bottom:5px">
          Tarifas ERSE 2025-2026
          <span style="font-size:.57rem;font-weight:400;color:var(--t3)"> · custo est. 250 kWh/mês</span>
        </div>
        ${
          [
            { lbl: "Simples", v: T.simples, est: T.custoMedSimples, desc: "Sem gestão horária", sub: "", col: "#3B82F6", active: false },
            { lbl: "Bi-horária", v: T.fvazio, est: T.custoMedBi, desc: "Vazio 22h-8h", sub: `V:${T.vazio.toFixed(4)} FV:${T.fvazio.toFixed(4)}`, col: "#10B981", active: biPeriod === "Vazio" },
            { lbl: "Tri-horária", v: T.triPonta, est: T.custoMedTri, desc: "Ponta 9-12h 18-21h", sub: `V:${T.triVazio.toFixed(3)} C:${T.triCheia.toFixed(3)} P:${T.triPonta.toFixed(3)}`, col: "#F59E0B", active: triCur !== "Ponta" },
          ]
            .map(
              (t) => `
          <div style="background:var(--b2);border-radius:7px;padding:7px 10px;
               margin-bottom:5px;${t.active ? "border:1px solid " + t.col + "44;" : "border:1px solid transparent;"}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <span style="font-size:.7rem;font-weight:700;color:${t.col}">${t.lbl}</span>
                <span style="font-size:.6rem;color:var(--t3);margin-left:5px">${t.desc}</span>
                ${
                  t.sub
                    ? `<div style="font-size:.57rem;color:var(--t3);margin-top:1px;
                         font-family:var(--mono)">${t.sub} €/kWh</div>`
                    : ""
                }
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-size:.78rem;font-weight:700;color:${t.col}">
                  ~${t.est.toFixed(0)}€<span style="font-size:.55rem;font-weight:400;
                  color:var(--t3)">/mês</span>
                </div>
              </div>
            </div>
            <div style="margin-top:4px;background:var(--b);border-radius:3px;height:4px;overflow:hidden">
              <div style="width:${Math.min((t.est / 60) * 100, 100)}%;height:100%;
                   background:${t.col};border-radius:3px"></div>
            </div>
          </div>`,
            )
            .join("")
        }
        <div style="font-size:.58rem;color:var(--t3);margin-top:2px">
          💡 Tri-horária mais económica para consumo concentrado fora de ponta · 
          Bi-horária ideal para uso nocturno · 
          Período actual destacado <span style="color:#10B981">●</span>
        </div>
      </div>`;

      loadElecTrend(false).catch(() => {});
    } catch (e) {
      $("elec-body").innerHTML = `${er(e.message)}
      <div style="margin-top:8px">
        <div style="font-size:.65rem;font-weight:700;color:var(--t2);margin-bottom:5px">Tarifas ERSE 2025-2026</div>
        ${[
          { l: "Simples", v: ELEC_TARIFAS.simples, c: "#3B82F6" },
          { l: "Vazio", v: ELEC_TARIFAS.vazio, c: "#10B981" },
          { l: "Fora Vazio", v: ELEC_TARIFAS.fvazio, c: "#F59E0B" },
          { l: "Tri Vazio", v: ELEC_TARIFAS.triVazio, c: "#10B981" },
          { l: "Tri Cheia", v: ELEC_TARIFAS.triCheia, c: "#F59E0B" },
          { l: "Tri Ponta", v: ELEC_TARIFAS.triPonta, c: "#EF4444" },
        ]
          .map(
            (r) => `<div class="bar-row"><span class="bar-rl">${r.l}</span>
          <div class="bar-bg"><div class="bar-fill"
            style="width:${Math.min((r.v / 0.3) * 100, 100)}%;background:${r.c}"></div></div>
          <span class="bar-rv">${r.v.toFixed(4)} €/kWh</span></div>`,
          )
          .join("")}
      </div>`;
    }
  }

  window.getElecTrendPref = getElecTrendPref;
  window.setElecTrendPref = setElecTrendPref;
  window.setElecTrendDays = setElecTrendDays;
  window.loadElecTrend = loadElecTrend;
  window.loadElec = loadElec;
})();

