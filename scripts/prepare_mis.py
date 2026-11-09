#!/usr/bin/env python3
"""把爱荷华大学乐器采样（University of Iowa MIS）的「一串半音阶」录音切成一个个单音，给 samples.mjs 用。

  python3 prepare_mis.py cello              # 读 ~/.cache/compose-skill/src/iowa-cello/*.aiff，写 notes/<midi>.wav
  python3 prepare_mis.py --download violin   # 先从爱荷华大学网站下载这件乐器中等力度（mf）的持续音录音，再切
  python3 prepare_mis.py --download all      # SOURCES 里的全部乐器

原始文件一个是一根弦上的一串半音阶，文件名末尾写着从哪个音到哪个音（如 Cello.arco.mf.sulC.C2Ab2.aiff）。
录音几乎是连奏的，演奏者高音区常偏二三十音分，所以每段按测得的中位音高重采样校准到标准音高。
录音几乎是连奏的，按静音切会把两个音粘在一起，所以这里逐帧测音高（只在文件名写的音域里找），
每个半音取「音高稳定在这个音上」最长的一段，往前多留 80ms 起弓声。同一个音在几根弦上都有时，弦乐取把位最低的那根弦
（声音最松；高把位在低一根弦上会发紧、像撕裂的嗓子，2026-11-06 小提琴 C#6 就是这样），只有它短于 1 秒才退回最长的一段。
需要带 numpy 的 Python（pip install playwright numpy）和 ffmpeg。
"""
import os, re, sys, subprocess, glob, time, urllib.parse, urllib.request
import numpy as np

# 本 skill 的乐器 id → 爱荷华大学网站上的页面、只要哪些文件（中等力度 mf 的持续音；弦乐要拉弓 arco，不要拨弦、不揉弦）
SITE = 'https://theremin.music.uiowa.edu/'
SOURCES = {
    'cello': ('MIScello.html', r'\.arco\.mf\.'), 'violin': ('MISviolin.html', r'\.arco\.mf\.'), 'viola': ('MISviola.html', r'\.arco\..*\bmf\.'),
    'contrabass': ('MISdoublebass.html', r'\.arco\.mf\.'), 'flute': ('MISflute.html', r'\.vib\.mf\.'), 'oboe': ('MISoboe.html', r'\.mf\.'),
    'clarinet': ('MISBbclarinet.html', r'\.mf\.'), 'bassoon': ('MISbassoon.html', r'\.mf\.'), 'horn': ('MISFrenchhorn.html', r'\.mf\.'),
    'trumpet': ('MISBbtrumpet.html', r'\.vib\.mf\.'), 'trombone': ('MIStenortrombone.html', r'\.mf\.'), 'tuba': ('MIStuba.html', r'\.mf\.'),
    'sax': ('MISaltosaxophone.html', r'\.vib\.mf\.'),
}
# mf 缺音域时用别的力度补（网站上就没有这一段的 mf 录音）；每个音切出来都会统一音量，差别主要是音色亮一点
FILL = {'horn': [r'Horn\.ff\.C3B3']}


def download(inst):
    page, pat = SOURCES[inst]
    base = os.path.expanduser(f'~/.cache/compose-skill/src/iowa-{inst}'); os.makedirs(base, exist_ok=True)
    html = urllib.request.urlopen(SITE + page, timeout=30).read().decode('latin1')
    links = [l for l in re.findall(r'href="([^"]+\.aiff?)"', html, re.I) if (re.search(pat, l, re.I) and not re.search(r'pizz|nonvib|stacc|trill', l, re.I)) or any(re.search(f, l) for f in FILL.get(inst, []))]
    got = 0
    for l in links:
        f = os.path.join(base, os.path.basename(l).replace(' ', ''))
        if os.path.exists(f) and os.path.getsize(f) > 10000: got += 1; continue
        for k in range(3):
            try:
                data = urllib.request.urlopen(SITE + urllib.parse.quote(l), timeout=60).read()
                open(f, 'wb').write(data); got += 1; break
            except Exception as e:
                print(f'  重试 {os.path.basename(l)}：{e}'); time.sleep(3 * (k + 1))
    print(f'{inst}：{got}/{len(links)} 个文件')

SR, HOP, WIN = 44100, 441, 4096
# 空弦音高（midi）：用来算一个音在某根弦上是第几把位
OPEN = {'violin': {'G': 55, 'D': 62, 'A': 69, 'E': 76}, 'viola': {'C': 48, 'G': 55, 'D': 62, 'A': 69},
        'cello': {'C': 36, 'G': 43, 'D': 50, 'A': 57}, 'contrabass': {'E': 28, 'A': 33, 'D': 38, 'G': 43}}
NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def midi_of(t):
    m = re.match(r'^([A-G])(b?)(\d)$', t)
    return 12 * (int(m.group(3)) + 1) + NAMES[m.group(1)] - (1 if m.group(2) else 0)


