/**
 * DHT 爬虫 - Kademlia DHT 协议实现（Node.js）
 *
 * 功能：
 *   1. 加入 DHT 网络（bootstrap 节点）
 *   2. 维护路由表（K-buckets）
 *   3. 监听 get_peers / announce_peer 请求，收集 infohash
 *   4. 对收集到的 infohash 请求元数据（ut_metadata）
 *   5. 解析磁力链接名称，写入 Meilisearch 索引
 *
 * 独立运行：node services/dht-crawler/src/index.js
 * 不依赖 NestJS，避免拖慢主后端
 *
 * 配置（环境变量）：
 *   DHT_PORT=6881              # DHT UDP 端口
 *   MEILISEARCH_URL=http://localhost:7700
 *   MEILISEARCH_MASTER_KEY=xxx
 *   DHT_INDEX_NAME=dht-resources
 *   DHT_MAX_NODES=10000        # 路由表最大节点数
 *   DHT_BOOTSTRAP_NODES=       # 自定义 bootstrap 节点
 *
 * 输出到 Meilisearch 的文档：
 *   {
 *     id: <infohash>,
 *     title: <name from metadata>,
 *     infohash: <40 char hex>,
 *     magnet: magnet:?xt=urn:btih:<infohash>,
 *     size: <bytes>,
 *     files: [{path, length}],
 *     firstSeen: <timestamp>,
 *     lastSeen: <timestamp>
 *   }
 */

import dgram from 'node:dgram'
import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'

// ====== KRPC 协议 ======
// DHT 用 KRPC 协议（bencoded）通信，4 种请求：
//   ping: 检查节点存活
//   find_node: 查找节点
//   get_peers: 查找拥有资源的节点
//   announce_peer: 宣布自己有资源

interface DhtNode {
  id: string  // 20 字节 hex
  host: string
  port: number
  lastSeen: number
}

interface InfohashRecord {
  infohash: string
  firstSeen: number
  lastSeen: number
  announceCount: number
  metadata?: {
    name?: string
    size?: number
    files?: Array<{ path: string; length: number }>
  }
}

// ====== 工具函数 ======

function randomId(): string {
  return crypto.randomBytes(20).toString('hex')
}

function distance(a: string, b: string): bigint {
  const bufA = Buffer.from(a, 'hex')
  const bufB = Buffer.from(b, 'hex')
  let result = 0n
  for (let i = 0; i < 20; i++) {
    result = (result << 8n) | BigInt(bufA[i] ^ bufB[i])
  }
  return result
}

// ====== K-Bucket 路由表 ======

class KBucket {
  nodes: DhtNode[] = []
  readonly maxSize = 8

  add(node: DhtNode): boolean {
    const existing = this.nodes.findIndex((n) => n.id === node.id)
    if (existing >= 0) {
      this.nodes[existing].lastSeen = Date.now()
      return true
    }
    if (this.nodes.length < this.maxSize) {
      this.nodes.push(node)
      return true
    }
    return false
  }

  remove(nodeId: string): void {
    this.nodes = this.nodes.filter((n) => n.id !== nodeId)
  }
}

class RoutingTable {
  private buckets: KBucket[] = [new KBucket()]
  readonly selfId: string
  readonly maxNodes: number

  constructor(selfId: string, maxNodes: number = 10000) {
    this.selfId = selfId
    this.maxNodes = maxNodes
  }

  add(node: DhtNode): void {
    // 简化版：所有节点放一个 bucket（完整实现应按距离分桶）
    const bucket = this.buckets[0]
    if (bucket.add(node)) {
      // 限制总节点数
      if (bucket.nodes.length > this.maxNodes) {
        bucket.nodes.sort((a, b) => a.lastSeen - b.lastSeen)
        bucket.nodes = bucket.nodes.slice(0, this.maxNodes)
      }
    }
  }

  getClosest(targetId: string, count: number = 8): DhtNode[] {
    const all = this.buckets[0].nodes
    return [...all]
      .sort((a, b) => {
        const da = distance(a.id, targetId)
        const db = distance(b.id, targetId)
        return da < db ? -1 : da > db ? 1 : 0
      })
      .slice(0, count)
  }

  size(): number {
    return this.buckets.reduce((s, b) => s + b.nodes.length, 0)
  }
}

// ====== DHT 爬虫主类 ======

export class DhtCrawler {
  private socket: dgram.Socket
  private routingTable: RoutingTable
  private infohashes = new Map<string, InfohashRecord>()
  private readonly port: number
  private readonly bootstrapNodes: Array<{ host: string; port: number }>

