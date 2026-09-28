// --- Video de presentation ---
// Tant qu'on ne clique pas, la page n'affiche qu'une image legere : la
// video (9 a 15 Mo) n'est demandee qu'au clic. Les petits ecrans recoivent
// la version 540p, les grands la 720p. Sans script, le lien ouvre le
// fichier directement.
document.querySelectorAll("[data-video-vedette]").forEach((facade) => {
  facade.addEventListener("click", (event) => {
    event.preventDefault();
    const video = document.createElement("video");
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("aria-label", facade.textContent.trim());

    // getAttribute et non dataset : « data-video-540 » ne devient pas
    // dataset.video540 (la conversion ne s'applique que devant une lettre).
    const petite = document.createElement("source");
    petite.src = facade.getAttribute("data-video-540");
    petite.type = "video/mp4";
    petite.media = "(max-width: 767px)";
    const grande = document.createElement("source");
    grande.src = facade.getAttribute("data-video-720");
    grande.type = "video/mp4";
    video.append(petite, grande);

    const cadre = facade.parentElement;
    cadre.classList.add("est-lancee");
    facade.replaceWith(video);
    video.play().catch(() => {});
  });
});
