/*
 * INE · indicador 0001400: exportações (€) de bens por local de destino e tipo de bens (CGCE), mensal.
 * O painel mostra a quota de cada destino e de cada grupo de produtos nos últimos 12 meses publicados.
 */
const BASE = "https://www.ine.pt/ine/json_indicador";
export const INE_EXPORTS_META_URL = `${BASE}/pindicaMeta.jsp?varcd=0001400&lang=PT`;

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "Setembro de 2026" → { year: 2026, month: 9 } ou null. */
export function parseMonthLabel(label) {
  const m = /^(\S+) de (\d{4})$/.exec(String(label || "").trim());
  const month = m ? MONTHS.indexOf(m[1].toLowerCase()) + 1 : 0;
  return month ? { year: Number(m[2]), month } : null;
}

/** Os 12 meses que terminam em `last` ({year, month}), como códigos de período do INE (S3AYYYYMM). */
export function last12Codes(last) {
  const out = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(last.year, last.month - 1 - i, 1));
    out.push(`S3A${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export const exportsByDestinationUrl = codes => `${BASE}/pindica.jsp?op=2&varcd=0001400&Dim1=${codes.join(",")}&Dim3=T&lang=PT`;
export const exportsByProductUrl = codes => `${BASE}/pindica.jsp?op=2&varcd=0001400&Dim1=${codes.join(",")}&Dim2=MUNDO&lang=PT`;

/** Nomes curtos para o card (o INE usa designações longas). */
const SHORT_NAMES = {
  US: "EUA", XU: "Reino Unido", NL: "Países Baixos", CN: "China", MA: "Marrocos", BR: "Brasil",
};
/** Grupos CGCE de nível 1 (dim_3 com um algarismo). */
const PRODUCT_NAMES = {
  1: "Alimentares e bebidas", 2: "Fornecimentos industriais", 3: "Combustíveis",
  4: "Máquinas e bens de capital", 5: "Material de transporte", 6: "Bens de consumo", 7: "Outros bens",
};

function rowsOf(json) {
  const indicator = Array.isArray(json) ? json[0] : json;
  const dados = indicator?.Dados;
  return dados && typeof dados === "object" ? Object.values(dados).flat().filter(Boolean) : [];
}

function sumBy(rows, keyOf) {
  const totals = new Map();
  for (const row of rows) {
    const value = Number(row?.valor);
    const key = keyOf(row);
    if (!key || !Number.isFinite(value)) continue;
    totals.set(key, (totals.get(key) || 0) + value);
  }
  return totals;
}

const round1 = v => Math.round(v * 10) / 10;

/** Destinos: quota (%) de cada país no total mundial dos 12 meses; só códigos de país (2 letras). */
export function summarizeDestinations(json, top = 8) {
  const rows = rowsOf(json).filter(r => r.dim_3 === "T" || r.dim_3 === undefined);
  const totals = sumBy(rows, r => r.geocod);
  const world = totals.get("MUNDO");
  if (!(world > 0)) return null;
  const names = new Map(rows.map(r => [r.geocod, r.geodsg]));
  const items = [...totals.entries()]
    .filter(([code]) => /^[A-Z]{2}$/.test(code) && code !== "XI")
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([code, value]) => ({ code, n: SHORT_NAMES[code] || names.get(code) || code, v: round1(value / world * 100) }));
  return { world, items };
}

/** Produtos: quota (%) de cada grupo CGCE de nível 1 nas exportações totais (destino Mundo). */
export function summarizeProducts(json) {
  const rows = rowsOf(json).filter(r => r.geocod === "MUNDO");
  const totals = sumBy(rows, r => r.dim_3);
  const total = totals.get("T");
  if (!(total > 0)) return null;
  const items = Object.entries(PRODUCT_NAMES)
    .map(([code, n]) => ({ code, n, v: round1((totals.get(code) || 0) / total * 100) }))
    .filter(x => x.v > 0)
    .sort((a, b) => b.v - a.v);
  return { total, items };
}
