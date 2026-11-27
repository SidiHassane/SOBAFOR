// Outils partages par tous les modules (non enfermes dans un bloc).
const mouvementReduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const pointeurFin = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// Textes des scripts, dans toutes les langues du site (src/i18n/*.json).
const TEXTES = __TEXTES__;
const T = TEXTES[document.documentElement.lang] || TEXTES.fr;

// 1 dans une page de gauche a droite, -1 dans une page arabe : les gestes et
// les fleches du clavier suivent le sens de lecture.
const sens = document.documentElement.dir === "rtl" ? -1 : 1;

// Sous-titres d'une video, decrits par les attributs data-piste-<langue> de
// l'element qui la lance. Ceux de la langue de la page s'affichent d'office,
// sauf en arabe : la bande son des reportages l'est deja.
const LIBELLES_PISTES = { fr: "Français", en: "English", ar: "العربية" };
const ajouterPistes = (video, source) => {
  const langue = document.documentElement.lang;
  Object.keys(LIBELLES_PISTES).forEach((code) => {
    const adresse = source.getAttribute(`data-piste-${code}`);
    if (!adresse) return;
    const piste = document.createElement("track");
    piste.kind = "subtitles";
    piste.srclang = code;
    piste.label = LIBELLES_PISTES[code];
    piste.src = adresse;
    if (code === langue && code !== "ar") piste.default = true;
    video.append(piste);
  });
};
