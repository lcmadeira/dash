import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import "./nf-context.js";

const ecbSeries = (values) => ({
  structure: { dimensions: { observation: [{ values: values.map(([period]) => ({ id: period })) }], series: [] } },
  dataSets: [{ series: { "0:0:0:0:0:0": { observations: Object.fromEntries(values.map(([, v], i) => [String(i), [v]])) } } }],
});

test("Euribor loads ECB monthly averages with the RT keys and without the discontinued 1-week tenor", async () => {
  const requested = [];
  const body = { innerHTML: "" };
  const ref = { textContent: "" };
  let saved = null;
  const byTenor = { EURIBOR1MD_: 2.436, EURIBOR3MD_: 2.635, EURIBOR6MD_: 2.975, EURIBOR1YD_: 3.239 };
  const context = vm.createContext({
    AbortSignal, URLSearchParams, Intl,
    PFX: "dash_",
    console: { log() {}, warn() {} },
    location: { search: "" },
    localStorage: { getItem: () => null },
    document: { getElementById: id => (id === "euri-body" ? body : id === "euriborRefDate" ? ref : null) },
    addToHistory() {},
    lsGet: () => null,
    lsSet: (key, value) => { if (key === "euribor_live_v1") saved = value; },
    fetchJsonFirstOk: async () => { throw new Error("BdP offline"); },
    fetch: async url => {
      requested.push(String(url));
      const tenor = Object.keys(byTenor).find(k => String(url).includes(k));
      if (!tenor) return new Response("{}", { status: 404 });
      return Response.json(ecbSeries([["2026-09", byTenor[tenor] - 0.05], ["2026-10", byTenor[tenor]]]));
    },
  });
  context.window = context;
  vm.runInContext(await readFile("src/config.js", "utf8"), context);
  vm.runInContext(await readFile("src/cards/euribor.js", "utf8"), context);
  await context.initEuribor(true);

  assert.equal(requested.length, 4);
  assert.ok(requested.every(url => url.includes(".RT.MM.")));
  assert.ok(!requested.some(url => url.includes("EURIBOR1WD_")));
  assert.equal(saved._source, "bce_live");
  assert.equal(JSON.stringify(saved.rates.map(r => [r.term, r.val])), JSON.stringify([["1M", 2.436], ["3M", 2.635], ["6M", 2.975], ["12M", 3.239]]));
  assert.match(body.innerHTML, /3,239/);
  assert.doesNotMatch(body.innerHTML, /1 Semana|NaN|undefined/);
});

test("Euribor card prefers the gateway and skips the slow direct ECB requests", async () => {
  const requested = [];
  const body = { innerHTML: "" };
  let saved = null;
  const rows = v => [{ period: "2026-09", value: v - 0.05 }, { period: "2026-10", value: v }];
  const context = vm.createContext({
    AbortSignal, URLSearchParams, Intl,
    PFX: "dash_",
    console: { log() {}, warn() {} },
    location: { search: "" },
    localStorage: { getItem: () => null },
    document: { getElementById: id => (id === "euri-body" ? body : null) },
    addToHistory() {},
    lsGet: () => null,
    lsSet: (key, value) => { if (key === "euribor_live_v1") saved = value; },
    dataApiUrl: route => `https://gateway.example/${route}`,
    fetchJsonFirstOk: async url => {
      requested.push(url);
      if (url.endsWith("v1/euribor")) return { series: { "1M": rows(2.436), "3M": rows(2.635), "6M": rows(2.975), "12M": rows(3.239) } };
      throw new Error("offline");
    },
    fetch: async url => { requested.push(String(url)); throw new Error("direct ECB should not be called"); },
  });
  context.window = context;
  vm.runInContext(await readFile("src/config.js", "utf8"), context);
  vm.runInContext(await readFile("src/cards/euribor.js", "utf8"), context);
  await context.initEuribor(true);
  assert.ok(requested.includes("https://gateway.example/v1/euribor"));
  assert.ok(!requested.some(u => u.includes("data-api.ecb.europa.eu")));
  assert.equal(saved.rates.find(r => r.term === "12M").val, 3.239);
});

test("ECB meeting block uses the official calendar and the static expectations only for their meeting", async () => {
  const context = vm.createContext({ console: { log() {}, warn() {} }, localStorage: { getItem: () => null } });
  context.window = context;
  const calendar = await readFile("src/widgets/economic-calendar.js", "utf8");
  vm.runInContext(calendar.split("\n").filter(line => /^const BCE_DATES_|^window\.ECB_MEETING_DATES/.test(line)).join("\n"), context);
  vm.runInContext(await readFile("src/cards/euribor.js", "utf8"), context);
  assert.equal(context.parsePtDate("29 Out 2026"), "2026-10-29");
  assert.equal(context.parsePtDate("sem data"), null);
  assert.equal(context.nextEcbMeeting("2026-11-20"), "2026-12-17");
  assert.equal(context.nextEcbMeeting("2026-10-29"), "2026-10-29");
});
