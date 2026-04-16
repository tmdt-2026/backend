import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface SendMailOptions {
  from?: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

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

    const layoutPath = join(__dirname, 'base-layout.hbs');
    try {
      const layoutHtml = readFileSync(layoutPath, 'utf-8');
      this.baseLayoutFn = Handlebars.compile(layoutHtml);
      this.logger.log('Base email layout loaded');
    } catch (err) {
      this.logger.error(`Failed to load base layout from ${layoutPath}: ${(err as Error).message}`);
      // Fallback minimal layout
      this.baseLayoutFn = Handlebars.compile(
        '<!DOCTYPE html><html><body>{{{body}}}</body></html>'
      );
    }
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
