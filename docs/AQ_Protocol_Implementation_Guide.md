# AQ Protocol – Implementation Guide

## Dokumentum státusza
Ez a dokumentum **nem normatív**.  
Az AQ protokoll **aktuális referencia implementációját** írja le: azt, ami **jelenleg létezik és működik** a kódban.

Ez a dokumentum:
- nem roadmap,
- nem jövőbeli ígéret,
- nem fogalmi magyarázat.

Ha egy elem kikerül a kódból, **innen is kikerül**.

**Megjegyzés a jelen állapothoz**: a jelenleg működő és dokumentált referencia a build-elt `aqBoot.js` és `aqProtocolLoader.js` IIFE bundle (forrásmodulok a `loader/src/` mappában, esbuild pipeline; lásd §1.2). A WEB2 lokális dev szerver (read-only) is része a referencia implementációnak (lásd §12). A WEB2 write szerver (`aqServer.js`) szintén működő referencia implementáció (lásd §13). Minden más (fork mechanizmus, watcher, PWA, cross-device flow) **terv**, és a Plan dokumentumba tartozik, nem ide.

---

## 1. Dokumentum szerepe
A Guide kizárólag a „**hogyan működik most**" kérdésre válaszol:
- hogyan tölt a loader,
- milyen policy-k vannak érvényben,
- hogyan zajlik a host ↔ iframe kommunikáció,
- milyen lokális dev szerver konfiguráció kíséri a klienst.

Minden „később", „irány", „lehetőség" a **Plan** dokumentumba került.

---

## 1.1. Névkonvenció (referencia loader / JS)

A referencia loaderben a JavaScript az alábbi névkonvenciót követi:

- **Nyilvános AQ felület**: `aqXxxYyy` (camelCase, `aq` prefix), pl. `aqStorage`, `aqPageKey`.
- **Belső implementáció**: tetszőleges, de lehetőleg konzisztens (camelCase javasolt).
- A konvenció célja: a „protokoll-exponált" és a belső segédfüggvények gyors megkülönböztetése.

---

## 1.2. Build

A futási artefaktumok (`js/aqBoot.js`, `js/aqProtocolLoader.js`) a `loader/src/` mappában lévő ESM forrásmodulokból build-elődnek esbuild IIFE bundle-ként.

- forrás: `loader/src/aqBoot.js` és `loader/src/aqProtocolLoader.js` mint entry, plusz a függő modulok
- build eszköz: esbuild, `loader/esbuild.config.js` konfigurációval
- output mappa: `js/` (relatív a projekt gyökérhez)
- parancsok:
  - `npm run build` — release, minify-olt
  - `npm run watch` — fejlesztés, file-változásra automatikus rebuild
- futási invariáns: a böngészőben kizárólag a build-elt bundle-ök futnak; a forrásmodulok fejlesztési artefaktumok.

---

## 2. Asset betöltés (aktuális)

A referencia loader asset-hivatkozása **objektum** (a config-ban szereplő refs-levél), vagy nyers string (a boot-fázis tokens/0 lookup eredménye és a `aq.fetchText/Bytes` string-input ága).

### 2.1. Lokális ref objektum

A `refs` levél lokális ágon:
- `{cid: <CID>, description: <string>}` — saját, ezen a DAO-n tárolt tartalom CID-je
- `{path: <"/..."> , description: <string>}` — csak DEV módban engedett

A `description` mező **kötelező** lokális refeken.

### 2.2. Távoli ref objektum

A `refs` levél lehet `{tokenName}` objektum is, amely egy másik funkció DAO-ra mutat:
- **`tokenName`** kötelező, non-empty string. Validáció során eager check: a hívó DAO config `tokens` map-jében léteznie kell.
- `contract`, `contractName`, `tokenId`, `rpc`, `description` mezők **tilosak** a leaf-en.

A feloldáshoz szükséges adat a `tokens` és `contracts` map-ből áll össze: `tokenName` → `tokens[tokenName]` → `contracts[contractName]`. A feloldás részletei §6.1-ben.

**Egyszintű**: ha a cél bejegyzés megint távoli → hiba. Csak lokális CID (production) vagy path (devMode) fogadható el a lánc végén.

### 2.3. cidBase és rpc forrása

`cidBase` forrása (host bootstrap és loader számára):
- host: `window.aqProtocolPageConf.cidBase` (alapértelmezett / ajánlott)
- DAO config: opcionálisan `cidBase` mezővel felülírhatja

Referencia (explicit) Swarm gateway alap:
- `https://api.gateway.ethswarm.org/bzz/`

`rpc` forrása (a tokens/0 protokoll config feloldásához és a távoli ref feloldáshoz a saját DAO `rpc` öröklődéséhez):
- host: `window.aqProtocolPageConf.rpc` (opcionális string)
- ha üres / hiányzó → default Gnosis hármas-lista (`rpc.gnosischain.com`, `gnosis-rpc.publicnode.com`, `rpc.gnosis.gateway.fm`)
- ha egyetlen URL → WEB2 single-URL felülbírálás (csak ez használt)
- szigorú validáció a config consumption-kor (URL parse + non-devMode `https:` kötelező)
- a validáció közös modulban: `aqRpcConfig.js` (`parseRpcConfig`)

A `resolveDaoCid(tokenId, urls)` paraméteres szignatúrával hívódik mindkét bundle-ben. Az URL-lista a `parseRpcConfig` eredménye.

**cidBase–rpc biztonsági kötés** (non-devMode): az `aqCidBaseConfig.js` (`checkCidBaseSecurity`) szinkron ellenőrzést végez a boot és a loader induláskor.
- Single RPC URL esetén: `origin(rpc) === origin(cidBase)` → OK (strict web2), VAGY `cidBase` az ismert Swarm gateway-listában → OK.
- Multi RPC (default Gnosis lista) esetén: `cidBase` az ismert listában kötelező.
- Egyéb kombináció → hard throw.
- Ismert cidBase: `https://api.gateway.ethswarm.org/bzz/`
- devMode-ban az ellenőrzés nem fut.

### 2.4. Cache policy (referencia loader)

- lokális `"/..."` path: `fetch(..., { cache: "no-store" })` (DEV workflow, mindig friss)
- CID asset: `fetch(..., { cache: "force-cache" })` (immutable tartalom, maximalizált böngésző cache)

Megjegyzés: a CID tartalom integritását a CID + resolver/gateway réteg garantálja; a loader nem végez külön hash-ellenőrzést. Távoli ref feloldáskor a cél-config letöltése is ezen a cache policy-n megy keresztül (CID alapú, force-cache). **Modul-state cache nincs**: minden távoli ref feloldás újra megy az eth_call + cél-config fetch láncon — a browser HTTP cache véd.

### 2.5. devMode + path-only környezeti korlát

Távoli ref feloldás **érvényes `cidBase`-t igényel** devMode-ban is (host conf vagy DAO config). Path-only fejlesztés (csak `/...` refek, üres `cidBase`) **nem kompatibilis** a távoli refekkel.

---

## 3. Asset betöltési policy (aktuális)

A loader jelenlegi referencia implementációja:

- lokális `"/..."` path **csak DEV módban** engedett (a `{path, description}` lokális refen vagy nyers path-string-en),
- CID alapú assetek engedettek (`cidBase + cid`),
- tokenId alapú assetek **közvetlenül a refs levélben tiltottak** — a tokenId csak a kapu DAO feloldásban (`gates.<name>.tokenId`, lásd §5) és az aqProtocol szerződés azonosító feloldásban (`tokens/0` → protokoll config CID) használt,
- **távoli ref** (`{tokenName}` objektum) engedett a `refs` levélben,
- `{path, hash}` asset objektum **nincs**,
- külön SHA-256 mező és ellenőrzés **nincs** (a CID feloldás integritása a resolver/gateway réteg felelőssége).

