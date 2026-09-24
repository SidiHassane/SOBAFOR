const gallery = document.querySelector("[data-gallery]");
if (gallery) {
  const shots = Array.from(gallery.querySelectorAll(".shot"));
  const filterBar = document.querySelector("[data-gallery-filters]");
  const emptyMsg = document.querySelector("[data-gallery-empty]");

  // --- Filtrage par domaine ---
  // Les compteurs sont ecrits au build. Ici, on ne fait que masquer et
  // montrer ; si le navigateur sait animer un changement d'etat (View
  // Transitions), les cliches glissent vers leur nouvelle place.
  if (filterBar) {
    const chips = Array.from(filterBar.querySelectorAll(".filter-chip"));

    const applyFilter = (value) => {
      let visible = 0;
      shots.forEach((shot) => {
        const match = value === "all" || shot.dataset.cat === value;
        shot.hidden = !match;
        if (match) visible++;
      });
      if (emptyMsg) emptyMsg.hidden = visible > 0;
    };

    // Les noms de transition ne sont poses que le temps du changement :
    // permanents, ils feraient capturer chaque cliche a chaque navigation.
    const nommer = () => {
      shots.forEach((shot, i) => {
        shot.style.viewTransitionName = shot.hidden ? "" : `cliche-${i}`;
      });
    };

    const filtrer = (value) => {
      if (!document.startViewTransition || mouvementReduit) {
        applyFilter(value);
        return;
      }
      nommer();
      const transition = document.startViewTransition(() => {
        applyFilter(value);
        nommer();
      });
      transition.finished.finally(() => {
        shots.forEach((shot) => (shot.style.viewTransitionName = ""));
      });
    };

    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        if (chip.classList.contains("is-active")) return;
        chips.forEach((c) => {
          const active = c === chip;
          c.classList.toggle("is-active", active);
          c.setAttribute("aria-pressed", active ? "true" : "false");
        });
        filtrer(chip.dataset.filter);
      });
    });
  }

  // --- Vignettes video ---
  // La vignette est extraite de la video elle-meme : une image est tiree
  // d'une premiere seconde, dessinee sur un canvas, puis la video est
  // relachee. Aucun fichier d'apercu a produire ni a stocker.
  // Le chargement n'a lieu qu'a l'approche de la carte, et pas du tout si
  // le visiteur a demande l'economie de donnees ou est en 2G.
  const lien = navigator.connection || {};
  const economiseDonnees =
    lien.saveData === true || /(^|-)2g$/.test(lien.effectiveType || "");

  const boutonsVideo = gallery.querySelectorAll(".shot-play[data-video]");
  if (boutonsVideo.length && !economiseDonnees && "IntersectionObserver" in window) {
    // File d'attente : lancer les dix-huit extractions d'un coup saturait
    // les connexions au domaine et les decodeurs, si bien que la plupart
    // expiraient avant d'avoir ete servies. Deux a la fois suffisent et
    // menagent les telephones modestes.
    const file = [];
    let actifs = 0;
    const MAX_SIMULTANE = 2;

    const capturer = (bouton, termine) => {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "metadata";
      let fini = false;

      const finir = () => {
        if (fini) return;
        fini = true;
        v.removeAttribute("src");
        v.load();
        termine();
      };

      // Dessine des qu'une image est decodee. On ne se fie pas au seul
      // evenement "seeked" : selon l'encodage il n'arrive pas toujours, et
      // la file restait alors bloquee sur la premiere video.
      const tenterDessin = () => {
        if (fini) return false;
        if (v.readyState < 2 || !v.videoWidth) return false;
        try {
          const c = document.createElement("canvas");
          const largeur = 480;
          c.width = largeur;
          c.height = Math.round((largeur * v.videoHeight) / v.videoWidth) || 270;
          c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
          c.className = "shot-poster";
          c.setAttribute("aria-hidden", "true");
          bouton.prepend(c);
          bouton.classList.add("has-poster");
        } catch (e) {
          /* le fond uni reste en place */
        }
        finir();
        return true;
      };

      v.addEventListener("loadedmetadata", () => {
        // Certaines sequences durent trois secondes : on vise une fraction,
        // pas un instant fixe qui tomberait apres la fin.
        v.currentTime = Math.min(1.5, (v.duration || 3) * 0.3);
        // Si le deplacement n'aboutit pas, on se contente de l'image
        // disponible plutot que d'attendre en vain.
        setTimeout(tenterDessin, 2500);
      });

      v.addEventListener("seeked", tenterDessin);
      v.addEventListener("loadeddata", tenterDessin);
      v.addEventListener("error", finir);
      // Filet de securite : une video muette ne doit pas bloquer la file.
      setTimeout(finir, 7000);

      v.src = bouton.dataset.video;
    };

    const defiler = () => {
      while (actifs < MAX_SIMULTANE && file.length) {
        const bouton = file.shift();
        actifs++;
        capturer(bouton, () => {
          actifs--;
          defiler();
        });
      }
    };

    const ioPoster = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          ioPoster.unobserve(entry.target);
          file.push(entry.target);
        });
        defiler();
      },
      { rootMargin: "300px 0px" }
    );

    boutonsVideo.forEach((b) => ioPoster.observe(b));
  }

  // --- Visionneuse plein ecran ---
  // Photos et videos passent par la meme visionneuse. Les videos sont
  // majoritairement verticales : les lire dans la carte les reduisait a un
  // timbre-poste sur telephone. Rien n'est telecharge avant le clic.
  const openers = shots
    .map((shot) => shot.querySelector(".shot-open, .shot-play"))
    .filter(Boolean);

  if (openers.length) {
    const lightbox = document.createElement("div");
    lightbox.className = "lightbox";
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.setAttribute("aria-label", "Visionneuse des realisations");
    lightbox.innerHTML =
      '<div class="lightbox-stage"></div>' +
      '<p class="lightbox-caption"></p>' +
      '<p class="lightbox-compteur" aria-live="polite"></p>' +
      '<button class="lightbox-close" type="button" aria-label="Fermer">&times;</button>' +
      '<button class="lightbox-prev" type="button" aria-label="Element precedent">&#8249;</button>' +
      '<button class="lightbox-next" type="button" aria-label="Element suivant">&#8250;</button>';
    document.body.appendChild(lightbox);

    const stage = lightbox.querySelector(".lightbox-stage");
    const lbCaption = lightbox.querySelector(".lightbox-caption");
    const compteur = lightbox.querySelector(".lightbox-compteur");
    const btnClose = lightbox.querySelector(".lightbox-close");
    const btnPrev = lightbox.querySelector(".lightbox-prev");
    const btnNext = lightbox.querySelector(".lightbox-next");

    let current = 0;
    let lastFocused = null;

    // Ne parcourt que les vignettes actuellement visibles apres filtrage.
    const visibleOpeners = () =>
      openers.filter((o) => !o.closest(".shot").hidden);

    // Libere la video en cours : sans cela le telechargement continue en
    // arriere-plan apres la fermeture.
    const clearStage = () => {
      const playing = stage.querySelector("video");
      if (playing) {
        playing.pause();
        playing.removeAttribute("src");
        playing.load();
      }
      stage.classList.remove("charge");
      stage.innerHTML = "";
    };

    const show = (index) => {
      const list = visibleOpeners();
      if (!list.length) return;
      current = (index + list.length) % list.length;
      const opener = list[current];
      clearStage();

      if (opener.dataset.video) {
        const video = document.createElement("video");
        video.src = opener.dataset.video;
        video.controls = true;
        video.autoplay = true;
        video.playsInline = true;
        video.preload = "auto";
        video.setAttribute("aria-label", opener.dataset.title || "Video de chantier");
        stage.appendChild(video);
        video.play().catch(() => {});
      } else {
        // L'image n'apparait qu'une fois decodee ; en attendant, un
        // indicateur tourne a sa place au lieu d'un cadre vide.
        const img = document.createElement("img");
        img.alt = opener.querySelector("img").alt;
        const pret = () => {
          if (stage.contains(img)) stage.classList.remove("charge");
        };
        img.addEventListener("load", pret);
        img.addEventListener("error", pret);
        stage.classList.add("charge");
        img.src = opener.dataset.full;
        stage.appendChild(img);
        if (img.complete) pret();
      }

      lbCaption.textContent = opener.dataset.title || "";
      const multiple = list.length > 1;
      btnPrev.hidden = !multiple;
      btnNext.hidden = !multiple;
      compteur.hidden = !multiple;
      compteur.innerHTML = `<strong>${current + 1}</strong> / ${list.length}`;
    };

    const isOpen = () => lightbox.classList.contains("is-open");

    const teardown = () => {
      lightbox.classList.remove("is-open");
      document.body.classList.remove("lightbox-open");
      stage.style.transform = "";
      stage.style.opacity = "";
      clearStage();
      if (lastFocused) lastFocused.focus();
    };

    // La visionneuse empile une entree d'historique. Sur Android, le bouton
    // Retour la referme au lieu de quitter la page : sans cela le visiteur
    // perdait sa position dans la galerie.
    let historyEntry = false;

    const close = () => {
      if (historyEntry) {
        historyEntry = false;
        history.back(); // popstate se charge du demontage
      } else {
        teardown();
      }
    };

    window.addEventListener("popstate", () => {
      if (isOpen()) {
        historyEntry = false;
        teardown();
      }
    });

    openers.forEach((opener) => {
      opener.addEventListener("click", () => {
        lastFocused = opener;
        show(visibleOpeners().indexOf(opener));
        lightbox.classList.add("is-open");
        document.body.classList.add("lightbox-open");
        btnClose.focus();
        historyEntry = true;
        history.pushState({ sobaforLightbox: true }, "");
      });
    });

    btnClose.addEventListener("click", close);
    btnPrev.addEventListener("click", () => show(current - 1));
    btnNext.addEventListener("click", () => show(current + 1));

    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) close();
    });

    document.addEventListener("keydown", (event) => {
      if (!isOpen()) return;
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") show(current - 1);
      if (event.key === "ArrowRight") show(current + 1);
    });

    // --- Gestes tactiles ---
    // Balayage lateral pour changer d'element, vers le bas pour fermer.
    // Le media suit le doigt pendant le geste, puis file ou revient en
    // place : sans ce retour visuel, un balayage donne l'impression que
    // rien ne se passe tant qu'on n'a pas relache.
    const SEUIL_X = 60;
    const SEUIL_Y = 90;
    let x0 = 0;
    let y0 = 0;
    let suit = false;

    const finDeGeste = () => {
      suit = false;
      stage.classList.remove("is-dragging");
      stage.style.transform = "";
      stage.style.opacity = "";
    };

    lightbox.addEventListener(
      "touchstart",
      (event) => {
        // Les commandes de la video gardent la priorite : sinon deplacer le
        // curseur de lecture declencherait un changement d'element.
        if (event.target.closest("video")) return;
        if (event.touches.length !== 1) return;
        x0 = event.touches[0].clientX;
        y0 = event.touches[0].clientY;
        suit = true;
        stage.classList.add("is-dragging");
      },
      { passive: true }
    );

    lightbox.addEventListener(
      "touchmove",
      (event) => {
        if (!suit) return;
        const dx = event.touches[0].clientX - x0;
        const dy = event.touches[0].clientY - y0;
        if (Math.abs(dx) > Math.abs(dy)) {
          stage.style.transform = "translate3d(" + dx + "px,0,0)";
        } else if (dy > 0) {
          // Resistance : le geste vers le bas s'attenue, il faut le vouloir.
          stage.style.transform = "translate3d(0," + dy * 0.55 + "px,0)";
          stage.style.opacity = String(Math.max(0.4, 1 - dy / 420));
        }
        if (event.cancelable) event.preventDefault();
      },
      { passive: false }
    );

    lightbox.addEventListener("touchend", (event) => {
      if (!suit) return;
      const t = event.changedTouches[0];
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      finDeGeste();
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SEUIL_X) {
        show(dx < 0 ? current + 1 : current - 1);
      } else if (dy > SEUIL_Y) {
        close();
      }
    });

    lightbox.addEventListener("touchcancel", finDeGeste);
  }
}

