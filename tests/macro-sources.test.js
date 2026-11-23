import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import "./nf-context.js";

async function loadScript(path, extra = {}) {
  const context = vm.createContext({ console: { log() {}, warn() {}, info() {} }, localStorage: { getItem: () => null }, ...extra });
  context.window = context;
  vm.runInContext(await readFile(path, "utf8"), context);
  return context;
}

test("US Treasury daily curve yields the 10Y-2Y spread in chronological order", async () => {
  const { parseTreasuryCurve } = await loadScript("src/cards/recession.js");
  const csv = await readFile(new URL("./fixtures/us-treasury-curve.csv", import.meta.url), "utf8");
  const rows = parseTreasuryCurve(csv);
  assert.ok(rows.length >= 4);
  assert.ok(rows.every((row, i) => i === 0 || row[0] > rows[i - 1][0]));
  assert.equal(JSON.stringify(rows.at(-1)), JSON.stringify(["2026-11-19", 0.28]));
  assert.equal(parseTreasuryCurve("not,a,curve\n1,2,3").length, 0);
});

test("inflation reads the ECOICOP v2 HICP dataset (PRC_HICP_MINR) for Portugal and the euro area", async () => {
  let requested = "";
  const context = await loadScript("src/cards/inflation.js", {
    AbortSignal,
    INFLATION_FALLBACK: [{ m: "Dez 2025", pt: 2, eu: 2 }, { m: "Nov 2025", pt: 2, eu: 2 }, { m: "Out 2025", pt: 2, eu: 2 }],
    lsGet: () => null,
    lsSet() {},
    $: () => ({ innerHTML: "" }),
    fetchJsonFirstOk: async (url, _o, _t, _s, validate) => {
      requested = url;
      const json = JSON.parse(await readFile(new URL("./fixtures/eurostat-prc-hicp-minr.json", import.meta.url), "utf8"));
      assert.ok(validate(json));
      return json;
    },
  });
  const rows = context.parseEurostatInflation(JSON.parse(await readFile(new URL("./fixtures/eurostat-prc-hicp-minr.json", import.meta.url), "utf8")));
  assert.equal(rows[0].m, "Out 2026");
  assert.equal(rows[0].pt, 3.9);
  assert.equal(rows[0].eu, 4.0);
  await context.initInflation(true);
  assert.match(requested, /PRC_HICP_MINR/);
  assert.match(requested, /unit=RCH_A/);
  assert.match(requested, /coicop18=TOTAL/);
});
