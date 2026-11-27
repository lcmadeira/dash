#!/usr/bin/env node
/*
 * Atualiza data/salarios.json com a remuneração bruta mensal média por trabalhador (INE, trimestral).
 * O INE não permite leitura direta pelo browser (CORS), por isso corre no cron do portátil,
 * como as outras fontes de scripts/update-data.mjs. Só reescreve o ficheiro quando os dados mudam.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { getJson } from "./lib/http-json.mjs";
import { quarterCodes, wagesUrl, parseIneWages, summarizeWages } from "./lib/ine-wages.mjs";

const OUT = new URL("../data/salarios.json", import.meta.url);

let previous = null;
try { previous = JSON.parse(await readFile(OUT, "utf8")); } catch { /* primeiro ficheiro */ }

const json = await getJson(wagesUrl(quarterCodes(2017)), { timeoutMs: 120000 });
const summary = summarizeWages(parseIneWages(json));
if (!summary) throw new Error("INE: série da remuneração média vazia ou incompleta");

const [y, q] = summary.latest.q.split("-Q").map(Number);
const output = {
  ...summary,
  _meta: {
    source: "INE · remuneração bruta mensal média por trabalhador (Segurança Social e CGA)",
    indicator: "0011130",
    state: "live",
    observedAt: Date.UTC(y, q * 3, 0),
  },
};
const text = `${JSON.stringify(output, null, 2)}\n`;
if (previous && `${JSON.stringify(previous, null, 2)}\n` === text) {
  console.log(`Sem alterações (${summary.latest.q}: ${summary.latest.total} €).`);
} else {
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUT, text);
  console.log(`data/salarios.json atualizado: ${summary.latest.q} ${summary.latest.total} € · média 12 meses ${summary.avg12m} €.`);
}
