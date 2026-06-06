# AQ – Changelog

Kérésre olvasandó. Automatikusan nem töltődik be.

---

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

## 2026-06-03 — Workflow redesign

- CLAUDE.md mode dispatch tábla (PLAN/DEVp/DEVs/REVIEW/AUDIT/DOCSYNC)
- session_state.md → AI context/runtime/state.md
- aq_state/ törölve
- AI context/runtime/screenshots/ törölve
- Screenshot hook törölve settings.json-ból
- settings.local.json: csak runtime/* wildcard permission

## 2026-05 – 2026-06-02

- aq:// asset referencia séma (devMode): preprocessAqRefs, blob URL inject HTML-be
- Gate DAO auth flow + teardown (gate.done() unlock után)
- Hamburger menü: Wallet, Publish Gate, Refresh Protocol, Clear IndexedDB (devMode); Fork DAO (prod)
- Seed létrehozás + unlock (jelszó / WebAuthn-PRF) + session (aqSession IndexedDB)
- Pi deploy: https://damjanch.mooo.com, port 8083, systemd + nginx
- Server reset: resetData.js + resetServer.ps1
- WEB2 GC design döntés (replaces elvetett → POST /aq/retire flow)
- TokenId foglalás: 0 / 1–99 / 100+
- Fork/publish flow generikus (minden DAO-ra)
- SeedGen assetjei gate config refs-be kerültek; gates.aq (korábban gates.test)
- Gate config contracts/tokens szekciók eltávolítva (remote ref séma refaktor)
- Protokol config refs szekció eltávolítva
