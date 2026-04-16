# Apple Shop — Tài Liệu Hệ Thống

> **Stack:** NestJS · Prisma · MySQL · RabbitMQ · Firebase · HTML/CSS/JS  
> **Kiến trúc:** Microservices  
> **Phiên bản tài liệu:** 1.0

---

## Mục Lục

1. [Tổng Quan Hệ Thống](#1-tổng-quan-hệ-thống)
2. [Sơ Đồ Use Case](#2-sơ-đồ-use-case)
3. [Danh Sách Chức Năng](#3-danh-sách-chức-năng)
4. [Sơ Đồ Luồng Hoạt Động](#4-sơ-đồ-luồng-hoạt-động)
5. [Kiến Trúc Microservices](#5-kiến-trúc-microservices)
6. [Định Nghĩa API Endpoints](#6-định-nghĩa-api-endpoints)

---

## 1. Tổng Quan Hệ Thống

### 1.1 Mô Tả

Website thương mại điện tử chuyên bán các sản phẩm Apple, bao gồm iPhone, iPad, Mac, AirPods, Apple Watch và phụ kiện. Hệ thống được xây dựng theo kiến trúc **Microservices**, mỗi nghiệp vụ độc lập thành một service riêng, giao tiếp qua **RabbitMQ**.

### 1.2 Danh Sách Services

| # | Service | Database | Mô Tả |
|---|---------|----------|-------|
| 1 | **User Service** | db_users | Quản lý tài khoản, phân quyền, địa chỉ |
| 2 | **Product Service** | db_products | Quản lý sản phẩm, danh mục, biến thể |
| 3 | **Inventory Service** | db_inventory | Quản lý tồn kho, nhập/xuất |
| 4 | **Order Service** | db_orders | Quản lý đơn hàng |
| 5 | **Payment Service** | db_payments | Xử lý thanh toán (VNPay, MoMo, COD) |
| 6 | **Installment Service** | db_installments | Trả góp nội bộ |
| 7 | **Promotion Service** | db_promos | Voucher, flash sale |
| 8 | **Cart Service** | db_carts | Giỏ hàng |
| 9 | **Notification Service** | db_notifications | Thông báo Firebase push |
| 10 | **Review Service** | db_reviews | Đánh giá & bình luận |
| 11 | **Config Service** | db_config | Cấu hình hệ thống, banner |

### 1.3 Actors

| Actor | Mô Tả |
|-------|-------|
| **Guest** | Khách chưa đăng nhập — xem sản phẩm, giỏ hàng tạm |
| **Customer** | Khách hàng đã đăng nhập |
| **Staff** | Nhân viên cửa hàng — xử lý đơn, thu tiền góp |
| **Admin** | Quản trị viên — toàn quyền hệ thống |

---

## 2. Sơ Đồ Use Case

### 2.1 Use Case Tổng Quan — Customer

```
┌─────────────────────────────────────────────────────────────────┐
│                        HỆ THỐNG APPLE SHOP                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   CUSTOMER USE CASES                     │    │
│  │                                                          │    │
│  │  [Xem sản phẩm]         [Tìm kiếm / Lọc]              │    │
│  │  [Xem chi tiết SP]      [Xem đánh giá]                 │    │
│  │  [Thêm vào giỏ]         [Đặt hàng]                     │    │
│  │  [Thanh toán online]    [Thanh toán COD]               │    │
│  │  [Đăng ký trả góp]      [Xem lịch trả góp]            │    │
│  │  [Nhập mã giảm giá]     [Xem đơn hàng]                │    │
│  │  [Huỷ đơn hàng]         [Viết đánh giá]               │    │
│  │  [Bình luận SP]         [Quản lý địa chỉ]             │    │
│  │  [Cập nhật hồ sơ]       [Nhận thông báo]              │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────┐  ┌──────────────────────────────────────────┐   │
│  │   GUEST    │  │              GUEST USE CASES             │   │
│  │            │  │                                          │   │
│  │   ──────── │  │  [Xem sản phẩm]  [Tìm kiếm]           │   │
│  │   (không   │  │  [Giỏ hàng tạm]  [Xem đánh giá]       │   │
│  │   đăng nhập│  │  [Đăng ký]       [Đăng nhập]          │   │
│  │            │  │                                          │   │
│  └────────────┘  └──────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Use Case Tổng Quan — Admin / Staff

```
┌─────────────────────────────────────────────────────────────────┐
│                       TRANG QUẢN TRỊ (ADMIN)                    │
│                                                                  │
│  ┌──────────────────────────┐  ┌──────────────────────────┐    │
│  │    ADMIN USE CASES       │  │    STAFF USE CASES       │    │
│  │                          │  │                          │    │
│  │  [Quản lý sản phẩm]      │  │  [Xem đơn hàng]         │    │
│  │  [Quản lý danh mục]      │  │  [Cập nhật trạng thái]  │    │
│  │  [Quản lý kho]           │  │  [Duyệt hồ sơ trả góp]  │    │
│  │  [Quản lý đơn hàng]      │  │  [Ghi nhận tiền góp]    │    │
│  │  [Quản lý trả góp]       │  │  [Xem báo cáo kho]      │    │
│  │  [Quản lý voucher]       │  │                          │    │
│  │  [Cấu hình flash sale]   │  └──────────────────────────┘    │
│  │  [Quản lý người dùng]    │                                   │
│  │  [Cấu hình hệ thống]     │                                   │
│  │  [Quản lý banner]        │                                   │
│  │  [Cấu hình trả góp]      │                                   │
│  │  [Gửi thông báo]         │                                   │
│  │  [Xem báo cáo doanh thu] │                                   │
│  │  [Ẩn/hiện đánh giá]      │                                   │
│  │  [Ẩn/hiện bình luận]     │                                   │
│  │                          │                                   │
│  └──────────────────────────┘                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Danh Sách Chức Năng

### 3.1 Chức Năng Dành Cho Customer

#### Xác Thực & Tài Khoản
- Đăng ký tài khoản (email + mật khẩu)
- Đăng nhập / Đăng xuất
- Quên mật khẩu / Đặt lại mật khẩu
- Cập nhật thông tin cá nhân (tên, avatar)
- Đổi mật khẩu
- Quản lý địa chỉ giao hàng (CRUD, đặt mặc định)
- Xem lịch sử hoạt động tài khoản

#### Duyệt & Tìm Kiếm Sản Phẩm
- Xem danh sách sản phẩm theo danh mục (iPhone, iPad, Mac, AirPods, Watch, Phụ kiện)
- Tìm kiếm sản phẩm theo từ khoá
- Lọc sản phẩm theo màu sắc, dung lượng, khoảng giá
- Sắp xếp theo giá tăng/giảm, mới nhất, bán chạy
- Xem chi tiết sản phẩm (ảnh gallery, thông số kỹ thuật, biến thể)
- Xem giá niêm yết và giá bán thực tế
- Xem trạng thái tồn kho

#### Giỏ Hàng
- Thêm sản phẩm vào giỏ
- Cập nhật số lượng trong giỏ
- Xoá sản phẩm khỏi giỏ
- Xem tổng tiền giỏ hàng
- Giỏ hàng persistent (đăng nhập từ thiết bị khác vẫn giữ)
- Guest cart (chưa đăng nhập, lưu tạm)
- Merge guest cart khi đăng nhập

#### Đặt Hàng
- Chọn địa chỉ giao hàng từ address book hoặc nhập mới
- Nhập số điện thoại người nhận tuỳ ý
- Chọn phương thức thanh toán (COD / VNPay / MoMo / Trả góp)
- Nhập mã voucher giảm giá
- Xem tóm tắt đơn trước khi xác nhận
- Đặt hàng và nhận xác nhận

#### Thanh Toán
- Thanh toán COD (trả khi nhận)
- Thanh toán qua VNPay
- Thanh toán qua MoMo
- Đăng ký mua trả góp (nộp hồ sơ)
- Xem trạng thái thanh toán

#### Trả Góp
- Chọn gói trả góp (3/6/12 tháng, lãi suất...)
- Nộp hồ sơ (CCCD mặt trước/sau, ảnh chân dung, thu nhập)
- Xem trạng thái duyệt hồ sơ
- Xem lịch trả góp theo kỳ
- Nhận thông báo nhắc trả kỳ góp
- Xem lịch sử đã thanh toán kỳ góp

#### Quản Lý Đơn Hàng
- Xem danh sách đơn hàng
- Xem chi tiết đơn hàng
- Huỷ đơn hàng (khi còn ở trạng thái pending)
- Theo dõi trạng thái đơn (pending → processing → shipped → completed)

#### Đánh Giá & Bình Luận
- Viết đánh giá sản phẩm (sau khi đơn completed)
- Chấm điểm 1–5 sao
- Đính kèm ảnh vào đánh giá
- Đặt câu hỏi / bình luận sản phẩm
- Trả lời bình luận

#### Thông Báo
- Nhận push notification qua Firebase
- Xem danh sách thông báo
- Đánh dấu đã đọc
- Các loại thông báo: đơn hàng, trả góp, khuyến mãi

---

### 3.2 Chức Năng Dành Cho Admin

#### Quản Lý Sản Phẩm
- CRUD danh mục (có hỗ trợ danh mục con)
- CRUD model sản phẩm (thông số kỹ thuật)
- CRUD sản phẩm (tên, mô tả, thumbnail, gallery ảnh)
- CRUD biến thể sản phẩm (màu, dung lượng, giá vốn, giá bán, giá niêm yết)
- Ẩn/hiện sản phẩm / biến thể
- Xoá mềm sản phẩm
- Lịch sử thay đổi giá (price history)

#### Quản Lý Kho
- Xem tồn kho hiện tại theo từng biến thể
- Nhập kho (thêm số lượng, ghi lý do)
- Điều chỉnh kho (inventory adjustment)
- Xem lịch sử nhập/xuất kho
- Cảnh báo khi tồn kho thấp

#### Quản Lý Đơn Hàng
- Xem danh sách đơn hàng (lọc theo trạng thái, ngày, khách hàng)
- Xem chi tiết đơn hàng
- Cập nhật trạng thái đơn (pending → processing → shipped → completed)
- Huỷ đơn hàng
- Xem thông tin giao hàng của từng đơn

#### Quản Lý Trả Góp
- Cấu hình các gói trả góp (thời hạn, lãi suất, điều kiện)
- Xem danh sách hồ sơ đăng ký (lọc theo trạng thái)
- Xem chi tiết hồ sơ (thông tin cá nhân, ảnh CCCD)
- Duyệt / Từ chối hồ sơ (có lý do từ chối)
- Xem lịch trả góp của từng hồ sơ
- Ghi nhận thanh toán kỳ góp (Staff)
- Đánh dấu kỳ góp quá hạn

#### Quản Lý Khuyến Mãi
- CRUD voucher (mã, giá trị, thời hạn, giới hạn lượt dùng)
- CRUD flash sale (giảm trực tiếp vào sản phẩm cụ thể)
- Gắn promotion với sản phẩm / biến thể cụ thể
- Cài đặt thời gian bắt đầu/kết thúc
- Xem lịch sử sử dụng voucher

#### Quản Lý Người Dùng
- Xem danh sách tài khoản
- Xem chi tiết tài khoản
- Khoá / Mở khoá tài khoản
- Phân quyền (Admin / Staff / Customer)

#### Cấu Hình Hệ Thống
- Cấu hình thông tin cửa hàng (hotline, địa chỉ, Google Map iframe)
- Cấu hình liên kết mạng xã hội (Facebook, Zalo, Instagram, YouTube)
- Cấu hình nội dung chính sách (chính sách đổi trả, bảo hành, bảo mật, về chúng tôi)
- Quản lý banner (thêm/sửa/xoá, sắp xếp, lên lịch)
- Gửi thông báo hàng loạt (push to all users)

#### Thông Báo & Đánh Giá
- Ẩn/hiện đánh giá vi phạm
- Ẩn/hiện bình luận vi phạm
- Xem danh sách đánh giá theo sản phẩm

---

## 4. Sơ Đồ Luồng Hoạt Động

### 4.1 Luồng Đặt Hàng Thanh Toán Online

```
CUSTOMER                ORDER SVC           INVENTORY SVC       PAYMENT SVC         NOTIFICATION SVC
    │                       │                     │                   │                     │
    │── Đặt hàng ──────────>│                     │                   │                     │
    │                       │── Validate cart ──> │                   │                     │
    │                       │<─ Stock OK ─────────│                   │                     │
    │                       │── Reserve stock ──> │                   │                     │
    │                       │   (reserved_qty++)  │                   │                     │
    │                       │── Create ORDER ─────│                   │                     │
    │                       │   status=pending    │                   │                     │
    │<── Redirect URL ───────│                     │                   │                     │
    │                       │── [event] order_created ──────────────>│                     │
    │── Thanh toán ──────────────────────────────────────────────────>│                     │
    │<── Kết quả ────────────────────────────────────────────────────│                     │
    │                       │<── [event] payment_success ────────────│                     │
    │                       │── Update ORDER ──── │                   │                     │
    │                       │   status=processing │                   │                     │
    │                       │── Deduct stock ───> │                   │                     │
    │                       │   (reserved→actual) │                   │                     │
    │                       │── [event] order_status_changed ──────────────────────────────>│
    │                       │                     │                   │                     │── Push notify
    │<── Thông báo ──────────────────────────────────────────────────────────────────────────│
    │   "Đơn hàng đã xác nhận"
```

### 4.2 Luồng Đặt Hàng COD

```
CUSTOMER                ORDER SVC           INVENTORY SVC       NOTIFICATION SVC
    │                       │                     │                     │
    │── Đặt hàng COD ──────>│                     │                     │
    │                       │── Validate stock ──>│                     │
    │                       │<── Stock OK ─────────│                     │
    │                       │── Reserve stock ────>│                     │
    │                       │── Create ORDER ──────│                     │
    │                       │   status=pending     │                     │
    │                       │   payment=COD        │                     │
    │<── Xác nhận đặt hàng ──│                     │                     │
    │                       │── [event] order_created ──────────────────>│
    │                       │                     │                     │── Push "Đặt hàng thành công"
    │  [Admin xử lý đơn]    │                     │                     │
    │                       │── Update status=processing ───────────────>│
    │                       │── Update status=shipped ──────────────────>│── Push "Đang giao hàng"
    │  [Giao hàng, thu tiền COD]
    │                       │── Update status=completed ─────────────────>│── Push "Giao hàng thành công"
    │                       │── Deduct stock ─────>│                     │
```

### 4.3 Luồng Đăng Ký Trả Góp

```
CUSTOMER            ORDER SVC       INSTALLMENT SVC     NOTIFICATION SVC
    │                   │                 │                     │
    │── Đặt hàng ──────>│                 │                     │
    │   payment_type=installment          │                     │
    │   plan_id=xxx     │                 │                     │
    │                   │── Create ORDER ─│                     │
    │                   │   status=pending│                     │
    │                   │   payment_type=installment            │
    │<── Yêu cầu nộp hồ sơ               │                     │
    │── Nộp hồ sơ ──────────────────────>│                     │
    │   (CCCD, ảnh, thu nhập)            │                     │
    │                   │                │── status=pending    │
    │<── Xác nhận đã nhận hồ sơ ─────────│                     │
    │                                    │                     │
    │         [Admin xem xét hồ sơ]      │                     │
    │                                    │                     │
    │                              TH1: Duyệt                  │
    │                                    │── status=approved   │
    │                                    │── Tạo INSTALLMENT_SCHEDULES (12 kỳ)
    │                                    │── [event] application_approved ──>│
    │                                    │                     │── Push "Hồ sơ đã duyệt"
    │<── Thông báo được duyệt ────────────────────────────────────────────────│
    │                                    │                     │
    │                              TH2: Từ chối               │
    │                                    │── status=rejected   │
    │                                    │── [event] application_rejected ──>│
    │<── Thông báo bị từ chối ────────────────────────────────────────────────│
    │
    │   [Hàng tháng — Cron Job]
    │                                    │── Kiểm tra schedule đến hạn
    │                                    │── [event] schedule_reminder ─────>│
    │<── Push "Nhắc trả kỳ góp tháng X" ──────────────────────────────────────│
```

### 4.4 Luồng Áp Dụng Voucher

```
CUSTOMER        CART SVC        PROMOTION SVC       ORDER SVC
    │               │                 │                 │
    │── Nhập mã ───>│                 │                 │
    │               │── Validate ────>│                 │
    │               │   code, date,   │                 │
    │               │   min_order     │                 │
    │               │<── Valid + giá trị giảm ──────────│
    │<── Hiện discount ─│             │                 │
    │                   │             │                 │
    │── Đặt hàng ──────────────────────────────────────>│
    │               │                 │                 │── Ghi PROMOTION_USAGES
    │               │                 │<── [event] order_created
    │               │                 │── usage_count++
    │<── Xác nhận đơn ────────────────────────────────────
    │
    │   [Nếu đơn bị huỷ]
    │                                 │<── [event] order_cancelled
    │                                 │── Xoá PROMOTION_USAGES
    │                                 │── usage_count--
```

### 4.5 Luồng Flash Sale (Giảm Giá Theo Sản Phẩm)

```
ADMIN           PROMOTION SVC       PRODUCT SVC         NOTIFICATION SVC
    │               │                   │                     │
    │── Tạo flash sale ────────────────>│                     │
    │   type=product_sale               │                     │
    │   variant_ids=[...]               │                     │
    │   start_date, end_date            │                     │
    │               │── Lưu PROMOTIONS + PROMOTION_SCOPES
    │               │                   │                     │
    │   [Đến giờ bắt đầu — Cron Job]   │                     │
    │               │── [event] flash_sale_started ──────────>│
    │               │                   │                     │── Push "Flash sale đang diễn ra!"
    │
    │   [Customer đặt hàng]
    │               │── Kiểm tra variant có trong flash sale không
    │               │── Áp discount vào ORDER_DETAILS.item_discount
```

### 4.6 Luồng Quản Lý Kho

```
ADMIN           INVENTORY SVC       ORDER SVC
    │               │                   │
    │── Nhập kho ──>│                   │
    │   variant_id  │                   │
    │   qty=+100    │                   │
    │               │── quantity += 100 │
    │               │── Ghi INVENTORY_TRANSACTIONS
    │               │   type=import     │
    │                                   │
    │   [Khi có đơn hàng]              │
    │               │<── [event] order_created
    │               │── reserved_qty += qty_ordered
    │               │                   │
    │   [Khi đơn confirmed]            │
    │               │<── [event] payment_success / order_processing
    │               │── quantity -= qty_ordered
    │               │── reserved_qty -= qty_ordered
    │               │── Ghi INVENTORY_TRANSACTIONS
    │               │   type=export_sale│
    │                                   │
    │   [Khi đơn huỷ]                  │
    │               │<── [event] order_cancelled
    │               │── reserved_qty -= qty_ordered (hoàn lại)
```

### 4.7 Luồng Viết Đánh Giá

```
CUSTOMER        ORDER SVC       REVIEW SVC
    │               │               │
    │   [Sau khi đơn completed]     │
    │── Viết đánh giá ──────────────>│
    │               │               │── RPC: Verify order completed?
    │               │<── Yes ────────│
    │               │               │── Kiểm tra chưa review order này
    │               │               │── Lưu REVIEWS
    │<── Đánh giá thành công ────────│
    │
    │   [Admin ẩn đánh giá vi phạm]
    │               │               │── is_visible = false
```

---

## 5. Kiến Trúc Microservices

### 5.1 Sơ Đồ Giao Tiếp Services

```
                              ┌─────────────┐
                              │  API GATEWAY │
                              │  (NestJS)    │
                              └──────┬───────┘
                                     │ HTTP
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
    ┌─────▼──────┐           ┌───────▼──────┐          ┌───────▼──────┐
    │   User     │           │   Product    │          │   Cart       │
    │   Service  │           │   Service    │          │   Service    │
    └─────┬──────┘           └───────┬──────┘          └───────┬──────┘
          │                          │                          │
          └──────────────────────────┼──────────────────────────┘
                                     │
                             ┌───────▼────────┐
                             │   RabbitMQ     │
                             │   Message Bus  │
                             └───────┬────────┘
                                     │
     ┌──────────┬────────────┬───────┴──────┬────────────┬──────────┐
     │          │            │              │            │          │
┌────▼───┐ ┌───▼────┐ ┌─────▼─────┐ ┌─────▼─────┐ ┌───▼───┐ ┌───▼──────────┐
│ Order  │ │Payment │ │Installment│ │Promotion  │ │Notify │ │  Inventory   │
│Service │ │Service │ │ Service   │ │ Service   │ │Service│ │  Service     │
└────────┘ └────────┘ └───────────┘ └───────────┘ └───────┘ └──────────────┘

              ┌─────────────┐         ┌─────────────┐
              │   Review    │         │   Config    │
              │   Service   │         │   Service   │
              └─────────────┘         └─────────────┘
```

### 5.2 RabbitMQ Events

| Publisher | Event | Consumers |
|-----------|-------|-----------|
| Order Service | `order.created` | Inventory, Payment, Promotion, Notification, Installment |
| Order Service | `order.status_changed` | Notification |
| Order Service | `order.cancelled` | Inventory, Promotion, Notification |
| Order Service | `order.completed` | Notification |
| Payment Service | `payment.success` | Order, Notification |
| Payment Service | `payment.failed` | Order, Notification |
| Payment Service | `payment.refunded` | Order, Notification |
| Installment Service | `installment.approved` | Order, Notification |
| Installment Service | `installment.rejected` | Notification |
| Installment Service | `installment.schedule_reminder` | Notification |
| Installment Service | `installment.schedule_overdue` | Notification |
| Promotion Service | `promotion.flash_sale_started` | Notification |
| Inventory Service | `inventory.stock_low` | Notification |

---

## 6. Định Nghĩa API Endpoints

> **Base URL:** `/api/v1`  
> **Auth:** Bearer JWT Token  
> **Roles:** `guest` · `customer` · `staff` · `admin`

---

### 6.1 Auth Service (`/auth`)

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| POST | `/auth/register` | guest | Đăng ký tài khoản |
| POST | `/auth/login` | guest | Đăng nhập, trả về JWT |
| POST | `/auth/logout` | customer | Đăng xuất (invalidate token) |
| POST | `/auth/refresh` | customer | Làm mới access token |
| POST | `/auth/forgot-password` | guest | Gửi email reset mật khẩu |
| POST | `/auth/reset-password` | guest | Đặt lại mật khẩu (qua token email) |
| POST | `/auth/change-password` | customer | Đổi mật khẩu khi đã đăng nhập |

---

### 6.2 User Service (`/users`)

#### Customer — Hồ Sơ Cá Nhân

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| GET | `/users/me` | customer | Lấy thông tin cá nhân |
| PATCH | `/users/me` | customer | Cập nhật thông tin (tên, avatar) |
| GET | `/users/me/addresses` | customer | Danh sách địa chỉ |
| POST | `/users/me/addresses` | customer | Thêm địa chỉ mới |
| PUT | `/users/me/addresses/:id` | customer | Cập nhật địa chỉ |
| DELETE | `/users/me/addresses/:id` | customer | Xoá địa chỉ |
| PATCH | `/users/me/addresses/:id/set-default` | customer | Đặt làm địa chỉ mặc định |
| POST | `/users/me/fcm-tokens` | customer | Đăng ký FCM token thiết bị |
| DELETE | `/users/me/fcm-tokens/:token` | customer | Huỷ đăng ký FCM token |

#### Admin — Quản Lý Người Dùng

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| GET | `/users` | admin | Danh sách người dùng (có phân trang, lọc) |
| GET | `/users/:id` | admin | Chi tiết người dùng |
| PATCH | `/users/:id/toggle-active` | admin | Khoá / Mở khoá tài khoản |
| PATCH | `/users/:id/roles` | admin | Gán / Thay đổi role |

---

### 6.3 Product Service (`/products`, `/categories`, `/models`)

#### Categories

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| GET | `/categories` | guest | Danh sách danh mục (tree structure) |
| GET | `/categories/:slug` | guest | Chi tiết danh mục theo slug |
| POST | `/categories` | admin | Tạo danh mục mới |
| PUT | `/categories/:id` | admin | Cập nhật danh mục |
| DELETE | `/categories/:id` | admin | Xoá danh mục |
| PATCH | `/categories/:id/sort` | admin | Cập nhật thứ tự sắp xếp |

#### Models (Thông Số Kỹ Thuật)

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| GET | `/models` | guest | Danh sách model |
| GET | `/models/:id` | guest | Chi tiết model |
| POST | `/models` | admin | Tạo model mới |
| PUT | `/models/:id` | admin | Cập nhật model |
| DELETE | `/models/:id` | admin | Xoá mềm model |

#### Products

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| GET | `/products` | guest | Danh sách sản phẩm (lọc, sắp xếp, phân trang) |
| GET | `/products/:id` | guest | Chi tiết sản phẩm + variants + ảnh |
| POST | `/products` | admin | Tạo sản phẩm mới |
| PUT | `/products/:id` | admin | Cập nhật sản phẩm |
| DELETE | `/products/:id` | admin | Xoá mềm sản phẩm |
| PATCH | `/products/:id/toggle-active` | admin | Ẩn/hiện sản phẩm |
| POST | `/products/:id/images` | admin | Upload ảnh gallery |
| DELETE | `/products/:id/images/:imageId` | admin | Xoá ảnh gallery |
| PATCH | `/products/:id/images/sort` | admin | Sắp xếp lại ảnh |

#### Product Variants

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| GET | `/products/:id/variants` | guest | Danh sách biến thể của sản phẩm |
| POST | `/products/:id/variants` | admin | Tạo biến thể mới |
| PUT | `/products/:id/variants/:variantId` | admin | Cập nhật biến thể (giá, màu...) |
| DELETE | `/products/:id/variants/:variantId` | admin | Xoá mềm biến thể |
| GET | `/products/:id/variants/:variantId/price-history` | admin | Lịch sử thay đổi giá |

---

### 6.4 Inventory Service (`/inventory`)

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| GET | `/inventory` | admin/staff | Xem tồn kho toàn bộ (phân trang, lọc) |
| GET | `/inventory/:variantId` | admin/staff | Tồn kho của 1 biến thể |
| POST | `/inventory/:variantId/import` | admin/staff | Nhập kho |
| POST | `/inventory/:variantId/adjustment` | admin | Điều chỉnh kho (sai số kiểm kê) |
| GET | `/inventory/:variantId/transactions` | admin/staff | Lịch sử nhập/xuất kho |
| GET | `/inventory/low-stock` | admin/staff | Danh sách biến thể tồn kho thấp |

---

### 6.5 Cart Service (`/cart`)

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| GET | `/cart` | customer/guest | Xem giỏ hàng hiện tại |
| POST | `/cart/items` | customer/guest | Thêm sản phẩm vào giỏ |
| PATCH | `/cart/items/:itemId` | customer/guest | Cập nhật số lượng |
| DELETE | `/cart/items/:itemId` | customer/guest | Xoá sản phẩm khỏi giỏ |
| DELETE | `/cart` | customer | Xoá toàn bộ giỏ hàng |
| POST | `/cart/merge` | customer | Merge guest cart vào user cart sau đăng nhập |

---

### 6.6 Order Service (`/orders`)

#### Customer

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| POST | `/orders` | customer | Tạo đơn hàng mới |
| GET | `/orders/me` | customer | Danh sách đơn của tôi |
| GET | `/orders/me/:id` | customer | Chi tiết đơn hàng |
| POST | `/orders/me/:id/cancel` | customer | Huỷ đơn (chỉ khi pending) |

#### Admin / Staff

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| GET | `/orders` | admin/staff | Danh sách tất cả đơn hàng |
| GET | `/orders/:id` | admin/staff | Chi tiết đơn hàng |
| PATCH | `/orders/:id/status` | admin/staff | Cập nhật trạng thái đơn |
| POST | `/orders/:id/cancel` | admin | Huỷ đơn hàng |

---

### 6.7 Payment Service (`/payments`)

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| POST | `/payments/vnpay/create` | customer | Tạo URL thanh toán VNPay |
| GET | `/payments/vnpay/callback` | guest | Callback từ VNPay (webhook) |
| POST | `/payments/momo/create` | customer | Tạo URL thanh toán MoMo |
| POST | `/payments/momo/callback` | guest | Callback từ MoMo (webhook) |
| GET | `/payments/:orderId` | customer | Xem trạng thái thanh toán đơn |
| POST | `/payments/:orderId/refund` | admin | Hoàn tiền |

---

### 6.8 Installment Service (`/installments`)

#### Gói Trả Góp (Admin cấu hình)

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| GET | `/installments/plans` | guest | Danh sách gói trả góp đang active |
| GET | `/installments/plans/:id` | guest | Chi tiết gói trả góp |
| POST | `/installments/plans` | admin | Tạo gói trả góp mới |
| PUT | `/installments/plans/:id` | admin | Cập nhật gói trả góp |
| PATCH | `/installments/plans/:id/toggle-active` | admin | Kích hoạt/tắt gói |

#### Hồ Sơ Đăng Ký (Customer)

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| POST | `/installments/apply` | customer | Nộp hồ sơ đăng ký trả góp |
| GET | `/installments/me` | customer | Danh sách hồ sơ của tôi |
| GET | `/installments/me/:id` | customer | Chi tiết hồ sơ + lịch trả góp |
| GET | `/installments/me/:id/schedules` | customer | Lịch trả từng kỳ |

#### Quản Lý Hồ Sơ (Admin / Staff)

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| GET | `/installments` | admin/staff | Danh sách tất cả hồ sơ (lọc theo status) |
| GET | `/installments/:id` | admin/staff | Chi tiết hồ sơ |
| PATCH | `/installments/:id/approve` | admin/staff | Duyệt hồ sơ |
| PATCH | `/installments/:id/reject` | admin/staff | Từ chối hồ sơ (kèm lý do) |
| GET | `/installments/:id/schedules` | admin/staff | Lịch trả góp của hồ sơ |
| POST | `/installments/schedules/:scheduleId/pay` | admin/staff | Ghi nhận thanh toán kỳ góp |
| GET | `/installments/overdue` | admin/staff | Danh sách kỳ góp quá hạn |

---

### 6.9 Promotion Service (`/promotions`)

#### Customer

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| POST | `/promotions/validate` | customer | Kiểm tra mã voucher (trả về giá trị giảm) |
| GET | `/promotions/active-sales` | guest | Danh sách flash sale đang diễn ra |

#### Admin

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| GET | `/promotions` | admin | Danh sách tất cả promotion |
| GET | `/promotions/:id` | admin | Chi tiết promotion |
| POST | `/promotions` | admin | Tạo voucher hoặc flash sale |
| PUT | `/promotions/:id` | admin | Cập nhật promotion |
| DELETE | `/promotions/:id` | admin | Xoá promotion |
| PATCH | `/promotions/:id/toggle-active` | admin | Bật/tắt promotion |
| POST | `/promotions/:id/scopes` | admin | Gắn sản phẩm vào promotion |
| DELETE | `/promotions/:id/scopes/:scopeId` | admin | Gỡ sản phẩm khỏi promotion |
| GET | `/promotions/:id/usages` | admin | Lịch sử sử dụng voucher |

---

### 6.10 Notification Service (`/notifications`)

#### Customer

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| GET | `/notifications/me` | customer | Danh sách thông báo (có phân trang) |
| GET | `/notifications/me/unread-count` | customer | Số thông báo chưa đọc |
| PATCH | `/notifications/me/:id/read` | customer | Đánh dấu đã đọc |
| PATCH | `/notifications/me/read-all` | customer | Đánh dấu tất cả đã đọc |

#### Admin

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| GET | `/notifications/templates` | admin | Danh sách template thông báo |
| PUT | `/notifications/templates/:type` | admin | Cập nhật nội dung template |
| POST | `/notifications/broadcast` | admin | Gửi thông báo hàng loạt đến tất cả user |
| POST | `/notifications/send` | admin | Gửi thông báo đến user cụ thể |

---

### 6.11 Review Service (`/reviews`, `/comments`)

#### Reviews

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| GET | `/reviews/products/:productId` | guest | Danh sách đánh giá của sản phẩm |
| GET | `/reviews/products/:productId/stats` | guest | Thống kê rating (trung bình, số lượng theo sao) |
| POST | `/reviews` | customer | Tạo đánh giá (kèm ảnh) |
| GET | `/reviews/me` | customer | Đánh giá của tôi |
| GET | `/reviews` | admin | Tất cả đánh giá (lọc theo sản phẩm, rating) |
| PATCH | `/reviews/:id/visibility` | admin | Ẩn/hiện đánh giá |

#### Comments

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| GET | `/comments/products/:productId` | guest | Bình luận của sản phẩm (có reply lồng nhau) |
| POST | `/comments` | customer | Đăng bình luận / đặt câu hỏi |
| POST | `/comments/:id/reply` | customer/admin | Trả lời bình luận |
| PUT | `/comments/:id` | customer | Chỉnh sửa bình luận của mình |
| DELETE | `/comments/:id` | customer/admin | Xoá bình luận |
| PATCH | `/comments/:id/visibility` | admin | Ẩn/hiện bình luận |

---

### 6.12 Config Service (`/config`)

#### Settings

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| GET | `/config/settings` | guest | Lấy tất cả cấu hình public (hotline, địa chỉ, mạng xã hội) |
| GET | `/config/settings/:key` | guest | Lấy cấu hình theo key |
| GET | `/config/settings/group/:group` | admin | Lấy tất cả setting của một nhóm |
| PUT | `/config/settings/:key` | admin | Cập nhật cấu hình |

#### Banners

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| GET | `/config/banners` | guest | Danh sách banner đang active (theo vị trí) |
| GET | `/config/banners/all` | admin | Tất cả banner (kể cả inactive) |
| POST | `/config/banners` | admin | Tạo banner mới |
| PUT | `/config/banners/:id` | admin | Cập nhật banner |
| DELETE | `/config/banners/:id` | admin | Xoá banner |
| PATCH | `/config/banners/sort` | admin | Sắp xếp lại thứ tự banner |

---

### 6.13 Search (qua Product Service)

| Method | Endpoint | Auth | Mô Tả |
|--------|----------|------|-------|
| GET | `/search?q=&category=&minPrice=&maxPrice=&color=&storage=&sort=` | guest | Tìm kiếm sản phẩm toàn hệ thống |

**Query Parameters:**

| Param | Kiểu | Mô Tả |
|-------|------|-------|
| `q` | string | Từ khoá tìm kiếm |
| `category` | string | Slug danh mục |
| `minPrice` | number | Giá tối thiểu |
| `maxPrice` | number | Giá tối đa |
| `color` | string | Màu sắc |
| `storage` | number | Dung lượng (GB) |
| `sort` | string | `price_asc` \| `price_desc` \| `newest` \| `best_seller` |
| `page` | number | Trang (mặc định 1) |
| `limit` | number | Số item/trang (mặc định 20) |

---

### 6.14 Tổng Hợp Response Format

```json
// Success Response
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Sản phẩm không tồn tại",
    "statusCode": 404
  }
}
```

### 6.15 HTTP Status Codes Chuẩn

| Code | Ý Nghĩa | Dùng Khi |
|------|---------|---------|
| 200 | OK | GET, PATCH, DELETE thành công |
| 201 | Created | POST tạo mới thành công |
| 400 | Bad Request | Dữ liệu đầu vào không hợp lệ |
| 401 | Unauthorized | Chưa đăng nhập / Token hết hạn |
| 403 | Forbidden | Không đủ quyền |
| 404 | Not Found | Không tìm thấy resource |
| 409 | Conflict | Trùng lặp dữ liệu (VD: email đã tồn tại) |
| 422 | Unprocessable | Validate logic thất bại (VD: voucher hết hạn) |
| 500 | Server Error | Lỗi server nội bộ |

---

*Tài liệu này được tạo tự động dựa trên thiết kế database và mô tả dự án. Cập nhật theo tiến độ phát triển.*
