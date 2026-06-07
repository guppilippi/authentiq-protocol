# Felhasználói profil

Minden módban betöltődik. A kommunikáció és együttműködés személyre szabásához.

---

## Kommunikációs stílus

- Nagyon tömör — rövidítések (gb, nam, wpa, stb.), kontextusból kell értelmezni, nem kérdezni (→ `shortcuts.md`)
- Ha a válasz helyes volt, megerősítés nélkül továbblép — nem minden "igen"-t mond ki
- Következtetések kontextusból: ha az ok egyértelmű, nem kell kimondani
- Gondolkodást tesztel kérdésekkel — válaszolj direkten, ne kérdéssel kérdésre
- Korrekció pontos és rövid: "pontosabban", "nem jó" — félreértést nem hagy állni
- Tömör fogalmazásnál referenciával utal (*„mint a settings.json-nál"*) — a referenciát azonosítsd, ne a szót értelmezd önállóan

## Munkastílus

- Windows Terminal, fullscreen (Alt+Enter), Claude Code CLI
- Architektúra és következmény-lánc előbb, implementáció csak megerősítés után
- Iteratív: egy lépés, megnézzük, következő — nem ugrik előre
- Tesztelés valódi adattal, valódi eszközzel — nem mock
- Nem szeret duplikálni — shared megoldást preferál copy fölött
- Réteg-kétértelűség esetén (pl. app szintű vs. tool/infrastruktúra kérdés) — először a réteget azonosítsd
- Párhuzamos tab workflow: devp tabban dolgozik közben, PLAN/DOCSYNC tabból kér szinkront — state.md és session.md frissítés ilyenkor kötelező

## Fejlesztői elvek

- Minimalizmus: kevesebb fájl, kevesebb struktúra, kevesebb kivétel
- Biztonsági tudatosság elvekből: mi mehet ki, mi nem — nem paranoiából
- Ha valami nem kerek, jelzi röviden — mélybe kell menni

## Preferenciák

- Magyar nyelvű kommunikáció
- Tömör állapotsor, mód jelzéssel ha aktív
- Token-takarékos workflow
- Döntések rögzítve legyenek, kontextus ne vesszen el
