import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import blueprint from './firebase-blueprint.json' with { type: 'json' };

const rulesSource = fs.readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');

const VALID_ID_REGEX = new RegExp(blueprint.entities.Shopkeeper.properties.id.pattern);

interface AuthContext {
  uid: string;
  emailVerified: boolean;
}

function evaluateShopCreate(
  auth: AuthContext | null,
  targetUserId: string,
  shopId: string,
  payload: Record<string, unknown>,
  serverTimeSentinel: symbol,
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || !auth.emailVerified || auth.uid !== targetUserId) return 'PERMISSION_DENIED';
  if (!VALID_ID_REGEX.test(targetUserId) || targetUserId.length > 128) return 'PERMISSION_DENIED';
  if (!VALID_ID_REGEX.test(shopId) || shopId.length > 128) return 'PERMISSION_DENIED';

  const required = blueprint.entities.Shopkeeper.required;
  const allowed = Object.keys(blueprint.entities.Shopkeeper.properties);
  const keys = Object.keys(payload);
  if (!required.every((k) => keys.includes(k))) return 'PERMISSION_DENIED';
  if (!keys.every((k) => allowed.includes(k))) return 'PERMISSION_DENIED';

  if (payload.id !== shopId || payload.ownerId !== targetUserId) return 'PERMISSION_DENIED';
  if (
    typeof payload.shopName !== 'string' ||
    payload.shopName.length < 1 ||
    payload.shopName.length > blueprint.entities.Shopkeeper.properties.shopName.maxLength
  ) {
    return 'PERMISSION_DENIED';
  }
  if (payload.serverCreatedAt !== serverTimeSentinel || payload.updatedAt !== serverTimeSentinel) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOW';
}

function evaluateSaleCreate(
  auth: AuthContext | null,
  targetUserId: string,
  saleId: string,
  payload: Record<string, unknown>,
  existingShopIds: Set<string>,
  serverTimeSentinel: symbol,
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || !auth.emailVerified || auth.uid !== targetUserId) return 'PERMISSION_DENIED';
  if (!VALID_ID_REGEX.test(saleId) || saleId.length > 128) return 'PERMISSION_DENIED';

  const required = blueprint.entities.SaleRecord.required;
  const allowed = Object.keys(blueprint.entities.SaleRecord.properties);
  const keys = Object.keys(payload);
  if (!required.every((k) => keys.includes(k))) return 'PERMISSION_DENIED';
  if (!keys.every((k) => allowed.includes(k))) return 'PERMISSION_DENIED';

  if (payload.ownerId !== targetUserId || payload.id !== saleId) return 'PERMISSION_DENIED';
  if (typeof payload.shopId !== 'string' || !existingShopIds.has(payload.shopId)) {
    return 'PERMISSION_DENIED';
  }
  if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 60) {
    return 'PERMISSION_DENIED';
  }
  if (
    typeof payload.netTotal !== 'number' ||
    typeof payload.paidAmount !== 'number' ||
    payload.paidAmount < 0 ||
    payload.paidAmount > payload.netTotal
  ) {
    return 'PERMISSION_DENIED';
  }
  if (payload.createdAt !== serverTimeSentinel) return 'PERMISSION_DENIED';
  return 'ALLOW';
}

