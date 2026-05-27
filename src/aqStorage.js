// aqStorage.js
// DAO-scoped IndexedDB capability (text-only, hierarchikus, prefix-zárt).
// + protokoll-szintű "_protocol" namespace (aqProtocolStorage*).

const aqProtocolDbName = "aqProtocol";
const aqStorageStoreName = "aqStorage";
const aqStorageAllowedChars = " _-.,:;@#()[]'\"+=!?";

export const AQ_PROTOCOL_NS = "_protocol";

export let aqDaoNamespace = "";
export const setAqDaoNamespace = (ns) => { aqDaoNamespace = ns; };

let aqIdbPromise = null;

function aqIdbOpen() {
	if (aqIdbPromise) return aqIdbPromise;
	aqIdbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(aqProtocolDbName, 1);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(aqStorageStoreName))
				db.createObjectStore(aqStorageStoreName, { keyPath: "k" });
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error || new Error("[AQ] idb open failed"));
	});
	return aqIdbPromise;
}

function aqIdbReq(req) {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error || new Error("[AQ] idb request failed"));
	});
}

function aqIdbCommit(tx) {
	return new Promise((resolve, reject) => {
		tx.oncomplete = resolve;
		tx.onerror = () => reject(tx.error || new Error("[AQ] idb tx failed"));
		tx.onabort = () => reject(tx.error || new Error("[AQ] idb tx aborted"));
	});
}

function aqStorageNormalizeName(raw) {
	let name = String(raw ?? "").trim();
	while (name.startsWith("/")) name = name.slice(1);
	name = name.replace(/\/{2,}/g, "/");
	while (name.endsWith("/") && name.length > 0) name = name.slice(0, -1);
	if (!name) return "";
	return name.normalize("NFC");
}

function aqStorageValidateNewName(name) {
	if (!name) throw new Error("[AQ] storage: invalid name");
	const lastSlash = name.lastIndexOf("/");
	const leaf = lastSlash >= 0 ? name.slice(lastSlash + 1) : name;
	const leafStart = name.length - leaf.length;
	let leafHasAlnum = false;
	for (let i = 0; i < name.length; i++) {
		const ch = name[i];
		if (ch === "/") continue;
		if (/[\p{L}\p{N}]/u.test(ch)) { if (i >= leafStart) leafHasAlnum = true; continue; }
		if (aqStorageAllowedChars.includes(ch)) continue;
		throw new Error("[AQ] storage: invalid character");
	}
	if (!leafHasAlnum) throw new Error("[AQ] storage: leaf must contain letter or number");
	return true;
}

function aqStorageParent(name) { const i = name.lastIndexOf("/"); return i >= 0 ? name.slice(0, i) : ""; }

// Belső kulcs-builder: namespace + name. Minden függvény ezt használja.
function aqStorageKeyNs(namespace, name) { return namespace + "\n" + name; }

async function aqStorageGetExactNs(st, namespace, name) { return await aqIdbReq(st.get(aqStorageKeyNs(namespace, name))); }

function aqRecText(rec) { return rec ? String(rec.v ?? "") : ""; }

function aqRecMeta(rec) { return rec ? String(rec.m ?? "") : ""; }

async function aqStorageExistsNs(st, namespace, name) {
	const rec = await aqIdbReq(st.get(aqStorageKeyNs(namespace, name)));
	return !!rec;
}

async function aqStorageAssertImmediateParentExistsNs(st, namespace, name) {
	const parent = aqStorageParent(name);
	if (!parent) return;
	if (!(await aqStorageExistsNs(st, namespace, parent))) throw new Error("[AQ] storage: missing parent prefix");
}

// ---- Belső, namespace-agnostikus implementációk ----

async function aqStoragePutNs(namespace, rawName, patch) {
	const name = aqStorageNormalizeName(rawName);
	if (!patch || typeof patch !== "object") throw new Error("[AQ] storage: invalid put payload");
	const hasText = Object.prototype.hasOwnProperty.call(patch, "text");
	const hasMeta = Object.prototype.hasOwnProperty.call(patch, "meta");
	if (!hasText && !hasMeta) throw new Error("[AQ] storage: invalid put payload");
	if (name === "" && hasText) throw new Error("[AQ] storage: root text not writable");
	if (name !== "") aqStorageValidateNewName(name);
	const db = await aqIdbOpen();
	const tx = db.transaction(aqStorageStoreName, "readwrite");
	const st = tx.objectStore(aqStorageStoreName);
	if (name !== "") await aqStorageAssertImmediateParentExistsNs(st, namespace, name);
	const prev = await aqStorageGetExactNs(st, namespace, name);
	const nextV = hasText ? String(patch.text ?? "") : aqRecText(prev);
	const nextM = hasMeta ? String(patch.meta ?? "") : aqRecMeta(prev);
	await aqIdbReq(st.put({ k: aqStorageKeyNs(namespace, name), v: nextV, m: nextM }));
	await aqIdbCommit(tx);
	return true;
}

