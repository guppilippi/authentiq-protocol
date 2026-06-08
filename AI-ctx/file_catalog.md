# AQ – Fájl-katalógus

| Pattern | Kat | Leírás |
|---------|-----|--------|
| AI-ctx/process.md | ai | AI interakciós szabályok (HOGYAN) — univerzális |
| AI-ctx/sum.txt | ai | Chat tartalom szabályok (MIT) — univerzális |
| AI-ctx/user.md | ai | Felhasználói profil — univerzális |
| AI-ctx/shortcuts.md | ai | Rövidítések és elírások szótára — univerzális |
| AI-ctx/file_catalog.md | ai | Ez a fájl — fájl-katalógus |
| AI-ctx/shared/dev-session.md | ai | DEVp + DEVs közös session szabályok |
| AI-ctx/modes/audit/process.md | ai | AUDIT mód utasítások |
| AI-ctx/modes/audit/accepted.txt | ai | Lezárt audit döntések (ami nincs doksiban) |
| AI-ctx/modes/docsync/process.md | ai | DOCSYNC mód utasítások |
| AI-ctx/modes/docsync/doc_sync_pending.md | ai | Függő dokumentációs változások |
| AI-ctx/modes/devp/process.md | ai | DEVp mód utasítások |
| AI-ctx/modes/devs/process.md | ai | DEVs mód utasítások |
| AI-ctx/modes/plan/process.md | ai | PLAN mód utasítások |
| AI-ctx/modes/review/process.md | ai | REVIEW mód utasítások |
| AI-ctx/modes/setup/process.md | ai | SETUP mód utasítások |
| AI-ctx/runtime/state.md | ai | Aktuális fejlesztési állapot és következő lépések |
| AI-ctx/runtime/changelog.md | ai | Elvégzett munka, változástörténet — csak kérésre |
| AI-ctx/runtime/session.md | ai | Session notes — crash recovery, kulcspontok |
| AI-ctx/runtime/handoff.md | ai | Mód-ok közötti kommunikáció |
| docs/AQ_Protocol_Canonical_Manifest.md | doc | Normatív protokoll alapelvek |
| docs/AQ_Protocol_Concepts.md | doc | Nem normatív mentális modellek |
| docs/AQ_Protocol_Implementation_Guide.md | doc | Referencia implementáció leírás |
| docs/AQ_Protocol_Plan.md | doc | Tervek, pending elemek |
| docs/AQ_Glossary.md | doc | Terminológia szómagyarázat |
| docs/AQ_Documentation_Rules.md | doc | Doksi szabálykészlet |
| loader/src/aqBoot.js | src | Boot entry point (protokoll config → loader betöltés) |
| loader/src/aqProtocolLoader.js | src | Loader entry point (kapu DAO választás + boot) |
| loader/src/aqLoaderCore.js | src | DAO és page betöltési orchestráció |
| loader/src/aqProtocolBus.js | src | postMessage protokoll (handlerek, lock) |
| loader/src/aqStorage.js | src | IndexedDB capability (DAO-scoped + protokoll) |
| loader/src/aqAssetRef.js | src | Ref validálás, 2-szintű refs séma |
| loader/src/aqCidBaseConfig.js | src | cidBase–rpc biztonsági kötés |
| loader/src/aqAssetFetch.js | src | Asset feloldás és letöltés |
| loader/src/aqPageTemplate.js | src | Page iframe HTML sablon + page runtime |
| loader/src/aqIframe.js | src | iframe elem, sandbox, overlay |
| loader/src/aqEnv.js | src | Környezet detektálás (devMode, hostOrigin, isPwa) |
| loader/src/aqConfig.js | src | Host config olvasás |
| loader/src/aqFetch.js | src | Fetch wrapper (cache policy) |
| loader/src/aqRpc.js | src | Gnosis RPC kliens (tokenId → CID) |
| loader/src/aqRpcConfig.js | src | RPC config parsing + default fallback |
| loader/src/aqGateApi.js | src | Kapu DAO host-szintű API expose |
| loader/src/aqGateRender.js | src | Kapu DAO host-szintű renderelés + aq:// preprocessing |
| loader/src/aqKeyring.js | src | Seed tárolás + unlock (WebAuthn-PRF / password) + wallet deriváció + wallet store |
| loader/src/aqHostMenu.js | src | Hamburger menü (mindig aktív): Wallet; devMode: Publish aqBoot.js, Publish Protocol, Publish Gate, Clear IndexedDB; prod: Fork DAO |
| js/aqBoot.js | build | Boot bundle (esbuild output) |
| js/aqProtocolLoader.js | build | Loader bundle — ez fut teszteléskor (esbuild output) |
| server/aqServer.js | server | Linux WEB2 szerver (CID + RPC + asset write, port 8083) |
| server/aqAuth.js | server | Wallet aláírás-ellenőrzés (ethers.js EIP-191) |
| server/aqData.js | server | Adatréteg (fájl ops, ownership, whitelist, write serialization) |
| server/cidServer.js | server | Dev CID szerver |
| server/rpcServer.js | server | Dev RPC mock szerver |
| server/util.js | server | Szerver segédeszközök |
| server/resetData.js | server | Szerver adat reset script (blobs/tokens/wallets/trash törlés, ownership.json reset) |
| scripts/startServers.ps1 | dev | Dev szerverek indítója |
| scripts/deployServer.ps1 | dev | Pi server deploy (pscp + plink, külön ablakban) |
| scripts/resetServer.ps1 | dev | Pi szerver adat reset (SCP + sudo rm, külön ablakban) |
| scripts/reloadNginx.ps1 | dev | Pi nginx reload (plink, külön ablakban) |
| scripts/allowed/save-screenshot.ps1 | dev | Clipboard kép → AI-ctx/runtime/screenshot.png (Claude futtatja) |
| scripts/allowed/set-title.ps1 | dev | Mód váltáskor `/rename AQ | <mód>` vágólapra másolja (Claude futtatja) |
| demo/html/index.html | demo | Host page — dev tesztelési belépőpont (openTokenId path-alapú) |
| demo/gate-test/config.json | demo | Kapu DAO config (gate neve: "aq", tokenId=1) |
| demo/gate-test/logo.png | demo | AuthentiQ logó (PNG, aq:// sémán keresztül töltődik be) |
| demo/gate-test/main.html | demo | Kapu DAO main page (fragment) |
| demo/gate-test/main.css | demo | Kapu DAO main page stílusok (mobile-first) |
| demo/gate-test/main.js | demo | Kapu DAO main page logika (auth flow: jelszó/bio; unlock → gate.done()) |
| demo/gate-test/seedGen.html | demo | Seed-gen UI HTML |
| demo/gate-test/seedGen.css | demo | Seed-gen UI CSS (mobile-first) |
| demo/gate-test/seedGen.js | demo | Seed-gen UI logika |
| demo/json/aqDaoConfig.json | demo | Tartalmi DAO config |
| demo/json/aqDaoConfig2.json | demo | Tartalmi DAO config 2 |
