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

