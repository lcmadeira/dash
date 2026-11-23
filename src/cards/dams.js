/* src/cards/dams.js — Dados SNIRH (Barragens) */

/** Carrega os níveis das bacias do SNIRH, usando cache e fallback estático quando necessário.
 * @param {boolean} [force=false] Se true, ignora o cache válido e volta a consultar a fonte.
 * @returns {Promise<void>}
 */
function loadDams(force = false) {
  const run = window.runSingleFlight || ((_key, task) => Promise.resolve().then(task));
  return run("card:dams", () => loadDamsOnce(force));
}

async function loadDamsOnce(force = false) {
  const el = document.getElementById("dams-body");
  if (!el) return;
  
  const CK = "dams_v1";
  const lastKnown = window.lsGet(CK);
  let cache = force ? null : lastKnown;

  if (!cache) {
    el.innerHTML = `<div style="padding:20px;text-align:center;color:var(--t3);font-size:.74rem">${window.ld()}</div>`;
    try {
      /* 1. Gateway próprio (tabela mensal do SNIRH lida no servidor, com cópia de reserva).
         2. data/dams.json do próprio site, atualizado por scripts/update-dams.mjs
            (o SNIRH recusa servidores; corre no portátil do utilizador, via cron). */
      const damsSources = [
        window.dataApiUrl?.("v1/dams"),
        window.location?.href ? new URL("data/dams.json", window.location.href).href : null,
      ].filter(Boolean);
      for (const sourceUrl of damsSources) {
        if (cache) break;
        try {
          const payload = await window.fetchJsonFirstOk(sourceUrl, { cache: "no-cache" }, 15000, ["direct"],
            (p) => Array.isArray(p?.basins) && p.basins.length >= 8 && Number.isFinite(p?.totalVal));
          cache = {
            basins: payload.basins.map((b) => ({ name: String(b.name), val: Number(b.val), avg: Number.isFinite(b.avg) ? Number(b.avg) : null })),
            totalVal: payload.totalVal,
            totalAvg: Number.isFinite(payload.totalAvg) ? payload.totalAvg : null,
            period: payload.period, hydroYear: payload.hydroYear, month: payload.month,
            ts: Date.now(),
          };
          window.lsSet(CK, cache, {
            source: payload._meta?.source || "SNIRH · APA",
            state: payload._meta?.state === "stale" ? "stale" : "live",
            observedAt: payload._meta?.observedAt,
          });
        } catch (sourceError) {
          console.debug?.("Dams: fonte indisponível", sourceUrl, sourceError?.message || sourceError);
        }
      }
      if (cache) { window.refreshCardStatusFromCache?.("dams", CK); renderDams(cache); return; }

      /* 2. Alternativa antiga (proxies públicos sobre a página do SNIRH). */
      const url = "https://snirh.apambiente.pt/index.php?idMain=1&idItem=1.3";
      /* Tentar obter o HTML via proxy */
      const r = await window.fetchWithCORS(url, { cache: "no-store" }, 8000);
      const html = await r.text();

      if (!html || html.length < 500) throw new Error("Resposta do servidor insuficiente");

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      
      /* Procurar todas as tabelas e encontrar a que tem os dados das bacias */
      const tables = Array.from(doc.querySelectorAll("table"));
      let targetTable = null;
      
      for (const t of tables) {
        const txt = t.textContent;
        /* Ser mais flexível na procura da tabela: pode ter nomes de bacias conhecidos */
        const hasBasinKeywords = ["Douro", "Tejo", "Guadiana", "Cávado"].some(k => txt.includes(k));
        if ((txt.includes("Bacia") || hasBasinKeywords) && txt.includes("%")) {
          targetTable = t;
          break;
        }
      }

      if (!targetTable) {
        console.debug("Dams: HTML structure:", html.slice(0, 500));
        throw new Error("Tabela de dados não encontrada no HTML");
      }

      const rows = Array.from(targetTable.querySelectorAll("tr")).filter(r => {
        const c = r.cells;
        return c.length >= 4 && !r.textContent.includes("Bacia") && !isNaN(parseFloat(c[2].textContent.replace(",", ".")));
      });

      const basins = [];
      rows.forEach(row => {
        const cols = row.querySelectorAll("td");
        const name = cols[0].textContent.trim().replace(/\s+/g, " ");
        const val = parseFloat(cols[2].textContent.replace(",", "."));
        const avg = parseFloat(cols[3].textContent.replace(",", "."));
        if (!isNaN(val) && name && name.length > 2) {
          basins.push({ name, val, avg });
        }
      });

      if (basins.length === 0) throw new Error("Não foi possível extrair dados das bacias");

      const totalVal = basins.reduce((a, b) => a + b.val, 0) / basins.length;
      const totalAvg = basins.reduce((a, b) => a + b.avg, 0) / basins.length;

      cache = { basins, totalVal, totalAvg, ts: Date.now() };
      window.lsSet(CK, cache);
    } catch (e) {
      console.warn("⚠️ Dams error:", e.message);
      if (lastKnown && Array.isArray(lastKnown.basins) && lastKnown.basins.length > 0
          && lastKnown.basins.every(basin => typeof basin?.name === "string"
            && Number.isFinite(basin.val) && (basin.avg === null || Number.isFinite(basin.avg)))
          && Number.isFinite(lastKnown.totalVal) && (lastKnown.totalAvg === null || Number.isFinite(lastKnown.totalAvg))) {
        cache = lastKnown;
        const observed = Number.isFinite(lastKnown.ts) && lastKnown.ts > 0
          ? new Date(lastKnown.ts).toLocaleString("pt-PT") : "data desconhecida";
        window.setCardStatus?.("dams", "stale", "SNIRH indisponível", {
          title: `A mostrar a última leitura guardada: ${observed}`,
          force: true,
        });
        const staleNotice = `<div style="padding:8px 10px;font-size:.74rem;color:var(--amber);margin-bottom:6px;border-bottom:1px solid var(--b)">
          ⚠️ SNIRH indisponível · última leitura guardada: ${window.nfr(observed)}
        </div>`;
        renderDams(cache, staleNotice);
        return;
      }
      window.setCardStatus?.("dams", "error", "SNIRH indisponível", {
        title: "Sem observação atual nem cache verificável.",
        force: true,
      });
      el.innerHTML = `<div style="padding:14px 10px;font-size:.74rem;color:var(--t3);line-height:1.5">
        <strong style="color:var(--amber)">SNIRH indisponível</strong><br>
        Sem uma observação verificável, não há valores de armazenamento para apresentar.
        <div style="margin-top:6px"><a href="https://snirh.apambiente.pt/index.php?idMain=1&amp;idItem=1.3" target="_blank" rel="noopener noreferrer">Consultar dados do SNIRH</a></div>
      </div>`;
      return;
    }
  }

  renderDams(cache);
}

