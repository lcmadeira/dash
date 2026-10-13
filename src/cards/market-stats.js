/* global $, skeletonKPIs, lsGet, lsSet, fetchStooqMulti, window */
(() => {
/* ── loadMarketStats — fontes abertas, sem API key ──
   Fontes:
   • Stooq CSV (via allorigins) — VIX, Ouro, Prata, S&P500, WTI, Gás Nat.
   • Frankfurter BCE           — USD/EUR (reutiliza cache do loadFX)
   • CoinGecko                 — BTC/EUR (reutiliza cache do loadCrypto)
   ─────────────────────────────────────────────────────────────────────── */
async function loadMarketStats(force=false){
  const el=$("mstats-body");
  if(!el) return;
  el.innerHTML=skeletonKPIs(6);

  const CK="mstats_v3";
  let cache=force?null:lsGet(CK);

  if(!cache){
    /* ── Símbolos Stooq (CSV via allorigins, sem chave, mesmo método do PSI20/Agri) ── */
    const STOOQ_SYMS=[
      {sym:"^vix", label:"VIX",       sub:"Volatilidade S&P 500", col:"var(--red)",    unit:"",  dec:2},
      {sym:"gc.f", label:"Ouro",      sub:"USD / oz · COMEX",     col:"var(--accent)", unit:"$", dec:2},
      {sym:"si.f", label:"Prata",     sub:"USD / oz · COMEX",     col:"#C0C0C0",       unit:"$", dec:3},
      {sym:"^spx", label:"S&P 500",   sub:"Índice americano",     col:"var(--blue)",   unit:"",  dec:2},
      {sym:"cl.f", label:"Petróleo",  sub:"USD / barril · WTI",   col:"var(--orange)", unit:"$", dec:2},
      {sym:"ng.f", label:"Gás Nat.",  sub:"USD / MMBtu · NYMEX",  col:"#3B82F6",       unit:"$", dec:3},
    ];

    /* Batch Stooq: Reduz significativamente o número de pedidos a proxies */
    const stooqResults = await fetchStooqMulti(STOOQ_SYMS.map(s => s.sym));

    let usdEur=null;
    const fxCache=lsGet("fx");
    if(fxCache?.rates?.USD) usdEur=(1/fxCache.rates.USD);

    let btcEur=null;
    const cgCache=lsGet("cg");
    if(cgCache?.bitcoin?.eur) btcEur=cgCache.bitcoin.eur;

    cache={
      items: STOOQ_SYMS.map((s)=>{
        const v=stooqResults[s.sym.toLowerCase()];
        return {...s,data:v||null};
      }),
      usdEur,btcEur,ts:Date.now()
    };

    const hasLive=cache.items.some(x=>x.data?.live);
    if(hasLive) lsSet(CK,cache);
  }

  /* ── Render ── */
  const liveCount=cache.items.filter(x=>x.data?.live).length;
  const liveTag=liveCount>0
    ?`<span style="font-size:.5rem;color:#10B981;background:#10B98115;border-radius:3px;padding:1px 5px">\u25CF Stooq ${liveCount}/6</span>`
    :`<span style="font-size:.5rem;color:#F59E0B;background:#F59E0B15;border-radius:3px;padding:1px 5px">\u26A0 sem dados live</span>`;

  function miniChg(chg){
    if(chg === null || chg === undefined) return `<span style="color:var(--t3);font-size:.58rem">\u2014</span>`;
    const col=chg>=0?"#10B981":"#EF4444";
    const arr=chg>=0?"\u25b2":"\u25bc";
    return `<span style="font-family:var(--mono);font-size:.62rem;font-weight:600;color:${col}">${arr} ${Math.abs(chg).toFixed(2)}%</span>`;
  }

  el.innerHTML=`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div style="font-size:.63rem;font-weight:700;color:var(--t2)">Mercados \u00b7 indicadores globais</div>
    ${liveTag}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:6px">
    ${cache.items.map(item=>{
      const d=item.data;
      const priceStr=d?(item.unit+(d.price>999?d.price.toLocaleString("pt-PT",{maximumFractionDigits:item.dec}):d.price.toFixed(item.dec))):"\u2014";
      return `<div style="background:var(--b2);border-radius:7px;padding:7px 9px;border-left:3px solid ${item.col}">
        <div style="font-size:.56rem;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">
          ${item.label} \u00b7 <span style="text-transform:none;font-weight:400">${item.sub}</span>
        </div>
        <div style="font-family:var(--mono);font-size:.98rem;font-weight:700;color:${item.col};line-height:1.1">${priceStr}</div>
        <div style="margin-top:3px">${miniChg(d?.chg)}</div>
        ${d?`<div style="font-family:var(--mono);font-size:.52rem;color:var(--t3);margin-top:2px">H ${d.hi.toFixed(item.dec)} \u00b7 L ${d.lo.toFixed(item.dec)}</div>`:""}
      </div>`;
    }).join("")}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
    <div style="background:var(--b2);border-radius:7px;padding:7px 9px;border-left:3px solid var(--green)">
      <div style="font-size:.56rem;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">USD/EUR \u00b7 BCE</div>
      <div style="font-family:var(--mono);font-size:.98rem;font-weight:700;color:var(--green)">${cache.usdEur?("\u20ac"+cache.usdEur.toFixed(4)):"\u2014"}</div>
      <div style="font-size:.52rem;color:var(--t3);margin-top:3px">Frankfurter API \u00b7 BCE oficial</div>
    </div>
    <div style="background:var(--b2);border-radius:7px;padding:7px 9px;border-left:3px solid var(--accent)">
      <div style="font-size:.56rem;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">BTC/EUR \u00b7 CoinGecko</div>
      <div style="font-family:var(--mono);font-size:.98rem;font-weight:700;color:var(--accent)">${cache.btcEur?("\u20ac"+cache.btcEur.toLocaleString("pt-PT",{maximumFractionDigits:0})):"\u2014"}</div>
      <div style="font-size:.52rem;color:var(--t3);margin-top:3px">CoinGecko API</div>
    </div>
  </div>
  <div style="font-size:.54rem;color:var(--t3);margin-top:6px">
    \u2756 Stooq.com \u00b7 Frankfurter/BCE \u00b7 CoinGecko \u00b7 Sem chave API \u00b7 Dados do \u00faltimo fecho
  </div>`;
}

window.loadMarketStats = loadMarketStats;
})();
