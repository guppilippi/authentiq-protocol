# AQ – Changelog

Kérésre olvasandó. Automatikusan nem töltődik be.

---

## 2026-06-11 — DEVp: Fable 5 audit kódjavítások — F03/F04/F15/F17

- **F03**: `aqProtocolLoader.js` — halott `else if (devMode) loadGateCfgOnly(gateEntry)` ág eltávolítva; `loadGateCfgOnly` import törölve. Boot always calls `loadGateDao`. Guide §4.3/§16.1/§19.3 frissítve.
- **F04**: `aqProtocolLoader.js` — `seedGenFlow` flag hozzáadva; `initHostMenu()` nem hívódik a seed-gen ág `finally`-jában — csak a normál boot végén és `aqSeedGenComplete`-ben.
- **F15**: `aqAssetFetch.js:28` — komment: `{rpc?, contract, tokenId}` → `{tokenName}`.
- **F17**: `aqLoaderCore.js` — duplikált gate-entry feloldó blokk kiemelve `resolveGateEntry(gateEntry, caller)` helperbe; `loadGateCfgOnly` és `loadGateDao` egyaránt hívja.

## 2026-06-11 — DOCSYNC: Full audit Fable 5 — F02/F06/F07/F08/F09/F10/F11/F12/F14/F16

- **F02**: Guide §4.3/§16.1/§16.2/§18.7/§19.1/§19.3/§19.4 — session store (aqSession/sessionSave/sessionLoad) eltávolítva; §19.2 törölve. Seed csak memóriában él, reload után auth szükséges.
- **F06**: Guide §5 — `cacheable` mező törölve az opcionális mezők listájából.
- **F07**: Guide §5.3/§11.1/§19.6 — gate storage namespace: `"gate:" + (tokenId ?? path)` kanonikus forma, tokenId elsőbbséggel.
- **F08**: Concepts §13 — bogyó definíció: "szinonimaként használható" sor törölve; építkezési elvként definiálva.
- **F09**: Glossary "Hitelesség" — bővítve: múltbeli értékek immutablek, aktuális csökkenhet hibajelzésre.
- **F10**: Concepts §9/§20, Glossary, Plan §17 — min 3 tag szabály DAO-típushoz kötve (közösségi identitás DAO); "akár egyetlen taggal is" törölve.
- **F11**: Plan bevezető, §19.2–19.4, Pending — write szerver implementált; §19.2/19.3/19.4 → WEB2 Guide §2 referencia; POST /aq/token tervezett forma törölve; Pending: write szerver + ecrecover törölve.
- **F12**: Plan §2.2/§14.3/§14.6/§19.1 + Concepts §12 — implementált tartalom → Guide/WEB2 Guide referencia; duplikációk eltávolítva.
- **F14**: Guide §4.2 — `validateLocalRef` hivatkozás törölve; inline ellenőrzés leírva.
- **F16**: Guide §11.2 — `daoRef + "\n" + storageName` → `namespace + "\n" + name`.

## 2026-06-08 — DOCSYNC: AQ_WEB2_Server_Guide.md létrehozva

- Guide §12–13 tartalma → `docs/AQ_WEB2_Server_Guide.md` (§1 dev szerver, §2 write szerver)
- Guide §12–13 helyén: pointer az új fájlra
- Guide preamble: §12/§13 hivatkozások → linkes referencia
- `file_catalog.md`: új `doc` bejegyzés
- `state.md`: Elvégzendő szekció törölve

## 2026-06-08 — AUDIT: Guide §16.2/§13.3/§18/§19.3, Plan §1.4/§19.3, DocRules §8

- §16.2: aqSeedGenComplete flow — session check + teardownGateDao ág dokumentálva
- §13.3: CID_RE `{64,128}` → `{64}` (aqServer.js szinkron)
- §18: initHostMenu kontextus pontosítva (nem `init`, hanem inline a boot entrypointban)
- §19.3: kód snippetek → prose (Documentation Rules §8: kód tilos projekt-doksiban)
- Plan §1.4: `aq_setSwarmHash` → `aqSetSwarmHash`
- Plan §19.3: hard link megjegyzés → symlink (kész implementáció)

## 2026-06-07 — DOCSYNC: Guide §4/§13/§16/§18, Plan §14/§15

- §4.1: `openTokenId` opcionális (URL param `?token=` → conf → null)
- §4.3: loader boot flow — openTokenId feloldás, `loadGateCfgOnly` devMode session-aktív ág, `initHostMenu`
- §13.4: ownership auto-claim kiterjesztve bármely tokenId-re (nem csak "0")
- §16.1–16.2: seed-gen flow — `loadGateCfgOnly` ág, `loadContentDao` opcionális
- §18.1: devMode menü — Publish aqBoot.js hozzáadva, Refresh Protocol → Publish Protocol
- §18.3: Publish Gate — clipboard write eltávolítva
- §18.4: Refresh Protocol → Publish Protocol (rename + clipboard write eltávolítva)
- §18.5: Publish aqBoot.js — új szekció
- §18.6–18.8: Fork DAO / Clear IndexedDB / processPathRefs átszámozva; processPathRefs: `boot.path` is kezeli
- Plan §14.11: i18n architektúra (data-i18n prefix szintaxis, refs.i18n tokenized/közvetlen/nincs, feloldás, váltás, nyelvválasztó)
- Plan §15.2: DAO és Gate state tárolás (DAO-scoped storage, gate `_protocol` namespace)

## 2026-06-05 — DOCSYNC: Guide §5/§13/§17/§18/§19

- §5.1: `img` kategória hozzáadva az engedett refs listához
- §13.3: aqMintToken "1-től" → "100-tól" (0–99 rezervált)
- §17: aqWalletDerive/Config/Store.js → aqKeyring.js; getWalletAddresses() hozzáadva
- §18: teljes újraírás — aqDevMenu.js (devMode-only) → aqHostMenu.js (mindig aktív); Wallet, Publish Gate, Refresh Protocol, Clear IndexedDB, Fork DAO, processPathRefs
- §19: új szekció — seed unlock, session, boot auth flow, gate teardown, aq:// séma, tokenId foglalás
- accepted.txt: seed store döntések törölve (§15-ben dokumentált)

