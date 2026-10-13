/* global $, ld, window */
(() => {
/* ══════════════════════════════════════════════════════════════
   EMISSÕES CO2 — mix energético de referência
   ══════════════════════════════════════════════════════════════ */
async function loadCO2(_force=false){
  const el=$("co2-body"); if(!el)return;
  el.innerHTML=ld();
  /* Dados estáticos PT 2024 (DGEG/REN Relatório Anual) — sempre disponíveis */
  const STATIC_MIX=[
    {n:"Hídrica",       v:33.4, f:0,   col:"#3B82F6", ico:"💧"},
    {n:"Eólica",        v:28.1, f:0,   col:"#06B6D4", ico:"💨"},
    {n:"Solar FV",      v:12.3, f:0,   col:"#F59E0B", ico:"☀️"},
    {n:"Biomassa",      v:6.1,  f:230, col:"#84CC16", ico:"🌿"},
    {n:"Gás Natural",   v:13.8, f:370, col:"#F97316", ico:"🔥"},
    {n:"Cogeração",     v:4.2,  f:400, col:"#EAB308", ico:"⚙️"},
    {n:"Outros/Import", v:2.1,  f:200, col:"#8B5CF6", ico:"🔌"},
  ];
  const totalStatic=STATIC_MIX.reduce((a,b)=>a+b.v,0);
  const co2Static=STATIC_MIX.reduce((a,b)=>a+b.f*b.v/totalStatic,0);
  const renStatic=STATIC_MIX.filter(x=>x.f===0).reduce((a,b)=>a+b.v,0)/totalStatic*100;

  /* Comparação com outros países (gCO2/kWh médio 2023) */
  const COMPARE=[
    {n:"PT",  v:52,  col:"#10B981", hl:true},
    {n:"ES",  v:118, col:"#84CC16"},
    {n:"FR",  v:56,  col:"#3B82F6"},
    {n:"DE",  v:380, col:"#F59E0B"},
    {n:"PL",  v:680, col:"#EF4444"},
    {n:"EU",  v:255, col:"#8B5CF6"},
  ];
  const maxCO2=Math.max(...COMPARE.map(x=>x.v));

  el.innerHTML=`
    <!-- KPIs principais -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
      <div style="background:var(--b2);border-radius:8px;padding:8px;text-align:center">
        <div style="font-size:1.6rem;font-weight:800;color:#10B981">${Math.round(co2Static)}</div>
        <div style="font-size:.6rem;color:var(--t2)">gCO₂/kWh
          <span class="help-tip" title="Gramas de CO2 por kWh produzido; indicador de intensidade carbónica do sistema elétrico.">?</span>
        </div>
        <div style="font-size:.58rem;color:var(--t3)">média 2024</div>
      </div>
      <div style="background:var(--b2);border-radius:8px;padding:8px;text-align:center">
        <div style="font-size:1.6rem;font-weight:800;color:#06B6D4">${renStatic.toFixed(0)}%</div>
        <div style="font-size:.6rem;color:var(--t2)">Renováveis</div>
        <div style="font-size:.58rem;color:var(--t3)">mix 2024</div>
      </div>
      <div style="background:var(--b2);border-radius:8px;padding:8px;text-align:center">
        <div style="font-size:1.6rem;font-weight:800;color:#F59E0B">3º</div>
        <div style="font-size:.6rem;color:var(--t2)">Ranking EU</div>
        <div style="font-size:.58rem;color:var(--t3)">mais limpa</div>
      </div>
    </div>

    <!-- Mix por fonte -->
    <div style="font-size:.68rem;font-weight:600;color:var(--t2);margin-bottom:6px">Mix energético 2024 · Portugal</div>
    ${STATIC_MIX.map(x=>{
      const pct=(x.v/totalStatic*100).toFixed(1);
      const fc_col=x.f===0?"#10B981":x.f<300?"#84CC16":x.f<450?"#F59E0B":"#EF4444";
      return `<div style="display:flex;align-items:center;gap:7px;margin:4px 0">
        <div style="font-size:.8rem;width:18px">${x.ico}</div>
        <div style="font-size:.65rem;color:var(--t2);width:90px;white-space:nowrap;overflow:hidden">${x.n}</div>
        <div style="flex:1;background:var(--b2);border-radius:3px;height:7px">
          <div style="width:${pct}%;height:100%;background:${x.col};border-radius:3px"></div>
        </div>
        <div style="font-size:.65rem;color:var(--text);font-weight:600;width:32px;text-align:right">${pct}%</div>
        <div style="font-size:.6rem;color:${fc_col};width:38px;text-align:right">${x.f}g</div>
      </div>`;
    }).join("")}

    <!-- Comparação EU -->
    <div style="font-size:.68rem;font-weight:600;color:var(--t2);margin:10px 0 5px">Intensidade carbónica · comparação EU (2023)</div>
    ${COMPARE.map(x=>`<div style="display:flex;align-items:center;gap:7px;margin:3px 0">
      <div style="font-size:.67rem;${x.hl?"font-weight:700;color:var(--text)":"color:var(--t2)"};width:24px">${x.n}</div>
      <div style="flex:1;background:var(--b2);border-radius:3px;height:6px">
        <div style="width:${(x.v/maxCO2*100).toFixed(0)}%;height:100%;background:${x.col};border-radius:3px;${x.hl?"box-shadow:0 0 5px "+x.col+"88":""}"></div>
      </div>
      <div style="font-size:.65rem;${x.hl?"font-weight:700;color:var(--text)":"color:var(--t2)"};width:48px;text-align:right">${x.v} g</div>
    </div>`).join("")}`;
}



window.loadCO2 = loadCO2;
})();
