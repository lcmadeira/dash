/* global document, navigator, window, console */
/* Offline status and optional Service Worker registration for HTTPS/localhost. */
(function () {
  const banner = document.getElementById("offlineBanner");
  const message = document.getElementById("offlineBannerMessage");
  const updateOnlineState = () => {
    if (!banner) return;
    const offline = navigator.onLine === false;
    banner.hidden = !offline;
    if (!offline || !message) return;
    const savedCards = document.querySelectorAll('.card-status[data-state="cache"], .card-status[data-state="stale"], .card-status[data-state="static"]').length;
    message.textContent = savedCards
      ? `Sem ligação à internet. ${savedCards} cards mostram dados guardados ou de referência; a idade está indicada em cada estado.`
      : "Sem ligação à internet. Ainda não há dados guardados identificados; os dados não estão a ser atualizados.";
  };
  window.updateOfflineBanner = updateOnlineState;
  updateOnlineState();
  window.addEventListener("online", updateOnlineState);
  window.addEventListener("offline", updateOnlineState);

  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js", { scope: "./" })
    .catch(error => console.warn("Offline shell indisponível:", error?.message || error));
})();
