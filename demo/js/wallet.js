// ─── CONFIG ───────────────────────────────────────────
const GNOSIS_RPC    = 'https://rpc.gnosischain.com';
const AQ_ROOT       = 'wallet';
const AQ_ENC_PK     = 'wallet/enc_pk';
const AQ_IV         = 'wallet/iv';
const AQ_SALT       = 'wallet/salt';
const AQ_CRED_ID    = 'wallet/credential_id';
const AQ_BIO_KEY    = 'wallet/bio_key';
const AQ_HAS_BIO    = 'wallet/has_bio';
const AQ_BIO_ENC_PK = 'wallet/bio_enc_pk';
const AQ_BIO_IV     = 'wallet/bio_iv';

// ─── STATE ────────────────────────────────────────────
let unlockedWallet = null;
let _inited = false;
let _loaded = false;

// ─── AQSTORAGE HELPERS ────────────────────────────────
async function aqGet(name) {
  if (!_inited) return null;
  const rec = await aq.storageGet(name);
  if (rec && typeof rec === 'object') return String(rec.text ?? '');
  return null;
}
async function aqSet(name, text) {
  return aq.storagePut(name, { text: String(text) });
}
async function aqEnsureRoot() {
  const rec = await aq.storageGet(AQ_ROOT);
  if (!rec) await aq.storagePut(AQ_ROOT, { text: '' });
}

// ─── UTILS ────────────────────────────────────────────
const b64e = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const b64d = s   => Uint8Array.from(atob(s), c => c.charCodeAt(0));

function setMsg(id, text, type = 'info') {
  const el = document.getElementById(id);
  el.className = 'msg ' + type;
  el.innerHTML = text;
}
function clearMsg(id) {
  const el = document.getElementById(id);
  el.className = 'msg';
  el.textContent = '';
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}













// ─── KULCS LEVEZETÉS (PBKDF2) ─────────────────────────
async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 200_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── TITKOSÍTÁS / VISSZAFEJTÉS ────────────────────────
async function encryptPK(privateKey, aesKey) {
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ct  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc.encode(privateKey));
  return { ct: b64e(ct), iv: b64e(iv) };
}

async function decryptPK(aesKey) {
  const ct  = b64d(await aqGet(AQ_ENC_PK));
  const iv  = b64d(await aqGet(AQ_IV));
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct);
  return new TextDecoder().decode(buf);
}

// ─── TÁRCA LÉTREHOZÁS ─────────────────────────────────
async function createWallet() {
  const pw  = document.getElementById('create-pw').value;
  const pw2 = document.getElementById('create-pw2').value;

  if (pw.length < 8) return setMsg('create-msg', 'Min. 8 karakter szükséges.', 'error');
  if (pw !== pw2)    return setMsg('create-msg', 'A két jelszó nem egyezik.', 'error');

  setMsg('create-msg', '<span class="spinner"></span>Generálás…', 'info');

  try {
    const wallet          = ethers.Wallet.createRandom();
    const salt            = crypto.getRandomValues(new Uint8Array(16));
    const key             = await deriveKey(pw, salt);
    const { ct, iv }      = await encryptPK(wallet.privateKey, key);

    await aqEnsureRoot();
    await aqSet(AQ_ENC_PK, ct);
    await aqSet(AQ_IV,     iv);
    await aqSet(AQ_SALT,   b64e(salt));

    const words = wallet.mnemonic.phrase.split(' ');
    const grid  = document.getElementById('seed-display');
    grid.innerHTML = words.map((w, i) =>
      `<div class="seed-word"><span>${i + 1}.</span>${w}</div>`
    ).join('');


    window._pendingWallet = wallet;
    clearMsg('create-msg');
    showScreen('seed');
  } catch (e) {
    setMsg('create-msg', 'Hiba: ' + e.message, 'error');
  }
}

// ─── SEED MEGERŐSÍTÉS ─────────────────────────────────
function confirmSeed() {
  showScreen('bio');
}

