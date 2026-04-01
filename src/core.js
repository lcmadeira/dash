/* dash core utils (loaded before index.html inline script) */
(function () {
  window.$ = (id) => document.getElementById(id);
  window.ld = () => `<div class="ld"><div class="spin"></div></div>`;
  window.er = (m) => `<p class="err">⚠ ${m}</p>`;
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
})();

