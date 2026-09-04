import type { Candle, Signal } from './engine';

export type BridgeSnapshot = {
  connected: boolean;
  symbol: string | null;
  brokerTime: string | null;
  brokerUtcOffsetSeconds: number | null;
  analyzedAt: string | null;
  received: number;
  lastCandle: Candle | null;
  candles: Candle[];
  model8AM: Signal[];
  model9AM: Signal[];
};

declare global {
  var __silverBulletBridge: BridgeSnapshot | undefined;
}

export function getBridgeStore(): BridgeSnapshot {
  if (!globalThis.__silverBulletBridge) {
    globalThis.__silverBulletBridge = {
      connected: false,
      symbol: null,
      brokerTime: null,
      brokerUtcOffsetSeconds: null,
      analyzedAt: null,
      received: 0,
      lastCandle: null,
      candles: [],
      model8AM: [],
      model9AM: []
    };
  }
  return globalThis.__silverBulletBridge;
}

export function setBridgeStore(next: BridgeSnapshot) {
  globalThis.__silverBulletBridge = next;
  return next;
}
