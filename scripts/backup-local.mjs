#!/usr/bin/env node
// 觅源 SeekAll - 本地数据备份脚本（Windows 兼容）
// 用法：node scripts/backup-local.mjs
// 输出：dumps/YYYYMMDD_HHMMSS/ 目录

import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import { mkdirSync, writeFileSync, statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT_ROOT = join(process.cwd())
const DUMPS_DIR = join(PROJECT_ROOT, 'dumps')
const TIMESTAMP = new Date()
  .toISOString()
  .replace(/[-:T]/g, '')
  .slice(0, 15) // YYYYMMDD_HHMMSS
const BACKUP_DIR = join(DUMPS_DIR, TIMESTAMP)
mkdirSync(BACKUP_DIR, { recursive: true })

// 从 .env 读取配置（向上找，处理在 apps/api 或根目录运行的情况）
function fileExists(p) {
  try {
    readFileSync(p)
    return true
  } catch {
    return false
  }
}
function findEnv() {
  let dir = process.cwd()
  for (let i = 0; i < 5; i++) {
    const p = join(dir, '.env')
    if (fileExists(p)) return p
    dir = join(dir, '..')
  }
  throw new Error('.env not found')
}
const envFile = findEnv()
const envContent = readFileSync(envFile, 'utf-8')
const env = Object.fromEntries(
  envContent
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const [k, ...v] = l.split('=')
      return [k.trim(), v.join('=').trim()]
    }),
)

const DATABASE_URL = env.DATABASE_URL
const REDIS_URL = env.REDIS_URL || 'redis://localhost:6379'
const MEILI_URL = env.MEILISEARCH_URL || 'http://localhost:7700'
const MEILI_KEY = env.MEILISEARCH_MASTER_KEY || ''

console.log('====== 觅源 SeekAll 本地备份 ======')
console.log(`备份目录: ${BACKUP_DIR}`)
console.log('')

const summary = {}

// ====== 1. MySQL 数据 (Prisma) ======
console.log('📦 [1/3] 备份 MySQL (via Prisma)...')
try {
  const prisma = new PrismaClient({
    datasources: { db: { url: DATABASE_URL } },
    log: ['error'],
  })

  // 列出所有 model 名称
  const models = [
    'user', 'userPreference', 'inviteCode', 'membershipCode',
    'searchLog', 'searchHistory', 'favorite', 'collection',
    'linkStatusRecord', 'takedownRecord', 'blockedKeyword',
    'agreement', 'userAgreement', 'adminAuditLog',
    'apiKey', 'cloudAccount', 'subscription', 'download', 'recommendation',
    'subtitle', 'tgAlert',
  ].filter((m) => m in prisma)

  const dbDump = { timestamp: new Date().toISOString(), tables: {} }
  for (const m of models) {
    try {
      const rows = await prisma[m].findMany()
      dbDump.tables[m] = rows.map((r) => ({
        ...r,
        // BigInt → string 避免 JSON 序列化失败
        ...Object.fromEntries(
          Object.entries(r)
            .filter(([_, v]) => typeof v === 'bigint')
            .map(([k, v]) => [k, v.toString()]),
        ),
      }))
      console.log(`  ✓ ${m}: ${rows.length} 行`)
    } catch (err) {
      console.log(`  ⚠ ${m}: ${err.message.slice(0, 80)}`)
    }
  }

  const dbFile = join(BACKUP_DIR, 'mysql.json')
  writeFileSync(dbFile, JSON.stringify(dbDump, null, 2))
  summary.mysql = {
    file: dbFile,
    size: statSync(dbFile).size,
    tables: Object.keys(dbDump.tables).length,
  }

  await prisma.$disconnect()
} catch (err) {
  console.log(`  ❌ MySQL 备份失败: ${err.message}`)
  summary.mysql = { error: err.message }
}

// ====== 2. Redis 数据 ======
console.log('📦 [2/3] 备份 Redis...')
try {
  const redis = new Redis(REDIS_URL, { lazyConnect: true })
  await redis.connect()

  const redisDump = { keys: {} }
  let scannedCount = 0
  let cursor = '0'
  do {
    const [next, keys] = await redis.scan(cursor, 'COUNT', 100)
    cursor = next
    for (const key of keys) {
      try {
        const type = await redis.type(key)
        if (type === 'string') redisDump.keys[key] = { type, value: await redis.get(key) }
        else if (type === 'hash') redisDump.keys[key] = { type, value: await redis.hgetall(key) }
        else if (type === 'list') redisDump.keys[key] = { type, value: await redis.lrange(key, 0, -1) }
        else if (type === 'set') redisDump.keys[key] = { type, value: await redis.smembers(key) }
        else if (type === 'zset') {
          const z = await redis.zrange(key, 0, -1, 'WITHSCORES')
          redisDump.keys[key] = { type, value: z }
        } else redisDump.keys[key] = { type, value: null }
        scannedCount++
      } catch (err) {
        redisDump.keys[key] = { error: err.message }
      }
    }
  } while (cursor !== '0' && cursor !== 0)

  const redisFile = join(BACKUP_DIR, 'redis.json')
  writeFileSync(redisFile, JSON.stringify(redisDump, null, 2))
  summary.redis = {
    file: redisFile,
    size: statSync(redisFile).size,
    keys: scannedCount,
  }
  console.log(`  ✓ Redis: ${scannedCount} 个 key`)
  await redis.quit()
} catch (err) {
  console.log(`  ❌ Redis 备份失败: ${err.message}`)
  summary.redis = { error: err.message }
}

// ====== 3. Meilisearch 快照 ======
console.log('📦 [3/3] Meilisearch 快照...')
try {
  const resp = await fetch(`${MEILI_URL}/snapshots`, {
    method: 'POST',
    headers: MEILI_KEY ? { Authorization: `Bearer ${MEILI_KEY}` } : {},
  })
  summary.meili = { status: resp.status, ok: resp.ok }
  console.log(`  ${resp.ok ? '✓' : '⚠'} Meili snapshot HTTP ${resp.status}`)
  if (!resp.ok) {
    const txt = await resp.text()
    console.log(`     ${txt.slice(0, 200)}`)
  }
} catch (err) {
  console.log(`  ❌ Meili snapshot 失败: ${err.message}`)
  summary.meili = { error: err.message }
}

// ====== 汇总 ======
const summaryFile = join(BACKUP_DIR, '_summary.json')
writeFileSync(
  summaryFile,
  JSON.stringify(
    { timestamp: TIMESTAMP, isoTime: new Date().toISOString(), summary },
    null,
    2,
  ),
)
console.log('')
console.log('====== 备份完成 ======')
console.log(JSON.stringify(summary, null, 2))
