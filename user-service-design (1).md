# User Service — Tài Liệu Thiết Kế Backend Chi Tiết

> **Dự án:** iLuxury Apple Shop  
> **Service:** User Service  
> **Stack:** NestJS · Prisma · MySQL · RabbitMQ · JWT · Bcrypt · Firebase Admin  
> **Port:** `3001`  
> **Database:** `db_users`  
> **Phiên bản:** 1.0

---

## Mục Lục

1. [Tổng Quan Service](#1-tổng-quan-service)
2. [Kiến Trúc & Giao Tiếp](#2-kiến-trúc--giao-tiếp)
3. [Database Design](#3-database-design)
4. [Authentication — Luồng & Cơ Chế](#4-authentication--luồng--cơ-chế)
5. [Business Logic](#5-business-logic)
6. [API Endpoints](#6-api-endpoints)
7. [RabbitMQ Events](#7-rabbitmq-events)
8. [Cấu Trúc Thư Mục](#8-cấu-trúc-thư-mục)
9. [Modules & Classes Chi Tiết](#9-modules--classes-chi-tiết)
10. [DTOs & Validation](#10-dtos--validation)
11. [Error Handling](#11-error-handling)
12. [Security](#12-security)
13. [Guards & Middleware](#13-guards--middleware)
14. [Configuration & Environment](#14-configuration--environment)
15. [Testing Strategy](#15-testing-strategy)

---

## 1. Tổng Quan Service

### 1.1 Trách Nhiệm

User Service là **trung tâm xác thực và quản lý danh tính** của toàn bộ hệ thống. Mọi service khác đều phụ thuộc vào User Service để xác minh JWT token và lấy thông tin user.

| Nhóm | Chức năng |
|------|----------|
| **Auth** | Đăng ký, đăng nhập, đăng xuất, refresh token, quên/reset mật khẩu, đổi mật khẩu |
| **Profile** | Xem/cập nhật thông tin cá nhân, avatar |
| **Address Book** | CRUD địa chỉ giao hàng, đặt địa chỉ mặc định |
| **FCM Token** | Đăng ký/huỷ Firebase Cloud Messaging token |
| **Admin** | CRUD users, phân quyền, khoá/mở tài khoản |
| **Internal RPC** | Xác thực token, lấy user info cho các service khác |

### 1.2 Actors

| Actor | Mô tả | Đặc điểm |
|-------|-------|----------|
| `guest` | Chưa đăng nhập | Chỉ gọi được register/login |
| `customer` | Đã đăng nhập, role customer | Quản lý profile, địa chỉ của mình |
| `staff` | Nhân viên | Xem danh sách user, không sửa được |
| `admin` | Quản trị viên | Toàn quyền: CRUD user, phân quyền, khoá tài khoản |
| `internal` | Service khác | Validate token, lấy user info qua service token |

### 1.3 Phạm Vi

| Trong scope | Ngoài scope |
|-------------|------------|
| JWT issue & validate | OAuth2 / SSO bên thứ 3 |
| Bcrypt password hashing | Lưu session phía server |
| Address book | Địa chỉ cửa hàng (Config Service) |
| FCM token management | Gửi notification (Notification Service) |
| Role-based access | Permission per-resource (giữ đơn giản) |
| Refresh token rotation | Social login (Google, Apple) |

---

## 2. Kiến Trúc & Giao Tiếp

### 2.1 Vị Trí Trong Hệ Thống

```
┌──────────────────────────────────────────────────────────────────┐
│                        API GATEWAY                               │
│  - Route request đến đúng service                                │
│  - Forward header X-User-Payload (sau khi validate token)        │
│  - Rate limiting: 100 req/min/IP cho auth endpoints              │
└────────────┬───────────────────────────────┬─────────────────────┘
             │ HTTP (REST)                   │ HTTP (Internal RPC)
   ┌──────────▼──────────┐         ┌─────────▼──────────┐
   │   USER SERVICE      │         │   USER SERVICE      │
   │   /api/v1/auth      │         │   /internal/users   │
   │   /api/v1/users     │         │   (service-to-svc)  │
   │   Port: 3001        │         └────────────────────-┘
   │   DB: db_users      │
   └──────────┬──────────┘
              │ PUBLISH events
   ┌──────────▼──────────┐
   │     RabbitMQ Bus     │
   │  Exchange: apple_shop│
   └──────────┬───────────┘
              │
   ┌──────────▼──────────┐
   │  NOTIFICATION SVC   │
   │  (user.registered,  │
   │   user.password_reset)
   └─────────────────────┘
```

### 2.2 Bảng Giao Tiếp

| Loại | Hướng | Service | Mô tả |
|------|-------|---------|-------|
| HTTP REST | Inbound | API Gateway | Client gọi auth/profile endpoints |
| HTTP RPC | Inbound | Order, Cart, Review, Installment... | `POST /internal/users/validate-token` |
| HTTP RPC | Inbound | Order, Inventory... | `GET /internal/users/:id` |
| RabbitMQ PUBLISH | Outbound | Notification Service | `user.registered`, `user.password_reset` |

### 2.3 Token Flow — End to End

```
CLIENT                  API GATEWAY              USER SERVICE         OTHER SERVICES
  │                          │                        │                     │
  │── POST /auth/login ─────>│                        │                     │
  │                          │── forward ────────────>│                     │
  │                          │                        │── validate creds    │
  │                          │                        │── issue JWT pair    │
  │<── { accessToken,        │<───────────────────────│                     │
  │      refreshToken }      │                        │                     │
  │                          │                        │                     │
  │── GET /orders (+ Bearer) │                        │                     │
  │─────────────────────────>│                        │                     │
  │                          │── validate JWT ────────>│                     │
  │                          │<── { userId, roles }───│                     │
  │                          │                        │                     │
  │                          │── forward + X-User-Payload header ──────────>│
  │                          │<──────── response ──────────────────────────│
  │<── orders response ──────│                        │                     │
```

---

## 3. Database Design

### 3.1 Prisma Schema

```prisma
// ============================================================
// User Service — db_users
// prisma/schema.prisma
// ============================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ------------------------------------------------------------
// ROLES — Danh sách vai trò
// ------------------------------------------------------------
model Role {
  id        String   @id @default(uuid()) @db.Char(36)
  name      String   @unique @db.VarChar(50) // admin | staff | customer
  createdAt DateTime @default(now()) @map("created_at")

  userRoles UserRole[]

  @@map("ROLES")
}

// ------------------------------------------------------------
// USERS — Tài khoản đăng nhập
// ------------------------------------------------------------
model User {
  id           String   @id @default(uuid()) @db.Char(36)
  userName     String   @map("user_name") @db.VarChar(255)
  hashPassword String   @map("hash_password") @db.VarChar(255)
  email        String   @unique @db.VarChar(255)
  phoneNumber  String?  @unique @map("phone_number") @db.VarChar(20)
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  userRoles    UserRole[]
  userDetail   UserDetail?
  addresses    UserAddress[]
  fcmTokens    FcmToken[]
  refreshTokens RefreshToken[]

  @@index([email])
  @@index([isActive])
  @@map("USERS")
}

// ------------------------------------------------------------
// USER_ROLES — Junction table
// ------------------------------------------------------------
model UserRole {
  userId String @map("user_id") @db.Char(36)
  roleId String @map("role_id") @db.Char(36)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
  @@map("USER_ROLES")
}

// ------------------------------------------------------------
// USER_DETAILS — Thông tin cá nhân mở rộng
// ------------------------------------------------------------
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

enum Gender {
  male
  female
  other
}

// ------------------------------------------------------------
// USER_ADDRESSES — Sổ địa chỉ giao hàng
// ------------------------------------------------------------
model UserAddress {
  id          String   @id @default(uuid()) @db.Char(36)
  userId      String   @map("user_id") @db.Char(36)
  label       String?  @db.VarChar(100)  // "Nhà", "Công ty"
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

// ------------------------------------------------------------
// FCM_TOKENS — Firebase push notification tokens
// ------------------------------------------------------------
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

enum DeviceType {
  android
  ios
  web
}

// ------------------------------------------------------------
// REFRESH_TOKENS — Lưu refresh token (rotation)
// ------------------------------------------------------------
model RefreshToken {
  id        String   @id @default(uuid()) @db.Char(36)
  userId    String   @map("user_id") @db.Char(36)
  token     String   @unique @db.VarChar(500) // hashed
  deviceId  String?  @map("device_id") @db.VarChar(255)
  expiresAt DateTime @map("expires_at")
  revokedAt DateTime? @map("revoked_at") // null = còn hiệu lực
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@map("REFRESH_TOKENS")
}
```

### 3.2 Giải Thích Thiết Kế

#### Tại sao có `RefreshToken` table?

```
Access Token:   ngắn hạn (15 phút), stateless JWT
Refresh Token:  dài hạn (30 ngày), stored in DB (hash)

Rotation strategy:
  - Mỗi lần dùng refresh token → issue cặp token MỚI
  - Refresh token cũ bị revoke (revokedAt = now())
  - Nếu refresh token cũ bị dùng lại → nghi ngờ bị đánh cắp
    → Thu hồi TẤT CẢ refresh tokens của user đó

Lý do hash refresh token:
  - Nếu DB bị lộ → attacker không dùng được token raw
  - Chỉ lưu SHA-256(token), validate bằng cách hash và so sánh
```

#### `isDefault` trong `UserAddress`

```
Business rule:
  - Mỗi user chỉ có 1 địa chỉ mặc định (isDefault = true)
  - Khi set địa chỉ A làm default:
    1. UPDATE SET isDefault = false WHERE userId = :uid AND id != :aid
    2. UPDATE SET isDefault = true  WHERE id = :aid
  - Thực hiện trong 1 transaction
```

### 3.3 Index Strategy

| Table | Index | Mục đích |
|-------|-------|---------|
| `USERS` | `email` | Login, tìm user |
| `USERS` | `isActive` | Filter user active |
| `USER_ADDRESSES` | `(userId, isDefault)` | Lấy địa chỉ mặc định |
| `FCM_TOKENS` | `userId` | Lấy tất cả token của user |
| `REFRESH_TOKENS` | `token` | Validate refresh token |
| `REFRESH_TOKENS` | `userId` | Revoke all tokens của user |

---

## 4. Authentication — Luồng & Cơ Chế

### 4.1 JWT Token Structure

```typescript
// Access Token Payload
interface AccessTokenPayload {
  sub:   string;    // userId
  email: string;
  roles: string[];  // ['admin'] | ['staff'] | ['customer']
  iat:   number;    // issued at
  exp:   number;    // expiry (15 phút)
  type:  'access';
}

// Refresh Token Payload (minimal)
interface RefreshTokenPayload {
  sub:      string;  // userId
  jti:      string;  // JWT ID — dùng để revoke chính xác
  deviceId: string;  // Thiết bị nào
  type:     'refresh';
  exp:      number;  // 30 ngày
}
```

### 4.2 Luồng Đăng Ký

```
CLIENT                              USER SERVICE
  │                                      │
  │── POST /auth/register ───────────────>│
  │   { email, password,                  │
  │     userName, phoneNumber }           │
  │                                      │── Validate input (DTO)
  │                                      │── Check email unique
  │                                      │── Check phone unique
  │                                      │── bcrypt.hash(password, 12)
  │                                      │── prisma.$transaction:
  │                                      │     CREATE user
  │                                      │     CREATE userDetail
  │                                      │     ATTACH role 'customer'
  │                                      │── Issue access + refresh token
  │                                      │── PUBLISH user.registered →
  │                                      │   Notification Service
  │<── 201 { accessToken,                │
  │          refreshToken,               │
  │          user: {...} }               │
```

### 4.3 Luồng Đăng Nhập

```
CLIENT                              USER SERVICE
  │                                      │
  │── POST /auth/login ──────────────────>│
  │   { email, password }                │
  │                                      │── Tìm user theo email
  │                                      │── Check isActive = true
  │                                      │── bcrypt.compare(password, hash)
  │                                      │── Lưu RefreshToken (hashed)
  │                                      │── Issue token pair
  │<── 200 { accessToken,                │
  │          refreshToken, user }        │
  │                                      │
  │  [Access token hết hạn sau 15 phút]  │
  │                                      │
  │── POST /auth/refresh ────────────────>│
  │   { refreshToken }                   │
  │                                      │── Hash token → tìm trong DB
  │                                      │── Check revokedAt IS NULL
  │                                      │── Check expiresAt > now()
  │                                      │── Revoke token cũ
  │                                      │── Issue cặp token MỚI
  │<── 200 { accessToken, refreshToken } │
```

### 4.4 Luồng Reset Mật Khẩu

```
CLIENT                              USER SERVICE           NOTIFICATION SVC
  │                                      │                       │
  │── POST /auth/forgot-password ────────>│                       │
  │   { email }                          │                       │
  │                                      │── Tìm user theo email  │
  │                                      │── Gen resetToken (UUID)│
  │                                      │── Lưu vào cache Redis  │
  │                                      │   key: reset:{token}   │
  │                                      │   value: userId        │
  │                                      │   TTL: 15 phút         │
  │                                      │── PUBLISH user.password_reset
  │<── 200 { message: "Email đã gửi" }   │─────────────────────>│
  │                                      │                       │── Gửi email
  │  [User nhận email, click link]       │                       │
  │                                      │                       │
  │── POST /auth/reset-password ─────────>│                       │
  │   { token, newPassword }             │                       │
  │                                      │── Lấy userId từ Redis  │
  │                                      │── Nếu không có → 400   │
  │                                      │── bcrypt.hash(newPwd)  │
  │                                      │── UPDATE hashPassword  │
  │                                      │── Xoá token khỏi Redis │
  │                                      │── Revoke all refresh tokens
  │<── 200 { message: "Đặt lại thành công" }
```

### 4.5 Bcrypt Configuration

```typescript
// Sử dụng 12 rounds — cân bằng bảo mật và hiệu năng
// 12 rounds: ~250ms/hash trên server 2 core
// Tăng lên 14+ nếu server mạnh hơn

const BCRYPT_ROUNDS = 12;

// Hash khi tạo/đổi mật khẩu
const hash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);

// Verify khi đăng nhập
const isValid = await bcrypt.compare(plainPassword, hash);
```

---

## 5. Business Logic

### 5.1 Đăng Ký (`register`)

```typescript
async register(dto: RegisterDto): Promise<AuthResponse> {
  // 1. Validate email chưa tồn tại
  const emailExists = await this.userRepo.existsByEmail(dto.email);
  if (emailExists) throw new EmailAlreadyExistsException();

  // 2. Validate phone chưa tồn tại (nếu có)
  if (dto.phoneNumber) {
    const phoneExists = await this.userRepo.existsByPhone(dto.phoneNumber);
    if (phoneExists) throw new PhoneAlreadyExistsException();
  }

  // 3. Hash mật khẩu
  const hash = await bcrypt.hash(dto.password, this.config.bcryptRounds);

  // 4. Lấy role 'customer'
  const customerRole = await this.roleRepo.findByName('customer');

  // 5. Tạo user trong transaction
  const user = await this.prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        userName:     dto.userName,
        email:        dto.email.toLowerCase().trim(),
        phoneNumber:  dto.phoneNumber ?? null,
        hashPassword: hash,
        userDetail: { create: { fullName: dto.userName } },
        userRoles:  { create: { roleId: customerRole.id } },
      },
      include: {
        userDetail: true,
        userRoles:  { include: { role: true } },
      },
    });
    return u;
  });

  // 6. Issue tokens
  const tokens = await this.tokenService.issueTokenPair(user.id, ['customer']);

  // 7. Publish event
  await this.publisher.publish('user.registered', {
    userId:   user.id,
    email:    user.email,
    fullName: user.userDetail?.fullName,
  });

  return { ...tokens, user: this.mapToUserResponse(user) };
}
```

### 5.2 Đặt Địa Chỉ Mặc Định

```typescript
async setDefaultAddress(userId: string, addressId: string): Promise<void> {
  // Verify ownership
  const addr = await this.addressRepo.findById(addressId);
  if (!addr || addr.userId !== userId) {
    throw new AddressNotFoundException();
  }

  // Atomic transaction
  await this.prisma.$transaction([
    // Bỏ mặc định tất cả địa chỉ còn lại
    this.prisma.userAddress.updateMany({
      where: { userId, isDefault: true },
      data:  { isDefault: false },
    }),
    // Set mặc định địa chỉ mới
    this.prisma.userAddress.update({
      where: { id: addressId },
      data:  { isDefault: true },
    }),
  ]);
}
```

### 5.3 Refresh Token Rotation

```typescript
async refreshToken(rawToken: string): Promise<TokenPair> {
  // 1. Decode JWT để lấy userId (không verify signature ở đây)
  const decoded = this.jwtService.decode(rawToken) as RefreshTokenPayload;
  if (!decoded || decoded.type !== 'refresh') throw new InvalidTokenException();

  // 2. Hash token để tìm trong DB
  const tokenHash = this.hashToken(rawToken);
  const storedToken = await this.tokenRepo.findByHash(tokenHash);

  // 3. Kiểm tra token hợp lệ
  if (!storedToken)               throw new InvalidTokenException();
  if (storedToken.revokedAt)      throw new TokenRevokedException();
  if (storedToken.expiresAt < new Date()) throw new TokenExpiredException();
  if (storedToken.userId !== decoded.sub) throw new InvalidTokenException();

  // 4. Lấy user + roles
  const user = await this.userRepo.findWithRoles(decoded.sub);
  if (!user || !user.isActive) throw new UserInactiveException();

  // 5. Revoke token cũ
  await this.tokenRepo.revoke(storedToken.id);

  // 6. Issue cặp token mới
  const roles = user.userRoles.map(ur => ur.role.name);
  return this.issueTokenPair(user.id, roles, decoded.deviceId);
}

private hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
```

### 5.4 Validate Token (cho các service khác)

```typescript
// Internal endpoint — gọi bởi API Gateway hoặc service khác
async validateToken(rawToken: string): Promise<ValidatedUser> {
  try {
    const payload = this.jwtService.verify<AccessTokenPayload>(rawToken, {
      secret: this.config.jwtSecret,
    });

    if (payload.type !== 'access') throw new InvalidTokenException();

    // Verify user vẫn active (có thể cache 60s để giảm DB calls)
    const user = await this.cacheOrFetchUser(payload.sub);
    if (!user || !user.isActive) throw new UserInactiveException();

    return {
      userId: payload.sub,
      email:  payload.email,
      roles:  payload.roles,
    };
  } catch (err) {
    if (err instanceof JsonWebTokenError) throw new InvalidTokenException();
    if (err instanceof TokenExpiredError) throw new TokenExpiredException();
    throw err;
  }
}
```

### 5.5 Khoá/Mở Tài Khoản

```typescript
async toggleUserActive(targetUserId: string, isActive: boolean): Promise<void> {
  const user = await this.userRepo.findById(targetUserId);
  if (!user) throw new UserNotFoundException();

  // Không cho admin tự khoá chính mình
  // (được check ở controller level qua currentUser)

  await this.prisma.$transaction(async (tx) => {
    // Cập nhật isActive
    await tx.user.update({
      where: { id: targetUserId },
      data:  { isActive },
    });

    // Nếu khoá → thu hồi toàn bộ refresh token
    if (!isActive) {
      await tx.refreshToken.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data:  { revokedAt: new Date() },
      });
    }
  });
}
```

---

## 6. API Endpoints

**Base URL:** `/api/v1`  
**Content-Type:** `application/json`

---

### 6.1 Auth — `/auth`

#### `POST /auth/register`

Đăng ký tài khoản mới.

**Auth:** `public`

**Request:**
```json
{
  "userName":    "Nguyễn Văn An",
  "email":       "an.nguyen@gmail.com",
  "password":    "SecurePass123!",
  "phoneNumber": "0901234567"
}
```

**Validation:**

| Field | Rules |
|-------|-------|
| `userName` | required · string · 2–100 chars |
| `email` | required · valid email · lowercase |
| `password` | required · 8–64 chars · ≥1 uppercase · ≥1 number · ≥1 special char |
| `phoneNumber` | optional · VN phone format (`/^(0\|84)[35789]\d{8}$/`) |

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "accessToken":  "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "expiresIn":    900,
    "user": {
      "id":          "uuid",
      "userName":    "Nguyễn Văn An",
      "email":       "an.nguyen@gmail.com",
      "phoneNumber": "0901234567",
      "roles":       ["customer"],
      "isActive":    true,
      "createdAt":   "2026-04-01T00:00:00.000Z"
    }
  }
}
```

**Errors:**

| Code | HTTP | Mô tả |
|------|------|-------|
| `EMAIL_ALREADY_EXISTS` | 409 | Email đã được đăng ký |
| `PHONE_ALREADY_EXISTS` | 409 | SĐT đã được đăng ký |
| `VALIDATION_ERROR` | 400 | Input không hợp lệ |

---

#### `POST /auth/login`

Đăng nhập.

**Auth:** `public`

**Request:**
```json
{
  "email":    "an.nguyen@gmail.com",
  "password": "SecurePass123!",
  "deviceId": "device-fingerprint-uuid"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "accessToken":  "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "expiresIn":    900,
    "user": { ... }
  }
}
```

**Errors:**

| Code | HTTP | Mô tả |
|------|------|-------|
| `INVALID_CREDENTIALS` | 401 | Email/mật khẩu sai |
| `USER_INACTIVE` | 403 | Tài khoản bị khoá |

> **Security:** Không phân biệt "email không tồn tại" và "mật khẩu sai" → luôn trả `INVALID_CREDENTIALS`

---

#### `POST /auth/logout`

Đăng xuất — thu hồi refresh token hiện tại.

**Auth:** `customer`, `staff`, `admin`

**Request:**
```json
{
  "refreshToken": "eyJhbGci..."
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": { "message": "Đăng xuất thành công" }
}
```

---

#### `POST /auth/logout-all`

Đăng xuất khỏi tất cả thiết bị.

**Auth:** `customer`, `staff`, `admin`

**Response `200`:**
```json
{
  "success": true,
  "data": { "message": "Đã đăng xuất khỏi tất cả thiết bị" }
}
```

---

#### `POST /auth/refresh`

Làm mới access token.

**Auth:** `public`

**Request:**
```json
{
  "refreshToken": "eyJhbGci..."
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "accessToken":  "eyJhbGci...(mới)...",
    "refreshToken": "eyJhbGci...(mới)...",
    "expiresIn":    900
  }
}
```

**Errors:**

| Code | HTTP | Mô tả |
|------|------|-------|
| `INVALID_TOKEN` | 401 | Token không hợp lệ |
| `TOKEN_EXPIRED` | 401 | Refresh token hết hạn |
| `TOKEN_REVOKED` | 401 | Token đã bị thu hồi |

---

#### `POST /auth/forgot-password`

Yêu cầu email reset mật khẩu.

**Auth:** `public`

**Request:**
```json
{
  "email": "an.nguyen@gmail.com"
}
```

**Response `200`:** Luôn trả thành công (không lộ email tồn tại hay không)
```json
{
  "success": true,
  "data": {
    "message": "Nếu email tồn tại, bạn sẽ nhận được hướng dẫn trong vài phút."
  }
}
```

---

#### `POST /auth/reset-password`

Đặt lại mật khẩu với reset token.

**Auth:** `public`

**Request:**
```json
{
  "token":       "uuid-reset-token-từ-email",
  "newPassword": "NewSecurePass456!"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": { "message": "Mật khẩu đã được đặt lại thành công" }
}
```

---

#### `POST /auth/change-password`

Đổi mật khẩu khi đã đăng nhập.

**Auth:** `customer`, `staff`, `admin`

**Request:**
```json
{
  "currentPassword": "SecurePass123!",
  "newPassword":     "NewSecurePass456!"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": { "message": "Đổi mật khẩu thành công" }
}
```

**Errors:**

| Code | HTTP | Mô tả |
|------|------|-------|
| `WRONG_PASSWORD` | 400 | Mật khẩu hiện tại không đúng |
| `SAME_PASSWORD` | 400 | Mật khẩu mới trùng mật khẩu cũ |

---

### 6.2 Profile — `/users/me`

#### `GET /users/me`

Lấy thông tin cá nhân.

**Auth:** `customer`, `staff`, `admin`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id":          "uuid",
    "userName":    "Nguyễn Văn An",
    "email":       "an.nguyen@gmail.com",
    "phoneNumber": "0901234567",
    "isActive":    true,
    "roles":       ["customer"],
    "detail": {
      "fullName":    "Nguyễn Văn An",
      "avatarUrl":   "https://cdn.iluxury.vn/avatars/uuid.jpg",
      "dateOfBirth": "1995-03-15",
      "gender":      "male"
    },
    "createdAt": "2026-01-15T08:00:00.000Z",
    "updatedAt": "2026-03-20T10:30:00.000Z"
  }
}
```

---

#### `PATCH /users/me`

Cập nhật thông tin cá nhân.

**Auth:** `customer`, `staff`, `admin`

**Request:**
```json
{
  "userName":    "Nguyễn Văn An Updated",
  "phoneNumber": "0907654321",
  "detail": {
    "fullName":    "Nguyễn Văn An",
    "dateOfBirth": "1995-03-15",
    "gender":      "male"
  }
}
```

**Validation:**

| Field | Rules |
|-------|-------|
| `userName` | optional · 2–100 chars |
| `phoneNumber` | optional · VN phone · unique |
| `detail.fullName` | optional · 2–100 chars |
| `detail.dateOfBirth` | optional · ISO date · must be in the past |
| `detail.gender` | optional · `male` \| `female` \| `other` |

**Response `200`:** Trả về user đã cập nhật

---

#### `POST /users/me/avatar`

Upload ảnh đại diện.

**Auth:** `customer`, `staff`, `admin`  
**Content-Type:** `multipart/form-data`

**Request:** Form field `avatar` — file JPEG/PNG/WEBP, max 5MB

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "avatarUrl": "https://cdn.iluxury.vn/avatars/uuid.jpg"
  }
}
```

> **Xử lý:** Upload lên CDN (AWS S3 / Cloudflare R2), lưu URL vào `UserDetail.avatarUrl`, resize về 400×400.

---

### 6.3 Addresses — `/users/me/addresses`

#### `GET /users/me/addresses`

Danh sách địa chỉ của tôi.

**Auth:** `customer`, `staff`, `admin`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id":          "uuid",
      "label":       "Nhà",
      "fullName":    "Nguyễn Văn An",
      "phoneNumber": "0901234567",
      "province":    "TP. Hồ Chí Minh",
      "district":    "Quận 1",
      "ward":        "Phường Bến Nghé",
      "street":      "123 Nguyễn Huệ",
      "isDefault":   true,
      "createdAt":   "2026-01-15T08:00:00.000Z"
    }
  ]
}
```

---

#### `POST /users/me/addresses`

Thêm địa chỉ mới.

**Auth:** `customer`, `staff`, `admin`

**Request:**
```json
{
  "label":       "Văn phòng",
  "fullName":    "Nguyễn Văn An",
  "phoneNumber": "0901234567",
  "province":    "TP. Hồ Chí Minh",
  "district":    "Quận 3",
  "ward":        "Phường 10",
  "street":      "45 Lê Văn Sỹ",
  "isDefault":   false
}
```

**Validation:**

| Field | Rules |
|-------|-------|
| `fullName` | required · 2–100 chars |
| `phoneNumber` | required · VN phone format |
| `province` | required · non-empty string |
| `district` | required · non-empty string |
| `ward` | required · non-empty string |
| `street` | required · 5–500 chars |
| `label` | optional · max 50 chars |
| `isDefault` | optional · boolean |

**Business rule:** Nếu đây là địa chỉ đầu tiên → tự động set `isDefault = true`.  
Max 10 địa chỉ / user.

**Response `201`:** Trả địa chỉ vừa tạo

---

#### `PUT /users/me/addresses/:id`

Cập nhật địa chỉ.

**Auth:** `customer`, `staff`, `admin`

**Response `200`:** Trả địa chỉ đã cập nhật

**Errors:** `ADDRESS_NOT_FOUND` (404) nếu không tìm thấy hoặc không thuộc user

---

#### `DELETE /users/me/addresses/:id`

Xoá địa chỉ.

**Auth:** `customer`, `staff`, `admin`

**Business rule:** Nếu xoá địa chỉ mặc định và còn địa chỉ khác → tự động set địa chỉ mới nhất làm mặc định.

**Response `200`:**
```json
{
  "success": true,
  "data": { "message": "Đã xoá địa chỉ" }
}
```

---

#### `PATCH /users/me/addresses/:id/set-default`

Đặt làm địa chỉ mặc định.

**Auth:** `customer`, `staff`, `admin`

**Response `200`:**
```json
{
  "success": true,
  "data": { "message": "Đã đặt làm địa chỉ mặc định" }
}
```

---

### 6.4 FCM Token — `/users/me/fcm-token`

#### `POST /users/me/fcm-token`

Đăng ký FCM token cho thiết bị.

**Auth:** `customer`, `staff`, `admin`

**Request:**
```json
{
  "token":      "fcm-device-token-string",
  "deviceType": "android"
}
```

**Business rule:** Nếu token đã tồn tại (của user khác) → reassign về user hiện tại (user cũ đăng nhập thiết bị mới).

**Response `201`:**
```json
{
  "success": true,
  "data": { "message": "Đã đăng ký thông báo" }
}
```

---

#### `DELETE /users/me/fcm-token`

Huỷ đăng ký FCM token (khi đăng xuất).

**Auth:** `customer`, `staff`, `admin`

**Request:**
```json
{
  "token": "fcm-device-token-string"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": { "message": "Đã huỷ đăng ký thông báo" }
}
```

---

### 6.5 Admin — `/users` (quản lý)

#### `GET /users`

Danh sách tất cả user.

**Auth:** `admin`, `staff`

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|-------|
| `page` | number | Trang (default: 1) |
| `limit` | number | Số item (default: 20, max: 100) |
| `search` | string | Tìm theo email, tên, SĐT |
| `role` | string | Filter: `admin` \| `staff` \| `customer` |
| `isActive` | boolean | Filter theo trạng thái |
| `sortBy` | string | `createdAt` \| `email` \| `userName` |
| `sortOrder` | string | `asc` \| `desc` |

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id":          "uuid",
      "userName":    "Nguyễn Văn An",
      "email":       "an.nguyen@gmail.com",
      "phoneNumber": "0901234567",
      "roles":       ["customer"],
      "isActive":    true,
      "detail": { "fullName": "Nguyễn Văn An", "avatarUrl": "..." },
      "createdAt":   "2026-01-15T08:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 }
}
```

---

#### `GET /users/:id`

Chi tiết 1 user.

**Auth:** `admin`, `staff`

**Response `200`:** User object đầy đủ (kèm addresses, roles)

---

#### `PATCH /users/:id/toggle-active`

Khoá / Mở khoá tài khoản.

**Auth:** `admin`

**Request:**
```json
{
  "isActive": false,
  "reason":   "Vi phạm điều khoản sử dụng"
}
```

**Business rules:**
- Không cho admin tự khoá chính mình
- Khoá tài khoản → thu hồi toàn bộ refresh tokens

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "userId":   "uuid",
    "isActive": false,
    "message":  "Tài khoản đã bị khoá"
  }
}
```

---

#### `PATCH /users/:id/roles`

Phân quyền cho user.

**Auth:** `admin`

**Request:**
```json
{
  "roles": ["staff"]
}
```

**Business rules:**
- Roles hợp lệ: `customer`, `staff`, `admin`
- Không cho xoá role của chính mình nếu là admin duy nhất

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "roles":  ["staff"]
  }
}
```

---

### 6.6 Internal RPC — `/internal`

> Chỉ dành cho service-to-service, auth bằng `X-Service-Token` header.

#### `POST /internal/users/validate-token`

Validate JWT access token.

**Request:**
```json
{
  "token": "eyJhbGci..."
}
```

**Response `200`:**
```json
{
  "valid":  true,
  "userId": "uuid",
  "email":  "an.nguyen@gmail.com",
  "roles":  ["customer"]
}
```

**Response `401`:**
```json
{
  "valid":  false,
  "reason": "TOKEN_EXPIRED"
}
```

---

#### `GET /internal/users/:id`

Lấy thông tin cơ bản của user (dùng cho các service cần hiển thị tên user).

**Response `200`:**
```json
{
  "id":          "uuid",
  "userName":    "Nguyễn Văn An",
  "email":       "an.nguyen@gmail.com",
  "phoneNumber": "0901234567",
  "roles":       ["customer"],
  "isActive":    true,
  "detail": {
    "fullName":  "Nguyễn Văn An",
    "avatarUrl": "https://cdn.iluxury.vn/avatars/uuid.jpg"
  }
}
```

---

#### `POST /internal/users/batch`

Lấy thông tin nhiều user cùng lúc.

**Request:**
```json
{
  "userIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**Response `200`:**
```json
{
  "users": [
    { "id": "uuid-1", "userName": "...", ... },
    { "id": "uuid-2", "userName": "...", ... }
  ]
}
```

---

## 7. RabbitMQ Events

### 7.1 Exchange Config

```typescript
export const RABBITMQ_CONFIG = {
  exchange:     'apple_shop',
  exchangeType: 'topic',

  // Routing keys PUBLISH
  routingKeys: {
    userRegistered:    'user.registered',
    passwordReset:     'user.password_reset',
    accountLocked:     'user.account_locked',
  }
};
```

---

### 7.2 PUBLISH — `user.registered`

**Trigger:** Sau khi đăng ký thành công  
**Consumer:** Notification Service (gửi email chào mừng)

```typescript
interface UserRegisteredPayload {
  userId:    string;
  email:     string;
  fullName:  string | null;
  createdAt: string;
}
```

---

### 7.3 PUBLISH — `user.password_reset`

**Trigger:** Sau khi gọi `/auth/forgot-password`  
**Consumer:** Notification Service (gửi email link reset)

```typescript
interface PasswordResetPayload {
  userId:     string;
  email:      string;
  fullName:   string | null;
  resetToken: string;  // Raw token để build link
  expiresAt:  string;  // ISO string — 15 phút
}
```

---

### 7.4 PUBLISH — `user.account_locked`

**Trigger:** Admin khoá tài khoản  
**Consumer:** Notification Service (gửi thông báo cho user)

```typescript
interface AccountLockedPayload {
  userId:    string;
  email:     string;
  reason:    string;
  lockedAt:  string;
}
```

---

## 8. Cấu Trúc Thư Mục

```
user-service/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── config/
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   ├── jwt.config.ts
│   │   ├── bcrypt.config.ts
│   │   ├── rabbitmq.config.ts
│   │   └── redis.config.ts
│   │
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   ├── prisma.service.ts
│   │   └── schema.prisma
│   │
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── token.service.ts          # Issue, verify, revoke tokens
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts       # Passport JWT strategy
│   │   │   └── local.strategy.ts     # Passport Local (email+password)
│   │   └── dto/
│   │       ├── register.dto.ts
│   │       ├── login.dto.ts
│   │       ├── refresh-token.dto.ts
│   │       ├── forgot-password.dto.ts
│   │       ├── reset-password.dto.ts
│   │       └── change-password.dto.ts
│   │
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts       # Public REST endpoints
│   │   ├── users.service.ts
│   │   ├── users.repository.ts
│   │   └── dto/
│   │       ├── update-profile.dto.ts
│   │       ├── query-users.dto.ts
│   │       ├── toggle-active.dto.ts
│   │       └── update-roles.dto.ts
│   │
│   ├── addresses/
│   │   ├── addresses.module.ts
│   │   ├── addresses.controller.ts
│   │   ├── addresses.service.ts
│   │   ├── addresses.repository.ts
│   │   └── dto/
│   │       ├── create-address.dto.ts
│   │       └── update-address.dto.ts
│   │
│   ├── fcm/
│   │   ├── fcm.module.ts
│   │   ├── fcm.controller.ts
│   │   ├── fcm.service.ts
│   │   └── dto/
│   │       ├── register-token.dto.ts
│   │       └── remove-token.dto.ts
│   │
│   ├── internal/
│   │   ├── internal.module.ts
│   │   ├── internal.controller.ts    # /internal/* endpoints (RPC)
│   │   └── dto/
│   │       ├── validate-token.dto.ts
│   │       └── batch-users.dto.ts
│   │
│   ├── publishers/
│   │   ├── publishers.module.ts
│   │   └── user.publisher.ts
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
│   │   ├── pipes/
│   │   │   └── parse-uuid.pipe.ts
│   │   └── constants/
│   │       ├── roles.constant.ts
│   │       └── error-codes.constant.ts
│   │
│   ├── upload/
│   │   ├── upload.module.ts
│   │   └── upload.service.ts         # Avatar upload đến CDN
│   │
│   └── health/
│       ├── health.module.ts
│       └── health.controller.ts
│
├── test/
│   ├── unit/
│   │   ├── auth.service.spec.ts
│   │   ├── token.service.spec.ts
│   │   ├── users.service.spec.ts
│   │   └── addresses.service.spec.ts
│   └── e2e/
│       ├── auth.e2e-spec.ts
│       └── users.e2e-spec.ts
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── .env
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

---

## 9. Modules & Classes Chi Tiết

### 9.1 `AuthModule`

```typescript
@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:      config.get('jwt.secret'),
        signOptions: { expiresIn: config.get('jwt.accessExpiry') },
      }),
    }),
    PassportModule,
    UsersModule,
    PublishersModule,
    RedisModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    JwtStrategy,
    LocalStrategy,
  ],
  exports: [TokenService],
})
export class AuthModule {}
```

---

### 9.2 `AuthController`

```typescript
@ApiTags('Auth')
@Controller('auth')
export class AuthController {

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) { ... }

  @Post('login')
  @Public()
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  login(@CurrentUser() user: User, @Body() dto: LoginDto) { ... }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout(@CurrentUser() user: UserPayload, @Body() dto: LogoutDto) { ... }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logoutAll(@CurrentUser() user: UserPayload) { ... }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) { ... }

  @Post('forgot-password')
  @Public()
  @Throttle(3, 60)  // 3 lần / 60 giây
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) { ... }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) { ... }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  changePassword(@CurrentUser() user: UserPayload, @Body() dto: ChangePasswordDto) { ... }
}
```

---

### 9.3 `TokenService`

```typescript
@Injectable()
export class TokenService {

