// server/util.js
// Közös helperek a CID és RPC szerverekhez.

import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Data root meghatározása: env AQ_DATA_ROOT felülír, default a server mappa melletti data/.
// importMetaUrl: a hívó modul import.meta.url-je (hogy a default path a fájl helyéhez relatív legyen).
export function resolveDataRoot(importMetaUrl) {
	const envRoot = process.env.AQ_DATA_ROOT;
	if (envRoot && envRoot.trim() !== "") return resolve(envRoot.trim());
	const here = dirname(fileURLToPath(importMetaUrl));
	return resolve(here, "data");
}

// Subdir validáció: létezik és könyvtár. Hard fail ha nem.
export function requireDir(path, label) {
	if (!existsSync(path)) {
		console.error(`[AQ] ${label} not found: ${path}`);
		console.error(`[AQ] create it manually (mkdir -p) or set AQ_DATA_ROOT env var.`);
		process.exit(1);
	}
	const st = statSync(path);
	if (!st.isDirectory()) {
		console.error(`[AQ] ${label} is not a directory: ${path}`);
		process.exit(1);
	}
}

// HTTP request body olvasás; asBuffer:true → Buffer, egyébként UTF-8 string; default maxBytes: 64 KB.
export function readBody(req, { asBuffer = false, maxBytes = 65536 } = {}) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let total = 0;
		req.on("data", (c) => {
			total += c.length;
			if (total > maxBytes) {
				reject(new Error("body too large"));
				req.destroy();
				return;
			}
			chunks.push(c);
		});
		req.on("end", () => {
			const buf = Buffer.concat(chunks);
			resolve(asBuffer ? buf : buf.toString("utf-8"));
		});
		req.on("error", reject);
	});
}

// Egysoros request log.
export function logRequest(label, method, url, status, extra) {
	const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
	const tail = extra ? ` ${extra}` : "";
	console.log(`[${ts}] ${label} ${method} ${url} → ${status}${tail}`);
}

export const DAO_CONTRACT    = "0x64521be8d93483f5a41c40c21176137aed65296d";
export const CID_RE          = /^[0-9a-f]{64}$/i;
export const TOKENID_RE      = /^\d+$/;
export const SEL_getSwarmHash = "0xcc2fb628";

// eth_call tokenId parsing. Returns {ok:true, tokenId} or {ok:false, code, message}.
export function parseEthCallTokenId(params) {
	if (!Array.isArray(params) || !params[0]) return { ok: false, code: -32602, message: "invalid params" };
	const call = params[0];
	const to   = String(call.to   || "").toLowerCase();
	const data = String(call.data || "").toLowerCase();
	if (to !== DAO_CONTRACT) return { ok: false, code: -32602, message: "unknown contract: " + to };
	if (!data.startsWith(SEL_getSwarmHash)) return { ok: false, code: -32602, message: "unknown selector" };
	const tokenIdHex = data.slice(SEL_getSwarmHash.length);
	if (!/^[0-9a-f]{64}$/.test(tokenIdHex)) return { ok: false, code: -32602, message: "invalid data length" };
	const tokenId = BigInt("0x" + tokenIdHex).toString(10);
	return { ok: true, tokenId };
}

// Egysoros startup log.
export function logStartup(label, port, dataDir) {
	console.log(`[AQ] ${label} server listening on http://localhost:${port}`);
	console.log(`[AQ] ${label} data dir: ${dataDir}`);
}
