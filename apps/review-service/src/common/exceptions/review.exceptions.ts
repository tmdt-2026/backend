import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
  ServiceUnavailableException,
} from '@nestjs/common';

// ── Review exceptions ─────────────────────────────────────────

export class OrderNotFoundException extends NotFoundException {
  constructor() {
    super({ code: 'ORDER_NOT_FOUND', message: 'Đơn hàng không tồn tại' });
  }
}

export class NotOrderOwnerException extends ForbiddenException {
  constructor() {
    super({ code: 'NOT_ORDER_OWNER', message: 'Bạn không phải chủ đơn hàng này' });
  }
}

export class OrderNotCompletedException extends UnprocessableEntityException {
  constructor() {
    super({ code: 'ORDER_NOT_COMPLETED', message: 'Chỉ có thể đánh giá sau khi đơn hàng hoàn thành' });
  }
}

export class ProductNotInOrderException extends UnprocessableEntityException {
  constructor() {
    super({ code: 'PRODUCT_NOT_IN_ORDER', message: 'Sản phẩm này không có trong đơn hàng' });
  }
}

export class AlreadyReviewedException extends ConflictException {
  constructor() {
    super({ code: 'ALREADY_REVIEWED', message: 'Bạn đã đánh giá sản phẩm này trong đơn hàng này rồi' });
  }
}

export class ReviewNotFoundException extends NotFoundException {
  constructor() {
    super({ code: 'REVIEW_NOT_FOUND', message: 'Đánh giá không tồn tại' });
  }
}

export class ProductNotFoundException extends NotFoundException {
  constructor() {
    super({ code: 'PRODUCT_NOT_FOUND', message: 'Sản phẩm không tồn tại' });
  }
}

export class InvalidImageTypeException extends BadRequestException {
  constructor(filename: string) {
    super({ code: 'INVALID_IMAGE_TYPE', message: `File "${filename}" không phải định dạng JPEG/PNG/WEBP` });
  }
}

export class ImageTooLargeException extends BadRequestException {
  constructor(filename: string) {
    super({ code: 'IMAGE_TOO_LARGE', message: `File "${filename}" vượt quá 5MB` });
  }
}

export class TooManyImagesException extends BadRequestException {
  constructor() {
    super({ code: 'TOO_MANY_IMAGES', message: 'Tối đa 5 ảnh cho mỗi đánh giá' });
  }
}

export class OrderServiceUnavailableException extends ServiceUnavailableException {
  constructor() {
    super({ code: 'ORDER_SERVICE_UNAVAILABLE', message: 'Order Service không phản hồi' });
  }
}

export class ProductServiceUnavailableException extends ServiceUnavailableException {
  constructor() {
    super({ code: 'PRODUCT_SERVICE_UNAVAILABLE', message: 'Product Service không phản hồi' });
  }
}

// ── Comment exceptions ────────────────────────────────────────

export class CommentNotFoundException extends NotFoundException {
  constructor() {
    super({ code: 'COMMENT_NOT_FOUND', message: 'Bình luận không tồn tại' });
  }
}

export class NotCommentOwnerException extends ForbiddenException {
  constructor() {
    super({ code: 'NOT_COMMENT_OWNER', message: 'Bạn không có quyền chỉnh sửa bình luận này' });
  }
}

export class EditWindowExpiredException extends UnprocessableEntityException {
  constructor() {
    super({ code: 'EDIT_WINDOW_EXPIRED', message: 'Đã quá 15 phút kể từ khi đăng, không thể chỉnh sửa' });
  }
}

export class MaxDepthExceededException extends UnprocessableEntityException {
  constructor() {
    super({ code: 'MAX_DEPTH_EXCEEDED', message: 'Không thể trả lời bình luận này (đã đạt độ sâu tối đa)' });
  }
}
