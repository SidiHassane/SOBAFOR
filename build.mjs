#!/usr/bin/env node
/*
 * Generateur du site SOBAFOR — aucune dependance, Node 18+ suffit.
 *
 *     node build.mjs
 *
 * Les sources vivent dans src/ ; les fichiers servis (*.html a la racine,
 * assets/css/style.css, assets/js/main.js, sw.js) sont PRODUITS ici et
 * versionnes tels quels. L'hebergement reste donc purement statique : aucun
 * reglage a changer, aucune etape de compilation cote serveur.
 *
 *   src/data/site.json      coordonnees, navigation, langues : une seule source
 *   src/data/galerie.json   photos et videos des realisations
 *   src/data/metiers.json   pages d'atterrissage par metier
 *   src/data/<langue>/      textes traduits de ces trois fichiers
 *   src/i18n/<langue>.json  textes de l'interface (gabarits, aides, scripts)
 *   src/layouts/            squelettes de page
 *   src/partials/           en-tete, pied de page, barre mobile...
 *   src/pages/              contenu propre a chaque page
 *   src/pages/<langue>/     les memes pages, traduites
 *   src/css/, src/js/       feuilles et scripts, concatenes dans l'ordre des noms
 *   src/sw.js               service worker (version calculee a chaque build)
 *
 * Syntaxe des gabarits :
 *   {{ chemin.vers.valeur }}   texte echappe
 *   {{{ chemin }}}             HTML brut
 *   {{> nom }}                 inclut src/partials/nom.html
 *   {{@ aide argument }}       appelle une aide definie plus bas
 * Une balise seule sur sa ligne herite de l'indentation de cette ligne, et la
 * ligne disparait si la balise ne produit rien.
 *
 * Langues : la premiere de site.json (francais) est servie a la racine, les
 * autres dans leur dossier (/ar/). Une traduction incomplete arrete le build :
 * rien de partiellement traduit ne peut etre publie.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const RACINE = dirname(fileURLToPath(import.meta.url));
const SRC = join(RACINE, "src");

const lire = (chemin) => readFileSync(chemin, "utf8").replace(/\r\n/g, "\n");
const lireJSON = (chemin) => JSON.parse(lire(chemin));
const fichiers = (dossier, ext) =>
  readdirSync(join(SRC, dossier))
    .filter((f) => f.endsWith(ext))
    .sort();

const echapper = (v) =>
  String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const erreurs = [];

/* ------------------------------------------------------------------ */
/* Donnees                                                             */
/* ------------------------------------------------------------------ */

const siteBase = lireJSON(join(SRC, "data/site.json"));
const galerieBase = lireJSON(join(SRC, "data/galerie.json"));
const metiersBase = lireJSON(join(SRC, "data/metiers.json"));

const urlPage = (slug) => (slug === "index" ? "index.html" : `${slug}.html`);
const whatsapp = "https://wa.me/" + siteBase.telephones.principal.lien.replace(/^\+/, "");

// Poids affiche sous chaque video, lu sur le fichier lui-meme : il reste
// juste meme quand une video est remplacee.
const poidsVideo = (chemin, t) => {
  const complet = join(RACINE, chemin);
  if (!existsSync(complet)) {
    erreurs.push(`video introuvable : ${chemin}`);
    return "?";
  }
  return (statSync(complet).size / 1048576).toFixed(1).replace(".", t.decimale) + " " + t.mo;
};

// Chemins de videos : espaces et parentheses encodes, apostrophe conservee.
const urlFichier = (chemin) => encodeURI(chemin).replace(/\(/g, "%28").replace(/\)/g, "%29");

const imageGalerie = (id, largeur) => `assets/img/gallery/${id}-${largeur}.jpg`;