async function aqStorageGetNs(namespace, rawName) {
	const name = aqStorageNormalizeName(rawName);
	const db = await aqIdbOpen();
	const tx = db.transaction(aqStorageStoreName, "readonly");
	const st = tx.objectStore(aqStorageStoreName);
	const rec = await aqStorageGetExactNs(st, namespace, name);
	if (name === "") return { text: "", meta: aqRecMeta(rec) };
	if (!rec) return null;
	return { text: aqRecText(rec), meta: aqRecMeta(rec) };
}

async function aqStorageDeleteNs(namespace, rawName) {
	const name = aqStorageNormalizeName(rawName);
	const db = await aqIdbOpen();
	const tx = db.transaction(aqStorageStoreName, "readwrite");
	const st = tx.objectStore(aqStorageStoreName);
	let deleted = 0;
	let range;
	if (name === "") {
		const nsPrefix = namespace + "\n";
		range = IDBKeyRange.bound(nsPrefix, nsPrefix + "\uffff");
	} else {
		const exactK = aqStorageKeyNs(namespace, name);
		const exact = await aqIdbReq(st.get(exactK));
		if (exact) { await aqIdbReq(st.delete(exactK)); deleted++; }
		const subPrefix = aqStorageKeyNs(namespace, name + "/");
		range = IDBKeyRange.bound(subPrefix, subPrefix + "\uffff");
	}
	await new Promise((resolve, reject) => {
		const cur = st.openCursor(range);
		cur.onerror = () => reject(cur.error);
		cur.onsuccess = async () => {
			const c = cur.result;
			if (!c) return resolve();
			await aqIdbReq(st.delete(c.primaryKey));
			deleted++;
			c.continue();
		};
	});
	await aqIdbCommit(tx);
	return { deleted };
}

async function aqStorageListNs(namespace, rawPrefix, options) {
	const prefix = aqStorageNormalizeName(rawPrefix);
	const wantMeta = !options || options.meta !== false;
	const wantText = !!(options && options.text === true);
	const db = await aqIdbOpen();
	const tx = db.transaction(aqStorageStoreName, "readonly");
	const st = tx.objectStore(aqStorageStoreName);
	const nsPrefix = namespace + "\n";
	const items = new Set();
	if (!prefix) {
		const range = IDBKeyRange.bound(nsPrefix, nsPrefix + "\uffff");
		const rootText = wantText ? "" : undefined;
		await new Promise((resolve, reject) => {
			const cur = st.openCursor(range);
			cur.onerror = () => reject(cur.error);
			cur.onsuccess = () => {
				const c = cur.result;
				if (!c) return resolve();
				const namePart = String(c.key).slice(nsPrefix.length);
				const seg = namePart.split("/")[0];
				if (seg) items.add(seg);
				c.continue();
			};
		});
		const names = [...items].sort();
		if (!wantMeta) { const out = { items: names }; if (wantText) out.text = rootText; return out; }
		const out = [];
		for (const name of names) {
			const rec = await aqIdbReq(st.get(aqStorageKeyNs(namespace, name)));
			out.push({ name, meta: rec ? String(rec.m ?? "") : "" });
		}
		const result = { items: out };
		if (wantText) result.text = rootText;
		return result;
	}
	let text;
	if (wantText) { const rec = await aqIdbReq(st.get(aqStorageKeyNs(namespace, prefix))); text = rec ? String(rec.v ?? "") : ""; }
	const subPrefix = aqStorageKeyNs(namespace, prefix + "/");
	const range = IDBKeyRange.bound(subPrefix, subPrefix + "\uffff");
	await new Promise((resolve, reject) => {
		const cur = st.openCursor(range);
		cur.onerror = () => reject(cur.error);
		cur.onsuccess = () => {
			const c = cur.result;
			if (!c) return resolve();
			const namePart = String(c.key).slice(nsPrefix.length);
			const rest = namePart.slice((prefix + "/").length);
			const seg = rest.split("/")[0];
			if (seg) items.add(seg);
			c.continue();
		};
	});
	const names = [...items].sort();
	if (!wantMeta) { const out = { items: names }; if (wantText) out.text = text; return out; }
	const out = [];
	for (const name of names) {
		const child = prefix + "/" + name;
		const rec = await aqIdbReq(st.get(aqStorageKeyNs(namespace, child)));
		out.push({ name, meta: rec ? String(rec.m ?? "") : "" });
	}
	const result = { items: out };
	if (wantText) result.text = text;
	return result;
}

