# AQ – Runtime State

Fejlesztési chatben karbantartandó. Crash recovery és új chat folytatás alapja.

---

## Hol tartunk

Linux deploy kész: Raspberry Pi, `https://damjanch.mooo.com`, port 8083, systemd service, nginx proxy.

App helye: `/var/www/sftp/szoke/sftp/sftp/`
Data root: `/var/www/sftp/szoke/sftp/sftp/data/`

**Funkcionális állapot:**
- Seed létrehozás (jelszó / WebAuthn-PRF) → titkosítva IndexedDB-ben
- Seed unlock → `_unlockedSeed` memóriában él → reload után authentikáció szükséges (aqSession eltávolítva)
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

- `seedUnlock(password?)`: nincs kontextus-korlát — jelszó/WebAuthn validál, `_unlockedSeed` memória-cache
- `seedActivate(rawBytes)`: seedGen után közvetlen aktiválás (re-decrypt nélkül) — csak memóriában
- `seedGetRaw()`: `isPwa || devMode` — raw seed és aláírás csak megbízható kontextusban
- `getWalletAddresses()`: nincs korlát — `_unlockedSeed`-ből derivál, cím nem érzékeny
- `isSeedUnlocked()`: szinkron memória-check; page reload után false (seed locked marad)
- boot: `seedExists()` → van: `loadGateDao` (auth prompt); nincs: seed-gen flow, `aqSeedGenComplete`-ben `isSeedUnlocked()` → `teardownGateDao()` vagy defaultPage render
- aqSession DB eltávolítva: raw seed plaintext tárolás szándékolatlan volt; jelszó/bio = unlock mechanizmus, nem session

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
- MIME detektálás path kiterjesztésből; CID ref esetén `image/png` default (korlát: SVG/WebP/egyéb rossz MIME-mel — tervezett: `type` mező a ref sémában vagy kategória-alapú deriválás, döntés WEB3 tervezéskor)

### Gate DAO flow

- Ephemeral modal (position:fixed overlay)
- Auth után: `gate.done()` → teardown
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
- `processPathRefs()`: path ref → upload → CID; kezeli: `loader`, `refs.*` mezőket (`boot` ág törölve — halott kód volt)
- `loadGateCfgOnly()`: gate config betölt renderelés nélkül — boot flow-ban nem hívódik (boot mindig `loadGateDao`-t hív); Publish Gate a memóriában lévő `gateCfg`-re támaszkodik (`getGateCfg()`)
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

## Tervezett refaktorok (következő DEVp)


## Ismert javítandók (AI workflow)

---

## Függő témák (következő session)

### i18n fejlesztési utasítások
Az i18n architektúra döntései rögzítve (state.md §i18n). Következő lépés: konkrét fejlesztési utasítások kidolgozása — mit kap a DAO, mit csinál a loader, milyen API-n keresztül vált nyelvet. PLAN módban.

### ⭐ Orchestrator architektúra — PRIORITÁS (közeljövő)
Hatékonyság fejlesztés, további előrehaladás előfeltétele.

**Közvetlen lépés:** főagent kontextust fájlokba ír (`AI-ctx/runtime/agent-ctx/`, nem gitelt) → subagent olvassa, feldolgoz, tömör summát ad vissza → főagent csak summát lát. Token-eloszlás: nehéz munka subagentben fogy.

**Teljes vízió (irány rögzítve):**

Főagent feladata kizárólag: context assembly + refinement + dokumentálás.

Loop:
1. Főagent összerakja a context struktúrát → fájlba írja (config: mi micsoda)
2. Subagent betölti, elvégzi a munkát
3. Ha a subagent outputja context-hiányt jelez (kérdés / hiányos eredmény) → főagent finomítja a *context fájlt*, új subagent indul a pontosított contexttel
4. Ha nincs hiány → főagent dokumentál

Visszakérdezés nem a chatben megy — a context fájl frissül, főagent contextje nem nő a loop alatt.

Context forrása: DAO config mintájára — path vagy CID alapján oldható fel. Most: csak path (mint a protokoll korai stádiuma). Később: CID → HTTP URL → bármely URL-olvasó LLM subagentként használható, file-független context.

Következmény: auto-compact ritka (főagent context lassan nő), chat history search felöslegesedik (minden állapot fájlban).

**Architektúra-váltás (rögzítve):**

- **Egyetlen session:** mindig PLAN módban indul, főagent = permanens orchestrator
- **Mód-rendszer megszűnik tab-ként:** DEVp/DEVs/AUDIT stb. nem külön session — a főagent rakja össze a subagent contextjét célzottan (manifest-kivonat + pontosan ami kell, semmi más)
- **Subagent model-agnosztikus:** ugyanaz a belépési pont (agent-ctx/<cid>/config.json), Claude vagy M3 vagy bármely URL-olvasó LLM
- **DEVp subagent scope:** csak saját agent-ctx/<cid>/output/-ba ír (diff, patch, eredmény); a projekt forrás fájljait nem érinti közvetlenül — főagent dönt és alkalmaz
- **process.md fájlok szerepe változik:** nem session-indítás, hanem subagent context template (főagent ebből vonja ki a releváns részt)
- **plan/process.md:** orchestrator-logikával bővítendő; ez a főagent egyetlen process fájlja

