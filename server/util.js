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

// HTTP request body olvasás stringként, méret-limittel (default 64 KB).
export function readBody(req, maxBytes = 65536) {
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
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
		req.on("error", reject);
	});
}

// Egysoros request log.
export function logRequest(label, method, url, status, extra) {
	const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
	const tail = extra ? ` ${extra}` : "";
	console.log(`[${ts}] ${label} ${method} ${url} → ${status}${tail}`);
}

export const DAO_CONTRACT = "0x64521be8d93483f5a41c40c21176137aed65296d";

// Egysoros startup log.
export function logStartup(label, port, dataDir) {
	console.log(`[AQ] ${label} server listening on http://localhost:${port}`);
	console.log(`[AQ] ${label} data dir: ${dataDir}`);
}