  constructor(
    private jwtService:    JwtService,
    private prisma:        PrismaService,
    private config:        ConfigService,
  ) {}

  async issueTokenPair(
    userId:   string,
    roles:    string[],
    email:    string,
    deviceId?: string,
  ): Promise<TokenPair> {
    const jti = uuidv4();

    const accessToken = this.jwtService.sign(
      { sub: userId, email, roles, type: 'access' },
      { expiresIn: this.config.get('jwt.accessExpiry') },  // '15m'
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId, jti, deviceId, type: 'refresh' },
      {
        secret:    this.config.get('jwt.refreshSecret'),
        expiresIn: this.config.get('jwt.refreshExpiry'),   // '30d'
      },
    );

    // Lưu hashed refresh token vào DB
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        token:     tokenHash,
        deviceId:  deviceId ?? null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,  // 15 * 60 seconds
    };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> { ... }

  async rotateRefreshToken(rawToken: string): Promise<TokenPair> { ... }

  async revokeToken(rawToken: string): Promise<void> { ... }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data:  { revokedAt: new Date() },
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
```

---

### 9.4 `UsersRepository`

```typescript
@Injectable()
export class UsersRepository {

  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        userRoles: { include: { role: true } },
        userDetail: true,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: { include: { role: true } },
        userDetail: true,
        addresses:  true,
      },
    });
  }

  async findMany(params: {
    skip?:    number;
    take?:    number;
    where?:   Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<[User[], number]> {
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        ...params,
        include: {
          userRoles:  { include: { role: true } },
          userDetail: true,
        },
      }),
      this.prisma.user.count({ where: params.where }),
    ]);
    return [users, total];
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { email: email.toLowerCase() },
    });
    return count > 0;
  }

  async existsByPhone(phone: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { phoneNumber: phone },
    });
    return count > 0;
  }

  async updateRoles(userId: string, roleNames: string[]): Promise<void> {
    const roles = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
    });

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.createMany({
        data: roles.map(r => ({ userId, roleId: r.id })),
      }),
    ]);
  }
}
```

---

## 10. DTOs & Validation

### 10.1 `RegisterDto`

```typescript
export class RegisterDto {
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) => value?.trim())
  @ApiProperty({ example: 'Nguyễn Văn An' })
  userName: string;

  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  @ApiProperty({ example: 'an.nguyen@gmail.com' })
  email: string;

  @IsString()
  @Length(8, 64)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/, {
    message: 'Mật khẩu phải có ít nhất 1 chữ hoa, 1 số, 1 ký tự đặc biệt',
  })
  @ApiProperty({ example: 'SecurePass123!' })
  password: string;

  @IsOptional()
  @IsString()
  @Matches(/^(0|84)[35789]\d{8}$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  @ApiProperty({ required: false, example: '0901234567' })
  phoneNumber?: string;
}
```

### 10.2 `LoginDto`

```typescript
export class LoginDto {
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceId?: string;
}
```

### 10.3 `CreateAddressDto`

```typescript
export class CreateAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string;

  @IsString()
  @Length(2, 100)
  fullName: string;

  @IsString()
  @Matches(/^(0|84)[35789]\d{8}$/)
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  province: string;

  @IsString()
  @IsNotEmpty()
  district: string;

  @IsString()
  @IsNotEmpty()
  ward: string;

  @IsString()
  @Length(5, 500)
  street: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean = false;
}
```

### 10.4 `UpdateProfileDto`

```typescript
export class UpdateDetailDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  fullName?: string;

  @IsOptional()
  @IsDateString()
  @MaxDate(new Date())
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) => value?.trim())
  userName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(0|84)[35789]\d{8}$/)
  phoneNumber?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateDetailDto)
  detail?: UpdateDetailDto;
}
```

### 10.5 `QueryUsersDto`

```typescript
export class QueryUsersDto {
  @IsOptional() @IsInt() @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number = 1;

