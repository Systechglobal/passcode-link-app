# 🔐 Secure Messenger

A simple web app that lets you **encrypt messages with a secret passcode** and share them as links.  
The recipient can only decrypt the message if they know the passcode.  

👉 Live Demo: [https://code-link-app.vercel.app](https://code-link-app.vercel.app)

---

## 🚀 Features
- Encrypt any message with a passcode
- Generates a **shareable link**
- Auto-copies the link to clipboard
- Manual **Copy Link** button for reliability
- Decrypt messages with the correct passcode
- 📋 **Paste Passcode** button for quick entry
- **Copy Decrypted Message** button
- ❌ **Clear Message** button for privacy
- Toast notifications for feedback

---

## 🛠️ How to Use

### 1. Encrypt a Message
1. Enter your **secret message**.
2. Enter a **passcode** (shared privately with your friend).
3. Click **Encrypt & Generate Link**.
4. A link is generated and auto-copied (you can also press **Copy Link**).
5. Share the link with your friend.

### 2. Decrypt a Message
1. Open the shared link.
2. Enter the same **passcode**.
3. Click **Decrypt**.
4. If correct, the secret message is revealed.
5. You can **Copy** or **Clear** the decrypted message.

---

## 📦 Tech Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- Deployment: Vercel (with HTTPS)

---

## ⚠️ Disclaimer
This project is for **educational and personal use only**.  
Do not use it to share highly sensitive information — while messages are encrypted, the app is a demo and not a replacement for professional secure communication tools.

---