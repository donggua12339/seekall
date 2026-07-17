/**
 * Quickstart 5 - 自定义 Rule
 *
 * 不依赖市场，自己写一个 Rule 接入任意 API。
 * 这里演示一个最简的"词典 API"规则。
 */

import { createEngine } from '../dist/index.js'

/**
 * 自定义 Rule - 接入免费词典 API（dictionaryapi.dev）
 * @type {import('@seekall/sdk').Rule}
 */
const dictionaryRule = {
  name: '@my-scope/rule-dictionary',
  version: '1.0.0',
  riskLevel: 0,
  description: '查英文单词释义（L0 学术纯净）',
  async run(query, ctx) {
    const word = query.trim().toLowerCase().split(/\s+/)[0]
    if (!word) return []

    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    ctx.logger.info(`dictionary: fetching ${url}`)

    const res = await fetch(url, { signal: ctx.signal })
    if (!res.ok) return []

    const data = await res.json()
    if (!Array.isArray(data)) return []

    return data.map((entry) => {
      const meaning = entry.meanings?.[0]
      const def = meaning?.definitions?.[0]?.definition
      return {
        title: `${entry.word} (${meaning?.partOfSpeech || 'unknown'})`,
        url: `https://www.dictionary.com/browse/${entry.word}`,
        snippet: def,
        source: 'dictionaryapi.dev',
        meta: {
          phonetic: entry.phonetic,
          origin: entry.origin,
        },
      }
    })
  },
}

const engine = createEngine({ rules: [dictionaryRule] })
const hits = await engine.search('serendipity')
console.log(`found ${hits.length} definitions:`)
for (const h of hits) {
  console.log(`  - ${h.title}`)
  console.log(`    ${h.snippet}`)
}
