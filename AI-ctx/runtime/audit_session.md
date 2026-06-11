# Audit session — 2026-06-11

## Findings

F01 [🔴] [kód] — Build-elt loader bundle elavult: az F01 security fix nem él a futó artefaktumban
Érintett: `js/aqProtocolLoader.js` vs `loader/src/aqKeyring.js`, commit e99f815
Leírás: Az e99f815 commit (F01: raw seed plaintext session store eltávolítása) csak a `loader/src` forrásmodulokat módosította, a `js/aqProtocolLoader.js` bundle nem lett újrabuildelve. A runtime-ban az `aqSession` DB (titkosítatlan raw seed IndexedDB-ben) továbbra is működik, a biztonsági javítás hatástalan. Forrás ↔ artefaktum divergencia.

F02 [🟡] [doc] — Implementation Guide eltávolított session store-t dokumentál létezőként
Érintett: Guide §4.3, §16.1, §16.2, §18.7, §19.1, §19.2, §19.3, §19.4
Leírás: A `sessionSave`/`sessionLoad`/`aqSession` DB az F01 fixszel kikerült a forrásból, de a Guide ~8 helyen jelenleg létező mechanizmusként írja le. Biztonsági szempontból félrevezető (session-perzisztenciát ígér, ami szándékosan megszűnt).

F03 [🟡] [kód] — Halott `loadGateCfgOnly` ág a boot flow-ban
Érintett: `loader/src/aqProtocolLoader.js:96–100`
Leírás: A boot ágban `else if (devMode) await loadGateCfgOnly(gateEntry)` csak akkor futna, ha `isSeedUnlocked()` igaz — de friss page load-nál `_unlockedSeed` mindig `null` (session restore az F01-gyel megszűnt), így az ág elérhetetlen. A Guide §16.1/§19.3 ezt "Publish Gate előfeltétele"-ként írja le, ami már nem igaz.

F04 [🟡] [kód] — `initHostMenu()` kétszer fut a seed-gen flow-ban (duplikált menü-DOM)
Érintett: `loader/src/aqProtocolLoader.js:91–93` + `:104` + `:71`
Leírás: Nincs-seed ágban a `return` után a `finally` lefuttatja az `initHostMenu()`-t, majd a seed-gen befejezésekor az `aqSeedGenComplete` `finally`-ja másodszor is. Az `initHostMenu` nem idempotens (duplikált DOM, listener). A Guide §4.3 szerint a nincs-seed ágban a loader "visszatér" — a kód a menüt már a seed-gen alatt is felteszi.

F05 [🟡] [kód/doc] — `contracts.<name>.address` validált, de a feloldás soha nem használja
Érintett: `loader/src/aqRpc.js:5,37` (hardkódolt `DAO_CONTRACT`), `aqLoaderCore.js:140–158`, Guide §6.1, Plan §2.1
Leírás: A `resolveDaoCid` minden eth_call-t a hardkódolt `DAO_CONTRACT` címre küld; a remote ref feloldásnál kinyert `contract.address` sehol nem kerül felhasználásra. Egy más contract-címet deklaráló config csendben az aqProtocol contracton oldódik fel — hibajelzés nélkül. A Guide és Plan a contract lookup-ot (address-szel) a feloldás részeként mutatja be; az `address` lebegő, megtévesztő mező.

F06 [🟡] [doc] — `cacheable` a Guide-ban aktuális config mezőként szerepel, de nincs implementálva
Érintett: Guide §5 vs kód (nincs `cacheable` a `loader/src`-ben) vs Plan §2.1, §16.1 (pending)
Leírás: A Guide az aktuális DAO config részeként listázza a `cacheable`-t, miközben a kód sehol nem olvassa, és a Plan maga pendingként tartja nyilván.

F07 [🟡] [doc] — Gate storage namespace devMode-ban: a Guide önellentmondó
Érintett: Guide §5.3 és §11.1 (`"gate:" + path` devMode) vs Guide §19.6 (`tokenId`-re épül) vs kód (`aqLoaderCore.js:339,361`: `"gate:" + (tokenId ?? path)`)
Leírás: A §5.3/§11.1 szerint devMode-ban a namespace a path-ra épül, a §19.6 szerint a tokenId-re; a kód: tokenId ha van, egyébként path. Ugyanaz a viselkedés három helyen kétféleképp leírva.

