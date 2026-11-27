/* Grelha em mosaico: cada card ocupa só as linhas de que precisa.
   A grelha usa linhas de 2px (grid-auto-rows) e row-gap 0.
   - Ecrã largo (6 colunas): o JavaScript arruma os cards um a um na posição
     livre mais alta (packMosaic). Um card que deixaria um buraco pode ceder a
     vez aos 2 seguintes (no máximo 2 vezes). No fim, o último card de cada
     coluna estica até ao fundo da secção (min-height), sem degraus.
   - Grelhas estreitas: cada card recebe grid-row-end: span N e o CSS
     (grid-auto-flow: dense) encaixa-os.
   Sem JavaScript (ou sem ResizeObserver) a grelha volta ao modo normal. */
(function () {
  "use strict";
  const ROW_PX = 2;
  const LOOKAHEAD = 3;
  const MAX_SKIPS = 2;
  const MIN_GAIN_PX = 8;
  const grids = () => Array.from(document.querySelectorAll("[data-section-grid]"));
  let scheduled = 0;

  function gapOf(grid) {
    const value = window.getComputedStyle(grid).getPropertyValue("--grid-gap");
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 12;
  }

  function columnCount(grid) {
    const tpl = window.getComputedStyle(grid).gridTemplateColumns || "";
    return tpl.split(" ").filter(Boolean).length || 1;
  }

  /** Posição mais alta onde cabe um card de `span` colunas (empate: mais à esquerda). */
  function bestSlot(sky, span) {
    let best = null;
    for (let start = 0; start + span <= sky.length; start++) {
      const top = Math.max(...sky.slice(start, start + span));
      if (!best || top < best.top) best = { start, top };
    }
    return best;
  }

  /**
   * Arruma cards {span, height} em `cols` colunas. Devolve, pela ordem de entrada,
   * {start, top, rows, fill} em px; `height` total inclui o último espaçamento.
   */
  function packMosaic(cards, cols, gap) {
    const sky = new Array(cols).fill(0);
    const queue = cards.map((card, index) => ({ ...card, span: Math.min(Math.max(1, card.span), cols), index, skips: 0 }));
    const placed = new Array(cards.length);
    while (queue.length) {
      let pick = 0;
      let slot = bestSlot(sky, queue[0].span);
      if (queue[0].skips < MAX_SKIPS) {
        for (let i = 1; i < Math.min(LOOKAHEAD, queue.length); i++) {
          const candidate = bestSlot(sky, queue[i].span);
          if (candidate.top < slot.top - MIN_GAIN_PX) { pick = i; slot = candidate; }
        }
      }
      if (pick > 0) for (let i = 0; i < pick; i++) queue[i].skips++;
      const card = queue.splice(pick, 1)[0];
      const footprint = Math.ceil((card.height + gap) / ROW_PX) * ROW_PX;
      for (let c = slot.start; c < slot.start + card.span; c++) sky[c] = slot.top + footprint;
      placed[card.index] = { start: slot.start, span: card.span, top: slot.top, rows: footprint / ROW_PX, fill: false };
    }
    const height = Math.max(0, ...sky);
    // Fundo alinhado: estica o card que é o último em todas as colunas que ocupa
    // (exceto cards marcados noFill: em erro ou ainda sem dados ficariam quase vazios).
    placed.forEach((p, i) => {
      if (cards[i].noFill) return;
      let last = true;
      for (let c = p.start; c < p.start + p.span; c++) if (sky[c] !== p.top + p.rows * ROW_PX) last = false;
      if (last && p.top + p.rows * ROW_PX < height) {
        p.rows = (height - p.top) / ROW_PX;
        p.fill = true;
      }
    });
    return { placed, height };
  }

  function naturalSpan(item, cols) {
    const style = window.getComputedStyle(item);
    const end = style.gridColumnEnd || "";
    if (style.gridColumnStart === "1" && end === "-1") return cols;
    // "grid-column: span 2" fica em grid-column-start; "x / span 2" fica em grid-column-end.
    const match = /span\s+(\d+)/.exec(`${style.gridColumnStart} ${end}`);
    return match ? Number(match[1]) : 1;
  }

  /** Card com dados (ao vivo ou em cache)? Em erro, a carregar ou sem estado: não esticar. */
  function hasData(item) {
    const status = item.querySelector(".card-status[data-status-for]");
    if (!status) return true;
    return !["error", "loading", "idle"].includes(status.dataset.state);
  }

  function outerHeight(item) {
    const style = window.getComputedStyle(item);
    return item.getBoundingClientRect().height + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
  }

  function layoutGrid(grid) {
    const gap = gapOf(grid);
    const cols = columnCount(grid);
    const items = Array.from(grid.children).filter((item) => item.offsetParent !== null);
    if (cols < 6) {
      items.forEach((item) => {
        item.style.minHeight = "";
        delete item.dataset.gridFill;
        item.style.gridColumn = "";
        item.style.gridRowStart = "";
        const span = Math.max(1, Math.ceil((outerHeight(item) + gap) / ROW_PX));
        const next = `span ${span}`;
        if (item.style.gridRowEnd !== next) item.style.gridRowEnd = next;
      });
      return;
    }
    // Medir sem esticar e com a largura natural de cada card.
    items.forEach((item) => {
      item.style.minHeight = "";
      item.style.gridColumn = "";
      item.style.gridRowStart = "";
      item.style.gridRowEnd = "";
    });
    const cards = items.map((item) => ({ span: naturalSpan(item, cols), noFill: !hasData(item) }));
    items.forEach((item, i) => {
      item.style.gridColumn = `span ${cards[i].span}`;
    });
    items.forEach((item, i) => { cards[i].height = outerHeight(item); });
    const { placed } = packMosaic(cards, cols, gap);
    items.forEach((item, i) => {
      const p = placed[i];
      item.style.gridColumn = `${p.start + 1} / span ${p.span}`;
      item.style.gridRowStart = String(p.top / ROW_PX + 1);
      item.style.gridRowEnd = `span ${p.rows}`;
      // Esticar com min-height (não com align-self): se o conteúdo crescer, o card cresce e o ResizeObserver vê.
      if (p.fill) {
        item.style.minHeight = `${Math.floor(p.rows * ROW_PX - gap - (cards[i].height - item.getBoundingClientRect().height))}px`;
        item.dataset.gridFill = "true";
      } else {
        delete item.dataset.gridFill;
      }
    });
  }

  function schedule() {
    if (scheduled) return;
    scheduled = window.requestAnimationFrame(() => {
      scheduled = 0;
      grids().forEach(layoutGrid);
    });
  }

  function init() {
    if (typeof window.ResizeObserver !== "function") return;
    document.documentElement.classList.add("masonry");
    // O ResizeObserver só avisa quando o tamanho final muda; medir e repor no mesmo frame não o dispara.
    const resize = new window.ResizeObserver(schedule);
    const observeChildren = (grid) => Array.from(grid.children).forEach((child) => resize.observe(child));
    const statusChanges = new window.MutationObserver(schedule);
    const watchStatus = (grid) => statusChanges.observe(grid, { subtree: true, attributes: true, attributeFilter: ["data-state"] });
    const mutations = new window.MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (node.nodeType === 1) resize.observe(node);
      }));
      schedule();
    });
    grids().forEach((grid) => {
      observeChildren(grid);
      watchStatus(grid);
      mutations.observe(grid, { childList: true });
    });
    window.addEventListener("resize", schedule);
    schedule();
  }

  window.relayoutDashboardGrid = schedule;
  window.packMosaic = packMosaic;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
