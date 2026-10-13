/* global CFG, $, skeletonKPIs, lsGet, lsSet, fetchJsonFirstOk, fetchViaLocalProxy, fetch, AbortSignal, er, notifyNonCriticalError, window */
(() => {
/* ══════════════════════════════════════════════════════════════
   QUALIDADE DO AR — Open-Meteo / Copernicus CAMS
   Endpoint CORS nativo · sem chave API
   Parâmetros: European AQI, PM2.5, PM10, NO2, O3, SO2, UV Index
   ══════════════════════════════════════════════════════════════ */

/* Coordenadas das cidades IPMA (coincidentes com CFG.IPMA_CITY_ID) */
const AQ_CITY_COORDS = {
  1010500: {lat:40.64, lon:-8.65, name:"Aveiro"},
  1020500: {lat:38.02, lon:-7.86, name:"Beja"},
  1030300: {lat:41.55, lon:-8.43, name:"Braga"},
  1030800: {lat:41.81, lon:-6.76, name:"Bragança"},
  1040200: {lat:39.82, lon:-7.49, name:"Castelo Branco"},
  1050200: {lat:40.20, lon:-8.41, name:"Coimbra"},
  1060300: {lat:38.57, lon:-7.91, name:"Évora"},
  1070500: {lat:37.02, lon:-7.93, name:"Faro"},
  1080500: {lat:40.54, lon:-7.27, name:"Guarda"},
  1100900: {lat:39.74, lon:-8.81, name:"Leiria"},
  1110600: {lat:38.72, lon:-9.14, name:"Lisboa"},
  1121400: {lat:39.30, lon:-7.44, name:"Portalegre"},
  1131200: {lat:41.15, lon:-8.61, name:"Porto"},
  1141600: {lat:39.24, lon:-8.69, name:"Santarém"},
  1151200: {lat:38.53, lon:-8.89, name:"Setúbal"},
  1151300: {lat:37.94, lon:-8.86, name:"Sines"},
  1160900: {lat:41.69, lon:-8.83, name:"Viana do Castelo"},
  1171400: {lat:41.30, lon:-7.74, name:"Vila Real"},
  1182300: {lat:40.66, lon:-7.91, name:"Viseu"},
  2310300: {lat:32.67, lon:-16.92, name:"Funchal"},
  2320100: {lat:37.74, lon:-25.68, name:"Ponta Delgada"},
};

/* Limites European AQI (EEA) */
const AQI_EU = [
  {max:20,  label:"Bom",          col:"#10B981", bg:"#10B98115", desc:"Qualidade excelente. Ideal para actividades ao ar livre."},
  {max:40,  label:"Razoável",     col:"#84CC16", bg:"#84CC1615", desc:"Qualidade aceitável. Grupos sensíveis podem sentir leve desconforto."},
  {max:60,  label:"Moderado",     col:"#F59E0B", bg:"#F59E0B15", desc:"Grupos sensíveis devem reduzir esforço prolongado ao ar livre."},
  {max:80,  label:"Mau",          col:"#F97316", bg:"#F9731615", desc:"Evitar exercício prolongado ao ar livre. Crianças e idosos em risco."},
  {max:100, label:"Muito mau",    col:"#EF4444", bg:"#EF444415", desc:"Evitar actividades ao ar livre. Manter janelas fechadas."},
  {max:999, label:"Extremamente mau", col:"#9B1C1C", bg:"#7F1D1D20", desc:"Permanecer no interior. Usar máscara FFP2 se sair."},
];

function aqiInfo(aqi) {
  return AQI_EU.find(a => aqi <= a.max) || AQI_EU[AQI_EU.length-1];
}

/* Indicadores com limiares EU */
const AQ_POLS = [
  {key:"pm2_5",  label:"PM2.5", unit:"µg/m³", good:10, mod:25, bad:50},
  {key:"pm10",   label:"PM10",  unit:"µg/m³", good:20, mod:50, bad:100},
  {key:"no2",    label:"NO₂",   unit:"µg/m³", good:40, mod:90, bad:230},
  {key:"o3",     label:"O₃",    unit:"µg/m³", good:50, mod:100, bad:240},
  {key:"so2",    label:"SO₂",   unit:"µg/m³", good:100, mod:200, bad:500},
  {key:"uv_index",label:"UV",   unit:"",      good:3, mod:6, bad:8},
];

function polColor(key, val) {
  const p = AQ_POLS.find(x => x.key === key);
  if (!p) return "var(--t2)";
  if (val <= p.good) return "#10B981";
  if (val <= p.mod)  return "#F59E0B";
  if (val <= p.bad)  return "#EF4444";
  return "#9B1C1C";
}

function polBarW(key, val) {
  const p = AQ_POLS.find(x => x.key === key);
  if (!p || !val) return 0;
  return Math.min(100, Math.round(val / p.bad * 100));
}

function estimateEuropeanAqiFromPols(pols) {
  /* Aproximação simples: mapear cada poluente para escala 0-100 e usar o pior caso. */
  function scoreFor(key, val) {
    const p = AQ_POLS.find(x => x.key === key);
    if (!p || val === null || val === undefined || !Number.isFinite(val)) return null;
    const v = Number(val);
    if (v <= p.good) return Math.round((v / p.good) * 20);
    if (v <= p.mod)  return Math.round(20 + ((v - p.good) / (p.mod - p.good)) * 40); // 20-60
    if (v <= p.bad)  return Math.round(60 + ((v - p.mod) / (p.bad - p.mod)) * 40);  // 60-100
    return 110;
  }
  const keys = ["pm2_5","pm10","no2","o3","so2"];
  const scores = keys.map(k => scoreFor(k, pols[k])).filter(s => s !== null && s !== undefined);
  if (!scores.length) return null;
  return Math.max(...scores);
}

async function loadAirQuality(force=false) {
  const el = $("aq-body");
  if (!el) return;
  el.innerHTML = skeletonKPIs(6);

  /* Coordenadas baseadas na cidade seleccionada */
  const cityId = CFG.IPMA_CITY_ID || 1060300;
  const coords = AQ_CITY_COORDS[cityId] || AQ_CITY_COORDS[1060300];
  const ck = `aq_v3_${cityId}`;

  let data = force ? null : lsGet(ck);

  if (!data) {
    try {
      /* Air Quality API — alguns parâmetros mudam/falham consoante o backend.
         Estratégia: tentar variantes (forecast_hours vs forecast_days, domains) e,
         em localhost, usar proxy local primeiro para evitar rate limits externos. */
      const base = `https://air-quality-api.open-meteo.com/v1/air-quality`
        + `?latitude=${coords.lat}&longitude=${coords.lon}`
        + `&timezone=Europe%2FLisbon`;

      const hourlySets = [
        "european_aqi,pm10,pm2_5,no2,o3,so2",
        "pm10,pm2_5,no2,o3,so2",
        "pm10,pm2_5",
      ];

      const variants = [];
      hourlySets.forEach(hs => {
        const b = `${base}&hourly=${encodeURIComponent(hs)}`;
        variants.push(`${b}&forecast_hours=24`);
        variants.push(`${b}&forecast_days=1`);
        variants.push(`${b}&forecast_hours=24&domains=cams_europe`);
        variants.push(`${b}&forecast_hours=24&domains=cams_global`);
      });

      async function tryFetchJson(url){
        return fetchJsonFirstOk(
          url,
          {},
          10000,
          ["local","direct"]
        );
      }

      let lastErr = null;
      for(const u of variants){
        try{
          data = await tryFetchJson(u);
          break;
        }catch(e){ lastErr = e; }
      }
      if(!data) throw new Error(`Open-Meteo AQ indisponível (${lastErr?.message||"tentativas esgotadas"})`);

      if (data.error) throw new Error(`Open-Meteo AQ: ${data.reason||data.error}`);

      /* UV Index: buscar da API forecast (mesmo endpoint que IPMA usa internamente) */
      try {
        const uvUrl = `https://api.open-meteo.com/v1/forecast`
          + `?latitude=${coords.lat}&longitude=${coords.lon}`
          + `&hourly=uv_index&forecast_days=1&timezone=Europe%2FLisbon`;
        let ru = null;
        try { ru = await fetchViaLocalProxy(uvUrl, {signal: AbortSignal.timeout(8000)}); } catch {}
        if(!ru || !ru.ok) ru = await fetch(uvUrl, {signal: AbortSignal.timeout(8000)});
        if (ru.ok) {
          const ju = await ru.json();
          if (ju.hourly?.uv_index) data._uv = ju.hourly.uv_index;
        }
      } catch {}

      lsSet(ck, data);
    } catch(e) {
      el.innerHTML = er(e, { context: "Qualidade do ar", action: "clique em ↺ para nova tentativa" });
      notifyNonCriticalError("Qualidade do ar", e, "clique em ↺ para nova tentativa");
      return;
    }
  }

  const hourly = data.hourly || {};
  const now = new Date();
  /* Determinar índice da hora actual no array hourly */
  const hh = now.getHours();
  /* O array começa à 00:00 do dia de hoje */
  const todayStr = now.toISOString().slice(0, 10);
  let hIdx = hh; /* Por omissão, índice = hora actual */
  if (hourly.time && hourly.time.length) {
    const found = hourly.time.findIndex(t => t && t.startsWith(todayStr + `T${String(hh).padStart(2,"0")}`));
    if (found >= 0) hIdx = found;
  }

  /* Valores actuais = hora do array */
  const polMapNow = {
    pm2_5: hourly.pm2_5?.[hIdx] ?? null,
    pm10:  hourly.pm10?.[hIdx]  ?? null,
    no2:   hourly.no2?.[hIdx]   ?? null,
    o3:    hourly.o3?.[hIdx]    ?? null,
    so2:   hourly.so2?.[hIdx]   ?? null,
  };

  const aqiLive = hourly.european_aqi?.[hIdx];
  const aqiEst = estimateEuropeanAqiFromPols(polMapNow);
  const aqiIsEstimated = !(aqiLive !== null && aqiLive !== undefined && Number.isFinite(aqiLive));
  const aqi = Math.round(aqiIsEstimated ? (aqiEst ?? 0) : aqiLive);
  const pm25   = polMapNow.pm2_5;
  const pm10   = polMapNow.pm10;
  const no2    = polMapNow.no2;
  const o3     = polMapNow.o3;
  const so2    = polMapNow.so2;
  const uv     = data._uv?.[hIdx]     ?? null;

  const info = aqiInfo(aqi);

  /* Atualizar badge no header */
  const badge = $("aq-aqi-badge");
  if (badge) {
    badge.textContent = `AQI ${aqiIsEstimated ? "~" : ""}${aqi} · ${info.label}`;
    badge.style.color = info.col;
    badge.style.borderColor = info.col + "44";
    badge.style.background = info.bg;
  }

  /* Previsão horária AQI (próximas 8h) — só mostrar quando existir série europeam_aqi real */
  const hasLiveAqiSeries = Array.isArray(hourly.european_aqi) && hourly.european_aqi.length > 0;
  const aqiHourly = hasLiveAqiSeries ? hourly.european_aqi : [];
  const aqiNext8 = hasLiveAqiSeries ? aqiHourly.slice(hIdx, hIdx + 8) : [];

  /* Poluentes disponíveis */
  const polMap = {pm2_5: pm25, pm10: pm10, no2: no2, o3: o3, so2: so2};
  const polsHtml = AQ_POLS.filter(p => p.key !== "uv_index").map(p => {
    const val = polMap[p.key];
    if (val === null || val === undefined) return "";
    const col = polColor(p.key, val);
    return `<div class="aqi-pol">
      <div class="aqi-pol-lbl">${p.label}</div>
      <div class="aqi-pol-val" style="color:${col}">${Math.round(val)}</div>
      <div class="aqi-pol-unit">${p.unit}</div>
    </div>`;
  }).join("");

  /* Barras */
  const barsHtml = AQ_POLS.filter(p => p.key !== "uv_index").map(p => {
    const val = polMap[p.key];
    if (val === null || val === undefined) return "";
    const col = polColor(p.key, val);
    const bw = polBarW(p.key, val);
    return `<div class="aqi-bar-row">
      <div class="aqi-bar-lbl">${p.label}</div>
      <div class="aqi-bar-bg"><div class="aqi-bar-fill" style="width:${bw}%;background:${col}"></div></div>
      <div class="aqi-bar-val" style="color:${col}">${Math.round(val)} ${p.unit}</div>
    </div>`;
  }).join("");

  /* Previsão horária */
  const fcHtml = aqiNext8.length ? aqiNext8.map((v, i) => {
    const h = (hh + i) % 24;
    const inf = aqiInfo(v || 0);
    return `<div class="aqi-fc-item">
      <div class="aqi-fc-hour">${String(h).padStart(2,"0")}h</div>
      <div class="aqi-fc-val" style="color:${inf.col}">${Math.round(v || 0)}</div>
    </div>`;
  }).join("") : "";

  /* UV */
  let uvLabel = null, uvCol = null;
  if (uv !== null && uv !== undefined && Number.isFinite(uv)) {
    uvLabel = uv <= 2 ? "Baixo" : uv <= 5 ? "Moderado" : uv <= 7 ? "Alto" : uv <= 10 ? "Muito alto" : "Extremo";
    uvCol = uv <= 2 ? "#10B981" : uv <= 5 ? "#F59E0B" : uv <= 7 ? "#F97316" : "#EF4444";
  }
  const uvLine = (uvLabel && uvCol) ? `<span style="font-size:.65rem;color:${uvCol};background:${uvCol}15;
      border-radius:4px;padding:2px 8px;border:1px solid ${uvCol}44">☀️ UV ${uv.toFixed(1)} · ${uvLabel}</span>` : "";

  const updTime = now.toLocaleTimeString("pt-PT", {hour:"2-digit", minute:"2-digit"});

  el.innerHTML = `
  <!-- Hero: AQI + cidade -->
  <div style="display:flex;align-items:center;gap:12px;background:${info.bg};
       border:1px solid ${info.col}33;border-radius:10px;padding:10px 14px;margin-bottom:10px">
    <div style="text-align:center;min-width:60px">
      <div style="font-size:2.6rem;font-weight:900;color:${info.col};
           line-height:1;letter-spacing:-2px">${aqi}</div>
      <div style="font-size:.58rem;color:${info.col};font-weight:700;
           text-transform:uppercase;letter-spacing:.3px;margin-top:1px">AQI EU${aqiIsEstimated ? " (est.)" : ""}
        <span class="help-tip" title="AQI Europeu (EEA): índice agregado da poluição; menor valor representa melhor qualidade do ar.">?</span>
      </div>
    </div>
    <div style="flex:1">
      <div style="font-size:.9rem;font-weight:700;color:${info.col}">
        ${info.label}
        ${aqiIsEstimated ? `<span style="font-family:var(--mono);font-size:.55rem;color:${info.col};background:${info.col}12;border:1px solid ${info.col}33;border-radius:999px;padding:1px 7px;margin-left:6px">est.</span>` : ""}
      </div>
      <div style="font-size:.65rem;color:var(--t2);margin-top:2px">${coords.name} · ${updTime}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:5px">
        ${uvLine}
      </div>
    </div>
    <!-- Escala AQI -->
    <div style="display:flex;flex-direction:column;gap:2px;font-family:var(--mono)">
      ${AQI_EU.map(a => `<div style="display:flex;align-items:center;gap:4px">
        <div style="width:8px;height:8px;border-radius:50%;background:${a.col};
             ${aqi <= a.max && (AQI_EU.indexOf(a) === 0 || aqi > AQI_EU[AQI_EU.indexOf(a)-1].max) ?
               "box-shadow:0 0 6px "+a.col : "opacity:.4"}"></div>
        <span style="font-size:.52rem;color:${aqi <= a.max && (AQI_EU.indexOf(a) === 0 || aqi > AQI_EU[AQI_EU.indexOf(a)-1].max) ?
          a.col : "var(--t3)"}">${a.max > 100 ? ">100" : "≤"+a.max}</span>
      </div>`).join("")}
    </div>
  </div>

  <!-- Grid de poluentes -->
  <div style="font-size:.63rem;font-weight:700;color:var(--t2);margin-bottom:5px">
    Poluentes actuais · µg/m³</div>
  <div class="aqi-grid">${polsHtml}</div>

  <!-- Barras -->
  <div class="aqi-bar-wrap">${barsHtml}</div>

  <!-- Previsão horária -->
  ${fcHtml ? `<div style="font-size:.63rem;font-weight:700;color:var(--t2);margin-bottom:5px">
    Próximas horas · AQI</div>
  <div class="aqi-forecast">${fcHtml}</div>` : ""}

  <!-- Conselho de saúde -->
  <div class="aqi-health" style="color:${info.col};border-color:${info.col}33;background:${info.bg}">
    💬 ${info.desc}
  </div>`;
}

  window.loadAirQuality = loadAirQuality;
})();
