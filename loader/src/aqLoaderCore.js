// aqLoaderCore.js
// DAO és page betöltési orchestráció. 2-szintű refs séma.
// Kapu DAO: host-szintű renderelés.
// Tartalmi DAO: iframe-ben fut, postMessage capability bus-on.

import { conf } from "./aqConfig.js";
import { hostOrigin, devMode } from "./aqEnv.js";
import {
	fetchAssetText, fetchAssetBytes, fetchAssetJSON,
	setAqCidBase, getAqCidBase,
} from "./aqAssetFetch.js";
import { setAqDaoNamespace } from "./aqStorage.js";
import { iframe, randomHex } from "./aqIframe.js";
import { buildIframeDoc } from "./aqPageTemplate.js";
import {
	validateRefsLeaf, validateRefName, validateRefPath, validateFetchInput,
	validateContracts, validateTokens,
	isRemoteRef, isLocalRefObject, CID_RE,
} from "./aqAssetRef.js";
import { parseRpcConfig } from "./aqRpcConfig.js";
import { resolveDaoCid } from "./aqRpc.js";
import { exposeGateApi } from "./aqGateApi.js";
import { renderGateDao } from "./aqGateRender.js";

// ---- Modul-szintű state ----

let cfg = null;
let gateCfg = null;
let protocolCfg = null;
let currentKey = null;
let currentBlobUrl = null;
let pendingInitKey = null;
let _readyResolve = null;
let aqSessionToken;
let _bootHashConsumed = false;

export const getCfg = () => cfg;
export const getGateCfg = () => gateCfg;
export const getProtocolCfg = () => protocolCfg;
export const setProtocolCfg = (v) => { protocolCfg = v; };
export const getDaoCfg      = () => cfg;
export const getCurrentKey = () => currentKey;
export const getPendingInitKey = () => pendingInitKey;
export const getAqSessionToken = () => aqSessionToken;
export const setReadyResolve = (fn) => { _readyResolve = fn; };
export const consumeReadyResolve = () => {
	const r = _readyResolve;
	_readyResolve = null;
	return r;
};

// ---- Konstansok ----

const REFS_CATEGORIES = ["js", "css", "json", "html", "img", "others"];
const PAGE_FIELDS = ["html", "css", "js"];

// ---- DAO config validáció (2-szintű refs séma) ----

