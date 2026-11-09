#!/usr/bin/env python3
"""动态曲谱视频：五线谱一行排到底，跟着音乐横向滚动，正在响的音变红。竖版 1080×1920，30 帧。

  python3 score_video.py <作品目录>              # 读 piece.json + 音频.m4a，写 动态曲谱.mp4（五线谱）
  python3 score_video.py <作品目录> --jianpu     # 简谱版：数字排成一行滚动，正在响的数字变红，写 动态简谱.mp4
  python3 score_video.py <作品目录> --jianpu <声部id>   # 多个声部出了简谱时指定哪个（默认第一个）
  python3 score_video.py <作品目录> --audio <文件>     # 用别的音频当声轨（比如移过调的原录音）；默认用目录里的 音频.m4a
每次运行最多截约 45 秒的帧就退出（已截的帧会保留）；反复运行直到打印「完成」。
需要带 playwright 的 Python（pip install playwright numpy）。
"""
import asyncio, json, os, subprocess, sys, time
from playwright.async_api import async_playwright

FPS, W, H, WORKERS = 30, 1080, 1920, 8
out = os.path.abspath(sys.argv[1])
piece = json.load(open(os.path.join(out, "piece.json")))
JP = "--jianpu" in sys.argv
AUDIO = os.path.abspath(sys.argv[sys.argv.index("--audio") + 1]) if "--audio" in sys.argv else os.path.join(out, "音频.m4a")
jp_role = None
if JP:
    strips = piece.get("jianpu") or {}
    if not strips: sys.exit("这首没有简谱长条：work.json 里写 \"jianpu\": true 后重新 produce（node edit.mjs <目录> --title 同名 就会重出）")
    want = sys.argv[sys.argv.index("--jianpu") + 1] if sys.argv.index("--jianpu") + 1 < len(sys.argv) else None
    jp_role = want if want in strips else next(iter(strips))
frames = os.path.join(out, "_frames_jp" if JP else "_frames")
os.makedirs(frames, exist_ok=True)
dur = piece["duration"] + 1.0
N = int(dur * FPS)

PAGE = """<!doctype html><html><head><meta charset="utf-8"><style>
body { margin:0; width:%(W)dpx; height:%(H)dpx; background:#f6f1e7; overflow:hidden; font-family:"Noto Serif SC","Songti SC",serif; color:#1f1c18; }
#top { position:absolute; left:80px; right:80px; top:150px; }
#top .k { font-size:28px; color:#7d766b; letter-spacing:.1em; }
#top h1 { font-size:64px; margin:12px 0 10px; font-weight:600; line-height:1.25; }
#top .m { font-size:28px; color:#7d766b; }
#stage { position:absolute; left:0; right:0; top:620px; height:820px; overflow:hidden; }
#strip { position:absolute; left:0; top:0; transform-origin:0 0; }
#ph { position:absolute; top:600px; height:860px; left:%(PX)dpx; width:3px; background:rgba(154,51,36,.35); }
.on, .on * { fill:#9a3324 !important; stroke:#9a3324 !important; }
#strip .c.on { color:#9a3324; }
#strip .row.strip { color:#1f1c18; }
#strip .bl { color:#9a9185; }
%(jpcss)s
#bar { position:absolute; left:80px; right:80px; bottom:220px; height:4px; background:#e2d9c8; }
#bar i { position:absolute; left:0; top:0; bottom:0; background:#1f1c18; }
#info { position:absolute; left:80px; right:80px; bottom:120px; font-size:28px; color:#7d766b; }
</style></head><body>
<div id="top"><div class="k">%(era)s</div><h1>%(title)s</h1><div class="m">%(meta)s</div></div>
<div id="stage"><div id="strip">%(svg)s</div></div><div id="ph"></div>
<div id="bar"><i id="fill"></i></div><div id="info">%(inst)s</div>
<script>
const TM = %(tmap)s, DUR = %(dur)f, PX = %(PX)d;
const strip = document.getElementById('strip'), svg = strip.querySelector('svg'), jpRow = strip.querySelector('.row.strip');
// 把一行谱放大到舞台高度（五线谱按高度放大；简谱一行很矮，固定放大 3 倍让数字够大）
const body = svg || jpRow, natH = body.getBoundingClientRect().height, natW = body.getBoundingClientRect().width;
const S = svg ? Math.min(780 / natH, 3.2) : 2.4; strip.style.transform = 'scale(' + S + ')';
strip.style.top = ((820 - natH * S) / 2) + 'px';
// 每个音的开始/结束时间和横坐标
const span = {}; for (const e of TM) { for (const id of e.on) (span[id] ||= {})[0] = e.t; for (const id of e.off) (span[id] ||= {})[1] = e.t; }
const pts = [];
const stripBox = strip.getBoundingClientRect();
for (const [id, s] of Object.entries(span)) { const el = document.getElementById(id); if (!el) continue; s.el = el; const r = el.getBoundingClientRect(); s.x = (r.left - stripBox.left) / S; pts.push([s[0], s.x]); }
if (jpRow) { // 简谱：每个带时间的数字（含延长线「-」）就是一个点亮单位
  let k = 0;
  for (const el of jpRow.querySelectorAll('.c[data-s0]')) { const s = { 0: +el.dataset.s0, 1: +el.dataset.s1, el }; const r = el.getBoundingClientRect(); s.x = (r.left - stripBox.left) / S; span['j' + (k++)] = s; if (el.textContent.trim() !== '-') pts.push([s[0], s.x]); }
}
pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
const xs = []; for (const p of pts) if (!xs.length || p[0] > xs[xs.length - 1][0] + 1e-6) xs.push(p);
xs.push([DUR, natW]);
const xAt = t => { if (t <= xs[0][0]) return xs[0][1] * Math.max(0, t / Math.max(xs[0][0], 1e-6)); for (let i = 0; i < xs.length - 1; i++) if (t < xs[i + 1][0]) { const [t0, x0] = xs[i], [t1, x1] = xs[i + 1]; return x0 + (x1 - x0) * (t - t0) / (t1 - t0); } return natW; };
window.__seek = t => {
  strip.style.left = (PX - xAt(t) * S) + 'px';
  for (const s of Object.values(span)) if (s.el) s.el.classList.toggle('on', t >= s[0] && t < (s[1] ?? s[0] + 0.3));
  document.getElementById('fill').style.width = Math.min(100, t / DUR * 100) + '%%';
};
window.__seek(0);
</script></body></html>"""


