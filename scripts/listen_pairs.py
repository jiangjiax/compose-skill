#!/usr/bin/env python3
# 听感对照：把乐理里「能听出来」的结论做成一对一对的声音，前半段 / 后半段对比。给科普、给盲听、给自己验证用。
#   python3 listen_pairs.py <输出目录>                 出全部对照
#   python3 listen_pairs.py <输出目录> --only beat,seventh
# 对照（文件名就是说明）：
#   beat      紧挨两个键（440 + 466.16 赫兹，每秒颤 26 下）vs 隔七个键（纯五度，稳）
#   triads    大三和弦 {0,4,7} vs 小三和弦 {0,3,7}，只差一个音
#   seventh   七和弦单放（悬着；自检的旧规则把它算「打架」）vs 七和弦接回主和弦（变成往前走的劲）
#   deceptive 真终止 V7→I vs 假终止 V7→vi（作曲卡 dims.surprise: deceptive 用的就是后者）
#   suspension 直接落地 vs 先停在上方邻音、晚一拍才落（dims.surprise: suspension）
# 音色：6 个泛音叠加 + 快起音、慢衰减，像拨弦 / 钢琴，不是纯正弦。只用标准库 + numpy + ffmpeg。
import sys, wave, subprocess, os
import numpy as np
SR = 48000
def tone(f, dur, amp=0.25):
    t = np.arange(int(SR * dur)) / SR
    env = np.minimum(t / 0.008, 1) * np.exp(-t * 1.6)
    return amp * env * sum(a * np.sin(2 * np.pi * f * (k + 1) * t) for k, a in enumerate([1, 0.5, 0.33, 0.25, 0.15, 0.1]))
def mix(*xs):
    y = np.zeros(max(len(x) for x in xs))
    for x in xs: y[:len(x)] += x
    return y
gap = lambda s: np.zeros(int(SR * s))
hz = lambda n: 440 * 2 ** ((n - 69) / 12)
chord = lambda ns, d: mix(*[tone(hz(n), d) for n in ns])
def save(out, name, y):
    y = y / (np.abs(y).max() + 1e-9) * 0.7
    w = os.path.join(out, name + '.wav')
    with wave.open(w, 'wb') as f: f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes((y * 32767).astype(np.int16).tobytes())
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', w, '-c:a', 'aac', '-b:a', '160k', w[:-4] + '.m4a'], check=True); os.remove(w)
    print(name + '.m4a')
PAIRS = {
    'beat': ('相邻两个键-对比-五度', lambda: np.concatenate([mix(tone(440, 3), tone(hz(70), 3)), gap(1.0), mix(tone(440, 3), tone(hz(76), 3))])),
    'triads': ('大三和弦-对比-小三和弦', lambda: np.concatenate([chord([60, 64, 67], 2.5), gap(0.8), chord([60, 63, 67], 2.5)])),
    'seventh': ('七和弦单放-对比-七和弦回家', lambda: np.concatenate([chord([55, 59, 62, 65], 2.5), gap(1.0), chord([55, 59, 62, 65], 1.4), chord([48, 60, 64, 67], 2.6)])),
    'deceptive': ('真终止-对比-假终止', lambda: np.concatenate([chord([55, 59, 62, 65], 1.2), chord([48, 60, 64, 67], 2.4), gap(1.0), chord([55, 59, 62, 65], 1.2), chord([57, 60, 64, 69], 2.4)])),
    'suspension': ('直接落地-对比-挂留晚一拍', lambda: np.concatenate([mix(chord([48, 55, 64], 3), tone(hz(72), 3)), gap(1.0), mix(chord([48, 55, 64], 3.6), np.concatenate([tone(hz(74), 0.9), tone(hz(72), 2.7)]))])),
}
if __name__ == '__main__':
    if len(sys.argv) < 2: sys.exit(__doc__ or '用法：python3 listen_pairs.py <输出目录> [--only beat,triads,...]')
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else list(PAIRS)
    for k in only: name, fn = PAIRS[k]; save(out, name, fn())
