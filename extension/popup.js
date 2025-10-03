const API = "https://quickguard.onrender.com"; // غيّريها لو رابطك مختلف
const out = document.getElementById("out");

async function getCurrentTabUrl(){
  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  return tab?.url || "";
}
function isHttpUrl(u){
  try { const x=new URL(u); return x.protocol==="http:"||x.protocol==="https:"; }
  catch { return false; }
}

document.getElementById("scan").onclick = async ()=>{
  out.textContent = "Scanning…";
  try{
    const url = await getCurrentTabUrl();
    if(!isHttpUrl(url)){ out.textContent = "افتح صفحة ويب تبدأ بـ http(s):// ثم جرّب مرة أخرى."; return; }

    const r = await fetch(`${API}/scan`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ url })
    });
    if(!r.ok){ out.textContent = `API error ${r.status}`; return; }

    const data = await r.json();
    out.innerHTML =
      `<b>${data.url}</b>\n` +
      `النتيجة: <span style="font-weight:700; color:${
        data.verdict === "pass" ? "#16a34a" : data.verdict === "warn" ? "#eab308" : "#ef4444"
      }">${(data.verdict || "—").toUpperCase()}</span> (${data.score ?? "—"})\n` +
      `${(data.details || []).join(", ") || "لا ملاحظات"}`;
  }catch(e){
    out.textContent = "تعذّر الاتصال بالخدمة — تأكد من رابط API.";
  }
};
