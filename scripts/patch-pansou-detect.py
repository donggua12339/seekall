"""Patch pansou index.ts to add detectSource() and use detectedSource for source field."""
import sys

p = 'packages/rule-pansou/src/index.ts'
with open(p, encoding='utf-8') as f:
    c = f.read()

# 1. Insert detectSource after extractFileType closing brace, before cardSelectors
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

# 2. Add detectedSource to both results.push calls
c = c.replace(
    "results.push({ title, url: href, snippet, fileType: extractFileType(title + ' ' + snippet) })",
    "results.push({ title, url: href, snippet, fileType: extractFileType(title + ' ' + snippet), detectedSource: detectSource(href) })"
)
c = c.replace(
    "results.push({ title, url: href, snippet: '', fileType: extractFileType(title) })",
    "results.push({ title, url: href, snippet: '', fileType: extractFileType(title), detectedSource: detectSource(href) })"
)

# 3. In searchSource, use detectedSource instead of source.label
old_map = """        const hits: Hit[] = raw.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet || undefined,
          source: source.label,
          meta: {
            category: 'pan' as const,
            panSource: source.id,
            fileType: r.fileType || 'unknown',
          },
        }))"""

new_map = """        const hits: Hit[] = raw.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet || undefined,
          source: (r as any).detectedSource || source.label,
          meta: {
            category: 'pan' as const,
            panSource: source.id,
            fileType: r.fileType || 'unknown',
            detectedSource: (r as any).detectedSource || source.label,
          },
        }))"""

c = c.replace(old_map, new_map, 1)

# 4. Update the evaluate return type to include detectedSource
old_eval_type = """        const raw = (await page.evaluate(EXTRACT_FN)) as Array<{
          title: string
          url: string
          snippet: string
          fileType: string
        }>"""
new_eval_type = """        const raw = (await page.evaluate(EXTRACT_FN)) as Array<{
          title: string
          url: string
          snippet: string
          fileType: string
          detectedSource?: string
        }>"""
c = c.replace(old_eval_type, new_eval_type, 1)

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)

print("OK - patched detectSource + detectedSource")
