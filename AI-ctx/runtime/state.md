# AQ – Runtime State

Fejlesztési chatben karbantartandó. Crash recovery és új chat folytatás alapja.

---

## Hol tartunk

Linux deploy kész: Raspberry Pi, `https://damjanch.mooo.com`, port 8083, systemd service, nginx proxy.

App helye: `/var/www/sftp/szoke/sftp/sftp/`
Data root: `/var/www/sftp/szoke/sftp/sftp/data/`

**Funkcionális állapot:**
- Seed létrehozás (jelszó / WebAuthn-PRF) → titkosítva IndexedDB-ben
- Seed unlock → session aktiválás (aqSession IndexedDB) → reload után auto-bejelentkezés
- Létrehozás után automatikus session
- Gate DAO auth flow: nem PWA → csak jelszó; PWA → bio + jelszó; unlock → gate teardown
- Host hamburger menü (mindig aktív): Wallet cím lista; devMode: Publish Gate, Refresh Protocol, Clear IndexedDB; prod: Fork DAO
- devMode: Refresh Protocol → seed-alapú wallet (index 1000) → protokoll feltöltés
- Logout = IndexedDB törlés

## Következő lépések

1. Pi-s `index.html` + `aqBoot.js` deploy (nginx statikus) → teljes Pi-s publikálási flow
2. Real device teszt (Pixel 7, damjanch.mooo.com)
3. WEB2 GC: `POST /aq/retire` endpoint + periodic orphan scan
4. DOCUMENTATION_SYNC: Guide §17 + §18 + új §19 (keyring, session, seed unlock, gate auth flow, hostMenu, gate teardown, aq:// séma, fork flow, tokenId foglalás)
5. Bus relay: gate DAO adat (wallet cím) elérhetővé tétele content DAO iframe-eknek

## Tervezési döntések (Plan-szinkronra vár)

### PWA architektúra

- `start_url` kötelezően HTTP/HTTPS (PWA spec); ez a protokoll saját web2 szervere
- A tényleges tartalom web3-ból töltődik (Swarm)
- Külső oldal csak URL paraméterrel nyitja meg a PWA-t: `https://<server>/?token=<tokenId>`
- A loader az URL paramból olvassa az `openTokenId`-t (jelenleg hardkódolt configban — átírni)

### Signing capability (Gate API)

- Gate DAO soha nem látja a privát kulcsot
- `wallet.sign(message)` → loader deriválja on-demand, aláír, kulcsot elveti
- Gate DAO csak `{ address }` és `sign(message)` capability-t kap

### PWA biztonsági architektúra

| Kontextus | Elfogadható? |
|---|---|
| devMode (localhost) | ✓ |
| PWA standalone | ✓ |
| Böngésző, same-device PWA popup | ✓ |
| PC böngésző + mobil PWA | ✗ — WalletConnect-szerű relay kell |
| Böngésző, nincs PWA | ✗ |

Same-device popup: `window.open('https://pwa-url/sign?req=...', 'aq', 'popup')` → `window.opener.postMessage`. Cross-device: jövőbeli scope.

### Biztonsági rétegek (aqKeyring)

- `seedUnlock(password?)`: nincs kontextus-korlát — jelszó/WebAuthn validál, `_unlockedSeed` cache + session auto-save
- `seedActivate(rawBytes)`: seedGen után közvetlen aktiválás (re-decrypt nélkül) + session save
- `seedGetRaw()`: `isPwa || devMode` — raw seed és aláírás csak megbízható kontextusban
- `getWalletAddresses()`: nincs korlát — `_unlockedSeed`-ből derivál, cím nem érzékeny
- Session (aqSession DB): raw seed tárolás — logout = teljes IndexedDB törlés
- `isSeedUnlocked()`: szinkron memória-check (race condition fix)
- boot + aqSeedGenComplete: `isSeedUnlocked() || sessionLoad()` — memória-állapot elsőbbséget kap; session aktív esetén `teardownGateDao()` explicit hívás

### Hamburger menü architektúra

- `aqHostMenu.js`: egyetlen host-szintű menü, mindig aktív, z-index:100000
- Standard: Wallet (cím lista unlock után)
- devMode: Publish Gate, Refresh Protocol, Clear IndexedDB
- prod: Fork DAO
- Gate overlay: z-index:50000, ephemeral; Content iframe: alap z-index

### aq:// asset referencia séma (kész — devMode)

- `preprocessAqRefs(html)`: `aq://category/sub.name` → `resolveRefIn(gateCfg)` → `fetchAssetBytes` → blob URL
- `_imageBlobUrls` tracking; teardownGateDao revoke-olja
- Formátum: `aq://img/dao.logo` → `refs.img.dao.logo` → `{ path: "..." }`
- MIME detektálás path kiterjesztésből; CID ref esetén `image/png` default

### Gate DAO flow

- Ephemeral modal (position:fixed overlay)
- Auth után: `gate.done()` → teardown
- Session aktív esetén gate kihagyva
- Újbóli megnyitás menüből: `loadGateDao` → CID cache-ből gyors

### Server reset (kész)

- `server/resetData.js` — `AQ_DATA_ROOT` env var; blobs/tokens/wallets/trash törlés + ownership.json reset
- `resetServer.ps1` — SCP + sudo rm via plink; külön ablak; Enter után bezárul

### TokenId foglalás (lezárt)

- `0` — protokol config
- `1–99` — protokol, gate DAO-k, rendszer
- `100+` — sima DAO-k; `mintToken` 100-tól indul
- Gate DAO: `"1"` (devMode-ban path + tokenId, production-ban csak tokenId)

### SeedGen refs → gate config

- SeedGen assetjei (html/css/js) gate config `refs`-ben (local path ref)
- Gate neve: `gates.aq`, tokenId: `"1"`; devMode-ban path + tokenId, production-ban csak tokenId

### Fork/publish flow (kész)

- `getGateCfg()`, `getDaoCfg()` exportok elérhetők
- `processPathRefs()`: path ref → upload → CID
- devMode: Publish Gate (gate config), Refresh Protocol (protokol config, gate `path` eltávolítva), Clear IndexedDB
- prod: Fork DAO (tartalom DAO → CID → tokenId: üres = új 100+, vagy meglévő ha wallet=owner)

### WEB2 GC design (lezárt)

- `replaces` paraméter elvetett (recovery-probléma)
- Helyes flow: `POST /aq/asset` → config frissítés → token update → `POST /aq/retire { cid: oldCid }`
- Periodic GC: rekurzív elérhetőség tokens/* → nested CID-ek; nem elért → trash; trash 30 nap után törlés

### Wallet hozzáférés — whitelist hiány kezelése

- Nincs whitelist → 401; hostMenu Wallet mutatja a címet
- Általános user flow (nem devMode): implementálandó fork elkészültekor

---

## Projekt meta-állapot

- **Fázis:** local-only, development (genesis előtt)
- **Visszafelé kompatibilitás:** nem követelmény genesis előtt — refaktor, breaking change, strukturális változás bármikor elvégezhető (explicit felülírásig érvényes)
- Nincs production környezet, nincs prod-kompatibilitási elvárás

---

## Ismert javítandók (AI workflow)

