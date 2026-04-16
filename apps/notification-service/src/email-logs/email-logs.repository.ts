import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailLog, EmailStatus } from '@prisma/notification-client';
import { QueryLogsDto } from './dto/query-logs.dto';

export interface CreateEmailLogData {
  templateId?: string | null;
  templateKey: string;
  toEmail: string;
  toName?: string | null;
  subject: string;
  htmlBody: string;
  variables?: Record<string, unknown> | null;
  status: EmailStatus;
  attempt: number;
  referenceType?: string | null;
  referenceId?: string | null;
}

export interface EmailStats {
  total: number;
  sent: number;
  failed: number;
  permanentlyFailed: number;
  pending: number;
  successRate: number;
  byTemplate: Array<{ templateKey: string; count: number; successRate: number }>;
}

@Injectable()
export class EmailLogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSent(
    templateKey: string,
    referenceType: string,
    referenceId: string,
  ): Promise<EmailLog | null> {
    return this.prisma.emailLog.findFirst({
      where: { templateKey, referenceType, referenceId, status: EmailStatus.SENT },
    });
  }

  async create(data: CreateEmailLogData): Promise<EmailLog> {
    return this.prisma.emailLog.create({
      data: {
        templateId: data.templateId,
        templateKey: data.templateKey,
        toEmail: data.toEmail,
        toName: data.toName,
        subject: data.subject,
        htmlBody: data.htmlBody,
        variables: (data.variables ?? undefined) as any,
        status: data.status,
        attempt: data.attempt,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
      },
    });
  }

  async findById(id: string): Promise<EmailLog | null> {
    return this.prisma.emailLog.findUnique({ where: { id } });
  }

  async markSent(id: string, attempt: number): Promise<void> {
    await this.prisma.emailLog.update({
      where: { id },
      data: { status: EmailStatus.SENT, attempt, sentAt: new Date(), failReason: null },
    });
  }

  async markFailed(id: string, attempt: number, reason: string): Promise<void> {
    await this.prisma.emailLog.update({
      where: { id },
      data: { status: EmailStatus.FAILED, attempt, failReason: reason },
    });
  }

  async markPermanentlyFailed(id: string, attempt: number, reason: string): Promise<void> {
    await this.prisma.emailLog.update({
      where: { id },
      data: { status: EmailStatus.PERMANENTLY_FAILED, attempt, failReason: reason },
    });
  }

  async resetForResend(id: string): Promise<void> {
    await this.prisma.emailLog.update({
      where: { id },
      data: { status: EmailStatus.PENDING, attempt: 0, failReason: null },
    });
  }

  async findWithPagination(
    query: QueryLogsDto,
  ): Promise<{ data: EmailLog[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.templateKey) where.templateKey = query.templateKey;
    if (query.toEmail) where.toEmail = query.toEmail;
    if (query.status) where.status = query.status;
    if (query.referenceType) where.referenceType = query.referenceType;
    if (query.referenceId) where.referenceId = query.referenceId;
    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) where.createdAt.gte = new Date(query.fromDate);
      if (query.toDate) where.createdAt.lte = new Date(query.toDate);
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.emailLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        select: {
          id: true,
          templateId: true,
          templateKey: true,
          toEmail: true,
          toName: true,
          subject: true,
          status: true,
          attempt: true,
          sentAt: true,
          failReason: true,
          referenceType: true,
          referenceId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.emailLog.count({ where }),
    ]);

    return { data: data as EmailLog[], total };
  }

  async getStats(fromDate: Date, toDate: Date): Promise<EmailStats> {
    const where = { createdAt: { gte: fromDate, lte: toDate } };

    const [total, byStatus, byTemplateRaw] = await Promise.all([
      this.prisma.emailLog.count({ where }),
      this.prisma.emailLog.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      this.prisma.emailLog.groupBy({
        by: ['templateKey', 'status'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 50,
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const row of byStatus) {
      statusMap[row.status] = row._count.id;
    }

    const sent = statusMap[EmailStatus.SENT] ?? 0;
    const failed = statusMap[EmailStatus.FAILED] ?? 0;
    const permanentlyFailed = statusMap[EmailStatus.PERMANENTLY_FAILED] ?? 0;
    const pending = statusMap[EmailStatus.PENDING] ?? 0;
    const successRate = total > 0 ? Math.round((sent / total) * 1000) / 10 : 0;

    // Aggregate by template
    const templateMap: Record<string, { total: number; sent: number }> = {};
    for (const row of byTemplateRaw) {
      if (!templateMap[row.templateKey]) {
        templateMap[row.templateKey] = { total: 0, sent: 0 };
      }
      templateMap[row.templateKey].total += row._count.id;
      if (row.status === EmailStatus.SENT) {
        templateMap[row.templateKey].sent += row._count.id;
      }
    }

    const byTemplate = Object.entries(templateMap)
      .map(([templateKey, { total: t, sent: s }]) => ({
        templateKey,
        count: t,
        successRate: t > 0 ? Math.round((s / t) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { total, sent, failed, permanentlyFailed, pending, successRate, byTemplate };
  }
}
