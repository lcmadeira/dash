/* global Date, document, window, fetchJsonFirstOk, lsGet, lsSet */
(() => {
/* ══════════════════════════════════════════════════════
   TRANSPORTES PT
   ══════════════════════════════════════════════════════ */
function switchTr(tab,btn){
  document.querySelectorAll("#tr-tab-p,#tr-tab-h,#tr-tab-b,#tr-tab-a").forEach(b=>b.classList.remove("on"));
  btn.classList.add("on");
  [["tr-passes","passes"],["tr-horarios","horarios"],["tr-autocarros","autocarros"],["tr-alertas","alertas"]].forEach(([id,name])=>{
    const panel=document.getElementById(id);
    if(panel) panel.style.display=tab===name?"":"none";
  });
  if(tab==="alertas") loadCarrisAlerts();
}

/* ── Alertas Carris Metropolitana (API Aberta) ── */
const CARRIS_ALERTS_URL="https://api.apiaberta.pt/v1/carris/alerts";
const CARRIS_EFFECT={SIGNIFICANT_DELAYS:"Atrasos",DETOUR:"Desvio",REDUCED_SERVICE:"Serviço reduzido",NO_SERVICE:"Sem serviço",STOP_MOVED:"Paragem mudada",MODIFIED_SERVICE:"Serviço alterado",OTHER_EFFECT:"Alteração",UNKNOWN_EFFECT:"Alteração"};
const CARRIS_CAUSE={STRIKE:"Greve",DEMONSTRATION:"Manifestação",CONSTRUCTION:"Obras",ACCIDENT:"Acidente",WEATHER:"Meteorologia",TECHNICAL_PROBLEM:"Avaria",OTHER_CAUSE:"Outra causa",UNKNOWN_CAUSE:"Outra causa"};
const CARRIS_PRIORITY={NO_SERVICE:0,REDUCED_SERVICE:1,DETOUR:2,SIGNIFICANT_DELAYS:3};
let carrisAlerts=null;

function escTr(value){
  return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
}

/** Normaliza e ordena alertas: greves e cortes de serviço primeiro. */
function normalizeCarrisAlerts(list){
  return (Array.isArray(list)?list:[])
    .filter(a=>a&&a.active!==false&&typeof a.header_pt==="string")
    .map(a=>{
      const parts=a.header_pt.split(" | ");
      /* Só é concelho um prefixo de texto simples (sem números de linha nem "Área 4: …"). */
      const hasMunicipality=parts.length>1&&/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s,'-]*$/.test(parts[0].trim())&&!/^(linhas?|área)\b/i.test(parts[0].trim());
      return {
        municipality: hasMunicipality?parts[0].trim():"Área metropolitana",
        title: hasMunicipality?parts.slice(1).join(" | ").trim():a.header_pt.trim(),
        description: String(a.description_pt||"").trim(),
        effect: CARRIS_EFFECT[a.effect]||"Alteração",
        cause: CARRIS_CAUSE[a.cause]||"",
        strike: a.cause==="STRIKE",
        rank: (a.cause==="STRIKE"?-1:0)+(CARRIS_PRIORITY[a.effect]??4),
        lines: Array.isArray(a.lines)?a.lines:[],
        until: a.active_to||null,
      };
    })
    .sort((x,y)=>x.rank-y.rank||x.municipality.localeCompare(y.municipality,"pt"));
}

function renderCarrisAlerts(){
  const box=document.getElementById("tr-alertas");
  if(!box||!carrisAlerts) return;
  const sel=document.getElementById("carris-mun");
  const chosen=sel?sel.value:"";
  const munis=[...new Set(carrisAlerts.flatMap(a=>a.municipality.split(/\s+e\s+|,\s*/).map(m=>m.trim())))].filter(Boolean).sort((a,b)=>a.localeCompare(b,"pt"));
  const shown=chosen?carrisAlerts.filter(a=>a.municipality.includes(chosen)):carrisAlerts;
  const strikes=carrisAlerts.filter(a=>a.strike).length;
  box.innerHTML=`
    <div class="carris-head">
      <span><b>${window.nfr(carrisAlerts.length)}</b> alertas ativos${strikes?` · <b class="carris-strike">${window.nfr(strikes)} greve${strikes>1?"s":""}</b>`:""}</span>
      <select id="carris-mun" aria-label="Filtrar alertas por concelho" onchange="renderCarrisAlerts()">
        <option value="">Todos os concelhos</option>
        ${munis.map(m=>`<option value="${escTr(m)}"${m===chosen?" selected":""}>${escTr(m)}</option>`).join("")}
      </select>
    </div>
    <div class="carris-list">${shown.slice(0,12).map(a=>`
      <div class="carris-item${a.strike?" is-strike":""}" title="${escTr(a.description)}">
        <div class="carris-meta"><span>${escTr(a.effect)}${a.cause?` · ${escTr(a.cause)}`:""}</span><span>${escTr(a.municipality)}</span></div>
        <div class="carris-title">${escTr(a.title)}</div>
        ${a.until?`<div class="carris-until">até ${new Date(a.until).toLocaleDateString("pt-PT",{day:"numeric",month:"short",year:"numeric"})}</div>`:""}
      </div>`).join("")}
      ${shown.length>12?`<div class="carris-more">+${shown.length-12} alertas · filtre por concelho</div>`:""}
      ${shown.length?"":`<div class="carris-more">Sem alertas para este concelho.</div>`}
    </div>
    <div class="carris-src">Carris Metropolitana (TML) via <a href="https://apiaberta.pt/" target="_blank" rel="noopener noreferrer">API Aberta</a> · passe o rato para ver a descrição</div>`;
}

async function loadCarrisAlerts(force=false){
  const box=document.getElementById("tr-alertas");
  if(!box) return;
  if(carrisAlerts&&!force){ renderCarrisAlerts(); return; }
  box.innerHTML=`<div class="carris-more">A carregar alertas da Carris Metropolitana…</div>`;
  try{
    let raw=force?null:lsGet("carris_alerts_v1");
    if(!Array.isArray(raw)){
      const j=await fetchJsonFirstOk(CARRIS_ALERTS_URL,{},10000,["direct"],x=>Array.isArray(x?.data));
      raw=j.data;
      lsSet("carris_alerts_v1",raw,{source:"Carris Metropolitana via API Aberta",state:j.stale?"stale":"live"});
    }
    carrisAlerts=normalizeCarrisAlerts(raw);
    renderCarrisAlerts();
  }catch{
    box.innerHTML=`<div class="carris-more">Alertas da Carris Metropolitana indisponíveis de momento. <a href="https://www.carrismetropolitana.pt/alertas" target="_blank" rel="noopener noreferrer">Ver no site da Carris Metropolitana</a></div>`;
  }
}
function loadTransp(_force){
  const el=document.getElementById("transp-body");
  if(!el) return;

  /* ── DADOS ── */
  const PASSES=[
    {nome:"Navegante Metropolitano",preco:40,ico:"🔵",desc:"Metro+CP+Carris+STCP · ilimitado"},
    {nome:"Navegante Municipal LX", preco:30,ico:"🟢",desc:"Todos os operadores dentro de Lisboa"},
    {nome:"Navegante Municipal Porto",preco:30,ico:"🟣",desc:"Metro+STCP+CP dentro do Porto"},
    {nome:"Intermodal Porto (AMP)",  preco:40,ico:"🟡",desc:"Área Metropolitana do Porto"},
  ];
  const BILHETES=[
    {op:"Carris/Metro Lisboa",simples:1.90,diario:7.25},
    {op:"CP Urbanos Lisboa · zona 1",simples:1.50,diario:6.70},
    {op:"Andante AMP · Z2",simples:1.40,diario:5.35},
  ];
  /* Ligações CP — tarifas dependem do serviço, classe e data de compra
     Horário Linha do Alentejo em vigor desde 14 Dez 2025 */
  const LIGACOES=[
    {orig:"Lisboa Or.",dest:"Porto Camp.",  dur:"2h55",tipo:"Alfa",col:"#3B82F6"},
    {orig:"Lisboa Or.",dest:"Faro",         dur:"2h45",tipo:"IC",  col:"#10B981"},
    {orig:"Lisboa Or.",dest:"Coimbra B",    dur:"1h30",tipo:"Alfa",col:"#3B82F6"},
    {orig:"Porto Camp.",dest:"Vigo",        dur:"1h10",tipo:"Int.",col:"#8B5CF6"},
    {orig:"Lisboa S.Ap.",dest:"Cascais",    dur:"0h40",tipo:"Urb.",col:"#F59E0B"},
    {orig:"Lisboa Rossio",dest:"Sintra",    dur:"0h40",tipo:"Urb.",col:"#F59E0B"},
    {orig:"Lisboa Or.",dest:"Évora",        dur:"1h33",tipo:"IC",  col:"#F59E0B"},
    {orig:"Évora",dest:"Lisboa Or.",        dur:"1h30",tipo:"IC",  col:"#F59E0B"},
    {orig:"Évora",dest:"Faro",             dur:"3h20",tipo:"IC",  col:"#10B981"},
    {orig:"Évora",dest:"Porto Camp.",      dur:"4h25",tipo:"IC",  col:"#3B82F6"},
  ];
  /* Horários CP Lisboa↔Évora — em vigor desde 14 Dez 2025 · Fonte: cp.pt */
  const HORARIOS_LX_EV=[
    {p:"07:02",c:"08:42",tipo:"IC",obs:"Diário"},
    {p:"09:02",c:"10:35",tipo:"IC",obs:"Diário"},
    {p:"09:58",c:"11:35",tipo:"IC",obs:"Seg–Sex"},
    {p:"13:35",c:"15:08",tipo:"IC",obs:"Diário"},
    {p:"17:02",c:"18:35",tipo:"IC",obs:"Diário"},
    {p:"19:02",c:"20:35",tipo:"IC",obs:"Diário"},
  ];
  const HORARIOS_EV_LX=[
    {p:"07:06",c:"08:36",tipo:"IC",obs:"Diário"},
    {p:"09:06",c:"10:36",tipo:"IC",obs:"Diário"},
    {p:"11:35",c:"13:06",tipo:"IC",obs:"Seg–Sex"},
    {p:"14:23",c:"~16h",tipo:"R", obs:"Seg–Sex"},
    {p:"16:57",c:"18:36",tipo:"IC",obs:"Diário"},
    {p:"19:06",c:"20:36",tipo:"IC",obs:"Diário"},
  ];
  /* Autocarros regionais de Évora */
  const RVTEJO=[
    {dest:"Estremoz",        dur:"~50min",freq:"~6/dia",preco:"8€",  op:"Rede Expressos",ico:"🏰"},
    {dest:"Portalegre",      dur:"~1h25", freq:"~4/dia",preco:"12€", op:"Rede Expressos",ico:"🏔️"},
    {dest:"Beja",            dur:"~1h20", freq:"~5/dia",preco:"8€",  op:"Rede Expressos",ico:"🌾"},
    {dest:"Montemor-o-Novo", dur:"~40min",freq:"~4/dia",preco:"5€",  op:"RVTEJO",        ico:"🏘️"},
    {dest:"Reguengos Mons.", dur:"~45min",freq:"~3/dia",preco:"6€",  op:"Rodalentejo",   ico:"🍷"},
    {dest:"Arraiolos",       dur:"~30min",freq:"~3/dia",preco:"4€",  op:"RVTEJO",        ico:"🏡"},
    {dest:"Mora / Sousel",   dur:"~1h",   freq:"~2/dia",preco:"7€",  op:"RVTEJO",        ico:"🌳"},
  ];

  /* ── RENDER ── */
  const now=new Date(), hh=now.getHours(), mm=now.getMinutes(), cur=hh*60+mm;

  function nextTrain(list){
    return list.filter(t=>{ const [h,m]=t.p.split(":").map(Number); return h*60+m>=cur; })[0];
  }
  function trainRow(t, nextT, accentCol){
    const [ph,pm]=t.p.split(":").map(Number);
    const isPast=(ph*60+pm)<cur;
    const isNext=t===nextT;
    const tipoCol=t.tipo==="IC"?"#3B82F6":"#10B981";
    return `<div style="display:flex;align-items:center;gap:5px;padding:4px 6px;border-radius:5px;margin-bottom:2px;`
      +(isNext?`background:${accentCol}18;border:1px solid ${accentCol}44;`:isPast?`opacity:.38;`:`background:var(--b2);`)+`">
      <span style="font-family:var(--mono);font-size:.74rem;font-weight:${isNext?700:400};color:${isPast?"var(--t3)":isNext?accentCol:"var(--text)"};min-width:38px">${window.nfr(t.p)}</span>
      <span style="font-size:.74rem;background:${tipoCol}22;color:${tipoCol};border-radius:3px;padding:1px 4px">${window.nfr(t.tipo)}</span>
      <span style="font-size:.74rem;color:var(--t3);flex:1">${window.nfr(t.obs)}</span>
      <span style="font-size:.74rem;color:var(--t3)">${window.nfr(t.c)}</span>
      ${isNext?`<span style="font-size:.74rem;color:${accentCol};font-weight:600">▶</span>`:""}
    </div>`;
  }

  const nextLX=nextTrain(HORARIOS_LX_EV);
  const nextEV=nextTrain(HORARIOS_EV_LX);

  /* Tab 1: Passes */
  const htmlPasses=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div>
        <div style="font-size:.74rem;font-weight:700;color:var(--t2);margin-bottom:5px">🎫 Passe Navegante 2026</div>
        ${PASSES.map(p=>`<div style="background:var(--b2);border-radius:7px;padding:7px 9px;margin-bottom:4px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div><div style="font-size:.74rem;font-weight:600;color:var(--text)">${p.ico} ${window.nfr(p.nome)}</div>
              <div style="font-size:.74rem;color:var(--t3);margin-top:1px">${p.desc}</div></div>
            <div style="font-size:1.1rem;font-weight:800;color:var(--green);white-space:nowrap">${window.nfr(p.preco)}<span style="font-size:.74rem;color:var(--t3)"> €/mês</span></div>
          </div></div>`).join("")}
        <div style="font-size:.74rem;color:var(--t3);margin:4px 0 6px">Preços municipais e metropolitano mantidos em 2026. A oferta regional no Alentejo varia por percurso e operador.</div>
        <div style="background:#3B82F611;border-radius:6px;padding:6px 9px;margin-top:5px;font-size:.74rem;color:var(--t2);line-height:1.5">
          💡 <b style="color:var(--green)">Passe Metropolitano (40€/mês)</b> = ~25 viagens. Compensa a partir do 13.º dia útil com ida+volta.
        </div>
      </div>
      <div>
        <div style="font-size:.74rem;font-weight:700;color:var(--t2);margin-bottom:5px">🎟 Tarifas urbanas 2026</div>
        <table class="tbl">
          <thead>
            <tr><td>Operador</td><td class="r">Simples</td><td class="r">Diário</td></tr>
          </thead>
          <tbody>
            ${BILHETES.map(b=>`<tr>
              <td style="color:var(--text)">${window.nfr(b.op)}</td>
              <td class="r pri">${window.nf(b.simples, 2)}€</td>
              <td class="r muted">${b.diario?window.nf(b.diario, 2)+"€":"—"}</td>
            </tr>`).join("")}
          </tbody>
        </table>
        <div style="font-size:.74rem;font-weight:700;color:var(--t2);margin:8px 0 5px">🚂 Ligações CP · tempos indicativos · consultar tarifa</div>
        ${LIGACOES.map(l=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 7px;background:var(--surface);border:1px solid var(--b);border-radius:5px;margin-bottom:2px">
          <div><span style="font-size:.74rem;font-weight:600;color:var(--text)">${window.nfr(l.orig)} → ${window.nfr(l.dest)}</span>
            <span style="font-size:.74rem;color:var(--t3);margin-left:4px">${window.nfr(l.tipo)} · ${window.nfr(l.dur)}</span></div>
          <div style="font-size:.74rem;font-weight:600;color:var(--accent)">Consultar CP</div>
        </div>`).join("")}
        <div style="font-size:.74rem;color:var(--t3);margin-top:5px">Tarifários ocasionais 2026. CP Lisboa: preço simples para zona 1; o total depende das zonas. <a href="https://www.cp.pt/passageiros/pt" target="_blank" rel="noopener noreferrer">Consultar CP</a> · <a href="https://www.metrolisboa.pt/2025/12/19/novas-tarifas-2026/" target="_blank" rel="noopener noreferrer">Metro Lisboa</a> · <a href="https://andante.pt/comprar/andante-azul/" target="_blank" rel="noopener noreferrer">Andante</a></div>
        <div style="background:var(--b2);border-radius:5px;padding:5px 7px;margin-top:6px;font-size:.74rem;color:var(--t2)">O estado operacional e os avisos de greve da CP e do Metro não são consultados em direto; os alertas da Carris Metropolitana estão no separador ⚠ Alertas. Confirme junto dos operadores.</div>
      </div>
    </div>`;

  /* Tab 2: Horários CP Lisboa↔Évora */
  const htmlHor=`
    <div style="font-size:.74rem;font-weight:700;color:var(--t2);margin-bottom:6px">
      🚆 Horários CP Lisboa↔Évora
      <span style="font-size:.74rem;font-weight:400;color:var(--t3)"> · horário publicado para vigorar desde 14 Dez 2025 · confirmar alterações na CP</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div>
        <div style="font-size:.74rem;font-weight:600;color:var(--amber);margin-bottom:4px">Lisboa Or. → Évora</div>
        ${HORARIOS_LX_EV.map(t=>trainRow(t,nextLX,"#F59E0B")).join("")}
        <div style="font-size:.74rem;color:var(--t3);margin-top:3px">chegada Évora</div>
      </div>
      <div>
        <div style="font-size:.74rem;font-weight:600;color:var(--green);margin-bottom:4px">Évora → Lisboa Or.</div>
        ${HORARIOS_EV_LX.map(t=>trainRow(t,nextEV,"#10B981")).join("")}
        <div style="font-size:.74rem;color:var(--t3);margin-top:3px">chegada Lisboa</div>
      </div>
    </div>
    <div style="font-size:.74rem;color:var(--t3);margin-top:6px;line-height:1.5">
      IC = Intercidades · reserva obrigatória · tarifa varia por serviço · R = Regional · ▶ próxima partida
    </div>
    <div style="background:var(--b2);border-radius:7px;padding:8px 10px;margin-top:8px">
      <div style="font-size:.74rem;font-weight:700;color:var(--amber);margin-bottom:3px">🏛️ Évora · Transportes</div>
      <div style="font-size:.74rem;color:var(--t2);line-height:1.6">
        CP Lisboa↔Évora: ~6 comboios/dia · 1h33 · tarifa varia por serviço e data<br>
        Autocarros regionais: passes e preços variam por linha e operador<br>
        Táxi/TVDE: Bolt e Uber disponíveis em Évora cidade<br>
        <span style="color:var(--t3)">Nota: sem Metro ou BRT — a CP é o transporte estrutural para Lisboa</span>
      </div>
    </div>`;

  /* Tab 3: Autocarros regionais */
  const htmlBus=`
    <div style="font-size:.74rem;font-weight:700;color:var(--t2);margin-bottom:6px">
      🚌 Autocarros regionais · partida de Évora
      <span style="font-size:.74rem;font-weight:400;color:var(--t3)"> · RVTEJO · Rede Expressos · Rodalentejo</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
      ${RVTEJO.map(r=>`<div style="background:var(--b2);border-radius:7px;padding:7px 9px;border:1px solid var(--b)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:.74rem;font-weight:600;color:var(--text)">${r.ico} ${window.nfr(r.dest)}</span>
          <span style="font-size:.74rem;font-weight:700;color:var(--green)">${window.nfr(r.preco)}</span>
        </div>
        <div style="font-size:.74rem;color:var(--t3);margin-top:2px">${window.nfr(r.dur)} · ${window.nfr(r.freq)}</div>
        <div style="font-size:.74rem;color:var(--t3)">${window.nfr(r.op)}</div>
      </div>`).join("")}
    </div>
    <div style="font-size:.74rem;color:var(--t3);margin-top:6px;line-height:1.5">
      Partida: Central de Camionagem de Évora · Av. Túlio Espanca · frequências e preços aproximados, confirmar no operador
    </div>`;

  el.innerHTML=`
    <div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">
      <button class="rbtn on" id="tr-tab-p" onclick="switchTr('passes',this)">🎫 Passes</button>
      <button class="rbtn"   id="tr-tab-h" onclick="switchTr('horarios',this)">🚆 Horários CP</button>
      <button class="rbtn"   id="tr-tab-b" onclick="switchTr('autocarros',this)">🚌 Autocarros</button>
      <button class="rbtn"   id="tr-tab-a" onclick="switchTr('alertas',this)">⚠ Alertas</button>
    </div>
    <div id="tr-passes">${window.nfr(htmlPasses)}</div>
    <div id="tr-horarios" style="display:none">${window.nfr(htmlHor)}</div>
    <div id="tr-autocarros" style="display:none">${window.nfr(htmlBus)}</div>
    <div id="tr-alertas" style="display:none"></div>
  `;
  carrisAlerts=_force?null:carrisAlerts;
}
window.switchTr = switchTr;
window.renderCarrisAlerts = renderCarrisAlerts;
window.normalizeCarrisAlerts = normalizeCarrisAlerts;
window.loadTransp = loadTransp;
})();