for (const el of galerieBase.elements) {
  if (el.video) continue;
  for (const t of el.tailles) {
    if (!existsSync(join(RACINE, imageGalerie(el.id, t)))) {
      erreurs.push(`image manquante : ${imageGalerie(el.id, t)}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Langues                                                             */
/* ------------------------------------------------------------------ */

// Une traduction ne fournit que des textes. Identifiants, photos et numeros
// viennent toujours de la version de reference : ils ne peuvent pas diverger.
const fusionner = (base, traduction) => {
  if (traduction === undefined) return base;
  if (Array.isArray(base)) return base.map((v, i) => fusionner(v, traduction[i]));
  if (base && typeof base === "object") {
    return Object.fromEntries(Object.entries(base).map(([cle, v]) => [cle, fusionner(v, traduction[cle])]));
  }
  return traduction;
};

// Les listes de la galerie sont traduites par identifiant : l'ajout d'une
// photo au milieu de la liste ne decale aucune traduction.
const traduireListe = (liste, traductions = {}) => liste.map((el) => fusionner(el, traductions[el.id]));

// Signale tout texte reste identique a l'original. Les valeurs sans lettres
// (ponctuation, nombres) et celles de latinAutorise ne sont pas concernees.
const verifierTraduction = (original, traduit, chemin, langue, ignorer = new Set()) => {
  if (typeof original === "string") {
    if (original === traduit && /\p{L}{2}/u.test(original) && !langue.latinAutorise.includes(original)) {
      erreurs.push(`traduction manquante (${langue.code}) : ${chemin}`);
    }
    return;
  }
  if (!original || typeof original !== "object") return;
  for (const [cle, valeur] of Object.entries(original)) {
    if (!ignorer.has(cle)) verifierTraduction(valeur, traduit?.[cle], `${chemin}.${cle}`, langue, ignorer);
  }
};

const IGNORER_SITE = new Set([
  "nom", "url", "fondation", "emails", "rccm", "nif", "directeur", "codePays",
  "geo", "telephones", "page", "langues",
]);
const IGNORER_GALERIE = new Set([
  "id", "cat", "projet", "source", "sources", "affiche", "accueil", "mosaique", "etat",
]);
const IGNORER_METIERS = new Set(["page", "categorie", "service", "galerie", "id"]);

const langues = siteBase.langues.map((langue, i) => {
  const t = lireJSON(join(SRC, `i18n/${langue.code}.json`));
  const dossier = join(SRC, "data", langue.code);
  const reference = i === 0;
  const trad = (nom) => (reference ? {} : lireJSON(join(dossier, `${nom}.json`)));
  const tradGalerie = trad("galerie");
  const donnees = {
    ...langue,
    latinAutorise: langue.latinAutorise || [],
    reference,
    t,
    site: reference ? siteBase : fusionner(siteBase, trad("site")),
    metiers: reference ? metiersBase : fusionner(metiersBase, trad("metiers")),
    galerie: reference
      ? galerieBase
      : {
          ...galerieBase,
          categories: traduireListe(galerieBase.categories, tradGalerie.categories),
          projets: traduireListe(galerieBase.projets, tradGalerie.projets),
          elements: traduireListe(galerieBase.elements, tradGalerie.elements),
        },
  };
  donnees.elements = new Map(donnees.galerie.elements.map((el) => [el.id, el]));
  return donnees;
});

const langueReference = langues[0];

for (const langue of langues.slice(1)) {
  const { code } = langue;
  verifierTraduction(langueReference.t, langue.t, `i18n/${code}.json`, langue);
  verifierTraduction(siteBase, langue.site, `data/${code}/site.json`, langue, IGNORER_SITE);
  verifierTraduction(metiersBase, langue.metiers, `data/${code}/metiers.json`, langue, IGNORER_METIERS);
  const { elements, ...reste } = galerieBase;
  verifierTraduction(reste, langue.galerie, `data/${code}/galerie.json`, langue, IGNORER_GALERIE);
  elements.forEach((el, i) => {
    const { video, ...textes } = el;
    verifierTraduction(textes, langue.galerie.elements[i], `data/${code}/galerie.json elements.${el.id}`, langue, IGNORER_GALERIE);
  });
}

// Adresse publique d'une page dans une langue donnee.
const adressePage = (langue, slug) =>
  siteBase.url + langue.prefixe + (slug === "index" ? "" : urlPage(slug));

const profondeur = (prefixe) => prefixe.split("/").filter(Boolean).length;

/* ------------------------------------------------------------------ */
/* Aides appelables depuis les gabarits : {{@ nom argument }}          */
/* ------------------------------------------------------------------ */

// Un element rattache a un chantier suivi porte son identifiant : le filtre
// « Nouadhibou » de la galerie s'appuie dessus.
const attributProjet = (el) => (el.projet ? ` data-projet="${el.projet}"` : "");

const figure = (el, ctx) => {
  const legende = echapper(el.legende || el.titre);
  if (el.video) {
    return [
      `<figure class="shot is-video" data-cat="${el.cat}"${attributProjet(el)}>`,
      `  <button class="shot-play" type="button" data-video="${urlFichier(el.video)}" style="--ar:${el.ar}" data-title="${echapper(el.titre)}">`,
      `    <span class="play-badge" aria-hidden="true"></span>`,
      `    <span class="play-label">${echapper(el.label)} <span class="play-weight">${echapper(ctx.t.video)} · ${poidsVideo(el.video, ctx.t)}</span></span>`,
      `  </button>`,
      `  <figcaption>${legende}</figcaption>`,
      `</figure>`,
    ].join("\n");
  }
  const tailles = [...el.tailles].sort((a, b) => a - b);
  const plusGrande = tailles[tailles.length - 1];
  const attributsSource =
    tailles.length > 1
      ? `src="${imageGalerie(el.id, tailles[0])}" srcset="${tailles
          .map((t) => `${imageGalerie(el.id, t)} ${t}w`)
          .join(", ")}" sizes="(min-width: 960px) 360px, 45vw"`
      : `src="${imageGalerie(el.id, tailles[0])}"`;
  return [
    `<figure class="shot" data-cat="${el.cat}"${attributProjet(el)}>`,
    `  <button class="shot-open" type="button" data-full="${imageGalerie(el.id, plusGrande)}" data-title="${echapper(el.titre)}">`,
    `    <img ${attributsSource} width="${el.w}" height="${el.h}" alt="${echapper(el.alt)}" loading="lazy" decoding="async" />`,
    `  </button>`,
    `  <figcaption>${legende}</figcaption>`,
    `</figure>`,
  ].join("\n");
};

// Largeurs d'affichage selon l'emplacement : le navigateur choisit ainsi
// le fichier le plus leger qui reste net.
const FORMATS = {
  galerie: "(min-width: 960px) 360px, 45vw",
  carte: "(min-width: 860px) 360px, 92vw",
  pile: "368px",
  mosaique: "(min-width: 960px) 290px, 50vw",
  landing: "(min-width: 960px) 420px, 92vw",
  video: "(min-width: 1180px) 580px, (min-width: 960px) 50vw, 100vw",
};

const photo = (id, format, ctx) => {
  const el = ctx.elements.get(id);
  if (!el || el.video) {
    erreurs.push(`photo inconnue dans la galerie : "${id}"`);
    return "";
  }
  if (!FORMATS[format]) erreurs.push(`format de photo inconnu : "${format}"`);
  const tailles = [...el.tailles].sort((a, b) => a - b);
  const sources =
    tailles.length > 1
      ? ` srcset="${tailles.map((t) => `${imageGalerie(id, t)} ${t}w`).join(", ")}" sizes="${FORMATS[format]}"`
      : "";
  return `<img src="${imageGalerie(id, tailles[0])}"${sources} width="${el.w}" height="${el.h}" alt="${echapper(el.alt)}" loading="lazy" decoding="async" />`;
};

// Titres de couverture : chaque mot est enveloppe pour monter derriere un
// masque. Fait au build, donc sans script ni saut au chargement.
const decouperTitres = (html) =>
  html.replace(/<h1>([^<]+)<\/h1>/g, (_, texte) => {
    const mots = texte.trim().split(/\s+/);
    const spans = mots.map((mot, i) => `<span class="mot"><span style="--i:${i}">${mot}</span></span>`);
    return `<h1 class="titre-anime">${spans.join(" ")}</h1>`;
  });

const aides = {
  photo: (ctx, id, format = "galerie") => photo(id, format, ctx),

  filtres: (ctx) => {
    const { galerie, t } = ctx;
    const puce = (id, nom, nombre, active, classe = "") =>
      `<button type="button" class="filter-chip${active ? " is-active" : ""}${classe}" data-filter="${id}" aria-pressed="${active}">${echapper(nom)} <span class="chip-count">${nombre}</span></button>`;
    return [
      puce("all", t.filtre_tout, galerie.elements.length, true),
      // Les chantiers en cours passent juste apres « Tout » : c'est ce qu'un
      // visiteur qui revient cherche en premier.
      ...(galerie.projets || []).map((p) =>
        puce(`projet-${p.id}`, p.puce, galerie.elements.filter((el) => el.projet === p.id).length, false, " filter-chip-projet")
      ),
      ...galerie.categories.map((c) =>
        puce(c.id, c.nom, galerie.elements.filter((el) => el.cat === c.id).length, false)
      ),
    ].join("\n");
  },

  // Page d'atterrissage d'un metier (campagnes Facebook / WhatsApp). Tout le
  // texte vient de src/data/metiers.json ; les photos, de la galerie.
  landing: (ctx, id) => {
    const m = ctx.metiers[id];
    if (!m) {
      erreurs.push(`landing : metier inconnu "${id}"`);
      return "";
    }
    const galerieHtml = m.galerie
      .map((gid) => {
        const el = ctx.elements.get(gid);
        if (!el) erreurs.push(`landing ${id} : element de galerie inconnu "${gid}"`);
        return el ? figure(el, ctx) : "";
      })
      .filter(Boolean)
      .join("\n\n");
    const donnees = {
      ...m,
      photoHtml: photo(m.photo.id, "landing", ctx).replace(' loading="lazy"', ' fetchpriority="high"'),
      confianceHtml: m.confiance.map((c) => `<li>${echapper(c)}</li>`).join("\n"),
      prestationsHtml: m.prestations
        .map(
          (p, i) =>
            `<article class="card lp-prestation"><span class="lp-numero">${String(i + 1).padStart(2, "0")}</span><h3>${echapper(p.titre)}</h3><p>${echapper(p.texte)}</p></article>`
        )
        .join("\n"),
      referencesHtml: m.references.length
        ? `<ul class="lp-references">\n${m.references
            .map((r) => `  <li><strong>${echapper(r.nom)}</strong><span>${echapper(r.detail)}</span></li>`)
            .join("\n")}\n</ul>`
        : "",
      galerieHtml,
      faqHtml: m.faq
        .map((f) => `<details data-reveal>\n  <summary>${echapper(f.q)}</summary>\n  <p>${echapper(f.r)}</p>\n</details>`)
        .join("\n"),
    };
    return rendre(lire(join(SRC, "partials/landing.html")).replace(/\n$/, ""), { ...ctx, m: donnees }, ["landing"]);
  },

  // Section « chantier phare » de l'accueil, entierement tiree de
  // galerie.json : pour publier un nouveau point d'avancement, on modifie
  // les etapes et la date dans le fichier de donnees, rien d'autre.
  "chantier-phare": (ctx, id) => {
    const { galerie, t } = ctx;
    const projet = (galerie.projets || []).find((p) => p.id === id);
    if (!projet) {
      erreurs.push(`chantier-phare : projet inconnu "${id}"`);
      return "";
    }
    const libelles = t.etats;
    const lienGalerie = `realisations.html?filtre=projet-${projet.id}`;
    const affiche = (l) => `assets/img/video/${projet.video.affiche}-${l}.jpg`;
    const donnees = {
      ...projet,
      nombreMedias: galerie.elements.filter((el) => el.projet === projet.id).length,
      lienGalerie,
      programmeHtml: projet.programme.map((p) => `<li>${echapper(p)}</li>`).join("\n"),
      etapesHtml: projet.etapes
        .map((e) => {
          if (!libelles[e.etat]) erreurs.push(`chantier-phare : etat inconnu "${e.etat}"`);
          return `<li class="etape-${e.etat}"><span class="etape-nom">${echapper(e.nom)}</span><span class="etape-etat">${libelles[e.etat]}</span></li>`;
        })
        .join("\n"),
      nombreBlocs: (projet.blocs || []).length,
      blocsHtml: (projet.blocs || [])
        .map((b) => `<div class="phare-bloc"><dt>${echapper(b.nom)}</dt><dd>${echapper(b.travaux)}</dd></div>`)
        .join("\n"),
      mosaiqueHtml: projet.mosaique
        .map((pid) => `<a class="phare-photo" href="${lienGalerie}">${photo(pid, "mosaique", ctx)}</a>`)
        .join("\n"),
      afficheHtml: `<img src="${affiche(960)}" srcset="${[640, 960, 1280]
        .map((l) => `${affiche(l)} ${l}w`)
        .join(", ")}" sizes="${FORMATS.video}" width="1280" height="720" alt="" loading="lazy" decoding="async" />`,
      poids540: poidsVideo(projet.video.sources["540"], t),
      poids720: poidsVideo(projet.video.sources["720"], t),
    };
    return rendre(lire(join(SRC, "partials/chantier-phare.html")).replace(/\n$/, ""), { ...ctx, projet: donnees }, [
      "chantier-phare",
    ]);
  },

  "nombre-realisations": (ctx) => String(ctx.galerie.elements.length),

  // Adresses e-mail (site.json) : "lignes" les separe par un retour a la
  // ligne, "liste" en fait des elements de liste.
  emails: (ctx, format = "lignes") => {
    const liens = ctx.site.emails.map((e) => `<a href="mailto:${echapper(e)}">${ctx.ltr(echapper(e))}</a>`);
    return format === "liste" ? liens.map((l) => `<li>${l}</li>`).join("\n") : liens.join("<br />");
  },

  // Bandeau defilant des references : trois pistes identiques, pour qu'aucun
  // vide n'apparaisse en fin de cycle meme sur un tres grand ecran. Seule la
  // premiere est lue par les lecteurs d'ecran.
  defilant: (ctx) => {
    const items = ctx.site.references.map((nom) => `  <li>${echapper(nom)}</li>`).join("\n");
    return [0, 1, 2]
      .map((i) => `<ul class="defilant-piste"${i ? ' aria-hidden="true"' : ""}>\n${items}\n</ul>`)
      .join("\n");
  },

  bandeau: (ctx) => {
    if (ctx.page.bandeau === "non") return "";
    const bandeau = {
      titre: ctx.page.bandeau_titre || ctx.t.bandeau_titre,
      texte: ctx.page.bandeau_texte || ctx.t.bandeau_texte,
    };
    return rendre(lire(join(SRC, "partials/bandeau-cta.html")).replace(/\n$/, ""), { ...ctx, bandeau }, ["bandeau-cta"]);
  },

  navigation: (ctx) =>
    ctx.site.navigation
      .map(
        (n) =>
          `<li><a${n.page === ctx.page.slug ? ' class="active"' : ""} href="${urlPage(n.page)}">${echapper(n.titre)}</a></li>`
      )
      .join("\n"),

  "liens-pied": (ctx) =>
    ctx.site.navigation.map((n) => `<a href="${urlPage(n.page)}">${echapper(n.titrePied || n.titre)}</a>`).join("\n"),

  galerie: (ctx, selection) => {
    const { galerie } = ctx;
    const liste =
      selection === "accueil"
        ? galerie.accueil.map((id) => {
            const el = ctx.elements.get(id);
            if (!el) erreurs.push(`galerie.accueil : identifiant inconnu "${id}"`);
            return el;
          })
        : galerie.elements;
    return liste
      .filter(Boolean)
      .map((el) => figure(el, ctx))
      .join("\n\n");
  },

  // Lien vers la meme page dans les autres langues. Ecrit dans la langue
  // d'arrivee, pour qu'un visiteur perdu reconnaisse la sienne ; hors de la
  // langue courante, il garde la police systeme et ne charge donc aucune fonte.
  langues: (ctx) =>
    langues
      .filter((l) => l.code !== ctx.langue.code)
      .map((l) => {
        const href = "../".repeat(profondeur(ctx.langue.prefixe)) + l.prefixe + urlPage(ctx.page.slug);
        return `<a class="langue-lien" href="${href}" hreflang="${l.code}" lang="${l.code}" dir="${l.dir}" data-langue="${l.code}">${echapper(l.nom)}</a>`;
      })
      .join("\n"),

  // Declare a Google chaque version de la page : il presente alors au
  // visiteur celle de sa langue, sans la compter comme du contenu en double.
  alternatives: (ctx) =>
    [
      ...langues.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${adressePage(l, ctx.page.slug)}" />`),
      `<link rel="alternate" hreflang="x-default" href="${adressePage(langueReference, ctx.page.slug)}" />`,
    ].join("\n"),

  "locales-alternatives": (ctx) =>
    langues
      .filter((l) => l.code !== ctx.langue.code)
      .map((l) => `<meta property="og:locale:alternate" content="${l.locale}" />`)
      .join("\n"),

  // Donnees structurees schema.org : reconstruites depuis site.json, donc
  // toujours d'accord avec les coordonnees affichees.
  //   jsonld: oui      -> l'entreprise (accueil)
  //   jsonld: contact  -> une page de contact qui decrit cette meme entreprise
  // Les deux portent le meme @id : Google les rattache a une seule fiche.
  jsonld: (ctx) => {
    if (ctx.page.jsonld !== "oui" && ctx.page.jsonld !== "contact") return "";
    const { site } = ctx;
    const entreprise = {
      "@type": "GeneralContractor",
      "@id": site.url + "#entreprise",
      name: site.nom,
      alternateName: site.nomComplet,
      description: ctx.t.jsonld_description,
      url: adressePage(ctx.langue, "index"),
      logo: site.url + "logo.jpeg",
      image: site.url + "logo.jpeg",
      foundingDate: site.fondation,
      email: site.emails,
      telephone: site.telephones.principal.lien,
      address: {
        "@type": "PostalAddress",
        streetAddress: site.adresse.rue,
        addressLocality: site.adresse.ville,
        addressCountry: site.adresse.codePays,
      },
      geo: { "@type": "GeoCoordinates", ...site.geo },
      areaServed: site.pays.map((name) => ({ "@type": "Country", name })),
      knowsAbout: site.domaines,
      // Point de contact explicite : c'est la forme que Google lit pour
      // repondre a « comment contacter SOBAFOR ».
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "customer service",
          telephone: site.telephones.principal.lien,
          email: site.emails,
          availableLanguage: langues.map((l) => l.nomAnglais),
        },
      ],
    };
    const donnees =
      ctx.page.jsonld === "contact"
        ? {
            "@context": "https://schema.org",
            "@type": "ContactPage",
            url: ctx.page.url,
            name: ctx.page.titre,
            inLanguage: ctx.langue.code,
            mainEntity: entreprise,
          }
        : { "@context": "https://schema.org", ...entreprise };
    return `<script type="application/ld+json">\n${JSON.stringify(donnees, null, 2)}\n</script>`;
  },
};

