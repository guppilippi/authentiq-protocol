# AQ Protocol – Implementation Guide

## Dokumentum státusza
Ez a dokumentum **nem normatív**.  
Az AQ protokoll **aktuális referencia implementációját** írja le: azt, ami **jelenleg létezik és működik** a kódban.

Ez a dokumentum:
- nem roadmap,
- nem jövőbeli ígéret,
- nem fogalmi magyarázat.

Ha egy elem kikerül a kódból, **innen is kikerül**.

**Megjegyzés a jelen állapothoz**: a jelenleg működő és dokumentált referencia a build-elt `aqBoot.js` és `aqProtocolLoader.js` IIFE bundle (forrásmodulok a `loader/src/` mappában, esbuild pipeline; lásd Plan §14.2). A WEB2 lokális dev szerver (read-only) is része a referencia implementációnak (lásd §12). Minden más (write-os szerver endpointok, watcher, publikálási flow, fork mechanizmus) **terv**, és a Plan dokumentumba tartozik, nem ide.

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
- futási invariáns: a böngészőben kizárólag a build-elt bundle-ök futnak; a forrásmodulok fejlesztési artefaktumok (Plan §14.2).

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

### 2.4. Cache policy (referencia loader)

- lokális `"/..."` path: `fetch(..., { cache: "no-store" })` (DEV workflow, mindig friss)
- CID asset: `fetch(..., { cache: "force-cache" })` (immutable tartalom, maximalizált böngésző cache)

Megjegyzés: a CID tartalom integritását a CID + resolver/gateway réteg garantálja; a loader nem végez külön hash-ellenőrzést. Távoli ref feloldáskor a cél-config letöltése is ezen a cache policy-n megy keresztül (CID alapú, force-cache). **Modul-state cache nincs**: minden távoli ref feloldás újra megy az eth_call + cél-config fetch láncon — a browser HTTP cache véd. A `cacheable` flag és a hozzá tartozó modul-state cache infrastruktúra tervezett (Plan §16.1).

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
- a futási környezet biztosítása (legalább HTTP(S) origin; `origin !== "null"`).

Dev mód (referencia loader):
- **nem konfigurálható**, nem flag.
- kizárólag a loader origin alapján dől el: `localhost | 127.0.0.1 | ::1`.
- a page nem kap devMode jelzést (nem policy-holder).

### 4.2. Boot flow (`aqBoot.js`)

A boot flow lépései:

1. **Host conf olvasás**: `window.aqProtocolPageConf`-ot beolvassa, `parseRpcConfig` lefut.
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
3. **Protokoll config olvasás**: `window.aqProtocolConfig` kiolvasása, modul-szintű state-be (`aqLoaderCore.protocolCfg`), majd törlés a globalből.
4. **RPC URL-ek beállítása**: `setAqRpcUrls(parseRpcConfig(conf.rpc, devMode))`.
5. **Pagehide cleanup regisztrálása**.
6. **DOM-ready** után (vagy azonnal, ha kész):
   - `setLocked(true)`, overlay megjelenítés.
   - **Kapu DAO választás** (lásd §5.2).
   - **Seed ellenőrzés**: `seedExists()` — két ág:
     - **Nincs seed**: `loadGateDao(gateName, gateEntry, "seedGen")` indul, majd a loader **visszatér** (nem folytatja). A boot-folyamat a kapu DAO `window.aqSeedGenComplete()` callback-jén keresztül folytatódik (lásd §16).
     - **Van seed**: `loadGateDao(gateName, gateEntry)`, majd `loadContentDao(openTokenId)`.
   - `setLocked(false)`, overlay elrejtés.

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
- opcionálisan `cidBase`, `rpc`, `cacheable` (a Plan §2.1 részletezi)

A séma **implementációfüggő** és csak a referencia loaderre érvényes.

A `loadDaoConfig` a betöltött configot szigorúan validálja (`validateDaoConfig`); hibás séma esetén a betöltés hard fail-lel megáll, a page-betöltés meg sem indul.

### 5.1. DAO config validáció

Validált mezők (jelenlegi kódállapot):
- **`refs`** (opcionális, 2-szintű): `refs[category][subcategory][name] = leaf`. Engedett kategóriák: `js`, `css`, `json`, `html`, `others`. Minden levél objektum:
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

A `cacheable` flag tervezett (Plan §16.1).

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

**`unmountGateDao()`**: eltávolítja a `#aq-gate-root`, `#aq-gate-style`, `#aq-gate-script` elemeket; revoke-olja a Blob URL-t; törli a `window.aqGateInit` referenciát.

**`renderGatePage(pageKey)`** (`aqLoaderCore.js`): már betöltött kapu DAO config esetén újra renderel egy másik page-et — `_resolveGatePageAssets(pageKey)` → `renderGateDao(gateAssets)`. Config újratöltés nélkül.

**`exposeGateApi()`** (`aqGateApi.js`): a `window.aqGateApi` objektumot egyszer teszi közzé (`Object.defineProperty`, nem felülírható). A kapu DAO JS kódja ezen az API-n keresztül fér hozzá a loader belső funkcióihoz. Teardown: `tearDownGateApi()`.

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

