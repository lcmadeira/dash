/*
 * INE · indicador 0012234: valor mediano das vendas de alojamentos familiares nos últimos
 * 12 meses (Metodologia 2022, €/m²), Portugal, por categoria (H1 total, H11 novos, H12 existentes).
 */
export const INE_IMOB_URL = "https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=0012234&Dim1=T&Dim2=PT&lang=PT";

/** "2.º Trimestre de 2026" → { key: 2026*4+2, period: "Q2 2026" } ou null. */
export function parseQuarter(label) {
  const m = /^([1-4])\.º Trimestre de (\d{4})$/.exec(String(label || "").trim());
  return m ? { key: Number(m[2]) * 4 + Number(m[1]), period: `Q${m[1]} ${m[2]}` } : null;
}

/**
 * Resposta JSON do INE → série trimestral por ordem cronológica.
 * @returns {Array<{period: string, periodFull: string, total: number|null, novos: number|null, existentes: number|null}>}
 */
export function parseIneMedian(json) {
  const indicator = Array.isArray(json) ? json[0] : json;
  const dados = indicator?.Dados;
  if (!dados || typeof dados !== "object") return [];
  const value = (rows, code) => {
    const row = rows.find(r => r?.dim_3 === code && r?.geocod === "PT");
    const v = Number(row?.valor);
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  return Object.entries(dados)
    .map(([label, rows]) => ({ q: parseQuarter(label), label, rows: Array.isArray(rows) ? rows : [] }))
    .filter(x => x.q)
    .sort((a, b) => a.q.key - b.q.key)
    .map(({ q, label, rows }) => ({
      period: q.period, periodFull: label,
      total: value(rows, "H1"), novos: value(rows, "H11"), existentes: value(rows, "H12"),
    }));
}

/** Resumo para o cartão: último trimestre com total e variações homólogas (4 trimestres antes). */
export function summarizeImob(series) {
  const usable = series.filter(s => s.total);
  const last = usable[usable.length - 1];
  if (!last) return null;
  const yearAgo = series[series.indexOf(last) - 4];
  const yoy = (now, before) => (now && before ? Number(((now / before - 1) * 100).toFixed(1)) : null);
  return {
    period: last.period, periodFull: last.periodFull,
    price: last.total, chgYoY: yoy(last.total, yearAgo?.total),
    newPrice: last.novos, newChgYoY: yoy(last.novos, yearAgo?.novos),
    existPrice: last.existentes, existChgYoY: yoy(last.existentes, yearAgo?.existentes),
  };
}
