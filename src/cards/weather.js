/* global CFG, $, skeletonWeather, lsGet, lsSet, fetchFirstOk, fetchJsonFirstOk, document, wxIPMA, IPMA_CITIES, IPMA_WIND, DAY_NAMES, er, notifyNonCriticalError, window */
(() => {
/* Área de aviso IPMA de cada cidade (idAreaAviso em api.ipma.pt/open-data/distrits-islands.json). */
const IPMA_WARNING_AREA = {
  1010500:"AVR", 1020500:"BJA", 1030300:"BRG", 1040200:"BGC", 1050200:"CBO", 1060300:"CBR", 1070500:"EVR",
  1080500:"FAR", 1090700:"GDA", 1100900:"LRA", 1110600:"LSB", 1121400:"PTG", 1131200:"PTO", 1141600:"STM",
  1151200:"STB", 1151300:"STB", 1160900:"VCT", 1171400:"VRL", 1182300:"VIS", 2310300:"MCS", 3420300:"AOR",
};
const WARNING_LEVELS = { yellow:{label:"Amarelo", rank:1}, orange:{label:"Laranja", rank:2}, red:{label:"Vermelho", rank:3} };
const IPMA_WARNINGS_URL = "https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json";

/** Avisos ativos (não verdes e ainda não terminados), do mais grave para o menos grave.
 * @param {Array<object>} list Resposta de warnings_www.json.
 * @param {number} [now] Instante de referência em ms.
 */
function activeWarnings(list, now = Date.now()) {
  return (Array.isArray(list) ? list : [])
    .filter((w) => WARNING_LEVELS[w?.awarenessLevelID] && Date.parse(w.endTime) > now)
    .sort((a, b) => WARNING_LEVELS[b.awarenessLevelID].rank - WARNING_LEVELS[a.awarenessLevelID].rank
      || Date.parse(a.startTime) - Date.parse(b.startTime));
}

function fmtWarningWhen(start, end) {
  const s = new Date(start), e = new Date(end);
  const day = s.toLocaleDateString("pt-PT", { weekday: "short" });
  const hh = (d) => d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  return `${day} ${hh(s)}–${hh(e)}`;
}

function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
}

/** Mostra os avisos IPMA da área da cidade e um resumo nacional; falhas não afetam a previsão. */
async function loadWeatherWarnings(cityId, cityName, force = false) {
  const box = document.getElementById("wx-warnings");
  if (!box) return;
  try {
    let list = force ? null : lsGet("ipma_warnings_v1");
    if (!Array.isArray(list)) {
      list = await fetchJsonFirstOk(IPMA_WARNINGS_URL, {}, 8000, ["direct"], (j) => Array.isArray(j));
      lsSet("ipma_warnings_v1", list, { source: "IPMA · avisos meteorológicos", state: "live" });
    }
    const active = activeWarnings(list);
    const area = IPMA_WARNING_AREA[cityId];
    const local = active.filter((w) => w.idAreaAviso === area);
    const counts = ["red", "orange", "yellow"].map((lvl) => [lvl, active.filter((w) => w.awarenessLevelID === lvl).length]).filter(([, n]) => n);
    const national = counts.length
      ? `No país: ${counts.map(([lvl, n]) => `${n} ${WARNING_LEVELS[lvl].label.toLowerCase()}`).join(" · ")}`
      : "Sem avisos meteorológicos no país";
    box.innerHTML = local.length
      ? local.slice(0, 3).map((w) => `<div class="wx-warning" data-level="${w.awarenessLevelID}" title="${escapeText(w.text)}">
          <span class="wx-warning-level">${WARNING_LEVELS[w.awarenessLevelID].label}</span>
          <span class="wx-warning-type">${escapeText(w.awarenessTypeName)}</span>
          <span class="wx-warning-when">${fmtWarningWhen(w.startTime, w.endTime)}</span>
        </div>`).join("") + `<div class="wx-warning-note">${local.length > 3 ? `+${local.length - 3} avisos · ` : ""}${window.nfr(national)}</div>`
      : `<div class="wx-warning-note">Sem avisos para ${escapeText(cityName)} · ${window.nfr(national)}</div>`;
  } catch {
    box.innerHTML = `<div class="wx-warning-note">Avisos IPMA indisponíveis de momento.</div>`;
  }
}

/* ── IPMA Meteorologia ── */
async function loadWeather(force=false){
  $("wx-body").innerHTML=skeletonWeather();
  try{
    const id=CFG.IPMA_CITY_ID,key=`ipma_${id}`;
    let data=force?null:lsGet(key);
    if(!data){
      const { r } = await fetchFirstOk(`https://api.ipma.pt/open-data/forecast/meteorology/cities/daily/${id}.json`, {}, 8000, ["direct", "allorigins"]);
      if(!r.ok)throw new Error(`IPMA ${r.status}`);
      data=await r.json();
      lsSet(key, data, {
        source: "IPMA",
        state: "live",
        observedAt: data.dataUpdate,
      });
    }
    const city=IPMA_CITIES[id]||`#${id}`,days=data.data||[];
    if(!days.length)throw new Error("Sem dados");
    const t=days[0],[ico,desc]=wxIPMA(t.idWeatherType);
    const tMin=Math.round(parseFloat(t.tMin)),tMax=Math.round(parseFloat(t.tMax));
    const rain=parseFloat(t.precipitaProb||0),wind=IPMA_WIND[t.classWindSpeed]||"—",dir=t.predWindDir||"—";
    const upd=data.dataUpdate?new Date(data.dataUpdate).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"}):"—";
    const opts=Object.entries(IPMA_CITIES).sort((a,b)=>a[1].localeCompare(b[1])).map(([cid,n])=>`<option value="${cid}"${Number(cid)===id?" selected":""}>${window.nfr(n)}</option>`).join("");
    $("wx-body").innerHTML=`
      <div style="margin-bottom:10px"><select onchange="CFG.IPMA_CITY_ID=Number(this.value);loadWeather(true);window.loadCivilProtection?.()"
        style="background:var(--surface);border:1px solid var(--b2);border-radius:var(--rs);color:var(--text);font-family:var(--mono);font-size:.74rem;padding:4px 8px;width:100%;cursor:pointer;outline:none">${window.nfr(opts)}</select></div>
      <div class="wx-top"><span class="wx-ico">${ico}</span><div>
        <div class="wx-temp">${window.nfr(tMax)}<span class="wx-unit">°C</span></div>
        <div class="wx-desc">${desc}</div><div class="wx-loc">${window.nfr(city)} · Portugal</div></div></div>
      <div class="wx-warnings" id="wx-warnings" aria-live="polite"><div class="wx-warning-note">A verificar avisos IPMA…</div></div>
      <div class="wx-grid">${[["Mínima",`${tMin}°C`],["Máxima",`${tMax}°C`],["Chuva",`${rain}%`],["Vento",wind],["Direção",dir],["Atualizado",upd]]
        .map(([l,v])=>`<div class="wx-s"><div class="wx-sl">${window.nfr(l)}</div><div class="wx-sv">${window.nfr(v)}</div></div>`).join("")}</div>
      <div class="fc-strip">${days.slice(0,5).map(e=>{
        const dn=DAY_NAMES[new Date(e.forecastDate).getDay()],[fi]=wxIPMA(e.idWeatherType);
        return`<div class="fc-item"><div class="fc-day">${window.nfr(dn)}</div><div class="fc-ico">${window.nfr(fi)}</div>
          <div class="fc-t">${Math.round(parseFloat(e.tMax))}°</div>
          <div class="fc-td">${Math.round(parseFloat(e.tMin))}°</div>
          <div style="font-family:var(--mono);font-size:.74rem;color:var(--blue);margin-top:2px">${window.nf(parseFloat(e.precipitaProb||0), 0)}%</div>
        </div>`;}).join("")}</div>
      <div class="src">✦ IPMA · Previsão 5 dias e avisos meteorológicos · Sem chave API</div>`;
    loadWeatherWarnings(id, city, force);
    window.renderPortugalBriefing?.();
  }catch(e){$("wx-body").innerHTML=er(e,{context:"Meteorologia IPMA",action:"clique em ↺ para atualizar"});notifyNonCriticalError("Meteorologia IPMA",e,"clique em ↺ para atualizar");}
}

  window.loadWeather = loadWeather;
  window.activeWarnings = activeWarnings;
})();
