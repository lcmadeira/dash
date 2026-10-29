/* global AbortSignal, $, PFX, _lastN, _setOnByDataAttr, addToHistory, chg, document, er, fetchFirstOk, fetchJsonFirstOk, fmtP, localStorage, lsGet, lsSet, notifyNonCriticalError, renderTrendChart, skeletonKPIs, window */
(() => {
/* ── CoinGecko Crypto ── */
const CRYPTO_IDS=[
  {id:"bitcoin",    name:"Bitcoin",  sym:"BTC",color:"#E9A520"},
  {id:"ethereum",   name:"Ethereum", sym:"ETH",color:"#9575F0"},
  {id:"solana",     name:"Solana",   sym:"SOL",color:"#34C97A"},
  {id:"cardano",    name:"Cardano",  sym:"ADA",color:"#4B96F3"},
  {id:"ripple",     name:"XRP",      sym:"XRP",color:"#22D3EE"},
  {id:"binancecoin",name:"BNB",      sym:"BNB",color:"#F59E0B"},
];

const CRYPTO_TREND_PREF_KEY = 'crypto_trend_pref_v1';
const CRYPTO_TREND_COINS = ['bitcoin', 'ethereum'];
function getCryptoTrendPref() {
  try {
    const raw = localStorage.getItem(PFX + CRYPTO_TREND_PREF_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const coinId = CRYPTO_TREND_COINS.includes(parsed?.coinId) ? parsed.coinId : 'bitcoin';
    const days = [7, 30, 90].includes(parsed?.days) ? parsed.days : 30;
    return { coinId, days };
  } catch {
    return { coinId: 'bitcoin', days: 30 };
  }
}
function setCryptoTrendPref(patch) {
  const cur = getCryptoTrendPref();
  const next = { ...cur, ...patch };
  try { localStorage.setItem(PFX + CRYPTO_TREND_PREF_KEY, JSON.stringify(next)); } catch {}
  return next;
}
function setCryptoTrendDays(days) {
  const next = setCryptoTrendPref({ days: [7, 30, 90].includes(days) ? days : 30 });
  loadCryptoTrend(false).catch(() => {});
  return next;
}
function setCryptoTrendCoin(coinId) {
  const next = setCryptoTrendPref({ coinId: CRYPTO_TREND_COINS.includes(coinId) ? coinId : 'bitcoin' });
  loadCryptoTrend(false).catch(() => {});
  return next;
}

function _cgDailyFromPrices(prices) {
  const byDate = {};
  for (const row of prices || []) {
    const ts = row?.[0];
    const price = Number(row?.[1]);
    if (!Number.isFinite(Number(ts)) || !Number.isFinite(price) || price <= 0) continue;
    const dateValue = new Date(Number(ts));
    if (!Number.isFinite(dateValue.getTime())) continue;
    const date = dateValue.toISOString().slice(0, 10);
    byDate[date] = { date, timestamp: ts, value: price };
  }
  return Object.values(byDate).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

async function loadCryptoTrend(force = false) {
  const canvas = document.getElementById('cryptoTrendCanvas');
  const statusEl = document.getElementById('cryptoTrendStatus');
  const daysEl = document.getElementById('cryptoTrendDays');
  const coinsEl = document.getElementById('cryptoTrendCoins');
  if (!canvas || !statusEl || !daysEl || !coinsEl) return;

  const pref = getCryptoTrendPref();
  _setOnByDataAttr(daysEl, 'data-days', pref.days);
  _setOnByDataAttr(coinsEl, 'data-coin', pref.coinId);

  const meta = CRYPTO_IDS.find(c => c.id === pref.coinId) || CRYPTO_IDS[0];
  const cacheKey = `hist_cg_${meta.id}_90`;
  statusEl.textContent = 'A carregar histórico...';

  try {
    let series = (!force) ? lsGet(cacheKey) : null;
    if(!isValidCryptoSeries(series)) series = null;
    if (!series) {
      const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(meta.id)}/market_chart?vs_currency=eur&days=90`;
      const json = await fetchJsonFirstOk(url,
        { signal: AbortSignal.timeout(11000), headers: { Accept: 'application/json' } },
        11000, ["direct", "allorigins", "corsproxy"], data => Array.isArray(data?.prices));
      series = _cgDailyFromPrices(json?.prices);
      if(!isValidCryptoSeries(series)) throw new Error('Histórico insuficiente');
      lsSet(cacheKey, series);
    }

    const view = _lastN(series, pref.days);
    if (view.length < 2) throw new Error('Histórico insuficiente');

    const first = view[0]?.value || 0;
    const last = view[view.length - 1]?.value || 0;
    const pct = first > 0 ? ((last - first) / first) * 100 : 0;
    const sign = pct > 0 ? '+' : '';

    renderTrendChart(canvas, view, {
      label: `${meta.sym}/EUR`,
      borderColor: meta.color,
      backgroundColor: meta.color + '18',
      unit: ' €',
      decimals: last >= 100 ? 0 : 2
    });

    statusEl.innerHTML = `
      <span style="font-family:var(--mono);font-size:.56rem;color:var(--t3);text-transform:uppercase;letter-spacing:.5px">
        ${pref.days}D
      </span>
      <span style="font-family:var(--mono);font-size:.56rem;color:${pct >= 0 ? 'var(--green)' : 'var(--red)'};margin-left:8px">
        ${sign}${pct.toFixed(1)}%
      </span>
      <span style="font-family:var(--mono);font-size:.56rem;color:var(--t3);margin-left:8px">
        último: €${fmtP(last, last >= 100 ? 0 : 2)}
      </span>`;
  } catch (e) {
    statusEl.textContent = (e && e.message) ? e.message : 'Histórico indisponível';
  }
}

function loadCrypto(force=false){
  const run = window.runSingleFlight || ((_key, task) => Promise.resolve().then(task));
  return run("card:crypto", () => loadCryptoOnce(force));
}

async function loadCryptoOnce(force=false){
  $("crypto-body").innerHTML=skeletonKPIs(6);
  try{
    let data=force?null:lsGet("cg");
    if(!isValidCryptoData(data)) data=null;
    if(!data){
      const ids=CRYPTO_IDS.map(c=>c.id).join(",");
      const cgUrl=`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=eur&include_24hr_change=true`;
      try{
        const gatewayUrl = window.dataApiUrl?.("v1/crypto");
        if (gatewayUrl) {
          try {
            const { r } = await fetchFirstOk(gatewayUrl, { headers: { Accept: "application/json" } }, 9000, ["direct"]);
            if (r.ok) data = await r.json();
          } catch {}
        }
        if (!isValidCryptoData(data)) {
          const { r } = await fetchFirstOk(cgUrl, { headers: { Accept: "application/json" } }, 8000,
            ["direct", "allorigins", "corsproxy", "codetabs"]);
          if (r.ok) data = await r.json();
        }
      }catch{}
      if(!isValidCryptoData(data))throw new Error("Crypto fetch failed");
      const sourceMeta = data?._meta;
      lsSet("cg", data, {
        source: sourceMeta?.source || "CoinGecko",
        state: ["partial", "stale"].includes(sourceMeta?.state) ? sourceMeta.state : "live",
        observedAt: sourceMeta?.checkedAt,
        reason: sourceMeta?.state === "stale" ? "Fornecedor indisponível; snapshot do gateway" : undefined,
      });
    }
    /* Snapshot diário (localStorage) */
    try{
      CRYPTO_IDS.forEach(c=>{
        const price = Number(data?.[c.id]?.eur);
        if (Number.isFinite(price) && price > 0) addToHistory(`crypto_${c.id}`, price);
      });
    }catch{}

    const pref = getCryptoTrendPref();
    $("crypto-body").innerHTML=`<div class="crypto-grid">${CRYPTO_IDS.map(c=>{
      const q=data[c.id],price=q?.eur||0,pc=q?.eur_24h_change||0;
      return`<div class="ci2">
        <div class="ci2-top"><span class="ci2-sym">${c.sym}</span><span class="ci2-chg">${price>0?chg(pc):""}</span></div>
        <div class="ci2-name">${c.name}</div>
        <div class="ci2-price" style="color:${c.color}">${price>0?"€"+fmtP(price,price>100?2:4):"—"}</div>
      </div>`;}).join("")}</div>`;

    $("crypto-body").innerHTML += `
      <div style="margin-top:10px;background:var(--surface);border:1px solid var(--b);border-radius:var(--rs);padding:8px 10px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px">
          <div id="cryptoTrendStatus" style="flex:1;min-width:0"></div>
          <div id="cryptoTrendDays" style="display:flex;gap:4px;flex-shrink:0">
            <button class="rbtn ${pref.days===7?'on':''}"  data-days="7"  onclick="setCryptoTrendDays(7)">7D</button>
            <button class="rbtn ${pref.days===30?'on':''}" data-days="30" onclick="setCryptoTrendDays(30)">30D</button>
            <button class="rbtn ${pref.days===90?'on':''}" data-days="90" onclick="setCryptoTrendDays(90)">90D</button>
          </div>
          <div id="cryptoTrendCoins" style="display:flex;gap:4px;flex-shrink:0">
            <button class="rbtn ${pref.coinId==='bitcoin'?'on':''}"  data-coin="bitcoin"  onclick="setCryptoTrendCoin('bitcoin')">BTC</button>
            <button class="rbtn ${pref.coinId==='ethereum'?'on':''}" data-coin="ethereum" onclick="setCryptoTrendCoin('ethereum')">ETH</button>
          </div>
        </div>
        <div style="height:120px">
          <canvas id="cryptoTrendCanvas"></canvas>
        </div>
      </div>`;

    loadCryptoTrend(false).catch(()=>{});
  }catch(e){$("crypto-body").innerHTML=er(e,{context:"Criptomoedas",action:"verifique ligação de rede e tente novamente"});notifyNonCriticalError("Criptomoedas",e,"verifique ligação de rede e tente novamente");}
}

function isValidCryptoData(data){
  if(!data || typeof data !== 'object' || Array.isArray(data)) return false;
  let supportedCoins = 0;
  for(const coin of CRYPTO_IDS){
    const quote = data[coin.id];
    if(quote === undefined || quote === null) continue;
    if(typeof quote.eur !== 'number' || !Number.isFinite(quote.eur) || quote.eur <= 0 ||
       (quote.eur_24h_change !== undefined &&
        (typeof quote.eur_24h_change !== 'number' || !Number.isFinite(quote.eur_24h_change))))
      return false;
    supportedCoins++;
  }
  return supportedCoins > 0;
}

function isValidCryptoSeries(series){
  return Array.isArray(series) && series.length >= 2 && series.every(point =>
    point && typeof point.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(point.date) &&
    Number.isFinite(Number(point.timestamp)) && Number(point.timestamp) > 0 &&
    Number.isFinite(point.value) && point.value > 0);
}


window.loadCrypto = loadCrypto;
window.setCryptoTrendDays = setCryptoTrendDays;
window.setCryptoTrendCoin = setCryptoTrendCoin;
})();
