# Paquet K3ui

`k3ui.kalkulette.js` : K3ui 1.2.7 (MIT, © Kam3leoN) réduit aux composants utilisés par Kalkulette :
button, icon-button, button-group, tabs, text-field, select, chip, chip-set, card, switch, divider, tooltip,
nav-bar, nav-item, sheet, dialog (+ ripple, menu, menu-item).

Construit depuis le dépôt K3ui :

```bash
npm run build && npm run build:lazy
node scripts/build-pack.mjs k3-button k3-icon-button k3-button-group k3-tabs k3-text-field k3-select \
  k3-chip k3-chip-set k3-card k3-switch k3-divider k3-tooltip k3-nav-bar k3-nav-item k3-sheet k3-dialog \
  --name k3ui.kalkulette
```

avec une modification de `scripts/build-pack.mjs` : l'étape `densifyPackJs` + `packToOneLine` est retirée,
car la mise sur une seule ligne laisse des commentaires `//` qui avalent le reste du code
(« Unexpected end of input »). Le CSS de K3ui est injecté en tête avec `cssInjectPreamble(minifyCss(...))`.

Le jour où K3ui est publié sur npm, ce fichier peut être remplacé par `import 'k3ui'` (ou `k3ui/lazy`).
