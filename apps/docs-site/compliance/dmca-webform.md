# DMCA Takedown 举报表单

如果你是版权所有者或授权代表，认为 SeekAll 规则市场中的某条规则侵犯了你的版权，请通过以下方式举报：

## 方式 1：Webform（推荐）

填写下方表单提交，提交后将自动入库到 `dmca_notices` 表，admin 24 小时内人工响应（工作日 4 小时内首次回复）。

::: warning ⚠️ 必填法定声明
DMCA §512(c) 要求所有 Takedown Notice 必须包含**善意声明**和**准确性声明**。未勾选两项声明的提交将被拒绝。
:::

<form id="dmca-form" style="max-width: 640px;">
  <fieldset style="margin: 16px 0; padding: 12px; border: 1px solid #e5e7eb; border-radius: 6px;">
    <legend style="font-weight: 600; padding: 0 6px;">举报信息</legend>

    <label style="display: block; margin: 8px 0;">
      侵权 URL *<br />
      <input type="url" name="infringingUrl" required placeholder="https://seekall.winmelon.cn/rules/123" style="width:100%;padding:8px;margin:4px 0;border:1px solid #d1d5db;border-radius:4px;" />
    </label>

    <label style="display: block; margin: 8px 0;">
      关联规则 ID（可选）<br />
      <input type="number" name="ruleId" min="1" placeholder="123" style="width:120px;padding:8px;margin:4px 0;border:1px solid #d1d5db;border-radius:4px;" />
    </label>

    <label style="display: block; margin: 8px 0;">
      原作品标题 *<br />
      <input type="text" name="originalTitle" required maxlength="255" style="width:100%;padding:8px;margin:4px 0;border:1px solid #d1d5db;border-radius:4px;" />
    </label>

    <label style="display: block; margin: 8px 0;">
      版权所有者 *<br />
      <input type="text" name="copyrightOwner" required maxlength="255" style="width:100%;padding:8px;margin:4px 0;border:1px solid #d1d5db;border-radius:4px;" />
    </label>

    <label style="display: block; margin: 8px 0;">
      你的邮箱 *<br />
      <input type="email" name="reporterEmail" required style="width:100%;padding:8px;margin:4px 0;border:1px solid #d1d5db;border-radius:4px;" />
    </label>

    <label style="display: block; margin: 8px 0;">
      举报人身份 *<br />
      <select name="reporterRole" required style="width:200px;padding:8px;margin:4px 0;border:1px solid #d1d5db;border-radius:4px;">
        <option value="owner">版权所有者</option>
        <option value="agent">授权代表</option>
      </select>
    </label>

    <label style="display: block; margin: 8px 0;">
      电子签名（输入你的全名作为签名）*<br />
      <input type="text" name="electronicSignature" required maxlength="128" placeholder="Zhang San" style="width:100%;padding:8px;margin:4px 0;border:1px solid #d1d5db;border-radius:4px;" />
    </label>

    <label style="display: block; margin: 8px 0;">
      额外说明（可选）<br />
      <textarea name="notes" rows="5" placeholder="可附授权证明链接、原作品 URL 等" style="width:100%;padding:8px;margin:4px 0;border:1px solid #d1d5db;border-radius:4px;"></textarea>
    </label>
  </fieldset>

  <fieldset style="margin: 16px 0; padding: 12px; border: 1px solid #fbbf24; border-radius: 6px; background: #fffbeb;">
    <legend style="font-weight: 600; padding: 0 6px; color: #92400e;">法定声明（必勾）</legend>

    <label style="display: block; margin: 8px 0; line-height: 1.6;">
      <input type="checkbox" name="goodFaithStatement" value="true" required />
      <strong>善意声明</strong>：I have a good faith belief that use of the copyrighted materials described above as allegedly infringing is not authorized by the copyright owner, its agent, or the law.
    </label>

    <label style="display: block; margin: 8px 0; line-height: 1.6;">
      <input type="checkbox" name="accuracyStatement" value="true" required />
      <strong>准确性声明</strong>：I swear, under penalty of perjury, that the information in the notification is accurate and that I am the copyright owner or am authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.
    </label>
  </fieldset>

  <button type="submit" style="padding:10px 24px;background:#3aa675;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px;">
    提交 DMCA Takedown Notice
  </button>
  <span id="dmca-status" style="margin-left: 16px;"></span>
</form>

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  const form = document.getElementById('dmca-form')
  const status = document.getElementById('dmca-status')
  if (!form) return

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    status.textContent = '提交中...'
    status.style.color = '#6b7280'

    const payload = {
      infringingUrl: form.infringingUrl.value,
      ruleId: form.ruleId.value ? Number(form.ruleId.value) : undefined,
      originalTitle: form.originalTitle.value,
      copyrightOwner: form.copyrightOwner.value,
      reporterEmail: form.reporterEmail.value,
      reporterRole: form.reporterRole.value,
      goodFaithStatement: form.goodFaithStatement.checked,
      accuracyStatement: form.accuracyStatement.checked,
      electronicSignature: form.electronicSignature.value,
      notes: form.notes.value || undefined,
    }

    try {
      const res = await fetch('https://seekall.winmelon.cn/api/v1/dmca/notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok) {
        status.textContent = `✅ 提交成功，编号 #${data.data?.id || '?'}，我们将在 24 小时内首次回复`
        status.style.color = '#10b981'
        form.reset()
      } else {
        status.textContent = `❌ ${data.message || '提交失败'}`
        status.style.color = '#ef4444'
      }
    } catch (err) {
      status.textContent = `❌ 网络错误：${err.message}`
      status.style.color = '#ef4444'
    }
  })
})
</script>

## 方式 2：邮件

如果 webform 不可用，可直接发送邮件到 `1660069758@qq.com`，需包含上述 7 项必填信息 + 两项法定声明。

## 处理流程

```
webform 提交 -> 入库 dmca_notices -> 邮件通知 admin
                                          ↓
                                    admin 复核 -> verified / rejected
                                          ↓
                                    verified -> actioned（触发 Rule.takedown）
```

- **响应时间**：24h 内人工响应（工作日通常 4h 内首次回复）
- **误报申诉**：邮件主题前缀 `[COUNTER-NOTICE]`，7 个工作日内复审
- **速率限制**：每 IP 3 次/小时（防滥用）

## 透明度报告

每月 1 号发布上月 takedown 统计：

- 收到举报数
- 处理数（actioned）
- 拒绝数（rejected，误报）
- 平均响应时间

API 端点：`GET /api/v1/dmca/transparency`

## DMCA Agent

暂未注册美国版权局 DMCA Agent（接受风险期）。
用户量达到一定规模后，将注册官方 DMCA Agent。

## 模板下载

[dmca-notice-template.md](./dmca-notice-template)（或直接发邮件到 1660069758@qq.com 索取模板）
