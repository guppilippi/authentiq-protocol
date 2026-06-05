# DEVs mód

## Betöltés

- Univerzális: `AI-ctx/process.md`, `sum.txt`, `file_catalog.md`
- Shared: `AI-ctx/shared/dev-session.md`
- Mód-specifikus: ez a fájl, `AI-ctx/runtime/state.md`, érintett `server/`

---

## Server deploy workflow

Server fájl (`aqServer.js`, `aqAuth.js`, `aqData.js`, `util.js`) módosítása után:

1. Lokális tesztelés
2. Deploy indítása:
   ```powershell
   Start-Process powershell -ArgumentList "-Command ""cd 'C:\Projects\AuthentiQ'; .\deployServer.ps1"""
   ```
3. Két passphrase prompt (pscp + plink) — felhasználó írja be
4. Script folyamata: `/tmp/`-be tölt → `sudo cp` célba → `sudo systemctl restart aq-server.service` → cleanup
5. Enter leütésre ablak bezárul

**SSH:** `momoa@192.168.1.76:2212`, kulcs: `C:\Projects\rebelware.ppk`  
**Passphrase nélkül:** Pageant-tal (egyszer unlock, session végéig automatikus)
