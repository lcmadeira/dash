/* global PFX, lsGet, lsSet, fetchJsonFirstOk, fetchWithCORS, $, skeletonTable, er, notifyNonCriticalError, renderFuelModal, window */
(() => {
/* ── Combustíveis — PT (API Aberta) + ES (MITECO/MINETUR) ── */
const FUEL_SLUGS=[
  {slug:"gasoline_95",   label:"Gasolina 95",     color:"var(--text)"},
  {slug:"gasoline_98",   label:"Gasolina 98",     color:"var(--text)"},
  {slug:"diesel",        label:"Gasóleo Simples", color:"var(--text)"},
  {slug:"diesel_colored",label:"Gasóleo Colorido",color:"var(--text)"},
  {slug:"gpl_auto",      label:"GPL Auto",        color:"var(--text)"},
  {slug:"diesel_plus",   label:"Gasóleo Especial",color:"var(--text)"},
];

const FUEL_ES_URL="https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/";
const FUEL_PREFS_KEY = "fuel_prefs_v1";
/* Separador Évora: postos do município, por combustível (API Aberta, dados DGEG). */
const FUEL_EVORA_URL = "https://api.apiaberta.pt/v1/fuel/stations?municipality=Evora&limit=100"; // máximo aceite pela API
const FUEL_EVORA_CACHE_KEY = "fuel_evora";
const FUEL_EVORA_FUELS = [
  { key: "diesel", slug: "diesel", label: "Gasóleo simples", short: "Gasóleo", param: "diesel", fuelName: /gas[oó]leo simples/i },
  { key: "gasoline_95", slug: "gasoline_95", label: "Gasolina simples 95", short: "Gasolina 95", param: "gasoline_95", fuelName: /gasolina simples 95/i },
];
function getFuelPrefs(){
  try{
    const raw = localStorage.getItem(PFX + FUEL_PREFS_KEY);
    const p = raw ? JSON.parse(raw) : {};
    const deltaMode = (p?.deltaMode === "pct" || p?.deltaMode === "abs") ? p.deltaMode : "abs";
    const esGas95 = (p?.esGas95 === "e5" || p?.esGas95 === "e10" || p?.esGas95 === "auto") ? p.esGas95 : "auto";
    const esGas98 = (p?.esGas98 === "e5" || p?.esGas98 === "e10" || p?.esGas98 === "auto") ? p.esGas98 : "auto";
    const showColored = typeof p?.showColored === "boolean" ? p.showColored : true;
    const view = p?.view === "evora" ? "evora" : "ptes";
    const evSortCol = FUEL_EVORA_FUELS.some(f => f.key === p?.evSortCol) ? p.evSortCol : "diesel";
    const evSortDir = p?.evSortDir === "desc" ? "desc" : "asc";
    return { deltaMode, esGas95, esGas98, showColored, view, evSortCol, evSortDir };
  }catch{
    return { deltaMode:"abs", esGas95:"auto", esGas98:"auto", showColored:true, view:"ptes", evSortCol:"diesel", evSortDir:"asc" };
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
  // A hora do MITECO é a de Madrid (CET/CEST), uma hora à frente de Lisboa: não ler como hora local.
  const guess=Date.UTC(y, mo-1, d, hh, mm, ss);
  let ts=guess;
  try{
    const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Madrid",hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).formatToParts(new Date(guess));
    const get=t=>Number(parts.find(p=>p.type===t)?.value);
    const asMadrid=Date.UTC(get("year"), get("month")-1, get("day"), get("hour"), get("minute"), get("second"));
    if(Number.isFinite(asMadrid)) ts=guess-(asMadrid-guess);
  }catch{}
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
  syncFuelView();
  if(getFuelPrefs().view === "evora") return renderFuelEvora(force);
  $("fuel-body").innerHTML=skeletonTable(8);
  try{
    const prefs = getFuelPrefs();
    syncFuelDeltaBtn();
    // PT
    let pt=force?null:lsGet("fuel");
    try {
      const j = await fetchJsonFirstOk("https://api.apiaberta.pt/v1/fuel/prices", {}, 12000);
      pt = j.data || j;
      if (pt) lsSet("fuel", pt, {
        source: "API Aberta",
        state: "live",
        observedAt: pt.map(item => Date.parse(item?.updated_at || "")).filter(Number.isFinite).sort((a, b) => b - a)[0],
      });
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
        lsSet("fuel_es", es, {
          source: "MITECO/MINETUR",
          state: "live",
          observedAt: es.ts,
        });
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
    const fmt=(v)=>Number.isFinite(v)?window.nf(v,3):"—";
    const fmtDelta=(v)=>{
      if(!Number.isFinite(v)) return {txt:"—",cls:"neu"};
      const cls=v>0.0005?"pos":v<-0.0005?"neg":"neu";
      const txt=(v>0?"+":"")+window.nf(v,3);
      return {txt,cls};
    };
    const fmtDeltaPct=(ptV, esV)=>{
      if(!Number.isFinite(ptV) || !Number.isFinite(esV) || ptV<=0) return {txt:"—",cls:"neu"};
      const pct=((esV-ptV)/ptV)*100;
      const cls=pct>0.05?"pos":pct<-0.05?"neg":"neu";
      const txt=(pct>0?"+":"")+window.nf(pct,2)+"%";
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
        ? (Number.isFinite(absV) ? `Δ€ ${(absV>0?"+":"")+window.nf(absV, 3)}` : "")
        : (Number.isFinite(deltaPct?.pct) ? `Δ% ${(deltaPct.pct>0?"+":"")+window.nf(deltaPct.pct, 2)}%` : "");
      const lblTitle = f.slug==="diesel_colored" ? 'ES: sem equivalente na fonte oficial' : '';
      return`<div class="fi"><div class="fi-lbl"${lblTitle?` title="${lblTitle}"`:""}>${f.label} <span class="fi-unit-inline">€/L</span></div>
        <div class="fi-ptes">
          <div class="fi-col">
            <div class="fi-cty">PT</div>
            <div class="fi-price" style="color:${f.color}">${fmt(ptAvg)}</div>
            <div class="fi-meta">${p?.station_count??"—"} postos</div>
            <div class="fi-range-mm"><span>mín ${fmt(p?.min_price_eur)}</span><span>máx ${fmt(p?.max_price_eur)}</span></div>
          </div>
          <div class="fi-col">
            <div class="fi-cty">ES</div>
            <div class="fi-price" style="color:${f.color}">${fmt(esAvg)}</div>
            <div class="fi-meta">${e?.n?`${e.n} postos`:"—"}</div>
            <div class="fi-range-mm"><span>mín ${fmt(e?.min)}</span><span>máx ${fmt(e?.max)}</span></div>
          </div>
        </div>
        <div class="fi-delta"><span>Δ ES-PT</span><span class="${delta.cls}"${deltaTitle?` title="${deltaTitle}"`:""}>${delta.txt}</span></div>
      </div>`;
    }).join("")}</div>
    <div class="src">✦ PT: API Aberta · ${ptDate}${ptUpd?` · às ${ptUpd}`:""} · ES: MITECO/MINETUR · ${window.nfr(esLbl)}</div>`;
    window.renderPortugalBriefing?.();
    // O "Resumo do dia" mostra o gasóleo mais barato de Évora: carregar em segundo plano (cache 3 h).
    loadFuelEvora(false).then(() => window.renderPortugalBriefing?.()).catch(() => {});
  }catch(e){$("fuel-body").innerHTML=er(e,{context:"Combustíveis PT/ES",action:"clique em ↺ para tentar novamente"});notifyNonCriticalError("Combustíveis PT/ES",e);}
}

/* ── Separador Évora ── */
function escFuel(value){
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
}
function finitePrice(v){
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}
/** Junta as listas por combustível numa linha por posto (chave: station_id). */
function mergeFuelEvoraStations(rowsByFuel){
  const byId = new Map();
  for(const fuel of FUEL_EVORA_FUELS){
    const rows = Array.isArray(rowsByFuel?.[fuel.key]) ? rowsByFuel[fuel.key] : [];
    for(const row of rows){
      if(!row || (row.fuel_name && !fuel.fuelName.test(row.fuel_name))) continue;
      const price = finitePrice(row.price_eur);
      const id = row.station_id ?? `${row.name}|${row.address}`;
      if(price === null || id === undefined) continue;
      let st = byId.get(id);
      if(!st){
        st = { id, name: row.name || "Posto", brand: row.brand || "", address: row.address || "", locality: row.locality || "", prices: {}, updatedAt: null };
        FUEL_EVORA_FUELS.forEach(f => { st.prices[f.key] = null; });
        byId.set(id, st);
      }
      st.prices[fuel.key] = price;
      const ts = Date.parse(row.updated_at || "");
      if(Number.isFinite(ts) && (!st.updatedAt || ts > st.updatedAt)) st.updatedAt = ts;
    }
  }
  return [...byId.values()];
}
/** Ordena pelo preço de uma coluna; postos sem esse combustível ficam sempre no fim. */
function sortFuelEvoraStations(list, col, dir){
  const sign = dir === "desc" ? -1 : 1;
  return [...(list || [])].sort((a, b) => {
    const va = a?.prices?.[col] ?? null, vb = b?.prices?.[col] ?? null;
    if(va === null && vb === null) return String(a?.name || "").localeCompare(String(b?.name || ""), "pt");
    if(va === null) return 1;
    if(vb === null) return -1;
    return (va - vb) * sign || String(a.name).localeCompare(String(b.name), "pt");
  });
}
/** Mais barato, média do município e diferença para a média nacional, por combustível. */
function summarizeFuelEvora(stations, nationalBySlug){
  const out = {};
  for(const fuel of FUEL_EVORA_FUELS){
    const priced = (stations || []).filter(s => s?.prices?.[fuel.key] !== null && s?.prices?.[fuel.key] !== undefined);
    if(!priced.length){ out[fuel.key] = { n: 0, cheapest: null, avg: null, national: null }; continue; }
    const min = Math.min(...priced.map(s => s.prices[fuel.key]));
    const cheapest = priced.filter(s => s.prices[fuel.key] === min);
    const avg = priced.reduce((a, s) => a + s.prices[fuel.key], 0) / priced.length;
    const nat = finitePrice(nationalBySlug?.[fuel.slug]?.avg_price_eur);
    out[fuel.key] = {
      n: priced.length,
      cheapest: { price: min, stations: cheapest },
      avg,
      national: nat,
      cheapestDelta: nat === null ? null : min - nat,
      avgDelta: nat === null ? null : avg - nat,
    };
  }
  return out;
}
function readStaleCache(key){
  try{
    const raw = localStorage.getItem(PFX + key);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && parsed.d ? { data: parsed.d, ts: Number(parsed.ts) || null } : null;
  }catch{ return null; }
}
async function loadFuelEvora(force){
  if(!force){
    const cached = lsGet(FUEL_EVORA_CACHE_KEY);
    if(cached?.stations) return { ...cached, stale: false };
  }
  try{
    const rowsByFuel = {};
    const fetchAll = async f => {
      const base = `${FUEL_EVORA_URL}&fuel=${encodeURIComponent(f.param)}`;
      const first = await fetchJsonFirstOk(base, {}, 12000);
      const rows = Array.isArray(first?.data) ? [...first.data] : [];
      const pages = Math.min(Number(first?.meta?.pages) || 1, 5);
      for(let page = 2; page <= pages; page++){
        const next = await fetchJsonFirstOk(`${base}&page=${page}`, {}, 12000);
        if(Array.isArray(next?.data)) rows.push(...next.data);
      }
      return rows;
    };
    const replies = await Promise.all(FUEL_EVORA_FUELS.map(fetchAll));
    FUEL_EVORA_FUELS.forEach((f, i) => { rowsByFuel[f.key] = replies[i]; });
    const stations = mergeFuelEvoraStations(rowsByFuel);
    if(!stations.length) throw new Error("sem postos na resposta");
    const observedAt = stations.map(s => s.updatedAt).filter(Number.isFinite).sort((a, b) => b - a)[0] || null;
    const payload = { stations, observedAt };
    lsSet(FUEL_EVORA_CACHE_KEY, payload, { source: "API Aberta", state: "live", observedAt });
    return { ...payload, stale: false };
  }catch(e){
    const stale = readStaleCache(FUEL_EVORA_CACHE_KEY);
    if(stale?.data?.stations) return { ...stale.data, stale: true, error: e };
    throw e;
  }
}
async function loadFuelNational(force){
  let pt = force ? null : lsGet("fuel");
  if(!Array.isArray(pt)){
    try{
      const j = await fetchJsonFirstOk("https://api.apiaberta.pt/v1/fuel/prices", {}, 12000);
      pt = j.data || j;
      if(Array.isArray(pt)) lsSet("fuel", pt, {
        source: "API Aberta",
        state: "live",
        observedAt: pt.map(item => Date.parse(item?.updated_at || "")).filter(Number.isFinite).sort((a, b) => b - a)[0],
      });
    }catch{
      pt = readStaleCache("fuel")?.data;
    }
  }
  const by = {};
  (Array.isArray(pt) ? pt : []).forEach(f => { if(f?.fuel_slug) by[f.fuel_slug] = f; });
  return by;
}
function fmtFuelDelta(delta, base, mode){
  if(!Number.isFinite(delta)) return { txt: "—", cls: "neu" };
  if(mode === "pct" && Number.isFinite(base) && base > 0){
    const pct = delta / base * 100;
    return { txt: `${pct > 0 ? "+" : ""}${window.nf(pct, 2)}%`, cls: pct < -0.05 ? "cheap" : pct > 0.05 ? "dear" : "neu" };
  }
  return { txt: `${delta > 0 ? "+" : ""}${window.nf(delta, 3)}`, cls: delta < -0.0005 ? "cheap" : delta > 0.0005 ? "dear" : "neu" };
}
async function renderFuelEvora(force=false){
  const body = $("fuel-body");
  body.innerHTML = skeletonTable(8);
  try{
    syncFuelDeltaBtn();
    const [ev, national] = await Promise.all([loadFuelEvora(force), loadFuelNational(force)]);
    const prefs = getFuelPrefs();
    if(prefs.view !== "evora") return;
    const fmt = v => Number.isFinite(v) ? window.nf(v, 3) : "—";
    const summary = summarizeFuelEvora(ev.stations, national);
    const sorted = sortFuelEvoraStations(ev.stations, prefs.evSortCol, prefs.evSortDir);

    const tiles = FUEL_EVORA_FUELS.map(f => {
      const s = summary[f.key];
      if(!s.n) return `<div class="fi"><div class="fi-lbl">${f.label} <span class="fi-unit-inline">€/L</span></div><div class="fi-meta">sem postos com preço</div></div>`;
      const names = s.cheapest.stations.map(st => escFuel(st.name)).join(" · ");
      const dMin = fmtFuelDelta(s.cheapestDelta, s.national, prefs.deltaMode);
      const dAvg = fmtFuelDelta(s.avgDelta, s.national, prefs.deltaMode);
      return `<div class="fi fev-tile">
        <div class="fi-lbl">${f.label} <span class="fi-unit-inline">€/L</span></div>
        <div class="fi-cty">Mais barato</div>
        <div class="fi-price">${fmt(s.cheapest.price)}</div>
        <div class="fev-cheapest" title="${names}">${names}</div>
        <div class="fi-delta"><span>vs média PT ${fmt(s.national)}</span><span class="fev-${dMin.cls}">${dMin.txt}</span></div>
        <div class="fi-delta"><span>média Évora ${fmt(s.avg)} · ${s.n} postos</span><span class="fev-${dAvg.cls}">${dAvg.txt}</span></div>
      </div>`;
    }).join("");

    const th = f => {
      const on = prefs.evSortCol === f.key;
      const dir = on ? prefs.evSortDir : null;
      const aria = dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none";
      const arrow = dir === "asc" ? "▲" : dir === "desc" ? "▼" : "↕";
      const next = on && dir === "asc" ? "descendente" : "ascendente";
      return `<th scope="col" class="fev-num" aria-sort="${aria}"><button type="button" class="fev-sort${on ? " on" : ""}" onclick="setFuelEvoraSort('${f.key}')" title="Ordenar por ${f.label} (${next})">${f.short} <span aria-hidden="true">${arrow}</span></button></th>`;
    };
    const rows = sorted.map(st => {
      const place = [st.address, st.locality].filter(Boolean).join(" · ");
      const cells = FUEL_EVORA_FUELS.map(f => {
        const v = st.prices[f.key];
        const best = v !== null && v === summary[f.key]?.cheapest?.price;
        return `<td class="fev-num${best ? " fev-best" : ""}"${best ? ' title="Mais barato do município"' : ""}>${v === null ? "—" : fmt(v)}</td>`;
      }).join("");
      return `<tr><th scope="row" class="fev-name" title="${escFuel(place)}"><span>${escFuel(st.name)}</span>${st.brand ? `<small>${escFuel(st.brand)}</small>` : ""}</th>${cells}</tr>`;
    }).join("");

    const obs = Number.isFinite(ev.observedAt)
      ? new Date(ev.observedAt).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
      : "—";
    const staleNote = ev.stale ? ` · <span class="fev-dear">sem ligação, última leitura guardada</span>` : "";
    body.innerHTML = `<div class="fuel-grid">${tiles}</div>
      <div class="fev-wrap"><table class="fev-table">
        <caption class="sr-only">Postos do município de Évora, preço por litro</caption>
        <thead><tr><th scope="col">Posto</th>${FUEL_EVORA_FUELS.map(th).join("")}</tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div class="src">✦ API Aberta (DGEG) · município de Évora · ${ev.stations.length} postos · ${obs}${staleNote}</div>`;
  }catch(e){
    body.innerHTML = er(e, { context: "Combustíveis Évora", action: "clique em ↺ para tentar novamente" });
    notifyNonCriticalError("Combustíveis Évora", e);
  }
}
function syncFuelView(){
  const view = getFuelPrefs().view;
  document.querySelectorAll?.(".fuel-tab").forEach(btn => {
    const on = btn.dataset.view === view;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  const title = document.getElementById("fuelTitle");
  if(title) title.textContent = view === "evora" ? "Combustíveis · Évora" : "Combustíveis · PT vs ES";
  const detail = document.getElementById("fuelDetailBtn");
  if(detail) detail.style.display = view === "evora" ? "none" : ""; // .rbtn define display: o atributo hidden não chega
}
function setFuelView(view){
  setFuelPrefs({ view: view === "evora" ? "evora" : "ptes" });
}
function setFuelEvoraSort(col){
  const p = getFuelPrefs();
  const dir = p.evSortCol === col && p.evSortDir === "asc" ? "desc" : "asc";
  setFuelPrefs({ evSortCol: col, evSortDir: dir });
}

  window.FUEL_SLUGS = FUEL_SLUGS;
  window.setFuelView = setFuelView;
  window.setFuelEvoraSort = setFuelEvoraSort;
  window.mergeFuelEvoraStations = mergeFuelEvoraStations;
  window.sortFuelEvoraStations = sortFuelEvoraStations;
  window.summarizeFuelEvora = summarizeFuelEvora;
  window.getFuelPrefs = getFuelPrefs;
  window.setFuelPrefs = setFuelPrefs;
  window.syncFuelDeltaBtn = syncFuelDeltaBtn;
  window.toggleFuelDeltaMode = toggleFuelDeltaMode;
  window.renderFuel = renderFuel;
  window.parseESFechaToTs = parseESFechaToTs;
})();
