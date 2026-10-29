import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

async function loadRealEstate(cached) {
  const elements = new Map(["imob-preco-val", "imob-preco-chg", "imob-trans-val", "imobRefQuarter", "imobSub1", "imobSub2", "imobSub3", "imobRefSrc"]
    .map(id => [id, { innerHTML: "", textContent: "", style: {} }]));
  const context = vm.createContext({
    console: { info() {}, log() {}, warn() {} },
    document: { getElementById: id => elements.get(id) || null, querySelectorAll: () => [], addEventListener() {} },
    window: {},
    $: id => elements.get(id) || null,
    lsGet: () => cached,
    setTimeout() {},
  });
  context.window = context;
  vm.runInContext(await readFile("src/cards/real-estate.js", "utf8"), context);
  await context.loadImob();
  return elements;
}

test("real-estate card rejects cached INE observations older than the validated reference", async () => {
  const elements = await loadRealEstate({ price: 1500, chgYoY: 4, period: "Q3 2021", periodFull: "3.º Trimestre de 2021", isLive: true });
  assert.equal(elements.get("imobRefQuarter").textContent, "INE · Q3 2025");
  assert.match(elements.get("imobRefSrc").innerHTML, /estático · ref\. Q3 2025/);
  assert.doesNotMatch(elements.get("imobRefSrc").innerHTML, /API live/);
});

test("real-estate card keeps a recent cached quarterly observation", async () => {
  const elements = await loadRealEstate({ price: 2300, chgYoY: 8.1, period: "Q2 2026", periodFull: "2.º Trimestre de 2026", isLive: true });
  assert.equal(elements.get("imobRefQuarter").textContent, "INE · Q2 2026");
  assert.match(elements.get("imobRefSrc").innerHTML, /INE API live/);
});
