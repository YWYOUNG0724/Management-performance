// 테스트용 로컬 서버: vercel/api 핸들러를 그대로 실행하고, 외부 API(Anthropic·법제처)만 가짜 응답으로 대체
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import url from "node:url";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../../vercel");
process.env.APP_PASSWORD = process.env.APP_PASSWORD ?? "test-pass";
process.env.ANTHROPIC_API_KEY = "sk-test"; process.env.LAW_OC = "testoc";
globalThis.__calls = [];
const LAWS = { "고등교육법": { mst: "270001", name: "고등교육법", arts: { "002300": ["제23조(학점의 인정 등)", "① 학교는 … 학점을 인정할 수 있다."] } },
  "고등교육법 시행령": { mst: "270002", name: "고등교육법 시행령", arts: { "001900": ["제19조(휴학)", "① 학생은 학칙으로 정하는 바에 따라 휴학할 수 있다.", "② 휴학 기간은 학칙으로 정한다."] } } };
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, opt = {}) => {
  u = String(u); globalThis.__calls.push(u.split("?")[0]);
  const J = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { "content-type": "application/json" } });
  if (u.startsWith("https://www.law.go.kr/DRF/lawSearch.do")) {
    const q = new URL(u).searchParams.get("query"); const hit = Object.values(LAWS).filter(l => l.name === q || q.includes(l.name));
    return J({ LawSearch: { law: hit.map(l => ({ "법령명한글": l.name, "법령일련번호": l.mst, "법령ID": "00" + l.mst, "시행일자": "20260301", "소관부처명": "교육부" })) } });
  }
  if (u.startsWith("https://www.law.go.kr/DRF/lawService.do")) {
    const sp = new URL(u).searchParams; const l = Object.values(LAWS).find(x => x.mst === sp.get("MST")); const jo = sp.get("JO");
    const arts = Object.entries(l.arts).filter(([k]) => !jo || k === jo).map(([k, v]) => ({ "조문번호": String(+k.slice(0, 4)), "조문여부": "조문", "조문제목": v[0].replace(/^제\d+조\(|\)$/g, ""), "조문내용": v[0], "항": v.slice(1).map(t => ({ "항내용": t })) }));
    return J({ "법령": { "기본정보": { "법령명_한글": l.name, "시행일자": "20260301" }, "조문": { "조문단위": arts } } });
  }
  if (u === "https://api.anthropic.com/v1/messages") {
    const b = JSON.parse(opt.body); if (opt.headers["x-api-key"] !== "sk-test") return J({ error: { message: "bad key" } }, 401);
    const last = b.messages[b.messages.length - 1]; const first = String(b.messages[0].content);
    const txt = o => J({ content: [{ type: "text", text: JSON.stringify(o) }], stop_reason: "end_turn", model: b.model });
    if (b.tools) {
      const results = b.messages.filter(m => Array.isArray(m.content) && m.content[0] && m.content[0].type === "tool_result");
      if (results.length === 0) return J({ content: [{ type: "tool_use", id: "t1", name: "search_law", input: { query: "고등교육법 시행령" } }], stop_reason: "tool_use", model: b.model });
      if (results.length === 1) { const ls = JSON.parse(results[0].content[0].content).laws; const mst = (ls.find(l => l.name === "고등교육법 시행령") || ls[0]).mst; return J({ content: [{ type: "tool_use", id: "t2", name: "get_law_text", input: { mst, jo: "제19조" } }], stop_reason: "tool_use", model: b.model }); }
      const law = JSON.parse(results[1].content[0].content); const a = law.articles[0];
      return txt({ lawSummary: "학사운영규정 휴학 기간이 고등교육법 시행령 제19조의 위임 취지(학칙으로 정함)와 학칙 기준을 벗어납니다.", conflicts: [{ type: "상위법 상충", severity: "높음", title: "휴학 기간 규정의 상위법 정합성", regA: "(예시) 학사운영규정", articleA: "제12조 제1항", textA: "일반휴학 기간은 통산 4년을 초과할 수 없다.", regB: law.law, articleB: a.jo, textB: a.text, lawDate: law.efYd, issue: "시행령이 학칙에 위임한 사항을 하위 규정이 다르게 정함", recommendation: "학칙 기준(3년)으로 통일" }] });
    }
    if (first.includes("신구조문대비표")) return txt({ title: "휴학 기간 상한 일치화 개정안", rows: [{ reg: "(예시) 학사운영규정", article: "제12조 제1항", current: "일반휴학 기간은 통산 4년을 초과할 수 없다.", revised: "일반휴학 기간은 통산 3년을 초과할 수 없다.", reason: "학칙 제35조 제2항 및 고등교육법 시행령 제19조" }], note: "재학생 경과조치 검토" });
    return txt({ summary: "학칙과 학사운영규정의 휴학 기간·성적 등급이 다릅니다.", conflicts: [{ type: "위계 위반", severity: "높음", title: "휴학 기간 상한 불일치", regA: "(예시) 학칙", articleA: "제35조 제2항", textA: "통산 3년", regB: "(예시) 학사운영규정", articleB: "제12조 제1항", textB: "통산 4년", issue: "하위 규정이 더 긺", recommendation: "3년으로 개정" }], terms: [{ standard: "학과장", variants: ["학과주임"], regs: ["(예시) 학사운영규정"], note: "학칙 용어" }], orgs: [{ found: "학생복지처장", suggested: "학생처장", locations: ["(예시) 장학금지급규정 제5조"], basis: "기준 조직표" }] });
  }
  return realFetch(u, opt);
};
const handlers = { ai: (await import(path.join(ROOT, "api/ai.js"))).default, law: (await import(path.join(ROOT, "api/law.js"))).default, health: (await import(path.join(ROOT, "api/health.js"))).default };
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript" };
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/__calls") { res.end(JSON.stringify(globalThis.__calls)); return; }
  const m = u.pathname.match(/^\/api\/(\w+)$/);
  if (m && handlers[m[1]]) {
    req.query = Object.fromEntries(u.searchParams);
    res.status = c => { res.statusCode = c; return res; }; res.json = o => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); return res; };
    try { await handlers[m[1]](req, res); } catch (e) { res.statusCode = 500; res.end(String(e)); } return;
  }
  const f = path.join(ROOT, "public", u.pathname === "/" ? "index.html" : u.pathname);
  if (fs.existsSync(f) && f.startsWith(path.join(ROOT, "public"))) { res.setHeader("content-type", TYPES[path.extname(f)] || "application/octet-stream"); fs.createReadStream(f).pipe(res); }
  else { res.statusCode = 404; res.end("not found"); }
}).listen(Number(process.env.PORT || 4317), () => console.log("ready"));
