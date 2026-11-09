---
name: compose-skill
description: This skill should be used when the user wants to compose or generate music in classical and related styles and get editable results — audio, per-instrument stems, sheet music (五线谱 staff notation and 简谱 numbered notation for 竹笛/二胡 etc.), MIDI, and a scrolling animated score video — or wants to edit a piece it made (swap instruments, mute, volume, tempo, key, re-import edited MIDI). 触发方式：/compose-skill、「作曲」「写一首巴赫/莫扎特/肖邦/德彪西风格的曲子」「生成古典音乐」「给笛子写个谱」「出个五线谱/简谱」「动态曲谱视频」「用 X 乐器来一首」「把这首换成二胡」「伴奏小声点」。 即使用户没说「作曲」，只要想得到或修改一段按时代、风格、情绪、乐器生成的音乐（含乐谱或音频），也应触发。 Covers 18 fixed classic recipes plus a dimension engine (form / harmony / melody / accompaniment / bass / drums / energy / ensemble) with 18 combo presets — incl. court minuet, baroque concerto, symphonic build, epic film, lo-fi, pop ballad, march, tango — orchestration that adapts patterns to each instrument, instrument-pairing checks, leitmotif multi-versions for parallel editing, and scene cue points; 59 instruments. 也用于「配乐要对齐画面切点」「平行剪辑两个场景用同一个主题」「这几个乐器搭不搭」。 DO NOT trigger for: 讲解音乐史或乐理而不需要生成作品（直接回答）、剪辑已有音频或视频、写歌词或视频脚本。
---

# compose-skill · 作曲

> A Claude Code skill that composes music with rule-based recipes + random seeds (no LLM in the loop), checks each piece with an 11-item "inner ear" score audit, and uses a **randomness knob** to pick: `low` (default) keeps the highest-scoring piece, `high` adds deliberate surprises (deceptive cadence, suspension, Picardy third). Outputs audio, per-instrument stems, staff notation, numbered notation (jianpu), MIDI and an animated score video. macOS only (uses the built-in CoreAudio GM sounds).

用「规则配方 + 随机种子」写曲子，出音频、分轨、五线谱、简谱、MIDI 和动态曲谱视频；用「内心听觉」自检代替耳朵把关；生成后可以换乐器、调音量、改速度、移调、导入改过的 MIDI。

两种配方：**组合配方**（`preset` / `dims` / `ensemble`）把曲子拆成曲式、和声、旋律、伴奏、低音、鼓、能量、编制几个维度，任何一维都能单独换，配器层按乐器性格改音型，支持主导动机多版本和画面切点——新作品默认用它；**经典配方**（`style`）是 18 段写死的原版写法。

**两条前提，每次都要做到：**

1. **先问，再生成。** 每次作曲都先按 `references/interview.md` 带着选项提问，把场合、情绪、时长、时代、风格、主奏、伴奏、要出的东西问清楚，复述成作曲卡，用户点头才运行。使用者大多不懂术语，所以每个问题都给 2–4 个大白话选项（AskUserQuestion），术语放说明里解释，推荐项放第一个。用户已经说清的不重复问。
2. **说实话。** 写曲子的 AI 听不见声音；生成是普通程序（随机数 + 规则 + 打分），不调用大模型。自检能抓「错」，证明不了「好听」，最后一关是人的耳朵。曲子是「像某种风格」的仿作，不是任何作曲家的原曲。

## 流程

### 1 · 引导提问（必走）

按 `references/interview.md` 分三轮问：

- **第 1 轮 · 为什么写、什么感觉**：场合、情绪、时长。
- **第 2 轮 · 哪个时代、什么写法**：按情绪从 `references/moods.md` 挑 3–4 个时代或类型，再挑写法——优先组合预设（`references/presets.md`），经典配方（`references/styles.md`）其次。
- **第 3 轮 · 谁来演奏、出什么**：主奏、伴奏（说明摘自 `references/instruments.md` 的「听起来像」）、要出哪些产物。**乐器选项必须先过搭配检查**（好搭档 + 编制三条），两件又亮又脆的敲击乐器不能同时当选项。
- **配画面时追问**：关键切点（→ `cues`）、是不是几个场景来回切（→ `versions` 共用主导动机）、要不要公开发布（→ `"sound": "publish"`）。