F08 [🟡] [doc] — "Bogyó" definíció ellentmondás: DAO-szinonima vs nem az
Érintett: Concepts §13 ("szinonimaként használható") vs Glossary "Bogyó" ("Nem DAO szinonimája")
Leírás: A két dokumentum explicit módon ellentétes állítást tesz ugyanarról a terminusról.

F09 [🟡] [doc] — Hitelesség monotonitás: "csak nőhet" vs "nem monoton, csökkenhet"
Érintett: Concepts §16 ("Hitelesség: csak nőhet") vs Concepts §15, Glossary "Hitelesség", Plan §6.7
Leírás: A Concepts §16 kategorikus "csak nőhet" állítása ellentmond a saját §15-nek, a Glossary-nak és a Plan kanonikus képletének. A fogalmi modell egyértelmű.

F10 [🟡] [doc] — Egyszemélyes közösségi DAO: megengedett vs tiltott
Érintett: Concepts §9 + Glossary ("akár egyetlen taggal is") vs Concepts §20 + Plan §17 ("Minimum 3 tag, egyszemélyes nincs")
Leírás: Feloldatlan ellentmondás ugyanazon dokumentumon belül is.

F11 [🟡] [doc] — Plan elavult: implementált WEB2 write szerver "tervezett"-ként szerepel
Érintett: Plan bevezető, §19.2–§19.4, Pending ("WEB2 write szerver", "wallet aláírás") vs `server/aqServer.js`, `aqAuth.js`, `aqData.js`, WEB2 Guide §2
Leírás: A write szerver, whitelist, ecrecover aláírás-ellenőrzés implementált és dokumentált (WEB2 Guide §2) — a Plan ugyanazt tervezettként listázza. A tervezett endpoint-formák (`POST /aq/token`) eltérnek az implementálttól (JSON-RPC `aqMintToken`/`aqSetSwarmHash`).

F12 [🟡] [doc] — Implementált tartalom a Plan-ben tényként + Guide↔Plan↔Concepts duplikáció
Érintett: Plan §14.4–§14.6, §4.1, §2.2 ↔ Guide §6.1; Plan §14.3 ↔ Guide §2.3; Plan §14.6 ↔ Guide §5.2; Plan §19.1 ↔ WEB2 Guide §1; Concepts §12
Leírás: Documentation Rules §4 tiltja a Plan-ben a "kész tényként" leírást, §6 a duplikációt. Több mechanizmus két-három dokumentumban él párhuzamosan — szinkronvesztési kockázat (F02 már be is következett).

F13 [🟡] [doc] — Kritikus lépés: nem implementált loader-viselkedés jelen időben, rossz helyen
Érintett: Concepts §19 + Glossary "Kritikus lépés" vs Guide §7.1 ("tervezett")
Leírás: A Concepts és Glossary kijelentő módban írja le a kritikus lépés loader-mechanizmusát, miközben a Guide tervezettként jelöli és a kódban nincs nyoma. Loader-viselkedés szintű leírás a Concepts-ben szabálykészlet szerint sem oda való.

F14 [🟢] [doc] — Guide nem létező függvényhasználatra hivatkozik a boot-ban
Érintett: Guide §4.2 (`validateLocalRef` az `aqBoot.js`-ben) vs `loader/src/aqBoot.js:56–60`
Leírás: Az `aqBoot.js` nem importálja/használja a `validateLocalRef`-et; a viselkedés egyezik, a dokumentált mechanizmus nem.

F15 [🟢] [kód] — Elavult komment a régi remote ref sémával
Érintett: `loader/src/aqAssetFetch.js:28`
Leírás: A komment `{rpc?, contract, tokenId}` sémát ír le, a tényleges forma már `{tokenName}`.

