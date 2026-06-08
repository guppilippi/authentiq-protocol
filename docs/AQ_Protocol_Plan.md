# AQ Protocol – Plan

## Dokumentum státusza
Ez a dokumentum **nem normatív**.  
Az AQ protokoll minden olyan elemét tartalmazza, amely **még nem implementált**, vagy **nem végleges döntés**.

A jelenleg implementált mag: `boot.js` és `aqProtocolLoader.js`. Minden más ebben a dokumentumban tervként szerepel.

---

## 1. Négyrétegű feloldási és publikálási modell

### 1.1. Rétegek

```
Localhost (file) → WEB2 (Node.js szerver) → IndexedDB (böngésző) → WEB3 (chain + decentralizált tároló)
```

- **Localhost**: közvetlen fájlszerkesztés, path alapú hivatkozás, genesis fázis eszköze (aqProtocol és első identitás DAO-k kézi barkácsolása).
- **WEB2**: fejlesztői/tesztelői Node.js szerver. Content-addressed interfész, random CID-ek. A tesztelők a szerverben bíznak, nem a hash-ben. HTTPS olvasás publikus, írás SSH tunnel mögött.
- **IndexedDB**: böngészős DAO fejlesztési és használati környezet. A genesis után az elsődleges fejlesztési hely.
- **WEB3**: publikus, immutable, tokenId-vel horgonyzott. Valódi content-addressed. Decentralizált tároló nem rögzített (első referencia: Swarm).

### 1.2. Publikálási és fork irányok

- **Publikálás**: localhost → WEB2, IndexedDB → WEB2, IndexedDB → WEB3, WEB2 → WEB3
- **Fork**: IndexedDB ← WEB2, IndexedDB ← WEB3
- Teljes DAO publikáció/fork, nem részleges egységek
- A publikálás új CID-eket generál, vissza kell vezetni a forrás rétegbe

### 1.3. WEB2 ↔ WEB3 CID különbözőség

A WEB2 (random CID) és WEB3 (valódi hash) külön CID világok. Átjárás csak publikáláskor történik, futás közben nem.

### 1.4. Egységes publikálási flow

1. Minden asset-et feltölteni — CID-et kap
2. CID-eket bejegyezni a DAO config-ba
3. Kész config-ot feltölteni — CID-et kap
4. Config CID-ét tokenId-hez rögzíteni

A 4. lépés a két cél között eltér: WEB2-n HTTP POST (JSON-RPC `aqSetSwarmHash` kiterjesztés), WEB3-on on-chain `updatePage` tranzakció.

### 1.5. Service Worker + Cache API

Offline asset-feloldáshoz (elsősorban IndexedDB rétegen, de a WEB2 réteg cache-eléséhez is hasznos lehet).

### 1.6. P2P vízió

Hosszú távon: PWA eszközök maguk szolgáltatják a decentralizált tárolót és chain-t. WebRTC, libp2p, light client. Saját bloklánc + saját elosztott fájlrendszer.

---

## 2. DAO config struktúra

### 2.1. Top-level mezők

- **`contracts`** (opcionális): `{ <name>: { address, rpc?, description } }` map. A remote ref feloldáshoz használt source-of-truth. `address` kötelező (`0x` + 40 hex, `CONTRACT_RE` szerint), `description` kötelező, `rpc` opcionális.
- **`tokens`** (opcionális): `{ <name>: { contractName, tokenId, description } }` map. `contractName` eager check a `contracts` map-en, `tokenId` digits-string, `description` kötelező.
- **`rpc`** (opcionális, string): fallback RPC URL a remote ref feloldáshoz, ha `contracts.<name>.rpc` hiányzik. Ha ez is hiányzik, a default Gnosis lista érvényes. NEM örökli a host conf `rpc`-jét.
- **`cidBase`** (string): az asset feloldáshoz használt URL-prefix. A DAO config felülírhatja a host conf `cidBase`-ét.
- **`cacheable`** (boolean, default `true`): ha `false`, a futó DAO scope-ján belül semmi nem cache-elhető — sem a modul-state cache (RPC feloldás, `aq.fetch*` eredmények), sem a browser HTTP cache (a `fetchCid` `force-cache` helyett `no-store` lesz). A scope a hívó DAO: a hivatkozott DAO-k tartalmára is a hívó `cacheable` flag-je érvényes (mert a hivatkozott DAO `cacheable` értéke a config letöltése előtt nem ismert).
- **`refs`**: lásd 2.2.
- **`exports`**: lásd 2.3.
- **`pages`**: lásd 2.4.
- **`defaultPage`**: a `pages` egyik kulcsa, alapértelmezett indulási page.

Az `imports` mint külön top-level szekció **megszűnt**. A külső DAO hivatkozás a `refs` levél objektum-formájába olvadt (lásd 2.2). A `_parent` mező szintén **megszűnt** a configból (lásd 2.5).

### 2.2. refs (2-szintű séma, lokális és távoli)

Kategorizált, névvel elérhető erőforrások.
- Kategóriák: `js`, `css`, `json`, `html`, `img`, `others`
- Struktúra: `refs[category][subcategory][name] = leaf`. A subcategory + name szabadon választható.

Egy `refs` levél **mindig objektum** (string forma megszűnt):

**Lokális ref** — `{cid, description}` (saját, ezen a DAO-n tárolt tartalom) vagy `{path, description}` (csak devMode). A `description` mező **kötelező** lokális leveleken; plain szöveg, Unicode engedett, `\n` engedett, `\r` és `\t` tilos, ASCII kontroll karakterek tilva.

**Távoli ref** — `{tokenName}` objektum, amely egy másik funkció DAO-ra mutat:
- **`tokenName`** kötelező. Eager lookup a hívó DAO `tokens` map-jén: `tokens[tokenName]` → `{contractName, tokenId}`. Majd `contracts[contractName]` → `{address, rpc?}`.
- `description` mező **tilos** itt (a cél hordozza).

Forma:
```json
"refs": {
  "js": {
    "page": {
      "main": { "cid": "<cid>", "description": "fő app" }
    },
    "lib": {
      "shared": { "tokenName": "myLibToken" }
    }
  },
  "html":   { "<sub>": { "<name>": { "cid": "<cid>", "description": "..." } } },
  "css":    { "<sub>": { "<name>": { ... } } },
  "json":   { "<sub>": { "<name>": { ... } } },
  "others": { "<sub>": { "<name>": { ... } } }
}
```

**Egységes (category, sub, name) névtér.** Egy bejegyzés egyszer szerepel a `refs` map-ben, lokális vagy távoli. A page egységesen `aq.ref(category, "sub.name")` → `aq.fetchText/fetchBytes(ref)` úton old fel — a `"sub.name"` 2-szintű hivatkozás formátum (`validateRefPath`: egzakt 2 szegmens, pont-szeparátorral).

**Ref név szabály**: a `refs[cat]`, `refs[cat][sub]`, `refs[cat][sub][name]` kulcsai engedett karakterszett `[a-zA-Z0-9._-]+`. A `_` prefix kivétel nélkül engedett (a régi `_parent` kivétel megszűnt). `.` és `..` tiltva.

