"""Patch cn-proxy server.mjs to add detectSource() and use detectedSource."""

p = 'deploy/cn-proxy/server.mjs'
with open(p, encoding='utf-8') as f:
    c = f.read()

# 1. Insert detectSource after extractFileType closing, before cardSelectors
detect_block = """
  // 根据 URL 域名检测实际来源
  function detectSource(url) {
    try {
      const host = new URL(url).hostname.toLowerCase()
      const rules = [
        [/pan\\.quark\\.cn|quark\\.cn|drive\\.quark/i, '夸克网盘'],
        [/pan\\.baidu\\.com|yun\\.baidu|wangpan\\.baidu/i, '百度网盘'],
        [/alipan\\.com|aliyundrive|drive\\.aliyun/i, '阿里云盘'],
        [/115\\.com/i, '115网盘'],
        [/pan\\.xunlei|xunlei\\.com/i, '迅雷云盘'],
        [/cloud\\.189\\.cn/i, '天翼云盘'],
        [/123pan\\.com/i, '123云盘'],
        [/weiyun\\.com|yun\\.qq\\.com/i, '腾讯微云'],
        [/pan\\.360/i, '360云盘'],
        [/drive\\.google/i, 'Google Drive'],
        [/onedrive\\.live|sharepoint/i, 'OneDrive'],
        [/mega\\.nz/i, 'MEGA'],
      ]
      for (const [re, label] of rules) {
        if (re.test(host) || re.test(url)) return label
      }
      return host.replace(/^www\\./, '')
    } catch { return 'unknown' }
  }

  const cardSelectors"""

c = c.replace("\n  const cardSelectors", detect_block, 1)

# 2. Add detectedSource to results.push calls (inside EXTRACT_FN template)
c = c.replace(
    "results.push({ title, url: href, snippet, fileType: extractFileType(title + ' ' + snippet) })",
    "results.push({ title, url: href, snippet, fileType: extractFileType(title + ' ' + snippet), detectedSource: detectSource(href) })"
)
c = c.replace(
    "results.push({ title, url: href, snippet: '', fileType: extractFileType(title) })",
    "results.push({ title, url: href, snippet: '', fileType: extractFileType(title), detectedSource: detectSource(href) })"
)

# 3. In searchSource hits map, use detectedSource
c = c.replace(
    "source: source.label,\n        meta: { category: 'pan', panSource: source.id, fileType: r.fileType || 'unknown' },",
    "source: r.detectedSource || source.label,\n        meta: { category: 'pan', panSource: source.id, fileType: r.fileType || 'unknown', detectedSource: r.detectedSource || source.label },"
)

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)

print("OK - patched server.mjs")
