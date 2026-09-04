# MT5 Price Action Bridge

This Expert Advisor sends read-only M1 candle data from MetaTrader 5 to the Price Action Lab.

Flow:
Broker → MT5 → PriceActionBridge EA → /api/mt5/ingest → Supabase candle store → Price Action Engine

The bridge does not place, modify, or close trades.

## Current payload
- symbol
- timeframe
- broker raw time
- UTC-normalized time
- broker UTC offset
- OHLC candles
- tick volume
- spread
- chunk metadata
