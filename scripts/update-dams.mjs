#!/usr/bin/env node
/*
 * Atualiza data/dams.json a partir do boletim mensal de albufeiras do SNIRH (APA).
 * Corre na GitHub Action "Atualizar dados das barragens": o SNIRH recusa pedidos
 * vindos da Cloudflare (gateway), mas responde aos runners do GitHub.
 * Usa o mesmo leitor da tabela que o gateway (worker/src/index.js).
 * Só reescreve o ficheiro quando os dados mudam (sem carimbos de hora variáveis).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { parseSnirhTable } from "../worker/src/index.js";

const PAGE = "https://snirh.apambiente.pt/index.php?idMain=1&idItem=1.3";
const TABLE = "https://snirh.apambiente.pt/snirh/_dadossintese/albufeiras/tabelas/tabelageral.php";
const OUT = new URL("../data/dams.json", import.meta.url);
const UA = "Mozilla/5.0 (compatible; dash-data-updater/1.0)";

async function getLatin1(url) {
  const response = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
  return new TextDecoder("latin1").decode(await response.arrayBuffer());
}

const page = await getLatin1(PAGE);
const match = /ALBUFBOL_AbreTabelaGeral\('(\d{4})','(\d{1,2})'/.exec(page);
if (!match) throw new Error("Parâmetros do boletim não encontrados na página do SNIRH");
const table = await getLatin1(`${TABLE}?percOUvolum=0&anohi=${match[1]}&mes=${match[2]}&bacia=&albuf=&albuftblgeralopcao=&zonas=`);
const parsed = parseSnirhTable(table, Number(match[1]));
if (!parsed || parsed.basins.length < 8 || !Number.isFinite(parsed.totalVal)) {
  throw new Error("Tabela do SNIRH sem dados válidos");
}

const output = {
  ...parsed,
  _meta: {
    source: "SNIRH · APA (albufeiras) · atualizado por GitHub Actions",
    state: "live",
    observedAt: Date.parse(`${parsed.period}-15T12:00:00Z`),
  },
};
const text = `${JSON.stringify(output, null, 2)}\n`;
let previous = "";
try { previous = await readFile(OUT, "utf8"); } catch { /* primeiro ficheiro */ }
if (previous === text) {
  console.log(`Sem alterações (${parsed.period}, total ${parsed.totalVal}%).`);
} else {
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUT, text);
  console.log(`data/dams.json atualizado: ${parsed.period} (${parsed.hydroYear} ${parsed.month}), total ${parsed.totalVal}%, ${parsed.basins.length} bacias.`);
}
