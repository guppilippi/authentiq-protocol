# Session notes

## 2026-06-05 — AI-ctx struktúra építés

**Döntések:**
- Struktúra felépítve: `AI-ctx/modes/`, `shared/`, `runtime/`
- Módok: PLAN, DEVp, DEVs, REVIEW, AUDIT, DOCSYNC, SETUP
- Univerzális `process.md` megírva (CLI-re optimalizálva)
- AUDIT mód `process.md` megírva; `accepted.txt` hozzáadva
- Állapotgép leegyszerűsítve: csak AUDIT_RUNNING maradt értelmesnek CLI-ben

**Elkészült fájlok:**
- `process.md` (univerzális)
- `modes/audit/process.md` + `accepted.txt` (másolva, tartalom felülvizsgált)
- `modes/docsync/process.md` + `doc_sync_pending.md`
- `modes/devs/process.md`
- `modes/devp/process.md`
- `modes/plan/process.md`
- `shared/dev-session.md`
- `runtime/state.md`, `changelog.md`, `handoff.md`, `session.md`

**Elkészült (compact után):**
- `modes/review/process.md` — bundle-alapú; AUDIT=forrás, REVIEW=runtime+security
- `modes/setup/process.md` — kész, de "hook javítandók" szekció átkerül runtime/state.md-be
- `user.md` — felhasználói profil (univerzális)
- `shortcuts.md` — rövidítések és elírások szótára (univerzális)
- `modes/docsync/process.md` — changelog rolling window szabály hozzáadva

