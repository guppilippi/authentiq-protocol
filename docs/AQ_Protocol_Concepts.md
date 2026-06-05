# AQ Protocol – Concepts

## Dokumentum státusza
Ez a dokumentum **nem normatív**.  
Célja az AQ protokoll **értelmezése és mentális modelljeinek** bemutatása azok számára, akik a Canonical Manifestnél mélyebb rálátást szeretnének, de nem implementációs szinten gondolkodnak.

Ez a dokumentum:
- nem specifikáció,
- nem implementáció,
- nem roadmap.

---

## 1. A protokoll mint állapottér
Az AQ nem folyamatokat, hanem **értelmezhető állapotokat** ír le.
A protokoll szintjén nincs „felhasználói művelet" vagy „üzleti logika", csak állapotok és azok közti relációk.

Következmény:
- nincs implicit flow,
- nincs kötelező lifecycle,
- az értelmezés mindig a futtató környezet feladata.

---

## 2. Hash mint elsődleges valóság
A tartalom-hash nem azonosító egy rendszerben, hanem **maga az állítás**: „ez a konkrét tartalom".

Ebből következik:
- verzió = hash,
- módosítás = új hash,
- publikáció = állítás rögzítése.

Minden más (URL, path, origin) másodlagos.

---

## 3. Root Object mint nézőpont
A Root Object nem konfigurációs fájl a hagyományos értelemben, hanem egy **kitüntetett nézőpont** az állapottérre.

A root set:
- explicit allowlist,
- szemantikai határ,
- az „ami létezik most" definíciója.

Ami nincs benne:
- az protokoll-szinten nem értelmezhető.

---

## 4. Közösség mint absztrakció
A közösség nem szociológiai fogalom, hanem **állapot-tulajdonlási és döntési egység**.

Egy egyén:
- minimális közösség,
- teljes értékű protokoll-szereplő.

Ezért nincs a közösségnél kisebb protokollszintű egység.

---

## 5. Futás és protokoll szétválasztása
A protokoll nem garantál:
- UX-et,
- elérhetőséget,
- biztonsági policy-t.

A futtatás:
- mindig implementációfüggő,
- mindig környezethez kötött.

Ezért többféle futtatási modell legitim lehet ugyanarra a protokoll-állapotra.

---

## 6. Biztonság mint környezeti réteg
Az AQ protokoll csak az **integritást** definiálja:
- mit jelent egy állapot,
- mi számít változtatásnak.

Minden más:
- sandbox,
- origin,
- policy,
- capability modell
→ környezeti döntés, nem protokoll-elv.

Gyakorlati következmény (referencia loader szemlélet):
- az origin nem trust anchor (gateway/origin instabil lehet),
- a bizalom **csatorna- és tartalomkötésből** épül: `source + token + reply-binding + integritás(hash/CID)`,
- minimális, domainfüggetlen guardok: anti-embedding (`top !== self` → hard fail), valamint a page → host `postMessage` cél-originnel (`hostOrigin`, nem `"*"`).
A **kapu DAO és a protokoll DAO ugyanazon trust-szinten** futnak: mindkettő host-szintű (sandbox nélkül), auditált kód. A tartalmi DAO sandbox-iframe-ben marad — a sandbox csak a tartalmi DAO szintjén értelmes.

---

## 7. Miért létezik ez a dokumentum
A Concepts célja:
- a Manifest tisztán tartása,
- az Implementation Guide tehermentesítése,
- a Plan elkülönítése a magyarázattól.

Ez a dokumentum **átjáró**: segít megérteni, de nem dönt helyetted.

---

## 8. Storage capability

A storage capability egy DAO-scope-olt, text-only, hierarchikus kulcstér.

Tulajdonságok:

- capability, nem globális storage
- DAO namespace izoláció
- prefix-zárt invariáns
- atomic rename
- recursive delete
- nincs implicit directory objektum

A storage teljesen host-kontrollált, page közvetlenül nem fér hozzá IndexedDB-hez.

---

## 9. DAO típusok és altípusok

A protokoll két alapvető DAO típust ismer:

**Identitás DAO** (identity DAO)
- Egy entitást reprezentál: egyént vagy közösséget.
- Seed-je van (titkosítva, soha nem megjeleníthető), wallet címe abból származtatva.
- Nem fork-olható: csak csatlakozni lehet hozzá tagként.
- **Csak identitás DAO-nak van szabadsági foka.**
- Tartalma: személyes adatok, jogosultságok, kapcsolatok más DAO-kkal.
- Funkció DAO-k tulajdonosa lehet.

