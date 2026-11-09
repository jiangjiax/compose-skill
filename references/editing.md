# 后期编辑与修改

生成之后的作品是一个目录。`work.json` 是作品本体（每个音的音高、拍、秒、力度、声部，以及每个声部的乐器、音量、是否静音），其他文件都能从它重新生成。

## 产物里哪些能拿去别处改

| 文件 | 用途 | 在哪改 |
|---|---|---|
| `分轨/01-xxx.wav` … | 每个声部单独一条音轨，相对音量和总混一致 | 拖进 GarageBand / 剪映 / CapCut，单独调音量、加效果、换掉某一轨 |
| `乐谱.mid` | 每个声部一条 MIDI 音轨，带乐器音色号 | GarageBand / Logic 打开，换成更好的软音源，改音符 |
| `乐谱.musicxml` | 五线谱通用格式 | MuseScore（免费）打开，改音符、加表情记号、打印 |
| `音频.m4a` | 总混 | 直接用 |

## 用 edit.mjs 改（不重新作曲，音符不变）

```bash
cd .claude/skills/compose-skill/scripts
node edit.mjs <作品目录> --list                                   # 看声部、乐器、历史版本
node edit.mjs <作品目录> --inst melody=erhu --inst accomp=guzheng  # 换乐器（自动挪八度进音域）
node edit.mjs <作品目录> --mute harp --vol accomp=0.6             # 静音、调音量
node edit.mjs <作品目录> --bpm 90 --key D                         # 改速度、移调
node edit.mjs <作品目录> --octave melody=-1                       # 某声部整体低八度
node edit.mjs <作品目录> --from-midi ~/Desktop/改过的.mid          # 导入在 GarageBand / MuseScore 里改过的 MIDI
node edit.mjs <作品目录> --restore 2                              # 回到第 2 版
```

- 每次修改前，旧的 `work.json` 和 `音频.m4a` 存进 `版本记录/v<n>/`，并在 `修改记录.md` 追加一行，随时能退回。
- 改完会重出：总混、分轨、乐谱、简谱、MIDI、自检；动态曲谱视频要重新跑 `score_video.py`。
- 导入 MIDI 时按音轨名对回声部（导出时音轨名就是声部名，别改名最省事）；谱面按当前速度重新对齐到十六分音符，复杂的自由速度会被拉直。

## 什么时候要重新作曲而不是编辑

- 想换风格（夜曲 → 圆舞曲）、换结构、换旋律本身：回到作曲卡改 `style` / `preset` 或 `seed`，重新 `compose.mjs`。
- 只想「再来一首类似的」：作曲卡换个 `seed`。
- 想复现刚才那首：用作品目录里的 `作曲卡-本次.json`（seed 是挑中的那个，tries = 1）。
- **想保留旋律、换伴奏写法 / 换配器**（组合配方才行）：作曲卡保持 `seed`（或 `motifSeed`）不变，只改 `dims.accomp`、`dims.bass`、`ensemble`。旋律、和声、伴奏各用各的随机数流，换伴奏不会改掉旋律。经典配方做不到，只能导出 MIDI 在 GarageBand 里改再 `--from-midi` 导回。
- 组合配方的声部名是 `melody1`、`accomp`、`bass` 这种（`node edit.mjs <目录> --list` 看），edit.mjs 的 `--inst`、`--mute`、`--vol` 都用它。

## 和用户确认修改的方式

用户提修改时同样给选项，比如「伴奏太吵」：
- 伴奏音量调到 60%（推荐）
- 伴奏换成更轻的乐器（竖琴 / 弦乐拨弦）
- 伴奏低一个八度
- 直接静音伴奏，只留旋律
