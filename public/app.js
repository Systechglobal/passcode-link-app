// public/app.js (complete)
// Uses Web Crypto API for AES-GCM. All encryption/decryption happens client-side.

/////////////////////// helpers ///////////////////////

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.style.visibility = "visible";
  toast.style.opacity = "1";
  toast.style.bottom = "50px";
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.bottom = "30px";
    setTimeout(() => (toast.style.visibility = "hidden"), 350);
  }, 2200);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

////////////////////// crypto utilities //////////////////////

// Derive AES-GCM 256 key from passcode + salt using PBKDF2
async function getKey(passcode, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passcode),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt returns base64(payload) where payload = salt(16) || iv(12) || ciphertext
async function encryptMessage(message, passcode) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey(passcode, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(message));
  const payload = new Uint8Array([...salt, ...iv, ...new Uint8Array(ciphertext)]);
  // convert to base64
  let binary = "";
  for (let i = 0; i < payload.length; i++) binary += String.fromCharCode(payload[i]);
  return btoa(binary);
}

// Decrypt expects base64 payload produced above
async function decryptMessage(encoded, passcode) {
  const binary = atob(encoded);
  const data = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const ciphertext = data.slice(28);
  const key = await getKey(passcode, salt);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

/////////////////////// DOM refs ///////////////////////

const encryptForm = document.getElementById("encryptForm");
const decryptForm = document.getElementById("decryptForm");
const encryptedLinkDiv = document.getElementById("encryptedLink");
const decryptedOutputDiv = document.getElementById("decryptedOutput");
const darkModeToggle = document.getElementById("darkModeToggle");
const pastePassBtn = document.getElementById("pastePasscode");

///////////////////// state for anti-brute ///////////////////////
let failedAttempts = 0;
const MAX_FAILED = 3;

///////////////////// UI: dark mode ///////////////////////

function applyDarkPref() {
  if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark");
    darkModeToggle.textContent = "☀️";
  } else {
    document.body.classList.remove("dark");
    darkModeToggle.textContent = "🌙";
  }
}
darkModeToggle.addEventListener("click", () => {
  const on = !document.body.classList.contains("dark");
  localStorage.setItem("darkMode", on ? "true" : "false");
  applyDarkPref();
});
applyDarkPref();

///////////////////// Encrypt handler ///////////////////////

encryptForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = document.getElementById("message").value.trim();
  const passcode = document.getElementById("passcode").value.trim();
  const expiry = document.getElementById("expiry").value; // none | burn | 1 | 24h

  if (!message || !passcode) {
    showToast("Enter message and a passcode");
    return;
  }

  try {
    const encoded = await encryptMessage(message, passcode);
    let url = `${window.location.origin}${window.location.pathname}?msg=${encodeURIComponent(encoded)}`;

    if (expiry && expiry !== "none") {
      url += `&ttl=${encodeURIComponent(expiry)}`;
      if (expiry === "24h") {
        const exp = Date.now() + 24 * 60 * 60 * 1000;
        url += `&exp=${exp}`;
      }
    }

    encryptedLinkDiv.innerHTML = `
      <div><strong>Share this link (passcode separately):</strong></div>
      <div style="margin-top:8px;"><textarea readonly style="width:100%;height:72px;border-radius:8px;padding:8px;">${escapeHtml(url)}</textarea></div>
      <div style="margin-top:8px;">
        <button id="copyLink">📋 Copy Link</button>
      </div>
    `;
    document.getElementById("copyLink").addEventListener("click", () => {
      navigator.clipboard.writeText(url).then(() => showToast("Link copied"));
    });

    // Auto-copy silently (may fail on some browsers)
    navigator.clipboard.writeText(url).then(() => showToast("Link copied")).catch(()=>{});

  } catch (err) {
    console.error(err);
    showToast("Encryption error");
  }
});

///////////////////// Decrypt handler ///////////////////////

decryptForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const passcodeInput = document.getElementById("decryptPasscode");
  const passcode = passcodeInput.value.trim();

  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("msg");
  const ttl = params.get("ttl"); // may be 'burn','1','24h' or undefined
  const exp = params.get("exp");

  if (!encoded) {
    showToast("No message found");
    return;
  }
  if (!passcode) {
    showToast("Enter passcode");
    return;
  }

  // Anti-brute: if too many failed attempts, clear message from URL and block
  if (failedAttempts >= MAX_FAILED) {
    history.replaceState({}, document.title, window.location.pathname);
    decryptedOutputDiv.innerHTML = "<p>🔒 Too many failed attempts. Link cleared.</p>";
    return;
  }

  // Handle ttl pre-checks
  if (ttl === "24h" && exp) {
    if (Date.now() > parseInt(exp, 10)) {
      decryptedOutputDiv.innerHTML = "<p>❌ This message has expired.</p>";
      history.replaceState({}, document.title, window.location.pathname); // remove payload for safety
      return;
    }
  }

  try {
    const message = await decryptMessage(encoded, passcode);

    // Successful decryption: if burn or one-time, remove params so it cannot be reused
    if (ttl === "burn" || ttl === "1") {
      // Remove query string (clears encoded payload from URL)
      history.replaceState({}, document.title, window.location.pathname);
    }

    // Reset failed attempts on success
    failedAttempts = 0;

    // Show decrypted message with copy & clear buttons
    decryptedOutputDiv.innerHTML = `
      <div><strong>Decrypted Message:</strong></div>
      <div style="margin-top:8px;"><textarea readonly style="width:100%;height:90px;border-radius:8px;padding:8px;">${escapeHtml(message)}</textarea></div>
      <div style="margin-top:8px; display:flex; gap:8px;">
        <button id="copyMessage">📋 Copy Message</button>
        <button id="clearMessage" class="secondary">🗑 Clear</button>
      </div>
      <div id="expiryInfo" style="margin-top:10px;color:#0b63b8;font-weight:600;"></div>
    `;

    document.getElementById("copyMessage").addEventListener("click", () => {
      navigator.clipboard.writeText(message).then(()=>showToast("Message copied"));
    });
    document.getElementById("clearMessage").addEventListener("click", () => {
      decryptedOutputDiv.innerHTML = "";
    });

    // Show expiry details and countdown if needed
    const expiryInfo = document.getElementById("expiryInfo");
    if (ttl === "burn") {
      expiryInfo.innerText = "🔥 This message was set to burn after reading.";
    } else if (ttl === "1") {
      expiryInfo.innerText = "👁 This was a one-time view message.";
    } else if (ttl === "24h" && exp) {
      const expireAt = parseInt(exp, 10);
      expiryInfo.innerText = `⏳ Expires at: ${new Date(expireAt).toLocaleString()}`;
      startCountdown(expireAt, expiryInfo);
    } else {
      expiryInfo.innerText = "⏳ No expiry set.";
    }

  } catch (err) {
    console.error(err);
    failedAttempts++;
    showToast("Wrong passcode");
    if (failedAttempts >= MAX_FAILED) {
      // clear URL to prevent repeated attempts
      history.replaceState({}, document.title, window.location.pathname);
      decryptedOutputDiv.innerHTML = "<p>🔒 Too many failed attempts. Link cleared.</p>";
    }
  }
});

///////////////////// paste from clipboard /////////////////////
pastePassBtn?.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    document.getElementById("decryptPasscode").value = text || "";
    showToast("Passcode pasted");
  } catch (err) {
    showToast("Clipboard read failed");
  }
});

///////////////////// countdown helper ///////////////////////
let countdownTimer = null;
function startCountdown(expireAt, infoElement) {
  if (countdownTimer) clearInterval(countdownTimer);
  function tick() {
    const remaining = expireAt - Date.now();
    if (remaining <= 0) {
      // expire now
      infoElement.innerText = "⏳ Expired!";
      decryptedOutputDiv.innerHTML = "<p>❌ This message has expired.</p>";
      // remove params so it cannot be reused
      history.replaceState({}, document.title, window.location.pathname);
      if (countdownTimer) clearInterval(countdownTimer);
      return;
    }
    const hrs = Math.floor(remaining / (1000 * 60 * 60));
    const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((remaining % (1000 * 60)) / 1000);
    infoElement.innerText = `⏳ Expires in ${hrs}h ${mins}m ${secs}s`;
  }
  tick();
  countdownTimer = setInterval(tick, 1000);
}

///////////////////// page boot: show correct form & expiry info /////////////////////

window.addEventListener("load", () => {
  applyDarkPref();
  const params = new URLSearchParams(window.location.search);
  if (params.has("msg")) {
    // decrypt flow; show decrypt form and insert expiry summary at top
    encryptForm.style.display = "none";
    decryptForm.style.display = "block";

    const ttl = params.get("ttl");
    const exp = params.get("exp");
    let line = document.createElement("div");
    line.style.marginBottom = "10px";
    line.style.fontSize = "14px";
    line.style.color = "#0b63b8";
    line.style.fontWeight = "600";

    if (ttl === "burn") line.innerText = "Expiry: 🔥 Burn after reading";
    else if (ttl === "1") line.innerText = "Expiry: 👁 One-time view";
    else if (ttl === "24h" && exp) {
      const dt = new Date(parseInt(exp, 10));
      line.innerText = `Expiry: ⏳ 24h (expires at ${dt.toLocaleString()})`;
    } else line.innerText = "Expiry: ⏳ No expiry";

    // insert above the passcode input
    decryptForm.insertBefore(line, decryptForm.firstChild);
  } else {
    encryptForm.style.display = "block";
    decryptForm.style.display = "none";
  }
});