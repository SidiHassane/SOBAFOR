// Consultation hors ligne. Enregistre apres le chargement pour ne pas
// disputer la bande passante aux ressources de la page : sur une
// connexion faible, l'affichage passe avant la mise en cache.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* pas de hors-ligne, le site fonctionne normalement */
    });
  });
}