---

## 4. Loader bootstrap

### 4.1. Host konfiguráció

A host a `window.aqProtocolPageConf` objektumot biztosítja; ebből indul a betöltés.

Conf mezők (referencia loader, **új séma**):
- `cidBase` — opcionális string, a CID asset feloldáshoz használt URL-prefix (devMode-ban opcionális, non-devMode-ban kötelező `https://`)
- `rpc` — opcionális string, a tokenId típusú feloldáshoz. Üres / hiányzó → default Gnosis lista. Egyetlen URL → felülbírálás.
- `openTokenId` — **kötelező** string, a megnyitandó tartalmi DAO azonosítója. Devmode-ban path engedett (kezdő `/`), production-ben tokenId (numerikus string).
- `aqGateDAOName` — opcionális string, ha set, ez a kiválasztott kapu DAO neve (felülbírálja az alapértelmezett kiválasztást, de az IndexedDB-ben tárolt értéket nem írja át).

A korábbi `aqDaoConfig` és `aqPageLoader` mezők **megszűntek**.

A host felelőssége:
- a `cidBase` megadása,
- az `openTokenId` megadása (kötelező),
- opcionálisan az `rpc` URL megadása (egyébként default Gnosis lista),
- opcionálisan az `aqGateDAOName` megadása (override),
- a futási környezet biztosítása (legalább HTTP(S) origin; `origin !== "null"`),
- a boot script elhelyezése `<body>`-ban — nem `<head>`-ben (a loader bundle indulásakor `document.body`-nak már léteznie kell).

Dev mód (referencia loader):
- **nem konfigurálható**, nem flag.
- kizárólag a loader origin alapján dől el: `localhost | 127.0.0.1 | ::1`.
- a page nem kap devMode jelzést (nem policy-holder).

### 4.2. Boot flow (`aqBoot.js`)

A boot flow lépései:

1. **Host conf olvasás**: `window.aqProtocolPageConf`-ot beolvassa, `parseRpcConfig` lefut, majd `checkCidBaseSecurity` ellenőrzi a cidBase–rpc kombinációt (non-devMode).
2. **Protokoll config CID feloldás**: `resolveDaoCid(0, rpcUrls)` — az aqProtocol contract tokenId 0-jának CID-je. Mind production-ben, mind devMode-ban RPC-n megy.
3. **Protokoll config fetch + parse**: a CID-en a `cidBase`-ről letölti, `JSON.parse`-olja. **Nem validálja** (a protokoll config kézzel készül).
4. **Loader bundle CID/path olvasás**: a protokoll config `loader` mezőjéből (`{cid}` vagy devMode-ban `{path}`).
5. **Loader bundle fetch**: cache policy szerint (path → `no-store`, CID → `force-cache`).
6. **HTML-detection**: a bytes első 384 byte-ja UTF-8 dekódolva ellenőrzött; ha `<!doctype|html|head|body>` mintát tartalmaz, hard fail.
7. **Globalbe ír**: `window.aqProtocolConfig = <parsed-protocol-config>` (a loader olvassa).
8. **Conf freeze + DOM hygiene**: `Object.freeze(conf)` és `Object.freeze(protocolCfg)`. Az `AQ_CONF` script tag és a saját boot script tag eltávolítva.
9. **Loader script injekció** blob URL-ről.

- bootstrap gate: nem-localhost origin esetén path-alapú loader hivatkozás (`loader.path`) **tiltott** (defense-in-depth: a `validateLocalRef` az `aqBoot.js`-ben non-devMode-ban dobja a path-ágat).
- Env guard: a `top !== self` és `hostOrigin !== "null"` ellenőrzés mindkét bundle-ben (boot és loader) lefut.

### 4.3. Loader boot flow (`aqProtocolLoader.js`)

A loader bundle indulásakor:

1. **Env init**: `aqEnv.js` side-effect lefut.
2. **Host conf olvasás**: `window.aqProtocolPageConf` kiolvasása, és törlés a globalből (`aqConfig.js`).
3. **RPC URL-ek beállítása**: `parseRpcConfig` + `setAqRpcUrls`, majd `checkCidBaseSecurity` ellenőrzés (non-devMode).
4. **Protokoll config olvasás**: `window.aqProtocolConfig` kiolvasása, modul-szintű state-be (`aqLoaderCore.protocolCfg`), majd törlés a globalből.
5. **Pagehide cleanup regisztrálása**.
6. **DOM-ready** után (vagy azonnal, ha kész):
   - `setLocked(true)`, overlay megjelenítés.
   - **Kapu DAO választás** (lásd §5.2).
   - **Seed ellenőrzés**: `seedExists()` — két ág:
     - **Nincs seed**: `loadGateDao(gateName, gateEntry, "seedGen")` indul, majd a loader **visszatér** (nem folytatja). A boot-folyamat a kapu DAO `window.aqSeedGenComplete()` callback-jén keresztül folytatódik (lásd §16).
     - **Van seed**: `loadGateDao(gateName, gateEntry)`, majd `loadContentDao(openTokenId)`, majd devMode esetén `initDevMenu()` (lásd §18).
   - `setLocked(false)`, overlay elrejtés.
   - `aqSeedGenComplete` ágban szintén: `loadContentDao` után devMode esetén `initDevMenu()`.

### 4.4. DOM-ready invariant
A loader **nem tölt DAO-t vagy page-et** a DOM elkészülte előtt.

Ez garantálja a determinisztikus indulást.

---

## 5. Root Object, protokoll config és DAO config (aktuális forma)

A loader mindig egy DAO configot tölt be (sima DAO: `loadDaoConfig`, kapu DAO: `loadGateDao`). Mindkét út közös belső `_loadDaoConfigInternal`-en delegál.

A DAO config:
- `refs` (opcionális, 2-szintű) — lásd §5.1
- `exports` (opcionális, lapos lista)
- `pages` (kötelező)
- `defaultPage` (kötelező)
- opcionálisan `cidBase`, `rpc`, `cacheable`

A séma **implementációfüggő** és csak a referencia loaderre érvényes.

A `loadDaoConfig` a betöltött configot szigorúan validálja (`validateDaoConfig`); hibás séma esetén a betöltés hard fail-lel megáll, a page-betöltés meg sem indul.

### 5.1. DAO config validáció

Validált mezők (jelenlegi kódállapot):
- **`refs`** (opcionális, 2-szintű): `refs[category][subcategory][name] = leaf`. Engedett kategóriák: `js`, `css`, `json`, `html`, `img`, `others`. Minden levél objektum:
  - lokális: `{cid, description}` (description **kötelező**, plain szöveg) vagy `{path, description}` (devMode-only)
  - távoli: `{tokenName}` — részletek §2.2-ben
  - `validateRefsLeaf` a típus alapján ágazik lokális és távoli ágra
  - minden `refs[cat]`, `refs[cat][sub]`, `refs[cat][sub][name]` kulcs `validateRefName`-szerű (`[a-zA-Z0-9._-]+`, `.`/`..` tiltva)
- **`contracts`** (opcionális): `{ <name>: { address, rpc?, description } }` map. `address` kötelező, Ethereum contract RE (`/^0x[0-9a-fA-F]{40}$/`). `rpc` opcionális URL string. `description` kötelező.
- **`tokens`** (opcionális): `{ <name>: { contractName, tokenId, description } }` map. `contractName` eager ellenőrzés: a `contracts` map-ben kell léteznie. `tokenId` decimális string. `description` kötelező.
- **`rpc`** (opcionális, top-level): string. RPC URL fallback, amelyet a saját DAO remote refjei örökölhetnek a `contracts[name].rpc` hiányában. Részletek §2.3-ban és §6.1-ben.
- **`exports`** (opcionális): lapos `[{category, name}]` lista. A `name` mező `validateRefPath`-szerű 2-szintű hivatkozás (`"sub.name"`). Eager cross-reference ellenőrzés a `refs` ellen. Runtime-ban **nem enforce-olódik**.
- **`pages`** (kötelező): minden page csak `html` / `css` / `js` mezőt tartalmazhat, legalább egyet. Minden mező értéke `validateRefPath`-szerű 2-szintű hivatkozás (pl. `pages.home.html: "page.main"` → `refs.html.page.main`).
- **`defaultPage`** (kötelező): létező `pages` kulcs.

