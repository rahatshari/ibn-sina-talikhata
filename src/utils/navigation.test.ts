import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBackNavigation } from './navigation';

test('closes overflow menu before modals or views', () => {
  assert.deepEqual(
    resolveBackNavigation({
      activeView: 'reports',
      hasLedgerShop: false,
      ledgerOrigin: 'shops',
      hasOpenMenu: true,
      hasOpenModal: true,
    }),
    { type: 'close-menu' },
  );
});

test('closes open modal before navigating away from current view', () => {
  assert.deepEqual(
    resolveBackNavigation({
      activeView: 'shops',
      hasLedgerShop: true,
      ledgerOrigin: 'shops',
      hasOpenMenu: false,
      hasOpenModal: true,
    }),
    { type: 'close-modal' },
  );
});

test('closes shopkeeper ledger back to origin view (shops, dashboard, or due)', () => {
  assert.deepEqual(
    resolveBackNavigation({
      activeView: 'shops',
      hasLedgerShop: true,
      ledgerOrigin: 'shops',
      hasOpenMenu: false,
      hasOpenModal: false,
    }),
    { type: 'close-ledger-to-origin', targetView: 'shops' },
  );

  assert.deepEqual(
    resolveBackNavigation({
      activeView: 'shops',
      hasLedgerShop: true,
      ledgerOrigin: 'dashboard',
      hasOpenMenu: false,
      hasOpenModal: false,
    }),
    { type: 'close-ledger-to-origin', targetView: 'dashboard' },
  );

  assert.deepEqual(
    resolveBackNavigation({
      activeView: 'shops',
      hasLedgerShop: true,
      ledgerOrigin: 'due',
      hasOpenMenu: false,
      hasOpenModal: false,
    }),
    { type: 'close-ledger-to-origin', targetView: 'due' },
  );
});

test('returns to dashboard from any top-level sub-page', () => {
  for (const activeView of ['new-sale', 'shops', 'due', 'products', 'reports'] as const) {
    assert.deepEqual(
      resolveBackNavigation({
        activeView,
        hasLedgerShop: false,
        ledgerOrigin: 'shops',
        hasOpenMenu: false,
        hasOpenModal: false,
      }),
      { type: 'back-to-dashboard' },
    );
  }
});

test('exits only when already on dashboard with no open menu or modal', () => {
  assert.deepEqual(
    resolveBackNavigation({
      activeView: 'dashboard',
      hasLedgerShop: false,
      ledgerOrigin: 'shops',
      hasOpenMenu: false,
      hasOpenModal: false,
    }),
    { type: 'exit' },
  );
});
