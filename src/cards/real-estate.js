/* global $, document, window, lsGet, lsSet, fetchJsonFirstOk */
(() => {
/* ═══ IMOBILIÁRIO PT ═══ */
/* ══════════════════════════════════════════════════════════════
   IMOBILIÁRIO PT — API INE live
   Indicador 0009494: Preço mediano vendas alojamentos (€/m²)
   Indicador 0009201: IPHab — Índice de preços habitação (base 2015)
   Periodicidade: trimestral · publicação ~3 meses após o trimestre
   CORS: via allorigins/corsproxy (API INE sem CORS nativo)
   ══════════════════════════════════════════════════════════════ */
async function loadImob(force=false){
  const CK="imob_ine_v1";

  /* Fallback estático — valores Q3 2025 confirmados nos destaques INE */
  const FALLBACK={
    price:2111, prevPrice:2065,
    chgQoQ:2.23, chgYoY:17.7,
    period:"Q3 2025", periodFull:"3.º Trimestre de 2025",
    transactions:42481, transChgYoY:3.8,
    salesBn:10.5,
    newChgYoY:14.1, existChgYoY:19.1,
    isLive:false
  };

  /* ── Construir URL da API INE ────────────────────────────── */
  function buildINEUrl(varcd, periodos){
    /* Sem Dim1 especificado → todos os períodos disponíveis
       Com Dim1 → filtrar por períodos (mais eficiente mas requer saber o código) */
    return `https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=${varcd}&lang=PT`;
  }

  /* ── Parser da resposta INE ──────────────────────────────── */
  function parseINEData(data){
    if(!Array.isArray(data)||!data.length) throw new Error("INE: resposta vazia");

    /* Converter código S7T32025 → chave numérica para ordenação correcta */
    function toKey(code){
      const m=code.match(/S7T(\d)(\d{4})/);
      return m?parseInt(m[2])*10+parseInt(m[1]):0;
    }
    function toLabel(code){
      const m=code.match(/S7T(\d)(\d{4})/);
      return m?`Q${m[1]} ${m[2]}`:code;
    }

    /* Filtrar Portugal, ordenar do mais recente para o mais antigo */
    const pt=data
      .filter(r=>r.geocod==="PT"&&r.valor&&r.valor!=="x"&&r.valor!=="")
      .sort((a,b)=>toKey(b.Dim1)-toKey(a.Dim1));

    if(!pt.length) throw new Error("INE: sem dados PT");

    const latest=pt[0], prev=pt[1];
    const price=parseFloat(latest.valor);
    const prevP=prev?parseFloat(prev.valor):null;

    /* Ano anterior — mesmo trimestre */
    const mLat=latest.Dim1.match(/S7T(\d)(\d{4})/);
    let prevYearPrice=null;
    if(mLat){
      const prevYearCode=`S7T${mLat[1]}${parseInt(mLat[2])-1}`;
      const prevYearRow=pt.find(r=>r.Dim1===prevYearCode);
      if(prevYearRow) prevYearPrice=parseFloat(prevYearRow.valor);
    }

    return{
      price,
      prevPrice:prevP,
      chgQoQ:prevP?((price-prevP)/prevP*100):null,
      chgYoY:prevYearPrice?((price-prevYearPrice)/prevYearPrice*100):null,
      period:toLabel(latest.Dim1),
      periodFull:latest.dim1_dsg||toLabel(latest.Dim1),
      history:pt.slice(0,8).map(r=>({period:toLabel(r.Dim1),value:parseFloat(r.valor)})),
      isLive:true
    };
  }

  /* ── Fetch com proxies ───────────────────────────────────── */
  async function fetchINE(varcd){
    const url = buildINEUrl(varcd);
    try {
      const j = await fetchJsonFirstOk(url, {}, 14000);
      if(Array.isArray(j) && j.length) return j;
      if(j.contents) {
        const parsed = JSON.parse(j.contents);
        if(Array.isArray(parsed)) return parsed;
      }
      return j;
    } catch(e) {
      console.warn("⚠️ INE falhou:", e.message);
      return null;
    }
  }

  /* ── Actualizar KPIs no DOM com dados live ───────────────── */
  function updateDOM(d){
    const preco=$("imob-preco-val");
    const chg  =$("imob-preco-chg");
    const trans=$("imob-trans-val");
    const ref  =$("imobRefQuarter");
    const sub1 =$("imobSub1");
    const sub2 =$("imobSub2");
    const sub3 =$("imobSub3");
    const src  =$("imobRefSrc");

    if(preco) preco.innerHTML=`${d.price.toLocaleString("pt-PT")} <span style="font-size:.6rem;font-weight:500;color:var(--t2)">€/m²</span>`;

    if(chg){
      const yoyStr=d.chgYoY!=null?`+${d.chgYoY.toFixed(1)}%`:"+17,7%";
      const col=d.chgYoY>0?"#10b981":"#ef4444";
      chg.style.color=col;
      chg.textContent=`▲ ${yoyStr} homólogo`;
    }

    if(ref) ref.textContent=`INE · ${d.period}`;
    if(sub1) sub1.textContent=`${d.period} · famílias`;
    if(sub2) sub2.textContent=`var. homóloga ${d.period}`;
    if(sub3) sub3.textContent=`var. homóloga ${d.period}`;

    if(src){
      const badge=d.isLive
        ?`<span style="color:#10B981;background:#10B98115;border-radius:3px;padding:1px 6px;font-family:var(--mono);font-size:.55rem">● INE API live</span>`
        :`<span style="color:#F59E0B;background:#F59E0B15;border-radius:3px;padding:1px 5px;font-family:var(--mono);font-size:.55rem">⚠ estático · ref. Q3 2025</span>`;
      src.innerHTML=`✦ INE · Estatísticas Preços Habitação · ${d.periodFull||d.period} ${badge}`;
    }

    console.log(`🏠 Imobiliário: ${d.price} €/m² (${d.period})${d.isLive?" · live":""}`);
  }

  /* ── Inicialização ───────────────────────────────────────── */
  /* 1. Cache válido → actualizar DOM e sair */
  if(!force){
    const cached=lsGet(CK);
    if(cached){
      updateDOM(cached);
      return;
    }
  }

  /* 2. Mostrar fallback imediatamente */
  updateDOM(FALLBACK);

  /* 3. Tentar API INE em background */
  try{
    const raw=await fetchINE("0009494");
    if(raw){
      const d=parseINEData(raw);
      /* Preservar dados estáticos que a API não devolve directamente */
      d.transactions=FALLBACK.transactions;
      d.transChgYoY=FALLBACK.transChgYoY;
      d.salesBn=FALLBACK.salesBn;
      d.newChgYoY=FALLBACK.newChgYoY;
      d.existChgYoY=FALLBACK.existChgYoY;
      lsSet(CK,d);
      updateDOM(d);
      return;
    }
  }catch(e){console.warn("⚠️ INE imobiliário falhou:",e.message);}

  console.warn("⚠️ INE indisponível — a usar valores estáticos Q3 2025");
}

(function(){
const IMOB_REGIOES=[
  {r:"Grande Lisboa",        v:4792,chg:18.2,col:"#f59e0b"},
  {r:"Algarve",              v:3556,chg:15.4,col:"#10b981"},
  {r:"R.A. Madeira",         v:3193,chg:14.8,col:"#0ea5e9"},
  {r:"Área Metro. Porto",    v:2740,chg:21.3,col:"#8b5cf6"},
  {r:"Península de Setúbal", v:2371,chg:19.6,col:"#3b82f6"},
  {r:"R.A. Açores",          v:1650,chg:11.2,col:"#06b6d4"},
  {r:"Alentejo Litoral",     v:1944,chg:13.8,col:"#84cc16"},
  {r:"Centro",               v:1320,chg: 9.1,col:"#a78bfa"},
  {r:"Norte (exc. Porto)",   v:1280,chg: 8.7,col:"#fb923c"},
];
const IMOB_TREND=[
  {q:"Q1 23",v:7.6},{q:"Q2 23",v:9.0},{q:"Q3 23",v:7.8},{q:"Q4 23",v:5.2},
  {q:"Q1 24",v:5.0},{q:"Q2 24",v:6.6},{q:"Q3 24",v:10.8},{q:"Q4 24",v:13.4},
  {q:"Q1 25",v:18.7},{q:"Q2 25",v:17.2},{q:"Q3 25",v:17.7},
];
const IMOB_MUNIC=[
  {m:"Lisboa",  v:4321,chg:16.1},{m:"Cascais",  v:3980,chg:18.4},
  {m:"Oeiras",  v:3640,chg:17.9},{m:"Porto",    v:3120,chg:22.1},
  {m:"Almada",  v:2540,chg:20.3},{m:"Braga",    v:2010,chg:19.8},
  {m:"Coimbra", v:1870,chg:15.2},{m:"Setúbal",  v:1750,chg:18.7},
  {m:"Funchal", v:2490,chg:13.5},{m:"Évora",    v:1480,chg:12.8},
];
let IMOB_FILTER="regioes";
window.switchImob=function(f,btn){
  document.querySelectorAll(".imob-tab").forEach(function(b){b.classList.remove("on");});
  if(btn)btn.classList.add("on");
  IMOB_FILTER=f;renderImob();
};
function barColor(chg){return chg>=18?"#ef4444":chg>=15?"#f59e0b":chg>=10?"#10b981":"#0ea5e9";}
function renderImob(){
  const el=document.getElementById("imob-body");if(!el)return;
  if(IMOB_FILTER==="regioes")renderRegioes(el);
  else if(IMOB_FILTER==="tendencia")renderTrend(el);
  else renderMunic(el);
}
function renderRegioes(el){
  const max=IMOB_REGIOES[0].v;
  el.innerHTML='<div class="imob-bar-wrap"><div class="imob-bar-title">Preço mediano €/m² por NUTS III (Q3 2025)</div>'
    +IMOB_REGIOES.map(function(r){
      return'<div class="imob-bar-row"><div class="imob-bar-lbl">'+r.r+'</div>'
        +'<div class="imob-bar-track"><div class="imob-bar-fill" style="width:'+Math.round(r.v/max*100)+'%;background:'+r.col+'"></div></div>'
        +'<div class="imob-bar-num">'+r.v.toLocaleString("pt")+'€ <span style="color:'+barColor(r.chg)+'">+'+r.chg+'%</span></div></div>';
    }).join("")+'</div>';
}
function renderTrend(el){
  const W=el.offsetWidth||360,H=90,pad=30,bw=Math.max(2,Math.floor((W-pad*2)/IMOB_TREND.length)-3);
  const vals=IMOB_TREND.map(function(t){return t.v;});
  const minV=Math.min.apply(null,vals),maxV=Math.max.apply(null,vals);
  const yScale=function(v){return H-10-Math.round((v-minV)/(maxV-minV)*(H-20));};
  let svg='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" class="imob-chart">';
  [5,10,15,20].forEach(function(g){
    const y=yScale(g);if(y<0||y>H)return;
    svg+='<line x1="'+pad+'" y1="'+y+'" x2="'+(W-10)+'" y2="'+y+'" stroke="#1e3260" stroke-width="0.5"/>';
    svg+='<text x="'+(pad-3)+'" y="'+(y+3)+'" font-size="6" fill="#4a5568" text-anchor="end">'+g+'%</text>';
  });
  IMOB_TREND.forEach(function(t,i){
    const x=pad+i*(bw+3),y=yScale(t.v),barH=H-10-y,col=barColor(t.v);
    svg+='<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+barH+'" fill="'+col+'" opacity=".85" rx="1"/>';
    svg+='<text x="'+(x+bw/2)+'" y="'+(H-2)+'" font-size="5.5" fill="#6b7280" text-anchor="middle">'+t.q+'</text>';
    if(i===IMOB_TREND.length-1)
      svg+='<text x="'+(x+bw/2)+'" y="'+(y-3)+'" font-size="6.5" fill="'+col+'" text-anchor="middle" font-weight="bold">'+t.v+'%</text>';
  });
  el.innerHTML='<div class="imob-svg-wrap">'+svg+'</svg></div>'
    +'<div style="font-family:var(--mono);font-size:.49rem;color:var(--t3);margin-top:4px">IPHab · Variação homóloga trimestral (%) · Fonte: INE</div>';
}
function renderMunic(el){
  const max=IMOB_MUNIC[0].v;
  el.innerHTML='<div class="imob-bar-wrap"><div class="imob-bar-title">Preço mediano €/m² — 12m até Q3 2025</div>'
    +IMOB_MUNIC.map(function(r){
      const col=barColor(r.chg);
      return'<div class="imob-bar-row"><div class="imob-bar-lbl">'+r.m+'</div>'
        +'<div class="imob-bar-track"><div class="imob-bar-fill" style="width:'+Math.round(r.v/max*100)+'%;background:'+col+'"></div></div>'
        +'<div class="imob-bar-num">'+r.v.toLocaleString("pt")+'€ <span style="color:'+col+'">+'+r.chg+'%</span></div></div>';
    }).join("")+'</div>';
}
document.addEventListener("DOMContentLoaded",renderImob);
setTimeout(renderImob,300);
})();




window.loadImob = loadImob;
})();
