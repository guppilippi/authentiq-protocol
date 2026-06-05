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
overlayEl.style.cssText = "position:fixed;inset:0;display:none;background:rgba(0,0,0,0);z-index:999999;pointer-events:auto;flex-direction:column;align-items:center;justify-content:center;gap:20px";
document.body.appendChild(overlayEl);

const overlayLabelEl = document.createElement("div");
overlayLabelEl.style.cssText = "text-align:center;color:rgba(255,255,255,.75);font:15px/1.6 monospace;pointer-events:none;white-space:pre-wrap;padding:0 40px;max-width:500px";
overlayEl.appendChild(overlayLabelEl);

const overlayCloseBtnEl = document.createElement("button");
overlayCloseBtnEl.textContent = "OK";
overlayCloseBtnEl.style.cssText = "background:#333;color:#ddd;border:1px solid #555;padding:6px 32px;border-radius:3px;font:14px monospace;cursor:pointer;display:none";
overlayCloseBtnEl.addEventListener("click", () => overlayHide());
overlayEl.appendChild(overlayCloseBtnEl);

document.addEventListener("keydown", (e) => {
	if (overlayCloseBtnEl.style.display === "none") return;
	if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); overlayHide(); }
});

let _overlayTimer = null;

export function overlaySetLabel(text) {
	overlayLabelEl.textContent = text ?? "";
}

export function overlayShowLocked(getLocked) {
	overlayEl.style.display = "flex";
	overlayEl.style.background = "rgba(0,0,0,0)";
	if (_overlayTimer) { clearTimeout(_overlayTimer); _overlayTimer = null; }
	_overlayTimer = setTimeout(() => {
		_overlayTimer = null;
		if (!getLocked()) return;
		overlayEl.style.background = "rgba(0,0,0,.35)";
	}, 150);
}

export function overlayShowBusy() {
	if (_overlayTimer) { clearTimeout(_overlayTimer); _overlayTimer = null; }
	overlayEl.style.display = "flex";
	overlayEl.style.background = "rgba(0,0,0,.35)";
}

export function overlayShowError(text) {
	overlayLabelEl.textContent = text ?? "";
	overlayCloseBtnEl.style.display = "block";
	overlayShowBusy();
}

export function overlayHide() {
	if (_overlayTimer) { clearTimeout(_overlayTimer); _overlayTimer = null; }
	overlayEl.style.display = "none";
	overlayLabelEl.textContent = "";
	overlayCloseBtnEl.style.display = "none";
}
