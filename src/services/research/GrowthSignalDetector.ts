// ============================================================
// GrowthSignalDetector — Detects growth signals (re-export for interface)
// ============================================================
//
// Growth signal detection is implemented in BuyingSignalDetector
// which handles both buying and growth signals. This file exists
// to satisfy the service architecture contract.

export { buyingSignalDetector as growthSignalDetector } from './BuyingSignalDetector';
