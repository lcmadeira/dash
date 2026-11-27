/* global document, window, console, localStorage */
/* Salário mínimo (valor legal) e salário médio (INE, trimestral; data/salarios.json pelo cron,
   o INE não permite CORS), com a evolução dos dois e a comparação UE (mínimo: Eurostat earn_mw_cur;
   médio: Eurostat nama_10_fte, lido em direto com valores fixos de reserva). */
(() => {
const WAGES_CK = "salarios_v1";
const EU_CK = "wage_eu_v1";

const SMN_HIST=[
  {y:2017,v:557},{y:2018,v:580},{y:2019,v:600},{y:2020,v:635},
  {y:2021,v:665},{y:2022,v:705},{y:2023,v:760},{y:2024,v:820},
  {y:2025,v:870},{y:2026,v:920},
];

/* Eurostat earn_mw_cur, equivalência mensal bruta em jan. 2026. */
/* Espanha: último valor disponível, referente a 2025. */
const SMN_EU=[
  {c:"🇱🇺",n:"Luxemburgo", geo:"LU", v:2704},
  {c:"🇩🇪",n:"Alemanha",   geo:"DE", v:2343},
  {c:"🇳🇱",n:"Países Baixos",geo:"NL", v:2295},
  {c:"🇧🇪",n:"Bélgica",    geo:"BE", v:2112},
  {c:"🇫🇷",n:"França",     geo:"FR", v:1823},
  {c:"🇪🇸",n:"Espanha",    geo:"ES", v:1381},
  {c:"🇬🇷",n:"Grécia",     geo:"EL", v:1027},
  {c:"🇵🇹",n:"Portugal",   geo:"PT", v:1073},
  {c:"🇵🇱",n:"Polónia",    geo:"PL", v:1139},
  {c:"🇷🇴",n:"Roménia",    geo:"RO", v:795},
  {c:"🇧🇬",n:"Bulgária",   geo:"BG", v:620},
];

/* Eurostat nama_10_fte (salário médio anual por trabalhador a tempo inteiro, €), 2025.
   Reserva para quando a leitura em direto falha; lido a 27-11-2026. */
const AVG_EU_FALLBACK={ year:2025, values:{ EU27_2020:41464, LU:85609, DE:56360, NL:null, BE:61984, FR:44734, ES:35125, EL:18772, PT:26202, PL:23853, RO:20818, BG:16201 } };
const EU_URL="https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nama_10_fte?unit=EUR&format=JSON&lang=EN&sinceTimePeriod=2022"
  + ["EU27_2020", ...SMN_EU.map(r=>r.geo)].map(g=>`&geo=${g}`).join("");

const SMN=920, SMN_PREV=870;
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
let compareMode="min";

function readAny(key){
  try { return JSON.parse(localStorage.getItem((window.PFX || "") + key) || "null")?.d ?? null; } catch { return null; }
}
const cached = key => (typeof window.lsGet === "function" ? window.lsGet(key) : null) || readAny(key);

/** Eurostat JSON-stat → { year, values: {geo: €/ano} } com o último ano que tem Portugal. */
function parseEuAverage(json){
  const geo=json?.dimension?.geo?.category?.index, time=json?.dimension?.time?.category?.index, val=json?.value;
  if(!geo || !time || !val) return null;
  const years=Object.entries(time).sort((a,b)=>b[1]-a[1]);
  const nt=Object.keys(time).length;
  const at=(g,ti)=>{ const v=Number(val[String(geo[g]*nt+ti)]); return Number.isFinite(v)&&v>0?v:null; };
  const pick=years.find(([,ti])=>geo.PT!==undefined && at("PT",ti));
  if(!pick) return null;
  const values={};
  Object.keys(geo).forEach(g=>{ values[g]=at(g,pick[1]); });
  return { year:Number(pick[0]), values };
}

/** Real ≈ nominal descontada a inflação (ambas homólogas, em %). */
function realChange(nominal, inflation){
  if(!Number.isFinite(nominal) || !Number.isFinite(inflation)) return null;
  return Math.round(((1+nominal/100)/(1+inflation/100)-1)*1000)/10;
}

/** Mínimo (×14/12, como o Eurostat) e médio por ano; médio do ano corrente = últimos 12 meses. */
function wageSeries(wages){
  const avgByYear=new Map((wages?.annual||[]).map(r=>[r.y,r.avg]));
  const lastYear=SMN_HIST.at(-1).y;
  if(Number.isFinite(wages?.avg12m) && !avgByYear.has(lastYear)) avgByYear.set(lastYear, wages.avg12m);
  return SMN_HIST.map(r=>{
    const min=Math.round(r.v*14/12), avg=avgByYear.get(r.y)??null;
    return { y:r.y, min, avg, ratio: avg ? Math.round(min/avg*100) : null, partial: r.y===lastYear && !(wages?.annual||[]).some(a=>a.y===r.y) };
  });
}

/** Inflação homóloga (IHPC) média dos 3 meses do trimestre; se faltar algum, o mês mais recente. */
function quarterInflation(rows, q){
  if(!Array.isArray(rows) || !rows.length) return null;
  const m=/^(\d{4})-Q([1-4])$/.exec(String(q||""));
  const key=r=>{ const x=/^(\p{L}{3})\p{L}* (\d{4})$/u.exec(String(r?.m||"").trim()); const i=x?MON.indexOf(x[1].toLowerCase()):-1; return i<0?null:`${x[2]}-${i+1}`; };
  if(m){
    const want=[0,1,2].map(k=>`${m[1]}-${(m[2]-1)*3+1+k}`);
    const vals=want.map(w=>Number(rows.find(r=>key(r)===w)?.pt));
    if(vals.every(Number.isFinite)) return { value: Math.round(vals.reduce((a,b)=>a+b,0)/3*10)/10, label: `média ${MON[(m[2]-1)*3]}–${MON[m[2]*3-1]} ${m[1]}` };
  }
  const v=Number(rows[0]?.pt);
  return Number.isFinite(v) ? { value: v, label: String(rows[0].m||"") } : null;
}

const sign = v => v>0?"▲":v<0?"▼":"=";
const pct1 = v => `${window.nf(Math.abs(v),1)}%`;
const qLabel = q => { const m=/^(\d{4})-Q([1-4])$/.exec(String(q||"")); return m?`${m[2]}.º trim. ${m[1]}`:String(q||""); };
const MON=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const qRange = (from,to) => {
  const f=/^(\d{4})-Q([1-4])$/.exec(from||""), t=/^(\d{4})-Q([1-4])$/.exec(to||"");
  if(!f||!t) return "";
  return `${MON[(f[2]-1)*3]} ${f[1].slice(2)}–${MON[t[2]*3-1]} ${t[1].slice(2)}`;
};

function avgBlock(wages){
  if(!wages?.latest) return `<div class="wg-box wg-muted">Salário médio (INE) indisponível de momento.</div>`;
  const l=wages.latest;
  const qi=quarterInflation(readAny("inflation_eurostat_v2")?.rows, l.q);
  const inf=qi?.value;
  const real=realChange(l.yoy, inf);
  return `<div class="wg-box">
    <div class="wg-k">Salário médio · INE · bruto</div>
    <div class="wg-hero"><b>${window.nf(wages.avg12m,0)}</b><span>€/mês</span></div>
    <div class="wg-sub">média dos últimos 12 meses (${qRange(wages.avg12mFrom,l.q)}), com subsídios${Number.isFinite(wages.avg12mYoy)?` · <span class="${wages.avg12mYoy>=0?"wg-up":"wg-down"}">${sign(wages.avg12mYoy)} ${pct1(wages.avg12mYoy)} num ano</span>`:""}</div>
    <div class="wg-row"><span>${qLabel(l.q)}</span><b>${window.nf(l.total,0)} €</b>${Number.isFinite(l.yoy)?`<em class="${l.yoy>=0?"wg-up":"wg-down"}">${sign(l.yoy)} ${pct1(l.yoy)}</em>`:""}</div>
    ${Number.isFinite(l.regular)?`<div class="wg-row"><span>sem subsídios nem prémios</span><b>${window.nf(l.regular,0)} €</b>${Number.isFinite(l.regularYoy)?`<em>${sign(l.regularYoy)} ${pct1(l.regularYoy)}</em>`:""}</div>`:""}
    ${real!==null?`<div class="wg-row"><span>ganho real (inflação ${window.nf(inf,1)}%, ${esc(qi.label)})</span><em class="${real>=0?"wg-up":"wg-down"}">${sign(real)} ${pct1(real)}</em></div>`:""}
  </div>`;
}

function chartBlock(wages){
  const s=wageSeries(wages);
  const withAvg=s.filter(r=>r.avg);
  if(withAvg.length<2) return "";
  const W=260,H=96,P=4;
  const mx=Math.max(...s.map(r=>Math.max(r.min,r.avg||0)));
  const mn=Math.min(...s.map(r=>r.min));
  const lo=Math.floor(mn*0.9/100)*100, hi=Math.ceil(mx*1.04/100)*100;
  const px=i=>Math.round(P+i/(s.length-1)*(W-2*P));
  const py=v=>Math.round(H-(v-lo)/(hi-lo)*H);
  const line=key=>s.map((r,i)=>r[key]?`${px(i)},${py(r[key])}`:null).filter(Boolean).join(" ");
  const first=withAvg[0], last=withAvg.at(-1);
  return `<div class="wg-box">
    <div class="wg-k">Mínimo vs médio · €/mês brutos</div>
    <svg class="wg-chart" viewBox="0 0 ${W} ${H+14}" role="img" aria-label="Evolução do salário mínimo e do salário médio de ${first.y} a ${last.y}">
      <polyline points="${line("avg")}" fill="none" stroke="var(--accent)" stroke-width="2"/>
      <polyline points="${line("min")}" fill="none" stroke="#10B981" stroke-width="2"/>
      ${s.map((r,i)=>r.avg?`<circle cx="${px(i)}" cy="${py(r.avg)}" r="${r.partial?3:2}" fill="${r.partial?"var(--bg,#111)":"var(--accent)"}" stroke="var(--accent)" stroke-width="1.2"><title>${r.y}${r.partial?" (últimos 12 meses)":""}: médio ${r.avg} € · mínimo ${r.min} € (${r.ratio}%)</title></circle>`:"").join("")}
      ${s.map((r,i)=>`<circle cx="${px(i)}" cy="${py(r.min)}" r="2" fill="#10B981"><title>${r.y}: mínimo ${r.min} €/mês (×14/12)</title></circle>`).join("")}
      <text x="${px(0)}" y="${H+12}" font-size="8" fill="var(--t3)">${s[0].y}</text>
      <text x="${px(s.length-1)}" y="${H+12}" font-size="8" fill="var(--t3)" text-anchor="end">${s.at(-1).y}</text>
      <text x="${px(s.length-1)}" y="${Math.max(9,py(last.avg)-6)}" font-size="8" fill="var(--accent)" text-anchor="end">${last.avg} €</text>
      <text x="${px(s.length-1)}" y="${py(s.at(-1).min)+12}" font-size="8" fill="#10B981" text-anchor="end">${s.at(-1).min} €</text>
    </svg>
    <div class="wg-legend"><span><i style="background:var(--accent)"></i>médio (INE, média anual)</span><span><i style="background:#10B981"></i>mínimo ×14/12</span></div>
    <div class="wg-ratio">O mínimo vale <b>${last.ratio}%</b> do salário médio${first.y!==last.y?` (${first.ratio}% em ${first.y})`:""}.</div>
  </div>`;
}

function compareBlock(){
  const eu=cached(EU_CK)||AVG_EU_FALLBACK;
  const isAvg=compareMode==="avg";
  const rows=SMN_EU.map(r=>({ ...r, v: isAvg ? (eu.values?.[r.geo] ? Math.round(eu.values[r.geo]/12) : null) : r.v }))
    .filter(r=>Number.isFinite(r.v)).sort((a,b)=>b.v-a.v);
  if(isAvg && Number.isFinite(eu.values?.EU27_2020)) rows.push({ c:"🇪🇺", n:"Média UE", geo:"EU", v:Math.round(eu.values.EU27_2020/12), ref:true });
  const max=Math.max(...rows.map(r=>r.v));
  const btn=(mode,label)=>`<button type="button" class="wg-tab" aria-pressed="${compareMode===mode}" onclick="window.setSmnCompare('${mode}')">${label}</button>`;
  return `<div class="wg-cmp-h">
      <div><div class="wg-cmp-t">Comparação UE · Eurostat ${isAvg?eu.year:"jan. 2026"}</div>
      <div class="wg-cmp-s">${isAvg?"Salário médio a tempo inteiro · anual ÷ 12":"Bruto mensal equivalente · Espanha: dado de 2025"}</div></div>
      <div class="wg-tabs" role="group" aria-label="Comparar">${btn("min","Mínimo")}${btn("avg","Médio")}</div>
    </div>
    ${rows.map(r=>{
      const ispt=r.geo==="PT";
      return `<div class="wg-bar${ispt?" pt":""}${r.ref?" ref":""}">
        <span>${r.c}</span><span class="n">${r.n}</span>
        <div class="t"><div style="width:${Math.round(r.v/max*100)}%"></div></div>
        <span class="v">${window.nf(r.v,0)}€</span>
      </div>`;
    }).join("")}
    ${isAvg?`<div class="wg-cmp-s" style="margin-top:4px">Sem dado para os Países Baixos. Não é o mesmo indicador do INE: conta só tempo inteiro e divide o ano por 12.</div>`:""}`;
}

function render(el){
  const wages=cached(WAGES_CK);
  const yoy=((SMN-SMN_PREV)/SMN_PREV*100).toFixed(1);
  const smnEurostat=Math.round(SMN*14/12);
  const vals=SMN_HIST.map(x=>x.v);
  const mn=Math.min(...vals),mx=Math.max(...vals),rng=mx-mn||1;
  const W=180,H=40;
  const px=i=>Math.round(i/(vals.length-1)*W);
  const py=v=>Math.round(H-(v-mn)/rng*H);
  const pts=vals.map((v,i)=>`${px(i)},${py(v)}`).join(" ");
  const fill=pts+` ${W},${H+1} 0,${H+1}`;

  el.innerHTML=`
  <div class="wg-grid">
    <div>
      <div class="wg-box">
        <div class="wg-k">SMN legal Portugal 2026 · bruto</div>
        <div class="wg-hero wg-min"><b>${window.nfr(SMN)}</b><span>€/mês</span></div>
        <div class="wg-sub wg-up">▲ ${window.nfr(yoy)}% vs 2025 (870€) · 14 pagamentos/ano</div>
        <svg viewBox="0 0 ${W} ${H+10}" style="width:100%;height:${H+10}px;margin-top:5px" aria-hidden="true">
          <polygon points="${fill}" fill="#10B98118"/>
          <polyline points="${pts}" fill="none" stroke="#10B981" stroke-width="1.8"/>
          <circle cx="${px(vals.length-1)}" cy="${py(SMN)}" r="3" fill="#10B981"/>
          <text x="1" y="${H+9}" font-size="7" fill="#4A526A">2017: 557€</text>
          <text x="${W}" y="${H+9}" font-size="7" fill="#10B981" text-anchor="end">2026: ${window.nfr(SMN)}€</text>
        </svg>
        <div class="wg-sub">+65% em 9 anos</div>
      </div>
      ${avgBlock(wages)}
      <div id="smn-compare">${compareBlock()}</div>
    </div>

    <div>
      ${chartBlock(wages)}
      <div class="wg-k" style="margin:2px 0 5px">Como comparar os valores</div>
      <div class="wg-note">
        Em Portugal, o salário mínimo é pago em 14 prestações anuais. O valor legal de
        <b>920€ × 14</b> corresponde a
        <b class="wg-up">${window.nfr(smnEurostat)}€ brutos/mês</b> quando distribuído por 12 meses,
        como faz o Eurostat para comparar países.
      </div>
      <div class="wg-note">
        O salário médio do INE é a remuneração bruta declarada à Segurança Social e à CGA por cada
        posto de trabalho, incluindo tempo parcial. Os subsídios de férias e de Natal entram no mês
        em que são pagos (junho e dezembro), por isso o card usa a média de 12 meses.
      </div>
      <div class="wg-note">
        São valores brutos nominais. Não descontam impostos nem ajustam diferenças de preços
        entre países; por isso, não medem diretamente o poder de compra ou o custo de vida.
      </div>
    </div>
  </div>`;
}

async function loadWages(force){
  if(!force && window.lsGet?.(WAGES_CK)) return false;
  if(typeof window.fetchJsonFirstOk!=="function") return false;
  try{
    const url=new URL("data/salarios.json", window.location.href).href;
    const data=await window.fetchJsonFirstOk(url,{cache:"no-cache"},15000,["direct"],p=>Number.isFinite(p?.latest?.total)&&Number.isFinite(p?.avg12m));
    window.lsSet?.(WAGES_CK,data,{source:data._meta?.source||"INE",state:"live",observedAt:data._meta?.observedAt});
    return true;
  }catch(e){ console.debug?.("Salário médio: a usar a última cópia", e?.message||e); return false; }
}

async function loadEuAverage(force){
  if(!force && window.lsGet?.(EU_CK)) return false;
  if(typeof window.fetchJsonFirstOk!=="function") return false;
  try{
    const json=await window.fetchJsonFirstOk(EU_URL,{},15000,["direct"],j=>!!parseEuAverage(j));
    window.lsSet?.(EU_CK,parseEuAverage(json),{source:"Eurostat nama_10_fte",state:"live"});
    return true;
  }catch(e){ console.debug?.("Salário médio UE: valores fixos", e?.message||e); return false; }
}

function loadSMN(force){
  const el=document.getElementById("smn-body");
  if(!el) return;
  render(el);
  Promise.all([loadWages(force), loadEuAverage(force)]).then(([w,e])=>{
    if(w||e) render(el);
    window.refreshCardStatusFromCache?.("smn", WAGES_CK);
  }).catch(()=>{});
}

window.setSmnCompare = mode => {
  compareMode = mode==="avg" ? "avg" : "min";
  const box=document.getElementById("smn-compare");
  if(box) box.innerHTML=compareBlock();
};
window.loadSMN = loadSMN;
window.smnWageSeries = wageSeries;
window.smnRealChange = realChange;
window.smnQuarterInflation = quarterInflation;
window.parseEuAverageWages = parseEuAverage;
})();
