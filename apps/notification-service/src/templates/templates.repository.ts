import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailTemplate } from '@prisma/notification-client';

@Injectable()
export class TemplatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<EmailTemplate[]> {
    return this.prisma.emailTemplate.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByKey(key: string): Promise<EmailTemplate | null> {
    return this.prisma.emailTemplate.findUnique({ where: { key } });
  }

  async findById(id: string): Promise<EmailTemplate | null> {
    return this.prisma.emailTemplate.findUnique({ where: { id } });
  }

  async create(data: {
    key: string;
    name: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
    variables: string[];
    description?: string;
    isActive?: boolean;
    updatedBy?: string;
  }): Promise<EmailTemplate> {
    return this.prisma.emailTemplate.create({
      data: {
        key: data.key,
        name: data.name,
        subject: data.subject,
        htmlBody: data.htmlBody,
        textBody: data.textBody,
        variables: data.variables,
        description: data.description,
        isActive: data.isActive ?? true,
        isSystem: false,
        updatedBy: data.updatedBy,
      },
    });
  }

  async update(
    key: string,
    data: Partial<{
      name: string;
      subject: string;
      htmlBody: string;
      textBody: string | null;
      variables: string[];
      description: string;
      isActive: boolean;
      updatedBy: string;
    }>,
  ): Promise<EmailTemplate> {
    return this.prisma.emailTemplate.update({
      where: { key },
      data,
    });
  }

  async delete(key: string): Promise<void> {
    await this.prisma.emailTemplate.delete({ where: { key } });
  }
}
