/* global $, AbortSignal, fetchJsonFirstOk, window, INFLATION_FALLBACK, lsGet, lsSet */
(() => {
let INFLATION_DATA = null;
let INFLATION_SOURCE = 'static'; // 'static' | 'eurostat_live'

function inflationObservationTimestamp(label) {
  const match = /^([A-Za-zÀ-ÿ]{3})\.?\s+(\d{4})$/.exec(String(label || "").trim());
  if (!match) return null;
  const month = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
    .indexOf(match[1].toLowerCase());
  return month < 0 ? null : Date.UTC(Number(match[2]), month, 1);
}

/* ── Parser JSON-stat do Eurostat ────────────────────────────── */
function parseEurostatInflation(json){
  try{
    /* JSON-stat conserva a ordem das dimensões declarada no payload. */
    const dimTime  = json.dimension.time  || json.dimension.TIME_PERIOD;
    const dimGeo   = json.dimension.geo   || json.dimension.GEO;

    if(!dimTime || !dimGeo) throw new Error('Dimensões em falta');

    const timeIndex = dimTime.category.index;
    const geoIndex  = dimGeo.category.index;

    /* Tamanho e posição das dimensões para calcular o índice JSON-stat. */
    const idxPT  = geoIndex['PT']  ?? geoIndex['pt'];
    const dimIds = json.id || Object.keys(json.dimension);
    const sizes = json.size || dimIds.map(id => {
      const category = json.dimension[id]?.category;
      return Object.keys(category?.index || {}).length;
    });
    const geoDim = dimIds.findIndex(id => id.toLowerCase() === 'geo');
    const timeDim = dimIds.findIndex(id => ['time', 'time_period'].includes(id.toLowerCase()));
    if(geoDim < 0 || timeDim < 0) throw new Error('Ordem das dimensões em falta');
    const stride = dim => sizes.slice(dim + 1).reduce((product, size) => product * size, 1);
    const geoStride = stride(geoDim);
    const timeStride = stride(timeDim);

    const idxEA20 = geoIndex['EA20'] ?? geoIndex['EA'];
    const idxEA21 = geoIndex['EA21'];

    if(idxPT === undefined || (idxEA20 === undefined && idxEA21 === undefined))
      throw new Error(`Geo não encontrado (PT=${idxPT}, EA20=${idxEA20}, EA21=${idxEA21})`);

    /* Meses em português abreviado */
    const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun',
                   'Jul','Ago','Set','Out','Nov','Dez'];

    /* Ordenar períodos do mais recente para o mais antigo */
    const sortedPeriods = Object.entries(timeIndex)
      .sort((a,b) => b[0].localeCompare(a[0])); // desc

    const rows = [];
    for(const [period, tIdx] of sortedPeriods){
      const eaIndex = period >= '2026-01' ? (idxEA21 ?? idxEA20) : (idxEA20 ?? idxEA21);
      const valueAt = (geoIdx) => {
        const index = geoIdx * geoStride + tIdx * timeStride;
        const value = json.value?.[index];
        return Array.isArray(value) ? value[0] : value;
      };
      const valPT = valueAt(idxPT);
      const valEA = valueAt(eaIndex);

      if(valPT === null || valPT === undefined || valEA === null || valEA === undefined) continue;

      /* Formatar "2025-09" → "Set 2025" */
      const [y, m] = period.split('-');
      const label  = `${MESES[parseInt(m)-1]} ${y}`;

      rows.push({m: label, pt: parseFloat(valPT.toFixed(1)),
                              eu: parseFloat(valEA.toFixed(1))});
    }

    if(rows.length < 3) throw new Error('Dados insuficientes: ' + rows.length);
    return rows.slice(0, 8); // máx 8 meses
  } catch(e){
    console.warn('parseEurostatInflation:', e.message);
    return null;
  }
}

/* ── Fetch Eurostat em background ──────────────────────────── */
async function fetchEurostatInflation(){
  const BASE = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/PRC_HICP_MANR';
  const PARAMS = '?geo=PT&geo=EA20&geo=EA21&coicop=CP00&lastTimePeriod=8&lang=en';
  const url = BASE + PARAMS;

  try {
    return await fetchJsonFirstOk(url, {signal: AbortSignal.timeout(11000)}, 11000,
      ["direct", "allorigins", "corsproxy"], json => {
        const rows = parseEurostatInflation(json);
        return Boolean(rows && rows.length >= 3);
      }).then(parseEurostatInflation);
  } catch {
    return null;
  }
}

/* ── Ponto de entrada: cache → fallback imediato → Eurostat bg ─ */
async function initInflation(force=false){
  const CK = 'inflation_eurostat_v2';

  /* 1. Cache válido → mostrar e sair */
  if(!force){
    const cached = lsGet(CK);
    const validRows = Array.isArray(cached?.rows) && cached.rows.length >= 3 &&
      cached.rows.every(row => row && typeof row.m === 'string' &&
        Number.isFinite(row.pt) && Number.isFinite(row.eu));
    if(validRows){
      INFLATION_DATA   = cached.rows;
      INFLATION_SOURCE = cached.source || 'eurostat_live';
      renderInflation();
      console.log('📊 Inflação: cache local (' + INFLATION_DATA[0].m + ')');
      return;
    }
  }

  /* 2. Mostrar fallback IMEDIATAMENTE */
  INFLATION_DATA   = INFLATION_FALLBACK;
  INFLATION_SOURCE = 'static';
  renderInflation();

  /* 3. Tentar Eurostat em background */
  try{
    console.log('📊 Inflação: a actualizar do Eurostat...');
    const rows = await fetchEurostatInflation();
    if(rows){
      INFLATION_DATA   = rows;
      INFLATION_SOURCE = 'eurostat_live';
      lsSet(CK, {rows, source: 'eurostat_live'}, {
        source: "Eurostat · IHPC",
        state: "live",
        observedAt: inflationObservationTimestamp(rows[0]?.m),
      });
      renderInflation();
      console.log('✅ Inflação Eurostat actualizada:', rows[0].m);
    } else {
      console.warn('⚠️ Eurostat inflação indisponível, a usar fallback estático');
    }
  } catch(e){
    console.warn('⚠️ Eurostat inflação erro:', e.message);
  }
}

/* ── Render ─────────────────────────────────────────────────── */
function renderInflation(){
  const el = $('inf-body');
  if(!el) return;

  /* Usar dados globais ou fallback de emergência */
  const data = INFLATION_DATA || INFLATION_FALLBACK;
  const source = INFLATION_SOURCE || 'static';

  const l    = data[0];
  const maxV = Math.max(...data.map(d => Math.max(d.pt, d.eu))) * 1.1;
  const ptC  = 'var(--accent)', euC = 'var(--blue)';

  const sourceTag = source === 'eurostat_live'
    ? `<span style="font-size:.5rem;color:#10B981;background:#10B98115;border-radius:3px;padding:1px 6px">● Eurostat · ${data[0].m}</span>`
    : `<span style="font-size:.5rem;color:#F59E0B;background:#F59E0B15;border-radius:3px;padding:1px 5px">⚠ estático · ${data[0].m}</span>`;

  el.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:6px">${sourceTag}</div>
    <div class="inf-hero">
      <div class="inf-block">
        <div class="inf-flag">🇵🇹</div>
        <div class="inf-val" style="color:${ptC}">${l.pt.toFixed(1)}<span style="font-size:.8rem">%</span></div>
        <div class="inf-lbl">Portugal · IHPC</div>
        <div class="inf-lbl">${l.m}</div>
      </div>
      <div class="inf-sep"></div>
      <div class="inf-block">
        <div class="inf-flag">🇪🇺</div>
        <div class="inf-val" style="color:${euC}">${l.eu.toFixed(1)}<span style="font-size:.8rem">%</span></div>
        <div class="inf-lbl">Zona Euro · IHPC</div>
        <div class="inf-lbl">${l.m}</div>
      </div>
      <div class="inf-sep"></div>
      <div class="inf-block">
        <div class="inf-flag" style="font-size:.75rem;margin-bottom:5px">Meta BCE</div>
        <div class="inf-val" style="color:var(--green);font-size:1.35rem">2.0<span style="font-size:.8rem">%</span></div>
        <div class="inf-lbl" style="color:${l.eu<=2.2?'var(--green)':'var(--red)'}">${l.eu<=2.2?'✓ próximo':'▲ acima'} da meta</div>
        <div class="inf-lbl">&nbsp;</div>
      </div>
    </div>
    <div class="inf-hist">${data.map(d=>{
      const bp=Math.round((d.pt/maxV)*100), be=Math.round((d.eu/maxV)*100);
      return `<div class="inf-row">
        <div class="inf-row-lbl">${d.m}</div>
        <div class="inf-bar-wrap">
          <div class="inf-bar-pt" style="width:${bp}%;background:${ptC}"></div>
          <div class="inf-bar-eu" style="width:${be}%;background:${euC}"></div>
        </div>
        <div class="inf-row-pt" style="color:${ptC}">${d.pt.toFixed(1)}%</div>
        <div class="inf-row-eu" style="color:${euC}">${d.eu.toFixed(1)}%</div>
      </div>`;
    }).join('')}</div>
    <div style="display:flex;gap:14px;margin-top:8px">
      <span style="font-family:var(--mono);font-size:.56rem;color:${ptC}">▬ Portugal</span>
      <span style="font-family:var(--mono);font-size:.56rem;color:${euC}">▬ Zona Euro</span>
    </div>
    ${data[0].m === 'Set 2026' ? '<div style="font-size:.52rem;color:var(--t3);margin-top:5px">Set 2026: estimativas rápidas do INE e flash estimate Eurostat.</div>' : ''}`;
}


window.initInflation = initInflation;
window.renderInflation = renderInflation;
})();
