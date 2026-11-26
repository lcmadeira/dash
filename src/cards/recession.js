/* global $, AbortSignal, PFX, _lastN, fetchTextFirstOk, ld, localStorage, lsGet, lsSet, window */
(() => {
/* ══════════════════════════════════════════════════════════════
   INDICADOR RECESSÃO — US 10Y-2Y Spread
   Fonte principal: curva diária do Tesouro dos EUA (home.treasury.gov, CSV com CORS aberto).
   Alternativa: FRED T10Y2Y (deixou de responder de forma fiável em 2026).
   ══════════════════════════════════════════════════════════════ */
const TREASURY_CSV = year => "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/"
  + `${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;

/** CSV da curva do Tesouro → [[AAAA-MM-DD, spread 10Y−2Y em pp]] por ordem cronológica. */
function parseTreasuryCurve(csv){
  const lines = String(csv || "").trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const head = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
  const i2 = head.indexOf("2 Yr"), i10 = head.indexOf("10 Yr");
  if (head[0] !== "Date" || i2 < 0 || i10 < 0) return [];
  return lines.slice(1).map(line => {
    const cols = line.split(",");
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(cols[0] || "");
    const y2 = parseFloat(cols[i2]), y10 = parseFloat(cols[i10]);
    if (!m || !Number.isFinite(y2) || !Number.isFinite(y10)) return null;
    return [`${m[3]}-${m[1]}-${m[2]}`, Number((y10 - y2).toFixed(2))];
  }).filter(Boolean).sort((a, b) => a[0].localeCompare(b[0]));
}

async function fetchTreasurySpread(){
  const year = new Date().getFullYear();
  const get = y => fetchTextFirstOk(TREASURY_CSV(y), {signal:AbortSignal.timeout(10000)}, 10000, ["direct"],
    text => text.startsWith("Date,"));
  let rows = parseTreasuryCurve(await get(year));
  if (rows.length < 90) {
    try { rows = [...parseTreasuryCurve(await get(year - 1)), ...rows]; } catch { /* basta o ano corrente */ }
  }
  return rows.slice(-90);
}
const REC_TREND_PREF_KEY = 'rec_trend_pref_v1';
const REC_FALLBACK_DATA = [
  ["2024-01-05",-1.39],["2024-02-02",-1.35],["2024-03-01",-1.22],["2024-04-05",-1.08],
  ["2024-05-03",-0.95],["2024-06-07",-0.82],["2024-07-05",-0.68],["2024-08-09",-0.48],
  ["2024-09-06",-0.32],["2024-10-04",-0.15],["2024-11-01",-0.08],["2024-12-06",-0.25],
  ["2025-01-03",-0.38],["2025-02-07",-0.35],["2025-03-07",-0.25],["2025-04-04",-0.12],
  ["2025-05-02",0.02],["2025-06-06",0.12],["2025-07-04",0.22],["2025-08-01",0.32],
  ["2025-09-05",0.18],["2025-10-03",0.08],["2025-11-07",-0.05],["2025-12-05",-0.18],
  ["2026-01-02",-0.28],["2026-01-16",-0.32],["2026-02-06",-0.38],["2026-02-27",-0.35],
  ["2026-03-10",-0.30],
];
function getRecTrendPref() {
  try {
    const raw = localStorage.getItem(PFX + REC_TREND_PREF_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const days = [7, 30, 90].includes(parsed?.days) ? parsed.days : 90;
    return { days };
  } catch {
    return { days: 90 };
  }
}
function setRecTrendPref(patch) {
  const cur = getRecTrendPref();
  const next = { ...cur, ...patch };
  try { localStorage.setItem(PFX + REC_TREND_PREF_KEY, JSON.stringify(next)); } catch {}
  return next;
}
function setRecTrendDays(days) {
  setRecTrendPref({ days });
  loadRec(false).catch(() => {});
}

async function loadRec(force=false){
  const el=$("rec-body"); if(!el)return;
  el.innerHTML=ld();
  const ck="rec_v5";
  let data=force?null:lsGet(ck);

  if(!data||!data.length){
    try{
      const rows=await fetchTreasurySpread();
      if(rows.length>20){data=rows;lsSet(ck,data,{source:"US Treasury · curva diária (10Y−2Y)",state:"live",observedAt:data[data.length-1]?.[0]});window.refreshCardStatusFromCache?.("rec",ck);}
    }catch{ /* segue para a FRED */ }
  }
  if(!data||!data.length){
    try{
      const csv=await fetchTextFirstOk("https://fred.stlouisfed.org/graph/fredgraph.csv?id=T10Y2Y",
        {signal:AbortSignal.timeout(6000)},6000,["allorigins","corsproxy"],text=>text.startsWith("observation_date,"));
      const rows=csv.trim().split("\n").slice(1)
        .map(l=>{const[dt,v]=l.split(",");return[dt,parseFloat(v)];})
        .filter(x=>Number.isFinite(x[1]));
      if(rows.length>20){data=rows.slice(-90);lsSet(ck,data,{source:"FRED · T10Y2Y",state:"live",observedAt:data[data.length-1]?.[0]});}
    }catch{}
    if(!data||!data.length) data=REC_FALLBACK_DATA;
  }

  data=Array.isArray(data)
    ?data.filter(row=>Array.isArray(row)&&/^\d{4}-\d{2}-\d{2}$/.test(row[0])&&Number.isFinite(row[1]))
    :[];
  if(!data.length)data=REC_FALLBACK_DATA;

  const pref = getRecTrendPref();
  const view = _lastN(data, pref.days);
  const cur=view[view.length-1][1];
  const prev=view[view.length-2]?.[1]??cur;
  const delta=cur-prev;
  const isInv=cur<0;
  const col=isInv?"#EF4444":cur<0.3?"#F59E0B":"#10B981";
  const signal=isInv?"⚠ INVERTIDA":"✓ Normal";
  const signalSub=isInv?"sinal histórico de recessão":"sem sinal de recessão";
  const lastDate=view[view.length-1][0];
  const isLive=data.length>30;

  const vals=view.map(x=>x[1]);
  const mn=Math.min(...vals), mx=Math.max(...vals), rng=mx-mn||1;

  /* Sparkline principal */
  const W=220, H=60;
  const px=i=>Math.round(i/(vals.length-1)*W);
  const py=v=>Math.round(H-(v-mn)/rng*H);
  const pts=vals.map((v,i)=>`${px(i)},${py(v)}`).join(" ");
  const fill=pts+` ${W},${H+2} 0,${H+2}`;

  /* Meses marcadores */
  const ticks=view.filter((_,i)=>i%4===0).map(d2=>{
    const i=view.indexOf(d2);
    const mo=d2[0].slice(0,7).slice(5,7)+"/"+d2[0].slice(2,4);
    return `<text x="${px(i)}" y="${H+14}" font-size="7" fill="#4A526A" text-anchor="middle">${window.nfr(mo)}</text>`;
  }).join("");

  /* Zero line */
  /* Com o spread todo acima (ou abaixo) de zero, py(0) sai do gráfico:
     limita-se o corte a [0, H+2] e só se desenha a linha zero se estiver visível. */
  const zeroLineY=py(0);
  const clipY=Math.min(Math.max(zeroLineY,0),H+2);
  const showZero=zeroLineY>=0&&zeroLineY<=H;

  /* Indicadores complementares: histórico de inversões */
  const invertedDays=view.filter(x=>x[1]<0).length;
  const pctInverted=Math.round(invertedDays/view.length*100);
  const longestRun=(()=>{
    let max=0,cur2=0;
    view.forEach(x=>{cur2=x[1]<0?cur2+1:0;if(cur2>max)max=cur2;});
    return max;
  })();

  el.innerHTML=`
  <!-- Header: valor + sinal -->
  <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px">
    <div>
      <div style="font-size:2.6rem;font-weight:900;color:${col};line-height:1;letter-spacing:-1px">
        ${cur>=0?"+":""}${window.nf(cur, 2)}<span style="font-size:.9rem;font-weight:400">pp</span>
      </div>
      <div style="font-size:.74rem;color:var(--t3);margin-top:1px">
        ${delta>=0?"▲":"▼"} ${window.nf(Math.abs(delta), 2)}pp vs anterior
      </div>
    </div>
    <div style="flex:1">
      <div style="font-size:.78rem;font-weight:700;color:${col}">10Y − 2Y Spread</div>
      <div style="font-size:.74rem;color:var(--t2);margin-top:2px">${window.nfr(signal)} · ${window.nfr(signalSub)}</div>
      <div style="font-size:.74rem;color:var(--t3);margin-top:2px">${lastDate}${isLive?" · Tesouro EUA":" · ref. Mar 2026"}</div>
    </div>
  </div>

  <div style="display:flex;justify-content:flex-end;gap:4px;margin:-6px 0 10px">
    <button class="rbtn ${pref.days===7?'on':''}"  onclick="setRecTrendDays(7)">7D</button>
    <button class="rbtn ${pref.days===30?'on':''}" onclick="setRecTrendDays(30)">30D</button>
    <button class="rbtn ${pref.days===90?'on':''}" onclick="setRecTrendDays(90)">90D</button>
  </div>

  <!-- Gráfico com zona acima/abaixo de zero -->
  <svg viewBox="0 0 ${W} ${H+18}" style="width:100%;height:${H+18}px;margin-bottom:8px">
    <!-- Área negativa (abaixo de zero) -->
    <clipPath id="clip-neg"><rect x="0" y="${clipY}" width="${W}" height="${H+2-clipY}"/></clipPath>
    <!-- Área positiva (acima de zero) -->
    <clipPath id="clip-pos"><rect x="0" y="0" width="${W}" height="${clipY}"/></clipPath>
    <polygon points="${fill}" fill="#EF444415" clip-path="url(#clip-neg)"/>
    <polygon points="${fill}" fill="#10B98115" clip-path="url(#clip-pos)"/>
    <!-- Linha zero -->
    ${showZero?`<line x1="0" y1="${zeroLineY}" x2="${W}" y2="${zeroLineY}"
          stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="4,3"/>
    <text x="2" y="${zeroLineY-2}" font-size="7" fill="rgba(255,255,255,0.3)">0</text>`:""}
    <!-- Linha do spread -->
    <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2"/>
    <circle cx="${px(vals.length-1)}" cy="${py(cur)}" r="3.5" fill="${col}"/>
    <!-- Ticks de mês -->
    ${window.nfr(ticks)}
  </svg>

  <!-- Stats em grelha 2x2 -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:8px">
    <div style="background:var(--b2);border-radius:6px;padding:5px 6px">
      <div style="font-size:.74rem;color:var(--t3)">Mínimo</div>
      <div style="font-size:.82rem;font-weight:700;color:var(--red)">${window.nf(mn, 2)}pp</div>
    </div>
    <div style="background:var(--b2);border-radius:6px;padding:5px 6px">
      <div style="font-size:.74rem;color:var(--t3)">Máximo</div>
      <div style="font-size:.82rem;font-weight:700;color:var(--green)">+${window.nf(mx, 2)}pp</div>
    </div>
    <div style="background:var(--b2);border-radius:6px;padding:5px 6px">
      <div style="font-size:.74rem;color:var(--t3)">Leituras negativas</div>
      <div style="font-size:.82rem;font-weight:700;color:var(--amber)">${window.nfr(pctInverted)}%</div>
    </div>
    <div style="background:var(--b2);border-radius:6px;padding:5px 6px">
      <div style="font-size:.74rem;color:var(--t3)">Sequência máx</div>
      <div style="font-size:.82rem;font-weight:700;color:${col}">${window.nfr(longestRun)}</div>
    </div>
  </div>

  <!-- Contexto histórico -->
    <div style="background:${col}11;border-left:3px solid ${col};border-radius:0 5px 5px 0;
       padding:6px 10px;font-size:.74rem;color:var(--t2);line-height:1.5">
    ${isInv
      ? `<b style="color:${col}">Curva invertida em ${window.nfr(longestRun)} leituras consecutivas.</b> Este indicador é historicamente associado a períodos de recessão.`
      : `<b style="color:${col}">Curva normalizada.</b> O spread 10Y–2Y está acima de zero.`
    }
  </div>`;
}

window.parseTreasuryCurve = parseTreasuryCurve;
window.loadRec = loadRec;
window.setRecTrendDays = setRecTrendDays;
})();
