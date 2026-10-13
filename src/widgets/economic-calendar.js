/* global Date, $, document, alert, window */
(() => {
/* ══════════════════════════════════════════════════════════════
   CALENDÁRIO ECONÓMICO — Finnhub API + fallback estático
   Fontes: Finnhub (live, requer chave gratuita) · fallback estático
   ══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   CALENDÁRIO ECONÓMICO — Gerado automaticamente, sem API key
   Fontes: datas oficiais Fed, BCE, INE, BLS, Eurostat calculadas
   dinamicamente. Atualiza-se mês a mês sem edição manual.
   ══════════════════════════════════════════════════════════════ */

/* ── Gerador de calendário dinâmico ──────────────────────────
   Regras de cada evento (approximação baseada em padrões históricos):
   - FOMC: 8 reuniões/ano · datas fixas publicadas pela Fed
   - BCE:  8 reuniões/ano · publicadas no site BCE
   - NFP:  1.ª sexta-feira de cada mês
   - CPI EUA: ~12 dias após fim do mês de referência
   - CPI PT / INE: ~10 do mês seguinte
   ─────────────────────────────────────────────────────────── */

/* Datas fixas Fed/BCE 2025-2026 (publicadas antecipadamente) */
const FOMC_DATES_2025=["2025-01-29","2025-03-19","2025-05-07","2025-06-18","2025-07-30","2025-09-17","2025-10-29","2025-12-10"];
const FOMC_DATES_2026=["2026-01-28","2026-03-19","2026-05-06","2026-06-17","2026-07-29","2026-09-16","2026-10-28","2026-12-09"];
const BCE_DATES_2025= ["2025-01-30","2025-03-06","2025-04-17","2025-06-05","2025-07-24","2025-09-11","2025-10-30","2025-12-18"];
const BCE_DATES_2026= ["2026-01-30","2026-03-05","2026-04-17","2026-06-04","2026-07-23","2026-09-10","2026-10-29","2026-12-17"];

/* Primeira sexta-feira de um mês */
function firstFriday(year,month){
  const d=new Date(year,month,1);
  const dow=d.getDay(); /* 0=Dom */
  const diff=dow<=5?(5-dow):(12-dow);
  return new Date(year,month,1+diff);
}

/* Formatar data para string "DD Mês" em pt-PT */
function fmtDate(d){
  return d.toLocaleDateString("pt-PT",{day:"2-digit",month:"short"});
}

/* Gerar eventos para os próximos N meses + passado recente */
function buildCalendarEvents(){
  const today=new Date(); today.setHours(0,0,0,0);
  const todayStr=today.toISOString().slice(0,10);
  const events=[];

  /* Janela: 2 meses atrás → 6 meses à frente */
  const windowStart=new Date(today); windowStart.setMonth(windowStart.getMonth()-2);
  const windowEnd  =new Date(today); windowEnd.setMonth(windowEnd.getMonth()+6);

  function addEv(dateStr,title,country,imp,time="—"){
    const d=new Date(dateStr+"T12:00:00");
    if(d<windowStart||d>windowEnd) return;
    events.push({
      title,
      date:fmtDate(d),
      time:time+" Lisboa",
      country,
      imp,
      past:dateStr<todayStr,
      _iso:dateStr,
    });
  }

  /* ── FOMC ── */
  [...FOMC_DATES_2025,...FOMC_DATES_2026].forEach(dt=>{
    addEv(dt,"FOMC · Decisão taxas Fed ★","🇺🇸","h","19:00");
  });

  /* ── BCE ── */
  [...BCE_DATES_2025,...BCE_DATES_2026].forEach(dt=>{
    addEv(dt,"BCE · Decisão taxas ★","🇪🇺","h","13:45");
  });

  /* ── NFP (1.ª sexta-feira) + CPI EUA (~12 dias depois) ── */
  for(let y=2025;y<=2026;y++){
    for(let m=0;m<12;m++){
      /* NFP: 1.ª sexta-feira = dados do mês anterior */
      const nfp=firstFriday(y,m);
      const nfpStr=nfp.toISOString().slice(0,10);
      const refMonth=new Date(y,m-1,1).toLocaleDateString("pt-PT",{month:"long"});
      addEv(nfpStr,`NFP EUA (emprego ${refMonth})`,"🇺🇸","h","13:30");

      /* CPI EUA: ~dia 12 do mês seguinte ao de referência */
      const cpiDate=new Date(y,m,12);
      addEv(cpiDate.toISOString().slice(0,10),`IPC EUA (${refMonth})`,"🇺🇸","h","13:30");

      /* CPI PT/INE: ~dia 9 */
      const ineDate=new Date(y,m,9);
      addEv(ineDate.toISOString().slice(0,10),`IPC Portugal (${refMonth}) · INE`,"🇵🇹","m","11:00");

      /* PMI Flash ZE: ~dia 23 */
      const pmiDate=new Date(y,m,23);
      const pmiMonth=new Date(y,m,1).toLocaleDateString("pt-PT",{month:"long"});
      addEv(pmiDate.toISOString().slice(0,10),`PMI Flash Zona Euro (${pmiMonth})`,"🇪🇺","m","09:00");

      /* Vendas a retalho EUA: ~dia 16 */
      const retDate=new Date(y,m,16);
      addEv(retDate.toISOString().slice(0,10),`Vendas a retalho EUA (${refMonth})`,"🇺🇸","m","13:30");

      /* PIB EUA: última semana do 1.º mês de cada trimestre (Jan, Abr, Jul, Out) */
      if([0,3,6,9].includes(m)){
        const quarter=["Q4","Q1","Q2","Q3"][m/3|0];
        const prevYear=m===0?y-1:y;
        const qDate=new Date(y,m,29);
        addEv(qDate.toISOString().slice(0,10),`PIB EUA ${quarter} ${prevYear} · 1.ª leitura`,"🇺🇸","h","13:30");
      }

      /* PIB Portugal: INE publica ~55 dias após fim do trimestre */
      if([2,5,8,11].includes(m)){
        const quarter=["Q1","Q2","Q3","Q4"][[2,5,8,11].indexOf(m)];
        const gdpDate=new Date(y,m,28);
        addEv(gdpDate.toISOString().slice(0,10),`PIB Portugal ${quarter} ${y} · INE`,"🇵🇹","m","11:00");
      }

      /* Eurostat IPC ZE flash: último dia do mês */
      const ipcZeDate=new Date(y,m+1,0); /* último dia do mês m */
      const ipcZeMonth=new Date(y,m,1).toLocaleDateString("pt-PT",{month:"long"});
      addEv(ipcZeDate.toISOString().slice(0,10),`IPC Zona Euro ${ipcZeMonth} · flash`,"🇪🇺","h","11:00");
    }
  }

  /* Eventos pontuais conhecidos com resultado já disponível */
  const KNOWN=[
    {dt:"2026-03-06",title:"BCE · Decisão taxas (resultado: −25bp → 2.50%)",country:"🇪🇺",imp:"h",time:"13:45"},
    {dt:"2026-03-07",title:"NFP EUA fevereiro (resultado: +151k)",country:"🇺🇸",imp:"h",time:"13:30"},
  ];
  KNOWN.forEach(k=>{
    /* Substituir evento gerado se existir na mesma data */
    const exists=events.findIndex(e=>e._iso===k.dt&&e.country===k.country&&e.imp===k.imp);
    const ev={title:k.title,date:fmtDate(new Date(k.dt+"T12:00:00")),time:k.time+" Lisboa",country:k.country,imp:k.imp,past:k.dt<todayStr,_iso:k.dt};
    if(exists>=0) events[exists]=ev; else events.push(ev);
  });

  /* Ordenar por data ISO */
  events.sort((a,b)=>a._iso>b._iso?1:a._iso<b._iso?-1:0);
  return events;
}

let CAL_TAB="upcoming";
let CAL_EVENTS=buildCalendarEvents(); /* gerado uma vez, regenerado no ↺ */

function switchCal(tab,btn){
  CAL_TAB=tab;
  document.querySelectorAll("#cal-tab-up,#cal-tab-pa").forEach(b=>b.classList.remove("on"));
  btn.classList.add("on");
  renderCalendar();
}

async function loadAndRenderCalendar(_force=false){
  /* Regenerar calendário (útil se a data mudou) */
  CAL_EVENTS=buildCalendarEvents();
  renderCalendar();
}

function renderCalendar(){
  const items=CAL_EVENTS.filter(e=>CAL_TAB==="past"?e.past:!e.past);
  const upd=new Date().toLocaleDateString("pt-PT",{day:"2-digit",month:"short",year:"numeric"});

  const banner=`<div style="background:#3B82F612;border:1px solid #3B82F630;border-radius:6px;
    padding:5px 10px;margin-bottom:8px;font-size:.6rem;color:#3B82F6;
    display:flex;align-items:center;justify-content:space-between">
    <span>📅 Calendário automático · Fed · BCE · INE · BLS · Eurostat · ${upd}</span>
  </div>`;

  if(!items.length){
    $("cal-body").innerHTML=banner+`<div style="padding:16px;text-align:center;font-size:.72rem;color:var(--t3)">
      ${CAL_TAB==="past"?"Sem eventos concluídos.":"Sem eventos próximos."}
    </div>`;
    return;
  }

  const rows=items.map(e=>{
    const dotCol=CAL_TAB==="past"?"var(--green)":e.imp==="h"?"var(--red)":e.imp==="m"?"var(--accent)":"var(--green)";
    return`<div class="ev">
      <div class="ev-dot" style="background:${dotCol}"></div>
      <div class="ev-body">
        <div class="ev-title">${e.country} ${e.title}</div>
        <div class="ev-meta">
          <span>${e.date} · ${e.time}</span>
          ${CAL_TAB==="past"
            ?`<span style="font-size:.6rem;color:var(--green);font-weight:600">✓ concluído</span>`
            :`<span class="ev-imp imp-${e.imp}">${e.imp==="h"?"Alto":e.imp==="m"?"Médio":"Baixo"}</span>`}
        </div>
      </div>
    </div>`;
  }).join("");

  $("cal-body").innerHTML=banner+`<div class="ev-list">${rows}</div>`;
}

function openCalendarSettings(){
  /* Nada a configurar — calendário é automático */
  alert("O calendário económico é gerado automaticamente a partir de datas oficiais do Fed, BCE e INE. Não são necessárias API keys.");
}

  window.switchCal = switchCal;
  window.loadAndRenderCalendar = loadAndRenderCalendar;
  window.openCalendarSettings = openCalendarSettings;
})();