选项能试听就给试听：对候选风格或乐器各写一张 `"sketch": true` 的小卡跑一下，把 8–20 秒小样的路径写进选项说明。

用户答「不知道」或「你定」，就用推荐项。问完复述作曲卡（interview.md 末尾有范例），等用户确认。

想多给几个方向时，可以走发散：用 `openssl rand -hex 12` 打破默认套路，配出 4 个中心想法不同的方向，各渲一段小样让用户挑。这只是可选的一轮，不能替代上面的提问。

### 2 · 生成

```bash
cd .claude/skills/compose-skill/scripts
node compose.mjs --list                  # 经典配方、组合预设、各维度可选值、乐器
node compose.mjs <作品目录>/card.json      # 按卡生成：写 tries 首，按「随机性」挑（默认低：过线里取自检分最高的）；卡里写 "ab": true 出候选 A / B 两首给用户盲听
python3 snapshot.py <作品目录>             # 五线谱、简谱截成 PNG
python3 score_video.py <作品目录>          # 动态曲谱视频；没截完会提示，反复运行直到打印「完成」
python3 score_video.py <作品目录> --jianpu # 动态简谱视频（数字滚动、响到的变红；只对出了简谱的声部有效，写 动态简谱.mp4）
```

作曲卡字段见 `references/card.md`，组合配方的维度、编制、预设、多版本、切点见 `references/presets.md`。时长：组合配方写 `seconds`（曲式按它放缩）或 `cues`（段落对齐画面切点）；经典配方用 `repeat`（整首重复几遍，自检只查第一遍）或 `maxSeconds`（截在乐句结尾，最后两小节渐慢）。配画面、平行剪辑时用 `versions` 出几个共用主导动机的版本。原卡不会被改动，这次实际用的卡另存为 `作曲卡-本次.json`。`python3` 要装好 playwright 和 numpy（`pip install playwright numpy && python3 -m playwright install chromium`），并装好 ffmpeg。首次运行前在 scripts 目录 `npm install`（只装 verovio 乐谱引擎）。乐器采样第一次用时自动做进 `~/.cache/compose-skill/`，可以先跑 `node prepare.mjs`。每条命令都在一分钟内。

生成前会预检乐器搭配，有风险会打印 ⚠ 并写进计算记录——**有 ⚠ 先告诉用户再继续**。

产物：`音频.m4a`（总混）、`分轨/*.wav`（每个声部一条）、`乐谱.mid`、`乐谱.musicxml`、`五线谱.html/.png`、`简谱-<声部>.html/.png`、`动态曲谱.mp4`、`动态简谱.mp4`（`--jianpu`）、`计算记录.md`（含每段谁上场、按乐器性格改了哪里、音色来源与许可）、`内心听觉自检.md`、`work.json`（作品本体，后期修改用）、`作曲卡-本次.json`；多版本另有 `多版本说明.md`。

### 3 · 自检与评审

1. 读 `内心听觉自检.md`。有 ✗ 的先处理：换种子、加大 `tries`、换乐器、静音声部、挪调。每项的含义和阈值见 `references/inner-ear.md`。巴洛克 / 古典 / 浪漫的阈值是从公有领域曲谱库量出来的（`references/corpus-thresholds.json`），不是教材数字。
   - **改了自检规则或阈值，先跑校准**：`node calibrate.mjs`，四首真名曲（巴赫两首、莫扎特、肖邦）任何一项被判不及格就是规则在冤枉人，先修规则。重量阈值：`node corpus_stats.mjs <MIDI 目录> <scores.json>`。
   - **随机性旋钮（`randomness`）**：体检分只抓错。满分那首往往最工整、也好听，只是最好猜；想要意外就把随机性调高。用户说「随机性高一点 / 多一点意外 / 别那么规整」→ `"randomness": "high"`；「稳一点 / 工整 / 随机性低一点」或没提 → 默认 `low`。
     - `low`（默认）：过线的里取自检分最高的（同分取种子靠前）。
     - `mid`：按种子顺序取第一首过线的，并打开假终止。
     - `high`：组合配方自动打开全部「故意的意外」（假终止、挂留、皮卡迪三度；卡里自己写了 `dims.surprise` 就以卡为准），在听众有预期的地方偏一下，再取意外真正生效最多的那首。经典配方（`style`）没有意外维度，随机性只影响挑哪一首，要真正加意外用组合配方。
     - 好不好听最后交给人耳：用户愿意的话出 `ab` 两首盲听，把选择记进 `盲听.md`。
