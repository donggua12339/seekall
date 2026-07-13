# 自定义 Provider 插件开发指南

SeekAll 的 Provider 架构支持热插拔，你可以开发自定义 Provider 接入任何数据源。

## Provider 接口

```typescript
// apps/api/src/modules/provider/interfaces/provider.interface.ts

export interface Provider {
  /** Provider 唯一标识（如 'pansou'、'magnet'） */
  readonly name: string
  /** 显示名称（如 'PanSou 聚合'） */
  readonly displayName: string
  /** 分类：netdisk | magnet | tg | forum */
  readonly category: 'netdisk' | 'magnet' | 'tg' | 'forum'
  /** 是否启用（可根据配置决定） */
  readonly enabled: boolean

  /** 搜索资源 */
  search(query: SearchQuery): Promise<SearchResult[]>

  /** 健康检查 */
  healthCheck(): Promise<boolean>
}

export interface SearchQuery {
  keyword: string
  page: number
  pageSize: number
  category?: string
  filters?: Record<string, unknown>
}

export interface SearchResult {
  title: string
  url: string
  source: string           // Provider name
  sourceDisplayName: string
  category: string
  fileSize?: number
  fileType?: string        // 如 "夸克网盘"、"磁力"
  resourceMeta?: {
    cloudType?: string
    password?: string | null
    datetime?: string | null
    originSource?: string | null
    magnetHash?: string | null
  }
}
```

## 开发步骤

### 1. 创建 Provider 文件

```
apps/api/src/modules/provider/providers/your-source/your-source.provider.ts
```

### 2. 实现 Provider 接口

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Provider, SearchQuery, SearchResult } from '../../interfaces/provider.interface'

@Injectable()
export class YourSourceProvider implements Provider {
  private readonly logger = new Logger(YourSourceProvider.name)
  readonly name = 'your-source'
  readonly displayName = '你的数据源'
  readonly category = 'netdisk' as const

  private readonly apiUrl: string
  private readonly timeout: number

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('YOUR_SOURCE_API_URL', '')
    this.timeout = this.configService.get<number>('YOUR_SOURCE_TIMEOUT', 10000)
  }

  get enabled(): boolean {
    return !!this.apiUrl
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.enabled) return []

    try {
      const url = new URL('/search', this.apiUrl)
      url.searchParams.set('q', query.keyword)

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      return this.transform(data)
    } catch (err) {
      this.logger.debug(`${this.name} search failed: ${(err as Error).message}`)
      return [] // 失败返回空，不影响其他 Provider
    }
  }

  private transform(data: unknown): SearchResult[] {
    // 把外部 API 响应转换为统一的 SearchResult 格式
    // ...
    return []
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(this.apiUrl, { signal: AbortSignal.timeout(5000) })
      return res.ok
    } catch {
      return false
    }
  }
}
```

### 3. 注册到 ProviderModule

```typescript
// apps/api/src/modules/provider/provider.module.ts

import { YourSourceProvider } from './providers/your-source/your-source.provider'

@Module({
  providers: [
    // ... 其他 Provider
    YourSourceProvider,
    {
      provide: 'PROVIDERS',
      useFactory: (
        // ... 其他 Provider
        yourSource: YourSourceProvider,
      ): Provider[] => [..., yourSource],
      inject: [..., YourSourceProvider],
    },
  ],
})
export class ProviderModule {}
```

### 4. 添加环境变量

```bash
# .env
YOUR_SOURCE_API_URL=https://api.your-source.com
YOUR_SOURCE_TIMEOUT=10000
```

### 5. 添加单元测试

```
apps/api/src/modules/provider/providers/your-source/your-source.provider.spec.ts
```

## 开发规范

### 必须处理
- **超时**：用 AbortController，默认 10s
- **错误降级**：失败返回空数组，不抛异常
- **日志**：用 Logger 记录调试信息和警告
- **统一格式**：输出必须符合 SearchResult 接口

### 不允许
- 直接抛错到主流程（会被 ProviderService 捕获，但最好自己处理）
- 修改全局状态
- 依赖其他 Provider

### 最佳实践
- **多 URL 故障转移**：参考 PansouProvider
- **重试机制**：失败后延迟重试（参考 PansouProvider）
- **健康检查**：实现 healthCheck，供后台监控
- **Cloudflare 拦截检测**：检查 content-type 是否为 JSON

## 现有 Provider 参考

| Provider | 文件 | 特点 |
|----------|------|------|
| PansouProvider | `pansou/pansou.provider.ts` | 多 URL 故障转移 + 重试 |
| MagnetProvider | `magnet/magnet.provider.ts` | RSS XML 解析（BT4G） |
| QuarkProvider | `quark/quark.provider.ts` | PanSou 插件特化调用 |
| TgChannelProvider | `tg-channel/tg-channel.provider.ts` | TG 频道搜索 |
| TgDirectProvider | `tg-direct/tg-direct.provider.ts` | 本地索引搜索 |
| ForumProvider | `forum/forum.provider.ts` | 通用论坛爬虫（可配置正则） |

## 提交 Provider

1. Fork 仓库
2. 创建 `feature/provider-your-source` 分支
3. 实现 Provider + 测试
4. 提交 PR（参考 [CONTRIBUTING.md](../../CONTRIBUTING.md)）

优秀的 Provider 会被合并到主仓库。
