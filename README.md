# Kalkulette

Calculatrice scientifique en français, avec traceur de fonctions, matrices, vecteurs, équations et convertisseur d'unités. Interface Material 3 Expressive construite avec [K3ui](https://github.com/Kam3leoN/k3ui-expressive).

TypeScript · SCSS · Vite — déployable tel quel sur Vercel.

## Fonctions

- **Calculatrice** : modes COMP (réels), CMPLX (complexes, formes algébrique et polaire) et CALC (variables, SOLVE) ; DEG/RAD ; SHIFT et hyp ; formes exactes (fractions, racines, multiples de π) avec S⇔D ; intégrale, dérivée, somme Σ, nCr/nPr ; mémoires A à Y et Ans ; saisie au clavier physique.
- **Graphe** : jusqu'à trois fonctions de X ; déplacement, zoom à la molette ou au pincement, lecture des valeurs au survol.
- **Matrices** : jusqu'à 4 × 4 ; somme, produit, déterminant, inverse, transposée, carré, rang.
- **Vecteurs** : 2D et 3D ; somme, produits scalaire et vectoriel, norme, angle, vecteur unitaire.
- **Équations** : systèmes linéaires à 2 ou 3 inconnues, polynômes de degré 2 à 4 (racines complexes comprises).
- **Unités** : 12 catégories.
- **Historique** conservé dans le navigateur.
- **Thème** : schéma M3 Tonal Spot (spécification 2025) généré depuis 5 couleurs au choix ; clair, sombre ou automatique.
- **Mobile (< 600 px)** : les outils s'ouvrent dans une feuille du bas, depuis une barre de navigation.

## Démarrer

Node.js 18.18 ou plus récent.

```bash
npm install
npm run dev        # serveur de développement : http://localhost:5173
npm test           # tests du moteur de calcul (Vitest)
npm run build      # vérification TypeScript puis build de production dans dist/
npm run preview    # sert dist/ localement
```

## Déployer sur Vercel

1. Poussez le dépôt sur GitHub.
2. Sur [vercel.com](https://vercel.com), **Add New › Project**, puis importez le dépôt.
3. Vercel détecte Vite ; `vercel.json` fixe la commande (`npm run build`) et le dossier de sortie (`dist`). Cliquez sur **Deploy**.

Chaque push sur `main` redéploie l'application ; chaque pull request obtient une URL de prévisualisation. Avec la CLI : `npx vercel` (prévisualisation) puis `npx vercel --prod`.

## Structure

```
index.html                     page (balisage des composants K3ui)
public/favicon.svg
src/
  main.ts                      point d'entrée : styles, K3ui, initialisation
  k3ui-config.ts               options K3ui (thème Tonal Spot 2025, langue)
  engine/                      moteur de calcul, sans DOM
    complex.ts                 arithmétique complexe
    lexer.ts · parser.ts       analyse lexicale et syntaxique (arbre)
    evaluator.ts               évaluation réelle/complexe, DEG/RAD, fonctions
    numeric.ts                 fractions, gamma, intégration
    format.ts                  affichage (10 chiffres, ×10ⁿ, formes exactes)
    engine.test.ts             tests Vitest
  math/                        algèbre linéaire, polynômes, résolution numérique
  ui/                          état, calculatrice, historique, navigation, thème, licence
  tools/                       graphe, matrices, vecteurs, équations, unités
  styles/                      SCSS : tokens, base, calculatrice, outils, mobile…
  assets/fonts/                Google Sans, JetBrains Mono, Material Symbols (sous-ensemble)
  vendor/k3ui/                 paquet K3ui réduit aux composants utilisés (voir son README)
  types/k3ui.d.ts              types des éléments K3ui utilisés
licenses/                      textes des licences tierces
vercel.json                    configuration Vercel (build, cache des assets)
```

Les couleurs viennent exclusivement des rôles M3 générés par K3ui (`--k3-sys-color-*`) : changer la couleur source régénère tout le thème.

## Licence

© 2026 Cédric MALZAT (Kam3leoN). Tous droits réservés. Voir [LICENSE.md](LICENSE.md). Les composants tiers restent sous leur propre licence : voir [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
