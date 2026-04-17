/* ── Configurações centrais — separadas para fácil manutenção ── */
const CFG = {
  // Segurança: chave API removida do código cliente
  TD_KEY: null,

  // IPMA — cidade padrão (Lisboa)
  IPMA_CITY_ID: 1110600,

  // Compatibilidade com fetch/proxy local em ambiente file://
  LOCAL_PROXY_PORT: 8000
};

/* ── Datas de referência (automáticas) ── */
const now = new Date();
const mesAtual = now.getMonth();
const anoAtual = now.getFullYear();
const quarterAtual = Math.floor(mesAtual / 3) + 1;
const quarterAnterior = quarterAtual === 1 ? 4 : quarterAtual - 1;
const anoQuarterAnterior = quarterAtual === 1 ? anoAtual - 1 : anoAtual;

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const REF_DATE = {
  full: `${MESES[mesAtual]} ${anoAtual}`,
  quarter: `Q${quarterAtual}/${anoAtual}`,
  prevQuarter: `Q${quarterAnterior}/${anoQuarterAnterior}`
};

/* ── Euribor fallback (valores fixos quando API falha) ── */
const EURIBOR_FALLBACK = {
  updated: "10 Mar 2026",
  rates: [
    { term: "1S",  termFull: "1 Semana", val: 1.888, prev: 2.012, color: "#06B6D4", hipot: false,
     desc: "Ref. overnight e swaps curtos" },
    { term: "1M",  termFull: "1 Mês",    val: 1.951, prev: 2.089, color: "#22D3EE", hipot: false,
     desc: "Ref. produtos curtos, tesouraria" },
    { term: "3M",  termFull: "3 Meses",  val: 2.138, prev: 2.503, color: "#3B82F6", hipot: true,
     desc: "Crédito habitação revisão trimestral" },
    { term: "6M",  termFull: "6 Meses",  val: 2.295, prev: 2.415, color: "#8B5CF6", hipot: true,
     desc: "Crédito habitação revisão semestral" },
    { term: "12M", termFull: "12 Meses", val: 2.552, prev: 2.350, color: "#A855F7", hipot: true,
     desc: "Crédito habitação revisão anual" },
  ],
  hist: [
    ["Mar 26", 2.138, 2.295, 2.552], ["Fev 26", 2.503, 2.415, 2.350],
    ["Jan 26", 2.612, 2.534, 2.478], ["Dez 25", 2.721, 2.648, 2.589],
    ["Nov 25", 2.869, 2.784, 2.718], ["Out 25", 3.054, 2.954, 2.871],
    ["Set 25", 3.124, 3.018, 2.936], ["Ago 25", 3.201, 3.089, 2.998],
  ],
  bce: { dep: 2.00, refin: 2.15, margLend: 2.40 },
  peak: { val: 4.160, date: "Out 2023" },
  bceNext: {
    date: "17 Abr 2026", expectativa: "Pausa",
    probCorte: 38, probPausa: 58, probSubida: 4,
    nota: "Mercados divididos. BCE aguarda dados inflação Mar/Abr antes de decidir."
  },
  spreadBancario: {
    min: 0.70, max: 1.50, tipico: 1.10,
    nota: "Spread médio do mercado PT em crédito habitação variável"
  }
};

/* ── MIBGAS reference (spot mais recente) ── */
const MIBGAS_SPOT = 40.50; // €/MWh — atualizar manualmente quando houver novo valor

/* ── Spread TTF→MIBGAS por mês (referência sazonal) ── */
const MIBGAS_MONTHLY_SPREAD = {
  1: 2.8,  2: 3.2,  3: 3.5,  4: 3.8,  5: 4.2,  6: 4.6,
  7: 5.0,  8: 5.4,  9: 4.8, 10: 4.2, 11: 3.6, 12: 3.0
};

