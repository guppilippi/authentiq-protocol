// aqKeyring.js
// Seed tárolás + unlock + wallet deriváció + wallet store.
// Kapu DAO az aqGateApi.seed.* és aqGateApi.wallet.* capability-ken keresztül éri el.

import { devMode, isPwa } from "./aqEnv.js";
import { HDNodeWallet } from "ethers";
import { aqProtocolStorageGet, aqProtocolStoragePut } from "./aqStorage.js";

// ---------------------------------------------------------------------------
// Seed IndexedDB

const DB_NAME    = "aqSeed";
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
			if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror  = () => reject(req.error);
	});
	return _dbPromise;
}

async function seedTx(mode, fn) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const t     = db.transaction(STORE_NAME, mode);
		const store = t.objectStore(STORE_NAME);
		let result;
		try { result = fn(store); } catch (e) { reject(e); return; }
		t.oncomplete = () => resolve(result);
		t.onerror    = () => reject(t.error);
		t.onabort    = () => reject(t.error || new Error("[AQ] seed tx aborted"));
	});
}

export async function seedExists() {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const t   = db.transaction(STORE_NAME, "readonly");
		const req = t.objectStore(STORE_NAME).getKey(RECORD_KEY);
		req.onsuccess = () => resolve(req.result !== undefined);
		req.onerror   = () => reject(req.error);
	});
}

export async function seedStore(record) {
	if (!record || typeof record !== "object") throw new Error("[AQ] seedStore: record must be object");
	const REQUIRED = ["version", "method", "salt", "ciphertext", "iv"];
	for (const f of REQUIRED) {
		if (record[f] === undefined) throw new Error("[AQ] seedStore: missing field: " + f);
	}
	if (record.method !== "webauthn-prf" && record.method !== "password")
		throw new Error("[AQ] seedStore: invalid method: " + record.method);
	if (record.method === "webauthn-prf" && !record.credentialId)
		throw new Error("[AQ] seedStore: webauthn-prf requires credentialId");
	if (await seedExists()) throw new Error("[AQ] seedStore: seed already exists");
	await seedTx("readwrite", (store) => store.add({ ...record, storedAt: Date.now() }, RECORD_KEY));
	return { stored: true };
}

async function seedGetInternal() {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const t   = db.transaction(STORE_NAME, "readonly");
		const req = t.objectStore(STORE_NAME).get(RECORD_KEY);
		req.onsuccess = () => resolve(req.result || null);
		req.onerror   = () => reject(req.error);
	});
}

// ---------------------------------------------------------------------------
// Seed decrypt + unlock

let _unlockedSeed = null;

function b64decode(s) {
	return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

async function decryptRecord(record, password) {
	const iv         = b64decode(record.iv);
	const ciphertext = b64decode(record.ciphertext);

	if (record.method === "webauthn-prf") {
		const assertion = await navigator.credentials.get({
			publicKey: {
				challenge:        crypto.getRandomValues(new Uint8Array(32)),
				allowCredentials: [{ type: "public-key", id: b64decode(record.credentialId) }],
				userVerification: "required",
				extensions:       { prf: { eval: { first: b64decode(record.salt) } } },
			},
		});
		const prfResult = assertion?.getClientExtensionResults?.()?.prf?.results?.first;
		if (!prfResult || prfResult.byteLength < 32) throw new Error("[AQ] seedUnlock: PRF result missing");
		const key = await crypto.subtle.importKey("raw", new Uint8Array(prfResult), { name: "AES-GCM" }, false, ["decrypt"]);
		return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext));
	}

	if (record.method === "password") {
		if (!password) throw new Error("[AQ] seedUnlock: password required");
		const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
		const key     = await crypto.subtle.deriveKey(
			{ name: "PBKDF2", salt: b64decode(record.salt), iterations: 600000, hash: "SHA-256" },
			baseKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"],
		);
		return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext));
	}

	throw new Error("[AQ] seedUnlock: unknown method: " + record.method);
}

