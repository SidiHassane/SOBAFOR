// --- Choix de la langue ---
// Jamais de redirection automatique : un telephone reglé en arabe n'empeche
// pas de vouloir lire le francais, et Google doit pouvoir visiter chaque
// version. On se contente d'une proposition discrete, une seule fois.
const CLE_LANGUE = "sobafor-langue";

const langueChoisie = () => {
  try {
    return localStorage.getItem(CLE_LANGUE);
  } catch {
    return null;
  }
};

const retenirLangue = (code) => {
  try {
    localStorage.setItem(CLE_LANGUE, code);
  } catch {
    /* navigation privee : la proposition reviendra, sans gravite */
  }
};

const liensLangue = document.querySelectorAll("[data-langue]");
liensLangue.forEach((lien) => {
  lien.addEventListener("click", () => retenirLangue(lien.dataset.langue));
});

// La langue preferee de l'appareil, et non l'une des suivantes : quelqu'un qui
// a place le francais en tete n'a rien a se voir proposer.
const prefere = (navigator.languages && navigator.languages[0]) || navigator.language || "";
const codePrefere = prefere.toLowerCase().split("-")[0];
const lienPropose = [...liensLangue].find((lien) => lien.dataset.langue === codePrefere);

if (lienPropose && TEXTES[codePrefere] && !langueChoisie()) {
  const textes = TEXTES[codePrefere];
  const proposition = document.createElement("aside");
  proposition.className = "suggestion-langue";
  proposition.lang = codePrefere;
  proposition.dir = lienPropose.dir;

  const message = document.createElement("p");
  message.textContent = textes.suggestion;

  const lien = document.createElement("a");
  lien.href = lienPropose.href;
  lien.textContent = textes.suggestion_lien;
  lien.addEventListener("click", () => retenirLangue(codePrefere));

  const fermer = document.createElement("button");
  fermer.type = "button";
  fermer.setAttribute("aria-label", textes.fermer);
  fermer.textContent = "\u00d7";
  fermer.addEventListener("click", () => {
    retenirLangue(document.documentElement.lang);
    proposition.remove();
  });

  proposition.append(message, lien, fermer);
  document.body.appendChild(proposition);
}