2. 开一个全新上下文的子 agent 当独立评审，只给五线谱 PNG、简谱 PNG 和自检表，提示词见 `references/critic.md`。最多两轮；评审分数只是停止信号。

### 4 · 交付

- 产物路径，音频和视频直接 `open`；
- 一句话说清这首是怎么算的，细节指向 `计算记录.md`；
- 自检结果（通过几项、警告几项）；
- 哪些乐器是借用的音色，哪些地方我判断不了、需要用户听。

### 5 · 后期修改（用户听完要改）

用户提修改时同样给选项（`references/editing.md` 末尾有范例），确认后用 `edit.mjs` 改，不重新作曲、音符不变：

```bash
node edit.mjs <作品目录> --inst melody=erhu --vol accomp=0.6 --bpm 90 --key D
node edit.mjs <作品目录> --from-midi 改过的.mid     # 在 GarageBand / MuseScore 改完导回
node edit.mjs <作品目录> --restore 2               # 退回旧版本
```

每次修改前自动存档到 `版本记录/v<n>/`，并写 `修改记录.md`。改完要重跑 `score_video.py` 才有新视频。换风格、换旋律就回到作曲卡重新 `compose.mjs`；**想保留旋律、只换伴奏写法或配器**（组合配方），保持 `seed` 不变，只改 `dims.accomp` / `dims.bass` / `ensemble` 重新 `compose.mjs`。

### 导入名曲曲谱（不作曲，换乐器演奏现成的谱）

用户想「用弦乐听巴赫的赋格」这类：拿公有领域曲谱的 MIDI（Mutopia Project 等），音符一个不改，只决定谁来演奏。导入后就是一首普通作品，`edit.mjs` 照常能换乐器、调速度、移调，`snapshot.py` / `score_video.py` 照常出谱和视频。

```bash
node import.mjs 曲谱.mid <作品目录> --title "曲名" --composer 巴赫 --era 巴洛克        # 按 MIDI 里写的乐器
node import.mjs 曲谱.mid <作品目录> --all strings                                  # 全部声部换成弦乐合奏
node import.mjs 曲谱.mid <作品目录> --inst v1=cello --inst v2=harp                  # 单换某个声部（v1、v2… = 音轨顺序）
```

拍号、调号、开头速度按 MIDI 里写的读；声部名用音轨名（LilyPond 的「:treble / :bass」会换成高音谱表 / 低音谱表）。曲谱来源和授权要写给用户；这是用采样音色照谱演奏，不是真人录音。

## 能力范围

- **组合配方（维度引擎）**：曲式 12 种、和声 12 种、旋律性格 6 种、伴奏音型 16 种、低音 8 种、鼓 8 种、能量曲线 4 种，加上编制（主旋律 / 副旋律 / 伴奏 / 低音 / 铺底 / 点缀 / 刮奏 / 定音鼓 / 鼓 / 支声 / 轮指）。**18 个预设**：宫廷小步舞曲、巴洛克协奏曲、小奏鸣曲、圆舞曲、夜曲、交响式（贝多芬式从暗到亮）、印象派、萨蒂式、极简主义渐进、波莱罗式接力、江南丝竹、布鲁斯、摇摆爵士、进行曲、电影史诗、Lo-fi、流行抒情、探戈。详见 `references/presets.md`。
  - 旋律从一个动机长出来（陈述 → 应答 → 发展 → 终止，前句悬着后句落地），同字母段落再现同一段旋律。
  - 配器层：按能量分层进场；对比段换乐器唱、高潮叠唱；拉不住长音的乐器不铺长音、没强弱的乐器靠加厚、管乐句尾换气、笨重乐器不跑快音、每件乐器挪进舒服音区并和主旋律拉开。
  - 主导动机多版本（`versions`）、画面切点（`cues`）。
  - 只换伴奏、低音、编制时旋律不变。
  - **故意的意外**（`dims.surprise`，可多选）：`deceptive` 假终止、`suspension` 挂留晚一拍、`picardy` 皮卡迪三度。规则只会避免错，这一维在听众已经有预期的地方偏一下；情绪里有「转折」「终于」「鼓起勇气」时推荐加。
  - **听感对照**：`python3 listen_pairs.py <目录>` 出几对对照声音（相邻两键 vs 五度、大三 vs 小三、七和弦单放 vs 回家、真终止 vs 假终止、直接落地 vs 挂留），讲解、科普、给用户解释「这首为什么这么写」时用。
