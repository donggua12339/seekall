/**
 * 觅源 SeekAll - DHT 磁力爬虫
 *
 * 加入 BitTorrent DHT 网络，自治收集种子元数据。
 * 收集的种子信息存入 Meilisearch，供 DhtProvider 搜索。
 *
 * 原理：
 *   1. 加入 DHT 网络（Kademlia 协议）
 *   2. 监听 get_peers / announce_peer 请求，收集 info_hash
 *   3. 用 webtorrent 获取种子元数据（名称、文件列表）
 *   4. 存入 Meilisearch 索引
 *
 * 配置（.env）：
 *   MEILISEARCH_URL=http://localhost:7700
 *   MEILISEARCH_MASTER_KEY=xxx
 *   DHT_PORT=6881  # DHT 监听端口（需公网可达）
 *   DHT_BOOTSTRAP=router.bittorrent.com:6881  # 引导节点
 *
 * 注意：
 *   - DHT 需要公网 IP，香港服务器可运行，本地 NAT 环境效果差
 *   - 存储 TB 级数据，需大磁盘
 *   - CPU/内存占用较高
 */

import DHT from 'bittorrent-dht'
import { MeiliSearch } from 'meilisearch'
import { createHash } from 'crypto'

const MEILI_URL = process.env.MEILISEARCH_URL || 'http://localhost:7700'
const MEILI_KEY = process.env.MEILISEARCH_MASTER_KEY
const DHT_PORT = Number(process.env.DHT_PORT || 6881)
const DHT_BOOTSTRAP = process.env.DHT_BOOTSTRAP || 'router.bittorrent.com:6881'

const meili = new MeiliSearch({ host: MEILI_URL, apiKey: MEILI_KEY })
const INDEX_NAME = 'dht-resources'

interface DhtResource {
  id: string // info_hash
  infoHash: string
  name: string
  files: Array<{ path: string; length: number }>
  totalSize: number
  magnet: string
  discoveredAt: number
}

async function ensureIndex() {
  try {
    await meili.getIndex(INDEX_NAME)
  } catch {
    await meili.createIndex(INDEX_NAME, { primaryKey: 'id' })
  }
  await meili.index(INDEX_NAME).updateSearchableAttributes(['name', 'files.path'])
  await meili.index(INDEX_NAME).updateFilterableAttributes(['totalSize'])
  await meili.index(INDEX_NAME).updateSortableAttributes(['discoveredAt', 'totalSize'])
  console.log(`✅ Meilisearch 索引 "${INDEX_NAME}" 就绪`)
}

// 已收集的 info_hash 集合（去重）
const collectedHashes = new Set<string>()

async function indexResource(infoHash: string, name: string, files: Array<{ path: string; length: number }>) {
  if (!name && files.length === 0) return

  const totalSize = files.reduce((sum, f) => sum + (f.length || 0), 0)
  const magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(name)}`

  const resource: DhtResource = {
    id: infoHash,
    infoHash,
    name: name || `未命名 ${infoHash.slice(0, 8)}`,
    files,
    totalSize,
    magnet,
    discoveredAt: Date.now(),
  }

  try {
    await meili.index(INDEX_NAME).addDocuments([resource])
    console.log(`📥 已索引: ${name.slice(0, 50)} (${formatSize(totalSize)})`)
  } catch (err) {
    console.error(`❌ 索引失败:`, (err as Error).message)
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

async function fetchMetadata(infoHash: string): Promise<{ name: string; files: Array<{ path: string; length: number }> } | null> {
  // 元数据获取需要 webtorrent，这里简化：
  // 实际实现需要用 webtorrent 连接 peer 获取 metadata
  // 由于复杂度高，这里只记录 info_hash，metadata 留空
  // 生产环境建议用 Python magnetico 或 Go bitmagnet

  return {
    name: `种子 ${infoHash.slice(0, 12)}`,
    files: [],
  }
}

async function main() {
  await ensureIndex()

  console.log('====== 觅源 SeekAll DHT 爬虫 ======')
  console.log(`📡 DHT 端口: ${DHT_PORT}`)
  console.log(`🌐 引导节点: ${DHT_BOOTSTRAP}`)
  console.log(`🔍 Meilisearch: ${MEILI_URL}`)
  console.log('')

  const dht = new DHT({
    nodeId: createHash('sha1').update(String(Date.now())).digest(),
    bootstrap: DHT_BOOTSTRAP,
  })

  dht.listen(DHT_PORT, () => {
    console.log(`✅ DHT 已启动，监听端口 ${DHT_PORT}`)
  })

  // 监听 get_peers 请求，收集 info_hash
  dht.on('get_peers', (req: { info_hash?: Buffer; a?: { info_hash?: Buffer } }) => {
    const infoHashBuf = req.info_hash || req.a?.info_hash
    if (!infoHashBuf) return

    const infoHash = infoHashBuf.toString('hex')
    if (collectedHashes.has(infoHash)) return

    collectedHashes.add(infoHash)
    console.log(`🔍 发现 info_hash: ${infoHash} (总计: ${collectedHashes.size})`)

    // 异步获取元数据并索引
    fetchMetadata(infoHash)
      .then((meta) => {
        if (meta) {
          indexResource(infoHash, meta.name, meta.files)
        }
      })
      .catch((err) => {
        console.error(`❌ 获取元数据失败 ${infoHash}:`, (err as Error).message)
      })
  })

  dht.on('announce_peer', (req: { info_hash?: Buffer; a?: { info_hash?: Buffer } }) => {
    const infoHashBuf = req.info_hash || req.a?.info_hash
    if (!infoHashBuf) return
    const infoHash = infoHashBuf.toString('hex')
    if (!collectedHashes.has(infoHash)) {
      collectedHashes.add(infoHash)
      console.log(`📢 announce_peer: ${infoHash}`)
    }
  })

  dht.on('ready', () => {
    console.log('✅ DHT 网络就绪，开始收集 info_hash...')
  })

  dht.on('error', (err: Error) => {
    console.error('❌ DHT 错误:', err.message)
  })

  // 定期输出统计
  setInterval(() => {
    console.log(`📊 统计: 已收集 ${collectedHashes.size} 个 info_hash`)
  }, 60000)

  // 优雅关闭
  process.once('SIGINT', () => {
    console.log('\n正在关闭 DHT...')
    dht.destroy()
    process.exit(0)
  })
  process.once('SIGTERM', () => {
    dht.destroy()
    process.exit(0)
  })
}

main().catch(console.error)
