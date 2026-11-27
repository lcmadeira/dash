/* global CFG,REF_DATE,IPMA_CITIES,CACHE_TTL,lsGet,fmtAgeShort,getCacheMeta,refreshAllCardStatuses,applyStickyScrollCards,$,loadElec,loadNews,loadSeis,loadCivilProtection,loadDams,loadAndRenderCalendar,loadHolidays,loadAirQuality,loadWeather,getFuelPrefs,syncFuelDeltaBtn,renderFuel,FUEL_SLUGS,tickMarkets,loadMarketStats,loadImob,loadFng,loadAgri,renderExp,renderDiv,loadRec,loadAir,loadOrmuz,loadCO2,loadTransp,loadPress,loadSMN,initInflation,renderInflation,initEuribor,loadFX,loadCrypto,loadPSI20,loadGeo,loadTTF,loadGasPT */
/* Globais chamados a partir do index.html (onclick) ou de outros scripts clássicos: */
/* exported
   addToHistory, clearAllNotifications, dismissNotification, executeExport,
   filterNotifications, markAllAsRead, moveCard, openCabazEditor, openExportModal, openFuelModal,
   openNotificationSettings, quickAddTicker, removeTicker, resetSettings, saveCabazEntry, saveSettings,
   selectExportFormat, setComfortDensity, setComfortMotion, _setOnByDataAttr, showTrendModal,
   skeletonKPIs, skeletonNews, skeletonTable, switchOil, switchSettingsTab, toggleAllCards,
   toggleCardSelection, toggleCardVisibility, toggleNotifications, exportSelectPreset */
/* Relógios das praças financeiras movidos para src/widgets/market-clock.js */
/* Relógio do cabeçalho: data e hora sem segundos (só reescreve quando muda) */
function tick(){
  const n=new Date();
  const time=n.toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"});
  const clk=document.getElementById("clk");
  if(clk && clk.textContent!==time){
    clk.textContent=time;
    clk.dateTime=n.toISOString();
    const d=n.toLocaleDateString("pt-PT",{weekday:"long",day:"numeric",month:"long"});
    document.getElementById("clkd").textContent=d.charAt(0).toUpperCase()+d.slice(1);
  }
  tickMarkets();
}
tick();setInterval(tick,1000);

/* Utils movidos para src/core.js */

/* Cache/fetch helpers movidos para src/cache.js e src/fetch.js */

/* Data status helpers movidos para src/ui.js */

/* Dev proxy + fetch/cache helpers movidos para src/fetch.js e src/cache.js */

// Sem iframe ao fim deste tempo, o widget é dado como indisponível (ex.: nó da CDN do TradingView
// sem resposta a 26-11-2026, ERR_CONNECTION_TIMED_OUT): mostra-se aviso em vez de um card vazio.
const TV_LOAD_TIMEOUT_MS = 20000;

function mountLazyTradingView(host, scriptUrl, config, height = 0) {
  if (!host) return;

  const cardIdOf = () => {
    const card = host.closest('.card, .tv-chart-card');
    return card?.dataset.cardId || (card?.id?.startsWith('card-') ? card.id.slice(5) : '');
  };

  const showUnavailable = (container) => {
    if (!container.isConnected || container.querySelector('iframe')) return;
    const box = document.createElement('div');
    box.className = 'tv-lazy-placeholder tv-unavailable';
    box.setAttribute('role', 'status');
    if (height) box.style.minHeight = `${height}px`;
    const text = document.createElement('span');
    text.textContent = 'TradingView indisponível: o serviço não respondeu.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'rbtn';
    retry.textContent = 'Tentar novamente';
    retry.addEventListener('click', () => loadWidget());
    box.append(text, retry);
    host.replaceChildren(box);
    const cardId = cardIdOf();
    if (cardId && typeof window.setCardStatus === 'function') {
      window.setCardStatus(cardId, 'error', 'TradingView indisponível', { force: true, title: 'O script do TradingView não carregou' });
      const inline = document.querySelector(`.card-inline-retry[data-retry-for="${cardId}"]`);
      if (inline) inline.onclick = () => loadWidget();
    }
  };

  const loadWidget = () => {
    const container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    if (height) container.style.minHeight = `${height}px`;

    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    container.appendChild(widget);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = scriptUrl;
    script.async = true;
    script.text = JSON.stringify(config);
    script.addEventListener('error', () => showUnavailable(container));
    container.appendChild(script);

    host.replaceChildren(container);
    setTimeout(() => showUnavailable(container), TV_LOAD_TIMEOUT_MS);
    const cardId = cardIdOf();
    if (cardId && typeof window.setCardStatus === 'function') {
      window.setCardStatus(cardId, 'live', 'Live', { force: true, title: 'Widget live' });
    }
  };

  host.dataset.lazyId = 'tradingview';
  host.replaceChildren();
  const placeholder = document.createElement('div');
  placeholder.className = 'tv-lazy-placeholder';
  placeholder.setAttribute('role', 'status');
  placeholder.textContent = 'A carregar dados de mercado…';
  if (height) placeholder.style.minHeight = `${height}px`;
  host.appendChild(placeholder);

  if (!registerLazyLoad(host, loadWidget)) loadWidget();
}

function initStaticTradingViewWidgets() {
  document.querySelectorAll('template[data-tradingview-widget]').forEach((template) => {
    const source = template.content.querySelector('script[src]');
    const host = template.parentElement;
    if (!source || !host) return;

    try {
      const config = JSON.parse(source.textContent.trim());
      const height = Number(template.dataset.height) || 0;
      const scriptUrl = source.src;
      template.remove();
      mountLazyTradingView(host, scriptUrl, config, height);
    } catch (error) {
      console.error('Não foi possível preparar o widget TradingView:', error);
    }
  });
}

/* ── Oil tabs ── */
function switchOil(type,btn){
  document.querySelectorAll(".oil-tab").forEach(b=>b.classList.remove("on"));
  btn.classList.add("on");
  $("oil-brent").style.display=type==="brent"?"block":"none";
  $("oil-wti").style.display  =type==="wti"  ?"block":"none";
}

/* ── Bolsa Lisboa — TV widget dinâmico por acção ── */
/* ── Mapa de Calor ── */
/* Cada separador usa o widget TradingView próprio: o de ações não conhece "Crypto"/"ETF" e
   volta ao S&P 500. Configurações conforme os valores por omissão de cada widget. */
