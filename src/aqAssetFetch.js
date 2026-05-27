// aqAssetFetch.js
// Asset feloldás és letöltés. Lokális objektum ({cid|path, description}) és resolved objektum ({cid, cidBase?}) ágak.

import { devMode } from "./aqEnv.js";
import { normalizeCidBase, isRemoteRef, isLocalRefObject, CID_RE } from "./aqAssetRef.js";
import { fetchPath, fetchCid } from "./aqFetch.js";

let aqCidBase = "";
export const setAqCidBase = (base) => { aqCidBase = base; };
export const getAqCidBase = () => aqCidBase;

let aqRpcUrls = null;
export const setAqRpcUrls = (urls) => { aqRpcUrls = urls; };
export const getAqRpcUrls = () => aqRpcUrls;

// Belső: CID + explicit cidBase (a megadott vagy a globális) → fetch.
async function fetchByCid(cid, cidBaseRaw) {
	const base = normalizeCidBase(cidBaseRaw, devMode);
	return await fetchCid(base + cid.toLowerCase());
}

// fetchAssetBytes input fajtái:
//  - string CID: globális aqCidBase-en (kvázi "raw" CID, pl. a protokoll config maga)
//  - string path: lokális dev (devMode)
//  - lokális objektum {cid, description}: globális aqCidBase-en
//  - lokális objektum {path, description}: lokális dev (devMode)
//  - resolved objektum {cid, cidBase?}: a megadott cidBase-en vagy globálison
//  - távoli objektum {rpc?, contract, tokenId}: NEM jut be (resolve a loadercore-ben)
export async function fetchAssetBytes(assetRef) {
	// Lokális objektum-ág ({cid, description} vagy {path, description})
	if (isLocalRefObject(assetRef)) {
		let r;
		if (typeof assetRef.cid === "string") {
			r = await fetchByCid(assetRef.cid, aqCidBase);
		} else {
			// path ág, devMode-only
			if (!devMode) throw new Error("[AQ] local path not allowed: " + assetRef.path);
			r = await fetchPath(assetRef.path);
		}
		return await r.arrayBuffer();
	}
	// Resolved objektum-ág ({cid, cidBase?})
	if (typeof assetRef === "object" && assetRef !== null && typeof assetRef.cid === "string" && !isRemoteRef(assetRef)) {
		const r = await fetchByCid(assetRef.cid, assetRef.cidBase ?? aqCidBase);
		return await r.arrayBuffer();
	}
	// String ág (raw CID, raw path) — boot- és protokoll-szintű használat
	const ref = String(assetRef ?? "").trim();
	if (!ref) throw new Error("[AQ] empty ref");
	if (/[\r\n\t]/.test(ref)) throw new Error("[AQ] invalid ref: " + ref);
	let r;
	if (ref.startsWith("/")) {
		if (!devMode) throw new Error("[AQ] local path not allowed: " + ref);
		r = await fetchPath(ref);
	} else if (CID_RE.test(ref)) {
		r = await fetchByCid(ref, aqCidBase);
	} else {
		throw new Error("[AQ] fetchAssetBytes: invalid string ref: " + ref);
	}
	return await r.arrayBuffer();
}

export async function fetchAssetText(asset) {
	if (!asset) return "";
	const bytes = await fetchAssetBytes(asset);
	return new TextDecoder("utf-8").decode(bytes);
}

export async function fetchAssetJSON(asset) {
	const text = await fetchAssetText(asset);
	try { return JSON.parse(text); }
	catch (e) { throw new Error("[AQ] invalid JSON: " + (e?.message || e)); }
}