Top-level **ismeretlen mezők csendben átmennek** — nincs strict whitelist.

### 5.2. Protokoll config és kapu DAO választás

A boot a tokens/0 lookup-on át letölti a **protokoll config**-ot, parse-olja, és átadja a loader-nek a `window.aqProtocolConfig`-on. A loader modul-szintű state-be teszi.

Protokoll config struktúra:
- **`loader`** (top-level, kötelező): `{cid}` (production) vagy `{path}` (devMode). Description nem kötelező.
- **`gates`** (top-level, kötelező): map `{<gateName>: <gateEntry>}`. Egy elem `{tokenId, description}` (production, `contract` implicit aqProtocol contract, `rpc` örökölt host conf-ból) vagy `{path, description}` (devMode). Description **kötelező**.

A protokoll config **nem validált** runtime-ban.

**Kapu DAO választás precedencia** (a loader végzi):
1. `aqProtocolStorageGet("aqGateDAOName")` — a `_protocol` namespace IndexedDB-ben tárolt érték
2. `conf.aqGateDAOName` — host conf override
3. első `gates` kulcs (insertion order)

Ha a kiválasztott név **nem létezik** a `gates`-ben → hard fail (`"[AQ] gate not found: <name>"`).

### 5.3. Kapu DAO betöltés (`loadGateDao`)

A kapu DAO saját config-gal, refs-szel és pages-szel rendelkezik, **host-szinten renderelődik** — nem iframe-ben (lásd §5.4). Speciális storage namespace: `"gate:" + tokenId` (production) vagy `"gate:" + path` (devMode); stabil a tartalom-frissítések alatt.

A `loadGateDao(gateName, gateEntry, pageKey?)` flow:
1. **DAO ref feloldás:**
   - Production: `resolveDaoCid(gateEntry.tokenId, rpcUrls)` → CID.
   - DevMode: `gateEntry.path` (ha nem devMode → hard fail).
2. **Config betöltés:** `_loadDaoConfigInternal(daoRef, namespace, gateMode=true)`.
3. **Page asset feloldás:** `_resolveGatePageAssets(pageKey)` — ha `pageKey` nincs megadva, `gateCfg.defaultPage` érvényes.
4. **API expose:** `exposeGateApi()` — `window.aqGateApi` közzététele (lásd §5.4).
5. **Renderelés:** `renderGateDao(gateAssets)` — host-szintű DOM injekció, `window.aqGateInit()` meghívása (lásd §5.4).

A `loadDaoConfig` (tartalmi DAO) és a `loadGateDao` a config-betöltési lépésben közös belső függvényre delegál (`_loadDaoConfigInternal`).

---

### 5.4. Kapu DAO host-szintű renderelése

A `aqGateRender.js` modul kezeli a kapu DAO DOM-injekciót.

**`renderGateDao(gateAssets)`** lépései:
1. `<div id="aq-gate-root">` létrehozása (ha még nincs) és `innerHTML` beállítása HTML asset-tel.
2. `<style id="aq-gate-style">` frissítése CSS asset-tel.
3. JS asset betöltése dynamic `<script>` elemmel, Blob URL-en (`application/javascript`).
4. Script betöltés után: `window.aqGateInit()` meghívása, ha a függvény létezik. Visszatérése lehet szinkron vagy `Promise`.

**`renderGatePage(pageKey)`** (`aqLoaderCore.js`): már betöltött kapu DAO config esetén újra renderel egy másik page-et — `_resolveGatePageAssets(pageKey)` → `renderGateDao(gateAssets)`. Config újratöltés nélkül.

**`exposeGateApi()`** (`aqGateApi.js`): a `window.aqGateApi` objektumot egyszer teszi közzé (`Object.defineProperty`, nem felülírható). A kapu DAO JS kódja ezen az API-n keresztül fér hozzá a loader belső funkcióihoz.

**Konvenciók:**
- `window.aqGateInit` — a kapu DAO JS belépési pontja; a loader hívja script betöltés után.
- `window.aqGateApi` — a loader által expose-olt API objektum; a kapu DAO JS kódjából érhető el.
- `window.aqSeedGenComplete` — a loader regisztrálja a boot során (nincs-seed ág); a kapu DAO seed-gen UI hívja le, miután a seed mentése megtörtént (lásd §16).
- `pages.seedGen` — konvencionális pageKey; ha a kapu DAO config tartalmaz ilyen page-et, a loader ezt tölti be a seed-gen flow-ban (`loadGateDao(..., "seedGen")`).

---

## 6. Page betöltés és váltás

A "page" itt **kizárólag a tartalmi DAO** iframe-jét jelenti. A kapu DAO host-szinten renderelődik (lásd §5.3, §5.4).

- Egy aktív iframe létezik
- Page váltáskor teljes dokumentumcsere történik
- A blob URL azonnal revoke-ra kerül

Ez a megoldás:
- egyszerű,
- determinisztikus,
- izoláció-barát.

- page JS start (referencia loader): `AQ_INIT` után a page kód indítása 1 task tickkel késleltetett (pl. `setTimeout(startPageJsOnce, 0)`), hogy a host-oldali init/lock ablak ne ütközzon az első `storageGet` jellegű hívásokkal.

Boot override:

- Boot során a loader ellenőrzi a `location.hash` értékét.
- Ha a hash egy létező `pageKey`, akkor azt tölti be a `defaultPage` helyett.
- Ez az override kizárólag az első DAO betöltéskor érvényes.
- `switchDao` esetén mindig a `defaultPage` töltődik be.

Page-váltás invariáns:
- a régi page bármely még függőben lévő hívása sosem teljesül,
- az új page új session token-nel indul; a régi token-nel jövő üzenetek csendben eldobódnak,
- a régi page heap-je revoke + GC útján szabadul fel.

### Page assetek (referencia loader)
A referencia loaderben a page definíció `html` / `css` / `js` asseteket adhat meg.
Ezek opcionálisak, de **legalább egynek** szerepelnie kell, különben a page invalid.

A page mezők `validateRefPath`-szerű 2-szintű hivatkozások (`"sub.name"`). A loader belső `resolveOwnRef(category, sub, name)` függvénye oldja fel őket — lokális objektum esetén változatlanul, távoli objektum esetén `resolveRemoteRef` lefuttatásával (lásd §6.1). A `fetchAssetText` / `fetchAssetBytes` belső dispatch-csel kezeli a lokális objektumot (cid vs path) és a resolved objektumot (`{cid, cidBase?}`).

### 6.1. Távoli ref feloldás (host-oldal)

A `resolveRemoteRef(remoteRef, category, sub, name, srcContracts, srcTokens, srcRpc)` belső függvény lépései:

