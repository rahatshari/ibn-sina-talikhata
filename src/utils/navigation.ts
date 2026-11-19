export type AppView = 'dashboard' | 'new-sale' | 'shops' | 'due' | 'products' | 'reports';

export type LedgerOrigin = 'dashboard' | 'shops' | 'due';

export interface BackNavigationInput {
  activeView: AppView;
  hasLedgerShop: boolean;
  ledgerOrigin: LedgerOrigin;
  hasOpenMenu: boolean;
  hasOpenModal: boolean;
}

export type BackNavigationAction =
  | { type: 'close-menu' }
  | { type: 'close-modal' }
  | { type: 'close-ledger-to-origin'; targetView: LedgerOrigin }
  | { type: 'back-to-dashboard' }
  | { type: 'exit' };

export function resolveBackNavigation(input: BackNavigationInput): BackNavigationAction {
  if (input.hasOpenMenu) {
    return { type: 'close-menu' };
  }
  if (input.hasOpenModal) {
    return { type: 'close-modal' };
  }
  if (input.activeView === 'shops' && input.hasLedgerShop) {
    return { type: 'close-ledger-to-origin', targetView: input.ledgerOrigin };
  }
  if (input.activeView !== 'dashboard') {
    return { type: 'back-to-dashboard' };
  }
  return { type: 'exit' };
}
