// aqAssetRef.js
// Asset ref és cidBase parsing/validálás. 2-szintű refs séma, kötelező description lokálison.
// Remote ref: tokenName-mel hivatkozik a config tokens map-jére, ami contractName-en a contracts map-re mutat.

export const CID_RE = /^[0-9a-f]{64,128}$/i;
export const TOKEN_ID_RE = /^\d+$/;
export const CONTRACT_RE = /^0x[0-9a-fA-F]{40}$/;

export function validateRef(ref) {
	if (!ref) throw new Error("[AQ] empty ref");
	if (/[\r\n\t]/.test(ref)) throw new Error("[AQ] invalid ref: " + ref);
}

export function classifyRef(ref) {
	validateRef(ref);
	if (ref.startsWith("/")) return "path";
	if (/[\/\s?#]/.test(ref)) throw new Error("[AQ] invalid ref: " + ref);
	if (CID_RE.test(ref)) return "cid";
	if (TOKEN_ID_RE.test(ref)) return "tokenId";
	throw new Error("[AQ] invalid ref: " + ref);
}

export function normalizeCidBase(rawBase, devMode) {
	const base = String(rawBase ?? "").trim();
	if (!base) throw new Error("[AQ] missing cidBase");
	if (base !== String(rawBase ?? "")) throw new Error("[AQ] cidBase must be trimmed");
	if (/[\r\n\t]/.test(base)) throw new Error("[AQ] invalid cidBase");
	let baseUrl;
	try { baseUrl = new URL(base); }
	catch { throw new Error("[AQ] invalid cidBase URL: " + base); }
	if (!devMode && baseUrl.protocol !== "https:") throw new Error("[AQ] cidBase must be https");
	return base.endsWith("/") ? base : base + "/";
}

function isObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isRemoteRef(value) {
	if (!isObject(value)) return false;
	return typeof value.tokenName === "string";
}

export function isLocalRefObject(value) {
	if (!isObject(value)) return false;
	return typeof value.cid === "string" || typeof value.path === "string";
}

export function validateDescription(value) {
	if (typeof value !== "string") throw new Error("[AQ] description must be string");
	if (value.length === 0) throw new Error("[AQ] description must be non-empty");
	if (/[\r\t]/.test(value)) throw new Error("[AQ] description: \\r and \\t not allowed");
	// eslint-disable-next-line no-control-regex
	if (/[\x00-\x08\x0B-\x1F]/.test(value)) throw new Error("[AQ] description: control characters not allowed");
	return true;
}

export function validateLocalRef(value, devMode) {
	if (!isObject(value)) throw new Error("[AQ] local ref must be object");
	const hasCid = typeof value.cid === "string";
	const hasPath = typeof value.path === "string";
	if (hasCid && hasPath) throw new Error("[AQ] local ref: cid and path are mutually exclusive");
	if (!hasCid && !hasPath) throw new Error("[AQ] local ref: cid or path required");
	if (typeof value.description !== "string") throw new Error("[AQ] local ref: description required");
	validateDescription(value.description);
	if (hasCid) {
		validateRef(value.cid);
		if (!CID_RE.test(value.cid)) throw new Error("[AQ] local ref: invalid cid");
		return "local-cid";
	}
	if (!devMode) throw new Error("[AQ] local ref: path not allowed (non-devMode)");
	validateRef(value.path);
	if (!value.path.startsWith("/")) throw new Error("[AQ] local ref: path must start with /");
	return "local-path";
}

// Távoli ref leaf validálás.
// Forma: {tokenName}. contract, contractName, rpc, tokenId, description TILOS a leaf-ban.
// A tokenName eager check: a saját config `tokens` map-jében léteznie kell.
export function validateRemoteRef(value, tokens) {
	if (!isObject(value)) throw new Error("[AQ] remote ref must be object");
	if (typeof value.tokenName !== "string" || !value.tokenName)
		throw new Error("[AQ] remote ref: tokenName must be non-empty string");
	if (value.contract !== undefined) throw new Error("[AQ] remote ref: contract not allowed (use tokenName)");
	if (value.contractName !== undefined) throw new Error("[AQ] remote ref: contractName not allowed (use tokenName)");
	if (value.tokenId !== undefined) throw new Error("[AQ] remote ref: tokenId not allowed (use tokenName)");
	if (value.rpc !== undefined) throw new Error("[AQ] remote ref: rpc not allowed (use tokens.<name>)");
	if (value.description !== undefined) throw new Error("[AQ] remote ref: description not allowed");
	if (!tokens || typeof tokens !== "object") throw new Error("[AQ] remote ref: tokens map missing in config");
	if (!(value.tokenName in tokens)) throw new Error("[AQ] remote ref: tokenName not in tokens: " + value.tokenName);
	return true;
}

// Egységes refs leaf validálás.
// `tokens` paraméter a hívó config `tokens` map-je (remote ref esetén kötelező).
export function validateRefsLeaf(value, devMode, tokens) {
	if (isRemoteRef(value)) {
		validateRemoteRef(value, tokens);
		return "remote";
	}
	if (isLocalRefObject(value)) {
		return validateLocalRef(value, devMode);
	}
	throw new Error("[AQ] refs leaf: must be local object (cid|path + description) or remote object (tokenName)");
}

// Contracts map validálása.
// Forma: { <name>: { address, rpc?, description } }
export function validateContracts(contracts, devMode) {
	if (contracts === undefined) return true;
	if (!isObject(contracts)) throw new Error("[AQ] contracts must be object");
	for (const name of Object.keys(contracts)) {
		validateRefName(name);
		const entry = contracts[name];
		if (!isObject(entry)) throw new Error("[AQ] contracts." + name + " must be object");
		if (typeof entry.address !== "string" || !CONTRACT_RE.test(entry.address))
			throw new Error("[AQ] contracts." + name + ".address must be valid contract address");
		if (typeof entry.description !== "string") throw new Error("[AQ] contracts." + name + ".description required");
		validateDescription(entry.description);
		if (entry.rpc !== undefined) {
			if (typeof entry.rpc !== "string" || !entry.rpc)
				throw new Error("[AQ] contracts." + name + ".rpc must be non-empty string");
			let u;
			try { u = new URL(entry.rpc); }
			catch { throw new Error("[AQ] contracts." + name + ".rpc invalid URL"); }
			if (!devMode && u.protocol !== "https:") throw new Error("[AQ] contracts." + name + ".rpc must be https");
		}
	}
	return true;
}

// Tokens map validálása.
// Forma: { <name>: { contractName, tokenId, description } }
// contractName eager check: a saját config `contracts` map-jében léteznie kell.
export function validateTokens(tokens, contracts) {
	if (tokens === undefined) return true;
	if (!isObject(tokens)) throw new Error("[AQ] tokens must be object");
	for (const name of Object.keys(tokens)) {
		validateRefName(name);
		const entry = tokens[name];
		if (!isObject(entry)) throw new Error("[AQ] tokens." + name + " must be object");
		if (typeof entry.contractName !== "string" || !entry.contractName)
			throw new Error("[AQ] tokens." + name + ".contractName must be non-empty string");
		if (typeof entry.tokenId !== "string" || !TOKEN_ID_RE.test(entry.tokenId))
			throw new Error("[AQ] tokens." + name + ".tokenId must be string of digits");
		if (typeof entry.description !== "string") throw new Error("[AQ] tokens." + name + ".description required");
		validateDescription(entry.description);
		if (!contracts || typeof contracts !== "object")
			throw new Error("[AQ] tokens." + name + ".contractName not resolvable (no contracts map)");
		if (!(entry.contractName in contracts))
			throw new Error("[AQ] tokens." + name + ".contractName not in contracts: " + entry.contractName);
	}
	return true;
}

export function validateRefName(name) {
	if (typeof name !== "string" || !name) throw new Error("[AQ] ref name must be non-empty string");
	if (!/^[a-zA-Z0-9._-]+$/.test(name)) throw new Error("[AQ] invalid ref name: " + name);
	if (name === "." || name === "..") throw new Error("[AQ] invalid ref name: " + name);
	return true;
}

export function validateRefPath(value) {
	if (typeof value !== "string" || !value) throw new Error("[AQ] ref path must be non-empty string");
	const parts = value.split(".");
	if (parts.length !== 2) throw new Error("[AQ] ref path must have exactly 2 segments: " + value);
	const [sub, name] = parts;
	validateRefName(sub);
	validateRefName(name);
	return { sub, name };
}

export function validateResolvedRef(value, devMode) {
	if (!isObject(value)) throw new Error("[AQ] resolved ref must be object");
	if (typeof value.cid !== "string" || !CID_RE.test(value.cid))
		throw new Error("[AQ] resolved ref: invalid cid");
	if (value.cidBase !== undefined) {
		if (typeof value.cidBase !== "string" || !value.cidBase)
			throw new Error("[AQ] resolved ref: cidBase must be non-empty string");
	}
	return true;
}

export function validateFetchInput(value, devMode) {
	if (typeof value === "string") {
		validateRef(value);
		if (value.startsWith("/")) {
			if (!devMode) throw new Error("[AQ] fetch input: path not allowed (non-devMode)");
			return "local-path";
		}
		if (/[\/\s?#]/.test(value)) throw new Error("[AQ] fetch input: invalid string");
		if (CID_RE.test(value)) return "local-cid";
		if (TOKEN_ID_RE.test(value)) throw new Error("[AQ] fetch input: tokenId not allowed");
		throw new Error("[AQ] fetch input: invalid string");
	}
	validateResolvedRef(value, devMode);
	return "resolved";
}
