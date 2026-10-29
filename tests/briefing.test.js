import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

async function loadBriefing({ weather, fuel, fuelEs, basket, inflation, euribor, now, city = "Lisboa", fuelLitres = "", notificationApi, previousVisit }) {
  const root = { innerHTML: "", dataset: {}, addEventListener() {} };
  const changes = { innerHTML: "", dataset: {}, addEventListener() {} };
  const updated = { textContent: "" };
  const impact = { textContent: "" };
  const makeInput = value => ({ value, dataset: {}, addEventListener(event, handler) {
    const prior = this.handler;
    this.handler = prior ? () => { prior(); handler(); } : handler;
  } });
  const input = makeInput(fuelLitres);
  const costIncome = makeInput("");
  const costFood = makeInput("");
  const costElectricity = makeInput("");
  const costOutput = { textContent: "" };
  const threshold = { value: "1.50", dataset: {}, addEventListener(event, handler) { this.handler = handler; } };
  const toggle = { dataset: {}, addEventListener(event, handler) { this.handler = handler; }, setAttribute(name, value) { this[name] = value; } };
  const desktopToggle = { dataset: {}, addEventListener(event, handler) { this.handler = handler; }, setAttribute(name, value) { this[name] = value; } };
  const status = { textContent: "" };
  const preferences = Object.fromEntries(["Weather", "Fuel", "Basket", "Inflation", "Euribor"].map(name => [
    "briefingPref" + name, { checked: true, dataset: {}, addEventListener(event, handler) { this.handler = handler; } },
  ]));
  const elements = { briefingBody: root, briefingChanges: changes, briefingUpdated: updated, fuelMonthlyLitres: input, fuelMonthlyCost: impact, fuelAlertThreshold: threshold, fuelAlertToggle: toggle, fuelDesktopToggle: desktopToggle, fuelAlertStatus: status, costMonthlyIncome: costIncome, costMonthlyFood: costFood, costMonthlyElectricity: costElectricity, costOfLivingResult: costOutput, ...preferences };
  const store = new Map();
  if (previousVisit) store.set("dash_v15_briefing_last_visit_v1", JSON.stringify(previousVisit));
  let pagehideHandler = null;
  const notices = [];
  const context = vm.createContext({
    Date, Intl, Number, String, Math, Array, Notification: notificationApi,
    document: { getElementById: id => elements[id] || null },
    CFG: { IPMA_CITY_ID: 1060300 },
    IPMA_CITIES: { 1060300: city },
    lsGet: key => key.startsWith("ipma_") ? weather : key === "fuel" ? fuel : key === "fuel_es" ? fuelEs :
      key === "inflation_eurostat_v2" ? inflation : key === "euribor_live_v1" ? euribor : null,
    getCacheMeta: () => null,
    fmtAgeShort: age => `${Math.round(age / 3600000)}h`,
    getCabazBriefingData: () => basket,
    localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) },
    addNotification: (...args) => notices.push(args),
    window: {},
    addEventListener: (event, handler) => { if (event === "pagehide") pagehideHandler = handler; },
  });
  context.window = context;
  vm.runInContext(await readFile("src/cards/briefing.js", "utf8"), context);
  context.renderPortugalBriefing(now);
  return { html: root.innerHTML, root, changes: changes.innerHTML, updated: updated.textContent, impact: impact.textContent, impactEl: impact, input, costIncome, costFood, costElectricity, costOutput, threshold, toggle, desktopToggle, preferences, status, store, notices, pagehideHandler };
}