**Távoli ref feloldása — tokenName-alapú, egyszintű, kétlépéses fetch:**

1. Token lookup: `srcTokens[remoteRef.tokenName]` → token entry (`{contractName, tokenId}`)
2. Contract lookup: `srcContracts[token.contractName]` → contract entry (`{address, rpc?}`)
3. RPC URL: `parseRpcConfig(contract.rpc || srcRpc, devMode)` (srcRpc: DAO config top-level `rpc`)
4. `resolveDaoCid(token.tokenId, rpcUrls)` — eth_call-on át a cél-DAO config CID-je
5. Cél-config fetch a **hívó `cidBase`-én** (a cél `cidBase` ekkor még nem ismert)
6. Minimum validáció: `targetCfg.refs[category][sub][name]` létezik
7. Egyszintű kényszer: production=`{cid}`, devMode=`{path}` is ok — ha megint távoli, hibát ad
8. Cél `cidBase` kiolvasás

Visszatérés: `{cid, cidBase?}` vagy `{path}` (devMode).

A távoli ref lazy resolve: első híváskor (cache-elhető, ha `cacheable: true`), hiba esetén a hívó page kezeli.

**devMode + path-only korlát**: távoli ref feloldás érvényes `cidBase`-t igényel a hívó oldalon. Path-only fejlesztés (üres `cidBase`) nem kompatibilis a távoli refekkel.

### 2.3. exports (megosztási felület)

A `exports` egy **lapos lista**, amely megjelöli, mely `refs`-bejegyzések kerülnek át forkkor a gyerek `refs`-ébe távoli refként, és így mely bejegyzések szánnak megosztásra más DAO-k felé.

```json
"exports": [
  { "category": "js",  "name": "lib.shared" },
  { "category": "css", "name": "theme.dark" }
]
```

- Minden elem `{category, name}` pár. A `name` mező `validateRefPath`-szerű 2-szintű hivatkozás (`"sub.name"` formátum).
- A hivatkozott `refs[category][sub][name]` bejegyzés létezésének eager cross-reference ellenőrzése a validáció során.
- A bejegyzés lehet **lokális vagy távoli** egyaránt — az export szempontjából nincs különbség.
- A protokoll DAO is ezt használja.
- **Runtime-ban nem enforce-olódik**: a loader bármely távoli refet feloldhat, akkor is, ha a cél-DAO az adott bejegyzést nem listázza az `exports`-ban. Az `exports` célja fork-öröklés deklaráció és megosztási szándék jelölés, nem access control.
- Opcionális. Hiánya = üres lista = semmi exportált → forkkor a gyerek `refs` üres.

### 2.4. pages (page-definíció refs-szel)

A `pages` map kulcsa a page kulcsa (URL hash-szel hivatkozható). Értéke a page-asset-ek refs-hivatkozása **2-szintű formátumban**:

```json
"pages": {
  "home":  { "html": "page.main",  "css": "theme.dark", "js": "lib.app" },
  "about": { "html": "page.about", "css": "theme.dark" }
}
```

Minden mező `validateRefPath`-szerű 2-szintű hivatkozás (`"sub.name"` formátum). A loader a megfelelő kategórián belül oldja fel: pl. `pages.home.html = "page.main"` → `refs.html.page.main`. A hivatkozott ref lehet lokális vagy távoli. Legalább egy mező szükséges, különben a page invalid.

A loader továbbra is fetcheli a page assetjeit (html/css/js) és inline beágyazza az iframe HTML doc-ba. A page nem `aq.ref/fetch*`-szel kéri a saját rendering-jét.

### 2.5. Fork eredet (`_parent`) — nincs a configban

A `_parent` mező a configból **megszűnt**. A fork eredetet kizárólag a publikáláskor számolt **merkle-root** inputja rögzíti (lásd 3.1). A config-séma nem hordoz provenance-mezőt, és a loader nem old fel `_parent`-et.

Következmény: a `refs[cat]`, `refs[cat][sub]`, `refs[cat][sub][name]` kulcsain a `_` prefix kivétel nélkül engedett (nincs `_parent` speciális kivétel).

### 2.6. Információ-gyűjtemények

A `refs` (lokális és távoli levelekkel) együttesen az "információ-gyűjtemény". Privátra csak DAO-n belül névvel, publikusra a `tokens`/`contracts` szótáron keresztül (azaz egy másik DAO távoli refjeként) lehet hivatkozni. A `exports` deklarálja, mi szánt publikusnak.

---

## 3. Fork modell

- Fork = teljes config másolat.
- A gyerek `refs`-ébe a szülő `exports` listájában szereplő `(category, "sub.name")` bejegyzések kerülnek be — mindegyik **távoli ref**-ként, a 2-szintű séma szerinti `(category, sub, name)` helyre.
- A fork során keletkező távoli ref `{tokenName}` formája mindig a **tényleges tartalmi forrásra** mutat:
  - ha a bejegyzés a szülőben **lokális** volt → a token a szülő azonosítójára mutat,
  - ha a bejegyzés a szülőben **már távoli** volt (egy C DAO-ra mutatott) → a token közvetlenül C-re mutat (C token-azonosítójával).
- Így a fork-kal keletkező távoli ref soha nem mutat olyan DAO-ra, ahol a bejegyzés megint távoli — a 2.2 szerinti egyszintű feloldás sértetlen marad.
- A gyerek `exports` listája forkkor **üres** (a forkoló nulláról dönti el, mit oszt meg tovább).
- Nincs megosztott lokális CID DAO-k között (minden DAO a saját lokális CID-jeiért felel).
- Re-export nyomon követés nincs: a gyerek számára a fork-kal kapott távoli ref a közvetlen sajátja, az eredet legfeljebb a merkle-rootban.
- Forkolásnál az új tulajdonos az lesz, aki forkolja.

### 3.1. Merkle root

A fork lánc (származtatási gráf) hitelesítésére. A fork eredetet ez rögzíti — a config nem tartalmaz `_parent` mezőt, a provenance kizárólag a merkle-root inputja.

A verzió lánc (ugyanazon tokenId különböző CID-jeinek története) ezzel szemben az on-chain `PageUpdated` event logokban él, és nem kell a merkle root-ba bekerülnie.

---

## 4. Identitás DAO és életút

### 4.1. Létrehozás

Seed-gen implementált (biometrikus és jelszavas ág):

- **BIP-39, 12 szó** (128 bit entrópia). A seed phrase soha nem jelenik meg a felhasználónak.
- **Biometrikus ág** (WebAuthn PRF extension, platform authenticator): WebAuthn regisztráció → PRF kimenet → kulcslevezetés → AES-GCM titkosítás.
- **Jelszó ág**: PBKDF2, 600 000 iteráció → AES-GCM titkosítás.
- Titkosított seed az `aqSeed` IndexedDB-ben tárolva (külön DB, nem az `aqStorage`-dzsal közös).

A titkosítás szintje határozza meg a maximális szabadsági fokot:
- csak jelszóval (mérsékelt)
- csak biometriával (közepes vagy magasabb)