  @IsOptional() @IsInt() @Min(1) @Max(100)
  @Transform(({ value }) => parseInt(value))
  limit?: number = 20;

  @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @IsOptional() @IsEnum(['admin', 'staff', 'customer'])
  role?: string;

  @IsOptional() @IsBoolean()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : undefined)
  isActive?: boolean;

  @IsOptional() @IsIn(['createdAt', 'email', 'userName'])
  sortBy?: string = 'createdAt';

  @IsOptional() @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
```

---

## 11. Error Handling

### 11.1 Custom Exceptions

```typescript
// exceptions/index.ts

export class EmailAlreadyExistsException extends ConflictException {
  constructor() {
    super({ code: 'EMAIL_ALREADY_EXISTS', message: 'Email này đã được sử dụng' });
  }
}

export class PhoneAlreadyExistsException extends ConflictException {
  constructor() {
    super({ code: 'PHONE_ALREADY_EXISTS', message: 'Số điện thoại này đã được đăng ký' });
  }
}

export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super({ code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng' });
  }
}

export class UserInactiveException extends ForbiddenException {
  constructor() {
    super({ code: 'USER_INACTIVE', message: 'Tài khoản đã bị khoá. Vui lòng liên hệ hỗ trợ.' });
  }
}

export class UserNotFoundException extends NotFoundException {
  constructor(id?: string) {
    super({ code: 'USER_NOT_FOUND', message: `Không tìm thấy người dùng${id ? ': ' + id : ''}` });
  }
}

