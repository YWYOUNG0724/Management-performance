// Claude AI 요약 보고서 (Netlify Edge Function, 스트리밍)
// - API 키는 Netlify 환경변수 ANTHROPIC_API_KEY 에만 보관 (브라우저로 전달되지 않음)
// - 모델은 환경변수 AI_MODEL (기본 claude-sonnet-5-5)
const SYSTEM =
  "당신은 전문대학혁신지원사업 성과관리 전문가입니다. 제공된 JSON 데이터만 근거로 사업단 내부 보고용 요약 보고서를 한국어 개조식으로 작성하세요. " +
  "규칙: 1) 데이터에 없는 수치·사실을 만들지 말 것 2) 진행률 구간은 70% 이상 양호, 60~70% 관찰, 60% 미만 집중관리로 판단 " +
  "3) ’26 값은 중간 집계로 확정 실적이 아님을 전제 4) 다음 제목을 마크다운 ## 으로 순서대로 사용: ## 핵심 요약 (3줄 이내), ## 지표별 진단, " +
  '## 집중관리 대상, ## 데이터 신뢰도 유의사항, ## 권고 조치 (담당부서 명시) 5) 각 항목은 "- " 로 시작하는 개조식, 문장은 "~함/~임" 형태로 간결하게.';

const MAX_FACTS = 30000;

function jsonRes(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function sseToText() {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let buf = "";
  const handle = (line, ctl) => {
    line = line.trim();
    if (!line.startsWith("data:")) return;
    try {
      const ev = JSON.parse(line.slice(5).trim());
      if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") ctl.enqueue(enc.encode(ev.delta.text));
      else if (ev.type === "error") ctl.enqueue(enc.encode("\n\n[오류] " + ((ev.error && ev.error.message) || "AI 응답 중 오류")));
    } catch {
      /* 무시 */
    }
  };
  return new TransformStream({
    transform(chunk, ctl) {
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        handle(buf.slice(0, i), ctl);
        buf = buf.slice(i + 1);
      }
    },
    flush(ctl) {
      if (buf) handle(buf, ctl);
    },
  });
}

export default async (req) => {
  if (req.method !== "POST") return jsonRes({ error: "허용되지 않은 요청입니다" }, 405);
  const env = (k) => (typeof Netlify !== "undefined" ? Netlify.env.get(k) : undefined);
  const key = env("ANTHROPIC_API_KEY");
  const model = env("AI_MODEL") || "claude-sonnet-5-5";
  if (!key) return jsonRes({ error: "Netlify 환경변수 ANTHROPIC_API_KEY 가 설정되지 않았습니다" }, 503);

  let facts;
  try {
    facts = JSON.stringify((await req.json()).facts || {});
  } catch {
    return jsonRes({ error: "요청 형식이 올바르지 않습니다" }, 400);
  }
  if (facts.length > MAX_FACTS) return jsonRes({ error: "요청 데이터가 너무 큽니다" }, 413);

  let upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        stream: true,
        system: SYSTEM,
        messages: [{ role: "user", content: "다음 성과지표 데이터를 요약 보고서로 작성해 주세요.\n" + facts }],
      }),
    });
  } catch {
    return jsonRes({ error: "AI 서버에 연결하지 못했습니다" }, 502);
  }
  if (!upstream.ok || !upstream.body) {
    const t = await upstream.text().catch(() => "");
    let msg = "";
    try {
      msg = JSON.parse(t).error.message;
    } catch {
      msg = t.slice(0, 200);
    }
    return jsonRes({ error: `API 오류 ${upstream.status} ${msg}`.trim() }, 502);
  }
  return new Response(upstream.body.pipeThrough(sseToText()), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-ai-model": model },
  });
};

export const config = { path: "/api/ai-summary" };
