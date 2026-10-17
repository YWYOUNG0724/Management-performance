// 성과관리시스템 API (Netlify Functions + Netlify Blobs)
// - GET  /api/data       현재 데이터
// - GET  /api/history    최근 수정 이력
// - POST /api/actuals    ’26 실적 저장 (접속코드·수정 PIN 없음, 입력자 이름만 기록)
// - GET  /api/ai-status  Claude AI 요약 사용 가능 여부
// - GET  /api/ping
import { store, loadData, loadHistory, json, numOrNull, MAX_HISTORY } from "../lib/store.mjs";

const MAX_BODY = 200 * 1024;

export default async (req) => {
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  try {
    if (req.method === "GET") {
      if (path === "/api/ping") return json({ ok: true, time: new Date().toISOString() });
      if (path === "/api/ai-status") {
        return json({ enabled: !!process.env.ANTHROPIC_API_KEY, model: process.env.AI_MODEL || "claude-sonnet-5-5" });
      }
      const s = store();
      if (path === "/api/data") return json(await loadData(s));
      if (path === "/api/history") return json((await loadHistory(s)).slice(0, 30));
      return json({ error: "없는 주소입니다" }, 404);
    }
    if (req.method === "POST" && path === "/api/actuals") return await saveActuals(req);
    return json({ error: "허용되지 않은 요청입니다" }, 405);
  } catch (e) {
    console.error(e);
    return json({ error: "서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }, 500);
  }
};

async function saveActuals(req) {
  const raw = await req.text();
  if (!raw || raw.length > MAX_BODY) return json({ error: "요청 크기가 올바르지 않습니다" }, 400);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "JSON 형식이 아닙니다" }, 400);
  }
  const editor = String(body.editor || "").trim().slice(0, 40);
  if (!editor) return json({ error: "입력자 이름을 적어 주세요" }, 400);

  const s = store();
  const data = await loadData(s);
  if (body.version !== data.version) {
    return json({ error: "다른 사용자가 먼저 수정했습니다. 최신 내용으로 바뀌었으니 다시 입력해 주세요.", data }, 409);
  }

  const subs = {};
  for (const ix of data.indices) for (const sub of ix.subs) subs[sub.id] = sub;
  const changes = [];
  try {
    for (const [sid, item] of Object.entries(body.actuals || {})) {
      const sub = subs[sid];
      if (!sub || !item || typeof item !== "object") continue;
      const val = numOrNull(item.c26);
      const note = String(item.n26 ?? "").slice(0, 300);
      const flag = !!item.flag26;
      if (val !== (sub.c26 ?? null)) {
        changes.push(`${sub.name} ${sub.c26 ?? "집계 전"} → ${val ?? "집계 전"}`);
        sub.c26 = val;
      }
      if (note !== (sub.n26 || "")) {
        sub.n26 = note;
        if (!changes.some((c) => c.startsWith(sub.name))) changes.push(`${sub.name} 비고 수정`);
      }
      if (flag !== !!sub.flag26) {
        sub.flag26 = flag;
        changes.push(`${sub.name} 확인필요 ${flag ? "표시" : "해제"}`);
      }
    }
  } catch (e) {
    return json({ error: `숫자 입력값을 확인해 주세요 (${e.message})` }, 400);
  }

  const asOf = String(body.asOf || "").trim().slice(0, 10);
  if (asOf && asOf !== data.meta.asOf) {
    changes.push(`집계 기준일 ${data.meta.asOf} → ${asOf}`);
    data.meta.asOf = asOf;
  }
  if (!changes.length) return json({ ok: true, data, unchanged: true });

  const prevVersion = data.version;
  const now = new Date().toISOString();
  data.version = (data.version || 0) + 1;
  data.meta.updatedAt = now;
  data.meta.updatedBy = editor;

  // 저장 직전 데이터를 버전별로 자동 백업한 뒤 저장
  const prev = await s.get("data", { type: "json" });
  if (prev) await s.setJSON(`backups/v${String(prevVersion).padStart(5, "0")}`, prev);
  await s.setJSON("data", data);

  const history = await loadHistory(s);
  history.unshift({ at: now, editor, version: data.version, changes });
  await s.setJSON("history", history.slice(0, MAX_HISTORY));

  return json({ ok: true, data });
}

export const config = {
  path: ["/api/data", "/api/history", "/api/actuals", "/api/ai-status", "/api/ping"],
};
