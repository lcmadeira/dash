/* global PFX, lsGet, lsSet, fetchJsonFirstOk, fetchWithCORS, $, skeletonTable, er, notifyNonCriticalError, renderFuelModal */
/* ── Combustíveis — PT (API Aberta) + ES (MITECO/MINETUR) ── */
const FUEL_SLUGS=[
  {slug:"gasoline_95",   label:"Gasolina 95",     color:"var(--accent)"},
  {slug:"gasoline_98",   label:"Gasolina 98",     color:"var(--blue)"},
  {slug:"diesel",        label:"Gasóleo Simples", color:"var(--green)"},
  {slug:"diesel_colored",label:"Gasóleo Colorido",color:"var(--purple)"},
  {slug:"gpl_auto",      label:"GPL Auto",        color:"var(--cyan)"},
  {slug:"diesel_plus",   label:"Gasóleo Especial",color:"var(--orange)"},
];

const FUEL_ES_URL="https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/";
const FUEL_PREFS_KEY = "fuel_prefs_v1";
function getFuelPrefs(){
  try{
    const raw = localStorage.getItem(PFX + FUEL_PREFS_KEY);
    const p = raw ? JSON.parse(raw) : {};
    const deltaMode = (p?.deltaMode === "pct" || p?.deltaMode === "abs") ? p.deltaMode : "abs";
    const esGas95 = (p?.esGas95 === "e5" || p?.esGas95 === "e10" || p?.esGas95 === "auto") ? p.esGas95 : "auto";
    const esGas98 = (p?.esGas98 === "e5" || p?.esGas98 === "e10" || p?.esGas98 === "auto") ? p.esGas98 : "auto";
    const showColored = typeof p?.showColored === "boolean" ? p.showColored : true;
    return { deltaMode, esGas95, esGas98, showColored };
  }catch{
    return { deltaMode:"abs", esGas95:"auto", esGas98:"auto", showColored:true };
  }
}
function setFuelPrefs(patch){
  const cur = getFuelPrefs();
  const next = { ...cur, ...(patch||{}) };
  try{ localStorage.setItem(PFX + FUEL_PREFS_KEY, JSON.stringify(next)); }catch{}
  const gasChanged = (cur.esGas95 !== next.esGas95) || (cur.esGas98 !== next.esGas98);
  if(gasChanged){
    try{ localStorage.removeItem(PFX + "fuel_es"); }catch{}
    renderFuel(true).catch(()=>{});
  }else{
    renderFuel(false).catch(()=>{});
  }
  try{ renderFuelModal(); }catch{}
}
function syncFuelDeltaBtn(){
  const btn = document.getElementById("fuelDeltaBtn");
  if(!btn) return;
  const p = getFuelPrefs();
  btn.textContent = p.deltaMode === "pct" ? "Δ%" : "Δ€";
  btn.classList.toggle("on", p.deltaMode === "pct");
  btn.title = p.deltaMode === "pct" ? "A mostrar Δ em %" : "A mostrar Δ em €";
}
function toggleFuelDeltaMode(){
  const p = getFuelPrefs();
  setFuelPrefs({ deltaMode: p.deltaMode === "pct" ? "abs" : "pct" });
}

