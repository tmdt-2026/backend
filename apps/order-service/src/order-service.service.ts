import {
  BadRequestException,
  Inject,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UserPayload } from './common/decorators/current-user.decorator';
import {
  OrderPublisher,
  ORDER_PRODUCT_RABBITMQ_CLIENT,
} from './publishers/order.publisher';

type OrderDetailSummary = {
  product_variant_id: string;
  product_name: string;
  variant_label?: string | null;
  quantity: number;
  import_price: unknown;
  price: unknown;
  item_discount?: unknown;
};

type ProductVariantRpcResult = {
  success?: boolean;
  data?: {
    isActive?: boolean;
    stockQuantity?: number;
  };
};

@Injectable()
export class OrderService {
  private readonly frontendBaseUrl = process.env.FRONTEND_URL ?? process.env.APP_URL ?? 'http://localhost:3000';
  private readonly internalServiceToken = process.env.INTERNAL_SERVICE_TOKEN ?? 'internal-secret-token-change-in-production';

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: OrderPublisher,
    @Inject(ORDER_PRODUCT_RABBITMQ_CLIENT)
    private readonly productClient: ClientProxy,
  ) {}

  private canManageAnyOrder(user: UserPayload) {
    return user.roles?.includes('admin') || user.roles?.includes('staff');
  }

  async createInvoice(dto: CreateOrderDto, userId: string) {
    return this.createOrder(dto, userId);
  }

  async createOrder(dto: CreateOrderDto, userId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Đơn hàng phải có ít nhất 1 sản phẩm');
    }

    await this.validateOrderVariants(dto);

    const subtotal_price = dto.items.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0,
    );

    const discount_amount = dto.items.reduce(
      (sum, item) =>
        sum + Number(item.item_discount || 0) * Number(item.quantity),
      0,
    );

    const total_price = subtotal_price - discount_amount;

    const total_product = dto.items.reduce(
      (sum, item) => sum + Number(item.quantity),
      0,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          user_id: userId,
          promotion_id: dto.promotion_id || null,
          payment_type: dto.payment_type,
          payment_method: dto.payment_method,
          subtotal_price,
          discount_amount,
          total_price,
          total_product,
          status: 'pending',
          shipping_name: dto.shipping_name,
          shipping_phone: dto.shipping_phone,
          shipping_province: dto.shipping_province,
          shipping_district: dto.shipping_district,
          shipping_ward: dto.shipping_ward,
          shipping_street: dto.shipping_street,
          note: dto.note || null,
          order_details: {
            create: dto.items.map((item) => ({
              product_variant_id: item.product_variant_id,
              product_name: item.product_name,
              variant_label: item.variant_label || null,
              quantity: item.quantity,
              import_price: item.import_price,
              price: item.price,
              item_discount: item.item_discount || 0,
            })),
          },
        },
        include: {
          order_details: true,
        },
      });

      return {
        data: {
          id: newOrder.id,
          // order_code may not exist in schema yet; fall back to id prefix
          order_code: (newOrder as any).order_code ?? `ORD-${newOrder.id.slice(0, 8).toUpperCase()}`,
          status: newOrder.status,
          payment_method: newOrder.payment_method,
          payment_type: newOrder.payment_type,
          // Canonical aliases expected by frontend and API docs
          total_amount: Number(newOrder.subtotal_price),
          discount_amount: Number(newOrder.discount_amount),
          shipping_fee: 0,
          final_amount: Number(newOrder.total_price),
          // Keep raw DB fields for internal consumers
          subtotal_price: Number(newOrder.subtotal_price),
          total_price: Number(newOrder.total_price),
          total_product: newOrder.total_product,
          createdAt: newOrder.created_at.toISOString(),
        },
        event: {
          orderId: newOrder.id,
          userId: newOrder.user_id,
          createdAt: newOrder.created_at.toISOString(),
          items: newOrder.order_details.map((d) => ({
            productVariantId: d.product_variant_id,
            quantity: d.quantity,
            price: Number(d.price),
          })),
        },
      };
    });

    await this.publisher.publishOrderCreated(result.event);

    return {
      success: true,
      data: result.data,
    };
  }

  private async validateOrderVariants(dto: CreateOrderDto) {
    for (const item of dto.items) {
      let rpcResponse: ProductVariantRpcResult;
      try {
        rpcResponse = await firstValueFrom(
          this.productClient.send<ProductVariantRpcResult>(
            { cmd: 'product.get-variant' },
            { variantId: item.product_variant_id },
          ),
        );
      } catch {
        throw new BadRequestException(
          `Khong tim thay bien the ${item.product_variant_id}`,
        );
      }

      if (!rpcResponse?.success || !rpcResponse.data) {
        throw new BadRequestException(
          `Khong tim thay bien the ${item.product_variant_id}`,
        );
      }

      if (!rpcResponse.data.isActive) {
        throw new BadRequestException(
          `Bien the ${item.product_variant_id} da ngung kinh doanh`,
        );
      }

      if (
        typeof rpcResponse.data.stockQuantity === 'number' &&
        item.quantity > rpcResponse.data.stockQuantity
      ) {
        throw new BadRequestException(
          `So luong dat cua bien the ${item.product_variant_id} vuot ton kho`,
        );
      }
    }
  }

  async getAllOrders(status?: string) {
    const orders = await this.prisma.order.findMany({
      where: status ? { status: status as any } : {},
      include: { order_details: true },
      orderBy: { created_at: 'desc' },
    });

    return { success: true, data: orders };
  }

  async getMyOrders(userId: string, status?: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        user_id: userId,
        ...(status ? { status: status as any } : {}),
      },
      include: { order_details: true },
      orderBy: { created_at: 'desc' },
    });

    const mapped = orders.map((o) => ({
      id: o.id,
      order_code: (o as any).order_code ?? `ORD-${o.id.slice(0, 8).toUpperCase()}`,
      status: o.status,
      payment_method: o.payment_method,
      payment_type: o.payment_type,
      total_amount: Number(o.subtotal_price),
      discount_amount: Number(o.discount_amount),
      shipping_fee: 0,
      final_amount: Number(o.total_price),
      createdAt: o.created_at.toISOString(),
      items: o.order_details.map((d) => ({
        product_variant_id: d.product_variant_id,
        product_name: d.product_name,
        variant_label: d.variant_label,
        quantity: d.quantity,
        price: Number(d.price),
        item_discount: Number((d as any).item_discount ?? 0),
      })),
    }));

    return { success: true, data: mapped };
  }

  async getOrderById(id: string, requester: UserPayload) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { order_details: true },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    if (!this.canManageAnyOrder(requester) && order.user_id !== requester.userId) {
      throw new ForbiddenException('Bạn không có quyền xem đơn hàng này');
    }

    return { success: true, data: this.mapOrderToResponse(order) };
  }

  async getOrderByIdInternal(id: string, token?: string) {
    if (token !== this.internalServiceToken) {
      throw new ForbiddenException('Không có quyền truy cập nội bộ');
    }

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { order_details: true },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    return { success: true, data: this.mapOrderToResponse(order) };
  }

  async getInvoiceById(id: string, requester: UserPayload) {
    return this.getOrderById(id, requester);
  }

  /** Dùng bởi RMQ message pattern — trả null thay vì throw khi không tìm thấy */
  async getOrderByIdForRpc(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { order_details: true },
    });
    if (!order) return null;
    return {
      id: order.id,
      userId: order.user_id,
      status: order.status,
      items: order.order_details.map((d) => ({
        productVariantId: d.product_variant_id,
        productId: d.product_variant_id,
        productName: d.product_name,
      })),
    };
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
  const order = await this.prisma.order.findUnique({
    where: { id },
  });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn');
    }

    const currentStatus = order.status as string;
    const nextStatus = dto.status as string;

    const allowedTransitions: Record<string, string[]> = {
      pending:   ['confirmed', 'cancelled'],
      confirmed: ['shipping', 'cancelled'],
      shipping:  ['delivered'],
      delivered: [],
      cancelled: [],
    };

  if (!allowedTransitions[currentStatus]) {
    throw new BadRequestException(
      `Trạng thái hiện tại không hợp lệ: ${currentStatus}`,
    );
  }

  if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    throw new BadRequestException(
      `Không thể chuyển trạng thái từ ${currentStatus} sang ${nextStatus}`,
    );
  }

  const updated = await this.prisma.order.update({
    where: { id },
    data: {
      status: nextStatus as any
    },
  });

  return {
    success: true,
    data: updated,
  };
}
  async deleteOrder(id: string) {
  const order = await this.prisma.order.findUnique({
    where: { id },
  });

  if (!order) {
    throw new NotFoundException('Không tìm thấy đơn');
  }

  await this.prisma.order.delete({
    where: { id },
  });

  return {
    success: true,
    message: 'Đã xoá đơn hàng',
  };
  }
  async cancelOrder(id: string, requester: UserPayload) {
  const order = await this.prisma.order.findUnique({
    where: { id },
  });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn');
    }

  const isPrivileged = this.canManageAnyOrder(requester);
  if (!isPrivileged && order.user_id !== requester.userId) {
    throw new ForbiddenException('Bạn không có quyền hủy đơn hàng này');
  }

  if (order.status === 'delivered') {
    throw new BadRequestException('Đơn đã hoàn thành, không thể hủy');
  }

  if (order.status === 'cancelled') {
    throw new BadRequestException('Đơn đã bị hủy trước đó');
  }

  if (!isPrivileged && order.status !== 'pending') {
    throw new BadRequestException('Chỉ có thể hủy đơn hàng đang chờ xác nhận');
  }

  const updated = await this.prisma.order.update({
    where: { id },
    data: {
      status: 'cancelled',
    },
  });

  return {
    success: true,
    data: updated,
  };
}

  private mapOrderToResponse(order: any) {
    return {
      id: order.id,
      user_id: order.user_id,
      promotion_id: order.promotion_id,
      order_code: (order as any).order_code ?? `ORD-${order.id.slice(0, 8).toUpperCase()}`,
      status: order.status,
      payment_type: order.payment_type,
      payment_method: order.payment_method,
      subtotal_price: Number(order.subtotal_price),
      discount_amount: Number(order.discount_amount),
      shipping_fee: 0,
      total_amount: Number(order.subtotal_price),
      final_amount: Number(order.total_price),
      total_price: Number(order.total_price),
      total_product: order.total_product,
      shipping_address: {
        name: order.shipping_name,
        phone: order.shipping_phone,
        province: order.shipping_province,
        district: order.shipping_district,
        ward: order.shipping_ward,
        street: order.shipping_street,
      },
      note: order.note,
      createdAt: order.created_at.toISOString(),
      updatedAt: order.updated_at.toISOString(),
      items: order.order_details?.map((d: any) => ({
        product_variant_id: d.product_variant_id,
        product_name: d.product_name,
        variant_label: d.variant_label,
        quantity: d.quantity,
        import_price: Number(d.import_price),
        price: Number(d.price),
        item_discount: Number(d.item_discount),
        subtotal: Number(d.price) * Number(d.quantity) - Number(d.item_discount ?? 0) * Number(d.quantity),
      })) ?? [],
    };
  }
}