export class InvalidTokenException extends UnauthorizedException {
  constructor() {
    super({ code: 'INVALID_TOKEN', message: 'Token không hợp lệ' });
  }
}

export class TokenExpiredException extends UnauthorizedException {
  constructor() {
    super({ code: 'TOKEN_EXPIRED', message: 'Token đã hết hạn' });
  }
}

export class TokenRevokedException extends UnauthorizedException {
  constructor() {
    super({ code: 'TOKEN_REVOKED', message: 'Token đã bị thu hồi' });
  }
}

export class AddressNotFoundException extends NotFoundException {
  constructor() {
    super({ code: 'ADDRESS_NOT_FOUND', message: 'Không tìm thấy địa chỉ' });
  }
}

export class AddressLimitExceededException extends BadRequestException {
  constructor() {
    super({ code: 'ADDRESS_LIMIT_EXCEEDED', message: 'Chỉ được lưu tối đa 10 địa chỉ' });
  }
}

export class WrongPasswordException extends BadRequestException {
  constructor() {
    super({ code: 'WRONG_PASSWORD', message: 'Mật khẩu hiện tại không đúng' });
  }
}

export class SamePasswordException extends BadRequestException {
  constructor() {
    super({ code: 'SAME_PASSWORD', message: 'Mật khẩu mới không được trùng mật khẩu cũ' });
  }
}