Két változata:
- **Egyéni identitás DAO**: egy személy + seed.
- **Közösségi identitás DAO**: több személy, Shamir-szilánkokkal és konszenzussal. A szilánkok a tagok saját identitás DAO-iban élnek.

**Funkció DAO** (function DAO)
- Szolgáltatást, képességet, információt reprezentál.
- Származtatott: az aqProtocol-ból vagy egy másik funkció DAO-ból. (Kivétel: maga az aqProtocol.)
- Fork-olható: forkoláskor a szülő exportált bejegyzéseit távoli refként kapja meg, az eredet a merkle-rootban rögzül.
- Tulajdonosa egy vagy több identitás DAO (egyéni vagy közösségi).
- **Hitelességet épít** a használat alapján.

### Funkció DAO altípusai

**Protokoll DAO** (protocol DAO)
- Az aqProtocol maga.
- Adatszerkezetet, szabályokat, lekérdezési felületet ad.
- Nincs UI, nincs saját üzleti logika.

**Kapu DAO** (gate DAO)
- A felhasználó kitüntetett interfésze, az egyetlen amit közvetlenül lát.
- Csak a protokoll DAO trusted (exportált, illetve távoli refként hivatkozott) bejegyzéseiből építkezhet.
- **Nincs benne privát funkció** — teljes egészében protokoll-auditált.

**Közösségi DAO** (community DAO)
- Identitás DAO-k szerveződik tagsággal (Shamir-szilánkokkal).
- Funkcionalitást építhet — ekkor lesz hitelessége.
- **Minden nem-protokoll, nem-kapu funkció DAO közösségi DAO**, akár egyetlen taggal is (de a valódi közösségi működéshez minimum 3 tag szükséges).

### Tag és fogyasztó

- **Tag**: Shamir-szilánkot birtokol, konszenzusban vesz részt, a közösség recovery-jének része. A tagságai súlyt adnak az identitás DAO jelzéseinek.
- **Fogyasztó**: regisztrált használó, nincs Shamir-szilánkja, nincs konszenzus-szerepe. Jelzés-súlyozásnál nem számít.

Egy identitás DAO egyszerre lehet több közösség tagja és több másik közösség fogyasztója.

---

## 10. Négyrétegű feloldási modell

A tartalom-feloldás négy rétegben valósulhat meg:

- **Localhost (file)**: közvetlen path alapú hivatkozás, genesis fázis és kézi barkácsolás.
- **WEB2 (Node.js szerver)**: content-addressed interfész, random CID-ekkel, fejlesztői/tesztelői szerver.
- **IndexedDB (böngésző)**: böngészős DAO fejlesztés és használat.
- **WEB3 (chain + decentralizált tároló)**: publikus, immutable, tokenId-vel horgonyzott, valódi content-addressed.

A feloldási mód implementációfüggő (Manifest), a rétegek egymásra épülnek. A boot és loader számára a réteg transzparens: hash-t kap, byte-ot old fel.

A decentralizált tároló konkrét implementációja nem rögzített a protokollban. Az első referencia implementáció Swarm alapú, de bármilyen mechanizmus támogatható (IPFS, saját P2P fájlrendszer, más).

---

## 11. Fork mint config snapshot

A fork nem hivatkozás-megosztás, hanem pillanatkép.

Fork során:
- a teljes DAO config másolódik,
- a szülő `exports` listájában szereplő (category, name) bejegyzések a gyerek `refs`-ébe **távoli refként** kerülnek be,
- a gyerek `exports` listája üresen indul,
- az eredet a publikáláskor számolt merkle-rootban rögzül (a config nem hordoz `_parent`-et).

A fork-kal keletkező távoli ref mindig a **tényleges tartalmi forrásra** mutat: ha a bejegyzés a szülőben lokális volt, a szülőre; ha a szülőben már távoli volt, közvetlenül az eredeti célra. Így a feloldás egyszintű marad — egy fork-kal kapott távoli ref soha nem mutat olyan DAO-ra, ahol a bejegyzés megint távoli.

Következmény: DAO-k között nincs megosztott lokális CID.
Minden DAO a saját lokális CID-jeiért felel, a GC DAO-szinten működik.

---

## 12. Távoli ref mint élő hivatkozás