function validateDaoConfig(c) {
	if (!c || typeof c !== "object") throw new Error("[AQ] config: not an object");

	if (c.rpc !== undefined && c.rpc !== null && c.rpc !== "") {
		if (typeof c.rpc !== "string") throw new Error("[AQ] config: rpc must be string");
		if (c.rpc.trim() !== c.rpc) throw new Error("[AQ] config: rpc must be trimmed");
		if (/[\r\n\t]/.test(c.rpc)) throw new Error("[AQ] config: invalid rpc");
		let u;
		try { u = new URL(c.rpc); }
		catch { throw new Error("[AQ] config: rpc invalid URL: " + c.rpc); }
		if (!devMode && u.protocol !== "https:") throw new Error("[AQ] config: rpc must be https");
	}

	validateContracts(c.contracts, devMode);
	validateTokens(c.tokens, c.contracts);

	if (c.refs !== undefined) {
		if (!c.refs || typeof c.refs !== "object") throw new Error("[AQ] config: refs must be object");
		for (const cat of Object.keys(c.refs)) {
			if (!REFS_CATEGORIES.includes(cat)) throw new Error("[AQ] config: unknown refs category: " + cat);
			const subMap = c.refs[cat];
			if (!subMap || typeof subMap !== "object") throw new Error("[AQ] config: refs." + cat + " must be object");
			for (const sub of Object.keys(subMap)) {
				validateRefName(sub);
				const nameMap = subMap[sub];
				if (!nameMap || typeof nameMap !== "object") throw new Error("[AQ] config: refs." + cat + "." + sub + " must be object");
				for (const name of Object.keys(nameMap)) {
					validateRefName(name);
					validateRefsLeaf(nameMap[name], devMode, c.tokens);
				}
			}
		}
	}

	if (c.exports !== undefined) {
		if (!Array.isArray(c.exports)) throw new Error("[AQ] config: exports must be array");
		for (let i = 0; i < c.exports.length; i++) {
			const e = c.exports[i];
			if (!e || typeof e !== "object") throw new Error("[AQ] config: exports[" + i + "] must be object");
			if (!REFS_CATEGORIES.includes(e.category))
				throw new Error("[AQ] config: exports[" + i + "] invalid category: " + e.category);
			if (typeof e.name !== "string" || !e.name)
				throw new Error("[AQ] config: exports[" + i + "] name must be non-empty string");
			const { sub, name } = validateRefPath(e.name);
			const subMap = c.refs && c.refs[e.category];
			if (!subMap || !(sub in subMap))
				throw new Error("[AQ] config: exports[" + i + "] → refs." + e.category + "." + sub + " not found");
			const nameMap = subMap[sub];
			if (!(name in nameMap))
				throw new Error("[AQ] config: exports[" + i + "] → refs." + e.category + "." + sub + "." + name + " not found");
		}
	}

	if (!c.pages || typeof c.pages !== "object") throw new Error("[AQ] config: pages must be object");
	const pageKeys = Object.keys(c.pages);
	if (pageKeys.length === 0) throw new Error("[AQ] config: pages is empty");
	for (const pk of pageKeys) {
		const page = c.pages[pk];
		if (!page || typeof page !== "object") throw new Error("[AQ] config: page '" + pk + "' must be object");
		const fields = Object.keys(page);
		if (fields.length === 0) throw new Error("[AQ] config: page '" + pk + "' has no fields");
		for (const f of fields) {
			if (!PAGE_FIELDS.includes(f)) throw new Error("[AQ] config: page '" + pk + "' unknown field: " + f);
			const refPath = page[f];
			if (typeof refPath !== "string" || !refPath) throw new Error("[AQ] config: page '" + pk + "'." + f + " must be non-empty string");
			const { sub, name } = validateRefPath(refPath);
			const subMap = c.refs && c.refs[f];
			if (!subMap || !(sub in subMap))
				throw new Error("[AQ] config: page '" + pk + "'." + f + " → refs." + f + "." + sub + " not found");
			const nameMap = subMap[sub];
			if (!(name in nameMap))
				throw new Error("[AQ] config: page '" + pk + "'." + f + " → refs." + f + "." + sub + "." + name + " not found");
		}
	}

	if (typeof c.defaultPage !== "string" || !c.defaultPage) throw new Error("[AQ] config: defaultPage must be string");
	if (!(c.defaultPage in c.pages)) throw new Error("[AQ] config: defaultPage not in pages: " + c.defaultPage);
}

// ---- Ref feloldás (lokális és távoli) ----