1. **Token lookup**: `srcTokens[remoteRef.tokenName]` → token entry (`contractName`, `tokenId`). (Eager validáció garantálja a létezést.)
2. **Contract lookup**: `srcContracts[token.contractName]` → contract entry (`address`, `rpc?`).
3. **RPC URL meghatározás**: `parseRpcConfig(contract.rpc || srcRpc, devMode)` — prioritás: contract `rpc` → DAO config top-level `rpc` (`srcRpc`) → default Gnosis lista.
4. **Cél DAO config CID feloldása**: `resolveDaoCid(token.tokenId, rpcUrls)` eth_call-on át.
5. **Cél-config letöltése**: a **hívó `cidBase`-én** (a cél `cidBase` még nem ismert).
6. **Minimum validáció**: `targetCfg.refs[category][sub][name]` létezik. A cél-config többi része **nem** validált.
7. **Egyszintű kényszerítés**: a cél bejegyzésnek lokális objektumnak kell lennie. Production-ban `cid` kötelező. DevMode-ban `path` is elfogadott (`{path}` visszatérés).
8. **Cél `cidBase` kiolvasás**: ha a cél-config explicit `cidBase`-t hordoz és az eltér a hívóétól, része lesz a visszatérési objektumnak.

Visszatérés: `{cid, cidBase?}` (production) vagy `{path}` (devMode, path-alapú cél). Token- és szerződésadatok nem kerülnek a page felé.

### 6.2. Iframe CSP

A tartalmi DAO iframe-je (`aqPageTemplate.js` `buildIframeDoc`) hardkódolt `<meta http-equiv="Content-Security-Policy">` tagot tartalmaz a generált HTML-ben:

- `connect-src 'none'` — a page JS **nem fetchelhet** közvetlenül. Minden hálózati erőforrás a loaderen keresztül érhető el (`aq.fetchText` / `aq.fetchBytes` capability-k).

Ez a korlátozás nem konfigurálható és nem DAO-felülbírálható.

---

## 7. Hard block és overlay

### 7.1. Hard block

**Single-flight lock (jelenlegi implementáció):** minden `AQ_CALL` capability-hívás kizárólagos lockot vesz a futás idejére (`aqProtocolBus.js`). Amíg egy hívás fut (pl. `storageGet`), minden további `AQ_CALL` `"[AQ] locked"` hibát kap — kivéve az `ALLOW_WHILE_LOCKED` listán szereplők.

A tiltott hívások `AQ_ERROR "[AQ] locked"` választ kapnak.

Jelenlegi `ALLOW_WHILE_LOCKED` bejegyzés: `setStatus` (lásd §7.3).

**Kritikus átmenet (tervezett):** protokoll-kényszerített tokenId hash újraolvasás egyes kritikus lépéseknél (pl. DAO-váltás, szerződés aláírás). Sem a page, sem a DAO nem hagyhatja ki. A DAO is definiálhat kritikus lépést. Ez a single-flight lock-tól független, tervezett biztonsági mechanizmus.

### 7.2. Overlay

Az overlay kizárólag UX elem. Nem protokoll-jelzés. Az overlay host-oldali és **nem DAO-konfigurálható**.

Az overlay (`aqIframe.js`) label réteggel rendelkezik: egy szöveges elemet tartalmaz (`overlayLabelEl`), amelyet a loader belső kódja és a `setStatus` handler tölthet.

**Exportált függvények:**

| Függvény | Leírás |
|---|---|
| `overlayShowLocked(getLocked)` | Lock átmenet: 150ms után opaque, ha még locked |
| `overlayShowBusy()` | Azonnali opaque overlay (dev műveletek, nincs delay) |
| `overlayShowError(text)` | Opaque overlay, szöveg + OK gomb; nem zár automatikusan |
| `overlaySetLabel(text)` | Szöveg beállítása a látható overlayban |
| `overlayHide()` | Overlay elrejtése, label törlése |

Az OK gomb (`overlayShowError` esetén) Enter / Escape billentyűre is reagál.

### 7.3. `setStatus` capability (ALLOW_WHILE_LOCKED)

A `setStatus` postMessage metódus lock alatt is hívható (`ALLOW_WHILE_LOCKED` set, `aqProtocolBus.js`).

- Handler: `overlaySetLabel(p?.text ?? "")` — a page szöveget jeleníthet meg az overlayban lock közben.
- `warnMs`: 1000ms.
- Hívás (page oldalról): `aq.call("setStatus", { text: "..." })`.

Ez az egyetlen metódus, amely lock alatt is teljesül.

---

## 8. Üzenetkezelés (postMessage)

Megjegyzés: a boot / block / READY / INIT sorrend kizárólag a referencia loader implementációs viselkedésének leírása.
Nem jelent implicit protokoll-elvárást.

### 8.1. Session modell
- véletlen session token induláskor,
- token minden üzenetben kötelező,
- source ellenőrzés enforced.
- handshake: `AQ_PAGE_READY` → `AQ_INIT` (host átadja: `pageKey`).
- reply-binding: a host a válaszokat mindig **annak az iframe window-nak** küldi vissza, amelyik a hívást küldte (`ev.source`), és **azzal a tokennel**, amit a kérésben kapott (`msg.token`).
- A host nem használhatja a „jelenlegi" globális session tokent reply-hoz (különben navigate közben token-szivárgás és call-id ütközés történhet).
 
### 8.2. Origin kezelés
- Az origin **nem trust anchor** (web3 gateway esetén nem stabil).
- A referencia loader **hard fail**-t ad, ha a host `location.origin === "null"` (opaque origin), mert a page → host üzenetek targetOrigin-jét csak így lehet a host originre szűkíteni.
- A host → page válaszok targetOrigin-je **`"*"`** (vállalt), mert a sandboxolt iframe originje tipikusan opaque (`allow-scripts allow-downloads` mellett, `allow-same-origin` nélkül). Az `allow-downloads` flag szükséges ahhoz, hogy a page JS fájlletöltést kezdeményezhessen a felhasználó saját DAO-jából.
- Következmény: a host nem szűkíti targetOriginnel a küldést; a védelem `ev.source` + token + reply-binding alapú.
- A referencia loader page oldala (aqPageTemplate.js) emellett `ev.origin !== AQ_HOST_ORIGIN` ellenőrzést is alkalmaz — defense-in-depth második réteg, amely megakadályozza, hogy más originről érkező üzenet a page-en feldolgozódjon.
- A `"*"` használat indoklása a token-leak szempontjából: a host válasz payload-ja tartalmazza a session tokent, de a célpont az iframe.contentWindow — a sandbox-olt page maga a token-tudó fél. Bárki, aki ezt a contentWindow-t hallgatja, már a page izolációján belül fut, így a token-leak nem szélesedik új biztonsági határon át.

### 8.3. Trust modell: origin helyett tartalom
- A loader **nem tekinti** a futtató domain/origint trust anchornek (web3 gateway esetén ez nem stabil).
- Trust anchor: **token + source + reply-binding** (postMessage csatorna).

Kötelező védelmek (domainfüggetlen):
- anti-embedding guard: `top !== self` → hard fail.
- `ev.source === iframe.contentWindow` (csak a saját iframe beszélhet).
- `msg.token === aqSessionToken` (session token hard gate).
- reply-binding: a host a válaszokat **a kérő window + kért token** alapján küldi vissza (`ev.source` + `msg.token`).
- page → host `postMessage` target origin: **`hostOrigin`** (ne `"*"`). Opaque host origin (`"null"`) esetén hard fail.

Plusz rétegek, ha a loader **web2 domainről** fut és van header kontroll:
- CSP `frame-ancestors 'none'` (vagy szűk allowlist) + (legacy) `X-Frame-Options: DENY`.
- CSP `script-src 'self' blob:` — a `aqBoot.js` blob URL-ről injektál loader scriptet; a `blob:` forrás engedélyezése kötelező.
- CSP `connect-src` szűkítés (csak szükséges origin/gateway).
- `Referrer-Policy: no-referrer` (vagy strict).
- `Permissions-Policy` (tiltsd, ami nem kell).
- `Strict-Transport-Security` (HSTS), ha HTTPS.

---

## 9. Watchdog jelzés: `AQ_STUCK`

A loader **nem timeoutol** hívásokat.

Egyes metódusokhoz idő-küszöb tartozik.
Ennek átlépésekor:
- egyszeri `AQ_STUCK` jelzés keletkezik.