export class CannotLockSelfException extends ForbiddenException {
  constructor() {
    super({ code: 'CANNOT_LOCK_SELF', message: 'Không thể khoá tài khoản của chính mình' });
  }
}
```

### 11.2 Error Code Registry

| Code | HTTP | Trigger |
|------|------|---------|
| `EMAIL_ALREADY_EXISTS` | 409 | Đăng ký email đã tồn tại |
| `PHONE_ALREADY_EXISTS` | 409 | SĐT đã đăng ký |
| `INVALID_CREDENTIALS` | 401 | Sai email/password |
| `USER_INACTIVE` | 403 | Tài khoản bị khoá |
| `USER_NOT_FOUND` | 404 | Không tìm thấy user |
| `INVALID_TOKEN` | 401 | JWT không hợp lệ |
| `TOKEN_EXPIRED` | 401 | JWT hết hạn |
| `TOKEN_REVOKED` | 401 | Refresh token đã bị thu hồi |
| `ADDRESS_NOT_FOUND` | 404 | Địa chỉ không tồn tại / không thuộc user |
| `ADDRESS_LIMIT_EXCEEDED` | 400 | Vượt 10 địa chỉ |
| `WRONG_PASSWORD` | 400 | Mật khẩu cũ không đúng |
| `SAME_PASSWORD` | 400 | Mật khẩu mới = mật khẩu cũ |
| `CANNOT_LOCK_SELF` | 403 | Admin tự khoá mình |
| `VALIDATION_ERROR` | 400 | Input không hợp lệ |
| `INTERNAL_ERROR` | 500 | Lỗi server |

---

## 12. Security

### 12.1 Rate Limiting

```typescript
// Áp dụng qua @nestjs/throttler

