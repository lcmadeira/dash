/* global $, Date, fetchJsonFirstOk, ld, lsGet, lsSet, window */
(() => {
/* ══════════════════════════════════════════════════════════════
   ESTREITO DE ORMUZ — Tráfego Marítimo (AIS data)
   ══════════════════════════════════════════════════════════════ */
async function loadOrmuz(force=false){
  const el=$("ormuz-body"); if(!el)return;
  el.innerHTML=ld();
  const ck="ormuz_v2";
  let d=force?null:lsGet(ck);
  const normalizeLiveData=data=>{
    if(!data?.live) return data;
    if(!Array.isArray(data.vessels)) return null;
    const metadata=data.vessels[0]||{};
    const validVessels=data.vessels.slice(1).filter(v=>Array.isArray(v)&&v[1]!==null&&v[1]!==undefined&&v[1]!==""&&v[2]!==null&&v[2]!==undefined&&v[2]!==""&&Number.isFinite(Number(v[1]))&&Number.isFinite(Number(v[2])));
    return validVessels.length?{...data,vessels:[metadata,...validVessels]}:null;
  };

  /* Dados AIS antigos não podem continuar identificados como Live. */
  const now=Date.now();
  if(d?.live && !d.isSimulated && (!Number.isFinite(d.ts) || d.ts>now || now-d.ts>15*60*1000)) d=null;
  d=normalizeLiveData(d);

  /* Bounding box: Estreito de Ormuz (Golfo Pérsico) */
  /* Lat: 24°N - 27°N, Lon: 56°E - 58°E */
  if(!d){
    try {
      const url = "https://data.aishub.net/ws.php?username=PUBLIC&format=1&output=json&latmin=24&latmax=27&lonmin=56&lonmax=58";
      const j = await fetchJsonFirstOk(url, {}, 10000);
      if(j && j.length > 1){
        d=normalizeLiveData({ts:Date.now(),vessels:j,live:true});
        if(d) lsSet(ck,d);
      }
    } catch(e) {
      console.warn("⚠️ AISHub falhou:", e.message);
    }
  }

  /* Fallback: Gerar tráfego em tempo-real simulado se API falhar */
  if(!d || !d.live){
    const now=Date.now(), min=Math.floor(now/60000);
    const simulated=[];
    /* Gerar ~45 navios baseados na média diária */
    for(let i=0; i<45; i++){
      const seed=(min+i*137)%1440;
      const p=(seed/1440);
      const isInbound=i%2===0;

      // Rota Precisão V2: Contornando a ponta de Musandam (Omã)
      let lat, lon, hdg;
      if(isInbound){
        // Leste para Oeste (Inbound)
        lon = 59.5 - p * 7.5;
        // Sobe para contornar a ponta (lat 26.5) e depois desce para o Golfo
        if(p < 0.45) { // Aproximação
          lat = 24.2 + (p/0.45)*2.1;
          hdg = 305;
        } else if (p < 0.6) { // Curva do estreito
          lat = 26.3 + Math.sin((p-0.45)/0.15 * Math.PI/2)*0.4;
          hdg = 275;
        } else { // Dentro do Golfo
          lat = 26.7 - (p-0.6)*1.5;
          hdg = 250;
        }
        lat += (i%4)*0.06; // Separação lateral
      } else {
        // Oeste para Leste (Outbound)
        lon = 52.0 + p * 7.5;
        if(p < 0.4) { // Saindo do Golfo
          lat = 24.5 + (p/0.4)*1.6;
          hdg = 65;
        } else if (p < 0.55) { // Curva do estreito
          lat = 26.1 + Math.sin((p-0.4)/0.15 * Math.PI/2)*0.3;
          hdg = 95;
        } else { // Mar da Arábia
          lat = 26.4 - (p-0.55)*2.5;
          hdg = 135;
        }
        lat -= (i%4)*0.06; // Separação lateral
      }

      const typeIdx=i%6;
      const types=["tanker","lng","cargo","tanker","bulk","other"];
      const names=["AL GHARIYA","OCEANIC","ARCTIC VOYAGER","SEA HERO","GRACE COSMOS","MSC AMBRA"];
      simulated.push([
        1000000+i, // MMSI
        lat, lon,
        12+(i%5), // speed
        hdg,
        names[i%names.length], // name
        null,null,null,null,null,null,null,null,null,null,null,null,
        types[typeIdx] // type
      ]);
    }
    d={ts:now, vessels:[{}, ...simulated], live:true, isSimulated:true};
  }

  /* ── Dados estáticos de fallback ──
     Estatísticas do Estreito de Ormuz (fonte: EIA, IMO, Lloyd's List) */
  const VESSEL_TYPES=[
    {type:"Petroleiro",      col:"#EF4444", pct:45, ico:"🛢️", desc:"Crude oil, products"},
    {type:"Navio-tanque LNG",col:"#F59E0B", pct:18, ico:"🚢", desc:"Gás natural liquefeito"},
    {type:"Graneleiro",     col:"#10B981", pct:12, ico:"🚢", desc:"Carvão, minério, grãos"},
    {type:"Contentor",      col:"#3B82F6", pct:10, ico:"📦", desc:"Carga geral"},
    {type:"Químico",        col:"#8B5CF6", pct:8,  ico:"⚗️", desc:"Produtos químicos"},
    {type:"Outros",         col:"#6E7A96", pct:7,  ico:"🚢", desc:"Passageiros, outros"},
  ];

  const KEY_PORTS=[
    {name:"Bandar Abbas",     country:"Irão",     lat:27.18, lon:56.28, col:"#F59E0B"},
    {name:"Fujairah",         country:"EAU",       lat:25.12, lon:56.34, col:"#10B981"},
    {name:"Dubai (Jebel Ali)",country:"EAU",       lat:25.00, lon:55.03, col:"#3B82F6"},
    {name:"Abu Dhabi",        country:"EAU",       lat:24.45, lon:54.37, col:"#8B5CF6"},
    {name:"Ras Tanura",       country:"Arábia Saud",lat:26.66, lon:50.09, col:"#EF4444"},
    {name:"Al Basrah",        country:"Iraque",    lat:30.50, lon:47.85, col:"#06B6D4"},
  ];

  const STRAIT_MARKER={name:"Estreito de Ormuz", lat:25.95, lon:56.95, col:"#0EA5E9"};

  if(d?.live&&d.vessels?.length){
    /* Dados AIS em tempo real processados */
    const vessels=d.vessels.slice(1); /* primeiro elemento são metadados */
    const total=vessels.length;
    const age=Math.round((Date.now()-d.ts)/60000);

    const isSim=!!d.isSimulated;

    el.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-bottom:10px">
      <div style="background:var(--b2);border-radius:7px;padding:6px 4px;text-align:center">
        <div style="font-size:1.3rem;font-weight:800;color:#0EA5E9;line-height:1">${total}</div>
        <div style="font-size:.55rem;color:var(--t3)">Navios</div>
      </div>
      <div style="background:var(--b2);border-radius:7px;padding:6px 4px;text-align:center">
        <div style="font-size:1.3rem;font-weight:800;color:#EF4444;line-height:1">${Math.round(total*0.45)}</div>
        <div style="font-size:.55rem;color:var(--t3)">Petroleiros</div>
      </div>
      <div style="background:var(--b2);border-radius:7px;padding:6px 4px;text-align:center">
        <div style="font-size:1.3rem;font-weight:800;color:#F59E0B;line-height:1">${Math.round(total*0.18)}</div>
        <div style="font-size:.55rem;color:var(--t3)">LNG</div>
      </div>
      <div style="background:var(--b2);border-radius:7px;padding:6px 4px;text-align:center">
        <div style="font-size:1.3rem;font-weight:800;color:#10B981;line-height:1">${Math.round(total*0.12)}</div>
        <div style="font-size:.55rem;color:var(--t3)">Graneleiros</div>
      </div>
      <div style="background:var(--b2);border-radius:7px;padding:6px 4px;text-align:center">
        <div style="font-size:1.3rem;font-weight:800;color:#06B6D4;line-height:1">${age}</div>
        <div style="font-size:.55rem;color:var(--t3)">min</div>
      </div>
    </div>

    <div style="position:relative;border-radius:8px;overflow:hidden;border:1px solid var(--b);background:#0a1520;margin-bottom:10px">
      <canvas id="ormuz-map-canvas" style="width:100%;height:200px;display:block"></canvas>
      <div id="ormuz-map-tip" style="position:absolute;background:#1E2340ee;border:1px solid #3D4560;
           padding:5px 9px;border-radius:5px;font-size:.65rem;color:#DDE3F0;pointer-events:none;
           opacity:0;transition:opacity .15s;z-index:10;max-width:220px;line-height:1.5;white-space:nowrap;
           top:8px;left:8px"></div>
      <div style="position:absolute;top:6px;right:6px;background:${isSim?'#F59E0B22':'#0EA5E922'};
           border:1px solid ${isSim?'#F59E0B44':'#0EA5E944'};
           border-radius:4px;padding:2px 7px;font-family:var(--mono);font-size:.55rem;color:${isSim?'#F59E0B':'#0EA5E9'}">
        ● ${isSim?'Simulated':'Live'} · ${age}min
      </div>
    </div>

    <div style="font-size:.68rem;font-weight:700;color:var(--t2);margin-bottom:2px">Distribuição estimada por tipo</div>
    <div style="font-size:.56rem;color:var(--t3);margin-bottom:6px">Percentagens de referência; não classificadas a partir dos dados AIS.</div>
    ${VESSEL_TYPES.map(v=>`<div style="display:flex;align-items:center;justify-content:space-between;
         padding:4px 0;border-bottom:1px solid var(--b)">
      <div style="display:flex;align-items:center;gap:6px">
        <span>${v.ico}</span>
        <div>
          <div style="font-size:.67rem;color:var(--text)">${v.type}</div>
          <div style="font-size:.56rem;color:var(--t3)">${v.desc}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:.68rem;font-weight:600;color:${v.col}">${v.pct}%</div>
        <div style="font-size:.56rem;color:var(--t3)">${Math.round(total*v.pct/100)} navios</div>
      </div>
    </div>`).join("")}`;

    /* Mapa - desenhar com TopoJSON */
    (function(){
      const canvas=document.getElementById("ormuz-map-canvas");
      if(!canvas) return;
      const rect=canvas.getBoundingClientRect();
      const W=rect.width||canvas.parentElement.offsetWidth||500;
      const H=200;
      canvas.width=W; canvas.height=H;
      const ctx=canvas.getContext("2d");

      /* Bounding box do Golfo Pérsico */
      const minLon=50, maxLon=60, minLat=23, maxLat=30;

      function proj(lat,lon){
        const pad=0.05;
        const x=(lon-minLon)/(maxLon-minLon)*(W*(1-pad*2))+W*pad;
        const y=(1-(lat-minLat)/(maxLat-minLat))*(H*(1-pad*2))+H*pad;
        return [x,y];
      }

      function draw(geo){
        ctx.fillStyle="#0a1520"; ctx.fillRect(0,0,W,H);

        /* Grid */
        ctx.strokeStyle="rgba(255,255,255,0.04)"; ctx.lineWidth=0.3;
        for(let lon=52;lon<=60;lon+=2){
          const[x]=proj(26,lon);
          ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();
        }
        for(let lat=24;lat<=30;lat+=2){
          const[,y]=proj(lat,55);
          ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
        }

        /* Países */
        if(geo && geo.features){
          geo.features.forEach(f=>{
            const geom=f.geometry;
            if(!geom) return;
            const polys=geom.type==="Polygon"?[geom.coordinates]:
                         geom.type==="MultiPolygon"?geom.coordinates:[];
            polys.forEach(poly=>{
              poly.forEach(ring=>{
                let inRegion=false;
                for(let i=0;i<ring.length;i+=8){
                  const lon=ring[i][0], lat=ring[i][1];
                  if(lon>=minLon-5&&lon<=maxLon+5&&lat>=minLat-5&&lat<=maxLat+5){
                    inRegion=true; break;
                  }
                }
                if(!inRegion) return;
                ctx.beginPath();
                ring.forEach(([lon,lat],i)=>{
                  const[x,y]=proj(lat,lon);
                  if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
                });
                ctx.closePath();
                ctx.fillStyle="#1E2B4A";
                ctx.fill();
                ctx.strokeStyle="#2A3A60";
                ctx.lineWidth=0.6;
                ctx.stroke();
              });
            });
          });
        }

        /* Marcador do Estreito */
        const[straitX,straitY]=proj(STRAIT_MARKER.lat,STRAIT_MARKER.lon);
        ctx.beginPath();
        ctx.arc(straitX,straitY,8,0,Math.PI*2);
        ctx.fillStyle="#0EA5E944";
        ctx.fill();
        ctx.strokeStyle="#0EA5E9";
        ctx.lineWidth=2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(straitX,straitY,3,0,Math.PI*2);
        ctx.fillStyle="#0EA5E9";
        ctx.fill();

        /* Portos principais */
        KEY_PORTS.forEach(port=>{
          const[x,y]=proj(port.lat,port.lon);
          if(x<0||x>W||y<0||y>H) return;
          ctx.beginPath();
          ctx.arc(x,y,3,0,Math.PI*2);
          ctx.fillStyle=port.col;
          ctx.fill();
          ctx.fillStyle=port.col;
          ctx.font="bold 7px monospace";
          ctx.fillText(port.name.split(" ")[0],x+5,y+2);
        });

        /* Navios (simulados baseado em dados AIS) */
        vessels.slice(0,50).forEach(v=>{
          const lat=v[1], lon=v[2];
          if(lat===null||lat===undefined||lon===null||lon===undefined) return;
          const[x,y]=proj(lat,lon);
          if(x<0||x>W||y<0||y>H) return;
          const hdg=v[4]||0;
          const col=v[18]?.includes("tanker")?"#EF4444":
                     v[18]?.includes("cargo")?"#10B981":
                     v[18]?.includes("lng")?"#F59E0B":"#3B82F6";
          /* Triângulo direcional */
          ctx.save(); ctx.translate(x,y);
          ctx.rotate(hdg*Math.PI/180);
          ctx.beginPath();
          ctx.moveTo(0,-3); ctx.lineTo(-2,2); ctx.lineTo(2,2);
          ctx.closePath();
          ctx.fillStyle=col; ctx.globalAlpha=0.8; ctx.fill();
          ctx.globalAlpha=1; ctx.restore();
        });

        /* Tooltip */
        const tip=document.getElementById("ormuz-map-tip");
        if(tip){
          canvas.onmousemove=function(e){
            const rect=canvas.getBoundingClientRect();
            const sx=W/rect.width, sy=H/rect.height;
            const mx=(e.clientX-rect.left)*sx, my=(e.clientY-rect.top)*sy;
            let hit=null;

            /* Verificar estreito */
            const[d]=proj(STRAIT_MARKER.lat,STRAIT_MARKER.lon);
            if(Math.hypot(d-straitX,d-straitY)<12){
              /* Marca o estreito como passível de tooltip */
            }
            const distStrait=Math.hypot((mx-straitX),(my-straitY));
            if(distStrait<12){
              hit={label:`<b>${STRAIT_MARKER.name}</b><br>Passagem estratégica<br>~54km de largura`};
            }

            /* Verificar portos */
            KEY_PORTS.forEach(port=>{
              const[px,py]=proj(port.lat,port.lon);
              const dist=Math.hypot(px-mx,py-my);
              if(dist<10 && !hit){
                hit={label:`<b>${port.name}</b><br>${port.country}`};
              }
            });

            /* Verificar navios */
            vessels.slice(0,50).forEach(v=>{
              const [mmsi, lat, lon, spd, hdg, name] = v;
              const [vx, vy] = proj(lat, lon);
              const dist = Math.hypot(vx - mx, vy - my);
              if (dist < 8 && !hit) {
                const type = String(v[18]||"Vessel").toUpperCase();
                const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
                const speed=Number(spd), heading=Number(hdg);
                hit = { label: `<b>${escapeHtml(name||mmsi)}</b><br>${escapeHtml(type)}<br>${Number.isFinite(speed)?speed:"—"} kn · ${Number.isFinite(heading)?heading:"—"}°` };
              }
            });

            if(hit){
              tip.style.opacity="1";
              tip.style.left=Math.min(e.offsetX+14,rect.width-180)+"px";
              tip.style.top=Math.max(e.offsetY-10,4)+"px";
              tip.innerHTML=hit.label;
            } else tip.style.opacity="0";
          };
          canvas.onmouseleave=()=>tip.style.opacity="0";
        }
      }

      if(window._topoCache){ draw(window._topoCache); }
      else {
        ctx.fillStyle="#0a1520";ctx.fillRect(0,0,W,H);
        ctx.fillStyle="#6E7A96";ctx.font="11px monospace";ctx.textAlign="center";
        ctx.fillText("A carregar mapa...",W/2,H/2);ctx.textAlign="left";
        let tries=0;
        const wait=setInterval(()=>{
          tries++;
          if(window._topoCache){clearInterval(wait);draw(window._topoCache);return;}
          if(tries>25)clearInterval(wait);
        },200);
      }
    })();
    return;
  }

  /* ── Fallback: Estatísticas estáticas ── */
  const KPI_DATA=[
    {label:"Petróleo/dia",val:"21M bbl",sub:"~20% mundial",col:"#EF4444"},
    {label:"Navios/dia",val:"~45",sub:"em trânsito",col:"#0EA5E9"},
    {label:"LNG mundial",val:"20%",sub:"passa aqui",col:"#F59E0B"},
    {label:"Largura",val:"54km",sub:"ponto mais estreito",col:"#06B6D4"},
  ];

  el.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px">
      ${KPI_DATA.map(k=>`<div style="background:var(--b2);border-radius:8px;padding:8px 6px;text-align:center">
        <div style="font-size:1.1rem;font-weight:800;color:${k.col};line-height:1">${k.val}</div>
        <div style="font-size:.58rem;color:var(--t3)">${k.label}</div>
        <div style="font-size:.54rem;color:var(--t2);margin-top:2px">${k.sub}</div>
      </div>`).join("")}
    </div>

    <div style="position:relative;border-radius:8px;overflow:hidden;border:1px solid var(--b);background:#0a1520;margin-bottom:10px">
      <canvas id="ormuz-map-canvas" style="width:100%;height:180px;display:block"></canvas>
      <div id="ormuz-map-tip" style="position:absolute;background:#1E2340ee;border:1px solid #3D4560;
           padding:5px 9px;border-radius:5px;font-size:.65rem;color:#DDE3F0;pointer-events:none;
           opacity:0;transition:opacity .15s;z-index:10;max-width:200px;line-height:1.5;
           top:8px;left:8px"></div>
      <div style="position:absolute;top:6px;left:6px;background:#0a1520cc;border:1px solid var(--b);
           border-radius:4px;padding:3px 8px;font-family:var(--mono);font-size:.58rem;color:var(--t2)">
        🗺️ Golfo Pérsico
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <!-- Tipos de navios -->
      <div>
        <div style="font-size:.65rem;font-weight:700;color:var(--t2);margin-bottom:2px">Distribuição estimada por tipo</div>
        <div style="font-size:.54rem;color:var(--t3);margin-bottom:5px">Percentagens de referência.</div>
        ${VESSEL_TYPES.map(v=>`<div style="display:flex;align-items:center;gap:6px;padding:3px 0">
          <div style="width:8px;height:8px;border-radius:2px;background:${v.col}"></div>
          <span style="font-size:.62rem;color:var(--text);flex:1">${v.type}</span>
          <span style="font-size:.63rem;font-weight:600;color:${v.col}">${v.pct}%</span>
        </div>`).join("")}
        <div style="margin-top:6px;height:6px;border-radius:3px;overflow:hidden;display:flex">
          ${VESSEL_TYPES.map(v=>`<div style="flex:${v.pct};background:${v.col}"></div>`).join("")}
        </div>
      </div>
      <!-- Portos principais -->
      <div>
        <div style="font-size:.65rem;font-weight:700;color:var(--t2);margin-bottom:5px">Portos Regionais</div>
        ${KEY_PORTS.map(p=>`<div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid var(--b)">
          <div style="width:6px;height:6px;border-radius:50%;background:${p.col}"></div>
          <div style="flex:1">
            <div style="font-size:.63rem;color:var(--text)">${p.name}</div>
            <div style="font-size:.55rem;color:var(--t3)">${p.country}</div>
          </div>
        </div>`).join("")}
        <div style="margin-top:4px;font-size:.56rem;color:var(--t3)">
          📍 24°N-27°N, 56°E-58°E
        </div>
      </div>
    </div>`;

  /* Desenhar mapa estático */
  (function(){
    const canvas=document.getElementById("ormuz-map-canvas");
    if(!canvas) return;
    const rect=canvas.getBoundingClientRect();
    const W=rect.width||canvas.parentElement.offsetWidth||500;
    const H=180;
    canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext("2d");

    const minLon=50, maxLon=60, minLat=23, maxLat=30;
    function proj(lat,lon){
      const pad=0.05;
      const x=(lon-minLon)/(maxLon-minLon)*(W*(1-pad*2))+W*pad;
      const y=(1-(lat-minLat)/(maxLat-minLat))*(H*(1-pad*2))+H*pad;
      return [x,y];
    }

    function draw(geo){
      ctx.fillStyle="#0a1520"; ctx.fillRect(0,0,W,H);

      /* Grid */
      ctx.strokeStyle="rgba(255,255,255,0.04)"; ctx.lineWidth=0.3;
      for(let lon=52;lon<=60;lon+=2){
        const[x]=proj(26,lon);
        ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();
      }
      for(let lat=24;lat<=30;lat+=2){
        const[,y]=proj(lat,55);
        ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
      }

      /* Países */
      if(geo && geo.features){
        geo.features.forEach(f=>{
          const geom=f.geometry;
          if(!geom) return;
          const polys=geom.type==="Polygon"?[geom.coordinates]:
                       geom.type==="MultiPolygon"?geom.coordinates:[];
          polys.forEach(poly=>{
            poly.forEach(ring=>{
              let inRegion=false;
              for(let i=0;i<ring.length;i+=8){
                const lon=ring[i][0], lat=ring[i][1];
                if(lon>=minLon-5&&lon<=maxLon+5&&lat>=minLat-5&&lat<=maxLat+5){
                  inRegion=true; break;
                }
              }
              if(!inRegion) return;
              ctx.beginPath();
              ring.forEach(([lon,lat],i)=>{
                const[x,y]=proj(lat,lon);
                if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
              });
              ctx.closePath();
              ctx.fillStyle="#1E2B4A";
              ctx.fill();
              ctx.strokeStyle="#2A3A60";
              ctx.lineWidth=0.6;
              ctx.stroke();
            });
          });
        });
      }

      /* Estreito */
      const[straitX,straitY]=proj(STRAIT_MARKER.lat,STRAIT_MARKER.lon);
      /* Animação visual */
      ctx.beginPath();
      ctx.arc(straitX,straitY,12,0,Math.PI*2);
      ctx.fillStyle="#0EA5E922";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(straitX,straitY,6,0,Math.PI*2);
      ctx.fillStyle="#0EA5E944";
      ctx.fill();
      ctx.strokeStyle="#0EA5E9";
      ctx.lineWidth=2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(straitX,straitY,2,0,Math.PI*2);
      ctx.fillStyle="#0EA5E9";
      ctx.fill();

      ctx.fillStyle="#0EA5E9";
      ctx.font="bold 8px monospace";
      ctx.textAlign="center";
      ctx.fillText("ESTREITO",straitX,straitY+18);
      ctx.textAlign="left";

      /* Portos */
      KEY_PORTS.forEach(port=>{
        const[x,y]=proj(port.lat,port.lon);
        if(x<0||x>W||y<0||y>H) return;
        ctx.beginPath();
        ctx.arc(x,y,3,0,Math.PI*2);
        ctx.fillStyle=port.col;
        ctx.fill();
        ctx.fillStyle=port.col;
        ctx.font="7px monospace";
        ctx.fillText(port.name.split(" ")[0],x+5,y+3);
      });

      /* Tooltip */
      const tip=document.getElementById("ormuz-map-tip");
      if(tip){
        canvas.onmousemove=function(e){
          const rect=canvas.getBoundingClientRect();
          const sx=W/rect.width, sy=H/rect.height;
          const mx=(e.clientX-rect.left)*sx, my=(e.clientY-rect.top)*sy;

          const distStrait=Math.hypot(mx-straitX,my-straitY);
          if(distStrait<15){
            tip.style.opacity="1";
            tip.style.left=Math.min(e.offsetX+14,rect.width-180)+"px";
            tip.style.top=Math.max(e.offsetY-10,4)+"px";
            tip.innerHTML=`<b>Estreito de Ormuz</b><br>~54km largura<br>~21M bbl/dia`;
            return;
          }

          for(const port of KEY_PORTS){
            const[px,py]=proj(port.lat,port.lon);
            if(Math.hypot(px-mx,py-my)<12){
              tip.style.opacity="1";
              tip.style.left=Math.min(e.offsetX+14,rect.width-150)+"px";
              tip.style.top=Math.max(e.offsetY-10,4)+"px";
              tip.innerHTML=`<b>${port.name}</b><br>${port.country}`;
              return;
            }
          }
          tip.style.opacity="0";
        };
        canvas.onmouseleave=()=>tip.style.opacity="0";
      }
    }

    if(window._topoCache){ draw(window._topoCache); }
    else {
      ctx.fillStyle="#0a1520";ctx.fillRect(0,0,W,H);
      ctx.fillStyle="#6E7A96";ctx.font="11px monospace";ctx.textAlign="center";
      ctx.fillText("A carregar mapa...",W/2,H/2);ctx.textAlign="left";
      let tries=0;
      const wait=setInterval(()=>{
        tries++;
        if(window._topoCache){clearInterval(wait);draw(window._topoCache);return;}
        if(tries>25)clearInterval(wait);
      },200);
    }
  })();
}


window.loadOrmuz = loadOrmuz;
})();