/* ── Tarifas Gás Natural PT (ERSE 2025-2026) ── */
const GAS_TARIFAS = {
  /* Tarifa energia por escalão (kWh) */
  esc1: { label: "Esc. 1 (≤10 GJ/a)", kwh: 0.0974, desc: "Baixo consumo" },
  esc2: { label: "Esc. 2 (10-4000 GJ/a)", kwh: 0.0716, desc: "Consumo normal" },
  /* Tarifa de acesso às redes (BTN) */
  redes: 0.0821,
  /* Custo total estimado BTN c/ IVA 6% */
  totalEsc1: 0.1694 /* (0.0974+0.0821)*1.06 */,
  totalEsc2: 0.1527 /* (0.0716+0.0821)*1.06 */,
  /* Termo fixo mensal (capacidade) */
  termoFixo: 3.42 /* €/mês */,
  /* Ref MIBGAS spot Mar 2026 */
  mibgasSpot: 57.3,
  mibgasPrev: 46.2,
  mibgas7d: [36.8, 38.2, 46.1, 54.8, 58.2, 56.4, 57.3],
  /* TTF Day-ahead ref Mar 2026 */
  ttfSpot: 48.2,
  ttfPrev: 40.2,
  /* Spread MIBGAS-TTF */
  spread: 57.3 - 48.2,
};

/* ── IPMA — lista de cidades disponíveis ── */
const IPMA_CITIES = {
  1010500: "Aveiro",    1020500: "Beja",       1030300: "Braga",
  1030800: "Bragança",  1040200: "Castelo Branco", 1050200: "Coimbra",
  1060300: "Évora",     1070500: "Faro",      1080500: "Guarda",
  1100900: "Leiria",    1110600: "Lisboa",    1121400: "Portalegre",
  1131200: "Porto",     1141600: "Santarém",  1151200: "Setúbal",
  1151300: "Sines",     1160900: "Viana do Castelo", 1171400: "Vila Real",
  1182300: "Viseu",     2310300: "Funchal",   2320100: "Ponta Delgada"
};

/* ── IPMA — mapeamento meteorológico (id → [emoji, descrição]) ── */
const IPMA_WX = {
  1:  ["☀️",  "Céu limpo"],   2:  ["🌤️",  "Pouco nublado"],
  3:  ["⛅",   "Parcialmente nublado"], 4:  ["🌥️",  "Nublado"],
  5:  ["☁️",   "Muito nublado"], 6:  ["🌧️",  "Aguaceiros"],
  7:  ["🌧️",  "Chuva"],        8:  ["⛈️",   "Trovoada"],
  9:  ["❄️",   "Neve"],        10: ["🌫️",  "Nevoeiro"],
  11: ["🌦️",  "Aguaceiros fracos"],   12: ["🌦️",  "Aguaceiros moderados"],
  13: ["🌧️",  "Aguaceiros fortes"],   14: ["⛈️",   "Trovoada com chuva"],
  15: ["🌬️",  "Vento forte"],  16: ["🌡️",  "Calor intenso"],
  17: ["❄️",   "Granizo"],     18: ["🌩️",   "Trovoada"],
  19: ["🌨️",   "Aguaceiros de neve"], 22: ["🌦️",  "Chuva fraca"],
  23: ["🌧️",  "Chuva e trovoada"],    25: ["🌧️",  "Chuva e vento forte"],
  26: ["🌬️",  "Neblina"],     28: ["☁️",   "Céu encoberto"]
};

const IPMA_WIND = ["", "Fraco", "Fraco a mod.", "Moderado", "Forte", "Muito forte"];

const wxIPMA = (id) => IPMA_WX[id] || ["🌤️","—"];

// Backward compatibility: o restante código e handlers inline ainda esperam
// estes valores como globais clássicos acessíveis via `window`.
window.CFG = CFG;
window.REF_DATE = REF_DATE;
window.EURIBOR_FALLBACK = EURIBOR_FALLBACK;
window.MIBGAS_SPOT = MIBGAS_SPOT;
window.MIBGAS_MONTHLY_SPREAD = MIBGAS_MONTHLY_SPREAD;
window.GAS_TARIFAS = GAS_TARIFAS;
window.IPMA_CITIES = IPMA_CITIES;
window.IPMA_WX = IPMA_WX;
window.IPMA_WIND = IPMA_WIND;
window.wxIPMA = wxIPMA;
