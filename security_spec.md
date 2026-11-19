# Security Specification — ইবনে সিনা টালিখাতা (MR Sales & Ledger)

## 1. Data Invariants
1. Every document under `/users/{userId}` and its subcollections (`products`, `shops`, `sales`, `payments`) is strictly private to the authenticated, email-verified user whose `request.auth.uid == userId`.
2. Every subcollection document must declare `ownerId == request.auth.uid` on creation, and `ownerId` + `createdAt` / `serverCreatedAt` are immutable on update.
3. No `SaleRecord` or `PaymentRecord` may be created without a valid `shopId` referencing an existing (or atomically created via `existsAfter`) `Shopkeeper` document under `/users/{userId}/shops/{shopId}`.
4. All document IDs (`userId`, `productId`, `shopId`, `saleId`, `paymentId`) must match `^[a-zA-Z0-9_-]+$` with max length 128.
5. Every string field enforces strict `.size()` limits, every numeric field enforces non-negative bounds (`paidAmount <= netTotal`), and `SaleRecord.items` is strictly bounded (`size() >= 1 && size() <= 60`) with first-element type validation.
6. All server timestamps (`createdAt`, `serverCreatedAt`, `updatedAt`) must equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Write**: Creating a shopkeeper with `request.auth == null`.
2. **Unverified Email**: Creating a product when `request.auth.token.email_verified == false`.
3. **Cross-Tenant Identity Spoofing (Path)**: User A (`uidA`) reading or writing `/users/uidB/shops/shop1`.
4. **Cross-Tenant Identity Spoofing (Payload)**: User A (`uidA`) creating `/users/uidA/shops/shop1` with `ownerId: "uidB"`.
5. **Shadow / Ghost Field Injection**: Creating a product with an extra undeclared field `isAdmin: true` or `role: "superadmin"`.
6. **Resource Poisoning (Oversized ID)**: Creating a shop with `shopId` length > 128 or illegal characters (`"../bad/id"`).
7. **Resource Poisoning (Oversized String)**: Creating a shop with `shopName` length > 120 (e.g., 5000 chars).
8. **Orphaned Sale Record**: Creating a `SaleRecord` with `shopId: "nonexistent-shop"`.
9. **Client Timestamp Tampering**: Creating a `SaleRecord` with `createdAt` set to a forged past date instead of `request.time`.
10. **Immutable Field Mutation**: Updating a `Shopkeeper` to change `ownerId` or `serverCreatedAt`.
11. **Unbounded Array / Invalid Arithmetic**: Creating a `SaleRecord` with `items: []` (0 items) or `items.length > 60` or `paidAmount > netTotal`.
12. **Blanket List Scraping**: Listing `/users` (root users collection) or listing `/users/uidB/sales` as `uidA`.
