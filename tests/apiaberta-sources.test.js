import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

async function loadScript(path) {
  const context = vm.createContext({ console: { log() {}, warn() {}, info() {} }, localStorage: { getItem: () => null } });
  context.window = context;
  vm.runInContext(await readFile(path, "utf8"), context);
  return context;
}

test("IPMA seismic events become card features, newest first, skipping incomplete rows", async () => {
  const { ipmaToFeatures } = await loadScript("src/cards/seis.js");
  const features = ipmaToFeatures([
    { time: "2026-11-19T16:01:06.000Z", lat: 37.132, lon: -24.555, depth_km: 3, magnitude: 2, region: "acores", obs_region: "SE  Ilhéus das Formigas" },
    { time: "2026-11-20T08:58:06.000Z", lat: 38.033, lon: -9.5, depth_km: 15, magnitude: 3.4, region: "continente-madeira", obs_region: "W  Sines" },
    { time: "2026-11-20T09:00:00.000Z", lat: 38, lon: -9, depth_km: 5, magnitude: null, region: "continente-madeira" },
  ]);
  assert.equal(features.length, 2);
  assert.equal(features[0].properties.mag, 3.4);
  assert.equal(features[0].properties.place, "W Sines · Continente/Madeira");
  assert.equal(features[0].properties.net, "ipma");
  assert.deepEqual(Array.from(features[0].geometry.coordinates), [-9.5, 38.033, 15]);
  assert.equal(features[1].properties.place, "SE Ilhéus das Formigas · Açores");
  assert.equal(features[0].properties.time, Date.parse("2026-11-20T08:58:06.000Z"));
});

test("Banco de Portugal rates are parsed and rejected when key ECB rates are missing", async () => {
  const { parseBdpRates } = await loadScript("src/cards/euribor.js");
  const rates = { data: [
    { key: "ecb_mro", value: 2.65, ref_date: "2026-11-18" },
    { key: "ecb_deposit", value: 2.5, ref_date: "2026-11-19" },
    { key: "ecb_marginal_lending", value: 2.9, ref_date: "2026-11-19" },
  ] };
  const lending = { data: [{ key: "housing_loans", value: 3.06, ref_date: "2026-09-30" }] };
  const parsed = parseBdpRates(rates, lending);
  assert.equal(parsed.dep, 2.5);
  assert.equal(parsed.refin, 2.65);
  assert.equal(parsed.refDate, "2026-11-19");
  assert.equal(parsed.housing.value, 3.06);
  assert.equal(parseBdpRates(rates, null).housing, null);
  assert.equal(parseBdpRates({ data: [{ key: "ecb_mro", value: 2.65 }] }, lending), null);
});

test("IPMA warnings keep only active non-green levels, most severe first", async () => {
  const { activeWarnings } = await loadScript("src/cards/weather.js");
  const now = Date.parse("2026-11-21T08:00:00");
  const list = activeWarnings([
    { awarenessLevelID: "green", idAreaAviso: "VIS", startTime: "2026-11-21T06:00:00", endTime: "2026-11-21T18:00:00" },
    { awarenessLevelID: "yellow", idAreaAviso: "VIS", startTime: "2026-11-21T03:00:00", endTime: "2026-11-21T06:00:00" },
    { awarenessLevelID: "yellow", idAreaAviso: "BGC", startTime: "2026-11-21T06:00:00", endTime: "2026-11-21T18:00:00" },
    { awarenessLevelID: "orange", idAreaAviso: "VIS", startTime: "2026-11-21T06:00:00", endTime: "2026-11-21T18:00:00" },
  ], now);
  assert.equal(JSON.stringify(list.map(w => `${w.awarenessLevelID}:${w.idAreaAviso}`)), JSON.stringify(["orange:VIS", "yellow:BGC"]));
});

test("fire risk is summarised per district by the highest municipal level", async () => {
  const { riskByDistrict } = await loadScript("src/cards/civil-protection.js");
  const rows = riskByDistrict([
    { district: "Lisboa", level: 1 }, { district: "Lisboa", level: 3 },
    { district: "Faro", level: 2 }, { district: "Faro", level: 9 }, { level: 4 },
  ]);
  assert.equal(JSON.stringify(rows.map(r => [r.district, r.level, r.municipalities])), JSON.stringify([["Lisboa", 3, 2], ["Faro", 2, 1]]));
});

test("Carris alerts are split by municipality and strikes come first", async () => {
  const { normalizeCarrisAlerts } = await loadScript("src/cards/transport.js");
  const alerts = normalizeCarrisAlerts([
    { header_pt: "Loures | 2539 - Condicionamento", effect: "SIGNIFICANT_DELAYS", cause: "CONSTRUCTION", active: true },
    { header_pt: "Oeiras | 1113: Desvio", effect: "DETOUR", cause: "CONSTRUCTION", active: true },
    { header_pt: "Greve geral", effect: "REDUCED_SERVICE", cause: "STRIKE", active: true },
    { header_pt: "Seixal | antigo", effect: "DETOUR", cause: "OTHER_CAUSE", active: false },
    { header_pt: "Linhas 2926 | Desvio", effect: "DETOUR", cause: "CONSTRUCTION", active: true },
  ]);
  assert.equal(alerts.find(a => a.title.startsWith("Linhas 2926")).municipality, "Área metropolitana");
  assert.equal(JSON.stringify(alerts.map(a => a.municipality)), JSON.stringify(["Área metropolitana", "Área metropolitana", "Oeiras", "Loures"]));
  assert.equal(alerts[0].strike, true);
  assert.equal(alerts[0].effect, "Serviço reduzido");
  assert.equal(alerts[3].title, "2539 - Condicionamento");
});
