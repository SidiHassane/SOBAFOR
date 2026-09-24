// --- Revelations en cascade ---
// Les enfants des groupes (cartes, chiffres, galerie...) se revelent un par
// un. Le rang dans la cascade est calcule parmi les elements qui entrent
// ENSEMBLE dans l'ecran : la 30e photo d'une galerie n'attend donc pas
// derriere les 29 premieres. Le retard est porte par une variable CSS :
// c'est le compositeur qui anime, le script ne fait que poser une classe.
const GROUPES = ".cards, .stats, .process, .kpis, .footer-grid, .gallery";
const RANG_MAX = 5; // au-dela, le retard cumule se lit comme une lenteur

document.querySelectorAll(GROUPES).forEach((groupe) => {
  groupe.removeAttribute("data-reveal");
  Array.from(groupe.children).forEach((enfant) => enfant.setAttribute("data-reveal", ""));
});

// Une fois l'apparition terminee, l'element redevient ordinaire : ses
// transitions de survol reprennent la main sur celles de la revelation.
const liberer = (el, rang) => {
  window.setTimeout(() => {
    el.removeAttribute("data-reveal");
    el.classList.remove("show");
    el.style.removeProperty("--stagger");
  }, 700 + rang * 65);
};

const elements = document.querySelectorAll("[data-reveal]");

if (mouvementReduit || !("IntersectionObserver" in window)) {
  elements.forEach((el) => el.removeAttribute("data-reveal"));
} else {
  const observateur = new IntersectionObserver(
    (entrees) => {
      let rang = 0;
      entrees.forEach((entree) => {
        if (!entree.isIntersecting) return;
        const el = entree.target;
        observateur.unobserve(el);
        const enGroupe = el.parentElement && el.parentElement.matches(GROUPES);
        const r = enGroupe ? Math.min(rang++, RANG_MAX) : 0;
        el.style.setProperty("--stagger", r);
        el.classList.add("show");
        liberer(el, r);
      });
    },
    // Declenche un peu avant l'entree dans le cadre : l'element est deja
    // en place quand le regard l'atteint, ce qui supprime l'effet de pop.
    { threshold: 0.05, rootMargin: "0px 0px -8% 0px" }
  );

  elements.forEach((el) => observateur.observe(el));
}
