/**
 * SeekAll CLI 配置管理
 *
 * 优先级: env 变量 > ~/.seekall/config.json > 命令行参数
 * 类似 OPENAI_API_KEY / gh / npm 的混合模式
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { homedir } from 'os'

const CONFIG_DIR = process.env.SEEKALL_CONFIG_DIR || join(homedir(), '.seekall')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

export interface SeekallConfig {
  /** SeekAll API 服务器 URL(不带 /api/v1) */
  serverUrl: string
  /** License code(用户购买后获得,用于 SDK 调用需鉴权的接口) */
  license?: string
  /** 默认规则列表(npm 包名,search 命令默认加载这些) */
  defaultRules: string[]
  /** 输出格式: text | json */
  outputFormat: 'text' | 'json'
}

const DEFAULT_CONFIG: SeekallConfig = {
  serverUrl: 'https://seekall.winmelon.cn',
  defaultRules: [
    '@seekall/rule-arxiv',
    '@seekall/rule-crossref',
    '@seekall/rule-pubmed',
  ],
  outputFormat: 'text',
}

/** 读配置文件(不存在返回默认值) */
function readConfigFile(): Partial<SeekallConfig> {
  if (!existsSync(CONFIG_FILE)) return {}
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

/** 写配置文件(合并写入) */
function writeConfigFile(patch: Partial<SeekallConfig>): void {
  mkdirSync(dirname(CONFIG_FILE), { recursive: true })
  const current = readConfigFile()
  const next = { ...current, ...patch }
  writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf-8')
}

/**
 * 解析最终配置(优先级: env > config file > default)
 *
 * @param paramOverrides 命令行参数覆盖(最高优先级)
 */
export function resolveConfig(paramOverrides?: Partial<SeekallConfig>): SeekallConfig {
  const fileConfig = readConfigFile()

  return {
    serverUrl:
      process.env.SEEKALL_SERVER_URL ||
      paramOverrides?.serverUrl ||
      fileConfig.serverUrl ||
      DEFAULT_CONFIG.serverUrl,
    license:
      process.env.SEEKALL_LICENSE ||
      paramOverrides?.license ||
      fileConfig.license ||
      undefined,
    defaultRules:
      paramOverrides?.defaultRules ||
      fileConfig.defaultRules ||
      DEFAULT_CONFIG.defaultRules,
    outputFormat:
      (process.env.SEEKALL_OUTPUT_FORMAT as 'text' | 'json' | undefined) ||
      paramOverrides?.outputFormat ||
      fileConfig.outputFormat ||
      DEFAULT_CONFIG.outputFormat,
  }
}

/** 获取配置项(key 不存在时返回 undefined) */
export function getConfigValue(
  key: keyof SeekallConfig,
): string | string[] | undefined {
  const config = resolveConfig()
  return config[key]
}

/** 设置配置项(写入 config file) */
export function setConfigValue(
  key: keyof SeekallConfig,
  value: string | string[],
): void {
  const patch: Partial<SeekallConfig> = { [key]: value }
  writeConfigFile(patch)
}

/** 列出所有配置项(包括默认值) */
export function listConfig(): SeekallConfig {
  return resolveConfig()
}

/** 配置文件路径(给 whoami / config 命令展示用) */
export function getConfigPath(): string {
  return CONFIG_FILE
}