// ─── BIOMETRIA REGISZTRÁCIÓ ───────────────────────────
async function registerBiometric() {
  clearMsg('bio-reg-msg');
  if (!window.PublicKeyCredential) {
    return setMsg('bio-reg-msg', 'WebAuthn nem támogatott ezen az eszközön.', 'error');
  }
  try {
    setMsg('bio-reg-msg', '<span class="spinner"></span>Biometria regisztráció…', 'info');

    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId    = crypto.getRandomValues(new Uint8Array(16));

    const cred = await navigator.credentials.create({ publicKey: {
      challenge,
      rp:   { name: 'AQ Wallet' },
      user: { id: userId, name: 'aq-user', displayName: 'AQ User' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required'
      },
      timeout: 60000
    }});

    // Szimuláció: AES kulcs aqStorage-ban (NEM production – PRF kellene)
	
    const bioAesKey      = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );
    const exported       = await crypto.subtle.exportKey('raw', bioAesKey);
    const wallet         = window._pendingWallet;
    const { ct, iv }     = await encryptPK(wallet.privateKey, bioAesKey);


    await aqSet(AQ_BIO_ENC_PK, ct);
    await aqSet(AQ_BIO_IV,     iv);
    await aqSet(AQ_BIO_KEY,    b64e(exported));
    await aqSet(AQ_CRED_ID,    b64e(cred.rawId));
    await aqSet(AQ_HAS_BIO,    '1');

    setMsg('bio-reg-msg', '✓ Biometria regisztrálva.', 'success');
    setTimeout(() => openWallet(wallet, 'biometria'), 900);
  } catch (e) {
    setMsg('bio-reg-msg', 'Hiba / megszakítva: ' + e.message, 'error');
  }
}

function skipBiometric() {
  openWallet(window._pendingWallet, 'jelszó');
}


// ─── FELOLDÁS: BIOMETRIA ──────────────────────────────
async function unlockBiometric() {
  clearMsg('unlock-msg');
  if (!window.PublicKeyCredential) {
    return setMsg('unlock-msg', 'WebAuthn nem támogatott.', 'error');
  }
  try {
    setMsg('unlock-msg', '<span class="spinner"></span>Biometria hitelesítés…', 'info');

    const credId    = b64d(await aqGet(AQ_CRED_ID));
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    await navigator.credentials.get({ publicKey: {
      challenge,
      allowCredentials: [{ type: 'public-key', id: credId }],
      userVerification: 'required',
      timeout: 60000
    }});


    const rawKey = b64d(await aqGet(AQ_BIO_KEY));
    const aesKey = await crypto.subtle.importKey(
      'raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']
    );

    const ct  = b64d(await aqGet(AQ_BIO_ENC_PK));
    const iv  = b64d(await aqGet(AQ_BIO_IV));
    const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct);
    const pk  = new TextDecoder().decode(buf);

    openWallet(new ethers.Wallet(pk), 'biometria');
  } catch (e) {
    setMsg('unlock-msg', 'Biometria sikertelen: ' + e.message, 'error');
  }
}

// ─── FELOLDÁS: JELSZÓ ─────────────────────────────────
async function unlockPassword() {
  clearMsg('unlock-msg');
  const pw = document.getElementById('unlock-pw').value;
  if (!pw) return setMsg('unlock-msg', 'Adj meg jelszót.', 'error');

  setMsg('unlock-msg', '<span class="spinner"></span>Visszafejtés…', 'info');
  try {
    const salt = b64d(await aqGet(AQ_SALT));
    const key  = await deriveKey(pw, salt);
    const pk   = await decryptPK(key);
    openWallet(new ethers.Wallet(pk), 'jelszó');
  } catch (e) {
    setMsg('unlock-msg', 'Hibás jelszó vagy sérült adat.', 'error');
  }
}

// ─── TÁRCA MEGJELENÍTÉS ───────────────────────────────
async function openWallet(wallet, authType) {
  unlockedWallet = wallet;
  window._pendingWallet = null;

  document.getElementById('w-address').textContent =
    wallet.address.slice(0, 6) + '…' + wallet.address.slice(-4);
  document.getElementById('w-address').title = wallet.address;
  document.getElementById('w-auth-type').innerHTML =
    `<span class="badge badge-ok">${authType}</span>`;

  showScreen('wallet');
  fetchBalance(wallet.address);
}