Platform fókusz: Android Chrome 122+, Windows Edge/Chrome 122+, iOS Safari 17.4+.

### 4.2. Eszközök közötti munka

**Workflow szinkronizáció**: folyamat állapota (akár minden billentyűleütés) másik eszközről folytatható. A seed nem mozog, csak P2P kapcsolat.

**DAO eszközhöz adása**: új eszköz hozzáadása. Két verzió:
- Seed mozgatás: P2P csatornán átkerül (felhasználó nem látja). Magasabb szabadsági fok.
- Csak kapcsolódás: a seed nem mozog, kritikus lépésekhez a másik eszközön kell aláírni. Még magasabb szabadsági fok.

### 4.3. Cross-device aláírás

Kritikus lépések megkövetelhetik egy másik kapcsolt eszköz **online** aláírását a befejezéshez. Ha a másik eszköz nem elérhető, a folyamat nem véglegesíthető.

### 4.4. Összekapcsolt (közösségi) identitás DAO

Több magas szabadsági fokú egyéni identitás DAO új közöset hozhat létre. A seed Shamir-szilánkokban elosztva a tagok között.

A legmagasabb szabadsági fok eléréséhez:
- multi-biometriás azonosítás (mindegyik résztvevőtől)
- rövid hatótávolságú csatorna (pl. Bluetooth) a fizikai közelség garantálására
- NFC chip aktiválás mint létrehozási pecsét
- szűk időablakon belüli lezárás

Ezek specializált funkció DAO-k szolgáltatásai, nem protokoll alapfeladatok.

---

## 5. Szabadsági fok

### 5.1. Skála

- **Logaritmikus, 5 felhasználói szint**: alacsony / mérsékelt / közepes / magas / kritikus
- **Nyitott felső véggel**: új technológiák tovább nyújthatják a maximumot
- **Minden szint kb. 10x különbség**
- **Relatív kategorizálás**: új tech megjelenésekor a régi DAO-k belső értéke változatlan, de a kategórianevük eltolódhat lefelé

### 5.2. Kanonikus tényezők (javaslat, pontosítandó)

- Létrehozási mód (jelszó / biometria / multi-bio / multi-bio + helyhez kötött)
- Replikáció (1 eszköz / több eszköz / Shamir szilánkok)
- Hardveres biztonság (sima IndexedDB / Secure Element / TPM)
- Konszenzus (egyéni / N-of-M)
- Backup mód

A tényezők listája protokoll-szinten rögzített. A kiszámítási képlet szintén protokoll-szintű.

### 5.3. Külső tényezők és bizonyítékok

Specializált funkció DAO-k nem új tényezőket vezetnek be, hanem bizonyítékokat szolgáltatnak meglévő tényezőkre:

1. A specializált DAO lefuttatja a bonyolult flow-t (pl. multi-bio + NFC + helyhez kötött).
2. Aláír egy bizonyítékot a tényezőkről.
3. Az új identitás DAO config-jába bekerül a bizonyíték.
4. A protokoll ellenőrzi és beszámítja.

A bizonyíték értéke **az aláíró DAO hitelességével súlyozódik**.

### 5.4. Monotonitás és állapot

- **Monoton csökkenő**: ha egyszer alacsony szintre került, ugyanazzal a seed-del nem emelhető vissza
- **Új magasabb szabadsági fok = új identitás DAO + kapcsolt régi**
- **Állapot dimenzió**: `mért` vagy `bizonytalan`
- **Frissesség hiánya nem rontja** a szabadsági fokot
- **Viselkedési anomáliák** extra megerősítést igényelhetnek, de ez kompromittálhatóság-detektálás, nem hitelesség-kérdés

### 5.5. Seed kikerülés

Ha a seed elhagyja az IndexedDB-t protokoll-ismeretlen módon:
- kikerülés előtti publikációk: `mért` marad, a múlt hitelessége nem sérül
- kikerülés utáni új publikációk: `bizonytalan` állapotban keletkeznek
- DAO működhet, de új események szabadsági foka nem garantált
- Visszaállás `mért`-re csak új identitás DAO-val (új seed, kapcsolt régi)

**Recovery flow** (új eszközre konszenzusos visszaállítás) **nem számít kikerülésnek**, ha protokoll-ismert.

---

## 6. Hasznosság és hitelesség

### 6.1. Hasznosság

- Funkció DAO-k tulajdonsága
- Mérhető események: fork count, távoli ref resolve count, bogyó execution count
- Átmeneti jelentőségű (a vízió szerint a fogyasztói társadalomból való átmenet után a szerepe csökken)
- Indikátor a hitelességhez

### 6.2. Hitelesség

- Funkció DAO-k tulajdonsága
- Hosszú távú alapérték
- **Immutable**: ami egyszer hitelesnek bizonyult, az marad

**Források**:
- Passzív használat (hallgatólagos validáció)
- Explicit ellentmondás (csak az aktív hibajelzés ront)
- Tranzitív bizalom (távoli ref láncon át, csökkenő decay)

**Bizalmi körök önkorlátozók**: a szabadsági fok a hitelesség képletben szerepel → alacsony szabadsági fokú identitások által tulajdonolt DAO-k egymás közti hitelessége nem nő érdemben.

### 6.3. Reputáció eloszlása

A funkció DAO tulajdonosához érkező reputáció/értesítés belső elosztását minden DAO szabadon határozza meg, belső kontextusgráf szerint.

### 6.4. Funkció DAO megbízhatósága

A funkció DAO-nak két mérőszáma van:

- **Hitelesség**: csak nőhet (immutable múlt). Forrás: használat, visszaigazolás.
- **Megbízhatóság**: mindkét irányba mozoghat. Forrás: protokoll érettség × tulajdonos szabadsági fok.

A funkció DAO hitelessége és megbízhatósága nem romolhat. Kompromittált identitás DAO használhatja, de az eszköz maga nem romlik el.

### 6.5. Protokoll érettség mint korszak-szorzó

Két egymást váltó tényező (stafétabot):

**Zárt köri megbízhatóság** (csökkenő, genesis-től open source-ig):

| Mérföldkő | Szorzó (javaslat, pontosítandó) |
|---|---|
| Csak lokális gép, egyetlen fejlesztő | 1.0 |
| Saját WEB2 szerver, szűk csapat | 0.8 |
| Több ismert WEB2 szerver | 0.6 |
| Első WEB3 publikálás | 0.4 |
| Forráskód nyilvánosan elérhető | 0.2 |
| Teljes protokoll open source + auditált | 0.0 |

**Nyílt ismertségi hitelesség** (növekvő, open source-tól):

| Mérföldkő | Szorzó |
|---|---|
| Frissen open source | 0.0 |
| Első külső közreműködők | + |
| Első független audit | ++ |
| Aktív közösség, fork-ok | +++ |
| Széles körű használat | ++++ |

Audit megelőzi az open source váltást.

Korszak-rögzítés:
- Minden DAO rögzíti, melyik korszakban keletkezett — az akkori szorzókat örökre magával viszi
- Nem módosul visszamenőleg
- Minden jelentős eseménynél (létrehozás, publikálás, fork, audit) rögzül az akkori korszak szorzója
- A DAO életútja egy szorzó-sorozat

