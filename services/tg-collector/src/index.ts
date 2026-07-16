/**
 * TG Collector - Telegram 频道资源收集器
 *
 * 功能：
 *   1. 用 Telegram MTProto API 登录（用户账号或 Bot）
 *   2. 监听指定频道的消息
 *   3. 提取消息中的网盘/磁力链接
 *   4. 解析链接类型（夸克/百度/阿里/迅雷/磁力等）
 *   5. 写入 Meilisearch `tg-resources` 索引
 *
 * 独立运行：node services/tg-collector/src/index.js
 *
 * 配置（环境变量）：
 *   TG_API_ID=xxx                  # https://my.telegram.org 获取
 *   TG_API_HASH=xxx
 *   TG_SESSION=xxx                 # 首次登录后保存的 session
 *   TG_CHANNELS=@channel1,@channel2  # 监听的频道（逗号分隔）
 *   MEILISEARCH_URL=http://localhost:7700
 *   MEILISEARCH_MASTER_KEY=xxx
 *
 * 首次登录：
 *   交互式输入手机号 + 验证码，session 保存到文件
 *
 * 输出到 Meilisearch 的文档：
 *   {
 *     id: <messageId>,
 *     title: <提取的标题>,
 *     url: <资源链接>,
 *     cloudType: <quark/baidu/aliyun/...>,
 *     cloudName: <夸克网盘/百度网盘/...>,
 *     password: <提取码>,
 *     channel: <@channel>,
 *     messageDate: <timestamp>,
 *     rawText: <原始消息文本>
 *   }
 */

import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'
import { NewMessage } from 'telegram/events/index.js'
import { MeiliSearch } from 'meilisearch'
import crypto from 'node:crypto'

// ====== 链接提取器 ======

interface ExtractedLink {
  url: string
  cloudType: string
  cloudName: string
  password?: string
  title?: string
}

// 网盘链接正则
const LINK_PATTERNS: Array<{ type: string; name: string; pattern: RegExp; titleGroup?: number; urlGroup?: number }> = [
  // 夸克网盘
  {
    type: 'quark',
    name: '夸克网盘',
    pattern: /(夸克|quark)[^\n]*?(https?:\/\/pan\.quark\.cn\/s\/[a-zA-Z0-9_-]+)/i,
    urlGroup: 2,
  },
  // 百度网盘
  {
    type: 'baidu',
    name: '百度网盘',
    pattern: /(百度|baidu|pan\.baidu)[^\n]*?(https?:\/\/pan\.baidu\.com\/s\/[a-zA-Z0-9_-]+)/i,
    urlGroup: 2,
  },
  // 阿里云盘
  {
    type: 'aliyun',
    name: '阿里云盘',
    pattern: /(阿里|aliyun|alipan)[^\n]*?(https?:\/\/(?:www\.alipan|www\.aliyundrive)\.com\/s\/[a-zA-Z0-9_-]+)/i,
    urlGroup: 2,
  },
  // 迅雷云盘
  {
    type: 'xunlei',
    name: '迅雷云盘',
    pattern: /(迅雷|xunlei)[^\n]*?(https?:\/\/pan\.xunlei\.com\/s\/[a-zA-Z0-9_-]+)/i,
    urlGroup: 2,
  },
  // UC 网盘
  {
    type: 'uc',
    name: 'UC 网盘',
    pattern: /(UC网盘|drive\.uc)[^\n]*?(https?:\/\/drive\.uc\.cn\/[a-zA-Z0-9_-]+)/i,
    urlGroup: 2,
  },
  // 115 网盘
  {
    type: '115',
    name: '115 网盘',
    pattern: /(115网盘|115\.com)[^\n]*?(https?:\/\/115\.com\/[a-zA-Z0-9_-]+)/i,
    urlGroup: 2,
  },
  // 磁力链接
  {
    type: 'magnet',
    name: '磁力',
    pattern: /(magnet:\?xt=urn:btih:[a-zA-Z0-9]+)/i,
    urlGroup: 1,
  },
  // PikPak
  {
    type: 'pikpak',
    name: 'PikPak',
    pattern: /(pikpak|mypikpak)[^\n]*?(https?:\/\/mypikpak\.com\/[a-zA-Z0-9_-]+)/i,
    urlGroup: 2,
  },
  // 123 网盘
  {
    type: '123',
    name: '123 网盘',
    pattern: /(123网盘|123pan)[^\n]*?(https?:\/\/www\.123pan\.com\/s\/[a-zA-Z0-9_-]+)/i,
    urlGroup: 2,
  },
  // 天翼云盘
  {
    type: 'tianyi',
    name: '天翼云盘',
    pattern: /(天翼|cloud\.189)[^\n]*?(https?:\/\/cloud\.189\.cn\/[a-zA-Z0-9_-]+)/i,
    urlGroup: 2,
  },
]

// 提取码正则（通用）
const PASSWORD_PATTERNS = [
  /(?:提取码|密码|访问码|password|pwd|code)[:：\s]*([a-zA-Z0-9]{4,8})/i,
  /\?pwd=([a-zA-Z0-9]{4,8})/i,
  /\?password=([a-zA-Z0-9]{4,8})/i,
  /#([a-zA-Z0-9]{4,8})$/,
]

/**
 * 从消息文本提取资源链接
 */