---

## 7. Hard block és overlay

### 7.1. Hard block
Kritikus átmenetek során (page / DAO váltás):
- minden protokoll-hívás tiltott,
- kivétel: explicit allowlistelt metódusok.

A tiltott hívások AQ_ERROR "[AQ] locked" választ kapnak.

Megjegyzés: a jelenlegi referencia implementációban **nincs allowlist kivétel** (default deny minden metódusra block alatt).

### 7.2. Overlay
Az overlay kizárólag UX elem.
Nem protokoll-jelzés, nem státuszcsatorna.
Az overlay host-oldali, minimál, és **nem DAO-konfigurálható**.

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
- A host → page válaszok targetOrigin-je **`"*"`** (vállalt), mert a sandboxolt iframe originje tipikusan opaque (`allow-scripts` mellett, `allow-same-origin` nélkül).
- Következmény: host → page irányban nincs targetOrigin-szűkítés; a védelem `ev.source` + token + reply-binding alapú.
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
- CSP `script-src` / `connect-src` szűkítés (csak szükséges origin/gateway).
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

Nincs dev-only capability.
Nincs host write endpoint.

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
- A storage modul-szintű állapota (namespace, IndexedDB connection promise) a loader bundle-ben él. Más bundle-be importálva (pl. boot) a state nem osztott — minden bundle saját példányt kap. Lásd Plan §14.2 invariáns.

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
- A `tokens/0` mostantól a **protokoll config CID-jét** tartalmazza (a boot innen indul).
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
- Plan §19 tárgyalja a write-os bővítést (későbbi mérföldkő).

---

## 13. refs capability-k (aktuális)

A loader három capability-t exponál a page felé a saját DAO `refs` blokkjának eléréséhez. Mindhárom a postMessage capability-csatornán megy (handler dispatch, `aqProtocolBus.js`).

### 13.1. `aq.ref(category, "sub.name") → ref` (async)

- A futó DAO `refs[category][sub][name]` bejegyzését oldja fel a host oldalon.
- `category` csak a `refs` engedett kategóriái közül (`js`, `css`, `json`, `html`, `others`).
- A második paraméter `validateRefPath` szerint validált (egzakt 2 szegmens, pont-szeparátor).
- Hiányzó bejegyzés → hiba.
- A page nem fetchel: a `ref` csak az azonosítót adja, a tartalmat a `fetchText` / `fetchBytes` tölti.

**Visszatérés**:
- **lokális** refs levél esetén: a config-ban lévő levél objektum változatlan (`{cid, description}` vagy `{path, description}`).
- **távoli** refs levél esetén: a host elvégzi a tokenName → tokens → contracts → eth_call → cél-config lookup láncot (lásd §6.1), és a page-nek **`{cid, cidBase?}` köztes objektumot** ad vissza. Token- és szerződésadatok **nem** kerülnek a page felé.

A távoli ref feloldás async: az `aq.ref()` hívás `await`-elendő.

### 13.2. `aq.fetchText(ref) → string`

- Input lehet **lokális objektum** (`{cid, description}` vagy `{path, description}`), **`{cid, cidBase?}` köztes objektum** (az `aq.ref()` távoli ágának visszatérése), **vagy** **nyers string** (CID vagy devMode-ban path; tokenId TILOS).
- Lokális objektum vagy nyers string esetén a saját DAO `cidBase`-én oldódik fel.
- `{cid, cidBase?}` objektum esetén a megadott `cidBase`-en, vagy ha hiányzik, a saját DAO `cidBase`-én.
- UTF-8 dekódolt szövegként ad vissza.

### 13.3. `aq.fetchBytes(ref) → ArrayBuffer`

- Mint a `fetchText`, de nyers bájtokat ad vissza (ArrayBuffer).
- A `fetchBytes` eredménye a postMessage `AQ_RESULT` payload-jában structured clone-nal másolódik (nem transfer list).

### 13.4. Megjegyzések

- A capability-k a belső `fetchAssetText` / `fetchAssetBytes` (`aqAssetFetch.js`) függvényeket exponálják kontrolláltan; a függvények belső dispatch-csel kezelik a string, lokális objektum, és `{cid, cidBase?}` resolved objektum input-okat.
- A behúzott tartalom futtatása (pl. JS) a page sandbox-dolga; a loader csak a tartalmat szolgáltatja.
- Modul-state cache nincs: minden `fetchText` / `fetchBytes` újra-fetchel (a browser HTTP cache véd, CID-re `force-cache`). Távoli ref minden `aq.ref()` híváskor újra-feloldódik. A `cacheable: false` flag és a hozzá tartozó modul-state cache infrastruktúra tervezett (Plan §16.1).

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

A seed store eléréséhez (lásd §15, §16).

| Metódus | Leírás |
|---------|--------|
| `seed.store(record)` | Seed rekord mentése |
| `seed.exists()` | Visszatér `true` / `false` |

---

## 15. Seed store (`aqSeed.js`)

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
| Kapu DAO (`aqGateApi.seed.*`) | `exists()` csak | `store(record)` igen |
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