async function fetchBalance(address) {
  const el = document.getElementById('w-balance');
  el.innerHTML = '<span class="spinner"></span>';
  try {
    const provider = new ethers.JsonRpcProvider(GNOSIS_RPC);
    const balWei   = await provider.getBalance(address);
	
    el.textContent = parseFloat(ethers.formatEther(balWei)).toFixed(6) + ' xDAI';
  } catch (e) {
    el.textContent = 'Nem elérhető';
  }
}

// ─── CÍM MÁSOLÁS ─────────────────────────────────────
async function copyAddress() {
  if (!unlockedWallet) return;
  await navigator.clipboard.writeText(unlockedWallet.address);
  setMsg('wallet-msg', '✓ Cím vágólapra másolva.', 'success');
  setTimeout(() => clearMsg('wallet-msg'), 2000);
}

// ─── ZÁROLÁS ─────────────────────────────────────────
async function lockWallet() {
  unlockedWallet = null;
  const hasBio = (await aqGet(AQ_HAS_BIO)) === '1';
  document.getElementById('bio-unlock-section').style.display = hasBio ? 'block' : 'none';
  document.getElementById('unlock-pw').value = '';
  clearMsg('unlock-msg');
  showScreen('unlock');
}

// ─── TÁRCA TÖRLÉS ────────────────────────────────────
/*
async function confirmWipe() {
  if (!confirm('Biztosan törlöd a tárcát?\nA privát kulcs elvész, ha nincs seed phrase mentésed!')) return;
  await aq.storageDelete(AQ_ROOT);   // wallet/ fa törlése egyben
  unlockedWallet = null;
  showScreen('create');
}
*/

// ─── CUSTOM CONFIRM ───────────────────────────────────
let _confirmResolve = null;

function showConfirm({ title, msg, warn }) {
  document.getElementById('confirm-title').textContent = title || 'Megerősítés';
  document.getElementById('confirm-msg').textContent   = msg  || '';
  document.getElementById('confirm-warn').textContent  = warn || '';
  showScreen('confirm');
  return new Promise(resolve => { _confirmResolve = resolve; });
}

function confirmYes() {
  if (_confirmResolve) { _confirmResolve(true);  _confirmResolve = null; }
}
function confirmNo()  {
  if (_confirmResolve) { _confirmResolve(false); _confirmResolve = null; }
}

// ─── TÁRCA TÖRLÉS ────────────────────────────────────
async function confirmWipe() {
  const ok = await showConfirm({
    title: 'Tárca törlése',
    msg:   'Ez a művelet visszafordíthatatlan.',
    warn:  '⚠ A privát kulcs elvész, ha nincs seed phrase mentésed!'
  });
  if (!ok) { showScreen('wallet'); return; }
  await aq.storageDelete(AQ_ROOT);
  unlockedWallet = null;
  showScreen('create');
}

// ─── PUBLIC API ───────────────────────────────────────
window.aqWallet = {
  async createWallet()       { await createWallet(); },
  async confirmSeed()        { await confirmSeed(); },
  async registerBiometric()  { await registerBiometric(); },
  async skipBiometric()      { await skipBiometric(); },
  async unlockBiometric()    { await unlockBiometric(); },
  async unlockPassword()     { await unlockPassword(); },
  async copyAddress()        { await copyAddress(); },
  async lockWallet()         { await lockWallet(); },
  async confirmWipe()        { await confirmWipe(); },
  async confirmYes() { confirmYes(); },
  async confirmNo()  { confirmNo();  },
};

// ─── INIT (categories.js mintájára) ──────────────────
(async () => {
  _inited = true;
  const hasPK = await aqGet(AQ_ENC_PK);
  _loaded = true;
  if (hasPK) {
    const hasBio = (await aqGet(AQ_HAS_BIO)) === '1';
    document.getElementById('bio-unlock-section').style.display = hasBio ? 'block' : 'none';
    showScreen('unlock');
  } else {
    showScreen('create');
  }
})();