import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

async function loadHelpers() {
  const context = vm.createContext({ Date, Intl, Math, Number, Object, Array, String, JSON, RegExp, window: {} });
  context.window = context;
  vm.runInContext(await readFile("src/cards/elec.js", "utf8"), context);
  return context.ELEC_TEST;
}

test("electricity helpers validate OMIE Portugal series and preserve 15-minute units", async () => {
  const helpers = await loadHelpers();
  const periods = Array.from({ length: 96 }, (_, index) => ({ period: index + 1, priceMwh: 100 }));
  assert.equal(helpers.isValidPeriods({ date: "2026-11-02", periods }), true);
  assert.equal(helpers.isValidPeriods({ date: "2026-11-02", periods: periods.slice(0, 24) }), true);
  assert.equal(helpers.isValidPeriods({ date: "2026-11-02", periods: periods.slice(1) }), false);

  const cheapest = helpers.findCheapestWindow(periods.map((period, index) => ({
    ...period,
    priceMwh: index >= 44 && index < 56 ? 10 : 100,
  })));
  assert.equal(cheapest.start, 44);
  assert.equal(cheapest.end, 56);
  assert.equal(cheapest.periodsPerHour, 4);
  assert.equal(helpers.marketPeriodTime(45, 96), "11:15");
  assert.equal(helpers.getMarketIndex(new Date("2026-11-02T10:30:00Z"), 96), 46);
  assert.equal(helpers.average([50, 150]), 100);
});

test("OMIE parser rejects incomplete, wrong-date, or non-finite daily data", async () => {
  const helpers = await loadHelpers();
  const lines = Array.from({ length: 24 }, (_, index) =>
    `2026;11;02;${index + 1};${index === 3 ? "NaN" : index + 1};${index + 1};`,
  );
  const fixture = `MARGINALPDBCPT;\n${lines.join("\n")}\n*\n`;
  assert.equal(helpers.parseOmieText(fixture, "2026-11-02"), null);
  assert.equal(helpers.parseOmieText(fixture.replace("NaN", "4"), "2026-11-03"), null);
  const valid = helpers.parseOmieText(fixture.replace("NaN", "4"), "2026-11-02");
  assert.equal(valid.periods.length, 24);
  assert.equal(valid.periods[3].priceMwh, 4);
});

test("electricity card renders Portuguese zone, correct 3-hour window and contract-only estimate", async () => {
  const storage = new Map();
  const elements = new Map();
  const body = { innerHTML: "" };
  for (const id of ["elecTrendStatus", "elecTrendDays", "elecTrendCanvas", "elecEstimateKwh", "elecEstimateRate", "elecEstimatePower", "elecEstimateResult"]) {
    elements.set(id, { value: "", textContent: "", _chart: null });
  }
  elements.get("elecEstimateKwh").value = "250";
  elements.get("elecEstimateRate").value = "0.20";
  elements.get("elecEstimatePower").value = "0.30";
  const context = vm.createContext({
    Date, Intl, Math, Number, Object, Array, String, JSON, RegExp, Promise, console,
    PFX: "dash_",
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    document: { getElementById: id => elements.get(id) || null },
    $: id => id === "elec-body" ? body : null,
    skeletonKPIs: () => "loading",
    getStaleCache: () => null,
    lsGet: () => null,
    lsSet: (key, value) => storage.set(key, JSON.stringify({ d: value, ts: Date.now() })),
    getHistory: () => [],
    renderTrendChart: () => {},
    _setOnByDataAttr: () => {},
    addToHistory: () => [],
    fmtAgeShort: () => "1 min",
    er: message => message,
    fetchJsonFirstOk: async (url, _options, _timeout, _sources, validate) => {
      assert.match(url, /\/v1\/electricity\?date=/);
      const date = new URL(url).searchParams.get("date");
      const periods = Array.from({ length: 96 }, (_, index) => ({
        period: index + 1,
        priceMwh: index >= 44 && index < 56 ? 10 : 100,
      }));
      const payload = { date, periods, _meta: { source: "OMIE" } };
      assert.equal(validate(payload), true);
      return payload;
    },
    window: { CFG: { DATA_API_BASE: "https://gateway.example" } },
  });
  context.window = context;
  context.CFG = { DATA_API_BASE: "https://gateway.example" };
  vm.runInContext(await readFile("src/cards/elec.js", "utf8"), context);
  await context.loadElec(false);

  assert.match(body.innerHTML, /OMIE · zona portuguesa/);
  assert.match(body.innerHTML, /Janela mais barata de 3h: <strong[^>]*>11:00–14:00 hora de mercado/);
  assert.doesNotMatch(body.innerHTML, /45h|48h|Tarifas ERSE 2025-2026/);
  assert.match(body.innerHTML, /O spot só afeta diretamente contratos indexados/);
  assert.match(elements.get("elecEstimateResult").textContent, /59,00 €\/mês antes de IVA e outros encargos\./);
  assert.equal(storage.has("dash_elec_estimate_v1"), true);
});
