import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import "./nf-context.js";
import { quarterCodes, quarterFromLabel, parseIneWages, summarizeWages } from "../scripts/lib/ine-wages.mjs";

const plain = v => JSON.parse(JSON.stringify(v));
const row = (comp, valor) => ({ geocod: "PT", dim_3: comp, dim_4: "T", dim_5: "TOT", valor: String(valor) });
const ineJson = entries => [{ IndicadorCod: "0011130", Dados: Object.fromEntries(entries.map(([label, t, r]) => [label, [row("T", t), row("1", r)]])) }];

test("INE wages: quarter codes up to the current quarter and labels", () => {
  const codes = quarterCodes(2025, new Date(Date.UTC(2026, 10, 27)));
  assert.equal(codes[0], "S3A202503");
  assert.equal(codes.at(-1), "S3A202609");
  assert.equal(codes.length, 7);
  assert.equal(quarterFromLabel("Setembro de 2026"), "2026-Q3");
  assert.equal(quarterFromLabel("Março de 2017"), "2017-Q1");
  assert.equal(quarterFromLabel("Agosto de 2026"), null, "só meses de fim de trimestre");
});

test("INE wages: 12-month average, year-on-year change and full-year averages", () => {
  const json = ineJson([
    ["Setembro de 2026", 1696, 1434], ["Março de 2025", 1534, 1358], ["Junho de 2025", 1746, 1366],
    ["Setembro de 2025", 1617, 1364], ["Dezembro de 2025", 1883, 1370], ["Março de 2026", 1616, 1427], ["Junho de 2026", 1840, 1433],
    ["Dezembro de 2024", 1786, 1304],
  ]);
  const quarters = parseIneWages(json);
  assert.equal(quarters[0].q, "2024-Q4");
  assert.equal(quarters.at(-1).q, "2026-Q3");
  const s = summarizeWages(quarters);
  assert.deepEqual(s.latest, { q: "2026-Q3", total: 1696, regular: 1434, yoy: 4.9, regularYoy: 5.1 });
  assert.equal(s.avg12m, 1759); // (1883+1616+1840+1696)/4
  assert.equal(s.avg12mFrom, "2025-Q4");
  assert.equal(s.avg12mYoy, 5.3); // vs (1786+1534+1746+1617)/4 = 1671
  assert.deepEqual(s.annual, [{ y: 2025, avg: 1695 }], "só anos com os 4 trimestres");
  assert.equal(summarizeWages(quarters.slice(0, 3)), null);
  assert.deepEqual(parseIneWages({}), []);
});

async function loadCard() {
  const body = { innerHTML: "" };
  const compare = { innerHTML: "" };
  const store = {};
  const context = vm.createContext({ Date, Math, JSON, String, Number, Object, Array, Promise, URL, console });
  context.window = context;
  context.localStorage = { getItem: k => store[k] ?? null };
  context.document = { getElementById: id => (id === "smn-body" ? body : id === "smn-compare" ? compare : null) };
  vm.runInContext(await readFile("src/cards/smn.js", "utf8"), context);
  return { context, body, compare, store };
}

test("wage card: average wage block, min-vs-average chart and EU toggle", async () => {
  const { context, body, compare, store } = await loadCard();
  store.salarios_v1 = JSON.stringify({ d: {
    latest: { q: "2026-Q3", total: 1696, regular: 1434, yoy: 4.9, regularYoy: 5.1 },
    avg12m: 1759, avg12mFrom: "2025-Q4", avg12mYoy: 5.3,
    annual: [{ y: 2017, avg: 1215 }, { y: 2024, avg: 1603 }, { y: 2025, avg: 1695 }],
  } });
  store.inflation_eurostat_v2 = JSON.stringify({ d: { rows: [{ m: "Out 2026", pt: 3.9 }, { m: "Set 2026", pt: 3.6 }, { m: "Ago 2026", pt: 3.6 }, { m: "Jul 2026", pt: 3.1 }] } });
  context.loadSMN();
  assert.match(body.innerHTML, /SMN legal Portugal 2026/);
  assert.match(body.innerHTML, /Salário médio · INE/);
  assert.match(body.innerHTML, /<b>1759<\/b>/);
  assert.match(body.innerHTML, /out 25–set 26/);
  assert.match(body.innerHTML, /3\.º trim\. 2026/);
  assert.match(body.innerHTML, /ganho real \(inflação 3,4%, média jul–set 2026\)[\s\S]*?▲ 1,5%/);
  assert.match(body.innerHTML, /O mínimo vale <b>61%<\/b> do salário médio \(53% em 2017\)/);
  assert.match(body.innerHTML, /Portugal[\s\S]*?1073€/);
  context.setSmnCompare("avg");
  assert.match(compare.innerHTML, /Eurostat 2025/);
  assert.match(compare.innerHTML, /Portugal[\s\S]*?2184€/);
  assert.match(compare.innerHTML, /Média UE[\s\S]*?3455€/);
  assert.doesNotMatch(compare.innerHTML, /Países Baixos<\/span>/);
});

test("wage card helpers: series ratio, real change and Eurostat parsing", async () => {
  const { context } = await loadCard();
  const s = plain(context.smnWageSeries({ annual: [{ y: 2025, avg: 1695 }], avg12m: 1759 }));
  assert.deepEqual(s.at(-1), { y: 2026, min: 1073, avg: 1759, ratio: 61, partial: true });
  assert.equal(s.find(r => r.y === 2025).partial, false);
  assert.equal(s[0].avg, null);
  assert.equal(context.smnRealChange(4.9, 2.3), 2.5);
  assert.equal(context.smnRealChange(4.9, NaN), null);
  assert.deepEqual(plain(context.smnQuarterInflation([{ m: "Set 2026", pt: 3.6 }, { m: "Ago 2026", pt: 3.6 }], "2026-Q3")), { value: 3.6, label: "Set 2026" }, "trimestre incompleto: mês mais recente");
  assert.equal(context.smnQuarterInflation([], "2026-Q3"), null);
  const eu = plain(context.parseEuAverageWages({
    dimension: { geo: { category: { index: { PT: 0, LU: 1 } } }, time: { category: { index: { 2024: 0, 2025: 1 } } } },
    value: { 0: 24984, 1: 26202, 2: 81984 },
  }));
  assert.deepEqual(eu, { year: 2025, values: { PT: 26202, LU: null } });
  assert.equal(context.parseEuAverageWages({}), null);
});
