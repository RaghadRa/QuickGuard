// QuickGuard API (Express)
// ملاحظات:
// - يستخدم منفذ Render تلقائيًا (PORT)
// - تخزين النتائج بالذاكرة (للتجارب/الديمو)
// - تحليل بسيط للهيدرز لإخراج score + verdict + details

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());             // إن أردتِ التقييد: cors({ origin: ["https://YOUR-DOMAIN"] })
app.use(express.json());

const scans = [];      // أحدث النتائج أولاً
const keep = 50;       // أقصى عدد نتائج مخزنة

function evaluateHeaders(headers, status, contentType) {
  const det = [];
  let score = 100;

  const hsts = headers.get("strict-transport-security");
  const csp  = headers.get("content-security-policy");
  const xfo  = headers.get("x-frame-options");

  if (!hsts) { det.push("Missing HSTS"); score -= 25; }
  if (!csp)  { det.push("Missing CSP"); score -= 25; }
  if (!xfo)  { det.push("Missing X-Frame-Options"); score -= 20; }

  if (contentType && !contentType.includes("text/html") && !contentType.includes("application")) {
    det.push("Unusual Content-Type");
    score -= 5;
  }

  if (status >= 400) {
    det.push(`HTTP ${status}`);
    score -= 20;
  }

  if (score < 0) score = 0;
  let verdict = "warn";
  if (score >= 85) verdict = "pass";
  else if (score <= 60) verdict = "fail";

  return { score, verdict, details: det };
}

app.get("/", (_req, res) => {
  res.type("text/plain").send("QuickGuard API is running.");
});

app.get("/recent", (_req, res) => {
  res.json({ ok: true, scans });
});

app.post("/scan", async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ ok: false, error: "url required" });

    let status = 0, ct = "";
    let t0 = Date.now();
    try {
      // نستخدم GET عشان بعض المواقع تمنع HEAD
      const r = await fetch(url, { method: "GET", redirect: "follow" });
      status = r.status;
      ct = r.headers.get("content-type") || "";
      var headers = r.headers; // للإرسال للتقييم
    } catch (e) {
      // محاولة أخيرة لجلب الهيدر فقط
      try {
        const r2 = await fetch(url, { method: "HEAD", redirect: "follow" });
        status = r2.status;
        ct = r2.headers.get("content-type") || "";
        var headers = r2.headers;
      } catch (e2) {
        return res.status(502).json({ ok: false, error: "fetch_failed" });
      }
    }
    const ms = Date.now() - t0;

    const { score, verdict, details } = evaluateHeaders(headers, status, ct);
    const item = { ok: true, url, headers: { hsts: headers.get("strict-transport-security") || null,
                                              csp: headers.get("content-security-policy") || null,
                                              xfo: headers.get("x-frame-options") || null,
                                              ct },
                   score, verdict, details, ms, at: new Date().toISOString() };

    scans.unshift(item);
    if (scans.length > keep) scans.length = keep;

    res.json(item);
  } catch (err) {
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`QuickGuard server on http://localhost:${PORT}`);
});
