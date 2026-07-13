/**
 * 觅源 SeekAll - TG 频道消息收集器
 *
 * 功能：
 * - Bot 加入目标频道后，持续接收频道消息
 * - 解析消息中的网盘链接（夸克/阿里/百度/迅雷/115 等）
 * - 存入 Meilisearch 索引，供 TgDirectProvider 搜索
 *
 * 配置（.env）：
 *   TG_BOT_TOKEN=xxx
 *   TG_CHANNELS=@channel1,@channel2  # 要监听的频道（Bot 需已加入）
 *   MEILISEARCH_URL=http://localhost:7700
 *   MEILISEARCH_MASTER_KEY=xxx
 */

import { Telegraf } from 'telegraf'
import { MeiliSearch } from 'meilisearch'
import type { Update } from 'telegraf/types'

const BOT_TOKEN = process.env.TG_BOT_TOKEN
const CHANNELS = (process.env.TG_CHANNELS || '').split(',').map((c) => c.trim()).filter(Boolean)
const MEILI_URL = process.env.MEILISEARCH_URL || 'http://localhost:7700'
const MEILI_KEY = process.env.MEILISEARCH_MASTER_KEY

if (!BOT_TOKEN) {
  console.error('❌ 请设置 TG_BOT_TOKEN')
  process.exit(1)
}
if (CHANNELS.length === 0) {
  console.error('❌ 请设置 TG_CHANNELS（逗号分隔的频道用户名）')
  process.exit(1)
}

const meili = new MeiliSearch({ host: MEILI_URL, apiKey: MEILI_KEY })
const INDEX_NAME = 'tg-resources'

// 网盘链接正则
const NETDISK_PATTERNS: Array<{ type: string; regex: RegExp; name: string }> = [
  { type: 'quark', regex: /https?:\/\/pan\.quark\.cn\/s\/[a-zA-Z0-9_-]+/g, name: '夸克网盘' },
  { type: 'aliyun', regex: /https?:\/\/www\.alipan\.com\/s\/[a-zA-Z0-9_-]+/g, name: '阿里云盘' },
  { type: 'aliyun2', regex: /https?:\/\/aliyundrive\.share\.s\/[a-zA-Z0-9_-]+/g, name: '阿里云盘' },
  { type: 'baidu', regex: /https?:\/\/pan\.baidu\.com\/s\/[a-zA-Z0-9_-]+/g, name: '百度网盘' },
  { type: 'xunlei', regex: /https?:\/\/pan\.xunlei\.com\/s\/[a-zA-Z0-9_-]+/g, name: '迅雷云盘' },
  { type: '115', regex: /https?:\/\/115\.com\/s\/[a-zA-Z0-9_-]+/g, name: '115 网盘' },
  { type: 'tianyi', regex: /https?:\/\/cloud\.189\.cn\/[a-zA-Z0-9_-]+/g, name: '天翼云盘' },
  { type: 'magnet', regex: /magnet:\?xt=urn:btih:[a-zA-Z0-9]+/g, name: '磁力' },
]

// 提取码正则
const PASSWORD_REGEX = /(?:提取码|密码|password)[::\s]*([a-zA-Z0-9]{4,8})/i

interface TgResource {
  id: string
  title: string
  url: string
  cloudType: string
  cloudName: string
  password: string | null
  channel: string
  messageId: number
  messageDate: string
  indexedAt: number
}

async function ensureIndex() {
  try {
    await meili.getIndex(INDEX_NAME)
  } catch {
    await meili.createIndex(INDEX_NAME, { primaryKey: 'id' })
  }
  await meili.index(INDEX_NAME).updateSearchableAttributes(['title'])
  await meili.index(INDEX_NAME).updateFilterableAttributes(['cloudType', 'channel'])
  await meili.index(INDEX_NAME).updateSortableAttributes(['messageDate', 'indexedAt'])
  console.log(`✅ Meilisearch 索引 "${INDEX_NAME}" 就绪`)
}

function parseMessage(text: string, channel: string, messageId: number, date: number): TgResource[] {
  const results: TgResource[] = []
  const passwordMatch = text.match(PASSWORD_REGEX)
  const password = passwordMatch ? passwordMatch[1] : null

  for (const { type, regex, name } of NETDISK_PATTERNS) {
    const matches = text.match(regex)
    if (!matches) continue

    for (const url of matches) {
      // 用消息前 100 字作为标题
      const title = text.slice(0, 100).replace(url, '').trim() || `${name} 资源`
      const id = `${channel}:${messageId}:${type}:${url.slice(-12)}`

      results.push({
        id,
        title,
        url,
        cloudType: type,
        cloudName: name,
        password,
        channel,
        messageId,
        messageDate: new Date(date * 1000).toISOString(),
        indexedAt: Date.now(),
      })
    }
  }

  return results
}

const bot = new Telegraf(BOT_TOKEN)

bot.on('channel_post', async (ctx) => {
  const post = (ctx.update as { channel_post: Update.ChannelPostUpdate['channel_post'] }).channel_post
  if (!post?.text) return

  const chatId = post.chat.id
  const chatUsername = post.chat.username ? `@${post.chat.username}` : String(chatId)

  // 检查是否在目标频道列表
  if (!CHANNELS.some((c) => c === chatUsername || c === String(chatId))) return

  const resources = parseMessage(post.text, chatUsername, post.message_id, post.date)
  if (resources.length === 0) return

  try {
    await meili.index(INDEX_NAME).addDocuments(resources)
    console.log(`📥 ${chatUsername} #${post.message_id}: 收集 ${resources.length} 条资源`)
  } catch (err) {
    console.error(`❌ 索引失败:`, (err as Error).message)
  }
})

bot.on('message', async (ctx) => {
  // 处理普通群组消息（可选）
  const msg = ctx.message
  if (!msg?.text) return

  const chatId = msg.chat.id
  const chatTitle = msg.chat.title || msg.chat.username || String(chatId)
  if (!CHANNELS.some((c) => c === chatTitle || c === String(chatId))) return

  const resources = parseMessage(msg.text, chatTitle, msg.message_id, msg.date)
  if (resources.length === 0) return

  try {
    await meili.index(INDEX_NAME).addDocuments(resources)
    console.log(`📥 ${chatTitle} #${msg.message_id}: 收集 ${resources.length} 条资源`)
  } catch (err) {
    console.error(`❌ 索引失败:`, (err as Error).message)
  }
})

async function main() {
  await ensureIndex()
  console.log('====== 觅源 SeekAll TG 频道收集器 ======')
  console.log(`📡 监听频道: ${CHANNELS.join(', ')}`)
  console.log(`🔍 Meilisearch: ${MEILI_URL}`)
  console.log('等待消息...')
  console.log('')

  bot.launch().then(() => {
    console.log('✅ Bot 已启动')
  })

  process.once('SIGINT', () => bot.stop('SIGINT'))
  process.once('SIGTERM', () => bot.stop('SIGTERM'))
}

main().catch(console.error)
