# Review Service — Tài Liệu Thiết Kế Backend Chi Tiết

> **Dự án:** iLuxury Apple Shop  
> **Service:** Review Service  
> **Stack:** NestJS · Prisma · MySQL · RabbitMQ · Sharp (image resize)  
> **Port:** `3010`  
> **Database:** `db_reviews`  
> **Phiên bản:** 1.0

---

## Mục Lục

1. [Tổng Quan Service](#1-tổng-quan-service)
2. [Kiến Trúc & Giao Tiếp](#2-kiến-trúc--giao-tiếp)
3. [Database Design](#3-database-design)
4. [Business Logic](#4-business-logic)
5. [API Endpoints](#5-api-endpoints)
6. [RabbitMQ Events](#6-rabbitmq-events)
7. [Cấu Trúc Thư Mục](#7-cấu-trúc-thư-mục)
8. [Modules & Classes Chi Tiết](#8-modules--classes-chi-tiết)
9. [DTOs & Validation](#9-dtos--validation)
10. [Error Handling](#10-error-handling)
11. [Guards & Authorization](#11-guards--authorization)
12. [Configuration & Environment](#12-configuration--environment)
13. [Testing Strategy](#13-testing-strategy)

---

## 1. Tổng Quan Service

### 1.1 Trách Nhiệm

Review Service quản lý **toàn bộ nội dung do người dùng tạo ra (UGC)** liên quan đến sản phẩm, bao gồm hai nhóm chính:

| Nhóm | Chức năng |
|------|----------|
| **Reviews** (Đánh giá) | Đánh giá sao + nội dung sau khi mua hàng, đính kèm ảnh, chỉ được viết khi đơn hàng `completed` |
| **Comments** (Bình luận) | Hỏi đáp sản phẩm công khai, hỗ trợ reply lồng nhau, cả khách mua lẫn nhân viên trả lời |

### 1.2 Ràng Buộc Nghiệp Vụ Quan Trọng

```
REVIEW:
  ✅ Chỉ viết được khi order.status = 'completed'
  ✅ Mỗi (userId, productId, orderId) chỉ review 1 lần
  ✅ Phải là chủ đơn hàng (userId khớp với order.userId)
  ✅ Ảnh đính kèm: tối đa 5 ảnh, mỗi ảnh < 5MB, JPEG/PNG/WEBP
  ✅ Rating: 1–5 sao nguyên
  ❌ Không sửa review sau khi đăng (chỉ admin ẩn)

COMMENT:
  ✅ Mọi user đã đăng nhập đều comment được
  ✅ Guest không comment được
  ✅ Reply tối đa 2 cấp (comment gốc → reply cấp 1 → reply cấp 2, không sâu hơn)
  ✅ Chỉ chủ comment mới xoá được, trừ admin
  ✅ Admin và staff được reply (trả lời khách)
  ✅ Chỉnh sửa trong vòng 15 phút sau khi đăng
```

### 1.3 Actors

| Actor | Review | Comment |
|-------|--------|---------|
| `guest` | Chỉ đọc | Chỉ đọc |
| `customer` | Viết (nếu đủ điều kiện) · Đọc | Viết, sửa trong 15 phút, xoá của mình |
| `staff` | Đọc tất cả | Reply, xoá bình luận vi phạm |
| `admin` | Đọc tất cả · Ẩn/hiện | Reply · Ẩn/hiện · Xoá |

### 1.4 Phạm Vi

| Trong scope | Ngoài scope |
|-------------|-------------|
| CRUD Review & Comment | Thông tin sản phẩm (Product Service) |
| Verify order eligibility qua RPC | Xử lý đơn hàng (Order Service) |
| Tính toán rating aggregate | Thông tin user (User Service) |
| Upload ảnh review | Gửi notification khi có reply (Notification Service) |
| Moderation (ẩn/hiện) | Báo cáo/report nội dung vi phạm (tương lai) |

---

## 2. Kiến Trúc & Giao Tiếp

### 2.1 Vị Trí Trong Hệ Thống

```
┌──────────────────────────────────────────────────────────────────┐
│                         API GATEWAY                              │
└──────────┬─────────────────────────────────────┬─────────────────┘
           │ HTTP (REST) public                  │ HTTP (REST) internal
  ┌────────▼─────────────┐              ┌────────▼──────────────┐
  │   REVIEW SERVICE     │              │   ORDER SERVICE       │
  │   Port: 3010         │◄─── RPC ────│   (verify eligibility)│
  │   DB: db_reviews     │              └───────────────────────┘
  └────────┬─────────────┘
           │ RPC calls                   ┌───────────────────────┐
           ├────────────────────────────►│   USER SERVICE        │
           │                             │   (lấy user info)     │
           │                             └───────────────────────┘
           │ RPC calls
           ├────────────────────────────►┌───────────────────────┐
           │                             │   PRODUCT SERVICE     │
           │                             │   (verify product)    │
           │                             └───────────────────────┘
           │ PUBLISH events
           └────────────────────────────►┌───────────────────────┐
                                         │ NOTIFICATION SERVICE  │
                                         │  review.created       │
                                         │  comment.replied      │
                                         └───────────────────────┘
```

### 2.2 Bảng Giao Tiếp

| Loại | Hướng | Service | Mục đích |
|------|-------|---------|---------|
| HTTP RPC | Outbound | Order Service | Verify `order.status = completed` + `order.userId = currentUser` trước khi cho review |
| HTTP RPC | Outbound | Product Service | Verify `productId` tồn tại + lấy tên sản phẩm để lưu snapshot |
| HTTP RPC | Outbound | User Service | Lấy `fullName`, `avatarUrl` để trả kèm response (không lưu trong DB) |
| RabbitMQ PUBLISH | Outbound | Notification Service | `review.created`, `comment.replied` |
| HTTP REST | Inbound | API Gateway | Mọi endpoint public |
| HTTP RPC | Inbound | Product Service | `GET /internal/reviews/products/:id/stats` — lấy rating tổng hợp |

### 2.3 Luồng Tạo Review (Verify Chain)

```
CUSTOMER          REVIEW SERVICE         ORDER SERVICE     PRODUCT SERVICE
    │                    │                     │                 │
    │── POST /reviews ──>│                     │                 │
    │   { orderId,       │                     │                 │
    │     productId,     │── RPC: verify ─────>│                 │
    │     rating,        │  GET /internal/     │                 │
    │     content,       │  orders/:orderId    │                 │
    │     images[] }     │<── { status,        │                 │
    │                    │     userId,         │                 │
    │                    │     items[] } ──────│                 │
    │                    │                     │                 │
    │                    │── Validate:         │                 │
    │                    │   status='completed'│                 │
    │                    │   userId = current  │                 │
    │                    │   productId in items│                 │
    │                    │                     │                 │
    │                    │── RPC: verify ─────────────────────>  │
    │                    │  GET /internal/                       │
    │                    │  products/:productId                  │
    │                    │<── { id, name, ... } ────────────────│
    │                    │                     │                 │
    │                    │── Check: đã review  │                 │
    │                    │   (userId,productId │                 │
    │                    │    orderId) unique? │                 │
    │                    │                     │                 │
    │                    │── Upload ảnh → CDN  │                 │
    │                    │── Lưu REVIEWS       │                 │
    │                    │── PUBLISH review.created              │
    │<── 201 { review }  │                     │                 │
```

### 2.4 Luồng Reply Comment

```
CUSTOMER/STAFF/ADMIN      REVIEW SERVICE        NOTIFICATION SERVICE
        │                        │                       │
        │── POST /comments/:id/reply                     │
        │   { content }          │                       │
        │                        │── Validate parentId   │
        │                        │   parentId tồn tại?   │
        │                        │── Check depth ≤ 2     │
        │                        │   (không reply vào reply cấp 2)
        │                        │── Tạo comment mới     │
        │                        │   parentId = :id      │
        │                        │── PUBLISH comment.replied
        │                        │──────────────────────>│
        │                        │   { targetUserId,     │
        │                        │     commenterName,    │
        │                        │     productId }       │
        │<── 201 { comment }     │                       │── Push notify
                                                         │   "Có người trả lời bình luận của bạn"
```

---

## 3. Database Design

### 3.1 Prisma Schema Đầy Đủ

```prisma
// ============================================================
// Review Service — db_reviews
// prisma/schema.prisma
// ============================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL") // mysql://user:pass@host:3306/db_reviews
}

// ------------------------------------------------------------
// REVIEWS
// Đánh giá sản phẩm sau khi mua hàng thành công
//
// Cross-service refs (không có @relation vật lý):
//   userId:    [REF: db_users.USERS.id]
//   productId: [REF: db_products.PRODUCTS.id]
//   orderId:   [REF: db_orders.ORDERS.id]
// ------------------------------------------------------------
model Review {
  id        String   @id @default(uuid()) @db.Char(36)
  userId    String   @map("user_id") @db.Char(36)
  productId String   @map("product_id") @db.Char(36)
  orderId   String   @map("order_id") @db.Char(36)

  rating    Int
  // 1–5 sao nguyên, CHECK constraint tại application layer

  content   String?  @db.Text
  // Nội dung đánh giá, optional

  images    Json?
  // Mảng URL ảnh: ["https://cdn.../r1.jpg", "https://cdn.../r2.jpg"]
  // Tối đa 5 ảnh

  isVisible Boolean  @default(true) @map("is_visible")
  // false = admin đã ẩn vì vi phạm

  adminNote String?  @map("admin_note") @db.VarChar(500)
  // Ghi chú nội bộ của admin khi ẩn review

  // Snapshot thông tin tại thời điểm viết review
  // (phòng trường hợp user đổi tên sau này)
  userNameSnapshot    String?  @map("user_name_snapshot") @db.VarChar(255)
  productNameSnapshot String?  @map("product_name_snapshot") @db.VarChar(255)

  createdAt DateTime @default(now()) @map("created_at")

  @@unique([userId, productId, orderId])
  @@index([productId])
  @@index([productId, isVisible])
  @@index([userId])
  @@index([rating])
  @@map("REVIEWS")
}

// ------------------------------------------------------------
// COMMENTS
// Bình luận & hỏi đáp sản phẩm — hỗ trợ reply lồng nhau tối đa 2 cấp
//
// Cross-service refs:
//   userId:    [REF: db_users.USERS.id]
//   productId: [REF: db_products.PRODUCTS.id]
// ------------------------------------------------------------
model Comment {
  id        String   @id @default(uuid()) @db.Char(36)
  productId String   @map("product_id") @db.Char(36)
  userId    String   @map("user_id") @db.Char(36)

  parentId  String?  @map("parent_id") @db.Char(36)
  // null = comment gốc (depth = 0)
  // có giá trị = reply (depth = 1 hoặc 2)

  depth     Int      @default(0)
  // 0 = comment gốc, 1 = reply cấp 1, 2 = reply cấp 2
  // Giới hạn tối đa depth = 2, không reply sâu hơn

  content   String   @db.Text

  isVisible Boolean  @default(true) @map("is_visible")

  adminNote String?  @map("admin_note") @db.VarChar(500)

  editedAt  DateTime? @map("edited_at")
  // null = chưa chỉnh sửa, có giá trị = đã sửa

  // Snapshot tại thời điểm comment
  userNameSnapshot String? @map("user_name_snapshot") @db.VarChar(255)
  userRoleSnapshot String? @map("user_role_snapshot") @db.VarChar(50)
  // "customer" | "staff" | "admin" — để hiện badge "Nhân viên iLuxury"

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

### 3.2 Giải Thích Thiết Kế

#### Tại sao lưu `depth` thay vì tính động?

```
Tính động (recursive query):
  → Cần query đệ quy hoặc multiple round-trips
  → Khó giới hạn depth khi insert mới

Lưu `depth`:
  → Khi tạo reply: depth = parent.depth + 1
  → Validate ngay: if (parent.depth >= 2) → throw MaxDepthException
  → Query lấy comments chỉ cần 1 round-trip
  → Index trên depth để filter nhanh
```

#### Tại sao có `snapshot` fields?

```
Vấn đề: User đổi tên, ảnh → review cũ vẫn phải hiển thị đúng
  - Không lưu: Phải gọi User Service mỗi lần load (N+1 problem)
  - Lưu snapshot: 1 lần gọi User Service khi tạo, sau đó không cần nữa

Snapshot lưu khi tạo:
  REVIEWS.userNameSnapshot    = user.fullName
  REVIEWS.productNameSnapshot = product.name
  COMMENTS.userNameSnapshot   = user.fullName
  COMMENTS.userRoleSnapshot   = user.highestRole (staff/admin → badge)
```

#### Rating Index Strategy

```
Index (productId) → filter reviews của 1 sản phẩm
Index (productId, isVisible) → lấy visible reviews để tính aggregate
Index (rating) → phân tích rating distribution nhanh

Rating aggregate được tính ON-THE-FLY (không cache):
  SELECT
    COUNT(*) as total,
    AVG(rating) as average,
    SUM(rating = 5) as five_star,
    SUM(rating = 4) as four_star,
    ...
  FROM REVIEWS
  WHERE productId = :id AND isVisible = true

→ Acceptable vì: ít write, nhiều read, index đã đủ nhanh
→ Nếu scale lớn: dùng materialized view hoặc cache Redis
```

### 3.3 Index Strategy Đầy Đủ

| Index | Columns | Query nào dùng |
|-------|---------|---------------|
| `uq_reviews` | `(userId, productId, orderId)` | Validate unique khi tạo |
| `idx_review_product` | `productId` | List reviews theo sản phẩm |
| `idx_review_product_visible` | `(productId, isVisible)` | Lấy reviews hiển thị |
| `idx_review_user` | `userId` | "Đánh giá của tôi" |
| `idx_review_rating` | `rating` | Filter/sort theo sao |
| `idx_comment_product_parent` | `(productId, parentId)` | Load comment tree |
| `idx_comment_product_visible` | `(productId, isVisible)` | Lấy comments hiển thị |
| `idx_comment_user` | `userId` | Comments của 1 user |

---

## 4. Business Logic

### 4.1 Tạo Review

```typescript
async createReview(dto: CreateReviewDto, currentUserId: string): Promise<ReviewResponse> {

  // STEP 1: Verify order eligibility (RPC → Order Service)
  const order = await this.orderRpc.getOrderById(dto.orderId);

  if (!order)
    throw new OrderNotFoundException();
  if (order.userId !== currentUserId)
    throw new NotOrderOwnerException();
  if (order.status !== 'completed')
    throw new OrderNotCompletedException();

  const variantInOrder = order.items.some(
    item => item.productId === dto.productId
  );
  if (!variantInOrder)
    throw new ProductNotInOrderException();

  // STEP 2: Verify product exists (RPC → Product Service)
  const product = await this.productRpc.getProductById(dto.productId);
  if (!product)
    throw new ProductNotFoundException();

  // STEP 3: Verify chưa review
  const existing = await this.reviewRepo.findByUniqueKey(
    currentUserId, dto.productId, dto.orderId
  );
  if (existing)
    throw new AlreadyReviewedException();

  // STEP 4: Upload ảnh (nếu có)
  let imageUrls: string[] = [];
  if (dto.images?.length) {
    imageUrls = await this.uploadService.uploadReviewImages(
      dto.images, currentUserId
    );
  }

  // STEP 5: Lấy user info để snapshot
  const user = await this.userRpc.getUserById(currentUserId);

  // STEP 6: Lưu review
  const review = await this.reviewRepo.create({
    userId:              currentUserId,
    productId:           dto.productId,
    orderId:             dto.orderId,
    rating:              dto.rating,
    content:             dto.content ?? null,
    images:              imageUrls.length ? imageUrls : null,
    userNameSnapshot:    user.detail?.fullName ?? user.userName,
    productNameSnapshot: product.name,
  });

  // STEP 7: Publish event
  await this.publisher.publish('review.created', {
    reviewId:  review.id,
    userId:    currentUserId,
    productId: dto.productId,
    rating:    dto.rating,
  });

  return this.mapToResponse(review, user);
}
```

### 4.2 Tạo Comment

```typescript
async createComment(dto: CreateCommentDto, currentUserId: string, userRoles: string[]): Promise<CommentResponse> {

  // STEP 1: Verify product tồn tại
  const product = await this.productRpc.getProductById(dto.productId);
  if (!product) throw new ProductNotFoundException();

  // STEP 2: Lấy user info
  const user = await this.userRpc.getUserById(currentUserId);

  // STEP 3: Xác định role badge
  const roleBadge = userRoles.includes('admin') || userRoles.includes('staff')
    ? userRoles.includes('admin') ? 'admin' : 'staff'
    : 'customer';

  // STEP 4: Lưu comment (depth = 0, parentId = null)
  const comment = await this.commentRepo.create({
    productId:        dto.productId,
    userId:           currentUserId,
    parentId:         null,
    depth:            0,
    content:          dto.content,
    userNameSnapshot: user.detail?.fullName ?? user.userName,
    userRoleSnapshot: roleBadge,
  });

  return this.mapCommentToResponse(comment, user);
}
```

### 4.3 Reply Comment

```typescript
async replyComment(
  parentId:      string,
  dto:           ReplyCommentDto,
  currentUserId: string,
  userRoles:     string[],
): Promise<CommentResponse> {

  // STEP 1: Tìm parent comment
  const parent = await this.commentRepo.findById(parentId);
  if (!parent || !parent.isVisible)
    throw new CommentNotFoundException();

  // STEP 2: Validate độ sâu — không reply vào reply cấp 2
  if (parent.depth >= 2)
    throw new MaxDepthExceededException();

  // STEP 3: Lấy user info
  const user = await this.userRpc.getUserById(currentUserId);

  const roleBadge = userRoles.includes('admin') || userRoles.includes('staff')
    ? userRoles.includes('admin') ? 'admin' : 'staff'
    : 'customer';

  // STEP 4: Tạo reply
  const reply = await this.commentRepo.create({
    productId:        parent.productId,
    userId:           currentUserId,
    parentId:         parentId,
    depth:            parent.depth + 1,
    content:          dto.content,
    userNameSnapshot: user.detail?.fullName ?? user.userName,
    userRoleSnapshot: roleBadge,
  });

  // STEP 5: Notify chủ comment gốc (nếu khác người)
  if (parent.userId !== currentUserId) {
    await this.publisher.publish('comment.replied', {
      targetUserId:   parent.userId,
      replyUserId:    currentUserId,
      replyUserName:  user.detail?.fullName ?? user.userName,
      commentId:      parentId,
      replyId:        reply.id,
      productId:      parent.productId,
    });
  }

  return this.mapCommentToResponse(reply, user);
}
```

### 4.4 Sửa Comment (trong vòng 15 phút)

```typescript
async updateComment(
  commentId:     string,
  dto:           UpdateCommentDto,
  currentUserId: string,
): Promise<CommentResponse> {

  const comment = await this.commentRepo.findById(commentId);

  if (!comment)                       throw new CommentNotFoundException();
  if (comment.userId !== currentUserId) throw new NotCommentOwnerException();
  if (!comment.isVisible)             throw new CommentNotFoundException();

  // Validate time window: 15 phút
  const editWindowMs  = 15 * 60 * 1000;
  const ageMs         = Date.now() - comment.createdAt.getTime();
  if (ageMs > editWindowMs)
    throw new EditWindowExpiredException();

  const updated = await this.commentRepo.update(commentId, {
    content:  dto.content,
    editedAt: new Date(),
  });

  const user = await this.userRpc.getUserById(currentUserId);
  return this.mapCommentToResponse(updated, user);
}
```

### 4.5 Tính Rating Aggregate

```typescript
async getRatingStats(productId: string): Promise<RatingStats> {

  // Single query, không cần N+1
  const [stats, distribution] = await this.prisma.$transaction([

    this.prisma.review.aggregate({
      where: { productId, isVisible: true },
      _avg:   { rating: true },
      _count: { id: true },
    }),

    this.prisma.review.groupBy({
      by:    ['rating'],
      where: { productId, isVisible: true },
      _count: { id: true },
      orderBy: { rating: 'desc' },
    }),

  ]);

  const totalCount = stats._count.id;
  const average    = stats._avg.rating ?? 0;

  // Tạo map đầy đủ 1–5 sao
  const ratingMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  distribution.forEach(d => {
    ratingMap[d.rating] = d._count.id;
  });

  return {
    productId,
    average:       parseFloat(average.toFixed(1)),
    totalCount,
    distribution: {
      five:  ratingMap[5],
      four:  ratingMap[4],
      three: ratingMap[3],
      two:   ratingMap[2],
      one:   ratingMap[1],
    },
    // Tỉ lệ phần trăm mỗi mức
    percentages: {
      five:  totalCount ? Math.round((ratingMap[5] / totalCount) * 100) : 0,
      four:  totalCount ? Math.round((ratingMap[4] / totalCount) * 100) : 0,
      three: totalCount ? Math.round((ratingMap[3] / totalCount) * 100) : 0,
      two:   totalCount ? Math.round((ratingMap[2] / totalCount) * 100) : 0,
      one:   totalCount ? Math.round((ratingMap[1] / totalCount) * 100) : 0,
    },
  };
}
```

### 4.6 Load Comment Tree

```typescript
async getCommentsByProduct(
  productId: string,
  query:     QueryCommentsDto,
): Promise<PaginatedResult<CommentTreeNode>> {

  // Lấy comments gốc (depth = 0) theo trang
  const [roots, total] = await this.commentRepo.findRoots(productId, {
    skip:  (query.page - 1) * query.limit,
    take:  query.limit,
    where: { isVisible: true },
  });

  // Lấy TẤT CẢ replies của trang hiện tại trong 1 query
  const rootIds  = roots.map(r => r.id);
  const replies  = await this.commentRepo.findRepliesByParentIds(rootIds);

  // Build tree trong memory (không recursive query)
  const replyMap = new Map<string, Comment[]>();
  replies.forEach(r => {
    const bucket = replyMap.get(r.parentId!) ?? [];
    bucket.push(r);
    replyMap.set(r.parentId!, bucket);
  });

  const tree = roots.map(root => ({
    ...this.mapCommentFlat(root),
    replies: (replyMap.get(root.id) ?? []).map(r1 => ({
      ...this.mapCommentFlat(r1),
      replies: (replyMap.get(r1.id) ?? []).map(r2 => ({
        ...this.mapCommentFlat(r2),
        replies: [],  // depth 2 không có replies nữa
      })),
    })),
  }));

  return { data: tree, meta: { page: query.page, limit: query.limit, total } };
}
```

---

## 5. API Endpoints

**Base URL:** `/api/v1`  
**Content-Type:** `application/json`

---

### 5.1 Reviews

#### `GET /reviews/products/:productId`

Danh sách đánh giá của một sản phẩm.

**Auth:** `public` (guest đọc được)

**Query Parameters:**

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `page` | number | 1 | Trang |
| `limit` | number | 10 | Số item/trang (max 50) |
| `rating` | number | - | Filter theo sao: 1–5 |
| `hasImage` | boolean | - | Chỉ hiện review có ảnh |
| `sortBy` | string | `createdAt` | `createdAt` \| `rating` |
| `sortOrder` | string | `desc` | `asc` \| `desc` |

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id":        "uuid",
      "rating":    5,
      "content":   "Máy chính hãng, giao hàng nhanh. Rất hài lòng!",
      "images":    [
        "https://cdn.iluxury.vn/reviews/abc123.jpg",
        "https://cdn.iluxury.vn/reviews/def456.jpg"
      ],
      "isVisible": true,
      "user": {
        "id":       "uuid",
        "name":     "Nguyễn Văn An",
        "avatar":   "https://cdn.iluxury.vn/avatars/uuid.jpg"
      },
      "productNameSnapshot": "iPhone 16 Pro Max 256GB",
      "editedAt":  null,
      "createdAt": "2026-03-15T10:30:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 128,
    "totalPages": 13
  }
}
```

---

#### `GET /reviews/products/:productId/stats`

Thống kê rating tổng hợp của sản phẩm.

**Auth:** `public`

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "productId":  "uuid",
    "average":    4.7,
    "totalCount": 128,
    "distribution": {
      "five":  89,
      "four":  25,
      "three": 10,
      "two":   3,
      "one":   1
    },
    "percentages": {
      "five":  70,
      "four":  20,
      "three": 8,
      "two":   1,
      "one":   1
    }
  }
}
```

---

#### `POST /reviews`

Tạo đánh giá mới.

**Auth:** `customer`  
**Content-Type:** `multipart/form-data` (nếu có ảnh) hoặc `application/json`

**Request (JSON):**

```json
{
  "orderId":   "uuid-order",
  "productId": "uuid-product",
  "rating":    5,
  "content":   "Sản phẩm chính hãng, đóng gói cẩn thận. Rất hài lòng!"
}
```

**Request (multipart — khi có ảnh):**

```
orderId:   uuid-order
productId: uuid-product
rating:    5
content:   Sản phẩm rất tốt
images:    [File1.jpg, File2.jpg]   ← tối đa 5 file
```

**Validation:**

| Field | Rules |
|-------|-------|
| `orderId` | required · UUID |
| `productId` | required · UUID |
| `rating` | required · integer · 1–5 |
| `content` | optional · string · 10–2000 ký tự |
| `images` | optional · max 5 files · JPEG/PNG/WEBP · max 5MB/file |

**Response `201`:**

```json
{
  "success": true,
  "data": {
    "id":        "uuid",
    "orderId":   "uuid",
    "productId": "uuid",
    "rating":    5,
    "content":   "Sản phẩm chính hãng, đóng gói cẩn thận.",
    "images":    ["https://cdn.iluxury.vn/reviews/..."],
    "user": {
      "id":     "uuid",
      "name":   "Nguyễn Văn An",
      "avatar": "https://cdn.iluxury.vn/avatars/..."
    },
    "createdAt": "2026-04-01T08:00:00.000Z"
  }
}
```

**Errors:**

| Code | HTTP | Mô tả |
|------|------|-------|
| `ORDER_NOT_FOUND` | 404 | Đơn hàng không tồn tại |
| `NOT_ORDER_OWNER` | 403 | Không phải chủ đơn hàng |
| `ORDER_NOT_COMPLETED` | 422 | Đơn chưa hoàn thành |
| `PRODUCT_NOT_IN_ORDER` | 422 | Sản phẩm không có trong đơn |
| `ALREADY_REVIEWED` | 409 | Đã đánh giá sản phẩm này trong đơn này rồi |
| `PRODUCT_NOT_FOUND` | 404 | Sản phẩm không tồn tại |
| `INVALID_IMAGE_TYPE` | 400 | File không phải JPEG/PNG/WEBP |
| `IMAGE_TOO_LARGE` | 400 | File vượt 5MB |
| `TOO_MANY_IMAGES` | 400 | Vượt 5 ảnh |

---

#### `GET /reviews/me`

Danh sách đánh giá của tôi.

**Auth:** `customer`

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|-------|
| `page` | number | Trang (default: 1) |
| `limit` | number | Số item (default: 10) |

**Response `200`:** Danh sách review của user hiện tại, kèm thông tin sản phẩm (snapshot)

---

#### `GET /reviews`

Tất cả đánh giá — dành cho admin.

**Auth:** `admin`

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|-------|
| `page` | number | Trang |
| `limit` | number | Số item |
| `productId` | UUID | Filter theo sản phẩm |
| `userId` | UUID | Filter theo user |
| `rating` | number | Filter theo sao (1–5) |
| `isVisible` | boolean | Filter ẩn/hiện |
| `fromDate` | ISO date | Từ ngày |
| `toDate` | ISO date | Đến ngày |
| `sortBy` | string | `createdAt` \| `rating` |
| `sortOrder` | string | `asc` \| `desc` |

**Response `200`:** Danh sách review với đầy đủ thông tin kèm `adminNote`

---

#### `PATCH /reviews/:id/visibility`

Ẩn hoặc hiện đánh giá (moderation).

**Auth:** `admin`

**Request:**

```json
{
  "isVisible": false,
  "adminNote": "Review chứa từ ngữ vi phạm chính sách cộng đồng"
}
```

**Validation:**

| Field | Rules |
|-------|-------|
| `isVisible` | required · boolean |
| `adminNote` | required khi `isVisible = false` · 10–500 ký tự |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "id":        "uuid",
    "isVisible": false,
    "adminNote": "Review chứa từ ngữ vi phạm chính sách cộng đồng",
    "updatedAt": "2026-04-01T09:00:00.000Z"
  }
}
```

---

### 5.2 Comments

#### `GET /comments/products/:productId`

Danh sách bình luận của sản phẩm theo cấu trúc cây.

**Auth:** `public`

**Query Parameters:**

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `page` | number | 1 | Trang (phân trang theo comment gốc) |
| `limit` | number | 10 | Số comment gốc / trang (max 30) |

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id":        "uuid-root",
      "productId": "uuid-product",
      "depth":     0,
      "content":   "Máy này có hỗ trợ 5G không shop?",
      "editedAt":  null,
      "user": {
        "id":     "uuid",
        "name":   "Trần Thị Bình",
        "avatar": "https://cdn.iluxury.vn/avatars/...",
        "role":   "customer"
      },
      "createdAt": "2026-03-10T14:00:00.000Z",
      "replies": [
        {
          "id":      "uuid-reply-1",
          "depth":   1,
          "content": "Dạ bạn ơi, iPhone 16 Pro Max hỗ trợ 5G Sub-6GHz và mmWave nhé!",
          "user": {
            "id":     "uuid-staff",
            "name":   "Nhân viên iLuxury",
            "avatar": "https://cdn.iluxury.vn/avatars/staff.jpg",
            "role":   "staff"
          },
          "createdAt": "2026-03-10T14:30:00.000Z",
          "replies": [
            {
              "id":      "uuid-reply-2",
              "depth":   2,
              "content": "Cảm ơn shop! Vậy cho em hỏi thêm...",
              "user": { ... },
              "createdAt": "2026-03-10T15:00:00.000Z",
              "replies": []
            }
          ]
        }
      ]
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 24,
    "totalPages": 3
  }
}
```

---

#### `POST /comments`

Đăng bình luận mới.

**Auth:** `customer`, `staff`, `admin`

**Request:**

```json
{
  "productId": "uuid-product",
  "content":   "Sản phẩm này có bảo hành bao lâu vậy shop?"
}
```

**Validation:**

| Field | Rules |
|-------|-------|
| `productId` | required · UUID |
| `content` | required · string · 1–1000 ký tự |

**Response `201`:** Comment object vừa tạo (depth = 0, replies = [])

---

#### `POST /comments/:id/reply`

Trả lời một bình luận.

**Auth:** `customer`, `staff`, `admin`

**Request:**

```json
{
  "content": "Dạ bạn ơi, bảo hành 12 tháng chính hãng Apple!"
}
```

**Validation:**

| Field | Rules |
|-------|-------|
| `content` | required · string · 1–1000 ký tự |

**Errors:**

| Code | HTTP | Mô tả |
|------|------|-------|
| `COMMENT_NOT_FOUND` | 404 | Comment cha không tồn tại hoặc đã ẩn |
| `MAX_DEPTH_EXCEEDED` | 422 | Không thể reply vào bình luận cấp 2 |

**Response `201`:** Reply object vừa tạo

---

#### `PUT /comments/:id`

Chỉnh sửa bình luận (trong vòng 15 phút).

**Auth:** `customer` (chỉ chủ comment)

**Request:**

```json
{
  "content": "Nội dung đã được chỉnh sửa"
}
```

**Validation:**

| Field | Rules |
|-------|-------|
| `content` | required · string · 1–1000 ký tự |

**Errors:**

| Code | HTTP | Mô tả |
|------|------|-------|
| `COMMENT_NOT_FOUND` | 404 | Comment không tồn tại |
| `NOT_COMMENT_OWNER` | 403 | Không phải chủ comment |
| `EDIT_WINDOW_EXPIRED` | 422 | Đã quá 15 phút kể từ khi đăng |

**Response `200`:** Comment đã cập nhật, kèm `editedAt` timestamp

---

#### `DELETE /comments/:id`

Xoá bình luận.

**Auth:** `customer` (chỉ chủ comment), `admin`

**Business rules:**
- Customer chỉ xoá được comment của mình
- Admin xoá được mọi comment
- Khi xoá comment gốc → xoá mềm (`isVisible = false`), giữ replies
- Khi xoá reply → xoá mềm

**Response `200`:**

```json
{
  "success": true,
  "data": { "message": "Đã xoá bình luận" }
}
```

---

#### `PATCH /comments/:id/visibility`

Ẩn hoặc hiện bình luận (moderation).

**Auth:** `admin`

**Request:**

```json
{
  "isVisible": false,
  "adminNote": "Bình luận chứa thông tin sai lệch về sản phẩm"
}
```

**Response `200`:** Comment đã cập nhật visibility

---

### 5.3 Internal RPC

#### `GET /internal/reviews/products/:productId/stats`

Lấy rating aggregate để hiển thị trên trang sản phẩm.

**Auth:** `X-Service-Token`

**Response `200`:**

```json
{
  "productId": "uuid",
  "average":   4.7,
  "total":     128
}
```

---

## 6. RabbitMQ Events

### 6.1 Exchange Config

```typescript
export const RABBITMQ_CONFIG = {
  exchange:     'apple_shop',
  exchangeType: 'topic',

  // CONSUME
  queues: {
    orderEvents: 'review.order_events',
  },
  consume: {
    orderCompleted: 'order.completed',
  },

  // PUBLISH
  publish: {
    reviewCreated:   'review.created',
    commentReplied:  'comment.replied',
  },
};
```

---

### 6.2 CONSUME — `order.completed`

**Publisher:** Order Service  
**Mục đích:** Không consume để làm gì ngay, nhưng có thể dùng trong tương lai để:
- Pre-cache "user đủ điều kiện review sản phẩm X"
- Gửi notification "Bạn có thể đánh giá đơn hàng #xxx"

> **Note hiện tại:** Review Service **không consume** event này — việc verify eligibility thực hiện **real-time qua RPC** khi user bấm submit review. Nếu hệ thống scale lớn, có thể chuyển sang cache eligibility.

---

### 6.3 PUBLISH — `review.created`

**Consumer:** Notification Service  
**Trigger:** Sau khi tạo review thành công

```typescript
interface ReviewCreatedPayload {
  reviewId:    string;
  userId:      string;
  productId:   string;
  productName: string;
  rating:      number;
  createdAt:   string;
}
```

> Notification Service có thể dùng để: push thông báo cho admin "Có đánh giá mới cần kiểm duyệt" (nếu rating thấp).

---

### 6.4 PUBLISH — `comment.replied`

**Consumer:** Notification Service  
**Trigger:** Khi có người reply comment

```typescript
interface CommentRepliedPayload {
  commentId:       string;  // ID comment gốc bị reply
  replyId:         string;  // ID reply mới
  targetUserId:    string;  // Chủ comment gốc (nhận notification)
  replyUserId:     string;  // Người vừa reply
  replyUserName:   string;
  productId:       string;
  productName:     string;
}
```

---

## 7. Cấu Trúc Thư Mục

```
review-service/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── config/
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   ├── rabbitmq.config.ts
│   │   └── upload.config.ts
│   │
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   ├── prisma.service.ts
│   │   └── schema.prisma
│   │
│   ├── reviews/
│   │   ├── reviews.module.ts
│   │   ├── reviews.controller.ts
│   │   ├── reviews.service.ts
│   │   ├── reviews.repository.ts
│   │   └── dto/
│   │       ├── create-review.dto.ts
│   │       ├── query-reviews.dto.ts
│   │       ├── query-admin-reviews.dto.ts
│   │       └── update-visibility.dto.ts
│   │
│   ├── comments/
│   │   ├── comments.module.ts
│   │   ├── comments.controller.ts
│   │   ├── comments.service.ts
│   │   ├── comments.repository.ts
│   │   └── dto/
│   │       ├── create-comment.dto.ts
│   │       ├── reply-comment.dto.ts
│   │       ├── update-comment.dto.ts
│   │       ├── query-comments.dto.ts
│   │       └── update-visibility.dto.ts
│   │
│   ├── internal/
│   │   ├── internal.module.ts
│   │   └── internal.controller.ts    # /internal/reviews/products/:id/stats
│   │
│   ├── rpc/
│   │   ├── rpc.module.ts
│   │   ├── order.rpc.ts              # Gọi Order Service để verify eligibility
│   │   ├── product.rpc.ts            # Gọi Product Service để verify product
│   │   └── user.rpc.ts               # Gọi User Service để lấy user info
│   │
│   ├── publishers/
│   │   ├── publishers.module.ts
│   │   └── review.publisher.ts
│   │
│   ├── upload/
│   │   ├── upload.module.ts
│   │   └── upload.service.ts         # Upload ảnh review lên CDN
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
│   │       └── error-codes.constant.ts
│   │
│   └── health/
│       ├── health.module.ts
│       └── health.controller.ts
│
├── test/
│   ├── unit/
│   │   ├── reviews.service.spec.ts
│   │   └── comments.service.spec.ts
│   └── e2e/
│       ├── reviews.e2e-spec.ts
│       └── comments.e2e-spec.ts
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── .env
├── .env.example
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 8. Modules & Classes Chi Tiết

### 8.1 `ReviewsController`

```typescript
@ApiTags('Reviews')
@Controller()
export class ReviewsController {

  constructor(private readonly reviewsService: ReviewsService) {}

  // ── Public endpoints ─────────────────────────────────────────

  @Get('reviews/products/:productId')
  @Public()
  getByProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: QueryReviewsDto,
  ) { ... }

  @Get('reviews/products/:productId/stats')
  @Public()
  getStats(@Param('productId', ParseUUIDPipe) productId: string) { ... }

  // ── Customer endpoints ───────────────────────────────────────

  @Post('reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER, Role.STAFF, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('images', 5, multerOptions))
  create(
    @Body() dto: CreateReviewDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: UserPayload,
  ) { ... }

  @Get('reviews/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER, Role.STAFF, Role.ADMIN)
  getMyReviews(
    @CurrentUser() user: UserPayload,
    @Query() query: QueryReviewsDto,
  ) { ... }

  // ── Admin endpoints ──────────────────────────────────────────

  @Get('reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getAll(@Query() query: QueryAdminReviewsDto) { ... }

  @Patch('reviews/:id/visibility')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateVisibility(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVisibilityDto,
  ) { ... }
}
```

---

### 8.2 `CommentsController`

```typescript
@ApiTags('Comments')
@Controller('comments')
export class CommentsController {

  constructor(private readonly commentsService: CommentsService) {}

  @Get('products/:productId')
  @Public()
  getByProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: QueryCommentsDto,
  ) { ... }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER, Role.STAFF, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: UserPayload,
  ) { ... }

  @Post(':id/reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER, Role.STAFF, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  reply(
    @Param('id', ParseUUIDPipe) parentId: string,
    @Body() dto: ReplyCommentDto,
    @CurrentUser() user: UserPayload,
  ) { ... }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: UserPayload,
  ) { ... }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER, Role.ADMIN)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserPayload,
  ) { ... }

  @Patch(':id/visibility')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateVisibility(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVisibilityDto,
  ) { ... }
}
```

---

### 8.3 `ReviewsRepository`

```typescript
@Injectable()
export class ReviewsRepository {

  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.ReviewCreateInput): Promise<Review> {
    return this.prisma.review.create({ data });
  }

  async findByUniqueKey(
    userId: string, productId: string, orderId: string
  ): Promise<Review | null> {
    return this.prisma.review.findUnique({
      where: { userId_productId_orderId: { userId, productId, orderId } },
    });
  }

  async findByProduct(
    productId: string,
    params: {
      skip?: number; take?: number;
      where?: Prisma.ReviewWhereInput;
      orderBy?: Prisma.ReviewOrderByWithRelationInput;
    },
  ): Promise<[Review[], number]> {
    const baseWhere: Prisma.ReviewWhereInput = {
      productId,
      isVisible: true,
      ...params.where,
    };

    return this.prisma.$transaction([
      this.prisma.review.findMany({
        where:   baseWhere,
        skip:    params.skip,
        take:    params.take,
        orderBy: params.orderBy,
      }),
      this.prisma.review.count({ where: baseWhere }),
    ]);
  }

  async getStats(productId: string): Promise<RatingStats> { ... }

  async findByUser(
    userId: string, skip: number, take: number
  ): Promise<[Review[], number]> { ... }

  async updateVisibility(
    id: string, isVisible: boolean, adminNote?: string
  ): Promise<Review> {
    return this.prisma.review.update({
      where: { id },
      data:  { isVisible, adminNote: adminNote ?? null },
    });
  }
}
```

---

### 8.4 `CommentsRepository`

```typescript
@Injectable()
export class CommentsRepository {

  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<Comment | null> {
    return this.prisma.comment.findUnique({ where: { id } });
  }

  async findRoots(
    productId: string,
    params: { skip: number; take: number; where?: Prisma.CommentWhereInput },
  ): Promise<[Comment[], number]> {
    const where: Prisma.CommentWhereInput = {
      productId,
      parentId: null,   // chỉ lấy comment gốc
      depth:    0,
      ...params.where,
    };
    return this.prisma.$transaction([
      this.prisma.comment.findMany({
        where, skip: params.skip, take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.comment.count({ where }),
    ]);
  }

  async findRepliesByParentIds(parentIds: string[]): Promise<Comment[]> {
    // Lấy TẤT CẢ replies của các root trong 1 query
    // Bao gồm cả cấp 2 (replies của replies)
    return this.prisma.comment.findMany({
      where: {
        OR: [
          { parentId: { in: parentIds } },          // cấp 1
          {
            parent: { parentId: { in: parentIds } } // cấp 2
          },
        ],
        isVisible: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(data: Prisma.CommentCreateInput): Promise<Comment> {
    return this.prisma.comment.create({ data });
  }

  async update(id: string, data: Prisma.CommentUpdateInput): Promise<Comment> {
    return this.prisma.comment.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.comment.update({
      where: { id },
      data:  { isVisible: false },
    });
  }
}
```

---

### 8.5 `OrderRpc` — Verify Eligibility

```typescript
@Injectable()
export class OrderRpc {
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = config.get('rpc.orderServiceUrl');
  }

  async getOrderById(orderId: string): Promise<OrderRpcResponse | null> {
    try {
      const res = await firstValueFrom(
        this.httpService.get<OrderRpcResponse>(
          `${this.baseUrl}/internal/orders/${orderId}`,
          {
            headers: { 'X-Service-Token': this.config.get('rpc.serviceToken') },
            timeout: 3000,  // 3 giây timeout
          },
        ),
      );
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) return null;
      throw new ServiceUnavailableException('Order Service không phản hồi');
    }
  }
}

interface OrderRpcResponse {
  id:     string;
  userId: string;
  status: string;
  items: Array<{
    productVariantId: string;
    productId:        string;
    productName:      string;
  }>;
}
```

---

### 8.6 `UploadService` — Review Images

```typescript
@Injectable()
export class UploadService {

  async uploadReviewImages(
    files: Express.Multer.File[],
    userId: string,
  ): Promise<string[]> {
    // Validate từng file
    for (const file of files) {
      this.validateImageFile(file);
    }

    // Upload song song (Promise.all)
    const urls = await Promise.all(
      files.map(file => this.uploadSingleImage(file, userId))
    );

    return urls;
  }

  private validateImageFile(file: Express.Multer.File): void {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new InvalidImageTypeException(file.originalname);
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new ImageTooLargeException(file.originalname);
    }
  }

  private async uploadSingleImage(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    // Resize về max 1200×1200 bằng Sharp trước khi upload
    const resized = await sharp(file.buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const key = `reviews/${userId}/${Date.now()}-${uuidv4()}.jpg`;
    await this.s3.send(new PutObjectCommand({
      Bucket:      this.config.get('s3.bucket'),
      Key:         key,
      Body:        resized,
      ContentType: 'image/jpeg',
    }));

    return `${this.config.get('cdn.baseUrl')}/${key}`;
  }
}
```

---

## 9. DTOs & Validation

### 9.1 `CreateReviewDto`

```typescript
export class CreateReviewDto {
  @IsUUID()
  @ApiProperty({ example: 'uuid-order' })
  orderId: string;

  @IsUUID()
  @ApiProperty({ example: 'uuid-product' })
  productId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @ApiProperty({ example: 5, description: '1–5 sao' })
  rating: number;

  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Nội dung đánh giá tối thiểu 10 ký tự' })
  @MaxLength(2000)
  @ApiProperty({ required: false })
  content?: string;

  // images được xử lý qua @UploadedFiles() — không có ở đây
}
```

### 9.2 `CreateCommentDto`

```typescript
export class CreateCommentDto {
  @IsUUID()
  productId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  content: string;
}
```

### 9.3 `ReplyCommentDto`

```typescript
export class ReplyCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  content: string;
}
```

### 9.4 `UpdateCommentDto`

```typescript
export class UpdateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  content: string;
}
```

### 9.5 `UpdateVisibilityDto`

```typescript
export class UpdateVisibilityDto {
  @IsBoolean()
  isVisible: boolean;

  @ValidateIf(o => o.isVisible === false)
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  adminNote?: string;
}
```

### 9.6 `QueryReviewsDto`

```typescript
export class QueryReviewsDto {
  @IsOptional() @IsInt() @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number = 1;

  @IsOptional() @IsInt() @Min(1) @Max(50)
  @Transform(({ value }) => parseInt(value))
  limit?: number = 10;

  @IsOptional() @IsInt() @Min(1) @Max(5)
  @Transform(({ value }) => parseInt(value))
  rating?: number;

  @IsOptional() @IsBoolean()
  @Transform(({ value }) => value === 'true')
  hasImage?: boolean;

  @IsOptional() @IsIn(['createdAt', 'rating'])
  sortBy?: string = 'createdAt';

  @IsOptional() @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
```

### 9.7 `QueryCommentsDto`

```typescript
export class QueryCommentsDto {
  @IsOptional() @IsInt() @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number = 1;

  @IsOptional() @IsInt() @Min(1) @Max(30)
  @Transform(({ value }) => parseInt(value))
  limit?: number = 10;
}
```

---

## 10. Error Handling

### 10.1 Custom Exceptions

```typescript
// reviews
export class AlreadyReviewedException extends ConflictException {
  constructor() {
    super({ code: 'ALREADY_REVIEWED', message: 'Bạn đã đánh giá sản phẩm này trong đơn hàng này rồi' });
  }
}

export class OrderNotCompletedException extends UnprocessableEntityException {
  constructor() {
    super({ code: 'ORDER_NOT_COMPLETED', message: 'Chỉ có thể đánh giá sau khi đơn hàng hoàn thành' });
  }
}

export class NotOrderOwnerException extends ForbiddenException {
  constructor() {
    super({ code: 'NOT_ORDER_OWNER', message: 'Bạn không phải chủ đơn hàng này' });
  }
}

export class ProductNotInOrderException extends UnprocessableEntityException {
  constructor() {
    super({ code: 'PRODUCT_NOT_IN_ORDER', message: 'Sản phẩm này không có trong đơn hàng' });
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

// comments
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
```

### 10.2 Error Code Registry

| Code | HTTP | Trigger |
|------|------|---------|
| `ORDER_NOT_FOUND` | 404 | orderId không tồn tại |
| `NOT_ORDER_OWNER` | 403 | userId không khớp order.userId |
| `ORDER_NOT_COMPLETED` | 422 | order.status ≠ completed |
| `PRODUCT_NOT_IN_ORDER` | 422 | productId không trong order.items |
| `ALREADY_REVIEWED` | 409 | (userId, productId, orderId) đã tồn tại |
| `PRODUCT_NOT_FOUND` | 404 | productId không tồn tại |
| `INVALID_IMAGE_TYPE` | 400 | Sai định dạng ảnh |
| `IMAGE_TOO_LARGE` | 400 | File > 5MB |
| `TOO_MANY_IMAGES` | 400 | Vượt 5 ảnh |
| `COMMENT_NOT_FOUND` | 404 | Comment không tồn tại hoặc ẩn |
| `NOT_COMMENT_OWNER` | 403 | Không phải chủ comment |
| `EDIT_WINDOW_EXPIRED` | 422 | Quá 15 phút |
| `MAX_DEPTH_EXCEEDED` | 422 | Đã depth = 2 |
| `ORDER_SERVICE_UNAVAILABLE` | 503 | Order Service timeout |
| `PRODUCT_SERVICE_UNAVAILABLE` | 503 | Product Service timeout |

---

## 11. Guards & Authorization

### 11.1 Role Matrix

| Endpoint | guest | customer | staff | admin |
|----------|-------|----------|-------|-------|
| `GET /reviews/products/:id` | ✅ | ✅ | ✅ | ✅ |
| `GET /reviews/products/:id/stats` | ✅ | ✅ | ✅ | ✅ |
| `POST /reviews` | ❌ | ✅ | ✅ | ✅ |
| `GET /reviews/me` | ❌ | ✅ | ✅ | ✅ |
| `GET /reviews` | ❌ | ❌ | ❌ | ✅ |
| `PATCH /reviews/:id/visibility` | ❌ | ❌ | ❌ | ✅ |
| `GET /comments/products/:id` | ✅ | ✅ | ✅ | ✅ |
| `POST /comments` | ❌ | ✅ | ✅ | ✅ |
| `POST /comments/:id/reply` | ❌ | ✅ | ✅ | ✅ |
| `PUT /comments/:id` | ❌ | ✅ (chỉ chủ, ≤15p) | ❌ | ❌ |
| `DELETE /comments/:id` | ❌ | ✅ (chỉ chủ) | ❌ | ✅ |
| `PATCH /comments/:id/visibility` | ❌ | ❌ | ❌ | ✅ |
| `GET /internal/...` | ❌ | ❌ | ❌ | ✅ (service token) |

### 11.2 Ownership Guard (Comment)

```typescript
// Trong CommentsService — không dùng guard riêng, check trong service
async ensureOwnership(commentId: string, userId: string): Promise<Comment> {
  const comment = await this.commentRepo.findById(commentId);
  if (!comment || !comment.isVisible) throw new CommentNotFoundException();
  if (comment.userId !== userId)       throw new NotCommentOwnerException();
  return comment;
}

// Xoá — admin bypass ownership check
async deleteComment(commentId: string, userId: string, isAdmin: boolean): Promise<void> {
  const comment = await this.commentRepo.findById(commentId);
  if (!comment) throw new CommentNotFoundException();

  if (!isAdmin && comment.userId !== userId) {
    throw new NotCommentOwnerException();
  }

  await this.commentRepo.softDelete(commentId);
}
```

---

## 12. Configuration & Environment

### 12.1 `.env`

```env
# App
NODE_ENV=development
PORT=3010
SERVICE_NAME=review-service

# Database
DATABASE_URL="mysql://root:password@localhost:3306/db_reviews"

# RabbitMQ
AMQP_URL="amqp://guest:guest@localhost:5672"

# Internal service token
INTERNAL_SERVICE_TOKEN=random-service-secret-token

# RPC — URLs của các service khác
ORDER_SERVICE_URL=http://order-service:3004
PRODUCT_SERVICE_URL=http://product-service:3002
USER_SERVICE_URL=http://user-service:3001
RPC_TIMEOUT_MS=3000

# CDN / S3 (ảnh review)
CDN_BASE_URL=https://cdn.iluxury.vn
S3_BUCKET=iluxury-uploads
S3_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# Business rules
COMMENT_EDIT_WINDOW_MINUTES=15
MAX_REVIEW_IMAGES=5
MAX_IMAGE_SIZE_MB=5
MAX_COMMENT_DEPTH=2
MAX_ADDRESSES_PER_USER=10
```

### 12.2 `package.json`

```json
{
  "name": "review-service",
  "scripts": {
    "build":       "nest build",
    "start":       "nest start",
    "start:dev":   "nest start --watch",
    "start:prod":  "node dist/main",
    "test":        "jest",
    "test:cov":    "jest --coverage",
    "test:e2e":    "jest --config ./test/jest-e2e.json",
    "db:migrate":  "prisma migrate dev",
    "db:generate": "prisma generate"
  },
  "dependencies": {
    "@nestjs/common":        "^10.x",
    "@nestjs/core":          "^10.x",
    "@nestjs/config":        "^3.x",
    "@nestjs/axios":         "^3.x",
    "@nestjs/platform-express": "^10.x",
    "@nestjs/terminus":      "^10.x",
    "@prisma/client":        "^5.x",
    "axios":                 "^1.x",
    "amqplib":               "^0.10.x",
    "multer":                "^1.x",
    "sharp":                 "^0.33.x",
    "@aws-sdk/client-s3":    "^3.x",
    "class-transformer":     "^0.5.x",
    "class-validator":       "^0.14.x",
    "rxjs":                  "^7.x",
    "uuid":                  "^9.x"
  },
  "devDependencies": {
    "prisma":         "^5.x",
    "@types/multer":  "^1.x",
    "@types/sharp":   "^0.31.x",
    "jest":           "^29.x",
    "@types/jest":    "^29.x",
    "supertest":      "^6.x",
    "ts-jest":        "^29.x"
  }
}
```

---

## 13. Testing Strategy

### 13.1 Unit Tests — `ReviewsService`

```typescript
describe('ReviewsService', () => {

  describe('createReview', () => {
    it('should create review when all conditions met', async () => {
      // Mock: order = { status: 'completed', userId: current, items: [productId] }
      // Mock: product exists
      // Mock: no existing review
      // Expected: review created, event published
    });

    it('should throw OrderNotFoundException when order does not exist', async () => {
      // Mock: orderRpc.getOrderById → null
    });

    it('should throw NotOrderOwnerException when user is not order owner', async () => {
      // Mock: order.userId !== currentUserId
    });

    it('should throw OrderNotCompletedException when order status is not completed', async () => {
      // Mock: order.status = 'processing'
    });

    it('should throw ProductNotInOrderException when product not in order', async () => {
      // Mock: order.items does not include productId
    });

    it('should throw AlreadyReviewedException when already reviewed', async () => {
      // Mock: reviewRepo.findByUniqueKey → existing review
    });

    it('should upload images and save URLs', async () => {
      // Mock: uploadService.uploadReviewImages → ['url1', 'url2']
      // Expected: review.images = ['url1', 'url2']
    });

    it('should publish review.created event', async () => {
      // Expected: publisher.publish called with 'review.created'
    });

    it('should save snapshot of user name and product name', async () => {
      // Expected: userNameSnapshot, productNameSnapshot set correctly
    });
  });

  describe('getRatingStats', () => {
    it('should return correct aggregate and distribution', async () => {
      // Mock: 5 reviews with ratings [5,5,4,3,1]
      // Expected: average = 3.6, five=2, four=1, three=1, one=1
    });

    it('should return zeros when no reviews', async () => {
      // Expected: average=0, totalCount=0, all distribution=0
    });
  });

  describe('updateVisibility', () => {
    it('should require adminNote when hiding review', async () => {
      // dto.isVisible=false, dto.adminNote=undefined → throw ValidationError
    });

    it('should allow showing review without adminNote', async () => {
      // dto.isVisible=true, dto.adminNote=undefined → OK
    });
  });
});
```

### 13.2 Unit Tests — `CommentsService`

```typescript
describe('CommentsService', () => {

  describe('replyComment', () => {
    it('should create reply with correct depth', async () => {
      // Mock parent.depth = 0 → reply.depth = 1
    });

    it('should throw MaxDepthExceededException when parent.depth = 2', async () => {
      // Mock parent.depth = 2 → throw MaxDepthExceededException
    });

    it('should publish comment.replied when commenter != parent owner', async () => {
      // Mock parent.userId = 'A', currentUserId = 'B'
      // Expected: publisher.publish called with targetUserId = 'A'
    });

    it('should NOT publish when replying to own comment', async () => {
      // Mock parent.userId = currentUserId
      // Expected: publisher.publish NOT called
    });
  });

  describe('updateComment', () => {
    it('should allow edit within 15 minutes', async () => {
      // Mock comment.createdAt = 10 minutes ago
      // Expected: updated successfully with editedAt set
    });

    it('should throw EditWindowExpiredException after 15 minutes', async () => {
      // Mock comment.createdAt = 20 minutes ago
      // Expected: throw EditWindowExpiredException
    });

    it('should throw NotCommentOwnerException when not owner', async () => {
      // Mock comment.userId != currentUserId
    });
  });

  describe('deleteComment', () => {
    it('should soft delete for owner', async () => {
      // Expected: comment.isVisible = false
    });

    it('should allow admin to delete any comment', async () => {
      // isAdmin = true → bypass ownership check
    });

    it('should throw NotCommentOwnerException for non-owner non-admin', async () => {
      // isAdmin = false, comment.userId != currentUserId → throw
    });
  });

  describe('getCommentsByProduct', () => {
    it('should build comment tree correctly', async () => {
      // Mock: 2 roots, 3 replies (2 for root[0], 1 for root[1])
      // Expected: tree structure with correct nesting
    });

    it('should include depth-2 replies', async () => {
      // Mock: root → reply1 → reply2
      // Expected: reply2 nested in reply1.replies
    });
  });
});
```

### 13.3 E2E Tests

```typescript
describe('ReviewsController (e2e)', () => {

  it('POST /reviews — success', async () => {
    // Setup: order completed, product exists, no existing review
    const res = await request(app)
      .post('/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .field('orderId', completedOrderId)
      .field('productId', productId)
      .field('rating', '5')
      .field('content', 'Rất hài lòng với sản phẩm!')
      .attach('images', 'test/fixtures/test-image.jpg')
      .expect(201);

    expect(res.body.data.rating).toBe(5);
    expect(res.body.data.images).toHaveLength(1);
  });

  it('POST /reviews — 422 when order not completed', async () => {
    await request(app)
      .post('/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderId: pendingOrderId, productId, rating: 5 })
      .expect(422);
  });

  it('POST /reviews — 409 when already reviewed', async () => {
    // Create first review, then try again
    await createReview();
    await request(app)
      .post('/reviews')
      .send({ orderId: completedOrderId, productId, rating: 4 })
      .expect(409);
  });

  it('GET /reviews/products/:id/stats — correct aggregate', async () => {
    // Seed 3 reviews: [5, 4, 5]
    const res = await request(app)
      .get(`/reviews/products/${productId}/stats`)
      .expect(200);
    expect(res.body.data.average).toBe(4.7);
    expect(res.body.data.totalCount).toBe(3);
  });

  it('PATCH /reviews/:id/visibility — admin only', async () => {
    await request(app)
      .patch(`/reviews/${reviewId}/visibility`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ isVisible: false, adminNote: 'Vi phạm...' })
      .expect(403);

    await request(app)
      .patch(`/reviews/${reviewId}/visibility`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isVisible: false, adminNote: 'Vi phạm nội dung...' })
      .expect(200);
  });
});

describe('CommentsController (e2e)', () => {

  it('GET /comments/products/:id — returns tree structure', async () => {
    // Seed root + reply + sub-reply
    const res = await request(app)
      .get(`/comments/products/${productId}`)
      .expect(200);

    const root = res.body.data[0];
    expect(root.depth).toBe(0);
    expect(root.replies[0].depth).toBe(1);
    expect(root.replies[0].replies[0].depth).toBe(2);
  });

  it('POST /comments/:id/reply — 422 at max depth', async () => {
    // Seed depth-2 comment
    await request(app)
      .post(`/comments/${depth2CommentId}/reply`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ content: 'Try to reply depth-2' })
      .expect(422);
  });

  it('PUT /comments/:id — 422 after 15 minutes', async () => {
    // Mock thời gian comment được tạo 20 phút trước
    await request(app)
      .put(`/comments/${oldCommentId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ content: 'Edited content' })
      .expect(422);
  });
});
```

### 13.4 Coverage Targets

| Module | Target |
|--------|--------|
| `ReviewsService` | ≥ 90% |
| `CommentsService` | ≥ 90% |
| `ReviewsRepository` | ≥ 80% |
| `CommentsRepository` | ≥ 80% |
| `UploadService` | ≥ 75% |
| `OrderRpc / ProductRpc / UserRpc` | ≥ 70% |
| **Overall** | **≥ 85%** |

---

*Review Service Design Document · v1.0 · iLuxury Apple Shop*
