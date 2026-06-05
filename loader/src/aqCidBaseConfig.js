// aqCidBaseConfig.js
// cidBase–rpc biztonsági kötés.
// devMode: nem ellenőriz.
// Single RPC URL: same-origin VAGY ismert cidBase → OK. Egyéb → dob.
// Multi RPC (default Gnosis): ismert cidBase szükséges. Egyéb → dob.

export const DEFAULT_ALLOWED_CID_BASES = ["https://api.gateway.ethswarm.org/bzz/"];

// cidBase: raw string (conf.cidBase), rpcUrls: string[] (parseRpcConfig kimenete)
export function checkCidBaseSecurity(cidBase, rpcUrls, devMode) {
	if (devMode) return;
	const base = String(cidBase ?? "");
	const normalizedBase = base.endsWith("/") ? base : base + "/";
	if (rpcUrls.length === 1) {
		let rpcOrigin, cidOrigin;
		try { rpcOrigin = new URL(rpcUrls[0]).origin; }
		catch { throw new Error("[AQ] cidBase check: invalid rpc URL"); }
		try { cidOrigin = new URL(normalizedBase).origin; }
		catch { throw new Error("[AQ] cidBase check: invalid cidBase URL"); }
		if (rpcOrigin === cidOrigin) return;
		if (DEFAULT_ALLOWED_CID_BASES.includes(normalizedBase)) return;
		throw new Error("[AQ] cidBase not allowed for this rpc");
	}
	// Multi RPC (default Gnosis)
	if (DEFAULT_ALLOWED_CID_BASES.includes(normalizedBase)) return;
	throw new Error("[AQ] cidBase not allowed with default Gnosis RPC");
}
