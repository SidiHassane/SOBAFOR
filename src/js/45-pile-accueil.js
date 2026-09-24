// --- Pile de photos de l'accueil ---
// La carte du dessus passe dessous toutes les quelques secondes. La rotation
// s'arrete quand la pile sort de l'ecran, quand l'onglet est cache, et sous
// le pointeur (on regarde une photo, elle ne doit pas s'enfuir).
const pile = document.querySelector("[data-pile]");

if (pile) {
  const cartes = Array.from(pile.querySelectorAll(".pile-carte"));
  const ordre = cartes.map((_, i) => i);

  const placer = () => {
    ordre.forEach((indexCarte, position) => {
      cartes[indexCarte].dataset.pos = String(position);
    });
  };

  placer();

  if (!mouvementReduit && cartes.length > 1) {
    const PERIODE = 4200;
    let minuterie = 0;
    let visible = false;
    let survol = false;

    const avancer = () => {
      const sortante = cartes[ordre[0]];
      ordre.push(ordre.shift());
      sortante.classList.add("quitte");
      placer();
    };

    cartes.forEach((carte) => {
      carte.addEventListener("animationend", () => carte.classList.remove("quitte"));
    });

    const arreter = () => {
      window.clearInterval(minuterie);
      minuterie = 0;
    };

    const relancer = () => {
      arreter();
      if (visible && !survol && !document.hidden) {
        minuterie = window.setInterval(avancer, PERIODE);
      }
    };

    new IntersectionObserver(([entree]) => {
      visible = entree.isIntersecting;
      relancer();
    }).observe(pile);

    document.addEventListener("visibilitychange", relancer);
    pile.addEventListener("pointerenter", () => {
      survol = true;
      relancer();
    });
    pile.addEventListener("pointerleave", () => {
      survol = false;
      relancer();
    });
  }
}
