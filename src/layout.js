/* Grelha em mosaico: cada card ocupa só as linhas de que precisa.
   A grelha usa linhas de 2px (grid-auto-rows) e cada card recebe
   grid-row-end: span N calculado a partir da sua altura real; com
   grid-auto-flow: dense os cards encaixam nos espaços livres da coluna.
   Sem JavaScript (ou sem ResizeObserver) a grelha volta ao modo normal. */
(function () {
  "use strict";
  const ROW_PX = 2;
  const grids = () => Array.from(document.querySelectorAll("[data-section-grid]"));
  let scheduled = 0;

  function gapOf(grid) {
    const value = window.getComputedStyle(grid).getPropertyValue("--grid-gap");
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 12;
  }

  function layoutGrid(grid) {
    const gap = gapOf(grid);
    Array.from(grid.children).forEach((item) => {
      if (item.offsetParent === null) return;
      const height = item.getBoundingClientRect().height;
      const span = Math.max(1, Math.ceil((height + gap) / ROW_PX));
      const next = `span ${span}`;
      if (item.style.gridRowEnd !== next) item.style.gridRowEnd = next;
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
    const resize = new window.ResizeObserver(schedule);
    const observeChildren = (grid) => Array.from(grid.children).forEach((child) => resize.observe(child));
    const mutations = new window.MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (node.nodeType === 1) resize.observe(node);
      }));
      schedule();
    });
    grids().forEach((grid) => {
      observeChildren(grid);
      mutations.observe(grid, { childList: true });
    });
    window.addEventListener("resize", schedule);
    schedule();
  }

  window.relayoutDashboardGrid = schedule;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