function extractLinks(text: string): ExtractedLink[] {
  const links: ExtractedLink[] = []
  const seen = new Set<string>()

  // 提取所有链接（含提取码）
  const password = extractPassword(text)

  for (const p of LINK_PATTERNS) {
    const matches = [...text.matchAll(p.pattern)]
    for (const m of matches) {
      const url = m[p.urlGroup || 0]
      if (!url || seen.has(url)) continue
      seen.add(url)

      // 提取标题：链接所在行的前一行或同一行的描述
      const title = extractTitle(text, m.index || 0)

      links.push({
        url: url.trim(),
        cloudType: p.type,
        cloudName: p.name,
        password: password || undefined,
        title: title || `${p.name} 资源`,
      })
    }
  }

  return links
}

function extractPassword(text: string): string | null {
  for (const p of PASSWORD_PATTERNS) {
    const m = text.match(p)
    if (m && m[1]) return m[1]
  }
  return null
}

function extractTitle(text: string, linkIndex: number): string | null {
  // 取链接所在行的前一行作为标题（如果存在）
  const beforeLink = text.slice(0, linkIndex).trim()
  const lines = beforeLink.split('\n').filter((l) => l.trim())
  if (lines.length > 0) {
    const lastLine = lines[lines.length - 1].trim()
    // 过滤明显的描述行（含"链接"/"提取码"等关键词）
    if (lastLine && !/^(链接|提取码|密码|访问码|http)/i.test(lastLine) && lastLine.length <= 200) {
      return lastLine
    }
  }
  return null
}

// ====== Meilisearch 索引管理 ======

async function ensureIndex(client: MeiliSearch, indexName: string): Promise<void> {
  try {
    await client.getIndex(indexName)
    console.log(`[TG] Index "${indexName}" already exists`)
  } catch {
    console.log(`[TG] Creating index "${indexName}"...`)
    await client.createIndex(indexName, { primaryKey: 'id' })
    await client.index(indexName).updateSearchableAttributes(['title', 'rawText', 'channel'])
    await client.index(indexName).updateFilterableAttributes(['cloudType', 'channel'])
    await client.index(indexName).updateSortableAttributes(['messageDate'])
    console.log(`[TG] Index "${indexName}" created`)
  }
}

// ====== 主程序 ======

async function main() {
  const apiId = Number(process.env.TG_API_ID)
  const apiHash = process.env.TG_API_HASH
  const sessionStr = process.env.TG_SESSION || ''
  const channelsStr = process.env.TG_CHANNELS || ''
  const indexName = 'tg-resources'

  if (!apiId || !apiHash) {
    console.error('[TG] Missing TG_API_ID or TG_API_HASH')
    console.error('[TG] Get them from https://my.telegram.org')
    process.exit(1)
  }

  const channels = channelsStr.split(',').map((c) => c.trim()).filter(Boolean)
  if (channels.length === 0) {
    console.error('[TG] No channels configured. Set TG_CHANNELS=@channel1,@channel2')
    process.exit(1)
  }

  // 初始化 Meilisearch
  const meili = new MeiliSearch({
    host: process.env.MEILISEARCH_URL || 'http://localhost:7700',
    apiKey: process.env.MEILISEARCH_MASTER_KEY,
  })
  await ensureIndex(meili, indexName)

  // 初始化 Telegram 客户端
  const session = new StringSession(sessionStr)
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  })

  await client.start({
    phoneNumber: async () => '',
    password: async () => '',
    phoneCode: async () => '',
    onError: (err) => console.error('[TG] Login error:', err.message),
  })

  // 首次登录时打印 session 供保存
  if (!sessionStr) {
    console.log('[TG] Save this session string for future use:')
    console.log(`TG_SESSION=${client.session.save()}`)
  }

  console.log(`[TG] Listening to ${channels.length} channels: ${channels.join(', ')}`)

  // 监听新消息
  client.addEventHandler(async (event) => {
    try {
      const message = event.message
      if (!message?.message) return

      // 判断是否来自配置的频道
      const peerId = message.peerId?.toString() || ''
      const channelId = peerId.replace(/^-100/, '')
      const matchedChannel = channels.find((c) => c.includes(channelId) || peerId.includes(c.replace('@', '')))
      if (!matchedChannel) return

      const text = message.message
      const links = extractLinks(text)
      if (links.length === 0) return

      // 写入 Meilisearch
      const docs = links.map((link) => ({
        id: `${message.id}_${link.url}`.slice(0, 250),
        title: link.title,
        url: link.url,
        cloudType: link.cloudType,
        cloudName: link.cloudName,
        password: link.password || null,
        channel: matchedChannel,
        messageDate: message.date?.toString() || new Date().toISOString(),
        rawText: text.slice(0, 1000),
      }))

      await meili.index(indexName).addDocuments(docs)
      console.log(`[TG] ${matchedChannel}: indexed ${docs.length} links from message ${message.id}`)
    } catch (err) {
      console.error('[TG] Message handler error:', (err as Error).message)
    }
  }, new NewMessage({}))

  console.log('[TG] Collector started, waiting for messages...')

  // 优雅退出
  process.on('SIGINT', () => {
    console.log('[TG] Shutting down...')
    client.disconnect()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('[TG] Fatal error:', err)
  process.exit(1)
})
