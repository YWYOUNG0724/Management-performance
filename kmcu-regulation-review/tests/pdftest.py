import asyncio
from playwright.async_api import async_playwright
import os
HERE=os.path.dirname(os.path.abspath(__file__))
MOCK=open(os.path.join(HERE,"mock.js"),encoding="utf-8").read()
D=os.environ.get("PDFJS_DIR","node_modules/pdfjs-dist/legacy/build/")
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("CHROME","/usr/bin/google-chrome"),args=["--no-sandbox","--allow-file-access-from-files"]);c=await b.new_context()
    async def h(route):
      u=route.request.url
      if u.endswith("pdf.worker.min.js"): await route.fulfill(path=D+"pdf.worker.min.mjs",content_type="text/javascript")
      else: await route.abort()
    await c.route("https://**/*",h)
    pg=await c.new_page();errs=[];pg.on("pageerror",lambda e:errs.append(str(e)))
    await pg.add_init_script(MOCK)
    await pg.goto("file://"+os.path.join(HERE,"..","app","index.html"));await pg.wait_for_timeout(500)
    # 앱이 기대하는 window.pdfjsLib 를 실제 pdf.js(6.x)로 주입
    await pg.add_script_tag(type="module",content=f"import * as L from 'file://{D}pdf.min.mjs'; L.GlobalWorkerOptions.workerSrc='file://{D}pdf.worker.min.mjs'; window.pdfjsLib={{getDocument:(o)=>L.getDocument(o),GlobalWorkerOptions:{{}}}}; window.__pdfok=1;")
    await pg.wait_for_function("window.__pdfok===1",timeout=10000)
    await pg.click("[data-v=upload]");await pg.wait_for_timeout(200)
    await pg.set_input_files("#file",os.path.join(HERE,"reg.pdf"));await pg.wait_for_timeout(4000)
    print("PROG:",await pg.inner_text("#fileProg"))
    n=await pg.evaluate("S.regs.length"); print("regs",n)
    if n: print("TEXT:\n"+await pg.evaluate("S.textCache[S.regs[0].id]"))
    print("ERR",errs); await b.close()
asyncio.run(main())
