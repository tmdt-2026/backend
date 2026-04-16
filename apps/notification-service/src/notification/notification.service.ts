import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailStatus } from '@prisma/notification-client';
import { MailerService } from '../mailer/mailer.service';
import { TemplatesRepository } from '../templates/templates.repository';
import { EmailLogsRepository } from '../email-logs/email-logs.repository';
import { SendEmailDto } from './dto/send-email.dto';
import { BroadcastDto } from './dto/broadcast.dto';
import { sleep } from '../common/utils/sleep.util';
import {
  TemplateNotFoundException,
  TemplateInactiveException,
  MissingTemplateVariablesException,
  EmailLogNotFoundException,
  CannotResendException,
} from '../common/exceptions';

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly templateRepo: TemplatesRepository,
    private readonly logRepo: EmailLogsRepository,
    private readonly config: ConfigService,
  ) {}

  async sendEmail(dto: SendEmailDto) {
    // STEP 1: Idempotency check
    if (dto.referenceType && dto.referenceId) {
      const existing = await this.logRepo.findSent(
        dto.templateKey,
        dto.referenceType,
        dto.referenceId,
      );
      if (existing) {
        this.logger.log(
          `Skip duplicate: ${dto.templateKey} for ${dto.referenceType}:${dto.referenceId}`,
        );
        return existing;
      }
    }

    // STEP 2: Render email
    const rendered = await this.renderEmail(dto.templateKey, dto.variables ?? {});

    // STEP 3: Find templateId
    const template = await this.templateRepo.findByKey(dto.templateKey);

    // STEP 4: Create log PENDING
    const log = await this.logRepo.create({
      templateId: template?.id ?? null,
      templateKey: dto.templateKey,
      toEmail: dto.toEmail,
      toName: dto.toName ?? null,
      subject: rendered.subject,
      htmlBody: rendered.html,
      variables: dto.variables ?? null,
      referenceType: dto.referenceType ?? null,
      referenceId: dto.referenceId ?? null,
      status: EmailStatus.PENDING,
      attempt: 0,
    });

    // STEP 5: Send with retry (non-blocking in background)
    this.sendWithRetry(log.id, rendered, dto.toEmail, dto.toName).catch((err) => {
      this.logger.error(`Background send failed for log ${log.id}: ${err.message}`);
    });

    return log;
  }

  async broadcast(dto: BroadcastDto, adminId: string) {
    const templateKey = dto.templateKey ?? 'admin_broadcast';
    const results = await Promise.allSettled(
      dto.recipients.map((recipient) =>
        this.sendEmail({
          templateKey,
          toEmail: recipient.email,
          toName: recipient.name,
          variables: { ...dto.variables, userName: recipient.name ?? recipient.email },
          referenceType: 'manual',
          referenceId: `broadcast-${adminId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return { total: dto.recipients.length, succeeded, failed };
  }

  async resendFailed(logId: string): Promise<void> {
    const log = await this.logRepo.findById(logId);
    if (!log) throw new EmailLogNotFoundException(logId);
    if (log.status !== EmailStatus.PERMANENTLY_FAILED) {
      throw new CannotResendException('Chỉ resend được email PERMANENTLY_FAILED');
    }

    await this.logRepo.resetForResend(logId);
    const rendered: RenderedEmail = {
      subject: log.subject,
      html: log.htmlBody,
      text: this.htmlToText(log.htmlBody),
    };
    this.sendWithRetry(logId, rendered, log.toEmail, log.toName ?? undefined).catch((err) => {
      this.logger.error(`Resend failed for log ${logId}: ${err.message}`);
    });
  }

  async renderEmail(
    templateKey: string,
    variables: Record<string, unknown>,
  ): Promise<RenderedEmail> {
    const template = await this.templateRepo.findByKey(templateKey);
    if (!template) throw new TemplateNotFoundException(templateKey);
    if (!template.isActive) throw new TemplateInactiveException(templateKey);

    // Validate required variables
    const requiredVars = template.variables as string[];
    const missingVars = requiredVars.filter((v) => !(v in variables));
    if (missingVars.length > 0) {
      throw new MissingTemplateVariablesException(missingVars);
    }

    const subjectFn = this.mailerService.compileTemplate(template.subject);
    const bodyFn = this.mailerService.compileTemplate(template.htmlBody);

    const renderedSubject = subjectFn(variables);
    const renderedBody = bodyFn(variables);
    const renderedHtml = this.mailerService.renderWithLayout(renderedSubject, renderedBody);

    return {
      subject: renderedSubject,
      html: renderedHtml,
      text: this.htmlToText(renderedHtml),
    };
  }

  private async sendWithRetry(
    logId: string,
    rendered: RenderedEmail,
    toEmail: string,
    toName?: string,
  ): Promise<void> {
    const maxAttempts = this.config.get<number>('mail.maxAttempts') ?? 3;
    const delay1 = this.config.get<number>('mail.retryDelay1') ?? 30_000;
    const delay2 = this.config.get<number>('mail.retryDelay2') ?? 120_000;
    const delays = [0, delay1, delay2];

    const fromName = this.config.get<string>('mail.fromName') ?? 'iLuxury';
    const fromEmail = this.config.get<string>('mail.from') ?? 'no-reply@iluxury.vn';
    const to = toName ? `"${toName}" <${toEmail}>` : toEmail;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (delays[attempt - 1] > 0) {
        await sleep(delays[attempt - 1]);
      }

      try {
        await this.mailerService.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });

        await this.logRepo.markSent(logId, attempt);
        this.logger.log(`Email sent (attempt ${attempt}) for log ${logId}`);
        return;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Email attempt ${attempt} failed for log ${logId}: ${errMsg}`);

        if (attempt === maxAttempts) {
          await this.logRepo.markPermanentlyFailed(logId, attempt, errMsg);
          this.logger.error(`Email permanently failed: ${logId}`);
        } else {
          await this.logRepo.markFailed(logId, attempt, errMsg);
        }
      }
    }
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