/** Desenha o resumo nacional e as oito bacias com menor armazenamento.
 * @param {{basins: {name: string, val: number, avg: number}[], totalVal: number, totalAvg: number}} data Dados calculados pelo carregador.
 */
function renderDams(data, statusHtml = "") {
  const el = document.getElementById("dams-body");
  if (!el || !data) return;

  const { basins, totalVal } = data;
  const totalAvg = Number.isFinite(data.totalAvg) ? data.totalAvg : null;
  const MONTHS = { OUT: "out.", NOV: "nov.", DEZ: "dez.", JAN: "jan.", FEV: "fev.", MAR: "mar.", ABR: "abr.", MAI: "mai.", JUN: "jun.", JUL: "jul.", AGO: "ago.", SET: "set." };
  const periodLabel = data.month ? `${MONTHS[data.month] || data.month} · ano hidrológico ${data.hydroYear || ""}`.trim() : "";
  const isCritical = basins.some(b => b.val < 30);

  let html = statusHtml + `
    <div style="margin-bottom:12px;background:var(--b2);padding:10px;border-radius:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:6px">
        <div style="font-size:.74rem;color:var(--t3);text-transform:uppercase;letter-spacing:.5px">Armazenamento nacional</div>
        <div style="font-size:1rem;font-weight:900;color:var(--blue)">${window.nf(totalVal, 1)}%</div>
      </div>
      <div style="height:10px;background:var(--b);border-radius:5px;overflow:hidden;position:relative">
        ${totalAvg !== null ? `<div style="position:absolute;left:${totalAvg}%;top:0;bottom:0;width:2px;background:var(--text);z-index:2;opacity:.7" title="Média histórica: ${window.nf(totalAvg, 1)}%"></div>` : ""}
        <div style="height:100%;width:${totalVal}%;background:var(--data);border-radius:5px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:5px">
        <div style="font-size:.74rem;color:var(--t3)">${totalAvg !== null ? `Média histórica: <b>${window.nf(totalAvg, 1)}%</b>` : "Média histórica indisponível"}</div>
        <div style="font-size:.74rem;color:var(--t3)">${window.nfr(basins.length)} bacias monitorizadas</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
  `;

  /* Mostrar bacias ordenadas por volume (mais vazias primeiro para destaque) */
  const sorted = [...basins].sort((a,b) => a.val - b.val);

  sorted.forEach(b => {
    const col = b.val < 30 ? "var(--red)" : b.val < 50 ? "var(--orange)" : "var(--blue)";
    const bg = b.val < 30 ? "rgba(239,68,68,0.08)" : "var(--b2)";
    html += `
      <div style="background:${bg};padding:6px 8px;border-radius:8px;border:1px solid var(--b);border-left:3px solid ${col}">
        <div style="font-size:.74rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.name}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px">
          <div style="font-family:var(--mono);font-size:.78rem;font-weight:800;color:${col}">${window.nf(b.val, 0)}%</div>
          <div style="font-size:.74rem;color:var(--t3)">${Number.isFinite(b.avg) ? `Méd. ${window.nf(b.avg, 0)}%` : ""}</div>
        </div>
      </div>
    `;
  });

  html += `</div>
    <div style="margin-top:10px;padding-top:6px;border-top:1px solid var(--b2);font-size:.74rem;color:var(--t3);display:flex;justify-content:space-between;align-items:center">
      <span>APA / SNIRH · boletim mensal${periodLabel ? ` · ${periodLabel}` : ""} · total ponderado pela capacidade</span>
      <span class="badge ${isCritical?'warn':'live'}" style="font-size:.74rem">${isCritical ? "⚠️ ALERTA SECA" : "● NÍVEIS OK"}</span>
    </div>
  `;

  el.innerHTML = html;
}

window.loadDams = loadDams;