/* ------------------------------------------------------------------ */
/* Moteur de gabarits                                                  */
/* ------------------------------------------------------------------ */

const valeur = (chemin, ctx) => {
  let v = ctx;
  for (const cle of chemin.split(".")) {
    v = v == null ? undefined : v[cle];
  }
  if (v === undefined) throw new Error(`valeur inconnue : {{ ${chemin} }}`);
  return v;
};

const rendreBalise = (balise, ctx, pile) => {
  let m;
  if ((m = balise.match(/^\{\{\{\s*([\w.-]+)\s*\}\}\}$/))) return String(valeur(m[1], ctx));
  if ((m = balise.match(/^\{\{>\s*([\w-]+)\s*\}\}$/))) {
    const nom = m[1];
    if (pile.includes(nom)) throw new Error(`inclusion circulaire : ${[...pile, nom].join(" > ")}`);
    const chemin = join(SRC, "partials", nom + ".html");
    if (!existsSync(chemin)) throw new Error(`partiel introuvable : src/partials/${nom}.html`);
    return rendre(lire(chemin).replace(/\n$/, ""), ctx, [...pile, nom]);
  }
  if ((m = balise.match(/^\{\{@\s*([\w-]+)((?:\s+[^\s}]+)*)\s*\}\}$/))) {
    const aide = aides[m[1]];
    if (!aide) throw new Error(`aide inconnue : {{@ ${m[1]} }}`);
    return aide(ctx, ...m[2].trim().split(/\s+/).filter(Boolean));
  }
  if ((m = balise.match(/^\{\{\s*([\w.-]+)\s*\}\}$/))) return echapper(valeur(m[1], ctx));
  throw new Error(`balise illisible : ${balise}`);
};

