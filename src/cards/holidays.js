/* global $, document, window, loadWeather, skeletonGeneric, lsGet, lsSet, fetchJsonFirstOk, er, notifyNonCriticalError */
(() => {
/* ── Feriados ── */
function switchWxHol(tab,btn){
  document.querySelectorAll("#wxhol-tab-wx,#wxhol-tab-res,#wxhol-tab-hol")
    .forEach(b=>b.classList.remove("on"));
  btn.classList.add("on");
  document.getElementById("wxhol-wx").style.display=      tab==="wx"?"":"none";
  document.getElementById("wxhol-resumo").style.display=  tab==="resumo"?"":"none";
  document.getElementById("wxhol-feriados").style.display=tab==="feriados"?"":"none";
  /* Lazy load: só carrega a tab quando é aberta pela 1ª vez */
  if(tab==="resumo"&&!window._holLoaded){window._holLoaded=true;loadHolidays();}
  if(tab==="feriados"&&!window._holListLoaded){window._holListLoaded=true;renderHolList();}
}
function wxholRefresh(){
  const active=document.querySelector("#wxhol-tab-wx.on")?"wx":
                document.querySelector("#wxhol-tab-res.on")?"resumo":"feriados";
  if(active==="wx") return loadWeather(true);
  if(active==="resumo"){window._holLoaded=false;return loadHolidays(true);}
  // feriados: garantir fetch antes de render
  window._holListLoaded=false;
  return loadHolidays(true).then(()=>{ window._holListLoaded=true; renderHolList(); });
}

function renderHolList(){
  const el=document.getElementById("hol-list-body");
  if(!el) return;
  if(!window._holData){
    el.innerHTML='<div style="padding:12px;text-align:center;font-size:.72rem;color:var(--t3)">A carregar...</div>';
    loadHolidays().then(()=>{ window._holListLoaded=true; renderHolList(); });
    return;
  }
  const {allHols,ptDow,ptMon,ptDowFull,today,todayStr,next,bridges,year}=window._holData;
  const rows=allHols.map(h=>{
    const hd=new Date(h.date+"T00:00:00");
    const isPast=h.date<todayStr;
    const isNext=h.date===next?.date&&h.type==="nacional";
    const dow=ptDow[hd.getDay()];
    const dowFull=ptDowFull[hd.getDay()];
    const isBridge=bridges.some(b=>b.holDate===h.date);
    const isMunic=h.type==="municipal";
    return `<div style="display:flex;align-items:center;gap:8px;padding:5px 6px;
          border-radius:6px;margin-bottom:2px;
          ${isNext?"background:var(--accent)18;border:1px solid var(--accent)44;":
            isPast?"opacity:.4;":"border:1px solid transparent;"}">
      <div style="min-width:38px;text-align:right">
        <div style="font-size:.7rem;font-weight:${isPast?400:600};
             color:${isPast?"var(--t3)":isNext?"var(--accent)":"var(--text)"};
             ${isPast?"text-decoration:line-through;":""}">${hd.getDate()} ${ptMon[hd.getMonth()]}</div>
      </div>
      <div style="min-width:28px;background:${hd.getDay()===0||hd.getDay()===6?"#EF444422":"var(--b2)"};
           border-radius:4px;padding:1px 4px;text-align:center">
        <span style="font-size:.58rem;color:${hd.getDay()===0||hd.getDay()===6?"#EF4444":"var(--t2)"}">${dow}</span>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.68rem;font-weight:${isNext?700:isPast?400:500};
             color:${isPast?"var(--t3)":isNext?"var(--accent)":"var(--text)"};
             white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
             ${isPast?"text-decoration:line-through;":""}">
          ${isMunic?`<span style="font-size:.55rem;background:#8B5CF622;color:#8B5CF6;
            border-radius:3px;padding:1px 3px;margin-right:3px">${h.flag}${h.city}</span>`:""}
          ${h.localName}
          ${isBridge&&!isPast?`<span style="font-size:.55rem;background:#F59E0B22;
            color:#F59E0B;border-radius:3px;padding:1px 4px;margin-left:3px">🌉 ponte</span>`:""}
        </div>
        <div style="font-size:.57rem;color:var(--t3)">${dowFull}</div>
      </div>
      ${!isPast?`<span style="font-size:.6rem;color:var(--t3);white-space:nowrap">
        +${Math.round((hd-today)/864e5)}d</span>`
      :`<span style="font-size:.6rem;color:var(--t3)">✓</span>`}
    </div>`;
  }).join("");
  el.innerHTML=`
    <div style="font-size:.65rem;font-weight:700;color:var(--t2);margin-bottom:6px">
      📋 Feriados · ${year}
    </div>
    <div>${rows}</div>`;
}

function switchHolTab(tab,btn){
  document.querySelectorAll("#hol-tab-res,#hol-tab-hol").forEach(b=>b.classList.remove("on"));
  if(btn)btn.classList.add("on");
  const resumo=document.getElementById("hol-resumo");
  const feriados=document.getElementById("hol-feriados");
  if(resumo)resumo.style.display=tab==="resumo"?"":"none";
  if(feriados)feriados.style.display=tab==="feriados"?"":"none";
}

async function loadHolidays(force=false){
  $("hol-body").innerHTML=skeletonGeneric(5);
  try{
    const year=new Date().getFullYear(), ck=`hols_${year}`;
    let hols=force?null:lsGet(ck);
    try {
      const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/PT`;
      hols = await fetchJsonFirstOk(url, {}, 10000);
      if (hols) lsSet(ck, hols);
    } catch(e) {
      console.warn("⚠️ Holidays API falhou:", e.message);
    }

    const today=new Date(); today.setHours(0,0,0,0);
    const todayStr=today.toISOString().slice(0,10);

    /* Feriados municipais fixos */
    /* Feriados municipais — fontes: CM respectivas */
    const MUNIC=[
      {date:`${year}-06-13`,name:"S. António",          city:"Lisboa",  flag:"🏛️"},
      {date:`${year}-06-24`,name:"S. João",             city:"Porto",   flag:"🎆"},
      {date:`${year}-06-24`,name:"S. João",             city:"Braga",   flag:"⛪"},
      {date:`${year}-06-29`,name:"Dia da Cidade",       city:"Évora",   flag:"🏛️"},
      {date:`${year}-08-22`,name:"Feriado Municipal",   city:"Braga",   flag:"⛪"},
      {date:`${year}-09-04`,name:"Feira de S. Mateus",  city:"Viseu",   flag:"🎪"},
      {date:`${year}-09-07`,name:"Feriado Municipal",   city:"Aveiro",  flag:"🌊"},
      {date:`${year}-11-27`,name:"Feriado Municipal",   city:"Coimbra", flag:"🎓"},
      {date:`${year}-07-22`,name:"Dia da Cidade",       city:"Setúbal", flag:"⚓"},
      {date:`${year}-08-01`,name:"Feriado Municipal",   city:"Faro",    flag:"🌊"},
    ];

    /* Juntar feriados nacionais + municipais */
    const ptDow=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
    const ptMon=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
    const ptMonFull=["janeiro","fevereiro","março","abril","maio","junho",
                     "julho","agosto","setembro","outubro","novembro","dezembro"];
    const ptDowFull=["Domingo","Segunda-feira","Terça-feira","Quarta-feira",
                     "Quinta-feira","Sexta-feira","Sábado"];

    /* Construir set de todos os feriados nacionais para cálculos */
    const holSet=new Set(hols.map(h=>h.date));
    /* Adicionar municipais ao set para dias úteis */
    /* (não interferem nos dias úteis gerais — apenas locais) */

    /* ── Dias úteis ──────────────────────────────────────── */
    function isWorkday(d){
      const dow=d.getDay();
      if(dow===0||dow===6) return false;
      return !holSet.has(d.toISOString().slice(0,10));
    }

    /* Dias úteis restantes no mês actual */
    const firstOfMonth=new Date(today.getFullYear(),today.getMonth(),1);
    const lastOfMonth=new Date(today.getFullYear(),today.getMonth()+1,0);
    let wdMonth=0, wdMonthLeft=0;
    for(let d=new Date(firstOfMonth);d<=lastOfMonth;d.setDate(d.getDate()+1)){
      if(isWorkday(d)){
        wdMonth++;
        if(d>=today) wdMonthLeft++;
      }
    }

    /* Dias úteis restantes no ano */
    const lastOfYear=new Date(year,11,31);
    let wdYearLeft=0;
    for(let d=new Date(today);d<=lastOfYear;d.setDate(d.getDate()+1)){
      if(isWorkday(d)) wdYearLeft++;
    }

    /* Dias úteis desta semana e próxima */
    function weekWorkdays(refDate){
      const dow=refDate.getDay();
      const mon=new Date(refDate); mon.setDate(refDate.getDate()-(dow===0?6:dow-1));
      let count=0;
      for(let i=0;i<5;i++){
        const d=new Date(mon); d.setDate(mon.getDate()+i);
        if(isWorkday(d)&&d>=today) count++;
      }
      return count;
    }
    function weekWorkdaysTotal(refDate){
      const dow=refDate.getDay();
      const mon=new Date(refDate); mon.setDate(refDate.getDate()-(dow===0?6:dow-1));
      let count=0;
      for(let i=0;i<5;i++){
        const d=new Date(mon); d.setDate(mon.getDate()+i);
        if(isWorkday(d)) count++;
      }
      return count;
    }
    const nextWeek=new Date(today); nextWeek.setDate(today.getDate()+7);
    const wdThisWeek=weekWorkdays(today);
    const wdNextWeek=weekWorkdaysTotal(nextWeek);

    /* ── Próximo feriado ──────────────────────────────────── */
    const upcoming=hols.filter(h=>h.date>=todayStr).sort((a,b)=>a.date.localeCompare(b.date));
    const next=upcoming[0];
    let daysToNext=0;
    if(next){
      const nd=new Date(next.date+"T00:00:00");
      daysToNext=Math.round((nd-today)/(1000*60*60*24));
    }

    /* ── Detectar pontes ─────────────────────────────────── */
    const bridges=[];
    hols.forEach(h=>{
      const hd=new Date(h.date+"T00:00:00");
      const dow=hd.getDay();
      /* Feriado 5ª → 6ª é ponte */
      if(dow===4){
        const fri=new Date(hd); fri.setDate(hd.getDate()+1);
        const friStr=fri.toISOString().slice(0,10);
        if(friStr>=todayStr)
          bridges.push({hol:h.localName,holDate:h.date,
            bridge:"Sexta-feira",bridgeDate:friStr,type:"th-fr"});
      }
      /* Feriado 3ª → 2ª é ponte */
      if(dow===2){
        const mon=new Date(hd); mon.setDate(hd.getDate()-1);
        const monStr=mon.toISOString().slice(0,10);
        if(monStr>=todayStr)
          bridges.push({hol:h.localName,holDate:h.date,
            bridge:"Segunda-feira",bridgeDate:monStr,type:"tu-mo"});
      }
    });

    /* ── Dias úteis por mês (restantes do ano) ───────────── */
    const monthStats=[];
    for(let m=today.getMonth();m<12;m++){
      const first=new Date(year,m,1);
      const last=new Date(year,m+1,0);
      let total=0, left=0, holCount=0;
      for(let d=new Date(first);d<=last;d.setDate(d.getDate()+1)){
        const ds=d.toISOString().slice(0,10);
        if(isWorkday(d)){ total++; if(d>=today) left++; }
        if(holSet.has(ds)&&d.getDay()!==0&&d.getDay()!==6) holCount++;
      }
      monthStats.push({m,name:ptMon[m],total,left,holCount,
        isCurrent:m===today.getMonth()});
    }
    const maxWd=Math.max(...monthStats.map(x=>x.total));

    /* ── Feriados nacionais com estado past/future ──────── */
    const allHols=[
      ...hols.map(h=>({...h,type:"nacional"})),
      ...MUNIC.map(h=>({date:h.date,localName:h.name,
        name:h.name,type:"municipal",city:h.city,flag:h.flag}))
    ].sort((a,b)=>a.date.localeCompare(b.date));
    /* Guardar para renderHolList */
    window._holData={allHols,ptDow,ptMon,ptDowFull,ptMonFull,today,todayStr,next,bridges,year};


    /* ── Render ─────────────────────────────────────────── */
    $("hol-body").innerHTML=`
    <!-- Tabs -->
    <div style="display:flex;gap:4px;margin-bottom:8px">
      <button class="rbtn on" id="hol-tab-res" onclick="switchHolTab('resumo',this)">Resumo</button>
      <button class="rbtn"    id="hol-tab-hol" onclick="switchHolTab('feriados',this)">Feriados ${year}</button>
    </div>
    <!-- Tab Resumo -->
    <div id="hol-resumo">


    <!-- KPI: próximo feriado -->
    ${next?`<div style="background:var(--b2);border-radius:10px;padding:10px 14px;
         margin-bottom:10px;display:flex;align-items:center;gap:12px">
      <div style="font-size:2.4rem;font-weight:900;color:var(--accent);
           line-height:1;min-width:44px;text-align:center">${daysToNext}</div>
      <div>
        <div style="font-size:.78rem;color:var(--t3)">dias para o próximo feriado</div>
        <div style="font-size:.92rem;font-weight:700;color:var(--text);margin-top:1px">
          ${next.localName}</div>
        <div style="font-size:.65rem;color:var(--t3);margin-top:1px">
          ${ptDowFull[new Date(next.date+"T00:00:00").getDay()]} · 
          ${new Date(next.date+"T00:00:00").getDate()} de 
          ${ptMonFull[new Date(next.date+"T00:00:00").getMonth()]}
        </div>
      </div>
    </div>`:""}

    <!-- KPIs: dias úteis -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:10px">
      ${[
        {lbl:"Dias úteis<br>este mês",    v:wdMonthLeft, sub:`de ${wdMonth} totais`, col:"#10B981"},
        {lbl:"Dias úteis<br>este ano",    v:wdYearLeft,  sub:"restantes",            col:"#3B82F6"},
        {lbl:"Esta semana",               v:wdThisWeek,  sub:"dias úteis restam",    col:"#F59E0B"},
        {lbl:"Próxima semana",            v:wdNextWeek,  sub:"dias úteis",           col:"#8B5CF6"},
      ].map(k=>`<div style="background:var(--b2);border-radius:7px;padding:7px 8px;text-align:center">
        <div style="font-size:1.35rem;font-weight:900;color:${k.col};line-height:1">${k.v}</div>
        <div style="font-size:.55rem;color:var(--t3);line-height:1.3;margin-top:2px">${k.lbl}</div>
        <div style="font-size:.52rem;color:var(--t3);margin-top:1px">${k.sub}</div>
      </div>`).join("")}
    </div>

    <!-- Pontes detectadas -->
    ${bridges.length?`
    <div style="margin-bottom:8px">
      <div style="font-size:.65rem;font-weight:700;color:#F59E0B;margin-bottom:4px">
        🌉 Pontes detectadas
      </div>
      ${bridges.map(b=>`
        <div style="background:#F59E0B12;border:1px solid #F59E0B33;border-radius:7px;
             padding:6px 10px;margin-bottom:4px;display:flex;align-items:center;gap:8px">
          <span style="font-size:1rem">🌉</span>
          <div>
            <div style="font-size:.65rem;font-weight:700;color:#F59E0B">
              ${b.bridge} ${b.bridgeDate.slice(8)}/
              ${b.bridgeDate.slice(5,7)} é ponte
            </div>
            <div style="font-size:.6rem;color:var(--t2)">
              Feriado ${b.hol} (${b.holDate.slice(8)}/${b.holDate.slice(5,7)}) 
              cria fim-de-semana longo de 4 dias
            </div>
          </div>
        </div>`).join("")}
    </div>`:""}

    <!-- Dias úteis por mês -->
    <div style="margin-bottom:10px">
      <div style="font-size:.65rem;font-weight:700;color:var(--t2);margin-bottom:5px">
        📊 Dias úteis por mês
      </div>
      <div style="display:grid;grid-template-columns:repeat(${monthStats.length},1fr);
           gap:3px;align-items:end;height:44px">
        ${monthStats.map(ms=>{
          const barH=Math.round((ms.left/maxWd)*38)+2;
          const col=ms.isCurrent?"var(--accent)":ms.holCount>1?"#F59E0B":"#3B82F6";
          return `<div style="display:flex;flex-direction:column;align-items:center;gap:1px">
            <div title="${ms.name}: ${ms.left} úteis (${ms.holCount} feriado${ms.holCount!==1?'s':''})"
                 style="width:100%;height:${barH}px;background:${col};border-radius:2px 2px 0 0;
                 opacity:${ms.isCurrent?1:0.7};cursor:default"></div>
            <div style="font-size:.5rem;color:${ms.isCurrent?"var(--accent)":"var(--t3)"};
                 font-weight:${ms.isCurrent?700:400}">${ms.name}</div>
          </div>`;
        }).join("")}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:.57rem;
           color:var(--t3);margin-top:3px">
        <span>Barra destaca meses c/ ≥2 feriados <span style="color:#F59E0B">●</span></span>
        <span>Mês actual <span style="color:var(--accent)">●</span></span>
      </div>
    </div>


    </div>
    <!-- Tab Feriados -->
    <div id="hol-feriados" style="display:none">

    <!-- Botão para ver feriados completos -->
    <div style="margin-top:6px">
      <button class="rbtn" style="width:100%;justify-content:center"
        onclick="switchWxHol('feriados',document.getElementById('wxhol-tab-hol'))">
        🗓 Ver lista completa de feriados →
      </button>
    </div>

  </div>
`;

  }catch(e){
    $("hol-body").innerHTML=er(e,{context:"Feriados",action:"volte a carregar ou mude de cidade"});
    notifyNonCriticalError("Feriados",e,"volte a carregar ou mude de cidade");
  }
}

  window.switchWxHol = switchWxHol;
  window.wxholRefresh = wxholRefresh;
  window.renderHolList = renderHolList;
  window.loadHolidays = loadHolidays;
  window.switchHolTab = switchHolTab;
})();
