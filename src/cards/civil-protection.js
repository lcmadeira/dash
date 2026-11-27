/* global $, CFG, IPMA_CITIES, lsGet, lsSet, fetchJsonFirstOk, er, notifyNonCriticalError, window */
/* Também: risco de amanhã (IPMA rcm-d1), ocorrências perto da cidade escolhida e pontos de calor (NASA FIRMS via gateway). */
/* Proteção Civil: ocorrências ativas (ANEPC via fogos.pt) e risco de incêndio por distrito (IPMA),
   ambos através da API Aberta (api.apiaberta.pt). */
(() => {
  const ANPC_BASE = "https://api.apiaberta.pt/v1/anpc";
  const RISK_LEVELS = {
    1: { label: "Reduzido", tone: "low" },
    2: { label: "Moderado", tone: "moderate" },
    3: { label: "Elevado", tone: "high" },
    4: { label: "Muito elevado", tone: "very-high" },
    5: { label: "Máximo", tone: "max" },
  };
  /* Cidades do cartão da meteorologia que não são capitais de distrito. */
  const CITY_DISTRICT = { Sines: "Setúbal" };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  /** Nível máximo de risco de incêndio por distrito, a partir dos valores por concelho.
   * @param {Array<object>} rows Linhas de /v1/anpc/risk.
   * @returns {Array<{district: string, level: number, municipalities: number}>}
   */
  function riskByDistrict(rows) {
    const by = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const level = Number(row?.level);
      if (!row?.district || !RISK_LEVELS[level]) return;
      const cur = by.get(row.district) || { district: row.district, level: 0, municipalities: 0 };
      cur.level = Math.max(cur.level, level);
      cur.municipalities += 1;
      by.set(row.district, cur);
    });
    return [...by.values()].sort((a, b) => b.level - a.level || a.district.localeCompare(b.district, "pt"));
  }

  /* Risco de incêndio do IPMA (RCM) por concelho: d0 = hoje, d1 = amanhã. O código do concelho (dico)
     começa pelo do distrito. Lido diretamente (CORS aberto); serve também de reserva ao risco de hoje. */
  const IPMA_RCM = d => `https://api.ipma.pt/open-data/forecast/meteorology/rcm/rcm-d${d}.json`;
  const DISTRICT_BY_CODE = {
    "01": "Aveiro", "02": "Beja", "03": "Braga", "04": "Bragança", "05": "Castelo Branco", "06": "Coimbra",
    "07": "Évora", "08": "Faro", "09": "Guarda", "10": "Leiria", "11": "Lisboa", "12": "Portalegre",
    "13": "Porto", "14": "Santarém", "15": "Setúbal", "16": "Viana do Castelo", "17": "Vila Real", "18": "Viseu",
  };
  /** Linhas {district, level} a partir do ficheiro rcm-dN.json do IPMA. */
  function ipmaRcmRows(json) {
    return Object.values(json?.local || {}).map((c) => ({
      district: DISTRICT_BY_CODE[String(c?.dico || "").slice(0, 2)],
      level: Number(c?.data?.rcm),
    })).filter((r) => r.district && RISK_LEVELS[r.level]);
  }
  async function getIpmaRcm(day, force) {
    const key = `anpc_rcm_d${day}_v1`;
    let data = force ? null : lsGet(key);
    if (data?.local) return data;
    data = await fetchJsonFirstOk(IPMA_RCM(day), {}, 10000, ["direct"], (j) => j && typeof j.local === "object");
    lsSet(key, data, { source: "IPMA · risco de incêndio (RCM)", state: "live", observedAt: data.fileDate ? Date.parse(data.fileDate.replace(" ", "T")) : undefined });
    return data;
  }

  /** Distância em km entre dois pontos (haversine). */
  function distanceKm(a, b) {
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
  }
  const NEAR_KM = 50;
  /** Ocorrências do distrito ou a menos de NEAR_KM da cidade, da mais próxima para a mais distante. */
  function nearbyIncidents(incidents, district, coords) {
    return (Array.isArray(incidents) ? incidents : []).map((i) => {
      const lat = Number(i?.location?.lat), lon = Number(i?.location?.lng);
      const km = coords && Number.isFinite(lat) && Number.isFinite(lon) ? distanceKm(coords, { lat, lon }) : null;
      return { ...i, km };
    }).filter((i) => i.location?.district === district || (i.km !== null && i.km <= NEAR_KM))
      .sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
  }

  /* Pontos de calor por satélite (NASA FIRMS, 24 h) através do gateway do painel. */
  async function getHotspots(force) {
    const key = "anpc_hotspots_v1";
    let data = force ? null : lsGet(key);
    if (Array.isArray(data?.points)) return data;
    const url = window.dataApiUrl?.("v1/hotspots");
    if (!url) return null;
    data = await fetchJsonFirstOk(url, {}, 12000, ["direct"], (j) => Array.isArray(j?.points));
    lsSet(key, data, { source: "NASA FIRMS (VIIRS) via gateway", state: "live", observedAt: data.ts });
    return data;
  }
  /** Resumo dos pontos de calor: total por região e os mais próximos da cidade. */
  function hotspotSummary(data, coords, now = Date.now()) {
    const points = (Array.isArray(data?.points) ? data.points : []).filter((p) => !p.at || now - p.at <= 26 * 3600e3);
    const byRegion = {};
    points.forEach((p) => { byRegion[p.region] = (byRegion[p.region] || 0) + 1; });
    const near = coords ? points.map((p) => ({ ...p, km: distanceKm(coords, { lat: p.lat, lon: p.lon }) }))
      .filter((p) => p.km <= NEAR_KM).sort((a, b) => a.km - b.km) : [];
    return { total: points.length, byRegion, near, sources: data?.sources || [] };
  }

  async function getJson(path, key, force, validate) {
    let data = force ? null : lsGet(key);
    if (data && validate(data)) return data;
    data = await fetchJsonFirstOk(`${ANPC_BASE}${path}`, {}, 10000, ["direct"], validate);
    lsSet(key, data, { source: "ANEPC / IPMA via API Aberta", state: "live", observedAt: data.as_of || undefined });
    return data;
  }

  async function loadCivilProtection(force = false) {
    const el = $("anpc-body");
    if (!el) return;
    try {
      const [active, risk, rcm0, rcm1, hot] = await Promise.all([
        getJson("/incidents/active", "anpc_active_v1", force, (j) => Array.isArray(j?.data)),
        getJson("/risk", "anpc_risk_v1", force, (j) => Array.isArray(j?.data)).catch(() => null),
        getIpmaRcm(0, force).catch(() => null),
        getIpmaRcm(1, force).catch(() => null),
        getHotspots(force).catch(() => null),
      ]);
      const incidents = active.data;
      const ground = incidents.reduce((sum, i) => sum + (Number(i?.resources?.ground) || 0), 0);
      const aerial = incidents.reduce((sum, i) => sum + (Number(i?.resources?.aerial) || 0), 0);
      // Hoje: API Aberta; se falhar, o ficheiro do IPMA (mesma origem dos dados).
      const districts = riskByDistrict(risk?.data?.length ? risk.data : ipmaRcmRows(rcm0));
      const tomorrow = new Map(riskByDistrict(ipmaRcmRows(rcm1)).map((d) => [d.district, d.level]));
      const tomorrowDate = rcm1?.dataPrev ? new Date(`${rcm1.dataPrev}T12:00:00`).toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short" }) : "amanhã";
      const cityId = CFG?.IPMA_CITY_ID;
      const cityName = IPMA_CITIES?.[cityId] || "";
      const myDistrict = CITY_DISTRICT[cityName] || cityName;
      const coords = window.AQ_CITY_COORDS?.[cityId] || null;
      const onIslands = cityName === "Funchal" || cityName === "Ponta Delgada";
      const mine = districts.find((d) => d.district === myDistrict);
      const mineTomorrow = tomorrow.get(myDistrict);
      const near = onIslands ? [] : nearbyIncidents(incidents, myDistrict, coords);
      const hs = hot ? hotspotSummary(hot, coords) : null;
      const asOf = active.as_of ? new Date(active.as_of).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) : "—";

      const item = (i) => `
            <div class="anpc-item">
              <div><b>${esc(i.type || "Ocorrência")}</b> <span class="anpc-muted">· ${esc(i.status || "")}</span>${i.km !== null && i.km !== undefined ? ` <span class="anpc-km">${window.nf(i.km, 0)} km</span>` : ""}</div>
              <div class="anpc-muted">${esc(i.location?.address || i.location?.district || "")}</div>
              <div class="anpc-res">${Number(i.resources?.ground) || 0} meios terrestres · ${Number(i.resources?.aerial) || 0} aéreos</div>
            </div>`;
      const nearIds = new Set(near.map((i) => i.id));
      const others = incidents.filter((i) => !nearIds.has(i.id))
        .sort((a, b) => ((Number(b.resources?.ground) || 0) + 5 * (Number(b.resources?.aerial) || 0)) - ((Number(a.resources?.ground) || 0) + 5 * (Number(a.resources?.aerial) || 0)));
      const placeLbl = esc(myDistrict || cityName || "a cidade escolhida");
      const nearBlock = onIslands
        ? `<div class="anpc-subtitle">Perto de ${esc(cityName)}</div><div class="anpc-muted">As ocorrências da ANEPC cobrem o continente; as ilhas têm proteção civil regional.</div>`
        : `<div class="anpc-subtitle">Perto de ${esc(cityName || placeLbl)} · distrito ou até ${NEAR_KM} km</div>
           ${near.length ? `<div class="anpc-list">${near.slice(0, 4).map(item).join("")}${near.length > 4 ? `<div class="anpc-muted">+${near.length - 4} ocorrências perto</div>` : ""}</div>`
             : `<div class="anpc-empty">Sem ocorrências ativas em ${placeLbl} nem a menos de ${NEAR_KM} km.</div>`}`;
      const othersBlock = others.length
        ? `<div class="anpc-subtitle">Resto do país · ${window.nfr(others.length)} ${others.length === 1 ? "ocorrência" : "ocorrências"} (mais meios primeiro)</div>
           <div class="anpc-list">${others.slice(0, 3).map(item).join("")}${others.length > 3 ? `<div class="anpc-muted">+${others.length - 3} ocorrências</div>` : ""}</div>`
        : "";
      const list = `${nearBlock}${othersBlock}`;

      const hotBlock = hs ? `<div class="anpc-subtitle">Pontos de calor por satélite · últimas 24 h
          <span class="help-tip" title="Deteções térmicas dos satélites VIIRS (NASA FIRMS). Incluem queimadas, fogos agrícolas e fontes industriais (ex.: refinarias); não confirmam um incêndio.">?</span></div>
        <div class="anpc-hot">
          <span><b>${window.nfr(hs.byRegion.continente || 0)}</b> continente</span>
          <span><b>${window.nfr((hs.byRegion.Madeira || 0) + (hs.byRegion["Açores"] || 0))}</b> ilhas</span>
          <span><b>${window.nfr(hs.near.length)}</b> a menos de ${NEAR_KM} km de ${esc(cityName || "—")}</span>
        </div>
        ${hs.near.length ? `<div class="anpc-muted">Mais próximo: ${window.nf(hs.near[0].km, 0)} km${hs.near[0].at ? ` · ${new Date(hs.near[0].at).toLocaleString("pt-PT", { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : ""}${hs.near[0].night ? " (de noite)" : ""} · <a href="https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${hs.near[0].lon},${hs.near[0].lat},11z" target="_blank" rel="noopener noreferrer">ver no mapa</a></div>` : ""}`
        : "";

      const riskGrid = districts.length
        ? `<div class="anpc-subtitle">Risco de incêndio por distrito · hoje${tomorrow.size ? ` <span class="anpc-muted">(→ ${esc(tomorrowDate)}, quando muda)</span>` : ""}</div>
           <div class="anpc-risk-grid">${districts.map((d) => `
             <div class="anpc-risk${d.district === myDistrict ? " is-mine" : ""}" data-tone="${RISK_LEVELS[d.level].tone}" title="${esc(d.district)}: hoje ${RISK_LEVELS[d.level].label}${tomorrow.has(d.district) ? `, ${esc(tomorrowDate)} ${RISK_LEVELS[tomorrow.get(d.district)].label}` : ""} (máximo por concelho)">
               <span>${esc(d.district)}</span><b>${window.nfr(d.level)}${tomorrow.has(d.district) && tomorrow.get(d.district) !== d.level ? `<i class="anpc-next" data-up="${tomorrow.get(d.district) > d.level}">→${window.nfr(tomorrow.get(d.district))}</i>` : ""}</b>
             </div>`).join("")}</div>
           <div class="anpc-legend">1 Reduzido · 2 Moderado · 3 Elevado · 4 Muito elevado · 5 Máximo</div>`
        : `<div class="anpc-muted">Risco de incêndio indisponível de momento.</div>`;

      el.innerHTML = `
        <div class="anpc-kpis">
          <div class="anpc-kpi"><b>${window.nfr(incidents.length)}</b><span>ocorrências ativas</span></div>
          <div class="anpc-kpi"><b>${window.nfr(ground)}</b><span>meios terrestres</span></div>
          <div class="anpc-kpi"><b>${window.nfr(aerial)}</b><span>meios aéreos</span></div>
          <div class="anpc-kpi" data-tone="${mine ? RISK_LEVELS[mine.level].tone : ""}"><b>${mine ? RISK_LEVELS[mine.level].label : "—"}</b><span>risco · ${esc(myDistrict || "distrito")}${mineTomorrow ? `<br>${esc(tomorrowDate)}: ${RISK_LEVELS[mineTomorrow].label.toLowerCase()}` : ""}</span></div>
        </div>
        ${window.nfr(list)}
        ${hotBlock}
        ${riskGrid}
        <div class="src">✦ ANEPC (fogos.pt) via <a href="https://apiaberta.pt/dados/protecao-civil" target="_blank" rel="noopener noreferrer">API Aberta</a> · ocorrências às ${window.nfr(asOf)} · risco: IPMA (hoje e amanhã), máximo por distrito${hs ? ` · pontos de calor: <a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noopener noreferrer">NASA FIRMS</a> (${esc(hs.sources.join(", "))})` : ""}</div>`;
    } catch (e) {
      el.innerHTML = er(e, { context: "Proteção Civil", action: "clique em ↺ para tentar novamente" });
      notifyNonCriticalError("Proteção Civil", e);
    }
  }

  window.loadCivilProtection = loadCivilProtection;
  window.riskByDistrict = riskByDistrict;
  window.ipmaRcmRows = ipmaRcmRows;
  window.nearbyIncidents = nearbyIncidents;
  window.hotspotSummary = hotspotSummary;
})();
