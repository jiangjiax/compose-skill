// 乐谱 → MusicXML（五线谱的通用格式：MuseScore、Sibelius、Finale、Verovio 都认）
import { DIV } from './score.mjs';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function toMusicXML(score, { title, composer, bpm }) {
  const { meter, fifths, parts } = score;
  const pl = parts.map((p, i) => `<score-part id="P${i + 1}"><part-name>${esc(p.name)}</part-name></score-part>`).join('');
  const body = parts.map((p, i) => {
    const ms = p.bars.map((bar, b) => {
      let x = `<measure number="${b + 1}">`;
      // 不规则小节（弱起等）：小节长度变了就写一次拍号；谱面上的拍号仍按曲子的拍号显示
      const bb = score.barBeats?.[b] ?? meter.beats, beatsTag = `<time><beats>${bb}</beats><beat-type>${meter.type}</beat-type></time>`;
      if (b === 0) {
        x += `<attributes><divisions>${DIV}</divisions><key><fifths>${fifths}</fifths>${score.key.minor ? '<mode>minor</mode>' : ''}</key>${beatsTag}<clef><sign>${p.clef}</sign><line>${p.clef === 'G' ? 2 : 4}</line></clef></attributes>`;
        if (i === 0 && bpm) x += `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${Math.round(bpm)}</per-minute></metronome></direction-type><sound tempo="${Math.round(bpm)}"/></direction>`;
      } else if (score.barBeats && bb !== score.barBeats[b - 1]) x += `<attributes>${beatsTag}</attributes>`;
      for (const ev of bar) {
        const dots = '<dot/>'.repeat(ev.dots);
        if (ev.rest) { x += `<note><rest/><duration>${ev.len}</duration><type>${ev.type}</type>${dots}</note>`; continue; }
        const tm = ev.tup ? '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>' : '';
        const tupTag = ev.tup === 1 ? '<tuplet type="start"/>' : ev.tup === 3 ? '<tuplet type="stop"/>' : '';
        ev.pitches.forEach((pp, k) => {
          const s = score.spell(pp);
          const tie = (ev.tieStop ? '<tie type="stop"/>' : '') + (ev.tieStart ? '<tie type="start"/>' : '');
          const tied = (ev.tieStop ? '<tied type="stop"/>' : '') + (ev.tieStart ? '<tied type="start"/>' : '') + tupTag;
          x += `<note>${k ? '<chord/>' : ''}<pitch><step>${s.step}</step>${s.alter ? `<alter>${s.alter}</alter>` : ''}<octave>${s.octave}</octave></pitch><duration>${ev.len}</duration>${tie}<type>${ev.type}</type>${dots}${tm}${tied ? `<notations>${tied}</notations>` : ''}</note>`;
        });
      }
      return x + (b === p.bars.length - 1 ? '<barline location="right"><bar-style>light-heavy</bar-style></barline>' : '') + '</measure>';
    }).join('');
    return `<part id="P${i + 1}">${ms}</part>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="3.1"><work><work-title>${esc(title)}</work-title></work><identification><creator type="composer">${esc(composer)}</creator></identification><part-list>${pl}</part-list>${body}</score-partwise>\n`;
}
