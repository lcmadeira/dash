/* global document, window, console, localStorage */
/* Certificados de Aforro · Série F: taxa bruta mensal publicada pelo IGCP.
   Dados em data/aforro.json (scripts/update-aforro.mjs, cron do portátil: o IGCP não permite CORS).
   Compara com a Euribor 3M e a inflação que o painel já tem em cache. */
(() => {
  const CK = "aforro_v1";
  const CAP = 2.5;          // teto da taxa base da Série F (IGCP)
  const IRS = 0.28;         // taxa liberatória sobre juros
  const MON = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const MON_FULL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const pct = (v, d = 3) => `${window.nf(v, d)}%`;
  const monthLabel = (ym, full = false) => {
    const [y, m] = String(ym).split("-").map(Number);
    return `${(full ? MON_FULL : MON)[m - 1] || "?"}${full ? " de " : " "}${full ? y : String(y).slice(2)}`;
  };

  /** Resumo para o card: taxa atual, líquida, real e comparação com a Euribor 3M. */
  function aforroSummary(data, { euribor3m = null, inflation = null } = {}) {
    const latest = data?.latest;
    if (!latest || !Number.isFinite(latest.rate)) return null;
    const history = (Array.isArray(data.history) ? data.history : []).filter(r => Number.isFinite(r?.rate)).slice(0, 12);
    const prev = history.find(r => r.month < latest.month) || null;
    return {
      month: latest.month,
      rate: latest.rate,
      url: latest.url || "",
      atCap: latest.rate >= CAP - 1e-9,
      net: Math.round(latest.rate * (1 - IRS) * 1000) / 1000,
      change: prev ? Math.round((latest.rate - prev.rate) * 1000) / 1000 : null,
      real: inflation && Number.isFinite(inflation.value) ? Math.round((latest.rate * (1 - IRS) - inflation.value) * 100) / 100 : null,
      inflation,
      euribor3m,
      history: history.slice().reverse(),
    };
  }

  /** Último valor guardado, mesmo expirado (só para comparação; o card não depende dele). */
  function readAny(key) {
    try { return JSON.parse(localStorage.getItem((window.PFX || "") + key) || "null")?.d ?? null; } catch { return null; }
  }

  function readContext() {
    const ctx = {};
    try {
      const eur = readAny("euribor_live_v1");
      const r3 = (eur?.rates || []).find(r => r?.term === "3M");
      if (r3 && Number.isFinite(Number(r3.val))) ctx.euribor3m = Number(r3.val);
    } catch { /* opcional */ }
    try {
      const inf = readAny("inflation_eurostat_v2");
      const row = inf?.rows?.[0];
      if (row && Number.isFinite(Number(row.pt))) ctx.inflation = { value: Number(row.pt), month: row.m };
    } catch { /* opcional */ }
    return ctx;
  }

  function render(el, s) {
    const max = Math.max(CAP, ...s.history.map(h => h.rate));
    const bars = s.history.map(h => `<div class="afr-bar" title="${esc(monthLabel(h.month, true))}: ${pct(h.rate)}">
        <span style="height:${Math.max(4, Math.round(h.rate / max * 100))}%"></span><small>${esc(monthLabel(h.month).split(" ")[0])}</small></div>`).join("");
    const change = s.change === null ? "" : s.change === 0 ? "igual ao mês anterior" : `${s.change > 0 ? "▲" : "▼"} ${window.nf(Math.abs(s.change), 3)} pp vs mês anterior`;
    const rows = [
      ["Líquida de IRS (28%)", pct(s.net), "rendimento depois da retenção na fonte"],
      s.real !== null ? ["Real (líquida − inflação)", `${s.real > 0 ? "+" : ""}${window.nf(s.real, 2)} pp`, `inflação IHPC ${esc(s.inflation.month || "")}: ${pct(s.inflation.value, 1)}`] : null,
      s.euribor3m !== null ? ["Euribor 3M (média mensal)", pct(s.euribor3m), s.euribor3m > CAP ? "acima do teto: a taxa fica nos 2,5%" : "a taxa base acompanha-a, até 2,5%"] : null,
    ].filter(Boolean).map(([l, v, sub]) => `<div class="afr-row"><span>${l}<small>${sub}</small></span><b>${v}</b></div>`).join("");
    el.innerHTML = `
      <div class="afr-hero">
        <div><div class="afr-rate">${window.nf(s.rate, 3)}<span>%</span></div>
          <div class="afr-sub">taxa bruta · novas subscrições · ${esc(monthLabel(s.month, true))}</div>
          ${change ? `<div class="afr-sub">${change}</div>` : ""}</div>
        ${s.atCap ? `<span class="afr-cap" title="A taxa base da Série F tem um máximo de 2,5%">no teto de 2,5%</span>` : ""}
      </div>
      <div class="afr-rows">${rows}</div>
      ${s.history.length > 1 ? `<div class="afr-sec">Últimos ${s.history.length} meses</div><div class="afr-bars">${bars}</div>` : ""}
      <div class="afr-note">Juros pagos de 3 em 3 meses; a taxa de cada trimestre é a do mês em que começa. Ao longo dos anos acresce um prémio de permanência (ver a ficha do IGCP).</div>
      <div class="src">✦ <a href="${esc(s.url || "https://www.igcp.pt/pt/noticias")}" target="_blank" rel="noopener noreferrer">IGCP · taxa de ${esc(monthLabel(s.month, true))}</a> · Série F · Euribor e inflação dos cards do painel</div>`;
  }

  async function loadAforro(force = false) {
    const el = document.getElementById("aforro-body");
    if (!el) return;
    let data = force ? null : window.lsGet(CK);
    if (!data) {
      el.innerHTML = window.skeletonGeneric ? window.skeletonGeneric(3) : "";
      try {
        const url = new URL("data/aforro.json", window.location.href).href;
        data = await window.fetchJsonFirstOk(url, { cache: "no-cache" }, 15000, ["direct"], p => Number.isFinite(p?.latest?.rate));
        window.lsSet(CK, data, { source: data._meta?.source || "IGCP", state: "live", observedAt: data._meta?.observedAt });
      } catch (e) {
        const last = readAny(CK);
        if (!last) {
          el.innerHTML = window.er(e, { context: "Certificados de Aforro", action: "clique em ↺ para tentar novamente" });
          window.notifyNonCriticalError?.("Certificados de Aforro", e, "clique em ↺ para tentar novamente");
          return;
        }
        console.debug?.("Aforro: a usar a última cópia", e?.message || e);
        data = last;
      }
    }
    const s = aforroSummary(data, readContext());
    if (!s) { el.innerHTML = window.er(new Error("Sem taxa"), { context: "Certificados de Aforro" }); return; }
    render(el, s);
    window.refreshCardStatusFromCache?.("aforro", CK);
  }

  window.loadAforro = loadAforro;
  window.aforroSummary = aforroSummary;
})();
