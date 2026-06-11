# AUDIT mód

## Betöltés

- Univerzális: `AI-ctx/process.md`, `sum.txt`, `file_catalog.md`
- Mód-specifikus: ez a fájl, `accepted.txt`
- Docs és src fájlok: **nem töltődnek be a main chatbe** — full audit esetén a subagent feladata

---

## Session indítás

**Első lépés:** ellenőrizni, hogy létezik-e `runtime/audit_session.md`.
- Ha igen → félbemaradt audit; megkérdezni: folytatjuk vagy eldobjuk?
  - Folytatás: findings már adott, tárgyalási fázis ott indul ahol abbahagytuk
  - Eldobás: fájl törölve, új audit indul
- Ha nem → új audit, típus kérdés következik

---

## Típus kérdés

Az audit típusát meg kell határozni mielőtt bármi elindul. Opciókat adjunk:

- **Full audit** — összes doc + src + server fájl; subagent flow (ld. lentebb)
- **Security audit** — biztonsági határok, trust boundary, kulcskezelés; subagent flow Fable 5-tel (ld. lentebb)
- **Targeted** — felhasználó megad fájlokat / szekciót; main chatben, inline
- **Gyors** — csak 🔴 blokkolók; main chatben, inline

Típus nélkül az audit nem indul el.

---

## Full audit — subagent flow

Ha típus = full audit:

1. `[modell-javaslat]: Full audit → Opus 4.8 + ultrathink`
   Explicit instrukció: **válaszolj `ok ultrathink`-kel** — az `ultrathink` a jóváhagyó üzenetben kell hogy legyen, hogy a spawn turn-jén aktiváljon extended thinking
2. Spawn `Agent(model: "opus", description: "Full AUDIT findings", prompt: <ld. lentebb>)`
3. Subagent visszatér findings listával → **azonnal kiírni** `runtime/audit_session.md` Findings szekciójába
4. Tárgyalási fázis + kód/dok diff-ek: ld. általános szabályok lentebb

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

Keresd: kód ↔ doksi ellentmondások, inkonzisztenciák, lebegő elemek, rossz helyen lévő állítások, duplikált logika (azonos vagy nagyon hasonló kódblokk több helyen).
Hiányosság csak ha strukturálisan kritikus.

Az `accepted.txt`-ben lezárt döntéseket ne hozd fel — kivéve ha a kód vagy doksi már nem egyezik a döntéssel.

Findings formátum:
F## [🔴/🟡/🟢] [kód/doc/arch] — [rövid cím]
Érintett: [fájl:sor vagy dok szekció]
Leírás: [mit találtál, miért probléma]

Ne adj javítási kódot. Csak azonosítsd a problémákat. Listában add vissza az összes findinget.
---

---

## Security audit — subagent flow

Ha típus = security audit:

1. `[modell-javaslat]: Security audit → Fable 5 + ultrathink`
   Explicit instrukció: **válaszolj `ok ultrathink`-kel**
2. Spawn `Agent(model: "fable", description: "Security AUDIT findings", prompt: <ld. lentebb>)`
3. Subagent visszatér findings listával → azonnal kiírni `runtime/audit_session.md` Findings szekciójába
4. Tárgyalási fázis: ld. általános szabályok lentebb

**Shortcut:** `security audit ultrathink` — típus kérdés kihagyható, azonnal spawn.

### Subagent prompt template

---
Security AUDIT feladat — AuthentiQ projekt.

Olvass el minden releváns fájlt:
- AI-ctx/sum.txt, AI-ctx/process.md
- AI-ctx/modes/audit/accepted.txt
- docs/AQ_Protocol_Canonical_Manifest.md
- loader/src/aqKeyring.js, loader/src/aqGateApi.js, loader/src/aqGateRender.js
- loader/src/aqProtocolBus.js, loader/src/aqStorage.js, loader/src/aqAssetFetch.js
- loader/src/aqCidBaseConfig.js, loader/src/aqEnv.js
- server/aqAuth.js, server/aqData.js, server/aqServer.js

