/* global $, ld, window, fetchJsonFirstOk, lsGet, lsSet */
(() => {
/* ══════════════════════════════════════════════════════════════
   EMISSÕES CO2 — mix de produção elétrica (Eurostat nrg_cb_pem, mensal)
   Mix de Portugal nos últimos 12 meses publicados e intensidade carbónica ESTIMADA
   (fatores de emissão diretos por combustível; biomassa e renováveis = 0, por convenção;
   importações não contam). Valores fixos de 2024 como alternativa.
   ══════════════════════════════════════════════════════════════ */
const CO2_CACHE_KEY = "co2_eurostat_v1";
const EU27 = ["AT","BE","BG","CY","CZ","DE","DK","EE","EL","ES","FI","FR","HR","HU","IE","IT","LT","LU","LV","MT","NL","PL","PT","RO","SE","SI","SK"];
/* gCO2/kWh, emissões diretas de combustão (ordens de grandeza usuais para centrais térmicas) */
const CO2_FACTORS = { C0000: 950, G3000: 370, O4000XBIO: 750, CF_NR_OTH: 600, X9900: 600 };
const MIX_SOURCES = [
  { siec: "RA100", n: "Hídrica", f: 0, ico: "💧" },
  { siec: "RA300", n: "Eólica", f: 0, ico: "💨" },
  { siec: "RA400", n: "Solar", f: 0, ico: "☀️" },
  { siec: "CF_R", n: "Biomassa", f: 0, ico: "🌿" },
  { siec: "G3000", n: "Gás natural", f: 370, ico: "🔥" },
  { siec: "O4000XBIO", n: "Petróleo", f: 750, ico: "🛢️" },
  { siec: "C0000", n: "Carvão", f: 950, ico: "⚫" },
];
const COMPARE_GEOS = [["PT","PT"],["ES","ES"],["FR","FR"],["DE","DE"],["PL","PL"],["EU27_2020","UE"]];
const SIECS = ["TOTAL","RA000",...new Set([...MIX_SOURCES.map(s => s.siec), ...Object.keys(CO2_FACTORS)])];
const MONTHS_PT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const fmtYm = ym => { const [y, m] = String(ym).split("-"); return `${MONTHS_PT[Number(m) - 1] || "?"} ${y}`; };

function co2Url(now = new Date()) {
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 16, 1)).toISOString().slice(0, 7);
  return "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_cb_pem?format=JSON&lang=EN&unit=GWH"
    + `&sinceTimePeriod=${since}` + [...EU27, "EU27_2020"].map(g => `&geo=${g}`).join("") + SIECS.map(s => `&siec=${s}`).join("");
}

/** JSON-stat do Eurostat → modelo do card (mix de PT, intensidade estimada, ranking UE, comparação). */
function parseEurostatMix(json) {
  const dims = json?.id, size = json?.size, values = json?.value;
  if (!Array.isArray(dims) || !Array.isArray(size) || !values) return null;
  const idx = Object.fromEntries(dims.map(d => [d, json.dimension?.[d]?.category?.index || {}]));
  const stride = dims.map((_, i) => size.slice(i + 1).reduce((a, b) => a * b, 1));
  const val = (geo, siec, time) => {
    let pos = 0;
    for (const [i, d] of dims.entries()) {
      const key = d === "geo" ? geo : d === "siec" ? siec : d === "time" ? time : Object.keys(idx[d])[0];
      if (idx[d][key] === undefined) return null;
      pos += idx[d][key] * stride[i];
    }
    const v = values[String(pos)];
    return Number.isFinite(v) ? v : null;
  };
  const times = Object.keys(idx.time || {}).sort();
  const ptMonths = times.filter(t => val("PT", "TOTAL", t) > 0);
  if (ptMonths.length < 12) return null;
  const window12 = ptMonths.slice(-12);
  const sumOver = (geo, siec, months) => months.reduce((a, t) => a + (val(geo, siec, t) || 0), 0);
  const intensityOf = geo => {
    const months = window12.filter(t => val(geo, "TOTAL", t) > 0);
    if (months.length < 10) return null;
    const total = sumOver(geo, "TOTAL", months);
    const emissions = Object.entries(CO2_FACTORS).reduce((a, [siec, f]) => a + sumOver(geo, siec, months) * f, 0);
    return total > 0 ? emissions / total : null;
  };
  const total = sumOver("PT", "TOTAL", window12);
  const mix = MIX_SOURCES.map(s => ({ n: s.n, f: s.f, ico: s.ico, v: sumOver("PT", s.siec, window12) / total * 100 }));
  const other = 100 - mix.reduce((a, x) => a + x.v, 0);
  // "Outras" junta geotermia (renovável) e outros combustíveis: sem um fator único para mostrar.
  if (other > 0.05) mix.push({ n: "Outras", f: null, ico: "🔌", v: other });
  const ranked = EU27.map(g => [g, intensityOf(g)]).filter(([, v]) => v !== null).sort((a, b) => a[1] - b[1]);
  const rank = ranked.findIndex(([g]) => g === "PT") + 1;
  const intensity = intensityOf("PT");
  if (!(intensity >= 0) || !rank) return null;
  return {
    period: { from: window12[0], to: window12.at(-1) },
    mix: mix.filter(x => x.v >= 0.05).sort((a, b) => b.v - a.v),
    intensity,
    renPct: sumOver("PT", "RA000", window12) / total * 100,
    rank, rankOf: ranked.length,
    compare: COMPARE_GEOS.map(([geo, n]) => ({ n, v: intensityOf(geo), hl: geo === "PT" })).filter(x => x.v !== null),
    updated: json.updated || null,
    live: true,
  };
}