### 6.6. Jelzések: hibajelzés és hasznosság jelzés

Lásd Concepts §18 — a mentális modell és a fizetési logika ott él.

### 6.7. Kanonikus hitelesség képlet

A hitelesség számítása **protokoll-szintű kanonikus képletet** követ, így minden kliens ugyanarra a chain-adatra ugyanazt az eredményt adja (determinisztikus).

**Bemenetek:**
- Használati statisztikák (identitás DAO-k publikus usage adataiból aggregálva)
- Hasznosság jelzések (pozitív hozzáadás)
- Hibajelzések (csökkentés, visszavonva visszaáll)
- Korszak-szorzók (létrehozási és publikálási időponthoz kötve)
- A tulajdonos identitás DAO szabadsági foka

**A képlet konkrét formája még nyitott** (lineáris, logaritmikus súlyozás, stb.), de az elv:
- Immutable múlt (az események rögzülnek)
- A jelenlegi szám csökkenhet hibajelzésre, visszavonáskor vagy javításkor visszanőhet
- Determinisztikus: ugyanaz az input → ugyanaz az output

### 6.8. Megjelenítés

Az összesített hitelesség egyetlen szám. A részletes szorzók és összesítésük elérhető aki akarja. A megjelenítési forma DAO-specifikus (funkció DAO szolgáltathatja).

A protokoll a **számot** adja (kanonikus képlettel), a **bemutatást** nem.

---

## 7. Felelősségi körök: protokoll vs trusted DAO vs funkció DAO

### 7.1. Protokoll magfeladatok

- Identitás létrehozás és kezelés
- Hash-feloldás (CID → byte)
- DAO config értelmezés
- Sandbox + iframe izoláció
- Tárolás (IndexedDB capability)
- Réteg-kapcsolat (IndexedDB → WEB2/WEB3)
- Származtatási lánc rögzítése
- Szabadsági fok adatszerkezete és skála
- Bizonytalan állapot kezelése seed kikerüléskor
- Recovery interfész (minimális N-of-M konszenzus seed-ek protokoll-bent tartásával)

### 7.2. Trusted funkció DAO-k (aqProtocol config refs/exports)

- Az aqProtocol DAO saját config-jának `exports`-szal megosztott refs-ei, illetve a config refs-eiben szereplő távoli refek a trusted forrás
- Itt szereplő DAO-k trusted-nek számítanak a protokoll szemében
- A trusted státusz forrása: explicit közösségi döntés (nem automatikus számítás)
- Forkolásnál öröklődik: az új aqProtocol fork a szülő exportált bejegyzéseit távoli refként viszi magával

Példák trusted DAO-kra:
- Bonyolultabb recovery flow
- Specializált identitás-létrehozó (multi-bio + NFC + helyhez kötött)
- Konszenzus szolgáltató (N-of-M aláírás)
- Publikáló DAO (lásd 8. fejezet)

### 7.3. Sima funkció DAO-k (bárki létrehozhatja)

- Általános konszenzus mechanizmusok (multisig, voting, stb.)
- Reputáció / hitelesség számítás algoritmus
- Hasznosság mérés algoritmus
- Cross-device workflow szinkronizáció
- Műveletek korlátozása szabadsági fok alapján (a lekérdezés mechanizmus protokoll, a policy DAO)
- Értesítési csatornák
- DAO-k közötti hitelesítés (egy DAO saját bizonyítéka más DAO-król) — a protokoll nem épít rá

### 7.4. Vékony protokoll elv

A protokoll adatszerkezetet és lekérdezési felületet ad. A logika származtatott DAO-kban él.

---

## 8. Publikáló DAO és decentralizált tároló kulcskezelés

### 8.1. Kulcskezelés probléma

A decentralizált tárolóba való írás kulcsot igényel (pl. Swarm batchid, ami fizikai erőforrás). Ez a kulcs nem kerülhet a kliensekhez nyilvánosan.

### 8.2. Publikáló DAO

Egy dedikált funkció DAO (aqPublisher):
- Saját infrastruktúrával (bee node, stamp készlet)
- A kulcs a DAO belső állapotában él, sosem hagyja el az infrastruktúrát
- Publikálási kérelmeket proxy bogyón keresztül fogad

### 8.3. Ephemeral fork modell

1. Kliens publikálási kérelmet küld a publikáló DAO-nak
2. A publikáló DAO automatikus fork-kal ephemeral (rövid életű) származtatott DAO-t hoz létre
3. Az ephemeral DAO **időkorlátos aláírt jogosultságot** kap (nem magát a kulcsot)
4. A proxy bogyón keresztül publikál
5. A jogosultság lejár, az ephemeral DAO archiválódik mint származtatási lánc bejegyzés

**Előnyök**:
- Kulcs sosem hagyja el a fő infrastruktúrát
- Ha egy ephemeral jogosultság kikerül, csak egy publikálásra jó
- Minden publikálás visszakereshető a fork láncban
- Több párhuzamos publikálás, párhuzamos ephemeral fork-okkal

### 8.4. Pin-elés / élettartam

A publikált tartalom fennmaradásáért felelősség a fő publikáló DAO-nál vagy a megrendelő identitás DAO-nál, a szolgáltatási feltételek függvényében.

### 8.5. Publikáló DAO-k evolúciós útja

- **Genesis**: tesztszerver közvetít, batchid privát adatként ott él
- **Aztán**: az aqProtocol publikálása után a korai megoldásból létrejön az első publikáló funkció DAO, amit bárki forkolhat
- **Később**: több üzleti/közösségi publikáló DAO párhuzamosan, saját infrastruktúrával, saját hitelességgel
- **Még később**: felhasználók közvetlenül előfizethetnek külső szolgáltatókhoz; a protokoll nem különbözteti meg, minden publikáló egy bogyó flow-t nyújt

---

## 9. Wallet és identitás hosszú távon

- Eszköz-szintű wallet generálás, anonim azonosítás
- Anonim böngészés: nincs szerződés, szabad elérés
- DAO csatlakozás: okosszerződés mentén, jogosultságok
- Protokoll szintű user profil:
  - IndexedDB-ben amíg nincs szerződés
  - Szerződéshez kötött adatok titkosítva on-chain (user kulcsával)
  - Szelektív disclosure: szerződésenként szabályozott
- DAO-specifikus szerződések (opcionális, nem központi)
- Multi-chain támogatás
- Kvantum-rezisztens AES-256 titkosítás a tartalomra (a wallet identitás és blockchain használat jelenleg nem kvantumbiztos a kiforrott technológiákkal)

---

## 10. Értékelés és reputáció

- DAO hasznosság mérés: fork-szám, CID feloldás gyakoriság, módosítás arány
- Wallet hasznosság mérés
- Fork gráf elemzés (merkle root alapú)
- Felhasználói értékelés + használati adatok kombinálása → hitelesség
- Értesítési csatornák (hiba, beavatkozás szükséglet)

