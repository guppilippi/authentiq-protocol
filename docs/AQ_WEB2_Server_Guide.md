# AQ Protocol – WEB2 Server Guide

## Dokumentum státusza
Ez a dokumentum **nem normatív**.  
Az AQ protokoll WEB2 rétegének referencia implementációját írja le: a lokális fejlesztői szerver setup-ot (read-only) és a write szervert (AQS).

Ha egy elem kikerül a kódból, **innen is kikerül**.

---

## 1. WEB2 lokális dev szerver (aktuális, read-only)

A referencia implementáció részeként **három külön Node.js processz** szolgál ki a lokális fejlesztéshez. A cél: a WEB3 réteg (CID feloldás + RPC) lokálisan szimulálható kézi fájl-elhelyezéssel.

### 1.1. Portok és szerepek

- **`8080`** WEB statikus — `npx serve`, a projekt gyökerét szolgálja ki. A böngésző ezt nyitja meg (`http://localhost:8080/demo/html`).
- **`8081`** CID asset szolgáltató — `server/cidServer.js`, `GET /cid/<hash>` route.
- **`8082`** JSON-RPC mock — `server/rpcServer.js`, `POST /rpc` route (eth_call kompatibilis).

A 3 port külön domain szimulációt szolgál (CORS-szerű cross-origin kontextus): production-ban a CID feloldás és az RPC külön szolgáltatók, ez a setup ezt imitálja lokálisan is.

### 1.2. Indítás

`scripts/startServers.ps1` (PowerShell) `concurrently`-vel négy processzt indít:

```
WEB    (green)   — npx serve -l 8080 .
BUILD  (yellow)  — npm --prefix .\loader run watch
CID    (cyan)    — node .\server\cidServer.js
RPC    (magenta) — node .\server\rpcServer.js
```

### 1.3. Adat-root

- Default: `server/data/` (a `server.js`-ek melletti almappa).
- Felülírás: env `AQ_DATA_ROOT` változó.
- Almappák: `<dataRoot>/blobs/` (CID-elnevezésű asset-fájlok), `<dataRoot>/tokens/` (tokenId-elnevezésű szövegfájlok, tartalmuk a hozzá tartozó 64-hex CID).
- A `tokens/0` a **protokoll config CID-jét** tartalmazza (a boot innen indul).
- Mappa-létrehozás: induláskor hard fail, ha a `<dataRoot>` vagy `blobs/` / `tokens/` nem létezik. Kézzel kell `mkdir`-rel létrehozni.

### 1.4. CID szerver (`/cid/<hash>`)

- `GET` only, egyéb method → 405.
- CID formátum: `/^[0-9a-f]{64,128}$/i`, egyébként 400.
- Path traversal védelem (a feloldott path-nak a `blobs/` alatt kell maradnia).
- Sikeres válasz: `Content-Type: application/octet-stream`, `Cache-Control: public, max-age=31536000, immutable`, `Access-Control-Allow-Origin: *`.
- Hiányzó fájl → 404.

### 1.5. RPC szerver (`/rpc`)

- `POST` only, egyéb method → 404 (JSON-RPC `-32601`). `OPTIONS` → 204 (CORS preflight válasz). (A `cidServer.js` ezzel szemben 405-öt ad nem-GET-re.)
- Body validáció: JSON, `method === "eth_call"`, `params[0]` objektum.
- `params[0].to` ellenőrzése: az aqProtocol DAO contract cím (`0x64521be8...`).
- `params[0].data` ellenőrzése: kezdődik a `0xcc2fb628` (selector = `getSwarmHash(uint256)`) prefix-szel + 64 hex (uint256 tokenId).
- TokenId parse: `BigInt("0x" + tokenIdHex).toString(10)`.
- Fájl olvasás: `<dataRoot>/tokens/<tokenId>`, tartalom 64 hex (BOM nélkül).
- Sikeres válasz: `{jsonrpc:"2.0", id, result: "0x" + cid}`.
- Hiányzó fájl → `{jsonrpc:"2.0", id, result: "0x"}` (revert szimuláció, a kliens "contract reverted" hibát ad).
- CORS: `Access-Control-Allow-Origin: *`.

### 1.6. Közös helper modul

`server/util.js`:
- `resolveDataRoot(importMetaUrl)` — env override + default lokális path.
- `requireDir(path, label)` — hard fail induláskor, ha nincs.
- `readBody(req, { asBuffer?, maxBytes? })` — POST body olvasás; `asBuffer: true` → Buffer, egyébként UTF-8 string; default maxBytes: 64 KB.
- `logRequest(label, method, url, status, extra)` — egysoros request log.
- `logStartup(label, port, dataDir)` — induláskor két soros log.

### 1.7. `server/package.json`

- `type: module`, minimális külső dep (ethers ^6.0.0 aláírás-ellenőrzéshez)
- `scripts.cid` és `scripts.rpc` indítók

