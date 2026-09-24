/* Généré par build.mjs depuis src/js/ — modifier la source, pas ce fichier. */
(() => {
  // ---- 00-outils.js
  // Outils partages par tous les modules (non enfermes dans un bloc).
  const mouvementReduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pointeurFin = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  // ---- 10-hors-ligne.js
  {
    // Consultation hors ligne. Enregistre apres le chargement pour ne pas
    // disputer la bande passante aux ressources de la page : sur une
    // connexion faible, l'affichage passe avant la mise en cache.
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(() => {
          /* pas de hors-ligne, le site fonctionne normalement */
        });
      });
    }
  }

  // ---- 20-entete-menu.js
  {
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
  }

  // ---- 30-revelations.js
  {
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
  }

  // ---- 35-projecteur.js
  {
    // --- Halo sous le pointeur ---
    // Une seule ecoute pour toute la page, et au plus une ecriture par image :
    // la position est confiee a deux variables CSS, le degrade fait le reste.
    if (pointeurFin && !mouvementReduit) {
      const CIBLES = ".card, .contact-box, .stat";
      let cible = null;
      let x = 0;
      let y = 0;
      let enAttente = false;

      const peindre = () => {
        enAttente = false;
        if (!cible) return;
        const r = cible.getBoundingClientRect();
        cible.style.setProperty("--mx", `${x - r.left}px`);
        cible.style.setProperty("--my", `${y - r.top}px`);
      };

      document.addEventListener(
        "pointermove",
        (event) => {
          cible = event.target.closest ? event.target.closest(CIBLES) : null;
          if (!cible) return;
          x = event.clientX;
          y = event.clientY;
          if (!enAttente) {
            enAttente = true;
            requestAnimationFrame(peindre);
          }
        },
        { passive: true }
      );
    }
  }

  // ---- 40-galerie.js
  {
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
  }

  // ---- 45-pile-accueil.js
  {
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
  }

  // ---- 50-compteurs.js
  {
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
  }

  // ---- 60-formulaires.js
  {
    // --- Formulaires ---
    // Pas de serveur : chaque formulaire redige un message et le confie a
    // WhatsApp ou a la messagerie du visiteur. Deux regles :
    //  - rien ne se perd : les champs restent remplis apres l'envoi ;
    //  - rien n'est muet : un encadre confirme l'envoi et propose un recours si
    //    rien ne s'est ouvert (fenetre bloquee, aucune messagerie installee —
    //    cas frequent sur ordinateur, ou le lien mailto: ne fait alors rien).

    const echapper = (texte) =>
      String(texte).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

    // Nouvel onglet quand le navigateur l'autorise ; sinon le meme onglet. Un
    // bloqueur de fenetres ne doit jamais faire echouer une demande de devis.
    const ouvrirWhatsApp = (url) => {
      const fenetre = window.open(url, "_blank");
      if (fenetre) fenetre.opener = null;
      else window.location.href = url;
    };

    const lienWhatsApp = (base, message) => `${base}?text=${encodeURIComponent(message)}`;

    const afficherSuite = (form, html) => {
      let bloc = form.querySelector(".form-suite");
      if (!bloc) {
        bloc = document.createElement("div");
        bloc.className = "form-suite";
        bloc.setAttribute("role", "status");
        form.appendChild(bloc);
      }
      bloc.innerHTML = html;
      bloc.scrollIntoView({ block: "nearest", behavior: mouvementReduit ? "auto" : "smooth" });
      return bloc;
    };

    const champs = (form) => {
      const donnees = new FormData(form);
      return (nom) => String(donnees.get(nom) || "").trim();
    };

    const quoteForm = document.querySelector("[data-quote-form]");
    if (quoteForm) {
      quoteForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const val = champs(quoteForm);
        const message = [
          "Bonjour SOBAFOR SA,",
          "Je souhaite demander un devis.",
          "",
          `Nom: ${val("nom")}`,
          `Téléphone: ${val("telephone")}`,
          `Service: ${val("service")}`,
          `Ville/Zone: ${val("ville")}`,
          `Détails: ${val("details")}`,
        ].join("\n");

        const url = lienWhatsApp(quoteForm.dataset.whatsapp, message);
        afficherSuite(
          quoteForm,
          `<p class="form-suite-titre">Votre demande est prête</p>
          <p>WhatsApp s'ouvre avec votre message déjà rédigé : il ne vous reste qu'à appuyer sur <strong>Envoyer</strong>.</p>
          <p class="form-suite-recours">Rien ne s'est ouvert ? <a href="${echapper(url)}" target="_blank" rel="noopener">Ouvrir WhatsApp</a></p>`
        );
        ouvrirWhatsApp(url);
      });
    }

    const contactForm = document.querySelector("[data-contact-form]");
    if (contactForm) {
      contactForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const val = champs(contactForm);
        const sujet = val("sujet") || "Prise de contact site web";
        const message = [
          "Bonjour SOBAFOR SA,",
          "",
          `Nom: ${val("nom")}`,
          `Téléphone: ${val("telephone")}`,
          `Sujet: ${sujet}`,
          "",
          val("message"),
        ].join("\n");

        const urlWhatsApp = lienWhatsApp(contactForm.dataset.whatsapp, message);
        const canal = (e.submitter && e.submitter.value) || "whatsapp";

        if (canal === "email") {
          const email = contactForm.dataset.email;
          const mailto = `mailto:${email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(message)}`;
          const bloc = afficherSuite(
            contactForm,
            `<p class="form-suite-titre">Votre message est prêt</p>
            <p>Votre messagerie s'ouvre avec le message déjà rédigé.</p>
            <p class="form-suite-recours">Rien ne s'est ouvert ? Écrivez-nous à <a href="mailto:${echapper(email)}">${echapper(email)}</a>
            (<button type="button" class="lien-bouton" data-copier>copier le message</button>),
            ou <a href="${echapper(urlWhatsApp)}" target="_blank" rel="noopener">envoyez-le par WhatsApp</a>.</p>`
          );
          const copier = bloc.querySelector("[data-copier]");
          copier.addEventListener("click", () => {
            if (!navigator.clipboard) return;
            navigator.clipboard.writeText(message).then(() => {
              copier.textContent = "message copié";
            });
          });
          window.location.href = mailto;
          return;
        }

        afficherSuite(
          contactForm,
          `<p class="form-suite-titre">Votre message est prêt</p>
          <p>WhatsApp s'ouvre avec votre message déjà rédigé : il ne vous reste qu'à appuyer sur <strong>Envoyer</strong>.</p>
          <p class="form-suite-recours">Rien ne s'est ouvert ? <a href="${echapper(urlWhatsApp)}" target="_blank" rel="noopener">Ouvrir WhatsApp</a></p>`
        );
        ouvrirWhatsApp(urlWhatsApp);
      });
    }
  }

  // ---- 70-actions-mobiles.js
  {
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
  }
})();
