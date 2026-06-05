// aqBoot.js
// Boot entry point. Protokoll config feloldás → loader bundle betöltés.
// 1. tokens/0 lookup (RPC) → protokoll config CID
// 2. Protokoll config fetch + JSON parse
// 3. protocolCfg.loader → loader bundle CID vagy path
// 4. Loader fetch + HTML-check + script inject
// 5. protocolCfg a window.aqProtocolConfig globalbe (loader olvassa)

import { devMode } from "./aqEnv.js";
import { normalizeCidBase, CID_RE } from "./aqAssetRef.js";
import { fetchPath, fetchCid } from "./aqFetch.js";
import { resolveDaoCid } from "./aqRpc.js";
import { parseRpcConfig } from "./aqRpcConfig.js";
import { checkCidBaseSecurity } from "./aqCidBaseConfig.js";

const SELF_SCRIPT = document.currentScript;

const conf = window.aqProtocolPageConf;
if (!conf || typeof conf !== "object") throw new Error("[AQ] missing aqProtocolPageConf");

const rpcUrls = parseRpcConfig(conf.rpc, devMode);
checkCidBaseSecurity(conf.cidBase, rpcUrls, devMode);

const removeSelfScript = () => { try { SELF_SCRIPT?.remove(); } catch {} };
const removeConfScriptById = () => { try { document.getElementById("AQ_CONF")?.remove(); } catch {} };

// CID alapú fetch helper a protokoll config-hoz (cidBase + cid).
async function fetchByCid(cid) {
	const base = normalizeCidBase(conf.cidBase, devMode);
	return await fetchCid(base + cid.toLowerCase());
}

(async () => {
	// 1. tokens/0 lookup → protokoll config CID
	const protocolCid = await resolveDaoCid(0, rpcUrls);

	// 2. Protokoll config fetch + JSON parse
	const protocolResp = await fetchByCid(protocolCid);
	const protocolText = await protocolResp.text();
	let protocolCfg;
	try { protocolCfg = JSON.parse(protocolText); }
	catch (e) { throw new Error("[AQ] protocol config invalid JSON: " + (e?.message || e)); }
	if (!protocolCfg || typeof protocolCfg !== "object") throw new Error("[AQ] protocol config not an object");

	// 3. Loader bundle CID/path olvasás (konvenció: top-level "loader" mező, {cid} vagy {path})
	const loaderEntry = protocolCfg.loader;
	if (!loaderEntry || typeof loaderEntry !== "object") throw new Error("[AQ] protocol config: missing 'loader' field");

	// 4. Loader fetch
	let loaderUrl, loaderResp;
	if (typeof loaderEntry.cid === "string" && loaderEntry.cid) {
		if (!CID_RE.test(loaderEntry.cid)) throw new Error("[AQ] protocol config: loader.cid invalid");
		const base = normalizeCidBase(conf.cidBase, devMode);
		loaderUrl = base + loaderEntry.cid.toLowerCase();
		loaderResp = await fetchCid(loaderUrl);
	} else if (typeof loaderEntry.path === "string" && loaderEntry.path) {
		if (!devMode) throw new Error("[AQ] protocol config: loader.path not allowed (non-devMode)");
		if (!loaderEntry.path.startsWith("/")) throw new Error("[AQ] protocol config: loader.path must start with /");
		if (/[\r\n\t]/.test(loaderEntry.path)) throw new Error("[AQ] protocol config: loader.path invalid");
		loaderUrl = loaderEntry.path;
		loaderResp = await fetchPath(loaderUrl);
	} else {
		throw new Error("[AQ] protocol config: loader must have cid or path");
	}

	// HTML-detection: a betöltött loader bytes első 384 byte-ja UTF-8 dekódolva ellenőrzött.
	const ab = await loaderResp.arrayBuffer();
	const head = new TextDecoder("utf-8", { fatal: false }).decode(ab.slice(0, 384));
	if (/<\s*(!doctype|html|head|body)\b/i.test(head)) {
		throw new Error("[AQ] loader bytes look like HTML, abort");
	}

	// 5. Protokoll config átadása a loader-nek (window.aqProtocolConfig)
	window.aqProtocolConfig = protocolCfg;

	// Loader script injekció blob URL-ről.
	const blobUrl = URL.createObjectURL(new Blob([ab], { type: "text/javascript" }));
	const s = document.createElement("script");
	s.src = blobUrl;
	s.async = false;
	s.onload = () => { try { URL.revokeObjectURL(blobUrl); } catch {} };
	s.onerror = () => {
		try { URL.revokeObjectURL(blobUrl); } catch {}
		throw new Error("[AQ] loader exec failed: " + loaderUrl);
	};

	try { Object.freeze(conf); } catch {}
	try { Object.freeze(protocolCfg); } catch {}
	removeConfScriptById();
	removeSelfScript();
	(document.head || document.documentElement).appendChild(s);
})().catch((e) => {
	console.error(e);
	throw e;
});
