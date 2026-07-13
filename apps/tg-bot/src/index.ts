/**
 * 觅源 SeekAll - Telegram Bot
 * 通过 SeekAll API 搜索全网资源
 */

import { Telegraf, Markup } from 'telegraf'
import type { Context } from 'telegraf'

const BOT_TOKEN = process.env.TG_BOT_TOKEN
const API_URL = process.env.SEEKALL_API_URL || 'http://localhost:7301'
const API_KEY = process.env.SEEKALL_API_KEY

if (!BOT_TOKEN) {
  console.error('❌ 请设置 TG_BOT_TOKEN 环境变量')
  console.error('   从 @BotFather 获取: https://t.me/BotFather')
  process.exit(1)
}

const bot = new Telegraf(BOT_TOKEN)

interface SearchResultItem {
  title: string
  url: string
  source: string
  sourceDisplayName: string
  category: string
  fileType?: string
  resourceMeta?: {
    password?: string | null
    datetime?: string | null
  }
}

interface SearchResponse {
  list: SearchResultItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  durationMs: number
  providers: string[]
  errors: string[]
}

/**
 * 调用 SeekAll API 搜索
 */
async function search(keyword: string, page: number = 1): Promise<SearchResponse | null> {
  const url = new URL('/api/v1/search', API_URL)
  url.searchParams.set('keyword', keyword)
  url.searchParams.set('page', String(page))
  url.searchParams.set('pageSize', '10')

  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY
  }

  try {
    const res = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    const data = (await res.json()) as { code: number; data: SearchResponse }
    return data.code === 0 ? data.data : null
  } catch {
    return null
  }
}

/**
 * 格式化搜索结果为 TG 消息
 */
function formatResults(results: SearchResponse, keyword: string): string {
  if (results.list.length === 0) {
    return `🔍 搜索 "${keyword}" 无结果\n\n💡 试试：\n• 模糊搜索\n• 换个关键词\n• 检查拼写`
  }

  const lines: string[] = []
  lines.push(`🔍 搜索 "${keyword}"`)
  lines.push(`📊 共 ${results.total} 条结果 · ${results.durationMs}ms · 来源: ${results.providers.join(', ')}`)
  lines.push('')

  results.list.slice(0, 10).forEach((item, idx) => {
    const title = item.title.length > 60 ? item.title.slice(0, 57) + '...' : item.title
    lines.push(`${idx + 1}. ${title}`)
    if (item.fileType) lines.push(`   📦 ${item.fileType}`)
    if (item.resourceMeta?.password) lines.push(`   🔑 提取码: ${item.resourceMeta.password}`)
    lines.push(`   🔗 ${item.url}`)
    lines.push('')
  })

  lines.push('━━━━━━━━━━━━━')
  lines.push('⚠️ 本 Bot 仅提供链接聚合，不存储内容')
  return lines.join('\n')
}

/**
 * /start 命令
 */
bot.start((ctx: Context) => {
  ctx.reply(
    [
      '👋 欢迎使用 觅源 SeekAll Bot',
      '',
      '🔍 直接发送关键词即可搜索全网资源',
      '📖 /search <关键词> - 搜索资源',
      '📖 /help - 查看帮助',
      '',
      '⚠️ 本 Bot 仅提供链接聚合，不存储任何文件内容',
      '⚠️ 使用本 Bot 产生的后果由用户自行承担',
    ].join('\n'),
  )
})

/**
 * /help 命令
 */
bot.help((ctx: Context) => {
  ctx.reply(
    [
      '📖 使用帮助',
      '',
      '🔍 搜索资源：',
      '  • 直接发送关键词',
      '  • /search <关键词>',
      '',
      '📋 命令列表：',
      '  /start - 欢迎信息',
      '  /search - 搜索资源',
      '  /help - 查看帮助',
      '',
      '⚠️ 合规说明：',
      '  • 仅提供链接聚合，不存储内容',
      '  • 侵权内容请通过网站举报',
    ].join('\n'),
  )
})

/**
 * /search 命令
 */
bot.command('search', async (ctx: Context) => {
  const text = ctx.message?.text || ''
  const keyword = text.replace(/^\/search\s*/, '').trim()

  if (!keyword) {
    ctx.reply('❌ 请输入搜索关键词\n用法: /search 三体')
    return
  }

  await ctx.replyWithChatAction('typing')

  const results = await search(keyword)
  if (!results) {
    ctx.reply('❌ 搜索失败，请稍后重试')
    return
  }

  ctx.reply(formatResults(results, keyword), {
    disable_web_page_preview: true,
    ...Markup.inlineKeyboard([
      [Markup.button.url('🌐 打开 SeekAll', 'https://seekall.winmelon.cn')],
    ]),
  })
})

/**
 * 直接发送关键词 - 快速搜索
 */
bot.on('text', async (ctx: Context) => {
  const keyword = (ctx.message as { text: string }).text.trim()

  // 跳过命令
  if (keyword.startsWith('/')) return

  if (keyword.length > 100) {
    ctx.reply('❌ 关键词过长（最多 100 字符）')
    return
  }

  await ctx.replyWithChatAction('typing')

  const results = await search(keyword)
  if (!results) {
    ctx.reply('❌ 搜索失败，请稍后重试')
    return
  }

  ctx.reply(formatResults(results, keyword), {
    disable_web_page_preview: true,
  })
})

/**
 * 错误处理
 */
bot.catch((err: unknown) => {
  console.error('Bot error:', err)
})

/**
 * 启动
 */
bot.launch().then(() => {
  console.log('✅ SeekAll TG Bot 已启动')
  console.log(`   API: ${API_URL}`)
  console.log(`   API Key: ${API_KEY ? '已配置' : '未配置'}`)
})

// 优雅关闭
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
