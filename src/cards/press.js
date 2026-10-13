/* global document, window */
(() => {
function loadPress(_force){
  const el=document.getElementById("press-body");
  if(!el) return;

  /* RSF World Press Freedom Index 2026 (score 0-100, maior=melhor) */
  /* Fonte: rsf.org/en/index */
  const RSF=[
    {c:"🇳🇴",n:"Noruega",   rank:1,  score:92.72,trend:0,   status:"Livre"},
    {c:"🇩🇰",n:"Dinamarca", rank:4,  score:88.47,trend:+2,  status:"Livre"},
    {c:"🇸🇪",n:"Suécia",    rank:5,  score:87.61,trend:-1,  status:"Livre"},
    {c:"🇫🇮",n:"Finlândia", rank:6,  score:86.22,trend:-1,  status:"Livre"},
    {c:"🇳🇱",n:"Países Baixos",rank:2,score:88.92,trend:+1,status:"Livre"},
    {c:"🇵🇹",n:"Portugal",  rank:10, score:83.71,trend:-2,  status:"Satisfatório"},
    {c:"🇩🇪",n:"Alemanha",  rank:14, score:82.17,trend:-3,  status:"Satisfatório"},
    {c:"🇫🇷",n:"França",    rank:25, score:76.68,trend:0,   status:"Satisfatório"},
    {c:"🇪🇸",n:"Espanha",   rank:29, score:75.42,trend:-6,  status:"Satisfatório"},
    {c:"🇬🇧",n:"Reino Unido",rank:18,score:79.45,trend:+2,  status:"Satisfatório"},
    {c:"🇺🇸",n:"EUA",       rank:64, score:62.61,trend:-7,  status:"Problemático"},
    {c:"🇧🇷",n:"Brasil",    rank:52, score:66.37,trend:+11, status:"Problemático"},
    {c:"🇮🇳",n:"Índia",     rank:157,score:31.96,trend:-6,  status:"Muito grave"},
    {c:"🇷🇺",n:"Rússia",    rank:172,score:23.15,trend:-1,  status:"Muito grave"},
    {c:"🇨🇳",n:"China",     rank:178,score:13.85,trend:0,   status:"Muito grave"},
  ];

  /* EIU Democracy Index 2024 (0-10), mantido como série histórica */
  /* Fonte: eiu.com/democracy-index */
  const EIU=[
    {c:"🇳🇴",n:"Noruega",   score:9.81,type:"Democracia plena"},
    {c:"🇮🇸",n:"Islândia",  score:9.45,type:"Democracia plena"},
    {c:"🇸🇪",n:"Suécia",    score:9.39,type:"Democracia plena"},
    {c:"🇳🇿",n:"Nova Zelândia",score:9.37,type:"Democracia plena"},
    {c:"🇩🇰",n:"Dinamarca", score:9.22,type:"Democracia plena"},
    {c:"🇵🇹",n:"Portugal",  score:7.90,type:"Democracia plena"},
    {c:"🇩🇪",n:"Alemanha",  score:8.80,type:"Democracia plena"},
    {c:"🇺🇸",n:"EUA",       score:7.85,type:"Democracia com falhas"},
    {c:"🇧🇷",n:"Brasil",    score:6.78,type:"Democracia com falhas"},
    {c:"🇷🇺",n:"Rússia",    score:2.22,type:"Regime autoritário"},
    {c:"🇨🇳",n:"China",     score:1.97,type:"Regime autoritário"},
  ];

  /* Estatísticas globais RSF 2024 */
  const GLOBAL={
    livre:31.4, satisfatorio:24.6, problematico:17.8, dificil:13.2, muitoGrave:13.0,
    total:180,
    tendencia:"↓ Situação deteriorou-se em 60% dos países em 2024"
  };

  /* Distribuição regional */
  const REGIONS=[
    {r:"Europa",score:71.2,col:"#10B981"},
    {r:"Américas",score:57.8,col:"#3B82F6"},
    {r:"Ásia-Pacífico",score:45.6,col:"#F59E0B"},
    {r:"MENA",score:38.2,col:"#F97316"},
    {r:"África",score:42.1,col:"#8B5CF6"},
    {r:"Ásia Central",score:22.4,col:"#EF4444"},
  ];

  const statusCol={
    "Livre":"#10B981","Satisfatório":"#84CC16","Problemático":"#F59E0B",
    "Difícil":"#F97316","Muito grave":"#EF4444"
  };

  el.innerHTML=`
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">

    <!-- COLUNA 1: RSF Press Freedom -->
    <div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
        <div style="font-size:.72rem;font-weight:700;color:#8B5CF6;text-transform:uppercase;letter-spacing:.5px">📰 Liberdade de Imprensa</div>
        <div style="font-size:.58rem;color:var(--t3)">RSF 2026 · variação face a 2025</div>
      </div>

      <!-- Distribuição global -->
      <div style="margin-bottom:8px">
        <div style="font-size:.6rem;color:var(--t3);margin-bottom:3px">Distribuição global RSF 2024 (${GLOBAL.total} países)</div>
        <div style="display:flex;height:8px;border-radius:4px;overflow:hidden;gap:1px">
          ${Object.entries({Livre:GLOBAL.livre,"Satisf.":GLOBAL.satisfatorio,"Problem.":GLOBAL.problematico,"Difícil":GLOBAL.dificil,"M.Grave":GLOBAL.muitoGrave})
            .map(([k,v],i)=>{
              const cols=["#10B981","#84CC16","#F59E0B","#F97316","#EF4444"];
              return `<div style="flex:${v};background:${cols[i]}" title="${k}: ${v}%"></div>`;
            }).join("")}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.55rem;color:var(--t3);margin-top:2px">
          <span style="color:#10B981">Livre ${GLOBAL.livre}%</span>
          <span style="color:#EF4444">M.Grave ${GLOBAL.muitoGrave}%</span>
        </div>
        <div style="font-size:.6rem;color:#F59E0B;margin-top:3px">${GLOBAL.tendencia}</div>
      </div>

      <!-- Tabela países seleccionados -->
      <div style="font-size:.65rem;font-weight:600;color:var(--t2);margin-bottom:4px">Países seleccionados:</div>
      ${RSF.map(r=>{
        const col=statusCol[r.status]||"#6E7A96";
        const trendIcon=r.trend>0?"↑":r.trend<0?"↓":"→";
        const trendCol=r.trend>0?"#10B981":r.trend<0?"#EF4444":"#6E7A96";
        const barW=Math.round(r.score);
        return `<div style="display:grid;grid-template-columns:16px 80px 30px 1fr 36px 24px;
                     align-items:center;gap:4px;padding:2px 0;border-bottom:1px solid var(--b)">
          <span style="font-size:.8rem">${r.c}</span>
          <span style="font-size:.63rem;color:${r.n==="Portugal"?"#fff":"var(--text)"};
                font-weight:${r.n==="Portugal"?"700":"400"}">${r.n}</span>
          <span style="font-size:.58rem;color:var(--t3)">#${r.rank}</span>
          <div style="background:var(--b2);border-radius:2px;height:5px;overflow:hidden">
            <div style="width:${barW}%;height:100%;background:${col};border-radius:2px"></div>
          </div>
          <span style="font-size:.58rem;color:var(--t2);text-align:right">${r.score.toFixed(2)}</span>
          <span style="font-size:.6rem;color:${trendCol};text-align:right" title="Variação da posição face a 2025">${trendIcon}${Math.abs(r.trend)||""}</span>
        </div>`;
      }).join("")}
    </div>

    <!-- COLUNA 2: EIU Democracy + Regiões -->
    <div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
        <div style="font-size:.72rem;font-weight:700;color:#3B82F6;text-transform:uppercase;letter-spacing:.5px">🗳️ Índice Democracia</div>
        <div style="font-size:.58rem;color:var(--t3)">EIU 2024 · histórico</div>
      </div>

      <!-- Categorias EIU -->
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px;margin-bottom:8px">
        ${[["Democracia plena","#10B981","8-10"],["Dem. com falhas","#84CC16","6-8"],
           ["Regime híbrido","#F59E0B","4-6"],["Reg. autoritário","#EF4444","0-4"]].map(([lbl,col,range])=>
          `<div style="background:${col}18;border:1px solid ${col}33;border-radius:5px;padding:4px 6px">
            <div style="font-size:.58rem;font-weight:600;color:${col}">${lbl}</div>
            <div style="font-size:.55rem;color:var(--t3)">${range} / 10</div>
          </div>`).join("")}
      </div>

      <!-- Países EIU -->
      <div style="font-size:.65rem;font-weight:600;color:var(--t2);margin-bottom:4px">Países seleccionados:</div>
      ${EIU.map(r=>{
        const col=r.score>=8?"#10B981":r.score>=6?"#84CC16":r.score>=4?"#F59E0B":"#EF4444";
        const barW=Math.round(r.score*10);
        return `<div style="display:grid;grid-template-columns:16px 90px 1fr 30px;
                     align-items:center;gap:4px;padding:2px 0;border-bottom:1px solid var(--b)">
          <span style="font-size:.8rem">${r.c}</span>
          <span style="font-size:.63rem;color:${r.n==="Portugal"?"#fff":"var(--text)"};
                font-weight:${r.n==="Portugal"?"700":"400"}">${r.n}</span>
          <div style="background:var(--b2);border-radius:2px;height:5px;overflow:hidden">
            <div style="width:${barW}%;height:100%;background:${col};border-radius:2px"></div>
          </div>
          <span style="font-size:.63rem;color:${col};font-weight:600;text-align:right">${r.score.toFixed(1)}</span>
        </div>`;
      }).join("")}

      <!-- Score médio mundial -->
      <div style="background:var(--b2);border-radius:6px;padding:6px 8px;margin-top:8px;
           font-size:.63rem;color:var(--t2)">
        <b style="color:var(--text)">Média mundial 2024: 5.17</b> /10 · mínimo histórico
        <div style="font-size:.58rem;color:var(--t3);margin-top:1px">Apenas 7.8% da pop. mundial vive em democracia plena</div>
      </div>

      <!-- Score regiões -->
      <div style="margin-top:8px">
        <div style="font-size:.63rem;font-weight:600;color:var(--t2);margin-bottom:4px">Score por região RSF 2024:</div>
        ${REGIONS.map(r=>`<div style="display:flex;align-items:center;gap:6px;padding:2px 0">
          <span style="font-size:.6rem;color:var(--t3);width:70px;flex-shrink:0">${r.r}</span>
          <div style="flex:1;background:var(--b2);border-radius:2px;height:5px;overflow:hidden">
            <div style="width:${r.score}%;height:100%;background:${r.col};border-radius:2px"></div>
          </div>
          <span style="font-size:.6rem;color:${r.col};font-weight:600;width:30px;text-align:right">${r.score}</span>
        </div>`).join("")}
      </div>
    </div>
  </div>`;
}
window.loadPress = loadPress;
})();
