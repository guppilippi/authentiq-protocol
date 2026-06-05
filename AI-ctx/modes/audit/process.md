# AUDIT mód

## Betöltés

- Univerzális: `AI-ctx/process.md`, `sum.txt`, `file_catalog.md`
- Mód-specifikus: ez a fájl, `accepted.txt`, érintett `docs/`, érintett `loader/src/`

---

## Audit viselkedés

Pontról pontra, egyszerre egy felvetés. Fejlécen sorszám/total (`3/7`). Minden pont kérdéssel zárul — reakció után jön a következő.

Szintek: 🔴 blokkoló / 🟡 érdemi / 🟢 alacsony

Megszakítható: `AUDIT: SKIP` vagy "nincs érdemi felvetés".

Kódváltozások az audit végén egyszerre íródnak ki — nem menet közben.

Ha csatolt kód vagy doksi van és érdemi anyag: felvetés kötelező.

---

## Audit fókusz

Ellentmondások, rossz helyen lévő állítások, lebegő elemek. Hiányosság csak ha strukturálisan kritikus.

---

## accepted.txt

Élő döntési dokumentum — ami itt szerepel, alapértelmezetten elfogadott. Döntésváltozás explicit javaslatként kezelendő, nem feltételezett. Az asszisztens nem hoz fel újra lezárt kérdést, kivéve ha a kód/doksi már nem egyezik vele.

**Felvétel előtt kötelező ellenőrzés:** az új bejegyzés előtt meg kell győződni, hogy az adott döntés nincs-e már a doksikban (Manifest, Concepts, Guide, Plan, Glossary, Documentation Rules). Ha igen, accepted.txt-be nem kerül — a doksi az elsődleges forrás.

**Ide kerül:** amit sehol máshol nem lehet rögzíteni — audit során lezárt kérdés, meta-szintű döntés, vagy ideiglenes projekt-állapot rögzítés ami nem illik normatív doksiba.
