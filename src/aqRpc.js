// aq-rpc.js
// Gnosis chain RPC kliens a tokenId → Swarm hash feloldáshoz.
// Megosztható a boot.js és a loader között.

export const DAO_CONTRACT = "0x64521be8D93483f5A41c40c21176137aEd65296D";
export const SEL_getSwarmHash = "0xcc2fb628";

const transient = (msg) => {
	const e = new Error(msg);
	e.transient = true;
	return e;
};

export const rpcCall = async (url, method, params) => {
	const r = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
	});
	if (!r.ok) throw transient("[AQ] rpc http " + r.status);
	const j = await r.json();
	if (j.error) throw transient("[AQ] rpc error");
	return j.result;
};

export const encodeUint256 = (n) => {
	const bn = BigInt(String(n));
	return bn.toString(16).padStart(64, "0");
};

export const resolveDaoCid = async (tokenId, urls) => {
	if (!Array.isArray(urls) || urls.length === 0) throw new Error("[AQ] resolveDaoCid: missing urls");
	const data = SEL_getSwarmHash + encodeUint256(tokenId);
	let lastErr;
	for (const url of urls) {
		try {
			const r = await rpcCall(url, "eth_call", [{ to: DAO_CONTRACT, data }, "latest"]);
			if (r === "0x") throw new Error("[AQ] contract reverted");
			if (!/^0x[0-9a-fA-F]{64}$/.test(r)) throw new Error("[AQ] invalid bytes32");
			return r.slice(2).toLowerCase();
		} catch (e) {
			if (!e.transient) throw e;
			lastErr = e;
		}
	}
	throw lastErr || new Error("[AQ] dao resolve failed");
};
