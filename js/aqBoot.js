"use strict";
(() => {
  // src/aqEnv.js
  if (top !== self) throw new Error("[AQ] embedded not allowed");
  var hostOrigin = location.origin;
  if (!hostOrigin || hostOrigin === "null") throw new Error("[AQ] invalid host origin: " + hostOrigin);
  var hn = (location.hostname || "").toLowerCase();
  var devMode = hn === "localhost" || hn === "127.0.0.1" || hn === "::1";
  var isPwa = window.matchMedia?.("(display-mode: standalone)").matches === true;

  // src/aqAssetRef.js
  var CID_RE = /^[0-9a-f]{64,128}$/i;
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

  // src/aqRpc.js
  var DAO_CONTRACT = "0x64521be8d93483f5a41c40c21176137aed65296d";
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

  // src/aqCidBaseConfig.js
  var DEFAULT_ALLOWED_CID_BASES = ["https://api.gateway.ethswarm.org/bzz/"];
  function checkCidBaseSecurity(cidBase, rpcUrls2, devMode2) {
    if (devMode2) return;
    const base = String(cidBase ?? "");
    const normalizedBase = base.endsWith("/") ? base : base + "/";
    if (rpcUrls2.length === 1) {
      let rpcOrigin, cidOrigin;
      try {
        rpcOrigin = new URL(rpcUrls2[0]).origin;
      } catch {
        throw new Error("[AQ] cidBase check: invalid rpc URL");
      }
      try {
        cidOrigin = new URL(normalizedBase).origin;
      } catch {
        throw new Error("[AQ] cidBase check: invalid cidBase URL");
      }
      if (rpcOrigin === cidOrigin) return;
      if (DEFAULT_ALLOWED_CID_BASES.includes(normalizedBase)) return;
      throw new Error("[AQ] cidBase not allowed for this rpc");
    }
    if (DEFAULT_ALLOWED_CID_BASES.includes(normalizedBase)) return;
    throw new Error("[AQ] cidBase not allowed with default Gnosis RPC");
  }

  // src/aqBoot.js
  var SELF_SCRIPT = document.currentScript;
  var conf = window.aqProtocolPageConf;
  if (!conf || typeof conf !== "object") throw new Error("[AQ] missing aqProtocolPageConf");
  var rpcUrls = parseRpcConfig(conf.rpc, devMode);
  checkCidBaseSecurity(conf.cidBase, rpcUrls, devMode);
  var removeSelfScript = () => {
    try {
      SELF_SCRIPT?.remove();
    } catch {
    }
  };
  var removeConfScriptById = () => {
    try {
      document.getElementById("AQ_CONF")?.remove();
    } catch {
    }
  };
  async function fetchByCid(cid) {
    const base = normalizeCidBase(conf.cidBase, devMode);
    return await fetchCid(base + cid.toLowerCase());
  }
  (async () => {
    const protocolCid = await resolveDaoCid(0, rpcUrls);
    const protocolResp = await fetchByCid(protocolCid);
    const protocolText = await protocolResp.text();
    let protocolCfg;
    try {
      protocolCfg = JSON.parse(protocolText);
    } catch (e) {
      throw new Error("[AQ] protocol config invalid JSON: " + (e?.message || e));
    }
    if (!protocolCfg || typeof protocolCfg !== "object") throw new Error("[AQ] protocol config not an object");
    const loaderEntry = protocolCfg.loader;
    if (!loaderEntry || typeof loaderEntry !== "object") throw new Error("[AQ] protocol config: missing 'loader' field");
    let loaderUrl, loaderResp;
    if (typeof loaderEntry.cid === "string" && loaderEntry.cid) {
      if (!CID_RE.test(loaderEntry.cid)) throw new Error("[AQ] protocol config: loader.cid invalid");
      const base = normalizeCidBase(conf.cidBase, devMode);
      loaderUrl = base + loaderEntry.cid.toLowerCase();
      loaderResp = await fetchCid(loaderUrl);
    } else if (typeof loaderEntry.path === "string" && loaderEntry.path) {
      if (!devMode) throw new Error("[AQ] protocol config: loader.path not allowed (non-devMode)");
      if (!loaderEntry.path.startsWith("/")) throw new Error("[AQ] protocol config: loader.path must start with /");
      if (/[\r\n\t]/.test(loaderEntry.path)) throw new Error("[AQ] protocol config: loader.path invalid");
      loaderUrl = loaderEntry.path;
      loaderResp = await fetchPath(loaderUrl);
    } else {
      throw new Error("[AQ] protocol config: loader must have cid or path");
    }
    const ab = await loaderResp.arrayBuffer();
    const head = new TextDecoder("utf-8", { fatal: false }).decode(ab.slice(0, 384));
    if (/<\s*(!doctype|html|head|body)\b/i.test(head)) {
      throw new Error("[AQ] loader bytes look like HTML, abort");
    }
    window.aqProtocolConfig = protocolCfg;
    const blobUrl = URL.createObjectURL(new Blob([ab], { type: "text/javascript" }));
    const s = document.createElement("script");
    s.src = blobUrl;
    s.async = false;
    s.onload = () => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
      }
    };
    s.onerror = () => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
      }
      throw new Error("[AQ] loader exec failed: " + loaderUrl);
    };
    try {
      Object.freeze(conf);
    } catch {
    }
    try {
      Object.freeze(protocolCfg);
    } catch {
    }
    removeConfScriptById();
    removeSelfScript();
    (document.head || document.documentElement).appendChild(s);
  })().catch((e) => {
    console.error(e);
    throw e;
  });
})();
