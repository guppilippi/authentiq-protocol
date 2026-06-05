// aqPageTemplate.js
// A page iframe HTML dokumentumát építi össze.
// A page belüli runtime script template stringként van itt.

export function buildIframeDoc({ html, css, js, token, hostOrigin }) {
	return `<!doctype html>
<html>
<head>
	<meta charset="utf-8" />
	<meta http-equiv="Content-Security-Policy" content="connect-src 'none'" />
	<meta name="viewport" content="width=device-width,initial-scale=1" />
	<style>${css || ""}</style>
</head>
<body>
${html || ""}
<script type="text/plain" id="AQ_PAGE_JS">${(js || "").replace(/<\/script/gi, "<\\/script")}</script>
<script>
"use strict";
const AQ_TOKEN = ${JSON.stringify(token)};
const AQ_HOST_ORIGIN = ${JSON.stringify(hostOrigin)};

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
	if (ev.source !== parent || ev.origin !== AQ_HOST_ORIGIN) return;
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
</script>
</body>
</html>`;
}
