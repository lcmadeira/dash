/* Leitura das notícias mensais do IGCP com a taxa dos Certificados de Aforro (Série F).
   Funções puras (testáveis); o download fica em scripts/update-aforro.mjs. */
const MONTHS = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Ligações únicas das notícias "taxas-de-juro-dos-certificados-de-aforro…" numa página de lista. */
export function aforroNewsLinks(html) {
  const out = new Set();
  for (const m of String(html).matchAll(/href="(\/pt\/noticias\/taxas-de-juro-dos-certificados-de-aforro[^"#?]*)"/g)) out.add(m[1]);
  return [...out];
}

/** Mês (AAAA-MM) a partir do endereço: o texto da notícia já trouxe o ano errado (gralha de out-2026). */
export function aforroMonthFromUrl(url) {
  const m = /-em-([a-zç]+)-(?:de-)?(\d{4})\/?$/.exec(String(url).normalize("NFD").replace(/[̀-ͯ]/g, ""));
  if (!m) return null;
  const idx = MONTHS.indexOf(m[1].replace("ç", "c"));
  return idx < 0 ? null : `${m[2]}-${String(idx + 1).padStart(2, "0")}`;
}

/** Taxa bruta da Série F (%) no texto da notícia: "Série F, em … foi fixada em 2,500%". */
export function aforroRateFromHtml(html) {
  const text = String(html).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const m = /S[ée]rie F[^%]{0,120}?fixada em\s*(\d+[.,]\d+)\s*%/i.exec(text);
  if (!m) return null;
  const rate = Number(m[1].replace(",", "."));
  return Number.isFinite(rate) && rate >= 0 && rate <= 10 ? rate : null;
}
