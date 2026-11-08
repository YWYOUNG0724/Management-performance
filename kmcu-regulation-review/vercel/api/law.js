// 국가법령정보 공동활용(법제처 Open API) 조회: search_law, get_law_text
import { checkAuth, readJson } from "../lib/auth.js";
export const config = { maxDuration: 60 };
const BASE = "https://www.law.go.kr/DRF";
export function joCode(jo) {
  // "제11조" → "001100", "제11조의2" → "001102", "11" → "001100"
  const m = String(jo || "").match(/(\d+)\s*조?(?:\s*의\s*(\d+))?/);
  if (!m) return null;
  return String(m[1]).padStart(4, "0") + String(m[2] || 0).padStart(2, "0");
}
export function flatten(v, out = []) {
  if (v == null) return out;
  if (typeof v === "string") { const t = v.trim(); if (t) out.push(t); return out; }
  if (Array.isArray(v)) { v.forEach(x => flatten(x, out)); return out; }
  if (typeof v === "object") {
    for (const k of ["조문내용", "항내용", "호내용", "목내용"]) if (v[k]) flatten(v[k], out);
    for (const k of ["항", "호", "목"]) if (v[k]) flatten(v[k], out);
  }
  return out;
}
export async function searchLaw(oc, query, fetchImpl = fetch) {
  const u = `${BASE}/lawSearch.do?OC=${encodeURIComponent(oc)}&target=law&type=JSON&display=10&query=${encodeURIComponent(query)}`;
  const r = await fetchImpl(u); if (!r.ok) throw new Error("law_http_" + r.status);
  const j = await r.json();
  let list = (j && j.LawSearch && j.LawSearch.law) || [];
  if (!Array.isArray(list)) list = [list];
  return { query, count: list.length, laws: list.slice(0, 10).map(l => ({ name: l["법령명한글"], mst: String(l["법령일련번호"] || ""), lawId: String(l["법령ID"] || ""), efYd: l["시행일자"], promulgated: l["공포일자"], ministry: l["소관부처명"], kind: l["법령구분명"] })) };
}
export async function getLawText(oc, { mst, lawId, jo }, fetchImpl = fetch) {
  const id = mst ? `MST=${encodeURIComponent(mst)}` : lawId ? `ID=${encodeURIComponent(lawId)}` : null;
  if (!id) throw Object.assign(new Error("mst 또는 lawId가 필요합니다."), { status: 400 });
  const code = jo ? joCode(jo) : null;
  const u = `${BASE}/lawService.do?OC=${encodeURIComponent(oc)}&target=law&type=JSON&${id}${code ? `&JO=${code}` : ""}`;
  const r = await fetchImpl(u); if (!r.ok) throw new Error("law_http_" + r.status);
  const j = await r.json();
  const law = j && (j["법령"] || j.Law || j);
  const info = (law && law["기본정보"]) || {};
  let units = law && law["조문"] && law["조문"]["조문단위"];
  if (units && !Array.isArray(units)) units = [units];
  units = (units || []).filter(u => u["조문여부"] !== "전문");
  const articles = units.map(u => ({ jo: `제${u["조문번호"]}조${u["조문가지번호"] ? "의" + u["조문가지번호"] : ""}`, title: u["조문제목"] || "", text: flatten(u).join("\n") }));
  const name = info["법령명_한글"] || info["법령명한글"] || "";
  const efYd = info["시행일자"] || "";
  if (code) return { law: name, efYd, articles: articles.slice(0, 3) };
  return { law: name, efYd, articleCount: articles.length, toc: articles.map(a => `${a.jo}(${a.title})`).slice(0, 400), note: "특정 조문 본문은 jo(예: 제11조)를 지정해 다시 조회하십시오." };
}
export default async function handler(req, res) {
  if (!checkAuth(req, res)) return;
  const oc = process.env.LAW_OC;
  if (!oc) return res.status(503).json({ error: "server_not_connected", message: "LAW_OC(법제처 Open API 인증키)가 설정되지 않았습니다." });
  let p;
  try { p = req.method === "POST" ? await readJson(req, 20000) : req.query || {}; } catch { return res.status(400).json({ error: "bad_request" }); }
  const tool = p.tool; const input = p.input || p;
  try {
    if (tool === "search_law") { if (!input.query) return res.status(400).json({ error: "bad_request", message: "query가 필요합니다." }); return res.status(200).json(await searchLaw(oc, String(input.query).slice(0, 100))); }
    if (tool === "get_law_text") return res.status(200).json(await getLawText(oc, input));
    if (tool === "ping") return res.status(200).json(await searchLaw(oc, "고등교육법"));
    return res.status(400).json({ error: "bad_request", message: "지원하지 않는 도구입니다." });
  } catch (e) {
    return res.status(e.status || 502).json({ error: e.status ? "bad_request" : "server_unavailable", message: e.status ? e.message : "법제처 Open API 응답을 받지 못했습니다. OC 인증키와 등록 도메인을 확인하십시오." });
  }
}