const BALISE = /\{\{\{[^}]*\}\}\}|\{\{[^}]*\}\}/g;

function rendre(modele, ctx, pile = []) {
  return modele
    .split("\n")
    .flatMap((ligne) => {
      const seule = ligne.match(/^([ \t]*)(\{\{\{[^}]*\}\}\}|\{\{[^}]*\}\})[ \t]*$/);
      if (seule) {
        const sortie = rendreBalise(seule[2], ctx, pile);
        if (sortie === "") return [];
        return sortie.split("\n").map((l) => (l === "" ? l : seule[1] + l));
      }
      return [ligne.replace(BALISE, (b) => rendreBalise(b, ctx, pile))];
    })
    .join("\n");
}

const lirePage = (fichier, langue) => {
  const source = langue.prefixe + fichier;
  const texte = lire(join(SRC, "pages", source));
  const m = texte.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`en-tete --- manquant dans src/pages/${source}`);
  const page = { slug: fichier.replace(/\.html$/, "") };
  for (const ligne of m[1].split("\n")) {
    const i = ligne.indexOf(":");
    if (i > 0) page[ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim();
  }
  page.url = adressePage(langue, page.slug);
  page.source = source;
  page.og_image = page.og_image || "logo.jpeg";
  return { page, corps: m[2].replace(/\n+$/, "") };
};

