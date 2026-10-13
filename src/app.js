/* global CFG,REF_DATE,EURIBOR_FALLBACK,PSI20_CONST,EU_INDICES,IPMA_CITIES,CACHE_TTL,PFX,lsGet,lsSet,fetchFirstOk,fetchJsonFirstOk,fetchTextFirstOk,fetchWithCORS,fetchStooqMulti,fmtAgeShort,getCacheMeta,refreshAllCardStatuses,applyStickyScrollCards,$,ld,er,chg,fmtP,loadElec,loadNews,loadSeis,loadDams,notifyNonCriticalError,loadAndRenderCalendar,loadHolidays,wxholRefresh,loadAirQuality,loadWeather,getFuelPrefs,syncFuelDeltaBtn,renderFuel,FUEL_SLUGS,tickMarkets,loadMarketStats,loadImob,loadFng,loadAgri,renderExp,renderDiv,loadRec,loadAir,loadOrmuz,loadCO2,loadTransp,loadPress,loadSMN,initInflation,renderInflation */
/* Relógios das praças financeiras movidos para src/widgets/market-clock.js */
/* Pills */
document.getElementById("pills").innerHTML=
  ["IPMA","TradingView","CoinGecko","Google News","BCE/ECB"].map(n=>
    `<span class="pill ok"><span class="dot"></span>${n}</span>`).join("");

/* Clock */
function tick(){
  const n=new Date();
  document.getElementById("clk").textContent=n.toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  document.getElementById("clkd").textContent=n.toLocaleDateString("pt-PT",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  tickMarkets();
}
tick();setInterval(tick,1000);

/* Utils movidos para src/core.js */

/* Cache/fetch helpers movidos para src/cache.js e src/fetch.js */

/* Data status helpers movidos para src/ui.js */

/* Dev proxy + fetch/cache helpers movidos para src/fetch.js e src/cache.js */

/* ── Oil tabs ── */
function switchOil(type,btn){
  document.querySelectorAll(".oil-tab").forEach(b=>b.classList.remove("on"));
  btn.classList.add("on");
  $("oil-brent").style.display=type==="brent"?"block":"none";
  $("oil-wti").style.display  =type==="wti"  ?"block":"none";
}

/* ── Bolsa Lisboa — TV widget dinâmico por acção ── */
/* ── Mapa de Calor ── */
const HMAP_CONFIGS={
  sp500:{dataSource:"SPX500",grouping:"sector",blockSize:"market_cap_basic"},
  crypto:{dataSource:"Crypto",grouping:"no_group",blockSize:"market_cap_basic"},
  etf:{dataSource:"ETF",grouping:"asset_class",blockSize:"assets_under_management"},
};
function switchHmap(key,btn){
  document.querySelectorAll("#hmap-tabs .psi-tab").forEach(b=>b.classList.remove("on"));
  if(btn)btn.classList.add("on");
  const c=HMAP_CONFIGS[key];if(!c)return;
  const cfg=JSON.stringify({exchanges:[],dataSource:c.dataSource,grouping:c.grouping,blockSize:c.blockSize,blockColor:"change",locale:"pt",colorTheme:"dark",hasTopBar:true,isDataSetEnabled:false,isZoomEnabled:true,hasSymbolTooltip:true,isMonoSize:false,width:"100%",height:460});
  const w=document.getElementById("hmap-widget");w.innerHTML="";
  w.appendChild(document.createRange().createContextualFragment(`<div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div><script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js" async>${cfg}<\/script></div>`));
}

/* Meteorologia movida para src/cards/weather.js */

/* Notícias movidas para src/cards/news.js */

/* Combustíveis movidos para src/cards/fuel.js */

/* Eletricidade movida para src/cards/elec.js */

/* ══════════════════════════════════════════════════════════════
   SISTEMA DE HISTÓRICO DE DADOS
   ══════════════════════════════════════════════════════════════ */

// Armazena snapshots de dados ao longo do tempo
const HISTORY_PREFIX = 'hist_';
const MAX_HISTORY_DAYS = 90; // Manter 90 dias de histórico (7/30/90)

/**
 * Adiciona entrada ao histórico
 */
function addToHistory(key, value) {
  const histKey = HISTORY_PREFIX + key;
  let history = [];
  
  try {
    const stored = localStorage.getItem(histKey);
    if (stored) history = JSON.parse(stored);
  } catch {}
  
  const entry = {
    timestamp: Date.now(),
    date: new Date().toISOString().split('T')[0],
    value: value
  };
  
  history.push(entry);
  
  // Limpar antigas
  const cutoff = Date.now() - (MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000);
  history = history.filter(h => h.timestamp > cutoff);
  
  // Remover duplicados do mesmo dia
  const byDate = {};
  history.forEach(h => {
    if (!byDate[h.date] || h.timestamp > byDate[h.date].timestamp) {
      byDate[h.date] = h;
    }
  });
  history = Object.values(byDate).sort((a, b) => a.timestamp - b.timestamp);
  
  try {
    localStorage.setItem(histKey, JSON.stringify(history));
  } catch {}
  
  return history;
}

/**
 * Obter histórico
 */
function getHistory(key, days = 30) {
  const histKey = HISTORY_PREFIX + key;
  let history = [];
  
  try {
    const stored = localStorage.getItem(histKey);
    if (stored) history = JSON.parse(stored);
  } catch {}
  
  if (days < MAX_HISTORY_DAYS) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    history = history.filter(h => h.timestamp > cutoff);
  }
  
  return history;
}

/**
 * Gerar gráfico de tendência com Chart.js
 */
function renderTrendChart(canvas, history, options = {}) {
  const defaults = {
    label: 'Valor',
    borderColor: '#E9A520',
    backgroundColor: 'rgba(233, 165, 32, 0.1)',
    unit: '',
    decimals: 2
  };
  
  const cfg = { ...defaults, ...options };
  const pointRadius = history.length > 40 ? 0 : 3;
  
  // Preparar dados
  const labels = history.map(h => {
    const d = new Date(h.date);
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
  });
  
  const data = history.map(h => {
    const raw = typeof h.value === 'object' ? (h.value.price || h.value.value || 0) : h.value;
    return Number(raw) || 0;
  });
  
  // Criar gráfico
  if (canvas._chart) {
    canvas._chart.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  canvas._chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: cfg.label,
        data: data,
        borderColor: cfg.borderColor,
        backgroundColor: cfg.backgroundColor,
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius,
        pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${cfg.label}: ${ctx.parsed.y.toFixed(cfg.decimals)}${cfg.unit}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: (val) => Number(val).toFixed(cfg.decimals) + cfg.unit,
            color: '#7A85A0',
            font: { size: 10 }
          },
          grid: { color: '#1E2340' }
        },
        x: {
          ticks: {
            color: '#7A85A0',
            font: { size: 9 }
          },
          grid: { display: false }
        }
      }
    }
  });
}

function _lastN(arr, n) {
  if (!Array.isArray(arr)) return [];
  if (!n || n <= 0) return [];
  return arr.slice(Math.max(0, arr.length - n));
}

function _setOnByDataAttr(rootEl, attr, val) {
  if (!rootEl) return;
  const all = rootEl.querySelectorAll(`[${attr}]`);
  all.forEach(b => b.classList.toggle('on', b.getAttribute(attr) === String(val)));
}

async function fetchStooqDailySeries(sym, maxDays = 90, force = false) {
  const cacheKey = `hist_stooq_${sym}_d_${maxDays}`;
  if (!force) {
    const cached = lsGet(cacheKey);
    if (Array.isArray(cached) && cached.length >= 10) return cached;
  }

  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(sym)}&i=d`;
  try {
    const csv = await fetchTextFirstOk(
      url,
      {},
      11000,
      ["local", "allorigins"],
      (text) => !!text && text.includes("Date,Open,High,Low,Close") && !text.includes("<!DOCTYPE html>"),
    );
    if (!csv || csv.length < 20 || csv.includes("<!DOCTYPE html>")) {
      throw new Error("CSV inválido ou página de erro recebida");
    }
    const lines = csv.trim().split("\n").filter(Boolean);

    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const date = (cols[0] || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const close = Number(cols[4]);
      if (!Number.isFinite(close)) continue;
      out.push({ date, timestamp: Date.parse(date), value: close });
    }
    out.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    const sliced = _lastN(out, maxDays);
    if (sliced.length >= 10) {
      lsSet(cacheKey, sliced);
      return sliced;
    }
  } catch {}

  throw new Error("Stooq histórico indisponível");
}


/* Feriados movidos para src/cards/holidays.js */

/* ── EURIBOR — API BCE (data-api.ecb.europa.eu) ──
   Series keys:
     3M  → FM.M.U2.EUR.RT0.MM.EURIBOR3MD_.HSTA
     6M  → FM.M.U2.EUR.RT0.MM.EURIBOR6MD_.HSTA
     12M → FM.M.U2.EUR.RT0.MM.EURIBOR1YD_.HSTA
   Endpoint: /service/data/{flow}/{key}?format=jsondata&lastNObservations=6
   CORS: nativo (cabeçalho Access-Control-Allow-Origin: *)
─────────────────────────────────────────────────── */





/* ══════════════════════════════════════════════════════════════
   EURIBOR — API BCE automatica (data-api.ecb.europa.eu)
   CORS nativo · sem chave · sem proxy
   Fallback: dados estaticos EMMI se API inacessivel

   Series BCE utilizadas:
     1S  -> FM/M.U2.EUR.RT0.MM.EURIBOR1WD_.HSTA
     1M  -> FM/M.U2.EUR.RT0.MM.EURIBOR1MD_.HSTA
     3M  -> FM/M.U2.EUR.RT0.MM.EURIBOR3MD_.HSTA
     6M  -> FM/M.U2.EUR.RT0.MM.EURIBOR6MD_.HSTA
     12M -> FM/M.U2.EUR.RT0.MM.EURIBOR1YD_.HSTA
   ══════════════════════════════════════════════════════════════ */

/* Dados estaticos EMMI como fallback (ja centralizados em src/config.js) */

/* Estado global — preenchido pela API ou pelo fallback */
var EURIBOR_DATA=null;

function isBceEuriborLiveEnabled(){
  try {
    const qs = new URLSearchParams(location.search || "");
    if (qs.has("liveEuribor")) return (qs.get("liveEuribor") || "1") !== "0";
    return localStorage.getItem(PFX + "live_euribor_bce") === "1";
  } catch {
    return false;
  }
}

/* ── Parser SDMX JSON (formato BCE) ──────────────────────────── */
function parseBCEseries(json){
  try{
    /* Chave da serie: usar a primeira disponivel (nao hardcodar "0:0:0:0:0:0")
       O numero de dimensoes varia consoante a serie BCE utilizada */
    const ds=json.dataSets[0];
    const seriesKey=Object.keys(ds.series)[0];
    if(!seriesKey){console.warn("parseBCEseries: sem series");return[];}
    const obs=ds.series[seriesKey].observations;
    /* Dimensao temporal: pode estar em observation[0] ou na ultima de series[] */
    const dimObs=json.structure.dimensions.observation;
    const dimSer=json.structure.dimensions.series;
    const timeDim=(dimObs&&dimObs.length>0)
      ?dimObs[0]
      :(dimSer&&dimSer.length>0?dimSer[dimSer.length-1]:null);
    if(!timeDim){console.warn("parseBCEseries: dimensao temporal nao encontrada");return[];}
    const dates=timeDim.values;
    const rows=[];
    Object.entries(obs).forEach(([idxStr,vals])=>{
      const idx=parseInt(idxStr);
      if(idx<dates.length&&vals[0]!==null)
        rows.push({period:dates[idx].id,value:parseFloat(vals[0])});
    });
    rows.sort((a,b)=>a.period>b.period?1:-1);
    return rows;
  }catch(e){console.warn("parseBCEseries:",e);return[];}
}

/* ── Formatar periodo "2026-03" → "Mar 26" ────────────────────── */
function fmtBCEperiod(p){
  const months=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const[y,m]=p.split("-");
  return`${months[parseInt(m)-1]} ${y.slice(2)}`;
}

/* ── Fetch de uma serie BCE (formato generico) ───────────────── */
async function fetchBCEseries(fullKey, nObs=9){
  /* Se a chave nao for completa (ex: EURIBOR1YD_), assumir prefixo Euribor Mensal */
  const key = fullKey.includes('.') ? fullKey : `M.U2.EUR.RT0.MM.${fullKey}.HSTA`;
  const url = `https://data-api.ecb.europa.eu/service/data/FM/${key}`
            + `?format=jsondata&lastNObservations=${nObs}`;
  const r = await fetch(url, {signal: AbortSignal.timeout(8000)});
  if(!r.ok) throw new Error(`BCE HTTP ${r.status}`);
  return parseBCEseries(await r.json());
}

/* ── Buscar taxas oficiais do BCE (Key Rates) ────────────────── */
async function fetchBCEKeyRates(){
  /* DFR (Deposito), MRR (Refinanciamento), MLF (Cedencia) */
  const key = "D.U2.EUR.4F.KR.DF+MRR_FR+MLFR.LEV";
  const url = `https://data-api.ecb.europa.eu/service/data/FM/${key}?format=jsondata&lastNObservations=1`;
  const r = await fetch(url, {signal: AbortSignal.timeout(8000)});
  if(!r.ok) return null;
  const json = await r.json();
  const ds = json.dataSets[0].series;
  
  /* Mapeamento manual baseado na posicao das dimensoes (simplificado) */
  /* Nota: O formato JSON-stat seria mais robusto, mas mantemos o parser existente */
  const findVal = (kPart) => {
    const sKey = Object.keys(ds).find(k => k.includes(kPart));
    if(!sKey) return null;
    const obs = ds[sKey].observations;
    const firstObs = Object.values(obs)[0];
    return firstObs ? parseFloat(parseFloat(firstObs[0]).toFixed(2)) : null;
  };

  return {
    dep:   findVal(".DF.")     ?? EURIBOR_FALLBACK.bce.dep,
    refin: findVal(".MRR_FR.") ?? EURIBOR_FALLBACK.bce.refin,
    margLend: findVal(".MLFR.") ?? EURIBOR_FALLBACK.bce.margLend
  };
}

/* ── Carregar todas as maturidades em paralelo ───────────────── */
async function loadEuriborFromBCE(){
  const SERIES=[
    {term:"1S",  termFull:"1 Semana", key:"EURIBOR1WD_",color:"#06B6D4",hipot:false,
     desc:"Ref. overnight e swaps curtos"},
    {term:"1M",  termFull:"1 M\u00eas",    key:"EURIBOR1MD_",color:"#22D3EE",hipot:false,
     desc:"Ref. produtos curtos, tesouraria"},
    {term:"3M",  termFull:"3 Meses",  key:"EURIBOR3MD_",color:"#3B82F6",hipot:true,
     desc:"Cr\u00e9dito habita\u00e7\u00e3o revis\u00e3o trimestral"},
    {term:"6M",  termFull:"6 Meses",  key:"EURIBOR6MD_",color:"#8B5CF6",hipot:true,
     desc:"Cr\u00e9dito habita\u00e7\u00e3o revis\u00e3o semestral"},
    {term:"12M", termFull:"12 Meses", key:"EURIBOR1YD_",color:"#A855F7",hipot:true,
     desc:"Cr\u00e9dito habita\u00e7\u00e3o revis\u00e3o anual"},
  ];

  /* Carregar Euribor e Key Rates em paralelo */
  const [euriborRes, keyRates] = await Promise.all([
    Promise.all(SERIES.map(s => fetchBCEseries(s.key, 9).catch(() => null))),
    fetchBCEKeyRates().catch(() => null)
  ]);

  const r3m = euriborRes[2], r12m = euriborRes[4];
  if(!r3m || !r12m || r3m.length < 2 || r12m.length < 2)
    throw new Error("Dados BCE insuficientes");

  const rates = SERIES.map((s, i) => {
    const rows = euriborRes[i];
    if(!rows || rows.length < 2) return EURIBOR_FALLBACK.rates.find(r => r.term === s.term);
    const latest = rows[rows.length - 1];
    const prev   = rows[rows.length - 2];
    return {
      term: s.term, termFull: s.termFull,
      val: parseFloat(latest.value.toFixed(3)),
      prev: parseFloat(prev.value.toFixed(3)),
      color: s.color, hipot: s.hipot, desc: s.desc,
    };
  });

  const hist3m  = euriborRes[2] || [];
  const hist6m  = euriborRes[3] || [];
  const hist12m = euriborRes[4] || [];
  const hist = hist3m.slice(-8).map(row => {
    const p = row.period;
    const v6m  = hist6m.find(r => r.period === p)?.value ?? null;
    const v12m = hist12m.find(r => r.period === p)?.value ?? null;
    return [fmtBCEperiod(p), row.value, v6m, v12m];
  }).filter(r => r[1] !== null);

  const latestPeriod = hist3m[hist3m.length - 1]?.period || "";
  const updatedDate = latestPeriod
    ? new Date(latestPeriod + "-15").toLocaleDateString("pt-PT", {month: "short", year: "numeric"})
    : "BCE live";

  return {
    updated: updatedDate, rates, hist,
    bce: keyRates || EURIBOR_FALLBACK.bce,
    peak: EURIBOR_FALLBACK.peak,
    bceNext: EURIBOR_FALLBACK.bceNext,
    spreadBancario: EURIBOR_FALLBACK.spreadBancario,
    _source: "bce_live",
  };
}

/* ══════════════════════════════════════════════════════════════
   renderEuribor — le EURIBOR_DATA (live ou fallback)
   ══════════════════════════════════════════════════════════════ */
function renderEuribor(){
  const d=EURIBOR_DATA;
  const el=document.getElementById("euri-body");
  if(!el||!d) return;

  d.rates.forEach(r=>addToHistory(`euribor_${r.term.toLowerCase()}`,r.val));

  const W=320,H=80,PAD={t:8,r:8,b:20,l:32};
  const cw=W-PAD.l-PAD.r,ch=H-PAD.t-PAD.b;
  const histRev=[...d.hist].reverse();
  const allVals=histRev.flatMap(r=>r.slice(1).filter(v=>v!==null));
  const vmin=Math.floor(Math.min(...allVals)*10)/10-0.1;
  const vmax=Math.ceil(Math.max(...allVals)*10)/10+0.1;
  const vr=vmax-vmin;
  const sx=i=>PAD.l+Math.round(i/(histRev.length-1)*cw);
  const sy=v=>PAD.t+Math.round((1-(v-vmin)/vr)*ch);

  const lineColors=["#3B82F6","#8B5CF6","#A855F7"];
  const lineLabels=["3M","6M","12M"];
  const lines=lineColors.map((_,ci)=>
    histRev.map((row,i)=>row[ci+1]!==null?`${sx(i)},${sy(row[ci+1])}`:null)
      .filter(Boolean).join(" ")
  );

  const yticks=[];
  let yt=Math.ceil(vmin*10)/10;
  while(yt<=vmax+0.01){yticks.push(yt);yt=Math.round((yt+0.5)*10)/10;}

  const svgChart=`<svg width="${W}" height="${H}" style="width:100%;display:block;overflow:visible">
    ${yticks.map(v=>`<line x1="${PAD.l}" y1="${sy(v)}" x2="${W-PAD.r}" y2="${sy(v)}"
      stroke="var(--b)" stroke-width="1"/>`).join("")}
    ${yticks.map(v=>`<text x="${PAD.l-3}" y="${sy(v)+4}" text-anchor="end"
      font-size="7" fill="var(--t3)">${v.toFixed(1)}</text>`).join("")}
    ${histRev.filter((_,i)=>i%2===0).map((row,_,arr)=>{
      const origIdx=histRev.indexOf(row);
      return`<text x="${sx(origIdx)}" y="${H-2}" text-anchor="middle"
        font-size="7" fill="var(--t3)">${row[0]}</text>`;
    }).join("")}
    ${lines.map((pts,ci)=>`<polyline points="${pts}" fill="none"
      stroke="${lineColors[ci]}" stroke-width="1.8" stroke-linejoin="round"/>`).join("")}
    ${lines.map((pts,ci)=>{
      const last=pts.split(" ").pop().split(",");
      return`<circle cx="${last[0]}" cy="${last[1]}" r="3" fill="${lineColors[ci]}"/>`;
    }).join("")}
  </svg>`;

  const peakVal=d.peak.val;
  const r12=d.rates.find(r=>r.term==="12M");
  const quedaPico=((peakVal-r12.val)/peakVal*100).toFixed(1);
  const quedaPP=(peakVal-r12.val).toFixed(3);
  const sp=d.spreadBancario;
  const bce=d.bceNext;
  const expColor=bce.expectativa==="Corte"?"#10B981":bce.expectativa==="Subida"?"#EF4444":"#F59E0B";

  const sourceTag=d._source==="bce_live"
    ?`<span style="font-size:.5rem;color:#10B981;background:#10B98115;border-radius:3px;padding:1px 6px">\u25CF BCE live \u00b7 ${d.updated}</span>`
    :`<span style="font-size:.5rem;color:#F59E0B;background:#F59E0B15;border-radius:3px;padding:1px 6px">\u26a0 EMMI est\u00e1tico \u00b7 ${d.updated}</span>`;

  const periodoGraf=d.hist.length>0
    ?`${d.hist[d.hist.length-1][0]} \u2192 ${d.hist[0][0]}`:"—";

  el.innerHTML=`
  <div style="display:flex;justify-content:flex-end;margin-bottom:6px">${sourceTag}</div>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px;margin-bottom:8px">
    ${d.rates.map(r=>{
      const diff=r.val-r.prev;
      const dCol=diff<0?"#10B981":"#EF4444";
      return`<div style="background:var(--b2);border-radius:6px;padding:5px 4px;
           border-top:2px solid ${r.color};text-align:center">
        <div style="font-size:.56rem;color:var(--t3);font-weight:600">${r.term}</div>
        <div style="font-family:var(--mono);font-size:.85rem;font-weight:700;
             color:${r.color};line-height:1.1;margin:2px 0">${r.val.toFixed(3)}<span style="font-size:.5rem">%</span></div>
        <div style="font-size:.5rem;color:${dCol}">${diff<0?"\u25bc":"\u25b2"}${Math.abs(diff).toFixed(3)}pp</div>
        ${r.hipot?`<div style="font-size:.44rem;color:var(--t3);margin-top:1px">\uD83C\uDFE0 hipot.</div>`:""}
      </div>`;
    }).join("")}
  </div>
  <div style="background:var(--b2);border-radius:8px;padding:8px 10px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <div style="font-size:.6rem;color:var(--t3)">Evolu\u00e7\u00e3o mensal \u00b7 ${periodoGraf}</div>
      <div style="display:flex;gap:8px">
        ${lineColors.map((c,i)=>`<span style="font-size:.55rem;color:${c}">\u25cf ${lineLabels[i]}</span>`).join("")}
      </div>
    </div>
    ${svgChart}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1px 1fr 1px 1fr;
       background:var(--b2);border-radius:8px;overflow:hidden;margin-bottom:8px">
    <div style="padding:7px 10px;text-align:center">
      <div style="font-size:.52rem;color:var(--t3);text-transform:uppercase;margin-bottom:2px">BCE Dep\u00f3sito</div>
      <div style="font-family:var(--mono);font-size:1rem;font-weight:700;color:#3B82F6">${d.bce.dep.toFixed(2)}%</div>
      <div style="font-size:.52rem;color:var(--t3)">refin. ${d.bce.refin.toFixed(2)}%</div>
    </div>
    <div style="background:var(--b)"></div>
    <div style="padding:7px 10px;text-align:center">
      <div style="font-size:.52rem;color:var(--t3);text-transform:uppercase;margin-bottom:2px">Pico ${d.peak.date}</div>
      <div style="font-family:var(--mono);font-size:1rem;font-weight:700;color:#EF4444">${d.peak.val.toFixed(3)}%</div>
      <div style="font-size:.52rem;color:#10B981">\u25bc ${quedaPP}pp (${quedaPico}%)</div>
    </div>
    <div style="background:var(--b)"></div>
    <div style="padding:7px 10px;text-align:center">
      <div style="font-size:.52rem;color:var(--t3);text-transform:uppercase;margin-bottom:2px">Tend\u00eancia</div>
      <div style="font-family:var(--mono);font-size:1rem;font-weight:700;color:#10B981">\u25bc Descida</div>
      <div style="font-size:.52rem;color:var(--t3)">desde Out 2023</div>
    </div>
  </div>
  <div style="background:var(--b2);border-radius:8px;padding:8px 10px;margin-bottom:8px;
       border-left:3px solid ${expColor}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:.6rem;font-weight:700;color:var(--t2)">
          \uD83C\uDFE6 Pr\u00f3xima reuni\u00e3o BCE \u00b7 ${bce.date}
        </div>
        <div style="font-size:.57rem;color:var(--t3);margin-top:2px">${bce.nota}</div>
      </div>
      <div style="text-align:right;min-width:60px">
        <div style="font-size:.62rem;font-weight:700;color:${expColor}">${bce.expectativa}</div>
        <div style="font-size:.52rem;color:var(--t3)">consenso</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-top:6px">
      ${[
        {label:"Corte \u221225bp",prob:bce.probCorte,col:"#10B981"},
        {label:"Pausa",           prob:bce.probPausa, col:"#F59E0B"},
        {label:"Subida",          prob:bce.probSubida,col:"#EF4444"},
      ].map(b=>`<div>
        <div style="display:flex;justify-content:space-between;margin-bottom:2px">
          <span style="font-size:.52rem;color:var(--t3)">${b.label}</span>
          <span style="font-size:.54rem;font-weight:600;color:${b.col}">${b.prob}%</span>
        </div>
        <div style="background:var(--b);border-radius:3px;height:5px">
          <div style="width:${b.prob}%;height:100%;background:${b.col};border-radius:3px"></div>
        </div>
      </div>`).join("")}
    </div>
  </div>
  <div style="background:var(--b2);border-radius:8px;padding:8px 10px">
    <div style="font-size:.6rem;font-weight:700;color:var(--t2);margin-bottom:5px">
      \uD83C\uDFE0 Spread banc\u00e1rio PT \u00b7 cr\u00e9dito habita\u00e7\u00e3o vari\u00e1vel
      <span class="help-tip" title="Spread bancário: margem fixa do banco somada à Euribor para calcular a TAN do crédito.">?</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:5px">
      ${[
        {label:"Spread m\u00edn.",   val:sp.min,    col:"#10B981"},
        {label:"Spread t\u00edpico", val:sp.tipico, col:"#F59E0B"},
        {label:"Spread m\u00e1x.",   val:sp.max,    col:"#EF4444"},
      ].map(s=>`<div style="text-align:center">
        <div style="font-size:.65rem;font-weight:700;color:${s.col}">${s.val.toFixed(2)}%</div>
        <div style="font-size:.52rem;color:var(--t3)">${s.label}</div>
      </div>`).join("")}
    </div>
    <div style="font-size:.57rem;color:var(--t3);margin-bottom:3px">TAN efectiva estimada (Euribor + spread t\u00edpico ${sp.tipico.toFixed(2)}%):</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">
      ${d.rates.filter(r=>r.hipot).map(r=>`
        <div style="background:var(--surface);border-radius:5px;padding:4px 6px;text-align:center;
             border:1px solid ${r.color}33">
          <div style="font-size:.52rem;color:var(--t3)">Euribor ${r.termFull}</div>
          <div style="font-size:.75rem;font-weight:700;color:${r.color}">
            ${(r.val+sp.tipico).toFixed(3)}%</div>
          <div style="font-size:.5rem;color:var(--t3)">TAN est.</div>
        </div>`).join("")}
    </div>
    <div style="font-size:.52rem;color:var(--t3);margin-top:4px">
      ${d._source==="bce_live"
        ?`Fonte: BCE \u00b7 data-api.ecb.europa.eu \u00b7 ${d.updated} \u00b7 Spread: m\u00e9dia de mercado PT.`
        :`Fonte: EMMI \u00b7 emmi-benchmarks.eu \u00b7 ${d.updated} \u00b7 Spread: m\u00e9dia de mercado PT.`}
      N\u00e3o constitui proposta comercial.
    </div>
  </div>`;
}

