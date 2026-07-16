/**
 * DHT 爬虫（部署在香港服务器）
 *
 * 原理：
 *   1. 加入 BitTorrent DHT 网络（Kademlia）
 *   2. 监听 DHT 网络中的 announce 消息（peer 通告）
 *   3. 获取 infohash + 通过 Jackett 查询名称
 *   4. 写入 Meilisearch 索引（dht-resources）
 *
 * bittorrent-dht v11+ 是 ESM-only，用动态 import 加载
 */

const meilisearchPkg = require('meilisearch')
// meilisearch v0.41+ 导出名为 Meilisearch（小写 s）
const MeiliSearch = meilisearchPkg.Meilisearch || meilisearchPkg.MeiliSearch || meilisearchPkg.default

const MEILI_URL = process.env.MEILISEARCH_URL || 'http://localhost:7700'
const MEILI_KEY = process.env.MEILISEARCH_KEY || ''
const DHT_PORT = parseInt(process.env.DHT_PORT || '16881', 10)
const INDEX_NAME = 'dht-resources'

const meili = new MeiliSearch({ host: MEILI_URL, apiKey: MEILI_KEY })

async function ensureIndex() {
  try {
    await meili.getIndex(INDEX_NAME)
  } catch {
    await meili.createIndex(INDEX_NAME, { primaryKey: 'infohash' })
    console.log(`[DHT] Created index: ${INDEX_NAME} with primaryKey=infohash`)
  }
  await meili.index(INDEX_NAME).updateSearchableAttributes(['title', 'infohash'])
  await meili.index(INDEX_NAME).updateFilterableAttributes(['category'])
}

let indexedCount = 0
let announceCount = 0
let seenHashes = new Set()
let pendingMetadata = new Map()

async function lookupNameViaJackett(hash) {
  const jackettUrl = process.env.JACKETT_URL
  const jackettKey = process.env.JACKETT_API_KEY
  if (!jackettUrl || !jackettKey) return null

  try {
    const resp = await fetch(
      `${jackettUrl}/api/v2.0/indexers/all/results?apikey=${jackettKey}&q=${hash}&limit=1`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (resp.ok) {
      const data = await resp.json()
      const result = data.Results?.[0]
      if (result?.Title) return result.Title
    }
  } catch {}
  return null
}

async function processPending(dht) {
  if (pendingMetadata.size === 0) return

  const batchSize = 20
  const entries = Array.from(pendingMetadata.entries()).slice(0, batchSize)
  const docs = []

  for (const [hash] of entries) {
    const title = await lookupNameViaJackett(hash)
    if (title) {
      docs.push({
        title,
        infohash: hash,
        url: `magnet:?xt=urn:btih:${hash}`,
        source: 'dht',
        fileType: 'magnet',
        category: 'magnet',
        indexedAt: new Date().toISOString(),
      })
    }
    pendingMetadata.delete(hash)
  }

  if (docs.length > 0) {
    try {
      await meili.index(INDEX_NAME).addDocuments(docs)
      indexedCount += docs.length
      console.log(`[DHT] Indexed ${docs.length} torrents (total: ${indexedCount})`)
    } catch (err) {
      console.error(`[DHT] Meilisearch write failed: ${err.message}`)
    }
  }
}

async function main() {
  await ensureIndex()

  // 动态 import ESM 模块
  const { default: DHT } = await import('bittorrent-dht')

  const dht = new DHT({
    bootstrap: [
      'router.bittorrent.com:6881',
      'router.utorrent.com:6881',
      'dht.transmissionbt.com:6881',
      'dht.libtorrent.org:25401',
    ],
    host: '0.0.0.0',
    port: DHT_PORT,
  })

  dht.on('announce_peer', (infoHash, peer) => {
    announceCount++
    const hash = infoHash.toString('hex')
    if (seenHashes.has(hash) || pendingMetadata.has(hash)) return

    seenHashes.add(hash)
    pendingMetadata.set(hash, { addedAt: Date.now() })

    if (pendingMetadata.size > 500) {
      const oldest = pendingMetadata.keys().next().value
      pendingMetadata.delete(oldest)
    }
    if (seenHashes.size > 50000) {
      seenHashes = new Set(Array.from(seenHashes).slice(-10000))
    }
  })

  dht.listen(DHT_PORT, () => {
    console.log(`[DHT] Listening on UDP port ${DHT_PORT}`)
    console.log(`[DHT] Meilisearch: ${MEILI_URL}, index: ${INDEX_NAME}`)
  })

  setInterval(() => processPending(dht), 5000)

  setInterval(() => {
    const nodes = dht.nodes ? dht.nodes.length : 0
    console.log(`[DHT] nodes=${nodes} announces=${announceCount} indexed=${indexedCount} pending=${pendingMetadata.size}`)
  }, 30000)

  process.on('SIGINT', () => {
    console.log('\n[DHT] Shutting down...')
    dht.destroy(() => process.exit(0))
  })
  process.on('SIGTERM', () => {
    dht.destroy(() => process.exit(0))
  })
}

main().catch((err) => {
  console.error('[DHT] Fatal:', err)
  process.exit(1)
})