A `refs` levél kétféle lehet: **lokális** (saját CID/path) vagy **távoli** (`{tokenName}` objektum, amely egy másik funkció DAO-ra mutat). A hívó DAO config `tokens` és `contracts` map-je tartalmazza a feloldáshoz szükséges adatokat: `tokenName` → `tokens[tokenName]` → `contracts[contractName]`. A távoli ref nem pillanatkép, hanem futásidejű feloldás.

Egy távoli ref a hivatkozott DAO **aktuális** állapotát oldja fel. Ha a hivatkozott DAO változik, a következő feloldás az új állapotot adja.

A feloldás **név-átívelő**: a loader a cél-DAO-ban ugyanazt a (category, name) bejegyzést keresi, amin a távoli ref a hívó configjában szerepelt. **Egyszintű**: ha a cél-DAO-ban az a bejegyzés megint távoli, a feloldás hiba — csak lokális CID (production) vagy path (devMode) fogadható el a lánc végén. Ez tudatos döntés: nincs láncolt feloldás, minden távoli ref pontosan egy ugrás.

Lazy resolve: a távoli ref mögötti DAO config csak az első híváskor töltődik be. Hiba esetén a hívó page kezeli.

Az `imports` mint külön config-szekció megszűnt: a külső DAO hivatkozás a `refs` levél objektum-formája. A page nem tudja és nem érdekli, hogy egy bejegyzés lokális vagy távoli — egységes (category, name) névtéren keresztül old fel mindent.

---

## 13. Kontextusgráf mint tervezési elv

Az entitások és relációk együttese egy **kontextusgráf** (CTXG), az adott értelmezési keret teljes rajza. A korábban "flow" néven ismert folyamatba szervezés a kontextusgráf egy speciális esete (lineáris, vagy elágazásos nem-lineáris).

A "bogyó" koncepció a legkisebb értelmezhető funkcionális egységre utal: bemenet → feldolgozás → kimenet vagy hiba. Ma ezt egyszerűen entitásnak (DAO-nak) nevezzük; a "bogyó" terminológia a korai koncepcióalkotás maradványa, szinonimaként használható.

A komplexitás izolálása a cél: egy önmagában kis entitás kevés hibalehetőséget képvisel, a nagyobb funkciók entitások kontextusgráfba szervezésével épülnek fel.

---

## 14. Szabadsági fok mint mentális modell

A szabadsági fok az identitás DAO **kompromittálhatóságának fordított mértéke**. Magas szabadsági fok = nehezen kompromittálható.

Fontos tulajdonságok:
- **Csak identitás DAO-nak van.** Funkció DAO-k a tulajdonos identitás DAO-tól öröklik közvetve.
- **Monoton csökkenő**: ha egyszer alacsony szintre került, ugyanazzal a seed-del nem emelhető vissza.
- **Két dimenzió**: mérhető szint (logaritmikus 5 szintű skála) és állapot (`mért` vagy `bizonytalan`).
- **Nyitott felső véggel**: új technológiák felfelé nyújtják a maximumot, a régi DAO-k belső értéke nem változik, de relatív kategóriájuk eltolódhat lefelé.

A részletes tényezők, képletek és külső bizonyíték-kezelés a Plan dokumentumban.

---

## 15. Hitelesség mint hosszú távú alapérték

A hitelesség a funkció DAO-k tulajdonsága, és a hasznossággal ellentétben **hosszú távon is központi marad**. A vízió szerint a "hiteltelen önámító világban" ez a rendszer fő értéke.

**Immutable**: ami egyszer hitelesnek bizonyult, az marad. A múlt hitelessége visszamenőleg nem sérül.

Források:
- **Passzív használat**: aki használja és nem panaszkodik, hallgatólagosan validál.
- **Explicit ellentmondás**: csak az aktív hibajelzés ront, nem kell aktív "egyetértés".
- **Tranzitív bizalom**: távoli ref láncon át csökkenő decay-jel.

**Bizalmi körök önkorlátozók**: alacsony szabadsági fokú identitások által tulajdonolt DAO-k egymás közti hitelessége nem nő érdemben, mert a hitelesség képletben a tulajdonos szabadsági foka is benne van.

---

## 16. Funkció DAO megbízhatósága

A funkció DAO hitelessége és megbízhatósága **nem romolhat**. Ami egyszer hiteles volt, az marad. A funkció DAO egy eszköz — egy kompromittált identitás DAO használhatja, de ettől az eszköz nem romlik el.

A funkció DAO-nak két mérőszáma van:

