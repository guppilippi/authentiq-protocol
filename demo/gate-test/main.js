(function () {
	"use strict";

	const isPwa    = window.matchMedia?.("(display-mode: standalone)").matches === true;
	const bioBtn   = document.getElementById("aq-bio-btn");
	const sepEl    = document.getElementById("aq-sep");
	const pwdInput = document.getElementById("aq-pwd");
	const pwdBtn   = document.getElementById("aq-pwd-btn");
	const statusEl = document.getElementById("aq-status");
	const errorEl  = document.getElementById("aq-error");

	if (!isPwa) {
		bioBtn.hidden = true;
		sepEl.hidden  = true;
	}

	function setStatus(msg) { statusEl.textContent = msg; errorEl.textContent = ""; }
	function setError(msg)  { errorEl.textContent = msg; statusEl.textContent = ""; }
	function setBusy(busy)  {
		bioBtn.disabled   = busy;
		pwdBtn.disabled   = busy;
		pwdInput.disabled = busy;
	}

	async function doUnlock(password) {
		setError("");
		setBusy(true);
		setStatus("Feloldás…");
		try {
			await window.aqGateApi.seed.unlock(password);
			window.aqGateApi.gate.done();
		} catch (e) {
			setError(e?.message || String(e));
			setBusy(false);
			setStatus("");
		}
	}

	bioBtn.addEventListener("click", () => doUnlock(undefined));

	pwdBtn.addEventListener("click", () => {
		const pwd = pwdInput.value;
		if (!pwd) { setError("Add meg a jelszót."); return; }
		doUnlock(pwd);
	});

	pwdInput.addEventListener("keydown", (e) => { if (e.key === "Enter") pwdBtn.click(); });

	(async () => {
		try {
			const exists = await window.aqGateApi.seed.exists();
			document.getElementById("aq-unlock").hidden = false;
			if (!exists) {
				setError("Nincs tárolt seed.");
				bioBtn.disabled = pwdBtn.disabled = true;
				return;
			}
			pwdInput.focus();
		} catch (e) {
			document.getElementById("aq-unlock").hidden = false;
			setError("Init hiba: " + (e?.message || e));
		}
	})();
}());
