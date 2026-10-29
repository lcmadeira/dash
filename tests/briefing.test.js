import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

async function loadBriefing({ weather, fuel, basket, inflation, euribor, now, city = "Lisboa" }) {
  const root = { innerHTML: "" };
  const updated = { textContent: "" };
  const context = vm.createContext({
    Date, Intl, Number, String, Math, Array,
    document: { getElementById: id => id === "briefingBody" ? root : id === "briefingUpdated" ? updated : null },
    CFG: { IPMA_CITY_ID: 1060300 },
    IPMA_CITIES: { 1060300: city },
    lsGet: key => key.startsWith("ipma_") ? weather : key === "fuel" ? fuel :
      key === "inflation_eurostat_v2" ? inflation : key === "euribor_live_v1" ? euribor : null,
    getCacheMeta: () => null,
    fmtAgeShort: age => `${Math.round(age / 3600000)}h`,
    getCabazBriefingData: () => basket,
    window: {},
  });
  context.window = context;
  vm.runInContext(await readFile("src/cards/briefing.js", "utf8"), context);
  context.renderPortugalBriefing(now);
  return { html: root.innerHTML, updated: updated.textContent };
}

test("Portugal briefing includes only dated recent observations and escapes provider text", async () => {
  const now = Date.parse("2026-10-29T11:00:00Z");
  const result = await loadBriefing({
    now,
    weather: { dataUpdate: new Date(now - 3600000).toISOString(), data: [{ forecastDate: "2026-10-29", tMax: "26.4", precipitaProb: "10" }] },
    fuel: [{ fuel_slug: "gasoline_95", avg_price_eur: 1.72, station_count: 187, updated_at: new Date(now - 7200000).toISOString() }],
    inflation: { source: "eurostat_live", rows: [{ m: "Set 2026", pt: 3.6, eu: 3.8 }, { m: "Ago 2026", pt: 3.6, eu: 3.2 }] },
    euribor: { _source: "bce_live", updated: "out. de 2026", rates: [{ term: "3M", val: 2.682 }, { term: "12M", val: 3.326 }] },
    basket: [["2026-10-21", 253.99], ["2026-10-28", 253.55]],
    city: '<img src=x onerror="alert(1)">',
  });
  assert.match(result.html, /Meteorologia/);
  assert.ok(result.html.includes("Gasolina 95 · 1,720 €/L"));
  assert.match(result.html, /−€0,44 face ao registo anterior/);
  assert.ok(result.html.includes("Observação 28/10/2026"));
  assert.ok(result.html.includes("Inflação · IHPC"));
  assert.ok(result.html.includes("-0,2 pp vs zona euro"));
  assert.ok(result.html.includes("Euribor"));
  assert.ok(result.html.includes("3M 2,682% · 12M 3,326%"));
  assert.ok(result.html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert.ok(!result.html.includes("<img"));
  assert.match(result.updated, /Síntese gerada/);
});

test("Portugal briefing omits expired observations instead of presenting stale values as current", async () => {
  const now = Date.parse("2026-10-29T11:00:00Z");
  const result = await loadBriefing({
    now,
    weather: { dataUpdate: "2026-10-20T10:00:00Z", data: [{ forecastDate: "2026-10-20", tMax: 24 }] },
    fuel: [{ fuel_slug: "gasoline_95", avg_price_eur: 1.72, updated_at: "2026-10-20T10:00:00Z" }],
    basket: [["2026-10-01", 252], ["2026-10-07", 253]],
  });
  assert.ok(!["26°C", "1,720 €/L", "€253,00"].some(value => result.html.includes(value)));
  assert.match(result.html, /Ainda não há observações recentes suficientes/);
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
