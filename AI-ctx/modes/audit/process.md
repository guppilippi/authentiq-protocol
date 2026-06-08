# AUDIT mód

## Betöltés

- Univerzális: `AI-ctx/process.md`, `sum.txt`, `file_catalog.md`
- Mód-specifikus: ez a fájl, `accepted.txt`
- Docs és src fájlok: **nem töltődnek be a main chatbe** — full audit esetén a subagent feladata

---

## Session indítás — típus kérdés

Az audit típusát meg kell határozni mielőtt bármi elindul. Opciókat adjunk:

- **Full audit** — összes doc + src + server fájl; subagent flow (ld. lentebb)
- **Targeted** — felhasználó megad fájlokat / szekciót; main chatben, inline
- **Gyors** — csak 🔴 blokkolók; main chatben, inline

Típus nélkül az audit nem indul el.

---

## Full audit — subagent flow

Ha típus = full audit:

1. `[modell-javaslat]: Full audit → Opus 4.8 + ultrathink`
   Explicit instrukció: **válaszolj `ok ultrathink`-kel** — az `ultrathink` a jóváhagyó üzenetben kell hogy legyen, hogy a spawn turn-jén aktiváljon extended thinking
2. Spawn `Agent(model: "opus", description: "Full AUDIT findings", prompt: <ld. lentebb>)`
3. Subagent visszatér findings listával → Sonnet tárgyalja pontról pontra (ld. Tárgyalási fázis)
4. Kód + dok diff-ek csak az összes pont lezárása után, egyszerre

**Shortcut:** ha a user már az első üzenetben írja: `full audit ultrathink opus 4.8` — típus kérdés kihagyható, azonnal spawn.

**Mechanizmus:** `ultrathink` a user üzenetében → extended thinking aktivál a parent Claude turn-jén (ahol az agent prompt készül + spawn történik). A subagent Opus 4.8, ami önmagában a fő minőségi előny.

### Subagent prompt template

---
Full AUDIT feladat — AuthentiQ projekt.

Olvass el minden releváns fájlt:
- AI-ctx/sum.txt, AI-ctx/process.md
- AI-ctx/modes/audit/accepted.txt
- docs/* (minden fájl)
- loader/src/* (minden fájl)
- server/* (minden fájl)

Keresd: kód ↔ doksi ellentmondások, inkonzisztenciák, lebegő elemek, rossz helyen lévő állítások.
Hiányosság csak ha strukturálisan kritikus.

Findings formátum:
F## [🔴/🟡/🟢] [kód/doc/arch] — [rövid cím]
Érintett: [fájl:sor vagy dok szekció]
Leírás: [mit találtál, miért probléma]

Ne adj javítási kódot. Csak azonosítsd a problémákat. Listában add vissza az összes findinget.
---

---

## Tárgyalási fázis (Sonnet — main chat)

Pontról pontra, egyszerre egy felvetés. Fejlécen sorszám/total (`3/7`). Minden pont kérdéssel zárul — reakció után jön a következő.

Szintek: 🔴 blokkoló / 🟡 érdemi / 🟢 alacsony

Megszakítható: `AUDIT: SKIP` vagy "nincs érdemi felvetés".

Kód- és doksi változások az audit végén egyszerre íródnak ki — nem menet közben.

Ha csatolt kód vagy doksi van és érdemi anyag: felvetés kötelező.

---

## accepted.txt

Élő döntési dokumentum — ami itt szerepel, alapértelmezetten elfogadott. Döntésváltozás explicit javaslatként kezelendő, nem feltételezett. Az asszisztens nem hoz fel újra lezárt kérdést, kivéve ha a kód/doksi már nem egyezik vele.

**Felvétel előtt kötelező ellenőrzés:** az új bejegyzés előtt meg kell győződni, hogy az adott döntés nincs-e már a doksikban (Manifest, Concepts, Guide, Plan, Glossary, Documentation Rules). Ha igen, accepted.txt-be nem kerül — a doksi az elsődleges forrás.

**Ide kerül:** amit sehol máshol nem lehet rögzíteni — audit során lezárt kérdés, meta-szintű döntés, vagy ideiglenes projekt-állapot rögzítés ami nem illik normatív doksiba.
