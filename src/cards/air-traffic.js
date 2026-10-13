/* global $, Date, IS_LOCAL_DEV, fetchJsonFirstOk, ld, lsGet, lsSet, window */
(() => {
/* ══════════════════════════════════════════════════════════════
   TRÁFEGO AÉREO — OpenSky Network
   ══════════════════════════════════════════════════════════════ */
async function loadAir(force=false){
  const el=$("air-body"); if(!el)return;
  el.innerHTML=ld();
  const ck="air_v8";
  let d=force?null:lsGet(ck);
  if(!d){
    try {
      if (IS_LOCAL_DEV) {
        const url = "https://opensky-network.org/api/states/all?lamin=36&lomin=-12&lamax=44&lomax=-5";
        const j = await fetchJsonFirstOk(url, {}, 14000, ["local"], (jj) => Array.isArray(jj?.states));
        if(j && j.states?.length){
          d={ts:Date.now(),states:j.states,live:true};
          lsSet(ck,d);
        }
      }
    } catch(e) {
      console.warn("⚠️ OpenSky falhou:", e.message);
    }
  }

  /* ── Aeroportos PT+ES com coordenadas reais ── */
  const AIRPORTS=[
    {lat:38.7756,lon:-9.1354,code:"LIS",name:"Lisboa Humberto Delgado",col:"#3B82F6"},
    {lat:41.2481,lon:-8.6814,code:"OPO",name:"Porto Francisco Sá Carneiro",col:"#8B5CF6"},
    {lat:37.0144,lon:-7.9659,code:"FAO",name:"Faro",col:"#10B981"},
    {lat:32.6897,lon:-16.7781,code:"FNC",name:"Funchal",col:"#F59E0B"},
    {lat:37.7412,lon:-25.6979,code:"PDL",name:"Ponta Delgada",col:"#06B6D4"},
    {lat:40.1561,lon:-8.4692,code:"CBP",name:"Aeródromo de Coimbra",col:"#84CC16"},
    {lat:40.4193,lon:-3.6917,code:"MAD",name:"Madrid Barajas",col:"#EF4444"},
    {lat:41.2974,lon:2.0833, code:"BCN",name:"Barcelona El Prat",col:"#F97316"},
  ];

  if(d?.live&&d.states?.length){
    const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;",
    })[char]);
    const states=d.states;
    const flying=states.filter(s=>!s[8]);
    const ground=states.filter(s=>s[8]);
    const alts=flying.filter(s=>s[7]>0).map(s=>s[7]);
    const avgAlt=alts.length?Math.round(alts.reduce((a,b)=>a+b,0)/alts.length):0;
    const vels=flying.filter(s=>s[9]>0).map(s=>s[9]*3.6);
    const avgVel=vels.length?Math.round(vels.reduce((a,b)=>a+b,0)/vels.length):0;
    const maxVel=vels.length?Math.round(Math.max(...vels)):0;

    const altBands=[
      {label:"Solo",      col:"#6E7A96", count:ground.length},
      {label:"<FL100",    col:"#8B5CF6", count:flying.filter(s=>s[7]>0&&s[7]<3048).length},
      {label:"FL100-200", col:"#3B82F6", count:flying.filter(s=>s[7]>=3048&&s[7]<6096).length},
      {label:"FL200-300", col:"#06B6D4", count:flying.filter(s=>s[7]>=6096&&s[7]<9144).length},
      {label:">FL300",    col:"#10B981", count:flying.filter(s=>s[7]>=9144).length},
    ];

    const byCtry={};
    states.forEach(s=>{const c=s[2]||"?";byCtry[c]=(byCtry[c]||0)+1;});
    const topCtry=Object.entries(byCtry).sort((a,b)=>b[1]-a[1]).slice(0,5);

    const flights=flying.filter(s=>s[1]&&s[1].trim()&&s[7]>500)
      .sort((a,b)=>(b[7]||0)-(a[7]||0)).slice(0,10);

    const AIRLINES={
      TAP:"TAP Air Portugal",RYR:"Ryanair",EZY:"easyJet",IBE:"Iberia",VLG:"Vueling",
      BAW:"British Airways",AFR:"Air France",DLH:"Lufthansa",KLM:"KLM",
      UAE:"Emirates",ETH:"Ethiopian",THY:"Turkish Airlines",AAL:"American",
      UAL:"United",DAL:"Delta",TRA:"Transavia",SWR:"SWISS",AUA:"Austrian",
      AZA:"ITA Airways",SAS:"SAS",AEE:"Aegean",NJU:"easyJet",WZZ:"Wizz Air",
    };
    function airline(cs){ return AIRLINES[cs?.slice(0,3).toUpperCase()]||""; }

    const climbing=flying.filter(s=>s[11]>2).length;
    const descending=flying.filter(s=>s[11]<-2).length;
    const age=Math.round((Date.now()-d.ts)/60000);

    const airDots=states.filter(s=>s[5]!==null&&s[5]!==undefined&&s[6]!==null&&s[6]!==undefined).map(s=>{
      const onGnd=s[8], alt=s[7]||0;
      const col=onGnd?"#6E7A96":alt>9000?"#10B981":alt>6000?"#06B6D4":alt>3000?"#3B82F6":"#8B5CF6";
      const cs=(s[1]||"").trim()||s[0];
      const fl=alt?`FL${Math.round(alt/30.48/10)*10}`:"Solo";
      const vel=s[9]?Math.round(s[9]*3.6)+"km/h":"";
      return {lat:s[6],lon:s[5],col,r:onGnd?2:3,hdg:s[10]||0,
              label:`<b>${escapeHtml(cs)}</b>${onGnd?" · Em terra":""}<br>${fl} ${vel}<br>${escapeHtml(s[2]||"")}`};
    });

    el.innerHTML=`
    <!-- KPIs compactos numa linha -->
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:10px">
      <div style="background:var(--b2);border-radius:7px;padding:6px 4px;text-align:center">
        <div style="font-size:1.3rem;font-weight:800;color:#3B82F6;line-height:1">${flying.length}</div>
        <div style="font-size:.55rem;color:var(--t3)">Em voo</div>
      </div>
      <div style="background:var(--b2);border-radius:7px;padding:6px 4px;text-align:center">
        <div style="font-size:1.3rem;font-weight:800;color:#6E7A96;line-height:1">${ground.length}</div>
        <div style="font-size:.55rem;color:var(--t3)">Em terra</div>
      </div>
      <div style="background:var(--b2);border-radius:7px;padding:6px 4px;text-align:center">
        <div style="font-size:1.3rem;font-weight:800;color:#10B981;line-height:1">▲${climbing}</div>
        <div style="font-size:.55rem;color:var(--t3)">A subir</div>
      </div>
      <div style="background:var(--b2);border-radius:7px;padding:6px 4px;text-align:center">
        <div style="font-size:1.3rem;font-weight:800;color:#EF4444;line-height:1">▼${descending}</div>
        <div style="font-size:.55rem;color:var(--t3)">A descer</div>
      </div>
      <div style="background:var(--b2);border-radius:7px;padding:6px 4px;text-align:center">
        <div style="font-size:1.3rem;font-weight:800;color:#06B6D4;line-height:1">${avgAlt?(avgAlt/1000).toFixed(1)+"k":"—"}</div>
        <div style="font-size:.55rem;color:var(--t3)">Alt.méd m</div>
      </div>
      <div style="background:var(--b2);border-radius:7px;padding:6px 4px;text-align:center">
        <div style="font-size:1.3rem;font-weight:800;color:#8B5CF6;line-height:1">${avgVel||"—"}</div>
        <div style="font-size:.55rem;color:var(--t3)">km/h méd</div>
      </div>
      <div style="background:var(--b2);border-radius:7px;padding:6px 4px;text-align:center">
        <div style="font-size:1.3rem;font-weight:800;color:#F59E0B;line-height:1">${maxVel||"—"}</div>
        <div style="font-size:.55rem;color:var(--t3)">km/h máx</div>
      </div>
    </div>

    <!-- MAPA grande + legenda + barra altitude -->
    <div style="position:relative;border-radius:8px;overflow:hidden;border:1px solid var(--b);background:#0a1020;margin-bottom:10px">
      <canvas id="air-map-canvas" style="width:100%;height:260px;display:block"></canvas>
      <div id="air-map-tip" style="position:absolute;background:#1E2340ee;border:1px solid #3D4560;
           padding:5px 9px;border-radius:5px;font-size:.65rem;color:#DDE3F0;pointer-events:none;
           opacity:0;transition:opacity .15s;z-index:10;max-width:200px;line-height:1.5;white-space:nowrap;
           top:8px;left:8px"></div>
      <!-- Badge live -->
      <div style="position:absolute;top:6px;right:6px;background:#10B98122;border:1px solid #10B98144;
           border-radius:4px;padding:2px 7px;font-family:var(--mono);font-size:.55rem;color:#10B981">
        🟢 Live · ${age}min
      </div>
    </div>

    <!-- Legenda altitude + barra distribuição -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
      ${altBands.map(b=>`<div style="display:flex;align-items:center;gap:3px;font-size:.57rem;color:var(--t3)">
        <div style="width:7px;height:7px;border-radius:50%;background:${b.col}"></div>
        <span>${b.label} <b style="color:var(--t2)">${b.count}</b></span>
      </div>`).join("")}
      <div style="flex:1;min-width:80px">
        <div style="display:flex;gap:1px;height:5px;border-radius:3px;overflow:hidden">
          ${altBands.map(b=>`<div style="flex:${b.count||0.1};background:${b.col};opacity:.8"></div>`).join("")}
        </div>
      </div>
    </div>

    <!-- Lista voos + top países lado a lado -->
    <div style="display:grid;grid-template-columns:1fr auto;gap:12px">
      <!-- Lista de voos -->
      <div>
        <div style="font-size:.65rem;font-weight:700;color:var(--t2);margin-bottom:4px">
          Voos activos · por altitude
        </div>
        <div style="display:grid;grid-template-columns:64px 38px 48px 14px 1fr;
             font-family:var(--mono);font-size:.6rem;color:var(--t3);padding:0 0 3px;
             border-bottom:1px solid var(--b);margin-bottom:2px">
          <span>Voo</span><span>FL</span><span>Vel.</span><span></span><span>Operadora</span>
        </div>
        ${flights.map(s=>{
          const cs=(s[1]||"???").trim();
          const fl=s[7]?`FL${Math.round(s[7]/30.48/10)*10}`:"—";
          const vel=s[9]?Math.round(s[9]*3.6)+"":"-";
          const vr=s[11];
          const vrIcon=vr>2?"▲":vr<-2?"▼":"→";
          const vrCol=vr>2?"#10B981":vr<-2?"#EF4444":"#6E7A96";
          const altCol=s[7]>9000?"#10B981":s[7]>6000?"#06B6D4":s[7]>3000?"#3B82F6":"#8B5CF6";
          const al=airline(cs);
          return `<div style="display:grid;grid-template-columns:64px 38px 48px 14px 1fr;
                       align-items:center;gap:4px;padding:3px 0;border-bottom:1px solid var(--b)">
            <div style="font-size:.68rem;font-weight:700;color:var(--text);
                 white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(cs)}</div>
            <div style="font-size:.63rem;color:${altCol};font-weight:600">${fl}</div>
            <div style="font-size:.6rem;color:var(--t2)">${vel}<span style="font-size:.54rem">km/h</span></div>
            <div style="font-size:.63rem;color:${vrCol}">${vrIcon}</div>
            <div style="font-size:.6rem;color:var(--t3);white-space:nowrap;overflow:hidden;
                 text-overflow:ellipsis">${escapeHtml(al||s[2]||"")}</div>
          </div>`;
        }).join("")}
      </div>
      <!-- Top países + aeroportos -->
      <div style="min-width:110px">
        <div style="font-size:.65rem;font-weight:700;color:var(--t2);margin-bottom:4px">Por país</div>
        ${topCtry.map(([c,n])=>`<div style="display:flex;justify-content:space-between;
             gap:8px;padding:3px 0;border-bottom:1px solid var(--b)">
          <span style="font-family:var(--mono);font-size:.63rem;color:var(--t3)">${escapeHtml(c)}</span>
          <span style="font-family:var(--mono);font-size:.63rem;font-weight:700;color:var(--text)">${n}</span>
        </div>`).join("")}
        <div style="font-size:.65rem;font-weight:700;color:var(--t2);margin:8px 0 4px">Aeroportos</div>
        ${AIRPORTS.filter(a=>a.code!=="MAD"&&a.code!=="BCN"&&a.lon>=-13&&a.lon<=5&&a.lat>=35&&a.lat<=44.5).map(a=>`<div style="display:flex;
             align-items:center;gap:5px;padding:2px 0;border-bottom:1px solid var(--b)">
          <div style="width:6px;height:6px;border-radius:50%;background:${a.col};flex-shrink:0"></div>
          <span style="font-family:var(--mono);font-size:.65rem;font-weight:700;color:${a.col}">${a.code}</span>
          <span style="font-size:.58rem;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.name.split(" ")[0]}</span>
        </div>`).join("")}
        <div style="font-size:.56rem;color:var(--t3);margin-top:6px">lon[-12,-5]<br>lat[36,44]</div>
      </div>
    </div>`;

    /* ── PINTAR MAPA usando TopoJSON já carregado ── */
    (function(){
      const canvas=document.getElementById("air-map-canvas");
      if(!canvas) return;

      /* Dimensões: usar width real do elemento */
      const rect=canvas.getBoundingClientRect();
      const W=rect.width||canvas.parentElement.offsetWidth||600;
      const H=260;
      canvas.width=W;
      canvas.height=H;
      const ctx=canvas.getContext("2d");

      /* Bounding box da região ibérica */
      const minLon=-13, maxLon=5, minLat=35, maxLat=44.5;

      function proj(lat,lon){
        const pad=0.02;
        const x=(lon-minLon)/(maxLon-minLon)*(W*(1-pad*2))+W*pad;
        const y=(1-(lat-minLat)/(maxLat-minLat))*(H*(1-pad*2))+H*pad;
        return [x,y];
      }

      function draw(geo){
        /* Fundo oceano */
        ctx.fillStyle="#0a1520"; ctx.fillRect(0,0,W,H);

        /* Grid subtil */
        ctx.strokeStyle="rgba(255,255,255,0.025)"; ctx.lineWidth=0.4;
        for(let lon=-12;lon<=5;lon+=3){
          const[x]=proj(37,lon);
          ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();
        }
        for(let lat=36;lat<=44;lat+=2){
          const[,y]=proj(lat,-5);
          ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
        }

        /* Países do TopoJSON */
        if(geo && geo.features){
          geo.features.forEach(f=>{
            const geom=f.geometry;
            if(!geom) return;
            const polys=geom.type==="Polygon"?[geom.coordinates]:
                         geom.type==="MultiPolygon"?geom.coordinates:[];
            polys.forEach(poly=>{
              poly.forEach(ring=>{
                /* Verificar se está na região */
                let inRegion=false;
                for(let i=0;i<ring.length;i+=8){
                  const lon=ring[i][0], lat=ring[i][1];
                  if(lon>=minLon-2&&lon<=maxLon+2&&lat>=minLat-2&&lat<=maxLat+2){
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
                ctx.lineWidth=0.7;
                ctx.stroke();
              });
            });
          });
        }

        /* Aeronaves */
        airDots.forEach(dot=>{
          const[x,y]=proj(dot.lat,dot.lon);
          if(x<-8||x>W+8||y<-8||y>H+8) return;
          const sz=dot.r===2?2.5:3.5;
          /* Glow */
          const grd=ctx.createRadialGradient(x,y,0,x,y,sz*3.5);
          grd.addColorStop(0,dot.col+"66"); grd.addColorStop(1,dot.col+"00");
          ctx.beginPath(); ctx.arc(x,y,sz*3.5,0,Math.PI*2);
          ctx.fillStyle=grd; ctx.fill();
          /* Triângulo direccional */
          ctx.save(); ctx.translate(x,y);
          ctx.rotate((dot.hdg||0)*Math.PI/180);
          ctx.beginPath();
          ctx.moveTo(0,-sz*1.8); ctx.lineTo(-sz*.9,sz); ctx.lineTo(sz*.9,sz);
          ctx.closePath();
          ctx.fillStyle=dot.col; ctx.globalAlpha=0.88; ctx.fill();
          ctx.globalAlpha=1; ctx.restore();
        });

        /* Aeroportos com coordenadas reais */
        AIRPORTS.forEach(ap=>{
          const[x,y]=proj(ap.lat,ap.lon);
          if(x<0||x>W||y<0||y>H) return;
          /* Círculo externo */
          ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2);
          ctx.fillStyle=ap.col+"33";
          ctx.strokeStyle=ap.col;
          ctx.lineWidth=1.5;
          ctx.fill(); ctx.stroke();
          /* Ponto central */
          ctx.beginPath(); ctx.arc(x,y,2.5,0,Math.PI*2);
          ctx.fillStyle=ap.col; ctx.fill();
          /* Label */
          ctx.fillStyle=ap.col;
          ctx.font="bold 9px monospace";
          ctx.shadowColor=ap.col;
          ctx.shadowBlur=4;
          ctx.fillText(ap.code, x+7, y+3);
          ctx.shadowBlur=0;
        });

        /* Tooltip */
        const tip=document.getElementById("air-map-tip");
        if(tip){
          canvas.onmousemove=function(e){
            const rect=canvas.getBoundingClientRect();
            const scaleX=W/rect.width, scaleY=H/rect.height;
            const mx=(e.clientX-rect.left)*scaleX, my=(e.clientY-rect.top)*scaleY;
            /* Aeroportos primeiro */
            let hit=null, minD=Infinity;
            AIRPORTS.forEach(ap=>{
              const[px,py]=proj(ap.lat,ap.lon);
              const dist=Math.hypot(px-mx,py-my);
              if(dist<14&&dist<minD){
                minD=dist;
                hit={label:`<b>✈ ${ap.code}</b><br>${ap.name}`};
              }
            });
            /* Depois aeronaves */
            if(!hit){
              airDots.forEach(dot=>{
                const[px,py]=proj(dot.lat,dot.lon);
                const dist=Math.hypot(px-mx,py-my);
                if(dist<14&&dist<minD){minD=dist;hit=dot;}
              });
            }
            if(hit){
              tip.style.opacity="1";
              tip.style.left=Math.min(e.offsetX+14,rect.width-210)+"px";
              tip.style.top=Math.max(e.offsetY-10,4)+"px";
              tip.innerHTML=hit.label;
            } else tip.style.opacity="0";
          };
          canvas.onmouseleave=()=>tip.style.opacity="0";
        }
      }

      /* Usar TopoJSON já em cache ou aguardar carregamento */
      if(window._topoCache){
        draw(window._topoCache);
      } else {
        /* Desenhar fundo enquanto espera */
        ctx.fillStyle="#0a1520"; ctx.fillRect(0,0,W,H);
        ctx.fillStyle="#6E7A96"; ctx.font="11px monospace";
        ctx.textAlign="center";
        ctx.fillText("A carregar mapa...",W/2,H/2);
        ctx.textAlign="left";
        /* Tentar até 5s */
        let tries=0;
        const wait=setInterval(()=>{
          tries++;
          if(window._topoCache){ clearInterval(wait); draw(window._topoCache); return; }
          if(tries>25) clearInterval(wait);
        },200);
      }
    })();

    return;
  }

  /* ── Fallback ANA 2024 ── */
  const ANA=[
    {label:"Movimentos 2024",val:"175.200",sub:"+4,2% vs 2023",col:"#3B82F6"},
    {label:"Passageiros 2024",val:"33,2M",sub:"+6,1% vs 2023",col:"#06B6D4"},
    {label:"Carga (ton) 2024",val:"158.400",sub:"+2,8% vs 2023",col:"#8B5CF6"},
    {label:"Pontualidade",val:"81,3%",sub:"voos na hora ±15min",col:"#10B981"},
  ];
  const ROTAS=[
    {dest:"Londres",cod:"LHR/LGW",freq:"~18/dia",col:"#3B82F6"},
    {dest:"Paris",cod:"CDG/ORY",freq:"~14/dia",col:"#EF4444"},
    {dest:"Frankfurt",cod:"FRA",freq:"~10/dia",col:"#F59E0B"},
    {dest:"Madrid",cod:"MAD",freq:"~12/dia",col:"#10B981"},
    {dest:"Amesterdão",cod:"AMS",freq:"~8/dia",col:"#8B5CF6"},
    {dest:"São Paulo",cod:"GRU",freq:"~5/dia",col:"#F97316"},
  ];
  el.innerHTML=`
    <div style="font-size:.65rem;color:#F59E0B;margin-bottom:8px">⚠ OpenSky indisponível · estatísticas ANA 2024</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-bottom:10px">
      ${ANA.map(x=>`<div style="background:var(--b2);border-radius:8px;padding:8px 10px">
        <div style="font-size:.6rem;color:var(--t2);margin-bottom:2px">${x.label}</div>
        <div style="font-size:1rem;font-weight:700;color:${x.col}">${x.val}</div>
        <div style="font-size:.58rem;color:var(--t3)">${x.sub}</div>
      </div>`).join("")}
    </div>
    <div style="font-size:.68rem;font-weight:600;color:var(--t2);margin-bottom:5px">Top rotas Lisboa 2024</div>
    ${ROTAS.map(r=>`<div style="display:flex;align-items:center;justify-content:space-between;
         padding:4px 0;border-bottom:1px solid var(--b)">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:6px;height:6px;border-radius:50%;background:${r.col}"></div>
        <span style="font-size:.68rem;color:var(--text)">${r.dest}</span>
        <span style="font-size:.62rem;color:var(--t3)">${r.cod}</span>
      </div>
      <span style="font-size:.67rem;color:var(--t2);font-weight:600">${r.freq}</span>
    </div>`).join("")}`;
}


window.loadAir = loadAir;
})();
