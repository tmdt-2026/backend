import { ApiProperty } from '@nestjs/swagger';

export class ApplyInstallmentDto {
  @ApiProperty({ example: 'user-123', description: 'ID của người dùng' })
  userId: string;

  @ApiProperty({ example: 'order-456', description: 'ID của đơn hàng' })
  orderId: string;

  @ApiProperty({ example: 'NHAP-ID-GOI-TRA-GOP-VAO-DAY', description: 'ID của gói trả góp (Lấy từ API GET /plans)' })
  planId: string;

  @ApiProperty({ example: 15000000, description: 'Tổng giá trị đơn hàng' })
  orderTotal: number;
}