const HMAP_CONFIGS={
  sp500:{script:"https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js",note:"S&P 500 · Por sector · Tamanho = capitalização · Cor = variação dia",
    config:{dataSource:"SPX500",exchanges:[],grouping:"sector",blockSize:"market_cap_basic",blockColor:"change"}},
  crypto:{script:"https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js",note:"Criptomoedas · Tamanho = capitalização · Cor = variação 24 h",
    config:{dataSource:"Crypto",blockSize:"market_cap_calc",blockColor:"24h_close_change|5"}},
  etf:{script:"https://s3.tradingview.com/external-embedding/embed-widget-etf-heatmap.js",note:"ETF dos EUA · Por classe de ativos · Tamanho = volume do dia · Cor = variação dia",
    // O widget de ETF só aceita volume/turnover/mono (sem AUM): "aum" caía em volume.
    config:{dataSource:"AllUSEtf",grouping:"asset_class",blockSize:"volume",blockColor:"change"}},
};
const HMAP_WIDGET_HOSTS = new Map();
function switchHmap(key,btn){
  document.querySelectorAll("#hmap-tabs .psi-tab").forEach(b=>b.classList.remove("on"));
  if(btn)btn.classList.add("on");
  const c=HMAP_CONFIGS[key];if(!c)return;
  const root=document.getElementById("hmap-widget");if(!root)return;
  const note=document.getElementById("hmap-note");
  if(note)note.textContent=`✦ TradingView · ${c.note}`;
  let host=HMAP_WIDGET_HOSTS.get(key);
  if(!host){
    host=document.createElement("div");
    host.dataset.hmapKey=key;
    root.appendChild(host);
    HMAP_WIDGET_HOSTS.set(key,host);
    mountLazyTradingView(host,c.script,{...c.config,locale:"pt",colorTheme:"dark",hasTopBar:true,isDataSetEnabled:false,isZoomEnabled:true,hasSymbolTooltip:true,isMonoSize:false,width:"100%",height:460},460);
  }
  HMAP_WIDGET_HOSTS.forEach((widgetHost,widgetKey)=>{widgetHost.hidden=widgetKey!==key;});
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
  // O canvas não entende variáveis CSS ("var(--blue)" ficava preto): resolver para a cor real.
  const resolveColor = (value, fallback) => {
    const m = /^var\((--[\w-]+)\)$/.exec(String(value || '').trim());
    if (!m) return value;
    try {
      const v = window.getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim();
      return v || fallback;
    } catch { return fallback; }
  };
  cfg.borderColor = resolveColor(cfg.borderColor, defaults.borderColor);
  cfg.backgroundColor = resolveColor(cfg.backgroundColor, defaults.backgroundColor);
  const fmtValue = v => Number(v).toLocaleString('pt-PT', { minimumFractionDigits: cfg.decimals, maximumFractionDigits: cfg.decimals });
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
            label: (ctx) => `${cfg.label}: ${fmtValue(ctx.parsed.y)}${cfg.unit}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: (val) => fmtValue(val) + cfg.unit,
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

/* exported _lastN -- usado pelos cards (psi20, crypto, gas-markets) */
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



/* Feriados movidos para src/cards/holidays.js */

/* ── EURIBOR — API BCE (data-api.ecb.europa.eu) ──
   Series keys:
     3M  → FM.M.U2.EUR.RT0.MM.EURIBOR3MD_.HSTA
     6M  → FM.M.U2.EUR.RT0.MM.EURIBOR6MD_.HSTA
     12M → FM.M.U2.EUR.RT0.MM.EURIBOR1YD_.HSTA
   Endpoint: /service/data/{flow}/{key}?format=jsondata&lastNObservations=6
   CORS: nativo (cabeçalho Access-Control-Allow-Origin: *)
─────────────────────────────────────────────────── */





/* Euribor movida para src/cards/euribor.js */

/* Câmbio e histórico EUR movidos para src/cards/fx.js */

/* ── Inflação PT vs Zona Euro ── */

/* ══════════════════════════════════════════════════════════════
   INFLAÇÃO — Eurostat API Statistics (CORS nativo, sem chave)
   Dataset : PRC_HICP_MINR (HICP ECOICOP v2, monthly, unit=RCH_A, coicop18=TOTAL)
   Geo     : PT (Portugal) + EA20/EA21 (composição vigente da Zona Euro)
   Coicop  : CP00 (todos os itens — índice geral)
   URL base: https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/
   Estratégia: fallback estático imediato → Eurostat em background
   ══════════════════════════════════════════════════════════════ */

/* Dados estáticos como fallback definidos em src/config.js. */
/* Inflação Portugal/UE movida para src/cards/inflation.js */

/* Criptomoedas e histórico movidos para src/cards/crypto.js */

/* Twelve Data permanece desativado: a aplicação não tem endpoint de backend
   para manter uma chave API fora do código público. */

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
setTimeout(()=>{renderExp();renderDiv();window.loadExp?.();window.loadDiv?.();},50);
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
setTimeout(()=>loadCivilProtection(), 3400);
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

  loadFng(true);loadAgri(true);loadSeis(true);loadCivilProtection(true);loadAir(true);loadOrmuz(true);loadCO2(true);loadImob(true);
  setTimeout(()=>loadMarketStats(true),1500);
  renderCabaz();
  setTimeout(()=>loadPSI20(true),3000);
},CACHE_TTL);

/* Atualização automática por expiração: cards cuja cópia local dura menos do que o ciclo
   de 15 min (ou que expira entre ciclos) voltam a carregar assim que a cópia expira,
   só com a página visível e o card à vista. Evita o selo "Stale" com a página aberta. */
const AUTO_REFRESH_CARDS = [
  { id: "psi20",      key: "psi20_v2",    load: () => loadPSI20(true) },
  { id: "mstats",     key: "mstats_v4",   load: () => loadMarketStats(true) },
  { id: "agri",       key: "agri_v3",     load: () => loadAgri(true) },
  { id: "crypto",     key: "cg",          load: () => loadCrypto(true) },
  { id: "fx",         key: "fx",          load: () => loadFX(true) },
  { id: "air",        key: "air_v9",      load: () => loadAir(true) },
  { id: "anpc",       key: "anpc_active_v1", load: () => loadCivilProtection(true) },
  { id: "gas-eu",     key: "ttf_live_v1", load: () => loadTTF(true) },
  { id: "gas-pt",     key: "ttf_live_v1", load: () => loadGasPT(true) },
  { id: "news-pt",    key: "rss_pt",      load: () => loadNews("pt", true) },
  { id: "news-world", key: "rss_world",   load: () => loadNews("world", true) },
];
const autoRefreshInFlight = new Set();
/* Se a fonte falhar (a cópia continua expirada), a tentativa seguinte espera 2, 4, 8… até 15 min. */
const autoRefreshBackoff = new Map(); // id → { failures, retryAt }
const AUTO_REFRESH_BACKOFF_MS = [2, 4, 8, 15].map(min => min * 60 * 1000);

function autoRefreshExpiredCards(now = Date.now()) {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return 0;
  let started = 0;
  for (const card of AUTO_REFRESH_CARDS) {
    if (autoRefreshInFlight.has(card.id) || !isCardVisible(card.id)) continue;
    if ((autoRefreshBackoff.get(card.id)?.retryAt || 0) > now) continue;
    const meta = getCacheMeta(card.key);
    if (!meta || !meta.expired) continue; // sem cópia: o carregamento inicial (lazy) trata do card
    autoRefreshInFlight.add(card.id);
    started++;
    Promise.resolve()
      .then(card.load)
      .catch(() => {})
      .finally(() => {
        autoRefreshInFlight.delete(card.id);
        if (getCacheMeta(card.key)?.expired) {
          const failures = (autoRefreshBackoff.get(card.id)?.failures || 0) + 1;
          const wait = AUTO_REFRESH_BACKOFF_MS[Math.min(failures, AUTO_REFRESH_BACKOFF_MS.length) - 1];
          autoRefreshBackoff.set(card.id, { failures, retryAt: Date.now() + wait });
        } else {
          autoRefreshBackoff.delete(card.id);
        }
        try { window.refreshCardStatusFromCache?.(card.id, card.key); } catch { /* selo atualiza no ciclo seguinte */ }
      });
  }
  return started;
}
window.autoRefreshExpiredCards = autoRefreshExpiredCards;
setInterval(autoRefreshExpiredCards, 60 * 1000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") autoRefreshExpiredCards();
});

/* ═══ MAPA CONFLITOS v2 ═══ */
(function(){

const C=[
  /* [nome, tipo, lat, lon, descrição, região] — revisto a 23-11-2026 (CrisisWatch out/2026 e imprensa) */
  ["Ucrânia","war",49.0,32.0,"5.º ano · negociações em Abu Dhabi sem trégua","Europa"],
  ["Gaza","high",31.4,34.4,"Cessar-fogo frágil · ocupação parcial","Médio Oriente"],
  ["Sudão","war",15.5,32.5,"SAF vs RSF · ofensiva no Cordofão","África"],
  ["Myanmar","war",19.7,96.1,"Junta vs resistência · ataques aéreos","Ásia"],
  ["Etiópia","war",9.1,40.5,"Ofensiva no Tigré · tensão com a Eritreia","África"],
  ["RD Congo","war",-4.0,21.8,"M23 (agora com Kabila) · Kivu","África"],
  ["Sahel","war",12.0,-2.0,"JNIM · bloqueio de Bamako","África"],
  ["Somália","war",5.1,46.2,"Al-Shabaab","África"],
  ["Iémen","war",15.5,48.5,"Houthis vs Arábia Saudita · ofensiva sobre Sanaa","Médio Oriente"],
  ["Síria","high",35.0,38.3,"Transição pós-Assad · violência sectária","Médio Oriente"],
  ["Paquistão–Afeganistão","high",33.9,69.5,"Confrontos fronteiriços","Ásia"],
  ["Líbano","high",33.9,35.5,"Guerra de 2026 · trégua frágil","Médio Oriente"],
  ["Iraque","high",33.2,43.7,"Milícias pro-Irão","Médio Oriente"],
  ["Moçambique","high",-13.0,39.0,"Cabo Delgado · guerra de desgaste","África"],
  ["Nigéria N.","high",11.8,13.2,"Boko Haram · ISWAP","África"],
  ["Haiti","high",18.9,-72.3,"Gangues · tropas de El Salvador","Américas"],
  ["Cisjordânia","high",31.9,35.2,"Colonatos · IDF","Médio Oriente"],
  ["Burkina Faso","high",12.4,-1.5,"Junta · jihadistas","África"],
  ["Taiwan","tension",24.0,121.0,"Exercícios de cerco do EPL","Ásia"],
  ["Coreia Norte","tension",40.0,127.5,"Nuclear · ICBM","Ásia"],
  ["Irão","war",32.4,53.7,"Guerra com EUA/Israel desde fev · Ormuz","Médio Oriente"],
  ["Kosovo","tension",42.6,21.2,"Sérvia · NATO","Europa"],
  ["Geórgia","tension",42.3,43.4,"Influência russa","Europa"],
  ["Moldávia","tension",47.4,28.9,"Transnistria","Europa"],
  ["Arménia","tension",40.1,47.6,"Tratado de paz por assinar","Europa"],
  ["Mar Sul China","tension",14.0,114.0,"Filipinas · China · EUA","Ásia"],
  ["Venezuela","tension",8.0,-66.0,"Pós-Maduro · tutela dos EUA","Américas"],
  ["Paquistão–Índia","nuclear",30.0,73.0,"Caxemira · cessar-fogo de maio de 2025","Ásia"],
  ["Rússia–OTAN","nuclear",55.0,37.6,"Drones no Báltico","Europa"],
];

const CC={war:"#EF4444",high:"#F59E0B",tension:"#8B5CF6",nuclear:"#3B82F6"};
const CL={war:"Guerra Ativa",high:"Alta Intensidade",tension:"Tensão",nuclear:"Risco Nuclear"};


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




window.buildConflictMap=function(){
  const wrap=document.getElementById("cmap-content");
  if(!wrap)return;
  wrap.innerHTML='<canvas id="cmap-canvas" style="width:100%;height:100%;display:block;border-radius:6px"></canvas>'
    +'<div id="cmap-tip" style="position:absolute;background:#1E2340;border:1px solid #3D4560;padding:6px 10px;border-radius:6px;font-size:.74rem;color:var(--text);pointer-events:none;opacity:0;transition:opacity .15s;z-index:10;max-width:180px;line-height:1.4"></div>';

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
    for(let lon=-180;lon<=180;lon+=30){
      const x=proj(0,lon,W,H)[0];
      ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();
    }
    for(let lat=-60;lat<=60;lat+=30){
      const y=proj(lat,0,W,H)[1];
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
          for(let ci=0;ci<ring.length;ci++){
            const p=proj(ring[ci][1],ring[ci][0],W,H);
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
    for(let ci=0;ci<C.length;ci++){
      const c=C[ci];
      const p=proj(c[2],c[3],W,H);
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
    for(let lon=-120;lon<=120;lon+=60){
      const x=proj(0,lon,W,H)[0];
      ctx.fillText(lon+"°",x,H-4);
    }
    ctx.textAlign="left";
    for(let lat=-60;lat<=60;lat+=30){
      if(lat===0)continue;
      const y=proj(lat,0,W,H)[1];
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
  html+='<div class="cmap-stat"><div class="cmap-stat-lbl">Total de conflitos</div><div class="cmap-stat-val" style="color:var(--red)">'+total+'</div><div class="cmap-stat-sub">ativos · nov 2026</div></div>';
  html+='<div class="cmap-stat"><div class="cmap-stat-lbl">Guerras ativas</div><div class="cmap-stat-val" style="color:var(--red)">'+byType.war+'</div><div class="cmap-stat-sub">conflito armado contínuo</div></div>';
  html+='<div class="cmap-stat"><div class="cmap-stat-lbl">Alta intensidade</div><div class="cmap-stat-val" style="color:var(--amber)">'+byType.high+'</div><div class="cmap-stat-sub">violência significativa</div></div>';
  html+='<div class="cmap-stat"><div class="cmap-stat-lbl">Risco nuclear</div><div class="cmap-stat-val" style="color:var(--blue)">'+byType.nuclear+'</div><div class="cmap-stat-sub">cenários escalação</div></div>';
  html+='</div>';

  html+='<div style="font-family:var(--mono);font-size:.74rem;text-transform:uppercase;letter-spacing:.7px;color:var(--t3);margin-bottom:8px">Distribuição por região</div>';
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
  html+='<div style="font-family:var(--mono);font-size:.74rem;color:var(--t3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:6px">Índice de tensão global</div>';
  html+='<div style="display:flex;align-items:center;gap:10px">';
  html+='<div style="font-size:1.6rem;font-weight:700;color:var(--red)">'+intensity+'</div>';
  html+='<div>';
  html+='<div style="width:160px;height:8px;background:var(--b2);border-radius:4px;overflow:hidden;margin-bottom:3px">';
  html+='<div style="width:'+intensity+'%;height:100%;background:linear-gradient(90deg,#10b981,#f59e0b,#ef4444);border-radius:4px"></div>';
  html+='</div>';
  html+='<div style="font-family:var(--mono);font-size:.74rem;color:var(--t3)">Elevado · guerras no Médio Oriente desde 2026</div>';
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
window.switchCmap=function(tab,btn){
  document.querySelectorAll(".cmap-tab").forEach(function(b){b.classList.remove("on");});
  if(btn)btn.classList.add("on");
  const legend=document.getElementById("cmap-legend");
  if(legend)legend.style.display=tab==="mapa"?"flex":"none";
  if(tab==="mapa")window.buildConflictMap();
  else if(tab==="stats")buildStats();
  else buildLista();
};

})();


/* RSS geopolítico movido para src/cards/geopolitics.js */
buildConflictMap();
loadGeo();

/* ══════════════════════════════════════════════════════════════
   FEAR & GREED INDEX — Alternative.me (CORS livre)
   ══════════════════════════════════════════════════════════════ */

/* Cards de gás TTF e PT movidos para src/cards/gas-markets.js */

/* PSI 20 movido para src/cards/psi20.js */

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
// PERFORMANCE MONITOR
// ──────────────────────────────────────────────────────────────

const perfMonitor = {
  marks: {},
  measures: {}
};

function perfMark(name) {
  perfMonitor.marks[name] = performance.now();
}

// Limites do relatório de desempenho. A inicialização total ronda os 100 ms no portátil (26-11-2026):
// só se avisa acima de 250 ms, para o aviso no console indicar um problema real.
const PERF_OK_MS = 100;
const PERF_SLOW_MS = 250;

function perfMeasure(name, startMark) {
  if (!perfMonitor.marks[startMark]) return;
  
  const duration = performance.now() - perfMonitor.marks[startMark];
  perfMonitor.measures[name] = duration;
  
  if (duration > PERF_SLOW_MS) {
    console.warn(`⚠️ Operação lenta: ${name} levou ${duration.toFixed(2)}ms`);
  }
  
  return duration;
}

function perfReport() {
  console.group('📊 Performance Report');
  Object.entries(perfMonitor.measures).forEach(([name, duration]) => {
    const status = duration < PERF_OK_MS ? '✅' : duration < PERF_SLOW_MS ? '⚠️' : '❌';
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
    { id: 'weather',    name: 'Meteorologia',              desc: 'IPMA · previsão 5 dias e avisos',             visible: true, icon: '🌡️' },
    { id: 'hol',        name: 'Feriados & dias úteis',     desc: 'Feriados PT, pontes e dias úteis · date.nager.at', visible: true, icon: '🗓️' },
    { id: 'fuel',       name: 'Combustíveis',              desc: 'Preços gasolina/gasóleo · API Aberta PT',     visible: true, icon: '⛽' },
    { id: 'cabaz',      name: 'Cabaz Alimentar',           desc: '63 produtos essenciais · DECO PROteste',      visible: true, icon: '🛒' },
    { id: 'oil',        name: 'Petróleo',                  desc: 'Brent & WTI · TradingView live',              visible: true, icon: '🛢️' },
    { id: 'gas-eu',     name: 'Gás Natural EU',            desc: 'TTF (Yahoo Finance) · hubs europeus de referência',          visible: true, icon: '🔥' },
    { id: 'gas-pt',     name: 'Gás Natural PT',            desc: 'MIBGAS estimado · tarifas ERSE 2026-2027',             visible: true, icon: '🇵🇹' },
    { id: 'elec',       name: 'Eletricidade',              desc: 'Preço OMIE · mix energético · tarifas',      visible: true, icon: '⚡' },
    { id: 'airquality', name: 'Qualidade do Ar',           desc: 'CAMS/Copernicus · 5 poluentes + UV',          visible: true, icon: '🌬️' },
    { id: 'anpc',       name: 'Proteção Civil',            desc: 'Ocorrências ANEPC e risco de incêndio · API Aberta', visible: true, icon: '🚒' },
    { id: 'dams',       name: 'Barragens',                 desc: 'Armazenamento bacias · SNIRH/APA',           visible: true, icon: '💧' },
    { id: 'euribor',    name: 'Euribor',                   desc: 'BCE · médias mensais · spread bancário PT',        visible: true, icon: '📐' },
    { id: 'imob',       name: 'Imobiliário',               desc: 'Habitação Portugal · INE',                   visible: true, icon: '🏠' },
    { id: 'fng',        name: 'Fear & Greed',              desc: 'Sentimento cripto · Alternative.me',          visible: true, icon: '😰' },
    { id: 'rec',        name: 'Recessão EUA',              desc: 'US 10Y-2Y Spread · Tesouro dos EUA',          visible: true, icon: '📉' },
    { id: 'agri',       name: 'Preços Agrícolas',          desc: 'Futuros CBOT/ICE · Commodities',             visible: true, icon: '🌾' },
    { id: 'exp',        name: 'Exportações PT',            desc: 'Destinos e produtos · INE/AICEP',            visible: true, icon: '📦' },
    { id: 'div',        name: 'Dívida Pública',            desc: '% PIB · Eurostat 2024',                      visible: true, icon: '🏛️' },
    { id: 'air',        name: 'Tráfego Aéreo',             desc: 'ADS-B (adsb.lol) · Portugal continental',              visible: true, icon: '✈️' },
    { id: 'seis',       name: 'Sismos',                    desc: 'IPMA (alt. USGS) · continente, Madeira e Açores',           visible: true, icon: '🌍' },
    { id: 'ormuz',      name: 'Estreito de Ormuz',          desc: 'Simulação ilustrativa do tráfego marítimo',      visible: true, icon: '🚢' },
    { id: 'smn',        name: 'Salário & Custo Vida',      desc: 'SMN, cabaz e poder de compra · PT',          visible: true, icon: '💼' },
    { id: 'transp',     name: 'Transportes PT',            desc: 'Tarifas de referência · horários CP',       visible: true, icon: '🚆' },
    { id: 'finance',    name: 'Gráfico de Mercados',       desc: 'TradingView · gráfico avançado',     visible: true, icon: '📈' },
    { id: 'psi20',      name: 'Bolsa de Lisboa',           desc: 'PSI 20 e constituintes · Yahoo Finance',       visible: true, icon: '💹' },
    { id: 'heatmap',    name: 'Mapa de Calor',             desc: 'S&P 500, cripto e ETFs · TradingView',        visible: true, icon: '🟩' },
    { id: 'fx',         name: 'Câmbio EUR',                desc: 'BCE (Frankfurter) · taxas de referência diárias',              visible: true, icon: '💱' },
    { id: 'crypto',     name: 'Criptomoedas',              desc: 'BTC, ETH e Top Altcoins · CoinGecko',        visible: true, icon: '₿' },
    { id: 'inf',        name: 'Inflação PT/EU',            desc: 'IHPC · INE e Eurostat',            visible: true, icon: '📊' },
    { id: 'mstats',     name: 'Indicadores Mercado',       desc: 'VIX, ouro, prata, S&P 500, petróleo e gás',           visible: true, icon: '🔭' },
    { id: 'cal',        name: 'Calendário Económico',      desc: 'Próximos eventos Fed/BCE/INE',               visible: true, icon: '📅' },
    { id: 'conflicts',  name: 'Conflitos Globais',         desc: 'Mapa de tensão e guerras ativas',         visible: true, icon: '🗺️' },
    { id: 'geo',        name: 'Análise Geopolítica',       desc: 'Satélite e análise estratégica',          visible: true, icon: '🛰️' },
    { id: 'co2',        name: 'Emissões CO₂',              desc: 'Mix energético PT · DGEG/REN 2024',          visible: true, icon: '🌱' },
    { id: 'press',      name: 'Liberdade Imprensa',        desc: 'RSF 2026 · EIU 2024 histórico',              visible: true, icon: '🗽' },
    { id: 'news-pt',    name: 'Notícias Portugal',         desc: 'Google News RSS · PT · tempo real',          visible: true, icon: '📰' },
    { id: 'news-world', name: 'Notícias Mundo',            desc: 'Google News RSS · Mundo · tempo real',       visible: true, icon: '🌐' }
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
  DEFAULT_CONFIG.cards.forEach((defaultCard, defaultIndex) => {
    if (!userCardIds.has(defaultCard.id)) {
      console.log(`🆕 Sincronização: Adicionando novo card "${defaultCard.id}"`);
      // Fica logo a seguir ao card que o precede no DEFAULT_CONFIG (ex.: Feriados depois de Meteorologia)
      const prevId = DEFAULT_CONFIG.cards[defaultIndex - 1]?.id;
      const prevPos = prevId ? updatedCards.findIndex(c => c.id === prevId) : -1;
      if (prevPos >= 0) updatedCards.splice(prevPos + 1, 0, { ...defaultCard });
      else updatedCards.push({ ...defaultCard });
      userCardIds.add(defaultCard.id);
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

/* exported openSettings -- chamado pelo botão ⚙️ em index.html */
function openSettings() {
  lastFocusSettings = document.activeElement;
  const overlay = document.getElementById('settingsOverlay');
  
  if (!overlay) {
    console.error('Overlay não encontrado!');
    return;
  }
  
  overlay.inert = false;
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
  settingsSnapshot = snapshotEditableConfig();
  disarmResetButton();
  const msg = document.getElementById('settingsMsg');
  if (msg) msg.textContent = '';
  
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
  overlay.inert = true;
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

  // Fechar sem guardar descarta cards, localização e tickers alterados
  restoreSettingsSnapshot();
  settingsSnapshot = null;
  disarmResetButton();

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
  updateSettingsDirtyUI();
}

function setComfortMotion(motion) {
  currentConfig.comfort = { ...DEFAULT_CONFIG.comfort, ...(currentConfig.comfort || {}), motion };
  comfortPreviewDirty = true;
  applyComfortSettings(currentConfig.comfort);
  updateSettingsDirtyUI();
}

// ──────────────────────────────────────────────────────────────
// CARDS TOGGLE & DRAG/DROP
// ──────────────────────────────────────────────────────────────

/** Secções do painel pela ordem em que aparecem na página (títulos iguais aos de index.html). */
const SETTINGS_SECTIONS = [
  { id: 'portugal', label: 'Portugal · dia a dia' },
  { id: 'economia', label: 'Economia' },
  { id: 'mercados', label: 'Mercados' },
  { id: 'mundo',    label: 'Mundo' }
];

function cardSectionOf(id) {
  return CARD_SECTIONS[id] || DEFAULT_CARD_SECTION;
}

function escSettingsHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

/** Índices (em currentConfig.cards) dos cards de uma secção, pela ordem guardada. */
function sectionCardIndices(sectionId) {
  const out = [];
  currentConfig.cards.forEach((card, i) => {
    if (cardSectionOf(card.id) === sectionId) out.push(i);
  });
  return out;
}

function renderCardToggles() {
  const container = document.getElementById('cardToggles');
  if (!container) return;

  container.innerHTML = '';
  const q = normalizeStr(cardSearchQuery || '').trim();
  const cards = currentConfig.cards;
  let matches = 0;

  SETTINGS_SECTIONS.forEach(section => {
    const indices = sectionCardIndices(section.id);
    if (!indices.length) return;
    const shown = q
      ? indices.filter(i => {
          const card = cards[i];
          return normalizeStr(`${card.icon || ''} ${card.name || ''} ${card.desc || ''} ${card.id || ''}`).includes(q);
        })
      : indices;
    if (!shown.length) return;
    matches += shown.length;

    const visibleCount = indices.filter(i => cards[i].visible).length;
    const group = document.createElement('section');
    group.className = 'card-toggle-group';
    group.dataset.section = section.id;
    group.innerHTML = `
      <div class="card-toggle-group-head">
        <h3 class="card-toggle-group-title">${escSettingsHtml(section.label)}</h3>
        <span class="card-toggle-group-count">${window.nfr(visibleCount)} de ${window.nfr(indices.length)} visíveis</span>
        <div class="card-toggle-group-actions">
          <button type="button" class="card-group-btn" data-show="1" ${visibleCount === indices.length ? 'disabled' : ''}>Mostrar todos</button>
          <button type="button" class="card-group-btn" data-show="0" ${visibleCount === 0 ? 'disabled' : ''}>Ocultar todos</button>
        </div>
      </div>
      <div class="card-toggle-list"></div>
    `;
    group.querySelectorAll('.card-group-btn').forEach(btn => {
      btn.addEventListener('click', () => setSectionVisibility(section.id, btn.dataset.show === '1'));
    });
    const list = group.querySelector('.card-toggle-list');

    shown.forEach(index => {
      const card = cards[index];
      const pos = indices.indexOf(index);
      const name = escSettingsHtml(card.name);
      const div = document.createElement('div');
      div.className = `card-toggle-item ${q ? 'no-drag' : ''} ${card.visible ? '' : 'is-off'}`;
      div.draggable = !q;
      div.dataset.index = index;
      div.dataset.section = section.id;
      div.dataset.cardId = card.id;
      div.innerHTML = `
        <div class="drag-handle" aria-hidden="true">⋮⋮</div>
        <div class="card-toggle-info">
          <div class="card-toggle-name">${escSettingsHtml(card.icon)} ${name}</div>
          <div class="card-toggle-desc">${escSettingsHtml(card.desc)}</div>
        </div>
        <div class="card-order-controls">
          <button type="button" class="card-order-btn" data-dir="-1" ${pos === 0 ? 'disabled' : ''}
                  onclick="moveCard(${index}, -1)" title="Mover para cima" aria-label="Mover ${name} para cima">↑</button>
          <button type="button" class="card-order-btn" data-dir="1" ${pos === indices.length - 1 ? 'disabled' : ''}
                  onclick="moveCard(${index}, 1)" title="Mover para baixo" aria-label="Mover ${name} para baixo">↓</button>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" data-index="${index}" ${card.visible ? 'checked' : ''}
                 aria-label="Mostrar ${name}" onchange="toggleCardVisibility(${index})">
          <span class="toggle-slider"></span>
        </label>
      `;

      if (!q) {
        div.addEventListener('dragstart', handleDragStart);
        div.addEventListener('dragend', handleDragEnd);
        div.addEventListener('dragenter', handleDragEnter);
        div.addEventListener('dragleave', handleDragLeave);
        div.addEventListener('dragover', handleDragOver);
        div.addEventListener('drop', handleDrop);
      }
      list.appendChild(div);
    });

    container.appendChild(group);
  });

  updateCardSearchUI(q ? { matches, total: cards.length } : null);
  updateSettingsDirtyUI();
}

function focusCardControl(cardId, selector) {
  const item = document.querySelector(`#cardToggles .card-toggle-item[data-card-id="${window.CSS.escape(cardId)}"]`);
  const el = item?.querySelector(selector);
  if (el && !el.disabled) el.focus();
  else item?.querySelector('input[type="checkbox"]')?.focus();
}

