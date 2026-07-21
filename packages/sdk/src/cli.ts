#!/usr/bin/env node
/**
 * @seekall/sdk CLI - 完整命令集
 *
 * 命令:
 *   seekall search <keyword>           搜索(默认带 3 个 L0 规则)
 *   seekall license redeem <code>     激活 license code
 *   seekall sync                       从服务器同步订阅规则
 *   seekall rules list                 列出可用规则(内置 + 市场)
 *   seekall config set <key> <value>  设置配置项
 *   seekall config get <key>           获取配置项
 *   seekall config list                列出所有配置
 *   seekall whoami                     查看当前 license 信息
 *   seekall history                    查看搜索历史(待 M2)
 *   seekall init [project-name]        初始化新项目(保留)
 *
 * 配置优先级: env > ~/.seekall/config.json > 命令行参数
 */

import { Command } from 'commander'
import chalk from 'chalk'
import { createEngine } from './engine.js'
import type { Hit } from './types.js'
import {
  resolveConfig,
  getConfigValue,
  setConfigValue,
  listConfig,
  getConfigPath,
  type SeekallConfig,
} from './cli/config.js'
import {
  whoami as apiWhoami,
  syncRules,
  getHistory,
  redeemLicense,
  listMarketRules,
  getSyncConfig,
  saveSyncConfig,
} from './cli/api.js'
import { loadRules, listBuiltinRules } from './cli/rules-loader.js'
import { initProject } from './cli/init.js'

const program = new Command()

program
  .name('seekall')
  .description('SeekAll 规则引擎 SDK CLI')
  .version('0.5.0')

// ============ seekall search <keyword> ============
program
  .command('search')
  .description('搜索关键词(默认带 3 个 L0 规则: arxiv + crossref + pubmed)')
  .argument('<keyword>', '搜索关键词')
  .option('-r, --rule <npm-package...>', '指定规则包(覆盖默认规则)', [])
  .option('-o, --output <format>', '输出格式: text | json', 'text')
  .option('--limit <n>', '每个规则最多返回条数', '20')
  .action(async (keyword: string, opts: {
    rule: string[]
    output: 'text' | 'json'
    limit: string
  }) => {
    const config = resolveConfig({
      outputFormat: opts.output,
      defaultRules: opts.rule.length > 0 ? opts.rule : undefined,
    })

    const rulesToLoad =
      opts.rule.length > 0 ? opts.rule : config.defaultRules

    if (rulesToLoad.length === 0) {
      console.log(chalk.yellow('未配置规则。'))
      console.log(chalk.gray('  运行: seekall config set defaultRules @seekall/rule-arxiv'))
      console.log(chalk.gray('  查看可用规则: seekall rules list'))
      process.exit(0)
    }

    if (opts.output === 'json') {
      // JSON 模式: 不打印加载过程
    } else {
      console.log(chalk.cyan(`🔍 搜索 "${keyword}"`))
      console.log(chalk.gray(`   规则: ${rulesToLoad.join(', ')}`))
      console.log()
    }

    const { rules, failed } = await loadRules(rulesToLoad)

    if (failed.length > 0 && opts.output !== 'json') {
      for (const f of failed) {
        console.log(chalk.yellow(`  ⚠️  规则 ${f.name} 加载失败: ${f.error}`))
      }
      console.log()
    }

    if (rules.length === 0) {
      console.log(chalk.red('没有可用规则,退出'))
      process.exit(1)
    }

    const engine = createEngine({ rules })

    const hits: Hit[] = []
    if (opts.output === 'json') {
      const result = await engine.search(keyword)
      hits.push(...result)
    } else {
      const result = await engine.search(keyword, {
        onHit: (hit) => {
          console.log(chalk.green(`  [${hit.source}] ${hit.title}`))
          console.log(chalk.gray(`  ${hit.url}`))
          if (hit.snippet) {
            console.log(chalk.gray(`  ${hit.snippet.slice(0, 120)}...`))
          }
          console.log()
        },
      })
      hits.push(...result)
    }

    if (opts.output === 'json') {
      console.log(JSON.stringify(hits, null, 2))
    } else {
      console.log(chalk.cyan(`\n共 ${hits.length} 条结果`))
    }
  })

// ============ seekall license redeem <code> ============
const licenseCmd = program.command('license').description('License 管理')