- **经典配方 18 个**：巴洛克 3（卡农、五度圈模进、四声部众赞歌）、古典 4（骰子小步舞曲、问答主题、变奏曲、回旋曲）、浪漫 4（动机发展、夜曲、圆舞曲、艺术歌曲）、印象派 2、20 世纪 2、中国民乐 1、布鲁斯 1、爵士 1。详见 `references/styles.md`。
- 要新风格：按 `references/add-style.md`，先看能不能用维度组合，再考虑加维度值或预设，最后才写经典配方；不拿旧配方冒充。
- **59 种乐器**：键盘、弦乐、弹拨、木管、铜管、打击、人声、民族、电子，详见 `references/instruments.md`。每件乐器有性格档案（`scripts/lib/orch.mjs`），搭配由程序按编制三条检查。
- **简谱**：竹笛、二胡、长笛、小提琴、双簧管、竖笛、口琴、人声、萨克斯、单簧管、小号等单旋律声部自动出；竹笛按 D 调笛、首调记谱。
- 鼓不出谱面。

## 局限（如实告诉用户）

- 音色：钢琴是真采样（Salamander，CC BY 3.0）；**弦乐合奏、小提琴、中提琴、大提琴、低音提琴（拉弓）、长笛、短笛、双簧管、单簧管、巴松、圆号、小号、长号、大号、定音鼓优先用 VSCO 2 Community Edition**（Versilian Studios，CC0，带揉弦的专业录音，可公开发布；盲听比爱荷华版好得多；只下载用得到的文件夹到 `~/.cache/compose-skill/src/vsco2/`，保持仓库原路径，清单和下载命令见 `references/instruments.md`「VSCO 2」一节；加载时每个文件夹按实测音高投票定八度、每个采样校音到约 ±10 音分；弦乐合奏按音区拼大提琴组 / 中提琴组 / 小提琴组；采样空档超过 5 个半音时用爱荷华单音补，圆号 C4–D5 就是这样补的）；没有 VSCO 文件时用下面的爱荷华录音；**小提琴、中提琴、大提琴、低音提琴（拉弓）、长笛、双簧管、单簧管、巴松、圆号、小号、长号、大号、中音萨克斯是真人独奏录音**（爱荷华大学电子音乐工作室乐器采样，每个半音都录，官方声明可用于任何项目、无限制，可以公开发布；`python3 prepare_mis.py --download all` 下载并切成单音，放在 `~/.cache/compose-skill/src/iowa-<乐器>/`，没有这些文件时退回下面的音色；圆号 C3–B3 网站上只有强奏 ff 录音，用它补的。**切音时同一个音取把位最低的那根弦，并把演奏者的音准偏差重采样校准到 ±10 音分内**——2026-11-06 发现原录音高音区常偏 30–47 音分、还会挑到高把位发紧的那段，听着像撕裂的嗓子；改了 `prepare_mis.py` 要删掉 `notes/` 和 `~/.cache/compose-skill/mis/<乐器>/` 重切）；拉的、吹的、唱的乐器音符比采样长时，渲染时会把采样中段交叉淡化循环接长；弦乐合奏、长笛、单簧管、铜管、萨克斯、拨弦低音提琴默认用 GarageBand 采样；其余乐器和鼓，有 SoundFont（放在 `~/.cache/compose-skill/soundfonts/*.sf2`，比如 MuseScore General，MIT 许可）时用它，没有时用 macOS 自带 General MIDI 音色（1990 年代音色，够听但不细腻）和公式合成的鼓；管风琴是公式合成。**竹笛、二胡、古筝、琵琶借用长笛、小提琴、日本筝、三味线的声音**，只有谱面和音域按真乐器写。
- GarageBand 采样和系统音色都只限本机自用。公开发布的作品用 `"sound": "publish"`（只用钢琴采样 + SoundFont + 合成，钢琴要署名），或者用 MIDI 换可再分发的音源重做。计算记录的「音色来源」一节写明每件乐器用了什么。
- 规则只保证「合规」，旋律好不好听靠多写几首再挑，以及用户的耳朵。组合出来的东西不等于某种真实风格的地道写法。
- 严格风格为了过「强拍刺耳率」检查，七和弦只放在终止式里，比真实的巴洛克 / 古典保守。
- 拍号支持 2/4、3/4、4/4、6/8（6/8 的 bpm 按八分音符算）、12/8（经典配方）。弱起 / 不规则小节：在 `work.json` 写 `barStarts`（每小节从第几拍开始），五线谱和简谱就按它分小节；一拍里三个等长的音会写成八分三连音，其余节奏仍量化到十六分音符。

