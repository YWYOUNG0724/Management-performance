"""Vercel판 종단 테스트: 실제 api 핸들러 + shim.js + 앱 (외부 API만 가짜)"""
import asyncio, os, subprocess, time, json, urllib.request, zipfile, io
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__)); PORT="4317"; BASE=f"http://127.0.0.1:{PORT}"
results=[]
def check(n,c,d=""): results.append((n,bool(c))); print(("PASS " if c else "FAIL ")+n+(" :: "+str(d)[:200] if d else ""))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("CHROME","/usr/bin/google-chrome"),args=["--no-sandbox"])
        ctx=await b.new_context(accept_downloads=True,viewport={"width":1366,"height":900})
        async def cdn(route):
            u=route.request.url
            if "jszip" in u: await route.fulfill(path=os.environ.get("JSZIP","node_modules/jszip/dist/jszip.min.js"),content_type="text/javascript")
            else: await route.abort()
        await ctx.route("https://**/*",cdn)
        pg=await ctx.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
        await pg.goto(BASE+"/"); await pg.wait_for_timeout(800)
        check("접속 시 비밀번호 창 표시",await pg.is_visible("#passIn"))
        await pg.fill("#passIn","wrong"); await pg.click("#passForm button"); await pg.wait_for_timeout(600)
        check("틀린 비밀번호 재요청","올바르지 않습니다" in await pg.inner_text("body") and await pg.is_visible("#passIn"))
        await pg.fill("#passIn","test-pass"); await pg.click("#passForm button"); await pg.wait_for_timeout(600)
        check("올바른 비밀번호 통과",not await pg.is_visible("#passIn"))
        check("저장소 표시: 이 PC 브라우저", "이 PC 브라우저에 저장" in await pg.inner_text("#stDB"))
        await pg.click("#btnDemo"); await pg.wait_for_timeout(800)
        check("예시 규정 등록",await pg.locator("tbody tr").count()==3)
        await pg.reload(); await pg.wait_for_timeout(1000)
        if await pg.is_visible("#passIn"): await pg.fill("#passIn","test-pass"); await pg.click("#passForm button"); await pg.wait_for_timeout(500)
        await pg.click(".nav [data-v=list]"); await pg.wait_for_timeout(300)
        check("새로고침 후 브라우저 저장 유지(IndexedDB)",await pg.locator("tbody tr").count()==3)
        await pg.click(".nav [data-v=run]"); await pg.wait_for_timeout(300)
        await pg.click("#lawTest"); await pg.wait_for_timeout(800)
        check("법령 연결 확인 버튼(실제 /api/law)","연결됨" in await pg.inner_text("#lawTestOut"),await pg.inner_text("#lawTestOut"))
        await pg.click("#btnRun"); await pg.wait_for_timeout(4000)
        t=await pg.inner_text("#view")
        check("분석 완료·대시보드 이동","AI 종합 의견" in t,t[:120])
        check("상위 법령 요약 표시","고등교육법 시행령 제19조" in t, await pg.evaluate("JSON.stringify({e:S.analysis.lawErr,c:S.analysis.lawChecked})"))
        calls=json.loads(urllib.request.urlopen(BASE+"/__calls").read())
        check("서버→Anthropic 호출",calls.count("https://api.anthropic.com/v1/messages")>=4,calls)
        check("서버→법제처 검색·조문 호출","https://www.law.go.kr/DRF/lawSearch.do" in calls and "https://www.law.go.kr/DRF/lawService.do" in calls)
        await pg.click(".nav [data-v=conflicts]"); await pg.wait_for_timeout(300); v=await pg.inner_text("#view")
        check("상위법 조문 원문(법제처 응답) 표시","학칙으로 정하는 바에 따라 휴학" in v and "상위 법령" in v,v[:300])
        await pg.locator("[data-draft='c:0']").click(); await pg.wait_for_timeout(2500)
        check("개정안 생성","통산 3년을 초과할 수 없다" in await pg.inner_text("#view"))
        await pg.click(".nav [data-v=report]"); await pg.wait_for_timeout(300)
        async with pg.expect_download() as dl: await pg.click("#dlReport")
        d=await dl.value; fp=os.path.join(HERE,"vercel_report.hwpx"); await d.save_as(fp)
        check("HWPX 직접 내려받기(.hwpx)",d.suggested_filename.endswith(".hwpx"),d.suggested_filename)
        z=zipfile.ZipFile(fp); first=z.infolist()[0]
        check("HWPX mimetype 첫 항목·무압축",first.filename=="mimetype" and first.compress_type==0)
        sec=z.read("Contents/section0.xml").decode()
        check("HWPX에 상위 법령 대조 포함","상위 법령 대조" in sec and "고등교육법 시행령" in sec)
        check("페이지 스크립트 오류 없음",not errs,errs)
        await b.close()
    print("\n결과: %d/%d 통과"%(sum(r[1] for r in results),len(results)))
srv=subprocess.Popen(["node",os.path.join(HERE,"devserver.mjs")],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,env={**os.environ,"PORT":PORT})
try:
    srv.stdout.readline(); asyncio.run(main())
finally: srv.terminate()
