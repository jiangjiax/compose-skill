#!/usr/bin/env python3
"""把五线谱、简谱的 HTML 截成 PNG（给独立评审看，也方便发给别人）。
  python3 snapshot.py <作品目录>   → 五线谱.png、简谱-*.png
"""
import asyncio, glob, os, sys
from playwright.async_api import async_playwright

out = os.path.abspath(sys.argv[1])

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 900, "height": 1200}, device_scale_factor=2)
        for f in sorted(glob.glob(os.path.join(out, "五线谱.html")) + glob.glob(os.path.join(out, "简谱-*.html"))):
            await pg.goto("file://" + f); await pg.wait_for_timeout(400)
            png = f[:-5] + ".png"; await pg.screenshot(path=png, full_page=True); print(png)
        await b.close()

asyncio.run(main())
