#!/usr/bin/env node
/*
 * Atualiza data/imob.json com o valor mediano das vendas de habitação (INE, indicador 0012234).
 * A API do INE é lenta (5-30 s) e não tem CORS confirmado; corre no portátil com os restantes
 * dados (scripts/update-data.mjs). Só reescreve o ficheiro quando os dados mudam.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { INE_IMOB_URL, parseIneMedian, summarizeImob } from "./lib/ine-imob.mjs";

const OUT = new URL("../data/imob.json", import.meta.url);

let json = null;
let lastError = null;
for (let attempt = 1; attempt <= 3 && !json; attempt++) {
  try {
    const response = await fetch(INE_IMOB_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; dash-data-updater/1.0)", Accept: "application/json" },
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`INE respondeu HTTP ${response.status}`);
    json = await response.json();
  } catch (error) {
    lastError = error;
  }
}
if (!json) throw lastError || new Error("INE sem resposta");

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
