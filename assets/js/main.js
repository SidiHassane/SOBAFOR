(() => {
  const header = document.querySelector(".site-header");
  const nav = document.querySelector("[data-nav]");
  const toggle = document.querySelector("[data-menu-toggle]");
  const desktopBreakpoint = 960;

  if (header) {
    const syncHeaderState = () => {
      header.classList.toggle("is-scrolled", window.scrollY > 12);
    };

    syncHeaderState();
    window.addEventListener("scroll", syncHeaderState, { passive: true });
  }

  if (nav && toggle) {
    const backdrop = document.createElement("div");
    backdrop.className = "nav-backdrop";
    document.body.appendChild(backdrop);

    const closeMenu = () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
      backdrop.classList.remove("show");
    };

    const openMenu = () => {
      nav.classList.add("open");
      toggle.setAttribute("aria-expanded", "true");
      document.body.classList.add("menu-open");
      backdrop.classList.add("show");
    };

    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      if (expanded) closeMenu();
      else openMenu();
    });

    backdrop.addEventListener("click", closeMenu);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth >= desktopBreakpoint) closeMenu();
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        closeMenu();
      });
    });
  }

  // --- Revelations en cascade ---
  // Les groupes de cartes se revelent element par element plutot qu'en bloc.
  // Le retard est porte par une variable CSS, donc c'est le compositeur qui
  // anime : le fil principal ne fait qu'ajouter une classe.
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const GROUPS = ".cards, .stats, .process, .kpis, .footer-grid, .gallery-teaser";
  document.querySelectorAll(GROUPS).forEach((group) => {
    if (group.hasAttribute("data-reveal")) group.removeAttribute("data-reveal");
    Array.from(group.children).forEach((child, i) => {
      child.setAttribute("data-reveal", "");
      // Au-dela de six, le retard cumule se voit comme une lenteur.
      child.style.setProperty("--stagger", Math.min(i, 5));
    });
  });

  const revealEls = document.querySelectorAll("[data-reveal]");
  if (revealEls.length) {
    if (reducedMotion) {
      revealEls.forEach((el) => el.classList.add("show"));
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("show");
              io.unobserve(entry.target);
            }
          });
        },
        // Declenche un peu avant l'entree dans le cadre : l'element est deja
        // en place quand le regard l'atteint, ce qui supprime l'effet de pop.
        { threshold: 0.05, rootMargin: "0px 0px -8% 0px" }
      );

      revealEls.forEach((el) => io.observe(el));
    }
  }

  const gallery = document.querySelector("[data-gallery]");
  if (gallery) {
    const shots = Array.from(gallery.querySelectorAll(".shot"));
    const filterBar = document.querySelector("[data-gallery-filters]");
    const emptyMsg = document.querySelector("[data-gallery-empty]");

    // --- Filtrage par domaine ---
    if (filterBar) {
      const chips = Array.from(filterBar.querySelectorAll(".filter-chip"));

      // Compteurs par domaine, calcules depuis le contenu reel.
      filterBar.querySelectorAll(".chip-count").forEach((el) => {
        const cat = el.dataset.count;
        el.textContent =
          cat === "all"
            ? shots.length
            : shots.filter((s) => s.dataset.cat === cat).length;
      });

      const applyFilter = (value) => {
        let visible = 0;
        shots.forEach((shot) => {
          const match = value === "all" || shot.dataset.cat === value;
          shot.hidden = !match;
          if (match) visible++;
        });
        if (emptyMsg) emptyMsg.hidden = visible > 0;
      };

      chips.forEach((chip) => {
        chip.addEventListener("click", () => {
          chips.forEach((c) => {
            const active = c === chip;
            c.classList.toggle("is-active", active);
            c.setAttribute("aria-pressed", active ? "true" : "false");
          });
          applyFilter(chip.dataset.filter);
        });
      });
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
        '<button class="lightbox-close" type="button" aria-label="Fermer">&times;</button>' +
        '<button class="lightbox-prev" type="button" aria-label="Element precedent">&#8249;</button>' +
        '<button class="lightbox-next" type="button" aria-label="Element suivant">&#8250;</button>';
      document.body.appendChild(lightbox);

      const stage = lightbox.querySelector(".lightbox-stage");
      const lbCaption = lightbox.querySelector(".lightbox-caption");
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
          const img = document.createElement("img");
          img.src = opener.dataset.full;
          img.alt = opener.querySelector("img").alt;
          stage.appendChild(img);
        }

        lbCaption.textContent = opener.dataset.title || "";
        const multiple = list.length > 1;
        btnPrev.hidden = !multiple;
        btnNext.hidden = !multiple;
      };

      const close = () => {
        lightbox.classList.remove("is-open");
        document.body.classList.remove("lightbox-open");
        clearStage();
        if (lastFocused) lastFocused.focus();
      };

      openers.forEach((opener) => {
        opener.addEventListener("click", () => {
          lastFocused = opener;
          show(visibleOpeners().indexOf(opener));
          lightbox.classList.add("is-open");
          document.body.classList.add("lightbox-open");
          btnClose.focus();
        });
      });

      btnClose.addEventListener("click", close);
      btnPrev.addEventListener("click", () => show(current - 1));
      btnNext.addEventListener("click", () => show(current + 1));

      lightbox.addEventListener("click", (event) => {
        if (event.target === lightbox) close();
      });

      document.addEventListener("keydown", (event) => {
        if (!lightbox.classList.contains("is-open")) return;
        if (event.key === "Escape") close();
        if (event.key === "ArrowLeft") show(current - 1);
        if (event.key === "ArrowRight") show(current + 1);
      });
    }
  }

  const counters = document.querySelectorAll("[data-counter]");
  if (counters.length) {
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    const animateCounter = (el) => {
      const target = Number(el.getAttribute("data-counter")) || 0;
      const prefix = el.getAttribute("data-prefix") || "";
      const suffix = el.getAttribute("data-suffix") || "";
      const duration = 1200;
      const start = performance.now();

      const tick = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const value = Math.floor(target * easeOut(p));
        el.textContent = `${prefix}${value}${suffix}`;
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

  const quoteForm = document.querySelector("[data-quote-form]");
  if (quoteForm) {
    quoteForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(quoteForm);
      const nom = String(data.get("nom") || "").trim();
      const tel = String(data.get("telephone") || "").trim();
      const service = String(data.get("service") || "").trim();
      const ville = String(data.get("ville") || "").trim();
      const details = String(data.get("details") || "").trim();

      const message = [
        "Bonjour SOBAFOR SA,",
        "Je souhaite demander un devis.",
        "",
        `Nom: ${nom}`,
        `Téléphone: ${tel}`,
        `Service: ${service}`,
        `Ville/Zone: ${ville}`,
        `Détails: ${details}`,
      ].join("\n");

      const whatsappUrl = `https://wa.me/22798036482?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, "_blank", "noopener");
      quoteForm.reset();
    });
  }

  const contactForm = document.querySelector("[data-contact-form]");
  if (contactForm) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(contactForm);
      const nom = String(data.get("nom") || "").trim();
      const tel = String(data.get("telephone") || "").trim();
      const sujet = String(data.get("sujet") || "").trim();
      const message = String(data.get("message") || "").trim();

      const body = [
        "Bonjour SOBAFOR SA,",
        "",
        `Nom: ${nom}`,
        `Téléphone: ${tel}`,
        `Sujet: ${sujet}`,
        "",
        message,
      ].join("\n");

      const mailto = `mailto:sob_sarl@yahoo.fr?subject=${encodeURIComponent(sujet || "Prise de contact site web")}&body=${encodeURIComponent(body)}`;
      window.location.href = mailto;
      contactForm.reset();
    });
  }

  const mobileCta = document.querySelector(".sticky-mobile-cta");
  if (mobileCta) {
    let lastY = window.scrollY;
    let ticking = false;

    const handleCtaVisibility = () => {
      const currentY = window.scrollY;
      const scrollingDown = currentY > lastY;
      const scrolledEnough = currentY > 120;
      mobileCta.classList.toggle("is-hidden", scrollingDown && scrolledEnough);
      lastY = currentY;
      ticking = false;
    };

    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          window.requestAnimationFrame(handleCtaVisibility);
          ticking = true;
        }
      },
      { passive: true }
    );

    handleCtaVisibility();
  }
})();