licenseCmd
  .command('redeem')
  .description('激活 license code,换取 JWT')
  .argument('<code>', 'License code(SA-TRY-xxxx 或 SA-MON-xxxx 等)')
  .action(async (code: string) => {
    console.log(chalk.cyan('🔑 激活 license...'))
    try {
      const result = await redeemLicense(code)
      console.log(chalk.green('  ✅ 激活成功'))
      console.log(chalk.gray(`  用户: ${result.user.username} (id: ${result.user.id})`))
      console.log(chalk.gray(`  accessToken: ${result.accessToken.slice(0, 20)}...`))
      console.log()
      console.log(chalk.yellow('  下一步:'))
      console.log(chalk.gray('  将 license code 写入配置:'))
      console.log(chalk.gray(`    seekall config set license ${code}`))
    } catch (err) {
      console.log(chalk.red(`  ❌ 激活失败: ${err instanceof Error ? err.message : String(err)}`))
      process.exit(1)
    }
  })

// ============ seekall sync ============
program
  .command('sync')
  .description('从服务器同步订阅规则 + 云端配置')
  .option('--push', '推送本地配置到云端(默认拉取云端到本地)')
  .action(async (opts: { push?: boolean }) => {
    const config = resolveConfig()
    if (!config.license) {
      console.log(chalk.red('未配置 license。运行: seekall config set license <code>'))
      process.exit(1)
    }

    if (opts.push) {
      // 推送本地配置到云端
      console.log(chalk.cyan('📤 推送本地配置到云端...'))
      try {
        const result = await saveSyncConfig({
          defaultRules: config.defaultRules,
          outputFormat: config.outputFormat,
        })
        console.log(chalk.green(`  ✅ ${result.message}`))
        console.log(chalk.gray(`  更新时间: ${result.updatedAt}`))
      } catch (err) {
        console.log(chalk.red(`  ❌ 推送失败: ${err instanceof Error ? err.message : String(err)}`))
        process.exit(1)
      }
      return
    }

    // 拉取云端配置到本地
    console.log(chalk.cyan('🔄 同步订阅规则 + 云端配置...'))
    try {
      // 1. 拉订阅规则
      const rules = await syncRules()
      if (rules.length > 0) {
        console.log(chalk.green(`  ✅ 订阅了 ${rules.length} 个规则:`))
        for (const r of rules) {
          console.log(`    ${chalk.cyan(r.npmPackage)} ${chalk.gray(`L${r.riskLevel}`)} ${r.description}`)
        }
        const ruleNames = rules.map((r) => r.npmPackage)
        setConfigValue('defaultRules', ruleNames)
        console.log(chalk.gray('  已更新本地默认规则配置'))
      } else {
        console.log(chalk.yellow('  未订阅任何规则'))
      }

      // 2. 拉云端用户配置
      console.log()
      console.log(chalk.cyan('  拉取云端配置...'))
      const syncConfig = await getSyncConfig()
      if (syncConfig) {
        if (syncConfig.defaultRules.length > 0) {
          setConfigValue('defaultRules', syncConfig.defaultRules)
          console.log(chalk.green(`  ✅ 默认规则已同步(${syncConfig.defaultRules.length} 个)`))
        }
        if (syncConfig.outputFormat) {
          setConfigValue('outputFormat', syncConfig.outputFormat)
          console.log(chalk.green(`  ✅ 输出格式: ${syncConfig.outputFormat}`))
        }
        console.log(chalk.gray(`  云端更新时间: ${syncConfig.updatedAt}`))
      } else {
        console.log(chalk.yellow('  云端无配置(首次同步)'))
        console.log(chalk.gray('  运行 seekall sync --push 推送本地配置到云端'))
      }

      console.log()
      console.log(chalk.green('  ✅ 同步完成'))
    } catch (err) {
      console.log(chalk.red(`  ❌ 同步失败: ${err instanceof Error ? err.message : String(err)}`))
      process.exit(1)
    }
  })

// ============ seekall rules list ============
program
  .command('rules')
  .description('规则管理')
  .command('list')
  .description('列出可用规则(内置 + 市场)')
  .option('--market', '只看市场规则')
  .action(async (opts: { market?: boolean }) => {
    if (!opts.market) {
      console.log(chalk.cyan('📦 内置规则(已发布的 @seekall/rule-* 包):'))
      const builtins = listBuiltinRules()
      for (const name of builtins) {
        console.log(`  ${chalk.green(name)}`)
      }
      console.log()
    }

    console.log(chalk.cyan('🏪 市场规则(从服务器拉取):'))
    try {
      const marketRules = await listMarketRules()
      if (marketRules.length === 0) {
        console.log(chalk.gray('  (市场暂无规则)'))
      } else {
        for (const r of marketRules) {
          const riskBadge = `L${r.riskLevel}`
          console.log(`  ${chalk.green(r.npmPackage)} ${chalk.gray(riskBadge)} ${r.description}`)
        }
      }
    } catch (err) {
      console.log(chalk.yellow(`  ⚠️  拉取市场规则失败: ${err instanceof Error ? err.message : String(err)}`))
    }
  })