### 1.8. Limitációk

- Read-only: nincs upload, nincs token-allokálás, nincs wallet aláírás.
- Manuális fájlkezelés (a fejlesztő közvetlenül ír a `blobs/` és `tokens/` mappákba).
- Egyszerre csak egy contract cím elfogadott (az aqProtocol DAO `0x64521be8...`).

---

## 2. WEB2 write szerver — AQS (`aqServer.js`)

A `server/aqServer.js` a protokoll write-os referencia szerverje. Port: `8083` (env `AQ_PORT`). CORS: minden endpoint `Access-Control-Allow-Origin: *`.

### 2.1. Autentikáció

Minden write endpoint EIP-191 wallet aláírást vár (`aqAuth.js`):

- `x-aq-wallet` header: a wallet cím lowercase-ben.
- `x-aq-sig` header: az EIP-191 aláírás.
- `x-aq-timestamp` header: Unix ms timestamp stringként.
- Timestamp tolerancia: ±5 perc (`SKEW = 5 * 60 * 1000`).
- Aláírt üzenet formátumok:
  - asset upload: `aqUploadAsset:<timestamp>`
  - token CID beállítás: `aqSetSwarmHash:<tokenId>:<cid>:<timestamp>`
  - token mint: `aqMintToken:<timestamp>`

A szerver az aláírásból visszafejti a wallet-t (`verifyMessage`), majd ellenőrzi a `whitelist.json`-ban.

### 2.2. Whitelist (`data/whitelist.json`)

JSON tömb lowercase wallet-címekkel. Minden write operáció megköveteli a whitelist-en való szerepelést.

Példa: `["0x4fe481e8df86f415ffd5476ce6cfc15439234077"]`

### 2.3. Endpointok

**`POST /aq/asset`** — asset feltöltés
- Auth ellenőrzés (whitelist).
- Request body: nyers bytes (max `AQ_MAX_UPLOAD`, default 10 MB).
- A szerver random 64-hex CID-et generál, elmenti `data/wallets/<wallet>/<cid>` alá, symlink-et készít `data/blobs/<cid>` → `../wallets/<wallet>/<cid>`.
- Válasz: `{ cid: "<64-hex>" }`.

**`GET /cid/<hash>`** — asset olvasás
- CID formátum: `/^[0-9a-f]{64}$/i` — ez implicit path traversal védelmet biztosít (a regex kizárja a `/` és `..` karaktereket).
- Symlink-en keresztül olvas a `data/blobs/` mappából.
- Válasz: `application/octet-stream`, `Cache-Control: immutable`.
- Nem-GET method → 404 (a CID route nem ad 405-öt, eltérően a read-only `cidServer.js`-től).

**`POST /rpc`** — JSON-RPC write metódusok

| Metódus | Leírás |
|---|---|
| `eth_call` | TokenId → CID feloldás (read-only, auth nélkül) |
| `aqMintToken` | Új token allokálás; 100-tól indul (0–99 rezervált, lásd §2.4) |
| `aqSetSwarmHash` | TokenId → CID beállítás (owner ellenőrzés) |

### 2.4. TokenId ownership

- `data/ownership.json`: `{ "<tokenId>": "<wallet>" }` map.
- `aqMintToken`: következő tokenId = `max(létező ≥100-as tokens/ fájlok) + 1`; ha nincs ilyen fájl, 100. Fájlrendszer-listázás alapú (nem ownership-lista). Az allokált tokenId-re a hívó wallet azonnal ownership bejegyzést kap.
- `aqSetSwarmHash`: csak az owner írhat a tokenId-re.
- **Auto-claim**: bármely tokenId esetén (0-tól felfelé), ha még nincs ownership bejegyzés, az első whitelisted writer automatikusan megkapja az ownershipet. Ez a tokenId=0 (protokoll config) és az 1–99 rendszer-tartomány esetén is érvényes — a védelmi vonal kizárólag a whitelist szűksége (WEB2). WEB3 flow-ban az on-chain ownership mechanizmus adja a védelmet.
- **TokenId-tartomány** (konvenció):
  - `0` — protokoll config; `aqMintToken` soha nem allokálja
  - `1–99` — protokoll, gate DAO-k, rendszer; a genesis admin explicit írja (auto-claim whitelist-védelemmel)
  - `100+` — sima DAO-k (`aqMintToken` ebből allokál)

### 2.5. Deploy (referencia)

- Raspberry Pi, systemd service (`aq-server.service`), nginx reverse proxy.
- Elérés: `https://damjanch.mooo.com` (nginx terminál SSL, proxyzza `/rpc`, `/cid/`, `/aq/` útvonalakat → `http://127.0.0.1:8083`).
- Deploy script: `scripts/deployServer.ps1` (pscp + plink, két passphrase prompt).
