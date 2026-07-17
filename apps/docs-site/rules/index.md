# 规则市场

规则市场是 SeekAll 服务端的核心模块。

## 市场做什么

- 索引 npm 包元数据（不托管代码）
- 展示规则列表 + 风险评级 + 作者
- 提供评审工作流
- 用户订阅规则（同步到 SDK 配置）

## 市场不做什么

- 不托管规则代码（代码在 npm 上）
- 不替用户跑规则（规则在用户机器跑）
- 不向 L3/L4 规则的资源站发 outbound 请求

## 列表页

```
规则市场
├── 风险级别筛选：[L0] [L1] [L2] [L3 admin] [L4 admin]
├── 搜索框
└── 规则列表
    ├── @seekall/rule-arxiv (L0) by @donggua
    ├── @seekall/rule-crossref (L0) by @donggua
    └── @someone/my-rule (L1) by @someone [审核中]
```

## 订阅

登录用户可以"订阅"规则（同步到自己的规则列表）。
SDK 启动时拉取订阅列表，自动加载。

## 提交规则

1. 写一个 npm 包，实现 Rule 接口
2. 发布到 npmjs.com
3. 在市场页提交：填包名 + 风险级别 + 描述
4. 等待审核（L0/L1 admin 抽查，L2 社群评审）
