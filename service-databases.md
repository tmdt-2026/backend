# Tong hop database schemas theo service

File nay duoc tao tu dong tu apps/*/prisma/schema.prisma.

## config-service

- Nguon: apps/config-service/prisma/schema.prisma

```prisma
// ============================================================
// Config Service — db_config
// ============================================================

generator client {
  provider = "prisma-client-js"
  output   = "../../../node_modules/@prisma/config-client"
}

datasource db {
  provider = "mysql"
  url      = env("CONFIG_DATABASE_URL")
}

enum SettingType {
  string
  number
  boolean
  json
  html
}

model Setting {
  id           String      @id @default(uuid()) @db.Char(36)
  settingKey   String      @unique @map("setting_key") @db.VarChar(255)
  settingValue String?     @map("setting_value") @db.Text
  settingType  SettingType @default(string) @map("setting_type")
  group        String      @default("general") @db.VarChar(100)
  description  String?     @db.VarChar(500)
  isPublic     Boolean     @default(true) @map("is_public")
  updatedBy    String?     @map("updated_by") @db.Char(36)
  updatedAt    DateTime    @updatedAt @map("updated_at")
  createdAt    DateTime    @default(now()) @map("created_at")

  @@index([group])
  @@index([isPublic])
  @@map("SETTINGS")
}

model Banner {
  id             String    @id @default(uuid()) @db.Char(36)
  title          String?   @db.VarChar(255)
  imageUrl       String    @map("image_url") @db.VarChar(500)
  mobileImageUrl String?   @map("mobile_image_url") @db.VarChar(500)
  targetUrl      String?   @map("target_url") @db.VarChar(500)
  altText        String?   @map("alt_text") @db.VarChar(255)
  position       String    @default("home_main") @db.VarChar(100)
  sortOrder      Int       @default(0) @map("sort_order")
  startDate      DateTime? @map("start_date")
  endDate        DateTime? @map("end_date")
  isActive       Boolean   @default(true) @map("is_active")
  clickCount     Int       @default(0) @map("click_count")
  createdBy      String?   @map("created_by") @db.Char(36)
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  @@index([position, isActive, sortOrder])
  @@index([startDate, endDate])
  @@index([isActive])
  @@map("BANNERS")
}
```

## inventory-service

- Nguon: apps/inventory-service/prisma/schema.prisma

```prisma
generator client {
    provider = "prisma-client-js"
    output   = "../../../node_modules/@prisma/inventory-client"
}

datasource db {
    provider = "mysql"
    url      = env("INVENTORY_DATABASE_URL")
}

model Inventory {
    id               String   @id @default(uuid()) @db.Char(36)
    productVariantId String   @unique @map("product_variant_id") @db.Char(36)
    quantity         Int      @default(0)
    reservedQuantity Int      @default(0) @map("reserved_quantity")
    lowStockThreshold Int     @default(5) @map("low_stock_threshold")
    updatedAt        DateTime @updatedAt @map("updated_at")

    transactions InventoryTransaction[]

    @@index([productVariantId])
    @@map("INVENTORY")
}

model InventoryTransaction {
    id               String            @id @default(uuid()) @db.Char(36)
    productVariantId String            @map("product_variant_id") @db.Char(36)
    type             InventoryTxnType
    quantityChange   Int               @map("quantity_change")
    quantityBefore   Int               @map("quantity_before")
    quantityAfter    Int               @map("quantity_after")
    referenceId      String?           @map("reference_id") @db.VarChar(100)
    referenceType    TxnReferenceType? @map("reference_type")
    note             String?           @db.VarChar(500)
    createdBy        String            @map("created_by") @db.VarChar(100)
    createdAt        DateTime          @default(now()) @map("created_at")

    inventory Inventory @relation(fields: [productVariantId], references: [productVariantId])

    @@index([productVariantId, createdAt])
    @@index([type])
    @@index([referenceId])
    @@map("INVENTORY_TRANSACTIONS")
}

enum InventoryTxnType {
    import
    export_sale
    export_return
    reserve
    release_reserve
    adjustment
}

enum TxnReferenceType {
    order
    import_bill
    manual
}
```

## notification-service

- Nguon: apps/notification-service/prisma/schema.prisma

```prisma
// ============================================================
// Notification Service — db_notifications
// prisma/schema.prisma
// Prisma version: 5.x
// ============================================================

generator client {
  provider = "prisma-client-js"
  output   = "../../../node_modules/@prisma/notification-client"
}

datasource db {
  provider = "mysql"
  url      = env("NOTIFICATION_DATABASE_URL")
}

model EmailTemplate {
  id          String   @id @default(uuid()) @db.Char(36)
  key         String   @unique @db.VarChar(100)
  name        String   @db.VarChar(255)
  subject     String   @db.VarChar(500)
  htmlBody    String   @map("html_body") @db.LongText
  textBody    String?  @map("text_body") @db.Text
  variables   Json
  description String?  @db.VarChar(500)
  isActive    Boolean  @default(true) @map("is_active")
  isSystem    Boolean  @default(false) @map("is_system")
  updatedBy   String?  @map("updated_by") @db.Char(36)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  logs EmailLog[]

  @@index([key])
  @@index([isActive])
  @@map("EMAIL_TEMPLATES")
}

model EmailLog {
  id            String      @id @default(uuid()) @db.Char(36)
  templateId    String?     @map("template_id") @db.Char(36)
  templateKey   String      @map("template_key") @db.VarChar(100)
  toEmail       String      @map("to_email") @db.VarChar(255)
  toName        String?     @map("to_name") @db.VarChar(255)
  subject       String      @db.VarChar(500)
  htmlBody      String      @map("html_body") @db.LongText
  variables     Json?
  status        EmailStatus @default(PENDING)
  attempt       Int         @default(0)
  sentAt        DateTime?   @map("sent_at")
  failReason    String?     @map("fail_reason") @db.Text
  referenceType String?     @map("reference_type") @db.VarChar(50)
  referenceId   String?     @map("reference_id") @db.VarChar(100)
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")

  template EmailTemplate? @relation(fields: [templateId], references: [id])

  @@index([templateKey])
  @@index([toEmail])
  @@index([status])
  @@index([referenceType, referenceId])
  @@index([createdAt])
  @@map("EMAIL_LOGS")
}

enum EmailStatus {
  PENDING
  SENT
  FAILED
  PERMANENTLY_FAILED
}
```

## order-service

- Nguon: apps/order-service/prisma/schema.prisma

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../../../node_modules/@prisma/order-client"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model Order {
  id           String  @id @default(uuid()) @db.Char(36)
  user_id      String  @db.Char(36)
  promotion_id String? @db.Char(36)

  payment_type   PaymentType   @map("payment_type")
  payment_method PaymentMethod @map("payment_method")

  subtotal_price  Decimal @db.Decimal(18, 2)
  discount_amount Decimal @default(0) @db.Decimal(18, 2)
  total_price     Decimal @db.Decimal(18, 2)
  total_product   Int

  status OrderStatus @default(pending)

  shipping_name     String @db.VarChar(255)
  shipping_phone    String @db.VarChar(20)
  shipping_province String @db.VarChar(255)
  shipping_district String @db.VarChar(255)
  shipping_ward     String @db.VarChar(255)
  shipping_street   String @db.VarChar(500)

  note String? @db.VarChar(500)

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  order_details OrderDetail[]

  @@map("ORDERS")
}

model OrderDetail {
  id String @id @default(uuid()) @db.Char(36)

  order_id           String  @db.Char(36)
  product_variant_id String  @db.Char(36)
  product_name       String  @db.VarChar(255)
  variant_label      String? @db.VarChar(255)

  quantity      Int
  import_price  Decimal @db.Decimal(18, 2)
  price         Decimal @db.Decimal(18, 2)
  item_discount Decimal @default(0) @db.Decimal(18, 2)

  order Order @relation(fields: [order_id], references: [id], onDelete: Cascade)

  @@index([order_id])
  @@map("ORDER_DETAILS")
}

enum PaymentType {
  full
  installment
}

enum PaymentMethod {
  cod
  vnpay
  momo
  bank_transfer
}

enum OrderStatus {
  pending
  processing
  shipped
  completed
  cancelled
}
```

## payment-service

- Nguon: apps/payment-service/prisma/schema.prisma

```prisma
// ============================================================
// Payment Service — db_payments
// prisma/schema.prisma
// ============================================================

generator client {
    provider = "prisma-client-js"
    output   = "../../../node_modules/@prisma/payment-client"
}

datasource db {
    provider = "mysql"
    url      = env("DATABASE_URL")
}

// ============================================================
// ENUMS
// ============================================================
enum PaymentMethod {
    cod
    vnpay
    momo
    bank_transfer
}

enum PaymentStatus {
    pending
    success
    failed
    refunded
}

// ============================================================
// PAYMENTS
// orderId: [REF: db_orders → Order Service]
// ============================================================
model Payment {
    id               String        @id @default(uuid()) @db.Char(36)
    orderId          String        @unique @map("order_id") @db.Char(36)
    amount           Decimal       @db.Decimal(18, 2)
    paymentMethod    PaymentMethod @map("payment_method")
    status           PaymentStatus @default(pending)
    transactionCode  String?       @map("transaction_code") @db.VarChar(255)
    providerResponse String?       @map("provider_response") @db.Text
    paidAt           DateTime?     @map("paid_at")
    createdAt        DateTime      @default(now()) @map("created_at")
    updatedAt        DateTime      @updatedAt @map("updated_at")

    @@index([orderId])
    @@index([status])
    @@map("PAYMENTS")
}
```

## product-service

- Nguon: apps/product-service/prisma/schema.prisma

```prisma
// ============================================================
// Product Service — db_products
// prisma/schema.prisma
// ============================================================

generator client {
    provider = "prisma-client-js"
    output   = "../../../node_modules/@prisma/product-client"
}

datasource db {
    provider = "mysql"
    url      = env("PRODUCT_DATABASE_URL")
}

// ============================================================
// CATEGORIES
// Hỗ trợ danh mục lồng nhau (self-relation)
// ============================================================
model Category {
    id        String   @id @default(uuid()) @db.Char(36)
    name      String   @db.VarChar(255)
    slug      String   @unique @db.VarChar(255)
    parentId  String?  @map("parent_id") @db.Char(36)
    sortOrder Int      @default(0) @map("sort_order")
    isActive  Boolean  @default(true) @map("is_active")
    createdAt DateTime @default(now()) @map("created_at")

    parent   Category?  @relation("CategoryTree", fields: [parentId], references: [id])
    children Category[] @relation("CategoryTree")
    products Product[]

    @@map("CATEGORIES")
}

// ============================================================
// MODEL
// Thông số kỹ thuật chung của một dòng sản phẩm
// ============================================================
model Model {
    id          String    @id @default(uuid()) @db.Char(36)
    modelName   String    @map("model_name") @db.VarChar(255)
    modelNumber String?   @map("model_number") @db.VarChar(255)
    brand       String    @default("Apple") @db.VarChar(255)
    cpu         String?   @db.VarChar(255)
    screenSize  Decimal?  @map("screen_size") @db.Decimal(5, 2)
    operaSystem String?   @map("opera_system") @db.VarChar(255)
    isActive    Boolean   @default(true) @map("is_active")
    deletedAt   DateTime? @map("deleted_at")
    createdAt   DateTime  @default(now()) @map("created_at")

    products Product[]

    @@map("MODEL")
}

// ============================================================
// PRODUCTS
// ============================================================
model Product {
    id          String    @id @default(uuid()) @db.Char(36)
    name        String    @db.VarChar(255)
    modelId     String?   @map("model_id") @db.Char(36)
    categoryId  String    @map("category_id") @db.Char(36)
    imgUrl      String?   @map("img_url") @db.VarChar(500)
    description String?   @db.Text
    isActive    Boolean   @default(true) @map("is_active")
    deletedAt   DateTime? @map("deleted_at")
    createdAt   DateTime  @default(now()) @map("created_at")
    updatedAt   DateTime  @updatedAt @map("updated_at")

    model    Model?           @relation(fields: [modelId], references: [id])
    category Category         @relation(fields: [categoryId], references: [id])
    variants ProductVariant[]
    images   ProductImage[]

    @@index([categoryId])
    @@index([isActive, deletedAt])
    @@map("PRODUCTS")
}

// ============================================================
// PRODUCT_IMAGES
// Nhiều ảnh / 1 sản phẩm (gallery)
// ============================================================
model ProductImage {
    id        String   @id @default(uuid()) @db.Char(36)
    productId String   @map("product_id") @db.Char(36)
    imageUrl  String   @map("image_url") @db.VarChar(500)
    altText   String?  @map("alt_text") @db.VarChar(255)
    sortOrder Int      @default(0) @map("sort_order")
    createdAt DateTime @default(now()) @map("created_at")

    product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

    @@index([productId, sortOrder])
    @@map("PRODUCT_IMAGES")
}

// ============================================================
// PRODUCT_VARIANTS
// Mỗi variant = 1 SKU (màu + dung lượng + RAM)
// ============================================================
model ProductVariant {
    id        String @id @default(uuid()) @db.Char(36)
    productId String @map("product_id") @db.Char(36)

    color         String?   @db.VarChar(100)
    ram           Int?
    storage       Int?
    importPrice   Decimal   @map("import_price") @db.Decimal(18, 2)
    originalPrice Decimal?  @map("original_price") @db.Decimal(18, 2)
    price         Decimal   @db.Decimal(18, 2)
    stockQuantity Int       @default(0) @map("stock_quantity")
    isActive      Boolean   @default(true) @map("is_active")
    deletedAt     DateTime? @map("deleted_at")
    createdAt     DateTime  @default(now()) @map("created_at")

    product        Product        @relation(fields: [productId], references: [id])
    priceHistories PriceHistory[]

    @@index([productId])
    @@map("PRODUCT_VARIANTS")
}

// ============================================================
// PRICE_HISTORIES
// Audit trail thay đổi giá variant
// changedBy: [REF: db_users → User Service] — KHÔNG có @relation
// ============================================================
model PriceHistory {
    id               String   @id @default(uuid()) @db.Char(36)
    productVariantId String   @map("product_variant_id") @db.Char(36)
    changedBy        String   @map("changed_by") @db.Char(36)
    oldImportPrice   Decimal? @map("old_import_price") @db.Decimal(18, 2)
    newImportPrice   Decimal? @map("new_import_price") @db.Decimal(18, 2)
    oldOriginalPrice Decimal? @map("old_original_price") @db.Decimal(18, 2)
    newOriginalPrice Decimal? @map("new_original_price") @db.Decimal(18, 2)
    oldPrice         Decimal? @map("old_price") @db.Decimal(18, 2)
    newPrice         Decimal? @map("new_price") @db.Decimal(18, 2)
    reason           String?  @db.VarChar(500)
    changedAt        DateTime @default(now()) @map("changed_at")

    variant ProductVariant @relation(fields: [productVariantId], references: [id])

    @@index([productVariantId, changedAt])
    @@map("PRICE_HISTORIES")
}
```

## promotion-service

- Nguon: apps/promotion-service/prisma/schema.prisma

```prisma
// ============================================================
// Promotion Service — db_promotions
// prisma/schema.prisma
// ============================================================

generator client {
  provider = "prisma-client-js"
  output   = "../../../node_modules/@prisma/promotion-client"
}

datasource db {
  provider = "mysql"
  url      = env("PROMOTION_DATABASE_URL")
}

// ============================================================
// ENUMS
// ============================================================

enum DiscountType {
  PERCENTAGE     // Giảm theo phần trăm (%)
  FIXED_AMOUNT   // Giảm số tiền cố định
}

// ============================================================
// MODELS
// ============================================================

model Promotion {
  id                String          @id @default(uuid()) @db.Char(36)
  code              String          @unique @db.VarChar(50)
  name              String          @db.VarChar(255)
  description       String?         @db.Text
  discountType      DiscountType    @map("discount_type")
  discountValue     Decimal         @db.Decimal(12, 2) @map("discount_value")
  maxDiscount       Decimal?        @db.Decimal(12, 2) @map("max_discount")
  minOrderValue     Decimal         @default(0) @db.Decimal(12, 2) @map("min_order_value")
  startDate         DateTime        @map("start_date")
  endDate           DateTime        @map("end_date")
  usageLimit        Int?            @map("usage_limit")           // Tổng số lượt dùng
  perUserLimit      Int?            @map("per_user_limit")        // Giới hạn mỗi user
  isActive          Boolean         @default(true) @map("is_active")
  createdAt         DateTime        @default(now()) @map("created_at")
  updatedAt         DateTime        @updatedAt @map("updated_at")

  usages            PromotionUsage[]

  @@index([code])
  @@index([isActive])
  @@index([startDate, endDate])
  @@map("PROMOTIONS")
}

model PromotionUsage {
  id            String    @id @default(uuid()) @db.Char(36)
  promotionId   String    @map("promotion_id") @db.Char(36)
  userId        String    @map("user_id") @db.Char(36)
  orderId       String?   @map("order_id") @db.Char(36)
  usedAt        DateTime  @default(now()) @map("used_at")

  promotion     Promotion @relation(fields: [promotionId], references: [id], onDelete: Cascade)

  @@unique([promotionId, userId])   // Một user chỉ dùng được 1 lần nếu có perUserLimit
  @@index([userId])
  @@index([orderId])
  @@map("PROMOTION_USAGES")
}

// ============================================================
// OPTIONAL: Nếu sau này muốn theo dõi lịch sử thay đổi voucher
// ============================================================

// model PromotionHistory {
//   id            String   @id @default(uuid()) @db.Char(36)
//   promotionId   String   @map("promotion_id") @db.Char(36)
//   action        String   @db.VarChar(50)   // create | update | activate | deactivate
//   changedBy     String?  @map("changed_by") @db.Char(36)
//   changedAt     DateTime @default(now()) @map("changed_at")
//   oldValue      Json?    @map("old_value")
//   newValue      Json?    @map("new_value")

//   promotion     Promotion @relation(fields: [promotionId], references: [id], onDelete: Cascade)

//   @@map("PROMOTION_HISTORY")
// }
```

## review-service

- Nguon: apps/review-service/prisma/schema.prisma

```prisma
// ============================================================
// Review Service — db_reviews
// ============================================================

generator client {
    provider = "prisma-client-js"
    output   = "../../../node_modules/@prisma/review-client"
}

datasource db {
    provider = "mysql"
    url      = env("REVIEW_DATABASE_URL")
}

model Review {
    id        String  @id @default(uuid()) @db.Char(36)
    userId    String  @map("user_id") @db.Char(36)
    productId String  @map("product_id") @db.Char(36)
    orderId   String  @map("order_id") @db.Char(36)
    rating    Int
    content   String? @db.Text
    images    Json?

    isVisible Boolean @default(true) @map("is_visible")
    adminNote String? @map("admin_note") @db.VarChar(500)

    userNameSnapshot    String? @map("user_name_snapshot") @db.VarChar(255)
    productNameSnapshot String? @map("product_name_snapshot") @db.VarChar(255)

    createdAt DateTime @default(now()) @map("created_at")

    @@unique([userId, productId, orderId])
    @@index([productId])
    @@index([productId, isVisible])
    @@index([userId])
    @@index([rating])
    @@map("REVIEWS")
}

model Comment {
    id        String  @id @default(uuid()) @db.Char(36)
    productId String  @map("product_id") @db.Char(36)
    userId    String  @map("user_id") @db.Char(36)
    parentId  String? @map("parent_id") @db.Char(36)
    depth     Int     @default(0)
    content   String  @db.Text
    isVisible Boolean @default(true) @map("is_visible")
    adminNote String? @map("admin_note") @db.VarChar(500)

    editedAt DateTime? @map("edited_at")

    userNameSnapshot String? @map("user_name_snapshot") @db.VarChar(255)
    userRoleSnapshot String? @map("user_role_snapshot") @db.VarChar(50)

    createdAt DateTime @default(now()) @map("created_at")
    updatedAt DateTime @updatedAt @map("updated_at")

    parent  Comment?  @relation("CommentTree", fields: [parentId], references: [id])
    replies Comment[] @relation("CommentTree")

    @@index([productId, parentId])
    @@index([productId, isVisible])
    @@index([userId])
    @@map("COMMENTS")
}
```

## user-service

- Nguon: apps/user-service/prisma/schema.prisma

```prisma
// ============================================================
// User Service — db_users
// prisma/schema.prisma
// ============================================================

generator client {
  provider = "prisma-client-js"
  output   = "../../../node_modules/@prisma/user-client"
}

datasource db {
  provider = "mysql"
  url      = env("USER_DATABASE_URL")
}

// ============================================================
// ENUMS
// ============================================================
enum Gender {
  male
  female
  other
}

enum DeviceType {
  android
  ios
  web
}

// ============================================================
// ROLES
// ============================================================
model Role {
  id        String   @id @default(uuid()) @db.Char(36)
  name      String   @unique @db.VarChar(50) // admin | staff | customer
  createdAt DateTime @default(now()) @map("created_at")

  userRoles UserRole[]

  @@map("ROLES")
}

// ============================================================
// USERS
// ============================================================
model User {
  id           String   @id @default(uuid()) @db.Char(36)
  userName     String   @map("user_name") @db.VarChar(255)
  hashPassword String   @map("hash_password") @db.VarChar(255)
  email        String   @unique @db.VarChar(255)
  phoneNumber  String?  @unique @map("phone_number") @db.VarChar(20)
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  userRoles     UserRole[]
  userDetail    UserDetail?
  addresses     UserAddress[]
  fcmTokens     FcmToken[]
  refreshTokens RefreshToken[]

  @@index([email])
  @@index([isActive])
  @@map("USERS")
}

// ============================================================
// USER_ROLES (junction)
// ============================================================
model UserRole {
  userId String @map("user_id") @db.Char(36)
  roleId String @map("role_id") @db.Char(36)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
  @@map("USER_ROLES")
}

// ============================================================
// USER_DETAILS
// ============================================================
model UserDetail {
  id          String    @id @default(uuid()) @db.Char(36)
  userId      String    @unique @map("user_id") @db.Char(36)
  fullName    String?   @map("full_name") @db.VarChar(255)
  avatarUrl   String?   @map("avatar_url") @db.VarChar(500)
  dateOfBirth DateTime? @map("date_of_birth") @db.Date
  gender      Gender?
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("USER_DETAILS")
}

// ============================================================
// USER_ADDRESSES
// ============================================================
model UserAddress {
  id          String   @id @default(uuid()) @db.Char(36)
  userId      String   @map("user_id") @db.Char(36)
  label       String?  @db.VarChar(100)
  fullName    String   @map("full_name") @db.VarChar(255)
  phoneNumber String   @map("phone_number") @db.VarChar(20)
  province    String   @db.VarChar(255)
  district    String   @db.VarChar(255)
  ward        String   @db.VarChar(255)
  street      String   @db.VarChar(500)
  isDefault   Boolean  @default(false) @map("is_default")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isDefault])
  @@map("USER_ADDRESSES")
}

// ============================================================
// FCM_TOKENS
// ============================================================
model FcmToken {
  id         String     @id @default(uuid()) @db.Char(36)
  userId     String     @map("user_id") @db.Char(36)
  token      String     @unique @db.VarChar(500)
  deviceType DeviceType @map("device_type")
  createdAt  DateTime   @default(now()) @map("created_at")
  updatedAt  DateTime   @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("FCM_TOKENS")
}

// ============================================================
// REFRESH_TOKENS — Lưu refresh token (rotation)
// ============================================================
model RefreshToken {
  id        String    @id @default(uuid()) @db.Char(36)
  userId    String    @map("user_id") @db.Char(36)
  token     String    @unique @db.VarChar(500) // SHA-256 hashed
  deviceId  String?   @map("device_id") @db.VarChar(255)
  expiresAt DateTime  @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@map("REFRESH_TOKENS")
}
```

