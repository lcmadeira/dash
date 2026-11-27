/* global $, document, window, localStorage, PFX, CFG, IPMA_CITIES, skeletonGeneric, lsGet, lsSet, fetchJsonFirstOk, er, notifyNonCriticalError */
(() => {
/* ── Feriados & dias úteis ── */

/* Feriados municipais (dia fixo) das cidades do seletor IPMA.
 * Confirmados em santander.pt/salto/feriados-municipais-portugal-2026 (2026): Lisboa, Porto, Coimbra, Faro,
 * Santarém, Sines, Viana do Castelo. Os restantes seguem a data tradicional do município.
 * Cidades sem entrada: o card diz que não há feriado municipal registado. */
/* Feriados municipais (verificados a 27-11-2026):
   Lisboa, Porto, Coimbra, Faro, Santarém, Sines, Viana: lista do Santander;
   Évora: cm-evora.pt (feriado-municipal); Aveiro: cm-aveiro.pt (festas de Santa Joana);
   Viseu: Diocese de Viseu e timeanddate; Setúbal: CM Setúbal (Dia de Bocage e da Cidade) e timeanddate;
   Braga: só a lista "Public holidays in Portugal" da Wikipédia (o site da câmara não abriu). */
const HOL_MUNIC = {
  "Lisboa":           { month: 6, day: 13, name: "Santo António" },
  "Porto":            { month: 6, day: 24, name: "São João" },
  "Braga":            { month: 6, day: 24, name: "São João" },
  "Évora":            { month: 6, day: 29, name: "São Pedro" },
  "Coimbra":          { month: 7, day: 4,  name: "Rainha Santa Isabel" },
  "Aveiro":           { month: 5, day: 12, name: "Santa Joana" },
  "Viseu":            { month: 9, day: 21, name: "São Mateus" },
  "Setúbal":          { month: 9, day: 15, name: "Dia de Bocage" },
  "Faro":             { month: 9, day: 7,  name: "Dia do Município" },
  "Santarém":         { month: 3, day: 19, name: "São José" },
  "Sines":            { month: 11, day: 24, name: "Elevação a vila" },
  "Viana do Castelo": { month: 8, day: 20, name: "Senhora da Agonia" },
};

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DOW_FULL = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MON = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MON_FULL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Data local AAAA-MM-DD (toISOString usaria UTC e desviava um dia na hora de verão). */
function ymd(d){
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseYmd(s){
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d, n){ const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function dayDiff(a, b){ return Math.round((parseYmd(ymd(b)) - parseYmd(ymd(a))) / 864e5); }
function fmtDayMonth(dateStr){ const d = parseYmd(dateStr); return `${d.getDate()} ${MON[d.getMonth()]}`; }
function escHol(v){
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/* Feriados regionais da date.nager.at (counties) que se aplicam à cidade escolhida. */
const HOL_REGION = { "Funchal": "PT-30", "Ponta Delgada": "PT-20" };
/** Feriado obrigatório que se aplica à cidade: nacional, ou regional da região da cidade. O Carnaval ("Optional") fica de fora. */
function appliesTo(h, city){
  if(Array.isArray(h?.types) && !h.types.includes("Public")) return false;
  if(h?.global === false) return Array.isArray(h.counties) && h.counties.includes(HOL_REGION[city]);
  return true;
}

function municipalFor(city, year){
  const m = HOL_MUNIC[city];
  if(!m) return [];
  return [{ date: ymd(new Date(year, m.month - 1, m.day)), localName: m.name, type: "municipal", city }];
}

/**
 * Calcula o resumo a partir dos feriados nacionais (date.nager.at) de um ou mais anos.
 * Os dias úteis contam também o feriado municipal da cidade escolhida.
 * @param {{holsByYear: Object<string, Array<{date:string, localName:string}>>, today: Date, city?: string}} input
 */
function computeHolidaySummary({ holsByYear, today, city }){
  const t0 = parseYmd(ymd(today));
  const todayStr = ymd(t0);
  const years = Object.keys(holsByYear || {}).map(Number).filter(Number.isFinite).sort();
  const all = [];
  for(const y of years){
    (holsByYear[y] || []).forEach(h => {
      if(h?.date && appliesTo(h, city)) all.push({ date: h.date, localName: h.localName || h.name || "Feriado", type: h.global === false ? "regional" : "nacional" });
    });
    municipalFor(city, y).forEach(h => all.push(h));
  }
  all.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
  const holSet = new Set(all.map(h => h.date));
  const isWorkday = d => d.getDay() !== 0 && d.getDay() !== 6 && !holSet.has(ymd(d));

  // Mês atual
  const year = t0.getFullYear(), month = t0.getMonth();
  let monthTotal = 0, monthLeft = 0;
  for(let d = new Date(year, month, 1); d.getMonth() === month; d = addDays(d, 1)){
    if(isWorkday(d)){ monthTotal++; if(d >= t0) monthLeft++; }
  }
  // Até ao fim do ano
  let yearLeft = 0;
  for(let d = new Date(t0); d.getFullYear() === year; d = addDays(d, 1)) if(isWorkday(d)) yearLeft++;
  // Semanas (segunda a sexta)
  const monday = addDays(t0, -((t0.getDay() + 6) % 7));
  let weekLeft = 0, nextWeek = 0;
  for(let i = 0; i < 5; i++){
    const d = addDays(monday, i);
    if(isWorkday(d) && d >= t0) weekLeft++;
    if(isWorkday(addDays(monday, i + 7))) nextWeek++;
  }

  // Próximos feriados (o primeiro é o destaque)
  const upcoming = all.filter(h => h.date >= todayStr).slice(0, 5).map(h => {
    const d = parseYmd(h.date);
    return { ...h, days: dayDiff(t0, d), dow: DOW[d.getDay()], dowFull: DOW_FULL[d.getDay()], weekend: d.getDay() === 0 || d.getDay() === 6 };
  });

  // Pontes: feriado à terça (ponte na segunda) ou à quinta (ponte na sexta), nos próximos 6 meses
  const horizon = ymd(addDays(t0, 183));
  const bridges = [];
  for(const h of all){
    const d = parseYmd(h.date);
    const dow = d.getDay();
    if(dow !== 2 && dow !== 4) continue;
    const b = addDays(d, dow === 2 ? -1 : 1);
    const bStr = ymd(b);
    if(bStr < todayStr || bStr > horizon || holSet.has(bStr)) continue;
    bridges.push({ holiday: h.localName, holidayDate: h.date, type: h.type, bridgeDate: bStr, bridgeDow: DOW_FULL[b.getDay()] });
  }

  // Próximos 6 meses: dias úteis e feriados em dia de semana
  const months = [];
  for(let i = 0; i < 6; i++){
    const first = new Date(year, month + i, 1);
    const m = first.getMonth(), y = first.getFullYear();
    if(!years.includes(y)) break;
    let total = 0, hols = 0;
    for(let d = new Date(first); d.getMonth() === m; d = addDays(d, 1)){
      if(isWorkday(d)) total++;
      else if(d.getDay() !== 0 && d.getDay() !== 6) hols++;
    }
    months.push({ label: `${MON[m]}${y !== year ? ` ${String(y).slice(2)}` : ""}`, total, hols, current: i === 0 });
  }

  const yearList = all.filter(h => h.date.startsWith(`${year}-`)).map(h => ({ ...h, past: h.date < todayStr }));
  return { year, monthName: MON_FULL[month], monthTotal, monthLeft, yearLeft, weekLeft, nextWeek, upcoming, bridges, months, yearList, hasMunicipal: Boolean(HOL_MUNIC[city]) };
}

function readStale(key){
  try{
    const raw = localStorage.getItem(PFX + key);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed?.d) ? parsed.d : null;
  }catch{ return null; }
}
async function fetchYear(year, force){
  const key = `hols_${year}`;
  if(!force){
    const cached = lsGet(key);
    if(Array.isArray(cached) && cached.length) return cached;
  }
  try{
    const list = await fetchJsonFirstOk(`https://date.nager.at/api/v3/PublicHolidays/${year}/PT`, {}, 10000);
    if(!Array.isArray(list) || !list.length) throw new Error("resposta sem feriados");
    lsSet(key, list, { source: "date.nager.at", state: "live" });
    return list;
  }catch(e){
    const stale = readStale(key);
    if(stale) return stale;
    throw e;
  }
}
function getHolidaysCacheKey(){ return `hols_${new Date().getFullYear()}`; }
function currentCity(){
  try{ return IPMA_CITIES[CFG.IPMA_CITY_ID] || "Lisboa"; }catch{ return "Lisboa"; }
}

function renderHolidaySummary(s, city){
  const next = s.upcoming[0];
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const hero = next ? `<div class="hol-hero">
      <div class="hol-hero-num">${next.days}</div>
      <div><div class="hol-hero-sub">${next.days === 0 ? "hoje é feriado" : next.days === 1 ? "dia para o próximo feriado" : "dias para o próximo feriado"}</div>
        <div class="hol-hero-lbl">${escHol(next.localName)}${next.type === "municipal" ? ` <span class="hol-tag">municipal · ${escHol(city)}</span>` : ""}</div>
        <div class="hol-hero-sub">${next.dowFull}, ${parseYmd(next.date).getDate()} de ${MON_FULL[parseYmd(next.date).getMonth()]}</div></div>
    </div>` : "";

  const kpis = [
    [`${s.monthLeft}<small> de ${s.monthTotal}</small>`, `dias úteis restam em ${s.monthName}`],
    [s.weekLeft, "dias úteis restam esta semana"],
    [s.nextWeek, "dias úteis na próxima semana"],
    [s.yearLeft, `dias úteis até ao fim de ${s.year}`],
  ].map(([v, l]) => `<div class="hol-stat"><div class="hol-stat-val">${v}</div><div class="hol-stat-lbl">${l}</div></div>`).join("");

  const bridges = s.bridges.length ? `<div class="hol-sec">Pontes nos próximos 6 meses</div>${s.bridges.slice(0, 3).map(b => `<div class="hol-bridge">
      <b>${b.bridgeDow.replace(/^./, c => c.toUpperCase())}, ${fmtDayMonth(b.bridgeDate)}</b>
      <span>${escHol(b.holiday)} (${fmtDayMonth(b.holidayDate)})${b.type === "municipal" ? ` · municipal` : ""}: tirando este dia, ficam 4 dias seguidos</span>
    </div>`).join("")}${s.bridges.length > 3 ? `<div class="hol-more">+${s.bridges.length - 3} até ${fmtDayMonth(s.bridges[s.bridges.length - 1].bridgeDate)}</div>` : ""}` : "";

  const maxTotal = Math.max(23, ...s.months.map(m => m.total));
  const months = s.months.length ? `<div class="hol-sec">Próximos meses</div><div class="hol-months">${s.months.map(m => `
      <div class="hol-month${m.current ? " on" : ""}">
        <span class="hol-month-lbl">${m.label}</span>
        <span class="hol-month-bar"><span style="width:${Math.round(m.total / maxTotal * 100)}%"></span></span>
        <span class="hol-month-val">${plural(m.total, "útil", "úteis")}${m.hols ? ` · ${plural(m.hols, "feriado", "feriados")}` : ""}</span>
      </div>`).join("")}</div>` : "";

  const upcoming = s.upcoming.length ? `<div class="hol-sec">Próximos feriados</div><div class="hol-list">${s.upcoming.map(h => `
      <div class="hol-item${h.type === "municipal" ? " munic" : ""}">
        <span class="hol-date">${fmtDayMonth(h.date)}</span>
        <span class="hol-dow${h.weekend ? " we" : ""}">${h.dow}</span>
        <span class="hol-name">${escHol(h.localName)}${h.type !== "nacional" ? ` <span class="hol-tag">${h.type}</span>` : ""}</span>
        <span class="hol-in">${h.days === 0 ? "hoje" : `+${h.days}d`}</span>
      </div>`).join("")}</div>` : "";

  const yearList = `<details class="hol-year"><summary>Todos os feriados de ${s.year} (${s.yearList.length})</summary><div class="hol-list">${s.yearList.map(h => {
      const d = parseYmd(h.date);
      return `<div class="hol-item${h.past ? " past" : ""}${h.type === "municipal" ? " munic" : ""}">
        <span class="hol-date">${fmtDayMonth(h.date)}</span>
        <span class="hol-dow${d.getDay() === 0 || d.getDay() === 6 ? " we" : ""}">${DOW[d.getDay()]}</span>
        <span class="hol-name">${escHol(h.localName)}${h.type !== "nacional" ? ` <span class="hol-tag">${h.type}</span>` : ""}</span>
        <span class="hol-in">${h.past ? "✓" : ""}</span>
      </div>`;
    }).join("")}</div></details>`;

  const region = HOL_REGION[city] ? ` e regionais` : "";
  const munic = s.hasMunicipal ? `inclui o feriado municipal de ${escHol(city)}` : `sem feriado municipal registado para ${escHol(city)}`;
  return `${hero}<div class="hol-grid">${kpis}</div>${bridges}${months}${upcoming}${yearList}
    <div class="src">✦ date.nager.at · feriados nacionais${region} · ${munic} · cidade escolhida no topo da página</div>`;
}

async function loadHolidays(force=false){
  const body = $("hol-body");
  if(!body) return;
  body.innerHTML = skeletonGeneric(5);
  try{
    const today = new Date();
    const year = today.getFullYear();
    const holsByYear = { [year]: await fetchYear(year, force) };
    try{ holsByYear[year + 1] = await fetchYear(year + 1, force); }catch{ /* o ano seguinte é opcional */ }
    const city = currentCity();
    body.innerHTML = renderHolidaySummary(computeHolidaySummary({ holsByYear, today, city }), city);
    window.renderPortugalBriefing?.();
  }catch(e){
    body.innerHTML = er(e, { context: "Feriados", action: "clique em ↺ para tentar novamente" });
    notifyNonCriticalError("Feriados", e, "clique em ↺ para tentar novamente");
  }
}

  window.loadHolidays = loadHolidays;
  window.computeHolidaySummary = computeHolidaySummary;
  window.getHolidaysCacheKey = getHolidaysCacheKey;
})();
