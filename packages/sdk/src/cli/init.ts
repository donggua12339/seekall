/**
 * seekall init - 项目脚手架
 *
 * 从原 cli.ts 抽出,保持主 CLI 入口简洁
 */

import { createInterface } from 'readline'
import { mkdir, writeFile, access } from 'fs/promises'
import { join, resolve } from 'path'
import { existsSync } from 'fs'
import { constants } from 'fs'
import chalk from 'chalk'

const rl = createInterface({ input: process.stdin, output: process.stdout })

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve))
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

async function writeIfNotExists(path: string, content: string): Promise<'created' | 'skipped'> {
  if (await fileExists(path)) {
    console.log(chalk.gray(`  ⏭️  已存在,跳过: ${path}`))
    return 'skipped'
  }
  await writeFile(path, content, 'utf-8')
  console.log(chalk.green(`  ✅ 创建: ${path}`))
  return 'created'
}

const TEMPLATES = {
  'package.json': (name: string) => `{
  "name": "${name}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch seekall.config.ts",
    "start": "tsx seekall.config.ts",
    "build": "tsc"
  },
  "dependencies": {
    "@seekall/sdk": "^0.5.0",
    "@seekall/rule-arxiv": "^0.5.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  }
}
`,

  'tsconfig.json': () => `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["*.ts", "rules/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
`,

  'seekall.config.ts': () => `import { createEngine } from '@seekall/sdk'
import arxiv from '@seekall/rule-arxiv'

// 自定义规则示例:把下面这段注释打开,编辑 rules/my-rule.ts
// import myRule from './rules/my-rule.js'

const engine = createEngine({
  rules: [
    arxiv,
    // myRule,
  ],
  // 全局超时(毫秒),默认 8000
  timeoutMs: 8000,
})

// 示例:搜索 transformer 论文
const main = async () => {
  const hits = await engine.search('transformer', {
    onHit: (hit) => {
      console.log(\`[\${hit.source}] \${hit.title}\`)
      console.log(\`  \${hit.url}\`)
      if (hit.snippet) console.log(\`  \${hit.snippet.slice(0, 120)}...\`)
    },
  })
  console.log(\`\\n共 \${hits.length} 条结果\`)
}

main().catch(console.error)
`,

  'rules/.gitkeep': () => `# 把你的自定义规则放在这个目录
# 每个规则是一个 .ts 文件,default export 一个 Rule 对象
# 详见 https://seekall.winmelon.cn/sdk/rule-interface
`,

  'README.md': (name: string) => `# ${name}

基于 SeekAll SDK 的搜索规则项目。

## 快速开始

\`\`\`bash
# 安装依赖
npm install

# 开发模式(文件改动自动重启)
npm run dev

# 生产模式
npm run start
\`\`\`

## 写自定义规则

在 \`rules/\` 目录新建 \`my-rule.ts\`:

\`\`\`typescript
import type { Rule, Hit, RuleContext } from '@seekall/sdk'

const myRule: Rule = {
  name: 'my-rule',
  version: '1.0.0',
  riskLevel: 1,  // L0-L4
  description: '我的自定义规则',

  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    ctx.logger.info(\`searching: \${query}\`)
    // 调用你的数据源,返回 Hit[]
    return []
  },
}

export default myRule
\`\`\`

在 \`seekall.config.ts\` 中导入并加入 rules 数组。

## 风险评级

| 级别 | 含义 | 示例 |
|---|---|---|
| L0 | 公开学术 | arxiv / crossref / pubmed |
| L1 | 通用开源 | GitHub API |
| L2 | 社区评审 | 需付费会员评审 |
| L3 | 高风险 | admin 创建,仅 admin 可见 |
| L4 | 极高风险 | admin 创建,仅 admin 可见 |

## 文档

- SDK 文档: https://seekall.winmelon.cn/sdk/
- 写规则: https://seekall.winmelon.cn/sdk/rule-interface
- GitHub: https://github.com/donggua12339/seekall
`,

  '.gitignore': () => `node_modules/
dist/
.env
*.log
.DS_Store
`,
}

export async function initProject(projectName?: string): Promise<void> {
  console.log(chalk.cyan('🚀 SeekAll SDK 项目初始化\n'))

  if (!projectName) {
    projectName = await question('项目名 (my-seekall-app): ')
    if (!projectName.trim()) projectName = 'my-seekall-app'
  }

  const targetDir = projectName === '.' ? process.cwd() : resolve(process.cwd(), projectName)
  console.log(chalk.gray(`\n📁 目标目录: ${targetDir}\n`))

  if (projectName !== '.' && existsSync(targetDir)) {
    const answer = await question('目录已存在,继续?(y/N): ')
    if (answer.toLowerCase() !== 'y') {
      console.log('已取消')
      rl.close()
      process.exit(0)
    }
  }

  await ensureDir(targetDir)
  await ensureDir(join(targetDir, 'rules'))

  console.log('')
  await writeIfNotExists(join(targetDir, 'package.json'), TEMPLATES['package.json'](projectName))
  await writeIfNotExists(join(targetDir, 'tsconfig.json'), TEMPLATES['tsconfig.json']())
  await writeIfNotExists(join(targetDir, 'seekall.config.ts'), TEMPLATES['seekall.config.ts']())
  await writeIfNotExists(join(targetDir, 'rules', '.gitkeep'), TEMPLATES['rules/.gitkeep']())
  await writeIfNotExists(join(targetDir, 'README.md'), TEMPLATES['README.md'](projectName))
  await writeIfNotExists(join(targetDir, '.gitignore'), TEMPLATES['.gitignore']())

  console.log(chalk.green('\n✨ 初始化完成!\n'))
  console.log('下一步:')
  if (projectName !== '.') {
    console.log(chalk.gray(`  cd ${projectName}`))
  }
  console.log(chalk.gray('  npm install'))
  console.log(chalk.gray('  npm run dev\n'))

  rl.close()
}
