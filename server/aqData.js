import { join } from "node:path";
import { readFile, writeFile, mkdir, symlink, rename, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

let _root;

let _chain = Promise.resolve();
const serialized = (fn) => {
	const r = _chain.then(fn);
	_chain = r.then(() => {}, () => {});
	return r;
};

export async function initData(dataRoot) {
	_root = dataRoot;
	await mkdir(join(dataRoot, "wallets"), { recursive: true });
	await mkdir(join(dataRoot, "trash"),   { recursive: true });
	await mkdir(join(dataRoot, "tokens"),  { recursive: true });
	await mkdir(join(dataRoot, "blobs"),   { recursive: true });
}

export async function isWhitelisted(wallet) {
	const p = join(_root, "whitelist.json");
	if (!existsSync(p)) return false;
	const list = JSON.parse(await readFile(p, "utf-8"));
	return list.map(a => a.toLowerCase()).includes(wallet.toLowerCase());
}

async function readOwnership() {
	const p = join(_root, "ownership.json");
	if (!existsSync(p)) return {};
	return JSON.parse(await readFile(p, "utf-8"));
}

async function writeOwnership(data) {
	const p = join(_root, "ownership.json");
	await writeFile(p + ".tmp", JSON.stringify(data, null, 2), "utf-8");
	await rename(p + ".tmp", p);
}

export async function mintToken(wallet) {
	return serialized(async () => {
		const files = await readdir(join(_root, "tokens"));
		const ids   = files.filter(f => /^\d+$/.test(f)).map(Number).filter(n => n >= 100);
		const next  = String(ids.length ? Math.max(...ids) + 1 : 100);
		await writeFile(join(_root, "tokens", next), "", "utf-8");
		const own = await readOwnership();
		own[next] = wallet.toLowerCase();
		await writeOwnership(own);
		return next;
	});
}

export async function setTokenCid(tokenId, cid, wallet) {
	return serialized(async () => {
		const own = await readOwnership();
		if (tokenId === "0" && !own["0"]) {
			own["0"] = wallet.toLowerCase();
			await writeOwnership(own);
		}
		if (own[tokenId]?.toLowerCase() !== wallet.toLowerCase()) {
			const e = new Error("not owner");
			e.code = "NOT_OWNER";
			throw e;
		}
		const p = join(_root, "tokens", tokenId);
		await writeFile(p + ".tmp", cid, "utf-8");
		await rename(p + ".tmp", p);
	});
}

export async function storeAsset(wallet, data) {
	const cid       = randomBytes(32).toString("hex");
	const walletDir = join(_root, "wallets", wallet.toLowerCase());
	await mkdir(walletDir, { recursive: true });
	await writeFile(join(walletDir, cid), data);
	const target = join("..", "wallets", wallet.toLowerCase(), cid);
	try { await symlink(target, join(_root, "blobs", cid)); }
	catch (e) { if (e.code !== "EEXIST") throw e; }
	return cid;
}

export async function readBlob(cid) {
	return readFile(join(_root, "blobs", cid));
}

export async function readTokenCid(tokenId) {
	try {
		const raw = (await readFile(join(_root, "tokens", tokenId), "utf-8")).trim().toLowerCase();
		const cid = raw.startsWith("0x") ? raw.slice(2) : raw;
		return cid || null;
	} catch (e) {
		if (e.code === "ENOENT") return null;
		throw e;
	}
}
