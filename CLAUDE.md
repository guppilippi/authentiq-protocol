# AuthentiQ – Claude Code projekt instrukciók

## Session indítás

Minden session elején olvasd el sorrendben:

1. `AI-ctx/process.md` — viselkedési szabályok (felülír mindent)
2. `AI-ctx/sum.txt` — chat tartalom és prioritások
3. `AI-ctx/file_catalog.md` — fájl-katalógus
4. `AI-ctx/user.md` — felhasználói profil
5. `AI-ctx/shortcuts.md` — rövidítések és elírások

Ezután töltsd be a mód-specifikus fájlt (default: PLAN):

| Mód | Betölt |
|-----|--------|
| PLAN | `AI-ctx/modes/plan/process.md` |
| DEVp | `AI-ctx/modes/devp/process.md` |
| DEVs | `AI-ctx/modes/devs/process.md` |
| REVIEW | `AI-ctx/modes/review/process.md` |
| AUDIT | `AI-ctx/modes/audit/process.md` |
| DOCSYNC | `AI-ctx/modes/docsync/process.md` |
| SETUP | `AI-ctx/modes/setup/process.md` |

A mód-specifikus `process.md` tartalmazza, hogy azon felül mit kell még betölteni.

---

## Állapotsor

KÖTELEZŐ minden válasz ELEJÉN. HIBÁNAK MINŐSÜL ha hiányzik.

**Ha minden mező 🟢:** csak `🟢 Status: OK` egysoros.  
**Ha bármi eltér:** csak az eltérő mezők jelennek meg (🟢-s mezők ilyenkor sem).

Mezők:

| Mező | Tartalom | 🟢 | 🟡 | 🔴 |
|------|----------|----|----|-----|
| Bizt | Bizonyossági szint (0–1) | ≥ 0.8 | 0.5–0.79 | < 0.5 |
| Ctx | Kontextusvesztés gyanú | nincs | gyenge gyanú | erős gyanú |
| Input | Input teljesség | OK | — | hiányos |
| Függ | Külső függés | nincs | van | — |
| Logika | Válasz logikai komplexitása | alacsony | közepes | magas |
| Dbg | Debug mód | off | on | — |
| Sys | Rendszerkorlátozás | — | — | ha van |

`Sys` mező csak akkor jelenik meg, ha van rendszerkorlátozás.

---

## Debug vezérlés

- `debug=on` → folyamatos debug mód (minden válasz végén diagnózis blokk)
- `debug=off` → kikapcsol
- `debug=next` → csak a következő válasz

Debug blokk tartalma (ha aktív):
- Cél tiszta?
- Input teljes?
- Kontextus stabil? (vesztés gyanúja?)
- Külső függés?
- Logika komplex?
