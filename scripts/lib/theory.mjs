// 乐理小工具：调号、音名拼写、乐器音域、移调与「挪进音域」
export const INSTRUMENTS = {
  // 名字、音域（MIDI，实际发音）、家族；sound = 借用哪种乐器的声音
  piano: { name: '钢琴', range: [21, 108], fam: '键盘' }, harpsichord: { name: '羽管键琴', range: [29, 89], fam: '键盘' }, organ: { name: '管风琴', range: [36, 96], fam: '键盘' },
  celesta: { name: '钢片琴', range: [60, 108], fam: '键盘' }, epiano: { name: '电钢琴', range: [28, 103], fam: '键盘' }, accordion: { name: '手风琴', range: [41, 89], fam: '键盘' }, music_box: { name: '八音盒', range: [60, 96], fam: '键盘' },
  strings: { name: '弦乐合奏', range: [28, 100], fam: '弦乐' }, violin: { name: '小提琴', range: [55, 100], fam: '弦乐' }, viola: { name: '中提琴', range: [48, 88], fam: '弦乐' },
  cello: { name: '大提琴', range: [36, 76], fam: '弦乐' }, contrabass: { name: '低音提琴（拉弓）', range: [28, 67], fam: '弦乐' }, tremolo: { name: '弦乐震音', range: [28, 96], fam: '弦乐' },
  pizzicato: { name: '弦乐拨弦', range: [28, 96], fam: '弦乐' }, harp: { name: '竖琴', range: [24, 103], fam: '弹拨' }, guitar: { name: '古典吉他', range: [40, 84], fam: '弹拨' },
  steel_guitar: { name: '钢弦吉他', range: [40, 84], fam: '弹拨' }, banjo: { name: '班卓琴', range: [48, 84], fam: '弹拨' }, bass: { name: '低音提琴（拨弦）', range: [28, 67], fam: '弹拨' },
  flute: { name: '长笛', range: [60, 96], fam: '木管' }, piccolo: { name: '短笛', range: [74, 108], fam: '木管' }, recorder: { name: '竖笛', range: [60, 96], fam: '木管' },
  oboe: { name: '双簧管', range: [58, 91], fam: '木管' }, english_horn: { name: '英国管', range: [52, 81], fam: '木管' }, clarinet: { name: '单簧管', range: [50, 94], fam: '木管' },
  bassoon: { name: '巴松（大管）', range: [34, 75], fam: '木管' }, sax: { name: '中音萨克斯', range: [49, 81], fam: '木管' }, pan_flute: { name: '排箫', range: [60, 96], fam: '木管' },
  ocarina: { name: '陶笛', range: [60, 93], fam: '木管' }, harmonica: { name: '口琴', range: [60, 96], fam: '木管' },
  horn: { name: '圆号', range: [34, 77], fam: '铜管' }, trumpet: { name: '小号', range: [54, 82], fam: '铜管' }, muted_trumpet: { name: '弱音小号', range: [54, 82], fam: '铜管' },
  trombone: { name: '长号', range: [40, 72], fam: '铜管' }, tuba: { name: '大号', range: [26, 58], fam: '铜管' },
  timpani: { name: '定音鼓', range: [36, 57], fam: '打击' }, marimba: { name: '马林巴', range: [45, 96], fam: '打击' }, vibraphone: { name: '颤音琴', range: [53, 89], fam: '打击' },
  xylophone: { name: '木琴', range: [60, 108], fam: '打击' }, glockenspiel: { name: '钟琴', range: [72, 108], fam: '打击' }, tubular_bells: { name: '管钟', range: [60, 77], fam: '打击' },
  drums: { name: '爵士鼓', range: [0, 127], drum: true, fam: '打击' },
  choir: { name: '合唱（啊）', range: [40, 84], fam: '人声' }, voice: { name: '人声（呜）', range: [48, 84], fam: '人声' },
  dizi: { name: '竹笛（D 调）', range: [69, 95], sound: 'flute', fam: '民族', approx: '用长笛音色代替' }, erhu: { name: '二胡', range: [62, 93], sound: 'violin', fam: '民族', approx: '用小提琴音色代替' },
  guzheng: { name: '古筝', range: [38, 88], sound: 'koto', fam: '民族', approx: '用日本筝音色代替' }, pipa: { name: '琵琶', range: [45, 86], sound: 'shamisen', fam: '民族', approx: '用三味线音色代替' },
  koto: { name: '日本筝', range: [48, 91], fam: '民族' }, shamisen: { name: '三味线', range: [50, 86], fam: '民族' }, shakuhachi: { name: '尺八', range: [55, 91], fam: '民族' },
  sitar: { name: '西塔琴', range: [48, 84], fam: '民族' }, kalimba: { name: '拇指琴', range: [60, 96], fam: '民族' },
  synth_pad: { name: '合成器铺底', range: [36, 96], fam: '电子' }, synth_lead: { name: '合成器主音', range: [48, 96], fam: '电子' }, synth_bass: { name: '合成器低音', range: [24, 60], fam: '电子' },
  e_guitar: { name: '电吉他（清音）', range: [40, 84], fam: '电子' }, e_bass: { name: '电贝斯', range: [28, 67], fam: '电子' }, brass: { name: '铜管组', range: [40, 84], fam: '铜管' },
};
export const soundOf = inst => INSTRUMENTS[inst]?.sound || inst;

