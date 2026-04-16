import { PrismaClient } from '@prisma/notification-client';

const prisma = new PrismaClient();

const SYSTEM_TEMPLATES = [
  {
    key: 'user_registered',
    name: 'Chào mừng tài khoản mới',
    subject: 'Chào mừng {{userName}} đến với iLuxury!',
    variables: ['userName', 'email', 'loginUrl'],
    description: 'Gửi khi user đăng ký tài khoản mới',
    htmlBody: `<h2 style="color:#050505;margin-top:0">Chào mừng bạn đến với iLuxury!</h2>
<p>Xin chào <strong>{{userName}}</strong>,</p>
<p>Tài khoản của bạn đã được tạo thành công với email <strong>{{email}}</strong>.</p>
<p>Bây giờ bạn có thể mua sắm các sản phẩm Apple chính hãng, đặt hàng trả góp 0% và theo dõi đơn hàng mọi lúc mọi nơi.</p>
<div class="highlight-box">
  <strong>Thông tin tài khoản:</strong><br>
  Email: {{email}}<br>
  Mật khẩu: Mật khẩu bạn đã đặt khi đăng ký
</div>
<p style="text-align:center;margin-top:28px">
  <a href="{{loginUrl}}" class="btn">Đăng nhập ngay</a>
</p>
<hr class="divider">
<p style="font-size:13px;color:#666">Nếu bạn không tạo tài khoản này, hãy bỏ qua email này hoặc liên hệ với chúng tôi ngay.</p>`,
  },
  {
    key: 'password_reset',
    name: 'Đặt lại mật khẩu',
    subject: 'Đặt lại mật khẩu iLuxury của bạn',
    variables: ['userName', 'resetUrl', 'expiresIn'],
    description: 'Gửi khi user yêu cầu đặt lại mật khẩu',
    htmlBody: `<h2 style="color:#050505;margin-top:0">Yêu cầu đặt lại mật khẩu</h2>
<p>Xin chào <strong>{{userName}}</strong>,</p>
<p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Nhấn vào nút bên dưới để tiến hành:</p>
<p style="text-align:center;margin:28px 0">
  <a href="{{resetUrl}}" class="btn">Đặt lại mật khẩu</a>
</p>
<div class="highlight-box" style="border-left-color:#ff453a">
  Link sẽ hết hạn sau <strong>{{expiresIn}}</strong>. Sau đó bạn cần gửi yêu cầu mới.
</div>
<hr class="divider">
<p style="font-size:13px;color:#666">Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Tài khoản của bạn vẫn an toàn.</p>`,
  },
  {
    key: 'order_confirmed',
    name: 'Xác nhận đơn hàng',
    subject: 'Don hang #{{orderCode}} da duoc xac nhan',
    variables: ['userName', 'orderCode', 'orderDate', 'items', 'subtotal', 'discount', 'total', 'shippingAddress', 'paymentMethod', 'trackingUrl'],
    description: 'Gửi khi đơn hàng được xác nhận',
    htmlBody: `<h2 style="color:#050505;margin-top:0">Đơn hàng của bạn đã được xác nhận!</h2>
<p>Xin chào <strong>{{userName}}</strong>,</p>
<p>Cảm ơn bạn đã mua hàng tại iLuxury. Đơn hàng của bạn đã được xác nhận và đang được chuẩn bị.</p>
<div class="highlight-box">
  <strong>Mã đơn hàng:</strong> #{{orderCode}}<br>
  <strong>Ngày đặt:</strong> {{orderDate}}<br>
  <strong>Phương thức thanh toán:</strong> {{paymentMethod}}
</div>
<h3 style="color:#050505;border-bottom:2px solid #fca311;padding-bottom:8px">Chi tiết đơn hàng</h3>
<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse">
  <thead><tr style="background:#f5f5f5">
    <th align="left" style="font-size:13px;color:#666">Sản phẩm</th>
    <th align="center" style="font-size:13px;color:#666">SL</th>
    <th align="right" style="font-size:13px;color:#666">Giá</th>
  </tr></thead>
  <tbody>{{#each items}}<tr style="border-bottom:1px solid #f0f0f0">
    <td style="font-size:14px"><strong>{{this.name}}</strong><br><span style="font-size:12px;color:#999">{{this.variant}}</span></td>
    <td align="center" style="font-size:14px">{{this.quantity}}</td>
    <td align="right" style="font-size:14px">{{this.price}}</td>
  </tr>{{/each}}</tbody>
  <tfoot>
    <tr><td colspan="2" align="right" style="font-size:13px;color:#666;padding-top:12px">Tạm tính:</td><td align="right" style="font-size:13px;padding-top:12px">{{subtotal}}</td></tr>
    {{#if discount}}<tr><td colspan="2" align="right" style="font-size:13px;color:#30d158">Giảm giá:</td><td align="right" style="font-size:13px;color:#30d158">-{{discount}}</td></tr>{{/if}}
    <tr><td colspan="2" align="right" style="font-size:16px;font-weight:700;color:#050505;padding-top:8px">Tổng cộng:</td><td align="right" style="font-size:16px;font-weight:700;color:#fca311;padding-top:8px">{{total}}</td></tr>
  </tfoot>
</table>
<h3 style="color:#050505;margin-top:24px">Địa chỉ giao hàng</h3>
<p style="color:#666;font-size:14px">{{shippingAddress}}</p>
<p style="text-align:center;margin-top:28px"><a href="{{trackingUrl}}" class="btn">Theo dõi đơn hàng</a></p>`,
  },
  {
    key: 'order_processing',
    name: 'Đơn hàng đang xử lý',
    subject: 'Don hang #{{orderCode}} dang duoc chuan bi',
    variables: ['userName', 'orderCode', 'trackingUrl'],
    description: 'Gửi khi đơn hàng đang được chuẩn bị',
    htmlBody: `<h2 style="color:#050505;margin-top:0">Đơn hàng đang được chuẩn bị!</h2>
<p>Xin chào <strong>{{userName}}</strong>,</p>
<p>Đơn hàng <strong>#{{orderCode}}</strong> của bạn đang được đội ngũ kho chuẩn bị và kiểm tra chất lượng.</p>
<p style="text-align:center;margin:28px 0"><a href="{{trackingUrl}}" class="btn">Theo dõi đơn hàng</a></p>`,
  },
  {
    key: 'order_shipped',
    name: 'Đơn hàng đang giao',
    subject: 'Don hang #{{orderCode}} dang tren duong den ban!',
    variables: ['userName', 'orderCode', 'estimatedDate', 'trackingUrl', 'shippingAddress'],
    description: 'Gửi khi đơn hàng được bàn giao cho đơn vị vận chuyển',
    htmlBody: `<h2 style="color:#050505;margin-top:0">Đơn hàng của bạn đang được giao!</h2>
<p>Xin chào <strong>{{userName}}</strong>,</p>
<p>Đơn hàng <strong>#{{orderCode}}</strong> đã được bàn giao cho đơn vị vận chuyển và đang trên đường đến bạn.</p>
<div class="highlight-box">
  <strong>Dự kiến giao:</strong> {{estimatedDate}}<br>
  <strong>Địa chỉ nhận:</strong> {{shippingAddress}}
</div>
<p style="text-align:center;margin:28px 0"><a href="{{trackingUrl}}" class="btn">Theo dõi đơn hàng</a></p>
<p style="font-size:13px;color:#666">Vui lòng đảm bảo có mặt tại địa chỉ giao hàng vào thời gian dự kiến. Nếu không nhận được hàng, liên hệ hotline <strong>1800 1234</strong>.</p>`,
  },
  {
    key: 'order_completed',
    name: 'Giao hàng thành công',
    subject: 'Giao hang thanh cong - Danh gia don hang #{{orderCode}}',
    variables: ['userName', 'orderCode', 'reviewUrl'],
    description: 'Gửi khi giao hàng thành công',
    htmlBody: `<h2 style="color:#050505;margin-top:0">Giao hàng thành công!</h2>
<p>Xin chào <strong>{{userName}}</strong>,</p>
<p>Đơn hàng <strong>#{{orderCode}}</strong> đã được giao thành công. Cảm ơn bạn đã tin tưởng mua sắm tại iLuxury!</p>
<p>Chia sẻ cảm nhận của bạn về sản phẩm để giúp những khách hàng khác có thêm thông tin hữu ích nhé.</p>
<p style="text-align:center;margin:28px 0"><a href="{{reviewUrl}}" class="btn">Đánh giá ngay → Nhận ưu đãi</a></p>
<p style="font-size:13px;color:#666">Nếu có bất kỳ vấn đề với sản phẩm, bạn có thể yêu cầu đổi trả trong vòng 30 ngày kể từ ngày nhận hàng.</p>`,
  },
  {
    key: 'order_cancelled',
    name: 'Đơn hàng bị huỷ',
    subject: 'Don hang #{{orderCode}} da bi huy',
    variables: ['userName', 'orderCode', 'cancelReason', 'refundInfo', 'supportUrl'],
    description: 'Gửi khi đơn hàng bị huỷ',
    htmlBody: `<h2 style="color:#050505;margin-top:0">Đơn hàng đã bị huỷ</h2>
<p>Xin chào <strong>{{userName}}</strong>,</p>
<p>Đơn hàng <strong>#{{orderCode}}</strong> của bạn đã được huỷ.</p>
<div class="highlight-box" style="border-left-color:#ff453a">
  <strong>Lý do huỷ:</strong> {{cancelReason}}
</div>
{{#if refundInfo}}<p>{{refundInfo}}</p>{{/if}}
<p>Nếu bạn cần hỗ trợ, đừng ngần ngại liên hệ với chúng tôi.</p>
<p style="text-align:center;margin:28px 0"><a href="{{supportUrl}}" class="btn" style="background:#f5f5f5;color:#333">Liên hệ hỗ trợ</a></p>`,
  },
  {
    key: 'installment_approved',
    name: 'Hồ sơ trả góp được duyệt',
    subject: 'Ho so tra gop cua ban da duoc duyet!',
    variables: ['userName', 'orderCode', 'planName', 'monthlyPayment', 'totalMonths', 'firstDueDate', 'scheduleUrl'],
    description: 'Gửi khi hồ sơ trả góp được phê duyệt',
    htmlBody: `<h2 style="color:#050505;margin-top:0">Hồ sơ trả góp đã được duyệt!</h2>
<p>Xin chào <strong>{{userName}}</strong>,</p>
<p>Hồ sơ đăng ký mua trả góp cho đơn hàng <strong>#{{orderCode}}</strong> đã được phê duyệt thành công.</p>
<div class="highlight-box">
  <strong>Gói trả góp:</strong> {{planName}}<br>
  <strong>Số tiền mỗi kỳ:</strong> <span style="color:#fca311;font-weight:700">{{monthlyPayment}}</span><br>
  <strong>Số kỳ:</strong> {{totalMonths}} tháng<br>
  <strong>Kỳ thanh toán đầu tiên:</strong> {{firstDueDate}}
</div>
<p>Vui lòng thanh toán đúng hạn để tránh phát sinh phí trễ hạn.</p>
<p style="text-align:center;margin:28px 0"><a href="{{scheduleUrl}}" class="btn">Xem lịch trả góp</a></p>`,
  },
  {
    key: 'installment_rejected',
    name: 'Hồ sơ trả góp bị từ chối',
    subject: 'Ho so tra gop cua ban bi tu choi',
    variables: ['userName', 'orderCode', 'rejectReason', 'supportUrl'],
    description: 'Gửi khi hồ sơ trả góp bị từ chối',
    htmlBody: `<h2 style="color:#050505;margin-top:0">Hồ sơ trả góp bị từ chối</h2>
<p>Xin chào <strong>{{userName}}</strong>,</p>
<p>Rất tiếc, hồ sơ đăng ký mua trả góp cho đơn hàng <strong>#{{orderCode}}</strong> đã bị từ chối.</p>
<div class="highlight-box" style="border-left-color:#ff453a">
  <strong>Lý do:</strong> {{rejectReason}}
</div>
<p>Nếu bạn cần hỗ trợ hoặc muốn nộp lại hồ sơ, hãy liên hệ với chúng tôi.</p>
<p style="text-align:center;margin:28px 0"><a href="{{supportUrl}}" class="btn" style="background:#f5f5f5;color:#333">Liên hệ hỗ trợ</a></p>`,
  },
  {
    key: 'installment_reminder',
    name: 'Nhắc thanh toán kỳ góp',
    subject: 'Nhac nho: Ky thanh toan thang {{termNumber}} sap den han',
    variables: ['userName', 'orderCode', 'termNumber', 'amountDue', 'dueDate', 'paymentUrl'],
    description: 'Gửi nhắc nhở kỳ thanh toán sắp đến hạn',
    htmlBody: `<h2 style="color:#050505;margin-top:0">Nhắc nhở thanh toán kỳ góp</h2>
<p>Xin chào <strong>{{userName}}</strong>,</p>
<p>Kỳ thanh toán tháng <strong>{{termNumber}}</strong> cho đơn hàng <strong>#{{orderCode}}</strong> sắp đến hạn.</p>
<div class="highlight-box">
  <strong>Ngày đến hạn:</strong> {{dueDate}}<br>
  <strong>Số tiền cần thanh toán:</strong> <span style="color:#fca311;font-weight:700">{{amountDue}}</span>
</div>
<p>Vui lòng thanh toán trước ngày đến hạn để tránh phí trễ hạn.</p>
<p style="text-align:center;margin:28px 0"><a href="{{paymentUrl}}" class="btn">Thanh toán ngay</a></p>`,
  },
  {
    key: 'installment_overdue',
    name: 'Kỳ góp quá hạn',
    subject: 'Ky thanh toan thang {{termNumber}} da qua han',
    variables: ['userName', 'orderCode', 'termNumber', 'amountDue', 'dueDate', 'lateFee', 'paymentUrl'],
    description: 'Gửi khi kỳ thanh toán đã quá hạn',
    htmlBody: `<h2 style="color:#050505;margin-top:0">Kỳ thanh toán đã quá hạn!</h2>
<p>Xin chào <strong>{{userName}}</strong>,</p>
<p>Kỳ thanh toán tháng <strong>{{termNumber}}</strong> cho đơn hàng <strong>#{{orderCode}}</strong> đã quá hạn ngày <strong>{{dueDate}}</strong>.</p>
<div class="highlight-box" style="border-left-color:#ff453a">
  <strong>Số tiền gốc:</strong> {{amountDue}}<br>
  <strong>Phí trễ hạn:</strong> <span style="color:#ff453a">{{lateFee}}</span>
</div>
<p>Vui lòng thanh toán ngay để tránh phát sinh thêm phí và ảnh hưởng đến lịch sử tín dụng.</p>
<p style="text-align:center;margin:28px 0"><a href="{{paymentUrl}}" class="btn" style="background:#ff453a;color:#fff">Thanh toán ngay</a></p>`,
  },
  {
    key: 'payment_success',
    name: 'Thanh toán thành công',
    subject: 'Thanh toan thanh cong cho don hang #{{orderCode}}',
    variables: ['userName', 'orderCode', 'amount', 'paymentMethod', 'transactionCode', 'paidAt', 'receiptUrl'],
    description: 'Gửi khi thanh toán thành công',
    htmlBody: `<h2 style="color:#050505;margin-top:0">Thanh toán thành công!</h2>
<p>Xin chào <strong>{{userName}}</strong>,</p>
<p>Chúng tôi đã nhận được thanh toán cho đơn hàng của bạn.</p>
<div class="highlight-box">
  <strong>Đơn hàng:</strong> #{{orderCode}}<br>
  <strong>Số tiền:</strong> <span style="color:#30d158;font-weight:700">{{amount}}</span><br>
  <strong>Phương thức:</strong> {{paymentMethod}}<br>
  <strong>Mã giao dịch:</strong> {{transactionCode}}<br>
  <strong>Thời gian:</strong> {{paidAt}}
</div>
<p style="text-align:center;margin:28px 0"><a href="{{receiptUrl}}" class="btn">Xem hoá đơn</a></p>`,
  },
  {
    key: 'payment_failed',
    name: 'Thanh toán thất bại',
    subject: 'Thanh toan that bai cho don hang #{{orderCode}}',
    variables: ['userName', 'orderCode', 'amount', 'failReason', 'retryUrl'],
    description: 'Gửi khi thanh toán thất bại',
    htmlBody: `<h2 style="color:#050505;margin-top:0">Thanh toán thất bại</h2>
<p>Xin chào <strong>{{userName}}</strong>,</p>
<p>Rất tiếc, giao dịch thanh toán cho đơn hàng <strong>#{{orderCode}}</strong> đã thất bại.</p>
<div class="highlight-box" style="border-left-color:#ff453a">
  <strong>Số tiền:</strong> {{amount}}<br>
  <strong>Lý do:</strong> {{failReason}}
</div>
<p>Vui lòng thử lại hoặc sử dụng phương thức thanh toán khác.</p>
<p style="text-align:center;margin:28px 0"><a href="{{retryUrl}}" class="btn">Thử lại thanh toán</a></p>`,
  },
  {
    key: 'admin_broadcast',
    name: 'Thông báo Admin',
    subject: '{{subject}}',
    variables: ['userName', 'subject', 'message'],
    description: 'Template dùng cho admin broadcast',
    htmlBody: `<h2 style="color:#050505;margin-top:0">{{subject}}</h2>
<p>Xin chào <strong>{{userName}}</strong>,</p>
<div style="color:#333;line-height:1.7">{{{message}}}</div>`,
  },
];

async function main() {
  console.log('Seeding email templates...');

  for (const template of SYSTEM_TEMPLATES) {
    await prisma.emailTemplate.upsert({
      where: { key: template.key },
      update: {
        name: template.name,
        subject: template.subject,
        htmlBody: template.htmlBody,
        variables: template.variables,
        description: template.description,
        isSystem: true,
        isActive: true,
      },
      create: {
        key: template.key,
        name: template.name,
        subject: template.subject,
        htmlBody: template.htmlBody,
        variables: template.variables,
        description: template.description,
        isSystem: true,
        isActive: true,
      },
    });
    console.log(`  ✅ Seeded template: ${template.key}`);
  }

  console.log(`\n✅ Seeded ${SYSTEM_TEMPLATES.length} email templates`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
