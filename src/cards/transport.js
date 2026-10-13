/* global Date, document, window */
(() => {
/* ══════════════════════════════════════════════════════
   TRANSPORTES PT
   ══════════════════════════════════════════════════════ */
function switchTr(tab,btn){
  document.querySelectorAll("#tr-tab-p,#tr-tab-h,#tr-tab-b").forEach(b=>b.classList.remove("on"));
  btn.classList.add("on");
  document.getElementById("tr-passes").style.display=     tab==="passes"?"":"none";
  document.getElementById("tr-horarios").style.display=   tab==="horarios"?"":"none";
  document.getElementById("tr-autocarros").style.display= tab==="autocarros"?"":"none";
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
      <span style="font-family:var(--mono);font-size:.72rem;font-weight:${isNext?700:400};color:${isPast?"var(--t3)":isNext?accentCol:"var(--text)"};min-width:38px">${t.p}</span>
      <span style="font-size:.54rem;background:${tipoCol}22;color:${tipoCol};border-radius:3px;padding:1px 4px">${t.tipo}</span>
      <span style="font-size:.54rem;color:var(--t3);flex:1">${t.obs}</span>
      <span style="font-size:.56rem;color:var(--t3)">${t.c}</span>
      ${isNext?`<span style="font-size:.52rem;color:${accentCol};font-weight:600">▶</span>`:""}
    </div>`;
  }

  const nextLX=nextTrain(HORARIOS_LX_EV);
  const nextEV=nextTrain(HORARIOS_EV_LX);

  /* Tab 1: Passes */
  const htmlPasses=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div>
        <div style="font-size:.63rem;font-weight:700;color:var(--t2);margin-bottom:5px">🎫 Passe Navegante 2026</div>
        ${PASSES.map(p=>`<div style="background:var(--b2);border-radius:7px;padding:7px 9px;margin-bottom:4px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div><div style="font-size:.68rem;font-weight:600;color:var(--text)">${p.ico} ${p.nome}</div>
              <div style="font-size:.57rem;color:var(--t3);margin-top:1px">${p.desc}</div></div>
            <div style="font-size:1.1rem;font-weight:800;color:#10B981;white-space:nowrap">${p.preco}<span style="font-size:.55rem;color:var(--t3)"> €/mês</span></div>
          </div></div>`).join("")}
        <div style="font-size:.55rem;color:var(--t3);margin:4px 0 6px">Preços municipais e metropolitano mantidos em 2026. A oferta regional no Alentejo varia por percurso e operador.</div>
        <div style="background:#3B82F611;border-radius:6px;padding:6px 9px;margin-top:5px;font-size:.61rem;color:var(--t2);line-height:1.5">
          💡 <b style="color:#10B981">Passe Metropolitano (40€/mês)</b> = ~25 viagens. Compensa a partir do 13.º dia útil com ida+volta.
        </div>
      </div>
      <div>
        <div style="font-size:.63rem;font-weight:700;color:var(--t2);margin-bottom:5px">🎟 Tarifas urbanas 2026</div>
        <table class="tbl">
          <thead>
            <tr><td>Operador</td><td class="r">Simples</td><td class="r">Diário</td></tr>
          </thead>
          <tbody>
            ${BILHETES.map(b=>`<tr>
              <td style="color:var(--text)">${b.op}</td>
              <td class="r pri">${b.simples.toFixed(2)}€</td>
              <td class="r muted">${b.diario?b.diario.toFixed(2)+"€":"—"}</td>
            </tr>`).join("")}
          </tbody>
        </table>
        <div style="font-size:.63rem;font-weight:700;color:var(--t2);margin:8px 0 5px">🚂 Ligações CP · tempos indicativos · consultar tarifa</div>
        ${LIGACOES.map(l=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 7px;background:var(--b2);border-radius:5px;margin-bottom:2px;border-left:2px solid ${l.col}">
          <div><span style="font-size:.65rem;font-weight:600;color:var(--text)">${l.orig} → ${l.dest}</span>
            <span style="font-size:.55rem;color:var(--t3);margin-left:4px">${l.tipo} · ${l.dur}</span></div>
          <div style="font-size:.58rem;font-weight:600;color:${l.col}">Consultar CP</div>
        </div>`).join("")}
        <div style="font-size:.55rem;color:var(--t3);margin-top:5px">Tarifários ocasionais 2026. CP Lisboa: preço simples para zona 1; o total depende das zonas. <a href="https://www.cp.pt/passageiros/pt" target="_blank" rel="noopener noreferrer">Consultar CP</a> · <a href="https://www.metrolisboa.pt/2025/12/19/novas-tarifas-2026/" target="_blank" rel="noopener noreferrer">Metro Lisboa</a> · <a href="https://andante.pt/comprar/andante-azul/" target="_blank" rel="noopener noreferrer">Andante</a></div>
        <div style="background:var(--b2);border-radius:5px;padding:5px 7px;margin-top:6px;font-size:.58rem;color:var(--t2)">O estado operacional e os avisos de greve não são consultados em direto. Confirme junto dos operadores.</div>
      </div>
    </div>`;

  /* Tab 2: Horários CP Lisboa↔Évora */
  const htmlHor=`
    <div style="font-size:.63rem;font-weight:700;color:var(--t2);margin-bottom:6px">
      🚆 Horários CP Lisboa↔Évora
      <span style="font-size:.55rem;font-weight:400;color:var(--t3)"> · horário publicado para vigorar desde 14 Dez 2025 · confirmar alterações na CP</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div>
        <div style="font-size:.62rem;font-weight:600;color:#F59E0B;margin-bottom:4px">Lisboa Or. → Évora</div>
        ${HORARIOS_LX_EV.map(t=>trainRow(t,nextLX,"#F59E0B")).join("")}
        <div style="font-size:.54rem;color:var(--t3);margin-top:3px">chegada Évora</div>
      </div>
      <div>
        <div style="font-size:.62rem;font-weight:600;color:#10B981;margin-bottom:4px">Évora → Lisboa Or.</div>
        ${HORARIOS_EV_LX.map(t=>trainRow(t,nextEV,"#10B981")).join("")}
        <div style="font-size:.54rem;color:var(--t3);margin-top:3px">chegada Lisboa</div>
      </div>
    </div>
    <div style="font-size:.54rem;color:var(--t3);margin-top:6px;line-height:1.5">
      IC = Intercidades · reserva obrigatória · tarifa varia por serviço · R = Regional · ▶ próxima partida
    </div>
    <div style="background:var(--b2);border-radius:7px;padding:8px 10px;margin-top:8px">
      <div style="font-size:.63rem;font-weight:700;color:#F59E0B;margin-bottom:3px">🏛️ Évora · Transportes</div>
      <div style="font-size:.6rem;color:var(--t2);line-height:1.6">
        CP Lisboa↔Évora: ~6 comboios/dia · 1h33 · tarifa varia por serviço e data<br>
        Autocarros regionais: passes e preços variam por linha e operador<br>
        Táxi/TVDE: Bolt e Uber disponíveis em Évora cidade<br>
        <span style="color:var(--t3)">Nota: sem Metro ou BRT — a CP é o transporte estrutural para Lisboa</span>
      </div>
    </div>`;

  /* Tab 3: Autocarros regionais */
  const htmlBus=`
    <div style="font-size:.63rem;font-weight:700;color:var(--t2);margin-bottom:6px">
      🚌 Autocarros regionais · partida de Évora
      <span style="font-size:.55rem;font-weight:400;color:var(--t3)"> · RVTEJO · Rede Expressos · Rodalentejo</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
      ${RVTEJO.map(r=>`<div style="background:var(--b2);border-radius:7px;padding:7px 9px;border:1px solid var(--b)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:.7rem;font-weight:600;color:var(--text)">${r.ico} ${r.dest}</span>
          <span style="font-size:.7rem;font-weight:700;color:#10B981">${r.preco}</span>
        </div>
        <div style="font-size:.55rem;color:var(--t3);margin-top:2px">${r.dur} · ${r.freq}</div>
        <div style="font-size:.52rem;color:var(--t3)">${r.op}</div>
      </div>`).join("")}
    </div>
    <div style="font-size:.54rem;color:var(--t3);margin-top:6px;line-height:1.5">
      Partida: Central de Camionagem de Évora · Av. Túlio Espanca · frequências e preços aproximados, confirmar no operador
    </div>`;

  el.innerHTML=`
    <div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">
      <button class="rbtn on" id="tr-tab-p" onclick="switchTr('passes',this)">🎫 Passes</button>
      <button class="rbtn"   id="tr-tab-h" onclick="switchTr('horarios',this)">🚆 Horários CP</button>
      <button class="rbtn"   id="tr-tab-b" onclick="switchTr('autocarros',this)">🚌 Autocarros</button>
    </div>
    <div id="tr-passes">${htmlPasses}</div>
    <div id="tr-horarios" style="display:none">${htmlHor}</div>
    <div id="tr-autocarros" style="display:none">${htmlBus}</div>
  `;
}
window.switchTr = switchTr;
window.loadTransp = loadTransp;
})();
