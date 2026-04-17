/* ── Configurações centrais — separadas para fácil manutenção ── */
const CFG = {
  // Segurança: chave API removida do código cliente
  TD_KEY: null,

  // IPMA — cidade padrão (Lisboa)
  IPMA_CITY_ID: 1110600
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
  updated: "dados fixos · 27 Mar 2026",
  rates: [
    { term: "1S",  val: 2.853,  prev: 2.817 },
    { term: "1M",  val: 2.421,  prev: 2.385 },
    { term: "3M",  val: 2.582,  prev: 2.545 },
    { term: "6M",  val: 2.684,  prev: 2.648 },
    { term: "12M", val: 2.771,  prev: 2.734 }
  ],
  bce: "⏱ live indisponível",
  peak: { val: 2.853, month: "Jan 2026" },
  bceNext: "próxima sessão 14:30",
  spreadBancario: { tipico: 1.20, minimo: 0.80, maximo: 2.50 }
};

/* ── MIBGAS reference (spot mais recente) ── */
const MIBGAS_SPOT = 40.50; // €/MWh — atualizar manualmente quando houver novo valor

/* ── Spread TTF→MIBGAS por mês (referência sazonal) ── */
const MIBGAS_MONTHLY_SPREAD = {
  1: 2.8,  2: 3.2,  3: 3.5,  4: 3.8,  5: 4.2,  6: 4.6,
  7: 5.0,  8: 5.4,  9: 4.8, 10: 4.2, 11: 3.6, 12: 3.0
};

/* ── Tarifas elétricas PT (ERSE 2025-2026) ── */
const GAS_TARIFAS = {
  redes: 0.0524,   // €/kWh — tarifa acesso redes (média)
  totalEsc1: 0.1604, // €/kWh — tarifa total escalão 1 (4,6% IVA)
  totalEsc2: 0.1589, // €/kWh — tarifa total escalão 2 (6% IVA)
  termoFixo: 3.14   // €/mês — termo fixo (Simplex indexado)
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