function normESKey(s){
  try{
    return String(s||"")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .toLowerCase()
      .replace(/[^a-z0-9]/g,"");
  }catch{
    return String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
  }
}
function stGetAny(st, keys){
  if(!st||!keys?.length) return null;
  for(const k of keys){
    const v=st[k];
    if(v !== null && v !== undefined && String(v).trim()!=="") return v;
  }
  // Fallback: match por normalização (caso a API devolva chaves "humanas" com espaços/acentos)
  try{
    const wantNorm=keys.map(k=>normESKey(k)).filter(Boolean);
    for(const k of Object.keys(st)){
      const nk=normESKey(k);
      if(!nk) continue;
      for(const w of wantNorm){
        // Algumas respostas podem trazer variações / sufixos; aceitar "contains" para robustez.
        if(nk===w || nk.includes(w)){
          const v=st[k];
          if(v !== null && v !== undefined && String(v).trim()!=="") return v;
        }
      }
    }
  }catch{}
  return null;
}
function parseESPrice(raw){
  if(raw === null || raw === undefined) return NaN;
  let s=String(raw).trim();
  if(!s || s==="0" || s==="0,000" || s==="0.000") return NaN;
  const lastComma=s.lastIndexOf(","), lastDot=s.lastIndexOf(".");
  if(lastComma>-1 && lastDot>-1){
    if(lastComma>lastDot){
      s=s.split(".").join("").replace(",",".");
    }else{
      s=s.split(",").join("");
    }
  }else if(lastComma>-1){
    s=s.replace(",",".");
  }
  const v=parseFloat(s);
  return Number.isFinite(v)&&v>0?v:NaN;
}
function esGetPrice(st, keys){
  const raw=stGetAny(st, keys);
  const v=parseESPrice(raw);
  if(Number.isFinite(v)) return v;
  return NaN;
}
function aggInit(){return {sum:0,min:Infinity,max:-Infinity,n:0};}
function aggAdd(a,v){
  if(!Number.isFinite(v)) return;
  a.n++;a.sum+=v;a.min=Math.min(a.min,v);a.max=Math.max(a.max,v);
}
function aggDone(a){
  if(!a.n) return {avg:null,min:null,max:null,n:0};
  return {avg:a.sum/a.n,min:a.min,max:a.max,n:a.n};
}
function parseESFechaToTs(s){
  if(!s) return null;
  const str=String(s).trim();
  // Esperado: "dd/mm/yyyy" ou "dd/mm/yyyy hh:mm:ss"
  const m=str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if(!m) return null;
  const d=Number(m[1]), mo=Number(m[2]), y=Number(m[3]);
  const hh=Number(m[4]||0), mm=Number(m[5]||0), ss=Number(m[6]||0);
  if(!(y>2000 && mo>=1 && mo<=12 && d>=1 && d<=31)) return null;
  const dt=new Date(y, mo-1, d, hh, mm, ss);
  const ts=dt.getTime();
  return Number.isFinite(ts)?ts:null;
}
function computeFuelESAgg(payload){
  const prefs = getFuelPrefs();
  const list=(payload?.ListaEESSPrecio)|| (Array.isArray(payload)?payload:[]) || [];
  const acc={
    gasoline_95:aggInit(),
    gasoline_98:aggInit(),
    diesel:aggInit(),
    gpl_auto:aggInit(),
    diesel_plus:aggInit()
  };
  for(const st of list){
    const g95Keys = prefs.esGas95 === "e5"
      ? ["Precio_x0020_Gasolina_x0020_95_x0020_E5","Precio Gasolina 95 E5","Precio_x0020_Gasolina_x0020_95_x0020_E10","Precio Gasolina 95 E10"]
      : prefs.esGas95 === "e10"
        ? ["Precio_x0020_Gasolina_x0020_95_x0020_E10","Precio Gasolina 95 E10","Precio_x0020_Gasolina_x0020_95_x0020_E5","Precio Gasolina 95 E5"]
        : ["Precio_x0020_Gasolina_x0020_95_x0020_E5","Precio_x0020_Gasolina_x0020_95_x0020_E10","Precio Gasolina 95 E5","Precio Gasolina 95 E10"];
    const g98Keys = prefs.esGas98 === "e5"
      ? ["Precio_x0020_Gasolina_x0020_98_x0020_E5","Precio Gasolina 98 E5","Precio_x0020_Gasolina_x0020_98_x0020_E10","Precio Gasolina 98 E10"]
      : prefs.esGas98 === "e10"
        ? ["Precio_x0020_Gasolina_x0020_98_x0020_E10","Precio Gasolina 98 E10","Precio_x0020_Gasolina_x0020_98_x0020_E5","Precio Gasolina 98 E5"]
        : ["Precio_x0020_Gasolina_x0020_98_x0020_E5","Precio_x0020_Gasolina_x0020_98_x0020_E10","Precio Gasolina 98 E5","Precio Gasolina 98 E10"];

    aggAdd(acc.gasoline_95, esGetPrice(st, g95Keys));
    aggAdd(acc.gasoline_98, esGetPrice(st, g98Keys));
    aggAdd(acc.diesel, esGetPrice(st,[
      "Precio_x0020_Gasoleo_x0020_A",
      "Precio Gasoleo A",
      "Precio Gasóleo A"
    ]));
    aggAdd(acc.diesel_plus, esGetPrice(st,[
      "Precio_x0020_Gasoleo_x0020_Premium",
      "Precio Gasoleo Premium",
      "Precio Gasóleo Premium"
    ]));
    aggAdd(acc.gpl_auto, esGetPrice(st,[
      "Precio_x0020_Gases_x0020_licuados_x0020_del_x0020_petróleo",
      "Precio Gases licuados del petróleo",
      "Precio Gases licuados del petroleo",
      "Precio GPL"
    ]));
  }
  const out={};
  Object.entries(acc).forEach(([k,v])=>out[k]=aggDone(v));
  const fecha=payload?.Fecha||"";
  return {fecha, ts: parseESFechaToTs(fecha), items:out};
}
async function renderFuel(force=false){
  $("fuel-body").innerHTML=skeletonTable(8);
  try{
    const prefs = getFuelPrefs();
    syncFuelDeltaBtn();
    // PT
    let pt=force?null:lsGet("fuel");
    try {
      const j = await fetchJsonFirstOk("https://api.apiaberta.pt/v1/fuel/prices", {}, 12000);
      pt = j.data || j;
      if (pt) lsSet("fuel", pt);
    } catch(e) {
      console.warn("⚠️ Fuel API falhou:", e.message);
    }
    const ptBy={};pt.forEach(f=>ptBy[f.fuel_slug]=f);

    // ES (agregado; evita encher localStorage) — falha sem quebrar o card
    let esErr=null;
    let es=force?null:lsGet("fuel_es");
    try{
      if(!es){
        const r=await fetchWithCORS(FUEL_ES_URL, {headers:{"Accept":"application/json"}}, 35000);
        const txt=await r.text();
        let j=null;
        try{j=JSON.parse(txt);}catch{throw new Error("ES: resposta não é JSON");}
        es=computeFuelESAgg(j);
        // Se não conseguimos extrair preços, mostrar erro claro (chaves inesperadas / formato diferente)
        const nAny=Object.values(es?.items||{}).reduce((a,it)=>a+(it?.n||0),0);
        if(!nAny){
          throw new Error("ES: sem preços (campos inesperados)");
        }
        lsSet("fuel_es",es);
      }
    }catch(e){es=null;esErr=e;}
    const esBy=es?.items||{};

    const ptDate=pt?.[0]?.date||"";
    const ptUpd=pt?.[0]?.updated_at?new Date(pt[0].updated_at).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"}):"";
    const esDate=es?.fecha||"";
    const esTs=Number.isFinite(es?.ts)?es.ts:null;
    const esLbl=esErr
      ? `indisponível (${(esErr?.message||"erro").slice(0,44)})`
      : (esTs ? new Date(esTs).toLocaleString("pt-PT",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}) : (esDate||"—"));

    const baseSlugs = prefs.showColored ? FUEL_SLUGS : FUEL_SLUGS.filter(s => s.slug !== "diesel_colored");
    const items=baseSlugs.map(s=>({ ...s, pt: ptBy[s.slug]||null, es: esBy[s.slug]||null }));
    const fmt=(v)=>Number.isFinite(v)?v.toFixed(3):"—";
    const fmtDelta=(v)=>{
      if(!Number.isFinite(v)) return {txt:"—",cls:"neu"};
      const cls=v>0.0005?"pos":v<-0.0005?"neg":"neu";
      const txt=(v>0?"+":"")+v.toFixed(3);
      return {txt,cls};
    };
    const fmtDeltaPct=(ptV, esV)=>{
      if(!Number.isFinite(ptV) || !Number.isFinite(esV) || ptV<=0) return {txt:"—",cls:"neu"};
      const pct=((esV-ptV)/ptV)*100;
      const cls=pct>0.05?"pos":pct<-0.05?"neg":"neu";
      const txt=(pct>0?"+":"")+pct.toFixed(2)+"%";
      return {txt,cls, pct};
    };

    $("fuel-body").innerHTML=`<div class="fuel-grid">${items.map(f=>{
      const p=f.pt;
      const e=f.es;
      const ptAvg=Number.isFinite(p?.avg_price_eur)?p.avg_price_eur:NaN;
      const esAvg=Number.isFinite(e?.avg)?e.avg:NaN;
      const absV = (Number.isFinite(esAvg)&&Number.isFinite(ptAvg))?(esAvg-ptAvg):NaN;
      const deltaAbs=fmtDelta(absV);
      const deltaPct=fmtDeltaPct(ptAvg, esAvg);
      const delta = prefs.deltaMode === "pct" ? deltaPct : deltaAbs;
      const deltaTitle = prefs.deltaMode === "pct"
        ? (Number.isFinite(absV) ? `Δ€ ${(absV>0?"+":"")+absV.toFixed(3)}` : "")
        : (Number.isFinite(deltaPct?.pct) ? `Δ% ${(deltaPct.pct>0?"+":"")+deltaPct.pct.toFixed(2)}%` : "");
      const lblTitle = f.slug==="diesel_colored" ? 'ES: sem equivalente na fonte oficial' : '';
      return`<div class="fi"><div class="fi-lbl"${lblTitle?` title="${lblTitle}"`:""}>${f.label}</div>
        <div class="fi-ptes">
          <div class="fi-col">
            <div class="fi-cty">PT</div>
            <div class="fi-price" style="color:${f.color}">${fmt(ptAvg)}</div>
            <div class="fi-meta">€/litro · ${p?.station_count??"—"} postos</div>
            <div class="fi-range-mm"><span>mín ${fmt(p?.min_price_eur)}</span><span>máx ${fmt(p?.max_price_eur)}</span></div>
          </div>
          <div class="fi-col">
            <div class="fi-cty">ES</div>
            <div class="fi-price" style="color:${f.color}">${fmt(esAvg)}</div>
            <div class="fi-meta">€/litro · ${e?.n?`${e.n} postos`:"—"}</div>
            <div class="fi-range-mm"><span>mín ${fmt(e?.min)}</span><span>máx ${fmt(e?.max)}</span></div>
          </div>
        </div>
        <div class="fi-delta"><span>Δ ES-PT</span><span class="${delta.cls}"${deltaTitle?` title="${deltaTitle}"`:""}>${delta.txt}</span></div>
      </div>`;
    }).join("")}</div>
    <div class="src">✦ PT: API Aberta · ${ptDate}${ptUpd?` · às ${ptUpd}`:""} · ES: MITECO/MINETUR · ${esLbl}</div>`;
  }catch(e){$("fuel-body").innerHTML=er(e,{context:"Combustíveis PT/ES",action:"clique em ↺ para tentar novamente"});notifyNonCriticalError("Combustíveis PT/ES",e);}
}

