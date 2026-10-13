/* global $, document, window */
(() => {
/* ══════════════════════════════════════════════════════════════
   DÍVIDA PÚBLICA — Eurostat 2024
   ══════════════════════════════════════════════════════════════ */
const /* Dívida Pública — Eurostat EDP, dados anuais 2024 (publicados Out 2025)
   Fonte: ec.europa.eu/eurostat/web/products-euro-indicators */
DIV_PAISES=[
  {n:"Grécia",  v:154.2,c:"#EF4444"},
  {n:"Itália",  v:134.9,c:"#F97316"},
  {n:"França",  v:113.2,c:"#EAB308"},
  {n:"Bélgica", v:103.9,c:"#F59E0B"},
  {n:"Espanha", v:101.6,c:"#F59E0B"},
  {n:"Portugal",v:94.6, c:"#84CC16",hl:true},
  {n:"Zona Euro",v:87.1,c:"#8B5CF6"},
  {n:"Alemanha",v:62.4, c:"#3B82F6"},
  {n:"Holanda", v:43.8, c:"#06B6D4"},
];
const DIV_TREND=[
  {y:"14",v:130.6},{y:"15",v:128.8},{y:"16",v:129.2},{y:"17",v:124.8},
  {y:"18",v:121.5},{y:"19",v:116.8},{y:"20",v:134.9},{y:"21",v:124.5},
  {y:"22",v:113.9},{y:"23",v:97.9},{y:"24",v:94.6},
];
let DIV_MODE="bar";
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
        <div style="font-size:.67rem;color:${r.hl?"var(--text)":"var(--t2)"};width:68px;${r.hl?"font-weight:700":""};white-space:nowrap">${r.n}</div>
        <div style="flex:1;background:var(--b2);border-radius:3px;height:7px">
          <div style="width:${(r.v/mx*100).toFixed(1)}%;height:100%;background:${r.c};border-radius:3px;${r.hl?`box-shadow:0 0 6px ${r.c}88`:""}"></div>
        </div>
        <div style="font-size:.67rem;font-weight:600;color:${r.hl?"var(--text)":"var(--t2)"};width:44px;text-align:right">${r.v}%</div>
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
      <div style="font-size:.7rem;color:var(--t2);margin-bottom:4px">Portugal · Dívida % PIB · 2014–2024</div>
      <svg viewBox="0 0 ${W} ${H+22}" style="width:100%;height:76px">
        <polygon points="${fill}" fill="#84CC1622"/>
        <polyline points="${pts}" fill="none" stroke="#84CC16" stroke-width="2"/>
        ${DIV_TREND.map((x,i)=>`
          <circle cx="${px(i)}" cy="${py(x.v)}" r="3" fill="#84CC16"/>
          <text x="${px(i)}" y="${H+14}" font-size="8" fill="#6E7A96" text-anchor="middle">${x.y}</text>
          <text x="${px(i)}" y="${py(x.v)-5}" font-size="8" fill="#A3E635" text-anchor="middle">${x.v}</text>
        `).join("")}
      </svg>
    </div>`;
  }
}

window.switchDiv = switchDiv;
window.renderDiv = renderDiv;
})();
