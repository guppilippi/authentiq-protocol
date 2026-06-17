# AQ – Runtime State

Fejlesztési chatben karbantartandó. Crash recovery és új chat folytatás alapja.

---

## Hol tartunk

Pi újraépítés: Alpine 3.24.1 SSD, SSH (port 2212, kulcs), awall, WireGuard (wg0) — SSH via VPN 10.0.0.1 + lokális IP is megy WG-n át.

**Pi állapot: KÉSZ**
- nginx + certbot: HTTPS él (damjanch.mooo.com, cert: 2026-09-13); root: `/opt/authentiq/server/html`
- AQ server: `/opt/authentiq/server/aqServer.js` (bundled, esbuild), fut, data/ auto-létrehoz
- deploy: `scripts/deployServer.ps1` (scp+ssh, OpenSSH kulcs)
- Telegram: `/root/.tg.env`, `/usr/local/bin/tg-notify`, `tg-boot` OpenRC service (need net)
- Cron: `certbot` → `/etc/periodic/daily/`; `/etc/periodic/daily/system-update` (apk upgrade + Alpine verzió check + tg-notify hiba esetén)

**Struktúra:**
- `/opt/authentiq/server/` — server bundle + data/ (server repo)
- `/opt/authentiq/server/html/` — PWA web2 belépési pont (nginx root)

**Pending commit:**
- `aqServer.js`: requireDir törölve
- `deployServer.ps1`: új build+deploy flow (esbuild + OpenSSH)
- `server/js/` → .gitignore
(commit a git repo szétválasztás után)

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
3. ~~**Pi setup:** Alpine 3.24.1 SSD, SSH (port 2212, kulcs), awall, WireGuard (wg0) — SSH via VPN 10.0.0.1 + lokális IP is megy WG-n át~~ — kész

**Ez a session:**
4. ~~Drive teljes struktúra szinkron~~ — ejtve; helyette: Pi az egyetlen munkamásolat, SSH tunnel a devMode-hoz; rclone egyirányú Pi→Drive backup: `rclone sync /root/AuthentiQ "gdrive:AuthentiQ"` (2 percenként cron, saját OAuth client, tg-notify hibára); dest: "My Drive/AuthentiQ" — git split után struktúra frissül
5. ~~Claude Code CLI telepítés Pi-re + SSH workflow kialakítása~~ — kész; workflow: SSH-n a Pi-ra, `/root/AuthentiQ`-ban `claude`; dev server tunnel: `ssh -p 2212 -i "C:\Projects\guppilippi" -L 8080:localhost:8080 -L 8081:localhost:8081 -L 8082:localhost:8082 root@192.168.1.76`

**Következő session:**
6. Git repo szétválasztás (protokoll / ai-ctx / server) — feloldja a függő commitot (aqServer.js, deployServer.ps1, .gitignore)
7. Orchestrator workflow reorg — mód-rendszer átszervezés (PLAN = permanens orchestrator, process.md → subagent template, agent-ctx/ struktúra, CLAUDE.md bővítés)
8. i18n fejlesztési utasítások kidolgozása — mit kap a DAO, mit csinál a loader, milyen API-n keresztül vált nyelvet
9. PWA: `manifest.json` + ikonok + `sw.js` → Pi deploy
10. Real device teszt (Pixel 7, damjanch.mooo.com) — standalone mód + WebAuthn-PRF ellenőrzés
11. WEB2 GC: `POST /aq/retire` endpoint + periodic orphan scan

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

### Lazy auth / publikus tartalom (rögzített)

- Protocol-szintű váltás: `loadGateDao` nem kötelező első lépés
- Tartalom publikus, gate csak action-nél jelenik meg
- DAO deklarálja mi auth nélkül elérhető
- CLI-re is érvényes: seed nélkül indul, csak aláíráshoz/decrypthez szükséges

### AuthentiQ CLI architektúra (rögzített)

- Ugyanazok a `loader/src/` modulok, Node.js esbuild target — külön entry point
- Boot szétválasztás marad (immutable CID = boot, updatable loader mögötte) — böngészővel azonos modell
- Disk cache: `~/.aq/cache/<cid>` — CID immutable, nincs invalidálás szükséges
- Lazy seed: seed generálása csak aláíráshoz/decrypthez, publikus használathoz nem
- Telepíthető bármely Linux-ra ahol van SSH kulcspár; öntelepítő (refs-alapú modulok)
- API-ként és AI workflow-ban is használható (refs JS-ek exponálják)

### CLI DAO (rögzített)

- Identitás DAO hozza létre template-ből, kezeli a saját DAO-ján keresztül
- Hibrid: funkció + opcionális seed; gép futtatja (nem ember)
- CLI észreveszi a változásokat és végrehajtja
- Neve TBD (opciók: Agent DAO / Node DAO / Daemon DAO / Device DAO / Proxy DAO)

### P2P kommunikáció (rögzített)

| Kapcsolat | Mechanizmus | Feltétel |
|---|---|---|
| Identity DAO ↔ CLI | WebSocket — CLI fut szerverként, browser csatlakozik | Közös hálózat (WireGuard) |
| Identity DAO ↔ Identity DAO | WebRTC + signaling | REL réteg, jövőbeli scope |
| CLI ↔ CLI | TCP / WebSocket, szimmetrikus | Közös hálózat |

### CLI seed — derivált (rögzített)

- CLI seed = `HKDF(identity_seed, "aq-cli-v1", machine_id)` → reprodukálható, nem kell átküldeni
- Bármikor újra-deriválható az identity DAO-ból
- Tárolás a gépen: SSH kulccsal titkosítva (cache), user soha nem látja
- SSH unlock: `HKDF(SSH_signature, "aq-cli-v1")` → unlock key → CLI seed decrypt
- Fenyegetési modell: fizikai hozzáférés + root szükséges; lopás = kikapcsolt gép (LUKS véd); protocol-szintű visszavonás (identity DAO megvonja CLI wallet jogait) elegendő

