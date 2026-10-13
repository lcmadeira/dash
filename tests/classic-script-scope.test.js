import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

function createBrowserContext() {
  const sandbox = {
    document: { getElementById: () => null },
    Intl,
    Date,
    Object,
    parseInt,
  };
  sandbox.window = sandbox;
  return vm.createContext(sandbox);
}

test("market clock loads alongside a cached classic script declaring MARKETS", async () => {
  const context = createBrowserContext();
  vm.runInContext('const MARKETS = ["cached app"];', context);

  const source = await readFile("src/widgets/market-clock.js", "utf8");
  vm.runInContext(source, context);

  assert.equal(typeof context.tickMarkets, "function");
  assert.doesNotThrow(() => vm.runInContext("const APP_MARKETS = MARKETS;", context));
});

test("fuel card loads alongside a cached classic script declaring FUEL_SLUGS", async () => {
  const context = createBrowserContext();
  vm.runInContext('const FUEL_SLUGS = ["cached app"];', context);

  const source = await readFile("src/cards/fuel.js", "utf8");
  vm.runInContext(source, context);

  assert.equal(typeof context.renderFuel, "function");
  assert.equal(typeof context.getFuelPrefs, "function");
  assert.doesNotThrow(() => vm.runInContext("const APP_FUEL_SLUGS = FUEL_SLUGS;", context));
});

test("weather card replaces the cached global entry point without redeclaration", async () => {
  const context = createBrowserContext();
  vm.runInContext("function loadWeather() {}", context);

  const source = await readFile("src/cards/weather.js", "utf8");
  vm.runInContext(source, context);

  assert.equal(typeof context.loadWeather, "function");
  assert.doesNotThrow(() => vm.runInContext("function APP_LOAD_WEATHER() {}", context));
});

test("air quality card loads alongside a cached AQI_EU declaration", async () => {
  const context = createBrowserContext();
  vm.runInContext('const AQI_EU = ["cached app"];', context);

  const source = await readFile("src/cards/air-quality.js", "utf8");
  vm.runInContext(source, context);

  assert.equal(typeof context.loadAirQuality, "function");
  assert.doesNotThrow(() => vm.runInContext("const APP_AQI_EU = AQI_EU;", context));
});

test("economic calendar loads alongside cached date data and event handlers", async () => {
  const context = createBrowserContext();
  vm.runInContext('const FOMC_DATES_2026 = ["cached app"]; function switchCal() {}', context);

  const source = await readFile("src/widgets/economic-calendar.js", "utf8");
  vm.runInContext(source, context);

  assert.equal(typeof context.switchCal, "function");
  assert.equal(typeof context.loadAndRenderCalendar, "function");
  assert.doesNotThrow(() => vm.runInContext("const APP_FOMC_DATES = FOMC_DATES_2026;", context));
});

test("holidays card loads alongside cached globals and switches its summary tabs", async () => {
  const context = createBrowserContext();
  vm.runInContext('const MUNIC = ["cached app"]; function loadHolidays() {}', context);

  const tabs = [
    { classList: { classes: new Set(["on"]), remove(name) { this.classes.delete(name); }, add(name) { this.classes.add(name); } } },
    { classList: { classes: new Set(), remove(name) { this.classes.delete(name); }, add(name) { this.classes.add(name); } } },
  ];
  const views = {
    "hol-resumo": { style: {} },
    "hol-feriados": { style: {} },
  };
  context.document = {
    querySelectorAll: () => tabs,
    getElementById: id => views[id] || null,
  };

  const source = await readFile("src/cards/holidays.js", "utf8");
  vm.runInContext(source, context);

  assert.equal(typeof context.loadHolidays, "function");
  assert.equal(typeof context.switchWxHol, "function");
  context.switchHolTab("feriados", tabs[1]);
  assert.equal(views["hol-resumo"].style.display, "none");
  assert.equal(views["hol-feriados"].style.display, "");
  assert.equal(tabs[0].classList.classes.has("on"), false);
  assert.equal(tabs[1].classList.classes.has("on"), true);
  assert.doesNotThrow(() => vm.runInContext("const APP_MUNIC = MUNIC;", context));
});

