// Handle encryption form
document.getElementById("encryptForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = document.getElementById("message").value;
  const passcode = document.getElementById("passcode").value;

  try {
    const response = await fetch("/encrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, passcode }),
    });

    const data = await response.json();

    if (data.encrypted) {
      const url = `${window.location.origin}?data=${encodeURIComponent(
        data.encrypted
      )}`;

      // Show encrypted link + copy button
      const encryptedLinkDiv = document.getElementById("encryptedLink");
      encryptedLinkDiv.innerHTML = `
        <a href="${url}" target="_blank">${url}</a>
        <button onclick="navigator.clipboard.writeText('${url}').then(() => showToast('✅ Link copied manually!'))">
          Copy Link
        </button>
      `;

      // Auto-copy to clipboard
      navigator.clipboard.writeText(url).then(() => {
        showToast("✅ Link copied to clipboard!");
      });
    } else {
      showToast("❌ Encryption failed!");
    }
  } catch (err) {
    showToast("❌ Error: " + err.message);
  }
});

// Handle decryption form
document.getElementById("decryptForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const encrypted = new URLSearchParams(window.location.search).get("data");
  const passcode = document.getElementById("decryptPasscode").value;

  try {
    const response = await fetch("/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encrypted, passcode }),
    });

    const data = await response.json();

    if (data.decrypted) {
      document.getElementById("decryptedOutput").innerText =
        "✅ Decrypted Message: " + data.decrypted;
    } else {
      showToast("❌ Wrong passcode or decryption failed.");
    }
  } catch (err) {
    showToast("❌ Error: " + err.message);
  }
});

// Show decrypt form only if ?data= exists
window.addEventListener("DOMContentLoaded", () => {
  const encrypted = new URLSearchParams(window.location.search).get("data");
  if (encrypted) {
    document.getElementById("decryptForm").style.display = "block";
  }
});

// 📋 Paste from Clipboard button
document.getElementById("pastePasscode").addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      document.getElementById("decryptPasscode").value = text;
      showToast("📋 Passcode pasted!");
    } else {
      showToast("⚠️ Clipboard is empty");
    }
  } catch (err) {
    showToast("❌ Cannot read clipboard: " + err.message);
  }
});

// ✅ Toast helper
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.style.visibility = "visible";
  toast.style.opacity = "1";
  toast.style.bottom = "50px";

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.bottom = "30px";
    setTimeout(() => {
      toast.style.visibility = "hidden";
    }, 500);
  }, 2500);
}