### Protokoll rétegek — hatókörök (rögzített)

| Réteg | Ki használja | Mit csinál |
|---|---|---|
| Browser | Ember | DAÓ-kkal dolgozik (identity, gate, tartalom) |
| CLI | API / AI | DAÓ-kat hoz létre és kezel programmatikusan |
| Android app | Ember + háttér | P2P storage daemon, identity — nem telepítget |

- CLI megosztható: egy CLI több identity DAO-t kiszolgálhat — szerver erőforrás kérdése
- Jól összerakott kontextus → kis / ingyenes modell is elegendő

### CLI script futtatás — platform és függőségek (rögzített)

- Kompozit: refs hivatkozza a lépéseket (CID-ek), CLI sorrendben futtatja, hibánál megáll
- Platform kulcs: csomagkezelő alapú (`apk`, `apt`, `pkg`, `winget`, `brew`) + `default` fallback
- Verziókezelés a scriptben (nem a configban)
- Függőség: sorrend implicit; előfeltétel-ellenőrzés minden scriptben
- P2P storage daemon Linuxon: CLI telepíti és futtatja — ugyanaz az eredmény mint Androidon, más út

### AI assistant — DAO assembly (rögzített)

- Publikus template DAÓ-kat olvas CID alapján
- Összerakja a DAO láncot user kérése alapján (kis módosításokkal)
- Fut: CLI-n (CID fetch szerver-side, kontextus assembly); eredmény → browser WebSocket-en
- Browser: megmutatja az összerakott configot → user aláír
- AI maga is function DAO (protokoll-natív)
- Megosztható CLI-n fut → nem kell minden usernek saját; kis/ingyenes modell elegendő célzott contexttel

---

## Projekt meta-állapot

- **Fázis:** local-only, development (genesis előtt)
- **Visszafelé kompatibilitás:** nem követelmény genesis előtt — refaktor, breaking change, strukturális változás bármikor elvégezhető (explicit felülírásig érvényes)
- Nincs production környezet, nincs prod-kompatibilitási elvárás

---

## Tervezett refaktorok (következő DEVp)


## Ismert javítandók (AI workflow)

---

## Strukturális szándékok (jövőbeli)

### Git repo szétválasztás
Jelenlegi: egyetlen repo (protokoll + AI-ctx + server). Tervezett szétválasztás:
- **protokoll** — `loader/src/`, `js/`, `docs/`, `demo/`
- **ai-ctx** — `AI-ctx/`, `.claude/`
- **server** — `server/`, `scripts/`

Határok még pontosítandók (pl. `demo/` hova tartozik). PLAN módban kidolgozandó, implementáció genesis előtti időszakban.

**Végrehajtás (rögzítve):** nincs history-megőrzés (nincs `git filter-repo`/subtree split) — friss `git init` mindhárom új repóban, jelenlegi commit-történet elvethető.

### Orchestrator infrastruktúra
- **Hely:** Raspberry Pi 4 (4GB RAM) — central, always-on
- **Elérés:** SSH (Windows Terminal + OpenSSH; VPN külső eléréshez)
- **Linux:** Debian dual boot már megvan PC-n; Linux váltás nem égető (SSH-n elérhető Pi)
- **Tárhely:** USB SSD ajánlott Pi-n (SD kártya hosszú távon megbízhatatlan folyamatos írással)
- **Szinkron réteg:** WEB2 (aqServer, `damjanch.mooo.com`) — Swarm opció marad, nem szükséges
- **Subagent workspace:** lokál (gyors) + WEB2 backup (async, nem blokkolja a munkát)
- **Swarm write:** csak task completion után — közbülső crash újragenerálható
- **Fejlesztés:** `ai-ctx-test/` mappában párhuzamosan, átálláskor rename

### PWA voice interface (jövőbeli)
- Telefon → szóbeli HU prompt → Voice Agent → task feed → Pi orchestrator
- Prerequisite: task creator DAO a PWA-ban + Swarm/WEB2 feed mechanizmus
- STT: Whisper (HU jó), LLM: Claude HU system prompttal, TTS: Google/ElevenLabs

---

## Függő témák (következő session)

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

| Réteg | Modell | API | Indok |
|---|---|---|---|
| Orchestrator | Sonnet 4.6 | Anthropic | Szigorú instrukció-követés, JSON-megbízható |
| Execution — egyszerű | Sonnet 4.6 | Anthropic | Sebesség + ár |
| Execution — komplex, nagy context | Opus 4.8 → Qwen3.6 Plus | Anthropic / OpenRouter | Qwen: 1M ctx, olcsóbb; tapasztalat alapján döntendő |
| Execution — DEVs/bash/szerver ops | Sonnet 4.6 → GPT-5.4 Mini | Anthropic / OpenRouter | GPT-mini: gyors, pontos terminál parancsokhoz |
| Verifier — kód | Script | — | Determinisztikus |
| Verifier — doksi/terv | M3 (MiniMax) | MiniMax / OpenRouter | Más token-pool; **strict output format kötelező** (verbose hajlam) |
| AUDIT — security | Fable 5 | Anthropic | Generációs ugrás security területen |

**OpenRouter:** egy API endpoint, sok modell (OpenAI-kompatibilis, pay-per-token). Célirány nem-Claude modelleknél (M3, Qwen, GPT-mini). MiniMax direct key most megvan — OpenRouter egységesíti majd.

Elvek: minimális token-fogyasztás, token-pool szétválasztás (Claude + OpenRouter), M3 verbosity = emberi outputhoz jó, orchestration JSON-hoz nem.

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

