/*
 * INE · indicador 0011130: remuneração bruta mensal média por trabalhador (€), trimestral,
 * a partir das declarações à Segurança Social e à CGA. Portugal, setor total, atividade total;
 * componente T (total, com subsídios no mês em que são pagos) e 1 (regular, sem subsídios).
 */
const BASE = "https://www.ine.pt/ine/json_indicador/pindica.jsp";
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Códigos dos trimestres (mês de fim: S3A201703 … ) desde `fromYear` até ao trimestre de `now`. */
export function quarterCodes(fromYear, now = new Date()) {
  const codes = [];
  const endKey = now.getUTCFullYear() * 12 + now.getUTCMonth();
  for (let y = fromYear; y <= now.getUTCFullYear(); y++) {
    for (const m of [3, 6, 9, 12]) if (y * 12 + m - 1 <= endKey) codes.push(`S3A${y}${String(m).padStart(2, "0")}`);
  }
  return codes;
}

export const wagesUrl = codes => `${BASE}?op=2&varcd=0011130&Dim1=${codes.join(",")}&Dim2=PT&Dim3=T,1&Dim4=T&Dim5=TOT&lang=PT`;

/** "Setembro de 2026" → "2026-Q3" (só meses de fim de trimestre). */
export function quarterFromLabel(label) {
  const m = /^(\p{L}+) de (\d{4})$/u.exec(String(label || "").trim());
  const month = m ? MONTHS.indexOf(m[1].toLowerCase()) + 1 : 0;
  return month && month % 3 === 0 ? `${m[2]}-Q${month / 3}` : null;
}

/** Resposta do INE → [{ q: "2026-Q3", total, regular }] por ordem cronológica. */
export function parseIneWages(json) {
  const dados = (Array.isArray(json) ? json[0] : json)?.Dados;
  if (!dados || typeof dados !== "object") return [];
  const val = (rows, comp) => {
    const v = Number(rows.find(r => r?.dim_3 === comp)?.valor);
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  return Object.entries(dados)
    .map(([label, rows]) => ({ q: quarterFromLabel(label), rows: Array.isArray(rows) ? rows : [] }))
    .filter(x => x.q)
    .map(({ q, rows }) => ({ q, total: val(rows, "T"), regular: val(rows, "1") }))
    .filter(x => x.total)
    .sort((a, b) => a.q.localeCompare(b.q));
}

const round1 = v => Math.round(v * 10) / 10;

/**
 * Resumo: último trimestre e variação homóloga; média dos últimos 4 trimestres (inclui os dois
 * subsídios, por isso é a média mensal de 12 meses) e médias anuais de anos completos.
 */
export function summarizeWages(quarters) {
  const qs = quarters.filter(x => Number.isFinite(x?.total));
  const last = qs.at(-1);
  if (!last || qs.length < 4) return null;
  const idx = q => qs.findIndex(x => x.q === q);
  const prevYear = q => `${Number(q.slice(0, 4)) - 1}${q.slice(4)}`;
  const ya = qs[idx(prevYear(last.q))];
  const avgOf = arr => Math.round(arr.reduce((s, x) => s + x.total, 0) / arr.length);
  const avg12m = avgOf(qs.slice(-4));
  const prevWindow = qs.slice(-8, -4);
  const avg12mPrev = prevWindow.length === 4 ? avgOf(prevWindow) : null;
  const years = {};
  qs.forEach(x => { (years[x.q.slice(0, 4)] ||= []).push(x); });
  const annual = Object.entries(years).filter(([, arr]) => arr.length === 4).map(([y, arr]) => ({ y: Number(y), avg: avgOf(arr) }));
  return {
    latest: {
      q: last.q, total: last.total, regular: last.regular,
      yoy: ya ? round1((last.total / ya.total - 1) * 100) : null,
      regularYoy: ya?.regular && last.regular ? round1((last.regular / ya.regular - 1) * 100) : null,
    },
    avg12m, avg12mFrom: qs.at(-4).q, avg12mYoy: avg12mPrev ? round1((avg12m / avg12mPrev - 1) * 100) : null,
    annual,
    quarters: qs,
  };
}