function sameSettingsSection(a, b) {
  return Boolean(a && b && a.dataset.section === b.dataset.section);
}

function handleDragStart(e) {
  draggedElement = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.cardId || '');
}

function handleDragEnd(_e) {
  this.classList.remove('dragging');
  document.querySelectorAll('.card-toggle-item').forEach(item => {
    item.classList.remove('drag-over');
  });
  draggedElement = null;
}

function handleDragEnter(_e) {
  if (this !== draggedElement && sameSettingsSection(this, draggedElement)) {
    this.classList.add('drag-over');
  }
}

function handleDragLeave(_e) {
  this.classList.remove('drag-over');
}

function handleDragOver(e) {
  // Só aceitar largar dentro da mesma secção: noutra a ordem não teria efeito no painel
  if (!sameSettingsSection(this, draggedElement)) return true;
  if (e.preventDefault) e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDrop(e) {
  if (e.stopPropagation) e.stopPropagation();

  if (draggedElement && draggedElement !== this && sameSettingsSection(this, draggedElement)) {
    const fromIndex = Number.parseInt(draggedElement.dataset.index, 10);
    let toIndex = Number.parseInt(this.dataset.index, 10);
    if (!Number.isFinite(fromIndex) || !Number.isFinite(toIndex)) return false;

    const item = currentConfig.cards.splice(fromIndex, 1)[0];
    if (fromIndex < toIndex) toIndex -= 1;
    currentConfig.cards.splice(toIndex, 0, item);
    renderCardToggles();
  }

  return false;
}

function toggleCardVisibility(index) {
  const card = currentConfig.cards[index];
  if (!card) return;
  card.visible = !card.visible;
  renderCardToggles();
  focusCardControl(card.id, 'input[type="checkbox"]');
}

function setSectionVisibility(sectionId, visible) {
  currentConfig.cards.forEach(card => {
    if (cardSectionOf(card.id) === sectionId) card.visible = Boolean(visible);
  });
  renderCardToggles();
}

/** Move um card para antes/depois do card vizinho da mesma secção. */
function moveCard(fromIndex, direction) {
  const cards = currentConfig.cards;
  const card = cards[fromIndex];
  if (!card) return;
  const section = cardSectionOf(card.id);
  let toIndex = fromIndex + direction;
  while (toIndex >= 0 && toIndex < cards.length && cardSectionOf(cards[toIndex].id) !== section) {
    toIndex += direction;
  }
  if (toIndex < 0 || toIndex >= cards.length) return;
  cards.splice(fromIndex, 1);
  cards.splice(toIndex, 0, card);
  renderCardToggles();
  focusCardControl(card.id, `.card-order-btn[data-dir="${direction}"]`);
}

// ──────────────────────────────────────────────────────────────
// SETTINGS: ALTERAÇÕES POR GUARDAR E MENSAGENS
// ──────────────────────────────────────────────────────────────

let settingsSnapshot = null;
let settingsMsgTimer = null;
let resetArmTimer = null;

function snapshotEditableConfig() {
  return JSON.parse(JSON.stringify({
    cards: currentConfig.cards,
    location: currentConfig.location,
    tickers: currentConfig.tickers
  }));
}

function isSettingsDirty() {
  if (comfortPreviewDirty && comfortSnapshot
      && JSON.stringify(normalizeComfortConfig(currentConfig.comfort)) !== JSON.stringify(comfortSnapshot)) {
    return true;
  }
  if (!settingsSnapshot) return false;
  const now = { cards: currentConfig.cards, location: currentConfig.location, tickers: currentConfig.tickers };
  return JSON.stringify(now) !== JSON.stringify(settingsSnapshot);
}

function updateSettingsDirtyUI() {
  const el = document.getElementById('settingsDirty');
  if (el) el.hidden = !isSettingsDirty();
}

function restoreSettingsSnapshot() {
  if (!settingsSnapshot) return;
  const snap = JSON.parse(JSON.stringify(settingsSnapshot));
  currentConfig.cards = snap.cards;
  currentConfig.location = snap.location;
  currentConfig.tickers = snap.tickers;
}

function showSettingsMessage(text, kind = 'info') {
  const el = document.getElementById('settingsMsg');
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind;
  clearTimeout(settingsMsgTimer);
  settingsMsgTimer = setTimeout(() => { el.textContent = ''; }, 5000);
}

function disarmResetButton() {
  clearTimeout(resetArmTimer);
  resetArmTimer = null;
  const btn = document.querySelector('.settings-btn-reset');
  if (btn) {
    btn.classList.remove('armed');
    btn.textContent = 'Restaurar Padrão';
  }
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
      <div class="location-region">${window.nfr(loc.region)}</div>
    `;
    container.appendChild(div);
  });
  updateSettingsDirtyUI();
}

/* ── Cidade no cabeçalho: muda e guarda já (meteorologia, feriados municipais, qualidade do ar) ── */
function syncHeaderCity() {
  const sel = document.getElementById('hdrCity');
  if (!sel) return;
  if (!sel.options.length) {
    sel.innerHTML = LOCATIONS.map(loc => `<option value="${loc.id}">${loc.name}</option>`).join('');
    sel.addEventListener('change', () => setHeaderLocation(sel.value));
  }
  sel.value = currentConfig?.location || DEFAULT_CONFIG.location;
}

/** Guarda só a cidade (não grava outras alterações por guardar no painel de personalização). */
function setHeaderLocation(locationId) {
  if (!LOCATIONS.some(loc => loc.id === locationId)) return false;
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem('dashboardConfig') || 'null'); } catch {}
  const prev = { location: currentConfig?.location };
  const next = { ...(stored && typeof stored === 'object' ? stored : currentConfig), location: locationId };
  try { localStorage.setItem('dashboardConfig', JSON.stringify(next)); } catch {}
  currentConfig.location = locationId;
  applyConfigSideEffects(prev, { ...prev, location: locationId });
  // Painel de personalização aberto: a cidade nova não conta como alteração por guardar.
  if (settingsSnapshot !== null) { try { settingsSnapshot = snapshotEditableConfig(); } catch {} }
  return true;
}
window.setHeaderLocation = setHeaderLocation;

/** Cidade da lista mais próxima de (lat, lon), por distância em círculo máximo. */
function nearestLocation(lat, lon) {
  const rad = d => d * Math.PI / 180;
  const dist = loc => {
    const dLat = rad(loc.lat - lat), dLon = rad(loc.lon - lon);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(loc.lat)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(a));
  };
  return LOCATIONS.map(loc => ({ loc, km: dist(loc) })).sort((a, b) => a.km - b.km)[0];
}
window.nearestLocation = nearestLocation;

/** Botão de localização: a posição só serve para escolher a cidade; não é guardada nem enviada. */
function locateHeaderCity(btn) {
  if (!navigator.geolocation) {
    window.showNotice?.('Localização', 'Este browser não permite obter a localização.', 'warn');
    return;
  }
  btn?.setAttribute('aria-busy', 'true');
  navigator.geolocation.getCurrentPosition(pos => {
    btn?.removeAttribute('aria-busy');
    const near = nearestLocation(pos.coords.latitude, pos.coords.longitude);
    if (!near) return;
    setHeaderLocation(near.loc.id);
    window.showNotice?.('Cidade escolhida', `${near.loc.name} (a cerca de ${Math.round(near.km)} km). A posição não foi guardada.`, 'ok');
  }, err => {
    btn?.removeAttribute('aria-busy');
    const msg = err?.code === 1 ? 'A localização não foi autorizada. Pode escolher a cidade na lista.' : 'Não foi possível obter a localização. Pode escolher a cidade na lista.';
    window.showNotice?.('Localização', msg, 'warn');
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
}
/** Usado pelo seletor do card de meteorologia: se a cidade existir na lista do cabeçalho, passa a ser a escolhida. */
window.setDashboardCityByName = name => {
  const loc = LOCATIONS.find(l => normalizeStr(l.name) === normalizeStr(name));
  return loc ? setHeaderLocation(loc.id) : false;
};

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
    container.innerHTML = '<p style="font-size:.74rem;color:var(--t3);text-align:center;padding:20px">Nenhum ticker adicionado. Use as sugestões acima.</p>';
    updateSettingsDirtyUI();
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
      <div class="ticker-symbol">${escSettingsHtml(ticker)}</div>
      <div class="ticker-name">${tickerNames[ticker] || 'Empresa'}</div>
      <button type="button" class="ticker-remove" onclick="removeTicker(${index})" aria-label="Remover ${escSettingsHtml(ticker)}">✕</button>
    `;
    container.appendChild(div);
  });
  updateSettingsDirtyUI();
}

