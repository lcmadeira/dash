/* global document, window */
(() => {
function loadSMN(_force){
  const el=document.getElementById("smn-body");
  if(!el) return;

  const SMN_HIST=[
    {y:2017,v:557},{y:2018,v:580},{y:2019,v:600},{y:2020,v:635},
    {y:2021,v:665},{y:2022,v:705},{y:2023,v:760},{y:2024,v:820},
    {y:2025,v:870},{y:2026,v:920},
  ];

  /* Eurostat earn_mw_cur, equivalência mensal bruta em jan. 2026. */
  /* Espanha: último valor disponível, referente a 2025. */
  const SMN_EU=[
    {c:"🇱🇺",n:"Luxemburgo", v:2704,col:"#10B981"},
    {c:"🇩🇪",n:"Alemanha",   v:2343,col:"#10B981"},
    {c:"🇳🇱",n:"Países Baixos",v:2295,col:"#10B981"},
    {c:"🇧🇪",n:"Bélgica",    v:2112,col:"#10B981"},
    {c:"🇫🇷",n:"França",     v:1823,col:"#3B82F6"},
    {c:"🇪🇸",n:"Espanha",    v:1381,col:"#3B82F6"},
    {c:"🇬🇷",n:"Grécia",     v:1027,col:"#F59E0B"},
    {c:"🇵🇹",n:"Portugal",   v:1073,col:"#F59E0B"},
    {c:"🇵🇱",n:"Polónia",    v:1139,col:"#F97316"},
    {c:"🇷🇴",n:"Roménia",    v:795, col:"#EF4444"},
    {c:"🇧🇬",n:"Bulgária",   v:620, col:"#EF4444"},
  ];

  const smn=920, smn24=870;
  const yoy=((smn-smn24)/smn24*100).toFixed(1);
  const smnEurostat=Math.round(smn*14/12);

  const vals=SMN_HIST.map(x=>x.v);
  const mn=Math.min(...vals),mx=Math.max(...vals),rng=mx-mn||1;
  const W=180,H=40;
  const px=i=>Math.round(i/(vals.length-1)*W);
  const py=v=>Math.round(H-(v-mn)/rng*H);
  const pts=vals.map((v,i)=>`${px(i)},${py(v)}`).join(" ");
  const fill=pts+` ${W},${H+1} 0,${H+1}`;

  el.innerHTML=`
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">

    <!-- ESQ: SMN + EU -->
    <div>
      <div style="background:var(--b2);border-radius:10px;padding:10px 12px;margin-bottom:8px">
        <div style="font-size:.58rem;color:var(--t3);text-transform:uppercase;
             letter-spacing:.5px;margin-bottom:2px">SMN legal Portugal 2026 · bruto</div>
        <div style="display:flex;align-items:flex-end;gap:5px">
          <div style="font-size:2.2rem;font-weight:900;color:#10B981;line-height:1">${smn}</div>
          <div style="font-size:.72rem;color:var(--t3);margin-bottom:3px">€/mês</div>
        </div>
        <div style="font-size:.68rem;color:#10B981;font-weight:600;margin-top:1px">▲ ${yoy}% vs 2025 (870€) · 14 pagamentos/ano</div>
        <svg viewBox="0 0 ${W} ${H+10}" style="width:100%;height:${H+10}px;margin-top:5px">
          <polygon points="${fill}" fill="#10B98118"/>
          <polyline points="${pts}" fill="none" stroke="#10B981" stroke-width="1.8"/>
          <circle cx="${px(vals.length-1)}" cy="${py(smn)}" r="3" fill="#10B981"/>
          <text x="1" y="${H+9}" font-size="7" fill="#4A526A">2017: 557€</text>
          <text x="${W}" y="${H+9}" font-size="7" fill="#10B981" text-anchor="end">2026: ${smn}€</text>
        </svg>
        <div style="font-size:.57rem;color:var(--t3);margin-top:1px">+65% em 9 anos</div>
      </div>

      <div style="font-size:.63rem;font-weight:700;color:var(--t2);margin-bottom:2px">Comparação UE · Eurostat jan. 2026</div>
      <div style="font-size:.55rem;color:var(--t3);margin-bottom:4px">Bruto mensal equivalente · Espanha: dado de 2025</div>
      ${SMN_EU.map(r=>{
        const bw=Math.round((r.v/2704)*100);
        const ispt=r.n==="Portugal";
        return `<div style="display:grid;grid-template-columns:16px 66px 1fr 38px;
                     align-items:center;gap:3px;padding:2px ${ispt?"4px":"0"};
                     ${ispt?"background:"+r.col+"15;border-radius:4px;margin:1px -4px;":"border-bottom:1px solid var(--b)"}">
          <span style="font-size:.76rem">${r.c}</span>
          <span style="font-size:.59rem;font-weight:${ispt?700:400};
                color:${ispt?"#fff":"var(--t2)"}">${r.n}</span>
          <div style="background:var(--b2);border-radius:2px;height:4px;overflow:hidden">
            <div style="width:${bw}%;height:100%;background:${r.col}"></div>
          </div>
          <span style="font-size:.61rem;color:${r.col};font-weight:600;text-align:right">${r.v}€</span>
        </div>`;
      }).join("")}
    </div>

    <!-- DIR: explicação da comparação -->
    <div>
      <div style="font-size:.63rem;font-weight:700;color:var(--t2);margin-bottom:5px">Como comparar o valor português</div>
      <div style="background:var(--b2);border-radius:8px;padding:9px 10px;margin-bottom:7px">
        <div style="font-size:.61rem;color:var(--t2);line-height:1.55">
          Em Portugal, o salário mínimo é pago em 14 prestações anuais. O valor legal de
          <b style="color:var(--text)">920€ × 14</b> corresponde a
          <b style="color:#10B981">${smnEurostat}€ brutos/mês</b> quando distribuído por 12 meses,
          como faz o Eurostat para comparar países.
        </div>
      </div>
      <div style="background:var(--b2);border-radius:8px;padding:9px 10px">
        <div style="font-size:.61rem;color:var(--t2);line-height:1.55">
          São valores brutos nominais. Não descontam impostos nem ajustam diferenças de preços
          entre países; por isso, não medem diretamente o poder de compra ou o custo de vida.
        </div>
      </div>
    </div>
  </div>`;
}
window.loadSMN = loadSMN;
})();