Ez:
- nem hiba,
- nem progress,
- nem szakítja meg a hívást.

---

## 10. Capability dispatch (aktuális)

- handler map alapú dispatch
- default deny elv
- ismeretlen metódus → hiba

Ez a modell a referencia implementáció része.

### 10.1. Kapu DAO és a postMessage bus

A kapu DAO **nem a postMessage bus-on** kommunikál a loaderrel. A bus kizárólag a tartalmi DAO iframe-jével kommunikál. A kapu DAO a loader funkcióit a `window.aqGateApi` közvetlen API-n keresztül éri el (lásd §5.4, §14).

---

## 11. DAO-scoped text storage

A protokoll DAO-scope-olt text storage capability-t biztosít IndexedDB alapon, plusz egy speciális protokoll-szintű namespace-t.

### 11.1. DAO-scoped storage

#### Scope

- Storage namespace = az aktuális DAO-hoz beállított `aqDaoNamespace` érték.
  - Sima DAO esetén: a `daoRef` stringesített formája (lokális objektumra is, az asset ref kvázi-stringként).
  - Kapu DAO esetén: `"gate:" + tokenId` (production) vagy `"gate:" + path` (devMode). Stabil a tartalom-frissítések alatt.
- DAO váltás más namespace-re vált.
- Azonos namespace-re visszatérés az adatokat változatlanul elérhetővé teszi.
- A storage modul-szintű állapota (namespace, IndexedDB connection promise) a loader bundle-ben él. Más bundle-be importálva (pl. boot) a state nem osztott — minden bundle saját példányt kap.

### 11.2. Protokoll-szintű storage (`_protocol` namespace)

Külön fix namespace, kód-duplikáció elkerülése: az `aqStorage` modul `aqStorage*Ns(namespace, ...)` belső függvényekkel dolgozik, és külön wrapper-eket exportál a DAO-scoped (`aqStoragePut/Get/...`) és protokoll-szintű (`aqProtocolStoragePut/Get/...`) eléréshez. Mindkét család ugyanazt az `aqStorage` IndexedDB object store-t használja, csak más namespace prefix-szel.

Használat:
- **Loader belső kód**: közvetlenül hívja `aqProtocolStorage*` függvényeket (pl. a kapu DAO választáskor az `aqGateDAOName` olvasása).
- **Kapu DAO (page-ből)**: a `aqGateApi.protocolStorage.*` API-n keresztül. Csak kapu DAO hívhatja (lásd §10.1, §14.1).

Sima DAO **nem fér hozzá** a `_protocol` namespace-hez.

Kulcs formátum (host oldalon):

daoRef + "\n" + storageName

### Adatmodell (node séma)

- Rekord: `{ k, v, m }`
  - `k`: namespace + "\n" + name
  - `v`: node text (string)
  - `m`: node meta (string)
- A storage text-only: **mind a text, mind a meta string**.

### Root node (name = "")

- Root `text` **mindig** `""` (nem írható).
- Root `meta` írható/olvasható.
- `storageDelete("")` a teljes DAO namespace-t törli (wipe).

---

### Támogatott metódusok

storagePut(name, { text?, meta? }) → true  
storageGet(name) → { text: string, meta: string } | null  
storageDelete(name) → { deleted: number }  
storageList(prefix, options?) → { items: ... , text?: string }
storageRename(from, to) → { moved: number }

#### storagePut

- `storagePut` részleges update:
  - amit nem adsz meg (`text` vagy `meta`), az megmarad a meglévő node-ból
  - ha egyik sincs megadva → hiba
- Root text tiltás:
  - `storagePut("", { text: ... })` → hiba
  - `storagePut("", { meta: ... })` → OK

#### storageGet

- Nem-root: ha nincs node → `null`
- Root: mindig létező logikai node-ként kezeljük → `{ text:"", meta:"..." }`

#### storageList

Alapértelmezések:
- `options.meta` default: `true`
- `options.text` default: `false`

Visszatérés:
- `items`:
  - ha `meta:true` (default): `[{ name, meta }]`
  - ha `meta:false`: `string[]` (csak a child nevek)
- `text` mező csak akkor szerepel, ha `options.text:true`.

példák:

storageList("a") →
  { items: [ { name:"b", meta:"..." }, ... ] }

storageList("a", { meta:false }) →
  { items: ["b", ...] }

storageList("a", { text:true }) →
  { text:"(a text)", items: [ { name:"b", meta:"..." }, ... ] }

---

### Hierarchia modell (B-modell)

- Kulcsok "/" szeparátorral hierarchikusak.
- Prefix csak akkor létezhet, ha parent prefix is létezik.
- "Directory" létrehozás = üres string put.

példa:

storagePut("a",   { text:"" })
storagePut("a/b", { text:"" })
storagePut("a/b/c", { text:"text" })

---

### Rename invariáns

- atomic subtree move
- target nem létezhet
- target nem lehet source subtree-ja
- rename a subtree összes node-ján megőrzi mind a `text`-et, mind a `meta`-t

Megjegyzés:

A storage prefix-zárt invariánsa miatt elegendő a target prefix létezésének ellenőrzése.
Ha b/c létezik, akkor b is létezik, ezért külön subtree vizsgálat nem szükséges.

---

### Normalizáció

- trim
- multiple "/" → single "/"
- leading "/" eltávolítva
- trailing "/" eltávolítva
- Unicode NFC normalizáció

---

### Karakterek

Engedett:

- Unicode Letter, Number
- space _ - . , : ; @ # ( ) [ ] ' " + = ! ?
- "/" separator

Leaf tartalmazzon legalább egy Letter vagy Number karaktert.

---

## 12. WEB2 lokális dev szerver (aktuális, read-only)

A referencia implementáció részeként **három külön Node.js processz** szolgál ki a lokális fejlesztéshez. A cél: a WEB3 réteg (CID feloldás + RPC) lokálisan szimulálható kézi fájl-elhelyezéssel.

### 12.1. Portok és szerepek

- **`8080`** WEB statikus — `npx serve`, a projekt gyökerét szolgálja ki. A böngésző ezt nyitja meg (`http://localhost:8080/demo/html`).
- **`8081`** CID asset szolgáltató — `server/cidServer.js`, `GET /cid/<hash>` route.
- **`8082`** JSON-RPC mock — `server/rpcServer.js`, `POST /rpc` route (eth_call kompatibilis).

A 3 port külön domain szimulációt szolgál (CORS-szerű cross-origin kontextus): production-ban a CID feloldás és az RPC külön szolgáltatók, ez a setup ezt imitálja lokálisan is.

### 12.2. Indítás

`startServers.ps1` (PowerShell) `concurrently`-vel négy processzt indít:

```
WEB    (green)   — npx serve -l 8080 .
BUILD  (yellow)  — npm --prefix .\loader run watch
CID    (cyan)    — node .\server\cidServer.js
RPC    (magenta) — node .\server\rpcServer.js
```

### 12.3. Adat-root

- Default: `server/data/` (a `server.js`-ek melletti almappa).
- Felülírás: env `AQ_DATA_ROOT` változó.
- Almappák: `<dataRoot>/blobs/` (CID-elnevezésű asset-fájlok), `<dataRoot>/tokens/` (tokenId-elnevezésű szövegfájlok, tartalmuk a hozzá tartozó 64-hex CID).
- A `tokens/0` a **protokoll config CID-jét** tartalmazza (a boot innen indul).
- Mappa-létrehozás: induláskor hard fail, ha a `<dataRoot>` vagy `blobs/` / `tokens/` nem létezik. Kézzel kell `mkdir`-rel létrehozni.

### 12.4. CID szerver (`/cid/<hash>`)

