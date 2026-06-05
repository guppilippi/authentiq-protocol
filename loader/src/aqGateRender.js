// aqGateRender.js
// Kapu DAO host-szintű renderelése: <div id="aq-gate-root"> létrehozás,
// HTML/CSS/JS asset-ek beillesztése, dynamic <script> blob URL-lel a JS-hez.
// A kapu DAO JS-blob futása után meghívódik a konvencionális window.aqGateInit().

const GATE_ROOT_ID = "aq-gate-root";
const GATE_STYLE_ID = "aq-gate-style";
const GATE_SCRIPT_ID = "aq-gate-script";

let _currentBlobUrl = null;
let _imageBlobUrls  = [];

export function teardownGateDao() {
	document.getElementById(GATE_ROOT_ID)?.remove();
	document.getElementById(GATE_STYLE_ID)?.remove();
	document.getElementById(GATE_SCRIPT_ID)?.remove();
	if (_currentBlobUrl) {
		try { URL.revokeObjectURL(_currentBlobUrl); } catch {}
		_currentBlobUrl = null;
	}
	for (const url of _imageBlobUrls) { try { URL.revokeObjectURL(url); } catch {} }
	_imageBlobUrls = [];
}

export function renderGateDao(gateAssets) {
	return new Promise((resolve, reject) => {
		const { html = "", css = "", js = "", imageBlobUrls = [] } = gateAssets || {};
		for (const url of _imageBlobUrls) { try { URL.revokeObjectURL(url); } catch {} }
		_imageBlobUrls = imageBlobUrls;

		let root = document.getElementById(GATE_ROOT_ID);
		if (!root) {
			root = document.createElement("div");
			root.id = GATE_ROOT_ID;
			root.style.cssText = "position:fixed;inset:0;z-index:50000;overflow-y:auto";
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
			try { URL.revokeObjectURL(_currentBlobUrl); } catch {}
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