- **Hitelesség**: csak nőhet (immutable múlt). Forrás: használat, visszaigazolás.
- **Megbízhatóság**: mindkét irányba mozoghat. Forrás: protokoll érettség × tulajdonos szabadsági fok.

---

## 17. Protokoll érettség mint korszak-szorzó

A protokoll érettsége két egymást váltó tényezőből áll, mint egy stafétabot:

**Zárt köri megbízhatóság** (csökkenő, genesis-től open source-ig): amíg a protokoll nem nyilvános, a szűk kör személyes ismertsége védelmet jelent. A mérföldkövek mentén csökken (lokális → saját WEB2 → több WEB2 → WEB3 → open source + auditált → 0).

**Nyílt ismertségi hitelesség** (növekvő, open source-tól): a zárt köri szorzó nullára csökken, és csak utána indul a nyílt. Az audit **megelőzi** az open source váltást, így a nyílt ismertség nem nulláról indul.

---

## 18. Jelzések: hibajelzés és hasznosság jelzés

**A protokoll nem kezel identitás DAO-ra vonatkozó kompromittáltság jelzést.** Egy magas szabadsági fokú identitás DAO-t technikailag nagyon nehéz kompromittálni; ha mégis hibás kimeneteket hoz létre (akár mert az egyén kényszer, megtévesztés alatt cselekszik), az **funkció szintű hibajelzéssel** kezelendő. A protokoll nem vállalkozik az emberi gyengeség rendszerszintű detektálására.

### Hibajelzés (error signal)

- Egy identitás DAO jelezheti, hogy egy funkció DAO hibás.
- A jelzéskor **megadja mely közösségi tagság(ok) nevében** teszi — ez a "nézőpont".
- Súlya = a választott közösségi DAO-k hitelessége (aggregálva).
- **Visszavonható** a jelző által, ha a hiba már nem áll fenn.
- **Saját hiba elismerése** ugyanezen a csatornán: egy DAO tulajdonosa jelezheti a saját DAO-ja hibáját — ez **növeli** a hitelességet (felelős működés).

### Hasznosság jelzés (utility signal)

- Egy identitás DAO jelezheti, hogy egy funkció DAO hasznos volt.
- A jelzéskor **megadja mely közösségi tagság(ok) nevében** teszi — ugyanaz a nézőpont mechanizmus.
- Súlya = a választott közösségi DAO-k hitelessége (aggregálva).
- **Visszavonható** a jelző által.

### Fizetés

| Jelzés | Fizetés alapértelmezetten | Opcionálisan |
|---|---|---|
| Hibajelzés | Jelző közösségi DAO | — |
| Hasznosság jelzés | Jelzett DAO (saját érdekében) | Jelző, ha a jelzett nem vállalja |

### Stake-mentes spam védelem

A jelzések súlya a **kiválasztott közösség(ek) hitelessége**. Hitelesség építése valódi használatot igényel, ezért játékrontó közösségi DAO-t létrehozni nem éri meg: súly nélkül marad. Nem szükséges külön stake mechanizmus.

### Nézőpont

Ugyanaz az identitás DAO különböző közösségi tagságai nevében **ellentétesen** is jelezhet: ami az egyik kontextusban hasznos, a másikban kevésbé. A protokoll támogatja a többféle nézőpont párhuzamos érvényesülését.

---

## 19. Kritikus lépés

Bizonyos műveletek **kritikus lépésként** vannak jelölve. Ezeken a loader minden érintett DAO állapotát frissíti (hitelesség, hibajelzések, verzió) és figyelmeztet változásokról.

**Két jelölési forrás:**
- **Protokoll szintű**: bizonyos műveletek eleve kritikusak (chain-re írás, seed kezelés, identity DAO kapcsolás, szolgáltatási szerződés létrehozása).
- **DAO szintű**: egy funkció DAO saját műveleteit kritikusnak jelölheti (metadata).

**Offline és kritikus lépés**: offline módban kritikus lépés nem véglegesíthető. A loader minden kritikus lépés előtt online elérhetőséget és állapotfrissítést követel.

**Cache és offline**: a DAO-k és asset-ek cache-e nincs lejárat-korláttal — tetszőleges ideig használható. De kritikus lépésnél mindig friss adat kell.

---

## 20. Közösségi minimum tagság

A közösségi DAO-knak **minimum tagszámot** kell teljesíteniük a funkcionalitásukhoz. A minimum **függ a korszaktól és a tagok szabadsági fokától**.

