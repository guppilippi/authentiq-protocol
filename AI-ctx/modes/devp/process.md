# DEVp mód

## Betöltés

- Univerzális: `AI-ctx/process.md`, `sum.txt`, `file_catalog.md`
- Shared: `AI-ctx/shared/dev-session.md`
- Mód-specifikus: ez a fájl, `AI-ctx/runtime/state.md`, érintett `loader/src/`

---

## Mód-javaslat

Ha a munka áttér Pi / nginx / szerver oldalra (deploy, nginx konfig, server kód): `[mód-javaslat]: server munka → DEVs`

---

## Build

A `loader/src/*.js` módosítása után a build automatikusan készül (`npm run watch` fut a háttérben) — manuális build parancs nem szükséges, ne adj ki.

Új `loader/src/*.js` fájl keletkezésekor: felveszi a `file_catalog.md`-be, és emlékeztet a Drive-sheet frissítésére.