- `GET` only, egyéb method → 405.
- CID formátum: `/^[0-9a-f]{64,128}$/i`, egyébként 400.
- Path traversal védelem (a feloldott path-nak a `blobs/` alatt kell maradnia).
- Sikeres válasz: `Content-Type: application/octet-stream`, `Cache-Control: public, max-age=31536000, immutable`, `Access-Control-Allow-Origin: *`.
- Hiányzó fájl → 404.

### 12.5. RPC szerver (`/rpc`)

- `POST` only, egyéb method → 405 vagy 404. `OPTIONS` → 204 (CORS preflight válasz).
- Body validáció: JSON, `method === "eth_call"`, `params[0]` objektum.
- `params[0].to` ellenőrzése: az aqProtocol DAO contract cím (`0x64521be8...`).
- `params[0].data` ellenőrzése: kezdődik a `0xcc2fb628` (selector = `getSwarmHash(uint256)`) prefix-szel + 64 hex (uint256 tokenId).
- TokenId parse: `BigInt("0x" + tokenIdHex).toString(10)`.
- Fájl olvasás: `<dataRoot>/tokens/<tokenId>`, tartalom 64 hex (BOM nélkül).
- Sikeres válasz: `{jsonrpc:"2.0", id, result: "0x" + cid}`.
- Hiányzó fájl → `{jsonrpc:"2.0", id, result: "0x"}` (revert szimuláció, a kliens "contract reverted" hibát ad).
- CORS: `Access-Control-Allow-Origin: *`.

### 12.6. Közös helper modul

`server/util.js`:
- `resolveDataRoot(importMetaUrl)` — env override + default lokális path.
- `requireDir(path, label)` — hard fail induláskor, ha nincs.
- `readBody(req, maxBytes = 65536)` — POST body olvasás méret-limittel.
- `logRequest(label, method, url, status, extra)` — egysoros request log.
- `logStartup(label, port, dataDir)` — induláskor két soros log.

### 12.7. `server/package.json`

- `type: module`, nulla külső dep
- `scripts.cid` és `scripts.rpc` indítók

### 12.8. Limitációk

- Read-only: nincs upload, nincs token-allokálás, nincs wallet aláírás.
- Manuális fájlkezelés (a fejlesztő közvetlenül ír a `blobs/` és `tokens/` mappákba).
- Egyszerre csak egy contract cím elfogadott (az aqProtocol DAO `0x64521be8...`).

---

## 13. WEB2 write szerver — AQS (`aqServer.js`)

A `server/aqServer.js` a protokoll write-os referencia szerverje. Port: `8083` (env `AQ_PORT`). CORS: minden endpoint `Access-Control-Allow-Origin: *`.

### 13.1. Autentikáció

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

### 13.2. Whitelist (`data/whitelist.json`)

JSON tömb lowercase wallet-címekkel. Minden write operáció megköveteli a whitelist-en való szerepelést.

Példa: `["0x4fe481e8df86f415ffd5476ce6cfc15439234077"]`

### 13.3. Endpointok

**`POST /aq/asset`** — asset feltöltés
- Auth ellenőrzés (whitelist).
- Request body: nyers bytes (max `AQ_MAX_UPLOAD`, default 10 MB).
- A szerver random 64-hex CID-et generál, elmenti `data/wallets/<wallet>/<cid>` alá, symlink-et készít `data/blobs/<cid>` → `../wallets/<wallet>/<cid>`.
- Válasz: `{ cid: "<64-hex>" }`.

**`GET /cid/<hash>`** — asset olvasás
- CID formátum: `/^[0-9a-f]{64,128}$/i`.
- Symlink-en keresztül olvas a `data/blobs/` mappából.
- Válasz: `application/octet-stream`, `Cache-Control: immutable`.

**`POST /rpc`** — JSON-RPC write metódusok

| Metódus | Leírás |
|---|---|
| `eth_call` | TokenId → CID feloldás (read-only, auth nélkül) |
| `aqMintToken` | Új token allokálás; auto-incrementáló, 100-tól indul (0–99 rezervált) |
| `aqSetSwarmHash` | TokenId → CID beállítás (owner ellenőrzés) |

### 13.4. TokenId ownership

- `data/ownership.json`: `{ "<tokenId>": "<wallet>" }` map.
- `aqMintToken`: új tokenId auto-inkrementálva (0 kihagyva), a hívó wallet lesz az owner.
- `aqSetSwarmHash`: csak az owner írhat a tokenId-re.
- **TokenId=0 speciális eset**: ha nincs ownership bejegyzés, az első whitelisted writer automatikusan megkapja az ownershipet. (TokenId=0 a protokoll config tokenje — `aqMintToken` soha nem allokálja.)

### 13.5. Deploy (referencia)

- Raspberry Pi, systemd service (`aq-server.service`), nginx reverse proxy.
- Elérés: `https://damjanch.mooo.com` (nginx terminál SSL, proxyzza `/rpc`, `/cid/`, `/aq/` útvonalakat → `http://127.0.0.1:8083`).
- Deploy script: `deployServer.ps1` (pscp + plink, két passphrase prompt).

---

## 14. `window.aqGateApi` (aktuális)

A kapu DAO JS kódja a `window.aqGateApi` objektumon keresztül fér hozzá a loader belső funkcióihoz. Az API expose-olását az `exposeGateApi()` (`aqGateApi.js`) végzi közvetlenül a renderelés előtt (lásd §5.4).

Az API frozen, `Object.defineProperty`-vel közzétéve — nem felülírható, nem törölhető.

### 14.1. `aqGateApi.protocolStorage.*`

A `_protocol` namespace-storage eléréséhez. Mind az 5 metódus a megfelelő `aqProtocolStorage*` belső függvényre delegál; paraméterek és visszatérési szerződés azonosak az `aq.storage*` postMessage capability-kkel (lásd §11).

| Metódus | Leírás |
|---------|--------|
| `protocolStorage.put(name, patch)` | Részleges update, visszatér `true`-val |
| `protocolStorage.get(name)` | Visszatér `{ text, meta }` vagy `null` |
| `protocolStorage.delete(name)` | Visszatér `{ deleted: number }` |
| `protocolStorage.list(prefix, options?)` | Visszatér `{ items, text? }` |
| `protocolStorage.rename(from, to)` | Visszatér `{ moved: number }` |

A `_protocol` namespace adatait sem a tartalmi DAO-k, sem a fogyasztói page-ek nem érik el — kizárólag a kapu DAO JS kódja (ezen az API-n) és a loader belső kódja (közvetlen hívással).

### 14.2. `aqGateApi.seed.*`

A seed store és unlock eléréséhez (lásd §15, §16, §18).

| Metódus | Leírás |
|---------|--------|
| `seed.store(record)` | Seed rekord mentése |
| `seed.exists()` | Visszatér `true` / `false` |
| `seed.unlock(password?)` | Seed dekódolása, `_unlockedSeed` betöltése memóriába (jelszó vagy WebAuthn-PRF) |
| `seed.activate(rawBytes)` | Seed közvetlen aktiválása (seed-gen után, re-decrypt nélkül) |

A `seed.unlock` a teljes seed-et dekódolja és memóriában tartja — a kapu DAO a nyers seed-et nem kapja meg, de az unlock elvégezhető általa (pl. auth flow részeként).

### 14.3. `aqGateApi.wallet.*`

| Metódus | Leírás |
|---------|--------|
| `wallet.addresses()` | Az összes konfigurált wallet cím visszaadása `{ [key]: address \| null }` formában; seed szükséges |

### 14.4. `aqGateApi.gate.*`

| Metódus | Leírás |
|---------|--------|
| `gate.done()` | Auth flow befejezése: kapu DAO teardown, overlay eltüntetése |

---

## 15. Seed store (`aqKeyring.js`)

