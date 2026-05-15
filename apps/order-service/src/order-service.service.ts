import {
  BadRequestException,
  Inject,
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import axios from 'axios';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UserPayload } from './common/decorators/current-user.decorator';
import {
  OrderPublisher,
  ORDER_PROMOTION_RABBITMQ_CLIENT,
  ORDER_PRODUCT_RABBITMQ_CLIENT,
} from './publishers/order.publisher';

type OrderDetailSummary = {
  product_variant_id: string;
  product_name: string;
  product_image?: string | null;
  variant_label?: string | null;
  quantity: number;
  import_price: unknown;
  price: unknown;
  item_discount?: unknown;
};

type ProductVariantRpcResult = {
  success?: boolean;
  data?: {
    productId?: string;
    variantId?: string;
    isActive?: boolean;
    stockQuantity?: number;
  };
};

type StockLine = { variantId: string; quantity: number };

type ProductStockMutationRpcResult = {
  success?: boolean;
  message?: string;
};

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private readonly frontendBaseUrl = process.env.FRONTEND_URL ?? process.env.APP_URL ?? 'http://localhost:3000';
  private readonly userServiceUrl = `${process.env.USER_SERVICE_URL ?? 'http://user-service:3001'}/api/v1`;
  private readonly internalServiceToken = process.env.INTERNAL_SERVICE_TOKEN ?? 'internal-secret-token-change-in-production';

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: OrderPublisher,
    @Inject(ORDER_PRODUCT_RABBITMQ_CLIENT)
    private readonly productClient: ClientProxy,
    @Inject(ORDER_PROMOTION_RABBITMQ_CLIENT)
    private readonly promotionClient: ClientProxy,
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
              product_image: item.product_image || null,
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
        notificationEvent: this.buildOrderEmailBase(newOrder),
      };
    });

    const stockItems: StockLine[] = dto.items.map((item) => ({
      variantId: item.product_variant_id,
      quantity: Number(item.quantity),
    }));

    try {
      await this.productDecrementStocks(stockItems);
    } catch (err) {
      await this.prisma.order.delete({ where: { id: result.event.orderId } }).catch(() => {
        /* best-effort rollback */
      });
      throw err;
    }

    await this.publisher.publishOrderCreated(result.event);
    await this.publishOrderNotification('order.confirmed', result.notificationEvent);

    return {
      success: true,
      data: result.data,
    };
  }

  private buildStockLinesFromDetails(
    details: Array<{ product_variant_id: string; quantity: number }>,
  ): StockLine[] {
    return details.map((d) => ({
      variantId: d.product_variant_id,
      quantity: Number(d.quantity),
    }));
  }

  private async productDecrementStocks(items: StockLine[]) {
    if (!items.length) return;
    const resp = await firstValueFrom(
      this.productClient.send<ProductStockMutationRpcResult>(
        { cmd: 'product.decrement-stocks-for-order' },
        { items },
      ),
    );
    if (!resp?.success) {
      throw new BadRequestException(resp?.message ?? 'Không thể trừ tồn kho sản phẩm');
    }
  }

  private async productIncrementStocks(items: StockLine[]) {
    if (!items.length) return;
    try {
      const resp = await firstValueFrom(
        this.productClient.send<ProductStockMutationRpcResult>(
          { cmd: 'product.increment-stocks-for-order' },
          { items },
        ),
      );
      if (!resp?.success) {
        this.logger.warn(`Hoàn tồn kho thất bại: ${resp?.message ?? 'unknown'}`);
      }
    } catch (error: any) {
      this.logger.warn(`Hoàn tồn kho lỗi RPC: ${error?.message || error}`);
    }
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
        product_image: (d as any).product_image ?? null,
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
    const items = await Promise.all(
      order.order_details.map(async (d) => {
        let productId = d.product_variant_id;
        try {
          const rpc = await firstValueFrom(
            this.productClient.send<ProductVariantRpcResult>(
              { cmd: 'product.get-variant' },
              { variantId: d.product_variant_id },
            ),
          );
          if (rpc?.success && rpc.data?.productId) {
            productId = rpc.data.productId;
          }
        } catch {
          /* giữ fallback */
        }
        return {
          productVariantId: d.product_variant_id,
          productId,
          productName: d.product_name,
          productImage: (d as any).product_image ?? null,
        };
      }),
    );
    return {
      id: order.id,
      userId: order.user_id,
      status: order.status,
      items,
    };
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { order_details: true },
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
        status: nextStatus as any,
      },
    });

    if (nextStatus === 'cancelled') {
      await this.productIncrementStocks(this.buildStockLinesFromDetails(order.order_details));
    }

    if (nextStatus === 'delivered' && order.promotion_id) {
      try {
        await firstValueFrom(
          this.promotionClient.send(
            { cmd: 'promotion.record-usage' },
            {
              promotionId: order.promotion_id,
              userId: order.user_id,
              orderId: order.id,
            },
          ),
        );
      } catch (error: any) {
        this.logger.error(
          `Không thể ghi nhận usage voucher cho order ${order.id}: ${error?.message || error}`,
        );
      }
    }

    // Inventory events must always fire, independent of notification email success.
    if (nextStatus === 'confirmed') {
      await this.publisher.publishInventoryConfirmed(order.id);
    } else if (nextStatus === 'cancelled') {
      await this.publisher.publishInventoryCancelled(order.id);
    }

    const basePayload = this.buildOrderEmailBase(order);
    if (nextStatus === 'confirmed') {
      await this.publishOrderNotification('order.confirmed', basePayload);
    } else if (nextStatus === 'shipping') {
      await this.publishOrderNotification('order.shipped', {
        ...basePayload,
        estimatedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      });
    } else if (nextStatus === 'delivered') {
      await this.publishOrderNotification('order.completed', {
        ...basePayload,
        reviewUrl: this.buildFrontendUrl(`/orders/${order.id}/review`),
      });
    } else if (nextStatus === 'cancelled') {
      await this.publishOrderNotification('order.cancelled', {
        ...basePayload,
        cancelReason: 'Đơn hàng đã được huỷ bởi hệ thống/quản trị viên',
        supportUrl: this.buildFrontendUrl('/support'),
      });
    }

    return {
      success: true,
      data: updated,
    };
  }
  async updateStatusInternal(id: string, dto: UpdateOrderStatusDto, token?: string) {
    if (token !== this.internalServiceToken) {
      throw new ForbiddenException('Không có quyền cập nhật nội bộ');
    }
    return this.updateStatus(id, dto);
  }
  async deleteOrder(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { order_details: true },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn');
    }

    if (order.status !== 'cancelled') {
      await this.productIncrementStocks(this.buildStockLinesFromDetails(order.order_details));
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
      include: { order_details: true },
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

    await this.productIncrementStocks(this.buildStockLinesFromDetails(order.order_details));

    await this.publisher.publishInventoryCancelled(order.id);

    const basePayload = this.buildOrderEmailBase(order);
    await this.publishOrderNotification('order.cancelled', {
      ...basePayload,
      cancelReason: isPrivileged
        ? 'Đơn hàng đã được huỷ bởi quản trị viên'
        : 'Khách hàng đã yêu cầu huỷ đơn hàng',
      supportUrl: this.buildFrontendUrl('/support'),
    });

    return {
      success: true,
      data: updated,
    };
  }

  private async publishOrderNotification(
    event: 'order.confirmed' | 'order.processing' | 'order.shipped' | 'order.completed' | 'order.cancelled',
    payload: ReturnType<OrderService['buildOrderEmailBase']> & Record<string, unknown>,
  ): Promise<void> {
    const profile = await this.getUserProfile(payload.userId as string);
    if (!profile.userEmail) {
      this.logger.warn(`Skip ${event} email: missing email for user ${payload.userId}`);
      return;
    }

    const eventPayload = {
      ...payload,
      userEmail: profile.userEmail,
      userName: profile.userName,
    };

    if (event === 'order.confirmed') {
      await this.publisher.publishOrderConfirmed(eventPayload);
    } else if (event === 'order.processing') {
      await this.publisher.publishOrderProcessing(eventPayload);
    } else if (event === 'order.shipped') {
      await this.publisher.publishOrderShipped(eventPayload);
    } else if (event === 'order.completed') {
      await this.publisher.publishOrderCompleted(eventPayload);
    } else if (event === 'order.cancelled') {
      await this.publisher.publishOrderCancelled(eventPayload);
    }
  }

  private buildOrderEmailBase(order: any) {
    const orderCode = (order as any).order_code ?? `ORD-${order.id.slice(0, 8).toUpperCase()}`;
    const shippingAddress = [
      order.shipping_street,
      order.shipping_ward,
      order.shipping_district,
      order.shipping_province,
    ]
      .filter(Boolean)
      .join(', ');

    return {
      orderId: order.id,
      orderCode,
      userId: order.user_id,
      orderDate: order.created_at.toISOString(),
      items: (order.order_details ?? []).map((detail: any) => ({
        name: detail.product_name,
        variant: detail.variant_label ?? '',
        quantity: Number(detail.quantity),
        price: this.formatCurrency(Number(detail.price)),
      })),
      subtotal: this.formatCurrency(Number(order.subtotal_price)),
      // Keep `discount` always present because current template marks it as required.
      discount: this.formatCurrency(Number(order.discount_amount || 0)),
      total: this.formatCurrency(Number(order.total_price)),
      shippingAddress,
      paymentMethod: order.payment_method,
      trackingUrl: this.buildFrontendUrl(`/orders/${order.id}`),
    };
  }

  private async getUserProfile(userId: string): Promise<{ userEmail: string; userName: string }> {
    try {
      const response = await axios.get(`${this.userServiceUrl}/internal/users/${userId}`, {
        headers: {
          'X-Service-Token': this.internalServiceToken,
        },
      });
      const user = response.data?.data ?? response.data;
      return {
        userEmail: user?.email ?? '',
        userName: user?.fullName ?? user?.userName ?? 'Khách hàng',
      };
    } catch (error: any) {
      this.logger.warn(`Cannot load user profile ${userId}: ${error?.message || error}`);
      return {
        userEmail: '',
        userName: 'Khách hàng',
      };
    }
  }

  private buildFrontendUrl(path: string): string {
    return `${this.frontendBaseUrl.replace(/\/$/, '')}${path}`;
  }

  private formatCurrency(value: number): string {
    return `${Number(value || 0).toLocaleString('vi-VN')} VND`;
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
        product_image: d.product_image ?? null,
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
