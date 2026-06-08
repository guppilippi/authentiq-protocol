# AQ Protocol – Glossary (szómagyarázat)

## Dokumentum státusza
Ez a dokumentum **nem normatív**.
Célja az AQ protokoll terminológiájának egy helyen tartása, magyar és angol megfelelőkkel.

---

## DAO típusok

| Magyar | Angol | Rövidítés |
|---|---|---|
| identitás DAO | identity DAO | — |
| funkció DAO | function DAO | — |

Minden DAO vagy identitás DAO, vagy funkció DAO.

## Funkció DAO altípusok

| Magyar | Angol | Rövidítés |
|---|---|---|
| protokoll DAO | protocol DAO | — |
| kapu DAO | gate DAO | — |
| közösségi DAO | community DAO | — |

A protokoll DAO az aqProtocol maga. A kapu DAO protokoll által auditált UI. Minden más funkció DAO egy közösségi DAO (akár egyetlen taggal is, de a praktikus minimum 3 tag).

## Struktúra

| Magyar | Angol | Rövidítés |
|---|---|---|
| reláció | relation | REL |
| kontextusgráf | contextgraph | CTXG |
| referencia | reference | refs |
| lokális ref | local ref | — |
| távoli ref | remote ref | — |
| export | export | — |
| fork (≈ leágazás, hajtás) | fork | — |
| származtatási lánc | derivation chain | — |
| fork eredet | fork origin | — |

A fork magyar megfelelőiként a "leágazás" és "hajtás" használható leíró szövegben, de a terminusz marad "fork".

## Tervezési elv

| Magyar | Angol | Rövidítés |
|---|---|---|
| bogyó | bean | — |

A bogyó a minimális funkcionális egység (bemenet → feldolgozás → kimenet/hiba). Építkezési elv, nem DAO szinonimája.

## Mérőszámok

| Magyar | Angol | Rövidítés |
|---|---|---|
| szabadsági fok | degrees of freedom | — |
| hitelesség | credibility | — |
| hasznosság | utility | — |
| korszak-szorzó | epoch multiplier | — |

## Jelzések

| Magyar | Angol | Rövidítés |
|---|---|---|
| hasznosság jelzés | utility signal | — |
| hibajelzés | error signal | — |

A protokoll nem kezel identitás DAO-ra vonatkozó kompromittáltság jelzést — a kompromittált identitás által létrehozott hibás kimenetek funkció szintű hibajelzésként kezelendők.

## Rétegek

| Magyar | Angol | Rövidítés |
|---|---|---|
| localhost (file) | localhost | — |
| WEB2 (Node.js szerver) | WEB2 | — |
| IndexedDB (böngésző) | IndexedDB | — |
| WEB3 (chain + decentralizált tároló) | WEB3 | — |

---

## Fogalmak részletesebben

**Identitás DAO** (identity DAO) — seed-je van (titkosítva, nem megjeleníthető), wallet címe abból származtatva. Nincs saját hitelessége. Szabadsági fokkal rendelkezik. Lehet egyéni (egy személy) vagy közösségi (több személy Shamir-szilánkokkal, konszenzussal).

**Funkció DAO** (function DAO) — szolgáltatást, információt, eszközt reprezentál. Egy identitás DAO (egyéni vagy közösségi) birtokolja. Hitelességet és használati metrikát épít.

**Protokoll DAO** (protocol DAO) — az aqProtocol maga. Adatszerkezetet és lekérdezési felületet ad, nem logikát. Nincs UI.

**Kapu DAO** (gate DAO) — a felhasználó kitüntetett interfésze. A protokoll DAO trusted (exportált, illetve távoli refként hivatkozott) bejegyzéseiből építkezhet, csak onnan. Nincs benne privát funkció, teljesen protokoll-auditált.

**Közösségi DAO** (community DAO) — több identitás DAO szerveződése. Tagok Shamir-szilánkokat birtokolnak (a közösségi identitás DAO seed-jéből), konszenzussal működnek. A közösség funkcionalitást is építhet — ekkor lesz hitelessége.

