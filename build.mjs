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
 *   src/data/site.json      coordonnees, navigation : une seule source
 *   src/data/galerie.json   photos et videos des realisations
 *   src/layouts/            squelettes de page
 *   src/partials/           en-tete, pied de page, barre mobile...
 *   src/pages/              contenu propre a chaque page
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
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
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

const site = lireJSON(join(SRC, "data/site.json"));
const galerie = lireJSON(join(SRC, "data/galerie.json"));

const urlPage = (slug) => (slug === "index" ? "index.html" : `${slug}.html`);
const whatsapp = "https://wa.me/" + site.telephones.principal.lien.replace(/^\+/, "");

// Poids affiche sous chaque video, lu sur le fichier lui-meme : il reste
// juste meme quand une video est remplacee.
const poidsVideo = (chemin) => {
  const complet = join(RACINE, chemin);
  if (!existsSync(complet)) {
    erreurs.push(`video introuvable : ${chemin}`);
    return "?";
  }
  return (statSync(complet).size / 1048576).toFixed(1).replace(".", ",") + " Mo";
};

// Chemins de videos : espaces et parentheses encodes, apostrophe conservee.
const urlFichier = (chemin) => encodeURI(chemin).replace(/\(/g, "%28").replace(/\)/g, "%29");

const imageGalerie = (id, largeur) => `assets/img/gallery/${id}-${largeur}.jpg`;