/* ------------------------------------------------------------------ */
/* Production                                                          */
/* ------------------------------------------------------------------ */

const produits = new Map();
const ecrire = (relatif, contenu) => {
  produits.set(relatif, contenu);
  const complet = join(RACINE, relatif);
  const ancien = existsSync(complet) ? lire(complet) : null;
  if (ancien !== contenu) {
    mkdirSync(dirname(complet), { recursive: true });
    writeFileSync(complet, contenu);
  }
  return ancien !== contenu;
};

const bandeau = (source) => `Généré par build.mjs depuis ${source} — modifier la source, pas ce fichier.`;

const empreinteDe = (contenu) => createHash("sha256").update(contenu).digest("hex").slice(0, 10);

// Feuille de styles : concatenation dans l'ordre des noms de fichiers.
const css =
  `/* ${bandeau("src/css/")} */\n\n` + fichiers("css", ".css").map((f) => lire(join(SRC, "css", f))).join("");
ecrire("assets/css/style.css", css);

// Script : un seul fichier, donc une seule requete sur reseau lent. Chaque
// module est enferme dans un bloc pour que ses variables ne debordent pas ;
// les fichiers 00-* restent au niveau commun (outils partages).
const textesScripts = JSON.stringify(Object.fromEntries(langues.map((l) => [l.code, l.t.js])));
const modules = fichiers("js", ".js").map((f) => {
  const code = lire(join(SRC, "js", f))
    .replace(/\n+$/, "")
    .replace("__TEXTES__", () => textesScripts);
  const indente = (texte, n) =>
    texte
      .split("\n")
      .map((l) => (l ? " ".repeat(n) + l : l))
      .join("\n");
  return f.startsWith("00-")
    ? `  // ---- ${f}\n${indente(code, 2)}`
    : `  // ---- ${f}\n  {\n${indente(code, 4)}\n  }`;
});
const js = `/* ${bandeau("src/js/")} */\n(() => {\n${modules.join("\n\n")}\n})();\n`;
ecrire("assets/js/main.js", js);

