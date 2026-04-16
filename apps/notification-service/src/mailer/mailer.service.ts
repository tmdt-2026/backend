import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';

export interface SendMailOptions {
  from?: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const BASE_LAYOUT_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
  <style>
    body { margin:0; padding:0; background:#f5f5f5; font-family:'Helvetica Neue',Arial,sans-serif; }
    .wrapper { max-width:600px; margin:0 auto; background:#ffffff; }
    .header  { background:#050505; padding:24px 32px; text-align:center; }
    .logo    { color:#fca311; font-size:24px; font-weight:900; letter-spacing:-0.5px; }
    .logo span{ color:#ffffff; }
    .content { padding:32px; color:#333333; }
    .footer  { background:#f5f5f5; padding:24px 32px; text-align:center; font-size:12px; color:#999999; border-top:1px solid #e5e5e5; }
    .btn     { display:inline-block; background:#fca311; color:#050505; padding:12px 28px; border-radius:8px; font-weight:700; font-size:15px; text-decoration:none; }
    .divider { border:none; border-top:1px solid #e5e5e5; margin:24px 0; }
    .highlight-box { background:#f9f9f9; border-left:4px solid #fca311; padding:16px 20px; border-radius:4px; margin:16px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">i<span>Luxury</span></div>
      <div style="color:#a0a0a0;font-size:12px;margin-top:4px">Apple Premium Reseller</div>
    </div>
    <div class="content">
      {{{body}}}
    </div>
    <div class="footer">
      <p>&copy; 2026 iLuxury. Đã đăng ký bản quyền.</p>
      <p>123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh &middot; Hotline: 1800 1234</p>
      <p style="margin-top:8px">
        Email này được gửi tự động. Vui lòng không reply trực tiếp.<br>
        Nếu cần hỗ trợ, liên hệ <a href="mailto:contact@iluxury.vn" style="color:#fca311">contact@iluxury.vn</a>
      </p>
    </div>
  </div>
</body>
</html>`;

@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter;
  private baseLayoutFn: Handlebars.TemplateDelegate;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('mail.host'),
      port: this.config.get<number>('mail.port'),
      secure: this.config.get<boolean>('mail.secure'),
      auth: {
        user: this.config.get<string>('mail.user'),
        pass: this.config.get<string>('mail.pass'),
      },
      pool: true,
      maxConnections: this.config.get<number>('mail.poolMaxConnections') ?? 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: this.config.get<number>('mail.rateLimit') ?? 10,
    } as any);

    this.baseLayoutFn = Handlebars.compile(BASE_LAYOUT_HTML);
    this.logger.log('Base email layout compiled');
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const fromName = this.config.get<string>('mail.fromName') ?? 'iLuxury';
    const fromEmail = this.config.get<string>('mail.from') ?? 'no-reply@iluxury.vn';

    await this.transporter.sendMail({
      from: options.from ?? `"${fromName}" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
  }

  renderWithLayout(subject: string, body: string): string {
    return this.baseLayoutFn({ subject, body });
  }

  compileTemplate(template: string): Handlebars.TemplateDelegate {
    return Handlebars.compile(template);
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
