#!/usr/bin/env node
/*
 * Atualiza data/exports.json com as quotas das exportações portuguesas de bens por destino e por
 * grupo de produtos (INE, indicador 0001400) nos últimos 12 meses publicados.
 * A API do INE não envia CORS e é lenta (40 s para 12 meses), por isso corre no portátil com os
 * restantes dados (scripts/update-data.mjs). Só reescreve o ficheiro quando os dados mudam.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  INE_EXPORTS_META_URL, exportsByDestinationUrl, exportsByProductUrl, last12Codes, parseMonthLabel,
  summarizeDestinations, summarizeProducts,
} from "./lib/ine-exports.mjs";
import { getJson } from "./lib/http-json.mjs";

const OUT = new URL("../data/exports.json", import.meta.url);

const meta = await getJson(INE_EXPORTS_META_URL);
const last = parseMonthLabel((Array.isArray(meta) ? meta[0] : meta)?.UltimoPeriodo);
if (!last) throw new Error("Metadados do INE sem último período reconhecível");
const codes = last12Codes(last);

const destinations = summarizeDestinations(await getJson(exportsByDestinationUrl(codes)));
const products = summarizeProducts(await getJson(exportsByProductUrl(codes)));
if (!destinations || destinations.items.length < 5) throw new Error("Destinos sem dados suficientes");
if (!products || products.items.length < 4) throw new Error("Produtos sem dados suficientes");

const first = codes[0].slice(3), lastCode = codes.at(-1).slice(3);
const period = { from: `${first.slice(0, 4)}-${first.slice(4)}`, to: `${lastCode.slice(0, 4)}-${lastCode.slice(4)}` };
const output = {
  period,
  totalEur: Math.round(destinations.world),
  destinos: destinations.items,
  produtos: products.items,
  _meta: {
    source: "INE · exportações de bens por destino e tipo de bens (indicador 0001400), últimos 12 meses",
    state: "live",
    observedAt: `${period.to}-15`,
  },
};
const text = `${JSON.stringify(output, null, 2)}\n`;
let previous = "";
try { previous = await readFile(OUT, "utf8"); } catch { /* primeiro ficheiro */ }
if (previous === text) {
  console.log(`Exportações sem alterações (${period.from} a ${period.to}).`);
} else {
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUT, text);
  console.log(`data/exports.json atualizado: ${period.from} a ${period.to}, ${output.destinos[0].n} ${output.destinos[0].v}%.`);
}
