import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

export class TemplateNotFoundException extends NotFoundException {
  constructor(key: string) {
    super({ code: 'TEMPLATE_NOT_FOUND', message: `Template "${key}" không tồn tại` });
  }
}

export class TemplateInactiveException extends BadRequestException {
  constructor(key: string) {
    super({ code: 'TEMPLATE_INACTIVE', message: `Template "${key}" đang bị tắt` });
  }
}

export class MissingTemplateVariablesException extends BadRequestException {
  constructor(missing: string[]) {
    super({
      code: 'MISSING_TEMPLATE_VARIABLES',
      message: `Thiếu biến bắt buộc: ${missing.join(', ')}`,
    });
  }
}

export class InvalidHandlebarsException extends BadRequestException {
  constructor(error: string) {
    super({ code: 'INVALID_HANDLEBARS', message: `Cú pháp Handlebars không hợp lệ: ${error}` });
  }
}

export class EmailLogNotFoundException extends NotFoundException {
  constructor(id: string) {
    super({ code: 'EMAIL_LOG_NOT_FOUND', message: `Email log "${id}" không tồn tại` });
  }
}

export class CannotResendException extends BadRequestException {
  constructor(reason: string) {
    super({ code: 'CANNOT_RESEND', message: reason });
  }
}

export class TemplateKeyExistsException extends ConflictException {
  constructor(key: string) {
    super({ code: 'TEMPLATE_KEY_EXISTS', message: `Template key "${key}" đã tồn tại` });
  }
}

export class SystemTemplateException extends ForbiddenException {
  constructor(key: string) {
    super({ code: 'SYSTEM_TEMPLATE', message: `Template "${key}" là system template, không thể xoá` });
  }
}
