import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'
import * as nodemailer from 'nodemailer'

type MailProvider = 'resend' | 'qq'

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private readonly provider: MailProvider
  private readonly from: string
  private readonly resend?: Resend
  private readonly qqTransporter?: nodemailer.Transporter

  constructor(private readonly configService: ConfigService) {
    this.provider = this.configService.get<MailProvider>('MAIL_PROVIDER', 'resend')
    this.from = this.configService.get<string>('MAIL_FROM')!

    if (this.provider === 'resend') {
      const apiKey = this.configService.get<string>('RESEND_API_KEY')
      if (apiKey) {
        this.resend = new Resend(apiKey)
      } else {
        this.logger.warn('RESEND_API_KEY not configured')
      }
    } else if (this.provider === 'qq') {
      const user = this.configService.get<string>('QQ_MAIL_USER')
      const pass = this.configService.get<string>('QQ_MAIL_PASSWORD')
      if (user && pass) {
        this.qqTransporter = nodemailer.createTransport({
          host: 'smtp.qq.com',
          port: 465,
          secure: true,
          auth: { user, pass },
        })
      } else {
        this.logger.warn('QQ mail credentials not configured')
      }
    }
  }

  async sendEmailVerification(email: string, token: string, username: string): Promise<void> {
    const domain = this.configService.get<string>('APP_DOMAIN', 'localhost')
    const verifyUrl = `https://${domain}/auth/verify-email?token=${token}`
    const subject = '【觅源 SeekAll】邮箱验证'
    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>欢迎注册觅源 SeekAll</h2>
        <p>你好，${username}：</p>
        <p>请点击下方按钮完成邮箱验证（30 分钟内有效）：</p>
        <p><a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">验证邮箱</a></p>
        <p>或复制此链接到浏览器：${verifyUrl}</p>
        <p>如非本人操作，请忽略此邮件。</p>
        <hr>
        <p style="color: #6b7280; font-size: 12px;">觅源 SeekAll - 仅做链接聚合，不存储任何文件内容</p>
      </div>
    `
    await this.send(email, subject, html)
  }

  async sendSubscriptionNotification(
    email: string,
    username: string,
    keyword: string,
    totalResults: number,
    newCount: number,
    samples: Array<{ title: string; url: string }>,
  ): Promise<void> {
    const domain = this.configService.get<string>('APP_DOMAIN', 'localhost')
    const searchUrl = `https://${domain}/search?q=${encodeURIComponent(keyword)}`
    const subject = `【觅源 SeekAll】关键词 "${keyword}" 有新资源`
    const sampleHtml = samples
      .map(
        (s) =>
          `<li style="margin: 6px 0;"><a href="${s.url}" style="color: #4f46e5; text-decoration: none;" target="_blank">${s.title}</a></li>`,
      )
      .join('')
    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>关键词订阅更新</h2>
        <p>你好，${username}：</p>
        <p>你订阅的关键词 <strong>"${keyword}"</strong> 新增了 <strong>${newCount}</strong> 条结果（共 ${totalResults} 条）。</p>
        <ul style="padding-left: 20px; color: #374151;">${sampleHtml}</ul>
        <p><a href="${searchUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">查看全部结果</a></p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">如需取消订阅，请到觅源 SeekAll 个人中心 - 关键词订阅管理。</p>
        <hr>
        <p style="color: #6b7280; font-size: 12px;">觅源 SeekAll - 仅做链接聚合，不存储任何文件内容</p>
      </div>
    `
    await this.send(email, subject, html)
  }

  async sendPasswordReset(email: string, token: string, username: string): Promise<void> {
    const domain = this.configService.get<string>('APP_DOMAIN', 'localhost')
    const resetUrl = `https://${domain}/auth/reset-password?token=${token}`
    const subject = '【觅源 SeekAll】密码重置'
    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>密码重置请求</h2>
        <p>你好，${username}：</p>
        <p>我们收到了你的密码重置请求。请点击下方按钮重置密码（30 分钟内有效）：</p>
        <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">重置密码</a></p>
        <p>或复制此链接到浏览器：${resetUrl}</p>
        <p>如非本人操作，请忽略此邮件，你的密码不会被更改。</p>
        <hr>
        <p style="color: #6b7280; font-size: 12px;">觅源 SeekAll - 仅做链接聚合，不存储任何文件内容</p>
      </div>
    `
    await this.send(email, subject, html)
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    try {
      if (this.provider === 'resend' && this.resend) {
        const { error } = await this.resend.emails.send({
          from: this.from,
          to,
          subject,
          html,
        })
        if (error) {
          throw new Error(error.message)
        }
      } else if (this.provider === 'qq' && this.qqTransporter) {
        await this.qqTransporter.sendMail({
          from: this.from,
          to,
          subject,
          html,
        })
      } else {
        this.logger.warn(`Mail provider ${this.provider} not configured, skipping send to ${to}`)
        return
      }
      this.logger.log(`Mail sent to ${to}: ${subject}`)
    } catch (err) {
      this.logger.error(`Mail send failed: ${(err as Error).message}`)
      throw err
    }
  }
}
