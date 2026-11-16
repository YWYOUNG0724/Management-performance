/* Vercel 실행용 어댑터: Claude 아티팩트의 window.claude.use(...) 기능을
   Vercel 서버 함수(/api/ai, /api/law)와 브라우저 저장소(IndexedDB)로 대신 제공한다. */
(function () {
  "use strict";
  const PASS_KEY = "kmcu_reg_pass";
  let passPromise = null;

  /* ---------- 접속 비밀번호 ---------- */
  function getPass() { try { return sessionStorage.getItem(PASS_KEY) || ""; } catch (e) { return window.__kmcuPass || ""; } }
  function setPass(v) { try { sessionStorage.setItem(PASS_KEY, v); } catch (e) { window.__kmcuPass = v; } }
  function askPass(msg) {
    if (passPromise) return passPromise;
    passPromise = new Promise(resolve => {
      const wrap = document.createElement("div");
      wrap.className = "modal-bg"; wrap.style.zIndex = "100";
      wrap.innerHTML = `<form class="modal" style="max-width:420px" id="passForm"><h2 style="font-size:18px">계명문화대 규정집 AI 검토</h2>
        <p class="mini" style="margin:0">${msg || "기획실에서 안내한 접속 비밀번호를 입력하십시오."}</p>
        <label class="f" for="passIn">접속 비밀번호<input type="password" id="passIn" autocomplete="current-password" style="background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:8px 10px"></label>
        <div class="row" style="justify-content:flex-end"><button class="btn primary" type="submit">확인</button></div></form>`;
      document.body.appendChild(wrap);
      const input = wrap.querySelector("#passIn"); setTimeout(() => input.focus(), 50);
      wrap.querySelector("#passForm").addEventListener("submit", e => { e.preventDefault(); const v = input.value.trim(); if (!v) return; setPass(v); wrap.remove(); passPromise = null; resolve(v); });
    });
    return passPromise;
  }
  async function api(path, body, method) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let pass = getPass(); if (!pass) pass = await askPass();
      let r;
      try {
        r = await fetch(path, { method: method || "POST", headers: { "content-type": "application/json", "x-app-pass": pass }, body: body ? JSON.stringify(body) : undefined });
      } catch (e) { throw { code: "server_unavailable", message: "서버에 연결하지 못했습니다. 인터넷 연결을 확인하십시오.", retryable: true }; }
      let data = null; try { data = await r.json(); } catch (e) {}
      if (r.status === 401) { setPass(""); await askPass("비밀번호가 올바르지 않습니다. 다시 입력하십시오."); continue; }
      if (!r.ok) throw { code: (data && data.error) || "upstream_error", message: (data && data.message) || ("서버 오류(" + r.status + ")"), status: r.status };
      return data;
    }
    throw { code: "not_granted", message: "비밀번호 확인에 실패했습니다." };
  }

  /* ---------- 저장소: IndexedDB 기반, Claude db와 같은 형태 ---------- */
  const store = new Map(); const subs = new Set(); let idb = null;
  const clone = o => JSON.parse(JSON.stringify(o));
  function openIdb() {
    return new Promise(res => {
      try {
        const rq = indexedDB.open("kmcu-reg-review", 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore("docs");
        rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  }
  function idbAll(db) {
    return new Promise(res => {
      const out = []; const tx = db.transaction("docs", "readonly"); const os = tx.objectStore("docs");
      const rq = os.openCursor();
      rq.onsuccess = () => { const c = rq.result; if (c) { out.push([c.key, c.value]); c.continue(); } else res(out); };
      rq.onerror = () => res(out);
    });
  }
  function idbPut(k, v) { if (!idb) return Promise.resolve(); return new Promise((res, rej) => { const tx = idb.transaction("docs", "readwrite"); v === undefined ? tx.objectStore("docs").delete(k) : tx.objectStore("docs").put(v, k); tx.oncomplete = res; tx.onerror = () => rej({ code: "quota_exceeded", message: "브라우저 저장 공간이 부족합니다." }); }); }
  function notify() { for (const s of subs) setTimeout(s, 0); }
  const meta = { fromCache: false, hasPendingWrites: false };
  function snapDoc(path) { const v = store.get(path); return { id: path.split("/").pop(), exists: !!v, data: () => (v ? clone(v) : undefined), metadata: meta }; }
  function docRef(path) {
    if (path.split("/").length % 2) throw new TypeError("document path needs an even number of segments: " + path);
    return {
      id: path.split("/").pop(), path,
      async get() { return snapDoc(path); },
      async set(d) { const c = clone(d); store.set(path, c); await idbPut(path, c); notify(); },
      async update(d) { if (!store.has(path)) throw { code: "invalid_argument", message: "document missing" }; const c = { ...store.get(path), ...clone(d) }; store.set(path, c); await idbPut(path, c); notify(); },
      async delete() { store.delete(path); await idbPut(path, undefined); notify(); },
      onSnapshot(next) { const fn = () => next(snapDoc(path)); subs.add(fn); setTimeout(fn, 0); return () => subs.delete(fn); },
      collection(p) { return query(path + "/" + p, {}); },
    };
  }
  function query(col, opts) {
    const depth = col.split("/").length + 1;
    function run() {
      let ds = [...store.keys()].filter(k => k.startsWith(col + "/") && k.split("/").length === depth).map(snapDoc);
      if (opts.f) ds.sort((a, b) => { const x = a.data()[opts.f], y = b.data()[opts.f]; return (x > y ? 1 : x < y ? -1 : 0) * (opts.d === "desc" ? -1 : 1); });
      else ds.sort((a, b) => (a.id > b.id ? 1 : -1));
      if (opts.n) ds = ds.slice(0, opts.n);
      return { docs: ds, size: ds.length, empty: !ds.length, docChanges: () => [], metadata: meta };
    }
    return {
      where() { return query(col, opts); },
      orderBy(f, d) { return query(col, { ...opts, f, d }); },
      limit(n) { return query(col, { ...opts, n }); },
      async get() { return run(); },
      onSnapshot(next) { const fn = () => next(run()); subs.add(fn); setTimeout(fn, 0); return () => subs.delete(fn); },
      doc(id) { return docRef(col + "/" + (id || Math.random().toString(36).slice(2))); },
      async add(d) { const r = docRef(col + "/" + Math.random().toString(36).slice(2)); await r.set(d); return r; },
    };
  }
  const dbReady = (async () => { idb = await openIdb(); if (idb) for (const [k, v] of await idbAll(idb)) store.set(k, v); })();
  const db = { __local: true, doc: docRef, collection: c => query(c, {}) };

  /* ---------- AI: 도구 사용 루프를 브라우저에서 수행 ---------- */
  function extractJson(text) {
    const s = String(text || ""); const m = s.match(/\{[\s\S]*\}/);
    try { return JSON.parse(m ? m[0] : s); } catch (e) { throw { code: "parse_error", message: "AI 응답이 JSON 형식이 아닙니다.", text: s }; }
  }
  async function sample(input, opts) {
    opts = opts || {};
    const messages = typeof input === "string" ? [{ role: "user", content: input }] : input.map(m => ({ role: m.role, content: m.content }));
    const tools = (opts.tools || []).map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema || { type: "object", properties: {} } }));
    const byName = Object.fromEntries((opts.tools || []).map(t => [t.name, t]));
    for (let turn = 0; turn < 16; turn++) {
      let r;
      try { r = await api("/api/ai", { messages, tools: tools.length ? tools : undefined, tier: opts.modelTier || "default" }); }
      catch (e) { if (e.status === 429) e.code = "rate_limited"; throw e; }
      const content = r.content || [];
      const text = content.filter(c => c.type === "text").map(c => c.text).join("");
      if (opts.onText) try { opts.onText({ text, delta: text }); } catch (e) {}
      if (r.stop_reason !== "tool_use") return { text, truncated: r.stop_reason === "max_tokens" };
      messages.push({ role: "assistant", content });
      const results = [];
      for (const c of content.filter(x => x.type === "tool_use")) {
        const t = byName[c.name];
        let out, isErr = false;
        try { out = t ? await t.execute(c.input || {}) : "알 수 없는 도구"; isErr = !t; }
        catch (e) { out = String((e && e.message) || e); isErr = true; }
        results.push({ type: "tool_result", tool_use_id: c.id, content: typeof out === "string" ? out : JSON.stringify(out), is_error: isErr });
      }
      messages.push({ role: "user", content: results });
    }
    throw { code: "upstream_error", message: "AI 도구 호출 횟수가 한도를 넘었습니다." };
  }
  sample.json = async (input, opts) => extractJson((await sample(input, opts)).text);
  sample.limits = async () => ({ images: false });

  /* ---------- 법령 조회 (Korean Law 대체: 법제처 Open API) ---------- */
  const LAW_TOOLS = {
    search_law: { description: "법령명·키워드로 현행 법령 검색. 결과의 mst(법령일련번호)로 get_law_text 조회", inputSchema: { type: "object", properties: { query: { type: "string", description: "법령명 또는 키워드 (예: 고등교육법 시행령)" } }, required: ["query"] } },
    get_law_text: { description: "법령 조문 조회. mst 필수. jo(예: 제19조)를 주면 해당 조문 본문, 생략하면 조문 목차", inputSchema: { type: "object", properties: { mst: { type: "string" }, lawId: { type: "string" }, jo: { type: "string", description: "조문 번호 예: 제19조, 제11조의2" } } } },
  };
  const mcp = {
    __vercel: true,
    async listTools(server) { if (server && server !== "Korean Law") return { servers: [] }; return { servers: [{ server: "Korean Law", authStatus: "connected", tools: Object.keys(LAW_TOOLS).map(n => ({ name: n, description: LAW_TOOLS[n].description })) }] }; },
    async describeTool(server, tool) { const t = LAW_TOOLS[tool]; if (!t) throw { code: "not_in_manifest" }; return { name: tool, description: t.description, inputSchema: t.inputSchema }; },
    async callTool(server, tool, input) {
      if (!LAW_TOOLS[tool]) throw { code: "not_in_manifest", message: "지원하지 않는 법령 도구" };
      const data = await api("/api/law", { tool, input: input || {} });
      return { content: [{ type: "text", text: JSON.stringify(data) }], payload: data };
    },
    async invalidate() {},
  };

  /* ---------- 내려받기 ---------- */
  const downloads = {
    direct: true,
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      return { status: "saved" };
    },
  };
  const user = { can: async () => true, id: async () => "local", canEdit: async () => true, isOwner: async () => true };

  const caps = { db, sample, mcp, downloads, user };
  window.claude = { use: async name => { if (name === "db") await dbReady; return caps[name] || null; } };
  // 접속 시 비밀번호를 먼저 확인
  window.addEventListener("load", () => { api("/api/health", null, "GET").then(h => { window.__kmcuHealth = h; }).catch(e => { window.__kmcuHealthErr = e; }); });
})();
