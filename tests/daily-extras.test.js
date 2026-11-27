import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import "./nf-context.js";

async function load(file) {
  const context = vm.createContext({ Date, Math, JSON, String, Number, Object, Array, Set, console, AbortSignal });
  context.window = context;
  vm.runInContext(await readFile(file, "utf8"), context);
  return context;
}
const plain = v => JSON.parse(JSON.stringify(v));
const hm = (ms, tz = "Europe/Lisbon") => new Date(ms).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: tz });
const minutes = s => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const near = (actual, expected, tol = 2) => assert.ok(Math.abs(minutes(actual) - minutes(expected)) <= tol, `${actual} vs ${expected}`);

test("sunrise and sunset match published times within 2 minutes", async () => {
  const { sunTimes } = await load("src/cards/weather.js");
  // Referência: Open-Meteo (daily=sunrise,sunset), consultado a 27-11-2026.
  const lis = sunTimes(new Date(2026, 10, 27), 38.72, -9.14);
  near(hm(lis.rise), "07:31");
  near(hm(lis.set), "17:16");
  const fun = sunTimes(new Date(2026, 10, 27), 32.67, -16.92);
  near(hm(fun.rise, "Atlantic/Madeira"), "07:48");
  near(hm(fun.set, "Atlantic/Madeira"), "18:02");
  // Lisboa, solstício de verão (hora de verão): nasce ~06:12, põe-se ~21:05.
  const jun = sunTimes(new Date(2027, 5, 21), 38.72, -9.14);
  near(hm(jun.rise), "06:12");
  near(hm(jun.set), "21:05");
  // Dias mais curtos em dezembro do que em junho.
  assert.ok(lis.dayMs < jun.dayMs);
});

test("pollen summary takes the 24 h maximum and levels it; missing series gives null", async () => {
  const { pollenSummary } = await load("src/cards/air-quality.js");
  const hourly = {
    grass_pollen: [0, 3, 30, 2], olive_pollen: [0, 0, 0, 0], birch_pollen: [null, 600, 0, 0],
    alder_pollen: [0, 0, 0, 0], mugwort_pollen: [0, 0, 0, 0], ragweed_pollen: [0, 0, 0, 0],
  };
  const rows = plain(pollenSummary(hourly, 0));
  assert.deepEqual(rows.find(r => r.key === "grass_pollen"), { key: "grass_pollen", label: "Gramíneas", max: 30, level: 2 });
  assert.equal(rows.find(r => r.key === "birch_pollen").level, 3);
  assert.equal(rows.find(r => r.key === "olive_pollen").level, -1);
  // A partir da hora 2: o pico de bétula (hora 1) já passou.
  assert.equal(plain(pollenSummary(hourly, 2)).find(r => r.key === "birch_pollen").level, -1);
  assert.equal(pollenSummary({ time: [] }, 0), null);
});

test("school calendar 2026/27: next break, current break and end of classes", async () => {
  const { schoolCalendarStatus } = await load("src/cards/holidays.js");
  const nov = plain(schoolCalendarStatus(new Date(2026, 10, 27)));
  assert.equal(nov.current, null);
  assert.equal(nov.next.name, "Férias de Natal");
  assert.equal(nov.next.days, 19);
  assert.equal(nov.ends.length, 3);

  const xmas = plain(schoolCalendarStatus(new Date(2026, 11, 28)));
  assert.equal(xmas.current.name, "Férias de Natal");
  assert.equal(xmas.current.backIn, 7); // aulas a 4 de janeiro
  assert.equal(xmas.next.name, "Carnaval");

  const jun = plain(schoolCalendarStatus(new Date(2027, 5, 8)));
  assert.equal(jun.next, null);
  assert.deepEqual(jun.ends.map(e => e.date), ["2027-06-11", "2027-06-30"]);

  assert.equal(schoolCalendarStatus(new Date(2027, 6, 15)), null); // fora do ano letivo conhecido
  assert.ok(plain(schoolCalendarStatus(new Date(2026, 6, 20))).beforeStart); // verão antes do arranque
});
