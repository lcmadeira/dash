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

test("card status cache metadata rejects malformed and future cache envelopes", async () => {
  const values = new Map();
  const context = createBrowserContext();
  context.localStorage = {
    getItem: key => values.get(key) ?? null,
  };
  context.PFX = "dash_v15_";
  context.getTTL = () => 60000;

  const source = await readFile("src/ui.js", "utf8");
  vm.runInContext(source, context);

  const now = Date.now();
  values.set("dash_v15_valid", JSON.stringify({
    d: { ok: true, dataUpdate: new Date(now - 3600000).toISOString() },
    ts: now - 5000,
  }));
  values.set("dash_v15_missing-data", JSON.stringify({ ts: now - 5000 }));
  values.set("dash_v15_future", JSON.stringify({ d: {}, ts: now + 60000 }));
  values.set("dash_v15_array", JSON.stringify([{ d: {}, ts: now }]));

  assert.equal(context.getCacheMeta("valid").age >= 5000, true);
  assert.equal(context.getCacheMeta("valid").expired, false);
  assert.equal(context.getCacheMeta("valid").sourceTs <= now - 3599000, true);
  assert.equal(context.getCacheMeta("missing-data"), null);
  assert.equal(context.getCacheMeta("future"), null);
  assert.equal(context.getCacheMeta("array"), null);
});

test("cache preserves validated source provenance without breaking legacy envelopes", async () => {
  const values = new Map();
  const context = vm.createContext({
    Date, Object, console: { log() {}, warn() {}, error() {} },
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key),
    },
    document: { querySelector: () => null, querySelectorAll: () => [] },
  });
  context.window = context;
  vm.runInContext(await readFile("src/cache.js", "utf8"), context);
  vm.runInContext(await readFile("src/ui.js", "utf8"), context);

  const observedAt = Date.now() - 60000;
  assert.equal(context.lsSet("market", { price: 12 }, {
    source: "Provider A", state: "partial", observedAt, reason: "1 symbol missing",
  }), true);
  assert.equal(context.lsGet("market").price, 12);
  const meta = context.getCacheMeta("market");
  assert.equal(meta.dataMeta.source, "Provider A");
  assert.equal(meta.dataMeta.state, "partial");
  assert.equal(meta.sourceTs, observedAt);

  context.lsSet("legacy", { value: 1 });
  assert.equal(context.getCacheMeta("legacy").dataMeta, null);
  context.lsSet("future", { value: 2 }, { source: "Provider", observedAt: Date.now() + 60000 });
  assert.equal(context.getCacheMeta("future").dataMeta.source, "Provider");
  assert.equal(context.getCacheMeta("future").sourceTs, null);
});

