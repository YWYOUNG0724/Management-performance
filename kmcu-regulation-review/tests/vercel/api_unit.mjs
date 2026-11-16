// 서버 함수 단위 테스트: 인증, 설정 누락, 조문 번호 변환
import assert from "node:assert"; import path from "node:path"; import url from "node:url";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../../vercel");
const { joCode, flatten } = await import(path.join(ROOT, "api/law.js"));
const ai = (await import(path.join(ROOT, "api/ai.js"))).default;
const mk = (headers = {}, body) => ({ method: "POST", headers, body, query: {} });
const res = () => { const r = { code: 0, body: null }; r.status = c => { r.code = c; return r; }; r.json = o => { r.body = o; return r; }; return r; };
let ok = 0; const t = (n, f) => { f(); ok++; console.log("PASS", n); };
t("조문번호 변환", () => { assert.equal(joCode("제11조"), "001100"); assert.equal(joCode("제11조의2"), "001102"); assert.equal(joCode("19"), "001900"); });
t("조문 평탄화", () => assert.deepEqual(flatten({ "조문내용": "제1조(목적)", "항": [{ "항내용": "① 가" }, { "항내용": "② 나", "호": [{ "호내용": "1. 다" }] }] }), ["제1조(목적)", "① 가", "② 나", "1. 다"]));
delete process.env.APP_PASSWORD; let r = res(); await ai(mk({}, { messages: [{ role: "user", content: "x" }] }), r); assert.equal(r.code, 503); console.log("PASS 비밀번호 미설정 시 차단(503)"); ok++;
process.env.APP_PASSWORD = "pw"; r = res(); await ai(mk({ "x-app-pass": "no" }, { messages: [{ role: "user", content: "x" }] }), r); assert.equal(r.code, 401); console.log("PASS 틀린 비밀번호 401"); ok++;
delete process.env.ANTHROPIC_API_KEY; r = res(); await ai(mk({ "x-app-pass": "pw" }, { messages: [{ role: "user", content: "x" }] }), r); assert.equal(r.code, 503); console.log("PASS AI 키 미설정 안내(503)"); ok++;
console.log(`단위 테스트 ${ok}개 통과`);
