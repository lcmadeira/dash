/*
 * Lê o valor semanal do cabaz alimentar da DECO PROteste a partir de títulos de notícias (RSS).
 * A DECO publica às quartas-feiras; a Lusa distribui a notícia e vários jornais republicam-na
 * com títulos do tipo "Cabaz alimentar desce 87 cêntimos para 255,86 euros".
 * Um valor só é aceite por consenso: pelo menos 2 fontes com o mesmo valor na mesma semana
 * e nenhum valor concorrente com a mesma frequência.
 */

const MIN_VALUE = 150;
const MAX_VALUE = 400;
const MAX_WEEKLY_JUMP = 15;

function decodeXml(text) {
  return String(text)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function tag(item, name) {
  const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(item);
  return m ? decodeXml(m[1]).trim() : "";
}

/** Quarta-feira (AAAA-MM-DD, calendário de Lisboa) da semana de publicação: a mais recente ≤ data. */
export function publicationWednesday(date) {
  const lisbon = new Date(new Date(date).toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
  const back = (lisbon.getDay() - 3 + 7) % 7;
  lisbon.setDate(lisbon.getDate() - back);
  const pad = (n) => String(n).padStart(2, "0");
  return `${lisbon.getFullYear()}-${pad(lisbon.getMonth() + 1)}-${pad(lisbon.getDate())}`;
}

/** Valor em euros com cêntimos num título sobre o cabaz alimentar da DECO, ou null. */
export function valueFromTitle(title) {
  const t = String(title || "");
  if (!/cabaz (alimentar|de bens essenciais)/i.test(t)) return null;
  if (!/deco/i.test(t) && !/^cabaz alimentar (sobe|desce|volta|aumenta|baixa|recua|cai)/i.test(t)) return null;
  const matches = [...t.matchAll(/(\d{3}),(\d{2})\s*(?:euros|€)/gi)].map((m) => Number(`${m[1]}.${m[2]}`));
  const values = matches.filter((v) => v >= MIN_VALUE && v <= MAX_VALUE);
  return values.length ? values[values.length - 1] : null;
}

/** Variação semanal anunciada no título, em euros (negativa se desce), ou null. */
export function deltaFromTitle(title) {
  const t = String(title || "");
  const dir = /\b(desce|cai|recua|baixa|diminui)\b/i.test(t) ? -1 : /\b(sobe|aumenta|cresce|agrava)\b/i.test(t) ? 1 : 0;
  if (!dir) return null;
  const cents = /(\d{1,3})\s*c[êe]ntimos/i.exec(t);
  if (cents) return dir * Number(cents[1]) / 100;
  const euros = /(?:sobe|aumenta|cresce|desce|cai|recua|baixa|diminui)\s+(\d{1,2}),(\d{2})\s*(?:euros|€)/i.exec(t);
  return euros ? dir * Number(`${euros[1]}.${euros[2]}`) : null;
}

function shiftDate(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const same = (a, b) => Math.abs(a - b) < 0.005;

/**
 * Lê as notícias e devolve leituras por semana (quarta-feira de publicação).
 * Um valor é aceite se (a) aparece em ≥2 fontes sem valor concorrente igualmente frequente, ou
 * (b) aparece numa fonte e bate certo com a semana anterior conhecida mais a variação anunciada.
 * A semana anterior em falta é calculada a partir da variação de uma leitura aceite.
 * @param {string} xml RSS (Google News ou outro).
 * @param {Array<[string, number]>} known Valores já conhecidos [data, valor] (para validar variações).
 * @returns {Array<{date: string, value: number, sources: number, title: string, link: string, how: string}>}
 */
export function parseCabazNews(xml, known = []) {
  const weeks = new Map();
  for (const m of String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const title = tag(m[1], "title");
    const pub = Date.parse(tag(m[1], "pubDate"));
    const value = valueFromTitle(title);
    if (value === null || !Number.isFinite(pub)) continue;
    const week = publicationWednesday(pub);
    if (!weeks.has(week)) weeks.set(week, new Map());
    const byValue = weeks.get(week);
    const entry = byValue.get(value) || { count: 0, title, link: tag(m[1], "link"), deltas: [] };
    entry.count += 1;
    const delta = deltaFromTitle(title);
    if (delta !== null) entry.deltas.push(delta);
    byValue.set(value, entry);
  }
  const values = new Map(known.map(([d, v]) => [d, v]));
  const result = [];
  const accept = (date, value, info) => { values.set(date, value); result.push({ date, value, ...info }); };
  for (const date of [...weeks.keys()].sort()) {
    const ranked = [...weeks.get(date).entries()].sort((a, b) => b[1].count - a[1].count);
    const [value, best] = ranked[0];
    const tie = ranked[1] && ranked[1][1].count === best.count;
    const delta = best.deltas.find((d) => best.deltas.every((x) => same(x, d))) ?? null;
    const prevDate = shiftDate(date, -7);
    const prev = values.get(prevDate);
    const title = best.title.replace(/\s+[-–]\s+[^-–]+$/, "");
    let how = null;
    if (best.count >= 2 && !tie) how = `${best.count} fontes`;
    else if (!tie && delta !== null && prev !== undefined && same(prev + delta, value)) how = "variação confirma semana anterior";
    if (!how) continue;
    if (prev === undefined && delta !== null && best.count >= 2) {
      accept(prevDate, Number((value - delta).toFixed(2)), { sources: best.count, title: `Calculado pela variação de ${date}`, link: best.link, how: "derivado da variação" });
    }
    accept(date, value, { sources: best.count, title, link: best.link, how });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Junta novas leituras às já guardadas (por data) e rejeita saltos semanais implausíveis.
 * @param {Array<[string, number, string, string]>} existing Entradas [data, valor, nota, link].
 * @param {ReturnType<typeof parseCabazNews>} found Leituras novas.
 */
export function mergeCabazEntries(existing, found) {
  const byDate = new Map((existing || []).map((e) => [e[0], e]));
  for (const f of found) {
    const earlier = [...byDate.values()].filter((e) => e[0] < f.date).sort((a, b) => a[0].localeCompare(b[0])).pop();
    if (earlier && Math.abs(f.value - earlier[1]) > MAX_WEEKLY_JUMP) continue;
    byDate.set(f.date, [f.date, f.value, `${f.title} · ${f.how}`, f.link]);
  }
  return [...byDate.values()].sort((a, b) => a[0].localeCompare(b[0]));
}
