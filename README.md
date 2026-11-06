# SOBAFOR

Site vitrine de SOBAFOR SA. Hébergement 100 % statique : les fichiers servis sont à la racine.

## Modifier le site

Les pages ne s'éditent **pas** à la racine : `index.html`, `assets/css/style.css`, `assets/js/main.js` et `sw.js` sont produits par le générateur. On modifie les sources dans `src/`, puis :

```bash
node build.mjs
```

| Pour changer…                          | Modifier                         |
| -------------------------------------- | -------------------------------- |
| téléphones, WhatsApp, adresse, e-mail  | `src/data/site.json`             |
| photos et vidéos de la galerie         | `src/data/galerie.json`          |
| texte d'une page                       | `src/pages/<page>.html`          |
| en-tête, pied de page, bandeaux        | `src/partials/`                  |
| styles / scripts                       | `src/css/`, `src/js/`            |
| texte arabe d'une page                 | `src/pages/ar/<page>.html`       |
| textes arabes des données              | `src/data/ar/`                   |
| boutons et libellés communs            | `src/i18n/fr.json`, `src/i18n/ar.json` |

Le build vérifie que chaque image, vidéo et lien interne existe, et s'arrête avec la liste des problèmes sinon. Il s'arrête aussi si un texte n'est pas traduit : une nouvelle photo ou une nouvelle page doit recevoir sa version arabe avant publication. Il recalcule aussi la version du mode hors ligne : les visiteurs reçoivent toujours les fichiers à jour.

Node 18 ou plus suffit ; aucune dépendance à installer.
