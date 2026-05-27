// aqRpcConfig.js
// Host conf rpc mező parsing + validáció + default fallback.
// Közös: aqBoot.js és aqProtocolLoader.js.

export const DEFAULT_RPC_URLS = [
	"https://rpc.gnosischain.com",
	"https://gnosis-rpc.publicnode.com",
	"https://rpc.gnosis.gateway.fm",
];

// rpcRaw: string | undefined | null (conf.rpc érték)
// devMode: boolean
// Visszatérés: string[]  (vagy a DEFAULT_RPC_URLS, vagy egyetlen elemű array)
// Dob: nem-string típus, vagy invalid URL, vagy non-devMode + nem-https esetén.
export function parseRpcConfig(rpcRaw, devMode) {
	if (rpcRaw === undefined || rpcRaw === null || rpcRaw === "") return DEFAULT_RPC_URLS;
	if (typeof rpcRaw !== "string") throw new Error("[AQ] rpc must be string");
	if (rpcRaw.trim() !== rpcRaw) throw new Error("[AQ] rpc must be trimmed");
	if (/[\r\n\t]/.test(rpcRaw)) throw new Error("[AQ] invalid rpc");
	let url;
	try { url = new URL(rpcRaw); }
	catch { throw new Error("[AQ] invalid rpc URL: " + rpcRaw); }
	if (!devMode && url.protocol !== "https:") throw new Error("[AQ] rpc must be https");
	return [rpcRaw];
}
