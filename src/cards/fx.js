/* global AbortSignal, $, PFX, _lastN, _setOnByDataAttr, addToHistory, console, document, er, fetch, fetchJsonFirstOk, getHistory, localStorage, lsGet, lsSet, notifyNonCriticalError, renderTrendChart, skeletonKPIs, window */
(() => {
/* ── Câmbio EUR — Frankfurter API (BCE) ── */
const FX_PAIRS=[
  {code:"USD",name:"Dólar EUA",       flag:"🇺🇸",color:"var(--blue)"},
  {code:"GBP",name:"Libra Esterlina", flag:"🇬🇧",color:"var(--purple)"},
  {code:"CHF",name:"Franco Suíço",    flag:"🇨🇭",color:"var(--red)"},
  {code:"JPY",name:"Iene Japonês",    flag:"🇯🇵",color:"var(--accent)"},
  {code:"BRL",name:"Real Brasileiro", flag:"🇧🇷",color:"var(--green)"},
  {code:"CNY",name:"Yuan Chinês",     flag:"🇨🇳",color:"#EF5757"},
  {code:"AED",name:"Dirham EAU",      flag:"🇦🇪",color:"var(--orange)"},
  {code:"CAD",name:"Dólar Canadiano", flag:"🇨🇦",color:"var(--cyan)"},
];
let fxRates={};
function isValidFXData(data){
  if(!data || typeof data !== "object" || !data.rates ||
     typeof data.rates !== "object" || Array.isArray(data.rates) ||
     (data.date !== "" && (typeof data.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.date))))
    return false;
  let supportedRates = 0;
  for(const pair of FX_PAIRS){
    const rate = data.rates[pair.code];
    if(rate === undefined || rate === null) continue;
    if(typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return false;
    supportedRates++;
  }
  return supportedRates > 0;
}
async function loadFX(force=false){
  $("fx-body").innerHTML=skeletonKPIs(6);
  try{
    let data = force ? null : lsGet("fx");
    if(!isValidFXData(data)) data = null;
    if (!data) {
      try {
        const j = await fetchJsonFirstOk("https://api.frankfurter.dev/v1/latest?base=EUR", {}, 6000);
        data = { rates: j.rates, date: j.date };
        if(!isValidFXData(data)) throw new Error("Resposta Frankfurter inválida");
      } catch (e) {
        console.warn("⚠️ Frankfurter falhou, a tentar fallback:", e.message);
        try {
          const j2 = await fetchJsonFirstOk("https://open.er-api.com/v6/latest/EUR", {}, 8000);
          data = { rates: j2.rates, date: "" };
          if(!isValidFXData(data)) throw new Error("Resposta de fallback inválida");
        } catch (_e2) {
          throw new Error("Câmbio indisponível");
        }
      }
      if (data) lsSet("fx", data);
    }
    fxRates=data.rates||{};
    renderFX(data.date);
  }catch(e){$("fx-body").innerHTML=er(e,{context:"Câmbio EUR",action:"clique em ↺ para recarregar as taxas"});notifyNonCriticalError("Câmbio EUR",e,"clique em ↺ para recarregar as taxas");}
}
function renderFX(date){
  const amt=parseFloat($("fx-amount")?.value||1)||1;
  if(!Object.keys(fxRates).length)return;
  $("fx-body").innerHTML=`<div class="fx-grid">${FX_PAIRS.map(p=>{
    const rate=fxRates[p.code];if(!rate)return"";
    const conv=(rate*amt);
    const decimals=p.code==="JPY"?0:4;
    return`<div class="fx-item">
      <div class="fx-flag">${p.flag}</div>
      <div class="fx-info">
        <div class="fx-pair">EUR → ${p.code}</div>
        <div class="fx-rate" style="color:${p.color}">${conv.toLocaleString("pt-PT",{minimumFractionDigits:decimals,maximumFractionDigits:decimals})} <span style="font-size:.62rem;color:var(--t2)">${p.code}</span></div>
        <div style="font-family:var(--mono);font-size:.54rem;color:var(--t3)">1 EUR = ${rate.toFixed(p.code==="JPY"?2:4)}</div>
      </div>
    </div>`;
  }).join("")}</div>

  <div style="margin-top:10px;background:var(--surface);border:1px solid var(--b);border-radius:var(--rs);padding:8px 10px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px">
      <div id="fxTrendStatus" style="flex:1;min-width:0"></div>
      <div id="fxTrendDays" style="display:flex;gap:4px;flex-shrink:0">
        <button class="rbtn" data-days="7"  onclick="setFXTrendDays(7)">7D</button>
        <button class="rbtn on" data-days="30" onclick="setFXTrendDays(30)">30D</button>
        <button class="rbtn" data-days="90" onclick="setFXTrendDays(90)">90D</button>
      </div>
      <div id="fxTrendPairs" style="display:flex;gap:4px;flex-shrink:0">
        <button class="rbtn on" data-code="USD" onclick="setFXTrendCode('USD')">USD</button>
        <button class="rbtn" data-code="GBP" onclick="setFXTrendCode('GBP')">GBP</button>
      </div>
    </div>
    <div style="height:120px">
      <canvas id="fxTrendCanvas"></canvas>
    </div>
  </div>

  <div class="src">✦ BCE · ${date||""} · Frankfurter API · Taxa oficial de referência</div>`;

  try{
    FX_PAIRS.forEach(p=>{
      const rate = Number(fxRates?.[p.code]);
      if (Number.isFinite(rate) && rate > 0) addToHistory(`fx_${p.code}`, rate);
    });
  }catch{}

  loadFXTrend(false).catch(()=>{});
}

const FX_TREND_PREF_KEY = 'fx_trend_pref_v1';
function getFXTrendPref() {
  try {
    const raw = localStorage.getItem(PFX + FX_TREND_PREF_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const code = ['USD', 'GBP'].includes(parsed?.code) ? parsed.code : 'USD';
    const days = [7, 30, 90].includes(parsed?.days) ? parsed.days : 30;
    return { code, days };
  } catch {
    return { code: 'USD', days: 30 };
  }
}
function setFXTrendPref(patch) {
  const cur = getFXTrendPref();
  const next = { ...cur, ...patch };
  try { localStorage.setItem(PFX + FX_TREND_PREF_KEY, JSON.stringify(next)); } catch {}
  return next;
}
function setFXTrendDays(days) {
  setFXTrendPref({ days: [7, 30, 90].includes(days) ? days : 30 });
  loadFXTrend(false).catch(() => {});
}
function setFXTrendCode(code) {
  setFXTrendPref({ code: ['USD', 'GBP'].includes(code) ? code : 'USD' });
  loadFXTrend(false).catch(() => {});
}

async function loadFXTrend(force = false) {
  const canvas = document.getElementById('fxTrendCanvas');
  const statusEl = document.getElementById('fxTrendStatus');
  const daysEl = document.getElementById('fxTrendDays');
  const pairsEl = document.getElementById('fxTrendPairs');
  if (!canvas || !statusEl || !daysEl || !pairsEl) return;

  const pref = getFXTrendPref();
  _setOnByDataAttr(daysEl, 'data-days', pref.days);
  _setOnByDataAttr(pairsEl, 'data-code', pref.code);
  statusEl.textContent = 'A carregar histórico...';

  const cacheKey = `hist_fx_${pref.code}_90`;
  try {
    let series = (!force) ? lsGet(cacheKey) : null;
    if(!isValidFXSeries(series)) series = null;
    if (!series) {
      const end = new Date();
      const start = new Date(end.getTime() - (90 - 1) * 864e5);
      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);
      const url = `https://api.frankfurter.dev/v1/${startStr}..${endStr}?from=EUR&to=${encodeURIComponent(pref.code)}`;

      let json = null;
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(9000) });
        if (r.ok) json = await r.json();
      } catch {}
      if (!json?.rates) throw new Error('Frankfurter indisponível');

      const out = Object.entries(json.rates)
        .map(([date, obj]) => {
          const value = Number(obj?.[pref.code] ?? obj);
          return { date, timestamp: Date.parse(date), value };
        })
        .filter(x => x.date && Number.isFinite(x.value))
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      if (!isValidFXSeries(out)) throw new Error('Histórico insuficiente');
      series = out;
      lsSet(cacheKey, series);
    }

    const view = _lastN(series, pref.days);
    if (view.length < 2) throw new Error('Histórico insuficiente');

    const first = view[0]?.value || 0;
    const last = view[view.length - 1]?.value || 0;
    const pct = first > 0 ? ((last - first) / first) * 100 : 0;
    const sign = pct > 0 ? '+' : '';

    const col = pref.code === 'GBP' ? 'var(--purple)' : 'var(--blue)';
    renderTrendChart(canvas, view, {
      label: `EUR→${pref.code}`,
      borderColor: col,
      backgroundColor: (pref.code === 'GBP') ? 'rgba(149,117,240,0.10)' : 'rgba(75,150,243,0.10)',
      unit: ` ${pref.code}`,
      decimals: pref.code === 'JPY' ? 2 : 4
    });

    statusEl.innerHTML = `
      <span style="font-family:var(--mono);font-size:.56rem;color:var(--t3);text-transform:uppercase;letter-spacing:.5px">
        ${pref.days}D · EUR→${pref.code}
      </span>
      <span style="font-family:var(--mono);font-size:.56rem;color:${pct >= 0 ? 'var(--green)' : 'var(--red)'};margin-left:8px">
        ${sign}${pct.toFixed(1)}%
      </span>
      <span style="font-family:var(--mono);font-size:.56rem;color:var(--t3);margin-left:8px">
        último: ${last.toFixed(pref.code === 'JPY' ? 2 : 4)}
      </span>`;
  } catch (e) {
    try {
      const local = getHistory(`fx_${pref.code}`, 90)
        .map(h => ({ date: h.date, timestamp: h.timestamp || Date.parse(h.date), value: Number(h.value) }))
        .filter(x => Number.isFinite(x.value))
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      const view = _lastN(local, pref.days);
      if (view.length >= 2) {
        renderTrendChart(canvas, view, {
          label: `EUR→${pref.code}`,
          borderColor: pref.code === 'GBP' ? 'var(--purple)' : 'var(--blue)',
          backgroundColor: (pref.code === 'GBP') ? 'rgba(149,117,240,0.10)' : 'rgba(75,150,243,0.10)',
          unit: ` ${pref.code}`,
          decimals: pref.code === 'JPY' ? 2 : 4
        });
        statusEl.textContent = `${pref.days}D · histórico local (sem Frankfurter)`;
        return;
      }
    } catch {}
    statusEl.textContent = (e && e.message) ? e.message : 'Histórico indisponível';
  }
}

function isValidFXSeries(series){
  return Array.isArray(series) && series.length >= 10 && series.every(point =>
    point && typeof point.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(point.date) &&
    Number.isFinite(Date.parse(point.date)) && Number.isFinite(point.value) && point.value > 0);
}


window.loadFX = loadFX;
window.renderFX = renderFX;
window.setFXTrendDays = setFXTrendDays;
window.setFXTrendCode = setFXTrendCode;
})();
