// aqFetch.js
// Fetch wrapper cache policy-vel. Közös: boot.js és aqAssetFetch.js.

export async function fetchPath(url) {
	const r = await fetch(url, { cache: "no-store" });
	if (!r.ok) throw new Error(`[AQ] fetch failed ${r.status} ${url}`);
	return r;
}

export async function fetchCid(url) {
	const r = await fetch(url, { cache: "force-cache" });
	if (!r.ok) throw new Error(`[AQ] fetch failed ${r.status} ${url}`);
	return r;
}