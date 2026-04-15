# Inventory Service — Tài Liệu Thiết Kế Chi Tiết

> **Dự án:** iLuxury Apple Shop  
> **Service:** Inventory Service  
> **Stack:** NestJS · Prisma · MySQL · RabbitMQ  
> **Phiên bản:** 1.0  
> **Ngày:** 2026

---

## Mục Lục

1. [Tổng Quan Service](#1-tổng-quan-service)
2. [Kiến Trúc & Giao Tiếp](#2-kiến-trúc--giao-tiếp)
3. [Database Design](#3-database-design)
4. [Business Logic](#4-business-logic)
5. [API Endpoints](#5-api-endpoints)
6. [RabbitMQ Events](#6-rabbitmq-events)
7. [Cấu Trúc Thư Mục](#7-cấu-trúc-thư-mục)
8. [Modules & Classes](#8-modules--classes)
9. [DTOs](#9-dtos)
10. [Error Handling](#10-error-handling)
11. [Guards & Authorization](#11-guards--authorization)
12. [Configuration](#12-configuration)
13. [Testing Strategy](#13-testing-strategy)

---

## 1. Tổng Quan Service

### 1.1 Mục Đích

Inventory Service chịu trách nhiệm **toàn bộ vòng đời tồn kho** của hệ thống:

- Theo dõi số lượng tồn kho theo từng `product_variant`
- Quản lý `reserved_quantity` để tránh **oversell** (đặt hàng vượt tồn kho)
- Ghi nhận mọi thay đổi tồn kho vào audit trail (`INVENTORY_TRANSACTIONS`)
- Nhận sự kiện từ Order Service và tự động cập nhật tồn kho
- Phát cảnh báo tồn kho thấp đến Notification Service

### 1.2 Phạm Vi

| Trong scope | Ngoài scope |
|-------------|-------------|
| Tồn kho theo variant | Thông tin sản phẩm (Product Service) |
| Reserve / deduct / release | Giá bán / giá vốn (Product Service) |
| Nhập kho, điều chỉnh | Quản lý đơn hàng (Order Service) |
| Audit trail thay đổi | Thông tin user (User Service) |
| Cảnh báo tồn kho thấp | Gửi notification (Notification Service) |

### 1.3 Actors

| Actor | Hành động |
|-------|----------|
| **Admin** | Nhập kho, điều chỉnh kho, xem báo cáo đầy đủ |
| **Staff** | Nhập kho, xem tồn kho, xem lịch sử |
| **Order Service** | Gửi event để reserve / deduct / release kho |
| **Product Service** | Gửi event khi tạo variant mới |
| **Notification Service** | Nhận event stock_low để gửi cảnh báo |

---

## 2. Kiến Trúc & Giao Tiếp

### 2.1 Vị Trí Trong Hệ Thống

```
┌────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY                                │
│                     (Auth middleware, Rate limit)                   │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ HTTP (REST)
                    ┌──────────▼──────────┐
                    │  INVENTORY SERVICE   │
                    │  Port: 3003          │
                    │  DB:   db_inventory  │
                    └──────────┬──────────┘
                               │
              ┌────────────────▼────────────────┐
              │         RabbitMQ Bus             │
              │    Exchange: apple_shop          │
              └───┬──────────┬──────────┬───────┘
                  │          │          │
          ┌───────▼──┐ ┌─────▼───┐ ┌──▼────────────┐
          │  ORDER   │ │PRODUCT  │ │ NOTIFICATION  │
          │ SERVICE  │ │SERVICE  │ │   SERVICE     │
          └──────────┘ └─────────┘ └───────────────┘
```

### 2.2 Giao Tiếp

| Loại | Với service | Mô tả |
|------|------------|-------|
| **CONSUME** (RabbitMQ) | Order Service | `order.created` → reserve stock |
| **CONSUME** (RabbitMQ) | Order Service | `order.confirmed` → deduct stock |
| **CONSUME** (RabbitMQ) | Order Service | `order.cancelled` → release reserved |
| **CONSUME** (RabbitMQ) | Product Service | `product.variant_created` → tạo inventory record |
| **PUBLISH** (RabbitMQ) | Notification Service | `inventory.stock_low` |
| **PUBLISH** (RabbitMQ) | Product Service | `inventory.stock_updated` (sync cache) |
| **HTTP** (REST) | API Gateway | Các endpoint quản lý kho |
| **HTTP** (RPC) | Product Service | GET variant info để validate |
| **HTTP** (RPC) | User Service | Validate `created_by` khi nhập kho |

### 2.3 Luồng Reserve → Deduct

```
ORDER SERVICE                    INVENTORY SERVICE
     │                                  │
     │── [event] order.created ────────>│
     │   payload: { order_id,           │
     │     items: [{variant_id, qty}] } │
     │                                  │── Validate: quantity >= qty?
     │                                  │── reserved_quantity += qty
     │                                  │── Ghi INVENTORY_TRANSACTIONS
     │                                  │   type: 'reserve'
     │                                  │
     │── [event] order.confirmed ──────>│  (sau khi payment OK)
     │   payload: { order_id }          │
     │                                  │── quantity -= qty
     │                                  │── reserved_quantity -= qty
     │                                  │── Ghi INVENTORY_TRANSACTIONS
     │                                  │   type: 'export_sale'
     │                                  │── Check: quantity < threshold?
     │                                  │── [event] inventory.stock_low
     │
     │── [event] order.cancelled ──────>│
     │   payload: { order_id }          │
     │                                  │── reserved_quantity -= qty
     │                                  │── Ghi INVENTORY_TRANSACTIONS
     │                                  │   type: 'release_reserve'
```

---

## 3. Database Design

### 3.1 Schema — Prisma

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model Inventory {
  id               String   @id @default(uuid()) @db.Char(36)
  productVariantId String   @unique @map("product_variant_id") @db.Char(36)
  // [REF: db_products.PRODUCT_VARIANTS.id] — không có @relation

  quantity         Int      @default(0)
  // Số lượng thực tế trong kho

  reservedQuantity Int      @default(0) @map("reserved_quantity")
  // Số lượng đã được đặt nhưng chưa xác nhận thanh toán

  lowStockThreshold Int     @default(5) @map("low_stock_threshold")
  // Ngưỡng cảnh báo tồn kho thấp (admin cài đặt per-variant)

  updatedAt        DateTime @updatedAt @map("updated_at")

  transactions InventoryTransaction[]

  @@index([productVariantId])
  @@map("INVENTORY")
}

model InventoryTransaction {
  id               String               @id @default(uuid()) @db.Char(36)
  productVariantId String               @map("product_variant_id") @db.Char(36)
  // [REF: db_products.PRODUCT_VARIANTS.id]

  type             InventoryTxnType
  quantityChange   Int                  @map("quantity_change")
  // Dương = nhập/hoàn, Âm = xuất/reserve

  quantityBefore   Int                  @map("quantity_before")
  // Snapshot số lượng TRƯỚC khi thay đổi

  quantityAfter    Int                  @map("quantity_after")
  // Snapshot số lượng SAU khi thay đổi

  referenceId      String?              @map("reference_id") @db.Char(36)
  // order_id (khi export_sale, reserve, release)
  // import_bill_id (khi import)

  referenceType    TxnReferenceType?    @map("reference_type")
  // Loại reference để biết referenceId thuộc service nào

  note             String?              @db.VarChar(500)
  createdBy        String               @map("created_by") @db.Char(36)
  // [REF: db_users.USERS.id]

  createdAt        DateTime             @default(now()) @map("created_at")

  inventory Inventory @relation(fields: [productVariantId], references: [productVariantId])

  @@index([productVariantId, createdAt])
  @@index([type])
  @@index([referenceId])
  @@map("INVENTORY_TRANSACTIONS")
}

enum InventoryTxnType {
  import           // Nhập kho từ nhà cung cấp
  export_sale      // Xuất kho do bán hàng (order confirmed)
  export_return    // Xuất kho do trả lại nhà cung cấp
  reserve          // Reserve khi có đơn pending
  release_reserve  // Giải phóng reserve khi đơn bị huỷ
  adjustment       // Điều chỉnh thủ công (kiểm kê)
}

enum TxnReferenceType {
  order
  import_bill
  manual
}
```

### 3.2 Giải Thích Thiết Kế

#### `quantity` vs `reservedQuantity`

```
Tổng tồn kho thực tế:   quantity = 10
Đang được đặt hàng:      reservedQuantity = 3
Số lượng có thể bán:     availableQuantity = quantity - reservedQuantity = 7

Khi customer đặt thêm 4:
  → 7 < 4? → Không (đủ hàng)
  → reservedQuantity = 3 + 4 = 7
  → quantity vẫn = 10 (chưa xuất kho thực tế)

Khi customer đặt thêm 4 nữa:
  → availableQuantity = 10 - 7 = 3 < 4? → Có (không đủ hàng)
  → Trả lỗi: INSUFFICIENT_STOCK
```

#### `lowStockThreshold`

```
Mỗi variant có ngưỡng cảnh báo riêng:
  iPhone 16 Pro Max:     threshold = 3  (sản phẩm cao cấp, ít hàng)
  Cáp USB-C:             threshold = 20 (phụ kiện, cần luôn có sẵn)
  AirPods Pro:           threshold = 5

Sau mỗi lần deduct:
  if (quantity <= lowStockThreshold) → publish inventory.stock_low
```

### 3.3 Indexes

| Index | Cột | Mục Đích |
|-------|-----|---------|
| `idx_inv_variant` | `product_variant_id` | Tìm nhanh tồn kho theo variant |
| `idx_inv_txn_variant_date` | `(product_variant_id, created_at)` | Lịch sử theo variant, có range filter |
| `idx_inv_txn_type` | `type` | Filter theo loại giao dịch |
| `idx_inv_txn_ref` | `reference_id` | Tìm giao dịch theo order_id |

---

## 4. Business Logic

### 4.1 Nhập Kho (`import`)

```
Input:  product_variant_id, quantity, note, created_by
Output: InventoryTransaction record

Rules:
  1. Validate product_variant_id tồn tại (gọi Product Service RPC)
  2. Validate created_by có role admin/staff
  3. quantity > 0
  4. Nếu chưa có INVENTORY record → tạo mới với quantity = 0
  5. quantity += quantity_change
  6. Ghi INVENTORY_TRANSACTIONS type=import
  7. Publish event inventory.stock_updated
```

### 4.2 Reserve Stock (`reserve`)

```
Input:  order_id, items: [{product_variant_id, quantity}]
Output: success | InsufficientStockError

Rules:
  1. Với mỗi item:
     a. availableQty = quantity - reservedQuantity
     b. Nếu availableQty < requested_qty → throw INSUFFICIENT_STOCK
  2. Nếu tất cả items đều OK → thực hiện trong một transaction:
     a. reserved_quantity += qty (cho từng item)
     b. Ghi INVENTORY_TRANSACTIONS type=reserve
  3. ALL-OR-NOTHING: nếu bất kỳ item nào không đủ → rollback toàn bộ

⚠️ Race condition prevention:
  - Dùng database transaction với SELECT FOR UPDATE
  - Prisma: prisma.$transaction([...])
```

### 4.3 Deduct Stock (`export_sale`)

```
Input:  order_id (từ event order.confirmed)
Output: void

Rules:
  1. Tìm tất cả transactions type=reserve với reference_id=order_id
  2. Với mỗi transaction:
     a. quantity -= qty
     b. reserved_quantity -= qty
     c. Ghi INVENTORY_TRANSACTIONS type=export_sale
  3. Kiểm tra lowStockThreshold:
     if (quantity <= lowStockThreshold) → publish inventory.stock_low
```

### 4.4 Release Reserve (`release_reserve`)

```
Input:  order_id (từ event order.cancelled)
Output: void

Rules:
  1. Tìm transactions type=reserve với reference_id=order_id
  2. reserved_quantity -= qty (cho từng item)
  3. Ghi INVENTORY_TRANSACTIONS type=release_reserve
  4. Idempotent: nếu không tìm thấy reserve → bỏ qua (log warning)
```

### 4.5 Điều Chỉnh Kho (`adjustment`)

```
Input:  product_variant_id, quantity_after, note, created_by
Output: InventoryTransaction record

Rules:
  1. Chỉ admin mới được thực hiện
  2. quantity_change = quantity_after - quantity_before
  3. quantity_change có thể âm hoặc dương
  4. Bắt buộc có note (lý do điều chỉnh)
  5. Ghi INVENTORY_TRANSACTIONS type=adjustment
```

### 4.6 Cảnh Báo Tồn Kho Thấp

```
Trigger: Sau mỗi lần export_sale hoặc adjustment giảm quantity
Logic:
  if (inventory.quantity <= inventory.lowStockThreshold) {
    publish('inventory.stock_low', {
      productVariantId,
      currentQuantity: inventory.quantity,
      threshold: inventory.lowStockThreshold,
      timestamp: new Date()
    })
  }

Cooldown: Chỉ publish 1 lần / 24h cho cùng 1 variant (dùng cache)
```

---

## 5. API Endpoints

**Base URL:** `/api/v1/inventory`  
**Auth:** Bearer JWT (validated by API Gateway)

---

### 5.1 `GET /inventory`

Lấy danh sách tồn kho toàn bộ.

**Quyền:** `admin`, `staff`

**Query Parameters:**

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `page` | number | 1 | Trang |
| `limit` | number | 20 | Số item/trang (max 100) |
| `variantId` | string | - | Filter theo variant ID |
| `lowStockOnly` | boolean | false | Chỉ hiện item tồn kho thấp |
| `zeroStockOnly` | boolean | false | Chỉ hiện item hết hàng |
| `sortBy` | string | `updatedAt` | `quantity` \| `reservedQuantity` \| `updatedAt` |
| `sortOrder` | string | `desc` | `asc` \| `desc` |

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "productVariantId": "uuid",
      "quantity": 15,
      "reservedQuantity": 3,
      "availableQuantity": 12,
      "lowStockThreshold": 5,
      "isLowStock": false,
      "updatedAt": "2026-03-31T07:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 180,
    "totalPages": 9
  }
}
```

---

### 5.2 `GET /inventory/:variantId`

Lấy tồn kho của 1 variant.

**Quyền:** `admin`, `staff`

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "productVariantId": "uuid",
    "quantity": 15,
    "reservedQuantity": 3,
    "availableQuantity": 12,
    "lowStockThreshold": 5,
    "isLowStock": false,
    "updatedAt": "2026-03-31T07:00:00.000Z"
  }
}
```

**Response `404`:**

```json
{
  "success": false,
  "error": {
    "code": "INVENTORY_NOT_FOUND",
    "message": "Không tìm thấy thông tin tồn kho cho variant này"
  }
}
```

---

### 5.3 `POST /inventory/:variantId/import`

Nhập kho cho một variant.

**Quyền:** `admin`, `staff`

**Request Body:**

```json
{
  "quantity": 50,
  "note": "Nhập hàng từ Apple Distribution Việt Nam",
  "referenceId": "IMPORT-BILL-2026-001"
}
```

**Validation:**

| Field | Rule |
|-------|------|
| `quantity` | Required, integer, min: 1, max: 10000 |
| `note` | Optional, maxLength: 500 |
| `referenceId` | Optional, maxLength: 100 |

**Response `201`:**

```json
{
  "success": true,
  "data": {
    "transaction": {
      "id": "uuid",
      "productVariantId": "uuid",
      "type": "import",
      "quantityChange": 50,
      "quantityBefore": 10,
      "quantityAfter": 60,
      "referenceId": "IMPORT-BILL-2026-001",
      "referenceType": "import_bill",
      "note": "Nhập hàng từ Apple Distribution Việt Nam",
      "createdBy": "uuid-user",
      "createdAt": "2026-03-31T07:00:00.000Z"
    },
    "inventory": {
      "quantity": 60,
      "reservedQuantity": 3,
      "availableQuantity": 57
    }
  }
}
```

---

### 5.4 `POST /inventory/:variantId/adjustment`

Điều chỉnh tồn kho (kiểm kê thực tế).

**Quyền:** `admin` only

**Request Body:**

```json
{
  "quantityAfter": 45,
  "note": "Kiểm kê tháng 3/2026 — phát hiện lệch 2 chiếc do hư hỏng"
}
```

**Validation:**

| Field | Rule |
|-------|------|
| `quantityAfter` | Required, integer, min: 0, max: 99999 |
| `note` | Required, minLength: 10, maxLength: 500 |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "transaction": {
      "id": "uuid",
      "type": "adjustment",
      "quantityChange": -2,
      "quantityBefore": 47,
      "quantityAfter": 45,
      "note": "Kiểm kê tháng 3/2026 — phát hiện lệch 2 chiếc do hư hỏng",
      "createdBy": "uuid-admin",
      "createdAt": "2026-03-31T07:00:00.000Z"
    }
  }
}
```

---

### 5.5 `PATCH /inventory/:variantId/threshold`

Cập nhật ngưỡng cảnh báo tồn kho thấp.

**Quyền:** `admin` only

**Request Body:**

```json
{
  "lowStockThreshold": 10
}
```

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "productVariantId": "uuid",
    "lowStockThreshold": 10,
    "updatedAt": "2026-03-31T07:00:00.000Z"
  }
}
```

---

### 5.6 `GET /inventory/:variantId/transactions`

Lịch sử nhập/xuất kho của một variant.

**Quyền:** `admin`, `staff`

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|-------|
| `page` | number | Trang (default: 1) |
| `limit` | number | Số bản ghi (default: 20, max: 100) |
| `type` | string | Filter theo loại: `import` \| `export_sale` \| `reserve` \| `adjustment` \| ... |
| `fromDate` | ISO string | Từ ngày |
| `toDate` | ISO string | Đến ngày |

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "productVariantId": "uuid",
      "type": "import",
      "quantityChange": 50,
      "quantityBefore": 10,
      "quantityAfter": 60,
      "referenceId": "IMPORT-BILL-2026-001",
      "referenceType": "import_bill",
      "note": "Nhập hàng Apple Distribution",
      "createdBy": "uuid-user",
      "createdAt": "2026-03-31T07:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

### 5.7 `GET /inventory/low-stock`

Danh sách các variant có tồn kho thấp hoặc hết hàng.

**Quyền:** `admin`, `staff`

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|-------|
| `includeZero` | boolean | Bao gồm cả item hết hàng (default: true) |
| `page` | number | Trang |
| `limit` | number | Số item/trang |

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "productVariantId": "uuid",
      "quantity": 2,
      "reservedQuantity": 1,
      "availableQuantity": 1,
      "lowStockThreshold": 5,
      "isOutOfStock": false
    }
  ],
  "meta": { "total": 12, ... }
}
```

---

### 5.8 `POST /inventory/bulk-check`

Kiểm tra tồn kho cho nhiều variant cùng lúc (dùng nội bộ cho Cart/Order Service qua HTTP).

**Quyền:** `internal` (service-to-service, dùng service token)

**Request Body:**

```json
{
  "items": [
    { "productVariantId": "uuid-1", "quantity": 2 },
    { "productVariantId": "uuid-2", "quantity": 1 }
  ]
}
```

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "allAvailable": false,
    "items": [
      {
        "productVariantId": "uuid-1",
        "requested": 2,
        "available": 5,
        "sufficient": true
      },
      {
        "productVariantId": "uuid-2",
        "requested": 1,
        "available": 0,
        "sufficient": false
      }
    ]
  }
}
```

---

## 6. RabbitMQ Events

### 6.1 Exchange & Queue Setup

```typescript
// rabbitmq.config.ts
export const RABBITMQ_CONFIG = {
  exchange:     'apple_shop',
  exchangeType: 'topic',

  queues: {
    inventoryOrderEvents:   'inventory.order_events',
    inventoryProductEvents: 'inventory.product_events',
  },

  routingKeys: {
    // CONSUME
    orderCreated:       'order.created',
    orderConfirmed:     'order.confirmed',
    orderCancelled:     'order.cancelled',
    variantCreated:     'product.variant_created',

    // PUBLISH
    stockLow:           'inventory.stock_low',
    stockUpdated:       'inventory.stock_updated',
  }
}
```

---

### 6.2 CONSUME — `order.created`

**Publisher:** Order Service  
**Mục đích:** Reserve tồn kho khi đơn hàng vừa tạo

**Payload:**

```typescript
interface OrderCreatedPayload {
  orderId:   string;
  userId:    string;
  createdAt: string; // ISO 8601
  items: Array<{
    productVariantId: string;
    quantity:         number;
    price:            number;
  }>;
}
```

**Xử lý:**

```typescript
async handleOrderCreated(payload: OrderCreatedPayload): Promise<void> {
  // 1. Validate tất cả items có đủ hàng không
  const checks = await this.inventoryService.bulkCheck(payload.items);
  if (!checks.allAvailable) {
    // Publish order.reserve_failed để Order Service huỷ đơn
    await this.publisher.publish('order.reserve_failed', {
      orderId: payload.orderId,
      insufficientItems: checks.items.filter(i => !i.sufficient)
    });
    return;
  }

  // 2. Reserve trong DB transaction
  await this.inventoryService.reserveStock(payload.orderId, payload.items);
}
```

**Dead Letter:** Nếu xử lý thất bại 3 lần → chuyển vào `inventory.order_events.dlq`, log error, alert admin.

---

### 6.3 CONSUME — `order.confirmed`

**Publisher:** Order Service (sau khi payment thành công)  
**Mục đích:** Deduct tồn kho thực tế

**Payload:**

```typescript
interface OrderConfirmedPayload {
  orderId:     string;
  confirmedAt: string;
}
```

**Xử lý:**

```typescript
async handleOrderConfirmed(payload: OrderConfirmedPayload): Promise<void> {
  await this.inventoryService.deductStock(payload.orderId);
  // Bên trong deductStock: check lowStockThreshold → publish stock_low nếu cần
}
```

---

### 6.4 CONSUME — `order.cancelled`

**Publisher:** Order Service  
**Mục đích:** Giải phóng reserved quantity

**Payload:**

```typescript
interface OrderCancelledPayload {
  orderId:     string;
  cancelledAt: string;
  reason:      string;
}
```

**Xử lý:**

```typescript
async handleOrderCancelled(payload: OrderCancelledPayload): Promise<void> {
  await this.inventoryService.releaseReserve(payload.orderId);
  // Idempotent: không throw nếu không tìm thấy reserve
}
```

---

### 6.5 CONSUME — `product.variant_created`

**Publisher:** Product Service  
**Mục đích:** Tự động tạo INVENTORY record với quantity = 0 khi có variant mới

**Payload:**

```typescript
interface VariantCreatedPayload {
  variantId:  string;
  productId:  string;
  sku:        string;
  createdAt:  string;
}
```

**Xử lý:**

```typescript
async handleVariantCreated(payload: VariantCreatedPayload): Promise<void> {
  await this.prisma.inventory.upsert({
    where:  { productVariantId: payload.variantId },
    create: { productVariantId: payload.variantId, quantity: 0, reservedQuantity: 0 },
    update: {},  // Không update nếu đã tồn tại (idempotent)
  });
}
```

---

### 6.6 PUBLISH — `inventory.stock_low`

**Consumer:** Notification Service  
**Trigger:** Khi `quantity <= lowStockThreshold` sau deduct hoặc adjustment

**Payload:**

```typescript
interface StockLowPayload {
  productVariantId: string;
  currentQuantity:  number;
  threshold:        number;
  isOutOfStock:     boolean;  // quantity === 0
  timestamp:        string;
}
```

---

### 6.7 PUBLISH — `inventory.stock_updated`

**Consumer:** Product Service (sync cache tồn kho cho trang product)  
**Trigger:** Sau mọi thay đổi quantity (import, deduct, adjustment)

**Payload:**

```typescript
interface StockUpdatedPayload {
  productVariantId:  string;
  quantity:          number;
  reservedQuantity:  number;
  availableQuantity: number;
  timestamp:         string;
}
```

---

## 7. Cấu Trúc Thư Mục

```
inventory-service/
├── src/
│   ├── main.ts                         # Bootstrap NestJS app
│   ├── app.module.ts                   # Root module
│   │
│   ├── config/
│   │   ├── app.config.ts               # PORT, NODE_ENV
│   │   ├── database.config.ts          # DATABASE_URL
│   │   └── rabbitmq.config.ts          # AMQP_URL, exchange, queues
│   │
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   ├── prisma.service.ts           # PrismaClient wrapper
│   │   └── schema.prisma
│   │
│   ├── inventory/
│   │   ├── inventory.module.ts
│   │   ├── inventory.controller.ts     # REST endpoints
│   │   ├── inventory.service.ts        # Business logic
│   │   ├── inventory.repository.ts     # Prisma queries
│   │   ├── dto/
│   │   │   ├── import-stock.dto.ts
│   │   │   ├── adjustment.dto.ts
│   │   │   ├── update-threshold.dto.ts
│   │   │   ├── bulk-check.dto.ts
│   │   │   └── query-inventory.dto.ts
│   │   └── interfaces/
│   │       ├── inventory.interface.ts
│   │       └── transaction.interface.ts
│   │
│   ├── consumers/                      # RabbitMQ message consumers
│   │   ├── consumers.module.ts
│   │   ├── order-events.consumer.ts    # order.created / confirmed / cancelled
│   │   └── product-events.consumer.ts # product.variant_created
│   │
│   ├── publishers/                     # RabbitMQ message publishers
│   │   ├── publishers.module.ts
│   │   └── inventory.publisher.ts
│   │
│   ├── common/
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts
│   │   │   └── current-user.decorator.ts
│   │   ├── interceptors/
│   │   │   └── response.interceptor.ts   # Wrap response theo chuẩn
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   └── constants/
│   │       ├── roles.constant.ts
│   │       └── inventory.constant.ts
│   │
│   └── health/
│       ├── health.module.ts
│       └── health.controller.ts        # GET /health (liveness/readiness)
│
├── test/
│   ├── unit/
│   │   ├── inventory.service.spec.ts
│   │   └── consumers/
│   │       └── order-events.consumer.spec.ts
│   └── e2e/
│       └── inventory.e2e-spec.ts
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── .env
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 8. Modules & Classes

### 8.1 `InventoryModule`

```typescript
@Module({
  imports: [
    PrismaModule,
    PublishersModule,
  ],
  controllers: [InventoryController],
  providers:   [InventoryService, InventoryRepository],
  exports:     [InventoryService],
})
export class InventoryModule {}
```

---

### 8.2 `InventoryController`

```typescript
@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {

  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles(Role.ADMIN, Role.STAFF)
  findAll(@Query() query: QueryInventoryDto) { ... }

  @Get('low-stock')
  @Roles(Role.ADMIN, Role.STAFF)
  getLowStock(@Query() query: QueryLowStockDto) { ... }

  @Get(':variantId')
  @Roles(Role.ADMIN, Role.STAFF)
  findOne(@Param('variantId') variantId: string) { ... }

  @Get(':variantId/transactions')
  @Roles(Role.ADMIN, Role.STAFF)
  getTransactions(
    @Param('variantId') variantId: string,
    @Query() query: QueryTransactionsDto,
  ) { ... }

  @Post(':variantId/import')
  @Roles(Role.ADMIN, Role.STAFF)
  importStock(
    @Param('variantId') variantId: string,
    @Body() dto: ImportStockDto,
    @CurrentUser() user: UserPayload,
  ) { ... }

  @Post(':variantId/adjustment')
  @Roles(Role.ADMIN)
  adjustment(
    @Param('variantId') variantId: string,
    @Body() dto: AdjustmentDto,
    @CurrentUser() user: UserPayload,
  ) { ... }

  @Patch(':variantId/threshold')
  @Roles(Role.ADMIN)
  updateThreshold(
    @Param('variantId') variantId: string,
    @Body() dto: UpdateThresholdDto,
  ) { ... }

  @Post('bulk-check')
  @UseGuards(ServiceAuthGuard)  // internal service-to-service
  bulkCheck(@Body() dto: BulkCheckDto) { ... }
}
```

---

### 8.3 `InventoryService`

```typescript
@Injectable()
export class InventoryService {

  constructor(
    private readonly repo: InventoryRepository,
    private readonly prisma: PrismaService,
    private readonly publisher: InventoryPublisher,
  ) {}

  // ── Public REST methods ─────────────────────────────────────

  async findAll(query: QueryInventoryDto): Promise<PaginatedResult<Inventory>> { ... }

  async findOne(variantId: string): Promise<InventoryWithAvailable> { ... }

  async getTransactions(variantId: string, query: QueryTransactionsDto): Promise<PaginatedResult<InventoryTransaction>> { ... }

  async getLowStock(query: QueryLowStockDto): Promise<PaginatedResult<Inventory>> { ... }

  async importStock(variantId: string, dto: ImportStockDto, userId: string): Promise<ImportResult> {
    return this.prisma.$transaction(async (tx) => {
      const inv = await this.repo.findOrCreateByVariantId(variantId, tx);
      const before = inv.quantity;
      const after  = before + dto.quantity;

      await this.repo.updateQuantity(variantId, after, tx);
      const txn = await this.repo.createTransaction({
        productVariantId: variantId,
        type:             'import',
        quantityChange:   dto.quantity,
        quantityBefore:   before,
        quantityAfter:    after,
        referenceId:      dto.referenceId ?? null,
        referenceType:    dto.referenceId ? 'import_bill' : null,
        note:             dto.note ?? null,
        createdBy:        userId,
      }, tx);

      await this.publisher.publishStockUpdated(variantId, after, inv.reservedQuantity);
      return { transaction: txn, inventory: { quantity: after, ... } };
    });
  }

  async adjustment(variantId: string, dto: AdjustmentDto, userId: string): Promise<AdjustmentResult> {
    return this.prisma.$transaction(async (tx) => {
      const inv    = await this.repo.findOneOrThrow(variantId, tx);
      const before = inv.quantity;
      const change = dto.quantityAfter - before;

      await this.repo.updateQuantity(variantId, dto.quantityAfter, tx);
      const txn = await this.repo.createTransaction({ type: 'adjustment', quantityChange: change, ... }, tx);

      if (dto.quantityAfter <= inv.lowStockThreshold) {
        await this.publisher.publishStockLow(variantId, dto.quantityAfter, inv.lowStockThreshold);
      }

      return { transaction: txn };
    });
  }

  async updateThreshold(variantId: string, threshold: number): Promise<void> { ... }

  // ── Internal methods (called by consumers) ──────────────────

  async reserveStock(orderId: string, items: OrderItem[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const inv = await tx.inventory.findUniqueOrThrow({
          where: { productVariantId: item.productVariantId }
        });

        const available = inv.quantity - inv.reservedQuantity;
        if (available < item.quantity) {
          throw new InsufficientStockException(item.productVariantId, available, item.quantity);
        }

        await tx.inventory.update({
          where: { productVariantId: item.productVariantId },
          data:  { reservedQuantity: { increment: item.quantity } },
        });

        await tx.inventoryTransaction.create({
          data: {
            productVariantId: item.productVariantId,
            type:             'reserve',
            quantityChange:   -item.quantity,
            quantityBefore:   inv.quantity,
            quantityAfter:    inv.quantity,  // qty chưa đổi, chỉ reserved đổi
            referenceId:      orderId,
            referenceType:    'order',
            createdBy:        'system',
          }
        });
      }
    });
  }

  async deductStock(orderId: string): Promise<void> { ... }

  async releaseReserve(orderId: string): Promise<void> { ... }

  async bulkCheck(items: Array<{productVariantId: string; quantity: number}>): Promise<BulkCheckResult> { ... }
}
```

---

### 8.4 `OrderEventsConsumer`

```typescript
@Injectable()
export class OrderEventsConsumer implements OnModuleInit {

  constructor(
    private readonly inventoryService: InventoryService,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  onModuleInit() {
    this.amqpConnection.createSubscriber(
      (msg: OrderCreatedPayload) => this.handleOrderCreated(msg),
      {
        exchange:   'apple_shop',
        routingKey: 'order.created',
        queue:      'inventory.order_events',
        queueOptions: {
          durable: true,
          arguments: {
            'x-dead-letter-exchange': 'apple_shop.dlx',
            'x-dead-letter-routing-key': 'inventory.order_events.dead',
          }
        }
      }
    );
    // Tương tự cho order.confirmed, order.cancelled
  }

  async handleOrderCreated(payload: OrderCreatedPayload): Promise<void> {
    this.logger.log(`Handling order.created: ${payload.orderId}`);
    try {
      await this.inventoryService.reserveStock(payload.orderId, payload.items);
    } catch (err) {
      if (err instanceof InsufficientStockException) {
        await this.publisher.publish('order.reserve_failed', {
          orderId: payload.orderId,
          reason:  err.message,
        });
      }
      throw err; // Re-throw để RabbitMQ retry / DLQ
    }
  }

  async handleOrderConfirmed(payload: OrderConfirmedPayload): Promise<void> { ... }

  async handleOrderCancelled(payload: OrderCancelledPayload): Promise<void> { ... }
}
```

---

## 9. DTOs

### 9.1 `ImportStockDto`

```typescript
export class ImportStockDto {
  @IsInt()
  @Min(1)
  @Max(10000)
  @ApiProperty({ example: 50, description: 'Số lượng nhập' })
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiProperty({ required: false, example: 'Nhập hàng Apple Distribution' })
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ApiProperty({ required: false, example: 'IMPORT-BILL-2026-001' })
  referenceId?: string;
}
```

### 9.2 `AdjustmentDto`

```typescript
export class AdjustmentDto {
  @IsInt()
  @Min(0)
  @Max(99999)
  @ApiProperty({ example: 45, description: 'Số lượng thực tế sau kiểm kê' })
  quantityAfter: number;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  @ApiProperty({ example: 'Kiểm kê tháng 3/2026 — phát hiện lệch 2 chiếc do hư hỏng' })
  note: string;
}
```

### 9.3 `BulkCheckDto`

```typescript
export class BulkCheckItemDto {
  @IsUUID()
  productVariantId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class BulkCheckDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkCheckItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  items: BulkCheckItemDto[];
}
```

### 9.4 `QueryInventoryDto`

```typescript
export class QueryInventoryDto {
  @IsOptional() @IsInt() @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number = 1;

  @IsOptional() @IsInt() @Min(1) @Max(100)
  @Transform(({ value }) => parseInt(value))
  limit?: number = 20;

  @IsOptional() @IsUUID()
  variantId?: string;

  @IsOptional() @IsBoolean()
  @Transform(({ value }) => value === 'true')
  lowStockOnly?: boolean = false;

  @IsOptional() @IsBoolean()
  @Transform(({ value }) => value === 'true')
  zeroStockOnly?: boolean = false;

  @IsOptional() @IsIn(['quantity', 'reservedQuantity', 'updatedAt'])
  sortBy?: string = 'updatedAt';

  @IsOptional() @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
```

### 9.5 `UpdateThresholdDto`

```typescript
export class UpdateThresholdDto {
  @IsInt()
  @Min(0)
  @Max(1000)
  @ApiProperty({ example: 5, description: 'Ngưỡng cảnh báo tồn kho thấp' })
  lowStockThreshold: number;
}
```

---

## 10. Error Handling

### 10.1 Custom Exceptions

```typescript
// exceptions/insufficient-stock.exception.ts
export class InsufficientStockException extends HttpException {
  constructor(
    variantId: string,
    available: number,
    requested: number,
  ) {
    super(
      {
        code:      'INSUFFICIENT_STOCK',
        message:   `Không đủ hàng tồn kho`,
        details: { variantId, available, requested },
      },
      HttpStatus.UNPROCESSABLE_ENTITY,  // 422
    );
  }
}

// exceptions/inventory-not-found.exception.ts
export class InventoryNotFoundException extends HttpException {
  constructor(variantId: string) {
    super(
      {
        code:    'INVENTORY_NOT_FOUND',
        message: `Không tìm thấy tồn kho cho variant: ${variantId}`,
      },
      HttpStatus.NOT_FOUND,  // 404
    );
  }
}
```

### 10.2 Error Code Registry

| Code | HTTP Status | Mô Tả |
|------|------------|-------|
| `INVENTORY_NOT_FOUND` | 404 | Không tìm thấy inventory record |
| `INSUFFICIENT_STOCK` | 422 | Tồn kho không đủ |
| `INVALID_QUANTITY` | 400 | Quantity không hợp lệ |
| `ADJUSTMENT_NOTE_REQUIRED` | 400 | Thiếu note khi điều chỉnh |
| `CONCURRENT_MODIFICATION` | 409 | Xung đột khi cập nhật đồng thời |
| `VARIANT_NOT_FOUND` | 404 | Variant không tồn tại (từ Product Service) |
| `UNAUTHORIZED_ACTION` | 403 | Không đủ quyền |

### 10.3 Global Exception Filter

```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx    = host.switchToHttp();
    const res    = ctx.getResponse<Response>();
    const req    = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const response = exception instanceof HttpException
      ? exception.getResponse()
      : { code: 'INTERNAL_ERROR', message: 'Lỗi server nội bộ' };

    this.logger.error(`[${req.method}] ${req.url} — ${status}`, exception);

    res.status(status).json({
      success: false,
      error:   response,
      timestamp: new Date().toISOString(),
      path:    req.url,
    });
  }
}
```

---

## 11. Guards & Authorization

### 11.1 JWT Guard

```typescript
// Validate JWT token từ API Gateway forward qua header X-User-Payload
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userPayload = request.headers['x-user-payload'];
    if (!userPayload) throw new UnauthorizedException();
    request.user = JSON.parse(Buffer.from(userPayload, 'base64').toString());
    return true;
  }
}
```

### 11.2 Service Auth Guard

```typescript
// Cho endpoint /bulk-check — chỉ service nội bộ được gọi
@Injectable()
export class ServiceAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token   = request.headers['x-service-token'];
    return token === process.env.INTERNAL_SERVICE_TOKEN;
  }
}
```

### 11.3 Role Matrix

| Endpoint | admin | staff | customer | internal |
|----------|-------|-------|----------|----------|
| `GET /inventory` | ✅ | ✅ | ❌ | ❌ |
| `GET /inventory/:id` | ✅ | ✅ | ❌ | ❌ |
| `GET /inventory/:id/transactions` | ✅ | ✅ | ❌ | ❌ |
| `GET /inventory/low-stock` | ✅ | ✅ | ❌ | ❌ |
| `POST /inventory/:id/import` | ✅ | ✅ | ❌ | ❌ |
| `POST /inventory/:id/adjustment` | ✅ | ❌ | ❌ | ❌ |
| `PATCH /inventory/:id/threshold` | ✅ | ❌ | ❌ | ❌ |
| `POST /inventory/bulk-check` | ❌ | ❌ | ❌ | ✅ |

---

## 12. Configuration

### 12.1 `.env`

```env
# App
NODE_ENV=development
PORT=3003
SERVICE_NAME=inventory-service

# Database
DATABASE_URL="mysql://root:password@localhost:3306/db_inventory"

# RabbitMQ
AMQP_URL="amqp://guest:guest@localhost:5672"
AMQP_PREFETCH=10

# Internal auth
INTERNAL_SERVICE_TOKEN="your-secret-internal-token"

# Low stock cooldown (milliseconds) — chống spam event
LOW_STOCK_COOLDOWN_MS=86400000

# Logging
LOG_LEVEL=debug
```

### 12.2 `app.config.ts`

```typescript
export default registerAs('app', () => ({
  port:                parseInt(process.env.PORT, 10) || 3003,
  nodeEnv:             process.env.NODE_ENV || 'development',
  serviceName:         process.env.SERVICE_NAME || 'inventory-service',
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN,
  lowStockCooldownMs:  parseInt(process.env.LOW_STOCK_COOLDOWN_MS, 10) || 86400000,
}));
```

### 12.3 `package.json`

```json
{
  "name": "inventory-service",
  "scripts": {
    "build":       "nest build",
    "start":       "nest start",
    "start:dev":   "nest start --watch",
    "start:prod":  "node dist/main",
    "test":        "jest",
    "test:watch":  "jest --watch",
    "test:cov":    "jest --coverage",
    "test:e2e":    "jest --config ./test/jest-e2e.json",
    "db:migrate":  "prisma migrate dev",
    "db:seed":     "ts-node prisma/seed.ts",
    "db:generate": "prisma generate"
  },
  "dependencies": {
    "@nestjs/common":       "^10.x",
    "@nestjs/core":         "^10.x",
    "@nestjs/config":       "^3.x",
    "@nestjs/microservices": "^10.x",
    "@nestjs/terminus":     "^10.x",
    "@prisma/client":       "^5.x",
    "amqplib":              "^0.10.x",
    "class-transformer":    "^0.5.x",
    "class-validator":      "^0.14.x",
    "rxjs":                 "^7.x"
  },
  "devDependencies": {
    "prisma":        "^5.x",
    "@types/amqplib": "^0.10.x",
    "jest":          "^29.x",
    "@types/jest":   "^29.x",
    "ts-jest":       "^29.x"
  }
}
```

---

## 13. Testing Strategy

### 13.1 Unit Tests — `InventoryService`

```typescript
describe('InventoryService', () => {

  describe('reserveStock', () => {
    it('should reserve when stock is sufficient', async () => {
      // mock inventory: quantity=10, reservedQuantity=2
      // request: qty=5
      // expected: reservedQuantity=7
    });

    it('should throw InsufficientStockException when stock is not enough', async () => {
      // mock inventory: quantity=5, reservedQuantity=2 → available=3
      // request: qty=4
      // expected: throw InsufficientStockException
    });

    it('should be atomic — rollback all if any item fails', async () => {
      // item1: OK, item2: insufficient
      // expected: item1 reservation rolled back
    });
  });

  describe('deductStock', () => {
    it('should deduct quantity and release reserved', async () => { ... });
    it('should publish stock_low event when quantity <= threshold', async () => { ... });
    it('should not publish stock_low when already cooldown', async () => { ... });
  });

  describe('releaseReserve', () => {
    it('should release reserved quantity', async () => { ... });
    it('should be idempotent when no reserve found', async () => { ... });
  });

  describe('importStock', () => {
    it('should create inventory record if not exists', async () => { ... });
    it('should increment quantity correctly', async () => { ... });
    it('should create transaction record', async () => { ... });
    it('should publish stock_updated event', async () => { ... });
  });

  describe('adjustment', () => {
    it('should set quantity to exact value', async () => { ... });
    it('should require note field', async () => { ... });
    it('should handle negative adjustment', async () => { ... });
  });

  describe('bulkCheck', () => {
    it('should return allAvailable=true when all items sufficient', async () => { ... });
    it('should return allAvailable=false when any item insufficient', async () => { ... });
  });
});
```

### 13.2 Unit Tests — `OrderEventsConsumer`

```typescript
describe('OrderEventsConsumer', () => {
  describe('handleOrderCreated', () => {
    it('should call reserveStock with correct items', async () => { ... });
    it('should publish order.reserve_failed when insufficient stock', async () => { ... });
    it('should re-throw error for RabbitMQ retry', async () => { ... });
  });

  describe('handleOrderCancelled', () => {
    it('should call releaseReserve', async () => { ... });
    it('should not throw when no reserve found (idempotent)', async () => { ... });
  });
});
```

### 13.3 E2E Tests

```typescript
describe('InventoryController (e2e)', () => {

  it('GET /inventory — admin should get list', async () => {
    const res = await request(app.getHttpServer())
      .get('/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it('POST /inventory/:variantId/import — staff can import', async () => {
    const res = await request(app.getHttpServer())
      .post(`/inventory/${variantId}/import`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ quantity: 10, note: 'Test import' })
      .expect(201);
    expect(res.body.data.inventory.quantity).toBe(previousQty + 10);
  });

  it('POST /inventory/:variantId/adjustment — only admin', async () => {
    await request(app.getHttpServer())
      .post(`/inventory/${variantId}/adjustment`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ quantityAfter: 5, note: 'Staff should not do this' })
      .expect(403);
  });
});
```

### 13.4 Test Coverage Targets

| Module | Target |
|--------|--------|
| `InventoryService` | ≥ 90% |
| `OrderEventsConsumer` | ≥ 85% |
| `InventoryRepository` | ≥ 80% |
| `InventoryController` | ≥ 75% (e2e) |
| **Overall** | **≥ 80%** |

---

## Phụ Lục — Ví Dụ Prisma Queries

### Reserve với SELECT FOR UPDATE (via `$transaction`)

```typescript
async reserveStock(orderId: string, items: OrderItem[]): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    for (const item of items) {
      // Raw query để lock row
      const [inv] = await tx.$queryRaw<Inventory[]>`
        SELECT * FROM INVENTORY
        WHERE product_variant_id = ${item.productVariantId}
        FOR UPDATE
      `;

      if (!inv) throw new InventoryNotFoundException(item.productVariantId);

      const available = inv.quantity - inv.reservedQuantity;
      if (available < item.quantity) {
        throw new InsufficientStockException(
          item.productVariantId, available, item.quantity
        );
      }

      await tx.inventory.update({
        where: { productVariantId: item.productVariantId },
        data:  { reservedQuantity: { increment: item.quantity } },
      });

      await tx.inventoryTransaction.create({
        data: {
          productVariantId: item.productVariantId,
          type:             InventoryTxnType.reserve,
          quantityChange:   -item.quantity,
          quantityBefore:   inv.quantity,
          quantityAfter:    inv.quantity,
          referenceId:      orderId,
          referenceType:    TxnReferenceType.order,
          note:             `Reserve cho đơn hàng ${orderId}`,
          createdBy:        'system',
        }
      });
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 10000,  // 10 giây
  });
}
```

---

*Inventory Service Design Document · v1.0 · iLuxury Apple Shop*