def page_html():
    inst = "　".join(f"{r['name']} · {r['instName']}" for r in piece["roles"].values())
    meta = f"{piece['key']}　{piece['meter'].split(' ')[0]}　约 {round(piece['duration'])} 秒"
    if JP:
        jp = piece["jianpu"][jp_role]
        meta = f"{jp['head']}　约 {round(piece['duration'])} 秒"
        return PAGE % dict(W=W, H=H, PX=int(W * 0.34), era=piece["era"], title=piece["title"], meta=meta,
                           svg=jp["html"], jpcss=jp["css"].replace("%", "%%"), tmap="[]", dur=dur, inst=f"{jp['name']} · 简谱")
    return PAGE % dict(W=W, H=H, PX=int(W * 0.34), era=piece["era"], title=piece["title"], meta=meta,
                       svg=piece["strip"], jpcss="", tmap=json.dumps(piece["tmap"]), dur=dur, inst=inst)


async def worker(p, todo):
    b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": W, "height": H})
    await pg.goto("file://" + os.path.join(out, "_video_jp.html" if JP else "_video.html")); await pg.wait_for_timeout(300)
    for f in todo:
        await pg.evaluate(f"__seek({f / FPS})")
        await pg.screenshot(path=os.path.join(frames, f"{f:05d}.jpg"), type="jpeg", quality=90)
    await b.close()


async def main():
    open(os.path.join(out, "_video_jp.html" if JP else "_video.html"), "w").write(page_html())
    todo = [f for f in range(N) if not os.path.exists(os.path.join(frames, f"{f:05d}.jpg"))]
    t0 = time.time()
    async with async_playwright() as p:
        while todo and time.time() - t0 < 40:
            batch, todo = todo[:WORKERS * 60], todo[WORKERS * 60:]
            await asyncio.gather(*(worker(p, batch[k::WORKERS]) for k in range(WORKERS)))
    left = len([f for f in range(N) if not os.path.exists(os.path.join(frames, f"{f:05d}.jpg"))])
    if left:
        print(f"还剩 {left}/{N} 帧，再运行一次"); return
    mp4 = os.path.join(out, "动态简谱.mp4" if JP else "动态曲谱.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", os.path.join(frames, "%05d.jpg"), "-i", AUDIO,
                    "-map", "0:v", "-map", "1:a", "-c:v", "h264_videotoolbox", "-b:v", "6M", "-pix_fmt", "yuv420p", "-tag:v", "avc1", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", mp4], check=True)
    for f in os.listdir(frames): os.remove(os.path.join(frames, f))
    os.rmdir(frames); os.remove(os.path.join(out, "_video_jp.html" if JP else "_video.html"))
    print("完成", mp4)

asyncio.run(main())