const NAMES_CN = ['C', '升C', 'D', '降E', 'E', 'F', '升F', 'G', '降A', 'A', '降B', 'B'];
// 调名按谱面调号拼：大调降 D（5 个降号）而不是升 C；小调按它的关系大调（升 C 小调 = E 大调的 4 个升号）
const MAJ_CN = ['C', '降D', 'D', '降E', 'E', 'F', '升F', 'G', '降A', 'A', '降B', 'B'];
const MIN_CN = ['C', '升C', 'D', '升D', 'E', 'F', '升F', 'G', '升G', 'A', '降B', 'B'];
// 从生成器给的「降E 小调」「G 大调」「E 布鲁斯」里读出主音和大小调
export function parseKey(str) {
  let pc = -1;
  let len = 0;
  for (const names of [NAMES_CN, MAJ_CN, MIN_CN]) for (let k = 0; k < 12; k++) if (str.startsWith(names[k]) && names[k].length > len) { pc = k; len = names[k].length; }
  return { pc: pc < 0 ? 0 : pc, minor: str.includes('小调') };
}
const MAJ_FIFTHS = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1 };
export const fifthsOf = ({ pc, minor }) => MAJ_FIFTHS[minor ? (pc + 3) % 12 : pc];
// 按调号拼写：升号调用升号，降号调用降号
const SHARP = [['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]];
const FLAT = [['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0], ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0]];
export function spell(p, fifths) {
  const [step, alter] = (fifths < 0 ? FLAT : SHARP)[((p % 12) + 12) % 12];
  return { step, alter, octave: Math.floor(p / 12) - 1 };
}
// 整首移到目标调：返回要加的半音数（取 -6..+5，尽量少动）
export function shiftTo(fromPc, toPc) { let d = (((toPc - fromPc) % 12) + 12) % 12; if (d > 5) d -= 12; return d; }
// 把一个声部整体挪几个八度，让尽量多的音落在乐器音域里
export function fitOctave(ps, [lo, hi]) {
  let best = 0, bestIn = -1;
  for (let o = -3; o <= 3; o++) { const n = ps.filter(p => p + o * 12 >= lo && p + o * 12 <= hi).length; if (n > bestIn || (n === bestIn && Math.abs(o) < Math.abs(best))) { bestIn = n; best = o; } }
  return { oct: best, inRange: bestIn, total: ps.length };
}
export const KEY_INPUT = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export const keyLabel = ({ pc, minor }) => (minor ? MIN_CN : MAJ_CN)[pc] + (minor ? ' 小调' : ' 大调');
