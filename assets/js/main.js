(() => {
  const nav = document.querySelector("[data-nav]");
  const toggle = document.querySelector("[data-menu-toggle]");

  if (nav && toggle) {
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

    const backdrop = document.createElement("div");
    backdrop.className = "nav-backdrop";
    document.body.appendChild(backdrop);

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
      if (window.innerWidth >= 860) closeMenu();
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        closeMenu();
      });
    });
  }

  const revealEls = document.querySelectorAll("[data-reveal]");
  if (revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("show");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    revealEls.forEach((el) => io.observe(el));
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
  }
})();