// Global: 100 requests / minute / IP
ThrottlerModule.forRoot({ ttl: 60, limit: 100 })

// Auth endpoints — chặt hơn:
@Throttle(5, 60)   // POST /auth/login       — 5 lần / 60s
@Throttle(3, 300)  // POST /auth/forgot-password — 3 lần / 5 phút
@Throttle(10, 60)  // POST /auth/refresh      — 10 lần / 60s
```

### 12.2 Security Headers

```typescript
// main.ts
app.use(helmet());  // X-Frame-Options, X-XSS-Protection, ...

// CORS
app.enableCors({
  origin:      process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});
```

### 12.3 Input Sanitization

```typescript
// Sử dụng class-validator + class-transformer trên mọi DTO
// Whitelist validation: loại bỏ field lạ không có trong DTO
app.useGlobalPipes(
  new ValidationPipe({
    whitelist:        true,   // Xoá field không khai báo trong DTO
    forbidNonWhitelisted: true,
    transform:        true,
    transformOptions: { enableImplicitConversion: true },
  }),
);
```

### 12.4 Password Policy

```
Độ dài:        8–64 ký tự
Độ phức tạp:   ≥1 chữ hoa, ≥1 chữ thường, ≥1 số, ≥1 ký tự đặc biệt
Blacklist:     Không được dùng email làm mật khẩu
Lịch sử:       Không được dùng lại mật khẩu vừa đổi
Bcrypt rounds: 12
```

### 12.5 Sensitive Data

```typescript
// KHÔNG bao giờ log hoặc trả về:
// - hashPassword
// - refreshToken (chỉ trả 1 lần khi issue)
// - resetToken
// - Toàn bộ RefreshToken record