test("market stats card replaces its cached global entry point without redeclaration", async () => {
  const context = createBrowserContext();
  vm.runInContext("function loadMarketStats() {}", context);

  const source = await readFile("src/cards/market-stats.js", "utf8");
  vm.runInContext(source, context);

  assert.equal(typeof context.loadMarketStats, "function");
  assert.doesNotThrow(() => vm.runInContext("function APP_LOAD_MARKET_STATS() {}", context));
});

test("real estate card keeps its entry points and renders selected tabs", async () => {
  const context = createBrowserContext();
  vm.runInContext('const IMOB_REGIOES = ["cached app"];', context);

  const tabs = [
    { classList: { classes: new Set(["on"]), remove(name) { this.classes.delete(name); }, add(name) { this.classes.add(name); } } },
    { classList: { classes: new Set(), remove(name) { this.classes.delete(name); }, add(name) { this.classes.add(name); } } },
  ];
  const body = { offsetWidth: 360, innerHTML: "" };
  context.setTimeout = () => 0;
  context.document = {
    addEventListener() {},
    querySelectorAll: () => tabs,
    getElementById: id => id === "imob-body" ? body : null,
  };

  const source = await readFile("src/cards/real-estate.js", "utf8");
  vm.runInContext(source, context);

  assert.equal(typeof context.loadImob, "function");
  context.switchImob("municipios", tabs[1]);
  assert.match(body.innerHTML, /Lisboa/);
  assert.equal(tabs[0].classList.classes.has("on"), false);
  assert.equal(tabs[1].classList.classes.has("on"), true);
  assert.doesNotThrow(() => vm.runInContext("const APP_IMOB_REGIOES = IMOB_REGIOES;", context));
});

test("fear and greed card replaces its cached entry point and renders cached data", async () => {
  const context = createBrowserContext();
  vm.runInContext("function loadFng() {}", context);

  const body = { innerHTML: "" };
  context.document = { getElementById: id => id === "fng-body" ? body : null };
  context.$ = id => context.document.getElementById(id);
  context.ld = () => "loading";
  context.lsGet = () => Array.from({ length: 30 }, (_, index) => ({
    value: String(index === 0 ? 80 : 50),
    timestamp: String(Math.floor(Date.now() / 1000) - index * 86400),
  }));
  context.lsSet = () => {};

  const source = await readFile("src/cards/fear-greed.js", "utf8");
  vm.runInContext(source, context);

  assert.equal(typeof context.loadFng, "function");
  await context.loadFng();
  assert.match(body.innerHTML, /Ganância Extrema/);
  assert.match(body.innerHTML, /30 dias/);
  assert.doesNotThrow(() => vm.runInContext("function APP_LOAD_FNG() {}", context));
});

test("agriculture card isolates its cached symbol list and renders cached prices", async () => {
  const context = createBrowserContext();
  vm.runInContext('var AGRI_SYMS = ["cached app"]; function loadAgri() {}', context);

  const body = { innerHTML: "" };
  context.document = { getElementById: id => id === "agri-body" ? body : null };
  context.$ = id => context.document.getElementById(id);
  context.ld = () => "loading";
  context.lsGet = () => Array.from({ length: 6 }, (_, index) => ({
    close: 500 + index,
    chg: index - 2,
    hi: 510 + index,
    lo: 490 + index,
    vol: 1000,
  }));

  const source = await readFile("src/cards/agriculture.js", "utf8");
  vm.runInContext(source, context);

  assert.equal(typeof context.loadAgri, "function");
  await context.loadAgri();
  assert.match(body.innerHTML, /Trigo/);
  assert.match(body.innerHTML, /Café/);
  assert.match(body.innerHTML, /500\.0/);
  assert.doesNotThrow(() => vm.runInContext('var APP_AGRI_SYMS = AGRI_SYMS;', context));
});

