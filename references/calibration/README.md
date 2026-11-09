# 校准曲目（Mutopia Project）

仓库不附带这四个 MIDI 文件（授权以 Mutopia 各曲页面为准）。请自行从 Mutopia Project 下载对应曲目的 MIDI，按下表文件名放进本目录，再运行 `node calibrate.mjs`。

`scripts/calibrate.mjs` 用这几首真名曲检验「内心听觉」自检会不会冤枉真作曲家。改了 `lib/audit.mjs` 的规则或阈值，先跑一遍校准。

| 文件 | 曲目 | 时代 | Mutopia |
|---|---|---|---|
| bach-invention-01.mid | 巴赫《二部创意曲》No.1 BWV 772 | 巴洛克 | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=40 |
| wtk1-prelude1.mid | 巴赫《平均律》第一册 C 大调前奏曲 BWV 846 | 巴洛克 | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5 |
| K545-1.mid | 莫扎特 C 大调奏鸣曲 K.545 第一乐章 | 古典 | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=998 |
| chopin_nocturne_op9_n2.mid | 肖邦 降 E 大调夜曲 Op.9 No.2 | 浪漫 | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1590 |

2026-11-06 的起因：旧规则把 BWV 846（35 小节里 19 小节是七和弦）打成 4 分、强拍刺耳率 54% 不及格；按教材定的音域上限 24 个半音，会让一首典型的肖邦挂科。