async function aqStorageRenameNs(namespace, rawFrom, rawTo) {
	const from = aqStorageNormalizeName(rawFrom);
	const to = aqStorageNormalizeName(rawTo);
	if (!from || !to) throw new Error("[AQ] storage: invalid rename");
	aqStorageValidateNewName(to);
	if (to === from || to.startsWith(from + "/")) throw new Error("[AQ] storage: invalid rename target");
	const db = await aqIdbOpen();
	const tx = db.transaction(aqStorageStoreName, "readwrite");
	const st = tx.objectStore(aqStorageStoreName);
	if (!(await aqStorageExistsNs(st, namespace, from))) throw new Error("[AQ] storage: source not found");
	await aqStorageAssertImmediateParentExistsNs(st, namespace, to);
	if (await aqStorageExistsNs(st, namespace, to)) throw new Error("[AQ] storage: target exists");
	const toWrite = [];
	const toDelete = [];
	const exactK = aqStorageKeyNs(namespace, from);
	const exact = await aqIdbReq(st.get(exactK));
	if (exact) { toWrite.push({ name: to, v: String(exact.v ?? ""), m: String(exact.m ?? "") }); toDelete.push(exactK); }
	const subPrefix = aqStorageKeyNs(namespace, from + "/");
	const range = IDBKeyRange.bound(subPrefix, subPrefix + "\uffff");
	await new Promise((resolve, reject) => {
		const cur = st.openCursor(range);
		cur.onerror = () => reject(cur.error);
		cur.onsuccess = () => {
			const c = cur.result;
			if (!c) return resolve();
			const fullKey = String(c.key);
			const namePart = fullKey.slice((namespace + "\n").length);
			const suffix = namePart.slice((from + "/").length);
			toWrite.push({ name: to + "/" + suffix, v: String((c.value && c.value.v) ?? ""), m: String((c.value && c.value.m) ?? "") });
			toDelete.push(c.primaryKey);
			c.continue();
		};
	});
	if (toWrite.length === 0) throw new Error("[AQ] storage: source not found");
	for (const it of toWrite) { await aqIdbReq(st.put({ k: aqStorageKeyNs(namespace, it.name), v: it.v, m: it.m })); }
	for (const k of toDelete) { await aqIdbReq(st.delete(k)); }
	await aqIdbCommit(tx);
	return { moved: toWrite.length };
}

// ---- DAO-scoped wrapper-ek (aktuális aqDaoNamespace-szel) ----

export async function aqStoragePut(rawName, patch)  { return await aqStoragePutNs(aqDaoNamespace, rawName, patch); }
export async function aqStorageGet(rawName)         { return await aqStorageGetNs(aqDaoNamespace, rawName); }
export async function aqStorageDelete(rawName)      { return await aqStorageDeleteNs(aqDaoNamespace, rawName); }
export async function aqStorageList(rawPrefix, opt) { return await aqStorageListNs(aqDaoNamespace, rawPrefix, opt); }
export async function aqStorageRename(rawFrom, rawTo) { return await aqStorageRenameNs(aqDaoNamespace, rawFrom, rawTo); }

// ---- Protokoll-szintű wrapper-ek (fix "_protocol" namespace) ----
// Csak a protokoll loader és a kapu DAO (aq.gate.protocolStorage* capability) hívja.

export async function aqProtocolStoragePut(rawName, patch)  { return await aqStoragePutNs(AQ_PROTOCOL_NS, rawName, patch); }
export async function aqProtocolStorageGet(rawName)         { return await aqStorageGetNs(AQ_PROTOCOL_NS, rawName); }
export async function aqProtocolStorageDelete(rawName)      { return await aqStorageDeleteNs(AQ_PROTOCOL_NS, rawName); }
export async function aqProtocolStorageList(rawPrefix, opt) { return await aqStorageListNs(AQ_PROTOCOL_NS, rawPrefix, opt); }
export async function aqProtocolStorageRename(rawFrom, rawTo) { return await aqStorageRenameNs(AQ_PROTOCOL_NS, rawFrom, rawTo); }