**Tag (tagság)** (member, membership) — egy identitás DAO, aki Shamir-szilánkot birtokol egy közösségi DAO-ban. Részt vesz a konszenzusban, recovery-ben, és jelzéseihez a közösség hitelessége súlyt ad.

**Fogyasztó** (consumer) — egy identitás DAO, aki egy közösségi DAO szolgáltatását használja, de nem tag. Nincs Shamir-szilánkja, nincs konszenzus-szerepe, jelzés-súlyozásnál nem számít.

**Reláció** (relation, REL) — két vagy több entitás közötti irányított vagy irányítatlan kapcsolat. A kontextusgráfban élként reprezentálva.

**Kontextusgráf** (contextgraph, CTXG) — azon entitások és relációk irányított gráfja, amelyek egy adott értelmezési keretben relevánsak. A korábbi "flow" általánosított formája.

**Referencia** (reference, refs) — egy DAO config-jában a kategorizált, névvel hivatkozható erőforrások (kategóriák: js, css, json, html, img, others). Két szintű séma: `refs[category][subcategory][name]`. Egy `refs` levél kétféle lehet: lokális ref vagy távoli ref. Egységes (category, sub, name) névtér: egy bejegyzés egyszer szerepel a map-ben. A `refs[cat]`, `refs[cat][sub]`, `refs[cat][sub][name]` kulcsai ref-nevek (engedett: `[a-zA-Z0-9._-]+`, `.` és `..` tiltva). A 2-szintű hivatkozás (`aq.ref` második paramétere, `pages.<key>.<field>`, `exports[].name`) `"sub.name"` formátumú, egzakt 2 szegmens pont-szeparátorral.

**Lokális ref** (local ref) — `refs` levél objektum formában: `{cid, description}` (saját, ezen a DAO-n tárolt tartalom) vagy `{path, description}` (csak devMode). A `description` mező kötelező.

**Távoli ref** (remote ref) — `refs` levél objektum formában: `{tokenName}`, amely egy másik funkció DAO-ra mutat. A `tokenName` a hívó DAO config `tokens` map-jén át, majd a `contracts` map-en keresztül oldódik fel (`contractName`, `tokenId`, opcionálisan `rpc`). Futásidejű, egyszintű, név-átívelő feloldás: a loader a cél-DAO-ban ugyanazt a (category, sub, name) hármast keresi, és ha az ott megint távoli, hibát ad — csak lokális CID (production) vagy path (devMode) fogadható el a lánc végén. A `description` mező tilos a leaf-en (a cél hordozza). A korábbi külön `imports` szekció ebbe olvadt.

**Export** — egy DAO config-jában a lapos `[{category, name}]` lista, amely megjelöli, mely `refs`-bejegyzések (lokálisak vagy távoliak) érhetők el más DAO-k számára. Fork-öröklés és más DAO-k távoli refjeinek céljaként szolgál.

**Fork** — egy funkció DAO másolata új tulajdonossal. Forkoláskor a szülő exportált bejegyzései a gyerek `refs`-ébe távoli refként kerülnek, a gyerek `exports` listája üresen indul. Magyarul "leágazás" vagy "hajtás" is lehet a leíró szövegben.

**Fork eredet** (fork origin) — egy forkolt DAO szülőjének azonosítása. A config-séma nem hordozza; kizárólag a publikáláskor számolt merkle-root inputja. (A korábbi `_parent` config-mező megszűnt.)

**Származtatási lánc** (derivation chain) — egy DAO és az ősei egymásra épülő sorozata, a merkle-rootban rögzített fork-eredeteken keresztül.

**Bogyó** (bean) — a minimális funkcionális egység. Építkezési elv: kis, önállóan értelmezhető egységekből nagyobb funkciók állnak össze, a komplexitás ezáltal izolálva marad.

**Szabadsági fok** (degrees of freedom) — identitás DAO tulajdonsága. A kompromittálhatóság fordított mértéke. Magas fok = nehezen kompromittálható. Logaritmikus 5 szintű skála nyitott felső véggel.

