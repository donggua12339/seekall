# 浏览器插件图标

请手动添加以下图标文件（PNG）：

- `icon16.png` - 16x16
- `icon48.png` - 48x48
- `icon128.png` - 128x128

建议用 SeekAll 的 Logo（🔍 + 渐变背景）。

可在线生成：https://favicon.io/favicon-converter/

或用 SVG 占位：
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#g)"/>
  <text x="64" y="85" font-size="72" text-anchor="middle" fill="white">🔍</text>
</svg>
```

用 https://realfavicongenerator.net/ 转换为 PNG。