async function resolveRemoteRef(remoteRef, category, sub, name, srcContracts, srcTokens, srcRpc) {
	if (!srcTokens || typeof srcTokens !== "object")
		throw new Error("[AQ] remote resolve: tokens map missing");
	const token = srcTokens[remoteRef.tokenName];
	if (!token || typeof token !== "object")
		throw new Error("[AQ] remote resolve: tokenName not found: " + remoteRef.tokenName);

	if (!srcContracts || typeof srcContracts !== "object")
		throw new Error("[AQ] remote resolve: contracts map missing");
	const contract = srcContracts[token.contractName];
	if (!contract || typeof contract !== "object")
		throw new Error("[AQ] remote resolve: contractName not found: " + token.contractName);

	// RPC fallback: contract.rpc > srcRpc > default Gnosis lista.
	const rpcSource = (typeof contract.rpc === "string" && contract.rpc)
		? contract.rpc
		: srcRpc;
	const rpcUrls = parseRpcConfig(rpcSource, devMode);
	const targetCid = await resolveDaoCid(token.tokenId, rpcUrls);
	const targetCfg = await fetchAssetJSON(targetCid);

	if (!targetCfg || typeof targetCfg !== "object") throw new Error("[AQ] remote resolve: target not an object");
	if (!targetCfg.refs || typeof targetCfg.refs !== "object") throw new Error("[AQ] remote resolve: target has no refs");
	const subMap = targetCfg.refs[category];
	if (!subMap || typeof subMap !== "object") throw new Error("[AQ] remote resolve: target refs." + category + " missing");
	if (!(sub in subMap)) throw new Error("[AQ] remote resolve: target refs." + category + "." + sub + " missing");
	const nameMap = subMap[sub];
	if (!nameMap || typeof nameMap !== "object") throw new Error("[AQ] remote resolve: target refs." + category + "." + sub + " not object");
	if (!(name in nameMap)) throw new Error("[AQ] remote resolve: target refs." + category + "." + sub + "." + name + " not found");
	const leaf = nameMap[name];

	if (isRemoteRef(leaf)) throw new Error("[AQ] remote resolve: chained remote ref not allowed");
	if (!isLocalRefObject(leaf)) throw new Error("[AQ] remote resolve: target leaf must be local object");

	// Devmode: path engedett. Production: csak cid.
	if (typeof leaf.path === "string" && leaf.path) {
		if (!devMode) throw new Error("[AQ] remote resolve: target leaf must have cid (path not allowed in non-devMode)");
		return { path: leaf.path };
	}
	if (typeof leaf.cid !== "string" || !CID_RE.test(leaf.cid))
		throw new Error("[AQ] remote resolve: target leaf must have cid");

	const callerCidBase = getAqCidBase();
	const targetCidBase = (typeof targetCfg.cidBase === "string" && targetCfg.cidBase) ? targetCfg.cidBase : null;
	const out = { cid: leaf.cid.toLowerCase() };
	if (targetCidBase && targetCidBase !== callerCidBase) out.cidBase = targetCidBase;
	return out;
}

async function resolveRefIn(srcCfg, category, sub, name) {
	if (!srcCfg) throw new Error("[AQ] ref: config not loaded");
	if (!REFS_CATEGORIES.includes(category)) throw new Error("[AQ] ref: unknown category: " + category);
	const subMap = srcCfg.refs && srcCfg.refs[category];
	if (!subMap || !(sub in subMap)) throw new Error("[AQ] ref: not found: " + category + "." + sub);
	const nameMap = subMap[sub];
	if (!(name in nameMap)) throw new Error("[AQ] ref: not found: " + category + "." + sub + "." + name);
	const leaf = nameMap[name];
	if (isRemoteRef(leaf)) return await resolveRemoteRef(leaf, category, sub, name, srcCfg.contracts, srcCfg.tokens, srcCfg.rpc);
	return leaf;
}

async function resolveOwnRef(category, sub, name) {
	return await resolveRefIn(cfg, category, sub, name);
}

// ---- Page betöltés (tartalmi DAO iframe) ----

export async function loadPage(pageKey) {
	const key = pageKey;
	if (key === currentKey) return true;
	const page = cfg.pages[key];
	if (!page) throw new Error("[AQ] Unknown page: " + key);
	if (!page.html && !page.css && !page.js) throw new Error("[AQ] page has no assets: " + pageKey);

	async function resolveField(field) {
		if (!page[field]) return null;
		const { sub, name } = validateRefPath(page[field]);
		return await resolveOwnRef(field, sub, name);
	}
	const htmlRef = await resolveField("html");
	const cssRef  = await resolveField("css");
	const jsRef   = await resolveField("js");

	const html = htmlRef ? await fetchAssetText(htmlRef) : "";
	const css  = cssRef  ? await fetchAssetText(cssRef)  : "";
	const js   = jsRef   ? await fetchAssetText(jsRef)   : "";

	aqSessionToken = randomHex(16);
	const doc = buildIframeDoc({ html, css, js, token: aqSessionToken, hostOrigin });
	if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
	currentBlobUrl = URL.createObjectURL(new Blob([doc], { type: "text/html" }));
	try {
		const w = iframe.contentWindow;
		if (w && w.location) w.location.replace(currentBlobUrl);
		else iframe.src = currentBlobUrl;
	} catch { iframe.src = currentBlobUrl; }
	currentKey = key;
	pendingInitKey = key;
	return new Promise((resolve) => { _readyResolve = resolve; });
}

