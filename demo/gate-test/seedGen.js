// Seed-gen UI logika.
// A loader rendereli ezt a page-et, ha nincs még seed.
// A flow végén meghívja window.aqSeedGenComplete()-t.

(function () {
	"use strict";

	const SEED_VERSION = 1;
	const SEED_BYTES = 16; // 128 bit → 12 szavas BIP-39
	const PBKDF2_ITER = 600000;
	const SALT_BYTES = 16;
	const IV_BYTES = 12;

	const $ = (id) => document.getElementById(id);

	function show(el) { el.classList.remove("aq-seedgen-hidden"); }
	function hide(el) { el.classList.add("aq-seedgen-hidden"); }
	function setStatus(text) {
		const s = $("aq-seedgen-status");
		s.textContent = text;
		if (text) show(s); else hide(s);
	}
	function setError(text) {
		const e = $("aq-seedgen-error");
		e.textContent = text;
		if (text) show(e); else hide(e);
	}
	function disableAll(disabled) {
		document.querySelectorAll(".aq-seedgen-btn, .aq-seedgen-label input").forEach((el) => {
			el.disabled = disabled;
		});
	}

	function b64encode(buf) {
		const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
		let s = "";
		for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
		return btoa(s);
	}

	function randomBytes(n) {
		const b = new Uint8Array(n);
		crypto.getRandomValues(b);
		return b;
	}

	// BIP-39: 128 bit entrópia → 4 bit checksum → 132 bit → 12 × 11 bit.
	// A teljes szótár nincs itt — szándékosan, mert a felhasználó NEM látja a seed phrase-t.
	// A seed bytes-okat tároljuk titkosítva, a phrase-átalakítás (későbbi recovery) külön kódban.
	// A 16-byte (128-bit) seed-et használjuk AES-GCM kulcs alapanyagként.
	function generateSeed() {
		return randomBytes(SEED_BYTES);
	}

	// --- WebAuthn + PRF útvonal ---

	async function tryWebauthnPrf(seed) {
		if (!window.PublicKeyCredential) throw new Error("WebAuthn nem támogatott.");
		const supported = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
		if (!supported) throw new Error("Platform autentikátor nem elérhető.");

		const userId = randomBytes(16);
		const challenge = randomBytes(32);
		const prfSalt = randomBytes(32);

		const publicKey = {
			rp: { name: "AQ" },
			user: { id: userId, name: "aq-user", displayName: "AQ" },
			challenge,
			pubKeyCredParams: [
				{ type: "public-key", alg: -7 },   // ES256
				{ type: "public-key", alg: -257 }, // RS256
			],
			authenticatorSelection: {
				authenticatorAttachment: "platform",
				userVerification: "required",
				residentKey: "required",
			},
			timeout: 60000,
			extensions: { prf: { eval: { first: prfSalt } } },
		};

		const cred = await navigator.credentials.create({ publicKey });
		if (!cred) throw new Error("Hitelesítés megszakadt.");

		const ext = cred.getClientExtensionResults?.();
		const prfResult = ext?.prf?.results?.first;
		if (!prfResult || prfResult.byteLength < 32) {
			throw new Error("PRF nem támogatott ezen az eszközön.");
		}

		const keyMaterial = new Uint8Array(prfResult);
		const key = await crypto.subtle.importKey("raw", keyMaterial, { name: "AES-GCM" }, false, ["encrypt"]);
		const iv = randomBytes(IV_BYTES);
		const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, seed);

		return {
			version: SEED_VERSION,
			method: "webauthn-prf",
			salt: b64encode(prfSalt),
			iv: b64encode(iv),
			ciphertext: b64encode(ciphertext),
			credentialId: b64encode(new Uint8Array(cred.rawId)),
		};
	}

	// --- Jelszó útvonal ---

	async function deriveKeyFromPassword(password, salt) {
		const enc = new TextEncoder();
		const baseKey = await crypto.subtle.importKey(
			"raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
		);
		return crypto.subtle.deriveKey(
			{ name: "PBKDF2", salt, iterations: PBKDF2_ITER, hash: "SHA-256" },
			baseKey,
			{ name: "AES-GCM", length: 256 },
			false,
			["encrypt"]
		);
	}

	async function encryptWithPassword(seed, password) {
		const salt = randomBytes(SALT_BYTES);
		const key = await deriveKeyFromPassword(password, salt);
		const iv = randomBytes(IV_BYTES);
		const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, seed);

		return {
			version: SEED_VERSION,
			method: "password",
			salt: b64encode(salt),
			iv: b64encode(iv),
			ciphertext: b64encode(ciphertext),
		};
	}

	// --- UI flow ---

	async function handleBiometric() {
		setError("");
		disableAll(true);
		setStatus("Hitelesítés folyamatban…");
		try {
			const seed = generateSeed();
			const record = await tryWebauthnPrf(seed);
			setStatus("Tárolás…");
			await window.aqGateApi.seed.store(record);
			window.aqGateApi.seed.activate(seed);
			setStatus("Kész. Átirányítás…");
			await window.aqSeedGenComplete();
		} catch (e) {
			setStatus("");
			setError("Biometrikus védelem sikertelen: " + (e?.message || e) + " — válassz jelszót.");
			disableAll(false);
		}
	}

	async function handlePassword() {
		setError("");
		const pwd1 = $("aq-seedgen-pwd1").value;
		const pwd2 = $("aq-seedgen-pwd2").value;
		if (!pwd1 || pwd1.length < 8) { setError("A jelszó legalább 8 karakter legyen."); return; }
		if (pwd1 !== pwd2) { setError("A két jelszó nem egyezik."); return; }

		disableAll(true);
		setStatus("Kulcs generálás…");
		try {
			const seed = generateSeed();
			const record = await encryptWithPassword(seed, pwd1);
			setStatus("Tárolás…");
			await window.aqGateApi.seed.store(record);
			window.aqGateApi.seed.activate(seed);
			setStatus("Kész. Átirányítás…");
			await window.aqSeedGenComplete();
		} catch (e) {
			setStatus("");
			setError("Hiba: " + (e?.message || e));
			disableAll(false);
		}
	}

	function showPasswordForm() {
		setError("");
		setStatus("");
		hide($("aq-seedgen-choice"));
		show($("aq-seedgen-form-pwd"));
		setTimeout(() => $("aq-seedgen-pwd1").focus(), 0);
	}

	function showChoice() {
		setError("");
		setStatus("");
		hide($("aq-seedgen-form-pwd"));
		show($("aq-seedgen-choice"));
		$("aq-seedgen-pwd1").value = "";
		$("aq-seedgen-pwd2").value = "";
	}

	$("aq-seedgen-btn-bio").addEventListener("click", handleBiometric);
	$("aq-seedgen-btn-pwd").addEventListener("click", showPasswordForm);
	$("aq-seedgen-back-pwd").addEventListener("click", showChoice);
	$("aq-seedgen-submit-pwd").addEventListener("click", handlePassword);
	$("aq-seedgen-pwd1").addEventListener("keydown", (e) => { if (e.key === "Enter") $("aq-seedgen-pwd2").focus(); });
	$("aq-seedgen-pwd2").addEventListener("keydown", (e) => { if (e.key === "Enter") $("aq-seedgen-submit-pwd").click(); });

	const isPwa = window.matchMedia?.("(display-mode: standalone)").matches === true;
	if (isPwa) {
		$("aq-seedgen-btn-pwd").style.display = "none";
	} else {
		showPasswordForm();
		$("aq-seedgen-back-pwd").style.display = "none";
	}
})();
