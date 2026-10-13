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