test("exports card renders both views and ignores unknown modes", async () => {
  const context = createBrowserContext();
  vm.runInContext('var EXP_DATA = { cached: true }; var EXP_MODE = "cached";', context);

  const body = { innerHTML: "" };
  const buttons = [
    { classList: { remove() {}, add() {} } },
    { classList: { remove() {}, add() {} } },
  ];
  context.document = {
    querySelectorAll: () => buttons,
    getElementById: id => id === "exp-body" ? body : null,
  };
  context.$ = id => context.document.getElementById(id);

  const source = await readFile("src/cards/exports.js", "utf8");
  vm.runInContext(source, context);

  context.renderExp();
  assert.match(body.innerHTML, /Espanha/);
  context.switchExp("produtos", buttons[1]);
  assert.match(body.innerHTML, /Máquinas e Aparelhos/);
  const productsView = body.innerHTML;
  context.switchExp("unknown", buttons[0]);
  assert.equal(body.innerHTML, productsView);
  assert.doesNotThrow(() => vm.runInContext('var APP_EXP_DATA = EXP_DATA;', context));
});

test("public debt card renders country and updated 2014–2024 trend views", async () => {
  const context = createBrowserContext();
  vm.runInContext('var DIV_PAISES = ["cached app"]; var DIV_TREND = [];', context);

  const body = { innerHTML: "" };
  const buttons = [
    { classList: { remove() {}, add() {} } },
    { classList: { remove() {}, add() {} } },
  ];
  context.document = {
    querySelectorAll: () => buttons,
    getElementById: id => id === "div-body" ? body : null,
  };
  context.$ = id => context.document.getElementById(id);

  const source = await readFile("src/cards/public-debt.js", "utf8");
  vm.runInContext(source, context);

  context.renderDiv();
  assert.match(body.innerHTML, /Portugal/);
  context.switchDiv("trend", buttons[1]);
  assert.match(body.innerHTML, /2014–2024/);
  assert.match(body.innerHTML, />24</);
  const trendView = body.innerHTML;
  context.switchDiv("unknown", buttons[0]);
  assert.equal(body.innerHTML, trendView);
  assert.doesNotThrow(() => vm.runInContext('var APP_DIV_PAISES = DIV_PAISES;', context));
});

test("recession card describes spread readings precisely and recovers from invalid cache", async () => {
  const context = createBrowserContext();
  vm.runInContext('const REC_TREND_PREF_KEY = "cached app"; function loadRec() {}', context);

  const body = { innerHTML: "" };
  context.document = { getElementById: id => id === "rec-body" ? body : null };
  context.$ = id => context.document.getElementById(id);
  context.ld = () => "loading";
  context.PFX = "test_";
  context.localStorage = { getItem: () => null, setItem() {} };
  context._lastN = (values, length) => values.slice(-length);
  context.lsGet = () => [["invalid-date", NaN]];

  const source = await readFile("src/cards/recession.js", "utf8");
  vm.runInContext(source, context);

  assert.equal(typeof context.loadRec, "function");
  assert.equal(typeof context.setRecTrendDays, "function");
  await context.loadRec();
  assert.match(body.innerHTML, /ref\. Mar 2026/);
  assert.match(body.innerHTML, /Leituras negativas/);
  assert.match(body.innerHTML, /indicador é historicamente associado/);
  assert.doesNotMatch(body.innerHTML, /mercados não sinalizam recessão iminente/);
  assert.doesNotThrow(() => vm.runInContext('const APP_REC_PREF = REC_TREND_PREF_KEY;', context));
});