test("Portugal briefing includes only dated recent observations and escapes provider text", async () => {
  const now = Date.parse("2026-10-29T11:00:00Z");
  const result = await loadBriefing({
    now,
    weather: { dataUpdate: new Date(now - 3600000).toISOString(), data: [{ forecastDate: "2026-10-29", tMax: "26.4", precipitaProb: "10" }] },
    fuel: [{ fuel_slug: "gasoline_95", avg_price_eur: 1.72, station_count: 187, updated_at: new Date(now - 7200000).toISOString() }],
    fuelEs: { ts: now - 3600000, fecha: "28/10/2026", items: { gasoline_95: { avg: 1.61, n: 1200 } } },
    inflation: { source: "eurostat_live", rows: [{ m: "Set 2026", pt: 3.6, eu: 3.8 }, { m: "Ago 2026", pt: 3.6, eu: 3.2 }] },
    euribor: { _source: "bce_live", updated: "out. de 2026", rates: [{ term: "3M", val: 2.682 }, { term: "12M", val: 3.326 }] },
    basket: [["2026-10-21", 253.99], ["2026-10-28", 253.55]],
    fuelLitres: "100",
    city: '<img src=x onerror="alert(1)">',
  });
  assert.match(result.html, /Meteorologia/);
  assert.ok(result.html.includes("Gasolina 95 · 1,720 €/L"));
  assert.ok(result.html.includes("+€0,110/L vs Espanha"));
  assert.match(result.html, /−€0,44 face ao registo anterior/);
  assert.ok(result.html.includes("Observação 28/10/2026"));
  assert.ok(result.html.includes("Inflação · IHPC"));
  assert.ok(result.html.includes("-0,2 pp vs zona euro"));
  assert.ok(result.html.includes("0,0 pp face ao mês anterior"));
  assert.ok(result.html.includes("Euribor"));
  assert.ok(result.html.includes("3M 2,682% · 12M 3,326%"));
  assert.ok(result.html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert.ok(!result.html.includes("<img"));
  assert.match(result.updated, /Síntese gerada/);
  assert.match(result.impact, /172,00/);
  result.input.value = "120";
  result.input.handler();
  assert.match(result.impactEl.textContent, /206,40/);
  result.input.value = "6000";
  result.input.handler();
  assert.match(result.impactEl.textContent, /Indique 1–5 000 litros/);
});

test("fuel price alert is opt-in, thresholded, and deduplicated by observation", async () => {
  const now = Date.parse("2026-10-29T11:00:00Z");
  const result = await loadBriefing({
    now,
    fuel: [{ fuel_slug: "gasoline_95", avg_price_eur: 1.42, updated_at: new Date(now - 3600000).toISOString() }],
  });
  assert.equal(result.notices.length, 0);
  assert.equal(result.toggle["aria-pressed"], "false");
  result.toggle.handler();
  assert.equal(result.notices.length, 1);
  assert.equal(result.notices[0][0], "energy");
  assert.equal(result.store.get("dash_v15_fuel_alert_v1") !== undefined, true);
  result.toggle.handler();
  result.toggle.handler();
  assert.equal(result.notices.length, 1);
  assert.match(result.status.textContent, /Ativo/);
});

test("Portugal briefing indicators can be selected locally", async () => {
  const now = Date.parse("2026-10-29T11:00:00Z");
  const result = await loadBriefing({
    now,
    fuel: [{ fuel_slug: "gasoline_95", avg_price_eur: 1.72, updated_at: new Date(now - 3600000).toISOString() }],
    basket: [["2026-10-21", 253], ["2026-10-28", 254]],
  });
  assert.match(result.html, /Gasolina 95/);
  result.preferences.briefingPrefFuel.checked = false;
  result.preferences.briefingPrefFuel.handler();
  assert.deepEqual(JSON.parse(result.store.get("dash_v15_briefing_preferences_v1")), ["weather", "basket", "inflation", "euribor"]);
  assert.doesNotMatch(result.root.innerHTML, /Gasolina 95/);
  assert.match(result.root.innerHTML, /Cabaz alimentar/);
  assert.deepEqual(JSON.parse(result.store.get("dash_v15_briefing_preferences_v1")).includes("fuel"), false);
});

test("desktop fuel notifications require a user click and browser permission", async () => {
  const shown = [];
  class NotificationApi {
    static permission = "default";
    static async requestPermission() { this.permission = "granted"; return this.permission; }
    constructor(title, options) { shown.push({ title, options }); }
  }
  const now = Date.parse("2026-10-29T11:00:00Z");
  const result = await loadBriefing({
    now, notificationApi: NotificationApi,
    fuel: [{ fuel_slug: "gasoline_95", avg_price_eur: 1.42, updated_at: new Date(now - 3600000).toISOString() }],
  });
  assert.equal(shown.length, 0);
  await result.desktopToggle.handler();
  result.toggle.handler();
  assert.equal(shown.length, 1);
  assert.equal(shown[0].title, "Gasolina 95 abaixo do limite");
});

test("Portugal briefing omits expired observations instead of presenting stale values as current", async () => {
  const now = Date.parse("2026-10-29T11:00:00Z");
  const result = await loadBriefing({
    now,
    weather: { dataUpdate: "2026-10-20T10:00:00Z", data: [{ forecastDate: "2026-10-20", tMax: 24 }] },
    fuel: [{ fuel_slug: "gasoline_95", avg_price_eur: 1.72, updated_at: "2026-10-20T10:00:00Z" }],
    basket: [["2026-10-01", 252], ["2026-10-07", 253]],
    fuelLitres: "100",
  });
  assert.ok(!["26°C", "1,720 €/L", "€253,00"].some(value => result.html.includes(value)));
  assert.match(result.html, /Ainda não há observações recentes suficientes/);
  assert.match(result.impact, /Preço atual indisponível/);
});

test("Portugal briefing rejects provider timestamps and manual basket dates in the future", async () => {
  const now = Date.parse("2026-10-29T11:00:00Z");
  const result = await loadBriefing({
    now,
    weather: { dataUpdate: "2026-10-30T10:00:00Z", data: [{ forecastDate: "2026-10-30", tMax: 28 }] },
    fuel: [{ fuel_slug: "gasoline_95", avg_price_eur: 1.8, updated_at: "2026-10-30T10:00:00Z" }],
    basket: [["2026-10-21", 253], ["2026-10-30", 254]],
  });
  assert.match(result.html, /Ainda não há observações recentes suficientes/);
  assert.ok(!["28°C", "1,800 €/L", "€254,00"].some(value => result.html.includes(value)));
});

test("Portugal briefing compares fresh observations with the previous visit and saves on page hide", async () => {
  const now = Date.parse("2026-10-29T11:00:00Z");
  const result = await loadBriefing({
    now,
    previousVisit: { savedAt: now - 86400000, observations: {
      fuel: { snapshot: 1750, value: "Gasolina 95 · 1,750 €/L" },
    } },
    fuel: [{ fuel_slug: "gasoline_95", avg_price_eur: 1.72, updated_at: new Date(now - 3600000).toISOString() }],
  });
  assert.match(result.changes, /Alterações desde a visita anterior/);
  assert.ok(result.changes.includes("1,750 €/L → Gasolina 95 · 1,720 €/L"));
  result.pagehideHandler();
  const saved = JSON.parse(result.store.get("dash_v15_briefing_last_visit_v1"));
  assert.equal(saved.observations.fuel.snapshot, 1720);
  assert.ok(Number.isFinite(saved.savedAt) && saved.savedAt > 0);
});

test("visit summary suppresses insignificant changes and local budget math never persists inputs", async () => {
  const now = Date.parse("2026-10-29T11:00:00Z");
  const result = await loadBriefing({
    now,
    fuelLitres: "100",
    previousVisit: { observations: { fuel: { snapshot: 1715, value: "Gasolina 95 · 1,715 €/L" } } },
    fuel: [{ fuel_slug: "gasoline_95", avg_price_eur: 1.72, updated_at: new Date(now - 3600000).toISOString() }],
  });
  assert.match(result.changes, /Sem alterações relevantes/);
  result.costIncome.value = "2200";
  result.costFood.value = "450";
  result.costElectricity.value = "75";
  result.costIncome.handler();
  assert.match(result.costOutput.textContent, /697,00/);
  assert.match(result.costOutput.textContent, /31,7%/);
  assert.equal([...result.store.keys()].some(key => /costMonthly|costOfLiving/.test(key)), false);
});
