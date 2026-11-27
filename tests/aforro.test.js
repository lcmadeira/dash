import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import "./nf-context.js";
import { aforroNewsLinks, aforroMonthFromUrl, aforroRateFromHtml } from "../scripts/lib/igcp-aforro.mjs";

const plain = v => JSON.parse(JSON.stringify(v));

test("IGCP news: links, month from the URL (not the text) and Série F rate", () => {
  const list = `<a href="/pt/noticias/taxas-de-juro-dos-certificados-de-aforro-das-series-b-d-e-e-f-em-novembro-de-2026">x</a>
    <a href="/pt/noticias/taxas-de-juro-dos-certificados-de-aforro-das-series-b-d-e-e-f-em-outubro-2026">y</a>
    <a href="/pt/noticias/taxas-de-juro-dos-certificados-de-aforro-das-series-b-d-e-e-f-em-novembro-de-2026">dup</a>
    <a href="/pt/noticias/outra-coisa">z</a>`;
  const links = aforroNewsLinks(list);
  assert.equal(links.length, 2);
  assert.equal(aforroMonthFromUrl(links[0]), "2026-11");
  assert.equal(aforroMonthFromUrl(links[1]), "2026-10"); // "em-outubro-2026", sem "de"
  assert.equal(aforroMonthFromUrl("/pt/noticias/taxas-em-marco-de-2027"), "2027-03");
  assert.equal(aforroMonthFromUrl("/pt/noticias/sem-mes"), null);
  // Texto real de out-2026, com a gralha do ano: a taxa lê-se na mesma.
  const html = "<p>A taxa de juro bruta para novas subscrições de Certificados de Aforro, <strong>Série F</strong>, em novembro de 2025 foi fixada em <b>2,500%</b>.</p>";
  assert.equal(aforroRateFromHtml(html), 2.5);
  assert.equal(aforroRateFromHtml("<p>Série F, em agosto de 2026 foi fixada em 2,474%</p>"), 2.474);
  assert.equal(aforroRateFromHtml("<p>sem taxa</p>"), null);
});

test("aforro summary: net of IRS, real rate, change and cap", async () => {
  const context = vm.createContext({ Date, Math, JSON, String, Number, Object, Array, console });
  context.window = context;
  vm.runInContext(await readFile("src/cards/aforro.js", "utf8"), context);
  const data = { latest: { month: "2026-11", rate: 2.5 }, history: [
    { month: "2026-11", rate: 2.5 }, { month: "2026-10", rate: 2.5 }, { month: "2026-08", rate: 2.474 },
  ] };
  const s = plain(context.aforroSummary(data, { euribor3m: 2.62, inflation: { value: 2.1, month: "out 2026" } }));
  assert.equal(s.atCap, true);
  assert.equal(s.net, 1.8);
  assert.equal(s.real, -0.3);
  assert.equal(s.change, 0);
  assert.deepEqual(s.history.map(h => h.month), ["2026-08", "2026-10", "2026-11"]);
  const below = plain(context.aforroSummary({ latest: { month: "2026-08", rate: 2.474 }, history: [{ month: "2026-08", rate: 2.474 }, { month: "2026-07", rate: 2.41 }] }));
  assert.equal(below.atCap, false);
  assert.equal(below.change, 0.064);
  assert.equal(below.real, null);
  assert.equal(context.aforroSummary({}), null);
});