---

## 11. Tulajdonjog és módosíthatóság

### 11.1. Contract szintű tulajdon

- Minden funkció DAO referenciáját egy tokenId rögzíti (PageNFT-ben vagy származtatott contract-ban)
- A tokenId tulajdonosa ERC-721 `ownerOf()` cím
- Lehet egyéni wallet vagy multisig contract
- **A multisig logika a wallet rétegben él**, nem a PageNFT contractban

### 11.2. Konszenzus alapú frissítés

- A tokenId mögötti CID **frissíthető** (`updatePage`), az owner által
- Közösségi tulajdon esetén multisig konszenzus szükséges
- Az on-chain event log teljes verzió-történetet ad
- A hibajavítás lehetősége nélkülözhetetlen — különben minden kis javításhoz új fork kellene, ami elszigetelné az al-DAO-kat

---

## 12. Genesis és létrehozási lánc

Az aqProtocol DAO-nak nincs szülője. Az identitás DAO-knak sincs. Mindkettő speciális.

Létrehozás:
1. Az aqProtocol forráskód kézzel készül (localhost rétegen, file-alapon). Tulajdonos még nincs.
2. Működőképes állapotnál: egy magas szabadsági fokú közösségi identitás DAO jön létre, az aqProtocol már működő képességeit használva.
3. Ez a közösségi DAO mintázza meg a PageNFT-en az aqProtocol funkció DAO-t és felveszi a tulajdonosaként.
4. Innentől az aqProtocol módosítható a tulajdonos közösség konszenzusával.

Az első identitás DAO-k szintén kézzel barkácsolódnak a localhost rétegen.

---

## 13. Hosszú távú vízió

Nem-fenntartható fogyasztói társadalomból egy működőképesebb alternatívába való békés átmenet:
- nagyobb autonómia
- kevesebb félelem
- alapjövedelem-szerű biztonság
- valódi hitelességen alapuló információ-gazdaság

A hasznosság csak az átmeneti szakaszra fontos, a hitelesség hosszú távon is központi marad.

---

## 14. Technológiai döntések

### 14.1. Szerver oldali nyelv

- Node.js (nem Python)
- ESM (`import/export`)
- **Külső függőség elve**: alapértelmezetten nulla külső dependency (natív `node:` modulok). Külső függés csak akkor megengedett, ha lényegi gyorsítást ad (pl. swarm SDK, kripto-könyvtár). Saját kódból álló modulok nem számítanak külső függésnek.
- Node 22+ (LTS)

### 14.2. Kliens oldal

- boot.js és loader IIFE marad (nem ESM, nem modul)
- Megosztott kód ESM modulként, esbuild bundle IIFE-be a loader számára

**Invariáns**: a forrásmodulok (ESM) **kizárólag fejlesztési artefaktumok**.
Böngészőben kizárólag a bundle-elt IIFE artefaktumok (`boot.js`, `aqProtocolLoader.js`) futnak.
A két bundle build-időben tartalmazza a saját másolatát a megosztott modulokból;
runtime-ban nincs köztük state-megosztás, csak forráskód-szintű DRY.
Modul-szintű állapot (pl. `let`-tel deklarált változó) ennek megfelelően értelmezendő: bundle-onként önálló példány.

### 14.3. Host conf rpc mező

A `window.aqProtocolPageConf.rpc` opcionális string mező:
- üres vagy hiányzó → default Gnosis hármas-lista (`rpc.gnosischain.com`, `gnosis-rpc.publicnode.com`, `rpc.gnosis.gateway.fm`)
- egyetlen URL → WEB2 felülbírálás (csak ez használt)
- szigorú validáció a host conf consumption-kor (URL parse + non-devMode `https:` kötelező)

Mind az `aqBoot.js`, mind az `aqProtocolLoader.js` ezt olvassa induláskor; a validáció közös modulban (`aqRpcConfig.js`).

### 14.4. Loader capability-k

A loader feloldó capability-jei (mind implementált):

- `aq.ref(category, "sub.name") → ref` (async) — a saját DAO refs-éből veszi a bejegyzést. Lokális esetben a config-ban szereplő levél objektum változatlan (`{cid, description}` vagy `{path, description}`); távoli esetben a host elvégzi az eth_call + cél-config feloldást, és **`{cid, cidBase?}` köztes objektumot** ad vissza. Szerződés-adatok nem kerülnek a page felé. A második paraméter `validateRefPath`-szerű 2-szintű hivatkozás.
- `aq.fetchText(ref) → string` — UTF-8 dekódolt tartalom. Input lehet lokális objektum, resolved köztes objektum, vagy nyers string (CID/path; tokenId tilos).
- `aq.fetchBytes(ref) → ArrayBuffer` — nyers bájtok, ugyanaz az input-kör mint a `fetchText`-nél.

A korábban tervezett külön `aq.import()` capability **megszűnt**. Az egyetlen feloldó belépési pont az `aq.ref()`; a távoli feloldás a ref objektum-formájából következik, nem külön capability-ből. A page nem tudja és nem érdekli, lokális vagy távoli a bejegyzés.

A page maga nem fetchel direktben; minden hálózati hozzáférés a loaderen keresztül megy. A `ref` és a `fetchText`/`fetchBytes` külön lépés: a ref közös köztes formátum, így a `fetchText`/`fetchBytes` forrás-agnosztikus. A behúzott tartalom futtatása a page sandbox-dolga.

### 14.5. Protokoll config és boot flow

A boot a tokens/0 lookup-on át az aqProtocol contractról kéri le a **protokoll config CID-jét** (nem közvetlenül a loader bundle-ét). A protokoll config egy JSON, ami a kézi szerkesztés tartja stabilan; az aqProtocol tulajdonos közössége módosítja, a runtime **nem validálja**.

Protokoll config struktúra:
- **`loader`** (top-level, kötelező): a loader bundle hivatkozása. Forma: `{cid}` (production) vagy `{path}` (devMode). Description nem kötelező itt.
- **`gates`** (top-level, kötelező): map `{<gateName>: <gateEntry>}`. Egy elem `{tokenId, description}` (production, `contract` implicit az aqProtocol contract, `rpc` örökölt host conf-ból) vagy `{path, description}` (devMode). Description **kötelező**.

A protokoll config nem hordoz `pages` vagy `defaultPage` mezőt — a protokoll DAO maga nem rendel UI-t. A felhasználói interfészt a kapu DAO szolgáltatja.

Boot folyamata:
1. `resolveDaoCid(0, rpcUrls)` → protokoll config CID
2. Protokoll config fetch + JSON parse (a boot **nem validálja**)
3. `loader.cid` vagy `loader.path` olvasás → loader bundle fetch + script inject
4. Loader a `window.aqProtocolConfig`-ról olvassa a protokoll configot, modul-szintű state-be teszi

Host conf séma változás: az `aqDaoConfig` és `aqPageLoader` mezők **megszűntek**. Új opcionális mező: `aqGateDAOName` (a kapu DAO választás override-ja).

### 14.6. Kapu DAO (implementált alapok)

