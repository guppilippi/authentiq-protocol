// aqHostMenu.js
// Host-szintű hamburger menü. Mindig aktív.
// devMode: Wallet + Publish Gate + Refresh Protocol
// Production: Wallet + Fork DAO

import { devMode } from "./aqEnv.js";
import { fromRawSeed, seedGetRaw, getWalletAddresses } from "./aqKeyring.js";
import { getProtocolCfg, getGateCfg, getDaoCfg } from "./aqLoaderCore.js";
import { DAO_CONTRACT } from "./aqRpc.js";
import { overlayShowBusy, overlayHide, overlaySetLabel, overlayShowError } from "./aqIframe.js";

// ---------------------------------------------------------------------------
// Server kommunikáció

async function uploadAsset(serverUrl, wallet, bytes) {
	const ts  = Date.now().toString();
	const sig = await wallet.sign(`aqUploadAsset:${ts}`);
	const resp = await fetch(`${serverUrl}/aq/asset`, {
		method: "POST",
		headers: {
			"Content-Type":    "application/octet-stream",
			"x-aq-wallet":     wallet.address.toLowerCase(),
			"x-aq-sig":        sig,
			"x-aq-timestamp":  ts,
		},
		body: bytes,
	});
	if (!resp.ok) {
		let detail = String(resp.status);
		try { const j = await resp.json(); detail = j.error || detail; } catch {}
		throw new Error(`upload ${resp.status}: ${detail}`);
	}
	const { cid } = await resp.json();
	if (!cid) throw new Error("upload: no cid in response");
	return cid;
}

async function setSwarmHash(serverUrl, wallet, tokenId, cid) {
	const ts  = Date.now().toString();
	const sig = await wallet.sign(`aqSetSwarmHash:${tokenId}:${cid}:${ts}`);
	const resp = await fetch(`${serverUrl}/rpc`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			jsonrpc: "2.0", id: 1,
			method: "aqSetSwarmHash",
			params: [{ to: DAO_CONTRACT.toLowerCase(), tokenId, cid, timestamp: ts, wallet: wallet.address.toLowerCase(), sig }],
		}),
	});
	if (!resp.ok) throw new Error(`rpc http ${resp.status}`);
	const j = await resp.json();
	if (j.error) throw new Error(`rpc: ${j.error.message || JSON.stringify(j.error)}`);
	return j.result;
}

async function mintNewToken(serverUrl, wallet) {
	const ts  = Date.now().toString();
	const sig = await wallet.sign(`aqMintToken:${ts}`);
	const resp = await fetch(`${serverUrl}/rpc`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			jsonrpc: "2.0", id: 1,
			method: "aqMintToken",
			params: [{ timestamp: ts, wallet: wallet.address.toLowerCase(), sig }],
		}),
	});
	if (!resp.ok) throw new Error(`rpc http ${resp.status}`);
	const j = await resp.json();
	if (j.error) throw new Error(`aqMintToken: ${j.error.message || JSON.stringify(j.error)}`);
	return j.result.tokenId;
}

// ---------------------------------------------------------------------------
// Fork flow

async function processPathRefs(serverUrl, wallet, config) {
	const result = JSON.parse(JSON.stringify(config));

	// Refs feldolgozás: path → CID
	if (result.refs) {
		for (const cat of Object.keys(result.refs)) {
			for (const sub of Object.keys(result.refs[cat])) {
				for (const name of Object.keys(result.refs[cat][sub])) {
					const ref = result.refs[cat][sub][name];
					if (typeof ref.path === "string") {
						overlaySetLabel(`Uploading ${cat}/${sub}.${name}…`);
						const resp = await fetch(ref.path, { cache: "no-store" });
						if (!resp.ok) throw new Error(`fetch ${ref.path}: ${resp.status}`);
						const cid = await uploadAsset(serverUrl, wallet, new Uint8Array(await resp.arrayBuffer()));
						result.refs[cat][sub][name] = { cid, description: ref.description };
					}
				}
			}
		}
	}

	// Loader path → CID
	if (result.loader?.path) {
		overlaySetLabel("Uploading loader…");
		const resp = await fetch(result.loader.path, { cache: "no-store" });
		if (!resp.ok) throw new Error(`fetch loader: ${resp.status}`);
		const cid = await uploadAsset(serverUrl, wallet, new Uint8Array(await resp.arrayBuffer()));
		result.loader = { cid };
	}

	return result;
}

// ---------------------------------------------------------------------------
// Publish műveletek

