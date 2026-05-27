// aqConfig.js
// Host config olvasás. Egyszer fut induláskor, exportálja a host által átadott conf objektumot.
// Környezeti tények (hostOrigin, devMode) az aqEnv.js-ben.
//
// Megjegyzés: a host conf séma változott — az aqDaoConfig és aqPageLoader mezők megszűntek.
// Az aqGateDAOName új opcionális mező (kapu DAO választás override-ja).

if (!window.aqProtocolPageConf) throw new Error("[AQ] missing aqProtocolPageConf");

export const conf = window.aqProtocolPageConf;
try { delete window.aqProtocolPageConf; } catch { try { window.aqProtocolPageConf = undefined; } catch {} }