**Elv:**
- Minél magasabb a szabadsági fok, annál kevesebb tag elég (a technológiai védelem pótolja a közösségi redundanciát).
- Minél érettebb a protokoll, annál nagyobb közösségi minimum (több támadási felület).
- **2 tagos közösség nincs** (recovery-képtelen Shamir-rekonstrukcióhoz egyedül nem elég — mindkét tagnak a teljes seed kellene).
- **Minimum 3 tag** mindig, attól függetlenül milyen korszakban és szabadsági fokon.

**Egyszemélyes identitás DAO ≠ közösségi DAO**: az identitás DAO önmagában egy egyéni egység, a közösség ebből épül. Egyszemélyes közösségi DAO nincs.

Konkrét minimum tábla a Plan-ben.

---

## 21. Identitás DAO életútja

1. **Protokollhoz csatlakozás** → egyéni identitás DAO létrejön (seed + jelszó/biometria védelem, IndexedDB-ben).
2. **Szolgáltatás használata fogyasztóként** → csatlakozás szolgáltató szerepű közösségi DAO-hoz. Nincs Shamir-szilánk, csak regisztráció.
3. **Tagság közösségi DAO-ban** → Shamir-szilánkot vesz át (vagy új közösséget alapít másokkal). Recovery-képes lesz, jelzést adhat.
4. **Szolgáltatás nyújtása** → a tag közösség funkcionalitást épít, amit fogyasztóknak szolgáltat.

Az egyéni identitás DAO **legális** közösségi tagság nélkül is, de:
- Jelzést nem tud adni (nincs nézőpont).
- Recovery nincs (elveszett eszköz = elveszett identitás).
- A genesis fázisban fájl backup helyettesíti a közösségi recovery-t.

Konzisztens a közmű jelleggel: a puszta használat nem kötelezi tagságra, de a szolgáltatás nyújtása és a jelzés igen.

---

## 22. Audit minden asset-re

Az audit nem csak JavaScript funkciókra vonatkozik, hanem **minden asset-re** (képek, dokumentumok, HTML, CSS, JSON). Egy hamis kép vagy félrevezető diagram ugyanúgy manipulációs eszköz, mint egy rossz algoritmus.

Az asset-audit technikailag ugyanaz mint a funkció-audit: egy trusted auditor közösségi DAO az auditált bejegyzést távoli refként hivatkozza, az azt használó DAO a hitelességet öröklően kapja.

**Privát asset** (a DAO saját, auditálatlan) megszünteti az audit-örökséget ugyanazon szabály szerint mint a privát funkció. Formázás és megjelenés (CSS stílus, HTML struktúra puszta elrendezése) nem.

---

## 23. Seed privacy — dedikált snapshot wallet

A protokoll a seed-ből **több wallet címet** származtathat BIP-44 derivation path-tal:

- **Fő wallet**: publikus azonosítás, szerződésekhez csatlakozás, tagsági kapcsolatok.
- **Snapshot wallet**: kizárólag a periodikus identitás DAO state kiírásokhoz.

A két cím között csak a seed tulajdonosa ismeri a kapcsolatot. Egy külső megfigyelő a snapshot cím használati mintázatából nem tudja visszavezetni az identitás fő címére. Ez privacy-alapvetés.

Mindkét cím ugyanazzal a seed-del védett — ha a seed elveszik, mindkettő elveszik. De a snapshot cím esetleges kompromittálódása nem érinti a fő identitás jogosultságait.

---

## 24. Vékony protokoll elv (mechanism, not policy)

A protokoll **adatszerkezetet és lekérdezési felületet** ad, nem logikát. A részletes mechanizmusokat (konszenzus, reputáció-számítás, recovery flow, publikálás) **származtatott DAO-k szolgáltatják**.

Ez gyorsítja a protokoll fejlesztését (szűk értő réteg) és megnyitja a funkcionalitás bővülést (bárki építhet DAO-t a protokoll fejlesztéstől függetlenül).

Konzisztens a Unix filozófiával és a content-addressed elv természetes kiterjesztése.

---

## 25. DAO mint önépítő rendszer

Az AQ DAO-k sablonokból származtathatók. A protokoll célja, hogy kezdetben fájl-szintű fejlesztői tudással, később egyre inkább sablonokból, böngészőn keresztül lehessen DAO-kat létrehozni és publikálni.

A származtatási lánc (a merkle-rootban rögzített fork-eredet) lehetővé teszi a DAO-k hasznosságának mérését: hányan forkolták, mennyit módosítottak, milyen gyakran oldódnak fel a távoli refjei.
