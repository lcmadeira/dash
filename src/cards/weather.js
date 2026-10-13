/* global CFG, $, skeletonWeather, lsGet, lsSet, fetchFirstOk, wxIPMA, IPMA_CITIES, IPMA_WIND, DAY_NAMES, er, notifyNonCriticalError, window */
(() => {
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
      lsSet(key,data);
    }
    const city=IPMA_CITIES[id]||`#${id}`,days=data.data||[];
    if(!days.length)throw new Error("Sem dados");
    const t=days[0],[ico,desc]=wxIPMA(t.idWeatherType);
    const tMin=Math.round(parseFloat(t.tMin)),tMax=Math.round(parseFloat(t.tMax));
    const rain=parseFloat(t.precipitaProb||0),wind=IPMA_WIND[t.classWindSpeed]||"—",dir=t.predWindDir||"—";
    const upd=data.dataUpdate?new Date(data.dataUpdate).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"}):"—";
    const opts=Object.entries(IPMA_CITIES).sort((a,b)=>a[1].localeCompare(b[1])).map(([cid,n])=>`<option value="${cid}"${Number(cid)===id?" selected":""}>${n}</option>`).join("");
    $("wx-body").innerHTML=`
      <div style="margin-bottom:10px"><select onchange="CFG.IPMA_CITY_ID=Number(this.value);loadWeather(true)"
        style="background:var(--surface);border:1px solid var(--b2);border-radius:var(--rs);color:var(--text);font-family:var(--mono);font-size:.65rem;padding:4px 8px;width:100%;cursor:pointer;outline:none">${opts}</select></div>
      <div class="wx-top"><span class="wx-ico">${ico}</span><div>
        <div class="wx-temp">${tMax}<span class="wx-unit">°C</span></div>
        <div class="wx-desc">${desc}</div><div class="wx-loc">${city} · Portugal</div></div></div>
      <div class="wx-grid">${[["Mínima",`${tMin}°C`],["Máxima",`${tMax}°C`],["Chuva",`${rain}%`],["Vento",wind],["Direção",dir],["Atualizado",upd]]
        .map(([l,v])=>`<div class="wx-s"><div class="wx-sl">${l}</div><div class="wx-sv">${v}</div></div>`).join("")}</div>
      <div class="fc-strip">${days.slice(0,5).map(e=>{
        const dn=DAY_NAMES[new Date(e.forecastDate).getDay()],[fi]=wxIPMA(e.idWeatherType);
        return`<div class="fc-item"><div class="fc-day">${dn}</div><div class="fc-ico">${fi}</div>
          <div class="fc-t">${Math.round(parseFloat(e.tMax))}°</div>
          <div class="fc-td">${Math.round(parseFloat(e.tMin))}°</div>
          <div style="font-family:var(--mono);font-size:.55rem;color:var(--blue);margin-top:2px">${parseFloat(e.precipitaProb||0).toFixed(0)}%</div>
        </div>`;}).join("")}</div>
      <div class="src">✦ IPMA · Previsão 5 dias · Sem chave API</div>`;
  }catch(e){$("wx-body").innerHTML=er(e,{context:"Meteorologia IPMA",action:"clique em ↺ para atualizar"});notifyNonCriticalError("Meteorologia IPMA",e,"clique em ↺ para atualizar");}
}

  window.loadWeather = loadWeather;
})();
