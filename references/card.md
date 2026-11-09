# 作曲卡（card.json）

一张卡 = 一首曲子的全部输入。放在作品目录里，`node compose.mjs <卡>` 运行。运行后**原卡不会被改动**，这次实际用的卡（含挑中的种子）另存为 `作曲卡-本次.json`。

两种卡：**经典配方**写 `style`（下面第一节，18 个固定写法）；**组合配方**写 `preset` / `dims` / `ensemble`（第二节，按维度拼，见 presets.md）。

```json
{
  "title": "竹笛与竖琴的夜曲",
  "style": "nocturne",
  "seed": 3,
  "tries": 8,
  "key": "D",
  "bpm": 150,
  "instruments": { "melody": "dizi", "accomp": "harp" },
  "mute": [],
  "jianpu": ["melody"],
  "sketch": false,
  "sketchSeconds": 20,
  "name": "A-夜曲竹笛",
  "out": "out"
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `style` | 是 | 风格配方 id，见下表 |
| `title` | 否 | 曲名；不写就用「配方名（种子 N）」 |
| `seed` | 否 | 随机种子。同一个种子永远同一首；不写就随机 |
| `tries` | 否 | 从 seed 起连写几首，默认 8；按 `randomness` 从过线的（没有不及格项）里挑；全不过线才取自检分最高的 |
| `randomness` | 否 | 随机性旋钮：`low`（默认，过线里取自检分最高的）/ `mid`（按种子顺序取第一首过线的，组合配方加假终止）/ `high`（组合配方打开假终止 + 挂留 + 皮卡迪三度，取意外生效最多的）；也接受 0–1 的数。经典配方没有意外维度，只影响挑哪一首 |
| `ab` | 否 | `true` = 出两首都过线的：`候选A/`、`候选B/`，外加 `盲听.md` 给用户记选择。文件名不透露哪首自检分高 |
| `key` | 否 | 目标调的主音：C、D、Eb、F#…；大小调由配方决定 |
| `bpm` | 否 | 整体改速度；摇摆、自由速度的形状保持不变 |
| `instruments` | 否 | `{声部: 乐器}`，没写的声部用配方默认 |
| `mute` | 否 | 要静音的声部（不出声、不进乐谱） |
| `volume` | 否 | `{声部: 音量}`，1 = 原样，0.6 = 小声一点 |
| `repeat` | 否 | 整首重复几遍（场合要「越长越好」时用）；自检只查第一遍 |
| `maxSeconds` | 否 | 经典配方：截短到不超过这么多秒，挑乐句结尾（旋律落在主和弦音的长音上、最好是四小节整数倍）截，最后两小节渐慢；附近没有好的终止时计算记录会注明。组合配方：等同 `seconds` |
| `sound` | 否 | `best`（默认，本机最好的音色）/ `publish`（只用可公开发布的音色：Salamander 钢琴 + SoundFont + 合成；需要 `~/.cache/compose-skill/soundfonts/` 里有 .sf2） |
| `jianpu` | 否 | 出简谱的声部；`true` = 全部声部。不写时竹笛、长笛、小提琴、萨克斯、单簧管、小号声部自动出 |
| `sketch` | 否 | `true` = 小样模式：只渲前 `sketchSeconds` 秒音频，不出谱，发散阶段用 |
| `name` | 否 | 小样文件名前缀，比如「A-萨蒂竹笛」 |
| `out` | 否 | 输出目录（相对卡所在目录） |

## 组合配方的卡

```json
{
  "title": "机器人宫廷",
  "preset": "court-minuet",
  "dims": { "process": "build", "accomp": "continuo" },
  "ensemble": { "melody": ["violin", "flute"], "accomp": ["harpsichord"], "bass": ["cello"] },
  "instruments": { "melody2": "oboe" },
  "key": "D", "bpm": 132, "seconds": 48,
  "cues": [{ "at": 12, "label": "切到工厂" }, { "at": 30, "label": "高潮", "energy": 0.95 }],
  "seed": 5, "tries": 6
}
```

| 字段 | 说明 |
|---|---|
| `preset` | 组合预设 id（presets.md 的 18 个）；不写就全部用 `dims` + `ensemble` 自己拼 |
| `dims` | 要换掉的维度：form / harmony / harmonyRate / mstyle / accomp / bass / drums / process / melodyFrom / surprise（数组：deceptive 假终止、suspension 挂留、picardy 皮卡迪三度） |
| `ensemble` | 编制：功能 → 乐器（一件或几件，可写 `{inst, pattern, octave}`）；写了就整套替换预设的编制 |
| `instruments` | 按声部名换单件乐器（`melody1`、`accomp` …），不动其他 |
| `mode` / `meter` / `groove` | 调式、拍子（2/4、3/4、4/4、6/8）、速度感（straight / swing / rubato） |
| `seconds` | 目标时长；曲式按它等比放缩、取整到乐句 |
| `cues` | 画面切点（秒）；段落边界对齐切点，`energy` 指定那段多满 |
| `motif` | 可选，直接给动机：`{"degs": [0, 2, 4, 3, 2, 1], "rhythm": [1, 0.5, 0.5, 1]}` |
| `motifSeed` | 动机种子；不写 = `seed`。几张卡写同一个 `motifSeed` 就共用主导动机 |

### 多版本（共用主导动机）

```json
{
  "title": "机器人宫廷 · 平行剪辑", "key": "D", "bpm": 132, "seconds": 48, "motifSeed": 11,
  "cues": [{ "at": 12, "label": "切换" }, { "at": 30, "label": "高潮", "energy": 0.95 }],
  "versions": [
    { "name": "宫廷版", "preset": "court-minuet" },
    { "name": "流水线版", "preset": "minimal-build", "ensemble": { "melody": ["clarinet"], "accomp": [{ "inst": "marimba", "pattern": "ostinato" }, { "inst": "pizzicato", "pattern": "phase" }], "bass": ["cello"] } }
  ]
}
```

顶层字段是几个版本共用的，`versions` 里每项覆盖自己的部分；每个版本输出到 `<out>/<name>/`，外加一份 `多版本说明.md`。

## 经典配方与声部

| id | 时代 · 配方 | 参考 | 声部（默认乐器） |
|---|---|---|---|
| `canon` | 巴洛克 · 三声部卡农 | 巴赫、帕赫贝尔 | high/mid/low（管风琴） |
| `sequence` | 巴洛克 · 五度圈模进 | 维瓦尔第、亨德尔 | solo、inner（弦乐）、continuo（羽管键琴）、bass（弦乐） |
| `dice` | 古典 · 骰子小步舞曲 | 莫扎特（据说）、海顿 | melody、accomp（钢琴） |
| `period` | 古典 · 一问一答的主题 | 莫扎特、海顿 | melody、alberti（钢琴） |
| `motif` | 浪漫 · 一个动机打天下 | 贝多芬、勃拉姆斯 | motif（弦乐）、harmony（圆号）、bass（弦乐） |
| `nocturne` | 浪漫 · 夜曲 | 肖邦 | melody、accomp（钢琴） |
| `debussy` | 印象派 · 雾中的平行和弦 | 德彪西、拉威尔 | melody（长笛）、planing（弦乐）、harp（竖琴）、pedal（圆号） |
| `satie` | 印象派 · 慢三拍的两个和弦 | 萨蒂 | melody、bass、chords（钢琴） |
| `blues` | 布鲁斯 · 12 小节 | 汉迪、B.B. 金 | lead（萨克斯）、piano、bass、drums |
| `jazz` | 爵士 · ii–V–I 摇摆 | 帕克、戴维斯 | sax、piano、bass、drums |
| `chorale` | 巴洛克 · 四声部众赞歌 | 巴赫 | soprano、alto、tenor、bass（合唱） |
| `variations` | 古典 · 主题与变奏 | 莫扎特、海顿 | melody、accomp（钢琴） |
| `rondo` | 古典 · 回旋曲 ABACA | 莫扎特、贝多芬 | melody（长笛）、accomp（钢琴） |
| `waltz` | 浪漫 · 圆舞曲 | 肖邦、施特劳斯 | melody（小提琴）、bass、chords（钢琴） |
| `lied` | 浪漫 · 艺术歌曲 | 舒伯特、舒曼 | voice（人声）、rh、lh（钢琴） |
| `bolero` | 20 世纪 · 波莱罗式渐强 | 拉威尔 | snare（鼓）、ostinato（弦乐拨弦）、m1 长笛、m2 单簧管、m3 萨克斯、m4 小号、harm（弦乐） |
| `minimal` | 20 世纪 · 极简主义 | 格拉斯、赖希 | add（马林巴）、phase（颤音琴）、bass（大提琴）、pad（弦乐） |
| `sizhu` | 中国民乐 · 五声支声（江南丝竹式） | 江南丝竹 | dizi 竹笛、erhu 二胡、pipa 琵琶、guzheng 古筝 |

## 乐器（59 种，`node compose.mjs --list` 看最新清单）

| 家族 | 乐器 id |
|---|---|
| 键盘 | piano 钢琴 · harpsichord 羽管键琴 · organ 管风琴 · celesta 钢片琴 · epiano 电钢琴 · accordion 手风琴 · music_box 八音盒 |
| 弦乐 | strings 弦乐合奏 · violin 小提琴 · viola 中提琴 · cello 大提琴 · contrabass 低音提琴（拉弓）· tremolo 弦乐震音 · pizzicato 弦乐拨弦 |
| 弹拨 | harp 竖琴 · guitar 古典吉他 · steel_guitar 钢弦吉他 · banjo 班卓琴 · bass 低音提琴（拨弦） |
| 木管 | flute 长笛 · piccolo 短笛 · recorder 竖笛 · oboe 双簧管 · english_horn 英国管 · clarinet 单簧管 · bassoon 巴松 · sax 中音萨克斯 · pan_flute 排箫 · ocarina 陶笛 · harmonica 口琴 |
| 铜管 | horn 圆号 · trumpet 小号 · muted_trumpet 弱音小号 · trombone 长号 · tuba 大号 |
| 打击 | timpani 定音鼓 · marimba 马林巴 · vibraphone 颤音琴 · xylophone 木琴 · glockenspiel 钟琴 · tubular_bells 管钟 · drums 爵士鼓 |
| 人声 | choir 合唱 · voice 人声 |
| 电子 | synth_pad 合成器铺底 · synth_lead 合成器主音 · synth_bass 合成器低音 · e_guitar 电吉他（清音）· e_bass 电贝斯；铜管组 brass |
| 民族 | dizi 竹笛 · erhu 二胡 · guzheng 古筝 · pipa 琵琶 · koto 日本筝 · shamisen 三味线 · shakuhachi 尺八 · sitar 西塔琴 · kalimba 拇指琴 |

音色来源（详见 SKILL.md「局限」）：钢琴 = Salamander（CC BY 3.0）；有 SoundFont 时，原来用系统音色的乐器和鼓都改用 SoundFont；弦乐合奏、长笛、单簧管、圆号、小号、长号、大号、萨克斯、拨弦低音提琴 = GarageBand 采样；管风琴、爵士鼓 = 公式合成；其余 = macOS 自带 General MIDI 音色库（Roland GS，`scripts/lib/gmrender.swift` 离线渲染）。竹笛、二胡、古筝、琵琶系统里没有，分别借用长笛、小提琴、日本筝、三味线的声音，只在音域和谱面上按真乐器处理。