**Hitelesség** (credibility) — funkció DAO tulajdonsága. A használatból és jelzésekből épül. Korszak-szorzókkal súlyozva, kanonikus képlet szerint bárhol determinisztikusan számítható. Nem monoton: csökkenhet hibajelzés hatására, visszavonáskor vagy javításkor visszanőhet.

**Hasznosság** (utility) — funkció DAO mérőszáma. Használati adatok aggregálása.

**Korszak-szorzó** (epoch multiplier) — a protokoll fejlettségének függvényében a DAO létrehozásakor/publikálásakor rögzülő szorzó. Zárt köri (csökkenő, genesis → open source) és nyílt ismertségi (növekvő, open source után). Visszamenőleg nem módosul.

**Hasznosság jelzés** (utility signal) — egy identitás DAO jelezheti hogy egy funkció DAO hasznos volt. A jelzéskor **megadja mely közösségi tagság(ok) nevében** teszi — ezek hitelessége súlyozza. Alapértelmezetten a jelzett DAO fizeti (érdeke van benne), opcionálisan a jelző.

**Hibajelzés** (error signal) — egy identitás DAO közösségi tagság nevében jelez egy funkció DAO hibáját. Ugyanúgy közösség nevében szól mint a hasznosság jelzés. Visszavonható a jelző által. Saját hiba elismerése a DAO-nak **növeli** a hitelességét.

**Stake-mentes súlyozás** — a jelzések súlyát a kiválasztott közösségi DAO-k hitelessége adja, nem stake. A játékrontó közösséget nem éri meg létrehozni, mert hitelesség építése valódi használatot igényel.

**Nézőpont** (viewpoint) — a jelzéshez kiválasztott közösség(ek). Ugyanaz az identitás különböző közösségei nevében ellentétesen is jelezhet.

---

## Rendszerfogalmak

**Genesis** — a protokoll első, kézi barkácsolási fázisa. Az aqProtocol és az első identitás/közösségi DAO-k létrehozása a localhost rétegen. Nincs közösségi recovery, helyette fájl backup.

**Seed** — az identitás DAO privát kulcs-magja. Soha nem megjeleníthető. Wallet címek származtatása BIP-44 úton (pl. dedikált snapshot wallet-cím).

**Shamir szilánk** — a közösségi identitás DAO seed-je több részre bontva, tagok között elosztva. N-of-M konszenzussal rekonstruálható.

**Recovery** — eszközvesztés utáni helyreállítás. Közösségen keresztül, konszenzusos Shamir-rekonstrukcióval. Genesis fázisban fájl backup.

**CID** — egy tartalomra mutató azonosító. WEB3-n valódi tartalom-hash, WEB2-n random hash.

**tokenId** — funkció DAO azonosítója az aqProtocol szerződésében. A telepített ERC721 Solidity contract neve: `PageNFT` (`docs/PageNFT.sol`); a protokoll-szintű elnevezése: "aqProtocol DAO contract". Mindkét név helyes a maga kontextusában — `PageNFT` a contract-szintű hivatkozásokban, "aqProtocol DAO contract" a protokoll-szintű leírásokban.

**Snapshot wallet** — az identitás DAO egy dedikált wallet címe (seed-ből származtatva), kizárólag a periodikus state kiírásokhoz. Elválasztja a publikus tevékenységet az identitás fő címétől (privacy).

**Kritikus lépés** — olyan művelet, amely a protokoll szerint (vagy egy funkció DAO saját jelölése alapján) különleges figyelmet igényel. A loader minden kritikus lépés előtt frissíti az érintett DAO-k állapotát és figyelmeztet változásokról.

**Kapu DAO audit** — teljes, mert a kapu DAO csak a protokoll DAO trusted bejegyzéseiből építkezhet, privát funkciót nem tartalmazhat.

**Funkció szintű audit** — egy funkció DAO auditáltsága a használt távoli refjeinek audit-láncából származik (csökkenő súllyal). Privát funkció megszünteti az auditáltságot. Formázás/megjelenés nem.