def decode(f):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def track(x, lo, hi):
    """逐帧（10ms）音高，只在 lo-1 … hi+1 的音域里找。用 YIN 的精确差分函数：
    d(τ) = Σx_j² + Σx_{j+τ}² − 2·Σx_j·x_{j+τ}（j 在 0…W-1），再做累计归一化；返回 midi（浮点）和响度"""
    W = WIN // 2
    n = (len(x) - WIN) // HOP
    if n <= 0: return np.zeros(0), np.zeros(0)
    idx = np.arange(WIN)[None, :] + HOP * np.arange(n)[:, None]
    fr = x[idx]                                            # 每帧 2W 个样本
    a = np.fft.rfft(fr, 2 * WIN, axis=1)
    b = np.fft.rfft(np.pad(fr[:, :W], ((0, 0), (0, WIN))), 2 * WIN, axis=1)
    r = np.fft.irfft(a * np.conj(b), axis=1)[:, :W]        # Σ_{j<W} x_j·x_{j+τ}
    c = np.concatenate([np.zeros((n, 1)), np.cumsum(fr ** 2, axis=1)], axis=1)
    taus = np.arange(W)
    e0 = c[:, W:W + 1]                                     # Σ_{j<W} x_j²
    et = c[:, taus + W] - c[:, taus]                       # Σ_{j=τ}^{τ+W-1} x_j²
    d = e0 + et - 2 * r
    d[:, 0] = 0
    cm = d * taus[None, :] / np.maximum(np.cumsum(d, axis=1), 1e-12)
    cm[:, 0] = 1
    tmin = int(SR / (440 * 2 ** ((hi + 1.5 - 69) / 12))); tmax = min(W - 1, int(SR / (440 * 2 ** ((lo - 1.5 - 69) / 12))) + 1)
    sub = cm[:, tmin:tmax]
    t = np.argmin(sub, axis=1) + tmin
    conf = 1 - sub[np.arange(n), t - tmin]
    # 抛物线插值求小数延迟：高音区延迟只有几十个样本，取整会差二三十音分
    i = np.clip(t, 1, W - 2); y0, y1, y2 = cm[np.arange(n), i - 1], cm[np.arange(n), i], cm[np.arange(n), i + 1]
    den = y0 - 2 * y1 + y2; tf = i + np.where(np.abs(den) > 1e-12, 0.5 * (y0 - y2) / np.where(np.abs(den) > 1e-12, den, 1), 0)
    midi = 69 + 12 * np.log2(SR / tf / 440)
    rms = np.sqrt(np.mean(fr[:, :W] ** 2, axis=1))
    midi[conf < 0.7] = np.nan
    return midi, rms


def pick(cs):
    """同一个音的几段候选 (录音, 把位)：够长（≥1 秒）的里取把位最低的；都不够长就取最长的"""
    ok = [c for c in cs if len(c[0]) >= SR]
    c = min(ok, key=lambda c: (c[1], -len(c[0]))) if ok else max(cs, key=lambda c: len(c[0]))
    return c[0], c[2]


def main(inst):
    base = os.path.expanduser(f'~/.cache/compose-skill/src/iowa-{inst}')
    out = os.path.join(base, 'notes'); os.makedirs(out, exist_ok=True)
    best = {}
    for f in sorted(glob.glob(os.path.join(base, '*.aif*'))):
        m = re.search(r'\.\s*([A-G]b?\d)([A-G]b?\d)?\.(?:stereo\.)?aiff?$', f)
        if not m: print('跳过（文件名里没有音域）：', os.path.basename(f)); continue
        lo = midi_of(m.group(1)); hi = midi_of(m.group(2)) if m.group(2) else lo
        sm = re.search(r'\.sul([A-G])\.', os.path.basename(f)); op = OPEN.get(inst, {}).get(sm.group(1)) if sm else None
        x = decode(f); midi, rms = track(x, lo, hi)
        loud = rms > rms.max() * 10 ** (-30 / 20)
        for note in range(lo, hi + 1):
            pos = note - op if op is not None else 0
            ok = loud & (np.abs(midi - note) < 0.5)   # 演奏者音准有偏差，取最近的半音，切完再校准
            # 最长的连续一段
            runs, st = [], None
            for i, v in enumerate(np.append(ok, False)):
                if v and st is None: st = i
                if not v and st is not None: runs.append((st, i)); st = None
            if not runs: print(f'  {os.path.basename(f)}：没找到 {note}'); continue
            a, b = max(runs, key=lambda r: r[1] - r[0])
            if b - a < 30: continue                          # 少于 0.3 秒不要
            s0 = max(0, a * HOP - int(0.08 * SR)); s1 = min(len(x), b * HOP + WIN // 2)
            seg = x[s0:s1]
            dev = float(np.nanmedian(midi[a:b]) - note)          # 这段录音偏了多少半音
            best.setdefault(note, []).append((seg, pos, dev))
    best = {note: pick(cs) for note, cs in best.items()}
    for note, (seg, dev) in best.items():
        if abs(dev) > 0.03:                                  # 超过 3 音分就重采样校准到标准音高（时长随之微变）
            r = 2 ** (-dev / 12); seg = np.interp(np.arange(0, len(seg) - 1, r), np.arange(len(seg)), seg)
        seg = seg.astype(np.float32)
        fade = int(0.03 * SR); seg[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', os.path.join(out, f'{note}.wav')], input=seg.tobytes(), check=True)
    ks = sorted(best)
    devs = {k: round(best[k][1] * 100) for k in ks if abs(best[k][1]) > 0.1}
    print(f'{inst}：{len(ks)} 个音，{ks[0]}–{ks[-1]}；缺：{[k for k in range(ks[0], ks[-1] + 1) if k not in best]}；长度 {min(len(v[0]) for v in best.values()) / SR:.1f}–{max(len(v[0]) for v in best.values()) / SR:.1f} 秒；校准超过 10 音分的（音分）：{devs}')


if __name__ == '__main__':
    args = sys.argv[1:]
    dl = '--download' in args; args = [a for a in args if a != '--download']
    insts = list(SOURCES) if args == ['all'] else (args or ['cello'])
    for inst in insts:
        if dl: download(inst)
        main(inst)
