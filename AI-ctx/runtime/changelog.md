# AQ – Changelog

Kérésre olvasandó. Automatikusan nem töltődik be.

---

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

