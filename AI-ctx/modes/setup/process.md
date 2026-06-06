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

- Claude nyitja az új tabot kérésre (encoded command a quoting miatt):
  ```powershell
  $cmd = 'claude "<mód>"'
  $enc = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cmd))
  wt --window 0 new-tab --profile "AQ Claude" --title "AQ | <mód>" powershell -EncodedCommand $enc
  ```
- `--window 0` kötelező — nélküle új ablakban nyílik
- `--profile "AQ Claude"` — suppressApplicationTitle:true profil, title rögzített marad
- `claude "<mód>"` interaktív sessiont indít a mód nevével mint első üzenet
- Session marker: `runtime/sessions/<mód>.pid` — duplikáció detektáláshoz

---

## Felhasználói profil és szótár karbantartás

Ha új kommunikációs minta, preferencia vagy rövidítés derül ki: frissítendő a `user.md` ill. `shortcuts.md`. Ezek élő dokumentumok.