// Response mapping luôn dùng:
class UserResponseDto {
  id:          string;
  userName:    string;
  email:       string;
  phoneNumber: string | null;
  roles:       string[];
  isActive:    boolean;
  // ❌ KHÔNG có: hashPassword, refreshTokens, fcmTokens
}
```

---

## 13. Guards & Middleware

### 13.1 `JwtAuthGuard`

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Bỏ qua nếu có @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

### 13.2 `RolesGuard`

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some(role => user.roles.includes(role));
  }
}
```

### 13.3 `ServiceAuthGuard`

```typescript
// Dùng cho /internal/* endpoints
@Injectable()
export class ServiceAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token   = request.headers['x-service-token'];

    if (!token || token !== process.env.INTERNAL_SERVICE_TOKEN) {
      throw new ForbiddenException('Service token không hợp lệ');
    }
    return true;
  }
}
```

### 13.4 `CurrentUser` Decorator

```typescript
export const CurrentUser = createParamDecorator(
  (data: keyof UserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user    = request.user as UserPayload;
    return data ? user?.[data] : user;
  },
);

// Sử dụng:
@Get('me')
getProfile(@CurrentUser() user: UserPayload) { ... }

@Get('me/email')
getEmail(@CurrentUser('email') email: string) { ... }
```

---

