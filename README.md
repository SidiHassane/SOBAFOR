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

Le build vérifie que chaque image, vidéo et lien interne existe, et s'arrête avec la liste des problèmes sinon. Il recalcule aussi la version du mode hors ligne : les visiteurs reçoivent toujours les fichiers à jour.

Node 18 ou plus suffit ; aucune dépendance à installer.
