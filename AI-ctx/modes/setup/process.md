# SETUP mód

## Betöltés

- Univerzális: `AI-ctx/process.md`, `sum.txt`, `file_catalog.md`, `user.md`, `shortcuts.md`
- Mód-specifikus: ez a fájl

---

## Cél

AI workflow karbantartás: AI-ctx struktúra, CLAUDE.md, hookök, permissions, session kezelés, felhasználói profil frissítése. Nem protokoll-fejlesztés.

---

## Claude Code beállítások

Hookök és permissions: `~/.claude/settings.json`. Backup: `AI-ctx/claude_settings_backup.json` — mindig szinkronban tartandó. Ha új beállítás kerül a settings.json-ba: egyszerre frissítendő a backup is.

---

## Tab / session kezelés

- Claude nyitja az új tabot kérésre (`wt new-tab --title "AQ | <mód>"`)
- Session marker: `runtime/sessions/<mód>.pid` — duplikáció detektáláshoz
- Mód az állapotsorban minden válaszban: `🟢 Status: OK | Mód: <mód>`

---

## Felhasználói profil és szótár karbantartás

Ha új kommunikációs minta, preferencia vagy rövidítés derül ki: frissítendő a `user.md` ill. `shortcuts.md`. Ezek élő dokumentumok.