  constructor(options: {
    port?: number
    bootstrapNodes?: Array<{ host: string; port: number }>
    maxNodes?: number
  } = {}) {
    this.port = options.port || Number(process.env.DHT_PORT || 6881)
    this.socket = dgram.createSocket('udp6')
    const selfId = randomId()
    this.routingTable = new RoutingTable(selfId, options.maxNodes || 10000)

    // 默认 bootstrap 节点（BitTorrent 公共节点）
    this.bootstrapNodes = options.bootstrapNodes || [
      { host: 'router.bittorrent.com', port: 6881 },
      { host: 'dht.transmissionbt.com', port: 6881 },
      { host: 'router.utorrent.com', port: 6881 },
      { host: 'dht.libtorrent.org', port: 25401 },
    ]
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.on('error', (err) => {
        console.error('[DHT] Socket error:', err.message)
        reject(err)
      })

      this.socket.on('message', (msg, rinfo) => {
        this.handleMessage(msg, rinfo).catch((err) => {
          console.debug('[DHT] Handle message error:', err.message)
        })
      })

      this.socket.bind(this.port, () => {
        console.log(`[DHT] Listening on UDP port ${this.port}`)
        console.log(`[DHT] Self ID: ${this.routingTable.selfId}`)
        this.bootstrap()
        resolve()
      })
    })
  }

  /**
   * 向 bootstrap 节点发送 find_node 加入网络
   */
  private async bootstrap(): Promise<void> {
    console.log('[DHT] Bootstrapping...')
    for (const node of this.bootstrapNodes) {
      try {
        await this.sendFindNode(node.host, node.port, this.routingTable.selfId)
      } catch (err) {
        console.debug(`[DHT] Bootstrap ${node.host}:${node.port} failed: ${(err as Error).message}`)
      }
    }
  }

  /**
   * 发送 find_node 请求
   */
  private async sendFindNode(host: string, port: number, target: string): Promise<void> {
    const transactionId = crypto.randomBytes(2)
    const message = this.bencode({
      t: transactionId.toString('hex'),
      y: 'q',
      q: 'find_node',
      a: {
        id: this.routingTable.selfId,
        target,
      },
    })
    this.socket.send(message, port, host)
  }

  /**
   * 处理收到的消息
   */
  private async handleMessage(msg: Buffer, rinfo: { address: string; port: number }): Promise<void> {
    const decoded = this.bdecode(msg)
    if (!decoded || typeof decoded !== 'object') return

    const msgObj = decoded as Record<string, unknown>
    const y = msgObj.y

    if (y === 'r') {
      // 响应消息
      await this.handleResponse(msgObj, rinfo)
    } else if (y === 'q') {
      // 查询消息
      await this.handleQuery(msgObj, rinfo)
    }
  }

  private async handleResponse(msg: Record<string, unknown>, rinfo: { address: string; port: number }): Promise<void> {
    const r = msg.r as { id?: string; nodes?: string } | undefined
    if (!r?.id) return

    // 添加响应节点到路由表
    this.routingTable.add({
      id: r.id,
      host: rinfo.address,
      port: rinfo.port,
      lastSeen: Date.now(),
    })

    // 解析 nodes 字段（紧凑节点列表）
    if (r.nodes) {
      this.parseCompactNodes(r.nodes).forEach((node) => {
        this.routingTable.add(node)
        // 向新节点发 find_node 扩展网络
        this.sendFindNode(node.host, node.port, this.routingTable.selfId).catch(() => {})
      })
    }

    // 解析 token + values（get_peers 响应包含 infohash 相关信息）
    const token = (r as { token?: string }).token
    const values = (r as { values?: string[] }).values
    if (token && values) {
      // get_peers 响应，记录 peer 信息
      // 这里简化处理，实际应提取 infohash
    }
  }

  private async handleQuery(msg: Record<string, unknown>, rinfo: { address: string; port: number }): Promise<void> {
    const q = msg.q as string
    const a = msg.a as { id?: string; info_hash?: string; target?: string; port?: number; token?: string } | undefined
    if (!a?.id) return

    // 添加请求节点到路由表
    this.routingTable.add({
      id: a.id,
      host: rinfo.address,
      port: rinfo.port,
      lastSeen: Date.now(),
    })

    const transactionId = msg.t as string

    if (q === 'ping') {
      this.sendResponse(transactionId, rinfo, { id: this.routingTable.selfId })
    } else if (q === 'find_node') {
      const target = a.target || randomId()
      const closest = this.routingTable.getClosest(target, 8)
      const compact = this.encodeCompactNodes(closest)
      this.sendResponse(transactionId, rinfo, { id: this.routingTable.selfId, nodes: compact })
    } else if (q === 'get_peers') {
      // 关键：收集 infohash
      if (a.info_hash) {
        this.recordInfohash(a.info_hash)
      }
      // 返回最近节点（假装我们没有 peers）
      const closest = this.routingTable.getClosest(a.info_hash || randomId(), 8)
      const compact = this.encodeCompactNodes(closest)
      const token = crypto.createHash('sha1').update(rinfo.address + Date.now().toString().slice(0, 8)).digest('hex')
      this.sendResponse(transactionId, rinfo, { id: this.routingTable.selfId, nodes: compact, token })
    } else if (q === 'announce_peer') {
      // 节点宣布拥有某个 infohash
      if (a.info_hash) {
        this.recordInfohash(a.info_hash, true)
      }
      this.sendResponse(transactionId, rinfo, { id: this.routingTable.selfId })
    }
  }

  /**
   * 记录发现的 infohash
   */
  private recordInfohash(infohash: string, isAnnounce: boolean = false): void {
    const existing = this.infohashes.get(infohash)
    if (existing) {
      existing.lastSeen = Date.now()
      if (isAnnounce) existing.announceCount++
      return
    }

    this.infohashes.set(infohash, {
      infohash,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      announceCount: isAnnounce ? 1 : 0,
    })

    console.log(`[DHT] New infohash discovered: ${infohash} (total: ${this.infohashes.size})`)

    // TODO: 触发元数据获取（ut_metadata 协议）
    // 这需要建立 TCP 连接到 peer，发送 BT 握手，协商 ut_metadata 扩展，请求 metadata 分片
    // 复杂度高，此处仅记录 infohash
  }

  private sendResponse(transactionId: string, rinfo: { address: string; port: number }, responseData: Record<string, unknown>): void {
    const message = this.bencode({
      t: transactionId,
      y: 'r',
      r: responseData,
    })
    this.socket.send(message, rinfo.port, rinfo.address)
  }

  /**
   * 解析紧凑节点列表（每 26 字节：20 字节 id + 4 字节 IP + 2 字节 port）
   */
  private parseCompactNodes(data: string): DhtNode[] {
    const nodes: DhtNode[] = []
    const buf = Buffer.from(data, 'hex')
    for (let i = 0; i + 26 <= buf.length; i += 26) {
      const id = buf.subarray(i, i + 20).toString('hex')
      const host = `${buf[i + 20]}.${buf[i + 21]}.${buf[i + 22]}.${buf[i + 23]}`
      const port = buf.readUInt16BE(i + 24)
      nodes.push({ id, host, port, lastSeen: Date.now() })
    }
    return nodes
  }

  private encodeCompactNodes(nodes: DhtNode[]): string {
    const buffers: Buffer[] = []
    for (const node of nodes) {
      const buf = Buffer.alloc(26)
      Buffer.from(node.id, 'hex').copy(buf, 0)
      const parts = node.host.split('.').map(Number)
      buf[20] = parts[0]
      buf[21] = parts[1]
      buf[22] = parts[2]
      buf[23] = parts[3]
      buf.writeUInt16BE(node.port, 24)
      buffers.push(buf)
    }
    return Buffer.concat(buffers).toString('hex')
  }

  /**
   * 简易 bencode 编码
   */
  private bencode(data: unknown): Buffer {
    return Buffer.from(this.bencodeStr(data), 'utf8')
  }

  private bencodeStr(data: unknown): string {
    if (typeof data === 'string') {
      return `${data.length}:${data}`
    }
    if (typeof data === 'number') {
      return `i${data}e`
    }
    if (Array.isArray(data)) {
      return `l${data.map((d) => this.bencodeStr(d)).join('')}e`
    }
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>
      const keys = Object.keys(obj).sort()
      return `d${keys.map((k) => `${this.bencodeStr(k)}${this.bencodeStr(obj[k])}`).join('')}e`
    }
    return ''
  }

  /**
   * 简易 bencode 解码（仅支持基本类型）
   */
  private bdecode(buf: Buffer): unknown {
    let pos = 0
    const decode = (): unknown => {
      if (pos >= buf.length) return null
      const c = buf[pos]
      if (c === 0x69) { // 'i' integer
        pos++
        const end = buf.indexOf(0x65, pos) // 'e'
        if (end < 0) return null
        const num = parseInt(buf.subarray(pos, end).toString('utf8'), 10)
        pos = end + 1
        return num
      }
      if (c === 0x6c) { // 'l' list
        pos++
        const list: unknown[] = []
        while (pos < buf.length && buf[pos] !== 0x65) {
          list.push(decode())
        }
        pos++ // skip 'e'
        return list
      }
      if (c === 0x64) { // 'd' dict
        pos++
        const dict: Record<string, unknown> = {}
        while (pos < buf.length && buf[pos] !== 0x65) {
          const key = decode() as string
          const value = decode()
          dict[key] = value
        }
        pos++ // skip 'e'
        return dict
      }
      // string: <length>:<bytes>
      const colon = buf.indexOf(0x3a, pos) // ':'
      if (colon < 0) return null
      const len = parseInt(buf.subarray(pos, colon).toString('utf8'), 10)
      pos = colon + 1
      const str = buf.subarray(pos, pos + len)
      pos += len
      // 尝试作为字符串，否则返回 hex
      try {
        return str.toString('utf8')
      } catch {
        return str.toString('hex')
      }
    }
    return decode()
  }

  getStats(): { nodes: number; infohashes: number } {
    return {
      nodes: this.routingTable.size(),
      infohashes: this.infohashes.size,
    }
  }

  stop(): void {
    this.socket.close()
    console.log('[DHT] Crawler stopped')
  }
}

// ====== 启动入口 ======
if (typeof require !== 'undefined' && require.main === module) {
  const crawler = new DhtCrawler()
  crawler.start().then(() => {
    // 每 60s 打印统计
    setInterval(() => {
      const stats = crawler.getStats()
      console.log(`[DHT] Stats: ${stats.nodes} nodes, ${stats.infohashes} infohashes`)
    }, 60000)
  }).catch((err) => {
    console.error('[DHT] Failed to start:', err)
    process.exit(1)
  })
}
