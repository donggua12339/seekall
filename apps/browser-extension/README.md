# 觅源 SeekAll - 浏览器插件

> Chrome/Edge 扩展，随时搜索全网资源

## 安装（开发模式）

### Chrome / Edge

1. 打开 `chrome://extensions/`（或 `edge://extensions/`）
2. 开启"开发者模式"（右上角）
3. 点击"加载已解压的扩展程序"
4. 选择 `apps/browser-extension/` 目录

## 功能

- **弹窗搜索**：点击工具栏图标，弹出搜索框
- **右键搜索**：选中网页文字 -> 右键 -> "用 SeekAll 搜索"
- **地址栏搜索**：在地址栏输入 `seekall` + Tab + 关键词
- **自动填充**：打开弹窗时自动填入选中的文字

## 使用

1. 在任意网页选中文字
2. 点击工具栏的 SeekAll 图标（或右键搜索）
3. 弹窗显示搜索结果
4. 点击结果打开资源链接

## 配置

默认连接 `https://seekall.winmelon.cn`。

如需连接本地开发服务器，修改 `popup.js` 和 `background.js` 中的 `API_URL`：

```javascript
const API_URL = 'http://localhost:7301'
```

## 图标

首次安装需要手动添加图标，参考 `icons/README.md`。

## 发布

1. 生成图标
2. `chrome://extensions/` -> "打包扩展程序"
3. 上传到 Chrome Web Store（需 $5 开发者注册费）

## 合规说明

- 插件仅调用 SeekAll API 获取链接
- 不存储任何用户数据
- 不读取网页内容（仅获取选中的文字）
