#!/usr/bin/env node
/*
 * Atualiza data/imob.json com o valor mediano das vendas de habitação (INE, indicador 0012234).
 * A API do INE é lenta (5-30 s, até 15 s só para aceitar a ligação) e não tem CORS confirmado; corre no portátil com os restantes
 * dados (scripts/update-data.mjs). Só reescreve o ficheiro quando os dados mudam.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { INE_IMOB_URL, parseIneMedian, summarizeImob } from "./lib/ine-imob.mjs";
import { getJson } from "./lib/http-json.mjs";

const OUT = new URL("../data/imob.json", import.meta.url);

const json = await getJson(INE_IMOB_URL);

const series = parseIneMedian(json);
const latest = summarizeImob(series);
if (!latest || series.length < 5) throw new Error("Série do INE sem dados suficientes");

const output = {
  latest,
  series: series.slice(-8),
  _meta: {
    source: "INE · valor mediano das vendas nos últimos 12 meses (indicador 0012234)",
    state: "live",
    observedAt: latest.period,
  },
};
const text = `${JSON.stringify(output, null, 2)}\n`;
let previous = "";
try { previous = await readFile(OUT, "utf8"); } catch { /* primeiro ficheiro */ }
if (previous === text) {
  console.log(`Imobiliário sem alterações (${latest.period}: ${latest.price} €/m²).`);
} else {
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUT, text);
  console.log(`data/imob.json atualizado: ${latest.period} = ${latest.price} €/m² (${latest.chgYoY}% homólogo).`);
}
