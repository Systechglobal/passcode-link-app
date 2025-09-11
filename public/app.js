// Simple AES-GCM encryption/decryption using Web Crypto API

// Utility: show toast notification
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.visibility = "visible";
  toast.style.opacity = "1";
  toast.style.bottom = "50px";
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.bottom = "30px";
    setTimeout(() => (toast.style.visibility = "hidden"), 500);
  }, 2000);
}

// Derive key from passcode
async function getKey(passcode, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passcode),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return await crypto.subtle.deriveKey(
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

// Encrypt message
async function encryptMessage(message, passcode) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey(passcode, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(message)
  );

  const payload = new Uint8Array([
    ...salt,
    ...iv,
    ...new Uint8Array(ciphertext),
  ]);
  return btoa(String.fromCharCode(...payload));
}

// Decrypt message
async function decryptMessage(encoded, passcode) {
  const data = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const ciphertext = data.slice(28);
  const key = await getKey(passcode, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

// Handle forms
const encryptForm = document.getElementById("encryptForm");
const decryptForm = document.getElementById("decryptForm");
const encryptedLinkDiv = document.getElementById("encryptedLink");
const decryptedOutputDiv = document.getElementById("decryptedOutput");

// Encrypt flow
encryptForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = document.getElementById("message").value.trim();
  const passcode = document.getElementById("passcode").value.trim();
  if (!message || !passcode) return;

  try {
    const encrypted = await encryptMessage(message, passcode);
    const link =
      window.location.origin + "/?msg=" + encodeURIComponent(encrypted);
    encryptedLinkDiv.innerHTML = `
      <p><strong>Share this link:</strong></p>
      <textarea readonly>${link}</textarea>
      <button id="copyLink">📋 Copy Link</button>
    `;
    document.getElementById("copyLink").addEventListener("click", () => {
      navigator.clipboard.writeText(link);
      showToast("Link copied to clipboard!");
    });
  } catch (err) {
    console.error(err);
    showToast("Encryption failed");
  }
});

// Decrypt flow
decryptForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const passcode = document.getElementById("decryptPasscode").value.trim();
  const params = new URLSearchParams(window.location.search);
  const encrypted = params.get("msg");
  if (!encrypted || !passcode) return;

  try {
    const message = await decryptMessage(encrypted, passcode);
    decryptedOutputDiv.innerHTML = `
      <p><strong>Decrypted Message:</strong></p>
      <textarea readonly>${message}</textarea>
      <button id="copyMessage">📋 Copy Message</button>
      <button id="clearMessage">🗑 Clear</button>
    `;
    document.getElementById("copyMessage").addEventListener("click", () => {
      navigator.clipboard.writeText(message);
      showToast("Message copied!");
    });
    document.getElementById("clearMessage").addEventListener("click", () => {
      decryptedOutputDiv.innerHTML = "";
    });
  } catch (err) {
    console.error(err);
    showToast("Wrong passcode or corrupted message");
  }
});

// Paste from clipboard button
document.getElementById("pastePasscode")?.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    document.getElementById("decryptPasscode").value = text;
    showToast("Passcode pasted");
  } catch {
    showToast("Clipboard read failed");
  }
});

// Show correct form depending on URL
window.addEventListener("load", () => {
  const params = new URLSearchParams(window.location.search);
  if (params.has("msg")) {
    encryptForm.style.display = "none";
    decryptForm.style.display = "block";
  } else {
    encryptForm.style.display = "block";
    decryptForm.style.display = "none";
  }
});