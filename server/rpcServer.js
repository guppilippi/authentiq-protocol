// server/rpcServer.js
// Read-only JSON-RPC mock. Port 8082.
// POST /rpc  body: {jsonrpc, id, method:"eth_call", params:[{to, data}, "latest"]}
//   - to: várt aqProtocol DAO contract cím (DAO_CONTRACT konstans)
//   - data: "0xcc2fb628" + 32 byte tokenId (selector = getSwarmHash)
//   → result: "0x" + <64 hex>  (a tokens/<tokenId> fájl tartalma)
//   → revert szimuláció: "0x"  ha nincs fájl
// Minden más → 404 / JSON-RPC error.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { resolveDataRoot, requireDir, readBody, logRequest, logStartup, CID_RE, parseEthCallTokenId } from "./util.js";

const PORT = 8082;
const LABEL = "RPC";

const dataRoot = resolveDataRoot(import.meta.url);
const tokensDir = join(dataRoot, "tokens");
requireDir(dataRoot, "data root");
requireDir(tokensDir, "tokens dir");

function jsonRpcResult(id, result) {
	return JSON.stringify({ jsonrpc: "2.0", id, result });
}
function jsonRpcError(id, code, message) {
	return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
}

function respond(res, status, bodyStr) {
	res.writeHead(status, {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": "*",
	});
	res.end(bodyStr);
}

const server = createServer(async (req, res) => {
	const url = req.url || "";
	const method = req.method || "GET";

	// CORS preflight (csak ha esetleg böngészőből hívnák — most a kliens nem preflight-el, mert simple POST)
	if (method === "OPTIONS") {
		res.writeHead(204, {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "content-type",
		});
		res.end();
		logRequest(LABEL, method, url, 204);
		return;
	}

	const pathOnly = url.split("?")[0].split("#")[0];
	if (pathOnly !== "/rpc") {
		respond(res, 404, jsonRpcError(null, -32601, "not found"));
		logRequest(LABEL, method, url, 404);
		return;
	}
	if (method !== "POST") {
		respond(res, 405, jsonRpcError(null, -32601, "method not allowed"));
		logRequest(LABEL, method, url, 405);
		return;
	}

	let bodyStr;
	try { bodyStr = await readBody(req); }
	catch (e) {
		respond(res, 400, jsonRpcError(null, -32700, "body read error: " + e.message));
		logRequest(LABEL, method, url, 400, "(body err)");
		return;
	}

	let body;
	try { body = JSON.parse(bodyStr); }
	catch {
		respond(res, 400, jsonRpcError(null, -32700, "parse error"));
		logRequest(LABEL, method, url, 400, "(parse)");
		return;
	}

	const id = body?.id ?? null;
	const rpcMethod = body?.method;
	const params = body?.params;

	if (rpcMethod !== "eth_call") {
		respond(res, 200, jsonRpcError(id, -32601, "method not supported: " + rpcMethod));
		logRequest(LABEL, method, url, 200, `(unsupported method ${rpcMethod})`);
		return;
	}

	const parsed = parseEthCallTokenId(params);
	if (!parsed.ok) {
		respond(res, 200, jsonRpcError(id, parsed.code, parsed.message));
		logRequest(LABEL, method, url, 200, `(${parsed.message})`);
		return;
	}
	const { tokenId } = parsed;

	// Path traversal védelem.
	const filePath = resolve(tokensDir, tokenId);
	if (!filePath.startsWith(resolve(tokensDir) + (process.platform === "win32" ? "\\" : "/"))) {
		respond(res, 200, jsonRpcError(id, -32602, "path escape"));
		logRequest(LABEL, method, url, 200, "(path escape)");
		return;
	}

	try {
		const raw = (await readFile(filePath, "utf-8")).trim().toLowerCase();
		const cid = raw.startsWith("0x") ? raw.slice(2) : raw;
		if (!CID_RE.test(cid)) {
			respond(res, 200, jsonRpcError(id, -32603, `tokens/${tokenId}: invalid cid content`));
			logRequest(LABEL, method, url, 200, `tokenId=${tokenId} (bad content)`);
			return;
		}
		respond(res, 200, jsonRpcResult(id, "0x" + cid));
		logRequest(LABEL, method, url, 200, `tokenId=${tokenId} → 0x${cid.slice(0,8)}...`);
	} catch (e) {
		if (e.code === "ENOENT") {
			// Revert szimuláció: result "0x"  (a kliens "[AQ] contract reverted"-et lát).
			respond(res, 200, jsonRpcResult(id, "0x"));
			logRequest(LABEL, method, url, 200, `tokenId=${tokenId} → revert (no file)`);
		} else {
			respond(res, 200, jsonRpcError(id, -32603, e.message));
			logRequest(LABEL, method, url, 200, `tokenId=${tokenId} (${e.code || e.message})`);
		}
	}
});

server.listen(PORT, "127.0.0.1", () => {
	logStartup(LABEL, PORT, tokensDir);
});
