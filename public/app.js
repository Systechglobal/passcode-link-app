// public/app.js (media-capable)
// Client-side encryption with file support and conditional download
// WARNING: URLs can be very long for files. Limit: ~150KB. For larger files use server upload.

//////////////////// helpers ////////////////////
function showToast(msg) {
  const t = document.getElementById("toast"); if (!t) return;
  t.textContent = msg; t.style.visibility = "visible"; t.style.opacity = "1"; t.style.bottom = "50px";
  setTimeout(()=>{ t.style.opacity="0"; t.style.bottom="30px"; setTimeout(()=>t.style.visibility="hidden",350); }, 2200);
}
function escapeHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}

//////////////////// crypto ////////////////////
async function getKey(passcode, salt){
  const enc = new TextEncoder();
  const keyMat = await crypto.subtle.importKey("raw", enc.encode(passcode), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:100000,hash:"SHA-256"}, keyMat, {name:"AES-GCM",length:256}, false, ["encrypt","decrypt"]);
}
async function encryptBytes(bytes, passcode){
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey(passcode, salt);
  const cipher = await crypto.subtle.encrypt({name:"AES-GCM",iv}, key, bytes);
  const payload = new Uint8Array([...salt,...iv,...new Uint8Array(cipher)]);
  let bin=""; for(let i=0;i<payload.length;i++) bin+=String.fromCharCode(payload[i]);
  return btoa(bin);
}
async function decryptToBytes(b64, passcode){
  const bin = atob(b64); const data=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) data[i]=bin.charCodeAt(i);
  const salt = data.slice(0,16); const iv = data.slice(16,28); const cipher = data.slice(28);
  const key = await getKey(passcode, salt);
  const plain = await crypto.subtle.decrypt({name:"AES-GCM", iv}, key, cipher);
  return new Uint8Array(plain);
}

//////////////////// DOM refs ////////////////////
const encryptForm = document.getElementById("encryptForm");
const decryptForm = document.getElementById("decryptForm");
const encryptedLinkDiv = document.getElementById("encryptedLink");
const decryptedOutputDiv = document.getElementById("decryptedOutput");
const darkModeToggle = document.getElementById("darkModeToggle");
const pastePassBtn = document.getElementById("pastePasscode");

//////////////////// settings ////////////////////
const MAX_BYTES = 150 * 1024; // ~150 KB recommended

//////////////////// dark mode ////////////////////
function applyDark(){ if(localStorage.getItem("darkMode")==="true"){ document.body.classList.add("dark"); darkModeToggle.textContent="☀️"; } else { document.body.classList.remove("dark"); darkModeToggle.textContent="🌙"; } }
darkModeToggle.addEventListener("click",()=>{ const on=!document.body.classList.contains("dark"); localStorage.setItem("darkMode", on?"true":"false"); applyDark(); });
applyDark();

