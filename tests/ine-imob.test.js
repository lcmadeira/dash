import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import "./nf-context.js";
import { parseIneMedian, parseQuarter, summarizeImob } from "../scripts/lib/ine-imob.mjs";

test("INE quarterly labels and the 12-month median series are parsed in order", async () => {
  assert.deepEqual(parseQuarter("2.º Trimestre de 2026"), { key: 2026 * 4 + 2, period: "Q2 2026" });
  assert.equal(parseQuarter("2026"), null);
  const json = JSON.parse(await readFile(new URL("./fixtures/ine-0012234.json", import.meta.url), "utf8"));
  const series = parseIneMedian(json);
  assert.equal(series[0].period, "Q4 2019");
  const q22026 = series.find(s => s.period === "Q2 2026");
  assert.deepEqual([q22026.total, q22026.novos, q22026.existentes], [2264, 2476, 2208]);
  const latest = summarizeImob(series);
  assert.equal(latest.period, "Q2 2026");
  assert.equal(latest.chgYoY, 17.7);
  assert.equal(latest.newChgYoY, 9.2);
  assert.equal(latest.existChgYoY, 19.9);
});

test("committed imob snapshot is valid for the card", async () => {
  const data = JSON.parse(await readFile(new URL("../data/imob.json", import.meta.url), "utf8"));
  assert.match(data.latest.period, /^Q[1-4] \d{4}$/);
  assert.ok(data.latest.price > 500 && data.latest.price < 10000);
  assert.ok(data.series.length >= 5);
});

test("real-estate card shows the automatic INE median with its quarter", async () => {
  const ids = ["imob-preco-val", "imob-preco-chg", "imob-trans-val", "imobRefQuarter", "imobSub1", "imobSub2", "imobSub3", "imobRefSrc", "imob-new-val", "imob-exist-val"];
  const elements = new Map(ids.map(id => [id, { innerHTML: "", textContent: "", style: {} }]));
  const data = JSON.parse(await readFile(new URL("../data/imob.json", import.meta.url), "utf8"));
  let saved = null;
  const context = vm.createContext({
    URL,
    console: { info() {}, log() {}, warn() {} },
    document: { getElementById: id => elements.get(id) || null, querySelectorAll: () => [], addEventListener() {} },
    $: id => elements.get(id) || null,
    lsGet: () => null,
    lsSet: (key, value, meta) => { saved = { key, value, meta }; },
    fetch: async url => { assert.match(String(url), /data\/imob\.json$/); return Response.json(data); },
    setTimeout() {},
  });
  context.window = context;
  context.location = { href: "https://lcmadeira.github.io/dash/" };
  vm.runInContext(await readFile("src/cards/real-estate.js", "utf8"), context);
  await context.loadImob();
  assert.equal(elements.get("imobRefQuarter").textContent, `INE · ${data.latest.period}`);
  assert.match(elements.get("imob-preco-val").innerHTML, new RegExp(data.latest.price.toLocaleString("pt-PT")));
  assert.match(elements.get("imobRefSrc").innerHTML, /últimos 12 meses/);
  assert.match(elements.get("imob-new-val").textContent, /^[+-]\d+,\d%$/);
  assert.equal(saved.key, "imob_ine_v1");
  assert.ok(Number.isFinite(Date.parse(saved.meta.observedAt)));
});