**agent-ctx/ struktúra (rögzítve):**

```
AI-ctx/runtime/agent-ctx/          ← gitignore-ban, Drive sync-ből kizárva
├── registry.json                  ← melyik agentet hívtad mikor (cid, agent típus, timestamp, task röviden)
└── <generated-cid>/               ← egy subagent hívás = egy folder
    ├── config.json                ← belépési pont: mi ez, milyen fájlok, refs (path→CID evolúció)
    ├── task.md                    ← mit kell csinálni
    ├── context.md                 ← releváns state részlet, döntések, korlátok
    ├── input/                     ← amin dolgozik (opcionális)
    └── output/
        └── summary.md             ← ≤30 sor; ez az egyetlen visszacsatorna a főagentnek
```

`config.json` séma: DAO config mintája — `{ "path": "..." }` most, `{ "cid": "..." }` később.  
`registry.json`: minden subagent hívás után főagent frissíti — audit trail + visszakereshetőség.  
CLAUDE.md szöveges leírással egészítheti ki.

**DEVp subagent scope:** forrás fájlokba írhat közvetlenül (saját könyvtár + érintett src). A főagent kizárólag `output/summary.md`-t olvas vissza — ha ezt kihagyja, a karmester szerep elveszik.

**Karpathy 3-réteg alkalmazása (rögzítve):**

Loop zárása verifier réteggel:
```
Orchestrator → spec (task.md) → Execution subagent
                                        ↓
                               output/summary.md
                                        ↓
                               Verifier subagent
                                  ↓         ↓
                               PASS        FAIL
                                 ↓           ↓
                            document    refine spec → új körözés
```

- **task.md formátum:** elfogadási kritériumok ("Kész ha: X, Y, Z"), nem leírás — verifier ez ellen ellenőriz
- **Verifier output:** `STATUS: pass|fail` + `REASON: ...`
- **config.json bővítés:** `scope` mező — mely fájlokhoz nyúlhat a subagent

**Modell-stratégia (rögzítve):**

| Réteg | Modell | Indok |
|---|---|---|
| Orchestrator | Sonnet 4.6 | Alapértelmezett |
| Execution — egyszerű | Sonnet 4.6 | Sebesség + ár |
| Execution — komplex, multi-fájl | Opus 4.8 | Csak indokolt esetben |
| Verifier — kód | Script (nincs modell) | Determinisztikus |
| Verifier — doksi/terv | M3 (MiniMax) | Más token-pool; CC-ből natívan fut |
| AUDIT — security | Mythos / Fable 5 | Generációs ugrás security területen |

Elvek: minimális token-fogyasztás, környezetterhelés csökkentése, token-pool szétválasztás (Claude + M3). Mythos/Fable 5 dedikált audit eszköz, nem általános subagent.

SETUP módban implementálandó (gitignore kész, CLAUDE.md bővítés, process.md handoff formátum).

### Docs protokoll-alapokra + URL-alapú subagent kommunikáció
**Docs mint DAO:** hosszú távú, de nem messze — a protokollal együtt épül (ami maga is könyvtárstruktúraként indult). Minden doc szekció = CID-del hivatkozható tartalom; template = instantiálható DAO config; LLM leírásból + kész template-ből épít DAO-t.

**URL-alapú subagent:** ha a tartalom CID → HTTP URL-en elérhető, bármely LLM ami URL-t olvas subagentként használható a protokollon keresztül. A protokoll = univerzális inter-agent kommunikációs réteg. Orchestrator (Claude) CID-et referál → subagent (bármely modell) URL-ről betölti, feldolgozza, visszaad.

PLAN módban kidolgozandó az orchestrator architektúrával együtt.

**Keresés protokoll-alapon:** minden tartalom CID-del címzett → "keresni" = tokenId/CID megtalálása a root set-ben. A protokoll root set-je maga az index — külső crawler nem kell. Keresőmotor = protokoll-natív traversal. Ez a "docs mint DAO" következménye: dokumentum megkeresése = protokoll lookup.

**Traversal belépési pont:** subagent DAO configot kap (JSON, CID hivatkozásokkal) → CID feloldás: devMode = path, prod = protokoll. Nincs külön "discovery" mechanizmus szükséges — a config maga a belépési pont.

### LLM kontextus fejlesztés — összetartozó témacsomag
Két összefüggő téma, sorrendben:

1. **Guide index** (előfeltétel): Guide szekciók indexelése → AGENTS.md hivatkozhat rájuk (`→ Guide §12.6`) ismétlés nélkül; tömör, LLM-optimalizált referenciák
2. **Per-directory AGENTS.md** (DOX minta): `loader/src/` és `server/` lokális invariánsok DEVp/DEVs módban, Guide indexre támaszkodva; globális `AI-ctx/` megmarad mód-logikának

Chat local tárolás: ejtve — orchestrator architektúrában minden lépés fájlba/CID-be kerül, visszakeresés inherensen megoldott.

Referencia: [DOX projekt](https://github.com/agent0ai/dox). PLAN módban tervezendő.

