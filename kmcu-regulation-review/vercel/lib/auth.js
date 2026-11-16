// 접속 비밀번호 확인 (환경변수 APP_PASSWORD 미설정 시 모든 요청 거부: 공개 AI 프록시 방지)
import crypto from "node:crypto";
export function checkAuth(req, res) {
  const expected = process.env.APP_PASSWORD || "";
  const given = String(req.headers["x-app-pass"] || "");
  if (!expected) { res.status(503).json({ error: "server_not_configured", message: "서버에 APP_PASSWORD가 설정되지 않았습니다. Vercel 환경변수를 확인하십시오." }); return false; }
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  if (!crypto.timingSafeEqual(a, b)) { res.status(401).json({ error: "unauthorized", message: "비밀번호가 올바르지 않습니다." }); return false; }
  return true;
}
export async function readJson(req, limit = 1_500_000) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) { raw += chunk; if (raw.length > limit) throw Object.assign(new Error("too_large"), { status: 413 }); }
  return raw ? JSON.parse(raw) : {};
}
