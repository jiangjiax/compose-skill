// 读标准 MIDI 文件（在 GarageBand / MuseScore / Logic 里改过再导出的那种），还原成每条音轨的音符（秒）。
// 支持变速（tempo 事件）、running status、format 0/1。
export function readMidi(buf) {
  let i = 0;
  const u32 = () => (buf[i++] << 24 | buf[i++] << 16 | buf[i++] << 8 | buf[i++]) >>> 0, u16 = () => buf[i++] << 8 | buf[i++];
  const vlq = () => { let v = 0, b; do { b = buf[i++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };
  if (buf.toString('latin1', 0, 4) !== 'MThd') throw new Error('不是 MIDI 文件');
  i = 4; const hl = u32(); const fmt = u16(), ntr = u16(), div = u16(); i = 8 + hl; void fmt;
  const tracks = [], tempos = [[0, 500000]], meta = { timeSig: null, keySig: null, keySigs: [] };
  for (let t = 0; t < ntr; t++) {
    if (buf.toString('latin1', i, i + 4) !== 'MTrk') break;
    i += 4; const len = u32(), end = i + len;
    let tick = 0, status = 0, name = '', program = null; const on = new Map(), notes = []; // 同一个音可能叠着按（踏板），用队列先进先出
    while (i < end) {
      tick += vlq();
      let b = buf[i];
      if (b & 0x80) { status = b; i++; }
      if (status === 0xff) {
        const type = buf[i++], l = vlq(), data = buf.subarray(i, i + l); i += l;
        if (type === 0x03) name = data.toString('utf8');
        if (type === 0x51) tempos.push([tick, (data[0] << 16) | (data[1] << 8) | data[2]]);
        if (type === 0x58 && !meta.timeSig) meta.timeSig = [data[0], 2 ** data[1]];
        if (type === 0x59) { const k = { sf: data[0] > 127 ? data[0] - 256 : data[0], minor: data[1] === 1 }; meta.keySigs.push(k); if (!meta.keySig) meta.keySig = k; }
      } else if (status === 0xf0 || status === 0xf7) { const l = vlq(); i += l; }
      else {
        const hi = status & 0xf0, ch = status & 0x0f;
        if (hi === 0xc0 || hi === 0xd0) { const d = buf[i++]; if (hi === 0xc0) program = d; continue; }
        const a = buf[i++], c = buf[i++];
        const key = ch * 128 + a;
        if (hi === 0x90 && c > 0) (on.get(key) || on.set(key, []).get(key)).push([tick, c, ch]);
        else if (hi === 0x80 || (hi === 0x90 && c === 0)) { const st = on.get(key)?.shift(); if (st) notes.push({ p: a, t0: st[0], t1: tick, v: st[1] / 127, ch: st[2] }); }
      }
    }
    i = end;
    tracks.push({ name, program, notes });
  }
  // tick → 秒（按 tempo 表分段）
  tempos.sort((a, b) => a[0] - b[0]);
  const sec = tick => { let s = 0, last = 0, us = 500000; for (const [tk, t] of tempos) { if (tk >= tick) break; s += (tk - last) * us / div / 1e6; last = tk; us = t; } return s + (tick - last) * us / div / 1e6; };
  // 额外带上：每个音的拍位置（b0/b1，四分音符 = 1 拍）和曲子的拍号、调号、开头速度（数组属性，不影响老用法）
  const out = tracks.filter(t => t.notes.length).map(t => ({ name: t.name, program: t.program, drum: t.notes.every(n => n.ch === 9), notes: t.notes.map(n => ({ p: n.p, s: sec(n.t0), e: sec(n.t1), v: n.v, b0: n.t0 / div, b1: n.t1 / div })).sort((a, b) => a.s - b.s) }));
  out.meta = { ...meta, bpm: 60e6 / tempos.filter(t => t[0] === 0).pop()[1] }; // 开头那个速度（没写就是默认 120）
  return out;
}

// 猜这首曲子的调：MIDI 里的调号常不可靠（LilyPond 会先写一个默认的 C 大调，小调也常记成「同调号的大调」），
// 所以取第一个不是默认 C 大调的调号定升降号，再看结尾最低的那个音是关系大调还是关系小调的主音来定大小调。
// 返回 { pc, minor, sure }；sure = 结尾低音正好落在其中一个主音上
export function guessKey(tracks) {
  const sigs = tracks.meta?.keySigs || [], sig = sigs.find(k => k.sf !== 0 || k.minor) || sigs[0] || { sf: 0, minor: false };
  const maj = (((sig.sf * 7) % 12) + 12) % 12, min = (maj + 9) % 12;
  const notes = tracks.filter(t => !t.drum).flatMap(t => t.notes); if (!notes.length) return { pc: sig.minor ? min : maj, minor: sig.minor, sure: false };
  const end = Math.max(...notes.map(n => n.e)), lastOn = Math.max(...notes.map(n => n.s));
  const bass = notes.filter(n => n.e >= Math.min(end, lastOn + 0.05)).reduce((a, n) => (n.p < a.p ? n : a)).p % 12;
  if (bass === min) return { pc: min, minor: true, sure: true };
  if (bass === maj) return { pc: maj, minor: false, sure: true };
  return { pc: sig.minor ? min : maj, minor: sig.minor, sure: false };
}