test("air traffic card escapes OpenSky text and lists only airports on the map", async () => {
  const context = createBrowserContext();
  vm.runInContext('const AIRPORTS = ["cached app"]; function loadAir() {}', context);

  const body = { innerHTML: "" };
  const tip = { style: {} };
  const canvasContext = {
    fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, closePath() {},
    fill() {}, arc() {}, save() {}, translate() {}, rotate() {}, restore() {}, fillText() {},
    createRadialGradient() { return { addColorStop() {} }; },
  };
  const canvas = {
    parentElement: { offsetWidth: 600 },
    getBoundingClientRect: () => ({ width: 600, height: 260, left: 0, top: 0 }),
    getContext: () => canvasContext,
  };
  const now = Math.floor(Date.now() / 1000);
  const states = [
    ["abc123", '<img src=x onerror="alert(1)">', "<svg/onload=alert(2)>", now, now, -8.47, 40.15, 8000, false, 200, 90, 1],
    ["def456", "TAP123", "Portugal", now, now, -8.4, 40, null, true, 0, null, null],
  ];
  context.document = {
    getElementById: id => ({ "air-body": body, "air-map-canvas": canvas, "air-map-tip": tip })[id] || null,
  };
  context.$ = id => context.document.getElementById(id);
  context.ld = () => "loading";
  context.lsGet = () => ({ live: true, ts: Date.now(), states });
  context.IS_LOCAL_DEV = false;
  context.window._topoCache = { features: [] };

  const source = await readFile("src/cards/air-traffic.js", "utf8");
  vm.runInContext(source, context);

  assert.equal(typeof context.loadAir, "function");
  await context.loadAir();
  assert.match(body.innerHTML, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(body.innerHTML, /&lt;svg\/onload=alert\(2\)&gt;/);
  assert.doesNotMatch(body.innerHTML, /<img src=x/);
  assert.match(body.innerHTML, /CBP/);
  assert.doesNotMatch(body.innerHTML, />COR</);
  assert.doesNotMatch(body.innerHTML, />PDL</);
  assert.doesNotThrow(() => vm.runInContext("const APP_AIRPORTS = AIRPORTS;", context));
});

test("Ormuz card expires stale AIS, validates positions and escapes vessel tooltips", async () => {
  const context = createBrowserContext();
  const body = { innerHTML: "" };
  const tip = { style: {} };
  const canvasContext = {
    fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, closePath() {},
    fill() {}, arc() {}, save() {}, translate() {}, rotate() {}, restore() {}, fillText() {},
  };
  const canvas = {
    parentElement: { offsetWidth: 600 },
    getBoundingClientRect: () => ({ width: 600, height: 200, left: 0, top: 0 }),
    getContext: () => canvasContext,
  };
  context.document = {
    getElementById: id => ({ "ormuz-body": body, "ormuz-map-canvas": canvas, "ormuz-map-tip": tip })[id] || null,
  };
  context.$ = id => context.document.getElementById(id);
  context.ld = () => "loading";
  context.IS_LOCAL_DEV = false;
  const ship = Array(19).fill(null);
  Object.assign(ship, { 0: "211000111", 1: 25, 2: 59, 3: 12, 4: 270, 5: '<img src=x onerror="alert(1)">', 18: "<svg/onload=alert(2)>" });
  let cached = { live: true, ts: Date.now(), vessels: [{}, ship, ["bad", null, "", 0, 0]] };
  context.lsGet = () => cached;
  context.window._topoCache = { features: [] };

  const source = await readFile("src/cards/ormuz.js", "utf8");
  vm.runInContext(source, context);
  assert.equal(typeof context.loadOrmuz, "function");
  await context.loadOrmuz();
  assert.match(body.innerHTML, /Live/);
  assert.match(body.innerHTML, /Distribuição estimada por tipo/);
  assert.match(body.innerHTML, /não classificadas a partir dos dados AIS/);

  canvas.onmousemove({ clientX: 516, clientY: 139, offsetX: 516, offsetY: 139 });
  assert.match(tip.innerHTML, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(tip.innerHTML, /&lt;SVG\/ONLOAD=ALERT\(2\)&gt;/);
  assert.doesNotMatch(tip.innerHTML, /<img src=x/);

  cached = { live: true, ts: Date.now() - 16 * 60 * 1000, vessels: [{}, ship] };
  await context.loadOrmuz();
  assert.match(body.innerHTML, /Simulated/);
  assert.doesNotMatch(body.innerHTML, /● Live/);
});

test("CO2 card renders its reference mix without an unused network fetch", async () => {
  const context = createBrowserContext();
  vm.runInContext('const CO2_F = ["cached app"];', context);
  const body = { innerHTML: "" };
  context.document = { getElementById: id => id === "co2-body" ? body : null };
  context.$ = id => context.document.getElementById(id);
  context.ld = () => "loading";

  const source = await readFile("src/cards/co2.js", "utf8");
  vm.runInContext(source, context);
  assert.equal(typeof context.loadCO2, "function");
  await context.loadCO2();
  assert.match(body.innerHTML, /Mix energético 2024/);
  assert.match(body.innerHTML, /comparação EU \(2023\)/);
  assert.match(body.innerHTML, /gCO₂\/kWh/);
  assert.doesNotThrow(() => vm.runInContext("const APP_CO2_F = CO2_F;", context));
});

test("transport card shows current urban reference fares and avoids claiming live service status", async () => {
  const context = createBrowserContext();
  vm.runInContext("function loadTransp() {} function switchTr() {}", context);
  const body = { innerHTML: "" };
  const passes = { style: {} };
  const schedules = { style: {} };
  const buses = { style: {} };
  const tabs = [0, 1, 2].map(() => ({
    classList: {
      classes: new Set(),
      remove(name) { this.classes.delete(name); },
      add(name) { this.classes.add(name); },
    },
  }));
  context.document = {
    getElementById: id => ({
      "transp-body": body,
      "tr-passes": passes,
      "tr-horarios": schedules,
      "tr-autocarros": buses,
    })[id] || null,
    querySelectorAll: () => tabs,
  };

  const source = await readFile("src/cards/transport.js", "utf8");
  vm.runInContext(source, context);
  assert.equal(typeof context.loadTransp, "function");
  assert.equal(typeof context.switchTr, "function");
  context.loadTransp();
  assert.match(body.innerHTML, /Passe Navegante 2026/);
  assert.match(body.innerHTML, /1\.90€/);
  assert.match(body.innerHTML, /7\.25€/);
  assert.match(body.innerHTML, /1\.40€/);
  assert.match(body.innerHTML, /consultar tarifa/i);
  assert.match(body.innerHTML, /estado operacional e os avisos de greve não são consultados em direto/);
  assert.doesNotMatch(body.innerHTML, /Sem greves anunciadas|Circulação normal|Passe Alentejo/);

  context.switchTr("horarios", tabs[1]);
  assert.equal(passes.style.display, "none");
  assert.equal(schedules.style.display, "");
  assert.equal(buses.style.display, "none");
  assert.equal(tabs[1].classList.classes.has("on"), true);
});

test("press card renders RSF 2026 separately from historical EIU data and avoids cached scope collisions", async () => {
  const context = createBrowserContext();
  vm.runInContext('const RSF = ["cached app"]; const EIU = ["cached app"];', context);
  const body = { innerHTML: "" };
  context.document = { getElementById: id => id === "press-body" ? body : null };

  const source = await readFile("src/cards/press.js", "utf8");
  vm.runInContext(source, context);

  assert.equal(typeof context.loadPress, "function");
  context.loadPress();
  assert.match(body.innerHTML, /RSF 2026/);
  assert.match(body.innerHTML, /Portugal[\s\S]*?#10[\s\S]*?83\.71/);
  assert.match(body.innerHTML, /EIU 2024/);
  assert.match(body.innerHTML, /Distribuição global RSF 2024/);
  assert.match(body.innerHTML, /Score por região RSF 2024/);
  assert.doesNotThrow(() => vm.runInContext("const APP_RSF = RSF; const APP_EIU = EIU;", context));
});

test("minimum wage card uses comparable 2026 Eurostat amounts and explains Portugal's 14 payments", async () => {
  const context = createBrowserContext();
  vm.runInContext('const SMN_HIST = ["cached app"]; const SMN_EU = ["cached app"]; const IPC = ["cached app"];', context);
  const body = { innerHTML: "" };
  context.document = { getElementById: id => id === "smn-body" ? body : null };

  const source = await readFile("src/cards/smn.js", "utf8");
  vm.runInContext(source, context);

  assert.equal(typeof context.loadSMN, "function");
  context.loadSMN();
  assert.match(body.innerHTML, /SMN legal Portugal 2026/);
  assert.match(body.innerHTML, /Comparação UE · Eurostat jan\. 2026/);
  assert.match(body.innerHTML, /Portugal[\s\S]*?1073€/);
  assert.match(body.innerHTML, /920€ × 14[\s\S]*?1073€ brutos\/mês/);
  assert.match(body.innerHTML, /Espanha: dado de 2025/);
  assert.doesNotMatch(body.innerHTML, /custo de vida estimado|IPC por categoria/);
  assert.doesNotThrow(() => vm.runInContext("const APP_SMN_HIST = SMN_HIST; const APP_SMN_EU = SMN_EU;", context));
});

test("inflation card renders a valid cache without recursively invoking its loader", async () => {
  const context = createBrowserContext();
  const body = { innerHTML: "" };
  let fetchCalls = 0;
  let requestedCacheKey = "";
  context.$ = () => body;
  context.INFLATION_FALLBACK = [{ m: "Set 2026", pt: 3.6, eu: 3.8 }];
  context.lsGet = key => {
    requestedCacheKey = key;
    return {
    source: "eurostat_live",
    rows: [
      { m: "Set 2026", pt: 3.6, eu: 3.8 },
      { m: "Ago 2026", pt: 3.6, eu: 3.2 },
      { m: "Jul 2026", pt: 3.6, eu: 2.9 },
    ],
    };
  };
  context.lsSet = () => {};
  context.fetch = async () => {
    fetchCalls++;
    throw new Error("unexpected network request");
  };
  context.AbortSignal = { timeout: () => undefined };
  context.console = { log() {}, warn() {} };

  const source = await readFile("src/cards/inflation.js", "utf8");
  vm.runInContext(source, context);
  await context.initInflation();

  assert.match(body.innerHTML, /Portugal · IHPC/);
  assert.match(body.innerHTML, /Eurostat · Set 2026/);
  assert.match(body.innerHTML, /estimativas rápidas do INE/);
  assert.equal(fetchCalls, 0);
  assert.equal(requestedCacheKey, "inflation_eurostat_v2");
});

test("inflation parser uses JSON-stat dimension strides and EA21 for 2026", async () => {
  const context = createBrowserContext();
  const body = { innerHTML: "" };
  const periods = ["2025-12", "2026-01", "2026-08", "2026-09"];
  const countries = ["PT", "EA20", "EA21"];
  const values = {};
  const rowsByCountry = {
    PT: [1.9, 2.0, 3.6, 3.6],
    EA20: [2.0, 1.7, 3.1, 3.7],
    EA21: [2.0, 2.1, 3.2, 3.8],
  };
  countries.forEach((country, geoIndex) => {
    periods.forEach((_, timeIndex) => {
      values[geoIndex * periods.length + timeIndex] = rowsByCountry[country][timeIndex];
    });
  });
  const responseData = {
    id: ["geo", "time"],
    size: [countries.length, periods.length],
    dimension: {
      geo: { category: { index: Object.fromEntries(countries.map((country, index) => [country, index])) } },
      time: { category: { index: Object.fromEntries(periods.map((period, index) => [period, index])) } },
    },
    value: values,
  };

  context.$ = () => body;
  context.INFLATION_FALLBACK = [{ m: "Set 2026", pt: 3.6, eu: 3.8 }];
  context.lsGet = () => null;
  context.lsSet = () => {};
  context.fetch = async url => ({
    ok: true,
    async json() {
      assert.match(url, /geo=EA21/);
      return responseData;
    },
  });
  context.AbortSignal = { timeout: () => undefined };
  context.console = { log() {}, warn() {} };

  const source = await readFile("src/cards/inflation.js", "utf8");
  vm.runInContext(source, context);
  await context.initInflation(true);

  assert.match(body.innerHTML, /3\.6<span/);
  assert.match(body.innerHTML, /3\.8<span/);
  assert.match(body.innerHTML, /Jan 2026[\s\S]*?2\.1%/);
  assert.doesNotMatch(body.innerHTML, /Jan 2026[\s\S]*?1\.7%/);
  assert.doesNotThrow(() => vm.runInContext("const APP_INFLATION = INFLATION_FALLBACK;", context));
});

test("Euribor card ignores an incomplete cache and renders the configured fallback", async () => {
  const body = { innerHTML: "" };
  const context = vm.createContext({
    AbortSignal,
    Date,
    Intl,
    PFX: "dash_",
    URLSearchParams,
    console: { log() {}, warn() {} },
    document: { getElementById: id => id === "euri-body" ? body : null },
    location: { search: "" },
    localStorage: { getItem: () => null },
    addToHistory() {},
    lsGet: () => ({ updated: "cache corrompida" }),
    lsSet() {},
  });
  context.window = context;

  vm.runInContext(await readFile("src/config.js", "utf8"), context);
  vm.runInContext(await readFile("src/cards/euribor.js", "utf8"), context);
  await context.initEuribor();

  assert.match(body.innerHTML, /EMMI estático/);
  assert.match(body.innerHTML, /2\.682/);
  assert.doesNotMatch(body.innerHTML, /NaN|undefined/);
});

test("FX card rejects malformed cached rates and sanitizes trend preferences", async () => {
  const body = { innerHTML: "" };
  const values = new Map();
  let cacheWrite = null;
  let fetchCount = 0;
  const context = vm.createContext({
    Intl,
    PFX: "dash_",
    console: { log() {}, warn() {} },
    document: { getElementById: () => null },
    localStorage: {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    },
    $: selector => selector === "fx-body" ? body : ({ value: "1" }),
    skeletonKPIs: () => "loading",
    lsGet: key => key === "fx" ? { date: "invalida", rates: { USD: "not-a-rate" } } : null,
    lsSet: (key, value) => { cacheWrite = { key, value }; },
    fetchJsonFirstOk: async url => {
      fetchCount++;
      assert.match(url, /frankfurter\.dev/);
      return {
        date: "2026-10-12",
        rates: { USD: 1.1, GBP: 0.8, CHF: 0.9, JPY: 170, BRL: 6.2, CNY: 7.8, AED: 4, CAD: 1.5 },
      };
    },
    addToHistory() {},
    renderTrendChart() {},
    _lastN: rows => rows,
    _setOnByDataAttr() {},
    getHistory: () => [],
    er: () => "error",
    notifyNonCriticalError() {},
  });
  context.window = context;
  vm.runInContext('const FX_PAIRS = ["cached app"];', context);

  vm.runInContext(await readFile("src/cards/fx.js", "utf8"), context);
  await context.loadFX();
  context.setFXTrendCode('<img src=x onerror=alert(1)>');
  context.setFXTrendDays(999);

  assert.equal(fetchCount, 1);
  assert.equal(cacheWrite.key, "fx");
  assert.equal(cacheWrite.value.rates.USD, 1.1);
  assert.match(body.innerHTML, /1,1000/);
  assert.deepEqual(JSON.parse(values.get("dash_fx_trend_pref_v1")), { code: "USD", days: 30 });
  assert.doesNotThrow(() => vm.runInContext("const APP_FX_PAIRS = FX_PAIRS;", context));
});

test("crypto card rejects malformed cache and restricts trend selections", async () => {
  const body = { innerHTML: "" };
  const values = new Map();
  let cacheWrite = null;
  let fetchCalls = 0;
  const context = vm.createContext({
    Intl,
    PFX: "dash_",
    console: { log() {}, warn() {} },
    document: { getElementById: () => null },
    localStorage: {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    },
    $: selector => selector === "crypto-body" ? body : null,
    skeletonKPIs: () => "loading",
    lsGet: key => key === "cg" ? { bitcoin: { eur: "bad" } } : null,
    lsSet: (key, value) => { cacheWrite = { key, value }; },
    fetchFirstOk: async () => {
      fetchCalls++;
      return {
        r: {
          ok: true,
          async json() { return { bitcoin: { eur: 65000, eur_24h_change: -1.25 } }; },
        },
      };
    },
    addToHistory() {},
    fmtP: value => Number(value).toFixed(2),
    chg: value => `${value}%`,
    er: () => "error",
    notifyNonCriticalError() {},
  });
  context.window = context;
  vm.runInContext('const CRYPTO_IDS = ["cached app"];', context);

  vm.runInContext(await readFile("src/cards/crypto.js", "utf8"), context);
  await context.loadCrypto();
  context.setCryptoTrendCoin('<img src=x onerror=alert(1)>');
  context.setCryptoTrendDays(999);

  assert.equal(fetchCalls, 1);
  assert.equal(cacheWrite.key, "cg");
  assert.equal(cacheWrite.value.bitcoin.eur, 65000);
  assert.match(body.innerHTML, /Bitcoin/);
  assert.deepEqual(JSON.parse(values.get("dash_crypto_trend_pref_v1")), { coinId: "bitcoin", days: 30 });
  assert.doesNotThrow(() => vm.runInContext("const APP_CRYPTO_IDS = CRYPTO_IDS;", context));
});
