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

test("recession chart never draws a negative-height clip when the spread stays on one side of zero", async () => {
  const render = async rows => {
    const el = { innerHTML: "" };
    const context = await loadScript("src/cards/recession.js", {
      $: id => (id === "rec-body" ? el : null),
      ld: () => "",
      lsGet: () => rows,
      lsSet() {},
      PFX: "t_",
      _lastN: (arr, n) => arr.slice(Math.max(0, arr.length - n)),
    });
    await context.loadRec(false);
    return el.innerHTML;
  };
  const days = n => Array.from({ length: n }, (_, i) => `2026-${String(9 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`);
  const positive = days(40).map((d, i) => [d, 0.4 + (i % 5) * 0.05]);
  const negative = days(40).map((d, i) => [d, -0.4 - (i % 5) * 0.05]);
  for (const html of [await render(positive), await render(negative)]) {
    const heights = [...html.matchAll(/<rect[^>]*height="(-?[\d.]+)"/g)].map(m => Number(m[1]));
    assert.equal(heights.length, 2);
    assert.ok(heights.every(h => h >= 0), `alturas: ${heights}`);
    assert.ok(!html.includes('stroke-dasharray="4,3"'), "linha zero fora do gráfico não deve ser desenhada");
  }
  const crossing = days(40).map((d, i) => [d, i < 20 ? -0.2 : 0.3]);
  assert.ok((await render(crossing)).includes('stroke-dasharray="4,3"'));
});
