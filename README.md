# compose-skill

一个给 Claude Code 用的作曲 skill：用「规则配方 + 随机种子」写曲子，不调用大模型；每首做 11 项「内心听觉」乐谱体检，再用一个**随机性旋钮**决定挑哪一首：调低要工整，调高要意外。出音频、分轨、五线谱、简谱、MIDI 和动态曲谱视频，生成后还能换乐器、调音量、改速度、移调。

A Claude Code skill that composes music from rule-based recipes and random seeds — no LLM in the loop. Every piece goes through an 11-item score audit, and a **randomness knob** decides which one to keep: low for tidy, high for surprises. Outputs audio, per-instrument stems, staff notation, numbered notation (jianpu), MIDI and an animated score video, and lets you swap instruments, change volume, tempo or key afterwards.

## 随机性旋钮 / The randomness knob

体检全是「不许」：不许平行五度、不许乱跳、结尾要回主音……分数只能抓错，抓不到意外。满分那首往往最工整、也好听，只是最好猜。所以作曲卡里有一个 `randomness`：

- `low`（默认）：过线的里挑分最高的，工整、好听。
- `mid`：按种子顺序取第一首过线的，并加一个假终止。
- `high`：打开「故意的意外」（假终止、挂留、皮卡迪三度），在听众已经有预期的地方偏一下，比如该落回主和弦时拐进六级和弦。

哪一首更打动人，分数说了不算，最后交给人的耳朵；需要时可以出 A / B 两首盲听。

The audit is a list of prohibitions, so the score catches mistakes but not surprise. The top-scoring piece is usually the tidiest and pleasant, just predictable. Set `randomness` in the card:

- `low` (default): the highest-scoring passing piece.
- `mid`: the first passing piece by seed, with a deceptive cadence.
- `high`: turns on deliberate surprises (deceptive cadence, suspension, Picardy third) where the listener already expects something, then keeps the piece where they actually took effect.

Taste is still left to human ears (optionally an A/B blind pick).

## 安装 / Install

需要 macOS（用到系统自带的 General MIDI 音色）、Node.js 18+、Python 3、ffmpeg。

Requires macOS (uses the built-in CoreAudio GM sounds), Node.js 18+, Python 3 and ffmpeg.

```bash
git clone https://github.com/jiangjiax/compose-skill.git .claude/skills/compose-skill
cd .claude/skills/compose-skill/scripts
npm install                                   # verovio（乐谱排版）
pip install playwright numpy && python3 -m playwright install chromium   # 乐谱截图、动态曲谱视频
```

## 用法 / Usage

在 Claude Code 里说「作曲」「写一首巴赫风格的曲子」「给笛子写个谱」，或输入 `/compose-skill`。它会先带选项问你场合、情绪、时长、风格和乐器，复述成一张作曲卡，你确认后才生成。

In Claude Code, ask it to compose ("write a Baroque-style piece for violin", or `/compose-skill`). It asks a few multiple-choice questions, shows a "composition card", and generates after you confirm.

直接用脚本 / Scripts directly:

```bash
node compose.mjs --list               # 配方、预设、乐器
node compose.mjs <dir>/card.json      # 按作曲卡生成
python3 snapshot.py <dir>             # 五线谱、简谱 PNG
python3 score_video.py <dir>          # 动态曲谱视频
node edit.mjs <dir> --inst melody=cello --bpm 90 --key D   # 后期修改
```

最小作曲卡 / Minimal card:

```json
{ "title": "test", "preset": "court-minuet", "seconds": 30, "tries": 8 }
```

产物 / Outputs：`音频.m4a`、`分轨/*.wav`、`乐谱.mid`、`乐谱.musicxml`、`五线谱.png`、`简谱-*.png`、`动态曲谱.mp4`、`计算记录.md`、`内心听觉自检.md`。

## 音色与许可 / Sounds & licenses

仓库不附带任何音频采样，第一次用到时下载或调用本机音色：

No audio samples are bundled; they are downloaded or loaded on first use:

- 钢琴 Piano：Salamander Grand Piano（CC BY 3.0，via tonejs.github.io，公开发布需署名 / attribution required）
- 管弦乐 Orchestral：VSCO 2 Community Edition（Versilian Studios，CC0）——按 `references/instruments.md` 的说明下载
- 独奏乐器 Solo instruments：University of Iowa MIS（官方声明可用于任何项目），`python3 scripts/prepare_mis.py --download all`
- 可选 Optional：任意 SoundFont（如 MuseScore General，MIT）放进 `~/.cache/compose-skill/soundfonts/`
- macOS 自带 GM 音色与 GarageBand 采样**只限本机自用**，公开发布请在作曲卡里写 `"sound": "publish"`。macOS GM sounds and GarageBand samples are for local use only; use `"sound": "publish"` for anything you publish.
- 乐谱排版 Engraving：[Verovio](https://www.verovio.org)（LGPL-3.0，npm 依赖）
- 校准曲谱 Calibration MIDI：不随仓库分发，见 `references/calibration/README.md`

代码以 MIT 许可发布。Code is MIT licensed.

## 局限 / Limitations

写曲子的程序听不见声音：体检只能证明「没错」，证明不了「好听」。曲子是「像某种风格」的仿作，不是任何作曲家的原曲。

The program cannot hear. The audit proves "no mistakes", never "sounds good". Pieces imitate styles; they are not any composer's original works.