/* ══════════════════════════════════════════════════════════════
   initEuribor — ponto de entrada: cache → API BCE → fallback EMMI
   ══════════════════════════════════════════════════════════════ */
async function initEuribor(force=false){
  const CK="euribor_live_v1";
  const ref=document.getElementById("euriborRefDate");

  /* 1. Cache valido -> mostrar e sair */
  if(!force){
    const cached=lsGet(CK);
    if(cached){
      EURIBOR_DATA=cached;
      if(ref) ref.textContent=cached.updated+(cached._source==="bce_live"?" \u25cf live":"");
      renderEuribor();
      console.log("📐 Euribor: cache local ("+cached.updated+")");
      return;
    }
  }

  /* 2. Sem cache: mostrar fallback IMEDIATAMENTE enquanto tenta BCE */
  EURIBOR_DATA=EURIBOR_FALLBACK;
  if(ref) ref.textContent=EURIBOR_FALLBACK.updated;
  renderEuribor();

  if(!isBceEuriborLiveEnabled()){
    console.log("📐 Euribor: fallback EMMI (BCE live desativado)");
    return;
  }

  /* 3. Tentar BCE em background e actualizar se responder */
  try{
    console.log("📐 Euribor: a actualizar do BCE em background...");
    const live=await loadEuriborFromBCE();
    EURIBOR_DATA=live;
    lsSet(CK,live);
    if(ref) ref.textContent=live.updated+" \u25cf live";
    renderEuribor();
    console.log("\u2705 Euribor BCE actualizado:",live.updated);
  }catch(e){
    /* Fallback ja esta visivel - apenas registar o aviso */
    console.warn("\u26a0\ufe0f Euribor BCE indisponivel, a usar EMMI:",e.message);
  }
}


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
async function loadFX(force=false){
  $("fx-body").innerHTML=skeletonKPIs(6);
  try{
    let data = force ? null : lsGet("fx");
    if (!data) {
      try {
        const j = await fetchJsonFirstOk("https://api.frankfurter.dev/v1/latest?base=EUR", {}, 6000);
        data = { rates: j.rates, date: j.date };
      } catch (e) {
        console.warn("⚠️ Frankfurter falhou, a tentar fallback:", e.message);
        try {
          const j2 = await fetchJsonFirstOk("https://open.er-api.com/v6/latest/EUR", {}, 8000);
          data = { rates: j2.rates, date: "" };
        } catch (e2) {
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
    const code = (parsed?.code && typeof parsed.code === 'string') ? parsed.code : 'USD';
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
  setFXTrendPref({ days });
  loadFXTrend(false).catch(() => {});
}
function setFXTrendCode(code) {
  setFXTrendPref({ code });
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

      if (out.length < 10) throw new Error('Histórico insuficiente');
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

/* ── Inflação PT vs Zona Euro ── */

/* ══════════════════════════════════════════════════════════════
   INFLAÇÃO — Eurostat API Statistics (CORS nativo, sem chave)
   Dataset : PRC_HICP_MANR (HICP monthly, annual rate of change)
   Geo     : PT (Portugal) + EA20/EA21 (composição vigente da Zona Euro)
   Coicop  : CP00 (todos os itens — índice geral)
   URL base: https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/
   Estratégia: fallback estático imediato → Eurostat em background
   ══════════════════════════════════════════════════════════════ */

/* Dados estáticos como fallback definidos em src/config.js. */
/* Inflação Portugal/UE movida para src/cards/inflation.js */

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
function getCryptoTrendPref() {
  try {
    const raw = localStorage.getItem(PFX + CRYPTO_TREND_PREF_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const coinId = parsed?.coinId || 'bitcoin';
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
  const next = setCryptoTrendPref({ days });
  loadCryptoTrend(false).catch(() => {});
  return next;
}
function setCryptoTrendCoin(coinId) {
  const next = setCryptoTrendPref({ coinId });
  loadCryptoTrend(false).catch(() => {});
  return next;
}

function _cgDailyFromPrices(prices) {
  const byDate = {};
  for (const row of prices || []) {
    const ts = row?.[0];
    const price = Number(row?.[1]);
    if (!ts || !Number.isFinite(price)) continue;
    const date = new Date(ts).toISOString().slice(0, 10);
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
    if (!series) {
      const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(meta.id)}/market_chart?vs_currency=eur&days=90`;
      let json = null;
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } });
        if (r.ok) json = await r.json();
      } catch {}
      if (!json) {
        const rp = await fetch('https://corsproxy.io/?' + encodeURIComponent(url), { signal: AbortSignal.timeout(11000) });
        if (!rp.ok) throw new Error(`CoinGecko ${rp.status}`);
        json = await rp.json();
      }
      series = _cgDailyFromPrices(json?.prices);
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

async function loadCrypto(force=false){
  $("crypto-body").innerHTML=skeletonKPIs(6);
  try{
    let data=force?null:lsGet("cg");
    if(!data){
      const ids=CRYPTO_IDS.map(c=>c.id).join(",");
      const cgUrl=`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=eur&include_24hr_change=true`;
      try{
        const { r } = await fetchFirstOk(cgUrl, { headers: { Accept: "application/json" } }, 8000, ["direct", "allorigins"]);
        if(r.ok)data=await r.json();
      }catch{}
      if(!data)throw new Error("Crypto fetch failed");
      lsSet("cg",data);
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

/* ── Twelve Data — Indicadores ── */
const TD_BASE="https://api.twelvedata.com";
async function tdGet(ep,params,force=false){
  // Verificar se API key está configurada
  if (!CFG.TD_KEY) {
    console.warn('⚠️ Twelve Data API key não configurada. Indicadores de mercado desativados.');
    throw new Error('API key não configurada');
  }
  
  const ck=ep+"?"+new URLSearchParams(params);
  if(!force){const h=lsGet(ck);if(h)return h;}
  const r=await fetch(`${TD_BASE}${ep}?${new URLSearchParams({...params,apikey:CFG.TD_KEY})}`);
  if(!r.ok)throw new Error(`TD ${r.status}`);
  const j=await r.json();if(j.status==="error")throw new Error(j.message||"TD error");
  lsSet(ck,j);return j;
}

/* Calendário económico movido para src/widgets/economic-calendar.js */

/* Qualidade do ar movida para src/cards/air-quality.js */

/* ── Boot ── */
loadWeather();
loadNews("pt",true);
loadNews("world",true);
renderFuel();
loadAndRenderCalendar(); /* Calendário dinâmico: FOMC, BCE, NFP, CPI, INE */
loadHolidays();
renderInflation();
initEuribor();
setTimeout(()=>{renderExp();renderDiv();},50);
loadElec();
loadDams();
setTimeout(()=>switchHmap("sp500",document.querySelector("#hmap-tabs .psi-tab.on")),200);
setTimeout(()=>loadFX(),          500);
setTimeout(()=>loadTTF(),         800);
setTimeout(()=>loadGasPT(),       900);
setTimeout(()=>loadMarketStats(), 1200);
setTimeout(()=>loadPSI20(),       1800);
setTimeout(()=>loadCrypto(),      2200);
setTimeout(()=>loadFng(),         2500);
setTimeout(()=>loadAgri(),        3000);
setTimeout(()=>loadSeis(),        3300);
setTimeout(()=>loadRec(),         3600);
setTimeout(()=>loadAir(),         4000);
setTimeout(()=>loadOrmuz(),       4300);
setTimeout(()=>loadCO2(),         4600);
setTimeout(()=>loadSMN(),         5000);
setTimeout(()=>initInflation(),   5500);
setTimeout(()=>loadImob(),        5300);
setTimeout(()=>loadTransp(),      5600);
setTimeout(()=>loadPress(),       6000);

setInterval(()=>{
  loadWeather();
  loadNews("pt",true);loadNews("world",true);
  renderFuel();loadHolidays();
  loadElec();loadGeo();loadAirQuality(true);loadDams(true);loadFX(true);loadCrypto(true);initInflation(true);

  loadFng(true);loadAgri(true);loadSeis(true);loadAir(true);loadOrmuz(true);loadCO2(true);loadImob(true);
  setTimeout(()=>loadMarketStats(true),1500);
  renderCabaz();
  setTimeout(()=>loadPSI20(true),3000);
},CACHE_TTL);

/* ═══ MAPA CONFLITOS v2 ═══ */
(function(){

const C=[
  /* [nome, tipo, lat, lon, descrição, região] */
  ["Ucrânia","war",49.0,32.0,"Invasão russa — 3.º ano","Europa"],
  ["Gaza","war",31.4,34.4,"Israel–Hamas · ofensiva","Médio Oriente"],
  ["Sudão","war",15.5,32.5,"SAF vs RSF — colapso estatal","África"],
  ["Myanmar","war",19.7,96.1,"Junta vs resistência","Ásia"],
  ["Etiópia","war",9.1,40.5,"Amhara · Oromia","África"],
  ["RD Congo","war",-4.0,21.8,"M23 · Kivu Norte","África"],
  ["Sahel","war",12.0,-2.0,"Jihadistas · Wagner","África"],
  ["Somália","war",5.1,46.2,"Al-Shabaab","África"],
  ["Iémen","war",15.5,48.5,"Houthis · coalizão","Médio Oriente"],
  ["Síria","war",35.0,38.3,"Pós-Assad · fragmentação","Médio Oriente"],
  ["Afeganistão","war",33.9,67.7,"Talibã · IS-K","Ásia"],
  ["Líbano","high",33.9,35.5,"Reconstrução pós-guerra","Médio Oriente"],
  ["Iraque","high",33.2,43.7,"Milícias pro-Irão","Médio Oriente"],
  ["Moçambique","high",-13.0,39.0,"Cabo Delgado · ISCAP","África"],
  ["Nigéria N.","high",11.8,13.2,"Boko Haram · ISWAP","África"],
  ["Haiti","high",18.9,-72.3,"Gangues · colapso estado","Américas"],
  ["Cisjordânia","high",31.9,35.2,"Colonatos · IDF","Médio Oriente"],
  ["Burkina Faso","high",12.4,-1.5,"Junta · jihadistas","África"],
  ["Taiwan","tension",24.0,121.0,"PRC vs EUA · estreito","Ásia"],
  ["Coreia Norte","tension",40.0,127.5,"Nuclear · ICBM","Ásia"],
  ["Irão","tension",32.4,53.7,"Proxy regional · nuclear","Médio Oriente"],
  ["Kosovo","tension",42.6,21.2,"Sérvia · NATO","Europa"],
  ["Geórgia","tension",42.3,43.4,"Influência russa","Europa"],
  ["Moldávia","tension",47.4,28.9,"Transnistria","Europa"],
  ["Arménia","tension",40.1,47.6,"Pós-Karabakh · Azerbaijão","Europa"],
  ["Mar Sul China","tension",14.0,114.0,"Filipinas · China · EUA","Ásia"],
  ["Venezuela","tension",6.4,-61.2,"Essequibo · Guiana","Américas"],
  ["Paquistão–Índia","nuclear",30.0,73.0,"Kashmir · LOC","Ásia"],
  ["Rússia–OTAN","nuclear",55.0,37.6,"Retórica nuclear","Europa"],
];

const CC={war:"#EF4444",high:"#F59E0B",tension:"#8B5CF6",nuclear:"#3B82F6"};
const CR={war:8,high:6,tension:5,nuclear:6};
const CL={war:"Guerra Activa",high:"Alta Intensidade",tension:"Tensão",nuclear:"Risco Nuclear"};

/* Projecção de Mercator simples: lon→x, lat→y para viewBox 1000×500 */
function proj(lat,lon){
    const x=(lon+180)/360*1000;
    const y=(90-lat)/180*500;
    return[Math.round(x),Math.round(Math.max(0,Math.min(500,y)))];
  }

/* ── MAPA ── */

/* ═══════════════════════════════════════════════════════════════
   MAPA REGIONAL GENÉRICO — Canvas + TopoJSON world-atlas
   Reutiliza o mesmo atlas do mapa de conflitos (cache global)
   ═══════════════════════════════════════════════════════════════ */

/* Cache global do GeoJSON (partilhado com buildConflictMap) */
if(!window._topoCache) window._topoCache = null;
if(!window._topoLoading) window._topoLoading = false;
if(!window._topoCbs) window._topoCbs = [];

function topo2geo(topo){
    let name=Object.keys(topo.objects)[0]; /* "countries" ou "land" */
    /* Preferir "countries" se existir */
    if(topo.objects.countries)name="countries";
    else if(topo.objects.land)name="land";
    const obj=topo.objects[name];
    const arcs=topo.arcs;
    const scale=topo.transform?topo.transform.scale:[1,1];
    const translate=topo.transform?topo.transform.translate:[0,0];

    function decodeArc(idx){
      const reversed=idx<0;
      const arc=arcs[reversed?~idx:idx];
      const coords=[];
      let x=0,y=0;
      for(let i=0;i<arc.length;i++){
        x+=arc[i][0]; y+=arc[i][1];
        coords.push([x*scale[0]+translate[0], y*scale[1]+translate[1]]);
      }
      if(reversed)coords.reverse();
      return coords;
    }

    function decodeGeom(geom){
      if(geom.type==="GeometryCollection"){
        return {type:"FeatureCollection",features:geom.geometries.map(function(g){
          return {type:"Feature",geometry:decodeGeom(g),properties:{}};
        })};
      }
      if(geom.type==="Polygon"){
        return {type:"Polygon",coordinates:geom.arcs.map(function(ring){
          let coords=[];
          ring.forEach(function(idx){coords=coords.concat(decodeArc(idx));});
          return coords;
        })};
      }
      if(geom.type==="MultiPolygon"){
        return {type:"MultiPolygon",coordinates:geom.arcs.map(function(poly){
          return poly.map(function(ring){
            let coords=[];
            ring.forEach(function(idx){coords=coords.concat(decodeArc(idx));});
            return coords;
          });
        })};
      }
      return {type:geom.type,coordinates:[]};
    }

    const features=[];
    if(obj.type==="GeometryCollection"){
      obj.geometries.forEach(function(g){
        features.push({type:"Feature",geometry:decodeGeom(g),properties:g.properties||{}});
      });
    }
    return {type:"FeatureCollection",features:features};
  }

function loadTopoData(cb){
  if(window._topoCache){ cb(window._topoCache); return; }
  window._topoCbs.push(cb);
  if(window._topoLoading) return;
  window._topoLoading = true;
  fetch("https://unpkg.com/world-atlas@2/countries-110m.json")
    .then(function(r){ return r.json(); })
    .then(function(topo){
      /* Usar topo2geo global */
      const geo = topo2geo(topo);
      window._topoCache = geo;
      window._topoCbs.forEach(function(f){ f(window._topoCache); });
      window._topoCbs=[];
    })
    .catch(function(){ window._topoLoading=false; });
}

/* ── Função genérica de desenho regional ── */
function drawRegionalMap(canvasId, tipId, bbox, dots, opts, fixedW, fixedH){
  const canvas=document.getElementById(canvasId);
  const tip=tipId?document.getElementById(tipId):null;
  if(!canvas) return;
  /* Dimensões: usar valores explícitos ou detectar do DOM */
  const W0 = fixedW || canvas.parentElement&&canvas.parentElement.offsetWidth || canvas.offsetWidth || 190;
  const H0 = fixedH || canvas.parentElement&&canvas.parentElement.offsetHeight || canvas.offsetHeight || 130;
  canvas.width  = W0;
  canvas.height = H0;
  const ctx=canvas.getContext("2d");
  opts=opts||{};

  function proj(lat,lon){
    const padLon=(bbox.maxLon-bbox.minLon)*0.04;
    const padLat=(bbox.maxLat-bbox.minLat)*0.04;
    const x=(lon-(bbox.minLon-padLon))/((bbox.maxLon+padLon)-(bbox.minLon-padLon))*canvas.width;
    const y=(1-(lat-(bbox.minLat-padLat))/((bbox.maxLat+padLat)-(bbox.minLat-padLat)))*canvas.height;
    return [x,y];
  }

  function draw(geo){
    const W=canvas.width, H=canvas.height;
    /* Fundo */
    ctx.fillStyle=opts.bg||"#0a1020";
    ctx.fillRect(0,0,W,H);

    /* Países */
    const features=geo.features;
    for(let fi=0;fi<features.length;fi++){
      const geom=features[fi].geometry;
      if(!geom) continue;
      const polys=geom.type==="Polygon"?[geom.coordinates]:geom.coordinates;
      for(let pi=0;pi<polys.length;pi++){
        const rings=polys[pi];
        /* Verificar se este polígono intersecta a bbox */
        const ring0=rings[0]; if(!ring0||!ring0.length) continue;
        let inView=false;
        for(var ci=0;ci<ring0.length;ci+=5){
          const lon=ring0[ci][0], lat=ring0[ci][1];
          if(lon>=bbox.minLon-5&&lon<=bbox.maxLon+5&&lat>=bbox.minLat-5&&lat<=bbox.maxLat+5){
            inView=true; break;
          }
        }
        if(!inView) continue;
        for(let ri=0;ri<rings.length;ri++){
          const ring=rings[ri];
          ctx.beginPath();
          for(var ci=0;ci<ring.length;ci++){
            var p=proj(ring[ci][1],ring[ci][0]);
            if(ci===0) ctx.moveTo(p[0],p[1]);
            else ctx.lineTo(p[0],p[1]);
          }
          ctx.closePath();
          ctx.fillStyle=opts.landFill||"#1E2B4A";
          ctx.fill();
          ctx.strokeStyle=opts.landStroke||"#2A3660";
          ctx.lineWidth=0.7;
          ctx.stroke();
        }
      }
    }

    /* Pontos */
    for(let di=0;di<dots.length;di++){
      const d=dots[di];
      var p=proj(d.lat,d.lon);
      if(p[0]<-10||p[0]>W+10||p[1]<-10||p[1]>H+10) continue;
      /* Glow */
      const grd=ctx.createRadialGradient(p[0],p[1],0,p[0],p[1],d.r*3);
      grd.addColorStop(0,d.col+"99");
      grd.addColorStop(1,d.col+"00");
      ctx.beginPath();
      ctx.arc(p[0],p[1],d.r*3,0,Math.PI*2);
      ctx.fillStyle=grd;
      ctx.fill();
      /* Círculo principal */
      ctx.beginPath();
      ctx.arc(p[0],p[1],d.r,0,Math.PI*2);
      ctx.fillStyle=d.col;
      ctx.globalAlpha=0.9;
      ctx.fill();
      ctx.globalAlpha=1;
      ctx.strokeStyle="rgba(255,255,255,0.3)";
      ctx.lineWidth=0.5;
      ctx.stroke();
    }

    /* Etiquetas opcionais */
    if(opts.labels){
      opts.labels.forEach(function(l){
        const p=proj(l.lat,l.lon);
        ctx.font="9px monospace";
        ctx.fillStyle="rgba(110,122,150,0.8)";
        ctx.fillText(l.text,p[0]+4,p[1]+3);
      });
    }
  }

  /* Resize */
  function resize(){
    const rect=canvas.getBoundingClientRect();
    const w = Math.round(rect.width) || fixedW || 190;
    const h2 = Math.round(rect.height) || fixedH || 130;
    if(w>0 && h2>0){ canvas.width=w; canvas.height=h2; }
    if(window._topoCache) draw(window._topoCache);
  }

  /* Tooltip */
  if(tip){
    canvas.addEventListener("mousemove",function(e){
      const rect=canvas.getBoundingClientRect();
      const mx=e.clientX-rect.left, my=e.clientY-rect.top;
      let hit=null, minD=Infinity;
      for(let di=0;di<dots.length;di++){
        const d=dots[di];
        const p=proj(d.lat,d.lon);
        const dist=Math.sqrt((p[0]-mx)*(p[0]-mx)+(p[1]-my)*(p[1]-my));
        if(dist<Math.max(d.r+8,16)&&dist<minD){ minD=dist; hit=d; }
      }
      if(hit){
        tip.style.opacity="1";
        tip.style.left=Math.min(mx+12,canvas.width-190)+"px";
        tip.style.top=Math.max(my-30,4)+"px";
        tip.innerHTML=hit.label||"";
      } else {
        tip.style.opacity="0";
      }
    });
    canvas.addEventListener("mouseleave",function(){ tip.style.opacity="0"; });
  }

  loadTopoData(function(geo){
    /* Re-verificar se canvas ainda está no DOM */
    if(!document.getElementById(canvasId)) return;
    /* Re-verificar dimensões */
    if(canvas.width===0 || canvas.height===0){
      canvas.width = fixedW||190; canvas.height = fixedH||130;
    }
    if(!geo||!geo.features||!geo.features.length){
      /* Sem dados: mostrar fundo simples */
      ctx.fillStyle=opts.bg||"#0a1020"; ctx.fillRect(0,0,canvas.width,canvas.height);
      return;
    }
    draw(geo);
  });
  window.addEventListener("resize",function(){
    setTimeout(resize,100);
  });
}


window.buildConflictMap=function(){
  const wrap=document.getElementById("cmap-content");
  if(!wrap)return;
  wrap.innerHTML='<canvas id="cmap-canvas" style="width:100%;height:100%;display:block;border-radius:6px"></canvas>'
    +'<div id="cmap-tip" style="position:absolute;background:#1E2340;border:1px solid #3D4560;padding:6px 10px;border-radius:6px;font-size:.72rem;color:#DDE3F0;pointer-events:none;opacity:0;transition:opacity .15s;z-index:10;max-width:180px;line-height:1.4"></div>';

  const canvas=document.getElementById("cmap-canvas");
  const tip=document.getElementById("cmap-tip");
  const ctx=canvas.getContext("2d");

  /* Projecção equirectangular: lon[-180,180] lat[-90,90] → px */
  function proj(lat,lon,W,H){
    return [(lon+180)/360*W, (90-lat)/180*H];
  }

  function draw(geo){
    const W=canvas.offsetWidth||860;
    const H=canvas.offsetHeight||430;
    canvas.width=W; canvas.height=H;

    /* Fundo */
    ctx.fillStyle="#0F1629";
    ctx.fillRect(0,0,W,H);

    /* Grelha de meridianos/paralelos */
    ctx.strokeStyle="rgba(255,255,255,0.04)";
    ctx.lineWidth=0.5;
    for(var lon=-180;lon<=180;lon+=30){
      var x=proj(0,lon,W,H)[0];
      ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();
    }
    for(var lat=-60;lat<=60;lat+=30){
      var y=proj(lat,0,W,H)[1];
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
    }

    /* Países */
    const features=geo.features;
    for(let fi=0;fi<features.length;fi++){
      const geom=features[fi].geometry;
      if(!geom)continue;
      const polys=geom.type==="Polygon"?[geom.coordinates]:geom.coordinates;
      ctx.fillStyle="#1E2B4A";
      ctx.strokeStyle="#2A3660";
      ctx.lineWidth=0.5;
      for(let pi=0;pi<polys.length;pi++){
        const rings=polys[pi];
        for(let ri=0;ri<rings.length;ri++){
          const ring=rings[ri];
          ctx.beginPath();
          for(var ci=0;ci<ring.length;ci++){
            var p=proj(ring[ci][1],ring[ci][0],W,H);
            if(ci===0)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);
          }
          ctx.closePath();
          ctx.fill();ctx.stroke();
        }
      }
    }

    /* Conflitos */
    const COLORS={war:"#EF4444",high:"#F59E0B",tension:"#8B5CF6",nuclear:"#3B82F6"};
    const DOTS=[];
    for(var ci=0;ci<C.length;ci++){
      const c=C[ci];
      var p=proj(c[2],c[3],W,H);
      const col=COLORS[c[1]]||"#888";
      const r=c[1]==="war"?7:c[1]==="high"?6:5;

      /* Glow */
      const GLOW={war:"rgba(239,68,68,0.3)",high:"rgba(245,158,11,0.3)",tension:"rgba(139,92,246,0.3)",nuclear:"rgba(59,130,246,0.3)"};
      const grd=ctx.createRadialGradient(p[0],p[1],0,p[0],p[1],r*2.5);
      grd.addColorStop(0,GLOW[c[1]]||"rgba(200,200,200,0.3)");
      grd.addColorStop(1,"rgba(0,0,0,0)");
      ctx.beginPath();ctx.arc(p[0],p[1],r*2.5,0,Math.PI*2);
      ctx.fillStyle=grd;ctx.fill();

      /* Dot */
      ctx.beginPath();ctx.arc(p[0],p[1],r,0,Math.PI*2);
      ctx.fillStyle=col;ctx.fill();
      ctx.strokeStyle="rgba(255,255,255,0.4)";ctx.lineWidth=1;ctx.stroke();

      DOTS.push({x:p[0],y:p[1],r:r+4,c:c});
    }

    /* Labels meridianos */
    ctx.fillStyle="rgba(255,255,255,0.25)";
    ctx.font="9px monospace";
    ctx.textAlign="center";
    for(var lon=-120;lon<=120;lon+=60){
      var x=proj(0,lon,W,H)[0];
      ctx.fillText(lon+"°",x,H-4);
    }
    ctx.textAlign="left";
    for(var lat=-60;lat<=60;lat+=30){
      if(lat===0)continue;
      var y=proj(lat,0,W,H)[1];
      ctx.fillText(lat+"°",3,y+3);
    }

    return DOTS;
  }

  let DOTS_REF=[];

  function loadAndDraw(){
    /* Usar cache global se disponível */
    if(window._topoCache){
      DOTS_REF=draw(window._topoCache);
      setupHover();
      return;
    }
    fetch("https://unpkg.com/world-atlas@2/countries-110m.json")
    .then(function(r){return r.json();})
    .then(function(topo){
      const geojson=topo2geo(topo);
      window._topoCache=geojson;
      DOTS_REF=draw(geojson);
      setupHover();
    })
    .catch(function(){
      /* Fallback: desenhar sem países (só fundo + pontos) */
      const W=canvas.offsetWidth||860, H=canvas.offsetHeight||430;
      canvas.width=W; canvas.height=H;
      ctx.fillStyle="#0F1629"; ctx.fillRect(0,0,W,H);
      DOTS_REF=draw({features:[]});
      setupHover();
    });
  }

  /* TopoJSON decoder mínimo (sem dependências) */


  function setupHover(){
    const rect=canvas.getBoundingClientRect();
    canvas.addEventListener("mousemove",function(e){
      const rx=e.clientX-canvas.getBoundingClientRect().left;
      const ry=e.clientY-canvas.getBoundingClientRect().top;
      let hit=null;
      for(let i=0;i<DOTS_REF.length;i++){
        const d=DOTS_REF[i];
        if(Math.hypot(rx-d.x,ry-d.y)<=d.r+2){hit=d;break;}
      }
      if(hit){
        tip.style.opacity="1";
        tip.style.left=(hit.x+12)+"px";
        tip.style.top=(hit.y-8)+"px";
        tip.innerHTML="<strong>"+hit.c[0]+"</strong><br>"+hit.c[4];
      }else{
        tip.style.opacity="0";
      }
    });
    canvas.addEventListener("mouseleave",function(){tip.style.opacity="0";});
  }

  /* Redraw on resize */
  let resizeTimer;
  window.addEventListener("resize",function(){
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(function(){
      if(DOTS_REF.length)loadAndDraw();
    },200);
  });

  loadAndDraw();
};

/* ── STATS ── */
function buildStats(){
  const wrap=document.getElementById("cmap-content");
  if(!wrap)return;

  const byType={war:0,high:0,tension:0,nuclear:0};
  const byRegion={};
  C.forEach(function(c){
    byType[c[1]]++;
    byRegion[c[5]]=(byRegion[c[5]]||0)+1;
  });
  const total=C.length;

  const regions=Object.entries(byRegion).sort(function(a,b){return b[1]-a[1];});
  const maxR=regions[0][1];

  const regionColors={"Médio Oriente":"#ef4444","África":"#f59e0b","Ásia":"#8b5cf6","Europa":"#3b82f6","Américas":"#10b981"};

  let html='<div class="cmap-stat-grid">';
  html+='<div class="cmap-stat"><div class="cmap-stat-lbl">Total de conflitos</div><div class="cmap-stat-val" style="color:#ef4444">'+total+'</div><div class="cmap-stat-sub">activos · Mar 2026</div></div>';
  html+='<div class="cmap-stat"><div class="cmap-stat-lbl">Guerras activas</div><div class="cmap-stat-val" style="color:#ef4444">'+byType.war+'</div><div class="cmap-stat-sub">conflito armado contínuo</div></div>';
  html+='<div class="cmap-stat"><div class="cmap-stat-lbl">Alta intensidade</div><div class="cmap-stat-val" style="color:#f59e0b">'+byType.high+'</div><div class="cmap-stat-sub">violência significativa</div></div>';
  html+='<div class="cmap-stat"><div class="cmap-stat-lbl">Risco nuclear</div><div class="cmap-stat-val" style="color:#3b82f6">'+byType.nuclear+'</div><div class="cmap-stat-sub">cenários escalação</div></div>';
  html+='</div>';

  html+='<div style="font-family:var(--mono);font-size:.5rem;text-transform:uppercase;letter-spacing:.7px;color:var(--t3);margin-bottom:8px">Distribuição por região</div>';
  regions.forEach(function(r){
    const col=regionColors[r[0]]||"#6b7280";
    html+='<div class="cmap-region-row">'
      +'<div class="cmap-region-lbl">'+r[0]+'</div>'
      +'<div class="cmap-region-track"><div class="cmap-region-fill" style="width:'+Math.round(r[1]/maxR*100)+'%;background:'+col+'"></div></div>'
      +'<div class="cmap-region-num">'+r[1]+'</div>'
      +'</div>';
  });

  /* Índice de intensidade global */
  const intensity=Math.round((byType.war*4+byType.nuclear*3+byType.high*2+byType.tension)/total*25);
  html+='<div style="margin-top:12px;padding:10px;background:var(--c2);border:1px solid var(--b);border-radius:var(--rs)">';
  html+='<div style="font-family:var(--mono);font-size:.48rem;color:var(--t3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:6px">Índice de tensão global</div>';
  html+='<div style="display:flex;align-items:center;gap:10px">';
  html+='<div style="font-size:1.6rem;font-weight:700;color:#ef4444">'+intensity+'</div>';
  html+='<div>';
  html+='<div style="width:160px;height:8px;background:var(--b2);border-radius:4px;overflow:hidden;margin-bottom:3px">';
  html+='<div style="width:'+intensity+'%;height:100%;background:linear-gradient(90deg,#10b981,#f59e0b,#ef4444);border-radius:4px"></div>';
  html+='</div>';
  html+='<div style="font-family:var(--mono);font-size:.48rem;color:var(--t3)">Elevado · tendência crescente desde 2022</div>';
  html+='</div></div></div>';

  wrap.innerHTML=html;
}

/* ── LISTA ── */
function buildLista(){
  const wrap=document.getElementById("cmap-content");
  if(!wrap)return;
  const sorted=C.slice().sort(function(a,b){
    const order={war:0,nuclear:1,high:2,tension:3};
    return order[a[1]]-order[b[1]];
  });
  let html='<div class="cmap-conflict-list">';
  sorted.forEach(function(c){
    const col=CC[c[1]];
    html+='<div class="cmap-conflict-item">'
      +'<div class="cmap-conflict-dot" style="background:'+col+'"></div>'
      +'<div class="cmap-conflict-name">'+c[0]+'</div>'
      +'<div class="cmap-conflict-type" style="color:'+col+';border-color:'+col+'44;background:'+col+'11">'+CL[c[1]]+'</div>'
      +'<div class="cmap-conflict-desc">'+c[4]+'</div>'
      +'</div>';
  });
  html+='</div>';
  wrap.innerHTML=html;
}

/* ── TAB SWITCH ── */
let CMAP_TAB="mapa";
window.switchCmap=function(tab,btn){
  document.querySelectorAll(".cmap-tab").forEach(function(b){b.classList.remove("on");});
  if(btn)btn.classList.add("on");
  CMAP_TAB=tab;
  const legend=document.getElementById("cmap-legend");
  if(legend)legend.style.display=tab==="mapa"?"flex":"none";
  if(tab==="mapa")window.buildConflictMap();
  else if(tab==="stats")buildStats();
  else buildLista();
};

})();


/* ═══ RSS GEOPOLÍTICO ═══ */
var GEO_DATA=[],GEO_FILTER="all";
var GEO_FEEDS=[
 {id:"icg",label:"Crisis Group",color:"#EF4444",url:"https://www.crisisgroup.org/rss/139",proxy:true},
 {id:"gpf",label:"Geop. Futures",color:"#F59E0B",url:"https://geopoliticalfutures.com/feed/",proxy:true},
 {id:"fa", label:"Foreign Affairs",color:"#8B5CF6",url:"https://feeds.bbci.co.uk/news/world/rss.xml",proxy:false},
];

async function loadGeo(force){
 $("geo-body").innerHTML=skeletonGeneric(6);
 try{
  let ck="geo_v10",cached=force?null:lsGet(ck);
  if(!cached){
   const all=[];
   for(let fi=0;fi<GEO_FEEDS.length;fi++){
    let feed=GEO_FEEDS[fi],raw=null;
    try{
     if(!feed.proxy){
      try{const rd=await fetch(feed.url,{signal:AbortSignal.timeout(9000)});
        if(rd.ok){const rt=await rd.text();if(rt.includes("<item>"))raw=rt;}
      }catch(e){}
     }
     if(!raw){
      const pxs=["https://corsproxy.io/?"+encodeURIComponent(feed.url),
               "https://api.allorigins.win/raw?url="+encodeURIComponent(feed.url)];
      for(let pi=0;pi<pxs.length&&!raw;pi++){
       try{const rp=await fetch(pxs[pi],{signal:AbortSignal.timeout(10000)});
         if(rp.ok){const tp=await rp.text();if(tp.includes("<item>"))raw=tp;}
       }catch(e){}
      }
     }
     if(!raw)continue;
     const xml=new DOMParser().parseFromString(raw,"text/xml");
     const items=xml.querySelectorAll("item");
     for(let ii=0;ii<Math.min(items.length,8);ii++){
      const it=items[ii];
      const title=((it.querySelector("title")||{}).textContent||"")
        .replace(/CDATA/g,"").replace(/<[^>]+>/g,"").replace(/[\[\]!]/g,"").trim();
      const link=((it.querySelector("link")||{}).textContent||"").trim();
      const pub=((it.querySelector("pubDate")||{}).textContent||"");
      const dt=pub?new Date(pub).getTime():Date.now()-(ii*3600000);
      if(title&&title.length>8)all.push({id:feed.id,label:feed.label,color:feed.color,title:title,link:link,dt:dt});
     }
    }catch(fe){console.warn("geo feed",feed.id,fe);}
   }
   all.sort(function(a,b){return b.dt-a.dt;});
   if(!all.length)throw new Error("Feeds indispon\u00edveis");
   cached=all;lsSet(ck,cached);
  }
  GEO_DATA=cached;renderGeo();
 }catch(e){
  $("geo-body").innerHTML=er(e,{context:"Geopolítica",action:"clique em ↺ ou abra uma fonte em baixo"})+"<div style='margin-top:8px'>"+GEO_FEEDS.map(function(f){
   return "<div style='margin:3px 0;font-size:.62rem'>&rarr; <a href='"+f.url+"' target='_blank' style='color:"+f.color+"'>"+f.label+"</a></div>";
  }).join("")+"</div>";
  notifyNonCriticalError("Geopolítica",e,"clique em ↺ ou abra uma fonte em baixo");
 }
}

function switchGeo(f,btn){
 document.querySelectorAll(".geo-tab").forEach(function(b){b.classList.remove("on");});
 if(btn)btn.classList.add("on");
 GEO_FILTER=f;renderGeo();
}

function renderGeo(){
 const items=GEO_FILTER==="all"?GEO_DATA:GEO_DATA.filter(function(x){return x.id===GEO_FILTER;});
 if(!items||!items.length){$("geo-body").innerHTML='<p style="color:var(--t3);font-size:.7rem;padding:10px 0">Sem artigos.</p>';return;}
 $("geo-body").innerHTML=items.slice(0,10).map(function(it){
  const ago=fmtAgo(it.dt);
  const lnk=(it.link||"").replace(/'/g,"\'");
  return '<div class="geo-item" role="button" tabindex="0" aria-label="Abrir artigo '+it.label+': '+it.title.replace(/"/g,"&quot;")+'" onclick="window.open(\''+ lnk +'\')">'
   +'<span class="geo-src-tag" style="color:'+it.color+';border-color:'+it.color+'44;background:'+it.color+'11">'+it.label+'</span>'
   +'<div class="geo-title">'+it.title+'</div>'
   +'<div class="geo-date">'+ago+'</div></div>';
 }).join("");
}

function fmtAgo(ts){
 const d=Math.floor((Date.now()-ts)/1000);
 if(d<60)return"agora";if(d<3600)return Math.floor(d/60)+"min";
 if(d<86400)return Math.floor(d/3600)+"h";return Math.floor(d/86400)+"d";
}

/* boot geo */
buildConflictMap();
loadGeo();

/* ══════════════════════════════════════════════════════════════
   FEAR & GREED INDEX — Alternative.me (CORS livre)
   ══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════
   SALÁRIO MÍNIMO & CUSTO DE VIDA · PT
   ══════════════════════════════════════════════════════ */
const TTF_TREND_PREF_KEY = 'ttf_trend_pref_v1';
function getTTFTrendPref() {
  try {
    const raw = localStorage.getItem(PFX + TTF_TREND_PREF_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const days = [7, 30, 90].includes(parsed?.days) ? parsed.days : 30;
    return { days };
  } catch {
    return { days: 30 };
  }
}
function setTTFTrendPref(patch) {
  const cur = getTTFTrendPref();
  const next = { ...cur, ...patch };
  try { localStorage.setItem(PFX + TTF_TREND_PREF_KEY, JSON.stringify(next)); } catch {}
  return next;
}
function setTTFTrendDays(days) {
  setTTFTrendPref({ days });
  loadTTFTrend(false).catch(() => {});
}

async function loadTTFTrend(force = false) {
  const canvas = document.getElementById('ttfTrendCanvas');
  const statusEl = document.getElementById('ttfTrendStatus');
  const daysEl = document.getElementById('ttfTrendDays');
  if (!canvas || !statusEl || !daysEl) return;

  const pref = getTTFTrendPref();
  _setOnByDataAttr(daysEl, 'data-days', pref.days);
  statusEl.textContent = 'A carregar tendência...';

  try {
    let series = null;
    try {
      series = await fetchStooqDailySeries('tg.f', 90, force);
    } catch {
      const local = getHistory('ttf_eur_mwh', 90)
        .map(h => ({ date: h.date, timestamp: h.timestamp || Date.parse(h.date), value: Number(h.value) }))
        .filter(x => Number.isFinite(x.value) && x.value > 0)
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      if (local.length >= 10) series = local;
    }

    if (!series || series.length < 2) throw new Error('Histórico insuficiente');
    const view = _lastN(series, pref.days);
    if (view.length < 2) throw new Error('Histórico insuficiente');

    const first = view[0]?.value || 0;
    const last = view[view.length - 1]?.value || 0;
    const pct = first > 0 ? ((last - first) / first) * 100 : 0;
    const sign = pct > 0 ? '+' : '';

    renderTrendChart(canvas, view, {
      label: 'TTF EUR/MWh',
      borderColor: '#3B82F6',
      backgroundColor: 'rgba(59,130,246,0.10)',
      unit: ' €/MWh',
      decimals: 0
    });

    statusEl.innerHTML = `
      <span style="font-family:var(--mono);font-size:.56rem;color:var(--t3);text-transform:uppercase;letter-spacing:.5px">
        ${pref.days}D · TTF
      </span>
      <span style="font-family:var(--mono);font-size:.56rem;color:${pct >= 0 ? 'var(--green)' : 'var(--red)'};margin-left:8px">
        ${sign}${pct.toFixed(1)}%
      </span>
      <span style="font-family:var(--mono);font-size:.56rem;color:var(--t3);margin-left:8px">
        último: ${last.toFixed(1)} €/MWh
      </span>`;
  } catch (e) {
    statusEl.textContent = (e && e.message) ? e.message : 'Tendência indisponível';
  }
}

function loadTTF(force=false){
  const el=document.getElementById("ttf-body");
  if(!el) return;

  /* ══════════════════════════════════════════════════════════
     TTF live — Stooq CSV (tg.f = Dutch TTF Gas, EUR/MWh)
     Fallback: Yahoo Finance TTF=F (requer conversão USD/MMBtu)
     Hubs secundários: estáticos (sem fonte pública gratuita)
     ══════════════════════════════════════════════════════════ */

  const CK = "ttf_live_v1";

  /* Histórico TTF mensal — actualizar ~1x/mês manualmente
     (sem API pública com histórico gratuito) */
  const TTF_HIST=[
    ["Jan 24",26.8],["Fev 24",27.4],["Mar 24",24.9],["Abr 24",29.3],
    ["Mai 24",34.1],["Jun 24",36.8],["Jul 24",38.2],["Ago 24",37.6],
    ["Set 24",36.4],["Out 24",39.8],["Nov 24",45.2],["Dez 24",47.8],
    ["Jan 25",50.2],["Fev 25",48.6],["Mar 25",41.3],["Abr 25",36.8],
    ["Mai 25",34.2],["Jun 25",32.8],["Jul 25",35.4],["Ago 25",37.1],
    ["Set 25",40.2],["Out 25",42.8],["Nov 25",44.6],["Dez 25",46.3],
    ["Jan 26",47.8],["Fev 26",41.2],["Mar 26",38.5],["Abr 26",52.0],
    ["Mai 26",45.0],["Jun 26",47.3],["Jul 26",45.1],["Ago 26",53.3],
    ["Set 26",78.5],
  ];

  /* Outros hubs europeus — estáticos, sem fonte pública gratuita */
  const HUBS_STATIC=[
    {name:"NBP",    country:"🇬🇧",full:"National Balancing Point",
     price:74.5,prev:51.2,col:"#8B5CF6",
     desc:"Hub britânico. Spread vs TTF reflecte isolamento pós-Brexit."},
    {name:"MIBGAS", country:"🇪🇸🇵🇹",full:"Mercado Ibérico do Gás",
     price:81.2,prev:57.3,col:"#F97316",
     desc:"Hub ibérico (PT+ES). Inclui terminais GNL de Sines, Huelva, Bilbau."},
    {name:"PEG",    country:"🇫🇷",full:"Point d'Échange de Gaz",
     price:77.8,prev:52.1,col:"#F59E0B",
     desc:"Hub francês (GRTgaz). Muito próximo do TTF pelo interligador."},
    {name:"THE",    country:"🇩🇪",full:"Trading Hub Europe",
     price:79.2,prev:53.4,col:"#EF4444",
     desc:"Hub alemão (fusão Gaspool+NCG). Grande liquidez, próximo TTF."},
    {name:"VTP",    country:"🇦🇹",full:"Virtual Trading Point",
     price:79.8,prev:54.0,col:"#F97316",
     desc:"Hub austríaco. Ponto de entrada do gás russo/azeri via Turquia."},
  ];

  /* Reservas EU — estáticas, actualizar mensalmente */
  const RESERVAS=[
    {c:"🇩🇪",name:"Alemanha",pct:61.5,col:"#F59E0B"},
    {c:"🇮🇹",name:"Itália",  pct:78.4,col:"#10B981"},
    {c:"🇫🇷",name:"França",  pct:69.2,col:"#F59E0B"},
    {c:"🇳🇱",name:"Holanda", pct:58.6,col:"#EF4444"},
    {c:"🇪🇸",name:"Espanha", pct:76.8,col:"#10B981"},
    {c:"🇦🇹",name:"Áustria", pct:72.3,col:"#10B981"},
    {c:"🇵🇱",name:"Polónia", pct:88.5,col:"#10B981"},
  ];
  const EU_AVG=68, EU_PREV=85;

  /* ── Fetch TTF via Stooq CSV (tg.f = EUR/MWh) ──────────── */
  async function fetchTTFStooq(){
    const url=`https://stooq.com/q/l/?s=tg.f&f=sd2t2ohlcv&h&e=csv`;
    const candidates=[url, url.replace("stooq.com","stooq.pl")];
    for(const candidate of candidates){
      try{
        const csv=await fetchTextFirstOk(
          candidate,
          {},
          9000,
          ["local", "allorigins"],
          (text) => !!text && text.includes("Symbol,Date,Time") && !text.includes("<!DOCTYPE html>"),
        );
        const rows=csv.trim().split("\n");
        if(rows.length<2) continue;
        /* CSV: Symbol,Date,Time,Open,High,Low,Close,Volume */
        const cols=rows[1].split(",");
        const open =parseFloat(cols[3]);
        const hi   =parseFloat(cols[4]);
        const lo   =parseFloat(cols[5]);
        const close=parseFloat(cols[6]);
        if(!isNaN(close)&&close>0&&close<500) /* sanidade: TTF entre 0-500 €/MWh */
          return {price:close,prev:open,hi,lo,
                  chg:open?((close-open)/open*100):0,live:true,src:"Stooq"};
      }catch{}
    }
    return null;
  }

  /* ── Fetch TTF via Yahoo Finance (TTF=F) ────────────────────
     Yahoo cotado em EUR/MWh para TTF=F — confirmar unidade no resultado */
  async function fetchTTFYahoo(){
    const sym="TTF=F";
    const url=`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=5d&interval=1d`;
    const proxies=[
      "https://api.allorigins.win/raw?url="+encodeURIComponent(url),
      "https://corsproxy.io/?url="+encodeURIComponent(url),
    ];
    for(const p of proxies){
      try{
        const r=await fetch(p,{signal:AbortSignal.timeout(9000)});
        if(!r.ok) continue;
        const j=await r.json();
        const meta=j?.chart?.result?.[0]?.meta;
        if(!meta?.regularMarketPrice) continue;
        const price=meta.regularMarketPrice;
        const prev=meta.previousClose||meta.chartPreviousClose||price;
        if(!isNaN(price)&&price>0&&price<500)
          return {price,prev,hi:meta.regularMarketDayHigh||price,
                  lo:meta.regularMarketDayLow||price,
                  chg:prev?((price-prev)/prev*100):0,live:true,src:"Yahoo"};
      }catch{}
    }
    return null;
  }

  /* ── Render com dados TTF (live ou estático) ─────────────── */
  function render(ttfData, sourceLabel){
    const trendPref = getTTFTrendPref();
    const ttfPrice = ttfData?.price ?? 38.5;
    const ttfPrev  = ttfData?.prev  ?? 40.2;
    const ttfHi    = ttfData?.hi    ?? ttfPrice*1.01;
    const ttfLo    = ttfData?.lo    ?? ttfPrice*0.99;
    const ttfChg   = ttfData?.chg   ?? ((ttfPrice-ttfPrev)/ttfPrev*100);
    const isLive   = ttfData?.live  ?? false;

    /* Sparkline TTF histórico */
    const histWithLive = [...TTF_HIST];
    /* Actualizar último ponto se temos preço live */
    if(isLive && histWithLive.length>0){
      histWithLive[histWithLive.length-1] = ["Hoje", ttfPrice];
    }
    const vals=histWithLive.map(x=>x[1]);
    const vmin=Math.min(...vals), vmax=Math.max(...vals), vrng=vmax-vmin||1;
    const SW=200,SH=40;
    const sx=i=>Math.round(i/(vals.length-1)*SW);
    const sy=v=>Math.round(SH-(v-vmin)/vrng*(SH-4)+2);
    const pts=vals.map((v,i)=>`${sx(i)},${sy(v)}`).join(" ");
    const fill=pts+` ${SW},${SH+2} 0,${SH+2}`;

    const chgCol = ttfChg>=0?"#EF4444":"#10B981";
    const chgArr = ttfChg>=0?"▲":"▼";

    const sourceBadge = isLive
      ? `<span style="font-size:.5rem;color:#10B981;background:#10B98115;border-radius:3px;padding:1px 6px">● ${sourceLabel} live</span>`
      : `<span style="font-size:.5rem;color:#F59E0B;background:#F59E0B15;border-radius:3px;padding:1px 5px">⚠ estático · ref. Mar 2026</span>`;

    el.innerHTML=`
    <!-- Header: TTF actual + sparkline -->
    <div style="display:flex;align-items:center;justify-content:space-between;
         background:var(--b2);border-radius:10px;padding:10px 12px;margin-bottom:10px">
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <div style="font-size:.58rem;color:var(--t3);text-transform:uppercase;
               letter-spacing:.5px">TTF Day-ahead · EUR/MWh</div>
          ${sourceBadge}
        </div>
        <div style="display:flex;align-items:flex-end;gap:5px">
          <div style="font-size:2rem;font-weight:900;color:#3B82F6;line-height:1">
            ${ttfPrice.toFixed(1)}</div>
          <div style="font-size:.7rem;color:var(--t3);margin-bottom:3px">€/MWh</div>
        </div>
        <div style="font-size:.68rem;font-weight:600;color:${chgCol};margin-top:2px">
          ${chgArr} ${Math.abs(ttfChg).toFixed(1)}% vs fecho anterior
        </div>
        <div style="font-family:var(--mono);font-size:.55rem;color:var(--t3);margin-top:2px">
          H ${ttfHi.toFixed(1)} · L ${ttfLo.toFixed(1)} · ant. ${ttfPrev.toFixed(1)}
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:.6rem;color:var(--t3);margin-bottom:4px">
          Jan 2024 → ${histWithLive[histWithLive.length-1][0]}
        </div>
        <svg width="${SW}" height="${SH+4}" style="display:block">
          <defs><linearGradient id="tg2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3B82F6" stop-opacity=".25"/>
            <stop offset="100%" stop-color="#3B82F6" stop-opacity="0"/>
          </linearGradient></defs>
          <polygon points="${fill}" fill="url(#tg2)"/>
          <polyline points="${pts}" fill="none" stroke="#3B82F6" stroke-width="1.5"/>
          <circle cx="${sx(vals.length-1)}" cy="${sy(vals[vals.length-1])}" r="3" fill="#3B82F6"/>
        </svg>
      </div>
    </div>

    <div style="margin-top:10px;background:var(--surface);border:1px solid var(--b);border-radius:var(--rs);padding:8px 10px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px">
        <div id="ttfTrendStatus" style="flex:1;min-width:0"></div>
        <div id="ttfTrendDays" style="display:flex;gap:4px;flex-shrink:0">
          <button class="rbtn ${trendPref.days===7?'on':''}"  data-days="7"  onclick="setTTFTrendDays(7)">7D</button>
          <button class="rbtn ${trendPref.days===30?'on':''}" data-days="30" onclick="setTTFTrendDays(30)">30D</button>
          <button class="rbtn ${trendPref.days===90?'on':''}" data-days="90" onclick="setTTFTrendDays(90)">90D</button>
        </div>
      </div>
      <div style="height:120px">
        <canvas id="ttfTrendCanvas"></canvas>
      </div>
    </div>

    <!-- Tabela hubs (TTF live + restantes estáticos) -->
    <div style="font-size:.62rem;font-weight:700;color:var(--t2);margin-bottom:5px">
      🌍 Hubs europeus · spot
      <span style="font-size:.52rem;font-weight:400;color:var(--t3)"> · TTF live · outros ref. Mar 2026</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:10px">
      <!-- TTF com dados live -->
      <div style="background:var(--b2);border-radius:7px;padding:6px 8px;
           border-left:3px solid #3B82F6">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:.7rem;font-weight:700;color:#3B82F6">🇳🇱 TTF</div>
            <div style="font-size:.52rem;color:var(--t3);margin-top:1px">Title Transfer Facility</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:.75rem;font-weight:700;color:var(--text)">${ttfPrice.toFixed(1)}</div>
            <div style="font-size:.54rem;color:${chgCol}">${chgArr}${Math.abs(ttfChg).toFixed(1)}%</div>
          </div>
        </div>
      </div>
      <!-- Hubs estáticos -->
      ${HUBS_STATIC.map(hub=>{
        const hChg=((hub.price-hub.prev)/hub.prev*100);
        const hCol=hChg>=0?"#EF4444":"#10B981";
        return `<div style="background:var(--b2);border-radius:7px;padding:6px 8px;
             border-left:3px solid ${hub.col}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-size:.7rem;font-weight:700;color:${hub.col}">${hub.country} ${hub.name}</div>
              <div style="font-size:.52rem;color:var(--t3);margin-top:1px">${hub.full}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:.75rem;font-weight:700;color:var(--text)">${hub.price.toFixed(1)}</div>
              <div style="font-size:.54rem;color:${hCol}">${hChg>=0?"▲":"▼"}${Math.abs(hChg).toFixed(1)}%</div>
            </div>
          </div>
        </div>`;
      }).join("")}
    </div>

    <!-- Reservas EU -->
    <div style="font-size:.62rem;font-weight:700;color:var(--t2);margin-bottom:5px">
      🏭 Reservas de gás · EU · ref. Mar 2026
      <span style="font-size:.55rem;font-weight:400;color:#EF4444"> · médio EU: ${EU_AVG}% (vs ${EU_PREV}% ano anterior)</span>
    </div>
    ${RESERVAS.map(r=>`
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
        <div style="min-width:22px;font-size:.75rem">${r.c}</div>
        <div style="min-width:55px;font-size:.62rem;color:var(--t2)">${r.name}</div>
        <div style="flex:1;background:var(--b2);border-radius:3px;height:7px;overflow:hidden">
          <div style="width:${r.pct}%;height:100%;background:${r.col};border-radius:3px"></div>
        </div>
        <div style="min-width:36px;text-align:right;font-size:.65rem;font-weight:600;
             color:${r.col}">${r.pct}%</div>
      </div>`).join("")}
    <div style="font-size:.55rem;color:var(--t3);margin-top:4px;line-height:1.4">
      ⚠️ Reservas EU abaixo da média histórica. Meta: 90% até Nov 2026.
    </div>`;

    loadTTFTrend(false).catch(()=>{});
  }

  /* ── Inicialização: cache → fallback → fetch live ───────── */
  async function init(){
    /* 1. Cache válido */
    if(!force){
      const cached=lsGet(CK);
      if(cached){
        render(cached, cached.src||"Stooq");
        console.log("🔥 TTF: cache ("+cached.price.toFixed(1)+" €/MWh)");
        return;
      }
    }

    /* 2. Mostrar estático imediatamente */
    render(null, "");

    /* 3. Tentar Stooq em background */
    try{
      const data = await fetchTTFStooq();
      if(data){
        lsSet(CK, data);
        try{ addToHistory('ttf_eur_mwh', data.price); }catch{}
        render(data, "Stooq");
        console.log("✅ TTF Stooq live: "+data.price.toFixed(1)+" €/MWh ("+data.chg.toFixed(2)+"%)");
        return;
      }
    }catch(e){ console.warn("TTF Stooq falhou:", e.message); }

    /* 4. Fallback Yahoo Finance */
    try{
      const data = await fetchTTFYahoo();
      if(data){
        lsSet(CK, data);
        try{ addToHistory('ttf_eur_mwh', data.price); }catch{}
        render(data, "Yahoo");
        console.log("✅ TTF Yahoo live: "+data.price.toFixed(1)+" €/MWh");
        return;
      }
    }catch(e){ console.warn("TTF Yahoo falhou:", e.message); }

    console.warn("⚠️ TTF: todas as fontes falharam, a usar valores estáticos");
  }

  return init();
}


function loadGasPT(force=false){
  const el=document.getElementById("gaspt-body");
  if(!el) return;

  const GASPT_SPREAD_MENSAL=[
    18.5, // Jan — pico Inverno
    16.2, // Fev
    14.8, // Mar
    12.4, // Abr
    10.1, // Mai
     9.2, // Jun — mínimo Verão
     9.0, // Jul
     9.5, // Ago
    10.8, // Set
    13.2, // Out
    15.6, // Nov
    17.9, // Dez — pico Inverno
  ];
  const GASPT_MESES=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  const GASPT_TREND_PREF_KEY = 'gaspt_trend_pref_v1';
  function getGasPTTrendPref() {
    try {
      const raw = localStorage.getItem(PFX + GASPT_TREND_PREF_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const days = [7, 30, 90].includes(parsed?.days) ? parsed.days : 30;
      return { days };
    } catch {
      return { days: 30 };
    }
  }
  function setGasPTTrendPref(patch) {
    const cur = getGasPTTrendPref();
    const next = { ...cur, ...patch };
    try { localStorage.setItem(PFX + GASPT_TREND_PREF_KEY, JSON.stringify(next)); } catch {}
    return next;
  }
  window.setGasPTTrendDays = function(days) {
    setGasPTTrendPref({ days });
    loadGasPTTrend(false).catch(() => {});
  };

  async function loadGasPTTrend(forceTrend = false) {
    const canvas = document.getElementById('gasptTrendCanvas');
    const statusEl = document.getElementById('gasptTrendStatus');
    const daysEl = document.getElementById('gasptTrendDays');
    if (!canvas || !statusEl || !daysEl) return;

    const pref = getGasPTTrendPref();
    _setOnByDataAttr(daysEl, 'data-days', pref.days);
    statusEl.textContent = 'A carregar tendência...';

    try {
      const ttf = await fetchStooqDailySeries('tg.f', 90, forceTrend);
      const mib = ttf.map(p => {
        const m = new Date(p.date + 'T00:00:00').getMonth();
        const spread = GASPT_SPREAD_MENSAL[m] ?? 0;
        return { date: p.date, timestamp: p.timestamp, value: Number(p.value) + spread };
      }).filter(x => Number.isFinite(x.value));

      const view = _lastN(mib, pref.days);
      if (view.length < 2) throw new Error('Histórico insuficiente');

      const first = view[0]?.value || 0;
      const last = view[view.length - 1]?.value || 0;
      const pct = first > 0 ? ((last - first) / first) * 100 : 0;
      const sign = pct > 0 ? '+' : '';

      renderTrendChart(canvas, view, {
        label: 'MIBGAS est.',
        borderColor: '#F97316',
        backgroundColor: 'rgba(249,115,22,0.12)',
        unit: ' €/MWh',
        decimals: 1
      });

      statusEl.innerHTML = `
        <span style="font-family:var(--mono);font-size:.56rem;color:var(--t3);text-transform:uppercase;letter-spacing:.5px">
          ${pref.days}D · MIBGAS est.
        </span>
        <span style="font-family:var(--mono);font-size:.56rem;color:${pct >= 0 ? 'var(--green)' : 'var(--red)'};margin-left:8px">
          ${sign}${pct.toFixed(1)}%
        </span>
        <span style="font-family:var(--mono);font-size:.56rem;color:var(--t3);margin-left:8px">
          último: ${last.toFixed(1)} €/MWh
        </span>`;
    } catch (e) {
      statusEl.textContent = (e && e.message) ? e.message : 'Tendência indisponível';
    }
  }

  /* ══════════════════════════════════════════════════════════════
     GÁS NATURAL PT — MIBGAS estimado via TTF live + spread sazonal
     Fonte TTF : Stooq tg.f (cache ttf_live_v1, partilhado com card TTF)
     Metodologia: MIBGAS ≈ TTF + spread sazonal
       O spread reflecte: custo GNL ibérico (Sines/Huelva/Bilbau),
       capacidade interligação França, sazonalidade inverno/verão.
     Tarifas ERSE: Deliberação Out 2025 (válidas até Out 2026)
     ══════════════════════════════════════════════════════════════ */

  const G=window.GAS_TARIFAS || {};
  const mes=new Date().getMonth();
  const spreadActual=GASPT_SPREAD_MENSAL[mes];
  const MESES=GASPT_MESES;

  /* Reutilizar cache TTF (já carregado pelo card Gás Natural · Hubs Europeus) */
  const ttfCache=lsGet("ttf_live_v1");
  const ttfPrice =ttfCache?.price??null;
  const ttfPrev  =ttfCache?.prev ??null;
  const ttfSrc   =ttfCache?.src  ??null;
  const isLive   =!!(ttfCache?.live);

  /* MIBGAS estimado */
  const mibSpot = G.mibgasSpot || 50;
  const mibEst =ttfPrice!=null?+(ttfPrice+spreadActual).toFixed(2):null;
  const mibPrev=ttfPrev !=null?+(ttfPrev +spreadActual).toFixed(2):(G.mibgasPrev || mibSpot);
  const mibRef =mibEst??mibSpot;
  try{ if (Number.isFinite(mibRef)) addToHistory('gaspt_mibgas_est', mibRef); }catch{}

  /* Variações */
  const mibChg=mibPrev ? ((mibRef-mibPrev)/mibPrev*100) : 0;
  const ttfChg=ttfPrice&&ttfPrev?((ttfPrice-ttfPrev)/ttfPrev*100):0;
  const mibCol=mibChg>=0?"#EF4444":"#10B981";
  const ttfCol=ttfChg>=0?"#EF4444":"#10B981";

  /* Sparkline 7 dias */
  const mib7 = G.mibgas7d || [mibSpot, mibSpot, mibSpot, mibSpot, mibSpot, mibSpot, mibSpot];
  const spark7=isLive&&ttfPrice
    ?mib7.map(v=>+(v+spreadActual*0.95).toFixed(1))
    :mib7;
  const wkChg=spark7[0] ? ((mibRef-spark7[0])/spark7[0]*100) : 0;
  const spread=ttfPrice?(mibRef-ttfPrice).toFixed(2):spreadActual.toFixed(2);

  const SW=120,SH=32;
  const s7min=Math.min(...spark7),s7max=Math.max(...spark7),s7rng=s7max-s7min||1;
  const spx=i=>Math.round(i/(spark7.length-1)*SW);
  const spy=v=>Math.round(SH-(v-s7min)/s7rng*(SH-4)+2);
  const spPts =spark7.map((v,i)=>`${spx(i)},${spy(v)}`).join(" ");
  const spFill=spPts+` ${SW},${SH+2} 0,${SH+2}`;

  /* Badge de fonte */
  const sourceBadge=isLive
    ?`<span style="font-size:.5rem;color:#10B981;background:#10B98115;border-radius:3px;padding:1px 6px">\u25cf ${ttfSrc||"Stooq"} live \u00b7 est.</span>`
    :`<span style="font-size:.5rem;color:#F59E0B;background:#F59E0B15;border-radius:3px;padding:1px 5px">\u26a0 est\u00e1tico \u00b7 ref. ${G.mibgasSpot.toFixed(2)}\u20ac</span>`;

  const mibLabel=isLive
    ?`MIBGAS est. (TTF+${spreadActual.toFixed(1)}\u20ac/MWh spread ${MESES[mes]})`
    :`MIBGAS ref. est\u00e1tico`;

  const trendPref = getGasPTTrendPref();
  el.innerHTML=`
  <!-- KPIs: MIBGAS estimado + TTF -->
  <div style="display:grid;grid-template-columns:1fr 1px 1fr;
       background:var(--b2);border-radius:10px;overflow:hidden;margin-bottom:10px">
    <!-- MIBGAS -->
    <div style="padding:10px 12px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
        <div style="font-size:.58rem;color:var(--t3);text-transform:uppercase;
             letter-spacing:.5px">MIBGAS \u00b7 Spot D
          <span style="font-size:.5rem;background:#F9731622;color:#F97316;
                border-radius:3px;padding:1px 4px;margin-left:3px">PT/ES</span>
        </div>
        ${sourceBadge}
      </div>
      <div style="display:flex;align-items:flex-end;gap:6px">
        <div style="font-size:2rem;font-weight:900;color:#F97316;line-height:1">
          ${mibRef.toFixed(2)}</div>
        <div style="font-size:.7rem;color:var(--t3);margin-bottom:3px">\u20ac/MWh</div>
      </div>
      <div style="font-size:.62rem;color:var(--t3);margin-top:1px">${mibLabel}</div>
      <div style="font-size:.7rem;font-weight:700;color:${mibCol};margin-top:3px">
        ${mibChg>=0?"\u25b2":"\u25bc"} ${Math.abs(mibChg).toFixed(1)}% vs fecho ant.
      </div>
      <div style="font-size:.62rem;color:${wkChg>=0?"#EF4444":"#10B981"};margin-top:1px">
        ${wkChg>=0?"\u25b2":"\u25bc"} ${Math.abs(wkChg).toFixed(1)}% vs semana
      </div>
    </div>
    <div style="background:var(--b)"></div>
    <!-- TTF -->
    <div style="padding:10px 12px">
      <div style="font-size:.58rem;color:var(--t3);text-transform:uppercase;
           letter-spacing:.5px;margin-bottom:4px">TTF Day-ahead
        <span style="font-size:.5rem;background:#3B82F622;color:#3B82F6;
              border-radius:3px;padding:1px 4px;margin-left:3px">\uD83C\uDDF3\uD83C\uDDF1 ref.</span>
      </div>
      <div style="display:flex;align-items:flex-end;gap:6px">
        <div style="font-size:2rem;font-weight:900;color:#3B82F6;line-height:1">
          ${ttfPrice!=null?ttfPrice.toFixed(2):G.ttfSpot.toFixed(2)}</div>
        <div style="font-size:.7rem;color:var(--t3);margin-bottom:3px">\u20ac/MWh</div>
      </div>
      <div style="font-size:.7rem;font-weight:700;color:${ttfCol};margin-top:2px">
        ${ttfChg>=0?"\u25b2":"\u25bc"} ${Math.abs(ttfChg).toFixed(1)}% vs fecho ant.
      </div>
      <div style="font-size:.62rem;color:#F59E0B;margin-top:1px">
        Spread MIBGAS\u2212TTF: +${spread} \u20ac/MWh
        <span class="help-tip" title="Spread MIBGAS-TTF: diferença entre o preço ibérico estimado e o hub europeu TTF; reflete custos regionais.">?</span>
      </div>
    </div>
  </div>

  <!-- Sparkline 7 dias -->
  <div style="background:var(--b2);border-radius:8px;padding:8px 10px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <div style="font-size:.6rem;color:var(--t3)">MIBGAS estimado \u00b7 \u00faltimos 7 dias</div>
      <div style="font-size:.6rem;color:#F97316;font-weight:600">
        ${spark7[0].toFixed(1)} \u2192 ${mibRef.toFixed(1)} \u20ac/MWh</div>
    </div>
    <svg width="${SW}" height="${SH+4}" style="display:block;width:100%">
      <defs><linearGradient id="mg2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#F97316" stop-opacity=".3"/>
        <stop offset="100%" stop-color="#F97316" stop-opacity="0"/>
      </linearGradient></defs>
      <polygon points="${spFill}" fill="url(#mg2)"/>
      <polyline points="${spPts}" fill="none" stroke="#F97316" stroke-width="2"/>
      <circle cx="${spx(spark7.length-1)}" cy="${spy(spark7[spark7.length-1])}"
              r="3" fill="#F97316"/>
    </svg>
    ${!isLive?`<div style="font-size:.52rem;color:#F59E0B;margin-top:3px">
      \u26a0 Sparkline estimado (aguarda carregamento do TTF)</div>`:""}
  </div>

  <div style="margin-top:10px;background:var(--surface);border:1px solid var(--b);border-radius:var(--rs);padding:8px 10px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px">
      <div id="gasptTrendStatus" style="flex:1;min-width:0"></div>
      <div id="gasptTrendDays" style="display:flex;gap:4px;flex-shrink:0">
        <button class="rbtn ${trendPref.days===7?'on':''}"  data-days="7"  onclick="setGasPTTrendDays(7)">7D</button>
        <button class="rbtn ${trendPref.days===30?'on':''}" data-days="30" onclick="setGasPTTrendDays(30)">30D</button>
        <button class="rbtn ${trendPref.days===90?'on':''}" data-days="90" onclick="setGasPTTrendDays(90)">90D</button>
      </div>
    </div>
    <div style="height:120px">
      <canvas id="gasptTrendCanvas"></canvas>
    </div>
  </div>

  <!-- Spread sazonal visual -->
  <div style="background:var(--b2);border-radius:8px;padding:8px 10px;margin-bottom:10px">
    <div style="font-size:.62rem;font-weight:700;color:var(--t2);margin-bottom:5px">
      \uD83D\uDCCA Spread MIBGAS\u2212TTF \u00b7 sazonalidade
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
      <div style="font-size:.82rem;font-weight:800;color:#F97316">${spreadActual.toFixed(1)} \u20ac/MWh</div>
      <div style="font-size:.62rem;color:var(--t3)">spread ${MESES[mes]} \u2192 est\u00e1vel \u00b1 2 \u20ac/MWh</div>
    </div>
    <div style="display:flex;gap:1px;height:10px;border-radius:4px;overflow:hidden;margin-bottom:3px">
      ${GASPT_SPREAD_MENSAL.map((s,i)=>{
        const h=((s-9)/(18.5-9)*100).toFixed(0);
        const col=s>15?"#EF4444":s>12?"#F59E0B":"#10B981";
        const isCur=i===mes;
        return `<div style="flex:1;background:${col};opacity:${isCur?1:0.35};
          ${isCur?"box-shadow:0 0 0 1px white;z-index:1;":""}"
          title="${MESES[i]}: +${s}\u20ac"></div>`;
      }).join("")}
    </div>
    <div style="display:flex;justify-content:space-between;font-size:.52rem;color:var(--t3)">
      ${GASPT_SPREAD_MENSAL.map((_,i)=>`<span>${MESES[i]}</span>`).join("")}
    </div>
    <div style="font-size:.56rem;color:var(--t3);margin-top:5px;line-height:1.4">
      Spread inclui: terminais GNL Sines/Huelva/Bilbau + custo transporte ibérico.
      Inverno: maior procura \u2192 spread alto. Verão: armazenamento alto \u2192 spread baixo.
    </div>
  </div>

  <!-- Tarifas ERSE -->
  <div style="font-size:.62rem;font-weight:700;color:var(--t2);margin-bottom:5px">
    \uD83D\uDCCB Tarifas ERSE 2025-2026 \u00b7 consumidor doméstico BTN
  </div>
  ${[G.esc1,G.esc2].map(e=>`
    <div style="background:var(--b2);border-radius:7px;padding:6px 10px;margin-bottom:4px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:.65rem;font-weight:600;color:var(--text)">${e.label}</div>
          <div style="font-size:.56rem;color:var(--t3)">${e.desc}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:.75rem;font-weight:700;color:#10B981">${e.kwh.toFixed(4)} \u20ac/kWh</div>
          <div style="font-size:.54rem;color:var(--t3)">energia</div>
        </div>
      </div>
    </div>`).join("")}
  <div style="background:var(--b2);border-radius:7px;padding:6px 10px;margin-bottom:4px">
    <div style="display:flex;justify-content:space-between">
      <div style="font-size:.65rem;color:var(--t2)">Tarifa de acesso às redes</div>
      <div style="font-size:.65rem;font-weight:600;color:var(--text)">${G.redes.toFixed(4)} \u20ac/kWh</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:4px">
    <div style="background:var(--b2);border-radius:6px;padding:5px 8px;text-align:center">
      <div style="font-size:.75rem;font-weight:700;color:#10B981">${G.totalEsc1.toFixed(4)} \u20ac/kWh</div>
      <div style="font-size:.54rem;color:var(--t3)">Total Esc. 1 c/ IVA 6%</div>
    </div>
    <div style="background:var(--b2);border-radius:6px;padding:5px 8px;text-align:center">
      <div style="font-size:.75rem;font-weight:700;color:#10B981">${G.totalEsc2.toFixed(4)} \u20ac/kWh</div>
      <div style="font-size:.54rem;color:var(--t3)">Total Esc. 2 c/ IVA 6%</div>
    </div>
  </div>
  <div style="font-size:.56rem;color:var(--t3);margin-top:4px">
    Termo fixo: ${G.termoFixo.toFixed(2)} €/mês · IVA 6% incluído · Fonte: ERSE Deliberação Oct 2025
  </div>`;

  loadGasPTTrend(false).catch(()=>{});
}

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
  setPSI20TrendPref({ days });
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
    statusEl.textContent = (e && e.message) ? e.message : 'Histórico indisponível';
  }
}

	async function loadPSI20(force=false){
	  const el=document.getElementById("psi20-body");
	  if(!el) return;
	  el.innerHTML=`<div style="padding:20px;text-align:center;color:var(--t3);font-size:.7rem">${ld()}</div>`;

    const CK="psi20_v2";
	  let cache=force?null:lsGet(CK);

    /* Verificar se mercado está fechado (Lisboa: Fim de semana) */
    const now = new Date();
    const isWeekend = (now.getDay() === 0 || now.getDay() === 6);
    
    /* Se tivermos cache válida de hoje/ontem e for fim de semana, não forçar fetch */
    if (!force && isWeekend && cache && (Date.now() - cache.ts < 48 * 3600000)) {
      console.log("📈 PSI20: Mercado fechado (fim-de-semana), a usar cache.");
    } else if (!cache) {
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

	    /* Fetch paralelo de todos os símbolos */
	    const allSyms=[...EU_INDICES,...PSI20_CONST];
	    const yahooRes = await Promise.allSettled(allSyms.map(s => fetchYahoo(s.yf)));
	    
	    const needsStooq = allSyms.filter((s, i) => yahooRes[i].status !== 'fulfilled' || !yahooRes[i].value);
	    let stooqResults = {};
	    if (needsStooq.length > 0) {
	      stooqResults = await fetchStooqMulti(needsStooq.map(s => s.sym));
	    }

	    const results = allSyms.map((s, i) => {
	      if (yahooRes[i].status === 'fulfilled' && yahooRes[i].value) return yahooRes[i].value;
	      return stooqResults[s.sym.toLowerCase()] || null;
	    });

      const mkFallback=(s)=>({
        price:s.fallback,
        prev:s.fallback/(1+(s.fChg||0)/100),
        hi:s.fallback*1.005, lo:s.fallback*0.995,
        chg:s.fChg||0, vol:0, live:false
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

  const liveTag=cache.live
    ? `<span class="badge live">● ${(cache.src||"live").toUpperCase()}</span>`
    : `<span class="badge warn">⚠ FALLBACK ${REF_DATE.full.toUpperCase()}</span>`;

  el.innerHTML=`
  <div style="display:grid;grid-template-columns:auto 1fr;gap:12px;margin-bottom:8px;align-items:start">
    <div style="background:var(--b2);border-radius:10px;padding:10px 14px;min-width:160px;border-left:4px solid #10B981">
      <div style="font-size:.54rem;color:var(--t3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px">PSI 20 · Lisboa</div>
      <div style="font-size:2rem;font-weight:900;color:#10B981;line-height:1;letter-spacing:-1px">${psi.price.toFixed(0)}</div>
      <div style="font-size:.72rem;font-weight:700;color:${psiCol};margin-top:3px">${psiArr} ${Math.abs(psiChg).toFixed(2)}%</div>
      <div style="display:flex;gap:8px;margin-top:4px;font-size:.55rem;color:var(--t3)">
        <span>H <b style="color:var(--t2)">${psi.hi.toFixed(0)}</b></span>
        <span>L <b style="color:var(--t2)">${psi.lo.toFixed(0)}</b></span>
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
              ${q.price>1000?q.price.toLocaleString("pt",{maximumFractionDigits:0}):q.price.toFixed(2)}</div>
            <div style="font-size:.6rem;font-weight:600;color:${c}">${q.chg>=0?"▲":"▼"}${Math.abs(q.chg).toFixed(2)}%</div>
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
              ${q.price<1?q.price.toFixed(3):q.price.toFixed(2)}€</div>
            <div style="font-size:.6rem;font-weight:600;color:${c}">${q.chg>=0?"▲":"▼"}${Math.abs(q.chg).toFixed(2)}%</div>
          </div>
          ${miniBar(q.chg)}
        </div>
      </div>`;
    }).join("")}
  </div>
  <div style="font-size:.52rem;color:var(--t3);margin-top:6px;line-height:1.4">
    ✦ Fonte principal: ${(cache.src==="yahoo"?"Yahoo Finance":"Stooq")} · Euronext Lisboa (.LS) · 
    ${cache.live?(cache.src==="yahoo"?"Dados em tempo-real (atraso 15m)":"Último fecho disponível"):"Dados estáticos (fallback "+REF_DATE.full+")"}
  </div>`;

  loadPSI20Trend(false).catch(()=>{});
}


/* Salário mínimo e comparação europeia movidos para src/cards/smn.js */




/* Transportes PT movido para src/cards/transport.js */


/* Liberdade de imprensa movida para src/cards/press.js */



/* Sismos movido para src/cards/seis.js */


/* Emissões CO₂ movidas para src/cards/co2.js */


/* ══════════════════════════════════════════════════════════════
   SISTEMA DE OTIMIZAÇÃO DE PERFORMANCE
   ══════════════════════════════════════════════════════════════ */

// ──────────────────────────────────────────────────────────────
// DEBOUNCE & THROTTLE
// ──────────────────────────────────────────────────────────────

/**
 * Debounce - Executa função após delay sem novas chamadas
 * Ideal para: resize, input, scroll (quando só importa o valor final)
 */
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle - Limita execuções a uma por intervalo
 * Ideal para: scroll events, mousemove (executa periodicamente)
 */
function throttle(func, limit = 300) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ──────────────────────────────────────────────────────────────
// LAZY LOADING COM INTERSECTION OBSERVER
// ──────────────────────────────────────────────────────────────

const lazyLoadQueue = new Map();
let lazyObserver = null;

/**
 * Inicializa Intersection Observer para lazy loading
 */
function initLazyLoading() {
  if (!('IntersectionObserver' in window)) {
    console.warn('IntersectionObserver não suportado. Carregando tudo imediatamente.');
    return false;
  }

  const options = {
    root: null,
    rootMargin: '50px', // Carregar 50px antes de entrar na viewport
    threshold: 0.01
  };

  lazyObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const element = entry.target;
        const loadFunc = lazyLoadQueue.get(element);
        
        if (loadFunc) {
          console.log('🚀 Lazy loading:', element.dataset.lazyId || element.id);
          loadFunc();
          lazyLoadQueue.delete(element);
          lazyObserver.unobserve(element);
        }
      }
    });
  }, options);

  console.log('✅ Lazy Loading ativado');
  return true;
}

/**
 * Registra elemento para lazy loading
 * @param {HTMLElement} element - Elemento a observar
 * @param {Function} loadFunc - Função a executar quando visível
 */
function registerLazyLoad(element, loadFunc) {
  if (!lazyObserver) return false;
  
  lazyLoadQueue.set(element, loadFunc);
  lazyObserver.observe(element);
  return true;
}

// ──────────────────────────────────────────────────────────────
// CACHE INTELIGENTE
// ──────────────────────────────────────────────────────────────

const cacheConfig = {
  weather: 15 * 60 * 1000,      // 15 minutos
  news: 10 * 60 * 1000,         // 10 minutos
  finance: 5 * 60 * 1000,       // 5 minutos
  crypto: 2 * 60 * 1000,        // 2 minutos
  static: 24 * 60 * 60 * 1000   // 24 horas
};

/**
 * Verifica se cache é válido
 */
function isCacheValid(key) {
  const cached = localStorage.getItem(key);
  if (!cached) return false;
  
  try {
    const data = JSON.parse(cached);
    const now = Date.now();
    const age = now - (data.timestamp || 0);
    
    // Determinar TTL baseado na chave
    let ttl = cacheConfig.static;
    for (const [prefix, time] of Object.entries(cacheConfig)) {
      if (key.includes(prefix)) {
        ttl = time;
        break;
      }
    }
    
    return age < ttl;
  } catch {
    return false;
  }
}

/**
 * Salva dados no cache com timestamp
 */
function setCacheData(key, data) {
  const cacheObj = {
    data: data,
    timestamp: Date.now()
  };
  
  try {
    localStorage.setItem(key, JSON.stringify(cacheObj));
    return true;
  } catch (e) {
    console.warn('Cache overflow:', e);
    cleanOldCache();
    return false;
  }
}

/**
 * Recupera dados do cache
 */
function getCacheData(key) {
  if (!isCacheValid(key)) return null;
  
  try {
    const cached = JSON.parse(localStorage.getItem(key));
    return cached.data;
  } catch {
    return null;
  }
}

/**
 * Limpa cache antigo
 */
function cleanOldCache() {
  const keys = Object.keys(localStorage);
  const now = Date.now();
  
  keys.forEach(key => {
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (data.timestamp && (now - data.timestamp) > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(key);
      }
    } catch {}
  });
}

// ──────────────────────────────────────────────────────────────
// REQUEST ANIMATION FRAME PARA ANIMAÇÕES
// ──────────────────────────────────────────────────────────────

/**
 * Executa callback na próxima frame (60fps)
 */
function nextFrame(callback) {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback);
  });
}

/**
 * Batch de updates para evitar reflows múltiplos
 */
let updateQueue = [];
let isUpdating = false;

function batchUpdate(updateFunc) {
  updateQueue.push(updateFunc);
  
  if (!isUpdating) {
    isUpdating = true;
    requestAnimationFrame(() => {
      const batch = [...updateQueue];
      updateQueue = [];
      batch.forEach(fn => fn());
      isUpdating = false;
    });
  }
}

// ──────────────────────────────────────────────────────────────
// OTIMIZAÇÃO DE EVENTOS
// ──────────────────────────────────────────────────────────────

// Debounced resize
const optimizedResize = debounce(() => {
  window.dispatchEvent(new Event('optimizedResize'));
}, 250);

window.addEventListener('resize', optimizedResize);

// Throttled scroll
const optimizedScroll = throttle(() => {
  window.dispatchEvent(new Event('optimizedScroll'));
}, 100);

window.addEventListener('scroll', optimizedScroll, { passive: true });

// ──────────────────────────────────────────────────────────────
// BUNDLE DE CARREGAMENTOS
// ──────────────────────────────────────────────────────────────

const loadQueue = {
  immediate: [],    // 0-100ms
  fast: [],         // 100-500ms
  normal: [],       // 500-1000ms
  slow: [],         // 1000-2000ms
  lazy: []          // quando visível
};

/**
 * Agenda carregamento de dados
 * @param {Function} func - Função a executar
 * @param {String} priority - 'immediate', 'fast', 'normal', 'slow', 'lazy'
 */
function scheduleLoad(func, priority = 'normal') {
  loadQueue[priority].push(func);
}

/**
 * Executa fila de carregamentos de forma otimizada
 */
function executeLoadQueue() {
  // Immediate
  loadQueue.immediate.forEach(fn => fn());
  loadQueue.immediate = [];
  
  // Fast
  setTimeout(() => {
    loadQueue.fast.forEach(fn => fn());
    loadQueue.fast = [];
  }, 100);
  
  // Normal
  setTimeout(() => {
    loadQueue.normal.forEach(fn => fn());
    loadQueue.normal = [];
  }, 500);
  
  // Slow
  setTimeout(() => {
    loadQueue.slow.forEach(fn => fn());
    loadQueue.slow = [];
  }, 1000);
  
  // Lazy é executado pelo IntersectionObserver
}

// ──────────────────────────────────────────────────────────────
// PERFORMANCE MONITOR
// ──────────────────────────────────────────────────────────────

const perfMonitor = {
  marks: {},
  measures: {}
};

function perfMark(name) {
  perfMonitor.marks[name] = performance.now();
}

function perfMeasure(name, startMark) {
  if (!perfMonitor.marks[startMark]) return;
  
  const duration = performance.now() - perfMonitor.marks[startMark];
  perfMonitor.measures[name] = duration;
  
  if (duration > 100) {
    console.warn(`⚠️ Operação lenta: ${name} levou ${duration.toFixed(2)}ms`);
  }
  
  return duration;
}

function perfReport() {
  console.group('📊 Performance Report');
  Object.entries(perfMonitor.measures).forEach(([name, duration]) => {
    const status = duration < 50 ? '✅' : duration < 100 ? '⚠️' : '❌';
    console.log(`${status} ${name}: ${duration.toFixed(2)}ms`);
  });
  console.groupEnd();
}

// ──────────────────────────────────────────────────────────────
// INICIALIZAÇÃO DO SISTEMA DE PERFORMANCE
// ──────────────────────────────────────────────────────────────

console.log('⚡ Sistema de Performance carregado!');


/* ══════════════════════════════════════════════════════════════
   SISTEMA DE PERSONALIZAÇÃO
   ══════════════════════════════════════════════════════════════ */

// Configurações padrão
const DEFAULT_CONFIG = {
  cards: [
    { id: 'weather',    name: 'Meteorologia & Feriados',  desc: 'Clima, previsão 5 dias e feriados PT',        visible: true, icon: '🌡️' },
    { id: 'fuel',       name: 'Combustíveis',              desc: 'Preços gasolina/gasóleo · API Aberta PT',     visible: true, icon: '⛽' },
    { id: 'cabaz',      name: 'Cabaz Alimentar',           desc: '63 produtos essenciais · DECO PROteste',      visible: true, icon: '🛒' },
    { id: 'oil',        name: 'Petróleo',                  desc: 'Brent & WTI · TradingView live',              visible: true, icon: '🛢️' },
    { id: 'gas-eu',     name: 'Gás Natural EU',            desc: 'Hubs europeus · TTF, MIBGAS, NBP…',          visible: true, icon: '🔥' },
    { id: 'gas-pt',     name: 'Gás Natural PT',            desc: 'MIBGAS · Tarifas ERSE 2025-2026',             visible: true, icon: '🇵🇹' },
    { id: 'elec',       name: 'Eletricidade',              desc: 'Spot MIBEL · mix energético · tarifas',      visible: true, icon: '⚡' },
    { id: 'airquality', name: 'Qualidade do Ar',           desc: 'CAMS/Copernicus · 5 poluentes + UV',          visible: true, icon: '🌬️' },
    { id: 'dams',       name: 'Barragens',                 desc: 'Armazenamento bacias · SNIRH/APA',           visible: true, icon: '💧' },
    { id: 'euribor',    name: 'Euribor',                   desc: 'Taxas BCE live · spread bancário PT',        visible: true, icon: '📐' },
    { id: 'imob',       name: 'Imobiliário',               desc: 'Habitação Portugal · INE',                   visible: true, icon: '🏠' },
    { id: 'fng',        name: 'Fear & Greed',              desc: 'Sentimento cripto · Alternative.me',          visible: true, icon: '😰' },
    { id: 'rec',        name: 'Recessão EUA',              desc: 'US 10Y-2Y Spread · FRED St. Louis',          visible: true, icon: '📉' },
    { id: 'agri',       name: 'Preços Agrícolas',          desc: 'Futuros CBOT/ICE · Commodities',             visible: true, icon: '🌾' },
    { id: 'exp',        name: 'Exportações PT',            desc: 'Destinos e produtos · INE/AICEP',            visible: true, icon: '📦' },
    { id: 'div',        name: 'Dívida Pública',            desc: '% PIB · Eurostat 2024',                      visible: true, icon: '🏛️' },
    { id: 'air',        name: 'Tráfego Aéreo',             desc: 'OpenSky Network · Lisboa live',              visible: true, icon: '✈️' },
    { id: 'seis',       name: 'Sismos',                    desc: 'Ibéria & Açores · USGS mag ≥ 0.5',           visible: true, icon: '🌍' },
    { id: 'ormuz',      name: 'Estreito de Ormuz',          desc: 'AIS data · Tráfego marítimo real/sim.',      visible: true, icon: '🚢' },
    { id: 'smn',        name: 'Salário & Custo Vida',      desc: 'SMN, cabaz e poder de compra · PT',          visible: true, icon: '💼' },
    { id: 'transp',     name: 'Transportes PT',            desc: 'Tarifas de referência · horários CP',       visible: true, icon: '🚆' },
    { id: 'finance',    name: 'Gráfico de Mercados',       desc: 'TradingView Advanced Chart · Full width',     visible: true, icon: '📈' },
    { id: 'psi20',      name: 'Bolsa de Lisboa',           desc: 'PSI 20 constituíntes · Yahoo Finance',       visible: true, icon: '🇵🇹' },
    { id: 'heatmap',    name: 'Mapa de Calor',             desc: 'S&P 500, Crypto, ETFs · TradingView',        visible: true, icon: '🌡️' },
    { id: 'fx',         name: 'Câmbio EUR',                desc: 'BCE · Taxas de conversão live',              visible: true, icon: '💱' },
    { id: 'crypto',     name: 'Criptomoedas',              desc: 'BTC, ETH e Top Altcoins · CoinGecko',        visible: true, icon: '₿' },
    { id: 'inf',        name: 'Inflação PT/EU',            desc: 'PRC_HICP · Eurostat auto-update',            visible: true, icon: '📊' },
    { id: 'mstats',     name: 'Indicadores Mercado',       desc: '🔭 Gold, Commodities, Spread BCE',           visible: true, icon: '🔭' },
    { id: 'cal',        name: 'Calendário Económico',      desc: 'Próximos eventos Fed/BCE/INE',               visible: true, icon: '📅' },
    { id: 'conflicts',  name: 'Conflitos Globais',         desc: '🗺️ Mapa de tensão e guerras activas',         visible: true, icon: '🗺️' },
    { id: 'geo',        name: 'Análise Geopolítica',       desc: '📡 Satélite e análise estratégica',          visible: true, icon: '🛰️' },
    { id: 'co2',        name: 'Emissões CO₂',              desc: 'Mix energético PT · DGEG/REN 2024',          visible: true, icon: '🌱' },
    { id: 'press',      name: 'Liberdade Imprensa',        desc: 'RSF 2026 · EIU 2024 histórico',              visible: true, icon: '🗽' },
    { id: 'news-pt',    name: 'Notícias Portugal',         desc: 'Google News RSS · PT · tempo real',          visible: true, icon: '📰' },
    { id: 'news-world', name: 'Notícias Mundo',            desc: 'Google News RSS · Mundo · tempo real',       visible: true, icon: '🌍' }
  ],
  location: 'lisboa',
  tickers: ['BCP', 'EDP', 'GALP', 'JMT'],
  comfort: { density: 'compact', motion: 'auto' }
};

/**
 * Sincroniza a configuração do utilizador com o DEFAULT_CONFIG
 * Adiciona novos cards que tenham sido criados no código
 */
function syncDashboardConfig(userConfig) {
  if (!userConfig || !userConfig.cards) return DEFAULT_CONFIG;
  
  const updatedCards = [...userConfig.cards];
  const userCardIds = new Set(updatedCards.map(c => c.id));
  
  // Adicionar cards que existem no DEFAULT mas não no utilizador
  DEFAULT_CONFIG.cards.forEach(defaultCard => {
    if (!userCardIds.has(defaultCard.id)) {
      console.log(`🆕 Sincronização: Adicionando novo card "${defaultCard.id}"`);
      updatedCards.push({ ...defaultCard });
    }
  });
  
  // Atualizar nomes/descrições/ícones dos cards existentes (mantendo visibilidade)
  updatedCards.forEach((card, index) => {
    const dc = DEFAULT_CONFIG.cards.find(c => c.id === card.id);
    if (dc) {
      updatedCards[index] = { ...dc, visible: card.visible };
    }
  });
  
  const merged = { ...DEFAULT_CONFIG, ...userConfig, cards: updatedCards };
  merged.comfort = normalizeComfortConfig({ ...DEFAULT_CONFIG.comfort, ...(userConfig.comfort || {}) });
  if (!Array.isArray(merged.tickers)) merged.tickers = [...DEFAULT_CONFIG.tickers];
  if (typeof merged.location !== 'string') merged.location = DEFAULT_CONFIG.location;
  return merged;
}

// Localizações disponíveis
const LOCATIONS = [
  { id: 'lisboa', name: 'Lisboa', region: 'Região de Lisboa', lat: 38.7223, lon: -9.1393 },
  { id: 'porto', name: 'Porto', region: 'Região do Porto', lat: 41.1579, lon: -8.6291 },
  { id: 'coimbra', name: 'Coimbra', region: 'Centro', lat: 40.2033, lon: -8.4103 },
  { id: 'braga', name: 'Braga', region: 'Norte', lat: 41.5454, lon: -8.4265 },
  { id: 'faro', name: 'Faro', region: 'Algarve', lat: 37.0194, lon: -7.9322 },
  { id: 'evora', name: 'Évora', region: 'Alentejo', lat: 38.5665, lon: -7.9073 },
  { id: 'setubal', name: 'Setúbal', region: 'Península Setúbal', lat: 38.5244, lon: -8.8882 },
  { id: 'aveiro', name: 'Aveiro', region: 'Centro Litoral', lat: 40.6443, lon: -8.6455 },
  { id: 'viseu', name: 'Viseu', region: 'Centro Interior', lat: 40.6566, lon: -7.9122 },
  { id: 'funchal', name: 'Funchal', region: 'Madeira', lat: 32.6669, lon: -16.9241 },
  { id: 'ponta-delgada', name: 'Ponta Delgada', region: 'Açores', lat: 37.7412, lon: -25.6756 }
];

// Estado atual (carregado do localStorage)
let currentConfig = JSON.parse(localStorage.getItem('dashboardConfig')) || JSON.parse(JSON.stringify(DEFAULT_CONFIG));

// Sincronizar com DEFAULT_CONFIG para garantir novos cards
currentConfig = syncDashboardConfig(currentConfig);

// Drag & Drop state
let draggedElement = null;

// A11y: restaurar foco ao fechar modais
let lastFocusSettings = null;
let lastFocusExport = null;

// Conforto: snapshot para preview sem guardar
let comfortSnapshot = null;
let comfortPreviewDirty = false;

// Pesquisa de cards no Settings (não persiste)
let cardSearchQuery = '';

// ──────────────────────────────────────────────────────────────
// FUNÇÕES DE UI
// ──────────────────────────────────────────────────────────────

function openSettings() {
  lastFocusSettings = document.activeElement;
  const overlay = document.getElementById('settingsOverlay');
  
  if (!overlay) {
    console.error('Overlay não encontrado!');
    return;
  }
  
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden', 'false');
  const btn = document.getElementById('settingsOpenBtn');
  if (btn) btn.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';

  // Snapshot para permitir preview sem guardar
  try {
    comfortSnapshot = normalizeComfortConfig(currentConfig.comfort);
  } catch {
    comfortSnapshot = { ...DEFAULT_CONFIG.comfort };
  }
  comfortPreviewDirty = false;
  
  // Sincronizar campo de pesquisa antes do render
  syncCardSearchInput();

  // Renderizar conteúdo
  renderCardToggles();
  renderLocationGrid();
  renderTickerList();
  renderComfortControls();

  // Foco inicial (teclado)
  const closeBtn = document.querySelector('.settings-close');
  if (closeBtn) closeBtn.focus();
}

function closeSettings() {
  const overlay = document.getElementById('settingsOverlay');
  overlay.classList.remove('show');
  overlay.setAttribute('aria-hidden', 'true');
  const btn = document.getElementById('settingsOpenBtn');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';

  // Reverter preview de conforto se não foi guardado
  if (comfortPreviewDirty && comfortSnapshot) {
    currentConfig.comfort = { ...DEFAULT_CONFIG.comfort, ...comfortSnapshot };
    try { applyComfortSettings(currentConfig.comfort); } catch {}
  }
  comfortSnapshot = null;
  comfortPreviewDirty = false;

  const target = lastFocusSettings || btn;
  if (target && typeof target.focus === 'function') target.focus();
  lastFocusSettings = null;
}

// ──────────────────────────────────────────────────────────────
// A11y: Focus trap para modais (Tab não sai do diálogo)
// ──────────────────────────────────────────────────────────────

function getActiveDialogEl() {
  const exportModal = document.getElementById('exportModal');
  if (exportModal && exportModal.classList.contains('show')) return exportModal;
  const settingsOverlay = document.getElementById('settingsOverlay');
  if (settingsOverlay && settingsOverlay.classList.contains('show')) return settingsOverlay;
  const fuelModal = document.getElementById('fuelModal');
  if (fuelModal && fuelModal.classList.contains('show')) return fuelModal;
  return null;
}

function getFocusableElements(container) {
  if (!container) return [];
  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  return Array.from(container.querySelectorAll(selectors))
    .filter(el => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.hasAttribute('disabled')) return false;
      const style = window.getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') return false;
      return el.getClientRects().length > 0;
    });
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const dialog = getActiveDialogEl();
  if (!dialog) return;

  const focusables = getFocusableElements(dialog);
  if (focusables.length === 0) {
    e.preventDefault();
    dialog.focus();
    return;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  const containsActive = active && dialog.contains(active);

  if (!containsActive) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
    return;
  }

  if (e.shiftKey) {
    if (active === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (active === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

function switchSettingsTab(tabName, element) {
  // Desativar todos os tabs
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.settings-section').forEach(section => {
    section.classList.remove('active');
  });
  
  // Ativar tab clicado
  if (element) {
    element.classList.add('active');
  } else {
    // Fallback: ativar o tab pelo nome
    const tabs = document.querySelectorAll('.settings-tab');
    tabs.forEach(tab => {
      if (tab.textContent.toLowerCase().includes(tabName.toLowerCase())) {
        tab.classList.add('active');
      }
    });
  }
  document.getElementById(`settings-${tabName}`).classList.add('active');
}

// ──────────────────────────────────────────────────────────────
// SETTINGS: PESQUISA DE CARDS
// ──────────────────────────────────────────────────────────────

function syncCardSearchInput() {
  const input = document.getElementById('cardSearchInput');
  if (input && input.value !== cardSearchQuery) input.value = cardSearchQuery;
  updateCardSearchUI();
}

function updateCardSearchUI(meta = null) {
  const btn = document.getElementById('cardSearchClearBtn');
  if (btn) btn.style.visibility = cardSearchQuery.trim() ? 'visible' : 'hidden';

  const hint = document.getElementById('cardSearchHint');
  if (!hint) return;

  const q = cardSearchQuery.trim();
  if (!q) {
    hint.textContent = '';
    return;
  }
  if (meta && Number.isFinite(meta.matches) && Number.isFinite(meta.total)) {
    hint.textContent = `A mostrar ${meta.matches} de ${meta.total} · limpe a pesquisa para reordenar por drag & drop`;
  } else {
    hint.textContent = 'Limpe a pesquisa para reordenar por drag & drop';
  }
}

function clearCardSearch() {
  cardSearchQuery = '';
  const input = document.getElementById('cardSearchInput');
  if (input) {
    input.value = '';
    input.focus();
  }
  updateCardSearchUI();
  renderCardToggles();
}

// ──────────────────────────────────────────────────────────────
// CONFORTO (DENSIDADE / MOTION)
// ──────────────────────────────────────────────────────────────

function normalizeComfortConfig(comfort) {
  const density = comfort?.density === 'comfortable' ? 'comfortable' : 'compact';
  const legacyReduced = typeof comfort?.reducedMotion === 'boolean' ? comfort.reducedMotion : null;
  const motionRaw = typeof comfort?.motion === 'string' ? comfort.motion : null;
  const motion =
    motionRaw === 'full' || motionRaw === 'reduce' || motionRaw === 'auto'
      ? motionRaw
      : legacyReduced === true
        ? 'reduce'
        : 'auto';
  return { density, motion };
}

function applyComfortSettings(comfort) {
  const cfg = normalizeComfortConfig({ ...DEFAULT_CONFIG.comfort, ...(comfort || {}) });
  document.documentElement.dataset.density = cfg.density;
  document.documentElement.dataset.motion = cfg.motion;

  // Se o painel estiver aberto, refletir estado nos controles
  document.querySelectorAll('.comfort-seg-btn').forEach(btn => {
    if (btn.dataset.density) btn.classList.toggle('active', btn.dataset.density === cfg.density);
    if (btn.dataset.motion) btn.classList.toggle('active', btn.dataset.motion === cfg.motion);
  });
}

function renderComfortControls() {
  // Garantir defaults no estado atual
  currentConfig.comfort = { ...DEFAULT_CONFIG.comfort, ...(currentConfig.comfort || {}) };
  applyComfortSettings(currentConfig.comfort);
}

function setComfortDensity(density) {
  currentConfig.comfort = { ...DEFAULT_CONFIG.comfort, ...(currentConfig.comfort || {}), density };
  comfortPreviewDirty = true;
  applyComfortSettings(currentConfig.comfort);
}

function setComfortMotion(motion) {
  currentConfig.comfort = { ...DEFAULT_CONFIG.comfort, ...(currentConfig.comfort || {}), motion };
  comfortPreviewDirty = true;
  applyComfortSettings(currentConfig.comfort);
}

// ──────────────────────────────────────────────────────────────
// CARDS TOGGLE & DRAG/DROP
// ──────────────────────────────────────────────────────────────

function renderCardToggles() {
  console.log('renderCardToggles chamado');
  const container = document.getElementById('cardToggles');
  
  if (!container) {
    console.error('Container cardToggles não encontrado!');
    return;
  }
  
  container.innerHTML = '';
  console.log('Renderizando', currentConfig.cards.length, 'cards');

  const q = normalizeStr(cardSearchQuery || '').trim();
  let matches = 0;
  const total = currentConfig.cards.length;
  
  currentConfig.cards.forEach((card, index) => {
    if (q) {
      const hay = normalizeStr(`${card.icon || ''} ${card.name || ''} ${card.desc || ''} ${card.id || ''}`);
      if (!hay.includes(q)) return;
    }
    matches++;
    const div = document.createElement('div');
    div.className = `card-toggle-item ${q ? 'no-drag' : ''}`;
    div.draggable = !q;
    div.dataset.index = index;
    
    div.innerHTML = `
      <div class="drag-handle">⋮⋮</div>
      <div class="card-toggle-info">
        <div class="card-toggle-name">${card.icon} ${card.name}</div>
        <div class="card-toggle-desc">${card.desc}</div>
      </div>
      <div class="card-order-controls">
        <button class="card-order-btn" ${index === 0 ? 'disabled' : ''} onclick="moveCard(${index}, -1)" title="Mover para cima">↑</button>
        <button class="card-order-btn" ${index === currentConfig.cards.length - 1 ? 'disabled' : ''} onclick="moveCard(${index}, 1)" title="Mover para baixo">↓</button>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" ${card.visible ? 'checked' : ''} 
               onchange="toggleCardVisibility(${index})">
        <span class="toggle-slider"></span>
      </label>
    `;
    
    if (!q) {
      // Drag events
      div.addEventListener('dragstart', handleDragStart);
      div.addEventListener('dragend', handleDragEnd);
      div.addEventListener('dragenter', handleDragEnter);
      div.addEventListener('dragleave', handleDragLeave);
      div.addEventListener('dragover', handleDragOver);
      div.addEventListener('drop', handleDrop);
    }
    
    container.appendChild(div);
  });

  updateCardSearchUI(q ? { matches, total } : null);
}

function handleDragStart(e) {
  draggedElement = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  document.querySelectorAll('.card-toggle-item').forEach(item => {
    item.classList.remove('drag-over');
  });
}

function handleDragEnter(e) {
  if (this !== draggedElement) {
    this.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  this.classList.remove('drag-over');
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  
  if (draggedElement !== this) {
    const fromIndex = Number.parseInt(draggedElement.dataset.index, 10);
    let toIndex = Number.parseInt(this.dataset.index, 10);
    if (!Number.isFinite(fromIndex) || !Number.isFinite(toIndex)) return false;
    
    // Reordenar array
    const item = currentConfig.cards.splice(fromIndex, 1)[0];
    // Se arrastar para baixo, o índice destino muda após remover o item
    if (fromIndex < toIndex) toIndex -= 1;
    currentConfig.cards.splice(toIndex, 0, item);
    
    // Re-renderizar
    renderCardToggles();
  }
  
  return false;
}

function toggleCardVisibility(index) {
  currentConfig.cards[index].visible = !currentConfig.cards[index].visible;
}

function moveCard(fromIndex, direction) {
  const toIndex = fromIndex + direction;
  if (toIndex < 0 || toIndex >= currentConfig.cards.length) return;
  const item = currentConfig.cards.splice(fromIndex, 1)[0];
  currentConfig.cards.splice(toIndex, 0, item);
  renderCardToggles();
}

// ──────────────────────────────────────────────────────────────
// LOCALIZAÇÃO
// ──────────────────────────────────────────────────────────────

function renderLocationGrid() {
  const container = document.getElementById('locationGrid');
  container.innerHTML = '';
  
  LOCATIONS.forEach(loc => {
    const div = document.createElement('div');
    div.className = `location-item ${currentConfig.location === loc.id ? 'selected' : ''}`;
    div.onclick = () => selectLocation(loc.id);
    div.innerHTML = `
      <div class="location-name">${loc.name}</div>
      <div class="location-region">${loc.region}</div>
    `;
    container.appendChild(div);
  });
}

function selectLocation(locationId) {
  currentConfig.location = locationId;
  renderLocationGrid();
}

// ──────────────────────────────────────────────────────────────
// TICKERS
// ──────────────────────────────────────────────────────────────

function renderTickerList() {
  const container = document.getElementById('tickerList');
  container.innerHTML = '';
  
  if (currentConfig.tickers.length === 0) {
    container.innerHTML = '<p style="font-size:.7rem;color:var(--t3);text-align:center;padding:20px">Nenhum ticker adicionado. Use as sugestões acima.</p>';
    return;
  }
  
  // Nomes das empresas (mapeamento simples)
  const tickerNames = {
    'BCP': 'Banco Comercial Português',
    'EDP': 'Energias de Portugal',
    'GALP': 'Galp Energia',
    'JMT': 'Jerónimo Martins',
    'NOS': 'NOS SGPS',
    'REN': 'REN - Redes Energéticas',
    'CTT': 'CTT Correios',
    'SONAE': 'Sonae SGPS'
  };
  
  currentConfig.tickers.forEach((ticker, index) => {
    const div = document.createElement('div');
    div.className = 'ticker-item';
    div.innerHTML = `
      <div class="ticker-symbol">${ticker}</div>
      <div class="ticker-name">${tickerNames[ticker] || 'Empresa'}</div>
      <button class="ticker-remove" onclick="removeTicker(${index})">✕</button>
    `;
    container.appendChild(div);
  });
}

function addTicker() {
  const input = document.getElementById('tickerInput');
  const ticker = input.value.trim().toUpperCase();
  
  if (!ticker) return;
  
  if (currentConfig.tickers.includes(ticker)) {
    alert('Este ticker já está na lista!');
    return;
  }
  
  if (currentConfig.tickers.length >= 10) {
    alert('Máximo de 10 tickers permitidos.');
    return;
  }
  
  currentConfig.tickers.push(ticker);
  input.value = '';
  renderTickerList();
}

function quickAddTicker(ticker) {
  if (currentConfig.tickers.includes(ticker)) {
    alert('Este ticker já está na lista!');
    return;
  }
  
  if (currentConfig.tickers.length >= 10) {
    alert('Máximo de 10 tickers permitidos.');
    return;
  }
  
  currentConfig.tickers.push(ticker);
  renderTickerList();
}

function removeTicker(index) {
  currentConfig.tickers.splice(index, 1);
  renderTickerList();
}

// ──────────────────────────────────────────────────────────────
// AUTO-IDENTIFICAÇÃO DE CARDS
// ──────────────────────────────────────────────────────────────

function autoIdentifyCards() {
  console.log('Auto-identificando cards...');
  
  // Mapeamento de texto → ID
  const cardMappings = [
    { text: 'Meteorologia',           id: 'weather' },
    { text: 'Combustíveis',           id: 'fuel' },
    { text: 'Cabaz',                  id: 'cabaz' },
    { text: 'Petróleo',               id: 'oil' },
    { text: 'Gás Natural · Hubs',     id: 'gas-eu' },
    { text: 'Gás Natural · Portugal', id: 'gas-pt' },
    { text: 'Eletricidade',           id: 'elec' },
    { text: 'Qualidade do Ar',        id: 'airquality' },
    { text: 'Barragens',              id: 'dams' },
    { text: 'Euribor',                id: 'euribor' },
    { text: 'Imobiliário',            id: 'imob' },
    { text: 'Fear',                   id: 'fng' },
    { text: 'Recessão',               id: 'rec' },
    { text: 'Agrícolas',              id: 'agri' },
    { text: 'Exportações',            id: 'exp' },
    { text: 'Dívida',                 id: 'div' },
    { text: 'Tráfego Aéreo',          id: 'air' },
    { text: 'Sismos',                 id: 'seis' },
    { text: 'Ormuz',                  id: 'ormuz' },
    { text: 'Salário Mínimo',         id: 'smn' },
    { text: 'Transportes',            id: 'transp' },
    { text: 'Mercados Financeiros',   id: 'finance' },
    { text: 'PSI 20',                 id: 'psi20' },
    { text: 'Mapa de Calor',          id: 'heatmap' },
    { text: 'Câmbio',                 id: 'fx' },
    { text: 'Criptomoedas',           id: 'crypto' },
    { text: 'Inflação',               id: 'inf' },
    { text: 'Indicadores de Mercado', id: 'mstats' },
    { text: 'Calendário',             id: 'cal' },
    { text: 'Conflitos',              id: 'conflicts' },
    { text: 'Geopolítica',            id: 'geo' },
    { text: 'CO₂',                    id: 'co2' },
    { text: 'Liberdade',              id: 'press' },
    { text: 'Notícias · Portugal',    id: 'news-pt' },
    { text: 'Notícias · Mundo',       id: 'news-world' },
  ];
  
  // Pegar todos os cards (inclui TradingView Advanced Chart)
  const cards = document.querySelectorAll('.card, .tv-chart-card');
  console.log(`Encontrados ${cards.length} cards`);
  
  let identified = 0;
  
  cards.forEach(card => {
    // Já tem ID? Skip
    if (card.dataset.cardId) return;

    // Preferir inferir pelo id do elemento quando existe
    if (card.id) {
      if (card.id.startsWith('card-')) {
        card.dataset.cardId = card.id.slice('card-'.length);
        identified++;
        return;
      }
      if (card.id.endsWith('-card')) {
        card.dataset.cardId = card.id.slice(0, -'-card'.length);
        identified++;
        return;
      }
    }
    
    // Procurar pelo texto do label
    const label = card.querySelector('.ch-lbl');
    if (!label) return;
    
    const labelText = label.textContent.trim();
    
    // Encontrar mapeamento
    const mapping = cardMappings.find(m => labelText.includes(m.text));
    
    if (mapping) {
      card.dataset.cardId = mapping.id;
      identified++;
      console.log(`✓ Card identificado: "${labelText}" → ${mapping.id}`);
    } else {
      console.warn(`✗ Card não mapeado: "${labelText}"`);
    }
  });
  
  console.log(`${identified} cards identificados de ${cards.length}`);
  return identified;
}

function syncConfigWithDOMCards() {
  const domCards = Array.from(document.querySelectorAll('.card[data-card-id], .tv-chart-card[data-card-id]'));
  const domById = new Map();
  domCards.forEach(el => {
    const id = el.dataset.cardId;
    if (!id || domById.has(id)) return;
    domById.set(id, el);
  });

  const existing = Array.isArray(currentConfig?.cards) ? currentConfig.cards : [];
  const seen = new Set();
  const normalized = [];

  // Mantém a ordem do utilizador (sem duplicados)
  existing.forEach(card => {
    if (!card || typeof card.id !== 'string') return;
    if (seen.has(card.id)) return;
    seen.add(card.id);
    normalized.push({ ...card });
  });

  const getMetaFromDom = (el) => {
    const icon = (el.querySelector('.ch-ico')?.textContent || '').trim();
    const name = (el.querySelector('.ch-lbl')?.textContent || '').replace(/\s+/g, ' ').trim();
    const src = (el.querySelector('.src, .tv-src')?.textContent || '').replace(/\s+/g, ' ').trim().replace(/^✦\s*/, '');
    return {
      icon: icon || '🧩',
      name: name || 'Card',
      desc: src ? src.slice(0, 110) : ''
    };
  };

  // Garante que todos os cards presentes no DOM aparecem na personalização
  domById.forEach((el, id) => {
    if (seen.has(id)) return;
    const meta = getMetaFromDom(el);
    normalized.push({ id, visible: true, ...meta });
    seen.add(id);
  });

  currentConfig = syncDashboardConfig({ ...currentConfig, cards: normalized });
  localStorage.setItem('dashboardConfig', JSON.stringify(currentConfig));
}

// ──────────────────────────────────────────────────────────────
// INICIALIZAÇÃO
// ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  perfMark('init-start');
  
  // Inicializar lazy loading
  const lazyEnabled = initLazyLoading();
  
  // Auto-identificar cards
  perfMark('auto-identify-start');
  autoIdentifyCards();
  syncConfigWithDOMCards();
  perfMeasure('Auto-identificação de cards', 'auto-identify-start');
  
  // Aplicar configurações salvas
  perfMark('apply-settings-start');
  applySettings();
  perfMeasure('Aplicar configurações', 'apply-settings-start');
  
  // Enter para adicionar ticker
  const input = document.getElementById('tickerInput');
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addTicker();
      }
    });
  }

  // Pesquisa de cards (Settings)
  const cardSearchInput = document.getElementById('cardSearchInput');
  if (cardSearchInput) {
    syncCardSearchInput();
    cardSearchInput.addEventListener('input', () => {
      cardSearchQuery = cardSearchInput.value || '';
      renderCardToggles();
    });
    cardSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && (cardSearchInput.value || '').trim()) {
        e.preventDefault();
        e.stopPropagation();
        clearCardSearch();
      }
    });
  }
  
  // Event listener para fechar ao clicar fora
  const overlay = document.getElementById('settingsOverlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeSettings();
      }
    });
  }
  
  // ESC para fechar
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const overlayEl = document.getElementById('settingsOverlay');
      if (overlayEl && overlayEl.classList.contains('show')) {
        closeSettings();
      }
    }
  });
  
  // Aplicar configurações salvas
  applySettings();
  applyLocationToCfg(currentConfig.location);
  renderTvTickerTape(currentConfig.tickers);
  renderTvAdvancedChart(currentConfig.tickers);
  refreshAllCardStatuses();
  applyStickyScrollCards();
  setInterval(refreshAllCardStatuses, 30 * 1000);
  if (isCardVisible('weather')) wxholRefresh();
  if (isCardVisible('airquality')) loadAirQuality(true);
  
  console.log('Sistema de personalização carregado!');
  
  // ──────────────────────────────────────────────────────────────
  // INICIALIZAR DATAS DE REFERÊNCIA
  // ──────────────────────────────────────────────────────────────
  
  // Euribor
  const euriborRef = document.getElementById('euriborRefDate');
  if (euriborRef) euriborRef.textContent = REF_DATE.full;
  
  // Imobiliário
  const imobRef = document.getElementById('imobRefQuarter');
  const imobSub1 = document.getElementById('imobSub1');
  const imobSub2 = document.getElementById('imobSub2');
  const imobSub3 = document.getElementById('imobSub3');
  const imobSrc = document.getElementById('imobRefSrc');
  
  if (imobRef) imobRef.textContent = `INE · ${REF_DATE.prevQuarter}`;
  if (imobSub1) imobSub1.textContent = `${REF_DATE.prevQuarter} · famílias`;
  if (imobSub2) imobSub2.textContent = `variação homóloga ${REF_DATE.prevQuarter}`;
  if (imobSub3) imobSub3.textContent = `variação homóloga ${REF_DATE.prevQuarter}`;
  if (imobSrc) {
    // Calcular próxima atualização (INE publica dados com 2 meses de atraso)
    const nextUpdate = new Date();
    nextUpdate.setMonth(nextUpdate.getMonth() + 2);
    const nextMonth = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][nextUpdate.getMonth()];
    imobSrc.textContent = `✦ INE · Estatísticas Preços Habitação · ${REF_DATE.prevQuarter} · actualizar: ${nextMonth} ${nextUpdate.getFullYear()}`;
  }
  
  console.log('📅 Datas de referência atualizadas automaticamente');
  
  // ──────────────────────────────────────────────────────────────
  // INICIALIZAR SISTEMA DE NOTIFICAÇÕES
  // ──────────────────────────────────────────────────────────────
  
  loadNotifications();
  console.log('🔔 Sistema de notificações ativado!');
  
  // ⚠️ MONITORAMENTO AUTOMÁTICO TEMPORARIAMENTE DESATIVADO
  // Razão: CORS issues com proxies públicos
  // As notificações serão verificadas quando o utilizador forçar refresh manual (botão ↺)
  // TODO: Reativar quando tiver backend próprio ou proxy dedicado
  
  // startNotificationMonitoring(); // Desativado temporariamente
  console.log('ℹ️ Notificações verificam ao carregar dados manualmente (botão ↺)');
  
  // ⚠️ DESENVOLVIMENTO: Gerar notificações demo
  // TODO: Remover em produção ou controlar via flag
  const ENABLE_DEMO_NOTIFICATIONS = false; // Mudar para true apenas em dev
  
  if (ENABLE_DEMO_NOTIFICATIONS && notifications.length === 0) {
    console.log('⚠️ Modo DEV: Gerando notificações demo...');
    setTimeout(() => {
      generateDemoNotifications();
    }, 2000);
  }
  
  // ──────────────────────────────────────────────────────────────
  // SETUP DE LAZY LOADING PARA CARDS
  // ──────────────────────────────────────────────────────────────
  
  if (lazyEnabled) {
    // Registrar cards para lazy loading
    const cards = document.querySelectorAll('.card');
    cards.forEach((card, index) => {
      // Cards visíveis no início (primeiros 6) carregam imediatamente
      if (index < 6) return;
      
      const cardId = card.dataset.cardId;
      if (!cardId) return;
      
      // Encontrar função de carregamento associada
      const loadFuncName = `load${cardId.charAt(0).toUpperCase() + cardId.slice(1)}`;
      
      if (typeof window[loadFuncName] === 'function') {
        card.dataset.lazyId = cardId;
        registerLazyLoad(card, () => {
          window[loadFuncName]();
        });
      }
    });
  }
  
  // ──────────────────────────────────────────────────────────────
  // LIMPAR CACHE ANTIGO
  // ──────────────────────────────────────────────────────────────
  
  cleanOldCache();
  
  // ──────────────────────────────────────────────────────────────
  // PERFORMANCE REPORT
  // ──────────────────────────────────────────────────────────────
  
  perfMeasure('Inicialização total', 'init-start');
  
  // Report após 2 segundos (quando tudo estiver carregado)
  setTimeout(() => {
    perfReport();
  }, 2000);
});

function normalizeStr(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function arrayEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isCardVisible(cardId) {
  const el = document.querySelector(`[data-card-id="${cardId}"]`);
  if (!el) return false;
  if (el.style.display === 'none') return false;
  return !el.classList.contains('hidden');
}

function applyLocationToCfg(locationId) {
  try {
    if (!locationId || typeof locationId !== 'string') return;
    const loc = LOCATIONS.find(l => l.id === locationId);
    if (!loc) return;

    // Mapear nome da cidade para IPMA_CITY_ID (usado por Meteorologia + Qualidade do Ar)
    const want = normalizeStr(loc.name);
    for (const [idStr, name] of Object.entries(IPMA_CITIES)) {
      if (normalizeStr(name) === want) {
        CFG.IPMA_CITY_ID = Number(idStr);
        return;
      }
    }
  } catch {}
}

function toTvSymbol(ticker) {
  const t = String(ticker || '').trim().toUpperCase();
  if (!t) return null;
  if (t.includes(':')) return t;
  return `EURONEXT:${t}`;
}

function renderTvTickerTape(tickers) {
  const wrap = document.querySelector('.tv-tape-wrap');
  if (!wrap) return;

  const fav = (Array.isArray(tickers) ? tickers : [])
    .map(t => toTvSymbol(t))
    .filter(Boolean)
    .map(sym => ({ description: sym.replace(/^.*:/, ''), proName: sym }));

  const base = [
    { description: 'EUR/USD', proName: 'FX_IDC:EURUSD' },
    { description: 'EUR/GBP', proName: 'FX_IDC:EURGBP' },
    { description: 'EUR/JPY', proName: 'FX_IDC:EURJPY' },
    { description: 'EUR/CHF', proName: 'FX_IDC:EURCHF' },
    { description: 'EUR/BRL', proName: 'FX_IDC:EURBRL' },
    { description: 'EUR/CNY', proName: 'FX_IDC:EURCNY' },
    { description: 'S&P 500', proName: 'FOREXCOM:SPXUSD' },
    { description: 'Nasdaq', proName: 'FOREXCOM:NSXUSD' },
    { description: 'DAX', proName: 'XETR:DAX' },
    { description: 'FTSE 100', proName: 'FOREXCOM:UKXGBP' },
    { description: 'Ouro', proName: 'FOREXCOM:XAUUSD' },
    { description: 'Prata', proName: 'FOREXCOM:XAGUSD' },
    { description: 'Brent', proName: 'OANDA:BCOUSD' },
    { description: 'WTI', proName: 'OANDA:WTICOUSD' },
    { description: 'Gás Nat.', proName: 'CAPITALCOM:NATURALGAS' },
    { description: 'BTC/USD', proName: 'BITSTAMP:BTCUSD' },
    { description: 'ETH/USD', proName: 'BITSTAMP:ETHUSD' }
  ];

  const seen = new Set();
  const symbols = [...fav, ...base].filter(s => {
    if (!s?.proName) return false;
    if (seen.has(s.proName)) return false;
    seen.add(s.proName);
    return true;
  });

  const cfg = {
    symbols,
    showSymbolLogo: true,
    isTransparent: true,
    displayMode: 'adaptive',
    colorTheme: 'dark',
    locale: 'pt'
  };

  wrap.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'tradingview-widget-container';
  const widget = document.createElement('div');
  widget.className = 'tradingview-widget-container__widget';
  container.appendChild(widget);
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
  script.async = true;
  script.text = JSON.stringify(cfg);
  container.appendChild(script);
  wrap.appendChild(container);
}

function renderTvAdvancedChart(tickers) {
  const inner = document.querySelector('.tv-chart-inner');
  if (!inner) return;

  const favSyms = (Array.isArray(tickers) ? tickers : [])
    .map(t => toTvSymbol(t))
    .filter(Boolean);

  const baseWatchlist = [
    'EURONEXT:EDP','EURONEXT:GALP','EURONEXT:BCP','EURONEXT:JMT','EURONEXT:NOS','EURONEXT:SON','EURONEXT:RENE','EURONEXT:CTT','EURONEXT:NVG',
    'FOREXCOM:SPXUSD','FOREXCOM:NSXUSD','XETR:DAX','FX_IDC:EURUSD','FX_IDC:EURGBP','FOREXCOM:XAUUSD','OANDA:BCOUSD','NYMEX:CL1!','BITSTAMP:BTCUSD','TVC:PT10Y'
  ];

  const seen = new Set();
  const watchlist = [...favSyms, ...baseWatchlist].filter(s => {
    if (!s) return false;
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });

  const cfg = {
    autosize: true,
    symbol: favSyms[0] || 'EURONEXT:EDP',
    interval: 'D',
    timezone: 'Europe/Lisbon',
    theme: 'dark',
    style: '1',
    locale: 'pt',
    backgroundColor: 'rgba(10,13,28,0)',
    gridColor: 'rgba(24,29,48,1)',
    withdateranges: true,
    hide_side_toolbar: false,
    allow_symbol_change: true,
    save_image: false,
    watchlist,
    details: true,
    hotlist: true,
    calendar: false,
    support_host: 'https://www.tradingview.com'
  };

  inner.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'tradingview-widget-container';
  container.style.height = '100%';
  container.style.width = '100%';
  const widget = document.createElement('div');
  widget.className = 'tradingview-widget-container__widget';
  widget.style.height = '100%';
  widget.style.width = '100%';
  container.appendChild(widget);
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  script.async = true;
  script.text = JSON.stringify(cfg);
  container.appendChild(script);
  inner.appendChild(container);
}

function applyConfigSideEffects(prevConfig, nextConfig) {
  try {
    const prevLoc = prevConfig?.location;
    const nextLoc = nextConfig?.location;
    if (prevLoc !== nextLoc) {
      applyLocationToCfg(nextLoc);
      if (isCardVisible('weather')) wxholRefresh();
      if (isCardVisible('airquality')) loadAirQuality(true);
    }

    const prevTickers = Array.isArray(prevConfig?.tickers) ? prevConfig.tickers : [];
    const nextTickers = Array.isArray(nextConfig?.tickers) ? nextConfig.tickers : [];
    if (!arrayEqual(prevTickers, nextTickers)) {
      renderTvTickerTape(nextTickers);
      renderTvAdvancedChart(nextTickers);
    }
  } catch {}
}

function saveSettings() {
  let prevConfig = null;
  try {
    const raw = localStorage.getItem('dashboardConfig');
    prevConfig = raw ? JSON.parse(raw) : null;
  } catch {}

  localStorage.setItem('dashboardConfig', JSON.stringify(currentConfig));
  
  // Aplicar mudanças visualmente
  applySettings();
  applyConfigSideEffects(prevConfig, currentConfig);

  comfortSnapshot = null;
  comfortPreviewDirty = false;
  
  // Feedback visual
  const saveBtn = document.querySelector('.settings-btn-save');
  if (saveBtn) {
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '✓ Guardado!';
    saveBtn.style.background = 'var(--green)';
    
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.background = '';
      closeSettings();
    }, 1000);
  }
}

function resetSettings() {
  if (!confirm('Restaurar configurações padrão? Esta ação não pode ser desfeita.')) {
    return;
  }
  
  currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  localStorage.setItem('dashboardConfig', JSON.stringify(currentConfig));
  
  // Re-renderizar
  renderCardToggles();
  renderLocationGrid();
  renderTickerList();
  
  // Feedback
  alert('Configurações restauradas! Recarregue a página para ver as alterações.');
}

function applySettings() {
  console.log('Aplicando configurações:', currentConfig);

  // Conforto (independe do grid)
  try { applyComfortSettings(currentConfig.comfort); } catch {}
  try { applyStickyScrollCards(); } catch {}
  
  const mainGrid = document.getElementById('main-grid');
  if (!mainGrid) {
    console.error('Container main-grid não encontrado!');
    return;
  }

  // Construir índice dos cards no DOM (inclui TradingView chart)
  const allDomCards = Array.from(mainGrid.querySelectorAll('.card[data-card-id], .tv-chart-card[data-card-id]'));
  const cardById = new Map();
  allDomCards.forEach(el => {
    const id = el.dataset.cardId;
    if (id && !cardById.has(id)) cardById.set(id, el);
  });

  let processed = 0;

  // Esconder todos por omissão; depois aplicamos a ordem/visibilidade do config
  allDomCards.forEach(el => {
    el.classList.add('hidden');
    el.style.display = 'none';
  });

  // Reordenar e aplicar visibilidade pela ordem guardada
  currentConfig.cards.forEach(cardCfg => {
    const cardEl = cardById.get(cardCfg.id);
    if (!cardEl) return;

    mainGrid.appendChild(cardEl);

    if (cardCfg.visible) {
      cardEl.classList.remove('hidden');
      cardEl.style.display = '';
    } else {
      cardEl.classList.add('hidden');
      cardEl.style.display = 'none';
    }
    processed++;
  });

  console.log(`${processed} cards processados (ordem + visibilidade).`);
}



/* ══════════════════════════════════════════════════════════════
   SISTEMA DE NOTIFICAÇÕES
   ══════════════════════════════════════════════════════════════ */

// Estado das notificações
let notifications = [];
let notificationSettings = {
  sismos: { enabled: true, minMagnitude: 3.0, sound: true },
  news: { enabled: true, keywords: ['portugal', 'breaking'], sound: true },
  energy: { enabled: true, threshold: 20, sound: true } // % acima da média
};

// Carregar do localStorage
function loadNotifications() {
  const saved = localStorage.getItem('notifications');
  if (saved) {
    notifications = JSON.parse(saved);
  }
  
  const savedSettings = localStorage.getItem('notificationSettings');
  if (savedSettings) {
    notificationSettings = JSON.parse(savedSettings);
  }
  
  updateNotificationUI();
}

// Salvar no localStorage
function saveNotifications() {
  localStorage.setItem('notifications', JSON.stringify(notifications));
  localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
}

// Adicionar notificação
function addNotification(type, title, description, severity = 'medium', data = {}) {
  const notif = {
    id: Date.now(),
    type,
    title,
    description,
    severity,
    timestamp: new Date().toISOString(),
    read: false,
    data
  };
  
  notifications.unshift(notif);
  
  // Limitar a 50 notificações
  if (notifications.length > 50) {
    notifications = notifications.slice(0, 50);
  }
  
  saveNotifications();
  updateNotificationUI();
  
  // Mostrar toast
  showToast(notif);
  
  // Tocar som se ativado
  if (notificationSettings[type]?.sound) {
    playNotificationSound();
  }
  
  return notif;
}

// UI: Atualizar interface
function updateNotificationUI() {
  const badge = document.getElementById('notifBadge');
  const list = document.getElementById('notifList');
  
  // Contar não lidas
  const unreadCount = notifications.filter(n => !n.read).length;
  
  // Atualizar badge
  if (badge) {
    badge.textContent = unreadCount;
    badge.className = unreadCount === 0 ? 'notif-badge zero' : 'notif-badge';
  }
  
  // Atualizar contadores por tipo
  updateTabCounts();
  
  // Renderizar lista
  if (list) {
    renderNotificationList();
  }
}

// Atualizar contadores dos tabs
function updateTabCounts() {
  const all = notifications.filter(n => !n.read).length;
  const sismos = notifications.filter(n => n.type === 'sismos' && !n.read).length;
  const news = notifications.filter(n => n.type === 'news' && !n.read).length;
  const energy = notifications.filter(n => n.type === 'energy' && !n.read).length;
  
  const updateCount = (id, count) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = count;
      el.style.display = count === 0 ? 'none' : 'block';
    }
  };
  
  updateCount('notifAllCount', all);
  updateCount('notifSismosCount', sismos);
  updateCount('notifNewsCount', news);
  updateCount('notifEnergyCount', energy);
}

// Renderizar lista de notificações
let currentFilter = 'all';

function renderNotificationList() {
  const list = document.getElementById('notifList');
  if (!list) return;
  
  let filtered = notifications;
  if (currentFilter !== 'all') {
    filtered = notifications.filter(n => n.type === currentFilter);
  }
  
  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="notif-empty">
        <div class="notif-empty-icon">🔕</div>
        <div>Nenhuma notificação${currentFilter !== 'all' ? ' nesta categoria' : ''}</div>
      </div>
    `;
    return;
  }
  
  // Ícones por tipo
  const icons = {
    sismos: '🌍',
    news: '📰',
    energy: '⚡'
  };
  
  list.innerHTML = filtered.map(n => {
    const time = formatTimeAgo(new Date(n.timestamp));
    const unreadClass = n.read ? '' : 'unread';
    const severityClass = `severity-${n.severity}`;
    
    return `
      <div class="notif-item ${unreadClass} ${severityClass}" role="button" tabindex="0" aria-label="Abrir notificação ${n.type.toUpperCase()}: ${n.title.replace(/"/g, '&quot;')}" onclick="markAsRead('${n.id}')">
        <div class="notif-item-header">
          <div class="notif-item-icon">${icons[n.type] || '📌'}</div>
          <div class="notif-item-content">
            <div class="notif-item-type ${n.type}">${n.type.toUpperCase()}</div>
            <div class="notif-item-title">${n.title}</div>
            <div class="notif-item-desc">${n.description}</div>
            <div class="notif-item-time">${time}</div>
          </div>
          <button class="notif-item-dismiss" onclick="dismissNotification(event, '${n.id}')">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

// Toggle painel de notificações
function toggleNotifications() {
  const panel = document.getElementById('notifPanel');
  const isOpen = !!(panel && panel.classList.contains('show'));
  setNotificationsOpen(!isOpen);
}

function setNotificationsOpen(open) {
  const panel = document.getElementById('notifPanel');
  const btn = document.getElementById('notifBtn');
  if (!panel) return;
  panel.classList.toggle('show', !!open);
  panel.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

// Fechar ao clicar fora
document.addEventListener('click', (e) => {
  const panel = document.getElementById('notifPanel');
  const btn = document.querySelector('.notif-btn');
  
  if (panel && btn && !panel.contains(e.target) && !btn.contains(e.target)) {
    setNotificationsOpen(false);
  }
});

// ESC para fechar notificações
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const panel = document.getElementById('notifPanel');
    if (panel && panel.classList.contains('show')) setNotificationsOpen(false);
  }
});

// Filtrar notificações
function filterNotifications(type) {
  currentFilter = type;
  
  // Atualizar tabs ativos
  document.querySelectorAll('.notif-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  event.target.classList.add('active');
  
  renderNotificationList();
}

// Marcar como lida
function markAsRead(id) {
  const notif = notifications.find(n => n.id == id);
  if (notif) {
    notif.read = true;
    saveNotifications();
    updateNotificationUI();
  }
}

// Marcar todas como lidas
function markAllAsRead() {
  notifications.forEach(n => n.read = true);
  saveNotifications();
  updateNotificationUI();
}

// Dispensar notificação
function dismissNotification(event, id) {
  event.stopPropagation();
  notifications = notifications.filter(n => n.id != id);
  saveNotifications();
  updateNotificationUI();
}

// Limpar todas
function clearAllNotifications() {
  if (confirm('Limpar todas as notificações?')) {
    notifications = [];
    saveNotifications();
    updateNotificationUI();
  }
}

// Toast (popup temporário)
function showToast(notif) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const icons = { 
    sismos: '🌍', 
    news: '📰', 
    energy: '⚡' 
  };
  
  const toast = document.createElement('div');
  toast.className = `toast type-${notif.type}`;
  toast.innerHTML = `
    <div class="toast-progress"></div>
    <div class="toast-icon" aria-hidden="true">${icons[notif.type] || '📌'}</div>
    <div class="toast-content">
      <div class="toast-title">${notif.title}</div>
      <div class="toast-message">${notif.description}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.classList.add('hiding'); setTimeout(() => this.parentElement.remove(), 300)">✕</button>
  `;
  
  container.appendChild(toast);
  
  // Auto-remover após 5 segundos
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
  
  // Clicar no toast para abrir painel de notificações
  toast.onclick = (e) => {
    if (!e.target.classList.contains('toast-close')) {
      setNotificationsOpen(true);
      markAsRead(notif.id);
    }
  };
}

// Som de notificação (beep simples)
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (e) {
    // Falha silenciosa se não suportar Web Audio API
  }
}

// Formatar tempo relativo
function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'agora mesmo';
  if (seconds < 3600) return `há ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `há ${Math.floor(seconds / 3600)} h`;
  if (seconds < 604800) return `há ${Math.floor(seconds / 86400)} d`;
  
  return date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
}

// Abrir configurações de notificações
function openNotificationSettings() {
  // Mudar para tab de notificações no painel de configurações
  openSettings();
  
  // TODO: Criar tab de notificações no painel de settings
  alert('Configurações de notificações em desenvolvimento!\n\nPor agora, todas as notificações estão ativas:\n• Sismos > 3.0\n• Notícias importantes\n• Picos de energia > 20%');
}

// ══════════════════════════════════════════════════════════════
// MONITORIZAÇÃO AUTOMÁTICA
// ══════════════════════════════════════════════════════════════

// Verificar sismos
const lastSeismicCheck = null;

function checkSeismicActivity(data) {
  if (!notificationSettings.sismos.enabled) return;
  
  // Aqui integraria com os dados reais de sismos
  // Por agora, exemplo de como seria usado:
  /*
  data.forEach(sismo => {
    if (sismo.magnitude >= notificationSettings.sismos.minMagnitude) {
      const key = `sismo-${sismo.id}`;
      if (!lastSeismicCheck || !lastSeismicCheck.includes(key)) {
        addNotification(
          'sismos',
          `Sismo de magnitude ${sismo.magnitude}`,
          `${sismo.location} • Profundidade: ${sismo.depth}km`,
          sismo.magnitude >= 4.0 ? 'high' : 'medium',
          sismo
        );
      }
    }
  });
  */
}

// Verificar notícias importantes
function checkBreakingNews(articles) {
  if (!notificationSettings.news.enabled) return;
  
  // Detectar breaking news por keywords
  const keywords = ['urgente', 'breaking', 'última hora', 'agora'];
  
  articles.forEach(article => {
    const hasKeyword = keywords.some(kw => 
      article.title?.toLowerCase().includes(kw) ||
      article.description?.toLowerCase().includes(kw)
    );
    
    if (hasKeyword) {
      // Verificar se já notificámos
      const exists = notifications.find(n => 
        n.type === 'news' && n.data?.url === article.url
      );
      
      if (!exists) {
        addNotification(
          'news',
          article.title || 'Notícia importante',
          article.source || 'Última hora',
          'high',
          article
        );
      }
    }
  });
}

// Verificar preços de energia
let lastEnergyPrice = null;

function checkEnergyPrices(currentPrice, averagePrice) {
  if (!notificationSettings.energy.enabled) return;
  
  const percentAbove = ((currentPrice - averagePrice) / averagePrice) * 100;
  
  if (percentAbove >= notificationSettings.energy.threshold) {
    // Só notificar uma vez por pico
    if (!lastEnergyPrice || lastEnergyPrice < averagePrice) {
      addNotification(
        'energy',
        `Preço de energia ${percentAbove.toFixed(0)}% acima da média`,
        `Atual: ${currentPrice.toFixed(2)} €/MWh • Média: ${averagePrice.toFixed(2)} €/MWh`,
        percentAbove >= 40 ? 'high' : 'medium',
        { current: currentPrice, average: averagePrice }
      );
    }
  }
  
  lastEnergyPrice = currentPrice;
}

// Exemplos de notificações (para demonstração)
function generateDemoNotifications() {
  if (notifications.length > 0) return; // Só gerar se vazio
  
  // Exemplo: Sismo
  addNotification(
    'sismos',
    'Sismo de magnitude 3.4 registado',
    'Região de Évora • Profundidade: 12km • Sem danos reportados',
    'medium',
    { magnitude: 3.4, location: 'Évora', depth: 12 }
  );
  
  // Exemplo: Notícia
  addNotification(
    'news',
    'Portugal lidera produção de energia renovável na UE',
    'País atinge 85% de renováveis no primeiro trimestre de 2026',
    'low',
    { source: 'Público', category: 'Ambiente' }
  );
  
  // Exemplo: Energia
  addNotification(
    'energy',
    'Preço de eletricidade 25% acima da média',
    'Pico registado às 19h • 145 €/MWh vs média de 116 €/MWh',
    'medium',
    { current: 145, average: 116 }
  );
}

// ══════════════════════════════════════════════════════════════
// MONITORIZAÇÃO PERIÓDICA
// ══════════════════════════════════════════════════════════════

// Verificar novas notificações a cada 5 minutos
function startNotificationMonitoring() {
  console.log('🔍 Monitoramento de notificações iniciado (verifica a cada 5min)');
  
  setInterval(() => {
    console.log('🔍 Verificando novos dados para notificações...');
    
    // Recarregar dados (force=true) para verificar novidades
    if (typeof loadSeis === 'function') {
      loadSeis(true).catch(e => console.warn('Erro ao verificar sismos:', e));
    }
    
    if (typeof loadNews === 'function') {
      loadNews('pt', true).catch(e => console.warn('Erro ao verificar notícias:', e));
    }
    
    if (typeof loadElec === 'function') {
      loadElec(true).catch(e => console.warn('Erro ao verificar energia:', e));
    }
    
  }, 5 * 60 * 1000); // 5 minutos
  
  // Primeira verificação após 30 segundos
  setTimeout(() => {
    console.log('🔍 Primeira verificação de notificações...');
    if (typeof loadSeis === 'function') loadSeis(true).catch(() => {});
    if (typeof loadNews === 'function') loadNews('pt', true).catch(() => {});
    if (typeof loadElec === 'function') loadElec(true).catch(() => {});
  }, 30 * 1000);
}

/* ══════════════════════════════════════════════════════════════
   SISTEMA DE EXPORTAÇÃO DE DADOS
   ══════════════════════════════════════════════════════════════ */

const exportState = {
  format: 'png',
  selectedCards: [],
  allCards: []
};

// ──────────────────────────────────────────────────────────────
// UI - Modal e seleções
// ──────────────────────────────────────────────────────────────

function openExportModal() {
  lastFocusExport = document.activeElement;
  const modal = document.getElementById('exportModal');
  if (!modal) return;
  
  // Verificar permissões
  checkDownloadPermissions();
  
  // Resetar estado
  exportState.selectedCards = [];
  
  // Listar cards disponíveis
  renderExportCardsList();
  updateExportButton();
  const toggleAllText = document.getElementById('toggleAllText');
  if (toggleAllText) toggleAllText.textContent = 'Todos';
  
  // Abrir modal
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  const btn = document.getElementById('exportOpenBtn');
  if (btn) btn.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';

  // Foco inicial (teclado)
  const closeBtn = modal.querySelector('.export-modal-close');
  if (closeBtn) closeBtn.focus();
  
  console.log('📥 Modal de exportação aberto');
}

function closeExportModal() {
  const modal = document.getElementById('exportModal');
  if (modal) {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  const btn = document.getElementById('exportOpenBtn');
  if (btn) btn.setAttribute('aria-expanded', 'false');

  const target = lastFocusExport || btn;
  if (target && typeof target.focus === 'function') target.focus();
  lastFocusExport = null;
  
  // Resetar progress
  const progress = document.getElementById('exportProgress');
  if (progress) {
    progress.classList.remove('active');
  }
}

// ESC para fechar
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('exportModal');
    if (modal && modal.classList.contains('show')) {
      closeExportModal();
    }
  }
});

// Clicar fora para fechar
document.addEventListener('click', (e) => {
  const modal = document.getElementById('exportModal');
  if (e.target === modal) {
    closeExportModal();
  }
});

// ──────────────────────────────────────────────────────────────
// MODAL: DETALHE COMBUSTÍVEIS (PT vs ES)
// ──────────────────────────────────────────────────────────────

let lastFocusFuel = null;

function renderFuelModal(){
  const body = document.getElementById('fuelModalBody');
  if(!body) return;

  const prefs = getFuelPrefs();
  const pt = lsGet('fuel');
  const es = lsGet('fuel_es');
  const ptMeta = getCacheMeta('fuel');
  const esMeta = getCacheMeta('fuel_es');

  const ptDate = pt?.[0]?.date || "—";
  const ptUpd = pt?.[0]?.updated_at ? new Date(pt[0].updated_at).toLocaleString("pt-PT") : "—";

  const esFecha = es?.fecha || "—";
  const esWhen = Number.isFinite(es?.ts) ? new Date(es.ts).toLocaleString("pt-PT") : esFecha;

  const ptAge = ptMeta ? `há ${fmtAgeShort(ptMeta.age)}` : "—";
  const esAge = esMeta ? `há ${fmtAgeShort(esMeta.age)}` : "—";

  const ptBy = {};
  try { (pt||[]).forEach(f => { if (f?.fuel_slug) ptBy[f.fuel_slug] = f; }); } catch {}
  const esBy = es?.items || {};

  const baseSlugs = prefs.showColored ? (FUEL_SLUGS||[]) : (FUEL_SLUGS||[]).filter(s => s.slug !== "diesel_colored");
  const rows = baseSlugs.map(s => {
    const p = ptBy[s.slug] || null;
    const e = esBy[s.slug] || null;
    const ptN = Number.isFinite(p?.station_count) ? p.station_count : null;
    const esN = Number.isFinite(e?.n) ? e.n : null;
    const note = s.slug === 'diesel_colored' ? 'ES: sem equivalente na fonte oficial' : '';
    return { slug: s.slug, label: s.label, ptN, esN, note };
  });

  const btn = (isOn, label, onclick, title="") =>
    `<button class="rbtn${isOn?" on":""}" type="button" onclick="${onclick}"${title?` title="${title.replace(/\"/g,'&quot;')}"`:""}>${label}</button>`;

  body.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
      <div style="display:flex;gap:4px;align-items:center">
        <span style="font-family:var(--mono);font-size:.58rem;color:var(--t3);letter-spacing:.6px;text-transform:uppercase">Δ</span>
        ${btn(prefs.deltaMode==="abs","Δ€","setFuelPrefs({deltaMode:'abs'})")}
        ${btn(prefs.deltaMode==="pct","Δ%","setFuelPrefs({deltaMode:'pct'})","Percentagem vs PT")}
      </div>
      <div style="display:flex;gap:4px;align-items:center">
        <span style="font-family:var(--mono);font-size:.58rem;color:var(--t3);letter-spacing:.6px;text-transform:uppercase">ES G95</span>
        ${btn(prefs.esGas95==="auto","Auto","setFuelPrefs({esGas95:'auto'})","Usa E5/E10 conforme disponível")}
        ${btn(prefs.esGas95==="e5","E5","setFuelPrefs({esGas95:'e5'})")}
        ${btn(prefs.esGas95==="e10","E10","setFuelPrefs({esGas95:'e10'})")}
      </div>
      <div style="display:flex;gap:4px;align-items:center">
        <span style="font-family:var(--mono);font-size:.58rem;color:var(--t3);letter-spacing:.6px;text-transform:uppercase">ES G98</span>
        ${btn(prefs.esGas98==="auto","Auto","setFuelPrefs({esGas98:'auto'})","Usa E5/E10 conforme disponível")}
        ${btn(prefs.esGas98==="e5","E5","setFuelPrefs({esGas98:'e5'})")}
        ${btn(prefs.esGas98==="e10","E10","setFuelPrefs({esGas98:'e10'})")}
      </div>
      <div style="display:flex;gap:4px;align-items:center">
        <span style="font-family:var(--mono);font-size:.58rem;color:var(--t3);letter-spacing:.6px;text-transform:uppercase">PT</span>
        ${btn(prefs.showColored,"Colorido: ON",`setFuelPrefs({showColored:true})`,"Mostra Gasóleo Colorido (PT)")}
        ${btn(!prefs.showColored,"Colorido: OFF",`setFuelPrefs({showColored:false})`,"Esconde Gasóleo Colorido (PT)")}
      </div>
    </div>
    <div style="font-family:var(--mono);font-size:.63rem;color:var(--t2);line-height:1.7;margin-bottom:10px">
      <div><span style="color:var(--t3)">PT</span> · API Aberta · data ${ptDate} · atualizado ${ptUpd} · cache ${ptAge}</div>
      <div><span style="color:var(--t3)">ES</span> · MITECO/MINETUR · ${esWhen} · cache ${esAge}</div>
    </div>
    <table class="tbl" aria-label="Detalhe de postos usados no cálculo">
      <thead><tr>
        <td>Tipo</td>
        <td class="r">PT postos</td>
        <td class="r">ES postos</td>
      </tr></thead>
      <tbody>
        ${rows.map(r => `
          <tr title="${(r.note||'').replace(/\"/g, '&quot;')}">
            <td>${r.label}</td>
            <td class="r">${r.ptN!=null ? r.ptN : "—"}</td>
            <td class="r">${r.slug === 'diesel_colored' ? "N/A" : (r.esN!=null ? r.esN : "—")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <div class="src">✦ Nota: “ES postos” conta apenas estações com preço válido para esse tipo.</div>
  `;
  try{ syncFuelDeltaBtn(); }catch{}
}

function openFuelModal(){
  lastFocusFuel = document.activeElement;
  const modal = document.getElementById('fuelModal');
  if(!modal) return;
  renderFuelModal();
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  const btn = document.getElementById('fuelDetailBtn');
  if (btn) btn.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
  const closeBtn = modal.querySelector('.export-modal-close');
  if (closeBtn) closeBtn.focus();
}

function closeFuelModal(){
  const modal = document.getElementById('fuelModal');
  if (modal) {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  const btn = document.getElementById('fuelDetailBtn');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  const target = lastFocusFuel || btn;
  if (target && typeof target.focus === 'function') target.focus();
  lastFocusFuel = null;
}

// ESC para fechar
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('fuelModal');
    if (modal && modal.classList.contains('show')) closeFuelModal();
  }
});

// Clicar fora para fechar
document.addEventListener('click', (e) => {
  const modal = document.getElementById('fuelModal');
  if (e.target === modal) closeFuelModal();
});

function selectExportFormat(element, format) {
  // Remover seleção anterior
  document.querySelectorAll('.export-option-item[data-format]').forEach(item => {
    item.classList.remove('selected');
  });
  
  // Selecionar novo
  element.classList.add('selected');
  exportState.format = format;
  
  console.log('Formato selecionado:', format);
}

function renderExportCardsList() {
  const list = document.getElementById('exportCardsList');
  if (!list) return;
  
  // Obter todos os cards visíveis
  const cards = document.querySelectorAll('.card[data-card-id]');
  exportState.allCards = [];
  
  cards.forEach(card => {
    const cardId = card.dataset.cardId;
    const label = card.querySelector('.ch-lbl');
    const name = label ? label.textContent.trim() : cardId;
    
    exportState.allCards.push({
      id: cardId,
      name: name,
      element: card
    });
  });
  
  // Renderizar lista
  list.innerHTML = exportState.allCards.map(card => `
    <button type="button" class="export-card-item" data-card-id="${card.id}" onclick="toggleCardSelection('${card.id}')">
      <div class="export-card-checkbox"></div>
      <div class="export-card-info">
        <div class="export-card-name">${card.name}</div>
        <div class="export-card-desc">${card.id}</div>
      </div>
    </button>
  `).join('');
  
  console.log(`📋 ${exportState.allCards.length} cards disponíveis para exportação`);
}

function toggleCardSelection(cardId) {
  const item = document.querySelector(`.export-card-item[data-card-id="${cardId}"]`);
  if (!item) return;
  
  const index = exportState.selectedCards.indexOf(cardId);
  
  if (index === -1) {
    // Adicionar
    exportState.selectedCards.push(cardId);
    item.classList.add('selected');
  } else {
    // Remover
    exportState.selectedCards.splice(index, 1);
    item.classList.remove('selected');
  }
  
  updateExportButton();
}

function toggleAllCards() {
  const allSelected = exportState.selectedCards.length === exportState.allCards.length;
  
  if (allSelected) {
    // Desselecionar todos
    exportState.selectedCards = [];
    document.querySelectorAll('.export-card-item').forEach(item => {
      item.classList.remove('selected');
    });
    document.getElementById('toggleAllText').textContent = 'Todos';
  } else {
    // Selecionar todos
    exportState.selectedCards = exportState.allCards.map(c => c.id);
    document.querySelectorAll('.export-card-item').forEach(item => {
      item.classList.add('selected');
    });
    document.getElementById('toggleAllText').textContent = 'Nenhum';
  }
  
  updateExportButton();
}

function updateExportButton() {
  const btn = document.getElementById('exportBtn');
  if (!btn) return;
  
  const count = exportState.selectedCards.length;
  btn.disabled = count === 0;
  btn.textContent = count === 0 ? 'Exportar' : `Exportar (${count})`;
}

// ──────────────────────────────────────────────────────────────
// EXPORTAÇÃO - Diferentes formatos
// ──────────────────────────────────────────────────────────────

async function executeExport() {
  if (exportState.selectedCards.length === 0) {
    alert('Selecione pelo menos um card para exportar!');
    return;
  }
  
  console.log(`🚀 Iniciando exportação (${exportState.format})...`);
  console.log('Cards selecionados:', exportState.selectedCards);
  
  // Mostrar progress
  const progress = document.getElementById('exportProgress');
  if (progress) {
    progress.classList.add('active');
  }
  
  try {
    switch (exportState.format) {
      case 'png':
        console.log('📸 Executando exportAsPNG...');
        await exportAsPNG();
        break;
      case 'pdf':
        console.log('📄 Executando exportAsPDF...');
        await exportAsPDF();
        break;
      case 'csv':
        console.log('📊 Executando exportAsCSV...');
        await exportAsCSV();
        break;
      case 'json':
        console.log('💾 Executando exportAsJSON...');
        await exportAsJSON();
        break;
    }
    
    console.log('✅ Exportação concluída com sucesso!');
    showExportSuccess(`Exportação ${exportState.format.toUpperCase()} concluída!`);
    
    setTimeout(() => {
      closeExportModal();
    }, 1000);
    
  } catch (error) {
    console.error('❌ Erro na exportação:', error);
    console.error('Stack trace:', error.stack);
    alert('Erro ao exportar dados. Veja o console para detalhes.\n\n' + error.message);
  } finally {
    if (progress) {
      progress.classList.remove('active');
    }
  }
}

// ──────────────────────────────────────────────────────────────
// PNG Export (usando html2canvas)
// ──────────────────────────────────────────────────────────────

async function exportAsPNG() {
  updateProgress(10, 'Carregando biblioteca...');
  
  // Carregar html2canvas dinamicamente
  if (!window.html2canvas) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  }
  
  updateProgress(30, 'Capturando cards...');
  
  const selectedCardElements = exportState.selectedCards.map(id => {
    return exportState.allCards.find(c => c.id === id)?.element;
  }).filter(Boolean);
  
  // Exportar cada card como PNG
  for (let i = 0; i < selectedCardElements.length; i++) {
    const card = selectedCardElements[i];
    const cardId = card.dataset.cardId;
    
    updateProgress(30 + (i / selectedCardElements.length) * 60, `Exportando ${cardId}...`);
    
    const canvas = await html2canvas(card, {
      backgroundColor: '#0F1220',
      scale: 2 // 2x para melhor qualidade
    });
    
    // Download
    const link = document.createElement('a');
    link.download = `painel-${cardId}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    // Pequeno delay entre downloads
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  updateProgress(100, 'Concluído!');
}

// ──────────────────────────────────────────────────────────────
// PDF Export (usando jsPDF)
// ──────────────────────────────────────────────────────────────

async function exportAsPDF() {
  updateProgress(10, 'Carregando biblioteca...');
  
  // Carregar jsPDF
  if (!window.jspdf) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  }
  
  updateProgress(30, 'Gerando PDF...');
  
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  // Carregar html2canvas também
  if (!window.html2canvas) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  }
  
  const selectedCardElements = exportState.selectedCards.map(id => {
    return exportState.allCards.find(c => c.id === id)?.element;
  }).filter(Boolean);
  
  for (let i = 0; i < selectedCardElements.length; i++) {
    const card = selectedCardElements[i];
    const cardId = card.dataset.cardId;
    
    updateProgress(30 + (i / selectedCardElements.length) * 60, `Capturando ${cardId}...`);
    
    if (i > 0) {
      pdf.addPage();
    }
    
    const canvas = await html2canvas(card, {
      backgroundColor: '#0F1220',
      scale: 2
    });
    
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 190;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.text(card.querySelector('.ch-lbl')?.textContent || cardId, 10, 10);
    pdf.addImage(imgData, 'PNG', 10, 15, imgWidth, imgHeight);
  }
  
  updateProgress(90, 'Salvando PDF...');
  
  pdf.save(`painel-portugal-${Date.now()}.pdf`);
  
  updateProgress(100, 'Concluído!');
}

// ──────────────────────────────────────────────────────────────
// CSV Export
// ──────────────────────────────────────────────────────────────

async function exportAsCSV() {
  updateProgress(20, 'Coletando dados...');
  
  const data = [];
  
  // Header
  data.push(['Card', 'Tipo', 'Valor', 'Unidade', 'Timestamp']);
  
  // Extrair dados de cada card
  exportState.selectedCards.forEach((cardId, index) => {
    const card = exportState.allCards.find(c => c.id === cardId);
    if (!card) return;
    
    updateProgress(20 + (index / exportState.selectedCards.length) * 70, `Extraindo ${cardId}...`);
    
    const element = card.element;
    const name = card.name;
    
    // Tentar extrair valores numéricos do card
    const values = element.querySelectorAll('[class*="val"], [class*="price"], [class*="temp"]');
    
    values.forEach(val => {
      const text = val.textContent.trim();
      const number = text.match(/[\d,.]+/);
      const unit = text.replace(/[\d,.]+/, '').trim();
      
      data.push([
        name,
        cardId,
        number ? number[0] : text,
        unit,
        new Date().toISOString()
      ]);
    });
  });
  
  updateProgress(90, 'Gerando CSV...');
  
  // Converter para CSV
  const csv = data.map(row => row.join(',')).join('\n');
  
  console.log('CSV gerado:', csv.substring(0, 200) + '...');
  console.log('Linhas:', data.length);
  
  // Download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const filename = `painel-dados-${Date.now()}.csv`;
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = url;
  link.download = filename;
  link.setAttribute('download', filename);
  
  document.body.appendChild(link);
  
  setTimeout(() => {
    link.click();
    console.log('✅ CSV download iniciado');
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);
  }, 100);
  
  updateProgress(100, 'Concluído!');
}

// ──────────────────────────────────────────────────────────────
// JSON Export
// ──────────────────────────────────────────────────────────────

async function exportAsJSON() {
  console.log('💾 Iniciando exportAsJSON...');
  updateProgress(20, 'Coletando dados...');
  
  const exportData = {
    metadata: {
      exportDate: new Date().toISOString(),
      format: 'JSON',
      version: '1.0',
      source: 'Painel Pessoal Portugal'
    },
    cards: []
  };
  
  console.log(`Processando ${exportState.selectedCards.length} cards...`);
  
  exportState.selectedCards.forEach((cardId, index) => {
    console.log(`  Card ${index + 1}/${exportState.selectedCards.length}: ${cardId}`);
    
    const card = exportState.allCards.find(c => c.id === cardId);
    if (!card) {
      console.warn(`  ⚠️ Card ${cardId} não encontrado!`);
      return;
    }
    
    updateProgress(20 + (index / exportState.selectedCards.length) * 70, `Extraindo ${cardId}...`);
    
    const element = card.element;
    
    const cardData = {
      id: cardId,
      name: card.name,
      type: cardId.split('-')[0],
      data: {},
      html: element.innerHTML.substring(0, 500) // Preview
    };
    
    // Extrair dados estruturados
    const values = element.querySelectorAll('[class*="val"], [class*="price"], [class*="temp"], [class*="kpi"]');
    
    console.log(`    Encontrados ${values.length} valores`);
    
    values.forEach((val, i) => {
      const key = val.className.split(' ')[0] || `value_${i}`;
      cardData.data[key] = val.textContent.trim();
    });
    
    exportData.cards.push(cardData);
  });
  
  updateProgress(90, 'Gerando JSON...');
  
  console.log('Dados coletados:', exportData);
  
  // Download
  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const filename = `painel-dados-${Date.now()}.json`;
  
  console.log('Criando link de download:', filename);
  console.log('Blob size:', blob.size, 'bytes');
  console.log('Blob URL:', url);
  
  // Criar link e forçar download
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = url;
  link.download = filename;
  link.setAttribute('download', filename); // Garantir atributo
  
  // Adicionar ao DOM (necessário em alguns browsers)
  document.body.appendChild(link);
  
  // Click com delay para garantir que DOM está pronto
  setTimeout(() => {
    try {
      link.click();
      console.log('✅ Click executado no link');
    } catch (e) {
      console.error('❌ Erro ao clicar:', e);
      // Fallback: abrir em nova janela
      window.open(url, '_blank');
    }
    
    // Cleanup após delay maior
    setTimeout(() => {
      try {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        console.log('🧹 Cleanup concluído');
      } catch (e) {
        console.warn('Aviso no cleanup:', e);
      }
    }, 1000);
  }, 100);
  
  updateProgress(100, 'Concluído!');
  console.log('✅ JSON exportado com sucesso!');
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function updateProgress(percent, status) {
  const fill = document.getElementById('exportProgressFill');
  const percentLabel = document.getElementById('exportProgressPercent');
  const statusLabel = document.getElementById('exportProgressStatus');
  
  if (fill) fill.style.width = `${percent}%`;
  if (percentLabel) percentLabel.textContent = `${Math.round(percent)}%`;
  if (statusLabel) statusLabel.textContent = status;
}

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function showExportSuccess(message) {
  const toast = document.getElementById('exportToast');
  const messageEl = document.getElementById('exportToastMessage');
  
  if (toast && messageEl) {
    messageEl.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
}

// Verificar permissões de download
async function checkDownloadPermissions() {
  // Verificar se é Chrome/Edge
  if (navigator.userAgent.includes('Chrome')) {
    console.log('ℹ️ Browser: Chrome/Edge detectado');
    console.log('💡 Se downloads não iniciarem:');
    console.log('   1. Verifica se downloads estão bloqueados (ícone à direita da barra de endereços)');
    console.log('   2. Settings → Privacy → Site Settings → Downloads');
    console.log('   3. Permite downloads automáticos para este site');
  }
  
  // Teste simples
  try {
    const testBlob = new Blob(['test'], { type: 'text/plain' });
    const testUrl = URL.createObjectURL(testBlob);
    URL.revokeObjectURL(testUrl);
    console.log('✅ Blob URLs funcionam corretamente');
    return true;
  } catch (e) {
    console.error('❌ Problema com Blob URLs:', e);
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════
   SKELETON SCREENS - GERADORES
   ══════════════════════════════════════════════════════════════ */

/**
 * Skeleton para Weather Card
 */
// eslint-disable-next-line no-unused-vars -- consumed by src/cards/weather.js
function skeletonWeather() {
  return `
    <div class="skeleton-container">
      <div class="skeleton-weather">
        <div class="skeleton skeleton-weather-icon"></div>
        <div class="skeleton-weather-info">
          <div class="skeleton skeleton-weather-temp"></div>
          <div class="skeleton skeleton-weather-desc"></div>
          <div class="skeleton skeleton-weather-loc"></div>
        </div>
      </div>
      <div class="skeleton-grid">
        <div class="skeleton-kpi">
          <div class="skeleton-kpi-label"></div>
          <div class="skeleton-kpi-value"></div>
        </div>
        <div class="skeleton-kpi">
          <div class="skeleton-kpi-label"></div>
          <div class="skeleton-kpi-value"></div>
        </div>
        <div class="skeleton-kpi">
          <div class="skeleton-kpi-label"></div>
          <div class="skeleton-kpi-value"></div>
        </div>
        <div class="skeleton-kpi">
          <div class="skeleton-kpi-label"></div>
          <div class="skeleton-kpi-value"></div>
        </div>
      </div>
      <div class="skeleton-forecast">
        ${Array(5).fill(0).map(() => `
          <div class="skeleton-forecast-item">
            <div class="skeleton skeleton-forecast-day"></div>
            <div class="skeleton skeleton-forecast-icon"></div>
            <div class="skeleton skeleton-forecast-temp"></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Skeleton para News/Lista
 */
function skeletonNews(count = 5) {
  return `
    <div class="skeleton-container">
      <div class="skeleton-news-list">
        ${Array(count).fill(0).map(() => `
          <div class="skeleton-news-item">
            <div class="skeleton skeleton-news-title"></div>
            <div class="skeleton skeleton-news-desc"></div>
            <div class="skeleton skeleton-news-meta"></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Skeleton para Tabela/Lista simples
 */
function skeletonTable(rows = 6) {
  return `
    <div class="skeleton-container">
      <div class="skeleton-table">
        ${Array(rows).fill(0).map(() => `
          <div class="skeleton-table-row">
            <div class="skeleton skeleton-table-cell"></div>
            <div class="skeleton skeleton-table-cell"></div>
            <div class="skeleton skeleton-table-cell"></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Skeleton para Gráfico/Chart
 */
function skeletonChart() {
  return `
    <div class="skeleton-container">
      <div class="skeleton skeleton-chart"></div>
    </div>
  `;
}

/**
 * Skeleton para KPIs Grid
 */
function skeletonKPIs(count = 4) {
  return `
    <div class="skeleton-container">
      <div class="skeleton-grid">
        ${Array(count).fill(0).map(() => `
          <div class="skeleton-kpi">
            <div class="skeleton-kpi-label"></div>
            <div class="skeleton-kpi-value"></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Skeleton genérico (linhas de texto)
 */
function skeletonGeneric(lines = 4) {
  return `
    <div class="skeleton-container">
      ${Array(lines).fill(0).map((_, i) => {
        const widths = ['90%', '75%', '85%', '60%'];
        return `<div class="skeleton skeleton-text" style="width:${widths[i % 4]}"></div>`;
      }).join('')}
    </div>
  `;
}

/**
 * Skeleton para Cards (retângulos)
 */
function skeletonCards(count = 3) {
  return `
    <div class="skeleton-container">
      ${Array(count).fill(0).map(() => `
        <div class="skeleton skeleton-card"></div>
      `).join('')}
    </div>
  `;
}


/* ══════════════════════════════════════════════════════════════
   MODAL DE TENDÊNCIA/HISTÓRICO
   ══════════════════════════════════════════════════════════════ */

let trendModal = null;

function showTrendModal(title, historyKey, options = {}) {
  const history = getHistory(historyKey, options.days || 30);
  
  if (history.length < 2) {
    alert('Histórico insuficiente. Aguarda alguns dias para ver tendências.');
    return;
  }
  
  if (!trendModal) {
    const modal = document.createElement('div');
    modal.id = 'trend-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:none;align-items:center;justify-content:center;z-index:10000;padding:20px';
    
    modal.innerHTML = `<div style="background:var(--card);border:1px solid var(--b2);border-radius:12px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--b)">
        <h3 id="trend-modal-title" style="margin:0;font-size:1.1rem;color:var(--text)"></h3>
        <button onclick="closeTrendModal()" style="background:none;border:none;color:var(--t2);font-size:1.5rem;cursor:pointer;padding:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:4px">×</button>
      </div>
      <div style="padding:24px">
        <div style="background:var(--surface);border:1px solid var(--b);border-radius:8px;padding:16px;margin-bottom:16px">
          <canvas id="trend-chart" width="600" height="300"></canvas>
        </div>
        <div id="trend-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:12px"></div>
        <div style="font-size:0.7rem;color:var(--t3);text-align:center" id="trend-footer"></div>
      </div>
    </div>`;
    
    document.body.appendChild(modal);
    trendModal = modal;
    modal.addEventListener('click', e => { if(e.target === modal) closeTrendModal(); });
  }
  
  document.getElementById('trend-modal-title').textContent = title;
  const canvas = document.getElementById('trend-chart');
  renderTrendChart(canvas, history, options);
  
  const values = history.map(h => typeof h.value === 'object' ? (h.value.price || h.value.value || 0) : h.value);
  const current = values[values.length - 1], first = values[0];
  const min = Math.min(...values), max = Math.max(...values);
  const change = ((current - first) / first * 100);
  const dec = options.decimals || 2, unit = options.unit || '';
  
  document.getElementById('trend-stats').innerHTML = `
    <div style="background:var(--b2);border-radius:6px;padding:12px;text-align:center">
      <div style="font-size:0.65rem;color:var(--t3);margin-bottom:4px">Atual</div>
      <div style="font-size:1.3rem;font-weight:700;color:${options.borderColor || '#E9A520'}">${current.toFixed(dec)}${unit}</div>
    </div>
    <div style="background:var(--b2);border-radius:6px;padding:12px;text-align:center">
      <div style="font-size:0.65rem;color:var(--t3);margin-bottom:4px">Variação</div>
      <div style="font-size:1.3rem;font-weight:700;color:${change >= 0 ? '#EF4444' : '#10B981'}">${change >= 0 ? '+' : ''}${change.toFixed(1)}%</div>
    </div>
    <div style="background:var(--b2);border-radius:6px;padding:12px;text-align:center">
      <div style="font-size:0.65rem;color:var(--t3);margin-bottom:4px">Mínimo</div>
      <div style="font-size:1.1rem;font-weight:600;color:#10B981">${min.toFixed(dec)}${unit}</div>
    </div>
    <div style="background:var(--b2);border-radius:6px;padding:12px;text-align:center">
      <div style="font-size:0.65rem;color:var(--t3);margin-bottom:4px">Máximo</div>
      <div style="font-size:1.1rem;font-weight:600;color:#EF4444">${max.toFixed(dec)}${unit}</div>
    </div>
  `;
  
  document.getElementById('trend-footer').textContent = `Dados guardados localmente • ${history.length} pontos nos últimos ${options.days || 30} dias`;
  trendModal.style.display = 'flex';
}

function closeTrendModal() {
  if (trendModal) trendModal.style.display = 'none';
}




/* ══════════════════════════════════════════════════════════════
   CABAZ ALIMENTAR DECO PROteste — histórico semanal completo
   Início monitorização: 5 Jan 2022 (183.63€)
   Actualizar: botão ✏️ no card (todas as quartas-feiras)
   Fonte: DECO PROteste comunicados semanais
   ══════════════════════════════════════════════════════════════ */

/* Histórico anual consolidado (média anual por ano) */
const CABAZ_ANUAL=[
  {y:2022, v:195.40, label:"2022", note:"Início guerra Ucrânia · inflação histórica"},
  {y:2023, v:228.60, label:"2023", note:"Pico inflação alimentar · IVA zero aplicado"},
  {y:2024, v:237.00, label:"2024", note:"Estabilização · inflação a ceder"},
  {y:2025, v:243.50, label:"2025", note:"Subida moderada · 2.3% IPC médio"},
  {y:2026, v:254.18, label:"2026", note:"Média parcial Jan-Set · ref. 16 Set 2026"},
];

/* Histórico semanal (format: [data_iso, valor_eur, nota_opcional])
   Fonte: DECO PROteste comunicados · Renascença · ECO · RTP · Agroportal
   Pontos chave reconstituídos de artigos publicados (2022-2026) */
const CABAZ_HIST_BASE=[
  /* 2022 */
  ["2022-01-05", 183.63, "Início da monitorização DECO"],
  ["2022-03-01", 185.17, "Início invasão Ucrânia · pressão cereais"],
  ["2022-06-01", 195.00, "Pico inflação energética"],
  ["2022-08-31", 206.39, "Máximo 2022 · +11% desde Mar"],
  ["2022-10-01", 208.50, ""],
  ["2022-12-01", 212.00, ""],
  /* 2023 */
  ["2023-01-04", 213.80, ""],
  ["2023-03-01", 222.00, "IVA zero cabaz 40 produtos (Abr 2023)"],
  ["2023-04-05", 217.60, "Efeito IVA zero · primeira descida"],
  ["2023-06-01", 225.00, ""],
  ["2023-08-01", 229.00, "Máximo intermédio 2023"],
  ["2023-10-01", 232.00, ""],
  ["2023-12-01", 234.50, ""],
  /* 2024 */
  ["2024-01-03", 235.82, ""],
  ["2024-03-01", 236.50, ""],
  ["2024-06-01", 234.00, "Ligeira descida · desinflação"],
  ["2024-09-01", 238.00, ""],
  ["2024-11-19", 243.65, ""],
  ["2024-11-26", 243.65, ""],
  ["2024-12-01", 244.00, ""],
  /* 2025 */
  ["2025-01-07", 241.83, "Início 2025"],
  ["2025-03-01", 239.50, ""],
  ["2025-06-01", 237.87, "Cabaz 1 ano antes: 237.87 (ref. Fev 2026)"],
  ["2025-09-01", 241.00, ""],
  ["2025-11-26", 243.65, "ref. Alvorada Nov 2025"],
  ["2025-12-17", 244.37, ""],
  /* 2026 — dados confirmados em artigos */
  ["2026-01-07", 241.83, "Início 2026"],
  ["2026-01-15", 249.09, "Máximo 4 anos · +7.27€ na semana"],
  ["2026-01-21", 251.49, "Novo máximo · curgete +25% desde Jan"],
  ["2026-01-28", 249.02, "Ligeira descida · curgete +47% YTD"],
  ["2026-02-04", 253.09, "Novo máximo · cereais fibra +16%"],
  ["2026-02-11", 253.43, "Mantém máximo · curgete +96% YTD"],
  ["2026-02-18", 253.19, ""],
  ["2026-02-25", 253.19, "4 anos guerra: +69.56€ (+37.88%)"],
  ["2026-03-12", 254.12, "Novo máximo histórico · +12.30€ desde Jan"],
  ["2026-03-19", 254.32, "Máximo absoluto histórico"],
  ["2026-03-26", 254.40, "Máximo absoluto histórico"],
  ["2026-05-06", 261.89, "Máximo histórico desde 2022"],
  ["2026-05-13", 260.41, "Descida após máximo histórico"],
  ["2026-05-27", 257.33, "Terceira semana consecutiva a descer"],
  ["2026-06-05", 259.31, "Interrompe 3 semanas de quedas"],
  ["2026-06-11", 255.57, "Maior descida desde início de abril"],
  ["2026-06-17", 257.68, "Cabaz volta a encarecer"],
  ["2026-06-24", 256.81, "Desce 0.87€ na semana"],
  ["2026-07-01", 253.63, "Nova descida semanal · -3.17€"],
  ["2026-07-08", 256.71, "Sobe 3.08€ face à semana anterior"],
  ["2026-07-15", 256.46, "Desce 0.25€ na semana"],
  ["2026-07-22", 251.29, "Maior descida do ano"],
  ["2026-07-29", 253.47, "Sobe 2.18€ face à semana anterior"],
  ["2026-08-05", 253.60, "Ligeiro aumento semanal"],
  ["2026-08-12", 252.07, "Desce 1.53€ na semana"],
  ["2026-08-19", 253.55, "Sobe 1.48€ na semana"],
  ["2026-08-26", 252.62, "Desce 0.94€ na semana"],
  ["2026-09-02", 254.73, "Sobe 2.11€ na semana"],
  ["2026-09-09", 255.26, "Segunda semana consecutiva a subir"],
  ["2026-09-16", 255.97, "Terceira semana consecutiva a subir"],
];

const CABAZ_CK = "cabaz_deco_v1";

/* Carregar histórico persistido do localStorage (entradas manuais adicionadas pelo user) */
function loadCabazHist(){
  let extra=[];
  try{
    const s=localStorage.getItem(CABAZ_CK);
    if(s) extra=JSON.parse(s);
  }catch{}
  /* Merge: base + extra, sem duplicados por data, ordenado */
  const byDate={};
  [...CABAZ_HIST_BASE,...extra].forEach(e=>{byDate[e[0]]=e;});
  return Object.values(byDate).sort((a,b)=>a[0]>b[0]?1:-1);
}

/* Guardar entrada manual */
function saveCabazToLS(iso, valor, nota){
  let extra=[];
  try{const s=localStorage.getItem(CABAZ_CK);if(s)extra=JSON.parse(s);}catch{}
  /* Substituir se mesmo dia */
  extra=extra.filter(e=>e[0]!==iso);
  extra.push([iso,valor,nota||""]);
  localStorage.setItem(CABAZ_CK,JSON.stringify(extra));
}

/* ── Render principal ── */
function renderCabaz(){
  const el=document.getElementById("cabaz-body");
  if(!el)return;

  const hist=loadCabazHist();
  if(!hist.length){el.innerHTML='<p class="err">Sem dados</p>';return;}

  const cur=hist[hist.length-1];
  const prev=hist[hist.length-2]||cur;
  const weekChg=cur[1]-prev[1];
  const weekPct=(weekChg/prev[1]*100);

  /* Há 1 ano (aprox. 52 entradas atrás, ou a mais próxima de 365 dias) */
  const curDate=new Date(cur[0]);
  const yearAgo=hist.filter(e=>new Date(e[0])<=new Date(curDate-365*864e5));
  const yearRef=yearAgo.length?yearAgo[yearAgo.length-1]:hist[0];
  const yearChg=cur[1]-yearRef[1];
  const yearPct=(yearChg/yearRef[1]*100);

  /* Desde início (Jan 2022) */
  const start=hist[0];
  const totalChg=cur[1]-start[1];
  const totalPct=(totalChg/start[1]*100);

  /* Desde início do ano corrente */
  const curYear=curDate.getFullYear();
  const startYear=hist.filter(e=>e[0].startsWith(curYear+"-")).shift()||start;
  const ytdChg=cur[1]-startYear[1];

  /* Sparkline */
  const vals=hist.map(e=>e[1]);
  const vMin=Math.min(...vals), vMax=Math.max(...vals), vRng=vMax-vMin||1;
  const SW=280, SH=52;
  const spx=i=>Math.round(i/(vals.length-1)*SW);
  const spy=v=>Math.round(SH-(v-vMin)/vRng*(SH-6)+3);
  const pts=vals.map((v,i)=>`${spx(i)},${spy(v)}`).join(" ");
  const fill=pts+` ${SW},${SH+2} 0,${SH+2}`;

  /* Anos para ticks no gráfico */
  const years=[...new Set(hist.map(e=>e[0].slice(0,4)))];
  const yearTicks=years.map(y=>{
    const idx=hist.findIndex(e=>e[0].startsWith(y));
    return idx>=0?`<text x="${spx(idx)}" y="${SH+14}" font-size="7.5" fill="var(--t3)"
      text-anchor="middle">${y}</text>`:""
  }).join("");

  /* Classificação da tendência esta semana */
  const wCol=weekChg>=0?"#EF4444":"#10B981";
  const wArr=weekChg>=0?"▲":"▼";
  const wColYTD=ytdChg>=0?"#EF4444":"#10B981";
  const wColYear=yearChg>=0?"#EF4444":"#10B981";

  /* Data formatada */
  const fmtDate=iso=>{
    const d=new Date(iso+"T12:00:00");
    return d.toLocaleDateString("pt-PT",{day:"numeric",month:"short",year:"numeric"});
  };

  el.innerHTML=`
  <!-- Hero: valor actual + variações -->
  <div style="background:var(--b2);border-radius:10px;padding:11px 14px;margin-bottom:10px">
    <div style="font-size:.58rem;color:var(--t3);text-transform:uppercase;
         letter-spacing:.5px;margin-bottom:3px">
      Cabaz 63 produtos · ${fmtDate(cur[0])}
      <span style="font-size:.5rem;background:#F59E0B22;color:#F59E0B;
            border-radius:3px;padding:1px 5px;margin-left:5px">⚠ dados manuais</span>
    </div>
    <div style="display:flex;align-items:flex-end;gap:8px;margin-bottom:6px">
      <div style="font-size:2.6rem;font-weight:900;color:#10B981;line-height:1;letter-spacing:-1px">
        ${cur[1].toFixed(2)}</div>
      <div style="font-size:.85rem;color:var(--t3);margin-bottom:4px">€</div>
      <div style="flex:1"></div>
      <div style="text-align:right">
        <div style="font-size:.75rem;font-weight:700;color:${wCol}">
          ${wArr} ${Math.abs(weekChg).toFixed(2)}€ <span style="font-size:.62rem;font-weight:400">(${Math.abs(weekPct).toFixed(2)}%)</span>
        </div>
        <div style="font-size:.6rem;color:var(--t3)">vs semana anterior</div>
      </div>
    </div>
    ${cur[2]?`<div style="font-size:.65rem;color:var(--t3);border-top:1px solid var(--b);
       padding-top:5px;margin-top:2px">💬 ${cur[2]}</div>`:""}
  </div>

  <!-- KPIs 4 em grelha -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:10px">
    <div style="background:var(--b2);border-radius:7px;padding:7px 8px;text-align:center">
      <div style="font-size:1rem;font-weight:800;color:${wCol}">${wArr}${Math.abs(weekPct).toFixed(1)}%</div>
      <div style="font-size:.55rem;color:var(--t3);margin-top:2px">semana</div>
    </div>
    <div style="background:var(--b2);border-radius:7px;padding:7px 8px;text-align:center">
      <div style="font-size:1rem;font-weight:800;color:${wColYTD}">
        ${ytdChg>=0?"+":""}${ytdChg.toFixed(2)}€</div>
      <div style="font-size:.55rem;color:var(--t3);margin-top:2px">desde Jan ${curYear}</div>
    </div>
    <div style="background:var(--b2);border-radius:7px;padding:7px 8px;text-align:center">
      <div style="font-size:1rem;font-weight:800;color:${wColYear}">
        ${yearChg>=0?"+":""}${Math.abs(yearChg).toFixed(2)}€</div>
      <div style="font-size:.55rem;color:var(--t3);margin-top:2px">vs 1 ano atrás</div>
    </div>
    <div style="background:var(--b2);border-radius:7px;padding:7px 8px;text-align:center">
      <div style="font-size:1rem;font-weight:800;color:#EF4444">
        +${Math.abs(totalPct).toFixed(1)}%</div>
      <div style="font-size:.55rem;color:var(--t3);margin-top:2px">desde Jan 2022</div>
    </div>
  </div>

  <!-- Sparkline histórico completo -->
  <div style="background:var(--b2);border-radius:8px;padding:10px 12px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
      <div style="font-size:.62rem;font-weight:600;color:var(--t2)">Evolução Jan 2022 → Hoje</div>
      <div style="font-size:.6rem;color:var(--t3)">${hist.length} registos</div>
    </div>
    <svg viewBox="0 0 ${SW} ${SH+18}" style="width:100%;height:${SH+18}px">
      <defs>
        <linearGradient id="cabaz-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10B981" stop-opacity=".25"/>
          <stop offset="100%" stop-color="#10B981" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <!-- Linha de referência: preço início 2022 -->
      <line x1="0" y1="${spy(start[1])}" x2="${SW}" y2="${spy(start[1])}"
            stroke="rgba(255,255,255,.1)" stroke-width="1" stroke-dasharray="3,3"/>
      <text x="2" y="${spy(start[1])-3}" font-size="6.5" fill="rgba(255,255,255,.3)">
        ${start[1].toFixed(0)}€
      </text>
      <!-- Área + linha -->
      <polygon points="${fill}" fill="url(#cabaz-grad)"/>
      <polyline points="${pts}" fill="none" stroke="#10B981" stroke-width="2"/>
      <!-- Ponto actual -->
      <circle cx="${spx(vals.length-1)}" cy="${spy(cur[1])}" r="4" fill="#10B981"/>
      <text x="${Math.min(spx(vals.length-1)-2,SW-32)}" y="${spy(cur[1])-6}"
            font-size="7" fill="#10B981" text-anchor="end" font-weight="bold">
        ${cur[1].toFixed(2)}€
      </text>
      <!-- Ticks de ano -->
      ${yearTicks}
    </svg>
  </div>

  <!-- Comparação anual em barras -->
  <div style="margin-bottom:10px">
    <div style="font-size:.62rem;font-weight:600;color:var(--t2);margin-bottom:5px">
      Média anual do cabaz
    </div>
    ${(()=>{
      const maxV=Math.max(...CABAZ_ANUAL.map(x=>x.v));
      return CABAZ_ANUAL.map(a=>{
        const bw=(a.v/maxV*100).toFixed(1);
        const col=a.y===2022?"#3B82F6":a.y===2023?"#8B5CF6":a.y===2024?"#F59E0B":"#EF4444";
        return `<div style="display:flex;align-items:center;gap:7px;margin-bottom:4px">
          <div style="font-family:var(--mono);font-size:.62rem;color:var(--t2);min-width:32px">${a.y}</div>
          <div style="flex:1;background:var(--b);border-radius:3px;height:7px">
            <div style="width:${bw}%;height:100%;background:${col};border-radius:3px"></div>
          </div>
          <div style="font-family:var(--mono);font-size:.65rem;font-weight:600;color:${col};min-width:52px;text-align:right">
            ${a.v.toFixed(2)}€</div>
        </div>
        <div style="font-size:.55rem;color:var(--t3);margin:-2px 0 4px 39px">${a.note}</div>`;
      }).join("");
    })()}
  </div>

  <!-- Aviso de metodologia e update -->
  <div style="background:#F59E0B12;border:1px solid #F59E0B33;border-radius:7px;
       padding:7px 10px;font-size:.63rem;color:#F59E0B;line-height:1.5">
    ⚠ Dados actualizados manualmente. A DECO PROteste publica às <b>quartas-feiras</b>.
    Clica em <b>✏️</b> para adicionar o valor da semana corrente.
    <a href="https://www.deco.proteste.pt/familia-consumo/supermercado/noticias/precos-estao-aumentar-alimentos"
       target="_blank" style="color:#F59E0B;text-decoration:underline">Ver em deco.proteste.pt →</a>
  </div>`;
}

/* ── Modal de edição ── */
let lastFocusCabaz = null;

function openCabazEditor(){
  lastFocusCabaz = document.activeElement;
  const modal=document.getElementById("cabaz-modal");
  if(!modal)return;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden","false");
  const btn=document.getElementById("cabaz-edit-btn");
  if(btn) btn.setAttribute("aria-expanded","true");

  /* Pré-preencher com data de hoje e valor actual */
  const hist=loadCabazHist();
  const cur=hist[hist.length-1];
  const today=new Date().toISOString().slice(0,10);
  const inputData=document.getElementById("cabaz-input-data");
  const inputValor=document.getElementById("cabaz-input-valor");
  if(inputData) inputData.value=today;
  if(inputValor) inputValor.value=cur?cur[1]:"";
  document.body.style.overflow="hidden";
  if(inputValor) inputValor.focus();
}

function closeCabazEditor(){
  const modal=document.getElementById("cabaz-modal");
  if(modal){
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden","true");
  }
  document.body.style.overflow="";
  const btn=document.getElementById("cabaz-edit-btn");
  if(btn) btn.setAttribute("aria-expanded","false");
  const target=lastFocusCabaz||btn;
  if(target && typeof target.focus==="function") target.focus();
  lastFocusCabaz=null;
}

function saveCabazEntry(){
  const iso=document.getElementById("cabaz-input-data")?.value;
  const raw=document.getElementById("cabaz-input-valor")?.value;
  const nota=document.getElementById("cabaz-input-nota")?.value||"";
  const s=(raw??"").toString().trim().replace(/[€\s]/g,"");
  const valor=parseFloat(s.includes(",") && s.includes(".") ? s.replace(/\./g,"").replace(",",".") : s.replace(",","."));

  if(!iso||isNaN(valor)||valor<150||valor>600){
    alert("Insere uma data válida e um valor entre 150€ e 600€.");
    return;
  }

  saveCabazToLS(iso,valor,nota);
  closeCabazEditor();
  renderCabaz();

  /* Confirmação visual */
  const btn=document.getElementById("cabaz-edit-btn");
  if(btn){
    const orig=btn.textContent;
    btn.textContent="✓";
    btn.style.color="var(--green)";
    setTimeout(()=>{btn.textContent=orig;btn.style.color="";},2000);
  }
}

// ESC para fechar
document.addEventListener("keydown",(e)=>{
  if(e.key!=="Escape") return;
  const modal=document.getElementById("cabaz-modal");
  if(modal && modal.classList.contains("show")) closeCabazEditor();
});

/* Fechar modal ao clicar fora */
document.getElementById("cabaz-modal")?.addEventListener("click",function(e){
  if(e.target===this)closeCabazEditor();
});

/* Boot */
renderCabaz();

