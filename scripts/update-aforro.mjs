#!/usr/bin/env node
/*
 * Atualiza data/aforro.json com a taxa dos Certificados de Aforro (Série F) publicada pelo IGCP
 * numa notícia por mês (igcp.pt/pt/noticias). O IGCP não permite leitura direta pelo browser (CORS),
 * por isso corre no cron do portátil, como as outras fontes de scripts/update-data.mjs.
 * Guarda até 24 meses; só reescreve o ficheiro quando os dados mudam.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { getBuffer } from "./lib/http-json.mjs";
import { aforroNewsLinks, aforroMonthFromUrl, aforroRateFromHtml } from "./lib/igcp-aforro.mjs";

const BASE = "https://www.igcp.pt";
const OUT = new URL("../data/aforro.json", import.meta.url);
const get = async url => new TextDecoder("utf-8").decode(await getBuffer(url, { timeoutMs: 45000, accept: "text/html" }));

let previous = null;
try { previous = JSON.parse(await readFile(OUT, "utf8")); } catch { /* primeiro ficheiro */ }
const known = new Map((previous?.history || []).map(r => [r.month, r]));

const links = new Set();
for (const page of [0, 1, 2]) {
  try { aforroNewsLinks(await get(`${BASE}/pt/noticias?page=${page}`)).forEach(l => links.add(l)); } catch (e) { if (page === 0) throw e; }
}
if (!links.size) throw new Error("Sem notícias de taxas dos Certificados de Aforro na lista do IGCP");

for (const link of links) {
  const month = aforroMonthFromUrl(link);
  if (!month || known.has(month)) continue;
  const rate = aforroRateFromHtml(await get(`${BASE}${link}`));
  if (rate === null) { console.log(`AVISO: taxa não encontrada em ${link}`); continue; }
  known.set(month, { month, rate, url: `${BASE}${link}` });
}

const history = [...known.values()].sort((a, b) => b.month.localeCompare(a.month)).slice(0, 24);
if (!history.length) throw new Error("Nenhuma taxa da Série F lida");
const output = {
  series: "F",
  latest: history[0],
  history,
  _meta: { source: "IGCP · Certificados de Aforro Série F", state: "live", observedAt: Date.parse(`${history[0].month}-01T00:00:00Z`) },
};
const text = `${JSON.stringify(output, null, 2)}\n`;
if (previous && JSON.stringify(previous, null, 2) + "\n" === text) {
  console.log(`Sem alterações (${history[0].month}: ${history[0].rate}%).`);
} else {
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUT, text);
  console.log(`data/aforro.json atualizado: ${history[0].month} ${history[0].rate}% (${history.length} meses).`);
}
