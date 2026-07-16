/**
 * 觅源 SeekAll - Prisma Seed 脚本
 * 运行：pnpm --filter api prisma:seed
 *
 * 用于初始化：用户协议、默认数据等
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1. 创建初始用户协议
  const existingAgreement = await prisma.agreement.findUnique({
    where: { version: '1.0.0' },
  })
  if (!existingAgreement) {
    await prisma.agreement.create({
      data: {
        version: '1.0.0',
        effectiveDate: new Date(),
        content: `# 觅源 SeekAll 用户协议

## 1. 服务说明
觅源 SeekAll（以下简称"本站"）是一个全网资源链接聚合搜索工具，仅提供资源链接的索引服务，不存储任何文件内容。

## 2. 使用承诺
用户承诺：
- 仅将本站用于个人学习研究目的
- 不将本站用于任何商业用途
- 不通过本站获取或传播侵权内容
- 遵守所在地区法律法规

## 3. 知识产权
- 本站不存储任何文件内容，仅提供链接聚合
- 资源链接来自公开渠道，本站不对资源内容负责
- 如发现侵权内容，请通过"侵权举报"页面提交 takedown 请求

## 4. 账号管理
- 用户通过邀请码注册账号
- 用户应妥善保管账号密码
- 本站保留封禁违规账号的权利

## 5. 免责声明
- 本站不对搜索结果的合法性、准确性负责
- 用户使用本站产生的任何后果由用户自行承担
- 本站不对任何间接损失负责

## 6. 服务变更
- 本站保留随时修改、暂停、终止服务的权利
- 协议变更将在站内公告，继续使用即视为同意

## 7. 法律适用
- 本协议受香港法律管辖
- 争议提交香港法院裁决

版本：1.0.0
生效日期：${new Date().toISOString().split('T')[0]}
`,
      },
    })
    console.log('Initial agreement created: v1.0.0')
  }

  // 2. 初始化关键词黑名单（NSFW / 违规 / 侵权高发词）
  const blockedKeywords = [
    '色情', '成人', 'av 下载', '裸聊', '换脸', '偷拍',
    '破解版', '盗版', '激活码', '注册机', '去水印',
    '赌博', '菠菜', '彩票预测',
    '暴力', '恐怖主义', '毒品',
  ]
  for (const kw of blockedKeywords) {
    const exists = await prisma.blockedKeyword.findUnique({ where: { keyword: kw } })
    if (!exists) {
      await prisma.blockedKeyword.create({
        data: {
          keyword: kw,
          reason: 'seed-initial',
        },
      })
    }
  }
  console.log(`Blocked keywords ensured: ${blockedKeywords.length}`)

  console.log('Seed completed')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
