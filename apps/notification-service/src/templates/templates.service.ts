import { Injectable, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import { MailerService } from '../mailer/mailer.service';
import { TemplatesRepository } from './templates.repository';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import {
  TemplateNotFoundException,
  TemplateKeyExistsException,
  SystemTemplateException,
  InvalidHandlebarsException,
} from '../common/exceptions';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    private readonly templateRepo: TemplatesRepository,
    private readonly mailerService: MailerService,
  ) {}

  async findAll() {
    const templates = await this.templateRepo.findAll();
    return templates.map(({ htmlBody, textBody, ...rest }) => rest);
  }

  async findOne(key: string) {
    const template = await this.templateRepo.findByKey(key);
    if (!template) throw new TemplateNotFoundException(key);
    return template;
  }

  async create(dto: CreateTemplateDto, adminId: string) {
    const existing = await this.templateRepo.findByKey(dto.key);
    if (existing) throw new TemplateKeyExistsException(dto.key);

    this.validateHandlebars(dto.htmlBody);
    if (dto.subject) this.validateHandlebars(dto.subject);

    return this.templateRepo.create({ ...dto, updatedBy: adminId });
  }

  async update(key: string, dto: UpdateTemplateDto, adminId: string) {
    const template = await this.templateRepo.findByKey(key);
    if (!template) throw new TemplateNotFoundException(key);

    if (dto.htmlBody) this.validateHandlebars(dto.htmlBody);
    if (dto.subject) this.validateHandlebars(dto.subject);

    return this.templateRepo.update(key, { ...dto, updatedBy: adminId });
  }

  async remove(key: string) {
    const template = await this.templateRepo.findByKey(key);
    if (!template) throw new TemplateNotFoundException(key);
    if (template.isSystem) throw new SystemTemplateException(key);

    await this.templateRepo.delete(key);
    return { message: 'Đã xoá template' };
  }

  async preview(key: string, variables: Record<string, unknown> = {}) {
    const template = await this.templateRepo.findByKey(key);
    if (!template) throw new TemplateNotFoundException(key);

    try {
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
    } catch (err) {
      throw new InvalidHandlebarsException((err as Error).message);
    }
  }

  private validateHandlebars(template: string): void {
    try {
      Handlebars.compile(template);
    } catch (err) {
      throw new InvalidHandlebarsException((err as Error).message);
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
