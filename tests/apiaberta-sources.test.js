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
