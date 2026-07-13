# 觅源 SeekAll - DHT 磁力爬虫

> 独立服务，加入 BitTorrent DHT 网络自治收集种子元数据

## 工作原理

```
DHT 网络（Kademlia）
    ↓ get_peers / announce_peer
dht-crawler 服务（持续运行）
    ↓ 获取元数据 + 索引
Meilisearch (dht-resources 索引)
    ↓ 查询
DhtProvider → 用户搜索结果
```

## 配置

```bash
# .env
MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_MASTER_KEY=你的Key
DHT_PORT=6881              # DHT 监听端口（需公网可达）
DHT_BOOTSTRAP=router.bittorrent.com:6881
```

## 运行

```bash
cd apps/dht-crawler
pnpm install
pnpm dev
```

## 部署要求

- **公网 IP**：DHT 需要公网可达，本地 NAT 环境效果差
- **端口开放**：6881 UDP/TCP
- **磁盘空间**：索引数据量随收集增长，建议 20GB+
- **内存**：DHT 节点表占用约 200MB

## 注意事项

1. **资源消耗**：DHT 爬虫 7x24 运行，CPU/内存/带宽持续占用
2. **数据量**：全网 DHT 种子数亿级，需定期清理旧数据
3. **法律合规**：仅收集磁力链接元数据，不存储文件内容。遵循 Z++ 合规红线
4. **替代方案**：如果单机扛不住，建议用 Python [magnetico](https://github.com/boramalper/magnetico) 或 Go [bitmagnet](https://bitmagnet.io)

## 与 MagnetProvider 的区别

| 特性 | MagnetProvider | DhtProvider |
|------|---------------|-------------|
| 数据来源 | BT4G 第三方站 | 自爬 DHT 网络 |
| 依赖 | 外部服务可用性 | 自治 |
| 实时性 | 实时 | 有延迟（需爬虫积累） |
| 资源消耗 | 低 | 高 |
| 数据量 | 受限于源站 | 全网 |

两者可同时启用，结果会去重。
