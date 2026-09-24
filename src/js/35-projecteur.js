// --- Halo sous le pointeur ---
// Une seule ecoute pour toute la page, et au plus une ecriture par image :
// la position est confiee a deux variables CSS, le degrade fait le reste.
if (pointeurFin && !mouvementReduit) {
  const CIBLES = ".card, .contact-box, .stat";
  let cible = null;
  let x = 0;
  let y = 0;
  let enAttente = false;

  const peindre = () => {
    enAttente = false;
    if (!cible) return;
    const r = cible.getBoundingClientRect();
    cible.style.setProperty("--mx", `${x - r.left}px`);
    cible.style.setProperty("--my", `${y - r.top}px`);
  };

  document.addEventListener(
    "pointermove",
    (event) => {
      cible = event.target.closest ? event.target.closest(CIBLES) : null;
      if (!cible) return;
      x = event.clientX;
      y = event.clientY;
      if (!enAttente) {
        enAttente = true;
        requestAnimationFrame(peindre);
      }
    },
    { passive: true }
  );
}
