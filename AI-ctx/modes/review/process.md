# REVIEW mód

## Betöltés

- Univerzális: `AI-ctx/process.md`, `sum.txt`, `file_catalog.md`
- Mód-specifikus: ez a fájl, `js/aqProtocolLoader.js`

---

## Cél

A build-elt bundle vizsgálata — kód minőség, biztonsági szempontok, teszt vezénylés. Nincs implementáció, nincs session-state frissítés.

---

## Fókusz

- **Kód minőség**: redundancia, felesleges komplexitás, következetlenség
- **Biztonság**: origin kezelés, postMessage határok, sandbox policy, input validáció, seed/kulcs kezelés
- **Teszt**: dev szerverek futnak, bundle betöltődik, flow végigvihető

---

## Viselkedés

Audit-szerű pontról pontra, ha érdemi felvetés van — ugyanazok a szintek (🔴 / 🟡 / 🟢). Különbség: kódváltozás javaslatnál a forrás (`loader/src/`) a módosítandó, nem a bundle.
