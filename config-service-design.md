# Config Service — Tài Liệu Thiết Kế Backend Chi Tiết

> **Dự án:** iLuxury Apple Shop  
> **Service:** Config Service  
> **Stack:** NestJS · Prisma 5 · MySQL · RabbitMQ · Cache (In-memory / Redis)  
> **Port:** `3011`  
> **Database:** `db_config`  
> **Phiên bản:** 1.0

---

## Mục Lục

1. [Tổng Quan Service](#1-tổng-quan-service)
2. [Kiến Trúc & Giao Tiếp](#2-kiến-trúc--giao-tiếp)
3. [Database Design](#3-database-design)
4. [Business Logic](#4-business-logic)
5. [Caching Strategy](#5-caching-strategy)
6. [API Endpoints](#6-api-endpoints)
7. [RabbitMQ Events](#7-rabbitmq-events)
8. [Cấu Trúc Thư Mục](#8-cấu-trúc-thư-mục)
9. [Modules & Classes Chi Tiết](#9-modules--classes-chi-tiết)
10. [DTOs & Validation](#10-dtos--validation)
11. [Error Handling](#11-error-handling)
12. [Guards & Authorization](#12-guards--authorization)
13. [Configuration & Environment](#13-configuration--environment)
14. [Testing Strategy](#14-testing-strategy)

---

## 1. Tổng Quan Service

### 1.1 Trách Nhiệm

Config Service là **trung tâm cấu hình toàn hệ thống** — cung cấp mọi thông tin tĩnh và bán-tĩnh mà frontend cần hiển thị, đồng thời cho phép admin chỉnh sửa không cần deploy lại code.

| Nhóm | Chức năng |
|------|----------|
| **Settings** | Key-value store cấu hình: thông tin cửa hàng, mạng xã hội, nội dung chính sách, tham số hệ thống |
| **Banners** | Quảng cáo hình ảnh: CRUD, lên lịch tự động, sắp xếp theo vị trí |
| **Maintenance Mode** | Bật/tắt chế độ bảo trì toàn hệ thống, phát event cho API Gateway |
| **Cache Layer** | TTL cache cho settings hay đọc, invalidate khi admin cập nhật |
| **Internal RPC** | Cho phép service khác lấy config (ví dụ: Payment Service lấy tên ngân hàng) |

### 1.2 Danh Sách Setting Groups

| Group | Các key điển hình |
|-------|-----------------|
| `general` | `logo_url`, `favicon_url`, `site_name`, `shipping_free_threshold`, `max_cart_items`, `maintenance_mode` |
| `contact` | `hotline`, `store_address`, `store_email`, `store_open_hours`, `google_map_iframe` |
| `social` | `facebook_url`, `instagram_url`, `youtube_url`, `zalo_url`, `tiktok_url` |
| `policy` | `policy_return`, `policy_warranty`, `policy_privacy`, `policy_installment`, `about_us` |
| `payment` | `vnpay_merchant_id`, `momo_partner_code`, `bank_account_number`, `bank_account_name` |
| `notification` | `low_stock_threshold_default`, `order_reminder_hours`, `installment_reminder_days` |

### 1.3 Banner Positions

| Position | Hiển thị tại |
|----------|-------------|
| `home_main` | Slider chính trang chủ |
| `home_sub` | Banner phụ bên dưới slider |
| `category_top` | Đầu trang danh mục |
| `popup` | Popup quảng cáo khi vào trang |
| `product_sidebar` | Sidebar trang chi tiết sản phẩm |

### 1.4 Actors

| Actor | Settings | Banners |
|-------|----------|---------|
| `guest` | Đọc public keys | Đọc active banners |
| `customer` | Đọc public keys | Đọc active banners |
| `staff` | Đọc tất cả | Đọc tất cả |
| `admin` | Đọc & Ghi tất cả | CRUD đầy đủ |
| `internal` | Đọc tất cả (service token) | — |

### 1.5 Phạm Vi

| Trong scope | Ngoài scope |
|-------------|-------------|
| Settings key-value CRUD | Cấu hình database connection |
| Banner CRUD + lên lịch | Cấu hình nginx / reverse proxy |
| Maintenance mode toggle | Feature flags phức tạp (A/B testing) |
| Cache settings | Analytics / tracking config |
| Internal RPC cho settings | Email template (Notification Service) |

---

## 2. Kiến Trúc & Giao Tiếp

### 2.1 Vị Trí Trong Hệ Thống

```
┌──────────────────────────────────────────────────────────────────┐
│                         API GATEWAY                              │
│   - Đọc maintenance_mode từ Config Service khi khởi động        │
│   - Subscribe event config.maintenance_changed                   │
└──────┬──────────────────────────────────────────────┬────────────┘
       │ HTTP REST (public/admin)                     │ Internal RPC
  ┌────▼────────────────┐                    ┌────────▼────────────┐
  │   CONFIG SERVICE    │                    │   CONFIG SERVICE    │
  │   /api/v1/config    │                    │   /internal/config  │
  │   Port: 3011        │                    │   (service token)   │
  │   DB: db_config     │                    └─────────────────────┘
  │   Cache: In-memory  │
  └────┬────────────────┘
       │ PUBLISH events
  ┌────▼────────────────────────┐
  │       RabbitMQ Bus          │
  │   config.setting_updated    │ → Notification Service, API Gateway
  │   config.maintenance_changed│ → API Gateway (critical)
  │   config.banner_changed     │ → (future: CDN cache invalidation)
  └─────────────────────────────┘
```

### 2.2 Bảng Giao Tiếp

| Loại | Hướng | Service | Mục đích |
|------|-------|---------|---------|
| HTTP REST | Inbound | API Gateway | Endpoint public/admin |
| HTTP RPC | Inbound | Payment, Notification, Order... | Lấy config value |
| RabbitMQ PUBLISH | Outbound | API Gateway | `config.maintenance_changed` — toggle maintenance |
| RabbitMQ PUBLISH | Outbound | Notification Service | `config.setting_updated` — nếu setting ảnh hưởng notification |

### 2.3 Luồng Cập Nhật Setting Quan Trọng

```
ADMIN           CONFIG SERVICE         CACHE              API GATEWAY
  │                   │                  │                     │
  │── PUT /settings/maintenance_mode ──>│                     │
  │   { value: "true" }                 │                     │
  │                   │── Update DB ────│                     │
  │                   │── Invalidate ──>│                     │
  │                   │   cache key     │                     │
  │                   │── Set new ─────>│                     │
  │                   │   cache value   │                     │
  │                   │                 │                     │
  │                   │── PUBLISH config.maintenance_changed ─>│
  │                   │   { value: true, updatedBy, updatedAt }│
  │                   │                 │                     │── Bật maintenance
  │<── 200 OK ─────────│                 │                     │   trả 503 cho client
```

---

## 3. Database Design

### 3.1 Prisma Schema (Prisma 5)

```prisma
// ============================================================
// Config Service — db_config
// prisma/schema.prisma
// Prisma version: 5.x
// ============================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ------------------------------------------------------------
// SETTINGS
// Key-value store cấu hình hệ thống
//
// Các loại setting:
//   string  — text thường: hotline, store_address
//   number  — số: shipping_free_threshold, max_cart_items
//   boolean — true/false: maintenance_mode
//   json    — object/array: payment_methods, social_links
//   html    — rich text: policy_return, about_us
//
// isPublic:
//   true  — frontend (guest) đọc được qua GET /config/settings
//   false — chỉ admin/internal service mới đọc được
//           (VD: vnpay_merchant_id, bank_account_number)
// ------------------------------------------------------------
model Setting {
  id           String      @id @default(uuid()) @db.Char(36)
  settingKey   String      @unique @map("setting_key") @db.VarChar(255)
  settingValue String?     @map("setting_value") @db.Text
  settingType  SettingType @default(string) @map("setting_type")
  group        String      @default("general") @db.VarChar(100)
  description  String?     @db.VarChar(500)
  isPublic     Boolean     @default(true) @map("is_public")
  // Lịch sử: ai cập nhật lần cuối
  updatedBy    String?     @map("updated_by") @db.Char(36)
  // [REF: db_users.USERS.id] — không có @relation (cross-service)
  updatedAt    DateTime    @updatedAt @map("updated_at")
  createdAt    DateTime    @default(now()) @map("created_at")

  @@index([group])
  @@index([isPublic])
  @@map("SETTINGS")
}

enum SettingType {
  string
  number
  boolean
  json
  html
}

// ------------------------------------------------------------
// BANNERS
// Quảng cáo hình ảnh theo vị trí, hỗ trợ lên lịch tự động
// ------------------------------------------------------------
model Banner {
  id          String    @id @default(uuid()) @db.Char(36)
  title       String?   @db.VarChar(255)
  imageUrl    String    @map("image_url") @db.VarChar(500)
  mobileImageUrl String? @map("mobile_image_url") @db.VarChar(500)
  // Ảnh riêng cho mobile — nếu null thì dùng imageUrl
  targetUrl   String?   @map("target_url") @db.VarChar(500)
  altText     String?   @map("alt_text") @db.VarChar(255)
  // SEO: alt text cho ảnh banner
  position    String    @default("home_main") @db.VarChar(100)
  // home_main | home_sub | category_top | popup | product_sidebar
  sortOrder   Int       @default(0) @map("sort_order")
  startDate   DateTime? @map("start_date")
  // null = hiển thị ngay không cần chờ
  endDate     DateTime? @map("end_date")
  // null = không hết hạn
  isActive    Boolean   @default(true) @map("is_active")
  clickCount  Int       @default(0) @map("click_count")
  // Track số lần click để đánh giá hiệu quả
  createdBy   String?   @map("created_by") @db.Char(36)
  // [REF: db_users.USERS.id]
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  @@index([position, isActive, sortOrder])
  @@index([startDate, endDate])
  @@index([isActive])
  @@map("BANNERS")
}
```

### 3.2 Giải Thích Thiết Kế

#### Tại sao có `isPublic` trong Setting?

```
Vấn đề: Không phải mọi setting đều nên để frontend đọc được.

isPublic = true  → GET /config/settings trả về cho mọi người
  VD: hotline, store_address, facebook_url, policy_return

isPublic = false → Chỉ admin hoặc internal service mới đọc được
  VD: vnpay_merchant_id, momo_secret_key, bank_account_number
  → Những key này KHÔNG nằm trong response của GET /config/settings
  → Chỉ lấy được qua GET /config/settings/group/:group (admin)
     hoặc /internal/config/settings/:key (service token)
```

#### Tại sao có `mobileImageUrl` trong Banner?

```
Banner desktop: 1920×600px — rộng, ngang
Banner mobile:  390×300px  — cao hơn, ít text hơn

Nếu chỉ có 1 ảnh:
  Desktop OK, mobile méo/bị cắt xấu

Giải pháp: 2 trường ảnh riêng
  imageUrl:       cho desktop và tablet (≥768px)
  mobileImageUrl: cho mobile (<768px)
  Nếu mobileImageUrl null → fallback về imageUrl
```

#### Tại sao có `clickCount` trong Banner?

```
Admin muốn biết banner nào hiệu quả nhất:
  "Banner iPhone 16" được click 1.200 lần
  "Banner Trả góp" được click 340 lần

→ Quyết định giữ/xoá banner, đặt vị trí tốt hơn

Cập nhật clickCount:
  POST /config/banners/:id/track-click  (public endpoint)
  → Dùng increment không cần read-before-write:
  prisma.banner.update({ data: { clickCount: { increment: 1 } } })
```

#### Tại sao `updatedBy` lưu userId thô (không có @relation)?

```
Config Service thuộc db_config, User thuộc db_users → khác database
→ Không tạo @relation được trong microservices
→ Lưu userId raw, khi cần hiển thị tên admin → gọi User Service RPC
```

### 3.3 Index Strategy

| Index | Columns | Query nào dùng |
|-------|---------|---------------|
| `idx_settings_group` | `group` | Lấy settings theo nhóm |
| `idx_settings_public` | `isPublic` | Filter public settings |
| `idx_banner_position_active` | `(position, isActive, sortOrder)` | Lấy banners active theo vị trí |
| `idx_banner_dates` | `(startDate, endDate)` | Cron job check banner hết hạn |
| `idx_banner_active` | `isActive` | Filter nhanh |

---

## 4. Business Logic

### 4.1 Lấy Active Banners (với lịch tự động)

```typescript
async getActiveBanners(position?: string): Promise<Banner[]> {
  const now = new Date();

  return this.prisma.banner.findMany({
    where: {
      isActive:  true,
      ...(position ? { position } : {}),
      AND: [
        // startDate chưa đặt HOẶC đã đến giờ bắt đầu
        {
          OR: [
            { startDate: null },
            { startDate: { lte: now } },
          ],
        },
        // endDate chưa đặt HOẶC chưa đến giờ kết thúc
        {
          OR: [
            { endDate: null },
            { endDate: { gte: now } },
          ],
        },
      ],
    },
    orderBy: { sortOrder: 'asc' },
  });
}
```

### 4.2 Cập Nhật Setting + Invalidate Cache + Publish Event

```typescript
async updateSetting(
  key:       string,
  dto:       UpdateSettingDto,
  adminId:   string,
): Promise<Setting> {

  // Validate giá trị theo type
  this.validateSettingValue(dto.value, dto.settingType ?? existing.settingType);

  const existing = await this.settingRepo.findByKey(key);
  if (!existing) throw new SettingNotFoundException(key);

  // Cập nhật DB
  const updated = await this.prisma.setting.update({
    where: { settingKey: key },
    data: {
      settingValue: dto.value,
      updatedBy:    adminId,
      ...(dto.settingType  ? { settingType:  dto.settingType }  : {}),
      ...(dto.description  ? { description:  dto.description }  : {}),
      ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
    },
  });

  // Invalidate cache
  this.cacheService.delete(`setting:${key}`);
  this.cacheService.delete(`settings:group:${existing.group}`);
  this.cacheService.delete('settings:public');

  // Publish event cho các service liên quan
  const criticalKeys = ['maintenance_mode', 'shipping_free_threshold'];
  if (criticalKeys.includes(key)) {
    await this.publisher.publish('config.setting_updated', {
      key,
      oldValue: existing.settingValue,
      newValue: dto.value,
      updatedBy: adminId,
      updatedAt: updated.updatedAt.toISOString(),
    });
  }

  // Special case: maintenance_mode
  if (key === 'maintenance_mode') {
    await this.publisher.publish('config.maintenance_changed', {
      isEnabled: dto.value === 'true',
      updatedBy: adminId,
      updatedAt: updated.updatedAt.toISOString(),
    });
  }

  return updated;
}
```

### 4.3 Validate Setting Value theo Type

```typescript
private validateSettingValue(value: string, type: SettingType): void {
  switch (type) {
    case SettingType.number:
      if (isNaN(Number(value)))
        throw new InvalidSettingValueException(value, 'number');
      break;

    case SettingType.boolean:
      if (value !== 'true' && value !== 'false')
        throw new InvalidSettingValueException(value, 'boolean');
      break;

    case SettingType.json:
      try { JSON.parse(value); }
      catch {
        throw new InvalidSettingValueException(value, 'json');
      }
      break;

    case SettingType.html:
      // Sanitize HTML để tránh XSS
      const sanitized = sanitizeHtml(value, {
        allowedTags:  sanitizeHtml.defaults.allowedTags.concat(['h1','h2','h3','img']),
        allowedAttributes: { '*': ['class','style'], 'a': ['href','target'], 'img': ['src','alt'] },
      });
      if (sanitized !== value)
        throw new UnsafeHtmlException();
      break;

    case SettingType.string:
    default:
      // No extra validation cho string thường
      break;
  }
}
```

### 4.4 Sắp Xếp Lại Banners

```typescript
async reorderBanners(
  position: string,
  orderedIds: string[],
): Promise<void> {
  // Validate tất cả ID thuộc đúng position
  const banners = await this.prisma.banner.findMany({
    where: { id: { in: orderedIds }, position },
    select: { id: true },
  });

  if (banners.length !== orderedIds.length)
    throw new BannerPositionMismatchException();

  // Update sortOrder trong transaction
  await this.prisma.$transaction(
    orderedIds.map((id, index) =>
      this.prisma.banner.update({
        where: { id },
        data:  { sortOrder: index + 1 },
      })
    )
  );

  // Invalidate cache
  this.cacheService.delete(`banners:${position}`);
}
```

### 4.5 Cron Job — Tắt Banner Hết Hạn

```typescript
// Chạy mỗi 5 phút — kiểm tra banner đến hạn
@Cron('0 */5 * * * *')
async deactivateExpiredBanners(): Promise<void> {
  const now = new Date();

  const expired = await this.prisma.banner.updateMany({
    where: {
      isActive: true,
      endDate:  { lt: now },
      // endDate đã qua → tắt
    },
    data: { isActive: false },
  });

  if (expired.count > 0) {
    this.logger.log(`Deactivated ${expired.count} expired banners`);
    // Invalidate toàn bộ banner cache
    this.cacheService.deleteByPattern('banners:*');
  }
}

// Chạy mỗi 5 phút — bật banner đến ngày hiển thị
@Cron('0 */5 * * * *')
async activateScheduledBanners(): Promise<void> {
  const now = new Date();

  const activated = await this.prisma.banner.updateMany({
    where: {
      isActive:  false,
      startDate: { lte: now },
      OR: [
        { endDate: null },
        { endDate: { gte: now } },
      ],
    },
    data: { isActive: true },
  });

  if (activated.count > 0) {
    this.logger.log(`Activated ${activated.count} scheduled banners`);
    this.cacheService.deleteByPattern('banners:*');
  }
}
```

### 4.6 Track Banner Click

```typescript
async trackClick(bannerId: string): Promise<void> {
  // Dùng increment — không cần read trước
  await this.prisma.banner.update({
    where: { id: bannerId },
    data:  { clickCount: { increment: 1 } },
  });
  // Không invalidate cache — clickCount không nằm trong cached response
}
```

### 4.7 Bulk Upsert Settings (dùng khi init seed)

```typescript
async bulkUpsert(settings: BulkUpsertSettingItem[]): Promise<void> {
  // Prisma 5 hỗ trợ createMany với skipDuplicates
  await this.prisma.$transaction(
    settings.map(s =>
      this.prisma.setting.upsert({
        where:  { settingKey: s.key },
        create: {
          settingKey:   s.key,
          settingValue: s.value,
          settingType:  s.type,
          group:        s.group,
          description:  s.description,
          isPublic:     s.isPublic ?? true,
        },
        update: {
          settingValue: s.value,
          // Không override type, group, description khi update
        },
      })
    )
  );

  // Invalidate all settings cache
  this.cacheService.deleteByPattern('settings:*');
}
```

---

## 5. Caching Strategy

### 5.1 Lý Do Cache

Config Service là service bị **đọc nhiều nhất** trong hệ thống:
- Mỗi trang web load → gọi `/config/settings` để lấy logo, hotline, footer links
- Mỗi trang chủ → gọi `/config/banners?position=home_main`
- Thay đổi rất ít (admin sửa vài lần/tuần)

→ **Cache phù hợp hoàn toàn**, giảm DB query từ hàng nghìn xuống vài lần/phút.

### 5.2 Cache Implementation — In-Memory (không cần Redis)

```typescript
// cache.service.ts — dùng Map + TTL đơn giản, không phụ thuộc Redis
@Injectable()
export class CacheService {
  private readonly store = new Map<string, { value: unknown; expiresAt: number }>();

  set(key: string, value: unknown, ttlSeconds: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  get<T>(key: string): T | null {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value as T;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  deleteByPattern(pattern: string): void {
    // pattern ví dụ: 'banners:*'
    const prefix = pattern.replace('*', '');
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }
}
```

### 5.3 Cache Keys & TTL

| Cache Key | TTL | Invalidate khi |
|-----------|-----|---------------|
| `settings:public` | 5 phút | Bất kỳ public setting nào thay đổi |
| `settings:group:{group}` | 5 phút | Setting trong group đó thay đổi |
| `setting:{key}` | 5 phút | Setting key đó thay đổi |
| `banners:{position}` | 2 phút | Banner trong position đó thay đổi |
| `banners:all` | 2 phút | Bất kỳ banner nào thay đổi |

### 5.4 Cache-Aside Pattern

```typescript
// Trong SettingsService
async getPublicSettings(): Promise<ParsedSettings> {
  const cacheKey = 'settings:public';

  // 1. Check cache
  const cached = this.cache.get<ParsedSettings>(cacheKey);
  if (cached) return cached;

  // 2. Cache miss → query DB
  const settings = await this.prisma.setting.findMany({
    where:   { isPublic: true },
    orderBy: { group: 'asc' },
  });

  // 3. Parse values theo type
  const parsed = this.parseSettings(settings);

  // 4. Store vào cache
  this.cache.set(cacheKey, parsed, 5 * 60); // 5 phút

  return parsed;
}
```

### 5.5 Parse Setting Value theo Type

```typescript
parseSettings(settings: Setting[]): ParsedSettings {
  const result: ParsedSettings = {};

  for (const s of settings) {
    try {
      switch (s.settingType) {
        case 'number':
          result[s.settingKey] = Number(s.settingValue);
          break;
        case 'boolean':
          result[s.settingKey] = s.settingValue === 'true';
          break;
        case 'json':
          result[s.settingKey] = JSON.parse(s.settingValue ?? 'null');
          break;
        default: // string, html
          result[s.settingKey] = s.settingValue;
      }
    } catch {
      // Nếu parse lỗi → trả raw string, log warning
      this.logger.warn(`Cannot parse setting "${s.settingKey}" as ${s.settingType}`);
      result[s.settingKey] = s.settingValue;
    }
  }

  return result;
}
```

---

## 6. API Endpoints

**Base URL:** `/api/v1/config`

---

### 6.1 Settings

#### `GET /config/settings`

Lấy tất cả settings **public** — đã được parse theo type.

**Auth:** `public`  
**Cache:** 5 phút

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "site_name":               "iLuxury",
    "logo_url":                "https://cdn.iluxury.vn/logo.svg",
    "favicon_url":             "https://cdn.iluxury.vn/favicon.ico",
    "hotline":                 "1800 1234",
    "store_address":           "123 Nguyễn Huệ, Quận 1, TP. HCM",
    "store_email":             "contact@iluxury.vn",
    "store_open_hours":        "Thứ 2 - Chủ nhật: 8:00 - 21:00",
    "facebook_url":            "https://facebook.com/iluxury.vn",
    "instagram_url":           "https://instagram.com/iluxury.vn",
    "youtube_url":             "https://youtube.com/@iluxury",
    "zalo_url":                "https://zalo.me/iluxury",
    "tiktok_url":              "https://tiktok.com/@iluxury.vn",
    "google_map_iframe":       "<iframe src=\"...\" />",
    "policy_return":           "<h2>Chính sách đổi trả</h2>...",
    "policy_warranty":         "<h2>Chính sách bảo hành</h2>...",
    "policy_privacy":          "<h2>Chính sách bảo mật</h2>...",
    "policy_installment":      "<h2>Hướng dẫn trả góp</h2>...",
    "about_us":                "<h2>Về chúng tôi</h2>...",
    "shipping_free_threshold": 5000000,
    "max_cart_items":          10,
    "maintenance_mode":        false
  }
}
```

> **Lưu ý:** Response là flat object, giá trị đã được parse (number là number, boolean là boolean, không phải string).

---

#### `GET /config/settings/:key`

Lấy giá trị của một setting theo key.

**Auth:** `public` (nếu `isPublic = true`) | `admin` (nếu `isPublic = false`)

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "key":         "shipping_free_threshold",
    "value":       5000000,
    "type":        "number",
    "group":       "general",
    "description": "Đơn tối thiểu được miễn phí giao hàng (VNĐ)",
    "isPublic":    true,
    "updatedAt":   "2026-03-31T07:00:00.000Z"
  }
}
```

**Errors:**

| Code | HTTP | Mô tả |
|------|------|-------|
| `SETTING_NOT_FOUND` | 404 | Key không tồn tại |
| `SETTING_NOT_PUBLIC` | 403 | Setting private, cần admin token |

---

#### `GET /config/settings/group/:group`

Lấy tất cả settings theo nhóm.

**Auth:** `admin` (đọc được cả private), `staff` (đọc được public trong group)

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|-------|
| `includePrivate` | boolean | Bao gồm cả private keys (default: false, admin only) |

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id":          "uuid",
      "key":         "hotline",
      "value":       "1800 1234",
      "type":        "string",
      "group":       "contact",
      "description": "Số điện thoại hotline miễn phí",
      "isPublic":    true,
      "updatedBy":   "uuid-admin",
      "updatedAt":   "2026-03-31T07:00:00.000Z"
    }
  ]
}
```

---

#### `PUT /config/settings/:key`

Cập nhật giá trị setting.

**Auth:** `admin`

**Request:**

```json
{
  "value":       "2026",
  "description": "Năm hiện tại (cập nhật theo năm)",
  "isPublic":    true
}
```

**Validation:**

| Field | Rules |
|-------|-------|
| `value` | required · string (sẽ validate theo type của setting) |
| `description` | optional · maxLength: 500 |
| `isPublic` | optional · boolean |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "key":       "hotline",
    "value":     "1800 5678",
    "type":      "string",
    "group":     "contact",
    "isPublic":  true,
    "updatedBy": "uuid-admin",
    "updatedAt": "2026-04-01T09:00:00.000Z"
  }
}
```

**Errors:**

| Code | HTTP | Mô tả |
|------|------|-------|
| `SETTING_NOT_FOUND` | 404 | Key không tồn tại |
| `INVALID_SETTING_VALUE` | 400 | Giá trị không đúng type (VD: "abc" cho number type) |
| `UNSAFE_HTML` | 400 | HTML chứa script tag hoặc XSS potential |

---

#### `POST /config/settings`

Tạo setting mới.

**Auth:** `admin`

**Request:**

```json
{
  "key":         "min_order_value",
  "value":       "100000",
  "type":        "number",
  "group":       "general",
  "description": "Giá trị đơn hàng tối thiểu (VNĐ)",
  "isPublic":    true
}
```

**Validation:**

| Field | Rules |
|-------|-------|
| `key` | required · string · lowercase · `snake_case` · unique · max 255 |
| `value` | required · string |
| `type` | required · `string \| number \| boolean \| json \| html` |
| `group` | required · `general \| contact \| social \| policy \| payment \| notification` |
| `description` | optional · max 500 chars |
| `isPublic` | optional · boolean · default true |

**Response `201`:** Setting vừa tạo

**Errors:**

| Code | HTTP | Mô tả |
|------|------|-------|
| `SETTING_KEY_EXISTS` | 409 | Key đã tồn tại |
| `INVALID_KEY_FORMAT` | 400 | Key không phải snake_case |

---

#### `DELETE /config/settings/:key`

Xoá setting.

**Auth:** `admin`

**Business rule:** Không được xoá các **system keys** bảo vệ:
```
PROTECTED_KEYS = [
  'maintenance_mode', 'site_name', 'logo_url',
  'hotline', 'shipping_free_threshold', 'max_cart_items'
]
```

**Response `200`:**
```json
{ "success": true, "data": { "message": "Đã xoá setting" } }
```

**Errors:**

| Code | HTTP | Mô tả |
|------|------|-------|
| `SETTING_NOT_FOUND` | 404 | Key không tồn tại |
| `SETTING_PROTECTED` | 403 | Setting hệ thống, không được xoá |

---

### 6.2 Banners

#### `GET /config/banners`

Danh sách banner đang active theo vị trí.

**Auth:** `public`  
**Cache:** 2 phút

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|-------|
| `position` | string | Filter theo vị trí (bỏ qua → trả tất cả positions) |

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id":             "uuid",
      "title":          "Banner iPhone 16 Pro Max",
      "imageUrl":       "https://cdn.iluxury.vn/banners/iphone16-pro.jpg",
      "mobileImageUrl": "https://cdn.iluxury.vn/banners/iphone16-pro-mobile.jpg",
      "targetUrl":      "/iphone/iphone-16-pro-max",
      "altText":        "iPhone 16 Pro Max - Mua ngay tại iLuxury",
      "position":       "home_main",
      "sortOrder":      1
    }
  ]
}
```

> **Không trả về:** `clickCount`, `createdBy`, `startDate`, `endDate` — dành cho admin.

---

#### `GET /config/banners/all`

Tất cả banners (kể cả inactive, hết hạn) — dành cho admin quản lý.

**Auth:** `admin`

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|-------|
| `position` | string | Filter theo vị trí |
| `isActive` | boolean | Filter theo trạng thái |
| `page` | number | Trang (default: 1) |
| `limit` | number | Số item (default: 20) |

**Response `200`:** Danh sách đầy đủ với `clickCount`, `createdBy`, `startDate`, `endDate`

---

#### `POST /config/banners`

Tạo banner mới.

**Auth:** `admin`  
**Content-Type:** `multipart/form-data` hoặc `application/json`

**Request (JSON):**

```json
{
  "title":          "Banner Sale Tết 2027",
  "imageUrl":       "https://cdn.iluxury.vn/banners/tet2027.jpg",
  "mobileImageUrl": "https://cdn.iluxury.vn/banners/tet2027-mobile.jpg",
  "targetUrl":      "/promotions/tet-2027",
  "altText":        "Sale Tết 2027 - Giảm đến 30%",
  "position":       "home_main",
  "sortOrder":      1,
  "startDate":      "2027-01-15T00:00:00.000Z",
  "endDate":        "2027-02-10T23:59:59.000Z",
  "isActive":       true
}
```

**Validation:**

| Field | Rules |
|-------|-------|
| `imageUrl` | required · valid URL |
| `mobileImageUrl` | optional · valid URL |
| `targetUrl` | optional · valid URL hoặc path (`/...`) |
| `altText` | optional · max 255 chars |
| `position` | required · enum: `home_main \| home_sub \| category_top \| popup \| product_sidebar` |
| `sortOrder` | optional · integer ≥ 0 · default 0 |
| `startDate` | optional · ISO date · nếu có endDate phải < endDate |
| `endDate` | optional · ISO date · phải > startDate nếu có startDate |
| `isActive` | optional · boolean · default true |

**Response `201`:** Banner vừa tạo

---

#### `PUT /config/banners/:id`

Cập nhật banner.

**Auth:** `admin`

**Request:** Giống POST, tất cả fields optional

**Response `200`:** Banner đã cập nhật, cache invalidated

---

#### `DELETE /config/banners/:id`

Xoá banner vĩnh viễn.

**Auth:** `admin`

**Response `200`:**
```json
{ "success": true, "data": { "message": "Đã xoá banner" } }
```

---

#### `PATCH /config/banners/:id/toggle`

Bật/tắt banner nhanh.

**Auth:** `admin`

**Request:**
```json
{ "isActive": false }
```

**Response `200`:** Banner đã cập nhật

---

#### `PATCH /config/banners/reorder`

Sắp xếp lại thứ tự banner trong một position.

**Auth:** `admin`

**Request:**

```json
{
  "position":   "home_main",
  "orderedIds": ["uuid-3", "uuid-1", "uuid-2"]
}
```

**Business rule:** Tất cả ID trong `orderedIds` phải thuộc cùng `position`. sortOrder sẽ được set theo thứ tự index (1, 2, 3...).

**Response `200`:**
```json
{
  "success": true,
  "data": { "message": "Đã sắp xếp lại 3 banners" }
}
```

---

#### `POST /config/banners/:id/track-click`

Ghi nhận lượt click vào banner.

**Auth:** `public` (gọi từ frontend)

**Response `200`:**
```json
{ "success": true }
```

> **Thiết kế:** Fire-and-forget, không trả thêm thông tin để tránh lộ `clickCount` cho guest.

---

### 6.3 Internal RPC

#### `GET /internal/config/settings/:key`

Lấy setting value để các service khác dùng.

**Auth:** `X-Service-Token`

**Response `200`:**

```json
{
  "key":   "shipping_free_threshold",
  "value": "5000000",
  "type":  "number",
  "parsed": 5000000
}
```

---

#### `GET /internal/config/settings`

Lấy nhiều settings cùng lúc.

**Auth:** `X-Service-Token`

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|-------|
| `keys` | string | Danh sách keys cách nhau bằng dấu phẩy: `?keys=hotline,store_address` |

**Response `200`:**

```json
{
  "hotline":       "1800 1234",
  "store_address": "123 Nguyễn Huệ, Q1"
}
```

---

## 7. RabbitMQ Events

### 7.1 Exchange Config

```typescript
export const RABBITMQ_CONFIG = {
  exchange:     'apple_shop',
  exchangeType: 'topic',

  publish: {
    settingUpdated:      'config.setting_updated',
    maintenanceChanged:  'config.maintenance_changed',
    bannerChanged:       'config.banner_changed',
  },
};
```

---

### 7.2 PUBLISH — `config.maintenance_changed`

**Consumer:** API Gateway  
**Trigger:** Khi admin thay đổi setting `maintenance_mode`

```typescript
interface MaintenanceChangedPayload {
  isEnabled:  boolean;   // true = đang bảo trì, false = hoạt động bình thường
  updatedBy:  string;    // userId admin
  updatedAt:  string;    // ISO string
  message?:   string;    // Thông báo bảo trì (nếu admin điền)
}
```

> API Gateway nhận event này → cập nhật biến in-memory → trả `503 Service Unavailable` cho mọi request nếu `isEnabled = true`.

---

### 7.3 PUBLISH — `config.setting_updated`

**Consumer:** Notification Service (nếu setting ảnh hưởng notification), các service subscribe  
**Trigger:** Khi một setting quan trọng thay đổi

```typescript
interface SettingUpdatedPayload {
  key:        string;
  oldValue:   string | null;
  newValue:   string | null;
  group:      string;
  updatedBy:  string;
  updatedAt:  string;
}
```

---

### 7.4 PUBLISH — `config.banner_changed`

**Consumer:** CDN (tương lai — invalidate cache CDN)  
**Trigger:** Khi tạo/sửa/xoá banner

```typescript
interface BannerChangedPayload {
  action:    'created' | 'updated' | 'deleted';
  bannerId:  string;
  position:  string;
  updatedAt: string;
}
```

---

## 8. Cấu Trúc Thư Mục

```
config-service/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── config/                        # NestJS config (không nhầm với business config)
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   └── rabbitmq.config.ts
│   │
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   ├── prisma.service.ts
│   │   └── schema.prisma
│   │
│   ├── settings/
│   │   ├── settings.module.ts
│   │   ├── settings.controller.ts
│   │   ├── settings.service.ts
│   │   ├── settings.repository.ts
│   │   └── dto/
│   │       ├── create-setting.dto.ts
│   │       ├── update-setting.dto.ts
│   │       ├── bulk-upsert-setting.dto.ts
│   │       └── query-settings.dto.ts
│   │
│   ├── banners/
│   │   ├── banners.module.ts
│   │   ├── banners.controller.ts
│   │   ├── banners.service.ts
│   │   ├── banners.repository.ts
│   │   └── dto/
│   │       ├── create-banner.dto.ts
│   │       ├── update-banner.dto.ts
│   │       ├── reorder-banners.dto.ts
│   │       └── query-banners.dto.ts
│   │
│   ├── internal/
│   │   ├── internal.module.ts
│   │   └── internal.controller.ts    # /internal/config/*
│   │
│   ├── cache/
│   │   ├── cache.module.ts
│   │   └── cache.service.ts          # In-memory TTL cache
│   │
│   ├── publishers/
│   │   ├── publishers.module.ts
│   │   └── config.publisher.ts
│   │
│   ├── tasks/
│   │   ├── tasks.module.ts
│   │   └── banner.task.ts            # Cron: activate/deactivate banners
│   │
│   ├── common/
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── service-auth.guard.ts
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts
│   │   │   ├── public.decorator.ts
│   │   │   └── current-user.decorator.ts
│   │   ├── interceptors/
│   │   │   └── response.interceptor.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   └── constants/
│   │       ├── protected-keys.constant.ts
│   │       └── banner-positions.constant.ts
│   │
│   └── health/
│       ├── health.module.ts
│       └── health.controller.ts
│
├── test/
│   ├── unit/
│   │   ├── settings.service.spec.ts
│   │   ├── banners.service.spec.ts
│   │   └── cache.service.spec.ts
│   └── e2e/
│       ├── settings.e2e-spec.ts
│       └── banners.e2e-spec.ts
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│
├── .env
├── .env.example
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 9. Modules & Classes Chi Tiết

### 9.1 `SettingsController`

```typescript
@ApiTags('Settings')
@Controller('config/settings')
export class SettingsController {

  // ── Public ─────────────────────────────────────────────────

  @Get()
  @Public()
  getAllPublic() { ... }
  // → settingsService.getPublicSettings()
  // → Trả flat object đã parsed, có cache 5 phút

  @Get('group/:group')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  getByGroup(
    @Param('group') group: string,
    @Query('includePrivate') includePrivate?: boolean,
    @CurrentUser() user?: UserPayload,
  ) { ... }
  // Staff chỉ thấy public; Admin thấy tất cả khi includePrivate=true

  @Get(':key')
  getByKey(
    @Param('key') key: string,
    @CurrentUser() user?: UserPayload,
  ) { ... }
  // Public nếu isPublic=true, còn lại cần admin token

  // ── Admin ───────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateSettingDto,
    @CurrentUser() user: UserPayload,
  ) { ... }

  @Put(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() user: UserPayload,
  ) { ... }

  @Delete(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('key') key: string) { ... }
}
```

---

### 9.2 `BannersController`

```typescript
@ApiTags('Banners')
@Controller('config/banners')
export class BannersController {

  @Get()
  @Public()
  getActive(@Query('position') position?: string) { ... }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  getAll(@Query() query: QueryBannersDto) { ... }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateBannerDto,
    @CurrentUser() user: UserPayload,
  ) { ... }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBannerDto,
    @CurrentUser() user: UserPayload,
  ) { ... }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) { ... }

  @Patch(':id/toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  toggle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleBannerDto,
  ) { ... }

  @Patch('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  reorder(@Body() dto: ReorderBannersDto) { ... }

  @Post(':id/track-click')
  @Public()
  @HttpCode(HttpStatus.OK)
  trackClick(@Param('id', ParseUUIDPipe) id: string) { ... }
}
```

---

### 9.3 `SettingsService`

```typescript
@Injectable()
export class SettingsService {

  // Các key không được xoá
  private readonly PROTECTED_KEYS = new Set([
    'maintenance_mode', 'site_name', 'logo_url', 'favicon_url',
    'hotline', 'shipping_free_threshold', 'max_cart_items',
  ]);

  constructor(
    private readonly prisma:     PrismaService,
    private readonly cache:      CacheService,
    private readonly publisher:  ConfigPublisher,
    private readonly logger:     Logger,
  ) {}

  async getPublicSettings(): Promise<ParsedSettings> {
    const cached = this.cache.get<ParsedSettings>('settings:public');
    if (cached) return cached;

    const settings = await this.prisma.setting.findMany({
      where:   { isPublic: true },
      orderBy: { group: 'asc' },
    });
    const parsed = this.parseSettings(settings);
    this.cache.set('settings:public', parsed, 300);
    return parsed;
  }

  async findByKey(key: string, isAdmin: boolean): Promise<Setting> {
    const cacheKey = `setting:${key}`;
    const cached   = this.cache.get<Setting>(cacheKey);
    if (cached) {
      if (!isAdmin && !cached.isPublic) throw new SettingNotPublicException();
      return cached;
    }

    const setting = await this.prisma.setting.findUnique({
      where: { settingKey: key },
    });
    if (!setting) throw new SettingNotFoundException(key);
    if (!isAdmin && !setting.isPublic) throw new SettingNotPublicException();

    this.cache.set(cacheKey, setting, 300);
    return setting;
  }

  async create(dto: CreateSettingDto, adminId: string): Promise<Setting> {
    // Validate key format
    if (!/^[a-z][a-z0-9_]*$/.test(dto.key))
      throw new InvalidKeyFormatException(dto.key);

    // Check duplicate
    const exists = await this.prisma.setting.findUnique({
      where: { settingKey: dto.key },
    });
    if (exists) throw new SettingKeyExistsException(dto.key);

    // Validate value theo type
    this.validateSettingValue(dto.value, dto.type);

    const setting = await this.prisma.setting.create({
      data: {
        settingKey:   dto.key,
        settingValue: dto.value,
        settingType:  dto.type,
        group:        dto.group,
        description:  dto.description ?? null,
        isPublic:     dto.isPublic ?? true,
        updatedBy:    adminId,
      },
    });

    this.invalidateSettingCache(setting.group, dto.key);
    return setting;
  }

  async update(key: string, dto: UpdateSettingDto, adminId: string): Promise<Setting> {
    const existing = await this.prisma.setting.findUnique({
      where: { settingKey: key },
    });
    if (!existing) throw new SettingNotFoundException(key);

    const typeToValidate = dto.settingType ?? existing.settingType;
    this.validateSettingValue(dto.value, typeToValidate as SettingType);

    const updated = await this.prisma.setting.update({
      where: { settingKey: key },
      data: {
        settingValue: dto.value,
        updatedBy:    adminId,
        ...(dto.settingType  !== undefined ? { settingType:  dto.settingType }  : {}),
        ...(dto.description  !== undefined ? { description:  dto.description }  : {}),
        ...(dto.isPublic     !== undefined ? { isPublic:     dto.isPublic }     : {}),
      },
    });

    this.invalidateSettingCache(existing.group, key);
    await this.publishSettingUpdated(key, existing.settingValue, dto.value, adminId, updated.updatedAt);

    return updated;
  }

  async remove(key: string): Promise<void> {
    if (this.PROTECTED_KEYS.has(key))
      throw new SettingProtectedException(key);

    const existing = await this.prisma.setting.findUnique({
      where: { settingKey: key },
    });
    if (!existing) throw new SettingNotFoundException(key);

    await this.prisma.setting.delete({ where: { settingKey: key } });
    this.invalidateSettingCache(existing.group, key);
  }

  private invalidateSettingCache(group: string, key: string): void {
    this.cache.delete(`setting:${key}`);
    this.cache.delete(`settings:group:${group}`);
    this.cache.delete('settings:public');
  }

  private async publishSettingUpdated(
    key:      string,
    oldValue: string | null,
    newValue: string,
    adminId:  string,
    updatedAt: Date,
  ): Promise<void> {
    const criticalKeys = [
      'maintenance_mode', 'shipping_free_threshold',
      'max_cart_items', 'site_name',
    ];

    if (criticalKeys.includes(key)) {
      await this.publisher.publish('config.setting_updated', {
        key, oldValue, newValue,
        updatedBy: adminId,
        updatedAt: updatedAt.toISOString(),
      });
    }

    if (key === 'maintenance_mode') {
      await this.publisher.publish('config.maintenance_changed', {
        isEnabled: newValue === 'true',
        updatedBy: adminId,
        updatedAt: updatedAt.toISOString(),
      });
    }
  }

  private parseSettings(settings: Setting[]): ParsedSettings {
    return Object.fromEntries(
      settings.map(s => [s.settingKey, this.parseValue(s)])
    );
  }

  private parseValue(s: Setting): string | number | boolean | unknown | null {
    if (s.settingValue === null) return null;
    switch (s.settingType) {
      case 'number':  return Number(s.settingValue);
      case 'boolean': return s.settingValue === 'true';
      case 'json':    try { return JSON.parse(s.settingValue); } catch { return s.settingValue; }
      default:        return s.settingValue;
    }
  }

  private validateSettingValue(value: string, type: SettingType): void { ... }
}
```

---

## 10. DTOs & Validation

### 10.1 `CreateSettingDto`

```typescript
export class CreateSettingDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'Key phải là snake_case: chữ thường, số và dấu gạch dưới',
  })
  @MaxLength(255)
  key: string;

  @IsString()
  value: string;

  @IsEnum(SettingType)
  type: SettingType;

  @IsEnum(['general', 'contact', 'social', 'policy', 'payment', 'notification'])
  group: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean = true;
}
```

### 10.2 `UpdateSettingDto`

```typescript
export class UpdateSettingDto {
  @IsString()
  value: string;
  // Validate theo settingType của existing setting

  @IsOptional()
  @IsEnum(SettingType)
  settingType?: SettingType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
```

### 10.3 `CreateBannerDto`

```typescript
export class CreateBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsUrl()
  imageUrl: string;

  @IsOptional()
  @IsUrl()
  mobileImageUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(https?:\/\/|\/|#)/, {
    message: 'targetUrl phải là URL đầy đủ, đường dẫn / hoặc anchor #',
  })
  targetUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string;

  @IsEnum(['home_main', 'home_sub', 'category_top', 'popup', 'product_sidebar'])
  position: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number = 0;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  // Custom validator: endDate phải > startDate
  @ValidateIf(o => o.startDate && o.endDate)
  @IsDate()
  @MinDate(new Date()) // endDate không được là quá khứ
  private validateDates() {
    if (this.startDate && this.endDate) {
      if (new Date(this.endDate) <= new Date(this.startDate)) {
        throw new Error('endDate phải sau startDate');
      }
    }
  }
}
```

### 10.4 `ReorderBannersDto`

```typescript
export class ReorderBannersDto {
  @IsEnum(['home_main', 'home_sub', 'category_top', 'popup', 'product_sidebar'])
  position: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  orderedIds: string[];
}
```

---

## 11. Error Handling

### 11.1 Custom Exceptions

```typescript
export class SettingNotFoundException extends NotFoundException {
  constructor(key: string) {
    super({ code: 'SETTING_NOT_FOUND', message: `Setting "${key}" không tồn tại` });
  }
}

export class SettingNotPublicException extends ForbiddenException {
  constructor() {
    super({ code: 'SETTING_NOT_PUBLIC', message: 'Setting này là private, cần quyền admin' });
  }
}

export class SettingKeyExistsException extends ConflictException {
  constructor(key: string) {
    super({ code: 'SETTING_KEY_EXISTS', message: `Key "${key}" đã tồn tại` });
  }
}

export class SettingProtectedException extends ForbiddenException {
  constructor(key: string) {
    super({ code: 'SETTING_PROTECTED', message: `Setting "${key}" là system key, không thể xoá` });
  }
}

export class InvalidKeyFormatException extends BadRequestException {
  constructor(key: string) {
    super({ code: 'INVALID_KEY_FORMAT', message: `Key "${key}" không đúng định dạng snake_case` });
  }
}

export class InvalidSettingValueException extends BadRequestException {
  constructor(value: string, type: string) {
    super({ code: 'INVALID_SETTING_VALUE', message: `Giá trị "${value}" không hợp lệ cho type "${type}"` });
  }
}

export class UnsafeHtmlException extends BadRequestException {
  constructor() {
    super({ code: 'UNSAFE_HTML', message: 'HTML chứa nội dung không an toàn (script/XSS)' });
  }
}

export class BannerNotFoundException extends NotFoundException {
  constructor(id: string) {
    super({ code: 'BANNER_NOT_FOUND', message: `Banner "${id}" không tồn tại` });
  }
}

export class BannerPositionMismatchException extends BadRequestException {
  constructor() {
    super({ code: 'BANNER_POSITION_MISMATCH', message: 'Một số banner ID không thuộc position được chỉ định' });
  }
}

export class InvalidDateRangeException extends BadRequestException {
  constructor() {
    super({ code: 'INVALID_DATE_RANGE', message: 'endDate phải sau startDate' });
  }
}
```

### 11.2 Error Code Registry

| Code | HTTP | Trigger |
|------|------|---------|
| `SETTING_NOT_FOUND` | 404 | Key không tồn tại |
| `SETTING_NOT_PUBLIC` | 403 | Setting private, guest cố đọc |
| `SETTING_KEY_EXISTS` | 409 | Tạo setting với key đã có |
| `SETTING_PROTECTED` | 403 | Cố xoá system key |
| `INVALID_KEY_FORMAT` | 400 | Key không phải snake_case |
| `INVALID_SETTING_VALUE` | 400 | Value không đúng type |
| `UNSAFE_HTML` | 400 | HTML có XSS risk |
| `BANNER_NOT_FOUND` | 404 | Banner ID không tồn tại |
| `BANNER_POSITION_MISMATCH` | 400 | ID không thuộc position khi reorder |
| `INVALID_DATE_RANGE` | 400 | endDate ≤ startDate |

---

## 12. Guards & Authorization

### 12.1 Role Matrix

| Endpoint | guest | customer | staff | admin | internal |
|----------|-------|----------|-------|-------|----------|
| `GET /config/settings` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /config/settings/:key` (public) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /config/settings/:key` (private) | ❌ | ❌ | ❌ | ✅ | ✅ |
| `GET /config/settings/group/:group` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `POST /config/settings` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `PUT /config/settings/:key` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `DELETE /config/settings/:key` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `GET /config/banners` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /config/banners/all` | ❌ | ❌ | ✅ | ✅ | ❌ |
| `POST /config/banners` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `PUT /config/banners/:id` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `DELETE /config/banners/:id` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `PATCH /config/banners/:id/toggle` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `PATCH /config/banners/reorder` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `POST /config/banners/:id/track-click` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `GET /internal/config/settings/*` | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 13. Configuration & Environment

### 13.1 `.env`

```env
# App
NODE_ENV=development
PORT=3011
SERVICE_NAME=config-service

# Database (Prisma 5)
DATABASE_URL="mysql://root:password@localhost:3306/db_config"

# RabbitMQ
AMQP_URL="amqp://guest:guest@localhost:5672"

# Internal service auth
INTERNAL_SERVICE_TOKEN=random-service-secret-token

# Cache
SETTINGS_CACHE_TTL_SECONDS=300
BANNERS_CACHE_TTL_SECONDS=120

# HTML Sanitize
ALLOW_HTML_IFRAME=true

# Business rules
MAX_BANNERS_PER_POSITION=10
```

### 13.2 `package.json`

```json
{
  "name": "config-service",
  "scripts": {
    "build":        "nest build",
    "start":        "nest start",
    "start:dev":    "nest start --watch",
    "start:prod":   "node dist/main",
    "test":         "jest",
    "test:cov":     "jest --coverage",
    "test:e2e":     "jest --config ./test/jest-e2e.json",
    "db:migrate":   "prisma migrate dev",
    "db:generate":  "prisma generate",
    "db:seed":      "ts-node prisma/seed.ts",
    "db:studio":    "prisma studio"
  },
  "dependencies": {
    "@nestjs/common":       "^10.x",
    "@nestjs/core":         "^10.x",
    "@nestjs/config":       "^3.x",
    "@nestjs/schedule":     "^4.x",
    "@nestjs/terminus":     "^10.x",
    "@prisma/client":       "^5.x",
    "amqplib":              "^0.10.x",
    "class-transformer":    "^0.5.x",
    "class-validator":      "^0.14.x",
    "sanitize-html":        "^2.x",
    "rxjs":                 "^7.x"
  },
  "devDependencies": {
    "prisma":                  "^5.x",
    "@types/sanitize-html":    "^2.x",
    "@types/amqplib":          "^0.10.x",
    "jest":                    "^29.x",
    "@types/jest":             "^29.x",
    "ts-jest":                 "^29.x",
    "supertest":               "^6.x",
    "@nestjs/testing":         "^10.x"
  }
}
```

---

## 14. Testing Strategy

### 14.1 Unit Tests — `SettingsService`

```typescript
describe('SettingsService', () => {

  describe('getPublicSettings', () => {
    it('should return cached result on second call', async () => {
      await service.getPublicSettings(); // cold
      await service.getPublicSettings(); // warm
      expect(prisma.setting.findMany).toHaveBeenCalledTimes(1); // DB chỉ query 1 lần
    });

    it('should parse number values correctly', async () => {
      // Mock setting: { key: 'max_cart_items', value: '10', type: 'number' }
      const result = await service.getPublicSettings();
      expect(result['max_cart_items']).toBe(10);         // number, không phải string
      expect(typeof result['max_cart_items']).toBe('number');
    });

    it('should parse boolean values correctly', async () => {
      // Mock: { key: 'maintenance_mode', value: 'false', type: 'boolean' }
      const result = await service.getPublicSettings();
      expect(result['maintenance_mode']).toBe(false);
    });

    it('should not include private settings', async () => {
      // Mock: isPublic=false setting 'vnpay_merchant_id'
      const result = await service.getPublicSettings();
      expect(result).not.toHaveProperty('vnpay_merchant_id');
    });
  });

  describe('update', () => {
    it('should invalidate cache after update', async () => {
      const invalidateSpy = jest.spyOn(cacheService, 'delete');
      await service.update('hotline', { value: '1900 1234' }, adminId);
      expect(invalidateSpy).toHaveBeenCalledWith('setting:hotline');
      expect(invalidateSpy).toHaveBeenCalledWith('settings:public');
    });

    it('should publish maintenance_changed when maintenance_mode updated', async () => {
      const publishSpy = jest.spyOn(publisher, 'publish');
      await service.update('maintenance_mode', { value: 'true' }, adminId);
      expect(publishSpy).toHaveBeenCalledWith(
        'config.maintenance_changed',
        expect.objectContaining({ isEnabled: true }),
      );
    });

    it('should throw InvalidSettingValueException for wrong type', async () => {
      // Existing setting type = 'number', try set value = 'abc'
      await expect(
        service.update('max_cart_items', { value: 'not-a-number' }, adminId)
      ).rejects.toThrow(InvalidSettingValueException);
    });
  });

  describe('remove', () => {
    it('should throw SettingProtectedException for system keys', async () => {
      await expect(service.remove('maintenance_mode'))
        .rejects.toThrow(SettingProtectedException);
    });

    it('should delete non-protected setting', async () => {
      await service.remove('custom_key');
      expect(prisma.setting.delete).toHaveBeenCalled();
    });
  });

  describe('validateSettingValue', () => {
    it('should throw for invalid number', () => {
      expect(() => service['validateSettingValue']('abc', 'number'))
        .toThrow(InvalidSettingValueException);
    });

    it('should throw for invalid boolean', () => {
      expect(() => service['validateSettingValue']('yes', 'boolean'))
        .toThrow(InvalidSettingValueException);
    });

    it('should throw for invalid JSON', () => {
      expect(() => service['validateSettingValue']('{invalid}', 'json'))
        .toThrow(InvalidSettingValueException);
    });

    it('should pass for valid values', () => {
      expect(() => service['validateSettingValue']('42', 'number')).not.toThrow();
      expect(() => service['validateSettingValue']('true', 'boolean')).not.toThrow();
      expect(() => service['validateSettingValue']('{"a":1}', 'json')).not.toThrow();
      expect(() => service['validateSettingValue']('<h1>Hi</h1>', 'html')).not.toThrow();
    });
  });
});
```

### 14.2 Unit Tests — `BannersService`

```typescript
describe('BannersService', () => {

  describe('getActiveBanners', () => {
    it('should only return banners where now is in [startDate, endDate]', async () => {
      // Mock:
      //   banner1: startDate=past,  endDate=future → SHOW
      //   banner2: startDate=future, endDate=null   → HIDE (not started)
      //   banner3: startDate=null,  endDate=past    → HIDE (expired)
      //   banner4: startDate=null,  endDate=null    → SHOW
      const result = await service.getActiveBanners();
      expect(result).toHaveLength(2); // banner1 + banner4
    });

    it('should filter by position when provided', async () => {
      const result = await service.getActiveBanners('home_main');
      // Expected: only home_main banners
    });
  });

  describe('reorderBanners', () => {
    it('should update sortOrder in correct sequence', async () => {
      // orderedIds = ['id-3', 'id-1', 'id-2']
      // Expected: id-3 → sortOrder=1, id-1 → sortOrder=2, id-2 → sortOrder=3
    });

    it('should throw when IDs belong to different positions', async () => {
      // Mock: 'id-x' is in 'home_sub', not 'home_main'
      await expect(
        service.reorderBanners('home_main', ['id-1', 'id-x'])
      ).rejects.toThrow(BannerPositionMismatchException);
    });
  });

  describe('deactivateExpiredBanners (cron)', () => {
    it('should deactivate banners past endDate', async () => {
      // Mock: banner with endDate = yesterday, isActive = true
      await service['deactivateExpiredBanners']();
      expect(prisma.banner.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } })
      );
    });
  });
});
```

### 14.3 Unit Tests — `CacheService`

```typescript
describe('CacheService', () => {

  it('should return null for expired key', async () => {
    cache.set('test', 'value', 1); // TTL 1 giây
    await new Promise(r => setTimeout(r, 1100)); // Đợi 1.1s
    expect(cache.get('test')).toBeNull();
  });

  it('should delete by pattern', () => {
    cache.set('banners:home_main', [], 60);
    cache.set('banners:home_sub',  [], 60);
    cache.set('settings:public',   {}, 60);

    cache.deleteByPattern('banners:*');

    expect(cache.get('banners:home_main')).toBeNull();
    expect(cache.get('banners:home_sub')).toBeNull();
    expect(cache.get('settings:public')).not.toBeNull(); // Không bị ảnh hưởng
  });
});
```

### 14.4 E2E Tests

```typescript
describe('Config Service (e2e)', () => {

  it('GET /config/settings — returns parsed values', async () => {
    const res = await request(app)
      .get('/config/settings')
      .expect(200);

    expect(typeof res.body.data.max_cart_items).toBe('number'); // parsed
    expect(typeof res.body.data.maintenance_mode).toBe('boolean');
    expect(res.body.data).not.toHaveProperty('vnpay_merchant_id'); // private
  });

  it('PUT /config/settings/maintenance_mode — publishes event', async () => {
    const publishSpy = jest.spyOn(publisher, 'publish');

    await request(app)
      .put('/config/settings/maintenance_mode')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 'true' })
      .expect(200);

    expect(publishSpy).toHaveBeenCalledWith(
      'config.maintenance_changed',
      expect.objectContaining({ isEnabled: true }),
    );
  });

  it('PATCH /config/banners/reorder — updates sortOrder', async () => {
    const [b1, b2, b3] = await createThreeBanners('home_main');

    await request(app)
      .patch('/config/banners/reorder')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ position: 'home_main', orderedIds: [b3.id, b1.id, b2.id] })
      .expect(200);

    const [r3, r1, r2] = await getBannersSortedByOrder('home_main');
    expect(r3.id).toBe(b3.id); // Đứng đầu
    expect(r3.sortOrder).toBe(1);
  });

  it('POST /config/banners/:id/track-click — increments clickCount', async () => {
    const banner = await createBanner();
    await request(app)
      .post(`/config/banners/${banner.id}/track-click`)
      .expect(200);
    const updated = await getBanner(banner.id);
    expect(updated.clickCount).toBe(1);
  });

  it('DELETE /config/settings/maintenance_mode — 403 protected', async () => {
    await request(app)
      .delete('/config/settings/maintenance_mode')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });
});
```

### 14.5 Coverage Targets

| Module | Target |
|--------|--------|
| `SettingsService` | ≥ 90% |
| `BannersService` | ≥ 90% |
| `CacheService` | ≥ 95% |
| `SettingsRepository` | ≥ 80% |
| `BannersRepository` | ≥ 80% |
| **Overall** | **≥ 85%** |

---

*Config Service Design Document · v1.0 · Prisma 5 · iLuxury Apple Shop*
