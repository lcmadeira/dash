/* global $, document, window, fetchJsonFirstOk, lsGet, lsSet */
(() => {
/* ══════════════════════════════════════════════════════════════
   EXPORTAÇÕES PT — data/exports.json (INE 0001400, últimos 12 meses; atualizado pelo
   cron do portátil, scripts/update-exports.mjs). Valores fixos de 2024 como alternativa.
   ══════════════════════════════════════════════════════════════ */
/* Alternativa fixa: INE/AICEP jan–nov 2024 (publicado jan 2025) */
let EXP_DATA={
  destinos:[
    {n:"Espanha",      v:25.9,c:"var(--data)"},
    {n:"Alemanha",     v:12.6,c:"var(--data)"},
    {n:"França",       v:12.1,c:"var(--data)"},
    {n:"EUA",          v:6.7, c:"var(--data)"},
    {n:"Reino Unido",  v:4.5, c:"var(--data)"},
    {n:"Angola",       v:3.2, c:"var(--data)"},
    {n:"Países Baixos",v:3.3, c:"var(--data)"},
    {n:"Itália",       v:3.0, c:"var(--data)"},
  ],
  produtos:[
    {n:"Máquinas e Aparelhos",    v:14.8,c:"var(--data)"},
    {n:"Veículos e Transp.",      v:12.5,c:"var(--data)"},
    {n:"Produtos Agrícolas",      v:8.4, c:"var(--data)"},
    {n:"Produtos Químicos",       v:8.1, c:"var(--data)"},
    {n:"Combustíveis Minerais",   v:7.8, c:"var(--data)"},
    {n:"Calçado e Têxteis",       v:6.5, c:"var(--data)"},
    {n:"Cortiça e Madeira",       v:5.2, c:"var(--data)"},
    {n:"Papel e Cartão",          v:3.5, c:"var(--data)"},
  ]
};
let EXP_MODE="destinos";
const EXP_CACHE_KEY="exp_ine_v1";
const EXP_MONTHS=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const expMonth=ym=>{const [y,m]=String(ym||"").split("-");return `${EXP_MONTHS[Number(m)-1]||"?"} ${y}`;};

function isValidExports(d){
  const ok=list=>Array.isArray(list)&&list.length>=4&&list.every(x=>typeof x?.n==="string"&&Number.isFinite(x?.v)&&x.v>=0&&x.v<=100);
  return ok(d?.destinos)&&ok(d?.produtos)&&/^\d{4}-\d{2}$/.test(d?.period?.from||"")&&/^\d{4}-\d{2}$/.test(d?.period?.to||"");
}

function applyExports(d){
  const color="var(--data)";
  EXP_DATA={destinos:d.destinos.map(x=>({n:x.n,v:x.v,c:color})),produtos:d.produtos.map(x=>({n:x.n,v:x.v,c:color}))};
  const src=document.getElementById("expSrc");
  if(src) src.textContent=`✦ INE · comércio internacional de bens (indicador 0001400) · quota nos 12 meses de ${expMonth(d.period.from)} a ${expMonth(d.period.to)}`;
}

/* data/exports.json do próprio site (o INE não permite CORS; o ficheiro é gerado no portátil). */
async function loadExp(force=false){
  const cached=force?null:lsGet(EXP_CACHE_KEY);
  if(isValidExports(cached)){ applyExports(cached); renderExp(); window.refreshCardStatusFromCache?.("exp",EXP_CACHE_KEY); return; }
  try{
    const url=new URL("data/exports.json",window.location.href).href;
    const d=await fetchJsonFirstOk(url,{cache:"no-cache"},10000,["direct"],isValidExports);
    lsSet(EXP_CACHE_KEY,d,{source:"INE · indicador 0001400",state:"live",observedAt:d._meta?.observedAt?Date.parse(`${d._meta.observedAt}T12:00:00Z`):undefined});
    applyExports(d);
  }catch(error){
    console.debug?.("Exportações: data/exports.json indisponível; valores fixos de 2024",error?.message||error);
  }
  renderExp();
  window.refreshCardStatusFromCache?.("exp",EXP_CACHE_KEY);
}
function switchExp(mode,btn){
  if(mode!=="destinos"&&mode!=="produtos")return;
  EXP_MODE=mode;
  document.querySelectorAll("#exp-card .rbtn").forEach(b=>b.classList.remove("on"));
  btn?.classList.add("on"); renderExp();
}
function renderExp(){
  const el=$("exp-body"); if(!el)return;
  const items=EXP_DATA[EXP_MODE];
  const total=items.reduce((a,b)=>a+b.v,0);
  el.innerHTML=`<div style="margin-top:6px">${items.map(r=>{
    const pct=(r.v/total*100).toFixed(1);
    return `<div style="display:flex;align-items:center;gap:8px;margin:5px 0">
      <div style="font-size:.74rem;color:var(--t2);width:128px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${window.nfr(r.n)}</div>
      <div style="flex:1;background:var(--b2);border-radius:3px;height:7px">
        <div style="width:${pct}%;height:100%;background:${r.c};border-radius:3px;transition:width .5s"></div>
      </div>
      <div style="font-size:.74rem;color:var(--text);font-weight:600;width:36px;text-align:right">${window.nfr(r.v)}%</div>
    </div>`;
  }).join("")}</div>`;
}

window.switchExp = switchExp;
window.renderExp = renderExp;
window.loadExp = loadExp;
window.isValidExports = isValidExports;
})();
