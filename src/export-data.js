/* Exportação: linhas de dados (CSV/JSON) a partir dos dados guardados de cada card.
   Cada linha: { section, card, indicator, value, unit, source, observedAt, origin }.
   origin = "dados" quando vem da cache do card; "texto do ecrã" quando é só o texto visível
   (cards sem extrator dedicado). Sem DOM nem localStorage aqui: o leitor de cache é injetado,
   para poder ser testado. */
(function () {
  "use strict";

  const DATA = "dados";
  const TEXT = "texto do ecrã";

  const num = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const isoDate = value => {
    if (value === null || value === undefined || value === "") return "";
    const t = typeof value === "number" ? value : Date.parse(value);
    return Number.isFinite(t) ? new Date(t).toISOString() : String(value);
  };
  const ymdLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  /* Um extrator por card: (ctx) => linhas sem section/card/origin (acrescentados depois). */
  const EXTRACTORS = {
    weather(ctx) {
      const cityId = ctx.cityId;
      const c = ctx.read(`ipma_${cityId}`);
      const day = c?.d?.data?.[0];
      if (!day) return [];
      const city = ctx.cityName || "Portugal";
      const at = c.d.dataUpdate || c.sourceTs;
      const src = `IPMA · ${city}`;
      return [
        ["Temperatura mínima prevista", num(day.tMin), "°C"],
        ["Temperatura máxima prevista", num(day.tMax), "°C"],
        ["Probabilidade de precipitação", num(day.precipitaProb), "%"],
      ].filter(r => r[1] !== null).map(([indicator, value, unit]) => ({ indicator: `${indicator} (${day.forecastDate || "hoje"})`, value, unit, source: src, observedAt: at }));
    },

    hol(ctx) {
      const today = ymdLocal(new Date(ctx.now));
      const year = new Date(ctx.now).getFullYear();
      const rows = [year, year + 1].flatMap(y => {
        const c = ctx.read(`hols_${y}`);
        return Array.isArray(c?.d) ? c.d : [];
      });
      return rows
        .filter(h => h?.date >= today && (h.global !== false) && !(h.types || []).includes("Optional"))
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .slice(0, 5)
        .map(h => ({ indicator: `Feriado nacional · ${h.localName || h.name || ""}`.trim(), value: h.date, unit: "data", source: "date.nager.at", observedAt: "" }));
    },

    fuel(ctx) {
      const out = [];
      const c = ctx.read("fuel");
      const names = { diesel: "Gasóleo simples", gasoline_95: "Gasolina simples 95", gasoline_98: "Gasolina 98", diesel_plus: "Gasóleo especial", lpg: "GPL Auto" };
      (Array.isArray(c?.d) ? c.d : []).forEach(row => {
        const price = num(row?.avg_price_eur);
        if (price === null || price <= 0) return;
        // A API traz o nome e, nos gases, a unidade no próprio nome ("GNC (…) €/kg").
        const rawName = String(row.fuel_name || names[row.fuel_slug] || row.fuel_slug);
        const unit = /€\/(kg|m³)\s*$/.exec(rawName)?.[0] || "€/L";
        const name = rawName.replace(/\s*€\/(kg|m³)\s*$/, "");
        out.push({ indicator: `${name} · média nacional (${num(row.station_count) ?? "?"} postos)`, value: price, unit, source: "DGEG via API Aberta", observedAt: row.updated_at || c.sourceTs });
      });
      const es = ctx.read("fuel_es");
      Object.entries(es?.d?.items || {}).forEach(([slug, item]) => {
        const price = num(item?.avg);
        if (price === null || price <= 0) return;
        out.push({ indicator: `${names[slug] || slug} · média Espanha`, value: price, unit: "€/L", source: "MITECO", observedAt: es.d.ts || es.sourceTs });
      });
      const ev = ctx.read("fuel_evora");
      if (Array.isArray(ev?.d?.stations) && typeof ctx.summarizeFuelEvora === "function") {
        const national = {};
        (Array.isArray(c?.d) ? c.d : []).forEach(row => { if (row?.fuel_slug) national[row.fuel_slug] = row; });
        const summary = ctx.summarizeFuelEvora(ev.d.stations, national) || {};
        Object.entries(summary).forEach(([key, s]) => {
          if (!s?.cheapest) return;
          const station = s.cheapest.stations?.[0]?.name || "";
          out.push({ indicator: `${names[key] || key} · mais barato em Évora${station ? ` (${station})` : ""}`, value: s.cheapest.price, unit: "€/L", source: "DGEG via API Aberta", observedAt: ev.d.observedAt || ev.sourceTs });
          if (num(s.avg) !== null) out.push({ indicator: `${names[key] || key} · média em Évora (${s.n} postos)`, value: Math.round(s.avg * 1000) / 1000, unit: "€/L", source: "DGEG via API Aberta", observedAt: ev.d.observedAt || ev.sourceTs });
        });
      }
      return out;
    },

    elec(ctx) {
      const c = ctx.read("elec_v3");
      const prices = (c?.d?.periods || []).map(p => num(p?.priceMwh)).filter(v => v !== null);
      if (!prices.length) return [];
      const avg = prices.reduce((a, v) => a + v, 0) / prices.length;
      const day = c.d.date || "";
      const src = "OMIE · zona portuguesa";
      return [
        [`Preço médio (${day})`, avg],
        [`Preço mínimo (${day})`, Math.min(...prices)],
        [`Preço máximo (${day})`, Math.max(...prices)],
      ].map(([indicator, value]) => ({ indicator, value: Math.round(value * 100) / 100, unit: "€/MWh", source: src, observedAt: day || c.sourceTs }));
    },

    euribor(ctx) {
      const c = ctx.read("euribor_live_v1");
      const at = num(c?.d?._observedAt) || c?.sourceTs;
      return (c?.d?.rates || []).filter(r => num(r?.val) !== null).map(r => ({ indicator: `Euribor ${r.term}`, value: num(r.val), unit: "%", source: c.d._source === "bce_live" ? "BCE" : "referência (EMMI)", observedAt: at }));
    },

    inf(ctx) {
      const c = ctx.read("inflation_eurostat_v2");
      const row = c?.d?.rows?.[0];
      if (!row) return [];
      const src = c.d.source === "eurostat_live" ? "Eurostat (IHPC)" : "referência (INE/Eurostat)";
      return [
        [`Inflação IHPC Portugal (${row.m})`, num(row.pt)],
        [`Inflação IHPC zona euro (${row.m})`, num(row.eu)],
      ].filter(r => r[1] !== null).map(([indicator, value]) => ({ indicator, value, unit: "%", source: src, observedAt: row.m }));
    },

    cabaz(ctx) {
      const rows = typeof ctx.cabaz === "function" ? ctx.cabaz() : [];
      if (!Array.isArray(rows) || !rows.length) return [];
      const [date, value] = rows[rows.length - 1];
      return [{ indicator: "Cabaz alimentar (63 produtos)", value: num(value), unit: "€", source: "DECO PROteste", observedAt: date }];
    },

    crypto(ctx) {
      const c = ctx.read("cg");
      const names = { bitcoin: "Bitcoin", ethereum: "Ethereum", solana: "Solana", cardano: "Cardano", ripple: "XRP", binancecoin: "BNB" };
      const src = c?.source || "CoinPaprika/CoinGecko";
      return Object.entries(c?.d || {}).filter(([id, q]) => id !== "_meta" && num(q?.eur) !== null).flatMap(([id, q]) => {
        const rows = [{ indicator: `${names[id] || id} · preço`, value: num(q.eur), unit: "€", source: src, observedAt: c.sourceTs }];
        if (num(q.eur_24h_change) !== null) rows.push({ indicator: `${names[id] || id} · variação 24 h`, value: Math.round(q.eur_24h_change * 100) / 100, unit: "%", source: src, observedAt: c.sourceTs });
        return rows;
      });
    },

    fx(ctx) {
      const c = ctx.read("fx");
      const rates = c?.d?.rates || {};
      return ["USD", "GBP", "CHF", "JPY", "BRL", "CNY", "CAD", "AUD"].filter(k => num(rates[k]) !== null)
        .map(k => ({ indicator: `EUR/${k}`, value: num(rates[k]), unit: k, source: c.source || "BCE (Frankfurter)", observedAt: c.d.date || c.sourceTs }));
    },
  };

  /**
   * Linhas de exportação para os cards pedidos.
   * @param {{id:string, name:string, section:string, text?:string}[]} cards
   * @param {{read:(key:string)=>({d:any, sourceTs?:number, source?:string}|null), now:number, cityId?:number, cityName?:string, summarizeFuelEvora?:Function, cabaz?:Function, statusOf?:(id:string)=>({source?:string, observedAt?:string}|null)}} ctx
   */
  function buildExportRows(cards, ctx) {
    const rows = [];
    cards.forEach(card => {
      let extracted = [];
      const extractor = EXTRACTORS[card.id];
      if (extractor) {
        try { extracted = extractor(ctx) || []; } catch { extracted = []; }
      }
      if (extracted.length) {
        extracted.forEach(r => rows.push({ section: card.section, card: card.name, indicator: r.indicator, value: r.value, unit: r.unit || "", source: r.source || "", observedAt: isoDate(r.observedAt), origin: DATA }));
        return;
      }
      const status = ctx.statusOf?.(card.id) || {};
      const text = String(card.text || "").replace(/\s+/g, " ").trim().slice(0, 600);
      rows.push({ section: card.section, card: card.name, indicator: "Conteúdo do card", value: text, unit: "", source: status.source || "", observedAt: status.observedAt || "", origin: TEXT });
    });
    return rows;
  }

  const CSV_COLUMNS = [
    ["section", "Secção"], ["card", "Card"], ["indicator", "Indicador"], ["value", "Valor"],
    ["unit", "Unidade"], ["source", "Fonte"], ["observedAt", "Data do dado"], ["origin", "Origem"],
  ];

  /** CSV para o Excel em português: separador ";", vírgula decimal, aspas, BOM UTF-8. */
  function toCsv(rows) {
    const cell = value => {
      let text = typeof value === "number" ? String(value).replace(".", ",") : String(value ?? "");
      // Evitar que o Excel interprete o texto como fórmula.
      if (/^[=+\-@]/.test(text) && typeof value !== "number") text = `'${text}`;
      return /[";\n\r]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const lines = [CSV_COLUMNS.map(([, label]) => label).join(";")];
    rows.forEach(row => lines.push(CSV_COLUMNS.map(([key]) => cell(row[key])).join(";")));
    return "﻿" + lines.join("\r\n") + "\r\n";
  }

  /** JSON com a mesma estrutura do CSV. */
  function toExportJson(rows, meta = {}) {
    return JSON.stringify({
      source: "Portugal hoje · https://lcmadeira.github.io/dash/",
      exportedAt: new Date(meta.now || Date.now()).toISOString(),
      note: "Valores indicativos; confirme na fonte oficial indicada em cada linha.",
      rows,
    }, null, 2);
  }

  window.buildExportRows = buildExportRows;
  window.exportRowsToCsv = toCsv;
  window.exportRowsToJson = toExportJson;
  window.EXPORT_EXTRACTORS = EXTRACTORS;
})();