A kapu DAO a felhasználó kitüntetett interfésze, a protokoll config `gates` szekciójából választott. A kapu DAO **host-szinten renderelődik** (`<div id="aq-gate-root">`), nem iframe-ben. Belépési pont: `window.aqGateInit()` (a loader hívja a kapu DAO JS betöltése után). Saját config, refs, pages struktúrával rendelkezik.

Különbségek más DAO-któl:
- **Speciális storage namespace**: `"gate:" + tokenId` (production) vagy `"gate:" + path` (devMode). Stabil a kapu DAO tartalom-frissítései alatt.
- **`window.aqGateApi` közvetlen API**: a loader exposeálja boot során; közvetlen function call-ok, nem postMessage.

**Kapu DAO választás precedencia**:
1. IndexedDB `_protocol/aqGateDAOName` meta
2. host conf `aqGateDAOName`
3. első `gates` kulcs (insertion order)

Hard fail, ha a kiválasztott név nem létezik a `gates`-ben.

**Implementált gate API** (`window.aqGateApi`):
- `protocolStorage.*` (put/get/delete/list/rename) — a `_protocol` namespace eléréséhez.
- `seed.*` (store, exists) — seed store műveletek.

A postMessage `aq.gate.*` capability-k **eltávolítva**. Tartalmi DAO sosem fér hozzá a `_protocol` namespace-hez.

**`_protocol` namespace**: fix protokoll-szintű storage namespace az `aqStorage` modulban. Közös `aqStorage` IndexedDB store-ban él, közös `aqStorage*Ns(namespace, ...)` belső függvényeken keresztül. Csak a loader belső kódja (közvetlen hívással) és a kapu DAO (`window.aqGateApi`-n keresztül) éri el — sima DAO nem fér hozzá.

### 14.7. Kapu DAO további funkciók (tervezett)

A kapu DAO chrome-szerepe a protokoll-szintű interakciókhoz. A felsorolt funkciók új capability-ket igényelnek, vagy meglévő mechanizmusok kombinálásával valósulnak meg. Inkrementálisan készülnek el.

- **QR scan DAO-ra ugrás** — kamera capability a page iframe-ben (`allow="camera"` engedélyezéssel). Új capability: `aq.gate.openDao(daoRef)`.
- **Hamburger menü minden DAO felett** — a kapu DAO chrome-szerepe. Két technikai megoldás vizsgálandó:
  - egy iframe egyszerre, a kapu DAO-ra váltás overlay nélkül
  - két iframe, a kapu mindig overlay-ként a content felett
- **Keresés** — DAO és tartalom keresés. Forrás bizonytalan (lokális IndexedDB / on-chain események / keresési-szolgáltató DAO).
- **Kapu DAO váltás** — `aq.gate.switchGate(name)` capability. A `_protocol/aqGateDAOName` átírása + reload (vagy `switchDao`).

### 14.8. Dev környezet

- Pi (systemd) + Windows (PowerShell)
- Localhost rétegen fájlszerkesztés (SFTP Pi-n, natív Windows-on)
- Nincs watcher, nincs automatikus config-generálás — a config-ot fejlesztő szerkeszti kézzel

### 14.9. Auth modellek

- SFTP közvetlen szerkesztés (SSH kulcspár) — fejlesztői hozzáférés a localhost rétegen
- HTTPS + wallet aláírás (ethers.js signMessage + ecrecover) — alkalmazás szintű
- WebAuthn biometrikus megerősítés (2FA)
- Kisebb blast radius: wallet kompromittálódás ≠ szerver hozzáférés

### 14.10. RPC biztonsági réteg (tervezett)

Három összetartozó mechanizmus, a hedged requests-szel együtt alkot teljes RPC biztonsági réteget:

**Chain ID ellenőrzés + cache**: minden RPC forráson chain ID egyeztetés az elvárt értékkel. Egyszer ellenőrzött forrás cache-elt eredményt használ ésszerű TTL-ig.

**Lastblock check**: frissességi szűrő. A jelentősen lemaradó (stale) node-ok kiszűrése a legutolsó blokk számának összehasonlításával — lemaradt forrás nem vesz részt a feloldásban.

**Quorum**: több RPC forrás eredményének egyeztetése. Alapkonfiguráció: 3 forrás, 2 egyezés. Magasabb biztonsághoz: 5 forrás, 3 egyezés. A források egymástól független providerektől érkeznek (külön szolgáltató, saját node, publikus RPC).

### 14.11. i18n (lokalizáció)

**Attribútum szintaxis**: `data-i18n` prefix formátum. Textcontent default (`data-i18n="key"`); más attribútumokhoz prefix: `data-i18n="[placeholder]key;[alt]key2;textkey"`.

**i18n ref a DAO configban** (`refs.i18n`):
- Tokenized: `"i18n": { "tokenId": "105" }` → token tartalom: `{ "en": { "cid": "..." }, "hu": { "cid": "..." } }` (fordítások DAO config érintése nélkül frissíthetők)
- Közvetlen: `"i18n": { "en": { "cid": "..." }, "hu": { "cid": "..." } }` (DAO config-ba égett CID-ek)
- Nincs `i18n` kulcs → statikus HTML, nincs nyelvválasztó

**Feloldás (loader default)**: `navigator.language` → `en` → első a listából. DAO felülírhatja saját logikával (pl. saját storage-ból visszaolvasott preferencia).

**Váltás reload nélkül**: új CID fetch → DOM re-sweep + `aq:langchange` event.

**Nyelvválasztó**: a gate mutatja — loader átadja a nyitott DAO elérhető nyelveit. Nincs nyitott DAO → gate saját nyelvein. Nincs `refs.i18n` → nincs nyelvválasztó.

---

## 15. Perzisztencia és GC

### 15.1. storage capability
- már implementált és dokumentált (lásd Guide)

### 15.2. DAO és Gate state tárolás

Minden DAO saját maga kezeli persistens állapotát az `aq.storage.*` capability-ken keresztül (lásd Guide §11). A protokoll nem avatkozik be.

Tárolt adatok (DAO felelőssége): aktuális oldal / lépés, kitöltött form mezők, választott nyelv. A választott nyelv DAO-scoped storage-ban él → következő megnyitáskor visszatölt → a DAO az utoljára használt nyelvén nyílik meg.

**Gate state**: a `_protocol` namespace-ben tárolódik (`aqGateApi.protocolStorage.*`-on). Minimum tartalom: választott felület-nyelv + utoljára nyitott DAO tokenId → PWA újranyitáskor folytatás.

### 15.3. GC stratégia

- Paraméterezhetőre tervezve (maxAge, minAccessAge)
- Alap: configban nem hivatkozott hash + 30 nap → törlés
- DAO-szintű (nincs cross-DAO referencia követés)

### 15.4. Storage namespace — multi-contract bővítés

Jelenleg (single contract): sima DAO namespace = `"tokenId:" + tokenId`. A contract cím implicit (egyetlen `DAO_CONTRACT` van).

