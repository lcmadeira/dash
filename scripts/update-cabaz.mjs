#!/usr/bin/env node
/*
 * Atualiza data/cabaz.json com o valor semanal do cabaz alimentar (DECO PROteste),
 * lido por consenso dos títulos de notícias no Google News (ver scripts/lib/cabaz-news.mjs).
 * O Google News recusa pedidos da Cloudflare, por isso corre no portátil do utilizador
 * (~/scripts/dash-update-dams.sh, cron diário às 10:20). Só reescreve o ficheiro quando muda.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { parseCabazNews, mergeCabazEntries } from "./lib/cabaz-news.mjs";

const FEED = "https://news.google.com/rss/search?q=%22cabaz+alimentar%22+DECO&hl=pt-PT&gl=PT&ceid=PT:pt";
const OUT = new URL("../data/cabaz.json", import.meta.url);

const response = await fetch(FEED, {
  headers: { "User-Agent": "Mozilla/5.0 (compatible; dash-data-updater/1.0)", Accept: "application/rss+xml" },
  signal: AbortSignal.timeout(30000),
});
if (!response.ok) throw new Error(`Google News respondeu HTTP ${response.status}`);
const xml = await response.text();

let previous = { entries: [] };
let previousText = "";
try {
  previousText = await readFile(OUT, "utf8");
  previous = JSON.parse(previousText);
} catch { /* primeiro ficheiro */ }
const found = parseCabazNews(xml, previous.entries.map((e) => [e[0], e[1]]));

const entries = mergeCabazEntries(previous.entries, found);
if (!entries.length) throw new Error("Nenhum valor do cabaz com consenso nas notícias");
const output = {
  entries,
  _meta: {
    source: "DECO PROteste via notícias (Lusa e outros), consenso de títulos no Google News",
    state: "live",
    observedAt: Date.parse(`${entries[entries.length - 1][0]}T12:00:00Z`),
  },
};
const text = `${JSON.stringify(output, null, 2)}\n`;
const last = entries[entries.length - 1];
if (text === previousText) {
  console.log(`Cabaz sem alterações (último: ${last[0]}, ${last[1]} €).`);
} else {
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUT, text);
  console.log(`data/cabaz.json atualizado: ${entries.length} semanas, último ${last[0]} = ${last[1]} €.`);
}
