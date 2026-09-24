/* Généré par build.mjs depuis src/sw.js — modifier la source, pas ce fichier. */
/* Service worker SOBAFOR
 *
 * Objectif : que le site se rouvre instantanement, et reste consultable
 * quand le reseau lache — situation courante sur les chantiers.
 *
 * Trois regles, selon la nature de la ressource :
 *   - pages HTML       : reseau d'abord, cache en secours (le contenu reste frais)
 *   - CSS / JS / polices : cache d'abord, mise a jour en arriere-plan
 *   - images           : cache d'abord, plafonne en nombre
 *
 * Les videos ne sont JAMAIS mises en cache : le dossier pese pres de
 * 95 Mo et saturerait le stockage du telephone.
 */

const VERSION = "sobafor-2bc6a5ee9c";
const COQUE = VERSION + "-coque";
const IMAGES = VERSION + "-images";
const PAGES = VERSION + "-pages";

const MAX_IMAGES = 80;

// Coque minimale : environ 350 Ko. On ne precharge pas les photos de la
// galerie, qui arriveront au fil de la consultation.
const A_PRECHARGER = [
  "./",
  "./a-propos.html",
  "./contact.html",
  "./devis.html",
  "./hors-ligne.html",
  "./index.html",
  "./realisations.html",
  "./services.html",
  "./assets/css/style.css?v=c926de139f",
  "./assets/js/main.js?v=ce345c4519",
  "./assets/fonts/archivo-500-800-latin.woff2",
  "./assets/fonts/plex-400-latin.woff2",
  "./assets/fonts/plex-600-latin.woff2",
  "./logo.jpeg",
  "./assets/icons/icone-192.png",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(COQUE).then((cache) =>
      // addAll echoue en bloc si une seule entree manque : on ajoute donc
      // une par une pour qu'un fichier absent ne casse pas l'installation.
      Promise.all(
        A_PRECHARGER.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => null)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((noms) =>
        Promise.all(
          noms
            .filter((n) => n.indexOf("sobafor-") === 0 && n.indexOf(VERSION) !== 0)
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* Plafonne un cache en supprimant les entrees les plus anciennes. */
async function plafonner(nomCache, maximum) {
  const cache = await caches.open(nomCache);
  const cles = await cache.keys();
  if (cles.length <= maximum) return;
  await Promise.all(cles.slice(0, cles.length - maximum).map((k) => cache.delete(k)));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Rien d'externe, rien d'autre que http(s).
  if (url.origin !== self.location.origin) return;

  // Les videos passent directement au reseau. Elles arrivent d'ailleurs par
  // requetes partielles (206), qu'on ne peut pas stocker telles quelles.
  if (/\.mp4$/i.test(url.pathname)) return;

  // Pages : reseau d'abord pour que le contenu reste a jour, cache ensuite,
  // et page d'attente si vraiment rien n'est disponible.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((rep) => {
          const copie = rep.clone();
          caches.open(PAGES).then((c) => c.put(req, copie));
          return rep;
        })
        .catch(() =>
          caches
            .match(req)
            .then((hit) => hit || caches.match("./hors-ligne.html"))
        )
    );
    return;
  }

  // Images : cache d'abord, le reseau ne sert qu'a la premiere rencontre.
  if (req.destination === "image") {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req)
            .then((rep) => {
              if (rep && rep.status === 200) {
                const copie = rep.clone();
                caches.open(IMAGES).then((c) => {
                  c.put(req, copie);
                  plafonner(IMAGES, MAX_IMAGES);
                });
              }
              return rep;
            })
            .catch(() => hit)
      )
    );
    return;
  }

  // Styles, scripts, polices : on sert le cache tout de suite et on
  // rafraichit en arriere-plan pour la visite suivante.
  event.respondWith(
    caches.match(req).then((hit) => {
      const reseau = fetch(req)
        .then((rep) => {
          if (rep && rep.status === 200) {
            const copie = rep.clone();
            caches.open(COQUE).then((c) => c.put(req, copie));
          }
          return rep;
        })
        .catch(() => hit);
      return hit || reseau;
    })
  );
});