/* Alternativa fixa: PT 2024 (DGEG/REN, relatório anual) e comparação 2023. */
function staticModel() {
  const mix = [
    { n: "Hídrica", v: 33.4, f: 0, ico: "💧" }, { n: "Eólica", v: 28.1, f: 0, ico: "💨" },
    { n: "Gás natural", v: 13.8, f: 370, ico: "🔥" }, { n: "Solar", v: 12.3, f: 0, ico: "☀️" },
    { n: "Biomassa", v: 6.1, f: 230, ico: "🌿" }, { n: "Cogeração", v: 4.2, f: 400, ico: "⚙️" },
    { n: "Outros/Import", v: 2.1, f: 200, ico: "🔌" },
  ];
  const total = mix.reduce((a, b) => a + b.v, 0);
  return {
    period: null,
    mix: mix.map(x => ({ ...x, v: x.v / total * 100 })),
    intensity: mix.reduce((a, b) => a + b.f * b.v / total, 0),
    renPct: mix.filter(x => x.f === 0).reduce((a, b) => a + b.v, 0) / total * 100,
    rank: null, rankOf: null,
    compare: [{ n: "PT", v: 52, hl: true }, { n: "ES", v: 118 }, { n: "FR", v: 56 }, { n: "DE", v: 380 }, { n: "PL", v: 680 }, { n: "UE", v: 255 }],
    live: false,
  };
}

