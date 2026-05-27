// aq-iframe.js
// iframe elem létrehozás, sandbox, overlay (UX lock).

export function randomHex(nBytes) {
	const a = new Uint8Array(nBytes);
	crypto.getRandomValues(a);
	return [...a].map(b => b.toString(16).padStart(2, "0")).join("");
}

export const iframe = document.createElement("iframe");
iframe.src = "about:blank";
const sandboxFlags = "allow-scripts allow-downloads";
iframe.setAttribute("sandbox", sandboxFlags);
iframe.style.width = "100%";
iframe.style.height = "100%";
iframe.style.border = "0";

document.documentElement.style.height = "100%";
document.body.style.height = "100%";
document.body.style.margin = "0";
document.body.appendChild(iframe);

const overlayEl = document.createElement("div");
overlayEl.style.cssText = "position:fixed;inset:0;display:none;background:rgba(0,0,0,0);z-index:999999;pointer-events:auto";
document.body.appendChild(overlayEl);

let _overlayTimer = null;

export function overlayShowLocked(getLocked) {
	overlayEl.style.display = "block";
	overlayEl.style.background = "rgba(0,0,0,0)";
	if (_overlayTimer) { clearTimeout(_overlayTimer); _overlayTimer = null; }
	_overlayTimer = setTimeout(() => {
		_overlayTimer = null;
		if (!getLocked()) return;
		overlayEl.style.background = "rgba(0,0,0,.35)";
	}, 150);
}

export function overlayHide() {
	if (_overlayTimer) { clearTimeout(_overlayTimer); _overlayTimer = null; }
	overlayEl.style.display = "none";
}
