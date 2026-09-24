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
