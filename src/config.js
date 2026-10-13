/* ── Configurações centrais — separadas para fácil manutenção ── */
const CFG = {
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
  updated: "17 Set 2026",
  rates: [
    { term: "1S",  termFull: "1 Semana", val: 2.240, prev: 2.149, color: "#06B6D4", hipot: false,
     desc: "Ref. overnight e swaps curtos" },
    { term: "1M",  termFull: "1 Mês",    val: 2.460, prev: 2.221, color: "#22D3EE", hipot: false,
     desc: "Ref. produtos curtos, tesouraria" },
    { term: "3M",  termFull: "3 Meses",  val: 2.682, prev: 2.513, color: "#3B82F6", hipot: true,
     desc: "Crédito habitação revisão trimestral" },
    { term: "6M",  termFull: "6 Meses",  val: 2.946, prev: 2.713, color: "#8B5CF6", hipot: true,
     desc: "Crédito habitação revisão semestral" },
    { term: "12M", termFull: "12 Meses", val: 3.326, prev: 2.954, color: "#A855F7", hipot: true,
     desc: "Crédito habitação revisão anual" },
  ],
  hist: [
    ["Ago 26", 2.513, 2.713, 2.954], ["Jul 26", 2.425, 2.647, 2.855],
    ["Jun 26", 2.339, 2.596, 2.798], ["Mai 26", 2.226, 2.536, 2.804],
    ["Abr 26", 2.175, 2.454, 2.747], ["Mar 26", 2.138, 2.295, 2.552],
    ["Fev 26", 2.503, 2.415, 2.350], ["Jan 26", 2.612, 2.534, 2.478],
  ],
  bce: { dep: 2.50, refin: 2.65, margLend: 2.90 },
  peak: { val: 4.160, date: "Out 2023" },
  bceNext: {
    date: "29 Out 2026", expectativa: "Pausa / Dados-dependente",
    probCorte: 10, probPausa: 55, probSubida: 35,
    nota: "Mercados avaliam impacto dos preços de energia e inflação de serviços antes da reunião de Outubro."
  },
  spreadBancario: {
    min: 0.70, max: 1.50, tipico: 1.10,
    nota: "Spread médio do mercado PT em crédito habitação variável"
  }
};

/* ── MIBGAS reference (spot mais recente) ── */
const MIBGAS_SPOT = 81.20; // €/MWh — atualizar manualmente quando houver novo valor

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
  /* Ref MIBGAS spot Set 2026 */
  mibgasSpot: 81.2,
  mibgasPrev: 57.3,
  mibgas7d: [68.5, 72.0, 74.8, 77.4, 79.1, 80.5, 81.2],
  /* TTF Day-ahead ref Set 2026 */
  ttfSpot: 78.5,
  ttfPrev: 53.3,
  /* Spread MIBGAS-TTF */
  spread: 81.2 - 78.5,
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

/* ── PSI20 · constituintes (actualizar fallbacks mensalmente) ── */
const PSI20_CONST = [
  {sym:"edp.ls",    yf:"EDP.LS",  label:"EDP",              ico:"⚡", sector:"Energia",      col:"#3B82F6", fallback:4.12,  fChg:-0.9},
  {sym:"galp.ls",   yf:"GALP.LS", label:"Galp",             ico:"🛢️", sector:"Energia",      col:"#F59E0B", fallback:11.34, fChg: 0.4},
  {sym:"jmt.ls",    yf:"JMT.LS",  label:"Jerónimo Martins", ico:"🛒", sector:"Distribuição", col:"#10B981", fallback:16.80, fChg:-1.2},
  {sym:"bcp.ls",    yf:"BCP.LS",  label:"Millennium BCP",   ico:"🏦", sector:"Banca",        col:"#8B5CF6", fallback:0.338, fChg: 1.8},
  {sym:"nos.ls",    yf:"NOS.LS",  label:"NOS",              ico:"📡", sector:"Telecom",      col:"#06B6D4", fallback:3.72,  fChg: 0.2},
  {sym:"son.ls",    yf:"SON.LS",  label:"Sonae",            ico:"🏪", sector:"Distribuição", col:"#F97316", fallback:0.845, fChg:-0.5},
  {sym:"rene.ls",   yf:"RENE.LS", label:"REN",              ico:"🔌", sector:"Energia",      col:"#22D3EE", fallback:2.49,  fChg: 0.0},
  {sym:"ctt.ls",    yf:"CTT.LS",  label:"CTT",              ico:"📬", sector:"Serviços",     col:"#A855F7", fallback:5.84,  fChg: 1.1},
];

/* ── Índices Europeus ── */
const EU_INDICES = [
  {sym:"^psi20",    yf:"^PSI20",   label:"PSI 20",      flag:"🇵🇹", col:"#10B981", fallback:9178,  fChg: 0.6},
  {sym:"^dax",      yf:"^GDAXI",   label:"DAX",         flag:"🇩🇪", col:"#3B82F6", fallback:22890, fChg: 0.3},
  {sym:"^cac",      yf:"^FCHI",    label:"CAC 40",      flag:"🇫🇷", col:"#8B5CF6", fallback:8142,  fChg:-0.2},
  {sym:"^ibex",     yf:"^IBEX",    label:"IBEX 35",     flag:"🇪🇸", col:"#F59E0B", fallback:13120, fChg: 0.5},
  {sym:"^ftse",     yf:"^FTSE",    label:"FTSE 100",    flag:"🇬🇧", col:"#06B6D4", fallback:8540,  fChg: 0.1},
  {sym:"^stoxx50e", yf:"^STOXX50E",label:"EURO STOXX",  flag:"🇪🇺", col:"#A855F7", fallback:5480,  fChg: 0.2},
];

/* ── Inflação fallback (estático se API falhar) ── */
const INFLATION_FALLBACK = [
  {m:"Set 2026",pt:3.6,eu:3.8},
  {m:"Ago 2026",pt:3.6,eu:3.2},
  {m:"Jul 2026",pt:3.6,eu:2.9},
  {m:"Jun 2026",pt:3.1,eu:2.8},
  {m:"Mai 2026",pt:3.1,eu:3.2},
  {m:"Abr 2026",pt:3.3,eu:3.0},
];

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
window.PSI20_CONST = PSI20_CONST;
window.EU_INDICES = EU_INDICES;
window.INFLATION_FALLBACK = INFLATION_FALLBACK;
