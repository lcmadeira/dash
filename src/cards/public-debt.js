/* global $, document, window, fetchJsonFirstOk, lsGet, lsSet */
(() => {
/* ══════════════════════════════════════════════════════════════
   DÍVIDA PÚBLICA — Eurostat gov_10dd_edpt1 (automático), valores fixos como alternativa
   ══════════════════════════════════════════════════════════════ */
/* Alternativa fixa: Eurostat EDP, dados anuais 2024 (publicados Out 2025). */
let DIV_YEAR=2024;
let DIV_PAISES=[
  {n:"Grécia",  v:154.2,c:"var(--data-muted)"},
  {n:"Itália",  v:134.9,c:"var(--data-muted)"},
  {n:"França",  v:113.2,c:"var(--data-muted)"},
  {n:"Bélgica", v:103.9,c:"var(--data-muted)"},
  {n:"Espanha", v:101.6,c:"var(--data-muted)"},
  {n:"Portugal",v:94.6, c:"var(--accent)",hl:true},
  {n:"Zona Euro",v:87.1,c:"var(--data-muted)"},
  {n:"Alemanha",v:62.4, c:"var(--data-muted)"},
  {n:"Holanda", v:43.8, c:"var(--data-muted)"},
];
let DIV_TREND=[
  {y:"14",v:130.6},{y:"15",v:128.8},{y:"16",v:129.2},{y:"17",v:124.8},
  {y:"18",v:121.5},{y:"19",v:116.8},{y:"20",v:134.9},{y:"21",v:124.5},
  {y:"22",v:113.9},{y:"23",v:97.9},{y:"24",v:94.6},
];
let DIV_MODE="bar";

/* Ordem e cor de cada série; EA21 a partir de 2026 (entrada da Bulgária), EA20 antes. */
const DIV_GEOS=[
  {geo:"EL",n:"Grécia"},{geo:"IT",n:"Itália"},{geo:"FR",n:"França"},{geo:"BE",n:"Bélgica"},
  {geo:"ES",n:"Espanha"},{geo:"PT",n:"Portugal",hl:true},{geo:"EA",n:"Zona Euro"},
  {geo:"DE",n:"Alemanha"},{geo:"NL",n:"Holanda"},
];
const DIV_CACHE_KEY="div_eurostat_v1";
const DIV_URL="https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/gov_10dd_edpt1?format=JSON&lang=EN&na_item=GD&sector=S13&unit=PC_GDP&sinceTimePeriod=2014"
  +["EL","IT","FR","BE","ES","PT","EA20","EA21","DE","NL"].map(g=>`&geo=${g}`).join("");

/** JSON-stat do Eurostat → {year, countries:[{n,v,hl}], trend:[{y,v}], updated}. */
function parseEurostatDebt(json){
  const dims=json?.id, size=json?.size, values=json?.value;
  if(!Array.isArray(dims)||!Array.isArray(size)||!values) return null;
  const geoIdx=json.dimension?.geo?.category?.index||{}, timeIdx=json.dimension?.time?.category?.index||{};
  const stride=dims.map((_,i)=>size.slice(i+1).reduce((a,b)=>a*b,1));
  const gPos=dims.indexOf("geo"), tPos=dims.indexOf("time");
  if(gPos<0||tPos<0) return null;
  const val=(geo,year)=>{
    const g=geoIdx[geo], t=timeIdx[String(year)];
    if(g===undefined||t===undefined) return null;
    const v=Number(values[String(g*stride[gPos]+t*stride[tPos])]);
    return Number.isFinite(v)?v:null;
  };
  const years=Object.keys(timeIdx).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  const year=[...years].reverse().find(y=>val("PT",y)!==null);
  if(!year) return null;
  const countries=DIV_GEOS.map(d=>{
    // A zona euro tinha 20 membros até 2025; a Bulgária entrou em 2026 (EA21).
    const v=d.geo==="EA"?(year>=2026?(val("EA21",year)??val("EA20",year)):(val("EA20",year)??val("EA21",year))):val(d.geo,year);
    return v===null?null:{n:d.n,v,hl:Boolean(d.hl)};
  }).filter(Boolean);
  const trend=years.filter(y=>y<=year&&val("PT",y)!==null).map(y=>({y:String(y).slice(2),v:val("PT",y)}));
  if(countries.length<6||trend.length<3) return null;
  return {year,countries,trend,updated:json.updated||null};
}

function applyDivData(d){
  DIV_YEAR=d.year;
  DIV_PAISES=d.countries.map(c=>({...c,c:c.hl?"var(--accent)":"var(--data-muted)"}));
  DIV_TREND=d.trend;
  const src=document.getElementById("divSrc");
  if(src) src.textContent=`✦ Eurostat · dívida das administrações públicas (gov_10dd_edpt1) · ${d.year} · % do PIB · automático`;
}

async function loadDiv(force=false){
  const cached=force?null:lsGet(DIV_CACHE_KEY);
  if(cached?.year){ applyDivData(cached); renderDiv(); window.refreshCardStatusFromCache?.("div",DIV_CACHE_KEY); return; }
  try{
    const json=await fetchJsonFirstOk(DIV_URL,{},15000,["direct"],j=>Boolean(j?.value&&j?.dimension));
    const d=parseEurostatDebt(json);
    if(!d) throw new Error("Resposta do Eurostat sem dados de Portugal");
    lsSet(DIV_CACHE_KEY,d,{source:"Eurostat · gov_10dd_edpt1",state:"live",observedAt:d.updated?Date.parse(d.updated):undefined});
    applyDivData(d);
  }catch(error){
    console.debug?.("Dívida: Eurostat indisponível; valores fixos de 2024",error?.message||error);
  }
  renderDiv();
  window.refreshCardStatusFromCache?.("div",DIV_CACHE_KEY);
}
function switchDiv(mode,btn){
  if(mode!=="bar"&&mode!=="trend")return;
  DIV_MODE=mode;
  document.querySelectorAll("#div-card .rbtn").forEach(b=>b.classList.remove("on"));
  btn?.classList.add("on"); renderDiv();
}
function renderDiv(){
  const el=$("div-body"); if(!el)return;
  if(DIV_MODE==="bar"){
    const sorted=[...DIV_PAISES].sort((a,b)=>b.v-a.v);
    const mx=sorted[0].v;
    el.innerHTML=`<div style="margin-top:6px">${sorted.map(r=>`
      <div style="display:flex;align-items:center;gap:8px;margin:4px 0">
        <div style="font-size:.74rem;color:${r.hl?"var(--text)":"var(--t2)"};width:68px;${r.hl?"font-weight:700":""};white-space:nowrap">${window.nfr(r.n)}</div>
        <div style="flex:1;background:var(--b2);border-radius:3px;height:7px">
          <div style="width:${(r.v/mx*100).toFixed(1)}%;height:100%;background:${r.c};border-radius:3px"></div>
        </div>
        <div style="font-size:.74rem;font-weight:600;color:${r.hl?"var(--text)":"var(--t2)"};width:44px;text-align:right">${window.nfr(r.v)}%</div>
      </div>`).join("")}</div>`;
  }else{
    const vals=DIV_TREND.map(x=>x.v);
    const mn=Math.min(...vals),mx=Math.max(...vals),rng=mx-mn||1;
    const W=260,H=60;
    const px=i=>Math.round(i/(vals.length-1)*W);
    const py=v=>Math.round(H-(v-mn)/rng*H);
    const pts=vals.map((v,i)=>`${px(i)},${py(v)}`).join(" ");
    const fill=vals.map((v,i)=>`${px(i)},${py(v)}`).join(" ")+` ${W},${H+2} 0,${H+2}`;
    el.innerHTML=`<div style="margin-top:4px">
      <div style="font-size:.74rem;color:var(--t2);margin-bottom:4px">Portugal · Dívida % PIB · 20${DIV_TREND[0].y}–${DIV_YEAR}</div>
      <svg viewBox="0 0 ${W} ${H+22}" style="width:100%;height:76px">
        <polygon points="${fill}" style="fill:var(--ad)"/>
        <polyline points="${pts}" fill="none" style="stroke:var(--accent)" stroke-width="2"/>
        ${DIV_TREND.map((x,i)=>`
          <circle cx="${px(i)}" cy="${py(x.v)}" r="3" style="fill:var(--accent)"/>
          <text x="${px(i)}" y="${H+14}" font-size="8" fill="#6E7A96" text-anchor="middle">${window.nfr(x.y)}</text>
          <text x="${px(i)}" y="${py(x.v)-5}" font-size="8" style="fill:var(--text)" text-anchor="middle">${window.nfr(x.v)}</text>
        `).join("")}
      </svg>
    </div>`;
  }
}

window.switchDiv = switchDiv;
window.renderDiv = renderDiv;
window.loadDiv = loadDiv;
window.parseEurostatDebt = parseEurostatDebt;
})();
