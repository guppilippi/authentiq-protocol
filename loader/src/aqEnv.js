// aqEnv.js
// Környezet detektálás. Egyszer fut induláskor, side-effect formában.

if (top !== self) throw new Error("[AQ] embedded not allowed");

export const hostOrigin = location.origin;
if (!hostOrigin || hostOrigin === "null") throw new Error("[AQ] invalid host origin: " + hostOrigin);

const hn = (location.hostname || "").toLowerCase();
export const devMode = (hn === "localhost" || hn === "127.0.0.1" || hn === "::1");
export const isPwa = window.matchMedia?.("(display-mode: standalone)").matches === true;