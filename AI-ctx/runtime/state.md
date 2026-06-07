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
- Host hamburger menü (mindig aktív): Wallet cím lista; devMode: Publish aqBoot.js, Publish Protocol, Publish Gate, Clear IndexedDB; prod: Fork DAO
- devMode: Refresh Protocol → seed-alapú wallet (index 1000) → protokoll feltöltés
- Logout = IndexedDB törlés

## Következő lépések

1. ~~`openTokenId` opcionálissá + URL param (`?token=<tokenId>`) olvasás~~ — kész
2. ~~Production `index.html` deploy + Pixel 7 browser teszt~~ — kész; mobile CSS javítva
3. PWA: `manifest.json` + ikonok + `sw.js` → Pi deploy
3. Real device teszt (Pixel 7, damjanch.mooo.com) — standalone mód + WebAuthn-PRF ellenőrzés
4. WEB2 GC: `POST /aq/retire` endpoint + periodic orphan scan
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
- devMode: Publish aqBoot.js (CID vágólapra), Publish Protocol, Publish Gate, Clear IndexedDB
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
- `scripts/resetServer.ps1` — SCP + sudo rm via plink; külön ablak; Enter után bezárul

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
- `processPathRefs()`: path ref → upload → CID; kezeli: `boot`, `loader`, `refs.*` mezőket
- `loadGateCfgOnly()`: gate config betölt renderelés nélkül — devMode + session aktív esetén (Publish Gate előfeltétele)
- devMode: Publish aqBoot.js (CID vágólapra), Publish Protocol (protokol config, gate `path` eltávolítva), Publish Gate (gate config), Clear IndexedDB
- prod: Fork DAO (tartalom DAO → CID → tokenId: üres = új 100+, vagy meglévő ha wallet=owner)
- `setTokenCid`: ownership auto-claim bármely tokenId-re első setkor (nem csak `"0"`)

### WEB2 GC design (lezárt)

- `replaces` paraméter elvetett (recovery-probléma)
- Helyes flow: `POST /aq/asset` → config frissítés → token update → `POST /aq/retire { cid: oldCid }`
- Periodic GC: rekurzív elérhetőség tokens/* → nested CID-ek; nem elért → trash; trash 30 nap után törlés

### DAO és Gate state tárolás

- Minden DAO saját maga kezeli a persistens állapotát (aktuális oldal, kitöltött mezők, választott nyelv, stb.)
- Protokoll nem avatkozik be — a DAO-scoped storage a DAO felelőssége
- Választott nyelv a DAO state részét képezi → következő megnyitáskor visszatölt → DAO az utoljára használt nyelvén nyílik meg
- Gate state (minimum): választott nyelv + utoljára nyitott DAO tokenId → PWA újranyitáskor folytatás

---

### i18n architektúra

**Attribútum szintaxis:** prefix — `data-i18n="[placeholder]key;textkey"` (textContent default, többi explicit)

**i18n ref variációk** (DAO config `refs`-ben):
- Tokenized: `"i18n": { "tokenId": "105" }` → token tartalom: `{ "en": { "cid": "..." }, "hu": { "cid": "..." } }` — fordítások DAO config érintése nélkül frissíthetők
- Közvetlen: `"i18n": { "en": { "cid": "..." }, "hu": { "cid": "..." } }` — DAO config-ba égett CID-ek
- Nincs i18n kulcs → static HTML, nincs nyelvválasztó

**Feloldás és fallback (loader default):** `navigator.language` → `en` → első a listából; DAO felülírhatja (saját state-ből olvassa a választott nyelvet, vagy teljesen saját logika)

**Váltás:** reload nélkül — új CID fetch → DOM re-sweep + `aq:langchange` event; DAO JS figyeli ha dinamikus render kell

**Gate i18n:** ugyanez a mechanizmus; gate state tárolja a választott nyelvet → következő nyitáskor visszaállítja

**Gate state (minimum):** választott nyelv + nyitott DAO tokenId → PWA újranyitáskor folytatás

**DAO state:** DAO saját maga kezeli (oldal, kitöltött mezők, nyelv, stb.); protokoll nem avatkozik be — a választott nyelv DAO-scoped storage-ban tárolódik; következő megnyitáskor onnan olvasódik vissza → DAO a legutóbb használt nyelvén nyílik meg

**Nyelvválasztó a gate-ben:** loader átadja a nyitott DAO elérhető nyelveit → gate mutatja; ha nincs nyitott DAO → gate saját nyelvein működik; ha DAO-nak nincs i18n → nincs nyelvválasztó

---

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

---

## Függő témák (következő session)

### PWA bootstrap centralizáltság
A PWA `start_url` stabil HTTP/HTTPS URL-t igényel — tisztán web3-ból (CID) nem szolgálható ki, mert a CID változik a tartalommal. Minimalizálható: web2 csak statikus bootstrap (index.html + manifest.json), minden más Swarmból. ENS + gateway közelít, de web2 réteg marad. Kérdés: milyen manifest-stratégia fogadható el a decentralizáltsági elvek szempontjából? → Hosszabb eszmecseré, PLAN módban.

