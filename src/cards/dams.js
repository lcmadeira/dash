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
    el.innerHTML = `<div style="padding:20px;text-align:center;color:var(--t3);font-size:.7rem">${window.ld()}</div>`;
    try {
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
            && Number.isFinite(basin.val) && Number.isFinite(basin.avg))
          && Number.isFinite(lastKnown.totalVal) && Number.isFinite(lastKnown.totalAvg)) {
        cache = lastKnown;
        const observed = Number.isFinite(lastKnown.ts) && lastKnown.ts > 0
          ? new Date(lastKnown.ts).toLocaleString("pt-PT") : "data desconhecida";
        window.setCardStatus?.("dams", "stale", "SNIRH indisponível", {
          title: `A mostrar a última leitura guardada: ${observed}`,
          force: true,
        });
        const staleNotice = `<div style="padding:8px 10px;font-size:.58rem;color:#F59E0B;margin-bottom:6px;border-bottom:1px solid var(--b)">
          ⚠️ SNIRH indisponível · última leitura guardada: ${observed}
        </div>`;
        renderDams(cache, staleNotice);
        return;
      }
      window.setCardStatus?.("dams", "error", "SNIRH indisponível", {
        title: "Sem observação atual nem cache verificável.",
        force: true,
      });
      el.innerHTML = `<div style="padding:14px 10px;font-size:.7rem;color:var(--t3);line-height:1.5">
        <strong style="color:#F59E0B">SNIRH indisponível</strong><br>
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

  const { basins, totalVal, totalAvg } = data;
  const isCritical = basins.some(b => b.val < 30);

  let html = statusHtml + `
    <div style="margin-bottom:12px;background:var(--b2);padding:10px;border-radius:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:6px">
        <div style="font-size:.54rem;color:var(--t3);text-transform:uppercase;letter-spacing:.5px">Média Nacional (Armazenamento)</div>
        <div style="font-size:1rem;font-weight:900;color:var(--blue)">${totalVal.toFixed(1)}%</div>
      </div>
      <div style="height:10px;background:var(--b);border-radius:5px;overflow:hidden;position:relative">
        <div style="position:absolute;left:${totalAvg}%;top:0;bottom:0;width:2px;background:var(--red);z-index:2;opacity:.6" title="Média histórica: ${totalAvg.toFixed(1)}%"></div>
        <div style="height:100%;width:${totalVal}%;background:linear-gradient(90deg, #3B82F6, #06B6D4);border-radius:5px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:5px">
        <div style="font-size:.52rem;color:var(--t3)">Média histórica: <b>${totalAvg.toFixed(1)}%</b></div>
        <div style="font-size:.52rem;color:var(--t3)">${basins.length} bacias monitorizadas</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
  `;

  /* Mostrar bacias ordenadas por volume (mais vazias primeiro para destaque) */
  const sorted = [...basins].sort((a,b) => a.val - b.val);

  sorted.slice(0, 8).forEach(b => {
    const col = b.val < 30 ? "var(--red)" : b.val < 50 ? "var(--orange)" : "var(--blue)";
    const bg = b.val < 30 ? "rgba(239,68,68,0.08)" : "var(--b2)";
    html += `
      <div style="background:${bg};padding:6px 8px;border-radius:8px;border:1px solid ${col}15;border-left:3px solid ${col}">
        <div style="font-size:.58rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.name}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px">
          <div style="font-family:var(--mono);font-size:.78rem;font-weight:800;color:${col}">${b.val.toFixed(0)}%</div>
          <div style="font-size:.48rem;color:var(--t3)">Méd. ${b.avg.toFixed(0)}%</div>
        </div>
      </div>
    `;
  });

  html += `</div>
    <div style="margin-top:10px;padding-top:6px;border-top:1px solid var(--b2);font-size:.52rem;color:var(--t3);display:flex;justify-content:space-between;align-items:center">
      <span>APA / SNIRH · Resumo Semanal</span>
      <span class="badge ${isCritical?'warn':'live'}" style="font-size:.48rem">${isCritical ? "⚠️ ALERTA SECA" : "● NÍVEIS OK"}</span>
    </div>
  `;

  el.innerHTML = html;
}

window.loadDams = loadDams;