## 14. Configuration & Environment

### 14.1 `.env`

```env
# App
NODE_ENV=development
PORT=3001
SERVICE_NAME=user-service

# Database
DATABASE_URL="mysql://root:password@localhost:3306/db_users"

# JWT
JWT_SECRET=your-very-long-random-secret-key-min-32-chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_SECRET=another-very-long-different-random-secret
JWT_REFRESH_EXPIRY=30d

# Bcrypt
BCRYPT_ROUNDS=12

# RabbitMQ
AMQP_URL="amqp://guest:guest@localhost:5672"

# Redis (cho reset token cache)
REDIS_URL="redis://localhost:6379"
RESET_TOKEN_TTL_SECONDS=900

# Internal service auth
INTERNAL_SERVICE_TOKEN=random-service-secret-token

# CDN / Storage (avatar upload)
CDN_BASE_URL=https://cdn.iluxury.vn
S3_BUCKET=iluxury-uploads
S3_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# CORS
ALLOWED_ORIGINS=http://localhost:5500,https://iluxury.vn

# Rate limit
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

### 14.2 `jwt.config.ts`

```typescript
export default registerAs('jwt', () => ({
  secret:         process.env.JWT_SECRET,
  accessExpiry:   process.env.JWT_ACCESS_EXPIRY  || '15m',
  refreshSecret:  process.env.JWT_REFRESH_SECRET,
  refreshExpiry:  process.env.JWT_REFRESH_EXPIRY || '30d',
}));
```

### 14.3 `package.json`

```json
{
  "name": "user-service",
  "scripts": {
    "build":          "nest build",
    "start":          "nest start",
    "start:dev":      "nest start --watch",
    "start:prod":     "node dist/main",
    "test":           "jest",
    "test:watch":     "jest --watch",
    "test:cov":       "jest --coverage",
    "test:e2e":       "jest --config ./test/jest-e2e.json",
    "db:migrate":     "prisma migrate dev",
    "db:generate":    "prisma generate",
    "db:seed":        "ts-node prisma/seed.ts"
  },
  "dependencies": {
    "@nestjs/common":       "^10.x",
    "@nestjs/core":         "^10.x",
    "@nestjs/config":       "^3.x",
    "@nestjs/jwt":          "^10.x",
    "@nestjs/passport":     "^10.x",
    "@nestjs/throttler":    "^5.x",
    "@nestjs/terminus":     "^10.x",
    "@prisma/client":       "^5.x",
    "passport":             "^0.7.x",
    "passport-jwt":         "^4.x",
    "passport-local":       "^1.x",
    "bcrypt":               "^5.x",
    "helmet":               "^7.x",
    "class-transformer":    "^0.5.x",
    "class-validator":      "^0.14.x",
    "amqplib":              "^0.10.x",
    "ioredis":              "^5.x",
    "uuid":                 "^9.x",
    "multer":               "^1.x",
    "@aws-sdk/client-s3":   "^3.x"
  },
  "devDependencies": {
    "prisma":               "^5.x",
    "@types/bcrypt":        "^5.x",
    "@types/passport-jwt":  "^4.x",
    "@types/passport-local":"^1.x",
    "@types/multer":        "^1.x",
    "jest":                 "^29.x",
    "@types/jest":          "^29.x",
    "ts-jest":              "^29.x",
    "supertest":            "^6.x"
  }
}
```

---

## 15. Testing Strategy

### 15.1 Unit Tests — `AuthService`

```typescript
describe('AuthService', () => {

  describe('register', () => {
    it('should create user with hashed password', async () => {
      // Mock: existsByEmail → false
      // Expected: bcrypt.hash called, user created, token issued
    });

    it('should throw EmailAlreadyExistsException if email taken', async () => {
      // Mock: existsByEmail → true
      // Expected: throw 409
    });

    it('should throw PhoneAlreadyExistsException if phone taken', async () => { ... });

    it('should assign customer role by default', async () => {
      // Expected: userRoles contains { role: { name: 'customer' } }
    });

    it('should publish user.registered event', async () => {
      // Expected: publisher.publish called with 'user.registered'
    });
  });

  describe('login', () => {
    it('should return tokens on valid credentials', async () => { ... });

    it('should throw InvalidCredentialsException on wrong password', async () => { ... });

    it('should throw UserInactiveException when account locked', async () => { ... });
  });

  describe('refreshToken', () => {
    it('should issue new token pair', async () => { ... });
    it('should revoke old token', async () => { ... });
    it('should throw on revoked token', async () => { ... });
    it('should revoke ALL tokens on reuse detection', async () => { ... });
  });

  describe('changePassword', () => {
    it('should hash new password and update', async () => { ... });
    it('should throw WrongPasswordException on wrong current password', async () => { ... });
    it('should throw SamePasswordException if new == old', async () => { ... });
  });
});
```

### 15.2 Unit Tests — `UsersService`

```typescript
describe('UsersService', () => {

  describe('setDefaultAddress', () => {
    it('should update isDefault atomically', async () => {
      // Expected: $transaction called, previous defaults unset
    });

    it('should throw AddressNotFoundException if address not owned by user', async () => { ... });
  });

  describe('toggleActive', () => {
    it('should revoke all refresh tokens when locking', async () => { ... });
    it('should throw CannotLockSelfException', async () => { ... });
  });

  describe('updateRoles', () => {
    it('should replace all roles atomically', async () => { ... });
    it('should throw on invalid role name', async () => { ... });
  });
});
```

### 15.3 E2E Tests

```typescript
describe('AuthController (e2e)', () => {

  it('POST /auth/register — success', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        userName: 'Test User',
        email:    'test@example.com',
        password: 'Test@12345',
      })
      .expect(201);

    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data.user.roles).toContain('customer');
  });

  it('POST /auth/login — invalid credentials return 401', async () => {
    await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'WrongPass' })
      .expect(401);
  });

  it('POST /auth/refresh — rotation works', async () => {
    const loginRes  = await loginAsCustomer();
    const refreshRes = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: loginRes.refreshToken })
      .expect(200);

    // Token cũ không dùng được nữa
    await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: loginRes.refreshToken })
      .expect(401);
  });

  it('Rate limit on /auth/login — 6th attempt returns 429', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post('/auth/login').send({ ... });
    }
    await request(app).post('/auth/login').send({ ... }).expect(429);
  });
});
```

### 15.4 Coverage Targets

| Module | Target |
|--------|--------|
| `AuthService` | ≥ 90% |
| `TokenService` | ≥ 95% |
| `UsersService` | ≥ 85% |
| `AddressesService` | ≥ 85% |
| `UsersRepository` | ≥ 80% |
| **Overall** | **≥ 85%** |

---

*User Service Design Document · v1.0 · iLuxury Apple Shop*
