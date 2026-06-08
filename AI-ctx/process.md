# AI Interaction Protocol

Minden módban érvényes. Felülír minden stílus/udvariassági optimalizációt.

---

## Állapotsor

KÖTELEZŐ minden válasz ELEJÉN.

**Ha minden mező 🟢:** csak `🟢 Status: OK` egysoros. Ha mód aktív: `🟢 Status: OK | Mód: <mód>`.
**Ha bármi eltér:** csak az eltérő mezők jelennek meg.

| Mező | Tartalom | 🟢 | 🟡 | 🔴 |
|------|----------|----|----|-----|
| Bizt | Bizonyossági szint (0–1) | ≥ 0.8 | 0.5–0.79 | < 0.5 |
| Ctx | Kontextusvesztés gyanú | nincs | gyenge | erős |
| Input | Input teljesség | OK | — | hiányos |
| Függ | Külső függés | nincs | van | — |
| Logika | Válasz logikai komplexitása | alacsony | közepes | magas |

---

## Mód aktiválás

Session indításkor: `.\scripts\allowed\set-title.ps1 "AQ | <mód>"` → vágólapra kerül a `/rename AQ | <mód>` parancs.  
Jelzés a felhasználónak: `[title] Ctrl+V + Enter`

---

## Hard constraints

- Utasítás végrehajtása előtt, ha az értelmezés nem triviális: egy sorban visszatükrözni mit értettél, aztán cselekedni. Szinkronban van a kontextus? Ha nem, ott derül ki — mielőtt bármit csinálnál.
- Minden feltételezést `[feltételezés]` jelöléssel kell ellátni — KÖTELEZŐ, HIBA ha hiányzik.
- Rögzítéskor: konkrét fájl + szekció/anchor + új vs bővítés. Általános hivatkozás nem elég.
- Diff: unified, 1-2 kontextussorral. Projekt-doksiba diff fence nem kerülhet.
- Diff csak felhasználói válasz után küldhető.
- Fájlokba nem kerülnek "volt X, most Y" bejegyzések — ezek a `runtime/changelog.md`-be mennek.

---

## Fájlok beolvasása

Nagy fájlok (400+ sor): `offset`/`limit` paraméterekkel végig kell olvasni. Csonkítás észlelésekor a hiányzó tartomány pótlása kötelező, mielőtt érdemi állítást tesz a fájlről.

---

## Új fájl nyilvántartása

Ha új fájl keletkezik:
- **Doc vagy src kategória**: azonnal felveszi a `file_catalog.md`-be és a `file_catalog.tsv`-be, és emlékeztet: `[drive-sheet]: <fájlnév> felkerült a katalógusba — Drive sheeten is frissítsd.`
- **Egyéb** (demo, script, temp): megkérdezi: `[katalógus?]: <fájlnév> — felkerüljön?`

---

## Ultrathink javaslat

Ha a feladat indokolja, javasold az ultrathink használatát az első válaszban (`[ultrathink]: <ok>`).

| Kategória | Példák |
|-----------|--------|
| Biztos ne | Egyfájlos olvasás, lookup, session indítás, stílus/naming check, rutindoksi |
| Talán | Közepes kód-review, architektúra-kérdés nem kritikus következménnyel, design vita |
| Biztos | Biztonsági határok (seed, signing, trust boundary); multi-fájlos protokoll-compliance; nem-nyilvánvaló következményű architektúrális döntés; kereszt-komponens interakció rejtett buggal |

Ha a felhasználó maga írja be: nem ignorálható, de jelezheted ha feleslegesnek érzed.

---

## Modell-javaslat

Ha a feladathoz más modell érezhetően alkalmasabb: `[modell-javaslat]: <ok> → <modell>` — és vár.

Opus 4.8 triggerek:
- Komplex kódbázis elemzése (>400 sor, bundelt/minifikált, novel architektúra)
- Többrétegű rendszer ahol több komponens interakciója a kérdés
- Több fájl kereszt-referenciájú audit vagy konzisztencia-ellenőrzés
- Architektúrális döntés ahol a nuance számít

---

## Token-takarékosság

- Tömör válaszok, redundáns narrálás kerülése.
- Ha a kontextus hosszú vagy témát vált: új chat javaslat. A mód-specifikus teendőket a mód saját fájlja írja le.

### CTX reakció

Stop hook systemMessage-ből: `[CTX X% SZINT | in:Xk cR:Xk ki:Xk]`  
`in` = input_tokens, `cR` = cache_read, `ki` = output — utolsó üzenet, nem kumulatív.

| Szint | CTX% | Teendő |
|-------|------|--------|
| LOW | <50% | — |
| MID | 50–75% | Ha sok a teendő: javasolj `/compact`-ot |
| HIGH | >75% | Új chat erősen javasolt — `[mód-javaslat]` |

### Mód-javaslat

Ha a feladat hatékonyabban végezhető más módban vagy új chatben:

`[mód-javaslat]: <ok> → <mód>`

Kérésre Claude nyitja az új tabot (encoded command, lásd `modes/setup/process.md`).

---

## Session dokumentálás

Kulcspontoknál (döntés, témaváltás, fontos megállapítás) frissítendő a `runtime/session.md`. Crash recovery és folytatás alapja.

---

## Session zárás

Ha a session lezárul (felhasználó jelzi, vagy Claude `[mód-javaslat]` / `[modell-javaslat]` után):

1. Volt-e új kommunikációs minta, preferencia, fejlesztői szokás ami még nincs `user.md`-ben?
2. Ha igen: `AI-ctx/user.md` bővítése — csak ami hiányzik vagy pontosítható, duplikálás nélkül
3. `runtime/session.md` kulcspontok frissítése (ha még nem frissült)

---

## Egyéni Claude Code beállítások

AQ-specifikus hookök és permissions: `.claude/settings.json` (projekt, gitbe kerül). Globális: `~/.claude/settings.json` (csak `tui: fullscreen`).
