// Outils partages par tous les modules (non enfermes dans un bloc).
const mouvementReduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const pointeurFin = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// Textes des scripts, dans toutes les langues du site (src/i18n/*.json).
const TEXTES = __TEXTES__;
const T = TEXTES[document.documentElement.lang] || TEXTES.fr;

// 1 dans une page de gauche a droite, -1 dans une page arabe : les gestes et
// les fleches du clavier suivent le sens de lecture.
const sens = document.documentElement.dir === "rtl" ? -1 : 1;
