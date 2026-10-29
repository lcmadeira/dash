/* global document, navigator, window, console */
/* Offline status and optional Service Worker registration for HTTPS/localhost. */
(function () {
  const banner = document.getElementById("offlineBanner");
  const updateOnlineState = () => {
    if (banner) banner.hidden = navigator.onLine !== false;
  };
  updateOnlineState();
  window.addEventListener("online", updateOnlineState);
  window.addEventListener("offline", updateOnlineState);

  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js", { scope: "./" })
    .catch(error => console.warn("Offline shell indisponível:", error?.message || error));
})();
