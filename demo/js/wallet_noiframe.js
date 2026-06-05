// ─── CONFIG ───────────────────────────────────────────
const GNOSIS_RPC   = 'https://rpc.gnosischain.com';

const LS_ENC_PK    = 'aq_enc_pk';
const LS_IV        = 'aq_iv';
const LS_SALT      = 'aq_salt';
const LS_CRED_ID   = 'aq_credential_id';
const LS_BIO_KEY   = 'aq_bio_aes';   // AES key base64 – bio fallback (sim)
const LS_HAS_BIO   = 'aq_has_bio';



// ─── STATE ────────────────────────────────────────────
let unlockedWallet = null;  // ethers.Wallet instance, csak memóriában


















// ─── UTILS ────────────────────────────────────────────
const b64e = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const b64d = s   => Uint8Array.from(atob(s), c => c.charCodeAt(0));

function setMsg(id, text, type='info') {
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

// ─── INIT ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem(LS_ENC_PK)) {
    // Visszatérő látogató
    const hasBio = localStorage.getItem(LS_HAS_BIO) === '1';
    document.getElementById('bio-unlock-section').style.display = hasBio ? 'block' : 'none';
    showScreen('unlock');
  } else {
    showScreen('create');
  }
});

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
  const ct  = b64d(localStorage.getItem(LS_ENC_PK));
  const iv  = b64d(localStorage.getItem(LS_IV));
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct);
  return new TextDecoder().decode(buf);
}

// ─── TÁRCA LÉTREHOZÁS ─────────────────────────────────
async function createWallet() {
  const pw  = document.getElementById('create-pw').value;
  const pw2 = document.getElementById('create-pw2').value;

  if (pw.length < 8)   return setMsg('create-msg', 'Min. 8 karakter szükséges.', 'error');
  if (pw !== pw2)      return setMsg('create-msg', 'A két jelszó nem egyezik.', 'error');

  setMsg('create-msg', '<span class="spinner"></span>Generálás…', 'info');

  try {
    const wallet = ethers.Wallet.createRandom();
    const salt   = crypto.getRandomValues(new Uint8Array(16));
    const key    = await deriveKey(pw, salt);
    const { ct, iv } = await encryptPK(wallet.privateKey, key);

    localStorage.setItem(LS_ENC_PK, ct);
    localStorage.setItem(LS_IV,     iv);
    localStorage.setItem(LS_SALT,   b64e(salt));

    // Seed phrase megjelenítés
    const words = wallet.mnemonic.phrase.split(' ');
    const grid  = document.getElementById('seed-display');
    grid.innerHTML = words.map((w,i) =>
      `<div class="seed-word"><span>${i+1}.</span>${w}</div>`
    ).join('');

    // Tárolt wallet ideiglenesen – biometria regisztrációhoz kell
    window._pendingWallet = wallet;
    clearMsg('create-msg');
    showScreen('seed');
  } catch(e) {
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

    // Szimuláció: AES kulcs localStorage-ban (NEM production – PRF kellene)
    // Biometria: autentikáció = hozzáférés az AES kulcshoz
    const bioAesKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );
    const exported  = await crypto.subtle.exportKey('raw', bioAesKey);
    const wallet    = window._pendingWallet;
    const { ct, iv } = await encryptPK(wallet.privateKey, bioAesKey);

    // Bio-titkosított változat külön slot-ban
    localStorage.setItem('aq_bio_enc_pk', ct);
    localStorage.setItem('aq_bio_iv',     iv);
    localStorage.setItem(LS_BIO_KEY,      b64e(exported));  // ⚠ sim only
    localStorage.setItem(LS_CRED_ID,      b64e(cred.rawId));
    localStorage.setItem(LS_HAS_BIO,      '1');

    setMsg('bio-reg-msg', '✓ Biometria regisztrálva.', 'success');
    setTimeout(() => openWallet(wallet, 'biometria'), 900);
  } catch(e) {
    setMsg('bio-reg-msg', 'Hiba / megszakítva: ' + e.message, 'error');
  }
}

function skipBiometric() {
  const wallet = window._pendingWallet;
  openWallet(wallet, 'jelszó');
}

// ─── FELOLDÁS: BIOMETRIA ──────────────────────────────
async function unlockBiometric() {
  clearMsg('unlock-msg');
  if (!window.PublicKeyCredential) {
    return setMsg('unlock-msg', 'WebAuthn nem támogatott.', 'error');
  }
  try {
    setMsg('unlock-msg', '<span class="spinner"></span>Biometria hitelesítés…', 'info');

    const credId    = b64d(localStorage.getItem(LS_CRED_ID));
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    await navigator.credentials.get({ publicKey: {
      challenge,
      allowCredentials: [{ type: 'public-key', id: credId }],
      userVerification: 'required',
      timeout: 60000
    }});

    // Biometria sikeres → AES kulcs olvasás (sim)
    const rawKey  = b64d(localStorage.getItem(LS_BIO_KEY));
    const aesKey  = await crypto.subtle.importKey(
      'raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']
    );
    // Bio-titkosított slot
    const ct  = b64d(localStorage.getItem('aq_bio_enc_pk'));
    const iv  = b64d(localStorage.getItem('aq_bio_iv'));
    const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct);
    const pk  = new TextDecoder().decode(buf);

    openWallet(new ethers.Wallet(pk), 'biometria');
  } catch(e) {
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
    const salt = b64d(localStorage.getItem(LS_SALT));
    const key  = await deriveKey(pw, salt);
    const pk   = await decryptPK(key);
    openWallet(new ethers.Wallet(pk), 'jelszó');
  } catch(e) {
    setMsg('unlock-msg', 'Hibás jelszó vagy sérült adat.', 'error');
  }
}

// ─── TÁRCA MEGJELENÍTÉS ───────────────────────────────
async function openWallet(wallet, authType) {
  unlockedWallet = wallet;
  window._pendingWallet = null;

  document.getElementById('w-address').textContent =
    wallet.address.slice(0,6) + '…' + wallet.address.slice(-4);
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
    const provider  = new ethers.JsonRpcProvider(GNOSIS_RPC);
    const balWei    = await provider.getBalance(address);
    const balXdai   = ethers.formatEther(balWei);
    el.textContent  = parseFloat(balXdai).toFixed(6) + ' xDAI';
  } catch(e) {
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
function lockWallet() {
  unlockedWallet = null;
  const hasBio = localStorage.getItem(LS_HAS_BIO) === '1';
  document.getElementById('bio-unlock-section').style.display = hasBio ? 'block' : 'none';
  document.getElementById('unlock-pw').value = '';
  clearMsg('unlock-msg');
  showScreen('unlock');
}

// ─── TÁRCA TÖRLÉS ────────────────────────────────────
function confirmWipe() {
  if (!confirm('Biztosan törlöd a tárcát?\nA privát kulcs elvész, ha nincs seed phrase mentésed!')) return;
  [LS_ENC_PK, LS_IV, LS_SALT, LS_CRED_ID, LS_BIO_KEY, LS_HAS_BIO,
   'aq_bio_enc_pk', 'aq_bio_iv'].forEach(k => localStorage.removeItem(k));
  unlockedWallet = null;
  showScreen('create');
}