**AI-ctx struktúra: KÉSZ**
- `runtime/state.md` — hook javítandók + projekt-állapot (#1) hozzáadva
- `sum.txt` — kész
- `file_catalog.md` — kész (frissített útvonalakkal)
- `modes/audit/accepted.txt` — trimelt (marad: overlay UX, felelősségi határok, trusted státusz, audit szintezés súlyok, seed store pending)
- `CLAUDE.md` — átírva AI-ctx/ struktúrára
- `claude_settings_backup.json` — átmásolva

**Nyitott:**
- accepted.txt #20 (seed store) ellenőrizendő Guide-ban DOCSYNC alkalmával
- Hook javítandók implementálása (wakelock PID, PermissionRequest tab-váltás) — SETUP módban

## 2026-06-05 — Stop hook CTX% + process.md context-awareness

**Elvégzett:**
- Stop hook reírva: kumulatív összeg → utolsó üzenet CTX% (input+cacheRead / 200k)
- Formátum: `[CTX X% LOW/MID/HIGH | in:Xk cR:Xk ki:Xk]`
- process.md bővítve: CTX reakció tábla + `[mód-javaslat]` minta
- settings.json + claude_settings_backup.json szinkronban

**Git kész (2026-06-05):**
- Főprojektből git init, .gitignore (node_modules, .lnk, desktop.ini, .tmp.driveupload)
- Remote: https://github.com/guppilippi/authentiq-protocol.git
- authentiq-protocol_git/ törölve, force push main-re

**accepted.txt felülvizsgálat eredménye:**
- Törölhető (doksiban van): #2, #5, #6, #7, #8, #10, #11, #12, #13, #14, #15, #16, #17, #19, #21, #22, #23
- Marad (nincs máshol): #3 részlete, #4, #9, #18 (konkrét súlyok)
- Átkerül runtime/state.md-be: #1 (projekt-állapot)
- #20 (seed store) még ellenőrizendő Guide-ban

## 2026-06-06 — AUDIT: teljes kódbázis + docs audit (Opus 4.8)

**16 finding, eredmény:**
- F01 🔴 javítva: duplikált `getGateCfg` export (aqLoaderCore.js:41) — build törés volt
- F02 🔴 docs: Guide §8.2 — page-oldali `ev.origin` check dokumentálva
- F03 🟡 elfogadva: symlink szerver Linux-only (Pi)
- F04 🟡 docs: Guide §15 — `aqSeed.js` → `aqKeyring.js`
- F05 🟡 elfogadva: Windows nem publish platform
- F06 🟡 javítva: `CID_RE` → `/^[0-9a-f]{64}$/i` (aqServer.js, rpcServer.js)
- F07 🟡 docs: Plan §2.2 + Glossary — `img` kategória hozzáadva
- F08 🟡 docs: Guide §14.2–14.4 — seed.unlock/activate, wallet.addresses, gate.done
- F09 🟡 docs: Guide §17 — oneshot counter logika pontosítva
- F10 🟡 docs: Guide §7.1 — single-flight lock / kritikus átmenet szétválasztva
- F11 🟢 elfogadva: `_src` emlékeztető marad
- F12 🟢 docs: Guide §8.2 — `allow-downloads` dokumentálva
- F13 🟢 elfogadva: seed nem exportálható, BIP-39 inkompatibilitás irreleváns
- F14 🟢 elfogadva: `setStatus` fire-and-forget
- F15 🟢 javítva: `DAO_CONTRACT` → util.js, aqServer.js + rpcServer.js importálja
- F16 🟢 docs: accepted.txt — remote ref integritás rögzítve

**Mellékesen feltárt téma:** PWA bootstrap centralizáltság — manifest.json hiányzik, Pi deploy előfeltétele; web3-ból nem szolgálható ki tisztán. Feljegyezve state.md függő témákba, következő sessionben PLAN módban.

**Commit:** 96316de — push: main

## 2026-06-06 — PLAN: PWA architektúra döntések

**Döntések:**
- PWA választva: web2 csak telepítéskor → elfogadható kompromisszum
- Native WebView APK elvetve (PWA elegendő cross-platform célra)
- Asztali webhely elvetve: web2 minden betöltéskor, decentralizáltság rosszabb
- `isPwa` security gate megmarad (bio auth csak PWA-ban)
- WebAuthn-PRF iOS Safari-ban: nem ellenőrzött → graceful fallback (csak jelszó)

**PWA deploy sorrendje:**
1. `openTokenId` opcionálissá + URL param (`?token=<tokenId>`) olvasás — **előfeltétel**
2. `manifest.json` + ikonok (192, 512 px) + SW regisztráció
3. Nginx statikus file serve szétválasztás + Pi deploy
4. Pixel 7 real device teszt

**Technikai megállapítás:**
- `openTokenId` jelenleg kötelező: hiányzáskor throw (`aqProtocolLoader.js:82`)
- Hardkódolt: `demo/html/index.html:12` — `start_url: "/"` esetén crash

**Nyitott:**
- SW update check irreleváns ha bootstrap soha nem változik
- Cross-device PWA relay (WalletConnect-szerű): jövőbeli scope

## 2026-06-06 — PLAN: Claude Code újdonságok, ultrathink, auto-frissítés

**Megállapítások:**
- Claude Code 2.1.165 naprakész; auto-frissítés működik (kilépéskor írja felül a fájlt, Windows file-lock megkerülve)
- Ultrathink kritériumok bekerültek `process.md`-be (Biztos ne / Talán / Biztos táblázat)
- Thinking tokenek a CTX stop hook kimenetében nem látszanak (`ki` csak látható output)
- Memory fájl létrehozása nem engedélyezett felhasználói jóváhagyás nélkül

**Nyitott:**
- „Empty/minimális mód" (legolcsóbb session) — fogalom létezik, nincs definiálva; korábbi sessionből, session.md-ben nincs nyoma

**process.md változások:**
- Ultrathink kritériumok hozzáadva (Biztos ne / Talán / Biztos)
- Echo before execute szabály hozzáadva (Hard constraints)

## 2026-06-06 — DEVp: openTokenId opcionális + Pixel 7 browser teszt előkészítés

**Elvégzett:**
- `openTokenId` opcionálissá: URL param (`?token=`) → `conf.openTokenId` → null; module-szinten feloldva, `loadContentDao` kihagyva ha null
- Nginx `location /` hozzáadva Pi-n (statikus fájl serve)
- `reloadNginx.ps1` létrehozva (resetServer.ps1 mintájára)
- DEVp + DEVs process.md: mód-javaslat trigger hozzáadva (server ↔ loader munka)
- DEVs process.md: Pi műveletek szekció (nginx reload + server reset)

**Következő (DEVs):**
- Production `index.html` (Pi URL-ekkel: damjanch.mooo.com) + deploy
- Publish Gate + Refresh Protocol Pi-re
- Pixel 7 browser teszt

## 2026-06-07 — DEVp: Pixel 7 teszt, mobile CSS + publish flow bővítés

**Elvégzett:**
- Pixel 7 browser teszt: viewport meta hiánya → 980px virtuális viewport → fix: `demo/html/index.html`
- `openTokenId` opcionális: `?token=` URL param → `conf.openTokenId` → null
- `DAO_CONTRACT` lowercase mindenhol (aqRpc.js, util.js, bundled)
- `runRefreshProtocol` → `runPublishProtocol` átnevezés
- Új: `runPublishBoot` — `/js/aqBoot.js` feltölt, CID vágólapra
- `processPathRefs`: `boot` field is kezeli (loader mellett)
- `loadGateCfgOnly`: gate config betölt renderelés nélkül — devMode + session aktív esetén
- devMode hamburger: Publish aqBoot.js + Publish Protocol + Publish Gate + Clear IndexedDB
- `setTokenCid`: ownership auto-claim kiterjesztve bármely tokenId-re (nem csak `"0"`)

**PLAN session: i18n architektúra + DAO state (döntések, state.md-be rögzítve):**
- Attribútum szintaxis: `data-i18n="[placeholder]key;textkey"` (prefix, minden attribútum típusra)
- i18n ref: tokenized (`tokenId`) vagy közvetlen CID-ek per nyelv; nincs kulcs → statikus, nincs nyelvválasztó
- Feloldás: `navigator.language` → `en` → első; DAO felülírhatja
- Váltás reload nélkül: új CID fetch → DOM re-sweep + `aq:langchange`
- DAO state: DAO saját maga kezeli (oldal, mezők, nyelv) — protokoll nem avatkozik be
- Gate state (minimum): választott nyelv + nyitott DAO tokenId → PWA folytatás

**Rövidítés rögzítve:**
- `shortcuts.md`: „nyiss egy <mód>-t" = új WT tab az adott módban (encoded command, setup/process.md)

## 2026-06-06 — PLAN: iframe origin, PWA bootstrap, IPFS gateway

**Megállapítások:**
- Tartalmi DAO iframe: sandbox (no `allow-same-origin`) → opaque origin (null); blob URL, de az origin irreleváns
- Host oldali security: `ev.source === iframe.contentWindow` + per-session token (16 bájt random hex)
- Iframe oldali `ev.origin !== AQ_HOST_ORIGIN` check redundáns — a token + `ev.source !== parent` lefedi; „kódolási szépség", nem load-bearing
- Host → iframe: `"*"` targetOrigin szükséges (null origin nem célozható); iframe → host: `AQ_HOST_ORIGIN` targetOrigin marad (értelmes)
- Eltávolítás DEVp-ben, más loader módosítással együtt (nem önállóan)

**PWA + web2 kiesés:**
- Ha SW cache-eli a bootstrap-ot → web2 szerver kiesése után a PWA indul és használható
- SW cache törlés: csak szándékos user action (tárterület törlés, PWA eltávolítás); véletlen kockázat alacsony

**IPFS gateway mint host:**
- `{cid}.ipfs.inbrowser.link` subdomain modell → saját origin → saját SW scope → PWA host elvileg lehetséges
- Feltételek: immutable bootstrap (stabil CID), pinning garantált
- Fenntartás: harmadik fél gateway (kevesebb kontroll mint saját szerver), IPFS vs Swarm hálózat-keveredés
- Nyitott: pinning kockázat elfogadhatósága
