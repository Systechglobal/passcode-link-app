document.addEventListener("DOMContentLoaded", () => {
  const encryptForm = document.getElementById("encryptForm");
  const decryptForm = document.getElementById("decryptForm");
  const encryptedOutput = document.getElementById("encryptedOutput");
  const decryptedOutput = document.getElementById("decryptedOutput");
  const copyButton = document.getElementById("copyButton");

  // 🔒 Encrypt form
  encryptForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = document.getElementById("message").value;
    const passcode = document.getElementById("passcode").value;

    try {
      const response = await fetch("/api/encrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, passcode })
      });

      const data = await response.json();

      if (response.ok) {
        // Create sharable link
        const link = `${window.location.origin}/public/index.html?iv=${data.iv}&content=${data.content}`;
        encryptedOutput.innerHTML = `
          <p>✅ Encrypted link (share this):</p>
          <a href="${link}" target="_blank">${link}</a>
        `;

        // Show copy button
        copyButton.style.display = "inline-block";
        copyButton.onclick = () => {
          navigator.clipboard.writeText(link).then(() => {
            copyButton.textContent = "✅ Copied!";
            setTimeout(() => (copyButton.textContent = "📋 Copy Link"), 2000);
          });
        };
      } else {
        encryptedOutput.innerHTML = `<p style="color:red;">❌ Error: ${data.error}</p>`;
      }
    } catch (err) {
      encryptedOutput.innerHTML = `<p style="color:red;">❌ Error: ${err.message}</p>`;
    }
  });

  // 🔓 Auto-fill decrypt form if link params exist
  const urlParams = new URLSearchParams(window.location.search);
  const iv = urlParams.get("iv");
  const content = urlParams.get("content");

  if (iv && content) {
    decryptForm.style.display = "block";

    // Autofocus passcode field for user convenience
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

    decryptForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const passcode = decryptPasscodeField.value;

      try {
        const response = await fetch("/api/decrypt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ iv, content, passcode })
        });

        const data = await response.json();

        if (response.ok) {
          decryptedOutput.innerHTML = `<p>🔓 Message: ${data.message}</p>`;
        } else {
          decryptedOutput.innerHTML = `<p style="color:red;">❌ Error: ${data.error}</p>`;
        }
      } catch (err) {
        decryptedOutput.innerHTML = `<p style="color:red;">❌ Error: ${err.message}</p>`;
      }
    });
  }
});