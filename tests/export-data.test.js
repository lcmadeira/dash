import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

async function load() {
  const window = {};
  vm.runInNewContext(await readFile(new URL("../src/export-data.js", import.meta.url), "utf8"), { window });
  return window;
}
const plain = v => JSON.parse(JSON.stringify(v));

const NOW = new Date(2026, 10, 27, 15, 0).getTime();
const CACHE = {
  fuel: { d: [{ fuel_slug: "diesel", avg_price_eur: 2.104, updated_at: "2026-11-27T07:30:00Z" }, { fuel_slug: "gasoline_95", avg_price_eur: 1.907, updated_at: "2026-11-27T07:30:00Z" }] },
  euribor_live_v1: { d: { _source: "bce_live", _observedAt: Date.UTC(2026, 9, 1), rates: [{ term: "3M", val: 2.635 }, { term: "12M", val: 3.239 }] } },
  elec_v3: { d: { date: "2026-11-27", periods: [{ priceMwh: 100 }, { priceMwh: 50 }, { priceMwh: 150 }] } },
  hols_2026: { d: [{ date: "2026-12-01", localName: "Restauração da Independência", global: true, types: ["Public"] }, { date: "2026-02-17", localName: "Carnaval", global: true, types: ["Optional"] }, { date: "2026-12-26", localName: "1.º de Dezembro Madeira", global: false, counties: ["PT-30"] }] },
};
const ctx = { read: key => CACHE[key] || null, now: NOW, cityId: 1110600, cityName: "Lisboa", statusOf: () => ({ source: "INE", observedAt: "01/11/2026" }) };

test("extractors read cached data with source and date", async () => {
  const w = await load();
  const rows = plain(w.buildExportRows([
    { id: "fuel", name: "Combustíveis", section: "Portugal" },
    { id: "euribor", name: "Euribor", section: "Economia" },
    { id: "elec", name: "Eletricidade", section: "Portugal" },
    { id: "hol", name: "Feriados", section: "Portugal" },
  ], ctx));
  const diesel = rows.find(r => /Gasóleo simples · média nacional/.test(r.indicator));
  assert.equal(diesel.value, 2.104);
  assert.equal(diesel.unit, "€/L");
  assert.equal(diesel.origin, "dados");
  assert.equal(diesel.observedAt, "2026-11-27T07:30:00.000Z");
  assert.equal(rows.find(r => r.indicator === "Euribor 12M").value, 3.239);
  assert.equal(rows.find(r => /Preço médio/.test(r.indicator)).value, 100);
  const hol = rows.filter(r => r.card === "Feriados");
  assert.equal(hol.length, 1, "Carnaval (opcional) e feriados regionais ficam de fora");
  assert.equal(hol[0].value, "2026-12-01");
});

test("cards without extractor export their visible text, marked as such", async () => {
  const w = await load();
  const rows = plain(w.buildExportRows([{ id: "smn", name: "Salário mínimo", section: "Economia", text: "  870 €\n  por mês " }], ctx));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].value, "870 € por mês");
  assert.equal(rows[0].origin, "texto do ecrã");
  assert.equal(rows[0].source, "INE");
});

test("CSV uses ';', decimal comma, quotes and a BOM for Excel in Portuguese", async () => {
  const w = await load();
  const csv = w.exportRowsToCsv([
    { section: "Portugal", card: "Combustíveis", indicator: "Gasóleo", value: 2.104, unit: "€/L", source: "DGEG; API Aberta", observedAt: "", origin: "dados" },
    { section: "Mundo", card: "Texto", indicator: "Conteúdo", value: '=SOMA(1) "x"', unit: "", source: "", observedAt: "", origin: "texto do ecrã" },
  ]);
  assert.ok(csv.startsWith("﻿Secção;Card;Indicador;Valor;"));
  const lines = csv.trim().split("\r\n");
  assert.equal(lines[1], 'Portugal;Combustíveis;Gasóleo;2,104;€/L;"DGEG; API Aberta";;dados');
  assert.match(lines[2], /;"'=SOMA\(1\) ""x""";/);
});

test("JSON has the same rows and no HTML", async () => {
  const w = await load();
  const json = JSON.parse(w.exportRowsToJson([{ section: "A", card: "B", indicator: "C", value: 1, unit: "", source: "", observedAt: "", origin: "dados" }], { now: NOW }));
  assert.equal(json.rows.length, 1);
  assert.ok(!("html" in json.rows[0]));
  assert.match(json.source, /Portugal hoje/);
});
