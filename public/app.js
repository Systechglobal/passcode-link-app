// Handle encryption form
document.getElementById("encryptForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = document.getElementById("message").value;
  const passcode = document.getElementById("passcode").value;

  try {
    const res = await fetch("/api/encrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, passcode }),
    });

    const data = await res.json();

    if (data.error) {
      alert("❌ " + data.error);
      return;
    }

    const { iv, encrypted } = data;
    const link = `${window.location.origin}?iv=${iv}&content=${encrypted}`;

    // Show link in page
    document.getElementById("encryptedLink").innerHTML =
      `<a href="${link}" target="_blank">${link}</a>`;

    // ✅ Auto-copy to clipboard + toast
    navigator.clipboard.writeText(link)
      .then(() => {
        showToast("🔗 Encrypted link copied!");
      })
      .catch(err => {
        console.error("Clipboard copy failed:", err);
      });

  } catch (err) {
    alert("❌ Encryption failed: " + err.message);
  }
});

// Handle decryption form
document.getElementById("decryptForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const passcode = document.getElementById("decryptPasscode").value;
  const urlParams = new URLSearchParams(window.location.search);
  const iv = urlParams.get("iv");
  const content = urlParams.get("content");

  try {
    const res = await fetch("/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, iv, encrypted: content }),
    });

    const data = await res.json();

    if (data.error) {
      alert("❌ " + data.error);
      return;
    }

    document.getElementById("decryptedOutput").innerText = "🔓 " + data.message;

  } catch (err) {
    alert("❌ Decryption failed: " + err.message);
  }
});

// Show decrypt form if link has params
const urlParams = new URLSearchParams(window.location.search);
const iv = urlParams.get("iv");
const content = urlParams.get("content");

if (iv && content) {
  document.getElementById("encryptForm").style.display = "none";
  document.getElementById("decryptForm").style.display = "block";

  // Autofocus passcode field
  const decryptPasscodeField = document.getElementById("decryptPasscode");
  decryptPasscodeField.focus();

  // 📋 Paste from Clipboard button
  const pasteButton = document.getElementById("pastePasscode");
  pasteButton.onclick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      decryptPasscodeField.value = text;
      decryptPasscodeField.focus();
    } catch (err) {
      alert("❌ Failed to read clipboard: " + err.message);
    }
  };
}

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