const TICKER_MAX = 10;
const TICKER_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,9}$/;

/** Valida e adiciona um ticker; devolve true se foi adicionado (avisos aparecem no painel). */
function tryAddTicker(raw) {
  const ticker = String(raw || '').trim().toUpperCase();
  if (!ticker) return false;
  if (!TICKER_PATTERN.test(ticker)) {
    showSettingsMessage('Ticker inválido: use só letras, números, ponto ou hífen (até 10).', 'warn');
    return false;
  }
  if (currentConfig.tickers.includes(ticker)) {
    showSettingsMessage(`${ticker} já está na lista.`, 'warn');
    return false;
  }
  if (currentConfig.tickers.length >= TICKER_MAX) {
    showSettingsMessage(`Máximo de ${TICKER_MAX} tickers.`, 'warn');
    return false;
  }
  currentConfig.tickers.push(ticker);
  renderTickerList();
  return true;
}

function addTicker() {
  const input = document.getElementById('tickerInput');
  if (input && tryAddTicker(input.value)) input.value = '';
}

function quickAddTicker(ticker) {
  tryAddTicker(ticker);
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
    { text: 'Feriados',               id: 'hol' },
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
  initStaticTradingViewWidgets();
  
  // Auto-identificar cards
  perfMark('auto-identify-start');
  autoIdentifyCards();
  syncConfigWithDOMCards();
  perfMeasure('Auto-identificação de cards', 'auto-identify-start');
  
  // Aplicar configurações salvas
  perfMark('apply-settings-start');
  applySettings();
  window.initDashboardProfiles?.();
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
  syncHeaderCity();
  bindHeaderExtras();
  renderTvTickerTape(currentConfig.tickers);
  renderTvAdvancedChart(currentConfig.tickers);
  refreshAllCardStatuses();
  applyStickyScrollCards();
  setInterval(refreshAllCardStatuses, 30 * 1000);
  if (isCardVisible('weather')) loadWeather(true);
  if (isCardVisible('hol')) loadHolidays();
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

  mountLazyTradingView(wrap, 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js', cfg, 58);
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

  mountLazyTradingView(inner, 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js', cfg, 520);
}

function applyConfigSideEffects(prevConfig, nextConfig) {
  try {
    const prevLoc = prevConfig?.location;
    const nextLoc = nextConfig?.location;
    if (prevLoc !== nextLoc) {
      applyLocationToCfg(nextLoc);
      syncHeaderCity();
      window.loadCivilProtection?.();
      if (isCardVisible('weather')) loadWeather(true);
      if (isCardVisible('hol')) loadHolidays();
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

  comfortSnapshot = normalizeComfortConfig(currentConfig.comfort);
  comfortPreviewDirty = false;
  settingsSnapshot = snapshotEditableConfig();
  updateSettingsDirtyUI();
  
  // Feedback visual
  const saveBtn = document.querySelector('.settings-btn-save');
  if (saveBtn && !saveBtn.dataset.saving) {
    // Um segundo clique durante o feedback não volta a ler o texto "✓ Guardado!" como original.
    saveBtn.dataset.saving = '1';
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '✓ Guardado!';
    saveBtn.style.background = 'var(--green)';
    
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.background = '';
      delete saveBtn.dataset.saving;
      closeSettings();
    }, 1000);
  }
}

function resetSettings() {
  // Confirmação em dois cliques, dentro do painel (sem janelas do browser)
  const btn = document.querySelector('.settings-btn-reset');
  if (btn && !btn.classList.contains('armed')) {
    btn.classList.add('armed');
    btn.textContent = 'Confirmar restauro';
    showSettingsMessage('Clique de novo para repor cards, localização, tickers e conforto padrão.', 'warn');
    clearTimeout(resetArmTimer);
    resetArmTimer = setTimeout(disarmResetButton, 5000);
    return;
  }
  disarmResetButton();

  let prevConfig = null;
  try {
    const raw = localStorage.getItem('dashboardConfig');
    prevConfig = raw ? JSON.parse(raw) : null;
  } catch {}

  currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  syncConfigWithDOMCards(); // repõe também cards que só existem na página, e grava

  applySettings();
  applyConfigSideEffects(prevConfig, currentConfig);

  comfortSnapshot = normalizeComfortConfig(currentConfig.comfort);
  comfortPreviewDirty = false;
  settingsSnapshot = snapshotEditableConfig();
  cardSearchQuery = '';
  syncCardSearchInput();
  renderCardToggles();
  renderLocationGrid();
  renderTickerList();
  renderComfortControls();
  showSettingsMessage('Configurações padrão repostas e aplicadas.', 'ok');
}

/** Secção do painel onde cada card aparece; a ordem dentro da secção segue a configuração do utilizador. */
const CARD_SECTIONS = {
  weather: 'portugal', hol: 'portugal', airquality: 'portugal', fuel: 'portugal', elec: 'portugal', 'gas-pt': 'portugal',
  cabaz: 'portugal', transp: 'portugal', dams: 'portugal', anpc: 'portugal', seis: 'portugal', air: 'portugal', 'news-pt': 'portugal',
  euribor: 'economia', inf: 'economia', imob: 'economia', smn: 'economia', exp: 'economia', div: 'economia',
  co2: 'economia', cal: 'economia',
  psi20: 'mercados', fx: 'mercados', crypto: 'mercados', oil: 'mercados', 'gas-eu': 'mercados', agri: 'mercados',
  mstats: 'mercados', fng: 'mercados', rec: 'mercados', finance: 'mercados', heatmap: 'mercados',
  'news-world': 'mundo', conflicts: 'mundo', geo: 'mundo', press: 'mundo', ormuz: 'mundo',
};
const DEFAULT_CARD_SECTION = 'mundo';

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

  // Reordenar e aplicar visibilidade pela ordem guardada, dentro da secção de cada card
  const sectionGrids = new Map(Array.from(mainGrid.querySelectorAll('[data-section-grid]')).map(g => [g.dataset.sectionGrid, g]));
  const fallbackGrid = sectionGrids.get(DEFAULT_CARD_SECTION) || mainGrid;
  currentConfig.cards.forEach(cardCfg => {
    const cardEl = cardById.get(cardCfg.id);
    if (!cardEl) return;

    (sectionGrids.get(CARD_SECTIONS[cardCfg.id]) || fallbackGrid).appendChild(cardEl);

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
            <div class="notif-item-desc">${window.nfr(n.description)}</div>
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
  panel.inert = !open;
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
  const notif = notifications.find(n => String(n.id) === String(id));
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
  notifications = notifications.filter(n => String(n.id) !== String(id));
  saveNotifications();
  updateNotificationUI();
}

// Limpar todas
/* Confirmação em dois cliques no próprio botão (sem janela do browser). */
function clearAllNotifications(btn) {
  if (btn && btn.dataset.armed !== '1') {
    btn.dataset.armed = '1';
    btn.dataset.label = btn.textContent;
    btn.textContent = 'Confirmar?';
    setTimeout(() => {
      if (btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.textContent = btn.dataset.label || 'Limpar'; }
    }, 4000);
    return;
  }
  if (btn) { btn.dataset.armed = ''; btn.textContent = btn.dataset.label || 'Limpar'; }
  notifications = [];
  saveNotifications();
  updateNotificationUI();
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
      <div class="toast-message">${window.nfr(notif.description)}</div>
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
  } catch {
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
  // Ainda não há opções: explicar as regras em vigor sem abrir o painel de configurações.
  window.showNotice('Notificações',
    'Todas as notificações estão ativas: sismos acima de 3,0, notícias importantes e picos de energia acima de 20%. Ainda não há opções para as escolher.',
    'info');
}

// ══════════════════════════════════════════════════════════════
// MONITORIZAÇÃO AUTOMÁTICA
// ══════════════════════════════════════════════════════════════






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
  modal.inert = false;
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
    modal.inert = true;
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
        <span style="font-family:var(--mono);font-size:.74rem;color:var(--t3);letter-spacing:.6px;text-transform:uppercase">Δ</span>
        ${btn(prefs.deltaMode==="abs","Δ€","setFuelPrefs({deltaMode:'abs'})")}
        ${btn(prefs.deltaMode==="pct","Δ%","setFuelPrefs({deltaMode:'pct'})","Percentagem vs PT")}
      </div>
      <div style="display:flex;gap:4px;align-items:center">
        <span style="font-family:var(--mono);font-size:.74rem;color:var(--t3);letter-spacing:.6px;text-transform:uppercase">ES G95</span>
        ${btn(prefs.esGas95==="auto","Auto","setFuelPrefs({esGas95:'auto'})","Usa E5/E10 conforme disponível")}
        ${btn(prefs.esGas95==="e5","E5","setFuelPrefs({esGas95:'e5'})")}
        ${btn(prefs.esGas95==="e10","E10","setFuelPrefs({esGas95:'e10'})")}
      </div>
      <div style="display:flex;gap:4px;align-items:center">
        <span style="font-family:var(--mono);font-size:.74rem;color:var(--t3);letter-spacing:.6px;text-transform:uppercase">ES G98</span>
        ${btn(prefs.esGas98==="auto","Auto","setFuelPrefs({esGas98:'auto'})","Usa E5/E10 conforme disponível")}
        ${btn(prefs.esGas98==="e5","E5","setFuelPrefs({esGas98:'e5'})")}
        ${btn(prefs.esGas98==="e10","E10","setFuelPrefs({esGas98:'e10'})")}
      </div>
      <div style="display:flex;gap:4px;align-items:center">
        <span style="font-family:var(--mono);font-size:.74rem;color:var(--t3);letter-spacing:.6px;text-transform:uppercase">PT</span>
        ${btn(prefs.showColored,"Colorido: ON",`setFuelPrefs({showColored:true})`,"Mostra Gasóleo Colorido (PT)")}
        ${btn(!prefs.showColored,"Colorido: OFF",`setFuelPrefs({showColored:false})`,"Esconde Gasóleo Colorido (PT)")}
      </div>
    </div>
    <div style="font-family:var(--mono);font-size:.74rem;color:var(--t2);line-height:1.7;margin-bottom:10px">
      <div><span style="color:var(--t3)">PT</span> · API Aberta · data ${ptDate} · atualizado ${window.nfr(ptUpd)} · cache ${window.nfr(ptAge)}</div>
      <div><span style="color:var(--t3)">ES</span> · MITECO/MINETUR · ${window.nfr(esWhen)} · cache ${window.nfr(esAge)}</div>
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
  modal.inert = false;
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
    modal.inert = true;
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
  document.querySelectorAll('.export-option-item[data-format]').forEach(item => {
    const on = item === element;
    item.classList.toggle('selected', on);
    item.setAttribute('aria-checked', String(on));
  });
  exportState.format = format;
  updateExportButton();
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const EXPORT_SECTION_LABELS = { portugal: 'Portugal', economia: 'Economia', mercados: 'Mercados', mundo: 'Mundo' };

function exportCardIsVisible(card) {
  return !card.classList.contains('hidden') && !card.classList.contains('profile-hidden') && card.offsetParent !== null;
}

/** Título do card sem botões de ajuda ("?") nem outros controlos. */
function exportCardName(card, id) {
  const label = card.querySelector('.ch-lbl');
  if (!label) return id;
  const copy = label.cloneNode(true);
  copy.querySelectorAll('button, [role="button"], .help-tip, [aria-hidden="true"]').forEach(el => el.remove());
  return (copy.textContent || id).replace(/\s+/g, ' ').trim().replace(/\s*\?$/, '') || id;
}

function renderExportCardsList() {
  const list = document.getElementById('exportCardsList');
  if (!list) return;

  exportState.allCards = Array.from(document.querySelectorAll('[data-section-grid] > .card[data-card-id]')).map(card => {
    const id = card.dataset.cardId;
    const grid = card.closest('[data-section-grid]');
    return {
      id,
      name: exportCardName(card, id),
      section: EXPORT_SECTION_LABELS[grid?.dataset.sectionGrid] || 'Outros',
      sectionKey: grid?.dataset.sectionGrid || 'outros',
      visible: exportCardIsVisible(card),
      element: card,
    };
  });

  const groups = [];
  exportState.allCards.forEach(card => {
    let group = groups.find(g => g.key === card.sectionKey);
    if (!group) groups.push(group = { key: card.sectionKey, label: card.section, cards: [] });
    group.cards.push(card);
  });

  list.innerHTML = groups.map(group => `
    <div class="export-group" data-export-group="${escapeHtml(group.key)}">
      <label class="export-group-head">
        <input type="checkbox" class="export-group-check" data-group="${escapeHtml(group.key)}">
        <span>${escapeHtml(group.label)}</span>
        <span class="export-group-count" data-group-count="${escapeHtml(group.key)}"></span>
      </label>
      <div class="export-group-cards">
        ${group.cards.map(card => `
          <label class="export-card-item${card.visible ? '' : ' is-hidden-card'}">
            <input type="checkbox" class="export-card-check" value="${escapeHtml(card.id)}">
            <span class="export-card-name">${escapeHtml(card.name)}</span>
            ${card.visible ? '' : '<span class="export-card-desc">oculto</span>'}
          </label>`).join('')}
      </div>
    </div>`).join('');

  list.querySelectorAll('.export-card-check').forEach(input => {
    input.addEventListener('change', () => setExportSelection(input.value, input.checked));
  });
  list.querySelectorAll('.export-group-check').forEach(input => {
    input.addEventListener('change', () => {
      exportState.allCards.filter(c => c.sectionKey === input.dataset.group).forEach(c => setExportSelection(c.id, input.checked, false));
      syncExportChecks();
    });
  });
  syncExportChecks();
}

function setExportSelection(cardId, on, sync = true) {
  const has = exportState.selectedCards.includes(cardId);
  if (on && !has) exportState.selectedCards.push(cardId);
  if (!on && has) exportState.selectedCards = exportState.selectedCards.filter(id => id !== cardId);
  if (sync) syncExportChecks();
}

/** Mantém caixas, contagens por secção e botão coerentes com exportState.selectedCards. */
function syncExportChecks() {
  const selected = new Set(exportState.selectedCards);
  document.querySelectorAll('#exportCardsList .export-card-check').forEach(input => {
    input.checked = selected.has(input.value);
    input.closest('.export-card-item')?.classList.toggle('selected', input.checked);
  });
  document.querySelectorAll('#exportCardsList .export-group-check').forEach(input => {
    const cards = exportState.allCards.filter(c => c.sectionKey === input.dataset.group);
    const n = cards.filter(c => selected.has(c.id)).length;
    input.checked = n > 0 && n === cards.length;
    input.indeterminate = n > 0 && n < cards.length;
    const count = document.querySelector(`[data-group-count="${input.dataset.group}"]`);
    if (count) count.textContent = n ? `${n}/${cards.length}` : `${cards.length}`;
  });
  updateExportButton();
}

function exportSelectPreset(preset) {
  // Ordem da página, para o PNG/PDF/CSV seguirem a ordem dos cards.
  if (preset === 'all') exportState.selectedCards = exportState.allCards.map(c => c.id);
  else if (preset === 'visible') exportState.selectedCards = exportState.allCards.filter(c => c.visible).map(c => c.id);
  else exportState.selectedCards = [];
  syncExportChecks();
}

/* Compatibilidade com chamadas antigas (onclick). */
function toggleCardSelection(cardId) { setExportSelection(cardId, !exportState.selectedCards.includes(cardId)); }
function toggleAllCards() { exportSelectPreset(exportState.selectedCards.length === exportState.allCards.length ? 'none' : 'all'); }

function updateExportButton() {
  const btn = document.getElementById('exportBtn');
  if (!btn) return;
  const count = exportState.selectedCards.length;
  btn.disabled = count === 0;
  btn.textContent = count === 0 ? 'Escolha os cards' : `Exportar ${count} ${count === 1 ? 'card' : 'cards'}`;
}

// ──────────────────────────────────────────────────────────────
// EXPORTAÇÃO - Diferentes formatos
// ──────────────────────────────────────────────────────────────

/** Cards escolhidos, pela ordem da página. */
function selectedExportCards() {
  const selected = new Set(exportState.selectedCards);
  return exportState.allCards.filter(c => selected.has(c.id));
}

function exportStamp(now = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 1500);
}

async function executeExport() {
  if (exportState.selectedCards.length === 0) {
    window.showNotice('Exportação', 'Escolha pelo menos um card para exportar.', 'warn');
    return;
  }
  const progress = document.getElementById('exportProgress');
  progress?.classList.add('active');
  const btn = document.getElementById('exportBtn');
  if (btn) btn.disabled = true;
  try {
    const run = { png: exportAsPNG, pdf: exportAsPDF, csv: exportAsCSV, json: exportAsJSON }[exportState.format];
    await run();
    showExportSuccess(`Exportação ${exportState.format.toUpperCase()} concluída.`);
    setTimeout(() => closeExportModal(), 1000);
  } catch (error) {
    console.error('Erro na exportação:', error);
    window.showNotice('Erro ao exportar', error?.message || 'Erro inesperado (detalhes na consola).', 'error');
  } finally {
    progress?.classList.remove('active');
    updateExportButton();
  }
}

/* Captura de cada card (html2canvas), com o fundo do tema. */
async function captureExportCards(cards, scale) {
  if (!window.html2canvas) {
    updateProgress(5, 'A carregar a biblioteca de imagem…');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  }
  const bg = window.getComputedStyle(document.body).backgroundColor || '#0C0E13';
  const shots = [];
  for (let i = 0; i < cards.length; i++) {
    updateProgress(10 + (i / cards.length) * 70, `A capturar ${cards[i].name}…`);
    shots.push({ card: cards[i], canvas: await html2canvas(cards[i].element, { backgroundColor: bg, scale, logging: false }) });
  }
  return { shots, bg };
}

const EXPORT_SITE = 'lcmadeira.github.io/dash';

function exportDateText(now = new Date()) {
  return now.toLocaleString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// PNG: uma só imagem com os cards em coluna, cabeçalho e rodapé.
async function exportAsPNG() {
  const cards = selectedExportCards();
  const scale = cards.length > 8 ? 1 : 1.5;
  const { shots, bg } = await captureExportCards(cards, scale);
  updateProgress(85, 'A montar a imagem…');
  const pad = Math.round(24 * scale);
  const gap = Math.round(16 * scale);
  const head = Math.round(64 * scale);
  const foot = Math.round(40 * scale);
  const width = Math.max(...shots.map(s => s.canvas.width)) + pad * 2;
  const MAX_H = 30000; // limite prático de altura de um canvas no Chrome
  const pages = [];
  let current = [];
  let h = head + foot + pad;
  shots.forEach(s => {
    const add = s.canvas.height + gap;
    if (current.length && h + add > MAX_H) { pages.push(current); current = []; h = head + foot + pad; }
    current.push(s); h += add;
  });
  if (current.length) pages.push(current);

  const textColor = window.getComputedStyle(document.body).color || '#E7EAF0';
  const stamp = exportStamp();
  for (let p = 0; p < pages.length; p++) {
    const group = pages[p];
    const height = head + foot + pad + group.reduce((a, s) => a + s.canvas.height + gap, 0);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = textColor;
    ctx.font = `700 ${Math.round(22 * scale)}px Inter, system-ui, sans-serif`;
    ctx.fillText('Portugal hoje', pad, Math.round(36 * scale));
    ctx.globalAlpha = 0.65;
    ctx.font = `500 ${Math.round(13 * scale)}px Inter, system-ui, sans-serif`;
    ctx.fillText(`${exportDateText()}${pages.length > 1 ? ` · parte ${p + 1} de ${pages.length}` : ''}`, pad, Math.round(56 * scale));
    ctx.globalAlpha = 1;
    let y = head;
    group.forEach(s => { ctx.drawImage(s.canvas, pad, y); y += s.canvas.height + gap; });
    ctx.globalAlpha = 0.6;
    ctx.font = `500 ${Math.round(12 * scale)}px Inter, system-ui, sans-serif`;
    ctx.fillText(`${EXPORT_SITE} · valores indicativos; confirme na fonte de cada card`, pad, height - Math.round(16 * scale));
    ctx.globalAlpha = 1;
    const blob = await new Promise(resolve => { canvas.toBlob(resolve, 'image/png'); });
    if (!blob) throw new Error('Não foi possível gerar a imagem (demasiado grande?). Experimente com menos cards.');
    downloadBlob(blob, `portugal-hoje_${stamp}${pages.length > 1 ? `_${p + 1}` : ''}.png`);
  }
  updateProgress(100, 'Concluído');
}

// PDF: um card por página, redimensionado para caber, com cabeçalho e rodapé.
async function exportAsPDF() {
  const cards = selectedExportCards();
  if (!window.jspdf) {
    updateProgress(3, 'A carregar a biblioteca de PDF…');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  }
  const { shots } = await captureExportCards(cards, 1.5);
  updateProgress(85, 'A montar o PDF…');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageW = 210, pageH = 297, margin = 12, top = 26, bottom = 16;
  const when = exportDateText();
  shots.forEach((s, i) => {
    if (i > 0) pdf.addPage();
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.setTextColor(20);
    pdf.text('Portugal hoje', margin, 14);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(110);
    pdf.text(`${s.card.name} · ${s.card.section} · ${when}`, margin, 20);
    const maxW = pageW - margin * 2;
    const maxH = pageH - top - bottom;
    let w = maxW;
    let h = (s.canvas.height * w) / s.canvas.width;
    if (h > maxH) { h = maxH; w = (s.canvas.width * h) / s.canvas.height; }
    // JPEG: fundo liso, ~10x mais leve do que PNG para capturas de cards.
    pdf.addImage(s.canvas.toDataURL('image/jpeg', 0.88), 'JPEG', margin + (maxW - w) / 2, top, w, h);
    pdf.setFontSize(8); pdf.setTextColor(130);
    pdf.text(`${EXPORT_SITE} · valores indicativos; confirme na fonte indicada no card`, margin, pageH - 8);
    pdf.text(`${i + 1}/${shots.length}`, pageW - margin, pageH - 8, { align: 'right' });
  });
  pdf.save(`portugal-hoje_${exportStamp()}.pdf`);
  updateProgress(100, 'Concluído');
}

/** Leitor de cache para a exportação: devolve também dados expirados, com a data e a fonte. */
function readExportCache(key) {
  try {
    const raw = localStorage.getItem((window.PFX || 'dash_v15_') + key);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || !Object.prototype.hasOwnProperty.call(parsed, 'd')) return null;
    const meta = window.getCacheMeta?.(key);
    return { d: parsed.d, sourceTs: meta?.sourceTs || Number(parsed.ts) || null, source: meta?.dataMeta?.source || '' };
  } catch { return null; }
}

function exportRows() {
  // Texto visível do card sem o cabeçalho (título e botões), para os cards sem extrator.
  const cards = selectedExportCards().map(c => ({ id: c.id, name: c.name, section: c.section,
    text: Array.from(c.element.children).filter(el => !el.classList.contains('ch')).map(el => el.innerText || '').join(' ') }));
  const cityId = Number(CFG?.IPMA_CITY_ID || 1110600);
  return window.buildExportRows(cards, {
    read: readExportCache,
    now: Date.now(),
    cityId,
    cityName: IPMA_CITIES?.[cityId] || '',
    summarizeFuelEvora: window.summarizeFuelEvora,
    cabaz: window.getCabazBriefingData,
    statusOf: id => {
      const title = document.querySelector(`.card-status[data-status-for="${id}"]`)?.title || '';
      return {
        source: /Fonte: (.+?)(?= · Observado:| · Idade baseada| · Fonte:|$)/.exec(title)?.[1] || /^(.+?) · referência de /.exec(title)?.[1] || '',
        observedAt: /Observado: ([^·]+)/.exec(title)?.[1]?.trim() || /referência de ([^·]+)/.exec(title)?.[1]?.trim() || '',
      };
    },
  });
}

async function exportAsCSV() {
  updateProgress(30, 'A recolher os dados…');
  const rows = exportRows();
  updateProgress(80, 'A gerar o CSV…');
  downloadBlob(new Blob([window.exportRowsToCsv(rows)], { type: 'text/csv;charset=utf-8' }), `portugal-hoje_${exportStamp()}.csv`);
  updateProgress(100, 'Concluído');
}

async function exportAsJSON() {
  updateProgress(30, 'A recolher os dados…');
  const rows = exportRows();
  updateProgress(80, 'A gerar o JSON…');
  downloadBlob(new Blob([window.exportRowsToJson(rows)], { type: 'application/json' }), `portugal-hoje_${exportStamp()}.json`);
  updateProgress(100, 'Concluído');
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
window.skeletonGeneric = skeletonGeneric;



/* ══════════════════════════════════════════════════════════════
   MODAL DE TENDÊNCIA/HISTÓRICO
   ══════════════════════════════════════════════════════════════ */

let trendModal = null;

function showTrendModal(title, historyKey, options = {}) {
  const history = getHistory(historyKey, options.days || 30);
  
  if (history.length < 2) {
    window.showNotice('Histórico insuficiente', 'Aguarda alguns dias para ver tendências.', 'info');
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
        <div style="font-size:.74rem;color:var(--t3);text-align:center" id="trend-footer"></div>
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
      <div style="font-size:.74rem;color:var(--t3);margin-bottom:4px">Atual</div>
      <div style="font-size:1.3rem;font-weight:700;color:${options.borderColor || '#E9A520'}">${window.nf(current, dec)}${unit}</div>
    </div>
    <div style="background:var(--b2);border-radius:6px;padding:12px;text-align:center">
      <div style="font-size:.74rem;color:var(--t3);margin-bottom:4px">Variação</div>
      <div style="font-size:1.3rem;font-weight:700;color:${change >= 0 ? '#EF4444' : '#10B981'}">${change >= 0 ? '+' : ''}${window.nf(change, 1)}%</div>
    </div>
    <div style="background:var(--b2);border-radius:6px;padding:12px;text-align:center">
      <div style="font-size:.74rem;color:var(--t3);margin-bottom:4px">Mínimo</div>
      <div style="font-size:1.1rem;font-weight:600;color:var(--green)">${window.nf(min, dec)}${unit}</div>
    </div>
    <div style="background:var(--b2);border-radius:6px;padding:12px;text-align:center">
      <div style="font-size:.74rem;color:var(--t3);margin-bottom:4px">Máximo</div>
      <div style="font-size:1.1rem;font-weight:600;color:var(--red)">${window.nf(max, dec)}${unit}</div>
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
  {y:2025, v:243.50, label:"2025", note:"Subida moderada · 2,3% IPC médio"},
  {y:2026, v:254.18, label:"2026", note:"Média parcial Jan-Set · última série média disponível"},
];

/* Histórico semanal (format: [data_iso, valor_eur, nota_opcional])
   Fonte: DECO PROteste comunicados · Lusa · Renascença · ECO · RTP · Agroportal
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
  ["2025-10-28", 243.68, "Referência homóloga implícita no comunicado DECO/Lusa de 28 Out 2026 (+9.87€)"],
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
  ["2026-09-23", 254.11, "Desce 1.86€ · Jornal Económico, 23 Set 2026"],
  ["2026-09-30", 254.22, "Sobe 0.11€ · Observador/Lusa, 30 Set 2026"],
  ["2026-10-07", 255.56, "Sobe 1.34€ · Lusa, 7 Out 2026"],
  ["2026-10-14", 256.26, "Sobe 0.70€ · RTP/Lusa, 14 Out 2026"],
  ["2026-10-21", 253.99, "Desce 2.27€ · DECO PROteste, 21 Out 2026"],
  ["2026-10-28", 253.55, "Desce 0.44€ · DECO PROteste/Lusa, 28 Out 2026"],
];

const CABAZ_CK = "cabaz_deco_v1";

/* Valores automáticos (data/cabaz.json): lidos das notícias semanais da Lusa sobre o boletim da
   DECO PROteste, por consenso de títulos, por scripts/update-cabaz.mjs (cron no portátil). */
let CABAZ_AUTO=[];

/** Quarta-feira da semana de publicação da DECO (a mais recente ≤ data), para juntar entradas da mesma semana. */
function cabazWeekKey(iso){
  const d=new Date(`${iso}T12:00:00`);
  if(!Number.isFinite(d.getTime())) return iso;
  d.setDate(d.getDate()-((d.getDay()-3+7)%7));
  const pad=n=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

/* Carregar histórico: base do código < entradas manuais (localStorage) < valores automáticos, uma entrada por semana */
function loadCabazHist(){
  let extra=[];
  try{
    const s=localStorage.getItem(CABAZ_CK);
    if(s) extra=JSON.parse(s);
  }catch{}
  const byWeek={};
  const add=(rows,origin)=>rows.forEach(e=>{
    if(!Array.isArray(e)||!/^\d{4}-\d{2}-\d{2}$/.test(e[0])||!Number.isFinite(Number(e[1]))) return;
    const key=cabazWeekKey(e[0]);
    byWeek[key]=[key,Number(e[1]),e[2]||"",e[3]||"",origin];
  });
  add(CABAZ_HIST_BASE,"base");
  add(extra,"manual");
  add(CABAZ_AUTO,"auto");
  return Object.values(byWeek).sort((a,b)=>a[0]>b[0]?1:-1);
}

/** Origem e data da última entrada do cabaz (para o badge do card). */
window.getCabazLatestInfo=()=>{
  const hist=loadCabazHist();
  const last=hist[hist.length-1];
  return last?{date:last[0],origin:last[4],note:last[2]}:null;
};

/** Lê data/cabaz.json do próprio site e volta a desenhar o card. */
async function loadCabazAuto(){
  try{
    const url=new URL("data/cabaz.json",window.location.href).href;
    const r=await fetch(url,{cache:"no-cache"});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const j=await r.json();
    if(Array.isArray(j?.entries)){
      CABAZ_AUTO=j.entries.filter(e=>Array.isArray(e)&&/^\d{4}-\d{2}-\d{2}$/.test(e[0])&&Number(e[1])>100&&Number(e[1])<500);
    }
  }catch(e){
    console.warn("Cabaz automático indisponível:",e?.message||e);
  }
  renderCabaz();
  window.refreshAllCardStatuses?.();
}
window.loadCabazAuto=loadCabazAuto;
window.getCabazBriefingData = () => loadCabazHist()
  .filter(row => Array.isArray(row) && /^\d{4}-\d{2}-\d{2}$/.test(row[0]) && Number.isFinite(Number(row[1])))
  .map(row => [row[0], Number(row[1])]);

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
      text-anchor="middle">${window.nfr(y)}</text>`:""
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
    <div style="font-size:.74rem;color:var(--t3);text-transform:uppercase;
         letter-spacing:.5px;margin-bottom:3px">
      Cabaz 63 produtos · semana de ${fmtDate(cur[0])}
      ${cur[4]==="auto"?"":`<span style="font-size:.74rem;background:var(--od);color:var(--amber);
            border-radius:3px;padding:1px 5px;margin-left:5px">${cur[4]==="manual"?"⚠ valor manual":"⚠ referência"}</span>`}
    </div>
    <div style="display:flex;align-items:flex-end;gap:8px;margin-bottom:6px">
      <div style="font-size:2.6rem;font-weight:900;color:var(--green);line-height:1;letter-spacing:-1px">
        ${window.nf(cur[1], 2)}</div>
      <div style="font-size:.85rem;color:var(--t3);margin-bottom:4px">€</div>
      <div style="flex:1"></div>
      <div style="text-align:right">
        <div style="font-size:.75rem;font-weight:700;color:${wCol}">
          ${window.nfr(wArr)} ${window.nf(Math.abs(weekChg), 2)}€ <span style="font-size:.74rem;font-weight:400">(${window.nf(Math.abs(weekPct), 2)}%)</span>
        </div>
        <div style="font-size:.74rem;color:var(--t3)">vs semana anterior</div>
      </div>
    </div>
    ${cur[2]?`<div style="font-size:.74rem;color:var(--t3);border-top:1px solid var(--b);
       padding-top:5px;margin-top:2px">💬 ${window.nfr(cur[2])}</div>`:""}
  </div>

  <!-- KPIs 4 em grelha -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:10px">
    <div style="background:var(--b2);border-radius:7px;padding:7px 8px;text-align:center">
      <div style="font-size:1rem;font-weight:800;color:${wCol}">${window.nfr(wArr)}${window.nf(Math.abs(weekPct), 1)}%</div>
      <div style="font-size:.74rem;color:var(--t3);margin-top:2px">semana</div>
    </div>
    <div style="background:var(--b2);border-radius:7px;padding:7px 8px;text-align:center">
      <div style="font-size:1rem;font-weight:800;color:${wColYTD}">
        ${ytdChg>=0?"+":""}${window.nf(ytdChg, 2)}€</div>
      <div style="font-size:.74rem;color:var(--t3);margin-top:2px">desde Jan ${curYear}</div>
    </div>
    <div style="background:var(--b2);border-radius:7px;padding:7px 8px;text-align:center">
      <div style="font-size:1rem;font-weight:800;color:${wColYear}">
        ${yearChg>=0?"+":""}${window.nf(Math.abs(yearChg), 2)}€</div>
      <div style="font-size:.74rem;color:var(--t3);margin-top:2px">vs 1 ano atrás</div>
    </div>
    <div style="background:var(--b2);border-radius:7px;padding:7px 8px;text-align:center">
      <div style="font-size:1rem;font-weight:800;color:var(--red)">
        +${window.nf(Math.abs(totalPct), 1)}%</div>
      <div style="font-size:.74rem;color:var(--t3);margin-top:2px">desde Jan 2022</div>
    </div>
  </div>

  <!-- Sparkline histórico completo -->
  <div style="background:var(--b2);border-radius:8px;padding:10px 12px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
      <div style="font-size:.74rem;font-weight:600;color:var(--t2)">Evolução Jan 2022 → Hoje</div>
      <div style="font-size:.74rem;color:var(--t3)">${window.nfr(hist.length)} registos</div>
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
        ${window.nf(start[1], 0)}€
      </text>
      <!-- Área + linha -->
      <polygon points="${fill}" fill="url(#cabaz-grad)"/>
      <polyline points="${pts}" fill="none" stroke="#10B981" stroke-width="2"/>
      <!-- Ponto actual -->
      <circle cx="${spx(vals.length-1)}" cy="${spy(cur[1])}" r="4" fill="#10B981"/>
      <text x="${Math.min(spx(vals.length-1)-2,SW-32)}" y="${spy(cur[1])-6}"
            font-size="7" fill="#10B981" text-anchor="end" font-weight="bold">
        ${window.nf(cur[1], 2)}€
      </text>
      <!-- Ticks de ano -->
      ${window.nfr(yearTicks)}
    </svg>
  </div>

  <!-- Comparação anual em barras -->
  <div style="margin-bottom:10px">
    <div style="font-size:.74rem;font-weight:600;color:var(--t2);margin-bottom:5px">
      Média anual do cabaz
    </div>
    ${(()=>{
      const maxV=Math.max(...CABAZ_ANUAL.map(x=>x.v));
      return CABAZ_ANUAL.map(a=>{
        const bw=(a.v/maxV*100).toFixed(1);
        const col=a.y===CABAZ_ANUAL[CABAZ_ANUAL.length-1].y?"var(--accent)":"var(--data-muted)";
        return `<div style="display:flex;align-items:center;gap:7px;margin-bottom:4px">
          <div style="font-family:var(--mono);font-size:.74rem;color:var(--t2);min-width:32px">${window.nfr(a.y)}</div>
          <div style="flex:1;background:var(--b);border-radius:3px;height:7px">
            <div style="width:${bw}%;height:100%;background:${col};border-radius:3px"></div>
          </div>
          <div style="font-family:var(--mono);font-size:.74rem;font-weight:600;color:var(--text);min-width:52px;text-align:right">
            ${window.nf(a.v, 2)}€</div>
        </div>
        <div style="font-size:.74rem;color:var(--t3);margin:-2px 0 4px 39px">${window.nfr(a.note)}</div>`;
      }).join("");
    })()}
  </div>

  <!-- Origem do último valor -->
  ${cur[4]==="auto"
    ?`<div style="background:var(--surface);border:1px solid var(--b);border-radius:7px;padding:7px 10px;font-size:.74rem;color:var(--t2);line-height:1.5">
        Atualizado automaticamente a partir das notícias semanais (Lusa) sobre o boletim da DECO PROteste, publicado às <b>quartas-feiras</b>.
        ${cur[3]?`<a href="${String(cur[3]).replace(/"/g,"&quot;")}" target="_blank" rel="noopener noreferrer">Ver notícia →</a>`:""}
        <span style="color:var(--t3)">Pode corrigir um valor com ✏️.</span>
      </div>`
    :`<div style="background:var(--od);border:1px solid var(--b);border-radius:7px;padding:7px 10px;font-size:.74rem;color:var(--amber);line-height:1.5">
        ⚠ Sem valor automático para esta semana. A DECO PROteste publica às <b>quartas-feiras</b>;
        o painel atualiza a partir das notícias quando sai a notícia da Lusa. Clique em <b>✏️</b> para introduzir o valor à mão.
      </div>`}`;
}

/* ── Modal de edição ── */
let lastFocusCabaz = null;

function openCabazEditor(){
  lastFocusCabaz = document.activeElement;
  const modal=document.getElementById("cabaz-modal");
  if(!modal)return;
  modal.inert=false;
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
    modal.inert=true;
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
    window.showNotice("Cabaz", "Insere uma data válida e um valor entre 150 € e 600 €.", "warn");
    return;
  }

  saveCabazToLS(iso,valor,nota);
  closeCabazEditor();
  renderCabaz();
  window.renderPortugalBriefing?.();

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
loadCabazAuto();



/* ── Cabeçalho: janela "Sobre" e ligação ao estado dos dados ── */
function bindHeaderExtras() {
  const dialog = document.getElementById('aboutDialog');
  const open = document.getElementById('aboutOpenBtn');
  if (dialog && open && !open.dataset.bound) {
    open.addEventListener('click', () => {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    });
    document.getElementById('aboutCloseBtn')?.addEventListener('click', () => dialog.close?.());
    // Clicar fora do conteúdo (no fundo) fecha.
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close?.(); });
    open.dataset.bound = 'true';
  }
  const locate = document.getElementById('hdrLocateBtn');
  if (locate && !locate.dataset.bound) {
    locate.addEventListener('click', event => { event.preventDefault(); locateHeaderCity(locate); });
    locate.dataset.bound = 'true';
  }
  const status = document.getElementById('hdrStatus');
  if (status && !status.dataset.bound) {
    status.addEventListener('click', () => {
      const details = document.querySelector('#dataOverview .data-overview-details');
      if (details) details.open = true;
    });
    status.dataset.bound = 'true';
  }
}