Ha több contract válik elfogadottá: a namespace `contractAddress + ":" + tokenId` alakra kell bővíteni, különben különböző contractokon lévő azonos tokenId-k ugyanabba a storage bucket-be kerülnek. Ez breaking change a meglévő storage kulcsokhoz — migrációt igényel.

**Elfogadhatósági határ:** a jelenlegi `"tokenId:"`-only namespace kizárólag a WEB2 tesztelési fázisban fogadható el. WEB3 indulás előtt — mielőtt valós (nem törlendő) storage adat keletkezne — a multi-contract namespace formátumra kell átállni, hogy ne legyen szükség migrációra.

---

## 16. Egyéb tervezési irányok

### 16.1. Cache stratégia
- hash-alapú immutable cache
- `cacheable: false` flag a DAO config-ban kapcsolja ki (modul-state + browser HTTP cache)
- DEV és PROD viselkedés
- (opció) részleges újratöltés / shared asset reuse

**Modul-state cache scope** (a `cacheable` flag implementáció hatóköre):
- RPC feloldás eredménye (tokenId → CID)
- **Távoli ref feloldási lánc teljes eredménye**: eth_call + cél-config + `(category, sub, name)` → `{cid, cidBase?}` lookup. A cache a hívó (category, sub, name) hármasra kulcsolt, a hívó DAO scope-jában.
- `aq.fetchText` / `aq.fetchBytes` eredménye
- Browser HTTP cache (`force-cache` ↔ `no-store` váltás)

Cache a hívó DAO `cacheable` flag-jétől függ; a hivatkozott DAO-k tartalmára is a hívó értéke érvényes (mert a cél `cacheable` a config letöltése előtt nem ismert).

### 16.2. Produkciós biztonsági modell
- trustedOrigins kanonikus forrásból
- aláírt host konfiguráció
- revocation és rotáció

### 16.3. Sandbox és capability evolúció
- finomabb jogkör-modellek
- worker-alapú futtatás
- capability API stabilizálása

### 16.4. Lifecycle és státusz
- explicit státuszcsatorna
- progress / cancel modell
- DAO-váltás lifecycle

### 16.5. Kód- és architektúra-evolúció
- capability modulok szétválasztása

### 16.6. Eszköz capability-k (tervezett)

A sandboxolt page iframe közvetlenül nem fér hozzá az eszköz API-khoz. A loader a postMessage buzon proxyzza ezeket a hívásokat — a felhasználói engedélyt a loader kéri, nem a page sandbox.

Tervezett capability-k:
- **Vágólap**: olvasás és írás (`aq.clipboard.read`, `aq.clipboard.write`)
- **Kamera**: képrögzítés, QR scan (`aq.camera.*`)
- **GPS**: koordináta lekérdezés (`aq.geo.getPosition`)
- **NFC**: olvasás és írás (`aq.nfc.*`)

Az iframe `sandbox` és `allow` attribútumai a szükséges capability-kre bővítendők capability-nként.

---

## 17. Közösségi minimum tagság

A közösségi DAO-k minimum tagszáma **függ a korszaktól és a tagok szabadsági fokától**.

**Alapelvek**:
- 2 tagos közösség nincs (recovery-képtelen)
- Minimum mindig legalább 3 tag
- Magasabb szabadsági fok mellett kevesebb tag elég
- Érettebb protokoll korszakban nagyobb minimumot lehet elvárni

**Javasolt tábla (pontos értékek pending)**:

| | genesis | saját WEB2 | több WEB2 | WEB3 | open source |
|---|---|---|---|---|---|
| alacsony | — | 3 | 3 | 5 | 5 |
| mérsékelt | — | 3 | 3 | 3 | 5 |
| közepes | — | — | 3 | 3 | 3 |
| magas | — | — | — | 3 | 3 |
| kritikus | — | — | — | — | 3 |

A — jel: abban a korszakban ilyen szabadsági fok még nem értelmezhető vagy közösségi tagság nélkül is elfogadott (genesis fázisban fájl backup helyettesíti).

**Protokoll szinten**: a kapu DAO és a szolgáltató közösségi DAO-k ellenőrzik a minimumot, új közösség létrehozásakor és tagbeléptetésekor.

---

## 18. Dedikált snapshot wallet

A periodikus identitás DAO state kiírásokhoz **külön wallet cím** használatos, a seed-ből BIP-44 derivation path-tal származtatva.

**Szerepek:**
- **Fő wallet**: publikus azonosítás, szerződésekhez csatlakozás, tagsági viszonyok
- **Snapshot wallet**: periodikus state kiírás

A kettő kapcsolata csak a seed tulajdonosa számára ismert — külső megfigyelő nem tudja összekötni egyszerű láncbejárással.

A snapshot cím kompromittálódása nem érinti a fő identitás jogosultságait.

---

## 19. WEB2 fejlesztői/tesztelői szerver — minimum

Ez a minimum készültségi fok a közös fejlesztés elindításához. A cél, hogy fejlesztők localhost-ról készíthessenek DAO-kat, és böngészőben egy közös WEB2 szerverre publikálhassanak teszteléshez.

### 19.1. Jelenlegi állapot — read-only (ideiglenes, kézi fájl-elhelyezés)

Három külön Node.js processz külön portokon (külön domain szimuláció CORS-on át):

- **`8080`** WEB statikus — `npx serve`, a projekt gyökerét szolgálja ki. A böngésző ezt nyitja: `http://localhost:8080/demo/html`.
- **`8081`** CID asset szolgáltató — `server/cidServer.js`, `GET /cid/<hash>` route.
- **`8082`** JSON-RPC mock — `server/rpcServer.js`, `POST /rpc` route (eth_call kompatibilis).

**Adat-root** (`<dataRoot>`): default `server/data/`, env `AQ_DATA_ROOT` felülírja.
- `<dataRoot>/blobs/<cid>` — CID-elnevezésű asset-fájlok (kézzel ide).
- `<dataRoot>/tokens/<tokenId>` — szövegfájl, tartalma a hozzá tartozó CID (64 hex, BOM nélkül). A `tokens/0` mostantól a **protokoll config CID-jét** tartalmazza (a boot innen indul).

**Mappa-létrehozás**: a szerver induláskor hard fail-t ad, ha a `<dataRoot>` vagy `blobs/` / `tokens/` nem létezik. Kézzel kell `mkdir`-rel létrehozni (a konfig elgépelés-érzékeny, jobb a hibajelzés mint az implicit létrehozás).

**RPC válasz invariánsok**:
- Hiányzó `tokens/<tokenId>` fájl → `result: "0x"` (revert szimuláció, kliens "contract reverted" hibát ad)
- `contract` cím ellenőrzött (várt: az aqProtocol DAO contract)
- Selector ellenőrzött (`0xcc2fb628` = `getSwarmHash(uint256)`)

**Közös helper modul**: `server/util.js` (data-root resolve, directory require, body-read, request log, startup log).

**Saját `server/package.json`** (`type: module`), nulla külső dep.

**CORS**: `Access-Control-Allow-Origin: *` mindkét szerveren (cross-port szimuláció a teljes WEB3-domain-szétválasztás imitálására).

