# Shared: DEVp + DEVs

## Handoff

Session indításakor: ha `runtime/handoff.md` nem üres, töltsd be — ez az előző mód átadása.  
Mód váltás előtt: töltsd ki a `runtime/handoff.md`-t (cél, elvégzett, következő lépések, releváns fájlok), majd ürítsd ki ha az új session átvette.

---

## Session-state karbantartás

Minden lezárt döntés után frissítendő a `runtime/state.md`. Csak nyitott/függő állapot kerül bele — lezárt elemek törlendők. KÖTELEZŐ, HIBA ha kimarad.

Fájlokba nem kerülnek "volt X, most Y" bejegyzések — ezek a `runtime/changelog.md`-be mennek.

---

## Coding → DOCSYNC átmenet

Mielőtt új chat indítását javaslod:
1. Töltsd ki a `modes/docsync/doc_sync_pending.md`-t a session döntéseivel és változott fájljaival
2. Frissítsd a `runtime/state.md`-t

Az új DOCSYNC session ezekből tölti vissza a kontextust — kontextusvesztés nélkül.
