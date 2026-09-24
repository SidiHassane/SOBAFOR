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
