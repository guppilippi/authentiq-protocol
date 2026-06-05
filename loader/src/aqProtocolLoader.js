// aqProtocolLoader.js (entry point)
// Boot flow:
//   1. openTokenId ellenőrzés
//   2. Kapu DAO választás (precedencia)
//   3. Seed ellenőrzés
//      - NINCS: kapu DAO seedGen page renderelés, várakozás
//      - VAN: kapu DAO defaultPage + tartalmi iframe
//   4. Seed mentés után átvált defaultPage-re + tartalmi iframe

import "./aqEnv.js";
import { devMode } from "./aqEnv.js";
import { initHostMenu } from "./aqHostMenu.js";
import { conf } from "./aqConfig.js";
import { parseRpcConfig } from "./aqRpcConfig.js";
import { setAqRpcUrls } from "./aqAssetFetch.js";
import { checkCidBaseSecurity } from "./aqCidBaseConfig.js";
import {
	loadGateDao, renderGatePage, loadContentDao, cleanupOnPageHide,
	setProtocolCfg, getProtocolCfg,
} from "./aqLoaderCore.js";
import { setLocked, isLocked } from "./aqProtocolBus.js";
import { overlayShowLocked, overlayHide } from "./aqIframe.js";
import { aqProtocolStorageGet } from "./aqStorage.js";
import { seedExists, sessionLoad, isSeedUnlocked } from "./aqKeyring.js";
import { teardownGateDao } from "./aqGateRender.js";

const rpcUrls = parseRpcConfig(conf.rpc, devMode);
setAqRpcUrls(rpcUrls);
checkCidBaseSecurity(conf.cidBase, rpcUrls, devMode);

const protocolCfg = window.aqProtocolConfig;
if (!protocolCfg || typeof protocolCfg !== "object") throw new Error("[AQ] missing aqProtocolConfig");
setProtocolCfg(protocolCfg);
try { delete window.aqProtocolConfig; } catch { try { window.aqProtocolConfig = undefined; } catch {} }

window.addEventListener("pagehide", () => {
	cleanupOnPageHide();
	try { setLocked(false); overlayHide(); } catch {}
});

async function pickGateName() {
	try {
		const rec = await aqProtocolStorageGet("aqGateDAOName");
		if (rec && typeof rec.meta === "string" && rec.meta) return rec.meta;
	} catch (e) { console.warn("[AQ] aqProtocolStorageGet failed:", e?.message || e); }
	if (typeof conf.aqGateDAOName === "string" && conf.aqGateDAOName) return conf.aqGateDAOName;
	const gates = getProtocolCfg().gates;
	if (!gates || typeof gates !== "object") throw new Error("[AQ] protocol config has no 'gates'");
	const keys = Object.keys(gates);
	if (keys.length === 0) throw new Error("[AQ] protocol config: gates is empty");
	return keys[0];
}

// A seed-gen flow befejezése után meghívandó (a seed-gen page kódjából).
// A kapu DAO defaultPage-ére vált és megnyitja a tartalmi DAO-t.
window.aqSeedGenComplete = async function aqSeedGenComplete() {
	try {
		setLocked(true);
		overlayShowLocked(isLocked);
		const sessionActive = isSeedUnlocked() || await sessionLoad();
		if (sessionActive) {
			teardownGateDao();
		} else {
			await renderGatePage(); // defaultPage
		}
		await loadContentDao(conf.openTokenId);
		initHostMenu();
	} catch (e) {
		console.error(e);
	} finally {
		setLocked(false);
		overlayHide();
	}
};

(async () => {
	const boot = async () => {
		setLocked(true);
		overlayShowLocked(isLocked);
		try {
			const openTokenId = conf?.openTokenId;
			if (typeof openTokenId !== "string" || !openTokenId) {
				throw new Error("[AQ] openTokenId missing");
			}

			const gateName = await pickGateName();
			const gates = getProtocolCfg().gates;
			const gateEntry = gates ? gates[gateName] : null;
			if (!gateEntry) throw new Error("[AQ] gate not found: " + gateName);

			const hasSeed = await seedExists();
			if (!hasSeed) {
				// Seed-gen flow: kapu DAO seedGen page renderelése, várakozás.
				// A seed-gen page kódja a felhasználói flow végén meghívja window.aqSeedGenComplete()-t.
				await loadGateDao(gateName, gateEntry, "seedGen");
				return;
			}

			// Normál flow: session check → gate kihagyva ha megvan, egyébként auth.
			const sessionActive = isSeedUnlocked() || await sessionLoad();
			if (!sessionActive) {
				await loadGateDao(gateName, gateEntry);
			}
			await loadContentDao(openTokenId);
			initHostMenu();
		} catch (e) {
			console.error(e);
		} finally {
			setLocked(false);
			overlayHide();
		}
	};
	if (document.readyState !== "loading") boot();
	else document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
