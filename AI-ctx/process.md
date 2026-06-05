# AI Interaction Protocol

Minden módban érvényes. Felülír minden stílus/udvariassági optimalizációt.

---

## Állapotsor

KÖTELEZŐ minden válasz ELEJÉN.

**Ha minden mező 🟢:** csak `🟢 Status: OK` egysoros. Ha mód aktív: `🟢 Status: OK | Mód: <mód>`.
**Ha bármi eltér:** csak az eltérő mezők jelennek meg.

| Mező | Tartalom | 🟢 | 🟡 | 🔴 |
|------|----------|----|----|-----|
| Bizt | Bizonyossági szint (0–1) | ≥ 0.8 | 0.5–0.79 | < 0.5 |
| Ctx | Kontextusvesztés gyanú | nincs | gyenge | erős |
| Input | Input teljesség | OK | — | hiányos |
| Függ | Külső függés | nincs | van | — |
| Logika | Válasz logikai komplexitása | alacsony | közepes | magas |

---

## Hard constraints

- Minden feltételezést `[feltételezés]` jelöléssel kell ellátni — KÖTELEZŐ, HIBA ha hiányzik.
- Rögzítéskor: konkrét fájl + szekció/anchor + új vs bővítés. Általános hivatkozás nem elég.
- Diff: unified, 1-2 kontextussorral. Projekt-doksiba diff fence nem kerülhet.
- Diff csak felhasználói válasz után küldhető.
- Fájlokba nem kerülnek "volt X, most Y" bejegyzések — ezek a `runtime/changelog.md`-be mennek.

---

## Fájlok beolvasása

Nagy fájlok (400+ sor): `offset`/`limit` paraméterekkel végig kell olvasni. Csonkítás észlelésekor a hiányzó tartomány pótlása kötelező, mielőtt érdemi állítást tesz a fájlről.

---

## Új fájl nyilvántartása

Ha új fájl keletkezik:
- **Doc vagy src kategória**: azonnal felveszi a `file_catalog.md`-be és a `file_catalog.tsv`-be, és emlékeztet: `[drive-sheet]: <fájlnév> felkerült a katalógusba — Drive sheeten is frissítsd.`
- **Egyéb** (demo, script, temp): megkérdezi: `[katalógus?]: <fájlnév> — felkerüljön?`

---

## Modell-javaslat

Ha a feladathoz más modell érezhetően alkalmasabb: `[modell-javaslat]: <ok> → <modell>` — és vár.

Opus 4.8 triggerek:
- Komplex kódbázis elemzése (>400 sor, bundelt/minifikált, novel architektúra)
- Többrétegű rendszer ahol több komponens interakciója a kérdés
- Több fájl kereszt-referenciájú audit vagy konzisztencia-ellenőrzés
- Architektúrális döntés ahol a nuance számít

---

## Token-takarékosság

- Tömör válaszok, redundáns narrálás kerülése.
- Ha a kontextus hosszú vagy témát vált: új chat javaslat. A mód-specifikus teendőket a mód saját fájlja írja le.

---

## Session dokumentálás

Kulcspontoknál (döntés, témaváltás, fontos megállapítás) frissítendő a `runtime/session.md`. Crash recovery és folytatás alapja.

---

## Egyéni Claude Code beállítások

Hookök és permissions: `~/.claude/settings.json`. Backup: `AI-ctx/claude_settings_backup.json` — mindig szinkronban tartandó. Ha új beállítás kerül a `settings.json`-ba, egyszerre frissítendő a backup is.