// ============ seekall config ============
const configCmd = program.command('config').description('配置管理')

configCmd
  .command('set')
  .description('设置配置项(写入 ~/.seekall/config.json)')
  .argument('<key>', '配置项: serverUrl | license | defaultRules | outputFormat')
  .argument('<value>', '配置值(defaultRules 用逗号分隔多个包名)')
  .action(async (key: keyof SeekallConfig, value: string) => {
    const validKeys: Array<keyof SeekallConfig> = [
      'serverUrl',
      'license',
      'defaultRules',
      'outputFormat',
    ]
    if (!validKeys.includes(key)) {
      console.log(chalk.red(`无效配置项: ${key}`))
      console.log(chalk.gray(`  可用: ${validKeys.join(', ')}`))
      process.exit(1)
    }

    let parsedValue: string | string[]
    if (key === 'defaultRules') {
      parsedValue = value.split(',').map((s) => s.trim()).filter(Boolean)
    } else {
      parsedValue = value
    }

    setConfigValue(key, parsedValue)
    console.log(chalk.green(`  ✅ ${key} = ${Array.isArray(parsedValue) ? parsedValue.join(', ') : parsedValue}`))
    console.log(chalk.gray(`  配置文件: ${getConfigPath()}`))
  })

configCmd
  .command('get')
  .description('获取配置项')
  .argument('<key>', '配置项名')
  .action(async (key: keyof SeekallConfig) => {
    const value = getConfigValue(key)
    if (value === undefined) {
      console.log(chalk.gray(`  ${key} = (未设置)`))
    } else {
      console.log(chalk.green(`  ${key} = ${Array.isArray(value) ? value.join(', ') : value}`))
    }
  })

configCmd
  .command('list')
  .description('列出所有配置')
  .action(async () => {
    const config = listConfig()
    console.log(chalk.cyan('当前配置:'))
    console.log(chalk.gray(`  配置文件: ${getConfigPath()}`))
    console.log()
    console.log(`  ${chalk.gray('serverUrl:')}     ${config.serverUrl}`)
    console.log(`  ${chalk.gray('license:')}        ${config.license ? config.license.slice(0, 20) + '...' : chalk.gray('(未设置)')}`)
    console.log(`  ${chalk.gray('defaultRules:')}  ${config.defaultRules.join(', ')}`)
    console.log(`  ${chalk.gray('outputFormat:')}  ${config.outputFormat}`)
  })

// ============ seekall whoami ============
program
  .command('whoami')
  .description('查看当前 license 信息')
  .action(async () => {
    const config = resolveConfig()
    if (!config.license) {
      console.log(chalk.red('未配置 license'))
      console.log(chalk.gray('  运行: seekall license redeem <code> 激活'))
      console.log(chalk.gray('  然后: seekall config set license <code>'))
      process.exit(1)
    }

    console.log(chalk.cyan('👤 当前 license 信息:'))
    console.log(chalk.gray(`  license code: ${config.license.slice(0, 20)}...`))
    console.log(chalk.gray(`  server: ${config.serverUrl}`))
    try {
      const info = await apiWhoami()
      console.log(`  ${chalk.gray('tier:')}      ${info.tier}`)
      console.log(`  ${chalk.gray('paid:')}      ${info.paid ? chalk.green('yes') : chalk.red('no')}`)
      if (info.username) {
        console.log(`  ${chalk.gray('username:')}  ${info.username}`)
      }
      if (info.expiresAt) {
        console.log(`  ${chalk.gray('expiresAt:')} ${info.expiresAt}`)
      }
    } catch (err) {
      console.log(chalk.yellow(`  ⚠️  无法连接服务器: ${err instanceof Error ? err.message : String(err)}`))
    }
  })

// ============ seekall history ============
program
  .command('history')
  .description('查看搜索历史(M2 阶段实现)')
  .action(async () => {
    console.log(chalk.yellow('⏳ history 命令待 M2 阶段实现'))
    console.log(chalk.gray('  后端 searchLog 表已砍,需先重建历史记录机制'))
    const history = await getHistory()
    if (history.length > 0) {
      for (const h of history) {
        console.log(`  ${chalk.gray(h.searchedAt)} ${h.query} (${h.hitsCount} hits)`)
      }
    }
  })

// ============ seekall init [project-name] ============
program
  .command('init')
  .description('初始化新的 SeekAll 项目(脚手架)')
  .argument('[project-name]', '项目名(默认 my-seekall-app)')
  .action(async (projectName?: string) => {
    await initProject(projectName)
  })

program.parse()
