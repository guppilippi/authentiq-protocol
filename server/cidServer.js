// server/cidServer.js
// Read-only CID -> bytes szolgáltatás. Port 8081.
// GET /cid/<hash>  → bájtok a <dataRoot>/blobs/<hash> fájlból
// Minden más útvonal → 404.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { resolveDataRoot, requireDir, logRequest, logStartup, CID_RE } from "./util.js";

const PORT = 8081;
const LABEL = "CID";

const dataRoot = resolveDataRoot(import.meta.url);
const blobsDir = join(dataRoot, "blobs");
requireDir(dataRoot, "data root");
requireDir(blobsDir, "blobs dir");


const server = createServer(async (req, res) => {
	const url = req.url || "";
	const method = req.method || "GET";

	if (method !== "GET") {
		res.writeHead(405);
		res.end();
		logRequest(LABEL, method, url, 405);
		return;
	}

	// Strip query/fragment.
	const pathOnly = url.split("?")[0].split("#")[0];
	const prefix = "/cid/";
	if (!pathOnly.startsWith(prefix)) {
		res.writeHead(404);
		res.end();
		logRequest(LABEL, method, url, 404, "(not /cid/)");
		return;
	}
	const cid = pathOnly.slice(prefix.length).toLowerCase();
	if (!CID_RE.test(cid)) {
		res.writeHead(400);
		res.end();
		logRequest(LABEL, method, url, 400, "(invalid cid)");
		return;
	}

	// Path traversal védelem: az eredmény a blobsDir alatt kell legyen.
	const filePath = resolve(blobsDir, cid);
	if (!filePath.startsWith(resolve(blobsDir) + (process.platform === "win32" ? "\\" : "/"))) {
		res.writeHead(400);
		res.end();
		logRequest(LABEL, method, url, 400, "(path escape)");
		return;
	}

	try {
		const data = await readFile(filePath);
		res.writeHead(200, {
			"Content-Type": "application/octet-stream",
			"Content-Length": data.length,
			"Access-Control-Allow-Origin": "*",
			"Cache-Control": "public, max-age=31536000, immutable",
		});
		res.end(data);
		logRequest(LABEL, method, url, 200, `(${data.length}B)`);
	} catch (e) {
		if (e.code === "ENOENT") {
			res.writeHead(404);
			res.end();
			logRequest(LABEL, method, url, 404, "(no file)");
		} else {
			res.writeHead(500);
			res.end();
			logRequest(LABEL, method, url, 500, `(${e.code || e.message})`);
		}
	}
});

server.listen(PORT, "127.0.0.1", () => {
	logStartup(LABEL, PORT, blobsDir);
});