// Empreintes ajoutees aux adresses (style.css?v=...) : une page neuve
// reclame toujours la feuille et le script qui vont avec elle, meme si
// l'ancienne version dort encore dans le cache du telephone.
const versions = { css: empreinteDe(css), js: empreinteDe(js) };

// Dans le dossier d'une langue, seuls les liens vers ses propres pages restent
// tels quels : tout le reste (images, styles, videos) vit a la racine. Le
// gabarit ecrit donc une seule fois ses chemins, et ils sont adaptes ici.
// <base href> ferait la meme chose, mais il casserait les ancres (#devis).
const adapterChemins = (html, langue, locaux) => {
  const remonter = "../".repeat(profondeur(langue.prefixe));
  if (!remonter) return html;
  const adapter = (cible) => {
    if (/^(https?:|mailto:|tel:|#|data:|\.\.\/)/.test(cible)) return cible;
    return locaux.has(cible.split(/[?#]/)[0]) ? cible : remonter + cible;
  };
  return html
    .replace(/(\s(?:src|href|data-full|data-video|data-video-540|data-video-720)=")([^"]+)"/g, (_, attribut, cible) => `${attribut}${adapter(cible)}"`)
    .replace(/(\ssrcset=")([^"]+)"/g, (_, attribut, liste) => {
      const sources = liste.split(",").map((source) => {
        const [url, ...largeur] = source.trim().split(/\s+/);
        return [adapter(url), ...largeur].join(" ");
      });
      return `${attribut}${sources.join(", ")}"`;
    });
};

// Filet de securite : hors noms propres declares, une page traduite ne doit
// plus contenir deux mots latins de suite, ni dans le texte ni dans les
// attributs lus par les visiteurs et les lecteurs d'ecran.
const texteOubliee = (html, langue) => {
  const attributs = [...html.matchAll(/\s(?:alt|title|aria-label|placeholder|data-title)="([^"]*)"/g)].map((m) => m[1]);
  const meta = [...html.matchAll(/<meta (?:name="description"|property="og:(?:title|description)") content="([^"]*)"/g)].map((m) => m[1]);
  const titre = html.match(/<title>([^<]*)<\/title>/)?.[1] || "";
  const corps = html.replace(/<(script|style)[\s\S]*?<\/\1>/g, "\n").replace(/<[^>]+>/g, "\n");
  const texte = [titre, ...meta, ...attributs, corps].join("\n").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'");
  const nettoye = langue.latinAutorise.reduce((t, autorise) => t.split(autorise).join(" "), texte);
  return [...new Set([...nettoye.matchAll(/[A-Za-zÀ-ÿŒœ'’-]{2,}(?:[ \t]+[A-Za-zÀ-ÿŒœ'’-]{2,})+/g)].map((m) => m[0]))];
};

// Pages
const slugs = fichiers("pages", ".html");
const pages = [];
const annee = new Date().getFullYear();

for (const langue of langues) {
  const liste = langue.reference ? slugs : fichiers(`pages/${langue.code}`, ".html");
  for (const f of slugs) {
    if (!liste.includes(f)) erreurs.push(`page non traduite (${langue.code}) : src/pages/${langue.code}/${f}`);
  }
  // Fichiers propres a chaque langue : ils restent dans son dossier.
  const locaux = new Set([...liste, "manifest.webmanifest"]);

  for (const fichier of liste) {
    const { page, corps } = lirePage(fichier, langue);
    pages.push({ page, langue });
    const { site, t } = langue;
    // Numeros et identifiants se lisent de gauche a droite dans toutes les
    // langues : dans une page arabe, sans cette enveloppe, le « +227 » finit
    // de l'autre cote du numero.
    const ltr = (texte) => (langue.dir === "rtl" ? `<bdi dir="ltr">${texte}</bdi>` : texte);
    const ctx = {
      site,
      galerie: langue.galerie,
      metiers: langue.metiers,
      elements: langue.elements,
      t,
      langue,
      page,
      annee,
      experience: annee - Number(site.fondation),
      whatsapp,
      versions,
      ltr,
      tel: {
        court: ltr(echapper(site.telephones.principal.court)),
        affiche: ltr(echapper(site.telephones.principal.affiche)),
        dg: ltr(echapper(site.telephones.dg.affiche)),
      },
      legal: ltr(echapper(`RCCM ${site.rccm} | NIF ${site.nif}`)),
      // Sur une page d'atterrissage, « Devis » mene au formulaire de la page
      // meme : le visiteur venu d'une publicite ne doit pas en sortir.
      lienDevis: page.gabarit === "landing" ? "#devis" : "devis.html",
      // Le formulaire de contact ecrit a toutes les adresses a la fois.
      emailsDestinataires: site.emails.join(","),
    };
    try {
      ctx.contenu = decouperTitres(rendre(corps, ctx));
      const gabarit = lire(join(SRC, "layouts", (page.gabarit || "base") + ".html")).replace(/\n$/, "");
      const html = adapterChemins(rendre(gabarit, ctx), langue, locaux).replace(
        "<!DOCTYPE html>\n",
        `<!DOCTYPE html>\n<!-- ${bandeau(`src/pages/${page.source}`)} -->\n`
      );
      ecrire(langue.prefixe + urlPage(page.slug), html + "\n");
      if (!langue.reference) {
        for (const oubli of texteOubliee(html, langue)) {
          erreurs.push(`texte non traduit dans ${langue.prefixe}${urlPage(page.slug)} : « ${oubli} »`);
        }
      }
    } catch (e) {
      erreurs.push(`src/pages/${page.source} : ${e.message}`);
    }
  }
}

// Application installable : chaque langue a son nom et sa page de depart, sans
// quoi un visiteur arabe qui installe le site tomberait sur l'accueil francais.
const manifeste = lireJSON(join(RACINE, "manifest.webmanifest"));
for (const langue of langues.slice(1)) {
  const remonter = "../".repeat(profondeur(langue.prefixe));
  const { manifest: textes } = langue.t;
  const icone = (i) => ({ ...i, src: remonter + i.src });
  ecrire(
    langue.prefixe + "manifest.webmanifest",
    JSON.stringify(
      {
        ...manifeste,
        name: textes.nom,
        description: textes.description,
        lang: langue.code,
        dir: langue.dir,
        scope: remonter,
        icons: manifeste.icons.map(icone),
        shortcuts: manifeste.shortcuts.map((raccourci, i) => ({
          ...raccourci,
          name: [textes.realisations, textes.devis][i],
          icons: raccourci.icons.map(icone),
        })),
      },
      null,
      2
    ) + "\n"
  );
}

// Plan du site et robots.txt : generes eux aussi, pour que les adresses
// declarees a Google ne puissent pas s'ecarter de celles des pages.
const plan = pages
  .filter(({ page }) => page.gabarit !== "minimal")
  .map(({ page, langue }) => {
    const liens = [
      ...langues.map((l) => [l.code, adressePage(l, page.slug)]),
      ["x-default", adressePage(langueReference, page.slug)],
    ].map(([code, href]) => `    <xhtml:link rel="alternate" hreflang="${code}" href="${href}" />`);
    return `  <url>\n    <loc>${adressePage(langue, page.slug)}</loc>\n${liens.join("\n")}\n  </url>`;
  });
ecrire(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${plan.join("\n")}\n</urlset>\n`
);
ecrire("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${siteBase.url}sitemap.xml\n`);

// Service worker : sa version derive du contenu de la coque. Toute
// modification change donc la version, et les visiteurs recoivent les
// nouveaux fichiers au lieu de l'ancien cache.
// Seul le strict minimum est precharge pour tout le monde. Les pages arrivent
// ensuite dans la langue du visiteur (voir src/js/10-hors-ligne.js), et les
// fontes arabes ne sont mises en cache que par ceux qui les affichent.
const coque = [
  "./",
  ...langues.map((l) => `./${l.prefixe}hors-ligne.html`),
  `./assets/css/style.css?v=${versions.css}`,
  `./assets/js/main.js?v=${versions.js}`,
  ...readdirSync(join(RACINE, "assets/fonts"))
    .filter((f) => f.endsWith(".woff2") && !f.includes("arabe"))
    .sort()
    .map((f) => "./assets/fonts/" + f),
  "./logo.jpeg",
  "./assets/icons/icone-192.png",
  "./manifest.webmanifest",
];
const empreinte = createHash("sha256");
for (const f of coque.slice(1)) {
  const rel = f.slice(2).split("?")[0];
  empreinte.update(produits.has(rel) ? produits.get(rel) : readFileSync(join(RACINE, rel)));
}
// Toutes les pages comptent, meme celles qui ne sont pas prechargees : une
// correction de texte doit renouveler le cache comme avant.
for (const [fichier, contenu] of produits) {
  if (fichier.endsWith(".html")) empreinte.update(contenu);
}
const version = empreinte.digest("hex").slice(0, 10);
ecrire(
  "sw.js",
  `/* ${bandeau("src/sw.js")} */\n` +
    lire(join(SRC, "sw.js"))
      .replace("__VERSION__", version)
      .replace("__A_PRECHARGER__", JSON.stringify(coque, null, 2))
);

/* ------------------------------------------------------------------ */
/* Controle des liens internes                                         */
/* ------------------------------------------------------------------ */

for (const [fichier, contenu] of produits) {
  if (!fichier.endsWith(".html")) continue;
  const cibles = new Set();
  for (const m of contenu.matchAll(/\s(?:src|href|data-full|data-video|data-video-540|data-video-720)="([^"]+)"/g)) {
    cibles.add(m[1]);
  }
  for (const m of contenu.matchAll(/\ssrcset="([^"]+)"/g)) {
    m[1].split(",").forEach((part) => cibles.add(part.trim().split(/\s+/)[0]));
  }
  for (const cible of cibles) {
    if (/^(https?:|mailto:|tel:|#|data:)/.test(cible)) continue;
    const chemin = decodeURI(cible.split(/[?#]/)[0]);
    if (!existsSync(join(RACINE, dirname(fichier), chemin))) erreurs.push(`${fichier} : lien casse vers ${cible}`);
  }
}

/* ------------------------------------------------------------------ */

if (erreurs.length) {
  console.error(`\n${erreurs.length} probleme(s) :\n  - ` + erreurs.join("\n  - ") + "\n");
  process.exit(1);
}
const nbElements = galerieBase.elements.length;
console.log(
  `Site genere : ${pages.length} pages en ${langues.length} langues, galerie de ${nbElements} elements, service worker ${version}.`
);
