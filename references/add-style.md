# 新增一个风格

现有配方覆盖不了用户要的风格时，不要硬套旧配方冒充。按代价从小到大选一条路：

1. **只是换个组合**（比如「探戈节奏 + 弦乐四重奏」）：不用写代码，作曲卡写 `preset` + `dims` + `ensemble` 就行，见 presets.md。
2. **组合够用、想常用**：在 `scripts/lib/engine/presets.mjs` 加一个预设（各维度挑值 + 默认编制 + 一句「听起来」），再在 presets.md 的表里加一行。
3. **缺一个维度的值**（新的和声语汇、伴奏音型、低音、鼓型、曲式）：在对应文件里加一个条目——
   - 和声 → `engine/harmony.mjs` 的 `HARMONY`（函数返回和弦序列，和弦写成「离段落主音几个半音 + 性质」）
   - 伴奏 / 低音 / 鼓 → `engine/texture.mjs` 的 `ACCOMP` / `BASS` / `DRUMS`（函数收到和弦、拍号、能量、音区，往 out 里推音）
   - 曲式 → `engine/form.mjs` 的 `FORMS`（段落列表：素材字母、小节数、离主调几个半音、段尾终止）
   - 每个条目都要写 `name` 和一句给普通人看的 `plain`，它们会进计算记录。
   - 能量低时音型变稀、能量高时变密（看 `ctx.energy`），配器层才能做出「越来越满」。
4. **整套写法和现有维度都对不上**（比如赋格的主题–答题–对题、需要搜索的卡农）：才在 `scripts/lib/styles.cjs` 里写一个经典配方。下面是经典配方的写法。

新乐器：`theory.mjs` 的 `INSTRUMENTS`（名字、音域）+ `orch.mjs` 的 `PROFILE`（发声方式、能否持续、强弱、亮度、灵活度、舒服音区）+ `samples.mjs` 的音色来源 + instruments.md 加一行（含「好搭档」，程序会读）。

## 先做功课，再写规则

1. 查清这种风格「可以写成规则」的部分：音阶、和弦进行、拍子、曲式、典型织体、典型乐器。来源要可靠（教材、维基百科、IMSLP 乐谱），写进配方的 `recipe`。
2. 分清「规则」和「品味」：规则写进代码；品味（哪段最动人）交给多写几首、自检和用户挑。
3. 每个随机选择都写进 `steps`，用普通人能看懂的话（「掷骰子 3+4=7 → 第 7 种写法」），这是计算记录的来源。

## 接口

```js
add({
  id: 'lied', era: 'romantic', name: '艺术歌曲', who: '舒伯特',
  sound: '一句话：听起来什么样',
  recipe: ['规则 1：…', '规则 2：…'],
  roles: { voice: { name: '人声旋律', inst: 'clarinet' }, piano: { name: '钢琴伴奏', inst: 'piano' } },
  gen(seed) {
    const r = RNG(seed), steps = [];
    // … 只用 r() 产生随机数，保证同一个种子永远同一首
    return {
      bpm: 72, meter: '4/4',           // 拍号目前支持 4/4、3/4、12/8（含「4/4 摇摆」）
      key: '降A 大调',                  // 「<中文音名> 大调/小调」，compose.mjs 靠它移调、写调号
      notes: [{ p: 68, t: 0, d: 1, v: 0.7, role: 'voice' }],  // p=MIDI 音高，t、d 单位是拍（12/8 是八分音符）
      steps,
      time: undefined,                 // 可选：拍 → 秒 的函数（摇摆、自由速度）
    };
  },
});
```

- `era` 只能是 baroque / classical / romantic / impressionism / modern / chinese / blues / jazz（决定显示名）。
- `audit.mjs` 里的 `STRICT` 表要给新 id 定严格程度：strict / mid / free。
- 写完先跑 `node compose.mjs --list`，再用 3 个不同种子各跑一次，看自检和谱面。
