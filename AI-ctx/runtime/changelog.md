# AQ – Changelog

Kérésre olvasandó. Automatikusan nem töltődik be.

---

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
