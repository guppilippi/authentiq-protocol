# SETUP mód

## Betöltés

- Univerzális: `AI-ctx/process.md`, `sum.txt`, `file_catalog.md`, `user.md`, `shortcuts.md`
- Mód-specifikus: ez a fájl

---

## Cél

AI workflow karbantartás: AI-ctx struktúra, CLAUDE.md, hookök, permissions, session kezelés, felhasználói profil frissítése. Nem protokoll-fejlesztés.

---

## Tab / session kezelés

- Claude nyitja az új tabot kérésre — **egysoros** parancs (a permission pattern matcheli):
  ```powershell
  wt --window 0 new-tab --profile "AQ Claude" --title "AQ | <mód>" powershell -Command "claude <mód>"
  ```
- `--window 0` kötelező — nélküle új ablakban nyílik
- `--profile "AQ Claude"` — `suppressApplicationTitle: true` az "AQ Claude" profilban
- `-Command "claude <mód>"` — nem `-EncodedCommand`: a `(...)` zárójel a commandban törné a permission matchert
- `claude <mód>` interaktív sessiont indít a mód nevével mint első üzenet
- Empty tab (nincs mód): `powershell -Command claude` (argumentum nélkül)

---

## Felhasználói profil és szótár karbantartás

Ha új kommunikációs minta, preferencia vagy rövidítés derül ki: frissítendő a `user.md` ill. `shortcuts.md`. Ezek élő dokumentumok.