## 附加资源

- **`references/interview.md`** — 作曲前的引导提问：三轮问题、每题的选项、复述作曲卡
- **`references/presets.md`** — 组合配方：维度表、编制功能、配器层自动做的事、18 个预设、主导动机多版本、画面切点
- **`references/styles.md`** — 18 个经典配方：一句话、听起来像、代表作、规则、乐器、适合的情绪场合、速度
- **`references/instruments.md`** — 59 种乐器：听起来像、适合当、好搭档（程序读取的真源）、音域、音色来源；编制三条大白话和自动搭配检查
- **`references/moods.md`** — 情绪 / 场合 → 推荐配方、速度、乐器
- **`references/card.md`** — 作曲卡字段、风格与声部清单
- **`references/editing.md`** — 分轨、MIDI、MusicXML 怎么拿去别处改；edit.mjs 用法；版本回退
- **`references/inner-ear.md`** — 「内心听觉」每项检查的含义、阈值、局限；它只是下限（乐谱体检），判断不了好听
- **`references/corpus-thresholds.json`** — 按时代量出来的自检阈值（`scripts/corpus_stats.mjs` 生成）
- **`references/calibration/`** — 校准用的四首公有领域名曲（`scripts/calibrate.mjs` 用）
- **`references/critic.md`** — 独立评审提示词
- **`references/add-style.md`** — 新增风格：先组合、再加维度值 / 预设、最后才写经典配方
- **`scripts/compose.mjs`** 作曲 · **`scripts/calibrate.mjs`** 校准（真名曲过自检）· **`scripts/corpus_stats.mjs`** 从曲谱库量时代阈值 · **`scripts/listen_pairs.py`** 听感对照 · **`scripts/edit.mjs`** 后期修改 · **`scripts/score_video.py`** 动态曲谱视频 · **`scripts/snapshot.py`** 乐谱截图 · **`scripts/prepare.mjs`** 预做采样
- **`scripts/lib/engine/`** — 维度引擎：`harmony` 和声、`form` 曲式与时长 / 切点、`melody` 动机与旋律、`texture` 音型、`orchestrate` 配器与惯用法、`presets` 预设、`index` 串起来
- **`scripts/lib/orch.mjs`** — 乐器性格档案 + 搭配检查（好搭档从 instruments.md 读）
- **`scripts/lib/`** — `styles.cjs` 经典配方、`produce.mjs` 产物管线、`render.mjs` 渲染、`samples.mjs` + `gmrender.swift` 音色、`score.mjs`/`musicxml.mjs`/`jianpu.mjs` 乐谱、`midi.mjs`/`midiread.mjs` MIDI 读写、`audit.mjs` 自检