**Wallet aláírás, írás nincs ebben a szakaszban.** Tudatos minimum — a publikálási flow tesztelése kézzel pótolható (fejlesztő a blobs/ és tokens/ mappákba ír közvetlenül).

### 19.2. Tervezett bővítés — write-os szerver (későbbi mérföldkő)

- `POST /aq/asset` — wallet-aláírt, whitelist-ellenőrzött asset upload. Response: `{ cid }`. A fájl a wallet saját mappájába kerül.
- `POST /aq/token` — új tokenId allokálás (wallet-aláírt). Response: `{ tokenId }`.
- `POST /aq/token/:id` — config CID rögzítés egy tokenId-re (wallet-aláírt, tulajdon-ellenőrzött).

### 19.3. Tervezett fájlrendszer (write-os fázis)

```
<dataRoot>/wallets/<wallet>/<cid>   ← tényleges fájl (wallet-szintű ownership)
<dataRoot>/blobs/<cid>              ← hard link a wallet fájlra (közös feloldó hely)
<dataRoot>/tokens/<tokenId>         ← config CID rögzítés (mint most)
<dataRoot>/whitelist.json           ← engedélyezett wallet címek
<dataRoot>/developers.json          ← wallet → fejlesztő név (admin)
<dataRoot>/trash/                   ← GC által ide mozgatott tartalmak
```

**Megjegyzés**: a megvalósult implementáció symlink-et használ (`fs/promises` `symlink`) — Linux-only deploy (Pi), Windows nem publish platform.

### 19.4. Tervezett wallet whitelist

- A whitelist.json tartalmazza az engedélyezett wallet címeket
- Új fejlesztő első indítása localhost-on: a kapu DAO kiírja a wallet címét a console-ba
- A fejlesztő elküldi a címet az üzemeltetőnek, aki manuálisan felveszi a whitelist-re
- Whitelist-ről levétel: a wallet mappája trash-be kerül, GC takarítja

### 19.5. Tervezett GC (crontab)

- Árva CID-ek (nem hivatkozottak egyik tokens/ fájl config-jából sem) → trash mappába
- Dead hard link a blobs/-ban (a target wallet mappa megszűnt) → törölve
- Trash 30 napnál régebbi tartalom → véglegesen törölve

### 19.6. Tervezett fork WEB2-ről localhost-ra

- A fejlesztő lehúzza a `POST /rpc` feloldással egy tokenId config CID-jét
- Majd `GET /cid/:cid` letölti a config JSON-t és a hivatkozott asset-eket
- A letöltötteket localhost fájlba menti, fejleszti, majd visszapublikálja

### 19.7. HTTPS mixed content megkerülése (production)

A WEB2 szerver HTTPS-en fut, a fejlesztői kapu DAO ugyanonnan töltődik. Nincs localhost→HTTPS mixed content probléma, mert a kapu DAO nem localhost-ról fut, csak a DAO forrásfájlok élnek localhost-on (a publikálás előtt).

---

## 20. Identitás DAO alatti megosztott storage

Az identitás DAO alá tartozó funkció DAO-k közös névtéren keresztül koordinálhatnak egymással.

### 20.1. Koordinációs csatorna

A megosztott storage nem általános cross-DAO olvasás/írás — az identitás DAO definiálja a névteret és a hozzáférési jogosultságokat. A funkció DAO-k ezen a csatornán jelzéseket és adatokat oszthatnak meg egymással.

**Trigger-alapú működés**: bizonyos folyamatok vagy jelzések csak akkor indulnak el, ha a megfelelő adatok megjelennek a megosztott névtérben. Ez laza csatolású, event-driven koordinációt tesz lehetővé a funkció DAO-k között.

### 20.2. Kapcsolat a protokollal

A megosztott storage-hozzáférés az identitás DAO szabadsági fokához és a funkció DAO-k `exports`/`refs` kapcsolatához kötött. A protokoll adatszerkezetet és hozzáférési felületet biztosít; a jogosultsági logika funkció DAO szintű.

---

## 21. Értékmátrix (tervezett, pontosítandó)

Identitás DAO-k és funkció DAO-k összekapcsolásához és ajánlásához szükséges mechanizmus. A DAO-k kulcsszavakkal (pl. kategóriák: `js`, `css`, vagy egyéb domain-specifikus címkék) jellemzik magukat; az értékmátrix ezek alapján vezet le illeszkedési és ajánlási logikát.

A konkrét fogalom és képlet még pontosítandó.

---

## Pending

- status / cancel capability
- **`cacheable` flag implementáció** (modul-state cache + browser HTTP cache no-store). A modul-state cache scope kibővítve a teljes távoli ref feloldási lánccal (lásd §16.1).
- **Recovery flow** (seed elvesztés utáni helyreállítás — konszenzusos Shamir-rekonstrukció)
- refs és exports kezelés (böngészős DAO szerkesztésben)
- IndexedDB ↔ WEB2/WEB3 publikálási/fork flow
- WEB2 szerver írási endpoint-jai: `/aq/asset`, `/aq/token`, `/aq/token/:id`
- Wallet aláírás ellenőrzés HTTP POST endpoint-okon (ecrecover)
- Hard link alapú blob tárolás + wallet-enkénti könyvtár
- GC crontab (árva CID-ek, dead linkek, trash 30 nap)
- Publikáló funkció DAO (genesis verzió)
- **Kapu DAO további funkciók** (lásd §14.7): QR scan / openDao, hamburger menü technikai megoldás (egy vs két iframe), keresés, switchGate capability
- Kritikus js-ek a protokoll config refs-ében (közös segédkönyvtárak trusted DAO-knak)
- Szabadsági fok konkrét képlet és tényezők véglegesítése
- Hitelesség kanonikus képlet konkrét formája
- Tranzitív bizalom decay függvény konkrét forma
- Bizonyíték formátum specializált DAO-kra
- Cross-device aláírás konkrét csatornája
- Korszak szorzók konkrét értékei és mérföldkő-definíciók
- Szorzók összesítési képlete (korszak-sorozat + szabadsági fok kombináció)
- Közösségi minimum tagság tábla pontos értékei
- Dedikált snapshot wallet BIP-44 derivation path konkrét értéke
- Identitás DAO periodikus kiírás: gyakoriság, trigger logika, titkosítási formátum
- Kritikus lépés jelölés formátum a DAO config-ban
- RPC hedged requests: ha több RPC URL elérhető, async (nem egyszerre) indított, sorrend-fix alap delay/timeout-tal, válaszok függvényében változó prioritás (lásd §14.10).
- **Chain ID ellenőrzés + cache** (§14.10): minden RPC forráson chain ID validáció, cache TTL-lel.
- **Lastblock check** (§14.10): stale RPC szűrés blokk-szám összehasonlítással.
- **Quorum** (§14.10): 3 forrás / 2 egyezés alapkonfig, független providerekkel.
- **Eszköz capability-k** (§16.6): clipboard, kamera, GPS, NFC — postMessage proxyn, loader kéri az engedélyt.
- **Megosztott identitás DAO storage** (§20): funkció DAO-k koordinációs csatornája, trigger-alapú működéssel.