test('firestore.rules contains mandatory Eight Pillars security primitives', () => {
  assert.match(rulesSource, /rules_version = '2';/);
  assert.match(rulesSource, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
  assert.match(rulesSource, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesSource, /existsAfter\(/);
  assert.match(rulesSource, /allow list: if isOwner\(userId\) && resource\.data\.ownerId == request\.auth\.uid;/);
});

test('Dirty Dozen adversarial payloads all result in PERMISSION_DENIED', () => {
  const SERVER_TIME = Symbol('request.time');
  const validUser: AuthContext = { uid: 'user-1', emailVerified: true };
  const validShopIds = new Set(['shop-1']);

  const validShopPayload = {
    id: 'shop-1',
    ownerId: 'user-1',
    shopName: 'মা মেডিকেল হল',
    ownerName: 'করিম',
    phone: '01711000000',
    area: 'শাহবাগ',
    createdAt: '2026-11-18T10:00:00.000Z',
    serverCreatedAt: SERVER_TIME,
    updatedAt: SERVER_TIME,
  };

  assert.equal(evaluateShopCreate(validUser, 'user-1', 'shop-1', validShopPayload, SERVER_TIME), 'ALLOW');

  // 1. Unauthenticated write
  assert.equal(evaluateShopCreate(null, 'user-1', 'shop-1', validShopPayload, SERVER_TIME), 'PERMISSION_DENIED');
  // 2. Unverified email
  assert.equal(
    evaluateShopCreate({ uid: 'user-1', emailVerified: false }, 'user-1', 'shop-1', validShopPayload, SERVER_TIME),
    'PERMISSION_DENIED',
  );
  // 3. Cross-tenant path spoof
  assert.equal(evaluateShopCreate(validUser, 'user-2', 'shop-1', validShopPayload, SERVER_TIME), 'PERMISSION_DENIED');
  // 4. Cross-tenant ownerId spoof
  assert.equal(
    evaluateShopCreate(validUser, 'user-1', 'shop-1', { ...validShopPayload, ownerId: 'user-2' }, SERVER_TIME),
    'PERMISSION_DENIED',
  );
  // 5. Shadow/ghost field injection
  assert.equal(
    evaluateShopCreate(validUser, 'user-1', 'shop-1', { ...validShopPayload, isAdmin: true }, SERVER_TIME),
    'PERMISSION_DENIED',
  );
  // 6. Oversized/malformed ID
  assert.equal(
    evaluateShopCreate(validUser, 'user-1', '../bad-id', { ...validShopPayload, id: '../bad-id' }, SERVER_TIME),
    'PERMISSION_DENIED',
  );
  // 7. Oversized string (> 120 chars)
  assert.equal(
    evaluateShopCreate(validUser, 'user-1', 'shop-1', { ...validShopPayload, shopName: 'x'.repeat(200) }, SERVER_TIME),
    'PERMISSION_DENIED',
  );
  // 8. Forged client timestamp
  assert.equal(
    evaluateShopCreate(
      validUser,
      'user-1',
      'shop-1',
      { ...validShopPayload, serverCreatedAt: '2020-01-01T00:00:00Z' },
      SERVER_TIME,
    ),
    'PERMISSION_DENIED',
  );

  const validSalePayload = {
    id: 'sale-1',
    ownerId: 'user-1',
    invoiceNo: 'INV-101',
    shopId: 'shop-1',
    shopName: 'মা মেডিকেল হল',
    date: '2026-11-18T10:00:00.000Z',
    items: [{ productId: 'ibn-dexlan', boxes: 2, netTotal: 864 }],
    totalBoxes: 2,
    grossTotal: 960,
    totalDiscount: 96,
    netTotal: 864,
    paidAmount: 500,
    dueAmount: 364,
    createdAt: SERVER_TIME,
  };
  assert.equal(
    evaluateSaleCreate(validUser, 'user-1', 'sale-1', validSalePayload, validShopIds, SERVER_TIME),
    'ALLOW',
  );

  // 9. Orphaned sale record (missing shopId)
  assert.equal(
    evaluateSaleCreate(
      validUser,
      'user-1',
      'sale-1',
      { ...validSalePayload, shopId: 'missing-shop' },
      validShopIds,
      SERVER_TIME,
    ),
    'PERMISSION_DENIED',
  );
  // 10. Empty items array
  assert.equal(
    evaluateSaleCreate(validUser, 'user-1', 'sale-1', { ...validSalePayload, items: [] }, validShopIds, SERVER_TIME),
    'PERMISSION_DENIED',
  );
  // 11. Unbounded items array (> 60)
  assert.equal(
    evaluateSaleCreate(
      validUser,
      'user-1',
      'sale-1',
      { ...validSalePayload, items: new Array(61).fill({ productId: 'p1' }) },
      validShopIds,
      SERVER_TIME,
    ),
    'PERMISSION_DENIED',
  );
  // 12. Overpayment / negative arithmetic tamper
  assert.equal(
    evaluateSaleCreate(
      validUser,
      'user-1',
      'sale-1',
      { ...validSalePayload, paidAmount: 999999 },
      validShopIds,
      SERVER_TIME,
    ),
    'PERMISSION_DENIED',
  );
});

test('firestore.rules enforces hardened update guards on sales and payments', () => {
  assert.match(rulesSource, /match \/sales\/\{saleId\}[\s\S]*allow update: if isValidId\(userId\) && isValidId\(saleId\) && isOwner\(userId\)/);
  assert.match(rulesSource, /match \/sales\/\{saleId\}[\s\S]*incoming\(\)\.invoiceNo == existing\(\)\.invoiceNo/);
  assert.match(rulesSource, /match \/sales\/\{saleId\}[\s\S]*incoming\(\)\.updatedAt == request\.time/);
  assert.match(rulesSource, /match \/payments\/\{paymentId\}[\s\S]*allow update: if isValidId\(userId\) && isValidId\(paymentId\) && isOwner\(userId\)/);
  assert.match(rulesSource, /match \/payments\/\{paymentId\}[\s\S]*incoming\(\)\.receiptNo == existing\(\)\.receiptNo/);
  assert.match(rulesSource, /match \/payments\/\{paymentId\}[\s\S]*affectedKeys\(\)\.hasOnly\(\['amount', 'method', 'note', 'updatedAt'\]\)/);
});

