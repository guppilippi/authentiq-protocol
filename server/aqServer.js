import { createServer } from "node:http";
import { resolveDataRoot, requireDir, readBody, logRequest, logStartup, DAO_CONTRACT } from "./util.js";
import { initData, isWhitelisted, mintToken, setTokenCid, storeAsset, readBlob, readTokenCid } from "./aqData.js";
import { checkTimestamp, recoverWallet, msgMintToken, msgSetSwarmHash, msgUploadAsset } from "./aqAuth.js";

const PORT        = Number(process.env.AQ_PORT) || 8083;
const LABEL       = "AQS";
const SEL_GET     = "0xcc2fb628";
const TOKENID_RE  = /^\d+$/;
const CID_RE      = /^[0-9a-f]{64}$/i;
const MAX_UPLOAD  = Number(process.env.AQ_MAX_UPLOAD) || 10 * 1024 * 1024;

const dataRoot = resolveDataRoot(import.meta.url);
requireDir(dataRoot, "data root");
await initData(dataRoot);

function readBodyRaw(req, maxBytes = MAX_UPLOAD) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let total = 0;
		req.on("data", c => {
			total += c.length;
			if (total > maxBytes) { reject(new Error("body too large")); req.destroy(); return; }
			chunks.push(c);
		});
		req.on("end",   () => resolve(Buffer.concat(chunks)));
		req.on("error", reject);
	});
}

function corsHeaders(res) {
	res.setHeader("Access-Control-Allow-Origin", "*");
}

function jsonResp(res, status, body) {
	corsHeaders(res);
	res.writeHead(status, { "Content-Type": "application/json" });
	res.end(JSON.stringify(body));
}

const rpcOk  = (res, id, result)         => jsonResp(res, 200, { jsonrpc: "2.0", id, result });
const rpcErr = (res, id, code, message)  => jsonResp(res, 200, { jsonrpc: "2.0", id, error: { code, message } });

async function verifyAuth(wallet, sig, ts, message) {
	if (!wallet || !sig || !ts)                          return "missing auth fields";
	if (!checkTimestamp(ts))                             return "timestamp out of range";
	const recovered = recoverWallet(message, sig);
	if (!recovered || recovered !== wallet.toLowerCase()) return "invalid signature";
	if (!await isWhitelisted(wallet))                    return "wallet not whitelisted";
	return null;
}