for (const el of galerie.elements) {
  if (el.video) continue;
  for (const t of el.tailles) {
    if (!existsSync(join(RACINE, imageGalerie(el.id, t)))) {
      erreurs.push(`image manquante : ${imageGalerie(el.id, t)}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Aides appelables depuis les gabarits : {{@ nom argument }}          */
/* ------------------------------------------------------------------ */

const figure = (el) => {
  const legende = echapper(el.legende || el.titre);
  if (el.video) {
    return [
      `<figure class="shot is-video" data-cat="${el.cat}">`,
      `  <button class="shot-play" type="button" data-video="${urlFichier(el.video)}" style="--ar:${el.ar}" data-title="${echapper(el.titre)}">`,
      `    <span class="play-badge" aria-hidden="true"></span>`,
      `    <span class="play-label">${echapper(el.label)} <span class="play-weight">Vidéo · ${poidsVideo(el.video)}</span></span>`,
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
    `<figure class="shot" data-cat="${el.cat}">`,
    `  <button class="shot-open" type="button" data-full="${imageGalerie(el.id, plusGrande)}" data-title="${echapper(el.titre)}">`,
    `    <img ${attributsSource} width="${el.w}" height="${el.h}" alt="${echapper(el.alt)}" loading="lazy" decoding="async" />`,
    `  </button>`,
    `  <figcaption>${legende}</figcaption>`,
    `</figure>`,
  ].join("\n");
};

const elementsParId = new Map(galerie.elements.map((el) => [el.id, el]));

// Largeurs d'affichage selon l'emplacement : le navigateur choisit ainsi
// le fichier le plus leger qui reste net.
const FORMATS = {
  galerie: "(min-width: 960px) 360px, 45vw",
  carte: "(min-width: 860px) 360px, 92vw",
  pile: "368px",
};

const photo = (id, format = "galerie") => {
  const el = elementsParId.get(id);
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
  photo: (ctx, id, format) => photo(id, format),

  filtres: () => {
    const puce = (id, nom, nombre, active) =>
      `<button type="button" class="filter-chip${active ? " is-active" : ""}" data-filter="${id}" aria-pressed="${active}">${echapper(nom)} <span class="chip-count">${nombre}</span></button>`;
    return [
      puce("all", "Tout", galerie.elements.length, true),
      ...galerie.categories.map((c) =>
        puce(c.id, c.nom, galerie.elements.filter((el) => el.cat === c.id).length, false)
      ),
    ].join("\n");
  },

  "nombre-realisations": () => String(galerie.elements.length),

  bandeau: (ctx) => {
    if (ctx.page.bandeau === "non") return "";
    const bandeau = {
      titre: ctx.page.bandeau_titre || "Un chantier à lancer ?",
      texte:
        ctx.page.bandeau_texte ||
        "Bâtiment, route, forage ou location d'engins : décrivez votre besoin, un chargé de projet vous répond avec une estimation et un planning d'exécution.",
    };
    return rendre(lire(join(SRC, "partials/bandeau-cta.html")).replace(/\n$/, ""), { ...ctx, bandeau }, ["bandeau-cta"]);
  },

  navigation: (ctx) =>
    site.navigation
      .map(
        (n) =>
          `<li><a${n.page === ctx.page.slug ? ' class="active"' : ""} href="${urlPage(n.page)}">${echapper(n.titre)}</a></li>`
      )
      .join("\n"),

  "liens-pied": () =>
    site.navigation.map((n) => `<a href="${urlPage(n.page)}">${echapper(n.titrePied || n.titre)}</a>`).join("\n"),

  galerie: (ctx, selection) => {
    const liste =
      selection === "accueil"
        ? galerie.accueil.map((id) => {
            const el = elementsParId.get(id);
            if (!el) erreurs.push(`galerie.accueil : identifiant inconnu "${id}"`);
            return el;
          })
        : galerie.elements;
    return liste.filter(Boolean).map(figure).join("\n\n");
  },

  // Donnees structurees schema.org : reconstruites depuis site.json, donc
  // toujours d'accord avec les coordonnees affichees.
  jsonld: (ctx) => {
    if (ctx.page.jsonld !== "oui") return "";
    const donnees = {
      "@context": "https://schema.org",
      "@type": "GeneralContractor",
      name: site.nom,
      alternateName: site.nomComplet,
      description:
        "Entreprise nigérienne de BTP fondée en 1987 : bâtiments et génie civil, routes et assainissement, hydraulique, forages, énergie solaire et location d'engins.",
      url: site.url,
      logo: site.url + "logo.jpeg",
      image: site.url + "logo.jpeg",
      foundingDate: site.fondation,
      email: site.email,
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
    };
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

const lirePage = (fichier) => {
  const texte = lire(join(SRC, "pages", fichier));
  const m = texte.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`en-tete --- manquant dans src/pages/${fichier}`);
  const page = { slug: fichier.replace(/\.html$/, "") };
  for (const ligne of m[1].split("\n")) {
    const i = ligne.indexOf(":");
    if (i > 0) page[ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim();
  }
  page.url = site.url + (page.slug === "index" ? "" : urlPage(page.slug));
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
  if (ancien !== contenu) writeFileSync(complet, contenu);
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
const modules = fichiers("js", ".js").map((f) => {
  const code = lire(join(SRC, "js", f)).replace(/\n+$/, "");
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

// Pages
const pages = fichiers("pages", ".html").map(lirePage);
for (const { page, corps } of pages) {
  const annee = new Date().getFullYear();
  const ctx = { site, page, annee, experience: annee - Number(site.fondation), whatsapp, versions };
  try {
    ctx.contenu = decouperTitres(rendre(corps, ctx));
    const gabarit = lire(join(SRC, "layouts", (page.gabarit || "base") + ".html")).replace(/\n$/, "");
    const html = rendre(gabarit, ctx).replace(
      "<!DOCTYPE html>\n",
      `<!DOCTYPE html>\n<!-- ${bandeau(`src/pages/${page.slug}.html`)} -->\n`
    );
    ecrire(urlPage(page.slug), html + "\n");
  } catch (e) {
    erreurs.push(`src/pages/${page.slug}.html : ${e.message}`);
  }
}

// Service worker : sa version derive du contenu de la coque. Toute
// modification change donc la version, et les visiteurs recoivent les
// nouveaux fichiers au lieu de l'ancien cache.
const coque = [
  "./",
  ...pages.map(({ page }) => "./" + urlPage(page.slug)),
  `./assets/css/style.css?v=${versions.css}`,
  `./assets/js/main.js?v=${versions.js}`,
  ...readdirSync(join(RACINE, "assets/fonts"))
    .filter((f) => f.endsWith(".woff2"))
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
  for (const m of contenu.matchAll(/\s(?:src|href|data-full|data-video)="([^"]+)"/g)) cibles.add(m[1]);
  for (const m of contenu.matchAll(/\ssrcset="([^"]+)"/g)) {
    m[1].split(",").forEach((part) => cibles.add(part.trim().split(/\s+/)[0]));
  }
  for (const cible of cibles) {
    if (/^(https?:|mailto:|tel:|#|data:)/.test(cible)) continue;
    const chemin = decodeURI(cible.split(/[?#]/)[0]);
    if (!existsSync(join(RACINE, chemin))) erreurs.push(`${fichier} : lien casse vers ${cible}`);
  }
}

/* ------------------------------------------------------------------ */

if (erreurs.length) {
  console.error(`\n${erreurs.length} probleme(s) :\n  - ` + erreurs.join("\n  - ") + "\n");
  process.exit(1);
}
const nbElements = galerie.elements.length;
console.log(
  `Site genere : ${pages.length} pages, galerie de ${nbElements} elements, service worker ${version}.`
);
