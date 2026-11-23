/* global $, skeletonKPIs, lsGet, lsSet, fetchStooqMulti, fetchFirstOk, window */
(() => {
/* ── loadMarketStats — fontes abertas, sem API key ──
   Fontes:
   • Gateway /v1/indicators (Yahoo) — VIX, Ouro, Prata, S&P500, WTI, Gás Nat.
     (o Yahoo não permite CORS; o Stooq deixou de responder e fica só como alternativa)
   • Frankfurter BCE           — USD/EUR (reutiliza cache do loadFX)
   • CoinGecko                 — BTC/EUR (reutiliza cache do loadCrypto)
   ─────────────────────────────────────────────────────────────────────── */
async function loadMarketStats(force=false){
  const el=$("mstats-body");
  if(!el) return;
  el.innerHTML=skeletonKPIs(6);

  const CK="mstats_v4";
  let cache=force?null:lsGet(CK);

  if(!cache){
    /* ── Símbolos Stooq (CSV via allorigins, sem chave, mesmo método do PSI20/Agri) ── */
    const STOOQ_SYMS=[
      {sym:"^vix", yf:"^VIX",  label:"VIX",       sub:"Volatilidade S&P 500", col:"var(--red)",    unit:"",  dec:2},
      {sym:"gc.f", yf:"GC=F",  label:"Ouro",      sub:"USD / oz · COMEX",     col:"var(--accent)", unit:"$", dec:2},
      {sym:"si.f", yf:"SI=F",  label:"Prata",     sub:"USD / oz · COMEX",     col:"#C0C0C0",       unit:"$", dec:3},
      {sym:"^spx", yf:"^GSPC", label:"S&P 500",   sub:"Índice americano",     col:"var(--blue)",   unit:"",  dec:2},
      {sym:"cl.f", yf:"CL=F",  label:"Petróleo",  sub:"USD / barril · WTI",   col:"var(--orange)", unit:"$", dec:2},
      {sym:"ng.f", yf:"NG=F",  label:"Gás Nat.",  sub:"USD / MMBtu · NYMEX",  col:"#3B82F6",       unit:"$", dec:3},
    ];

    /* Fonte principal: gateway (Yahoo). Stooq só para o que faltar. */
    const fromGateway = {};
    const gatewayUrl = window.dataApiUrl?.("v1/indicators");
    if (gatewayUrl) {
      try {
        const { r } = await fetchFirstOk(gatewayUrl, { headers: { Accept: "application/json" } }, 12000, ["direct"]);
        const j = r.ok ? await r.json() : null;
        for (const q of Array.isArray(j?.quotes) ? j.quotes : []) {
          const price = Number(q?.price), prev = Number(q?.prev);
          if (!(price > 0) || !(prev > 0)) continue;
          const hi = Number(q.hi) > 0 ? Number(q.hi) : price, lo = Number(q.lo) > 0 ? Number(q.lo) : price;
          fromGateway[String(q.symbol).toUpperCase()] = { price, prev, hi: Math.max(hi, lo), lo: Math.min(hi, lo),
            chg: (price - prev) / prev * 100, live: true, src: "yahoo" };
        }
      } catch { /* segue para o Stooq */ }
    }
    const missing = STOOQ_SYMS.filter(s => !fromGateway[s.yf]);
    const stooqResults = missing.length ? await fetchStooqMulti(missing.map(s => s.sym)) : {};

    let usdEur=null;
    const fxCache=lsGet("fx");
    if(fxCache?.rates?.USD) usdEur=(1/fxCache.rates.USD);

    let btcEur=null;
    const cgCache=lsGet("cg");
    if(cgCache?.bitcoin?.eur) btcEur=cgCache.bitcoin.eur;

    cache={
      items: STOOQ_SYMS.map((s)=>{
        const v=fromGateway[s.yf]||stooqResults[s.sym.toLowerCase()];
        return {...s,data:v||null};
      }),
      usdEur,btcEur,ts:Date.now()
    };

    const hasLive=cache.items.some(x=>x.data?.live);
    if(hasLive) lsSet(CK,cache);
  }

  /* ── Render ── */
  const liveCount=cache.items.filter(x=>x.data?.live).length;
  const liveSrc=cache.items.some(x=>x.data?.src==="yahoo")?"Yahoo":"Stooq";
  const liveTag=liveCount>0
    ?`<span style="font-size:.74rem;color:var(--green);background:#10B98115;border-radius:3px;padding:1px 5px">\u25CF ${liveSrc} ${window.nfr(liveCount)}/6</span>`
    :`<span style="font-size:.74rem;color:var(--amber);background:#F59E0B15;border-radius:3px;padding:1px 5px">\u26A0 sem dados live</span>`;

  /* Formato português com casas decimais fixas (vírgula decimal, agrupamento pt-PT). */
  const fmt=(v,dec)=>Number(v).toLocaleString("pt-PT",{minimumFractionDigits:dec,maximumFractionDigits:dec});

  function miniChg(chg){
    if(chg === null || chg === undefined) return `<span style="color:var(--t3);font-size:.74rem">\u2014</span>`;
    const col=chg>=0?"#10B981":"#EF4444";
    const arr=chg>=0?"\u25b2":"\u25bc";
    return `<span style="font-family:var(--mono);font-size:.74rem;font-weight:600;color:${col}">${window.nfr(arr)} ${fmt(Math.abs(chg),2)}%</span>`;
  }

  el.innerHTML=`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div style="font-size:.74rem;font-weight:700;color:var(--t2)">Mercados \u00b7 indicadores globais</div>
    ${window.nfr(liveTag)}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:6px">
    ${cache.items.map(item=>{
      const d=item.data;
      const priceStr=d?(item.unit+fmt(d.price,item.dec)):"\u2014";
      return `<div style="background:var(--surface);border:1px solid var(--b);border-radius:7px;padding:7px 9px">
        <div style="font-size:.74rem;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">
          ${item.label} \u00b7 <span style="text-transform:none;font-weight:400">${window.nfr(item.sub)}</span>
        </div>
        <div style="font-family:var(--mono);font-size:.98rem;font-weight:700;color:var(--text);line-height:1.1">${window.nfr(priceStr)}</div>
        <div style="margin-top:3px">${miniChg(d?.chg)}</div>
        ${d?`<div style="font-family:var(--mono);font-size:.74rem;color:var(--t3);margin-top:2px">H ${fmt(d.hi,item.dec)} \u00b7 L ${fmt(d.lo,item.dec)}</div>`:""}
      </div>`;
    }).join("")}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
    <div style="background:var(--surface);border:1px solid var(--b);border-radius:7px;padding:7px 9px">
      <div style="font-size:.74rem;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">USD/EUR \u00b7 BCE</div>
      <div style="font-family:var(--mono);font-size:.98rem;font-weight:700;color:var(--green)">${cache.usdEur?("\u20ac"+fmt(cache.usdEur,4)):"\u2014"}</div>
      <div style="font-size:.74rem;color:var(--t3);margin-top:3px">Frankfurter API \u00b7 BCE oficial</div>
    </div>
    <div style="background:var(--surface);border:1px solid var(--b);border-radius:7px;padding:7px 9px">
      <div style="font-size:.74rem;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">BTC/EUR \u00b7 CoinGecko</div>
      <div style="font-family:var(--mono);font-size:.98rem;font-weight:700;color:var(--accent)">${cache.btcEur?("\u20ac"+fmt(cache.btcEur,0)):"\u2014"}</div>
      <div style="font-size:.74rem;color:var(--t3);margin-top:3px">CoinGecko API</div>
    </div>
  </div>`;
}

window.loadMarketStats = loadMarketStats;
})();