// ---- DAO config betöltés (közös belső implementáció) ----

async function _loadDaoConfigInternal(daoRef, namespace, gateMode) {
	const hostCidBase = conf?.cidBase ?? "";
	setAqCidBase(hostCidBase);
	const isPathRef = typeof daoRef === "string" && daoRef.startsWith("/");
	if (!getAqCidBase() && !isPathRef) throw new Error("[AQ] missing cidBase");
	const nextCfg = await fetchAssetJSON(daoRef);
	validateDaoConfig(nextCfg);

	if (gateMode) {
		gateCfg = nextCfg;
		setAqDaoNamespace(namespace);
		const daoCidBase = nextCfg?.cidBase ?? "";
		setAqCidBase(daoCidBase || hostCidBase);
	} else {
		cfg = nextCfg;
		setAqDaoNamespace(namespace);
		const daoCidBase = nextCfg?.cidBase ?? "";
		setAqCidBase(daoCidBase || hostCidBase);
		if (!getAqCidBase() && !devMode) throw new Error("[AQ] missing cidBase");
		currentKey = null;
		pendingInitKey = null;
		let startKey = nextCfg.defaultPage;
		if (!_bootHashConsumed) {
			_bootHashConsumed = true;
			const h = (location.hash || "").trim();
			if (h && h !== "#") {
				const key = h.startsWith("#") ? h.slice(1) : h;
				if (nextCfg.pages && nextCfg.pages[key]) startKey = key;
			}
		}
		await loadPage(startKey);
	}
}

