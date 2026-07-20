import { createEngine } from '../packages/sdk/dist/index.js'
import github from '../packages/rule-github/dist/index.js'
import hackernews from '../packages/rule-hackernews/dist/index.js'

const engine = createEngine({ rules: [github, hackernews] })
const hits = await engine.search('react state machine')
console.log(`got ${hits.length} hits`)
const sources = [...new Set(hits.map((h) => h.source))]
console.log('sources:', sources)
console.log('first github hit:', hits.find((h) => h.source === 'github.com'))
console.log('first hn hit:', hits.find((h) => h.source === 'news.ycombinator.com'))
