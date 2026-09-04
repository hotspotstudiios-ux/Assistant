import { NextRequest, NextResponse } from 'next/server';
import { backtest, Candle } from '../../../../lib/engine';

type Payload = {
  token?: string;
  symbol?: string;
  brokerTime?: string;
  candles?: Candle[];
};

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'SilverBulletAI MT5 Bridge',
    mode: 'read-only',
    endpoint: '/api/mt5/ingest'
  });
}

export async function POST(req: NextRequest) {
  const expected = process.env.MT5_BRIDGE_TOKEN;
  const body = await req.json() as Payload;

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
    .filter(c => c.time && [c.open,c.high,c.low,c.close].every(Number.isFinite));

  return NextResponse.json({
    ok: true,
    symbol: body.symbol,
    brokerTime: body.brokerTime ?? null,
    received: candles.length,
    analyzedAt: new Date().toISOString(),
    model8AM: backtest(candles, 8),
    model9AM: backtest(candles, 9)
  });
}
