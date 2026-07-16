/**
 * SimHash 相似度去重
 *
 * 原理：
 *   1. 对文本分词，每个词计算 hash
 *   2. 加权累加（词频或位置权重）
 *   3. 得到 64 位指纹
 *   4. 两个指纹的汉明距离 <= 3 视为相似
 *
 * 用途：
 *   - 搜索结果去重（同一资源不同标题）
 *   - 标题相似度检测（"三体" vs "三体 第一季" vs "【三体】"）
 *
 * 性能：
 *   - 单次计算 ~0.1ms
 *   - 1000 条结果去重 ~100ms
 */

// 简单的 32 位 hash（djb2 算法）
function hash32(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return hash
}

/**
 * 中文分词（简单版）
 * - 中文按字分词
 * - 英文/数字按词分词
 * - 去除标点和空白
 */
function tokenize(text: string): string[] {
  const tokens: string[] = []
  const cleaned = text
    .toLowerCase()
    .replace(/[\s\p{P}]+/gu, ' ')
    .trim()
  if (!cleaned) return tokens

  // 英文/数字词
  const enWords = cleaned.match(/[a-z0-9]+/g) || []
  tokens.push(...enWords)

  // 中文字（每字一个 token）
  const cnChars = cleaned.match(/[\u4e00-\u9fa5]/g) || []
  tokens.push(...cnChars)

  // 中文双字组（bigram，提升匹配精度）
  for (let i = 0; i < cnChars.length - 1; i++) {
    tokens.push(cnChars[i] + cnChars[i + 1])
  }

  return tokens
}

/**
 * 计算 SimHash 指纹（64 位，用两个 32 位 number 表示）
 */
export function simhash(text: string): { high: number; low: number } {
  const tokens = tokenize(text)
  if (tokens.length === 0) return { high: 0, low: 0 }

  // 统计词频
  const freq = new Map<string, number>()
  for (const t of tokens) {
    freq.set(t, (freq.get(t) || 0) + 1)
  }

  // 64 位向量（用 Int32Array 表示 64 个权重）
  const v = new Int32Array(64)

  for (const [token, count] of freq) {
    const h = hash32(token)
    // 用 hash 的每一位更新向量
    for (let i = 0; i < 32; i++) {
      const bit = (h >> i) & 1
      v[i] += bit ? count : -count
    }
    // 用 hash 的高位扩展到 64 位
    const h2 = hash32(token + '_2')
    for (let i = 0; i < 32; i++) {
      const bit = (h2 >> i) & 1
      v[32 + i] += bit ? count : -count
    }
  }

  // 生成指纹
  let high = 0
  let low = 0
  for (let i = 0; i < 32; i++) {
    if (v[i] > 0) low |= 1 << i
    if (v[32 + i] > 0) high |= 1 << i
  }

  return { high, low }
}

/**
 * 计算两个 64 位指纹的汉明距离
 */
export function hammingDistance(
  a: { high: number; low: number },
  b: { high: number; low: number },
): number {
  // 异或后数 1 的个数
  const xh = a.high ^ b.high
  const xl = a.low ^ b.low
  return popcount(xh) + popcount(xl)
}

function popcount(n: number): number {
  n = n - ((n >>> 1) & 0x55555555)
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333)
  n = (n + (n >>> 4)) & 0x0f0f0f0f
  return Math.imul(n + (n >>> 8) + (n >>> 16) + (n >>> 24), 0x01010101) >>> 24
}

/**
 * 标题 normalize（去重前预处理）
 * - 去除【】[]【】等装饰符号
 * - 去除"高清/蓝光/1080p"等质量标签
 * - 去除 emoji 和特殊符号
 * - 统一全角半角
 */
export function normalizeTitle(title: string): string {
  return (
    title
      // 全角转半角
      .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      // 去 emoji
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      // 去装饰符号 【】[]【】《》〈〉「」『』
      .replace(/[\[\]【】《》〈〉「」『』()（）]/g, ' ')
      // 去质量标签
      .replace(
        /\b(高清|蓝光|1080p|720p|2160p|4K|HDR|SDR|WEB-DL|BluRay|HDTV|完整版|全集|未删减|国語|国语|中字|中英双字|双语|原轨|高码率|压制|内嵌|外挂)\b/gi,
        ' ',
      )
      // 去年份
      .replace(/\b(19|20)\d{2}\b/g, ' ')
      // 去文件大小
      .replace(/\d+(\.\d+)?\s*(GB|MB|KB|TB|G|M|K)/gi, ' ')
      // 去多空格
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  )
}

/**
 * SimHash 去重器
 * 维护已见指纹列表，新结果与已有指纹比较，相似则视为重复
 */
export class SimHashDeduplicator {
  private fingerprints: Array<{ index: number; hash: { high: number; low: number } }> = []
  private readonly threshold: number

  constructor(threshold: number = 3) {
    this.threshold = threshold
  }

  /**
   * 检查标题是否与已见标题相似
   * 返回 true 表示是重复（应跳过），false 表示是新内容（应保留）
   */
  isDuplicate(title: string): boolean {
    const normalized = normalizeTitle(title)
    if (!normalized) return false
    const hash = simhash(normalized)

    for (const existing of this.fingerprints) {
      const dist = hammingDistance(hash, existing.hash)
      if (dist <= this.threshold) {
        return true
      }
    }

    this.fingerprints.push({ index: this.fingerprints.length, hash })
    return false
  }

  reset(): void {
    this.fingerprints = []
  }

  size(): number {
    return this.fingerprints.length
  }
}
