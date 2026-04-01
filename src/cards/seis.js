/* Sismos card (moved out of index.html) */
(function () {
  async function loadSeis(force = false) {
    const el = $("seis-body");
    if (!el) return;
    el.innerHTML = ld();
    const ck = "seis_v10";
    let d = force ? null : lsGet(ck);
    if (!d || !d.length) {
      const start = new Date(Date.now() - 30 * 864e5).toISOString().split("T")[0];
      const USGS_URL =
        `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson` +
        `&starttime=${start}&minlatitude=27&maxlatitude=45` +
        `&minlongitude=-32&maxlongitude=4&minmagnitude=0.5&orderby=time&limit=200`;

      let fetched = false;
      try {
        const j = await fetchJsonFirstOk(USGS_URL, {}, 12000, ["direct", "local", "allorigins", "corsproxy"], (jj) =>
          Array.isArray(jj?.features) && jj.features.length > 0,
        );
        d = j.features || [];
        if (d.length) {
          lsSet(ck, d);
          fetched = true;
        }
      } catch {
        fetched = false;
      }

      if (!fetched) {
        const stale =
          localStorage.getItem("dash_v15_" + ck) ||
          localStorage.getItem("dash_v15_seis_v9") ||
          localStorage.getItem("dash_v15_seis_v8");
        if (stale) {
          try {
            const parsed = JSON.parse(stale);
            d = parsed.d || [];
            if (d.length) {
              const age = Math.round((Date.now() - (parsed.ts || 0)) / 60000);
              el.innerHTML = `<div style="background:#F59E0B12;border:1px solid #F59E0B33;border-radius:6px;
                padding:6px 10px;font-size:.62rem;color:#F59E0B;margin-bottom:8px">
                ⚠ A usar dados em cache (há ${age}min) — API USGS temporariamente inacessível
              </div>`;
            }
          } catch {
            d = [];
          }
        }
        if (!d || !d.length) {
          el.innerHTML = `<div style="color:var(--t2);font-size:.75rem;padding:20px 0;text-align:center">
            ⚠ API USGS temporariamente inacessível (CORS)
            <div style="margin-top:8px;font-size:.65rem;color:var(--t3)">
              Tenta carregar novamente em alguns minutos.
            </div>
            <button class="rbtn" style="margin-top:10px" onclick="loadSeis(true)">↺ Tentar novamente</button>
          </div>`;
          return;
        }
      }
    }

    if (notificationSettings.sismos.enabled && d && d.length > 0) {
      const recent24h = d.filter((x) => Date.now() - x.properties.time < 24 * 60 * 60 * 1000);
      recent24h.forEach((sismo) => {
        const mag = sismo.properties.mag;
        const place = sismo.properties.place || "Localização desconhecida";
        const time = sismo.properties.time;
        const depth = sismo.geometry?.coordinates?.[2] || 0;
        if (mag >= notificationSettings.sismos.minMagnitude) {
          const notifId = `sismo-${time}`;
          const exists = notifications.find((n) => n.data?.notifId === notifId);
          if (!exists) {
            const severity = mag >= 4.5 ? "high" : mag >= 4.0 ? "medium" : "low";
            addNotification(
              "sismos",
              `Sismo de magnitude ${mag.toFixed(1)} registado`,
              `${place} • Profundidade: ${depth.toFixed(0)}km`,
              severity,
              { notifId, magnitude: mag, location: place, depth, timestamp: time },
            );
          }
        }
      });
    }

    if (!d.length) {
      el.innerHTML = `<div style="color:var(--t2);font-size:.75rem;padding:10px 0">✓ Sem sismos registados</div>`;
      return;
    }

    const d7 = d.filter((x) => Date.now() - x.properties.time < 7 * 864e5);
    const use = d7.length >= 3 ? d7 : d;
    const periodo = d7.length >= 3 ? "7 dias" : "30 dias";
    const maxMag = Math.max(...use.map((x) => x.properties.mag));
    const big = use.filter((x) => x.properties.mag >= 3).length;
    const med = use.filter((x) => x.properties.mag >= 2 && x.properties.mag < 3).length;
    const total24h = d.filter((x) => Date.now() - x.properties.time < 86400000).length;

    const seisDots = use
      .filter((f) => f.geometry?.coordinates)
      .map((f) => {
        const mag = f.properties.mag,
          c = f.geometry.coordinates;
        const col = mag >= 4 ? "#EF4444" : mag >= 3 ? "#F97316" : mag >= 2 ? "#F59E0B" : "#8B5CF6";
        const r = Math.max(4, Math.min(11, mag * 2.5));
        const dt = new Date(f.properties.time).toLocaleDateString("pt", { day: "2-digit", month: "2-digit" });
        const tm = new Date(f.properties.time).toLocaleTimeString("pt", { hour: "2-digit", minute: "2-digit" });
        return {
          lat: c[1],
          lon: c[0],
          col,
          r,
          mag,
          label: `<b>M${mag.toFixed(1)}</b><br>${(f.properties.place || "").slice(0, 38)}<br>${dt} ${tm}`,
        };
      });

    const staleWarning = el.innerHTML.includes("A usar dados em cache") ? el.innerHTML : "";

    el.innerHTML =
      staleWarning +
      `
    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-bottom:10px">
      <div style="background:var(--b2);border-radius:7px;padding:6px 4px;text-align:center">
        <div style="font-size:1.3rem;font-weight:800;color:#F59E0B;line-height:1">${use.length}</div>
        <div style="font-size:.55rem;color:var(--t3)">${periodo}</div>
      </div>
      <div style="background:var(--b2);border-radius:7px;padding:6px 4px;text-align:center">
        <div style="font-size:1.3rem;font-weight:800;color:#EF4444;line-height:1">${maxMag.toFixed(1)}</div>
        <div style="font-size:.55rem;color:var(--t3)">Máx. M</div>
      </div>
      <div style="background:var(--b2);border-radius:7px;padding:6px 4px;text-align:center">
        <div style="font-size:1.3rem;font-weight:800;color:#F97316;line-height:1">${big}</div>
        <div style="font-size:.55rem;color:var(--t3)">Mag ≥3</div>
      </div>
      <div style="background:var(--b2);border-radius:7px;padding:6px 4px;text-align:center">
        <div style="font-size:1.3rem;font-weight:800;color:#8B5CF6;line-height:1">${med}</div>
        <div style="font-size:.55rem;color:var(--t3)">Mag 2-3</div>
      </div>
      <div style="background:var(--b2);border-radius:7px;padding:6px 4px;text-align:center">
        <div style="font-size:1.3rem;font-weight:800;color:#06B6D4;line-height:1">${total24h}</div>
        <div style="font-size:.55rem;color:var(--t3)">24h</div>
      </div>
    </div>

    <!-- MAPA GRANDE full-width -->
    <div style="position:relative;border-radius:8px;overflow:hidden;border:1px solid var(--b);background:#0a1020;margin-bottom:10px">
      <canvas id="seis-map-canvas" style="width:100%;height:280px;display:block"></canvas>
      <div id="seis-map-tip" style="position:absolute;background:#1E2340ee;border:1px solid #3D4560;
           padding:5px 9px;border-radius:5px;font-size:.65rem;color:#DDE3F0;pointer-events:none;
           opacity:0;transition:opacity .15s;z-index:10;max-width:220px;line-height:1.5;
           white-space:nowrap;top:8px;left:8px"></div>
      <div style="position:absolute;top:6px;right:6px;background:#F59E0B22;border:1px solid #F59E0B44;
           border-radius:4px;padding:2px 7px;font-family:var(--mono);font-size:.55rem;color:#F59E0B">
        USGS · ${periodo}
      </div>
    </div>

    <!-- Legenda -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
      ${[
        ["#EF4444", "≥ 4.0 — Forte"],
        ["#F97316", "≥ 3.0"],
        ["#F59E0B", "≥ 2.0"],
        ["#8B5CF6", "< 2.0"],
      ]
        .map(
          ([c, l]) => `
        <div style="display:flex;align-items:center;gap:4px;font-size:.58rem;color:var(--t3)">
          <div style="width:8px;height:8px;border-radius:50%;background:${c}"></div>
          <span>${l}</span>
        </div>`,
        )
        .join("")}
    </div>

    <!-- Lista + painel lateral -->
    <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:start">
      <div>
        <div style="font-family:var(--mono);font-size:.6rem;color:var(--t3);
             text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Eventos mais recentes</div>
        <div style="display:grid;grid-template-columns:38px 1fr 80px;
             font-family:var(--mono);font-size:.58rem;color:var(--t3);
             padding:0 0 3px;border-bottom:1px solid var(--b);margin-bottom:2px;gap:6px">
          <span>Mag.</span><span>Localização</span><span style="text-align:right">Data/Hora</span>
        </div>
        ${use
          .slice(0, 10)
          .map((f) => {
            const p = f.properties,
              mag = p.mag.toFixed(1);
            const col = mag >= 4 ? "#EF4444" : mag >= 3 ? "#F97316" : mag >= 2 ? "#F59E0B" : "#8B5CF6";
            const dt = new Date(p.time);
            const dts = dt.toLocaleDateString("pt", { day: "2-digit", month: "2-digit" });
            const tms = dt.toLocaleTimeString("pt", { hour: "2-digit", minute: "2-digit" });
            const place = (p.place || "").replace(/ of /g, " ").slice(0, 42);
            return `<div style="display:grid;grid-template-columns:38px 1fr 80px;
                       align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--b)">
              <div style="background:${col}22;border:1px solid ${col}55;border-radius:4px;
                   padding:2px 4px;font-size:.72rem;font-weight:700;color:${col};text-align:center">${mag}</div>
              <div style="font-size:.65rem;color:var(--text);white-space:nowrap;
                   overflow:hidden;text-overflow:ellipsis">${place}</div>
              <div style="font-size:.6rem;color:var(--t3);text-align:right;white-space:nowrap">
                ${dts}<br>${tms}</div>
            </div>`;
          })
          .join("")}
        ${
          use.length > 10
            ? `<div style="font-size:.58rem;color:var(--t3);margin-top:4px;text-align:center">
          + ${use.length - 10} eventos em ${periodo}</div>`
            : ""
        }
      </div>
      <div style="min-width:110px">
        <div style="font-family:var(--mono);font-size:.6rem;color:var(--t3);
             text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Zonas</div>
        ${(() => {
          const zones = [
            { name: "Continente", minLat: 36.9, maxLat: 42.2, minLon: -9.5, maxLon: -6.2, col: "#3B82F6" },
            { name: "Açores", minLat: 36.5, maxLat: 40.5, minLon: -31.5, maxLon: -24.5, col: "#10B981" },
            { name: "Madeira", minLat: 32.5, maxLat: 33.2, minLon: -17.5, maxLon: -16.5, col: "#F59E0B" },
            { name: "Atlântico", minLat: 27.0, maxLat: 44.0, minLon: -24.4, maxLon: -9.5, col: "#8B5CF6" },
          ];
          return zones
            .map((z) => {
              const ev = use.filter((f) => {
                const c = f.geometry?.coordinates;
                return c && c[1] >= z.minLat && c[1] <= z.maxLat && c[0] >= z.minLon && c[0] <= z.maxLon;
              });
              const mxZ = ev.length ? Math.max(...ev.map((f) => f.properties.mag)).toFixed(1) : "—";
              return `<div style="background:var(--b2);border-radius:6px;padding:5px 7px;
                   margin-bottom:4px;border-left:2px solid ${z.col}">
                <div style="font-size:.65rem;font-weight:600;color:${z.col}">${z.name}</div>
                <div style="font-size:.6rem;color:var(--t3)">${ev.length} eventos</div>
                <div style="font-size:.6rem;color:var(--t2)">máx M${mxZ}</div>
              </div>`;
            })
            .join("");
        })()}
      </div>
    </div>`;

    (function () {
      const canvas = document.getElementById("seis-map-canvas");
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const W = rect.width || canvas.parentElement.offsetWidth || 600;
      const H = 280;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      const minLon = -32,
        maxLon = 5,
        minLat = 26,
        maxLat = 46;
      function proj(lat, lon) {
        const pad = 0.02;
        const x = ((lon - minLon) / (maxLon - minLon)) * (W * (1 - pad * 2)) + W * pad;
        const y = (1 - (lat - minLat) / (maxLat - minLat)) * (H * (1 - pad * 2)) + H * pad;
        return [x, y];
      }
      function draw(geo) {
        ctx.fillStyle = "#0a1520";
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(255,255,255,0.025)";
        ctx.lineWidth = 0.4;
        for (let lon = -30; lon <= 4; lon += 5) {
          const [x] = proj(35, lon);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, H);
          ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.font = "7px monospace";
          ctx.fillText(lon + "°", x + 2, H - 3);
        }
        for (let lat = 28; lat <= 44; lat += 4) {
          const [, y] = proj(lat, -5);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(W, y);
          ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.fillText(lat + "°", 2, y - 2);
        }
        if (geo && geo.features) {
          geo.features.forEach((f) => {
            const geom = f.geometry;
            if (!geom) return;
            const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
            polys.forEach((poly) => {
              poly.forEach((ring) => {
                let inView = false;
                for (let i = 0; i < ring.length; i += 8) {
                  if (ring[i][0] >= minLon - 2 && ring[i][0] <= maxLon + 2 && ring[i][1] >= minLat - 2 && ring[i][1] <= maxLat + 2) {
                    inView = true;
                    break;
                  }
                }
                if (!inView) return;
                ctx.beginPath();
                ring.forEach(([lon, lat], i) => {
                  const [x, y] = proj(lat, lon);
                  if (i === 0) ctx.moveTo(x, y);
                  else ctx.lineTo(x, y);
                });
                ctx.closePath();
                ctx.fillStyle = "#1E2B4A";
                ctx.fill();
                ctx.strokeStyle = "#2A3A60";
                ctx.lineWidth = 0.7;
                ctx.stroke();
              });
            });
          });
        }
        [
          { lat: 39.5, lon: -8.0, txt: "Portugal" },
          { lat: 39.0, lon: -3.5, txt: "Espanha" },
          { lat: 38.7, lon: -27.5, txt: "Açores" },
          { lat: 32.7, lon: -17.0, txt: "Madeira" },
        ].forEach((l) => {
          const [x, y] = proj(l.lat, l.lon);
          ctx.fillStyle = "rgba(110,122,150,0.65)";
          ctx.font = "italic 9px sans-serif";
          ctx.fillText(l.txt, x, y);
        });
        seisDots.forEach((dot) => {
          const [x, y] = proj(dot.lat, dot.lon);
          if (x < -10 || x > W + 10 || y < -10 || y > H + 10) return;
          const grd = ctx.createRadialGradient(x, y, 0, x, y, dot.r * 3.5);
          grd.addColorStop(0, dot.col + "66");
          grd.addColorStop(1, dot.col + "00");
          ctx.beginPath();
          ctx.arc(x, y, dot.r * 3.5, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x, y, dot.r, 0, Math.PI * 2);
          ctx.fillStyle = dot.col;
          ctx.globalAlpha = 0.85;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "rgba(255,255,255,0.3)";
          ctx.lineWidth = 0.6;
          ctx.stroke();
          if (dot.mag >= 4.0) {
            ctx.fillStyle = "#fff";
            ctx.font = "bold 8px monospace";
            ctx.textAlign = "center";
            ctx.fillText("M" + dot.mag.toFixed(1), x, y - dot.r - 3);
            ctx.textAlign = "left";
          }
        });
        const tip = document.getElementById("seis-map-tip");
        if (tip) {
          canvas.onmousemove = function (e) {
            const rect = canvas.getBoundingClientRect();
            const sx = W / rect.width,
              sy = H / rect.height;
            const mx = (e.clientX - rect.left) * sx,
              my = (e.clientY - rect.top) * sy;
            let hit = null,
              minD = Infinity;
            seisDots.forEach((dot) => {
              const [px, py] = proj(dot.lat, dot.lon);
              const dist = Math.hypot(px - mx, py - my);
              if (dist < Math.max(dot.r + 8, 14) && dist < minD) {
                minD = dist;
                hit = dot;
              }
            });
            if (hit) {
              tip.style.opacity = "1";
              tip.style.left = Math.min(e.offsetX + 14, rect.width - 230) + "px";
              tip.style.top = Math.max(e.offsetY - 10, 4) + "px";
              tip.innerHTML = hit.label;
            } else tip.style.opacity = "0";
          };
          canvas.onmouseleave = () => (tip.style.opacity = "0");
        }
      }
      if (window._topoCache) draw(window._topoCache);
      else {
        ctx.fillStyle = "#0a1520";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#6E7A96";
        ctx.font = "11px monospace";
        ctx.textAlign = "center";
        ctx.fillText("A carregar mapa...", W / 2, H / 2);
        ctx.textAlign = "left";
        let tries = 0;
        const wait = setInterval(() => {
          tries++;
          if (window._topoCache) {
            clearInterval(wait);
            draw(window._topoCache);
            return;
          }
          if (tries > 25) clearInterval(wait);
        }, 200);
      }
    })();
  }

  window.loadSeis = loadSeis;
})();