function mimeFromRef(ref) {
	const ext = (ref.path || "").split(".").pop().toLowerCase();
	return { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", webp: "image/webp", gif: "image/gif" }[ext] || "image/png";
}

async function preprocessAqRefs(html) {
	const AQ_REF_RE = /aq:\/\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/g;
	const matches = [...html.matchAll(AQ_REF_RE)];
	if (!matches.length) return { processed: html, imageBlobUrls: [] };

	const imageBlobUrls = [];
	const resolved = new Map();

	for (const [full, category, refPath] of matches) {
		if (resolved.has(full)) continue;
		const dot = refPath.indexOf(".");
		const sub  = refPath.slice(0, dot);
		const name = refPath.slice(dot + 1);
		try {
			const ref   = await resolveRefIn(gateCfg, category, sub, name);
			const bytes = await fetchAssetBytes(ref);
			const url   = URL.createObjectURL(new Blob([bytes], { type: mimeFromRef(ref) }));
			imageBlobUrls.push(url);
			resolved.set(full, url);
		} catch (e) {
			console.warn("[AQ] aq:// resolve failed:", full, e?.message || e);
		}
	}

	let processed = html;
	for (const [key, url] of resolved) processed = processed.replaceAll(key, url);
	return { processed, imageBlobUrls };
}

async function _resolveGatePageAssets(pageKey) {
	if (!gateCfg) throw new Error("[AQ] gate not loaded");
	const key = pageKey || gateCfg.defaultPage;
	const page = gateCfg.pages && gateCfg.pages[key];
	if (!page) throw new Error("[AQ] gate page not found: " + key);

	async function resolveField(field) {
		if (!page[field]) return null;
		const { sub, name } = validateRefPath(page[field]);
		return await resolveRefIn(gateCfg, field, sub, name);
	}
	const htmlRef = await resolveField("html");
	const cssRef  = await resolveField("css");
	const jsRef   = await resolveField("js");

	const rawHtml = htmlRef ? await fetchAssetText(htmlRef) : "";
	const { processed: html, imageBlobUrls } = await preprocessAqRefs(rawHtml);
	const css = cssRef ? await fetchAssetText(cssRef) : "";
	const js  = jsRef  ? await fetchAssetText(jsRef)  : "";
	return { html, css, js, imageBlobUrls };
}

// Kapu DAO config betöltése renderelés nélkül (devMode publish célra).
export async function loadGateCfgOnly(gateEntry) {
	if (!gateEntry || typeof gateEntry !== "object") throw new Error("[AQ] loadGateCfgOnly: invalid entry");
	let daoRef, namespace;
	if (devMode && typeof gateEntry.path === "string") {
		daoRef    = gateEntry.path;
		namespace = "gate:" + (gateEntry.tokenId ?? gateEntry.path);
	} else if (typeof gateEntry.tokenId === "string") {
		const rpcUrls = parseRpcConfig(conf?.rpc, devMode);
		const cid = await resolveDaoCid(gateEntry.tokenId, rpcUrls);
		daoRef    = cid;
		namespace = "gate:" + gateEntry.tokenId;
	} else {
		throw new Error("[AQ] loadGateCfgOnly: entry must have tokenId or path");
	}
	await _loadDaoConfigInternal(daoRef, namespace, true);
}

// Kapu DAO betöltése host-szinten.
// pageKey: opcionális, melyik kapu page-et rendereljen. Default: gateCfg.defaultPage.
export async function loadGateDao(gateName, gateEntry, pageKey) {
	if (!gateEntry || typeof gateEntry !== "object") throw new Error("[AQ] loadGateDao: invalid entry");

	let daoRef;
	let namespace;
	if (devMode && typeof gateEntry.path === "string") {
		// devMode: path elsőbbséget élvez; ha van tokenId, azt használjuk namespace-nek (stabil)
		daoRef    = gateEntry.path;
		namespace = "gate:" + (gateEntry.tokenId ?? gateEntry.path);
	} else if (typeof gateEntry.tokenId === "string") {
		const rpcUrls = parseRpcConfig(conf?.rpc, devMode);
		const cid = await resolveDaoCid(gateEntry.tokenId, rpcUrls);
		daoRef    = cid;
		namespace = "gate:" + gateEntry.tokenId;
	} else {
		throw new Error("[AQ] loadGateDao: entry must have tokenId or path");
	}

	await _loadDaoConfigInternal(daoRef, namespace, true);
	const gateAssets = await _resolveGatePageAssets(pageKey);
	exposeGateApi();
	await renderGateDao(gateAssets);
}

// Már betöltött kapu DAO config esetén csak újra renderel egy másik page-et.
// Pl. seed-gen utáni átváltáskor defaultPage-re.
export async function renderGatePage(pageKey) {
	if (!gateCfg) throw new Error("[AQ] renderGatePage: gate not loaded");
	const gateAssets = await _resolveGatePageAssets(pageKey);
	await renderGateDao(gateAssets);
}

// Tartalmi DAO betöltése a host conf openTokenId alapján.
// Devmode-ban path is elfogadott (ha "/"-ral kezdődik), egyébként tokenId.
export async function loadContentDao(openTokenId) {
	if (typeof openTokenId !== "string" || !openTokenId) {
		throw new Error("[AQ] openTokenId missing");
	}
	if (openTokenId.startsWith("/")) {
		if (!devMode) throw new Error("[AQ] openTokenId: path not allowed (non-devMode)");
		const namespace = openTokenId;
		await _loadDaoConfigInternal(openTokenId, namespace, false);
		return;
	}
	const rpcUrls = parseRpcConfig(conf?.rpc, devMode);
	const cid = await resolveDaoCid(openTokenId, rpcUrls);
	const namespace = "tokenId:" + openTokenId;
	await _loadDaoConfigInternal(cid, namespace, false);
}

// ---- Capability implementációk (page → bus → itt) ----

export async function aqRef(category, refPath) {
	const { sub, name } = validateRefPath(refPath);
	return await resolveOwnRef(category, sub, name);
}

export async function aqFetchText(ref) {
	if (typeof ref === "string") validateFetchInput(ref, devMode);
	return await fetchAssetText(ref);
}

export async function aqFetchBytes(ref) {
	if (typeof ref === "string") validateFetchInput(ref, devMode);
	return await fetchAssetBytes(ref);
}

export function cleanupOnPageHide() {
	try { iframe.src = "about:blank"; } catch {}
	try { if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = null; } } catch {}
	currentKey = null;
}
