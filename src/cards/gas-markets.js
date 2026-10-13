/* Cards TTF e gás natural PT. Dependem das APIs partilhadas em core/cache/fetch/app. */
(function() {
function isValidTTFData(data) {
  const isOptionalNumber = value => (value === null || value === undefined) || (typeof value === "number" && Number.isFinite(value));
  return !!data && typeof data.price === "number" && Number.isFinite(data.price) && data.price > 0 && data.price < 500
    && ((data.prev === null || data.prev === undefined) || (typeof data.prev === "number" && Number.isFinite(data.prev) && data.prev > 0 && data.prev < 500))
    && isOptionalNumber(data.hi) && isOptionalNumber(data.lo) && isOptionalNumber(data.chg);
}

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
      if(isValidTTFData(cached)){
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


function loadGasPT(_force=false){
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
  const cachedTTF=lsGet("ttf_live_v1");
  const ttfCache=isValidTTFData(cachedTTF)?cachedTTF:null;
  const ttfPrice =ttfCache?.price??null;
  const ttfPrev  =ttfCache?.prev ??null;
  const ttfSrc   =ttfCache?.src  ??null;
  const isLive   =!!(ttfCache?.live);

  /* MIBGAS estimado */
  const mibSpot = G.mibgasSpot || 50;
  const mibEst =ttfPrice !== null?+(ttfPrice+spreadActual).toFixed(2):null;
  const mibPrev=ttfPrev !== null?+(ttfPrev +spreadActual).toFixed(2):(G.mibgasPrev || mibSpot);
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
          ${ttfPrice !== null?ttfPrice.toFixed(2):G.ttfSpot.toFixed(2)}</div>
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
window.loadTTF = loadTTF;
window.setTTFTrendDays = setTTFTrendDays;
window.loadGasPT = loadGasPT;
})();
