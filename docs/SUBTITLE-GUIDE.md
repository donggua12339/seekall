# 字幕配置教程

> 搜索到影视资源后，如何配置字幕观看

## 一、字幕搜索

SeekAll 已集成字幕搜索功能，搜索结果中会包含字幕文件。

如需更多字幕，推荐以下字幕站：

| 站点 | 网址 | 特点 |
|------|------|------|
| OpenSubtitles | opensubtitles.org | 全球最大，多语言 |
| 字幕组 | zimu8.org | 中文字幕为主 |
| SubHD | subhd.tv | 中文字幕，质量高 |
| A4K | a4k.net | 4K 字幕 |

## 二、播放器字幕配置

### PotPlayer（Windows 推荐）

1. **自动加载字幕**
   - 将字幕文件放在视频同目录
   - 文件名与视频一致（如 `movie.mkv` + `movie.srt`）
   - PotPlayer 自动加载

2. **手动加载**
   - 打开视频 -> 右键 -> 字幕 -> 添加字幕
   - 或快捷键 `Ctrl + U`

3. **在线字幕**
   - 右键 -> 字幕 -> 在线字幕搜索
   - 需在选项中配置字幕站账号

4. **字幕样式调整**
   - 选项 -> 字幕 -> 字体/大小/颜色/位置

### VLC（全平台）

1. **加载字幕**
   - 打开视频 -> 菜单"字幕" -> 添加字幕文件
   - 或直接拖拽字幕文件到播放窗口

2. **字幕延迟调整**
   - 菜单"工具" -> 轨道同步 -> 字幕同步
   - 快捷键 `G`（提前）/ `H`（延后）

### IINA（macOS 推荐）

1. **加载字幕**
   - 打开视频 -> 菜单"字幕" -> 加载字幕
   - 或快捷键 `Cmd + Option + V`

2. **在线搜索**
   - 菜单"字幕" -> 在线搜索
   - 支持 OpenSubtitles

### Infuse（iOS/tvOS）

1. **自动下载字幕**
   - 设置 -> 播放 -> 自动下载字幕
   - 支持 OpenSubtitles（需注册免费账号）

2. **手动添加**
   - 播放时点击字幕图标 -> 添加字幕

### mpv（命令行/高级用户）

1. **配置文件** `~/.config/mpv/mpv.conf`
   ```
   # 自动加载同目录字幕
   sub-auto=fuzzy
   sub-codepage=gbk:gb2312:big5:utf-8

   # 字幕样式
   sub-font="PingFang SC"
   sub-font-size=40
   sub-color="#FFFFFFFF"
   sub-border-color="#FF000000"
   sub-border-size=2
   ```

2. **在线字幕**
   ```
   --sub-provider=opensubtitles
   ```

## 三、字幕格式说明

| 格式 | 特点 | 兼容性 |
|------|------|--------|
| SRT | 最通用，纯文本 | 所有播放器 |
| ASS/SSA | 支持样式/特效 | PotPlayer/mpv/VLC |
| VTT | Web 标准 | 网页播放 |
| SUP | 图形字幕（蓝光） | 部分播放器 |
| PGS | 图形字幕 | 部分播放器 |

## 四、字幕编码问题

中文乱码通常是编码问题：

1. **用文本编辑器转换编码**
   - Notepad++ -> 编码 -> 转为 UTF-8
   - VS Code -> 右下角编码 -> 保存为 UTF-8

2. **播放器指定编码**
   - PotPlayer: 选项 -> 字幕 -> 默认编码 -> UTF-8
   - mpv: `sub-codepage=gbk:gb2312:utf-8`

## 五、字幕同步调整

字幕与画面不同步时：

1. **时间偏移**
   - PotPlayer: `Shift + ↑/↓`（0.5秒）
   - VLC: `G`/`H`（50ms）
   - mpv: `z`/`Z`

2. **倍速调整**
   - 部分字幕帧率不同（24fps vs 25fps）
   - 用 [Subtitle Edit](https://www.nikse.dk/subtitleedit) 批量调整

## 六、内嵌字幕提取

部分视频内嵌字幕（mkv 容器常见），可用以下工具提取：

```bash
# mkvtoolnix（全平台）
mkvextract tracks movie.mkv 3:subtitle.srt

# ffmpeg
ffmpeg -i movie.mkv -map 0:s:0 subtitle.srt
```

---

> ⚠️ 字幕版权归原作者所有，仅供学习研究使用
