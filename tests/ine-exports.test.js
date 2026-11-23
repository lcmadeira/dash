import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import "./nf-context.js";
import {
  exportsByDestinationUrl, last12Codes, parseMonthLabel, summarizeDestinations, summarizeProducts,
} from "../scripts/lib/ine-exports.mjs";

const row = (geocod, geodsg, dim_3, valor) => ({ geocod, geodsg, dim_3, valor: String(valor) });

test("INE month labels and the 12-month window", () => {
  assert.deepEqual(parseMonthLabel("Setembro de 2026"), { year: 2026, month: 9 });
  assert.deepEqual(parseMonthLabel("março de 2025"), { year: 2025, month: 3 });
  assert.equal(parseMonthLabel("3.º Trimestre de 2026"), null);
  const codes = last12Codes({ year: 2026, month: 9 });
  assert.equal(codes.length, 12);
  assert.equal(codes[0], "S3A202510");
  assert.equal(codes.at(-1), "S3A202609");
  assert.match(exportsByDestinationUrl(codes), /varcd=0001400&Dim1=S3A202510,.*S3A202609&Dim3=T/);
});

test("destinations sum the months and keep only countries, as a share of the world total", () => {
  const json = [{ Dados: {
    "Agosto de 2026": [row("MUNDO", "Mundo", "T", 1000), row("INTRA_UE27", "Intra UE", "T", 700), row("ES", "Espanha", "T", 260),
      row("DE", "Alemanha", "T", 120), row("US", "Estados Unidos", "T", 70), row("XU", "Reino Unido (exceto IN)", "T", 40),
      row("XI", "Irlanda do Norte", "T", 1), row("FR", "França", "T", 110), row("AO", "Angola", "T", 30)],
    "Setembro de 2026": [row("MUNDO", "Mundo", "T", 1000), row("ES", "Espanha", "T", 240), row("DE", "Alemanha", "T", 130),
      row("FR", "França", "T", 120), row("US", "Estados Unidos", "T", 60), row("XU", "Reino Unido (exceto IN)", "T", 50),
      row("AO", "Angola", "T", "x")],
  } }];
  const d = summarizeDestinations(json, 5);
  assert.equal(d.world, 2000);
  assert.deepEqual(d.items.map(x => x.n), ["Espanha", "Alemanha", "França", "EUA", "Reino Unido"]);
  assert.equal(d.items[0].v, 25);
  assert.ok(!d.items.some(x => /INTRA|MUNDO/.test(x.code)), "aggregates are not countries");
  assert.equal(summarizeDestinations([{ Dados: {} }]), null);
});

test("products use the CGCE top-level groups of world exports", () => {
  const json = [{ Dados: { "Setembro de 2026": [
    row("MUNDO", "Mundo", "T", 1000), row("MUNDO", "Mundo", "1", 120), row("MUNDO", "Mundo", "11", 50),
    row("MUNDO", "Mundo", "2", 300), row("MUNDO", "Mundo", "4", 150), row("MUNDO", "Mundo", "5", 170),
    row("MUNDO", "Mundo", "6", 200), row("MUNDO", "Mundo", "3", 60),
  ] } }];
  const p = summarizeProducts(json);
  assert.deepEqual(p.items.map(x => [x.n, x.v]), [
    ["Fornecimentos industriais", 30], ["Bens de consumo", 20], ["Material de transporte", 17],
    ["Máquinas e bens de capital", 15], ["Alimentares e bebidas", 12], ["Combustíveis", 6],
  ]);
});

test("exports card uses data/exports.json and labels the 12-month period", async () => {
  const body = { innerHTML: "" };
  const src = { textContent: "" };
  let saved = null;
  const data = {
    period: { from: "2025-10", to: "2026-09" },
    destinos: [{ n: "Espanha", v: 25.3 }, { n: "França", v: 12.9 }, { n: "Alemanha", v: 11.8 }, { n: "EUA", v: 6.1 }],
    produtos: [{ n: "Fornecimentos industriais", v: 31.2 }, { n: "Bens de consumo", v: 19.4 }, { n: "Material de transporte", v: 15.1 }, { n: "Combustíveis", v: 6.3 }],
    _meta: { observedAt: "2026-09-15" },
  };
  const context = vm.createContext({
    URL, Date, Number, String, Array, console: { debug() {} },
    $: id => (id === "exp-body" ? body : null),
    document: { getElementById: id => (id === "expSrc" ? src : null), querySelectorAll: () => [] },
    lsGet: () => null,
    lsSet: (_k, v) => { saved = v; },
    fetchJsonFirstOk: async (url, _o, _t, _s, validate) => {
      assert.equal(url, "https://lcmadeira.github.io/dash/data/exports.json");
      assert.ok(validate(data));
      return data;
    },
  });
  context.window = context;
  context.location = { href: "https://lcmadeira.github.io/dash/" };
  context.window.location = context.location;
  vm.runInContext(await readFile("src/cards/exports.js", "utf8"), context);
  await context.loadExp();
  assert.equal(saved, data);
  assert.match(body.innerHTML, /Espanha/);
  assert.match(body.innerHTML, /25,3%/);
  assert.match(src.textContent, /out 2025 a set 2026/);
  assert.equal(context.isValidExports({ ...data, destinos: [{ n: "x", v: 140 }] }), false);
});
