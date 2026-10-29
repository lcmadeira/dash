/* global Date, EU_INDICES, PFX, PSI20_CONST, REF_DATE, _lastN, _setOnByDataAttr, addToHistory, console, document, fetchStooqDailySeries, fetchStooqMulti, fetchWithCORS, localStorage, lsGet, lsSet, renderTrendChart, window, ld */
(() => {
	/* ── PSI20 · dados ── (config em src/config.js) */

const PSI20_TREND_PREF_KEY = 'psi20_trend_pref_v1';
function getPSI20TrendPref() {
  try {
    const raw = localStorage.getItem(PFX + PSI20_TREND_PREF_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const days = [7, 30, 90].includes(parsed?.days) ? parsed.days : 30;
    return { days };
  } catch {
    return { days: 30 };
  }
}
function setPSI20TrendPref(patch) {
  const cur = getPSI20TrendPref();
  const next = { ...cur, ...patch };
  try { localStorage.setItem(PFX + PSI20_TREND_PREF_KEY, JSON.stringify(next)); } catch {}
  return next;
}
function setPSI20TrendDays(days) {
  setPSI20TrendPref({ days: [7, 30, 90].includes(days) ? days : 30 });
  loadPSI20Trend(false).catch(() => {});
}

async function loadPSI20Trend(force = false) {
  const canvas = document.getElementById('psi20TrendCanvas');
  const statusEl = document.getElementById('psi20TrendStatus');
  const daysEl = document.getElementById('psi20TrendDays');
  if (!canvas || !statusEl || !daysEl) return;

  const pref = getPSI20TrendPref();
  _setOnByDataAttr(daysEl, 'data-days', pref.days);
  statusEl.textContent = 'A carregar histórico...';

  try {
    const series = await fetchStooqDailySeries('^psi20', 90, force);
    const view = _lastN(series, pref.days);
    if (view.length < 2) throw new Error('Histórico insuficiente');

    const first = view[0]?.value || 0;
    const last = view[view.length - 1]?.value || 0;
    const pct = first > 0 ? ((last - first) / first) * 100 : 0;
    const sign = pct > 0 ? '+' : '';

    renderTrendChart(canvas, view, {
      label: 'PSI 20',
      borderColor: '#10B981',
      backgroundColor: 'rgba(16,185,129,0.10)',
      unit: '',
      decimals: 0
    });

    statusEl.innerHTML = `
      <span style="font-family:var(--mono);font-size:.56rem;color:var(--t3);text-transform:uppercase;letter-spacing:.5px">
        ${pref.days}D · PSI 20
      </span>
      <span style="font-family:var(--mono);font-size:.56rem;color:${pct >= 0 ? 'var(--green)' : 'var(--red)'};margin-left:8px">
        ${sign}${pct.toFixed(1)}%
      </span>
      <span style="font-family:var(--mono);font-size:.56rem;color:var(--t3);margin-left:8px">
        último: ${last.toFixed(0)}
      </span>`;
  } catch (e) {
    statusEl.innerHTML = `${(e && e.message) ? e.message : 'Histórico indisponível'} · <a href="https://live.euronext.com/en/product/indices/pting0200002-xlis" target="_blank" rel="noopener noreferrer">ver PSI na Euronext ↗</a>`;
  }
}

	async function loadPSI20(force=false){
	  const el=document.getElementById("psi20-body");
	  if(!el) return;
	  el.innerHTML=`<div style="padding:20px;text-align:center;color:var(--t3);font-size:.7rem">${ld()}</div>`;

    const CK="psi20_v2";
	  let cache=force?null:lsGet(CK);
    if(!isValidPSI20Cache(cache)) cache=null;

    /* Verificar se mercado está fechado (Lisboa: Fim de semana) */
    const now = new Date();
    const isWeekend = (now.getDay() === 0 || now.getDay() === 6);
    
    /* Se tivermos cache válida de hoje/ontem e for fim de semana, não forçar fetch */
    if (!force && isWeekend && cache && (Date.now() - cache.ts < 48 * 3600000)) {
      console.log("📈 PSI20: Mercado fechado (fim-de-semana), a usar cache.");
    } else if (!cache) {
	    const allSyms=[...EU_INDICES,...PSI20_CONST];
	    /* Stooq devolve os símbolos num único pedido; tentar primeiro reduz a
       carga nos proxies públicos, que limitam pedidos paralelos ao Yahoo. */
	    const stooqResults = await fetchStooqMulti(allSyms.map(s => s.sym));
	    const needsYahoo = allSyms.filter(s => !isValidPSI20Quote(stooqResults[s.sym.toLowerCase()]));
	    const YF="https://query1.finance.yahoo.com/v8/finance/chart/";

	    async function fetchYahoo(sym){
	      if(!sym) return null;
	      const url=`${YF}${encodeURIComponent(sym)}?range=5d&interval=1d&_=${Date.now()}`;
	      try{
	        const r=await fetchWithCORS(url, { cache: "no-store" }, 9000);
	        const j=await r.json();
	        const meta=j?.chart?.result?.[0]?.meta;
	        const price=Number(meta?.regularMarketPrice);
	        if(!Number.isFinite(price) || price<=0) return null;
	        const prev=Number(meta?.previousClose ?? meta?.chartPreviousClose ?? price);
	        const hi=Number(meta?.regularMarketDayHigh ?? price);
	        const lo=Number(meta?.regularMarketDayLow ?? price);
	        const vol=Number(meta?.regularMarketVolume ?? 0) || 0;
	        const chg=(Number.isFinite(prev) && prev>0) ? ((price-prev)/prev*100) : 0;
	        return {price,prev,hi,lo,vol,chg,live:true,src:"yahoo"};
	      }catch{
	        return null;
	      }
	    }

	    /* Yahoo fica como fallback, apenas para símbolos ausentes na resposta Stooq. */
	    const yahooRes = await Promise.allSettled(needsYahoo.map(s => fetchYahoo(s.yf)));
	    const yahooBySymbol = new Map(needsYahoo.map((s, i) => [s.sym.toLowerCase(),
	      yahooRes[i]?.status === 'fulfilled' ? yahooRes[i].value : null]));

	    const results = allSyms.map(s => {
	      const quote = stooqResults[s.sym.toLowerCase()] || null;
      return isValidPSI20Quote(quote) ? quote : null;
	    }).map((quote, i) => quote || yahooBySymbol.get(allSyms[i].sym.toLowerCase()) || null);

      const mkFallback=(s)=>({
        price:s.fallback,
        prev:s.fallback/(1+(s.fChg||0)/100),
        hi:s.fallback*1.005, lo:s.fallback*0.995,
        chg:s.fChg||0, vol:0, live:false, fallback:true
      });

	    const isLive=results.some(r=>r?.live);
	    const src=results.find(r=>r?.src)?.src || null;

	    cache={
	      indices: EU_INDICES.map((s,i)=>results[i]||mkFallback(s)),
	      stocks:  PSI20_CONST.map((s,i)=>results[EU_INDICES.length+i]||mkFallback(s)),
	      live:    isLive,
	      src,
	      ts:      Date.now()
	    };
	    if(isLive) lsSet(CK,cache);
	  }

  const psi=cache.indices[0];
  try{ addToHistory('psi20_index', psi.price); }catch{}
  const psiChg=psi.chg||0;
  const psiCol=psiChg>=0?"#10B981":"#EF4444";
  const psiArr=psiChg>=0?"▲":"▼";
  const trendPref = getPSI20TrendPref();

  const headerStatus = document.getElementById("psi20-header-status");
  if (headerStatus) {
    headerStatus.className = `badge ${psi.live ? "live" : "warn"}`;
    headerStatus.textContent = psi.live ? `● ${(psi.src || cache.src || "dados").toUpperCase()}` : "⚠ Sem cotação atual";
    headerStatus.title = psi.live ? "Última cotação devolvida pela fonte externa" : "As fontes automáticas não devolveram uma cotação atual para o PSI";
  }

  function miniBar(chg, w=48, h=22){
    const col=chg>=0?"#10B981":"#EF4444";
    const pct=Math.min(Math.abs(chg)/3*100,100);
    return `<svg width="${w}" height="${h}" style="flex-shrink:0">
      <rect x="0" y="${h/2}" width="${w}" height="1" fill="var(--b)" opacity=".3"/>
      ${chg>=0
        ?`<rect x="${w/2}" y="${h/2-h*pct/200}" width="${w*pct/200}" height="${h*pct/200}" fill="${col}" opacity=".8" rx="1"/>`
        :`<rect x="${w/2-w*pct/200}" y="${h/2}" width="${w*pct/200}" height="${h*pct/200}" fill="${col}" opacity=".8" rx="1"/>`}
      <circle cx="${chg>=0?w/2+w*pct/200:w/2-w*pct/200}" cy="${h/2}" r="1.5" fill="${col}"/>
    </svg>`;
  }

  const liveTag=psi.live
    ? `<span class="badge live">● ${(cache.src||"live").toUpperCase()}</span>`
    : `<span class="badge warn">⚠ FALLBACK ${REF_DATE.full.toUpperCase()}</span>`;

  el.innerHTML=`
  <div style="display:grid;grid-template-columns:auto 1fr;gap:12px;margin-bottom:8px;align-items:start">
    <div style="background:var(--b2);border-radius:10px;padding:10px 14px;min-width:160px;border-left:4px solid #10B981">
      <div style="font-size:.54rem;color:var(--t3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px">PSI 20 · Lisboa</div>
      <div style="font-size:2rem;font-weight:900;color:#10B981;line-height:1;letter-spacing:-1px">${psi.live ? psi.price.toFixed(0) : "—"}</div>
      <div style="font-size:.72rem;font-weight:700;color:${psiCol};margin-top:3px">${psi.live ? `${psiArr} ${Math.abs(psiChg).toFixed(2)}%` : "Cotação indisponível"}</div>
      <div style="display:flex;gap:8px;margin-top:4px;font-size:.55rem;color:var(--t3)">
        <span>H <b style="color:var(--t2)">${psi.live ? psi.hi.toFixed(0) : "—"}</b></span>
        <span>L <b style="color:var(--t2)">${psi.live ? psi.lo.toFixed(0) : "—"}</b></span>
      </div>
      <div style="margin-top:5px">${liveTag}</div>
    </div>

    <div>
      <div style="font-size:.58rem;font-weight:700;color:var(--t2);margin-bottom:4px">🌍 Bolsas europeias</div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px">
        ${EU_INDICES.slice(1).map((idx,i)=>{
          const q=cache.indices[i+1];
          const c=q.chg>=0?"var(--green)":"var(--red)";
          return `<div style="background:var(--b2);border-radius:6px;padding:5px 6px;text-align:center">
            <div style="font-size:.85rem">${idx.flag}</div>
            <div style="font-size:.58rem;font-weight:700;color:${idx.col};white-space:nowrap">${idx.label}</div>
            <div style="font-family:var(--mono);font-size:.68rem;font-weight:700;color:var(--text);margin:1px 0">
              ${q.live ? (q.price>1000?q.price.toLocaleString("pt",{maximumFractionDigits:0}):q.price.toFixed(2)) : "—"}</div>
            <div style="font-size:.6rem;font-weight:600;color:${c}">${q.live ? `${q.chg>=0?"▲":"▼"}${Math.abs(q.chg).toFixed(2)}%` : "sem cotação"}</div>
          </div>`;
        }).join("")}
      </div>
    </div>
  </div>

  <div style="margin:10px 0 12px;background:var(--surface);border:1px solid var(--b);border-radius:var(--rs);padding:8px 10px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px">
      <div id="psi20TrendStatus" style="flex:1;min-width:0"></div>
      <div id="psi20TrendDays" style="display:flex;gap:4px;flex-shrink:0">
        <button class="rbtn ${trendPref.days===7?'on':''}"  data-days="7"  onclick="setPSI20TrendDays(7)">7D</button>
        <button class="rbtn ${trendPref.days===30?'on':''}" data-days="30" onclick="setPSI20TrendDays(30)">30D</button>
        <button class="rbtn ${trendPref.days===90?'on':''}" data-days="90" onclick="setPSI20TrendDays(90)">90D</button>
      </div>
    </div>
    <div style="height:120px"><canvas id="psi20TrendCanvas"></canvas></div>
  </div>

  <div style="font-size:.6rem;font-weight:700;color:var(--t2);margin-bottom:5px">🏢 Constituintes · cotações do dia</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px">
    ${PSI20_CONST.map((s,i)=>{
      const q=cache.stocks[i];
      const c=q.chg>=0?"var(--green)":"var(--red)";
      const bg=q.chg>=0?"#10B98108":"#EF444408";
      return `<div style="background:${bg};border-radius:7px;padding:7px 8px;border:1px solid ${c}15">
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">
          <span style="font-size:.9rem">${s.ico}</span>
          <div style="flex:1">
            <div style="font-size:.62rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.label}</div>
            <div style="font-size:.5rem;color:var(--t3)">${s.sector}</div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end">
          <div>
            <div style="font-family:var(--mono);font-size:.78rem;font-weight:700;color:${s.col}">
        ${q.live ? `${q.price<1?q.price.toFixed(3):q.price.toFixed(2)}€` : "—"}</div>
            <div style="font-size:.6rem;font-weight:600;color:${c}">${q.live ? `${q.chg>=0?"▲":"▼"}${Math.abs(q.chg).toFixed(2)}%` : "sem cotação atual"}</div>
          </div>
          ${q.live ? miniBar(q.chg) : ""}
        </div>
      </div>`;
    }).join("")}
  </div>
  <div style="font-size:.52rem;color:var(--t3);margin-top:6px;line-height:1.4">
    ✦ Fonte principal: ${(cache.src==="yahoo"?"Yahoo Finance":"Stooq")} · Euronext Lisboa (.LS) · 
    ${cache.live?(cache.src==="yahoo"?"Última cotação Yahoo (pode ter atraso)":"Último fecho devolvido pela Stooq")+(cache.stocks.some(q=>q.fallback)||cache.indices.some(q=>q.fallback)?" · cotações em falta ocultadas":""):"Sem cotações atuais · valores de referência ocultados"}
  </div>`;

  loadPSI20Trend(false).catch(()=>{});
}

function isValidPSI20Quote(quote){
  return Boolean(quote && Number.isFinite(quote.price) && quote.price > 0 &&
    Number.isFinite(quote.prev) && quote.prev > 0 &&
    Number.isFinite(quote.hi) && quote.hi > 0 &&
    Number.isFinite(quote.lo) && quote.lo > 0 && quote.hi >= quote.lo &&
    Number.isFinite(quote.vol) && quote.vol >= 0 && Number.isFinite(quote.chg) &&
    typeof quote.live === "boolean" && (quote.src === undefined || typeof quote.src === "string"));
}

function isValidPSI20Cache(cache){
  return Boolean(cache && Array.isArray(cache.indices) && cache.indices.length === EU_INDICES.length &&
    Array.isArray(cache.stocks) && cache.stocks.length === PSI20_CONST.length &&
    cache.indices.every(isValidPSI20Quote) && cache.stocks.every(isValidPSI20Quote) &&
    typeof cache.live === "boolean" && Number.isFinite(cache.ts) && cache.ts > 0 &&
    cache.ts <= Date.now() && (cache.src === null || typeof cache.src === "string"));
}



window.loadPSI20 = loadPSI20;
window.setPSI20TrendDays = setPSI20TrendDays;
})();