//////////////////// encrypt ////////////////////
encryptForm?.addEventListener("submit", async (ev)=>{
  ev.preventDefault();
  const message = document.getElementById("message").value || "";
  const passcode = document.getElementById("passcode").value.trim();
  const expiry = document.getElementById("expiry").value;
  const allowDL = document.getElementById("allowDownload").checked;
  const fileInput = document.getElementById("file");
  if(!passcode){ showToast("Enter a passcode"); return; }

  // prepare payload object {type, filename?, content? (base64 encrypted), text?}
  let payload = { type: "text", text: message || "" };

  if(fileInput && fileInput.files && fileInput.files[0]){
    const f = fileInput.files[0];
    if(f.size > MAX_BYTES){ showToast(`File too large (max ${Math.round(MAX_BYTES/1024)}KB). Use server upload.`); return; }
    // read file as arrayBuffer
    const arr = await f.arrayBuffer();
    const u8 = new Uint8Array(arr);
    try{
      const encB64 = await encryptBytes(u8, passcode); // encrypt file bytes
      payload = { type: "media", mediaName: f.name, mediaType: f.type, content: encB64, allowDownload: !!allowDL, text: message || "" };
    }catch(err){ console.error(err); showToast("File encryption error"); return; }
  }else{
    // just text: encrypt the text bytes
    try{
      const encB64 = await encryptBytes(new TextEncoder().encode(message || ""), passcode);
      payload = { type: "text", content: encB64 };
    }catch(err){ console.error(err); showToast("Text encryption error"); return; }
  }

  // Encode payload as JSON then b64 -> but that increases size; instead we'll embed fields
  // We'll store: msg=<payload.content> & type & name & mtype & allowDownload & ttl & exp
  // If payload.type === "media", content is encrypted file b64. If type === "text", content is encrypted text b64.

  let baseContent = payload.content || "";
  // Build URL
  let url = `${window.location.origin}${window.location.pathname}?msg=${encodeURIComponent(baseContent)}&type=${encodeURIComponent(payload.type)}`;
  if(payload.type === "media"){
    url += `&name=${encodeURIComponent(payload.mediaName || "file")}&mtype=${encodeURIComponent(payload.mediaType || "")}&allowDL=${payload.allowDownload?1:0}`;
  }
  if(payload.type === "text" && payload.text !== undefined){
    // For text when we encrypted bytes separately, content holds encrypted text; nothing extra needed
  }
  if(expiry && expiry !== "none"){
    url += `&ttl=${encodeURIComponent(expiry)}`;
    if(expiry === "24h"){ const exp = Date.now() + 24*60*60*1000; url += `&exp=${exp}`; }
  }

  // show link UI
  encryptedLinkDiv.innerHTML = `
    <div><strong>Share this link (passcode separately):</strong></div>
    <div style="margin-top:8px;"><textarea readonly style="width:100%;height:96px;border-radius:8px;padding:8px;">${escapeHtml(url)}</textarea></div>
    <div style="margin-top:8px;"><button id="copyLink">📋 Copy Link</button></div>
  `;
  document.getElementById("copyLink").addEventListener("click", ()=>{ navigator.clipboard.writeText(url).then(()=>showToast("Link copied")); });

  // silent auto-copy
  navigator.clipboard.writeText(url).then(()=>showToast("Link copied")).catch(()=>{});
});

//////////////////// decrypt ////////////////////
let failed = 0; const MAX_FAIL = 3;

decryptForm?.addEventListener("submit", async (ev)=>{
  ev.preventDefault();
  const pass = document.getElementById("decryptPasscode").value.trim();
  const params = new URLSearchParams(window.location.search);
  const enc = params.get("msg");
  const type = params.get("type") || "text";
  const ttl = params.get("ttl");
  const exp = params.get("exp");
  const name = params.get("name") || "";
  const mtype = params.get("mtype") || "";
  const allowDL = params.get("allowDL") === "1";

  if(!enc){ showToast("No message in link"); return; }
  if(!pass){ showToast("Enter passcode"); return; }
  if(failed >= MAX_FAIL){ history.replaceState({},document.title,window.location.pathname); decryptedOutputDiv.innerHTML="<p>🔒 Too many failed attempts. Link cleared.</p>"; return; }

  // pre-expiry check
  if(ttl === "24h" && exp && Date.now() > parseInt(exp,10)){ decryptedOutputDiv.innerHTML="<p>❌ This message has expired.</p>"; history.replaceState({},document.title,window.location.pathname); return; }

  try{
    // decrypt bytes
    const plainBytes = await decryptToBytes(enc, pass);
    // if media: show media blob
    if(type === "media"){
      // assemble blob
      const blob = new Blob([plainBytes], { type: mtype || "application/octet-stream" });
      const urlObj = URL.createObjectURL(blob);
      let html = `<div style="margin-bottom:8px"><strong>Attached file:</strong> ${escapeHtml(name)}</div>`;
      if(mtype.startsWith("image/")) html += `<img src="${urlObj}" alt="image" style="max-width:100%;border-radius:8px" />`;
      else if(mtype.startsWith("video/")) html += `<video src="${urlObj}" controls style="width:100%;border-radius:8px"></video>`;
      else if(mtype.startsWith("audio/")) html += `<audio src="${urlObj}" controls style="width:100%"></audio>`;
      else html += `<div style="padding:8px;background:#fff;border-radius:6px;border:1px solid #ddd;">Preview not available for this file type.</div>`;

      // show download button only if sender allowed
      if(allowDL){
        html += `<div style="margin-top:8px"><a id="downloadFile" download="${escapeHtml(name)}" href="${urlObj}"><button>⬇️ Download File</button></a></div>`;
      } else {
        html += `<div style="margin-top:8px;color:#6b7280;font-size:13px;">Download disabled by sender.</div>`;
      }
      html += `<div style="margin-top:10px"><button id="clearMessage" class="secondary">🗑 Clear</button></div>`;

      decryptedOutputDiv.innerHTML = html;
      document.getElementById("clearMessage").addEventListener("click", ()=>{ decryptedOutputDiv.innerHTML=""; URL.revokeObjectURL(urlObj); });

      // burn/one-time handling
      if(ttl === "burn" || ttl === "1") history.replaceState({},document.title,window.location.pathname);

    } else { // text
      const message = new TextDecoder().decode(plainBytes);
      // display message and buttons
      decryptedOutputDiv.innerHTML = `
        <div><strong>Decrypted Message</strong></div>
        <div style="margin-top:8px"><textarea readonly style="width:100%;height:120px;border-radius:8px;padding:8px;">${escapeHtml(message)}</textarea></div>
        <div style="margin-top:8px;display:flex;gap:8px">
          <button id="copyMsg">📋 Copy Message</button>
          <button id="clearMsg" class="secondary">🗑 Clear</button>
        </div>
      `;
      document.getElementById("copyMsg").addEventListener("click", ()=>{ navigator.clipboard.writeText(message).then(()=>showToast("Message copied")); });
      document.getElementById("clearMsg").addEventListener("click", ()=>{ decryptedOutputDiv.innerHTML=""; });

      if(ttl === "burn" || ttl === "1") history.replaceState({},document.title,window.location.pathname);
    }

    // on success reset failed
    failed = 0;

    // show expiry details (24h countdown)
    if(ttl === "24h" && exp){
      const info = document.createElement("div");
      info.style.marginTop = "10px"; info.style.fontWeight = "600"; info.style.color = "#0b63b8";
      decryptedOutputDiv.appendChild(info);
      startCountdown(parseInt(exp,10), info);
    }

  }catch(err){
    console.error(err);
    failed++;
    showToast("Wrong passcode");
    if(failed >= MAX_FAIL){ history.replaceState({},document.title,window.location.pathname); decryptedOutputDiv.innerHTML="<p>🔒 Too many failed attempts. Link cleared.</p>"; }
  }
});