function renderCO2(el, m) {
  const label = m.live ? `${fmtYm(m.period.from)}–${fmtYm(m.period.to)}` : "2024";
  const maxCO2 = Math.max(...m.compare.map(x => x.v), 1);
  const tip = m.live
    ? "Estimativa: produção de cada combustível × fator de emissão direto (gás 370, petróleo 750, carvão 950, outros 600 g/kWh); biomassa e renováveis contam 0; importações não entram."
    : "Gramas de CO2 por kWh produzido (referência fixa de 2024).";
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
      <div style="background:var(--b2);border-radius:8px;padding:8px;text-align:center">
        <div style="font-size:1.6rem;font-weight:800;color:var(--text)">${Math.round(m.intensity)}</div>
        <div style="font-size:.74rem;color:var(--t2)">gCO₂/kWh <span class="help-tip" title="${tip}">?</span></div>
        <div style="font-size:.74rem;color:var(--t3)">${m.live ? "estimativa · 12 meses" : "média 2024"}</div>
      </div>
      <div style="background:var(--b2);border-radius:8px;padding:8px;text-align:center">
        <div style="font-size:1.6rem;font-weight:800;color:var(--text)">${window.nf(m.renPct, 0)}%</div>
        <div style="font-size:.74rem;color:var(--t2)">Renováveis</div>
        <div style="font-size:.74rem;color:var(--t3)">${m.live ? "da produção · 12 meses" : "mix 2024"}</div>
      </div>
      <div style="background:var(--b2);border-radius:8px;padding:8px;text-align:center">
        <div style="font-size:1.6rem;font-weight:800;color:var(--text)">${m.rank ? `${m.rank}.º` : "—"}</div>
        <div style="font-size:.74rem;color:var(--t2)">Ranking UE</div>
        <div style="font-size:.74rem;color:var(--t3)">${m.rank ? `menos CO₂ (de ${m.rankOf})` : "sem dados"}</div>
      </div>
    </div>
    <div style="font-size:.74rem;font-weight:600;color:var(--t2);margin-bottom:6px">Produção elétrica por fonte · Portugal · ${label}</div>
    ${m.mix.map(x => {
      const fcCol = x.f === null ? "var(--t3)" : x.f === 0 ? "#10B981" : x.f < 300 ? "#84CC16" : x.f < 450 ? "#F59E0B" : "#EF4444";
      return `<div style="display:flex;align-items:center;gap:7px;margin:4px 0">
        <div style="font-size:.8rem;width:18px">${x.ico}</div>
        <div style="font-size:.74rem;color:var(--t2);width:90px;white-space:nowrap;overflow:hidden">${x.n}</div>
        <div style="flex:1;background:var(--b2);border-radius:3px;height:7px">
          <div style="width:${x.v.toFixed(1)}%;height:100%;background:var(--data);border-radius:3px"></div>
        </div>
        <div style="font-size:.74rem;color:var(--text);font-weight:600;width:36px;text-align:right">${window.nf(x.v, 1)}%</div>
        <div style="font-size:.74rem;color:${fcCol};width:38px;text-align:right">${x.f === null ? "—" : `${x.f}g`}</div>
      </div>`;
    }).join("")}
    <div style="font-size:.74rem;font-weight:600;color:var(--t2);margin:10px 0 5px">Intensidade carbónica · comparação UE (${m.live ? `estimativa, ${label}` : "2023"})</div>
    ${m.compare.map(x => `<div style="display:flex;align-items:center;gap:7px;margin:3px 0">
      <div style="font-size:.74rem;${x.hl ? "font-weight:700;color:var(--text)" : "color:var(--t2)"};width:24px">${x.n}</div>
      <div style="flex:1;background:var(--b2);border-radius:3px;height:6px">
        <div style="width:${(x.v / maxCO2 * 100).toFixed(0)}%;height:100%;background:${x.hl ? "var(--accent)" : "var(--data-muted)"};border-radius:3px"></div>
      </div>
      <div style="font-size:.74rem;${x.hl ? "font-weight:700;color:var(--text)" : "color:var(--t2)"};width:48px;text-align:right">${Math.round(x.v)} g</div>
    </div>`).join("")}`;
  const src = document.getElementById("co2Src");
  if (src) src.textContent = m.live
    ? `✦ Eurostat · produção elétrica mensal (nrg_cb_pem) · ${label} · intensidade estimada por fatores de emissão`
    : "✦ DGEG · REN Relatório Anual 2024 · valores fixos (Eurostat indisponível)";
}

async function loadCO2(force = false) {
  const el = $("co2-body"); if (!el) return;
  const cached = force ? null : lsGet(CO2_CACHE_KEY);
  if (cached?.live) { renderCO2(el, cached); window.refreshCardStatusFromCache?.("co2", CO2_CACHE_KEY); return; }
  el.innerHTML = ld();
  let model = null;
  try {
    const json = await fetchJsonFirstOk(co2Url(), {}, 20000, ["direct"], j => Boolean(j?.value && j?.dimension));
    model = parseEurostatMix(json);
    if (model) lsSet(CO2_CACHE_KEY, model, { source: "Eurostat · nrg_cb_pem", state: "live",
      observedAt: Date.parse(`${model.period.to}-15T12:00:00Z`) });
  } catch (error) {
    console.debug?.("CO2: Eurostat indisponível; valores fixos de 2024", error?.message || error);
  }
  renderCO2(el, model || staticModel());
  window.refreshCardStatusFromCache?.("co2", CO2_CACHE_KEY);
}

window.loadCO2 = loadCO2;
window.parseEurostatMix = parseEurostatMix;
})();
