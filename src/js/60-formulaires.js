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

// Message envoye a l'equipe. Sur une version traduite, une ligne en francais
// signale la langue du visiteur, pour lui repondre dans la bonne.
const rediger = (lignes) =>
  [...lignes, ...(T.langue_visiteur ? ["", T.langue_visiteur] : [])].join("\n");

const champs = (form) => {
  const donnees = new FormData(form);
  return (nom) => String(donnees.get(nom) || "").trim();
};

const quoteForm = document.querySelector("[data-quote-form]");
if (quoteForm) {
  quoteForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = champs(quoteForm);
    // Les champs facultatifs laisses vides ne produisent pas de ligne vide
    // dans le message recu sur WhatsApp.
    const message = rediger(
      [
        T.salut,
        T.devis_intro,
        "",
        `${T.nom}: ${val("nom")}`,
        `${T.telephone}: ${val("telephone")}`,
        `${T.service}: ${val("service")}`,
        val("ville") ? `${T.ville}: ${val("ville")}` : null,
        val("details") ? `${T.details}: ${val("details")}` : null,
      ].filter((ligne) => ligne !== null)
    );

    const url = lienWhatsApp(quoteForm.dataset.whatsapp, message);
    afficherSuite(
      quoteForm,
      `<p class="form-suite-titre">${T.demande_prete}</p>
      <p>${T.whatsapp_ouvre}</p>
      <p class="form-suite-recours">${T.rien_ouvert} <a href="${echapper(url)}" target="_blank" rel="noopener">${T.ouvrir_whatsapp}</a></p>`
    );
    ouvrirWhatsApp(url);
  });
}

const contactForm = document.querySelector("[data-contact-form]");
if (contactForm) {
  contactForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = champs(contactForm);
    const sujet = val("sujet") || T.sujet_defaut;
    const message = rediger([
      T.salut,
      "",
      `${T.nom}: ${val("nom")}`,
      `${T.telephone}: ${val("telephone")}`,
      `${T.sujet}: ${sujet}`,
      "",
      val("message"),
    ]);

    const urlWhatsApp = lienWhatsApp(contactForm.dataset.whatsapp, message);
    const canal = (e.submitter && e.submitter.value) || "whatsapp";

    if (canal === "email") {
      // data-email peut contenir plusieurs adresses separees par des
      // virgules : le message part a toutes, chacune est proposee en recours.
      const email = contactForm.dataset.email;
      const liensEmail = email
        .split(",")
        .map((e) => `<a href="mailto:${echapper(e)}"><bdi dir="ltr">${echapper(e)}</bdi></a>`)
        .join(` ${T.ou} `);
      const mailto = `mailto:${email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(message)}`;
      const bloc = afficherSuite(
        contactForm,
        `<p class="form-suite-titre">${T.message_pret}</p>
        <p>${T.messagerie_ouvre}</p>
        <p class="form-suite-recours">${T.rien_ouvert} ${T.ecrivez_nous} ${liensEmail}
        (<button type="button" class="lien-bouton" data-copier>${T.copier}</button>)${T.virgule}
        ${T.ou} <a href="${echapper(urlWhatsApp)}" target="_blank" rel="noopener">${T.envoyer_whatsapp}</a>.</p>`
      );
      const copier = bloc.querySelector("[data-copier]");
      copier.addEventListener("click", () => {
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(message).then(() => {
          copier.textContent = T.copie;
        });
      });
      window.location.href = mailto;
      return;
    }

    afficherSuite(
      contactForm,
      `<p class="form-suite-titre">${T.message_pret}</p>
      <p>${T.whatsapp_ouvre}</p>
      <p class="form-suite-recours">${T.rien_ouvert} <a href="${echapper(urlWhatsApp)}" target="_blank" rel="noopener">${T.ouvrir_whatsapp}</a></p>`
    );
    ouvrirWhatsApp(urlWhatsApp);
  });
}
