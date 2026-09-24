// --- Valeurs qui dependent de l'annee en cours ---
// Le build ecrit les valeurs de l'annee ou il a tourne ; le navigateur les
// recalcule a chaque visite. Sans nouveau build, les annees d'experience et
// l'annee du pied de page avancent donc toutes seules au 1er janvier.
// Si l'horloge de l'appareil retarde, on garde la valeur du build : un
// chiffre ne doit jamais reculer.
const anneeEnCours = new Date().getFullYear();

document.querySelectorAll("[data-depuis]").forEach((el) => {
  const ecrite = Number(el.getAttribute("data-counter")) || 0;
  const annees = Math.max(ecrite, anneeEnCours - Number(el.getAttribute("data-depuis")));
  el.setAttribute("data-counter", String(annees));
  el.textContent = `${el.getAttribute("data-prefix") || ""}${annees}${el.getAttribute("data-suffix") || ""}`;
});

document.querySelectorAll("[data-annee]").forEach((el) => {
  el.textContent = String(Math.max(Number(el.textContent) || 0, anneeEnCours));
});
