import { Injectable } from '@nestjs/common';
import { EmailLogsRepository } from './email-logs.repository';
import { QueryLogsDto } from './dto/query-logs.dto';
import { EmailLogNotFoundException } from '../common/exceptions';

@Injectable()
export class EmailLogsService {
  constructor(private readonly logRepo: EmailLogsRepository) {}

  async findAll(query: QueryLogsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { data, total } = await this.logRepo.findWithPagination(query);
    return {
      success: true,
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const log = await this.logRepo.findById(id);
    if (!log) throw new EmailLogNotFoundException(id);
    return log;
  }

  async getStats(fromDate?: string, toDate?: string) {
    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();
    return this.logRepo.getStats(from, to);
  }
}
