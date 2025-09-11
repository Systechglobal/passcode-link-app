function createLink() {
  const message = document.getElementById("message").value;
  const passcode = document.getElementById("passcode").value;

  if (!message || !passcode) {
    alert("Please enter a message and passcode");
    return;
  }

  // Simple Base64 encoding (replace later with stronger crypto)
  const encoded = btoa(unescape(encodeURIComponent(message)));

  const link = `${window.location.origin}/#${encoded}`;
  document.getElementById("link").value = link;
}
