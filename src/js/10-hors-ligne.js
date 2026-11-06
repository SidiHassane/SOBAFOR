// Consultation hors ligne. Enregistre apres le chargement pour ne pas
// disputer la bande passante aux ressources de la page : sur une
// connexion faible, l'affichage passe avant la mise en cache.
//
// sw.js vit a la racine quelle que soit la langue : son adresse se deduit de
// celle de ce script, seule reference valable depuis /ar/ comme depuis /.
// currentScript n'existe que pendant l'execution initiale, d'ou la lecture ici.
const adresseScript = document.currentScript && document.currentScript.src;

if ("serviceWorker" in navigator && adresseScript) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(new URL("../../sw.js", adresseScript).href)
      .then(() => navigator.serviceWorker.ready)
      .then((enregistrement) => {
        // Le service worker garde les pages de la langue du visiteur, et elles
        // seules : pas de donnees mobiles gaspillees pour une autre version.
        const connexion = navigator.connection;
        if (connexion && connexion.saveData) return;
        const pages = [...document.querySelectorAll(".footer-links a")].map((lien) => lien.href);
        if (pages.length && enregistrement.active) {
          enregistrement.active.postMessage({ type: "pages-de-la-langue", pages });
        }
      })
      .catch(() => {
        /* pas de hors-ligne, le site fonctionne normalement */
      });
  });
}