const server = createServer(async (req, res) => {
	const url    = req.url || "";
	const method = req.method || "GET";
	const path   = url.split("?")[0].split("#")[0];

	if (method === "OPTIONS") {
		res.writeHead(204, {
			"Access-Control-Allow-Origin":  "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "content-type, x-aq-wallet, x-aq-sig, x-aq-timestamp",
		});
		res.end();
		logRequest(LABEL, method, url, 204);
		return;
	}

	// GET /cid/<hash>
	if (method === "GET" && path.startsWith("/cid/")) {
		const cid = path.slice(5).toLowerCase();
		if (!CID_RE.test(cid)) {
			res.writeHead(400); res.end();
			logRequest(LABEL, method, url, 400, "(invalid cid)");
			return;
		}
		try {
			const data = await readBlob(cid);
			corsHeaders(res);
			res.writeHead(200, {
				"Content-Type":   "application/octet-stream",
				"Content-Length": data.length,
				"Cache-Control":  "public, max-age=31536000, immutable",
			});
			res.end(data);
			logRequest(LABEL, method, url, 200, `(${data.length}B)`);
		} catch (e) {
			if (e.code === "ENOENT") { res.writeHead(404); res.end(); logRequest(LABEL, method, url, 404, "(no file)"); }
			else                     { res.writeHead(500); res.end(); logRequest(LABEL, method, url, 500, `(${e.message})`); }
		}
		return;
	}

	// POST /aq/asset
	if (method === "POST" && path === "/aq/asset") {
		const wallet = (req.headers["x-aq-wallet"] || "").toLowerCase();
		const sig    =  req.headers["x-aq-sig"]    || "";
		const ts     =  req.headers["x-aq-timestamp"] || "";
		const authErr = await verifyAuth(wallet, sig, ts, msgUploadAsset(ts));
		if (authErr) {
			jsonResp(res, 401, { error: authErr });
			logRequest(LABEL, method, url, 401, `(${authErr})`);
			return;
		}
		let body;
		try { body = await readBodyRaw(req); }
		catch (e) {
			jsonResp(res, 413, { error: e.message });
			logRequest(LABEL, method, url, 413, `(${e.message})`);
			return;
		}
		const cid = await storeAsset(wallet, body);
		jsonResp(res, 200, { cid });
		logRequest(LABEL, method, url, 200, `${wallet.slice(0, 10)}... → ${cid.slice(0, 8)}... (${body.length}B)`);
		return;
	}

	// POST /rpc
	if (method === "POST" && path === "/rpc") {
		let bodyStr;
		try { bodyStr = await readBody(req); }
		catch (e) { rpcErr(res, null, -32700, "body read error: " + e.message); logRequest(LABEL, method, url, 400, "(body)"); return; }

		let body;
		try { body = JSON.parse(bodyStr); }
		catch { rpcErr(res, null, -32700, "parse error"); logRequest(LABEL, method, url, 400, "(json)"); return; }

		const id        = body?.id ?? null;
		const rpcMethod = body?.method;
		const params    = body?.params;

		switch (rpcMethod) {

			case "eth_call": {
				if (!Array.isArray(params) || !params[0]) {
					rpcErr(res, id, -32602, "invalid params");
					logRequest(LABEL, method, url, 200, "(invalid params)");
					return;
				}
				const call = params[0];
				const to   = String(call.to   || "").toLowerCase();
				const data = String(call.data || "").toLowerCase();
				if (to !== DAO_CONTRACT) {
					rpcErr(res, id, -32602, "unknown contract: " + to);
					logRequest(LABEL, method, url, 200, `(unknown contract ${to})`);
					return;
				}
				if (!data.startsWith(SEL_GET)) {
					rpcErr(res, id, -32602, "unknown selector");
					logRequest(LABEL, method, url, 200, "(unknown selector)");
					return;
				}
				const tokenIdHex = data.slice(SEL_GET.length);
				if (!/^[0-9a-f]{64}$/.test(tokenIdHex)) {
					rpcErr(res, id, -32602, "invalid data length");
					logRequest(LABEL, method, url, 200, "(invalid data)");
					return;
				}
				const tokenId = BigInt("0x" + tokenIdHex).toString(10);
				const cid = await readTokenCid(tokenId);
				if (cid === null) {
					rpcOk(res, id, "0x");
					logRequest(LABEL, method, url, 200, `tokenId=${tokenId} → revert`);
				} else if (!CID_RE.test(cid)) {
					rpcErr(res, id, -32603, `tokens/${tokenId}: invalid cid`);
					logRequest(LABEL, method, url, 200, `tokenId=${tokenId} (bad cid)`);
				} else {
					rpcOk(res, id, "0x" + cid);
					logRequest(LABEL, method, url, 200, `tokenId=${tokenId} → 0x${cid.slice(0, 8)}...`);
				}
				break;
			}

			case "aqMintToken": {
				const p      = Array.isArray(params) ? params[0] : null;
				const ts     = String(p?.timestamp ?? "");
				const wallet = String(p?.wallet    ?? "").toLowerCase();
				const sig    = String(p?.sig       ?? "");
				const authErr = await verifyAuth(wallet, sig, ts, msgMintToken(ts));
				if (authErr) {
					rpcErr(res, id, -32600, authErr);
					logRequest(LABEL, method, url, 200, `(${authErr})`);
					return;
				}
				try {
					const tokenId = await mintToken(wallet);
					rpcOk(res, id, { tokenId });
					logRequest(LABEL, method, url, 200, `aqMintToken → tokenId=${tokenId}`);
				} catch (e) {
					rpcErr(res, id, -32603, e.message);
					logRequest(LABEL, method, url, 200, `aqMintToken err: ${e.message}`);
				}
				break;
			}

			case "aqSetSwarmHash": {
				const p       = Array.isArray(params) ? params[0] : null;
				const to      = String(p?.to       ?? "").toLowerCase();
				const tokenId = String(p?.tokenId  ?? "");
				const cid     = String(p?.cid      ?? "").toLowerCase();
				const ts      = String(p?.timestamp ?? "");
				const wallet  = String(p?.wallet   ?? "").toLowerCase();
				const sig     = String(p?.sig      ?? "");
				if (to !== DAO_CONTRACT) {
					rpcErr(res, id, -32602, "unknown contract: " + to);
					logRequest(LABEL, method, url, 200, `(unknown contract)`);
					return;
				}
				if (!TOKENID_RE.test(tokenId)) {
					rpcErr(res, id, -32602, "invalid tokenId");
					logRequest(LABEL, method, url, 200, "(invalid tokenId)");
					return;
				}
				if (!CID_RE.test(cid)) {
					rpcErr(res, id, -32602, "invalid cid");
					logRequest(LABEL, method, url, 200, "(invalid cid)");
					return;
				}
				const authErr = await verifyAuth(wallet, sig, ts, msgSetSwarmHash(tokenId, cid, ts));
				if (authErr) {
					rpcErr(res, id, -32600, authErr);
					logRequest(LABEL, method, url, 200, `(${authErr})`);
					return;
				}
				try {
					await setTokenCid(tokenId, cid, wallet);
					rpcOk(res, id, { result: "ok" });
					logRequest(LABEL, method, url, 200, `aqSetSwarmHash tokenId=${tokenId} → ${cid.slice(0, 8)}...`);
				} catch (e) {
					const code = e.code === "NOT_OWNER" ? -32600 : -32603;
					rpcErr(res, id, code, e.message);
					logRequest(LABEL, method, url, 200, `aqSetSwarmHash err: ${e.message}`);
				}
				break;
			}

			default:
				rpcErr(res, id, -32601, "method not supported: " + rpcMethod);
				logRequest(LABEL, method, url, 200, `(unsupported ${rpcMethod})`);
		}
		return;
	}

	jsonResp(res, 404, { error: "not found" });
	logRequest(LABEL, method, url, 404);
});

server.listen(PORT, "0.0.0.0", () => {
	logStartup(LABEL, PORT, dataRoot);
	console.log(`[AQ] AQS binding: 0.0.0.0`);
});
