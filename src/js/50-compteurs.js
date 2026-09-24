// --- Compteurs ---
// La valeur finale est ecrite dans le HTML : sans script, ou avec le
// mouvement reduit, le visiteur lit directement le bon chiffre. Le decompte
// n'est qu'une mise en scene ajoutee par-dessus.
const counters = document.querySelectorAll("[data-counter]");
if (counters.length && !mouvementReduit && "IntersectionObserver" in window) {
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const texte = (el, valeur) =>
    `${el.getAttribute("data-prefix") || ""}${valeur}${el.getAttribute("data-suffix") || ""}`;

  counters.forEach((el) => {
    el.textContent = texte(el, 0);
  });

  const animateCounter = (el) => {
    const target = Number(el.getAttribute("data-counter")) || 0;
    const duration = 1400;
    const start = performance.now();

    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      el.textContent = texte(el, Math.round(target * easeOut(p)));
      if (p < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  };

  const counterIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterIO.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );

  counters.forEach((el) => counterIO.observe(el));
}