F16 [🟢] [doc] — Storage kulcsformátum elavult terminológiával
Érintett: Guide §11 ("daoRef + namespace") vs `aqStorage.js:80` (`namespace + name`) vs Guide §11.1
Leírás: A kulcs namespace-ből épül, nem daoRef-ből. Régi elnevezés maradványa.

F17 [🟢] [kód] — Duplikált gate-entry feloldó blokk
Érintett: `loader/src/aqLoaderCore.js:337–347` (`loadGateCfgOnly`) vs `:358–368` (`loadGateDao`)
Leírás: A daoRef/namespace meghatározó blokk karakterre közel azonos a két függvényben. (Nem azonos az accepted.txt boot-flow duplikációval.)

F18 [🟢] [kód] — eth_call és CID-kiszolgáló logika duplikálva a két szerver között
Érintett: `server/rpcServer.js:87–160` vs `server/aqServer.js:120–158`; `server/cidServer.js:22–80` vs `server/aqServer.js:56–78`
Leírás: A read-only mock és a write szerver azonos protokoll-logikát implementál külön-külön, kis viselkedés-eltérésekkel (CID hossz: 64–128 vs 64; hibaválasz: 405 vs 404).

## Döntések
- F01: elvetett — build minden tesztindításkor automatikusan elkészül; bundle divergencia nem áll fenn
- F02: elfogadva — Guide session store szekciói törlendők (DOCSYNC)
- F03: elfogadva — `loadGateCfgOnly` ág feltétele hibás; `isSeedUnlocked()` check nem kellene, config olvasás seed nélkül is mehet (kód + DOCSYNC)
- F04: elfogadva — `initHostMenu()` csak a "start" végén hívandó; a nincs-seed ág `finally`-ja idő előtt hívja (kód)
- F05: elvetett — hardcode WEB2 scope-ban szándékos; `address` mező WEB3 fejlesztéskor lesz aktív
- F06: elfogadva — `cacheable` Guide §5-ből ki; Plan pending marad (DOCSYNC)
- F07: elfogadva — kanonikus: `"gate:" + (tokenId ?? path)`; §5.3 és §11.1 frissítendő, §19.6 fallback-et is kap (DOCSYNC)
- F08: elfogadva — Concepts §13 javítandó: "szinonimaként használható" ki, helyette Glossary-ra utalás (DOCSYNC)
- F09: elfogadva (részben) — Concepts §16 marad; Glossary "Hitelesség" bővítendő: aktuális érték csökkenhet hibajelzésre, múltbeli értékek immutablek — hosszú távon csak nőhet (DOCSYNC)
- F10: elfogadva — hiányzó disztinkció: identitás DAO egyszemélyes (by definition), funkcionális/közösségi DAO min. 3 tag (seed elosztás); §9, §20, Glossary, Plan §17 pontosítandó (DOCSYNC)
- F11: elfogadva — Plan bevezető + §19.2–§19.4 + Pending: write szerver, whitelist, ecrecover implementált; régi endpoint-formák ki (DOCSYNC)
- F12: elfogadva — Plan §14.3–§14.6, §4.1, §2.2, §19.1 duplikált/implementált tartalom; érintett szekciók ki vagy Guide-ra hivatkozás; Concepts §12 API-részlet áthelyezendő (DOCSYNC)
- F13: elvetett — Concepts jellege miatt jelen idő is konceptuális, nem implementációs állítás
- F14: elfogadva — Guide §4.2 `validateLocalRef` referencia ki; inline ellenőrzések leírása (DOCSYNC)
- F15: elfogadva — `aqAssetFetch.js:28` komment frissítendő: `{rpc?, contract, tokenId}` → `{tokenName}` (kód)
- F16: elfogadva — Guide §11 kulcsformátum: `daoRef` → `namespace` (DOCSYNC)
- F17: elfogadva — `loadGateCfgOnly` + `loadGateDao` közös gate-entry feloldó blokk kiemelendő segédfüggvénybe (kód)
- F18: elfogadva — CID_RE egységesítés: `{64}` (nem `{64,128}`); 405 non-GET handler; közös logika `util.js`-be emelve; `cidServer.js` és `aqServer.js` /cid/ + /rpc eth_call ágak refaktorálandók (kód)
