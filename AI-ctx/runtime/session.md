# Session notes

## 2026-06-05 — AI-ctx struktúra építés

**Döntések:**
- Struktúra felépítve: `AI-ctx/modes/`, `shared/`, `runtime/`
- Módok: PLAN, DEVp, DEVs, REVIEW, AUDIT, DOCSYNC, SETUP
- Univerzális `process.md` megírva (CLI-re optimalizálva)
- AUDIT mód `process.md` megírva; `accepted.txt` hozzáadva
- Állapotgép leegyszerűsítve: csak AUDIT_RUNNING maradt értelmesnek CLI-ben

**Elkészült fájlok:**
- `process.md` (univerzális)
- `modes/audit/process.md` + `accepted.txt` (másolva, tartalom felülvizsgált)
- `modes/docsync/process.md` + `doc_sync_pending.md`
- `modes/devs/process.md`
- `modes/devp/process.md`
- `modes/plan/process.md`
- `shared/dev-session.md`
- `runtime/state.md`, `changelog.md`, `handoff.md`, `session.md`

**Elkészült (compact után):**
- `modes/review/process.md` — bundle-alapú; AUDIT=forrás, REVIEW=runtime+security
- `modes/setup/process.md` — kész, de "hook javítandók" szekció átkerül runtime/state.md-be
- `user.md` — felhasználói profil (univerzális)
- `shortcuts.md` — rövidítések és elírások szótára (univerzális)
- `modes/docsync/process.md` — changelog rolling window szabály hozzáadva

**AI-ctx struktúra: KÉSZ**
- `runtime/state.md` — hook javítandók + projekt-állapot (#1) hozzáadva
- `sum.txt` — kész
- `file_catalog.md` — kész (frissített útvonalakkal)
- `modes/audit/accepted.txt` — trimelt (marad: overlay UX, felelősségi határok, trusted státusz, audit szintezés súlyok, seed store pending)
- `CLAUDE.md` — átírva AI-ctx/ struktúrára
- `claude_settings_backup.json` — átmásolva

**Nyitott:**
- accepted.txt #20 (seed store) ellenőrizendő Guide-ban DOCSYNC alkalmával
- Hook javítandók implementálása (wakelock PID, PermissionRequest tab-váltás) — SETUP módban

**Git kész (2026-06-05):**
- Főprojektből git init, .gitignore (node_modules, .lnk, desktop.ini, .tmp.driveupload)
- Remote: https://github.com/guppilippi/authentiq-protocol.git
- authentiq-protocol_git/ törölve, force push main-re

**accepted.txt felülvizsgálat eredménye:**
- Törölhető (doksiban van): #2, #5, #6, #7, #8, #10, #11, #12, #13, #14, #15, #16, #17, #19, #21, #22, #23
- Marad (nincs máshol): #3 részlete, #4, #9, #18 (konkrét súlyok)
- Átkerül runtime/state.md-be: #1 (projekt-állapot)
- #20 (seed store) még ellenőrizendő Guide-ban
