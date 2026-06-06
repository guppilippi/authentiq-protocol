# DOCSYNC mód

## Betöltés

- Univerzális: `AI-ctx/process.md`, `sum.txt`, `file_catalog.md`
- Mód-specifikus: ez a fájl, `doc_sync_pending.md`, érintett `docs/`

---

## Cél

Lezárt fejlesztési döntések és kódváltozások átvezetése a dokumentációba. Nincs új technikai irány, nincs implementáció.

---

## Viselkedés

- Érintett doksik megnevezése és diff-ek előállítása.
- Több érintett fájl esetén az összes párhuzamosan, egyetlen üzenetben.
- Ha egy fájlban 4+ helyen változik valami: teljes újraírás az előnyben részesített módszer.

---

## Doksi módosítás szabályok

- Részleges változásnál célzott szerkesztés — teljes újraírás csak ha 4+ helyen változik, vagy >50% átszervezés.
- Eltávolított funkciók a doksikból is törlendők — az új modell önállóan írandó le.
- Teszt-lépések, helper scriptek, dev-eszközök nem kerülnek a protokoll-doksiba.
- Plan → Guide átmenet: a kész elem Guide-ba kerül, Plan-ből törlődik. Completed lista a Plan-ben nem képződik.

---

## accepted.txt karbantartás

Ha egy bejegyzés DOCSYNC során doksiba kerül: az `accepted.txt`-ből törlendő. A doksi az elsődleges forrás — duplikáció tilos.

A szinkron részeként át kell nézni az `accepted.txt`-t: ami azóta doksiba került (és ott pontosan szerepel), törlendő.

---

## Lezárás

1. `doc_sync_pending.md` kiürítése kötelező — tartalom: `_(üres — nincs függő változás)_`
2. `runtime/changelog.md` karbantartás: utolsó 3-4 bejegyzés-blokk marad, régebbiek törlődnek
3. Git commit kötelező (az új git workflow szerint a főprojektből)
4. Git push kötelező — `git push origin main` (branch neve mindig `main`); commit nélkül nincs backup, nincs publikálás

---

## Token-takarékosság

Friss, dedikált session preferált. Ha a szinkron elején sok érintett fájl látható: jelezd előre és javasold új sessionben indítani.
