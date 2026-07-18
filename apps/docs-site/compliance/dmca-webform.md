# DMCA Takedown 举报表单

如果你是版权所有者或授权代表，认为 SeekAll 规则市场中的某条规则侵犯了你的版权，请通过以下方式举报：

## 方式 1：邮件（推荐）

发送邮件到 `1660069758@qq.com`，需包含：

1. **侵权 URL** - 规则市场中的规则详情页 URL
2. **原作品信息** - 作品标题 + 版权所有者
3. **举报人身份证明** - 版权所有者本人 或 授权代表（需附授权证明）
4. **联系方式** - 邮箱 + 电话（可选）
5. **善意声明** - "I have a good faith belief that use of the copyrighted materials described above as allegedly infringing is not authorized by the copyright owner, its agent, or the law."
6. **准确性声明** - "I swear, under penalty of perjury, that the information in the notification is accurate and that I am the copyright owner or am authorized to act on behalf of the owner of an exclusive right that is allegedly infringed."
7. **签名** - 电子签名即可（ typed name ）

## 方式 2：Webform（计划中）

::: info TODO
Webform 当前为静态页，提交后不写数据库，仅引导用户发送邮件。
M3 阶段计划接入后端 API（`POST /api/v1/dmca/notice`）自动入库到 `takedown_records` 表。
:::

<form action="mailto:1660069758@qq.com" method="post" enctype="text/plain">
  <label>
    侵权 URL *<br />
    <input type="url" name="infringing_url" required style="width:100%;padding:8px;margin:8px 0;" />
  </label>
  <br />
  <label>
    原作品标题 *<br />
    <input type="text" name="original_title" required style="width:100%;padding:8px;margin:8px 0;" />
  </label>
  <br />
  <label>
    版权所有者 *<br />
    <input type="text" name="copyright_owner" required style="width:100%;padding:8px;margin:8px 0;" />
  </label>
  <br />
  <label>
    你的邮箱 *<br />
    <input type="email" name="email" required style="width:100%;padding:8px;margin:8px 0;" />
  </label>
  <br />
  <label>
    举报人身份 *<br />
    <select name="role" style="width:100%;padding:8px;margin:8px 0;">
      <option value="owner">版权所有者</option>
      <option value="agent">授权代表</option>
    </select>
  </label>
  <br />
  <label>
    额外说明<br />
    <textarea name="notes" rows="5" style="width:100%;padding:8px;margin:8px 0;"></textarea>
  </label>
  <br />
  <button type="submit" style="padding:10px 20px;background:#3aa675;color:#fff;border:none;border-radius:4px;cursor:pointer;">
    发送举报邮件
  </button>
</form>

## 处理流程

```
收到邮件 -> admin 审核 -> 关键词过滤验证 -> takedown 表记录
                                                       ↓
                                             URL 加入 blocklist
                                                       ↓
                                             触发 Provider 过滤
```

- **响应时间**：24h 内人工响应（工作日通常 4h 内首次回复）
- **误报申诉**：邮件主题前缀 `[COUNTER-NOTICE]`，7 个工作日内复审

## 透明度报告

每月 1 号发布上月 takedown 统计：
- 收到举报数
- 处理数
- 平均响应时间
- 拒绝数（误报）

详见 [admin API `/admin/transparency`](/compliance/takedown)。

## DMCA Agent

暂未注册美国版权局 DMCA Agent（接受风险期）。
用户量达到一定规模后，将注册官方 DMCA Agent。

## 模板下载

[dmca-notice-template.md](https://github.com/donggua12339/seekall/blob/main/docs/dmca-notice-template.md)
