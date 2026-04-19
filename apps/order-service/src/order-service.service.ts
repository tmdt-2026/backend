import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderPublisher } from './publishers/order.publisher';

type OrderDetailSummary = {
  product_variant_id: string;
  product_name: string;
  variant_label?: string | null;
  quantity: number;
  import_price: unknown;
  price: unknown;
  item_discount?: unknown;
};

@Injectable()
export class OrderService {
  private readonly frontendBaseUrl = process.env.FRONTEND_URL ?? process.env.APP_URL ?? 'http://localhost:3000';

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: OrderPublisher,
  ) {}

  async createOrder(dto: CreateOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Đơn hàng phải có ít nhất 1 sản phẩm');
    }

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
          user_id: dto.user_id,
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
          status: newOrder.status,
          subtotal_price: newOrder.subtotal_price,
          discount_amount: newOrder.discount_amount,
          total_price: newOrder.total_price,
          total_product: newOrder.total_product,
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

  async getAllOrders(status?: string) {
  const orders = await this.prisma.order.findMany({
    where: status
      ? {
          status: status as any,
        }
      : {},
    orderBy: {
      created_at: 'desc',
    },
  });

    return {
      success: true,
      data: orders,
    };
  }

  async getOrderById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { order_details: true },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    return { success: true, data: order };
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
      pending: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['completed'],
      completed: [],
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
  async cancelOrder(id: string) {
  const order = await this.prisma.order.findUnique({
    where: { id },
  });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn');
    }

  if (order.status === 'completed') {
    throw new BadRequestException('Đơn đã hoàn thành, không thể hủy');
  }

  if (order.status === 'cancelled') {
    throw new BadRequestException('Đơn đã bị hủy trước đó');
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
}