test("food basket includes the latest verified weekly DECO values", async () => {
  const source = await readFile("src/app.js", "utf8");
  assert.match(source, /\["2026-10-21", 253\.99,/);
  assert.match(source, /\["2026-10-28", 253\.55,/);
  assert.match(source, /\["2025-10-28", 243\.68,/);
  assert.match(source, /Ver atualização de 28 Out \(Lusa\)/);
});

test("single-flight helper shares concurrent card loads and clears settled work", async () => {
  const context = vm.createContext({
    URL, URLSearchParams,
    location: { protocol: "https:", hostname: "example.test", search: "" },
    window: {},
  });
  context.window = context;
  vm.runInContext(await readFile("src/fetch.js", "utf8"), context);

  let calls = 0;
  let release;
  const task = () => { calls++; return new Promise(resolve => { release = resolve; }); };
  const first = context.runSingleFlight("card:test", task);
  const second = context.runSingleFlight("card:test", task);
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(first, second);
  release("done");
  assert.equal(await first, "done");
  assert.equal(await context.runSingleFlight("card:test", async () => { calls++; return "next"; }), "next");
  assert.equal(calls, 2);
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

test("air quality requests use Open-Meteo variable names and skip the local proxy on Pages", async () => {
  const context = createBrowserContext();
  const body = { innerHTML: "" };
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const times = Array.from({ length: 24 }, (_, hour) => `${day}T${String(hour).padStart(2, "0")}:00`);
  const hourly = {
    time: times,
    european_aqi: Array(24).fill(18),
    pm10: Array(24).fill(12),
    pm2_5: Array(24).fill(5),
    nitrogen_dioxide: Array(24).fill(11),
    ozone: Array(24).fill(32),
    sulphur_dioxide: Array(24).fill(3),
  };
  const calls = [];
  let savedData = null;
  context.AbortSignal = AbortSignal;
  context.CFG = { IPMA_CITY_ID: 1110600 };
  context.$ = id => id === "aq-body" ? body : null;
  context.skeletonKPIs = () => "loading";
  context.lsGet = () => null;
  context.lsSet = (_key, value) => { savedData = value; };
  context.er = () => "error";
  context.notifyNonCriticalError = () => {};
  context.fetchJsonFirstOk = async (url, _options, _timeout, sources) => {
    calls.push({ url, sources });
    return url.includes("/v1/forecast") ? { hourly: { uv_index: Array(24).fill(2) } } : { hourly };
  };

  const source = await readFile("src/cards/air-quality.js", "utf8");
  vm.runInContext(source, context);
  await context.loadAirQuality();

  const airCall = calls.find(call => call.url.includes("/v1/air-quality"));
  const uvCall = calls.find(call => call.url.includes("/v1/forecast"));
  assert.ok(airCall);
  assert.match(airCall.url, /nitrogen_dioxide%2C/);
  assert.match(airCall.url, /%2Cozone%2Csulphur_dioxide/);
  assert.deepEqual(Array.from(airCall.sources), ["local", "direct"]);
  assert.deepEqual(Array.from(uvCall.sources), ["direct"]);
  assert.equal(savedData.hourly.no2[0], 11);
  assert.equal(savedData.hourly.o3[0], 32);
  assert.equal(savedData.hourly.so2[0], 3);
  assert.match(body.innerHTML, /Qualidade/);
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

test("agriculture Stooq fallback reads the CSV OHLCV columns correctly", async () => {
  const body = { innerHTML: "" };
  let savedCache = null;
  const context = createBrowserContext();
  context.AbortSignal = AbortSignal;
  context.$ = id => id === "agri-body" ? body : null;
  context.ld = () => "loading";
  context.lsGet = () => null;
  context.lsSet = (_key, value) => { savedCache = value; };
  context.fetchFirstOk = async () => { throw new Error("Yahoo unavailable in test"); };
  context.fetchTextFirstOk = async () =>
    "Symbol,Date,Time,Open,High,Low,Close,Volume\nZW.F,2026-10-29,12:00:00,100,110,90,105,5000";

  const source = await readFile("src/cards/agriculture.js", "utf8");
  vm.runInContext(source, context);
  await context.loadAgri(true);

  assert.equal(savedCache[0].close, 105);
  assert.equal(savedCache[0].chg, 5);
  assert.equal(savedCache[0].hi, 110);
  assert.equal(savedCache[0].lo, 90);
  assert.equal(savedCache[0].vol, 5000);
  assert.match(body.innerHTML, /105\.0/);
  assert.match(body.innerHTML, /5\.00%/);
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
  context.fetchJsonFirstOk = async (_url, _options, _timeoutMs, _sources, validateJson) => {
    const response = await context.fetch(_url);
    const json = await response.json();
    if (validateJson && !validateJson(json)) throw new Error("invalid test response");
    return json;
  };
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

test("PSI 20 card refreshes an invalid quote cache and validates fetched records", async () => {
  const body = { innerHTML: "" };
  let fetchCalls = 0;
  let cacheWrite = null;
  const context = vm.createContext({
    Date,
    Intl,
    PFX: "dash_",
    console: { log() {}, warn() {} },
    document: { getElementById: id => id === "psi20-body" ? body : null },
    localStorage: { getItem: () => null },
    lsGet: key => key === "psi20_v2" ? { indices: [], stocks: [], live: true } : null,
    lsSet: (key, value) => { cacheWrite = { key, value }; },
    fetchWithCORS: async () => {
      fetchCalls++;
      return {
        async json() {
          return { chart: { result: [{ meta: {
            regularMarketPrice: 100,
            previousClose: 99,
            regularMarketDayHigh: 101,
            regularMarketDayLow: 98,
            regularMarketVolume: 1000,
          } }] } };
        },
      };
    },
    fetchStooqMulti: async () => ({}),
    fetchStooqDailySeries: async () => [],
    _lastN: rows => rows,
    _setOnByDataAttr() {},
    addToHistory() {},
    renderTrendChart() {},
    ld: () => "loading",
  });
  context.window = context;

  vm.runInContext(await readFile("src/config.js", "utf8"), context);
  vm.runInContext('const PSI20_TREND_PREF_KEY = "cached app";', context);
  vm.runInContext(await readFile("src/cards/psi20.js", "utf8"), context);
  await context.loadPSI20();

  assert.equal(fetchCalls, context.EU_INDICES.length + context.PSI20_CONST.length);
  assert.equal(cacheWrite.key, "psi20_v2");
  assert.equal(cacheWrite.value.live, true);
  assert.match(body.innerHTML, /PSI 20 · Lisboa/);
  assert.doesNotThrow(() => vm.runInContext("const APP_PSI20_TREND_PREF_KEY = PSI20_TREND_PREF_KEY;", context));
});

test("PSI 20 uses one Stooq batch before querying Yahoo and shows live quote source", async () => {
  const body = { innerHTML: "" };
  let yahooCalls = 0;
  let stooqSymbols = [];
  let cacheWrite = null;
  const context = vm.createContext({
    Date,
    Intl,
    PFX: "dash_",
    console: { log() {}, warn() {} },
    document: { getElementById: id => id === "psi20-body" ? body : null },
    localStorage: { getItem: () => null },
    lsGet: () => null,
    lsSet: (key, value) => { cacheWrite = { key, value }; },
    fetchWithCORS: async () => { yahooCalls++; throw new Error("Yahoo should not be needed"); },
    fetchStooqMulti: async symbols => {
      stooqSymbols = symbols;
      return Object.fromEntries(symbols.map(sym => [sym, {
        price: 100, prev: 99, hi: 101, lo: 98, vol: 1000, chg: 1,
        live: true, src: "stooq",
      }]));
    },
    fetchStooqDailySeries: async () => [],
    _lastN: rows => rows,
    _setOnByDataAttr() {},
    addToHistory() {},
    renderTrendChart() {},
    ld: () => "loading",
  });
  context.window = context;

  vm.runInContext(await readFile("src/config.js", "utf8"), context);
  vm.runInContext(await readFile("src/cards/psi20.js", "utf8"), context);
  await context.loadPSI20();

  assert.equal(stooqSymbols.length, context.EU_INDICES.length + context.PSI20_CONST.length);
  assert.equal(yahooCalls, 0);
  assert.equal(cacheWrite.value.live, true);
  assert.match(body.innerHTML, /STOOQ/);
  assert.doesNotMatch(body.innerHTML, /FALLBACK/);
});

test("PSI 20 hides static fallback prices and marks its card header unavailable", async () => {
  const body = { innerHTML: "" };
  const header = { className: "", textContent: "", title: "" };
  const context = vm.createContext({
    Date,
    Intl,
    PFX: "dash_",
    console: { log() {}, warn() {} },
    document: { getElementById: id => id === "psi20-body" ? body : id === "psi20-header-status" ? header : null },
    localStorage: { getItem: () => null },
    lsGet: () => null,
    lsSet() {},
    fetchWithCORS: async () => { throw new Error("quote unavailable"); },
    fetchStooqMulti: async () => ({}),
    fetchStooqDailySeries: async () => [],
    getLisbonMarketContext: () => ({ state: "open", label: "Sessão normal aberta" }),
    _lastN: rows => rows,
    _setOnByDataAttr() {},
    addToHistory() {},
    renderTrendChart() {},
    ld: () => "loading",
  });
  context.window = context;

  vm.runInContext(await readFile("src/config.js", "utf8"), context);
  vm.runInContext(await readFile("src/cards/psi20.js", "utf8"), context);
  await context.loadPSI20();

  assert.equal(header.textContent, "Fonte indisponível");
  assert.match(header.title, /sessão aberta/);
  assert.match(header.className, /warn/);
  assert.match(body.innerHTML, /Cotação indisponível/);
  assert.match(body.innerHTML, /sem cotação atual/);
  assert.doesNotMatch(body.innerHTML, /4\.12€/);
});

test("CoinGecko uses its direct CORS endpoint before public proxies", async () => {
  const requests = [];
  let saved = null;
  const body = { innerHTML: "" };
  const context = vm.createContext({
    AbortSignal, Date, Intl, PFX: "dash_", URL, URLSearchParams,
    document: { getElementById: () => null },
    localStorage: { getItem: () => null },
    $: id => id === "crypto-body" ? body : null,
    skeletonKPIs: () => "loading",
    chg: value => `${value}%`,
    fmtP: value => String(value),
    lsGet: () => null,
    lsSet: (key, value) => { saved = { key, value }; },
    fetchFirstOk: async (_url, _options, _timeout, sources) => {
      requests.push(Array.from(sources));
      return { r: { ok: true, json: async () => ({ bitcoin: { eur: 60000 }, ethereum: { eur: 3000 } }) } };
    },
    notifyNonCriticalError() {},
  });
  context.window = context;
  vm.runInContext(await readFile("src/cards/crypto.js", "utf8"), context);
  await context.loadCrypto();

  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0], ["direct", "allorigins", "corsproxy", "codetabs"]);
  assert.equal(saved.key, "cg");
  assert.match(body.innerHTML, /Bitcoin/);
});

test("geopolitics loads recent GDELT JSON directly before fallback RSS feeds", async () => {
  const body = { innerHTML: "" };
  let requestedSources = null;
  let saved = null;
  const context = vm.createContext({
    AbortSignal, Date, URL, URLSearchParams,
    console: { log() {}, warn() {} },
    document: { querySelectorAll: () => [] },
    $: () => body,
    skeletonGeneric: () => "loading",
    lsGet: () => null,
    lsSet: (key, value) => { saved = { key, value }; },
    fetchJsonFirstOk: async (url, _options, _timeout, sources) => {
      requestedSources = Array.from(sources);
      assert.match(url, /api\.gdeltproject\.org\/api\/v2\/doc\/doc/);
      return { articles: Array.from({ length: 8 }, (_, index) => ({
        title: `Global conflict headline ${index}`,
        url: `https://news.example/story-${index}`,
        seendate: "20261029T110000Z",
      })) };
    },
    fetchTextFirstOk: async () => { throw new Error("RSS fallback should not be needed"); },
    notifyNonCriticalError() {},
    er: () => "error",
  });
  context.window = context;

  vm.runInContext(await readFile("src/cards/geopolitics.js", "utf8"), context);
  await context.loadGeo();

  assert.deepEqual(requestedSources, ["direct"]);
  assert.equal(saved.key, "geo_v10");
  assert.equal(saved.value[0].id, "gdelt");
  assert.match(body.innerHTML, /GDELT/);
  assert.match(body.innerHTML, /Global conflict headline/);
});

test("geopolitics card escapes RSS content and rejects unsafe article links", async () => {
  const body = { innerHTML: "" };
  let fetchCalls = 0;
  const context = vm.createContext({
    URL,
    console: { log() {}, warn() {} },
    document: { querySelectorAll: () => [] },
    $: () => body,
    skeletonGeneric: () => "loading",
    lsGet: () => [
      {
        id: "fa",
        title: '<img src=x onerror="alert(1)"> BBC title',
        link: "https://example.com/story?x=1&y=2",
        dt: Date.now(),
      },
      { id: "icg", title: "Unsafe link title", link: "javascript:alert(1)", dt: Date.now() },
    ],
    lsSet() {},
    fetch: async () => { fetchCalls++; throw new Error("cache should be sufficient"); },
    notifyNonCriticalError() {},
    er: () => "error",
  });
  context.window = context;

  vm.runInContext(await readFile("src/cards/geopolitics.js", "utf8"), context);
  await context.loadGeo();

  assert.equal(fetchCalls, 0);
  assert.match(body.innerHTML, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(body.innerHTML, /BBC World/);
  assert.match(body.innerHTML, /rel="noopener noreferrer"/);
  assert.match(body.innerHTML, /x=1&amp;y=2/);
  assert.doesNotMatch(body.innerHTML, /onclick=|javascript:/);
});


test("gas markets card rejects malformed TTF cache and keeps its global handlers", async () => {
  const context = createBrowserContext();
  const body = { innerHTML: "" };
  context.window = context;
  context.localStorage = { getItem: () => null, setItem() {} };
  context.PFX = "test_";
  context.lsGet = key => key === "ttf_live_v1" ? { price: "invalid", prev: null } : null;
  context.lsSet = () => {};
  context.fetchTextFirstOk = async () => { throw new Error("offline"); };
  context.fetch = async () => { throw new Error("offline"); };
  context.addToHistory = () => {};
  context.getHistory = () => [];
  context._setOnByDataAttr = () => {};
  context.fetchStooqDailySeries = async () => [];
  context._lastN = (items, count) => items.slice(-count);
  context.renderTrendChart = () => {};
  context.GAS_TARIFAS = {};
  context.document = { getElementById: id => id === "ttf-body" ? body : null };

  const source = await readFile("src/cards/gas-markets.js", "utf8");
  vm.runInContext(source, context);

  assert.equal(typeof context.loadTTF, "function");
  assert.equal(typeof context.loadGasPT, "function");
  assert.equal(typeof context.setTTFTrendDays, "function");
  await context.loadTTF();
  assert.doesNotMatch(body.innerHTML, /invalid/);
  assert.match(body.innerHTML, /38\.5/);
  assert.doesNotThrow(() => vm.runInContext("const APP_GAS_MARKETS = true;", context));
});


test("cache ignores future or malformed timestamps and removes invalid entries", async () => {
  const storage = {
    getItem(key) { return this[key] ?? null; },
    setItem(key, value) { this[key] = String(value); },
    removeItem(key) { delete this[key]; },
  };
  const context = vm.createContext({
    Date,
    Object,
    Number,
    JSON,
    console: { log() {}, warn() {}, error() {} },
    localStorage: storage,
  });
  context.window = context;
  vm.runInContext(await readFile("src/cache.js", "utf8"), context);

  const now = Date.now();
  storage.dash_v15_fresh = JSON.stringify({ d: { ok: true }, ts: now - 1000 });
  storage.dash_v15_future = JSON.stringify({ d: { future: true }, ts: now + 60_000 });
  storage.dash_v15_bad = JSON.stringify({ d: { missingTimestamp: true } });
  storage.dash_v15_old = JSON.stringify({ d: { stale: true }, ts: now - context.CACHE_TTL - 1000 });
  storage.dash_v15_corrupt = "{";

  assert.deepEqual(context.lsGet("fresh"), { ok: true });
  assert.equal(context.lsGet("future"), null);
  assert.equal(context.lsGet("bad"), null);
  assert.deepEqual(context.getStaleCache("old").d, { stale: true });
  assert.equal(context.getStaleCache("future"), null);

  context.cleanOldCacheSync();
  assert.ok(storage.dash_v15_fresh);
  assert.equal(storage.dash_v15_future, undefined);
  assert.equal(storage.dash_v15_bad, undefined);
  assert.equal(storage.dash_v15_old, undefined);
  assert.equal(storage.dash_v15_corrupt, undefined);
});

test("fetch helpers stop proxy retries when the caller aborts", async () => {
  let calls = 0;
  let activeController = null;
  const context = vm.createContext({
    AbortSignal,
    URL,
    URLSearchParams,
    Date,
    Map,
    Set,
    console: { log() {}, warn() {}, debug() {}, info() {} },
    location: { protocol: "https:", hostname: "dashboard.example", search: "" },
    localStorage: { getItem: () => null, setItem() {} },
    fetch: async () => {
      calls++;
      activeController.abort();
      throw activeController.signal.reason;
    },
  });
  context.window = context;
  vm.runInContext(await readFile("src/fetch.js", "utf8"), context);

  for (const method of ["fetchFirstOk", "fetchJsonFirstOk", "fetchTextFirstOk"]) {
    const controller = new AbortController();
    activeController = controller;
    calls = 0;
    await assert.rejects(
      context[method]("https://example.com/data", { signal: controller.signal }, 100, ["allorigins", "corsproxy"]),
      { name: "AbortError" },
    );
    assert.equal(calls, 1, `${method} must stop after the caller aborts the first request`);
  }

  const controller = new AbortController();
  let receivedOptions;
  context.fetch = async (_url, options) => { receivedOptions = options; return "ok"; };
  await context.fetchViaLocalProxy("https://example.com/data", { signal: controller.signal });
  assert.equal(receivedOptions.signal, controller.signal);
});

test("JSON and text fetch helpers share proxy cooldowns after HTTP 429", async () => {
  const requests = [];
  let rateLimitAllOrigins = true;
  let rateLimitCorsproxy = false;
  const context = vm.createContext({
    AbortSignal,
    URL,
    URLSearchParams,
    Date,
    Map,
    Set,
    console: { log() {}, warn() {}, debug() {}, info() {} },
    location: { protocol: "https:", hostname: "dashboard.example", search: "" },
    localStorage: { getItem: () => null, setItem() {} },
    fetch: async url => {
      requests.push(url);
      if (rateLimitAllOrigins && url.startsWith("https://api.allorigins.win/")) {
        rateLimitAllOrigins = false;
        return { status: 429, ok: false };
      }
      if (rateLimitCorsproxy && url.startsWith("https://corsproxy.io/")) {
        rateLimitCorsproxy = false;
        return { status: 429, ok: false };
      }
      return {
        status: 200,
        ok: true,
        async json() { return { success: true }; },
        async text() { return "success"; },
      };
    },
  });
  context.window = context;
  vm.runInContext(await readFile("src/fetch.js", "utf8"), context);

  const sources = ["allorigins", "corsproxy", "codetabs"];
  assert.deepEqual(await context.fetchJsonFirstOk("https://example.com/data", {}, 100, sources), { success: true });
  assert.equal(requests.length, 2);
  assert.ok(requests[0].startsWith("https://api.allorigins.win/"));
  assert.ok(requests[1].startsWith("https://corsproxy.io/"));

  rateLimitCorsproxy = true;
  assert.equal(await context.fetchTextFirstOk("https://example.com/data", {}, 100, sources), "success");
  assert.equal(requests.length, 4);
  assert.ok(requests[2].startsWith("https://corsproxy.io/"));
  assert.ok(requests[3].startsWith("https://api.codetabs.com/"));

  assert.deepEqual(await context.fetchJsonFirstOk("https://example.com/data", {}, 100, sources), { success: true });
  assert.equal(requests.length, 5);
  assert.ok(requests[4].startsWith("https://api.codetabs.com/"));
});

test("proxy authorization failures are cooled down across fetches and page reloads", async () => {
  const requests = [];
  const sessionValues = new Map();
  const sessionStorage = {
    getItem: key => sessionValues.get(key) ?? null,
    setItem: (key, value) => sessionValues.set(key, value),
  };
  const makeContext = () => {
    const context = vm.createContext({
      AbortSignal, URL, URLSearchParams, Date, Map, Set,
      console: { log() {}, warn() {}, debug() {}, info() {} },
      location: { protocol: "https:", hostname: "dashboard.example", search: "" },
      localStorage: { getItem: () => null, setItem() {} },
      sessionStorage,
      fetch: async url => {
        requests.push(url);
        if (url.startsWith("https://corsproxy.io/")) return { status: 401, ok: false };
        return { status: 200, ok: true, async json() { return { ok: true }; } };
      },
    });
    context.window = context;
    vm.runInContext(source, context);
    return context;
  };
  const source = await readFile("src/fetch.js", "utf8");
  const firstTab = makeContext();
  const sources = ["corsproxy", "codetabs"];

  assert.deepEqual(await firstTab.fetchJsonFirstOk("https://example.com/data", {}, 100, sources), { ok: true });
  assert.equal(requests.length, 2);
  assert.ok(requests[0].startsWith("https://corsproxy.io/"));
  assert.ok(requests[1].startsWith("https://api.codetabs.com/"));

  const reloadedTab = makeContext();
  assert.deepEqual(await reloadedTab.fetchJsonFirstOk("https://example.com/other", {}, 100, sources), { ok: true });
  assert.equal(requests.length, 3);
  assert.ok(requests[2].startsWith("https://api.codetabs.com/"));
});

test("Yahoo Finance requests skip a known CORS-blocked direct source on hosted pages", async () => {
  const context = vm.createContext({
    URL, URLSearchParams, location: { protocol: "https:", hostname: "dashboard.example", search: "" },
    localStorage: { getItem: () => null },
  });
  context.window = context;
  vm.runInContext(await readFile("src/fetch.js", "utf8"), context);

  const plan = context.buildFetchPlan("https://query1.finance.yahoo.com/v8/finance/chart/ABC", ["direct", "allorigins", "corsproxy"]);
  assert.deepEqual(Array.from(plan, step => step.source), ["allorigins", "corsproxy"]);

  const cryptoPlan = context.buildFetchPlan("https://api.coingecko.com/api/v3/simple/price", ["direct", "allorigins"]);
  assert.deepEqual(Array.from(cryptoPlan, step => step.source), ["direct", "allorigins"]);
});

test("optional data gateway URL accepts only HTTPS and fixed API routes", async () => {
  const context = vm.createContext({
    URL, URLSearchParams,
    location: { protocol: "https:", hostname: "dashboard.example", search: "" },
    localStorage: { getItem: () => null },
  });
  context.window = context;
  vm.runInContext(await readFile("src/fetch.js", "utf8"), context);

  assert.equal(context.dataApiUrl("v1/crypto"), null);
  context.CFG = { DATA_API_BASE: "https://dash-data.example.workers.dev/" };
  assert.equal(context.dataApiUrl("v1/crypto"), "https://dash-data.example.workers.dev/v1/crypto");
  assert.equal(context.dataApiUrl("https://attacker.example"), null);
  context.CFG.DATA_API_BASE = "http://attacker.example";
  assert.equal(context.dataApiUrl("v1/crypto"), null);
});

test("proxy cooldown prevents queued concurrent requests from repeating an unauthorized proxy", async () => {
  let corsproxyRequests = 0;
  const context = vm.createContext({
    AbortSignal, URL, URLSearchParams, Date, Map, Set,
    console: { log() {}, warn() {}, debug() {}, info() {} },
    location: { protocol: "https:", hostname: "dashboard.example", search: "" },
    localStorage: { getItem: () => null, setItem() {} },
    sessionStorage: { getItem: () => null, setItem() {} },
    fetch: async url => {
      if (url.startsWith("https://corsproxy.io/")) {
        corsproxyRequests++;
        await new Promise(resolve => setTimeout(resolve, 5));
        return { status: 401, ok: false };
      }
      return { status: 200, ok: true, async json() { return { ok: true }; } };
    },
  });
  context.window = context;
  vm.runInContext(await readFile("src/fetch.js", "utf8"), context);

  await Promise.all(Array.from({ length: 6 }, (_, index) =>
    context.fetchJsonFirstOk(`https://example.com/data-${index}`, {}, 100, ["corsproxy", "codetabs"]),
  ));
  assert.equal(corsproxyRequests, 2, "at most the already-in-flight requests should reach the proxy");
});

test("heatmap tabs reuse previously mounted TradingView widgets", async () => {
  const source = await readFile("src/app.js", "utf8");
  const start = source.indexOf("const HMAP_CONFIGS={");
  const end = source.indexOf("/* Meteorologia movida", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const root = {
    children: [],
    appendChild(child) { this.children.push(child); },
  };
  const tabs = ["sp500", "crypto", "etf"].map(() => ({
    classList: {
      active: false,
      add() { this.active = true; },
      remove() { this.active = false; },
    },
  }));
  const mounted = [];
  const context = vm.createContext({
    document: {
      querySelectorAll: () => tabs,
      getElementById: id => id === "hmap-widget" ? root : null,
      createElement: () => ({ dataset: {}, hidden: false }),
    },
    mountLazyTradingView: (host, _url, config) => mounted.push({ host, config }),
  });

  vm.runInContext(source.slice(start, end), context);
  context.switchHmap("sp500", tabs[0]);
  const initialHost = root.children[0];
  context.switchHmap("crypto", tabs[1]);
  context.switchHmap("sp500", tabs[0]);

  assert.equal(mounted.length, 2);
  assert.equal(root.children.length, 2);
  assert.equal(root.children[0], initialHost);
  assert.equal(root.children[0].hidden, false);
  assert.equal(root.children[1].hidden, true);
  assert.equal(mounted[0].config.dataSource, "SPX500");
  assert.equal(mounted[1].config.dataSource, "Crypto");
});

test("notification panel is inert while closed and interactive while open", async () => {
  const source = await readFile("src/app.js", "utf8");
  const start = source.indexOf("function setNotificationsOpen(open) {");
  const end = source.indexOf("\n}\n", start) + 2;
  assert.notEqual(start, -1);
  assert.ok(end > start);

  const panel = {
    inert: true,
    attributes: {},
    classList: { toggle(name, enabled) { this[name] = enabled; } },
    setAttribute(name, value) { this.attributes[name] = value; },
  };
  const button = { attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
  const context = vm.createContext({
    document: { getElementById: id => id === "notifPanel" ? panel : button },
  });

  vm.runInContext(source.slice(start, end), context);
  context.setNotificationsOpen(true);
  assert.equal(panel.inert, false);
  assert.equal(panel.attributes["aria-hidden"], "false");
  assert.equal(button.attributes["aria-expanded"], "true");

  context.setNotificationsOpen(false);
  assert.equal(panel.inert, true);
  assert.equal(panel.attributes["aria-hidden"], "true");
  assert.equal(button.attributes["aria-expanded"], "false");
});
