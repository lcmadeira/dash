/* global $, document, window */
(() => {
/* ══════════════════════════════════════════════════════════════
   EXPORTAÇÕES PT — dados estáticos INE 2024
   ══════════════════════════════════════════════════════════════ */
const /* Exportações PT — INE/AICEP Jan-Nov 2024 (publicado Jan 2025) */
EXP_DATA={
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
      <div style="font-size:.74rem;color:var(--t2);width:128px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.n}</div>
      <div style="flex:1;background:var(--b2);border-radius:3px;height:7px">
        <div style="width:${pct}%;height:100%;background:${r.c};border-radius:3px;transition:width .5s"></div>
      </div>
      <div style="font-size:.74rem;color:var(--text);font-weight:600;width:36px;text-align:right">${r.v}%</div>
    </div>`;
  }).join("")}</div>`;
}

window.switchExp = switchExp;
window.renderExp = renderExp;
})();
