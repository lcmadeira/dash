/* global AbortSignal, EURIBOR_FALLBACK, PFX, addToHistory, console, document, fetch, location, localStorage, lsGet, lsSet, window */
(() => {
/* ══════════════════════════════════════════════════════════════
   EURIBOR — API BCE automatica (data-api.ecb.europa.eu)
   CORS nativo · sem chave · sem proxy
   Fallback: dados estaticos EMMI se API inacessivel

   Series BCE utilizadas:
     1S  -> FM/M.U2.EUR.RT0.MM.EURIBOR1WD_.HSTA
     1M  -> FM/M.U2.EUR.RT0.MM.EURIBOR1MD_.HSTA
     3M  -> FM/M.U2.EUR.RT0.MM.EURIBOR3MD_.HSTA
     6M  -> FM/M.U2.EUR.RT0.MM.EURIBOR6MD_.HSTA
     12M -> FM/M.U2.EUR.RT0.MM.EURIBOR1YD_.HSTA
   ══════════════════════════════════════════════════════════════ */

/* Dados estaticos EMMI como fallback (ja centralizados em src/config.js) */

/* Estado global — preenchido pela API ou pelo fallback */
let EURIBOR_DATA=null;

function isBceEuriborLiveEnabled(){
  try {
    const qs = new URLSearchParams(location.search || "");
    if (qs.has("liveEuribor")) return (qs.get("liveEuribor") || "1") !== "0";
    return localStorage.getItem(PFX + "live_euribor_bce") === "1";
  } catch {
    return false;
  }
}

/* ── Parser SDMX JSON (formato BCE) ──────────────────────────── */
function parseBCEseries(json){
  try{
    /* Chave da serie: usar a primeira disponivel (nao hardcodar "0:0:0:0:0:0")
       O numero de dimensoes varia consoante a serie BCE utilizada */
    const ds=json.dataSets[0];
    const seriesKey=Object.keys(ds.series)[0];
    if(!seriesKey){console.warn("parseBCEseries: sem series");return[];}
    const obs=ds.series[seriesKey].observations;
    /* Dimensao temporal: pode estar em observation[0] ou na ultima de series[] */
    const dimObs=json.structure.dimensions.observation;
    const dimSer=json.structure.dimensions.series;
    const timeDim=(dimObs&&dimObs.length>0)
      ?dimObs[0]
      :(dimSer&&dimSer.length>0?dimSer[dimSer.length-1]:null);
    if(!timeDim){console.warn("parseBCEseries: dimensao temporal nao encontrada");return[];}
    const dates=timeDim.values;
    const rows=[];
    Object.entries(obs).forEach(([idxStr,vals])=>{
      const idx=parseInt(idxStr);
      if(idx<dates.length&&vals[0]!==null)
        rows.push({period:dates[idx].id,value:parseFloat(vals[0])});
    });
    rows.sort((a,b)=>a.period>b.period?1:-1);
    return rows;
  }catch(e){console.warn("parseBCEseries:",e);return[];}
}

/* ── Formatar periodo "2026-03" → "Mar 26" ────────────────────── */
function fmtBCEperiod(p){
  const months=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const[y,m]=p.split("-");
  return`${months[parseInt(m)-1]} ${y.slice(2)}`;
}

/* ── Fetch de uma serie BCE (formato generico) ───────────────── */
async function fetchBCEseries(fullKey, nObs=9){
  /* Se a chave nao for completa (ex: EURIBOR1YD_), assumir prefixo Euribor Mensal */
  const key = fullKey.includes('.') ? fullKey : `M.U2.EUR.RT0.MM.${fullKey}.HSTA`;
  const url = `https://data-api.ecb.europa.eu/service/data/FM/${key}`
            + `?format=jsondata&lastNObservations=${nObs}`;
  const r = await fetch(url, {signal: AbortSignal.timeout(8000)});
  if(!r.ok) throw new Error(`BCE HTTP ${r.status}`);
  return parseBCEseries(await r.json());
}

/* ── Buscar taxas oficiais do BCE (Key Rates) ────────────────── */
async function fetchBCEKeyRates(){
  /* DFR (Deposito), MRR (Refinanciamento), MLF (Cedencia) */
  const key = "D.U2.EUR.4F.KR.DF+MRR_FR+MLFR.LEV";
  const url = `https://data-api.ecb.europa.eu/service/data/FM/${key}?format=jsondata&lastNObservations=1`;
  const r = await fetch(url, {signal: AbortSignal.timeout(8000)});
  if(!r.ok) return null;
  const json = await r.json();
  const ds = json.dataSets[0].series;
  
  /* Mapeamento manual baseado na posicao das dimensoes (simplificado) */
  /* Nota: O formato JSON-stat seria mais robusto, mas mantemos o parser existente */
  const findVal = (kPart) => {
    const sKey = Object.keys(ds).find(k => k.includes(kPart));
    if(!sKey) return null;
    const obs = ds[sKey].observations;
    const firstObs = Object.values(obs)[0];
    return firstObs ? parseFloat(parseFloat(firstObs[0]).toFixed(2)) : null;
  };

  return {
    dep:   findVal(".DF.")     ?? EURIBOR_FALLBACK.bce.dep,
    refin: findVal(".MRR_FR.") ?? EURIBOR_FALLBACK.bce.refin,
    margLend: findVal(".MLFR.") ?? EURIBOR_FALLBACK.bce.margLend
  };
}

/* ── Carregar todas as maturidades em paralelo ───────────────── */
async function loadEuriborFromBCE(){
  const SERIES=[
    {term:"1S",  termFull:"1 Semana", key:"EURIBOR1WD_",color:"#06B6D4",hipot:false,
     desc:"Ref. overnight e swaps curtos"},
    {term:"1M",  termFull:"1 M\u00eas",    key:"EURIBOR1MD_",color:"#22D3EE",hipot:false,
     desc:"Ref. produtos curtos, tesouraria"},
    {term:"3M",  termFull:"3 Meses",  key:"EURIBOR3MD_",color:"#3B82F6",hipot:true,
     desc:"Cr\u00e9dito habita\u00e7\u00e3o revis\u00e3o trimestral"},
    {term:"6M",  termFull:"6 Meses",  key:"EURIBOR6MD_",color:"#8B5CF6",hipot:true,
     desc:"Cr\u00e9dito habita\u00e7\u00e3o revis\u00e3o semestral"},
    {term:"12M", termFull:"12 Meses", key:"EURIBOR1YD_",color:"#A855F7",hipot:true,
     desc:"Cr\u00e9dito habita\u00e7\u00e3o revis\u00e3o anual"},
  ];

  /* Carregar Euribor e Key Rates em paralelo */
  const [euriborRes, keyRates] = await Promise.all([
    Promise.all(SERIES.map(s => fetchBCEseries(s.key, 9).catch(() => null))),
    fetchBCEKeyRates().catch(() => null)
  ]);

  const r3m = euriborRes[2], r12m = euriborRes[4];
  if(!r3m || !r12m || r3m.length < 2 || r12m.length < 2)
    throw new Error("Dados BCE insuficientes");

  const rates = SERIES.map((s, i) => {
    const rows = euriborRes[i];
    if(!rows || rows.length < 2) return EURIBOR_FALLBACK.rates.find(r => r.term === s.term);
    const latest = rows[rows.length - 1];
    const prev   = rows[rows.length - 2];
    return {
      term: s.term, termFull: s.termFull,
      val: parseFloat(latest.value.toFixed(3)),
      prev: parseFloat(prev.value.toFixed(3)),
      color: s.color, hipot: s.hipot, desc: s.desc,
    };
  });

  const hist3m  = euriborRes[2] || [];
  const hist6m  = euriborRes[3] || [];
  const hist12m = euriborRes[4] || [];
  const hist = hist3m.slice(-8).map(row => {
    const p = row.period;
    const v6m  = hist6m.find(r => r.period === p)?.value ?? null;
    const v12m = hist12m.find(r => r.period === p)?.value ?? null;
    return [fmtBCEperiod(p), row.value, v6m, v12m];
  }).filter(r => r[1] !== null);

  const latestPeriod = hist3m[hist3m.length - 1]?.period || "";
  const updatedDate = latestPeriod
    ? new Date(latestPeriod + "-15").toLocaleDateString("pt-PT", {month: "short", year: "numeric"})
    : "BCE live";

  return {
    updated: updatedDate, rates, hist,
    bce: keyRates || EURIBOR_FALLBACK.bce,
    peak: EURIBOR_FALLBACK.peak,
    bceNext: EURIBOR_FALLBACK.bceNext,
    spreadBancario: EURIBOR_FALLBACK.spreadBancario,
    _source: "bce_live",
  };
}

/* ══════════════════════════════════════════════════════════════
   renderEuribor — le EURIBOR_DATA (live ou fallback)
   ══════════════════════════════════════════════════════════════ */
function renderEuribor(){
  const d=EURIBOR_DATA;
  const el=document.getElementById("euri-body");
  if(!el||!d) return;

  d.rates.forEach(r=>addToHistory(`euribor_${r.term.toLowerCase()}`,r.val));

  const W=320,H=80,PAD={t:8,r:8,b:20,l:32};
  const cw=W-PAD.l-PAD.r,ch=H-PAD.t-PAD.b;
  const histRev=[...d.hist].reverse();
  const allVals=histRev.flatMap(r=>r.slice(1).filter(v=>v!==null));
  const vmin=Math.floor(Math.min(...allVals)*10)/10-0.1;
  const vmax=Math.ceil(Math.max(...allVals)*10)/10+0.1;
  const vr=vmax-vmin;
  const sx=i=>PAD.l+Math.round(i/(histRev.length-1)*cw);
  const sy=v=>PAD.t+Math.round((1-(v-vmin)/vr)*ch);

  const lineColors=["#3B82F6","#8B5CF6","#A855F7"];
  const lineLabels=["3M","6M","12M"];
  const lines=lineColors.map((_,ci)=>
    histRev.map((row,i)=>row[ci+1]!==null?`${sx(i)},${sy(row[ci+1])}`:null)
      .filter(Boolean).join(" ")
  );

  const yticks=[];
  let yt=Math.ceil(vmin*10)/10;
  while(yt<=vmax+0.01){yticks.push(yt);yt=Math.round((yt+0.5)*10)/10;}

  const svgChart=`<svg width="${W}" height="${H}" style="width:100%;display:block;overflow:visible">
    ${yticks.map(v=>`<line x1="${PAD.l}" y1="${sy(v)}" x2="${W-PAD.r}" y2="${sy(v)}"
      stroke="var(--b)" stroke-width="1"/>`).join("")}
    ${yticks.map(v=>`<text x="${PAD.l-3}" y="${sy(v)+4}" text-anchor="end"
      font-size="7" fill="var(--t3)">${v.toFixed(1)}</text>`).join("")}
    ${histRev.filter((_,i)=>i%2===0).map(row=>{
      const origIdx=histRev.indexOf(row);
      return`<text x="${sx(origIdx)}" y="${H-2}" text-anchor="middle"
        font-size="7" fill="var(--t3)">${row[0]}</text>`;
    }).join("")}
    ${lines.map((pts,ci)=>`<polyline points="${pts}" fill="none"
      stroke="${lineColors[ci]}" stroke-width="1.8" stroke-linejoin="round"/>`).join("")}
    ${lines.map((pts,ci)=>{
      if(!pts) return "";
      const last=pts.split(" ").pop().split(",");
      return`<circle cx="${last[0]}" cy="${last[1]}" r="3" fill="${lineColors[ci]}"/>`;
    }).join("")}
  </svg>`;

  const peakVal=d.peak.val;
  const r12=d.rates.find(r=>r.term==="12M");
  const quedaPico=((peakVal-r12.val)/peakVal*100).toFixed(1);
  const quedaPP=(peakVal-r12.val).toFixed(3);
  const sp=d.spreadBancario;
  const bce=d.bceNext;
  const expColor=bce.expectativa==="Corte"?"#10B981":bce.expectativa==="Subida"?"#EF4444":"#F59E0B";

  const sourceTag=d._source==="bce_live"
    ?`<span style="font-size:.5rem;color:#10B981;background:#10B98115;border-radius:3px;padding:1px 6px">\u25CF BCE live \u00b7 ${d.updated}</span>`
    :`<span style="font-size:.5rem;color:#F59E0B;background:#F59E0B15;border-radius:3px;padding:1px 6px">\u26a0 EMMI est\u00e1tico \u00b7 ${d.updated}</span>`;

  const periodoGraf=d.hist.length>0
    ?`${d.hist[d.hist.length-1][0]} \u2192 ${d.hist[0][0]}`:"—";

  el.innerHTML=`
  <div style="display:flex;justify-content:flex-end;margin-bottom:6px">${sourceTag}</div>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px;margin-bottom:8px">
    ${d.rates.map(r=>{
      const diff=r.val-r.prev;
      const dCol=diff<0?"#10B981":"#EF4444";
      return`<div style="background:var(--b2);border-radius:6px;padding:5px 4px;
           border-top:2px solid ${r.color};text-align:center">
        <div style="font-size:.56rem;color:var(--t3);font-weight:600">${r.term}</div>
        <div style="font-family:var(--mono);font-size:.85rem;font-weight:700;
             color:${r.color};line-height:1.1;margin:2px 0">${r.val.toFixed(3)}<span style="font-size:.5rem">%</span></div>
        <div style="font-size:.5rem;color:${dCol}">${diff<0?"\u25bc":"\u25b2"}${Math.abs(diff).toFixed(3)}pp</div>
        ${r.hipot?`<div style="font-size:.44rem;color:var(--t3);margin-top:1px">\uD83C\uDFE0 hipot.</div>`:""}
      </div>`;
    }).join("")}
  </div>
  <div style="background:var(--b2);border-radius:8px;padding:8px 10px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <div style="font-size:.6rem;color:var(--t3)">Evolu\u00e7\u00e3o mensal \u00b7 ${periodoGraf}</div>
      <div style="display:flex;gap:8px">
        ${lineColors.map((c,i)=>`<span style="font-size:.55rem;color:${c}">\u25cf ${lineLabels[i]}</span>`).join("")}
      </div>
    </div>
    ${svgChart}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1px 1fr 1px 1fr;
       background:var(--b2);border-radius:8px;overflow:hidden;margin-bottom:8px">
    <div style="padding:7px 10px;text-align:center">
      <div style="font-size:.52rem;color:var(--t3);text-transform:uppercase;margin-bottom:2px">BCE Dep\u00f3sito</div>
      <div style="font-family:var(--mono);font-size:1rem;font-weight:700;color:#3B82F6">${d.bce.dep.toFixed(2)}%</div>
      <div style="font-size:.52rem;color:var(--t3)">refin. ${d.bce.refin.toFixed(2)}%</div>
    </div>
    <div style="background:var(--b)"></div>
    <div style="padding:7px 10px;text-align:center">
      <div style="font-size:.52rem;color:var(--t3);text-transform:uppercase;margin-bottom:2px">Pico ${d.peak.date}</div>
      <div style="font-family:var(--mono);font-size:1rem;font-weight:700;color:#EF4444">${d.peak.val.toFixed(3)}%</div>
      <div style="font-size:.52rem;color:#10B981">\u25bc ${quedaPP}pp (${quedaPico}%)</div>
    </div>
    <div style="background:var(--b)"></div>
    <div style="padding:7px 10px;text-align:center">
      <div style="font-size:.52rem;color:var(--t3);text-transform:uppercase;margin-bottom:2px">Tend\u00eancia</div>
      <div style="font-family:var(--mono);font-size:1rem;font-weight:700;color:#10B981">\u25bc Descida</div>
      <div style="font-size:.52rem;color:var(--t3)">desde Out 2023</div>
    </div>
  </div>
  <div style="background:var(--b2);border-radius:8px;padding:8px 10px;margin-bottom:8px;
       border-left:3px solid ${expColor}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:.6rem;font-weight:700;color:var(--t2)">
          \uD83C\uDFE6 Pr\u00f3xima reuni\u00e3o BCE \u00b7 ${bce.date}
        </div>
        <div style="font-size:.57rem;color:var(--t3);margin-top:2px">${bce.nota}</div>
      </div>
      <div style="text-align:right;min-width:60px">
        <div style="font-size:.62rem;font-weight:700;color:${expColor}">${bce.expectativa}</div>
        <div style="font-size:.52rem;color:var(--t3)">consenso</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-top:6px">
      ${[
        {label:"Corte \u221225bp",prob:bce.probCorte,col:"#10B981"},
        {label:"Pausa",           prob:bce.probPausa, col:"#F59E0B"},
        {label:"Subida",          prob:bce.probSubida,col:"#EF4444"},
      ].map(b=>`<div>
        <div style="display:flex;justify-content:space-between;margin-bottom:2px">
          <span style="font-size:.52rem;color:var(--t3)">${b.label}</span>
          <span style="font-size:.54rem;font-weight:600;color:${b.col}">${b.prob}%</span>
        </div>
        <div style="background:var(--b);border-radius:3px;height:5px">
          <div style="width:${b.prob}%;height:100%;background:${b.col};border-radius:3px"></div>
        </div>
      </div>`).join("")}
    </div>
  </div>
  <div style="background:var(--b2);border-radius:8px;padding:8px 10px">
    <div style="font-size:.6rem;font-weight:700;color:var(--t2);margin-bottom:5px">
      \uD83C\uDFE0 Spread banc\u00e1rio PT \u00b7 cr\u00e9dito habita\u00e7\u00e3o vari\u00e1vel
      <span class="help-tip" title="Spread bancário: margem fixa do banco somada à Euribor para calcular a TAN do crédito.">?</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:5px">
      ${[
        {label:"Spread m\u00edn.",   val:sp.min,    col:"#10B981"},
        {label:"Spread t\u00edpico", val:sp.tipico, col:"#F59E0B"},
        {label:"Spread m\u00e1x.",   val:sp.max,    col:"#EF4444"},
      ].map(s=>`<div style="text-align:center">
        <div style="font-size:.65rem;font-weight:700;color:${s.col}">${s.val.toFixed(2)}%</div>
        <div style="font-size:.52rem;color:var(--t3)">${s.label}</div>
      </div>`).join("")}
    </div>
    <div style="font-size:.57rem;color:var(--t3);margin-bottom:3px">TAN efectiva estimada (Euribor + spread t\u00edpico ${sp.tipico.toFixed(2)}%):</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">
      ${d.rates.filter(r=>r.hipot).map(r=>`
        <div style="background:var(--surface);border-radius:5px;padding:4px 6px;text-align:center;
             border:1px solid ${r.color}33">
          <div style="font-size:.52rem;color:var(--t3)">Euribor ${r.termFull}</div>
          <div style="font-size:.75rem;font-weight:700;color:${r.color}">
            ${(r.val+sp.tipico).toFixed(3)}%</div>
          <div style="font-size:.5rem;color:var(--t3)">TAN est.</div>
        </div>`).join("")}
    </div>
    <div style="font-size:.52rem;color:var(--t3);margin-top:4px">
      ${d._source==="bce_live"
        ?`Fonte: BCE \u00b7 data-api.ecb.europa.eu \u00b7 ${d.updated} \u00b7 Spread: m\u00e9dia de mercado PT.`
        :`Fonte: EMMI \u00b7 emmi-benchmarks.eu \u00b7 ${d.updated} \u00b7 Spread: m\u00e9dia de mercado PT.`}
      N\u00e3o constitui proposta comercial.
    </div>
  </div>`;
}

/* ══════════════════════════════════════════════════════════════
   initEuribor — ponto de entrada: cache → API BCE → fallback EMMI
   ══════════════════════════════════════════════════════════════ */
async function initEuribor(force=false){
  const CK="euribor_live_v1";
  const ref=document.getElementById("euriborRefDate");

  /* 1. Cache valido -> mostrar e sair */
  if(!force){
    const cached=lsGet(CK);
    if(isValidEuriborData(cached)){
      EURIBOR_DATA=cached;
      if(ref) ref.textContent=cached.updated+(cached._source==="bce_live"?" \u25cf live":"");
      renderEuribor();
      console.log("📐 Euribor: cache local ("+cached.updated+")");
      return;
    }
  }

  /* 2. Sem cache: mostrar fallback IMEDIATAMENTE enquanto tenta BCE */
  EURIBOR_DATA=EURIBOR_FALLBACK;
  if(ref) ref.textContent=EURIBOR_FALLBACK.updated;
  renderEuribor();

  if(!isBceEuriborLiveEnabled()){
    console.log("📐 Euribor: fallback EMMI (BCE live desativado)");
    return;
  }

  /* 3. Tentar BCE em background e actualizar se responder */
  try{
    console.log("📐 Euribor: a actualizar do BCE em background...");
    const live=await loadEuriborFromBCE();
    EURIBOR_DATA=live;
    lsSet(CK,live);
    if(ref) ref.textContent=live.updated+" \u25cf live";
    renderEuribor();
    console.log("\u2705 Euribor BCE actualizado:",live.updated);
  }catch(e){
    /* Fallback ja esta visivel - apenas registar o aviso */
    console.warn("\u26a0\ufe0f Euribor BCE indisponivel, a usar EMMI:",e.message);
  }
}

function isValidEuriborData(data){
  const finite = value => Number.isFinite(value);
  const requiredTerms = ["1S", "1M", "3M", "6M", "12M"];
  if(!data || typeof data.updated !== "string" || !Array.isArray(data.rates) ||
     !Array.isArray(data.hist) || data.hist.length < 2 ||
     !requiredTerms.every(term => data.rates.some(rate => rate?.term === term &&
       finite(rate.val) && finite(rate.prev) && typeof rate.color === "string")))
    return false;
  if(!data.hist.every(row => Array.isArray(row) && typeof row[0] === "string" &&
    finite(row[1]) && row.slice(2).every(value => value === null || finite(value))))
    return false;
  return [data.bce?.dep, data.bce?.refin, data.peak?.val,
    data.bceNext?.probCorte, data.bceNext?.probPausa, data.bceNext?.probSubida,
    data.spreadBancario?.min, data.spreadBancario?.tipico, data.spreadBancario?.max]
    .every(finite) && typeof data.peak.date === "string" &&
    typeof data.bceNext.date === "string" && typeof data.bceNext.expectativa === "string" &&
    typeof data.bceNext.nota === "string";
}



window.initEuribor = initEuribor;
window.renderEuribor = renderEuribor;
})();
