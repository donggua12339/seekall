/**
 * Quickstart 1 - 最小用法
 *
 * 安装 0 个规则，搜索返回空数组。
 * 这是最小可运行的 SeekAll 程序。
 */

import { createEngine } from '../dist/index.js'

const engine = createEngine({ rules: [] })

const hits = await engine.search('hello')
console.log(`hits: ${hits.length}`) // hits: 0