A seed store egy dedikált, elkülönített IndexedDB adatbázis, amelybe a felhasználó titkosított seedje kerül. Teljesen szeparált az `aqStorage` főtárolótól.

- DB neve: `"aqSeed"`, verzió: 1.
- Object store: `"seed"`, kulcs: `"current"` (egyszerre egy rekord létezhet).

### 15.1. `seedExists()`

Visszatér `true`-val, ha a `"current"` rekord létezik. **A rekord tartalmát nem olvassa fel** — csak a kulcs jelenlétét ellenőrzi.

### 15.2. `seedStore(record)`

Seed rekord mentése. Kötelező mezők:
- `version` — schema version
- `method` — `"webauthn-prf"` vagy `"password"`
- `salt` — nyers bájt-adat
- `ciphertext` — titkosított tartalom
- `iv` — inicializáló vektor

Ha `method === "webauthn-prf"`, a `credentialId` mező is kötelező.

Feltételek:
- Ha seed már létezik → hiba (nem írható felül).
- Mentéskor `storedAt: Date.now()` automatikusan hozzáadódik.

### 15.3. Hozzáférési modell

| Hozzáférő | Olvasás | Írás |
|-----------|---------|------|
| Kapu DAO (`aqGateApi.seed.*`) | `exists()`, `unlock()`, `activate()` | `store(record)` igen |
| Loader belső kód (`seedGetInternal`) | igen | — |
| Tartalmi DAO (postMessage) | nem | nem |

A kapu DAO JS kódja **nem olvashatja** a seed rekord tartalmát — csak a jelenlétét ellenőrizheti és új seedet tárolhat. A seed tartalomhoz kizárólag a loader belső kódja fér hozzá (`seedGetInternal`, nincs expose).

---

## 16. Seed-gen flow

A seed-gen flow a boot során fut le, ha a felhasználónak még nincs seedje.

### 16.1. Boot integráció

A loader boot végén (DOM-ready, kapu DAO választás után) a `seedExists()` eredménye alapján két ág (lásd §4.3):

- **Nincs seed**: `loadGateDao(gateName, gateEntry, "seedGen")` → a kapu DAO `pages.seedGen` page-e töltődik be host-szinten. A loader **visszatér és vár** — a folytatás `window.aqSeedGenComplete()` hívásakor történik.
- **Van seed**: `loadGateDao(gateName, gateEntry)` → normál indulás, majd `loadContentDao(openTokenId)`.

### 16.2. `window.aqSeedGenComplete`

A loader a boot során (nincs-seed ág) regisztrál egy globális `window.aqSeedGenComplete` async függvényt. A kapu DAO seed-gen UI ezt hívja le, miután a seed sikeresen el lett tárolva (`aqGateApi.seed.store(record)`).

`aqSeedGenComplete` lefutásakor:
1. `setLocked(true)`, overlay megjelenítés.
2. `renderGatePage()` — kapu DAO `defaultPage`-re vált (seed-gen UI leváltva).
3. `loadContentDao(conf.openTokenId)` — tartalmi DAO betöltése.
4. `setLocked(false)`, overlay elrejtés.

### 16.3. Platform célok

A seed-gen UI-t a kapu DAO implementálja. Referencia implementáció: `demo/gate-test/seedGen.html`, `seedGen.css`, `seedGen.js`.

Jelenleg támogatott módszerek:
- `"webauthn-prf"` — biometrikus, WebAuthn PRF extension (platform authenticator). Platformok: Android Chrome 122+, Windows Edge/Chrome 122+, iOS Safari 17.4+.
- `"password"` — jelszóalapú (PBKDF2 600k iter + AES-GCM).

BIP-39 12 szó (128 bit entrópia). A seed phrase soha nem jelenik meg a felhasználónak.

### 16.4. Recovery flow

Seed elvesztésekor nincs automatizált recovery — tervezett elem (Plan).

---

## 17. Wallet deriváció és store

Implementáció: `aqKeyring.js` (seed/session/wallet funkciók egyetlen modulban — lásd §15, §19).

### 17.1. Wallet deriváció

Két export:

- `fromRawSeed(seedBytes, index)` — 16 bájt raw seed → HDNodeWallet (`HDNodeWallet.fromSeed`), BIP-44 path `m/44'/60'/0'/0/<index>`. Felhasználói flow (seed store-ból dekódolt nyers bájt).
- `fromMnemonic(phrase, index)` — BIP-39 mnemonic → HDNodeWallet (`HDNodeWallet.fromPhrase`). Dev / MetaMask flow.

Visszatérési érték: `{ address, sign(msg) }` — a privát kulcs zárt closure-ben él, nem kerül ki. A `sign(msg)` az ethers.js `signMessage` (EIP-191) wrapper.

Függőség: `ethers ^6.0.0` (`loader/package.json` dependencies).

### 17.2. Wallet config

`WALLET_DEFS` (frozen):

| Kulcs | Típus | Index / Range |
|---|---|---|
| `web2Devel` | fix | 1000 |
| `gateWriter` | sticky | [100 000, 9 999 999] |
| `mintOp` | oneshot | start 10 000 000 |

- **fix**: mindig ugyanaz az index.
- **sticky**: első használatkor véletlenszerű index a range-ben, majd IndexedDB-ben eltárolódik.
- **oneshot**: minden operációnál `start + counter` (aktuális counter értékkel), majd `counter++` perzisztál IndexedDB-ben.

### 17.3. Wallet store

**`getWallet(key, seedInput)`** → `{ address, sign }`
- `seedInput`: `Uint8Array` (raw seed) → `fromRawSeed`, string → `fromMnemonic`.
- Index meghatározás: `resolveIndex(key, def)` — fix: direkt; sticky: IndexedDB-ből vagy random; oneshot: `start + counter` (aktuális), majd `counter++`.
- Fix / sticky esetén `{ index, address }` mentődik IndexedDB-be (`wallet.<key>` kulcs, `_protocol` namespace).
- Oneshot esetén csak `{ counter }` mentődik (address nem).

**`getAddress(key)`** → `string | null`
- Csak az eltárolt address olvasása, seed nélkül.
- Oneshot esetén `null` (address nem cache-elődik).

**`getWalletAddresses()`** → `{ [key]: address | null }`
- Seed szükséges (`_unlockedSeed`). Fix wallet-eknél seed-ből derivál, sticky-nél IndexedDB-ből olvas.
- Oneshot wallet-ek nem szerepelnek (nincs cache-elt cím).
- Nincs PWA / devMode korlát — a cím nem érzékeny adat.

IndexedDB kulcsformátum: `wallet.<key>` a `_protocol` namespace-ben.

**Érzékeny adat kezelése:**
- Seed és mnemonic deriváció után azonnal eldobandó — nem marad session végéig memóriában.
- A visszaadott `{ address, sign }` closure privát kulcsot tartalmaz (elkerülhetetlen), de csak egyetlen BIP-44 indexre érvényes.

---

## 18. Host hamburger menü (`aqHostMenu.js`)

Mindig aktív — devMode és production egyaránt. Az `aqProtocolLoader.js` hívja `initHostMenu()`-t a tartalmi DAO betöltése után.

### 18.1. UI struktúra

- **☰ gomb** (jobb felső sarok, `z-index: 100000`): toggleli a panel megnyitását. Ha bármi nyitva van, bezár mindent.
- **Panel** (`z-index: 99999`): dropdown, menüpontok listája.
  - Mindig: **Wallet**
  - devMode: **Publish Gate**, **Refresh Protocol**, **Clear IndexedDB**
  - Production: **Fork DAO**
- **Dialog** (`z-index: 99999`): a kiválasztott műveletet reprezentáló form, a panel helyett jelenik meg.
- **Backdrop** (`z-index: 99997`): transzparens, pointer-events:auto fedőréteg — kattintásra mindent zár. Blokkolja az iframe interakciót amíg panel/dialog nyitva van.

