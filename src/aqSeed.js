// aqSeed.js
// IndexedDB-alapú seed tárolás. Külön object store, egyetlen rekord.
// Csak a loader belső kódjából érhető el. A kapu DAO az aqGateApi.seed.{store,exists} capability-ken keresztül használja.

const DB_NAME = "aqSeed";
const DB_VERSION = 1;
const STORE_NAME = "seed";
const RECORD_KEY = "current";

let _dbPromise = null;

function openDb() {
	if (_dbPromise) return _dbPromise;
	_dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	return _dbPromise;
}

async function tx(mode, fn) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const t = db.transaction(STORE_NAME, mode);
		const store = t.objectStore(STORE_NAME);
		let result;
		try { result = fn(store); } catch (e) { reject(e); return; }
		t.oncomplete = () => resolve(result);
		t.onerror = () => reject(t.error);
		t.onabort = () => reject(t.error || new Error("[AQ] seed tx aborted"));
	});
}

function reqAsync(req) {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

// Van-e tárolt seed.
export async function seedExists() {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const t = db.transaction(STORE_NAME, "readonly");
		const store = t.objectStore(STORE_NAME);
		const req = store.getKey(RECORD_KEY);
		req.onsuccess = () => resolve(req.result !== undefined);
		req.onerror = () => reject(req.error);
	});
}

// Egyszeri seed mentés. Ha már van, hibázik.
export async function seedStore(record) {
	if (!record || typeof record !== "object") throw new Error("[AQ] seedStore: record must be object");

	// Egyszerű séma-ellenőrzés. Pontos mezők a seed-gen oldal felelőssége.
	const REQUIRED = ["version", "method", "salt", "ciphertext", "iv"];
	for (const f of REQUIRED) {
		if (record[f] === undefined) throw new Error("[AQ] seedStore: missing field: " + f);
	}
	if (record.method !== "webauthn-prf" && record.method !== "password") {
		throw new Error("[AQ] seedStore: invalid method: " + record.method);
	}
	if (record.method === "webauthn-prf" && !record.credentialId) {
		throw new Error("[AQ] seedStore: webauthn-prf requires credentialId");
	}

	if (await seedExists()) throw new Error("[AQ] seedStore: seed already exists");

	const stored = { ...record, storedAt: Date.now() };
	await tx("readwrite", (store) => store.put(stored, RECORD_KEY));
	return { stored: true };
}

// Belső használat (signing capability jövőbeni iterációjához).
// A kapu DAO NEM kapja meg ezt aqGateApi-n keresztül.
export async function seedGetInternal() {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const t = db.transaction(STORE_NAME, "readonly");
		const store = t.objectStore(STORE_NAME);
		const req = store.get(RECORD_KEY);
		req.onsuccess = () => resolve(req.result || null);
		req.onerror = () => reject(req.error);
	});
}
