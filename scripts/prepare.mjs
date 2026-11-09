// 预先做好乐器采样缓存（第一次用某个乐器时会自动做；这里可以提前做，避免第一次作曲等太久）
//   node prepare.mjs piano strings flute ...      不写参数 = 全部乐器
import { load, GMSRC } from './lib/samples.mjs';
const ALL = ['piano', 'strings', 'flute', 'clarinet', 'horn', 'trumpet', 'trombone', 'tuba', 'sax', 'bass', 'organ', 'drums', ...Object.keys(GMSRC)];
for (const id of process.argv.slice(2).length ? process.argv.slice(2) : ALL) { const t = Date.now(); const s = load(id); console.log(id, s.length, '个采样', ((Date.now() - t) / 1000).toFixed(1) + 's'); }
