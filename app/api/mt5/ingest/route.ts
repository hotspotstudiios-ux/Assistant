import { NextRequest, NextResponse } from 'next/server';
import { backtest, Candle } from '../../../../lib/engine';
import { getBridgeStore, setBridgeStore } from '../../../../lib/bridge-store';

type Payload = {
  token?: string;
  symbol?: string;
  brokerTime?: string;
  brokerTimeUtc?: string;
  brokerUtcOffsetSeconds?: number;
  candles?: Candle[];
};

export async function GET() {
  const store = getBridgeStore();
  const lastSeenMs = store.analyzedAt ? Date.now() - new Date(store.analyzedAt).getTime() : Infinity;

  return NextResponse.json({
    ok: true,
    service: 'SilverBulletAI MT5 Bridge',
    mode: 'read-only',
    ...store,
    connected: lastSeenMs < 120000
  });
}

export async function POST(req: NextRequest) {
  const expected = process.env.MT5_BRIDGE_TOKEN;

  let body: Payload;
  try {
    const raw = (await req.text()).replace(/\0/g, '').trim();
    body = JSON.parse(raw) as Payload;
  } catch {
    return NextResponse.json({ ok:false, error:'Invalid JSON payload' }, { status:400 });
  }

  if (expected && body.token !== expected) {
    return NextResponse.json({ ok:false, error:'Unauthorized' }, { status:401 });
  }

  if (!body.symbol || !Array.isArray(body.candles) || body.candles.length < 10) {
    return NextResponse.json({
      ok:false,
      error:'Expected symbol and candles[] with time/open/high/low/close'
    }, { status:400 });
  }

  const candles = body.candles
    .map(c => ({
      time: String(c.time),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close)
    }))
    .filter(c => c.time && [c.open,c.high,c.low,c.close].every(Number.isFinite))
    .sort((a,b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const analyzedAt = new Date().toISOString();
  const next = setBridgeStore({
    connected: true,
    symbol: body.symbol,
    brokerTime: body.brokerTimeUtc ?? body.brokerTime ?? null,
    brokerUtcOffsetSeconds: Number.isFinite(Number(body.brokerUtcOffsetSeconds))
      ? Number(body.brokerUtcOffsetSeconds)
      : null,
    analyzedAt,
    received: candles.length,
    lastCandle: candles.at(-1) ?? null,
    candles,
    model8AM: backtest(candles, 8),
    model9AM: backtest(candles, 9)
  });

  return NextResponse.json({ ok:true, ...next });
}