async function runPublishGate(serverUrl) {
	const wallet = fromRawSeed(seedGetRaw(), 1000);
	navigator.clipboard.writeText(wallet.address).catch(() => {});

	const rawCfg = getGateCfg();
	if (!rawCfg) throw new Error("Gate config not loaded");

	const forPublish = JSON.parse(JSON.stringify(rawCfg));
	delete forPublish.rpc; // localhost RPC nem kell production-ban

	const processed = await processPathRefs(serverUrl, wallet, forPublish);

	overlaySetLabel("Uploading gate config…");
	const cfgCid = await uploadAsset(serverUrl, wallet,
		new TextEncoder().encode(JSON.stringify(processed, null, "\t")));

	overlaySetLabel("Setting gate tokenId=1 → CID…");
	await setSwarmHash(serverUrl, wallet, "1", cfgCid);
}

async function runRefreshProtocol(serverUrl) {
	const wallet = fromRawSeed(seedGetRaw(), 1000);
	navigator.clipboard.writeText(wallet.address).catch(() => {});

	const rawCfg = getProtocolCfg();
	if (!rawCfg) throw new Error("Protocol config not loaded");

	const forPublish = JSON.parse(JSON.stringify(rawCfg));

	// Gate entry-kből path eltávolítása (tokenId marad)
	if (forPublish.gates) {
		for (const entry of Object.values(forPublish.gates)) {
			if (entry.tokenId && entry.path) delete entry.path;
		}
	}

	const processed = await processPathRefs(serverUrl, wallet, forPublish);

	overlaySetLabel("Uploading protocol config…");
	const cid = await uploadAsset(serverUrl, wallet,
		new TextEncoder().encode(JSON.stringify(processed, null, "\t")));

	overlaySetLabel("Setting tokenId=0 → CID…");
	await setSwarmHash(serverUrl, wallet, "0", cid);
}

async function runForkCurrentDao(serverUrl, tokenId) {
	const wallet = fromRawSeed(seedGetRaw(), 1000);
	navigator.clipboard.writeText(wallet.address).catch(() => {});

	const rawCfg = getDaoCfg();
	if (!rawCfg) throw new Error("DAO config not loaded");

	const processed = await processPathRefs(serverUrl, wallet, JSON.parse(JSON.stringify(rawCfg)));

	overlaySetLabel("Uploading DAO config…");
	const cfgCid = await uploadAsset(serverUrl, wallet,
		new TextEncoder().encode(JSON.stringify(processed, null, "\t")));

	let targetId = tokenId?.trim();
	if (!targetId) {
		overlaySetLabel("Minting new token…");
		targetId = await mintNewToken(serverUrl, wallet);
	}

	overlaySetLabel(`Setting tokenId=${targetId} → CID…`);
	await setSwarmHash(serverUrl, wallet, targetId, cfgCid);
	return targetId;
}

// ---------------------------------------------------------------------------
// UI

