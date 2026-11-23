/* global $, CFG, IPMA_CITIES, lsGet, lsSet, fetchJsonFirstOk, er, notifyNonCriticalError, window */
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
      const [active, risk] = await Promise.all([
        getJson("/incidents/active", "anpc_active_v1", force, (j) => Array.isArray(j?.data)),
        getJson("/risk", "anpc_risk_v1", force, (j) => Array.isArray(j?.data)).catch(() => null),
      ]);
      const incidents = active.data;
      const ground = incidents.reduce((sum, i) => sum + (Number(i?.resources?.ground) || 0), 0);
      const aerial = incidents.reduce((sum, i) => sum + (Number(i?.resources?.aerial) || 0), 0);
      const districts = riskByDistrict(risk?.data);
      const cityName = IPMA_CITIES?.[CFG?.IPMA_CITY_ID] || "";
      const myDistrict = CITY_DISTRICT[cityName] || cityName;
      const mine = districts.find((d) => d.district === myDistrict);
      const asOf = active.as_of ? new Date(active.as_of).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) : "—";

      const list = incidents.length
        ? `<div class="anpc-list">${incidents.slice(0, 6).map((i) => `
            <div class="anpc-item">
              <div><b>${esc(i.type || "Ocorrência")}</b> <span class="anpc-muted">· ${esc(i.status || "")}</span></div>
              <div class="anpc-muted">${esc(i.location?.address || i.location?.district || "")}</div>
              <div class="anpc-res">${Number(i.resources?.ground) || 0} meios terrestres · ${Number(i.resources?.aerial) || 0} aéreos</div>
            </div>`).join("")}
            ${incidents.length > 6 ? `<div class="anpc-muted">+${incidents.length - 6} ocorrências</div>` : ""}</div>`
        : `<div class="anpc-empty">Sem ocorrências ativas neste momento.</div>`;

      const riskGrid = districts.length
        ? `<div class="anpc-subtitle">Risco de incêndio por distrito · ${risk?.date === "today" ? "hoje" : esc(risk?.target_date || risk?.date || "")}</div>
           <div class="anpc-risk-grid">${districts.map((d) => `
             <div class="anpc-risk${d.district === myDistrict ? " is-mine" : ""}" data-tone="${RISK_LEVELS[d.level].tone}" title="${esc(d.district)}: ${RISK_LEVELS[d.level].label} (máximo em ${window.nfr(d.municipalities)} concelhos)">
               <span>${esc(d.district)}</span><b>${window.nfr(d.level)}</b>
             </div>`).join("")}</div>
           <div class="anpc-legend">1 Reduzido · 2 Moderado · 3 Elevado · 4 Muito elevado · 5 Máximo</div>`
        : `<div class="anpc-muted">Risco de incêndio indisponível de momento.</div>`;

      el.innerHTML = `
        <div class="anpc-kpis">
          <div class="anpc-kpi"><b>${window.nfr(incidents.length)}</b><span>ocorrências ativas</span></div>
          <div class="anpc-kpi"><b>${window.nfr(ground)}</b><span>meios terrestres</span></div>
          <div class="anpc-kpi"><b>${window.nfr(aerial)}</b><span>meios aéreos</span></div>
          <div class="anpc-kpi" data-tone="${mine ? RISK_LEVELS[mine.level].tone : ""}"><b>${mine ? RISK_LEVELS[mine.level].label : "—"}</b><span>risco · ${esc(myDistrict || "distrito")}</span></div>
        </div>
        ${window.nfr(list)}
        ${riskGrid}
        <div class="src">✦ ANEPC (fogos.pt) e IPMA via <a href="https://apiaberta.pt/dados/protecao-civil" target="_blank" rel="noopener noreferrer">API Aberta</a> · ocorrências às ${window.nfr(asOf)} · risco por concelho, máximo por distrito</div>`;
    } catch (e) {
      el.innerHTML = er(e, { context: "Proteção Civil", action: "clique em ↺ para tentar novamente" });
      notifyNonCriticalError("Proteção Civil", e);
    }
  }

  window.loadCivilProtection = loadCivilProtection;
  window.riskByDistrict = riskByDistrict;
})();