Keress biztonsági problémákat:
- Trust boundary sértések (seed, signing, kulcs-map hozzáférés)
- Kulcskezelés hibák: raw seed kiszivárgás, nem megfelelő törlés, memória-cache visszaélés
- postMessage protokoll: origin validálás, üzenet-hamisítás lehetősége
- Server oldal: autentikáció bypass, ownership logika hibák, path traversal, injection
- iframe sandbox: escape lehetőségek, privilege escalation
- CID/RPC integritás: adat-manipulálás lehetősége a fetchelési láncban
- Protokoll invariáns sértések (Manifest alapján)

Az `accepted.txt`-ben lezárt döntéseket ne hozd fel — kivéve ha a kód már nem egyezik a döntéssel.

Findings formátum:
F## [🔴/🟡/🟢] [security] — [rövid cím]
Érintett: [fájl:sor]
Leírás: [mit találtál, miért probléma, mi a lehetséges támadási vektor]

Ne adj javítási kódot. Csak azonosítsd a problémákat. Listában add vissza az összes findinget.
---

---

## Általános szabályok (minden audit típusra)

### Mit keresünk

Kód ↔ doksi ellentmondások, inkonzisztenciák, lebegő elemek, rossz helyen lévő állítások, duplikált logika (azonos vagy nagyon hasonló kódblokk több helyen). Hiányosság csak ha strukturálisan kritikus. `accepted.txt`-ben lezárt döntéseket nem hozzuk fel — kivéve ha a kód/doksi már nem egyezik a döntéssel.

---

### Crash recovery — audit_session.md

Minden audit típusnál:
- Findings meghatározása után (subagent visszatér / inline elemzés kész) → azonnal kiírni `runtime/audit_session.md` Findings szekciójába
- Tárgyalási fázis: minden lezárt pont után a döntés felkerül a Döntések szekciójába
- Audit vége: `runtime/audit_session.md` törölhető

```markdown
# Audit session — <dátum>

## Findings
[lista]

## Döntések
- F##: [elfogadva / javítva / elvetett]
```

---

### Tárgyalási fázis

Pontról pontra, egyszerre egy felvetés. Fejlécen sorszám/total (`3/7`).

Szintek: 🔴 blokkoló / 🟡 érdemi / 🟢 alacsony

Megszakítható: `AUDIT: SKIP` vagy "nincs érdemi felvetés".

Kód- és doksi változások az audit végén egyszerre íródnak ki — nem menet közben.

Ha csatolt kód vagy doksi van és érdemi anyag: felvetés kötelező.

#### Döntési formátum

Minden döntési kérdésnél `AskUserQuestion` toolon keresztül. Minden opció description mezőjében a bizonyossági %. Az utolsó opció mindig "más" — saját %-kal. A menüpont kiválasztása maga a döntés, nincs külön megerősítés. A % megfigyelési célú: mikor vezethető be automatikus döntés.

Példa opciók:
- "elfogadva — DOCSYNC" | 75%
- "elvetett" | 20%
- "más" | 5%

---

## accepted.txt

Élő döntési dokumentum — ami itt szerepel, alapértelmezetten elfogadott. Döntésváltozás explicit javaslatként kezelendő, nem feltételezett. Az asszisztens nem hoz fel újra lezárt kérdést, kivéve ha a kód/doksi már nem egyezik vele.

**Felvétel előtt kötelező ellenőrzés:** az új bejegyzés előtt meg kell győződni, hogy az adott döntés nincs-e már a doksikban (Manifest, Concepts, Guide, Plan, Glossary, Documentation Rules). Ha igen, accepted.txt-be nem kerül — a doksi az elsődleges forrás.

**Ide kerül:** amit sehol máshol nem lehet rögzíteni — audit során lezárt kérdés, meta-szintű döntés, vagy ideiglenes projekt-állapot rögzítés ami nem illik normatív doksiba.