Keyboard navigáció: nyilak (panel), Enter (aktivál), Escape (zár), a dialogban is Enter/Escape.

### 18.2. Wallet

Minden módban aktív. `getWalletAddresses()` (`aqKeyring.js`) fut — seed unlock szükséges. Fix wallet-eknél seed-ből derivál, sticky-nél IndexedDB-ből olvas.

### 18.3. Publish Gate (devMode)

**Flow:**
1. Wallet: `fromRawSeed(seedGetRaw(), 1000)` — address silent clipboard-ra.
2. Gate config: `getGateCfg()` → másolat, `rpc` mező törlése.
3. `processPathRefs()`: path ref → upload → CID (lásd §18.7).
4. Gate config feltöltés: `POST <serverUrl>/aq/asset` → CID.
5. Token beállítás: `aqSetSwarmHash`, tokenId=1 → CID.

### 18.4. Refresh Protocol (devMode)

**Flow:**
1. Wallet: `fromRawSeed(seedGetRaw(), 1000)` — address silent clipboard-ra.
2. Protocol config: `getProtocolCfg()` → másolat.
3. Gate entry-kből `path` törlése ha `tokenId` is van (tokenId marad).
4. `processPathRefs()`: path ref → upload → CID (lásd §18.7).
5. Protocol config feltöltés: `POST <serverUrl>/aq/asset` → CID.
6. Token beállítás: `aqSetSwarmHash`, tokenId=0 → CID.

**Státusz**: overlay label réteggel (`overlaySetLabel`, `overlayShowBusy`, `overlayShowError`).

**Siker**: overlay azonnal zár, dialog zár.  
**Hiba**: `overlayShowError` — OK gomb (+ Enter/Escape) zárja az overlayt; dialog nyitva marad.

**Form**: Server URL szabad szöveg.

### 18.5. Fork DAO (production)

**Flow:**
1. Wallet: `fromRawSeed(seedGetRaw(), 1000)` — address silent clipboard-ra.
2. DAO config: `getDaoCfg()` → másolat.
3. `processPathRefs()`: path ref → upload → CID (lásd §18.7).
4. DAO config feltöltés: `POST <serverUrl>/aq/asset` → CID.
5. TokenId: ha üres → `aqMintToken` → új 100+ tokenId; ha megadott → azt használja.
6. Token beállítás: `aqSetSwarmHash`, tokenId → CID.

**Form**: Server URL + TokenId input (üres = új token).

### 18.6. Clear IndexedDB (devMode)

Összes IndexedDB törlése (`aqSeed`, `aqSession`, `aqStorage`). Visszavonhatatlan. Utána `location.reload()`.

### 18.7. processPathRefs (belső)

`processPathRefs(serverUrl, wallet, config)` — a config másolatában minden `refs[cat][sub][name].path` ref → upload → `{cid, description}`. A `loader.path` is feltöltődik ha jelen van. Közös belső segítő a publish műveletek számára.

---

## 19. Keyring: seed unlock, session és auth flow

A `aqKeyring.js` tartalmaz minden seed és session funkciót. §15 a seed store-t (IndexedDB write/exists), §17 a wallet derivációt dokumentálja — ez a szekció az unlock mechanizmust, a session kezelést és a boot auth flow-t írja le.

### 19.1. Seed unlock

**`seedUnlock(password?)`** — async. Ha `_unlockedSeed` már megvan, azonnal visszatér. Flow:
1. `seedGetInternal()` — belső, csak loader kódból elérhető; kiolvas a `aqSeed` DB-ből.
2. `decryptRecord(record, password)`:
   - `"webauthn-prf"`: `navigator.credentials.get` PRF extension → AES-GCM decrypt.
   - `"password"`: PBKDF2 (600 000 iter, SHA-256) → AES-GCM decrypt.
3. Visszafejtett raw seed → `_unlockedSeed`.
4. `sessionSave()` aszinkron háttérben (§19.2).

**`seedActivate(rawBytes)`** — seedGen flow közvetlen aktiválás (seed mentés után, re-decrypt nélkül). `Uint8Array` kötelező. `sessionSave()` aszinkron háttérben.

**`seedGetRaw()`** — szinkron; `isPwa || devMode` feltétel. `_unlockedSeed` referenciát adja vissza. Publish és deriválási műveletek hívják.

**`isSeedUnlocked()`** — szinkron, memória-check (`_unlockedSeed !== null`). Race condition elkerülés az auth flow-ban.

### 19.2. Session store (`aqSession`)

Külön IndexedDB: `"aqSession"`, v1, `"session"` object store, kulcs: `"current"`. Raw seed `ArrayBuffer`-ként tárolódik — nem titkosítva. Védelmi szint: böngésző origin isolation.

- **`sessionSave()`** — belső; `_unlockedSeed` → `ArrayBuffer` → IndexedDB.
- **`sessionLoad()`** — `ArrayBuffer` visszaolvasás → `_unlockedSeed` beállítás → `true` / `false`.

Logout = teljes IndexedDB törlés (§18.6 Clear IndexedDB).

### 19.3. Boot auth flow

`aqProtocolLoader.js` normál boot ága (seed létezik):

```
const sessionActive = isSeedUnlocked() || await sessionLoad();
if (!sessionActive) {
    await loadGateDao(gateName, gateEntry); // auth prompt
}
await loadContentDao(openTokenId);
initHostMenu();
```

- `isSeedUnlocked()` szinkron elsőbbséget kap.
- Session aktív → gate DAO kihagyva.
- Sem memória, sem session → gate DAO auth prompt (`defaultPage`).

`aqSeedGenComplete` callback (seed-gen utáni ág):

```
const sessionActive = isSeedUnlocked() || await sessionLoad();
if (sessionActive) {
    teardownGateDao();      // seed-gen UI eltávolítása
} else {
    await renderGatePage(); // defaultPage (auth prompt)
}
await loadContentDao(openTokenId);
initHostMenu();
```

### 19.4. Gate teardown (`teardownGateDao`)

`teardownGateDao()` (`aqGateRender.js`) — szinkron DOM cleanup:
- `#aq-gate-root`, `#aq-gate-style`, `#aq-gate-script` elemek eltávolítása.
- JS blob URL revoke.
- `_imageBlobUrls` lista teljes revoke (aq:// képek, §19.5).

Hívódik: session-aktív boot ágban; kapu DAO JS-ből `gate.done()` hívásakor (auth flow befejezésekor).

### 19.5. aq:// asset referencia séma

A kapu DAO HTML asset-jeiben `aq://` sémájú hivatkozások blob URL-re cserélődnek a renderelés előtt.

**Formátum**: `aq://<category>/<sub>.<name>`

Feldolgozás (`preprocessAqRefs`, `aqLoaderCore.js`):
1. Regex-match: `/aq:\/\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/g`
2. `resolveRefIn(gateCfg, category, sub, name)` → `fetchAssetBytes` → `URL.createObjectURL`.
3. MIME: path kiterjesztésből (`png/jpg/jpeg/svg/webp/gif`). CID ref default: `image/png`.
4. Blob URL-ek `_imageBlobUrls` tracking; `teardownGateDao()` revoke-olja.

Csak gate DAO HTML-ben aktív. Tartalmi DAO (iframe) nem kap aq:// feldolgozást.

### 19.6. TokenId foglalás

| Range | Funkció |
|-------|---------|
| `0` | Protokoll config |
| `1–99` | Protokoll, gate DAO-k, rendszer |
| `100+` | Sima DAO-k (`aqMintToken` innen indul) |

- Gate DAO referencia tokenId: `"1"`.
- DevMode-ban: gate entry `path` + `tokenId` párhuzamosan jelen lehet; namespace a `tokenId`-re épül (stabil).
- Production-ban: csak `tokenId`.
