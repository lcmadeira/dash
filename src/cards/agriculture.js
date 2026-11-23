/* global $, AbortSignal, fetchFirstOk, fetchJsonFirstOk, fetchTextFirstOk, ld, lsGet, lsSet, window */
(() => {
/* ══════════════════════════════════════════════════════════════
   PREÇOS AGRÍCOLAS — Yahoo Finance com fallback Stooq
   ══════════════════════════════════════════════════════════════ */
const AGRI_SYMS=[
  {sym:"ZW=F",  label:"Trigo",   unit:"¢/bu", ico:"🌾"},
  {sym:"ZC=F",  label:"Milho",   unit:"¢/bu", ico:"🌽"},
  {sym:"ZS=F",  label:"Soja",    unit:"¢/bu", ico:"🫘"},
  {sym:"KC=F",  label:"Café",    unit:"¢/lb", ico:"☕"},
  {sym:"SB=F",  label:"Açúcar",  unit:"¢/lb", ico:"🍬"},
  {sym:"CT=F",  label:"Algodão", unit:"¢/lb", ico:"🤍"},
];
async function loadAgri(force=false){
  const el=$("agri-body"); if(!el)return;
  el.innerHTML=`<div style="grid-column:1/-1">${ld()}</div>`;
  const ck="agri_v3";
  let cache=force?null:lsGet(ck);

  /* 1. Gateway próprio: as 6 cotações Yahoo lidas no servidor, com cópia de reserva de 7 dias. */
  if(!cache||!cache.length){
    const gatewayUrl=window.dataApiUrl?.("v1/agri");
    if(gatewayUrl){
      try{
        const j=await fetchJsonFirstOk(gatewayUrl,{},12000,["direct"],d=>Array.isArray(d?.quotes)&&d.quotes.length===AGRI_SYMS.length);
        const bySym=new Map(j.quotes.map(q=>[q.symbol,q]));
        const fromGateway=AGRI_SYMS.map(({sym})=>{
          const q=bySym.get(sym);
          if(!Number.isFinite(q?.price)) return {close:null,chg:null,hi:null,lo:null,vol:null};
          return {close:q.price,chg:q.prev?((q.price-q.prev)/q.prev*100):null,hi:q.hi??q.price,lo:q.lo??q.price,vol:q.volume??null};
        });
        if(fromGateway.filter(x=>x.close).length>=4){
          cache=fromGateway;
          lsSet(ck,cache,{source:j._meta?.source||"Yahoo Finance (gateway)",state:j._meta?.state==="stale"?"stale":"live",observedAt:j._meta?.observedAt});
        }
      }catch{ /* segue para os proxies públicos */ }
    }
  }

  /* 2. Alternativa antiga: Yahoo e Stooq via proxies públicos */
  if(!cache||!cache.length){
    async function fetchSym(sym){
      const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=5d&interval=1d`;
      try{
        const {r}=await fetchFirstOk(url,{signal:AbortSignal.timeout(8000)},8000,["allorigins","corsproxy"],async response=>{
          try{return Boolean((await response.clone().json())?.chart?.result?.[0]?.meta?.regularMarketPrice);}catch{return false;}
        });
        const j=await r.json();
        const meta=j?.chart?.result?.[0]?.meta;
        const price=meta.regularMarketPrice;
        const prev=meta.previousClose||meta.chartPreviousClose||price;
        const hi=meta.regularMarketDayHigh||price;
        const lo=meta.regularMarketDayLow||price;
        const vol=meta.regularMarketVolume||0;
        return {close:price,chg:prev?((price-prev)/prev*100):null,hi,lo,vol};
      }catch{}

      /* Fallback Stooq CSV */
      const STOOQ={"ZW=F":"zw.f","ZC=F":"zc.f","ZS=F":"zs.f","KC=F":"kc.f","SB=F":"sb.f","CT=F":"ct.f"};
      const ssym=STOOQ[sym];
      if(ssym){
        try{
          const url=`https://stooq.com/q/l/?s=${ssym}&f=sd2t2ohlcv&h&e=csv`;
          const csv=await fetchTextFirstOk(url,{signal:AbortSignal.timeout(8000)},8000,["allorigins","corsproxy"],text=>text.includes("Symbol,Date,Time")&&!text.includes("<!DOCTYPE html>"));
          const rows=csv.trim().split("\n");
          if(rows.length>=2){
            const cols=rows[1].split(",");
            const close=parseFloat(cols[6]);
            const open=parseFloat(cols[3]);
            const hi=parseFloat(cols[4]);
            const lo=parseFloat(cols[5]);
            const vol=parseFloat(cols[7])||0;
            if(!Number.isNaN(close)&&close>0)
              return {close,chg:open?((close-open)/open*100):null,hi,lo,vol};
          }
        }catch{}
      }
      return {close:null,chg:null,hi:null,lo:null,vol:null};
    }

    const results=await Promise.allSettled(AGRI_SYMS.map(s=>fetchSym(s.sym)));
    cache=AGRI_SYMS.map((_,i)=>results[i].status==="fulfilled"?results[i].value:{close:null,chg:null});

    /* Se nenhum dado live → usar estáticos */
    if(!cache.some(x=>x.close)){
      cache=[{"close": 530.0, "chg": -0.8, "hi": 538, "lo": 525, "unit": "\u00a2/bu"}, {"close": 471.0, "chg": 0.4, "hi": 475, "lo": 468, "unit": "\u00a2/bu"}, {"close": 1022.0, "chg": -0.3, "hi": 1030, "lo": 1018, "unit": "\u00a2/bu"}, {"close": 328.0, "chg": 1.2, "hi": 335, "lo": 322, "unit": "\u00a2/lb"}, {"close": 19.2, "chg": -0.5, "hi": 19.5, "lo": 19.0, "unit": "\u00a2/lb"}, {"close": 67.4, "chg": 0.2, "hi": 68.0, "lo": 66.9, "unit": "\u00a2/lb"}];
      /* NÃO guardar em cache para tentar de novo no próximo refresh */
    } else {
      lsSet(ck,cache);
    }
  }

  const isStatic=!cache.some(x=>x.vol!==null&&x.vol!==undefined&&x.vol>0);

  el.innerHTML=AGRI_SYMS.map((s,i)=>{
    const q=cache[i]||{};
    const price=q.close;
    const chg=q.chg;
    const hi=q.hi, lo=q.lo;
    const hasChange=chg!==null&&chg!==undefined;
    const col=!hasChange?"var(--t2)":chg>=0?"#10B981":"#EF4444";
    const bgCol=!hasChange?"var(--b2)":chg>=0?"#10B98110":"#EF444410";
    const arr=!hasChange?"":chg>=0?"▲":"▼";
    const fmt=v=>v!==null&&v!==undefined?window.nf(v,v>100?1:2):"—";
    return `<div style="background:${bgCol};border-radius:8px;padding:10px 12px;
                 border:1px solid ${!hasChange?"var(--b)":chg>=0?"#10B98130":"#EF444430"};
                 display:flex;flex-direction:column;gap:2px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:1.3rem">${s.ico}</span>
        <span style="font-size:.74rem;color:var(--t3);background:var(--b2);
              border-radius:3px;padding:1px 5px">${s.unit}</span>
      </div>
      <div style="font-size:.74rem;color:var(--t2);font-weight:700;
           text-transform:uppercase;letter-spacing:.3px;margin-top:1px">${s.label}</div>
      <div style="font-size:1.35rem;font-weight:800;color:var(--text);
           line-height:1;letter-spacing:-.5px">${fmt(price)}</div>
      <div style="font-size:.74rem;font-weight:700;color:${col}">
        ${hasChange?`${arr} ${window.nf(Math.abs(chg), 2)}%`:"—"}
      </div>
      ${hi!==null&&hi!==undefined?`<div style="display:flex;justify-content:space-between;margin-top:3px;
           font-size:.74rem;color:var(--t3)">
        <span>H <b style="color:var(--t3)">${fmt(hi)}</b></span>
        <span>L <b style="color:var(--t3)">${fmt(lo)}</b></span>
      </div>`:""}</div>`;
  }).join("");
  if(isStatic){
    el.innerHTML+=`<div style="grid-column:1/-1;font-size:.74rem;color:var(--amber);padding:2px 0">
      ⚠ Yahoo Finance / Stooq indisponíveis · valores referência Mar 2026</div>`;
  }
}

window.loadAgri = loadAgri;
})();
