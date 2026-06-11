# AQ – Dokumentáció-szinkron: függő változások

## 2026-06-11 — Full audit Fable 5 (DOCSYNC tételek)

**F02** — Guide session store törlés  
Érintett: §4.3, §16.1, §16.2, §18.7, §19.1, §19.2, §19.3, §19.4  
`sessionSave`/`sessionLoad`/`aqSession` DB eltávolítva (F01 fix) — Guide ~8 helyen még létezőként leírva. Minden érintett sor/bekezdés törlendő vagy a "seed reload után locked marad" viselkedésre cserélendő.

**F06** — Guide §5: `cacheable` mező törlés  
A `cacheable` mező nem implementált, Plan pending-ként tartja nyilván. Guide §5 opcionális mezők listájából ki.

**F07** — Gate storage namespace pontosítás  
Kanonikus: `"gate:" + (tokenId ?? path)` — tokenId elsőbbséget élvez ha rendelkezésre áll, path fallback.  
Érintett: §5.3 (`"gate:" + path` devMode → `"gate:" + (tokenId ?? path)`), §11.1 (ua.), §19.6 (fallback-et is kapja).

**F08** — Concepts §13: Bogyó definíció javítás  
`"szinonimaként használható"` sor törlendő. Helyes: Bogyó = építkezési elv, nem DAO szinonimája. §13 utalhat a Glossary-ra a definícióért.

**F09** — Glossary "Hitelesség" bővítés  
Jelenlegi szöveg félrevezető (Concepts §16-tal szemben áll). Bővítés: *"az aktuális érték csökkenhet hibajelzés hatására; a múltbeli értékek immutablek — hosszú távon csak nőhet."*

**F10** — Egyszemélyes DAO disztinkció  
Identitás DAO: mindig egyszemélyes (by definition). Funkcionális/közösségi DAO: minimum 3 tag (seed elosztás miatt).  
Érintett: Concepts §9 + §20, Glossary "DAO" és "Közösségi DAO", Plan §17 — mindenhol a szabály DAO-típushoz kötendő.

**F11** — Plan: WEB2 write szerver implementált  
Plan bevezető, §19.2–§19.4, Pending lista: write szerver, wallet whitelist, ecrecover — ezek implementáltak (WEB2 Guide §2 dokumentálja).  
Régi tervezett endpoint-formák (`POST /aq/token`) törlendők (implementált: JSON-RPC `aqMintToken`/`aqSetSwarmHash`).

**F12** — Plan duplikáció + implementált tartalom  
Érintett szekciók: Plan §14.3–§14.6, §4.1, §2.2, §19.1 — duplikált vagy implementált tartalom.  
- §2.2 ↔ Guide §6.1: 8-lépéses remote resolve → Plan-ből ki, Guide-ra utalás
- §14.3 ↔ Guide §2.3: RPC-parsing → ua.
- §14.6 ↔ Guide §5.2: gate választás precedencia → ua.
- §19.1 ↔ WEB2 Guide §1: read-only szerver leírás → ua.
- Concepts §12: tokenName→tokens→contracts API-szintű részlet → Guide-ba vagy ki

**F14** — Guide §4.2: `validateLocalRef` referencia javítás  
Az `aqBoot.js` nem importálja a `validateLocalRef`-et; inline ellenőrzések adják a viselkedést. §4.2-ből a függvénynév-hivatkozás ki; helyette az inline logika rövid leírása.

**F16** — Guide §11 kulcsformátum terminológia  
`daoRef + "\n" + storageName` → `namespace + "\n" + name` (a kód és §11.1 is namespace-t használ, daoRef elavult elnevezés).
