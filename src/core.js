/* dash core utils (loaded before index.html inline script) */
(function () {
  const escHtml = (v) =>
    String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  window.$ = (id) => document.getElementById(id);
  window.ld = () => `<div class="ld"><div class="spin"></div></div>`;
  window.er = (m, opts = {}) => {
    const o = (m && typeof m === "object" && !(m instanceof Error) && Object.keys(opts).length === 0) ? m : opts;
    const rawMsg = m instanceof Error ? m.message : (typeof m === "string" ? m : o?.message);
    const context = o?.context ? `${escHtml(o.context)}: ` : "";
    const msg = escHtml(rawMsg || "erro inesperado");
    const action = o?.action ? `<br><span style="color:var(--t2)">Sugestão: ${escHtml(o.action)}</span>` : "";
    return `<p class="err" role="status" aria-live="polite" aria-atomic="true">⚠ ${context}${msg}${action}</p>`;
  };
  const errToastLastShown = new Map();
  window.notifyNonCriticalError = (context, err, action = "clique em ↺ para tentar novamente") => {
    try {
      const message = err instanceof Error ? err.message : String(err || "erro inesperado");
      const key = `${context || "erro"}::${message}`;
      const now = Date.now();
      const prev = errToastLastShown.get(key) || 0;
      if (now - prev < 12000) return; // Evita spam de toasts repetidos
      errToastLastShown.set(key, now);

      const container = document.getElementById("toastContainer");
      if (!container) return;

      const toast = document.createElement("div");
      toast.className = "toast type-error";
      toast.innerHTML = `
        <div class="toast-progress"></div>
        <div class="toast-icon" aria-hidden="true">⚠️</div>
        <div class="toast-content">
          <div class="toast-title">${escHtml(context || "Erro não crítico")}</div>
          <div class="toast-message">${escHtml(message)}<br><span style="color:var(--t2)">Sugestão: ${escHtml(action)}</span></div>
        </div>
        <button class="toast-close" aria-label="Fechar aviso">✕</button>
      `;

      const closeBtn = toast.querySelector(".toast-close");
      if (closeBtn) {
        closeBtn.onclick = (e) => {
          e.stopPropagation();
          toast.classList.add("hiding");
          setTimeout(() => toast.remove(), 300);
        };
      }

      container.appendChild(toast);
      setTimeout(() => {
        if (toast.parentElement) {
          toast.classList.add("hiding");
          setTimeout(() => toast.remove(), 300);
        }
      }, 5200);
    } catch {
      // Falha silenciosa: não interromper fluxo da UI
    }
  };
  window.chg = (v, d = 2) => {
    if (v == null) return "";
    const c = v > 0 ? "up" : v < 0 ? "dn" : "fl";
    const s = v > 0 ? "▲" : v < 0 ? "▼" : "—";
    return `<span class="${c}">${s}&nbsp;${Math.abs(v).toFixed(d)}%</span>`;
  };
  window.fmtP = (v, d = 2) =>
    Number(v).toLocaleString("pt-PT", {
      minimumFractionDigits: d,
      maximumFractionDigits: Math.max(d, 4),
    });

  window.DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  window.DAY_NAMES_LONG = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  window.MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  // A11y: permite ativação por Enter/Espaço em elementos com role="button"
  document.addEventListener("keydown", (ev) => {
    const t = ev.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.getAttribute("role") !== "button") return;
    if (ev.key !== "Enter" && ev.key !== " ") return;
    ev.preventDefault();
    t.click();
  });
})();

