// aqProtocolBus.js
// postMessage protokoll a host oldalon, a tartalmi DAO iframe-jével.
// Handlerek, lock, watchdog warn.

import { iframe, overlayShowLocked, overlayHide } from "./aqIframe.js";
import {
	loadPage, loadDaoConfig,
	getCurrentKey, getPendingInitKey, getAqSessionToken,
	consumeReadyResolve,
	aqRef, aqFetchText, aqFetchBytes,
} from "./aqLoaderCore.js";
import {
	aqStoragePut, aqStorageGet, aqStorageDelete,
	aqStorageList, aqStorageRename,
} from "./aqStorage.js";

let _locked = false;
const ALLOW_WHILE_LOCKED = new Set();

export const isLocked = () => _locked;
export const setLocked = (v) => { _locked = v; };

const postTo = (win, token, type, payload) => {
	try { win?.postMessage({ aq: 1, token, type, payload }, "*"); } catch {}
};

const handlers = {
	protocolInfo: () => ({ pageKey: getCurrentKey() }),
	navigate: (params) => {
		const next = params?.pageKey;
		if (typeof next !== "string" || !next) throw new Error("navigate: missing pageKey");
		if (next !== getCurrentKey()) return loadPage(next);
		return true;
	},
	switchDao: (params) => {
		const daoConfig = params?.daoConfig;
		if (!daoConfig) throw new Error("switchDao: missing daoConfig");
		return loadDaoConfig(daoConfig);
	},

	storagePut:    (p) => aqStoragePut(p?.name, p?.patch),
	storageGet:    (p) => aqStorageGet(p?.name),
	storageDelete: (p) => aqStorageDelete(p?.name),
	storageList:   (p) => aqStorageList(p?.prefix, p?.options),
	storageRename: (p) => aqStorageRename(p?.from, p?.to),

	ref:        (p) => aqRef(p?.category, p?.name),
	fetchText:  (p) => aqFetchText(p?.ref),
	fetchBytes: (p) => aqFetchBytes(p?.ref),
};

const warnMsByMethod = {
	protocolInfo: 2000,
	navigate: 10000,
	switchDao: 10000,
	storagePut: 5000,
	storageGet: 5000,
	storageDelete: 10000,
	storageList: 10000,
	storageRename: 15000,
	ref: 10000,
	fetchText: 10000,
	fetchBytes: 10000,
	"default": 30000,
};

window.addEventListener("message", (ev) => {
	if (ev.source !== iframe.contentWindow) return;
	const msg = ev.data;
	if (!msg || msg.aq !== 1) return;
	if (msg.token !== getAqSessionToken()) return;
	const replyWin = ev.source;
	const replyToken = msg.token;
	const reply = (type, payload) => postTo(replyWin, replyToken, type, payload);

	if (msg.type === "AQ_PAGE_READY") {
		const initPayload = { pageKey: getPendingInitKey() ?? getCurrentKey() };
		setTimeout(() => {
			postTo(iframe.contentWindow, getAqSessionToken(), "AQ_INIT", initPayload);
			const r = consumeReadyResolve();
			if (r) r(true);
		}, 0);
		return;
	}

	if (msg.type === "AQ_STUCK") {
		const p = msg.payload || {};
		console.warn("[AQ] page reports stuck call:", p.method, "id=" + p.id, "elapsedMs=" + p.elapsedMs);
		return;
	}

	if (msg.type !== "AQ_CALL") return;
	const { id, method, params } = msg.payload || {};
	if (_locked && !ALLOW_WHILE_LOCKED.has(method)) {
		reply("AQ_ERROR", { id, error: "[AQ] locked" });
		return;
	}
	const warnMs = warnMsByMethod[method] ?? warnMsByMethod["default"];
	reply("AQ_ACK", { id, warnMs });
	const replyOK = (result) => { reply("AQ_RESULT", { id, result }); };
	const replyERR = (error) => { reply("AQ_ERROR", { id, error: String(error) }); };
	(async () => {
		const isAllow = ALLOW_WHILE_LOCKED.has(method);
		if (!isAllow) { _locked = true; overlayShowLocked(isLocked); }
		try {
			const h = handlers[method];
			if (!h) throw new Error("Unknown method: " + method);
			const result = await h(params);
			replyOK(result);
		} catch (e) {
			replyERR(e?.message || e);
		} finally {
			if (!isAllow) { _locked = false; overlayHide(); }
		}
	})();
});
