"use strict";
(() => {
  // src/aqEnv.js
  if (top !== self) throw new Error("[AQ] embedded not allowed");
  var hostOrigin = location.origin;
  if (!hostOrigin || hostOrigin === "null") throw new Error("[AQ] invalid host origin: " + hostOrigin);
  var hn = (location.hostname || "").toLowerCase();
  var devMode = hn === "localhost" || hn === "127.0.0.1" || hn === "::1";

  // src/aqConfig.js
  if (!window.aqProtocolPageConf) throw new Error("[AQ] missing aqProtocolPageConf");
  var conf = window.aqProtocolPageConf;
  try {
    delete window.aqProtocolPageConf;
  } catch {
    try {
      window.aqProtocolPageConf = void 0;
    } catch {
    }
  }

  // src/aqRpcConfig.js
  var DEFAULT_RPC_URLS = [
    "https://rpc.gnosischain.com",
    "https://gnosis-rpc.publicnode.com",
    "https://rpc.gnosis.gateway.fm"
  ];
  function parseRpcConfig(rpcRaw, devMode2) {
    if (rpcRaw === void 0 || rpcRaw === null || rpcRaw === "") return DEFAULT_RPC_URLS;
    if (typeof rpcRaw !== "string") throw new Error("[AQ] rpc must be string");
    if (rpcRaw.trim() !== rpcRaw) throw new Error("[AQ] rpc must be trimmed");
    if (/[\r\n\t]/.test(rpcRaw)) throw new Error("[AQ] invalid rpc");
    let url;
    try {
      url = new URL(rpcRaw);
    } catch {
      throw new Error("[AQ] invalid rpc URL: " + rpcRaw);
    }
    if (!devMode2 && url.protocol !== "https:") throw new Error("[AQ] rpc must be https");
    return [rpcRaw];
  }

  // src/aqAssetRef.js
  var CID_RE = /^[0-9a-f]{64,128}$/i;
  var TOKEN_ID_RE = /^\d+$/;
  var CONTRACT_RE = /^0x[0-9a-fA-F]{40}$/;
  function validateRef(ref) {
    if (!ref) throw new Error("[AQ] empty ref");
    if (/[\r\n\t]/.test(ref)) throw new Error("[AQ] invalid ref: " + ref);
  }
  function normalizeCidBase(rawBase, devMode2) {
    const base = String(rawBase ?? "").trim();
    if (!base) throw new Error("[AQ] missing cidBase");
    if (base !== String(rawBase ?? "")) throw new Error("[AQ] cidBase must be trimmed");
    if (/[\r\n\t]/.test(base)) throw new Error("[AQ] invalid cidBase");
    let baseUrl;
    try {
      baseUrl = new URL(base);
    } catch {
      throw new Error("[AQ] invalid cidBase URL: " + base);
    }
    if (!devMode2 && baseUrl.protocol !== "https:") throw new Error("[AQ] cidBase must be https");
    return base.endsWith("/") ? base : base + "/";
  }
  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function isRemoteRef(value) {
    if (!isObject(value)) return false;
    return typeof value.tokenName === "string";
  }
  function isLocalRefObject(value) {
    if (!isObject(value)) return false;
    return typeof value.cid === "string" || typeof value.path === "string";
  }
  function validateDescription(value) {
    if (typeof value !== "string") throw new Error("[AQ] description must be string");
    if (value.length === 0) throw new Error("[AQ] description must be non-empty");
    if (/[\r\t]/.test(value)) throw new Error("[AQ] description: \\r and \\t not allowed");
    if (/[\x00-\x08\x0B-\x1F]/.test(value)) throw new Error("[AQ] description: control characters not allowed");
    return true;
  }
  function validateLocalRef(value, devMode2) {
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
    if (!devMode2) throw new Error("[AQ] local ref: path not allowed (non-devMode)");
    validateRef(value.path);
    if (!value.path.startsWith("/")) throw new Error("[AQ] local ref: path must start with /");
    return "local-path";
  }
  function validateRemoteRef(value, tokens) {
    if (!isObject(value)) throw new Error("[AQ] remote ref must be object");
    if (typeof value.tokenName !== "string" || !value.tokenName)
      throw new Error("[AQ] remote ref: tokenName must be non-empty string");
    if (value.contract !== void 0) throw new Error("[AQ] remote ref: contract not allowed (use tokenName)");
    if (value.contractName !== void 0) throw new Error("[AQ] remote ref: contractName not allowed (use tokenName)");
    if (value.tokenId !== void 0) throw new Error("[AQ] remote ref: tokenId not allowed (use tokenName)");
    if (value.rpc !== void 0) throw new Error("[AQ] remote ref: rpc not allowed (use tokens.<name>)");
    if (value.description !== void 0) throw new Error("[AQ] remote ref: description not allowed");
    if (!tokens || typeof tokens !== "object") throw new Error("[AQ] remote ref: tokens map missing in config");
    if (!(value.tokenName in tokens)) throw new Error("[AQ] remote ref: tokenName not in tokens: " + value.tokenName);
    return true;
  }
  function validateRefsLeaf(value, devMode2, tokens) {
    if (isRemoteRef(value)) {
      validateRemoteRef(value, tokens);
      return "remote";
    }
    if (isLocalRefObject(value)) {
      return validateLocalRef(value, devMode2);
    }
    throw new Error("[AQ] refs leaf: must be local object (cid|path + description) or remote object (tokenName)");
  }
  function validateContracts(contracts, devMode2) {
    if (contracts === void 0) return true;
    if (!isObject(contracts)) throw new Error("[AQ] contracts must be object");
    for (const name of Object.keys(contracts)) {
      validateRefName(name);
      const entry = contracts[name];
      if (!isObject(entry)) throw new Error("[AQ] contracts." + name + " must be object");
      if (typeof entry.address !== "string" || !CONTRACT_RE.test(entry.address))
        throw new Error("[AQ] contracts." + name + ".address must be valid contract address");
      if (typeof entry.description !== "string") throw new Error("[AQ] contracts." + name + ".description required");
      validateDescription(entry.description);
      if (entry.rpc !== void 0) {
        if (typeof entry.rpc !== "string" || !entry.rpc)
          throw new Error("[AQ] contracts." + name + ".rpc must be non-empty string");
        let u;
        try {
          u = new URL(entry.rpc);
        } catch {
          throw new Error("[AQ] contracts." + name + ".rpc invalid URL");
        }
        if (!devMode2 && u.protocol !== "https:") throw new Error("[AQ] contracts." + name + ".rpc must be https");
      }
    }
    return true;
  }
  function validateTokens(tokens, contracts) {
    if (tokens === void 0) return true;
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
  function validateRefName(name) {
    if (typeof name !== "string" || !name) throw new Error("[AQ] ref name must be non-empty string");
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) throw new Error("[AQ] invalid ref name: " + name);
    if (name === "." || name === "..") throw new Error("[AQ] invalid ref name: " + name);
    return true;
  }
  function validateRefPath(value) {
    if (typeof value !== "string" || !value) throw new Error("[AQ] ref path must be non-empty string");
    const parts = value.split(".");
    if (parts.length !== 2) throw new Error("[AQ] ref path must have exactly 2 segments: " + value);
    const [sub, name] = parts;
    validateRefName(sub);
    validateRefName(name);
    return { sub, name };
  }
  function validateResolvedRef(value, devMode2) {
    if (!isObject(value)) throw new Error("[AQ] resolved ref must be object");
    if (typeof value.cid !== "string" || !CID_RE.test(value.cid))
      throw new Error("[AQ] resolved ref: invalid cid");
    if (value.cidBase !== void 0) {
      if (typeof value.cidBase !== "string" || !value.cidBase)
        throw new Error("[AQ] resolved ref: cidBase must be non-empty string");
    }
    return true;
  }
  function validateFetchInput(value, devMode2) {
    if (typeof value === "string") {
      validateRef(value);
      if (value.startsWith("/")) {
        if (!devMode2) throw new Error("[AQ] fetch input: path not allowed (non-devMode)");
        return "local-path";
      }
      if (/[\/\s?#]/.test(value)) throw new Error("[AQ] fetch input: invalid string");
      if (CID_RE.test(value)) return "local-cid";
      if (TOKEN_ID_RE.test(value)) throw new Error("[AQ] fetch input: tokenId not allowed");
      throw new Error("[AQ] fetch input: invalid string");
    }
    validateResolvedRef(value, devMode2);
    return "resolved";
  }

  // src/aqFetch.js
  async function fetchPath(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`[AQ] fetch failed ${r.status} ${url}`);
    return r;
  }
  async function fetchCid(url) {
    const r = await fetch(url, { cache: "force-cache" });
    if (!r.ok) throw new Error(`[AQ] fetch failed ${r.status} ${url}`);
    return r;
  }

  // src/aqAssetFetch.js
  var aqCidBase = "";
  var setAqCidBase = (base) => {
    aqCidBase = base;
  };
  var getAqCidBase = () => aqCidBase;
  var aqRpcUrls = null;
  var setAqRpcUrls = (urls) => {
    aqRpcUrls = urls;
  };
  async function fetchByCid(cid, cidBaseRaw) {
    const base = normalizeCidBase(cidBaseRaw, devMode);
    return await fetchCid(base + cid.toLowerCase());
  }
  async function fetchAssetBytes(assetRef) {
    if (isLocalRefObject(assetRef)) {
      let r2;
      if (typeof assetRef.cid === "string") {
        r2 = await fetchByCid(assetRef.cid, aqCidBase);
      } else {
        if (!devMode) throw new Error("[AQ] local path not allowed: " + assetRef.path);
        r2 = await fetchPath(assetRef.path);
      }
      return await r2.arrayBuffer();
    }
    if (typeof assetRef === "object" && assetRef !== null && typeof assetRef.cid === "string" && !isRemoteRef(assetRef)) {
      const r2 = await fetchByCid(assetRef.cid, assetRef.cidBase ?? aqCidBase);
      return await r2.arrayBuffer();
    }
    const ref = String(assetRef ?? "").trim();
    if (!ref) throw new Error("[AQ] empty ref");
    if (/[\r\n\t]/.test(ref)) throw new Error("[AQ] invalid ref: " + ref);
    let r;
    if (ref.startsWith("/")) {
      if (!devMode) throw new Error("[AQ] local path not allowed: " + ref);
      r = await fetchPath(ref);
    } else if (CID_RE.test(ref)) {
      r = await fetchByCid(ref, aqCidBase);
    } else {
      throw new Error("[AQ] fetchAssetBytes: invalid string ref: " + ref);
    }
    return await r.arrayBuffer();
  }
  async function fetchAssetText(asset) {
    if (!asset) return "";
    const bytes = await fetchAssetBytes(asset);
    return new TextDecoder("utf-8").decode(bytes);
  }
  async function fetchAssetJSON(asset) {
    const text = await fetchAssetText(asset);
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error("[AQ] invalid JSON: " + (e?.message || e));
    }
  }

  // src/aqStorage.js
  var aqProtocolDbName = "aqProtocol";
  var aqStorageStoreName = "aqStorage";
  var aqStorageAllowedChars = ` _-.,:;@#()[]'"+=!?`;
  var AQ_PROTOCOL_NS = "_protocol";
  var aqDaoNamespace = "";
  var setAqDaoNamespace = (ns) => {
    aqDaoNamespace = ns;
  };
  var aqIdbPromise = null;
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
  function aqIdbCommit(tx2) {
    return new Promise((resolve, reject) => {
      tx2.oncomplete = resolve;
      tx2.onerror = () => reject(tx2.error || new Error("[AQ] idb tx failed"));
      tx2.onabort = () => reject(tx2.error || new Error("[AQ] idb tx aborted"));
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
      if (/[\p{L}\p{N}]/u.test(ch)) {
        if (i >= leafStart) leafHasAlnum = true;
        continue;
      }
      if (aqStorageAllowedChars.includes(ch)) continue;
      throw new Error("[AQ] storage: invalid character");
    }
    if (!leafHasAlnum) throw new Error("[AQ] storage: leaf must contain letter or number");
    return true;
  }
  function aqStorageParent(name) {
    const i = name.lastIndexOf("/");
    return i >= 0 ? name.slice(0, i) : "";
  }
  function aqStorageKeyNs(namespace, name) {
    return namespace + "\n" + name;
  }
  async function aqStorageGetExactNs(st, namespace, name) {
    return await aqIdbReq(st.get(aqStorageKeyNs(namespace, name)));
  }
  function aqRecText(rec) {
    return rec ? String(rec.v ?? "") : "";
  }
  function aqRecMeta(rec) {
    return rec ? String(rec.m ?? "") : "";
  }
  async function aqStorageExistsNs(st, namespace, name) {
    const rec = await aqIdbReq(st.get(aqStorageKeyNs(namespace, name)));
    return !!rec;
  }
  async function aqStorageAssertImmediateParentExistsNs(st, namespace, name) {
    const parent = aqStorageParent(name);
    if (!parent) return;
    if (!await aqStorageExistsNs(st, namespace, parent)) throw new Error("[AQ] storage: missing parent prefix");
  }
  async function aqStoragePutNs(namespace, rawName, patch) {
    const name = aqStorageNormalizeName(rawName);
    if (!patch || typeof patch !== "object") throw new Error("[AQ] storage: invalid put payload");
    const hasText = Object.prototype.hasOwnProperty.call(patch, "text");
    const hasMeta = Object.prototype.hasOwnProperty.call(patch, "meta");
    if (!hasText && !hasMeta) throw new Error("[AQ] storage: invalid put payload");
    if (name === "" && hasText) throw new Error("[AQ] storage: root text not writable");
    if (name !== "") aqStorageValidateNewName(name);
    const db = await aqIdbOpen();
    const tx2 = db.transaction(aqStorageStoreName, "readwrite");
    const st = tx2.objectStore(aqStorageStoreName);
    if (name !== "") await aqStorageAssertImmediateParentExistsNs(st, namespace, name);
    const prev = await aqStorageGetExactNs(st, namespace, name);
    const nextV = hasText ? String(patch.text ?? "") : aqRecText(prev);
    const nextM = hasMeta ? String(patch.meta ?? "") : aqRecMeta(prev);
    await aqIdbReq(st.put({ k: aqStorageKeyNs(namespace, name), v: nextV, m: nextM }));
    await aqIdbCommit(tx2);
    return true;
  }
  async function aqStorageGetNs(namespace, rawName) {
    const name = aqStorageNormalizeName(rawName);
    const db = await aqIdbOpen();
    const tx2 = db.transaction(aqStorageStoreName, "readonly");
    const st = tx2.objectStore(aqStorageStoreName);
    const rec = await aqStorageGetExactNs(st, namespace, name);
    if (name === "") return { text: "", meta: aqRecMeta(rec) };
    if (!rec) return null;
    return { text: aqRecText(rec), meta: aqRecMeta(rec) };
  }
  async function aqStorageDeleteNs(namespace, rawName) {
    const name = aqStorageNormalizeName(rawName);
    const db = await aqIdbOpen();
    const tx2 = db.transaction(aqStorageStoreName, "readwrite");
    const st = tx2.objectStore(aqStorageStoreName);
    let deleted = 0;
    let range;
    if (name === "") {
      const nsPrefix = namespace + "\n";
      range = IDBKeyRange.bound(nsPrefix, nsPrefix + "\uFFFF");
    } else {
      const exactK = aqStorageKeyNs(namespace, name);
      const exact = await aqIdbReq(st.get(exactK));
      if (exact) {
        await aqIdbReq(st.delete(exactK));
        deleted++;
      }
      const subPrefix = aqStorageKeyNs(namespace, name + "/");
      range = IDBKeyRange.bound(subPrefix, subPrefix + "\uFFFF");
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
    await aqIdbCommit(tx2);
    return { deleted };
  }
  async function aqStorageListNs(namespace, rawPrefix, options) {
    const prefix = aqStorageNormalizeName(rawPrefix);
    const wantMeta = !options || options.meta !== false;
    const wantText = !!(options && options.text === true);
    const db = await aqIdbOpen();
    const tx2 = db.transaction(aqStorageStoreName, "readonly");
    const st = tx2.objectStore(aqStorageStoreName);
    const nsPrefix = namespace + "\n";
    const items = /* @__PURE__ */ new Set();
    if (!prefix) {
      const range2 = IDBKeyRange.bound(nsPrefix, nsPrefix + "\uFFFF");
      const rootText = wantText ? "" : void 0;
      await new Promise((resolve, reject) => {
        const cur = st.openCursor(range2);
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
      const names2 = [...items].sort();
      if (!wantMeta) {
        const out3 = { items: names2 };
        if (wantText) out3.text = rootText;
        return out3;
      }
      const out2 = [];
      for (const name of names2) {
        const rec = await aqIdbReq(st.get(aqStorageKeyNs(namespace, name)));
        out2.push({ name, meta: rec ? String(rec.m ?? "") : "" });
      }
      const result2 = { items: out2 };
      if (wantText) result2.text = rootText;
      return result2;
    }
    let text;
    if (wantText) {
      const rec = await aqIdbReq(st.get(aqStorageKeyNs(namespace, prefix)));
      text = rec ? String(rec.v ?? "") : "";
    }
    const subPrefix = aqStorageKeyNs(namespace, prefix + "/");
    const range = IDBKeyRange.bound(subPrefix, subPrefix + "\uFFFF");
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
    if (!wantMeta) {
      const out2 = { items: names };
      if (wantText) out2.text = text;
      return out2;
    }
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
    const tx2 = db.transaction(aqStorageStoreName, "readwrite");
    const st = tx2.objectStore(aqStorageStoreName);
    if (!await aqStorageExistsNs(st, namespace, from)) throw new Error("[AQ] storage: source not found");
    await aqStorageAssertImmediateParentExistsNs(st, namespace, to);
    if (await aqStorageExistsNs(st, namespace, to)) throw new Error("[AQ] storage: target exists");
    const toWrite = [];
    const toDelete = [];
    const exactK = aqStorageKeyNs(namespace, from);
    const exact = await aqIdbReq(st.get(exactK));
    if (exact) {
      toWrite.push({ name: to, v: String(exact.v ?? ""), m: String(exact.m ?? "") });
      toDelete.push(exactK);
    }
    const subPrefix = aqStorageKeyNs(namespace, from + "/");
    const range = IDBKeyRange.bound(subPrefix, subPrefix + "\uFFFF");
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
    for (const it of toWrite) {
      await aqIdbReq(st.put({ k: aqStorageKeyNs(namespace, it.name), v: it.v, m: it.m }));
    }
    for (const k of toDelete) {
      await aqIdbReq(st.delete(k));
    }
    await aqIdbCommit(tx2);
    return { moved: toWrite.length };
  }
  async function aqStoragePut(rawName, patch) {
    return await aqStoragePutNs(aqDaoNamespace, rawName, patch);
  }
  async function aqStorageGet(rawName) {
    return await aqStorageGetNs(aqDaoNamespace, rawName);
  }
  async function aqStorageDelete(rawName) {
    return await aqStorageDeleteNs(aqDaoNamespace, rawName);
  }
  async function aqStorageList(rawPrefix, opt) {
    return await aqStorageListNs(aqDaoNamespace, rawPrefix, opt);
  }
  async function aqStorageRename(rawFrom, rawTo) {
    return await aqStorageRenameNs(aqDaoNamespace, rawFrom, rawTo);
  }
  async function aqProtocolStoragePut(rawName, patch) {
    return await aqStoragePutNs(AQ_PROTOCOL_NS, rawName, patch);
  }
  async function aqProtocolStorageGet(rawName) {
    return await aqStorageGetNs(AQ_PROTOCOL_NS, rawName);
  }
  async function aqProtocolStorageDelete(rawName) {
    return await aqStorageDeleteNs(AQ_PROTOCOL_NS, rawName);
  }
  async function aqProtocolStorageList(rawPrefix, opt) {
    return await aqStorageListNs(AQ_PROTOCOL_NS, rawPrefix, opt);
  }
  async function aqProtocolStorageRename(rawFrom, rawTo) {
    return await aqStorageRenameNs(AQ_PROTOCOL_NS, rawFrom, rawTo);
  }

  // src/aqIframe.js
  function randomHex(nBytes) {
    const a = new Uint8Array(nBytes);
    crypto.getRandomValues(a);
    return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  var iframe = document.createElement("iframe");
  iframe.src = "about:blank";
  var sandboxFlags = "allow-scripts allow-downloads";
  iframe.setAttribute("sandbox", sandboxFlags);
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  document.documentElement.style.height = "100%";
  document.body.style.height = "100%";
  document.body.style.margin = "0";
  document.body.appendChild(iframe);
  var overlayEl = document.createElement("div");
  overlayEl.style.cssText = "position:fixed;inset:0;display:none;background:rgba(0,0,0,0);z-index:999999;pointer-events:auto";
  document.body.appendChild(overlayEl);
  var _overlayTimer = null;
  function overlayShowLocked(getLocked) {
    overlayEl.style.display = "block";
    overlayEl.style.background = "rgba(0,0,0,0)";
    if (_overlayTimer) {
      clearTimeout(_overlayTimer);
      _overlayTimer = null;
    }
    _overlayTimer = setTimeout(() => {
      _overlayTimer = null;
      if (!getLocked()) return;
      overlayEl.style.background = "rgba(0,0,0,.35)";
    }, 150);
  }
  function overlayHide() {
    if (_overlayTimer) {
      clearTimeout(_overlayTimer);
      _overlayTimer = null;
    }
    overlayEl.style.display = "none";
  }

  // src/aqPageTemplate.js
  function buildIframeDoc({ html, css, js, token, hostOrigin: hostOrigin2 }) {
    return `<!doctype html>
<html>
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width,initial-scale=1" />
	<style>${css || ""}</style>
</head>
<body>
${html || ""}
<script type="text/plain" id="AQ_PAGE_JS">${(js || "").replace(/<\/script/gi, "<\\/script")}<\/script>
<script>
"use strict";
const AQ_TOKEN = ${JSON.stringify(token)};
const AQ_HOST_ORIGIN = ${JSON.stringify(hostOrigin2)};

let _seq = 0;
const pending = new Map();

function send(type, payload) {
	parent.postMessage({aq: 1, token: AQ_TOKEN, type, payload}, AQ_HOST_ORIGIN);
}

let _aqInited = false;
let _aqPageStarted = false;

function call(method, params) {
	if (!_aqInited) return Promise.reject(new Error("[AQ] not inited"));
	const id = ++_seq;
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve, reject, method, params, startedAt: Date.now(), warnTimer: null, warnMs: null });
		send("AQ_CALL", { id, method, params });
	});
}

function startPageJsOnce() {
	if (_aqPageStarted) return;
	_aqPageStarted = true;
	const el = document.getElementById("AQ_PAGE_JS");
	const code = el ? (el.textContent || "") : "";
	if (!code) return;
	(new Function(code))();
}

window.addEventListener("message", (ev) => {
	if (ev.source !== parent) return;
	const msg = ev.data;
	if (!msg || msg.aq !== 1) return;
	if (msg.token !== AQ_TOKEN) return;

	if (msg.type === "AQ_RESULT") {
		const p = pending.get(msg.payload.id);
		if (!p) return;
		if (p.warnTimer) clearTimeout(p.warnTimer);
		pending.delete(msg.payload.id);
		p.resolve(msg.payload.result);
		return;
	}

	if (msg.type === "AQ_ERROR") {
		const p = pending.get(msg.payload.id);
		if (!p) return;
		if (p.warnTimer) clearTimeout(p.warnTimer);
		pending.delete(msg.payload.id);
		p.reject(new Error(msg.payload.error));
		return;
	}

	if (msg.type === "AQ_ACK") {
		const p = pending.get(msg.payload.id);
		if (!p) return;
		const warnMs = Number(msg.payload.warnMs);
		if (!Number.isFinite(warnMs) || warnMs <= 0) return;
		p.warnMs = warnMs;
		if (p.warnTimer) clearTimeout(p.warnTimer);
		p.warnTimer = setTimeout(() => {
			if (!pending.has(msg.payload.id)) return;
			const elapsedMs = Date.now() - p.startedAt;
			send("AQ_STUCK", { id: msg.payload.id, method: p.method, elapsedMs });
		}, warnMs);
		return;
	}

	if (msg.type === "AQ_INIT") {
		window.aqPageKey = msg.payload?.pageKey;
		_aqInited = true;
		setTimeout(startPageJsOnce, 0);
		return;
	}
});

window.aq = {
	call,
	protocolInfo: () => call("protocolInfo"),
	navigate: (pageKey) => call("navigate", { pageKey }),
	switchDao: (daoConfig) => call("switchDao", { daoConfig }),
	storagePut: (name, patch) => call("storagePut", { name, patch }),
	storageGet: (name) => call("storageGet", { name }),
	storageDelete: (name) => call("storageDelete", { name }),
	storageList: (prefix, options) => call("storageList", { prefix, options }),
	storageRename: (from, to) => call("storageRename", { from, to }),
	ref: (category, name) => call("ref", { category, name }),
	fetchText: (ref) => call("fetchText", { ref }),
	fetchBytes: (ref) => call("fetchBytes", { ref })
};

send("AQ_PAGE_READY", { });
<\/script>
</body>
</html>`;
  }

  // src/aqRpc.js
  var DAO_CONTRACT = "0x64521be8D93483f5A41c40c21176137aEd65296D";
  var SEL_getSwarmHash = "0xcc2fb628";
  var transient = (msg) => {
    const e = new Error(msg);
    e.transient = true;
    return e;
  };
  var rpcCall = async (url, method, params) => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
    });
    if (!r.ok) throw transient("[AQ] rpc http " + r.status);
    const j = await r.json();
    if (j.error) throw transient("[AQ] rpc error");
    return j.result;
  };
  var encodeUint256 = (n) => {
    const bn = BigInt(String(n));
    return bn.toString(16).padStart(64, "0");
  };
  var resolveDaoCid = async (tokenId, urls) => {
    if (!Array.isArray(urls) || urls.length === 0) throw new Error("[AQ] resolveDaoCid: missing urls");
    const data = SEL_getSwarmHash + encodeUint256(tokenId);
    let lastErr;
    for (const url of urls) {
      try {
        const r = await rpcCall(url, "eth_call", [{ to: DAO_CONTRACT, data }, "latest"]);
        if (r === "0x") throw new Error("[AQ] contract reverted");
        if (!/^0x[0-9a-fA-F]{64}$/.test(r)) throw new Error("[AQ] invalid bytes32");
        return r.slice(2).toLowerCase();
      } catch (e) {
        if (!e.transient) throw e;
        lastErr = e;
      }
    }
    throw lastErr || new Error("[AQ] dao resolve failed");
  };

  // src/aqSeed.js
  var DB_NAME = "aqSeed";
  var DB_VERSION = 1;
  var STORE_NAME = "seed";
  var RECORD_KEY = "current";
  var _dbPromise = null;
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
      try {
        result = fn(store);
      } catch (e) {
        reject(e);
        return;
      }
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error("[AQ] seed tx aborted"));
    });
  }
  async function seedExists() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE_NAME, "readonly");
      const store = t.objectStore(STORE_NAME);
      const req = store.getKey(RECORD_KEY);
      req.onsuccess = () => resolve(req.result !== void 0);
      req.onerror = () => reject(req.error);
    });
  }
  async function seedStore(record) {
    if (!record || typeof record !== "object") throw new Error("[AQ] seedStore: record must be object");
    const REQUIRED = ["version", "method", "salt", "ciphertext", "iv"];
    for (const f of REQUIRED) {
      if (record[f] === void 0) throw new Error("[AQ] seedStore: missing field: " + f);
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

  // src/aqGateApi.js
  var _exposed = false;
  function exposeGateApi() {
    if (_exposed) return;
    const api = Object.freeze({
      protocolStorage: Object.freeze({
        put: (name, patch) => aqProtocolStoragePut(name, patch),
        get: (name) => aqProtocolStorageGet(name),
        delete: (name) => aqProtocolStorageDelete(name),
        list: (prefix, options) => aqProtocolStorageList(prefix, options),
        rename: (from, to) => aqProtocolStorageRename(from, to)
      }),
      seed: Object.freeze({
        store: (record) => seedStore(record),
        exists: () => seedExists()
      })
    });
    try {
      Object.defineProperty(window, "aqGateApi", {
        value: api,
        writable: false,
        configurable: false,
        enumerable: true
      });
    } catch {
      window.aqGateApi = api;
    }
    _exposed = true;
  }

  // src/aqGateRender.js
  var GATE_ROOT_ID = "aq-gate-root";
  var GATE_STYLE_ID = "aq-gate-style";
  var GATE_SCRIPT_ID = "aq-gate-script";
  var _currentBlobUrl = null;
  function renderGateDao(gateAssets) {
    return new Promise((resolve, reject) => {
      const { html = "", css = "", js = "" } = gateAssets || {};
      let root = document.getElementById(GATE_ROOT_ID);
      if (!root) {
        root = document.createElement("div");
        root.id = GATE_ROOT_ID;
        document.body.appendChild(root);
      }
      root.innerHTML = html;
      let styleEl = document.getElementById(GATE_STYLE_ID);
      if (styleEl) styleEl.remove();
      if (css) {
        styleEl = document.createElement("style");
        styleEl.id = GATE_STYLE_ID;
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
      }
      const oldScript = document.getElementById(GATE_SCRIPT_ID);
      if (oldScript) oldScript.remove();
      if (_currentBlobUrl) {
        try {
          URL.revokeObjectURL(_currentBlobUrl);
        } catch {
        }
        _currentBlobUrl = null;
      }
      if (!js) {
        resolve();
        return;
      }
      _currentBlobUrl = URL.createObjectURL(new Blob([js], { type: "application/javascript" }));
      const scriptEl = document.createElement("script");
      scriptEl.id = GATE_SCRIPT_ID;
      scriptEl.src = _currentBlobUrl;
      scriptEl.onload = () => {
        try {
          if (typeof window.aqGateInit === "function") {
            const ret = window.aqGateInit();
            if (ret && typeof ret.then === "function") {
              ret.then(resolve, reject);
              return;
            }
          }
          resolve();
        } catch (e) {
          reject(e);
        }
      };
      scriptEl.onerror = (e) => {
        reject(new Error("[AQ] gate script load failed: " + (e?.message || "unknown")));
      };
      document.head.appendChild(scriptEl);
    });
  }

  // src/aqLoaderCore.js
  var cfg = null;
  var gateCfg = null;
  var protocolCfg = null;
  var currentKey = null;
  var currentBlobUrl = null;
  var pendingInitKey = null;
  var _readyResolve = null;
  var aqSessionToken;
  var _bootHashConsumed = false;
  var getProtocolCfg = () => protocolCfg;
  var setProtocolCfg = (v) => {
    protocolCfg = v;
  };
  var getCurrentKey = () => currentKey;
  var getPendingInitKey = () => pendingInitKey;
  var getAqSessionToken = () => aqSessionToken;
  var consumeReadyResolve = () => {
    const r = _readyResolve;
    _readyResolve = null;
    return r;
  };
  var REFS_CATEGORIES = ["js", "css", "json", "html", "others"];
  var PAGE_FIELDS = ["html", "css", "js"];
  function validateDaoConfig(c) {
    if (!c || typeof c !== "object") throw new Error("[AQ] config: not an object");
    if (c.rpc !== void 0 && c.rpc !== null && c.rpc !== "") {
      if (typeof c.rpc !== "string") throw new Error("[AQ] config: rpc must be string");
      if (c.rpc.trim() !== c.rpc) throw new Error("[AQ] config: rpc must be trimmed");
      if (/[\r\n\t]/.test(c.rpc)) throw new Error("[AQ] config: invalid rpc");
      let u;
      try {
        u = new URL(c.rpc);
      } catch {
        throw new Error("[AQ] config: rpc invalid URL: " + c.rpc);
      }
      if (!devMode && u.protocol !== "https:") throw new Error("[AQ] config: rpc must be https");
    }
    validateContracts(c.contracts, devMode);
    validateTokens(c.tokens, c.contracts);
    if (c.refs !== void 0) {
      if (!c.refs || typeof c.refs !== "object") throw new Error("[AQ] config: refs must be object");
      for (const cat of Object.keys(c.refs)) {
        if (!REFS_CATEGORIES.includes(cat)) throw new Error("[AQ] config: unknown refs category: " + cat);
        const subMap = c.refs[cat];
        if (!subMap || typeof subMap !== "object") throw new Error("[AQ] config: refs." + cat + " must be object");
        for (const sub of Object.keys(subMap)) {
          validateRefName(sub);
          const nameMap = subMap[sub];
          if (!nameMap || typeof nameMap !== "object") throw new Error("[AQ] config: refs." + cat + "." + sub + " must be object");
          for (const name of Object.keys(nameMap)) {
            validateRefName(name);
            validateRefsLeaf(nameMap[name], devMode, c.tokens);
          }
        }
      }
    }
    if (c.exports !== void 0) {
      if (!Array.isArray(c.exports)) throw new Error("[AQ] config: exports must be array");
      for (let i = 0; i < c.exports.length; i++) {
        const e = c.exports[i];
        if (!e || typeof e !== "object") throw new Error("[AQ] config: exports[" + i + "] must be object");
        if (!REFS_CATEGORIES.includes(e.category))
          throw new Error("[AQ] config: exports[" + i + "] invalid category: " + e.category);
        if (typeof e.name !== "string" || !e.name)
          throw new Error("[AQ] config: exports[" + i + "] name must be non-empty string");
        const { sub, name } = validateRefPath(e.name);
        const subMap = c.refs && c.refs[e.category];
        if (!subMap || !(sub in subMap))
          throw new Error("[AQ] config: exports[" + i + "] \u2192 refs." + e.category + "." + sub + " not found");
        const nameMap = subMap[sub];
        if (!(name in nameMap))
          throw new Error("[AQ] config: exports[" + i + "] \u2192 refs." + e.category + "." + sub + "." + name + " not found");
      }
    }
    if (!c.pages || typeof c.pages !== "object") throw new Error("[AQ] config: pages must be object");
    const pageKeys = Object.keys(c.pages);
    if (pageKeys.length === 0) throw new Error("[AQ] config: pages is empty");
    for (const pk of pageKeys) {
      const page = c.pages[pk];
      if (!page || typeof page !== "object") throw new Error("[AQ] config: page '" + pk + "' must be object");
      const fields = Object.keys(page);
      if (fields.length === 0) throw new Error("[AQ] config: page '" + pk + "' has no fields");
      let hasField = false;
      for (const f of fields) {
        if (!PAGE_FIELDS.includes(f)) throw new Error("[AQ] config: page '" + pk + "' unknown field: " + f);
        const refPath = page[f];
        if (typeof refPath !== "string" || !refPath) throw new Error("[AQ] config: page '" + pk + "'." + f + " must be non-empty string");
        const { sub, name } = validateRefPath(refPath);
        const subMap = c.refs && c.refs[f];
        if (!subMap || !(sub in subMap))
          throw new Error("[AQ] config: page '" + pk + "'." + f + " \u2192 refs." + f + "." + sub + " not found");
        const nameMap = subMap[sub];
        if (!(name in nameMap))
          throw new Error("[AQ] config: page '" + pk + "'." + f + " \u2192 refs." + f + "." + sub + "." + name + " not found");
        hasField = true;
      }
      if (!hasField) throw new Error("[AQ] config: page '" + pk + "' has no valid field");
    }
    if (typeof c.defaultPage !== "string" || !c.defaultPage) throw new Error("[AQ] config: defaultPage must be string");
    if (!(c.defaultPage in c.pages)) throw new Error("[AQ] config: defaultPage not in pages: " + c.defaultPage);
  }
  async function resolveRemoteRef(remoteRef, category, sub, name, srcContracts, srcTokens, srcRpc) {
    if (!srcTokens || typeof srcTokens !== "object")
      throw new Error("[AQ] remote resolve: tokens map missing");
    const token = srcTokens[remoteRef.tokenName];
    if (!token || typeof token !== "object")
      throw new Error("[AQ] remote resolve: tokenName not found: " + remoteRef.tokenName);
    if (!srcContracts || typeof srcContracts !== "object")
      throw new Error("[AQ] remote resolve: contracts map missing");
    const contract = srcContracts[token.contractName];
    if (!contract || typeof contract !== "object")
      throw new Error("[AQ] remote resolve: contractName not found: " + token.contractName);
    const rpcSource = typeof contract.rpc === "string" && contract.rpc ? contract.rpc : srcRpc;
    const rpcUrls = parseRpcConfig(rpcSource, devMode);
    const targetCid = await resolveDaoCid(token.tokenId, rpcUrls);
    const targetCfg = await fetchAssetJSON(targetCid);
    if (!targetCfg || typeof targetCfg !== "object") throw new Error("[AQ] remote resolve: target not an object");
    if (!targetCfg.refs || typeof targetCfg.refs !== "object") throw new Error("[AQ] remote resolve: target has no refs");
    const subMap = targetCfg.refs[category];
    if (!subMap || typeof subMap !== "object") throw new Error("[AQ] remote resolve: target refs." + category + " missing");
    if (!(sub in subMap)) throw new Error("[AQ] remote resolve: target refs." + category + "." + sub + " missing");
    const nameMap = subMap[sub];
    if (!nameMap || typeof nameMap !== "object") throw new Error("[AQ] remote resolve: target refs." + category + "." + sub + " not object");
    if (!(name in nameMap)) throw new Error("[AQ] remote resolve: target refs." + category + "." + sub + "." + name + " not found");
    const leaf = nameMap[name];
    if (isRemoteRef(leaf)) throw new Error("[AQ] remote resolve: chained remote ref not allowed");
    if (!isLocalRefObject(leaf)) throw new Error("[AQ] remote resolve: target leaf must be local object");
    if (typeof leaf.path === "string" && leaf.path) {
      if (!devMode) throw new Error("[AQ] remote resolve: target leaf must have cid (path not allowed in non-devMode)");
      return { path: leaf.path };
    }
    if (typeof leaf.cid !== "string" || !CID_RE.test(leaf.cid))
      throw new Error("[AQ] remote resolve: target leaf must have cid");
    const callerCidBase = getAqCidBase();
    const targetCidBase = typeof targetCfg.cidBase === "string" && targetCfg.cidBase ? targetCfg.cidBase : null;
    const out = { cid: leaf.cid.toLowerCase() };
    if (targetCidBase && targetCidBase !== callerCidBase) out.cidBase = targetCidBase;
    return out;
  }
  async function resolveRefIn(srcCfg, category, sub, name) {
    if (!srcCfg) throw new Error("[AQ] ref: config not loaded");
    if (!REFS_CATEGORIES.includes(category)) throw new Error("[AQ] ref: unknown category: " + category);
    const subMap = srcCfg.refs && srcCfg.refs[category];
    if (!subMap || !(sub in subMap)) throw new Error("[AQ] ref: not found: " + category + "." + sub);
    const nameMap = subMap[sub];
    if (!(name in nameMap)) throw new Error("[AQ] ref: not found: " + category + "." + sub + "." + name);
    const leaf = nameMap[name];
    if (isRemoteRef(leaf)) return await resolveRemoteRef(leaf, category, sub, name, srcCfg.contracts, srcCfg.tokens, srcCfg.rpc);
    return leaf;
  }
  async function resolveOwnRef(category, sub, name) {
    return await resolveRefIn(cfg, category, sub, name);
  }
  async function loadPage(pageKey) {
    const key = pageKey;
    if (key === currentKey) return true;
    const page = cfg.pages[key];
    if (!page) throw new Error("[AQ] Unknown page: " + key);
    if (!page.html && !page.css && !page.js) throw new Error("[AQ] page has no assets: " + pageKey);
    async function resolveField(field) {
      if (!page[field]) return null;
      const { sub, name } = validateRefPath(page[field]);
      return await resolveOwnRef(field, sub, name);
    }
    const htmlRef = await resolveField("html");
    const cssRef = await resolveField("css");
    const jsRef = await resolveField("js");
    const html = htmlRef ? await fetchAssetText(htmlRef) : "";
    const css = cssRef ? await fetchAssetText(cssRef) : "";
    const js = jsRef ? await fetchAssetText(jsRef) : "";
    aqSessionToken = randomHex(16);
    const doc = buildIframeDoc({ html, css, js, token: aqSessionToken, hostOrigin });
    if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = URL.createObjectURL(new Blob([doc], { type: "text/html" }));
    try {
      const w = iframe.contentWindow;
      if (w && w.location) w.location.replace(currentBlobUrl);
      else iframe.src = currentBlobUrl;
    } catch {
      iframe.src = currentBlobUrl;
    }
    currentKey = key;
    pendingInitKey = key;
    return new Promise((resolve) => {
      _readyResolve = resolve;
    });
  }
  async function _loadDaoConfigInternal(daoRef, namespace, gateMode) {
    const hostCidBase = conf?.cidBase ?? "";
    setAqCidBase(hostCidBase);
    const isPathRef = typeof daoRef === "string" && daoRef.startsWith("/");
    if (!getAqCidBase() && !isPathRef) throw new Error("[AQ] missing cidBase");
    const nextCfg = await fetchAssetJSON(daoRef);
    validateDaoConfig(nextCfg);
    if (gateMode) {
      gateCfg = nextCfg;
      setAqDaoNamespace(namespace);
      const daoCidBase = nextCfg?.cidBase ?? "";
      setAqCidBase(daoCidBase || hostCidBase);
    } else {
      cfg = nextCfg;
      setAqDaoNamespace(namespace);
      const daoCidBase = nextCfg?.cidBase ?? "";
      setAqCidBase(daoCidBase || hostCidBase);
      if (!getAqCidBase() && !devMode) throw new Error("[AQ] missing cidBase");
      currentKey = null;
      pendingInitKey = null;
      let startKey = nextCfg.defaultPage;
      if (!_bootHashConsumed) {
        _bootHashConsumed = true;
        const h = (location.hash || "").trim();
        if (h && h !== "#") {
          const key = h.startsWith("#") ? h.slice(1) : h;
          if (nextCfg.pages && nextCfg.pages[key]) startKey = key;
        }
      }
      await loadPage(startKey);
    }
  }
  async function _resolveGatePageAssets(pageKey) {
    if (!gateCfg) throw new Error("[AQ] gate not loaded");
    const key = pageKey || gateCfg.defaultPage;
    const page = gateCfg.pages && gateCfg.pages[key];
    if (!page) throw new Error("[AQ] gate page not found: " + key);
    async function resolveField(field) {
      if (!page[field]) return null;
      const { sub, name } = validateRefPath(page[field]);
      return await resolveRefIn(gateCfg, field, sub, name);
    }
    const htmlRef = await resolveField("html");
    const cssRef = await resolveField("css");
    const jsRef = await resolveField("js");
    const html = htmlRef ? await fetchAssetText(htmlRef) : "";
    const css = cssRef ? await fetchAssetText(cssRef) : "";
    const js = jsRef ? await fetchAssetText(jsRef) : "";
    return { html, css, js };
  }
  async function loadDaoConfig(daoRef) {
    const normalized = typeof daoRef === "string" ? daoRef.trim() : daoRef;
    if (!normalized) throw new Error("[AQ] missing daoConfig");
    const namespace = typeof normalized === "string" ? normalized : normalized.cid ? "cid:" + normalized.cid : normalized.path;
    await _loadDaoConfigInternal(normalized, namespace, false);
  }
  async function loadGateDao(gateName, gateEntry, pageKey) {
    if (!gateEntry || typeof gateEntry !== "object") throw new Error("[AQ] loadGateDao: invalid entry");
    let daoRef;
    let namespace;
    if (typeof gateEntry.tokenId === "string") {
      const rpcUrls = parseRpcConfig(conf?.rpc, devMode);
      const cid = await resolveDaoCid(gateEntry.tokenId, rpcUrls);
      daoRef = cid;
      namespace = "gate:" + gateEntry.tokenId;
    } else if (typeof gateEntry.path === "string") {
      if (!devMode) throw new Error("[AQ] loadGateDao: path entry not allowed (non-devMode)");
      daoRef = gateEntry.path;
      namespace = "gate:" + gateEntry.path;
    } else {
      throw new Error("[AQ] loadGateDao: entry must have tokenId or path");
    }
    await _loadDaoConfigInternal(daoRef, namespace, true);
    const gateAssets = await _resolveGatePageAssets(pageKey);
    exposeGateApi();
    await renderGateDao(gateAssets);
  }
  async function renderGatePage(pageKey) {
    if (!gateCfg) throw new Error("[AQ] renderGatePage: gate not loaded");
    const gateAssets = await _resolveGatePageAssets(pageKey);
    await renderGateDao(gateAssets);
  }
  async function loadContentDao(openTokenId) {
    if (typeof openTokenId !== "string" || !openTokenId) {
      throw new Error("[AQ] openTokenId missing");
    }
    if (openTokenId.startsWith("/")) {
      if (!devMode) throw new Error("[AQ] openTokenId: path not allowed (non-devMode)");
      const namespace2 = openTokenId;
      await _loadDaoConfigInternal(openTokenId, namespace2, false);
      return;
    }
    const rpcUrls = parseRpcConfig(conf?.rpc, devMode);
    const cid = await resolveDaoCid(openTokenId, rpcUrls);
    const namespace = "cid:" + cid;
    await _loadDaoConfigInternal(cid, namespace, false);
  }
  async function aqRef(category, refPath) {
    const { sub, name } = validateRefPath(refPath);
    return await resolveOwnRef(category, sub, name);
  }
  async function aqFetchText(ref) {
    if (typeof ref === "string") validateFetchInput(ref, devMode);
    return await fetchAssetText(ref);
  }
  async function aqFetchBytes(ref) {
    if (typeof ref === "string") validateFetchInput(ref, devMode);
    return await fetchAssetBytes(ref);
  }
  function cleanupOnPageHide() {
    try {
      iframe.src = "about:blank";
    } catch {
    }
    try {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = null;
      }
    } catch {
    }
    currentKey = null;
  }

  // src/aqProtocolBus.js
  var _locked = false;
  var ALLOW_WHILE_LOCKED = /* @__PURE__ */ new Set();
  var isLocked = () => _locked;
  var setLocked = (v) => {
    _locked = v;
  };
  var postTo = (win, token, type, payload) => {
    try {
      win?.postMessage({ aq: 1, token, type, payload }, "*");
    } catch {
    }
  };
  var handlers = {
    protocolInfo: () => ({ pageKey: getCurrentKey() }),
    navigate: (params) => {
      const next = params?.pageKey;
      if (typeof next !== "string" || !next) throw new Error("navigate: missing pageKey");
      if (next !== getCurrentKey()) return loadPage(next);
      return true;
    },
    switchDao: (params) => {
      const daoConfig = params?.daoConfig;
      if (!daoConfig) throw new Error("switchDao: missing daoConfig");
      return loadDaoConfig(daoConfig);
    },
    storagePut: (p) => aqStoragePut(p?.name, p?.patch),
    storageGet: (p) => aqStorageGet(p?.name),
    storageDelete: (p) => aqStorageDelete(p?.name),
    storageList: (p) => aqStorageList(p?.prefix, p?.options),
    storageRename: (p) => aqStorageRename(p?.from, p?.to),
    ref: (p) => aqRef(p?.category, p?.name),
    fetchText: (p) => aqFetchText(p?.ref),
    fetchBytes: (p) => aqFetchBytes(p?.ref)
  };
  var warnMsByMethod = {
    protocolInfo: 2e3,
    navigate: 1e4,
    switchDao: 1e4,
    storagePut: 5e3,
    storageGet: 5e3,
    storageDelete: 1e4,
    storageList: 1e4,
    storageRename: 15e3,
    ref: 1e4,
    fetchText: 1e4,
    fetchBytes: 1e4,
    "default": 3e4
  };
  window.addEventListener("message", (ev) => {
    if (ev.source !== iframe.contentWindow) return;
    const msg = ev.data;
    if (!msg || msg.aq !== 1) return;
    if (msg.token !== getAqSessionToken()) return;
    const replyWin = ev.source;
    const replyToken = msg.token;
    const reply = (type, payload) => postTo(replyWin, replyToken, type, payload);
    if (msg.type === "AQ_PAGE_READY") {
      const initPayload = { pageKey: getPendingInitKey() ?? getCurrentKey() };
      setTimeout(() => {
        postTo(iframe.contentWindow, getAqSessionToken(), "AQ_INIT", initPayload);
        const r = consumeReadyResolve();
        if (r) r(true);
      }, 0);
      return;
    }
    if (msg.type === "AQ_STUCK") {
      const p = msg.payload || {};
      console.warn("[AQ] page reports stuck call:", p.method, "id=" + p.id, "elapsedMs=" + p.elapsedMs);
      return;
    }
    if (msg.type !== "AQ_CALL") return;
    const { id, method, params } = msg.payload || {};
    if (_locked && !ALLOW_WHILE_LOCKED.has(method)) {
      reply("AQ_ERROR", { id, error: "[AQ] locked" });
      return;
    }
    const warnMs = warnMsByMethod[method] ?? warnMsByMethod["default"];
    reply("AQ_ACK", { id, warnMs });
    const replyOK = (result) => {
      reply("AQ_RESULT", { id, result });
    };
    const replyERR = (error) => {
      reply("AQ_ERROR", { id, error: String(error) });
    };
    (async () => {
      const isAllow = ALLOW_WHILE_LOCKED.has(method);
      if (!isAllow) {
        _locked = true;
        overlayShowLocked(isLocked);
      }
      try {
        const h = handlers[method];
        if (!h) throw new Error("Unknown method: " + method);
        const result = await h(params);
        replyOK(result);
      } catch (e) {
        replyERR(e?.message || e);
      } finally {
        if (!isAllow) {
          _locked = false;
          overlayHide();
        }
      }
    })();
  });

  // src/aqProtocolLoader.js
  setAqRpcUrls(parseRpcConfig(conf.rpc, devMode));
  var protocolCfg2 = window.aqProtocolConfig;
  if (!protocolCfg2 || typeof protocolCfg2 !== "object") throw new Error("[AQ] missing aqProtocolConfig");
  setProtocolCfg(protocolCfg2);
  try {
    delete window.aqProtocolConfig;
  } catch {
    try {
      window.aqProtocolConfig = void 0;
    } catch {
    }
  }
  window.addEventListener("pagehide", () => {
    cleanupOnPageHide();
    try {
      setLocked(false);
      overlayHide();
    } catch {
    }
  });
  async function pickGateName() {
    try {
      const rec = await aqProtocolStorageGet("aqGateDAONAME");
      if (rec && typeof rec.meta === "string" && rec.meta) return rec.meta;
    } catch (e) {
      console.warn("[AQ] aqProtocolStorageGet failed:", e?.message || e);
    }
    if (typeof conf.aqGateDAONAME === "string" && conf.aqGateDAONAME) return conf.aqGateDAONAME;
    const gates = getProtocolCfg().gates;
    if (!gates || typeof gates !== "object") throw new Error("[AQ] protocol config has no 'gates'");
    const keys = Object.keys(gates);
    if (keys.length === 0) throw new Error("[AQ] protocol config: gates is empty");
    return keys[0];
  }
  window.aqSeedGenComplete = async function aqSeedGenComplete() {
    try {
      setLocked(true);
      overlayShowLocked(isLocked);
      await renderGatePage();
      await loadContentDao(conf.openTokenId);
    } catch (e) {
      console.error(e);
    } finally {
      setLocked(false);
      overlayHide();
    }
  };
  (async () => {
    const boot = async () => {
      setLocked(true);
      overlayShowLocked(isLocked);
      try {
        const openTokenId = conf?.openTokenId;
        if (typeof openTokenId !== "string" || !openTokenId) {
          throw new Error("[AQ] openTokenId missing");
        }
        const gateName = await pickGateName();
        const gates = getProtocolCfg().gates;
        const gateEntry = gates ? gates[gateName] : null;
        if (!gateEntry) throw new Error("[AQ] gate not found: " + gateName);
        const hasSeed = await seedExists();
        if (!hasSeed) {
          await loadGateDao(gateName, gateEntry, "seedGen");
          return;
        }
        await loadGateDao(gateName, gateEntry);
        await loadContentDao(openTokenId);
      } catch (e) {
        console.error(e);
      } finally {
        setLocked(false);
        overlayHide();
      }
    };
    if (document.readyState !== "loading") boot();
    else document.addEventListener("DOMContentLoaded", boot, { once: true });
  })();
})();
