// --- Le chantier en video ---
// Un seul lecteur pour toutes les videos du chantier, rangees dans l'ordre
// chronologique sous l'ecran. Tant qu'on ne clique pas, la page n'affiche
// que des images legeres : une video n'est demandee qu'au moment de la lire.
// Sans script, chaque lien ouvre directement son fichier.
document.querySelectorAll("[data-lecteur]").forEach((lecteur) => {
  const cadre = lecteur.querySelector(".video-vedette");
  const legende = lecteur.querySelector("[data-lecteur-legende]");
  const chapitres = lecteur.querySelector("[data-lecteur-chapitres]");
  const items = [...lecteur.querySelectorAll("[data-lecteur-item]")];
  let video = null;

  const actif = () => items.find((item) => item.getAttribute("aria-current") === "true") || items[0];

  // getAttribute et non dataset : « data-video-540 » ne devient pas
  // dataset.video540 (la conversion ne s'applique que devant une lettre).
  // Plusieurs definitions : les petits ecrans recoivent la plus legere.
  const creerVideo = (item) => {
    const v = document.createElement("video");
    v.controls = true;
    v.playsInline = true;
    v.preload = "auto";
    v.setAttribute("aria-label", item.dataset.titre);
    const definitions = [...item.attributes]
      .filter((a) => /^data-video-\d+$/.test(a.name))
      .sort((a, b) => parseInt(a.name.slice(11), 10) - parseInt(b.name.slice(11), 10));
    definitions.forEach((a, i) => {
      const source = document.createElement("source");
      source.src = a.value;
      source.type = "video/mp4";
      if (i < definitions.length - 1) source.media = "(max-width: 767px)";
      v.append(source);
    });
    ajouterPistes(v, item);
    return v;
  };

  // Libere la video en cours : sans cela son telechargement continue.
  const liberer = () => {
    if (!video) return;
    video.pause();
    video.querySelectorAll("source").forEach((s) => s.remove());
    video.removeAttribute("src");
    video.load();
  };

  const minutes = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

  const afficherChapitres = (item) => {
    let liste = [];
    try {
      liste = JSON.parse(item.dataset.chapitres || "[]");
    } catch {
      liste = [];
    }
    chapitres.replaceChildren(
      ...liste.map((c) => {
        const bouton = document.createElement("button");
        bouton.type = "button";
        bouton.className = "lecteur-chapitre";
        const temps = document.createElement("span");
        temps.textContent = minutes(c.t);
        bouton.append(temps, ` ${c.titre}`);
        bouton.addEventListener("click", () => aller(c.t));
        return bouton;
      })
    );
    chapitres.hidden = !liste.length;
  };

  const lire = (item, depart = 0) => {
    items.forEach((i) => {
      if (i === item) i.setAttribute("aria-current", "true");
      else i.removeAttribute("aria-current");
    });
    legende.textContent = item.dataset.legende;
    afficherChapitres(item);

    const nouvelle = creerVideo(item);
    if (depart) {
      nouvelle.addEventListener("loadedmetadata", () => (nouvelle.currentTime = depart), { once: true });
    }
    liberer();
    cadre.querySelector(".video-facade, video").replaceWith(nouvelle);
    video = nouvelle;
    video.play().catch(() => {});
  };

  const aller = (t) => {
    if (!video) return lire(actif(), t);
    video.currentTime = t;
    video.play().catch(() => {});
  };

  cadre.querySelector("[data-lecteur-facade]").addEventListener("click", (event) => {
    event.preventDefault();
    lire(actif());
  });

  items.forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      lire(item);
      // Sur telephone, la liste est sous l'ecran : on y remonte.
      const haut = cadre.getBoundingClientRect().top;
      if (haut < 0 || haut > window.innerHeight * 0.5) {
        cadre.scrollIntoView({ block: "center", behavior: mouvementReduit ? "auto" : "smooth" });
      }
    });
  });

  afficherChapitres(actif());
});