export async function seedUnlock(password) {
	if (_unlockedSeed) return;
	const record = await seedGetInternal();
	if (!record) throw new Error("[AQ] seedUnlock: no seed stored");
	_unlockedSeed = await decryptRecord(record, password);
}

export function seedActivate(rawBytes) {
	if (!(rawBytes instanceof Uint8Array)) throw new Error("[AQ] seedActivate: Uint8Array required");
	_unlockedSeed = rawBytes;
}

export function seedGetRaw() {
	if (!isPwa && !devMode) throw new Error("[AQ] seedGetRaw: not allowed outside PWA or devMode");
	if (!_unlockedSeed) throw new Error("[AQ] seedGetRaw: seed not unlocked");
	return _unlockedSeed;
}

export function isSeedUnlocked() {
	return _unlockedSeed !== null;
}

// ---------------------------------------------------------------------------
// Wallet deriváció

const bip44Path = (index) => `m/44'/60'/0'/0/${index}`;

export function fromRawSeed(seedBytes, index) {
	const w = HDNodeWallet.fromSeed(seedBytes).derivePath(bip44Path(index));
	return { address: w.address, sign: (msg) => w.signMessage(msg) };
}

export function fromMnemonic(phrase, index) {
	const w = HDNodeWallet.fromPhrase(phrase, undefined, bip44Path(index));
	return { address: w.address, sign: (msg) => w.signMessage(msg) };
}

// ---------------------------------------------------------------------------
// Wallet definíciók + store

export const WALLET_DEFS = Object.freeze({
	web2Devel:  { index: 1000 },
	gateWriter: { range: [100_000, 9_999_999], mode: "sticky"  },
	mintOp:     { start: 10_000_000,           mode: "oneshot" },
});

const BIP32_MAX = 0x7FFFFFFF;

async function readWalletRecord(key) {
	const rec = await aqProtocolStorageGet("wallet." + key);
	if (!rec) return null;
	try { return JSON.parse(rec.text); } catch { return null; }
}

async function writeWalletRecord(key, data) {
	await aqProtocolStoragePut("wallet." + key, { text: JSON.stringify(data) });
}

async function resolveIndex(key, def) {
	if (def.index !== undefined) return def.index;

	if (def.mode === "sticky") {
		const rec = await readWalletRecord(key);
		if (rec?.index !== undefined) return rec.index;
		const [min, max] = def.range;
		return min + Math.floor(Math.random() * (max - min + 1));
	}

	if (def.mode === "oneshot") {
		const rec     = await readWalletRecord(key);
		const counter = rec?.counter ?? 0;
		const next    = counter + 1 > BIP32_MAX - def.start ? 0 : counter + 1;
		await writeWalletRecord(key, { counter: next });
		return def.start + counter;
	}
}

export async function getWallet(key, seedInput) {
	const def    = WALLET_DEFS[key];
	const index  = await resolveIndex(key, def);
	const wallet = seedInput instanceof Uint8Array ? fromRawSeed(seedInput, index) : fromMnemonic(seedInput, index);
	if (!def.mode || def.mode === "sticky")
		await writeWalletRecord(key, { index, address: wallet.address });
	return wallet;
}

export async function getAddress(key) {
	const rec = await readWalletRecord(key);
	return rec?.address ?? null;
}

// Wallet címek megjelenítéshez. Fix wallet-eknél seed-ből derivál, sticky-nél IndexedDB-ből olvas.
// Nem igényel PWA kontextust — a cím nem érzékeny adat.
export async function getWalletAddresses() {
	if (!_unlockedSeed) throw new Error("[AQ] getWalletAddresses: seed not unlocked");
	const result = {};
	for (const [key, def] of Object.entries(WALLET_DEFS)) {
		if (def.index !== undefined) {
			result[key] = fromRawSeed(_unlockedSeed, def.index).address;
		} else if (def.mode === "sticky") {
			result[key] = await getAddress(key);
		}
	}
	return result;
}
