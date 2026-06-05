# Shared: DEVp + DEVs

## Session-state karbantartás

Minden lezárt döntés után frissítendő a `runtime/state.md`. Csak nyitott/függő állapot kerül bele — lezárt elemek törlendők. KÖTELEZŐ, HIBA ha kimarad.

Fájlokba nem kerülnek "volt X, most Y" bejegyzések — ezek a `runtime/changelog.md`-be mennek.

---

## Coding → DOCSYNC átmenet

Mielőtt új chat indítását javaslod:
1. Töltsd ki a `modes/docsync/doc_sync_pending.md`-t a session döntéseivel és változott fájljaival
2. Frissítsd a `runtime/state.md`-t

Az új DOCSYNC session ezekből tölti vissza a kontextust — kontextusvesztés nélkül.