export function initHostMenu() {
	const style = document.createElement("style");
	style.textContent = [
		"#aq-hm-btn{position:fixed;top:8px;right:8px;z-index:100000;cursor:pointer;background:#222;color:#eee;border:1px solid #555;padding:4px 9px;border-radius:3px;font:13px monospace}",
		"#aq-hm-panel,#aq-hm-dialog{position:fixed;top:36px;right:8px;z-index:99999;font:13px/1.4 monospace;background:#1a1a1a;color:#ddd;border:1px solid #444;border-radius:4px}",
		"#aq-hm-panel{min-width:200px}",
		"#aq-hm-panel h3{margin:0;padding:7px 10px;font-size:10px;color:#888;border-bottom:1px solid #333;text-transform:uppercase;letter-spacing:.06em}",
		".aq-hm-item{padding:8px 10px;cursor:pointer;outline:none}",
		".aq-hm-item:hover,.aq-hm-item:focus{background:#252525}",
		"#aq-hm-dialog{min-width:320px}",
		"#aq-hm-dialog-hdr{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-bottom:1px solid #333}",
		"#aq-hm-dialog-hdr span{font-size:11px;color:#aaa}",
		"#aq-hm-dialog-close{cursor:pointer;background:none;border:none;color:#888;font-size:15px;padding:0 2px;line-height:1}",
		"#aq-hm-dialog-close:hover{color:#ddd}",
		"#aq-hm-dialog-body{padding:10px;display:flex;flex-direction:column;gap:8px}",
		"#aq-hm-dialog input{background:#111;color:#eee;border:1px solid #444;padding:5px 7px;border-radius:3px;font:13px monospace;width:100%;box-sizing:border-box}",
		"#aq-hm-dialog input::placeholder{color:#555}",
		".aq-hm-run{background:#2a7a3a;color:#fff;border:none;padding:6px 10px;border-radius:3px;cursor:pointer;font:13px monospace}",
		".aq-hm-run:disabled{background:#444;cursor:default}",
		".aq-hm-addr-table{width:100%;border-collapse:collapse;font-size:11px}",
		".aq-hm-addr-table td{padding:4px 0;vertical-align:top}",
		".aq-hm-addr-table td:first-child{color:#777;white-space:nowrap;padding-right:10px}",
		".aq-hm-addr-table td:last-child{color:#bbb;font-family:monospace;word-break:break-all}",
		".aq-hm-none{color:#555;font-size:11px}",
	].join("");
	document.head.appendChild(style);

	const btn = document.createElement("button");
	btn.id = "aq-hm-btn";
	btn.innerHTML = "&#9776;";
	document.body.appendChild(btn);

	// Panel
	const panel = document.createElement("div");
	panel.id = "aq-hm-panel";
	panel.hidden = true;
	let panelHtml = "<h3>AQ</h3>";
	panelHtml += '<div class="aq-hm-item" id="aq-hm-wallet-item" tabindex="0">Wallet</div>';
	if (devMode) {
		panelHtml += '<div class="aq-hm-item" id="aq-hm-gate-item"  tabindex="0">Publish Gate</div>';
		panelHtml += '<div class="aq-hm-item" id="aq-hm-proto-item" tabindex="0">Refresh Protocol</div>';
		panelHtml += '<div class="aq-hm-item" id="aq-hm-clear-item" tabindex="0" style="color:#c44">Clear IndexedDB</div>';
	} else {
		panelHtml += '<div class="aq-hm-item" id="aq-hm-fork-item"  tabindex="0">Fork DAO</div>';
	}
	panel.innerHTML = panelHtml;
	document.body.appendChild(panel);

	// Dialog
	const dialog = document.createElement("div");
	dialog.id = "aq-hm-dialog";
	dialog.hidden = true;
	document.body.appendChild(dialog);

	// Backdrop
	const backdrop = document.createElement("div");
	backdrop.style.cssText = "position:fixed;inset:0;z-index:99997;display:none";
	document.body.appendChild(backdrop);

	let currentDialogId = null;

	function closeAll() {
		backdrop.style.display = "none";
		panel.hidden  = true;
		dialog.hidden = true;
		currentDialogId = null;
	}

	function openPanel() {
		backdrop.style.display = "block";
		panel.hidden  = false;
		dialog.hidden = true;
		panel.querySelector(".aq-hm-item")?.focus();
	}

	function openDialog(id, title, bodyHtml) {
		currentDialogId = id;
		dialog.innerHTML =
			'<div id="aq-hm-dialog-hdr">' +
				`<span>${title}</span>` +
				'<button id="aq-hm-dialog-close">&#x2715;</button>' +
			'</div>' +
			`<div id="aq-hm-dialog-body">${bodyHtml}</div>`;
		dialog.querySelector("#aq-hm-dialog-close").addEventListener("click", closeAll);
		backdrop.style.display = "block";
		panel.hidden  = true;
		dialog.hidden = false;
	}

	function urlDialog(id, title, extra = "") {
		openDialog(id, title,
			'<input id="aq-hm-url" type="text" placeholder="Server URL" spellcheck="false" />' +
			extra +
			'<button class="aq-hm-run" id="aq-hm-run">Publish</button>'
		);
		const urlEl  = dialog.querySelector("#aq-hm-url");
		const runBtn = dialog.querySelector("#aq-hm-run");
		(urlEl.value.trim() ? runBtn : urlEl).focus();
		return { urlEl, runBtn };
	}

	async function runWithOverlay(runBtn, fn) {
		const url = dialog.querySelector("#aq-hm-url")?.value.trim().replace(/\/$/, "");
		if (!url) { overlayShowError("URL required"); return; }
		runBtn.disabled = true;
		overlayShowBusy();
		try {
			const result = await fn(url);
			overlayHide();
			closeAll();
			return result;
		} catch (e) {
			overlayShowError("⚠ " + (e.message || String(e)));
		} finally {
			runBtn.disabled = false;
		}
	}

	backdrop.addEventListener("click", closeAll);

	btn.addEventListener("click", () => {
		const anyOpen = !panel.hidden || !dialog.hidden;
		closeAll();
		if (!anyOpen) openPanel();
	});

	panel.addEventListener("keydown", (e) => {
		const items = [...panel.querySelectorAll(".aq-hm-item")];
		const idx = items.indexOf(document.activeElement);
		if (e.key === "ArrowDown") { e.preventDefault(); items[(idx + 1) % items.length]?.focus(); }
		if (e.key === "ArrowUp")   { e.preventDefault(); items.at(idx > 0 ? idx - 1 : -1)?.focus(); }
		if (e.key === "Enter")     { e.preventDefault(); e.stopPropagation(); items[idx]?.click(); }
		if (e.key === "Escape")    { e.preventDefault(); e.stopPropagation(); closeAll(); btn.focus(); }
	});

	document.addEventListener("keydown", (e) => {
		if (dialog.hidden) return;
		if (e.key === "Escape") { e.preventDefault(); closeAll(); }
		if (e.key === "Enter")  { e.preventDefault(); dialog.querySelector("#aq-hm-run")?.click(); }
	});

	// --- Wallet ---
	panel.querySelector("#aq-hm-wallet-item").addEventListener("click", async () => {
		openDialog("wallet", "Wallet", '<div class="aq-hm-none">Betöltés…</div>');
		try {
			const addrs = await getWalletAddresses();
			const rows = Object.entries(addrs)
				.map(([k, v]) => `<tr><td>${k}</td><td>${v ?? '<span class="aq-hm-none">nincs</span>'}</td></tr>`)
				.join("");
			if (currentDialogId === "wallet")
				document.getElementById("aq-hm-dialog-body").innerHTML =
					rows ? `<table class="aq-hm-addr-table"><tbody>${rows}</tbody></table>`
					     : '<div class="aq-hm-none">Nincs wallet adat.</div>';
		} catch (e) {
			if (currentDialogId === "wallet")
				document.getElementById("aq-hm-dialog-body").innerHTML =
					`<div class="aq-hm-none">${e?.message || String(e)}</div>`;
		}
	});

	if (devMode) {

		// --- Clear IndexedDB ---
		panel.querySelector("#aq-hm-clear-item").addEventListener("click", async () => {
			openDialog("clear", "Clear IndexedDB",
				'<div class="aq-hm-none" style="margin-bottom:4px">Törli az összes helyi adatot (seed, session, storage). Visszavonhatatlan.</div>' +
				'<button class="aq-hm-run" id="aq-hm-run" style="background:#8b2020">Törlés</button>'
			);
			dialog.querySelector("#aq-hm-run").addEventListener("click", async () => {
				try {
					const dbs = await indexedDB.databases?.() ??
						[{ name: "aqSeed" }, { name: "aqSession" }, { name: "aqStorage" }];
					await Promise.all(dbs.map(({ name }) =>
						new Promise((res, rej) => {
							const r = indexedDB.deleteDatabase(name);
							r.onsuccess = res;
							r.onerror   = () => rej(r.error);
							r.onblocked = res;
						})
					));
					closeAll();
					location.reload();
				} catch (e) {
					overlayShowError("⚠ " + (e.message || String(e)));
				}
			});
		});

		// --- Publish Gate ---
		panel.querySelector("#aq-hm-gate-item").addEventListener("click", () => {
			const { runBtn } = urlDialog("gate", "Publish Gate");
			runBtn.addEventListener("click", () =>
				runWithOverlay(runBtn, (url) => runPublishGate(url)));
		});

		// --- Refresh Protocol ---
		panel.querySelector("#aq-hm-proto-item").addEventListener("click", () => {
			const { runBtn } = urlDialog("proto", "Refresh Protocol");
			runBtn.addEventListener("click", () =>
				runWithOverlay(runBtn, (url) => runRefreshProtocol(url)));
		});

	} else {

		// --- Fork DAO ---
		panel.querySelector("#aq-hm-fork-item").addEventListener("click", () => {
			const { runBtn } = urlDialog("fork", "Fork DAO",
				'<input id="aq-hm-tokenid" type="text" placeholder="TokenId (üres = új)" spellcheck="false" />'
			);
			runBtn.addEventListener("click", () => {
				const tokenId = dialog.querySelector("#aq-hm-tokenid")?.value.trim();
				runWithOverlay(runBtn, (url) => runForkCurrentDao(url, tokenId));
			});
		});

	}
}
