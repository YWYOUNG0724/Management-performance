// Claude(Anthropic Messages API) 호출. 브라우저가 도구 사용 루프를 돌리므로 여기서는 한 턴만 처리한다.
import { checkAuth, readJson } from "../lib/auth.js";
export const config = { maxDuration: 300 };
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!checkAuth(req, res)) return;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: "server_not_configured", message: "ANTHROPIC_API_KEY가 설정되지 않았습니다." });
  let body;
  try { body = await readJson(req); } catch (e) { return res.status(e.status || 400).json({ error: "bad_request", message: "요청이 너무 크거나 형식이 잘못되었습니다." }); }
  const { messages, tools, tier } = body || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: "bad_request", message: "messages가 없습니다." });
  const model = tier === "complex" ? (process.env.ANTHROPIC_MODEL_COMPLEX || "claude-opus-5-5") : (process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5");
  const payload = { model, max_tokens: 16000, messages };
  if (Array.isArray(tools) && tools.length) payload.tools = tools.slice(0, 20).map(t => ({ name: String(t.name), description: String(t.description || "").slice(0, 1000), input_schema: t.input_schema || { type: "object", properties: {} } }));
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) {
      const code = r.status === 429 ? "rate_limited" : "upstream_error";
      return res.status(r.status === 429 ? 429 : 502).json({ error: code, message: (data && data.error && data.error.message) || "AI 호출 실패" });
    }
    return res.status(200).json({ content: data.content, stop_reason: data.stop_reason, model: data.model, usage: data.usage });
  } catch (e) {
    return res.status(502).json({ error: "upstream_error", message: "AI 서버에 연결하지 못했습니다." });
  }
}
