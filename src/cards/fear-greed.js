/* global $, AbortSignal, er, ld, lsGet, lsSet, notifyNonCriticalError, window */
(() => {
async function loadFng(force){
  const el=$("fng-body"); if(!el)return;
  el.innerHTML=ld();
  const ck="fng_v4";
  let d=force?null:lsGet(ck);
  if(!d){
    try{
      const r=await fetch("https://api.alternative.me/fng/?limit=30",
        {signal:AbortSignal.timeout(8000)});
      if(!r.ok)throw new Error("HTTP "+r.status);
      const j=await r.json();
      d=j.data; if(d?.length)lsSet(ck,d);
    }catch(e){el.innerHTML=er(e,{context:"Fear & Greed",action:"tente novo refresh em alguns segundos"});notifyNonCriticalError("Fear & Greed",e,"tente novo refresh em alguns segundos");return;}
  }
  if(!d?.length)return;

  const BANDS=[[0,25,"#EF4444","Medo Extremo"],[26,46,"#F97316","Medo"],
               [47,54,"#EAB308","Neutro"],[55,75,"#84CC16","Ganância"],
               [76,100,"#10B981","Ganância Extrema"]];
  function getCol(v){ return (BANDS.find(c=>v>=c[0]&&v<=c[1])||BANDS[2])[2]; }
  function getLbl(v){ return (BANDS.find(c=>v>=c[0]&&v<=c[1])||BANDS[2])[3]; }

  const cur=d[0], val=+cur.value, col=getCol(val), lbl=getLbl(val);

  /* Gauge SVG melhorado */
  const cx=80,cy=72,R=56,Ri=42;
  function arcPath(a1,a2,r1,r2){
    const toRad=a=>(a-90)*Math.PI/180;
    const x1=cx+r1*Math.cos(toRad(a1)),y1=cy+r1*Math.sin(toRad(a1));
    const x2=cx+r2*Math.cos(toRad(a1)),y2=cy+r2*Math.sin(toRad(a1));
    const x3=cx+r2*Math.cos(toRad(a2)),y3=cy+r2*Math.sin(toRad(a2));
    const x4=cx+r1*Math.cos(toRad(a2)),y4=cy+r1*Math.sin(toRad(a2));
    const laf=a2-a1>180?1:0;
    return `M${x1},${y1} A${r1},${r1} 0 ${laf},1 ${x4},${y4} L${x3},${y3} A${r2},${r2} 0 ${laf},0 ${x2},${y2} Z`;
  }
  /* Arcos coloridos (0-180°) */
  const segs=[[0,36,"#EF4444"],[36,72,"#F97316"],[72,108,"#EAB308"],[108,144,"#84CC16"],[144,180,"#10B981"]];
  const segSvg=segs.map(([a1,a2,c])=>`<path d="${arcPath(a1,a2,Ri,R)}" fill="${c}" opacity="0.85"/>`).join("");

  /* Agulha */
  const ang=(val/100*180-90)*Math.PI/180;
  const nx=cx+R*Math.cos(ang), ny=cy+R*Math.sin(ang);
  const nx2=cx+(Ri-8)*Math.cos(ang), ny2=cy+(Ri-8)*Math.sin(ang);

  const gauge=`<svg width="160" height="82" viewBox="0 0 160 82">
    <defs>
      <filter id="glow"><feGaussianBlur stdDeviation="2" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <!-- Fundo arco -->
    <path d="M${cx-R},${cy} A${R},${R} 0 0,1 ${cx+R},${cy} L${cx+Ri},${cy} A${Ri},${Ri} 0 0,0 ${cx-Ri},${cy} Z" fill="#111827"/>
    ${segSvg}
    <!-- Linha zero -->
    <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy-R-4}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="2,2"/>
    <!-- Agulha -->
    <line x1="${nx2}" y1="${ny2}" x2="${nx}" y2="${ny}" stroke="white" stroke-width="2.5" stroke-linecap="round" filter="url(#glow)"/>
    <circle cx="${cx}" cy="${cy}" r="5" fill="white"/>
    <circle cx="${cx}" cy="${cy}" r="2.5" fill="#1F2937"/>
    <!-- Labels 0 e 100 -->
    <text x="${cx-R+2}" y="${cy+12}" font-size="8" fill="#6E7A96" text-anchor="middle">0</text>
    <text x="${cx+R-2}" y="${cy+12}" font-size="8" fill="#6E7A96" text-anchor="middle">100</text>
  </svg>`;

  /* Histórico 30 dias — sparkline */
  const hist30=d.slice(0,30).reverse().map(x=>+x.value);
  const hMin=Math.min(...hist30), hMax=Math.max(...hist30), hRng=hMax-hMin||1;
  const SW=200, SH=36;
  const spx=i=>Math.round(i/(hist30.length-1)*SW);
  const spy=v=>Math.round(SH-(v-hMin)/hRng*SH);
  const spPts=hist30.map((v,i)=>`${spx(i)},${spy(v)}`).join(" ");
  const spFill=spPts+` ${SW},${SH+2} 0,${SH+2}`;
  const spCol=getCol(hist30[hist30.length-1]);
  const sparkSvg=`<svg viewBox="0 0 ${SW} ${SH+4}" style="width:100%;height:${SH+4}px">
    <polygon points="${spFill}" fill="${spCol}18"/>
    <polyline points="${spPts}" fill="none" stroke="${spCol}" stroke-width="1.5" opacity="0.8"/>
    <circle cx="${spx(hist30.length-1)}" cy="${spy(hist30[hist30.length-1])}" r="3" fill="${spCol}"/>
  </svg>`;

  /* Últimos 7 dias — stats */
  const week=d.slice(0,7);
  const wAvg=Math.round(week.reduce((a,x)=>a+(+x.value),0)/week.length);
  const wMin=Math.min(...week.map(x=>+x.value));
  const wMax=Math.max(...week.map(x=>+x.value));

  /* Dias da semana */
  const DIAS=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

  el.innerHTML=`
  <!-- Layout: gauge + valor lado a lado -->
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
    <div style="flex-shrink:0">${gauge}</div>
    <div style="flex:1">
      <div style="font-size:3rem;font-weight:900;color:${col};line-height:1;letter-spacing:-2px">${val}</div>
      <div style="font-size:.8rem;font-weight:700;color:${col};text-transform:uppercase;letter-spacing:.5px;margin-top:2px">${lbl}</div>
      <!-- Stats 7d -->
      <div style="display:flex;gap:8px;margin-top:8px">
        <div style="background:var(--b2);border-radius:6px;padding:4px 8px;text-align:center;flex:1">
          <div style="font-size:.55rem;color:var(--t3)">7d Mín</div>
          <div style="font-size:.85rem;font-weight:700;color:${getCol(wMin)}">${wMin}</div>
        </div>
        <div style="background:var(--b2);border-radius:6px;padding:4px 8px;text-align:center;flex:1">
          <div style="font-size:.55rem;color:var(--t3)">7d Méd</div>
          <div style="font-size:.85rem;font-weight:700;color:${getCol(wAvg)}">${wAvg}</div>
        </div>
        <div style="background:var(--b2);border-radius:6px;padding:4px 8px;text-align:center;flex:1">
          <div style="font-size:.55rem;color:var(--t3)">7d Máx</div>
          <div style="font-size:.85rem;font-weight:700;color:${getCol(wMax)}">${wMax}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Sparkline 30d -->
  <div style="margin-bottom:6px">
    <div style="display:flex;justify-content:space-between;font-size:.6rem;color:var(--t3);margin-bottom:2px">
      <span>30 dias</span>
      <span>${d[29]?new Date(+d[29].timestamp*1000).toLocaleDateString("pt",{day:"2-digit",month:"2-digit"}):""} → hoje</span>
    </div>
    ${sparkSvg}
  </div>

  <!-- Últimos 7 dias como grid -->
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">
    ${week.reverse().map(x=>{
      const v=+x.value, c=getCol(v);
      const dt=new Date(+x.timestamp*1000);
      const day=DIAS[dt.getDay()];
      const isToday=x===d[0];
      return `<div style="background:${isToday?c+"22":"var(--b2)"};border:1px solid ${isToday?c+"55":"transparent"};
                   border-radius:5px;padding:4px 2px;text-align:center">
        <div style="font-size:.55rem;color:var(--t3)">${day}</div>
        <div style="font-size:.82rem;font-weight:700;color:${c}">${v}</div>
        <div style="font-size:.5rem;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${getLbl(v).split(" ")[0]}</div>
      </div>`;
    }).join("")}
  </div>`;
}

window.loadFng = loadFng;
})();