//////////////////// paste button ////////////////////
pastePassBtn?.addEventListener("click", async ()=>{
  try{ const txt = await navigator.clipboard.readText(); document.getElementById("decryptPasscode").value = txt || ""; showToast("Passcode pasted"); }
  catch{ showToast("Clipboard read failed"); }
});

//////////////////// countdown ////////////////////
let timer=null;
function startCountdown(expireAt, elem){
  if(timer) clearInterval(timer);
  function tick(){
    const rem = expireAt - Date.now();
    if(rem <= 0){ elem.innerText = "⏳ Expired!"; decryptedOutputDiv.innerHTML = "<p>❌ This message has expired.</p>"; history.replaceState({},document.title,window.location.pathname); clearInterval(timer); return; }
    const h = Math.floor(rem / (1000*60*60));
    const m = Math.floor((rem % (1000*60*60)) / (1000*60));
    const s = Math.floor((rem % (1000*60)) / 1000);
    elem.innerText = `⏳ Expires in ${h}h ${m}m ${s}s`;
  }
  tick(); timer = setInterval(tick,1000);
}

//////////////////// page boot ////////////////////
window.addEventListener("load", ()=>{
  applyDark();
  const params = new URLSearchParams(window.location.search);
  if(params.has("msg")){
    encryptForm.style.display = "none";
    decryptForm.style.display = "block";
    // show expiry summary above passcode
    const ttl = params.get("ttl"); const exp = params.get("exp");
    let summary = "Expiry: ⏳ No expiry";
    if(ttl === "burn") summary = "Expiry: 🔥 Burn after reading";
    else if(ttl === "1") summary = "Expiry: 👁 One-time view";
    else if(ttl === "24h" && exp) summary = `Expiry: ⏳ 24h (expires at ${new Date(parseInt(exp,10)).toLocaleString()})`;
    const info = document.createElement("div"); info.style.marginBottom="10px"; info.style.fontSize="14px"; info.style.color="#0b63b8"; info.style.fontWeight="600"; info.innerText = summary;
    decryptForm.insertBefore(info, decryptForm.firstChild);
    // Warn if payload is very big
    const enc = params.get("msg") || "";
    const approxBytes = Math.ceil((enc.length * 3) / 4);
    if(approxBytes > MAX_BYTES) showToast("Warning: this link contains a large payload and may not work in some chat apps.");
  } else {
    encryptForm.style.display = "block"; decryptForm.style.display = "none";
  }
});